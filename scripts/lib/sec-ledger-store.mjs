// v57.90: data-store layout for the producer-only SEC ledger (public-data/sec-fundamentals.json).
// Until v57.89 the ledger was one blob on the data-store branch; it reached 87.8 MB on 2026-10-16 (P1757 era ~67 MB),
// about 12 MB under GitHub's 100 MB per-file push rejection. The branch now holds an index plus byte-exact parts:
// the canonical (LF-normalized) text is cut greedily at line boundaries into parts of at most SEC_STORE_PART_MAX_BYTES,
// so the same ledger always yields the same parts, and concatenating them reproduces the text whose digest the
// projection manifest records as sourceSha256. Parts are text slices, not JSON documents; only the joined text parses.
// The local working copy stays one file, so every consumer (producer, projection, gates) is unchanged.
import { createHash } from 'node:crypto';
import { canonicalText, SEC_STORE_FILE } from './sec-ledger.mjs';

export const SEC_STORE_INDEX_SCHEMA = 'sec-fundamentals-store-index.v1';
export const SEC_STORE_INDEX_FILE = 'sec-fundamentals.index.json';
// 32 MiB keeps every part 36% under GitHub's 50 MB warning (same limit as the 13F manager row store, v57.89).
export const SEC_STORE_PART_MAX_BYTES = 32 * 1024 * 1024;
export const secStorePartName = (index) => `${SEC_STORE_FILE}.part-${index + 1}`;

const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex');
const NEWLINE = 0x0a;

// Deterministic greedy packing on line boundaries: a part ends after the last "\n" that keeps it within maxBytes.
export function splitSecLedger(value, { maxBytes = SEC_STORE_PART_MAX_BYTES } = {}) {
  const buffer = Buffer.from(canonicalText(Buffer.isBuffer(value) ? value.toString('utf8') : value), 'utf8');
  if (!buffer.length) throw new Error('SEC ledger store: refusing to split an empty ledger');
  const parts = [];
  let start = 0;
  while (start < buffer.length) {
    let end = buffer.length;
    if (end - start > maxBytes) {
      end = buffer.lastIndexOf(NEWLINE, start + maxBytes - 1) + 1;
      if (end <= start) throw new Error(`SEC ledger store: a single line at byte ${start} exceeds the ${maxBytes}-byte part limit`);
    }
    const slice = buffer.subarray(start, end);
    parts.push({ name: secStorePartName(parts.length), buffer: slice, bytes: slice.length, sha256: sha256(slice) });
    start = end;
  }
  const index = {
    schema: SEC_STORE_INDEX_SCHEMA,
    file: SEC_STORE_FILE,
    sourceSha256: sha256(buffer),
    bytes: buffer.length,
    partMaxBytes: maxBytes,
    parts: parts.map(({ name, bytes, sha256: digest }) => ({ path: name, bytes, sha256: digest }))
  };
  return { index, indexText: `${JSON.stringify(index, null, 2)}\n`, parts, sourceSha256: index.sourceSha256 };
}

// Reassembles the canonical ledger text. `readPart(path)` returns that part's Buffer (from a git tree or from disk);
// every part is checked against the index (order, size, digest) and the joined text against sourceSha256.
export function assembleSecLedger(index, readPart) {
  if (index?.schema !== SEC_STORE_INDEX_SCHEMA || index.file !== SEC_STORE_FILE || !Array.isArray(index.parts) || !index.parts.length) {
    throw new Error(`SEC ledger store: unsupported index schema ${index?.schema}`);
  }
  const buffers = index.parts.map((descriptor, position) => {
    if (descriptor.path !== secStorePartName(position)) throw new Error(`SEC ledger store: part order drift at ${descriptor.path}`);
    const buffer = readPart(descriptor.path);
    if (!buffer || buffer.length !== descriptor.bytes || sha256(buffer) !== descriptor.sha256) throw new Error(`SEC ledger store: part digest drift for ${descriptor.path}`);
    return buffer;
  });
  const joined = Buffer.concat(buffers);
  if (joined.length !== index.bytes || sha256(joined) !== index.sourceSha256) throw new Error('SEC ledger store: reassembled ledger does not match the index sourceSha256');
  return joined;
}

// Writes the store tree through injected git plumbing (`hashObject(buffer)` -> blob id, `mktree(listing)` -> tree id),
// so the CLI and the fixture check run the same code. Same ledger in, same tree id out.
export function writeSecStoreTree(text, { hashObject, mktree, maxBytes = SEC_STORE_PART_MAX_BYTES }) {
  const { indexText, parts, sourceSha256 } = splitSecLedger(text, { maxBytes });
  const entries = [[SEC_STORE_INDEX_FILE, Buffer.from(indexText, 'utf8')], ...parts.map((part) => [part.name, part.buffer])];
  const tree = mktree(entries.map(([name, buffer]) => `100644 blob ${hashObject(buffer)}\t${name}\n`).join(''));
  return { tree, sourceSha256, parts: parts.length, largestPartBytes: Math.max(...parts.map((part) => part.bytes)) };
}

// Reads a store commit through `readBlob(name)` (Buffer or null). A commit without the index is the pre-v57.90
// single-file layout, read as before until the first publish replaces it.
export function readSecStore(readBlob) {
  const indexBlob = readBlob(SEC_STORE_INDEX_FILE);
  if (!indexBlob) return { layout: 'single', buffer: readBlob(SEC_STORE_FILE) };
  try {
    return { layout: 'parts', buffer: assembleSecLedger(JSON.parse(indexBlob.toString('utf8')), readBlob) };
  } catch (error) {
    return { layout: 'parts', buffer: null, error: error.message };
  }
}
