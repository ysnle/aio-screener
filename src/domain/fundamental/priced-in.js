// 종목 "이 주가가 반영하는 것": what today's
// price is assuming, said as one of four rule-decided states, then the condition. Inputs are the consensus row and the
// screener row only: the close against its 52-week closing high, the last four reported quarters' and the next four
// expected quarters' EPS, the four-week revision counts and the peak-earnings caution (consensus-read.js).
//   ahead     — far below the high (RULES.pricedIn.farFromHighPct), estimates not cut (down − up ≤ 0), forward EPS above
//               trailing: the market is pricing an earnings fall the estimates do not show yet. Condition: the cut
//               (1 − trailing EPS ÷ forward EPS) past which the price is no longer below the trailing multiple.
//   confirmed — far below the high and down revisions ahead by CONSENSUS_NET_REVISION_FLOOR: the fall is being
//               confirmed by estimate cuts, so the multiple is not a floor yet.
//   leaning   — near the high (nearHighPct), trailing P/E at or above richPe and expected growth at most smallGrowthPct:
//               the price leans on its multiple more than on earnings growth.
//   plain     — otherwise: the two numbers only.
// The company's usual multiple is not computed — no history of past multiples is published. Withheld (null) whenever
// consensusView gives no multiple on either side (a loss, the split guard PE_PLAUSIBLE_MIN, a one-off basis gap, stale
// rows) or a multiple past PE_MEANINGFUL_MAX. Facts and conditions only; never an order.
import { consensusView, peakEarningsCaution, PE_MEANINGFUL_MAX, CONSENSUS_NET_REVISION_FLOOR } from './consensus-read.js';
import { claim, say, sayJoin, NOTHING, printedValue } from '../shared/claim.js';
import { readNumber as finite } from '../shared/number.js';
import { RULES } from '../rules/thresholds.js';

/** The glossary entry the peak-earnings condition names (term-marks.js marks it on screen). */
export const CYCLICAL_PER_TERM = '경기순환주의 PER 역설';
export const PRICED_IN_STATES = Object.freeze({ ahead: '이익 감소를 먼저 반영', confirmed: '주가와 추정치가 함께 내려가는 중', leaning: '기대가 이미 가격에 있음', plain: '특별히 말할 것 없음' });

/** The state rule as written conventions, for the method fold. */
export function pricedInMethod() {
  const P = RULES.pricedIn;
  return [`52주 종가 고점 대비 ${P.farFromHighPct}% 이하이고 최근 4주 추정치 하향이 상향보다 많지 않으며 예상 이익이 직전 4개 분기보다 크면 '${PRICED_IN_STATES.ahead}', 하향이 상향보다 ${CONSENSUS_NET_REVISION_FLOOR}건 이상 많으면 '${PRICED_IN_STATES.confirmed}'입니다.`,
    `고점 대비 ${P.nearHighPct}% 안이고 직전 4개 분기 PER이 ${P.richPe}배 이상이며 예상 이익 증가가 ${P.smallGrowthPct}% 이하면 '${PRICED_IN_STATES.leaning}'입니다.`,
    '갈림이 되는 감소 폭은 1 − 직전 4개 분기 EPS ÷ 향후 4개 분기 예상 EPS입니다. 이익이 추정치보다 이만큼 넘게 줄면 예상 기준 PER이 지금의 직전 기준 PER을 넘습니다. 회사의 평소 배수는 과거 배수 기록이 없어 쓰지 않습니다. 적자, 분할 전후 기준이 다른 EPS, 200배 넘는 배수에는 이 읽기를 내지 않습니다.'];
}

