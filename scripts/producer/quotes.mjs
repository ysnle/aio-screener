// Yahoo quote plane: the core symbol list, per-symbol quote and daily-history fetch, the quote sanity check, the
// Twelve Data ETF fallback and the CoinGecko cross-check.
// Split out of scripts/fetch-data.mjs (pipeline redesign, 2026-10-19); fetch-data.mjs keeps the run order and re-exports
// every name it exported before.
import { dailyRowsFromYahooChart } from '../../src/domain/screener/price-factors.js';
import { fetchJSON } from '../lib/producer-http.mjs';

// ── 수집 심볼 (v1 핵심셋). 더 넣으려면 배열에 추가만 하면 됨 (배치 처리 자동) ──
export const SYMBOLS = [
  // 미국·글로벌 지수
  '^GSPC','^IXIC','^NDX','^DJI','^RUT','^VIX','^VIX3M','^VVIX','^FTSE','^N225','^HSI',
  // 금리 (Yahoo: ^TNX=10Y, ^TYX=30Y, ^FVX=5Y, ^IRX=13주)
  '^TNX','^TYX','^FVX','^IRX',
  // 원자재·환율 (v50.40: GBPUSD/CNY/AUDUSD 추가 — fxbond 페이지 "—" unavailable 해소, 클라이언트 LIVE_SYMBOLS와 정합)
  'CL=F','BZ=F','GC=F','SI=F','DX-Y.NYB','KRW=X','EURUSD=X','JPY=X','GBPUSD=X','CNY=X','AUDUSD=X',
  // 미국 지수 선물 (2026-10-21: 시황 해석의 증거 계층 — market-snapshot evidenceQuotes. 공개 시세 평면이 아니다, P715)
  'ES=F','NQ=F',
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

// v50.24/WO-1: Yahoo는 두 호스트(query1/query2)를 운영하고 차단/레이트리밋이 호스트마다 다르게
// 걸리는 경우가 잦다. GitHub Actions 러너 IP가 한 호스트에서 막혀도 다른 호스트로 폴백 → 전량 실패
// (= data.json 미갱신)를 줄인다. 2 호스트 × 2 시도 = 최대 4회. 그래도 다 실패하면 throw(해당 심볼만).
const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];

