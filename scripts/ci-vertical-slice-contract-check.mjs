import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ROUTE_IDS } from '../src/app/routes.js';
import { VERTICAL_SLICE_CONTRACTS, auditVerticalSliceContracts } from '../src/app/vertical-slices.js';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const fail = (message) => { throw new Error(message); };

const audit = auditVerticalSliceContracts(ROUTE_IDS);
if (!audit.ok || audit.sliceCount !== 13 || audit.coveredRoutes.length !== ROUTE_IDS.length) fail(`vertical slice registry drifted: ${JSON.stringify(audit)}`);
if (VERTICAL_SLICE_CONTRACTS.some((slice) => slice.routes.length < 1 || slice.acceptance.length < 13)) fail('vertical slice acceptance contract is incomplete');
const routeOwners = JSON.parse(read('architecture/route-owners.json'));
for (const route of ROUTE_IDS) {
  const owner = routeOwners.routes?.[route];
  if (!owner || owner.lifecycleOwner !== 'native' || !owner.nativeModule) fail(`route lifecycle owner missing for ${route}`);
}
const router = read('src/app/router.js');
const bootstrap = read('src/app/bootstrap.js');
if (!router.includes('getVerticalSliceContract') || !router.includes('aioVerticalSlice') || !router.includes('requiredData')) fail('router does not mount vertical slice markers');
if (!bootstrap.includes('auditVerticalSliceContracts') || !bootstrap.includes('getVerticalSliceContracts')) fail('architecture API does not expose the vertical slice registry');
const core = read('js/aio-core.js');
if (!core.includes('AIO_PAGE_CONTRACTS') || !core.includes('getPageDataCompleteness') || !core.includes('blocked') || !core.includes('stale-reference')) fail('page completeness contract is not wired to the slice gate');
console.log(JSON.stringify({ ok: true, slices: VERTICAL_SLICE_CONTRACTS.map((slice) => ({ id: slice.id, routes: slice.routes, requiredData: slice.requiredData })), routes: ROUTE_IDS.length }));
