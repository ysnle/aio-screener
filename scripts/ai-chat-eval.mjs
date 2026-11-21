#!/usr/bin/env node
// scripts/ai-chat-eval.mjs — v60.41: asks the real AI chat the question set (architecture/ai-chat-question-set.json) in a
// browser, the way a reader does, and scores every answer (scripts/lib/ai-chat-eval.mjs).
//
// This spends the shared AI budget (each question may use up to three model requests), so it is run on purpose, never in CI.
// The Worker allows the Pages origin; a local origin only when it is listed in the Worker's AIO_DEV_ORIGINS (exact
// http://127.0.0.1:<port> or http://localhost:<port>). The runner probes /health with the page's origin before asking.
//
//   node scripts/ai-chat-eval.mjs --base https://ysnle.github.io/aio-screener/      live site
//   node scripts/ai-chat-eval.mjs --port <n>                                          local checkout (needs AIO_DEV_ORIGINS)
//   node scripts/ai-chat-eval.mjs --dry [--base <url>]                                validate + resolve figures, no model call
//   options: --ids a,b  --task 3|screen  --situation korea  --limit n  --gap <seconds between questions, default 5>
//            --out <dir, default _artifacts/ai-chat-eval>  --headed
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CliArgsError, parseCliArgs } from './lib/cli-args.mjs';
import { closeAll, freePort, startLocalServer } from './lib/browser-gate.mjs';
import { REPORT_SCHEMA, SET_PATH, coverage, loadEvalData, resolveQuestions, scoreAnswer, validateSet } from './lib/ai-chat-eval.mjs';
import { latestCompletedUsSession } from '../src/domain/market/session/market-calendar.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const USAGE = 'usage: node scripts/ai-chat-eval.mjs [--base <url> | --port <n>] [--dry] [--ids a,b] [--task 1-5|id] [--situation id] [--limit n] [--gap s] [--out dir] [--headed]';
const WORKER_LIMIT_PER_MIN = 20; // OPENAI_RATE_LIMIT in cloudflare-worker-proxy.js
const REQUESTS_PER_QUESTION = 3;
const POLL_MS = 250;

let args;
try {
  args = parseCliArgs(process.argv.slice(2), { usage: USAGE, flags: ['--dry', '--headed'], options: ['--base', '--port', '--ids', '--task', '--situation', '--limit', '--gap', '--out'], positional: { max: 0 } });
} catch (error) {
  if (error instanceof CliArgsError) { console.error(error.message); process.exit(2); }
  throw error;
}
if (args.help) { console.log(USAGE); process.exit(0); }
const opt = args.options;
const dry = args.flags.has('--dry');
const outDir = resolve(root, opt['--out'] || '_artifacts/ai-chat-eval');
const gapMs = Math.max(0, Number(opt['--gap'] ?? 5)) * 1000;
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));
const readRepo = (file) => readFileSync(join(root, file), 'utf8');

// ── the set and the questions to ask ───────────────────────────────────────────────────────────────────────────────────
const set = JSON.parse(readRepo(SET_PATH));
const setErrors = validateSet(set, { routes: Object.keys(JSON.parse(readRepo('architecture/route-owners.json')).routes || {}) });
if (setErrors.length) { console.error(`question set invalid:\n  ${setErrors.join('\n  ')}`); process.exit(1); }
let questions = set.questions;
if (opt['--ids']) { const ids = new Set(opt['--ids'].split(',').map((s) => s.trim())); questions = questions.filter((q) => ids.has(q.id)); }
if (opt['--task']) {
  const task = set.tasks.find((t) => String(t.n) === opt['--task'] || t.id === opt['--task']);
  if (!task) { console.error(`unknown task ${opt['--task']}`); process.exit(2); }
  questions = questions.filter((q) => q.tasks.includes(task.id));
}
if (opt['--situation']) questions = questions.filter((q) => (q.situations || []).includes(opt['--situation']));
if (opt['--limit']) questions = questions.slice(0, Math.max(0, Number(opt['--limit']) || 0));
if (!questions.length) { console.error('no question selected'); process.exit(2); }

