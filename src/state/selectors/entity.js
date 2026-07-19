export function selectEntityState(state) {
  return state?.entity || null;
}

export function selectEntityId(state) {
  return selectEntityState(state)?.id || null;
}

export function selectEntityQuote(state) {
  return selectEntityState(state)?.quote || null;
}

export function selectEntityFundamentals(state) {
  return selectEntityState(state)?.fundamentals || null;
}

export function selectEntityOptions(state) {
  return selectEntityState(state)?.options || null;
}
