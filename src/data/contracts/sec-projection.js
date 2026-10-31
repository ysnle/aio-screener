// v59.47: the SEC runtime projection's record-defaults encoding — one definition for the producer
// (scripts/build-sec-runtime-projection.mjs) and every reader. The projection hit its 1 MiB page bound three times
// (P1470, P1632, 2026-10-21) and each time one more field was dropped by hand; on 2026-10-30 natural growth reached
// 1,052,459 B again and stopped the screener/SEC lane for a day. A field that every record carries, with one value in at
// least half of them, is stated once in `recordDefaults` and left out of the records that hold that value; a record with
// another value keeps its own. Expansion is `{ ...recordDefaults, ...record }`, so the encoding is lossless and a file
// without `recordDefaults` (the format before v59.47) expands to itself. Dates stay on every record so a row reads alone.
export const SEC_RECORD_DEFAULTS_POLICY = 'sec-record-defaults.v1';
const KEEP_PER_RECORD = new Set(['fiscalPeriodEnd', 'observedAt', 'filedAt', 'acceptedAt', 'availableAt', 'fetchedAt', 'sharesObservedAt']);

export function compactSecRecords(data = {}, { minShare = 0.5 } = {}) {
  const records = Object.values(data).filter((record) => record && typeof record === 'object');
  if (!records.length) return { recordDefaults: {}, data };
  const recordDefaults = {};
  const fields = new Set(records.flatMap((record) => Object.keys(record)));
  for (const field of fields) {
    if (KEEP_PER_RECORD.has(field) || !records.every((record) => Object.hasOwn(record, field))) continue;
    const counts = new Map();
    for (const record of records) {
      const key = JSON.stringify(record[field]);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    const [key, count] = [...counts].sort((a, b) => b[1] - a[1])[0];
    if (count / records.length >= minShare) recordDefaults[field] = JSON.parse(key);
  }
  const defaultKeys = Object.fromEntries(Object.entries(recordDefaults).map(([field, value]) => [field, JSON.stringify(value)]));
  const compact = Object.fromEntries(Object.entries(data).map(([symbol, record]) => {
    if (!record || typeof record !== 'object') return [symbol, record];
    return [symbol, Object.fromEntries(Object.entries(record).filter(([field, value]) => !(field in defaultKeys) || JSON.stringify(value) !== defaultKeys[field]))];
  }));
  return { recordDefaults, data: compact };
}

export function expandSecRecords(artifact = {}) {
  const data = artifact?.data && typeof artifact.data === 'object' ? artifact.data : {};
  const defaults = artifact?.recordDefaults && typeof artifact.recordDefaults === 'object' ? artifact.recordDefaults : null;
  if (!defaults || !Object.keys(defaults).length) return data;
  const copy = (value) => (value && typeof value === 'object' ? JSON.parse(JSON.stringify(value)) : value);
  return Object.fromEntries(Object.entries(data).map(([symbol, record]) => [symbol, record && typeof record === 'object'
    ? { ...Object.fromEntries(Object.entries(defaults).map(([field, value]) => [field, copy(value)])), ...record }
    : record]));
}
