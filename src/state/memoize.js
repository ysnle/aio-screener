/**
 * Memoizes a derived value by reference equality of its inputs (RM-02). If none
 * of the values `inputSelectors` extract from the arguments changed reference
 * since the previous call, the previous `compute` result is returned without
 * re-invoking it. Safe because every reducer in src/state/slices/*.js is
 * spread-based: an unchanged slice keeps the same object reference.
 */
export function createSelector(inputSelectors, compute) {
  let lastInputs = null;
  let lastResult;
  let hasResult = false;
  return function memoizedSelector(...args) {
    const inputs = inputSelectors.map((selectInput) => selectInput(...args));
    if (hasResult && lastInputs && inputs.every((value, index) => value === lastInputs[index])) {
      return lastResult;
    }
    lastInputs = inputs;
    lastResult = compute(...inputs);
    hasResult = true;
    return lastResult;
  };
}

/**
 * Subscribes `listener` to `store`, but only invokes it when `selectSlice(state)`
 * returns a different reference than last time — not on every dispatch to
 * unrelated slices. Calls `listener` once immediately with the current slice.
 */
export function subscribeToSlice(store, selectSlice, listener) {
  let lastSlice = selectSlice(store.getState());
  listener(lastSlice);
  return store.subscribe((state) => {
    const nextSlice = selectSlice(state);
    if (nextSlice === lastSlice) return;
    lastSlice = nextSlice;
    listener(nextSlice);
  });
}
