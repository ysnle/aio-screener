// v59.56 (handoff item 3, owner 11/1 "찾기 힘든 정보를 가공해 쉽게"): why the won moved — how much of the last 20 sessions'
// 원/달러 move the dollar's own move explains, and how much is left for Korea. The won's usual sensitivity to the dollar
// index is the least-squares slope of 5-session % changes over the past year of shared closes (history.json, completed
// closes only; daily changes are blurred because the two closes are stamped at different hours); the dollar's share is that slope times the dollar index's 20-session move, the rest is the Korea share.
// It is a split of one past move, not a forecast, and the slope changes over time (the fold says how well it fit).
import { buildCloseSeries, closeBasis, sessionPointBack } from '../market/session/close-series.js';
import { MARKET_WINDOWS, closeChange } from '../market/session/market-windows.js';
import { signedText } from '../shared/number.js';

export const KRW_RULE = Object.freeze({ sessions: MARKET_WINDOWS.rule, fitSessions: 250, step: MARKET_WINDOWS.week, minFit: 30, quietPct: 1 });

const pct = (to, from) => (to / from - 1) * 100;
const signed = (value, digits = 1) => signedText(value, digits, '%');
const shortDate = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };

function joined(history, through) {
  const krw = new Map(buildCloseSeries(history, 'usdkrw', { through }).map((row) => [row.date, row.value]));
  const kospi = new Map(buildCloseSeries(history, 'kospi', { through }).map((row) => [row.date, row.value]));
  return buildCloseSeries(history, 'dxy', { through })
    .filter((row) => krw.has(row.date) && row.value > 0 && krw.get(row.date) > 0)
    .map((row) => ({ date: row.date, dxy: row.value, krw: krw.get(row.date), kospi: kospi.get(row.date) ?? null }));
}

function slope(rows) {
  const xs = []; const ys = [];
  const step = KRW_RULE.step;
  for (let i = rows.length - 1; i >= step; i -= step) { xs.push(pct(rows[i].dxy, rows[i - step].dxy)); ys.push(pct(rows[i].krw, rows[i - step].krw)); }
  const n = xs.length;
  if (n < KRW_RULE.minFit) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n; const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0; let sxx = 0; let syy = 0;
  for (let i = 0; i < n; i += 1) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  if (!(sxx > 0) || !(syy > 0)) return null;
  return { beta: sxy / sxx, r2: (sxy * sxy) / (sxx * syy), days: n * step, windows: n };
}

