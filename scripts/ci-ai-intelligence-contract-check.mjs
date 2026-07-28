import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQuestionPlan } from '../src/ai/orchestrator/question-planner.js';
import { createAnswerPlan, validateAnswerPlan } from '../src/ai/response/claim-ledger.js';
import { createMarketSessionEvidence, validateMarketSessionEvidence } from '../src/ai/time/market-session.js';
import { buildCausalAttribution } from '../src/ai/analysis/causal.js';
import { buildSectorDecomposition } from '../src/ai/analysis/sector.js';
import { buildCompanyAssessment } from '../src/ai/analysis/company.js';
import { buildTechnicalConditions } from '../src/ai/analysis/technical.js';
import { buildMacroFxTransmission } from '../src/ai/analysis/macro-fx.js';
import { createBenchmarkManifest, evaluateRoutingCorpus, assertBenchmarkReady } from '../src/ai/eval/benchmark.js';
import { createAIControlPlane } from '../src/ai/operations/control-plane.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const check = (label, condition) => { if (!condition) failures.push(label); };

const cases = [
  ['지금 반도체 하락 중', 'MARKET_STATUS'],
  ['SW 섹터 분석', 'SECTOR_ANALYSIS'],
  ['환율 왜 이래?', 'FX_ANALYSIS'],
  ['반등할까?', 'OUTLOOK'],
  ['어느 종목이 좋아?', 'SCREENING'],
  ['이 기업 어때?', 'ENTITY_ANALYSIS'],
  ['RSI가 뭐야?', 'TECHNICAL_ANALYSIS']
];
for (const [query, expected] of cases) {
  const plan = createQuestionPlan({ query, route: 'home', now: '2026-07-28T12:00:00Z' });
  check(`routing:${query}`, plan.intent.primary === expected);
  check(`plan-schema:${query}`, plan.schemaVersion === 'question-plan.v1' && Array.isArray(plan.requiredEvidence));
}

const unknownSession = createMarketSessionEvidence({ market: 'US', now: '2026-07-28T12:00:00Z' });
check('market-session-unknown-is-not-open', unknownSession.status === 'unknown' && unknownSession.isOpen === null && validateMarketSessionEvidence(unknownSession).ok);
const openSession = createMarketSessionEvidence({ market: 'US', now: '2026-07-28T12:00:00Z', schedule: { status: 'open', session: 'regular', source: 'test' } });
check('market-session-typed-open', openSession.status === 'open' && openSession.isOpen === true && openSession.verified === true);

const invalidProbabilityPlan = createAnswerPlan({
  summary: 'invalid probability',
  claims: [{ type: 'probability', text: '상승 확률', value: 70, unit: '%', asOf: '2026-07-28', source: 'model', evidenceIds: ['e1'] }],
  scenario: { probabilities: { bull: 70 } }
});
const probabilityAudit = validateAnswerPlan(invalidProbabilityPlan, { currentSensitive: true });
check('uncalibrated-probability-blocked', probabilityAudit.ok === false && probabilityAudit.errors.some((error) => error.includes('uncalibrated_probability')));

const causal = buildCausalAttribution({
  target: { metricId: 'SPX', direction: 'BEARISH', observedAt: '2026-07-28T12:00:00Z' },
  events: [{ eventId: 'n1', title: 'macro event', publishedAt: '2026-07-28T11:30:00Z', source: 'wire', sourceKind: 'LIVE', type: 'macro' }],
  crossAssets: [{ metricId: 'VIX', observedAt: '2026-07-28T11:50:00Z' }]
});
check('causal-temporal-cross-asset', causal.status === 'supported' && causal.alignedEventCount === 1 && causal.corroboratingCrossAssetCount === 1);

const sector = buildSectorDecomposition({ sector: 'software', observedAt: '2026-07-27T10:00:00Z', constituents: [
  { symbol: 'A', returnPct: 2, evidenceId: 'e-a', asOf: '2026-07-27T10:00:00Z' },
  { symbol: 'B', returnPct: -1, evidenceId: 'e-b', asOf: '2026-07-27T10:00:00Z' },
  { symbol: 'C', returnPct: 0.5, evidenceId: 'e-c', asOf: '2026-07-27T10:00:00Z' }
] });
check('sector-decomposition', sector.status === 'ready' && sector.breadth.total === 3 && sector.breadth.advances === 2);
const company = buildCompanyAssessment({ entity: { symbol: 'A' }, quality: { profitability: 0.8, growth: 0.6 }, valuation: { percentile: 55, benchmark: 'peer' } });
check('company-quality-valuation', company.quality.score === 0.7 && company.valuation.percentile === 55);
const technical = buildTechnicalConditions({ symbol: 'A', observedAt: '2026-07-27T10:00:00Z', indicators: { price: 110, sma20: 100, rsi14: 72 } });
check('technical-conditions', technical.status === 'ready' && technical.conditions.length === 2);
const macroFx = buildMacroFxTransmission({ macro: { rates: 4.2 }, fx: { dxy: 104 }, edges: [{ source: 'rates', target: 'dxy', direction: 'positive', strength: 0.5, asOf: '2026-07-27', sourceKind: 'official', evidenceId: 'e-rates' }] });
check('macro-fx-transmission', macroFx.status === 'supported' && macroFx.evidenceIds.length === 1);
const evalManifest = createBenchmarkManifest({ snapshotRevision: 'snapshot:test', modelVersion: 'model:test', promptVersion: 'prompt:test', retrieverVersion: 'retriever:test', validatorVersion: 'validator:test', costLimitUsd: 1 });
check('benchmark-manifest', assertBenchmarkReady(evalManifest).ok && evalManifest.reproducible);
const corpus = evaluateRoutingCorpus({ cases: cases.map(([query, expectedIntent], index) => ({ id: `case-${index + 1}`, query, expectedIntent })), planner: (query) => createQuestionPlan({ query, route: 'home', now: '2026-07-28T12:00:00Z' }) });
check('routing-corpus-evaluation', corpus.accuracy === 1 && corpus.total === cases.length);
const controlPlane = createAIControlPlane({ now: () => '2026-07-28T12:00:00Z' });
controlPlane.recordCanary({ release: 'v53.55' });
check('operations-control-plane', controlPlane.status().eventCount === 1 && controlPlane.status().operatorRequired === true);

const chat = read('js/aio-chat.js');
const data = read('js/aio-data.js');
const core = read('js/aio-core.js');
const bootstrap = read('src/app/bootstrap.js');
check('single-orchestrator-export', /getAIOrchestrator/.test(bootstrap) && /createAIAnswerOrchestrator/.test(bootstrap));
check('chat-dispatches-through-orchestrator', /AIO_ARCH\.getAIOrchestrator/.test(chat) && /_aioOrchestrated/.test(chat));
check('no-confirmed-verdict', !/verdict\s*=\s*[^;]*CONFIRMED/.test(data) && /RESEARCH_CANDIDATE/.test(data) && /research-relative-ranking-only/.test(data));
check('producer-observed-time', /producer observation time/.test(data) && /관측시각 미확인/.test(data));
check('probability-policy-is-strict', /calibrated !== true/.test(core) && /보정\(calibration\).*확률/.test(chat));

if (failures.length) {
  console.error(`AI intelligence contract failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`AI intelligence contract OK (${cases.length} routing cases + AIQ-4 domain engines)`);
