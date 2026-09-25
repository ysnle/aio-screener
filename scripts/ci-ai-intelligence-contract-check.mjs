import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createQuestionPlan } from '../src/ai/orchestrator/question-planner.js';
import { createAnswerPlan, createClaimLedger, validateAnswerPlan, validateClaimLedger, parseAnswerPlanText } from '../src/ai/response/claim-ledger.js';
import { renderAnswerPlan } from '../src/ai/response/renderer.js';
import { createMarketSessionEvidence, validateMarketSessionEvidence } from '../src/ai/time/market-session.js';
import { buildCausalAttribution } from '../src/ai/analysis/causal.js';
import { buildSectorDecomposition } from '../src/ai/analysis/sector.js';
import { buildCompanyAssessment } from '../src/ai/analysis/company.js';
import { buildTechnicalConditions } from '../src/ai/analysis/technical.js';
import { buildMacroFxTransmission } from '../src/ai/analysis/macro-fx.js';
import { createBenchmarkManifest, evaluateRoutingCorpus, assertBenchmarkReady } from '../src/ai/eval/benchmark.js';
import { createResearchDecision, validateResearchDecision } from '../src/ai/research/decision.js';
import { createResearchPlan, validateResearchPlan } from '../src/ai/research/plan.js';
import { createEvidenceDocument, evaluateResearchEvidenceFloor, normalizeResearchExecutionResult, normalizeSearchResults, validateClaimEvidenceBinding, verifyEvidenceBinding } from '../src/ai/research/evidence.js';
import { createResearchCapability, validateResearchCapability } from '../src/ai/research/capability.js';
import { classifyAIConduct, classifyAIRequest, auditAIResponse, getAIConductPolicy, buildScopedConductFallback } from '../src/ai/policy/conduct.js';
import { createAIAnswerOrchestrator } from '../src/ai/orchestrator/answer-orchestrator.js';
import { createAIKnowledgeIndex, retrieveAIKnowledge } from '../src/ai/retrieval/knowledge.js';
import { evaluateEvidenceUse } from '../src/ai/policy.js';

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

const actionBoundaryOrchestrator = createAIAnswerOrchestrator({ now: () => new Date('2026-07-28T12:00:00Z') });
let blockedProviderCalls = 0;
// P1120: a denied personalized-action permission is dispatched with a disclosure limitation
// instead of being refused before the provider.
const blockedActionResult = await actionBoundaryOrchestrator.execute({
  query: '내 포트폴리오에서 NVDA 전량 매도해줘',
  route: 'portfolio',
  legacyRunner: async () => { blockedProviderCalls += 1; return { dispatched: true }; }
});
check('personalized-action-dispatches-with-disclosure-not-refusal', blockedActionResult.status === 'dispatched-through-ui-adapter' && blockedProviderCalls === 1 && blockedActionResult.actionLimitations.includes('suitability-profile-required'));
let educationProviderCalls = 0;
const educationResult = await actionBoundaryOrchestrator.execute({
  query: '분산투자의 원리를 설명해줘',
  route: 'education',
  legacyRunner: async () => { educationProviderCalls += 1; return 'ok'; }
});
check('educational-request-reaches-provider', educationResult.ok === true && educationProviderCalls === 1);
for (const query of ['매수 원리를 설명해줘', '매도 기준의 일반적인 방법', '포트폴리오 비중이란?', 'SPY 옵션 매수 조건을 설명해줘']) {
  const educationalActionPlan = createQuestionPlan({ query, route:'home', now:'2026-07-28T12:00:00Z' });
  check(`educational-action-vocabulary-is-not-preblocked:${query}`, educationalActionPlan.intent.actionVocabularyPresent === true && educationalActionPlan.suitabilityRequired === false && educationalActionPlan.actionPermission.allowed === true);
}
const personalizedActionPlan = createQuestionPlan({ query:'내 계좌에서 NVDA 전량 매도해줘', route:'portfolio', now:'2026-07-28T12:00:00Z' });
check('personalized-executable-action-is-recorded-as-a-policy-denial', personalizedActionPlan.suitabilityRequired === true && personalizedActionPlan.actionPermission.allowed === false && personalizedActionPlan.actionPermission.reasons.includes('suitability-profile-required') && personalizedActionPlan.actionPermission.reasons.includes('current-evidence-required'));

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
  events: [{ eventId: 'n1', title: 'macro event', publishedAt: '2026-07-28T11:30:00Z', source: 'wire', sourceKind: 'LIVE', evidenceId: 'event:n1', type: 'macro' }],
  crossAssets: [{ metricId: 'VIX', observedAt: '2026-07-28T11:50:00Z', source: 'snapshot', sourceKind: 'LIVE', evidenceId: 'metric:vix' }]
});
check('causal-temporal-cross-asset', causal.status === 'supported' && causal.alignedEventCount === 1 && causal.corroboratingCrossAssetCount === 1);
const causalOutsideWindow = buildCausalAttribution({
  target: { metricId: 'SPX', observedAt: '2026-07-28T12:00:00Z' },
  events: [
    { eventId: 'primary', title: 'verified release', publishedAt: '2026-07-28T11:30:00Z', source: 'official', sourceKind: 'LIVE', evidenceId: 'event:primary' },
    { eventId: 'old', title: 'old macro alternative', publishedAt: '2026-07-25T11:30:00Z', source: 'wire', sourceKind: 'LIVE', evidenceId: 'event:old', type: 'alternative' }
  ]
});
check('causal-alternatives-stay-inside-window-and-exclude-primary', causalOutsideWindow.status === 'partial' && causalOutsideWindow.alternativeCount === 0 && causalOutsideWindow.primary?.id === 'primary');

