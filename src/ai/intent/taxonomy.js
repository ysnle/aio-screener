export const AI_INTENT_TAXONOMY_VERSION = 'ai-intent-taxonomy.v2';

export const AI_INTENTS = Object.freeze([
  'MARKET_STATUS',
  'MARKET_CAUSAL',
  'OUTLOOK',
  'SECTOR_ANALYSIS',
  'ENTITY_ANALYSIS',
  'ENTITY_FACT',
  'COMPARISON',
  'TECHNICAL_ANALYSIS',
  'OPTIONS_ANALYSIS',
  'MACRO_ANALYSIS',
  'FX_ANALYSIS',
  'SCREENING',
  'NEWS_SUMMARY',
  'PORTFOLIO_ACTION',
  'EDUCATION',
  'UNKNOWN'
]);

const PATTERNS = Object.freeze({
  MARKET_STATUS: [/(시장|증시|코스피|코스닥|나스닥|s&p|spx).*(어때|상황|흐름|상승|하락|조정|반등)|장중|장전|장후/i],
  MARKET_CAUSAL: [/(왜|원인|이유|때문|무슨\s*일|영향|what.*caused|why|driven\s*by|because|impact)/i],
  OUTLOOK: [/(전망|앞으로|향후|반등할까|오를까|내릴까|예상|outlook|forecast|prospect|will\s+.*(?:rise|fall|rebound))/i],
  SECTOR_ANALYSIS: [/(테마|섹터|업종|산업|밸류체인|반도체|소프트웨어|광통신|광테마|전력|원전|방산|바이오|sector|industry|theme|semiconductor|software|SMH|SOXX|IGV)/i],
  ENTITY_ANALYSIS: [/(기업\s*분석|종목\s*분석|회사\s*분석|사업\s*모델|투자\s*포인트|분석해|어때|company\s*analysis|stock\s*analysis)/i],
  ENTITY_FACT: [/(주가|시세|가격|시가총액|PER|PBR|PSR|PEG|ROE|매출|영업이익|순이익|배당|실적|목표가|price|market\s*cap|revenue|earnings|dividend)/i],
  COMPARISON: [/(비교|대비|차이|어느\s*(?:쪽|것)|vs\.?|versus|compare|comparison|better)/i],
  TECHNICAL_ANALYSIS: [/(차트|기술적|기술\s*분석|RSI|MACD|이동평균|이평|지지|저항|돌파|추세|OHLCV|technical|chart|support|resistance|breakout)/i],
  OPTIONS_ANALYSIS: [/(옵션|내재변동성|변동성\s*스큐|감마|델타|세타|IV|GEX|0DTE|콜옵션|풋옵션|options?|implied\s*volatility|gamma|delta|theta)/i],
  MACRO_ANALYSIS: [/(금리|채권|국채|인플레이션|CPI|PCE|고용|NFP|GDP|연준|FOMC|유동성|VIX|공포.?탐욕|macro|fed|yield|treasury|inflation)/i],
  FX_ANALYSIS: [/(환율|원달러|달러원|USD.?KRW|달러\s*인덱스|DXY|엔화|위안|외환|fx|exchange\s*rate)/i],
  SCREENING: [/(스크리닝|스크리너|후보|골라|뽑아|찾아|어느\s*종목|뭐가\s*좋|저평가|고배당|퀀트|랭킹|screen|top\s*pick|best\s*stock)/i],
  NEWS_SUMMARY: [/(뉴스|헤드라인|속보|기사|공시\s*요약|발표\s*요약|요약|news|headline|what\s*happened|summarize)/i],
  PORTFOLIO_ACTION: [/(내\s*(?:포트폴리오|계좌)|보유\s*종목|리밸런싱|비중|매수|매도|진입|손절|익절|portfolio|my\s*holdings|rebalance|buy|sell|allocation)/i],
  EDUCATION: [/(무엇|뭐야|무슨\s*뜻|이란|뜻|개념|설명해|알려줘|배우|초보|원리|일반적(?:인)?\s*방법|어떻게\s*작동|what\s+is|how\s+does|explain|education)/i]
});

