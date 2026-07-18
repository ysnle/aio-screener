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

function quoteQuality(raw, nowMs) {
  const observedMs = Date.parse(raw?.observedAt || '');
  if (!Number.isFinite(observedMs)) return 'UNAVAILABLE';
  const ageMs = Math.max(0, nowMs - observedMs);
  const session = String(raw.marketSession || raw.marketState || '').toUpperCase();
  if (session === 'REGULAR' && ageMs <= 10 * 60 * 1000) return 'CURRENT';
  if (session === 'CLOSED' && ageMs <= 24 * 60 * 60 * 1000) return 'CLOSED_CURRENT';
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
    const quality = quoteQuality(raw, now);
    return {
      evidenceId: `${instrument.metricId}:${stableHash({ value, observedAt, source })}`,
      metricId: instrument.metricId,
      instrumentId: instrument.instrumentId,
      value,
      previousValue: Number.isFinite(Number(raw.regularMarketPreviousClose ?? raw.chartPreviousClose))
        ? Number(raw.regularMarketPreviousClose ?? raw.chartPreviousClose)
        : null,
      changePct: Number.isFinite(Number(raw.regularMarketChangePercent)) ? Number(raw.regularMarketChangePercent) : null,
      unit: instrument.unit,
      source: String(raw.source || raw._source || source),
      sourceKind: 'public-information-service',
      observedAt,
      fetchedAt,
      lastSuccessfulAt: observedAt || fetchedAt,
      session: String(raw.marketSession || raw.marketState || 'UNKNOWN'),
      quality,
      allowedUse: 'reference',
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
