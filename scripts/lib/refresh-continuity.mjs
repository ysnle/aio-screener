// Shared collector contract: an attempt cannot renew a prior successful cycle.
export function isObservedNumber(value) {
  return value != null && value !== '' && typeof value !== 'boolean' && Number.isFinite(Number(value));
}

export function deriveFredCycle({ configured, expected, current = {}, previous = {}, previousMeta = {}, attemptedAt }) {
  const successful = expected.filter((field) => isObservedNumber(current[field]));
  const missing = expected.filter((field) => !successful.includes(field));
  const failed = [...new Set([...(current._failedSeries || []), ...missing])];
  const complete = !!configured && expected.length > 0 && !failed.length;
  const priorSuccess = previousMeta.fredLastSuccessfulAt || previous._lastKnownGoodAt || null;
  return {
    successful, failed, complete,
    status: !configured ? 'unconfigured' : complete ? 'complete' : successful.length ? 'partial' : 'unavailable',
    lastSuccessfulAt: complete ? (current._attemptedAt || attemptedAt) : priorSuccess,
    lkgUsed: !complete && missing.some((field) => isObservedNumber(previous[field]))
  };
}
