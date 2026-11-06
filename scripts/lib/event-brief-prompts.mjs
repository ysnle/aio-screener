// Event-brief AI requests: the JSON schemas, the prompts and the request bodies of every model call
// scripts/fetch-event-briefs.mjs makes (moved out of that file in v59.59; it re-exports the old names).
//
// Each answer is checked afterwards by src/domain/briefing/event-briefs.js: a quote not in the fetched source drops its
// item, a figure not in its quote drops it, and a search point with an unchecked number or an off-list url drops. The
// prompts say the same rules up front so fewer items are dropped.
//
// v59.59 (text-quality audit 2026-11-01): briefs mixed "-다" lines with the screen's "-습니다" notes, repeated the value in
// the text in another unit ('$4,233 million · … 42.3억 달러') and left segment names in English. The shared rules
// (scripts/lib/ai-prompt-rules.mjs) now set the ending, the Korean name and the no-repeat rule for every brief prompt.
import { FORMAL_ENDING, PROMPT_RULES, ruleBlock } from './ai-prompt-rules.mjs';
import { buildSharedTextBody, buildSharedWebSearchBody } from './ai-shared-analysis.mjs';
import { normalizeSourceText, reactionPct } from '../../src/domain/briefing/event-briefs.js';

// The fetched primary source is cut at this length for the prompt; the verifier reads the same cut (capSourceText).
export const SOURCE_CHAR_CAP = 60000;
export const capSourceText = (text) => normalizeSourceText(text).slice(0, SOURCE_CHAR_CAP);

// ---- schemas -------------------------------------------------------------------------------------------------------
const STR = { type: 'string' };
const quoted = (extra = {}) => ({ type: 'array', items: { type: 'object', additionalProperties: false, required: ['label', 'value', 'text', 'quote', ...Object.keys(extra)], properties: { label: STR, value: STR, text: STR, quote: STR, ...extra } } });
export const EARNINGS_SCHEMA = { type: 'object', additionalProperties: false, required: ['headline', 'figures', 'segments', 'guidance', 'watch'], properties: {
  headline: STR,
  figures: quoted({ metric: { type: 'string', enum: ['revenue', 'eps_diluted', 'operating_income', 'net_income', 'margin', 'capex', 'free_cash_flow', 'operating_cash_flow', 'other'] } }),
  segments: quoted(), guidance: quoted(), watch: { type: 'array', items: STR } } };
export const FOMC_SCHEMA = { type: 'object', additionalProperties: false, required: ['headline', 'figures', 'changes', 'dissents', 'watch'], properties: {
  headline: STR, figures: quoted({ metric: { type: 'string', enum: ['policy_rate_range', 'vote', 'balance_sheet', 'other'] } }), changes: quoted(), dissents: quoted(), watch: { type: 'array', items: STR } } };
export const POINTS_SCHEMA = { type: 'object', additionalProperties: false, required: ['speaker', 'points'], properties: { speaker: STR,
  points: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'url'], properties: { text: STR, url: STR } } } } };
export const TRANSCRIPT_SCHEMA = { type: 'object', additionalProperties: false, required: ['speaker', 'points'], properties: { speaker: STR,
  points: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text'], properties: { text: STR } } } } };
// v59.44 (owner 2026-10-30, "왜 빠졌는지 알아야 대응이라도"): why the stock moved after the report, as reported.
export const REASONS_SCHEMA = { type: 'object', additionalProperties: false, required: ['reasons'], properties: {
  reasons: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['text', 'url'], properties: { text: STR, url: STR } } } } };

// ---- rules ---------------------------------------------------------------------------------------------------------
// Structured summaries of a fetched source (earnings release, FOMC statement, transcript).
export const QUOTED_ITEM_RULES = ruleBlock('규칙:', [
  `한국어로 짧게 쓴다. ${PROMPT_RULES.noTradeInstruction}`,
  `text의 문장은 모두 ${FORMAL_ENDING}. headline과 watch는 끝맺음 없는 짧은 구로 쓴다.`,
  PROMPT_RULES.koreanNames,
  '각 항목의 quote에는 원문 문장을 한 글자도 바꾸지 않고 그대로 옮긴다. value에는 원문 표기 그대로의 숫자와 단위를 쓴다(환산·반올림 금지).',
  'text에는 value에 쓴 숫자를 다시 쓰거나 다른 단위로 바꿔 쓰지 않는다. text는 value가 말하지 않는 것(전년 대비 변화, 이유, 조건)만 한 문장으로 쓴다.',
  'label·text·headline에 숫자를 쓸 때는 원문에 그대로 있는 숫자만 쓴다. 원문에 없는 숫자(계산한 증감률, 환산 금액)는 쓰지 않는다.',
  'watch는 다음에 확인할 일(다음 발표, 지표, 조건)을 숫자 없이 한 줄씩, "확인해야 합니다" 같은 당부 없이 쓴다(예: "다음 분기 매출의 가이던스 부합 여부").'
]);
// Points found by a hosted search (press conference, earnings call, post-report move).
const searchPointRules = (extra = [], { names = true } = {}) => ruleBlock('규칙:', [
  `각 줄은 한국어 한 문장이며 ${FORMAL_ENDING}.`,
  names ? PROMPT_RULES.koreanNames : '',
  ...extra,
  PROMPT_RULES.noTradeInstruction
]);

