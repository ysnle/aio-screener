// v59.70 (owner 2026-11-04: "every card refreshes itself, or says it does not"): one registry for every public-data
// artifact the screens read — which workflow and producer refresh it, how often, when it counts as stale, and where its
// own clock and trading-session basis live. The producer ledger (scripts/write-freshness-ledger.mjs), the lineage audit,
// the watchdog and the browser reader (src/data/freshness.js) all read this one table; ci-artifact-refresh-path-check.mjs
// fails when a runtime-read artifact is missing from it, or when a workflow named here does not stage the file.
//
// Ledger schema (aio-freshness.v1, public-data/freshness/<workflow id>.json, one file per workflow so producers never race):
//   { schemaVersion, workflow, writtenAt, artifacts: { '<file>': {
//       producedAt,            // the artifact's own clock: when its content last changed
//       checkedAt,             // the last successful run that rewrote or confirmed it (content may be the same)
//       basisSession,          // { US?, KR?, ... } trading session the content reflects, when the artifact says
//       expectedEveryMinutes, staleAfterMinutes, workflow, producer,
//       lastAttempt: { at, status: 'updated' | 'unchanged' | 'not-written' | 'missing' | 'blocked' (absent while its blockedBy holds) },
//       contractDrift?         // ['clock'] / ['basis:US', ...] when the present artifact no longer resolves a
//     } } }                    // declared path (its producer changed shape); the watchdog names it
//
// Two clocks, graded together. checkedAt says the pipeline is alive (a run confirmed
// the file); basisSession says what the content is about. A producer whose upstream keeps returning the last session
// rewrites the file every cycle, so checkedAt alone graded a two-sessions-old screener 'current' while every screen built
// on it said "today". freshnessState is now the worse of the liveness grade and the session-lag grade.
import { stampDay } from '../../domain/shared/session-date.js';
import { observationSessionState, sessionLagGrade } from '../../domain/market/session/market-calendar.js';
import { FRESHNESS_POLICY } from '../../domain/shared/freshness-policy.js';

export const FRESHNESS_SCHEMA = 'aio-freshness.v1';

/** Ledger file for a workflow file name: refresh-data.yml -> public-data/freshness/refresh-data.json. */
export const freshnessLedgerPath = (workflow) => `public-data/freshness/${String(workflow).replace(/\.ya?ml$/, '')}.json`;

const auto = (workflow, producer, expectedEveryMinutes, staleAfterMinutes, extra = {}) =>
  Object.freeze({ refresh: 'auto', workflow, producer, expectedEveryMinutes, staleAfterMinutes, timestamp: ['generatedAt'], basis: [], volatileKeys: [], ledger: true, ...extra });
// ledger: false — the workflow commits only when content changes (event-briefs) or from a second job (screener-extended),
// so a per-run ledger would add a commit or a push race; readers fall back to the artifact's own clock.

// skipUnchanged: the commit keeps the published bytes when only volatileKeys (and generatedAt) moved (data audit R3:
// scenario-state 7 of 8 and today-verdict 8 of 8 recent commits differed only in generatedAt). checkedAt still moves.
const DERIVED = { skipUnchanged: true, volatileKeys: ['generatedAt'] };

