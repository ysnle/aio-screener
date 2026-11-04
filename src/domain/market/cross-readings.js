// v59.66 (owner 2026-11-03, phase 4): 시장 상태 reads its indicators in pairs. "시장 폭만 본다고 해서 의미가 없듯이 다른 구조와
//같이 봐야 의미가 생긴다" — breadth means something against the index's own trend, sentiment against volatility and
// positioning, rates against credit, Korea against the won. Each pair is one plain reading of what the combination says,
// from closes and published series only (history.json, macro-history.json, market-day.json positioning).
import { readNumber, signedText } from '../shared/number.js';
import { RULES } from '../rules/thresholds.js';
import { sessionCloses } from './index-levels.js';

const pct = (value, digits = 1) => signedText(value, digits, '%');
const unit = (value) => Math.max(0.04, Math.min(0.96, value));
// v59.68: each pair is also a 2×2 map — x and y run 0..1 (left→right, bottom→top), the four cells name what that
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
function macroAt(macroHistory, id, date) {
  let hit = null;
  for (const [day, value] of macroHistory?.series?.[id]?.observations || []) if (day <= date && readNumber(value) !== null) hit = Number(value);
  return hit;
}

function trendAndBreadth(history) {
  const spx = sessionCloses(history, 'spx');
  const breadth = lastValue(history, 'breadth50');
  if (spx.length < 50 || breadth === null) return null;
  const ma50 = spx.slice(-50).reduce((sum, row) => sum + row.value, 0) / 50;
  const vs50 = (spx.at(-1).value / ma50 - 1) * 100;
  const b = Math.round(breadth);
  const below = vs50 < 0;
  let text;
  if (below && b >= 55) text = `S&P 500은 50일선 아래(${pct(vs50)})지만 구성 종목의 ${b}%는 아직 50일선 위입니다. 하락이 대형주 몇 곳에 몰린 조정이고 시장 전체가 무너진 것은 아닙니다. 이 비율이 50% 아래로 내려가면 약세가 넓게 퍼진 것으로 바뀝니다.`;
  else if (below && b < 45) text = `지수도 구성 종목도 함께 50일선 아래(종목 ${b}%만 위)입니다. 하락이 넓게 퍼져, 대형주 몇 곳의 문제가 아닙니다.`;
  else if (!below && b < 45) text = `지수는 50일선 위(${pct(vs50)})지만 구성 종목은 ${b}%만 50일선 위입니다. 소수 대형주가 받치는 좁은 상승이라, 그 종목들이 꺾이면 지수도 쉽게 밀립니다.`;
  else if (!below && b >= 55) text = `지수와 구성 종목 대부분(${b}%)이 함께 50일선 위입니다. 넓게 받쳐진 상승 추세입니다.`;
  else text = `지수는 50일선 ${below ? '아래' : '위'}(${pct(vs50)}), 구성 종목은 ${b}%가 50일선 위로 중간입니다. 폭이 아직 방향을 정하지 못했습니다.`;
  const rsp = sessionCloses(history, 'rsp');
  const gap = rsp.length > WINDOW ? change(rsp, WINDOW) - change(spx, WINDOW) : null;
  if (Number.isFinite(gap) && gap >= 3) text += ` 20거래일 동안 동일가중 지수가 ${gap.toFixed(1)}%p 앞서, 돈이 대형주에서 나머지 종목으로 옮겨 가고 있습니다.`;
  else if (Number.isFinite(gap) && gap <= -3) text += ` 20거래일 동안 동일가중 지수가 ${Math.abs(gap).toFixed(1)}%p 뒤처져, 대형주 쏠림이 더 심해졌습니다.`;
  const map = quad(0.5 + vs50 / 10, b / 100, ['지수 50일선 아래', '50일선 위'], ['종목 참여 적음', '종목 참여 많음'], ['넓은 하락', '좁은 상승', '좁은 조정', '넓은 상승']);
  return { id: 'trend-breadth', title: '추세와 시장 폭', axes: ['trend', 'breadth'], text, map };
}

function volatilityAndSentiment(history, day) {
  const vix = lastValue(history, 'vix'); const vix3m = lastValue(history, 'vix3m');
  const fg = lastValue(history, 'fg');
  if (vix === null) return null;
  const inverted = vix3m !== null && vix > vix3m;
  const numbers = [`VIX ${vix.toFixed(1)}${inverted ? '(3개월물보다 높아 단기 불안이 큰 상태)' : ''}`, fg !== null ? `공포·탐욕 지수 ${Math.round(fg)}` : null].filter(Boolean);
  const stressed = inverted || vix >= 25;
  const fearful = fg !== null && fg <= 25;
  let read;
  if (stressed && fearful) read = '지수 불안과 심리 공포가 함께 높습니다. 과거에는 이런 겹침 뒤 반등이 자주 나왔지만, 신용 스프레드가 같이 벌어지면 예외입니다.';
  else if (stressed) read = '지수 변동성은 커졌지만 심리 지표는 아직 극단 공포가 아닙니다. 투매형 바닥 신호로 보기는 이릅니다.';
  else if (fearful) read = `심리 지수는 극단 공포 쪽인데 VIX는 큰 하락 대비를 보이지 않습니다. 겁은 났지만 투매는 아닌 상태라, 공포만으로 바닥이라고 보기는 어렵습니다.`;
  else if (fg !== null && fg >= 75) read = '변동성은 낮고 심리는 과열 쪽입니다. 작은 악재에도 흔들리기 쉬운 자리입니다.';
  else read = '변동성과 심리 모두 중간 범위라, 어느 한쪽으로 치우친 신호는 없습니다.';
  const retail = (day?.facts || []).find((fact) => fact.kind === 'positioning' && fact.side === 'buy' && Number.isFinite(fact.leveragedLongShare));
  const crowd = retail && retail.leveragedLongShare >= 40
    ? ` 서학개미 순매수의 ${Math.round(retail.leveragedLongShare)}%가 레버리지 상품이라, 개인은 하락에도 사들이고 있습니다. 공포가 개인 투자자까지 번지지 않았다는 뜻이기도 합니다.` : '';
  const map = fg === null ? null : quad((vix - 12) / 24, 1 - fg / 100, ['VIX 낮음', 'VIX 높음'], ['심리 탐욕', '심리 공포'], ['과열', '흔들리는 강세', '겁만 난 상태', '투매형 공포']);
  return { id: 'volatility-sentiment', title: '변동성과 투자 심리', axes: ['volatility'], text: `${numbers.join(', ')}. ${read}${crowd}`, map };
}

