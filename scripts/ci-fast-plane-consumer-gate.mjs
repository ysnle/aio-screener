#!/usr/bin/env node
// P1152 / R627 — fast quote plane consumer gate.
//
// v60.50: public-config.json marketData.fastQuotes.enabled is the operator's promotion decision, committed with code
// (the producer no longer rewrites it). This gate holds that decision to the release-scoped record behind it —
// architecture/worker-endpoints.json names the same endpoint and paths, and records the rights review and the soak rule —
// and pins the client side: the plane is tried first but can never replace the durable snapshot with something
// unvalidated, so a promoted plane that is down or stale costs one request, not the screen. Live health stays an
// observation in public-data/operations-status.json.
import { readFileSync } from 'node:fs';
import { createMarketSnapshotLoader, resolveMarketSnapshotSources } from '../src/data/market-snapshot-loader.js';

const failures = [];
const check = (label, ok, detail) => { if (!ok) failures.push(label + (detail === undefined ? '' : ': ' + JSON.stringify(detail))); };
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

const config = json('public-config.json');
const endpoints = json('architecture/worker-endpoints.json');

const fastQuotes = config?.marketData?.fastQuotes;

// ── Shape ────────────────────────────────────────────────────────────────────
check('P1152 public config declares marketData.fastQuotes', !!fastQuotes);
if (!fastQuotes) {
  console.error('Fast plane consumer gate failed:\n - public-config.json has no marketData.fastQuotes block');
  process.exit(1);
}
check('P1152 fastQuotes exposes route metadata', typeof fastQuotes.healthPath === 'string' && typeof fastQuotes.quotesPath === 'string', fastQuotes);
check('P1152 fastQuotes enabled is an explicit boolean', typeof fastQuotes.enabled === 'boolean', fastQuotes.enabled);
check('P1152 fastQuotes carries a certification record', !!fastQuotes.certification && typeof fastQuotes.certification === 'object', fastQuotes.certification);
check('P1152 the client obeys a config-supplied quotes path', fastQuotes.quotesPath === (endpoints.fastQuotes?.quotesPath || '/quotes'), fastQuotes.quotesPath);

