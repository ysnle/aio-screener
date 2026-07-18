import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateReconciliationStatus } from '../src/data/contracts/reconciliation.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const status = JSON.parse(fs.readFileSync(path.join(root, 'public-data/reconciliation-status.json'), 'utf8'));
const validation = validateReconciliationStatus(status);
if (!validation.ok) throw new Error(`[reconciliation-contract] ${validation.errors.join(',')}`);
if (status.overall === 'MATCH') throw new Error('[reconciliation-contract] unresolved categories cannot report overall MATCH');
console.log(JSON.stringify({ ok: true, overall: status.overall, categoryCount: status.categories.length, counts: status.counts }));
