export function selectNewsState(state) {
  return state?.news || null;
}

export function selectNewsItems(state) {
  const items = selectNewsState(state)?.items;
  return Array.isArray(items) ? items : [];
}

export function selectNewsStatus(state) {
  return selectNewsState(state)?.status || 'unavailable';
}
