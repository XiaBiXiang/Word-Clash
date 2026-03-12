import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { validateEnglishWord } from './utils/wordValidation.js';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
const IDENTITY_STORAGE_KEY = 'word-clash-identity';
const CLIENT_ID_STORAGE_KEY = 'word-clash-client-id';
const THEME_STORAGE_KEY = 'word-clash-theme';
const LANG_STORAGE_KEY = 'word-clash-lang';
const AI_ROUND_SECONDS = 24;

const EMPTY_ROOM_STATE = {
  roomCode: '',
  phase: 'setup',
  roundId: 0,
  countdown: null,
  swapped: false,
  swapVotes: { 1: false, 2: false },
  battleSecondsLeft: null,
  roundDurationSec: 40,
  hostPlayerId: 1,
  roomLocked: false,
  spectatorCount: 0,
  spectators: [],
  occupied: { 1: false, 2: false },
  ready: { 1: false, 2: false },
  playerNames: { 1: '', 2: '' },
  letters: { 1: '', 2: '' },
  scores: { 1: 0, 2: 0 },
  chat: [],
  history: [],
  systemEvents: [],
  status: { type: 'info', key: 'waitingOpponent' }
};

const EMPTY_AI_STATE = {
  phase: 'setup',
  countdown: null,
  swapped: false,
  letters: { 1: '', 2: '' },
  battleSecondsLeft: null,
  roundDurationSec: AI_ROUND_SECONDS,
  score: 0,
  round: 1,
  status: { type: 'info', key: 'aiSetupHint' }
};

