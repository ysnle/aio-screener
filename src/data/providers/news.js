function latestItemTime(items = []) {
  const times = (Array.isArray(items) ? items : []).map((item) => Date.parse(item?.eventTime || item?.pubDate || item?.publishedAt || '')).filter(Number.isFinite);
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
        checkedAt: (() => { const date = new Date(now()); return Number.isNaN(date.getTime()) ? null : date.toISOString(); })()
      });
    }
  });
}
