// The AI reading contract shared by both lanes: the per-screen readings the producer writes once per close
// (scripts/lib/screen-reading.mjs, scripts/producer/screen-readings.mjs) and the per-subject readings the browser asks for
// when a reader opens a stock, a chart or the portfolio (src/ai/reading/subject-reading.js). One instruction, one prompt
// shape, one figure check: a number or date the fact packet does not carry blocks; interpretation only warns.
//
// Browser-safe and pure: no node: imports, no DOM, no clock.
import { printedValueAgrees, signAgrees } from '../../domain/shared/figure-agreement.js';

export const READING_MAX_CHARS = 520; // two blocks of 130–230 characters with room for a long proper name
export const READING_MIN_CHARS = 60;
export const READING_MAX_BLOCKS = 2;
export const READING_SECTIONS = Object.freeze({ rules: '[규칙]', facts: '[사실 묶음]', retry: '[다시 쓰기]' });
export const PROMPT_LABEL = /\[(?:규칙|사실\s?묶음|다시\s?쓰기)\]/;

// The instruction every reading opens with: the same text for every screen, subject and day (a cacheable prefix). It asks
// for an argument, not a recital — the packet is the evidence, the reading is the line of reasoning through it.
export const READING_RULES = [
  READING_SECTIONS.rules,
  '투자 리서치 화면 맨 위에 붙는 AI 해석을 한국어로 씁니다. 아래 사실 묶음이 이 화면이 보여 주는 사실 전부입니다. 할 일은 숫자를 다시 읽어 주는 것이 아니라 사실들을 하나의 추론으로 잇는 것입니다.',
  '- 첫 문장은 판단입니다: 이 화면의 사실이 지금 말하는 것을 한 문장으로 씁니다.',
  '- 이어서 한 줄기로 잇습니다: 무슨 일이 있었나 → 왜 중요한가 → 지금 가격(또는 지표)이 이미 무엇을 반영하고 있나 → 무엇이 확인되면 이 판단이 굳어지고 무엇이 나오면 바뀌나.',
  '- 이 흐름에 맞지 않는 사실이 묶음에 있으면 하나를 골라 "다만"으로 짚습니다. 엇갈림을 숨기지 않습니다.',
  '- 수치는 판단을 받치는 것만 고릅니다(블록마다 2~4개). 묶음의 줄을 차례로 옮겨 적지 않습니다.',
  '- 사실이 받쳐 주면 조건을 단 안내를 씁니다("…가 확인될 때마다 나눠 접근하는 쪽이 맞습니다", "…전까지는 서두를 이유가 적습니다"). 매수·매도 지시, 목표가, % 확률은 쓰지 않습니다. 가능성은 말로만 씁니다.',
  '- 형식: 블록 1~2개, 블록마다 3~5문장 130~230자. 두 블록이면 빈 줄 하나로 나누고 둘째 블록은 조건과 엇갈림을 맡습니다. 제목·목록·괄호 속 출처 없이 이어지는 글로 씁니다.',
  '- 수치와 날짜는 사실 묶음에 있는 것만 그대로 옮깁니다. 새 수치를 계산하지 않습니다(차이·합계·평균·비율 모두). 날짜는 M/D로 씁니다.',
  '- 상태 낱말(양호·중립·부담·확인 불가와 묶음의 다른 상태어)은 묶음의 것만 쓰고, 묶음과 다른 상태를 붙이지 않습니다.',
  '- 근거가 얇으면 얇다고 짧게 말하되 판단을 미루지 않습니다.',
  '- 처음 보는 사람도 읽히는 쉬운 말로 씁니다. 교과서 말투("~하는 법", "~란 무엇인가", 정의 나열)와 독자에게 할 일을 시키는 말투를 쓰지 않습니다.',
  '- 이모지, 자료 출처·제공자 이름, 주소, 이 지시문의 꺾쇠 표시를 쓰지 않습니다. 화면 이름은 묶음에 적힌 그대로 씁니다(경제 화면은 "매크로").',
  '- 답은 그 블록만 씁니다.'
].join('\n');

