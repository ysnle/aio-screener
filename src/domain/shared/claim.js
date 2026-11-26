// A data-driven sentence carries what it claims as data, and its text is rendered only from that data. A claim says
// which subject (an asset, a group, a session), which measure (a one-session change, a group median, a share), the
// judgement word it prints (an id of CLAIM_WORDS, never a free string), the figures it prints, each with what it is
// (label) and what it was computed on (basis), and the date of the data. A word that compares names what it compares
// against (compare); a superlative names the group it ranks within (rank). The checker (scripts/lib/claim-validate.mjs)
// reads the same claim beside the facts it came from, so a word and its numbers can be tested by machine on every
// session on disk instead of by a reader on the screen.
//
// Only this file ships: the vocabulary, the claim constructor and the composer. Nothing here judges a claim.
import { signedText, usdKoreanText, usdPerShareText, eokText } from './number.js';
import { shortDate } from '../content/date-labels.js';
import { isIsoDay, hasLeadingIsoDay } from './session-date.js';

/**
 * The judgement words. `sign`: the sign the claim's first figure must carry (a superlative: every ranked figure);
 * `rank`: a superlative over `claim.rank.among`; `index`: the direction the word asserts for `compare.against` on the
 * claim's measure (or `compare.measure`); `relation`: what the figure is to `compare.threshold` (or, without one, to
 * `compare.against`); `same`: the figure moved the same way as `compare.against`; `size`: the move's grade on its own
 * volatility (move-size.js moveGrade) — 'large' for a large-move word.
 */
export const CLAIM_WORDS = Object.freeze({
  rise: { text: '상승', sign: 1 },
  fall: { text: '하락', sign: -1 },
  widen: { text: '확대', sign: 1 },
  narrow: { text: '축소', sign: -1 },
  strong: { text: '강세', sign: 1 },
  weak: { text: '약세', sign: -1 },
  calm: { text: '진정', sign: -1 },
  'most-rose': { text: '가장 많이 오른', sign: 1, rank: true },
  'most-fell': { text: '가장 많이 내린', sign: -1, rank: true },
  largest: { text: '가장 큰 변화', rank: true },
  'main-movers': { text: '크게 움직인 주요' },
  'moved-with': { text: '같이 움직인', same: true },
  'same-way': { text: '같은 방향', same: true },
  'rest-stronger': { text: '지수보다 나머지 종목이 더 강했습니다', relation: 'above' },
  'rest-weaker': { text: '지수보다 나머지 종목이 더 약했습니다', relation: 'below' },
  'cap-fall-rest-rose': { text: '지수 하락은 시가총액이 큰 종목에 더 실렸고 나머지 종목은 오히려 올랐습니다', index: -1, sign: 1, relation: 'above' },
  'cap-fall-rest-less': { text: '지수 하락은 시가총액이 큰 종목에 더 실렸고 나머지 종목은 덜 내렸습니다', index: -1, sign: -1, relation: 'above' },
  'near-high': { text: '고점권', relation: 'above' },
  'only-below': { text: '뿐', relation: 'below' },
  'broad-rise': { text: '상승이 대형주에 그치지 않고 넓게 퍼져 있습니다', index: 1, relation: 'atLeast' },
  'broad-fall': { text: '약세가 시장 전반에 퍼져 있습니다', index: -1, relation: 'below' },
  'broad-derisking': { text: '특정 섹터가 아닌 시장 전반의 고른 위험 축소로 보입니다', index: -1, relation: 'below' },
  'index-defended': { text: '지수와 다수 종목의 방향이 갈렸습니다', index: 1, relation: 'below' },
  'tech-leads': { text: '기술주가 상승을 주도합니다', sign: 1, relation: 'above' },
  'tech-lags': { text: '기술주가 시장보다 약합니다', relation: 'below' },
  inverted: { text: '역전 상태', relation: 'above' },
  spike: { text: '급등', sign: 1, size: 'large', relation: 'atLeast' },
  'stress-zone': { text: '스트레스 구간', relation: 'atLeast' },
  'widening-watch': { text: '확대', sign: 1, relation: 'atLeast' },
  'over-line': { text: '초과', relation: 'above' },
  'at-least': { text: '이상', relation: 'atLeast' },
  correction: { text: '조정', relation: 'atMost' },
  bear: { text: '약세장', relation: 'atMost' },
  'bear-edge': { text: '약세장 문턱', relation: 'above' },
  'pre-correction': { text: '조정 전', relation: 'above' }
});

