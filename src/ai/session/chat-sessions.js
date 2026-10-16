// Owner 2026-10-14: the AI panel keeps conversations like an LLM site — a list of past conversations to reopen and
// continue — stored only on this device, and only after the reader agrees on their first conversation.
// One conversation follows the reader across screens (the panel is one assistant, not one chat per page); the screen a
// question was asked on travels with each turn. The full transcript is kept here; the model context is the recent part
// of it (the panel trims long contexts), and the redacted summary history (aio_chat_history) keeps feeding the
// "earlier questions" memory block.
export const SESSIONS_KEY = 'aio_chat_sessions_v1';
export const ACTIVE_KEY = 'aio_chat_active_session';
export const CONSENT_KEY = 'aio_chat_history_enabled'; // '1' save · '0' declined · missing = not asked yet
export const LIMITS = Object.freeze({ sessions: 40, turnsPerSession: 80, charsPerMessage: 8000, totalChars: 500000 }); // ~1 MB in UTF-16: leaves room for the rest of the app's local storage

const now = () => Date.now();
const safe = (fn, fallback) => { try { return fn(); } catch (_) { return fallback; } };

export function consentState(storage) {
  const value = safe(() => storage.getItem(CONSENT_KEY), null);
  return value === '1' ? 'granted' : value === '0' ? 'declined' : 'unasked';
}
export function setConsent(storage, granted) {
  safe(() => storage.setItem(CONSENT_KEY, granted ? '1' : '0'));
  if (!granted) { safe(() => storage.removeItem(SESSIONS_KEY)); safe(() => storage.removeItem(ACTIVE_KEY)); safe(() => storage.removeItem('aio_chat_history')); }
}

export function loadSessions(storage) {
  const raw = safe(() => JSON.parse(storage.getItem(SESSIONS_KEY) || '[]'), []);
  return (Array.isArray(raw) ? raw : []).filter((s) => s && typeof s.id === 'string' && Array.isArray(s.turns));
}

function titleOf(question) {
  const text = String(question || '').replace(/\s+/g, ' ').trim();
  return text.length > 40 ? `${text.slice(0, 39)}…` : text || '새 대화';
}

const turnChars = (t) => t.q.length + t.a.length;

/** Keep the newest sessions within count and size limits. A conversation that does not fit whole keeps its newest
 *  turns (the reader's latest question must never be the part that is dropped — codex audit F03, 2026-10-15). */
export function pruneSessions(sessions) {
  const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, LIMITS.sessions);
  let left = LIMITS.totalChars;
  const out = [];
  for (const session of sorted) {
    if (left <= 0) break;
    const size = session.turns.reduce((sum, t) => sum + turnChars(t), 0);
    if (size <= left) { out.push(session); left -= size; continue; }
    const turns = [];
    for (const turn of [...session.turns].reverse()) { if (turnChars(turn) > left) break; turns.unshift(turn); left -= turnChars(turn); }
    if (turns.length) out.push({ ...session, turns });
    break; // anything older than a conversation that had to be cut does not fit either
  }
  return out;
}

/** Write the conversations; an empty list removes the key (deleting the last conversation must leave nothing behind —
 *  codex audit F02). Returns false when nothing could be written, so the caller can tell the reader. */
export function saveSessions(storage, sessions) {
  if (consentState(storage) !== 'granted') return false;
  let kept = pruneSessions(sessions);
  if (!kept.length) return safe(() => { storage.removeItem(SESSIONS_KEY); return true; }, false);
  // A full store keeps the newest conversations: drop the oldest half and retry; the last one left halves its oldest turns.
  while (kept.length) {
    if (safe(() => { storage.setItem(SESSIONS_KEY, JSON.stringify(kept)); return true; }, false)) return true;
    if (kept.length > 1) kept = kept.slice(0, Math.floor(kept.length / 2));
    else if (kept[0].turns.length > 1) kept = [{ ...kept[0], turns: kept[0].turns.slice(Math.ceil(kept[0].turns.length / 2)) }];
    else break;
  }
  return false;
}

export function newSessionId() { return `s${now().toString(36)}${Math.random().toString(36).slice(2, 7)}`; }

/** Append one completed turn to the active conversation (creating it on the first turn). Returns the session;
 *  session.saved is false when the browser store refused the write. */
export function appendTurn(storage, { sessionId, ctx, question, answer, at = now() }) {
  const sessions = loadSessions(storage);
  let session = sessions.find((s) => s.id === sessionId);
  if (!session) { session = { id: sessionId || newSessionId(), title: titleOf(question), createdAt: at, updatedAt: at, turns: [] }; sessions.push(session); }
  session.turns.push({ ctx: String(ctx || ''), q: String(question || '').slice(0, LIMITS.charsPerMessage), a: String(answer || '').slice(0, LIMITS.charsPerMessage), at });
  if (session.turns.length > LIMITS.turnsPerSession) session.turns = session.turns.slice(-LIMITS.turnsPerSession);
  session.updatedAt = at;
  const saved = saveSessions(storage, sessions);
  return Object.assign(session, { saved });
}

export function deleteSession(storage, id) { return saveSessions(storage, loadSessions(storage).filter((s) => s.id !== id)); }

/** The model context for a reopened conversation: the most recent turns within the panel's budget. */
export function sessionMessages(session, { maxChars = 40000 } = {}) {
  const out = [];
  let total = 0;
  for (const turn of [...(session?.turns || [])].reverse()) {
    const size = turn.q.length + turn.a.length;
    if (out.length && total + size > maxChars) break;
    out.unshift({ role: 'user', content: turn.q }, { role: 'assistant', content: turn.a });
    total += size;
  }
  return out;
}

/** "오늘 14:05", "어제", "10/12" — how a list row is dated. */
export function sessionWhen(at, nowMs = now()) {
  const d = new Date(at), n = new Date(nowMs);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, n)) return `오늘 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (sameDay(d, new Date(nowMs - 86400000))) return '어제';
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