export const ARTIFACT_FRESHNESS = Object.freeze({
  // refresh-data.yml (30-minute cycle; the weekend news cycle is hourly)
  'data.json': auto('refresh-data.yml', 'scripts/fetch-data.mjs', 30, 12 * 60, { timestamp: ['meta.generatedAt'] }),
  // history.json is { schemaVersion, fieldDictionary, rows }. A row's date is the market cut (a Sunday row exists), so
  // the basis is the session each index close belongs to. With every market closed a run re-checks the same
  // closes and moves only each field's checkedAt and the row's snapshot revision (Saturday 2026-11-21: 34 of 117,874
  // values); those runs keep the published 4 MB file instead of committing it again.
  'history.json': auto('refresh-data.yml', 'scripts/producer/history.mjs', 30, 3 * 24 * 60, { skipUnchanged: true, volatileKeys: ['rows.*.fieldMeta.*.checkedAt', 'rows.*.marketSnapshotRevision'], timestamp: ['rows.-1.cycleEnd', 'rows.-1.date'], basis: [['US', 'rows.-1.fieldMeta.spx.sessionDate', 'rows.-1.fieldMeta'], ['KR', 'rows.-1.fieldMeta.kospi.sessionDate', 'rows.-1.fieldMeta']] }),
  'market-snapshot.json': auto('refresh-data.yml', 'scripts/fetch-data.mjs', 30, 24 * 60, { timestamp: ['lastSuccessfulAt', 'generatedAt'] }),
  'macro-history.json': auto('refresh-data.yml', 'scripts/producer/macro-history.mjs', 30, 4 * 24 * 60, { ...DERIVED, volatileKeys: ['generatedAt', 'long.generatedAt'] }),
  // v59.70 (R11, theme-sector): the rotationHistory series beside data.json; the browser joins it by session, not clock.
  'rotation-detail.json': auto('refresh-data.yml', 'scripts/fetch-data.mjs', 30, 4 * 24 * 60, DERIVED),
  'macro-calendar.json': auto('refresh-data.yml', 'scripts/fetch-data.mjs', 30, 4 * 24 * 60, DERIVED),
  'telegram-digest.json': auto('refresh-data.yml', 'scripts/fetch-telegram-digest.mjs', 30, 12 * 60, { timestamp: ['generatedAt', 'lastSuccessfulAt'] }),
  'official-references.json': auto('refresh-data.yml', 'scripts/refresh-web-research.mjs', 12 * 60, 48 * 60, { timestamp: ['checkedAt'] }),
  'market-temperature.json': auto('refresh-data.yml', 'scripts/build-market-temperature.mjs', 4 * 60, 4 * 24 * 60, DERIVED),
  'scenario-state.json': auto('refresh-data.yml', 'scripts/build-scenario-state.mjs', 30, 48 * 60, { ...DERIVED, basis: [['US', 'basis.themeAsOfByMarket.US'], ['KR', 'basis.themeAsOfByMarket.KR']] }),
  'today-verdict.json': auto('refresh-data.yml', 'scripts/build-scenario-state.mjs', 30, 48 * 60, { ...DERIVED, basis: [['US', 'asOf']] }),
  'market-day.json': auto('refresh-data.yml', 'scripts/build-market-day.mjs', 30, 48 * 60, { ...DERIVED, basis: [['US', 'sessions.us'], ['KR', 'sessions.kr']] }),
  // Weekly producers offered a run on the daily lane: each exits before writing while its file is under seven days old,
  // so the row's clock moves weekly and a daily expectation graded them late five days in seven.
  'stress-outcomes.json': auto('refresh-data.yml', 'scripts/build-stress-outcomes.mjs', 7 * 24 * 60, 14 * 24 * 60, DERIVED),
  'scenario-outcomes.json': auto('refresh-data.yml', 'scripts/build-scenario-outcomes.mjs', 7 * 24 * 60, 14 * 24 * 60, DERIVED),
  'index-longrun.json': auto('refresh-data.yml', 'scripts/build-index-longrun.mjs', 7 * 24 * 60, 14 * 24 * 60, DERIVED),
  'reconciliation-status.json': auto('refresh-data.yml', 'scripts/build-reconciliation-status.mjs', 30, 24 * 60),
  'operations-status.json': auto('refresh-data.yml', 'scripts/build-operations-status.mjs', 30, 24 * 60),

  // refresh-screener.yml (every 6 h at :53, plus 21:53 UTC after the US close)
  'screener.json': auto('refresh-screener.yml', 'scripts/producer/screener.mjs', 6 * 60, 48 * 60, { timestamp: ['asOf'], basis: [['US', 'factorSessionDateByMarket.US'], ['KR', 'factorSessionDateByMarket.KR']] }),
  'sec-fundamentals-summary.json': auto('refresh-screener.yml', 'scripts/producer/screener.mjs', 6 * 60, 48 * 60),
  // These four moved only generatedAt on most screener runs (7 of 7 sampled pairs for the auctions, 5 of 7 for
  // the others), so they follow the DERIVED rule; a new filing, auction, weight or flow still commits.
  'sec-fiscal-history.json': auto('refresh-screener.yml', 'scripts/producer/screener.mjs', 6 * 60, 48 * 60, DERIVED),
  'earnings-calendar.json': auto('refresh-screener.yml', 'scripts/fetch-earnings-calendar.mjs', 6 * 60, 8 * 24 * 60),
  'consensus-estimates.json': auto('refresh-screener.yml', 'scripts/fetch-consensus-estimates.mjs', 6 * 60, 4 * 24 * 60),
  // Quarterly SEC filings: a rerun without a new filing moves only generatedAt and each issuer's fetchedAt.
  'bigtech-cashflow.json': auto('refresh-screener.yml', 'scripts/fetch-bigtech-cashflow.mjs', 6 * 60, 4 * 24 * 60, { skipUnchanged: true, volatileKeys: ['generatedAt', 'issuers.*.fetchedAt'] }),
  'treasury-auctions.json': auto('refresh-screener.yml', 'scripts/fetch-treasury-auctions.mjs', 6 * 60, 4 * 24 * 60, DERIVED),
  'sp500-weights.json': auto('refresh-screener.yml', 'scripts/fetch-sp500-weights.mjs', 24 * 60, 8 * 24 * 60, DERIVED),
  'us-listings.json': auto('refresh-screener.yml', 'scripts/build-us-listings.mjs', 24 * 60, 4 * 24 * 60),
  // Monthly numbers fetched every run: the producer writes on every successful fetch and the publisher keeps the bytes
  // when only the clock moved, so the row's checkedAt says the fetch worked (a producer-side skip left it late for weeks).
  'tw-monthly-revenue.json': auto('refresh-screener.yml', 'scripts/fetch-tw-monthly-revenue.mjs', 6 * 60, 62 * 24 * 60, DERIVED),
  // blockedBy: the refresh path exists but waits on a secret the owner has not added (or decided against); the watchdog
  // names it as a warning instead of failing every run, and the screen shows it as not collected.
  'kr-investor-flows.json': auto('refresh-screener.yml', 'scripts/fetch-kr-investor-flows.mjs', 6 * 60, 4 * 24 * 60, DERIVED),
  'kr-fundamentals.json': auto('refresh-screener.yml', 'scripts/fetch-dart-fundamentals.mjs', 7 * 24 * 60, 14 * 24 * 60, { blockedBy: 'secret DART_API_KEY (owner decision 2026-10-14: not registered)' }),
  'breadth-contributors.json': auto('refresh-screener.yml', 'scripts/producer/screener-breadth.mjs', 6 * 60, 8 * 24 * 60),
  'theme-stage-history.json': auto('refresh-screener.yml', 'scripts/build-scenario-state.mjs', 6 * 60, 8 * 24 * 60),
  // A row's date is the run day (weekend rows exist), not a US session, so it declares no session basis.
  'backtest-history.json': auto('refresh-screener.yml', 'scripts/producer/screener.mjs', 6 * 60, 14 * 24 * 60, { timestamp: ['-1.asOf'] }),
  'screener-candidate-archive.json': auto('refresh-screener.yml', 'scripts/producer/screener.mjs', 6 * 60, 8 * 24 * 60),
  'screener-extended.json': auto('refresh-screener.yml', 'scripts/producer/screener-extended.mjs', 24 * 60, 72 * 60, { timestamp: ['asOf'], ledger: false }),

  // event-briefs.yml (20 minutes; committed only when a brief changes)
  'event-briefs.json': auto('event-briefs.yml', 'scripts/fetch-event-briefs.mjs', 20, 100 * 24 * 60, { ledger: false }),
  'kr-index-weights.json': auto('event-briefs.yml', 'scripts/fetch-kr-index-weights.mjs', 24 * 60, 8 * 24 * 60, { ledger: false }),
});

