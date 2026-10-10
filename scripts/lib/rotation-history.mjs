// P1358: durable, date-aligned completed-session research evidence. Raw prices
// remain private to the producer (P715); no intraday ticks or invented seeds.
import { latestCompletedUsSession, nyParts, resolveMarketCalendarSession } from '../../src/ai/time/market-session.js';
import { computeRelativeRotation } from '../../src/domain/themes/rrg.js';

export const ROTATION_SYMBOLS = Object.freeze(['XLK','XLF','XLE','XLV','XLI','XLY','XLP','XLRE','XLB','XLU','XLC','SMH','IGV','XBI','ITA','OIH','AMLP','URA','XOP','HACK','GDX','BOTZ','ICLN','LIT','KRE','ITB','XRT','IYT','JETS','COPX','KWEB']);
const CONTRACT = Object.freeze({ schemaVersion: 'rotation-history.v1', modelVersion: 'rrg.v2', benchmark: 'SPY', timeframe: '1d', priceBasis: 'adjusted-close', source: 'Yahoo chart completed daily history', sourceKind: 'T3_PUBLIC_DELAYED', allowedUse: 'research-reference-only', allowedUseCeiling: 'reference', rightsStatus: 'REVIEW_REQUIRED', decisionUse: false, completionGraceMinutes: 5 });
const validDate = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T12:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0,10) === value;
};
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const validIso = value => typeof value === 'string' && value.includes('T') && Number.isFinite(Date.parse(value));
const rounding = value => Number(value.toFixed(8));

function normalizeSeries(input, target, symbol, computedMs) {
  if (!input || input.timeframe !== '1d' || input.priceBasis !== 'adjusted-close' || !Array.isArray(input.rows)) return { error: 'daily-adjusted-history-required' };
  const byDate = new Map();
  const conflicts = new Set();
  for (const row of input.rows) {
    if (row?.instrumentId !== symbol || row.timeframe !== '1d' || row.currency !== 'USD') return { error: 'provider-instrument-timeframe-or-currency-mismatch' };
    if (!row || !validDate(row.date) || !validIso(row.observedAt) || !positive(row.adjClose)) continue;
    const local = nyParts(Date.parse(row.observedAt));
    const session = resolveMarketCalendarSession({ market: 'US', date: row.date });
    if (local.date !== row.date || session.status !== 'open' || row.date > target.date) continue;
    if (!validIso(row.fetchedAt) || Date.parse(row.fetchedAt) > computedMs || Date.parse(row.fetchedAt) < Date.parse(row.observedAt)) return { error: 'provider-collection-time-invalid' };
    if (row.date === target.date && Date.parse(row.fetchedAt) < target.closeMs + 5 * 60000) return { error: 'daily-bar-collected-before-completed-close' };
    // Provider timestamp is bar START, never fabricated as the closing observation.
    const closeMinute = Number(session.close.slice(0,2)) * 60 + Number(session.close.slice(3));
    if (local.minute < 570 || local.minute >= closeMinute) continue;
    const prior = byDate.get(row.date);
    if (prior != null && prior !== row.adjClose) conflicts.add(row.date);
    else byDate.set(row.date, row.adjClose);
  }
  if (conflicts.size) return { error: 'conflicting-session-bars' };
  if (!byDate.has(target.date)) return { error: 'latest-completed-session-missing' };
  const fetchedTimes = input.rows.map(row => validIso(row?.fetchedAt) ? Date.parse(row.fetchedAt) : NaN).filter(Number.isFinite);
  return { byDate, dates: [...byDate.keys()].sort(), fetchedAt: fetchedTimes.length ? new Date(Math.max(...fetchedTimes)).toISOString() : null };
}

function currentRow(row, target, symbol) {
  return row?.status === 'CURRENT' && row.sessionDate === target?.date
    && row.symbol === symbol && row.benchmark === 'SPY' && row.timeframe === '1d'
    && row.modelVersion === CONTRACT.modelVersion && positive(row.rsRatio) && positive(row.rsMomentum)
    && validIso(row.observedAt) && Date.parse(row.observedAt) === target.closeMs
    && row.priceBasis === CONTRACT.priceBasis && row.decisionUse === false
    && row.allowedUseCeiling === 'reference' && row.sourceKind === CONTRACT.sourceKind
    && row.rightsStatus === CONTRACT.rightsStatus && row.alignedSessionCount >= 30
    && Array.isArray(row.relativeStrength) && row.relativeStrength.length === row.alignedSessionCount
    && row.relativeStrength.at(-1)?.sessionDate === target.date;
}

function contractMatches(previous) {
  return previous && Object.entries(CONTRACT).every(([key,value]) => previous[key] === value);
}

function retainedRow(previous, reason) {
  if (!previous) return { status: 'UNAVAILABLE', reason, sessionDate: null, observedAt: null, rsRatio: null, rsMomentum: null, quadrant: 'unknown', dailyPct: null, weeklyPct: null };
  // Keep all original observation/computation timestamps; retries are not observations.
  return { ...previous, status: 'RETAINED', reason };
}

