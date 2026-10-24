// Owner 2026-10-14: conversations in the AI panel — one conversation follows the reader across screens, a list of past
// conversations can be reopened and continued, and nothing is stored until the reader agrees on the first conversation.
// The classic panel (js/aio-chat.js) keeps its send/stream path; this module only (1) gives it one shared conversation
// state instead of one per screen, (2) records each completed turn, (3) adds the header controls and the list.
import { appendTurn, consentState, deleteSession, loadSessions, newSessionId, sessionMessages, sessionWhen, setConsent, ACTIVE_KEY } from '../../ai/session/chat-sessions.js';
import { el } from './dom.js';

const SCREEN = { home: '오늘', briefing: '브리핑', macro: '거시', fxbond: '금리·환율', themes: '테마', signal: '시장 상태', breadth: '시장 폭', sentiment: '투자 심리', ticker: '종목', technical: '차트', fundamental: '재무', screener: '스크리너', portfolio: '포트폴리오', 'market-news': '뉴스', principles: '개념', atlas: '산업 지도', masters: '투자 대가', guide: '안내' };

// The device store is handed in by the app layer (ui/ai modules never open browser storage themselves).
export function installChatSessions(root = globalThis, doc = root.document, { storage = null } = {}) {
  if (!doc || root.__aioChatSessions) return root.__aioChatSessions || null;
  const shared = { messages: [], streaming: false, _chatSendEntered: 0, _requestEpoch: 0, _activeRequest: null, _retryCount: 0 };
  const api = { shared, sessionId: null };
  root.__aioChatSessions = api;
  // (1) One conversation for the whole panel.
  if (typeof root.getChatState === 'function') root.getChatState = () => shared;
  if (consentState(storage) === 'granted') {
    const activeId = (() => { try { return storage.getItem(ACTIVE_KEY); } catch (_) { return null; } })();
    const active = loadSessions(storage).find((s) => s.id === activeId);
    if (active) { api.sessionId = active.id; shared.messages.push(...sessionMessages(active)); }
  }
  const setActive = (id) => { api.sessionId = id; try { if (id) storage.setItem(ACTIVE_KEY, id); else storage.removeItem(ACTIVE_KEY); } catch (_) {} };
  // The message list stays owned by the classic panel (AG-DOM-WRITER): after the shared state changes, the panel's own
  // context refresh repaints it from getChatState(), which is the shared conversation above.
  const repaint = () => {
    const page = String(doc.querySelector('.page.active')?.id || '').replace(/^page-/, '');
    if (page && typeof root.updateAIPanelContext === 'function') { try { root.updateAIPanelContext(page); } catch (_) {} }
  };
  const cancel = (reason) => { try { root._aioCancelChatRequest?.(root._aiCurrentCtx, reason); } catch (_) {} };

  // (2) Record each completed turn; ask once, after the first answer, whether to keep conversations on this device.
  const pending = [];
  const originalSave = root.saveChatEntry;
  // Codex audit F24 (2026-10-15): the message list is a plain div that only scrolls, so a screen-reader user heard
  // nothing when an answer finished. Every completed turn (normal or gate-blocked) passes saveChatEntry, so one polite
  // status line announces the completion once — the streamed text itself is not re-read.
  const status = el(doc, 'p', '', 'sr-only');
  status.id = 'ai-panel-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  doc.getElementById('ai-panel')?.append(status);
  const announce = (answer) => {
    status.textContent = '';
    const size = String(answer || '').length;
    root.setTimeout?.(() => { status.textContent = `AI 답변이 완료되었습니다${size ? ` (${size.toLocaleString('ko-KR')}자)` : ''}. 위쪽 대화 영역에서 읽을 수 있습니다.`; }, 50);
  };
  root.saveChatEntry = function (ctxId, question, answer) {
    announce(answer);
    const state = consentState(storage);
    if (state === 'granted') {
      if (!api.sessionId) setActive(newSessionId());
      const saved = appendTurn(storage, { sessionId: api.sessionId, ctx: ctxId, question, answer });
      if (saved.saved === false) notifySaveFailed();
    } else if (state === 'unasked') {
      pending.push({ ctx: ctxId, question, answer });
      askConsent();
    }
    return typeof originalSave === 'function' ? originalSave.apply(this, arguments) : false;
  };
  // Codex audit F03: a refused write is said once in the panel instead of silently losing the newest turn.
  function notifySaveFailed() {
    const anchor = doc.getElementById('ai-panel')?.querySelector('.ai-chips');
    if (!anchor || doc.getElementById('ai-session-save-failed')) return;
    const note = el(doc, 'p', '이 브라우저의 저장 공간이 가득 차 방금 대화를 저장하지 못했습니다. 대화 목록에서 오래된 대화를 지우면 다시 저장됩니다.', 'ai-session-consent-body');
    note.id = 'ai-session-save-failed';
    note.setAttribute('role', 'status');
    anchor.before(note);
  }
  function askConsent() {
    // The card sits between the messages and the question chips (a sibling, not inside the classic message list),
    // so a screen switch that repaints the messages keeps the question open.
    const anchor = doc.getElementById('ai-panel')?.querySelector('.ai-chips');
    if (!anchor || doc.getElementById('ai-session-consent')) return;
    const card = el(doc, 'div', null, 'ai-session-consent');
    card.id = 'ai-session-consent';
    card.setAttribute('role', 'group');
    card.setAttribute('aria-label', '대화 저장 여부');
    card.append(el(doc, 'p', '이 대화를 이 기기에 저장할까요?', 'ai-session-consent-title'),
      el(doc, 'p', '저장하면 대화 목록에서 다시 열어 이어서 물을 수 있습니다. 대화 원문은 이 브라우저에만 보관되고(PIN 암호화 대상 아님), 지울 때까지 남습니다. 저장한 대화를 이어서 물으면 답을 만들기 위해 최근 대화가 질문과 함께 AI 서버로 전송됩니다. 언제든 목록에서 지우거나 저장을 끌 수 있습니다.', 'ai-session-consent-body'));
    const row = el(doc, 'div', null, 'ai-session-actions');
    const yes = el(doc, 'button', '저장', 'ai-session-btn is-primary'); yes.type = 'button';
    const no = el(doc, 'button', '저장하지 않음', 'ai-session-btn'); no.type = 'button';
    yes.addEventListener('click', () => {
      setConsent(storage, true);
      setActive(newSessionId());
      for (const turn of pending.splice(0)) { appendTurn(storage, { sessionId: api.sessionId, ...turn }); if (typeof originalSave === 'function') originalSave(turn.ctx, turn.question, turn.answer); }
      card.replaceChildren(el(doc, 'p', '저장을 켰습니다. 위쪽 "대화 목록"에서 다시 열 수 있습니다.', 'ai-session-consent-body'));
      refreshHeader();
    });
    no.addEventListener('click', () => { setConsent(storage, false); pending.length = 0; card.remove(); refreshHeader(); });
    row.append(yes, no);
    card.append(row);
    anchor.before(card);
  }

  // (3) Header controls: 새 대화 · 대화 목록.
  const head = doc.querySelector('#ai-panel .ai-ph');
  const close = head?.querySelector('.ai-ph-close');
  const controls = el(doc, 'div', null, 'ai-session-controls');
  const fresh = el(doc, 'button', '새 대화', 'ai-session-head-btn'); fresh.type = 'button';
  const list = el(doc, 'button', '대화 목록', 'ai-session-head-btn'); list.type = 'button';
  list.setAttribute('aria-expanded', 'false');
  list.setAttribute('aria-controls', 'ai-session-list');
  controls.append(fresh, list);
  if (head && close) head.insertBefore(controls, close);
  // The list button stays visible once the reader has answered, so a "저장하지 않음" can be reversed from the list.
  function refreshHeader() { list.hidden = consentState(storage) === 'unasked'; }
  refreshHeader();
  fresh.addEventListener('click', () => {
    cancel('new-session');
    shared.messages.length = 0;
    setActive(null);
    closeList();
    repaint();
    doc.getElementById('ai-panel-inp')?.focus?.();
  });

  const panel = el(doc, 'div', null, 'ai-session-list');
  panel.id = 'ai-session-list';
  panel.hidden = true;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', '저장된 대화 목록');
  doc.getElementById('ai-panel')?.append(panel);
  function closeList() { panel.hidden = true; list.setAttribute('aria-expanded', 'false'); }
  function openList() {
    const top = el(doc, 'div', null, 'ai-session-list-head');
    const back = el(doc, 'button', '닫기', 'ai-session-btn'); back.type = 'button'; back.addEventListener('click', () => { closeList(); list.focus(); });
    if (consentState(storage) !== 'granted') {
      top.append(el(doc, 'h3', '대화 저장이 꺼져 있습니다', 'ai-session-list-title'), back);
      const on = el(doc, 'button', '저장 켜기', 'ai-session-btn is-primary'); on.type = 'button';
      on.addEventListener('click', () => { setConsent(storage, true); if (!api.sessionId) setActive(newSessionId()); refreshHeader(); openList(); });
      const body = el(doc, 'div', null, 'ai-session-foot');
      body.append(el(doc, 'p', '켜면 다음 질문부터 이 브라우저에 저장되고, 목록에서 다시 열어 이어서 물을 수 있습니다.', 'ai-session-meta'), on);
      panel.replaceChildren(top, body);
      panel.style.top = `${head?.offsetHeight || 52}px`; // the header wraps on a phone; the list starts below it
      panel.hidden = false;
      list.setAttribute('aria-expanded', 'true');
      on.focus?.();
      return;
    }
    const sessions = loadSessions(storage).sort((a, b) => b.updatedAt - a.updatedAt);
    top.append(el(doc, 'h3', `저장된 대화 ${sessions.length}개`, 'ai-session-list-title'), back);
    const items = el(doc, 'ul', null, 'ai-session-items');
    if (!sessions.length) items.append(el(doc, 'li', '아직 저장된 대화가 없습니다. 질문을 하면 여기에 쌓입니다.', 'ai-session-empty'));
    for (const session of sessions) {
      const item = el(doc, 'li', null, `ai-session-item${session.id === api.sessionId ? ' is-active' : ''}`);
      const open = el(doc, 'button', null, 'ai-session-open'); open.type = 'button';
      const screens = [...new Set(session.turns.map((t) => SCREEN[t.ctx] || null).filter(Boolean))].slice(0, 3).join(', ');
      open.append(el(doc, 'span', session.title, 'ai-session-title'), el(doc, 'span', `${sessionWhen(session.updatedAt)}, 질문 ${session.turns.length}개${screens ? `, ${screens}` : ''}`, 'ai-session-meta'));
      open.addEventListener('click', () => {
        cancel('session-switch');
        setActive(session.id);
        shared.messages.length = 0;
        shared.messages.push(...sessionMessages(session));
        repaint();
        closeList();
        doc.getElementById('ai-panel-inp')?.focus?.();
      });
      const remove = el(doc, 'button', '삭제', 'ai-session-delete'); remove.type = 'button';
      remove.setAttribute('aria-label', `'${session.title}' 대화 삭제`);
      remove.addEventListener('click', () => {
        if (remove.dataset.confirm !== '1') { remove.dataset.confirm = '1'; remove.textContent = '한 번 더 누르면 삭제'; return; }
        if (deleteSession(storage, session.id) === false) { remove.textContent = '삭제하지 못했습니다'; return; }
        // Deleting the open conversation also clears it from the panel and from the next question's context.
        if (session.id === api.sessionId) { cancel('session-delete'); setActive(null); shared.messages.length = 0; repaint(); }
        openList();
      });
      item.append(open, remove);
      items.append(item);
    }
    const foot = el(doc, 'div', null, 'ai-session-foot');
    const off = el(doc, 'button', '저장 끄고 모두 지우기', 'ai-session-delete'); off.type = 'button';
    off.addEventListener('click', () => {
      if (off.dataset.confirm !== '1') { off.dataset.confirm = '1'; off.textContent = '한 번 더 누르면 모두 지웁니다'; return; }
      setConsent(storage, false); setActive(null); shared.messages.length = 0; repaint(); closeList(); refreshHeader();
    });
    foot.append(el(doc, 'p', '이 브라우저에만 저장, PIN 암호화 대상 아님, 최근 40개 대화', 'ai-session-meta'), off);
    panel.replaceChildren(top, items, foot);
    panel.style.top = `${head?.offsetHeight || 52}px`; // the header wraps on a phone; the list starts below it
    panel.hidden = false;
    list.setAttribute('aria-expanded', 'true');
    panel.querySelector('.ai-session-open, .ai-session-btn')?.focus?.();
  }
  list.addEventListener('click', () => (panel.hidden ? openList() : closeList()));
  panel.addEventListener('keydown', (event) => { if (event.key === 'Escape') { event.stopPropagation(); closeList(); list.focus(); } });
  return api;
}
