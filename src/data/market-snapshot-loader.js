import { createMarketSnapshot, validateMarketSnapshot } from './contracts/market-snapshot.js';

export function createMarketSnapshotLoader({ httpClient, url = './public-data/market-snapshot.json', clock = { iso: () => new Date().toISOString() } } = {}) {
  if (!httpClient || typeof httpClient.requestJson !== 'function') throw new Error('MARKET_SNAPSHOT_HTTP_CLIENT_INVALID');

  async function load() {
    const response = await httpClient.requestJson(url, { cache: 'no-store' });
    if (!response.ok) {
      return Object.freeze({
        ok: false,
        snapshot: createMarketSnapshot({ status: 'unavailable', attemptedAt: clock.iso(), source: 'browser-loader', errors: ['snapshot_fetch_failed'] }),
        error: response.error || 'snapshot_fetch_failed'
      });
    }
    const snapshot = createMarketSnapshot(response.data || {});
    const validation = validateMarketSnapshot(snapshot);
    if (!validation.ok || snapshot.status !== 'published') {
      return Object.freeze({ ok: false, snapshot, error: validation.ok ? 'snapshot_not_published' : validation.errors.join(',') });
    }
    return Object.freeze({ ok: true, snapshot, error: null });
  }

  return Object.freeze({ load });
}
