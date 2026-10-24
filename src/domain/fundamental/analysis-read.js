// v58.55 (개편 v2 3d/5g): the analysis cards v58.53 left out until their inputs were collected — DuPont, R&D ÷ revenue,
// the Sloan (1996) accrual ratio and a reverse DCF calculator. Pure: the parsed SEC fiscal history (sec-fiscal-history.json,
// newest last) and the screener/SEC facts in, plain reading objects out. Nothing here is a score or a verdict; a missing
// input returns a state ('pending' = not yet collected, 'unreported' = the filer does not tag it) instead of a number.
import { finiteFact as finite, isPriorAnnualPeriod, FUNDAMENTAL_MAX_PERIOD_AGE_DAYS, fiscalYearLabel } from './period.js';
import { hasFinalConsonant, withTopicParticle } from '../content/korean-particle.js';
import { trailingQuarters } from './fiscal-read.js';
import { fiscalMetrics as fiscalMetricsOf } from './peer-read.js';
import { countOpenSessionsBetween, dateInTimezone } from '../market/market-calendar.js';
import { consensusView } from './consensus-read.js';

const subject = (word) => `${word}${hasFinalConsonant(word) ? '이' : '가'}`;
// v58.74 (text audit): the DuPont sentence names the driver; one clause says what that driver's change means.
const DRIVER_MEANING = Object.freeze({
  margin: '매출 1달러에서 남는 이익이 변했다는 뜻입니다.',
  turnover: '자산(현금·재고·설비 등)이 매출보다 빠르거나 느리게 늘었다는 뜻입니다.',
  leverage: '자기자본 대비 자산(부채 포함)의 크기가 변했다는 뜻입니다.'
});

const sorted = (history) => (Array.isArray(history) ? history : []).filter((year) => /^\d{4}-\d{2}-\d{2}$/.test(String(year?.periodEnd || '')))
  .slice().sort((a, b) => a.periodEnd.localeCompare(b.periodEnd));

// 'collected' once any row carries the v58.55 columns (the producer writes them for a whole issuer at once).
export function assetChainState(history) {
  const rows = sorted(history);
  if (!rows.length) return 'none';
  return rows.some((year) => year.assetChain) ? 'collected' : 'pending';
}

// v58.63 (architecture audit A08): the shared 52/53-week rule — LDOS's year ended 2026-01-02 is its FY2025, as the
// company summary beside these cards already says.
const fyLabel = (periodEnd) => fiscalYearLabel(periodEnd) || '연간 공시';

// Average of this year-end and the prior fiscal year-end when both exist, else null.
function averageOf(rows, index, field) {
  const now = finite(rows[index]?.[field]);
  const prior = index > 0 && isPriorAnnualPeriod(rows[index], rows[index - 1]) ? finite(rows[index - 1]?.[field]) : null;
  return now != null && prior != null ? (now + prior) / 2 : null;
}

// v58.55 (review): an annual reading is only drawn for a current fiscal year. A record the SEC read flags stale, a latest
// fiscal year older than the repo's one 456-day rule (period.js), or a share count observed more than that far from the
// fiscal year end is 'stale' — Barrick's FY2010 cash flow and 2010 shares must never meet a 2026 close.
const DAY_MS = 86400000;
export function annualStaleReason({ periodEnd, fundamentals = null, nowMs = Date.now(), shares = false } = {}) {
  const end = Date.parse(String(periodEnd || ''));
  const label = periodEnd ? fyLabel(periodEnd) : '연간 공시';
  const old = `최근 연간 공시가 오래돼 계산하지 않음, ${label}`;
  if (!Number.isFinite(end)) return old;
  if (fundamentals?.quality?.stale === true) return old;
  if ((nowMs - end) / DAY_MS > FUNDAMENTAL_MAX_PERIOD_AGE_DAYS) return old;
  if (Number.isFinite(Number(fundamentals?.reportAgeDays)) && Number(fundamentals.reportAgeDays) > FUNDAMENTAL_MAX_PERIOD_AGE_DAYS && String(fundamentals?.observedAt || '').slice(0, 10) === String(periodEnd)) return old;
  if (shares) {
    const observed = Date.parse(String(fundamentals?.sharesObservedAt || ''));
    if (!Number.isFinite(observed) || Math.abs(observed - end) / DAY_MS > FUNDAMENTAL_MAX_PERIOD_AGE_DAYS) return `주식 수 관측일이 ${label} 회계연도 말과 15개월 넘게 떨어져 시가총액을 만들지 않음`;
  }
  return null;
}

