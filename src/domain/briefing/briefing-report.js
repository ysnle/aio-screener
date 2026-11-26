// The 브리핑 report, assembled: the hero figure of the basis session, the headline and its marked word, the three short
// lines, the five-session sequence, the basis week session by session and the fine-print figures. Every value is read
// from the published closes, the opening read (market-story.js buildMarketOpening) and the schedule; this file decides
// nothing new. A value that is not there is null, and the report prints it as missing, never as 0.
import { buildCloseSeries } from '../market/session/close-series.js';
import { closeMoveGrade, sessionStep } from '../market/session/move-size.js';
import { dateInTimezone, resolveMarketCalendarSession, MARKET_HOLIDAY_NAMES } from '../market/session/market-calendar.js';
import { MARKET_WINDOWS } from '../market/session/market-windows.js';
import { buildMarketOpening, earningsMovers } from '../market/story/market-story.js';
import { vixBand } from '../market/sentiment/narrative.js';
import { hyObservation } from './market-read.js';
import { CLAIM_WORDS, claim, say, sayJoin } from '../shared/claim.js';
import { directionOf, signedText } from '../shared/number.js';
import { isIsoDay } from '../shared/session-date.js';
import { shortDate } from '../content/date-labels.js';
import { BRIEFING_REPORT_WORDS as W } from '../content/briefing-report-words.js';

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const addDays = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const weekdayOf = (iso) => new Date(`${iso}T12:00:00Z`).getUTCDay();
export const dayName = (iso) => (iso ? `${shortDate(iso)}(${WEEKDAY[weekdayOf(iso)]})` : '');
const mondayOf = (iso) => addDays(iso, 1 - (weekdayOf(iso) || 7));
/** The Friday of the week that holds `asOf` (null without a date): where the report's 이번 주 rows end. */
export const weekFriday = (asOf) => (isIsoDay(asOf) ? addDays(mondayOf(asOf), 4) : null);

/** The state word of a one-session move: its direction, and its size when graded on the series' own volatility. */
export function dayWord(history, field, change, through) {
  const direction = directionOf(change, field === 'tnx' ? 0 : 1);
  if (!direction) return Number.isFinite(change) ? W.day.flat : null;
  const grade = closeMoveGrade(history, field, change, { through, unit: field === 'tnx' ? 'bp' : 'pct' });
  return `${W.size[grade] ? `${W.size[grade]} ` : ''}${W.day[direction]}`;
}

// The ten-year's one-session change in bp on `date` (null without both closes).
function yieldStep(history, date) {
  const series = buildCloseSeries(history, 'tnx', { through: date });
  const last = series.at(-1), prev = series.at(-2);
  return last && prev && last.date === date ? { value: sessionStep('bp', prev.value, last.value), date: last.date } : null;
}

/**
 * The hero: the S&P 500's one-session move on the opening's basis session, its state word, and the leaders and the
 * ten-year beside it. Null without the S&P 500 move (the report then has no hero, never a 0).
 */
export function reportHero(opening, history = []) {
  const spx = opening?.available ? opening.rows?.spx : null;
  const move = spx?.moves?.[1];
  if (!Number.isFinite(move)) return null;
  const subs = [];
  for (const id of ['ndx', 'sox']) {
    const row = opening.rows[id];
    if (row && row.asOf === spx.asOf && Number.isFinite(row.moves?.[1])) subs.push({ id, label: row.label, text: signedText(row.moves[1], 1, '%') });
  }
  const tnx = yieldStep(history, spx.asOf);
  if (tnx) subs.push({ id: 'tnx', label: '미 10년', text: signedText(tnx.value, 0, 'bp') });
  return { asOf: spx.asOf, value: move, text: signedText(move, 1, '%'), direction: directionOf(move, 1) || 'flat', word: dayWord(history, 'spx', move, spx.asOf), label: spx.label, subs };
}

/**
 * The headline: the opening's lede as written, with the first judgement word its claims carry marked (start, end) so the
 * report can set it apart. The mark comes from the claim's own word id, not from reading the sentence.
 */
export function reportHeadline(opening) {
  const lede = opening?.available ? opening.lines?.find((line) => line.id === 'lede')?.said : null;
  if (!lede?.text) return null;
  for (const item of lede.claims || []) {
    const word = item.word ? CLAIM_WORDS[item.word]?.text : null;
    const at = word ? lede.text.indexOf(word) : -1;
    if (at >= 0) return { text: lede.text, accent: [at, at + word.length] };
  }
  return { text: lede.text, accent: null };
}

/**
 * The three short lines under the prose, each a keyword and its verdict: where the session's move gathered (or how the
 * index split), the state word with what flips it (the diagnosis, else the rebound's line), and the next release.
 * A line whose data is absent is left out. `tint` marks the one that decides the read.
 */
