// v59.56 (X bookmarks 11/01 follow-up 1): quarterly operating cash flow and capital spending for the big-tech names.
// The 10/30 authors led with numbers AIO never collected — Amazon's trailing-twelve-month free cash flow, the big-tech
// capex total and capex ÷ operating cash flow. The screener's SEC ledger keeps annual 10-K cash facts only. Cash-flow
// statements in a 10-Q are year-to-date (3, 6, 9 months from the fiscal-year start), so a discrete quarter is the
// difference of two consecutive year-to-date values with the same start, and the fourth quarter is the 10-K fiscal
// year minus the nine-month value. Every figure is the filer's own tag; nothing is estimated, a missing link leaves
// the quarter (and any twelve-month sum that would need it) out. Pure: companyfacts JSON in, rows out.

import { readNumber } from '../shared/number.js';

export const BIGTECH_CASHFLOW_SCHEMA = 'bigtech-cashflow.v1';
// SEC CIKs (company_tickers.json). The hyperscaler group is the AI data-center spenders the authors summed.
export const BIGTECH_ISSUERS = Object.freeze([
  Object.freeze({ symbol: 'MSFT', cik: 789019, nameKo: '마이크로소프트', group: 'hyperscaler' }),
  Object.freeze({ symbol: 'GOOGL', cik: 1652044, nameKo: '알파벳', group: 'hyperscaler' }),
  Object.freeze({ symbol: 'AMZN', cik: 1018724, nameKo: '아마존', group: 'hyperscaler' }),
  Object.freeze({ symbol: 'META', cik: 1326801, nameKo: '메타', group: 'hyperscaler' }),
  Object.freeze({ symbol: 'ORCL', cik: 1341439, nameKo: '오라클', group: 'hyperscaler' }),
  Object.freeze({ symbol: 'AAPL', cik: 320193, nameKo: '애플', group: 'other' }),
  Object.freeze({ symbol: 'NVDA', cik: 1045810, nameKo: '엔비디아', group: 'other' }),
  Object.freeze({ symbol: 'AVGO', cik: 1730168, nameKo: '브로드컴', group: 'other' }),
  Object.freeze({ symbol: 'TSLA', cik: 1318605, nameKo: '테슬라', group: 'other' })
]);
export const HYPERSCALERS = Object.freeze(BIGTECH_ISSUERS.filter((row) => row.group === 'hyperscaler').map((row) => row.symbol));

// Priority order; for each period the first concept that has it wins (a filer that switched tags keeps its history).
export const CASHFLOW_CONCEPTS = Object.freeze({
  ocf: Object.freeze(['NetCashProvidedByUsedInOperatingActivities', 'NetCashProvidedByUsedInOperatingActivitiesContinuingOperations']),
  // Gross purchases of property and equipment as filed; a company's own "free cash flow" may net proceeds or
  // incentives (Amazon) or finance leases, so the reading names the SEC basis instead of the company's definition.
  capex: Object.freeze(['PaymentsToAcquirePropertyPlantAndEquipment', 'PaymentsToAcquireProductiveAssets', 'PaymentsToAcquireOtherPropertyPlantAndEquipment'])
});

const DAY = 86400000;
const PERIODIC = /^(10-Q|10-K)(\/A)?$/;
const days = (start, end) => { const a = Date.parse(start), b = Date.parse(end); return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / DAY) + 1 : null; };
// 52/53-week years: a quarter is 13 or 14 weeks, a year 52 or 53.
const SPAN = [null, [77, 105], [168, 196], [259, 287], [350, 378]];
export function quartersSpanned(start, end) {
  const n = days(start, end);
  if (n == null) return null;
  const hit = SPAN.findIndex((range) => range && n >= range[0] && n <= range[1]);
  return hit > 0 ? hit : null;
}
const nextDay = (iso) => new Date(Date.parse(iso) + DAY).toISOString().slice(0, 10);

/** Duration facts for one concept list → Map("start|end" → latest-filed row), US dollars, 10-Q/10-K only. */
export function durationFacts(companyFacts, concepts) {
  const out = new Map();
  for (const concept of concepts) {
    const rows = companyFacts?.facts?.['us-gaap']?.[concept]?.units?.USD;
    if (!Array.isArray(rows)) continue;
    const mine = new Map();
    for (const row of rows) {
      if (!row?.start || !row?.end || !PERIODIC.test(row.form || '') || readNumber(row.val) == null) continue;
      const span = quartersSpanned(row.start, row.end);
      if (!span) continue;
      const key = `${row.start}|${row.end}`;
      const prior = mine.get(key);
      // The latest filing for the same period wins (a restated comparative or a 10-K/A).
      if (!prior || String(row.filed || '') > String(prior.filed || '')) mine.set(key, { start: row.start, end: row.end, span, value: readNumber(row.val), filed: row.filed || null, form: row.form, accn: row.accn || null, concept });
    }
    for (const [key, row] of mine) if (!out.has(key)) out.set(key, row);
  }
  return out;
}

