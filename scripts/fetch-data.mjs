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

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = `${__dir}/../public-data/data.json`;

// ── 수집 심볼 (v1 핵심셋). 더 넣으려면 배열에 추가만 하면 됨 (배치 처리 자동) ──
const SYMBOLS = [
  // 미국·글로벌 지수
  '^GSPC','^IXIC','^DJI','^RUT','^VIX','^VVIX','^FTSE','^N225','^HSI',
  // 금리 (Yahoo: ^TNX=10Y, ^TYX=30Y, ^FVX=5Y, ^IRX=13주)
  '^TNX','^TYX','^FVX','^IRX',
  // 원자재·환율
  'CL=F','BZ=F','GC=F','SI=F','DX-Y.NYB','KRW=X','EURUSD=X','JPY=X',
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

// ── Yahoo v8/chart: 한 심볼의 현재가 + 전일종가 ──
async function fetchQuote(symbol) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' +
    encodeURIComponent(symbol) + '?interval=1d&range=5d';
  const j = await fetchJSON(url);
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

const round = (v, d) => (typeof v === 'number' && isFinite(v)) ? Number(v.toFixed(d)) : null;
function monthsBetween(a, b) {
  const da = new Date(a), db = new Date(b);
  return (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth());
}

async function main() {
  const t0 = Date.now();
  console.log(`[fetch-data] ${SYMBOLS.length} 심볼 + FRED + F&G 수집 시작`);

  const [quotesRaw, macro, fearGreed] = await Promise.all([
    mapLimit(SYMBOLS, 6, fetchQuote),
    fetchFred(process.env.FRED_API_KEY),
    fetchFearGreed(),
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
      elapsedMs: Date.now() - t0,
      schema: 1,
    },
    quotes,
    macro,
    fearGreed,
  };

  if (!fearGreedOk) console.warn('[fetch-data] 경고: F&G 수집 실패 (사이트는 정적 폴백 사용)');
  if (process.env.FRED_API_KEY && !fredOk) console.warn('[fetch-data] 경고: FRED 키 있으나 매크로 0건 — 키/한도 확인');

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(data, null, 1));
  console.log(`[fetch-data] 완료: quotes ${quotes.length}/${SYMBOLS.length} (실패 ${failed.length}: ${failed.join(',') || '-'}), macro keys ${Object.keys(macro).length}, F&G ${fearGreed.score ?? 'fail'}, ${data.meta.elapsedMs}ms`);

  // 핵심 심볼이 절반 미만이면 비정상 — 비0 종료로 워크플로가 알림
  if (quotes.length < SYMBOLS.length * 0.5) {
    console.error('[fetch-data] 경고: 절반 이상 실패 — 기존 data.json 유지 권장');
    process.exit(1);
  }
}

main().catch(e => { console.error('[fetch-data] 치명적 오류:', e); process.exit(1); });
