#!/usr/bin/env node
// v57.89: fixture check for the size-bounded 13F manager row store (scripts/lib/masters-manager-store.mjs).
// Proves, on a temp directory and a small byte limit, that a large manager is split into index + parts that each fit,
// reassembles byte-for-byte to the v1 object, survives a rewrite unchanged, shrinks back to one file (stale parts
// removed), and that a tampered part is refused. Then checks the committed store: no manager file over the limit.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MANAGER_ROWS_FILE_MAX_BYTES, MANAGER_ROWS_INDEX_SCHEMA, readManagerRows, writeManagerRows
} from './lib/masters-manager-store.mjs';

const fail = (message) => { console.error(`[masters-manager-store] ${message}`); process.exit(1); };
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const text = (value) => `${JSON.stringify(value, null, 2)}\n`;
const row = (index, kind) => ({ managerId: 'fixture-manager', reportPeriod: '2026-06-30', issuer: `ISSUER ${kind} ${index}`, cusip: String(100000000 + index), value: index * 1000, shares: index, key: `${kind}-${index}` });
const shard = (holdings, comparisons) => ({
  schema: 'masters-13f-manager-rows.v1', sourceKind: 'SEC_EDGAR', reviewedAt: '2026-10-16', generatedAt: '2026-10-16T00:00:00.000Z',
  managerId: 'fixture-manager', cik: '0000000001', latestFiling: { accession: '0000000001-26-000001', periodOfReport: '2026-06-30' },
  priorFiling: null, verification: { fullRowCount: holdings },
  holdings: Array.from({ length: holdings }, (_, index) => row(index, 'h')),
  comparisons: Array.from({ length: comparisons }, (_, index) => row(index, 'c'))
});

const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'aio-manager-store-'));
try {
  const maxBytes = 16 * 1024;
  const large = shard(120, 60);
  await writeManagerRows(directory, large, { maxBytes });
  const files = (await fs.readdir(directory)).sort();
  const index = JSON.parse(await fs.readFile(path.join(directory, 'fixture-manager.json'), 'utf8'));
  if (index.schema !== MANAGER_ROWS_INDEX_SCHEMA || index.parts.length < 3 || index.holdings || index.comparisons) fail(`large manager was not split: ${files.join(', ')}`);
  for (const name of files) if ((await fs.stat(path.join(directory, name))).size > maxBytes) fail(`${name} exceeds the ${maxBytes}-byte limit`);
  if (text(await readManagerRows(directory, 'fixture-manager')) !== text(large)) fail('split store does not reassemble to the original rows');
  const before = await Promise.all(files.map((name) => fs.readFile(path.join(directory, name), 'utf8')));
  await writeManagerRows(directory, { ...large, generatedAt: '2026-10-17T00:00:00.000Z' }, { maxBytes });
  const after = await Promise.all(files.map((name) => fs.readFile(path.join(directory, name), 'utf8')));
  if (before.some((value, position) => value !== after[position])) fail('a clock-only rewrite changed the split store');
  const partPath = path.join(directory, index.parts[1].path);
  const original = await fs.readFile(partPath, 'utf8');
  await fs.writeFile(partPath, original.replace('ISSUER', 'ISSUEX'));
  if (await readManagerRows(directory, 'fixture-manager').then(() => true, () => false)) fail('a tampered part was accepted');
  await fs.writeFile(partPath, original);
  const small = shard(3, 2);
  await writeManagerRows(directory, small, { maxBytes });
  const remaining = await fs.readdir(directory);
  if (remaining.length !== 1 || text(JSON.parse(await fs.readFile(path.join(directory, 'fixture-manager.json'), 'utf8'))) !== text(small)) fail(`small manager did not return to one v1 file: ${remaining.join(', ')}`);
} finally {
  await fs.rm(directory, { recursive: true, force: true });
}

const committed = path.join(root, 'public-data', 'masters', 'managers');
const names = await fs.readdir(committed).catch(() => []);
const oversized = [];
for (const name of names) {
  const { size } = await fs.stat(path.join(committed, name));
  if (size > MANAGER_ROWS_FILE_MAX_BYTES) oversized.push(`${name} ${size}`);
}
if (oversized.length) fail(`manager row files over ${MANAGER_ROWS_FILE_MAX_BYTES} bytes (run node scripts/split-masters-manager-rows.mjs --write): ${oversized.join(', ')}`);
console.log(`Masters manager row store OK: fixture split/reassemble/rewrite/shrink/tamper verified; ${names.length} committed file(s) within ${MANAGER_ROWS_FILE_MAX_BYTES} bytes.`);
