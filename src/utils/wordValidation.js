const BLOCKED_WORDS = new Set([
  'nasa',
  'fbi',
  'cia',
  'usa',
  'uk',
  'eu',
  'jack',
  'john',
  'mary',
  'linda',
  'michael',
  'david',
  'james',
  'emma',
  'olivia',
  'liam',
  'noah',
  'sophia',
  'isabella'
]);

const BLOCKED_PARTS_OF_SPEECH = new Set([
  'proper noun',
  'abbreviation',
  'acronym',
  'initialism',
  'name'
]);

const BLOCKED_DEFINITION_PATTERNS = [
  /abbreviation/i,
  /acronym/i,
  /initialism/i,
  /proper noun/i,
  /surname/i,
  /given name/i,
  /a male given name/i,
  /a female given name/i
];

const TRUE_VALUES = new Set(['1', 'true', 'yes', 'on']);
const OFFLINE_RELAXED_FLAG = String(import.meta.env.VITE_ALLOW_OFFLINE_RELAXED || '')
  .trim()
  .toLowerCase();
const ALLOW_OFFLINE_RELAXED = OFFLINE_RELAXED_FLAG ? TRUE_VALUES.has(OFFLINE_RELAXED_FLAG) : true;
const OFFLINE_VOWEL_PATTERN = /[aeiouy]/;
const FOUR_REPEAT_PATTERN = /(.)\1\1\1/;

