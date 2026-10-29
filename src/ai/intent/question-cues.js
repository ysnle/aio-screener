// v59.42: the AI panel's keyword cues on top of the intent taxonomy (taxonomy.js), moved here from js/aio-chat.js
// (_aioChatAnswerPolicy, _hasDeepAnalysisKw, _detectDeepCompareIntent) and js/aio-core.js (_aioLooksFreshIntent,
// _aioAIClassifyIntent). Those matched English words as raw substrings, so 'per' hit "operating", 'current' hit
// "currency", 'now' hit "know", 'rate' hit "corporate", 'hold' hit "threshold" and 'tech' hit "fintech"; the deep-analysis
// list was also case-sensitive ("Analyze NVDA" missed 'analyze').
// - English (printable ASCII) cues follow the shared keyword rule (src/domain/news/keyword-match.js): whole words plus a
//   plural -s/-es, case-insensitive.
// - Korean cues stay plain substrings, exactly as before: Korean attaches endings to the stem ('살까', '없어'), and the
//   shared rule's stand-alone single syllable would drop '없' from '없어요'.
import { keywordHit } from '../../domain/news/keyword-match.js';

const ASCII_RE = /^[\x20-\x7e]+$/;

function cueHit(lower, cue) {
  return ASCII_RE.test(cue) ? keywordHit(lower, cue) : lower.indexOf(cue.toLowerCase()) >= 0;
}

function anyCue(text, cues) {
  const lower = String(text ?? '').toLowerCase();
  return cues.some((cue) => cueHit(lower, cue));
}

export const DECISION_CUES = Object.freeze(['추천', '골라', '뽑아', '사도', '살까', '매수', '매도', '보유', '손절', '익절', '비중', '전망', '목표',
  'entry', 'exit', 'buy', 'sell', 'hold', 'trim', 'target', 'outlook']);
export const SIMPLE_CUES = Object.freeze(['간단', '요약', '한줄', '뜻', '뭐야', '무슨 의미', '무슨의미', '정의', '용어', 'per', 'pbr', 'roe']);
export const FRESH_CUES = Object.freeze(['latest', 'recent', 'today', 'now', 'this week', 'news', 'current', 'fresh', 'earnings', 'guidance', 'cpi', 'fomc',
  'fed', 'rate', 'tariff', '최신', '최근', '오늘', '지금', '현재', '뉴스', '소식', '상황', '발표', '실적', '가이던스', '금리', '관세']);
export const DEEP_ANALYSIS_CUES = Object.freeze([
  '비즈니스 모델', '비즈니스모델', '사업 모델', '사업모델', '수익 모델', '수익모델',
  '수익 구조', '수익구조', '매출 구조', '매출구조', '사업 구조', '사업구조', 'revenue structure', 'business model',
  '해자', 'moat', '경쟁 우위', '경쟁우위', 'competitive advantage', '경쟁력',
  '기술력', '기술 경쟁', 'tech', 'technology', 'R&D', '연구개발', '연구 개발',
  '전환비용', 'switching cost', '네트워크 효과', 'network effect',
  '브랜드 파워', 'brand', '규모의 경제', 'economies of scale',
  '진입 장벽', '진입장벽', 'barrier', '사업 포트폴리오', '포트폴리오',
  '세그먼트', 'segment', '사업부', '사업 부문', '지역별 매출',
  '경영진', 'CEO', '리더십', 'leadership', '내부자', 'insider',
  '공급망', 'supply chain', '밸류체인', 'value chain',
  '핵심 역량', 'core competence', '차별화', 'differentiation',
  '종합 분석', '종합분석', '심층 분석', '심층분석', '딥다이브', 'deep dive', '기업 분석', '기업분석',
  // v50.70: a plain analysis request on one ticker also gets the full company read
  '분석해', '분석 해', '분석좀', '분석 좀', '분석하', '분석 하', '분석을', '분석 을',
  '알려줘', '알려 줘', '알려주', '알려 주', '설명해', '설명 해', '설명좀', '설명 좀',
  '어때', '어떄', '어떻게 생각', '어떻게 봐', '어떻게봐', '전망', '투자', '매수', '매도',
  '살만', '살 만', '사도 될', '사도될', '괜찮', '좋아', '좋은가', '어떤 회사', '어떤회사',
  'analyze', 'analysis', 'tell me', 'explain', 'overview', 'invest', 'buy', 'sell',
  '리포트', 'report', '리서치', 'research', '조사', '평가', '검토', 'review',
  '재무', '실적', '펀더멘털', 'fundamental', '적정가', '목표가', '밸류', 'valuation'
]);
export const COMPARE_CUES = Object.freeze([
  '비교', 'compare', 'vs', '대비', '차이', '다른점', '다른 점', '어떻게 다', '뭐가 다', '무엇이 다',
  '분석', 'analysis', '어느 쪽', '어디가', '누가 더', '어떤 게', '둘 다', '둘다', '각각',
  '장단점', '장점', '단점', '강점', '약점', '우위', '열위', '좋은 점', '나쁜 점',
  '뭐가 좋', '뭘 사', '어떤 걸', '어떤 게 더', '뭐가 낫', '뭐가 나',
  'pros', 'cons', 'advantage', 'disadvantage', 'strength', 'weakness',
  'better', 'worse', 'pick', 'choose', 'prefer', 'which'
]);
export const EVIDENCE_CUES = Object.freeze(['출처', '근거', '검증', '불일치', '상충', 'source', 'evidence', 'conflict', 'mismatch', 'verify']);
export const MISSING_CUES = Object.freeze(['없', '모르', '미수집', '누락', '확인 불가', 'missing', 'unknown', 'unavailable']);

/** A buy/sell/hold-type question (on top of the taxonomy's action flag). */
export const asksDecisionCue = (text) => anyCue(text, DECISION_CUES);
/** A short definition or summary request. */
export const asksSimpleCue = (text) => anyCue(text, SIMPLE_CUES);
/** The question is about what is happening now, so news and fresh data are worth fetching. */
export const looksFreshCue = (text) => anyCue(text, FRESH_CUES);
/** A company-level analysis request (one ticker gets the full company read). */
export const deepAnalysisCue = (text) => anyCue(text, DEEP_ANALYSIS_CUES);
/** Two or more tickers asked to be weighed against each other in depth. */
export const deepCompareCue = (text) => deepAnalysisCue(text) && anyCue(text, COMPARE_CUES);
/** The question asks where a number came from or whether it is right. */
export const asksEvidenceCue = (text) => anyCue(text, EVIDENCE_CUES);
/** The question is about data that is missing or unknown. */
export const asksMissingCue = (text) => anyCue(text, MISSING_CUES);
