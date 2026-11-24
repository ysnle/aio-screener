// v60.41: the chat's screen tool filters with the screener screen's own condition engine. Its structured spec (market, size
// bucket, sector/theme/index, CUSTOM_CONDITIONS ids, sort, limit) runs on the committed public-data/screener.json through
// the browser's row construction (the screener provider, then normalizeScreener), with the same condition reader the
// screener table uses. The old tool passed a sentence to a keyword reader that read every size as 0 rows (row.mcap is
// null on every row), read 과매도 as a SELL signal and knew no PER or return condition; each block below fails on it.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createScreenerProvider } from '../src/data/providers/screener.js';
import { normalizeScreener } from '../src/data/normalize/screener.js';
import { CONSENSUS_KEY } from '../src/data/consensus-estimates.js';
import { CUSTOM_CONDITIONS, evaluateCondition, conditionCoverage } from '../src/domain/screener/custom-conditions.js';
import { capFilterValue } from '../src/domain/screener/row-presentation.js';
import * as rowPresentation from '../src/domain/screener/row-presentation.js';

// The screener filter's bucket; on code before v60.41 (no shared bucket) the filter's own boundaries.
const capBucketOf = rowPresentation.capBucketOf || ((row) => { const v = capFilterValue(row); return v == null ? null : v >= 1000 ? 'MEGA' : v >= 10 ? 'LARGE' : v >= 2 ? 'MID' : 'SMALL'; });
import * as registry from '../src/ai/tools/registry.js';
import * as screenerQuery from '../src/ai/context/screener-query.js';
import { createThemesProvider } from '../src/data/providers/themes.js';
import { normalizeThemes } from '../src/data/normalize/themes.js';
import { marketInterpretation, registerInterpretationStore } from '../src/data/selectors/interpretation.js';
import { SCENARIO_OUTCOMES, SCENARIO_STATE } from '../src/data/artifact-registry.js';
import { readHistoryRows } from '../src/domain/market/indices/history-rows.js';
import { readRowNumber } from '../src/data/contracts/screener.js';
import { THEME_STATES } from '../src/domain/scenarios/analogs.js';
import { signedText } from '../src/domain/shared/number.js';
import { classicLiteral, loadThemeMaps } from './build-scenario-state.mjs';
import { runSections } from './lib/gate-sections.mjs';

const checks = [];
const failures = [];
// Every check runs and reports, so one failure does not hide the others.
const check = async (name, fn) => { try { await fn(); checks.push(name); } catch (error) { failures.push(`${name}: ${String(error.message).split('\n')[0]}`); } };
const readData = (name) => { try { return JSON.parse(readFileSync(new URL(`../public-data/${name}`, import.meta.url), 'utf8')); } catch (_) { return null; } };

const artifact = readData('screener.json');
const asOfMs = Date.parse(artifact?.asOf || '');
if (!artifact || !Number.isFinite(asOfMs)) { console.error('chat-screen-tool: public-data/screener.json is missing or has no asOf'); process.exit(1); }
// The browser's row construction: the provider reads the artifact, the universe and the validation status, then the
// orchestrator normalises. The clock is the artifact's own time, so the gate does not age with the calendar.
const provider = createScreenerProvider({
  httpClient: { requestJson: async (url) => { const data = readData(String(url).split('?')[0].split('/').pop()); return data ? { ok: true, data } : { ok: false, status: 404 }; } },
  clock: { now: () => asOfMs, iso: () => artifact.asOf }
});
const rows = normalizeScreener(await provider.readCurrent()).rows;
const digest = readData('telegram-digest.json');
const consensus = readData('consensus-estimates.json');
const root = {
  _aioGetCanonicalScreenerRows: () => rows, _liveData: {}, SCR_KEYWORD_ALIASES: {}, THEME_MAP: [],
  AIO_TELEGRAM_SIGNALS: Array.isArray(digest?.signals) ? digest.signals : null,
  [CONSENSUS_KEY]: consensus, __aioSharedArtifacts: { [CONSENSUS_KEY]: { loadedAt: Date.now(), failedAt: 0, inFlight: null } }
};
const screenTool = registry.CHAT_TOOLS.find((tool) => tool.name === 'screen');
const runScreenTool = (args) => registry.runTool('screen', JSON.stringify(args), { root, now: asOfMs });
const spec = (extra) => ({ symbols: [], market: 'US', sizes: [], sector: null, theme: null, index: null, conditions: [], sort: 'marketCap', order: 'desc', limit: 12, ...extra });
const bySymbol = new Map(rows.map((row) => [row.sym, row]));
const input = typeof screenerQuery.screenerInput === 'function' ? screenerQuery.screenerInput(root, { now: asOfMs }) : null;
const read = input?.read;
const usRows = rows.filter((row) => !/\.K[SQ]$/.test(row.sym));
const offered = screenTool?.parameters?.properties?.conditions?.items?.properties?.id?.enum || [];
const report = () => {
  const failed = failures.splice(0);
  if (!failed.length) return;
  console.error(`chat-screen-tool: ${failed.length} failed, ${checks.length} passed`);
  failed.forEach((failure) => console.error(`  FAIL ${failure}`));
  process.exit(1);
};

