// v58.75 (persona review): one market glossary for headline translation. The producer's shared-model prompt lists it
// (scripts/producer/market-narrative.mjs HEADLINE_GLOSSARY); the browser's free translator takes no instructions, so its
// known misreadings are corrected after the fact — only where the English title carries the term and the Korean line
// carries the known wrong word, never as a free rewrite.
export const HEADLINE_GLOSSARY_PAIRS = Object.freeze([
  ['earnings', '실적'], ['guidance', '가이던스(실적 전망)'], ['beats/misses estimates', '예상치 상회/하회'], ['revenue', '매출'],
  ['bearish bets', '약세 베팅'], ['bullish bets', '강세 베팅'], ['short sellers', '공매도 세력'], ['selloff', '매도세(급락)'],
  ['rally', '랠리(반등)'], ['Treasury yields', '미 국채 금리'], ['haven', '안전자산'], ['rate cut/hike', '금리 인하/인상'],
  ['the Fed', '연준'], ['downgrade/upgrade (analyst)', '투자의견 하향/상향'], ['price target', '목표주가'], ['buyback', '자사주 매입'],
  ['futures', '선물'], ['stocks slide/jump', '주가 하락/급등'], ['layoffs', '감원'], ['tariffs', '관세']
]);

// [English term in the original, wrong Korean rendering, replacement]
const FIXES = Object.freeze([
  [/\bearnings\b/i, /(?<![순영업투자이자총운용])수익(?![률성])/g, '실적'], // 순수익·영업수익·투자수익 stay as written
  [/\bguidance\b/i, /지침|안내/g, '가이던스'],
  [/\brall(?:y|ies|ied)\b/i, /집회/g, '랠리'],
  [/\bsell-?offs?\b/i, /매각/g, '매도세'],
  [/\bprice targets?\b/i, /가격 목표/g, '목표주가'],
  [/\bTreasur(?:y|ies)\b/, /재무부\s*(?:채권\s*)?수익률/g, '미 국채 금리'],
  [/\bbets?\b/i, /내기/g, '베팅'],
  [/\bestimates?\b/i, /추정치/g, '예상치'],
  [/\bbuybacks?\b/i, /환매/g, '자사주 매입'],
  [/\bhaven\b/i, /피난처|천국/g, '안전자산']
]);

/** The Korean title with the glossary's known misreadings corrected (unchanged when nothing applies). */
export function fixKoreanTerms(original, ko) {
  const en = String(original || '');
  let out = String(ko || '');
  if (!out || !/[가-힣]/.test(out) || !en) return out;
  for (const [term, wrong, right] of FIXES) if (term.test(en)) out = out.replace(wrong, right);
  return out;
}
