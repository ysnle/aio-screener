#!/usr/bin/env node
import { writeFileSync } from 'node:fs';

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
  // 매크로: Fed 발언·금리·환율·이란·관세 + 한국 정책
  if (/boj|bank of japan|일본은행|엔화|닛케이|국채|금리|환율|fomc|fed|연준|cpi|ppi|pce|이란|호르무즈|g7|관세|수출통제|기준금리|통화정책|메가프로젝트|대도약|국민보고회/.test(t)) add('macro');
  // 지정학: 분쟁·제재·핵·지역 갈등
  if (/이란|호르무즈|전쟁|휴전|핵|파키스탄|중동|제재|헤즈볼라|이스라엘|레바논|하마스|가자|베네수엘라|우크라이나|reconstruction|jcpoa/.test(t)) add('geo');
  // 반도체: 메모리·AI 칩·장비·소재·LTA
  if (/nvidia|엔비디아|amd|tsmc|hbm|dram|nand|mlcc|cpos|cowos|반도체|메모리|gpu|cpu|mi450|패키징|lta|장기계약|hbm4|hbm4e|socamm|wf6|etchant/.test(t)) add('semi');
  // 광통신: CPO/NPO·레이저·광인터커넥트
  if (/cpo|광통신|optical|laser|레이저|eml|cw laser|coherent|lumentum|aaoi|mtsi|sive|marvell|celestial/.test(t)) add('optical');
  // 전력·인프라: 데이터센터 전력·그리드·800V
  if (/전력|data center power|sofc|bloom|oracle|transformer|grid|gw|800v|fuel cell|변압기|송전|hvdc/.test(t)) add('power');
  // AI 정책: 모델 출시·수출통제·LLM 거버넌스·OpenAI
  if (/anthropic|mythos|fable|sovereign ai|소버린 ai|export control|ai 모델|탈옥|jailbreak|openai|gpt-4|gpt-5|gpt-6|chatgpt|gemini|llama|claude|ipo.*ai|ai.*ipo/.test(t)) add('ai-policy');
  // 한국 시장: KOSPI·KOSDAQ·사이드카·서학개미·외국인수급
  if (/코스피|코스닥|kospi|kosdaq|사이드카|서킷브레이커|서학개미|외국인.*순매수|한국예탁결제원|키움|미래에셋|한국장/.test(t)) add('kr-market');
  // 주식·애널리스트: 목표주가·상향·IPO·시총
  if (/spacex|prime day|amazon|adobe|smci|meta|murata|삼성전기|기업|상장|ipo|시가총액|목표주가|buy|upgrade|상향|mlcc.*etf|etf.*mlcc/.test(t)) add('equity');
  // 크립토
  if (/crypto|bitcoin|코인|암호화폐/.test(t)) add('crypto');
  return tags.length ? tags : ['market-note'];
}

function extractTickers(text) {
  const raw = String(text || '');
  const map = [
    // 글로벌 빅캡
    ['NVDA', /nvidia|엔비디아/i], ['AMD', /\bAMD\b|Advanced Micro|MI450/i],
    ['AAPL', /\bApple\b|애플|AAPL/i], ['MSFT', /\bMicrosoft\b|마이크로소프트|MSFT/i],
    ['GOOG', /\bGoogle\b|구글|Google Finance/i], ['META', /\bMeta\b|메타/i],
    ['AVGO', /\bBroadcom\b|브로드컴|AVGO/i], ['AMZN', /Amazon|아마존|Prime Day/i],
    // 메모리·반도체
    ['MU', /\bMicron\b|마이크론|DRAM|HBM/i], ['TSM', /TSMC|대만반도체/i],
    ['SNDK', /\bSNDK\b|SanDisk|샌디스크/i], ['MRVL', /Marvell|마벨/i],
    ['ALAB', /\bALAB\b|Astera/i],
    // 광통신
    ['LITE', /Lumentum|루멘텀/i], ['COHR', /Coherent|코히런트/i],
    ['AAOI', /\bAAOI\b|Applied Optoelectronics|어플라이드 옵토/i], ['MTSI', /\bMTSI\b|MACOM/i],
    // 인프라·전력
    ['ORCL', /Oracle|오라클/i], ['BE', /Bloom Energy|블룸에너지|SOFC/i],
    ['ADBE', /Adobe|어도비/i], ['SMCI', /\bSMCI\b|Super Micro/i], ['RKLB', /\bRKLB\b|Rocket Lab/i],
    // 일본
    ['6600.T', /Kioxia|키옥시아/i], ['6981.T', /Murata|무라타/i],
    // 한국
    ['005930.KS', /삼성전자/i], ['009150.KS', /삼성전기/i], ['000660.KS', /SK하이닉스|SK Hynix/i],
  ];
  const out = [];
  for (const [ticker, re] of map) if (re.test(raw) && !out.includes(ticker)) out.push(ticker);
  return out;
}

