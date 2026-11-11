// What the answer filters removed, per finished chat answer, kept on this device so the operator can see how often the
// evidence filters cut sentences. An entry holds counts and settings only, never question or answer text: an entry
// carrying any other field is refused. At most ANSWER_QUALITY_LIMIT entries are kept, newest last. Storage failures
// return false (record) or an empty summary (summarise).
export const ANSWER_QUALITY_KEY = 'aio_ai_answer_quality_v1';
export const ANSWER_QUALITY_LIMIT = 300;
const DAY_MS = 86400000;
const COUNT_FIELDS = ['outputTokens', 'removedNumericSentences', 'removedEventSentences', 'droppedClaims', 'directiveReplacements', 'sentencesTotal'];
const FIELDS = new Set(['at', 'mode', 'effort', 'searched', 'truncated'].concat(COUNT_FIELDS));
const LABEL = /^[A-Za-z0-9_.-]{1,32}$/;

const count = (value) => (Number.isInteger(value) && value >= 0 ? value : null);
const label = (value) => (typeof value === 'string' && LABEL.test(value) ? value : null);

function normaliseEntry(entry, nowMs) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  if (Object.keys(entry).some((key) => !FIELDS.has(key))) return null;
  const at = Date.parse(entry.at || '');
  const row = {
    at: new Date(Number.isFinite(at) ? at : nowMs).toISOString(),
    mode: label(entry.mode),
    effort: label(entry.effort),
    searched: entry.searched === true,
    truncated: entry.truncated === true
  };
  COUNT_FIELDS.forEach((key) => { row[key] = count(entry[key]); });
  return row;
}

function readEntries(storage) {
  try {
    const parsed = JSON.parse(storage.getItem(ANSWER_QUALITY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.map((row) => normaliseEntry(row, Date.now())).filter(Boolean) : [];
  } catch (_) { return []; }
}

export function recordAnswerQuality(storage, entry, nowMs = Date.now()) {
  const row = normaliseEntry(entry, nowMs);
  if (!row || !storage) return false;
  try {
    const rows = readEntries(storage).concat([row]);
    storage.setItem(ANSWER_QUALITY_KEY, JSON.stringify(rows.slice(Math.max(0, rows.length - ANSWER_QUALITY_LIMIT))));
    return true;
  } catch (_) { return false; }
}

const sum = (rows, key) => rows.reduce((total, row) => total + (row[key] == null ? 0 : row[key]), 0);

export function summariseAnswerQuality(storage, { days = 14, now = Date.now() } = {}) {
  const since = now - days * DAY_MS;
  const rows = storage ? readEntries(storage).filter((row) => Date.parse(row.at) >= since) : [];
  const removedSentences = sum(rows, 'removedNumericSentences') + sum(rows, 'removedEventSentences');
  const truncatedAnswers = rows.filter((row) => row.truncated).length;
  const removedPerAnswer = rows.length ? Number((removedSentences / rows.length).toFixed(1)) : null;
  const line = rows.length
    ? `최근 ${days}일 답변 ${rows.length}건 · 삭제된 문장 ${removedSentences}개(답변당 ${removedPerAnswer}) · 잘린 답변 ${truncatedAnswers}건`
    : `최근 ${days}일 답변 기록 없음`;
  return {
    days,
    answers: rows.length,
    removedSentences,
    removedNumericSentences: sum(rows, 'removedNumericSentences'),
    removedEventSentences: sum(rows, 'removedEventSentences'),
    removedPerAnswer,
    truncatedAnswers,
    searchedAnswers: rows.filter((row) => row.searched).length,
    droppedClaims: sum(rows, 'droppedClaims'),
    directiveReplacements: sum(rows, 'directiveReplacements'),
    line
  };
}
