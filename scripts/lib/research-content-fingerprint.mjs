// S17~S19 content invariance: every string leaf of a research value, in traversal order, hashed. Two values with
// the same fingerprint show the reader the same words in the same order, whatever file holds them.
import { createHash } from 'node:crypto';

export function stringLeaves(value, out = []) {
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) value.forEach((item) => stringLeaves(item, out));
  else if (value && typeof value === 'object') Object.keys(value).forEach((key) => stringLeaves(value[key], out));
  return out;
}

export function fingerprint(value) {
  const leaves = stringLeaves(value);
  const joined = leaves.join('\u0000');
  return { strings: leaves.length, chars: leaves.reduce((sum, text) => sum + text.length, 0), sha256: createHash('sha256').update(joined).digest('hex') };
}