const CURRENT_PATTERN = /(지금|현재|오늘|장중|장전|장후|방금|최근|실시간|최신|이번\s*주|as\s*of|now|today|current|live|latest|recent)/i;
const HISTORICAL_PATTERN = /(과거|당시|지난\s*\d+|\b(?:19|20)\d{2}\b|historical|back\s+in)/i;
const ACTION_PATTERN = /(추천|매수|매도|진입|청산|손절|익절|비중|수량|포지션|리밸런싱|사야|팔아|recommend|buy|sell|entry|exit|stop.?loss|allocation|position)/i;
// Suitability is a pre-provider boundary for personalized or executable
// actions, not a vocabulary filter. Educational/conditional discussions may
// contain the same trading words and must still reach the analysis model.
const PERSONALIZED_ACTION_PATTERN = /(?:내\s*(?:계좌|포트폴리오|보유\s*종목)|나에게|내가).{0,40}(?:추천|매수|매도|진입|청산|손절|익절|비중|수량|포지션|리밸런싱|사야|팔아|recommend|buy|sell|allocation|position)|(?:추천|매수|매도|진입|청산|손절|익절|비중|수량|포지션|리밸런싱|recommend|buy|sell|allocation|position).{0,40}(?:내\s*(?:계좌|포트폴리오|보유\s*종목)|나에게|내가)/i;
const EXECUTABLE_ACTION_PATTERN = /(?:주문|체결|계좌\s*변경|실제로\s*주문|대신\s*거래).{0,24}(?:해줘|실행|넣어|매수|매도|청산)|(?:매수|매도|청산|리밸런싱)\s*(?:주문|실행|좀|대신)?\s*(?:해줘|넣어줘|실행해)/i;
const TICKER_PATTERN = /(?:^|\s|\()(\$?[A-Z]{1,6}(?:\.(?:KS|KQ))?)(?=$|\s|[),?!])/;
const NON_TICKER_TERMS = new Set(['AI', 'SEC', 'FOMC', 'FED', 'PER', 'PBR', 'ROE', 'RSI', 'MACD', 'CPI', 'PCE', 'NFP', 'GDP', 'VIX', 'ETF', 'FX', 'USD', 'KRW', 'IV', 'GEX']);
const QUOTE_NOW_PATTERN = /(주가|시세|가격|환율|원달러|달러원|USD.?KRW|VIX).{0,12}(얼마|어때|수준|알려|확인)|(?:얼마|현재가|시세).{0,12}(주가|환율|VIX)/i;

