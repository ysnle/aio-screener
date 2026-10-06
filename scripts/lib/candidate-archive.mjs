// P1465 (review 2026-10-04, "같은 정의로 앞으로 검증"): the back-test re-ranks the past; this
// archive records what the screen actually ranked on each completed session and, 21 of each
// stock's own sessions later, what those candidates returned. It is the only validation that
// cannot be fitted after the fact: the list is written before the outcome exists.
//
// Ranking parity: the producer runs the browser's own read path (createScreenerProvider →
// normalizeScreener → calculationRow → computeFactorRanks with the model default weights) on the
// artifacts it just wrote, so an entry is the default-profile ranking a visitor saw that session.
// Outcome: adjusted closes of completed sessions (the same series the factors use); each stock is
// measured on its own market's calendar. Equal-weight means, no costs — a candidate record, not a
// traded portfolio.
import { readFile } from 'node:fs/promises';
import { createScreenerProvider } from '../../src/data/providers/screener.js';
import { normalizeScreener } from '../../src/data/normalize/screener.js';
import { calculationRow } from '../../src/data/contracts/screener.js';
import { computeFactorRanks } from '../../src/domain/screener/factor-ranks.js';
import { MODEL_DEFAULT_WEIGHTS } from '../../src/domain/screener/factor-weights.js';
import { buildRankingIdentity } from '../../src/domain/screener/model-fingerprint.js';
import { marketOfSymbol } from '../../src/domain/market/session-time.js';
import { summarizeCandidateArchive } from '../../src/domain/screener/candidate-record.js';

export const CANDIDATE_ARCHIVE_SCHEMA = 'screener-candidate-archive.v1';
export const CANDIDATE_FWD_SESSIONS = 21;
export const CANDIDATE_LIST_RETENTION_DAYS = 60;
export const CANDIDATE_MAX_ENTRIES = 400;
const isNum = (value) => typeof value === 'number' && Number.isFinite(value);
const mean = (values) => (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null);
const round = (value, digits = 4) => (isNum(value) ? Math.round(value * 10 ** digits) / 10 ** digits : null);

// Rank the published artifacts exactly as the page does for the default profile.
export async function rankPublishedScreener({ root, now }) {
  const files = {
    './public-data/screener.json': 'public-data/screener.json',
    './public-data/screener-universe.json': 'public-data/screener-universe.json',
    './public-data/model-validation-status.json': 'public-data/model-validation-status.json'
  };
  const httpClient = {
    requestJson: async (url) => {
      try { return { ok: true, data: JSON.parse(await readFile(new URL(files[url] || url, root), 'utf8')) }; }
      catch (error) { return { ok: false, error: String(error?.message || error) }; }
    }
  };
  const provider = createScreenerProvider({ httpClient, clock: { now: () => now, iso: () => new Date(now).toISOString() }, yieldImpl: () => Promise.resolve() });
  const current = await provider.readCurrent();
  const normalized = normalizeScreener(current);
  const ranking = computeFactorRanks({
    rows: normalized.rows.map(calculationRow),
    weights: MODEL_DEFAULT_WEIGHTS,
    weightsPolicy: 'model-default',
    fundamentalCoveragePct: Number(normalized.metadata?.fundamentalCoveragePct) || 0,
    fmpOk: !!normalized.metadata?.fmpOk,
    now,
    inputVersion: normalized.revision || 'candidate-archive'
  });
  return { ranking, metadata: normalized.metadata || {} };
}

