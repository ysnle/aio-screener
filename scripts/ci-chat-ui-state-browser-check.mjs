import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

// Offline Chromium DOM fixture: production lifecycle and rendering functions,
// no provider requests, real credentials, or user storage.
const source = readFileSync(new URL('../js/aio-chat.js', import.meta.url), 'utf8');
const section = (a, b) => {
  const start = source.indexOf(a), end = source.indexOf(b, start);
  assert(start >= 0 && end > start);
  return source.slice(start, end);
};
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.route('**/*', route => route.abort());
  await page.setContent('<div id="chat-home-msgs"></div><div><button id="chat-home-btn">전송</button></div>');
  // v59.11: the cancellation helpers live in the shared transport module (moved from js/aio-chat.js).
  await page.addScriptTag({ type: 'module', content: readFileSync(new URL('../src/data/providers/shared-ai-transport.js', import.meta.url), 'utf8') + '\ninstallSharedRoute(window);' });
  // v59.42: chatAppendMsg (per-page #chat-<ctx>-msgs) is deleted; the fixture appends its own bubbles and, like the
  // unified panel, passes appendCancelNotice.
  await page.addScriptTag({ content:
    section('const chatState = {};', '// ── Text processing helpers') + '\n' +
    `function chatAppendMsg(ctxId, role, html, id) {
      const container = document.getElementById('chat-' + ctxId + '-msgs');
      const wrap = document.createElement('div'); wrap.className = 'acp-msg ' + role;
      const bubble = document.createElement('div'); bubble.className = 'acp-bubble'; if (id) bubble.id = id; bubble.innerHTML = html;
      wrap.appendChild(bubble); container.appendChild(wrap); return bubble;
    }
    const fixtureCancelNotice = () => chatAppendMsg('home', 'ai', '<span role="status">답변 생성이 중지되었습니다.</span>');`
  });
  await page.evaluate(() => {
    const state = getChatState('home');
    state.messages = [{ role: 'user', content: '완료 질문' }, { role: 'assistant', content: '완료 답변' }];
    const run = _aioBeginChatRequest('home', '중단 질문', { appendCancelNotice: fixtureCancelNotice });
    run.userMessage = { role: 'user', content: '중단 질문' };
    state.messages.push(run.userMessage);
    chatAppendMsg('home', 'ai', '<span class="chat-dots"><span>·</span><span>·</span><span>·</span></span>', 'chat-home-loading'); // v57.62: chatShowLoading (per-page only) retired
    chatAppendMsg('home', 'ai', '부분 답변<span class="chat-cursor">▌</span>', 'chat-home-streaming');
    window.fixtureRun = run;
  });
  await page.getByRole('button', { name: '답변 생성 중지' }).focus();
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => ({
    aborted: fixtureRun.controller.signal.aborted,
    active: getChatState('home').streaming,
    messages: getChatState('home').messages.length,
    pending: document.querySelectorAll('.chat-dots,.chat-cursor,#chat-home-btn-stop,#chat-home-streaming').length,
    status: document.querySelector('[role="status"]')?.textContent,
  })), { aborted: true, active: false, messages: 2, pending: 0, status: '답변 생성이 중지되었습니다.' });
  assert(await page.evaluate(() => {
    const run = _aioBeginChatRequest('home', '이동 중단');
    chatAppendMsg('home', 'ai', '<span class="chat-dots"><span>·</span><span>·</span><span>·</span></span>', 'chat-home-loading'); // v57.62: chatShowLoading (per-page only) retired
    document.dispatchEvent(new CustomEvent('aio:pageShown', { detail: { pageId: 'market' } }));
    return run.controller.signal.aborted && !document.querySelector('.chat-dots') && !getChatState('home').streaming;
  }));
  assert(await page.evaluate(() => {
    const old = _aioBeginChatRequest('home', '이전');
    const fresh = _aioBeginChatRequest('home', '새 요청');
    _aioReleaseChatRequest(old);
    const isolated = old.controller.signal.aborted && _aioIsCurrentChatRequest('home', fresh) && document.querySelectorAll('#chat-home-btn-stop').length === 1;
    _aioReleaseChatRequest(fresh);
    return isolated && !document.querySelector('#chat-home-btn-stop') && !getChatState('home').streaming;
  }));
  // P1136/R620: the chat-history block moved out of index.html's inline block A into
  // js/aio-workspace.js. The slice boundaries must follow the code, or this guard silently
  // degrades to an empty string and the storage assertions below test nothing.
  const shell = readFileSync(new URL('../js/aio-workspace.js', import.meta.url), 'utf8');
  const historyStart = shell.indexOf('const CHAT_HISTORY_LS =');
  const historyEnd = shell.indexOf('// ── System prompts per context', historyStart);
  assert(historyStart >= 0 && historyEnd > historyStart);
  await page.addScriptTag({ content: `
    const fixtureStorage = new Map();
    Object.defineProperty(window, 'localStorage', { value: {
      getItem: key => fixtureStorage.get(key) || null,
      setItem: (key, value) => { if (window.fixtureWriteDenied) throw new Error('denied'); fixtureStorage.set(key, value); }
    }});
    window.AIO = { getChatHistoryPolicy: () => ({ enabled: true, retentionDays: 30 }) };
    function escHtml(value) { const el = document.createElement('span'); el.textContent = value; return el.innerHTML; }
  ` + shell.slice(historyStart, historyEnd) });
  assert.deepEqual(await page.evaluate(() => {
    const valid = { q: '보존 질문', a: '보존 답변', ctx: 'home', ts: Date.now() - 1000 };
    fixtureStorage.set('aio_chat_history', JSON.stringify([null, {}, { ...valid, ts: null }, { ...valid, ts: Date.now() + 86400000 }, { ...valid, ts: Date.now() - 31 * 86400000 }, valid]));
    fixtureWriteDenied = true;
    return _getChatHistory().map(row => row.q);
  }), ['보존 질문']);
  // v59.42: the unreachable 대화 기록 overlay (openChatHistory) is deleted, so its dialog focus checks went with it.
  assert.equal(await page.evaluate(() => typeof window.openChatHistory), 'undefined', 'v59.42 the retired chat history overlay stays absent');
  console.log('Chat UI state Chromium fixture PASS: keyboard stop, cancelled turn isolation, route cancellation, stale epoch, completion cleanup, malformed/expired history isolation, retired history overlay absent (v59.42). Offline isolated DOM evidence.');
} finally { await browser.close(); }
