// Universe breadth lanes: dated breadth history, distribution days and the per-session contributor artifact.
// Split out of scripts/fetch-data.mjs (pipeline redesign, 2026-10-19); fetch-data.mjs keeps the run order and re-exports
// every name it exported before.
import { readFile } from 'node:fs/promises';
import { atomicWriteFile } from '../lib/atomic-write.mjs';
import { listingMarketOfSymbol } from '../../src/domain/market/session-time.js';
import { evaluateSymbolSignals, BREADTH_SIGNAL_MODEL_VERSION } from '../../src/domain/market/breadth-signals.js';
import { round } from '../lib/producer-math.mjs';
import { isSessionComplete, sessionSegmentOfSymbol } from '../../src/domain/screener/price-factors.js';
import { REPO_ROOT, HIST } from './paths.mjs';
import { normalizeHistoryRows } from './history.mjs';

// Reconstruct daily breadth from the same dated adjusted-close rows used by
// the screener. Date alignment is explicit; array position is never used to
// align different securities. This remains AIO-universe research data, not
// official exchange advance/decline data.
// v58.79 (owner 2026-10-25): the headline breadth is S&P 500 members, not the AIO watch list — a fourth bucket
// (sp500) counts members only, judged on the same adjusted closes; the history writer prefers it (SP500_SCOPE below).
export function computeScreenerBreadthHistory(syms, results, maxRows = 252, nowMs = Date.now(), assetTypeOf = null, sp500Members = null) {
  const isMember = (sym) => sp500Members instanceof Set && sp500Members.has(String(sym || '').toUpperCase());
  // v57.50 D21: breadth is a share of stocks; ETFs (index trackers, VIX products) are excluded from both
  // the numerator and the denominator when the universe's asset type is known.
  const isEtf = (sym) => typeof assetTypeOf === 'function' && assetTypeOf(sym) === 'ETF';
  const symbolSet = new Set((syms || []).filter((sym) => !isEtf(sym)));
  const buckets = new Map();
  const windows = [20, 50, 200];
  // F07/V04: a Tokyo/Taiwan listing has no US/KR bucket; it counts only in `all`, judged on its own close.
  const segmentFor = (sym) => /\.(KS|KQ)$/i.test(String(sym || '')) ? 'kr' : listingMarketOfSymbol(sym) === 'INTL' ? 'intl' : 'us';
  const universe = {
    all: symbolSet.size,
    us: [...symbolSet].filter((sym) => segmentFor(sym) === 'us').length,
    kr: [...symbolSet].filter((sym) => segmentFor(sym) === 'kr').length,
    sp500: [...symbolSet].filter((sym) => segmentFor(sym) === 'us' && isMember(sym)).length
  };
  const blank = () => ({ eligible: 0, advances: 0, declines: 0, unchanged: 0, observedAt: null, above: { 20: 0, 40: 0, 50: 0, 200: 0 }, eligibleByWindow: { 20: 0, 40: 0, 50: 0, 200: 0 },
    // P1416: StockBee 4% movers, 52-week highs/lows; each with its own eligible denominator.
    up4: 0, down4: 0, moverEligible: 0, newHighs: 0, newLows: 0, highLowEligible: 0, contributors: { up4: [], down4: [], newHigh: [], newLow: [] },
    // v58.68: recent closing lows (20 / 63 sessions), each with its own eligible denominator.
    low20: 0, low20Eligible: 0, low63: 0, low63Eligible: 0 });
  const getBucket = (date) => {
    if (!buckets.has(date)) buckets.set(date, { all: blank(), us: blank(), kr: blank(), sp500: blank() });
    return buckets.get(date);
  };
  const addSignals = (bucket, signal, sym) => {
    if (!signal) return;
    if (signal.above40Eligible) { bucket.eligibleByWindow[40] += 1; if (signal.above40) bucket.above[40] += 1; }
    if (signal.moverEligible) bucket.moverEligible += 1;
    for (const window of [20, 63]) if (signal[`low${window}Eligible`]) { bucket[`low${window}Eligible`] += 1; if (signal[`low${window}`]) bucket[`low${window}`] += 1; }
    const change = signal.change == null ? null : round(signal.change * 100, 2);
    // P1449: contributors carry their asset type; a ≥20% one-day move is flagged as
    // possibly corporate-action-affected (spin-off etc.) — the audit source does not exist yet,
    // so the UI must show this as '조정 여부 미확인', not as a crash reading.
    const assetType = typeof assetTypeOf === 'function' ? (assetTypeOf(sym) || null) : null;
    const caSuspected = change != null && Math.abs(change) >= 20;
    if (signal.mover === 'up') { bucket.up4 += 1; bucket.contributors.up4.push([sym, change, assetType, caSuspected]); }
    if (signal.mover === 'down') { bucket.down4 += 1; bucket.contributors.down4.push([sym, change, assetType, caSuspected]); }
    if (signal.highLowEligible) {
      bucket.highLowEligible += 1;
      if (signal.newHigh) { bucket.newHighs += 1; bucket.contributors.newHigh.push([sym, change, assetType, caSuspected]); }
      if (signal.newLow) { bucket.newLows += 1; bucket.contributors.newLow.push([sym, change, assetType, caSuspected]); }
    }
  };
  const update = (bucket, values, prefix, finitePrefix, index, observedAt) => {
    const value = values[index];
    const previous = values[index - 1];
    if (!Number.isFinite(value) || !Number.isFinite(previous)) return;
    bucket.eligible += 1;
    if (value > previous) bucket.advances += 1;
    else if (value < previous) bucket.declines += 1;
    else bucket.unchanged += 1;
    if (observedAt && (!bucket.observedAt || Date.parse(observedAt) > Date.parse(bucket.observedAt))) bucket.observedAt = observedAt;
    for (const window of windows) {
      if (index + 1 < window) continue;
      if (finitePrefix[index + 1] - finitePrefix[index + 1 - window] !== window) continue;
      const average = (prefix[index + 1] - prefix[index + 1 - window]) / window;
      if (!Number.isFinite(average)) continue;
      bucket.eligibleByWindow[window] += 1;
      if (value > average) bucket.above[window] += 1;
    }
  };

  for (const row of results || []) {
    if (!row || row.__error || !symbolSet.has(row.sym) || !Array.isArray(row.dates) || !Array.isArray(row.adjCloses) || row.dates.length !== row.adjCloses.length) continue;
    const values = row.adjCloses.map((value) => value == null || value === '' ? Number.NaN : Number(value));
    const prefix = [0];
    const finitePrefix = [0];
    for (const value of values) {
      prefix.push(prefix[prefix.length - 1] + (Number.isFinite(value) ? value : 0));
      finitePrefix.push(finitePrefix[finitePrefix.length - 1] + (Number.isFinite(value) ? 1 : 0));
    }
    const market = segmentFor(row.sym);
    const sessionSegment = market === 'intl' ? sessionSegmentOfSymbol(row.sym) : market;
    const signals = Array.isArray(row.closes) && row.closes.length === values.length
      ? evaluateSymbolSignals({ closes: row.closes, adjCloses: row.adjCloses, highs: row.highs || [], lows: row.lows || [], volumes: row.volumes || [] })
      : [];
    for (let index = 1; index < values.length; index += 1) {
      const date = String(row.dates[index] || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isSessionComplete(date, sessionSegment, nowMs)) continue;
      const observedAt = row.observedAts?.[index] || `${date}T00:00:00.000Z`;
      const bucket = getBucket(date);
      update(bucket.all, values, prefix, finitePrefix, index, observedAt);
      if (bucket[market]) update(bucket[market], values, prefix, finitePrefix, index, observedAt);
      addSignals(bucket.all, signals[index], row.sym);
      if (bucket[market]) addSignals(bucket[market], signals[index], row.sym);
      if (market === 'us' && isMember(row.sym)) { update(bucket.sp500, values, prefix, finitePrefix, index, observedAt); addSignals(bucket.sp500, signals[index], row.sym); }
    }
  }

  const pct = (n, d) => d > 0 ? round(n / d * 100, 1) : null;
  const finalize = (bucket, universeSize) => {
    const directional = bucket.advances + bucket.declines;
    return {
      observedAt: bucket.observedAt,
      universe: universeSize,
      eligible: bucket.eligible,
      coveragePct: pct(bucket.eligible, universeSize),
      eligibleByWindow: { ...bucket.eligibleByWindow },
      breadth20: pct(bucket.above[20], bucket.eligibleByWindow[20]),
      breadth40: pct(bucket.above[40], bucket.eligibleByWindow[40]),
      breadthUp4: bucket.moverEligible > 0 ? bucket.up4 : null,
      breadthDown4: bucket.moverEligible > 0 ? bucket.down4 : null,
      breadthNewHighs: bucket.highLowEligible > 0 ? bucket.newHighs : null,
      breadthNewLows: bucket.highLowEligible > 0 ? bucket.newLows : null,
      breadthLow20: bucket.low20Eligible > 0 ? bucket.low20 : null,
      breadthLow63: bucket.low63Eligible > 0 ? bucket.low63 : null,
      signalEligible: { movers: bucket.moverEligible, highLow: bucket.highLowEligible, low20: bucket.low20Eligible, low63: bucket.low63Eligible },
      contributors: bucket.contributors,
      breadth50: pct(bucket.above[50], bucket.eligibleByWindow[50]),
      breadth200: pct(bucket.above[200], bucket.eligibleByWindow[200]),
      advanceRatio: directional > 0 ? round(bucket.advances / directional, 4) : null,
      advanceDecline: bucket.advances - bucket.declines,
      advances: bucket.advances,
      declines: bucket.declines,
      unchanged: bucket.unchanged
    };
  };
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-Math.max(60, Number(maxRows) || 252))
    .map(([date, segments]) => ({ date, all: finalize(segments.all, universe.all), us: finalize(segments.us, universe.us), kr: finalize(segments.kr, universe.kr),
      ...(universe.sp500 ? { sp500: finalize(segments.sp500, universe.sp500) } : {}) }));
}