// ── where the page is served from ──────────────────────────────────────────────────────────────────────────────────────
let server = null;
let base = opt['--base'] ? String(opt['--base']).replace(/\/?$/, '/') : null;
if (!base && !dry) {
  const port = Number(opt['--port']) || await freePort();
  server = await startLocalServer(port, { label: 'ai-chat-eval/server' });
  base = `http://127.0.0.1:${server.port}/`;
}
// The figures are resolved from the data the asked page is served with (the live site's files for --base).
const loader = base ? async (file) => {
  const res = await fetch(new URL(file, base), { cache: 'no-store', headers: { 'user-agent': 'aio-chat-eval' } });
  if (!res.ok) throw new Error(`${file}: HTTP ${res.status}`);
  return res.text();
} : async (file) => readRepo(file);

async function workerOriginCheck() {
  if (!base) return { checked: false, reason: 'no base (dry run against the checkout)' };
  try {
    const config = JSON.parse(await loader('public-config.json'));
    const workerUrl = String(config?.ai?.workerUrl || '').replace(/\/$/, '');
    const origin = new URL(base).origin;
    const res = await fetch(`${workerUrl}/health`, { headers: { origin, 'user-agent': 'aio-chat-eval' } });
    const allowed = res.headers.get('access-control-allow-origin');
    return { checked: true, workerUrl, origin, status: res.status, allowOrigin: allowed, reachable: res.ok && allowed === origin };
  } catch (error) { return { checked: true, reachable: false, reason: error.message }; }
}

const data = await loadEvalData(loader);
const { resolved, errors: resolveErrors } = resolveQuestions(questions, data);
const worker = await workerOriginCheck();
const session = latestCompletedUsSession(Date.now(), { requirePrevious: false });
const usOpen = !!session?.inSession;

if (dry) {
  console.log(`question set ${set.release}: ${set.questions.length} questions, ${questions.length} selected; data from ${base || 'checkout'}`);
  for (const q of questions) {
    const entry = resolved[q.id];
    const figures = entry.figures.map((f) => `${f.resolver}=${f.resolved ? f.resolved.value : `ERR(${f.error})`}`);
    const screen = entry.screen ? (entry.screen.error ? `screen ERR(${entry.screen.error})` : `screen ${entry.screen.symbols.length} rows [${entry.screen.top.slice(0, 5).join(', ')}]`) : '';
    console.log(`  ${q.id.padEnd(26)} ${[...figures, screen].filter(Boolean).join('  ') || '(no figures)'}`);
  }
  const count = coverage(set);
  console.log(`coverage: ${Object.entries(count).map(([tag, n]) => `${tag.replace(/^\w+:/, '')}=${n}`).join(' ')}`);
  console.log(`US session now: ${usOpen ? 'open (intraday questions apply)' : `closed, latest completed ${session?.date}`}`);
  console.log(worker.checked ? `Worker ${worker.workerUrl || ''} for origin ${worker.origin || '?'}: ${worker.reachable ? 'allowed' : `not allowed (Access-Control-Allow-Origin: ${worker.allowOrigin || 'none'}${worker.reason ? `, ${worker.reason}` : ''})`}` : `Worker check skipped: ${worker.reason}`);
  if (resolveErrors.length) { console.error(`unresolved:\n  ${resolveErrors.join('\n  ')}`); process.exit(1); }
  console.log('dry run OK (no model call)');
  process.exit(0);
}

if (resolveErrors.length) console.warn(`[ai-chat-eval] figures that did not resolve are scored as not-scored:\n  ${resolveErrors.join('\n  ')}`);
if (!worker.reachable) {
  console.error(`[ai-chat-eval] the Worker does not answer this origin (${worker.origin}; Access-Control-Allow-Origin: ${worker.allowOrigin || 'none'}${worker.reason ? `; ${worker.reason}` : ''}). Every answer would be the degraded notice. Run with --base https://ysnle.github.io/aio-screener/ or add this exact origin to AIO_DEV_ORIGINS.`);
  await closeAll({ server });
  process.exit(1);
}

