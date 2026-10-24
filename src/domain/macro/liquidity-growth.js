// P1654 (owner 2026-10-12: fill free official data gaps): three supporting groups for the 거시 screen built only from
// public-data/macro-history.json (FRED raw observations). Each card states a dated value, one change over a named
// period and one reading; a series that has not been produced yet is left out instead of shown as "—".
// Expert review 2026-10-13 (M03-M06, M13, M14, M16, M22): the line draws the quantity the value states (PPI and GDP
// as growth rates, not index levels), the range under it uses the value's own format, the date names the period the
// observation covers (월 "8월분", 분기 "26년 2분기", 주 "10/7 주", 일 "10/6"), and a series past its cadence's normal
// delay carries a stale chip.
import { buildCloseSeries, closeBasis } from '../market/close-series.js';
import { RULES } from '../rules/thresholds.js';
import { sessionPointBack } from './rates-fx.js';
import { BRENT_WTI_SPREAD_HOLD_USD, brentWtiFromSeries, changeOverDays, MACRO_SIGNAL_RULES } from './macro-signals.js';
import { signedText } from '../shared/number.js';

const seriesOf = (macroHistory, field) => (macroHistory?.series?.[field]?.observations || [])
  .map(([date, value]) => ({ date, value: Number(value) }))
  .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.value))
  .sort((a, b) => a.date.localeCompare(b.date));

const atOrBefore = (series, date) => {
  let found = null;
  for (const row of series) { if (row.date <= date) found = row; else break; }
  return found;
};

const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
const pct = (now, then) => (then && then !== 0 ? (now / then - 1) * 100 : null);
const signed = (value, digits = 1, unit = '%') => (value == null || !Number.isFinite(value) ? null : signedText(value, digits, unit));
const fmt = (value, digits = 0) => value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Change against the observation closest to `days` calendar days earlier (never a later one).
function changeOver(series, days) {
  const last = series.at(-1);
  if (!last) return null;
  const target = new Date(Date.parse(last.date) - days * 86400000).toISOString().slice(0, 10);
  const then = atOrBefore(series, target);
  return then ? { then, last } : null;
}

// M13: the period an observation covers, by the series' declared cadence.
export function periodText(date, frequency) {
  const [year, month, day] = String(date || '').split('-').map(Number);
  if (!year || !month) return '';
  if (frequency === 'quarterly') return `${String(year).slice(2)}년 ${Math.floor((month - 1) / 3) + 1}분기`;
  if (frequency === 'monthly') return `${month}월분`;
  if (frequency === 'weekly') return `${month}/${day} 주`;
  return `${month}/${day}`;
}

// M14: calendar days after the period's first day beyond which a new observation should already exist
// (daily FRED series run 1-2 sessions behind, plus a weekend and a holiday; a monthly release lands within about six weeks of the month's end;
// a quarterly GDP estimate within about a month of the quarter's end, plus one more quarter of tolerance).
export const STALE_AFTER_DAYS = Object.freeze({ daily: 6, weekly: 14, monthly: 100, quarterly: 200 });
export function isStaleObservation(date, frequency, referenceMs) {
  const limit = STALE_AFTER_DAYS[frequency];
  if (!limit || !date || !Number.isFinite(referenceMs)) return false;
  return (referenceMs - Date.parse(`${date}T00:00:00Z`)) / 86400000 > limit;
}

// Net liquidity in USD billions: Fed total assets minus the Treasury General Account minus overnight reverse repo,
// each taken on or before the Fed balance-sheet date (weekly Wednesday levels).
export function netLiquiditySeries(macroHistory) {
  const assets = seriesOf(macroHistory, 'fedBalanceSheet');
  const tga = seriesOf(macroHistory, 'treasuryAccount');
  const rrp = seriesOf(macroHistory, 'reverseRepo');
  if (!assets.length || !tga.length || !rrp.length) return [];
  return assets.map((row) => {
    const t = atOrBefore(tga, row.date);
    const r = atOrBefore(rrp, row.date);
    if (!t || !r || daysBetween(t.date, row.date) > 7 || daysBetween(r.date, row.date) > 7) return null;
    return { date: row.date, value: row.value / 1000 - t.value / 1000 - r.value };
  }).filter(Boolean);
}

// M05 (coordinator decision 2026-10-13): a 4-week net-liquidity change inside ±1,000억 달러 (USD 100bn) has no direction.
export const NET_LIQUIDITY_FLAT_BN = 100;

