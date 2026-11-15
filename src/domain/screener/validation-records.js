// Reads of the screener's validation records for the 사후 검증 view. The 10-year factor study
// (public-data/factor-backtest-longrun.json, also read by its producer): how old it is against the window after which
// it no longer describes the current model or universe, and its composite IC by holding length. The daily back-test:
// each market's own IC beside the pooled one. The study's universe is chosen on the run date, so an old study is shown
// with its date. Same window as the lineage audit's research-horizon policy for this file (scripts/ci-data-lineage-audit.mjs).
export const LONGRUN_STALE_AFTER_DAYS = 120;

export function longrunStudyAge(artifact, nowMs = Date.now()) {
  const at = Date.parse(artifact?.generatedAt || '');
  if (!Number.isFinite(at)) return { ageDays: null, stale: true };
  const ageDays = Math.floor((nowMs - at) / 86400000);
  return { ageDays, stale: ageDays > (artifact?.methodology?.staleAfterDays ?? LONGRUN_STALE_AFTER_DAYS) };
}

/** IC by holding length, shortest first; [] for a study written before the producer stored the rows. */
export function longrunIcDecay(artifact) {
  const rows = Array.isArray(artifact?.icDecay?.rows) ? artifact.icDecay.rows : [];
  return rows
    .filter((row) => Number.isFinite(row?.horizonDays) && Number.isFinite(row?.meanIc))
    .map((row) => ({ horizonDays: row.horizonDays, meanIc: row.meanIc, hacTStat: Number.isFinite(row.hacTStat) ? row.hacTStat : null }))
    .sort((a, b) => a.horizonDays - b.horizonDays);
}

/** Each market's own composite IC from a back-test record (icByMarket), in the record's market order. */
export function marketIcRows(backtest) {
  return Object.entries(backtest?.icByMarket || {})
    .map(([market, row]) => ({ market, ic: row?.ic || null, composite: Number.isFinite(row?.ic?.composite) ? row.ic.composite : null,
      dates: Array.isArray(row?.dates) ? row.dates.length : Number.isFinite(row?.dates) ? row.dates : null, meanStocks: Number.isFinite(row?.meanStocks) ? row.meanStocks : null }))
    .filter((row) => row.ic && Object.values(row.ic).some((value) => Number.isFinite(value)));
}
