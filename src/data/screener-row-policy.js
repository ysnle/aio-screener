export const SCREENER_ROW_INTENT = Object.freeze({
  // Evidence path. Never presents the bundled legacy DB as a screener result.
  EVIDENCE: 'evidence',
  // Pre-publication compatibility read for the legacy quantitative/AI query path. The bundled DB is
  // only reachable before the native screener state has ever been published.
  BUNDLED_COMPAT: 'bundled-compat'
});

// `createInitialScreenerState()` starts at `status: 'unavailable'`; the reducer moves it to
// `current` when rows are set. Only a non-`unavailable` status means the pipeline has published.
export function screenerNativePublished(state) {
  const status = state && typeof state === 'object' ? state.status : null;
  return Boolean(status && status !== 'unavailable');
}

export function resolveScreenerRows(root, intent = SCREENER_ROW_INTENT.EVIDENCE) {
  const nativeRows = typeof root?.AIO_ARCH?.getScreenerRows === 'function' ? root.AIO_ARCH.getScreenerRows() : null;
  if (Array.isArray(nativeRows) && nativeRows.length) return nativeRows;
  const statusRead = typeof root?.AIO_ARCH?.getScreenerState === 'function' ? root.AIO_ARCH.getScreenerState('status') : null;
  const nativeState = statusRead && typeof statusRead === 'object' ? statusRead : { status: statusRead ?? null };
  // A published-but-empty canonical state is authoritative for both intents: a documented empty
  // break outranks substituting the bundled legacy DB.
  if (screenerNativePublished(nativeState)) return Array.isArray(nativeRows) ? nativeRows : [];
  if (intent === SCREENER_ROW_INTENT.BUNDLED_COMPAT && Array.isArray(root?.SCREENER_DB)) return root.SCREENER_DB;
  return Array.isArray(nativeRows) ? nativeRows : [];
}