/** M03: year-over-year % for each month that has the same month one year earlier. */
export function monthlyYoySeries(series) {
  const byMonth = new Map(series.map((row) => [row.date.slice(0, 7), row.value]));
  return series.map((row) => {
    const [year, month] = row.date.split('-');
    const base = byMonth.get(`${Number(year) - 1}-${month}`);
    return base ? { date: row.date, value: (row.value / base - 1) * 100 } : null;
  }).filter(Boolean);
}

/** M04: quarter-over-quarter growth at an annual rate, for each quarter whose previous quarter is present. */
export function annualizedQuarterlySeries(series) {
  return series.map((row, index) => {
    const prev = series[index - 1];
    if (!prev || prev.value <= 0 || daysBetween(prev.date, row.date) > 100) return null;
    return { date: row.date, value: ((row.value / prev.value) ** 4 - 1) * 100 };
  }).filter(Boolean);
}

/** M06: Brent against WTI on their latest common date, and both 20-session changes over the same span of sessions.
 *  P1726 (R1 2026-10-13): Brent futures closes (BZ=F, same contract type as the CL=F WTI series) live in history.json as
 *  `brent` and are the comparison source. The FRED series is dated European spot Brent; spot against a WTI future is a
 *  basis mix (10/6: spot 125.44 vs future 100.58 made a $36 "spread"), so with spot only no spread or Brent/WTI
 *  divergence is drawn — the spot level is quoted as a reference with its basis named. */
export { BRENT_WTI_SPREAD_HOLD_USD };
export function brentWtiCheck(macroHistory, history = []) {
  const basis = closeBasis(history);
  const wti = buildCloseSeries(history, 'wti', { through: basis });
  const futures = buildCloseSeries(history, 'brent', { through: basis });
  if (!wti.length) return null;
  if (futures.length < 2) {
    const spot = seriesOf(macroHistory, 'brent');
    const lastSpot = spot.at(-1);
    if (!lastSpot) return null;
    const s0 = sessionPointBack(spot, 20);
    const spot20 = s0 ? pct(lastSpot.value, s0.value) : null;
    const [, sm, sd] = lastSpot.date.split('-').map(Number);
    return { date: lastSpot.date, brent: lastSpot.value, wti: null, spread: null, spreadMedian: null, brent20: spot20, wti20: null, diverges: false, abnormal: false, basis: 'spot',
      sentence: `브렌트 선물 종가 기록이 아직 없어 유럽 현물 브렌트(${sm}/${sd} ${fmt(lastSpot.value, 2)}달러${spot20 == null ? '' : `, 20거래일 ${signed(spot20, 1)}`})만 참고합니다 — 현물과 WTI 선물은 가격 기준이 달라 둘의 차이를 비교하거나 WTI 판단을 바꾸는 근거로 쓰지 않습니다.` };
  }
  // v57.81: the spread, both 20-session moves and the divergence verdict come from the one shared rule (macro-signals.js)
  // that the 거시 chain, the rate hub, the scenario conditions and 시장 달러·원자재 all read.
  const check = brentWtiFromSeries({ brent: futures, wti, pointBack: sessionPointBack });
  if (!check) return null;
  const { spread, spreadMedian, brent20, wti20, diverges, abnormal } = check;
  const [, month, day] = check.date.split('-').map(Number);
  const md = `${month}/${day}`;
  // P1726: even between the two futures, a same-day gap above $15 is outside the range where the series have been
  // comparable (one-year median about $6) — a roll mismatch or a source error. The spread and the Brent-based reading
  // are held instead of explained.
  // Macro audit 2026-10-17: the divergence case is WTI rising less than half as much as Brent, not WTI falling.
  const heldTail = diverges ? ' — 국제 유가는 크게 오르는데 WTI는 그 절반도 오르지 않아, WTI로 유가 방향이나 물가 완화를 읽는 판단은 보류합니다.'
    : check.held ? ` — ${check.text.split(' — ').slice(1).join(' — ')}` : '.';
  const sentence = abnormal
    ? `같은 날(${md}) 브렌트 선물 ${fmt(check.brent, 2)}달러, WTI 선물 ${fmt(check.wti, 2)}달러로 차이가 ${fmt(spread, 1)}달러입니다 — 최근 1년 같은 날 차이의 중앙값(${spreadMedian == null ? '—' : fmt(spreadMedian, 1)}달러)과 동떨어져 두 가격의 기준이 다르거나 원천 오류일 수 있습니다. 차이의 해석과 브렌트 기준 판단, WTI 하락을 물가 완화로 읽는 판단을 모두 보류합니다.`
    : `같은 날(${md}) 브렌트 선물 ${fmt(check.brent, 2)}달러, WTI 선물 ${fmt(check.wti, 2)}달러로 차이가 ${fmt(spread, 1)}달러입니다(최근 1년 같은 날 차이의 중앙값 ${spreadMedian == null ? '—' : fmt(spreadMedian, 1)}달러${check.spread20Back == null ? '' : `, 20거래일 전 ${fmt(check.spread20Back, 1)}달러`}). ${md}까지 20거래일 기준 브렌트 ${signed(brent20, 1) ?? '—'}, WTI ${signed(wti20, 1) ?? '—'}${heldTail}`;
  return { ...check, sentence };
}

