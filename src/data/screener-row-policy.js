// E2/S-C (P1241): single owner for screener row resolution.
//
// Two consumers used to carry their own fallback chain — the legacy quantitative helpers
// (`_aioGetCanonicalScreenerRows`) and the compatibility facade's evidence reader
// (`readScreener`). The shadow harness (ci-esm-core-unit-check) measured exactly one real
// divergence: with a published-but-empty native state the legacy chain still substituted the
// bundled `SCREENER_DB`, while the evidence reader returned the authoritative empty set. Owner
// decision: the native canonical state wins, and the bundled DB is only a pre-publication
// compatibility read that must be declared by the call site.

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
  // P1755: only the publication status is needed, so read that one field (the facade snapshots a dot path)
  // instead of deep-cloning the whole screener slice. A reader that ignores the path still returns the slice.
  const statusRead = typeof root?.AIO_ARCH?.getScreenerState === 'function' ? root.AIO_ARCH.getScreenerState('status') : null;
  const nativeState = statusRead && typeof statusRead === 'object' ? statusRead : { status: statusRead ?? null };
  // A published-but-empty canonical state is authoritative for both intents: a documented empty
  // break outranks substituting the bundled legacy DB.
  if (screenerNativePublished(nativeState)) return Array.isArray(nativeRows) ? nativeRows : [];
  if (intent === SCREENER_ROW_INTENT.BUNDLED_COMPAT && Array.isArray(root?.SCREENER_DB)) return root.SCREENER_DB;
  return Array.isArray(nativeRows) ? nativeRows : [];
}
