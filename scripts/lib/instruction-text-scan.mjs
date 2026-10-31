// scripts/lib/instruction-text-scan.mjs — v59.50 (recurrence audit 2026-10-31)
//
// R724 (the app never proposes a price, weight, timing or stock) recurred 20 times (P1507 … P2151 chart lens, P2165 chart
// coach, the regime-choice "분할 접근은 … 확인된 뒤가 맞습니다") because each fix removed exact phrases from one surface
// (ci-control-char-check INSTRUCTION_PHRASES) and the next surface wrote a new one. This reads the Korean string
// literals of product code by grammar instead of by phrase:
//   directive  — a reader action (분할 접근, 나눠 들어가, 매수, 매도, 진입, 청산, 손절, 익절, 비중 조절, 정리, 담기) in the same
//                sentence as a prescriptive ending (편이 맞습니다, 뒤가 맞습니다, 하세요, 하십시오, 권합니다, 추천합니다,
//                할 때입니다, 해야 합니다);
//   pricePlan  — a stop/target/entry price label followed by an interpolated value in a template literal (`손절가 ${…}`);
//   computedPrice — a price formatter around arithmetic (`${price(close - levels.atr)}`, the P2165 chart coach).
// Regex literals are not string literals, so the AI policy's own detectors are not read as instructions.

const STRING = /'(?:[^'\\\n]|\\.)*'|"(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`/g;
const REGEX_LITERAL = /(?<=[=:(,|&!?[]\s*)\/(?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+\/[dgimsuvy]*/g;
const ACTION = /분할\s?(?:접근|매수|진입)|나눠\s?(?:들어가|보|사|담)|기다리(?:는|기|고)|(?<![가-힣])관망|(?<![가-힣])(?:매수|매도|진입|청산|손절|익절)(?!세|\s?(?:압력|심리|우위|신호|물량|강도|주체))|비중을?\s?(?:늘|줄|조절|확대|축소)|(?<![가-힣])정리(?:하|할)|(?<![가-힣])담(?:아|을|으)/;
const PRESCRIPTIVE = /(?:편이|쪽이|뒤가|것이|때가)\s?(?:맞|낫|좋)습니다|하세요|하십시오|권합니다|권장합니다|추천합니다|할\s?때입니다|해야\s?합니다/;
const PRICE_PLAN = /(?:손절|목표|진입|매수|매도)\s?(?:가|가격|선|라인)\s?[:：]?\s?\$\{/;
// A price formatter around arithmetic (`${price(close - levels.atr)}`) prints a level the app computed, not one it mapped.
const COMPUTED_PRICE = /\$\{\s*\w*[Pp]rice\w*\(\s*[^()]*?\s[-+*]\s/;

export function instructionIssues(source) {
  const text = String(source).replace(REGEX_LITERAL, '""');
  const issues = [];
  for (const match of text.matchAll(STRING)) {
    const literal = match[0];
    if (!/[가-힣]/.test(literal)) continue;
    if (literal.startsWith('`') && PRICE_PLAN.test(literal)) issues.push({ kind: 'pricePlan', text: literal.slice(1, 90) });
    if (literal.startsWith('`') && COMPUTED_PRICE.test(literal)) issues.push({ kind: 'computedPrice', text: literal.slice(1, 90) });
    for (const sentence of literal.slice(1, -1).split(/(?<=[.?!。])\s+/)) {
      if (ACTION.test(sentence) && PRESCRIPTIVE.test(sentence)) issues.push({ kind: 'directive', text: sentence.slice(0, 90) });
    }
  }
  return issues;
}