// ── asking ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
function snapshot(baseline) {
  const msgs = [...document.querySelectorAll('#ai-panel-msgs .ai-msg')].slice(baseline);
  const loading = document.getElementById('ai-panel-loading');
  const btn = document.getElementById('ai-panel-btn');
  return {
    loading: loading ? loading.innerText.trim() : null,
    streaming: !!document.getElementById('ai-panel-streaming'),
    busy: !!btn?.disabled,
    msgs: msgs.map((m) => {
      const bubble = m.querySelector('.ai-bubble');
      const content = m.querySelector('.ai-msg-content');
      const text = (bubble?.innerText || '').trim();
      const statusEl = bubble?.querySelector('[role=status], .ai-websearch-status');
      const status = (!!statusEl && text === statusEl.innerText.trim()) || /^(다시 시도합니다|응답이 늦어 .*다시 시도합니다)/.test(text);
      return {
        role: m.classList.contains('user') ? 'user' : 'ai', id: m.id || '', text, html: bubble?.innerHTML || '', status,
        error: !!bubble?.querySelector('.lch-err'),
        links: [...(content?.querySelectorAll('a[href]') || [])].map((a) => ({ text: a.innerText.trim().slice(0, 120), href: a.href })),
        chips: [...(content?.children || [])].filter((child) => child !== bubble).map((child) => child.innerText.trim()).filter(Boolean)
      };
    })
  };
}
const normStatus = (line) => line.replace(/\d[\d,]*\s*(초|분|자)/g, '#$1').trim();

async function askTurn(page, question, timeoutMs, state) {
  const baseline = await page.$$eval('#ai-panel-msgs .ai-msg', (nodes) => nodes.length);
  await page.fill('#ai-panel-inp', question);
  const started = Date.now();
  await page.click('[data-action="chatSendUnified"]');
  const statusLines = [];
  const seen = new Set();
  const note = (line) => { const key = normStatus(line); if (line && !seen.has(key)) { seen.add(key); statusLines.push(line); } };
  let firstStatusMs = null;
  let firstTextMs = null;
  let snap = null;
  while (Date.now() - started < timeoutMs) {
    snap = await page.evaluate(snapshot, baseline);
    if (snap.loading != null) { if (firstStatusMs == null) firstStatusMs = Date.now() - started; snap.loading.split('\n').forEach((line) => note(line.trim())); }
    snap.msgs.filter((m) => m.role === 'ai' && m.status).forEach((m) => note(m.text));
    const answers = snap.msgs.filter((m) => m.role === 'ai' && !m.id && !m.status && m.text);
    if (answers.length && firstTextMs == null) firstTextMs = Date.now() - started;
    if (answers.some((m) => /AI 사용 한도에 도달/.test(m.text))) state.rateLimited = true;
    if (answers.length && snap.loading == null && !snap.streaming && !snap.busy && Date.now() - started > 1000) break;
    if (state.rateLimited && !snap.busy) break;
    await sleep(POLL_MS);
  }
  const totalMs = Date.now() - started;
  const finished = !!snap && !snap.busy && snap.loading == null;
  await sleep(1500); // citations and app-drawn visuals attach right after the answer
  snap = await page.evaluate(snapshot, baseline);
  const answers = snap.msgs.filter((m) => m.role === 'ai' && !m.id && !m.status && m.text);
  const last = answers[answers.length - 1] || null;
  return {
    question, firstStatusMs, firstTextMs, totalMs: finished ? totalMs : null, timedOut: !finished, statusLines,
    answer: last?.text || '', html: last?.html || '', errorShown: !!last?.error, links: last?.links || [], chips: last?.chips || [],
    extraMessages: answers.slice(0, -1).map((m) => m.text.slice(0, 300))
  };
}

