import { createMarketSnapshot, TIER_0_INSTRUMENTS, validateMarketSnapshot, tier0Coverage } from '../src/data/contracts/market-snapshot.js';

const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const DEFAULT_ORIGIN = 'https://ysnle.github.io';
const MAX_QUOTE_AGE_MS = 24 * 60 * 60 * 1000;

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
  const fromKv = await env?.AIO_QUOTES_KV?.get?.('quotes:current', 'json');
  if (fromKv) return fromKv;
  const object = await env?.AIO_QUOTES_BUCKET?.get?.('latest.json');
  if (!object) return null;
  try { return await object.json(); } catch (_) { return null; }
}

async function writeHeartbeat(env, payload) {
  if (!env?.AIO_QUOTES_KV?.put) return;
  await env.AIO_QUOTES_KV.put('quotes:heartbeat', JSON.stringify(payload), { expirationTtl: 7 * 24 * 60 * 60 });
}

export async function publishQuotes({ env, now = Date.now() } = {}) {
  const attemptedAt = new Date(now).toISOString();
  const results = await Promise.all(TIER_0_INSTRUMENTS.map((instrument) => fetchYahooQuote(instrument, now)));
  const quotes = results.filter((quote) => Number.isFinite(quote?.value) && quote.value > 0);
  const coverage = tier0Coverage(quotes);
  const complete = coverage.observed === coverage.required;
  const snapshot = createMarketSnapshot({
    status: complete ? 'published' : 'failed',
    revision: `fast-quotes:${attemptedAt}:${shaLike(quotes.map((quote) => [quote.instrumentId, quote.value, quote.observedAt]))}`,
    generatedAt: complete ? attemptedAt : null,
    attemptedAt,
    lastSuccessfulAt: complete ? attemptedAt : null,
    source: 'cloudflare-cron:yahoo-chart',
    coverage: { required: coverage.required, observed: coverage.observed, tier0Required: coverage.required, tier0Observed: coverage.observed },
    quality: { gate: complete ? 'QG-01_PASS' : 'QG-01_BLOCKED', scheduler: 'cloudflare-cron', cadence: '*/5 * * * *' },
    errors: complete ? [] : results.filter((quote) => quote.error).map((quote) => `${quote.instrumentId}:${quote.error}`),
    quotes
  });
  const validation = validateMarketSnapshot(snapshot);
  if (!complete || !validation.ok || !env?.AIO_QUOTES_KV?.put) {
    const retained = await readLatest(env);
    const failure = {
      schemaVersion: 'fast-quotes-heartbeat-v1',
      attemptedAt,
      status: !env?.AIO_QUOTES_KV?.put ? 'operator_required' : 'failed',
      coverage,
      errors: validation.errors.concat(snapshot.errors),
      retainedRevision: retained?.revision || null
    };
    await writeHeartbeat(env, failure);
    return Object.freeze({ ok: false, published: false, snapshot, heartbeat: failure });
  }

  const body = JSON.stringify(snapshot);
  await env.AIO_QUOTES_KV.put('quotes:current', body, { expirationTtl: 7 * 24 * 60 * 60 });
  if (env.AIO_QUOTES_BUCKET?.put) await env.AIO_QUOTES_BUCKET.put(`quotes/${snapshot.revision}.json`, body, { httpMetadata: { contentType: 'application/json' } });
  if (env.AIO_QUOTES_BUCKET?.put) await env.AIO_QUOTES_BUCKET.put('latest.json', body, { httpMetadata: { contentType: 'application/json' } });
  const heartbeat = { schemaVersion: 'fast-quotes-heartbeat-v1', attemptedAt, publishedAt: attemptedAt, status: 'published', coverage, revision: snapshot.revision, consecutiveMisses: 0 };
  await writeHeartbeat(env, heartbeat);
  return Object.freeze({ ok: true, published: true, snapshot, heartbeat });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
    const url = new URL(request.url);
    if (url.pathname === '/health') {
      const heartbeat = await env?.AIO_QUOTES_KV?.get?.('quotes:heartbeat', 'json');
      const current = await readLatest(env);
      return jsonResponse({ ok: !!current, heartbeat, revision: current?.revision || null, coverage: current?.coverage || null }, request, env, current ? 200 : 503);
    }
    if (url.pathname === '/quotes') {
      const current = await readLatest(env);
      if (!current) return jsonResponse({ ok: false, error: 'quotes_unavailable', status: 'UNAVAILABLE' }, request, env, 503);
      return jsonResponse(current, request, env, 200, { ETag: `"${current.revision}"` });
    }
    if (url.pathname === '/admin/run' && request.method === 'POST') {
      const supplied = request.headers.get('X-AIO-Cron-Token') || '';
      if (!env?.AIO_CRON_SECRET || supplied !== env.AIO_CRON_SECRET) return jsonResponse({ ok: false, error: 'unauthorized' }, request, env, 401);
      const result = await publishQuotes({ env });
      return jsonResponse(result, request, env, result.ok ? 200 : 503);
    }
    return jsonResponse({ ok: false, error: 'not_found' }, request, env, 404);
  },

  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(publishQuotes({ env }));
  }
};