const I18N = {
  zh: {
    title: '首尾对决',
    subtitle: 'Word Clash · 实时联机版',
    languageTag: 'EN',
    languageLabel: '语言',
    themeNeon: '霓虹',
    themeCream: '白棕',
    player: '玩家',
    score: '得分',
    roomCode: '房间码',
    createRoom: '创建房间',
    joinRoom: '加入房间',
    spectateRoom: '加入观战',
    aiMode: '人机对战',
    aiModeTitle: '人机挑战',
    aiModeDesc: '你输入一个字母，AI 会随机生成另一个字母，本回合限时更短。',
    aiOpponent: 'AI 对手',
    aiStartRound: '开始回合',
    aiNextRound: '下一回合',
    aiReset: '重置人机',
    aiExit: '返回大厅',
    aiRound: '回合',
    copy: '复制',
    leaveHint: '将房间码发给另一位玩家后即可联机。',
    roomInput: '输入 6 位房间码',
    accountLabel: '账户标识',
    accountHint: '仅作身份标记，无需登录，双方都能看到。',
    accountPlaceholder: '例如：NightFox',
    hiddenLetter: '盲填字母',
    hiddenHint: '输入时始终显示为 •，不会回显字母',
    ready: 'Ready',
    edit: '修改',
    submit: '提交',
    swap: '交换首尾',
    roundTimer: '回合倒计时',
    nextRound: '下一回合',
    resetMatch: '重置比赛',
    backToLobby: '返回搜房',
    moreActions: '更多',
    actionsPanel: '房间操作',
    leaveConfirmTitle: '确认离开当前房间？',
    leaveConfirmDesc: '离开后会返回搜房界面，并释放当前玩家席位。',
    leaveConfirmAction: '确认离开',
    cancel: '取消',
    rulesButton: '游戏规则',
    rulesTitle: '新手操作说明',
    rulesIntroTitle: '快速上手',
    rulesIntro1: '先设置账户标识，再创建房间或输入房间码加入房间。',
    rulesIntro2: '每局最多两名玩家对战，其他人可观战并实时聊天。',
    rulesFlowTitle: '回合流程',
    rulesFlow1: '准备阶段：双方各盲填 1 个英文字母并点击 Ready。',
    rulesFlow2: '双方都 Ready 后触发 3-2-1 倒计时并揭晓字母。',
    rulesFlow3: '对战阶段：在中间输入单词，也可以发起交换首尾投票。',
    rulesFlow4: '交换规则：必须两位玩家都投票（2/2）后才会真正交换。',
    rulesFlow5: '任意玩家命中有效单词后，本回合立即结束并结算得分。',
    rulesJudgeTitle: '判定规则',
    rulesJudge1: '单词必须以当前左侧字母开头、右侧字母结尾。',
    rulesJudge2: '单词总长度至少为 4（中间至少 2 个字母）。',
    rulesJudge3: '仅允许英文字母 A-Z，不允许缩写/人名/专有名词。',
    rulesJudge4: '系统会做词典合法性校验，不合法会提示原因。',
    rulesTipsTitle: '实用提示',
    rulesTip1: '进入房间后，任何阶段都可以发送聊天消息。',
    rulesTip2: '房主可执行锁房、移除对手、转移房主等管理操作。',
    rulesTip3: '若网络波动会自动重连；频繁点击会触发限流保护。',
    rulesClose: '我知道了',
    inputPlaceholder: '输入英文单词...',
    setupTitle: '准备阶段',
    battleTitle: '对战阶段',
    showHistory: '展开记录',
    hideHistory: '收起记录',
    startLetter: '首字母',
    endLetter: '尾字母',
    historyTitle: '对战记录',
    waitingHistory: '暂无记录',
    historySubmitted: '提交了答案',
    chatTitle: '实时聊天',
    showChat: '展开聊天',
    hideChat: '收起聊天',
    chatPlaceholder: '输入消息...',
    send: '发送',
    chatEmpty: '还没有消息',
    systemTimeline: '系统消息',
    showSystem: '展开系统',
    hideSystem: '收起系统',
    emptySystem: '暂无系统消息',
    you: '你',
    opponent: '对手',
    spectator: '观战',
    spectatorMode: '观战模式',
    spectatorHint: '你当前为观战者，可实时聊天，但不能 Ready/交换/提交。',
    spectatorCount: '观战人数',
    hostTag: '房主',
    lockedTag: '已锁定',
    voted: '已投票',
    selfInputOnly: '仅对手可输入',
    lockRoom: '锁定房间',
    unlockRoom: '解除锁定',
    kickOpponent: '移除对手',
    transferHost: '转移房主',
    confirmKick: '确认将对手移出房间？',
    confirmTransfer: '确认把房主权限转给对手？',
    hostActionConfirmTitle: '确认执行该房主管理操作？',
    hostActionConfirmDo: '确认执行',
    connection: {
      connected: '已连接',
      disconnected: '已断开',
      connecting: '连接中'
    },
    status: {
      lobbyHint: '先创建或加入房间。',
      waitingOpponent: '{name} 已创建房间，等待另一位玩家加入。',
      roomCreated: '{name} 创建了房间。',
      waitingReady: '{name} 已入场，请双方输入字母并点击 Ready。',
      playerJoined: '{name} 加入了房间。',
      bothReady: '双方就位，倒计时开始。',
      battleReady: '字母揭晓，开始拼写。',
      reconnecting: '网络波动，正在尝试自动重连房间...',
      aiSetupHint: '请输入你的字母并点击“开始回合”，AI 会随机生成对手字母。',
      aiCountdownStart: '人机双方就位，倒计时开始。',
      aiRoundReset: '已进入下一回合，请重新输入你的字母。',
      playerReconnecting: '{name} 掉线，等待重连中...',
      playerRejoined: '{name} 已重新连接。',
      spectatorJoined: '{name} 进入了观战。',
      spectatorLeft: '{name} 离开了观战。',
      playerLocked: '{name} 已锁定字母。',
      playerEditing: '{name} 取消锁定，可重新输入。',
      swapPending: '{name} 发起了交换投票（{progress}/{total}）。',
      swapVoteCanceled: '{name} 取消了交换投票（{progress}/{total}）。',
      lettersSwapped: '双方确认完成，首尾字母已交换。',
      roomLockedByHost: '{name} 已锁定房间，禁止新玩家加入。',
      roomUnlockedByHost: '{name} 已解除房间锁定。',
      playerKicked: '房主已将 {name} 移出房间。',
      hostTransferred: '房主权限已转移给 {name}。',
      roundTimeout: '时间到，本回合平局结束。',
      roundReset: '{name} 发起了下一回合。',
      matchReset: '{name} 重置了整场比赛。',
      opponentLeft: '{name} 离开了房间，回合已重置。',
      successHit: '{name} 命中：{word}',
      invalidLength: '单词长度至少为 4 个字母。',
      onlyLetters: '只允许输入英文字母（A-Z）。',
      startMismatch: '单词必须以 {letter} 开头。',
      endMismatch: '单词必须以 {letter} 结尾。',
      blockedWord: '该词被判定为缩写/人名/专有名词，不可使用。',
      nonCommonWord: '词典中未找到可用的常规词义。',
      dictUnavailable: '词典服务不可用，且本地词库未命中该词。',
      unknownInvalid: '该单词不符合规则，请重试。',
      roomNotFound: '房间不存在，请检查房间码。',
      roomFull: '房间已满，请创建新房间。',
      roomLocked: '房间已锁定，暂不可加入。',
      notHost: '仅房主可执行该操作。',
      cannotKickSelf: '不能移除自己。',
      targetNotFound: '目标玩家不存在或已离线。',
      kickedByHost: '你已被房主 {hostName} 移出房间。',
      invalidLetter: '请输入一个有效英文字母。',
      tooManyRequests: '操作过于频繁，请稍后重试。'
    },
    toast: {
      createdRoom: '房间 {roomCode} 已创建。',
      joinedRoom: '已加入房间 {roomCode}。',
      copiedRoomCode: '房间码已复制。',
      copyFailed: '复制失败，请手动复制。',
      readyLocked: '你已锁定字母。',
      readyUnlocked: '你已取消锁定。',
      swapSent: '已发起交换投票。',
      swapCanceled: '已取消交换投票。',
      rejoinedRoom: '已自动重连房间 {roomCode}。',
      rejoinFailed: '重连失败，请重新加入房间。',
      leaveConfirm: '请确认是否离开当前房间。',
      leftRoom: '已离开房间，返回大厅。',
      identitySaved: '账户标识已更新。'
    },
    scorePoint: '{name} 得分',
    fight: '对决'
  },
  en: {
    title: 'Word Clash',
    subtitle: '首尾对决 · Realtime Online',
    languageTag: '中',
    languageLabel: 'Language',
    themeNeon: 'Neon',
    themeCream: 'Cream',
    player: 'Player',
    score: 'Score',
    roomCode: 'Room Code',
    createRoom: 'Create Room',
    joinRoom: 'Join Room',
    spectateRoom: 'Spectate',
    aiMode: 'Play VS AI',
    aiModeTitle: 'AI Challenge',
    aiModeDesc: 'You choose one letter, AI generates the other. The round timer is shorter.',
    aiOpponent: 'AI Opponent',
    aiStartRound: 'Start Round',
    aiNextRound: 'Next Round',
    aiReset: 'Reset AI',
    aiExit: 'Back To Lobby',
    aiRound: 'Round',
    copy: 'Copy',
    leaveHint: 'Share this room code with your opponent to play online.',
    roomInput: 'Enter 6-char room code',
    accountLabel: 'Player Tag',
    accountHint: 'No login needed. Used only to identify each player.',
    accountPlaceholder: 'e.g. NightFox',
    hiddenLetter: 'Hidden Letter',
    hiddenHint: 'Input always displays • and never reveals the raw letter',
    ready: 'Ready',
    edit: 'Edit',
    submit: 'Submit',
    swap: 'Swap Letters',
    roundTimer: 'Round Timer',
    nextRound: 'Next Round',
    resetMatch: 'Reset Match',
    backToLobby: 'Back To Lobby',
    moreActions: 'More',
    actionsPanel: 'Room Actions',
    leaveConfirmTitle: 'Leave this room now?',
    leaveConfirmDesc: 'You will return to lobby search and release your player slot.',
    leaveConfirmAction: 'Leave Room',
    cancel: 'Cancel',
    rulesButton: 'How To Play',
    rulesTitle: 'Quick Rules Guide',
    rulesIntroTitle: 'Getting Started',
    rulesIntro1: 'Set your player tag, then create a room or join with a room code.',
    rulesIntro2: 'Two players battle in one room. Others can join as spectators and chat.',
    rulesFlowTitle: 'Round Flow',
    rulesFlow1: 'Setup: each player enters one hidden letter and presses Ready.',
    rulesFlow2: 'When both are ready, a 3-2-1 countdown starts and letters are revealed.',
    rulesFlow3: 'Battle: type a word in the center, or vote to swap start/end letters.',
    rulesFlow4: 'Swap rule: letters swap only when both players vote (2/2).',
    rulesFlow5: 'Once a player submits a valid word, the round ends immediately.',
    rulesJudgeTitle: 'Validation Rules',
    rulesJudge1: 'Word must start with the current left letter and end with the right letter.',
    rulesJudge2: 'Word length must be at least 4 letters.',
    rulesJudge3: 'Only A-Z letters are allowed. Acronyms/names/proper nouns are blocked.',
    rulesJudge4: 'The system checks dictionary validity and gives failure reasons.',
    rulesTipsTitle: 'Tips',
    rulesTip1: 'Chat is available at any stage after entering a room.',
    rulesTip2: 'Host can lock room, kick opponent, and transfer host permission.',
    rulesTip3: 'Auto-reconnect handles brief network drops. Spam clicks trigger rate limits.',
    rulesClose: 'Got It',
    inputPlaceholder: 'Type an English word...',
    setupTitle: 'Preparation',
    battleTitle: 'Battle',
    showHistory: 'Show Log',
    hideHistory: 'Hide Log',
    startLetter: 'Start',
    endLetter: 'End',
    historyTitle: 'Battle Log',
    waitingHistory: 'No records yet',
    historySubmitted: 'submitted an answer',
    chatTitle: 'Live Chat',
    showChat: 'Show Chat',
    hideChat: 'Hide Chat',
    chatPlaceholder: 'Type message...',
    send: 'Send',
    chatEmpty: 'No messages yet',
    systemTimeline: 'System Feed',
    showSystem: 'Show Feed',
    hideSystem: 'Hide Feed',
    emptySystem: 'No system messages',
    you: 'You',
    opponent: 'Opponent',
    spectator: 'Spectator',
    spectatorMode: 'Spectator Mode',
    spectatorHint: 'You are spectating. Chat is enabled, but Ready/Swap/Submit are disabled.',
    spectatorCount: 'Spectators',
    hostTag: 'Host',
    lockedTag: 'Locked',
    voted: 'Voted',
    selfInputOnly: 'Opponent input only',
    lockRoom: 'Lock Room',
    unlockRoom: 'Unlock Room',
    kickOpponent: 'Kick Opponent',
    transferHost: 'Transfer Host',
    confirmKick: 'Remove your opponent from this room?',
    confirmTransfer: 'Transfer host permission to your opponent?',
    hostActionConfirmTitle: 'Confirm this host action?',
    hostActionConfirmDo: 'Confirm',
    connection: {
      connected: 'Connected',
      disconnected: 'Disconnected',
      connecting: 'Connecting'
    },
    status: {
      lobbyHint: 'Create or join a room first.',
      waitingOpponent: '{name} created the room. Waiting for another player.',
      roomCreated: '{name} created the room.',
      waitingReady: '{name} joined. Both players enter a letter and press Ready.',
      playerJoined: '{name} joined the room.',
      bothReady: 'Both players ready. Countdown started.',
      battleReady: 'Letters revealed. Start spelling.',
      reconnecting: 'Connection unstable. Trying to rejoin room...',
      aiSetupHint: 'Enter your letter and press "Start Round". AI will generate the other letter.',
      aiCountdownStart: 'Both sides ready. Countdown started.',
      aiRoundReset: 'Next round started. Enter your letter again.',
      playerReconnecting: '{name} disconnected. Waiting for reconnection...',
      playerRejoined: '{name} reconnected.',
      spectatorJoined: '{name} started spectating.',
      spectatorLeft: '{name} left spectating.',
      playerLocked: '{name} locked a letter.',
      playerEditing: '{name} unlocked and is editing.',
      swapPending: '{name} requested a swap vote ({progress}/{total}).',
      swapVoteCanceled: '{name} canceled a swap vote ({progress}/{total}).',
      lettersSwapped: 'Both players confirmed. Letters swapped.',
      roomLockedByHost: '{name} locked the room. New players cannot join.',
      roomUnlockedByHost: '{name} unlocked the room.',
      playerKicked: 'Host removed {name} from the room.',
      hostTransferred: 'Host permission was transferred to {name}.',
      roundTimeout: 'Time is up. Round ended in a draw.',
      roundReset: '{name} started the next round.',
      matchReset: '{name} reset the whole match.',
      opponentLeft: '{name} left the room. Round was reset.',
      successHit: '{name} scored: {word}',
      invalidLength: 'Word length must be at least 4 letters.',
      onlyLetters: 'Only English letters (A-Z) are allowed.',
      startMismatch: 'Word must start with {letter}.',
      endMismatch: 'Word must end with {letter}.',
      blockedWord: 'This word is rejected as acronym/name/proper noun.',
      nonCommonWord: 'No acceptable common meaning found in dictionary.',
      dictUnavailable: 'Dictionary API unavailable and fallback list did not match.',
      unknownInvalid: 'This word does not pass validation.',
      roomNotFound: 'Room not found. Check room code.',
      roomFull: 'Room is full. Create a new one.',
      roomLocked: 'Room is locked and cannot be joined now.',
      notHost: 'Only the host can perform this action.',
      cannotKickSelf: 'You cannot remove yourself.',
      targetNotFound: 'Target player is offline or not found.',
      kickedByHost: 'You were removed by host {hostName}.',
      invalidLetter: 'Please enter one valid English letter.',
      tooManyRequests: 'Too many actions. Please slow down and try again.'
    },
    toast: {
      createdRoom: 'Room {roomCode} created.',
      joinedRoom: 'Joined room {roomCode}.',
      copiedRoomCode: 'Room code copied.',
      copyFailed: 'Copy failed. Please copy manually.',
      readyLocked: 'You locked your letter.',
      readyUnlocked: 'You unlocked your letter.',
      swapSent: 'Swap request sent.',
      swapCanceled: 'Swap vote canceled.',
      rejoinedRoom: 'Auto rejoined room {roomCode}.',
      rejoinFailed: 'Rejoin failed. Please join the room again.',
      leaveConfirm: 'Confirm leaving the current room.',
      leftRoom: 'You left the room and returned to lobby.',
      identitySaved: 'Player tag saved.'
    },
    scorePoint: '{name} scores',
    fight: 'FIGHT'
  },
  ja: {
    title: 'ワードクラッシュ',
    subtitle: '首尾対決 · リアルタイム対戦',
    languageTag: '中',
    languageLabel: '言語',
    themeNeon: 'ネオン',
    themeCream: 'クリーム',
    player: 'プレイヤー',
    score: '得点',
    roomCode: 'ルームコード',
    createRoom: 'ルーム作成',
    joinRoom: '参加',
    spectateRoom: '観戦参加',
    aiMode: 'AI対戦',
    aiModeTitle: 'AIチャレンジ',
    aiModeDesc: 'あなたが1文字入力し、AIがもう1文字をランダム生成します。制限時間は短めです。',
    aiOpponent: 'AI相手',
    aiStartRound: 'ラウンド開始',
    aiNextRound: '次のラウンド',
    aiReset: 'AIリセット',
    aiExit: 'ロビーへ戻る',
    aiRound: 'ラウンド',
    copy: 'コピー',
    leaveHint: 'ルームコードを相手に共有してオンライン対戦できます。',
    roomInput: '6桁のルームコードを入力',
    accountLabel: 'プレイヤータグ',
    accountHint: 'ログイン不要。識別用の表示名です。',
    accountPlaceholder: '例：NightFox',
    hiddenLetter: '隠し文字',
    hiddenHint: '入力中は常に • 表示で文字は見えません',
    ready: 'Ready',
    edit: '編集',
    submit: '送信',
    swap: '先頭/末尾を交換',
    roundTimer: 'ラウンドタイマー',
    nextRound: '次のラウンド',
    resetMatch: '試合リセット',
    backToLobby: 'ロビーへ戻る',
    moreActions: 'その他',
    actionsPanel: 'ルーム操作',
    leaveConfirmTitle: 'このルームを退出しますか？',
    leaveConfirmDesc: '退出するとロビーに戻り、現在の席は解放されます。',
    leaveConfirmAction: '退出する',
    cancel: 'キャンセル',
    rulesButton: 'ルール',
    rulesTitle: '遊び方ガイド',
    rulesIntroTitle: 'はじめに',
    rulesIntro1: 'プレイヤータグを設定し、ルーム作成またはコード参加を行います。',
    rulesIntro2: '1ルームは2人対戦。その他のユーザーは観戦とチャットが可能です。',
    rulesFlowTitle: 'ラウンド進行',
    rulesFlow1: '準備: 各プレイヤーが隠し文字を1つ入力して Ready を押します。',
    rulesFlow2: '両者 Ready で 3-2-1 カウントダウン後に文字が公開されます。',
    rulesFlow3: '対戦: 中央に単語を入力し、先頭/末尾交換の投票も可能です。',
    rulesFlow4: '交換条件: 2人とも投票（2/2）したときのみ交換が成立します。',
    rulesFlow5: '有効な単語を誰かが送信すると、そのラウンドは即終了します。',
    rulesJudgeTitle: '判定ルール',
    rulesJudge1: '単語は左側の文字で始まり、右側の文字で終わる必要があります。',
    rulesJudge2: '単語長は4文字以上である必要があります。',
    rulesJudge3: 'A-Z の英字のみ。略語/人名/固有名詞は不可です。',
    rulesJudge4: '辞書照合で有効性を検証し、失敗時は理由を表示します。',
    rulesTipsTitle: 'ヒント',
    rulesTip1: 'ルーム入室後は、どのフェーズでもチャット送信できます。',
    rulesTip2: 'ホストはルームロック、相手退出、ホスト移譲を行えます。',
    rulesTip3: '短時間の切断は自動再接続され、連打はレート制限されます。',
    rulesClose: '確認しました',
    inputPlaceholder: '英単語を入力...',
    setupTitle: '準備フェーズ',
    battleTitle: '対戦フェーズ',
    showHistory: 'ログ表示',
    hideHistory: 'ログ非表示',
    startLetter: '先頭',
    endLetter: '末尾',
    historyTitle: '対戦ログ',
    waitingHistory: 'まだ記録がありません',
    historySubmitted: '解答を送信',
    chatTitle: 'ライブチャット',
    showChat: 'チャット表示',
    hideChat: 'チャット非表示',
    chatPlaceholder: 'メッセージ入力...',
    send: '送信',
    chatEmpty: 'メッセージはありません',
    systemTimeline: 'システム通知',
    showSystem: '通知表示',
    hideSystem: '通知非表示',
    emptySystem: 'システム通知はありません',
    you: 'あなた',
    opponent: '相手',
    spectator: '観戦',
    spectatorMode: '観戦モード',
    spectatorHint: '現在は観戦者です。チャットは可能ですが、Ready/交換/送信はできません。',
    spectatorCount: '観戦人数',
    hostTag: 'ホスト',
    lockedTag: 'ロック中',
    voted: '投票済み',
    selfInputOnly: '相手のみ入力可能',
    lockRoom: 'ルームをロック',
    unlockRoom: 'ロック解除',
    kickOpponent: '相手を退出',
    transferHost: 'ホスト移譲',
    confirmKick: '相手をルームから退出させますか？',
    confirmTransfer: 'ホスト権限を相手に移譲しますか？',
    hostActionConfirmTitle: 'このホスト操作を実行しますか？',
    hostActionConfirmDo: '実行する',
    connection: {
      connected: '接続済み',
      disconnected: '切断',
      connecting: '接続中'
    },
    status: {
      lobbyHint: '先にルームを作成または参加してください。',
      waitingOpponent: '{name} がルームを作成しました。参加者を待機中。',
      roomCreated: '{name} がルームを作成しました。',
      waitingReady: '{name} が参加しました。双方が文字を入力して Ready を押してください。',
      playerJoined: '{name} がルームに参加しました。',
      bothReady: '両者準備完了。カウントダウン開始。',
      battleReady: '文字公開。スペル対決開始。',
      reconnecting: '接続が不安定です。ルーム再接続を試行中...',
      aiSetupHint: 'あなたの文字を入力して「ラウンド開始」を押すと、AIの文字が生成されます。',
      aiCountdownStart: '人とAIの準備完了。カウントダウン開始。',
      aiRoundReset: '次ラウンドに進みました。もう一度文字を入力してください。',
      playerReconnecting: '{name} が切断されました。再接続待機中...',
      playerRejoined: '{name} が再接続しました。',
      spectatorJoined: '{name} が観戦を開始しました。',
      spectatorLeft: '{name} が観戦を終了しました。',
      playerLocked: '{name} が文字をロックしました。',
      playerEditing: '{name} がロック解除し再入力中です。',
      swapPending: '{name} が交換投票を開始しました（{progress}/{total}）。',
      swapVoteCanceled: '{name} が交換投票を取り消しました（{progress}/{total}）。',
      lettersSwapped: '両者が承認し、文字を交換しました。',
      roomLockedByHost: '{name} がルームをロックしました。新規参加不可。',
      roomUnlockedByHost: '{name} がルームロックを解除しました。',
      playerKicked: 'ホストが {name} をルームから退出させました。',
      hostTransferred: 'ホスト権限が {name} に移譲されました。',
      roundTimeout: '時間切れ。このラウンドは引き分け終了。',
      roundReset: '{name} が次のラウンドを開始しました。',
      matchReset: '{name} が試合全体をリセットしました。',
      opponentLeft: '{name} がルームを退出し、ラウンドはリセットされました。',
      successHit: '{name} が得点: {word}',
      invalidLength: '単語は4文字以上である必要があります。',
      onlyLetters: '英字（A-Z）のみ入力できます。',
      startMismatch: '単語は {letter} で始まる必要があります。',
      endMismatch: '単語は {letter} で終わる必要があります。',
      blockedWord: '略語/人名/固有名詞と判定されたため使用できません。',
      nonCommonWord: '辞書で有効な一般語義が見つかりませんでした。',
      dictUnavailable: '辞書APIが利用不可で、ローカル語彙にも一致しませんでした。',
      unknownInvalid: 'この単語はルールを満たしていません。',
      roomNotFound: 'ルームが見つかりません。コードを確認してください。',
      roomFull: 'ルームが満員です。新しいルームを作成してください。',
      roomLocked: 'ルームはロックされており、現在参加できません。',
      notHost: 'この操作はホストのみ可能です。',
      cannotKickSelf: '自分自身を退出させることはできません。',
      targetNotFound: '対象プレイヤーが見つからないかオフラインです。',
      kickedByHost: 'ホスト {hostName} によりルームから退出されました。',
      invalidLetter: '有効な英字1文字を入力してください。',
      tooManyRequests: '操作が多すぎます。少し待ってから再試行してください。'
    },
    toast: {
      createdRoom: 'ルーム {roomCode} を作成しました。',
      joinedRoom: 'ルーム {roomCode} に参加しました。',
      copiedRoomCode: 'ルームコードをコピーしました。',
      copyFailed: 'コピーに失敗しました。手動でコピーしてください。',
      readyLocked: '文字をロックしました。',
      readyUnlocked: '文字ロックを解除しました。',
      swapSent: '交換投票を送信しました。',
      swapCanceled: '交換投票を取り消しました。',
      rejoinedRoom: 'ルーム {roomCode} に自動再接続しました。',
      rejoinFailed: '再接続に失敗しました。再参加してください。',
      leaveConfirm: '現在のルームから退出するか確認してください。',
      leftRoom: 'ルームを退出してロビーに戻りました。',
      identitySaved: 'プレイヤータグを保存しました。'
    },
    scorePoint: '{name} が得点',
    fight: 'FIGHT'
  }
};

const LANGUAGE_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' }
];

function normalizeLanguage(value) {
  const next = String(value || '').trim().toLowerCase();
  return next === 'en' || next === 'ja' ? next : 'zh';
}

const TIME_FORMATTER_CACHE = new Map();

function formatMessageTime(ts, lang) {
  const timestamp = Number(ts);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return '--:--';
  }
  const locale = lang === 'en' ? 'en-US' : lang === 'ja' ? 'ja-JP' : 'zh-CN';
  let formatter = TIME_FORMATTER_CACHE.get(locale);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    TIME_FORMATTER_CACHE.set(locale, formatter);
  }
  return formatter.format(new Date(timestamp));
}

