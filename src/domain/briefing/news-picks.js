// v58.75 (persona review): the news a reader of 오늘·브리핑 asks for first — the night's main stories and, beside a stock or
// theme that moved, the headline that named it the same day. Pure functions over the loaded news, intraday, timeline and
// channel rows; the screens own the layout.
import { finiteNumber as finite } from '../shared/number.js';

// P1391 (owner review 2026-10-02): the important list — the highest-scored story per topic inside the window (moved here
// from the news page so 오늘's 밤사이 핵심 reads the same picks as the news screen).
export function pickImportantNews(items = [], limit = 5) {
  const picked = items.filter((item) => item.storyHasRevision).slice(0, limit);
  const topics = new Set();
  for (const item of [...items].sort((a, b) => (finite(b?.score) || 0) - (finite(a?.score) || 0))) {
    const topic = item?.topic || item?.feedTopic || 'general';
    // Filler is worse than a shorter list: unclassified and low-score items stay in the full feed.
    if (picked.includes(item) || item?._tgChannel || topic === 'general' || (finite(item?.score) || 0) < 50 || topics.has(topic) || picked.length >= limit) continue;
    topics.add(topic);
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
}

// Words that look like tickers in a headline but are not companies, and company names that are ordinary words.
const NOT_TICKERS = new Set(['AI', 'CEO', 'CFO', 'IPO', 'ETF', 'GDP', 'CPI', 'PCE', 'PPI', 'FED', 'SEC', 'EPS', 'USA', 'NYSE', 'FOMC', 'OPEC', 'WTI', 'VIX', 'ECB', 'BOJ', 'EU', 'UK', 'US', 'IMF', 'FDA', 'DOJ', 'FTC', 'API', 'EV', 'M&A', 'ALL', 'NOW', 'NEW', 'BIG', 'TOP', 'ONE', 'KEY', 'LOW', 'CAT', 'BEST', 'HAS', 'ARE', 'FAST', 'TECH', 'REAL', 'SAFE', 'ON', 'IT', 'A', 'O', 'T', 'F', 'C', 'D', 'K', 'L', 'V', 'J']);
const COMMON_NAMES = new Set(['target', 'block', 'unity', 'toast', 'line', 'snap', 'shell', 'ball', 'gap', 'match', 'global', 'general', 'american', 'united', 'first', 'national', 'southern', 'public', 'progressive', 'eaton', 'visa', 'apple', 'oracle', 'meta', 'amazon', 'alphabet', 'booking', 'equity', 'realty', 'energy', 'financial', 'capital', 'international']);
const NAME_SUFFIX = /(?:,?\s+(?:Inc\.?|Incorporated|Corp\.?|Corporation|Company|Co\.?|Holdings?|Group|Ltd\.?|plc|PLC|N\.V\.|S\.A\.|SE|AG|L\.P\.|Class [A-C]|Technolog(?:y|ies)|Networks?|Systems?|Platforms?|Solutions|Enterprises?|Industries|Brands|Therapeutics|Pharmaceuticals|Bancorp|Trust))+$/;
const escape = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The matcher for one company: its ticker as a whole word (3+ letters unless written $X or (X)) or its proper name. */
export function companyMatcher(symbol, name = '') {
  const sym = String(symbol || '').toUpperCase().trim();
  if (!/^[A-Z][A-Z0-9.]{0,6}$/.test(sym)) return null;
  // v59.45 (pipeline review P20-ISSUER-01): a share-class suffix belongs to another line — BRK is not "$BRK.B".
  const end = '(?![A-Za-z0-9]|\\.[A-Za-z0-9])';
  const forms = [`\\$${escape(sym)}${end}`, `\\(${escape(sym)}\\)`, `(?:NASDAQ|NYSE|Nasdaq):\\s?${escape(sym)}${end}`];
  if (sym.length >= 3 && !NOT_TICKERS.has(sym)) forms.push(`(?<![A-Za-z0-9$.])${escape(sym)}${end}`);
  const plain = String(name || '').replace(NAME_SUFFIX, '').replace(/[,.]+$/, '').trim();
  if (plain.length >= 4 && !COMMON_NAMES.has(plain.toLowerCase()) && /^[A-Z]/.test(plain)) forms.push(`(?<![A-Za-z])${escape(plain)}(?![A-Za-z])`);
  return new RegExp(forms.join('|'));
}

const stampOf = (row) => Date.parse(row?.publishedAt || row?.pubDate || row?.published || row?.datetime || '');

/** The window a session's move can be explained in: from the evening before (after-close reports) to the next KST morning. */
export function sessionNewsWindow(session) {
  const start = Date.parse(`${session}T00:00:00Z`);
  return Number.isFinite(start) ? { start: start - 6 * 3600000, end: start + 36 * 3600000 } : null;
}

/**
 * The headline that names `symbol` inside the window, or null. A news title must carry the ticker or the company's own
 * name (never a guess from the topic); a channel post counts only when its producer-extracted tickers list the symbol.
 * News outranks a channel post; within a kind the latest wins.
 */
export function headlineForCompany({ symbol, name = '' }, { news = [], telegram = [], span = null } = {}) {
  const matcher = companyMatcher(symbol, name);
  if (!matcher || !span) return null;
  const sym = String(symbol).toUpperCase();
  const inside = (ms) => Number.isFinite(ms) && ms >= span.start && ms <= span.end;
  let best = null;
  for (const row of Array.isArray(news) ? news : []) {
    const ms = stampOf(row);
    const words = [row?.title, row?.titleKo, row?.ko_title].filter(Boolean).join(' ‖ ');
    if (!inside(ms) || !matcher.test(words)) continue;
    if (!best || ms > best.publishedMs) best = { kind: 'news', row, publishedMs: ms };
  }
  if (best) return best;
  for (const row of Array.isArray(telegram) ? telegram : []) {
    const ms = stampOf(row);
    const tickers = (Array.isArray(row?.tickers) ? row.tickers : []).map((tag) => String(tag).replace(/^\$/, '').toUpperCase());
    if (!inside(ms) || !tickers.includes(sym)) continue;
    // A channel post is often a list of many names; the line shown is the part of the post that names this company,
    // and a post whose published text does not name it (a cut summary) is passed over.
    const part = String(row?.summary || row?.text || '').replace(/https?:\/\/\S+/g, ' ').split(/\s*(?:•|·\s|\n|>>|\s>\s)\s*/).find((segment) => matcher.test(segment));
    if (!part) continue;
    const text = part.replace(/\s+/g, ' ').trim();
    if (!best || ms > best.publishedMs) best = { kind: 'telegram', row, publishedMs: ms, text: text.length > 120 ? `${text.slice(0, 117)}…` : text };
  }
  return best;
}

/**
 * The movers 오늘 names (theme-flow member splits: the stock pairs; sub-theme splits: the theme pairs), each with the
 * same-day headline or null. A theme carries the headline of its most-moved member in the theme's direction, and says
 * which member it is.
 */
export function moveHeadlineRows(themeFlow, { session, news = [], telegram = [], names = {}, maxStocks = 4, maxThemes = 2 } = {}) {
  const span = sessionNewsWindow(session);
  if (!themeFlow?.available || !span) return [];
  const rows = [];
  const seen = new Set();
  const lookup = (sym) => headlineForCompany({ symbol: sym, name: names[sym] || '' }, { news, telegram, span });
  for (const split of themeFlow.memberSplits || []) {
    for (const side of [split.down, split.up]) {
      if (!side?.sym || seen.has(side.sym) || rows.length >= maxStocks) continue;
      seen.add(side.sym);
      rows.push({ kind: 'stock', label: side.sym, move: side.d1, symbol: side.sym, headline: lookup(side.sym) });
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
        const headline = lookup(member.sym);
        if (headline) { found = { member, headline }; break; }
      }
      themes += 1;
      rows.push({ kind: 'theme', label: group.name, move: group.d1, symbol: found?.member.sym || null, memberMove: found?.member.d1 ?? null, headline: found?.headline || null });
    }
    if (themes >= maxThemes * 2) break;
  }
  return rows;
}
