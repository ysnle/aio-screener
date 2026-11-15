#!/usr/bin/env node
// v60.19 (decision frame): behavioural checks of the shared frame — likelihood beside its base and sample, payoff against
// an ordinary day, cash and index as the opportunity cost, the cost of being wrong, and the ground of the favoured side.
//   producer  buildScenarioOutcomes on a small synthetic history writes base quartiles, drawdown and cash fields
//   frame     buildDecisionFrame on fixtures: distinct / not distinct, n < 10, 10–29, missing quartiles, conflict, past-record
//   copy      the shared renderer and the 시장 상태 story cards name the ground beside every favoured side
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
  check('v60.19frame: a rule-table favourite whose record is not distinct stands on 비용 가설', plain.favoured.ground === 'cost-hypothesis' && /비용 가설/.test(text.tag) && /과거 성과로 확인한 우위가 아닙니다/.test(text.ground), text.tag);
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
  check('v60.19frame: under 10 cases counts only — no share, no payoff, no drawdown share', !/%\(/.test(thinText.face[0]) && /7번 중 5번/.test(thinText.face[0]) && thin.payoff === null && thin.wrong.cost === null && /사례가 적어/.test(thinText.face[1]), thinText);
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
  const { decisionFrameBlock, favouredLine, groundTag } = await load('src/ui/components/decision-frame.js');
  const doc = createFakeDocument();
  const item = crossroads.items.find((row) => row.id === 'volshock');
  const frame = branchDecisionFrame(item, { cash: crossroads.cash || cash });
  const block = decisionFrameBlock(doc, frame, { method: item.past.text });
  const words = block.textContent;
  check('v60.19copy: the branch card frame shows 가능성 and 이익·손실 폭 first, the fold holds 기회비용 and 틀렸을 때', block.children[0].textContent.startsWith('가능성:') && block.children[1].textContent.startsWith('이익·손실 폭:') && /기회비용/.test(words) && /틀렸을 때/.test(words) && /빗나가는 조건/.test(words), words);
  check('v60.19copy: the favoured side carries its ground', /분할 접근, 관망 · 비용 가설/.test(favouredLine(doc, frame).textContent) && groundTag(doc, frame).textContent === '비용 가설');
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
  check('v60.19copy: every favoured side on the story cards names its ground (비용 가설) and none reads 상대적으로 유리', favouredMentions > 0 && !/상대적으로 유리/.test(text) && (text.match(/비용 가설/g) || []).length >= (text.match(/이 시나리오에서 대응별 득실/g) || []).length, { favouredMentions, ground: (text.match(/비용 가설/g) || []).length });
  check('v60.19copy: the story cards show the past line with its base beside it', /가능성: 20거래일 뒤 오른 경우 \d+%\(73번 중 41번\), 평소 64%/.test(text));
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
