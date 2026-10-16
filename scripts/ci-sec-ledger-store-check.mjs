#!/usr/bin/env node
// v57.90: fixture check for the data-store layout of the producer-only SEC ledger (scripts/lib/sec-ledger-store.mjs,
// used by scripts/sec-fundamentals-store.mjs restore/publish). On a small part limit and a throwaway git repository it
// proves: the ledger splits on line boundaries into parts that each fit, the split is deterministic (same tree id,
// CRLF input included), a store commit reassembles to the exact canonical text whose digest the projection manifest
// records, a pre-v57.90 single-file commit is still readable, and a tampered or missing part is refused. When this
// checkout carries the manifest-matched ledger it also splits the real file at the real limit and checks the digest.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { SEC_STORE_FILE, canonicalSha256, readSecLedger } from './lib/sec-ledger.mjs';
import {
  SEC_STORE_INDEX_FILE, SEC_STORE_PART_MAX_BYTES, assembleSecLedger, readSecStore, splitSecLedger, writeSecStoreTree
} from './lib/sec-ledger-store.mjs';

const fail = (message) => { console.error(`[sec-ledger-store] ${message}`); process.exit(1); };
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'aio-sec-ledger-store-'));
const identity = { GIT_AUTHOR_NAME: 'fixture', GIT_AUTHOR_EMAIL: 'fixture@example.com', GIT_COMMITTER_NAME: 'fixture', GIT_COMMITTER_EMAIL: 'fixture@example.com' };
const git = (args, input) => {
  const result = spawnSync('git', args, { cwd: directory, input, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, ...identity, GIT_TERMINAL_PROMPT: '0' } });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${String(result.stderr).trim()}`);
  return result.stdout;
};
const plumbing = {
  hashObject: (buffer) => String(git(['hash-object', '-w', '--stdin'], buffer)).trim(),
  mktree: (listing) => String(git(['mktree'], listing)).trim()
};
const commitOf = (tree) => String(git(['commit-tree', tree, '-m', 'fixture'])).trim();
const blobReader = (commit) => (name) => {
  const result = spawnSync('git', ['cat-file', 'blob', `${commit}:${name}`], { cwd: directory, maxBuffer: 64 * 1024 * 1024 });
  return result.status === 0 && result.stdout.length ? result.stdout : null;
};

// Same shape as the producer's ledger: one-space pretty JSON, non-ASCII entity names, millions of short lines.
const ledger = (records, stamp = '2026-10-16T05:38:01.485Z') => `${JSON.stringify({
  schemaVersion: '2.0', generatedAt: stamp, source: 'SEC EDGAR companyfacts',
  data: Object.fromEntries(Array.from({ length: records }, (_, index) => [`T${index}`, {
    cik: String(1000000 + index).padStart(10, '0'), entityName: `발행사 ${index} Holdings Inc.`,
    facts: Array.from({ length: 4 }, (__, year) => ({ fy: 2022 + year, revenue: (index + 1) * (year + 7) * 1000, unit: 'USD' }))
  }]))
}, null, 1)}\n`;

let summary = '';
try {
  git(['init', '-q']);
  const maxBytes = 4096;
  const text = ledger(60);
  const split = splitSecLedger(text, { maxBytes });
  if (split.parts.length < 3) fail(`fixture ledger (${Buffer.byteLength(text)} bytes) was not split: ${split.parts.length} part(s)`);
  split.parts.forEach((part, position) => {
    if (part.bytes > maxBytes) fail(`${part.name} is ${part.bytes} bytes, over the ${maxBytes}-byte limit`);
    if (part.buffer[part.buffer.length - 1] !== 0x0a) fail(`${part.name} does not end on a line boundary`);
    if (part.name !== `${SEC_STORE_FILE}.part-${position + 1}`) fail(`unexpected part name ${part.name}`);
  });
  if (split.sourceSha256 !== canonicalSha256(text)) fail('index sourceSha256 differs from the manifest digest (canonicalSha256)');
  if (splitSecLedger(text.replace(/\n/g, '\r\n'), { maxBytes }).indexText !== split.indexText) fail('CRLF input produced a different index');

  const written = writeSecStoreTree(text, { ...plumbing, maxBytes });
  if (writeSecStoreTree(text, { ...plumbing, maxBytes }).tree !== written.tree) fail('the same ledger produced a different store tree');
  const listed = String(git(['ls-tree', '--name-only', written.tree])).trim().split('\n').sort();
  const expected = [SEC_STORE_INDEX_FILE, ...split.parts.map((part) => part.name)].sort();
  if (listed.join(',') !== expected.join(',')) fail(`store tree holds ${listed.join(', ')}`);
  const commit = commitOf(written.tree);
  const restored = readSecStore(blobReader(commit));
  if (restored.layout !== 'parts' || !restored.buffer) fail(`store commit did not reassemble: ${restored.error || restored.layout}`);
  if (restored.buffer.toString('utf8') !== text || canonicalSha256(restored.buffer.toString('utf8')) !== canonicalSha256(text)) fail('reassembled ledger differs from the canonical text');
  JSON.parse(restored.buffer.toString('utf8'));
  if (writeSecStoreTree(ledger(60, '2026-10-17T05:38:01.485Z'), { ...plumbing, maxBytes }).tree === written.tree) fail('a changed ledger kept the same store tree');

  const legacyTree = plumbing.mktree(`100644 blob ${plumbing.hashObject(Buffer.from(text, 'utf8'))}\t${SEC_STORE_FILE}\n`);
  const legacy = readSecStore(blobReader(commitOf(legacyTree)));
  if (legacy.layout !== 'single' || legacy.buffer?.toString('utf8') !== text) fail('a pre-v57.90 single-file store commit is no longer readable');

  const tampered = JSON.parse(split.indexText);
  tampered.parts[1].sha256 = '0'.repeat(64);
  const tamperedTree = plumbing.mktree([
    `100644 blob ${plumbing.hashObject(Buffer.from(JSON.stringify(tampered), 'utf8'))}\t${SEC_STORE_INDEX_FILE}\n`,
    ...split.parts.map((part) => `100644 blob ${plumbing.hashObject(part.buffer)}\t${part.name}\n`)
  ].join(''));
  if (readSecStore(blobReader(commitOf(tamperedTree))).buffer) fail('a part digest mismatch was accepted');
  const missingTree = plumbing.mktree([
    `100644 blob ${plumbing.hashObject(Buffer.from(split.indexText, 'utf8'))}\t${SEC_STORE_INDEX_FILE}\n`,
    ...split.parts.slice(1).map((part) => `100644 blob ${plumbing.hashObject(part.buffer)}\t${part.name}\n`)
  ].join(''));
  if (readSecStore(blobReader(commitOf(missingTree))).buffer) fail('a store commit with a missing part was accepted');
  if ((() => { try { splitSecLedger(`{"x":"${'a'.repeat(maxBytes)}"}\n`, { maxBytes }); return true; } catch { return false; } })()) fail('a line longer than the part limit was split silently');
  summary = `fixture ${split.parts.length} parts split/reassemble/determinism/CRLF/legacy/tamper/missing verified`;
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}

// The real ledger, when this checkout carries the copy the committed manifest names.
const real = readSecLedger();
if (real.present) {
  const split = splitSecLedger(real.text);
  const oversized = split.parts.filter((part) => part.bytes > SEC_STORE_PART_MAX_BYTES);
  if (oversized.length) fail(`real ledger parts over ${SEC_STORE_PART_MAX_BYTES} bytes: ${oversized.map((part) => part.name).join(', ')}`);
  const joined = assembleSecLedger(split.index, (name) => split.parts.find((part) => part.name === name)?.buffer);
  if (canonicalSha256(joined.toString('utf8')) !== canonicalSha256(real.text)) fail('real ledger does not reassemble to its manifest digest');
  summary += `; real ledger ${(split.index.bytes / 1048576).toFixed(1)} MiB -> ${split.parts.length} part(s), largest ${(Math.max(...split.parts.map((part) => part.bytes)) / 1048576).toFixed(1)} MiB, digest matches the manifest`;
} else {
  summary += `; real ledger ${real.stale ? 'stale (does not match the manifest)' : 'absent'} in this checkout, real-size split skipped`;
}
console.log(`SEC ledger store OK: ${summary}.`);
