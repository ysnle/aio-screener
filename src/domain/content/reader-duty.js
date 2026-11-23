const DUTY_TAIL = /\s*(?:을|를)?\s*(?:확인|점검|주시|살펴|지켜|눈여겨)\s*(?:해야|봐야|볼|할)\s*(?:필요가\s*있)?\s*(?:합니다|습니다)\.?\s*$/;

/** A watch item as a checklist line: "…부합하는지 확인해야 합니다." → "…부합하는지". */
export function watchItem(text) {
  const value = String(text || '').trim();
  const cut = value.replace(DUTY_TAIL, '').trim();
  return cut.length >= 4 ? cut : value;
}

/** A summary without its sentences that only tell the reader to check something. */
export function dropReaderDuty(text) {
  const sentences = String(text || '').match(/[^.!?]+[.!?]*/g) || [];
  const kept = sentences.filter((sentence) => !DUTY_TAIL.test(sentence.trim()));
  return (kept.length ? kept : sentences).join('').trim();
}
