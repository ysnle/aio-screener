import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const shell = readFileSync(path.join(root, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const chat = readFileSync(path.join(root, 'js', 'aio-chat.js'), 'utf8').replace(/\r\n/g, '\n');

function sliceBetween(source, startMarker, endMarker, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert(start >= 0 && end > start, `could not extract ${label}`);
  return source.slice(start, end);
}

const styleAnchor = shell.indexOf('<!-- v40.4: 통합 AI 사이드 패널 -->');
const styleStart = shell.indexOf('<style>', styleAnchor);
const styleEnd = shell.indexOf('</style>', styleStart);
assert(styleAnchor >= 0 && styleStart > styleAnchor && styleEnd > styleStart, 'could not extract AI panel CSS');
const aiPanelCss = shell.slice(styleStart + '<style>'.length, styleEnd);
assert(/\.ai-msg\{display:flex;flex-direction:column;/.test(aiPanelCss), 'production AI message CSS must use a column layout');
assert(/var _bubbleParent = \(aiBubble \? aiBubble\.parentNode : null\) \|\| \(streamEl \? streamEl\.querySelector\('\.ai-msg-content'\) : null\);/.test(shell), 'unified completion must append metadata to the content wrapper');
assert(/var citTarget = _bubbleParent \|\| \(streamEl \? streamEl\.querySelector\('\.ai-msg-content'\) : null\);/.test(shell), 'unified citations must use the content wrapper');

const appendAIMsg = sliceBetween(shell, 'function _appendAIMsg(', '\n\nasync function chatSendUnified', '_appendAIMsg');

// Use the shared disclosure helper from the production chat module. Its small
// dependency slice is self-contained and keeps this gate offline/provider-free.
const disclosureFormat = sliceBetween(chat, 'function _aioPublicAIFormatAsOf(', '\n\nfunction _aioBuildAIResponseDisclosure', 'disclosure formatter');
const disclosureBuild = sliceBetween(chat, 'function _aioBuildAIResponseDisclosure(', '\n\nfunction _aioApplyAIActionGate', 'disclosure builder');
const disclosureAppend = sliceBetween(chat, 'function _aioAppendAIPublicDisclosure(', '\n\nif (typeof window !==', 'disclosure renderer');
const citationCanonical = sliceBetween(chat, 'function _aioCanonicalResearchUrl(', '\n\nfunction _aioResearchResultUsable', 'citation URL normalizer');
const citationsHtml = sliceBetween(chat, 'function _searchCitationsHTML(', '\n\n/** Google Custom Search API 호출', 'citation renderer');
const disclosureFixture = [
  "var _AIO_PUBLIC_AI_POLICY = { label: 'AI 베타 · 교육/리서치 보조', status: 'beta-research', actionGate: 'read-only-conditional-analysis' };",
  disclosureFormat,
  disclosureBuild,
  disclosureAppend,
].join('\n');
const citationFixture = [
  'function escHtml(value) { const el = document.createElement(\'span\'); el.textContent = String(value || \'\'); return el.innerHTML; }',
  citationCanonical,
  citationsHtml,
].join('\n');

const outputDir = path.join(root, '.cache', 'aio-qa', 'chat-layout');
mkdirSync(outputDir, { recursive: true });

const baseCss = `
:root {
  --bg-surface: #fbf9f5;
  --surface-1: rgba(33,29,22,0.02);
  --surface-3: rgba(33,29,22,0.04);
  --border: #e3ddd0;
  --text-primary: #211d16;
  --text-secondary: #57513f;
  --text-muted: #625c50;
  --accent: #8a5a00;
  --data-purple: #7a4d9b;
  --data-cyan: #16758a;
  --data-green: #22754c;
  --data-amber: #9b6500;
}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; background: #f4f0e8; color: var(--text-primary); }
body { font-family: Arial, sans-serif; }
${aiPanelCss}
`;

const fixtureHtml = `<!doctype html>
<html><head><meta charset="utf-8"></head><body>
  <aside id="ai-panel" class="open" aria-hidden="false">
    <div class="ai-ph"><span class="ai-ph-title">AI 베타 · 리서치</span><span class="ai-ph-badge">BETA</span><button class="ai-ph-close">×</button></div>
    <div id="ai-panel-msgs"></div>
    <div id="ai-panel-chips" class="ai-chips">
      <button type="button" class="ai-chip">긴 한국어 후속 질문: 반도체 공급망과 현금흐름을 함께 확인</button>
      <button type="button" class="ai-chip">https://example.com/a-very-long-follow-up-question-without-spaces</button>
    </div>
    <div class="ai-input-row"><input id="ai-panel-inp" value="https://example.com/a-very-long-input-value-without-spaces" aria-label="질문"><button id="ai-panel-btn">전송</button></div>
  </aside>
</body></html>`;

const answerHtml = [
  '<p>반도체 공급망은 <strong>수요·가격·재고·현금흐름</strong>을 함께 확인해야 합니다. 긴 한국어 문장도 한 열의 본문 폭 안에서 읽혀야 합니다.</p>',
  '<p>긴 URL: https://example.com/research/very-long-path-without-spaces-and-query?entity=semiconductor&amp;period=2026Q3&amp;source=official</p>',
  '<table><thead><tr><th>항목</th><th>관측값</th><th>확인 기준</th></tr></thead><tbody><tr><td>수요</td><td>고객 주문</td><td>공시·원문</td></tr><tr><td>현금흐름</td><td>FCF</td><td>기간 일치</td></tr><tr><td>긴 표 값</td><td>TABLE_WIDE_value_without_spaces_abcdefghijklmnopqrstuvwxyz_0123456789_abcdefghijklmnopqrstuvwxyz_0123456789</td><td>원문 대조</td></tr></tbody></table>',
  '<pre>const evidence = {\n  source: "https://example.com/official/filing",\n  status: "확인 필요"\n};\nconsole.log(evidence);</pre>',
].join('');

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 400, height: 900 } });
  await page.route('**/*', route => route.abort());
  await page.setContent(fixtureHtml, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: baseCss });
  await page.addScriptTag({ content: `
    window.safeHtml = value => String(value || '');
    ${appendAIMsg}
    ${disclosureFixture}
    ${citationFixture}
    window.fixtureAppendResponseDecorations = function (bubble) {
      const content = bubble && bubble.parentElement;
      if (!content) throw new Error('production message content wrapper missing');
      const model = document.createElement('div');
      model.dataset.fixture = 'model';
      model.textContent = 'Claude Sonnet · 응답 모델';
      content.appendChild(model);
      window._aioAppendAIPublicDisclosure(content, {
        freshness: { after: { quoteRows: [{ observedAt: '2026-09-10T03:00:00Z', source: 'fixture official filing', hasLivePrice: true, decisionUse: true, truthStatus: 'verified' }] } }
      });
      const sources = document.createElement('div');
      sources.dataset.fixture = 'sources';
      sources.textContent = '종목 데이터 · 재무 · 웹검색 · 뉴스';
      content.appendChild(sources);
      const feedback = document.createElement('div');
      feedback.dataset.fixture = 'feedback';
      feedback.innerHTML = '<button type="button">도움됨</button><button type="button">부정확</button>';
      content.appendChild(feedback);
      const citations = document.createElement('div');
      citations.dataset.fixture = 'citations';
      citations.innerHTML = _searchCitationsHTML({ engine: 'claude', citations: [
        { url: 'https://example.com/official/filing/very-long-url-without-spaces', title: '공식 원문 참고 링크' },
        { url: 'https://example.com/official/filing/very-long-url-without-spaces', title: '중복 링크는 제거되어야 함' }
      ] });
      content.appendChild(citations);
      return content;
    };
    window.fixtureMakeLegacyResponse = function (html) {
      const message = document.createElement('div');
      message.className = 'ai-msg ai';
      message.id = 'legacy-answer';
      const bubble = document.createElement('div');
      bubble.className = 'ai-bubble';
      bubble.innerHTML = html;
      message.appendChild(bubble);
      const model = document.createElement('div');
      model.dataset.fixture = 'model';
      model.textContent = 'Claude Sonnet · 응답 모델';
      message.appendChild(model);
      window._aioAppendAIPublicDisclosure(message, {
        freshness: { after: { quoteRows: [{ observedAt: '2026-09-10T03:00:00Z', source: 'fixture official filing', hasLivePrice: true, decisionUse: true, truthStatus: 'verified' }] } }
      });
      const sources = document.createElement('div');
      sources.dataset.fixture = 'sources';
      sources.textContent = '종목 데이터 · 재무 · 웹검색 · 뉴스';
      message.appendChild(sources);
      const feedback = document.createElement('div');
      feedback.dataset.fixture = 'feedback';
      feedback.innerHTML = '<button type="button">도움됨</button><button type="button">부정확</button>';
      message.appendChild(feedback);
      const citations = document.createElement('div');
      citations.dataset.fixture = 'citations';
      citations.innerHTML = _searchCitationsHTML({ engine: 'claude', citations: [{ url: 'https://example.com/official/filing/very-long-url-without-spaces', title: '공식 원문 참고 링크' }] });
      message.appendChild(citations);
      document.getElementById('ai-panel-msgs').appendChild(message);
      return message;
    };
  ` });
  await page.evaluate(({ answerHtml: html }) => {
    const bubble = _appendAIMsg('ai', html, 'fixture-answer');
    window.fixtureContent = window.fixtureAppendResponseDecorations(bubble);
  }, { answerHtml });

  const metrics = async (messageId) => page.evaluate((id) => {
    const panel = document.getElementById('ai-panel');
    const messages = document.getElementById('ai-panel-msgs');
    const message = document.getElementById(id);
    const content = message && (message.querySelector('.ai-msg-content') || message);
    const bubble = message && message.querySelector('.ai-bubble');
    const table = bubble && bubble.querySelector('table');
    const pre = bubble && bubble.querySelector('pre');
    const chips = document.getElementById('ai-panel-chips');
    const inputRow = document.querySelector('.ai-input-row');
    const input = document.getElementById('ai-panel-inp');
    const rectWidth = node => node ? Math.round(node.getBoundingClientRect().width * 100) / 100 : 0;
    const overflows = node => node ? node.scrollWidth > node.clientWidth + 1 : true;
    const metadata = content && bubble ? Array.from(content.children).filter(node => node !== bubble) : [];
    const computedMessage = message ? getComputedStyle(message) : null;
    const computedContent = content ? getComputedStyle(content) : null;
    const hasContentWrapper = !!(message && message.querySelector('.ai-msg-content'));
    const safe = !!(
      message && content && bubble &&
      hasContentWrapper &&
      computedMessage.flexDirection === 'column' &&
      computedContent.flexDirection === 'column' &&
      rectWidth(message) <= messages.clientWidth + 1 &&
      rectWidth(content) <= messages.clientWidth + 1 &&
      rectWidth(bubble) <= messages.clientWidth + 1 &&
      metadata.every(node => rectWidth(node) <= rectWidth(content) + 1) &&
      !overflows(panel) && !overflows(messages) && !overflows(bubble) &&
      !overflows(chips) && !overflows(inputRow) &&
      input && input.getBoundingClientRect().width > 0
    );
    return {
      safe,
      panel: rectWidth(panel),
      messages: rectWidth(messages),
      message: rectWidth(message),
      content: rectWidth(content),
      bubble: rectWidth(bubble),
      metadata: metadata.map(node => ({ kind: node.dataset.fixture || node.tagName.toLowerCase(), width: rectWidth(node) })),
      flexDirection: computedMessage && computedMessage.flexDirection,
      contentFlexDirection: computedContent && computedContent.flexDirection,
      hasContentWrapper,
      directChildCount: message ? message.children.length : 0,
      tableOverflowX: table ? getComputedStyle(table).overflowX : null,
      tableScrollWidth: table ? table.scrollWidth : 0,
      tableClientWidth: table ? table.clientWidth : 0,
      preOverflowX: pre ? getComputedStyle(pre).overflowX : null,
      preScrollWidth: pre ? pre.scrollWidth : 0,
      preClientWidth: pre ? pre.clientWidth : 0,
      overflow: { panel: overflows(panel), messages: overflows(messages), bubble: overflows(bubble), chips: overflows(chips), inputRow: overflows(inputRow) },
      inputWidth: rectWidth(input),
    };
  }, messageId);

  const widths = [320, 400, 768, 1280];
  const positiveMetrics = {};
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.waitForTimeout(20);
    positiveMetrics[width] = await metrics('fixture-answer');
    assert(positiveMetrics[width].safe, `chat response layout failed at ${width}px: ${JSON.stringify(positiveMetrics[width])}`);
    await page.screenshot({ path: path.join(outputDir, `chat-layout-${width}.png`), fullPage: true });
  }

  const disclosure = page.locator('[data-ai-public-disclosure]');
  assert.equal(await disclosure.count(), 1, 'shared AI disclosure is present');
  assert.equal(await disclosure.evaluate(node => node.open), false, 'disclosure starts collapsed');
  await disclosure.locator('summary').focus();
  await page.keyboard.press('Enter');
  assert.equal(await disclosure.evaluate(node => node.open), true, 'disclosure opens from keyboard');
  await page.keyboard.press('Space');
  assert.equal(await disclosure.evaluate(node => node.open), false, 'disclosure closes from keyboard');

  writeFileSync(path.join(outputDir, 'fixture.html'), await page.content(), 'utf8');

  await page.setViewportSize({ width: 400, height: 900 });
  await page.evaluate(html => window.fixtureMakeLegacyResponse(html), answerHtml);
  await page.evaluate(() => document.body.classList.add('legacy-row-fixture'));
  await page.addStyleTag({ content: `
    .legacy-row-fixture .ai-msg { display:flex; flex-direction:row; gap:8px; max-width:95%; }
    .legacy-row-fixture .ai-msg.ai { align-self:flex-start; }
    .legacy-row-fixture .ai-msg > * { flex:0 1 auto; min-width:0; }
  ` });
  const negativeMetrics = await metrics('legacy-answer');
  assert.equal(negativeMetrics.flexDirection, 'row', 'negative control uses the previous row layout');
  assert(negativeMetrics.directChildCount > 1 && !negativeMetrics.hasContentWrapper, 'negative control restores direct metadata siblings');
  assert(negativeMetrics.metadata.some(item => item.width + 1 < negativeMetrics.bubble), `negative control did not show narrowed sibling columns: ${JSON.stringify(negativeMetrics)}`);
  assert(!negativeMetrics.safe, `negative control unexpectedly passed: ${JSON.stringify(negativeMetrics)}`);
  await page.screenshot({ path: path.join(outputDir, 'chat-layout-negative-row-400.png'), fullPage: true });

  console.log(JSON.stringify({
    positive: positiveMetrics,
    negativeControl: negativeMetrics,
    screenshots: outputDir,
  }, null, 2));
  console.log('PASS chat-response-layout: production AI panel CSS/_appendAIMsg, disclosure keyboard toggle, narrow-width overflow guards, and previous-row negative control. Offline Chromium evidence.');
} finally {
  await browser.close();
}
