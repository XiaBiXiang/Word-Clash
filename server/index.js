import cors from 'cors';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { validateEnglishWord } from '../src/utils/wordValidation.js';

const PORT = Number(process.env.PORT || 31881);
const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

app.get('/api/healthz', (_req, res) => {
  res.json({
    ok: true,
    timestamp: new Date().toISOString()
  });
});

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: true,
    credentials: true
  }
});

const rooms = new Map();
const DISCONNECT_GRACE_MS = Number(process.env.DISCONNECT_GRACE_MS || 12000);
const BATTLE_ROUND_SECONDS = Number(process.env.BATTLE_ROUND_SECONDS || 40);
const RATE_LIMITS = {
  roomCreate: { windowMs: 10000, max: 4 },
  roomJoin: { windowMs: 10000, max: 8 },
  roomJoinSpectator: { windowMs: 10000, max: 8 },
  roomLeave: { windowMs: 5000, max: 10 },
  readyToggle: { windowMs: 5000, max: 8 },
  swapVote: { windowMs: 4000, max: 8 },
  chatSend: { windowMs: 5000, max: 8 },
  hostAction: { windowMs: 10000, max: 8 },
  submitWord: { windowMs: 5000, max: 6 },
  roundReset: { windowMs: 10000, max: 6 },
  matchReset: { windowMs: 10000, max: 4 }
};

function createRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let index = 0; index < 6; index += 1) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function createRoom(code) {
  return {
    code,
    phase: 'setup',
    countdown: null,
    swapped: false,
    swapVotes: { 1: false, 2: false },
    players: {
      1: { socketId: null, ready: false, letter: '', name: '', clientId: '', disconnectTimer: null },
      2: { socketId: null, ready: false, letter: '', name: '', clientId: '', disconnectTimer: null }
    },
    scores: { 1: 0, 2: 0 },
    chat: [],
    history: [],
    systemEvents: [],
    spectators: new Map(),
    status: { type: 'info', key: 'waiting' },
    hostPlayerId: 1,
    roomLocked: false,
    countdownTimer: null,
    battleStartTimer: null,
    battleTimer: null,
    battleSecondsLeft: null,
    roundDurationSec: BATTLE_ROUND_SECONDS,
    roundId: 0
  };
}

function clearTimers(room) {
  if (room.countdownTimer) {
    clearInterval(room.countdownTimer);
    room.countdownTimer = null;
  }
  if (room.battleStartTimer) {
    clearTimeout(room.battleStartTimer);
    room.battleStartTimer = null;
  }
  if (room.battleTimer) {
    clearInterval(room.battleTimer);
    room.battleTimer = null;
  }
}

function bothOccupied(room) {
  return Boolean(room.players[1].socketId && room.players[2].socketId);
}

function bothReady(room) {
  return Boolean(room.players[1].ready && room.players[2].ready);
}

function resetRoundState(room, keepScore = true) {
  clearTimers(room);
  room.phase = 'setup';
  room.countdown = null;
  room.battleSecondsLeft = null;
  room.roundDurationSec = BATTLE_ROUND_SECONDS;
  room.swapped = false;
  room.swapVotes = { 1: false, 2: false };
  room.players[1].ready = false;
  room.players[2].ready = false;
  room.players[1].letter = '';
  room.players[2].letter = '';
  room.status = { type: 'info', key: bothOccupied(room) ? 'waitingReady' : 'waitingOpponent' };
  if (!keepScore) {
    room.scores = { 1: 0, 2: 0 };
    room.history = [];
  }
}

