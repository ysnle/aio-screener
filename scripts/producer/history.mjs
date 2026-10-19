// history.json lane: field map, plausibility bounds, backfill, carry-forward and the per-cycle session upsert.
// Split out of scripts/fetch-data.mjs (pipeline redesign, 2026-10-19); fetch-data.mjs keeps the run order and re-exports
// every name it exported before.
import { readFile } from 'node:fs/promises';
import { deriveMarketSession } from '../build-market-snapshot.mjs';
import { atomicWriteFile } from '../lib/atomic-write.mjs';
import { latestCompletedUsSession, nyParts, resolveMarketCalendarSession } from '../../src/ai/time/market-session.js';
import { barSessionDateForField, historyFieldSessionDate, observationSessionDate } from '../../src/domain/market/history-session.js';
import { round } from '../lib/producer-math.mjs';
import { isSessionComplete } from '../../src/domain/screener/price-factors.js';
import { compareUsdKrwCrossCheck } from '../lib/macro-sources.mjs';
import { HIST } from './paths.mjs';
import { mapLimit, fetchHistory } from './quotes.mjs';

// history.json 레코드 필드 ↔ Yahoo 심볼 매핑 (백필 대상). F&G/IV는 과거 무료 소스 없어 제외(해당 일자 null).
const HIST_SYMBOLS = {
  '^GSPC': 'spx', '^IXIC': 'nasdaq', '^NDX': 'ndx', '^DJI': 'dow', '^RUT': 'rut',
  '^VIX': 'vix', '^VIX3M': 'vix3m', '^VVIX': 'vvix', '^TNX': 'tnx',
  'DX-Y.NYB': 'dxy', 'CL=F': 'wti', 'GC=F': 'gold',
  // P1721: Brent front-month futures, collected in SYMBOLS already, get the same completed-close column as WTI (CL=F).
  // The 거시 Brent value was FRED's Europe Brent *spot* (DCOILBRENTEU, days behind, 125-135 vs futures ~105 on 10/2-10/6),
  // a different basis than the WTI futures beside it.
  'BZ=F': 'brent',
  '^KS11': 'kospi', '^KQ11': 'kosdaq', 'BTC-USD': 'btc',
  // P1246 (E3/E4 FX 축): USD/KRW도 같은 producer 경로(Yahoo chart 일별 종가, worker 프록시가
  // CORS를 처리)로 일별 히스토리를 갖는다. 새 출처·새 키·새 약관이 없고, 백테스트 랩의 통화 축이
  // 요구하던 "과거 FX 시계열 공급원"이 이 열이다. 교차검증은 FRED DEXKOUS(공식 bilateral)가 한다.
  'KRW=X': 'usdkrw',
  // P1394: USD/JPY joins the FX axis (yen carry / BOJ channel); the <60-observation rule backfills 1y on the next run.
  'JPY=X': 'usdjpy',
  // P1586: 20-year Treasury ETF closes feed the safe-haven component of the self-computed sentiment index.
  'TLT': 'tlt',
  // v57.83 (owner 2026-10-16: "지수는 덜 빠져도 AI·반도체는 많이 빠졌다"): the semiconductor ETF, already collected in
  // SYMBOLS, gets a daily close column so a semiconductor drawdown under a steady index (2026-02~03, 2026-07) is on record.
  // The <60-observation rule backfills one year on the next run. Nothing reads it for a judgement yet.
  'SMH': 'smh',
  // Audit 2026-10-17 (owner D5): the equal-weight S&P 500 ETF, already in SYMBOLS, is the US theme stage's benchmark.
  'RSP': 'rsp',
};
const HIST_FIELDS = ['spx','nasdaq','ndx','dow','rut','vix','vix3m','vvix','tnx','dxy','wti','brent','gold','kospi','kosdaq','btc','usdkrw','usdjpy','tlt','smh','rsp','fg'];
// P1246 (data-refresh: 품질 경계): 히스토리 시장 필드의 **단일** 타당 범위 선언. producer가 이 범위를
// 벗어난 값을 관측으로 승격하지 않고(null + fieldMeta 없음 = P1101의 무관측 표기), 게이트가 같은 선언을
// 가져와 아티팩트를 검사한다 — 선언과 집행이 서로 다른 리터럴을 들고 어긋나는 경로를 만들지 않는다.
export const HIST_FIELD_PLAUSIBILITY = Object.freeze({
  spx: [500, 50000], nasdaq: [500, 100000], ndx: [500, 100000], dow: [2000, 150000], rut: [100, 10000],
  vix: [5, 200], vvix: [20, 400], tnx: [0, 20], dxy: [50, 200], wti: [1, 400], brent: [1, 400],
  gold: [100, 20000], kospi: [300, 20000], kosdaq: [100, 5000], btc: [1000, 2000000],
  // 원/달러는 1997년 외환위기 이후 800~2000원대를 벗어난 적이 없다. 공급자 오류(예: 지수/배율
  // 혼동)로 한 자리·두 자리 수가 들어오면 그대로 히스토리에 남아 백테스트 환산을 오염시킨다.
  usdkrw: [800, 2000],
  usdjpy: [50, 400],
  tlt: [20, 400],
  smh: [20, 2000],
  rsp: [20, 2000],
});
export function histValueWithinPlausibility(field, value) {
  const range = HIST_FIELD_PLAUSIBILITY[field];
  if (!range) return true;
  return typeof value === 'number' && Number.isFinite(value) && value >= range[0] && value <= range[1];
}
const HIST_MARKET_FIELDS = HIST_FIELDS.filter(field => field !== 'fg');
// Breadth columns are produced by the screener lane, so a row written by the
// 30-minute market lane used to omit them entirely while the screener lane
// deleted the key when a window had too few eligible symbols. Rows then had
// different key sets and a one-row breadth lag was indistinguishable from
// "unavailable" (P1101). Both lanes now publish every column; absence is null.
const HIST_BREADTH_FIELDS = ['breadth20','breadth50','breadth200','advanceRatio','advanceDecline','breadth40','breadthUp4','breadthDown4','breadthNewHighs','breadthNewLows','distributionDays']; // P1416
const HIST_SENTIMENT_FIELDS = ['pcr']; // P1586 put/call accumulates only on Cboe trading dates; every other row carries null
const HIST_ALL_FIELDS = [...HIST_FIELDS, ...HIST_BREADTH_FIELDS, ...HIST_SENTIMENT_FIELDS];
// Per-row cycle metadata. Rows seeded by the historical backfill never carried
// it, so the column set differed by row; null records "not recorded" instead.
const HIST_ROW_META = ['seriesMode','cycleEnd','marketSnapshotRevision'];

