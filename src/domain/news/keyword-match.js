// v59.42: the one keyword rule for every news list (scoring, topics, exclusion, relevance, Telegram). Lists used to
// pick their own rule — plain substring in most, word boundaries in some — so 'nfl' sat inside 'inflation' (P2116),
// 'tax' inside 'taxi', 'rate' inside 'corporate', while '금리' missed '금리가' where a particle followed.
// - Printable ASCII keywords match whole words, plus a plural -s/-es (or the `suffix` given); a boundary is checked only
//   at an edge that is a letter or digit, so 'could reach $' still matches 'could reach $100'. Spaces match any run of
//   whitespace.
// - Other keywords (Korean, Japanese, mixed) match as substrings: Korean attaches particles to the word. A single
//   syllable ('금', '은', '핵') would hit inside most sentences, so it must stand alone ('금리' does not hit '금').
// Text is lower-cased by the caller (the matcher functions below do it themselves).

const DEFAULT_SUFFIX = 'e?s';
const ASCII_RE = /^[\x20-\x7e]+$/;
const EDGE_RE = /[a-z0-9]/;
const PATTERNS = new Map();

function compile(keyword, suffix) {
  const cacheKey = suffix + '\u0000' + keyword;
  let entry = PATTERNS.get(cacheKey);
  if (entry) return entry;
  const raw = String(keyword ?? '').toLowerCase();
  if (ASCII_RE.test(raw)) {
    const k = raw.trim();
    if (!k) entry = { never: true };
    else {
      const body = k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
      const head = EDGE_RE.test(k[0]) ? '(?:^|[^a-z0-9])' : '';
      const tail = EDGE_RE.test(k[k.length - 1]) ? `(?:${suffix})?(?![a-z0-9])` : '';
      entry = { needle: k.split(/\s+/)[0], re: new RegExp(head + body + tail) };
    }
  } else if (raw.length === 1) {
    entry = { needle: raw, re: new RegExp('(?:^|[^\\p{L}\\p{N}])' + raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?=$|[^\\p{L}\\p{N}])', 'u') };
  } else entry = raw ? { needle: raw } : { never: true };
  PATTERNS.set(cacheKey, entry);
  return entry;
}

/** True when `keyword` occurs in lower-cased `text` under the rule above. */
export function keywordHit(text, keyword, { suffix = DEFAULT_SUFFIX } = {}) {
  const entry = compile(keyword, suffix);
  if (entry.never || text.indexOf(entry.needle) < 0) return false;
  return entry.re ? entry.re.test(text) : true;
}

/** The keywords of `list` that occur in `text`, in list order. */
export function matchedKeywords(text, list, options) {
  const t = String(text ?? '').toLowerCase();
  return (list || []).filter((keyword) => keywordHit(t, keyword, options));
}

/** How many keywords of `list` occur in `text`. */
export function countKeywords(text, list, options) {
  return matchedKeywords(text, list, options).length;
}

/** A predicate: does any keyword of `list` occur in the text? */
export function keywordMatcher(list, options) {
  const keywords = (list || []).slice();
  return (text) => {
    const t = String(text ?? '').toLowerCase();
    return keywords.some((keyword) => keywordHit(t, keyword, options));
  };
}