function ratesAndCredit(history, macroHistory) {
  const tnx = sessionCloses(history, 'tnx');
  if (tnx.length <= WINDOW || !macroHistory) return null;
  const end = tnx.at(-1); const start = tnx.at(-1 - WINDOW);
  const yieldBp = (end.value - start.value) * 100;
  const hyEnd = macroAt(macroHistory, 'hyOas', end.date); const hyStart = macroAt(macroHistory, 'hyOas', start.date);
  if (hyEnd === null || hyStart === null) return null;
  const spreadBp = (hyEnd - hyStart) * 100;
  const widening = spreadBp >= RULES.credit.widen20dBp;
  const numbers = `20거래일 동안 미국 10년 금리 ${bp(yieldBp)}, 하이일드 스프레드 ${bp(spreadBp)}.`;
  let read;
  if (yieldBp <= -10 && widening) read = '안전한 국채로 돈이 몰리고 위험한 회사채는 팔리는, 성장 걱정형 조합입니다. 금리 하락이 호재로 읽히지 않는 이유입니다.';
  else if (yieldBp <= -10) read = '금리와 신용이 함께 안정돼, 돈 빌리는 비용이 전반적으로 낮아지는 완화형 조합입니다.';
  else if (yieldBp >= 10 && widening) read = '금리와 스프레드가 함께 올라, 긴축 부담이 위험자산으로 번지는 조합입니다.';
  else if (yieldBp >= 10) read = '금리는 올랐지만 신용은 차분해, 경기나 물가 쪽 금리 상승으로 읽힙니다.';
  else if (widening) read = '금리는 크게 움직이지 않았는데 스프레드만 벌어져, 신용 쪽 경계가 따로 커지고 있습니다.';
  else read = '금리와 신용 모두 큰 변화가 없습니다.';
  const map = quad(0.5 + yieldBp / 80, 0.5 + spreadBp / 80, ['금리 하락', '금리 상승'], ['스프레드 축소', '스프레드 확대'], ['완화', '경기·물가', '성장 걱정', '긴축 부담']);
  return { id: 'rates-credit', title: '금리와 신용', axes: ['rates', 'credit'], text: `${numbers} ${read}`, map };
}

function koreaAndWon(history) {
  const kospi = sessionCloses(history, 'kospi'); const krw = sessionCloses(history, 'usdkrw');
  const k5 = change(kospi, 5); const w5 = change(krw, 5);
  if (!Number.isFinite(k5) || !Number.isFinite(w5)) return null;
  // A day as large as a week (11/3: -3.6% inside a flat week) is read on the day; otherwise on the week.
  const k1 = change(kospi, 1); const w1 = change(krw, 1);
  const daily = Number.isFinite(k1) && Number.isFinite(w1) && Math.abs(k1) >= 2.5;
  const [k, w, kDown, wWeak, label] = daily ? [k1, w1, -2.5, 0.5, '하루'] : [k5, w5, -3, 1, '5거래일'];
  const numbers = daily ? `코스피 하루 ${pct(k1)}, 원/달러 ${pct(w1)}(5거래일 ${pct(k5)}, ${pct(w5)}).` : `${label} 동안 코스피 ${pct(k5)}, 원/달러 ${pct(w5)}.`;
  let read;
  if (k <= kDown && w >= wWeak) read = '원화가 약해지며 주가가 내려, 외국인 자금 이탈과 함께 움직이는 하락입니다.';
  else if (k <= kDown) read = '원화는 차분해, 환율보다 업종(반도체 등) 요인이 큰 하락입니다.';
  else if (k >= -kDown && w <= -wWeak) read = '원화 강세와 함께 오른, 외국인 자금이 들어오는 상승입니다.';
  else if (w5 >= 1.5) read = '주가보다 원화 약세가 먼저 움직이고 있어, 환율이 다음 부담이 될 수 있습니다.';
  else read = '주가와 환율 모두 큰 쏠림은 없습니다.';
  const map = quad(0.5 + k / (daily ? 8 : 10), 0.5 + w / (daily ? 2 : 4), ['코스피 하락', '코스피 상승'], ['원화 강세', '원화 약세'], ['업종 요인 하락', '외국인 유입', '자금 이탈형 하락', '환율 부담 속 상승']);
  return { id: 'korea-won', title: '한국 증시와 원화', axes: ['korea'], text: `${numbers} ${read}`, map };
}

/** The pairs that have their inputs, in reading order. */
export function crossReadings({ history = [], macroHistory = null, day = null } = {}) {
  return [trendAndBreadth(history), volatilityAndSentiment(history, day), ratesAndCredit(history, macroHistory), koreaAndWon(history)].filter(Boolean);
}