/** { state, lines: [said], text, claims, term } or null when the price cannot be read against the estimates. */
export function buildPricedInRead(row, estimate, { now = Date.now() } = {}) {
  const view = consensusView(row, estimate, { now });
  if (!view || view.fwdPe == null || view.trailingPe == null || view.growth == null) return null;
  if (view.fwdPe > PE_MEANINGFUL_MAX || view.trailingPe > PE_MEANINGFUL_MAX) return null;
  const P = RULES.pricedIn;
  const subject = `consensus:${String(estimate.sym || row?.sym || row?.symbol || '').toUpperCase()}`;
  const on = (measure, figures, asOf = view.asOf) => claim({ subject, measure, asOf, figures });
  const fromHigh = finite(row?.pctFromCloseHigh52w);
  const high = fromHigh == null ? null : on('pctFromCloseHigh52w', [{ value: fromHigh, unit: 'pct', digits: 0, basis: 'pctFromCloseHigh52w', label: '52주 종가 고점 대비' }], view.priceDate);
  const tpe = on('trailingPe', [{ value: view.trailingPe, unit: 'x', basis: 'trailingPe', label: '직전' }]);
  const fpe = on('fwdPe', [{ value: view.fwdPe, unit: 'x', basis: 'fwdPe', label: 'PER' }]);
  const growth = on('growth', [{ value: view.growth, unit: 'pct', digits: 0, basis: 'growth', label: '예상 이익' }]);
  const cut = view.fwdEps > view.trailingEps ? on('cut', [{ value: (1 - view.trailingEps / view.fwdEps) * 100, unit: 'share', basis: 'cut', label: '추정치' }]) : null;
  const net = view.down4w - view.up4w;
  const far = high && printedValue(high.figures[0]) <= P.farFromHighPct;
  const state = far && view.revisionsKnown && net <= 0 && cut && printedValue(cut.figures[0]) >= 1 ? 'ahead'
    : far && view.revisionsKnown && net >= CONSENSUS_NET_REVISION_FLOOR ? 'confirmed'
      : high && printedValue(high.figures[0]) >= P.nearHighPct && view.trailingPe >= P.richPe && printedValue(growth.figures[0]) <= P.smallGrowthPct ? 'leaning' : 'plain';
  const counts = view.up4w === 0 && view.down4w === 0 ? say('최근 4주 수정 없음')
    : say('최근 4주 상향 {up}건, 하향 {down}건', { up: String(view.up4w), down: String(view.down4w) });
  const lines = [];
  if (state === 'ahead') {
    const peak = peakEarningsCaution(view)
      ? say(' {growth.label} {growth}를 전제한 가격이라, 경기순환 업종이면 호황이 꺾이는지가 갈림입니다({term}).', { growth, term: CYCLICAL_PER_TERM }) : NOTHING;
    const estimates = -net >= CONSENSUS_NET_REVISION_FLOOR ? '오히려 올라갔습니다' : '내려가지 않았습니다';
    lines.push(say('{high.date} 종가는 {high.label} {high}인데 이익 추정치는 {estimates}({counts}). 시장이 추정치보다 먼저 이익 감소를 반영하고 있습니다.', { high, counts, estimates }),
      say('추정치대로면 {fpe.label} {fpe}로 {tpe.label} 이익 기준({tpe})보다 낮은 가격이고, 이익이 {cut.label}보다 {cut} 넘게 줄면 그렇지 않습니다.{peak}', { fpe, tpe, cut, peak }));
  } else if (state === 'confirmed') {
    lines.push(say('{high.date} 종가는 {high.label} {high}이고, 이익 추정치도 내려가는 중입니다({counts}).', { high, counts }),
      say('주가 하락을 추정치 하향이 뒤따르고 있어, {fpe.label} {fpe}({tpe.label} 이익으로 {tpe})는 아직 바닥 근거가 아닙니다.', { fpe, tpe }));
  } else if (state === 'leaning') {
    lines.push(say('{high.date} 종가는 {high.label} {high}로 고점 근처이고, PER은 {tpe.label} 4개 분기 이익으로 {tpe}입니다. {growth.label} 증가는 {growth}라, 이익보다 높은 배수에 기대는 가격입니다.', { high, tpe, growth }));
  } else {
    lines.push(say('{where}{fpe.label}은 {tpe.label} 4개 분기 이익으로 {tpe}, 예상 이익으로 {fpe}입니다.', { fpe, tpe,
      where: high ? say('{high.date} 종가는 {high.label} {high}이고, ', { high }) : NOTHING }));
  }
  const all = sayJoin(lines, ' ');
  return { state, label: PRICED_IN_STATES[state], lines, text: all.text, claims: all.claims, method: pricedInMethod(),
    term: state === 'ahead' && peakEarningsCaution(view) ? CYCLICAL_PER_TERM : null, asOf: view.asOf, priceDate: view.priceDate };
}
