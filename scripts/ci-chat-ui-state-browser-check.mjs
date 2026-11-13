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
  // The unified panel's own markup: the loading bubble is an .ai-msg carrying the loading id, the caret is .lch-caret.
  assert.deepEqual(await page.evaluate(() => {
    const msgs = document.getElementById('chat-home-msgs');
    msgs.insertAdjacentHTML('beforeend', '<div class="ai-msg ai" id="ai-panel-loading"><div class="ai-msg-content"><div class="ai-bubble"><span class="lch-muted">분석 중...</span></div></div></div>'
      + '<div class="ai-msg ai" id="ai-panel-streaming"><div class="ai-msg-content"><div class="ai-bubble">부분 답변<span class="lch-caret">|</span></div></div></div>');
    let notices = 0;
    _aioBeginChatRequest('home', '패널 중단', { buttonId: 'chat-home-btn', loadingId: 'ai-panel-loading', streamingId: 'ai-panel-streaming', appendCancelNotice: () => { notices++; } });
    _aioCancelChatRequest('home', 'user-cancelled');
    return { loading: !!document.getElementById('ai-panel-loading'), carets: document.querySelectorAll('.lch-caret').length, partialKept: msgs.textContent.includes('부분 답변'), notices };
  }), { loading: false, carets: 0, partialKept: true, notices: 1 }, 'v59.97 stop leaves no 분석 중 bubble or caret in the unified panel');
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
  // v60.02 (plan 050): the waiting line. The page is served from a fixture origin so the chat-loaded ESM modules import
  // as they do in the app; the request lifecycle is the real slice above; the clock is injected (no wall-clock date).
  const waiting = await browser.newPage();
  const repo = new URL('../', import.meta.url);
  await waiting.route('**/*', (route) => {
    const url = new URL(route.request().url());
    if (url.origin !== 'http://aio.fixture') return route.abort();
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><meta charset="utf-8"><div id="ai-panel"><div id="ai-panel-msgs"></div><div id="ai-panel-chips" class="ai-chips"></div><div class="ai-input-row"><input id="ai-panel-inp"><button id="ai-panel-btn">전송</button></div></div>' });
    if (!url.pathname.startsWith('/src/')) return route.abort();
    return route.fulfill({ contentType: 'text/javascript', body: readFileSync(new URL('.' + url.pathname, repo), 'utf8') });
  });
  await waiting.goto('http://aio.fixture/');
  await waiting.addScriptTag({ type: 'module', content: readFileSync(new URL('../src/data/providers/shared-ai-transport.js', import.meta.url), 'utf8') + '\ninstallSharedRoute(window);' });
  await waiting.addScriptTag({ content: section('const chatState = {};', '// ── Text processing helpers') });
  await waiting.evaluate(async () => {
    window.clock = { t: 5_000_000 };
    const { createChatRunKit } = await import('/src/ui/components/chat-run-status.js');
    window.tab = new Map();
    window.tabStore = { getItem: (k) => (tab.has(k) ? tab.get(k) : null), setItem: (k, v) => tab.set(k, String(v)), removeItem: (k) => tab.delete(k) };
    window.kit = createChatRunKit(window, document, { now: () => window.clock.t, storage: () => tabStore });
    window.leaveAsks = () => { const event = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; };
    // The panel's loading bubble as js/aio-chat.js _appendAIMsg builds it.
    window.loadingBubble = () => {
      const msg = document.createElement('div'); msg.className = 'ai-msg ai'; msg.id = 'ai-panel-loading';
      msg.innerHTML = '<div class="ai-msg-content"><div class="ai-bubble"><span class="lch-muted">분석 중...</span></div></div>';
      document.getElementById('ai-panel-msgs').append(msg);
      return msg.querySelector('.ai-bubble');
    };
    window.startRun = (question) => {
      const run = _aioBeginChatRequest('home', question, { entrypoint: 'unified-chat', buttonId: 'ai-panel-btn', idleLabel: '전송', loadingId: 'ai-panel-loading', stopButtonId: 'ai-panel-stop', appendCancelNotice: () => {} });
      run.status = kit.begin({ node: loadingBubble(), ctx: 'home', question });
      return run;
    };
    window.statusNodes = () => [...document.querySelectorAll('#ai-panel-msgs [role="status"]')];
  });
  const line = await waiting.evaluate(() => {
    window.run = startRun('엔비디아는 지금 어때?');
    window.firstNode = statusNodes()[0];
    const first = firstNode.textContent;
    run.status.hook('sent', { body: { reasoning: { effort: 'medium' } }, quietMs: 90_000 });
    const thinking = firstNode.textContent;
    run.status.chars(240);
    clock.t += 12_000;
    return { first, thinking, writing: firstNode.textContent, nodes: statusNodes().length, live: firstNode.getAttribute('aria-live'), stop: !!document.getElementById('ai-panel-stop') };
  });
  assert.deepEqual(line, { first: '질문에 맞는 자료를 고르는 중', thinking: '생각하는 중', writing: '답변을 쓰는 중 (240자)', nodes: 1, live: 'polite', stop: true }, 'v60.02 the loading bubble is one polite status line, updated in place, with the stop control beside it');
  await waiting.waitForFunction(() => firstNode.textContent.includes('· 12초'), null, { timeout: 3000 });
  assert.deepEqual(await waiting.evaluate(() => ({ same: statusNodes()[0] === firstNode, nodes: statusNodes().length, counterHidden: firstNode.querySelector('span[aria-hidden="true"]')?.textContent })),
    { same: true, nodes: 1, counterHidden: ' (240자) · 12초' }, 'v60.02 the 1 s timer updates the same node; the counters are hidden from screen readers');
  // The answer is published: the panel removes the loading bubble and releases the run (as _uniOnDone does).
  assert.deepEqual(await waiting.evaluate(async () => {
    const settled = run.status.hook('ended');
    const checking = firstNode.textContent;
    await settled;
    document.getElementById('ai-panel-loading').remove();
    _aioReleaseChatRequest(run);
    return { checking, nodes: statusNodes().length, running: run.status.running };
  }), { checking: '숫자와 근거를 확인하는 중 · 12초', nodes: 0, running: false }, 'v60.02 stream end reads checking; the status line is gone after the answer and its timer stops');
  // Stop: the cancel removes the line and clears its timer — no update after the cancel.
  assert.deepEqual(await waiting.evaluate(async () => {
    const stopped = startRun('중단할 질문');
    const node = statusNodes()[0];
    _aioCancelChatRequest('home', 'user-cancelled');
    const before = node.textContent;
    clock.t += 30_000;
    await new Promise((resolve) => setTimeout(resolve, 1300));
    return { nodes: statusNodes().length, unchanged: node.textContent === before, running: stopped.status.running };
  }), { nodes: 0, unchanged: true, running: false }, 'v60.02 a stopped run leaves no status line and no running timer');
  // Part B: while a run is in flight its question is kept for this tab and leaving asks first; the release undoes both.
  assert.deepEqual(await waiting.evaluate(() => {
    const before = leaveAsks();
    const live = startRun('반도체 재고 흐름은?');
    const during = { asks: leaveAsks(), kept: JSON.parse(tab.get('aio_chat_pending_v1') || 'null')?.question };
    _aioReleaseChatRequest(live);
    return { before, during, after: leaveAsks(), keptAfter: tab.has('aio_chat_pending_v1') };
  }), { before: false, during: { asks: true, kept: '반도체 재고 흐름은?' }, after: false, keptAfter: false }, 'v60.02 beforeunload and the kept question last exactly from send to release');
  // A hidden tab gets no frame: stream end does not wait for one, so a finished answer is published as usual.
  assert.equal(await waiting.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    const hiddenRun = startRun('숨은 탭 질문');
    const settled = hiddenRun.status.hook('ended');
    _aioReleaseChatRequest(hiddenRun);
    delete document.hidden;
    return settled === undefined && document.hidden === false;
  }), true, 'v60.02 a hidden tab does not hold the answer back at stream end');
  // After a reload: the card above the question box, with 다시 묻기 and 지우기; expired after 15 minutes.
  assert.deepEqual(await waiting.evaluate(() => {
    document.getElementById('ai-panel-msgs').replaceChildren();
    const question = '엔비디아 실적 발표 뒤 반도체 공급망 전체의 재고와 가격 흐름이 어떻게 달라졌는지 기업별로 나눠서 자세히 설명해 줘. 특히 메모리와 파운드리 쪽을 중심으로';
    const keep = () => tab.set('aio_chat_pending_v1', JSON.stringify({ sessionId: null, ctx: 'home', question, startedAt: clock.t - 60_000 }));
    keep();
    const card = kit.showPendingCard();
    const quoted = /^답변을 받기 전에 화면이 새로 열렸습니다\. 방금 질문: "(.+)…"$/.exec(card?.querySelector('p')?.textContent || '')?.[1] || '';
    const shown = { above: card?.nextElementSibling?.id === 'ai-panel-chips', quote: quoted.length <= 79 && quoted.length >= 70 && question.startsWith(quoted), buttons: [...(card?.querySelectorAll('button') || [])].map((b) => b.textContent), cards: document.querySelectorAll('#ai-pending-turn').length };
    card.querySelectorAll('button')[1].click();
    const cleared = { card: !!document.getElementById('ai-pending-turn'), kept: tab.has('aio_chat_pending_v1') };
    keep();
    const sent = [];
    window.chatSendUnified = () => sent.push(document.getElementById('ai-panel-inp').value);
    kit.showPendingCard().querySelectorAll('button')[0].click();
    const asked = { sent, card: !!document.getElementById('ai-pending-turn'), kept: tab.has('aio_chat_pending_v1') };
    keep();
    clock.t += 15 * 60_000;
    return { shown, cleared, asked, expired: kit.showPendingCard() === null && !tab.has('aio_chat_pending_v1') };
  }), {
    shown: { above: true, quote: true, buttons: ['다시 묻기', '지우기'], cards: 1 },
    cleared: { card: false, kept: false },
    asked: { sent: ['엔비디아 실적 발표 뒤 반도체 공급망 전체의 재고와 가격 흐름이 어떻게 달라졌는지 기업별로 나눠서 자세히 설명해 줘. 특히 메모리와 파운드리 쪽을 중심으로'], card: false, kept: false },
    expired: true
  }, 'v60.02 the reload card quotes the question (80 chars), 지우기 forgets it, 다시 묻기 sends it once, and it expires at 15 minutes');
  await waiting.close();
  console.log('Chat UI state Chromium fixture PASS: keyboard stop, cancelled turn isolation, route cancellation, stale epoch, completion cleanup, malformed/expired history isolation, retired history overlay absent (v59.42), waiting line in place and stopped with its run (v60.02). Offline isolated DOM evidence.');
} finally { await browser.close(); }
