// Legacy unification (2026-10-26, roadmap item 11, screen 오늘 · 뉴스): the 뉴스 page's country/topic/telegram chips,
// the 최신순/중요도순 sort buttons and the state they set moved here from js/aio-data.js (filterNewsByCountry,
// filterNewsByTopic, filterNewsByTelegramOnly, setNewsSortMode, window.AIO.getNewsSurfaceControls and the
// currentCountryFilter/currentTopicFilter/_newsSortMode lets). Output is unchanged. The news cache and fetch stay in
// aio-data.js and are reached through window._aioNewsCacheSize / window.fetchAllNews, so this module imports nothing.

const state = { countryFilter: 'all', topicFilter: 'all', sortMode: 'time' };

export function getNewsSurfaceControls() {
  return {
    countryFilter: state.countryFilter || 'all',
    topicFilter: state.topicFilter || 'all',
    sortMode: state.sortMode || 'time'
  };
}

function hasNews(root) {
  return typeof root._aioNewsCacheSize === 'function' && root._aioNewsCacheSize() > 0;
}

function notify(root, reason) {
  if (typeof root._aioNotifyNewsSurfaceInvalidated === 'function') root._aioNotifyNewsSurfaceInvalidated(reason);
}

// v59.90: a pick sets aria-pressed, and the look is the #news-filter-row aria-pressed rule in responsive.css (news.js
// re-syncs the same attribute on every render). The chips used to get inline colours here, which forced !important
// on that rule and still let an inline accent tint replace the ink fill after a click.
function markChip(documentRef, group, el) {
  documentRef?.querySelectorAll?.(`#${group} .chip`).forEach((c) => c.setAttribute?.('aria-pressed', String(c === el)));
}

// v48.19: the telegram chip is the country filter 'tg', so every filter path renders through the same feed.
export function filterNewsByTelegramOnly(el, { documentRef = globalThis.document, root = globalThis } = {}) {
  state.countryFilter = 'tg';
  markChip(documentRef, 'news-country-chips', el);
  if (hasNews(root)) notify(root, 'news-country-telegram');
  else root.fetchAllNews?.();
}

export function filterNewsByCountry(filter, el, { documentRef = globalThis.document, root = globalThis } = {}) {
  state.countryFilter = filter;
  markChip(documentRef, 'news-country-chips', el);
  if (hasNews(root)) notify(root, 'news-country-filter');
  else root.fetchAllNews?.();
}

export function filterNewsByTopic(filter, el, { documentRef = globalThis.document, root = globalThis } = {}) {
  state.topicFilter = filter;
  markChip(documentRef, 'news-topic-chips', el);
  if (hasNews(root)) notify(root, 'news-topic-filter');
}

// v21: 'time' (최신순) or 'score' (중요도순).
export function setNewsSortMode(mode, el, { documentRef = globalThis.document, root = globalThis } = {}) {
  state.sortMode = mode;
  const timeBtn = documentRef?.getElementById?.('sort-time-btn');
  const scoreBtn = documentRef?.getElementById?.('sort-score-btn');
  if (timeBtn) timeBtn.classList.toggle('active', mode === 'time');
  if (scoreBtn) scoreBtn.classList.toggle('active', mode === 'score');
  if (hasNews(root)) notify(root, 'news-sort');
}
