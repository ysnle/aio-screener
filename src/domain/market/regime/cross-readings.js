// 시장 상태 reads its indicators in pairs (owner 2026-11-03). "시장 폭만 본다고 해서 의미가 없듯이 다른 구조와
//같이 봐야 의미가 생긴다" — breadth means something against the index's own trend, sentiment against volatility and
// positioning, rates against credit, Korea against the won. Each pair prints its numbers and one fixed word for the
// combination (the volatility pair reads the shared volatility state), from closes and published series only (history.json, macro-history.json, market-day.json positioning).
import { readNumber, signedText } from '../../shared/number.js';
import { RULES } from '../../rules/thresholds.js';
import { sessionCloses } from '../indices/index-levels.js';
import { hyDelta20Bp } from '../../briefing/market-read.js';
import { fearGreedBand } from '../sentiment/metrics.js';
import { depthReadout } from './depth-readouts.js';
import { creditJudgement } from '../../briefing/credit-reading.js';
import { volatilityState } from '../sentiment/volatility-state.js';
import { buildCloseSeries } from '../session/close-series.js';

const pct = (value, digits = 1) => signedText(value, digits, '%');
const unit = (value) => Math.max(0.04, Math.min(0.96, value));
// Each pair is also a 2×2 map — x and y run 0..1 (left→right, bottom→top), the four cells name what that
// combination means, and the dot is where the latest closes sit. cells are [bottom-left, bottom-right, top-left, top-right].
const quad = (x, y, xAxis, yAxis, cells) => ({ x: unit(x), y: unit(y), xAxis, yAxis, cells });
const bp = (value) => signedText(value, 0, 'bp');
const WINDOW = 20;

function lastValue(history, field) {
  for (let i = (history?.length || 0) - 1; i >= 0; i -= 1) {
    const value = readNumber(history[i]?.[field]);
    if (value !== null) return value;
  }
  return null;
}
function change(closes, n) {
  if (closes.length <= n) return null;
  const end = closes.at(-1).value; const start = closes.at(-1 - n).value;
  return start ? (end / start - 1) * 100 : null;
}

// The equal-weight gap reads with the direction of both indexes. "동일가중이 앞섰다" meant "상승이 넓어졌다"
// only in a rise; on 11/20 (S&P 500 -9.4%, 동일가중 -4.2%) it meant the fall was heavier in the large caps.
// Each pair prints its numbers and one fixed word per rule (its map cell where one applies); what the combination means
// in a sentence is the screen's AI reading.
const GAP_PP = 3;
export const EQUAL_WEIGHT_WORDS = Object.freeze({
  broadRise: '동일가중 우위 상승', capFall: '대형주 낙폭 큼', capOnlyDown: '대형주만 하락',
  capRise: '대형주 쏠림 상승', broadFall: '대형주 밖 낙폭 큼', capOnlyUp: '대형주만 상승'
});
// The equal-weight gap reads with the direction of both indexes: 동일가중 ahead meant 상승 확산 only in a rise (11/20:
// S&P 500 -9.4%, 동일가중 -4.2% was the larger fall in the large caps).
function equalWeightGap(spx, rsp) {
  if (rsp.length <= WINDOW || rsp.at(-1).date !== spx.at(-1).date) return '';
  const cap = change(spx, WINDOW); const equal = change(rsp, WINDOW);
  if (!Number.isFinite(cap) || !Number.isFinite(equal) || Math.abs(equal - cap) < GAP_PP) return '';
  const rise = cap >= 0 && equal >= 0; const fall = cap < 0 && equal < 0;
  const W = EQUAL_WEIGHT_WORDS;
  const word = equal > cap ? (rise ? W.broadRise : fall ? W.capFall : W.capOnlyDown) : (rise ? W.capRise : fall ? W.broadFall : W.capOnlyUp);
  return ` 20거래일 S&P 500 ${pct(cap)}, 동일가중 ${pct(equal)} — ${word}.`;
}

export const TREND_BREADTH_WORDS = Object.freeze({ narrowPullback: '좁은 조정', broadFall: '넓은 하락', narrowRise: '좁은 상승', broadRise: '넓은 상승', middle: '폭 방향 미정' });
function trendAndBreadth(history) {
  const spx = sessionCloses(history, 'spx');
  const breadth = lastValue(history, 'breadth50');
  if (spx.length < 50 || breadth === null) return null;
  const ma50 = spx.slice(-50).reduce((sum, row) => sum + row.value, 0) / 50;
  const vs50 = (spx.at(-1).value / ma50 - 1) * 100;
  const b = Math.round(breadth);
  const below = vs50 < 0;
  const { broadAbovePct, narrowBelowPct } = RULES.breadthCross;
  const W = TREND_BREADTH_WORDS;
  const word = b >= broadAbovePct ? (below ? W.narrowPullback : W.broadRise) : b < narrowBelowPct ? (below ? W.broadFall : W.narrowRise) : W.middle;
  let text = `S&P 500 50일선 대비 ${pct(vs50)}, 50일선 위 종목 ${b}% — ${word}(50일선 위 종목 ${broadAbovePct}% 이상이면 다수 종목이 선 위, ${narrowBelowPct}% 미만이면 소수만 선 위).`;
  // A member above a falling 50-day line is a bounce, not participation: the share on rising lines is printed beside it.
  const rising = lastValue(history, 'breadth50Rising');
  if (rising !== null && b - rising >= 15) text += ` 50일선 위 ${b}% 중 오르는 선 위 ${Math.round(rising)}%.`;
  text += equalWeightGap(spx, sessionCloses(history, 'rsp'));
  const map = quad(0.5 + vs50 / 10, b / 100, ['지수 50일선 아래', '50일선 위'], ['종목 참여 적음', '종목 참여 많음'], [W.broadFall, W.narrowRise, W.narrowPullback, W.broadRise]);
  return { id: 'trend-breadth', title: '추세와 시장 폭', axes: ['trend', 'breadth'], asOf: spx.at(-1).date || null, word, text, map };
}

