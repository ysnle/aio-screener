// P1601: source identifiers and exact text evidence, never title similarity, own news identity.
const value = (raw) => String(raw ?? '').trim();
const stamp = (row) => value(row?.publishedAt || row?.pubDate || row?.date);
const source = (row) => value(row?.source || row?.feed).toLowerCase();
const issuer = (row) => value(row?.issuerId || row?.issuerCik || row?.cik || row?.issuerSymbol).toUpperCase();
export const isNewsRevision = (row) => !!(row?.correctionOf || row?.retractionOf || row?.supersedes || ['correction', 'retraction'].includes(row?.revisionType));

export function newsArticleKey(row) {
  // A reused feed id/URL with a changed title or timestamp is a version, not a duplicate.
  return JSON.stringify([source(row), value(row?.sourceArticleId || row?.guid || row?.id), value(row?.link || row?.url),
    value(row?.title || row?.headline), value(row?.desc || row?.summary), stamp(row),
    value(row?.correctionOf || row?.retractionOf || row?.supersedes), value(row?.revisionType)]);
}

// P1730: the provisional post-08:00 slot. The 08:00 bundle stays canonical; this slot holds only headlines published at
// or after that bundle's end that the bundle does not already carry (same link or title), newest first, at most `max`.
// A headline that a newer bundle absorbs leaves the slot because its time falls before that bundle's end.
export function selectIntradayNews(rows = [], { cycleEndMs = null, canonical = [], max = 6, nowMs = Date.now() } = {}) {
  if (!Number.isFinite(cycleEndMs)) return [];
  const linkOf = (row) => value(row?.link || row?.url).replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase();
  const titleOf = (row) => value(row?.title || row?.headline).replace(/\s+/g, ' ').toLowerCase();
  const links = new Set((Array.isArray(canonical) ? canonical : []).map(linkOf).filter(Boolean));
  const titles = new Set((Array.isArray(canonical) ? canonical : []).map(titleOf).filter(Boolean));
  const picked = [];
  for (const row of Array.isArray(rows) ? rows : []) {
    const ms = Date.parse(stamp(row));
    const link = linkOf(row), title = titleOf(row);
    if (!title || !Number.isFinite(ms) || ms < cycleEndMs || ms > nowMs + 15 * 60000) continue;
    if ((link && links.has(link)) || titles.has(title)) continue;
    if (link) links.add(link);
    titles.add(title);
    picked.push({ ...row, publishedMs: ms });
  }
  return picked.sort((a, b) => b.publishedMs - a.publishedMs).slice(0, Math.max(0, max));
}

export function dedupeNewsArticles(rows = []) {
  const seen = new Set();
  return rows.filter((row) => { const key = newsArticleKey(row); if (seen.has(key)) return false; seen.add(key); return true; });
}

export function groupNewsStories(rows = []) {
  const articles = dedupeNewsArticles(rows);
  const parent = articles.map((_, i) => i);
  const find = (i) => parent[i] === i ? i : (parent[i] = find(parent[i]));
  const join = (a, b) => { parent[find(b)] = find(a); };
  const storyIds = new Map();
  const articleIds = new Map();
  articles.forEach((row, i) => {
    const story = row?.sourceStoryId || row?.storyId ? `story:${value(row.sourceStoryId || row.storyId)}`
      : row?.link || row?.url ? `url:${value(row.link || row.url)}`
      : row?.sourceArticleId || row?.guid ? `article:${value(row.sourceArticleId || row.guid)}` : '';
    if (story) {
      const key = JSON.stringify([source(row), issuer(row), story]);
      if (storyIds.has(key)) join(i, storyIds.get(key)); else storyIds.set(key, i);
    }
    for (const id of new Set([row?.sourceArticleId, row?.newsId, row?.id, row?.guid].map(value).filter(Boolean))) {
      const key = JSON.stringify([source(row), issuer(row), id]);
      articleIds.set(key, [...(articleIds.get(key) || []), i]);
    }
  });
  articles.forEach((row, i) => {
    const target = value(row?.correctionOf || row?.retractionOf || row?.supersedes);
    const matches = articleIds.get(JSON.stringify([source(row), issuer(row), target])) || [];
    const roots = [...new Set(matches.map(find))];
    if (target && roots.length === 1 && roots[0] !== find(i)) join(i, roots[0]);
  });
  const groups = new Map();
  articles.forEach((row, i) => { const key = find(i); groups.set(key, [...(groups.get(key) || []), row]); });
  return [...groups.values()].map((members) => {
    const timeline = members.slice().sort((a, b) => (Date.parse(stamp(a)) || 0) - (Date.parse(stamp(b)) || 0));
    // The latest version is the headline; source corrections/retractions remain visible even with a low score.
    const revisions = timeline.filter(isNewsRevision);
    const representative = timeline.at(-1);
    return { ...representative, storyArticles: timeline, storyHasRevision: revisions.length > 0,
      storySelection: '같은 사건의 원문을 발행 순서로 모았습니다. 가장 최근 소식이 대표 제목입니다.' };
  });
}