/** Artifacts a person keeps by hand. Each names the gate that dates it, so none can silently age (refresh path = manual). */
export const MANUAL_ARTIFACTS = Object.freeze({
  'operator-note.json': { refresh: 'manual', expiryGate: 'scripts/ci-data-lineage-audit.mjs (operator-updated, 30 days)' },
  'screener-validation-gate.json': { refresh: 'manual', expiryGate: 'scripts/ci-data-lineage-audit.mjs (observedAt, 90 days)' },
  'model-validation-status.json': { refresh: 'manual', expiryGate: 'scripts/ci-data-lineage-audit.mjs (observedAt, 90 days)' },
  'user-research-digest.json': { refresh: 'manual', expiryGate: 'scripts/ci-data-lineage-audit.mjs (generatedAt, 90 days)' },
  'screener-universe.json': { refresh: 'manual', expiryGate: '.github/workflows/universe-review.yml (monthly review issue)' },
  // Hand-promoted from the manual research-backtest.yml run; the screener page reads it.
  'factor-backtest-longrun.json': { refresh: 'manual', expiryGate: 'scripts/ci-data-lineage-audit.mjs (generatedAt, 120 days)' },
  // Operator-captured snapshot (checkedAt 2026-08-21); refresh-web-research.mjs leaves it untouched.
  'structural-data-research.json': { refresh: 'manual', expiryGate: 'scripts/ci-data-lineage-audit.mjs (checkedAt, 14 days)' },
});