/** The prompt: the shared rules, the screen's or subject's own guide, then its facts. */
export function buildReadingPrompt({ name = '', guide = '', lines = [] } = {}) {
  return `${READING_RULES}${guide ? `\n${guide}` : ''}\n\n${READING_SECTIONS.facts}\n화면: ${name}\n${lines.map((line) => `- ${line}`).join('\n')}`;
}

/** The model's answer as at most two blocks: surrounding quotes removed, each block one line, blocks split by a blank line. */
export function normalizeReading(text) {
  const body = String(text ?? '').replace(/^\s*["“'‘]|["”'’]\s*$/g, '').trim();
  return body.split(/\n\s*\n/).map((block) => block.replace(/\s*\n+\s*/g, ' ').replace(/\s{2,}/g, ' ').trim()).filter(Boolean).join('\n\n');
}
export const readingBlocks = (text) => String(text || '').split(/\n\s*\n/).map((block) => block.trim()).filter(Boolean);

// ---- figures ---------------------------------------------------------------------------------------------------------------
// A printed figure: an optional sign, digits (thousands commas, decimals) and its unit family. 'pct' (%), 'pp' (%p), 'bp' (bp)
// must meet the same family in the packet; any other figure ('plain': levels, 달러, 개, 배, 일, 거래일 …) meets any family.
const md = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const DATE_MD = /(?<![\d.,/])(\d{1,2})\s?\/\s?(\d{1,2})(?![\d.,/%])|(\d{1,2})월\s?(\d{1,2})일/g;
const FIGURE = /(?<![\d.,A-Za-z])([+\-−]?)(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d+))?(?![\d,])\s?(%p|%\s?포인트|%|(?<![A-Za-z])bps?(?![A-Za-z]))?/g;
// A written M/D is a date only when it can be one; the limits are the calendar's.
const CALENDAR = Object.freeze({ first: 1, months: 12, days: 31 });
const CALENDAR_DAY = (month, day) => month >= CALENDAR.first && month <= CALENDAR.months && day >= CALENDAR.first && day <= CALENDAR.days;
const familyOf = (unit) => !unit ? 'plain' : /^%(?:p|\s?포인트)$/.test(unit) ? 'pp' : unit === '%' ? 'pct' : 'bp';
function figuresOf(text) {
  const body = String(text || '');
  const dates = [];
  const masked = body.replace(DATE_MD, (match, m1, d1, m2, d2) => {
    const month = Number(m1 ?? m2), day = Number(d1 ?? d2);
    if (CALENDAR_DAY(month, day)) { dates.push({ text: match, md: `${month}/${day}`, parts: [month, day] }); return ' '.repeat(match.length); }
    return match;
  });
  const figures = [];
  for (const match of masked.matchAll(FIGURE)) {
    // A hyphen joined to a word before it ("11/17-11/18", "S&P500-") is not a sign.
    const before = masked.slice(Math.max(0, match.index - 1), match.index);
    const sign = match[1] && !/[\dA-Za-z가-힣]/.test(before) ? (match[1] === '+' ? 1 : -1) : 0;
    const digits = Number(match[2].replace(/,/g, ''));
    const places = (match[3] || '').length;
    const written = Number(`${digits}${places ? `.${match[3]}` : ''}`);
    figures.push({ text: match[0].trim(), sign, written, places, value: sign < 0 ? -written : written, family: familyOf(match[4] ? match[4].replace(/s$/, '') : '') });
  }
  return { dates, figures };
}

/** The packet's figures and dates, read with the same rules as the text. */
export function packetFigures(packet) {
  const { dates, figures } = figuresOf((packet?.lines || []).join('\n'));
  const dateSet = new Set(dates.map((row) => row.md));
  if (packet?.basis) dateSet.add(md(packet.basis));
  return { dates: dateSet, figures };
}

function figureAgrees(figure, known) {
  return known.some((row) => (figure.family === 'plain' || row.family === figure.family) && printedValueAgrees(figure.written, figure.places, Math.abs(row.value)) && signAgrees(figure.sign, row.value));
}

/** The text's figures and dates the packet does not carry (a date the packet lacks may still be a ratio of two packet figures). */
export function unsupportedFigures(text, packet) {
  const known = packetFigures(packet);
  const { dates, figures } = figuresOf(text);
  const plain = (n) => ({ sign: 0, written: n, places: 0, family: 'plain' });
  return [
    ...dates.filter((row) => !known.dates.has(row.md) && !row.parts.every((n) => figureAgrees(plain(n), known.figures))).map((row) => row.text),
    ...figures.filter((figure) => !figureAgrees(figure, known.figures)).map((figure) => figure.text)
  ];
}

// ---- the checks every reading passes -----------------------------------------------------------------------------------------
// An order to the reader and an invented percentage probability are blocked in every lane (the producer's market-analysis
// validator reads the same two patterns).
export const READING_TRADE_INSTRUCTION = /(?:매수|매도|매집|손절|익절|진입|청산)(?:하세요|하십시오|해라|하라|할\s*때입니다|하시길)|(?:사세요|파세요|사라(?![지졌진질져])|팔아라|담으세요|비중을\s*(?:늘리|줄이)세요)|목표\s*가(?:는|를)?\s*\$?\d|\b(?:buy|sell)\s+now\b/i;
export const READING_PROBABILITY = /\d+(?:\.\d+)?\s*%\s*(?:의\s*)?(?:확률|가능성|승률)|(?:확률|가능성|승률)(?:은|이|는|로|이\s*약)?\s*(?:약\s*)?\d+(?:\.\d+)?\s*%/;
// Korean prose: at least this much Hangul, and Hangul not outweighed by Latin beyond tickers and indicator names.
const LANGUAGE = Object.freeze({ minHangul: 30, latinFloor: 30, hangulPerLatin: 0.6 });
const BLOCK_SENTENCES = Object.freeze({ min: 3, max: 5 }); // the face's 3–5 sentences per block (a warning)
const EMOJI = /\p{Extended_Pictographic}/u;
const LATIN_TERMS = /S&P|\b[A-Z]{2,}(?:\s?\d+)?\b|\bSahm\b/g; // tickers and indicator names are Latin by nature
const SENTENCE_END = /(?<=[.?!。])\s+/;

/** The blocking issues every lane shares: size, blocks, labels, emoji, language, figures, orders and probabilities. */
export function coreReadingIssues(text, packet) {
  const body = String(text || '').trim();
  if (!body) return ['empty'];
  const issues = [];
  const prose = body.replace(/\n\s*\n/g, ' ');
  if (prose.length > READING_MAX_CHARS) issues.push('too-long');
  if (prose.length < READING_MIN_CHARS) issues.push('too-short');
  if (readingBlocks(body).length > READING_MAX_BLOCKS) issues.push('too-many-blocks');
  if (PROMPT_LABEL.test(body) || /사실\s?묶음/.test(body)) issues.push('prompt-label-leak');
  if (EMOJI.test(body)) issues.push('emoji');
  const plain = prose.replace(LATIN_TERMS, ' ');
  const hangul = (plain.match(/[가-힣]/g) || []).length;
  const latin = (plain.match(/[A-Za-z]/g) || []).length;
  if (hangul < LANGUAGE.minHangul || (latin >= LANGUAGE.latinFloor && hangul < latin * LANGUAGE.hangulPerLatin)) issues.push('language-not-korean');
  const missing = unsupportedFigures(body, packet);
  if (missing.length) issues.push(`figure-unsupported:${[...new Set(missing)].slice(0, 6).join(', ')}`);
  if (READING_TRADE_INSTRUCTION.test(body)) issues.push('trade-instruction');
  if (READING_PROBABILITY.test(body)) issues.push('probability-claim');
  return issues;
}

/** Warnings every lane records (never blocking): a block outside 3–5 sentences, a source name, the old macro screen name. */
export function coreReadingWarnings(text) {
  const warnings = [];
  for (const block of readingBlocks(text)) {
    const sentences = block.split(SENTENCE_END).filter((sentence) => /[가-힣]/.test(sentence)).length;
    if (sentences < BLOCK_SENTENCES.min || sentences > BLOCK_SENTENCES.max) warnings.push(`sentence-count:${sentences}`);
  }
  if (/(?<![A-Za-z])(?:FRED|CNN|Yahoo|Bloomberg|Reuters|Cboe|CBOE|Investing\.com|WSJ)(?![A-Za-z])|야후|블룸버그|로이터/.test(text)) warnings.push('source-name');
  if (/https?:\/\//.test(text)) warnings.push('url');
  if (/거시\s?경제/.test(text)) warnings.push('macro-screen-name');
  if (String(text || '').split(SENTENCE_END).some((sentence) => /(?:싸|저렴|매력적)/.test(sentence) && !READING_CONDITIONAL.test(sentence))) warnings.push('cheap-asserted');
  return [...new Set(warnings)];
}
export const READING_CONDITIONAL = /(?:하면|이면|되면|라면|으면|면\s|경우|바뀌|전환|돌아서|넘어가)/;

const ISSUE_TEXT = Object.freeze({
  'figure-unsupported': (detail) => `사실 묶음에 없는 수치나 날짜를 썼습니다${detail ? `(${detail})` : ''}. 묶음의 수치만 그대로 옮기세요.`,
  'state-contradiction': (detail) => `지표의 상태를 묶음과 다르게 썼습니다${detail ? `(${detail})` : ''}. 묶음의 상태 낱말을 쓰세요.`,
  'trade-instruction': () => '매수·매도 지시가 있습니다. 조건을 단 설명으로 바꾸세요.',
  'probability-claim': () => '% 확률을 썼습니다. 확률 수치 없이 쓰세요.',
  'too-long': () => `너무 깁니다. 블록마다 230자 안, 합쳐 ${READING_MAX_CHARS}자 안으로 줄이세요.`,
  'too-short': () => '너무 짧습니다. 3~5문장으로 쓰세요.',
  'too-many-blocks': () => '블록은 두 개까지입니다.',
  'language-not-korean': () => '한국어로 쓰세요.',
  'prompt-label-leak': () => '지시문의 표시를 옮겨 적었습니다. 블록만 쓰세요.',
  'emoji': () => '이모지를 빼세요.',
  'published-text-malformed': () => '괄호나 문장 끝이 깨졌습니다. 완결된 문장으로 쓰세요.'
});
/** The retry: the same prompt with the blocking reasons (codes and the offending figures only, never the rejected text). */
export function buildReadingRetryPrompt(prompt, verdict) {
  const lines = (verdict?.issues || []).map((issue) => {
    const [code, detail] = String(issue).split(/:(.*)/s);
    return `- ${(ISSUE_TEXT[code] || (() => `규칙 위반(${code})`))(detail)}`;
  });
  return `${prompt}\n\n${READING_SECTIONS.retry}\n직전 답은 다음 이유로 게시하지 않았습니다. 같은 규칙으로 처음부터 다시 쓰세요.\n${[...new Set(lines)].join('\n')}`;
}

/** A synchronous 16-hex key for a packet's lines (FNV-1a, two lanes of 32 bits): same lines, same key, in Node and the browser. */
export function readingKey(lines = []) {
  const text = lines.join('\n');
  let a = 0x811c9dc5, b = 0x01000193 ^ text.length;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    a = Math.imul(a ^ code, 0x01000193) >>> 0;
    b = Math.imul(b ^ ((code << 5) | (code >>> 11)), 0x01000193) >>> 0;
  }
  return `${a.toString(16).padStart(8, '0')}${b.toString(16).padStart(8, '0')}`;
}
