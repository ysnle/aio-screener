// ─────────────────────────────────────────────────────────────────────────
// AIO Screener — 서버측 데이터 수집기 (GitHub Actions cron에서 실행)
//
// 왜 이 파일이 존재하나:
//   브라우저에서 직접 Yahoo/CNN/FRED를 부르면 CORS로 막혀 제3자 프록시를
//   거쳐야 하고(자주 죽음), API 키는 공개 정적 사이트에 못 넣는다(노출).
//   → 이 스크립트가 "서버에서" 데이터를 받아 public-data/data.json으로 떨군다.
//   정적 사이트는 같은 출처의 data.json만 읽으면 되므로 CORS/프록시/키 문제가 0.
//
// 출력: public-data/data.json  (applyLiveQuotes()가 그대로 먹을 수 있는 형식)
// 실행: node scripts/fetch-data.mjs   (Node 20+ 내장 fetch 사용)
// 환경변수(선택): FRED_API_KEY  (없으면 macro 블록은 빈 값 — 사이트는 정적 폴백)
// ─────────────────────────────────────────────────────────────────────────

import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = `${__dir}/../public-data/data.json`;
const HIST = `${__dir}/../public-data/history.json`;

// ── 수집 심볼 (v1 핵심셋). 더 넣으려면 배열에 추가만 하면 됨 (배치 처리 자동) ──
const SYMBOLS = [
  // 미국·글로벌 지수
  '^GSPC','^IXIC','^DJI','^RUT','^VIX','^VVIX','^FTSE','^N225','^HSI',
  // 금리 (Yahoo: ^TNX=10Y, ^TYX=30Y, ^FVX=5Y, ^IRX=13주)
  '^TNX','^TYX','^FVX','^IRX',
  // 원자재·환율 (v50.40: GBPUSD/CNY/AUDUSD 추가 — fxbond 페이지 "—" unavailable 해소, 클라이언트 LIVE_SYMBOLS와 정합)
  'CL=F','BZ=F','GC=F','SI=F','DX-Y.NYB','KRW=X','EURUSD=X','JPY=X','GBPUSD=X','CNY=X','AUDUSD=X',
  // 신용·핵심 ETF (breadth/리스크 입력)
  'HYG','LQD','TLT','SPY','QQQ','IWM','RSP','DIA','SMH','XLK','XLF','XLE','XLV','XLI','XLY','XLP','XLU','XLRE','XLB','XLC',
  // 한국 지수
  '^KS11','^KQ11',
  // 크립토
  'BTC-USD','ETH-USD',
  // 미국 메가캡 (ticker/fundamental/technical 기본)
  'AAPL','MSFT','NVDA','GOOGL','AMZN','META','TSLA','AVGO','AMD','NFLX','JPM','BRK-B','LLY','UNH','XOM','COST','WMT','PLTR','MU','CRWD','MSTR','COIN',
  // 한국 대표주
  '005930.KS','000660.KS','005380.KS','035420.KS','373220.KS','105560.KS','207940.KS',
];

// FRED 시리즈 (YoY 또는 레벨). PAYEMS는 MoM 차이(천명) = NFP.
const FRED_SERIES = {
  cpi:        { id: 'CPIAUCSL', kind: 'yoy' },
  coreCpi:    { id: 'CPILFESL', kind: 'yoy' },
  pce:        { id: 'PCEPI',    kind: 'yoy' },
  corePce:    { id: 'PCEPILFE', kind: 'yoy' },
  fedRate:    { id: 'FEDFUNDS', kind: 'level' },
  unemployment:{ id: 'UNRATE',  kind: 'level' },
  nfp:        { id: 'PAYEMS',   kind: 'mom_diff' }, // 천명 단위 (e.g. 172)
};

const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; AIO-Screener-bot/1.0)' };