function readPath(value, path) {
  return String(path).split('.').reduce((node, key) => {
    if (node == null) return undefined;
    if (Array.isArray(node) && /^-\d+$/.test(key)) return node[node.length + Number(key)];
    return node[key];
  }, value);
}

/** The artifact's own clock (first present timestamp path), or null. */
export function artifactProducedAt(file, payload) {
  const entry = ARTIFACT_FRESHNESS[file];
  for (const path of entry?.timestamp || []) {
    const value = readPath(payload, path);
    if (value && Number.isFinite(Date.parse(value))) return new Date(Date.parse(value)).toISOString();
  }
  return null;
}

/** { US: 'YYYY-MM-DD', ... } from the artifact's basis paths; null when it declares none. */
export function artifactBasisSession(file, payload) {
  const out = {};
  for (const [market, path] of ARTIFACT_FRESHNESS[file]?.basis || []) {
    const value = readPath(payload, path);
    const day = stampDay(value);
    if (day) out[market] = day;
  }
  return Object.keys(out).length ? out : null;
}

/** Deep-equal after dropping dotted volatile keys. */
export function sameExceptVolatile(left, right, keys = []) {
  const strip = (value) => {
    if (!value || typeof value !== 'object') return value;
    const copy = JSON.parse(JSON.stringify(value));
    // A '*' part stands for every element (or member) at that level, so a per-row fetch clock
    // (bigtech-cashflow issuers.*.fetchedAt) is volatile too.
    const drop = (node, parts) => {
      if (!node || typeof node !== 'object') return;
      const [part, ...rest] = parts;
      const children = part === '*' ? Object.values(node) : [node[part]];
      if (!rest.length) { if (part === '*') Object.keys(node).forEach((name) => delete node[name]); else delete node[part]; return; }
      for (const child of children) drop(child, rest);
    };
    for (const key of keys) drop(copy, String(key).split('.'));
    return copy;
  };
  return JSON.stringify(strip(left)) === JSON.stringify(strip(right));
}

/**
 * ['clock'] and/or ['basis:<market>'] when the artifact's shape no longer holds a declared path; [] when it does. A basis
 * counts as drift only when the object that should hold it is gone: a market the producer left empty this cycle is
 * missing data, which the freshness grade handles, not a registry problem. A basis tuple may name that holder as a third
 * element where the path's own parent is optional: history.json drops fieldMeta.<field> on a null observation, so its
 * holder is rows.-1.fieldMeta.
 */