// "No observation" is null with no fieldMeta entry; a fieldMeta entry always
// describes a finite value. Normalizing every row also normalizes rows written
// by earlier producer revisions, so no separate migration is needed.
export function normalizeHistoryRows(hist) {
  for (const row of hist) {
    if (!row || typeof row !== 'object') continue;
    if (!row.fieldMeta || typeof row.fieldMeta !== 'object') row.fieldMeta = {};
    for (const key of HIST_ROW_META) if (row[key] === undefined) row[key] = null;
    for (const field of HIST_ALL_FIELDS) {
      if (row[field] === undefined) row[field] = null;
      if (row[field] === null || !Number.isFinite(Number(row[field]))) delete row.fieldMeta[field];
    }
  }
  return hist;
}

// v53.14/AR-07 Batch 0: history.json은 행의 공통 date만으로 관측시각을 대표하지 않는다.
// 각 수치에 source/observedAt/fetchedAt/allowedUse를 보존해 미국·한국·24/7 자산의
// 거래일·수집일을 섞지 않는다. 기존 숫자 필드는 하위 호환으로 유지한다.
// Codex browser audit H02 (2026-10-07): no refresh ran between the US 10/5 close and the 10/6 open, so the 10/5
// S&P 500 close never entered history and "어제와 달라진 점" compared 10/2 with 10/6. The daily backfill only ran
// for thin histories. A completed US session missing from the last ten days now triggers the same backfill,
// which writes the provider's daily bar for that session (completed bars only, P1399).
export function missingRecentUsSessions(hist, nowMs = Date.now(), lookbackDays = 10) {
  const basis = latestCompletedUsSession(nowMs);
  if (!basis?.date) return [];
  const have = new Set();
  for (const row of Array.isArray(hist) ? hist : []) {
    if (!Number.isFinite(Number(row?.spx))) continue;
    const meta = row?.fieldMeta?.spx;
    if (meta?.observationRelation === 'carried-forward') continue;
    const at = meta?.observedAt ? Date.parse(meta.observedAt) : NaN;
    have.add(Number.isFinite(at) ? nyParts(at).date : row.date);
  }
  const missing = [];
  let cursor = basis.date;
  for (let i = 0; i < lookbackDays; i += 1) {
    const session = resolveMarketCalendarSession({ market: 'US', date: cursor });
    if (session?.status === 'open' && !have.has(cursor)) missing.push(cursor);
    cursor = new Date(Date.parse(`${cursor}T12:00:00Z`) - 86400000).toISOString().slice(0, 10);
  }
  return missing.sort();
}

