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
import { runBacktest as runTradingScoreBacktest } from './backtest-trading-score.mjs';
import { publishMarketSnapshot } from './build-market-snapshot.mjs';
import { writeOperationsStatus } from './build-operations-status.mjs';
import { writeReconciliationStatus } from './build-reconciliation-status.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = `${__dir}/../public-data/data.json`;
const HIST = `${__dir}/../public-data/history.json`;
const SEC_FUNDAMENTALS_OUT = `${__dir}/../public-data/sec-fundamentals.json`;

// ── 수집 심볼 (v1 핵심셋). 더 넣으려면 배열에 추가만 하면 됨 (배치 처리 자동) ──
const SYMBOLS = [
  // 미국·글로벌 지수
  '^GSPC','^IXIC','^DJI','^RUT','^VIX','^VIX3M','^VVIX','^FTSE','^N225','^HSI',
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
// v51.97/Phase 2 [B2]: housingStarts/retailSales/usWageGrowth 추가 — 세 시리즈 ID(HOUST/RSAFS/
// CES0500000003) 모두 클라이언트 자체 FRED_SERIES 테이블(aio-data.js:3195~3216, 개인 FRED 키
// 보유 사용자용 브릿지)에서 이미 실사용 중이던 것을 서버(레포 공용 키)로 승격 — 전 사용자 자동 적용.
// consConf(Conf. Board)는 의도적으로 제외: FRED엔 Conference Board 소비자신뢰 시리즈가 없음(비영리
// 민간기관 유료 라이선스, UMCSENT=미시간대와는 발행기관·척도가 다른 별개 지표 — P456/P593 참조).
// 한국 CPI(FRED KORCPIALLMINMEI 등 OECD 릴레이)는 이번에 보류: 신선도 검증 불가(로컬 네트워크 제약)
// + 이미 더 권위있는 직접 소스(KOSIS API 브릿지 aio-data.js fetchAllKosisData, /data-refresh 통계청
// 수동 확인)가 있어 릴레이로 교체 시 오히려 신선도 퇴보 위험 — 확장 후보로 문서에만 남김.
const FRED_SERIES = {
  cpi:        { id: 'CPIAUCSL', kind: 'yoy' },
  coreCpi:    { id: 'CPILFESL', kind: 'yoy' },
  pce:        { id: 'PCEPI',    kind: 'yoy' },
  corePce:    { id: 'PCEPILFE', kind: 'yoy' },
  fedRate:    { id: 'FEDFUNDS', kind: 'level' },
  unemployment:{ id: 'UNRATE',  kind: 'level' },
  nfp:        { id: 'PAYEMS',   kind: 'mom_diff' }, // 천명 단위 (e.g. 172)
  housingStarts: { id: 'HOUST',          kind: 'level', scale: 0.001 }, // 천 단위→백만 단위 (DATA_SNAPSHOT.housingStarts는 1.47M 형태)
  retailSales:   { id: 'RSAFS',          kind: 'mom_pct' },             // 소매판매 MoM% (레벨 $ 시리즈에서 파생)
  usWageGrowth:  { id: 'CES0500000003',  kind: 'yoy' },                 // 시간당 평균임금 YoY%
  hyOAS:         { id: 'BAMLH0A0HYM2',   kind: 'level', scale: 1 },     // FRED percent; UI converts to bp at the renderer boundary
};

// BLS Public Data API v1 is a separate official observation path from FRED.
// Keep the six-series allowlist bounded and preserve typed observation evidence
// inside data.json.macro; do not silently overwrite the FRED projection above.
const BLS_SERIES = {
  cpi: { id: 'CUSR0000SA0', field: 'blsCpiYoY', unit: 'index', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'yoy' },
  coreCpi: { id: 'CUSR0000SA0L1E', field: 'blsCoreCpiYoY', unit: 'index', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'yoy' },
  unemployment: { id: 'LNS14000000', field: 'blsUnemployment', unit: 'percent', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'level' },
  laborForceParticipation: { id: 'LNS11300000', field: 'blsLaborForceParticipation', unit: 'percent', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'level' },
  nonfarmPayroll: { id: 'CES0000000001', field: 'blsNfpMoM', unit: 'thousands', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'mom_diff' },
  averageHourlyEarnings: { id: 'CES0500000003', field: 'blsAverageHourlyEarningsYoY', unit: 'USD/hour', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'yoy' },
};
const BLS_ENDPOINT = 'https://api.bls.gov/publicAPI/v1/timeseries/data/';
const BLS_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

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

// RSS/HTML 텍스트 fetch — 단일 시도, JSON API와 달리 retry 불요(피드별 실패는 호출자가 무시).
async function _fetchRss(url, timeoutMs) {
  timeoutMs = timeoutMs || 12000;
  const ctrl = new AbortController();
  const to = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: UA, signal: ctrl.signal });
    clearTimeout(to);
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } catch (e) { clearTimeout(to); throw e; }
}

// v50.24/WO-1: Yahoo는 두 호스트(query1/query2)를 운영하고 차단/레이트리밋이 호스트마다 다르게
// 걸리는 경우가 잦다. GitHub Actions 러너 IP가 한 호스트에서 막혀도 다른 호스트로 폴백 → 전량 실패
// (= data.json 미갱신)를 줄인다. 2 호스트 × 2 시도 = 최대 4회. 그래도 다 실패하면 throw(해당 심볼만).
const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

// ── Yahoo v8/chart: 한 심볼의 현재가 + 전일종가 (호스트 폴백 내성) ──
// v51.64 P545: 주말/휴장 수집 시 Yahoo meta.chartPreviousClose가 전주 종가를 반환해
// 주간 변동률이 일간으로 오표시되는 구조적 문제 수정.
// → range=5d OHLCV 배열의 실제 전전일 종가(closes[-2])로 일간 Pct 계산.
//   OHLCV 배열이 2개 미만일 때만 chartPreviousClose로 폴백.
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

      // OHLCV 배열에서 실제 전일 종가 추출 (주말 수집 시에도 정확한 trading-day 기준)
      const rawCloses = res?.indicators?.quote?.[0]?.close || [];
      const closes = rawCloses.filter(c => c != null && isFinite(c) && c > 0);
      let prev, pct, pctSource;
      if (closes.length >= 2) {
        prev = closes[closes.length - 2];       // 실제 전일 거래일 종가
        pct  = ((price - prev) / prev) * 100;
        pctSource = 'ohlcv-daily';
      } else {
        // OHLCV 부족 시 메타 필드 폴백 (구형 동작 유지)
        prev = (typeof m.chartPreviousClose === 'number' && m.chartPreviousClose > 0)
          ? m.chartPreviousClose
          : (typeof m.previousClose === 'number' ? m.previousClose : null);
        pct  = (prev && prev > 0) ? ((price - prev) / prev) * 100 : null;
        pctSource = 'chart-meta-fallback';
      }
      return {
        symbol,
        regularMarketPrice: price,
        regularMarketChangePercent: pct,
        regularMarketPreviousClose: prev,
        chartPreviousClose: prev,
        _pctSource: pctSource,
        _source: 'live:yahoo-gh',
        // Observation lineage: generatedAt is fetch time, not necessarily market observation time.
        regularMarketTime: Number.isFinite(m.regularMarketTime) ? m.regularMarketTime : null,
        observedAt: Number.isFinite(m.regularMarketTime) ? new Date(m.regularMarketTime * 1000).toISOString() : null,
        fetchedAt: new Date().toISOString(),
        delayedByMs: Number.isFinite(m.regularMarketTime) ? Math.max(0, Date.now() - m.regularMarketTime * 1000) : null,
        marketState: m.marketState || null,
        marketSession: m.marketState || null,
        exchangeTimezoneName: m.exchangeTimezoneName || null,
        fullExchangeName: m.fullExchangeName || m.exchangeName || null,
        venue: m.fullExchangeName || m.exchangeName || null,
        currency: m.currency || null,
        source: 'Yahoo chart',
        sourceTier: 'public-information-service',
        allowedUse: Number.isFinite(m.regularMarketTime) ? 'current-with-session-and-delay-gate' : 'reference-only',
      };
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// v50.99: fetch 성공처럼 보이는 데이터 품질 검증.
// Yahoo가 에러 없이 stale/비정상 데이터를 반환할 수 있음 — 전일 종가 대비 변동폭으로 판별.
// 허용 범위: 금리(±5%p) / 크립토(±50%) / 그 외(±30%). 범위 초과 시 재시도 대상.
function _quoteVerifyTol(symbol) {
  if (/^\^(TNX|TYX|FVX|IRX)$/.test(symbol)) return 5;
  if (/-USD$/.test(symbol)) return 50;
  return 30;
}
function _quoteOk(q) {
  if (!q || q.__error) return false;
  const price = q.regularMarketPrice, prev = q.regularMarketPreviousClose || q.chartPreviousClose;
  if (typeof price !== 'number' || price <= 0) return false;
  if (prev > 0) {
    const chg = Math.abs((price - prev) / prev) * 100;
    if (chg > _quoteVerifyTol(q.symbol)) return false;
  }
  return true;
}

// v51.92/Phase 2 [B1]: Yahoo가 두 호스트 모두 실패할 때의 2차 공급자 폴백.
// 왜 ETF만: Twelve Data는 US 상장 ETF/주식은 Yahoo와 동일한 평문 티커(SPY, QQQ ...)를
// 쓰지만, 지수(^GSPC)·선물(CL=F)·FX(KRW=X)·한국주식은 표기 체계가 다르다. 무료(demo) 키로는
// AAPL 외 심볼이 401이라 실측 검증이 불가능했다 — 틀린 심볼 매핑으로 잘못된 가격이 라이브에
// 들어가는 위험을 피하기 위해, Yahoo·Twelve Data 표기가 1:1로 확실히 같은 이 서브셋(신용·핵심
// ETF, SYMBOLS 배열의 "breadth/리스크 입력" 블록과 동일)으로만 스코프를 한정한다.
// 지수/선물/FX/KR 확장은 실제 유효 키로 심볼 표기를 실측 검증한 뒤 별도로 진행할 것.
const TWELVE_DATA_ETF_FALLBACK_SYMBOLS = new Set([
  'HYG','LQD','TLT','SPY','QQQ','IWM','RSP','DIA','SMH',
  'XLK','XLF','XLE','XLV','XLI','XLY','XLP','XLU','XLRE','XLB','XLC',
]);