function card({ id, label, series, valueText, changeText, reading, unit = '', asOf, frequency, referenceMs, format }) {
  return { id, label, series: series.slice(-104), valueText, changeText, reading, unit, asOf, frequency, period: periodText(asOf, frequency), stale: isStaleObservation(asOf, frequency, referenceMs), format };
}

const frequencyOf = (macroHistory, field, fallback) => macroHistory?.series?.[field]?.frequency || fallback;

function liquidityGroup(macroHistory, { macro, referenceMs }) {
  const items = [];
  const net = netLiquiditySeries(macroHistory);
  const netChange = changeOver(net, 28);
  if (net.length >= 6) {
    const d = netChange ? netChange.last.value - netChange.then.value : null;
    const weekly = net.slice(-53).slice(1).map((row, index) => Math.abs(row.value - net.slice(-53)[index].value));
    const typicalWeek = median(weekly);
    const typical = typicalWeek == null ? '' : ` 한 주 변동의 1년 중앙값만 약 ${fmt(typicalWeek * 10, 0)}억 달러입니다.`;
    const toTrillion = (value) => `${fmt(value / 1000, 2)}조 달러`;
    items.push(card({ id: 'netLiquidity', label: '순유동성 (연준 자산 − 재무부 계좌 TGA − 역레포)', series: net, asOf: net.at(-1).date, frequency: 'weekly', referenceMs, format: toTrillion,
      valueText: toTrillion(net.at(-1).value),
      // d is in USD billions; 1 billion = 10억.
      changeText: d == null ? null : `4주 ${d >= 0 ? '+' : ''}${fmt(d * 10, 0)}억 달러`,
      reading: d == null ? '4주 비교 관측이 부족합니다.'
        : Math.abs(d) < NET_LIQUIDITY_FLAT_BN ? `4주 변화가 ±1,000억 달러 안쪽이라 뚜렷한 방향이 없습니다.${typical} 재무부 계좌·역레포 출렁임보다 작은 변화는 유동성 방향으로 읽지 않습니다.`
          : d > 0 ? '4주 동안 시장에 풀린 달러가 1,000억 달러 넘게 늘었습니다. 위험자산에 우호적인 배경이 되기 쉽지만 지수 방향을 단독으로 정하지는 않습니다.'
            : '4주 동안 시장에 풀린 달러가 1,000억 달러 넘게 줄었습니다. 유동성이 빠질 때는 고평가·고변동 종목이 먼저 흔들리는 경향이 있습니다.' }));
  }
  const nfci = seriesOf(macroHistory, 'financialConditions');
  if (nfci.length >= 6) {
    // v57.81: the same 4-week window as the 신용 경색 condition (macro-signals changeOverDays).
    const last = nfci.at(-1); const c = changeOverDays(nfci, MACRO_SIGNAL_RULES.nfciWindowDays);
    const move = c ? c.last.value - c.then.value : null;
    const level = last.value < 0 ? '0보다 낮아 평균보다 돈을 빌리기 쉬운 여건입니다.' : '0보다 높아 평균보다 금융 여건이 빡빡합니다. 신용 스프레드와 함께 확인합니다.';
    const direction = move == null ? '' : move > 0 ? ` 4주 동안 ${signed(move, 2, '')} 올라 조여지는 쪽으로 움직였습니다.` : move < 0 ? ` 4주 동안 ${signed(move, 2, '')} 내려 풀리는 쪽으로 움직였습니다.` : ' 4주 동안 변화가 없습니다.';
    items.push(card({ id: 'nfci', label: '금융여건지수 (시카고 연은)', series: nfci, asOf: last.date, frequency: frequencyOf(macroHistory, 'financialConditions', 'weekly'), referenceMs, format: (value) => fmt(value, 2),
      valueText: fmt(last.value, 2), changeText: c ? `4주 ${signed(move, 2, '')}` : null,
      reading: `${level}${direction}` }));
  }
  const sofr = seriesOf(macroHistory, 'sofr');
  if (sofr.length >= 6) {
    const last = sofr.at(-1);
    // M22: the target range the reading refers to, on the SOFR date.
    const upper = atOrBefore(seriesOf(macroHistory, 'fedTargetUpper'), last.date)?.value ?? (Number.isFinite(Number(macro?.fedTargetUpper)) ? Number(macro.fedTargetUpper) : null);
    const lower = upper == null ? null : Number.isFinite(Number(macro?.fedTargetLower)) && Number(macro?.fedTargetUpper) === upper ? Number(macro.fedTargetLower) : upper - 0.25;
    const range = upper == null ? null : `${lower.toFixed(2)}–${upper.toFixed(2)}%`;
    const where = upper == null ? null : last.value > upper ? `목표 범위 ${range} 위 ${((last.value - upper) * 100).toFixed(0)}bp` : last.value < lower ? `목표 범위 ${range} 아래 ${((lower - last.value) * 100).toFixed(0)}bp` : `목표 범위 ${range} 안`;
    items.push(card({ id: 'sofr', label: 'SOFR 단기 자금 금리', series: sofr, asOf: last.date, unit: '%', frequency: frequencyOf(macroHistory, 'sofr', 'daily'), referenceMs, format: (value) => `${fmt(value, 2)}%`,
      valueText: `${fmt(last.value, 2)}%`, changeText: where,
      reading: '은행 간 하루짜리 담보 대출 금리입니다. 연준 목표 범위를 벗어나 튀면 단기 자금 시장의 긴장 신호로 봅니다.' }));
  }
  return { id: 'liquidity', title: '유동성, 금융 여건', fact: '시장에 풀린 달러와 돈을 빌리는 조건 — 위험자산 가격의 배경입니다.', items };
}

