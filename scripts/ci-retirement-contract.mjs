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
const declaredNotApplicable = (owner, field) => owner[`${field}Owner`] === 'not-applicable'
  && owner.notApplicableFields?.includes(`${field}Owner`);
const routePageFile = (owner) => String(owner.nativeModule || '').match(/^src\/ui\/pages\/([^\s]+\.js)/)?.[1] || null;
const escapePattern = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const measuredNativeLazy = routeIds.filter((route) => {
  const pageFile = routePageFile(routes[route]);
  return routes[route].loadingStrategy === 'route-dynamic-import'
    && pageFile
    && new RegExp(`route:\\s*['\"]${escapePattern(route)}['\"][\\s\\S]{0,240}?loader:\\s*\\(\\)\\s*=>\\s*import\\(['\"]\\.\\.\/ui\/pages\/${escapePattern(pageFile)}['\"]\\)`).test(bootstrap)
    && !new RegExp(`^import\\s+\\{[^\\n]*from\\s+['\"]\\.\\.\/ui\/pages\/${escapePattern(pageFile)}['\"]`, 'm').test(bootstrap);
});
const measuredFullNativeOwner = routeIds.filter((route) => {
  const owner = routes[route];
  return owner.lifecycleOwner === 'native'
    && owner.rendererOwner === 'native'
    && owner.dataOwner === 'native'
    && ['chart', 'narrative'].every((field) => owner[`${field}Owner`] === 'native' || declaredNotApplicable(owner, field))
    && measuredNativeLazy.includes(route)
    && (owner.contestedIds || []).length === 0
    && (owner.legacyWriterEvidence || []).length === 0;
});

// R352/F-01/F-07 ratchet: the manifest and the public operations-status artifact must both
// reconcile to the same code-derived route-owners.json ledger. A hand-edited manifest that
// declares "17 native, 0 legacy" independent of measurement is exactly the failure this checks.
if (!sameSet(manifest.nativeLifecycleRoutes, measuredNativeLifecycle)) fail('manifest nativeLifecycleRoutes does not match route-owners.json measurement');
if (!sameSet(manifest.nativeRendererRoutes, measuredNativeRenderer)) fail('manifest nativeRendererRoutes does not match route-owners.json measurement');
if (!sameSet(manifest.legacyRouteOwners, measuredLegacyOwner)) fail('manifest legacyRouteOwners does not match route-owners.json measurement');
if (!sameSet(manifest.nativeLazyRoutes, measuredNativeLazy)) fail('manifest nativeLazyRoutes does not match bootstrap dynamic imports');
if (!sameSet(manifest.fullNativeOwnerRoutes, measuredFullNativeOwner)) fail('manifest fullNativeOwnerRoutes does not match independently measured ownership/lazy boundaries');
if (!sameSet(routeOwners.counts?.lazyLoadedRoutes, measuredNativeLazy)) fail('route-owners lazyLoadedRoutes does not match bootstrap dynamic imports');
if (!sameSet(routeOwners.counts?.fullNativeOwner, measuredFullNativeOwner)) fail('route-owners fullNativeOwner does not match independently measured ownership/lazy boundaries');
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
for (const [route, symbols] of Object.entries(routeOwners.retiredLegacySymbolsMustBeAbsent || {})) {
  for (const symbol of symbols) {
    if (legacyAggregate.includes(symbol)) fail(`retired legacy symbol returned for derived route ${route}: ${symbol}`);
  }
}
for (const [route, patterns] of Object.entries(routeOwners.legacySymbolPatternsMustBeAbsent || {})) {
  for (const pattern of patterns) {
    if (new RegExp(pattern).test(legacyAggregate)) fail(`retired legacy pattern returned for native renderer route ${route}: ${pattern}`);
  }
}

const facadeSource = read('src/legacy/compatibility-facade.js');
const facadeStart = facadeSource.indexOf('value: Object.freeze({');
const facadeEnd = facadeSource.indexOf('\n     })', facadeStart);
const facadeBlock = facadeSource.slice(facadeStart, facadeEnd);
const measuredFacadeApi = [...facadeBlock.matchAll(/^\s*,?([A-Za-z_$][\w$]*)\s*:/gm)].map((match) => match[1]).filter((name) => name !== 'value');
if (!sameSet(manifest.currentFacadeApi, measuredFacadeApi)) fail(`currentFacadeApi drift: manifest=${manifest.currentFacadeApi?.length || 0}, measured=${measuredFacadeApi.length}`);
if (measuredFacadeApi.length > manifest.facadeExpansionBudget) fail(`facade expanded beyond ${manifest.facadeExpansionBudget}: ${measuredFacadeApi.length}`);
for (const api of manifest.approvedFacadeApi) if (!measuredFacadeApi.includes(api)) fail(`target facade API missing from current bridge: ${api}`);
if (!facadeSource.includes('getState: snapshotCall(api.getState)') || !facadeSource.includes('function readonlySnapshot')) fail('facade getState must return a deep-frozen snapshot');

console.log(JSON.stringify({
  ok: true,
  status: manifest.status,
  nativeLifecycleRoutes: measuredNativeLifecycle.length,
  nativeRendererRoutes: measuredNativeRenderer.length,
  nativeLazyRoutes: measuredNativeLazy.length,
  fullNativeOwnerRoutes: measuredFullNativeOwner.length,
  legacyRouteOwners: measuredLegacyOwner.length
  ,currentFacadeApi: measuredFacadeApi.length
  ,targetFacadeApi: manifest.approvedFacadeApi.length
}));
