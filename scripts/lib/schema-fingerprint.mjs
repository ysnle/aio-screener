// The key structure of a JSON artifact: what a renderer depends on, not the values it shows.
// - object keys are kept; an object with more than MAP_KEY_LIMIT keys, or whose keys are all data-like (tickers,
//   dates, numbers, ids such as "KR:ai-sw"), is a map and contributes one '*' child (the union of its values);
// - arrays contribute the union of their elements' structures; an empty array or map is 'e';
// - every scalar (string, number, boolean, null) is one kind 's', so null on one refresh and a number on the next
//   is the same structure;
// - keys deeper than maxDepth object steps are cut ('…').
// Measured on the data bot's own commits (2026-11-03/04): depth 6 changed 7 of 958 deployed files between two
// refreshes 16 h apart, mostly news-source and theme-id keys and arrays that were empty on one run; the default
// depth 3 with schemaDrift's empty/map tolerance is what the browser-data fixture gate compares.

const MAP_KEY_LIMIT = 40;
export const SCHEMA_DEPTH = 3;
const DATA_KEY = /^(?:[A-Z0-9][A-Z0-9.^=_-]{0,14}|\d{4}-\d{2}(?:-\d{2})?(?:T.*)?|-?\d+(?:\.\d+)?|[A-Z]{2}:[\w.-]+|[\w-]+\.[a-z]{2,}(?:\.[a-z]{2})?)$/;

function isMapLike(keys) {
  return keys.length > MAP_KEY_LIMIT || (keys.length >= 3 && keys.every((key) => DATA_KEY.test(key)));
}

const own = (object, key) => (Object.prototype.hasOwnProperty.call(object, key) ? object[key] : undefined);
const define = (out, key, value) => Object.defineProperty(out, key, { value, enumerable: true });

function shape(value, depth, maxDepth) {
  if (value === null || typeof value !== 'object') return 's';
  if (Array.isArray(value)) return value.length ? ['a', value.reduce((acc, item) => merge(acc, shape(item, depth, maxDepth)), undefined)] : 'e';
  const keys = Object.keys(value);
  if (!keys.length) return 'e';
  if (depth >= maxDepth) return '…';
  if (isMapLike(keys)) return { '*': keys.reduce((acc, key) => merge(acc, shape(value[key], depth + 1, maxDepth)), undefined) };
  const out = {};
  for (const key of keys.sort()) define(out, key, shape(value[key], depth + 1, maxDepth));
  return out;
}

// Union of two structures. A scalar and a container keep the container; 'e' adds nothing.
function merge(left, right) {
  if (left === undefined || left === 'e') return right;
  if (right === undefined || right === 'e') return left;
  if (typeof left === 'string') return typeof right === 'string' ? (left === '…' || right === '…' ? '…' : 's') : right;
  if (typeof right === 'string') return left;
  if (Array.isArray(left) && Array.isArray(right)) return ['a', merge(left[1], right[1])];
  if (Array.isArray(left) || Array.isArray(right)) return Array.isArray(left) ? left : right;
  const out = {};
  for (const key of [...new Set([...Object.keys(left), ...Object.keys(right)])].sort()) define(out, key, merge(own(left, key), own(right, key)));
  return out;
}

export function schemaShape(value, { maxDepth = SCHEMA_DEPTH } = {}) {
  return shape(value, 0, maxDepth);
}

// Paths whose structure differs between a pinned shape and a current one, as '+path' (only now), '-path' (only
// pinned) or 'path' (kind changed). Nothing is reported below an empty container, a map or a depth cut on either
// side, and a scalar against a container is a change.
export function schemaDrift(pinned, current, prefix = '') {
  const here = prefix || '(root)';
  if (pinned === undefined) return [`+${here}`];
  if (current === undefined) return [`-${here}`];
  if (pinned === 'e' || current === 'e' || pinned === '…' || current === '…') return [];
  if (typeof pinned === 'string' || typeof current === 'string') return pinned === current ? [] : [here];
  if (Array.isArray(pinned) !== Array.isArray(current)) return [here];
  if (Array.isArray(pinned)) return schemaDrift(pinned[1], current[1], `${prefix}[]`);
  const pinnedMap = own(pinned, '*') !== undefined && Object.keys(pinned).length === 1;
  const currentMap = own(current, '*') !== undefined && Object.keys(current).length === 1;
  if (pinnedMap || currentMap) return [];
  const out = [];
  for (const key of [...new Set([...Object.keys(pinned), ...Object.keys(current)])].sort()) {
    out.push(...schemaDrift(own(pinned, key), own(current, key), prefix ? `${prefix}.${key}` : key));
  }
  return out;
}
