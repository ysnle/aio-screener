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
    identity,
    independent: independentEvidence(measured),
    ...shadowSummary(entries)
  };
}

// Expertise review 2026-10-19: daily entries held 21 sessions overlap, so twenty consecutive entries are about one
// independent observation and their average t-statistic is badly inflated. Evidence uses only entries that start on
// or after the previous chosen entry's forward date. The decision rule is fixed before the data: fewer than
// INDEPENDENT_MIN independent entries is 'insufficient'; otherwise the rank is 'supported' only when the mean US rank
// IC is positive with t >= 2, else 'not-supported'.
export const INDEPENDENT_MIN = 12;
export function independentEvidence(measured) {
  const chosen = [];
  for (const entry of measured) {
    const last = chosen[chosen.length - 1];
    if (!last || (last.outcome.forwardDate && entry.date >= last.outcome.forwardDate)) chosen.push(entry);
  }
  const stat = (values) => {
    const list = values.filter(isNum);
    if (list.length < 2) return { n: list.length, mean: list.length ? round(list[0], 4) : null, t: null };
    const m = mean(list);
    const sd = Math.sqrt(list.reduce((sum, value) => sum + (value - m) ** 2, 0) / (list.length - 1));
    return { n: list.length, mean: round(m, 4), t: sd > 0 ? round(m / (sd / Math.sqrt(list.length)), 2) : null };
  };
  const icUS = stat(chosen.map((entry) => entry.outcome.rankIc?.US?.ic));
  const icKR = stat(chosen.map((entry) => entry.outcome.rankIc?.KR?.ic));
  const topVsUniverse = stat(chosen.map((entry) => entry.outcome.topVsUniversePct));
  const decision = chosen.length < INDEPENDENT_MIN || icUS.n < INDEPENDENT_MIN ? 'insufficient' : icUS.mean > 0 && icUS.t >= 2 ? 'supported' : 'not-supported';
  return { n: chosen.length, dates: chosen.map((entry) => entry.date), icUS, icKR, topVsUniverse, decision, min: INDEPENDENT_MIN };
}

// 2026-10-16: the candidate model recorded beside the default ranking (entry.shadow), averaged over its own latest
// identity on the same dates. Absent until the producer has written a shadow record.
function shadowSummary(entries) {
  const withShadow = entries.filter((entry) => entry?.shadow?.identity);
  const identity = withShadow[withShadow.length - 1]?.shadow.identity || null;
  if (!identity) return {};
  const same = withShadow.filter((entry) => entry.shadow.identity === identity);
  const measured = same.filter((entry) => entry.shadow.outcome);
  const vsUniverse = measured.map((entry) => entry.shadow.outcome.topVsUniversePct).filter(isNum);
  return {
    shadow: {
      model: same[same.length - 1].shadow.model || null,
      identity,
      recorded: same.length,
      measured: measured.length,
      meanSpreadPct: round(mean(measured.map((entry) => entry.shadow.outcome.spreadPct).filter(isNum)), 3),
      meanTopVsUniversePct: round(mean(vsUniverse), 3),
      topBeatUniverse: vsUniverse.filter((value) => value > 0).length
    }
  };
}

// Measured entries of the latest identity, oldest first, for the page's bars.
export function measuredCandidateEntries(archive, limit = 30) {
  const entries = Array.isArray(archive?.entries) ? archive.entries : [];
  const identity = entries[entries.length - 1]?.identity || null;
  return entries.filter((entry) => entry.outcome && entry.identity === identity).slice(-limit);
}