async function backfillHistory(hist) {
  const byDate = {};
  const syms = Object.keys(HIST_SYMBOLS);
  const results = await mapLimit(syms, 4, async (sym) => ({ sym, rows: await fetchHistory(sym, '1y') }));
  for (const r of results) {
    if (!r || r.__error || !Array.isArray(r.rows)) continue;
    const field = HIST_SYMBOLS[r.sym];
    // v57.81: a futures/FX/DXY/BTC bar is still trading until the next bar opens, so the newest bar of a continuous
    // instrument is never written as a completed close (the market lane records it as a previous close once closed).
    const continuous = /(=F|=X)$|^DX-Y\.NYB$|-USD$/.test(r.sym);
    for (const [barIndex, bar] of r.rows.entries()) {
      if (continuous && barIndex === r.rows.length - 1) continue;
      // v57.81: a bar is keyed by its own session in its zone. Yahoo FX bars open at 00:00 London (23:00Z in summer),
      // so the UTC date of the stamp filed the 10/9 won bar under 10/8.
      const sessionDate = barSessionDateForField(field, bar.observedAt) || bar.date;
      const row = { ...bar, date: sessionDate };
      // P1246: 품질 경계는 백필 레인에도 똑같이 적용된다. 선언된 타당 범위를 벗어난 공급자 값은
      // 관측으로 승격하지 않는다 — 그 날짜의 행 자체를 만들지 않는다(값도 fieldMeta도 없음).
      if (!histValueWithinPlausibility(field, row.close)) continue;
      if (!isSessionComplete(row.date, /^\^?(KS|KQ)/.test(r.sym) ? 'kr' : 'us')) continue; // P1399: no partial bar
      if (!byDate[row.date]) byDate[row.date] = { date: row.date };
      byDate[row.date][field] = row.close;
      byDate[row.date].fieldMeta = byDate[row.date].fieldMeta || {};
      byDate[row.date].fieldMeta[field] = {
        observedAt: row.observedAt || null,
        fetchedAt: row.fetchedAt || null,
        lastSuccessfulAt: row.fetchedAt || null,
        source: 'Yahoo chart',
        sourceKind: 'T3_PUBLIC_DELAYED',
        allowedUse: 'research-history',
        // P1117: every history fieldMeta must declare how the timestamp was obtained.
        // This backfill lane published neither marker, so a row it wrote last would fail
        // the artifact gate that requires an observation relation on every market field.
        observationRelation: 'latest-completed-close',
        observedAtSource: row.observedAt ? 'provider-current' : 'unavailable',
        sessionDate, // v57.81: the bar's own session (its open stamp's local date)
      };
    }
  }
  let added = 0;
  for (const date of Object.keys(byDate)) {
    const existing = hist.find(h => h && h.date === date);
    if (existing) {
      // P1656: a backfill only fills gaps. It runs whenever any field is thin, so overwriting every row
      // replaced the producer's completed-close record (valueBasis, close-time observedAt) with a daily bar
      // stamped at its bar start, and the score's close-basis selector then rejected that day's VIX/SPX.
      existing.fieldMeta = existing.fieldMeta || {};
      for (const f of HIST_FIELDS) {
        if (byDate[date][f] == null) continue;
        if (Number.isFinite(Number(existing[f])) && existing.fieldMeta[f]?.valueBasis) continue;
        existing[f] = byDate[date][f];
        if (byDate[date].fieldMeta?.[f]) existing.fieldMeta[f] = byDate[date].fieldMeta[f];
      }
      continue;
    }
    const base = { date, fieldMeta: byDate[date].fieldMeta || {} };
    for (const f of HIST_FIELDS) base[f] = (byDate[date][f] != null ? byDate[date][f] : null);
    hist.push(base);
    added++;
  }
  hist.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return { hist, added };
}

// Weekend/holiday rows can legitimately repeat the previous observed close.
// Carry the earlier evidence forward explicitly instead of pretending that the
// market observed a new value on the calendar bucket date.
function carryForwardHistoryEvidence(hist) {
  const rows = [...hist].sort((a, b) => String(a?.date || '').localeCompare(String(b?.date || '')));
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    row.fieldMeta = row.fieldMeta || {};
    for (const field of HIST_MARKET_FIELDS) {
      if (typeof row[field] !== 'number' || row.fieldMeta[field]?.observedAt) continue;
      for (let j = i - 1; j >= 0; j--) {
        const prior = rows[j];
        const priorMeta = prior?.fieldMeta?.[field];
        if (typeof prior?.[field] !== 'number' || !priorMeta?.observedAt) continue;
        // The old common-date record may contain an unverified weekend value.
        // Replace it with the last observed close before carrying the evidence;
        // the relation is explicit and downgraded to reference-only.
        row[field] = prior[field];
        row.fieldMeta[field] = {
          ...priorMeta,
          allowedUse: 'reference-only',
          observationRelation: 'carried-forward',
          carriedFrom: prior.date,
        };
        break;
      }
    }
  }
  return hist;
}