/** @returns {{available:boolean, reason?:string, ...}} */
export function buildKrwDecomposition(history = [], { through = undefined } = {}) {
  const basis = through === undefined ? closeBasis(history) : through;
  const rows = joined(Array.isArray(history) ? history : [], basis);
  const n = KRW_RULE.sessions;
  if (rows.length <= n + KRW_RULE.minFit * KRW_RULE.step) return { available: false, reason: '원/달러와 달러 지수 종가가 함께 쌓인 기록이 부족해 나누어 보지 않습니다.' };
  const fit = slope(rows.slice(-1 - n - KRW_RULE.fitSessions, -n));
  if (!fit) return { available: false, reason: '과거 1년 원/달러와 달러 지수의 관계를 계산하지 못했습니다.' };
  // The moves use each series' own 20-session window, the same count as the 원/달러 and 달러 지수 cards below
  // (rates-fx.js fxCard), so the block and the cards print one number for one label.
  const move = (id) => {
    const series = buildCloseSeries(history, id, { through: basis });
    const last = series.at(-1); const back = sessionPointBack(series, n);
    return last && back && back.value > 0 ? { from: back.date, to: last.date, pct: pct(last.value, back.value) } : null;
  };
  // v59.70 (re-review N2): the KOSPI leg is its own 20 Korean sessions, the one KOSPI 20-session change 매크로 and 시장 상태
  // quote (-19.3%); counted in the won's US sessions it read -18.6% for the same label.
  // It ends on the latest Korean close, not the US basis: after the Korean close and before the US one, clamping it to
  // the SPX date dropped Monday's KOSPI session and printed a second 20-session number.
  const krw = move('usdkrw'); const dxy = move('dxy'); const kospiChange = closeChange(history, 'kospi', n, { through: through === undefined ? null : through });
  const kospi = kospiChange ? { pct: kospiChange.pct } : null;
  if (!krw || !dxy) return { available: false, reason: '원/달러와 달러 지수의 20거래일 변화를 계산하지 못했습니다.' };
  const start = { date: krw.from }; const end = { date: krw.to };
  const krwMove = krw.pct;
  const dxyMove = dxy.pct;
  const dollarPart = fit.beta * dxyMove;
  const koreaPart = krwMove - dollarPart;
  const kospiMove = kospi ? kospi.pct : null;
  const quiet = KRW_RULE.quietPct;
  const wonWord = krwMove > 0 ? '원화 약세' : krwMove < 0 ? '원화 강세' : '변화 없음';
  let driver;
  if (Math.abs(krwMove) < quiet && Math.abs(koreaPart) < quiet) driver = 'quiet';
  else if (Math.abs(koreaPart) < quiet || Math.abs(dollarPart) >= Math.abs(koreaPart) * 2) driver = 'dollar';
  else if (Math.abs(dollarPart) < quiet || Math.abs(koreaPart) >= Math.abs(dollarPart) * 2) driver = 'korea';
  else driver = 'both';
  const lead = `${shortDate(start.date)}→${shortDate(end.date)} ${n}거래일, 원/달러 ${signed(krwMove)}(${wonWord}), 달러 지수 ${signed(dxyMove)}.`;
  const why = {
    quiet: '원화는 평소 범위 안에서 움직였습니다. 환율이 한국 주식의 부담이나 힘이 되지 않은 구간입니다.',
    dollar: `원화가 평소 달러 지수에 반응하는 크기(${fit.beta.toFixed(2)}배)로 보면 대부분 달러 전체의 움직임입니다. 원화만의 이유로 읽을 근거는 약합니다.`,
    korea: koreaPart > 0
      ? `달러 흐름으로 설명되는 몫은 ${signed(dollarPart)}뿐이고 ${signed(koreaPart)}는 달러로 설명되지 않습니다. 외국인 매도, 수출 둔화, 정책 차이 같은 원화 고유 요인일 가능성을 봐야 합니다.`
      : `달러 흐름으로 설명되는 몫은 ${signed(dollarPart)}이고 원화는 그보다 ${Math.abs(koreaPart).toFixed(1)}%p 더 강했습니다. 수출 대금, 외국인 자금, 당국 대응처럼 원화를 받친 고유 요인이 있었을 가능성이 있습니다.`,
    both: `달러 몫 ${signed(dollarPart)}과 달러로 설명되지 않는 몫 ${signed(koreaPart)}이 함께 움직였습니다. 달러 전체 흐름과 원화 고유 요인을 같이 봐야 합니다.`
  }[driver];
  let stocks = '';
  if (kospiMove != null) {
    if (koreaPart >= 1 && kospiMove < 0) stocks = `코스피 ${n}거래일 ${signed(kospiMove)} — 원화 고유 약세와 주가 약세가 겹쳐 외국인 이탈 가능성을 확인할 구간입니다.`;
    else if (koreaPart <= -1 && kospiMove > 0) stocks = `코스피 ${n}거래일 ${signed(kospiMove)} — 원화 강세와 주가 강세가 겹쳐 외국인 유입 쪽 그림입니다.`;
    else if (koreaPart <= -1 && kospiMove <= -5) stocks = `코스피 ${n}거래일 ${signed(kospiMove)} — 원화는 강했는데 주가는 크게 내려, 환율이 하락의 이유는 아닙니다. 하락의 원인은 업종과 실적 쪽에서 찾습니다.`;
    else if (koreaPart >= 1 && kospiMove >= 5) stocks = `코스피 ${n}거래일 ${signed(kospiMove)} — 원화가 약한데도 주가가 올라, 환율 부담보다 다른 힘이 컸습니다.`;
    else if (Math.abs(koreaPart) < 1 && Math.abs(kospiMove) >= 5) stocks = `코스피 ${n}거래일 ${signed(kospiMove)} — 원화가 크게 흔들리지 않아 환율은 이 움직임의 이유가 아닙니다.`;
    else stocks = `코스피는 ${n}거래일 ${signed(kospiMove)}입니다.`;
  }
  return {
    available: true, from: start.date, to: end.date, sessions: n,
    krwMove, dxyMove, dollarPart, koreaPart, kospiMove, beta: fit.beta, r2: fit.r2, fitDays: fit.days, driver,
    lead, why, stocks,
    method: `원/달러 5거래일 변화율을 달러 지수 5거래일 변화율에 회귀한 기울기입니다(직전 ${fit.days}거래일을 ${fit.windows}개 구간으로, 이번 ${n}거래일 제외). 두 종가의 마감 시각이 달라 하루 단위로는 관계가 흐려집니다. 달러 지수가 1% 움직일 때 원/달러는 평균 ${fit.beta.toFixed(2)}% 움직였고, 이 관계가 원/달러 5거래일 변화의 ${Math.round(fit.r2 * 100)}%를 설명했습니다. 달러 몫 = 기울기 × 달러 지수 ${n}거래일 변화, 달러로 설명되지 않는 몫 = 원/달러 변화 − 달러 몫(다른 통화의 움직임과 계산 오차도 들어 있습니다). 설명력이 낮을수록 나눈 값의 신뢰도도 낮습니다. 달러 지수에는 원화가 들어 있지 않아 달러 전체 흐름의 대리 지표로 씁니다. 달러로 설명되지 않는 몫이 어떤 이유(수출, 외국인 자금, 당국 대응 등)에서 나왔는지는 이 계산으로 가리지 않습니다.`
  };
}