function buildPublicState(room) {
  const inBattle = room.phase === 'battle' || room.phase === 'round_end';
  const swapVotes = room.swapVotes || { 1: false, 2: false };
  const letters = inBattle
    ? {
        1: room.players[1].letter,
        2: room.players[2].letter
      }
    : {
        1: room.players[1].ready ? '•' : '',
        2: room.players[2].ready ? '•' : ''
      };

  return {
    roomCode: room.code,
    phase: room.phase,
    countdown: room.countdown,
    swapped: room.swapped,
    swapVotes,
    battleSecondsLeft: room.battleSecondsLeft,
    roundDurationSec: room.roundDurationSec,
    hostPlayerId: room.hostPlayerId,
    roomLocked: Boolean(room.roomLocked),
    occupied: {
      1: Boolean(room.players[1].socketId),
      2: Boolean(room.players[2].socketId)
    },
    ready: {
      1: room.players[1].ready,
      2: room.players[2].ready
    },
    playerNames: {
      1: room.players[1].name,
      2: room.players[2].name
    },
    letters,
    scores: room.scores,
    spectatorCount: room.spectators.size,
    spectators: Array.from(room.spectators.values()).map((viewer) => ({
      name: viewer.name
    })),
    chat: room.chat.slice(-80),
    history: room.history.slice(0, 10),
    systemEvents: room.systemEvents.slice(0, 24),
    status: room.status
  };
}

function emitRoomState(room) {
  io.to(room.code).emit('room:state', buildPublicState(room));
}

function pushHistory(room, entry) {
  room.history = [entry, ...room.history].slice(0, 10);
}

function pushSystemEvent(room, event) {
  room.systemEvents = [
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      ts: Date.now(),
      ...event
    },
    ...room.systemEvents
  ].slice(0, 30);
}

function sanitizeLetter(value) {
  const text = String(value || '').toUpperCase().replace(/[^A-Z]/g, '');
  return text.slice(-1);
}

function sanitizeRoomCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

function sanitizePlayerName(value, fallback = 'Player') {
  const cleaned = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
    .trim()
    .slice(0, 16);
  return cleaned || fallback;
}

function getPlayerName(room, playerId) {
  return sanitizePlayerName(room.players[playerId]?.name, `Player ${playerId}`);
}

function sanitizeClientId(value) {
  return String(value || '')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .slice(0, 64);
}

function clearPlayerDisconnectTimer(player) {
  if (player.disconnectTimer) {
    clearTimeout(player.disconnectTimer);
    player.disconnectTimer = null;
  }
}

function sanitizeChatMessage(value) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

function resolveWordValidationReason(reason) {
  switch (reason) {
    case 'only_letters':
      return 'onlyLetters';
    case 'blocked_word':
      return 'blockedWord';
    case 'non_common_word':
      return 'nonCommonWord';
    case 'dictionary_unreachable':
      return 'dictUnavailable';
    default:
      return 'unknownInvalid';
  }
}

function countRoomMembers(room) {
  return Number(Boolean(room.players[1].socketId)) + Number(Boolean(room.players[2].socketId)) + room.spectators.size;
}

function hitRateLimit(socket, key) {
  const config = RATE_LIMITS[key];
  if (!config) {
    return false;
  }

  if (!socket.data.rateLimitStore) {
    socket.data.rateLimitStore = new Map();
  }

  const now = Date.now();
  const entry = socket.data.rateLimitStore.get(key);
  if (!entry || now - entry.start >= config.windowMs) {
    socket.data.rateLimitStore.set(key, { start: now, count: 1 });
    return false;
  }

  if (entry.count >= config.max) {
    return true;
  }

  entry.count += 1;
  socket.data.rateLimitStore.set(key, entry);
  return false;
}

function replyRateLimited(socket, ack) {
  if (typeof ack === 'function') {
    ack({ ok: false, errorKey: 'tooManyRequests' });
    return;
  }
  io.to(socket.id).emit('room:error', { key: 'tooManyRequests' });
}

