export function selectThemesState(state) {
  return state?.themes || null;
}

export function selectThemesItems(state) {
  const items = selectThemesState(state)?.items;
  return Array.isArray(items) ? items : [];
}

export function selectSelectedThemeDetail(state) {
  return selectThemesState(state)?.selectedDetail || null;
}
