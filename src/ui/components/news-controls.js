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

// A pick sets aria-pressed only; the look is the #news-filter-row aria-pressed rule in responsive.css, and news.js
// re-syncs the same attribute on every render. No inline colours, so that rule needs no !important.
function markChip(documentRef, group, el) {
  documentRef?.querySelectorAll?.(`#${group} .chip`).forEach((c) => c.setAttribute?.('aria-pressed', String(c === el)));
}

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
