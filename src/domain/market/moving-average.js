// P1339: S&P 500 50/200-day moving averages from the committed daily history (public-data/history.json).
// The trend input otherwise depends on a live Yahoo chart fetch through a CORS proxy; when that fails the
// market-environment score was held. Completed daily closes match the close-basis rule (R670), so the
// history is a valid fallback — never a replacement for a fresher live series.
export function spxMovingAveragesFromHistory(rows) {
  if (!Array.isArray(rows)) return null;
  const dated = rows.filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(String(row?.date || '')) && Number(row?.spx) > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (dated.length < 200) return null;
  const closes = dated.map((row) => Number(row.spx));
  const mean = (n) => Math.round((closes.slice(-n).reduce((sum, v) => sum + v, 0) / n) * 100) / 100;
  return Object.freeze({ 50: mean(50), 200: mean(200), asOf: dated[dated.length - 1].date });
}
