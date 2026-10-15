// Server news backstop split out of scripts/fetch-data.mjs (v57.62): the KST 08:00 completed-24h cycle, feed list,
// source-tier/impact scoring, same-event dedupe and topic caps, intraday selection, and per-ticker memo selection.
// Scoring and selection are pure (unit-testable without the producer); fetchNews/fetchTickerNewsItems do the RSS I/O.
// fetch-data.mjs imports and re-exports them.
import { round } from './producer-math.mjs';
import { _fetchRss, _fetchRssWithRetry } from './producer-http.mjs';
import { newsArticleKey, issuerNameMentioned } from '../../src/domain/news/stories.js';

// ── WO-6 (ops): 서버측 뉴스 백스톱 (브라우저 CORS 프록시 전멸 대비) ──
// 왜: 클라이언트 뉴스는 제3자 프록시(allorigins 등, 자주 죽음)에 의존. 서버(Actions)는 CORS가
//     없으므로 안정적으로 RSS를 받아 data.json.news로 떨군다. 클라이언트는 자체 뉴스가 비었을
//     때만 이걸 폴백으로 렌더(작동 중이면 손대지 않음 — additive). Google News RSS는 서버 fetch에
//     안정적이고 <source> 태그로 실제 매체명을 준다.
function _googleNewsSearchUrl(query, hl = 'en-US', gl = 'US', ceid = 'US:en') {
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=' + hl + '&gl=' + gl + '&ceid=' + ceid;
}

const NEWS_CYCLE_POLICY = 'kst-0800-completed-24h';
const NEWS_CYCLE_CUTOFF_HOUR_KST = 8;
const KST_OFFSET_MS = 9 * 3600000;
const DAY_MS = 24 * 3600000;
export const MINIMUM_CURRENT_NEWS = 10;

export function deriveCyclePublication({
  marketSnapshotPublished = false,
  quoteCount = 0,
  requiredQuoteCount = 0,
  newsCount = 0,
  minimumNewsCount = MINIMUM_CURRENT_NEWS,
  historyUpdated = false
} = {}) {
  const blockers = [];
  if (marketSnapshotPublished !== true) blockers.push('market-snapshot-not-published');
  if (!(Number(requiredQuoteCount) > 0 && Number(quoteCount) >= Number(requiredQuoteCount))) blockers.push('quote-coverage-incomplete');
  if (!(Number(newsCount) >= Number(minimumNewsCount))) blockers.push('current-news-below-minimum');
  if (historyUpdated !== true) blockers.push('history-update-incomplete');
  return Object.freeze({
    complete: blockers.length === 0,
    status: blockers.length === 0 ? 'PUBLISHED' : 'DEGRADED',
    blockers: Object.freeze(blockers),
    components: Object.freeze({
      marketSnapshotPublished: marketSnapshotPublished === true,
      quoteCount: Number(quoteCount) || 0,
      requiredQuoteCount: Number(requiredQuoteCount) || 0,
      newsCount: Number(newsCount) || 0,
      minimumNewsCount: Number(minimumNewsCount) || MINIMUM_CURRENT_NEWS,
      historyUpdated: historyUpdated === true
    })
  });
}