async function askItem(browser, q, state) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul', serviceWorkers: 'block' });
  const workerHost = new URL(worker.workerUrl).host;
  const pageErrors = [];
  let modelRequests = 0;
  context.on('request', (req) => {
    const url = new URL(req.url());
    if (url.host === workerHost && /\/openai\b/.test(url.pathname) && req.method() === 'POST') { modelRequests += 1; state.requestTimes.push(Date.now()); }
  });
  context.on('response', (res) => {
    const url = new URL(res.url());
    if (url.host === workerHost && /\/openai\b/.test(url.pathname) && res.status() === 429) state.rateLimited = true;
  });
  context.on('weberror', (e) => pageErrors.push(String(e.error()?.message || e.error()).slice(0, 300)));
  try {
    const page = await context.newPage();
    page.on('dialog', (dialog) => dialog.dismiss().catch(() => {}));
    await page.goto(new URL(`index.html${q.screen}`, base).href, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => typeof window.showPage === 'function' && document.querySelector('.page.active'), null, { timeout: 45000 });
    const open = await page.evaluate(() => document.querySelector('#ai-panel')?.getAttribute('aria-hidden') === 'false');
    if (!open) await page.click('#topbar-ai-btn');
    await page.waitForFunction(() => { const inp = document.getElementById('ai-panel-inp'); return inp && !inp.disabled && document.querySelector('#ai-panel')?.getAttribute('aria-hidden') === 'false'; }, null, { timeout: 20000 });
    const max = { ...(set.defaults?.maxSeconds || {}), ...(q.checks?.maxSeconds || {}) };
    const timeoutMs = Math.max(180000, (max.full || 120) * 1500);
    const turns = [];
    for (const text of q.turns || [q.question]) {
      turns.push(await askTurn(page, text, timeoutMs, state));
      if (state.rateLimited) break;
    }
    return { turns, modelRequests, pageErrors, activeRoute: await page.evaluate(() => document.querySelector('.page.active')?.id || null) };
  } finally {
    await context.close().catch(() => {});
  }
}

const state = { requestTimes: [], rateLimited: false };
async function pace(turnCount) {
  const need = REQUESTS_PER_QUESTION * turnCount;
  for (;;) {
    const now = Date.now();
    state.requestTimes = state.requestTimes.filter((at) => now - at < 60000);
    if (state.requestTimes.length + need <= WORKER_LIMIT_PER_MIN) return;
    await sleep(Math.max(1000, 60000 - (now - state.requestTimes[0]) + 500));
  }
}

const { chromium } = await import('playwright');
const startedAt = new Date().toISOString();
const items = [];
let browser = null;
try {
  browser = await chromium.launch({ headless: !args.flags.has('--headed') });
  for (const [index, q] of questions.entries()) {
    const head = { id: q.id, tasks: q.tasks, situations: q.situations || [], screen: q.screen, expect: q.expect, manual: q.manual, question: q.turns || q.question };
    if (state.rateLimited) { items.push({ ...head, status: 'not-run', reason: 'stopped after a 429' }); continue; }
    const when = q.when || 'any';
    if ((when === 'us-open' && !usOpen) || (when === 'us-closed' && usOpen)) { items.push({ ...head, status: 'not-applicable', reason: `asked only when ${when}; US session is ${usOpen ? 'open' : 'closed'}` }); continue; }
    if (index > 0 && gapMs) await sleep(gapMs);
    await pace((q.turns || [q.question]).length);
    process.stdout.write(`[${index + 1}/${questions.length}] ${q.id} … `);
    try {
      const rec = await askItem(browser, q, state);
      if (state.rateLimited) {
        items.push({ ...head, status: 'rate-limited', record: rec, reason: 'Worker answered 429 (or the panel showed the limit notice); run stopped' });
        console.log('429, stopping');
        continue;
      }
      const checks = scoreAnswer(q, rec, resolved[q.id], set, data);
      const failedChecks = checks.filter((c) => c.ok === false);
      const status = failedChecks.length ? 'fail' : 'pass';
      items.push({ ...head, status, checks, record: rec, resolved: resolved[q.id] });
      const last = rec.turns[rec.turns.length - 1] || {};
      console.log(`${status.toUpperCase()} ${last.totalMs != null ? `${(last.totalMs / 1000).toFixed(1)}s` : 'timeout'} ${rec.modelRequests} req${failedChecks.length ? ` — ${failedChecks.map((c) => c.check).join('; ')}` : ''}`);
    } catch (error) {
      items.push({ ...head, status: 'error', error: String(error.message).split('\n')[0].slice(0, 400) });
      console.log(`ERROR ${String(error.message).split('\n')[0].slice(0, 200)}`);
    }
  }
} finally {
  await closeAll({ browser, server });
}

