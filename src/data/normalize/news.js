function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function text(value) {
  return value == null ? '' : String(value);
}

export function normalizeNews(raw = {}) {
  const items = Array.isArray(raw.items) ? raw.items.map((item, index) => ({
    ...item,
    newsId: text(item?.newsId || item?.id || item?.guid || `news-${index}`),
    title: text(item?.title || item?.headline),
    headline: text(item?.headline || item?.title),
    desc: text(item?.desc || item?.summary || item?.description),
    summary: text(item?.summary || item?.desc || item?.description),
    source: text(item?.source || item?.feed || 'unknown'),
    link: text(item?.link || item?.url),
    pubDate: item?.pubDate || item?.date || null,
    country: text(item?.country || 'all'),
    topic: text(item?.topic || 'general'),
    score: finite(item?.score),
    tier: finite(item?.tier),
    _tgChannel: item?._tgChannel === true
  })) : [];
  return Object.freeze({
    items: Object.freeze(items),
    updatedAt: raw.updatedAt || null,
    fetchedAt: raw.fetchedAt || null,
    cycleId: raw.cycleId || null,
    nextRefreshAt: raw.nextRefreshAt || null,
    checkedAt: raw.checkedAt || null
  });
}
