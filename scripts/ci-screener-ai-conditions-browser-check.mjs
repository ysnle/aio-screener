#!/usr/bin/env node
// v59.70 (S12, owner decision D3): the AI panel is the one path that makes screener conditions. This gate drives the
// real panel against a fixture Worker (no paid call) and checks the whole loop: an answer's '스크리너 조건:' line
// becomes a card, 스크리너에 적용 writes #scr-custom-conditions, opens 스크리너, the chips show the same conditions
// and the card reports the table's count. Cases: applied, empty result (0 rows -> shared empty state + card says so),
// unsupported phrase (nothing applied, card says why), Worker failure (no card), question fallback (answer without the
// line). On the previous code (140ba22c) no card is drawn and the first case fails.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closeAll, freePort, startLocalServer } from './lib/browser-gate.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = (Number(process.env.CI_SCREENER_AI_CONDITIONS_PORT) || await freePort());
const localBase = `http://127.0.0.1:${port}`;
const workerBase = 'https://aio-proxy.zmfhd007.workers.dev';
const failures = [];
const fail = (where, message) => failures.push(`[${where}] ${message}`);
const cors = { 'access-control-allow-origin': localBase, 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };

function answerStream(text) {
  const plan = `[AI_ANSWER_PLAN]${JSON.stringify({ schemaVersion: 'answer-plan.v1', summary: '조건 화면 제안입니다.', claims: [], sections: [{ title: '조건', body: text }], citations: [], followUps: [] })}[/AI_ANSWER_PLAN]`;
  return [`data: ${JSON.stringify({ type: 'response.output_text.delta', delta: plan })}\n\n`, `data: ${JSON.stringify({ type: 'response.completed', response: { status: 'completed', usage: { input_tokens: 12, output_tokens: 80 } } })}\n\n`].join('');
}

const CASES = [
  { id: 'applied', question: '추세가 좋은데 과열되지 않은 종목 골라줘', answer: '모멘텀이 이어지는 쪽을 고릅니다.\n스크리너 조건: RSI 50 이상, 3개월 수익률 10% 이상', expect: 'applied', ids: ['rsi-min', 'ret3m-min'] },
  { id: 'empty', question: '엄청 오른 종목 찾아줘', answer: '아주 강한 종목만 남깁니다.\n스크리너 조건: 1개월 수익률 500% 이상', expect: 'empty', ids: ['ret1m-min'] },
  { id: 'unsupported', question: '강하거나 오래 오른 종목 찾아줘', answer: '비싼 종목을 봅니다.\n스크리너 조건: PER 40 이상', expect: 'unparsed', ids: [] },
  // RSI 45: a level some stocks are under on any market day. At 30 the case depended on the pinned day's data and
  // found no stock on 2026-11-12, which read as a failure of the condition parser.
  { id: 'question-fallback', question: 'RSI 45 이하 종목 찾아줘', answer: '약한 구간의 종목입니다.', expect: 'applied', ids: ['rsi-max'], from: 'question' },
  { id: 'worker-failure', question: 'ROE 15% 이상 종목 찾아줘', answer: null, expect: 'none', ids: [] }
];