async function validateBattleWord(room, word) {
  const normalized = String(word || '').trim().toLowerCase();
  if (normalized.length < 4) {
    return { valid: false, key: 'invalidLength' };
  }
  if (!/^[a-z]+$/.test(normalized)) {
    return { valid: false, key: 'onlyLetters' };
  }

  const leftLetter = room.swapped ? room.players[2].letter : room.players[1].letter;
  const rightLetter = room.swapped ? room.players[1].letter : room.players[2].letter;

  if (!normalized.startsWith(leftLetter.toLowerCase())) {
    return {
      valid: false,
      key: 'startMismatch',
      params: { letter: leftLetter }
    };
  }
  if (!normalized.endsWith(rightLetter.toLowerCase())) {
    return {
      valid: false,
      key: 'endMismatch',
      params: { letter: rightLetter }
    };
  }

  const dictionaryResult = await validateEnglishWord(normalized);
  if (!dictionaryResult.valid) {
    return {
      valid: false,
      key: resolveWordValidationReason(dictionaryResult.reason)
    };
  }

  return {
    valid: true,
    word: normalized
  };
}

function startBattleTimer(room) {
  if (room.phase !== 'battle' || room.battleSecondsLeft === null) {
    return;
  }

  if (room.battleTimer) {
    clearInterval(room.battleTimer);
  }

  room.battleTimer = setInterval(() => {
    if (room.phase !== 'battle') {
      clearTimers(room);
      return;
    }

    room.battleSecondsLeft = Math.max(0, Number(room.battleSecondsLeft || 0) - 1);
    if (room.battleSecondsLeft > 0) {
      emitRoomState(room);
      return;
    }

    clearTimers(room);
    room.phase = 'round_end';
    room.swapVotes = { 1: false, 2: false };
    room.status = {
      type: 'info',
      key: 'roundTimeout',
      params: { seconds: room.roundDurationSec }
    };
    pushSystemEvent(room, room.status);
    emitRoomState(room);
  }, 1000);
}

function finalizePlayerLeave(room, playerId, roomCode, options = {}) {
  const leavingName = getPlayerName(room, playerId);
  const otherPlayerId = playerId === 1 ? 2 : 1;
  clearPlayerDisconnectTimer(room.players[playerId]);
  room.players[playerId] = {
    socketId: null,
    ready: false,
    letter: '',
    name: '',
    clientId: '',
    disconnectTimer: null
  };

  if (!room.players[1].socketId && !room.players[2].socketId && room.spectators.size === 0) {
    clearTimers(room);
    rooms.delete(roomCode);
    return;
  }

  if (Number(room.hostPlayerId) === Number(playerId)) {
    room.hostPlayerId = room.players[otherPlayerId]?.socketId ? otherPlayerId : 1;
  }

  resetRoundState(room, true);
  room.status = options.status || {
    type: 'info',
    key: 'opponentLeft',
    params: { player: playerId, name: leavingName }
  };
  if (!options.skipEvent) {
    pushSystemEvent(room, room.status);
  }
  if (!options.skipEmit) {
    emitRoomState(room);
  }
}

