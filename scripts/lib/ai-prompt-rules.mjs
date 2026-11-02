// v59.59 (AI lane refactor): the writing rules every producer prompt shares, stated once.
//
// Each lane keeps its prompt next to its validator (market reading: market-analysis-prompt.mjs + market-analysis-validate.mjs;
// event briefs: event-brief-prompts.mjs + src/domain/briefing/event-briefs.js; slot summary: market-timeline.mjs). What
// those prompts must agree on (the site's sentence ending, no trading instructions, numbers only from the source) was
// written differently in each file, and the event briefs carried no ending rule at all, so their "-다" lines sat beside
// the screen's "-습니다" notes (text-quality audit 2026-11-01). New prompts compose these lines instead of restating them.
//
// The market-reading prompt predates this module and is kept byte-identical (its validator and retry wording were tuned on
// live blocks); it states the same rules in its own sections.

// The site's register (screen notes, the market reading): 합니다체 for every sentence a reader sees. A predicate phrase, so
// a prompt can say which fields it covers ("text와 watch의 문장은 모두 …").
export const FORMAL_ENDING = '"-습니다/-입니다"로 끝낸다(예: "전년 대비 늘었습니다.")';

export const PROMPT_RULES = Object.freeze({
  formalEnding: `모든 문장을 ${FORMAL_ENDING}.`,
  // AGENTS.md product rule: research text, never an order.
  noTradeInstruction: '매매 지시·목표가·예측 확률을 쓰지 않는다.',
  // Readers scan Korean; an English segment or product name is kept once, in brackets, so it can still be searched.
  koreanNames: '회사·사업부문·제품 이름은 한국어로 옮겨 쓰고, 원문 이름은 처음 한 번만 괄호에 둔다(예: "시스템 보호(Systems Protection)"). 티커와 EPS·HBM 같은 약어는 그대로 둔다.'
});

/** Joins rule lines under a heading ("규칙:"), skipping empty entries. */
export function ruleBlock(heading, lines) {
  const body = lines.filter((line) => typeof line === 'string' && line.trim());
  return body.length ? [heading, ...body.map((line) => `- ${line}`)].join('\n') : '';
}
