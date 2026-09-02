const STORAGE_KEY = 'aio-knowledge-learning-v1';

function emptyState() {
  return {
    schemaVersion: 'knowledge-learning-state.v1',
    progress: {},
    bookmarks: [],
    notes: {},
    updatedAt: null
  };
}

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function articleId(value) {
  const id = typeof value === 'string' ? value.trim() : '';
  return id && !['__proto__', 'prototype', 'constructor'].includes(id) ? id : null;
}

function copyEntries(value) {
  return Object.fromEntries(Object.entries(record(value)).map(([id, entry]) => [id, { ...record(entry) }]));
}

function freezeEntries(value) {
  return Object.freeze(Object.fromEntries(Object.entries(value).map(([id, entry]) => [id, Object.freeze({ ...record(entry) })])));
}

function safeRead(storage, key) {
  if (!storage || typeof storage.getItem !== 'function') return emptyState();
  try {
    const parsed = JSON.parse(storage.getItem(key) || 'null');
    if (!parsed || parsed.schemaVersion !== 'knowledge-learning-state.v1') return emptyState();
    return {
      schemaVersion: 'knowledge-learning-state.v1',
      progress: copyEntries(parsed.progress),
      bookmarks: [...new Set((Array.isArray(parsed.bookmarks) ? parsed.bookmarks : []).map(articleId).filter(Boolean))],
      notes: copyEntries(parsed.notes),
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : null
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
    progress: freezeEntries(state.progress),
    bookmarks: Object.freeze([...state.bookmarks]),
    notes: freezeEntries(state.notes),
    retrieval: Object.freeze({})
  });
  return Object.freeze({
    snapshot,
    markViewed(inputId) {
      const id = articleId(inputId);
      if (!id) return snapshot();
      state.progress[id] = { ...(state.progress[id] || {}), viewed: true, viewedAt: now() };
      return persist();
    },
    setProgress(inputId, progress) {
      const id = articleId(inputId);
      if (!id || progress == null || typeof progress !== 'object' || Array.isArray(progress)) return snapshot();
      state.progress[id] = { ...(state.progress[id] || {}), ...progress, updatedAt: now() };
      return persist();
    },
    toggleBookmark(inputId) {
      const id = articleId(inputId);
      if (!id) return snapshot();
      state.bookmarks = state.bookmarks.includes(id) ? state.bookmarks.filter((entry) => entry !== id) : [...state.bookmarks, id];
      return persist();
    },
    setNote(inputId, note) {
      const id = articleId(inputId);
      if (!id) return snapshot();
      const value = String(note ?? '').trim();
      if (value) state.notes[id] = { value, updatedAt: now() };
      else delete state.notes[id];
      return persist();
    },
  });
}

export { STORAGE_KEY };
