import { finiteNumber as finite } from '../shared/number.js';
import { channelLineFor } from '../news/channel-lines.js';
import { issuerNameMentioned } from '../news/stories.js';
import { COMPANY_NICKNAMES } from '../instruments/nicknames.js';
import { marketOfSymbol } from '../market/session/session-time.js';
import { resolveMarketCalendarSession } from '../market/session/market-calendar.js';
import { afterClose, agrees } from './day-account.js';

const PROMO_TITLES = [/\bstocks? to buy\b/i, /\breasons? to buy\b/i, /\breasons? to sell\b/i, /\bto buy hand over fist\b/i, /\bundervalued\b[^.]*\bstocks\b/i, /(?<![가-힣])사라고/, /(?<![가-힣])매수 추천/];
export const isPromotionalTitle = (title) => PROMO_TITLES.some((pattern) => pattern.test(String(title || '')));

export function pickImportantNews(items = [], limit = 5) {
  const picked = items.filter((item) => item.storyHasRevision).slice(0, limit);
  const topics = new Set();
  for (const item of [...items].sort((a, b) => (finite(b?.score) || 0) - (finite(a?.score) || 0))) {
    const topic = item?.topic || item?.feedTopic || 'general';
    // Filler is worse than a shorter list: unclassified and low-score items stay in the full feed.
    if (picked.includes(item) || item?._tgChannel || isPromotionalTitle(item?.title) || isPromotionalTitle(item?.originalTitle) || topic === 'general' || (finite(item?.score) || 0) < 50 || topics.has(topic) || picked.length >= limit) continue;
    topics.add(topic);
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
}

// Words that look like tickers in a headline but are not companies, and company names that are ordinary words anywhere.
const NOT_TICKERS = new Set(['AI', 'CEO', 'CFO', 'IPO', 'ETF', 'GDP', 'CPI', 'PCE', 'PPI', 'FED', 'SEC', 'EPS', 'USA', 'NYSE', 'FOMC', 'OPEC', 'WTI', 'VIX', 'ECB', 'BOJ', 'EU', 'UK', 'US', 'IMF', 'FDA', 'DOJ', 'FTC', 'API', 'EV', 'M&A', 'ALL', 'NOW', 'NEW', 'BIG', 'TOP', 'ONE', 'KEY', 'LOW', 'CAT', 'BEST', 'HAS', 'ARE', 'FAST', 'TECH', 'REAL', 'SAFE', 'ON', 'IT', 'A', 'O', 'T', 'F', 'C', 'D', 'K', 'L', 'V', 'J']);
const GENERIC_NAMES = new Set(['line', 'ball', 'gap', 'match', 'unity', 'global', 'general', 'american', 'united', 'first', 'national', 'southern', 'public', 'equity', 'realty', 'energy', 'financial', 'capital', 'international']);
const NAME_SUFFIX = /(?:,?\s+(?:Inc\.?|Incorporated|Corp\.?|Corporation|Company|Co\.?|Holdings?|Group|Ltd\.?|plc|PLC|N\.V\.|S\.A\.|SE|AG|L\.P\.|Class [A-C]|Technolog(?:y|ies)|Networks?|Systems?|Platforms?|Solutions|Enterprises?|Industries|Brands|Therapeutics|Pharmaceuticals|Bancorp|Trust))+$/;
const escape = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const KOREAN_NAMES = new Map();
for (const [word, sym] of Object.entries(COMPANY_NICKNAMES)) if (/^[가-힣]+$/.test(word)) KOREAN_NAMES.set(sym, [...(KOREAN_NAMES.get(sym) || []), word]);

/**
 * The matcher for one company, `{ test(text) }` or null: its ticker as a whole word (3+ letters unless written $X or (X)),
 * or its name by the news issuer rule (stories.js issuerNameMentioned: any letter case for a full name, a proper noun
 * with a corporate cue beside it for an ordinary word or a legal name cut to one word). `aliases` are further names
 * (the registry's Korean name, or a Latin one of four letters or more); the Korean nicknames of nicknames.js always count.
 */
export function companyMatcher(symbol, name = '', { aliases = [] } = {}) {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!sym) return null;
  const forms = [];
  if (/^[A-Z][A-Z0-9.]{0,6}$/.test(sym)) {
    // A share-class suffix belongs to another line: BRK is not "$BRK.B".
    const end = '(?![A-Za-z0-9]|\\.[A-Za-z0-9])';
    // "인공지능(AI)" glosses a word, so a symbol that is one is not read in brackets right after Hangul.
    const word = NOT_TICKERS.has(sym);
    forms.push(`\\$${escape(sym)}${end}`, `${word ? '(?<![가-힣])' : ''}\\(${escape(sym)}\\)`, `(?:NASDAQ|NYSE|Nasdaq):\\s?${escape(sym)}${end}`);
    if (sym.length >= 3 && !word) forms.push(`(?<![A-Za-z0-9$.])${escape(sym)}${end}`);
  }
  const ticker = forms.length ? new RegExp(forms.join('|')) : null;
  const full = String(name || '').trim();
  const plain = full.replace(NAME_SUFFIX, '').replace(/[,.]+$/, '').trim();
  const names = plain.length >= 4 && !GENERIC_NAMES.has(plain.toLowerCase()) ? [[plain, plain !== full]] : [];
  for (const alias of [...aliases, ...(KOREAN_NAMES.get(sym) || [])]) {
    const word = String(alias || '').trim(), korean = /[가-힣]/.test(word);
    if (word.length < (korean ? 2 : 4) || word.toUpperCase() === sym || GENERIC_NAMES.has(word.toLowerCase()) || names.some(([known]) => known.toLowerCase() === word.toLowerCase())) continue;
    // A Latin alias is read as a proper noun: one word must be capitalised in the text ("Google", not "google").
    names.push([korean ? word : word.replace(/^[a-z]/, (first) => first.toUpperCase()), false]);
  }
  if (!ticker && !names.length) return null;
  return { test: (text) => {
    const words = String(text || '');
    return (ticker ? ticker.test(words) : false) || names.some(([known, requireCue]) => issuerNameMentioned(words, known, sym, { requireCue }));
  } };
}