const FALLBACK_WORDS = new Set([
  'about',
  'above',
  'abuse',
  'actor',
  'adapt',
  'admit',
  'adopt',
  'adult',
  'after',
  'again',
  'agent',
  'agree',
  'ahead',
  'alarm',
  'album',
  'alert',
  'alien',
  'alive',
  'allow',
  'alone',
  'along',
  'alter',
  'angel',
  'anger',
  'angle',
  'angry',
  'apart',
  'apple',
  'apply',
  'arena',
  'argue',
  'arise',
  'array',
  'aside',
  'asset',
  'audio',
  'avail',
  'award',
  'aware',
  'baker',
  'basic',
  'beach',
  'beard',
  'begin',
  'below',
  'bench',
  'birth',
  'black',
  'blade',
  'blame',
  'blind',
  'block',
  'blood',
  'board',
  'boost',
  'brain',
  'brand',
  'brave',
  'bread',
  'break',
  'brick',
  'bring',
  'broad',
  'brown',
  'build',
  'buyer',
  'cable',
  'carry',
  'catch',
  'cause',
  'chain',
  'chair',
  'chase',
  'cheap',
  'check',
  'chest',
  'chief',
  'child',
  'civil',
  'claim',
  'class',
  'clean',
  'clear',
  'clerk',
  'click',
  'climb',
  'clock',
  'close',
  'cloud',
  'coach',
  'coast',
  'color',
  'could',
  'count',
  'court',
  'cover',
  'craft',
  'crash',
  'crazy',
  'cream',
  'crime',
  'cross',
  'crowd',
  'crown',
  'curve',
  'cycle',
  'daily',
  'dance',
  'dated',
  'debut',
  'delay',
  'depth',
  'devil',
  'dirty',
  'doubt',
  'dozen',
  'draft',
  'drama',
  'dream',
  'dress',
  'drill',
  'drink',
  'drive',
  'eager',
  'early',
  'earth',
  'eight',
  'elite',
  'empty',
  'enemy',
  'enjoy',
  'enter',
  'entry',
  'equal',
  'error',
  'event',
  'every',
  'exact',
  'exist',
  'extra',
  'faith',
  'false',
  'fault',
  'favor',
  'field',
  'fight',
  'final',
  'first',
  'flash',
  'fleet',
  'floor',
  'focus',
  'force',
  'frame',
  'fresh',
  'front',
  'fruit',
  'funny',
  'giant',
  'given',
  'glass',
  'globe',
  'grace',
  'grade',
  'grant',
  'grass',
  'great',
  'green',
  'group',
  'guard',
  'guess',
  'guest',
  'guide',
  'habit',
  'happy',
  'heart',
  'heavy',
  'honey',
  'horse',
  'hotel',
  'house',
  'human',
  'ideal',
  'image',
  'index',
  'inner',
  'input',
  'issue',
  'joint',
  'judge',
  'knife',
  'known',
  'label',
  'large',
  'laser',
  'later',
  'laugh',
  'layer',
  'learn',
  'least',
  'leave',
  'legal',
  'level',
  'light',
  'limit',
  'local',
  'logic',
  'loose',
  'lucky',
  'lunch',
  'magic',
  'major',
  'maker',
  'maple',
  'match',
  'maybe',
  'media',
  'metal',
  'might',
  'minor',
  'model',
  'money',
  'month',
  'moral',
  'motor',
  'mount',
  'mouse',
  'mouth',
  'movie',
  'music',
  'naval',
  'nerve',
  'never',
  'night',
  'noble',
  'noise',
  'north',
  'novel',
  'nurse',
  'offer',
  'often',
  'olive',
  'onion',
  'other',
  'outer',
  'owner',
  'panel',
  'paper',
  'party',
  'peace',
  'phase',
  'phone',
  'piano',
  'piece',
  'pilot',
  'pitch',
  'place',
  'plain',
  'plane',
  'plant',
  'plate',
  'point',
  'pound',
  'power',
  'press',
  'price',
  'pride',
  'prime',
  'print',
  'prior',
  'prize',
  'proof',
  'proud',
  'queen',
  'quick',
  'quiet',
  'radio',
  'raise',
  'range',
  'rapid',
  'ratio',
  'reach',
  'react',
  'ready',
  'realm',
  'refer',
  'relax',
  'reply',
  'right',
  'rival',
  'river',
  'robot',
  'rough',
  'round',
  'route',
  'royal',
  'rural',
  'scale',
  'scene',
  'scope',
  'score',
  'scout',
  'sense',
  'serve',
  'seven',
  'shade',
  'shaft',
  'shake',
  'shall',
  'shape',
  'share',
  'sharp',
  'sheet',
  'shelf',
  'shell',
  'shift',
  'shine',
  'shirt',
  'shock',
  'shoot',
  'short',
  'shown',
  'sight',
  'since',
  'skill',
  'sleep',
  'slice',
  'small',
  'smart',
  'smile',
  'smoke',
  'solid',
  'solve',
  'sound',
  'south',
  'space',
  'spare',
  'speak',
  'speed',
  'spend',
  'spice',
  'spite',
  'split',
  'spoke',
  'sport',
  'spoon',
  'stage',
  'stand',
  'start',
  'state',
  'steam',
  'steel',
  'stick',
  'still',
  'stock',
  'stone',
  'store',
  'storm',
  'story',
  'strip',
  'study',
  'style',
  'sugar',
  'suite',
  'sunny',
  'super',
  'sweet',
  'swing',
  'table',
  'taste',
  'teach',
  'teeth',
  'thank',
  'their',
  'theme',
  'there',
  'thick',
  'thing',
  'think',
  'third',
  'those',
  'three',
  'throw',
  'tight',
  'timer',
  'title',
  'today',
  'topic',
  'total',
  'touch',
  'tower',
  'trace',
  'track',
  'trade',
  'trail',
  'train',
  'treat',
  'trend',
  'trial',
  'trick',
  'trust',
  'truth',
  'twice',
  'under',
  'union',
  'unity',
  'until',
  'upper',
  'urban',
  'usual',
  'value',
  'video',
  'vital',
  'voice',
  'waste',
  'watch',
  'water',
  'wheel',
  'where',
  'which',
  'while',
  'white',
  'whole',
  'whose',
  'woman',
  'world',
  'worry',
  'worth',
  'would',
  'write',
  'wrong',
  'youth',
  'zebra'
]);

const cache = new Map();

function validateByOfflineRelaxed(word) {
  if (!/^[a-z]{4,}$/.test(word)) {
    return { valid: false, reason: 'dictionary_unreachable' };
  }
  if (!OFFLINE_VOWEL_PATTERN.test(word)) {
    return { valid: false, reason: 'dictionary_unreachable' };
  }
  if (FOUR_REPEAT_PATTERN.test(word)) {
    return { valid: false, reason: 'dictionary_unreachable' };
  }
  if (BLOCKED_WORDS.has(word)) {
    return { valid: false, reason: 'blocked_word' };
  }
  return { valid: true, source: 'offline_relaxed' };
}

