// v59.70 (data audit R2): the one reader and writer of public-data/history.json's shape. 93% of the file (4.4 of 4.7 MB)
// was per-field provenance repeated on every row. history.v2 keeps one field dictionary for the values a field shares
// on every row (source, sourceKind, allowedUse, rule, universe, marketSession — not freshness metadata) and one
// `checkedAt` per field in place of fetchedAt + lastSuccessfulAt (the same instant on every row so far; both stay when
// they differ). The freshness rule (aio-freshness.v1, actions-reliability): observedAt is the value's own observation
// time and stays on the row; sessionDate is the row's basisSession and keeps its name; checkedAt maps to fetchedAt and
// lastSuccessfulAt. Workflow-level freshness lives in public-data/freshness/<workflow>.json and is not repeated here.
//
// Every reader expands through readHistoryRows(), which returns the v1 rows exactly (an array payload is v1 already),
// so no consumer reads the stored shape. scripts/ci-history-access-check.mjs fails a reader that parses the file itself.
export const HISTORY_SCHEMA_V2 = 'history.v2';
export const HISTORY_DICTIONARY_KEYS = Object.freeze(['source', 'sourceKind', 'allowedUse', 'rule', 'universe', 'marketSession']);
const ABSENT = '-'; // a dictionary key this row's meta does not carry

const same = (a, b) => a === b || JSON.stringify(a) === JSON.stringify(b);

function expandMeta(defaults, meta) {
  if (!meta || typeof meta !== 'object') return meta;
  const { checkedAt, [ABSENT]: absent = [], ...rest } = meta;
  const out = {};
  for (const key of HISTORY_DICTIONARY_KEYS) if (defaults && key in defaults && !absent.includes(key)) out[key] = defaults[key];
  Object.assign(out, rest);
  if (checkedAt !== undefined) {
    if (!('fetchedAt' in out)) out.fetchedAt = checkedAt;
    if (!('lastSuccessfulAt' in out)) out.lastSuccessfulAt = checkedAt;
  }
  return out;
}

/** history.json payload (v1 array or history.v2 object) → the v1 rows. Anything else is no rows. */
export function readHistoryRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || payload.schemaVersion !== HISTORY_SCHEMA_V2 || !Array.isArray(payload.rows)) return [];
  const dictionary = payload.fieldDictionary || {};
  return payload.rows.map((row) => {
    if (!row || typeof row !== 'object' || !row.fieldMeta) return row;
    const fieldMeta = {};
    for (const [field, meta] of Object.entries(row.fieldMeta)) fieldMeta[field] = expandMeta(dictionary[field], meta);
    return { ...row, fieldMeta };
  });
}

/** The v1 rows → the history.v2 payload; readHistoryRows(compactHistoryRows(rows)) equals rows. */
export function compactHistoryRows(rows = []) {
  const list = Array.isArray(rows) ? rows : [];
  // The field dictionary: per field and key, the value most rows carry.
  const counts = {};
  for (const row of list) for (const [field, meta] of Object.entries(row?.fieldMeta || {})) {
    if (!meta || typeof meta !== 'object') continue;
    for (const key of HISTORY_DICTIONARY_KEYS) {
      if (!(key in meta)) continue;
      const slot = ((counts[field] ||= {})[key] ||= new Map());
      const id = JSON.stringify(meta[key]);
      slot.set(id, (slot.get(id) || 0) + 1);
    }
  }
  const fieldDictionary = {};
  for (const field of Object.keys(counts).sort()) {
    const entry = {};
    for (const key of HISTORY_DICTIONARY_KEYS) {
      const slot = counts[field][key];
      if (!slot) continue;
      const [id] = [...slot.entries()].sort((a, b) => b[1] - a[1])[0];
      entry[key] = JSON.parse(id);
    }
    fieldDictionary[field] = entry;
  }
  const compactRows = list.map((row) => {
    if (!row || typeof row !== 'object' || !row.fieldMeta) return row;
    const fieldMeta = {};
    for (const [field, meta] of Object.entries(row.fieldMeta)) {
      if (!meta || typeof meta !== 'object') { fieldMeta[field] = meta; continue; }
      const defaults = fieldDictionary[field] || {};
      const out = {};
      const absent = [];
      for (const [key, value] of Object.entries(meta)) {
        if (HISTORY_DICTIONARY_KEYS.includes(key) && key in defaults && same(value, defaults[key])) continue;
        out[key] = value;
      }
      for (const key of Object.keys(defaults)) if (!(key in meta)) absent.push(key);
      if (absent.length) out[ABSENT] = absent;
      if ('fetchedAt' in out && 'lastSuccessfulAt' in out && out.fetchedAt === out.lastSuccessfulAt && !('checkedAt' in out)) {
        out.checkedAt = out.fetchedAt;
        delete out.fetchedAt;
        delete out.lastSuccessfulAt;
      }
      fieldMeta[field] = out;
    }
    return { ...row, fieldMeta };
  });
  return { schemaVersion: HISTORY_SCHEMA_V2, fieldDictionary, rows: compactRows };
}
