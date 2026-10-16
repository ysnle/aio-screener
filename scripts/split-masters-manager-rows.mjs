#!/usr/bin/env node
// v57.89: one-time, offline conversion of public-data/masters/managers/<id>.json into the size-bounded store
// (scripts/lib/masters-manager-store.mjs). No network, no new data: each file is read, reassembled, and rewritten
// through the same writer the 13F producers now use, then read back and compared byte-for-byte with the original
// v1 serialization. Without --write it only reports what would change. Re-running on converted files is a no-op.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildManagerRowsFiles, readManagerRows, writeManagerRows, MANAGER_ROWS_FILE_MAX_BYTES } from './lib/masters-manager-store.mjs';

const directory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public-data/masters/managers');
const write = process.argv.includes('--write');
const digest = (value) => createHash('sha256').update(`${JSON.stringify(value, null, 2)}\n`).digest('hex');
const ids = (await fs.readdir(directory)).filter((name) => /^[a-z0-9-]+\.json$/.test(name)).map((name) => name.slice(0, -5)).sort();
const report = [];
for (const id of ids) {
  const before = await readManagerRows(directory, id);
  const beforeDigest = digest(before);
  const { parts } = buildManagerRowsFiles(before);
  if (write) await writeManagerRows(directory, before);
  const after = write ? await readManagerRows(directory, id) : before;
  if (digest(after) !== beforeDigest) throw new Error(`${id}: reassembled rows differ from the original`);
  report.push({ id, parts: parts.map((part) => `${part.name} ${part.bytes}`), rowsSha256: beforeDigest });
}
const oversized = [];
for (const name of await fs.readdir(directory)) {
  const { size } = await fs.stat(path.join(directory, name));
  if (size > MANAGER_ROWS_FILE_MAX_BYTES) oversized.push(`${name} ${size}`);
}
console.log(JSON.stringify({ ok: true, written: write, managers: ids.length, split: report.filter((row) => row.parts.length), oversized }, null, 2));
if (write && oversized.length) process.exit(1);