async function fetchQuoteTwelveData(symbol, apiKey) {
  const url = `https://api.twelvedata.com/quote?symbol=${encodeURIComponent(symbol)}&apikey=${apiKey}`;
  const j = await fetchJSON(url, {}, 2);
  if (j && (j.status === 'error' || j.code)) throw new Error(`twelvedata: ${j.message || j.code}`);
  const price = parseFloat(j && j.close);
  const prev = parseFloat(j && j.previous_close);
  if (!isFinite(price) || price <= 0) throw new Error('twelvedata: no close price');
  const pct = (isFinite(prev) && prev > 0) ? ((price - prev) / prev) * 100 : null;
  return {
    symbol,
    regularMarketPrice: price,
    regularMarketChangePercent: pct,
    regularMarketPreviousClose: isFinite(prev) ? prev : null,
    chartPreviousClose: isFinite(prev) ? prev : null,
    _pctSource: 'twelvedata-quote',
    _source: 'live:twelvedata-fallback',
    regularMarketTime: j && j.timestamp ? Number(j.timestamp) : null,
    observedAt: j && j.timestamp ? new Date(Number(j.timestamp) * 1000).toISOString() : null,
    fetchedAt: new Date().toISOString(),
    delayedByMs: j && j.timestamp ? Math.max(0, Date.now() - Number(j.timestamp) * 1000) : null,
    marketState: j && j.is_market_open === true ? 'REGULAR' : (j && j.is_market_open === false ? 'CLOSED' : null),
    marketSession: j && j.is_market_open === true ? 'REGULAR' : (j && j.is_market_open === false ? 'CLOSED' : null),
    exchangeTimezoneName: j && j.timezone || null,
    fullExchangeName: j && j.exchange || null,
    venue: j && j.exchange || null,
    currency: j && j.currency || null,
    source: 'Twelve Data quote fallback',
    sourceTier: 'public-api-plan',
    allowedUse: j && j.timestamp ? 'current-with-session-and-delay-gate' : 'reference-only',
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
  // P565/R256: a single failed FRED series used to be swallowed with no log and no field-level
  // flag — only the aggregate macroKeyCount dropped by one, with nothing telling anyone WHICH
  // series broke. enrichFundamentals (FMP) already detects and surfaces plan/auth errors
  // explicitly; this brings FRED to the same standard so a stale/broken series (the mechanism
  // behind Fed/BOJ/BOK/BOE rates going 15-62 days stale) is visible instead of silent.
  const out = { _source: 'fred', _failedSeries: [] };
  for (const [field, spec] of Object.entries(FRED_SERIES)) {
    try {
      const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${spec.id}` +
        `&api_key=${key}&file_type=json&sort_order=desc&limit=14`;
      const j = await fetchJSON(url);
      const obs = (j.observations || []).filter(o => o.value !== '.').map(o => ({ d: o.date, v: parseFloat(o.value) }));
      if (!obs.length) continue;
      if (spec.kind === 'level') {
        // v51.97/Phase 2 [B2]: scale — 시리즈 원 단위(예: HOUST=천 단위)를 소비처 단위(백만)로
        // 변환. 미지정 시 1(기존 fedRate/unemployment 등 동작 불변).
        const scale = spec.scale || 1;
        out[field] = round(obs[0].v * scale, 3);
        // MoM delta: 이번 달 레벨 - 지난 달 레벨
        if (obs.length >= 2) out[field + 'Delta'] = round((obs[0].v - obs[1].v) * scale, 3);
      } else if (spec.kind === 'mom_pct') {
        // v51.97/Phase 2 [B2]: 레벨(예: RSAFS 소매판매 $) 시리즈의 전월 대비 변화율(%).
        if (obs.length >= 2 && obs[1].v) out[field] = round((obs[0].v / obs[1].v - 1) * 100, 1);
      } else if (spec.kind === 'yoy') {
        const cur = obs[0];
        const yoy = obs.find(o => monthsBetween(o.d, cur.d) >= 12) || obs[obs.length - 1];
        const curYoY = (yoy && yoy.v) ? round((cur.v / yoy.v - 1) * 100, 1) : null;
        if (curYoY !== null) out[field] = curYoY;
        // MoM delta in YoY rate: 이번 달 YoY - 지난 달 YoY (인플레이션 속도 변화)
        if (obs.length >= 2) {
          const prev = obs[1];
          const yoyPrev = obs.find(o => monthsBetween(o.d, prev.d) >= 12) || obs[obs.length - 1];
          const prevYoY = (yoyPrev && yoyPrev.v && yoyPrev.d !== yoy.d) ? round((prev.v / yoyPrev.v - 1) * 100, 1) : null;
          if (curYoY !== null && prevYoY !== null) out[field + 'Delta'] = round(curYoY - prevYoY, 1);
        }
      } else if (spec.kind === 'mom_diff') {
        if (obs.length >= 2) out[field] = Math.round(obs[0].v - obs[1].v); // 천명
        // 전월 대비 delta: 이번 달 변화 - 지난 달 변화
        if (obs.length >= 3) out[field + 'Delta'] = Math.round((obs[0].v - obs[1].v) - (obs[1].v - obs[2].v));
      }
      out['_asOf_' + field] = obs[0].d;
    } catch (e) {
      out._failedSeries.push(field);
      console.warn(`[fetch-data] FRED series 실패: ${field} (${spec.id}) — ${e.message}`);
    }
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
      return {
        score: Math.round(fg.score),
        rating: fg.rating || null,
        _source: 'cnn',
        asOf: fg.timestamp || null,
        // CNN API의 previous_close = 전일 종가 시점 F&G 점수
        previousScore: typeof fg.previous_close === 'number' ? Math.round(fg.previous_close) : null,
        previousWeek: typeof fg.previous_1_week === 'number' ? Math.round(fg.previous_1_week) : null,
      };
    }
  } catch (e) {}
  return { _source: 'cnn:fail' };
}

function blsObservationDate(year, period) {
  const month = Number(String(period || '').slice(1));
  return /^\d{4}$/.test(String(year || '')) && month >= 1 && month <= 12
    ? `${year}-${String(month).padStart(2, '0')}-01`
    : null;
}

function blsMonthlyRows(series) {
  return (series && Array.isArray(series.data) ? series.data : [])
    .filter(row => /^M(?:0[1-9]|1[0-2])$/.test(String(row.period || '')))
    .map(row => ({
      year: String(row.year),
      period: String(row.period),
      date: blsObservationDate(row.year, row.period),
      value: Number(row.value),
      footnotes: Array.isArray(row.footnotes) ? row.footnotes.filter(Boolean) : []
    }))
    .filter(row => row.date && Number.isFinite(row.value))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function blsPriorMonth(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 10);
}

function blsPriorYear(date) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

export function normalizeBlsSeriesResponse(payload, fetchedAt = new Date().toISOString()) {
  const responseRows = new Map((payload && payload.Results && Array.isArray(payload.Results.series) ? payload.Results.series : [])
    .map(series => [series.seriesID, series]));
  const series = {};
  const values = {};
  const failures = [];

  Object.entries(BLS_SERIES).forEach(([metricId, config]) => {
    const raw = responseRows.get(config.id);
    const rows = blsMonthlyRows(raw);
    const latest = rows[0] || null;
    const evidence = {
      metricId,
      seriesId: config.id,
      unit: config.unit,
      frequency: config.frequency,
      seasonalAdjustment: config.seasonalAdjustment,
      source: 'BLS Public Data API v1',
      sourceKind: 'official-primary',
      sourceUrl: 'https://www.bls.gov/developers/',
      fetchedAt,
      releaseAt: null,
      observedAt: latest && latest.date,
      observationPeriod: latest ? `${latest.year}-${latest.period}` : null,
      rawValue: latest ? latest.value : null,
      observationStatus: latest && latest.footnotes.length ? 'footnote-present' : 'final',
      footnotes: latest ? latest.footnotes : [],
      allowedUse: 'macro-evidence-with-observation-date',
      decisionUse: false,
      status: 'unavailable',
      value: null,
      inputObservationPeriods: []
    };

    if (!latest) {
      failures.push({ metricId, seriesId: config.id, reason: 'empty_or_invalid_monthly_data' });
      series[metricId] = evidence;
      return;
    }

    let derived = latest.value;
    let inputs = [latest];
    if (config.derive === 'yoy') {
      const prior = rows.find(row => row.date === blsPriorYear(latest.date));
      if (!prior || prior.value === 0) {
        evidence.status = 'insufficient_history';
        failures.push({ metricId, seriesId: config.id, reason: 'insufficient_history_for_yoy' });
        series[metricId] = evidence;
        return;
      }
      derived = round((latest.value / prior.value - 1) * 100, 1);
      inputs = [latest, prior];
    } else if (config.derive === 'mom_diff') {
      const prior = rows.find(row => row.date === blsPriorMonth(latest.date));
      if (!prior) {
        evidence.status = 'insufficient_history';
        failures.push({ metricId, seriesId: config.id, reason: 'insufficient_history_for_mom_diff' });
        series[metricId] = evidence;
        return;
      }
      derived = round(latest.value - prior.value, 0);
      inputs = [latest, prior];
    }

    evidence.value = derived;
    evidence.status = 'ok';
    evidence.inputObservationPeriods = inputs.map(row => `${row.year}-${row.period}`);
    values[config.field] = derived;
    series[metricId] = evidence;
  });

  const successful = Object.values(series).filter(row => row.status === 'ok').length;
  return {
    schemaVersion: 'bls-evidence.v1',
    source: 'BLS Public Data API v1',
    sourceKind: 'official-primary',
    sourceUrl: BLS_ENDPOINT,
    fetchedAt,
    lastSuccessfulAt: successful ? fetchedAt : null,
    attemptedAt: fetchedAt,
    releaseAt: null,
    status: successful === Object.keys(BLS_SERIES).length ? 'ok' : successful ? 'partial' : 'unavailable',
    series,
    values,
    failures,
    allowedUse: 'macro-evidence-with-observation-date',
    decisionUse: false
  };
}

export async function fetchBlsSeries(previous = null) {
  const now = new Date();
  const nowIso = now.toISOString();
  const previousFetchedAt = previous && previous.fetchedAt ? new Date(previous.fetchedAt).getTime() : NaN;
  if (previous && Number.isFinite(previousFetchedAt) && Date.now() - previousFetchedAt <= BLS_CACHE_MAX_AGE_MS) {
    return { ...previous, attemptedAt: nowIso, status: 'cached-fresh', cacheHit: true };
  }

  try {
    const year = now.getUTCFullYear();
    const response = await fetchJSON(BLS_ENDPOINT, {
      method: 'POST',
      headers: { ...UA, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: Object.values(BLS_SERIES).map(config => config.id),
        startyear: String(year - 2),
        endyear: String(year)
      })
    });
    if (!response || response.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS status ${response && response.message || response && response.status || 'unknown'}`);
    const normalized = normalizeBlsSeriesResponse(response, nowIso);
    if (Object.keys(normalized.values).length) return normalized;
    throw new Error('BLS response contained no usable monthly series');
  } catch (error) {
    const failureReason = String(error && error.message || error);
    if (previous && previous.series) {
      return {
        ...previous,
        status: 'stale',
        attemptedAt: nowIso,
        failureReason,
        cacheHit: false
      };
    }
    return {
      schemaVersion: 'bls-evidence.v1',
      source: 'BLS Public Data API v1',
      sourceKind: 'official-primary',
      sourceUrl: BLS_ENDPOINT,
      fetchedAt: null,
      lastSuccessfulAt: null,
      attemptedAt: nowIso,
      releaseAt: null,
      status: 'unavailable',
      series: {},
      values: {},
      failures: [{ metricId: 'batch', seriesId: Object.values(BLS_SERIES).map(config => config.id).join(','), reason: failureReason }],
      failureReason,
      allowedUse: 'none',
      decisionUse: false
    };
  }
}

// ── Cboe official daily Put/Call statistics ──
// The legacy CDN JSON currently returns AccessDenied to server/browser callers.
// Cboe's official daily statistics page embeds the same ratios and selected
// trading date in its server-rendered payload, so Actions can ingest it without
// a public CORS proxy. This is delayed daily volume, never labelled real-time.
export function parseCboePutCallHtml(html) {
  const normalized = String(html || '').replace(/\\"/g, '"');
  const pick = (label) => {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = normalized.match(new RegExp('"name"\\s*:\\s*"' + escaped + '"\\s*,\\s*"value"\\s*:\\s*"([0-9.]+)"', 'i'));
    const value = match ? Number(match[1]) : null;
    return Number.isFinite(value) ? value : null;
  };
  const selectedDate = (normalized.match(/"selectedDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"/) || [])[1] || null;
  const totalPutCall = pick('TOTAL PUT/CALL RATIO');
  if (!Number.isFinite(totalPutCall) || !selectedDate) return null;
  return {
    totalPutCall,
    indexPutCall: pick('INDEX PUT/CALL RATIO'),
    equityPutCall: pick('EQUITY PUT/CALL RATIO'),
    asOf: selectedDate,
    fetchedAt: new Date().toISOString(),
    source: 'Cboe Daily Market Statistics',
    sourceUrl: 'https://www.cboe.com/data/mktstat.aspx',
    sourceKind: 'delayed',
    allowedUse: 'decision-with-daily-delay'
  };
}

async function fetchCboePutCall() {
  try {
    const html = await _fetchRss('https://www.cboe.com/data/mktstat.aspx', 18000);
    const parsed = parseCboePutCallHtml(html);
    if (!parsed) throw new Error('official page did not contain ratio/date contract');
    return parsed;
  } catch (error) {
    console.warn('[fetch-data] Cboe Put/Call 수집 실패:', error && error.message || error);
    return { source: 'Cboe Daily Market Statistics', sourceKind: 'unavailable', allowedUse: 'none', fetchedAt: new Date().toISOString(), error: String(error && error.message || error) };
  }
}

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

function _fmtKstCycleDate(ms) {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

function getKst0800NewsCycle(nowMs = Date.now()) {
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

const NEWS_FEEDS = [
  { query: 'Reuters Bloomberg CNBC market moving stocks S&P 500 Nasdaq Federal Reserve Treasury yields oil when:2d', source: 'Google News - Market movers', topic: 'macro', country: 'us', tier: 1 },
  { query: 'stock market OR S&P 500 OR Nasdaq OR Federal Reserve OR Treasury yield OR inflation when:2d', source: 'Google News - US markets', topic: 'macro', country: 'us', tier: 2 },
  { query: 'Nvidia OR Micron OR semiconductor OR AI stocks OR data center OR earnings guidance when:2d', source: 'Google News - AI/Semis', topic: 'semi', country: 'us', tier: 2 },
  { query: 'Iran OR Hormuz OR Red Sea OR oil prices OR geopolitics OR sanctions when:2d', source: 'Google News - Geopolitics/Energy', topic: 'geo', country: 'global', tier: 1 },
  { query: 'dollar OR yen OR Treasury yields OR bond market OR credit spreads OR gold when:2d', source: 'Google News - FX/Bonds', topic: 'fxbond', country: 'global', tier: 1 },
  { query: 'LQD OR HYG OR corporate bonds OR credit spreads OR investment grade OAS OR rating downgrade OR AI capex funding OR data center financing when:2d', source: 'Google News - Credit/Funding', topic: 'credit', country: 'global', tier: 1 },
  { query: 'upgrade OR downgrade OR price target OR analyst rating OR earnings guidance stock when:2d', source: 'Google News - Analyst/Earnings', topic: 'analyst', country: 'us', tier: 2 },
  { query: 'KOSPI Samsung Electronics SK Hynix AI semiconductor selloff rebound Micron foreign investors when:2d', source: 'Google News - Korea markets', topic: 'korea', country: 'kr', tier: 2 },
].map(feed => ({ ...feed, url: _googleNewsSearchUrl(feed.query, feed.country === 'kr' ? 'ko' : 'en-US', feed.country === 'kr' ? 'KR' : 'US', feed.country === 'kr' ? 'KR:ko' : 'US:en') }));

const SERVER_NEWS_PRIORITY_RULES = [
  { label: 'macro-rates', points: 14, re: /\b(fed|fomc|powell|rate cut|rate hike|inflation|cpi|ppi|pce|payroll|jobs report|recession|soft landing|treasury yield|bond yield)\b/i },
  { label: 'geopolitics-energy', points: 14, re: /\b(iran|hormuz|red sea|israel|lebanon|ukraine|sanction|tariff|export control|oil prices?|wti|brent|lng|opec)\b/i },
  { label: 'ai-semis', points: 13, re: /\b(nvidia|nvda|semiconductor|chip|hbm|dram|sk hynix|samsung electronics|tsmc|asml|blackwell|rubin|data center|ai infrastructure)\b/i },
  { label: 'credit-funding', points: 12, re: /\b(lqd|hyg|oas|credit spreads?|corporate bonds?|investment grade|high yield|rating downgrade|debt financing|funding costs?|capex funding|project finance|data center financing)\b/i },
  { label: 'earnings-guidance', points: 10, re: /\b(earnings|revenue|eps|guidance|outlook|margin|buyback|dividend|preannounces?)\b/i },
  { label: 'analyst-action', points: 8, re: /\b(upgrade|downgrade|price target|rating|initiates|overweight|underweight|buy rating|sell rating)\b/i },
  { label: 'fx-bonds-commodities', points: 8, re: /\b(dollar|yen|euro|yuan|won|dxy|forex|gold|copper|credit spread|yield curve)\b/i },
  { label: 'mega-cap', points: 8, re: /\b(aapl|apple|msft|microsoft|nvda|nvidia|amzn|amazon|meta|tesla|tsla|googl|google|avgo|broadcom|amd|oracle|orcl|jpm|exxon|xom)\b/i },
];

const SERVER_NEWS_CLICKBAIT_RE = /\b(next nvidia|next tesla|must buy|guaranteed return|millionaire|hidden gem|penny stock|to the moon|won't believe|don't miss|best stocks? to buy now)\b/i;
const SERVER_NEWS_UNVERIFIED_RE = /\b(people familiar|sources say|according to sources|unconfirmed|rumor|reportedly|may be considering|is said to)\b/i;
const SERVER_NEWS_TIER1_SOURCE_RE = /\b(Reuters|Bloomberg|Associated Press|AP News|Financial Times|Wall Street Journal|WSJ|CNBC)\b/i;
const SERVER_NEWS_TIER2_SOURCE_RE = /\b(MarketWatch|Barron's|Nikkei|Yonhap|Naver|Korea JoongAng|The Korea Herald|The Hill|Yahoo Finance)\b/i;
const SERVER_NEWS_LOW_QUALITY_SOURCE_RE = /\b(Ad-hoc-news|MSN|GuruFocus|IndexBox|Pluang|Bitget|Stocktwits|TradingPedia|The Vibes|WBFF|Benzinga|Zacks)\b/i;

function getServerNewsSourceTier(source, feedTier) {
  const src = String(source || '');
  if (SERVER_NEWS_TIER1_SOURCE_RE.test(src)) return 1;
  if (SERVER_NEWS_TIER2_SOURCE_RE.test(src)) return 2;
  if (SERVER_NEWS_LOW_QUALITY_SOURCE_RE.test(src)) return 4;
  if (!src && feedTier) return Math.max(2, feedTier);
  return 3;
}

function scoreServerNewsItem(item) {
  const text = `${item.title || ''} ${item.source || ''} ${item.topic || ''}`;
  if (SERVER_NEWS_CLICKBAIT_RE.test(text)) return { score: 0, selectionReason: 'clickbait-filter' };

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

  for (const rule of SERVER_NEWS_PRIORITY_RULES) {
    if (rule.re.test(text)) {
      score += rule.points;
      reasons.push(`${rule.label}+${rule.points}`);
    }
  }

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
    items.push({ title: title.slice(0, titleLen), link: link || null, source: src || '', pubDate: pub || null, ts: isFinite(ts) ? ts : 0 });
  }
  return items;
}

async function fetchNews() {
  const cycle = getKst0800NewsCycle();
  const items = [];    // US/글로벌 피드
  const krItems = [];  // 한국 전용 (reserved slot)
  for (const feed of NEWS_FEEDS) {
    const isKr = feed.country === 'kr';
    try {
      const parsed = _parseRssXml(await _fetchRss(feed.url, 12000), { limit: 20, titleLen: 200, needLink: true });
      for (const p of parsed) {
        const t = p.ts;
        if (!isFinite(t) || t < cycle.startMs || t >= cycle.endMs) continue;
        const item = {
          title: p.title, link: p.link, source: p.source || feed.source,
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
        if (isKr) { krItems.push(item); } else { items.push(item); }
      }
    } catch (e) { /* 피드별 실패 무시 */ }
  }
  // US/글로벌: 점수순 정렬, 한국: 최신순 정렬
  items.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.ts || 0) - (a.ts || 0));
  krItems.sort((a, b) => (b.score || 0) - (a.score || 0) || (b.ts || 0) - (a.ts || 0));
  const seen = new Set();
  const out = [];
  function pushItem(it) {
    out.push({
      title: it.title, link: it.link, source: it.source,
      pubDate: it.pubDate, topic: it.topic, country: it.country,
      tier: it.tier, score: it.score, selectionReason: it.selectionReason,
      feedSource: it.feedSource,
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
    const k = it.title.toLowerCase().slice(0, 60);
    if (seen.has(k)) continue;
    seen.add(k);
    pushItem(it);
  }
  // 나머지 슬롯(최대 37개)을 US/글로벌 뉴스로 채움
  for (const it of items) {
    if (out.length >= 40) break;
    const k = it.title.toLowerCase().slice(0, 60);
    if (seen.has(k)) continue;
    seen.add(k);
    pushItem(it);
  }
  return out;
}

// ── v51.15: 개별 종목 뉴스 enrichment — Google News RSS per-ticker → screener.json newsMemo ──
// _fetchRss + _parseRssXml 공용 헬퍼 기반으로 중복 없이 구현.
async function fetchTickerNewsItems(sym, days) {
  const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(sym + ' stock when:' + (days || 3) + 'd') + '&hl=en-US&gl=US&ceid=US:en';
  try { return _parseRssXml(await _fetchRss(url, 8000), { limit: 5, titleLen: 130 }); }
  catch (e) { return []; }
}

// 뉴스 아이템 배열 → 스크리너 메모 문자열 (최신 2건, "[MM-DD] 제목 (출처)" 형식)
function _fmtTickerNewsMemo(items) {
  if (!items || !items.length) return null;
  const top = items.filter(i => i.title).sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 2);
  if (!top.length) return null;
  return top.map(it => {
    const d = it.ts ? new Date(it.ts).toISOString().slice(5, 10) : '';
    const src = it.source ? ' (' + it.source + ')' : '';
    return '[' + d + '] ' + it.title + src;
  }).join(' · ');
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
      const q0 = res?.indicators?.quote?.[0];
      const closes = q0?.close;
      // v51.91 P587/R265/C6: Yahoo's chart endpoint already returns a parallel
      // indicators.adjclose[0].adjclose series (split+dividend adjusted, no extra query param
      // needed — verified by direct fetch, not assumed) alongside the raw OHLCV. Expose it as
      // `adjClose` per row; callers that compute returns/momentum on dividend-paying equities
      // should prefer it (see _enrichPriceFactors below) since raw close systematically understates
      // total return for high-yield names — measured divergence on KO: +14.6% (raw) vs +17.9%
      // (adjusted) over 1y, a 3.3pp gap from dividends alone. `high`/`low`/`volume` and this
      // function's other consumer (backfillHistory, index-level symbols only) stay on raw values.
      const adjArr = res?.indicators?.adjclose?.[0]?.adjclose;
      if (!Array.isArray(ts) || !Array.isArray(closes)) throw new Error('no history arrays');
      const out = [];
      for (let i = 0; i < ts.length; i++) {
        const c = closes[i];
        if (typeof c !== 'number' || !isFinite(c)) continue;
        const h = q0.high?.[i], l = q0.low?.[i], v = q0.volume?.[i];
        const a = Array.isArray(adjArr) ? adjArr[i] : undefined;
        out.push({
          date: new Date(ts[i] * 1000).toISOString().slice(0, 10),
          observedAt: new Date(ts[i] * 1000).toISOString(),
          close: round(c, 2),
          adjClose: (typeof a === 'number' && isFinite(a) && a > 0) ? round(a, 2) : round(c, 2),
          high:   typeof h === 'number' && isFinite(h) ? round(h, 2)    : round(c, 2),
          low:    typeof l === 'number' && isFinite(l) ? round(l, 2)    : round(c, 2),
          volume: typeof v === 'number' && isFinite(v) ? Math.round(v)  : 0,
        });
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

// v51.94/Phase 2 [B6]: 심볼 목록을 js/aio-data.js 소스 텍스트 정규식 스크래핑 대신
// public-data/screener-universe.json(scripts/sync-screener-universe.mjs가 SCREENER_DB에서
// 생성하는 JSON 아티팩트)에서 직접 읽는다. 이전 방식은 "\n];" 문자열 탐색으로 배열 끝을
// 찾아 취약했다(배열 안 어딘가에 그 정확한 바이트열이 나타나면 조기 종료) — JSON은 그런
// 경계 추측이 필요 없다. screener-universe.json이 오래됐거나 없으면(sync 누락) CI의
// ci-data-pipeline-contract-check.mjs가 drift를 잡아낸다.
async function getScreenerSymbols() {
  try {
    const raw = await readFile(`${__dir}/../public-data/screener-universe.json`, 'utf8');
    const j = JSON.parse(raw);
    const syms = (j.universe || []).map(r => r && r.sym).filter(Boolean);
    return [...new Set(syms)];
  } catch (e) { console.warn('[fetch-data] screener-universe.json 읽기 실패:', e && e.message); return []; }
}
// Yahoo 심볼 정규화: 클래스주 BRK.B→BRK-B. KR(.KS/.KQ)·일반은 보존.
const _yhSym = (s) => s.replace(/^([A-Z]+)\.([A-Z])$/, '$1-$2');

export const _mean = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
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
// v51.91 P584/R265/C1: switched from Cutler's RSI (simple average over only the last 14 bars,
// recomputed fresh each call) to Wilder's RSI (initial 14-bar average, then recursively smoothed
// over the full input history) — matching js/aio-core.js:_calcRSILast exactly. The two methods
// carried the same "RSI(14)" label but produced different numbers whenever there was a meaningful
// gain/loss regime earlier in the series, so screener.json's rsi and the client's own RSI display
// could diverge by several points. Wilder's method is what TradingView/TA-Lib/most brokers mean by
// "RSI" by default — the named-methodology-parity requirement from R265. Verified by extraction:
// scripts/ci-data-pipeline-contract-check.mjs runs both implementations against identical synthetic
// closes and asserts the outputs match within tolerance.
function _rsi14(closes) {
  const period = 14;
  const nums = closes.filter((v) => typeof v === 'number' && isFinite(v) && v > 0);
  if (nums.length < period + 1) return null;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = nums[i] - nums[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  for (let j = period + 1; j < nums.length; j++) {
    const diff = nums[j] - nums[j - 1];
    avgGain = ((avgGain * (period - 1)) + Math.max(diff, 0)) / period;
    avgLoss = ((avgLoss * (period - 1)) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return round(100 - (100 / (1 + rs)), 1);
}
// v51.32: 칼만 추세 필터 — 숨겨진 가격 레벨과 추세 속도(velocity)를 재귀 추정.
// 노이즈 측정에서 실제 추세 속도를 분리 (Rolling OLS보다 연속적이고 안정적).
// state=[level, velocity], F=[[1,1],[0,1]], H=[1,0], Q=diag(Ql,Qv), R=obs noise.
function _kalmanTrend(closes, vol) {
  if (!Array.isArray(closes) || closes.length < 10) return null;
  const series = closes
    .map(v => (typeof v === 'number' && isFinite(v) && v > 0) ? Math.log(v) : null)
    .filter(v => v !== null);
  if (series.length < 10) return null;
  const Ql = 1e-4, Qv = 1e-5;
  // R = daily observation noise. Use asset's own daily variance when available so
  // high-vol stocks (VIX 70+) don't over-trust the signal and low-vol names don't lag.
  const dailyVol = (typeof vol === 'number' && vol > 0) ? (vol / 100) / Math.sqrt(252) : null;
  const R = dailyVol ? Math.max(1e-4, dailyVol * dailyVol) : 1e-2;
  // 초기 속도: 첫 5일 선형 기울기로 시드 (s1=0 시작 시 20~30일 수렴 지연 제거)
  const initN = Math.min(5, series.length - 1);
  const s1Init = initN > 0 ? (series[initN] - series[0]) / initN : 0;
  let s0 = series[0], s1 = s1Init;
  let p00 = 1, p01 = 0, p10 = 0, p11 = 1;
  let lastE = 0, lastS = R;
  for (let i = 0; i < series.length; i++) {
    const y = series[i];
    const ps0 = s0 + s1, ps1 = s1;
    const pp00 = p00 + p01 + p10 + p11 + Ql;
    const pp01 = p01 + p11, pp10 = p10 + p11, pp11 = p11 + Qv;
    const e = y - ps0, S = pp00 + R;
    lastE = e; lastS = S;
    const k0 = pp00 / S, k1 = pp10 / S;
    s0 = ps0 + k0 * e; s1 = ps1 + k1 * e;
    p00 = (1 - k0) * pp00; p01 = (1 - k0) * pp01;
    p10 = -k1 * pp00 + pp10; p11 = -k1 * pp01 + pp11;
  }
  const vel = (Math.expm1(s1) * 100), pt = p00 + p11;
  const innovZ = lastS > 0 ? round(lastE / Math.sqrt(lastS), 4) : null;
  const velConf = round(vel / (1 + Math.sqrt(Math.max(pt, 0))), 6);
  return { vel: round(vel, 6), pt: round(pt, 6), innovZ, velConf, scale: 'log_pct_day' };
}
export function closesToFactors(closes) {
  if (!Array.isArray(closes) || closes.length < 30) return null;
  const price = closes[closes.length - 1];
  const sma50 = closes.length >= 50 ? _mean(closes.slice(-50)) : null;
  const sma200 = closes.length >= 200 ? _mean(closes.slice(-200)) : null;
  const vol60 = _annVol(closes, 60);
  const kalman = _kalmanTrend(closes.slice(-90), vol60);
  return {
    price: round(price, 2),
    ret1m: _retPct(closes, 21), ret3m: _retPct(closes, 63), ret6m: _retPct(closes, 126),
    vol: vol60, rsi: _rsi14(closes),
    pctSma50: (sma50 && sma50 > 0) ? round((price / sma50 - 1) * 100, 2) : null,
    pctSma200: (sma200 && sma200 > 0) ? round((price / sma200 - 1) * 100, 2) : null,
    kalmanVel:    kalman ? kalman.vel     : null,
    kalmanPt:     kalman ? kalman.pt      : null,
    kalmanInnovZ: kalman ? kalman.innovZ  : null,
    kalmanVelConf:kalman ? kalman.velConf : null,
    kalmanScale:  kalman ? kalman.scale   : null,
  };
}

// v50.53 2B: 서버 팩터 백테스트 — 수집한 1년 일별 종가로 횡단면(cross-sectional) 검증.
//   끝(today)에서 N일 전 리밸 시점마다 전 종목을 팩터로 랭크 → forward 21일 수익률과의 Spearman IC,
//   종합 랭크 상-하위 분위 스프레드, 방향 적중률. 누적 대기 불요(enrich 시점 1패스 계산).
function _spearman(xs, ys) {
  var n = xs.length; if (n < 3 || ys.length !== n) return null;
  function ranks(a) { var idx = a.map(function(v, i){ return [v, i]; }); idx.sort(function(p, q){ return p[0] - q[0]; }); var r = new Array(n); for (var k = 0; k < n; k++) r[idx[k][1]] = k + 1; return r; }
  var rx = ranks(xs), ry = ranks(ys), d2 = 0;
  for (var i = 0; i < n; i++) { var d = rx[i] - ry[i]; d2 += d * d; }
  return 1 - (6 * d2) / (n * (n * n - 1));
}
// v52.50/WO-3: opts.offsets/opts.fwdDays는 선택적 override — 생략 시 기존 6개월 프로덕션
// 리밸런스 세트+21일 forward 그대로(호출부 무변화, 하위호환). scripts/backtest-factors-longrun.mjs가
// 수년치 데이터로 훨씬 많은 리밸런스 시점을 넘겨 이 동일 포뮬러를 재사용한다(로직 복제 방지).
export function backtestFactors(stockData, opts) {
  opts = opts || {};
  var OFFSETS = opts.offsets || [147, 126, 105, 84, 63, 42], FWD = opts.fwdDays || 21;     // 끝에서 N일 전 리밸 시점들
  var isNum = function(v){ return typeof v === 'number' && isFinite(v); };
  // v51.91 P586/C2: this backtest validates a *fixed* 4-factor subset, not the live ranking model
  // (js/aio-data.js:_aioComputeFactorRanks), which uses 7 factors with regime-adaptive weights
  // (_aioFactorWeights: NEUTRAL/RISK_OFF/RISK_ON, lerp-blended by current market risk score). The
  // UI previously implied "종합 랭크가 검증 기반" (the live composite rank is what's validated) —
  // that was not accurate. What IS validated here: momentum/trend/lowvol/kalman, always at the
  // live model's NEUTRAL-regime weights (never risk-off/risk-on), because this script has no
  // access to the live market-state signal that drives the regime blend.
  //   size/value/quality are excluded — not because they don't matter, but because backtesting
  //   them here would either be infeasible or methodologically unsound with data this pipeline
  //   actually has: size needs historical shares-outstanding (not fetched anywhere — mcap is a
  //   hand-maintained static seed in SCREENER_DB, not a live time series); value/quality come from
  //   FMP as today-only TTM snapshots (fetch-data.mjs:enrichFundamentals), so scoring a rebalance
  //   147 days ago with today's P/E/ROE would be look-ahead bias — using information that wasn't
  //   actually available at that date. Do not add them without solving those two problems first.
  //   Weights below are the live NEUTRAL constant's momentum/trend/lowvol/kalman entries
  //   (.27/.20/.16/.10, subset sum .73), renormalized to sum to 1 over just this subset — a single
  //   source of truth instead of an independently hand-picked second weight set (see P584/C1 for
  //   why two independent copies of the same "thing" drift apart over time).
  var COMP_W = { mom: 0.370, trend: 0.274, lowvol: 0.219, kalman: 0.137 };
  var EXCLUDED_FACTORS = ['size', 'value', 'quality'];
  var EXCLUDED_FACTORS_REASON = 'size needs historical shares-outstanding data this pipeline does not fetch; value/quality are FMP today-only TTM snapshots with no historical time series, so backtesting them would use look-ahead information';
  var IC_FACTORS = ['momentum','trend','lowvol','kalman','composite'];
  var icS = {}, icN = {};
  // v52.50/WO-3: per-rebalance-date IC list (additive, existing icS/icN mean-only output unchanged) —
  // needed to compute ICIR (mean IC / stddev IC across dates) and its t-stat/CI, which Codex's WO-3
  // gate asks for explicitly and which a single averaged IC number cannot support.
  var icByDate = {};
  IC_FACTORS.forEach(function(k){ icS[k]=0; icN[k]=0; icByDate[k]=[]; });
  var spreadSum = 0, spreadN = 0, hit = 0, hitN = 0;
  function rank01(vals) { // 값→0..1 percentile(null=0.5)
    var idx = vals.map(function(v, i){ return [v, i]; }).filter(function(p){ return isNum(p[0]); });
    idx.sort(function(a, b){ return a[0] - b[0]; });
    var out = vals.map(function(){ return 0.5; });
    idx.forEach(function(p, r){ out[p[1]] = idx.length > 1 ? r / (idx.length - 1) : 0.5; });
    return out;
  }
  OFFSETS.forEach(function(off) {
    var rows = [];
    stockData.forEach(function(s) {
      // v51.91 P587/R265/C6: prefer adjusted close for return-based factor scoring (see
      // _enrichPriceFactors) — falls back to raw close if adjCloses is absent/mismatched length.
      var c = (s.adjCloses && s.adjCloses.length === s.closes.length) ? s.adjCloses : s.closes;
      if (!c || c.length < off + 1) return;
      var p = c.length - off; if (p < 63 || p + FWD > c.length - 1) return;
      var f = closesToFactors(c.slice(0, p + 1)); if (!f) return;
      var fwd = (c[p] > 0) ? (c[p + FWD] / c[p] - 1) : null; if (!isNum(fwd)) return;
      // 모멘텀: 1M(40%)+3M(40%)+6M(20%) — 6M은 추세(trend)와 중복 크므로 가중 축소
      var momParts = [
        isNum(f.ret1m) ? { v: f.ret1m, w: 0.4 } : null,
        isNum(f.ret3m) ? { v: f.ret3m, w: 0.4 } : null,
        isNum(f.ret6m) ? { v: f.ret6m, w: 0.2 } : null,
      ].filter(Boolean);
      var momSum = momParts.reduce(function(s,p){return s+p.w;},0);
      var mom = momParts.length ? momParts.reduce(function(s,p){return s+p.v*p.w;},0)/momSum : null;
      var tr = [f.pctSma50, f.pctSma200].filter(isNum); tr = tr.length ? _mean(tr) : null;
      var kalman = isNum(f.kalmanVelConf) ? f.kalmanVelConf : (isNum(f.kalmanVel) ? f.kalmanVel : null);
      rows.push({ mom: mom, trend: tr, lowvol: isNum(f.vol) ? -f.vol : null, kalman: kalman, fwd: fwd });
    });
    if (rows.length < 10) return;
    // 단일 팩터 Spearman IC
    [['mom','momentum'], ['trend','trend'], ['lowvol','lowvol'], ['kalman','kalman']].forEach(function(pair) {
      var ps = rows.filter(function(r){ return isNum(r[pair[0]]); });
      if (ps.length < 10) return;
      var ic = _spearman(ps.map(function(r){ return r[pair[0]]; }), ps.map(function(r){ return r.fwd; }));
      if (isNum(ic)) { icS[pair[1]] += ic; icN[pair[1]]++; icByDate[pair[1]].push(ic); }
    });
    // 복합 팩터: 라이브 가중과 동기화된 percentile 가중합
    var rm  = rank01(rows.map(function(r){ return r.mom; }));
    var rt  = rank01(rows.map(function(r){ return r.trend; }));
    var rl  = rank01(rows.map(function(r){ return r.lowvol; }));
    var rk  = rank01(rows.map(function(r){ return r.kalman; }));
    rows.forEach(function(r, i){
      var wTotal = COMP_W.mom + COMP_W.trend + COMP_W.lowvol
                 + (isNum(r.kalman) ? COMP_W.kalman : 0);
      r.comp = (COMP_W.mom * rm[i] + COMP_W.trend * rt[i] + COMP_W.lowvol * rl[i]
               + (isNum(r.kalman) ? COMP_W.kalman * rk[i] : 0)) / wTotal;
    });
    var icC = _spearman(rows.map(function(r){ return r.comp; }), rows.map(function(r){ return r.fwd; }));
    if (isNum(icC)) { icS.composite += icC; icN.composite++; icByDate.composite.push(icC); }
    // 상하위 20% 분위 스프레드 & 방향 적중률
    var sorted = rows.slice().sort(function(a, b){ return a.comp - b.comp; });
    var q = Math.max(1, Math.floor(sorted.length / 5));
    var botM = _mean(sorted.slice(0, q).map(function(r){ return r.fwd; }));
    var topM = _mean(sorted.slice(-q).map(function(r){ return r.fwd; }));
    if (isNum(topM) && isNum(botM)) { spreadSum += (topM - botM); spreadN++; hitN++; if (topM > botM) hit++; }
  });
  var ic = {}; IC_FACTORS.forEach(function(k){ ic[k] = icN[k] ? round(icS[k] / icN[k], 3) : null; });
  return {
    asOf: new Date().toISOString(), fwdDays: FWD, dates: spreadN,
    n: stockData.filter(function(s){ return s.closes && s.closes.length >= 148; }).length,
    ic: ic,
    icByDate: icByDate,
    quantileSpread: spreadN ? round(spreadSum / spreadN * 100, 2) : null,
    hitRate: hitN ? round(hit / hitN * 100, 1) : null,
    compWeights: COMP_W,
    weightRegime: 'NEUTRAL',
    excludedFactors: EXCLUDED_FACTORS,
    excludedFactorsReason: EXCLUDED_FACTORS_REASON,
    kalmanScale: 'log_pct_day',
  };
}

// v51.91 P586/C2: append each backtest run's IC/spread/hitRate to a small time series so drift
// (or a broken factor silently going to IC~0) is visible across runs instead of being overwritten
// every 6h with no history. Separate file from history.json (daily market data, different
// producer/cadence) to avoid entangling two independently-working accumulation paths.
const BACKTEST_HIST = `${__dir}/../public-data/backtest-history.json`;
async function updateBacktestHistory(backtest) {
  if (!backtest || !backtest.ic) return null;
  try {
    let hist = [];
    try { const raw = JSON.parse(await readFile(BACKTEST_HIST, 'utf8')); if (Array.isArray(raw)) hist = raw; } catch { /* 최초 실행 */ }
    const today = new Date().toISOString().slice(0, 10);
    const rec = {
      date: today,
      asOf: backtest.asOf,
      n: backtest.n,
      dates: backtest.dates,
      ic: backtest.ic,
      quantileSpread: backtest.quantileSpread,
      hitRate: backtest.hitRate,
      weightRegime: backtest.weightRegime,
    };
    const idx = hist.findIndex((h) => h && h.date === today);
    if (idx >= 0) hist[idx] = rec; else hist.push(rec);   // 같은 날 재실행 = upsert(최신 실행 우선)
    hist.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (hist.length > 180) hist = hist.slice(hist.length - 180);   // ~6개월 cap (일 단위)
    await writeFile(BACKTEST_HIST, JSON.stringify(hist));
    return { days: hist.length, today, upsert: idx >= 0 ? 'update' : 'append' };
  } catch (e) {
    console.warn('[fetch-data] backtest history 갱신 실패(무시):', e && e.message || e);
    return null;
  }
}

// v50.54 3B/3C: FMP 밸류/퀄리티/어닝 enrichment — process.env.FMP_API_KEY 있을 때만(유료 티어 권장).
//   per-symbol ratios-ttm(PE/PB/EV-EBITDA/ROE/마진) + financial-growth(매출성장) + earnings-surprises(EPS 서프라이즈).
//   KR(.KS/.KQ)은 FMP 미지원 → 제외. 키 없으면 null(클라 4팩터 폴백·무회귀).
const _fmpSym = (s) => s.replace(/^([A-Z]+)\.([A-Z])$/, '$1-$2');
async function enrichFundamentals(syms) {
  const key = process.env.FMP_API_KEY;
  if (!key) return { data: null, hasKey: false, ok: 0, total: 0, planError: false };
  const base = 'https://financialmodelingprep.com/api/v3';
  const us = syms.filter(s => !/\.(KS|KQ)$/i.test(s));
  const out = {};
  let ok = 0;
  let planError = false; // HTTP 403/401 = 플랜 미지원 또는 키 무효

  // 첫 심볼로 플랜/키 유효성 선진단 (전체 실행 전에 문제 조기 감지)
  const diagSym = encodeURIComponent(_fmpSym(us[0] || 'AAPL'));
  try {
    const diagR = await fetchJSON(`${base}/ratios-ttm/${diagSym}?apikey=${key}`, {}, 1);
    if (Array.isArray(diagR) && diagR.length === 0) {
      console.warn(`[fetch-data] FMP 선진단: ratios-ttm 응답 빈 배열 — 플랜 미지원 가능성. 심볼: ${us[0]}`);
    }
  } catch (e) {
    const msg = e && e.message || String(e);
    if (/HTTP 4(0[13])/.test(msg)) {
      planError = true;
      console.warn(`[fetch-data] FMP 키 오류 또는 플랜 불충분: ${msg}`);
      console.warn('[fetch-data] FMP ratios-ttm/financial-growth는 Starter 플랜($14.99/월) 이상 필요. 무료 키는 이 엔드포인트를 지원하지 않습니다.');
      console.warn('[fetch-data] GitHub Secret 이름이 FMP_API_KEY 인지 확인하세요.');
      return { data: null, hasKey: true, ok: 0, total: us.length, planError: true };
    }
    console.warn(`[fetch-data] FMP 선진단 실패: ${msg} — 계속 진행`);
  }

  await mapLimit(us, 4, async (sym) => {
    const s = encodeURIComponent(_fmpSym(sym));
    try {
      const fmpFetch = (endpoint) =>
        fetchJSON(`${base}/${endpoint}?apikey=${key}`, {}, 1)
          .catch(e => { console.warn(`[fetch-data] FMP ${sym} ${endpoint}: ${e && e.message}`); return null; });
      const [ratios, growth, earn] = await Promise.all([
        fmpFetch(`ratios-ttm/${s}`),
        fmpFetch(`financial-growth/${s}?period=annual&limit=1`),
        fmpFetch(`earnings-surprises/${s}`),
      ]);
      const r = Array.isArray(ratios) ? ratios[0] : null;
      const g = Array.isArray(growth) ? growth[0] : null;
      const e = Array.isArray(earn) ? earn[0] : null;
      const rec = {};
      if (r) {
        if (typeof r.peRatioTTM === 'number' && r.peRatioTTM > 0) rec.pe = round(r.peRatioTTM, 2);
        if (typeof r.priceToBookRatioTTM === 'number' && r.priceToBookRatioTTM > 0) rec.pb = round(r.priceToBookRatioTTM, 2);
        if (typeof r.enterpriseValueMultipleTTM === 'number' && r.enterpriseValueMultipleTTM > 0) rec.evEbitda = round(r.enterpriseValueMultipleTTM, 2);
        if (typeof r.returnOnEquityTTM === 'number') rec.roe = round(r.returnOnEquityTTM * 100, 1);
        if (typeof r.netProfitMarginTTM === 'number') rec.margin = round(r.netProfitMarginTTM * 100, 1);
      }
      if (g && typeof g.revenueGrowth === 'number') rec.revGrowth = round(g.revenueGrowth * 100, 1);
      if (e && typeof e.actualEarningResult === 'number' && typeof e.estimatedEarning === 'number' && e.estimatedEarning !== 0) {
        rec.epsSurprise = round((e.actualEarningResult - e.estimatedEarning) / Math.abs(e.estimatedEarning) * 100, 1);
      }
      if (Object.keys(rec).length) { out[sym] = rec; ok++; }
    } catch (e) { console.warn(`[fetch-data] FMP ${sym} 처리 오류:`, e && e.message); }
  });
  console.log(`[fetch-data] FMP fundamentals: ${ok}/${us.length} 심볼 enriched`);
  if (ok === 0 && us.length > 0) {
    console.warn('[fetch-data] FMP enrichment 0건 — 키 유효하나 플랜 미지원이거나 네트워크 오류일 수 있습니다.');
  }
  return { data: out, hasKey: true, ok, total: us.length, planError: false };
}

async function enrichSecFundamentals(syms, priceData) {
  try {
    const payload = JSON.parse(await readFile(SEC_FUNDAMENTALS_OUT, 'utf8'));
    const rows = payload && payload.data || {};
    const out = {};
    let available = 0;
    const maxFetchAge = 45 * 86400000;
    for (const sym of syms) {
      const row = rows[sym];
      if (!row || !row.fetchedAt || Date.now() - new Date(row.fetchedAt).getTime() > maxFetchAge) continue;
      const rec = {};
      ['pe','pb','roe','margin','revGrowth'].forEach(key => {
        if (typeof row[key] === 'number' && Number.isFinite(row[key])) rec[key] = row[key];
      });
      if (!Object.keys(rec).length) continue;
      Object.assign(rec, {
        fundamentalSource: 'SEC EDGAR companyfacts',
        fundamentalModel: row.model || payload.model || 'sec-fy-normalized-v1',
        fundamentalPeriod: row.periodType || 'FY',
        fundamentalObservedAt: row.observedAt || null,
        fundamentalFiledAt: row.filedAt || null,
        fundamentalFetchedAt: row.fetchedAt,
        fundamentalAccession: row.accession || null
      });
      out[sym] = rec;
      available++;
    }
    return { data: out, ok: available, stored: Object.keys(rows).length, generatedAt: payload.generatedAt || null, source: payload.source || 'SEC EDGAR companyfacts' };
  } catch (error) {
    return { data: {}, ok: 0, stored: 0, generatedAt: null, source: 'SEC EDGAR companyfacts', error: String(error && error.message || error) };
  }
}

// v51.68: VCP (Volatility Contraction Pattern) 서버 사이드 계산 — aio-core.js _calcVCP 대응
function _calcVCPServer(closes, highs, lows, volumes) {
  const n = closes.length;
  if (n < 60) return null;
  function sma(arr, p) {
    if (arr.length < p) return null;
    let s = 0; for (let i = arr.length - p; i < arr.length; i++) s += arr[i]; return s / p;
  }
  function avg(arr) { return arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0; }
  const price = closes[n - 1];
  const s50 = sma(closes, 50), s150 = sma(closes, 150), s200 = sma(closes, 200);
  const lk52 = Math.min(252, n);
  const h52 = highs.slice(n - lk52).reduce((m, v) => v > m ? v : m, 0);
  const pct52 = h52 > 0 ? (price - h52) / h52 * 100 : null;
  const stage2 = !!(s50 && s150 && s200 && price > s150 && s150 > s200 && price > s50 && pct52 !== null && pct52 >= -30);
  const bLen = Math.min(65, n - 10);
  const bH = highs.slice(n - bLen), bL = lows.slice(n - bLen), bV = volumes.slice(n - bLen);
  const N = 4; const swH = [], swL = [];
  for (let i = N; i < bH.length - N; i++) {
    let h = true, l = true;
    for (let j = i - N; j <= i + N; j++) {
      if (j === i) continue;
      if (bH[j] >= bH[i]) h = false;
      if (bL[j] <= bL[i]) l = false;
    }
    if (h) swH.push({ idx: i, p: bH[i] });
    if (l) swL.push({ idx: i, p: bL[i] });
  }
  const ctrs = [];
  for (let hi = 0; hi < swH.length; hi++) {
    let nl = null;
    for (let li = 0; li < swL.length; li++) { if (swL[li].idx > swH[hi].idx) { nl = swL[li]; break; } }
    if (!nl) continue;
    const d = (swH[hi].p - nl.p) / swH[hi].p * 100;
    if (d >= 1 && d <= 45) ctrs.push({ depth: Math.round(d * 10) / 10 });
  }
  const cnt = ctrs.length;
  const shrink = cnt >= 2 && ctrs.every((c, i) => i === 0 || ctrs[i].depth < ctrs[i - 1].depth);
  let volDry = false;
  if (bV.length >= 20) {
    const half = Math.floor(bV.length / 2);
    const fv = bV.slice(0, half).filter(v => v > 0);
    const sv = bV.slice(half).filter(v => v > 0);
    const fa = avg(fv), sa = avg(sv);
    volDry = fa > 0 && sa > 0 && sa < fa * 0.85;
  }
  let pivot = null;
  const recSH = swH.filter(sh => sh.idx >= bH.length - 25);
  if (recSH.length) pivot = recSH[recSH.length - 1].p;
  else if (swH.length) pivot = swH[swH.length - 1].p;
  const nearPivot = !!(pivot && price >= pivot * 0.97 && price <= pivot * 1.03);
  const lv = volumes[n - 1];
  const vs = volumes.slice(-21, -1).filter(v => v > 0);
  const rvol = (vs.length >= 10 && lv > 0) ? lv / avg(vs) : null;
  const brk = !!(pivot && price > pivot && rvol !== null && rvol > 1.4);
  let score = 0;
  if (stage2)    score += 25;
  if (cnt >= 2)  score += Math.min(20, cnt * 7);
  if (shrink)    score += 20;
  if (volDry)    score += 15;
  if (nearPivot) score += 10;
  if (brk)       score += 10;
  score = Math.min(100, Math.round(score));
  const vcpStage = !stage2 ? 'not_stage2' : brk ? 'breakout' : nearPivot ? 'near_pivot' : (cnt >= 2 && shrink) ? 'contracting' : cnt >= 1 ? 'basing' : 'stage2_only';
  return { vcpScore: score, vcpStage, pivotLevel: pivot,
           contractionCount: cnt, isShrinking: shrink, volumeDrying: volDry,
           pctFrom52wHigh: pct52 !== null ? Math.round(pct52 * 10) / 10 : null };
}

// Phase 1: 심볼 배열 → 1y 가격 이력 fetch + 팩터 계산. results 배열은 backtest에 재사용.
async function _enrichPriceFactors(syms) {
  const results = await mapLimit(syms, 5, async (sym) => {
    const rows = await fetchHistory(_yhSym(sym), '1y');
    return {
      sym,
      closes:    (rows || []).map(r => r.close),
      // v51.91 P587/R265/C6: separate adjusted-close series for return/momentum/trend/RSI/kalman
      // factor math (see fetchHistory) — raw `closes`/`highs`/`lows`/`volumes` stay untouched for
      // VCP pattern recognition below, which is about price *structure* (swing highs/lows,
      // contraction depth), not total return, and mixing an adjusted close into an otherwise-raw
      // OHLC set would distort swing-depth math against the un-adjusted high/low bars.
      adjCloses: (rows || []).map(r => (typeof r.adjClose === 'number' ? r.adjClose : r.close)),
      highs:     (rows || []).map(r => r.high   || r.close),
      lows:      (rows || []).map(r => r.low    || r.close),
      volumes:   (rows || []).map(r => r.volume || 0),
      observedAt:(rows && rows.length && rows[rows.length - 1].observedAt) || null,
    };
  });
  const data = {};
  let ok = 0;
  for (const r of results) {
    if (!r || r.__error || !r.closes) continue;
    const f = closesToFactors(r.adjCloses && r.adjCloses.length === r.closes.length ? r.adjCloses : r.closes);
    if (f) {
      // v51.68: VCP 패턴 인식 — OHLCV 60봉 이상일 때 계산 (raw close, 조정종가 아님 — 위 주석 참조)
      if (r.closes.length >= 60 && r.highs && r.lows && r.volumes) {
        const vcp = _calcVCPServer(r.closes, r.highs, r.lows, r.volumes);
        if (vcp) { f.vcpScore = vcp.vcpScore; f.vcpStage = vcp.vcpStage; f.vcpPivot = vcp.pivotLevel; }
      }
      f.observedAt = r.observedAt;
      f.source = 'Yahoo chart 1y adjusted-close history';
      f.sourceKind = 'delayed-eod';
      f.allowedUse = 'research-relative-ranking-only';
      data[r.sym] = f; ok++;
    }
  }
  return { data, results, ok };
}

// Daily market breadth from the same price history used by the screener factors.
// The former pipeline fetched 800+ histories but left breadth on a manual snapshot/RSP proxy.
// This output is explicitly the AIO screener universe, not official exchange breadth.
export function computeScreenerBreadth(syms, results) {
  const isKr = (sym) => /\.(KS|KQ)$/i.test(String(sym || ''));
  const validRows = (results || []).filter(r => r && !r.__error && Array.isArray(r.adjCloses) && r.adjCloses.length >= 2);
  const pct = (n, d) => d > 0 ? round(n / d * 100, 1) : null;
  const meanLast = (arr, n) => arr.length >= n ? _mean(arr.slice(-n)) : null;

  function buildSegment(id, label, include) {
    const segmentSymbols = (syms || []).filter(include);
    const rows = validRows.filter(r => include(r.sym));
    const counts = { above5:0, eligible5:0, above20:0, eligible20:0, above50:0, eligible50:0, above200:0, eligible200:0 };
    let advances = 0, declines = 0, unchanged = 0;
    let observedAt = null;
    rows.forEach(r => {
      const c = r.adjCloses;
      const last = c[c.length - 1], prev = c[c.length - 2];
      if (last > prev) advances++; else if (last < prev) declines++; else unchanged++;
      [5,20,50,200].forEach(n => {
        const avg = meanLast(c, n);
        if (avg == null || !isFinite(avg)) return;
        counts['eligible' + n]++;
        if (last > avg) counts['above' + n]++;
      });
      if (r.observedAt && (!observedAt || new Date(r.observedAt).getTime() > new Date(observedAt).getTime())) observedAt = r.observedAt;
    });
    const directional = advances + declines;
    return {
      id, label,
      universe: segmentSymbols.length,
      eligible: rows.length,
      coveragePct: pct(rows.length, segmentSymbols.length),
      observedAt,
      above5: pct(counts.above5, counts.eligible5),
      above20: pct(counts.above20, counts.eligible20),
      above50: pct(counts.above50, counts.eligible50),
      above200: pct(counts.above200, counts.eligible200),
      eligibleByWindow: { d5:counts.eligible5, d20:counts.eligible20, d50:counts.eligible50, d200:counts.eligible200 },
      advanceRatio: directional > 0 ? round(advances / directional, 4) : null,
      advances, declines, unchanged,
    };
  }

  return {
    schemaVersion: '1.0',
    source: 'github-actions:yahoo-1y-adjusted-close',
    method: 'unweighted share above trailing adjusted-close SMA; advance ratio excludes unchanged securities',
    decisionScope: 'research/reference; AIO screener universe, not official exchange breadth',
    segments: {
      all: buildSegment('all', 'AIO 전체 스크리너 유니버스', () => true),
      us: buildSegment('us', 'AIO 미국 스크리너 유니버스', sym => !isKr(sym)),
      kr: buildSegment('kr', 'AIO 한국 스크리너 유니버스', sym => isKr(sym)),
    },
  };
}

// Phase 3: 주요 종목 Google News RSS fetch → data[sym].newsMemo 인라인 갱신.
//   prioSyms: 지수/선물/FX/크립토/KR 제외 후 전달. 동시성 3(레이트리밋 방어).
async function _enrichTickerNews(prioSyms, data) {
  const extraSyms = Object.keys(data).filter(s => !prioSyms.includes(s)).slice(0, 60);
  const newsTargets = [...new Set([...prioSyms, ...extraSyms])].slice(0, 90);
  const tickerNewsResults = await mapLimit(newsTargets, 3, async (sym) => {
    const items = await fetchTickerNewsItems(sym, 3);
    return { sym, items };
  });
  let ok = 0;
  for (const nr of tickerNewsResults) {
    if (!nr || nr.__error) continue;
    const memo = _fmtTickerNewsMemo(nr.items);
    if (memo && data[nr.sym]) { data[nr.sym].newsMemo = memo; data[nr.sym].newsTs = Date.now(); ok++; }
  }
  return ok;
}

export async function enrichScreener() {
  // 자가 스로틀: screener.json이 20시간 내면 스킵(일 1회). BACKFILL/SCREENER_ENRICH=1로 강제.
  if (process.env.SCREENER_ENRICH !== '1' && process.env.BACKFILL !== '1') {
    try {
      const prev = JSON.parse(await readFile(SCREENER_OUT, 'utf8'));
      if (prev && prev.asOf && (Date.now() - new Date(prev.asOf).getTime()) < 6 * 3600 * 1000) {
        return { skipped: true, count: Object.keys(prev.data || {}).length };
      }
    } catch { /* 최초 실행 */ }
  }
  const syms = await getScreenerSymbols();
  if (!syms.length) return { skipped: true, count: 0, reason: 'no-symbols' };

  // 1단계: 가격 팩터 계산
  const { data, results, ok } = await _enrichPriceFactors(syms);

  // 2단계: FMP 밸류/퀄리티/어닝 병합(키 있을 때만 — 없으면 4팩터 폴백)
  let fmpResult = { data: null, hasKey: false, ok: 0, total: 0, planError: false };
  try {
    fmpResult = await enrichFundamentals(syms);
    if (fmpResult && fmpResult.data) {
      for (const sym in fmpResult.data) {
        if (data[sym]) Object.assign(data[sym], fmpResult.data[sym]);
        else data[sym] = fmpResult.data[sym];
      }
    }
  } catch (e) { console.warn('[fetch-data] fundamentals 병합 실패(무시):', e && e.message || e); }

  // 3단계: 무료 공식 SEC annual facts를 FMP 결측 필드에 병합.
  // SEC는 annual filing facts이고 FMP는 TTM이므로 서로 같은 모델처럼 섞지 않는다.
  const secResult = await enrichSecFundamentals(syms, data);
  for (const sym in secResult.data) {
    if (!data[sym]) data[sym] = {};
    const sec = secResult.data[sym];
    ['pe','pb','roe','margin','revGrowth'].forEach(key => {
      if (typeof data[sym][key] !== 'number' && typeof sec[key] === 'number') data[sym][key] = sec[key];
    });
    if (!data[sym].fundamentalSource) {
      ['fundamentalSource','fundamentalModel','fundamentalPeriod','fundamentalObservedAt','fundamentalFiledAt','fundamentalFetchedAt','fundamentalAccession'].forEach(key => {
        if (sec[key] != null) data[sym][key] = sec[key];
      });
    }
  }

  // 4단계: 개별 종목 뉴스 메모 (지수/선물/FX/크립토/KR 제외)
  const prioSyms = SYMBOLS.filter(s => !/^\^|=F$|=X$|-USD$|\.KS$|\.KQ$/i.test(s));
  let tickerNewsOk = 0;
  try { tickerNewsOk = await _enrichTickerNews(prioSyms, data); }
  catch (e) { console.warn('[fetch-data] ticker news 실패(무시):', e && e.message || e); }
  console.log(`[fetch-data] ticker news: ${tickerNewsOk}종목 뉴스 메모 수집`);

  // 5단계: 횡단면 팩터 백테스트(closes 재사용 — 1패스)
  let backtest = null;
  try { backtest = backtestFactors(results.filter(r => r && r.closes && r.closes.length >= 148)); }
  catch (e) { console.warn('[fetch-data] backtest 실패(무시):', e && e.message || e); }
  const breadth = computeScreenerBreadth(syms, results);
  const usUniverse = syms.filter(s => !/\.(KS|KQ)$/i.test(s)).length;
  const fundamentalCount = syms.filter(sym => {
    const row = data[sym] || {};
    return ['pe','pb','roe','margin','revGrowth'].some(key => typeof row[key] === 'number' && Number.isFinite(row[key]));
  }).length;
  const fundamentalCoveragePct = usUniverse ? round(fundamentalCount / usUniverse * 100, 1) : 0;

  // v51.91 P586/C2: IC/spread/hitRate 시계열 누적(별도 아티팩트) — 매 실행 덮어쓰기로 드리프트가
  // 안 보이던 문제 시정. screener.json 자체는 계속 최신 1개 스냅샷만 유지(기존 소비자 영향 없음).
  let backtestHistInfo = null;
  try { backtestHistInfo = await updateBacktestHistory(backtest); }
  catch (e) { console.warn('[fetch-data] backtest history 실패(무시):', e && e.message || e); }
  if (backtestHistInfo) console.log(`[fetch-data] backtest history: ${backtestHistInfo.days}일 누적 (${backtestHistInfo.upsert})`);

  // P715 (사용자 결정 "클라이언트 직접 fetch 전환"의 스크리너 축): 공개 아티팩트에서 종목별
  // 원시 현재가를 재배포하지 않는다 — 파생 지표(수익률/RSI/SMA대비%/kalman/VCP)만 공개한다.
  // 내부 계산(breadth/backtest)은 위에서 이미 closes를 소비했고, 클라이언트 현재가 컬럼은
  // data-live-price 라이브 갱신 경로로만 채워진다(미커버 종목은 '—').
  for (const sym in data) { if (data[sym] && 'price' in data[sym]) delete data[sym].price; }

  const payload = {
    asOf: new Date().toISOString(),
    factorObservedAt: breadth.segments.all.observedAt,
    source: 'github-actions:yahoo-1y',
    universe: syms.length,
    ok,
    fmpHasKey: fmpResult.hasKey,
    fmpOk: fmpResult.ok > 0,
    fmpCount: fmpResult.ok,
    fmpPlanError: fmpResult.planError,
    secFundamentalsOk: secResult.ok > 0,
    secFundamentalsCount: secResult.ok,
    secFundamentalsStored: secResult.stored,
    secFundamentalsGeneratedAt: secResult.generatedAt,
    fundamentalCount,
    fundamentalCoveragePct,
    fundamentalCoverageDenominator: usUniverse,
    fundamentalModels: ['fmp-ttm', 'sec-fy-normalized-v1'],
    breadth,
    rankingContract: {
      allowedUse: 'research-relative-ranking-only',
      tradingSignal: false,
      predictiveValidation: 'not-established',
      liveModelParity: false,
      reason: 'long-run composite IC is not positive/stable; backtest covers only fixed NEUTRAL momentum/trend/lowvol/kalman subset and excludes live adaptive weights',
      evidenceArtifact: 'public-data/factor-backtest-longrun.json'
    },
    data,
    backtest,
  };
  await writeFile(SCREENER_OUT, JSON.stringify(payload));
  return { count: ok, universe: syms.length, asOf: payload.asOf, backtestIC: backtest && backtest.ic && backtest.ic.composite, tickerNews: tickerNewsOk, fmpOk: fmpResult.ok > 0, fmpCount: fmpResult.ok, fmpHasKey: fmpResult.hasKey, fmpPlanError: fmpResult.planError, secFundamentalsOk: secResult.ok > 0, secFundamentalsCount: secResult.ok, fundamentalCount, fundamentalCoveragePct };
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

  let previousBls = null;
  try {
    const previous = JSON.parse(await readFile(OUT, 'utf8'));
    previousBls = previous && previous.macro && previous.macro._bls || null;
  } catch (_) {}

  const [quotesRaw, macro, fearGreed, news, putCall, bls] = await Promise.all([
    mapLimit(SYMBOLS, 6, fetchQuote),
    fetchFred(process.env.FRED_API_KEY),
    fetchFearGreed(),
    fetchNews(),
    fetchCboePutCall(),
    fetchBlsSeries(previousBls),
  ]);
  Object.assign(macro, bls.values || {});
  macro._bls = bls;

  // v50.99: 검증 패스 — 의심 항목 재시도 후 최종 확정
  const pass1 = quotesRaw.filter(q => _quoteOk(q));
  const toRetry = quotesRaw.filter(q => !_quoteOk(q)).map(q => q && q.symbol ? q.symbol : (q && q.item)).filter(Boolean);
  let pass2 = [];
  if (toRetry.length) {
    console.log(`[fetch-data] verify-retry: ${toRetry.length}개 재시도 (에러 또는 비정상 변동폭): ${toRetry.join(',')}`);
    const retried = await mapLimit(toRetry, 3, sym => fetchQuote(sym).catch(() => ({ __error: true, item: sym })));
    pass2 = retried.filter(q => _quoteOk(q));
    console.log(`[fetch-data] verify-result: ${pass2.length}/${toRetry.length} 복구`);
  }
  // v51.92/Phase 2 [B1]: Yahoo가 (호스트 폴백 + verify-retry까지) 전부 실패한 핵심 ETF에
  // 한해 Twelve Data로 2차 폴백. TWELVE_DATA_API_KEY 미등록 시 완전 무동작(FRED/FMP와 동일 패턴).
  const yahooFailed = toRetry.filter(s => !pass2.find(q => q && q.symbol === s));
  const tdApiKey = process.env.TWELVE_DATA_API_KEY;
  const tdEligible = yahooFailed.filter(s => TWELVE_DATA_ETF_FALLBACK_SYMBOLS.has(s));
  let pass3 = [];
  if (tdApiKey && tdEligible.length) {
    console.log(`[fetch-data] twelvedata-fallback: ${tdEligible.length}개 시도 (Yahoo 전부 실패한 핵심 ETF): ${tdEligible.join(',')}`);
    const tdResults = await mapLimit(tdEligible, 3, sym => fetchQuoteTwelveData(sym, tdApiKey).catch(e => ({ __error: true, item: sym, msg: String(e && e.message || e) })));
    pass3 = tdResults.filter(q => _quoteOk(q));
    console.log(`[fetch-data] twelvedata-result: ${pass3.length}/${tdEligible.length} 복구`);
  } else if (!tdApiKey && yahooFailed.length) {
    console.warn('[fetch-data] 경고: TWELVE_DATA_API_KEY GitHub Secret 미등록 — 핵심 ETF Yahoo 실패 시 2차 폴백 비활성.');
  }

  const quotes = [...pass1, ...pass2, ...pass3];
  const failed = yahooFailed.filter(s => !pass3.find(q => q && q.symbol === s));

  // v50.24/WO-1: F&G·FRED 실패를 meta에 노출(이전엔 조용히 통과). 사이트 나이 배지/감사가 surfacing.
  // v50.78: fredHasKey(Secret 등록 여부) / fredFetchOk(실제 데이터 수신 여부) 세분화.
  //   fredHasKey=false → GitHub Secrets 미등록. fredHasKey=true && fredFetchOk=false → 키 있으나 API 실패.
  const macroKeys = Object.keys(macro).filter(k => k[0] !== '_');
  const fearGreedOk = typeof fearGreed.score === 'number' && isFinite(fearGreed.score);
  const fredHasKey = !!process.env.FRED_API_KEY;
  const fredFetchOk = fredHasKey && macroKeys.length > 0;
  // P565/R256: per-series failures, now tracked instead of silently swallowed (see fetchFred).
  const fredFailedSeries = Array.isArray(macro._failedSeries) ? macro._failedSeries : [];
  const newsScores = Array.isArray(news) ? news.map(n => Number(n.score)).filter(n => isFinite(n)) : [];
  const newsCycle = getKst0800NewsCycle();
  const fredOk = fredFetchOk; // 하위 호환 유지

  const data = {
    meta: {
      generatedAt: new Date().toISOString(),
      source: 'github-actions',
      symbolsOk: quotes.length,
      symbolsFail: failed.length,
      failedSymbols: failed,
      verifyStats: { pass1: pass1.length, retried: toRetry.length, recovered: pass2.length, failed: failed.length },
      tdHasKey: !!tdApiKey,
      tdFallbackEligible: tdEligible.length,
      tdFallbackRecovered: pass3.length,
      fearGreedOk,
      fredHasKey,
      fredFetchOk,
      fredOk,
      macroKeyCount: macroKeys.length,
       fredFailedSeries,
      blsStatus: bls.status,
      blsSeriesCount: Object.keys(bls.values || {}).length,
      blsFailedSeries: (bls.failures || []).map(row => row.metricId),
      blsAttemptedAt: bls.attemptedAt || null,
      blsLastSuccessfulAt: bls.lastSuccessfulAt || null,
      newsOk: Array.isArray(news) && news.length > 0,
      newsCount: Array.isArray(news) ? news.length : 0,
      newsSourceCount: NEWS_FEEDS.length,
      newsCyclePolicy: newsCycle.policy,
      newsCycleStart: newsCycle.start,
      newsCycleEnd: newsCycle.end,
      newsCycleLabel: newsCycle.label,
      newsNextRefresh: newsCycle.nextRefresh,
      serverNewsScored: true,
      newsScoreMin: newsScores.length ? Math.min(...newsScores) : null,
      newsScoreMax: newsScores.length ? Math.max(...newsScores) : null,
      putCallOk: putCall && Number.isFinite(putCall.totalPutCall),
      putCallAsOf: putCall && putCall.asOf || null,
      elapsedMs: Date.now() - t0,
      schema: 1,
    },
    quotes,
    macro,
    fearGreed,
    putCall,
    news,
  };

  // v50.48/Phase 4: 선택적 서버 LLM 분석문 (키 있을 때만; 실패해도 data.json 정상 — 클라 템플릿 폴백)
  const marketAnalysis = await genMarketAnalysis(data);
  if (marketAnalysis) { data.marketAnalysis = marketAnalysis; data.meta.marketAnalysisOk = true; }
  else { data.meta.marketAnalysisOk = false; }

  if (!fearGreedOk) console.warn('[fetch-data] 경고: F&G 수집 실패 (사이트는 정적 폴백 사용)');
  if (!fredHasKey) console.warn('[fetch-data] 경고: FRED_API_KEY GitHub Secret 미등록 — 매크로 서버갱신 비활성. 클라이언트 aio_fred_key로 브릿지 가능.');
  if (fredHasKey && !fredFetchOk) console.warn('[fetch-data] 경고: FRED 키 있으나 매크로 0건 — 키 유효성/레이트리밋 확인');
  // P565/R256: fredFetchOk only requires macroKeys.length > 0, so a partial failure (e.g. 6 of
  // 9 series succeed) previously passed this check silently — the exact mechanism that let
  // individual stale/broken series (Fed/BOJ/BOK/BOE rates) go unnoticed for weeks.
  if (fredHasKey && fredFailedSeries.length > 0) console.warn(`[fetch-data] 경고: FRED 시리즈 ${fredFailedSeries.length}건 실패 — ${fredFailedSeries.join(', ')}`);
  if (!process.env.ANTHROPIC_API_KEY) console.warn('[fetch-data] 경고: ANTHROPIC_API_KEY 미등록 — AI 분석 비활성. 클라이언트 템플릿 폴백 사용.');

  // Fail closed before touching the last-known-good public artifact. A transient
  // provider/network outage must never replace data.json with an empty payload.
  const minimumQuoteCount = Math.ceil(SYMBOLS.length * 0.5);
  if (quotes.length < minimumQuoteCount) {
    throw new Error(`CORE_QUOTE_COVERAGE_FAILED:${quotes.length}/${SYMBOLS.length}; existing data.json preserved`);
  }

  // AR-07 Batch 0: publish the bounded Tier 0 fallback independently of the
  // public data.json quote policy. A failed Tier 0 gate retains the previous
  // snapshot and records the failed attempt in its status sidecar.
  const marketSnapshotInfo = await publishMarketSnapshot({
    quotes,
    attemptedAt: data.meta.generatedAt,
    source: 'github-actions:fetch-data'
  });
  data.meta.marketSnapshotPublished = !!marketSnapshotInfo.published;
  data.meta.marketSnapshotCoverage = marketSnapshotInfo.coverage;
  data.meta.marketSnapshotRevision = marketSnapshotInfo.snapshot.revision;

  await mkdir(dirname(OUT), { recursive: true });
  // P715 (사용자 결정 "클라이언트 직접 fetch 전환"): 공개 data.json에서 종목별 시세 재배포를
  // 중단한다 — quotes는 내부 파생(히스토리 append·분석 프롬프트·건강도 카운트)에만 사용하고
  // 발행 아티팩트에는 빈 배열로 담는다(소비자 배열 형태 계약 보존). meta.symbolsOk는
  // "수집 파이프라인 건강도" 의미로 유지되어 워치독 floor(<70) 계약이 그대로 동작한다.
  // P719: OUT에 쓰는 모든 경로는 반드시 이 헬퍼를 거친다 — 첫 발행 후 meta 후기록 재기록(아래
  // scrInfo 반영)이 스트립 안 된 원본 `data`를 그대로 써서 P715 계약을 덮어쓴 라이브 사고의 재발 방지.
  const toPublicPayload = (d) => ({
    ...d,
    quotes: [],
    meta: { ...d.meta, quotesPublished: false, quotePolicy: 'client-direct-fetch-only(P715)' }
  });
  await writeFile(OUT, JSON.stringify(toPublicPayload(data), null, 1));
  // WO-7 (ops): 일별 히스토리 누적 (충분한 데이터일 때만 — 아래 <50% 가드와 별개로 핵심 심볼 존재 시)
  const histInfo = await updateHistory(data);
  // Phase 3 [C3] P599: computeTradingScore 재구성 검증 하네스 — history.json이 방금 갱신됐으니
  // 그 최신 상태로 재실행(순수 함수, 네트워크 호출 없음, history.json만 읽고 자체 산출물에만 씀).
  let scoreBacktestInfo = null;
  try { scoreBacktestInfo = await runTradingScoreBacktest(HIST, `${__dir}/../public-data/score-backtest-history.json`); }
  catch (e) { console.warn('[fetch-data] trading-score backtest 실패(무시):', e && e.message || e); }
  if (scoreBacktestInfo) console.log(`[fetch-data] score backtest: ${scoreBacktestInfo.records.length}건 누적, summary=${JSON.stringify(scoreBacktestInfo.summary)}`);
  // Screener is a separate six-hour workflow. The 30-minute core job never
  // downloads 870 one-year histories or writes screener.json.
  let scrInfo = null;
  try {
    const existing = JSON.parse(await readFile(SCREENER_OUT, 'utf8'));
    scrInfo = {
      skipped: true,
      count: Object.keys(existing.data || {}).length,
      universe: existing.universe || 0,
      fmpHasKey: existing.fmpHasKey,
      fmpOk: existing.fmpOk,
      fmpCount: existing.fmpCount || 0,
      fmpPlanError: existing.fmpPlanError,
      secFundamentalsOk: existing.secFundamentalsOk,
      secFundamentalsCount: existing.secFundamentalsCount || 0,
      fundamentalCoveragePct: existing.fundamentalCoveragePct || 0
    };
  } catch (e) { console.warn('[fetch-data] 기존 screener 상태 읽기 실패:', e && e.message || e); }

  // FMP 상태를 data.meta에 후기록 (screener 실행 결과 반영)
  if (scrInfo && !scrInfo.skipped) {
    data.meta.fmpHasKey = !!scrInfo.fmpHasKey;
    data.meta.fmpOk = !!scrInfo.fmpOk;
    data.meta.fmpCount = scrInfo.fmpCount || 0;
    data.meta.fmpPlanError = !!scrInfo.fmpPlanError;
    if (scrInfo.fmpHasKey && !scrInfo.fmpOk) {
      if (scrInfo.fmpPlanError) console.warn('[fetch-data] FMP: 키 등록됨 → HTTP 403/401 — 플랜이 ratios-ttm을 지원하지 않습니다. Starter($14.99/월) 이상 필요.');
      else console.warn('[fetch-data] FMP: 키 등록됨 → 0건 enriched — API 오류 또는 모든 심볼 실패.');
    }
  } else {
    data.meta.fmpHasKey = !!process.env.FMP_API_KEY;
  }
  if (scrInfo) {
    data.meta.secFundamentalsOk = !!scrInfo.secFundamentalsOk;
    data.meta.secFundamentalsCount = scrInfo.secFundamentalsCount || 0;
    data.meta.fundamentalCoveragePct = scrInfo.fundamentalCoveragePct || 0;
  }
  const reconciliationStatus = await writeReconciliationStatus({ marketSnapshot: marketSnapshotInfo.snapshot });
  await writeOperationsStatus({ data, marketSnapshot: marketSnapshotInfo.snapshot, reconciliation: reconciliationStatus });

  // scrInfo 반영 후 data.json 재기록 (fmpHasKey 등 meta 업데이트) — P719: 반드시 스트립 경유
  await writeFile(OUT, JSON.stringify(toPublicPayload(data), null, 1));

  // P719 read-back 계약 검증: 마지막으로 디스크에 남은 발행본이 P715 계약(quotes=[],
  // quotesPublished:false)을 만족하는지 실제 파일로 확인. 위반이면 커밋 전에 워크플로가 죽는다.
  {
    const published = JSON.parse(await readFile(OUT, 'utf8'));
    if ((Array.isArray(published.quotes) && published.quotes.length > 0) || published.meta?.quotesPublished !== false) {
      throw new Error(`P715_QUOTE_CONTRACT_VIOLATION: published quotes=${published.quotes?.length}, quotesPublished=${published.meta?.quotesPublished}`);
    }
  }

  const fmpSummary = scrInfo && !scrInfo.skipped
    ? `hasKey=${scrInfo.fmpHasKey} ok=${scrInfo.fmpOk} count=${scrInfo.fmpCount || 0}${scrInfo.fmpPlanError ? ' ⚠PLAN_ERROR' : ''}`
    : `hasKey=${!!process.env.FMP_API_KEY} (screener skipped)`;
  console.log(`[fetch-data] 완료: quotes ${quotes.length}/${SYMBOLS.length} [verify: 1차ok=${pass1.length} retry=${toRetry.length} 복구=${pass2.length} 최종실패=${failed.length}], macro keys ${Object.keys(macro).length}, F&G ${fearGreed.score ?? 'fail'}, news ${data.meta.newsCount}, history ${histInfo ? histInfo.days + 'd(' + histInfo.upsert + (histInfo.backfilled ? ',+' + histInfo.backfilled + 'bf' : '') + ')' : 'skip'}, screener ${scrInfo ? (scrInfo.skipped ? 'skip(' + scrInfo.count + ')' : scrInfo.count + '/' + scrInfo.universe + (scrInfo.tickerNews != null ? ' tickerNews=' + scrInfo.tickerNews : '')) : 'n/a'}, FMP ${fmpSummary}, ${data.meta.elapsedMs}ms`);

}

// v52.50/WO-3: direct-run guard (같은 패턴을 이미 backtest-trading-score.mjs 등이 씀) — 이 파일은
// GitHub Actions에서 항상 `node scripts/fetch-data.mjs`로 직접 실행되므로 이 가드는 프로덕션 동작을
// 전혀 바꾸지 않는다(그 경우 이 조건은 항상 참). 다만 이제 closesToFactors/backtestFactors/_mean이
// export돼 있어, 이 가드가 없으면 다른 스크립트가 그 함수만 재사용하려고 import하는 순간 라이브
// fetch 파이프라인 전체(실 네트워크 호출+public-data/*.json 덮어쓰기)가 부작용으로 실행돼버린다.
const __entryArg = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (__entryArg && (import.meta.url === `file://${__entryArg}` || import.meta.url === `file:///${__entryArg}`)) {
  const task = process.env.SCREENER_ONLY === '1' ? enrichScreener() : main();
  task.catch(e => { console.error('[fetch-data] 치명적 오류:', e); process.exit(1); });
}
