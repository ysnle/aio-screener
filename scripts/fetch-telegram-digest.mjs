#!/usr/bin/env node
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const CHANNELS = ['aetherjapanresearch', 'insidertracking', 'bornlupin'];
const DEFAULT_DAYS = 14;
const PAGE_LIMIT = Number(process.env.TG_PAGE_LIMIT || 50);
const UA = {
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36 AIO-Telegram-Digest',
  'accept': 'text/html,application/xhtml+xml',
  'accept-language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
};

function argValue(name, fallback = null) {
  const pref = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(pref));
  return found ? found.slice(pref.length) : fallback;
}

const sinceArg = argValue('since');
const days = Number(argValue('days', DEFAULT_DAYS));
const outPath = argValue('out');
const now = new Date(argValue('now', new Date().toISOString()));
const since = sinceArg ? new Date(sinceArg) : new Date(now.getTime() - days * 86400000);

// P571/R262: this used to re-walk the full PAGE_LIMIT횞3-channel횞14-day window from scratch on
// every run (every 30 min via refresh-data.yml ??48x/day), with no cursor/state persisted
// between runs, unlike enrichScreener's 6h self-throttle. The digest we write only keeps a
// per-channel summary (count/pages), not the full item list, so we persist a lightweight
// `lastPostId` cursor per channel and use it to stop pagination as soon as a page's newest
// post ID is already <= what the previous run last saw, instead of always walking the
// entire 14-day window every cycle.
const previousLastPostId = new Map();
// Merge pool: the digest we write never persists the full raw item list (only capped
// topItems/broadItems), so those are what we carry forward to backfill whatever an
// early-stopped scrapeChannel run no longer re-fetches from prior pages.
let previousMergePool = [];
if (outPath && existsSync(outPath)) {
  try {
    const prev = JSON.parse(readFileSync(outPath, 'utf8'));
    for (const ch of (prev.channels || [])) {
      if (ch.channel && Number.isFinite(ch.lastPostId)) previousLastPostId.set(ch.channel, ch.lastPostId);
    }
    const prevSeen = new Set();
    for (const it of [...(prev.topItems || []), ...(prev.broadItems || [])]) {
      if (it && it.id && !prevSeen.has(it.id)) { prevSeen.add(it.id); previousMergePool.push(it); }
    }
  } catch (e) { console.warn(`[fetch-telegram-digest] previous digest read failed (non-fatal, full re-scan): ${e.message}`); }
}

function decodeEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<blockquote[^>]*>/gi, '\n> ')
    .replace(/<\/blockquote>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function classify(text) {
  const raw = String(text || '');
  const tags = [];
  const add = v => { if (!tags.includes(v)) tags.push(v); };
  if (/corporate bond|company bond|investment grade|ig credit|\boas\b|lqd|hyg|credit spread|project finance|rating downgrade|rating downshift|downgrade.*rating|funding cost|debt financing|capex funding|bond market|company debt|회사채|투자등급|크레딧|신용스프레드|스프레드|프로젝트\s*파이낸스|자금조달|조달비용|등급\s*하향|신용등급|신용공여/i.test(raw)) add('credit');
  if (/boj|bank of japan|fomc|fed|federal reserve|cpi|ppi|pce|gdp|gdpnow|treasury|10y|yield|rate cut|rate hike|inflation|deflation|recession|stagflation|tariff|oil|crude|spr|ecb|employment|unemployment|payrolls|달러|금리|물가|인플레|경기침체|유가|중앙은행|관세|연준|고용|실업|국채|입찰/i.test(raw)) add('macro');
  if (/iran|israel|hormuz|middle east|war|sanction|reconstruction|jcpoa|geopolitic|conflict|strait|호르무즈|이란|이스라엘|중동|전쟁|제재|지정학/i.test(raw)) add('geo');
  if (/nvidia|nvda|amd|tsmc|hbm|dram|nand|micron|broadcom|avgo|marvell|mrvl|gpu|cpu|asic|cowos|socamm|hbm4|hbm4e|semiconductor|memory|sk hynix|samsung electronics|반도체|메모리|하이닉스|삼성전자|엔비디아|마이크론/i.test(raw)) add('semi');
  if (/cpo|npo|optical|laser|eml|cw laser|coherent|lumentum|aaoi|mtsi|sive|photonics/i.test(raw)) add('optical');
  if (/power|data center power|sofc|bloom energy|oracle|transformer|grid|gw|800v|fuel cell|electricity|hvdc|전력|데이터센터|변압기|송전|전력망|연료전지/i.test(raw)) add('power');
  if (/anthropic|openai|gpt-|chatgpt|gemini|llama|claude|sovereign ai|export control|ai policy|ai model|소버린|수출통제|AI\s*모델/i.test(raw)) add('ai-policy');
  if (/kospi|kosdaq|korea|krx|samsung|hynix|naver|kakao|외국인|기관|코스피|코스닥|국장|한국장|선물|환율/i.test(raw)) add('kr-market');
  if (/spacex|prime day|amazon|adobe|smci|meta|murata|ipo|buy|upgrade|downgrade|price target|pt\s*\$|earnings|valuation/i.test(raw)) add('equity');
  if (/crypto|bitcoin|ethereum|coinbase/i.test(raw)) add('crypto');
  return tags.length ? tags : ['market-note'];
}

function extractTickers(text) {
  const raw = String(text || '');
  const map = [
    ['NVDA', /\bNVDA\b|nvidia/i], ['AMD', /\bAMD\b|Advanced Micro|MI450/i],
    ['AAPL', /\bAAPL\b|\bApple\b/i], ['MSFT', /\bMSFT\b|\bMicrosoft\b|Azure|Copilot/i],
    ['GOOG', /\bGOOG\b|\bGOOGL\b|Google|Alphabet|Gemini/i], ['META', /\bMETA\b|Meta Platforms/i],
    ['AVGO', /\bAVGO\b|Broadcom|TPU/i], ['AMZN', /\bAMZN\b|Amazon|AWS|Trainium/i],
    ['MU', /\bMU\b|Micron/i], ['TSM', /\bTSM\b|TSMC|Taiwan Semiconductor/i],
    ['MRVL', /\bMRVL\b|Marvell/i], ['ALAB', /\bALAB\b|Astera/i],
    ['LITE', /\bLITE\b|Lumentum/i], ['COHR', /\bCOHR\b|Coherent/i],
    ['AAOI', /\bAAOI\b|Applied Optoelectronics/i], ['MTSI', /\bMTSI\b|MACOM/i],
    ['ORCL', /\bORCL\b|Oracle/i], ['BE', /\bBE\b|Bloom Energy|SOFC/i],
    ['ADBE', /\bADBE\b|Adobe/i], ['SMCI', /\bSMCI\b|Super Micro/i], ['RKLB', /\bRKLB\b|Rocket Lab/i],
    ['6600.T', /Kioxia/i], ['6981.T', /Murata/i],
    ['005930.KS', /Samsung Electronics/i], ['009150.KS', /Samsung Electro/i], ['000660.KS', /SK\s*Hynix/i],
  ];
  const out = [];
  for (const [ticker, re] of map) if (re.test(raw) && !out.includes(ticker)) out.push(ticker);
  return out;
}

// 梨꾨꼸 怨듭?/?쇱젙/?⑥닚 ?덈궡 ?щ? 媛먯? (??먯닔 ?⑤꼸?곗슜)
function isLowSignalPost(text) {
  const t = String(text || '').toLowerCase();
  if (/executive time|event schedule|holiday notice|webinar only/.test(t)) return true;
  if (/humanitarian/.test(t) && !/market|oil|rate|risk|supply|shipping/.test(t)) return true;
  return false;
}

function scoreItem(text, tags, tickers) {
  if (isLowSignalPost(text)) return 20;
  let score = 35;
  score += Math.min(20, tickers.length * 4);
  if (tags.includes('macro')) score += 12;
  if (tags.includes('credit')) score += 12;
  if (tags.includes('geo')) score += 10;
  if (tags.includes('semi')) score += 12;
  if (tags.includes('ai-policy')) score += 10;
  if (tags.includes('power') || tags.includes('optical')) score += 8;
  if (tags.includes('kr-market')) score += 8;
  if (/citi|ubs|jpm|goldman|bofa|morgan stanley|price target|upgrade|downgrade/i.test(text)) score += 10;
  if (/lqd|oas|credit spread|project finance|rating downgrade|funding cost|capex funding|corporate bond|investment grade|회사채|투자등급|크레딧|프로젝트\s*파이낸스|자금조달|등급\s*하향|신용공여/i.test(text)) score += 10;
  if (/\b\d+(\.\d+)?\s*(gw|bp|bps|%|\$|bn|billion|trillion)/i.test(text)) score += 5;
  if (/mega project|capex|data center|large investment/i.test(text)) score += 8;
  if (/circuit\s*breaker|selloff|risk off/i.test(text)) score += 8;
  if (text.length > 500) score += 5;
  if (/executive time|event schedule/i.test(text)) score -= 10;
  return Math.max(0, Math.min(100, score));
}

function parsePage(html, channel) {
  const out = [];
  const re = /<div class="tgme_widget_message[^>]*data-post="([^"]+)"[\s\S]*?<div class="tgme_widget_message_bubble">([\s\S]*?)(?=<\/div><\/div><div class="tgme_widget_message_wrap|<\/section>)/g;
  let m;
  while ((m = re.exec(html))) {
    const post = m[1];
    const block = m[2];
    const tm = block.match(/<time datetime="([^"]+)"/);
    if (!tm) continue;
    const textMatch = block.match(/<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/);
    const text = decodeEntities(textMatch ? textMatch[1] : '');
    if (!text) continue;
    const date = new Date(tm[1]);
    const tags = classify(text);
    const tickers = extractTickers(text);
    out.push({
      id: post,
      channel,
      url: `https://t.me/${post}`,
      datetime: date.toISOString(),
      localDateKst: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year:'numeric', month:'2-digit', day:'2-digit' }).format(date),
      tags,
      tickers,
      score: scoreItem(text, tags, tickers),
      text,
    });
  }
  return out;
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(to);
  }
}