export const DUPONT_FACTORS = Object.freeze([
  { id: 'margin', label: '순이익률' },
  { id: 'turnover', label: '자산회전율' },
  { id: 'leverage', label: '재무 레버리지' }
]);

// ROE = 순이익률 × 자산회전율 × 재무 레버리지 for the latest fiscal year and the year before it. v58.55 (review): each column
// uses average assets and equity when its prior year-end exists (positive equity), else its year-end values — the same
// rule as the 재무 공시 ROE (domain fiscal-read.js) — and names its own basis. A prior year that cannot be decomposed
// (negative equity, missing items) is dropped and the latest year stands alone.
export function buildDupontRead(history, { fundamentals = null, nowMs = Date.now() } = {}) {
  const rows = sorted(history);
  const chain = assetChainState(rows);
  if (chain === 'none') return { state: 'none' };
  if (chain === 'pending') return { state: 'pending' };
  const last = rows.length - 1;
  const latest = rows[last];
  const stale = annualStaleReason({ periodEnd: latest.periodEnd, fundamentals, nowMs });
  if (stale) return { state: 'stale', periodEnd: latest.periodEnd, reason: stale };
  const hasPrior = last > 0 && isPriorAnnualPeriod(latest, rows[last - 1]);
  if (finite(latest.totalAssets) == null) return { state: 'unreported', reason: '최근 회계연도 총자산이 공시 수집본에 없습니다' };
  if (!(finite(latest.revenue) > 0)) return { state: 'unreported', reason: '매출이 공시되지 않아 순이익률과 자산회전율을 나눌 수 없습니다' };
  const column = (i) => {
    const year = rows[i];
    const revenue = finite(year.revenue), income = finite(year.netIncome);
    const avgAssets = averageOf(rows, i, 'totalAssets');
    const priorEquity = i > 0 && isPriorAnnualPeriod(year, rows[i - 1]) ? finite(rows[i - 1].equity) : null;
    const average = avgAssets != null && finite(year.equity) > 0 && priorEquity > 0;
    const assets = average ? avgAssets : finite(year.totalAssets);
    const equity = average ? (finite(year.equity) + priorEquity) / 2 : finite(year.equity);
    if (!(revenue > 0) || income == null || !(assets > 0) || equity == null) return { error: 'missing' };
    if (!(equity > 0)) return { error: 'negative-equity', periodEnd: year.periodEnd };
    const margin = income / revenue, turnover = revenue / assets, leverage = assets / equity;
    return { periodEnd: year.periodEnd, label: fyLabel(year.periodEnd), basis: average ? 'average' : 'year-end', margin, turnover, leverage, roe: margin * turnover * leverage };
  };
  const now = column(last);
  if (now.error === 'negative-equity') return { state: 'negative-equity', periodEnd: now.periodEnd, reason: `${fyLabel(now.periodEnd)} 자기자본이 마이너스(자사주 매입·누적 손실)라 레버리지와 ROE를 곱셈으로 나누지 않습니다` };
  const prior = hasPrior && !now.error ? column(last - 1) : null;
  const columns = [...(prior && !prior.error ? [prior] : []), ...(now.error ? [] : [now])];
  if (!columns.length) return { state: 'unreported', reason: '순이익·자기자본 중 비어 있는 항목이 있어 분해하지 않습니다' };
  const basis = columns.every((c) => c.basis === 'average') ? 'average' : columns.every((c) => c.basis === 'year-end') ? 'year-end' : 'mixed';
  const prev = columns.length === 2 ? columns[0] : null;
  let driver = null;
  let sentence;
  if (!prev) sentence = `${now.label} ROE ${(now.roe * 100).toFixed(1)}% — ${hasPrior ? '직전 회계연도는 자기자본이 마이너스이거나 항목이 비어 분해하지 않아' : '직전 회계연도 자료가 없어'} 변화의 원인은 나누지 않습니다.`;
  else if (prev.margin > 0 && now.margin > 0) {
    // ln ROE = ln 순이익률 + ln 회전율 + ln 레버리지, so each factor's share of the change is its own log change.
    const moves = DUPONT_FACTORS.map((factor) => ({ ...factor, from: prev[factor.id], to: now[factor.id], log: Math.log(now[factor.id] / prev[factor.id]) }));
    const largest = moves.slice().sort((a, b) => Math.abs(b.log) - Math.abs(a.log))[0];
    const roeDelta = (now.roe - prev.roe) * 100;
    const fmt = (factor, value) => (factor.id === 'margin' ? `${(value * 100).toFixed(1)}%` : value.toFixed(Math.abs(value) < 0.1 ? 3 : 2));
    // v58.63 (architecture audit A07): the cause of a rise or fall is the largest factor moving the SAME way as ROE; a
    // factor moving against it offset the change and is named as such (margin +40% under a falling ROE was printed as
    // the reason it fell).
    const sign = Math.sign(roeDelta);
    const along = moves.filter((move) => Math.sign(move.log) === sign).sort((a, b) => Math.abs(b.log) - Math.abs(a.log));
    const against = moves.filter((move) => Math.sign(move.log) === -sign && Math.abs(move.log) > 1e-9).sort((a, b) => Math.abs(b.log) - Math.abs(a.log));
    driver = Math.abs(roeDelta) < 1 || !along.length ? largest : along[0];
    const offset = against.length ? ` — ${against[0].label}${against[0].log > 0 ? ' 상승' : ' 하락'}(${fmt(against[0], against[0].from)} → ${fmt(against[0], against[0].to)})은 이 변화를 일부 상쇄했습니다` : '';
    sentence = Math.abs(roeDelta) < 1
      ? `ROE는 ${(prev.roe * 100).toFixed(1)}%에서 ${(now.roe * 100).toFixed(1)}%로 거의 같고, 세 요인 중 ${subject(driver.label)} 가장 많이 움직였습니다(${fmt(driver, driver.from)} → ${fmt(driver, driver.to)}).`
      : `ROE가 ${(prev.roe * 100).toFixed(1)}%에서 ${(now.roe * 100).toFixed(1)}%로 ${roeDelta > 0 ? '높아진' : '낮아진'} 데는 ${driver.label} 변화(${fmt(driver, driver.from)} → ${fmt(driver, driver.to)})가 가장 크게 작용했습니다${offset}.${DRIVER_MEANING[driver.id] ? ` ${DRIVER_MEANING[driver.id]}` : ''}`;
  } else sentence = `${prev.margin <= 0 && now.margin <= 0 ? '두 해 모두' : withTopicParticle(prev.margin <= 0 ? prev.label : now.label)} 순손실이라 ROE 변화를 세 요인의 기여로 나누지 않습니다 — 각 요인의 값만 나란히 봅니다.`;
  return { state: 'ready', basis, columns, driver: driver ? driver.id : null, sentence };
}

