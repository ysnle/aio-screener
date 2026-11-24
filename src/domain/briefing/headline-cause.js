// The reason a linked report gives for a move, cut from its Korean headline by rule.
// Only three shapes count, each of which names the cause before the move: "A가 …을 지피며/촉발하며 …" (A),
// "A 후/뒤 …" (A) and "A에/소식에/여파로 … 상승·하락" (A). Anything else gives no clause: the screen says no reason
// rather than a guessed one. A clause with a figure is left out, since a figure is printed only from a claim.
import { UP_WORDS, DOWN_WORDS } from '../news/direction-words.js';

const HANGUL_PAIR = /[가-힣].*[가-힣]/;
// Nouns that end in 가/이 and would otherwise read as a subject marker ("엔비디아 주가 급등이 …").
const NOT_SUBJECT = /(?:주|유|물|증|평|시|원|단|고|저|대)가$|(?:차|사)이$/;
const SHAPES = Object.freeze([
  [/^(.{2,40}?)(?:이|가)\s+.*?(?:지피|촉발|이끌|견인|부추기|자극)/, (head) => !NOT_SUBJECT.test(`${head}가`) && !NOT_SUBJECT.test(`${head}이`)],
  [/^(.{2,40}?)\s(?:후|뒤|이후)\s/, () => true],
  [/^(.{2,40}?)(?:에 따른|에 따라|여파로|여파에|소식에|로 인해|으로 인해|에)\s(?!따르면|대해|대한|관한)(.+)$/, (head, rest) => UP_WORDS.test(rest) || DOWN_WORDS.test(rest)]
]);
const MAX_CLAUSE = 22;

/** The cause a Korean headline states before its move, as a short clause ("황의 엔비디아 복귀"), else null. */
export function headlineCause(title) {
  let text = String(title || '').replace(/\s+/g, ' ').trim();
  if (!HANGUL_PAIR.test(text)) return null;
  text = text.replace(/^\[[^\]]{1,12}\]\s*/, '').replace(/^[가-힣]{1,4}:\s*/, '')
    .replace(/\s*:\s*시장\s*(?:마감|분석).*$/, '').replace(/\s*\((?:종합|상보|속보)[^)]*\)\s*$/, '');
  // "뉴욕증시, A에 상승 출발": the market named first is the subject of the move, not part of its cause.
  text = text.replace(/^[^,，]{1,14}[,，]\s*/, '');
  for (const [shape, holds] of SHAPES) {
    const hit = shape.exec(text);
    if (!hit) continue;
    const clause = hit[1].replace(/['"‘’“”]/g, '').trim();
    if (!holds(hit[1], hit[2] || '') || clause.length < 3 || clause.length > MAX_CLAUSE || /\d/.test(clause) || !/[가-힣A-Za-z]$/.test(clause)) continue;
    return clause;
  }
  return null;
}
