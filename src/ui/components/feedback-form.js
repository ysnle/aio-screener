// v58.82 (owner 2026-10-26, roadmap 12): "이상해요" — a short note to the owner from any screen. Only the screen name
// and the app version ride with the text. The AIO Worker keeps notes privately (the repository is public), a few per
// connection a day; the owner reads them in the connection panel with the operator token, which is not stored.
import { readFeedback, sendFeedback } from '../../data/feedback.js';

export const FEEDBACK_MAX_CHARS = 1000;
const ROUTE_RE = /^[a-z][a-z0-9-]{0,30}(?:\/[A-Za-z0-9.^=-]{1,20})?$/;

export function feedbackRoute(hash) {
  const route = String(hash || '').replace(/^#\/?/, '').split(/[?&]/)[0];
  if (!route) return 'home';
  return ROUTE_RE.test(route) ? route : (ROUTE_RE.test(route.split('/')[0]) ? route.split('/')[0] : 'unknown');
}

const RESULT_TEXT = {
  sent: '보냈습니다. 고마워요.',
  limit: '오늘은 더 보낼 수 없습니다. 내일 다시 보내 주세요.',
  failed: '보내지 못했습니다. 잠시 뒤 다시 시도해 주세요. 쓴 내용은 그대로 있습니다.',
};

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function workerTarget(win) {
  try { return win._aioClaudeTarget?.()?.workerUrl || ''; } catch { return ''; }
}

export function openFeedbackDialog({ documentRef: doc, windowRef: win, version = '' }) {
  let dialog = doc.getElementById('aio-feedback-dialog');
  if (!dialog) {
    dialog = el(doc, 'dialog', null, 'aio-feedback');
    dialog.id = 'aio-feedback-dialog';
    dialog.setAttribute('aria-labelledby', 'aio-feedback-title');
    const title = el(doc, 'h2', '이상한 점 알려주기'); title.id = 'aio-feedback-title';
    const lede = el(doc, 'p', '지금 보는 화면 이름과 앱 버전만 함께 보냅니다. 이름, 보유 종목, 질문 기록은 보내지 않습니다.', 'aio-feedback-lede');
    const form = el(doc, 'form');
    const text = el(doc, 'textarea');
    text.name = 'text'; text.rows = 4; text.maxLength = FEEDBACK_MAX_CHARS; text.required = true;
    text.setAttribute('aria-label', '무엇이 이상했나요');
    text.placeholder = '무엇이 이상했나요? 예: 차트가 비어 있어요';
    const status = el(doc, 'div', null, 'aio-feedback-status'); status.setAttribute('role', 'status');
    const send = el(doc, 'button', '보내기'); send.type = 'submit';
    const close = el(doc, 'button', '닫기', 'aio-feedback-close'); close.type = 'button';
    const actions = el(doc, 'div', null, 'aio-feedback-actions'); actions.append(send, close);
    form.append(text, status, actions);
    dialog.append(title, lede, form);
    doc.body.appendChild(dialog);
    close.addEventListener('click', () => dialog.close());
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const body = text.value.trim(), workerUrl = workerTarget(win);
      if (!body) { status.textContent = '내용을 적어 주세요.'; return; }
      if (!workerUrl) { status.textContent = RESULT_TEXT.failed; return; }
      send.disabled = true; status.textContent = '보내는 중';
      const result = await sendFeedback({ fetchImpl: win.fetch.bind(win), workerUrl, appToken: win._aioAppToken?.(), text: body,
        route: feedbackRoute(win.location?.hash), version });
      send.disabled = false; status.textContent = RESULT_TEXT[result];
      if (result === 'sent') text.value = '';
    });
  }
  dialog.querySelector('.aio-feedback-status').textContent = '';
  if (!dialog.open) dialog.showModal();
  dialog.querySelector('textarea')?.focus();
  return dialog;
}

// Owner side: notes newest first, rendered as text only.
export function attachFeedbackReader(container, { documentRef: doc, windowRef: win }) {
  const box = el(doc, 'details', null, 'aio-feedback-reader');
  box.append(el(doc, 'summary', '가족 피드백 보기 (운영자)'));
  const form = el(doc, 'form');
  const token = el(doc, 'input');
  token.type = 'password'; token.autocomplete = 'off'; token.placeholder = '운영자 토큰 (저장하지 않음)';
  token.setAttribute('aria-label', '운영자 토큰');
  const go = el(doc, 'button', '불러오기'); go.type = 'submit';
  const status = el(doc, 'div', null, 'aio-feedback-status'); status.setAttribute('role', 'status');
  const list = el(doc, 'ol', null, 'aio-feedback-list');
  form.append(token, go);
  box.append(form, status, list);
  container.appendChild(box);
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const workerUrl = workerTarget(win);
    if (!workerUrl || !token.value) { status.textContent = '토큰을 넣어 주세요.'; return; }
    status.textContent = '불러오는 중';
    const read = await readFeedback({ fetchImpl: win.fetch.bind(win), workerUrl, operatorToken: token.value });
    token.value = '';
    if (!read.ok) { status.textContent = read.status === 404 ? '토큰이 맞지 않습니다.' : '불러오지 못했습니다.'; return; }
    const items = read.items;
    status.textContent = items.length ? `${items.length}건 (최신 순)` : '아직 받은 피드백이 없습니다.';
    list.replaceChildren(...items.map((item) => {
      const when = new Date(item.at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const row = el(doc, 'li');
      row.append(el(doc, 'div', `${when} KST · ${item.route} · ${item.version || '버전 없음'} · 보낸 사람 ${item.member}`, 'aio-feedback-meta'), el(doc, 'p', String(item.text ?? '')));
      return row;
    }));
  });
  return box;
}