async function fetchJSON(url, opts = {}, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const ctrl = new AbortController();
      const to = setTimeout(() => ctrl.abort(), 12000);
      const r = await fetch(url, { headers: UA, signal: ctrl.signal, ...opts });
      clearTimeout(to);
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } catch (e) {
      lastErr = e;
      await new Promise(res => setTimeout(res, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

// v50.24/WO-1: Yahoo는 두 호스트(query1/query2)를 운영하고 차단/레이트리밋이 호스트마다 다르게
// 걸리는 경우가 잦다. GitHub Actions 러너 IP가 한 호스트에서 막혀도 다른 호스트로 폴백 → 전량 실패
// (= data.json 미갱신)를 줄인다. 2 호스트 × 2 시도 = 최대 4회. 그래도 다 실패하면 throw(해당 심볼만).
const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

// ── Yahoo v8/chart: 한 심볼의 현재가 + 전일종가 (호스트 폴백 내성) ──
async function fetchQuote(symbol) {
  let lastErr;
  for (const host of YAHOO_HOSTS) {
    try {
      const url = host + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=5d';
      const j = await fetchJSON(url, {}, 2);
      const res = j?.chart?.result?.[0];
      const m = res?.meta;
      if (!m || typeof m.regularMarketPrice !== 'number') throw new Error('no meta');
      const price = m.regularMarketPrice;
      const prev = (typeof m.chartPreviousClose === 'number' && m.chartPreviousClose > 0)
        ? m.chartPreviousClose
        : (typeof m.previousClose === 'number' ? m.previousClose : null);
      const pct = (prev && prev > 0) ? ((price - prev) / prev) * 100 : null;
      return {
        symbol,
        regularMarketPrice: price,
        regularMarketChangePercent: pct,
        regularMarketPreviousClose: prev,
        chartPreviousClose: prev,
        _source: 'live:yahoo-gh',
      };
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// 동시성 제한 배치 실행
async function mapLimit(items, limit, fn) {
  const out = [];
  let idx = 0;
  const workers = Array.from({ length: limit }, async () => {
    while (idx < items.length) {
      const my = idx++;
      out[my] = await fn(items[my]).catch(e => ({ __error: true, item: items[my], msg: String(e && e.message || e) }));
    }
  });
  await Promise.all(workers);
  return out;
}

// ── FRED ──
async function fetchFred(key) {
  if (!key) return { _source: 'fred:no-key' };
  const out = { _source: 'fred' };
  for (const [field, spec] of Object.entries(FRED_SERIES)) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${spec.id}` +
        `&api_key=${key}&file_type=json&sort_order=desc&limit=14`;
      const j = await fetchJSON(url);
      const obs = (j.observations || []).filter(o => o.value !== '.').map(o => ({ d: o.date, v: parseFloat(o.value) }));
      if (!obs.length) continue;
      if (spec.kind === 'level') {
        out[field] = round(obs[0].v, 3);
      } else if (spec.kind === 'yoy') {
        const cur = obs[0];
        const yoy = obs.find(o => monthsBetween(o.d, cur.d) >= 12) || obs[obs.length - 1];
        if (yoy && yoy.v) out[field] = round((cur.v / yoy.v - 1) * 100, 1);
      } else if (spec.kind === 'mom_diff') {
        if (obs.length >= 2) out[field] = Math.round(obs[0].v - obs[1].v); // 천명
      }
      out['_asOf_' + field] = obs[0].d;
    } catch (e) { /* 한 시리즈 실패는 무시 */ }
  }
  return out;
}

// ── CNN Fear & Greed (봇차단 우회용 브라우저 유사 헤더) ──
async function fetchFearGreed() {
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://www.cnn.com/markets/fear-and-greed',
    'Origin': 'https://www.cnn.com',
    'Accept-Language': 'en-US,en;q=0.9',
  };
  try {
    const j = await fetchJSON('https://production.dataviz.cnn.io/index/fearandgreed/graphdata', { headers });
    const fg = j?.fear_and_greed;
    if (fg && typeof fg.score === 'number') {
      return { score: Math.round(fg.score), rating: fg.rating || null, _source: 'cnn', asOf: fg.timestamp || null };
    }
  } catch (e) {}
  return { _source: 'cnn:fail' };
}

// ── WO-6 (ops): 서버측 뉴스 백스톱 (브라우저 CORS 프록시 전멸 대비) ──
// 왜: 클라이언트 뉴스는 제3자 프록시(allorigins 등, 자주 죽음)에 의존. 서버(Actions)는 CORS가
//     없으므로 안정적으로 RSS를 받아 data.json.news로 떨군다. 클라이언트는 자체 뉴스가 비었을
//     때만 이걸 폴백으로 렌더(작동 중이면 손대지 않음 — additive). Google News RSS는 서버 fetch에
//     안정적이고 <source> 태그로 실제 매체명을 준다.
const NEWS_FEEDS = [
  { url: 'https://news.google.com/rss/search?q=stock%20market%20OR%20S%26P%20500%20OR%20Federal%20Reserve%20when:2d&hl=en-US&gl=US&ceid=US:en', source: 'Google News' },
  { url: 'https://news.google.com/rss/search?q=nvidia%20OR%20semiconductor%20OR%20AI%20stocks%20OR%20earnings%20when:2d&hl=en-US&gl=US&ceid=US:en', source: 'Google News' },
];
function _decodeNewsEntities(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
async function fetchNews() {
  const items = [];
  for (const feed of NEWS_FEEDS) {
    try {
      const xml = await (async () => {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 12000);
        const r = await fetch(feed.url, { headers: UA, signal: ctrl.signal });
        clearTimeout(to);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return await r.text();
      })();
      const blocks = xml.split(/<item>/i).slice(1);
      for (const b of blocks.slice(0, 20)) {
        const title = _decodeNewsEntities((b.match(/<title>([\s\S]*?)<\/title>/i) || [])[1]);
        const link = _decodeNewsEntities((b.match(/<link>([\s\S]*?)<\/link>/i) || [])[1]);
        const pub = _decodeNewsEntities((b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i) || [])[1]);
        const srcTag = _decodeNewsEntities((b.match(/<source[^>]*>([\s\S]*?)<\/source>/i) || [])[1]);
        if (!title || !link) continue;
        const t = pub ? new Date(pub).getTime() : 0;
        items.push({ title: title.slice(0, 200), link, source: srcTag || feed.source, pubDate: pub || null, ts: isFinite(t) ? t : 0 });
      }
    } catch (e) { /* 피드별 실패 무시 */ }
  }
  // 중복(제목) 제거 + 최신순 + 25건 cap
  items.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = it.title.toLowerCase().slice(0, 60);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ title: it.title, link: it.link, source: it.source, pubDate: it.pubDate });
    if (out.length >= 25) break;
  }
  return out;
}

const round = (v, d) => (typeof v === 'number' && isFinite(v)) ? Number(v.toFixed(d)) : null;
function monthsBetween(a, b) {
  const da = new Date(a), db = new Date(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

// ── v50.52 B4: Yahoo v8/chart 다일 종가 히스토리 (백필용) ──
// 왜: fetchQuote는 range=5d + meta(현재가)만 읽어 history가 하루 1건씩만 쌓임(20~60일 대기).
//     range=6mo로 일별 종가 배열을 1회 받아 history.json을 즉시 시드 → 차트 대기 제거.
async function fetchHistory(symbol, range = '6mo') {
  for (const host of YAHOO_HOSTS) {
    try {
      const url = host + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=' + range;
      const j = await fetchJSON(url, {}, 2);
      const res = j?.chart?.result?.[0];
      const ts = res?.timestamp;
      const closes = res?.indicators?.quote?.[0]?.close;
      if (!Array.isArray(ts) || !Array.isArray(closes)) throw new Error('no history arrays');
      const out = [];
      for (let i = 0; i < ts.length; i++) {
        const c = closes[i];
        if (typeof c !== 'number' || !isFinite(c)) continue;
        out.push({ date: new Date(ts[i] * 1000).toISOString().slice(0, 10), close: round(c, 2) });
      }
      return out;
    } catch (e) { /* 호스트 폴백 */ }
  }
  return [];
}

// history.json 레코드 필드 ↔ Yahoo 심볼 매핑 (백필 대상). F&G/IV는 과거 무료 소스 없어 제외(해당 일자 null).
const HIST_SYMBOLS = {
  '^GSPC': 'spx', '^IXIC': 'nasdaq', '^DJI': 'dow', '^RUT': 'rut',
  '^VIX': 'vix', '^VVIX': 'vvix', '^TNX': 'tnx',
  'DX-Y.NYB': 'dxy', 'CL=F': 'wti', 'GC=F': 'gold',
  '^KS11': 'kospi', '^KQ11': 'kosdaq', 'BTC-USD': 'btc',
};
const HIST_FIELDS = ['spx','nasdaq','dow','rut','vix','vvix','tnx','dxy','wti','gold','kospi','kosdaq','btc','fg'];

// v50.52 B4: 6개월 일별 종가로 history.json 과거 일자 시드(멱등 — 이미 있는 date 보존).
async function backfillHistory(hist) {
  const have = new Set(hist.map(h => h && h.date));
  const byDate = {};
  const syms = Object.keys(HIST_SYMBOLS);
  const results = await mapLimit(syms, 4, async (sym) => ({ sym, rows: await fetchHistory(sym, '6mo') }));
  for (const r of results) {
    if (!r || r.__error || !Array.isArray(r.rows)) continue;
    const field = HIST_SYMBOLS[r.sym];
    for (const row of r.rows) {
      if (!byDate[row.date]) byDate[row.date] = { date: row.date };
      byDate[row.date][field] = row.close;
    }
  }
  let added = 0;
  for (const date of Object.keys(byDate)) {
    if (have.has(date)) continue;                 // 기존(라이브) 레코드 보존
    const base = { date };
    for (const f of HIST_FIELDS) base[f] = (byDate[date][f] != null ? byDate[date][f] : null);
    hist.push(base);
    added++;
  }
  hist.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { hist, added };
}

// ── WO-7 (ops): 일별 히스토리 축적 (public-data/history.json) ──
// 왜: data.json은 매 실행 덮어쓰기라 과거가 안 남는다. 52주 VIX(IV Rank)·breadth 사이클·F&G 추이
//     차트가 하드코딩 시드 배열에 의존하는 근본 원인. 하루 1건(같은 날은 최신값으로 upsert =
//     마지막 실행이 종가에 가까움)씩 핵심 지표를 append → 시간이 지나면 사이트가 자체 실데이터 사용.
// 핵심 심볼(SPX/VIX) 없으면 스킵(널 레코드 오염 방지). ~420일(14개월) cap.
async function updateHistory(data) {
  try {
    const bySym = {};
    for (const q of data.quotes) bySym[q.symbol] = q.regularMarketPrice;
    const pick = (s) => (typeof bySym[s] === 'number' && isFinite(bySym[s])) ? round(bySym[s], 2) : null;
    if (pick('^GSPC') === null && pick('^VIX') === null) {
      console.warn('[fetch-data] history: 핵심 심볼(SPX/VIX) 없음 — 히스토리 갱신 스킵');
      return null;
    }
    const today = new Date().toISOString().slice(0, 10); // UTC 일자
    const rec = {
      date: today,
      spx: pick('^GSPC'), nasdaq: pick('^IXIC'), dow: pick('^DJI'), rut: pick('^RUT'),
      vix: pick('^VIX'), vvix: pick('^VVIX'), tnx: pick('^TNX'),
      dxy: pick('DX-Y.NYB'), wti: pick('CL=F'), gold: pick('GC=F'),
      kospi: pick('^KS11'), kosdaq: pick('^KQ11'), btc: pick('BTC-USD'),
      fg: (data.fearGreed && typeof data.fearGreed.score === 'number') ? data.fearGreed.score : null,
    };
    let hist = [];
    try { const raw = JSON.parse(await readFile(HIST, 'utf8')); if (Array.isArray(raw)) hist = raw; } catch { /* 최초 실행 */ }
    // v50.52 B4: 최초/얇을 때(또는 BACKFILL=1) 6개월 일별 종가로 과거 시드 — 차트 대기 제거(멱등).
    let backfilled = 0;
    if (hist.length < 60 || process.env.BACKFILL === '1') {
      try { const bf = await backfillHistory(hist); hist = bf.hist; backfilled = bf.added; } catch (e) { console.warn('[fetch-data] backfill 실패(무시):', e && e.message || e); }
    }
    const idx = hist.findIndex(h => h && h.date === today);
    if (idx >= 0) hist[idx] = rec; else hist.push(rec);          // 같은 날 = upsert(종가 수렴)
    hist.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (hist.length > 420) hist = hist.slice(hist.length - 420);  // 14개월 cap
    await writeFile(HIST, JSON.stringify(hist));
    return { days: hist.length, today, upsert: idx >= 0 ? 'update' : 'append', backfilled };
  } catch (e) {
    console.warn('[fetch-data] history 갱신 실패(무시):', e && e.message || e);
    return null;
  }
}

// ── v50.52 Track1: 스크리너 팩터 enrichment (정적 SCREENER_DB → 라이브 팩터 데이터) ──
// 왜: SCREENER_DB(js/aio-data.js)는 시총/RSI/시그널이 하드코딩(2026-04 기준)이라 stale.
//     서버에서 유니버스 1년 일별 종가를 받아 모멘텀/저변동/추세/RSI 팩터를 계산해 screener.json으로
//     떨군다(일 1회 자가 스로틀). 클라가 병합 → 멀티팩터 랭킹의 입력. value/quality(P/E·마진)는
//     무료 대규모 소스 없음 → 가격 파생 4팩터부터(정직). 심볼은 SCREENER_DB에서 런타임 추출(단일 출처).
const SCREENER_OUT = `${__dir}/../public-data/screener.json`;

async function getScreenerSymbols() {
  try {
    const src = await readFile(`${__dir}/../js/aio-data.js`, 'utf8');
    const a = src.indexOf('var SCREENER_DB');
    if (a < 0) return [];
    const end = src.indexOf('\n];', a);                 // SCREENER_DB 배열 종료
    const block = src.slice(a, end > a ? end : a + 200000);
    const syms = [];
    const re = /\bsym:\s*'([A-Z0-9.\-]+)'/g;
    let m; while ((m = re.exec(block)) !== null) syms.push(m[1]);
    return [...new Set(syms)];
  } catch (e) { console.warn('[fetch-data] screener 심볼 추출 실패:', e && e.message); return []; }
}
// Yahoo 심볼 정규화: 클래스주 BRK.B→BRK-B. KR(.KS/.KQ)·일반은 보존.
const _yhSym = (s) => s.replace(/^([A-Z]+)\.([A-Z])$/, '$1-$2');

const _mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
function _retPct(closes, n) {
  if (closes.length <= n) return null;
  const a = closes[closes.length - 1 - n], b = closes[closes.length - 1];
  return (a > 0) ? round((b / a - 1) * 100, 2) : null;
}
function _annVol(closes, n) {
  if (closes.length < n + 1) return null;
  const seg = closes.slice(-(n + 1));
  const rets = [];
  for (let i = 1; i < seg.length; i++) if (seg[i - 1] > 0) rets.push(seg[i] / seg[i - 1] - 1);
  const mu = _mean(rets);
  if (mu == null || rets.length < 2) return null;
  const v = rets.reduce((s, r) => s + (r - mu) * (r - mu), 0) / (rets.length - 1);
  return round(Math.sqrt(v) * Math.sqrt(252) * 100, 2);   // 연율화 %
}
function _rsi14(closes) {
  if (closes.length < 15) return null;
  const seg = closes.slice(-15);
  let g = 0, l = 0;
  for (let i = 1; i < seg.length; i++) { const d = seg[i] - seg[i - 1]; if (d >= 0) g += d; else l -= d; }
  g /= 14; l /= 14;
  if (l === 0) return 100;
  const rs = g / l;
  return round(100 - 100 / (1 + rs), 1);
}
function closesToFactors(closes) {
  if (!Array.isArray(closes) || closes.length < 30) return null;
  const price = closes[closes.length - 1];
  const sma50 = closes.length >= 50 ? _mean(closes.slice(-50)) : null;
  const sma200 = closes.length >= 200 ? _mean(closes.slice(-200)) : null;
  return {
    price: round(price, 2),
    ret1m: _retPct(closes, 21), ret3m: _retPct(closes, 63), ret6m: _retPct(closes, 126),
    vol: _annVol(closes, 60), rsi: _rsi14(closes),
    pctSma50: (sma50 && sma50 > 0) ? round((price / sma50 - 1) * 100, 2) : null,
    pctSma200: (sma200 && sma200 > 0) ? round((price / sma200 - 1) * 100, 2) : null,
  };
}

async function enrichScreener() {
  // 자가 스로틀: screener.json이 20시간 내면 스킵(일 1회). BACKFILL/SCREENER_ENRICH=1로 강제.
  if (process.env.SCREENER_ENRICH !== '1' && process.env.BACKFILL !== '1') {
    try {
      const prev = JSON.parse(await readFile(SCREENER_OUT, 'utf8'));
      if (prev && prev.asOf && (Date.now() - new Date(prev.asOf).getTime()) < 20 * 3600 * 1000) {
        return { skipped: true, count: Object.keys(prev.data || {}).length };
      }
    } catch { /* 최초 실행 */ }
  }
  const syms = await getScreenerSymbols();
  if (!syms.length) return { skipped: true, count: 0, reason: 'no-symbols' };
  const results = await mapLimit(syms, 5, async (sym) => {
    const rows = await fetchHistory(_yhSym(sym), '1y');
    return { sym, closes: (rows || []).map(r => r.close) };
  });
  const data = {};
  let ok = 0;
  for (const r of results) {
    if (!r || r.__error || !r.closes) continue;
    const f = closesToFactors(r.closes);
    if (f) { data[r.sym] = f; ok++; }
  }
  const payload = { asOf: new Date().toISOString(), source: 'github-actions:yahoo-1y', universe: syms.length, ok, data };
  await writeFile(SCREENER_OUT, JSON.stringify(payload));
  return { count: ok, universe: syms.length, asOf: payload.asOf };
}

// v50.48/Phase 4: 선택적 서버 LLM 시장 분석문 생성 (운영자 ANTHROPIC_API_KEY Secret 있을 때만).
//   raw fetch 사용 — Action에 anthropic SDK 의존성 미추가. best-effort: 실패해도 data.json은 정상(클라가 템플릿 합성으로 폴백).
//   Haiku 4.5(최저가). 수집한 시세/매크로/F&G/뉴스 헤드라인으로 간결 프롬프트 → 4~5줄 한국어 분석.
async function genMarketAnalysis(data) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null; // 키 없으면 스킵 — 클라이언트 템플릿이 처리
  try {
    const q = {};
    (data.quotes || []).forEach(x => { if (x && x.symbol) q[x.symbol] = x.price; });
    const heads = (data.news || []).slice(0, 8).map(n => '- ' + (n.title || '')).join('\n');
    const ctx = [
      `SPX ${q['^GSPC'] ?? '—'} VIX ${q['^VIX'] ?? '—'} 10Y ${q['^TNX'] ?? '—'} DXY ${q['DX-Y.NYB'] ?? '—'} WTI ${q['CL=F'] ?? '—'} Gold ${q['GC=F'] ?? '—'} KOSPI ${q['^KS11'] ?? '—'}`,
      `F&G ${data.fearGreed?.score ?? '—'}`,
      `CPI ${data.macro?.cpi ?? '—'} FedRate ${data.macro?.fedRate ?? '—'} NFP ${data.macro?.nfp ?? '—'}`,
      `최근 뉴스 헤드라인:\n${heads || '없음'}`,
    ].join('\n');
    const prompt = `다음 실시간 시장 데이터로 "현재 시장 분석"을 한국어 4~5줄로 작성하라. 객관적·간결·투자 조언 단정 금지. 수치는 위 데이터만 인용(추측 금지). 형식: 한 줄 요약 + ①변동성/심리 ②거시/금리 ③주도 뉴스/리스크.\n\n${ctx}`;
    // 모델 정책: AI 채팅과 동일 — Haiku 기본, "필요할 때"만 Sonnet 승격(Opus 미사용). 승격 조건:
    //   VIX 고변동(≥25) · 지정학/위기 뉴스 헤드라인 · 강제(LLM_MARKET_ANALYSIS_MODEL=sonnet). 그 외 Haiku(저비용).
    const vix = Number(q['^VIX']);
    const crisisNews = /\b(war|conflict|crash|crisis|sanction|invasion|military|선전포고|전쟁|급락|위기|폭락|제재)\b/i.test(heads);
    const force = (process.env.LLM_MARKET_ANALYSIS_MODEL || '').toLowerCase() === 'sonnet';
    const escalate = force || (isFinite(vix) && vix >= 25) || crisisNews;
    const model = escalate ? 'claude-sonnet-4-6' : 'claude-haiku-4-5';
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 20000);
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 500, messages: [{ role: 'user', content: prompt }] }),
      signal: ac.signal,
    });
    clearTimeout(to);
    if (!r.ok) { console.warn(`[fetch-data] LLM 분석 생성 실패 HTTP ${r.status} (템플릿 폴백)`); return null; }
    const j = await r.json();
    const text = (j.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    if (!text) return null;
    const oneLine = text.split('\n').map(s => s.trim()).filter(Boolean)[0] || text.slice(0, 120);
    console.log(`[fetch-data] LLM 분석 생성: ${model}${escalate ? ' (승격: VIX/위기뉴스)' : ' (기본)'}`);
    return { full: text, oneLine, generatedAt: new Date().toISOString(), model };
  } catch (e) { console.warn('[fetch-data] LLM 분석 생성 예외(템플릿 폴백):', e && e.message); return null; }
}

async function main() {
  const t0 = Date.now();
  console.log(`[fetch-data] ${SYMBOLS.length} 심볼 + FRED + F&G 수집 시작`);

  const [quotesRaw, macro, fearGreed, news] = await Promise.all([
    mapLimit(SYMBOLS, 6, fetchQuote),
    fetchFred(process.env.FRED_API_KEY),
    fetchFearGreed(),
    fetchNews(),
  ]);

  const quotes = quotesRaw.filter(q => q && !q.__error);
  const failed = quotesRaw.filter(q => q && q.__error).map(q => q.item);

  // v50.24/WO-1: F&G·FRED 실패를 meta에 노출(이전엔 조용히 통과). 사이트 나이 배지/감사가 surfacing.
  const macroKeys = Object.keys(macro).filter(k => k[0] !== '_');
  const fearGreedOk = typeof fearGreed.score === 'number' && isFinite(fearGreed.score);
  const fredOk = !!process.env.FRED_API_KEY && macroKeys.length > 0;

  const data = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'github-actions',
      symbolsOk: quotes.length,
      symbolsFail: failed.length,
      failedSymbols: failed,
      fearGreedOk,
      fredOk,
      macroKeyCount: macroKeys.length,
      newsOk: Array.isArray(news) && news.length > 0,
      newsCount: Array.isArray(news) ? news.length : 0,
      elapsedMs: Date.now() - t0,
      schema: 1,
    },
    quotes,
    macro,
    fearGreed,
    news,
  };

  // v50.48/Phase 4: 선택적 서버 LLM 분석문 (키 있을 때만; 실패해도 data.json 정상 — 클라 템플릿 폴백)
  const marketAnalysis = await genMarketAnalysis(data);
  if (marketAnalysis) { data.marketAnalysis = marketAnalysis; data.meta.marketAnalysisOk = true; }
  else { data.meta.marketAnalysisOk = false; }

  if (!fearGreedOk) console.warn('[fetch-data] 경고: F&G 수집 실패 (사이트는 정적 폴백 사용)');
  if (process.env.FRED_API_KEY && !fredOk) console.warn('[fetch-data] 경고: FRED 키 있으나 매크로 0건 — 키/한도 확인');

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data, null, 1));
  // WO-7 (ops): 일별 히스토리 누적 (충분한 데이터일 때만 — 아래 <50% 가드와 별개로 핵심 심볼 존재 시)
  const histInfo = await updateHistory(data);
  // v50.52 Track1: 스크리너 팩터 enrichment (일 1회 자가 스로틀 — screener.json)
  let scrInfo = null;
  try { scrInfo = await enrichScreener(); } catch (e) { console.warn('[fetch-data] screener enrich 실패(무시):', e && e.message || e); }
  console.log(`[fetch-data] 완료: quotes ${quotes.length}/${SYMBOLS.length} (실패 ${failed.length}: ${failed.join(',') || '-'}), macro keys ${Object.keys(macro).length}, F&G ${fearGreed.score ?? 'fail'}, news ${data.meta.newsCount}, history ${histInfo ? histInfo.days + 'd(' + histInfo.upsert + (histInfo.backfilled ? ',+' + histInfo.backfilled + 'bf' : '') + ')' : 'skip'}, screener ${scrInfo ? (scrInfo.skipped ? 'skip(' + scrInfo.count + ')' : scrInfo.count + '/' + scrInfo.universe) : 'n/a'}, ${data.meta.elapsedMs}ms`);

  // 핵심 심볼이 절반 미만이면 비정상 — 비0 종료로 워크플로가 알림
  if (quotes.length < SYMBOLS.length * 0.5) {
    console.error('[fetch-data] 경고: 절반 이상 실패 — 기존 data.json 유지 권장');
    process.exit(1);
  }
}

main().catch(e => { console.error('[fetch-data] 치명적 오류:', e); process.exit(1); });
