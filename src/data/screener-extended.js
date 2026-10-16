// v57.81: the extended screener universe — every Russell 2000 member and every Nasdaq-listed common stock that the
// core universe (public-data/screener-universe.json) does not already hold. The core artifact (screener.json) keeps
// its size and contract; the extra rows ship in one separate shard (public-data/screener-extended.json) with the same
// row schema, read only when a reader picks 확장 on the screener. This module is shared by the producer
// (scripts/fetch-data.mjs), the gates and the browser provider, so the row encoding and the scope rule live once.

export const EXTENDED_SHARD_SCHEMA = 'screener-extended.v1';
export const EXTENDED_UNIVERSE_SCHEMA = 'screener-extended-universe.v1';
export const EXTENDED_ROW_ENCODING = 'row-defaults.v1';
export const EXTENDED_SHARD_URL = './public-data/screener-extended.json';
export const UNIVERSE_SCOPE_KEY = 'aio_screener_universe_scope';
export const UNIVERSE_SCOPES = Object.freeze(['core', 'extended']);
// Membership tags use the index keys the screener already labels (INDEX_LABELS in src/ui/pages/screener.js).
export const MEMBERSHIP_TAGS = Object.freeze({ R2000: 'RUSSELL2000', NASDAQ: 'NASDAQ' });
// Fields shared by most rows are written once per shard. Rows that carry a `when` key also take that group's
// defaults (fundamental lineage repeats on every SEC-backed row). The key that switches a group is never hoisted.
export const EXTENDED_DEFAULT_GROUPS = Object.freeze(['fundamentalSource', 'valuationPrice']);

// Ranking contracts. Percentiles are recomputed in the browser over the rows that arrived: the core contract over the
// core universe only (the published reading, candidate record and validation use it), the extended contract over
// core + extended rows of the same market. A core stock's percentile can therefore differ between the two views.
export const RANKING_CONTRACTS = Object.freeze({
  core: Object.freeze({ id: 'core-universe', label: '기본 종목 범위', population: 'core-universe' }),
  extended: Object.freeze({ id: 'extended-universe', label: '확장 유니버스 기준(기본 + 러셀2000·나스닥)', population: 'core-plus-extended' })
});

export function normalizeUniverseScope(value) {
  return value === 'extended' ? 'extended' : 'core';
}

// The choice is per reader and survives a reload. safeLS (js/aio-core.js) owns plain-text storage in this app; the
// direct localStorage path is the fallback before that script has loaded. Any storage failure reads as 'core'.
export function readUniverseScope(root = globalThis) {
  try {
    const raw = typeof root?.safeLSGetSync === 'function'
      ? root.safeLSGetSync(UNIVERSE_SCOPE_KEY, '')
      : root?.localStorage?.getItem?.(UNIVERSE_SCOPE_KEY);
    return normalizeUniverseScope(raw);
  } catch (_) {
    return 'core';
  }
}

export function writeUniverseScope(root = globalThis, scope) {
  const value = normalizeUniverseScope(scope);
  try {
    if (typeof root?.safeLS === 'function') {
      const pending = root.safeLS(UNIVERSE_SCOPE_KEY, value);
      if (pending && typeof pending.catch === 'function') pending.catch(() => {});
    } else root?.localStorage?.setItem?.(UNIVERSE_SCOPE_KEY, value);
  } catch (_) { /* storage unavailable: the choice lasts for this page only */ }
  return value;
}