function leaveRoom(socket, options = {}) {
  const reason = options.reason || 'leave';
  const roomCode = socket.data.roomCode;
  const playerId = socket.data.playerId;
  const role = socket.data.role;
  if (!roomCode || !playerId) {
    if (roomCode && role === 'spectator') {
      const room = rooms.get(roomCode);
      if (room) {
        room.spectators.delete(socket.id);
        if (countRoomMembers(room) === 0) {
          clearTimers(room);
          rooms.delete(roomCode);
        } else {
          if (!options.skipEvent) {
            pushSystemEvent(room, {
              type: 'info',
              key: 'spectatorLeft',
              params: { name: socket.data.playerName || 'Spectator' }
            });
          }
          emitRoomState(room);
        }
      }
      socket.leave(roomCode);
    }
    socket.data.roomCode = null;
    socket.data.playerId = null;
    socket.data.playerName = '';
    socket.data.role = null;
    socket.data.clientId = '';
    return;
  }

  const room = rooms.get(roomCode);
  if (!room) {
    socket.data.roomCode = null;
    socket.data.playerId = null;
    socket.data.playerName = '';
    socket.data.role = null;
    socket.data.clientId = '';
    return;
  }

  const player = room.players[playerId];
  if (reason === 'disconnect') {
    player.socketId = null;
    clearPlayerDisconnectTimer(player);
    player.disconnectTimer = setTimeout(() => {
      const latestRoom = rooms.get(roomCode);
      if (!latestRoom) {
        return;
      }
      const latestPlayer = latestRoom.players[playerId];
      if (!latestPlayer || latestPlayer.socketId) {
        return;
      }
      finalizePlayerLeave(latestRoom, playerId, roomCode);
    }, DISCONNECT_GRACE_MS);

    room.status = {
      type: 'info',
      key: 'playerReconnecting',
      params: { player: playerId, name: getPlayerName(room, playerId) }
    };
    emitRoomState(room);
  } else {
    finalizePlayerLeave(room, playerId, roomCode);
  }

  socket.leave(roomCode);
  socket.data.roomCode = null;
  socket.data.playerId = null;
  socket.data.playerName = '';
  socket.data.role = null;
  socket.data.clientId = '';
}

function isHost(room, playerId) {
  return Number(room?.hostPlayerId) === Number(playerId);
}

function ensureCanStartCountdown(room) {
  if (room.phase !== 'setup' || !bothOccupied(room) || !bothReady(room)) {
    return;
  }

  clearTimers(room);
  room.phase = 'countdown';
  room.countdown = 3;
  room.status = { type: 'info', key: 'bothReady' };
  emitRoomState(room);

  room.countdownTimer = setInterval(() => {
    if (!bothOccupied(room) || !bothReady(room)) {
      resetRoundState(room, true);
      emitRoomState(room);
      return;
    }

    room.countdown -= 1;
    emitRoomState(room);

    if (room.countdown !== 0) {
      return;
    }

    clearTimers(room);
    room.battleStartTimer = setTimeout(() => {
      if (!bothOccupied(room) || !bothReady(room)) {
        resetRoundState(room, true);
        emitRoomState(room);
        return;
      }

      room.phase = 'battle';
      room.countdown = null;
      room.swapped = false;
      room.swapVotes = { 1: false, 2: false };
      room.roundId += 1;
      room.roundDurationSec = BATTLE_ROUND_SECONDS;
      room.battleSecondsLeft = BATTLE_ROUND_SECONDS;
      room.status = { type: 'info', key: 'battleReady' };
      emitRoomState(room);
      startBattleTimer(room);
    }, 420);
  }, 1000);
}