function growthGroup(macroHistory, { referenceMs }) {
  const items = [];
  const gdp = seriesOf(macroHistory, 'realGdp');
  const growth = annualizedQuarterlySeries(gdp);
  if (gdp.length >= 3 && growth.length) {
    const last = growth.at(-1); const prev = growth.at(-2);
    const quarter = periodText(last.date, 'quarterly');
    items.push(card({ id: 'realGdp', label: '실질 GDP 성장률 (전기 대비 연율)', series: growth.length >= 6 ? growth : [], asOf: last.date, unit: '%', frequency: 'quarterly', referenceMs, format: (value) => signed(value, 1),
      valueText: signed(last.value, 1), changeText: prev ? `직전 분기 ${signed(prev.value, 1)}` : null,
      reading: last.value >= 2 ? `${quarter} 성장은 잠재 성장(약 2%) 이상이었습니다. 그 뒤 고용 흐름은 위 국면 지도가 더 최신입니다.` : last.value >= 0 ? `${quarter} 성장은 이어졌지만 잠재 성장(약 2%)보다 느립니다.` : `${quarter} 성장이 마이너스입니다 — 경기 둔화가 실제 생산으로 나타난 구간입니다.` }));
  }
  const jolts = seriesOf(macroHistory, 'jobOpenings');
  if (jolts.length >= 6) {
    const c = changeOver(jolts, 365);
    const toMillions = (value) => `${Math.round(value / 10).toLocaleString('en-US')}만 건`; // v57.91: thousands -> 만 건 (7,080 -> 708만 건)
    items.push(card({ id: 'jobOpenings', label: '구인 건수 (JOLTS)', series: jolts, asOf: jolts.at(-1).date, frequency: 'monthly', referenceMs, format: toMillions,
      valueText: toMillions(jolts.at(-1).value), changeText: c ? `1년 ${signed(pct(c.last.value, c.then.value))}` : null,
      reading: '기업이 채우려는 일자리 수입니다. 꾸준히 줄면 고용 둔화가 실업률보다 먼저 나타납니다.' }));
  }
  const sentiment = seriesOf(macroHistory, 'consumerSentiment');
  if (sentiment.length >= 6) {
    const c = changeOver(sentiment, 92);
    items.push(card({ id: 'consumerSentiment', label: '미시간대 소비자심리', series: sentiment, asOf: sentiment.at(-1).date, frequency: 'monthly', referenceMs, format: (value) => fmt(value, 1),
      valueText: fmt(sentiment.at(-1).value, 1), changeText: c ? `3개월 ${signed(c.last.value - c.then.value, 1, '')}` : null,
      reading: '가계가 느끼는 경기와 물가 부담입니다. 심리는 실제 소비보다 먼저 움직이지만 소비와 어긋나는 때도 많습니다.' }));
  }
  const ppi = monthlyYoySeries(seriesOf(macroHistory, 'ppiFinalDemand'));
  if (ppi.length >= 2) {
    const last = ppi.at(-1);
    const back = changeOver(ppi, 92);
    items.push(card({ id: 'ppiFinalDemand', label: '생산자물가 (최종수요, 전년 대비)', series: ppi.length >= 6 ? ppi : [], asOf: last.date, unit: '%', frequency: 'monthly', referenceMs, format: (value) => signed(value, 1),
      valueText: signed(last.value, 1), changeText: back ? `3개월 전 ${signed(back.then.value, 1)}` : null,
      reading: '기업이 받는 가격입니다. 생산자물가가 오르면 몇 달 뒤 소비자물가나 기업 마진에 압력이 됩니다.' }));
  }
  return { id: 'growth', title: '성장, 고용 선행', fact: '분기 성장, 일자리 수요, 가계 심리, 기업 가격 — 경기의 다음 방향을 미리 보는 지표입니다.', items };
}

