// v59.70 (S12, owner decision D3): the AI panel is the one place a reader makes screener conditions. An answer that ends
// with a '스크리너 조건:' line (the screener context asks the model for it, in the parser's words) — or, when the model
// wrote none, a question that asks for a screen — becomes a card under the answer: the conditions the app read, what it
// could not read and why, and 스크리너에 적용. Applying writes #scr-custom-conditions (the same JSON the + 조건 panel
// keeps), opens 스크리너 and reports the table's count — including 0 — back on the card. The parser loads lazily.
import { conditionLabel, normalizeConditions } from '../../domain/screener/custom-conditions.js';

export const ANSWER_CONDITION_LINE = /스크리너\s*조건\s*[:：]\s*([^\n]+)/;
const SCREEN_REQUEST = /(?:종목|주식|스크린|스크리너|조건)[^?\n]{0,40}(?:찾|골라|추려|보여|걸러|뽑)|(?:찾|골라|추려|걸러|뽑)[^?\n]{0,20}(?:종목|주식)/;
const REASONS = { or: "조건은 모두 '그리고'로 묶입니다('또는'은 지원하지 않습니다)", inverted: '반대 방향(예: PER 이상)은 목록에 없는 조건입니다', won: '거래대금은 달러 백만 단위로 적습니다' };

/** The text the conditions come from: the answer's 스크리너 조건 line first, else a question that asks for a screen. */
export function conditionSource({ question = '', answer = '' } = {}) {
  const line = String(answer || '').match(ANSWER_CONDITION_LINE)?.[1]?.trim();
  if (line) return { text: line.replace(/[.。]\s*$/, ''), from: 'answer' };
  const asked = String(question || '');
  return SCREEN_REQUEST.test(asked) ? { text: asked, from: 'question' } : null;
}

/** Pure read of a parse result into what the card shows. */
export function describeParsed(parsed) {
  const conditions = normalizeConditions(parsed?.conditions || []);
  const unsupported = parsed?.unsupported || [];
  const why = (parsed?.reasons || []).map((key) => REASONS[key]).filter(Boolean);
  return { conditions, labels: conditions.map(conditionLabel).filter(Boolean), unsupported, why };
}

const el = (doc, tag, className, text) => { const node = doc.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };

/** Writes the conditions to the screener and opens it; resolves to the table's shown count (null when unknown). */
export async function applyToScreener({ documentRef: doc, root, conditions, timeoutMs = 8000 }) {
  const wait = () => new Promise((resolve) => root.setTimeout(resolve, 150));
  const until = Date.now() + timeoutMs;
  root?.showPage?.('screener');
  // The value goes in once the screener has mounted its condition panel, through the same change event the + 조건
  // panel fires, so the table re-filters exactly as when a reader adds a chip there.
  while (!doc.querySelector('#scr-custom .scr-custom-row') && Date.now() < until) await wait();
  const input = doc.getElementById('scr-custom-conditions');
  if (!input || !doc.querySelector('#scr-custom .scr-custom-row')) throw new Error('스크리너가 열리지 않았습니다');
  input.value = JSON.stringify(normalizeConditions(conditions));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  while (Date.now() < until) {
    await wait();
    const body = doc.getElementById('screener-results-body');
    if (!body) continue;
    const state = body.querySelector('[data-scr-state]')?.dataset.scrState;
    if (state === 'empty') return 0;
    if (state === 'error') return null;
    const count = Number((doc.getElementById('screener-result-count')?.textContent || '').match(/([\d,]+)\s*종목/)?.[1]?.replace(/,/g, ''));
    if (body.querySelector('[data-aio-screener-ticker]') && Number.isFinite(count)) return count;
  }
  return null;
}

/** Card under an answer; nothing when the turn holds no screen. */
export async function attachScreenerConditions({ documentRef: doc = globalThis.document, root = globalThis, parent, before = null, query = '', answer = '' } = {}) {
  if (!doc || !parent) return null;
  const source = conditionSource({ question: query, answer: answer || parent.textContent || '' });
  if (!source) return null;
  const card = el(doc, 'section', 'aio-answer-screen');
  card.setAttribute('aria-label', '스크리너 조건');
  card.dataset.from = source.from;
  parent.insertBefore(card, before && before.parentNode === parent ? before : null);
  let parsed;
  try {
    const { parseConditionText } = await import('../../domain/screener/condition-text-parser.js');
    parsed = describeParsed(parseConditionText(source.text));
  } catch (_) {
    card.append(el(doc, 'p', 'aio-answer-screen-note is-error', '조건 해석을 불러오지 못했습니다. 스크리너의 + 조건에서 골라 주세요.'));
    card.dataset.state = 'error';
    return card;
  }
  const head = el(doc, 'p', 'aio-answer-screen-head', parsed.labels.length ? `스크리너 조건 ${parsed.labels.length}개` : '스크리너 조건으로 읽은 것이 없습니다');
  card.append(head);
  if (parsed.labels.length) {
    const list = el(doc, 'ul', 'aio-answer-screen-list');
    parsed.labels.forEach((label) => list.append(el(doc, 'li', null, label)));
    card.append(list);
  }
  if (parsed.unsupported.length) card.append(el(doc, 'p', 'aio-answer-screen-note', `적용하지 않은 표현: '${parsed.unsupported.join("', '")}'${parsed.why.length ? ` — ${parsed.why.join(', ')}` : ''}.`));
  if (!parsed.labels.length || parsed.unsupported.length) {
    // An unsupported phrase applies nothing (as the + 조건 panel does), so the screen never silently differs from the words.
    card.dataset.state = 'unparsed';
    if (!parsed.unsupported.length) card.append(el(doc, 'p', 'aio-answer-screen-note', '스크리너의 + 조건에서 직접 고를 수 있습니다.'));
    return card;
  }
  const status = el(doc, 'p', 'aio-answer-screen-note');
  status.setAttribute('role', 'status');
  const button = el(doc, 'button', 'aio-btn-table aio-answer-screen-apply', '스크리너에 적용');
  button.type = 'button';
  button.addEventListener('click', async () => {
    button.disabled = true;
    status.textContent = '스크리너에 적용하는 중입니다.';
    try {
      const shown = await applyToScreener({ documentRef: doc, root, conditions: parsed.conditions });
      card.dataset.state = shown === 0 ? 'empty' : shown == null ? 'unknown' : 'applied';
      status.textContent = shown === 0 ? '적용했습니다. 조건에 맞는 종목이 없습니다 — 스크리너 칩에서 조건을 빼거나 바꿀 수 있습니다.'
        : shown == null ? '적용했습니다. 표가 아직 준비되지 않았습니다.' : `적용했습니다. 표에 ${shown}종목.`;
    } catch (error) {
      card.dataset.state = 'error';
      status.textContent = `적용하지 못했습니다: ${error.message}`;
    } finally {
      button.disabled = false;
    }
  });
  card.dataset.state = 'ready';
  card.append(button, status);
  return card;
}