// How a figure prints, by unit: a signed change (pct, bp), a size multiple (x), a share or a yield level (share, rate),
// a plain level (level), a count (count), a dollar amount (usd), a signed 억원 amount (eok), dollars per share (perShare), an unscaled ratio (ratio: a PEG), a change in percentage
// points (pp, its size: the word carries the direction), a duration (years, months).
const grouped = (value, digits) => value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const UNITS = Object.freeze({
  pct: { digits: 1, text: (value, digits) => signedText(value, digits, '%') },
  bp: { digits: 0, text: (value, digits) => signedText(value, digits, 'bp') },
  x: { digits: 1, text: (value, digits) => `${Math.abs(value).toFixed(digits)}배` },
  share: { digits: 0, text: (value, digits) => `${value.toFixed(digits)}%` },
  rate: { digits: 2, text: (value, digits) => `${grouped(value, digits)}%` },
  spread: { digits: 0, text: (value, digits) => `${grouped(value, digits)}bp` },
  level: { digits: 2, text: (value, digits) => grouped(value, digits) },
  count: { digits: 0, text: (value, digits) => `${grouped(value, digits)}개` },
  usd: { digits: 0, text: (value) => usdKoreanText(value) },
  // A signed dollar amount: a flow into or out of something, or a change of a dollar level ("+592억 달러").
  usdChange: { digits: 0, text: (value) => { const body = usdKoreanText(value); return `${value > 0 && body !== '0달러' ? '+' : ''}${body}`; } },
  eok: { digits: 0, text: eokText },
  perShare: { digits: 2, text: (value, digits) => usdPerShareText(value, digits) },
  ratio: { digits: 2, text: (value, digits) => value.toFixed(digits) },
  pp: { digits: 1, text: (value, digits) => `${Math.abs(value).toFixed(digits)}%p` },
  years: { digits: 0, text: (value, digits) => `${value.toFixed(digits)}년` },
  months: { digits: 0, text: (value, digits) => `${value.toFixed(digits)}개월` }
});
export const CLAIM_UNITS = Object.freeze(Object.keys(UNITS));

/**
 * The period a filer's figure (subject `filer:<symbol>`) is read over, as `KIND:<end>` or `SPAN:<start>~<end>`: FY a
 * fiscal year, TTM the four quarters through `end`, Q one quarter, SPAN fiscal years `start` to `end`, M6 the six
 * months of prices to the session `end`, AT a level on the day `end`. A change figure names its base period (`against`).
 */
export const CLAIM_PERIODS = Object.freeze(['FY', 'TTM', 'Q', 'SPAN', 'M6', 'AT']);
/** { kind, start, end } of a period id, or null for an id outside CLAIM_PERIODS. */
export function periodOf(id) {
  const [kind, days, extra] = String(id || '').split(':');
  const [start, end, more] = String(days || '').split('~');
  const span = kind === 'SPAN';
  if (extra != null || more != null || !CLAIM_PERIODS.includes(kind) || !isIsoDay(span ? end : start) || (span ? !isIsoDay(start) : end != null)) return null;
  return span ? { kind, start, end } : { kind, start: null, end: start };
}
/** A period id from its kind and end day (and a SPAN's start day); null without a day. */
export const periodId = (kind, end, start = null) => (hasLeadingIsoDay(end) ? `${kind}:${start ? `${String(start).slice(0, 10)}~` : ''}${String(end).slice(0, 10)}` : null);

