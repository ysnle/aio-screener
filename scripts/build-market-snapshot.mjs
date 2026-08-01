import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createMarketSnapshot, TIER_0_INSTRUMENTS, tier0Coverage, validateMarketSnapshot } from '../src/data/contracts/market-snapshot.js';

export const MARKET_SNAPSHOT_OUT = new URL('../public-data/market-snapshot.json', import.meta.url);
export const MARKET_SNAPSHOT_STATUS_OUT = new URL('../public-data/market-snapshot-status.json', import.meta.url);

function stableHash(value) {
  const source = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function iso(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function zoneParts(value, timeZone) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(value));
    const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return { weekday: map.weekday, hour: Number(map.hour), minute: Number(map.minute) };
  } catch (_) { return null; }
}

function minuteOfDay(parts) { return parts ? parts.hour * 60 + parts.minute : null; }

function isWeekday(weekday) { return !['Sat', 'Sun'].includes(weekday); }

function isContinuousInstrument(symbol) {
  return /(?:=X$|(?:CL|BZ|GC|SI)=F$|DX-Y\.NYB$)/i.test(symbol);
}

function scheduledSession(symbol, observedMs, nowMs) {
  const isKorea = /^\^(KS11|KQ11)$/.test(symbol);
  const isUsSession = /^\^(GSPC|IXIC|DJI|RUT|VIX|VIX3M|TNX|IRX)$/.test(symbol);
  if (isContinuousInstrument(symbol)) {
    const nowUtc = zoneParts(nowMs, 'UTC');
    if (nowUtc && !isWeekday(nowUtc.weekday)) return 'MARKET_CLOSED';
    return null;
  }
  if (!isKorea && !isUsSession) return null;
  const zone = isKorea ? 'Asia/Seoul' : 'America/New_York';
  const observedLocal = zoneParts(observedMs, zone);
  const nowLocal = zoneParts(nowMs, zone);
  const openMinutes = isKorea ? 9 * 60 : 9 * 60 + 30;
  const closeMinutes = isKorea ? 15 * 60 + 30 : 16 * 60;
  const nowMinute = minuteOfDay(nowLocal);
  const observedMinute = minuteOfDay(observedLocal);
  if (!nowLocal || !isWeekday(nowLocal.weekday)) return 'MARKET_CLOSED';
  if (nowMinute != null && nowMinute >= openMinutes && nowMinute < closeMinutes) {
    if (observedLocal && isWeekday(observedLocal.weekday) && observedMinute != null && observedMinute >= openMinutes && observedMinute < closeMinutes) {
      return 'IN_SESSION';
    }
    return 'PREVIOUS_CLOSE_EXPECTED';
  }
  return 'MARKET_CLOSED';
}

/**
 * Convert provider-specific marketState values and the observed timestamp
 * into a user-facing session contract. A fresh fetch is not automatically a
 * current observation: a prior close during a closed session is expected,
 * while an old value during an open session is unexpected stale data.
 */