const STATUS_COLOR = {
  info: 'text-cyan-100 border-cyan-300/45 bg-cyan-500/10',
  success: 'text-emerald-100 border-emerald-300/50 bg-emerald-500/12',
  error: 'text-rose-100 border-rose-300/50 bg-rose-500/12'
};

function format(template, params = {}) {
  let message = template;
  Object.entries(params).forEach(([key, value]) => {
    message = message.replaceAll(`{${key}}`, String(value));
  });
  return message.replace(/\{[^}]+\}/g, '');
}

function getStatusText(status, text) {
  if (!status?.key) {
    return text.status.lobbyHint;
  }
  const template = text.status[status.key] || text.status.unknownInvalid;
  const params = {
    ...(status.params || {})
  };
  if (!params.name) {
    params.name = params.player ? `${text.player} ${params.player}` : text.opponent;
  }
  return format(template, params);
}

function createParticles(seed, amount = 18) {
  return Array.from({ length: amount }, (_, index) => {
    const angle = ((Math.PI * 2) / amount) * index;
    const radius = 52 + ((seed * 17 + index * 9) % 70);
    return {
      id: `${seed}-${index}`,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      delay: (index % 5) * 0.025
    };
  });
}

function sanitizeRoomCode(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);
}

function sanitizeIdentity(value) {
  const cleaned = String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/[^\p{L}\p{N}_\-\s]/gu, '')
    .trim()
    .slice(0, 16);
  return cleaned;
}

function defaultIdentity() {
  const token = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `Player-${token}`;
}

function createClientId() {
  const entropy = Math.random().toString(36).slice(2, 10);
  return `wc-${Date.now().toString(36)}-${entropy}`;
}

function randomEnglishLetter() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return chars[Math.floor(Math.random() * chars.length)];
}

