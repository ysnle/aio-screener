export function takeBootPrefetch(root, key, { now = Date.now(), maxAgeMs = 5 * 60 * 1000 } = {}) {
  const entry = root?.__aioBootPrefetch?.[key];
  if (!entry || entry.taken || !entry.res || typeof entry.res.then !== 'function') return null;
  entry.taken = true;
  if (!(now - Number(entry.at) <= maxAgeMs)) return null;
  return { response: entry.res, minute: Number.isFinite(entry.minute) ? entry.minute : null };
}
