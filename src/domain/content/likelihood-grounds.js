// The kinds of ground a likelihood in words ("가능성이 더 높아 보입니다") or a favoured side may stand on in the AI market
// reading, in one list: the prompt's conduct line names each kind by `label` (scripts/lib/market-analysis-prompt.mjs) and
// the validator counts a likelihood as grounded when one kind's `patterns` all match its sentence or the sentence before
// it (scripts/lib/market-analysis-validate.mjs). A kind added, renamed or removed here changes both at once.
// A likelihood without a listed ground is a warning (likelihood-qualitative), not a block; the prompt asks the model to
// say in the sentence that the ground is thin.
// A met-condition count (n/m), an axis state (양호·중립·부담), a signed move or a bare condition ("…하면") describe the
// present; the six-axis count failed its pre-registered backtest (model-validation-status.json marketLean), so none of
// them is a kind. The patterns read the wording the model is given: the decision frame (decision-frame.js
// decisionFrameText: "138번 중 80번 … 평소 55%", "근거 종류: 비용 가설"), the VIX-band risk line (vix-band-record.js
// vixBandRiskLine: "VIX 25.6(높음 구간): … 빠진 경우 30% (겹치지 않는 사례 140개 중 42개, 평소 15%)") and the scenario lines'
// "시장 가격" (macro-crossroads.js).
// "6개 중 4개 조건 충족" is a met-condition count, not a sample.
const SAMPLE = /\d+\s*(?:건|번|회|차례|개)\s*중\s*\d+(?!\d|\s*개?\s*(?:조건|충족))|(?:사례|표본)\s*\d+|\d+\s*(?:건|번|회|차례|개)의?\s*(?:사례|표본)/;
const BASE_RATE = /평소|기저율|기준\s?비율|전체\s?거래일/;

export const LIKELIHOOD_GROUNDS = Object.freeze([
  Object.freeze({ id: 'past-frequency', label: '기저율·표본 수와 함께 쓴 과거 빈도', patterns: Object.freeze([SAMPLE, BASE_RATE]) }),
  Object.freeze({ id: 'vix-band-record', label: 'VIX 구간 기록', patterns: Object.freeze([/(?<![A-Za-z])VIX(?![A-Za-z])[^.!?\n]{0,40}구간/, BASE_RATE]) }),
  Object.freeze({ id: 'market-implied', label: '시장 가격에 반영된 기대(선물·금리 가격)',
    patterns: Object.freeze([/시장\s?가격|선물\s?가격|금리\s?선물|가격에\s?반영|반영된\s?(?:기대|금리)|시장\s?내재|내재\s?(?:금리|기대|변동성)|(?<![A-Za-z])FedWatch(?![A-Za-z])|페드워치/]) }),
  Object.freeze({ id: 'cost-hypothesis', label: '"…라는 비용 가설"이라고 이름 붙인 가설', patterns: Object.freeze([/비용\s?가설/]) }),
]);

/** The first ground kind whose patterns all match `text`, or null. */
export function likelihoodGroundOf(text) {
  const value = String(text ?? '');
  return LIKELIHOOD_GROUNDS.find((kind) => kind.patterns.every((pattern) => pattern.test(value)))?.id || null;
}

/** The kinds as one Korean list: "a, b, c, 또는 d". */
export function likelihoodGroundList() {
  const labels = LIKELIHOOD_GROUNDS.map((kind) => kind.label);
  return `${labels.slice(0, -1).join(', ')}, 또는 ${labels.at(-1)}`;
}