const sector = buildSectorDecomposition({ sector: 'software', observedAt: '2026-07-27T10:00:00Z', constituents: [
  { symbol: 'A', returnPct: 2, evidenceId: 'e-a', source: 'fixture', asOf: '2026-07-27T10:00:00Z' },
  { symbol: 'B', returnPct: -1, evidenceId: 'e-b', source: 'fixture', asOf: '2026-07-27T10:00:00Z' },
  { symbol: 'C', returnPct: 0.5, evidenceId: 'e-c', source: 'fixture', asOf: '2026-07-27T10:00:00Z' }
] });
check('sector-decomposition', sector.status === 'ready' && sector.breadth.total === 3 && sector.breadth.advances === 2);
const company = buildCompanyAssessment({ entity: { symbol: 'A' }, quality: { profitability: 0.8, growth: 0.6 }, valuation: { percentile: 55, benchmark: 'peer' } });
check('company-quality-valuation', company.quality.score === 0.7 && company.valuation.percentile === 55);
const technical = buildTechnicalConditions({ symbol: 'A', observedAt: '2026-07-27T10:00:00Z', source: 'fixture', indicators: { price: 110, sma20: 100, rsi14: 72 } });
check('technical-conditions', technical.status === 'ready' && technical.conditions.length === 2);
check('analysis-null-and-out-of-domain-inputs-fail-closed',
  buildCompanyAssessment({ quality: { growth: null }, valuation: { percentile: '' }, facts: { revenue: { value: false } } }).status === 'insufficient'
  && buildSectorDecomposition({ constituents: [{ symbol: 'A', returnPct: null }] }).status === 'insufficient'
  && buildTechnicalConditions({ indicators: { price: null, sma20: '', rsi14: 101 } }).status === 'insufficient'
  && buildMacroFxTransmission({ macro: null, fx: null }).status === 'insufficient');
const macroFx = buildMacroFxTransmission({ macro: { rates: 4.2 }, fx: { dxy: 104 }, edges: [{ source: 'rates', target: 'dxy', direction: 'positive', strength: 0.5, asOf: '2026-07-27', sourceKind: 'official', evidenceId: 'e-rates' }] });
check('macro-fx-transmission', macroFx.status === 'supported' && macroFx.evidenceIds.length === 1);
const evalManifest = createBenchmarkManifest({ snapshotRevision: 'snapshot:test', modelVersion: 'model:test', promptVersion: 'prompt:test', retrieverVersion: 'retriever:test', validatorVersion: 'validator:test', costLimitUsd: 1 });
check('benchmark-manifest', assertBenchmarkReady(evalManifest).ok && evalManifest.reproducible);
check('benchmark-missing-cost-is-not-zero', createBenchmarkManifest({ costLimitUsd: null }).costLimitUsd === null);
const corpus = evaluateRoutingCorpus({ cases: cases.map(({ query, expected }, index) => ({ id: `case-${index + 1}`, query, expectedIntent: expected })), planner: (query) => createQuestionPlan({ query, route: cases.find((row) => row.query === query)?.route || 'home', now: '2026-07-28T12:00:00Z' }) });
check('routing-corpus-evaluation', corpus.accuracy === 1 && corpus.total === cases.length);
const conceptPlan = createQuestionPlan({ query: 'What is a bond yield?', route: 'macro', now: '2026-07-28T12:00:00Z' });
check('research-concept-does-not-force-search', conceptPlan.researchDecision?.requirement === 'NOT_NEEDED' && conceptPlan.researchPlan?.subQueries?.length === 0);
check('research-concept-contract', validateResearchDecision(conceptPlan.researchDecision).ok && validateResearchPlan(conceptPlan.researchPlan).ok);
const companyPlan = createQuestionPlan({ query: 'NVDA 현재 어때?', route: 'home', now: '2026-07-28T12:00:00Z' });
const companyQueries = companyPlan.researchPlan?.subQueries || [];
check('company research source policy separates official primary from aggregators', companyPlan.researchDecision?.sourcePolicyId === 'company-primary'
  && companyQueries.length > 0
  && companyQueries.every((query) => query.sourcePolicyId === 'company-primary'
    && query.sourcePolicy?.primary?.tier === 'T1_OFFICIAL'
    && query.sourcePolicy?.primary?.purpose === 'sec-filing-or-issuer-ir-announcement'
    && query.sourcePolicy.primary.domains.includes('sec.gov')
    && !query.sourcePolicy.primary.domains.includes('investors.com')
    && !query.sourcePolicy.primary.domains.includes('nasdaq.com')
    && query.sourcePolicy.secondary?.tier === 'T3_PUBLIC_DELAYED'
    && query.sourcePolicy.secondary.domains.includes('investors.com')
    && query.sourcePolicy.secondary.domains.includes('nasdaq.com')));
check('company research plan validates source tier policy', validateResearchPlan(companyPlan.researchPlan).ok);
const unverifiedIssuerPlan = createResearchPlan({
  questionPlan: companyPlan,
  decision: companyPlan.researchDecision,
  now: '2026-07-28T12:00:00Z',
  issuerRegistry: { NVDA: { verified: false, verification: 'user-supplied', issuerIrDomains: ['ir.evil.example'] } }
});
const verifiedIssuerPlan = createResearchPlan({
  questionPlan: companyPlan,
  decision: companyPlan.researchDecision,
  now: '2026-07-28T12:00:00Z',
  issuerRegistry: { NVDA: { verified: true, verification: 'sec-registrant-issuer-ir', issuerIrDomains: ['https://investor.nvidia.com/news'] } }
});
check('company IR domain requires verified issuer registry',
  unverifiedIssuerPlan.subQueries.every((query) => !query.sourcePolicy.primary.domains.includes('ir.evil.example'))
  && verifiedIssuerPlan.subQueries.every((query) => query.sourcePolicy.primary.domains.includes('investor.nvidia.com')
    && query.sourcePolicy.primary.verifiedIssuerDomains.includes('investor.nvidia.com')
    && query.sourcePolicy.primary.issuerRegistryVerification === 'sec-registrant-issuer-ir')
  && validateResearchPlan(verifiedIssuerPlan).ok);