// The credit leg of a stressed, fearful pair: the credit judgement of the same close, as its word and HY moves.
function creditSpread(macroHistory, through) {
  const credit = macroHistory ? creditJudgement(macroHistory, through) : null;
  if (!credit) return '';
  const moves = [credit.hy5 != null ? `5거래일 ${bp(credit.hy5)}` : '', credit.hy20 != null ? `20거래일 ${bp(credit.hy20)}` : ''].filter(Boolean).join(', ');
  return ` 하이일드 스프레드 ${credit.state === 'burden' ? '부담' : '부담 아님'}${moves ? `(${moves})` : ''}.`;
}

export const VOL_SENTIMENT_WORDS = Object.freeze({ capitulation: '투매형 공포', stressOnly: '변동성 높음, 심리 극단 아님', fearOnly: '겁만 난 상태', complacent: '과열', middle: '중간 범위' });
function volatilityAndSentiment(history, day, macroHistory) {
  // Level and term structure are the shared volatility state of the last VIX close (the 투자 심리 card reads the same one).
  const vol = volatilityState(history, { through: buildCloseSeries(history, 'vix').at(-1)?.date || null });
  if (!vol) return null;
  const vix = vol.level.value, vixAt = vol.asOf;
  const fg = lastValue(history, 'fg');
  const V = RULES.volatility, W = VOL_SENTIMENT_WORDS;
  const inverted = vol.term?.state === 'inverted';
  const stressed = inverted || vix >= V.stressAt;
  // Extreme fear is the gauge's own band (published whole number under RULES.fearGreed.extremeFearBelow).
  const fearful = fg !== null && fearGreedBand(fg).label === '극단 공포';
  const word = stressed && fearful ? W.capitulation : stressed ? W.stressOnly : fearful ? W.fearOnly : fg !== null && fg > RULES.fearGreed.extremeGreedAbove ? W.complacent : W.middle;
  const numbers = [`VIX ${vix.toFixed(1)}`, vol.term ? `기간 구조 ${vol.term.label}` : null, fg !== null ? `공포·탐욕 지수 ${Math.round(fg)}` : null].filter(Boolean);
  const retail = (day?.facts || []).find((fact) => fact.kind === 'positioning' && fact.side === 'buy' && Number.isFinite(fact.leveragedLongShare));
  const crowd = retail && retail.leveragedLongShare >= 40 ? ` 서학개미 순매수 중 레버리지 상품 ${Math.round(retail.leveragedLongShare)}%.` : '';
  const map = fg === null ? null : quad((vix - 12) / 24, 1 - fg / 100, ['VIX 낮음', 'VIX 높음'], ['심리 탐욕', '심리 공포'], [W.complacent, '흔들리는 강세', W.fearOnly, W.capitulation]);
  return { id: 'volatility-sentiment', title: '변동성과 투자 심리', axes: ['volatility'], asOf: vixAt, word,
    text: `${numbers.join(', ')} — ${word}.${word === W.capitulation ? creditSpread(macroHistory, vixAt) : ''}${crowd}`, map };
}

