// v59.70 (owner 2026-11-07, "시장의 흐름·이야기·내러티브·심리 … 처음부터 끝까지 유기적으로"): the stories the market is
// talking about, as data a screen can show. Moved out of scripts/lib/narrative-context.mjs (owner 2026-10-18), which
// fed them only to the model prompt. Sources are AIO's own artifacts — the Telegram research digest (four public
// channels) and the screener's issuer headline memos on large five-session moves — and stay secondary material:
// attention, not evidence (_artifacts/x-bookmarks-20261105/NARRATIVE-UX-HANDOFF.md). A count says how much a story is
// being relayed, never that it is true or that it moved a price. No post text is published (owner 2026-11-01, Telegram
// processed only): a story carries counts, timing, the verification mix and the movers' symbols and moves.
//
// Each story names the user's question, the analysis note that says how to read it (learning-core LESSONS frames), and
// the macro-crossroads branches it would feed if it is right (`branches`) — the bridge from a story to the scenario
// engine's conditions, next release and response costs (src/domain/narrative/narrative-cards.js).
import { reportVerification } from '../news/report-verification.js';
import { readRowNumber } from '../../data/contracts/screener.js';

export const NARRATIVE_WINDOW_HOURS = 72;
export const NARRATIVE_RECENT_HOURS = 24;
export const NARRATIVE_MAX_THEMES = 5;
// v59.74 (site QA 11/7): the wire headlines are the third source. The midterm "블루웨이브" sell-off filled the news list
// for two days while the stories read only relayed posts and mover memos, so it showed as a fading schedule item.
// A headline weighs one post; at most this many count, so a syndicated burst cannot outweigh the research channels.
export const NARRATIVE_NEWS_WEIGHT_CAP = 6;
export const NARRATIVE_MOVER_MIN_ABS_RET5D = 10;
export const NARRATIVES_VERSION = 'narratives.v1';

