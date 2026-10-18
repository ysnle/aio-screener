export const AI_CONDUCT_POLICY_VERSION = 'ai-conduct.v2';

const POLICY_ROWS = Object.freeze([
  { id: 'mnpi', severity: 'P0', mode: 'prohibited', pattern: /(?:미공개|내부정보|inside\s+information|material\s+nonpublic|mnpi)/i },
  { id: 'market-manipulation', severity: 'P0', mode: 'prohibited', pattern: /(?:시세조종|시장조작|market\s+manipulation|pump\s*(?:and|&)\s*dump|펌프\s*앤\s*덤프)/i },
  { id: 'wash-trading', severity: 'P0', mode: 'prohibited', pattern: /(?:wash\s+trading|자전거래)/i },
  { id: 'front-running', severity: 'P0', mode: 'prohibited', pattern: /(?:선행매매|front[- ]running)/i },
  { id: 'rumor-amplification', severity: 'P0', mode: 'prohibited', pattern: /(?:허위루머|거짓\s*소문|false\s+rumou?r|rumou?r\s+amplif)/i },
  { id: 'restricted-security', severity: 'P0', mode: 'prohibited', pattern: /(?:restricted\s+security|거래제한\s*종목|제한\s*증권)/i },
  { id: 'leverage-risk', severity: 'P1', mode: 'conditional-analysis', pattern: /(?:레버리지|옵션|선물|마진|leverage|options?|futures?|margin)/i },
  { id: 'jurisdictional-advice', severity: 'P1', mode: 'legal-scope', pattern: /(?:세법|세금|법률|법적으로|규제|regulatory|legal\s+advice|\bsec\b|\bfinra\b|\btax\b|compliance|양도세|증권법|투자자문업)/i }
]);

const EDUCATIONAL = /(?:무엇|뭐야|뭐지|설명|원리|개념|정의|차이|비교|영향|전망|위험|리스크|작동|의미|구조|사례|체크리스트|what\s+is|explain|how\s+does|overview|outlook|risk|difference|compare)/i;
const PERSONALIZED = /(?:내\s*(?:계좌|거래|세금|포트폴리오|상황)|제가|나는|나한테|보유\s*종목|my\s+(?:account|trade|tax|portfolio|holdings)|for\s+me)/i;
const OPERATIONAL = /(?:방법|단계|먼저|활용|퍼뜨|조작|실행|우회|숨기|회피|하라|하세요|how\s+to|steps?|execute|use\s+it|evade|bypass)/i;
// v57.84: a prohibited topic is blocked only when the request asks how to do it. "왜 불법인지 설명하세요" or "선행매매 탐지
// 방법" is defensive education; the old operational test fired on any 하세요/방법 and blocked it.
// v57.88 (review): the defensive words won over an execution request, so "감시 피하려면 시세조종을 어떻게 숨기나요" and
// "왜 … 안 알려줘? 단계별로" passed as education. Evading surveillance is blocked whatever else the sentence says, and
// a bare "왜" no longer cancels an explicit how-to / step-by-step request. Victim-side questions ("당하지 않으려면") stay.
const DEFENSIVE = /(?:탐지|적발|감시|처벌|불법인지|위법인지|피하려면|당하지|예방|detect)/i;
const WHY = /(?:왜\s|why\s)/i;
// Briefing audit 2026-10-17: "탐지 안 되게" asks to evade detection; 탐지 alone had read it as defensive.
const EVASION = /(?:(?:감시|적발|단속|추적|조사|금감원|금융당국|당국|거래소|감독)\S*\s*(?:피|안\s*당|안\s*걸|우회|빠져)|(?:탐지|적발|감시)\S*\s*안\s*(?:되|당|걸)|들키지|안\s*걸리게|걸리지\s*않게|avoid\s+(?:detection|surveillance)|without\s+getting\s+caught|evade\s+(?:detection|surveillance))/i;
const STRONG_EXECUTION = /(?:하는\s*법|실행\s*단계|단계별|step[- ]by[- ]step|how\s+to\s+(?:do|use|run))/i;
// v57.92 (internal audit A01): one defensive word anywhere ("처벌과 실행 단계를 함께") cancelled an explicit execution
// request. Only a how-to that is itself defensive ("탐지하는 법", "단계별 적발 사례") is exempt; the strong execution test
// runs on what is left after those phrases are removed.
const DEFENSIVE_HOW_TO = /(?:(?:탐지|적발|감시|예방|식별|구별|알아채|신고)\s*(?:하는\s*법|하는\s*방법|방법|단계)|단계별\s*(?:탐지|적발|감시|처벌|예방|신고)|(?:불법인지|위법인지|처벌\S*|탐지\S*|적발\S*)\s*단계별(?:로)?|how\s+to\s+(?:detect|spot|report|avoid\s+being))/gi;
// Briefing audit 2026-10-17: "부풀리려면 어떻게 해야 돼?" and "…로 돈 버는 법" are how-to requests (they read as education).
const EXECUTION = /(?:려면\s*어떻게|어떻게\s*(?:해야|하면|하나|하죠)|버는\s*법|퍼뜨|조작하|우회|숨기|회피|(?:활용|이용)\s*(?:방법|법|하는\s*법)|하는\s*법|실행\s*단계|단계별|step[- ]by[- ]step|evade|bypass|execute|how\s+to\s+(?:do|use|run))/i;
const DIRECT_MARKET_ACTION = /(?:매수|매도|추가매수|진입|청산|손절|익절|목표가|진입가|손절가|비중|포지션|리밸런싱|buy|sell|trade|allocate|position|stop[- ]?loss|take[- ]?profit)/i;
const LEGAL_DETERMINATION = /(?:신고(?:해야|할까|의무)|납부(?:해야|할까|의무)|합법(?:인가|이야|입니까)|불법(?:인가|이야|입니까)|법적으로\s*(?:가능|문제|해야|허용)|(?:세금|양도세)\s*(?:얼마|계산|내야)|규제\s*(?:준수|위반)|법률\s*자문|legal\s+advice|is\s+it\s+legal|tax\s+(?:filing|liability)|must\s+i\s+(?:file|pay))/i;
// A bare SEC/FINRA/규제 mention is disclosure context; tax and compliance terms make a trade question a legal-scope one.
const LEGAL_SUBSTANCE = /(?:세법|세금|양도세|법률|법적으로|규제\s*준수|\btax\b|compliance|legal)/i;
const RESPONSE_LEGAL_DIRECTIVE = /(?:세금\s*(?:신고|납부)|법률상\s*(?:의무|허용)|규제\s*준수).{0,40}(?:하세요|해야\s*합니다|의무입니다|가능합니다)/i;