export function deriveMarketSession({ instrumentId, observedAt, providerSession = null, now = Date.now() } = {}) {
  const symbol = String(instrumentId || '');
  const observedMs = Date.parse(observedAt || '');
  if (!Number.isFinite(observedMs)) return 'SOURCE_UNAVAILABLE';
  const ageMs = Math.max(0, Number(now) - observedMs);
  const provider = String(providerSession || '').toUpperCase();
  if (provider === 'PRE') return 'PREMARKET';
  if (provider === 'POST' || provider === 'POSTPOST') return 'AFTER_HOURS';
  if (provider === 'REGULAR') {
    // Yahoo can retain REGULAR after the venue has closed (especially across
    // weekends). Resolve the provider hint against the instrument schedule
    // before allowing it to promote an old completed close to a live value.
    const scheduled = scheduledSession(symbol, observedMs, Number(now));
    if (scheduled === 'MARKET_CLOSED') return ageMs <= 24 * 60 * 60 * 1000 ? 'MARKET_CLOSED' : 'STALE_UNEXPECTED';
    if (scheduled === 'PREVIOUS_CLOSE_EXPECTED') return ageMs <= 24 * 60 * 60 * 1000 ? 'PREVIOUS_CLOSE_EXPECTED' : 'STALE_UNEXPECTED';
    if (scheduled === 'IN_SESSION') return ageMs <= 10 * 60 * 1000 ? 'CURRENT_SESSION' : ageMs <= 2 * 60 * 60 * 1000 ? 'DELAYED_IN_SESSION' : 'STALE_UNEXPECTED';
    return ageMs <= 10 * 60 * 1000 ? 'CURRENT_SESSION' : ageMs <= 2 * 60 * 60 * 1000 ? 'DELAYED_IN_SESSION' : 'STALE_UNEXPECTED';
  }
  if (provider === 'CLOSED') return ageMs <= 24 * 60 * 60 * 1000 ? 'PREVIOUS_CLOSE_EXPECTED' : 'STALE_UNEXPECTED';

  // Even when a provider omits marketState, the venue schedule still defines
  // whether a recent observation is a valid completed close or an unexpected
  // stale point. This keeps the fallback path consistent with provider hints.
  const scheduled = scheduledSession(symbol, observedMs, Number(now));
  if (scheduled === 'MARKET_CLOSED') return ageMs <= 24 * 60 * 60 * 1000 ? 'MARKET_CLOSED' : 'STALE_UNEXPECTED';
  if (scheduled === 'PREVIOUS_CLOSE_EXPECTED') return ageMs <= 24 * 60 * 60 * 1000 ? 'PREVIOUS_CLOSE_EXPECTED' : 'STALE_UNEXPECTED';
  if (scheduled === 'IN_SESSION') return ageMs <= 10 * 60 * 1000 ? 'CURRENT_SESSION' : ageMs <= 2 * 60 * 60 * 1000 ? 'DELAYED_IN_SESSION' : 'STALE_UNEXPECTED';

  if (/-USD$/i.test(symbol)) return ageMs <= 10 * 60 * 1000 ? 'CURRENT_SESSION' : ageMs <= 2 * 60 * 60 * 1000 ? 'DELAYED_IN_SESSION' : 'STALE_UNEXPECTED';
  const isKorea = /^\^(KS11|KQ11)$/.test(symbol);
  const isUsSession = /^\^(GSPC|IXIC|DJI|RUT|VIX|VIX3M|TNX|IRX)$/.test(symbol);
  const observedLocal = zoneParts(observedMs, isKorea ? 'Asia/Seoul' : 'America/New_York');
  const nowLocal = zoneParts(Number(now), isKorea ? 'Asia/Seoul' : 'America/New_York');
  const openMinutes = isKorea ? 9 * 60 : 9 * 60 + 30;
  const closeMinutes = isKorea ? 15 * 60 + 30 : 16 * 60;
  const nowMinute = minuteOfDay(nowLocal);
  const observedMinute = minuteOfDay(observedLocal);
  if ((isKorea || isUsSession) && isWeekday(nowLocal?.weekday)) {
    if (nowMinute != null && nowMinute >= openMinutes && nowMinute < closeMinutes) {
      if (observedLocal && isWeekday(observedLocal.weekday) && observedMinute != null && observedMinute >= openMinutes && observedMinute < closeMinutes) {
        return ageMs <= 10 * 60 * 1000 ? 'CURRENT_SESSION' : ageMs <= 2 * 60 * 60 * 1000 ? 'DELAYED_IN_SESSION' : 'STALE_UNEXPECTED';
      }
      return ageMs <= 24 * 60 * 60 * 1000 ? 'PREVIOUS_CLOSE_EXPECTED' : 'STALE_UNEXPECTED';
    }
    return ageMs <= 24 * 60 * 60 * 1000 ? 'MARKET_CLOSED' : 'STALE_UNEXPECTED';
  }
  // FX, index futures, and commodities are treated as continuously quoted,
  // but still carry a delay gate rather than being labelled current forever.
  return ageMs <= 10 * 60 * 1000 ? 'CURRENT_SESSION' : ageMs <= 2 * 60 * 60 * 1000 ? 'DELAYED_IN_SESSION' : 'STALE_UNEXPECTED';
}

function quoteQuality(raw, nowMs, session = null) {
  const observedMs = Date.parse(raw?.observedAt || '');
  if (!Number.isFinite(observedMs)) return 'UNAVAILABLE';
  const ageMs = Math.max(0, nowMs - observedMs);
  if (session === 'CURRENT_SESSION' && ageMs <= 10 * 60 * 1000) return 'CURRENT';
  if (session === 'DELAYED_IN_SESSION' && ageMs <= 2 * 60 * 60 * 1000) return 'DELAYED';
  if (['PREVIOUS_CLOSE_EXPECTED', 'MARKET_CLOSED', 'PREMARKET', 'AFTER_HOURS'].includes(session) && ageMs <= 24 * 60 * 60 * 1000) return 'CLOSED_CURRENT';
  if (ageMs <= 2 * 60 * 60 * 1000) return 'DELAYED';
  if (ageMs <= 7 * 24 * 60 * 60 * 1000) return 'STALE';
  return 'STALE';
}