// v59.45 (R3-01): short acronyms and English names need word boundaries ('sPIKe', 'aBUNDant', 'exciting' read as PIK, Bund,
// Citi); '유가증권시장' is not 유가 and '시즌이란' (a particle) is not Iran.
export const NARRATIVE_THEMES = Object.freeze([
  { id: 'ai-funding-credit', label: 'AI 인프라 조달·신용', promptLabel: 'AI 인프라 조달·신용 (코어위브·네오클라우드·데이터센터 채권)', question: 'AI 데이터센터 투자의 빚 조달과 그 빚의 안정성',
    frames: ['ai-infra-credit-ladder', 'forced-seller-chain'], branches: ['creditstress', 'aibust'],
    re: /코어위브|CoreWeave|\bCRWV\b|네비우스|\bNebius\b|\bNBIS\b|네오\s?클라우드|neocloud|데이터\s?센터\s*(?:채권|부채|금융|자금)|data cent(?:er|re) \b(?:(?:bond|debt)\b|financ)|GPU\s*(?:담보|금융)|GPU[- ]backed|AI\s*(?:자금\s*조달|부채|채권)|AI \b(?:debt|funding|financing)\b|블루\s?아울|Blue Owl/i },
  { id: 'ai-profitability', label: 'AI 수익성·밸류에이션 의구심', promptLabel: 'AI 수익성·밸류에이션 의구심 (앤스로픽·오픈AI·버블론)', question: 'AI 투자의 수익 회수와 앞서 간 기대의 차이',
    frames: ['ai-capex-payback', 'narrative-ledger-check'], branches: ['aibust', 'reflation'],
    re: /앤트로픽|앤스로픽|Anthropic|오픈\s?AI|OpenAI|AI\s*(?:버블|거품)|AI bubble|AI\s*(?:수익성|투자\s*회수|지출\s*지속)|AI \b(?:spending|monetiz|profitab|skeptic|doubt\b)|하이퍼\s?스케일러|hyperscaler/i },
  { id: 'memory-cycle', label: '메모리 사이클', promptLabel: '메모리 사이클 (D램·HBM·중국 증산)', question: '메모리 가격과 공급의 정점 통과 여부',
    frames: ['memory-cycle-lead', 'tech-claim-stages'], branches: ['aibust', 'reflation'],
    re: /메모리|D램|디램|\bDRAM\b|\bHBM\d?e?\b|낸드|\bNAND\b|\bCXMT\b|창신|\bYMTC\b|마이크론|Micron|샌디스크|SanDisk|하이닉스|\bhynix\b|키오시아|Kioxia/i },
  { id: 'deleveraging', label: '디레버리징·강제 매도', promptLabel: '디레버리징·강제 매도 (헤지펀드·반대매매·펀드 청산)', question: '빚을 진 투자자의 강제 매도 여부',
    frames: ['forced-seller-chain', 'crowding-breadth-extreme'], branches: ['volshock', 'creditstress'],
    re: /디레버리징|deleverag|헤지\s?펀드|hedge funds?|강제\s*(?:청산|매도)|반대\s*매매|마진\s*콜|margin calls?|forced (?:selling|liquidation)|펀드\s*(?:청산|파산|환매)|프라임\s*브로커|prime brok|\bVARA\b|모멘텀\s*(?:붕괴|청산)|momentum \b(?:crash|unwind)\b/i },
  { id: 'private-credit', label: '사모신용·크레딧', promptLabel: '사모신용·크레딧 (환매·등급·부도 확률)', question: '회사채·사모대출 시장의 자금 경색 여부',
    frames: ['private-credit-redemption', 'ai-infra-credit-ladder'], branches: ['creditstress'],
    re: /사모\s*(?:신용|대출|크레딧)|private credit|\bBDCs?\b|환매\s*(?:중단|제한|요청)|\bPIK\b|부도\s*확률|디폴트|신용\s*등급|투기\s*등급|정크|하이일드|high[- ]yield|\bjunk\b/i },
  { id: 'sovereign-debt', label: '선진국 재정·국채', promptLabel: '선진국 재정·국채 (유럽·영국·일본 장기물)', question: '재정 적자가 장기 금리에 주는 상승 압력',
    frames: ['long-bond', 'growth-inflation-balance'], branches: ['fiscalsteep'],
    re: /유럽[^.。\n]{0,20}(?:부채|재정|국채|금융\s*리스크)|프랑스\s*(?:국채|재정|신용)|길트|\bgilts?\b|분트|\bBunds?\b|\bJGBs?\b|일본\s*(?:국채|장기\s*금리)|sovereign debt|재정\s*적자|fiscal deficit|기간\s*프리미엄|term premium|국채\s*발작/i },
  { id: 'us-politics', label: '미국 정치 (선거 결과·셧다운)', promptLabel: '미국 정치 (중간선거 결과·블루웨이브·셧다운)', question: '선거 결과·셧다운 같은 정치 변수가 정책 경로와 위험 선호에 주는 변화',
    frames: ['headline-provenance'], branches: ['fiscalsteep', 'volshock'], // v59.74: an election result moved risk appetite (11/5 -4.4%) before rates; both paths are read
    // v59.74: the result words too — 11/5 headlines said "블루웨이브 쇼크", "Democrats' midterm gains", "post-midterm sell-off".
    re: /중간\s*선거|midterms?|셧다운|government shutdown|부채\s*한도|debt ceiling|블루\s*웨이브|blue\s*wave|민주당\s*(?:압승|승리|약진|장악)|Democrat(?:s|ic)?(?:['’]s?)?\s+\b(?:sweep|victor(?:y|ies)|wins?|gains|takeover)\b/i },
  { id: 'oil-geopolitics', label: '유가·지정학', promptLabel: '유가·지정학 (호르무즈·이란)', question: '지정학 위험이 유가를 거쳐 물가와 성장으로 번지는 경로',
    frames: ['oil-shock-split', 'geopolitical-shock-paths'], branches: ['oilshock'],
    re: /호르무즈|Hormuz|(?<![가-힣])이란|\bIran(?:ian)?\b|유가(?!증권)|oil price|원유|\bcrude\b|브렌트|\bBrent\b|\bOPEC\b/i }
]);
export const NARRATIVE_BY_ID = Object.freeze(Object.fromEntries(NARRATIVE_THEMES.map((theme) => [theme.id, theme])));

/** Wire headlines of the window (data.json news + newsIntraday), one per title, read in English and Korean. */
export function newsHeadlinePosts(news, { nowMs, windowHours = NARRATIVE_WINDOW_HOURS }) {
  const since = nowMs - windowHours * 3600000;
  const byTitle = new Map();
  for (const item of Array.isArray(news) ? news : []) {
    const title = String(item?.title || '').trim();
    const ts = Date.parse(item?.pubDate || item?.fetchedAt || '');
    if (!title || byTitle.has(title) || !Number.isFinite(ts) || ts < since || ts > nowMs + 15 * 60000) continue;
    byTitle.set(title, { kind: 'news', id: `news:${title}`, ts, text: `${title} ${item.titleKo || ''}` });
  }
  return [...byTitle.values()];
}

/** Relayed research posts of the window, one per id (the digest lists an item under several keys). */
export function telegramPosts(digest, { nowMs, windowHours = NARRATIVE_WINDOW_HOURS }) {
  const since = nowMs - windowHours * 3600000;
  const byId = new Map();
  for (const key of ['current24hItems', 'topItems', 'broadItems']) {
    for (const item of Array.isArray(digest?.[key]) ? digest[key] : []) {
      const ts = Date.parse(item?.datetime || '');
      if (!item?.id || !item.summary || !Number.isFinite(ts) || ts < since || ts > nowMs + 15 * 60000) continue;
      byId.set(item.id, { kind: 'telegram', id: item.id, channel: item.channel || 'telegram', ts, score: Number(item.score) || 0, text: String(item.summary) });
    }
  }
  return [...byId.values()];
}

// Quote pages and market-wide listicles name the ticker without telling its story.
const MEMO_NOISE_RE = /latest stock news|stock forecasts?|stocks? (?:making big moves|that explain|to watch)|stock price,? news|charts?, data/i;
export const memoHeadlines = (memo) => String(memo || '').split(' · ').map((part) => part.trim()).filter((part) => part && !MEMO_NOISE_RE.test(part));

/** Screener rows whose verified issuer headline sits on a large five-session move: the story behind the price. */
export function moverMemos(screener, { nowMs, windowHours = NARRATIVE_WINDOW_HOURS }) {
  const rows = screener?.data && typeof screener.data === 'object' ? screener.data : {};
  const since = nowMs - windowHours * 3600000;
  const out = [];
  for (const [sym, row] of Object.entries(rows)) {
    const headlines = memoHeadlines(row?.newsMemo);
    if (!headlines.length || row.newsMemoVerified === false) continue;
    const ret5d = readRowNumber(row, 'ret5d');
    const ts = Date.parse(row.newsObservedAt || row.newsTs || '');
    if (!Number.isFinite(ret5d) || Math.abs(ret5d) < NARRATIVE_MOVER_MIN_ABS_RET5D || !Number.isFinite(ts) || ts < since) continue;
    const liquidity = readRowNumber(row, 'dollarVolume30d') ?? readRowNumber(row, 'tradedValue30d') ?? readRowNumber(row, 'dollarVolume') ?? 0;
    out.push({ kind: 'ticker', id: `ticker:${sym}`, sym, ts, ret5d, liquidity, score: Math.abs(ret5d) * Math.log10(Math.max(10, liquidity)), headlines, text: headlines.join(' · ') });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 40);
}

/**
 * The window's stories, heaviest first: relayed posts (72h, of which 24h), the 24h against the 48h before it, the
 * verification mix and the movers whose own headline names the story. `posts`/`movers` may be passed when the caller
 * already built them (the prompt builder keeps its samples from the same pass).
 */
export function detectNarratives({ telegramDigest = null, screener = null, news = null, nowMs = Date.now(), windowHours = NARRATIVE_WINDOW_HOURS, posts = null, movers = null } = {}) {
  const allPosts = posts || telegramPosts(telegramDigest, { nowMs, windowHours });
  const allMovers = movers || moverMemos(screener, { nowMs, windowHours });
  const allNews = newsHeadlinePosts(news, { nowMs, windowHours });
  const recentSince = nowMs - NARRATIVE_RECENT_HOURS * 3600000;
  const themes = [];
  for (const theme of NARRATIVE_THEMES) {
    const tg = allPosts.filter((post) => theme.re.test(post.text));
    const tickers = allMovers.filter((row) => theme.re.test(row.text));
    const press = allNews.filter((row) => theme.re.test(row.text));
    if (!tg.length && !tickers.length && !press.length) continue;
    const recent = tg.filter((post) => post.ts >= recentSince).length;
    const earlier = tg.length - recent;
    // Attention change: the last 24 hours against the average day of the 48 before it. A story with no earlier posts is
    // new in the window; fewer than three posts is too few to call a trend.
    const perDayBefore = earlier / Math.max(1, (windowHours - NARRATIVE_RECENT_HOURS) / 24);
    const trend = tg.length < 3 ? 'few' : earlier === 0 ? 'new' : recent >= perDayBefore * 1.5 ? 'rising' : recent <= perDayBefore * 0.5 ? 'fading' : 'steady';
    const checks = tg.map((post) => reportVerification(post.text));
    // A matching mover is the market voting on the story; it weighs as much as two relayed posts.
    const weight = tg.length + recent + tickers.length * 2 + Math.min(press.length, NARRATIVE_NEWS_WEIGHT_CAP);
    themes.push({ id: theme.id, label: theme.label, weight, telegramCount: tg.length, recentCount: recent, earlierCount: earlier, trend,
      rumorCount: checks.filter((check) => check === 'rumor').length, unconfirmedCount: checks.filter((check) => check === 'unconfirmed').length,
      tickerCount: tickers.length, newsCount: press.length, latestAt: new Date(Math.max(...tg.map((post) => post.ts), ...tickers.map((row) => row.ts), ...press.map((row) => row.ts))).toISOString(),
      movers: tickers.slice(0, 4).map((mover) => ({ sym: mover.sym, ret5d: Math.round(mover.ret5d * 10) / 10 })),
      _posts: tg, _tickers: tickers });
  }
  return themes.sort((a, b) => b.weight - a.weight);
}

/** The published form (market-day.json `narratives`): no post text, no private fields. */
export function publishedNarratives(themes, { nowMs = Date.now(), windowHours = NARRATIVE_WINDOW_HOURS, max = NARRATIVE_MAX_THEMES } = {}) {
  return {
    version: NARRATIVES_VERSION, at: new Date(nowMs).toISOString(), windowHours, recentHours: NARRATIVE_RECENT_HOURS,
    stories: themes.slice(0, max).map(({ _posts, _tickers, ...story }) => story)
  };
}

// v59.70 (lens plan, narrative step 2 '바뀐 점'): which stories entered or left the top list since the previous KST day.
// market-day.json is rebuilt every refresh, so the previous artifact is minutes old; the stories keep a short day log
// (one entry per KST date, the last run of that day wins) and the change is read against the latest earlier day.
export const NARRATIVE_LOG_DAYS = 8;
const kstDay = (ms) => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
export function narrativeDayLog(previous, current, { nowMs = Date.now() } = {}) {
  const today = kstDay(nowMs);
  const ids = (current?.stories || []).map((story) => story.id);
  const prior = (Array.isArray(previous?.log) ? previous.log : []).filter((row) => row?.date && row.date < today && Array.isArray(row.ids));
  const log = [...prior, { date: today, ids }].slice(-NARRATIVE_LOG_DAYS);
  const base = prior.at(-1) || null;
  const changes = base ? { since: base.date, added: ids.filter((id) => !base.ids.includes(id)), dropped: base.ids.filter((id) => !ids.includes(id)) } : null;
  return { log, changes };
}
