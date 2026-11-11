// What the reader told the assistant about themselves (what they hold or watch, their horizon or goal, how they want
// things explained), as short notes the answer plan proposes in its optional `remember` field. Stored only on this
// device, only with the conversation-saving consent (the caller passes it; declining it removes NOTES_KEY in
// chat-sessions.js setConsent), listed in the 답변 맞춤 sheet where each can be deleted.
import { kstDate } from './earlier-turns.js';

export const NOTES_KEY = 'aio_reader_notes_v1';
export const NOTES_LIMITS = Object.freeze({ kept: 20, perAnswer: 2, chars: 60, promptChars: 600 });

const MONEY = /\d[\d,.]*\s*(?:원|달러|(?<![A-Za-z])USD(?![A-Za-z])|(?<![A-Za-z])KRW(?![A-Za-z])|만|억)/i;
const LONG_NUMBER = /\d[\d-]{5,}\d/; // an account, card or phone number
const safe = (fn, fallback) => { try { return fn(); } catch (_) { return fallback; } };
const keyOf = (text) => String(text).toLowerCase().replace(/[\s.,·!?~'"()-]/g, '');

/** One proposed note as stored, or null: strings only, one line, at most 60 characters, no amount of money and no
 *  long number. A note over the cap is dropped, not cut. */
export function cleanNote(value) {
  if (typeof value !== 'string') return null;
  const text = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/[【】[\]<>{}`\\]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text || text.length > NOTES_LIMITS.chars || MONEY.test(text) || LONG_NUMBER.test(text)) return null;
  return text;
}

/** The `remember` field of an answer plan: at most two clean notes; anything else reads as none. */
export function rememberField(value) {
  if (!Array.isArray(value)) return Object.freeze([]);
  const out = [];
  for (const item of value) {
    const note = cleanNote(item);
    if (note && !out.some((kept) => keyOf(kept) === keyOf(note))) out.push(note);
  }
  return Object.freeze(out.slice(0, NOTES_LIMITS.perAnswer));
}

/** The stored notes, newest first, each { text, at }. */
export function loadNotes(storage) {
  const raw = safe(() => JSON.parse(storage.getItem(NOTES_KEY) || '[]'), []);
  return (Array.isArray(raw) ? raw : [])
    .map((row) => ({ text: cleanNote(row?.text), at: Number(row?.at) }))
    .filter((row) => row.text && Number.isFinite(row.at))
    .sort((a, b) => b.at - a.at)
    .slice(0, NOTES_LIMITS.kept);
}

function writeNotes(storage, notes) {
  if (!notes.length) return safe(() => { storage.removeItem(NOTES_KEY); return true; }, false);
  return safe(() => { storage.setItem(NOTES_KEY, JSON.stringify(notes.slice(0, NOTES_LIMITS.kept))); return true; }, false);
}

/** Add an answer's notes. Returns the notes that were new (a repeat only refreshes its date), or false without the
 *  consent or when the store refused the write. */
export function addNotes(storage, notes, { consented = false, now = Date.now() } = {}) {
  if (!consented) return false;
  const incoming = rememberField(notes);
  if (!incoming.length) return [];
  const kept = loadNotes(storage);
  const added = [];
  for (const text of incoming) {
    const at = kept.findIndex((row) => keyOf(row.text) === keyOf(text));
    if (at >= 0) kept.splice(at, 1); else added.push(text);
    kept.unshift({ text, at: now });
  }
  return writeNotes(storage, kept) ? added : false;
}

export function removeNote(storage, text) {
  const key = keyOf(text || '');
  return writeNotes(storage, loadNotes(storage).filter((row) => keyOf(row.text) !== key));
}

export function clearNotes(storage) { return safe(() => { storage.removeItem(NOTES_KEY); return true; }, false); }

/** 【사용자가 알려준 것】 with each note's date, at most 600 characters; '' when there is none. */
export function notesPromptBlock(notes) {
  const rows = Array.isArray(notes) ? notes : [];
  if (!rows.length) return '';
  const head = '\n\n【사용자가 알려준 것】\n' +
    '사용자가 이전 대화에서 스스로 밝힌 내용이다. 설명의 강조점과 예시를 고르는 데만 쓰고, 사실을 바꾸거나 근거 규칙을 느슨하게 하지 않는다. 보유·관심 사실을 근거로 사고팔 시점이나 비중을 지시하지 않는다.\n';
  let text = head;
  for (const row of rows) {
    const line = `- (${kstDate(row.at)}) ${row.text}\n`;
    if (text.length + line.length > NOTES_LIMITS.promptChars) break;
    text += line;
  }
  return text === head ? '' : text;
}
