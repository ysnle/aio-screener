// Dated inputs for replays: the producers' inputs as they stood at the close of one past session, read from what is on
// disk (history.json rows, macro-history.json, the frozen 2026 crash-replay closes). No network, no clock: every reader
// gets the session as its `now`.

// The frozen 2026 replay fixture (one array per field over its session dates) back to history rows. A breadth field's
// eligible denominator returns as its fieldMeta, the only provenance the regime reads from these rows.
export function replayFixtureRows(fixture) {
  const dates = Array.isArray(fixture?.dates) ? fixture.dates : [];
  const series = fixture?.series || {};
  return dates.map((date, i) => {
    const row = { date };
    for (const [field, values] of Object.entries(series)) if (Number.isFinite(values?.[i])) row[field] = values[i];
    for (const [field, byDate] of Object.entries(fixture?.eligible || {})) {
      if (Number.isFinite(byDate?.[date])) (row.fieldMeta ||= {})[field] = { eligible: byDate[date] };
    }
    return row;
  });
}

const observationsThrough = (macroHistory, key, date) => (macroHistory?.series?.[key]?.observations || []).filter(([day, value]) => day <= date && Number.isFinite(value));

/** macro-history.json cut at `date`: each series keeps the observations dated on or before it. */
export function macroHistoryThrough(macroHistory, date, keys = Object.keys(macroHistory?.series || {})) {
  return { ...macroHistory, series: Object.fromEntries(keys.map((key) => [key, { ...macroHistory.series[key], observations: observationsThrough(macroHistory, key, date) }])) };
}

/**
 * The market-read input at the close of `date` (the browser's collectMarketInputs, rebuilt from the stored series): the
 * HY level and its 5-observation change, and the rates split from FRED observations dated on or before that close.
 */
export function marketInputsAt(rows, macroHistory, date) {
  const history = rows.filter((row) => row.date <= date);
  const hy = observationsThrough(macroHistory, 'hyOas', date);
  const credit = hy.length ? { hyBp: hy.at(-1)[1] * 100, hyAsOf: hy.at(-1)[0], hyDelta5Bp: hy.length > 5 ? (hy.at(-1)[1] - hy.at(-6)[1]) * 100 : null } : {};
  const real = observationsThrough(macroHistory, 'realYield10', date), bei = observationsThrough(macroHistory, 'breakeven10', date);
  const two = observationsThrough(macroHistory, 'dgs2', date);
  const rates = {};
  if (real.length > 5 && bei.length > 5) Object.assign(rates, { realYield10: real.at(-1)[1], realYield10Delta5: real.at(-1)[1] - real.at(-6)[1], breakeven10Delta5: bei.at(-1)[1] - bei.at(-6)[1], asOf: real.at(-1)[0], realAsOf: real.at(-1)[0], breakevenAsOf: bei.at(-1)[0] });
  if (two.length > 5) Object.assign(rates, { dgs2Delta5: two.at(-1)[1] - two.at(-6)[1], dgs2AsOf: two.at(-1)[0], asOf: rates.asOf || two.at(-1)[0] });
  return { history, macroHistory, credit, rates, now: Date.parse(`${date}T22:00:00Z`) };
}
