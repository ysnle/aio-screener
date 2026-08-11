import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQuestionPlan } from '../src/ai/orchestrator/question-planner.js';
import { createAnswerPlan, validateAnswerPlan, parseAnswerPlanText } from '../src/ai/response/claim-ledger.js';
import { renderAnswerPlan } from '../src/ai/response/renderer.js';
import { createMarketSessionEvidence, validateMarketSessionEvidence } from '../src/ai/time/market-session.js';
import { buildCausalAttribution } from '../src/ai/analysis/causal.js';
import { buildSectorDecomposition } from '../src/ai/analysis/sector.js';
import { buildCompanyAssessment } from '../src/ai/analysis/company.js';
import { buildTechnicalConditions } from '../src/ai/analysis/technical.js';
import { buildMacroFxTransmission } from '../src/ai/analysis/macro-fx.js';
import { createBenchmarkManifest, evaluateRoutingCorpus, assertBenchmarkReady } from '../src/ai/eval/benchmark.js';
import { createAIControlPlane } from '../src/ai/operations/control-plane.js';
import { createResearchDecision, validateResearchDecision } from '../src/ai/research/decision.js';
import { createResearchPlan, validateResearchPlan } from '../src/ai/research/plan.js';
import { createEvidenceDocument, evaluateResearchEvidenceFloor, normalizeResearchExecutionResult, normalizeSearchResults, validateClaimEvidenceBinding } from '../src/ai/research/evidence.js';
import { createResearchCapability, validateResearchCapability } from '../src/ai/research/capability.js';
import { classifyAIConduct, buildScopedConductFallback } from '../src/ai/policy/conduct.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const check = (label, condition) => { if (!condition) failures.push(label); };

const cases = [
  { query: '지금 반도체 하락 중', expected: 'SECTOR_ANALYSIS' },
  { query: 'SW 섹터 분석', expected: 'SECTOR_ANALYSIS' },
  { query: '환율 왜 이래?', expected: 'MARKET_CAUSAL' },
  { query: '반등할까?', expected: 'OUTLOOK' },
  { query: '어느 종목이 좋아?', expected: 'SCREENING' },
  { query: '이 기업 어때?', expected: 'ENTITY_ANALYSIS' },
  { query: 'RSI가 뭐야?', expected: 'EDUCATION' },
  { query: '광테마 전망', route: 'theme-detail', expected: 'SECTOR_ANALYSIS' },
  { query: 'NVDA 현재 어때?', expected: 'ENTITY_ANALYSIS' },
  { query: 'NVDA 주가', expected: 'ENTITY_FACT' },
  { query: '왜 오늘 반도체가 빠졌어?', expected: 'MARKET_CAUSAL' },
  { query: '채권 금리가 뭐야?', expected: 'EDUCATION' },
  { query: '지난 FOMC 요약', expected: 'NEWS_SUMMARY' },
  { query: '현재 FOMC 영향', expected: 'MARKET_CAUSAL' },
  { query: '애플과 MSFT 비교', expected: 'COMPARISON' },
  { query: '금리 인하가 성장주에 왜 좋아?', expected: 'MARKET_CAUSAL' },
  { query: '저평가 배당주 5개 골라줘', expected: 'SCREENING' },
  { query: '원달러 환율 얼마야?', expected: 'FX_ANALYSIS' },
  { query: 'VIX 얼마야?', expected: 'MACRO_ANALYSIS' },
  { query: '오늘 VIX 얼마야?', expected: 'MACRO_ANALYSIS' },
  { query: 'SPY 옵션 IV와 GEX 분석', expected: 'OPTIONS_ANALYSIS' },
  { query: '삼성전자 PER', expected: 'ENTITY_FACT' },
  { query: 'AAPL과 MSFT 실적 마진 차트 비교', expected: 'COMPARISON' },
  { query: '오늘 시장 왜 하락했어?', expected: 'MARKET_CAUSAL' },
  { query: '반도체 전망', expected: 'SECTOR_ANALYSIS' },
  { query: 'What is a bond yield?', expected: 'EDUCATION' },
  { query: 'Compare Apple and Microsoft valuation', expected: 'COMPARISON' },
  { query: 'Summarize the latest Fed decision', expected: 'NEWS_SUMMARY' },
  { query: '내 포트폴리오 위험을 분석해줘', route: 'portfolio', expected: 'PORTFOLIO_ACTION' },
  { query: 'NVDA RSI MACD 기술적 분석', expected: 'TECHNICAL_ANALYSIS' }
];
for (const { query, expected, route = 'home' } of cases) {
  const plan = createQuestionPlan({ query, route, now: '2026-07-28T12:00:00Z' });
  check(`routing:${query}`, plan.intent.primary === expected);
  check(`plan-schema:${query}`, plan.schemaVersion === 'question-plan.v1' && Array.isArray(plan.requiredEvidence));
}