function sanitizeSingleLetter(value) {
  return String(value || '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(-1);
}

function resolveValidationReason(reason) {
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

function getToastText(toast, text) {
  if (!toast?.key) {
    return '';
  }
  const template = text.toast?.[toast.key] || text.status?.[toast.key] || text.status.unknownInvalid;
  const params = {
    ...(toast.params || {})
  };
  if (!params.name && params.player) {
    params.name = `${text.player} ${params.player}`;
  }
  return format(template, params);
}

function MaskedLetterInput({ value, onChange, disabled, label, hint, compact = false, showHint = true }) {
  function normalizeLetter(input) {
    return String(input || '')
      .toUpperCase()
      .replace(/[^A-Z]/g, '')
      .slice(-1);
  }

  function handleKeyDown(event) {
    if (disabled) {
      return;
    }

    if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      onChange('');
      return;
    }

    if (/^[a-zA-Z]$/.test(event.key)) {
      event.preventDefault();
      onChange(event.key.toUpperCase());
      return;
    }

    if (event.key.length === 1) {
      event.preventDefault();
    }
  }

  function handleBeforeInput(event) {
    if (disabled) {
      return;
    }

    const data = String(event.data || '');
    if (!data) {
      return;
    }

    if (!/^[a-zA-Z]$/.test(data)) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    onChange(data.toUpperCase());
  }

  function handleChange(event) {
    if (disabled) {
      return;
    }

    const letter = normalizeLetter(event.target.value);
    if (letter) {
      onChange(letter);
      return;
    }

    if (!event.target.value) {
      onChange('');
    }
  }

  function handlePaste(event) {
    if (disabled) {
      return;
    }

    event.preventDefault();
    const text = event.clipboardData.getData('text') || '';
    const letter = normalizeLetter(text);
    onChange(letter);
  }

  return (
    <div className="space-y-2">
      <label className={`block font-medium text-slate-200 ${compact ? 'text-xs' : 'text-sm'}`}>{label}</label>
      <input
        type="text"
        inputMode="text"
        autoComplete="off"
        value={value ? '•' : ''}
        onChange={handleChange}
        onBeforeInput={handleBeforeInput}
        onPaste={handlePaste}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`neon-input w-full rounded-xl text-center font-bold ${
          compact
            ? 'px-3 py-2 text-xl tracking-[0.2em]'
            : 'px-4 py-3 text-2xl tracking-[0.28em]'
        }`}
        aria-label={label}
        placeholder="•"
      />
      {showHint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function PlayerMiniCard({ text, playerId, myPlayerId, occupied, ready, score, name, isHost }) {
  const isSelf = playerId === myPlayerId;
  const sideTag = myPlayerId ? (isSelf ? text.you : text.opponent) : null;
  const statusText = occupied ? (ready ? 'READY' : 'WAIT') : 'OFFLINE';

  return (
    <div className="rounded-xl border border-white/15 bg-white/6 px-3 py-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-100">
          {name}
          {sideTag && <span className="ml-1 text-[11px] text-slate-300">· {sideTag}</span>}
          {isHost && (
            <span className="ml-1 rounded-md border border-amber-300/45 bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-100">
              {text.hostTag}
            </span>
          )}
        </p>
        <p className="text-xs text-cyan-200">
          {text.score} {score}
        </p>
      </div>
      <p className={`mt-1 text-[11px] font-semibold ${ready ? 'text-emerald-200' : 'text-slate-300'}`}>
        {statusText}
      </p>
    </div>
  );
}

function PlayerPanel({
  lang,
  playerId,
  myPlayerId,
  name,
  occupied,
  ready,
  score,
  phase,
  localLetter,
  onLocalLetter,
  onReadyToggle,
  isHost
}) {
  const text = I18N[lang];
  const isSelf = playerId === myPlayerId;
  const setupLocked = phase !== 'setup';

  return (
    <motion.aside
      className="glass-card shimmer-card p-5 sm:p-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      whileHover={{ y: -2 }}
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{name}</h2>
          <p className="text-xs text-slate-300">{isSelf ? text.you : text.opponent}</p>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <span className="rounded-full border border-amber-300/45 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100">
              {text.hostTag}
            </span>
          )}
          <span className="rounded-full border border-white/20 bg-white/8 px-3 py-1 text-xs text-slate-300">
            {text.score}: <strong className="text-cyan-200">{score}</strong>
          </span>
        </div>
      </div>

      <div className="mt-3 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-300">
        {occupied ? (ready ? 'READY' : 'NOT READY') : 'OFFLINE'}
      </div>

      {isSelf ? (
        <>
          <div className="mt-4">
            <MaskedLetterInput
              value={localLetter}
              onChange={onLocalLetter}
              disabled={setupLocked || ready || !occupied}
              label={text.hiddenLetter}
              hint={text.hiddenHint}
            />
          </div>

          <button
            type="button"
            onClick={onReadyToggle}
            disabled={setupLocked || (!ready && !localLetter) || !occupied}
            className={`neo-btn mt-4 w-full rounded-xl px-4 py-3 text-sm font-semibold transition ${
              ready
                ? 'border border-emerald-300/65 bg-emerald-500/18 text-emerald-100 hover:bg-emerald-500/30'
                : 'border border-cyan-300/55 bg-cyan-500/18 text-cyan-100 hover:bg-cyan-500/30'
            } ${setupLocked || (!ready && !localLetter) || !occupied ? 'cursor-not-allowed opacity-45' : ''}`}
          >
            {ready ? text.edit : text.ready}
          </button>
        </>
      ) : (
        <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-4 text-sm text-slate-300">
          {text.selfInputOnly}
        </div>
      )}
    </motion.aside>
  );
}

export default function App() {
  const [lang, setLang] = useState(() => {
    if (typeof window === 'undefined') {
      return 'zh';
    }
    return normalizeLanguage(window.localStorage.getItem(LANG_STORAGE_KEY));
  });
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return 'neon';
    }
    const saved = String(window.localStorage.getItem(THEME_STORAGE_KEY) || '').trim();
    return saved === 'cream' ? 'cream' : 'neon';
  });
  const [socketState, setSocketState] = useState('connecting');
  const [roomState, setRoomState] = useState(EMPTY_ROOM_STATE);
  const [inAiMode, setInAiMode] = useState(false);
  const [aiState, setAiState] = useState(EMPTY_AI_STATE);
  const [aiLocalLetter, setAiLocalLetter] = useState('');
  const [aiWord, setAiWord] = useState('');
  const [aiFeedback, setAiFeedback] = useState(null);
  const [clientId] = useState(() => {
    if (typeof window === 'undefined') {
      return createClientId();
    }
    const saved = String(window.localStorage.getItem(CLIENT_ID_STORAGE_KEY) || '').trim();
    if (saved) {
      return saved;
    }
    const generated = createClientId();
    window.localStorage.setItem(CLIENT_ID_STORAGE_KEY, generated);
    return generated;
  });
  const [identity, setIdentity] = useState(() => {
    if (typeof window === 'undefined') {
      return defaultIdentity();
    }
    const saved = sanitizeIdentity(window.localStorage.getItem(IDENTITY_STORAGE_KEY) || '');
    if (saved) {
      return saved;
    }
    const fallback = defaultIdentity();
    window.localStorage.setItem(IDENTITY_STORAGE_KEY, fallback);
    return fallback;
  });
  const [roomCode, setRoomCode] = useState('');
  const [roomRole, setRoomRole] = useState(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [playerId, setPlayerId] = useState(null);
  const [localLetter, setLocalLetter] = useState('');
  const [word, setWord] = useState('');
  const [lobbyStatus, setLobbyStatus] = useState({ type: 'info', key: 'lobbyHint' });
  const [feedback, setFeedback] = useState(null);
  const [burstSeed, setBurstSeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showMobileHistory, setShowMobileHistory] = useState(false);
  const [showMobileChat, setShowMobileChat] = useState(false);
  const [showMobileSystem, setShowMobileSystem] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadSystemCount, setUnreadSystemCount] = useState(0);
  const [showCompactActions, setShowCompactActions] = useState(false);
  const [pendingHostAction, setPendingHostAction] = useState(null);
  const [scoreFlash, setScoreFlash] = useState(null);
  const [swapPulseTick, setSwapPulseTick] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const [toasts, setToasts] = useState([]);
  const [roomUiReady, setRoomUiReady] = useState(false);
  const [isPerformanceMode, setIsPerformanceMode] = useState(false);
  const [localBattleSecondsLeft, setLocalBattleSecondsLeft] = useState(null);
  const [isDesktop, setIsDesktop] = useState(
    typeof window === 'undefined' ? true : window.innerWidth >= 768
  );
  const [isCompactPhone, setIsCompactPhone] = useState(
    typeof window === 'undefined' ? false : window.innerWidth <= 375
  );
  const [swapDistance, setSwapDistance] = useState(148);

  const socketRef = useRef(null);
  const lastStatusRef = useRef('');
  const leftLetterSlotRef = useRef(null);
  const rightLetterSlotRef = useRef(null);
  const chatListRef = useRef(null);
  const previousChatCountRef = useRef(0);
  const previousSystemCountRef = useRef(0);
  const chatUnreadSeededRef = useRef(false);
  const systemUnreadSeededRef = useRef(false);
  const aiCountdownIntervalRef = useRef(null);
  const aiBattleStartTimeoutRef = useRef(null);
  const roomCodeRef = useRef('');
  const roomRoleRef = useRef(null);
  const playerIdRef = useRef(null);
  const identityRef = useRef(identity);
  const text = I18N[lang];

  const particles = useMemo(() => createParticles(burstSeed), [burstSeed]);
  const isBattleDisplayPhase = roomState.phase === 'battle' || roomState.phase === 'round_end';
  const playerNames = roomState.playerNames || EMPTY_ROOM_STATE.playerNames;
  const chatEntries = roomState.chat || EMPTY_ROOM_STATE.chat;
  const systemEntries = roomState.systemEvents || EMPTY_ROOM_STATE.systemEvents;

  function resolvePlayerName(targetPlayerId) {
    return playerNames[targetPlayerId] || `${text.player} ${targetPlayerId}`;
  }

  function pushToast(type, key, params = {}) {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((prev) => [...prev, { id, type, key, params }].slice(-4));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((item) => item.id !== id));
    }, 2200);
  }

  function clearAiSetupTimers() {
    if (aiCountdownIntervalRef.current) {
      window.clearInterval(aiCountdownIntervalRef.current);
      aiCountdownIntervalRef.current = null;
    }
    if (aiBattleStartTimeoutRef.current) {
      window.clearTimeout(aiBattleStartTimeoutRef.current);
      aiBattleStartTimeoutRef.current = null;
    }
  }

  function resetAiState(keepScore = false) {
    setAiState((prev) => ({
      ...EMPTY_AI_STATE,
      score: keepScore ? prev.score : 0,
      round: keepScore ? prev.round : 1
    }));
    setAiLocalLetter('');
    setAiWord('');
    setAiFeedback(null);
  }

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setSocketState('connected');

      const reconnectRoomCode = roomCodeRef.current;
      const reconnectRole = roomRoleRef.current;
      const reconnectPlayerId = playerIdRef.current;
      if (!reconnectRoomCode || !reconnectRole) {
        return;
      }

      const reconnectName = sanitizeIdentity(identityRef.current) || defaultIdentity();
      if (reconnectRole === 'spectator') {
        socket.emit(
          'room:join-spectator',
          {
            roomCode: reconnectRoomCode,
            name: reconnectName,
            clientId
          },
          (res) => {
            if (!res?.ok) {
              setPlayerId(null);
              setRoomCode('');
              setRoomRole(null);
              setRoomCodeInput('');
              setLocalLetter('');
              setWord('');
              setChatInput('');
              setRoomState(EMPTY_ROOM_STATE);
              setShowMobileHistory(false);
              setShowMobileChat(false);
              setShowMobileSystem(false);
              setShowCompactActions(false);
              lastStatusRef.current = '';
              setLobbyStatus({ type: 'error', key: res?.errorKey || 'roomNotFound' });
              pushToast('error', 'rejoinFailed');
              return;
            }

            setPlayerId(null);
            setRoomCode(res.roomCode);
            setRoomRole('spectator');
            setRoomCodeInput(res.roomCode);
          }
        );
        return;
      }

      if (!reconnectPlayerId) {
        return;
      }

      socket.emit(
        'room:join',
        {
          roomCode: reconnectRoomCode,
          name: reconnectName,
          clientId
        },
        (res) => {
          if (!res?.ok) {
            setPlayerId(null);
            setRoomCode('');
            setRoomRole(null);
            setRoomCodeInput('');
            setLocalLetter('');
            setWord('');
            setChatInput('');
            setRoomState(EMPTY_ROOM_STATE);
            setShowMobileHistory(false);
            setShowMobileChat(false);
            setShowMobileSystem(false);
            setShowCompactActions(false);
            lastStatusRef.current = '';
            setLobbyStatus({ type: 'error', key: res?.errorKey || 'roomNotFound' });
            pushToast('error', 'rejoinFailed');
            return;
          }

          setPlayerId(res.playerId);
          setRoomCode(res.roomCode);
          setRoomRole('player');
          setRoomCodeInput(res.roomCode);
        }
      );
    });

    socket.on('disconnect', () => {
      setSocketState('disconnected');
      if (roomCodeRef.current && roomRoleRef.current) {
        setRoomState((prev) => ({
          ...prev,
          status: { type: 'info', key: 'reconnecting' }
        }));
      }
    });

    socket.on('room:state', (nextState) => {
      setRoomState(nextState);
    });

    socket.on('room:error', (payload) => {
      const key = payload?.key || 'unknownInvalid';
      setRoomState((prev) => ({
        ...prev,
        status: {
          type: 'error',
          key,
          params: payload?.params || {}
        }
      }));
      setLobbyStatus({ type: 'error', key });
    });

    socket.on('room:kicked', (payload) => {
      const key = payload?.key || 'kickedByHost';
      const params = payload?.params || {};
      setPlayerId(null);
      setRoomCode('');
      setRoomRole(null);
      setRoomCodeInput('');
      setLocalLetter('');
      setWord('');
      setChatInput('');
      setRoomState(EMPTY_ROOM_STATE);
      setShowMobileHistory(false);
      setShowMobileChat(false);
      setShowMobileSystem(false);
      setShowCompactActions(false);
      setPendingHostAction(null);
      lastStatusRef.current = '';
      setLobbyStatus({ type: 'error', key, params });
      pushToast('error', key, params);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(IDENTITY_STORAGE_KEY, sanitizeIdentity(identity) || defaultIdentity());
  }, [identity]);

  useEffect(() => {
    return () => {
      clearAiSetupTimers();
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.body.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePerformanceMode = () => {
      const cores = Number(window.navigator?.hardwareConcurrency || 8);
      const narrowViewport = window.innerWidth <= 900;
      setIsPerformanceMode(media.matches || (narrowViewport && cores <= 4));
    };

    updatePerformanceMode();
    window.addEventListener('resize', updatePerformanceMode);
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', updatePerformanceMode);
    } else if (typeof media.addListener === 'function') {
      media.addListener(updatePerformanceMode);
    }

    return () => {
      window.removeEventListener('resize', updatePerformanceMode);
      if (typeof media.removeEventListener === 'function') {
        media.removeEventListener('change', updatePerformanceMode);
      } else if (typeof media.removeListener === 'function') {
        media.removeListener(updatePerformanceMode);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }
    document.body.setAttribute('data-performance', isPerformanceMode ? 'lite' : 'full');
  }, [isPerformanceMode]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const normalized = normalizeLanguage(lang);
    if (normalized !== lang) {
      setLang(normalized);
      return;
    }
    window.localStorage.setItem(LANG_STORAGE_KEY, normalized);
    const htmlLang = normalized === 'zh' ? 'zh-CN' : normalized === 'ja' ? 'ja-JP' : 'en-US';
    document.documentElement.setAttribute('lang', htmlLang);
  }, [lang]);

  useEffect(() => {
    roomCodeRef.current = roomCode;
  }, [roomCode]);

  useEffect(() => {
    roomRoleRef.current = roomRole;
  }, [roomRole]);

  useEffect(() => {
    playerIdRef.current = playerId;
  }, [playerId]);

  useEffect(() => {
    identityRef.current = identity;
  }, [identity]);

  useEffect(() => {
    function handleResize() {
      setIsDesktop(window.innerWidth >= 768);
      setIsCompactPhone(window.innerWidth <= 375);
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!roomCode) {
      setRoomUiReady(false);
      return undefined;
    }

    if (typeof window === 'undefined') {
      setRoomUiReady(true);
      return undefined;
    }

    setRoomUiReady(false);
    const rafId = window.requestAnimationFrame(() => {
      setRoomUiReady(true);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode || !roomUiReady) {
      return undefined;
    }

    function measureSwapDistance() {
      const left = leftLetterSlotRef.current;
      const right = rightLetterSlotRef.current;
      if (!left || !right) {
        return;
      }
      const leftRect = left.getBoundingClientRect();
      const rightRect = right.getBoundingClientRect();
      const leftCenter = leftRect.left + leftRect.width / 2;
      const rightCenter = rightRect.left + rightRect.width / 2;
      const distance = rightCenter - leftCenter;
      if (Number.isFinite(distance) && distance > 0) {
        setSwapDistance(distance);
      }
    }

    const rafId = window.requestAnimationFrame(measureSwapDistance);
    const left = leftLetterSlotRef.current;
    const right = rightLetterSlotRef.current;
    let observer = null;

    if (typeof ResizeObserver !== 'undefined' && left && right) {
      observer = new ResizeObserver(() => {
        measureSwapDistance();
      });
      observer.observe(left);
      observer.observe(right);
    }

    window.addEventListener('resize', measureSwapDistance);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', measureSwapDistance);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [isCompactPhone, isDesktop, roomCode, roomState.phase, roomUiReady, showCompactActions, showMobileHistory]);

  useEffect(() => {
    if (!roomState.status?.type) {
      return;
    }
    const statusSignature = JSON.stringify({
      type: roomState.status.type,
      key: roomState.status.key,
      params: roomState.status.params || {}
    });
    if (lastStatusRef.current !== statusSignature && (playerId || roomRole === 'spectator')) {
      pushToast(roomState.status.type, roomState.status.key, roomState.status.params || {});
      lastStatusRef.current = statusSignature;
    }

    if (roomState.status.key === 'lettersSwapped') {
      setSwapPulseTick((prev) => prev + 1);
    }

    if (roomState.status.type === 'success') {
      setFeedback('success');
      setBurstSeed((prev) => prev + 1);
      const scorer = Number(roomState.status?.params?.player);
      if (scorer === 1 || scorer === 2) {
        setScoreFlash({
          player: scorer,
          name: roomState.status?.params?.name || roomState.playerNames?.[scorer] || `${text.player} ${scorer}`
        });
      }
      if (Number(roomState.status?.params?.player) === Number(playerId)) {
        setWord('');
      }
      return;
    }
    if (roomState.status.type === 'error') {
      setFeedback('error');
    }
  }, [playerId, roomRole, roomState.playerNames, roomState.status, text.player]);

  useEffect(() => {
    if (!feedback) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setFeedback(null);
    }, 900);
    return () => clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!aiFeedback) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setAiFeedback(null);
    }, 900);
    return () => clearTimeout(timer);
  }, [aiFeedback]);

  useEffect(() => {
    if (!scoreFlash) {
      return undefined;
    }
    const timer = setTimeout(() => {
      setScoreFlash(null);
    }, 1400);
    return () => clearTimeout(timer);
  }, [scoreFlash]);

  useEffect(() => {
    if (!showLeaveConfirm && !pendingHostAction && !showRulesModal) {
      return undefined;
    }

    function onKeyDown(event) {
      if (event.key === 'Escape') {
        setShowLeaveConfirm(false);
        setPendingHostAction(null);
        setShowRulesModal(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pendingHostAction, showLeaveConfirm, showRulesModal]);

  useEffect(() => {
    if (isDesktop && showCompactActions) {
      setShowCompactActions(false);
    }
  }, [isDesktop, showCompactActions]);

  useEffect(() => {
    if (isDesktop && showMobileChat) {
      setShowMobileChat(false);
    }
  }, [isDesktop, showMobileChat]);

  useEffect(() => {
    if (isDesktop && showMobileSystem) {
      setShowMobileSystem(false);
    }
  }, [isDesktop, showMobileSystem]);

  useEffect(() => {
    if (!roomCode) {
      setUnreadChatCount(0);
      setUnreadSystemCount(0);
      previousChatCountRef.current = 0;
      previousSystemCountRef.current = 0;
      chatUnreadSeededRef.current = false;
      systemUnreadSeededRef.current = false;
      return;
    }
    setUnreadChatCount(0);
    setUnreadSystemCount(0);
    previousChatCountRef.current = chatEntries.length;
    previousSystemCountRef.current = systemEntries.length;
    chatUnreadSeededRef.current = false;
    systemUnreadSeededRef.current = false;
  }, [roomCode]);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    const previous = previousChatCountRef.current;
    const current = chatEntries.length;
    if (!chatUnreadSeededRef.current) {
      previousChatCountRef.current = current;
      chatUnreadSeededRef.current = true;
      if (isDesktop || showMobileChat) {
        setUnreadChatCount(0);
      }
      return;
    }
    const appended = Math.max(0, current - previous);

    if (isDesktop || showMobileChat) {
      setUnreadChatCount(0);
    } else if (appended > 0) {
      setUnreadChatCount((count) => Math.min(99, count + appended));
    }

    previousChatCountRef.current = current;
  }, [chatEntries.length, isDesktop, roomCode, showMobileChat]);

  useEffect(() => {
    if (!roomCode) {
      return;
    }

    const previous = previousSystemCountRef.current;
    const current = systemEntries.length;
    if (!systemUnreadSeededRef.current) {
      previousSystemCountRef.current = current;
      systemUnreadSeededRef.current = true;
      if (isDesktop || showMobileSystem) {
        setUnreadSystemCount(0);
      }
      return;
    }
    const appended = Math.max(0, current - previous);

    if (isDesktop || showMobileSystem) {
      setUnreadSystemCount(0);
    } else if (appended > 0) {
      setUnreadSystemCount((count) => Math.min(99, count + appended));
    }

    previousSystemCountRef.current = current;
  }, [isDesktop, roomCode, showMobileSystem, systemEntries.length]);

  useEffect(() => {
    const node = chatListRef.current;
    if (!node) {
      return;
    }
    node.scrollTop = node.scrollHeight;
  }, [chatEntries.length, isDesktop, showMobileChat]);

  useEffect(() => {
    if (roomState.phase !== 'battle') {
      setLocalBattleSecondsLeft(null);
      return;
    }
    const initial = Number(roomState.battleSecondsLeft);
    if (Number.isFinite(initial)) {
      setLocalBattleSecondsLeft(initial);
    }
  }, [roomState.battleSecondsLeft, roomState.phase, roomState.roundId]);

  useEffect(() => {
    if (roomState.phase !== 'battle') {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setLocalBattleSecondsLeft((prev) => {
        if (prev === null || prev <= 0) {
          return prev;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [roomState.phase, roomState.roundId]);

  useEffect(() => {
    if (!inAiMode || aiState.phase !== 'battle') {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setAiState((prev) => {
        if (prev.phase !== 'battle') {
          return prev;
        }
        const next = Math.max(0, Number(prev.battleSecondsLeft || 0) - 1);
        if (next <= 0) {
          return {
            ...prev,
            phase: 'round_end',
            battleSecondsLeft: 0,
            status: {
              type: 'info',
              key: 'roundTimeout',
              params: { seconds: prev.roundDurationSec }
            }
          };
        }
        return {
          ...prev,
          battleSecondsLeft: next
        };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [aiState.phase, aiState.round, inAiMode]);

  const inRoom = Boolean(roomCode);
  const showLobby = !inRoom && !inAiMode;
  const isSpectator = roomRole === 'spectator';
  const activeStatus = inRoom ? roomState.status : inAiMode ? aiState.status : lobbyStatus;
  const statusClass = STATUS_COLOR[activeStatus?.type] || STATUS_COLOR.info;
  const useCompactActions = !isDesktop;
  const showMobileBattleBar = Boolean(playerId && roomRole === 'player' && !isDesktop && roomState.phase === 'battle');
  const hostPlayerId = Number(roomState.hostPlayerId || 1);
  const roomLocked = Boolean(roomState.roomLocked);
  const isHost = Boolean(playerId && Number(playerId) === hostPlayerId);
  const opponentPlayerId = Number(playerId) === 1 ? 2 : 1;
  const opponentOccupied = Boolean(playerId && roomState.occupied[opponentPlayerId]);

  const myReady = playerId ? roomState.ready[playerId] : false;
  const swapVotes = roomState.swapVotes || EMPTY_ROOM_STATE.swapVotes;
  const swapProgress = Number(swapVotes[1]) + Number(swapVotes[2]);
  const mySwapVoted = Boolean(playerId && swapVotes[playerId]);
  const roundDurationSec = Number(roomState.roundDurationSec || EMPTY_ROOM_STATE.roundDurationSec || 40);
  const battleSecondsLeft = roomState.phase === 'battle'
    ? localBattleSecondsLeft
    : roomState.battleSecondsLeft === null || roomState.battleSecondsLeft === undefined
      ? null
      : Number(roomState.battleSecondsLeft);
  const timerProgress =
    battleSecondsLeft === null
      ? 0
      : Math.max(0, Math.min(1, battleSecondsLeft / Math.max(1, roundDurationSec)));
  const aiBattleSecondsLeft =
    aiState.battleSecondsLeft === null || aiState.battleSecondsLeft === undefined
      ? null
      : Number(aiState.battleSecondsLeft);
  const aiTimerProgress =
    aiBattleSecondsLeft === null
      ? 0
      : Math.max(0, Math.min(1, aiBattleSecondsLeft / Math.max(1, Number(aiState.roundDurationSec || AI_ROUND_SECONDS))));
  const overlayCountdown =
    roomState.phase === 'countdown' && roomState.countdown !== null
      ? roomState.countdown
      : inAiMode && aiState.phase === 'countdown' && aiState.countdown !== null
      ? aiState.countdown
      : null;

  function applyActionError(errorKey) {
    setRoomState((prev) => ({
      ...prev,
      status: { type: 'error', key: errorKey || 'unknownInvalid' }
    }));
  }

  function openAiMode() {
    clearAiSetupTimers();
    setInAiMode(true);
    resetAiState(false);
    setLobbyStatus({ type: 'info', key: 'aiSetupHint' });
  }

  function exitAiMode() {
    clearAiSetupTimers();
    setInAiMode(false);
    resetAiState(false);
    setLobbyStatus({ type: 'info', key: 'lobbyHint' });
  }

  function startAiRound() {
    if (!inAiMode || aiState.phase !== 'setup') {
      return;
    }

    const playerLetter = sanitizeSingleLetter(aiLocalLetter);
    if (!playerLetter) {
      setAiState((prev) => ({
        ...prev,
        status: { type: 'error', key: 'invalidLetter' }
      }));
      setAiFeedback('error');
      return;
    }

    clearAiSetupTimers();
    const botLetter = randomEnglishLetter();
    setAiWord('');
    setAiFeedback(null);
    setAiState((prev) => ({
      ...prev,
      phase: 'countdown',
      countdown: 3,
      swapped: false,
      letters: { 1: playerLetter, 2: botLetter },
      battleSecondsLeft: null,
      roundDurationSec: AI_ROUND_SECONDS,
      status: { type: 'info', key: 'aiCountdownStart' }
    }));

    let countdown = 3;
    aiCountdownIntervalRef.current = window.setInterval(() => {
      countdown -= 1;
      setAiState((prev) => {
        if (prev.phase !== 'countdown') {
          return prev;
        }
        return {
          ...prev,
          countdown
        };
      });

      if (countdown > 0) {
        return;
      }

      clearAiSetupTimers();
      aiBattleStartTimeoutRef.current = window.setTimeout(() => {
        setAiState((prev) => {
          if (prev.phase !== 'countdown') {
            return prev;
          }
          return {
            ...prev,
            phase: 'battle',
            countdown: null,
            battleSecondsLeft: AI_ROUND_SECONDS,
            status: { type: 'info', key: 'battleReady' }
          };
        });
      }, 420);
    }, 1000);
  }

  function swapAiLetters() {
    if (!inAiMode || aiState.phase !== 'battle') {
      return;
    }
    setAiState((prev) => ({
      ...prev,
      swapped: !prev.swapped,
      status: { type: 'info', key: 'lettersSwapped' }
    }));
  }

  async function submitAiWord(event) {
    event?.preventDefault?.();
    if (!inAiMode || aiState.phase !== 'battle') {
      return;
    }

    const rawWord = String(aiWord || '').trim().toLowerCase();
    const leftLetter = aiState.swapped ? aiState.letters[2] : aiState.letters[1];
    const rightLetter = aiState.swapped ? aiState.letters[1] : aiState.letters[2];

    if (rawWord.length < 4) {
      setAiFeedback('error');
      setAiState((prev) => ({
        ...prev,
        status: { type: 'error', key: 'invalidLength' }
      }));
      return;
    }

    if (!/^[a-z]+$/.test(rawWord)) {
      setAiFeedback('error');
      setAiState((prev) => ({
        ...prev,
        status: { type: 'error', key: 'onlyLetters' }
      }));
      return;
    }

    if (!rawWord.startsWith(String(leftLetter || '').toLowerCase())) {
      setAiFeedback('error');
      setAiState((prev) => ({
        ...prev,
        status: {
          type: 'error',
          key: 'startMismatch',
          params: { letter: leftLetter }
        }
      }));
      return;
    }

    if (!rawWord.endsWith(String(rightLetter || '').toLowerCase())) {
      setAiFeedback('error');
      setAiState((prev) => ({
        ...prev,
        status: {
          type: 'error',
          key: 'endMismatch',
          params: { letter: rightLetter }
        }
      }));
      return;
    }

    const roundSnapshot = aiState.round;
    const validationResult = await validateEnglishWord(rawWord);

    if (!validationResult.valid) {
      const key = resolveValidationReason(validationResult.reason);
      setAiFeedback('error');
      setAiState((prev) => {
        if (prev.phase !== 'battle' || prev.round !== roundSnapshot) {
          return prev;
        }
        return {
          ...prev,
          status: { type: 'error', key }
        };
      });
      return;
    }

    setAiFeedback('success');
    setBurstSeed((prev) => prev + 1);
    setAiWord('');
    setAiState((prev) => {
      if (prev.phase !== 'battle' || prev.round !== roundSnapshot) {
        return prev;
      }
      return {
        ...prev,
        phase: 'round_end',
        battleSecondsLeft: 0,
        score: prev.score + 1,
        status: {
          type: 'success',
          key: 'successHit',
          params: {
            name: sanitizeIdentity(identity) || text.you,
            word: rawWord.toUpperCase()
          }
        }
      };
    });
  }

  function nextAiRound() {
    if (!inAiMode) {
      return;
    }
    clearAiSetupTimers();
    setAiLocalLetter('');
    setAiWord('');
    setAiFeedback(null);
    setAiState((prev) => ({
      ...prev,
      phase: 'setup',
      countdown: null,
      swapped: false,
      letters: { 1: '', 2: '' },
      battleSecondsLeft: null,
      round: prev.round + 1,
      status: { type: 'info', key: 'aiRoundReset' }
    }));
  }

  function resetAiMatch() {
    if (!inAiMode) {
      return;
    }
    clearAiSetupTimers();
    setAiState(EMPTY_AI_STATE);
    setAiLocalLetter('');
    setAiWord('');
    setAiFeedback(null);
  }

  function createRoom() {
    const socket = socketRef.current;
    if (!socket || socketState !== 'connected') {
      setLobbyStatus({ type: 'error', key: 'opponentLeft' });
      return;
    }
    const normalizedIdentity = sanitizeIdentity(identity) || defaultIdentity();
    if (normalizedIdentity !== identity) {
      setIdentity(normalizedIdentity);
      pushToast('info', 'identitySaved');
    }

    setBusy(true);
    socket.emit(
      'room:create',
      { name: normalizedIdentity, clientId },
      (res) => {
      setBusy(false);
      if (!res?.ok) {
        setLobbyStatus({ type: 'error', key: res?.errorKey || 'unknownInvalid' });
        return;
      }

      setPlayerId(res.playerId);
      setRoomCode(res.roomCode);
      setRoomRole('player');
      setRoomCodeInput(res.roomCode);
      setLocalLetter('');
      setWord('');
      setChatInput('');
      setShowMobileHistory(false);
      setShowMobileChat(false);
      setShowMobileSystem(false);
      setLobbyStatus({ type: 'info', key: 'waitingOpponent' });
      pushToast('success', 'createdRoom', { roomCode: res.roomCode });
      }
    );
  }

  function joinRoom() {
    const socket = socketRef.current;
    if (!socket || socketState !== 'connected') {
      setLobbyStatus({ type: 'error', key: 'opponentLeft' });
      return;
    }

    const normalized = sanitizeRoomCode(roomCodeInput);
    if (normalized.length !== 6) {
      setLobbyStatus({ type: 'error', key: 'roomNotFound' });
      return;
    }
    const normalizedIdentity = sanitizeIdentity(identity) || defaultIdentity();
    if (normalizedIdentity !== identity) {
      setIdentity(normalizedIdentity);
      pushToast('info', 'identitySaved');
    }

    setBusy(true);
    socket.emit(
      'room:join',
      { roomCode: normalized, name: normalizedIdentity, clientId },
      (res) => {
        setBusy(false);
        if (!res?.ok) {
          setLobbyStatus({ type: 'error', key: res?.errorKey || 'unknownInvalid' });
          return;
        }

        setPlayerId(res.playerId);
        setRoomCode(res.roomCode);
        setRoomRole('player');
        setRoomCodeInput(res.roomCode);
        setLocalLetter('');
        setWord('');
        setChatInput('');
        setShowMobileHistory(false);
        setShowMobileChat(false);
        setShowMobileSystem(false);
        pushToast('success', 'joinedRoom', { roomCode: res.roomCode });
      }
    );
  }

  function joinAsSpectator() {
    const socket = socketRef.current;
    if (!socket || socketState !== 'connected') {
      setLobbyStatus({ type: 'error', key: 'opponentLeft' });
      return;
    }

    const normalized = sanitizeRoomCode(roomCodeInput);
    if (normalized.length !== 6) {
      setLobbyStatus({ type: 'error', key: 'roomNotFound' });
      return;
    }
    const normalizedIdentity = sanitizeIdentity(identity) || defaultIdentity();
    if (normalizedIdentity !== identity) {
      setIdentity(normalizedIdentity);
      pushToast('info', 'identitySaved');
    }

    setBusy(true);
    socket.emit(
      'room:join-spectator',
      { roomCode: normalized, name: normalizedIdentity, clientId },
      (res) => {
        setBusy(false);
        if (!res?.ok) {
          setLobbyStatus({ type: 'error', key: res?.errorKey || 'unknownInvalid' });
          return;
        }

        setPlayerId(null);
        setRoomCode(res.roomCode);
        setRoomRole('spectator');
        setRoomCodeInput(res.roomCode);
        setLocalLetter('');
        setWord('');
        setChatInput('');
        setShowMobileHistory(false);
        setShowMobileChat(false);
        setShowMobileSystem(false);
        pushToast('success', 'joinedRoom', { roomCode: res.roomCode });
      }
    );
  }

  function toggleReady() {
    const socket = socketRef.current;
    if (!socket || !playerId || roomRole !== 'player') {
      return;
    }

    if (!myReady && !localLetter) {
      setRoomState((prev) => ({
        ...prev,
        status: { type: 'error', key: 'invalidLetter' }
      }));
      return;
    }

    socket.emit('player:toggle-ready', { letter: localLetter });
    pushToast('info', myReady ? 'readyUnlocked' : 'readyLocked');
    if (myReady) {
      setLocalLetter('');
    }
  }

  function swapLetters() {
    const socket = socketRef.current;
    if (!socket || roomRole !== 'player' || roomState.phase !== 'battle') {
      return;
    }
    const cancelingVote = mySwapVoted;
    socket.emit('battle:swap');
    pushToast('info', cancelingVote ? 'swapCanceled' : 'swapSent');
  }

  function submitWord(event) {
    event?.preventDefault?.();
    const socket = socketRef.current;
    if (!socket || roomRole !== 'player' || roomState.phase !== 'battle') {
      return;
    }
    socket.emit('battle:submit', { word });
  }

  function sendChat(event) {
    event.preventDefault();
    const socket = socketRef.current;
    if (!socket || !roomCode) {
      return;
    }

    const message = chatInput.trim();
    if (!message) {
      return;
    }

    socket.emit('chat:send', { message });
    setChatInput('');
  }

  function resetRound() {
    const socket = socketRef.current;
    if (!socket || roomRole !== 'player') {
      return;
    }
    setLocalLetter('');
    setWord('');
    setChatInput('');
    setShowMobileHistory(false);
    setShowMobileChat(false);
    setShowMobileSystem(false);
    setShowCompactActions(false);
    socket.emit('round:reset');
  }

  function resetMatch() {
    const socket = socketRef.current;
    if (!socket || roomRole !== 'player') {
      return;
    }
    setLocalLetter('');
    setWord('');
    setChatInput('');
    setShowMobileHistory(false);
    setShowMobileChat(false);
    setShowMobileSystem(false);
    setShowCompactActions(false);
    socket.emit('match:reset');
  }

  function toggleRoomLock() {
    const socket = socketRef.current;
    if (!socket || !playerId || roomRole !== 'player') {
      return;
    }
    socket.emit('room:lock-toggle', (res) => {
      if (!res?.ok) {
        applyActionError(res?.errorKey);
        return;
      }
      setShowCompactActions(false);
    });
  }

  function requestHostAction(actionType) {
    setShowCompactActions(false);
    setPendingHostAction(actionType);
  }

  function transferHostToOpponent() {
    const socket = socketRef.current;
    if (!socket || !playerId || roomRole !== 'player' || !opponentOccupied) {
      return;
    }
    socket.emit('room:transfer-host', { playerId: opponentPlayerId }, (res) => {
      if (!res?.ok) {
        applyActionError(res?.errorKey);
        return;
      }
      setShowCompactActions(false);
    });
  }

  function kickOpponent() {
    const socket = socketRef.current;
    if (!socket || !playerId || roomRole !== 'player' || !opponentOccupied) {
      return;
    }
    socket.emit('room:kick', { playerId: opponentPlayerId }, (res) => {
      if (!res?.ok) {
        applyActionError(res?.errorKey);
        return;
      }
      setShowCompactActions(false);
    });
  }

  function confirmPendingHostAction() {
    if (pendingHostAction === 'kick') {
      kickOpponent();
      setPendingHostAction(null);
      return;
    }
    if (pendingHostAction === 'transfer') {
      transferHostToOpponent();
      setPendingHostAction(null);
      return;
    }
    setPendingHostAction(null);
  }

  function executeBackToLobby() {
    const socket = socketRef.current;
    const resetLocalState = () => {
      setPlayerId(null);
      setRoomCode('');
      setRoomRole(null);
      setRoomCodeInput('');
      setLocalLetter('');
      setWord('');
      setChatInput('');
      setBusy(false);
      setRoomState(EMPTY_ROOM_STATE);
      setLobbyStatus({ type: 'info', key: 'lobbyHint' });
      setShowLeaveConfirm(false);
      setShowMobileHistory(false);
      setShowMobileChat(false);
      setShowMobileSystem(false);
      setShowCompactActions(false);
      setPendingHostAction(null);
      lastStatusRef.current = '';
    };

    if (!socket) {
      resetLocalState();
      return;
    }

    socket.emit('room:leave');
    resetLocalState();
    pushToast('info', 'leftRoom');
  }

  function backToLobby() {
    setShowCompactActions(false);
    setShowLeaveConfirm(true);
    pushToast('info', 'leaveConfirm');
  }

  async function copyRoomCode() {
    if (!roomCode) {
      return;
    }
    try {
      await navigator.clipboard.writeText(roomCode);
      pushToast('success', 'copiedRoomCode');
    } catch {
      pushToast('error', 'copyFailed');
    }
  }

  return (
    <MotionConfig reducedMotion={isPerformanceMode ? 'always' : 'never'}>
      <div
        className={`game-shell theme-${theme} min-h-screen px-4 py-6 text-slate-50 sm:px-6 lg:px-8 ${
          showMobileBattleBar ? 'pb-28' : ''
        } ${isPerformanceMode ? 'perf-lite' : ''}`}
      >
      <div className="mx-auto max-w-6xl">
        <motion.header
          className="glass-card shimmer-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between"
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, ease: 'easeOut' }}
        >
          <div>
            <h1 className="headline-glow text-3xl font-black tracking-[0.12em] text-white sm:text-4xl">
              {text.title}
            </h1>
            <p className="mt-1 text-sm text-cyan-100/90">{text.subtitle}</p>
          </div>

          <div className="flex items-center gap-3">
            <span
              className={`rounded-lg border px-3 py-1 text-xs font-semibold ${
                socketState === 'connected'
                  ? 'border-emerald-300/60 bg-emerald-500/20 text-emerald-100'
                  : socketState === 'connecting'
                  ? 'border-cyan-300/50 bg-cyan-500/20 text-cyan-100'
                  : 'border-rose-300/50 bg-rose-500/20 text-rose-100'
              }`}
            >
              {text.connection[socketState]}
            </span>
            <label className="flex items-center gap-2 rounded-xl border border-cyan-200/40 bg-cyan-500/15 px-3 py-1.5 text-xs text-cyan-100">
              <span className="font-semibold">{text.languageLabel}</span>
              <select
                value={lang}
                onChange={(event) => setLang(normalizeLanguage(event.target.value))}
                className="neon-input rounded-lg px-2 py-1 text-xs font-semibold"
              >
                {LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="neo-btn rounded-xl border border-amber-300/45 bg-amber-500/18 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/30"
              onClick={() => setTheme((prev) => (prev === 'neon' ? 'cream' : 'neon'))}
            >
              {theme === 'neon' ? text.themeCream : text.themeNeon}
            </button>
          </div>
        </motion.header>

        {showLobby && (
          <motion.section
            className="glass-card shimmer-card mt-6 p-5 sm:p-6"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.38, ease: 'easeOut' }}
          >
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRulesModal(true)}
                className="neo-btn rounded-xl border border-cyan-300/55 bg-cyan-500/18 px-4 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/28"
              >
                {text.rulesButton}
              </button>
            </div>

            <div className="rounded-xl border border-cyan-300/20 bg-slate-900/35 p-4">
              <label className="mb-2 block text-sm font-semibold text-cyan-100">{text.accountLabel}</label>
              <input
                value={identity}
                onChange={(event) => setIdentity(sanitizeIdentity(event.target.value))}
                onBlur={() => {
                  const normalized = sanitizeIdentity(identity) || defaultIdentity();
                  setIdentity(normalized);
                }}
                className="neon-input w-full rounded-xl px-4 py-3 text-sm"
                placeholder={text.accountPlaceholder}
              />
              <p className="mt-2 text-xs text-slate-300">{text.accountHint}</p>
            </div>

            <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto_auto_auto]">
              <input
                value={roomCodeInput}
                onChange={(event) => setRoomCodeInput(sanitizeRoomCode(event.target.value))}
                className="neon-input rounded-xl px-4 py-3 text-sm tracking-[0.12em] sm:tracking-[0.2em]"
                placeholder={text.roomInput}
              />
              <button
                type="button"
                onClick={joinRoom}
                disabled={busy || socketState !== 'connected'}
                className="neo-btn rounded-xl border border-pink-300/60 bg-pink-500/20 px-4 py-3 text-sm font-semibold text-pink-100 transition hover:bg-pink-500/30 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {text.joinRoom}
              </button>
              <button
                type="button"
                onClick={createRoom}
                disabled={busy || socketState !== 'connected'}
                className="neo-btn rounded-xl border border-cyan-300/60 bg-cyan-500/25 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/35 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {text.createRoom}
              </button>
              <button
                type="button"
                onClick={joinAsSpectator}
                disabled={busy || socketState !== 'connected'}
                className="neo-btn rounded-xl border border-amber-300/60 bg-amber-500/20 px-4 py-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/30 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {text.spectateRoom}
              </button>
              <button
                type="button"
                onClick={openAiMode}
                className="neo-btn rounded-xl border border-emerald-300/60 bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/30"
              >
                {text.aiMode}
              </button>
            </div>
          </motion.section>
        )}

        {!inRoom && inAiMode && (
          <motion.section
            className="glass-card shimmer-card mt-6 p-5 sm:p-6"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.34, ease: 'easeOut' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-cyan-100">{text.aiModeTitle}</h2>
                <p className="mt-1 text-sm text-slate-300">{text.aiModeDesc}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg border border-cyan-300/45 bg-cyan-500/16 px-3 py-1.5 text-xs font-semibold text-cyan-100">
                  {text.score}: {aiState.score}
                </span>
                <span className="rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100">
                  {text.aiRound}: {aiState.round}
                </span>
                <button
                  type="button"
                  onClick={resetAiMatch}
                  className="neo-btn rounded-lg border border-rose-300/45 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25"
                >
                  {text.aiReset}
                </button>
                <button
                  type="button"
                  onClick={exitAiMode}
                  className="neo-btn rounded-lg border border-amber-300/55 bg-amber-500/18 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/28"
                >
                  {text.aiExit}
                </button>
              </div>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1.6fr_1fr]">
              <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                <h3 className="text-sm font-semibold tracking-wide text-slate-100">{text.you}</h3>
                <div className="mt-3">
                  <MaskedLetterInput
                    value={aiLocalLetter}
                    onChange={setAiLocalLetter}
                    disabled={aiState.phase !== 'setup'}
                    label={text.hiddenLetter}
                    hint={text.hiddenHint}
                    compact
                    showHint={false}
                  />
                </div>
                <button
                  type="button"
                  onClick={startAiRound}
                  disabled={aiState.phase !== 'setup' || !aiLocalLetter}
                  className={`neo-btn mt-3 w-full rounded-lg border border-cyan-300/60 bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/30 ${
                    aiState.phase !== 'setup' || !aiLocalLetter ? 'cursor-not-allowed opacity-45' : ''
                  }`}
                >
                  {text.aiStartRound}
                </button>
              </div>

              <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                {aiState.phase === 'battle' && aiBattleSecondsLeft !== null && (
                  <div className="mb-3 w-full">
                    <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.08em] text-cyan-100/90">
                      <span>{text.roundTimer}</span>
                      <span
                        className={
                          aiBattleSecondsLeft <= 5
                            ? 'text-rose-200 drop-shadow-[0_0_8px_rgba(251,113,133,0.65)]'
                            : ''
                        }
                      >
                        {aiBattleSecondsLeft}s
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full border border-cyan-300/35 bg-slate-900/60">
                      <motion.div
                        className={`${aiBattleSecondsLeft <= 5 ? 'bg-rose-400/90' : 'bg-cyan-300/85'} h-full rounded-full`}
                        style={{ transformOrigin: 'left center' }}
                        animate={{ scaleX: aiTimerProgress }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-[80px_minmax(0,1fr)_80px] items-start gap-2 sm:grid-cols-[100px_minmax(220px,1fr)_100px] sm:gap-3">
                  <div className="mx-auto text-center">
                    <motion.div
                      className={`letter-tile ${isDesktop ? '' : 'compact'}`}
                      animate={{ x: aiState.swapped ? 84 : 0 }}
                      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                    >
                      {aiState.phase === 'setup' ? '?' : aiState.letters[1] || '?'}
                    </motion.div>
                    <p className="mt-2 text-[10px] tracking-[0.15em] text-slate-400 sm:text-xs">{text.startLetter}</p>
                  </div>

                  <form onSubmit={submitAiWord}>
                    <motion.div
                      className="relative"
                      animate={
                        aiFeedback === 'error'
                          ? { x: [0, -9, 8, -7, 5, -3, 0] }
                          : aiFeedback === 'success'
                          ? { scale: [1, 1.02, 1] }
                          : { x: 0, scale: 1 }
                      }
                      transition={{ duration: 0.42 }}
                    >
                      <input
                        value={aiWord}
                        onChange={(event) => setAiWord(event.target.value)}
                        disabled={aiState.phase !== 'battle'}
                        className="neon-input w-full rounded-xl px-3 py-3 text-sm sm:px-4 sm:py-4 sm:text-base"
                        placeholder={text.inputPlaceholder}
                        autoCapitalize="none"
                        autoCorrect="off"
                        spellCheck={false}
                      />
                      <AnimatePresence>
                        {aiFeedback === 'success' && (
                          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                            {particles.map((particle) => (
                              <motion.span
                                key={`ai-${particle.id}`}
                                className="absolute h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.9)]"
                                initial={{ x: 0, y: 0, opacity: 1, scale: 0.9 }}
                                animate={{
                                  x: particle.x,
                                  y: particle.y,
                                  opacity: 0,
                                  scale: 0.1
                                }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.82, delay: particle.delay, ease: 'easeOut' }}
                              />
                            ))}
                          </div>
                        )}
                      </AnimatePresence>
                    </motion.div>

                    <div className="mt-3 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={swapAiLetters}
                        disabled={aiState.phase !== 'battle'}
                        className="neo-btn rounded-lg border border-pink-300/60 bg-pink-500/20 px-3 py-1.5 text-xs font-semibold text-pink-100 transition hover:bg-pink-500/30 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {text.swap}
                      </button>
                      <button
                        type="submit"
                        disabled={aiState.phase !== 'battle' || !aiWord.trim()}
                        className="neo-btn rounded-lg border border-emerald-300/60 bg-emerald-500/25 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {text.submit}
                      </button>
                    </div>
                  </form>

                  <div className="mx-auto text-center">
                    <motion.div
                      className={`letter-tile ${isDesktop ? '' : 'compact'}`}
                      animate={{ x: aiState.swapped ? -84 : 0 }}
                      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
                    >
                      {aiState.phase === 'setup' ? '?' : aiState.letters[2] || '?'}
                    </motion.div>
                    <p className="mt-2 text-[10px] tracking-[0.15em] text-slate-400 sm:text-xs">{text.endLetter}</p>
                  </div>
                </div>

                {aiState.phase === 'round_end' && (
                  <div className="mt-4 flex justify-center">
                    <button
                      type="button"
                      onClick={nextAiRound}
                      className="neo-btn rounded-lg border border-cyan-300/60 bg-cyan-500/20 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/30"
                    >
                      {text.aiNextRound}
                    </button>
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-white/15 bg-white/5 p-4">
                <h3 className="text-sm font-semibold tracking-wide text-slate-100">{text.aiOpponent}</h3>
                <p className="mt-2 text-xs text-slate-300">
                  {aiState.phase === 'setup'
                    ? text.status.aiSetupHint
                    : aiState.phase === 'battle'
                    ? text.status.battleReady
                    : text.status.aiRoundReset}
                </p>
                <div className="mt-4 rounded-lg border border-cyan-300/25 bg-cyan-500/8 px-3 py-2 text-xs text-cyan-100">
                  {text.aiModeDesc}
                </div>
              </div>
            </div>
          </motion.section>
        )}

        {inRoom && (
          <motion.section
            className="glass-card shimmer-card mt-6 p-4 sm:p-5"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, ease: 'easeOut' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="rounded-lg border border-cyan-300/35 bg-cyan-500/15 px-3 py-2 text-sm text-cyan-100">
                <div>
                  {text.roomCode}:{' '}
                  <strong className="tracking-[0.12em] sm:tracking-[0.2em]">{roomCode}</strong>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-cyan-100/90">
                  <span className="rounded-md border border-amber-300/45 bg-amber-500/16 px-1.5 py-0.5 font-semibold text-amber-100">
                    {text.hostTag}: {resolvePlayerName(hostPlayerId)}
                  </span>
                  {roomLocked && (
                    <span className="rounded-md border border-rose-300/45 bg-rose-500/16 px-1.5 py-0.5 font-semibold text-rose-100">
                      {text.lockedTag}
                    </span>
                  )}
                  <span className="rounded-md border border-cyan-300/40 bg-cyan-500/12 px-1.5 py-0.5 font-semibold text-cyan-100">
                    {text.spectatorCount}: {roomState.spectatorCount || 0}
                  </span>
                  {isSpectator && (
                    <span className="rounded-md border border-amber-300/45 bg-amber-500/16 px-1.5 py-0.5 font-semibold text-amber-100">
                      {text.spectatorMode}
                    </span>
                  )}
                </div>
              </div>
              {useCompactActions ? (
                <button
                  type="button"
                  onClick={() => setShowCompactActions((prev) => !prev)}
                  className="neo-btn rounded-lg border border-cyan-300/45 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
                >
                  {text.moreActions}
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {isHost && (
                    <>
                      <button
                        type="button"
                        onClick={toggleRoomLock}
                        className={`neo-btn rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          roomLocked
                            ? 'border-emerald-300/55 bg-emerald-500/18 text-emerald-100 hover:bg-emerald-500/28'
                            : 'border-cyan-300/55 bg-cyan-500/18 text-cyan-100 hover:bg-cyan-500/28'
                        }`}
                      >
                        {roomLocked ? text.unlockRoom : text.lockRoom}
                      </button>
                      <button
                        type="button"
                        onClick={() => requestHostAction('transfer')}
                        disabled={!opponentOccupied}
                        className="neo-btn rounded-lg border border-amber-300/55 bg-amber-500/18 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/28 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {text.transferHost}
                      </button>
                      <button
                        type="button"
                        onClick={() => requestHostAction('kick')}
                        disabled={!opponentOccupied}
                        className="neo-btn rounded-lg border border-rose-300/45 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {text.kickOpponent}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={copyRoomCode}
                    className="neo-btn rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/20"
                  >
                    {text.copy}
                  </button>
                  {roomRole === 'player' && (
                    <>
                      <button
                        type="button"
                        onClick={resetRound}
                        className="neo-btn rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/20"
                      >
                        {text.nextRound}
                      </button>
                      <button
                        type="button"
                        onClick={resetMatch}
                        className="neo-btn rounded-lg border border-rose-300/45 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25"
                      >
                        {text.resetMatch}
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={backToLobby}
                    className="neo-btn rounded-lg border border-amber-300/55 bg-amber-500/18 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/28"
                  >
                    {text.backToLobby}
                  </button>
                </div>
              )}
            </div>
            <AnimatePresence>
              {useCompactActions && showCompactActions && (
                <motion.div
                  className="mt-3 rounded-xl border border-cyan-300/35 bg-slate-900/45 p-3"
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -6, scale: 0.98 }}
                  transition={{ duration: 0.2 }}
                >
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/85">
                    {text.actionsPanel}
                  </p>
                  {roomState.phase === 'setup' && (
                    <div className="mb-2 grid gap-2">
                      <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200">
                        {text.player} 1: <strong className="text-cyan-100">{resolvePlayerName(1)}</strong>
                      </div>
                      <div className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-200">
                        {text.player} 2: <strong className="text-cyan-100">{resolvePlayerName(2)}</strong>
                      </div>
                    </div>
                  )}
                  {isHost && (
                    <div className="mb-2 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={toggleRoomLock}
                        className={`neo-btn col-span-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                          roomLocked
                            ? 'border-emerald-300/55 bg-emerald-500/18 text-emerald-100 hover:bg-emerald-500/28'
                            : 'border-cyan-300/55 bg-cyan-500/18 text-cyan-100 hover:bg-cyan-500/28'
                        }`}
                      >
                        {roomLocked ? text.unlockRoom : text.lockRoom}
                      </button>
                      <button
                        type="button"
                        onClick={() => requestHostAction('transfer')}
                        disabled={!opponentOccupied}
                        className="neo-btn rounded-lg border border-amber-300/55 bg-amber-500/18 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/28 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {text.transferHost}
                      </button>
                      <button
                        type="button"
                        onClick={() => requestHostAction('kick')}
                        disabled={!opponentOccupied}
                        className="neo-btn rounded-lg border border-rose-300/45 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-45"
                      >
                        {text.kickOpponent}
                      </button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={copyRoomCode}
                      className="neo-btn rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/20"
                    >
                      {text.copy}
                    </button>
                    {roomRole === 'player' && (
                      <>
                        <button
                          type="button"
                          onClick={resetRound}
                          className="neo-btn rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-100 transition hover:bg-white/20"
                        >
                          {text.nextRound}
                        </button>
                        <button
                          type="button"
                          onClick={resetMatch}
                          className="neo-btn rounded-lg border border-rose-300/45 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/25"
                        >
                          {text.resetMatch}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={backToLobby}
                      className={`neo-btn rounded-lg border border-amber-300/55 bg-amber-500/18 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-500/28 ${
                        roomRole === 'player' ? 'col-span-2' : ''
                      }`}
                    >
                      {text.backToLobby}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            <p className="mt-2 text-xs text-slate-300">{text.leaveHint}</p>
          </motion.section>
        )}

        <motion.div
          className={`status-bar mt-4 rounded-xl border px-4 py-3 text-sm ${statusClass}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {getStatusText(activeStatus, text)}
        </motion.div>

        {inRoom && !roomUiReady && (
          <div className="mt-6 rounded-2xl border border-white/12 bg-white/5 p-6">
            <div className="h-4 w-40 rounded bg-cyan-300/20" />
            <div className="mt-4 h-28 rounded-xl bg-slate-900/40" />
            <div className="mt-3 h-10 rounded-xl bg-slate-900/35" />
          </div>
        )}

        {inRoom && roomUiReady && (
          <motion.div
            className="mt-6 grid gap-4 xl:grid-cols-[1fr_1.6fr_1fr]"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <div className="hidden xl:block space-y-4">
              {roomRole === 'player' && (
                <PlayerPanel
                  lang={lang}
                  playerId={1}
                  myPlayerId={playerId}
                  name={resolvePlayerName(1)}
                  isHost={hostPlayerId === 1}
                  occupied={roomState.occupied[1]}
                  ready={roomState.ready[1]}
                  score={roomState.scores[1]}
                  phase={roomState.phase}
                  localLetter={playerId === 1 ? localLetter : ''}
                  onLocalLetter={setLocalLetter}
                  onReadyToggle={toggleReady}
                />
              )}
              <div className="glass-card shimmer-card p-4">
                <h3 className="text-sm font-semibold tracking-wide text-slate-200">{text.historyTitle}</h3>
                <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
                  {roomState.history.length === 0 && (
                    <p className="text-sm text-slate-400">{text.waitingHistory}</p>
                  )}
                  {roomState.history.map((entry) => (
                    <div
                      key={entry.id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        entry.success
                          ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100'
                          : 'border-rose-300/35 bg-rose-500/10 text-rose-100'
                      }`}
                    >
                      {(entry.playerName || resolvePlayerName(entry.player))} · {text.historySubmitted}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <section className="glass-card shimmer-card relative overflow-visible p-5 sm:p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">
                  {isBattleDisplayPhase ? text.battleTitle : text.setupTitle}
                </h2>
                {roomState.phase === 'battle' && battleSecondsLeft !== null && (
                  <div className="mt-2 w-[min(100%,360px)]">
                    <div className="flex items-center justify-between text-[11px] font-semibold tracking-[0.08em] text-cyan-100/90">
                      <span>{text.roundTimer}</span>
                      <span
                        className={
                          battleSecondsLeft <= 5 ? 'text-rose-200 drop-shadow-[0_0_8px_rgba(251,113,133,0.65)]' : ''
                        }
                      >
                        {battleSecondsLeft}s
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full border border-cyan-300/35 bg-slate-900/60">
                      <motion.div
                        className={`h-full rounded-full ${
                          battleSecondsLeft <= 5 ? 'bg-rose-400/90' : 'bg-cyan-300/85'
                        }`}
                        style={{ transformOrigin: 'left center' }}
                        animate={{ scaleX: timerProgress }}
                        transition={{ duration: 0.28, ease: 'easeOut' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {isSpectator && (
              <div className="mb-3 rounded-xl border border-amber-300/35 bg-amber-500/12 px-3 py-2 text-xs text-amber-100">
                {text.spectatorHint}
              </div>
            )}
            <div className="mb-4 mt-4 xl:hidden">
              <div className="grid grid-cols-2 gap-2">
                <PlayerMiniCard
                  text={text}
                  playerId={1}
                  myPlayerId={playerId}
                  name={resolvePlayerName(1)}
                  isHost={hostPlayerId === 1}
                  occupied={roomState.occupied[1]}
                  ready={roomState.ready[1]}
                  score={roomState.scores[1]}
                />
                <PlayerMiniCard
                  text={text}
                  playerId={2}
                  myPlayerId={playerId}
                  name={resolvePlayerName(2)}
                  isHost={hostPlayerId === 2}
                  occupied={roomState.occupied[2]}
                  ready={roomState.ready[2]}
                  score={roomState.scores[2]}
                />
              </div>

              {roomState.phase === 'setup' && roomRole === 'player' && (
                <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3">
                  <div className="flex items-end gap-2">
                    <div className="min-w-0 flex-1">
                      <MaskedLetterInput
                        value={localLetter}
                        onChange={setLocalLetter}
                        disabled={!roomState.occupied[playerId] || myReady}
                        label={text.hiddenLetter}
                        hint={text.hiddenHint}
                        compact
                        showHint={false}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={toggleReady}
                      disabled={!roomState.occupied[playerId] || (!myReady && !localLetter)}
                      className={`neo-btn rounded-lg px-3 py-2 text-xs font-semibold ${
                        myReady
                          ? 'border border-emerald-300/65 bg-emerald-500/20 text-emerald-100'
                          : 'border border-cyan-300/60 bg-cyan-500/20 text-cyan-100'
                      } ${
                        !roomState.occupied[playerId] || (!myReady && !localLetter)
                          ? 'cursor-not-allowed opacity-45'
                          : ''
                      }`}
                    >
                      {myReady ? text.edit : text.ready}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div
              className="relative mt-5 grid grid-cols-[80px_minmax(0,1fr)_80px] items-start gap-2 sm:gap-3 md:grid-cols-[112px_minmax(260px,1fr)_112px]"
              style={{ perspective: 1400 }}
            >
              <div
                ref={leftLetterSlotRef}
                className="relative mx-auto h-28 w-20 md:h-36 md:w-28"
              >
                <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2">
                  <motion.div
                    className={`letter-tile ${isDesktop ? '' : 'compact'}`}
                    animate={{
                      x: roomState.swapped ? swapDistance : 0,
                      rotateY: 0
                    }}
                    transition={{
                      x: { type: 'spring', stiffness: 220, damping: 18 },
                      rotateY: { duration: 0.42 }
                    }}
                  >
                    {roomState.letters[1] || '?'}
                  </motion.div>
                </div>
                <div className="absolute bottom-0 left-0 w-20 text-center text-[10px] tracking-[0.15em] text-slate-400 md:w-28 md:text-xs md:tracking-[0.2em]">
                  {text.startLetter}
                </div>
              </div>

              <div className="relative w-full">
                <form onSubmit={submitWord} className="relative">
                  <motion.div
                    className="relative"
                    animate={
                      feedback === 'error'
                        ? { x: [0, -10, 9, -8, 6, -4, 2, 0] }
                        : feedback === 'success'
                        ? { scale: [1, 1.02, 1] }
                        : { x: 0, scale: 1 }
                    }
                    transition={{ duration: 0.45 }}
                  >
                    <input
                      value={word}
                      onChange={(event) => setWord(event.target.value)}
                      disabled={roomState.phase !== 'battle' || roomRole !== 'player'}
                      className="neon-input w-full rounded-2xl px-3 py-3 text-sm tracking-wide sm:px-4 sm:py-4 sm:text-base"
                      placeholder={text.inputPlaceholder}
                      autoCapitalize="none"
                      autoCorrect="off"
                      spellCheck={false}
                    />

                    <AnimatePresence>
                      {feedback === 'success' && (
                        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
                          {particles.map((particle) => (
                            <motion.span
                              key={particle.id}
                              className="absolute h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.9)]"
                              initial={{ x: 0, y: 0, opacity: 1, scale: 0.9 }}
                              animate={{
                                x: particle.x,
                                y: particle.y,
                                opacity: 0,
                                scale: 0.1
                              }}
                              exit={{ opacity: 0 }}
                              transition={{ duration: 0.82, delay: particle.delay, ease: 'easeOut' }}
                            />
                          ))}
                        </div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                  <div className={`mt-3 justify-center gap-2 ${isDesktop && roomRole === 'player' ? 'flex' : 'hidden'}`}>
                    <motion.button
                      key={`swap-pulse-${swapPulseTick}`}
                      initial={
                        swapPulseTick === 0
                          ? false
                          : {
                              scale: 1,
                              boxShadow: '0 0 0 rgba(236, 72, 153, 0)'
                            }
                      }
                      animate={
                        swapPulseTick === 0
                          ? undefined
                          : {
                              scale: [1, 1.08, 1],
                              boxShadow: [
                                '0 0 0 rgba(236, 72, 153, 0)',
                                '0 0 28px rgba(236, 72, 153, 0.75)',
                                '0 0 0 rgba(236, 72, 153, 0)'
                              ]
                            }
                      }
                      transition={{ duration: 0.45, ease: 'easeOut' }}
                      type="button"
                      onClick={swapLetters}
                      disabled={roomState.phase !== 'battle'}
                      className={`neo-btn inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition sm:gap-2 sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm disabled:cursor-not-allowed disabled:opacity-45 ${
                        mySwapVoted
                          ? 'border border-amber-300/70 bg-amber-500/22 text-amber-100 hover:bg-amber-500/30'
                          : 'border border-pink-300/60 bg-pink-500/20 text-pink-100 hover:bg-pink-500/30'
                      }`}
                    >
                      <motion.span
                        animate={{ rotate: roomState.swapped ? 180 : 0 }}
                        transition={{ duration: 0.35 }}
                      >
                        ⇄
                      </motion.span>
                      <span>{text.swap}</span>
                      {mySwapVoted && (
                        <span className="rounded-md border border-amber-200/45 bg-amber-500/18 px-1 py-0.5 text-[10px] leading-none text-amber-100 sm:px-1.5 sm:text-[11px]">
                          {text.voted}
                        </span>
                      )}
                      <span
                        className={`rounded-md px-1 py-0.5 text-[10px] leading-none sm:px-1.5 sm:text-[11px] ${
                          mySwapVoted
                            ? 'border border-amber-200/45 bg-amber-500/18 text-amber-100'
                            : 'border border-pink-200/45 bg-pink-500/15 text-pink-100'
                        }`}
                      >
                        {swapProgress}/2
                      </span>
                    </motion.button>
                    <button
                      type="submit"
                      disabled={roomState.phase !== 'battle' || !word.trim()}
                      className="neo-btn rounded-xl border border-emerald-300/60 bg-emerald-500/25 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {text.submit}
                    </button>
                  </div>
                </form>
              </div>

              <div
                ref={rightLetterSlotRef}
                className="relative mx-auto h-28 w-20 md:h-36 md:w-28"
              >
                <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2">
                  <motion.div
                    className={`letter-tile ${isDesktop ? '' : 'compact'}`}
                    animate={{
                      x: roomState.swapped ? -swapDistance : 0,
                      rotateY: 0
                    }}
                    transition={{
                      x: { type: 'spring', stiffness: 220, damping: 18 },
                      rotateY: { duration: 0.42 }
                    }}
                  >
                    {roomState.letters[2] || '?'}
                  </motion.div>
                </div>
                <div className="absolute bottom-0 left-0 w-20 text-center text-[10px] tracking-[0.15em] text-slate-400 md:w-28 md:text-xs md:tracking-[0.2em]">
                  {text.endLetter}
                </div>
              </div>
            </div>

            <div className="mt-6 xl:hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-wide text-slate-200">{text.historyTitle}</h3>
                <button
                  type="button"
                  onClick={() => setShowMobileHistory((prev) => !prev)}
                  className="neo-btn rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-100 xl:hidden"
                >
                  {showMobileHistory ? text.hideHistory : text.showHistory}
                </button>
              </div>

              {(isDesktop || showMobileHistory) && (
                <div className="mt-3 max-h-32 space-y-2 overflow-auto pr-1 sm:max-h-44">
                  {roomState.history.length === 0 && (
                    <p className="text-sm text-slate-400">{text.waitingHistory}</p>
                  )}
                  {roomState.history.map((entry) => (
                    <div
                      key={entry.id}
                      className={`rounded-lg border px-3 py-2 text-sm ${
                        entry.success
                          ? 'border-emerald-300/35 bg-emerald-500/10 text-emerald-100'
                          : 'border-rose-300/35 bg-rose-500/10 text-rose-100'
                      }`}
                    >
                      {(entry.playerName || resolvePlayerName(entry.player))} · {text.historySubmitted}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-wide text-slate-200">{text.chatTitle}</h3>
                <button
                  type="button"
                  onClick={() => setShowMobileChat((prev) => !prev)}
                  className="neo-btn rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-100 xl:hidden"
                >
                  <span>{showMobileChat ? text.hideChat : text.showChat}</span>
                  {!showMobileChat && unreadChatCount > 0 && (
                    <span className="ml-1.5 rounded-full border border-cyan-200/45 bg-cyan-500/20 px-1.5 py-0.5 text-[10px] leading-none text-cyan-100">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                </button>
              </div>

              {(isDesktop || showMobileChat) && (
                <div className="mt-3 rounded-xl border border-white/15 bg-white/5 p-3">
                  <div ref={chatListRef} className="max-h-36 space-y-2 overflow-auto pr-1 sm:max-h-44">
                    {chatEntries.length === 0 && (
                      <p className="text-sm text-slate-400">{text.chatEmpty}</p>
                    )}
                    {chatEntries.map((entry) => {
                      const mine = String(entry.clientId || '') === String(clientId || '');
                      return (
                        <div key={entry.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                          <div
                            className={`max-w-[85%] rounded-xl border px-3 py-2 text-sm ${
                              mine
                                ? 'border-cyan-300/45 bg-cyan-500/12 text-cyan-100'
                                : 'border-white/20 bg-slate-900/45 text-slate-100'
                            }`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-2 text-[11px] font-semibold opacity-90">
                              <span className="truncate">
                                {entry.playerName || resolvePlayerName(entry.player)}
                                {entry.role === 'spectator' ? ` · ${text.spectator}` : ''}
                              </span>
                              <span className="shrink-0 text-[10px] font-medium opacity-70">
                                {formatMessageTime(entry.ts, lang)}
                              </span>
                            </div>
                            <p className="break-words leading-relaxed">{entry.text}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <form onSubmit={sendChat} className="mt-3 flex items-center gap-2">
                    <input
                      value={chatInput}
                      onChange={(event) => setChatInput(event.target.value)}
                      disabled={socketState !== 'connected' || !inRoom}
                      className="neon-input min-w-0 flex-1 rounded-lg px-3 py-2 text-sm"
                      placeholder={text.chatPlaceholder}
                      maxLength={200}
                    />
                    <button
                      type="submit"
                      disabled={socketState !== 'connected' || !inRoom || !chatInput.trim()}
                      className="neo-btn rounded-lg border border-cyan-300/55 bg-cyan-500/20 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/28 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {text.send}
                    </button>
                  </form>
                </div>
              )}
            </div>

            <div className="mt-6 xl:hidden">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold tracking-wide text-slate-200">{text.systemTimeline}</h3>
                <button
                  type="button"
                  onClick={() => setShowMobileSystem((prev) => !prev)}
                  className="neo-btn rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-100 xl:hidden"
                >
                  <span>{showMobileSystem ? text.hideSystem : text.showSystem}</span>
                  {!showMobileSystem && unreadSystemCount > 0 && (
                    <span className="ml-1.5 rounded-full border border-amber-200/45 bg-amber-500/18 px-1.5 py-0.5 text-[10px] leading-none text-amber-100">
                      {unreadSystemCount > 99 ? '99+' : unreadSystemCount}
                    </span>
                  )}
                </button>
              </div>

              {(isDesktop || showMobileSystem) && (
                <div className="mt-3 max-h-28 space-y-2 overflow-auto pr-1 sm:max-h-36">
                  {systemEntries.length === 0 && (
                    <p className="text-sm text-slate-400">{text.emptySystem}</p>
                  )}
                  {systemEntries.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-cyan-300/20 bg-cyan-500/8 px-3 py-2 text-xs text-cyan-100/90">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-100/75">
                        {formatMessageTime(entry.ts, lang)}
                      </div>
                      <div>{getStatusText({ key: entry.key, params: entry.params || {} }, text)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </section>

            <div className="hidden xl:block space-y-4">
              {roomRole === 'player' && (
                <PlayerPanel
                  lang={lang}
                  playerId={2}
                  myPlayerId={playerId}
                  name={resolvePlayerName(2)}
                  isHost={hostPlayerId === 2}
                  occupied={roomState.occupied[2]}
                  ready={roomState.ready[2]}
                  score={roomState.scores[2]}
                  phase={roomState.phase}
                  localLetter={playerId === 2 ? localLetter : ''}
                  onLocalLetter={setLocalLetter}
                  onReadyToggle={toggleReady}
                />
              )}
              <div className="glass-card shimmer-card p-4">
                <h3 className="text-sm font-semibold tracking-wide text-slate-200">{text.systemTimeline}</h3>
                <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
                  {systemEntries.length === 0 && (
                    <p className="text-sm text-slate-400">{text.emptySystem}</p>
                  )}
                  {systemEntries.map((entry) => (
                    <div key={entry.id} className="rounded-lg border border-cyan-300/20 bg-cyan-500/8 px-3 py-2 text-xs text-cyan-100/90">
                      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-cyan-100/75">
                        {formatMessageTime(entry.ts, lang)}
                      </div>
                      <div>{getStatusText({ key: entry.key, params: entry.params || {} }, text)}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {showMobileBattleBar && (
          <motion.div
            className="fixed inset-x-0 bottom-0 z-[66] px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] sm:hidden"
            initial={{ opacity: 0, y: 26 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 22 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="glass-card shimmer-card mx-auto flex w-full max-w-3xl items-center gap-2 rounded-2xl border border-cyan-300/35 bg-slate-950/72 p-2 shadow-[0_-12px_32px_rgba(2,6,23,0.55)] backdrop-blur-xl">
              <button
                type="button"
                onClick={swapLetters}
                disabled={roomState.phase !== 'battle'}
                className={`neo-btn inline-flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl px-2.5 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                  mySwapVoted
                    ? 'border border-amber-300/70 bg-amber-500/22 text-amber-100 hover:bg-amber-500/30'
                    : 'border border-pink-300/60 bg-pink-500/20 text-pink-100 hover:bg-pink-500/30'
                }`}
              >
                <motion.span
                  animate={{ rotate: roomState.swapped ? 180 : 0 }}
                  transition={{ duration: 0.35 }}
                >
                  ⇄
                </motion.span>
                <span>{text.swap}</span>
                <span
                  className={`rounded-md px-1 py-0.5 text-[10px] leading-none ${
                    mySwapVoted
                      ? 'border border-amber-200/45 bg-amber-500/18 text-amber-100'
                      : 'border border-pink-200/45 bg-pink-500/15 text-pink-100'
                  }`}
                >
                  {swapProgress}/2
                </span>
              </button>

              <button
                type="button"
                onClick={submitWord}
                disabled={roomState.phase !== 'battle' || !word.trim()}
                className="neo-btn min-w-[88px] rounded-xl border border-emerald-300/60 bg-emerald-500/25 px-3 py-2 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/35 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {text.submit}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {scoreFlash && (
          <motion.div
            className="pointer-events-none fixed left-1/2 top-24 z-[60] -translate-x-1/2"
            initial={{ opacity: 0, y: -18, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          >
            <div className="rounded-xl border border-emerald-300/65 bg-emerald-500/20 px-5 py-2 text-base font-black tracking-[0.16em] text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.35)]">
              {format(text.scorePoint, {
                player: scoreFlash.player,
                name: scoreFlash.name || `${text.player} ${scoreFlash.player}`
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed right-3 top-20 z-[68] flex w-[min(92vw,360px)] flex-col gap-2 sm:right-5">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 28, scale: 0.94 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 24, scale: 0.95 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className={`pointer-events-auto rounded-xl border px-3 py-2 text-sm shadow-[0_8px_26px_rgba(8,15,35,0.4)] backdrop-blur-md ${
                toast.type === 'success'
                  ? 'border-emerald-300/55 bg-emerald-500/18 text-emerald-100'
                  : toast.type === 'error'
                  ? 'border-rose-300/55 bg-rose-500/20 text-rose-100'
                  : 'border-cyan-300/45 bg-cyan-500/16 text-cyan-100'
              }`}
            >
              {getToastText(toast, text)}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showRulesModal && (
          <motion.div
            className="fixed inset-0 z-[69] flex items-center justify-center px-4 py-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              type="button"
              className="absolute inset-0 bg-slate-950/72 backdrop-blur-[2px]"
              onClick={() => setShowRulesModal(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="glass-card shimmer-card relative z-10 w-full max-w-2xl border border-cyan-200/35 p-5 sm:p-6"
              initial={{ opacity: 0, scale: 0.92, y: 22 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <h3 className="text-lg font-bold tracking-wide text-cyan-100 sm:text-xl">{text.rulesTitle}</h3>
              <div className="mt-4 max-h-[min(72vh,540px)] space-y-4 overflow-auto pr-1 text-sm text-slate-100/95">
                <section className="rounded-xl border border-cyan-300/20 bg-cyan-500/8 p-3">
                  <h4 className="text-sm font-semibold text-cyan-100">{text.rulesIntroTitle}</h4>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-200/95 sm:text-sm">
                    <li>1. {text.rulesIntro1}</li>
                    <li>2. {text.rulesIntro2}</li>
                  </ul>
                </section>

                <section className="rounded-xl border border-cyan-300/20 bg-cyan-500/8 p-3">
                  <h4 className="text-sm font-semibold text-cyan-100">{text.rulesFlowTitle}</h4>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-200/95 sm:text-sm">
                    <li>1. {text.rulesFlow1}</li>
                    <li>2. {text.rulesFlow2}</li>
                    <li>3. {text.rulesFlow3}</li>
                    <li>4. {text.rulesFlow4}</li>
                    <li>5. {text.rulesFlow5}</li>
                  </ul>
                </section>

                <section className="rounded-xl border border-cyan-300/20 bg-cyan-500/8 p-3">
                  <h4 className="text-sm font-semibold text-cyan-100">{text.rulesJudgeTitle}</h4>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-200/95 sm:text-sm">
                    <li>1. {text.rulesJudge1}</li>
                    <li>2. {text.rulesJudge2}</li>
                    <li>3. {text.rulesJudge3}</li>
                    <li>4. {text.rulesJudge4}</li>
                  </ul>
                </section>

                <section className="rounded-xl border border-cyan-300/20 bg-cyan-500/8 p-3">
                  <h4 className="text-sm font-semibold text-cyan-100">{text.rulesTipsTitle}</h4>
                  <ul className="mt-2 space-y-1.5 text-xs leading-relaxed text-slate-200/95 sm:text-sm">
                    <li>1. {text.rulesTip1}</li>
                    <li>2. {text.rulesTip2}</li>
                    <li>3. {text.rulesTip3}</li>
                  </ul>
                </section>
              </div>

              <div className="mt-5 flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => setShowRulesModal(false)}
                  className="neo-btn rounded-lg border border-cyan-300/60 bg-cyan-500/25 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/35"
                >
                  {text.rulesClose}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLeaveConfirm && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              type="button"
              className="absolute inset-0 bg-slate-950/72 backdrop-blur-[2px]"
              onClick={() => setShowLeaveConfirm(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className="glass-card shimmer-card relative z-10 w-full max-w-md border border-amber-200/35 p-5 sm:p-6"
              initial={{ opacity: 0, scale: 0.92, y: 26 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
            >
              <h3 className="text-lg font-bold tracking-wide text-amber-100">{text.leaveConfirmTitle}</h3>
              <p className="mt-2 text-sm text-slate-200/90">{text.leaveConfirmDesc}</p>
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowLeaveConfirm(false)}
                  className="neo-btn rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20"
                >
                  {text.cancel}
                </button>
                <button
                  type="button"
                  onClick={executeBackToLobby}
                  className="neo-btn rounded-lg border border-amber-300/60 bg-amber-500/25 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/35"
                >
                  {text.leaveConfirmAction}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {pendingHostAction && (
          <motion.div
            className="fixed inset-0 z-[71] flex items-center justify-center px-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.button
              type="button"
              className="absolute inset-0 bg-slate-950/72 backdrop-blur-[2px]"
              onClick={() => setPendingHostAction(null)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            />
            <motion.div
              className={`glass-card shimmer-card relative z-10 w-full max-w-md p-5 sm:p-6 ${
                pendingHostAction === 'kick'
                  ? 'border border-rose-200/35'
                  : 'border border-amber-200/35'
              }`}
              initial={{ opacity: 0, scale: 0.92, y: 26 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.24, ease: 'easeOut' }}
            >
              <h3
                className={`text-lg font-bold tracking-wide ${
                  pendingHostAction === 'kick' ? 'text-rose-100' : 'text-amber-100'
                }`}
              >
                {text.hostActionConfirmTitle}
              </h3>
              <p className="mt-2 text-sm text-slate-200/90">
                {pendingHostAction === 'kick' ? text.confirmKick : text.confirmTransfer}
              </p>
              <div className="mt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setPendingHostAction(null)}
                  className="neo-btn rounded-lg border border-white/25 bg-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-white/20"
                >
                  {text.cancel}
                </button>
                <button
                  type="button"
                  onClick={confirmPendingHostAction}
                  className={`neo-btn rounded-lg px-4 py-2 text-sm font-semibold transition ${
                    pendingHostAction === 'kick'
                      ? 'border border-rose-300/60 bg-rose-500/24 text-rose-100 hover:bg-rose-500/35'
                      : 'border border-amber-300/60 bg-amber-500/24 text-amber-100 hover:bg-amber-500/35'
                  }`}
                >
                  {text.hostActionConfirmDo}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {overlayCountdown !== null && (
          <motion.div
            className="countdown-overlay fixed inset-0 z-50 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <AnimatePresence mode="wait">
              {overlayCountdown > 0 ? (
                <motion.div
                  key={overlayCountdown}
                  className="countdown-number"
                  initial={{ scale: 0.25, opacity: 0 }}
                  animate={{ scale: 1.15, opacity: 1 }}
                  exit={{ scale: 1.9, opacity: 0 }}
                  transition={{ duration: 0.7, ease: 'easeInOut' }}
                >
                  {overlayCountdown}
                </motion.div>
              ) : (
                <motion.div
                  key="fight"
                  className="countdown-fight"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1.15, opacity: 1 }}
                  exit={{ scale: 1.45, opacity: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  {text.fight}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="ambient-orb orb-a" />
        <div className="ambient-orb orb-b" />
        <div className="ambient-orb orb-c" />
      </div>
      </div>
    </MotionConfig>
  );
}