export function reportLines({ opening = null, nextEvent = null, checks = [], lead = null } = {}) {
  const lines = [];
  const lineOf = (id) => opening?.available ? opening.lines?.find((line) => line.id === id) : null;
  // 'gathered' and 'split' exist only on a session whose Nasdaq-100 moved at least RULES.sessionRead.movePct; a quieter
  // session takes the day ledger's lead story instead (`lead`: day-account.js stories[0]).
  const led = lineOf('gathered') || lineOf('split');
  if (led?.said?.text) lines.push({ id: 'led', key: led.label, text: led.said.text });
  else if (lead?.title) lines.push({ id: 'led', key: W.lines.led, text: [lead.title, lead.line].filter(Boolean).join(' — ') });
  const flip = lineOf('diagnosis') || lineOf('watch');
  if (flip?.label && flip.said?.text) lines.push({ id: 'flip', key: flip.label, text: flip.said.text, tint: true });
  const next = nextEvent?.name ? `${nextEvent.when || shortDate(nextEvent.date)} ${nextEvent.name}`.trim() : checks[0] || '';
  if (next) lines.push({ id: 'next', key: W.lines.next, text: next });
  return lines;
}

/**
 * The last `sessions` S&P 500 closes up to `asOf`, each with the ten-year's close of the same date (null when that
 * session has none), and the span's change of both.
 */
export function sessionSequence(history = [], asOf = null, sessions = MARKET_WINDOWS.week) {
  const all = buildCloseSeries(history, 'spx', { through: asOf || null });
  if (all.length < sessions + 1) return null;
  const points = all.slice(-sessions);
  const base = all.at(-1 - sessions);
  const yields = new Map(buildCloseSeries(history, 'tnx', { through: asOf || null }).map((point) => [point.date, point.value]));
  const tnxBase = yields.get(base.date), tnxLast = yields.get(points.at(-1).date);
  return {
    asOf: points.at(-1).date, from: points[0].date,
    points: points.map((point) => ({ date: point.date, value: point.value, tnx: yields.has(point.date) ? yields.get(point.date) : null })),
    change: sessionStep('pct', base.value, points.at(-1).value),
    tnxChange: Number.isFinite(tnxBase) && Number.isFinite(tnxLast) ? sessionStep('bp', tnxBase, tnxLast) : null
  };
}

// One session's note: the rule-built session read of that date (session-read.js `moves`: the indexes' moves and their
// shape, through the opening built as of that close), then a company's earnings reaction only when the day ledger of that
// same session ranks the company a lead or major move. No read, no note.
function sessionNote(date, prevDate, { history, briefs, day }) {
  const read = buildMarketOpening({ history, through: date });
  const moves = read.available && read.asOf === date ? read.session?.moves : null;
  if (!moves?.text) return null;
  const ranked = day?.sessions?.us === date ? new Set((day.facts || []).filter((fact) => fact?.kind === 'stock-move' && fact.date === date && ['lead', 'major'].includes(fact.rank)).map((fact) => fact.subjects?.[0]).filter(Boolean)) : new Set();
  const report = ranked.size ? earningsMovers(briefs, { from: prevDate, to: date }).find((row) => row.date === date && ranked.has(row.symbol)) : null;
  if (!report) return moves;
  return sayJoin([moves, say('{name} 실적 첫 반응 {m}.', { name: report.name, m: claim({ subject: `stock:${report.symbol}`, measure: 'change1d', asOf: date, figures: [{ value: report.pct, unit: 'pct', basis: 'change1d', label: report.name }] }) })], ' ');
}

/**
 * Monday to Friday of the week that holds `asOf`. A session up to `asOf` carries its S&P 500 move, its state word and
 * one note; a closed day names the holiday; a day after `asOf` lists the scheduled rows of that New York date instead
 * (no move). `scale`: the largest absolute move, for one bar scale.
 */