// v60.50: whether the committed screener carries the rows and the fields the offered conditions read is a data section
// (it also runs in a data run); the tool's behaviour on those rows is a code test that borrows them as realistic input.
await runSections('chat-screen-tool', [
['committed-screener', async () => {
await check('v60.41 the committed artifact builds browser rows with no live market cap (the size the old reader used)', () => {
  assert.ok(rows.length > 500, `v60.41 rows ${rows.length}`);
  assert.equal(rows.filter((row) => row.mcap != null).length, 0, 'v60.41 a row carries a live mcap; the size-only check below would not prove the reference-cap path');
});
await check('v60.41 every condition the tool offers evaluates on at least one row of the committed data', () => {
  assert.equal(typeof read, 'function', 'v60.41 screenerInput(root).read');
  const coverage = conditionCoverage(rows, offered.map((id) => ({ id })), read);
  const empty = coverage.filter((entry) => entry.withData === 0).map((entry) => entry.id);
  assert.deepEqual(empty, [], `v60.41 no row carries data for ${empty.join(', ')}`);
});
report();
}, 'data'],
['screen-tool', async () => {
await check('v60.41 the screen tool schema is strict: every object closes its properties and requires all of them', () => {
  const walk = (node, path) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'object') {
      assert.equal(node.additionalProperties, false, `v60.41 ${path} additionalProperties`);
      assert.deepEqual([...node.required].sort(), Object.keys(node.properties).sort(), `v60.41 ${path} required`);
      Object.entries(node.properties).forEach(([key, value]) => walk(value, `${path}.${key}`));
    }
    if (node.items) walk(node.items, `${path}[]`);
  };
  walk(screenTool?.parameters, 'screen');
  assert.ok(screenTool.parameters.properties.conditions, 'v60.41 the tool takes structured conditions, not a sentence');
});

await check('v60.41 the tool offers the screener condition ids, without the cash conditions it cannot load', () => {
  const ids = CUSTOM_CONDITIONS.map((item) => item.id);
  assert.ok(offered.length >= 28 && offered.every((id) => ids.includes(id)), `v60.41 offered ${offered.length}`);
  assert.deepEqual(ids.filter((id) => !offered.includes(id)).sort(), ['capex-intensity-max', 'fcf-margin-min'], 'v60.41 ids.filter id offered.includes id .sort');
  for (const id of offered) assert.ok(screenTool.parameters.properties.conditions.description.includes(`${id}: `), `v60.41 description names ${id}`);
});

const PE_RET3M = [{ id: 'pe-max', value: 20, strict: false }, { id: 'ret3m-min', value: 0, strict: true }];
const satisfies = (row, conditions) => conditions.every((condition) => evaluateCondition(condition, row, read) === true);
await check('v60.41 PER 20 이하 + 3개월 상승 + 미국 대형주 returns rows that all meet every condition', async () => {
  const out = await runScreenTool(spec({ sizes: ['MEGA', 'LARGE'], conditions: PE_RET3M }));
  assert.ok(out.ok, `v60.41 the tool call succeeds: ${out.text}`);
  const expected = usRows.filter((row) => ['MEGA', 'LARGE'].includes(capBucketOf(row)) && satisfies(row, PE_RET3M));
  assert.ok(expected.length > 0, 'v60.41 the committed data has matching rows');
  assert.equal(out.entities.length, Math.min(12, expected.length), `v60.41 rows ${out.entities.length} of ${expected.length}`);
  for (const sym of out.entities) {
    const row = bySymbol.get(sym);
    assert.ok(row && satisfies(row, PE_RET3M) && ['MEGA', 'LARGE'].includes(capBucketOf(row)), `v60.41 ${sym} fails a condition`);
    assert.ok(read(row, 'pe') > 0 && read(row, 'pe') <= 20 && read(row, 'ret3m') > 0, `v60.41 ${sym} pe ${read(row, 'pe')} ret3m ${read(row, 'ret3m')}`);
  }
  assert.match(out.text, new RegExp(`일치 ${expected.length}종목`), 'v60.41 out.text');
  assert.match(out.text, /PER 20배 이하/, 'v60.41 out.text');
  assert.match(out.text, /3개월 수익률 0% 초과/, 'v60.41 out.text');
  // Sorted by the size the screener's filter reads, largest first.
  const sizes = out.entities.map((sym) => capFilterValue(bySymbol.get(sym)));
  assert.deepEqual(sizes, [...sizes].sort((a, b) => b - a), 'v60.41 sizes');
});

await check('v60.41 a size-only screen returns rows (unknown size is not small, and the reference cap is the size)', async () => {
  for (const size of ['MEGA', 'LARGE', 'MID', 'SMALL']) {
    const expected = usRows.filter((row) => capBucketOf(row) === size).length;
    if (!expected) continue;
    const out = await runScreenTool(spec({ sizes: [size] }));
    assert.ok(out.ok && out.entities.length === Math.min(12, expected), `v60.41 ${size}: ${out.entities.length} of ${expected}`);
    assert.ok(out.entities.every((sym) => capBucketOf(bySymbol.get(sym)) === size), `v60.41 every row sits in ${size}`);
  }
  const sentence = screenerQuery.runScreen(screenerQuery.readScreenSentence('대형주'), input);
  assert.ok(sentence.totalMatched > 0, `v60.42 sentence 대형주 matched ${sentence.totalMatched}`);
});

await check('v60.42 named stocks read their screener rows from both markets, with the row values the 종목 screen shows', async () => {
  const out = await runScreenTool(spec({ symbols: ['NVDA', '005930.KS', 'ZZZZNOPE'], market: 'US', sizes: ['SMALL'] }));
  assert.ok(out.ok, 'v60.42 the named screen runs');
  assert.deepEqual([...out.entities].sort(), ['005930.KS', 'NVDA'], 'v60.42 both markets are read and the size scope is not applied');
  const nvda = bySymbol.get('NVDA');
  assert.ok(out.text.includes(`PER ${Number(read(nvda, 'pe')).toFixed(1)}`), 'v60.42 the row PER is the screener PER');
  assert.ok(out.text.includes('매출 성장률(최근 4개 분기) ') && /50일선 대비 [+-]/.test(out.text), 'v60.42 the detail fields are stated with their basis');
  assert.ok(out.text.includes('종목 DB에 없는 종목: ZZZZNOPE'), 'v60.42 an unknown symbol is named, not dropped silently');
  const plain = await runScreenTool(spec({ limit: 3 }));
  assert.ok(!/50일선 대비/.test(plain.text), 'v60.42 a condition screen keeps its compact rows');
});

// v60.42: the prompt of every turn, which always carries the tools. On the live site (v60.41) a two-stock comparison was sent 60K
// characters of instructions, most of it reference material the question did not need.
await check('v60.42 a tool turn is sent the short prompt: the named stocks\' rows, no reference packets, under 9K characters', async () => {
  const { composeLeanPrompt } = await import('../src/ai/prompt/lean-prompt.js');
  const { buildAnswerPrinciples } = await import('../src/ai/response/answer-principles.js');
  const lean = composeLeanPrompt({ root, screenTitle: '종목', tickers: ['NVDA', '005930.KS'], screenBasis: 'S&P 500 종가 6,700.12 (11월 20일)', profile: '' });
  assert.equal(lean.stockRows, true, 'v60.42 the named stocks are in the prompt');
  assert.ok(lean.prompt.includes(`PER ${Number(read(bySymbol.get('NVDA'), 'pe')).toFixed(1)}`) && lean.prompt.includes('005930.KS'), 'v60.42 the prompt rows are the screener rows of both stocks');
  assert.ok(lean.prompt.includes('S&P 500 종가 6,700.12'), 'v60.42 the screen reading is carried');
  assert.equal(composeLeanPrompt({ root, tickers: [] }).stockRows, false, 'v60.42 no named stock, no rows');
  const principles = buildAnswerPrinciples({ today: '2026-11-21', hasTickers: true, liveStatus: '종가 기준', webSearch: true });
  assert.ok(principles.includes('위에 없으면 도구로 읽는다') && !principles.includes('관련 뉴스 없음') && !principles.includes('미주입'), 'v60.42 a tool turn is not told that news or trend is absent');
  const whole = registry.toolsPromptBlock({ functions: true, webSearch: true }) + lean.prompt + principles;
  assert.ok(whole.length < 9000, `v60.42 the head, rows and principles are ${whole.length} characters`);
  const chat = readFileSync(new URL('../src/ui/chat/panel.js', import.meta.url), 'utf8');
  const sendStart = chat.indexOf('async function chatSendUnified(');
  const send = chat.slice(sendStart, chat.indexOf('\nasync function ', sendStart + 10) > 0 ? chat.indexOf('\nasync function ', sendStart + 10) : chat.indexOf('\nfunction ', sendStart + 10));
  assert.ok(sendStart >= 0 && send.length > 5000, 'v60.42 chatSendUnified is found');
  assert.ok(send.includes('sysPrompt = _uniLeanBase.prompt;'), 'v60.42 every turn starts from the short prompt');
  for (const call of ['_getImportedResearchContext', '_uniKnowledgeOrchestrator', '_fetchTickerDataForChat', '_fetchTechnicalDataForChat', '_buildNewsContext', '_buildChatIntentContext', '_buildChatAnswerCoverageContext', '_buildAioIntegratedAnswerContext', '_aioBuildAIClaimEvidenceRegistry', 'ctx.system(', '_fetchSectorCompareData', '_fetchDeepCompareData', '_uniLean ']) {
    assert.ok(!send.includes(call), `v60.42 chatSendUnified pre-injects nothing the tools read: ${call}`);
  }
  assert.ok(chat.includes("    if (typeof _aioDomainContextForQuestion === 'function') {") && lean.prompt.includes('기회비용') && lean.prompt.includes('시나리오'), 'v60.42 the scenario and decision-frame reading stays on a tool turn');
  const { chatToolKit } = await import('../src/ai/tools/loop.js');
  assert.deepEqual(chatToolKit({}).usedEvidence([{ name: 'technicals', ok: true }, { name: 'news', ok: false }, { name: 'consensus', ok: true }]), { ticker: true, fundamentals: false, technical: true, news: false }, 'v60.42 the evidence badges follow the tool calls that succeeded');
  assert.ok(send.includes('var _uniTools = window.AIO && window.AIO.chatTools ? window.AIO.chatTools : null;') && !/chatTools\.offer\b/.test(chat), 'v60.42 the tools travel with every turn, in every answer mode');
});

await check('v60.41 과매도 reads as the screener RSI condition, never a SELL-signal filter', () => {
  const result = screenerQuery.runScreen(screenerQuery.readScreenSentence('과매도 종목'), input);
  assert.ok(result.matched, 'v60.42 the sentence runs');
  assert.ok(!result.criteria.some((label) => /시그널|SELL/.test(label)), `v60.42 no signal criterion: ${result.criteria.join(' | ')}`);
  assert.deepEqual(result.spec.conditions, [{ id: 'rsi-max', value: 30 }], 'v60.42 result.spec.conditions');
  assert.ok(result.rows.every((row) => row.rsi != null && row.rsi <= 30), 'v60.42 result.rows.every row row.rsi null row.rsi 30');
  assert.ok(!/시그널/.test(screenerQuery.formatScreenResult(result)), 'v60.42 시그널 .test formatScreenResult');
});

await check('v60.41 an impossible combination returns 0 and the coverage names the condition that removed everything', async () => {
  const out = await runScreenTool(spec({ conditions: [{ id: 'pe-max', value: 0.5, strict: false }, { id: 'ret3m-min', value: 0, strict: true }] }));
  assert.ok(out.ok, `v60.41 the tool call succeeds: ${out.text}`);
  assert.deepEqual(out.entities, [], 'v60.41 out.entities');
  assert.match(out.text, /일치 0종목/, 'v60.41 out.text');
  assert.match(out.text, /결과 없음: 통과 0: PER 0\.5배 이하/, 'v60.41 out.text');
  assert.doesNotMatch(out.text, /결과 없음:[^\n]*3개월 수익률/, 'v60.41 out.text');
  const noData = await runScreenTool(spec({ market: 'KR', sizes: ['LARGE'] }));
  assert.ok(noData.ok && /시가총액 자료가 없어/.test(noData.text), 'v60.41 KR size names the missing data');
});

await check('v60.42 the prompt injects no sentence screen; a broad ask keeps the comparison sample', () => {
  assert.equal(screenerQuery.buildScreenerAiContext('RSI 30 이하 기술주', [], input).prompt, '', 'v60.42 a condition sentence is left to the screen tool');
  const broad = screenerQuery.buildScreenerAiContext('종목 추천해줘', [], input);
  assert.ok(broad.result?.mode === 'diversified-recommendation', `v60.41 broad question mode ${broad.result?.mode}`);
  assert.match(broad.prompt, /종목 비교 표본/, 'v60.41 broad.prompt');
});

// v60.41: money_flow, the 테마 screen's sector bars and theme stages for the chat. The root is the browser's: the committed
// screener rows above, the themes slice from the themes provider (rotation artifact in data.json, RRG_SECTORS and THEME_MAP
// from js/aio-pages.js), and the shared interpretation's inputs from the committed history and scenario artifacts. The
// expected values are the screen's selectors on that root; without the tool every block below fails.
const themeMaps = loadThemeMaps();
const marketData = readData('data.json');
const flowItems = normalizeThemes(createThemesProvider({
  readRotationHistory: () => marketData?.rotationHistory || null,
  readDefinitions: () => ({ sectors: classicLiteral('js/aio-pages.js', 'var RRG_SECTORS = [', '\n];'), subsectors: classicLiteral('js/aio-pages.js', 'var RRG_SUBSECTORS = [', '\n];'), themes: themeMaps.usThemes }),
  readScreenerRows: () => rows, now: () => asOfMs
}).readCurrent()).items;
const flowRoot = {
  _aioHistory: readHistoryRows(readData('history.json')), _aioMacroHistory: readData('macro-history.json'), _aioServerMacro: marketData?.macro || null, DATA_SNAPSHOT: {},
  THEME_MAP: themeMaps.usThemes, KR_THEME_MAP: themeMaps.krThemeMap, KR_STOCK_DB: classicLiteral('js/aio-kr-data.js', 'var KR_STOCK_DB = {', '\n};') || {},
  _serverDataMeta: { rotationHistory: marketData?.rotationHistory || null },
  [SCENARIO_OUTCOMES.key]: readData('scenario-outcomes.json'), [SCENARIO_STATE.key]: readData('scenario-state.json')
};
registerInterpretationStore(flowRoot, { getState: () => ({ screener: { rows }, themes: { items: flowItems } }) });
const flow = await import('../src/data/selectors/theme-flow.js').catch(() => null);
const playbook = marketInterpretation(flowRoot, { nowMs: asOfMs }).playbook;
const runFlow = (args) => registry.runTool('money_flow', JSON.stringify({ market: 'ALL', level: 'overview', theme: null, ...args }), { root: flowRoot, now: asOfMs });
const flowTool = registry.CHAT_TOOLS.find((tool) => tool.name === 'money_flow');
const flowCap = Math.min(registry.TOOL_TEXT_HARD_CAP, flowTool?.maxChars || registry.TOOL_TEXT_DEFAULT_CAP);
const pctText = (value, digits = 1) => `${signedText(value, digits)}%`;
const stageWord = (state) => (THEME_STATES[state] ? THEME_STATES[state].split(' (')[0] : '판정 보류');
const lineOf = (text, head) => text.split('\n').find((line) => line.startsWith(head)) || '';

// v60.51: a market whose themes carry no stage is a legitimate state when, and only when, the playbook says why: its
// benchmark's latest close is a session behind the theme basis (the screener landed before the index close, as on 11/23
// when RSP's 11/23 close arrived after the screener's). Two refresh-screener runs were blocked on that state. Malformed
// rows, an unexplained empty market or a hold the history does not back still fail.
const MARKETS = ['US', 'KR'];
const themesIn = (market) => (playbook?.themes || []).filter((row) => row.market === market);
const benchmarkHeld = (market) => {
  const list = themesIn(market);
  const basis = playbook?.asOfByMarket?.[market] || null;
  const benchAsOf = playbook?.benchmarks?.[market]?.asOf || null;
  return list.length > 0 && !list.some((row) => row.state) && !!basis && !!benchAsOf && benchAsOf < basis
    && list.every((row) => row.held?.reason === 'benchmark-lag' && row.held.benchmarkAsOf === benchAsOf && /^판정 보류/.test(row.stateLabel));
};
const heldMarkets = new Set(MARKETS.filter(benchmarkHeld));
await check('v60.41 the committed data gives the 테마 screen 11 sector bars and US and Korean theme stages (v60.51: or a stated benchmark-lag hold)', () => {
  assert.ok(flow, 'v60.41 src/data/selectors/theme-flow.js');
  assert.equal(flow.viewItems(flowItems, 'sectors').length, 11, 'v60.41 flow.viewItems flowItems sectors .length');
  assert.ok(playbook?.available && Array.isArray(playbook.themes), 'v60.41 playbook available');
  for (const row of playbook.themes) {
    const at = `${row?.market}:${row?.id}`;
    assert.ok(MARKETS.includes(row?.market) && typeof row.id === 'string' && row.id && typeof row.label === 'string' && row.label, `v60.51 ${at} market, id and label`);
    assert.ok(row.state == null || Object.prototype.hasOwnProperty.call(THEME_STATES, row.state), `v60.51 ${at} state ${row.state} is a THEME_STATES key`);
    assert.ok(typeof row.stateLabel === 'string' && (row.state ? !/^판정 보류/.test(row.stateLabel) : /^판정 보류/.test(row.stateLabel)), `v60.51 ${at} stateLabel matches its state: ${row.stateLabel}`);
    assert.ok(Number.isFinite(row.ret1m), `v60.51 ${at} ret1m`);
  }
  for (const market of MARKETS) {
    assert.ok(themesIn(market).length > 0, `v60.41 ${market} themes`);
    assert.ok(themesIn(market).some((row) => row.state) || heldMarkets.has(market),
      `v60.41 playbook stages: ${market} has no staged theme and no benchmark-lag hold (basis ${playbook.asOfByMarket?.[market]}, benchmark ${playbook.benchmarks?.[market]?.asOf})`);
  }
  if (heldMarkets.size) console.log(`chat-screen-tool: theme stages held for ${[...heldMarkets].map((m) => `${m} (benchmark ${playbook.benchmarks[m].asOf} < basis ${playbook.asOfByMarket[m]})`).join(', ')}`);
});

await check('v60.41 money_flow is registered with a strict schema (market, level, theme)', () => {
  assert.ok(flowTool, 'v60.41 money_flow is registered');
  const { parameters } = flowTool;
  assert.equal(parameters.additionalProperties, false, 'v60.41 parameters.additionalProperties');
  assert.deepEqual([...parameters.required].sort(), ['level', 'market', 'theme'], 'v60.41 ...parameters.required .sort');
  assert.deepEqual(parameters.properties.level.enum, ['overview', 'theme'], 'v60.41 parameters.properties.level.enum');
  assert.deepEqual(parameters.properties.market.enum, ['ALL', 'US', 'KR'], 'v60.41 parameters.properties.market.enum');
  assert.match(registry.toolsPromptBlock(), /섹터·테마 강약과 테마 구성 종목/, 'v60.41 registry.toolsPromptBlock');
});

await check('v60.41 overview lists the sector bars in the screen order with the screen figures, then every theme under its stage', async () => {
  const out = await runFlow({});
  assert.ok(out.ok, `v60.41 the tool call succeeds: ${out.text}`);
  assert.ok(out.text.length <= flowCap && !/이하 생략/.test(out.text), `v60.41 length ${out.text.length} of ${flowCap}`);
  const byRow = new Map(rows.map((row) => [String(row.sym).toUpperCase(), row]));
  const mode = flow.sectorPeriodMode(flowItems, byRow);
  const ranked = flow.rankSectorPeriod(flow.viewItems(flowItems, 'sectors'), byRow, mode, { close: flow.usCloseSession(flowRoot) }).rows.filter((row) => row.pct != null);
  const digits = mode === '1d' || mode === '1w' ? 2 : 1;
  const sectorLine = out.text.split('\n')[out.text.split('\n').findIndex((line) => line.startsWith('미국 섹터 ')) + 1] || '';
  const positions = ranked.map((row) => sectorLine.indexOf(`${flow.themeItemLabel(flowRoot, row.item)} ${row.symbol} ${pctText(row.pct, digits)}`));
  assert.ok(ranked.length >= 6 && positions.every((at) => at >= 0), `v60.41 sector figures: ${sectorLine.slice(0, 200)}`);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b), 'v60.41 sector order');
  assert.ok(out.text.indexOf('미국 테마 단계') < out.text.indexOf('한국 테마 단계'), 'v60.41 US first, then 한국');
  for (const market of ['US', 'KR']) {
    const block = out.text.slice(out.text.indexOf(`${market === 'KR' ? '한국' : '미국'} 테마 단계`));
    for (const row of playbook.themes.filter((item) => item.market === market)) {
      const line = lineOf(block, `- ${stageWord(row.state)} `);
      assert.ok(line.includes(`${row.label}[${row.id}] 1개월 ${pctText(row.ret1m)}`), `v60.41 ${market} ${row.id} under ${stageWord(row.state)}`);
    }
    assert.match(out.asOf, new RegExp(`${market === 'KR' ? '한국' : '미국'} 테마 ${playbook.asOfByMarket[market]}`), 'v60.41 out.asOf');
  }
});

