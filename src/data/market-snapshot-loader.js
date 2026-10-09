import { createMarketSnapshot, validateMarketSnapshot } from './contracts/market-snapshot.js';

const DURABLE_SNAPSHOT_URL = './public-data/market-snapshot.json';

// P1532: the Worker publishes when Tier-0 coverage is complete and labels each quote's quality, but it does not refuse a
// snapshot whose quotes are all stale (for example a provider returning old observations). Such a snapshot is no fresher
// than the durable one, so the fast plane is skipped when none of its quotes is usable; a snapshot with at least one
// usable quote stays and the stale rows degrade per quote downstream.
const USABLE_FAST_QUALITIES = new Set(['CURRENT', 'CLOSED_CURRENT', 'DELAYED']);

// P1563: the quality labels are written when the Worker publishes and never recomputed. If the Worker stops (cron, quota or
// provider outage) the last snapshot keeps its CURRENT labels for as long as it is served, and a three-day-old snapshot would
// win over a fresh durable one. The Worker runs every five minutes, so its attemptedAt is a liveness signal; a fast-plane
// snapshot older than this is no fresher than the durable one and the loader falls through to it.
export const FAST_PLANE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

// Ordered quote sources. The durable GitHub Actions snapshot is always present and
// always last, so the fast plane can only add freshness — a disabled, unreachable,
// stale or tampered fast plane degrades to exactly the previous behaviour instead of
// emptying the screen. `enabled` is derived from published evidence
// (scripts/ci-fast-plane-consumer-gate.mjs); this module never decides it.
export function resolveMarketSnapshotSources({ fastQuotes = null, snapshotUrl = DURABLE_SNAPSHOT_URL } = {}) {
  const sources = [];
  const baseUrl = (() => {
    if (!fastQuotes || fastQuotes.enabled !== true) return null;
    try {
      const parsed = new URL(String(fastQuotes.baseUrl || ''));
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return null;
      return parsed.origin;
    } catch (_) { return null; }
  })();
  if (baseUrl) sources.push({ id: 'fast-plane', url: baseUrl + (fastQuotes.quotesPath || '/quotes') });
  sources.push({ id: 'durable-snapshot', url: snapshotUrl });
  return Object.freeze(sources.map((source) => Object.freeze(source)));
}

export function createMarketSnapshotLoader({
  httpClient,
  url = DURABLE_SNAPSHOT_URL,
  fastQuotesProvider = null,
  clock = { iso: () => new Date().toISOString() }
} = {}) {
  if (!httpClient || typeof httpClient.requestJson !== 'function') throw new Error('MARKET_SNAPSHOT_HTTP_CLIENT_INVALID');

  // Resolved per load, not at construction: public-config.json arrives after boot, and a
  // promotion must take effect without a reload while a revoked promotion must stop working.
  function currentSources() {
    let fastQuotes = null;
    try { fastQuotes = typeof fastQuotesProvider === 'function' ? fastQuotesProvider() : null; } catch (_) { fastQuotes = null; }
    return resolveMarketSnapshotSources({ fastQuotes, snapshotUrl: url });
  }

  async function loadSource(source) {
    const response = await httpClient.requestJson(source.url, { cache: 'no-store' });
    if (!response.ok) {
      return Object.freeze({
        ok: false,
        source: source.id,
        snapshot: createMarketSnapshot({ status: 'unavailable', attemptedAt: clock.iso(), source: 'browser-loader', errors: ['snapshot_fetch_failed'] }),
        error: response.error || 'snapshot_fetch_failed'
      });
    }
    const snapshot = createMarketSnapshot(response.data || {});
    const validation = validateMarketSnapshot(snapshot);
    if (!validation.ok || snapshot.status !== 'published') {
      return Object.freeze({ ok: false, source: source.id, snapshot, error: validation.ok ? 'snapshot_not_published' : validation.errors.join(',') });
    }
    if (source.id === 'fast-plane' && !(snapshot.quotes || []).some((quote) => USABLE_FAST_QUALITIES.has(quote?.quality))) {
      return Object.freeze({ ok: false, source: source.id, snapshot, error: 'fast_plane_no_usable_quotes' });
    }
    if (source.id === 'fast-plane') {
      const publishedAt = Date.parse(snapshot.attemptedAt || snapshot.generatedAt || '');
      const nowMs = Date.parse(clock.iso());
      if (Number.isFinite(publishedAt) && Number.isFinite(nowMs) && nowMs - publishedAt > FAST_PLANE_MAX_AGE_MS) {
        return Object.freeze({ ok: false, source: source.id, snapshot, error: 'fast_plane_snapshot_old' });
      }
    }
    return Object.freeze({ ok: true, source: source.id, snapshot, error: null });
  }

  async function load() {
    const failures = [];
    let lastFailure = null;
    for (const source of currentSources()) {
      let result;
      try {
        result = await loadSource(source);
      } catch (error) {
        result = Object.freeze({ ok: false, source: source.id, snapshot: null, error: String(error?.message || 'snapshot_loader_failed') });
      }
      if (result.ok) return result;
      failures.push(`${source.id}:${result.error}`);
      lastFailure = result;
    }
    return Object.freeze({
      ok: false,
      snapshot: lastFailure?.snapshot
        || createMarketSnapshot({ status: 'unavailable', attemptedAt: clock.iso(), source: 'browser-loader', errors: ['snapshot_fetch_failed'] }),
      error: failures.join('|') || 'snapshot_fetch_failed'
    });
  }

  return Object.freeze({ load });
}
