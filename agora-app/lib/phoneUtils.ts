/**
 * Utility for parsing and normalizing phone numbers from spoken utterances,
 * spelled-out words (English and Hindi), and raw numeric strings.
 */

const WORD_TO_DIGIT: Record<string, string> = {
  // English words
  zero: '0',
  oh: '0',
  o: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',

  // Hindi Devanagari
  शून्य: '0',
  जीरो: '0',
  एक: '1',
  दो: '2',
  तीन: '3',
  चार: '4',
  पाँच: '5',
  पांच: '5',
  छह: '6',
  छः: '6',
  सात: '7',
  आठ: '8',
  नौ: '9',

  // Hindi Romanized (Hinglish)
  shunya: '0',
  ek: '1',
  do: '2',
  teen: '3',
  chaar: '4',
  char: '4',
  paanch: '5',
  panch: '5',
  chheh: '6',
  chhah: '6',
  che: '6',
  saat: '7',
  sat: '7',
  aath: '8',
  ath: '8',
  nau: '9',
};

// Sorted by length descending for regex matching glued words (e.g. "eightnine")
const SORTED_WORD_KEYS = Object.keys(WORD_TO_DIGIT).sort((a, b) => b.length - a.length);
const GLUED_WORDS_REGEX = new RegExp(`(${SORTED_WORD_KEYS.join('|')})`, 'gi');

/**
 * Extracts digits from text that may contain numeric digits, spelled-out words, or a mixture.
 */
export function extractSpokenDigits(text: string): string {
  if (!text) return '';

  let normalized = text.toLowerCase();

  // Expand double / triple expressions: e.g. "double nine" -> "nine nine"
  normalized = normalized.replace(/\bdouble\s+([a-z\u0900-\u097F\d]+)/gi, '$1 $1');
  normalized = normalized.replace(/\btriple\s+([a-z\u0900-\u097F\d]+)/gi, '$1 $1 $1');

  // Tokenize into words and digit blocks
  const tokens = normalized.match(/[a-z\u0900-\u097F]+|\d+/gi) || [];

  let digits = '';
  for (const token of tokens) {
    const lower = token.toLowerCase();
    if (WORD_TO_DIGIT[lower] !== undefined) {
      digits += WORD_TO_DIGIT[lower];
    } else if (/^\d+$/.test(token)) {
      digits += token;
    } else {
      // Check if glued words exist within this token, e.g. "eightnine" -> "89"
      const subTokens = lower.match(GLUED_WORDS_REGEX);
      if (subTokens && subTokens.join('').length === lower.length) {
        for (const sub of subTokens) {
          if (WORD_TO_DIGIT[sub] !== undefined) {
            digits += WORD_TO_DIGIT[sub];
          }
        }
      }
    }
  }

  return digits;
}

/**
 * Normalizes a phone number to standard 10 digits if possible,
 * stripping Indian country code prefixes (91 or 0) for 12/11 digit inputs.
 */
export function normalizePhoneNumber(raw: string): {
  digits: string;
  isValid10: boolean;
} {
  if (!raw) return { digits: '', isValid10: false };

  // First extract any digits from words or numbers
  let digits = extractSpokenDigits(raw);

  // Fallback: if extractSpokenDigits found nothing, strip non-digits
  if (!digits) {
    digits = raw.replace(/\D/g, '');
  }

  // Strip leading country code +91 or 91 if total digits is 12
  if (digits.length === 12 && digits.startsWith('91')) {
    digits = digits.slice(2);
  } else if (digits.length === 11 && digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return {
    digits,
    isValid10: digits.length === 10,
  };
}