function _fmtKstCycleDate(ms) {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function getKst0800NewsCycle(nowMs = Date.now()) {
  const kstNow = new Date(nowMs + KST_OFFSET_MS);
  const y = kstNow.getUTCFullYear();
  const m = kstNow.getUTCMonth();
  const d = kstNow.getUTCDate();
  let endMs = Date.UTC(y, m, d, NEWS_CYCLE_CUTOFF_HOUR_KST, 0, 0, 0) - KST_OFFSET_MS;
  if (nowMs < endMs) endMs -= DAY_MS;
  const startMs = endMs - DAY_MS;
  return {
    policy: NEWS_CYCLE_POLICY,
    cutoffHourKst: NEWS_CYCLE_CUTOFF_HOUR_KST,
    startMs,
    endMs,
    start: new Date(startMs).toISOString(),
    end: new Date(endMs).toISOString(),
    label: `${_fmtKstCycleDate(startMs)} 08:00 KST ~ ${_fmtKstCycleDate(endMs)} 08:00 KST`,
    nextRefresh: new Date(endMs + DAY_MS).toISOString(),
  };
}

export const NEWS_FEEDS = [
  { query: 'Reuters Bloomberg CNBC market moving stocks S&P 500 Nasdaq Federal Reserve Treasury yields oil when:2d', source: 'Google News - Market movers', topic: 'macro', country: 'us', tier: 1 },
  { query: 'stock market OR S&P 500 OR Nasdaq OR Federal Reserve OR Treasury yield OR inflation when:2d', source: 'Google News - US markets', topic: 'macro', country: 'us', tier: 2 },
  { query: 'Nvidia OR Micron OR semiconductor OR AI stocks OR data center OR earnings guidance when:2d', source: 'Google News - AI/Semis', topic: 'semi', country: 'us', tier: 2 },
  { query: 'Iran OR Hormuz OR Red Sea OR oil prices OR geopolitics OR sanctions when:2d', source: 'Google News - Geopolitics/Energy', topic: 'geo', country: 'global', tier: 1 },
  { query: 'dollar OR yen OR Treasury yields OR bond market OR credit spreads OR gold when:2d', source: 'Google News - FX/Bonds', topic: 'fxbond', country: 'global', tier: 1 },
  { query: 'LQD OR HYG OR corporate bonds OR credit spreads OR investment grade OAS OR rating downgrade OR AI capex funding OR data center financing when:2d', source: 'Google News - Credit/Funding', topic: 'credit', country: 'global', tier: 1 },
  { query: 'upgrade OR downgrade OR price target OR analyst rating OR earnings guidance stock when:2d', source: 'Google News - Analyst/Earnings', topic: 'analyst', country: 'us', tier: 2 },
  // P1373: the ko/KR edition was queried with English terms and returned no in-cycle items.
  { query: '코스피 OR 코스닥 OR 삼성전자 OR SK하이닉스 OR 외국인 순매수 OR 원달러 환율 when:2d', source: 'Google News - Korea markets', topic: 'korea', country: 'kr', tier: 2 },
  // v57.71 (owner 2026-10-15): Google News indexed no Korean article after 08:00 KST by 09:56 on a -6% KOSPI morning. The
  // wire's own market feed (newest first, minutes old) is read on the same refresh cadence; no per-user request.
  { url: 'https://www.yna.co.kr/rss/market.xml', source: '연합뉴스', topic: 'korea', country: 'kr', tier: 2 },
].map(feed => feed.url ? feed : ({ ...feed, url: _googleNewsSearchUrl(feed.query, feed.country === 'kr' ? 'ko' : 'en-US', feed.country === 'kr' ? 'KR' : 'US', feed.country === 'kr' ? 'KR:ko' : 'US:en') }));

const SERVER_NEWS_PRIORITY_RULES = [
  { label: 'macro-rates', points: 14, re: /\b(fed|fomc|powell|rate cut|rate hike|inflation|cpi|ppi|pce|payroll|jobs report|recession|soft landing|treasury yield|bond yield)\b/i },
  { label: 'geopolitics-energy', points: 14, re: /\b(iran|hormuz|red sea|israel|lebanon|ukraine|sanction|tariff|export control|oil prices?|wti|brent|lng|opec)\b/i },
  { label: 'ai-semis', points: 13, re: /\b(nvidia|nvda|semiconductor|chip|hbm|dram|sk hynix|samsung electronics|tsmc|asml|blackwell|rubin|data center|ai infrastructure)\b/i },
  { label: 'credit-funding', points: 12, re: /\b(lqd|hyg|oas|credit spreads?|corporate bonds?|investment grade|high yield|rating downgrade|debt financing|funding costs?|capex funding|project finance|data center financing)\b/i },
  { label: 'earnings-guidance', points: 10, re: /\b(earnings|revenue|eps|guidance|outlook|margin|buyback|dividend|preannounces?)\b/i },
  { label: 'analyst-action', points: 8, re: /\b(upgrade|downgrade|price target|rating|initiates|overweight|underweight|buy rating|sell rating)\b/i },
  { label: 'fx-bonds-commodities', points: 8, re: /\b(dollar|yen|euro|yuan|won|dxy|forex|gold|copper|credit spread|yield curve)\b/i },
  // P1504: broad market vocabulary — counts toward the topic floor with a small weight so 'Nasdaq hits new high,
  // 10-year yield tops 5.3%' or 'global bond sell-off' are not dropped as off-topic.
  { label: 'market-general', points: 4, re: /\b(stocks?|stock market|wall street|equities|s&p 500|nasdaq|dow jones|russell 2000|yields?|bonds?|10-year|30-year|treasur(?:y|ies)|oil|crude|commodit(?:y|ies)|futures|markets?)\b/i },
  { label: 'mega-cap', points: 8, re: /\b(aapl|apple|msft|microsoft|nvda|nvidia|amzn|amazon|meta|tesla|tsla|googl|google|avgo|broadcom|amd|oracle|orcl|jpm|exxon|xom)\b/i },
];

// 2026-10-13 news audit N13: "Adding Nvidia … is How Fortunes Are Made" and the same promise-of-wealth family.
const SERVER_NEWS_CLICKBAIT_RE = /\b(next nvidia|next tesla|must buy|guaranteed return|millionaire|hidden gem|penny stock|to the moon|won't believe|don't miss|best stocks? to buy now|fortunes? (?:are|is|was|were|could be|can be|will be) made|make you (?:rich|a fortune)|life[- ]changing (?:money|wealth|returns?)|generational wealth|set (?:you )?up for life|retire (?:rich|early|a millionaire)|turn \$?[\d,]+ into)\b/i;
const SERVER_NEWS_UNVERIFIED_RE = /\b(people familiar|sources say|according to sources|unconfirmed|rumor|reportedly|may be considering|is said to)\b/i;
const SERVER_NEWS_TIER1_SOURCE_RE = /\b(Reuters|Bloomberg|Associated Press|AP News|Financial Times|Wall Street Journal|WSJ|CNBC)\b/i;
// P1720: the Korean-edition feed labels these same tier-2 publishers in Korean (연합뉴스 = Yonhap), which `\b` never
// matches around Hangul, so a Yonhap headline ranked as tier 3. Same publishers, their Korean labels — not new sources.
// v57.69 (P1804, 2026-10-15 crash audit): the intraday slot admits tier 1-2 only, and every Korean economic daily ranked
// tier 3 — on a -6% KOSPI morning the slot held one US headline. The national economic dailies, wire services and
// broadcasters are tier 2 (as MarketWatch/Barron's are); regional and single-topic outlets stay tier 3.
const SERVER_NEWS_TIER2_SOURCE_RE = /\b(?:MarketWatch|Barron's|Nikkei|Yonhap|Naver|Korea JoongAng|The Korea Herald|The Hill|Yahoo Finance|Chosunbiz)\b|^(?:연합뉴스|연합인포맥스|뉴스1|뉴시스|중앙일보|조선일보|동아일보|한겨레|코리아\s?헤럴드|한국경제|한경닷컴|매일경제|서울경제|머니투데이|이데일리|파이낸셜뉴스|헤럴드경제|아시아경제|조선비즈|이투데이|KBS\s?뉴스|MBC\s?뉴스|SBS\s?뉴스|YTN)$/i;
// P1504: the list missed the spellings Google News actually returns ("AD HOC NEWS") and several content farms
// that filled the 2026-10-06 cycle (TradingKey ×4, livetradingnews, BBN Times, simplywall.st).
const SERVER_NEWS_LOW_QUALITY_SOURCE_RE = /\b(Ad[- ]?hoc[- ]?news|MSN|GuruFocus|IndexBox|Pluang|Bitget|Stocktwits|TradingPedia|The Vibes|WBFF|Benzinga|Zacks|TradingKey|livetradingnews|BBN Times|simplywall\.st|Simply Wall St(?:reet)?|Telangana Today|Goodreturns|Startup Fortune|BigGo Finance|Eurasia Business News|bitcoinmagazine|GoldSilver|Motley Fool|FX Leaders|Coinpedia|Blockchain\.News|TMGM|VT Markets|Markets\.com|Admirals?|Action Forex|Moomoo|Invezz|Capital\.com|Plus500|XTB|FXOpen|Exness|AvaTrade|eToro|MarketBeat|24\/7 Wall St)\b/i;
// N12 (2026-10-13 audit): the additions after Blockchain.News are CFD-broker and trading-app marketing desks (TMGM,
// VT Markets, Markets.com, Admirals, Action Forex, Moomoo, Invezz …) and template/listicle farms (MarketBeat,
// 24/7 Wall St). Matching runs on the host-normalised source label, so "www.tmgm.com" is caught as well.
// Google News sometimes returns the publisher as a bare URL; only its host is kept as the source label.
export function newsSourceLabel(raw) {
  const text = String(raw || '').trim();
  if (!/^https?:\/\//i.test(text) && !/^www\./i.test(text)) return text;
  try { return new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`).hostname.replace(/^www\./i, ''); } catch (_) { return text; }
}
// P1504: Korean headlines matched none of the English priority rules, so every Korean item scored on source and
// recency alone. The same topics in Korean.
const SERVER_NEWS_PRIORITY_RULES_KO = [
  { label: 'ko-macro-rates', points: 14, re: /(금리|기준금리|물가|인플레|연준|FOMC|파월|국채|고용지표|경기침체|한국은행|금통위)/ },
  { label: 'ko-fx', points: 10, re: /(환율|원·?달러|원화|달러|엔화|외환)/ },
  { label: 'ko-semis', points: 13, re: /(반도체|메모리|HBM|D램|낸드|파운드리|삼성전자|SK하이닉스|하이닉스|삼전닉스)/ },
  { label: 'ko-earnings', points: 10, re: /(실적|영업이익|매출|가이던스|잠정|어닝)/ },
  { label: 'ko-flows', points: 9, re: /(외국인|기관|순매수|순매도|공매도|수급|리밸런싱|만기)/ },
  { label: 'ko-market', points: 8, re: /(코스피|코스닥|증시|지수|상장|공모)/ },
  { label: 'ko-geo-trade', points: 12, re: /(관세|제재|수출통제|중동|이란|호르무즈|전쟁|대미\s*투자)/ }
];

function getServerNewsSourceTier(source, feedTier) {
  const src = String(source || '');
  if (SERVER_NEWS_TIER1_SOURCE_RE.test(src)) return 1;
  if (SERVER_NEWS_TIER2_SOURCE_RE.test(src)) return 2;
  if (SERVER_NEWS_LOW_QUALITY_SOURCE_RE.test(src)) return 4;
  if (!src && feedTier) return Math.max(2, feedTier);
  return 3;
}

// Codex browser audit H04 (2026-10-07): weather and baccarat posts were published as 실적/한국 news. The topic
// rules ran over "title + source + feed topic", so every item from an earnings-query feed matched /earnings/
// through its own feed label, and the floor (topicHits > 0) passed it. Topic evidence now comes from the
// headline alone; the feed's topic and the source name are not evidence that the article is about markets.
const SERVER_NEWS_OFFTOPIC_RE = /(바카라|카지노\s*게임|슬롯\s*머신|토토|승률\s*계산|베팅\s*전략|날씨|기온|한파|폭설|폭우|\bweather\b|\bsnowfall\b|\bchinook\b|winter planning|\bbaccarat\b|casino games?|sports betting|\bhoroscope\b)/i;
// Owner 2026-10-12 (뉴스 30건 vs 50건): more slots would add noise, not news. Pages that are not articles — quote
// pages, auto-generated price-target "forecasts", filing-form listings — and reposts whose headline names a month
// two or more months before the cycle are dropped before ranking.
const SERVER_NEWS_NOT_ARTICLE_RE = /(Stock Price, News, Quote|Quote & History|Price Target\s*[—-]\s*Prediction|Forecast\s*[—-]\s*Price Target|^Form\s+\d|\bForm 4\b|Stock Price Today|Price Prediction (?:for )?20\d\d)/i;
const NEWS_MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
export function serverNewsHeadlineMonthStale(headline, nowMs = Date.now()) {
  const match = String(headline || '').toLowerCase().match(/\b(january|february|march|april|june|july|august|september|october|november|december)\s+\d{1,2}\b/);
  if (!match) return false;
  const named = NEWS_MONTHS.indexOf(match[1]);
  const current = new Date(nowMs).getUTCMonth();
  return ((current - named + 12) % 12) >= 2 && ((current - named + 12) % 12) <= 9;
}
export function scoreServerNewsItem(item) {
  const headline = String(item.title || '');
  const text = `${headline} ${item.source || ''}`;
  if (SERVER_NEWS_CLICKBAIT_RE.test(headline)) return { score: 0, selectionReason: 'clickbait-filter' };
  if (SERVER_NEWS_NOT_ARTICLE_RE.test(headline)) { item.topicHits = 0; return { score: 0, selectionReason: 'not-article-filter' }; }
  if (serverNewsHeadlineMonthStale(headline, item.scoringNowMs || Date.now())) { item.topicHits = 0; return { score: 0, selectionReason: 'stale-repost-filter' }; }
  if (SERVER_NEWS_OFFTOPIC_RE.test(headline)) { item.topicHits = 0; return { score: 0, selectionReason: 'off-topic-filter' }; }

  let score = 20;
  const reasons = ['base+20'];
  const sourceTier = getServerNewsSourceTier(item.source, item.feedTier || item.tier);
  item.tier = sourceTier;
  const tierBonus = sourceTier === 1 ? 16 : sourceTier === 2 ? 9 : sourceTier === 3 ? 2 : -8;
  score += tierBonus;
  reasons.push(`source-tier${sourceTier}${tierBonus >= 0 ? '+' : ''}${tierBonus}`);

  const ageH = item.ts ? ((item.scoringNowMs || Date.now()) - item.ts) / 3600000 : 48;
  const recency = ageH <= 1 ? 18 : ageH <= 6 ? 12 : ageH <= 24 ? 6 : ageH <= 48 ? 2 : -8;
  score += recency;
  reasons.push(`recency${recency >= 0 ? '+' : ''}${recency}`);

  let topicHits = 0;
  for (const rule of [...SERVER_NEWS_PRIORITY_RULES, ...SERVER_NEWS_PRIORITY_RULES_KO]) {
    if (rule.re.test(headline)) {
      score += rule.points;
      topicHits += 1;
      reasons.push(`${rule.label}+${rule.points}`);
    }
  }
  // P1504: a headline that touches no market topic is not market news, whatever feed returned it.
  item.topicHits = topicHits;

  if (SERVER_NEWS_UNVERIFIED_RE.test(text)) {
    score -= 8;
    reasons.push('unverified-8');
  }
  if (/\b(opinion|sponsored|partner content|advertisement)\b/i.test(text)) {
    score -= 18;
    reasons.push('promo-opinion-18');
  }
  if (sourceTier >= 4) {
    score -= 8;
    reasons.push('low-quality-source-8');
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, selectionReason: reasons.slice(0, 7).join(' | ') };
}

function serverNewsSourceTierLabel(tier) {
  return ({ 1: 'official-or-wire', 2: 'reputable-secondary', 3: 'aggregator-or-trade', 4: 'low-quality' })[Number(tier)] || 'unknown';
}
function _decodeNewsEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

// RSS <item> 파서 — fetchNews/fetchTickerNewsItems 공용. needLink=true 시 link 없는 항목 제외.
function _parseRssXml(xml, opts) {
  const limit = (opts && opts.limit) || 20;
  const titleLen = (opts && opts.titleLen) || 200;
  const needLink = !!(opts && opts.needLink);
  const items = [];
  for (const b of xml.split(/<item>/i).slice(1, limit + 1)) {
    const title = _decodeNewsEntities((b.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
    const link  = _decodeNewsEntities((b.match(/<link>([\s\S]*?)<\/link>/i)  || [])[1]);
    const pub   = _decodeNewsEntities((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1]);
    const src   = _decodeNewsEntities((b.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1]);
    if (!title || (needLink && !link)) continue;
    const ts = pub ? new Date(pub).getTime() : 0;
    const guid = _decodeNewsEntities((b.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i) || [])[1]);
    // N13: a URL-shaped publisher becomes its host name; the raw value is kept only to strip the title suffix.
    items.push({ title: title.slice(0, titleLen), guid: guid || null, sourceArticleId: guid || null, fetchedAt: new Date().toISOString(), link: link || null, source: newsSourceLabel(src), _sourceRaw: src || '', pubDate: pub || null, ts: isFinite(ts) ? ts : 0 });
  }
  return items;
}

export function newsHeadlineSignature(title) {
  const text = String(title || '').toLowerCase().replace(/\s+-\s+[^-]+$/, '').replace(/[^\p{L}\p{N}.%$ ]/gu, ' ');
  const compact = text.replace(/\s+/g, '');
  const grams = new Set();
  for (let i = 0; i < compact.length - 1; i += 1) grams.add(compact.slice(i, i + 2));
  const figures = new Set((text.match(/\$?\d+(?:\.\d+)?\s*(?:조|억|%|bp|billion|trillion|bn)/g) || []).map((x) => x.replace(/\s/g, '')));
  return { grams, figures };
}
export function newsSameEvent(a, b) {
  let shared = 0;
  for (const gram of a.grams) if (b.grams.has(gram)) shared += 1;
  const jaccard = shared / Math.max(1, a.grams.size + b.grams.size - shared);
  const sameFigure = [...a.figures].some((figure) => b.figures.has(figure));
  return jaccard >= 0.6 || (sameFigure && jaccard >= 0.25);
}

// Google News appends " - Source" to every title; the source is shown separately (hover / folded sources only).
export function cleanNewsTitle(title, source, rawSource = '') {
  const text = String(title || '');
  for (const src of [String(source || '').trim(), String(rawSource || '').trim()]) {
    if (src && text.endsWith(` - ${src}`)) return text.slice(0, -(src.length + 3)).trim();
  }
  return text;
}

// N11 (2026-10-13 audit): paraphrases of one story are not the same headline, so newsSameEvent let seven
// "oil rises on Saudi attacks" and eight "stocks wait for bank earnings and CPI" items through. Within one 24h
// cycle (the date is the cycle), a headline's key entities are its topic; at most two picks may share a pair of
// key entities and at most four (three for an index wrap) a single one.
const NEWS_KEY_ENTITIES = [
  ['oil', /\b(?:oil|crude|brent|wti|opec)\b|유가|원유/i],
  ['gold', /\b(?:gold|bullion|xau)\b|금값|금 가격/i],
  ['inflation', /\b(?:cpi|inflation|ppi|pce)\b|물가|인플레/i],
  ['fed', /\b(?:fed|fomc|powell|federal reserve)\b|연준/i],
  ['index-wrap', /\b(?:s&p 500|dow(?: jones)?|nasdaq|wall street|stock (?:index )?futures|us stocks|stock market today|new york stocks)\b|코스피|코스닥|뉴욕증시/i],
  ['bank-earnings', /\bbank(?:s'|s)? earnings\b|은행 실적/i],
  ['saudi', /\bsaudi\b|사우디/i],
  ['iran', /\b(?:iran|tehran)\b|이란/i],
  ['hormuz', /\bhormuz\b|호르무즈/i],
  ['houthi', /\b(?:houthis?|red sea)\b|후티|홍해/i],
  ['russia-ukraine', /\b(?:russia|ukraine|kremlin)\b|러시아|우크라이나/i],
  ['israel', /\b(?:israel|gaza|hezbollah|lebanon)\b|이스라엘/i],
  ['china', /\b(?:china|chinese|beijing)\b|중국/i],
  ['tariff', /\btariffs?\b|관세/i],
  ['dollar-fx', /\b(?:dollar|dxy|yen|euro|yuan)\b|환율|원·?달러|엔화/i],
  ['treasury', /\b(?:treasur(?:y|ies)|bond yields?|10-year)\b|국채/i],
  ['nvidia', /\bnvidia\b|엔비디아/i],
  ['semis', /\b(?:semiconductors?|chips?|chipmakers?)\b|반도체/i],
];
const NEWS_ENTITY_SINGLE_CAP = { 'index-wrap': 3 };
const NEWS_ENTITY_SINGLE_CAP_DEFAULT = 4;
const NEWS_ENTITY_PAIR_CAP = 2;
export function newsKeyEntities(title) {
  const text = String(title || '');
  return NEWS_KEY_ENTITIES.filter(([, re]) => re.test(text)).map(([key]) => key);
}
export function createNewsTopicCap() {
  const single = new Map();
  const pairs = new Map();
  const pairKeys = (keys) => keys.flatMap((a, i) => keys.slice(i + 1).map((b) => `${a}+${b}`));
  return {
    full(title) {
      const keys = newsKeyEntities(title);
      if (keys.some((key) => (single.get(key) || 0) >= (NEWS_ENTITY_SINGLE_CAP[key] ?? NEWS_ENTITY_SINGLE_CAP_DEFAULT))) return true;
      return pairKeys(keys).some((key) => (pairs.get(key) || 0) >= NEWS_ENTITY_PAIR_CAP);
    },
    add(title) {
      const keys = newsKeyEntities(title);
      for (const key of keys) single.set(key, (single.get(key) || 0) + 1);
      for (const key of pairKeys(keys)) pairs.set(key, (pairs.get(key) || 0) + 1);
    }
  };
}

// P1720: the caller passes the run's attempt time so the collected cycle and meta.newsCycleEnd are one cut even when a
// run straddles 08:00 KST (23:00Z); otherwise newsIntraday is picked against the previous cut and fails the gate.
export async function fetchNews(nowMs = Date.now()) {
  const cycle = getKst0800NewsCycle(nowMs);
  const items = [];    // US/글로벌 피드
  const krItems = [];  // 한국 전용 (reserved slot)
  const intradayCandidates = []; // P1720: published after cycle.endMs (08:00 KST)
  for (const feed of NEWS_FEEDS) {
    const isKr = feed.country === 'kr';
    try {
      const feedUrls = [feed.url, feed.url.replace(/when%3A2d/i, 'when%3A7d')];
      let parsed = [];
      for (const feedUrl of feedUrls) {
        const candidate = _parseRssXml(await _fetchRssWithRetry(feedUrl, 12000), { limit: 40, titleLen: 200, needLink: true }) // 2026-10-12: a deeper candidate pool so the stricter filters below still fill the slots with real articles;
        parsed = candidate;
        const hasCurrent = candidate.some(p => {
          const ts = p.ts;
          return isFinite(ts) && ts >= cycle.startMs && ts < cycle.endMs;
        });
        if (hasCurrent || feedUrl === feedUrls[feedUrls.length - 1]) break;
      }
      for (const p of parsed) {
        const t = p.ts;
        // P1720: articles published after the 08:00 cut are kept aside for the provisional intraday slot; the
        // completed 08:00 bundle below stays the canonical window.
        if (isFinite(t) && t >= cycle.endMs) {
          intradayCandidates.push({ title: p.title, link: p.link, source: p.source || feed.source, _sourceRaw: p._sourceRaw,
            guid: p.guid, sourceArticleId: p.sourceArticleId, ts: t, topic: isKr ? 'kr' : feed.topic, country: feed.country,
            feedTier: feed.tier, feedSource: feed.source });
        }
        if (!isFinite(t) || t < cycle.startMs || t >= cycle.endMs) continue;
        const item = {
          title: p.title, link: p.link, source: p.source || feed.source, _sourceRaw: p._sourceRaw,
          guid: p.guid, sourceArticleId: p.sourceArticleId, fetchedAt: p.fetchedAt, evidenceKind: p.evidenceKind,
          pubDate: p.pubDate, ts: isFinite(t) ? t : 0,
          topic: isKr ? 'kr' : feed.topic,  // 'korea' → 'kr' 정규화
          country: feed.country,
          tier: getServerNewsSourceTier(p.source || feed.source, feed.tier),
          feedTier: feed.tier,
          feedSource: feed.source,
          scoringNowMs: cycle.endMs,
          newsCyclePolicy: cycle.policy,
          newsCycleStart: cycle.start,
          newsCycleEnd: cycle.end,
          newsCycleLabel: cycle.label,
        };
        Object.assign(item, scoreServerNewsItem(item));
        // P1504: selection floor — off-topic headlines (a lacrosse team surfaced through a "Red Sea" query) and
        // low-quality sources are dropped before ranking instead of filling empty slots.
        if (!(item.topicHits > 0) || item.tier >= 4 || !(item.score > 0)) continue;
        if (isKr) { krItems.push(item); } else { items.push(item); }
      }
    } catch (e) { /* 피드별 실패 무시 */ }
  }
  // US/글로벌: 점수순 정렬, 한국: 최신순 정렬
  items.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.ts || 0) - (a.ts || 0));
  krItems.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.ts || 0) - (a.ts || 0));
  const seen = new Set();
  const out = [];
  // P1504: one source may hold at most three of the forty slots (AD HOC NEWS held five).
  const perSource = new Map();
  const SOURCE_CAP = 3;
  const sourceKey = (it) => String(it.source || it.feedSource || '').trim().toLowerCase();
  const sourceFull = (it) => (perSource.get(sourceKey(it)) || 0) >= SOURCE_CAP;
  // Owner 2026-10-12: one event, one slot. Two outlets reporting the same story (same specific figure, or nearly
  // the same headline) used two of the slots; the higher-scored one is kept because candidates arrive score-ordered.
  const pickedGrams = [];
  const sameEvent = (it) => {
    const mine = newsHeadlineSignature(it.title);
    return pickedGrams.some((other) => newsSameEvent(mine, other));
  };
  // Google News appends " - Source" to every title; the source is shown separately.
  const cleanTitle = (it) => cleanNewsTitle(it.title, it.source, it._sourceRaw);
  // N11: paraphrases of one story share key entities ("oil" + "saudi"); see createNewsTopicCap.
  const topicCap = createNewsTopicCap();
  const topicFull = (it) => topicCap.full(cleanTitle(it));
  function pushItem(it) {
    pickedGrams.push(newsHeadlineSignature(it.title));
    perSource.set(sourceKey(it), (perSource.get(sourceKey(it)) || 0) + 1);
    topicCap.add(cleanTitle(it));
    out.push({
      title: cleanTitle(it), link: it.link, source: it.source,
      guid: it.guid, sourceArticleId: it.sourceArticleId, fetchedAt: it.fetchedAt, evidenceKind: it.evidenceKind,
      pubDate: it.pubDate, topic: it.topic, country: it.country,
      tier: it.tier, score: it.score, selectionReason: it.selectionReason,
      feedSource: it.feedSource,
      sourceTierLabel: serverNewsSourceTierLabel(it.tier),
      contentDepth: 'headline-only',
      eventTime: isFinite(it.ts) && it.ts > 0 ? new Date(it.ts).toISOString() : null,
      eventTimeKind: 'published',
      independenceKey: String(it.source || it.feedSource || '').trim().toLowerCase() || null,
      newsCyclePolicy: it.newsCyclePolicy,
      newsCycleStart: it.newsCycleStart,
      newsCycleEnd: it.newsCycleEnd,
      newsCycleLabel: it.newsCycleLabel,
    });
  }
  // 한국 뉴스 최대 3슬롯 먼저 예약
  const KR_SLOTS = 3;
  for (const it of krItems) {
    if (out.length >= KR_SLOTS) break;
    if (sourceFull(it) || topicFull(it)) continue;
    const k = newsArticleKey(it);
    if (seen.has(k) || sameEvent(it)) continue;
    seen.add(k);
    pushItem(it);
  }
  // P1373: score-only ranking let semis/macro/geo fill every slot (fxbond and credit got 0 of 40).
  // Reserve a small floor per under-covered topic before the score-ordered fill.
  for (const [topic, floor] of [['fxbond', 3], ['credit', 2]]) {
    let taken = 0;
    for (const it of items) {
      if (taken >= floor || out.length >= 40) break;
      if (it.topic !== topic) continue;
      if (sourceFull(it) || topicFull(it)) continue;
      const k = newsArticleKey(it);
      if (seen.has(k) || sameEvent(it)) continue;
      seen.add(k);
      pushItem(it);
      taken += 1;
    }
  }
  // 나머지 슬롯을 US/글로벌 뉴스로 채움
  for (const it of items) {
    if (out.length >= 40) break;
    if (sourceFull(it) || topicFull(it)) continue;
    const k = newsArticleKey(it);
    if (seen.has(k) || sameEvent(it)) continue;
    seen.add(k);
    pushItem(it);
  }
  // P1720: the provisional intraday slot rides on the same array without entering its JSON (non-enumerable), so every
  // existing consumer of `news` keeps the canonical 08:00 bundle unchanged.
  Object.defineProperty(out, 'intraday', { value: selectNewsIntraday(intradayCandidates, { cycleEndMs: cycle.endMs, canonical: out }), enumerable: false });
  return out;
}

// P1720 (coordinator N14, 2026-10-13): the completed 08:00 KST bundle left a Korean session's events out until the next
// morning (KOSPI -5.46% on 10/13 had no headline all day). Articles published after the cut get a separate, provisional
// slot: tier 1-2 publishers only, the same clickbait/not-article/off-topic/stale filters and topic cap as the bundle,
// one slot per event (including events already in the bundle), at most two per publisher, at most six. When the next
// 08:00 bundle is cut, these articles fall inside its window and leave this slot by construction.
export const NEWS_INTRADAY_MAX = 6;
export const NEWS_INTRADAY_POLICY = 'kst-0800-after-provisional';
export const NEWS_INTRADAY_LABEL = '08:00 이후 장중 속보 · 잠정';
export function selectNewsIntraday(candidates, { cycleEndMs, nowMs = Date.now(), canonical = [], max = NEWS_INTRADAY_MAX } = {}) {
  if (!Number.isFinite(cycleEndMs)) return [];
  const scored = [];
  for (const raw of Array.isArray(candidates) ? candidates : []) {
    const ts = Number(raw?.ts);
    if (!raw?.title || !raw?.link || !Number.isFinite(ts) || ts < cycleEndMs || ts > nowMs + 15 * 60000) continue;
    const item = { ...raw, ts, scoringNowMs: nowMs };
    Object.assign(item, scoreServerNewsItem(item));
    if (!(item.topicHits > 0) || !(item.score > 0) || !(item.tier <= 2)) continue;
    scored.push(item);
  }
  scored.sort((a, b) => (b.score || 0) - (a.score || 0) || b.ts - a.ts);
  const seen = new Set((Array.isArray(canonical) ? canonical : []).map((row) => newsArticleKey(row)));
  const signatures = (Array.isArray(canonical) ? canonical : []).map((row) => newsHeadlineSignature(row?.title));
  const perSource = new Map();
  const topicCap = createNewsTopicCap();
  const picked = [];
  // As in the bundle (KR_SLOTS), Korean-session items take up to two slots first; the rest is score order.
  const take = (it) => {
    if (picked.length >= max) return;
    const title = cleanNewsTitle(it.title, it.source, it._sourceRaw);
    const key = newsArticleKey(it);
    const signature = newsHeadlineSignature(it.title);
    const publisher = String(it.source || '').trim().toLowerCase();
    if (seen.has(key) || signatures.some((other) => newsSameEvent(signature, other)) || (perSource.get(publisher) || 0) >= 2 || topicCap.full(title)) return;
    seen.add(key);
    signatures.push(signature);
    perSource.set(publisher, (perSource.get(publisher) || 0) + 1);
    topicCap.add(title);
    picked.push({
      title, link: it.link, source: it.source, publishedAt: new Date(it.ts).toISOString(),
      topic: it.topic, market: it.country, tier: it.tier, sourceTierLabel: serverNewsSourceTierLabel(it.tier),
      score: it.score, selectionReason: it.selectionReason, contentDepth: 'headline-only', provisional: true,
    });
  };
  for (const it of scored) if (it.country === 'kr' && picked.length < 2) take(it);
  for (const it of scored) take(it);
  return picked.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

// ── v51.15: 개별 종목 뉴스 enrichment — Google News RSS per-ticker → screener.json newsMemo ──
// _fetchRss + _parseRssXml 공용 헬퍼 기반으로 중복 없이 구현.
// 2026-10-13 news audit N01: the query was "<SYM> stock", so about one memo in five was another company's story
// (V → "NVDA vs AVGO", MA → MA Financial, DE → Edel SE, LIN → Lin Hsiu-ming, NOW → "Microsoft Now Has",
// LOW → "12-Year Low", BROS → Warner Bros.). The query now uses the company's core name, and a headline is kept
// only when it names the issuer (core name, "(SYM)", ":SYM", "$SYM" or "SYM stock"); otherwise the memo is empty.
export function tickerNewsCoreName(name) {
  const original = String(name || '').replace(/[’‘]/g, '\'').trim();
  let core = original.replace(/\s+Class\s+[A-C]$/i, '').replace(/\s+[A-C]$/, '');
  const suffix = /(?:,?\s+(?:Inc\.?|Incorporated|Corp\.?|Corporation|Co\.?|Company|Companies|Holdings?|Group|Ltd\.?|plc|PLC|N\.?V\.?|S\.?A\.?|AG|SE|Technologies|Technology|Tech|Systems|Platforms|Motor|Chase|Intl|International)|\s*&\s*Co\.?)$/;
  for (let prev = null; prev !== core && core;) { prev = core; core = core.replace(suffix, '').trim(); }
  return core || original;
}
export const TICKER_NEWS_WORD_SYMBOLS = new Set(['AI', 'IT', 'ON', 'ALL', 'NOW', 'SO', 'ARE', 'HAS', 'KEY', 'NET', 'APP', 'FAST', 'BE', 'LOW', 'CAT', 'DOW', 'ED', 'PEG', 'AN', 'ONE', 'OR', 'GO', 'MA', 'DE', 'LIN', 'BROS', 'CASH', 'GOLD', 'FUN', 'PLAY', 'MAIN', 'WELL', 'TECH', 'HOOD', 'PATH', 'RUN', 'SHOP', 'SNOW', 'TEAM', 'ZS', 'EV', 'US', 'UK', 'EU', 'CEO', 'IPO', 'ETF', 'GDP', 'CPI', 'FED']);
const _escTickerRe = (text) => String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** 'symbol' | 'name' | null — how (whether) the headline names this issuer. */
export function tickerNewsHeadlineNamesIssuer(title, sym, name) {
  const text = String(title || '').replace(/[’‘]/g, '\'');
  const S = String(sym || '').trim().toUpperCase();
  if (!text || !S) return null;
  const esc = _escTickerRe(S);
  if (new RegExp(`\\$${esc}(?![A-Za-z0-9])|\\(\\s*(?:(?:NYSE|NASDAQ|Nasdaq|NYSEARCA|AMEX|OTC)\\s*:\\s*)?${esc}\\s*(?::\\s*(?:NYSE|NASDAQ|Nasdaq|NYSEARCA|AMEX|OTC)\\s*)?\\)|(?:NYSE|NASDAQ|Nasdaq|NYSEARCA|AMEX)\\s*:\\s*${esc}(?![A-Za-z0-9])`).test(text)) return 'symbol';
  // A ticker that is also a word or common abbreviation ("This AI Stock", "AI's power demand", "KEY stocks") does not
  // name its issuer by "SYM stock" / "SYM's"; those tickers need $SYM, (SYM) or an exchange prefix.
  if (S.length >= 2 && !TICKER_NEWS_WORD_SYMBOLS.has(S) && new RegExp(`(?:^|[^A-Za-z0-9$])${esc}(?=\\s+(?:Stock|stock|Shares|shares|Earnings|earnings)\\b|'s\\b)`).test(text)) return 'symbol';
  const core = tickerNewsCoreName(name);
  // A legal name shortened to one word ("Booking Holdings" → "Booking", "Cisco Systems" → "Cisco") must sit next
  // to a corporate cue (stock/shares/earnings/…), as an ordinary-word company name does.
  const shortened = core !== String(name || '').replace(/[’‘]/g, '\'').trim();
  return issuerNameMentioned(text, core, S, { requireCue: shortened }) ? 'name' : null;
}
const _kstMonthDay = (ms) => new Date(ms + KST_OFFSET_MS).toISOString().slice(5, 10);
export const TICKER_NEWS_MAX_AGE_MS = 3 * DAY_MS;
/**
 * N01/N05/N09/N10/N22: pick at most two recent headlines that name the issuer, from sources and page types the
 * market-news selection would also accept, one per event. Dates are KST; sources travel separately (never in the
 * memo text). Returns null when nothing qualifies (fail-closed: no memo rather than another company's story).
 */
export function selectTickerNewsMemo(items, { sym, name, nowMs = Date.now(), maxItems = 2 } = {}) {
  const candidates = (Array.isArray(items) ? items : [])
    .map((it) => ({ ...it, title: cleanNewsTitle(it?.title, it?.source, it?._sourceRaw).slice(0, 130) }))
    .filter((it) => it.title && Number.isFinite(it.ts) && it.ts > 0 && it.ts <= nowMs + 3600000 && nowMs - it.ts <= TICKER_NEWS_MAX_AGE_MS)
    .sort((a, b) => b.ts - a.ts);
  const picked = [];
  const signatures = [];
  for (const it of candidates) {
    if (picked.length >= maxItems) break;
    if (getServerNewsSourceTier(it.source, 3) >= 4) continue;
    if (SERVER_NEWS_NOT_ARTICLE_RE.test(it.title) || SERVER_NEWS_CLICKBAIT_RE.test(it.title) || serverNewsHeadlineMonthStale(it.title, nowMs)) continue;
    const issuerMatch = tickerNewsHeadlineNamesIssuer(it.title, sym, name);
    if (!issuerMatch) continue;
    const signature = newsHeadlineSignature(it.title);
    if (signatures.some((other) => newsSameEvent(signature, other))) continue;
    signatures.push(signature);
    picked.push({ ...it, issuerMatch });
  }
  if (!picked.length) return null;
  return {
    memo: picked.map((it) => `[${_kstMonthDay(it.ts)}] ${it.title}`).join(' · '),
    sources: picked.map((it) => it.source || null),
    items: picked
  };
}

export async function fetchTickerNewsItems(sym, name, days) {
  const core = tickerNewsCoreName(name);
  const query = core ? `"${core}" stock when:${days || 3}d` : `${sym} stock when:${days || 3}d`;
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query) + '&hl=en-US&gl=US&ceid=US:en';
  try { return { items: _parseRssXml(await _fetchRss(url, 8000), { limit: 15, titleLen: 220 }), error: null }; }
  catch (e) { return { items: [], error: String(e && e.message || e) }; }
}

// N04: the run cap stays at 90 requests; the targets rotate. The first ten universe names (the largest) are
// fetched every run and the rest move through in 80-name slices keyed by the 6-hour run slot, so every U.S. stock
// is reached within about ten runs (~2.5 days); a verified memo is kept for three days in between.
export const TICKER_NEWS_RUN_CAP = 90;
export const TICKER_NEWS_FIXED_HEAD = 10;
export const TICKER_NEWS_ROTATION_SLOT_MS = 6 * 3600000;
export function planTickerNewsTargets(eligible, nowMs = Date.now(), { cap = TICKER_NEWS_RUN_CAP, head = TICKER_NEWS_FIXED_HEAD, slotMs = TICKER_NEWS_ROTATION_SLOT_MS } = {}) {
  const list = [...new Set(Array.isArray(eligible) ? eligible : [])];
  if (list.length <= cap) return { targets: list, fixed: list.length, perRun: 0, cycleRuns: 1, offset: 0 };
  const fixed = list.slice(0, Math.min(head, cap));
  const rest = list.slice(fixed.length);
  const perRun = cap - fixed.length;
  const cycleRuns = Math.ceil(rest.length / perRun);
  const offset = (Math.floor(nowMs / slotMs) % cycleRuns) * perRun;
  return { targets: [...fixed, ...rest.slice(offset, offset + perRun)], fixed: fixed.length, perRun, cycleRuns, offset };
}

function _tickerNewsTimestampMs(value) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    const timestamp = value < 1e12 ? value * 1000 : value;
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  }
  if (typeof value === 'string' && value.trim()) {
    const text = value.trim();
    if (/^\d+(?:\.\d+)?$/.test(text)) {
      const numeric = Number(text);
      const timestamp = numeric < 1e12 ? numeric * 1000 : numeric;
      return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
    }
    const timestamp = Date.parse(text);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  }
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  }
  return null;
}

// Keep publication/observation time separate from collection time. The RSS parser normally
// supplies `ts` derived from pubDate, but accepting either field keeps this boundary fail-closed
// when an upstream parser omits one representation or returns an invalid date.
export function deriveTickerNewsLineage(items, fetchedAt = new Date().toISOString()) {
  const timestamps = (Array.isArray(items) ? items : []).flatMap((item) => [
    _tickerNewsTimestampMs(item?.ts),
    _tickerNewsTimestampMs(item?.pubDate)
  ]).filter((timestamp) => timestamp != null);
  const latest = timestamps.length ? Math.max(...timestamps) : null;
  const newsObservedAt = latest == null ? null : new Date(latest).toISOString();
  const fetchedTimestamp = _tickerNewsTimestampMs(fetchedAt);
  const newsFetchedAt = fetchedTimestamp == null ? null : new Date(fetchedTimestamp).toISOString();
  return { newsObservedAt, newsTs: newsObservedAt, newsFetchedAt };
}
