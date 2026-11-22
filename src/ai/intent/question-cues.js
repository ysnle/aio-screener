// v59.42: the AI panel's keyword cues on top of the intent taxonomy (taxonomy.js), moved here from src/ui/chat/panel.js
// (_aioChatAnswerPolicy) and js/aio-core.js (_aioLooksFreshIntent, _aioAIClassifyIntent). Those matched English words as
// raw substrings, so 'per' hit "operating", 'current' hit "currency", 'now' hit "know", 'rate' hit "corporate" and 'hold'
// hit "threshold".
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
export const EVIDENCE_CUES = Object.freeze(['출처', '근거', '검증', '불일치', '상충', 'source', 'evidence', 'conflict', 'mismatch', 'verify']);
export const MISSING_CUES = Object.freeze(['없', '모르', '미수집', '누락', '확인 불가', 'missing', 'unknown', 'unavailable']);

/** A buy/sell/hold-type question (on top of the taxonomy's action flag). */
export const asksDecisionCue = (text) => anyCue(text, DECISION_CUES);
/** A short definition or summary request. */
export const asksSimpleCue = (text) => anyCue(text, SIMPLE_CUES);
/** The question is about what is happening now, so news and fresh data are worth fetching. */
export const looksFreshCue = (text) => anyCue(text, FRESH_CUES);
/** The question asks where a number came from or whether it is right. */
export const asksEvidenceCue = (text) => anyCue(text, EVIDENCE_CUES);
/** The question is about data that is missing or unknown. */
export const asksMissingCue = (text) => anyCue(text, MISSING_CUES);