// v58.79: which segment a history point's headline breadth comes from — S&P 500 members when that bucket judged at
// least 300 of them that day, otherwise the AIO US universe (membership artifact missing or a thin day).
export const SP500_SCOPE = 'sp500-members-not-official-index-breadth';
export const AIO_US_SCOPE = 'aio-us-screener-universe-not-official-exchange';
export function headlineBreadthSegment(point) {
  if (point?.sp500 && Number(point.sp500.eligible) >= 300) return { segment: point.sp500, scope: SP500_SCOPE, source: 'S&P 500 members (public-data/sp500-weights.json) from Yahoo adjusted-close history' };
  return point?.us ? { segment: point.us, scope: AIO_US_SCOPE, source: 'AIO US screener universe from Yahoo adjusted-close history' } : null;
}

// P1416: which stocks made each count — the latest 20 completed sessions, US segment. Names come
// from the screener universe on the client; this artifact carries symbols and the day's change only.
const BREADTH_CONTRIBUTORS_OUT = `${REPO_ROOT}/public-data/breadth-contributors.json`;
// v57.69 (P1802): the history lane already withholds a count judged on less than half the universe; the
// contributor lane did not, so 10/14 was published with one eligible mover and the screen read 0 as a count.
export const breadthMinimumEligible = (universe) => Math.max(20, Math.ceil(Number(universe) * 0.5));
export function buildBreadthContributorSessions(rows, nowMs = Date.now()) {
  return (Array.isArray(rows) ? rows : [])
    .map((point) => ({ point, headline: headlineBreadthSegment(point) }))
    .filter(({ point, headline }) => point?.date && headline?.segment?.contributors && isSessionComplete(point.date, 'us', nowMs)
      && Number(headline.segment.signalEligible?.movers) >= breadthMinimumEligible(headline.segment.universe))
    .slice(-20)
    .map(({ point, headline: { segment, scope } }) => ({
      date: point.date,
      universeScope: scope,
      eligible: segment.signalEligible || null,
      // P1449: contributor entries become objects — asset type (ETF/stock) plus the
      // corporate-action suspicion flag (|day change| >= 20%). "미국 주식" counts bundle ETFs
      // with individual names, so the drilldown must say which is which.
      signals: Object.fromEntries(Object.entries(segment.contributors).map(([key, list]) => [key,
        [...list]
          .sort((a, b) => Math.abs(b[1] ?? 0) - Math.abs(a[1] ?? 0))
          .slice(0, 80)
          .map((entry) => ({ symbol: entry[0], dayChangePct: entry[1] ?? null, assetType: entry[2] ?? null, corporateActionSuspected: entry[3] === true }))
      ])),
      counts: { up4: segment.breadthUp4, down4: segment.breadthDown4, newHigh: segment.breadthNewHighs, newLow: segment.breadthNewLows }
    }));
}
export async function writeBreadthContributors(rows, nowMs = Date.now()) {
  const sessions = buildBreadthContributorSessions(rows, nowMs);
  if (!sessions.length) return { written: false };
  const payload = { schemaVersion: 'breadth-contributors.v2', model: BREADTH_SIGNAL_MODEL_VERSION, generatedAt: new Date(nowMs).toISOString(), universeScope: sessions.at(-1)?.universeScope || AIO_US_SCOPE, universeAssetTypes: 'stocks-only-etfs-excluded', columns: ['symbol', 'dayChangePct', 'assetType', 'corporateActionSuspected'], corporateActionPolicy: 'none-adjusted — a >=20% one-day move is flagged only as a suspicion to check against the filing, not adjusted or confirmed', sessions };
  await atomicWriteFile(BREADTH_CONTRIBUTORS_OUT, JSON.stringify(payload));
  return { written: true, sessions: sessions.length };
}