const escaped = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// 2026-10-13 news audit N06: one-word company names that are also ordinary English words ("US moves to block …",
// "Fed officials snap back", "Progressive Democrats", "investors grab Treasuries", "a lucid explanation"). The
// Telegram matcher (scripts/lib/telegram-tickers.mjs COMMON_WORD_NAMES) already requires a proper noun; news
// issuers now require the proper noun AND a corporate cue near it (Inc/Corp/stock/shares/earnings or the symbol),
// because Title Case headlines capitalise every word.
export const COMMON_WORD_ISSUER_NAMES = new Set(['block', 'snap', 'progressive', 'grab', 'toast', 'lucid', 'vertex', 'elastic',
  'shell', 'visa', 'cadence', 'coherent', 'carnival', 'upstart', 'affirm', 'chewy', 'travelers', 'workday', 'confluent',
  'microchip', 'snowflake', 'paramount', 'iridium', 'occidental', 'abbott', 'vale', 'cactus', 'shoals', 'chevron', 'arm',
  'lowe\'s', 'lowes', 'target']);
const CORPORATE_CUE = /\b(?:Inc|Corp|Corporation|Co|Company|Companies|Holdings|Group|Ltd|plc|Laboratories|Labs|stocks?|shares?|earnings|CEO|results|revenue|guidance|quarter(?:ly)?|profits?|sales|dividends?|buybacks?|outlook)\b/i;
const apostrophes = (text) => String(text || '').replace(/[’‘`]/g, '\'');
// P1755: boot ran these matchers per article x registry entry x name, compiling a fresh RegExp each time.
// Compiled patterns are cached per name/symbol (the pattern depends only on that string) and a plain
// substring test rejects texts that cannot match before any regex runs. The prefilter is only used when
// it is exact: ASCII/Hangul names, whose case-insensitive Unicode matches are all found by toLowerCase
// once U+017F (long s, which folds to "s") is mapped. Other names always run the regex.
const MATCHER_CACHE_LIMIT = 4096;
const cachedMatcher = (cache, key, build) => {
  let hit = cache.get(key);
  if (hit === undefined) {
    if (cache.size >= MATCHER_CACHE_LIMIT) cache.clear();
    hit = build(key);
    cache.set(key, hit);
  }
  return hit;
};
const explicitCueCache = new Map();
const nameMatcherCache = new Map();
const explicitSymbolCache = new Map();
const PREFILTER_SAFE_NAME = /^[\x00-\x7F가-힣]*$/;
const foldedText = (text) => text.toLowerCase().replace(/ſ/g, 's');
let lastFoldSource = null;
let lastFolded = '';
const foldOnce = (text) => {
  if (text !== lastFoldSource) { lastFoldSource = text; lastFolded = foldedText(text); }
  return lastFolded;
};
function symbolNamedExplicitly(text, symbol) {
  if (!symbol) return false;
  const re = cachedMatcher(explicitCueCache, String(symbol).toUpperCase(), (upper) => {
    const sym = escaped(upper);
    return new RegExp(`\\$${sym}(?=$|[^A-Za-z0-9.])|\\(\\s*(?:(?:NYSE|NASDAQ|Nasdaq|NYSEARCA|AMEX|OTC)\\s*:\\s*)?${sym}\\s*\\)|(?:NYSE|NASDAQ|Nasdaq|NYSEARCA|AMEX)\\s*:\\s*${sym}(?=$|[^A-Za-z0-9.])`);
  });
  return re.test(text);
}
// The Unicode pattern is compiled on the first text that passes the prefilter (most names never do).
const buildNameMatcher = (name) => {
  let re = null;
  return {
    get re() {
      if (!re) {
        const particle = /[가-힣]/.test(name) ? '(?:은|는|이|가|을|를|의|와|과|도|에서|에게|으로|로)?' : '';
        re = new RegExp(`(^|[^\\p{L}\\p{N}])(${escaped(name)})${particle}(?=$|[^\\p{L}\\p{N}])`, 'giu');
      }
      return re;
    },
    needle: PREFILTER_SAFE_NAME.test(name) ? foldedText(name) : null,
    oneWord: /^[A-Z][a-z]+(?:'s)?$/.test(name),
    commonWord: COMMON_WORD_ISSUER_NAMES.has(name.toLowerCase())
  };
};
/**
 * True when `text` names the company `name` (case rules above); `symbol` lets an explicit ticker count as the cue.
 * `requireCue` applies the common-word rule to any one-word name (used when a longer legal name was shortened).
 */
export function issuerNameMentioned(rawText, rawName, symbol = '', { requireCue = false } = {}) {
  const name = apostrophes(value(rawName));
  if (!name) return false;
  const text = apostrophes(rawText);
  // P1601: "price target" is not Target the issuer, even when an AI cache suggested TGT.
  if (name.toLowerCase() === 'target') return /\bTarget\s+(?:Corporation|stores?)\b/i.test(text);
  const matcher = cachedMatcher(nameMatcherCache, name, buildNameMatcher);
  if (matcher.needle !== null && !foldOnce(text).includes(matcher.needle)) return false;
  const { re, oneWord } = matcher;
  const common = matcher.commonWord || (requireCue && oneWord);
  for (const match of text.matchAll(re)) {
    if (!oneWord && !common) return true;
    const found = match[2];
    // A one-word Title-case name only counts as a proper noun ("visa rules" is not Visa).
    if (!/^[A-Z]/.test(found)) continue;
    if (!common) return true;
    const at = match.index + match[1].length;
    if (/^-\p{L}/u.test(text.slice(at + found.length))) continue; // "Carnival-like", "Block-level"
    const near = text.slice(Math.max(0, at - 30), at + found.length + 40);
    if (CORPORATE_CUE.test(near) || symbolNamedExplicitly(text, symbol)) return true;
  }
  return false;
}
function mentions(text, name, symbol) { return issuerNameMentioned(text, name, symbol); }

// N07: a bank or broker named as the analyst ("Goldman Sachs raises oil target", "… – Bank of America",
// "JP모건) TSMC: …") is the opinion's source, not the article's issuer — the same principle as the P1428
// earnings-path correction in src/ui/pages/news.js (the reporting company, not the analyst's firm).
const ANALYST_FIRM_ALIASES = { JPM: ['J.P. Morgan', 'JP Morgan', 'JPMorgan Chase'], BAC: ['BofA', 'BofA Securities', 'BofA Global Research'],
  GS: ['Goldman'], MS: [], C: ['Citi', 'Citigroup'], WFC: [], SCHW: ['Schwab'], BLK: [], UBS: ['UBS'], DB: ['Deutsche Bank'],
  JEF: ['Jefferies'], RJF: ['Raymond James'], EVR: ['Evercore', 'Evercore ISI'], PIPR: ['Piper Sandler'], SF: ['Stifel'],
  HSBC: ['HSBC'], BCS: ['Barclays'], NMR: ['Nomura'], MUFG: ['MUFG'] };
const ANALYST_VERB = '(?:analysts?|strategists?|economists?|research|says|said|raises?|raised|cuts?|lifts?|lowers?|flags?|forecasts?|sees|expects?|predicts?|estimates?|upgrades?|downgrades?|initiates?|reiterates?|maintains?|warns?|boosts?|trims?|hikes?|recommends?|bullish|bearish|calls?|projects?|thinks|believes|likes)';
function analystFirmOnly(text, symbol, entry) {
  if (!Object.hasOwn(ANALYST_FIRM_ALIASES, symbol)) return false;
  const names = [entry?.en, entry?.kr, ...ANALYST_FIRM_ALIASES[symbol]].map(value).filter((name) => name && name.length >= 3);
  if (!names.length) return false;
  const alt = names.map(escaped).join('|');
  const N = `(?:${alt})`;
  const t = apostrophes(text);
  const role = [
    new RegExp(`${N}\\s*\\)`, 'iu'),
    new RegExp(`(?:^|\\s)(?:at|from|by|per|via|according to)\\s+${N}`, 'iu'),
    new RegExp(`${N}(?:'s)?\\s+${ANALYST_VERB}\\b`, 'iu'),
    new RegExp(`[–—-]\\s*${N}\\s*$`, 'iu'),
    new RegExp(`^\\s*${N}\\s*:`, 'iu'),
    new RegExp(`:\\s*${N}\\s*$`, 'iu'),
    new RegExp(`${N}(?:은|는|이|가)?\\s*[^.\\n]{0,30}(?:목표주가|투자의견|리포트|보고서|전망치)`, 'u'),
    new RegExp(`${N}(?:에 따르면|\\s*(?:애널리스트|이코노미스트|전략가))`, 'u')
  ].some((re) => re.test(t));
  if (!role) return false;
  const issuerEvidence = symbolNamedExplicitly(t, symbol)
    || new RegExp(`${N}(?:'s)?\\s+(?:shares|stock|earnings|profit|results|revenue|quarterly|Q[1-4]|reports|posts|beats|misses|CEO|board|layoffs|to buy|to acquire|acquires|settles)\\b`, 'iu').test(t)
    || new RegExp(`${N}\\s*(?:의\\s*)?(?:실적|주가|순이익|영업이익|주주)`, 'u').test(t);
  return !issuerEvidence;
}