// ---- prompts -------------------------------------------------------------------------------------------------------
export function earningsPrompt(mover, source) {
  return [`아래는 ${mover.nameKo}(${mover.sym})의 실적 발표 원문(${source.kind})이다.`,
    '보고한 핵심 수치(매출, 주당순이익, 영업이익 등), 사업부문별 내용, 회사가 낸 다음 분기·연간 가이던스를 뽑아라.',
    // v59.44 (X bookmarks 10/30: GOOGL fell on negative free cash flow, AMZN on capex): the cash lines, when stated.
    '원문에 설비투자(capex, 유형자산 취득), 잉여현금흐름, 영업현금흐름이 있으면 figures에 각각 capex·free_cash_flow·operating_cash_flow로 넣어라.', QUOTED_ITEM_RULES,
    '', '--- 원문 시작 ---', capSourceText(source.text), '--- 원문 끝 ---'].join('\n');
}

export function fomcPrompt(date, current, previous) {
  return [`아래는 ${date} FOMC 성명 원문과 직전 성명이다.`,
    '결정(정책금리 범위), 표결, 직전 성명 대비 바뀐 문구(changes: quote는 이번 성명 문장), 반대 의견(dissents)을 뽑아라.', QUOTED_ITEM_RULES,
    '', '--- 이번 성명 ---', capSourceText(current), '--- 직전 성명 ---', capSourceText(previous || '(없음)'), '--- 끝 ---'].join('\n');
}

export function transcriptPrompt(date, text) {
  return [`아래는 ${date} FOMC 기자회견 녹취록(연준 공개 PDF에서 추출한 텍스트)이다.`,
    '의장이 한 핵심 발언(금리 경로, 물가·고용 판단, 대차대조표, 질의응답 쟁점)을 한국어 한 줄씩 3~6개로 정리하라. speaker에는 의장 이름을 쓴다.', QUOTED_ITEM_RULES,
    '', '--- 녹취록 ---', capSourceText(text), '--- 끝 ---'].join('\n');
}

export function presserPrompt(date) {
  return [`${date} FOMC 기자회견에서 연준 의장이 한 핵심 발언(금리 경로, 물가·고용 판단, 대차대조표, 질의응답의 쟁점)을 보도와 연준 자료에서 찾아 한 줄씩 3~6개로 정리하라. 각 줄에 근거 기사 url을 붙인다. speaker에는 의장 이름을 쓴다.`,
    searchPointRules(['숫자는 보도에 그대로 있는 것만 쓴다.'], { names: false })].join('\n');
}

export function callPrompt(mover, eventDate) {
  return [`${mover.nameKo}(${mover.sym})의 ${eventDate} 실적 발표 컨퍼런스콜에서 경영진이 강조한 점(수요, 투자, 마진, 가이던스 설명, 질의응답 쟁점)을 회사 자료와 보도에서 찾아 한 줄씩 3~6개로 정리하라. 각 줄에 근거 url을 붙인다. speaker에는 발언한 경영진을 쓴다(모르면 빈 문자열).`,
    searchPointRules(['숫자는 자료에 그대로 있는 것만 쓴다.'])].join('\n');
}

// The figures are on the brief already, so the reasons are written without numbers (a line with an unchecked number drops).
export function reasonsPrompt(brief) {
  const move = reactionPct(brief);
  const direction = move == null ? '움직인' : move < 0 ? '하락한' : '상승한';
  return [`${brief.nameKo}(${brief.symbol}) 주가가 ${brief.eventDate} 실적 발표 뒤 ${direction} 이유로 보도된 내용(가이던스와 시장 기대의 차이, 마진, 설비투자·현금흐름, 수요 설명, 경영진 발언)을 보도와 회사 자료에서 찾아 한 줄씩 2~4개로 정리하라. 각 줄에 근거 기사 url을 붙인다.`,
    searchPointRules(['숫자는 쓰지 않는다(수치는 따로 싣는다).', '보도에 없는 추측은 쓰지 않는다.',
      '회사 보도자료만으로 주가 반응을 설명하지 말고, 이유를 다룬 보도를 찾지 못하면 빈 배열을 돌려준다.'])].join('\n');
}

// ---- request bodies ------------------------------------------------------------------------------------------------
// Profiles (token ceiling, reasoning effort) come from SHARED_AI_PROFILES; only the per-call differences are here.
export const fomcStatementBody = (date, current, previous) => buildSharedTextBody(fomcPrompt(date, current, previous), { profile: 'structured', schemaName: 'fomc_statement', schema: FOMC_SCHEMA });
export const fomcTranscriptBody = (date, text) => buildSharedTextBody(transcriptPrompt(date, text), { profile: 'structured', schemaName: 'fomc_transcript', schema: TRANSCRIPT_SCHEMA });
export const earningsReleaseBody = (mover, source) => buildSharedTextBody(earningsPrompt(mover, source), { profile: 'structured', schemaName: 'earnings_release', schema: EARNINGS_SCHEMA });
// Search points are written at length (3-6 lines with urls), so they get 1500 output tokens; the reasons (2-4 lines) keep
// the profile's 1200 and two searches (the first often lands on the issuer's own release).
export const presserSearchBody = (date, domains) => buildSharedWebSearchBody(presserPrompt(date), { allowedDomains: domains, schemaName: 'fomc_presser', schema: POINTS_SCHEMA, maxToolCalls: 1, maxOutputTokens: 1500 });
export const callSearchBody = (mover, eventDate, domains) => buildSharedWebSearchBody(callPrompt(mover, eventDate), { allowedDomains: domains, schemaName: 'earnings_call', schema: POINTS_SCHEMA, maxToolCalls: 1, maxOutputTokens: 1500 });
export const reasonsSearchBody = (brief, domains) => buildSharedWebSearchBody(reasonsPrompt(brief), { allowedDomains: domains, schemaName: 'earnings_reasons', schema: REASONS_SCHEMA, maxToolCalls: 2, maxOutputTokens: 1200 });
