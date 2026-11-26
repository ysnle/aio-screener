// The 뉴스 filter panel's choices (one owner for the page's filter state): region and topic-group rows, the entity chip,
// the 수치 있음 and 내 종목 toggles, the search text and the sort. They last for the session; nothing goes into the
// address or storage. news.js paints the panel and repaints after each change; window.AIO.getNewsSurfaceControls
// (legacy-screen-bridges.js) lets the news selection entry points read the same state.
const DEFAULTS = Object.freeze({ countryFilter: 'all', topicFilter: 'all', sortMode: 'time', entityFilter: 'all', figureOnly: false, mineOnly: false, query: '' });
const state = { ...DEFAULTS };

export function getNewsSurfaceControls() {
  return {
    countryFilter: state.countryFilter || 'all',
    topicFilter: state.topicFilter || 'all',
    sortMode: state.sortMode || 'time',
    entityFilter: state.entityFilter || 'all',
    figureOnly: !!state.figureOnly,
    mineOnly: !!state.mineOnly,
    query: state.query || ''
  };
}

/** Sets some of the panel's choices; keys outside the state and values of another type are ignored. The caller repaints. */
export function setNewsFeedFilter(patch = {}) {
  for (const [key, value] of Object.entries(patch || {})) {
    if (Object.hasOwn(DEFAULTS, key) && typeof value === typeof DEFAULTS[key]) state[key] = value;
  }
  return getNewsSurfaceControls();
}

/** Every filter back to its default; the sort stays, since it orders the list rather than narrowing it. */
export function resetNewsFeedFilter() {
  const { sortMode } = state;
  Object.assign(state, DEFAULTS, { sortMode });
  return getNewsSurfaceControls();
}