/** Discrete quarters from duration facts: reported three-month values, else the year-to-date difference. Ascending by end. */
export function discreteQuarters(facts) {
  const byEnd = new Map();
  const put = (row) => { const prior = byEnd.get(row.end); if (!prior || (prior.basis !== 'reported' && row.basis === 'reported')) byEnd.set(row.end, row); };
  const groups = new Map();
  for (const row of facts.values()) {
    if (row.span === 1) put({ start: row.start, end: row.end, value: row.value, basis: 'reported', filed: row.filed, concept: row.concept });
    if (!groups.has(row.start)) groups.set(row.start, []);
    groups.get(row.start).push(row);
  }
  for (const rows of groups.values()) {
    const bySpan = new Map(rows.map((row) => [row.span, row]));
    for (let n = 2; n <= 4; n += 1) {
      const cum = bySpan.get(n), prev = bySpan.get(n - 1);
      if (!cum || !prev) continue;
      put({ start: nextDay(prev.end), end: cum.end, value: cum.value - prev.value, basis: n === 4 ? 'fy-minus-9m' : 'ytd-difference',
        filed: [cum.filed, prev.filed].filter(Boolean).sort().at(-1) || null, concept: cum.concept });
    }
  }
  return [...byEnd.values()].sort((a, b) => a.end.localeCompare(b.end));
}

/** Quarters where both operating cash flow and capex are known, with free cash flow = OCF − capex. */
export function cashflowQuarters(companyFacts) {
  const ocf = new Map(discreteQuarters(durationFacts(companyFacts, CASHFLOW_CONCEPTS.ocf)).map((q) => [q.end, q]));
  const capex = new Map(discreteQuarters(durationFacts(companyFacts, CASHFLOW_CONCEPTS.capex)).map((q) => [q.end, q]));
  const rows = [];
  for (const [end, o] of ocf) {
    const c = capex.get(end);
    if (!c) continue;
    rows.push({ start: o.start, end, ocf: o.value, capex: c.value, fcf: o.value - c.value,
      basis: o.basis === 'reported' && c.basis === 'reported' ? 'reported' : (o.basis === 'fy-minus-9m' || c.basis === 'fy-minus-9m') ? 'fy-minus-9m' : 'ytd-difference',
      filed: [o.filed, c.filed].filter(Boolean).sort().at(-1) || null, concepts: { ocf: o.concept, capex: c.concept } });
  }
  return rows.sort((a, b) => a.end.localeCompare(b.end));
}

// Consecutive: each quarter starts within a week of the day after the previous one ended.
const follows = (prev, next) => Math.abs(Date.parse(next.start) - Date.parse(nextDay(prev.end))) <= 7 * DAY;

/** The four consecutive quarters ending at `quarters[endIndex]`, summed; null when any link is missing. */
export function trailingFour(quarters, endIndex = quarters.length - 1) {
  if (endIndex < 3) return null;
  const four = quarters.slice(endIndex - 3, endIndex + 1);
  for (let i = 1; i < 4; i += 1) if (!follows(four[i - 1], four[i])) return null;
  const sum = (field) => four.reduce((total, q) => total + q[field], 0);
  const ocf = sum('ocf'), capex = sum('capex');
  return { start: four[0].start, end: four[3].end, ocf, capex, fcf: ocf - capex, capexToOcfPct: ocf > 0 ? capex / ocf * 100 : null, filed: four.map((q) => q.filed).filter(Boolean).sort().at(-1) || null };
}

const pct = (now, before) => (Number.isFinite(now) && Number.isFinite(before) && before > 0 ? (now / before - 1) * 100 : null);
const round1 = (value) => (Number.isFinite(value) ? Math.round(value * 10) / 10 : null);

/** One issuer's companyfacts → { quarters (last 8), ttm, ttmYearAgo, capexYoyPct, latestQuarter } or a reason. */
export function issuerCashflow(companyFacts) {
  const quarters = cashflowQuarters(companyFacts);
  if (!quarters.length) return { status: 'no-cashflow-facts', quarters: [] };
  const ttm = trailingFour(quarters);
  const yearAgoIndex = ttm ? quarters.findIndex((q) => Math.abs(Date.parse(q.end) - (Date.parse(ttm.end) - 365 * DAY)) <= 20 * DAY) : -1;
  const ttmYearAgo = yearAgoIndex >= 0 ? trailingFour(quarters, yearAgoIndex) : null;
  const latest = quarters.at(-1);
  const latestYearAgo = quarters.find((q) => Math.abs(Date.parse(q.end) - (Date.parse(latest.end) - 365 * DAY)) <= 20 * DAY) || null;
  return {
    status: ttm ? 'ok' : 'ttm-gap',
    quarters: quarters.slice(-8),
    ttm,
    ttmYearAgo,
    capexYoyPct: round1(pct(ttm?.capex, ttmYearAgo?.capex)),
    latestQuarterCapexYoyPct: round1(pct(latest.capex, latestYearAgo?.capex))
  };
}