export function getAIConductPolicy() {
  return Object.freeze({
    version: AI_CONDUCT_POLICY_VERSION,
    matrix: Object.freeze(POLICY_ROWS.map(({ id, severity, mode }) => Object.freeze({ id, severity, mode }))),
    statuses: Object.freeze(['BLOCKED_P0', 'EDUCATIONAL_ALLOWED']),
    requestModes: Object.freeze(['PROHIBITED_INSTRUCTION', 'LEGAL_TAX_ANALYSIS', 'CONDITIONAL_ANALYSIS', 'EDUCATIONAL']),
    // E6/A06: a request is classified before an answer exists; a response is audited after one does.
    // They are different surfaces of this one policy and must not share a classifier.
    responseModes: Object.freeze(['LEGAL_DIRECTIVE', 'COMPLIANT']),
    surfaces: Object.freeze({
      request: 'classifyAIRequest',
      response: 'auditAIResponse',
      legacyComposite: 'classifyAIConduct'
    }),
    requiredEvidenceForResponseAudit: Object.freeze(['query', 'responseText'])
  });
}

// E6/A06: the request surface. It never reads an answer, so a plan cannot be re-classified by text
// that does not exist yet (the question planner runs before any model output).
export function classifyAIRequest({ query = '' } = {}) {
  const queryText = String(query || '').trim();
  const categories = POLICY_ROWS.filter((row) => row.pattern.test(queryText)).map((row) => row.id);
  const prohibitedCategories = POLICY_ROWS.filter((row) => row.mode === 'prohibited' && categories.includes(row.id)).map((row) => row.id);
  const educational = EDUCATIONAL.test(queryText);
  const personalized = PERSONALIZED.test(queryText);
  const directAction = DIRECT_MARKET_ACTION.test(queryText);
  const operational = OPERATIONAL.test(queryText);
  const asksLegalDetermination = LEGAL_DETERMINATION.test(queryText);

  const defensive = DEFENSIVE.test(queryText);
  const evasion = EVASION.test(queryText);
  const strongExecution = STRONG_EXECUTION.test(queryText.replace(DEFENSIVE_HOW_TO, ' '));
  const asksExecution = evasion || strongExecution || (!defensive
    && !WHY.test(queryText) && (EXECUTION.test(queryText) || (operational && !educational)));
  // Briefing audit 2026-10-17: trading on non-public information is the act itself ("미공개 정보로 매수해도 돼?").
  const mnpiTrade = categories.includes('mnpi') && directAction && !defensive && !educational && !asksLegalDetermination;
  if (prohibitedCategories.length && (asksExecution || mnpiTrade)) {
    return Object.freeze({
      version: AI_CONDUCT_POLICY_VERSION, requestMode: 'PROHIBITED_INSTRUCTION',
      status: 'BLOCKED_P0', severity: 'P0', categories: Object.freeze(categories),
      execution: true, educational, personalized, directAction,
      legalReviewRequired: false,
      reasons: Object.freeze(prohibitedCategories.map((id) => `prohibited-conduct:${id}`))
    });
  }

  // v57.84: a stock question that merely mentions the SEC or regulation ("SEC 공시 보고 매수할까?") is market analysis;
  // the jurisdiction/fact-pattern mode needs an actual legal or tax determination in the question.
  const legalTaxAnalysis = categories.includes('jurisdictional-advice') && (asksLegalDetermination || ((personalized || directAction) && LEGAL_SUBSTANCE.test(queryText)));
  if (legalTaxAnalysis) {
    return Object.freeze({
      version: AI_CONDUCT_POLICY_VERSION, requestMode: 'LEGAL_TAX_ANALYSIS',
      status: 'EDUCATIONAL_ALLOWED', severity: 'P1', categories: Object.freeze(categories),
      execution: directAction || operational, educational, personalized, directAction,
      legalReviewRequired: false, jurisdictionContextRequired: true,
      reasons: Object.freeze(['jurisdiction-and-facts-required'])
    });
  }

  const conditional = directAction || categories.includes('leverage-risk');
  return Object.freeze({
    version: AI_CONDUCT_POLICY_VERSION,
    requestMode: conditional ? 'CONDITIONAL_ANALYSIS' : 'EDUCATIONAL',
    status: 'EDUCATIONAL_ALLOWED', severity: categories.length ? 'P1' : 'NONE',
    categories: Object.freeze(categories), execution: directAction, educational: educational || !directAction,
    personalized, directAction, legalReviewRequired: false, reasons: Object.freeze([])
  });
}

