// The question that is waiting for its answer, kept for this tab only (the tab's own store, handed in by the app layer) so a
// reload or a closed page during the wait does not lose it. It is the reader's own unsent work in this tab, kept at most
// 15 minutes, so it needs no saving consent; it is cleared when the turn finishes, fails for good or is stopped.

export const PENDING_TURN_KEY = 'aio_chat_pending_v1';
export const PENDING_TURN_MAX_AGE_MS = 15 * 60 * 1000;
export const PENDING_PREVIEW_CHARS = 80;

const safe = (fn, fallback) => { try { return fn(); } catch (_) { return fallback; } };

/** Stores { sessionId, ctx, question, startedAt }; false when the store refuses or there is no question. */
export function savePendingTurn(storage, { sessionId = null, ctx = '', question = '', startedAt } = {}) {
  const text = String(question || '').trim();
  if (!storage || !text || !Number.isFinite(startedAt)) return false;
  return safe(() => { storage.setItem(PENDING_TURN_KEY, JSON.stringify({ sessionId: sessionId ? String(sessionId) : null, ctx: String(ctx || ''), question: text, startedAt })); return true; }, false);
}

/** The stored turn when it is younger than 15 minutes at `now`; an expired or unreadable one is removed and reads null. */
export function readPendingTurn(storage, { now = Date.now() } = {}) {
  const turn = safe(() => JSON.parse(storage.getItem(PENDING_TURN_KEY) || 'null'), null);
  if (!turn) return null;
  const age = now - Number(turn.startedAt);
  if (typeof turn.question !== 'string' || !turn.question.trim() || !Number.isFinite(age) || age < 0 || age >= PENDING_TURN_MAX_AGE_MS) {
    clearPendingTurn(storage);
    return null;
  }
  return { sessionId: turn.sessionId || null, ctx: String(turn.ctx || ''), question: turn.question, startedAt: Number(turn.startedAt) };
}

export function clearPendingTurn(storage) {
  safe(() => storage.removeItem(PENDING_TURN_KEY));
}

/** The question as the reload card quotes it: one line, at most 80 characters. */
export function pendingQuestionPreview(question) {
  const line = String(question || '').replace(/\s+/g, ' ').trim();
  return line.length > PENDING_PREVIEW_CHARS ? `${line.slice(0, PENDING_PREVIEW_CHARS - 1).trimEnd()}…` : line;
}
