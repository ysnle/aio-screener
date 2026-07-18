import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateOperationsStatus } from '../src/data/contracts/operations.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const status = JSON.parse(fs.readFileSync(path.join(root, 'public-data/operations-status.json'), 'utf8'));
const validation = validateOperationsStatus(status);
if (!validation.ok) throw new Error(`[operations-status] ${validation.errors.join(',')}`);
if (status.planes.fast.status !== 'OPERATOR_REQUIRED' && status.planes.fast.status !== 'CURRENT') throw new Error('[operations-status] fast plane status is not explicit');
if (status.routes.nativeOwner.length < 1 || status.routes.legacyOwner + status.routes.nativeOwner.length !== status.routes.supported) throw new Error('[operations-status] route ownership does not reconcile');
if (status.overall === 'VERIFIED_LIVE') throw new Error('[operations-status] invalid unsupported overall status');
console.log(JSON.stringify({ ok: true, overall: status.overall, durable: status.planes.durable.status, fast: status.planes.fast.status, blockers: status.blockers }));