// E6/A06: the response surface. It keeps the request classification it was given and records the
// response finding separately (`responseCompliance`), so a directive found in an answer cannot be
// mistaken for a property of the request.
export function auditAIResponse({ query = '', responseText = '' } = {}) {
  const request = classifyAIRequest({ query });
  const responseLegalDirective = RESPONSE_LEGAL_DIRECTIVE.test(String(responseText || '').trim());
  const responseCompliance = Object.freeze({
    mode: responseLegalDirective ? 'LEGAL_DIRECTIVE' : 'COMPLIANT',
    directive: responseLegalDirective,
    requestMode: request.requestMode
  });
  if (responseLegalDirective) {
    return Object.freeze({
      ...request, requestMode: 'LEGAL_TAX_ANALYSIS',
      status: 'EDUCATIONAL_ALLOWED', severity: 'P1',
      execution: request.directAction || request.execution,
      legalReviewRequired: false, jurisdictionContextRequired: true,
      reasons: Object.freeze(['jurisdiction-and-facts-required']),
      responseCompliance
    });
  }
  return Object.freeze({ ...request, responseCompliance });
}

// Legacy composite kept for the bridged consumers: it routes to the request surface when no answer
// was supplied and to the response surface when one was. Its output shape is unchanged.
export function classifyAIConduct({ query = '', responseText = '' } = {}) {
  const answerText = String(responseText || '').trim();
  return answerText ? auditAIResponse({ query, responseText: answerText }) : classifyAIRequest({ query });
}

export function buildScopedConductFallback(audit = {}) {
  if (audit.status === 'BLOCKED_P0') {
    return '요청한 실행 방법은 제공할 수 없습니다. 대신 해당 행위가 왜 시장 공정성을 훼손하는지, 탐지 신호와 합법적인 리서치 대안을 설명할 수 있습니다.';
  }
  if (audit.requestMode === 'LEGAL_TAX_ANALYSIS') {
    return [
      '법률·세무 분석의 전제와 확인 범위입니다.',
      '',
      '- 먼저 관할 국가, 계좌 유형, 상품 종류, 거래일과 보유기간을 구분하세요.',
      '- 일반 원리, 가능한 시나리오, 계산 구조와 판단 근거를 설명하되 관할·사실관계가 빠진 부분은 가정으로 표시합니다.',
      '- 실제 신고·계약·분쟁 대응 전에는 답변에 표시된 공식 규정의 기준일과 적용 조건을 재확인하세요.'
    ].join('\n');
  }
  return '';
}
