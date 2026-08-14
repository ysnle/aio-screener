function latestItemTime(items = []) {
  const times = items.map((item) => Date.parse(item?.eventTime || item?.pubDate || item?.publishedAt || '')).filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

export function createNewsProvider({ read = () => [], readMeta = () => ({}), now = () => Date.now() } = {}) {
  return Object.freeze({
    readCurrent() {
      const items = read();
      const meta = readMeta() || {};
      return Object.freeze({
        items: Array.isArray(items) ? items.slice() : [],
        updatedAt: meta.newsCycleEnd || latestItemTime(items) || null,
        fetchedAt: meta.generatedAt || null,
        cycleId: meta.cycleId || null,
        nextRefreshAt: meta.newsNextRefresh || null,
        checkedAt: new Date(now()).toISOString()
      });
    }
  });
}