function normalize(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function matches(intent, text) {
  return (PATTERNS[intent] || []).some((pattern) => pattern.test(text));
}

export function classifyQuestionIntent(query, context = {}) {
  const text = normalize(query);
  const actionVocabularyPresent = ACTION_PATTERN.test(text);
  const personalizedActionRequested = PERSONALIZED_ACTION_PATTERN.test(text) || EXECUTABLE_ACTION_PATTERN.test(text);
  const scores = Object.fromEntries(AI_INTENTS.map((intent) => [intent, 0]));
  const hit = Object.fromEntries(AI_INTENTS.map((intent) => [intent, matches(intent, text)]));
  Object.keys(PATTERNS).forEach((intent) => { if (hit[intent]) scores[intent] += 2; });

  const route = String(context.route || '').toLowerCase();
  const tickerMatch = text.match(TICKER_PATTERN);
  const tickerToken = tickerMatch ? tickerMatch[1].replace(/^\$/, '').toUpperCase() : '';
  const hasTicker = Boolean(tickerToken && !NON_TICKER_TERMS.has(tickerToken));
  if (/^(themes|theme-detail|kr-themes)$/.test(route)) scores.SECTOR_ANALYSIS += 5;
  if (/^(ticker|fundamental|company)$/.test(route)) scores.ENTITY_ANALYSIS += 4;
  if (/^(technical|signal|kr-tech|kr-technical)$/.test(route)) scores.TECHNICAL_ANALYSIS += 5;
  if (/^(macro|kr-macro)$/.test(route)) scores.MACRO_ANALYSIS += 4;
  if (route === 'fxbond') scores.FX_ANALYSIS += 4;
  if (route === 'options') scores.OPTIONS_ANALYSIS += 5;
  if (route === 'portfolio') scores.PORTFOLIO_ACTION += 5;
  if (route === 'screener') scores.SCREENING += 5;
  if (hasTicker && !hit.ENTITY_FACT) scores.ENTITY_ANALYSIS += 4;
  if (hasTicker && hit.ENTITY_FACT) scores.ENTITY_FACT += 5;

  // Explicit user operations outrank broad page context. Causal/comparison are
  // composite intents and keep their domain intent as a secondary signal.
  if (hit.MARKET_CAUSAL) scores.MARKET_CAUSAL += 7;
  if (hit.COMPARISON) scores.COMPARISON += 7;
  if (hit.OPTIONS_ANALYSIS) scores.OPTIONS_ANALYSIS += 9;
  if (hit.SCREENING) scores.SCREENING += 5;
  if (hit.NEWS_SUMMARY) scores.NEWS_SUMMARY += 4;
  if (hit.OUTLOOK) scores.OUTLOOK += 3;
  if (hit.EDUCATION && !hit.OUTLOOK && !hit.MARKET_CAUSAL && !hit.COMPARISON && !hit.SCREENING) scores.EDUCATION += 8;
  if (hit.SECTOR_ANALYSIS && hit.OUTLOOK) scores.SECTOR_ANALYSIS += 4;
  if (hasTicker && !hit.ENTITY_FACT && !hit.COMPARISON) scores.ENTITY_ANALYSIS += 3;
  if ((hit.OPTIONS_ANALYSIS || hit.TECHNICAL_ANALYSIS || hit.SECTOR_ANALYSIS) && !/(기업|종목|회사|사업|투자\s*포인트|어때|company|stock\s*analysis)/i.test(text)) scores.ENTITY_ANALYSIS = 0;

  if (!text) scores.UNKNOWN = 1;
  const ranked = AI_INTENTS
    .filter((intent) => intent !== 'UNKNOWN')
    .map((intent) => ({ intent, score: scores[intent] }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || AI_INTENTS.indexOf(a.intent) - AI_INTENTS.indexOf(b.intent));
  if (!ranked.length) ranked.push({ intent: 'UNKNOWN', score: 0 });

  const primary = ranked[0].intent;
  const explicitCurrent = CURRENT_PATTERN.test(text) && !HISTORICAL_PATTERN.test(text);
  const inherentlyCurrent = QUOTE_NOW_PATTERN.test(text) ||
    (hasTicker && /(?:주가|시세|가격|현재가|price|quote)/i.test(text)) ||
    (!HISTORICAL_PATTERN.test(text) && ranked.some((row) => row.intent === 'OUTLOOK'));
  const currentSensitive = explicitCurrent || inherentlyCurrent || (primary === 'MARKET_STATUS' && !HISTORICAL_PATTERN.test(text));
  const requestedDepth = /(깊이|심층|자세히|종합|deep|detailed|comprehensive)/i.test(text)
    ? 'deep' : /(간단|짧게|요약|한줄|brief|short)/i.test(text) ? 'brief' : 'standard';

  return Object.freeze({
    taxonomyVersion: AI_INTENT_TAXONOMY_VERSION,
    primary,
    intents: Object.freeze(ranked.slice(0, 6).map((row) => row.intent)),
    scores: Object.freeze({ ...scores }),
    confidence: ranked[0].score >= 7 ? 'high' : ranked[0].score >= 3 ? 'medium' : 'low',
    // Keep analytical action intent visible to evidence/capability planning,
    // while separating the much narrower suitability/execution boundary.
    actionRequested: actionVocabularyPresent,
    actionVocabularyPresent,
    personalizedActionRequested,
    currentSensitive,
    explicitCurrent,
    inherentlyCurrent,
    requestedDepth
  });
}