function hasBlockedDefinition(meanings) {
  for (const meaning of meanings) {
    const definitions = Array.isArray(meaning.definitions) ? meaning.definitions : [];
    for (const item of definitions) {
      const definition = String(item.definition || '');
      if (BLOCKED_DEFINITION_PATTERNS.some((pattern) => pattern.test(definition))) {
        return true;
      }
    }
  }
  return false;
}

function hasValidMeaning(entry) {
  const meanings = Array.isArray(entry.meanings) ? entry.meanings : [];
  if (meanings.length === 0) {
    return false;
  }

  const validByPos = meanings.some((meaning) => {
    const partOfSpeech = String(meaning.partOfSpeech || '').toLowerCase().trim();
    return partOfSpeech && !BLOCKED_PARTS_OF_SPEECH.has(partOfSpeech);
  });

  if (!validByPos) {
    return false;
  }

  return !hasBlockedDefinition(meanings);
}

function timeoutSignal(timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    release: () => clearTimeout(timeoutId)
  };
}

async function validateByDictionaryApi(word) {
  const dictionaryUrl = `https://api.dictionaryapi.dev/api/v2/entries/en/${word}`;
  const { signal, release } = timeoutSignal(5000);
  try {
    const response = await fetch(dictionaryUrl, { signal });
    if (!response.ok) {
      return { checked: true, valid: false, reason: 'non_common_word' };
    }

    const payload = await response.json();
    if (!Array.isArray(payload) || payload.length === 0) {
      return { checked: true, valid: false, reason: 'non_common_word' };
    }

    const exactEntries = payload.filter(
      (entry) => String(entry.word || '').toLowerCase() === word
    );
    const entries = exactEntries.length > 0 ? exactEntries : payload;
    const valid = entries.some((entry) => hasValidMeaning(entry));
    return valid
      ? { checked: true, valid: true, source: 'dictionary_api' }
      : { checked: true, valid: false, reason: 'non_common_word' };
  } finally {
    release();
  }
}

async function validateByDatamuse(word) {
  const datamuseUrl = `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&max=8`;
  const { signal, release } = timeoutSignal(3500);
  try {
    const response = await fetch(datamuseUrl, { signal });
    if (!response.ok) {
      return { checked: false };
    }

    const payload = await response.json();
    if (!Array.isArray(payload)) {
      return { checked: true, valid: false, reason: 'non_common_word' };
    }

    const matched = payload.some((item) => String(item?.word || '').toLowerCase() === word);
    return matched
      ? { checked: true, valid: true, source: 'datamuse' }
      : { checked: true, valid: false, reason: 'non_common_word' };
  } finally {
    release();
  }
}

export async function validateEnglishWord(rawWord) {
  const word = String(rawWord || '').trim().toLowerCase();

  if (!/^[a-z]+$/.test(word)) {
    return { valid: false, reason: 'only_letters' };
  }

  if (BLOCKED_WORDS.has(word)) {
    return { valid: false, reason: 'blocked_word' };
  }

  if (cache.has(word)) {
    return cache.get(word);
  }

  let providerReachable = false;
  try {
    const primary = await validateByDictionaryApi(word);
    if (primary.checked) {
      providerReachable = true;
      const result = primary.valid
        ? { valid: true, source: primary.source }
        : { valid: false, reason: primary.reason || 'non_common_word' };
      cache.set(word, result);
      return result;
    }
  } catch {
    // Primary provider unavailable, continue to secondary provider.
  }

  try {
    const secondary = await validateByDatamuse(word);
    if (secondary.checked) {
      providerReachable = true;
      const result = secondary.valid
        ? { valid: true, source: secondary.source }
        : { valid: false, reason: secondary.reason || 'non_common_word' };
      cache.set(word, result);
      return result;
    }
  } catch {
    // Secondary provider unavailable, fallback to local list.
  }

  const fallbackResult = FALLBACK_WORDS.has(word)
    ? { valid: true, source: 'embedded_words' }
    : providerReachable
      ? { valid: false, reason: 'non_common_word' }
      : ALLOW_OFFLINE_RELAXED
        ? validateByOfflineRelaxed(word)
        : { valid: false, reason: 'dictionary_unreachable' };

  cache.set(word, fallbackResult);
  return fallbackResult;
}
