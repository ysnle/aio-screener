// One reading of how many cases stand behind a past figure, for every outcome read-out (theme stage records, branch
// analogs, the VIX band table and its risk line, the 시장 기울기 frequency items, price-temperature spells, the screener
// validation verdict). R706:
//   n < EVIDENCE_FLOOR   counts only — no share, average or direction word
//   n < EVIDENCE_FULL    figures shown, marked 참고
// `approx` is for an effective count (overlapping windows ÷ horizon): rounded once, and that number is both judged and shown.
export const EVIDENCE_FLOOR = 10;
export const EVIDENCE_FULL = 30;

/** @returns {{ n:number, level:'thin'|'small'|'enough', figures:boolean, reference:boolean, count:string, tag:string, note:string }} */
export function evidenceStrength(n, { approx = false } = {}) {
  const raw = Number(n);
  const count = Number.isFinite(raw) && raw > 0 ? (approx ? Math.round(raw) : raw) : 0;
  const level = count < EVIDENCE_FLOOR ? 'thin' : count < EVIDENCE_FULL ? 'small' : 'enough';
  const text = `사례 ${approx ? '약 ' : ''}${count.toLocaleString('en-US')}개`;
  return Object.freeze({ n: count, level, figures: level !== 'thin', reference: level !== 'enough', count: text,
    tag: level === 'enough' ? text : `${text} · 참고`,
    note: level === 'thin' ? `${text}라 비율·평균으로 말하지 않습니다.` : level === 'small' ? `${text}라 참고로만 봅니다.` : '' });
}