function commodityFxGroup(macroHistory, { referenceMs }) {
  const items = [];
  const add = (field, label, digits, unitText, reading, extra = null, { spot = false } = {}) => {
    const s = seriesOf(macroHistory, field);
    if (s.length < 6) return;
    const frequency = frequencyOf(macroHistory, field, 'daily');
    // M06: a daily series changes over 20 exchange sessions (the WTI span on the same screen); a monthly one over a month.
    const daily = frequency === 'daily';
    const back = daily ? sessionPointBack(s, 20) : changeOver(s, 30)?.then;
    const format = (value) => `${fmt(value, digits)}${unitText}`;
    const [, month, day] = s.at(-1).date.split('-').map(Number);
    // A spot card names its basis and end date on the change, so it is not read as the futures span beside it.
    const span = daily ? (spot ? `현물, ${month}/${day}까지 20거래일` : '20거래일') : '1개월';
    const item = card({ id: field, label, series: s, asOf: s.at(-1).date, frequency, referenceMs, format, valueText: format(s.at(-1).value),
      changeText: back ? `${span} ${signed(pct(s.at(-1).value, back.value))}` : null, reading: extra ? `${reading} ${extra}` : reading });
    // v57.81: the card face names its basis with its date ("10/6 현물 기준"), so a days-behind spot value is not read
    // as contradicting the same-day futures close shown elsewhere (10/15: spot 125.44 @10/6 vs futures 106.06 @10/15).
    if (spot) { item.period = `${item.period} 현물 기준`; item.basis = 'spot'; }
    items.push(item);
  };
  // P1726: this card is the FRED dated European spot series; its basis is named and it is not set against the WTI future.
  // The Brent-WTI futures comparison sentence is shown once, under the WTI chart on the same screen (macro-board.js).
  add('brent', '브렌트유 (유럽 현물)', 2, '달러', '국제 유가 기준인 유럽 현물 가격입니다. 현물 값은 선물 종가보다 며칠 늦게 공표되고 가격 기준도 달라, 아래 WTI 차트의 브렌트 선물 종가와 숫자가 다를 수 있습니다(WTI와의 비교는 같은 선물 종가끼리만 합니다).', null, { spot: true });
  add('natGas', '천연가스 (헨리허브)', 2, '달러', '전기·난방·화학 원가입니다. 겨울철과 수출 수요에 크게 흔들립니다.');
  add('copper', '구리 (월평균)', 0, '달러/톤', '건설·전력망·전기차에 쓰여 경기 체력을 비추는 금속입니다. 데이터센터 전력 투자와도 연결됩니다.');
  add('usdCny', '위안 / 달러', 3, '위안', '오르면 위안화 약세입니다. 중국 경기와 아시아 통화(원화 포함)가 같은 방향으로 움직이는 경향이 있습니다.');
  return { id: 'commodities-fx', title: '원자재, 아시아 통화', fact: '유가 외 에너지, 산업 금속, 위안화 — 물가와 한국 시장에 닿는 경로입니다.', items };
}

// referenceMs: the time staleness is judged against (now on screen; fixed in tests).
export function buildLiquidityGrowthGroups(macroHistory, { macro = null, history = [], referenceMs = Date.now() } = {}) {
  const context = { macro, referenceMs, oil: brentWtiCheck(macroHistory, history) };
  return [liquidityGroup(macroHistory, context), growthGroup(macroHistory, context), commodityFxGroup(macroHistory, context)].filter((group) => group.items.length);
}
