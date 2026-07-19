import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('architecture/retirement-manifest.json'));
const bootstrap = read('src/app/bootstrap.js');
const core = read('js/aio-core.js');
const status = JSON.parse(read('public-data/operations-status.json'));
const fail = (message) => { throw new Error(`[retirement] ${message}`); };
if (manifest.nativeRoutes.length !== 17 || manifest.legacyRouteOwners.length || manifest.legacyObserverOwners.length) fail('route ownership is not fully native');
if (status.routes.legacyOwner !== 0 || status.routes.observerOwner !== 0) fail('operations owner state is not retired');
if (bootstrap.includes('createLegacyObserverPage') || bootstrap.includes('legacy-observer.js')) fail('legacy observer registry is still bootstrapped');
for (const route of manifest.nativeRoutes) {
  const matcher = new RegExp(`['"]${route}['"]\\s*:\\s*\\{[^}]*init:\\s*null`, 's');
  if (!matcher.test(core)) fail(`legacy PAGES init remains for ${route}`);
}
for (const api of manifest.approvedFacadeApi) if (!read('src/legacy/compatibility-facade.js').includes(api)) fail(`facade API missing: ${api}`);
console.log(JSON.stringify({ ok: true, status: manifest.status, nativeRoutes: manifest.nativeRoutes.length, legacyRouteOwners: 0 }));