/** Pure transformation. Inputs are explicit 1d adjusted-close provider bars. */
export function buildRotationHistory({ histories = {}, previous = null, now = Date.now(), computedAt = now, symbols = ROTATION_SYMBOLS } = {}) {
  const nowMs = Number(now);
  const target = Number.isFinite(nowMs) ? latestCompletedUsSession(nowMs - 5 * 60000, { requirePrevious: false }) : null;
  const attemptedAt = Number.isFinite(nowMs) ? new Date(nowMs).toISOString() : null;
  const computedMs = Number(computedAt);
  const computationTime = Number.isFinite(computedMs) && computedMs >= nowMs ? new Date(computedMs).toISOString() : attemptedAt;
  const trustedPrevious = contractMatches(previous) ? previous : null;
  const benchmark = target ? normalizeSeries(histories.SPY, target, 'SPY', computedMs) : { error: 'registered-calendar-unavailable' };
  const priorDates = [];
  let sessionCursor = target;
  for (let offset = 0; sessionCursor && offset < 5; offset++) {
    sessionCursor = latestCompletedUsSession(sessionCursor.closeMs - 1, { requirePrevious: false });
    priorDates.push(sessionCursor?.date || null);
  }
  const items = {};
  let updated = 0;
  for (const symbol of symbols) {
    const prior = trustedPrevious?.items?.[symbol];
    const asset = target && !benchmark.error ? normalizeSeries(histories[symbol], target, symbol, computedMs) : { error: benchmark.error };
    if (asset.error) { items[symbol] = retainedRow(prior, asset.error); continue; }
    const dates = benchmark.dates.filter(date => asset.byDate.has(date)).slice(-100);
    if (dates.length < 30) { items[symbol] = retainedRow(prior, 'aligned-completed-sessions-lt-30'); continue; }
    const assetCloses = dates.map(date => asset.byDate.get(date));
    const benchmarkCloses = dates.map(date => benchmark.byDate.get(date));
    const ratios = dates.map((date,index) => assetCloses[index] / benchmarkCloses[index]);
    const baseRatio = ratios[0];
    const indexedRatios = ratios.map(value => 100 * value / baseRatio);
    if (!ratios.every(positive) || !indexedRatios.every(positive)) { items[symbol] = retainedRow(prior, 'relative-ratio-invalid'); continue; }
    const rotation = computeRelativeRotation({ history: assetCloses, benchmarkHistory: benchmarkCloses });
    if (!positive(rotation.rsRatio) || !positive(rotation.rsMom)) { items[symbol] = retainedRow(prior, 'relative-rotation-unavailable'); continue; }
    // 1/5-session performance uses the benchmark's actual session grid, not
    // a compressed intersection that silently substitutes an older sector bar.
    const returnAt = offset => {
      const date = priorDates[offset-1];
      const value = asset.byDate.get(date);
      return positive(value) && benchmark.byDate.has(date) ? rounding((asset.byDate.get(target.date) / value - 1) * 100) : null;
    };
    items[symbol] = {
      status: 'CURRENT', symbol, benchmark: 'SPY', modelVersion: CONTRACT.modelVersion,
      sessionDate: target.date, observedAt: new Date(target.closeMs).toISOString(),
      observedAtBasis: 'derived-registered-regular-session-close',
      fetchedAt: asset.fetchedAt && benchmark.fetchedAt
        ? new Date(Math.max(Date.parse(asset.fetchedAt), Date.parse(benchmark.fetchedAt))).toISOString() : null,
      computedAt: computationTime, timeframe: '1d', priceBasis: CONTRACT.priceBasis,
      source: CONTRACT.source, sourceKind: CONTRACT.sourceKind, allowedUse: CONTRACT.allowedUse,
      allowedUseCeiling: 'reference', rightsStatus: CONTRACT.rightsStatus, decisionUse: false,
      alignedSessionCount: dates.length, alignment: 'exact-session-date-intersection',
      // Keep classifier coordinates at full precision: rounding 99.999999999
      // to 100 while retaining its original quadrant breaks the 100 boundary.
      rsRatio: rotation.rsRatio, rsMomentum: rotation.rsMom, quadrant: rotation.quadrant,
      dailyPct: returnAt(1), weeklyPct: returnAt(5), performanceBasis: 'adjusted-close-total-return',
      performanceWindows: { dailySessions: 1, weeklySessions: 5 },
      // Indexing removes absolute asset/SPY price levels; no raw quote redistribution.
      relativeStrength: dates.map((sessionDate,index) => ({ sessionDate, value: rounding(indexedRatios[index]) }))
    };
    updated++;
  }
  return {
    ...CONTRACT, attemptedAt, generatedAt: updated ? computationTime : trustedPrevious?.generatedAt || null,
    latestCompletedSession: target?.date || null,
    status: updated === symbols.length && symbols.length ? 'CURRENT' : updated ? 'PARTIAL' : trustedPrevious ? 'RETAINED' : 'UNAVAILABLE',
    counts: { required: symbols.length, updated, retained: Object.values(items).filter(row => row.status === 'RETAINED').length },
    items
  };
}

/** Injectable collector: fixture tests never execute the real producer/network. */
export async function collectRotationHistory({ fetchHistory, previous = null, now = Date.now(), symbols = ROTATION_SYMBOLS, concurrency = 3, clock = Date.now } = {}) {
  const nowMs = Number(now);
  const target = Number.isFinite(nowMs) ? latestCompletedUsSession(nowMs - 5 * 60000, { requirePrevious: false }) : null;
  if (target && contractMatches(previous) && validIso(previous.generatedAt) && symbols.every(symbol => currentRow(previous.items?.[symbol], target, symbol))) {
    return { ...previous, attemptedAt: new Date(nowMs).toISOString(), collectionStatus: 'CACHED_COMPLETED_SESSION' };
  }
  if (!target || typeof fetchHistory !== 'function') return buildRotationHistory({ previous, now, symbols });
  const histories = {};
  const requested = ['SPY', ...new Set(symbols)];
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(Math.max(1, Math.floor(concurrency) || 1), requested.length) }, async () => {
    while (cursor < requested.length) {
      const symbol = requested[cursor++];
      try { histories[symbol] = { timeframe: '1d', priceBasis: 'adjusted-close', rows: await fetchHistory(symbol, '6mo') }; }
      catch (_) { histories[symbol] = null; }
    }
  }));
  return buildRotationHistory({ histories, previous, now, computedAt: clock(), symbols });
}