// The strongest staged theme; in a market held for benchmark lag (above) the strongest held one, whose detail must still
// list its members and print the hold the screen shows. No theme means the premise above failed: say so instead of crashing.
const themeOf = (market) => {
  const theme = themesIn(market).filter((row) => row.state || heldMarkets.has(market)).sort((a, b) => b.ret1m - a.ret1m)[0];
  assert.ok(theme, `v60.51 no ${market} theme with a stage or a stated hold — see the theme-stage check above`);
  return theme;
};
await check('v60.41 theme detail returns only that theme\'s members, by 3-month return, with the stage the screen shows', async () => {
  for (const market of MARKETS) {
    const theme = themeOf(market);
    const out = await runFlow({ market, level: 'theme', theme: theme.id });
    assert.ok(out.ok, `v60.41 the tool call succeeds: ${out.text}`);
    assert.ok(out.text.length <= flowCap, 'v60.41 out.text.length flowCap');
    const listed = market === 'US'
      ? new Set([...(themeMaps.usThemes.find((item) => item.id === theme.id)?.subThemes || []).flatMap((sub) => sub.tickers), ...(themeMaps.usThemes.find((item) => item.id === theme.id)?.leaders || [])].map((sym) => sym.toUpperCase()))
      : new Set((themeMaps.krThemeMap[theme.id] || []).flatMap((member) => [`${member.code}.KS`, `${member.code}.KQ`]));
    assert.ok(out.entities.length >= 3 && out.entities.length <= 10, `v60.41 ${theme.id} entities ${out.entities.length}`);
    assert.ok(out.entities.every((sym) => listed.has(sym)), `v60.41 ${theme.id}: ${out.entities.filter((sym) => !listed.has(sym)).join(', ')} not in the member list`);
    // Spread: the KR member list is a literal evaluated in another realm, and its arrays carry that realm's prototype.
    const ret3m = [...out.entities].map((sym) => readRowNumber(bySymbol.get(sym), 'ret3m', 'display'));
    assert.deepEqual(ret3m, [...ret3m].sort((a, b) => b - a), `v60.41 ${theme.id} order`);
    assert.ok(out.text.includes(`단계: ${theme.stateLabel}`) && out.text.includes(`1개월 ${pctText(theme.ret1m)}`), `v60.41 ${theme.id} stage`);
    assert.match(out.text, new RegExp(`1\\. ${out.entities[0].replace('.', '\\.')}[^\\n]*3개월 ${pctText(ret3m[0]).replace('+', '\\+')}`), 'v60.41 out.text');
  }
  const us = themeOf('US');
  const byName = await runFlow({ market: 'US', level: 'theme', theme: us.label });
  assert.ok(byName.ok && byName.text.includes(`[${us.id}]`), `v60.41 the Korean name ${us.label} resolves to ${us.id}`);
});

await check('v60.41 an unknown theme is an error that lists the valid names', async () => {
  const out = await runFlow({ level: 'theme', theme: '없는테마xyz' });
  assert.equal(out.ok, false, 'v60.41 out.ok');
  assert.match(out.text, /없는 테마입니다/, 'v60.41 out.text');
  assert.ok(out.text.includes(`(${themeOf('US').id})`) && out.text.includes(`(${themeOf('KR').id})`), `v60.41 the error lists valid ids: ${out.text.slice(0, 200)}`);
});

report();
}, 'code'],
]);
console.log(`chat-screen-tool: ${checks.length} checks passed (${rows.length} rows, ${offered.length} conditions offered)`);
