#!/usr/bin/env node
// P1152 / R627 — fast quote plane consumer gate.
//
// The browser may read the Cloudflare fast plane only when the evidence that justifies
// the promotion exists. public-config.json is a generated artifact, but it is also the
// single switch the client obeys, so this gate re-derives the decision from the published
// evidence and fails if the two disagree — a hand edit that flips `enabled` without the
// soak/rights/coverage record is exactly the failure mode this prevents. The remaining
// assertions pin the client side of the same contract: the plane may be tried earlier,
// but it can never replace the durable snapshot with something unvalidated.
import { readFileSync } from 'node:fs';
import { deriveFastQuotesConfig } from './build-operations-status.mjs';
import { createMarketSnapshotLoader, resolveMarketSnapshotSources } from '../src/data/market-snapshot-loader.js';

const failures = [];
const check = (label, ok, detail) => { if (!ok) failures.push(label + (detail === undefined ? '' : ': ' + JSON.stringify(detail))); };
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));

const config = json('public-config.json');
const operations = json('public-data/operations-status.json');
const endpoints = json('architecture/worker-endpoints.json');

const fastQuotes = config?.marketData?.fastQuotes;

// ── Shape ────────────────────────────────────────────────────────────────────
check('P1152 public config declares marketData.fastQuotes', !!fastQuotes);
if (!fastQuotes) {
  console.error('Fast plane consumer gate failed:\n - public-config.json has no marketData.fastQuotes block; regenerate it with scripts/build-operations-status.mjs');
  process.exit(1);
}
check('P1152 fastQuotes exposes route metadata', typeof fastQuotes.healthPath === 'string' && typeof fastQuotes.quotesPath === 'string', fastQuotes);
check('P1152 fastQuotes enabled is an explicit boolean', typeof fastQuotes.enabled === 'boolean', fastQuotes.enabled);
check('P1152 fastQuotes carries a certification record', !!fastQuotes.certification && typeof fastQuotes.certification === 'object', fastQuotes.certification);
check('P1152 the client obeys a config-supplied quotes path', fastQuotes.quotesPath === (endpoints.fastQuotes?.quotesPath || '/quotes'), fastQuotes.quotesPath);

// ── Derivation honesty ───────────────────────────────────────────────────────
const plane = operations?.planes?.fast || {};
const soakRequiredDays = Number(endpoints.fastQuotes?.soakRequiredDays ?? 7);
const soakObservedDays = Number(plane.soak?.observedDays ?? 0);
const coverage = String(plane.health?.coverage || '');
const [observed, required] = coverage.split('/').map(Number);
const reDerived = deriveFastQuotesConfig({
  prior: fastQuotes,
  endpoint: endpoints.fastQuotes?.baseUrl || null,
  evidence: {
    healthy: Number(plane.health?.statusCode) === 200 && plane.health?.status === 'CURRENT',
    coverageComplete: Number.isFinite(observed) && observed === required && required === 16,
    rightsReviewed: endpoints.fastQuotes?.rightsReviewed === true,
    soakRequiredDays,
    soakObservedDays
  }
});
check('P1152 a published promotion matches a re-derivation from the published evidence', reDerived.enabled === fastQuotes.enabled, { published: fastQuotes.enabled, derived: reDerived.enabled });

if (fastQuotes.enabled === true) {
  // Every one of these is required before the browser is allowed to read the plane.
  check('P1152 the soak window is satisfied before enabling the fast plane', soakObservedDays >= soakRequiredDays, { soakObservedDays, soakRequiredDays });
  check('P1152 provider rights were reviewed before enabling the fast plane', endpoints.fastQuotes?.rightsReviewed === true, endpoints.fastQuotes?.rightsReviewed);
  check('P1152 fast plane health was observed within the promotion window', Number(plane.health?.statusCode) === 200 && plane.health?.status === 'CURRENT', plane.health);
  check('P1152 the fast plane reports complete Tier-0 coverage', Number.isFinite(observed) && observed === required && required === 16, coverage);
  check('P1152 no fast-plane blocker remains at promotion', !(operations.blockers || []).includes('fast_plane_soak_and_rights_review_required'), operations.blockers);
  check('P1152 no provider-rights blocker remains at promotion', !(operations.blockers || []).includes('provider_rights_review_required'), operations.blockers);
  check('P1152 the certification records when the promotion happened', typeof fastQuotes.certification.certifiedAt === 'string' && fastQuotes.certification.certifiedAt.length > 0, fastQuotes.certification.certifiedAt);
} else {
  check('P1152 an unpromoted fast plane claims no certification date', fastQuotes.certification.certifiedAt === null, fastQuotes.certification.certifiedAt);
  check('P1152 an unpromoted fast plane keeps the blocker list honest', (operations.blockers || []).includes('fast_plane_soak_and_rights_review_required'), operations.blockers);
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
console.log(`Fast plane consumer gate OK: enabled=${fastQuotes.enabled}, soak=${soakObservedDays}/${soakRequiredDays}, rightsReviewed=${endpoints.fastQuotes?.rightsReviewed === true}, coverage=${coverage || 'n/a'}.`);
