// P1465: read of the forward candidate record (public-data/screener-candidate-archive.json), shared by
// the producer (which stores it as the artifact's summary) and the page. Only measured entries of
// the latest ranking identity are averaged, so a model change starts a new record.
const isNum = (value) => typeof value === 'number' && Number.isFinite(value);
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const round = (value, digits = 4) => (isNum(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);

// Small read for the page (also used by the gate): counts and averages over measured entries that
// share the latest identity, so a model change starts a new record instead of mixing two models.
export function summarizeCandidateArchive(archive) {
  const entries = Array.isArray(archive?.entries) ? archive.entries : [];
  const latest = entries[entries.length - 1] || null;
  const identity = latest?.identity || null;
  const measured = entries.filter((entry) => entry.outcome && entry.identity === identity);
  const spread = measured.map((entry) => entry.outcome.spreadPct).filter(isNum);
  const vsUniverse = measured.map((entry) => entry.outcome.topVsUniversePct).filter(isNum);
  return {
    recorded: entries.length,
    sameModelRecorded: entries.filter((entry) => entry.identity === identity).length,
    measured: measured.length,
    firstDate: entries[0]?.date || null,
    latestDate: latest?.date || null,
    meanSpreadPct: round(mean(spread), 3),
    meanTopVsUniversePct: round(mean(vsUniverse), 3),
    topBeatUniverse: vsUniverse.filter((value) => value > 0).length,
    identity
  };
}

// Measured entries of the latest identity, oldest first, for the page's bars.
export function measuredCandidateEntries(archive, limit = 30) {
  const entries = Array.isArray(archive?.entries) ? archive.entries : [];
  const identity = entries[entries.length - 1]?.identity || null;
  return entries.filter((entry) => entry.outcome && entry.identity === identity).slice(-limit);
}