io.on('connection', (socket) => {
  socket.data.roomCode = null;
  socket.data.playerId = null;
  socket.data.playerName = '';
  socket.data.role = null;
  socket.data.clientId = '';
  socket.data.rateLimitStore = new Map();

  socket.on('room:create', (payloadOrAck, maybeAck) => {
    const payload = typeof payloadOrAck === 'function' ? {} : payloadOrAck || {};
    const ack = typeof payloadOrAck === 'function' ? payloadOrAck : maybeAck;
    if (hitRateLimit(socket, 'roomCreate')) {
      replyRateLimited(socket, ack);
      return;
    }
    leaveRoom(socket, { reason: 'leave' });

    let code = createRoomCode();
    while (rooms.has(code)) {
      code = createRoomCode();
    }

    const room = createRoom(code);
    rooms.set(code, room);

    room.players[1].socketId = socket.id;
    room.players[1].name = sanitizePlayerName(payload?.name, 'Player 1');
    room.players[1].clientId = sanitizeClientId(payload?.clientId) || `guest-${socket.id}`;
    clearPlayerDisconnectTimer(room.players[1]);
    socket.data.roomCode = code;
    socket.data.playerId = 1;
    socket.data.playerName = room.players[1].name;
    socket.data.role = 'player';
    socket.data.clientId = room.players[1].clientId;
    socket.join(code);

    room.status = {
      type: 'info',
      key: 'waitingOpponent',
      params: { player: 1, name: room.players[1].name }
    };
    pushSystemEvent(room, {
      type: 'info',
      key: 'roomCreated',
      params: { player: 1, name: room.players[1].name }
    });
    emitRoomState(room);
    ack?.({ ok: true, roomCode: code, playerId: 1, playerName: room.players[1].name });
  });

  socket.on('room:join', (payload, ack) => {
    if (hitRateLimit(socket, 'roomJoin')) {
      replyRateLimited(socket, ack);
      return;
    }
    leaveRoom(socket, { reason: 'leave' });

    const roomCode = sanitizeRoomCode(payload?.roomCode);
    const clientId = sanitizeClientId(payload?.clientId);
    const room = rooms.get(roomCode);
    if (!room) {
      ack?.({ ok: false, errorKey: 'roomNotFound' });
      return;
    }

    const rejoinSeat1 = Boolean(
      clientId && !room.players[1].socketId && room.players[1].clientId === clientId
    );
    const rejoinSeat2 = Boolean(
      clientId && !room.players[2].socketId && room.players[2].clientId === clientId
    );
    const isRejoinSeat = rejoinSeat1 || rejoinSeat2;
    const hasFreeSeat = !room.players[1].socketId || !room.players[2].socketId;

    if (!isRejoinSeat && !hasFreeSeat) {
      ack?.({ ok: false, errorKey: 'roomFull' });
      return;
    }
    if (!isRejoinSeat && room.roomLocked) {
      ack?.({ ok: false, errorKey: 'roomLocked' });
      return;
    }

    let playerId = null;
    if (rejoinSeat1) {
      playerId = 1;
    } else if (rejoinSeat2) {
      playerId = 2;
    } else if (!room.players[1].socketId) {
      playerId = 1;
    } else if (!room.players[2].socketId) {
      playerId = 2;
    }

    if (!playerId) {
      ack?.({ ok: false, errorKey: 'roomFull' });
      return;
    }

    room.players[playerId].socketId = socket.id;
    if (!isRejoinSeat) {
      room.players[playerId].ready = false;
      room.players[playerId].letter = '';
    }
    room.players[playerId].name = sanitizePlayerName(payload?.name, `Player ${playerId}`);
    room.players[playerId].clientId = clientId || room.players[playerId].clientId || `guest-${socket.id}`;
    clearPlayerDisconnectTimer(room.players[playerId]);
    if (!room.players[room.hostPlayerId]?.socketId) {
      room.hostPlayerId = playerId;
    }

    socket.data.roomCode = roomCode;
    socket.data.playerId = playerId;
    socket.data.playerName = room.players[playerId].name;
    socket.data.role = 'player';
    socket.data.clientId = room.players[playerId].clientId;
    socket.join(roomCode);

    room.status = isRejoinSeat
      ? {
          type: 'info',
          key: 'playerRejoined',
          params: { player: playerId, name: room.players[playerId].name }
        }
      : {
          type: 'info',
          key: 'waitingReady',
          params: { player: playerId, name: room.players[playerId].name }
        };
    pushSystemEvent(room, {
      type: 'info',
      key: isRejoinSeat ? 'playerRejoined' : 'playerJoined',
      params: { player: playerId, name: room.players[playerId].name }
    });
    emitRoomState(room);
    ack?.({ ok: true, roomCode, playerId, playerName: room.players[playerId].name });
  });

  socket.on('room:join-spectator', (payload, ack) => {
    if (hitRateLimit(socket, 'roomJoinSpectator')) {
      replyRateLimited(socket, ack);
      return;
    }
    leaveRoom(socket, { reason: 'leave' });

    const roomCode = sanitizeRoomCode(payload?.roomCode);
    const room = rooms.get(roomCode);
    if (!room) {
      ack?.({ ok: false, errorKey: 'roomNotFound' });
      return;
    }

    const spectatorName = sanitizePlayerName(payload?.name, 'Spectator');
    const spectatorClientId = sanitizeClientId(payload?.clientId) || `viewer-${socket.id}`;

    room.spectators.set(socket.id, {
      socketId: socket.id,
      name: spectatorName,
      clientId: spectatorClientId
    });

    socket.data.roomCode = roomCode;
    socket.data.playerId = null;
    socket.data.playerName = spectatorName;
    socket.data.role = 'spectator';
    socket.data.clientId = spectatorClientId;
    socket.join(roomCode);

    pushSystemEvent(room, {
      type: 'info',
      key: 'spectatorJoined',
      params: { name: spectatorName }
    });
    emitRoomState(room);
    ack?.({ ok: true, roomCode, role: 'spectator', playerName: spectatorName });
  });

  socket.on('room:leave', (ack) => {
    if (hitRateLimit(socket, 'roomLeave')) {
      replyRateLimited(socket, ack);
      return;
    }
    leaveRoom(socket, { reason: 'leave' });
    ack?.({ ok: true });
  });

  socket.on('player:toggle-ready', (payload) => {
    if (hitRateLimit(socket, 'readyToggle')) {
      replyRateLimited(socket);
      return;
    }
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (!roomCode || !playerId) {
      return;
    }

    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'setup') {
      return;
    }

    const self = room.players[playerId];
    if (self.ready) {
      self.ready = false;
      self.letter = '';
      room.status = {
        type: 'info',
        key: 'playerEditing',
        params: { player: playerId, name: getPlayerName(room, playerId) }
      };
      emitRoomState(room);
      return;
    }

    const letter = sanitizeLetter(payload?.letter);
    if (!letter) {
      io.to(socket.id).emit('room:error', { key: 'invalidLetter' });
      return;
    }

    self.letter = letter;
    self.ready = true;
    room.status = {
      type: 'info',
      key: 'playerLocked',
      params: { player: playerId, name: getPlayerName(room, playerId) }
    };
    emitRoomState(room);
    ensureCanStartCountdown(room);
  });

  socket.on('battle:swap', () => {
    if (hitRateLimit(socket, 'swapVote')) {
      replyRateLimited(socket);
      return;
    }
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (!roomCode || !playerId) {
      return;
    }
    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'battle') {
      return;
    }
    if (!room.swapVotes) {
      room.swapVotes = { 1: false, 2: false };
    }

    const alreadyVoted = Boolean(room.swapVotes[playerId]);
    room.swapVotes[playerId] = !alreadyVoted;
    const progress = Number(room.swapVotes[1]) + Number(room.swapVotes[2]);

    if (progress < 2) {
      room.status = {
        type: 'info',
        key: alreadyVoted ? 'swapVoteCanceled' : 'swapPending',
        params: {
          player: playerId,
          name: getPlayerName(room, playerId),
          progress,
          total: 2
        }
      };
      emitRoomState(room);
      return;
    }

    room.swapped = !room.swapped;
    room.swapVotes = { 1: false, 2: false };
    room.status = {
      type: 'info',
      key: 'lettersSwapped',
      params: { player: playerId, name: getPlayerName(room, playerId) }
    };
    emitRoomState(room);
  });

  socket.on('chat:send', (payload) => {
    if (hitRateLimit(socket, 'chatSend')) {
      replyRateLimited(socket);
      return;
    }
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    const role = socket.data.role;
    if (!roomCode || !role) {
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      return;
    }

    const message = sanitizeChatMessage(payload?.message);
    if (!message) {
      return;
    }

    const senderName =
      role === 'player' && playerId
        ? getPlayerName(room, playerId)
        : sanitizePlayerName(socket.data.playerName, 'Spectator');

    const senderClientId =
      role === 'player' && playerId
        ? room.players[playerId]?.clientId || socket.data.clientId || ''
        : socket.data.clientId || '';

    room.chat.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      player: role === 'player' ? playerId : null,
      role,
      playerName: senderName,
      clientId: senderClientId,
      text: message,
      ts: Date.now()
    });

    if (room.chat.length > 120) {
      room.chat = room.chat.slice(-80);
    }

    emitRoomState(room);
  });

  socket.on('room:lock-toggle', (payloadOrAck, maybeAck) => {
    const ack = typeof payloadOrAck === 'function' ? payloadOrAck : maybeAck;
    if (hitRateLimit(socket, 'hostAction')) {
      replyRateLimited(socket, ack);
      return;
    }
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (!roomCode || !playerId) {
      ack?.({ ok: false, errorKey: 'roomNotFound' });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      ack?.({ ok: false, errorKey: 'roomNotFound' });
      return;
    }
    if (!isHost(room, playerId)) {
      ack?.({ ok: false, errorKey: 'notHost' });
      return;
    }

    room.roomLocked = !room.roomLocked;
    room.status = {
      type: 'info',
      key: room.roomLocked ? 'roomLockedByHost' : 'roomUnlockedByHost',
      params: { player: playerId, name: getPlayerName(room, playerId) }
    };
    pushSystemEvent(room, room.status);
    emitRoomState(room);
    ack?.({ ok: true, roomLocked: room.roomLocked });
  });

  socket.on('room:transfer-host', (payload, ack) => {
    if (hitRateLimit(socket, 'hostAction')) {
      replyRateLimited(socket, ack);
      return;
    }
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (!roomCode || !playerId) {
      ack?.({ ok: false, errorKey: 'roomNotFound' });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      ack?.({ ok: false, errorKey: 'roomNotFound' });
      return;
    }
    if (!isHost(room, playerId)) {
      ack?.({ ok: false, errorKey: 'notHost' });
      return;
    }

    const targetPlayerId = Number(payload?.playerId);
    if (targetPlayerId !== 1 && targetPlayerId !== 2) {
      ack?.({ ok: false, errorKey: 'targetNotFound' });
      return;
    }
    if (targetPlayerId === Number(playerId)) {
      ack?.({ ok: false, errorKey: 'targetNotFound' });
      return;
    }
    if (!room.players[targetPlayerId]?.socketId) {
      ack?.({ ok: false, errorKey: 'targetNotFound' });
      return;
    }

    room.hostPlayerId = targetPlayerId;
    room.status = {
      type: 'info',
      key: 'hostTransferred',
      params: {
        player: targetPlayerId,
        name: getPlayerName(room, targetPlayerId)
      }
    };
    pushSystemEvent(room, room.status);
    emitRoomState(room);
    ack?.({ ok: true, hostPlayerId: targetPlayerId });
  });

  socket.on('room:kick', (payload, ack) => {
    if (hitRateLimit(socket, 'hostAction')) {
      replyRateLimited(socket, ack);
      return;
    }
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (!roomCode || !playerId) {
      ack?.({ ok: false, errorKey: 'roomNotFound' });
      return;
    }

    const room = rooms.get(roomCode);
    if (!room) {
      ack?.({ ok: false, errorKey: 'roomNotFound' });
      return;
    }
    if (!isHost(room, playerId)) {
      ack?.({ ok: false, errorKey: 'notHost' });
      return;
    }

    const targetPlayerId = Number(payload?.playerId);
    if (targetPlayerId !== 1 && targetPlayerId !== 2) {
      ack?.({ ok: false, errorKey: 'targetNotFound' });
      return;
    }
    if (targetPlayerId === Number(playerId)) {
      ack?.({ ok: false, errorKey: 'cannotKickSelf' });
      return;
    }

    const target = room.players[targetPlayerId];
    if (!target?.socketId) {
      ack?.({ ok: false, errorKey: 'targetNotFound' });
      return;
    }

    const targetSocket = io.sockets.sockets.get(target.socketId);
    const targetName = getPlayerName(room, targetPlayerId);
    const hostName = getPlayerName(room, playerId);

    if (targetSocket) {
      targetSocket.emit('room:kicked', {
        key: 'kickedByHost',
        params: { hostName, name: hostName, player: playerId, targetName }
      });
      targetSocket.leave(roomCode);
      targetSocket.data.roomCode = null;
      targetSocket.data.playerId = null;
      targetSocket.data.playerName = '';
    }

    finalizePlayerLeave(room, targetPlayerId, roomCode, {
      status: {
        type: 'info',
        key: 'playerKicked',
        params: { player: targetPlayerId, name: targetName, hostName }
      }
    });
    ack?.({ ok: true, targetPlayerId });
  });

  socket.on('battle:submit', async (payload) => {
    if (hitRateLimit(socket, 'submitWord')) {
      replyRateLimited(socket);
      return;
    }
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (!roomCode || !playerId) {
      return;
    }

    const room = rooms.get(roomCode);
    if (!room || room.phase !== 'battle') {
      return;
    }
    const submitRoundId = room.roundId;

    const result = await validateBattleWord(room, payload?.word);
    const latestRoom = rooms.get(roomCode);
    if (!latestRoom || latestRoom !== room) {
      return;
    }
    if (latestRoom.phase !== 'battle' || latestRoom.roundId !== submitRoundId) {
      return;
    }

    if (!result.valid) {
      room.status = {
        type: 'error',
        key: result.key,
        params: result.params || {}
      };
      pushHistory(room, {
        id: `${Date.now()}-${Math.random()}`,
        word: String(payload?.word || '').trim().toLowerCase(),
        player: playerId,
        playerName: getPlayerName(room, playerId),
        success: false
      });
      emitRoomState(room);
      return;
    }

    clearTimers(room);
    room.scores[playerId] += 1;
    room.phase = 'round_end';
    room.battleSecondsLeft = 0;
    room.swapVotes = { 1: false, 2: false };
    room.status = {
      type: 'success',
      key: 'successHit',
      params: {
        player: playerId,
        name: getPlayerName(room, playerId),
        word: result.word.toUpperCase()
      }
    };
    pushHistory(room, {
      id: `${Date.now()}-${Math.random()}`,
      word: result.word,
      player: playerId,
      playerName: getPlayerName(room, playerId),
      success: true
    });
    emitRoomState(room);
  });

  socket.on('round:reset', () => {
    if (hitRateLimit(socket, 'roundReset')) {
      replyRateLimited(socket);
      return;
    }
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (!roomCode) {
      return;
    }
    const room = rooms.get(roomCode);
    if (!room) {
      return;
    }

    resetRoundState(room, true);
    room.status = {
      type: 'info',
      key: 'roundReset',
      params: { player: playerId, name: getPlayerName(room, playerId) }
    };
    pushSystemEvent(room, room.status);
    emitRoomState(room);
  });

  socket.on('match:reset', () => {
    if (hitRateLimit(socket, 'matchReset')) {
      replyRateLimited(socket);
      return;
    }
    const roomCode = socket.data.roomCode;
    const playerId = socket.data.playerId;
    if (!roomCode) {
      return;
    }
    const room = rooms.get(roomCode);
    if (!room) {
      return;
    }

    resetRoundState(room, false);
    room.status = {
      type: 'info',
      key: 'matchReset',
      params: { player: playerId, name: getPlayerName(room, playerId) }
    };
    pushSystemEvent(room, room.status);
    emitRoomState(room);
  });

  socket.on('disconnect', () => {
    leaveRoom(socket, { reason: 'disconnect' });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  // eslint-disable-next-line no-console
  console.log(`Word Clash server listening on 0.0.0.0:${PORT}`);
});