export function artifactContractDrift(file, payload) {
  const entry = ARTIFACT_FRESHNESS[file];
  if (!entry || payload == null) return [];
  const drift = [];
  if (entry.timestamp.length && !artifactProducedAt(file, payload)) drift.push('clock');
  for (const [market, path, holderPath] of entry.basis) {
    const parent = holderPath ?? String(path).split('.').slice(0, -1).join('.');
    const holder = parent ? readPath(payload, parent) : payload;
    if (!holder || typeof holder !== 'object') drift.push(`basis:${market}`);
  }
  return drift;
}

const RANK = { current: 0, late: 1, stale: 2 };
// Session-lag policy: the screener's factorSession rule (FRESHNESS_POLICY.factorSession) graded by the calendar's one
// sessionLagGrade — the latest completed session is current; one behind is current while that close is under 12 hours
// old (its producer has not landed yet), late after; two or more behind is stale.

/** Liveness grade from checkedAt (else producedAt): late after two missed cadences, stale past staleAfterMinutes. */
export function livenessState(row, now = Date.now()) {
  const at = Date.parse(row?.checkedAt || row?.producedAt || '');
  if (!Number.isFinite(at)) return 'unknown';
  const ageMinutes = (now - at) / 60000;
  if (Number.isFinite(row.staleAfterMinutes) && ageMinutes > row.staleAfterMinutes) return 'stale';
  if (Number.isFinite(row.expectedEveryMinutes) && ageMinutes > row.expectedEveryMinutes * 2 + 15) return 'late';
  return 'current';
}

/** { state, lagByMarket } from basisSession against the exchange calendars; null when the row declares no basis or the year is unknown. */
export function sessionLagState(row, now = Date.now()) {
  const basis = row?.basisSession;
  if (!basis || typeof basis !== 'object') return null;
  let worst = null;
  const lagByMarket = {};
  for (const [market, day] of Object.entries(basis)) {
    const observed = observationSessionState({ market, sessionDate: day, now });
    const state = sessionLagGrade(observed, FRESHNESS_POLICY.factorSession);
    if (state == null || state === 'invalid') continue;
    lagByMarket[market] = observed.lag;
    if (worst == null || RANK[state] > RANK[worst]) worst = state;
  }
  return worst == null ? null : { state: worst, lagByMarket };
}

/**
 * 'current' | 'late' | 'stale' | 'unknown' for one ledger row at `now`: the worse of the liveness grade (the pipeline
 * confirmed the file recently) and the session-lag grade (the content is about the latest completed session). A row the
 * pipeline cannot date is 'unknown' whatever its basis says.
 */
export function freshnessState(row, now = Date.now()) {
  const liveness = livenessState(row, now);
  if (liveness === 'unknown') return 'unknown';
  const content = sessionLagState(row, now)?.state || 'current';
  return RANK[content] > RANK[liveness] ? content : liveness;
}

/**
 * The grade of one public-data file from its workflow's ledger payload: freshnessState of its row, 'blocked' when the
 * refresh path waits on a missing secret, 'unknown' without a row. The browser reader and the producers grade through this.
 */
export function ledgerFileState(file, ledger, now = Date.now()) {
  const spec = ARTIFACT_FRESHNESS[file];
  const row = spec && spec.ledger !== false ? ledger?.artifacts?.[file] || null : null;
  const graded = row ? freshnessState(row, now) : 'unknown';
  return spec?.blockedBy && graded !== 'current' ? 'blocked' : graded;
}

/**
 * Whether a file whose published bytes are kept while its content is unchanged may be read. Its own clock is when the
 * content last changed, not when the producer last ran, so the ledger grade decides; the own clock is the fallback only
 * while that grade is unknown.
 */
export function unchangedArtifactUsable(state, ownClock, now, ownClockMaxAgeMs) {
  if (state === 'stale' || state === 'blocked') return false;
  if (state !== 'unknown') return true;
  const age = now - Date.parse(ownClock || '');
  return age >= 0 && age <= ownClockMaxAgeMs;
}
