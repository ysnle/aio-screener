import { classifyQuestionIntent } from '../intent/taxonomy.js';
import { resolveEntities } from '../entity/resolver.js';
import { createMarketSessionEvidence, resolveQuestionTime } from '../time/market-session.js';
import { evaluateQuestionActionPermission } from '../policy/suitability.js';
import { createCapabilityPlan } from './capability-planner.js';

export const AI_QUESTION_PLAN_VERSION = 'question-plan.v1';

const REQUIRED_BY_INTENT = Object.freeze({
  MARKET_STATUS: ['market-session', 'market-snapshot'],
  MARKET_CAUSAL: ['market-session', 'market-snapshot', 'news'],
  OUTLOOK: ['market-snapshot', 'technical', 'news'],
  SECTOR_ANALYSIS: ['market-snapshot', 'sector-constituents', 'breadth'],
  ENTITY_ANALYSIS: ['entity-quote', 'fundamentals', 'filing', 'news'],
  ENTITY_FACT: ['entity-quote'],
  TECHNICAL_ANALYSIS: ['technical'],
  MACRO_ANALYSIS: ['macro'],
  FX_ANALYSIS: ['fx-quote', 'rates', 'cross-asset'],
  SCREENING: ['screener'],
  NEWS_SUMMARY: ['news'],
  PORTFOLIO_ACTION: ['portfolio-consent', 'portfolio', 'entity-quote'],
  EDUCATION: [],
  UNKNOWN: []
});

function hash(value) {
  let result = 2166136261;
  for (const char of String(value)) result = Math.imul(result ^ char.charCodeAt(0), 16777619);
  return `q-${(result >>> 0).toString(16)}`;
}

function premise(query, currentSensitive) {
  const text = String(query || '');
  const assertions = [];
  if (/(지금|현재|오늘).*(하락|상승|장중)|하락 중|상승 중/i.test(text)) assertions.push({ text: text.slice(0, 160), status: 'unverified', requires: ['market-session', 'market-snapshot'] });
  return Object.freeze({ status: assertions.length ? 'needs-verification' : 'none', assertions: Object.freeze(assertions), currentSensitive });
}

export function createQuestionPlan({ query = '', route = null, now = new Date(), root = globalThis, sessionSchedule = null, userLevel = null } = {}) {
  const normalized = String(query || '').trim();
  const intent = classifyQuestionIntent(normalized, { route });
  const entities = resolveEntities(normalized, { root, route });
  const time = resolveQuestionTime(normalized, now);
  const currentSensitive = intent.currentSensitive || time.currentSensitive;
  const requiredEvidence = [...(REQUIRED_BY_INTENT[intent.primary] || [])];
  const sessionEvidence = currentSensitive ? createMarketSessionEvidence({ now, schedule: sessionSchedule, market: 'US' }) : null;
  if (currentSensitive && !requiredEvidence.includes('market-session')) requiredEvidence.unshift('market-session');
  const plan = {
    schemaVersion: AI_QUESTION_PLAN_VERSION,
    queryId: hash(`${route || 'unknown'}:${normalized}`),
    query: normalized.slice(0, 1000),
    route: route || null,
    intent,
    entities,
    market: entities.entities.some((entity) => entity.market === 'KR') ? 'KR' : 'US',
    timeframe: time.timeframe,
    requestedDepth: intent.requestedDepth,
    userLevel: userLevel || 'unspecified',
    premise: premise(normalized, currentSensitive),
    currentSensitive,
    requiredEvidence: Object.freeze([...new Set(requiredEvidence)]),
    optionalEvidence: Object.freeze(intent.primary === 'FX_ANALYSIS' ? ['news', 'flows', 'policy-comments'] : ['news', 'research-reference']),
    requiredTools: Object.freeze([...new Set(requiredEvidence.filter((item) => item !== 'market-session'))]),
    suitabilityRequired: intent.actionRequested || intent.primary === 'PORTFOLIO_ACTION',
    actionPermission: evaluateQuestionActionPermission({ questionPlan: intent, suitabilityProfile: null, evidenceComplete: false }),
    clarificationQuestions: Object.freeze(entities.ambiguous ? ['어느 시장의 어떤 종목/ETF를 말하는지 티커 또는 거래소를 알려주세요.'] : []),
    sessionEvidence,
    generatedAt: new Date(now).toISOString()
  };
  plan.capabilityPlan = createCapabilityPlan(plan);
  return Object.freeze(plan);
}
