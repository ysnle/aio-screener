// v59.70 (data audit R11): rotationHistory was 37% of data.json (223 KB), most of it the per-ETF 100-session
// relativeStrength line and the 20-point trail. The producer publishes the coordinates in data.json and those two
// series in public-data/rotation-detail.json; the browser loader (src/data/server-data-loader.js) merges them back
// into _serverDataMeta.rotationHistory, so every reader keeps one accessor and reads the same verdicts.
export const ROTATION_DETAIL_SCHEMA = 'rotation-detail.v1';
export const ROTATION_DETAIL_FILE = 'rotation-detail.json';
export const ROTATION_DETAIL_FIELDS = Object.freeze(['trail', 'relativeStrength']);

/** { summary, detail }: the artifact without the series (data.json) and the series keyed by symbol and session. */
export function splitRotationHistory(history) {
  if (!history || typeof history !== 'object' || !history.items || typeof history.items !== 'object') return { summary: history ?? null, detail: null };
  const summaryItems = {};
  const detailItems = {};
  for (const [symbol, row] of Object.entries(history.items)) {
    const kept = { ...row };
    const series = {};
    for (const field of ROTATION_DETAIL_FIELDS) {
      if (field in kept) { series[field] = kept[field]; delete kept[field]; }
    }
    summaryItems[symbol] = kept;
    detailItems[symbol] = { sessionDate: row?.sessionDate ?? null, ...series }; // every symbol, so a row without series is not 'missing'
  }
  return {
    summary: { ...history, detailFile: ROTATION_DETAIL_FILE, items: summaryItems },
    detail: { schemaVersion: ROTATION_DETAIL_SCHEMA, modelVersion: history.modelVersion ?? null, generatedAt: history.generatedAt ?? null,
      latestCompletedSession: history.latestCompletedSession ?? null, items: detailItems }
  };
}

/** The full artifact again. A symbol's series joins only when it was written for the same session as its point. */
export function mergeRotationDetail(summary, detail) {
  if (!summary || typeof summary !== 'object' || !summary.items) return summary ?? null;
  if (!detail || detail.schemaVersion !== ROTATION_DETAIL_SCHEMA || !detail.items || typeof detail.items !== 'object') return summary;
  const items = {};
  let missing = 0;
  for (const [symbol, row] of Object.entries(summary.items)) {
    const series = detail.items[symbol];
    if (!series || series.sessionDate !== (row?.sessionDate ?? null)) { items[symbol] = row; missing += 1; continue; }
    const merged = { ...row };
    for (const field of ROTATION_DETAIL_FIELDS) if (field in series) merged[field] = series[field];
    items[symbol] = merged;
  }
  // A copy from another refresh leaves rows without their series; the marker stays so the next copy can still join.
  const { detailFile, ...rest } = summary;
  return missing && detailFile ? { ...rest, detailFile, items } : { ...rest, items };
}

/** True when the artifact still waits for its series (data.json published without them). */
export const rotationDetailPending = (history) => !!history?.detailFile;