// N08: Korean short names from the registry `alt` list ("하이닉스", "lg엔솔") count with the same boundary
// rule when longer than two characters; two-character abbreviations ("삼전", "삼바") stay out.
const koreanAlts = (entry) => (Array.isArray(entry?.alt) ? entry.alt : []).map(value).filter((name) => /[가-힣]/.test(name) && name.length > 2);
const issuerNames = (entry) => [entry?.en, entry?.kr, ...koreanAlts(entry)].filter((name) => name && !/^[A-Z0-9.^=-]{1,5}$/.test(name));

export function resolveNewsIssuers(row, candidates = [], entries = {}) {
  const text = `${value(row?.title || row?.headline)} ${value(row?.desc || row?.summary)}`;
  // P1755: same pattern, compiled once per symbol; "$sym"/"(sym)" must appear (ASCII case-insensitive) first.
  const folded = foldedText(text);
  const explicit = (symbol) => {
    const matcher = cachedMatcher(explicitSymbolCache, symbol, (sym) => ({
      re: new RegExp(`\\$${escaped(sym)}(?=$|[^A-Z0-9.])|\\(${escaped(sym)}\\)`, 'i'),
      needles: /^[\x00-\x7F]*$/.test(sym) ? ['$' + sym.toLowerCase(), '(' + sym.toLowerCase() + ')'] : null
    }));
    if (matcher.needles && !matcher.needles.some((needle) => folded.includes(needle))) return false;
    return matcher.re.test(text);
  };
  const requested = Array.isArray(candidates) ? candidates : [];
  const result = new Set();
  for (const candidate of requested) {
    const raw = value(candidate).replace(/^\$+/, '');
    const symbol = raw.toUpperCase();
    if (Object.hasOwn(entries, symbol)) {
      const entry = entries[symbol];
      // An AI-supplied symbol alone cannot establish that this article mentions the company.
      if (explicit(symbol) || issuerNames(entry).some((name) => mentions(text, name, symbol))) result.add(symbol);
    } else if (!/^[A-Z0-9.^=-]{1,5}$/i.test(raw)) {
      const matches = Object.entries(entries).filter(([symbol, entry]) => issuerNames(entry).some((name) => value(name).toLowerCase() === raw.toLowerCase() && mentions(text, name, symbol)));
      if (matches.length === 1) result.add(matches[0][0]);
    }
  }
  // Explicit known symbols and exact canonical company names are useful without an AI cache.
  for (const [symbol, entry] of Object.entries(entries)) {
    if (explicit(symbol) || issuerNames(entry).some((name) => mentions(text, name, symbol))) result.add(symbol);
  }
  for (const symbol of [...result]) if (analystFirmOnly(text, symbol, entries[symbol])) result.delete(symbol);
  return [...result];
}

export function newsEvidence(row) {
  const kind = ({ 'company-release': '기업 발표', 'sec-filing': '공시', reporting: '언론 보도', claim: '미확인 주장', interpretation: '해석' })[row?.evidenceKind];
  const unverified = ['unverified', 'secondary-only'].includes(row?.verificationStatus);
  return { kind: kind || (unverified ? '미확인 주장' : row?._tgChannel ? '채널 소식' : '기사'),
    publishedAt: stamp(row), observedAt: value(row?.observedAt),
    revision: row?.retractionOf || row?.revisionType === 'retraction' ? '철회' : isNewsRevision(row) ? '정정·변경' : '' };
}
