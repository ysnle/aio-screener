#!/usr/bin/env node
// v60.19 (decision frame): behavioural checks of the shared frame — likelihood beside its base and sample, payoff against
// an ordinary day, cash and index as the opportunity cost, the cost of being wrong, and the ground of the favoured side.
//   producer  buildScenarioOutcomes on a small synthetic history writes base quartiles, drawdown and cash fields
//   frame     buildDecisionFrame on fixtures: distinct / not distinct, n < 10, 10–29, missing quartiles, conflict, past-record
//   copy      the shared renderer and the 시장 상태 story cards keep the ground of every favoured side inside the frame —
//             v60.24 (owner 2026-11-17): in its fold (근거 종류) and the side line's title, no longer as a face tag
//   artifact  the committed scenario-outcomes.json is read only under its stamps (old definition → no long record)
// DECISION_FRAME_NARRATIVES=<module path> mounts another market-narratives renderer (the negative control on the old one).
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => import(pathToFileURL(path.isAbsolute(rel) ? rel : path.join(root, rel)).href);
const failures = [];
const check = (name, ok, detail = '') => { if (!ok) failures.push(`${name}${detail ? ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`); };

const { BRANCH_ANALOGS } = await load('src/domain/scenarios/analogs.js');
const { windowDrawdown } = await load('src/domain/scenarios/outcome-history.js');
const { buildScenarioOutcomes } = await load('scripts/build-scenario-outcomes.mjs');
const { buildDecisionFrame, decisionFrameText, decisionFrameContext, branchDecisionFrame } = await load('src/domain/scenarios/decision-frame.js');
const { depthReached } = await load('src/domain/scenarios/correction-base-rates.js');
const { currentScenarioOutcomes, scenarioOutcomeFingerprints } = await load('src/domain/scenarios/outcome-fingerprints.js');
const { buildMacroCrossroads } = await load('src/domain/market/regime/macro-crossroads.js');

// ── producer ──
{
  check('v60.19windowDrawdown is the deepest later close against the case close, 0 when none is lower', Math.abs(windowDrawdown([100, 103, 95, 99], 0, 3) + 5) < 1e-9 && windowDrawdown([100, 101, 102], 0, 2) === 0 && Math.abs(windowDrawdown([100, 90, 80], 0, 1) + 10) < 1e-9);
  const day0 = Date.UTC(1995, 0, 2);
  const dates = Array.from({ length: 1400 }, (_, i) => new Date(day0 + i * 86400000).toISOString().slice(0, 10));
  const series = (fn) => dates.map((date, i) => [date, fn(i)]);
  // VIX spikes above 30 every 200 sessions; the S&P 500 dips 8% inside the next 20 sessions and recovers past its start.
  const spx = series((i) => { const k = i % 200; return 100 + i * 0.02 + (k > 2 && k < 12 ? -8 * Math.sin((k - 2) / 10 * Math.PI) : 0) + (k >= 12 && k < 22 ? 1.5 : 0); });
  const vix = series((i) => (i % 200 === 2 ? 34 : 16));
  const months = [...new Set(dates.map((date) => date.slice(0, 7)))];
  const fedFunds = months.map((month) => [month, 5]);
  const body = buildScenarioOutcomes({ market: { spx, vix, tnx: series(() => 4) }, fedFunds });
  const vol = body.branches.volshock;
  check('v60.19producer: the branch record carries base quartiles, drawdown and cash fields', vol && ['baseP25', 'baseMedian', 'baseP75', 'dd5', 'mddMedian', 'baseDd5Pct', 'baseMddMedian', 'cashMedian'].every((key) => Number.isFinite(vol[key])), vol);
  check('v60.19producer: every VIX spike case fell 5% or more inside its window, the ordinary day rarely did', vol && vol.dd5 === vol.n && vol.baseDd5Pct < 50, vol && { n: vol.n, dd5: vol.dd5, base: vol.baseDd5Pct });
  check('v60.19producer: cash over 20 sessions at a 5% policy rate is 5 × 20 / 252', vol && Math.abs(vol.cashMedian - 0.4) < 0.005, vol?.cashMedian);
  check('v60.19producer: cases do not overlap (one per 200-session spike)', vol && vol.n === 6, vol?.n);
  check('v60.19producer: the 63-session record keeps its own base and drawdown fields', vol?.h63 && Number.isFinite(vol.h63.baseMedian) && Number.isFinite(vol.h63.dd5) && vol.h63.horizon === 63 && vol.h63.label === undefined, vol?.h63);
  const noCash = buildScenarioOutcomes({ market: { spx, vix, tnx: series(() => 4) } }).branches.volshock;
  check('v60.19producer: without the policy-rate series the cash leg is absent, not guessed', noCash && noCash.cashMedian === undefined);
  const etf = series((i) => 50 + i * 0.03 + 4 * Math.sin(i / 30));
  const themed = buildScenarioOutcomes({ market: { spx, vix, tnx: series(() => 4) }, proxies: { SMH: etf }, themeProxy: { semiconductor: 'SMH' } }).themes.semiconductor;
  const stage = Object.values(themed || {}).find((row) => row?.n >= 1);
  check('v60.19producer: a theme stage record carries its own-price drawdown and the excess base quartiles', stage && Number.isFinite(stage.dd5) && Number.isFinite(stage.baseMedian) && stage.outcome === 'excess', stage);
}