// Today's entry: the top and bottom fifth of ranked rows (rank, then composite z for ties).
export function buildCandidateEntry({ ranking, sessionDates = {}, recordedAt }) {
  if (!ranking?.available || !Array.isArray(ranking.rows)) return null;
  const ranked = ranking.rows.filter((row) => row?.sym && isNum(row.rank))
    .sort((a, b) => (b.rank - a.rank) || ((isNum(b._compositeZ) ? b._compositeZ : -Infinity) - (isNum(a._compositeZ) ? a._compositeZ : -Infinity)) || String(a.sym).localeCompare(String(b.sym)));
  if (ranked.length < 25) return null;
  const q = Math.floor(ranked.length / 5);
  const date = sessionDates.US || sessionDates.KR || null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return null;
  return {
    date,
    sessionDates: { US: sessionDates.US || null, KR: sessionDates.KR || null },
    recordedAt,
    identity: buildRankingIdentity({ appliedFactorWeights: ranking.appliedFactorWeights, activeFactors: ranking.activeFactors }),
    activeFactors: [...(ranking.activeFactors || [])],
    ranked: ranked.length,
    quintile: q,
    top: ranked.slice(0, q).map((row) => row.sym).join(','),
    bottom: ranked.slice(-q).map((row) => row.sym).join(','),
    universe: ranked.map((row) => row.sym).join(','),
    outcome: null
  };
}

// Forward return over `fwd` of the stock's own completed sessions from the entry's session date
// in that stock's market. A stock whose last bar is not that session (stale feed) is not measured.
export function forwardReturn(series, sessionDate, fwd = CANDIDATE_FWD_SESSIONS) {
  if (!series || !Array.isArray(series.dates) || !Array.isArray(series.adjCloses)) return null;
  const index = series.dates.indexOf(sessionDate);
  if (index < 0 || index + fwd >= series.dates.length) return null;
  const start = series.adjCloses[index];
  const end = series.adjCloses[index + fwd];
  if (!isNum(start) || !isNum(end) || start <= 0) return null;
  return { value: end / start - 1, forwardDate: series.dates[index + fwd] };
}

function measure(entry, seriesBySymbol, fwd) {
  const legs = {};
  const forwardDates = new Set();
  for (const leg of ['top', 'bottom', 'universe']) {
    const symbols = String(entry[leg] || '').split(',').filter(Boolean);
    const values = [];
    for (const symbol of symbols) {
      const market = marketOfSymbol(symbol);
      const result = forwardReturn(seriesBySymbol.get(symbol), entry.sessionDates?.[market] || entry.date, fwd);
      if (result) { values.push(result.value); if (market === 'US') forwardDates.add(result.forwardDate); }
    }
    legs[leg] = { mean: mean(values), measured: values.length, listed: symbols.length };
  }
  return { legs, forwardDates };
}

// Fill outcomes for entries whose forward window has closed; drop the symbol lists of measured
// entries after the retention window so the artifact stays small (the outcome remains).
export function fillCandidateOutcomes(archive, seriesBySymbol, { fwd = CANDIDATE_FWD_SESSIONS, today = null } = {}) {
  let filled = 0;
  for (const entry of archive.entries) {
    if (entry.outcome || entry.expired) continue;
    const { legs, forwardDates } = measure(entry, seriesBySymbol, fwd);
    const coverage = legs.top.listed ? Math.min(legs.top.measured / legs.top.listed, legs.bottom.measured / Math.max(1, legs.bottom.listed)) : 0;
    if (coverage < 0.8 || !isNum(legs.top.mean) || !isNum(legs.bottom.mean) || !isNum(legs.universe.mean)) continue;
    entry.outcome = {
      fwdSessions: fwd,
      forwardDate: [...forwardDates].sort().pop() || null,
      topPct: round(legs.top.mean * 100, 3),
      bottomPct: round(legs.bottom.mean * 100, 3),
      universePct: round(legs.universe.mean * 100, 3),
      spreadPct: round((legs.top.mean - legs.bottom.mean) * 100, 3),
      topVsUniversePct: round((legs.top.mean - legs.universe.mean) * 100, 3),
      measured: { top: legs.top.measured, bottom: legs.bottom.measured, universe: legs.universe.measured },
      listed: { top: legs.top.listed, bottom: legs.bottom.listed, universe: legs.universe.listed },
      costs: 'not-modelled'
    };
    filled += 1;
  }
  if (today) {
    const cutoff = new Date(Date.parse(`${today}T00:00:00Z`) - CANDIDATE_LIST_RETENTION_DAYS * 86400000).toISOString().slice(0, 10);
    for (const entry of archive.entries) {
      if (entry.date < cutoff) {
        delete entry.universe;
        if (entry.outcome) { delete entry.top; delete entry.bottom; }
        else if (!entry.expired) entry.expired = 'forward-window-not-measurable';
      } else if (entry.outcome) delete entry.universe; // measured: the universe list is no longer needed
    }
  }
  return filled;
}

