import { readFileSync } from 'node:fs';
import { stableSerialize } from '../../src/data/contracts/screener.js';
import { createScreenerProvider } from '../../src/data/providers/screener.js';
import assert from 'node:assert/strict';

// Preserve the original implementation even after production moves to streaming.
function stableHash(value) {
  const input = stableSerialize(value);
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) hash = Math.imul(hash ^ input.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function streamingHash(value) {
  let hash = 2166136261;
  const encodedKeys = new Map();
  function emit(text) {
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  function visit(node, missing = 'undefined') {
    if (node === null || typeof node !== 'object') {
      const text = JSON.stringify(node);
      emit(text === undefined ? missing : text);
    } else if (Array.isArray(node)) {
      emit('[');
      for (let i = 0; i < node.length; i++) {
        if (i) emit(',');
        if (i in node) visit(node[i], '');
      }
      emit(']');
    } else {
      emit('{');
      const keys = Object.keys(node).sort();
      for (let i = 0; i < keys.length; i++) {
        if (i) emit(',');
        const key = keys[i];
        let encoded = encodedKeys.get(key);
        if (encoded === undefined) {
          encoded = JSON.stringify(key);
          encodedKeys.set(key, encoded);
        }
        emit(encoded); emit(':'); visit(node[key]);
      }
      emit('}');
    }
  }
  visit(value, undefined);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function iterativeHash(value) {
  let hash = 2166136261;
  const encodedKeys = new Map();
  const stack = [];
  const ancestors = new Set();
  function emit(text) {
    for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  }
  function visit(node, missing) {
    if (node === null || typeof node !== 'object') {
      const encoded = JSON.stringify(node);
      emit(encoded === undefined ? missing : encoded);
      return;
    }
    if (ancestors.has(node)) throw new TypeError('CYCLIC_HASH_INPUT');
    ancestors.add(node);
    const array = Array.isArray(node);
    const keys = array ? null : Object.keys(node).sort();
    emit(array ? '[' : '{');
    stack.push({ node, keys, array, length: array ? node.length : keys.length, index: 0 });
  }
  visit(value);
  while (stack.length) {
    const frame = stack[stack.length - 1];
    if (frame.index === frame.length) {
      emit(frame.array ? ']' : '}'); ancestors.delete(frame.node); stack.pop(); continue;
    }
    const index = frame.index++;
    if (index) emit(',');
    if (frame.array) {
      if (index in frame.node) visit(frame.node[index], '');
    } else {
      const key = frame.keys[index];
      let encoded = encodedKeys.get(key);
      if (encoded === undefined) { encoded = JSON.stringify(key); encodedKeys.set(key, encoded); }
      emit(encoded); emit(':'); visit(frame.node[key], 'undefined');
    }
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

let seed = 17;
const rand = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const atoms = [null, true, false, undefined, NaN, Infinity, -0, 3.14, '', '한글😀"\n', '\ud800', Symbol('ignored'), () => 1];
function tree(depth = 0) {
  if (depth > 3 || rand() < .45) return atoms[Math.floor(rand() * atoms.length)];
  const values = Array.from({ length: Math.floor(rand() * 8) }, () => tree(depth + 1));
  return rand() < .5 ? values : Object.fromEntries(values.map((v, i) => [`k${i}`, v]));
}
for (let i = 0; i < 3000; i++) {
  const value = { payload: tree(), sparse: [, undefined, , 4] };
  assert.equal(streamingHash(value), stableHash(value), stableSerialize(value));
  assert.equal(iterativeHash(value), stableHash(value));
}
const artifact = JSON.parse(readFileSync('public-data/screener.json'));
const universe = JSON.parse(readFileSync('public-data/screener-universe.json'));
const provider = createScreenerProvider({ httpClient: { requestJson: async url => ({ ok: true, data: url.includes('universe') ? universe : artifact }) } });
const state = await provider.readCurrent();
const value = { revision: artifact.asOf, source: artifact.source, rows: state.rows };
assert.equal(streamingHash(value), stableHash(value));
for (const [name, fn] of [['reference', stableHash], ['streaming', streamingHash], ['iterative', iterativeHash]]) {
  fn(value);
  const times = [];
  for (let i = 0; i < 5; i++) { const start = performance.now(); fn(value); times.push(performance.now() - start); }
  console.log(JSON.stringify({ name, rows: state.rows.length, times, median: times.sort((a,b) => a-b)[2] }));
}