// v57.81: history.json carried one market session under two row dates. A row is keyed by the UTC run date and holds
// the latest completed close known at that run, so the backfill lane's 10/12 DXY bar (row 10/12) and the market lane's
// previous close at the 10/13 23:51Z run (the same 10/12 close, row 10/13) were two "observations" of 102.58, and a
// weekend row repeated Friday's close as if new. Each field's session is now compared across rows: the earliest row
// that records a session owns it, and a later row with the same session is marked held (carried-forward, carriedFrom,
// heldReason) — never deleted. When two producer-dated reads of one session differ, the later read (the provider's
// settled bar) revises the owner and the replaced value is kept in `revisions`. Legacy pairs that differ keep both
// values; readers resolve them by settle time. Idempotent: a held field is skipped on the next run.
export function holdRepeatedSessions(hist, { at = new Date().toISOString(), fields = HIST_MARKET_FIELDS } = {}) {
  const rows = (Array.isArray(hist) ? hist : []).filter((row) => row && typeof row === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(String(row.date || '')))
    .sort((a, b) => a.date.localeCompare(b.date));
  const held = [];
  const revised = [];
  const dated = (meta) => /^\d{4}-\d{2}-\d{2}$/.test(String(meta?.sessionDate || ''));
  for (const field of fields) {
    const owners = new Map();
    for (const row of rows) {
      const value = row[field];
      const meta = row.fieldMeta?.[field];
      if (typeof value !== 'number' || !Number.isFinite(value) || !meta?.observedAt || meta.observationRelation === 'carried-forward') continue;
      const session = historyFieldSessionDate(meta, field) || observationSessionDate(field, meta.observedAt);
      if (!session) continue;
      const owner = owners.get(session);
      if (!owner) { owners.set(session, row); continue; }
      const ownerMeta = owner.fieldMeta[field];
      if (owner[field] !== value) {
        if (!dated(ownerMeta) || !dated(meta)) continue;
        ownerMeta.revisions = [...(Array.isArray(ownerMeta.revisions) ? ownerMeta.revisions : []),
          { value: owner[field], observedAt: ownerMeta.observedAt || null, fetchedAt: ownerMeta.fetchedAt || null, revisedAt: at, revisedFromRow: row.date }].slice(-5);
        revised.push({ date: owner.date, field, session, from: owner[field], to: value, by: row.date });
        owner[field] = value;
      }
      row.fieldMeta[field] = {
        ...meta,
        allowedUse: 'reference-only',
        observationRelation: 'carried-forward',
        heldRelation: meta.observationRelation || null,
        heldReason: 'session-already-recorded',
        carriedFrom: owner.date,
        sessionDate: session,
      };
      held.push({ date: row.date, field, session, carriedFrom: owner.date });
    }
  }
  return { held, revised };
}

export function usPreOpenIndexPrint(symbol, observedAt) {
  if (!/^\^(VIX|VIX3M|VVIX|GSPC|IXIC|NDX|DJI|RUT|TNX)$/.test(String(symbol || ''))) return false;
  const at = Date.parse(observedAt || '');
  if (!Number.isFinite(at)) return false;
  const parts = nyParts(at);
  const day = new Date(at).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  return !['Sat', 'Sun'].includes(day) && parts.minute < 9 * 60 + 30;
}

// v57.81: futures, DXY and FX reopen at 18:00 ET for the next trading day. A print from that evening (the 10/04 and 10/11
// Sunday 23:01-23:26Z WTI/DXY/gold/won prints filed as MARKET_CLOSED) belongs to a session that has not completed, so
// it is never a completed close; the history takes the previous completed close instead.
export function continuousReopenPrint(symbol, observedAt) {
  if (!/(=F|=X)$|^DX-Y\.NYB$/.test(String(symbol || ''))) return false;
  const at = Date.parse(observedAt || '');
  if (!Number.isFinite(at)) return false;
  const day = new Date(at).toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  return !['Fri', 'Sat'].includes(day) && nyParts(at).minute >= 18 * 60;
}

