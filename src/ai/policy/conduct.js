export const AI_CONDUCT_POLICY_VERSION = 'ai-conduct.v2';

const POLICY_ROWS = Object.freeze([
  { id: 'mnpi', severity: 'P0', mode: 'prohibited', pattern: /(?:미공개|내부정보|inside\s+information|material\s+nonpublic|mnpi)/i },
  { id: 'market-manipulation', severity: 'P0', mode: 'prohibited', pattern: /(?:시세조종|시장조작|market\s+manipulation|pump\s*(?:and|&)\s*dump|펌프\s*앤\s*덤프)/i },
  { id: 'wash-trading', severity: 'P0', mode: 'prohibited', pattern: /(?:wash\s+trading|자전거래)/i },
  { id: 'front-running', severity: 'P0', mode: 'prohibited', pattern: /(?:선행매매|front[- ]running)/i },
  { id: 'rumor-amplification', severity: 'P0', mode: 'prohibited', pattern: /(?:허위루머|거짓\s*소문|false\s+rumou?r|rumou?r\s+amplif)/i },
  { id: 'restricted-security', severity: 'P0', mode: 'prohibited', pattern: /(?:restricted\s+security|거래제한\s*종목|제한\s*증권)/i },
  { id: 'leverage-risk', severity: 'P1', mode: 'conditional-analysis', pattern: /(?:레버리지|옵션|선물|마진|leverage|options?|futures?|margin)/i },
  { id: 'jurisdictional-advice', severity: 'P1', mode: 'legal-scope', pattern: /(?:세법|세금|법률|법적으로|규제|regulatory|legal\s+advice|sec\b|finra\b|tax\b|compliance|증권법|투자자문업)/i }
]);

const EDUCATIONAL = /(?:무엇|뭐야|뭐지|설명|원리|개념|정의|차이|비교|영향|전망|위험|리스크|작동|의미|구조|사례|체크리스트|what\s+is|explain|how\s+does|overview|outlook|risk|difference|compare)/i;
const PERSONALIZED = /(?:내\s*(?:계좌|거래|세금|포트폴리오|상황)|제가|나는|나한테|보유\s*종목|my\s+(?:account|trade|tax|portfolio|holdings)|for\s+me)/i;
const OPERATIONAL = /(?:방법|단계|먼저|활용|퍼뜨|조작|실행|우회|숨기|회피|하라|하세요|how\s+to|steps?|execute|use\s+it|evade|bypass)/i;
const DIRECT_MARKET_ACTION = /(?:매수|매도|추가매수|진입|청산|손절|익절|목표가|진입가|손절가|비중|포지션|리밸런싱|buy|sell|trade|allocate|position|stop[- ]?loss|take[- ]?profit)/i;
const LEGAL_DETERMINATION = /(?:신고(?:해야|할까|의무)|납부(?:해야|할까|의무)|합법(?:인가|이야|입니까)|불법(?:인가|이야|입니까)|법적으로\s*(?:가능|문제|해야|허용)|세금\s*(?:얼마|계산|내야)|규제\s*(?:준수|위반)|법률\s*자문|legal\s+advice|is\s+it\s+legal|tax\s+(?:filing|liability)|must\s+i\s+(?:file|pay))/i;
const RESPONSE_LEGAL_DIRECTIVE = /(?:세금\s*(?:신고|납부)|법률상\s*(?:의무|허용)|규제\s*준수).{0,40}(?:하세요|해야\s*합니다|의무입니다|가능합니다)/i;

export function getAIConductPolicy() {
  return Object.freeze({
    version: AI_CONDUCT_POLICY_VERSION,
    matrix: Object.freeze(POLICY_ROWS.map(({ id, severity, mode }) => Object.freeze({ id, severity, mode }))),
    statuses: Object.freeze(['BLOCKED_P0', 'EDUCATIONAL_ALLOWED']),
    requestModes: Object.freeze(['PROHIBITED_INSTRUCTION', 'LEGAL_TAX_ANALYSIS', 'CONDITIONAL_ANALYSIS', 'EDUCATIONAL'])
  });
}

export function classifyAIConduct({ query = '', responseText = '' } = {}) {
  const queryText = String(query || '').trim();
  const answerText = String(responseText || '').trim();
  const categories = POLICY_ROWS.filter((row) => row.pattern.test(queryText)).map((row) => row.id);
  const prohibitedCategories = POLICY_ROWS.filter((row) => row.mode === 'prohibited' && categories.includes(row.id)).map((row) => row.id);
  const educational = EDUCATIONAL.test(queryText);
  const personalized = PERSONALIZED.test(queryText);
  const directAction = DIRECT_MARKET_ACTION.test(queryText);
  const operational = OPERATIONAL.test(queryText);
  const asksLegalDetermination = LEGAL_DETERMINATION.test(queryText);
  const responseLegalDirective = RESPONSE_LEGAL_DIRECTIVE.test(answerText);

  if (prohibitedCategories.length && operational && !educational) {
    return Object.freeze({
      version: AI_CONDUCT_POLICY_VERSION, requestMode: 'PROHIBITED_INSTRUCTION',
      status: 'BLOCKED_P0', severity: 'P0', categories: Object.freeze(categories),
      execution: true, educational: false, personalized, directAction,
      legalReviewRequired: false,
      reasons: Object.freeze(prohibitedCategories.map((id) => `prohibited-conduct:${id}`))
    });
  }

  const legalTaxAnalysis = responseLegalDirective || (categories.includes('jurisdictional-advice') && (
    (asksLegalDetermination && (personalized || directAction || !educational)) ||
    (directAction && !educational)
  ));
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