// ── Promotion record (release-scoped) ───────────────────────────────────────
const fastEndpoint = endpoints.fastQuotes || {};
const origin = (value) => { try { return new URL(String(value || '')).origin; } catch (_) { return null; } };
check('v60.50 the promoted endpoint is the configured data-plane Worker', origin(fastQuotes.baseUrl) === origin(fastEndpoint.baseUrl) && /^https:\/\//.test(String(fastQuotes.baseUrl || '')), { config: fastQuotes.baseUrl, endpoints: fastEndpoint.baseUrl });
check('v60.50 the promoted health path is the configured one', fastQuotes.healthPath === (fastEndpoint.healthPath || '/health'), fastQuotes.healthPath);
check('v60.50 the certification states the soak rule the endpoint record sets', Number(fastQuotes.certification.soakRequiredDays) === Number(fastEndpoint.soakRequiredDays ?? 7), { config: fastQuotes.certification.soakRequiredDays, endpoints: fastEndpoint.soakRequiredDays });
if (fastQuotes.enabled === true) {
  check('P1152 provider rights were reviewed before enabling the fast plane', fastEndpoint.rightsReviewed === true && fastQuotes.certification.rightsReviewed === true, { endpoints: fastEndpoint.rightsReviewed, config: fastQuotes.certification.rightsReviewed });
  check('P1152 the certification records when the promotion happened', typeof fastQuotes.certification.certifiedAt === 'string' && Number.isFinite(Date.parse(fastQuotes.certification.certifiedAt)), fastQuotes.certification.certifiedAt);
} else {
  check('P1152 an unpromoted fast plane claims no certification date', fastQuotes.certification.certifiedAt === null, fastQuotes.certification.certifiedAt);
}

// ── Client behaviour ─────────────────────────────────────────────────────────
const disabledSources = resolveMarketSnapshotSources({ fastQuotes: { enabled: false, baseUrl: endpoints.fastQuotes?.baseUrl, quotesPath: '/quotes' } });
check('P1152 a disabled fast plane contributes no source', disabledSources.length === 1 && disabledSources[0].id === 'durable-snapshot', disabledSources);
const enabledSources = resolveMarketSnapshotSources({ fastQuotes: { enabled: true, baseUrl: endpoints.fastQuotes?.baseUrl, quotesPath: '/quotes' } });
check('P1152 an enabled fast plane is tried before the durable snapshot', enabledSources.length === 2 && enabledSources[0].id === 'fast-plane' && enabledSources[1].id === 'durable-snapshot', enabledSources);
const badUrlSources = resolveMarketSnapshotSources({ fastQuotes: { enabled: true, baseUrl: 'http://insecure.example', quotesPath: '/quotes' } });
check('P1152 a non-HTTPS fast plane endpoint is refused', badUrlSources.length === 1 && badUrlSources[0].id === 'durable-snapshot', badUrlSources);

{
  const published = json('public-data/market-snapshot.json');
  const requested = [];
  const httpClient = {
    async requestJson(url) {
      requested.push(url);
      if (url.includes('/quotes')) return { ok: false, error: 'fast_plane_unreachable' };
      return { ok: true, data: published };
    }
  };
  const loader = createMarketSnapshotLoader({
    httpClient,
    fastQuotesProvider: () => ({ enabled: true, baseUrl: endpoints.fastQuotes?.baseUrl, quotesPath: '/quotes' })
  });
  const result = await loader.load();
  check('P1152 the loader falls back to the durable snapshot when the fast plane fails', result.ok === true && result.source === 'durable-snapshot', { ok: result.ok, source: result.source });
  check('P1152 the fast plane is actually attempted first', requested.length === 2 && requested[0].includes('/quotes'), requested);

  const tampered = JSON.parse(JSON.stringify(published));
  tampered.quotes[0].unit = 'WRONG_UNIT';
  const tamperLoader = createMarketSnapshotLoader({
    httpClient: { async requestJson(url) { return url.includes('/quotes') ? { ok: true, data: tampered } : { ok: true, data: published }; } },
    fastQuotesProvider: () => ({ enabled: true, baseUrl: endpoints.fastQuotes?.baseUrl, quotesPath: '/quotes' })
  });
  const tamperResult = await tamperLoader.load();
  check('P1152 a tampered fast-plane payload never replaces the last good snapshot', tamperResult.ok === true && tamperResult.source === 'durable-snapshot', { ok: tamperResult.ok, source: tamperResult.source });

  // P1532: a fast-plane snapshot whose quotes are all STALE/UNAVAILABLE is "published" (the Worker gates coverage, not
  // quality), but it is not fresher than the durable snapshot. The loader contract says a stale fast plane degrades to the
  // previous behaviour, so it must fall through; a snapshot with at least one usable quote stays on the fast plane and the
  // stale rows degrade per quote.
  {
    const withQualities = (qualityFor) => {
      const copy = JSON.parse(JSON.stringify(published));
      copy.quotes.forEach((quote, index) => { quote.quality = qualityFor(index); });
      return copy;
    };
    const loadWith = async (fastPayload) => {
      const calls = [];
      const result = await createMarketSnapshotLoader({
        httpClient: { async requestJson(url) { calls.push(url); return { ok: true, data: url.includes('/quotes') ? fastPayload : published }; } },
        fastQuotesProvider: () => ({ enabled: true, baseUrl: endpoints.fastQuotes?.baseUrl, quotesPath: '/quotes' }),
        clock: { iso: () => new Date(Date.parse(fastPayload.attemptedAt) + (loadWith.ageMs ?? 60000)).toISOString() }
      }).load();
      return { result, calls };
    };
    const allStale = await loadWith(withQualities(() => 'STALE'));
    check('P1532 an all-STALE fast-plane snapshot falls through to the durable snapshot', allStale.result.ok === true && allStale.result.source === 'durable-snapshot' && allStale.calls.length === 2, { source: allStale.result.source, calls: allStale.calls.length });
    const allUnavailable = await loadWith(withQualities(() => 'UNAVAILABLE'));
    check('P1532 an all-UNAVAILABLE fast-plane snapshot falls through to the durable snapshot', allUnavailable.result.source === 'durable-snapshot', allUnavailable.result.source);
    const mixed = await loadWith(withQualities((index) => (index === 0 ? 'DELAYED' : 'STALE')));
    check('P1532 one usable quote keeps the fast plane (stale rows degrade per quote, not the whole snapshot)', mixed.result.ok === true && mixed.result.source === 'fast-plane' && mixed.calls.length === 1, { source: mixed.result.source, calls: mixed.calls.length });
    const current = await loadWith(withQualities(() => 'CLOSED_CURRENT'));
    check('P1532 an all-usable fast-plane snapshot is still preferred over the durable one', current.result.source === 'fast-plane', current.result.source);
    // P1563: labels frozen at publish time must not outlive the Worker. Same CURRENT labels, different age of the snapshot itself.
    const currentLabels = withQualities(() => 'CURRENT');
    loadWith.ageMs = 10 * 60 * 1000;
    const fresh = await loadWith(currentLabels);
    loadWith.ageMs = 3 * 60 * 60 * 1000;
    const threeHours = await loadWith(currentLabels);
    loadWith.ageMs = 3 * 24 * 60 * 60 * 1000;
    const threeDays = await loadWith(currentLabels);
    loadWith.ageMs = undefined;
    check('P1563 a fresh fast-plane snapshot with CURRENT labels is still preferred', fresh.result.source === 'fast-plane', fresh.result.source);
    check('P1563 a fast-plane snapshot older than two hours falls through to the durable snapshot even with CURRENT labels', threeHours.result.source === 'durable-snapshot' && threeDays.result.source === 'durable-snapshot' && threeDays.calls.length === 2, { three: threeHours.result.source, days: threeDays.result.source });
    const durableOnlyStale = await createMarketSnapshotLoader({ httpClient: { async requestJson() { return { ok: true, data: withQualities(() => 'STALE') }; } }, fastQuotesProvider: () => null }).load();
    check('P1532 the durable snapshot is never refused for stale rows (it is the last source)', durableOnlyStale.ok === true && durableOnlyStale.source === 'durable-snapshot', durableOnlyStale.source);
  }

  const disabledRequested = [];
  const disabledLoader = createMarketSnapshotLoader({
    httpClient: { async requestJson(url) { disabledRequested.push(url); return { ok: true, data: published }; } },
    fastQuotesProvider: () => null
  });
  const disabledResult = await disabledLoader.load();
  check('P1152 an absent config keeps the durable-only path', disabledResult.ok === true && disabledResult.source === 'durable-snapshot' && disabledRequested.length === 1, { source: disabledResult.source, calls: disabledRequested });
}

if (failures.length) {
  console.error('Fast plane consumer gate failed:');
  failures.forEach((failure) => console.error(' - ' + failure));
  process.exit(1);
}
console.log(`Fast plane consumer gate OK: enabled=${fastQuotes.enabled}, soakRequiredDays=${fastQuotes.certification.soakRequiredDays}, rightsReviewed=${endpoints.fastQuotes?.rightsReviewed === true}, certifiedAt=${fastQuotes.certification.certifiedAt}.`);
