// P1389: the briefing's "connected read". Owner review 2026-10-02: the briefing restated numbers
// (S&P x, VIX y, WTI z) in five places and never connected them. This pure module turns the
// completed-close history into cross-asset statements — rates vs equities, index vs breadth,
// fear gauge vs credit, dollar vs gold, oil vs yields, Korea vs the US — each citing its numbers.
// Rules are descriptive (what the tape shows), never a trade instruction, and a rule whose
// inputs are missing stays silent instead of guessing.
// P1399 (Codex review 2026-10-03): every input is aligned to one basis — the S&P 500's last
// completed close. Later observations (an in-session snapshot) are dropped, older ones carry their
// lag and are excluded once stale; missing is never read as calm or as stress; a statement keeps
// the observation (text) apart from the interpretation (reading), which is worded as a hypothesis.

import { RULES } from '../rules/thresholds.js';

const DAY_MS = 86400000;

function finite(value) {
  if (value == null || typeof value === 'boolean') return null; // Number(null) is 0, not a reading
  const number = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
  return Number.isFinite(number) ? number : null;
}

// A date-only stamp (YYYY-MM-DD or midnight UTC) already names the trading date; converting
// midnight UTC to New York would move it to the previous day.
// P1432: toLocaleDateString builds a time-zone formatter on every call, and this runs for every
// row × field of the close history on each render (≈0.5 s per regime build); one shared formatter
// plus a small memo keeps the same result at a fraction of the cost.
const NY_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
const NY_DATE_MEMO = new Map();
function nyDate(iso) {
  const text = String(iso || '');
  if (/^\d{4}-\d{2}-\d{2}$/.test(text) || /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/.test(text)) return text.slice(0, 10);
  if (NY_DATE_MEMO.has(text)) return NY_DATE_MEMO.get(text);
  const ms = Date.parse(text);
  const date = Number.isFinite(ms) ? NY_DATE.format(new Date(ms)) : null;
  if (NY_DATE_MEMO.size > 20000) NY_DATE_MEMO.clear();
  NY_DATE_MEMO.set(text, date);
  return date;
}

// One value per trading date. The producer stamps a close either near the bell or at its bar start,
// and a later row can carry a late-settling bar (DXY/WTI); key by the observation's own NY date and
// let the later row win. Carried-forward weekend copies are not observations. `through` drops
// observations after the basis date.
export function buildCloseSeries(history = [], field, { through = null } = {}) {
  const byDate = new Map();
  const rows = [...(Array.isArray(history) ? history : [])].sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));
  for (const row of rows) {
    const value = finite(row?.[field]);
    if (value == null || (value <= 0 && !/^(breadth|advance|distribution)/.test(field))) continue; // a 0 yield/price is a producer gap, not a close (a 0 count is real)
    const meta = row.fieldMeta?.[field];
    if (meta?.observationRelation === 'carried-forward') continue;
    const date = meta?.observedAt ? nyDate(meta.observedAt) : row.date;
    if (date && (!through || date <= through)) byDate.set(date, value);
  }
  return [...byDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, value]) => ({ date, value }));
}

// The common reference: the S&P 500's last completed close.
export function closeBasis(history = []) {
  const spx = buildCloseSeries(history, 'spx');
  return spx.length ? spx[spx.length - 1].date : null;
}