// ── Yahoo v8/chart: 한 심볼의 현재가 + 전일종가 (호스트 폴백 내성) ──
// v51.64 P545: 주말/휴장 수집 시 Yahoo meta.chartPreviousClose가 전주 종가를 반환해
// 주간 변동률이 일간으로 오표시되는 구조적 문제 수정.
// → range=5d OHLCV 배열의 실제 전전일 종가(closes[-2])로 일간 Pct 계산.
//   OHLCV 배열이 2개 미만일 때만 chartPreviousClose로 폴백.
// P1799 (2026-10-15): closes[-2] assumes the last bar is the current session. At the KRX open Yahoo has not printed
// today's bar yet (or prints it with a null close), so closes[-2] was the close two sessions back: 10/15 09:01 KST
// showed KOSPI -5.53% / KOSDAQ -6.24% against the 10/13 close instead of -5.1% / -4.75% against 10/14, and on 10/14
// the -0.44% close read as -5.88%. For Seoul-session quotes the previous close is the last bar dated before the
// session of regularMarketTime (exchange-local dates via meta.gmtoffset).
export function exchangeLocalDate(ms, timeZone) {
  if (!Number.isFinite(ms) || !timeZone) return null;
  try { return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms)); } catch (_) { return null; }
}
// v58.71 (pipeline audit): the same rule for every exchange session (Tokyo, Hong Kong, London opened against two sessions
// back too); continuous futures/FX/DXY/crypto keep the bar-before-last, since their "day" holds the next evening's hours.
const CONTINUOUS_QUOTE = /(=F|=X)$|^DX-Y\.NYB$|-USD$/;
export function previousCloseBarIndex(closeBars, meta, symbol = '') {
  const bars = Array.isArray(closeBars) ? closeBars : [];
  // v58.80 (first-users bundle 1): on a weekend Yahoo already lists Sunday's reopen bar (empty) after Friday's, so the bar
  // before last was Friday itself — DXY 10/23 read -0.06% (Friday's last print against Friday's settle) beside +0.14%
  // close to close on 금리와 환율. A bar opened after the quote's own time is not its session and is skipped.
  if (CONTINUOUS_QUOTE.test(String(symbol || meta?.symbol || '')) || !meta?.exchangeTimezoneName || !Number.isFinite(meta?.regularMarketTime) || !Number.isFinite(meta?.gmtoffset)) {
    const at = Number(meta?.regularMarketTime);
    const current = Number.isFinite(at) ? bars.map((bar) => Number.isFinite(bar.timestamp) && bar.timestamp <= at).lastIndexOf(true) : bars.length - 1;
    return current >= 1 ? current - 1 : -1;
  }
  const localDay = (seconds) => new Date((seconds + meta.gmtoffset) * 1000).toISOString().slice(0, 10);
  const sessionDay = localDay(meta.regularMarketTime);
  return bars.map((bar) => Number.isFinite(bar.timestamp) && localDay(bar.timestamp) < sessionDay).lastIndexOf(true);
}
export async function fetchQuote(symbol) {
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
      // v58.69 (live 2026-10-23): the bars are kept with their empty closes. Dropping them made "the previous bar" two
      // sessions old whenever Yahoo left a day empty — KOSPI 10/23 read −5.75% against the 10/21 close (−2.3% against
      // 10/22), SMH −4.21% against 10/20 (−6.0%), and the published reading said KOSPI fell 5.37% that morning. The
      // previous session is the bar before the current one; when its daily close is empty, its last hourly close is used
      // and marked approximate (history does not record it as a completed close); otherwise the change stays missing.
      const rawCloses = res?.indicators?.quote?.[0]?.close || [];
      const rawTimestamps = res?.timestamp || [];
      const closeBars = rawCloses
        .map((close, index) => ({ close: close != null && isFinite(close) && close > 0 ? close : null, timestamp: rawTimestamps[index] }))
        .filter((bar) => Number.isFinite(bar.timestamp));
      const prevIndex = previousCloseBarIndex(closeBars, m, symbol);
      const prevBar = prevIndex >= 0 ? closeBars[prevIndex] : null;
      let prev, pct, pctSource, previousCloseApproximate = false;
      if (prevBar?.close) {
        prev = prevBar.close;                   // 실제 전일 거래일 종가
        pct  = ((price - prev) / prev) * 100;
        pctSource = 'ohlcv-daily';
      } else if (prevBar && ['INDEX', 'EQUITY', 'ETF'].includes(String(m.instrumentType || '').toUpperCase()) && !/(=F|=X)$|^DX-Y\.NYB$|-USD$/.test(symbol) && !/^\^K[SQ]\d|\.K[SQ]$/.test(symbol)) {
        // Exchange sessions only: a futures/FX/DXY/crypto "day" in exchange time also holds the next session's evening hours
        // (history.mjs continuousReopenPrint), so its last hourly close is the current price.
        // v58.71 (pipeline audit): Seoul is excluded too — its hourly bars miss the closing auction (KOSPI 10/21: 5,703 vs
        // 5,736, −0.6%, history.mjs backfill note), and the approximate mark is not shown, so the change stays missing.
        prev = await hourlyLastClose(host, symbol, exchangeLocalDate(prevBar.timestamp * 1000, m.exchangeTimezoneName), m.exchangeTimezoneName).catch(() => null);
        pct = prev ? ((price - prev) / prev) * 100 : null;
        pctSource = prev ? 'hourly-last-close' : 'previous-session-close-missing';
        previousCloseApproximate = !!prev;
      } else if (prevBar) {
        prev = null; pct = null; pctSource = 'previous-session-close-missing';
      } else {
        // P1581: with range=5d, chartPreviousClose is the close BEFORE the 5-day window, so using it
        // printed a multi-day change as the daily change (the P545 class). Only meta.previousClose is a
        // previous session close; without it the change stays missing.
        prev = (typeof m.previousClose === 'number' && m.previousClose > 0) ? m.previousClose : null;
        pct  = (prev && prev > 0) ? ((price - prev) / prev) * 100 : null;
        pctSource = 'chart-meta-fallback';
      }
      const quote = {
        symbol,
        regularMarketPrice: price,
        regularMarketChangePercent: pct,
        regularMarketPreviousClose: prev,
        chartPreviousClose: prev,
        // P1255 (07:M04 계열 잔여 D5/N1): quote 경로는 조정 개념을 수집하지 않으므로 그 사실을
        // 선언한다 — 이 가격이 배당·분할 중 무엇을 반영하는지는 공급자 관례에 의존하며 미검증이다.
        priceBasis: 'provider-close-adjustment-scope-undeclared',
        // Yahoo daily timestamps mark the bar OPEN, not its close. For an
        // in-session quote the previous completed bar closes at the boundary
        // represented by the current bar's timestamp. Using the previous
        // bar's own timestamp made otherwise-correct previous-close values
        // appear one market day older on WTI/gold/BTC/KR series.
        // P1799: when the current session's bar is not printed yet, its opening boundary is unknown — fail closed (P1095).
        regularMarketPreviousCloseObservedAt: prevIndex >= 0 && Number.isFinite(closeBars[prevIndex + 1]?.timestamp)
          ? new Date(closeBars[prevIndex + 1].timestamp * 1000).toISOString()
          : null,
        // P1192: 위 경계가 이 행의 완료 컷을 넘을 때(진행 중 bar의 개시 시각이 KST-08:00 컷보다
        // 뒤인 창 — FX/상품) 쓸 직전 bar의 개시 경계. 관측 시각이 아니라 bar 경계다.
        previousBarOpenedAt: prevIndex >= 0 && Number.isFinite(closeBars[prevIndex].timestamp)
          ? new Date(closeBars[prevIndex].timestamp * 1000).toISOString()
          : null,
        // v57.70 (2026-10-15 audit): the boundary above is 00:00 ET of the NEXT day for futures/DXY bars, and readers
        // dated the close by that boundary — the 10/12 WTI close sat on 10/13 and the briefing read 0.0% for a day.
        // The previous bar's own trading date, in the exchange's time zone, names the session the close belongs to.
        previousCloseSessionDate: prevIndex >= 0 && Number.isFinite(closeBars[prevIndex].timestamp)
          ? exchangeLocalDate(closeBars[prevIndex].timestamp * 1000, m.exchangeTimezoneName)
          : null,
        _pctSource: pctSource,
        previousCloseApproximate,
        _source: 'live:yahoo-gh',
        // Observation lineage: generatedAt is fetch time, not necessarily market observation time.
        regularMarketTime: Number.isFinite(m.regularMarketTime) ? m.regularMarketTime : null,
        observedAt: Number.isFinite(m.regularMarketTime) ? new Date(m.regularMarketTime * 1000).toISOString() : null,
        fetchedAt: new Date().toISOString(),
        delayedByMs: Number.isFinite(m.regularMarketTime) ? Math.max(0, Date.now() - m.regularMarketTime * 1000) : null,
        delayProvenance: {
          observedField: 'Yahoo chart.meta.regularMarketTime',
          measuredAtField: 'fetch-time Date.now()',
          unit: 'milliseconds',
          method: 'max(0, fetchedAt-observedAt)',
          policyOwner: 'scripts/build-market-snapshot.mjs:deriveMarketSession',
          qualityPolicy: 'provider-observation-is-not-current-without-session-and-delay-gate'
        },
        marketState: m.marketState || null,
        marketSession: m.marketState || null,
        exchangeTimezoneName: m.exchangeTimezoneName || null,
        fullExchangeName: m.fullExchangeName || m.exchangeName || null,
        venue: m.fullExchangeName || m.exchangeName || null,
        currency: m.currency || null,
        source: 'Yahoo chart',
        // Yahoo/TwelveData are public delayed/reference feeds. Their observed
        // timestamp is useful lineage but cannot create a licensed decision
        // grant; session/delay gates remain explicit downstream evidence.
        sourceTier: 'T3_PUBLIC_DELAYED',
        sourceKind: 'T3_PUBLIC_DELAYED',
        allowedUse: 'reference-only',
        allowedUseCeiling: 'reference',
        rightsId: 'PUBLIC_REFERENCE',
        qualityStatus: Number.isFinite(m.regularMarketTime) ? 'CURRENT' : 'MISSING',
        quality: { status: Number.isFinite(m.regularMarketTime) ? 'CURRENT' : 'MISSING', stale: false, decisionUse: false, allowedUse: 'reference' },
      };
      // P1721: on a weekday an FX pair is always in session, so its history row and daily change rest entirely on the
      // previous close. Yahoo's daily FX bars dropped Mon 10/12 and left 10/13 null, so closes[-2] reached back to the
      // Friday 10/9 bar and 10/12-10/13 both recorded 1,342.99 (the screen froze at 10/9). The FX previous close is now
      // the hourly close at the 23:00Z (KST 08:00) cut — the same cut the history row carries. A failed hourly read
      // keeps the daily path above.
      if (/=X$/.test(symbol) && FX_WEEKDAY_SESSION(Date.now())) {
        try {
          const hourly = await fetchJSON(host + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=60m&range=5d', {}, 1);
          const hres = hourly?.chart?.result?.[0];
          const cut = fxCloseAtCut(hres?.timestamp || [], hres?.indicators?.quote?.[0]?.close || [], Date.now());
          if (cut && cut.close > 0) {
            quote.regularMarketPreviousClose = cut.close;
            quote.chartPreviousClose = cut.close;
            quote.regularMarketChangePercent = ((price - cut.close) / cut.close) * 100;
            quote.regularMarketPreviousCloseObservedAt = cut.observedAt;
            quote.previousBarOpenedAt = cut.previousBoundary;
            // P1721 dated the cut close by its own stamp; v57.81 writes that date (New York trading day of the cut, at or
            // before 19:00 ET) so a later read of the same cut is recognised as the same session, not a new one.
            quote.previousCloseSessionDate = exchangeLocalDate(Date.parse(cut.observedAt || ''), 'America/New_York');
            quote._pctSource = 'fx-hourly-cut-close';
            quote.previousCloseApproximate = false;
          }
        } catch (_) { /* daily path stays */ }
      }
      if (ROLLING_FUTURES[symbol]) await alignRollingFuturesQuote(host, quote);
      return quote;
    } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

// v58.80 (P2065): Yahoo's continuous crude contracts quote the next month two to four sessions before the expiring month's
// last trade, while their daily bars — and so the previous close above — stay on the expiring month. The 1-day change
// divided two contracts: WTI 10/20 read −5.6% for −0.7% (December 97.82 against November's 103.66), 9/18 −5.8% while
// Brent fell 0.9%, Brent 10/23 −1.3% for +2.8% (January 111.70 against December's 113.17). The explicit contract whose
// price is the quoted price names the month, and its own bar before last is the previous close.
export const ROLLING_FUTURES = { 'CL=F': 'CL', 'BZ=F': 'BZ' };
const FUTURES_MONTH_CODES = 'FGHJKMNQUVXZ';
// WTI month M expires around the 20th of M−1 and NYMEX Brent at the end of M−2, so the quoted month is one to three ahead.
export function futuresContractCandidates(root, nowMs = Date.now()) {
  const now = new Date(nowMs);
  return [1, 2, 3].map((ahead) => {
    const month = now.getUTCMonth() + ahead;
    const year = now.getUTCFullYear() + Math.floor(month / 12);
    return `${root}${FUTURES_MONTH_CODES[month % 12]}${String(year % 100).padStart(2, '0')}.NYM`;
  });
}
// The contract chart whose price and time are the quote's; null when none is.
export function sameContractChange(quote, contract, res) {
  const meta = res?.meta;
  const price = Number(quote?.regularMarketPrice);
  if (!meta || !(Math.abs(Number(meta.regularMarketPrice) - price) <= 0.005)) return null;
  if (Number.isFinite(quote.regularMarketTime) && Math.abs(Number(meta.regularMarketTime) - quote.regularMarketTime) > 120) return null;
  const stamps = res.timestamp || [];
  const bars = (res.indicators?.quote?.[0]?.close || [])
    .map((close, index) => ({ close: close != null && isFinite(close) && close > 0 ? close : null, timestamp: stamps[index] }))
    .filter((bar) => Number.isFinite(bar.timestamp));
  // The continuous symbol's rule (bar before last): a futures "day" holds the next session's evening hours.
  const index = previousCloseBarIndex(bars, meta, quote.symbol);
  const prev = index >= 0 ? bars[index].close : null;
  return {
    contract,
    prev,
    pct: prev ? ((price - prev) / prev) * 100 : null,
    regularMarketPreviousCloseObservedAt: index >= 0 && index === bars.length - 2 ? new Date(bars[bars.length - 1].timestamp * 1000).toISOString() : null,
    previousBarOpenedAt: index >= 0 ? new Date(bars[index].timestamp * 1000).toISOString() : null,
    previousCloseSessionDate: index >= 0 ? exchangeLocalDate(bars[index].timestamp * 1000, meta.exchangeTimezoneName) : null,
  };
}
async function alignRollingFuturesQuote(host, quote, nowMs = Date.now()) {
  for (const contract of futuresContractCandidates(ROLLING_FUTURES[quote.symbol], nowMs)) {
    let same = null;
    try {
      const j = await fetchJSON(host + '/v8/finance/chart/' + encodeURIComponent(contract) + '?interval=1d&range=5d', {}, 1);
      same = sameContractChange(quote, contract, j?.chart?.result?.[0]);
    } catch (_) { continue; }
    if (!same) continue;
    const rolled = !(Math.abs(Number(same.prev) - Number(quote.regularMarketPreviousClose)) <= 1e-6);
    quote.contract = contract;
    quote.contractRolled = rolled;
    if (!rolled) return;
    quote.regularMarketPreviousClose = same.prev;
    quote.chartPreviousClose = same.prev;
    quote.regularMarketChangePercent = same.pct;
    quote.regularMarketPreviousCloseObservedAt = same.regularMarketPreviousCloseObservedAt;
    quote.previousBarOpenedAt = same.previousBarOpenedAt;
    quote.previousCloseSessionDate = same.previousCloseSessionDate;
    quote.previousCloseApproximate = false;
    quote._pctSource = same.prev ? 'same-contract-daily' : 'previous-session-close-missing';
    return;
  }
  // No candidate priced the quote (or none answered): the continuous read stays, marked unconfirmed.
  quote.contract = null;
}

// v58.69: the last hourly close of one exchange-local session (the fallback when that session's daily close is empty).
// v58.69: also the session's first hourly stamp, so the history backfill can key a filled hole like a daily bar.
export function hourlySessionClose(res, date, timeZone) {
  const stamps = res?.timestamp || [], closes = res?.indicators?.quote?.[0]?.close || [];
  let close = null, openAt = null;
  stamps.forEach((stamp, index) => {
    if (exchangeLocalDate(stamp * 1000, timeZone) !== date) return;
    if (openAt == null) openAt = new Date(stamp * 1000).toISOString();
    const value = Number(closes[index]);
    if (closes[index] != null && Number.isFinite(value) && value > 0) close = value;
  });
  return close == null ? null : { close, openAt };
}

async function fetchHourly(host, symbol, range = '5d') {
  const hourly = await fetchJSON(host + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=60m&range=' + range, {}, 1);
  return hourly?.chart?.result?.[0] || null;
}

async function hourlyLastClose(host, symbol, date, timeZone) {
  if (!date || !timeZone) return null;
  return hourlySessionClose(await fetchHourly(host, symbol), date, timeZone)?.close ?? null;
}

// v58.69: a session the daily chart lists with an empty close (Yahoo ^GSPC/^IXIC/SMH 2026-10-21) stays a permanent hole
// in history, and every 1-day change after it is read across two sessions. The history backfill fills it from hourly bars.
export async function fetchHourlySessionClose(symbol, date, timeZone) {
  for (const host of YAHOO_HOSTS) {
    try { return hourlySessionClose(await fetchHourly(host, symbol, '1mo'), date, timeZone); } catch (_) { /* 호스트 폴백 */ }
  }
  return null;
}

// P1721: FX trades Sunday 22:00Z to Friday ~21:00Z; Saturday/Sunday (UTC) keep the daily-bar path (a Friday close).
function FX_WEEKDAY_SESSION(nowMs) {
  const day = new Date(nowMs).getUTCDay();
  return day >= 1 && day <= 5;
}

/**
 * P1721: the FX close at the latest completed 23:00Z (KST 08:00) cut whose day was a weekday session, read from
 * hourly bars (open timestamps). The last non-null hourly close in the four hours before the cut is the close; its
 * observation time is that bar's end (never after the cut). Returns null when no bar qualifies — never a guess.
 */
export function fxCloseAtCut(timestamps = [], closes = [], nowMs = Date.now()) {
  const HOUR = 3600000;
  let boundary = Date.UTC(new Date(nowMs).getUTCFullYear(), new Date(nowMs).getUTCMonth(), new Date(nowMs).getUTCDate(), 23);
  if (boundary > nowMs) boundary -= 24 * HOUR;
  const weekdaySessionEndingAt = (b) => { const day = new Date(b - 1).getUTCDay(); return day >= 1 && day <= 5; };
  for (let guard = 0; guard < 4 && !weekdaySessionEndingAt(boundary); guard += 1) boundary -= 24 * HOUR;
  if (!weekdaySessionEndingAt(boundary)) return null;
  let best = null;
  for (let i = 0; i < timestamps.length; i += 1) {
    const openMs = Number(timestamps[i]) * 1000;
    const close = Number(closes[i]);
    if (!Number.isFinite(openMs) || closes[i] == null || !Number.isFinite(close) || close <= 0) continue;
    if (openMs >= boundary || openMs < boundary - 4 * HOUR) continue;
    if (!best || openMs > best.openMs) best = { openMs, close };
  }
  if (!best) return null;
  let previous = boundary - 24 * HOUR;
  for (let guard = 0; guard < 4 && !weekdaySessionEndingAt(previous); guard += 1) previous -= 24 * HOUR;
  return {
    close: best.close,
    observedAt: new Date(Math.min(best.openMs + HOUR, boundary)).toISOString(),
    boundary: new Date(boundary).toISOString(),
    previousBoundary: new Date(previous).toISOString(),
  };
}

// v50.99: fetch 성공처럼 보이는 데이터 품질 검증.
// Yahoo가 에러 없이 stale/비정상 데이터를 반환할 수 있음 — 전일 종가 대비 변동폭으로 판별.
// 허용 범위: 금리(±1.0%p 절대 변동) / 변동성 지수(±200%) / 크립토(±50%) / 그 외(±30%). 범위 초과 시 재시도 대상.
// v58.20 review B1: the rate tolerance was a 5% relative move, which rejected ^IRX at low rates (0.10 -> 0.04) although
// the comment said percentage points, and the 30% default dropped ^VIX on real spike days (2024-08-05 +65%,
// 2018-02-05 +116%) — the crash day lost its VIX and failed the Tier-0 snapshot gate.
function _quoteVerifyTol(symbol) {
  if (/^\^(TNX|TYX|FVX|IRX)$/.test(symbol)) return { points: 1 };
  if (/^\^(VIX|VIX3M|VIX9D|VIX6M|VVIX)$/.test(symbol)) return { pct: 200 };
  if (/-USD$/.test(symbol)) return { pct: 50 };
  return { pct: 30 };
}
export function _quoteOk(q) {
  if (!q || q.__error) return false;
  const price = q.regularMarketPrice, prev = q.regularMarketPreviousClose || q.chartPreviousClose;
  if (typeof price !== 'number' || price <= 0) return false;
  if (prev > 0) {
    const tol = _quoteVerifyTol(q.symbol);
    if (tol.points != null ? Math.abs(price - prev) > tol.points : Math.abs((price - prev) / prev) * 100 > tol.pct) return false;
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
export const TWELVE_DATA_ETF_FALLBACK_SYMBOLS = new Set([
  'HYG','LQD','TLT','SPY','QQQ','IWM','RSP','DIA','SMH',
  'XLK','XLF','XLE','XLV','XLI','XLY','XLP','XLU','XLRE','XLB','XLC',
]);

export async function fetchQuoteTwelveData(symbol, apiKey) {
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
    // P1255 (07:M04 계열 잔여 D5): 폴백 공급자도 같은 가격 기준 계약을 선언한다.
    priceBasis: 'provider-close-adjustment-scope-undeclared',
    _pctSource: 'twelvedata-quote',
    _source: 'live:twelvedata-fallback',
    regularMarketTime: j && j.timestamp ? Number(j.timestamp) : null,
    observedAt: j && j.timestamp ? new Date(Number(j.timestamp) * 1000).toISOString() : null,
    fetchedAt: new Date().toISOString(),
    delayedByMs: j && j.timestamp ? Math.max(0, Date.now() - Number(j.timestamp) * 1000) : null,
    delayProvenance: {
      observedField: 'Twelve Data quote.timestamp',
      measuredAtField: 'fetch-time Date.now()',
      unit: 'milliseconds',
      method: 'max(0, fetchedAt-observedAt)',
      policyOwner: 'scripts/build-market-snapshot.mjs:deriveMarketSession',
      qualityPolicy: 'fallback-observation-is-not-current-without-session-and-delay-gate'
    },
    marketState: j && j.is_market_open === true ? 'REGULAR' : (j && j.is_market_open === false ? 'CLOSED' : null),
    marketSession: j && j.is_market_open === true ? 'REGULAR' : (j && j.is_market_open === false ? 'CLOSED' : null),
    exchangeTimezoneName: j && j.timezone || null,
    fullExchangeName: j && j.exchange || null,
    venue: j && j.exchange || null,
    currency: j && j.currency || null,
    source: 'Twelve Data quote fallback',
    sourceTier: 'T3_PUBLIC_DELAYED',
    sourceKind: 'T3_PUBLIC_DELAYED',
    allowedUse: 'reference-only',
    allowedUseCeiling: 'reference',
    rightsId: 'PUBLIC_REFERENCE',
    qualityStatus: j && j.timestamp ? 'CURRENT' : 'MISSING',
    quality: { status: j && j.timestamp ? 'CURRENT' : 'MISSING', stale: false, decisionUse: false, allowedUse: 'reference' },
  };
}

// 동시성 제한 배치 실행
export async function mapLimit(items, limit, fn) {
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

export async function fetchCoinGeckoCrossCheck() {
  const attemptedAt = new Date().toISOString();
  try {
    const url = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum&vs_currencies=usd&include_last_updated_at=true';
    const payload = await fetchJSON(url, { headers: { accept: 'application/json' } }, 2);
    const normalize = (id, symbol) => {
      const row = payload?.[id] || {};
      const price = Number(row.usd);
      const epoch = Number(row.last_updated_at);
      return {
        symbol,
        price: Number.isFinite(price) && price > 0 ? price : null,
        observedAt: Number.isFinite(epoch) && epoch > 0 ? new Date(epoch * 1000).toISOString() : null
      };
    };
    const quotes = [normalize('bitcoin', 'BTC-USD'), normalize('ethereum', 'ETH-USD')];
    const ok = quotes.every((row) => row.price != null && row.observedAt);
    return { status: ok ? 'ok' : 'partial', attemptedAt, fetchedAt: new Date().toISOString(), source: 'CoinGecko Simple Price API', sourceKind: 'independent-secondary', sourceUrl: url, quotes };
  } catch (error) {
    return { status: 'unavailable', attemptedAt, fetchedAt: null, source: 'CoinGecko Simple Price API', sourceKind: 'independent-secondary', sourceUrl: 'https://api.coingecko.com/api/v3/simple/price', quotes: [], reason: String(error?.message || error) };
  }
}

// ── v50.52 B4: Yahoo v8/chart 다일 종가 히스토리 (백필용) ──
// 왜: fetchQuote는 range=5d + meta(현재가)만 읽어 history가 하루 1건씩만 쌓임(20~60일 대기).
//     range=6mo로 일별 종가 배열을 1회 받아 history.json을 즉시 시드 → 차트 대기 제거.
export async function fetchHistory(symbol, range = '6mo') {
  for (const host of YAHOO_HOSTS) {
    try {
      const url = host + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=' + range;
      const j = await fetchJSON(url, {}, 2);
      const res = j?.chart?.result?.[0];
      const ts = res?.timestamp;
      const q0 = res?.indicators?.quote?.[0];
      const closes = q0?.close;
      const fetchedAt = new Date().toISOString();
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
      // v57.81: the row assembly is shared with the browser's out-of-universe read (src/domain/screener/price-factors.js).
      return dailyRowsFromYahooChart(res, { fetchedAt });
    } catch (e) { /* 호스트 폴백 */ }
  }
  return [];
}

// v50.99: verification pass — quotes that failed or moved beyond the sanity band are retried once, and (v51.92/Phase 2
// [B1]) core ETFs Yahoo still could not serve fall back to Twelve Data. Without TWELVE_DATA_API_KEY the fallback is
// inert (same pattern as FRED/FMP). Split out of fetch-data.mjs main (pipeline redesign, 2026-10-19).
export async function collectVerifiedQuotes(quotesRaw, { twelveDataKey = process.env.TWELVE_DATA_API_KEY, log = console.log, warn = console.warn } = {}) {
  const pass1 = quotesRaw.filter(q => _quoteOk(q));
  const toRetry = quotesRaw.filter(q => !_quoteOk(q)).map(q => q && q.symbol ? q.symbol : (q && q.item)).filter(Boolean);
  let pass2 = [];
  if (toRetry.length) {
    log(`[fetch-data] verify-retry: ${toRetry.length}개 재시도 (에러 또는 비정상 변동폭): ${toRetry.join(',')}`);
    const retried = await mapLimit(toRetry, 3, sym => fetchQuote(sym).catch(() => ({ __error: true, item: sym })));
    pass2 = retried.filter(q => _quoteOk(q));
    // v58.71 (pipeline audit): a real move beyond the band (MSTR, COIN, PLTR on earnings) failed the retry the same way and
    // the symbol went missing for the run. Two independent reads that agree on the price and the previous close are a
    // move, not a bad read: the quote is kept and marked.
    const firstBySymbol = new Map(quotesRaw.filter(q => q && !q.__error && q.symbol).map(q => [q.symbol, q]));
    for (const q of retried) {
      if (!q || q.__error || _quoteOk(q) || !q.symbol) continue;
      const first = firstBySymbol.get(q.symbol);
      const prevOf = (x) => x?.regularMarketPreviousClose || x?.chartPreviousClose;
      const agree = (a, b) => a > 0 && b > 0 && Math.abs(a - b) / b <= 0.005;
      if (first && q.regularMarketPrice > 0 && agree(q.regularMarketPrice, first.regularMarketPrice) && agree(prevOf(q), prevOf(first))) {
        pass2.push({ ...q, largeMoveConfirmed: true });
      }
    }
    log(`[fetch-data] verify-result: ${pass2.length}/${toRetry.length} 복구`);
  }
  const yahooFailed = toRetry.filter(s => !pass2.find(q => q && q.symbol === s));
  const tdEligible = yahooFailed.filter(s => TWELVE_DATA_ETF_FALLBACK_SYMBOLS.has(s));
  let pass3 = [];
  if (twelveDataKey && tdEligible.length) {
    log(`[fetch-data] twelvedata-fallback: ${tdEligible.length}개 시도 (Yahoo 전부 실패한 핵심 ETF): ${tdEligible.join(',')}`);
    const tdResults = await mapLimit(tdEligible, 3, sym => fetchQuoteTwelveData(sym, twelveDataKey).catch(e => ({ __error: true, item: sym, msg: String(e && e.message || e) })));
    pass3 = tdResults.filter(q => _quoteOk(q));
    log(`[fetch-data] twelvedata-result: ${pass3.length}/${tdEligible.length} 복구`);
  } else if (!twelveDataKey && yahooFailed.length) {
    warn('[fetch-data] 경고: TWELVE_DATA_API_KEY GitHub Secret 미등록 — 핵심 ETF Yahoo 실패 시 2차 폴백 비활성.');
  }
  const quotes = [...pass1, ...pass2, ...pass3];
  const failed = yahooFailed.filter(s => !pass3.find(q => q && q.symbol === s));
  return {
    quotes, failed,
    verifyStats: { pass1: pass1.length, retried: toRetry.length, recovered: pass2.length, failed: failed.length },
    twelveData: { hasKey: !!twelveDataKey, eligible: tdEligible.length, recovered: pass3.length }
  };
}
