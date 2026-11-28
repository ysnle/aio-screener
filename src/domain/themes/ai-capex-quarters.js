// The hyperscalers' cash flow quarter by quarter. groupCashflow (fundamental/quarterly-cashflow.js) sums twelve months;
// the questions here are about the newest quarter against the one before it: is the spending growth slowing, and has
// the group's free cash flow turned up while operating cash grows faster than capex. A quarter enters the group only
// when every hyperscaler has one ending within QUARTER_ALIGN_DAYS of it (ORCL's quarter ends a month before the
// others'), so each figure has one denominator — the same five companies — and one basis, its quarter-end range.
import { HYPERSCALERS } from '../fundamental/quarterly-cashflow.js';

const DAY_MS = 86400000;
export const AI_CAPEX_QUARTER_RULES = Object.freeze({
  alignDays: 46, // half a quarter: a quarter ending within this of the reference quarter is the same calendar quarter
  yearAgoDays: 20 // the year-ago quarter ends 365 days ± this earlier (the same tolerance groupCashflow uses)
});
export const AI_CAPEX_PACE_WORDS = Object.freeze({ slowing: '증가율 둔화', rising: '증가율 확대', flat: '증가율 같음' });
export const FCF_TURN_WORDS = Object.freeze({ turned: '바닥 통과', notYet: '바닥 통과 전' });

const ms = (iso) => Date.parse(`${String(iso || '').slice(0, 10)}T00:00:00Z`);
const growth = (now, before) => (Number.isFinite(now) && Number.isFinite(before) && before > 0 ? Math.round((now / before - 1) * 1000) / 10 : null);

/** The group's quarters, oldest first: { end, endRange, ocf, capex, fcf } — only quarters every member reported. */
export function hyperscalerQuarters(issuers = [], members = HYPERSCALERS) {
  const rows = members.map((symbol) => (Array.isArray(issuers) ? issuers : []).find((row) => row?.symbol === symbol));
  if (!rows.length || rows.some((row) => !Array.isArray(row?.quarters) || !row.quarters.length)) return [];
  const out = [];
  for (const anchor of rows[0].quarters) {
    const picks = rows.map((row) => row.quarters.find((q) => Math.abs(ms(q.end) - ms(anchor.end)) <= AI_CAPEX_QUARTER_RULES.alignDays * DAY_MS));
    if (picks.some((q) => !q || ![q.ocf, q.capex].every(Number.isFinite))) continue;
    const ends = picks.map((q) => String(q.end).slice(0, 10)).sort();
    const ocf = picks.reduce((sum, q) => sum + q.ocf, 0), capex = picks.reduce((sum, q) => sum + q.capex, 0);
    out.push({ end: ends.at(-1), endRange: [ends[0], ends.at(-1)], ocf, capex, fcf: ocf - capex });
  }
  return out.sort((a, b) => ms(a.end) - ms(b.end));
}

const yearBefore = (series, quarter) => series.find((q) => Math.abs(ms(quarter.end) - ms(q.end) - 365 * DAY_MS) <= AI_CAPEX_QUARTER_RULES.yearAgoDays * DAY_MS) || null;
const quarterBefore = (series, quarter) => {
  const index = series.indexOf(quarter);
  const prior = index > 0 ? series[index - 1] : null;
  return prior && Math.abs(ms(quarter.end) - ms(prior.end) - 91 * DAY_MS) <= AI_CAPEX_QUARTER_RULES.yearAgoDays * DAY_MS ? prior : null;
};
const yoyOf = (series, quarter, field) => { const then = quarter && yearBefore(series, quarter); return then ? growth(quarter[field], then[field]) : null; };

/**
 * The newest quarter's capex growth against a year earlier beside the quarter before it: { asOf, endRange, latestYoy,
 * priorYoy, priorEnd, state } with state 'slowing' | 'rising' | 'flat' (one decimal apart), or null without both.
 */
export function capexPace(series = []) {
  const latest = series.at(-1);
  const prior = latest ? quarterBefore(series, latest) : null;
  const latestYoy = yoyOf(series, latest, 'capex'), priorYoy = yoyOf(series, prior, 'capex');
  if (latestYoy == null || priorYoy == null) return null;
  return { asOf: latest.end, endRange: latest.endRange, priorEnd: prior.end, latestYoy, priorYoy,
    state: latestYoy < priorYoy ? 'slowing' : latestYoy > priorYoy ? 'rising' : 'flat' };
}

/**
 * FCF bottoming (2125930558207271389): operating cash growing faster than capex against a year earlier, and the group's
 * free cash flow above the quarter before. { asOf, endRange, fcf, priorFcf, priorEnd, ocfYoy, capexYoy, state } with
 * state 'turned' when both hold, else 'notYet'; null without the prior quarter or the year-ago one.
 */
export function fcfTurn(series = []) {
  const latest = series.at(-1);
  const prior = latest ? quarterBefore(series, latest) : null;
  const ocfYoy = yoyOf(series, latest, 'ocf'), capexYoy = yoyOf(series, latest, 'capex');
  if (!prior || ocfYoy == null || capexYoy == null) return null;
  return { asOf: latest.end, endRange: latest.endRange, priorEnd: prior.end, fcf: latest.fcf, priorFcf: prior.fcf, ocfYoy, capexYoy,
    state: ocfYoy > capexYoy && latest.fcf > prior.fcf ? 'turned' : 'notYet' };
}
