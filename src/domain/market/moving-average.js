// P1339: S&P 500 50/200-day moving averages from the committed daily history (public-data/history.json).
// The trend input otherwise depends on a live Yahoo chart fetch through a CORS proxy; when that fails the
// market-environment score was held. Completed daily closes match the close-basis rule (R670), so the
// history is a valid fallback — never a replacement for a fresher live series.
import { sessionDateInMarket, isValidMarketDate as validDate } from './session-time.js';

export function spxMovingAveragesFromHistory(rows, { asOf = null } = {}) {
  if (!Array.isArray(rows)) return null;
  // P1349: history.date is a collection bucket; repeated weekend observations
  // belong to the same NY trading session. Conflicting closes are held, not guessed.
  const unique = new Map();
  for (const row of rows) {
    if (!validDate(row?.date)
      || !['number', 'string'].includes(typeof row.spx) || !String(row.spx).trim()
      || !Number.isFinite(Number(row.spx)) || Number(row.spx) <= 0) continue;
    const meta = row.fieldMeta?.spx;
    let date = row.date;
    if (meta) {
      if (meta.valueBasis !== 'latest-completed-close' && meta.observationRelation !== 'latest-completed-close') continue;
      if (meta.observationRelation && meta.observationRelation !== 'latest-completed-close') continue;
      if (meta.valueBasis && !['latest-completed-close', 'regular-session-close'].includes(meta.valueBasis)) continue;
      date = validDate(meta.observedAt) ? meta.observedAt : sessionDateInMarket(meta.observedAt, 'US');
    }
    if (!validDate(date) || (asOf && date > asOf)) continue;
    const value = Number(row.spx);
    const previous = unique.get(date);
    unique.set(date, { date, spx: value, conflict: previous?.conflict === true || (previous != null && previous.spx !== value) });
  }
  const dated = [...unique.values()]
    .sort((a, b) => a.date.localeCompare(b.date));
  if (dated.length < 200 || dated.slice(-200).some((row) => row.conflict)) return null;
  const closes = dated.map((row) => Number(row.spx));
  const mean = (n) => Math.round((closes.slice(-n).reduce((sum, v) => sum + v, 0) / n) * 100) / 100;
  return Object.freeze({ 50: mean(50), 200: mean(200), asOf: dated[dated.length - 1].date });
}