export function upsertCandidateEntry(archive, entry) {
  if (!entry) return 'skipped';
  const index = archive.entries.findIndex((item) => item.date === entry.date);
  if (index >= 0) {
    if (archive.entries[index].outcome) return 'kept-measured';
    archive.entries[index] = entry;
    return 'replaced';
  }
  archive.entries.push(entry);
  archive.entries.sort((a, b) => a.date.localeCompare(b.date));
  if (archive.entries.length > CANDIDATE_MAX_ENTRIES) archive.entries = archive.entries.slice(-CANDIDATE_MAX_ENTRIES);
  return 'appended';
}

export function emptyCandidateArchive() {
  return {
    schemaVersion: CANDIDATE_ARCHIVE_SCHEMA,
    policy: `Each completed session: the default-profile ranking the page computes, top and bottom fifth recorded before outcomes exist; outcome = equal-weight mean adjusted-close return over each stock's next ${CANDIDATE_FWD_SESSIONS} completed sessions in its own market, no costs. Symbol lists kept ${CANDIDATE_LIST_RETENTION_DAYS} days; outcomes kept.`,
    allowedUse: 'research-validation-record; not a trading signal or performance claim',
    startedAt: null,
    generatedAt: null,
    entries: []
  };
}

export { summarizeCandidateArchive } from '../../src/domain/screener/candidate-record.js';

// The anchor session per market is the most common last completed bar among that market's series —
// the bar the factors were computed on. Using the series' own dates keeps entry and outcome on one
// calendar (a stock whose feed stopped earlier is not measured rather than shifted).
export function anchorSessionDates(seriesBySymbol) {
  const counts = { US: new Map(), KR: new Map() };
  for (const [symbol, series] of seriesBySymbol) {
    const last = Array.isArray(series?.dates) ? series.dates[series.dates.length - 1] : null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(last || ''))) continue;
    const bucket = counts[marketOfSymbol(symbol)];
    bucket.set(last, (bucket.get(last) || 0) + 1);
  }
  const mode = (bucket) => [...bucket.entries()].sort((a, b) => (b[1] - a[1]) || b[0].localeCompare(a[0]))[0]?.[0] || null;
  return { US: mode(counts.US), KR: mode(counts.KR) };
}

export async function updateCandidateArchive({ root, results, now = Date.now(), write }) {
  const url = new URL('public-data/screener-candidate-archive.json', root);
  let archive;
  try { archive = JSON.parse(await readFile(url, 'utf8')); } catch (_) { archive = null; }
  if (!archive || archive.schemaVersion !== CANDIDATE_ARCHIVE_SCHEMA || !Array.isArray(archive.entries)) archive = emptyCandidateArchive();
  const seriesBySymbol = new Map((results || []).filter((row) => row?.sym && Array.isArray(row.dates) && Array.isArray(row.adjCloses))
    .map((row) => [String(row.sym).toUpperCase(), { dates: row.dates, adjCloses: row.adjCloses }]));
  const { ranking } = await rankPublishedScreener({ root, now });
  const recordedAt = new Date(now).toISOString();
  const entry = buildCandidateEntry({ ranking, sessionDates: anchorSessionDates(seriesBySymbol), recordedAt });
  const action = upsertCandidateEntry(archive, entry);
  const filled = fillCandidateOutcomes(archive, seriesBySymbol, { today: recordedAt.slice(0, 10) });
  archive.startedAt = archive.startedAt || archive.entries[0]?.recordedAt || null;
  archive.generatedAt = recordedAt;
  archive.summary = summarizeCandidateArchive(archive);
  await write(url, `${JSON.stringify(archive)}\n`);
  return { action, filled, entries: archive.entries.length, measured: archive.summary.measured, date: entry?.date || null };
}