const unknownSession = createMarketSessionEvidence({ market: 'US', now: '2026-07-28T12:00:00Z' });
check('market-session-unknown-is-not-open', unknownSession.status === 'unknown' && unknownSession.isOpen === null && validateMarketSessionEvidence(unknownSession).ok === false);
const openSession = createMarketSessionEvidence({ market: 'US', now: '2026-07-28T12:00:00Z', schedule: { status: 'open', session: 'regular', source: 'test' } });
check('market-session-typed-open', openSession.status === 'open' && openSession.isOpen === true && openSession.verified === true);
const krPlan = createQuestionPlan({ query: '005930.KS 오늘 어때?', route: 'home', root: { _getKrxSession: () => 'open' }, now: '2026-07-28T12:00:00Z' });
check('market-session-uses-resolved-market', krPlan.market === 'KR' && krPlan.sessionEvidence?.market === 'KR' && krPlan.sessionEvidence?.status === 'open' && krPlan.sessionEvidence?.verified === true);

const invalidProbabilityPlan = createAnswerPlan({
  summary: 'invalid probability',
  claims: [{ type: 'probability', text: '상승 확률', value: 70, unit: '%', asOf: '2026-07-28', source: 'model', evidenceIds: ['e1'] }],
  scenario: { probabilities: { bull: 70 } }
});
const probabilityAudit = validateAnswerPlan(invalidProbabilityPlan, { currentSensitive: true });
check('uncalibrated-probability-blocked', probabilityAudit.ok === false && probabilityAudit.errors.some((error) => error.includes('uncalibrated_probability')));
const validPlanText = '[AI_ANSWER_PLAN]' + JSON.stringify({ schemaVersion:'answer-plan.v1', summary:'광테마는 수요와 공급 병목을 함께 확인해야 합니다.', claims:[], sections:[{ title:'확인 조건', body:'수주, 증설, 마진의 연결을 검증합니다.' }], citations:[], followUps:['수요와 실적의 연결을 설명해줘'] }) + '[/AI_ANSWER_PLAN]';
const parsedPlan = parseAnswerPlanText(validPlanText, { currentSensitive:false });
check('answer-plan-single-contract-parses-and-renders', parsedPlan.status === 'valid' && !renderAnswerPlan(parsedPlan.plan).includes('AI_ANSWER_PLAN'));
const untrackedNumeric = parseAnswerPlanText('[AI_ANSWER_PLAN]{"schemaVersion":"answer-plan.v1","summary":"현재 VIX는 15.2입니다","claims":[],"sections":[],"citations":[],"followUps":[]}[/AI_ANSWER_PLAN]', { currentSensitive:true });
check('answer-plan-untracked-current-number-fails', untrackedNumeric.status === 'invalid' && untrackedNumeric.audit.errors.includes('untracked_numeric_content'));
const harmlessOrdinal = parseAnswerPlanText('[AI_ANSWER_PLAN]{"schemaVersion":"answer-plan.v1","summary":"확인할 3가지 조건을 정리합니다","claims":[],"sections":[],"citations":[],"followUps":[]}[/AI_ANSWER_PLAN]', { currentSensitive:true });
check('answer-plan-ordinal-is-not-a-market-number', harmlessOrdinal.status === 'valid');
const renderedClaim = createAnswerPlan({ summary:'현재 관측', claims:[{ type:'metric', text:'VIX', value:15.2, unit:'index', asOf:'2026-08-10T12:00:00Z', source:'verified snapshot', evidenceIds:['vix:1'], status:'verified' }] });
check('answer-plan-renderer-surfaces-verified-claims', renderAnswerPlan(renderedClaim).includes('VIX: 15.2index'));

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
const corpus = evaluateRoutingCorpus({ cases: cases.map(({ query, expected }, index) => ({ id: `case-${index + 1}`, query, expectedIntent: expected })), planner: (query) => createQuestionPlan({ query, route: cases.find((row) => row.query === query)?.route || 'home', now: '2026-07-28T12:00:00Z' }) });
check('routing-corpus-evaluation', corpus.accuracy === 1 && corpus.total === cases.length);
const controlPlane = createAIControlPlane({ now: () => '2026-07-28T12:00:00Z' });
controlPlane.recordCanary({ release: 'v53.55' });
check('operations-control-plane', controlPlane.status().eventCount === 1 && controlPlane.status().operatorRequired === true);

