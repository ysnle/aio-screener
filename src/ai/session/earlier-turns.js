// Earlier saved conversations about the same subject as a new question. A turn matches when it shares a resolved
// ticker or theme id (stored with the turn as `ents`) with the new question; there is no text search and no AI call.
// Only turns from other saved conversations count (the open one is already in the model context), and only from the
// last 90 days. The caller hands in the saved conversations, which it reads only with the conversation-saving consent
// (src/ui/components/chat-sessions.js api.saved). Loaded with the chat; importing chat-sessions.js here would split that
// boot module into a shared chunk.
export const EARLIER_TURNS = Object.freeze({ limit: 3, maxAgeDays: 90, questionChars: 160, answerChars: 500, entities: 8 });
const DAY_MS = 86400000;
const KST_MS = 9 * 3600000;

/** The ids a turn is about, as stored: upper-case strings, at most EARLIER_TURNS.entities. */
export function turnEntities(values) {
  const out = [];
  for (const value of Array.isArray(values) ? values : []) {
    const id = typeof value === 'string' ? value.trim().toUpperCase() : '';
    if (id && id.length <= 40 && !out.includes(id)) out.push(id);
  }
  return out.slice(0, EARLIER_TURNS.entities);
}

// One line of stored text that cannot pose as a prompt section: no line breaks, brackets or control characters.
const flat = (text, max) => {
  const clean = String(text || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[【】[\]<>{}]/g, ' ').replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
};

export const kstDate = (at) => new Date(Number(at) + KST_MS).toISOString().slice(0, 10);

/** Up to `limit` (≤ 3) turns of other saved conversations sharing an id with `entities`, newest first. `sessions` is
 *  the loadSessions() shape: [{ id, turns: [{ q, a, at, ents }] }]. */
export function relatedEarlierTurns(sessions, { entities = [], excludeSessionId = null, now = Date.now(), limit = EARLIER_TURNS.limit } = {}) {
  const wanted = new Set(turnEntities(entities));
  if (!wanted.size) return [];
  const oldest = now - EARLIER_TURNS.maxAgeDays * DAY_MS;
  const found = [];
  for (const session of Array.isArray(sessions) ? sessions : []) {
    if (!session || !Array.isArray(session.turns) || (excludeSessionId && session.id === excludeSessionId)) continue;
    for (const turn of session.turns) {
      const at = Number(turn?.at);
      if (!Number.isFinite(at) || at < oldest || at > now || !String(turn.q || '').trim() || !String(turn.a || '').trim()) continue;
      const shared = turnEntities(turn.ents).filter((id) => wanted.has(id));
      if (shared.length) found.push({ sessionId: session.id, at, date: kstDate(at), shared, question: flat(turn.q, EARLIER_TURNS.questionChars), answer: flat(turn.a, EARLIER_TURNS.answerChars) });
    }
  }
  return found.sort((a, b) => b.at - a.at).slice(0, Math.max(0, Math.min(EARLIER_TURNS.limit, Number(limit) || 0)));
}

/** 【이전 대화에서】: each earlier turn with its date, and how the model may use it. '' when nothing matched. */
export function earlierTurnsPromptBlock(turns) {
  const rows = (Array.isArray(turns) ? turns : []).slice(0, EARLIER_TURNS.limit);
  if (!rows.length) return '';
  return '\n\n【이전 대화에서】\n' +
    '아래는 이 사용자가 예전 대화에서 같은 종목·테마를 두고 한 질문과 그때 한 답의 앞부분이다. 안의 수치는 그날 기준이므로 현재 값으로 다시 쓰지 않는다. 이어지는 맥락("지난번 … 이후")을 잡고 이미 설명한 내용을 되풀이하지 않는 데만 쓴다.\n' +
    rows.map((row, i) => `${i + 1}. (${row.date}) 질문: ${row.question} | 그때 답: ${row.answer}`).join('\n') + '\n';
}