// 채널 공지/일정/단순 안내 여부 감지 (저점수 패널티용)
function isLowSignalPost(text) {
  const t = String(text || '').toLowerCase();
  // 트럼프 일정, 채널 공지, 구호작전 등 시장 무관 행정 포스트
  if (/대통령.*일정|executive time|트럼프.*오후.*한국시간|인타운\s*풀|오벌\s*오피스/.test(t)) return true;
  if (/글로벌 뉴스 브리핑\s*컨텐츠도 시작|구독자 이탈 방지|메세지 보내는거 최소화/.test(t)) return true;
  if (/구호 작전|지진.*피해.*구호|humanitarian/.test(t) && !/주식|반도체|금리/.test(t)) return true;
  return false;
}

function scoreItem(text, tags, tickers) {
  if (isLowSignalPost(text)) return 20; // 낮은 점수로 고정
  let score = 35; // base 낮춤 (기존 40 → 35)
  // 티커 수: 최대 +20
  score += Math.min(20, tickers.length * 4);
  // 태그 보너스 (중복 가능, 최대 합산)
  if (tags.includes('macro')) score += 12;
  if (tags.includes('geo')) score += 10;
  if (tags.includes('semi')) score += 12;
  if (tags.includes('ai-policy')) score += 10;
  if (tags.includes('power') || tags.includes('optical')) score += 8;
  if (tags.includes('kr-market')) score += 8;
  // 애널리스트 리포트 / 목표주가 상향
  if (/citi|ubs|jpm|goldman|bofa|morgan stanley|메리츠|키움|미래에셋|대신|한투|목표주가|상향|하향|upgrade|downgrade/i.test(text)) score += 10;
  // 정량 데이터 (구체적 수치 포함)
  if (/\b\d+(\.\d+)?\s*(gw|억|조|bp|bps|%|\$|엔|달러|위안)/i.test(text)) score += 5;
  // 한국 AI 메가프로젝트 / 정책 이벤트
  if (/메가프로젝트|대도약|국민보고회|초대형\s*투자/.test(text)) score += 8;
  // 서킷브레이커·사이드카 = 시장 사건
  if (/사이드카|서킷\s*브레이커|circuit\s*breaker/.test(text)) score += 8;
  // 긴 분석 포스트 보너스 (500자+)
  if (text.length > 500) score += 5;
  // 단순 일정/안내 유사 단어 페널티 (isLowSignalPost에서 걸리지 않은 경우)
  if (/대통령.*일정|trump.*schedule|행사.*계획/.test(text)) score -= 10;
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
  // topItems: score>=65, 채널당 최대 20개, 전체 최대 45개, score 내림차순
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
  // broadItems: score>=50, 채널당 최대 120개, 전체 최대 400개, datetime 내림차순 (뉴스피드)
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
  items,
};

const json = JSON.stringify(digest, null, 2);
if (outPath) writeFileSync(outPath, json + '\n', 'utf8');
console.log(json);