// R&D ÷ revenue per fiscal year (up to five). 'unreported' when no year carries an R&D line — shown as
// "R&D 별도 공시 없음", never as 0%.
export function buildRdRead(history) {
  const rows = sorted(history);
  const chain = assetChainState(rows);
  if (chain !== 'collected') return { state: chain };
  const years = rows.filter((year) => year.assetChain && finite(year.revenue) > 0).slice(-5)
    .map((year) => ({ periodEnd: year.periodEnd, label: fyLabel(year.periodEnd), rd: finite(year.researchAndDevelopment), ratio: finite(year.researchAndDevelopment) != null ? finite(year.researchAndDevelopment) / finite(year.revenue) : null }));
  if (!years.some((year) => year.ratio != null)) return { state: 'unreported' };
  const latest = years.filter((year) => year.ratio != null).at(-1);
  const first = years.find((year) => year.ratio != null);
  const deltaPp = latest !== first ? (latest.ratio - first.ratio) * 100 : null;
  return { state: 'ready', years, latest, first, deltaPp, latestIsNewest: latest.periodEnd === rows.at(-1).periodEnd };
}

// Sloan (1996) accrual ratio = (순이익 − 영업현금흐름) ÷ 평균 총자산. Year-end assets only when the prior year-end is missing
// (labelled). Lending financials are excluded by the caller (deposits and loans run through operating cash flow).
export function buildAccrualRead(history) {
  const rows = sorted(history);
  const chain = assetChainState(rows);
  if (chain !== 'collected') return { state: chain };
  const years = [];
  rows.forEach((year, index) => {
    const income = finite(year.netIncome), ocf = finite(year.operatingCashFlow);
    if (!year.assetChain || income == null || ocf == null) return;
    const average = averageOf(rows, index, 'totalAssets');
    const assets = average ?? finite(year.totalAssets);
    if (!(assets > 0)) return;
    years.push({ periodEnd: year.periodEnd, label: fyLabel(year.periodEnd), ratio: (income - ocf) / assets, basis: average != null ? 'average' : 'year-end' });
  });
  if (!years.length) return { state: 'unreported' };
  const latest = years.at(-1);
  return { state: 'ready', years: years.slice(-5), latest, latestIsNewest: latest.periodEnd === rows.at(-1).periodEnd };
}