/** Group totals over the members whose twelve months are known; `complete` says whether every member is in. */
export function groupCashflow(issuers, members = HYPERSCALERS) {
  const rows = members.map((symbol) => issuers.find((row) => row.symbol === symbol)).filter((row) => row?.ttm);
  if (!rows.length) return null;
  const sum = (pick) => rows.reduce((total, row) => total + pick(row), 0);
  const ocf = sum((row) => row.ttm.ocf), capex = sum((row) => row.ttm.capex);
  const prior = rows.every((row) => row.ttmYearAgo) ? { ocf: sum((row) => row.ttmYearAgo.ocf), capex: sum((row) => row.ttmYearAgo.capex) } : null;
  return {
    members: rows.map((row) => row.symbol),
    missing: members.filter((symbol) => !rows.some((row) => row.symbol === symbol)),
    complete: rows.length === members.length,
    ends: Object.fromEntries(rows.map((row) => [row.symbol, row.ttm.end])),
    // v59.71 (quant review): "complete" means every member has twelve months, not the same twelve — one issuer not yet
    // reporting the new quarter mixes quarter ends. The spread is carried so the sentence names it.
    endSpreadDays: (() => { const ms = rows.map((row) => Date.parse(String(row.ttm.end || '').slice(0, 10))).filter(Number.isFinite); return ms.length ? Math.round((Math.max(...ms) - Math.min(...ms)) / 86400000) : null; })(),
    endRange: (() => { const list = rows.map((row) => String(row.ttm.end || '').slice(0, 10)).filter(Boolean).sort(); return list.length ? [list[0], list.at(-1)] : null; })(),
    ocf, capex, fcf: ocf - capex,
    capexToOcfPct: round1(ocf > 0 ? capex / ocf * 100 : null),
    yearAgo: prior ? { ocf: prior.ocf, capex: prior.capex, fcf: prior.ocf - prior.capex, capexToOcfPct: round1(prior.ocf > 0 ? prior.capex / prior.ocf * 100 : null) } : null,
    capexYoyPct: round1(pct(capex, prior?.capex))
  };
}

// ── reading helpers (prompt lines and the 거시 card share one wording) ──
export const usdB = (value) => (Number.isFinite(value) ? `${value < 0 ? '-' : ''}$${(Math.abs(value) / 1e9).toFixed(1)}B` : '—');
const md = (iso) => { const m = /^\d{4}-(\d{2})-(\d{2})/.exec(String(iso || '')); return m ? `${Number(m[1])}/${Number(m[2])}` : ''; };
const ym = (iso) => { const m = /^(\d{4})-(\d{2})/.exec(String(iso || '')); return m ? `${m[1]}.${m[2]}` : ''; };

/** "빅테크 5개사 최근 4분기 …" or '' when the group has no twelve-month total. */
export function groupCashflowSentence(group) {
  // A partial total is a different number (one missing spender moves the ratio), so it is not offered as the group's.
  if (!group?.complete) return '';
  const who = `빅테크 ${group.members.length}개사(${group.members.join('·')})`;
  const prior = group.yearAgo ? ` — 1년 전 ${group.yearAgo.capexToOcfPct}%, 설비투자 ${group.capexYoyPct >= 0 ? '+' : ''}${group.capexYoyPct}%` : '';
  const mixed = group.endSpreadDays > 45 && group.endRange ? `(분기 끝 ${md(group.endRange[0])}~${md(group.endRange[1])} 혼재)` : '';
  return `${who} 최근 4분기${mixed} 합계 설비투자 ${usdB(group.capex)} ÷ 영업현금흐름 ${usdB(group.ocf)} = ${group.capexToOcfPct}%, 잉여현금흐름 ${usdB(group.fcf)}${prior}`;
}

/** One issuer line: twelve months to the latest quarter end, the SEC basis named. */
export function issuerCashflowSentence(row) {
  if (!row?.ttm) return '';
  const yoy = row.capexYoyPct == null ? '' : `, 설비투자 1년 전 대비 ${row.capexYoyPct >= 0 ? '+' : ''}${row.capexYoyPct}%`;
  return `${row.symbol}(${row.nameKo}) ${ym(row.ttm.end)} 분기까지 최근 4분기 영업현금흐름 ${usdB(row.ttm.ocf)} · 설비투자 ${usdB(row.ttm.capex)} · 잉여현금흐름 ${usdB(row.ttm.fcf)}(설비투자 ÷ 영업현금흐름 ${round1(row.ttm.capexToOcfPct)}%${yoy}; SEC ${md(row.ttm.filed)} 공시까지)`;
}
