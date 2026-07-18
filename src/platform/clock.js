/** Small injectable clock used by every new runtime contract. */
export function createClock(now = () => Date.now()) {
  return Object.freeze({
    now,
    iso: () => new Date(now()).toISOString()
  });
}
