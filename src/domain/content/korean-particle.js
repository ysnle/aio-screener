// P1592 (F72): pick the Korean particle from the last spoken syllable of an interpolated word. A fixed
// '을' after a template slot produced '스프레드을 본다', '전망 3.1%을 본다', '집중도을 본다'.
// Digits, Latin letters and '%' are read the way a Korean reader says them (3 → 삼, % → 퍼센트, L → 엘,
// a lowercase-ending word by its sound: Buffett → 버핏).

const DIGIT_HAS_FINAL = { 0: true, 1: true, 2: false, 3: true, 4: false, 5: false, 6: true, 7: true, 8: true, 9: false };
const LATIN_HAS_FINAL = new Set(['L', 'M', 'N', 'R']);

export function hasFinalConsonant(word) {
  const text = String(word ?? '').replace(/[\s)\]}'"’”.,·…]+$/u, '');
  const last = text.slice(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(last)) return DIGIT_HAS_FINAL[last];
  if (last === '%') return false;
  // A word read aloud (Buffett → 버핏) ends on its consonant; an acronym (HBM → 에이치비엠) on the letter name.
  if (/[a-z]/.test(last)) return !/[aeiouyrhw]/.test(last);
  if (/[A-Z]/.test(last)) return LATIN_HAS_FINAL.has(last);
  return false;
}

// '을/를' after a noun phrase.
export function withObjectParticle(word) {
  const text = String(word ?? '');
  return `${text}${hasFinalConsonant(text) ? '을' : '를'}`;
}

// '은/는' after a noun phrase.
export function withTopicParticle(word) {
  const text = String(word ?? '');
  return `${text}${hasFinalConsonant(text) ? '은' : '는'}`;
}

// '으로/로' — a final ㄹ takes '로' like a vowel (서울로, 엘로).
export function withDirectionParticle(word) {
  const text = String(word ?? '').replace(/[\s)\]}'"’”.,·…]+$/u, '');
  const last = text.slice(-1);
  const code = last ? last.charCodeAt(0) : 0;
  const finalL = (code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 === 8) || last === '1' || last === '7' || last === '8' || /[LR]/i.test(last);
  return `${String(word ?? '')}${hasFinalConsonant(word) && !finalL ? '으로' : '로'}`;
}
