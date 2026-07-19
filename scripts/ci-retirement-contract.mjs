import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('architecture/retirement-manifest.json'));
const routeOwners = JSON.parse(read('architecture/route-owners.json'));
const bootstrap = read('src/app/bootstrap.js');
const core = read('js/aio-core.js');
const status = JSON.parse(read('public-data/operations-status.json'));
const fail = (message) => { throw new Error(`[retirement] ${message}`); };

const routes = routeOwners.routes || {};
const routeIds = Object.keys(routes);
const sorted = (list) => [...list].sort();
const sameSet = (a, b) => {
  const left = sorted(a || []);
  const right = sorted(b || []);
  return left.length === right.length && left.every((value, index) => value === right[index]);
};

const measuredNativeLifecycle = routeIds.filter((route) => routes[route].lifecycleOwner === 'native');
const measuredNativeRenderer = routeIds.filter((route) => routes[route].rendererOwner === 'native');
const measuredLegacyOwner = routeIds.filter((route) => routes[route].rendererOwner !== 'native');

// R352/F-01/F-07 ratchet: the manifest and the public operations-status artifact must both
// reconcile to the same code-derived route-owners.json ledger. A hand-edited manifest that
// declares "17 native, 0 legacy" independent of measurement is exactly the failure this checks.
if (!sameSet(manifest.nativeLifecycleRoutes, measuredNativeLifecycle)) fail('manifest nativeLifecycleRoutes does not match route-owners.json measurement');
if (!sameSet(manifest.nativeRendererRoutes, measuredNativeRenderer)) fail('manifest nativeRendererRoutes does not match route-owners.json measurement');
if (!sameSet(manifest.legacyRouteOwners, measuredLegacyOwner)) fail('manifest legacyRouteOwners does not match route-owners.json measurement');
if ((manifest.legacyObserverOwners || []).length) fail('legacy observer ownership is declared but must be retired before certification');
if (!sameSet(status.routes?.nativeLifecycleOwner, measuredNativeLifecycle)) fail('operations-status nativeLifecycleOwner does not match route-owners.json measurement');
if (!sameSet(status.routes?.nativeRendererOwner, measuredNativeRenderer)) fail('operations-status nativeRendererOwner does not match route-owners.json measurement');
if (status.routes?.legacyOwner !== measuredLegacyOwner.length) fail('operations-status legacyOwner count does not match route-owners.json measurement');
if (bootstrap.includes('createLegacyObserverPage') || bootstrap.includes('legacy-observer.js')) fail('legacy observer registry is still bootstrapped');

// Lifecycle cutover (PAGES[route].init === null) is re-verified directly against source for every
// route the ledger claims is lifecycle-native, rather than trusting the manifest's own list.
for (const route of measuredNativeLifecycle) {
  const matcher = new RegExp(`['"]${route}['"]\\s*:\\s*\\{[^}]*init:\\s*null`, 's');
  if (!matcher.test(core)) fail(`legacy PAGES init remains for ${route}`);
}

// Renderer-native routes must have zero occurrences of their registered legacy symbols left in the
// legacy bundle — a marker/scaffold existing in src/ is not sufficient evidence of retirement (F-02).
const legacyFiles = ['index.html', 'js/aio-core.js', 'js/aio-data.js', 'js/aio-ui.js', 'js/aio-chat.js'];
const legacyAggregate = legacyFiles.map(read).join('\n');
for (const [route, symbols] of Object.entries(routeOwners.legacySymbolsMustBeAbsent || {})) {
  if (!measuredNativeRenderer.includes(route)) fail(`legacySymbolsMustBeAbsent declared for a route route-owners.json does not mark renderer-native: ${route}`);
  for (const symbol of symbols) {
    if (legacyAggregate.includes(symbol)) fail(`retired legacy symbol returned for native renderer route ${route}: ${symbol}`);
  }
}
for (const [route, patterns] of Object.entries(routeOwners.legacySymbolPatternsMustBeAbsent || {})) {
  for (const pattern of patterns) {
    if (new RegExp(pattern).test(legacyAggregate)) fail(`retired legacy pattern returned for native renderer route ${route}: ${pattern}`);
  }
}

for (const api of manifest.approvedFacadeApi) if (!read('src/legacy/compatibility-facade.js').includes(api)) fail(`facade API missing: ${api}`);

console.log(JSON.stringify({
  ok: true,
  status: manifest.status,
  nativeLifecycleRoutes: measuredNativeLifecycle.length,
  nativeRendererRoutes: measuredNativeRenderer.length,
  legacyRouteOwners: measuredLegacyOwner.length
}));
