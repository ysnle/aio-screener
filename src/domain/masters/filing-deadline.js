// The 13F currentness rule; the page renders this verdict instead of computing one.
// 13F is due 45 days after each quarter end; a holding set is stale once the following quarter's deadline has passed.
import { resolveMarketCalendarSession } from '../market/session/market-calendar.js';

const DAY_MS = 86400000;

// A deadline on a weekend or holiday rolls to the next business day (Exchange Act Rule 0-3). SEC closes on
// federal holidays; the registered NYSE calendar is used. The two differ by Good Friday (NYSE only), Columbus Day and
// Veterans Day (federal only), none of which can fall on or just after a 13F deadline (May 15, Aug 14, Nov 14,
// Feb 14/15), so the rolled date is the same. Presidents' Day (third Monday of February) is the holiday that moves
// one: Feb 14, 2026 (Saturday) is due Tuesday Feb 17. A year the calendar does not register rolls over weekends only.
function nextBusinessDay(ms) {
  let due = ms;
  for (let step = 0; step < 7; step += 1) {
    const date = new Date(due).toISOString().slice(0, 10);
    const session = resolveMarketCalendarSession({ market: 'US', date });
    const weekday = new Date(due).getUTCDay();
    const closed = session.status === 'unknown' ? weekday === 0 || weekday === 6 : session.status === 'closed';
    if (!closed) return due;
    due += DAY_MS;
  }
  return due;
}

export function thirteenFStale(periodOfReport, now = Date.now()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(periodOfReport || ''));
  if (!match) return false;
  const nextQuarterEnd = Date.UTC(Number(match[1]), Number(match[2]) + 3, 0);
  const due = nextBusinessDay(nextQuarterEnd + 45 * DAY_MS);
  return now >= due + DAY_MS;
}

/**
 * Whether a manager's holdings are past the next deadline, why, and the submission filed after them. `latestSubmission`
 * is the filer's newest SEC submission (the catalog carries it with the page; the discovery artifact repeats it). A later
 * 13F-NT means another filer reports the holdings (Pershing, Oaktree); no later submission means none has arrived (Scion).
 */
export function thirteenFCurrentness({ quarterEnd, holdingsAccession = null, latestSubmission = null, now = Date.now() } = {}) {
  if (!quarterEnd) return null;
  const later = latestSubmission?.filedAt && latestSubmission.accession !== holdingsAccession && String(latestSubmission.periodOfReport || '') > quarterEnd ? latestSubmission : null;
  const stale = thirteenFStale(quarterEnd, now);
  return { stale, reason: !stale ? null : later?.baseForm === '13F-NT' ? 'NOTICE_FILED' : 'NEXT_FILING_DUE', laterSubmission: later };
}
