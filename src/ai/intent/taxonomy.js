export const AI_INTENT_TAXONOMY_VERSION = 'ai-intent-taxonomy.v1';

export const AI_INTENTS = Object.freeze([
  'MARKET_STATUS',
  'MARKET_CAUSAL',
  'OUTLOOK',
  'SECTOR_ANALYSIS',
  'ENTITY_ANALYSIS',
  'ENTITY_FACT',
  'TECHNICAL_ANALYSIS',
  'MACRO_ANALYSIS',
  'FX_ANALYSIS',
  'SCREENING',
  'NEWS_SUMMARY',
  'PORTFOLIO_ACTION',
  'EDUCATION',
  'UNKNOWN'
]);

const DEFINITIONS = Object.freeze({
  MARKET_STATUS: [/(지금|현재|오늘|장중|장전|장후|시장|증시|하락|상승|조정|반등)/i],
  MARKET_CAUSAL: [/(왜|원인|이유|무슨 이유|what.*caused|why)/i],
  OUTLOOK: [/(반등할까|오를까|내릴까|전망|예상|앞으로|회복|반등 가능|outlook|will .* rebound|forecast)/i],
  SECTOR_ANALYSIS: [/(섹터|업종|산업|반도체|소프트웨어|software|semiconductor|sector|industry|IGV|SMH|SOXX)/i],
  ENTITY_ANALYSIS: [/(기업 분석|종목 분석|기업 어때|어때|분석해|투자 포인트|사업|재무|밸류에이션|company|stock analysis)/i],
  ENTITY_FACT: [/(시총|주가|가격|per|pbr|매출|영업이익|배당|실적|티커|market cap|price|revenue)/i],
  TECHNICAL_ANALYSIS: [/(차트|기술적|rsi|macd|이동평균|이평|지지|저항|추세|ohlcv|technical|chart)/i],
  MACRO_ANALYSIS: [/(금리|인플레이션|cpi|pce|고용|nfp|fed|연준|국채|vix|fear.?greed|macro|macro)/i],
  FX_ANALYSIS: [/(환율|원달러|달러.?원|usd.?krw|달러|dxy|엔화|위안|fx|exchange rate)/i],
  SCREENING: [/(추천|종목|후보|찾아|골라|뽑아|랭킹|스크리너|저평가|성장주|배당주|recommend|top pick|best stock|screen)/i],
  NEWS_SUMMARY: [/(뉴스|이벤트|헤드라인|속보|기사|news|headline|what happened)/i],
  PORTFOLIO_ACTION: [/(내 포트폴리오|보유 종목|계좌|리밸런싱|비중|포지션|매수|매도|진입|손절|portfolio|rebalance|buy|sell)/i],
  EDUCATION: [/(무엇|뭐야|뜻|개념|설명해|배우|초보|how does|what is|explain|교육)/i]
});

const ACTION_PATTERN = /(추천|매수|매도|진입|청산|손절|익절|비중|포지션|리밸런싱|사야|팔아|recommend|buy|sell|entry|exit|stop.?loss|allocation|position)/i;
const CURRENT_PATTERN = /(지금|현재|오늘|장중|장전|장후|방금|최근|실시간|as.?of|now|today|current|live|latest)/i;

function normalize(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

export function classifyQuestionIntent(query, context = {}) {
  const text = normalize(query);
  const scores = Object.fromEntries(AI_INTENTS.map((intent) => [intent, 0]));
  Object.entries(DEFINITIONS).forEach(([intent, patterns]) => {
    patterns.forEach((pattern) => { if (pattern.test(text)) scores[intent] += 1; });
  });
  // Domain-specific routes outrank generic status/causal words. This keeps
  // "환율 왜 이래?" in FX_ANALYSIS and "반등할까?" in OUTLOOK instead of
  // letting the broad MARKET_STATUS pattern win a tie.
  if (DEFINITIONS.FX_ANALYSIS.some((pattern) => pattern.test(text))) scores.FX_ANALYSIS += 3;
  if (DEFINITIONS.SECTOR_ANALYSIS.some((pattern) => pattern.test(text))) scores.SECTOR_ANALYSIS += 2;
  if (DEFINITIONS.OUTLOOK.some((pattern) => pattern.test(text))) scores.OUTLOOK += 2;
  if (DEFINITIONS.PORTFOLIO_ACTION.some((pattern) => pattern.test(text))) scores.PORTFOLIO_ACTION += 2;
  if (/(지금|현재|오늘|장중|실시간).*(하락|상승|조정|반등)|(?:하락|상승|조정|반등)\s*중/i.test(text)) scores.MARKET_STATUS += 3;
  if (context.route === 'portfolio' || /portfolio|포트폴리오/i.test(String(context.route || ''))) scores.PORTFOLIO_ACTION += 2;
  if (context.route === 'screener') scores.SCREENING += 2;
  if (context.route === 'technical') scores.TECHNICAL_ANALYSIS += 2;
  if (context.route === 'macro' || context.route === 'fxbond') scores.MACRO_ANALYSIS += 2;
  if (context.route === 'themes' || context.route === 'theme-detail') scores.SECTOR_ANALYSIS += 2;
  if (!text) scores.UNKNOWN = 1;
  const ranked = AI_INTENTS
    .filter((intent) => intent !== 'UNKNOWN')
    .map((intent) => ({ intent, score: scores[intent] }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || AI_INTENTS.indexOf(a.intent) - AI_INTENTS.indexOf(b.intent));
  if (!ranked.length) ranked.push({ intent: 'UNKNOWN', score: 0 });
  const primary = ranked[0].intent;
  const actionRequested = ACTION_PATTERN.test(text);
  // Domain intent alone is not proof that a question asks for a current fact.
  // For example, "채권 금리가 뭐야?" is a static concept explanation even
  // though it routes through MACRO_ANALYSIS. Currentness comes from explicit
  // time language or a market-status/causal intent.
  const currentSensitive = CURRENT_PATTERN.test(text) || ['MARKET_STATUS', 'MARKET_CAUSAL'].includes(primary);
  const requestedDepth = /깊이|심층|자세히|deep|detailed/i.test(text) ? 'deep' : /간단|짧게|요약|brief/i.test(text) ? 'brief' : 'standard';
  return Object.freeze({
    taxonomyVersion: AI_INTENT_TAXONOMY_VERSION,
    primary,
    intents: Object.freeze(ranked.slice(0, 4).map((row) => row.intent)),
    scores: Object.freeze({ ...scores }),
    confidence: ranked[0].score >= 2 ? 'high' : ranked[0].score === 1 ? 'medium' : 'low',
    actionRequested,
    currentSensitive,
    requestedDepth
  });
}
