export function selectScreenerState(state) {
  return state?.screener || null;
}

export function selectScreenerRows(state) {
  return selectScreenerState(state)?.rows || [];
}

export function selectScreenerRevision(state) {
  return selectScreenerState(state)?.revision || null;
}