const conceptPlan = createQuestionPlan({ query: 'What is a bond yield?', route: 'macro', now: '2026-07-28T12:00:00Z' });
check('research-concept-does-not-force-search', conceptPlan.researchDecision?.requirement === 'NOT_NEEDED' && conceptPlan.researchPlan?.subQueries?.length === 0);
check('research-concept-contract', validateResearchDecision(conceptPlan.researchDecision).ok && validateResearchPlan(conceptPlan.researchPlan).ok);
const causalPlan = createQuestionPlan({ query: 'Why did semiconductor stocks fall today?', route: 'home', now: '2026-07-28T12:00:00Z' });
check('research-causal-is-required', causalPlan.researchDecision?.requirement === 'REQUIRED' && causalPlan.researchDecision.causalSensitive === true && causalPlan.researchPlan.subQueries.length >= 2);
check('research-causal-tool-is-required', causalPlan.requiredTools.includes('web-research'));
const quotePlan = createQuestionPlan({ query: 'NVDA 주가', route: 'fundamental', now: '2026-07-28T12:00:00Z', sessionSchedule: { status:'open', session:'regular', source:'test' } });
check('current-quote-uses-verified-snapshot-with-optional-web-enrichment', quotePlan.currentSensitive === true && quotePlan.researchDecision.requirement === 'OPTIONAL' && quotePlan.requiredEvidence.includes('entity-quote'));
const themeOutlookPlan = createQuestionPlan({ query:'광테마 전망', route:'theme-detail', now:'2026-07-28T12:00:00Z', sessionSchedule:{ status:'open', session:'regular', source:'test' } });
check('theme-outlook-is-current-but-does-not-depend-on-web-only', themeOutlookPlan.currentSensitive === true && themeOutlookPlan.researchDecision.requirement === 'OPTIONAL' && themeOutlookPlan.requiredEvidence.includes('sector-constituents'));
const compositePlan = createQuestionPlan({ query: 'AAPL과 MSFT 실적 마진 차트 비교', route: 'home', now: '2026-07-28T12:00:00Z' });
check('composite-question-retains-every-evidence-axis', ['entity-quote','fundamentals','technical'].every((item) => compositePlan.requiredEvidence.includes(item)));
check('finance-acronyms-are-not-tickers', createQuestionPlan({ query:'삼성전자 PER와 지난 FOMC 비교', route:'home', now:'2026-07-28T12:00:00Z' }).entities.entities.every((entity) => !['PER','FOMC'].includes(entity.symbol)));
const outOfScopePlan = createQuestionPlan({ query: 'What is the latest weather in Seoul today?', route: 'home', now: '2026-07-28T12:00:00Z' });
check('research-out-of-scope-is-explicit', outOfScopePlan.researchDecision?.outOfScope === true && outOfScopePlan.researchDecision.questionClass === 'OUT_OF_SCOPE_RESEARCH');
const conductCases = [
  ['광테마 전망', 'EDUCATIONAL_ALLOWED', 'EDUCATIONAL'],
  ['SEC 규제가 반도체에 미치는 영향 설명', 'EDUCATIONAL_ALLOWED', 'EDUCATIONAL'],
  ['세법상 ETF 과세 구조를 설명해줘', 'EDUCATIONAL_ALLOWED', 'EDUCATIONAL'],
  ['옵션은 어떻게 작동해?', 'EDUCATIONAL_ALLOWED', 'CONDITIONAL_ANALYSIS'],
  ['SPY 옵션 매수 조건을 설명해줘', 'EDUCATIONAL_ALLOWED', 'CONDITIONAL_ANALYSIS'],
  ['what is market manipulation?', 'EDUCATIONAL_ALLOWED', 'EDUCATIONAL'],
  ['Which stock should I buy under SEC tax compliance rules?', 'EDUCATIONAL_ALLOWED', 'LEGAL_TAX_ANALYSIS'],
  ['내가 이 거래 세금 신고해야 해?', 'EDUCATIONAL_ALLOWED', 'LEGAL_TAX_ANALYSIS'],
  ['how to use inside information for front-running', 'BLOCKED_P0', 'PROHIBITED_INSTRUCTION']
];
for (const [query, status, requestMode] of conductCases) {
  const audit = classifyAIConduct({ query });
  check('conduct:' + query, audit.status === status && audit.requestMode === requestMode);
}
const responseDirectiveAudit = classifyAIConduct({ query:'해외주식 세금 원리 설명', responseText:'반드시 세금 신고하세요.' });
check('conduct-response-directive-is-scoped-not-blocked', responseDirectiveAudit.status === 'EDUCATIONAL_ALLOWED' && responseDirectiveAudit.requestMode === 'LEGAL_TAX_ANALYSIS' && responseDirectiveAudit.jurisdictionContextRequired === true);
check('conduct-plan-is-carried-by-question-plan', createQuestionPlan({ query:'옵션은 어떻게 작동해?', route:'options', now:'2026-07-28T12:00:00Z' }).conductPlan?.requestMode === 'CONDITIONAL_ANALYSIS');
check('legal-scope-notice-remains-useful', buildScopedConductFallback(responseDirectiveAudit).includes('전제와 확인 범위') && !buildScopedConductFallback(responseDirectiveAudit).includes('AI 안전 모드'));
const disabledDecision = createResearchDecision({ questionPlan: causalPlan, userOptOut: true, now: '2026-07-28T12:00:00Z' });
check('research-optout-fails-closed', disabledDecision.requirement === 'REQUIRED' && disabledDecision.failureMode === 'REQUIRED_BUT_DISABLED' && validateResearchDecision(disabledDecision).ok);
const evidenceDocument = createEvidenceDocument({ canonicalUrl: 'https://sec.gov/Archives/edgar/data/1/filing.htm', title: 'Official filing', contentDepth: 'FULL_TEXT', rights: 'PUBLIC_REFERENCE' });
const evidence = normalizeSearchResults([{ url: evidenceDocument.canonicalUrl, title: evidenceDocument.title, content: 'filing evidence', contentDepth: 'FULL_TEXT', rights: 'PUBLIC_REFERENCE', sourceTier: 'PRIMARY_OFFICIAL', primaryOrSecondary: 'PRIMARY' }]);
check('research-evidence-claim-binding', validateClaimEvidenceBinding({ evidenceIds: [evidence.documents[0].documentId] }, evidence, { currentSensitive: true, minimumIndependentSources: 1, minimumPrimarySources: 1 }).ok);
const currentPlan = createQuestionPlan({ query: 'NVDA current status today', route: 'fundamental', now: '2026-07-28T12:00:00Z', sessionSchedule: { status: 'open', session: 'regular', source: 'test' } });
const officialDoc = createEvidenceDocument({ canonicalUrl: 'https://www.sec.gov/Archives/edgar/data/1045810/filing.htm', title: 'NVIDIA filing', contentDepth: 'EXCERPT', rights: 'PUBLIC_REFERENCE' });
const legacyProducerShape = {
  citations: [officialDoc.canonicalUrl],
  evidenceDocuments: [officialDoc],
  researchEvidence: { currentClaimsAllowed: true }
};
const normalizedProducer = normalizeResearchExecutionResult(legacyProducerShape);
check('research-result-normalizes-legacy-producer-shape', normalizedProducer.researchEvidence.evidenceDocuments.length === 1 && !Object.hasOwn(normalizedProducer, 'evidenceDocuments') && !Object.hasOwn(normalizedProducer.researchEvidence, 'documents'));
check('research-external-result-passes-executable-floor', evaluateResearchEvidenceFloor({ questionPlan: currentPlan, required: true, externalResult: legacyProducerShape }).ready === true);
check('research-native-citations-pass-executable-floor', evaluateResearchEvidenceFloor({ questionPlan: currentPlan, required: true, nativeCitations: [officialDoc.canonicalUrl] }).ready === true);
const snippetDoc = createEvidenceDocument({ canonicalUrl: officialDoc.canonicalUrl, title: 'snippet only', contentDepth: 'SNIPPET', rights: 'PUBLIC_REFERENCE' });
check('research-snippet-only-fails-executable-floor', evaluateResearchEvidenceFloor({ questionPlan: currentPlan, required: true, externalResult: { citations: [snippetDoc.canonicalUrl], researchEvidence: { evidenceDocuments: [snippetDoc], currentClaimsAllowed: true } } }).ready === false);
const spoofedOfficial = createEvidenceDocument({ canonicalUrl: 'https://evilsec.gov.example.com/fake', title: 'spoof', publisher: 'sec.gov', sourceTier: 'PRIMARY_OFFICIAL', primaryOrSecondary: 'PRIMARY', contentDepth: 'EXCERPT', rights: 'PUBLIC_REFERENCE' });
check('research-official-domain-suffix-is-spoof-safe', spoofedOfficial.primaryOrSecondary === 'SECONDARY' && spoofedOfficial.sourceTier !== 'PRIMARY_OFFICIAL');
const capability = createResearchCapability({ provider: 'claude-native', routeReady: 'READY', authReady: 'READY', toolReady: 'READY', quotaReady: 'READY', originReady: 'READY', supportsCitations: true, supportsFullContent: true, supportsDomainControl: false, checkedAt: '2026-07-28T12:00:00Z' });
check('research-capability-separates-chat', capability.status === 'READY' && capability.chatReadiness === 'SEPARATE_CAPABILITY' && validateResearchCapability(capability).ok);