// ── Reverse DCF ─────────────────────────────────────────────────────────────────────────────────────────────────────
// Value today of free cash flow growing at g for `years`, then at the terminal rate forever (Gordon), discounted at r.
export function dcfValue(fcf, g, r, terminal, years = 10) {
  if (!(r > terminal) || !Number.isFinite(fcf)) return null;
  let value = 0;
  let cash = fcf;
  for (let t = 1; t <= years; t += 1) { cash *= 1 + g; value += cash / (1 + r) ** t; }
  return value + cash * (1 + terminal) / (r - terminal) / (1 + r) ** years;
}

export const REVERSE_DCF_DEFAULTS = Object.freeze({ discountRate: 0.09, terminalGrowth: 0.025, years: 10 });
export const REVERSE_DCF_SEARCH = Object.freeze({ low: -0.5, high: 1 });

// The yearly FCF growth over the explicit period that makes the DCF value equal to the market value (price × shares).
// The value rises with g, so a bisection finds it; outside the search range the result says so instead of a number.
export function impliedGrowth({ fcf, marketValue, discountRate, terminalGrowth, years = 10 }) {
  if (!(fcf > 0) || !(marketValue > 0)) return { state: 'invalid' };
  if (!(discountRate > terminalGrowth)) return { state: 'rate-below-terminal' };
  const f = (g) => dcfValue(fcf, g, discountRate, terminalGrowth, years) - marketValue;
  let { low, high } = REVERSE_DCF_SEARCH;
  if (f(high) < 0) return { state: 'above-range', bound: high };
  if (f(low) > 0) return { state: 'below-range', bound: low };
  for (let i = 0; i < 100; i += 1) {
    const mid = (low + high) / 2;
    if (f(mid) > 0) high = mid; else low = mid;
  }
  return { state: 'ready', growth: (low + high) / 2 };
}