// ── report ─────────────────────────────────────────────────────────────────────────────────────────────────────────────
const scored = items.filter((item) => item.status === 'pass' || item.status === 'fail');
const rate = (list) => ({ pass: list.filter((i) => i.status === 'pass').length, scored: list.length, rate: list.length ? Math.round(list.filter((i) => i.status === 'pass').length / list.length * 1000) / 10 : null });
const byTag = (key, ids) => Object.fromEntries(ids.map((id) => [id, rate(scored.filter((item) => item[key].includes(id)))]).filter(([, value]) => value.scored));
const totalOf = (item) => { const turns = item.record?.turns || []; return turns.length && turns.every((t) => t.totalMs != null) ? turns.reduce((n, t) => n + t.totalMs, 0) : null; };
const report = {
  schemaVersion: REPORT_SCHEMA, release: set.release, startedAt, finishedAt: new Date().toISOString(), base, worker: { workerUrl: worker.workerUrl, origin: worker.origin },
  session: { usOpen, latestCompletedUsSession: session?.date || null },
  counts: Object.fromEntries(['pass', 'fail', 'error', 'rate-limited', 'not-run', 'not-applicable'].map((status) => [status, items.filter((item) => item.status === status).length])),
  modelRequests: items.reduce((n, item) => n + (item.record?.modelRequests || 0), 0),
  overall: rate(scored), byTask: byTag('tasks', set.tasks.map((t) => t.id)), bySituation: byTag('situations', set.situations.map((s) => s.id)),
  slowest: items.filter((item) => totalOf(item) != null).sort((a, b) => totalOf(b) - totalOf(a)).slice(0, 10).map((item) => ({ id: item.id, totalMs: totalOf(item), firstTextMs: item.record.turns[0].firstTextMs })),
  items
};
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

const pct = (r) => (r.rate == null ? '—' : `${r.rate}% (${r.pass}/${r.scored})`);
const excerpt = (text) => String(text || '').replace(/\s+/g, ' ').slice(0, 300);
const md = [
  `# AI 채팅 평가 ${set.release}`, '',
  `- 실행: ${startedAt} → ${report.finishedAt}`, `- 대상: ${base} (Worker ${worker.workerUrl}, origin ${worker.origin})`,
  `- 미국 장: ${usOpen ? '열림' : `닫힘, 최근 완료 세션 ${session?.date || '?'}`}`, `- 모델 요청: ${report.modelRequests}회`,
  `- 결과: ${Object.entries(report.counts).map(([k, v]) => `${k} ${v}`).join(', ')}`, '',
  `## 통과율`, '', `전체 **${pct(report.overall)}**`, '',
  '| 과제 | 통과율 |', '|---|---|', ...Object.entries(report.byTask).map(([id, r]) => `| ${id} | ${pct(r)} |`), '',
  '| 상황 | 통과율 |', '|---|---|', ...Object.entries(report.bySituation).map(([id, r]) => `| ${id} | ${pct(r)} |`), '',
  '## 가장 느린 답', '', '| 질문 | 전체 | 첫 글자 |', '|---|---|---|',
  ...report.slowest.map((s) => `| ${s.id} | ${(s.totalMs / 1000).toFixed(1)}s | ${s.firstTextMs == null ? '—' : `${(s.firstTextMs / 1000).toFixed(1)}s`} |`), '',
  '## 실패한 검사', '',
  ...items.filter((item) => item.status === 'fail' || item.status === 'error' || item.status === 'rate-limited').flatMap((item) => [
    `### ${item.id} — ${item.status}`, '', `- 질문: ${[].concat(item.question).join(' → ')}`, `- 화면: ${item.screen}`,
    ...(item.error ? [`- 오류: ${item.error}`] : []), ...(item.reason ? [`- 사유: ${item.reason}`] : []),
    ...(item.checks || []).filter((c) => c.ok === false).map((c) => `- FAIL ${c.check}: ${c.detail}`),
    `- 답 발췌: ${excerpt(item.record?.turns?.at(-1)?.answer) || '(없음)'}`, ''
  ]),
  '## 사람이 읽고 판단할 것', '', '통과한 답도 아래 기준(논리, 부분 사이의 연결)은 자동 검사가 보지 못한다.', '',
  ...items.filter((item) => item.status === 'pass' || item.status === 'fail').map((item) => `- ${item.id}: ${item.manual}`), ''
].join('\n');
writeFileSync(join(outDir, 'report.md'), md);
console.log(`\noverall ${pct(report.overall)} — ${join(outDir, 'report.md')}`);
if (state.rateLimited) process.exitCode = 3;