const stampOf = (row) => Date.parse(row?.publishedAt || row?.pubDate || row?.published || row?.datetime || '');
const HOUR = 3600000;
const CLOCKS = new Map();
// The instant of a wall-clock time ("16:00") on a date in an exchange's time zone.
const zonedMs = (date, clock, timeZone) => {
  const guess = Date.parse(`${date}T${clock}:00Z`);
  if (!CLOCKS.has(timeZone)) CLOCKS.set(timeZone, new Intl.DateTimeFormat('sv-SE', { timeZone, dateStyle: 'short', timeStyle: 'short' }));
  return 2 * guess - Date.parse(`${CLOCKS.get(timeZone).format(guess).replace(' ', 'T')}:00Z`);
};
const openSessionBeside = (market, date, step) => {
  for (let ms = Date.parse(`${date}T12:00:00Z`) + step * 24 * HOUR, tries = 0; tries < 10; ms += step * 24 * HOUR, tries += 1) {
    const day = resolveMarketCalendarSession({ market, date: new Date(ms).toISOString().slice(0, 10) });
    if (day.status !== 'closed') return day.status === 'open' ? day : null;
  }
  return null;
};
const WINDOWS = new Map();

/**
 * The window a session's move can be explained in, for that market: from the previous session's close to the next
 * session's open. A report after this session's close did not cause the move (day-account.js afterClose); it can only
 * be a recap. For a date the calendar does not cover the span is a fixed day and a half.
 */
export function sessionNewsWindow(session, market = 'US') {
  const key = `${market}|${session}`;
  if (WINDOWS.has(key)) return WINDOWS.get(key);
  const midnight = Date.parse(`${String(session || '').slice(0, 10)}T00:00:00Z`);
  let span = Number.isFinite(midnight) ? { start: midnight - 6 * HOUR, end: midnight + 36 * HOUR } : null;
  const day = span ? resolveMarketCalendarSession({ market, date: session }) : null;
  if (day?.status === 'open') {
    const before = openSessionBeside(market, day.date, -1), after = openSessionBeside(market, day.date, 1);
    const close = zonedMs(day.date, day.close, day.timezone);
    span = { start: before ? zonedMs(before.date, before.close, before.timezone) : close - 24 * HOUR, end: after ? zonedMs(after.date, after.open, after.timezone) : close + 16 * HOUR };
  }
  if (WINDOWS.size >= 16) WINDOWS.clear();
  WINDOWS.set(key, span);
  return span;
}

/**
 * The headline that names `symbol` for the `session` move, or null. A news title must carry the ticker or the company's
 * own name (never a guess from the topic) and must not point the other way from `move`; a channel post counts only when
 * its producer-extracted tickers list the symbol. The earliest report before the close wins; with none, the earliest
 * report after the close whose own words state the move's direction (a recap). News outranks a channel post.
 */