export async function updateScreenerBreadthHistory(rows, nowMs = Date.now(), distribution = null) {
  if (!Array.isArray(rows) || rows.length < 60) return { updated: false, rows: rows?.length || 0 };
  let history = [];
  try { const raw = JSON.parse(await readFile(HIST, 'utf8')); if (Array.isArray(raw)) history = raw; } catch { /* first producer run */ }
  const fetchedAt = new Date().toISOString();
  const fields = ['breadth20', 'breadth50', 'breadth200', 'advanceRatio', 'advanceDecline', 'breadth40', 'breadthUp4', 'breadthDown4', 'breadthNewHighs', 'breadthNewLows', 'breadthLow20', 'breadthLow63'];
  // P1416: each count is judged against its own eligible population.
  const eligibleFor = (segment, field) => {
    const window = /^breadth(20|40|50|200)$/.exec(field)?.[1];
    if (window) return Number(segment.eligibleByWindow?.[window]);
    if (field === 'breadthUp4' || field === 'breadthDown4') return Number(segment.signalEligible?.movers);
    if (field === 'breadthNewHighs' || field === 'breadthNewLows') return Number(segment.signalEligible?.highLow);
    if (field === 'breadthLow20' || field === 'breadthLow63') return Number(segment.signalEligible?.[field === 'breadthLow20' ? 'low20' : 'low63']);
    return Number(segment.eligible);
  };
  // P1399: an earlier in-session run may have written today's partial breadth; clear it.
  for (const row of history) {
    if (!row?.date || isSessionComplete(row.date, 'us', nowMs)) continue;
    for (const field of fields) { if (field in row) row[field] = null; if (row.fieldMeta) delete row.fieldMeta[field]; }
  }
  for (const point of rows) {
    const headline = headlineBreadthSegment(point);
    const segment = headline?.segment;
    // v58.71 (pipeline audit): a date that only KR (or another market) traded has no US breadth; it must not add an all-null row.
    if (!segment || !point?.date || !(Number(segment.eligible) > 0)) continue;
    let target = history.find((row) => row?.date === point.date);
    if (!target) { target = { date: point.date, fieldMeta: {} }; history.push(target); }
    target.fieldMeta = target.fieldMeta || {};
    for (const field of fields) {
      const eligible = eligibleFor(segment, field);
      const universe = Number(segment.universe);
      const minimumEligible = breadthMinimumEligible(universe);
      const rawValue = segment[field];
      const value = rawValue == null || rawValue === '' ? Number.NaN : Number(rawValue);
      if (!Number.isFinite(value) || !Number.isFinite(eligible) || eligible < minimumEligible) {
        // Keep the column so the row shape stays stable; null plus no fieldMeta
        // is the single spelling of "no observation" (P1101).
        target[field] = null;
        delete target.fieldMeta[field];
        continue;
      }
      target[field] = value;
      target.fieldMeta[field] = {
        observedAt: segment.observedAt || `${point.date}T00:00:00.000Z`,
        fetchedAt,
        lastSuccessfulAt: fetchedAt,
        source: headline.source,
        sourceKind: 'derived-research',
        allowedUse: 'research-history',
        // P1117: the screener breadth lane writes into the same rows; without these two
        // markers its fields would be the only fieldMeta keys on the latest row that the
        // history artifact gate could not classify.
        observationRelation: 'latest-completed-close',
        observedAtSource: 'derived-from-adjusted-close-series',
        universeScope: headline.scope,
        universe,
        eligible,
        coveragePct: round(eligible / universe * 100, 1)
      };
    }
  }
  // P1416: S&P 500 distribution days (25-session count) from the index's own completed bars.
  let distributionRows = 0;
  for (const point of Array.isArray(distribution?.series) ? distribution.series : []) {
    if (!point?.date || point.count == null || !isSessionComplete(point.date, 'us', nowMs)) continue;
    const target = history.find((row) => row?.date === point.date);
    if (!target) continue;
    target.distributionDays = point.count;
    target.fieldMeta = target.fieldMeta || {};
    target.fieldMeta.distributionDays = {
      observedAt: `${point.date}T20:00:00.000Z`, fetchedAt, lastSuccessfulAt: fetchedAt,
      source: 'Yahoo chart ^GSPC daily bars', sourceKind: 'derived-research', allowedUse: 'research-history',
      observationRelation: 'latest-completed-close', observedAtSource: 'derived-from-index-daily-bars',
      model: BREADTH_SIGNAL_MODEL_VERSION, rule: 'close <= -0.2% on volume above the prior session; latest 25 sessions; retired once a later close is 5% above it'
    };
    distributionRows += 1;
  }
  history.sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));
  if (history.length > 420) history = history.slice(-420);
  await atomicWriteFile(HIST, JSON.stringify(normalizeHistoryRows(history)));
  return { updated: true, rows: rows.length, totalHistoryRows: history.length, distributionRows };
}