export function buildMarketSnapshot({ quotes = [], attemptedAt = new Date().toISOString(), source = 'github-actions', now = Date.now() } = {}) {
  const bySymbol = new Map((Array.isArray(quotes) ? quotes : []).map((quote) => [String(quote?.symbol || quote?.instrumentId || ''), quote]));
  const rows = TIER_0_INSTRUMENTS.map((instrument) => {
    const raw = bySymbol.get(instrument.instrumentId);
    if (!raw) return null;
    const value = Number(raw.regularMarketPrice ?? raw.value ?? raw.price);
    if (!Number.isFinite(value) || value <= 0) return null;
    const observedAt = iso(raw.observedAt || raw.regularMarketTime && new Date(Number(raw.regularMarketTime) * 1000));
    const fetchedAt = iso(raw.fetchedAt) || iso(attemptedAt);
    const session = deriveMarketSession({ instrumentId: instrument.instrumentId, observedAt, providerSession: raw.marketSession || raw.marketState, now });
    const quality = quoteQuality(raw, now, session);
    const providerPreviousValue = Number(raw.regularMarketPreviousClose ?? raw.chartPreviousClose ?? raw.previousValue);
    const hasProviderPreviousValue = Number.isFinite(providerPreviousValue);
    return {
      evidenceId: `${instrument.metricId}:${stableHash({ value, observedAt, source })}`,
      metricId: instrument.metricId,
      instrumentId: instrument.instrumentId,
      value,
      previousValue: hasProviderPreviousValue
        ? providerPreviousValue
        : null,
      changePct: Number.isFinite(Number(raw.regularMarketChangePercent ?? raw.changePct ?? raw.pct))
        ? Number(raw.regularMarketChangePercent ?? raw.changePct ?? raw.pct)
        : null,
      unit: instrument.unit,
      source: String(raw.source || raw._source || source),
      sourceKind: 'public-information-service',
      observedAt,
      fetchedAt,
      lastSuccessfulAt: observedAt || fetchedAt,
      session,
      quality,
      // Explicitly distinguish an intraday/provider previous-value change from
      // the completed daily close used by history.json. Consumers can now
      // compare chart deltas without silently treating unlike bases as equal.
      changeBasis: String(raw.changeBasis || (hasProviderPreviousValue ? 'provider-previous-value' : 'completed-daily-close')),
      valueBasis: String(raw.valueBasis || (hasProviderPreviousValue ? 'provider-previous-value' : 'completed-daily-close')),
      allowedUse: ['CURRENT_SESSION', 'DELAYED_IN_SESSION'].includes(session) ? 'current-with-session-and-delay-gate' : 'reference-only',
      delayedByMs: Number.isFinite(Number(raw.delayedByMs)) ? Number(raw.delayedByMs) : null,
      venue: raw.venue || raw.fullExchangeName || null
    };
  }).filter(Boolean);

  const coverage = tier0Coverage(rows);
  const complete = coverage.observed === coverage.required && rows.every((row) => row.quality !== 'UNAVAILABLE');
  const generatedAt = iso(attemptedAt) || new Date(now).toISOString();
  const revision = `market-snapshot:${generatedAt}:${stableHash(rows.map((row) => [row.instrumentId, row.value, row.observedAt]))}`;
  const snapshot = createMarketSnapshot({
    status: complete ? 'published' : 'failed',
    revision,
    generatedAt: complete ? generatedAt : null,
    attemptedAt: generatedAt,
    lastSuccessfulAt: complete ? generatedAt : null,
    source,
    coverage: {
      required: coverage.required,
      observed: coverage.observed,
      tier0Required: coverage.required,
      tier0Observed: coverage.observed
    },
    quality: { gate: complete ? 'QG-01_PASS' : 'QG-01_BLOCKED', maxAgeMs: 24 * 60 * 60 * 1000 },
    errors: complete ? [] : [`tier0_coverage:${coverage.observed}/${coverage.required}`],
    quotes: rows
  });
  const validation = validateMarketSnapshot(snapshot);
  if (!validation.ok) throw new Error(`MARKET_SNAPSHOT_INVALID:${validation.errors.join(',')}`);
  return Object.freeze({ snapshot, validation, complete, coverage });
}

async function readExistingSnapshot() {
  try { return JSON.parse(await readFile(MARKET_SNAPSHOT_OUT, 'utf8')); } catch (_) { return null; }
}

export async function publishMarketSnapshot(options = {}) {
  const result = buildMarketSnapshot(options);
  const existing = await readExistingSnapshot();
  const now = new Date().toISOString();
  const existingLastSuccessfulAt = existing?.lastSuccessfulAt || null;
  const existingRevision = existing?.revision || null;
  const statusPayload = {
    schemaVersion: 'market-snapshot-status-v1',
    attemptedAt: result.snapshot.attemptedAt,
    attemptStatus: result.complete ? 'published' : 'failed',
    coverage: result.snapshot.coverage,
    errors: result.snapshot.errors,
    lastSuccessfulAt: result.complete ? result.snapshot.lastSuccessfulAt : existingLastSuccessfulAt,
    lastKnownGoodRevision: result.complete ? result.snapshot.revision : existingRevision,
    updatedAt: now
  };
  await writeFile(MARKET_SNAPSHOT_STATUS_OUT, `${JSON.stringify(statusPayload, null, 2)}\n`);
  if (!result.complete) {
    return Object.freeze({ ...result, published: false, retainedRevision: existingRevision });
  }
  await writeFile(MARKET_SNAPSHOT_OUT, `${JSON.stringify(result.snapshot, null, 2)}\n`);
  return Object.freeze({ ...result, published: true });
}

if (process.argv[1] && new URL(`file://${process.argv[1].replaceAll('\\', '/')}`).href === import.meta.url) {
  const result = await publishMarketSnapshot({
    quotes: JSON.parse(await readFile(new URL('../public-data/data.json', import.meta.url), 'utf8')).quotes || [],
    source: 'standalone-data-artifact'
  });
  console.log(JSON.stringify({ published: result.published, coverage: result.coverage, revision: result.snapshot.revision }));
}
