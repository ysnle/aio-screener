#!/usr/bin/env node
// v59.62: exits 0 when two JSON documents are equal after dropping the named top-level keys, 1 when they differ or a side
// cannot be read. Workflows use it to skip "timestamp only" commits without assuming the file is pretty-printed.
//   node scripts/lib/json-same-except.mjs <key[,key...]> <old: path or git rev:path> <new: path>
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

export function sameExcept(left, right, keys) {
  const strip = (value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const copy = { ...value };
    for (const key of keys) delete copy[key];
    return copy;
  };
  return JSON.stringify(strip(left)) === JSON.stringify(strip(right));
}

function read(spec) {
  if (/^[0-9a-f]{7,40}:/.test(spec)) {
    const shown = spawnSync('git', ['show', spec], { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
    if (shown.status !== 0) return null;
    return JSON.parse(shown.stdout);
  }
  return JSON.parse(readFileSync(spec, 'utf8'));
}

const entry = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (entry.endsWith('scripts/lib/json-same-except.mjs')) {
  const [keys, oldSpec, newSpec] = process.argv.slice(2);
  let same = false;
  try {
    const before = read(oldSpec);
    same = before != null && sameExcept(before, read(newSpec), String(keys || '').split(',').filter(Boolean));
  } catch { same = false; }
  process.exit(same ? 0 : 1);
}
