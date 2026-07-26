export function selectThemesState(state) {
  return state?.themes || null;
}

export function selectThemesItems(state) {
  const items = selectThemesState(state)?.items;
  return Array.isArray(items) ? items : [];
}

export function selectSelectedThemeId(state) {
  return selectThemesState(state)?.selectedId || null;
}

export function selectSelectedThemeDetail(state) {
  return selectThemesState(state)?.selectedDetail || null;
}