export function headlineForCompany({ symbol, name = '', move = null, aliases = [] }, { news = [], telegram = [], signals = [], session = null } = {}) {
  const matcher = companyMatcher(symbol, name, { aliases });
  const sym = String(symbol || '').toUpperCase();
  const span = matcher ? sessionNewsWindow(session, marketOfSymbol(sym)) : null;
  if (!span) return null;
  const seed = { date: String(session).slice(0, 10), subjects: [sym] };
  const inside = (ms) => Number.isFinite(ms) && ms > span.start && ms <= span.end;
  const change = finite(move);
  let best = null;
  for (const row of Array.isArray(news) ? news : []) {
    const ms = stampOf(row);
    const titleKo = row?.titleKo || row?.ko_title || '';
    if (!inside(ms) || !matcher.test([row?.title, titleKo].filter(Boolean).join(' ‖ '))) continue;
    const fact = { title: row?.title, titleKo, at: new Date(ms).toISOString() };
    const recap = afterClose(fact, seed);
    if ((recap && change === null) || !agrees(fact, change ?? NaN, seed)) continue;
    if (!best || Number(recap) < Number(best.recap) || (recap === best.recap && ms < best.publishedMs)) best = { kind: 'news', row, publishedMs: ms, recap };
  }
  if (best) return best;
  for (const row of Array.isArray(telegram) ? telegram : []) {
    const ms = stampOf(row);
    const tickers = (Array.isArray(row?.tickers) ? row.tickers : []).map((tag) => String(tag).replace(/^\$/, '').toUpperCase());
    if (!inside(ms) || !tickers.includes(sym) || afterClose({ at: new Date(ms).toISOString() }, seed)) continue;
    // A channel post shows only the fact the producer extracted from it about this company (a target-price action, a
    // quarter against estimates), in the app's own sentence; its text is never copied here.
    const text = channelLineFor(sym, row, signals);
    if (!text) continue;
    if (!best || ms < best.publishedMs) best = { kind: 'telegram', row, publishedMs: ms, text };
  }
  return best;
}

/**
 * The movers 오늘 names (theme-flow member splits: the stock pairs; sub-theme splits: the theme pairs), each with the
 * headline for that session (headlineForCompany) or null. A theme carries the headline of its most-moved member in the
 * theme's direction, and says which member it is. `aliasesOf(sym)` gives a company's further names (Korean).
 */
export function moveHeadlineRows(themeFlow, { session, news = [], telegram = [], signals = [], names = {}, aliasesOf = () => [], maxStocks = 4, maxThemes = 2 } = {}) {
  if (!themeFlow?.available || !sessionNewsWindow(session)) return [];
  const rows = [];
  const seen = new Set();
  const lookup = (sym, move) => headlineForCompany({ symbol: sym, name: names[sym] || '', move, aliases: aliasesOf(sym) }, { news, telegram, signals, session });
  for (const split of themeFlow.memberSplits || []) {
    for (const side of [split.down, split.up]) {
      if (!side?.sym || seen.has(side.sym) || rows.length >= maxStocks) continue;
      seen.add(side.sym);
      rows.push({ kind: 'stock', label: side.sym, move: side.d1, symbol: side.sym, headline: lookup(side.sym, side.d1) });
    }
  }
  let themes = 0;
  for (const split of themeFlow.splits || []) {
    for (const group of [split.up, split.down]) {
      if (!group || themes >= maxThemes * 2) continue;
      const direction = Math.sign(group.d1);
      const members = (group.rows || []).map((row) => ({ sym: String(row.sym || '').toUpperCase(), d1: Number(row.ret1d) }))
        .filter((row) => row.sym && Number.isFinite(row.d1) && Math.sign(row.d1) === direction)
        .sort((a, b) => Math.abs(b.d1) - Math.abs(a.d1));
      let found = null;
      for (const member of members.slice(0, 4)) {
        const headline = lookup(member.sym, member.d1);
        if (headline) { found = { member, headline }; break; }
      }
      themes += 1;
      rows.push({ kind: 'theme', label: group.name, move: group.d1, symbol: found?.member.sym || null, memberMove: found?.member.d1 ?? null, headline: found?.headline || null });
    }
    if (themes >= maxThemes * 2) break;
  }
  return rows;
}