async function scrapeChannel(channel) {
  const items = [];
  const seen = new Set();
  let before = null;
  let pages = 0;
  let reachedOlder = false;
  let reachedKnown = false;
  let maxIdSeen = null;
  const cursor = previousLastPostId.get(channel);
  while (pages < PAGE_LIMIT) {
    pages += 1;
    const url = `https://t.me/s/${channel}${before ? `?before=${before}` : ''}`;
    const html = await fetchText(url);
    const pageItems = parsePage(html, channel);
    if (!pageItems.length) break;
    for (const item of pageItems) {
      const d = new Date(item.datetime);
      if (d >= since && d <= now && !seen.has(item.id)) {
        seen.add(item.id);
        items.push(item);
      }
    }
    const nums = pageItems.map(x => Number(String(x.id).split('/')[1])).filter(Number.isFinite);
    if (nums.length) maxIdSeen = maxIdSeen == null ? Math.max(...nums) : Math.max(maxIdSeen, ...nums);
    const oldest = pageItems.reduce((a, b) => new Date(a.datetime) < new Date(b.datetime) ? a : b);
    if (!nums.length || new Date(oldest.datetime) < since) {
      reachedOlder = true;
      break;
    }
    // P571/R262: once every post on this page is already <= what the previous run last saw,
    // every earlier page (further back in time) is guaranteed to be already-known too ??
    // stop here instead of continuing to walk the full window every single cycle.
    if (Number.isFinite(cursor) && Math.max(...nums) <= cursor) {
      reachedKnown = true;
      break;
    }
    before = Math.min(...nums);
    await new Promise(r => setTimeout(r, 150));
  }
  return { channel, pages, reachedOlder, reachedKnown, items, lastPostId: maxIdSeen };
}

