// One display precision for a change over a span of sessions: one decimal. The AI market reading copies the two-decimal
// figures from its evidence lines, so one sentence carried "5거래일 +9.35%" beside "50일선 대비 -13.1%". A one-day close
// change keeps its two decimals (it is not written after a span word).
const SPAN_PERCENT = /((?:대비|거래일|일|주|개월|년)\s+)([+-]?)(\d+\.\d{2,})%(?!p)/g;
export function spanPercentOneDecimal(text) {
  if (typeof text !== 'string' || !text) return text;
  return text.replace(SPAN_PERCENT, (_, lead, sign, digits) => `${lead}${sign}${(Math.round(Number(digits) * 10 + 1e-9) / 10).toFixed(1)}%`);
}