export function weekRows({ history = [], briefs = null, day = null, schedule = [], asOf = null } = {}) {
  if (!asOf) return null;
  const monday = mondayOf(asOf);
  const closes = buildCloseSeries(history, 'spx', { through: asOf });
  const at = new Map(closes.map((point, index) => [point.date, index]));
  const rows = [];
  for (let i = 0; i < 5; i += 1) {
    const date = addDays(monday, i);
    const session = resolveMarketCalendarSession({ market: 'US', date });
    const base = { date, label: dayName(date) };
    if (session.status === 'closed') { rows.push({ ...base, kind: 'closed', word: W.day.closed, note: MARKET_HOLIDAY_NAMES.NYSE?.[date] ? { text: MARKET_HOLIDAY_NAMES.NYSE[date], claims: [] } : null }); continue; }
    if (date > asOf) {
      const events = schedule.filter((row) => Number.isFinite(row?.atMs) && dateInTimezone(row.atMs, 'America/New_York') === date);
      const named = events.filter((row) => row.kind !== 'earnings').map((row) => row.label);
      const reports = events.filter((row) => row.kind === 'earnings').length;
      rows.push({ ...base, kind: 'ahead', word: W.day.ahead, events: named, reports });
      continue;
    }
    const index = at.get(date);
    const prev = index > 0 ? closes[index - 1] : null;
    const move = prev ? sessionStep('pct', prev.value, closes[index].value) : null;
    rows.push({ ...base, kind: 'session', move, word: move == null ? W.day.missing : dayWord(history, 'spx', move, date), note: prev ? sessionNote(date, prev.date, { history, briefs, day }) : null });
  }
  const moves = rows.map((row) => row.move).filter(Number.isFinite);
  return { asOf, rows, scale: Math.max(1, ...moves.map(Math.abs)) };
}

// The fine-print figures: the close field, how its level prints, and the unit of its one-session change.
const FINE = Object.freeze([
  { id: 'tnx', label: '미 10년', level: (v) => `${v.toFixed(2)}%`, unit: 'bp' },
  { id: 'dxy', label: '달러지수', level: (v) => v.toFixed(2), unit: '%' },
  { id: 'wti', label: 'WTI', level: (v) => `${v.toFixed(2)}달러`, unit: '%' },
  { id: 'gold', label: '금', level: (v) => `${Math.round(v).toLocaleString('en-US')}달러`, unit: '%' },
  { id: 'vix', label: 'VIX', level: (v) => v.toFixed(2), unit: 'pt' },
  { id: 'hy', label: '하이일드 스프레드' },
  { id: 'usdkrw', label: '원/달러', level: (v) => `${v.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}원`, unit: '%' },
  { id: 'btc', label: '비트코인', level: (v) => `${Math.round(v).toLocaleString('en-US')}달러`, unit: '%' }
]);

// The fixed state word a figure already has elsewhere: the opening's cross-market rows (credit, dollar: the rule-decided
// axis word), the VIX level band (sentiment/narrative.js), the ten-year's session word (dayWord). Others have none.
function stateWord(id, { cross, level, step, history, date }) {
  const row = (key) => (Array.isArray(cross) ? cross.find((item) => item?.id === key)?.word || null : null);
  if (id === 'hy') return row('credit');
  if (id === 'dxy') return row('dollar');
  if (id === 'vix') { const band = vixBand(level); return band.blocked ? null : band.label; }
  if (id === 'tnx') return Number.isFinite(step) ? dayWord(history, 'tnx', step, date) : null;
  return null;
}
const glossOf = (word, change) => [word, change].filter(Boolean).join(', ');

/**
 * One tile per fine-print figure: { id, label, value, gloss, date, behind }. The gloss is the figure's fixed state word
 * when it has one, then the one-session change (HY: its five-session change); `behind` is true when the figure's own date
 * is not the basis session, and the tile then names it. A figure with no close is { value: null } and prints as missing.
 * `cross`: the opening's cross-market rows (buildMarketOpening `cross`), for the credit and dollar words.
 */
export function finePrint({ history = [], macroHistory = null, credit = null, asOf = null, cross = null } = {}) {
  return FINE.map((spec) => {
    if (spec.id === 'hy') {
      const hy = hyObservation({ macroHistory, credit, through: asOf });
      if (!hy || !Number.isFinite(hy.level)) return { id: spec.id, label: spec.label, value: null };
      return { id: spec.id, label: spec.label, value: `${Math.round(hy.level)}bp`, gloss: glossOf(stateWord('hy', { cross }), Number.isFinite(hy.change5) ? `5일 ${signedText(hy.change5, 0, 'bp')}` : ''), date: hy.asOf, behind: !!hy.asOf && hy.asOf !== asOf };
    }
    const series = buildCloseSeries(history, spec.id);
    const last = series.at(-1), prev = series.at(-2);
    if (!last) return { id: spec.id, label: spec.label, value: null };
    const step = prev ? (spec.unit === 'bp' ? sessionStep('bp', prev.value, last.value) : spec.unit === 'pt' ? last.value - prev.value : sessionStep('pct', prev.value, last.value)) : null;
    const gloss = glossOf(stateWord(spec.id, { cross, level: last.value, step, history, date: last.date }), step == null ? '' : `1일 ${signedText(step, spec.unit === 'bp' ? 0 : 1, spec.unit)}`);
    return { id: spec.id, label: spec.label, value: spec.level(last.value), gloss, date: last.date, behind: !!asOf && last.date !== asOf };
  });
}
