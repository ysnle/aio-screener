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
function mentions(text, name) {
  if (!name) return false;
  // P1601: "price target" is not Target the issuer, even when an AI cache suggested TGT.
  if (value(name).toLowerCase() === 'target') return /\bTarget\s+(?:Corporation|stores?)\b/i.test(text);
  const particle = /[가-힣]/.test(name) ? '(?:은|는|이|가|을|를|의|와|과|도|에서|에게|으로|로)?' : '';
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped(value(name))}${particle}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text);
}

export function resolveNewsIssuers(row, candidates = [], entries = {}) {
  const text = `${value(row?.title || row?.headline)} ${value(row?.desc || row?.summary)}`;
  const explicit = (symbol) => new RegExp(`\\$${escaped(symbol)}(?=$|[^A-Z0-9.])|\\(${escaped(symbol)}\\)`, 'i').test(text);
  const requested = Array.isArray(candidates) ? candidates : [];
  const result = new Set();
  for (const candidate of requested) {
    const raw = value(candidate).replace(/^\$+/, '');
    const symbol = raw.toUpperCase();
    if (Object.hasOwn(entries, symbol)) {
      const entry = entries[symbol];
      // An AI-supplied symbol alone cannot establish that this article mentions the company.
      if (explicit(symbol) || [entry.en, entry.kr].some((name) => name && !/^[A-Z0-9.^=-]{1,5}$/.test(name) && mentions(text, name))) result.add(symbol);
    } else if (!/^[A-Z0-9.^=-]{1,5}$/i.test(raw)) {
      const matches = Object.entries(entries).filter(([, entry]) => [entry.en, entry.kr].some((name) => value(name).toLowerCase() === raw.toLowerCase() && mentions(text, name)));
      if (matches.length === 1) result.add(matches[0][0]);
    }
  }
  // Explicit known symbols and exact canonical company names are useful without an AI cache.
  for (const [symbol, entry] of Object.entries(entries)) {
    if (explicit(symbol) || [entry.en, entry.kr].some((name) => name && !/^[A-Z0-9.^=-]{1,5}$/.test(name) && mentions(text, name))) result.add(symbol);
  }
  return [...result];
}

export function newsEvidence(row) {
  const kind = ({ 'company-release': '기업 발표', 'sec-filing': '공시', reporting: '언론 보도', claim: '미확인 주장', interpretation: '해석' })[row?.evidenceKind];
  const unverified = ['unverified', 'secondary-only'].includes(row?.verificationStatus);
  return { kind: kind || (unverified ? '미확인 주장' : row?._tgChannel ? '채널 소식' : '기사'),
    publishedAt: stamp(row), observedAt: value(row?.observedAt),
    revision: row?.retractionOf || row?.revisionType === 'retraction' ? '철회' : isNewsRevision(row) ? '정정·변경' : '' };
}
