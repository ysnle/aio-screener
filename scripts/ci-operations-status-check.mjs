import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateOperationsStatus } from '../src/data/contracts/operations.js';
import { deriveRouteOwnership } from './build-operations-status.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const status = JSON.parse(read('public-data/operations-status.json'));
const routeOwners = JSON.parse(read('architecture/route-owners.json'));
const validation = validateOperationsStatus(status);
if (!validation.ok) throw new Error(`[operations-status] ${validation.errors.join(',')}`);
if (status.planes.fast.status !== 'OPERATOR_REQUIRED' && status.planes.fast.status !== 'CURRENT') throw new Error('[operations-status] fast plane status is not explicit');

// RM-00/F-07 ratchet: route ownership published here must reconcile with the code-derived
// route-owners.json ledger. A hardcoded "required native routes" list (the pre-remediation
// design) can silently diverge from measurement; equality with the ledger cannot.
const measured = deriveRouteOwnership(routeOwners);
const sameSet = (a, b) => {
  const left = [...(a || [])].sort();
  const right = [...(b || [])].sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
};
if (status.routes.supported !== measured.supported) throw new Error('[operations-status] supported route count does not match route-owners.json');
if (!sameSet(status.routes.nativeLifecycleOwner, measured.nativeLifecycleOwner)) throw new Error('[operations-status] nativeLifecycleOwner does not match route-owners.json');
if (!sameSet(status.routes.nativeRendererOwner, measured.nativeRendererOwner)) throw new Error('[operations-status] nativeRendererOwner does not match route-owners.json');
if (!sameSet(status.routes.nativeOwner, measured.nativeOwner)) throw new Error('[operations-status] nativeOwner does not match route-owners.json');
if (status.routes.legacyOwner !== measured.legacyOwner) throw new Error('[operations-status] legacyOwner does not match route-owners.json');

const nativeRendererOwner = status.routes.nativeRendererOwner || [];
const nativeOwner = status.routes.nativeOwner || [];
if (status.routes.legacyOwner + nativeRendererOwner.length !== status.routes.supported) throw new Error('[operations-status] renderer ownership does not reconcile');
if (status.routes.legacyOwner + nativeOwner.length > status.routes.supported) throw new Error('[operations-status] complete ownership exceeds supported routes');
if (nativeOwner.some((route) => !nativeRendererOwner.includes(route))) throw new Error('[operations-status] complete native owner must also own the renderer');
if (nativeRendererOwner.some((route) => typeof route !== 'string' || route.length === 0)) throw new Error('[operations-status] native renderer owner entry is invalid');
if (status.overall === 'VERIFIED_LIVE') throw new Error('[operations-status] invalid unsupported overall status');
console.log(JSON.stringify({ ok: true, overall: status.overall, durable: status.planes.durable.status, fast: status.planes.fast.status, blockers: status.blockers }));
