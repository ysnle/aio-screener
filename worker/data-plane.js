import { createMarketSnapshot, TIER_0_INSTRUMENTS, validateMarketSnapshot, tier0Coverage } from '../src/data/contracts/market-snapshot.js';

const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const DEFAULT_ORIGIN = 'https://ysnle.github.io';
const MAX_QUOTE_AGE_MS = 24 * 60 * 60 * 1000;
const SCHEDULE_INTERVAL_MS = 5 * 60 * 1000;
const HEARTBEAT_WRITE_INTERVAL_MS = 15 * 60 * 1000;
const KV_TTL_SECONDS = 7 * 24 * 60 * 60;
const HEARTBEAT_WRITE_POLICY = 'revision-change-or-15m-liveness';
const KV_FREE_TIER_DAILY_LIMIT = 1000;
const KV_WARNING_DAILY_TARGET = 500;
const SCHEDULED_RUNS_PER_DAY = Math.ceil(24 * 60 * 60 * 1000 / SCHEDULE_INTERVAL_MS);
const HEARTBEAT_LIVENESS_WRITES_PER_DAY = Math.ceil(24 * 60 * 60 * 1000 / HEARTBEAT_WRITE_INTERVAL_MS);

export const FAST_PLANE_WRITE_POLICY = Object.freeze({
  schedule: '*/5 * * * *',
  scheduleIntervalMs: SCHEDULE_INTERVAL_MS,
  heartbeatIntervalMs: HEARTBEAT_WRITE_INTERVAL_MS,
  kvFreeTierDailyLimit: KV_FREE_TIER_DAILY_LIMIT,
  warningDailyTarget: KV_WARNING_DAILY_TARGET,
  // Normal upper bound: every run changes the current snapshot and the
  // heartbeat is written only at its 15-minute liveness interval.
  maxSuccessfulKvWritesPerDay: SCHEDULED_RUNS_PER_DAY + HEARTBEAT_LIVENESS_WRITES_PER_DAY,
  // Worst case: every run changes the snapshot and also flips heartbeat
  // status, so both keys are written on every 5-minute invocation.
  maxSuccessfulKvWritesPerDayWorstCase: SCHEDULED_RUNS_PER_DAY * 2
});

function origins(env) {
  return String(env?.ALLOWED_ORIGINS || DEFAULT_ORIGIN).split(',').map((value) => value.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const requestOrigin = request.headers.get('origin') || '';
  const allowed = origins(env);
  return {
    'Access-Control-Allow-Origin': allowed.includes(requestOrigin) ? requestOrigin : allowed[0],
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS, POST',
    'Access-Control-Allow-Headers': 'Content-Type, X-AIO-Cron-Token',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function jsonResponse(payload, request, env, status = 200, extra = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': status === 200 ? 'public, max-age=30, stale-while-revalidate=120' : 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...corsHeaders(request, env),
      ...extra
    }
  });
}

