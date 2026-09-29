import { createHash } from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import { atomicWriteFile, atomicWriteFileSync } from './atomic-write.mjs';

// These fields describe when a producer checked or materialized the same SEC
// evidence. They are useful provenance, but must not turn an unchanged filing
// into a new public data revision.
const POLL_CLOCK_FIELDS = new Set([
  'generatedAt',
  'reviewedAt',
  'checkedAt',
  'collectedAt',
  'currentnessCheckedAt',
  'ownershipCheckedAt'
]);

function isPollRevision(key, value) {
  return key === 'revision'
    && typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}-v[^\s]+$/.test(value);
}

function semanticProjection(value) {
  if (Array.isArray(value)) return value.map(semanticProjection);
  if (!value || typeof value !== 'object') return value;

  const projected = {};
  for (const key of Object.keys(value).sort()) {
    if (POLL_CLOCK_FIELDS.has(key) || isPollRevision(key, value[key])) continue;
    projected[key] = semanticProjection(value[key]);
  }
  return projected;
}

export function semanticJson(value) {
  return JSON.stringify(semanticProjection(value));
}

export function semanticDigest(value) {
  return createHash('sha256').update(semanticJson(value), 'utf8').digest('hex');
}

export function rawSha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function serializeJson(value, pretty) {
  const serialized = pretty ? JSON.stringify(value, null, 2) : JSON.stringify(value);
  if (typeof serialized !== 'string') throw new TypeError('13F artifact must serialize to JSON');
  return `${serialized}\n`;
}

function parseExistingJson(text, file) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`Cannot compare existing 13F artifact ${file}: invalid JSON`, { cause: error });
  }
}

export async function writeJsonIfSemanticallyChanged(file, value, { pretty = true, writer = atomicWriteFile } = {}) {
  const nextDigest = semanticDigest(value);
  let previousText;
  try {
    previousText = await fsp.readFile(file, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (previousText !== undefined) {
    const previousDigest = semanticDigest(parseExistingJson(previousText, file));
    if (previousDigest === nextDigest) return { written: false, semanticDigest: nextDigest };
  }

  await writer(file, serializeJson(value, pretty), 'utf8');
  return { written: true, semanticDigest: nextDigest };
}

export function writeJsonIfSemanticallyChangedSync(file, value, { pretty = true, writer = atomicWriteFileSync } = {}) {
  const nextDigest = semanticDigest(value);
  let previousText;
  try {
    previousText = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  if (previousText !== undefined) {
    const previousDigest = semanticDigest(parseExistingJson(previousText, file));
    if (previousDigest === nextDigest) return { written: false, semanticDigest: nextDigest };
  }

  writer(file, serializeJson(value, pretty), 'utf8');
  return { written: true, semanticDigest: nextDigest };
}