const channels = [];
for (const ch of CHANNELS) {
  try {
    channels.push(await scrapeChannel(ch));
  } catch (e) {
    channels.push({ channel: ch, error: e.message, pages: 0, reachedOlder: false, items: [] });
  }
}

// P571/R262: union freshly-scraped items with the carried-forward merge pool (dedup by id,
// re-applying the since/until window) so an early-stopped scrapeChannel run does not silently
// shrink topItems/broadItems down to only what was re-fetched this cycle.
const freshItems = channels.flatMap(c => c.items);
const mergedById = new Map();
for (const it of [...previousMergePool, ...freshItems]) {
  if (!it || !it.id) continue;
  const d = new Date(it.datetime);
  if (!(d >= since && d <= now)) continue;
  mergedById.set(it.id, it); // fresh items processed after pool entries win on id collision
}
const items = [...mergedById.values()].sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
const topicCounts = {};
const tickerCounts = {};
for (const it of items) {
  for (const tag of it.tags) topicCounts[tag] = (topicCounts[tag] || 0) + 1;
  for (const ticker of it.tickers) tickerCounts[ticker] = (tickerCounts[ticker] || 0) + 1;
}
const digest = {
  generatedAt: new Date().toISOString(),
  since: since.toISOString(),
  until: now.toISOString(),
  source: 'telegram-public-mirror',
  channels: channels.map(c => ({ channel: c.channel, pages: c.pages, reachedOlder: c.reachedOlder, reachedKnown: !!c.reachedKnown, count: c.items.length, error: c.error || null, lastPostId: Number.isFinite(c.lastPostId) ? c.lastPostId : (previousLastPostId.get(c.channel) ?? null) })),
  count: items.length,
  topicCounts,
  tickerCounts,
  // topItems: score>=65, 梨꾨꼸??理쒕? 20媛? ?꾩껜 理쒕? 45媛? score ?대┝李⑥닚
  topItems: (function() {
    const candidates = items.filter(x => x.score >= 65).sort((a, b) => b.score - a.score);
    const perChannel = {};
    const out = [];
    for (const it of candidates) {
      const ch = it.channel || 'unknown';
      perChannel[ch] = (perChannel[ch] || 0) + 1;
      if (perChannel[ch] > 20) continue;
      out.push(it);
      if (out.length >= 45) break;
    }
    return out;
  })(),
  // broadItems: score>=50, 梨꾨꼸??理쒕? 120媛? ?꾩껜 理쒕? 400媛? datetime ?대┝李⑥닚 (?댁뒪?쇰뱶)
  broadItems: (function() {
    const candidates = items.filter(x => x.score >= 50).sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
    const perChannel = {};
    const out = [];
    for (const it of candidates) {
      const ch = it.channel || 'unknown';
      perChannel[ch] = (perChannel[ch] || 0) + 1;
      if (perChannel[ch] > 120) continue;
      out.push(it);
      if (out.length >= 400) break;
    }
    return out;
  })(),
  // Phase 3 [A1/B3] P598: `items` (the full merged/deduped set, ~1.04MB / 46% of this file's
  // pre-fix size) used to be included here too, even though the "previousMergePool" logic just
  // above (P571/R262) already documents "the digest we write never persists the full raw item
  // list (only capped topItems/broadItems)" ??that was the design intent, but this literal never
  // actually matched it. Confirmed via full-codebase grep that no runtime consumer reads `items`/
  // `rawItems` from the served JSON in the normal path (only a since-removed items.slice(0,80)
  // fallback in js/aio-data.js that only ever triggered if BOTH topItems and broadItems were
  // empty ??mathematically near-impossible, since broadItems' score>=50/120-per-channel/400-total
  // filter is strictly looser than topItems' score>=65/20-per-channel/45-total one, so anything
  // that qualifies for topItems always also qualifies for broadItems). `items` stays as a local
  // variable above (still needed to compute topItems/broadItems/topicCounts/tickerCounts) ??it's
  // just not re-serialized into the output file anymore.
};

const json = JSON.stringify(digest, null, 2);
if (outPath) writeFileSync(outPath, json + '\n', 'utf8');
console.log(json);