function sessionsBetween(from, to) {
  let count = 0;
  let cursor = Date.parse(`${from}T12:00:00Z`);
  const end = Date.parse(`${to}T12:00:00Z`);
  while (cursor < end) {
    cursor += DAY_MS;
    const day = new Date(cursor).getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

/** How one input's observation date relates to the basis: aligned · lagged · stale · ahead · missing. */
export function alignInput(date, basis, maxLag = 2) {
  const day = date ? nyDate(date) : null;
  if (!day) return { status: 'missing', date: null, lag: null };
  if (!basis) return { status: 'aligned', date: day, lag: 0 };
  if (day > basis) return { status: 'ahead', date: day, lag: 0 };
  const lag = sessionsBetween(day, basis);
  return { status: lag === 0 ? 'aligned' : lag <= maxLag ? 'lagged' : 'stale', date: day, lag };
}

export const isUsable = (alignment) => alignment?.status === 'aligned' || alignment?.status === 'lagged';

function shortDate(date) {
  const [, month, day] = String(date || '').split('-').map(Number);
  return month && day ? `${month}/${day}` : '';
}

/** One short basis chip per card: "9/30", "9/29 · 1거래일 전", "9/24 · 오래됨(판정 제외)". */
export function alignmentLabel(alignment) {
  if (!alignment || alignment.status === 'missing') return '미수신';
  const day = shortDate(alignment.date);
  if (alignment.status === 'aligned') return day;
  if (alignment.status === 'lagged') return `${day} · ${alignment.lag}거래일 전`;
  if (alignment.status === 'ahead') return `${day} 장중 · 판정 제외`;
  return `${day} · 오래됨(판정 제외)`;
}

function stats(series) {
  if (!series.length) return null;
  const last = series[series.length - 1];
  // P1428 (Codex review): n observations are n sessions only when no day is missing. If the weekday span
  // to that point exceeds n plus holiday slack, the producer skipped days and the "5일/20일" change is
  // withheld rather than silently covering a longer period.
  const back = (n) => {
    if (series.length <= n) return null;
    const point = series[series.length - 1 - n];
    return sessionsBetween(point.date, last.date) > n + Math.max(2, Math.ceil(n * 0.15)) ? null : point.value;
  };
  const year = series.filter((point) => Date.parse(point.date) >= Date.parse(last.date) - 365 * DAY_MS).map((point) => point.value);
  const mean = (n) => series.length >= n ? series.slice(-n).reduce((sum, point) => sum + point.value, 0) / n : null;
  const max = Math.max(...year);
  const min = Math.min(...year);
  return {
    date: last.date, value: last.value, d1: back(1), d5: back(5), d20: back(20),
    yearMax: max, yearMin: min, yearPosition: max > min && year.length >= 120 ? (last.value - min) / (max - min) : null,
    ma50: mean(50), ma200: mean(200)
  };
}

const pct = (now, then) => now != null && then ? (now / then - 1) * 100 : null;
const bp = (now, then) => now != null && then != null ? (now - then) * 100 : null;
const signed = (value, digits = 1, unit = '%') => value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(digits)}${unit}`;
const fmt = (value, digits = 2) => value == null ? '—' : value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });

const SERIES_FIELDS = ['spx', 'nasdaq', 'rut', 'vix', 'vix3m', 'tnx', 'dxy', 'wti', 'gold', 'kospi', 'usdkrw', 'usdjpy', 'breadth50', 'breadth20', 'breadth200', 'advanceRatio',
  // P1416: leadership and index-confirmation evidence (src/domain/market/breadth-signals.js).
  'breadth40', 'breadthNewHighs', 'breadthNewLows', 'breadthUp4', 'breadthDown4', 'distributionDays'];

/**
 * The input contract shared by the briefing read, the regime board and the sentiment board.
 * @param {object} input
 * @param {Array} input.history  public-data/history.json rows
 * @param {object} [input.credit] { hyBp, hyDelta5Bp, hyAsOf, pcr, pcrAsOf, fg, fgAsOf }
 * @param {object} [input.rates] FRED one-week changes in percent plus asOf
 */
export function alignMarketInputs({ history = [], credit = {}, rates = {} } = {}) {
  const basis = closeBasis(history);
  const alignments = {};
  const s = {};
  for (const field of SERIES_FIELDS) {
    const stat = stats(buildCloseSeries(history, field, { through: basis }));
    alignments[field] = alignInput(stat?.date, basis);
    s[field] = stat && isUsable(alignments[field]) ? stat : null;
  }
  const fgSeries = buildCloseSeries(history, 'fg', { through: basis });
  const fgLast = fgSeries[fgSeries.length - 1] || null;
  alignments.fg = fgLast ? alignInput(fgLast.date, basis) : alignInput(credit.fgAsOf, basis);
  alignments.hy = alignInput(credit.hyAsOf, basis);
  alignments.pcr = alignInput(credit.pcrAsOf, basis);
  alignments.rates = alignInput(rates.asOf, basis);
  const take = (value, alignment) => finite(value) != null && isUsable(alignment) ? finite(value) : null;
  const c = {
    hyBp: take(credit.hyBp, alignments.hy),
    hy5: take(credit.hyDelta5Bp, alignments.hy),
    pcr: take(credit.pcr, alignments.pcr),
    fg: isUsable(alignments.fg) ? (fgLast ? fgLast.value : finite(credit.fg)) : null
  };
  const r = Object.fromEntries(['realYield10', 'realYield10Delta5', 'breakeven10Delta5', 'dgs2Delta5', 'dgs10Delta5']
    .map((key) => [key, take(rates[key], alignments.rates)]));
  return { basis, s, c, r, alignments, fgSeries };
}

/**
 * @param {object} input see alignMarketInputs
 */
export function buildMarketRead(input = {}) {
  const { basis, s, c, r } = alignMarketInputs(input);
  const spx = s.spx;
  if (!spx) return { available: false, reason: 'history-missing', statements: [], drivers: [] };
  const { hyBp, pcr, fg } = c;
  const statements = [];
  // text = what the numbers show; reading = the interpretation, worded as a hypothesis.
  const add = (id, weight, text, axis, { check = null, reading = null } = {}) => statements.push({ id, weight, text, reading, axis, check });

  const spx5 = pct(spx.value, spx.d5);
  const spx20 = pct(spx.value, spx.d20);
  const spxFromHigh = pct(spx.value, spx.yearMax);
  const tnx = s.tnx;
  const tnx5 = tnx ? bp(tnx.value, tnx.d5) : null;
  const tnx20 = tnx ? bp(tnx.value, tnx.d20) : null;
  const real5 = r.realYield10Delta5 == null ? null : r.realYield10Delta5 * 100;
  const bei5 = r.breakeven10Delta5 == null ? null : r.breakeven10Delta5 * 100;

  // 1. Rates vs equities over a week — which force is winning.
  if (tnx5 != null && spx5 != null && Math.abs(tnx5) >= 8) {
    const atHigh = tnx.yearPosition != null && tnx.yearPosition >= 0.95;
    const rateText = `10년물 금리 5일 ${signed(tnx5, 0, 'bp')}(${fmt(tnx.value)}%${atHigh ? ', 1년 최고권' : ''})`;
    if (tnx5 > 0 && spx5 >= 0) add('rates-up-stocks-up', Math.min(95, 40 + tnx5 * 2), `${rateText}에도 S&P 500은 ${signed(spx5)}.`, 'rates', { reading: '주가가 금리 부담을 견디고 있습니다 — 실적·성장 기대가 받치는 것으로 볼 수 있습니다.', check: `금리가 더 오를 때도 주가가 버티는지(10년물 ${fmt(tnx.value)}% 기준)` });
    else if (tnx5 > 0) add('rates-up-stocks-down', Math.min(95, 45 + tnx5 * 2), `${rateText}, S&P 500 ${signed(spx5)}.`, 'rates', { reading: '금리 상승이 주가 할인율 부담으로 작용하는 모습입니다.', check: `10년물이 ${fmt(tnx.value)}% 위에서 굳는지, S&P 500이 50일선(${fmt(spx.ma50, 0)})을 지키는지` });
    else if (spx5 < 0) add('rates-down-stocks-down', Math.min(95, 45 - tnx5 * 2), `${rateText}에도 S&P 500 ${signed(spx5)}.`, 'rates', { reading: '금리보다 성장 둔화 우려가 앞설 가능성이 있습니다 — 경기 지표로 확인이 필요합니다.', check: '다음 경기 지표(고용·ISM)가 둔화를 확인하는지' });
    else add('rates-down-stocks-up', Math.min(90, 35 - tnx5 * 2), `${rateText} 속에 S&P 500 ${signed(spx5)}.`, 'rates', { reading: '금리 하락이 주가를 받치는 모습입니다.' });
  }
  if (tnx?.yearPosition != null && tnx.yearPosition >= 0.95 && !statements.some((row) => row.axis === 'rates')) add('rates-year-high', 70, `10년물 금리 ${fmt(tnx.value)}%는 최근 1년 범위의 최상단입니다(1년 최저 ${fmt(tnx.yearMin)}%).`, 'rates');

  // P1390 (frameworks from owner-supplied material 2026-09-28~30: 윤지호/인포맥스, @laylaperfume daily recaps):
  // (a) what drives the nominal move — real yield (multiple compression) or inflation compensation.
  // Nominal ≈ real + breakeven, so the split itself is arithmetic, not a guess.
  if (real5 != null && bei5 != null && Math.abs(real5 + bei5) >= 8) {
    const realLed = Math.abs(real5) >= Math.abs(bei5);
    add(realLed ? 'real-yield-led' : 'breakeven-led', 78,
      `10년물 5일 변화 중 실질금리 ${signed(real5, 0, 'bp')}·기대인플레 ${signed(bei5, 0, 'bp')}${r.realYield10 != null ? `(실질금리 ${fmt(r.realYield10)}%)` : ''}.`, 'rates',
      { reading: realLed ? '물가보다 실질금리가 금리를 움직여, 주식 밸류에이션(PER)에 더 직접적인 부담입니다.' : '유가·물가 기대가 금리를 움직이는 구간입니다.',
        check: realLed ? '실질금리 상승이 멈추는지 — 멈추지 않으면 성장주 밸류에이션 부담 지속' : '유가와 다음 물가 지표가 기대인플레를 더 밀어 올리는지' });
  }
  // (b) short vs long end — policy expectations or the long end itself;
  const two5 = r.dgs2Delta5 == null ? null : r.dgs2Delta5 * 100;
  const ten5 = r.dgs10Delta5 == null ? null : r.dgs10Delta5 * 100;
  if (two5 != null && ten5 != null) {
    if (ten5 >= 8 && ten5 - two5 >= 8) add('bear-steepening', 72, `장기금리(10년 ${signed(ten5, 0, 'bp')})가 단기금리(2년 ${signed(two5, 0, 'bp')})보다 크게 올랐습니다.`, 'rates', { reading: '연준 기대보다 장기 요인(기간 프리미엄·성장·국채 수급)이 주도하는 모양입니다. 이 경우 단기 금리가 안정돼도 위험선호 회복이 늦어질 수 있습니다.' });
    else if (two5 >= 8 && two5 - ten5 >= 8) add('bear-flattening', 72, `단기금리(2년 ${signed(two5, 0, 'bp')})가 장기금리(10년 ${signed(ten5, 0, 'bp')})보다 더 올랐습니다.`, 'rates', { reading: '추가 긴축 기대가 금리를 끌어올리는 모양입니다.' });
  }
  // (c) a weaker dollar with higher long rates points inward (inflation, growth, supply), not to FX.
  const dxyWeek = s.dxy ? pct(s.dxy.value, s.dxy.d5) : null;
  if (dxyWeek != null && tnx5 != null && dxyWeek <= -0.3 && tnx5 >= 8) add('weak-dollar-higher-rates', 55, `달러 5일 ${signed(dxyWeek)}인데 10년물은 ${signed(tnx5, 0, 'bp')}.`, 'rates', { reading: '해외 요인보다 미국 내부 요인(물가·성장·국채 공급)이 장기금리를 밀어 올렸을 가능성이 큽니다.' });

  // 2. Index vs participation.
  const b50 = s.breadth50?.value ?? null;
  if (b50 != null && spxFromHigh != null) {
    if (spxFromHigh > -3 && b50 < 40) add('narrow-rally', 85, `S&P 500은 1년 고점 대비 ${signed(spxFromHigh)}로 고점권인데 50일선 위 종목은 ${fmt(b50, 0)}%뿐입니다.`, 'index', { reading: '소수 대형주가 지수를 떠받치는 좁은 장세로 보입니다.', check: `50일선 위 종목 비율이 40% 위로 회복되는지(현재 ${fmt(b50, 0)}%) — 회복 없이 대형주가 꺾이면 지수 하락 폭이 커질 수 있음` });
    else if (b50 >= 60 && spx20 != null && spx20 > 0) add('broad-rally', 55, `50일선 위 종목 ${fmt(b50, 0)}%, S&P 500 20일 ${signed(spx20)} — 상승이 대형주에 그치지 않고 넓게 퍼져 있습니다.`, 'index');
    else if (b50 < 30 && spx20 != null && spx20 < 0) add('broad-weakness', 70, `50일선 위 종목 ${fmt(b50, 0)}%, S&P 500 20일 ${signed(spx20)} — 약세가 시장 전반에 퍼져 있습니다.`, 'index');
  }
  // P1416: leadership and distribution (definitions in src/domain/market/breadth-signals.js).
  const nh = s.breadthNewHighs?.date === spx.date ? s.breadthNewHighs.value : null;
  const nl = s.breadthNewLows?.date === spx.date ? s.breadthNewLows.value : null;
  if (nh != null && nl != null && spxFromHigh != null) {
    if (spxFromHigh > -3 && nl > nh && nl >= 10) add('highs-lows-divergence', 76, `S&P 500은 고점권(${signed(spxFromHigh)})인데 52주 신저가 종목 ${fmt(nl, 0)}개가 신고가 ${fmt(nh, 0)}개보다 많습니다.`, 'index', { reading: '지수 아래에서 약해지는 종목이 늘고 있습니다 — 주도주 폭이 좁아지는 괴리입니다.', check: `52주 신고가 종목이 신저가보다 다시 많아지는지(현재 ${fmt(nh, 0)} / ${fmt(nl, 0)})` });
    else if (nh >= 20 && nh >= 3 * Math.max(1, nl)) add('leadership-broadening', 52, `52주 신고가 종목 ${fmt(nh, 0)}개, 신저가 ${fmt(nl, 0)}개.`, 'index', { reading: '신고가를 내는 종목이 넓게 늘어나는 모습입니다.' });
  }
  const dd = s.distributionDays?.value ?? null;
  if (dd != null && dd >= 5) add('distribution-cluster', 74, `S&P 500 최근 25거래일 중 ${fmt(dd, 0)}일이 0.2% 이상 하락하면서 거래량이 늘어난 날(분배일)입니다.`, 'index', { reading: '매도 압력이 쌓이는 모습입니다 — 오닐 방식에서는 5~6회 이상을 추세 약화 경고로 봅니다.', check: '분배일이 줄어드는지, 지수가 거래량을 동반해 반등하는지' });
  // 3. Leadership: tech and small caps relative to the S&P over a month.
  const ndx20 = s.nasdaq ? pct(s.nasdaq.value, s.nasdaq.d20) : null;
  const rut20 = s.rut ? pct(s.rut.value, s.rut.d20) : null;
  if (ndx20 != null && spx20 != null && Math.abs(ndx20 - spx20) >= 2) add(ndx20 > spx20 ? 'tech-leads' : 'tech-lags', 50, `나스닥 20일 ${signed(ndx20)} vs S&P 500 ${signed(spx20)} — ${ndx20 > spx20 ? '기술주가 상승을 주도' : '기술주가 시장보다 약함'}.`, 'index');
  const hyWeek = c.hy5;
  const creditCalm = hyBp != null && hyWeek != null && hyBp < RULES.credit.tightBelowBp && hyWeek <= 5;
  if (rut20 != null && spx20 != null && Math.abs(rut20 - spx20) >= 3) {
    const lags = rut20 < spx20;
    add(lags ? 'smallcap-lags' : 'smallcap-leads', lags && creditCalm ? 55 : 45, `러셀 2000 20일 ${signed(rut20)} vs S&P 500 ${signed(spx20)}.`, 'index', {
      reading: !lags ? '위험선호가 중소형주까지 퍼진 모습입니다.'
        : creditCalm ? `HY 스프레드(${fmt(hyBp, 0)}bp)가 안정적이라 신용 위험이 원인이라는 신호는 없습니다 — 금리 부담이 더 그럴듯한 설명입니다.` : '금리에 민감한 중소형주가 소외된 모습입니다.'
    });
  }
  const adv = s.advanceRatio?.value ?? null;
  const spxDay = pct(spx.value, spx.d1);
  if (adv != null && spxDay != null && s.advanceRatio.date === spx.date) {
    const advPct = adv <= 1 ? adv * 100 : adv;
    if (spxDay <= -0.8 && advPct < 30) add('broad-derisking', 65, `S&P 500 ${signed(spxDay)}, 상승 종목 ${fmt(advPct, 0)}%.`, 'index', { reading: '특정 섹터가 아닌 시장 전반의 고른 위험 축소로 보입니다.' });
    else if (spxDay >= -0.3 && advPct < 45) add('index-defended', 62, `S&P 500 ${signed(spxDay)}인데 상승 종목은 ${fmt(advPct, 0)}%.`, 'index', { reading: '지수와 다수 종목의 방향이 갈렸습니다 — 시가총액이 큰 일부 종목이 지수를 받쳤을 가능성이 큽니다(종목별 기여도는 확인하지 않음).' });
  }

  // 4. Fear gauge vs credit: is the fear priced in credit too?
  const vix = s.vix;
  if (fg != null && fg < 35 && hyBp != null && hyBp < 350 && vix && vix.value < 20) {
    add('fear-without-credit-stress', 80, `F&G ${fmt(fg, 0)}(공포)인데 HY 신용 스프레드 ${fmt(hyBp, 0)}bp·VIX ${fmt(vix.value)}는 안정적입니다${hyWeek != null ? ` (HY 5일 ${signed(hyWeek, 0, 'bp')})` : ''}.`, 'risk', { reading: '공포가 아직 신용 시장으로 번지지 않았습니다.', check: `HY 스프레드가 350bp(경계 구간)를 넘는지(현재 ${fmt(hyBp, 0)}bp)` });
  } else if (fg != null && fg > 70 && vix && vix.value < 14) {
    add('complacency', 60, `F&G ${fmt(fg, 0)}(탐욕)·VIX ${fmt(vix.value)}.`, 'risk', { reading: '낙관이 강하고 변동성 대비가 얇은 상태입니다.' });
  }
  if (hyWeek != null && hyWeek >= 15 && hyBp != null && hyBp < 450) add('credit-widening', 72, `HY 신용 스프레드 5일 ${signed(hyWeek, 0, 'bp')} 확대(${fmt(hyBp, 0)}bp).`, 'risk', { reading: '자금 조달 여건이 빠듯해지는 신호입니다.', check: 'HY 스프레드 확대가 이어지는지 — 이어지면 주식보다 신용이 먼저 위험을 반영' });
  if (hyBp != null && hyBp >= RULES.credit.stressAtBp) add('credit-stress', 85, `HY 신용 스프레드 ${fmt(hyBp, 0)}bp(${RULES.credit.stressAtBp}bp 이상 스트레스 구간).`, 'risk', { reading: '신용 시장이 위험을 가격에 반영하고 있습니다.' });
  if (vix && s.vix3m && s.vix3m.date === vix.date && vix.value / s.vix3m.value > 1) add('vix-inversion', 75, `VIX(${fmt(vix.value)})가 3개월 VIX(${fmt(s.vix3m.value)})보다 높은 역전 상태입니다.`, 'risk', { reading: '단기 스트레스가 중기 기대보다 큽니다.' });
  if (tnx?.yearPosition != null && tnx.yearPosition >= 0.95 && vix && vix.value < 20) add('orderly-at-rate-high', 58, `10년물 금리는 1년 최고권인데 VIX는 ${fmt(vix.value)}.`, 'risk', { reading: '금리 부담에도 공포성 매도 신호는 아직 없습니다.' });
  const vix5 = vix ? pct(vix.value, vix.d5) : null;
  if (vix5 != null && vix5 >= 25) add('vix-spike', 75, `VIX 5일 ${signed(vix5, 0)} 급등(${fmt(vix.value)}).`, 'risk');

  // 5. Dollar and gold.
  const dxy5 = s.dxy ? pct(s.dxy.value, s.dxy.d5) : null;
  const gold20 = s.gold ? pct(s.gold.value, s.gold.d20) : null;
  if (s.gold?.yearPosition != null && s.gold.yearPosition >= 0.95) add('gold-high', 55, `금 ${fmt(s.gold.value, 0)}달러로 1년 최고권(20일 ${signed(gold20)}).`, 'commodities', { reading: dxy5 != null && dxy5 > 0.5 ? '달러 강세에도 오르는 안전자산 수요로 볼 수 있습니다.' : null });
  else if (dxy5 != null && gold20 != null && dxy5 > 1 && gold20 > 3) add('haven-demand', 55, `달러(5일 ${signed(dxy5)})와 금(20일 ${signed(gold20)})이 함께 상승.`, 'commodities', { reading: '안전자산 선호 신호일 수 있습니다.' });

  if (gold20 != null && tnx20 != null && gold20 <= -3 && tnx20 >= 10 && !statements.some((row) => row.id === 'gold-high')) add('gold-down-rates-up', 60, `금 20일 ${signed(gold20)}·10년물 20일 ${signed(tnx20, 0, 'bp')}.`, 'commodities', {
    reading: real5 != null && real5 > 0 ? `실질금리도 5일 ${signed(real5, 0, 'bp')} 올라, 실질금리 상승이 금을 누르는 경로와 맞습니다.` : '실질금리 상승이 금을 누르는 경로일 수 있습니다(실질금리 자료로 확인 필요).'
  });
  // 6. Oil and yields — the inflation channel.
  const wti20 = s.wti ? pct(s.wti.value, s.wti.d20) : null;
  if (wti20 != null && tnx20 != null && wti20 >= 8 && tnx20 >= 15) add('oil-rates-inflation', 80, `WTI 20일 ${signed(wti20)}·10년물 20일 ${signed(tnx20, 0, 'bp')} 동반 상승.`, 'commodities', {
    reading: bei5 != null && bei5 > 0 ? '기대인플레도 올라, 유가가 물가 기대를 거쳐 금리를 밀어 올리는 경로와 맞습니다.' : '유가가 물가 기대를 거쳐 금리를 밀어 올리는 경로일 수 있습니다.'
  });
  else if (s.wti?.yearPosition != null && s.wti.yearPosition >= 0.85) add('oil-high', 50, `WTI ${fmt(s.wti.value)}달러, 1년 범위 상단(${fmt(s.wti.yearPosition * 100, 0)}%).`, 'commodities', { reading: '높은 유가는 물가·금리 부담 요인입니다.', check: 'WTI가 1년 범위 상단에 머무는지 — 머물면 다음 물가 지표 부담' }); // P1394: range-relative

  // 7. Korea relative to the US, with the currency.
  const kospi5 = s.kospi ? pct(s.kospi.value, s.kospi.d5) : null;
  const krw5 = s.usdkrw ? pct(s.usdkrw.value, s.usdkrw.d5) : null;
  if (kospi5 != null && spx5 != null && Math.abs(kospi5 - spx5) >= 2) {
    add('korea-relative', 45, `코스피 5일 ${signed(kospi5)}로 미국(${signed(spx5)})보다 ${kospi5 > spx5 ? '강함' : '약함'}${krw5 != null ? ` · 원/달러 5일 ${signed(krw5)}(${krw5 > 0 ? '원화 약세' : '원화 강세'})` : ''}.`, 'korea');
  }

  const kospi1 = s.kospi ? pct(s.kospi.value, s.kospi.d1) : null;
  const spx1 = pct(spx.value, spx.d1);
  if (!statements.some((row) => row.axis === 'korea') && kospi1 != null && spx1 != null && Math.abs(kospi1 - spx1) >= 1.5) {
    add('korea-day', 40, `코스피 ${signed(kospi1)}로 직전 미국장(S&P 500 ${signed(spx1)})과 다르게 움직였습니다${krw5 != null && Math.abs(krw5) >= 0.3 ? ` · 원/달러 5일 ${signed(krw5)}` : ''}.`, 'korea');
  }

  statements.sort((a, b) => b.weight - a.weight);
  // The lead block shows the four strongest statements; driver rows add only the rest, so no
  // sentence appears twice on the page.
  const lead = statements.slice(0, 4);
  const restFor = (axis) => statements.filter((row) => row.axis === axis && !lead.includes(row)).map(({ text, reading }) => ({ text, reading }));
  const ma = (stat, label) => stat?.ma50 && stat?.ma200 ? `${label} 50일선 ${stat.value > stat.ma50 ? '위' : '아래'} · 200일선 ${stat.value > stat.ma200 ? '위' : '아래'}` : null;
  const change = (stat, digits = 2) => stat ? `${fmt(stat.value, digits)} (1일 ${signed(pct(stat.value, stat.d1))}, 5일 ${signed(pct(stat.value, stat.d5))})` : null;
  const drivers = [
    { id: 'index', title: '지수 · 시장 폭', values: [['S&P 500', change(spx)], ['나스닥', change(s.nasdaq)], ['50일선 위 종목', b50 == null ? null : `${fmt(b50, 0)}%`]], context: ma(spx, 'S&P 500'), reads: restFor('index') },
    { id: 'rates', title: '금리 · 달러', values: [['미 10년물', tnx ? `${fmt(tnx.value)}% (1일 ${signed(bp(tnx.value, tnx.d1), 1, 'bp')}, 5일 ${signed(tnx5, 0, 'bp')})` : null], ['달러 인덱스', change(s.dxy)]], context: null, reads: restFor('rates') },
    { id: 'commodities', title: '원자재', values: [['WTI', change(s.wti)], ['금', change(s.gold, 0)]], context: null, reads: restFor('commodities') },
    { id: 'risk', title: '변동성 · 위험선호', values: [['VIX', vix ? `${fmt(vix.value)} (5일 ${signed(vix5, 0)})` : null], ['HY 스프레드', hyBp == null ? null : `${fmt(hyBp, 0)}bp`], ['풋/콜', pcr == null ? null : fmt(pcr)], ['F&G', fg == null ? null : fmt(fg, 0)]], context: null, reads: restFor('risk') },
    { id: 'korea', title: '한국', values: [['코스피', change(s.kospi)], ['원/달러', change(s.usdkrw, 1)]], context: null, reads: restFor('korea') }
  ].map((row) => ({ ...row, values: row.values.filter(([, value]) => value) }));
  const headline = statements[0] || null;
  return {
    available: true,
    asOf: basis,
    headline: headline?.text || null,
    headlineReading: headline?.reading || null,
    points: lead.slice(1).map(({ text, reading }) => ({ text, reading })),
    checks: [...new Set(statements.filter((row) => row.check).map((row) => row.check))].slice(0, 3),
    statements,
    drivers
  };
}

// P1392 (owner decision 2026-10-02): the 0-100 environment score showed no predictive power
// (P714), double-counted VIX and missed the rates trend, real yields, FX and term structure. The
// 시장 상태 screen now shows six axes, each with a state, the evidence numbers, one reading and
// the condition that would flip it. States are descriptive (우호/중립/부담), never instructions.
// P1399: a state is decided only from inputs that are present and aligned; one present input never
// stands in for a missing one, and the flip text quotes the same thresholds the rule uses.
const STATE_LABELS = Object.freeze({ favorable: '우호', neutral: '중립', burden: '부담', unknown: '확인 불가' });
export const MIN_KNOWN_AXES = 4; // of the six US axes, before an overall label is shown

export function buildMarketRegime(input = {}) {
  const { basis, s, c, r, alignments } = alignMarketInputs(input);
  const spx = s.spx;
  if (!spx) return { available: false, axes: [], reason: 'history-missing' };
  const axis = (id, title, state, evidence, read, flip, basisOf) => ({
    id, title, state, stateLabel: STATE_LABELS[state], evidence: evidence.filter(([, value]) => value != null && value !== '—'), read, flip,
    basis: basisOf ? alignmentLabel(basisOf) : null, basisStatus: basisOf?.status || null
  });
  const staleRead = (label, alignment) => alignment?.status === 'stale' || alignment?.status === 'ahead'
    ? `${label} 최근 관측(${alignmentLabel(alignment)})이 기준일(${shortDate(basis)})과 달라 판정에서 제외했습니다.` : `${label} 기록이 없습니다.`;
  const axes = [];

  // 1. Trend — S&P 500 against its own averages and the 50-day slope.
  {
    const series = buildCloseSeries(input.history, 'spx', { through: basis });
    const ma50Then = series.length >= 70 ? series.slice(-70, -20).reduce((sum, point) => sum + point.value, 0) / 50 : null;
    const rising = spx.ma50 != null && ma50Then != null ? spx.ma50 > ma50Then : null;
    const fromHigh = pct(spx.value, spx.yearMax);
    let state = 'neutral';
    if (spx.ma50 == null || spx.ma200 == null || rising == null) state = 'unknown';
    else if (spx.value > spx.ma50 && spx.ma50 > spx.ma200 && rising) state = 'favorable';
    else if (spx.value < spx.ma200 || (spx.value < spx.ma50 && !rising)) state = 'burden';
    const nd20 = s.nasdaq ? pct(s.nasdaq.value, s.nasdaq.d20) : null;
    const read = state === 'favorable' ? '지수가 오르는 50일선 위에 있고 50일선이 200일선 위 — 상승 추세가 유지되고 있습니다.'
      : state === 'burden' ? (spx.value < spx.ma200 ? 'S&P 500이 200일선 아래 — 장기 추세가 꺾였습니다.' : 'S&P 500이 하락하는 50일선 아래 — 단기 추세가 약해졌습니다.')
        : state === 'unknown' ? '이동평균 계산에 필요한 종가 기록(200거래일 이상)이 부족합니다.' : '추세는 유지되지만 50일선 기울기나 위치가 뚜렷하지 않은 혼조 상태입니다.';
    const flip = state === 'unknown' ? null
      : state === 'favorable' ? `S&P 500이 50일선(${fmt(spx.ma50, 0)}) 아래로 마감하면 중립, 200일선(${fmt(spx.ma200, 0)}) 아래면 부담`
        : state === 'burden' ? `S&P 500이 200일선(${fmt(spx.ma200, 0)})과 50일선(${fmt(spx.ma50, 0)}) 위로 회복하면 완화`
          : `S&P 500이 상승하는 50일선(${fmt(spx.ma50, 0)}) 위, 50일선이 200일선 위면 우호 · 200일선(${fmt(spx.ma200, 0)}) 아래면 부담`;
    axes.push(axis('trend', '추세', state, [
      ['S&P 500', `${fmt(spx.value)} (20일 ${signed(pct(spx.value, spx.d20))})`],
      ['50일선 / 200일선', spx.ma50 != null && spx.ma200 != null ? `${fmt(spx.ma50, 0)} / ${fmt(spx.ma200, 0)}` : null],
      ['50일선 방향', rising == null ? null : rising ? '상승' : '하락'],
      ['1년 고점 대비', fromHigh == null ? null : signed(fromHigh)],
      ['나스닥 20일', nd20 == null ? null : signed(nd20)],
      // P1416: O'Neil distribution days — evidence only; the trend rule is unchanged.
      ['분배일 (최근 25거래일)', s.distributionDays ? `${fmt(s.distributionDays.value, 0)}일` : null]
    ], read, flip, alignments.spx));
  }
  // 2. Breadth — participation behind the index. Both windows must be present to call it broad.
  {
    const b50 = s.breadth50?.value ?? null;
    const b200 = s.breadth200?.value ?? null;
    const adv = s.advanceRatio?.value ?? null;
    const advPct = adv == null ? null : adv <= 1 ? adv * 100 : adv;
    const rut20 = s.rut ? pct(s.rut.value, s.rut.d20) : null;
    const spx20 = pct(spx.value, spx.d20);
    let state = 'neutral';
    if (b50 == null && b200 == null) state = 'unknown';
    else if ((b50 != null && b50 < RULES.breadth.weakBelow) || (b200 != null && b200 < RULES.breadth.weakBelow)) state = 'burden';
    else if (b50 != null && b200 != null && b50 >= RULES.breadth.broadAtLeast && b200 >= RULES.breadth.broadAtLeast) state = 'favorable';
    const fromHigh = pct(spx.value, spx.yearMax);
    const narrow = state === 'burden' && fromHigh != null && fromHigh > -3;
    const partial = state !== 'unknown' && (b50 == null || b200 == null) ? ` (${b50 == null ? '50일선' : '200일선'} 비율 미수신 — 나머지 하나로만 판단)` : '';
    const read = (state === 'favorable' ? '상승이 다수 종목으로 퍼져 있습니다.'
      : state === 'burden' ? (narrow ? `지수는 고점권(${signed(fromHigh)})인데 참여 종목이 적은 좁은 장세 — 소수 대형주 의존도가 높아 보입니다.` : '약세가 시장 전반에 퍼져 있습니다.')
        : state === 'unknown' ? staleRead('시장 폭', alignments.breadth50) : '참여 종목 비율이 중간 — 확산도 위축도 뚜렷하지 않습니다.') + partial;
    const flip = state === 'unknown' ? null
      : state === 'burden' ? `50일선·200일선 위 종목 비율이 모두 ${RULES.breadth.weakBelow}% 이상이면 중립, 모두 ${RULES.breadth.broadAtLeast}% 이상이면 우호`
        : state === 'favorable' ? `둘 중 하나라도 ${RULES.breadth.broadAtLeast}% 아래면 중립, ${RULES.breadth.weakBelow}% 아래면 부담`
          : `50일선·200일선 위 종목 비율이 모두 ${RULES.breadth.broadAtLeast}% 이상이면 우호, 하나라도 ${RULES.breadth.weakBelow}% 아래면 부담`;
    axes.push(axis('breadth', '시장 폭', state, [
      ['50일선 위 종목', b50 == null ? null : `${fmt(b50, 0)}%`],
      ['200일선 위 종목', b200 == null ? null : `${fmt(b200, 0)}%`],
      ['최근 상승 종목 비율', advPct == null ? null : `${fmt(advPct, 0)}%`],
      // P1416: leadership evidence beside the moving-average ratios (the state rule is unchanged).
      ['40일선 위 종목', s.breadth40 ? `${fmt(s.breadth40.value, 0)}%` : null],
      ['52주 신고가 / 신저가', s.breadthNewHighs && s.breadthNewLows ? `${fmt(s.breadthNewHighs.value, 0)} / ${fmt(s.breadthNewLows.value, 0)}` : null],
      ['4% 이상 상승 / 하락', s.breadthUp4 && s.breadthDown4 ? `${fmt(s.breadthUp4.value, 0)} / ${fmt(s.breadthDown4.value, 0)}` : null],
      ['러셀 2000 vs S&P 500 (20일)', rut20 == null || spx20 == null ? null : `${signed(rut20)} vs ${signed(spx20)}`]
    ], read, flip, alignments.breadth50));
  }
  // 3. Volatility — level (canonical 18/25 bands), one-week change and term structure.
  {
    const vix = s.vix;
    const ratio = vix && s.vix3m && s.vix3m.date === vix.date ? vix.value / s.vix3m.value : null;
    const vix5 = vix ? pct(vix.value, vix.d5) : null;
    let state = 'neutral';
    if (!vix) state = 'unknown';
    else if (vix.value >= RULES.volatility.stressAt || (ratio != null && ratio >= RULES.volatility.invertedRatioAt) || (vix5 != null && vix5 >= RULES.volatility.spike5dPct)) state = 'burden';
    else if (vix.value < RULES.volatility.calmBelow && ratio != null && ratio < RULES.volatility.calmRatioBelow) state = 'favorable';
    const read = state === 'favorable' ? '변동성이 낮고 기간 구조가 정상 — 시장이 단기 충격을 크게 반영하지 않고 있습니다.'
      : state === 'burden' ? (ratio != null && ratio >= 1 ? '단기 변동성이 중기보다 높은 역전 — 단기 스트레스 구간입니다.' : vix5 != null && vix5 >= 25 ? '변동성이 한 주 사이 급등했습니다.' : 'VIX 25 이상 — 경계 구간입니다.')
        : state === 'unknown' ? staleRead('VIX', alignments.vix)
          : ratio == null ? 'VIX는 낮은 편이지만 3개월 VIX가 없어 기간 구조를 확인하지 못했습니다.' : 'VIX 18~25 주의 구간이거나 기간 구조가 평탄합니다.';
    const flip = state === 'unknown' ? null
      : state === 'burden' ? `VIX ${RULES.volatility.stressAt} 미만, VIX/3개월 VIX ${RULES.volatility.invertedRatioAt} 미만, 5일 상승률 +${RULES.volatility.spike5dPct}% 미만이 모두 충족되면 완화`
        : state === 'favorable' ? `VIX ${RULES.volatility.calmBelow} 이상 또는 VIX/3개월 VIX ${RULES.volatility.calmRatioBelow} 이상이면 중립 · VIX ${RULES.volatility.stressAt} 이상, 역전(${RULES.volatility.invertedRatioAt} 이상), 5일 +${RULES.volatility.spike5dPct}% 급등 중 하나면 부담`
          : `VIX ${RULES.volatility.calmBelow} 미만이면서 VIX/3개월 VIX ${RULES.volatility.calmRatioBelow} 미만이면 우호 · VIX ${RULES.volatility.stressAt} 이상, 역전, 5일 +${RULES.volatility.spike5dPct}% 급등 중 하나면 부담`;
    axes.push(axis('volatility', '변동성', state, [
      ['VIX', vix ? `${fmt(vix.value)} (5일 ${signed(vix5, 0)})` : null],
      ['VIX / 3개월 VIX', ratio == null ? null : `${fmt(ratio)} ${ratio >= 1 ? '(역전)' : '(정상)'}`]
    ], read, flip, alignments.vix));
  }
  // 4. Rates — level, direction and what drives it (real yield vs breakeven).
  {
    const tnx = s.tnx;
    const tnx5 = tnx ? bp(tnx.value, tnx.d5) : null;
    const tnx20 = tnx ? bp(tnx.value, tnx.d20) : null;
    const real5 = r.realYield10Delta5 == null ? null : r.realYield10Delta5 * 100;
    const bei5 = r.breakeven10Delta5 == null ? null : r.breakeven10Delta5 * 100;
    const atHigh = tnx?.yearPosition != null && tnx.yearPosition >= RULES.rates.rangeHighAt;
    let state = 'neutral';
    if (!tnx || tnx20 == null) state = 'unknown';
    else if (tnx20 >= RULES.rates.move20dBp || (atHigh && tnx5 != null && tnx5 > 0)) state = 'burden';
    else if (tnx20 <= -RULES.rates.move20dBp) state = 'favorable';
    const realLed = real5 != null && bei5 != null && real5 > 0 && Math.abs(real5) >= Math.abs(bei5);
    const read = state === 'burden' ? `장기금리가 오르는 구간${atHigh ? '(1년 범위 상단)' : ''} — 주식 할인율 부담${realLed ? '. 상승분 대부분이 실질금리라 밸류에이션(PER)에 더 직접적입니다' : ''}.`
      : state === 'favorable' ? '장기금리가 내려오는 구간 — 할인율 부담이 줄고 있습니다.'
        : state === 'unknown' ? (tnx ? '10년물 20일 변화를 계산할 기록이 부족합니다.' : staleRead('금리', alignments.tnx)) : '금리가 뚜렷한 방향 없이 움직이고 있습니다.';
    const flip = state === 'unknown' ? null
      : state === 'burden' ? `10년물 20일 변화 +${RULES.rates.move20dBp}bp 미만(현재 ${signed(tnx20, 0, 'bp')}), 1년 범위 상단(${RULES.rates.rangeHighAt * 100}% 이상)에서의 5일 상승이 멈추면 완화`
        : state === 'favorable' ? `10년물 20일 변화가 -${RULES.rates.move20dBp}bp 위로 올라오면 중립, +${RULES.rates.move20dBp}bp 이상이면 부담`
          : `10년물 20일 +${RULES.rates.move20dBp}bp 이상 또는 1년 범위 ${RULES.rates.rangeHighAt * 100}% 이상에서 5일 상승 시 부담 · 20일 -${RULES.rates.move20dBp}bp 이하면 우호`;
    axes.push(axis('rates', '금리', state, [
      ['미 10년물', tnx ? `${fmt(tnx.value)}% (5일 ${signed(tnx5, 0, 'bp')}, 20일 ${signed(tnx20, 0, 'bp')})` : null],
      ['1년 범위 내 위치', tnx?.yearPosition == null ? null : `${fmt(tnx.yearPosition * 100, 0)}%`],
      ['실질금리 / 기대인플레 (5일)', real5 == null || bei5 == null ? null : `${signed(real5, 0, 'bp')} / ${signed(bei5, 0, 'bp')}`],
      ['실질금리 (10년 TIPS)', r.realYield10 == null ? null : `${fmt(r.realYield10)}%`]
    ], read, flip, alignments.tnx));
  }
  // 5. Credit & risk appetite — the funding market and hedging demand. Calm needs the direction too.
  {
    const { hyBp, hy5, pcr } = c;
    let state = 'neutral';
    if (hyBp == null) state = 'unknown';
    else if (hyBp >= RULES.credit.stressAtBp || (hy5 != null && hy5 >= RULES.credit.widen5dBp)) state = 'burden';
    else if (hyBp < RULES.credit.tightBelowBp && hy5 != null && hy5 <= 0 && (pcr == null || pcr < RULES.credit.putCallHedgeAt)) state = 'favorable';
    const read = state === 'favorable' ? '신용 시장이 안정적 — 주식 약세가 신용 위험으로 번지지 않았습니다.'
      : state === 'burden' ? '신용 스프레드가 넓거나 빠르게 확대 — 자금 조달 여건이 나빠지고 있습니다.'
        : state === 'unknown' ? staleRead('신용 스프레드', alignments.hy)
          : hy5 == null && hyBp < RULES.credit.tightBelowBp ? '스프레드 수준은 낮지만 5일 변화가 없어 방향을 확인하지 못했습니다.' : '신용은 크게 나쁘지 않지만 스프레드 수준·방향이나 헤지 수요가 경계선입니다.';
    const flip = state === 'unknown' ? null
      : state === 'burden' ? `HY 스프레드가 ${RULES.credit.stressAtBp}bp 아래이고 5일 확대가 +${RULES.credit.widen5dBp}bp 미만이면 완화`
        : state === 'favorable' ? `HY ${RULES.credit.tightBelowBp}bp 이상, 5일 확대, 풋/콜 ${RULES.credit.putCallHedgeAt} 이상 중 하나면 중립 · ${RULES.credit.stressAtBp}bp 이상 또는 5일 +${RULES.credit.widen5dBp}bp 확대 시 부담`
          : `HY ${RULES.credit.tightBelowBp}bp 미만에 5일 축소·보합, 풋/콜 ${RULES.credit.putCallHedgeAt} 미만이면 우호 · ${RULES.credit.stressAtBp}bp 이상 또는 5일 +${RULES.credit.widen5dBp}bp 확대 시 부담`;
    axes.push(axis('credit', '신용 · 위험선호', state, [
      ['HY 신용 스프레드', hyBp == null ? null : `${fmt(hyBp, 0)}bp${hy5 != null ? ` (5일 ${signed(hy5, 0, 'bp')})` : ''}`],
      ['풋/콜 비율', pcr == null ? null : fmt(pcr)],
      ['F&G (참고)', c.fg == null ? null : fmt(c.fg, 0)]
    ], read, flip, alignments.hy));
  }
  // 6. Dollar & commodities — oil (inflation channel), the dollar and gold.
  // P1394: oil is judged against its own 1-year range and 20-day change, not a fixed $90 line.
  // P1399: easing needs both oil and the dollar measured and falling; one alone never makes it.
  {
    const dxy20 = s.dxy ? pct(s.dxy.value, s.dxy.d20) : null;
    const wti = s.wti;
    const wti20 = wti ? pct(wti.value, wti.d20) : null;
    const wtiHigh = wti?.yearPosition != null && wti.yearPosition >= RULES.oil.rangeHighAt;
    const gold20 = s.gold ? pct(s.gold.value, s.gold.d20) : null;
    let state = 'neutral';
    if (wti20 == null && dxy20 == null && !wtiHigh) state = 'unknown';
    else if (wtiHigh || (wti20 != null && wti20 >= RULES.oil.rise20dPct) || (dxy20 != null && dxy20 >= RULES.dollar.rise20dPct)) state = 'burden';
    else if (wti20 != null && dxy20 != null && wti20 <= RULES.oil.fall20dPct && dxy20 <= 0) state = 'favorable';
    const missing = state !== 'unknown' && (wti20 == null || dxy20 == null) ? ` (${wti20 == null ? 'WTI' : '달러'} 20일 변화 미수신)` : '';
    const read = (state === 'burden' ? (wti20 != null && wti20 >= RULES.oil.rise20dPct ? '유가가 빠르게 오르며 물가·금리 부담을 키우고 있습니다.' : wtiHigh ? `유가가 1년 범위 상단(${fmt(wti.yearPosition * 100, 0)}%)에 머물러 물가·금리 부담입니다.` : '달러 강세가 해외 매출 기업과 신흥국 자금 흐름에 부담입니다.')
      : state === 'favorable' ? '유가와 달러가 함께 내려오며 물가·금융 여건 부담이 줄고 있습니다.'
        : state === 'unknown' ? staleRead('유가·달러', alignments.wti) : '유가·달러가 중립 범위입니다.') + missing;
    const flip = state === 'unknown' ? null
      : state === 'burden' ? `WTI 1년 범위 ${RULES.oil.rangeHighAt * 100}% 미만, WTI 20일 +${RULES.oil.rise20dPct}% 미만, 달러 20일 +${RULES.dollar.rise20dPct}% 미만이 모두 충족되면 완화`
        : state === 'favorable' ? `WTI 20일 ${RULES.oil.fall20dPct}% 위 또는 달러 20일 상승이면 중립 · WTI 1년 범위 ${RULES.oil.rangeHighAt * 100}% 이상, WTI 20일 +${RULES.oil.rise20dPct}%, 달러 20일 +${RULES.dollar.rise20dPct}% 중 하나면 부담`
          : `WTI 20일 ${RULES.oil.fall20dPct}% 이하이면서 달러 20일 하락이면 우호 · WTI 1년 범위 ${RULES.oil.rangeHighAt * 100}% 이상, WTI 20일 +${RULES.oil.rise20dPct}%, 달러 20일 +${RULES.dollar.rise20dPct}% 중 하나면 부담`;
    axes.push(axis('commodities', '달러 · 원자재', state, [
      ['WTI', wti ? `${fmt(wti.value)}달러 (20일 ${signed(wti20)})` : null],
      ['WTI 1년 범위 내 위치', wti?.yearPosition == null ? null : `${fmt(wti.yearPosition * 100, 0)}%`],
      ['달러 인덱스', s.dxy ? `${fmt(s.dxy.value)} (20일 ${signed(dxy20)})` : null],
      ['금', s.gold ? `${fmt(s.gold.value, 0)}달러 (20일 ${signed(gold20)})` : null]
    ], read, flip, alignments.wti));
  }
  // 7. FX — the won (foreign flows into Korea) and the yen (carry trade; a fast yen rally has
  // preceded global de-risking, e.g. August 2024). P1394 adds USD/JPY at the owner's request.
  {
    const krw20 = s.usdkrw ? pct(s.usdkrw.value, s.usdkrw.d20) : null;
    const jpy20 = s.usdjpy ? pct(s.usdjpy.value, s.usdjpy.d20) : null;
    const kospi20 = s.kospi ? pct(s.kospi.value, s.kospi.d20) : null;
    const yenSurge = jpy20 != null && jpy20 <= -RULES.fx.yenRally20dPct;
    let state = 'neutral';
    if (krw20 == null && jpy20 == null) state = 'unknown';
    else if ((krw20 != null && krw20 >= RULES.fx.krwMove20dPct) || yenSurge) state = 'burden';
    else if (krw20 != null && krw20 <= -RULES.fx.krwMove20dPct) state = 'favorable';
    const read = yenSurge ? `엔화가 20일 ${signed(-jpy20)} 강세 — 2024년 8월 엔 캐리 청산 때는 글로벌 위험자산 매도가 함께 나타났습니다.`
      : state === 'burden' ? '원화 약세 — 외국인 수급과 수입 물가에 부담입니다.'
        : state === 'favorable' ? '원화 강세 — 외국인 자금 유입에 우호적이지만 수출 기업 이익에는 부담일 수 있습니다.'
          : state === 'unknown' ? staleRead('환율', alignments.usdkrw) : '원/달러·엔/달러가 중립 범위입니다.';
    axes.push(axis('korea', '환율 (원 · 엔)', state, [
      ['원/달러', s.usdkrw ? `${fmt(s.usdkrw.value, 1)}원 (20일 ${signed(krw20)})` : null],
      ['엔/달러', s.usdjpy ? `${fmt(s.usdjpy.value, 2)}엔 (20일 ${signed(jpy20)})` : '수집 시작 대기'],
      ['코스피', s.kospi ? `${fmt(s.kospi.value)} (20일 ${signed(kospi20)})` : null]
    ], read, state === 'unknown' ? null : `원/달러 20일 +${RULES.fx.krwMove20dPct}% 이상 또는 엔/달러 20일 -${RULES.fx.yenRally20dPct}% 이하(엔 급강세)면 부담 · 원/달러 20일 -${RULES.fx.krwMove20dPct}% 이하면 우호`, alignments.usdkrw));
  }

  const us = axes.filter((row) => row.id !== 'korea');
  const known = us.filter((row) => row.state !== 'unknown');
  const count = (state) => known.filter((row) => row.state === state).length;
  const burden = count('burden');
  const favorable = count('favorable');
  // P1399: an overall label needs at least four of the six US axes; fewer is "판정 보류".
  const enough = known.length >= MIN_KNOWN_AXES;
  const overall = !enough ? '판정 보류'
    : burden >= 4 || (burden >= 3 && favorable <= 1) ? '방어적 환경' : favorable >= 4 && burden === 0 ? '우호적 환경' : favorable >= 3 && burden <= 1 ? '대체로 우호적' : burden >= 2 && favorable <= 1 ? '경계 환경' : '혼조 환경';
  const byId = Object.fromEntries(axes.map((row) => [row.id, row]));
  const conflicts = [];
  if (byId.trend?.state === 'favorable' && byId.breadth?.state === 'burden') conflicts.push('추세는 우호인데 시장 폭은 부담 — 지수가 소수 종목에 기대고 있을 가능성이 큽니다.');
  if (byId.volatility?.state === 'favorable' && byId.rates?.state === 'burden') conflicts.push('금리는 부담인데 변동성은 낮음 — 금리 부담이 아직 공포로 번지지 않았습니다.');
  if (byId.credit?.state === 'favorable' && byId.breadth?.state === 'burden') conflicts.push('시장 폭은 약하지만 신용은 안정 — 신용 위험이 약세를 이끈다는 신호는 없습니다.');
  return {
    available: true,
    asOf: basis,
    overall,
    sufficient: enough,
    holdReason: enough ? null : `6개 축 중 ${known.length}개만 확인돼 전체 판정을 보류합니다(최소 ${MIN_KNOWN_AXES}개).`,
    counts: { favorable, neutral: count('neutral'), burden, unknown: us.length - known.length },
    conflicts,
    axes
  };
}