const newsPlan = createQuestionPlan({ query: '지난 FOMC 요약', route: 'market-news', now: '2026-07-28T12:00:00Z' });
check('news policy allows secondary context without inventing a primary floor',
  newsPlan.researchPlan?.subQueries?.every((query) => query.primaryRequired === false
    && query.sourcePolicy.primary.domains.length === 0
    && query.sourcePolicy.secondary.domains.length > 0
    && query.sourcePolicy.secondary.purpose === 'independent-news-report')
  && validateResearchPlan(newsPlan.researchPlan).ok);
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
const mixedMarketPlan = createQuestionPlan({ query:'삼성전자와 AAPL 현재 비교', route:'home', now:'2026-07-28T12:00:00Z' });
check('mixed-market-question-is-not-forced-into-one-session', mixedMarketPlan.market === 'MIXED' && mixedMarketPlan.markets.includes('KR') && mixedMarketPlan.markets.includes('US') && mixedMarketPlan.sessionEvidence?.status === 'unknown');
check('resolved-alias-is-not-reported-as-unresolved', !mixedMarketPlan.entities.unresolvedTerms.some((term) => term.includes('삼성전자')));
check('invalid-planner-clock-fails-to-stable-epoch', createQuestionPlan({ query:'시장 원리', now:'invalid' }).generatedAt === '1970-01-01T00:00:00.000Z');
const outOfScopePlan = createQuestionPlan({ query: 'What is the latest weather in Seoul today?', route: 'home', now: '2026-07-28T12:00:00Z' });
check('research-out-of-scope-is-explicit', outOfScopePlan.researchDecision?.outOfScope === true && outOfScopePlan.researchDecision.questionClass === 'OUT_OF_SCOPE_RESEARCH');
const regulationCurrentPlan = createQuestionPlan({ query:'SEC AI 규제 현황을 설명해줘', route:'principles', now:'2026-07-28T12:00:00Z' });
check('korean-current-regulation-requires-in-domain-research', regulationCurrentPlan.researchDecision?.requirement === 'REQUIRED' && regulationCurrentPlan.researchDecision?.outOfScope === false);
const conductCases = [
  ['광테마 전망', 'EDUCATIONAL_ALLOWED', 'EDUCATIONAL'],
  ['SEC 규제가 반도체에 미치는 영향 설명', 'EDUCATIONAL_ALLOWED', 'EDUCATIONAL'],
  ['세법상 ETF 과세 구조를 설명해줘', 'EDUCATIONAL_ALLOWED', 'EDUCATIONAL'],
  ['옵션은 어떻게 작동해?', 'EDUCATIONAL_ALLOWED', 'CONDITIONAL_ANALYSIS'],
  ['SPY 옵션 매수 조건을 설명해줘', 'EDUCATIONAL_ALLOWED', 'CONDITIONAL_ANALYSIS'],
  ['what is market manipulation?', 'EDUCATIONAL_ALLOWED', 'EDUCATIONAL'],
  ['market manipulation 방법을 교육적으로 설명하고 실행 단계도 알려줘', 'BLOCKED_P0', 'PROHIBITED_INSTRUCTION'],
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

// E6/A06: a request is classified before an answer exists and a response is audited after one does.
// The two surfaces share one policy but must not share a classifier, or a plan's classification could
// be rewritten by text the plan never saw.
{
  const requestQuery = '해외주식 세금 원리 설명';
  const requestOnly = classifyAIRequest({ query: requestQuery });
  check('P1244 E6/A06 request classification ignores response text', JSON.stringify(requestOnly) === JSON.stringify(classifyAIRequest({ query: requestQuery, responseText: '세금 신고하세요.' })));
  const audited = auditAIResponse({ query: requestQuery, responseText: '세금 신고하세요.' });
  check('P1244 E6/A06 response audit keeps the request classification and records the directive separately',
    audited.responseCompliance?.mode === 'LEGAL_DIRECTIVE'
    && audited.responseCompliance?.requestMode === requestOnly.requestMode
    && audited.requestMode === 'LEGAL_TAX_ANALYSIS'
    && buildScopedConductFallback(audited).includes('전제와 확인 범위'));
  const compliantAudit = auditAIResponse({ query: requestQuery, responseText: '일반 원리를 설명합니다.' });
  check('P1244 E6/A06 a compliant response audit records COMPLIANT without moving the request mode',
    compliantAudit.responseCompliance?.mode === 'COMPLIANT'
    && compliantAudit.responseCompliance?.directive === false
    && compliantAudit.requestMode === requestOnly.requestMode);
  check('P1244 E6/A06 the composite routes by surface', classifyAIConduct({ query: requestQuery }).responseCompliance === undefined
    && classifyAIConduct({ query: requestQuery, responseText: '세금 신고하세요.' }).responseCompliance?.mode === 'LEGAL_DIRECTIVE');
  const plan = createQuestionPlan({ query: requestQuery, route: 'home', now: '2026-07-28T12:00:00Z' });
  check('P1244 E6/A06 the question plan carries the response-independent request classification',
    JSON.stringify(plan.conductPlan) === JSON.stringify(classifyAIRequest({ query: plan.query })));
  const policy = getAIConductPolicy();
  check('P1244 E6/A06 the policy declares both surfaces and the response modes',
    policy.surfaces?.request === 'classifyAIRequest'
    && policy.surfaces?.response === 'auditAIResponse'
    && policy.responseModes?.includes('LEGAL_DIRECTIVE')
    && policy.responseModes?.includes('COMPLIANT'));
}
check('legal-scope-notice-remains-useful', buildScopedConductFallback(responseDirectiveAudit).includes('전제와 확인 범위') && !buildScopedConductFallback(responseDirectiveAudit).includes('AI 안전 모드'));
const disabledDecision = createResearchDecision({ questionPlan: causalPlan, userOptOut: true, now: '2026-07-28T12:00:00Z' });
check('research-optout-fails-closed', disabledDecision.requirement === 'REQUIRED' && disabledDecision.failureMode === 'REQUIRED_BUT_DISABLED' && validateResearchDecision(disabledDecision).ok);
const knowledgeIndex = createAIKnowledgeIndex([
  { articleId:'principles:B2', lessonId:'B2', surface:'principles', title:'금리와 자산가격', authoringStatus:'STRUCTURED_REFERENCE_DRAFT', publication:'EDUCATIONAL_REFERENCE_ONLY', reviewedAt:'2026-08-18', summary:{ definition:'금리는 미래 현금흐름의 할인율에 영향을 준다.', mechanism:'정책금리와 장기금리는 자본비용과 밸류에이션 경로로 전달된다.', example:'할인율 상승 시 같은 현금흐름의 현재가치가 낮아진다.', counterScenario:'성장 기대가 더 크게 오르면 가격 방향은 달라질 수 있다.' } },
  { articleId:'atlas-foundations:energy-and-power', lessonId:'energy-and-power', surface:'atlas-foundations', title:'Energy and power', authoringStatus:'STRUCTURED_REFERENCE_DRAFT', publication:'EDUCATIONAL_REFERENCE_ONLY', reviewedAt:'2026-08-18', summary:{ definition:'에너지는 일을 할 수 있는 능력이고 전력은 시간당 전달 속도다.', mechanism:'AI 계산과 메모리 이동은 전력·열·냉각 병목으로 이어진다.', example:'전력당 성능은 시설 비용에 영향을 준다.', counterScenario:'전력 사용량만으로 기업 수익을 결론낼 수 없다.' } }
]);
const knowledgeResult = retrieveAIKnowledge(knowledgeIndex, 'AI 데이터센터 전력과 냉각 병목을 설명해줘', { topK:2, maxChars:2200 });
check('knowledge-retrieval-routes-ai-era-reference', knowledgeResult.matches[0]?.articleId === 'atlas-foundations:energy-and-power' && knowledgeResult.audit.sourceKind === 'REFERENCE' && knowledgeResult.audit.currentClaimsAllowed === false);
check('knowledge-context-keeps-current-evidence-boundary', knowledgeResult.context.includes('currentClaimsAllowed=false') && knowledgeResult.context.includes('현재 시장·기업·가격·규제 사실은 별도') && knowledgeResult.context.length <= 2200);
check('knowledge-index-malformed-collections-fail-closed', createAIKnowledgeIndex([{ articleId:'x', surface:'principles', title:'x', conceptIds:'bad', keywords:42, sources:'bad' }]).length === 1 && retrieveAIKnowledge(knowledgeIndex, 'AI', { topK:1.5, maxChars:NaN }).audit.returned >= 0);
check('stale-decision-evidence-is-blocked', evaluateEvidenceUse({ status:'stale', allowedUse:'decision' }, 'decision').allowed === false);
const multiErrorLedger = validateClaimLedger(createClaimLedger([
  { claimId:'bad', type:'metric', text:'bad', value:null },
  { claimId:'good', type:'text', text:'good' }
]));
check('claim-ledger-valid-count-is-per-claim', multiErrorLedger.validCount === 1 && multiErrorLedger.errors.length > 1);
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
check('research-malformed-source-floor-cannot-degrade-to-zero', evaluateResearchEvidenceFloor({ questionPlan: { ...currentPlan, researchPlan: { stopConditions: { minimumIndependentSources: NaN, minimumPrimarySources: null } } }, required: true, externalResult: legacyProducerShape }).ready === false);
const spoofedOfficial = createEvidenceDocument({ canonicalUrl: 'https://evilsec.gov.example.com/fake', title: 'spoof', publisher: 'sec.gov', sourceTier: 'PRIMARY_OFFICIAL', primaryOrSecondary: 'PRIMARY', contentDepth: 'EXCERPT', rights: 'PUBLIC_REFERENCE' });
check('research-official-domain-suffix-is-spoof-safe', spoofedOfficial.primaryOrSecondary === 'SECONDARY' && spoofedOfficial.sourceTier !== 'PRIMARY_OFFICIAL');

// ── P1172 (05 A05): 출처가 이 요청의 것인지 ────────────────────────────────────────────────────
// The floor checks domains, counts and depth, so a cross-question set with an official domain and
// enough independent primary sources used to satisfy it — "this URL is official" became "this
// question is answered". A reproduced synthetic run passed another question's SEC URL and the floor
// returned ready.
const boundPlan = { ...currentPlan, queryId: 'query:nvda-status' };
const ownRequestDoc = { ...officialDoc, queryId: 'query:nvda-status' };
const otherRequestDoc = { ...officialDoc, queryId: 'query:unrelated-question' };
const asExternal = (doc) => ({ citations: [doc.canonicalUrl], researchEvidence: { evidenceDocuments: [doc], currentClaimsAllowed: true } });
const crossQuestion = evaluateResearchEvidenceFloor({ questionPlan: boundPlan, required: true, externalResult: asExternal(otherRequestDoc) });
check('P1172 research-floor rejects a citation bound to another request', crossQuestion.ready === false, JSON.stringify(crossQuestion.evidenceBinding));
check('P1172 research-floor names the binding failure as the reason', crossQuestion.reason === 'research-evidence-binding-mismatched_query', crossQuestion.reason);
const ownRequest = evaluateResearchEvidenceFloor({ questionPlan: boundPlan, required: true, externalResult: asExternal(ownRequestDoc) });
check('P1172 research-floor accepts a citation bound to this request', ownRequest.ready === true && ownRequest.bindingChecked === true && ownRequest.evidenceBinding.status === 'BOUND', JSON.stringify(ownRequest.evidenceBinding));
const unboundRequest = evaluateResearchEvidenceFloor({ questionPlan: boundPlan, required: true, externalResult: asExternal({ ...officialDoc }) });
check('P1172 research-floor marks an unbound citation set as unchecked rather than verified',
  unboundRequest.ready === true && unboundRequest.bindingChecked === false && unboundRequest.evidenceBinding.status === 'UNBOUND',
  JSON.stringify(unboundRequest.evidenceBinding));
const entityBoundPlan = { ...currentPlan, queryId: 'query:nvda-status', entity: 'NVDA' };
const otherEntityDoc = { ...officialDoc, queryId: 'query:nvda-status', entity: 'AMD' };
const crossEntity = evaluateResearchEvidenceFloor({ questionPlan: entityBoundPlan, required: true, externalResult: asExternal(otherEntityDoc) });
check('P1172 research-floor rejects a citation bound to another entity',
  crossEntity.ready === false && crossEntity.evidenceBinding.status === 'MISMATCHED_ENTITY',
  JSON.stringify(crossEntity.evidenceBinding));
check('P1172 evidence binding is enforced by the exported contract', verifyEvidenceBinding({ citations: [{ queryId: 'a' }], expectedQueryId: 'b' }).ok === false
  && verifyEvidenceBinding({ citations: [{ queryId: 'a' }], expectedQueryId: 'a' }).status === 'BOUND'
  && verifyEvidenceBinding({ citations: ['https://www.sec.gov/x'] }).checked === false);
// 호출자가 자기 요청 id를 말하지 않으면 판정할 수 없다 — 실패가 아니라 '판정 불가'로 남긴다(오탐 방지).
const unverifiable = evaluateResearchEvidenceFloor({ questionPlan: { ...currentPlan, queryId: null }, required: true, externalResult: asExternal({ ...officialDoc, queryId: 'query:whatever' }) });
check('P1172 research-floor reports an unjudgeable binding instead of failing closed on a missing caller id',
  unverifiable.ready === true && unverifiable.evidenceBinding.status === 'UNVERIFIABLE' && unverifiable.bindingChecked === false,
  JSON.stringify(unverifiable.evidenceBinding));
// E6/A05: `ready` alone used to be the only verdict, so a floor met with an unchecked binding was
// indistinguishable from one met with a verified binding. `bindingVerified` carries that boundary and
// P1172's reporting-only decision stays intact.
check('P1244 E6/A05 a ready floor with a verified binding is distinguishable from an unchecked one',
  ownRequest.bindingVerified === true
  && unboundRequest.ready === true && unboundRequest.bindingVerified === false
  && unverifiable.ready === true && unverifiable.bindingVerified === false
  && crossQuestion.bindingVerified === false,
  JSON.stringify({ own: ownRequest.bindingVerified, unbound: unboundRequest.bindingVerified, unverifiable: unverifiable.bindingVerified, cross: crossQuestion.bindingVerified }));
// P1245 (05 A05): the stamp must come from the stream's own immutable request id. This assertion
// used to pin the literal `requestId: window._aioActiveAIRequestId || null` — a mutable global that
// the response pipeline wrote and the citation collector read at a different moment, so a citation
// could be stamped with, or checked against, a *different concurrent* request. Pinning that literal
// made the gate defend the defect. These assertions pin the meaning instead: the collector stamps
// the request id its stream was started with, no shared request-id slot survives, and two
// interleaved streams cannot observe each other's citations (executed, not read as source text).
const chatSource = fs.readFileSync(new URL('../js/aio-chat.js', import.meta.url), 'utf8');
check('P1245 the chat citation collector stamps its own stream request id, not a shared global',
  /requestId: _streamRequestId, queryId: _streamRequestId/.test(chatSource)
  && !/window\._aioActiveAIRequestId/.test(chatSource)
  && !/window\._aioLastClaudeCitations/.test(chatSource)
  && !/window\._aioLastClaudeResearchError/.test(chatSource),
  'the collector must stamp the request id the stream was started with and no shared slot may remain');
const streamContext = vm.createContext({ window: {}, Date, String, Array, Object, Number, JSON });
vm.runInContext(chatSource.slice(chatSource.indexOf('var _AIO_AI_REQUEST_STREAM_LIMIT'), chatSource.indexOf('// P897: the ESM evidence module')), streamContext);
// 회귀(헬퍼 부재)는 크래시가 아니라 실패한 검사로 보고돼야 한다.
const streamHelpersReady = typeof streamContext._aioAIRequestStream === 'function'
  && typeof streamContext._aioAIRequestCitations === 'function';
let streamACites = [];
let streamBCites = [];
if (streamHelpersReady) {
  streamContext._aioAIRequestStream('req:b').citations.push({ url: 'https://b.example/evidence', requestId: 'req:b', queryId: 'req:b' });
  streamContext._aioAIRequestStream('req:a').citations.push({ url: 'https://a.example/evidence', requestId: 'req:a', queryId: 'req:a' });
  streamACites = streamContext._aioAIRequestCitations('req:a');
  streamBCites = streamContext._aioAIRequestCitations('req:b');
}
check('P1245 two interleaved chat streams do not share collected citations',
  streamHelpersReady
  && streamACites.length === 1 && streamACites[0].requestId === 'req:a'
  && streamBCites.length === 1 && streamBCites[0].requestId === 'req:b'
  && streamContext._aioAIRequestCitations('req:missing').length === 0
  && streamContext._aioAIRequestStream(null) === null,
  JSON.stringify({ helpers: streamHelpersReady, a: streamACites, b: streamBCites }));
// 결속이 판정되려면 호출자가 자기 요청 id를 넘겨야 한다 — 수집만 하고 넘기지 않으면 영원히 UNBOUND다.
const floorCallSites = chatSource.split('evaluateAIResearchEvidenceFloor({').slice(1);
check('P1172 every chat evidence-floor call declares the active request id',
  floorCallSites.length >= 1 && floorCallSites.every((chunk) => chunk.slice(0, 400).includes('requestId:')),
  `${floorCallSites.filter((chunk) => !chunk.slice(0, 400).includes('requestId:')).length} of ${floorCallSites.length} evidence-floor calls omit the request id`);

// ── P1172 (05 A04): 수치 조건을 해제하는 것은 수치 claim뿐 ──────────────────────────────────────
// A single claim of any type used to clear the untracked-numeric condition, so an unsourced
// current-fact number could ship alongside one unrelated text claim.
const numericProse = 'NVDA 주가는 180.5 USD이고 RSI는 62입니다.';
const textOnlyClaims = [{ claimId: 'c1', type: 'text', text: '시장 상황은 혼조입니다.', asOf: '2026-09-18', source: 'note', evidenceIds: ['e1'] }];
const textOnlyAudit = validateAnswerPlan(createAnswerPlan({ questionPlan: boundPlan, summary: numericProse, claims: textOnlyClaims }), { currentSensitive: true });
check('P1172 a text claim does not clear the untracked numeric condition',
  textOnlyAudit.ok === false && textOnlyAudit.errors.includes('untracked_numeric_content'), JSON.stringify(textOnlyAudit.errors));
const typedNumericAudit = validateAnswerPlan(createAnswerPlan({
  questionPlan: boundPlan,
  summary: numericProse,
  claims: [{ claimId: 'c1', type: 'metric', text: 'NVDA 종가', metric: 'price', entity: 'NVDA', value: 180.5, unit: 'USD', asOf: '2026-09-18', source: 'market-snapshot', evidenceIds: ['e1'], status: 'verified' }]
}), { currentSensitive: true });
check('P1172 a typed numeric claim clears the condition for its own numbers',
  !typedNumericAudit.errors.includes('untracked_numeric_content'), JSON.stringify(typedNumericAudit.errors));
const nonSensitiveAudit = validateAnswerPlan(createAnswerPlan({ questionPlan: boundPlan, summary: numericProse, claims: textOnlyClaims }), { currentSensitive: false });
check('P1172 the numeric condition stays scoped to current-sensitive answers',
  !nonSensitiveAudit.errors.includes('untracked_numeric_content'), JSON.stringify(nonSensitiveAudit.errors));
const capability = createResearchCapability({ provider: 'claude-native', routeReady: 'READY', authReady: 'READY', toolReady: 'READY', quotaReady: 'READY', originReady: 'READY', supportsCitations: true, supportsFullContent: true, supportsDomainControl: false, checkedAt: '2026-07-28T12:00:00Z' });
check('research-capability-separates-chat', capability.status === 'READY' && capability.chatReadiness === 'SEPARATE_CAPABILITY' && validateResearchCapability(capability).ok);
const boundedRunnerFailure = await createAIAnswerOrchestrator({ now: () => new Date('2026-07-28T12:00:00Z') }).execute({ query:'시장 원리', legacyRunner: async () => { throw new Error('secret internal detail'); } });
check('orchestrator-does-not-leak-runner-error', boundedRunnerFailure.error === 'legacy_runner_failed' && !JSON.stringify(boundedRunnerFailure).includes('secret internal detail'));

const chat = read('js/aio-chat.js');
const bindingContext = vm.createContext({ window: {}, URL });
vm.runInContext(chat.slice(chat.indexOf('function _aioAIClaimEvidenceId('), chat.indexOf('function _aioRunAIResponsePipeline(')), bindingContext);
const bindingRow = { evidenceId: 'quote:NVDA', metric: 'price', ticker: 'NVDA', scale: 'raw', value: 120, unit: 'USD', asOf: '2026-09-01T12:00:00Z', source: 'exchange', sourceUrl: 'https://nasdaq.com/quote/NVDA', status: 'ok' };
const bindingClaim = { claimId: 'quote', type: 'metric', metric: 'price', entity: 'NVDA', scale: 'raw', text: '주가', value: 120, unit: 'USD', asOf: bindingRow.asOf, source: 'exchange', evidenceIds: [bindingRow.evidenceId] };
const bind = (claim, rows = [bindingRow]) => bindingContext._aioBuildPublishableAnswerPlan({ claims: { claims: [claim] }, citations: ['https://evil.example/fake', bindingRow.sourceUrl] }, rows, true);
check('claim-binding-matching-value-unit-time-source-passes', bind(bindingClaim).plan.claims.claims.length === 1);
for (const [field, value] of [['metric', 'VIX'], ['entity', 'AAPL'], ['scale', 'millions'], ['metric', null], ['entity', null]]) {
  check(`claim-binding-rejects-wrong-identity-${field}-${value}`, bind({ ...bindingClaim, [field]: value }).droppedClaims.length === 1);
}
check('claim-binding-label-is-derived-from-bound-identity', bind({ ...bindingClaim, text: 'VIX' }).plan.claims.claims[0].text === 'NVDA · price');
check('claim-ledger-preserves-binding-identity', createClaimLedger([bindingClaim]).claims[0].metric === 'price' && createClaimLedger([bindingClaim]).claims[0].entity === 'NVDA' && createClaimLedger([bindingClaim]).claims[0].scale === 'raw');
for (const [field, value] of Object.entries({ value: 999, unit: 'KRW', asOf: '2026-09-02T12:00:00Z', source: 'fabricated-source' })) {
  check(`claim-binding-rejects-forged-${field}`, bind({ ...bindingClaim, [field]: value }).droppedClaims.length === 1);
}
check('claim-binding-strips-model-invented-citations', bind(bindingClaim).plan.citations.length === 1 && bind(bindingClaim).plan.citations[0] === bindingRow.sourceUrl);
check('claim-binding-unknown-status-fails-closed', bind(bindingClaim, [{ ...bindingRow, status: 'unreviewed' }]).plan.claims.claims.length === 0);
check('claim-binding-document-id-cannot-validate-invented-number', bind(bindingClaim, [{ ...bindingRow, value: null, unit: 'document' }]).plan.claims.claims.length === 0);
check('claim-binding-snippet-cannot-publish', bind(bindingClaim, [{ ...bindingRow, contentDepth: 'SNIPPET' }]).plan.claims.claims.length === 0);
check('claim-binding-numeric-prose-cannot-smuggle-conflicting-value', !bind({ ...bindingClaim, text: '주가는 999 USD' }).plan.claims.claims[0].text.includes('999'));
check('claim-binding-text-type-cannot-bypass-numeric-contract', bind({ ...bindingClaim, type: 'text', text: '현재 주가 999 USD' }).plan.claims.claims.length === 0);
const relabeledDoc = createEvidenceDocument({ canonicalUrl: 'https://example.com/a', publisher: 'sec.gov', source: 'SEC official', sourceTier: 'PRIMARY_OFFICIAL', contentDepth: 'EXCERPT' });
check('research-untrusted-label-cannot-promote-host', relabeledDoc.sourceTier === 'SECONDARY' && relabeledDoc.publisher === 'example.com');
const samePublisher = normalizeSearchResults([{ url: 'https://reuters.com/a', publisher: 'A' }, { url: 'https://reuters.com/b', publisher: 'B' }]);
check('research-relabeling-cannot-inflate-independence', samePublisher.independentSourceCount === 1);
check('research-unbound-id-is-rejected', !validateClaimEvidenceBinding({ evidenceIds: ['invented'] }, evidence).ok);
const data = read('js/aio-data.js');
const core = read('js/aio-core.js');
const bootstrap = read('src/app/bootstrap.js');
check('single-orchestrator-export', /getAIOrchestrator/.test(bootstrap) && /createAIAnswerOrchestrator/.test(bootstrap));
check('knowledge-retrieval-is-lazy-and-exposed-by-existing-orchestrator-boundary', /createAIKnowledgeRetriever/.test(bootstrap) && /knowledgeRetriever: aiKnowledgeRetriever/.test(bootstrap) && /buildAIKnowledgeContext/.test(read('src/ai/orchestrator/answer-orchestrator.js')));
// P1131/R619: the unified chat surface moved from index.html's inline block G into js/aio-chat.js,
// so every `_uni*` assertion in this file now reads the chat module.
check('both-chat-surfaces-consume-market-principles-and-ai-era-knowledge', /knowledgeOrchestrator\.buildAIKnowledgeContext\(q/.test(chat) && /knowledgeContextStr/.test(chat) && /_uniKnowledgeOrchestrator\.buildAIKnowledgeContext\(q/.test(chat) && /_uniKnowledgeAudit/.test(chat));
check('knowledge-pages-have-chat-contexts-and-unified-panel-mapping', /principles:_aioCreateEvidenceContext/.test(chat) && /atlas:_aioCreateEvidenceContext/.test(chat) && /'principles':'principles','atlas':'atlas'/.test(chat));
const publishedKnowledgeIndex = JSON.parse(read('public-data/knowledge/ai-retrieval-index.json'));
const knowledgeSourceLessons = new Map([
  ...JSON.parse(read('public-data/principles/lesson-library.json')).lessons.map((lesson) => [`principles:${lesson.id}`, lesson]),
  ...JSON.parse(read('public-data/atlas/foundation-lessons.json')).lessons.map((lesson) => [`atlas-foundations:${lesson.id}`, lesson])
]);
const nathanFrameworkArticles = new Map(JSON.parse(read('public-data/knowledge/nathan-frameworks.json')).articles.map((article) => [article.articleId, article]));
const integratedFrameworkArticles = new Map(JSON.parse(read('public-data/knowledge/integrated-market-ai-frameworks.json')).articles.map((article) => [article.articleId, article]));
const expectedKnowledgeArticleCount = knowledgeSourceLessons.size + nathanFrameworkArticles.size + integratedFrameworkArticles.size;
check('knowledge-index-has-full-parity-and-provenance', publishedKnowledgeIndex.schemaVersion === 'ai-knowledge-retrieval-index.v1' && publishedKnowledgeIndex.articles.length === expectedKnowledgeArticleCount && publishedKnowledgeIndex.counts.withRouteTargets === expectedKnowledgeArticleCount && publishedKnowledgeIndex.articles.every((article) => article.route?.deepLink && article.authoringStatus && article.publication));
check('knowledge-concept-links-match-explicit-source-not-word-overlap', publishedKnowledgeIndex.articles.every((article) => {
  const lesson = knowledgeSourceLessons.get(article.articleId);
  const framework = nathanFrameworkArticles.get(article.articleId);
  const integrated = integratedFrameworkArticles.get(article.articleId);
  if (framework) {
    return article.surface === 'nathan-frameworks'
      && JSON.stringify(article.conceptIds) === JSON.stringify([...new Set(framework.conceptIds || [])])
      && article.conceptLinkStatus === 'SOURCE_LINK'
      && article.candidateConceptStatus === 'NOT_APPLICABLE'
      && article.sources.length === 0;
  }
  if (integrated) {
    return article.surface === 'integrated-frameworks'
      && JSON.stringify(article.conceptIds) === JSON.stringify([...new Set(integrated.conceptIds || [])])
      && article.conceptLinkStatus === 'SOURCE_LINK'
      && article.candidateConceptStatus === 'NOT_APPLICABLE'
      && article.sources.length === 0;
  }
  if (!lesson) return false;
  const surface = article.surface === 'principles' ? 'principles' : 'atlas';
  const expected = [...new Set([...(lesson.nodeIds || []), ...(lesson.relatedAtlasNodeIds || [])])].map((id) => `${surface}:${id}`);
  return JSON.stringify(article.conceptIds) === JSON.stringify(expected) && article.conceptLinkStatus === (expected.length ? 'SOURCE_LINK' : 'UNMAPPED') && article.candidateConceptStatus === 'TEXT_CANDIDATE';
}));
check('knowledge-concept-coverage-reports-unmapped-truthfully', publishedKnowledgeIndex.counts.withConcepts === publishedKnowledgeIndex.articles.filter((article) => article.conceptIds.length).length && publishedKnowledgeIndex.counts.unmappedConcepts === publishedKnowledgeIndex.articles.filter((article) => !article.conceptIds.length).length);
check('knowledge-loader-never-fetches-article-monolith', read('src/ai/retrieval/knowledge.js').includes('ai-retrieval-index.json') && !read('src/ai/retrieval/knowledge.js').includes("indexUrl = './public-data/knowledge/articles.json'"));
// Both the per-page and the unified surface now live in js/aio-chat.js, so the invariant is that the
// wrapper appears at least twice there rather than once per file.
check('knowledge-reference-is-wrapped-as-untrusted-data', (chat.match(/buildAIUntrustedBlock\('KNOWLEDGE_REFERENCE'/g) || []).length >= 2);
check('unified-chat-renders-native-claude-citations', /_uniCitationResult/.test(chat) && /engine:'claude'/.test(chat) && /_aioAIRequestCitations\(_uniRequestId\)/.test(chat));
check('public-policy-allows-conditional-analysis-without-blanket-refusal', /가격 범위·무효화 수준·손절 기준·포트폴리오 비중은 시나리오와 계산 입력으로 분석할 수 있다/.test(chat) && /답변 전체를 안전 모드로 바꾸지 말고/.test(chat) && !/현재 답변에서는 구체적인 매수·매도·진입·청산 지시/.test(chat));
check('research-optout-degrades-current-claims-without-ending-chat', /web_research_disabled_by_user/.test(chat) && !/userOptOut\)[\s\S]{0,600}state\._chatSendEntered = 0;[\s\S]{0,180}return;/.test(chat));
check('chat-dispatches-through-orchestrator', /AIO_ARCH\.getAIOrchestrator/.test(chat) && /_aioOrchestrated/.test(chat));
check('orchestrator-downgrades-action-permission-to-a-disclosure', /actionPermission\.allowed === false/.test(read('src/ai/orchestrator/answer-orchestrator.js')) && /actionLimitations/.test(read('src/ai/orchestrator/answer-orchestrator.js')) && !/blocked-action-permission/.test(read('src/ai/orchestrator/answer-orchestrator.js')));
check('both-chat-surfaces-have-pre-provider-action-boundary', /_aioPreProviderPermission/.test(chat) && /_uniPreProviderPermission/.test(chat));
check('both-chat-surfaces-hide-unverified-research-streams', /Web Research 검증 중/.test(chat) && /Web Research 근거를 검증 중/.test(chat));
check('no-confirmed-verdict', !/verdict\s*=\s*[^;]*CONFIRMED/.test(data) && /RESEARCH_CANDIDATE/.test(data) && /research-relative-ranking-only/.test(data));
check('producer-observed-time', /producer observation time/.test(data) && /관측시각 미확인/.test(data));
check('probability-policy-is-strict', /calibrated !== true/.test(core) && /보정\(calibration\).*확률/.test(chat));

check('answer-format-is-question-adaptive', !/반드시 \*\*Bull\/Base\/Bear 3 시나리오/.test(chat) && /질문 복잡도에 맞춘다/.test(chat));
check('research-outage-degrades-instead-of-erasing-answer', /research-evidence-unavailable/.test(chat) && !/RESEARCH_REQUIRED_BUT_UNAVAILABLE/.test(chat) && /RESEARCH_EVIDENCE_UNAVAILABLE/.test(chat));
check('research-decision-is-key-independent', /createResearchDecision/.test(read('src/ai/research/decision.js')) && /provider keys,[\s\S]*deliberately not read/i.test(read('src/ai/research/decision.js')));
check('research-plan-is-wired-to-chat', /_aiResearchPlanSearch/.test(chat) && /researchPlan/.test(chat) && /RESEARCH_RESULTS_EMPTY/.test(chat));
check('research-capability-is-separate', /getAIResearchCapability/.test(bootstrap) && /validateAIResearchCapability/.test(bootstrap) && /chatReadiness/.test(read('src/ai/research/capability.js')));
// Both surfaces live in js/aio-chat.js now, so "shared" is asserted by occurrence count, not by file.
check('research-capability-drives-shared-preparation', (chat.match(/_aioPrepareAIResearch/g) || []).length >= 2 && /externalSearchReady/.test(chat) && /externalEvidenceReady/.test(chat) && /nativeFallbackRequired/.test(chat));
check('research-document-classification-is-centralized', /createAIResearchEvidenceDocument/.test(chat) && /createAIResearchEvidenceDocument/.test(bootstrap) && /createAIResearchEvidenceDocument/.test(read('src/legacy/compatibility-facade.js')));
check('research-native-tool-errors-are-promoted', /web_search_tool_result_error/.test(chat) && /_streamState\.researchError/.test(chat) && /_aioAIRequestResearchError/.test(chat) && !/window\._aioLastClaudeResearchError/.test(chat));
check('deep-search-has-no-fixed-year', !/(latest news earnings|policy outlook|geopolitical risk latest|investment trend latest) 2026/.test(chat));
check('research-gate-shared-by-both-surfaces', /evaluateAIResearchEvidenceFloor/.test(chat) && /_aioEvaluateAIResearchGate/.test(chat) && /_aioPrepareAIResearch/.test(chat));
check('research-result-canonical-nesting', /researchEvidence:\s*\{[\s\S]*evidenceDocuments:\s*evidenceDocuments/.test(chat) && !/\n\s*evidenceDocuments:\s*evidenceDocuments,\n\s*researchPlanId/.test(chat));
check('research-failures-retain-subquery-reasons', /subFailures/.test(chat) && /noResults\.failures\s*=\s*subFailures/.test(chat) && /_aioLastResearchAudit/.test(chat));
// The absence check stays pinned to index.html on purpose: the shell must never hold a global plan
// again even though the unified surface (which passes its own plan explicitly) now lives in chat.
check('request-plan-is-explicit-not-global', !chat.includes('_aioActiveQuestionPlan') && !read('index.html').includes('_aioActiveQuestionPlan') && chat.includes('questionPlan: questionPlan') && chat.includes('questionPlan: _uniQuestionPlan'));
check('research-partial-results-preserve-query-index', /settled\.map\(function\(row, index\)/.test(chat) && /specs\[item\.index\]\.queryId/.test(chat));
check('research-evidence-preserves-citation-producer-engine', /citationProducer/.test(chat) && /sourceType: citationEngine/.test(chat) && !/sourceType: fulfilled\[0\]\.result\.engine/.test(chat));
check('fred-official-host-is-correct', read('src/ai/research/evidence.js').includes("'fred.stlouisfed.org'"));
check('quote-provenance-is-persisted', core.includes('observedAt: observedAt') && core.includes('fetchedAt: fetchedAt') && core.includes('marketState: provenanceOpts.marketState'));
check('sentiment-does-not-stamp-missing-observation-now', !/raw\[field\.observedAt\]\s*\|\|\s*raw\.now/.test(read('src/data/orchestrators/sentiment.js')));
check('tam-numbers-require-source-and-observation', /tamMeta\.tam && tamMeta\.sourceUrl && tamMeta\.observedAt/.test(core) && /missingProvenance:\s*'withhold-numeric-output'/.test(core) && /출처·기준일이 검증된 시장규모가 없어 숫자를 표시하지 않습니다/.test(core));

if (failures.length) {
  console.error(`AI intelligence contract failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`AI intelligence contract OK (${cases.length} routing cases + AIQ-4 domain engines)`);