const chat = read('js/aio-chat.js');
const data = read('js/aio-data.js');
const core = read('js/aio-core.js');
const bootstrap = read('src/app/bootstrap.js');
check('single-orchestrator-export', /getAIOrchestrator/.test(bootstrap) && /createAIAnswerOrchestrator/.test(bootstrap));
check('chat-dispatches-through-orchestrator', /AIO_ARCH\.getAIOrchestrator/.test(chat) && /_aioOrchestrated/.test(chat));
check('no-confirmed-verdict', !/verdict\s*=\s*[^;]*CONFIRMED/.test(data) && /RESEARCH_CANDIDATE/.test(data) && /research-relative-ranking-only/.test(data));
check('producer-observed-time', /producer observation time/.test(data) && /관측시각 미확인/.test(data));
check('probability-policy-is-strict', /calibrated !== true/.test(core) && /보정\(calibration\).*확률/.test(chat));

check('answer-format-is-question-adaptive', !/반드시 \*\*Bull\/Base\/Bear 3 시나리오/.test(chat) && /질문 복잡도에 맞춘다/.test(chat));
check('research-outage-degrades-instead-of-erasing-answer', /research-evidence-unavailable/.test(chat) && !/RESEARCH_REQUIRED_BUT_UNAVAILABLE/.test(chat) && /RESEARCH_EVIDENCE_UNAVAILABLE/.test(read('index.html')));
check('research-decision-is-key-independent', /createResearchDecision/.test(read('src/ai/research/decision.js')) && /provider keys,[\s\S]*deliberately not read/i.test(read('src/ai/research/decision.js')));
check('research-plan-is-wired-to-chat', /_aiResearchPlanSearch/.test(chat) && /researchPlan/.test(chat) && /RESEARCH_RESULTS_EMPTY/.test(chat));
check('research-capability-is-separate', /getAIResearchCapability/.test(bootstrap) && /validateAIResearchCapability/.test(bootstrap) && /chatReadiness/.test(read('src/ai/research/capability.js')));
check('research-capability-drives-shared-preparation', /_aioPrepareAIResearch/.test(chat) && /externalSearchReady/.test(chat) && /externalEvidenceReady/.test(chat) && /nativeFallbackRequired/.test(chat) && /_aioPrepareAIResearch/.test(read('index.html')));
check('research-document-classification-is-centralized', /createAIResearchEvidenceDocument/.test(chat) && /createAIResearchEvidenceDocument/.test(bootstrap) && /createAIResearchEvidenceDocument/.test(read('src/legacy/compatibility-facade.js')));
check('research-native-tool-errors-are-promoted', /web_search_tool_result_error/.test(chat) && /_aioLastClaudeResearchError/.test(chat));
check('deep-search-has-no-fixed-year', !/(latest news earnings|policy outlook|geopolitical risk latest|investment trend latest) 2026/.test(chat));
check('research-gate-shared-by-both-surfaces', /evaluateAIResearchEvidenceFloor/.test(chat) && /_aioEvaluateAIResearchGate/.test(read('index.html')) && /_aioPrepareAIResearch/.test(read('index.html')));
check('research-result-canonical-nesting', /researchEvidence:\s*\{[\s\S]*evidenceDocuments:\s*evidenceDocuments/.test(chat) && !/\n\s*evidenceDocuments:\s*evidenceDocuments,\n\s*researchPlanId/.test(chat));
check('research-failures-retain-subquery-reasons', /subFailures/.test(chat) && /noResults\.failures\s*=\s*subFailures/.test(chat) && /_aioLastResearchAudit/.test(chat));
check('request-plan-is-explicit-not-global', !chat.includes('_aioActiveQuestionPlan') && !read('index.html').includes('_aioActiveQuestionPlan') && chat.includes('questionPlan: questionPlan') && read('index.html').includes('questionPlan: _uniQuestionPlan'));
check('research-partial-results-preserve-query-index', /settled\.map\(function\(row, index\)/.test(chat) && /specs\[item\.index\]\.queryId/.test(chat));
check('fred-official-host-is-correct', read('src/ai/research/evidence.js').includes("'fred.stlouisfed.org'"));
check('quote-provenance-is-persisted', core.includes('observedAt: observedAt') && core.includes('fetchedAt: fetchedAt') && core.includes('marketState: provenanceOpts.marketState'));
check('sentiment-does-not-stamp-missing-observation-now', !/raw\[field\.observedAt\]\s*\|\|\s*raw\.now/.test(read('src/data/orchestrators/sentiment.js')));

if (failures.length) {
  console.error(`AI intelligence contract failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`AI intelligence contract OK (${cases.length} routing cases + AIQ-4 domain engines)`);
