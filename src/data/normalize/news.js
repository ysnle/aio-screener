function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

const NAMED_TEXT_ENTITIES = Object.freeze({
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: '\u00a0'
});

const TEXT_ENTITY_PATTERN = /&(?:#([0-9]+)|#[xX]([0-9a-fA-F]+)|([a-zA-Z]+));/g;

function decodeTextEntity(match, decimal, hexadecimal, name) {
  if (decimal != null || hexadecimal != null) {
    const codePoint = Number.parseInt(decimal ?? hexadecimal, decimal != null ? 10 : 16);
    if (!Number.isInteger(codePoint) || codePoint <= 0 || codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return match;
    return String.fromCodePoint(codePoint);
  }
  return Object.hasOwn(NAMED_TEXT_ENTITIES, name) ? NAMED_TEXT_ENTITIES[name] : match;
}

export function decodeNewsText(value) {
  if (value == null) return '';
  return String(value).replace(TEXT_ENTITY_PATTERN, decodeTextEntity);
}

export function normalizeNews(raw = {}) {
  const items = Array.isArray(raw.items) ? raw.items.map((item, index) => Object.freeze({
    ...item,
    newsId: item?.newsId || item?.id || item?.guid || `news-${index}`,
    title: decodeNewsText(item?.title || item?.headline),
    headline: decodeNewsText(item?.headline || item?.title),
    desc: decodeNewsText(item?.desc || item?.summary || item?.description),
    summary: decodeNewsText(item?.summary || item?.desc || item?.description),
    source: item?.source || item?.feed || 'unknown',
    link: item?.link == null && item?.url == null ? '' : String(item?.link || item?.url),
    pubDate: item?.pubDate || item?.date || null,
    country: item?.country || 'all',
    // LC-31: the producer copies the feed QUERY's topic onto every article, so a rail-services story
    // could be labelled 반도체/AI(semi). Keep the feed topic as its own field; an article topic is only
    // trusted when the producer declares a per-article basis, otherwise it stays flagged for review.
    topic: item?.articleTopic || item?.topic || 'general',
    feedTopic: item?.feedTopic || item?.feedQuery || item?.topic || null,
    topicSource: item?.articleTopic ? 'article' : 'feed-query',
    topicReviewRequired: !item?.articleTopic,
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