// The 확장 option names how many rows the shard added. Before the shard has loaded in this visit, the count from the
// last load is shown (or none). Storage failure only drops the count from the label.
export const EXTENDED_COUNT_KEY = 'aio_screener_extended_count';
export function rememberExtendedCount(root = globalThis, value = null) {
  try {
    if (value != null) {
      if (typeof root?.safeLS === 'function') {
        const pending = root.safeLS(EXTENDED_COUNT_KEY, String(value));
        if (pending && typeof pending.catch === 'function') pending.catch(() => {});
      } else root?.localStorage?.setItem?.(EXTENDED_COUNT_KEY, String(value));
      return Number(value) > 0 ? Number(value) : null;
    }
    const raw = typeof root?.safeLSGetSync === 'function'
      ? root.safeLSGetSync(EXTENDED_COUNT_KEY, '')
      : root?.localStorage?.getItem?.(EXTENDED_COUNT_KEY);
    const stored = Number(raw);
    return Number.isFinite(stored) && stored > 0 ? stored : null;
  } catch (_) {
    return Number(value) > 0 ? Number(value) : null;
  }
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function commonValues(rows, keys) {
  const n = rows.length;
  const out = {};
  if (!n) return out;
  for (const key of keys) {
    const counts = new Map();
    let present = 0;
    for (const row of rows) {
      if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
      present += 1;
      const text = JSON.stringify(row[key]);
      counts.set(text, (counts.get(text) || 0) + 1);
    }
    // Only a key every row carries can be hoisted; otherwise expansion would add it to rows that never had it.
    if (present !== n) continue;
    let best = null;
    for (const [text, count] of counts) if (!best || count > best.count) best = { text, count };
    if (best && best.count >= n * 0.5) out[key] = JSON.parse(best.text);
  }
  return out;
}

function strip(row, defaults) {
  const out = {};
  for (const [key, value] of Object.entries(row)) {
    if (Object.prototype.hasOwnProperty.call(defaults, key) && same(defaults[key], value)) continue;
    out[key] = value;
  }
  return out;
}

// Lossless: expandShardRows(encodeShardRows(data)) deep-equals data.
export function encodeShardRows(data = {}, { groups = EXTENDED_DEFAULT_GROUPS } = {}) {
  const symbols = Object.keys(data);
  const rows = symbols.map((sym) => data[sym]);
  const allKeys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  // A group's switch key stays on every row that has it, or expansion could not tell which rows take the group.
  const rowDefaults = commonValues(rows, allKeys.filter((key) => !groups.includes(key)));
  const rowDefaultsWhen = [];
  // Each key belongs to one default set at most, so expansion order can never change a value.
  const hoisted = new Set(Object.keys(rowDefaults));
  for (const when of groups) {
    const members = rows.filter((row) => Object.prototype.hasOwnProperty.call(row, when));
    const keys = allKeys.filter((key) => !hoisted.has(key) && !groups.includes(key));
    const defaults = commonValues(members, keys);
    Object.keys(defaults).forEach((key) => hoisted.add(key));
    if (Object.keys(defaults).length) rowDefaultsWhen.push({ when, defaults });
  }
  const encoded = {};
  symbols.forEach((sym, index) => {
    let row = strip(rows[index], rowDefaults);
    for (const group of rowDefaultsWhen) if (Object.prototype.hasOwnProperty.call(rows[index], group.when)) row = strip(row, group.defaults);
    encoded[sym] = row;
  });
  return { rowEncoding: EXTENDED_ROW_ENCODING, rowDefaults, rowDefaultsWhen, data: encoded };
}

export function expandShardRow(shard, row) {
  if (!row || typeof row !== 'object') return null;
  if (shard?.rowEncoding !== EXTENDED_ROW_ENCODING) return { ...row };
  let out = { ...(shard.rowDefaults || {}) };
  for (const group of Array.isArray(shard.rowDefaultsWhen) ? shard.rowDefaultsWhen : []) {
    if (group && Object.prototype.hasOwnProperty.call(row, group.when)) out = { ...out, ...(group.defaults || {}) };
  }
  return { ...out, ...row };
}

export function expandShardRows(shard) {
  const data = shard?.data && typeof shard.data === 'object' && !Array.isArray(shard.data) ? shard.data : {};
  const out = {};
  for (const [sym, row] of Object.entries(data)) {
    const expanded = expandShardRow(shard, row);
    if (expanded) out[sym] = expanded;
  }
  return out;
}

// Identity rows (sym, name, sector, index, membership) the shard carries for its own symbols.
export function shardIdentityRows(shard) {
  const rows = Array.isArray(shard?.identity) ? shard.identity : [];
  return rows.filter((row) => row && typeof row.sym === 'string' && row.sym);
}

export function isValidShard(shard) {
  return !!shard && shard.schemaVersion === EXTENDED_SHARD_SCHEMA
    && shard.data && typeof shard.data === 'object' && !Array.isArray(shard.data)
    && Array.isArray(shard.identity);
}

// Membership of one row as index keys: a core row's own index plus any Russell 2000/Nasdaq tag the shard records.
export function rowMembership(identity = {}, extraTags = []) {
  const tags = new Set();
  if (identity?.index) tags.add(String(identity.index).toUpperCase());
  for (const tag of Array.isArray(identity?.membership) ? identity.membership : []) tags.add(String(tag).toUpperCase());
  for (const tag of Array.isArray(extraTags) ? extraTags : []) tags.add(String(tag).toUpperCase());
  return [...tags];
}