// ── frame ──
const record = (extra = {}) => ({ n: 73, up: 41, median: 1.0, p25: -1.2, p75: 2.7, horizon: 20, baseN: 9187, baseUpPct: 64, baseP25: -1.0, baseMedian: 1.3, baseP75: 3.1, dd5: 9, mddMedian: -1.8, baseDd5Pct: 14, baseMddMedian: -1.5, cashMedian: 0.25, ...extra });
const cash = { value: 3.88, date: '2026-11-13', label: 'SOFR' };
{
  const plain = buildDecisionFrame({ record: record(), favored: ['hold', 'stage'], why: '성장 기대형 금리 상승', invalidation: ['물가 재가속'], cash });
  const text = decisionFrameText(plain);
  check('v60.19frame: 56% against a 64% base over 73 cases is not distinct and says so beside the base', plain.likelihood.distinct === false && /56%\(73번 중 41번\), 평소 64% — 평소와 구별 안 됨/.test(text.face[0]), text.face[0]);
  check('v60.24frame: a rule-table favourite whose record is not distinct stands on 비용 가설 — named in the ground note, not in the side tag', plain.favoured.ground === 'cost-hypothesis' && text.groundLabel === '비용 가설' && text.tag === '보유 유지, 분할 접근' && /^비용 가설 — .*과거 성과로 확인한 우위가 아닙니다/.test(text.ground), text);
  check('v60.19frame: payoff is two magnitudes beside an ordinary day, never one ratio or an expected value', /좋았던 25%는 \+2\.7% 이상, 나빴던 25%는 -1\.2% 이하 \(평소 \+3\.1% \/ -1\.0%\)/.test(text.face[1]) && !/손익비|기대값|배 유리/.test(JSON.stringify(text)), text.face[1]);
  check('v60.19frame: cash over the same sessions from today\'s rate and the case months\' median', plain.opportunity.cashReturn === 0.31 && /현금 약 \+0\.31%/.test(text.opportunity[0]) && /\+0\.25%/.test(text.opportunity[1]), text.opportunity);
  check('v60.19frame: the cost of being wrong is the drawdown share beside the base', plain.wrong.cost.drawdownShare === 12 && /-5% 넘게 빠진 경우 12%\(73번 중 9번\), 평소 14%/.test(text.wrong[1]), text.wrong);
  check('v60.19frame: the face is at most two lines', text.face.length === 2);
  const distinct = buildDecisionFrame({ record: record({ n: 120, up: 96, baseUpPct: 64 }), favored: ['stage'], why: 'x', cash });
  check('v60.19frame: a distinct record at 30+ cases on the favourite\'s side is 과거 기록', distinct.likelihood.distinct === true && distinct.favoured.ground === 'past-record' && decisionFrameText(distinct).groundLabel === '과거 기록');
  const against = buildDecisionFrame({ record: record({ n: 120, up: 96 }), favored: ['wait', 'defend'], why: 'x' });
  check('v60.19frame: a distinct record against a defensive favourite is a conflict, ground stays 비용 가설', against.favoured.conflict?.lean === 'defensive' && against.favoured.ground === 'cost-hypothesis' && /과거 표본과 어긋남/.test(decisionFrameText(against).conflict));
  const small = buildDecisionFrame({ record: record({ n: 20, up: 16, dd5: 3 }), favored: ['stage'], why: 'x' });
  check('v60.19frame: 10–29 cases give figures marked 참고 and never 과거 기록', small.likelihood.strength.reference && /· 참고/.test(decisionFrameText(small).face[0]) && small.favoured.ground === 'cost-hypothesis');
  const thin = buildDecisionFrame({ record: record({ n: 7, up: 5, dd5: 2 }), favored: ['wait'], why: 'x' });
  const thinText = decisionFrameText(thin);
  check('v60.24frame: under 10 cases counts only on a one-line face — no share, no payoff, no drawdown share, no sample note', !/%\(/.test(thinText.face[0]) && /7번 중 5번/.test(thinText.face[0]) && thin.payoff === null && thin.wrong.cost === null && thinText.face.length === 1 && !/사례가 적어|말하지 않/.test(thinText.face.join(' ')), thinText);
  check('v60.24frame: a thin record\'s sample note is the evidenceStrength note for the fold, and the AI line still carries it', thinText.sample === '사례 7개라 비율·평균으로 말하지 않습니다.' && decisionFrameContext(thin).includes(thinText.sample), thinText.sample);
  const bare = buildDecisionFrame({ record: { n: 40, up: 30, horizon: 20, baseUpPct: 64, median: 2 }, favored: ['hold'], why: 'x' });
  const bareText = decisionFrameText(bare);
  check('v60.19frame: missing quartiles, drawdown and cash give 없음 legs, nothing estimated', bare.payoff === null && bare.wrong.cost === null && /이익·손실 폭: 없음/.test(bareText.face[1]) && bareText.opportunity.join() === '기회비용: 없음' && bare.missing.includes('payoff') && bare.missing.includes('wrong'), bareText);
  const none = buildDecisionFrame({ record: null, favored: [], why: '' });
  check('v60.19frame: no record and no favourite', none.likelihood === null && none.favoured.ground === 'none' && /과거 기록 없음/.test(decisionFrameText(none).face[0]));
  const traded = buildDecisionFrame({ record: record({ n: 69, up: 60, median: 3.5, dd5: 27 }), favored: ['stage', 'wait'], why: 'x' });
  check('v60.19frame: better odds with deeper dips is named with both halves', traded.tradeoff === 'better-odds-deeper-dips' && /크게 빠진 경우도 평소보다 많았습니다/.test(decisionFrameText(traded).tradeoff));
  const ai = decisionFrameContext(plain);
  check('v60.19frame: the AI line carries every leg and names the ground', /가능성:/.test(ai) && /이익·손실 폭:/.test(ai) && /기회비용:/.test(ai) && /틀렸을 때/.test(ai) && /근거 종류: 비용 가설, 과거 성과로 확인한 우위 아님/.test(ai), ai);
  const excess = buildDecisionFrame({ record: record({ outcome: 'excess', horizon: 63 }), favored: ['hold'], why: 'x' });
  check('v60.19frame: an index-relative record reads 지수보다 and %p, with the index itself as the zero', /지수보다 더 오른/.test(decisionFrameText(excess).face[0]) && /%p/.test(decisionFrameText(excess).face[1]) && excess.opportunity.indexBaseMedian === 0);
  const reached = depthReached({ rule: { bearPct: 20 }, events: [['a', -8, 1, 0], ['b', -12, 1, 0], ['c', -25, 0, 1], ['d', -30, 1, 1], ['e', -13, 0, 0]] }, -11.9, { fast: true });
  check('v60.19corrections: counted among those that reached today\'s depth, and among the same speed', reached.n === 4 && reached.bear === 2 && reached.fastN === 2 && reached.fastBear === 1 && /-11\.9% 이상 내려갔던 과거 조정은 4번 중 2번/.test(reached.text), reached);
}

// ── copy ──
const { createFakeDocument } = await load('scripts/lib/fake-dom.mjs');
const signals = { vix: 34, vixRatio: 1.08, spx5: -5, breadth: 'burden', credit: 'burden', hyBp: 520, nfci: 0.2, soxxRel20: -9, payroll3: 40, payrollPrior3: 90, hy20: 60, claimsUp: 25 };
const outcomes = { fingerprints: scenarioOutcomeFingerprints(), sourceLabel: '장기 일봉 기록', from: '1990-01-02', to: '2026-11-13',
  branches: Object.fromEntries(Object.keys(BRANCH_ANALOGS).map((id) => [id, { ...record(), from: '1990-01-02', to: '2026-11-13', label: BRANCH_ANALOGS[id].label }])), themes: {} };
const crossroads = buildMacroCrossroads({ signals, outcomes });
{
  const { decisionFrameBlock, favouredLine } = await load('src/ui/components/decision-frame.js');
  const doc = createFakeDocument();
  const item = crossroads.items.find((row) => row.id === 'volshock');
  const frame = branchDecisionFrame(item, { cash: crossroads.cash || cash });
  const block = decisionFrameBlock(doc, frame, { method: item.past.text });
  const words = block.textContent;
  check('v60.19copy: the branch card frame shows 가능성 and 이익·손실 폭 first, the fold holds 기회비용 and 틀렸을 때', block.children[0].textContent.startsWith('가능성:') && block.children[1].textContent.startsWith('이익·손실 폭:') && /기회비용/.test(words) && /틀렸을 때/.test(words) && /빗나가는 조건/.test(words), words);
  const side = favouredLine(doc, frame);
  const fold = block.querySelector('details')?.textContent || '';
  const face = [...block.children].filter((node) => node.tagName !== 'DETAILS').map((node) => node.textContent).join(' ');
  check('v60.24copy: the favoured side reads the choice and reason; its ground kind is in the frame\'s fold and the line\'s title, not on the face', /^분할 접근, 관망 — /.test(side.textContent) && !/비용 가설|과거 기록/.test(side.textContent) && /^비용 가설 — /.test(side.title)
    && /근거 종류비용 가설 — /.test(fold) && !/비용 가설|근거 종류|사례가 적어/.test(face), { side: side.textContent, face });
  check('v60.19copy: no emoji, no 거시, no 손익비, no question in the frame text', !/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(words) && !/거시|손익비|\?/.test(words), words);
}
{
  const narrativesPath = process.env.DECISION_FRAME_NARRATIVES || 'src/ui/components/market-narratives.js';
  const { renderMarketNarratives } = await load(narrativesPath);
  const axes = { tagName: 'DIV' };
  const doc = createFakeDocument();
  const page = doc.createElement('div');
  const holder = doc.createElement('div');
  const grid = doc.createElement('div'); grid.className = 'mk-axes';
  page.append(holder); holder.append(grid);
  const realQuery = doc.querySelector?.bind(doc);
  doc.querySelector = (selector) => (selector === '#page-signal .mk-axes' ? grid : realQuery?.(selector));
  grid.insertAdjacentElement = grid.insertAdjacentElement || ((where, node) => { holder.insertBefore(node, where === 'beforebegin' ? grid : null); return node; });
  void axes;
  const story = (id, count) => ({ id, label: id, telegramCount: count, recentCount: 1, trend: 'steady', newsCount: 0, rumorCount: 0, unconfirmedCount: 0, movers: [] });
  const root = { _aioMarketDay: null };
  const { MARKET_DAY } = await load('src/data/artifact-registry.js');
  root[MARKET_DAY.key] = { narratives: { at: '2026-11-15T00:00:00Z', windowHours: 72, stories: [story('ai-funding-credit', 9), story('ai-profitability', 7)] } };
  const section = renderMarketNarratives({ documentRef: doc, root, interpretation: { crossroads } });
  const text = section?.textContent || '';
  const favouredMentions = (text.match(/비용이 작은 쪽|비용이 작음|상대적으로 유리/g) || []).length;
  check('v60.19copy: the story cards render their scenarios', /이 시나리오에서 대응별 득실/.test(text), text.slice(0, 200));
  const scenarioBoxes = [...(section?.querySelectorAll('.mk-narr__scenario') || [])].filter((box) => /이 시나리오에서 대응별 득실/.test(box.textContent));
  const sideTexts = [...(section?.querySelectorAll('.df-side, .mk-narr__why') || [])].map((node) => node.textContent);
  check('v60.24copy: every story scenario with a favoured side keeps its ground in the frame fold (근거 종류), the side lines carry no ground tag, and none reads 상대적으로 유리',
    favouredMentions > 0 && !/상대적으로 유리/.test(text) && scenarioBoxes.length > 0 && scenarioBoxes.every((box) => /근거 종류(비용 가설|과거 기록) — /.test(box.querySelector('details')?.textContent || ''))
      && sideTexts.length >= scenarioBoxes.length && sideTexts.every((line) => !/비용 가설|과거 기록/.test(line)), { favouredMentions, scenarios: scenarioBoxes.length, sideTexts });
  check('v60.19copy: the story cards show the past line with its base beside it', /가능성: 20거래일 뒤 오른 경우 \d+%\(73번 중 41번\), 평소 64%/.test(text));
}

// ── v60.24 guide and theme lines (owner 2026-11-17): the ground kind is not glued onto face lines outside the frame ──
{
  const { buildMarketGuide, renderMarketGuideContext } = await load('src/domain/guide/market-guide.js');
  const { buildMarketRegime } = await load('src/domain/briefing/market-read.js');
  const { readHistoryRows } = await load('src/domain/market/indices/history-rows.js');
  const rows = readHistoryRows(JSON.parse(readFileSync(path.join(root, 'public-data/history.json'), 'utf8')));
  const regime = buildMarketRegime({ history: rows, credit: { hyBp: 315, hyDelta5Bp: -9 }, rates: {} });
  const guide = buildMarketGuide({ regime, crossroads, nowMs: Date.parse('2026-11-16T00:00:00Z') });
  const costLines = guide.stance?.avoid?.slice(0, guide.stance.costAvoid) || [];
  const ai = renderMarketGuideContext(guide);
  check('v60.24guide: the 피할 쪽 cost lines read plain on the screen, and the AI block still names their ground (비용 가설)', costLines.length > 0 && costLines.every((line) => /손해가 큰 선택입니다$/.test(line) && !/비용 가설/.test(line))
    && costLines.every((line) => ai.includes(`${line}(비용 가설)`)), { costLines, ai: ai.split('\n').find((line) => line.startsWith('- 지양')) });
  // The 테마 stage header note and the stage choice-table flag, through the view's own builders.
  const { stageNote, stageChoiceTable } = await load('src/ui/components/theme-playbook-view.js');
  const { GROUND_NOTES } = await load('src/domain/scenarios/decision-frame.js');
  const { THEME_STATES } = await load('src/domain/scenarios/analogs.js');
  const doc = createFakeDocument();
  const stage = Object.keys(THEME_STATES)[0];
  const note = stageNote(doc, stage, '보유 유지·관망 2개');
  const flags = [...stageChoiceTable(doc, stage, [{ favored: ['hold', 'wait'] }, { favored: ['wait'] }]).querySelectorAll('.xr-choice-flag')];
  check('v60.24theme: the 테마 stage note and choice flags read without the ground label, which is their title', /조건별 득실로 .*: 보유 유지·관망 2개\.$/.test(note.textContent) && !/비용 가설|과거 기록/.test(note.textContent)
    && note.title === GROUND_NOTES['cost-hypothesis'] && flags.length > 0 && flags.every((flag) => !/비용 가설|과거 기록/.test(flag.textContent) && flag.title === GROUND_NOTES['cost-hypothesis']),
  { note: note.textContent, flags: flags.map((flag) => [flag.textContent, flag.title]) });
}

// ── load order (live 2026-11-16) ──
// 시장 상태 showed one branch with two records: the story section kept the frame it drew from AIO's own closes before
// scenario-outcomes.json arrived ("1번 중 1번 오름"), the scenario section repainted with the long record ("73번 중 41번").
{
  const narrativesPath = process.env.DECISION_FRAME_NARRATIVES || 'src/ui/components/market-narratives.js';
  const { renderMarketNarratives } = await load(narrativesPath);
  const { marketInterpretation } = await load('src/data/selectors/interpretation.js');
  const { MARKET_DAY } = await load('src/data/artifact-registry.js');
  const { buildNarrativeCards } = await load('src/domain/narrative/narrative-cards.js');
  const doc = createFakeDocument();
  const holder = doc.createElement('div');
  const grid = doc.createElement('div'); grid.className = 'mk-axes';
  holder.append(grid);
  const realQuery = doc.querySelector?.bind(doc);
  doc.querySelector = (selector) => (selector === '#page-signal .mk-axes' ? grid : realQuery?.(selector));
  grid.insertAdjacentElement = grid.insertAdjacentElement || ((where, node) => { holder.insertBefore(node, where === 'beforebegin' ? grid : null); return node; });
  const published = { schemaVersion: 'scenario-outcomes.v1', generatedAt: '2026-11-15T13:37:26.418Z', ...outcomes };
  let deliver = () => {};
  const arrived = new Promise((resolve) => { deliver = resolve; });
  const root = { fetch: async () => { await arrived; return new Response(JSON.stringify(published), { status: 200, headers: { 'content-type': 'application/json' } }); } };
  const story = (id, count) => ({ id, label: id, telegramCount: count, recentCount: 1, trend: 'steady', newsCount: 0, rumorCount: 0, unconfirmedCount: 0, movers: [] });
  root[MARKET_DAY.key] = { narratives: { at: '2026-11-16T00:00:00Z', windowHours: 72, stories: [story('ai-funding-credit', 9), story('ai-profitability', 7)] } };
  const before = marketInterpretation(root);
  const section = renderMarketNarratives({ documentRef: doc, root, interpretation: before });
  const ids = [...new Set(buildNarrativeCards({ narratives: root[MARKET_DAY.key].narratives, crossroads: before.crossroads }).cards.slice(0, 3).flatMap((card) => card.scenarios.map((row) => row.id)))];
  const shortFace = (id) => decisionFrameText(branchDecisionFrame(before.crossroads.items.find((item) => item.id === id), { cash: before.crossroads.cash })).face[0];
  check('v60.21load: before the long record the story frame is the own-close one', ids.length > 0 && ids.every((id) => section.textContent.includes(shortFace(id))), { ids, text: section.textContent.slice(0, 200) });
  // The scenario section asks for the same record (refreshScenarioArtifacts); the story section must not depend on it.
  const { refreshSharedArtifact } = await load('src/data/shared-artifacts.js');
  const { SCENARIO_OUTCOMES } = await load('src/data/artifact-registry.js');
  const scenarioSectionLoad = refreshSharedArtifact(root, SCENARIO_OUTCOMES);
  deliver();
  await scenarioSectionLoad;
  for (let turn = 0; turn < 20; turn += 1) await new Promise((resolve) => setTimeout(resolve, 0));
  const after = marketInterpretation(root).crossroads;
  check('v60.21load: the crossroads model names which record its items carry', before.crossroads.pastRecord === 'local' && after.pastRecord === `long@${published.generatedAt}`, { before: before.crossroads.pastRecord, after: after.pastRecord });
  // The scenario section draws branchDecisionFrame over the same interpretation; the regime page may also repaint the story.
  renderMarketNarratives({ documentRef: doc, root, interpretation: marketInterpretation(root) });
  const shown = doc.getElementById('regime-narratives')?.textContent || section.textContent;
  const scenarioFace = (id) => decisionFrameText(branchDecisionFrame(after.items.find((item) => item.id === id), { cash: after.cash })).face[0];
  check('v60.21load: once the record arrives the story frame equals the scenario frame for the same branch', ids.every((id) => shown.includes(scenarioFace(id)) && /73번 중 41번/.test(scenarioFace(id))) && !ids.some((id) => shown.includes(shortFace(id))),
    { faces: ids.map(scenarioFace), text: shown.slice(0, 300) });
  // The AI context reads the same interpretation: a question waits for the record beside the answer blocks.
  const { buildQuestionDomainContext } = await load('src/ai/context/market-content.js');
  let deliverAi = () => {};
  const aiArrived = new Promise((resolve) => { deliverAi = resolve; });
  const aiRoot = { fetch: async () => { await aiArrived; return new Response(JSON.stringify(published), { status: 200, headers: { 'content-type': 'application/json' } }); } };
  const ready = buildQuestionDomainContext.loadBlocks(aiRoot);
  deliverAi();
  await ready;
  check('v60.21load: the AI answer blocks wait for the long record, so the chat quotes the record the screen shows', marketInterpretation(aiRoot).crossroads.pastRecord === `long@${published.generatedAt}`, marketInterpretation(aiRoot).crossroads.pastRecord);
}

// ── artifact ──
{
  const committed = JSON.parse(readFileSync(path.join(root, 'public-data/scenario-outcomes.json'), 'utf8'));
  const live = scenarioOutcomeFingerprints();
  const current = currentScenarioOutcomes(committed);
  const stamped = committed.fingerprints?.branches === live.branches && committed.fingerprints?.schema === live.schema;
  check('v60.19artifact: a record from another definition is not read as the long record', stamped ? !!current.branches : current.branches === null);
  const model = buildMacroCrossroads({ signals, outcomes: committed });
  const lead = model.items.find((item) => item.id === 'reflation');
  check('v60.19artifact: an unstamped artifact leaves the branch on its own-record fallback, never the long record', stamped || lead.past.source !== 'long', lead.past);
}

if (failures.length) { console.error(`decision-frame check FAIL (${failures.length})\n- ${failures.join('\n- ')}`); process.exit(1); }
console.log('decision-frame check PASS: producer fields, frame legs and ground, shared renderer and story-card copy, stamped artifact read');
