// v58.80 (first-users F01): index.html starts data.json and history.json in <head>, before any stylesheet or script,
// as window.__aioBootPrefetch[key] = { url, minute, at, res }. On a slow phone data.json used to start only after the
// legacy scripts had downloaded and run (~60 s at 50 KB/s). A loader takes its entry once; a later read (a refresh, a
// retry) fetches as before. An entry older than maxAgeMs is not used, so a long-open tab never reads a stale answer.
export function takeBootPrefetch(root, key, { now = Date.now(), maxAgeMs = 5 * 60 * 1000 } = {}) {
  const entry = root?.__aioBootPrefetch?.[key];
  if (!entry || entry.taken || !entry.res || typeof entry.res.then !== 'function') return null;
  entry.taken = true;
  if (!(now - Number(entry.at) <= maxAgeMs)) return null;
  return { response: entry.res, minute: Number.isFinite(entry.minute) ? entry.minute : null };
}