const server = await startLocalServer(port, { label: 'screener-ai-conditions/server' });
let browser;
try {
  browser = await chromium.launch();
  for (const testCase of CASES) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
    await context.addInitScript(() => { try { localStorage.clear(); } catch (_) {} });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    let paid = 0;
    await page.route('**/*', async (route) => {
      const request = route.request();
      const url = request.url();
      if (url.startsWith(localBase) && new URL(url).pathname === '/public-config.json') {
        const config = JSON.parse(readFileSync(resolve(root, 'public-config.json'), 'utf8'));
        config.ai = { ...config.ai, workerUrl: workerBase, provider: 'openai', model: 'gpt-6-luna', serverMode: 'shared-worker-only', chatPolicy: 'shared-worker-only', routeStatus: 'PUBLISHED' };
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(config) });
      }
      if (url.startsWith(localBase)) return route.continue();
      if (request.method() === 'OPTIONS' && url.startsWith(workerBase)) return route.fulfill({ status: 204, headers: cors });
      if (url === `${workerBase}/health`) {
        return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ schemaVersion: 'aio-worker-health.v1', ok: true, revision: 'fixture', ai: { configured: true, quotaConfigured: true, authorityReady: true, authorityJurisdiction: 'us', ready: true, provider: 'openai', model: 'gpt-6-luna', maxTokens: 1500 } }) });
      }
      if (url === `${workerBase}/openai`) {
        const body = JSON.parse(request.postData() || '{}');
        if (body.stream === false) return route.fulfill({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: '[]' }] }], usage: { input_tokens: 1, output_tokens: 1 } }) });
        paid += 1;
        if (testCase.answer == null) return route.fulfill({ status: 400, contentType: 'application/json', headers: cors, body: JSON.stringify({ error: { message: '요청을 처리하지 못했습니다' } }) });
        return route.fulfill({ status: 200, headers: { ...cors, 'content-type': 'text/event-stream', 'x-aio-max-tokens': '1500' }, body: answerStream(testCase.answer) });
      }
      return route.abort();
    });
    await page.goto(`${localBase}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => typeof window.showPage === 'function', null, { timeout: 30000 });
    // The screener rows are what the card reports against; wait for the shared snapshot.
    await page.waitForFunction(() => (window.AIO_ARCH?.getScreenerRows?.() || []).length > 0, null, { timeout: 45000 });
    // The table count before the AI turn, on the same route the card applies to.
    const baseline = await page.evaluate(async () => {
      window.showPage('screener');
      for (let i = 0; i < 100 && !document.querySelector('#screener-results-body [data-aio-screener-ticker]'); i += 1) await new Promise((r) => setTimeout(r, 150));
      return Number((document.getElementById('screener-result-count')?.textContent || '').replace(/[^\d]/g, ''));
    });
    await page.click('#topbar-ai-btn');
    await page.waitForFunction(() => document.querySelector('#ai-panel')?.getAttribute('aria-hidden') === 'false', null, { timeout: 8000 });
    const before = await page.$$eval('#ai-panel-msgs .ai-msg', (nodes) => nodes.length);
    await page.fill('#ai-panel-inp', testCase.question);
    await page.press('#ai-panel-inp', 'Enter');
    // An answer (or an error) lands; then the card, if any, within a short window.
    await page.waitForFunction((n) => { const msgs = document.querySelectorAll('#ai-panel-msgs .ai-msg'); return msgs.length > n && !document.getElementById('ai-panel-loading'); }, before, { timeout: 45000 }).catch(() => {});
    const card = await page.waitForSelector('#ai-panel-msgs .aio-answer-screen[data-state]', { timeout: testCase.expect === 'none' ? 4000 : 15000 }).catch(() => null);
    if (process.env.DEBUG_AI_CARD) console.log(`[debug ${testCase.id}]`, JSON.stringify(await page.evaluate(() => { const m = [...document.querySelectorAll('#ai-panel-msgs .ai-msg.ai')].at(-1); return { text: m?.innerText?.slice(0, 600), html: m?.innerHTML?.slice(0, 300) }; })));
    const cardState = card ? await card.evaluate((node) => ({ state: node.dataset.state, from: node.dataset.from, text: node.textContent.replace(/\s+/g, ' ').trim() })) : null;
    if (testCase.expect === 'none') {
      if (cardState) fail(testCase.id, `a failed answer drew a condition card: ${JSON.stringify(cardState)}`);
    } else if (!cardState) {
      fail(testCase.id, 'no 스크리너 조건 card under the answer');
    } else if (testCase.expect === 'unparsed') {
      if (cardState.state !== 'unparsed' || /스크리너에 적용/.test(cardState.text) || !/적용하지 않은 표현/.test(cardState.text)) fail(testCase.id, `unsupported phrase card wrong: ${JSON.stringify(cardState)}`);
      const applied = await page.evaluate(() => document.getElementById('scr-custom-conditions')?.value || '');
      if (applied && applied !== '[]') fail(testCase.id, `an unsupported phrase still wrote conditions: ${applied}`);
    } else {
      if (cardState.state !== 'ready') fail(testCase.id, `card not ready: ${JSON.stringify(cardState)}`);
      if (testCase.from && cardState.from !== testCase.from) fail(testCase.id, `conditions came from ${cardState.from}, expected ${testCase.from}`);
      await page.click('#ai-panel-msgs .aio-answer-screen .aio-answer-screen-apply');
      // 적용 opens 스크리너 (the panel closes with the page change); the result is read on the screener itself.
      await page.waitForFunction((n) => {
        const body = document.getElementById('screener-results-body');
        let ids = [];
        try { ids = JSON.parse(document.getElementById('scr-custom-conditions')?.value || '[]'); } catch (_) {}
        return document.querySelector('.page.active')?.id === 'page-screener' && ids.length === n && (body?.querySelector('[data-scr-state="empty"]') || body?.querySelector('[data-aio-screener-ticker]'));
      }, testCase.ids.length, { timeout: 25000 }).catch(() => {});
      await page.waitForTimeout(600);
      if (process.env.DEBUG_AI_CARD) console.log('[debug after]', JSON.stringify(await page.evaluate(() => ({ msgs: document.querySelectorAll('#ai-panel-msgs .ai-msg').length, cards: document.querySelectorAll('.aio-answer-screen').length, list: document.querySelector('.scr-custom-list')?.outerHTML?.slice(0, 200), input: document.getElementById('scr-custom-conditions')?.value, panelOpen: document.querySelector('#ai-panel')?.getAttribute('aria-hidden') }))));
      const result = await page.evaluate(() => {
        const node = document.querySelector('#ai-panel-msgs .aio-answer-screen');
        let ids = [];
        try { ids = JSON.parse(document.getElementById('scr-custom-conditions')?.value || '[]').map((item) => item.id); } catch (_) {}
        return {
          state: node?.dataset.state, status: node?.querySelector('[role="status"]')?.textContent || '',
          active: document.querySelector('.page.active')?.id, ids,
          chips: [...document.querySelectorAll('.scr-custom-list .scr-custom-chip')].map((chip) => chip.dataset.chip),
          emptyState: !!document.querySelector('#screener-results-body [data-scr-state="empty"] .aio-state.is-empty'),
          shown: (document.getElementById('screener-result-count')?.textContent || '').replace(/[^\d]/g, '')
        };
      });
      if (result.active !== 'page-screener') fail(testCase.id, `스크리너에 적용 did not open the screener (${result.active})`);
      if (JSON.stringify(result.ids) !== JSON.stringify(testCase.ids)) fail(testCase.id, `wrote ${JSON.stringify(result.ids)}, expected ${JSON.stringify(testCase.ids)}`);
      if (!testCase.ids.every((id) => result.chips.some((chip) => chip.startsWith(id)))) fail(testCase.id, `screener chips ${JSON.stringify(result.chips)} do not show ${testCase.ids.join(', ')}`);
      const note = await page.evaluate(() => document.querySelector('.scr-custom-note')?.textContent || '');
      if (testCase.expect === 'applied' && !(Number(result.shown) > 0 && Number(result.shown) < baseline)) fail(testCase.id, `table shows ${result.shown} (before ${baseline}); the conditions did not narrow it`);
      if (!/조건을 모두 만족하고 다른 필터도 통과한 종목 \d+개/.test(note)) fail(testCase.id, `condition panel note does not state the count: ${note.slice(0, 80)}`);
      if (testCase.expect === 'empty' && !result.emptyState) fail(testCase.id, 'a zero-row screen did not show the shared empty state');
      // v59.70 (review 89e8c881): the card itself must report the table's count. The panel swaps its messages on the page
      // change, so the card is read through the handle taken before 적용; it settles once the apply resolves.
      const settled = await card.evaluate((node) => new Promise((resolve) => {
        const started = Date.now();
        const tick = () => {
          const button = node.querySelector('.aio-answer-screen-apply');
          if ((node.dataset.state !== 'ready' && !button?.disabled) || Date.now() - started > 12000) {
            resolve({ state: node.dataset.state, status: node.querySelector('[role="status"]')?.textContent || '', ms: Date.now() - started });
          } else setTimeout(tick, 100);
        };
        tick();
      }));
      const wantState = testCase.expect === 'empty' ? 'empty' : 'applied';
      if (settled.state !== wantState) fail(testCase.id, `card state ${settled.state} (expected ${wantState}): ${settled.status}`);
      if (wantState === 'applied' && settled.status !== `적용했습니다. 표에 ${Number(result.shown)}종목.`) fail(testCase.id, `card status "${settled.status}" does not state the table's ${result.shown}종목`);
      if (wantState === 'empty' && !/조건에 맞는 종목이 없습니다/.test(settled.status)) fail(testCase.id, `card status "${settled.status}" does not say no stock met the conditions`);
      console.log(`[screener-ai] ${testCase.id}: table ${baseline} -> ${result.shown}${result.emptyState ? ' (shared empty state)' : ''}, chips ${result.chips.join(', ')}; card ${settled.state} "${settled.status}"`);
    }
    if (paid !== 1) fail(testCase.id, `expected exactly one fixture answer request, saw ${paid}`);
    if (errors.length) fail(testCase.id, `page errors: ${errors.slice(0, 2).join(' | ')}`);
    if (cardState && testCase.expect !== 'applied') console.log(`[screener-ai] ${testCase.id}: ${cardState.state} — ${cardState.text.slice(0, 90)}`);
    if (!cardState) console.log(`[screener-ai] ${testCase.id}: no card`);
    await context.close();
  }
} finally {
  await closeAll({ browser, server });
}
if (failures.length) {
  console.error('Screener AI conditions check failed:');
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log(`Screener AI conditions check OK: ${CASES.length} cases (applied, empty, unsupported, question fallback, Worker failure).`);