function shaLike(value) {
  let hash = 2166136261;
  const input = JSON.stringify(value);
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 9000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchYahooQuote(instrument, now = Date.now()) {
  let lastError = 'provider_unavailable';
  for (const host of YAHOO_HOSTS) {
    try {
      const response = await fetchWithTimeout(`${host}/v8/finance/chart/${encodeURIComponent(instrument.instrumentId)}?interval=1d&range=5d`, {
        headers: { accept: 'application/json', 'user-agent': 'AIO-Screener-data-plane/1.0' }
      });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const payload = await response.json();
      const result = payload?.chart?.result?.[0];
      const meta = result?.meta;
      const value = Number(meta?.regularMarketPrice);
      if (!Number.isFinite(value) || value <= 0) throw new Error('quote_value_missing');
      const closes = (result?.indicators?.quote?.[0]?.close || []).filter((item) => Number.isFinite(item) && item > 0);
      const previousValue = closes.length >= 2 ? closes.at(-2) : Number(meta?.chartPreviousClose || meta?.previousClose);
      const observedAt = Number.isFinite(Number(meta?.regularMarketTime))
        ? new Date(Number(meta.regularMarketTime) * 1000).toISOString()
        : null;
      const fetchedAt = new Date(now).toISOString();
      const ageMs = observedAt ? Math.max(0, now - Date.parse(observedAt)) : Infinity;
      const session = String(meta?.marketState || 'UNKNOWN').toUpperCase();
      const quality = !observedAt ? 'UNAVAILABLE'
        : session === 'REGULAR' && ageMs <= 10 * 60 * 1000 ? 'CURRENT'
          : session === 'CLOSED' && ageMs <= MAX_QUOTE_AGE_MS ? 'CLOSED_CURRENT'
            : ageMs <= 2 * 60 * 60 * 1000 ? 'DELAYED' : 'STALE';
      return {
        evidenceId: `${instrument.metricId}:${shaLike({ value, observedAt })}`,
        metricId: instrument.metricId,
        instrumentId: instrument.instrumentId,
        value,
        previousValue: Number.isFinite(previousValue) ? previousValue : null,
        changePct: Number.isFinite(previousValue) && previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : null,
        unit: instrument.unit,
        // W03-C/P1183: worker quotes carry the registry identity tuple as-is.
        valueKind: instrument.valueKind,
        source: 'Yahoo chart',
        sourceKind: 'public-information-service',
        observedAt,
        fetchedAt,
        lastSuccessfulAt: observedAt || fetchedAt,
        session,
        quality,
        allowedUse: 'reference',
        delayedByMs: observedAt ? ageMs : null,
        venue: meta?.fullExchangeName || meta?.exchangeName || null
      };
    } catch (error) {
      lastError = error?.message || String(error);
    }
  }
  return { instrumentId: instrument.instrumentId, metricId: instrument.metricId, error: lastError };
}

async function readLatest(env) {
  return await env?.AIO_QUOTES_KV?.get?.('quotes:current', 'json') || null;
}

async function readHeartbeat(env) {
  return await env?.AIO_QUOTES_KV?.get?.('quotes:heartbeat', 'json') || null;
}

async function writeHeartbeat(env, payload, { now = Date.now(), force = false } = {}) {
  if (!env?.AIO_QUOTES_KV?.put) return Object.freeze({ written: false, reason: 'kv-unavailable' });
  const previous = await readHeartbeat(env);
  const previousAt = Date.parse(previous?.writtenAt || previous?.publishedAt || previous?.attemptedAt || '');
  const statusChanged = previous?.status !== payload.status;
  const due = !Number.isFinite(previousAt) || now - previousAt >= HEARTBEAT_WRITE_INTERVAL_MS;
  if (!force && !statusChanged && !due) return Object.freeze({ written: false, reason: 'liveness-throttled', previousAt: Number.isFinite(previousAt) ? previousAt : null, writtenAt: previous?.writtenAt || null });
  const body = { ...payload, writtenAt: new Date(now).toISOString(), writePolicy: HEARTBEAT_WRITE_POLICY };
  await env.AIO_QUOTES_KV.put('quotes:heartbeat', JSON.stringify(body), { expirationTtl: KV_TTL_SECONDS });
  return Object.freeze({ written: true, reason: statusChanged ? 'status-changed' : force ? 'forced' : 'liveness-due', writtenAt: body.writtenAt });
}

export async function publishQuotes({ env, now = Date.now() } = {}) {
  const attemptedAt = new Date(now).toISOString();
  const results = await Promise.all(TIER_0_INSTRUMENTS.map((instrument) => fetchYahooQuote(instrument, now)));
  const quotes = results.filter((quote) => Number.isFinite(quote?.value) && quote.value > 0);
  const coverage = tier0Coverage(quotes);
  const complete = coverage.observed === coverage.required;
  const snapshotRevision = shaLike(quotes.map((quote) => [quote.instrumentId, quote.value, quote.observedAt]));
  const snapshot = createMarketSnapshot({
    status: complete ? 'published' : 'failed',
    revision: `fast-quotes:${snapshotRevision}`,
    generatedAt: complete ? attemptedAt : null,
    attemptedAt,
    lastSuccessfulAt: complete ? attemptedAt : null,
    source: 'cloudflare-cron:yahoo-chart',
    coverage: { required: coverage.required, observed: coverage.observed, tier0Required: coverage.required, tier0Observed: coverage.observed },
    quality: { gate: complete ? 'QG-01_PASS' : 'QG-01_BLOCKED', scheduler: 'cloudflare-cron', cadence: FAST_PLANE_WRITE_POLICY.schedule, kvWritePolicy: 'current-on-revision-change; heartbeat-on-status-change-or-15m-liveness' },
    errors: complete ? [] : results.filter((quote) => quote.error).map((quote) => `${quote.instrumentId}:${quote.error}`),
    quotes
  });
  const validation = validateMarketSnapshot(snapshot);
  if (!complete || !validation.ok || !env?.AIO_QUOTES_KV?.put) {
    const retained = await readLatest(env);
    const failure = {
      schemaVersion: 'fast-quotes-heartbeat-v1',
      checkedAt: attemptedAt,
      status: !env?.AIO_QUOTES_KV?.put ? 'operator_required' : 'failed',
      coverage,
      errors: validation.errors.concat(snapshot.errors),
      retainedRevision: retained?.revision || null
    };
    const heartbeatWrite = await writeHeartbeat(env, failure, { now });
    return Object.freeze({ ok: false, published: false, snapshot, heartbeat: failure, heartbeatWritten: heartbeatWrite.written, heartbeatWrittenAt: heartbeatWrite.writtenAt || null, heartbeatWriteReason: heartbeatWrite.reason });
  }

  const retained = await readLatest(env);
  const snapshotChanged = retained?.revision !== snapshot.revision;
  if (snapshotChanged) await env.AIO_QUOTES_KV.put('quotes:current', JSON.stringify(snapshot), { expirationTtl: KV_TTL_SECONDS });
  const heartbeat = {
    schemaVersion: 'fast-quotes-heartbeat-v1',
    checkedAt: attemptedAt,
    // publishedAt is deliberately tied to a changed current snapshot. A
    // throttled heartbeat is only a liveness check and must not masquerade as
    // a KV snapshot publication.
    publishedAt: snapshotChanged ? attemptedAt : retained?.generatedAt || retained?.publishedAt || null,
    status: 'published',
    coverage,
    revision: snapshot.revision,
    snapshotWritten: snapshotChanged,
    consecutiveMisses: 0
  };
  const heartbeatWrite = await writeHeartbeat(env, heartbeat, { now });
  return Object.freeze({ ok: true, published: true, snapshot, heartbeat, snapshotWritten: snapshotChanged, heartbeatWritten: heartbeatWrite.written, heartbeatWrittenAt: heartbeatWrite.writtenAt || null, heartbeatWriteReason: heartbeatWrite.reason });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    const url = new URL(request.url);
    // The write route keeps its own POST + cron-token gate and is dispatched first.
    if (url.pathname === '/admin/run' && request.method === 'POST') {
      const supplied = request.headers.get('X-AIO-Cron-Token') || '';
      if (!env?.AIO_CRON_SECRET || supplied !== env.AIO_CRON_SECRET) return jsonResponse({ ok: false, error: 'unauthorized' }, request, env, 401);
      const result = await publishQuotes({ env });
      return jsonResponse(result, request, env, result.ok ? 200 : 503);
    }
    // v56: the read routes below used to run for ANY method, so `POST /quotes` skipped the CDN
    // cache and performed a KV read on every request — an unauthenticated, unmetered read
    // amplifier against the namespace. Public quotes need no write verb.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return jsonResponse({ ok: false, error: 'method_not_allowed' }, request, env, 405);
    }
    if (url.pathname === '/health') {
      const heartbeat = await env?.AIO_QUOTES_KV?.get?.('quotes:heartbeat', 'json');
      const current = await readLatest(env);
      return jsonResponse({ ok: !!current, heartbeat, revision: current?.revision || null, sourceSha: env?.AIO_SOURCE_SHA || null, coverage: current?.coverage || null }, request, env, current ? 200 : 503);
    }
    if (url.pathname === '/quotes') {
      const current = await readLatest(env);
      if (!current) return jsonResponse({ ok: false, error: 'quotes_unavailable', status: 'UNAVAILABLE' }, request, env, 503);
      return jsonResponse(current, request, env, 200, { ETag: `"${current.revision}"` });
    }
    return jsonResponse({ ok: false, error: 'not_found' }, request, env, 404);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(publishQuotes({ env }));
  }
};
