#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

const CHANNELS = ['aetherjapanresearch', 'insidertracking', 'bornlupin'];
const DEFAULT_DAYS = 7;
const PAGE_LIMIT = Number(process.env.TG_PAGE_LIMIT || 30);
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
  const t = String(text || '').toLowerCase();
  const tags = [];
  const add = v => { if (!tags.includes(v)) tags.push(v); };
  if (/boj|bank of japan|일본은행|엔화|닛케이|국채|금리|환율|fomc|fed|cpi|ppi|pce|재건|이란|호르무즈|g7|관세|수출통제/.test(t)) add('macro');
  if (/이란|호르무즈|전쟁|휴전|핵|파키스탄|중동|제재|reconstruction|jcpoa/.test(t)) add('geo');
  if (/nvidia|엔비디아|amd|tsmc|hbm|dram|nand|mlcc|cpos|cowos|반도체|메모리|gpu|cpu|mi450|패키징/.test(t)) add('semi');
  if (/cpo|광통신|optical|laser|레이저|eml|cw laser|coherent|lumentum|aaoi|mtsi|sive|marvell|celestial/.test(t)) add('optical');
  if (/전력|data center power|sofc|bloom|oracle|transformer|grid|gw|800v|fuel cell/.test(t)) add('power');
  if (/anthropic|mythos|fable|sovereign ai|소버린 ai|export control|ai 모델|탈옥|jailbreak/.test(t)) add('ai-policy');
  if (/spacex|prime day|amazon|adobe|smci|meta|murata|삼성전기|기업|상장|ipo|시가총액|목표주가|buy|upgrade|상향/.test(t)) add('equity');
  if (/crypto|bitcoin|코인|암호화폐/.test(t)) add('crypto');
  return tags.length ? tags : ['market-note'];
}

function extractTickers(text) {
  const raw = String(text || '');
  const map = [
    ['NVDA', /nvidia|엔비디아/i], ['AMD', /\bAMD\b|Advanced Micro|MI450/i], ['META', /\bMeta\b|메타/i],
    ['TSM', /TSMC|대만반도체/i], ['MU', /\bMicron\b|마이크론|DRAM|HBM/i], ['MRVL', /Marvell|마벨/i],
    ['ALAB', /\bALAB\b|Astera/i], ['LITE', /Lumentum|루멘텀/i], ['COHR', /Coherent|코히런트/i],
    ['AAOI', /\bAAOI\b|Applied Optoelectronics|어플라이드 옵토/i], ['MTSI', /\bMTSI\b|MACOM/i],
    ['AMZN', /Amazon|아마존|Prime Day/i], ['ORCL', /Oracle|오라클/i], ['BE', /Bloom Energy|블룸에너지|SOFC/i],
    ['ADBE', /Adobe|어도비/i], ['SMCI', /\bSMCI\b|Super Micro/i], ['RKLB', /\bRKLB\b|Rocket Lab/i],
    ['6600.T', /Kioxia|키옥시아/i], ['6981.T', /Murata|무라타/i], ['005930.KS', /삼성전자/i],
    ['009150.KS', /삼성전기/i], ['000660.KS', /SK하이닉스|SK Hynix/i]
  ];
  const out = [];
  for (const [ticker, re] of map) if (re.test(raw) && !out.includes(ticker)) out.push(ticker);
  return out;
}

function scoreItem(text, tags, tickers) {
  let score = 40;
  score += Math.min(20, tickers.length * 4);
  if (tags.includes('macro') || tags.includes('geo')) score += 12;
  if (tags.includes('semi') || tags.includes('ai-policy')) score += 12;
  if (tags.includes('power') || tags.includes('optical')) score += 10;
  if (/citi|ubs|jpm|goldman|bofa|morgan|리뷰|목표주가|상향|하향|upgrade|downgrade/i.test(text)) score += 8;
  if (/\b\d+(\.\d+)?\s*(gw|억|조|bp|bps|%|\$|엔|달러)/i.test(text)) score += 5;
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
    const oldest = pageItems.reduce((a, b) => new Date(a.datetime) < new Date(b.datetime) ? a : b);
    if (!nums.length || new Date(oldest.datetime) < since) {
      reachedOlder = true;
      break;
    }
    before = Math.min(...nums);
    await new Promise(r => setTimeout(r, 150));
  }
  return { channel, pages, reachedOlder, items };
}

const channels = [];
for (const ch of CHANNELS) {
  try {
    channels.push(await scrapeChannel(ch));
  } catch (e) {
    channels.push({ channel: ch, error: e.message, pages: 0, reachedOlder: false, items: [] });
  }
}

const items = channels.flatMap(c => c.items).sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
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
  channels: channels.map(c => ({ channel: c.channel, pages: c.pages, reachedOlder: c.reachedOlder, count: c.items.length, error: c.error || null })),
  count: items.length,
  topicCounts,
  tickerCounts,
  topItems: items.filter(x => x.score >= 70).slice(0, 40),
  items,
};

const json = JSON.stringify(digest, null, 2);
if (outPath) writeFileSync(outPath, json + '\n', 'utf8');
console.log(json);
