const STORAGE_KEY = 'aio-knowledge-learning-v1';

function emptyState() {
  return {
    schemaVersion: 'knowledge-learning-state.v1',
    progress: {},
    bookmarks: [],
    notes: {},
    retrieval: {},
    updatedAt: null
  };
}

function safeRead(storage, key) {
  if (!storage || typeof storage.getItem !== 'function') return emptyState();
  try {
    const parsed = JSON.parse(storage.getItem(key) || 'null');
    if (!parsed || parsed.schemaVersion !== 'knowledge-learning-state.v1') return emptyState();
    return {
      ...emptyState(),
      ...parsed,
      progress: { ...(parsed.progress || {}) },
      bookmarks: [...new Set(parsed.bookmarks || [])],
      notes: { ...(parsed.notes || {}) },
      retrieval: { ...(parsed.retrieval || {}) }
    };
  } catch {
    return emptyState();
  }
}

export function createLearningState({ storage = null, key = STORAGE_KEY, now = () => new Date().toISOString() } = {}) {
  let state = safeRead(storage, key);
  const persist = () => {
    state = { ...state, updatedAt: now() };
    if (typeof storage?.setItem === 'function') {
      try { storage.setItem(key, JSON.stringify(state)); } catch { /* private browsing/quota is non-fatal */ }
    }
    return snapshot();
  };
  const snapshot = () => Object.freeze({
    ...state,
    progress: Object.freeze({ ...state.progress }),
    bookmarks: Object.freeze([...state.bookmarks]),
    notes: Object.freeze({ ...state.notes }),
    retrieval: Object.freeze({ ...state.retrieval })
  });
  return Object.freeze({
    snapshot,
    markViewed(articleId) {
      if (!articleId) return snapshot();
      state.progress[articleId] = { ...(state.progress[articleId] || {}), viewed: true, viewedAt: now() };
      return persist();
    },
    setProgress(articleId, progress) {
      if (!articleId) return snapshot();
      state.progress[articleId] = { ...(state.progress[articleId] || {}), ...progress, updatedAt: now() };
      return persist();
    },
    toggleBookmark(articleId) {
      if (!articleId) return snapshot();
      state.bookmarks = state.bookmarks.includes(articleId) ? state.bookmarks.filter((id) => id !== articleId) : [...state.bookmarks, articleId];
      return persist();
    },
    setNote(articleId, note) {
      if (!articleId) return snapshot();
      const value = String(note || '').trim();
      if (value) state.notes[articleId] = { value, updatedAt: now() };
      else delete state.notes[articleId];
      return persist();
    },
    recordRetrieval(articleId, result) {
      if (!articleId) return snapshot();
      state.retrieval[articleId] = { ...(state.retrieval[articleId] || {}), ...result, attemptedAt: now() };
      return persist();
    }
  });
}

export { STORAGE_KEY };