function ratesAndCredit(history, macroHistory) {
  const tnx = sessionCloses(history, 'tnx');
  if (tnx.length <= WINDOW || !macroHistory) return null;
  const end = tnx.at(-1); const start = tnx.at(-1 - WINDOW);
  const yieldBp = (end.value - start.value) * 100;
  // The credit axis's own 20-session HY change (one reading for every screen), through the same close.
  const spreadBp = hyDelta20Bp(macroHistory, end.date)?.value ?? null;
  if (spreadBp === null) return null;
  const widening = spreadBp >= RULES.credit.widen20dBp;
  const numbers = `20거래일 동안 미국 10년 금리 ${bp(yieldBp)}, 하이일드 스프레드 ${bp(spreadBp)}.`;
  let read;
  if (yieldBp <= -10 && widening) read = '국채 금리는 내리고 회사채 스프레드는 벌어진, 성장 걱정과 맞는 조합입니다. 금리 하락이 호재로 읽히지 않는 이유입니다.';
  else if (yieldBp <= -10) read = '금리와 신용이 함께 안정돼, 돈 빌리는 비용이 전반적으로 낮아지는 완화형 조합입니다.';
  else if (yieldBp >= 10 && widening) read = '금리와 스프레드가 함께 올라, 긴축 부담이 위험자산으로 번지는 조합입니다.';
  else if (yieldBp >= 10) read = '금리는 올랐지만 신용은 차분해, 경기나 물가 쪽 금리 상승으로 읽힙니다.';
  else if (widening) read = '금리는 크게 움직이지 않았는데 스프레드만 벌어져, 신용 쪽 경계가 따로 커지고 있습니다.';
  else read = '20거래일로는 금리와 신용 모두 큰 변화가 없습니다.';
  const weekBp = tnx.length > 5 ? (end.value - tnx.at(-6).value) * 100 : null;
  if (weekBp != null && Math.abs(weekBp) >= RULES.rates.move20dBp / 2 && Math.abs(weekBp) > Math.abs(yieldBp)) read += ` 다만 최근 5거래일에만 10년 금리가 ${bp(weekBp)} 움직여, 변화는 이번 주에 몰려 있습니다.`;
  const map = quad(0.5 + yieldBp / 80, 0.5 + spreadBp / 80, ['금리 하락', '금리 상승'], ['스프레드 축소', '스프레드 확대'], ['완화', '경기·물가', '성장 걱정', '긴축 부담']);
  return { id: 'rates-credit', title: '금리와 신용', axes: ['rates', 'credit'], asOf: end.date || null, text: `${numbers} ${read}`, map };
}

// The pair reads both series through the last date they share. On 11/23 the KOSPI close (-3.3%) was
// paired with the won's 11/20 New York close (+0.9%) and called "함께 나온 하락"; a later KOSPI session is named on its own.
const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
function koreaAndWon(history) {
  const kospiAll = sessionCloses(history, 'kospi'); const krwAll = sessionCloses(history, 'usdkrw');
  const krwDates = new Set(krwAll.map((row) => row.date));
  const anchor = kospiAll.filter((row) => krwDates.has(row.date)).at(-1)?.date || null;
  if (!anchor) return null;
  const kospi = kospiAll.filter((row) => row.date <= anchor); const krw = krwAll.filter((row) => row.date <= anchor);
  const later = kospiAll.at(-1).date > anchor ? kospiAll.at(-1) : null;
  const k5 = change(kospi, 5); const w5 = change(krw, 5);
  if (!Number.isFinite(k5) || !Number.isFinite(w5)) return null;
  // A day as large as a week (11/3: -3.6% inside a flat week) is read on the day; otherwise on the week.
  const k1 = change(kospi, 1); const w1 = change(krw, 1);
  const daily = Number.isFinite(k1) && Number.isFinite(w1) && Math.abs(k1) >= 2.5;
  const [k, w, kDown, wWeak, label] = daily ? [k1, w1, -2.5, 0.5, '하루'] : [k5, w5, -3, 1, '5거래일'];
  const on = later ? `${md(anchor)} ` : '';
  const numbers = daily ? `${on}코스피 하루 ${pct(k1)}, 원/달러 ${pct(w1)}(5거래일 ${pct(k5)}, ${pct(w5)}).` : `${on}${label} 동안 코스피 ${pct(k5)}, 원/달러 ${pct(w5)}.`;
  let read;
  if (k <= kDown && w >= wWeak) read = '원화 약세와 주가 하락이 함께 나온, 환율이 같이 밀린 하락입니다.';
  else if (k <= kDown) read = '원화는 차분해, 환율보다 업종(반도체 등) 요인이 큰 하락입니다.';
  else if (k >= -kDown && w <= -wWeak) read = '원화 강세와 함께 오른 상승입니다.';
  else if (w5 >= 1.5) read = '주가보다 원화 약세가 먼저 움직이고 있어, 환율이 다음 부담이 될 수 있습니다.';
  else read = '주가와 환율 모두 큰 쏠림은 없습니다.';
  const map = quad(0.5 + k / (daily ? 8 : 10), 0.5 + w / (daily ? 2 : 4), ['코스피 하락', '코스피 상승'], ['원화 강세', '원화 약세'], ['업종 요인 하락', '원화 강세 속 상승', '원화 약세 동반 하락', '환율 부담 속 상승']);
  const laterMove = later ? change(kospiAll, 1) : null;
  const after = later && Number.isFinite(laterMove) ? ` ${md(later.date)} 코스피는 하루 ${pct(laterMove)}였고, 같은 날 원/달러 종가는 아직 없어 둘을 묶어 읽지 않습니다.` : '';
  return { id: 'korea-won', title: '한국 증시와 원화', axes: ['korea'], asOf: anchor, text: `${numbers} ${read}${after}`, map };
}

/** The pairs that have their inputs, in reading order; each carries asOf, its last close's session. */
export function crossReadings({ history = [], macroHistory = null, day = null } = {}) {
  return [trendAndBreadth(history), volatilityAndSentiment(history, day, macroHistory), ratesAndCredit(history, macroHistory), koreaAndWon(history), depthReadout({ history, macroHistory })].filter(Boolean);
}