// Inputs from real records only: the latest fiscal year's FCF (operating cash flow − capital spending), the SEC share
// count and a dated completed close. Each missing piece is named; FCF ≤ 0 is not solved (no growth rate makes a negative
// cash flow worth a positive price in this model).
export function reverseDcfInputs({ history, fundamentals, close, financial = false, nowMs = Date.now() }) {
  if (financial) return { state: 'financial', reason: '은행·대출 금융사는 영업현금흐름에 예금·대출 증감이 섞여 잉여현금흐름으로 가치를 계산하지 않습니다.' };
  const latest = sorted(history).at(-1);
  if (!latest) return { state: 'missing', reason: 'SEC 연간 현금흐름 기록이 없어 계산하지 않습니다.' };
  const stale = annualStaleReason({ periodEnd: latest.periodEnd, fundamentals, nowMs, shares: finite(fundamentals?.sharesOutstanding) > 0 });
  if (stale) return { state: 'stale', periodEnd: latest.periodEnd, reason: `${stale}.` };
  const ocf = finite(latest.operatingCashFlow), capex = finite(latest.capex);
  if (ocf == null || capex == null) return { state: 'missing', reason: `${fyLabel(latest.periodEnd)} 영업현금흐름 또는 설비투자가 공시 수집본에 없어 잉여현금흐름을 만들 수 없습니다.` };
  const fcf = ocf - capex;
  if (!(fcf > 0)) return { state: 'fcf-negative', fcf, periodEnd: latest.periodEnd, reason: `${fyLabel(latest.periodEnd)} 잉여현금흐름이 0 이하라(영업현금흐름 − 설비투자 ≤ 0) 현재 가격이 가정하는 성장률을 풀 수 없습니다.` };
  const shares = finite(fundamentals?.sharesOutstanding);
  if (!(shares > 0)) return { state: 'missing', reason: '검증된 주식 수가 없어(공시 표지 주식 수 미확인) 시가총액을 만들지 않습니다.' };
  const price = finite(close?.value);
  if (!(price > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(String(close?.date || ''))) return { state: 'missing', reason: '날짜가 확인된 종가가 아직 없어 계산하지 않습니다.' };
  return { state: 'ready', fcf, periodEnd: latest.periodEnd, label: fyLabel(latest.periodEnd), ocf, capex, shares, sharesObservedAt: fundamentals?.sharesObservedAt || null, price, priceDate: close.date, marketValue: price * shares };
}

// ── v58.75 (persona review): 재무 공시 for fundamental investors and traders ─────────────────────────────────────────────
// The latest four consecutive fiscal quarters summed (sec-fiscal-history `quarters`), beside the same four quarters a year
// earlier. Null unless all four are consecutive and carry both revenue and net income; the prior span only when it is the
// eight-quarter run directly before. A derived fourth quarter (FY − Q1..Q3) counts, as everywhere else on the page.
export function buildTrailingYearRead(quarters = []) {
  const span = trailingQuarters(quarters, 4);
  if (!span || !span.every((q) => finite(q.revenue) != null)) return null;
  const sum = (rows, field) => rows.reduce((total, q) => total + q[field], 0);
  const revenue = sum(span, 'revenue');
  const netIncome = sum(span, 'netIncome');
  const run = trailingQuarters(quarters, 8);
  const prior = run && run.slice(0, 4).every((q) => finite(q.revenue) != null) ? run.slice(0, 4) : null;
  const priorRevenue = prior ? sum(prior, 'revenue') : null;
  const priorIncome = prior ? sum(prior, 'netIncome') : null;
  return {
    from: span[0].periodEnd, through: span[3].periodEnd, revenue, netIncome, margin: revenue > 0 ? netIncome / revenue * 100 : null,
    revenueYoy: priorRevenue > 0 ? (revenue / priorRevenue - 1) * 100 : null,
    netIncomeYoy: priorIncome > 0 ? (netIncome / priorIncome - 1) * 100 : null,
    priorMargin: priorRevenue > 0 ? priorIncome / priorRevenue * 100 : null,
    hasDerived: span.some((q) => q.derived)
  };
}

// The next report: the provider calendar's dated row (the week rows or the six-week `upcoming` map) when one is on or after
// today (New York date), else the last reported date from the consensus row and "not yet scheduled". No date is projected
// from the last report (no "+91 days").
const HOUR_LABELS = Object.freeze({ bmo: '장 시작 전', amc: '장 마감 후', dmh: '장중' });
const monthDay = (iso) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;
export function usDateFromSlash(text) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(text || '').trim());
  return m ? `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
}
export function buildEarningsSchedule({ symbol, calendar = null, consensus = null, nowMs = Date.now() } = {}) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym || /\.K[SQ]$/.test(sym)) return null;
  const today = dateInTimezone(nowMs, 'America/New_York');
  const key = sym.replace(/[./]/g, '-');
  const usable = !!calendar && calendar.status !== 'operator-key-required';
  const candidates = [];
  if (usable) {
    const mapped = String(calendar.upcoming?.[key] || '').split('|');
    if (/^\d{4}-\d{2}-\d{2}$/.test(mapped[0] || '')) candidates.push({ date: mapped[0], hour: mapped[1] || null });
    for (const row of Array.isArray(calendar.earnings) ? calendar.earnings : []) {
      if (String(row?.symbol || '').toUpperCase().replace(/[./]/g, '-') === key && /^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || ''))) candidates.push({ date: row.date, hour: row.hour || null });
    }
  }
  const next = candidates.filter((item) => today && item.date >= today).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  const lastReported = usDateFromSlash(consensus?.trailing?.lastReportedAt);
  const windowEnd = String(calendar?.upcomingWindow?.to || calendar?.weekEnd || '').slice(0, 10) || null;
  // v58.75 review: days the producer failed to read are listed; a missing date then is not "no report in the window".
  const gaps = Array.isArray(calendar?.upcomingGaps) ? calendar.upcomingGaps.length : 0;
  if (next) {
    const sessions = next.date === today ? 0 : countOpenSessionsBetween(today, next.date, 'US');
    const hour = HOUR_LABELS[next.hour] || null;
    return { state: 'scheduled', date: next.date, hour, sessions, lastReported,
      text: `다음 실적 ${next.date === today ? '오늘' : monthDay(next.date)}${hour ? `(${hour})` : ''}${next.date === today ? '' : `, ${sessions}거래일 후`}` };
  }
  return { state: usable ? 'unconfirmed' : 'unknown', date: null, lastReported, windowEnd,
    text: `${lastReported ? `직전 발표 ${monthDay(lastReported)}, ` : ''}다음 실적 일정 미확정`,
    title: usable && windowEnd ? `실적 일정 목록(${windowEnd}까지)에 아직 날짜가 없습니다${gaps ? `. 이번 수집에서 ${gaps}일치 일정을 받지 못해 그날 발표가 빠졌을 수 있습니다` : ''}. 지난 발표일로 날짜를 추정하지 않습니다.` : '실적 일정 자료를 받지 못했습니다.' };
}

// Reported adjusted EPS against the consensus that stood before each report (consensus-estimates `hist`, newest first in the
// artifact, oldest first here). Reference only: it never enters a score.
export function buildSurpriseRead(consensus = null) {
  const rows = String(consensus?.hist || '').split(';').map((part) => part.split(':'))
    .filter((cells) => /^\d{4}-\d{2}$/.test(cells[0] || '') && finite(cells[1]) != null && finite(cells[2]) != null)
    .map(([quarter, eps, est]) => {
      const actual = finite(eps), estimate = finite(est);
      return { quarter, actual, estimate, surprise: estimate !== 0 ? (actual - estimate) / Math.abs(estimate) * 100 : null };
    }).reverse();
  if (!rows.length) return null;
  const beats = rows.filter((row) => row.actual > row.estimate).length;
  const misses = rows.filter((row) => row.actual < row.estimate).length;
  const surprises = rows.map((row) => row.surprise).filter((value) => value != null);
  const average = surprises.length ? surprises.reduce((a, b) => a + b, 0) / surprises.length : null;
  return { rows, beats, misses, average, latest: rows.at(-1), asOf: String(consensus?.asOf || '').slice(0, 10) || null };
}

// Gross → operating → net margin, net cash and the capital-return line from the latest year that carries the v58.75 columns.
// 'pending' = the issuer's record predates them; a column the filer does not tag is null (never zero).
export function buildMarginCashRead(history = []) {
  const rows = sorted(history);
  if (!rows.length) return { state: 'none' };
  const latest = rows.filter((year) => year.capitalChain).at(-1);
  if (!latest) return { state: 'pending' };
  const revenue = finite(latest.revenue);
  const ratio = (value) => (revenue > 0 && finite(value) != null ? finite(value) / revenue * 100 : null);
  const prior = rows.filter((year) => year.capitalChain && year.periodEnd < latest.periodEnd).at(-1) || null;
  const priorRevenue = finite(prior?.revenue);
  const priorRatio = (field) => (prior && priorRevenue > 0 && finite(prior[field]) != null ? finite(prior[field]) / priorRevenue * 100 : null);
  const ladder = [
    { id: 'gross', label: '매출총이익률', value: ratio(latest.grossProfit), prior: priorRatio('grossProfit') },
    { id: 'operating', label: '영업이익률', value: ratio(latest.operatingIncome), prior: priorRatio('operatingIncome') },
    { id: 'net', label: '순이익률', value: ratio(latest.netIncome), prior: priorRatio('netIncome') }
  ];
  const cash = finite(latest.cash);
  const sti = finite(latest.shortTermInvestments);
  const debt = finite(latest.longTermDebt);
  const liquid = cash != null ? cash + (sti ?? 0) : null;
  const ocf = finite(latest.operatingCashFlow), capex = finite(latest.capex);
  const fcf = ocf != null && capex != null ? ocf - capex : null;
  const buybacks = finite(latest.buybacks), dividends = finite(latest.dividends), sbc = finite(latest.shareBasedCompensation);
  const returned = buybacks != null || dividends != null ? (buybacks ?? 0) + (dividends ?? 0) : null;
  return {
    state: 'ready', periodEnd: latest.periodEnd, label: fyLabel(latest.periodEnd), priorLabel: prior ? fyLabel(prior.periodEnd) : null, ladder,
    cash: liquid == null ? null : { cash, shortTermInvestments: sti, liquid, debt, net: debt != null ? liquid - debt : null },
    capital: { sbc, sbcRatio: ratio(sbc), buybacks, dividends, returned, fcf, returnedShareOfFcf: returned != null && fcf > 0 ? returned / fcf * 100 : null }
  };
}

// Same-theme companies by name (AIO themes: the smallest sub-themes holding this listing first, then the theme leaders),
// with the numbers a reader compares across a peer group. Only issuers with a SEC fiscal series; at most `max`.
export function buildThemePeers({ symbol, themes = [], rows = [], seriesFor = () => null, consensusFor = () => null, max = 8 } = {}) {
  const sym = String(symbol || '').toUpperCase();
  const norm = (value) => String(value || '').toUpperCase();
  const subs = [];
  let theme = null;
  for (const item of Array.isArray(themes) ? themes : []) {
    for (const sub of item?.subThemes || []) if ((sub.tickers || []).some((ticker) => norm(ticker) === sym)) { subs.push(sub); theme ||= item; }
    if (!theme && (item?.leaders || []).some((ticker) => norm(ticker) === sym)) theme = item;
  }
  if (!theme) return null;
  subs.sort((a, b) => (a.tickers || []).length - (b.tickers || []).length);
  const ordered = [...new Set([...subs.flatMap((sub) => (sub.tickers || []).map(norm)), ...(theme.leaders || []).map(norm)])].filter((ticker) => ticker !== sym);
  const byRow = new Map((Array.isArray(rows) ? rows : []).map((row) => [norm(row?.sym), row]));
  const line = (ticker, self = false) => {
    const metrics = fiscalMetricsOf(seriesFor(ticker));
    if (!metrics) return null;
    const row = byRow.get(ticker) || null;
    const pe = finite(row?.pe);
    // v58.75 ('고르는 법' B2): FCF margin, the consensus forward PER and the 3-month return feed the strengths/weaknesses facts.
    const fwdPe = consensusView(row, consensusFor(ticker))?.fwdPe ?? null;
    return { sym: ticker, name: row?.name || ticker, self, periodEnd: metrics.periodEnd, growth: metrics.growth, margin: metrics.margin, roe: metrics.roe, pe: pe != null && pe > 0 ? pe : null,
      fcfMargin: metrics.fcfMargin, fwdPe: fwdPe != null && fwdPe > 0 ? fwdPe : null, ret3m: finite(row?.ret3m) };
  };
  const own = line(sym, true);
  if (!own) return null;
  const peers = [];
  for (const ticker of ordered) { if (peers.length >= max) break; const item = line(ticker); if (item) peers.push(item); }
  if (peers.length < 3) return null;
  return { themeId: theme.id, themeName: theme.nameKr || theme.name || theme.id, subNames: [...new Set(subs.map((sub) => sub.name))], rows: [own, ...peers] };
}
