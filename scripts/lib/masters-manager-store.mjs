// v57.89: producer-side 13F manager row store (public-data/masters/managers/<id>.json).
// GitHub warns on pushed files over 50 MB and rejects them over 100 MB; BlackRock's full row ledger reached 60.5 MB
// (49,968 rows) and is rewritten every quarter, so a manager whose pretty JSON exceeds MANAGER_ROWS_FILE_MAX_BYTES is
// written as an index (<id>.json) plus content-only parts (<id>.part-N.json, holdings then comparisons in source order).
// Managers under the limit keep the single masters-13f-manager-rows.v1 file unchanged. Readers go through
// readManagerRows*, which returns the same v1 object either way. The browser never reads these files (Pages excludes
// masters/managers/; the page reads the bounded projection in public-data/objects/masters/).
import { createHash } from 'node:crypto';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { atomicWriteFile } from './atomic-write.mjs';
import { writeJsonIfSemanticallyChanged } from './13f-semantic-hash.mjs';

export const MANAGER_ROWS_SCHEMA = 'masters-13f-manager-rows.v1';
export const MANAGER_ROWS_INDEX_SCHEMA = 'masters-13f-manager-rows-index.v1';
export const MANAGER_ROWS_PART_SCHEMA = 'masters-13f-manager-rows-part.v1';
// 32 MiB keeps every file 36% under GitHub's 50 MB warning; the refresh-data commit gate stops above 50 MB.
export const MANAGER_ROWS_FILE_MAX_BYTES = 32 * 1024 * 1024;
const COLLECTIONS = ['holdings', 'comparisons'];

const serialize = (value) => `${JSON.stringify(value, null, 2)}\n`;
const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
export const managerRowsPartName = (managerId, index) => `${managerId}.part-${index + 1}.json`;
const PART_NAME = /^([a-z0-9-]+)\.part-(\d+)\.json$/;

// A row nested two levels deep (part -> array -> row) gains four spaces per line plus its ",\n" separator.
const nestedRowBytes = (row) => {
  const text = JSON.stringify(row, null, 2);
  return Buffer.byteLength(text, 'utf8') + 4 * (text.split('\n').length) + 2;
};

// Deterministic greedy packing: same rows in, same parts out.
export function planManagerRowParts(shard, { maxBytes = MANAGER_ROWS_FILE_MAX_BYTES } = {}) {
  const budget = maxBytes - Math.min(64 * 1024, Math.floor(maxBytes / 8));
  const parts = [];
  let current = null;
  const open = () => { current = { holdings: [], comparisons: [], bytes: 1024 }; parts.push(current); };
  open();
  for (const key of COLLECTIONS) {
    for (const row of shard[key] || []) {
      const cost = nestedRowBytes(row);
      if (current.bytes + cost > budget && (current.holdings.length || current.comparisons.length)) open();
      current[key].push(row);
      current.bytes += cost;
    }
  }
  return parts.map(({ holdings, comparisons }, index) => ({
    schema: MANAGER_ROWS_PART_SCHEMA,
    managerId: shard.managerId,
    part: index + 1,
    partCount: parts.length,
    holdings,
    comparisons
  }));
}

export function buildManagerRowsFiles(shard, { maxBytes = MANAGER_ROWS_FILE_MAX_BYTES } = {}) {
  if (shard?.schema !== MANAGER_ROWS_SCHEMA || !/^[a-z0-9-]+$/.test(shard.managerId || '')) throw new Error('manager row store expects a masters-13f-manager-rows.v1 shard');
  const single = serialize(shard);
  if (Buffer.byteLength(single, 'utf8') <= maxBytes) return { index: shard, parts: [] };
  const parts = planManagerRowParts(shard, { maxBytes }).map((part, index) => {
    const text = serialize(part);
    const bytes = Buffer.byteLength(text, 'utf8');
    if (bytes > maxBytes) throw new Error(`manager row part over ${maxBytes} bytes for ${shard.managerId} part ${index + 1}: ${bytes}`);
    return { name: managerRowsPartName(shard.managerId, index), value: part, text, bytes };
  });
  const { holdings, comparisons, ...header } = shard;
  const index = {
    ...header,
    schema: MANAGER_ROWS_INDEX_SCHEMA,
    rowSchema: MANAGER_ROWS_SCHEMA,
    holdingsCount: holdings.length,
    comparisonsCount: comparisons.length,
    parts: parts.map(({ name, value, bytes, text }) => ({ path: name, holdings: value.holdings.length, comparisons: value.comparisons.length, bytes, sha256: sha256(text) }))
  };
  return { index, parts };
}

