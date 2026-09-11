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
  await page.addScriptTag({ content:
    section('const chatState = {};', '// ── Text processing helpers') + '\n' +
    section('function chatAppendMsg(', '// ── Claude API streaming')
  });
  await page.evaluate(() => {
    const state = getChatState('home');
    state.messages = [{ role: 'user', content: '완료 질문' }, { role: 'assistant', content: '완료 답변' }];
    const run = _aioBeginChatRequest('home', '중단 질문');
    run.userMessage = { role: 'user', content: '중단 질문' };
    state.messages.push(run.userMessage);
    chatShowLoading('home');
    chatAppendMsg('home', 'ai', '부분 답변<span class="chat-cursor">▌</span>', 'chat-home-streaming');
    window.fixtureRun = run;
  });
  await page.getByRole('button', { name: '답변 생성 중지' }).focus();
  await page.keyboard.press('Enter');
  assert.deepEqual(await page.evaluate(() => ({
    aborted: fixtureRun.controller.signal.aborted,
    active: getChatState('home').streaming,
    messages: getChatState('home').messages.length,
    pending: document.querySelectorAll('.chat-dots,.chat-cursor,#chat-home-stop,#chat-home-streaming').length,
    status: document.querySelector('[role="status"]')?.textContent,
  })), { aborted: true, active: false, messages: 2, pending: 0, status: '답변 생성이 중지되었습니다.' });
  assert(await page.evaluate(() => {
    const run = _aioBeginChatRequest('home', '이동 중단');
    chatShowLoading('home');
    document.dispatchEvent(new CustomEvent('aio:pageShown', { detail: { pageId: 'market' } }));
    return run.controller.signal.aborted && !document.querySelector('.chat-dots') && !getChatState('home').streaming;
  }));
  assert(await page.evaluate(() => {
    const old = _aioBeginChatRequest('home', '이전');
    const fresh = _aioBeginChatRequest('home', '새 요청');
    _aioReleaseChatRequest(old);
    const isolated = old.controller.signal.aborted && _aioIsCurrentChatRequest('home', fresh) && document.querySelectorAll('#chat-home-stop').length === 1;
    _aioReleaseChatRequest(fresh);
    return isolated && !document.querySelector('#chat-home-stop') && !getChatState('home').streaming;
  }));
  const shell = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const historyStart = shell.indexOf("const CHAT_HISTORY_LS =");
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
  await page.locator('#chat-home-btn').focus();
  await page.evaluate(() => openChatHistory('home'));
  assert.equal(await page.getByRole('dialog', { name: '대화 기록 (home) - 1건' }).count(), 1);
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), '대화 기록 닫기');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement.textContent), '전체 삭제');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), '대화 기록 닫기');
  await page.keyboard.press('Escape');
  assert.equal(await page.getByRole('dialog').count(), 0);
  assert.equal(await page.evaluate(() => document.activeElement.id), 'chat-home-btn');
  console.log('Chat UI state Chromium fixture PASS: keyboard stop, cancelled turn isolation, route cancellation, stale epoch, completion cleanup, malformed/expired history isolation, dialog focus trap and restoration. Offline isolated DOM evidence.');
} finally { await browser.close(); }