// ── WO-7 (ops): 일별 히스토리 축적 (public-data/history.json) ──
// 왜: data.json은 매 실행 덮어쓰기라 과거가 안 남는다. 52주 VIX(IV Rank)·breadth 사이클·F&G 추이
//     차트가 하드코딩 시드 배열에 의존하는 근본 원인. 하루 1건(같은 날은 최신값으로 upsert =
//     마지막 실행이 종가에 가까움)씩 핵심 지표를 append → 시간이 지나면 사이트가 자체 실데이터 사용.
// 핵심 심볼(SPX/VIX) 없으면 스킵(널 레코드 오염 방지). ~420일(14개월) cap.
export async function updateHistory(data, marketSnapshot = null, officialFx = null) {
  try {
    const snapshotBySym = new Map((marketSnapshot?.quotes || []).map((row) => [row.instrumentId, row]));
    const bySymQuote = {};
    const bySym = {};
    for (const q of data.quotes || []) {
      const session = snapshotBySym.get(q.symbol)?.session || deriveMarketSession({
        instrumentId: q.symbol,
        observedAt: q.observedAt,
        providerSession: q.marketSession || q.marketState,
        now: Date.parse(data.meta?.generatedAt || '') || Date.now(),
      });
      const isOpenPoint = session === 'CURRENT_SESSION' || session === 'DELAYED_IN_SESSION';
      const previousClose = Number(q.regularMarketPreviousClose ?? q.chartPreviousClose);
      const previousObservedAt = q.regularMarketPreviousCloseObservedAt || null;
      // P1656: VIX-family indices also print in Cboe's extended hours; a weekday print before the 09:30 ET open
      // is that session's pre-open value, not a completed close (10/12 07:01 ET VIX 15.48 was filed as one).
      // v57.81: an evening reopen print of a futures/FX/DXY session is the same case (continuousReopenPrint).
      const preOpenPrint = !isOpenPoint && (usPreOpenIndexPrint(q.symbol, q.observedAt) || continuousReopenPrint(q.symbol, q.observedAt));
      const usePreviousClose = (isOpenPoint || preOpenPrint) && Number.isFinite(previousClose) && previousClose > 0;
      // P1576: in session without a previous close there is no completed close to record; the
      // intraday price must not be written as one (fail closed, like P1095's timestamp rule).
      bySym[q.symbol] = usePreviousClose ? previousClose : (isOpenPoint || preOpenPrint) ? null : q.regularMarketPrice;
      // A history row is a completed daily close, not the provider's intraday
      // previous-value anchor — and that holds for 24/7 assets too. BTC/ETH have a real
      // previous completed daily bar (regularMarketPreviousClose, stamped with the boundary
      // that closed it, see regularMarketPreviousCloseObservedAt above), so they take the
      // same path as sessioned instruments.
      // 2026-09-20: this lane used to override continuous quotes back to regularMarketPrice.
      // P1144's premise ("a 24/7 quote has no previous completed day") was false — the daily
      // chart provides one — and recording a mid-day observation as a completed daily close is
      // exactly what ci-history-field-time-contract-check rejects as "in-session observation
      // promoted as daily close", which kept CI red and Pages undeployed.
      // P1095: a previous-completed-close value must not inherit the CURRENT
      // observation's timestamp. The old fallback (`previousObservedAt || q.observedAt`)
      // did exactly that whenever the provider omitted
      // `regularMarketPreviousCloseObservedAt`, so history.json published the prior
      // session's close stamped with the current cut (dxy/wti/gold/kospi/kosdaq/btc):
      // 14 fields split across two time conventions, six of them shifted by a session,
      // with nothing marking the substitution. Fail closed instead — no timestamp means
      // a consumer must not read the value as a current observation.
      const effectiveUsePreviousClose = usePreviousClose;
      const bySymQuoteEntry = {
        ...q,
        observedAt: effectiveUsePreviousClose ? previousObservedAt : q.observedAt,
        observationRelation: effectiveUsePreviousClose ? 'previous-completed-close' : 'latest-completed-close',
        observedAtSource: effectiveUsePreviousClose
          ? (previousObservedAt ? 'provider-previous-close' : 'unavailable')
          : 'provider-current',
        marketSession: 'COMPLETED',
        observedMarketSession: session,
        valueBasis: effectiveUsePreviousClose ? 'previous-completed-close' : 'latest-completed-close',
        allowedUse: 'completed-market-series',
        sessionDate: effectiveUsePreviousClose ? (q.previousCloseSessionDate || null) : null,
      };
      bySymQuote[q.symbol] = bySymQuoteEntry;
    }
    const pick = (s) => (typeof bySym[s] === 'number' && isFinite(bySym[s])) ? round(bySym[s], 2) : null;
    // P1246 (품질 경계): 히스토리에 실릴 값은 선언된 타당 범위 안에 있어야 한다. 범위 밖 값은 관측이
    // 아니라 공급자 오류로 취급해 null로 남긴다(값도 fieldMeta도 없음 — P1101의 무관측 표기).
    const pickField = (field, symbol) => {
      const value = pick(symbol);
      if (value == null) return null;
      if (histValueWithinPlausibility(field, value)) return value;
      console.warn(`[fetch-data] history: ${field}(${symbol})=${value} 이 타당 범위 밖 — 관측으로 기록하지 않음`);
      return null;
    };
    if (pick('^GSPC') === null && pick('^VIX') === null) {
      console.warn('[fetch-data] history: 핵심 심볼(SPX/VIX) 없음 — 히스토리 갱신 스킵');
      return null;
    }
    const fetchedAt = data.meta?.generatedAt || new Date().toISOString();
    const cycleEnd = data.meta?.newsCycleEnd || fetchedAt;
    boundPreviousCloseToCut({ bySym, bySymQuote, cycleEnd });
    const fieldMeta = {};
    const historyMeta = (field, quote, fallback = {}) => ({
      observedAt: quote?.observedAt || fallback.observedAt || null,
      fetchedAt: quote?.fetchedAt || fetchedAt,
      lastSuccessfulAt: quote?.fetchedAt || fetchedAt,
      source: quote?.source || fallback.source || 'Yahoo chart',
      sourceKind: quote?.sourceTier || fallback.sourceKind || 'public-information-service',
      allowedUse: quote?.allowedUse || fallback.allowedUse || 'reference',
      marketSession: quote?.marketSession || quote?.marketState || fallback.marketSession || null,
      observedMarketSession: quote?.observedMarketSession || fallback.observedMarketSession || null,
      valueBasis: quote?.valueBasis || fallback.valueBasis || null,
      // P1117: bySymQuote computes observationRelation/observedAtSource, but this projection
      // dropped both, so history.json never published the substitution marker the
      // previous-completed-close fix was supposed to expose. The artifact gate skipped its
      // assertions forever because it looks for exactly this field. Publish what the
      // producer already knows instead of recomputing it downstream.
      observationRelation: quote?.observationRelation || fallback.observationRelation || 'latest-completed-close',
      observedAtSource: quote?.observedAtSource || fallback.observedAtSource || 'provider-current',
      ...(quote?.sessionDate ? { sessionDate: quote.sessionDate } : {}),
    });
    // P1246: 값과 증거를 **한 번의 열거**에서 만든다. 종전에는 `rec`의 명시적 pick 목록과 이 루프가
    // 같은 HIST_SYMBOLS 매핑을 두 번 나열해, 한쪽만 고치면 값과 fieldMeta가 서로 다른 필드 집합을
    // 갖게 됐다(새 필드를 추가할 때 특히 조용히 어긋난다).
    const fieldValues = {};
    for (const [sym, field] of Object.entries(HIST_SYMBOLS)) {
      const value = pickField(field, sym);
      if (value === null) continue;
      fieldValues[field] = value;
      fieldMeta[field] = historyMeta(field, bySymQuote[sym]);
      // v57.81: every completed close names its session. A previous close takes the provider bar's own trading date
      // (v57.70) or, when the provider gave none, the session its bar-boundary stamp determines; a closing print takes
      // its exchange-local date. holdRepeatedSessions then compares sessions, not row dates.
      if (!fieldMeta[field].sessionDate) {
        const session = historyFieldSessionDate(fieldMeta[field], field) || observationSessionDate(field, fieldMeta[field].observedAt);
        if (session) fieldMeta[field].sessionDate = session;
      }
    }
    if (typeof data.fearGreed?.score === 'number') {
      const rawAsOf = data.fearGreed.asOf;
      const asOfMs = typeof rawAsOf === 'number' ? (rawAsOf < 1e12 ? rawAsOf * 1000 : rawAsOf) : Date.parse(rawAsOf || '');
      fieldMeta.fg = historyMeta('fg', null, {
        observedAt: Number.isFinite(asOfMs) ? new Date(asOfMs).toISOString() : null,
        source: data.fearGreed._source || 'CNN Fear & Greed',
        sourceKind: 'public-api',
        allowedUse: 'reference',
        // F&G is a publisher-dated daily value, not a market close cut.
        observationRelation: 'day-scoped-published',
        observedAtSource: Number.isFinite(asOfMs) ? 'publisher-as-of' : 'unavailable',
      });
    }
    const today = new Date(fetchedAt).toISOString().slice(0, 10); // UTC 일자 bucket; fieldMeta is authoritative
    const rec = {
      date: today,
      seriesMode: 'completed-market-cut',
      cycleEnd: cycleEnd,
      marketSnapshotRevision: data.meta?.marketSnapshotRevision || marketSnapshot?.revision || null,
      ...fieldValues,
      fg: (data.fearGreed && typeof data.fearGreed.score === 'number') ? data.fearGreed.score : null,
      fieldMeta,
    };
    let hist = [];
    try { const raw = JSON.parse(await readFile(HIST, 'utf8')); if (Array.isArray(raw)) hist = raw; } catch { /* 최초 실행 */ }
    // CNN publishes a dated historical series in the same response as the
    // current Fear & Greed value. Backfill those observations with their real
    // dates instead of waiting 60 future refresh cycles or inventing history.
    for (const point of Array.isArray(data.fearGreed?.history) ? data.fearGreed.history : []) {
      const date = String(point?.observedAt || '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Number(point?.score))) continue;
      let row = hist.find((item) => item?.date === date);
      if (!row) { row = { date, fieldMeta: {} }; hist.push(row); }
      row.fg = Number(point.score);
      row.fieldMeta = row.fieldMeta || {};
      row.fieldMeta.fg = {
        observedAt: point.observedAt,
        fetchedAt,
        lastSuccessfulAt: fetchedAt,
        source: 'CNN Fear & Greed historical graph',
        sourceKind: 'secondary-index',
        allowedUse: 'reference-history'
      };
    }
    // P1586: the Cboe total put/call ratio accumulates one point per trading date (the page's own date,
    // never the fetch day) so the self-computed sentiment index can average five sessions.
    if (data.putCall?.status === 'current-reference' && /^\d{4}-\d{2}-\d{2}$/.test(String(data.putCall.asOf || '')) && Number.isFinite(Number(data.putCall.totalPutCall))) {
      let row = hist.find((item) => item?.date === data.putCall.asOf);
      if (!row) { row = { date: data.putCall.asOf, fieldMeta: {} }; hist.push(row); }
      row.pcr = Number(data.putCall.totalPutCall);
      row.fieldMeta = { ...(row.fieldMeta || {}), pcr: { observedAt: data.putCall.asOf, fetchedAt, lastSuccessfulAt: fetchedAt, source: 'Cboe Daily Market Statistics', sourceKind: 'T3_PUBLIC_DELAYED', allowedUse: 'reference-history' } };
    }
    // `fieldMeta.fg` cites the CNN historical graph, so the row value must be
    // that series' point for the day. The headline `fearGreed.score` is rounded
    // separately, and spreading it over the row published 26 beside provenance
    // that recorded 26.11 (P1100).
    const fgSeriesValue = hist.find((row) => row?.date === today)?.fg;
    if (Number.isFinite(Number(fgSeriesValue))) rec.fg = Number(fgSeriesValue);
    // v50.52 B4: 최초/얇을 때(또는 BACKFILL=1) 6개월 일별 종가로 과거 시드 — 차트 대기 제거(멱등).
    let backfilled = 0;
    const needsFieldMeta = hist.some(row => HIST_MARKET_FIELDS.some(field => typeof row?.[field] === 'number' && !row?.fieldMeta?.[field]?.observedAt));
    const needsFieldBackfill = HIST_MARKET_FIELDS.some((field) => hist.filter((row) => typeof row?.[field] === 'number' && Number.isFinite(row[field])).length < 60);
    const missingSessions = missingRecentUsSessions(hist);
    if (missingSessions.length) console.log(`[fetch-data] 최근 미국 거래일 종가 누락 ${missingSessions.join(',')} — 일봉 백필 실행`);
    if (hist.length < 60 || process.env.BACKFILL === '1' || needsFieldMeta || needsFieldBackfill || missingSessions.length) {
      try { const bf = await backfillHistory(hist); hist = bf.hist; backfilled = bf.added; } catch (e) { console.warn('[fetch-data] backfill 실패(무시):', e && e.message || e); }
    }
    hist = carryForwardHistoryEvidence(hist);
    const idx = hist.findIndex(h => h && h.date === today);
    if (idx >= 0) hist[idx] = { ...hist[idx], ...rec, fieldMeta: { ...(hist[idx].fieldMeta || {}), ...fieldMeta } }; else hist.push(rec); // 같은 날 = upsert
    // v57.81: a session already recorded on an earlier row is held on this one, never a second observation.
    const held = holdRepeatedSessions(hist, { at: fetchedAt });
    if (held.held.length || held.revised.length) console.log(`[fetch-data] history: 같은 세션 반복 ${held.held.length}건 보류 표시, 재조회 갱신 ${held.revised.length}건`);
    hist.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    if (hist.length > 420) hist = hist.slice(hist.length - 420);  // 14개월 cap
    await atomicWriteFile(HIST, JSON.stringify(normalizeHistoryRows(hist)));
    // P1246: 이번 실행이 실제로 기록한 USD/KRW 확정 종가. FRED DEXKOUS 교차검증이 이 값을 기준으로
    // 삼는다 — 아티팩트가 실제로 담은 값이어야 검증이 의미를 갖는다. 없으면 null로 남겨 교차검증이
    // "판정 불가"를 말하게 한다(값을 지어내지 않는다).
    const fxObservation = Number.isFinite(fieldValues.usdkrw)
      ? { value: fieldValues.usdkrw, date: today, observedAt: fieldMeta.usdkrw?.observedAt || null, valueBasis: fieldMeta.usdkrw?.valueBasis || null }
      : null;
    // P1246: 공식 관측일과 **같은 시점**의 우리 확정 종가를 골라 비교한다. 하루 어긋난 봉까지는 같은
    // 시점으로 보되 실제 날짜를 레코드에 남긴다. 그 이상 벌어지면 최신값으로 대신하지 않고 '판정 불가'
    // 로 남긴다 — 시점이 다른 두 값을 비교해 불일치라고 말하는 것은 공표 지연을 데이터 오류로
    // 오표기하는 것이다.
    const officialDate = String(officialFx?.observedAt || '').slice(0, 10);
    const alignedRow = /^\d{4}-\d{2}-\d{2}$/.test(officialDate)
      ? [officialDate,
          new Date(Date.parse(`${officialDate}T00:00:00Z`) - 86400000).toISOString().slice(0, 10),
          new Date(Date.parse(`${officialDate}T00:00:00Z`) + 86400000).toISOString().slice(0, 10)]
        .map((candidate) => hist.find((row) => row && row.date === candidate && Number.isFinite(row.usdkrw)))
        .find(Boolean) || null
      : null;
    const fxCrossCheck = compareUsdKrwCrossCheck({
      provider: alignedRow
        ? { value: alignedRow.usdkrw, date: alignedRow.date, observedAt: alignedRow.fieldMeta?.usdkrw?.observedAt || `${alignedRow.date}T00:00:00.000Z` }
        : null,
      latestProvider: fxObservation,
      official: officialFx,
    });
    return { days: hist.length, today, upsert: idx >= 0 ? 'update' : 'append', backfilled, fxCrossCheck };
  } catch (e) {
    console.warn('[fetch-data] history 갱신 실패(무시):', e && e.message || e);
    return null;
  }
}

/**
 * P1192 (P1095 권위): 한 행의 완료 컷을 넘는 `previous-completed-close` 스탬프를 직전 bar 경계로
 * 되돌린다. Yahoo는 진행 중 bar를 그 bar의 개시 시각으로 스탬프하는데, FX/상품 일봉 경계(00:00Z)가
 * KST-08:00 뉴스 컷(23:00Z)보다 뒤라 그 경계가 컷을 넘는다. 값은 **실제 확정 종가**이므로 버리지
 * 않고 bar 경계로 앉히고, 그마저 컷을 넘으면 값을 싣지 않는다 — 컷을 늘리거나 시각만 바꾸는 위장은
 * 두 게이트(P1095·history-time)가 동시에 금지한다. `bySym`/`bySymQuote`를 제자리에서 고친다.
 */
export function boundPreviousCloseToCut({ bySym, bySymQuote, cycleEnd } = {}) {
  const cutMs = Date.parse(cycleEnd);
  const adjusted = [];
  const dropped = [];
  for (const [sym, quote] of Object.entries(bySymQuote || {})) {
    if (!quote || quote.observationRelation !== 'previous-completed-close') continue;
    const stamp = Date.parse(quote.observedAt || '');
    if (!Number.isFinite(stamp) || !Number.isFinite(cutMs) || stamp <= cutMs) continue;
    const fallback = quote.previousBarOpenedAt || null;
    if (!fallback || !(Date.parse(fallback) <= cutMs)) {
      if (bySym) bySym[sym] = null;
      delete bySymQuote[sym];
      dropped.push(sym);
      continue;
    }
    bySymQuote[sym] = { ...quote, observedAt: fallback, observedAtBoundary: 'previous-bar-open', observedAtCandidate: quote.observedAt };
    adjusted.push({ sym, from: quote.observedAt, to: fallback });
  }
  return { adjusted, dropped };
}