async function staleParts(directory, managerId, keep) {
  const names = await fsp.readdir(directory).catch((error) => { if (error?.code === 'ENOENT') return []; throw error; });
  return names.filter((name) => PART_NAME.exec(name)?.[1] === managerId && !keep.has(name));
}

export async function writeManagerRows(directory, shard, { writer = atomicWriteFile, maxBytes = MANAGER_ROWS_FILE_MAX_BYTES } = {}) {
  const { index, parts } = buildManagerRowsFiles(shard, { maxBytes });
  for (const part of parts) await writeJsonIfSemanticallyChanged(path.join(directory, part.name), part.value, { writer });
  await writeJsonIfSemanticallyChanged(path.join(directory, `${shard.managerId}.json`), index, { writer });
  for (const name of await staleParts(directory, shard.managerId, new Set(parts.map((part) => part.name)))) await fsp.rm(path.join(directory, name));
  return { file: `${shard.managerId}.json`, parts: parts.map((part) => part.name) };
}

// Reassembles the v1 object. `readText(name)` returns a file's text relative to the managers directory, so CI can
// read from the git index (--staged) as well as from disk. Parts are checked against the index digests and counts.
export function assembleManagerRows(index, readText) {
  if (index?.schema === MANAGER_ROWS_SCHEMA) return index;
  if (index?.schema !== MANAGER_ROWS_INDEX_SCHEMA || index.rowSchema !== MANAGER_ROWS_SCHEMA || !Array.isArray(index.parts) || !index.parts.length) throw new Error(`unsupported manager row store schema for ${index?.managerId}: ${index?.schema}`);
  const holdings = [];
  const comparisons = [];
  index.parts.forEach((descriptor, position) => {
    if (descriptor.path !== managerRowsPartName(index.managerId, position)) throw new Error(`manager row part order drift for ${index.managerId}: ${descriptor.path}`);
    const text = readText(descriptor.path);
    if (sha256(text.replace(/\r\n?/g, '\n')) !== descriptor.sha256) throw new Error(`manager row part digest drift for ${descriptor.path}`);
    const part = JSON.parse(text);
    if (part.schema !== MANAGER_ROWS_PART_SCHEMA || part.managerId !== index.managerId || part.part !== position + 1 || part.partCount !== index.parts.length || part.holdings?.length !== descriptor.holdings || part.comparisons?.length !== descriptor.comparisons) throw new Error(`manager row part content drift for ${descriptor.path}`);
    holdings.push(...part.holdings);
    comparisons.push(...part.comparisons);
  });
  if (holdings.length !== index.holdingsCount || comparisons.length !== index.comparisonsCount) throw new Error(`manager row part totals drift for ${index.managerId}: ${holdings.length}/${comparisons.length}`);
  const { schema, rowSchema, holdingsCount, comparisonsCount, parts, ...header } = index;
  return { schema: rowSchema, ...header, holdings, comparisons };
}

export async function readManagerRows(directory, managerId) {
  const index = JSON.parse(await fsp.readFile(path.join(directory, `${managerId}.json`), 'utf8'));
  if (index?.schema === MANAGER_ROWS_SCHEMA) return index;
  const texts = new Map();
  for (const descriptor of index.parts || []) texts.set(descriptor.path, await fsp.readFile(path.join(directory, descriptor.path), 'utf8'));
  return assembleManagerRows(index, (name) => texts.get(name));
}
