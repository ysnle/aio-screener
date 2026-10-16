// Read-only counterexamples for the 2026-10-15 v57.82 review; no producers, network or browser storage.
import fs from 'node:fs';
const root = new URL('../../', import.meta.url);
const read = p => JSON.parse(fs.readFileSync(new URL(p, root), 'utf8'));
const mod = p => import(new URL(p, root));
const observations = [];
const record = (id, result) => observations.push({ id, result });
const { assessAccountPerformance } = await mod('src/domain/portfolio/risk.js');
const { buildPortfolioRead } = await mod('src/domain/portfolio/portfolio-read.js');
const { frequencyText } = await mod('src/domain/scenarios/analogs.js');
const { buildMacroRead } = await mod('src/domain/macro/macro-read.js');
const { hyWidening20Record, hyDelta20Bp } = await mod('src/domain/briefing/market-read.js');
const sessions = await mod('src/ai/session/chat-sessions.js');
const coverage = Object.fromEntries(['trades', 'deposits-withdrawals', 'dividends-splits', 'fees-taxes', 'fx', 'valuation-cuts'].map(k => [k, true]));
const account = assessAccountPerformance({ ledger: {
  currency: 'USD', dayCount: 'actual-365', flowTiming: 'start-of-period', coverage,
  valuations: [{ date: '2025-01-01', amount: 100 }, { date: '2026-01-01', amount: 220 }],
  transactions: [{ date: '2025-01-01', kind: 'deposit', amount: 100 }]
} });
record('F04-period-start-deposit', { status: account.status, twrPct: account.twr * 100, mwrPct: account.mwr * 100, warnings: account.warnings, expectedMwrPct: 10 });
const memory = () => {
  const store = new Map();
  return { store, getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
};
const storage = memory();
sessions.setConsent(storage, true);
sessions.appendTurn(storage, { sessionId: 'audit-s1', question: 'audit question', answer: 'audit answer', at: 1 });
sessions.deleteSession(storage, 'audit-s1');
record('F02-last-session-delete', { afterDelete: sessions.loadSessions(storage).length, rawRetained: !!storage.getItem(sessions.SESSIONS_KEY), expected: 0 });
const longStore = memory();
sessions.setConsent(longStore, true);
for (let i = 0; i < 40; i++) sessions.appendTurn(longStore, { sessionId: 'audit-long', question: 'q'.repeat(7997) + String(i).padStart(3, '0'), answer: 'a'.repeat(8000), at: i });
const kept = sessions.loadSessions(longStore)[0];
record('F03-large-session', { attempted: 40, persisted: kept?.turns.length, lastQuestionSuffix: kept?.turns.at(-1)?.q.slice(-3), expectedNewestSuffix: '039' });
const temperature = read('public-data/market-temperature.json');
for (const [market, m] of Object.entries(temperature.markets)) {
  for (const state of ['cold', 'hot']) {
    let lastIn = -Infinity;
    const starts = [];
    m.history.forEach((row, i) => { if (row[state === 'cold' ? 2 : 3] < 3) return; if (i - lastIn > 21) starts.push(i); lastIn = i; });
    const overlap = starts.slice(1).flatMap((i, j) => i + 63 < m.history.length && i - starts[j] < 63 ? [{ from: m.history[starts[j]][0], to: m.history[i][0], gap: i - starts[j] }] : []);
    if (overlap.length) record('F05-temperature-overlap', { market, state, overlap });
  }
}
const portfolio = buildPortfolioRead({ surface: { rows: [{ symbol: 'AAPL', value: 50 }, { symbol: '005930.KS', value: 50 }] }, rows: [{ sym: 'AAPL', pctSma50: -10, pctSma200: -10 }, { sym: '005930.KS', pctSma50: 10, pctSma200: 10 }], regime: { axes: [{ id: 'breadth', state: 'burden' }] } });
record('F08-us-denominator', { actual: portfolio.points.find(p => p.id === 'trend').text, expectedUsDownPct: 100 });
const outcomes = read('public-data/scenario-outcomes.json');
const smallBuckets = [];
function visitSamples(value, key = '') {
  if (!value || typeof value !== 'object') return;
  if (Number.isInteger(value.n) && value.n >= 10 && value.n < 30) smallBuckets.push({ key, n: value.n });
  for (const [k, child] of Object.entries(value)) if (child && typeof child === 'object') visitSamples(child, `${key}.${k}`);
}
visitSamples(outcomes);
record('F09-small-sample', { actual: frequencyText(outcomes.themes.reits.pullback, '리츠 추세 속 조정'), sample: outcomes.themes.reits.pullback.n, smallBuckets });
const data = read('public-data/data.json');
const mh = read('public-data/macro-history.json');
const creditModel = buildMacroRead({ macro: data.macro, macroHistory: mh, regime: { axes: [{ id: 'credit', state: 'burden' }] } });
record('F06-credit-reason', { delta20: hyDelta20Bp(mh), record: hyWidening20Record(mh), gauge: creditModel.sharedGauges.credit, chain: creditModel.chain.branches.find(b => b.id === 'credit') });
const { basisAge } = await mod('src/ui/components/value-basis.js');
record('F16-basis-age', { timestamp: basisAge('2020-01-01T00:00:00Z', Date.parse('2026-10-15T13:00:00Z')) });
const { default: worker } = await mod('cloudflare-worker-proxy.js');
const token = 'fixture-automation-'.padEnd(40, 'x');
let aiRunCalls = 0;
const env = { AIO_AUTOMATION_TOKEN: token, AI_KILL_SWITCH: '1', AI_MONTHLY_BUDGET_USD: '0', AI: { run: async () => { aiRunCalls++; return { response: ['테스트 제목'] }; } } };
const statuses = [];
for (let i = 0; i < 3; i++) {
  const response = await worker.fetch(new Request('https://worker.example/workers-ai/translate', { method: 'POST', headers: { 'content-type': 'application/json', 'X-AIO-Automation-Token': token }, body: JSON.stringify({ titles: ['test headline'] }) }), env);
  statuses.push(response.status);
}
record('F18-workers-ai-control', { statuses, aiRunCalls, globalKillSwitch: env.AI_KILL_SWITCH, configuredMonthlyBudget: env.AI_MONTHLY_BUDGET_USD, quotaBinding: false, boundary: 'AI.run mock only; no provider inference or billing' });
console.log(JSON.stringify({ observedAt: new Date().toISOString(), version: read('version.json').version, boundary: 'synthetic fixtures and checked-in artifacts; no external truth certification', observations }, null, 2));