/** The decimals a figure is printed with (its own, else its unit's). */
export const figureDigits = (figure) => (Number.isInteger(figure?.digits) ? figure.digits : UNITS[figure?.unit]?.digits ?? 0);
/** A figure as printed. */
export const figureText = (figure) => UNITS[figure.unit].text(figure.value, figureDigits(figure));
/** The number a reader sees: the figure's value rounded as printed. */
export const printedValue = (figure) => Number(Number(figure.value).toFixed(figureDigits(figure)));
// A range prints its unit once, and its sign once when both ends share it: "+8~13%", "-0~5%", "7.00~8.65%", "-2~+3%".
// Units whose printed form is not number + suffix (dollar amounts) print both ends whole.
const RANGE_SUFFIX = Object.freeze({ pct: '%', bp: 'bp', share: '%', rate: '%', spread: 'bp', level: '', pp: '%p', x: '배', count: '개', years: '년', months: '개월' });
const SIGNED_RANGE = new Set(['pct', 'bp']);
/** Two figures of one unit as one range, low end first. */
export function figureRangeText(lo, hi) {
  const suffix = RANGE_SUFFIX[lo?.unit];
  if (!hi || lo.unit !== hi.unit || suffix == null) return `${figureText(lo)}~${hi ? figureText(hi) : ''}`;
  const a = printedValue(lo), b = printedValue(hi);
  const bare = (figure, value) => grouped(Math.abs(value), figureDigits(figure));
  if (!SIGNED_RANGE.has(lo.unit)) return `${a < 0 ? '-' : ''}${bare(lo, a)}~${b < 0 ? '-' : ''}${bare(hi, b)}${suffix}`;
  // a and b are the printed (rounded) values, so a range that prints as 0~0 carries no sign.
  if (a >= 0 && b >= 0) return `${b === 0 ? '' : '+'}${bare(lo, a)}~${bare(hi, b)}${suffix}`;
  // Both at or under zero: the end nearer zero first, the way a forecast of a fall is written ("-0~5%").
  if (a <= 0 && b <= 0) return `-${bare(hi, b)}~${bare(lo, a)}${suffix}`;
  return `-${bare(lo, a)}~+${bare(hi, b)}${suffix}`;
}
/** A claim's compare line printed in its first figure's unit (at compare.digits, else the unit's own decimals). */
export const thresholdText = (claimed) => figureText({ unit: claimed.figures[0].unit, value: claimed.compare.threshold, digits: claimed.compare.digits });
/**
 * The decimals that keep a value apart from the line a word places it against: 39.7 under a line of 40 prints "39.7",
 * not "40" (the word "뿐" beside "40%" and "40% 위로 회복되는지"). `digits` first, at most two more.
 */
export function digitsApart(value, line, digits) {
  let places = digits;
  while (places < digits + 2 && Number.isFinite(value) && value !== line && Number(value.toFixed(places)) === line) places += 1;
  return places;
}

/**
 * A claim. Throws only on a programming error (an unknown word id or unit); missing data is the checker's to report,
 * so a screen never fails on a gap in the inputs.
 * A filer's figure carries `period` (and a change figure `against`); a claim printing figures of two periods declares
 * them in `compare.across`, else the checker reports it.
 * @param {{subject:string, measure:string, word?:string|null, figures?:Array<{value:number, unit:string, basis?:string, label:string, digits?:number, period?:string, against?:string}>, asOf?:string|null, compare?:{against?:string, threshold?:number, relation?:string, across?:string[]}, rank?:{among:string, position?:number}}} fields
 */
