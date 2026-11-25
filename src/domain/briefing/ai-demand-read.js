// The AI supply chain's orders beside its prices. The block above this line shows what the US listings' prices did
// over a month, and Taiwan's monthly revenue under it shows what was shipped; the two were printed one under the other
// and never set against each other. This sentence does that: whether the order figures (Taiwan's reported revenue, the
// hyperscalers' capital spending from SEC cash-flow statements) turned with the prices or not — and, when spending has
// grown to most of operating cash flow, that the question moves from "are there orders" to "can they keep paying".
import { claim, say, sayJoin, NOTHING } from '../shared/claim.js';

// Capital spending at or past this share of operating cash flow leaves little cash after it.
export const CAPEX_STRETCH_PCT = 80;

const pct = (subject, measure, asOf, value, label) => claim({ subject, measure, asOf, figures: [{ value, unit: 'pct', basis: measure, label }] });
const monthLabel = (month) => `${Number(String(month).slice(5, 7))}월`;

/**
 * { side, said } or null without an order figure.
 * @param {object} input
 * @param {{groups: object[], down1m: number}} input.flow aiChainFlow() — the price side
 * @param {object} [input.tw]    buildTwRevenueView() in state 'ok'
 * @param {object} [input.capex] the hyperscalers' group total (groupCashflow), complete
 * @param {string} [input.session] the price session (the flow's US close)
 */
export function aiDemandRead({ flow = null, tw = null, capex = null, session = null } = {}) {
  const groups = flow?.groups || [];
  const revenue = tw?.state === 'ok' && Number.isFinite(tw.totalYoy) ? tw : null;
  const spend = capex?.complete && Number.isFinite(capex.capexYoyPct) ? capex : null;
  if (!groups.length || (!revenue && !spend)) return null;
  const orders = sayJoin([
    revenue ? say('대만 공급망 {m} 매출 1년 전보다 {y}', { m: monthLabel(revenue.month), y: pct('tw-revenue', 'totalYoy', revenue.month, revenue.totalYoy, '대만 월매출') }) : NOTHING,
    spend ? say('빅테크 {n}개사 설비투자 1년 전보다 {y}', { n: String(spend.members.length), y: pct('hyperscalers', 'capexYoy', spend.endRange?.[1] || null, spend.capexYoyPct, '설비투자') }) : NOTHING
  ], ', ');
  const ordersUp = [revenue?.totalYoy, spend?.capexYoyPct].filter(Number.isFinite).every((value) => value > 0);
  const pricesDown = flow.down1m > groups.length / 2;
  const side = ordersUp ? (pricesDown ? 'priceOnly' : 'together') : 'ordersTurn';
  // The block's first sentence already counts the groups; all of them falling is said without the count twice.
  const price = flow.down1m === groups.length ? say('주가는 묶음 모두 한 달 새 내렸습니다') : say('주가는 {t}개 묶음 중 {d}개가 한 달 새 내렸습니다', {
    t: claim({ subject: 'ai-chain', measure: 'groups', asOf: session, figures: [{ value: groups.length, unit: 'level', digits: 0, basis: 'groups', label: '묶음' }] }),
    d: claim({ subject: 'ai-chain', measure: 'groupsDown1m', asOf: session, figures: [{ value: flow.down1m, unit: 'level', digits: 0, basis: 'down1m', label: '한 달 하락 묶음' }] }) });
  const meaning = {
    priceOnly: '주문이 줄었다는 숫자는 아직 없고, 내린 것은 주가입니다.',
    together: '주문과 주가가 같은 방향입니다.',
    ordersTurn: '주문 쪽 숫자가 줄기 시작해, 주가 하락을 값만의 문제로 보기 어렵습니다.'
  }[side];
  const stretched = spend && Number.isFinite(spend.capexToOcfPct) && spend.capexToOcfPct >= CAPEX_STRETCH_PCT;
  const funding = stretched
    ? say('다만 설비투자가 영업현금흐름의 {r}까지 올라와{was}, 이 속도를 이어갈 돈이 남는지가 다음 쟁점입니다.', {
      r: claim({ subject: 'hyperscalers', measure: 'capexToOcf', asOf: spend.endRange?.[1] || null, figures: [{ value: spend.capexToOcfPct, unit: 'share', digits: 1, basis: 'capexToOcf', label: '설비투자 ÷ 영업현금흐름' }] }),
      was: Number.isFinite(spend.yearAgo?.capexToOcfPct) ? say('(1년 전 {w})', { w: claim({ subject: 'hyperscalers', measure: 'capexToOcfYearAgo', asOf: spend.endRange?.[1] || null,
        figures: [{ value: spend.yearAgo.capexToOcfPct, unit: 'share', digits: 0, basis: 'capexToOcfYearAgo', label: '1년 전' }] }) }) : NOTHING })
    : NOTHING;
  return { side, stretched: !!stretched, said: sayJoin([say('주문 쪽은 {o}이고, {p}.', { o: orders, p: price }), say(meaning), funding], ' ') };
}

/** The same reading as a typed fact line for an AI packet ('' without one). */
export const aiDemandFactLine = (read) => (read ? `AI 공급망 주문 대 주가(대만 월매출은 신고 금액, 설비투자는 SEC 현금흐름표 최근 4분기; 원인 단정 아님): ${read.said.text}` : '');