export function claim({ subject, measure, word = null, figures = [], asOf = null, compare = null, rank = null }) {
  if (word != null && !CLAIM_WORDS[word]) throw new Error(`claim: unknown word id ${word}`);
  for (const figure of figures) {
    if (!UNITS[figure?.unit]) throw new Error(`claim: unknown unit ${figure?.unit}`);
    for (const id of [figure.period, figure.against]) if (id != null && !periodOf(id)) throw new Error(`claim: unknown period ${id}`);
  }
  return Object.freeze({
    subject: String(subject), measure: String(measure), word, asOf: asOf || null,
    figures: Object.freeze(figures.map((figure) => Object.freeze({ ...figure }))),
    ...(compare ? { compare: Object.freeze({ ...compare }) } : {}),
    ...(rank ? { rank: Object.freeze({ ...rank }) } : {})
  });
}

const isClaim = (value) => !!value && typeof value === 'object' && Array.isArray(value.figures) && typeof value.measure === 'string';
const isSaid = (value) => !!value && typeof value === 'object' && typeof value.text === 'string' && Array.isArray(value.claims);

function slotText(name, path, value) {
  if (isSaid(value)) { if (path.length) throw new Error(`say: {${name}.${path.join('.')}} on composed text`); return { text: value.text, claims: value.claims }; }
  if (isClaim(value)) {
    const index = /^\d+$/.test(path[0] || '') ? Number(path.shift()) : 0;
    const part = path.shift() || 'value';
    if (path.length) throw new Error(`say: {${name}...} has an extra part`);
    if (part === 'word') return { text: value.word ? CLAIM_WORDS[value.word].text : '', claims: [value] };
    if (part === 'date') return { text: shortDate(value.asOf), claims: [value] };
    const figure = value.figures[index];
    if (!figure) throw new Error(`say: {${name}} has no figure ${index}`);
    if (part === 'label') return { text: figure.label, claims: [value] };
    if (part === 'threshold') return { text: thresholdText(value), claims: [value] };
    if (part === 'range') return { text: figureRangeText(value.figures[0], value.figures[1]), claims: [value] };
    if (part !== 'value') throw new Error(`say: {${name}.${part}} is not a figure part`);
    return { text: figureText(figure), claims: [value] };
  }
  // A plain slot is a name (a label, a ticker, a scope). A figure smuggled in as text has no claim; the checker finds
  // it as a printed figure no claim carries.
  if (path.length) throw new Error(`say: {${name}.${path.join('.')}} on plain text`);
  return { text: value == null ? '' : String(value), claims: [] };
}

/**
 * Text from claims: `pattern` holds the fixed words and `{slot}` places, each filled from `slots[name]` — a claim
 * (`{name}` its first figure, `{name.1}` the second, `{name.label}`, `{name.threshold}` its compare line in the
 * figure's unit, `{name.range}` its first two figures as one range, `{name.word}`, `{name.date}` its asOf as M/D), composed text from another say(), or a plain name
 * (never a number: a figure is printed only from a claim).
 * @returns {{text:string, claims:object[]}}
 */
export function say(pattern, slots = {}) {
  const claims = [];
  const text = String(pattern).replace(/\{([\w-]+)((?:\.[\w-]+)*)\}/g, (_, name, rest) => {
    if (!(name in slots)) throw new Error(`say: no slot ${name}`);
    const part = slotText(name, rest ? rest.slice(1).split('.') : [], slots[name]);
    claims.push(...part.claims);
    return part.text;
  });
  return Object.freeze({ text, claims: Object.freeze([...new Set(claims)]) });
}

/** Composed pieces joined with `separator` (empty pieces dropped). */
export function sayJoin(pieces, separator) {
  const kept = pieces.filter((piece) => isSaid(piece) && piece.text);
  return Object.freeze({ text: kept.map((piece) => piece.text).join(separator), claims: Object.freeze([...new Set(kept.flatMap((piece) => piece.claims))]) });
}

/** Empty composed text (an optional part that is absent). */
export const NOTHING = Object.freeze({ text: '', claims: Object.freeze([]) });
