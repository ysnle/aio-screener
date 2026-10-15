// Official/public macro sources split out of scripts/fetch-data.mjs (v57.62): FRED public CSV (HY OAS, DEXKOUS),
// Treasury yield curve, AAII sentiment, BEA PCE, CNN Fear & Greed, BLS (incl. v57.59 release-day cache bypass)
// and Cboe put/call. Parsers are pure; fetchers take the previous artifact block and return last-known-good
// evidence. fetch-data.mjs imports and re-exports them.
import { round } from './producer-math.mjs';
import { UA, fetchJSON, _fetchRss } from './producer-http.mjs';
import { latestCompletedUsSession } from '../../src/ai/time/market-session.js';

// FRED 시리즈 (YoY 또는 레벨). PAYEMS는 MoM 차이(천명) = NFP.
// v51.97/Phase 2 [B2]: housingStarts/retailSales/usWageGrowth 추가 — 세 시리즈 ID(HOUST/RSAFS/
// CES0500000003) 모두 클라이언트 자체 FRED_SERIES 테이블(aio-data.js:3195~3216, 개인 FRED 키
// 보유 사용자용 브릿지)에서 이미 실사용 중이던 것을 서버(레포 공용 키)로 승격 — 전 사용자 자동 적용.
// consConf(Conf. Board)는 의도적으로 제외: FRED엔 Conference Board 소비자신뢰 시리즈가 없음(비영리
// 민간기관 유료 라이선스, UMCSENT=미시간대와는 발행기관·척도가 다른 별개 지표 — P456/P593 참조).
// 한국 CPI(FRED KORCPIALLMINMEI 등 OECD 릴레이)는 이번에 보류: 신선도 검증 불가(로컬 네트워크 제약)
// + 이미 더 권위있는 직접 소스(KOSIS API 브릿지 aio-data.js fetchAllKosisData, /data-refresh 통계청
// 수동 확인)가 있어 릴레이로 교체 시 오히려 신선도 퇴보 위험 — 확장 후보로 문서에만 남김.
export const FRED_SERIES = {
  // Market-standard headline/core CPI are the non-seasonally-adjusted
  // twelve-month CPI-U series.  Keep the SA series as explicitly named
  // companions below so an analytical consumer cannot mistake one for the
  // BLS release headline.
  cpi:        { id: 'CPIAUCNS', kind: 'yoy' },
  coreCpi:    { id: 'CPILFENS', kind: 'yoy' },
  cpiSa:      { id: 'CPIAUCSL', kind: 'yoy' },
  coreCpiSa:  { id: 'CPILFESL', kind: 'yoy' },
  pce:        { id: 'PCEPI',    kind: 'yoy' },
  corePce:    { id: 'PCEPILFE', kind: 'yoy' },
  fedRate:    { id: 'FEDFUNDS', kind: 'level' }, // effective rate, MONTHLY average — not the policy target
  // 2026-10-01: the FOMC target range itself (official daily FRED series); the policy-rate surfaces
  // compared FEDFUNDS' monthly average (3.63) with BOK's policy rate and the 3.75-4.00 decision.
  fedTargetLower: { id: 'DFEDTARL', kind: 'level' },
  fedTargetUpper: { id: 'DFEDTARU', kind: 'level' },
  unemployment:{ id: 'UNRATE',  kind: 'level' },
  nfp:        { id: 'PAYEMS',   kind: 'mom_diff' }, // 천명 단위 (e.g. 172)
  housingStarts: { id: 'HOUST',          kind: 'level', scale: 0.001 }, // 천 단위→백만 단위 (DATA_SNAPSHOT.housingStarts는 1.47M 형태)
  retailSales:   { id: 'RSAFS',          kind: 'mom_pct' },             // 소매판매 MoM% (레벨 $ 시리즈에서 파생)
  usWageGrowth:  { id: 'CES0500000003',  kind: 'yoy' },                 // 시간당 평균임금 YoY%
  hyOAS:         { id: 'BAMLH0A0HYM2',   kind: 'level', scale: 1, delta5: true }, // FRED percent; UI converts to bp at the renderer boundary
  dgs2:          { id: 'DGS2',            kind: 'level', delta5: true }, // 미 국채 2Y (%), 공식 FRED 일별 관측
  dgs5:          { id: 'DGS5',            kind: 'level' },               // 미 국채 5Y (%)
  dgs10:         { id: 'DGS10',           kind: 'level', delta5: true }, // 미 국채 10Y (%)
  dgs20:         { id: 'DGS20',           kind: 'level' },               // 미 국채 20Y (%)
  dgs30:         { id: 'DGS30',           kind: 'level' },               // 미 국채 30Y (%)
  t10y2y:        { id: 'T10Y2Y',          kind: 'level' },               // 10Y-2Y 스프레드 (%p), 단일 만기에서 추정 금지
  // P1390: decompose a nominal 10Y move into real yield (TIPS) and inflation compensation; a real-yield-led
  // rise compresses equity multiples, a breakeven-led rise runs through the oil/inflation channel.
  realYield10:   { id: 'DFII10',          kind: 'level', delta5: true }, // 10Y TIPS 실질금리 (%)
  breakeven10:   { id: 'T10YIE',          kind: 'level', delta5: true }, // 10Y 기대인플레이션(BEI, %)
};

// BLS Public Data API v1 is a separate official observation path from FRED.
// Keep the bounded allowlist explicit and preserve typed observation evidence
// inside data.json.macro.  Only the explicit NSA headline/core fields may
// become the canonical CPI slots; SA companions stay namespaced below.
const BLS_SERIES = {
  // BLS release headlines use the unadjusted CPI-U index.  SA-derived
  // twelve-month changes remain available under separate metric IDs/fields;
  // they are analytical companions, never an implicit replacement.
  cpi: { id: 'CUUR0000SA0', field: 'blsCpiYoY', unit: 'index', frequency: 'monthly', seasonalAdjustment: 'NSA', displayRole: 'market-standard-headline', definition: 'CPI-U U.S. city average all items, not seasonally adjusted', derive: 'yoy' },
  cpiSa: { id: 'CUSR0000SA0', field: 'blsCpiSaYoY', unit: 'index', frequency: 'monthly', seasonalAdjustment: 'SA', displayRole: 'analytical-seasonally-adjusted', definition: 'CPI-U U.S. city average all items, seasonally adjusted', derive: 'yoy' },
  coreCpi: { id: 'CUUR0000SA0L1E', field: 'blsCoreCpiYoY', unit: 'index', frequency: 'monthly', seasonalAdjustment: 'NSA', displayRole: 'market-standard-core', definition: 'CPI-U U.S. city average all items less food and energy, not seasonally adjusted', derive: 'yoy' },
  coreCpiSa: { id: 'CUSR0000SA0L1E', field: 'blsCoreCpiSaYoY', unit: 'index', frequency: 'monthly', seasonalAdjustment: 'SA', displayRole: 'analytical-seasonally-adjusted-core', definition: 'CPI-U U.S. city average all items less food and energy, seasonally adjusted', derive: 'yoy' },
  unemployment: { id: 'LNS14000000', field: 'blsUnemployment', unit: 'percent', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'level' },
  laborForceParticipation: { id: 'LNS11300000', field: 'blsLaborForceParticipation', unit: 'percent', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'level' },
  nonfarmPayroll: { id: 'CES0000000001', field: 'blsNfpMoM', unit: 'thousands', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'mom_diff' },
  averageHourlyEarnings: { id: 'CES0500000003', field: 'blsAverageHourlyEarningsYoY', unit: 'USD/hour', frequency: 'monthly', seasonalAdjustment: 'SA', derive: 'yoy' },
};
const BLS_ENDPOINT = 'https://api.bls.gov/publicAPI/v1/timeseries/data/';
const BLS_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const FRED_HY_OAS_CSV_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2';
const FRED_HY_OAS_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const treasuryMonth = new Date().toISOString().slice(0, 7).replace('-', '');
const TREASURY_CURVE_URL = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=${treasuryMonth}`;
const TREASURY_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const AAII_SENTIMENT_URL = 'https://www.aaii.com/sentimentsurvey/sent_results?adv=yes';
const AAII_READER_URL = `https://r.jina.ai/${AAII_SENTIMENT_URL}`;
const AAII_CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function parseFredHyOasCsv(csv, fetchedAt = new Date().toISOString()) {
  const observations = String(csv || '').trim().split(/\r?\n/).slice(1).map((line) => {
    const [observedAt, rawValue] = line.split(',');
    const value = rawValue == null || rawValue.trim() === '' ? NaN : Number(rawValue);
    return /^\d{4}-\d{2}-\d{2}$/.test(String(observedAt || '').trim()) && Number.isFinite(value)
      ? { observedAt: observedAt.trim(), value }
      : null;
  }).filter(Boolean).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const latest = observations[0] || null;
  if (!latest) return null;
  return {
    schemaVersion: 'fred-public-series.v1',
    status: 'ok',
    seriesId: 'BAMLH0A0HYM2',
    source: 'FRED public series download (ICE BofA US High Yield Index OAS)',
    sourceKind: 'official-government-relay',
    sourceUrl: FRED_HY_OAS_CSV_URL,
    observedAt: latest.observedAt,
    fetchedAt,
    value: latest.value,
    unit: 'percent',
    allowedUse: 'official-relay-observation-with-publication-lag',
    decisionUse: false
  };
}

export async function fetchFredHyOasPublic(previous = null) {
  const nowIso = new Date().toISOString();
  const previousFetchedAt = Date.parse(previous?.fetchedAt || '');
  if (previous?.value != null && Number.isFinite(previousFetchedAt) && Date.now() - previousFetchedAt <= FRED_HY_OAS_CACHE_MAX_AGE_MS) {
    return { ...previous, attemptedAt: nowIso, status: 'cached-fresh', cacheHit: true };
  }
  try {
    const csv = await _fetchRss(FRED_HY_OAS_CSV_URL, 18000);
    const parsed = parseFredHyOasCsv(csv, nowIso);
    if (!parsed) throw new Error('FRED public CSV contained no dated numeric HY OAS observation');
    return { ...parsed, attemptedAt: nowIso, cacheHit: false };
  } catch (error) {
    const failureReason = String(error?.message || error);
    if (previous?.value != null && previous?.observedAt) return { ...previous, status: 'stale', attemptedAt: nowIso, failureReason, cacheHit: false };
    return {
      schemaVersion: 'fred-public-series.v1', status: 'unavailable', seriesId: 'BAMLH0A0HYM2',
      source: 'FRED public series download (ICE BofA US High Yield Index OAS)', sourceKind: 'official-government-relay',
      sourceUrl: FRED_HY_OAS_CSV_URL, observedAt: null, fetchedAt: null, attemptedAt: nowIso, value: null,
      unit: 'percent', failureReason, allowedUse: 'none', decisionUse: false
    };
  }
}

// ── P1246: FRED DEXKOUS — 공식 USD/KRW 교차검증 (키 불필요) ─────────────────────────────
// FRED의 DEXKOUS는 연준 H.10이 발표하는 공식 일별 원/달러 환율이다. fredgraph.csv 공개 다운로드는
// API 키가 필요 없어(FRED HY OAS와 같은 경로) 로컬 무키 실행에서도 상태를 정직하게 발행할 수 있다.
// 주의: 공식 계열은 공표 지연이 있어 공급자 스팟 종가와 같은 날짜가 아닐 수 있다 — 그래서 이
// 교차검증은 **값 출처가 아니라 참조**다. 불일치는 숨기지 않고 보고하되, 공급자 시계열을 공식 값으로
// 덮어쓰지 않는다(단일 소유권: history의 usdkrw는 Yahoo chart가 계속 소유한다).
const FRED_DEXKOUS_CSV_URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DEXKOUS';
const FRED_DEXKOUS_CACHE_MAX_AGE_MS = 12 * 60 * 60 * 1000;

export function parseFredDexkousCsv(csv, fetchedAt = new Date().toISOString()) {
  const observations = String(csv || '').trim().split(/\r?\n/).slice(1).map((line) => {
    const [observedAt, rawValue] = line.split(',');
    const value = rawValue == null || rawValue.trim() === '' ? NaN : Number(rawValue);
    return /^\d{4}-\d{2}-\d{2}$/.test(String(observedAt || '').trim()) && Number.isFinite(value)
      ? { observedAt: observedAt.trim(), value }
      : null;
  }).filter(Boolean).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const latest = observations[0] || null;
  if (!latest) return null;
  return {
    schemaVersion: 'fred-public-series.v1',
    status: 'ok',
    seriesId: 'DEXKOUS',
    source: 'FRED public series download (Federal Reserve H.10 USD/KRW noon buying rate)',
    sourceKind: 'official-government-relay',
    sourceUrl: FRED_DEXKOUS_CSV_URL,
    observedAt: latest.observedAt,
    fetchedAt,
    value: latest.value,
    unit: 'KRW per USD',
    allowedUse: 'official-relay-observation-with-publication-lag',
    decisionUse: false
  };
}

export async function fetchFredDexkousPublic(previous = null) {
  const nowIso = new Date().toISOString();
  const previousFetchedAt = Date.parse(previous?.fetchedAt || '');
  if (previous?.value != null && Number.isFinite(previousFetchedAt) && Date.now() - previousFetchedAt <= FRED_DEXKOUS_CACHE_MAX_AGE_MS) {
    return { ...previous, attemptedAt: nowIso, status: 'cached-fresh', cacheHit: true };
  }
  try {
    const csv = await _fetchRss(FRED_DEXKOUS_CSV_URL, 18000);
    const parsed = parseFredDexkousCsv(csv, nowIso);
    if (!parsed) throw new Error('FRED public CSV contained no dated numeric DEXKOUS observation');
    return { ...parsed, attemptedAt: nowIso, cacheHit: false };
  } catch (error) {
    const failureReason = String(error?.message || error);
    if (previous?.value != null && previous?.observedAt) return { ...previous, status: 'stale', attemptedAt: nowIso, failureReason, cacheHit: false };
    return {
      schemaVersion: 'fred-public-series.v1', status: 'unavailable', seriesId: 'DEXKOUS',
      source: 'FRED public series download (Federal Reserve H.10 USD/KRW noon buying rate)', sourceKind: 'official-government-relay',
      sourceUrl: FRED_DEXKOUS_CSV_URL, observedAt: null, fetchedAt: null, attemptedAt: nowIso, value: null,
      unit: 'KRW per USD', failureReason, allowedUse: 'none', decisionUse: false
    };
  }
}

// 순수 판정: **같은 날짜**의 공급자 확정 종가와 공식 관측치를 비교해 상태를 말한다. 어느 값도 바꾸지
// 않는다. 시점이 다른 두 값(공식 계열의 공표 지연)을 비교해 "불일치"라고 말하면 지연을 데이터 오류로
// 오표기하는 것이므로, 날짜가 다르면 판정하지 않고 not-comparable로 남긴다.
// 실측(2026-09-25): DEXKOUS 최신 관측은 7일 전이고 그 사이 스팟이 2.09% 움직였다 — 지연을 무시한
// 비교는 정상 계열을 매일 'divergent'로 신고했을 것이다.
export function compareUsdKrwCrossCheck({ provider = null, official = null, latestProvider = null, tolerancePct = 5, attemptedAt = new Date().toISOString() } = {}) {
  const providerDate = String(provider?.date || (provider?.observedAt ? String(provider.observedAt).slice(0, 10) : '') || '').slice(0, 10) || null;
  const officialDate = String(official?.observedAt || '').slice(0, 10) || null;
  const base = {
    schemaVersion: 'fx-cross-check.v1',
    provider: 'Yahoo chart KRW=X completed close',
    officialSource: official?.source || 'FRED DEXKOUS (Federal Reserve H.10)',
    officialSourceUrl: official?.sourceUrl || FRED_DEXKOUS_CSV_URL,
    providerValue: provider?.value ?? null,
    providerDate,
    // 최신값은 맥락으로만 싣는다. 비교는 같은 날짜끼리 한다.
    latestProviderValue: latestProvider?.value ?? null,
    latestProviderDate: latestProvider?.date || null,
    officialValue: official?.value ?? null,
    officialDate,
    // 공식 계열의 원본 레코드를 통째로 보존한다 — 상태·출처·실패 사유·수집 시각의 단일 표기이고,
    // 다음 실행이 이 레코드로 12시간 캐시를 재사용한다(별도 아티팩트를 만들지 않는다).
    official: official || null,
    tolerancePct,
    attemptedAt,
    fetchedAt: official?.fetchedAt || null,
    // 참조용이다. 이 레코드는 어떤 소비자의 값도 대체하지 않는다.
    allowedUse: 'reference-only-not-a-value-source',
    decisionUse: false,
  };
  if (!Number.isFinite(base.providerValue) || !Number.isFinite(base.officialValue)) {
    return { ...base, status: 'unavailable', comparable: false, dayGap: null, divergencePct: null, reason: 'no aligned observation on one or both sides' };
  }
  // 공급자 봉의 날짜 스탬프가 공식 관측일과 하루 어긋나는 경우가 있다(FX 일봉 경계 00:00Z vs 발표일
  // 표기). 어긋난 날짜를 그대로 기록하고, 하루까지는 같은 시점으로 본다 — 그 이상은 다른 관측이다.
  const dayGap = (providerDate && officialDate) ? Math.round((Date.parse(providerDate) - Date.parse(officialDate)) / 86400000) : null;
  const comparable = Number.isFinite(dayGap) && Math.abs(dayGap) <= 1;
  const divergencePct = round(Math.abs(base.providerValue / base.officialValue - 1) * 100, 3);
  if (!comparable) {
    return { ...base, status: 'not-comparable', comparable: false, dayGap, divergencePct,
      reason: `provider ${providerDate} and official ${officialDate} are different observations` };
  }
  return {
    ...base,
    status: divergencePct <= tolerancePct ? 'ok' : 'divergent',
    comparable: true,
    dayGap,
    divergencePct,
    // 두 계열은 측정 기준이 다르다(스팟 종가 vs 정오 매입환율). 허용폭을 넘는 차이는 작은 시차가 아니라
    // 다른 상품/배율을 집어온 신호로 읽는다.
    reason: divergencePct <= tolerancePct ? null : `aligned close differs from the official observation by ${divergencePct}% (> ${tolerancePct}%)`,
  };
}

export function parseTreasuryYieldCurveHtml(html, fetchedAt = new Date().toISOString()) {
  const rows = [...String(html || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(match => match[1]);
  const parsed = rows.map(row => {
    const datetime = (row.match(/<time\b[^>]*datetime="(\d{4}-\d{2}-\d{2})T/i) || [])[1] || null;
    if (!datetime) return null;
    const pick = (years) => {
      const pattern = new RegExp(`<td\\b[^>]*headers="view-field-bc-${years}year-table-column"[^>]*>([\\s\\S]*?)<\\/td>`, 'i');
      const raw = (row.match(pattern) || [])[1] || '';
      const normalized = raw.replace(/<[^>]*>/g, '').trim();
      const value = normalized === '' ? NaN : Number(normalized);
      return Number.isFinite(value) ? value : null;
    };
    const values = { dgs2: pick(2), dgs5: pick(5), dgs10: pick(10), dgs20: pick(20), dgs30: pick(30) };
    return Object.values(values).every(Number.isFinite) ? { observedAt: datetime, values } : null;
  }).filter(Boolean).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const latest = parsed[0] || null;
  if (!latest) return null;
  const values = { ...latest.values, t10y2y: round(latest.values.dgs10 - latest.values.dgs2, 3) };
  return {
    schemaVersion: 'us-treasury-curve.v1',
    status: 'ok',
    source: 'U.S. Treasury Daily Par Yield Curve Rates',
    sourceKind: 'T1_OFFICIAL',
    sourceUrl: TREASURY_CURVE_URL,
    observedAt: latest.observedAt,
    fetchedAt,
    values,
    allowedUse: 'official-observation-and-derived-same-date-spread',
    decisionUse: false
  };
}

export function parseTreasuryYieldCurveXml(xml, fetchedAt = new Date().toISOString()) {
  const entries = [...String(xml || '').matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)].map(match => match[1]);
  const parsed = entries.map((entry) => {
    const observedAt = (entry.match(/<d:NEW_DATE\b[^>]*>(\d{4}-\d{2}-\d{2})T/i) || [])[1] || null;
    if (!observedAt) return null;
    const pick = (years) => {
      const raw = (entry.match(new RegExp(`<d:BC_${years}YEAR\\b[^>]*>([^<]+)<\\/d:BC_${years}YEAR>`, 'i')) || [])[1];
      const value = Number(raw);
      return Number.isFinite(value) ? value : null;
    };
    const values = { dgs2: pick(2), dgs5: pick(5), dgs10: pick(10), dgs20: pick(20), dgs30: pick(30) };
    return Object.values(values).every(Number.isFinite) ? { observedAt, values } : null;
  }).filter(Boolean).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const latest = parsed[0] || null;
  if (!latest) return null;
  return {
    schemaVersion: 'us-treasury-curve.v1',
    status: 'ok',
    source: 'U.S. Treasury Daily Par Yield Curve Rates XML Feed',
    sourceKind: 'T1_OFFICIAL',
    sourceUrl: TREASURY_CURVE_URL,
    observedAt: latest.observedAt,
    fetchedAt,
    values: { ...latest.values, t10y2y: round(latest.values.dgs10 - latest.values.dgs2, 3) },
    // Codex review 2026-10-05: earlier sessions of the same feed, so 1-day and 1-week changes are taken
    // from the same official series as the level (newest first).
    series: parsed.slice(0, 8).map((entry) => ({ observedAt: entry.observedAt, values: entry.values })),
    allowedUse: 'official-observation-and-derived-same-date-spread',
    decisionUse: false
  };
}

// Codex review 2026-10-05 (오늘 10년물 +4bp vs 금리·환율 −5bp): the Treasury feed replaced the FRED level
// with a newer date but the FRED change (one session older) stayed beside it. A change is published only
// when both ends come from the official feed, with the date it belongs to; otherwise it is removed.
export function officialTreasuryDeltas(treasury, field) {
  const entries = Array.isArray(treasury?.series) ? treasury.series.filter((entry) => entry?.observedAt < treasury.observedAt) : [];
  const current = Number(treasury?.values?.[field]);
  const at = (index) => Number(entries[index]?.values?.[field]);
  const delta = entries.length >= 1 && Number.isFinite(current) && Number.isFinite(at(0)) ? round(current - at(0), 3) : null;
  const delta5 = entries.length >= 5 && Number.isFinite(current) && Number.isFinite(at(4)) ? round(current - at(4), 3) : null;
  return { delta, delta5, asOf: treasury?.observedAt || null };
}

export async function fetchTreasuryYieldCurve(previous = null) {
  const nowIso = new Date().toISOString();
  const previousFetchedAt = Date.parse(previous?.fetchedAt || '');
  if (previous?.status === 'ok' && Number.isFinite(previousFetchedAt) && Date.now() - previousFetchedAt <= TREASURY_CACHE_MAX_AGE_MS) {
    return { ...previous, attemptedAt: nowIso, status: 'cached-fresh', cacheHit: true };
  }
  try {
    const xml = await _fetchRss(TREASURY_CURVE_URL, 35000);
    const parsed = parseTreasuryYieldCurveXml(xml, nowIso);
    if (!parsed) throw new Error('official Treasury XML feed contained no complete five-point curve');
    return { ...parsed, attemptedAt: nowIso, cacheHit: false };
  } catch (error) {
    const failureReason = String(error?.message || error);
    if (previous?.values && previous?.observedAt) return { ...previous, status: 'stale', attemptedAt: nowIso, failureReason, cacheHit: false };
    return {
      schemaVersion: 'us-treasury-curve.v1', status: 'unavailable', source: 'U.S. Treasury Daily Par Yield Curve Rates',
      sourceKind: 'T1_OFFICIAL', sourceUrl: TREASURY_CURVE_URL, observedAt: null, fetchedAt: null,
      attemptedAt: nowIso, values: {}, failureReason, allowedUse: 'none', decisionUse: false
    };
  }
}

function inferAaiiObservationDate(monthName, day, fetchedAt) {
  const monthIndex = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(String(monthName || '').slice(0, 3).toLowerCase());
  const fetched = new Date(fetchedAt);
  if (monthIndex < 0 || !Number.isFinite(fetched.getTime())) return null;
  let year = fetched.getUTCFullYear();
  let candidate = new Date(Date.UTC(year, monthIndex, Number(day)));
  if (candidate.getTime() > fetched.getTime() + 14 * 86400000) {
    year -= 1;
    candidate = new Date(Date.UTC(year, monthIndex, Number(day)));
  }
  return Number.isFinite(candidate.getTime()) ? candidate.toISOString().slice(0, 10) : null;
}

export function parseAaiiSentimentText(text, fetchedAt = new Date().toISOString(), relayUrl = null) {
  const normalized = String(text || '')
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/\s+/g, ' ');
  const matches = [...normalized.matchAll(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})\s+(\d{1,3}(?:\.\d+)?)%\s*(\d{1,3}(?:\.\d+)?)%\s*(\d{1,3}(?:\.\d+)?)%/gi)];
  const rows = matches.map((match) => {
    const observedAt = inferAaiiObservationDate(match[1], Number(match[2]), fetchedAt);
    const bullish = Number(match[3]);
    const neutral = Number(match[4]);
    const bearish = Number(match[5]);
    const total = bullish + neutral + bearish;
    return observedAt && [bullish, neutral, bearish].every(value => value >= 0 && value <= 100) && Math.abs(total - 100) <= 0.3
      ? { observedAt, bullish, neutral, bearish }
      : null;
  }).filter(Boolean).sort((a, b) => b.observedAt.localeCompare(a.observedAt));
  const latest = rows[0] || null;
  if (!latest) return null;
  return {
    status: 'current-reference',
    ...latest,
    spread: round(latest.bullish - latest.bearish, 1),
    period: `week-ending-${latest.observedAt}`,
    source: 'AAII Sentiment Survey',
    sourceKind: relayUrl ? 'publisher-public-web-via-reader-relay' : 'publisher-public-web',
    sourceUrl: AAII_SENTIMENT_URL,
    relayUrl,
    fetchedAt,
    access: 'public-web-terms-apply',
    allowedUse: 'reference-only',
    decisionUse: false,
    note: relayUrl
      ? 'Official public percentages collected through a bounded text relay after the publisher blocked direct automation; reference-only and excluded from trading gates.'
      : 'Official public percentages collected directly; reference-only and excluded from trading gates.'
  };
}

export async function fetchAaiiSentiment(previous = null) {
  const nowIso = new Date().toISOString();
  const previousFetchedAt = Date.parse(previous?.fetchedAt || '');
  if (previous?.status === 'current-reference' && Number.isFinite(previousFetchedAt) && Date.now() - previousFetchedAt <= AAII_CACHE_MAX_AGE_MS) {
    return { ...previous, attemptedAt: nowIso, cacheHit: true };
  }
  const failures = [];
  for (const candidate of [
    { url: AAII_SENTIMENT_URL, timeoutMs: 15000, relayUrl: null },
    { url: AAII_READER_URL, timeoutMs: 25000, relayUrl: AAII_READER_URL }
  ]) {
    try {
      const text = await _fetchRss(candidate.url, candidate.timeoutMs);
      const parsed = parseAaiiSentimentText(text, nowIso, candidate.relayUrl);
      if (!parsed) throw new Error('no complete dated AAII percentage row');
      return { ...parsed, attemptedAt: nowIso, cacheHit: false };
    } catch (error) {
      failures.push(`${candidate.relayUrl ? 'relay' : 'direct'}:${String(error?.message || error)}`);
    }
  }
  if (previous?.observedAt) return { ...previous, status: 'stale-reference', attemptedAt: nowIso, failureReason: failures.join(' | '), cacheHit: false };
  return {
    status: 'unavailable', bullish: null, neutral: null, bearish: null, spread: null, observedAt: null,
    source: 'AAII Sentiment Survey', sourceKind: 'publisher-public-web', sourceUrl: AAII_SENTIMENT_URL,
    fetchedAt: null, attemptedAt: nowIso, failureReason: failures.join(' | '), allowedUse: 'none', decisionUse: false
  };
}

// AR-07 Batch 0/QG-06: a missing FRED key or a transient series failure must
// not erase a usable last-known-good macro payload. The original observation
// dates remain on each field and the meta status still says the new fetch did
// not succeed, so this is never presented as a fresh observation.
export function mergeMacroLastKnownGood(current, previous) {
  if (!previous || typeof previous !== 'object') return current || {};
  const merged = { ...previous, ...(current || {}) };
  // P1142: `_failureReason`은 no-key/plane-fail 런에서만 설정되고 keyed 성공 런은 이 필드를
  // 쓰지 않는다. spread는 previous-only 키를 보존하므로, 키를 등록한 뒤 성공한 런에서도 과거
  // `api-key-not-configured`가 완성된 FRED 런 옆에 계속 게시되는 모순이 생겼다(data.json:599 vs meta).
  // keyed 런(`_source: 'fred'`)이면 이전 런의 실패 사유를 지운다 — no-key/plane-fail 런은
  // 자신의 `_failureReason`이 spread에서 current 쪽으로 이기므로 그대로 유지된다.
  if (current?._source === 'fred' && merged._failureReason) delete merged._failureReason;
  // A retained value keeps its original observation date, but it must not keep
  // the source/status of the failed current fetch. Otherwise downstream readers
  // can mistake an LKG carry-forward for a newly observed official value.
  for (const field of Object.keys(FRED_SERIES)) {
    const currentValue = Number(current?.[field]);
    const previousValue = Number(previous?.[field]);
    if (Number.isFinite(currentValue)) {
      // P1090: `_freshness_*` is published as the field's CURRENT freshness, but the
      // old code only ever set it — never cleared it. Once a field had been carried
      // forward in any earlier cycle it kept reading `stale-reference` forever, even
      // after every source recovered. All 19 macro fields were published as stale
      // while `_source_*` named a live official primary fetch, which made a real
      // last-known-good indistinguishable from a refreshed value.
      // P1385: unconditional — a newly added series (fedTargetLower/Upper, P1375) had no previous
      // marker, so it was published with `_source_*` but no `_freshness_*` and CI went red.
      merged[`_freshness_${field}`] = 'observed';
      continue;
    }
    if (!Number.isFinite(previousValue)) continue;
    const previousSource = previous?.[`_source_${field}`] || previous?._source || 'unknown';
    merged[`_originSource_${field}`] = previous?.[`_originSource_${field}`] || previousSource;
    merged[`_source_${field}`] = 'last-known-good';
    merged[`_freshness_${field}`] = 'stale-reference';
  }
  // `_failedSeries` names this run's failures only; a series that failed in an earlier run and recovered (or is
  // carried as last-known-good above, marked by its own `_source_*`/`_freshness_*`) is not re-listed.
  merged._failedSeries = [...new Set(Array.isArray(current?._failedSeries) ? current._failedSeries : [])];
  merged._lastKnownGoodAt = previous._lastKnownGoodAt || previous._asOf_hyOAS || null;
  return merged;
}

function _decodeOfficialHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&#34;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function _signedPercent(direction, value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return /^decreas/i.test(String(direction || '')) ? -parsed : parsed;
}

// P869: FRED publication lag must not leave a newly released PCE print blank or
// stale. BEA's release page is the primary source for the current headline/core
// PCE rates; observation period, release time and next release remain separate.
// BEA publishes the monthly change and the twelve-month change in separate
// paragraphs, and inside the monthly paragraph the goods/services/food/energy
// detail sits between the headline and core sentences. A bounded look-ahead
// window therefore crossed the paragraph boundary and captured the
// twelve-month figure: the published `corePceMoM` was 3.3, exactly the core
// YoY 3.3, beside a correct `pceMoM` of 0.2 (P1096). Slice each paragraph by
// its own lead-in and parse the headline/core pair inside that slice.
function _beaParagraph(text, startRe, endRe) {
  const source = String(text || '');
  const start = source.search(startRe);
  if (start < 0) return '';
  const rest = source.slice(start);
  const end = endRe ? rest.search(endRe) : -1;
  return end > 0 ? rest.slice(0, end) : rest;
}

// Headline and core are read from the SAME paragraph slice, independently. The
// twelve-month paragraph can never supply a monthly figure, and an absent
// monthly core clause stays null instead of borrowing a neighbouring period.
function _beaHeadline(section) {
  const match = section.match(/the PCE price index for [A-Za-z]+ (increased|decreased)\s+([0-9.]+)\s+percent/i);
  return match ? _signedPercent(match[1], match[2]) : null;
}

function _beaCore(section) {
  const match = section.match(/Excluding food and energy,\s+(?:the PCE price index\s+)?(increased|decreased)\s+([0-9.]+)\s+percent/i);
  return match ? _signedPercent(match[1], match[2]) : null;
}

export function parseBeaPceHtml(html, releaseUrl = null, fetchedAt = new Date().toISOString()) {
  const text = _decodeOfficialHtml(html);
  const title = text.match(/Personal Income and Outlays,\s+([A-Za-z]+)\s+(\d{4})/i);
  const yoySection = _beaParagraph(text, /same month one year ago/i, /next release/i);
  const momSection = _beaParagraph(text, /preceding month/i, /same month one year ago/i);
  const pce = _beaHeadline(yoySection);
  const corePce = _beaCore(yoySection);
  const pceMoM = _beaHeadline(momSection);
  const corePceMoM = _beaCore(momSection);
  const release = text.match(/RELEASE AT[\s\S]{0,100}?,\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday),?\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  const next = text.match(/Next release:\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
  if (!title || !Number.isFinite(pce) || !Number.isFinite(corePce)) throw new Error('BEA_PCE_PARSE_REQUIRED_FIELDS_MISSING');
  const observationDate = new Date(`${title[1]} 1, ${title[2]} 00:00:00 UTC`);
  const releaseDate = release ? new Date(`${release[1]} 12:30:00 UTC`) : null;
  const nextReleaseDate = next ? new Date(`${next[1]} 12:30:00 UTC`) : null;
  if (Number.isNaN(observationDate.getTime())) {
    throw new Error('BEA_PCE_PARSE_INVALID_VALUES');
  }
  return {
    status: 'ok',
    source: 'U.S. Bureau of Economic Analysis',
    sourceKind: 'T1_OFFICIAL',
    allowedUse: 'macro-evidence-with-observation-release-and-fetch-time',
    releaseUrl,
    observationPeriod: `${title[1]} ${title[2]}`,
    observedAt: observationDate.toISOString().slice(0, 10),
    releasedAt: releaseDate && !Number.isNaN(releaseDate.getTime()) ? releaseDate.toISOString() : null,
    nextReleaseAt: nextReleaseDate && !Number.isNaN(nextReleaseDate.getTime()) ? nextReleaseDate.toISOString() : null,
    fetchedAt,
    lastSuccessfulAt: fetchedAt,
    values: { pce, corePce, pceMoM, corePceMoM },
  };
}

export async function fetchBeaPce(previous = null) {
  const attemptedAt = new Date().toISOString();
  try {
    const indexUrl = 'https://www.bea.gov/news/current-releases';
    const indexHtml = await _fetchRss(indexUrl, 12000);
    const match = indexHtml.match(/href=["']([^"']*personal-income-and-outlays[^"']*)["']/i);
    if (!match) throw new Error('BEA_PCE_RELEASE_LINK_MISSING');
    const releaseUrl = new URL(match[1], indexUrl).toString();
    const releaseHtml = await _fetchRss(releaseUrl, 12000);
    return { ...parseBeaPceHtml(releaseHtml, releaseUrl, attemptedAt), attemptedAt };
  } catch (error) {
    console.warn(`[fetch-data] BEA PCE 실패: ${error && error.message || error}`);
    // P1572: the carried row is spread first so a failed attempt can never republish it as 'ok'.
    return {
      ...(previous && typeof previous === 'object' ? previous : {}),
      status: previous && previous.values ? 'last-known-good' : 'unavailable',
      source: 'U.S. Bureau of Economic Analysis',
      sourceKind: 'T1_OFFICIAL',
      allowedUse: 'reference-only',
      attemptedAt,
      fetchedAt: null,
      lastSuccessfulAt: previous && previous.lastSuccessfulAt || null,
      failureReason: String(error && error.message || error),
    };
  }
}

// ── CNN Fear & Greed (봇차단 우회용 브라우저 유사 헤더) ──
export async function fetchFearGreed(previous = null) {
  const attemptedAt = new Date().toISOString();
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
      const normalizedHistory = (Array.isArray(j?.fear_and_greed_historical?.data) ? j.fear_and_greed_historical.data : [])
        .map((row) => {
          const timestamp = Number(row?.x);
          const score = Number(row?.y);
          if (!Number.isFinite(timestamp) || !Number.isFinite(score)) return null;
          return {
            observedAt: new Date(timestamp).toISOString(),
            score: round(score, 2),
            rating: row?.rating || null
          };
        })
        .filter(Boolean);
      // The response carries the daily series (midnight timestamps) plus an
      // intraday reading, so keying by full timestamp published two points for
      // one calendar day — a daily series a day-join cannot use (P1100).
      // Keep one point per day and prefer CNN's own daily marker.
      const byDay = new Map();
      for (const row of normalizedHistory) {
        const day = row.observedAt.slice(0, 10);
        const current = byDay.get(day);
        if (!current || row.observedAt.endsWith('T00:00:00.000Z')) byDay.set(day, row);
      }
      const history = [...byDay.values()]
        .sort((a, b) => a.observedAt.localeCompare(b.observedAt))
        .slice(-420);
      return {
        score: Math.round(fg.score),
        rating: fg.rating || null,
        _source: 'cnn',
        sourceUrl: 'https://www.cnn.com/markets/fear-and-greed',
        asOf: fg.timestamp || null,
        // CNN API의 previous_close = 전일 종가 시점 F&G 점수
        previousScore: typeof fg.previous_close === 'number' ? Math.round(fg.previous_close) : null,
        previousWeek: typeof fg.previous_1_week === 'number' ? Math.round(fg.previous_1_week) : null,
        history,
        attemptedAt,
        fetchedAt: attemptedAt,
        status: 'current-reference',
      };
    }
  } catch (e) {}
  if (previous && Number.isFinite(Number(previous.score))) {
    return {
      ...previous,
      _source: previous._source || 'cnn:last-known-good',
      status: 'stale-reference',
      attemptedAt,
      fetchedAt: null,
      failureReason: 'cnn-fear-greed-unavailable'
    };
  }
  return { _source: 'cnn:fail', status: 'unavailable', attemptedAt, fetchedAt: null };
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
      displayRole: config.displayRole || null,
      definition: config.definition || null,
      source: 'BLS Public Data API v1',
    sourceKind: 'T1_OFFICIAL',
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
    sourceKind: 'T1_OFFICIAL',
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

// CPI and NFP print at 08:30 ET (12:30Z in EDT, 13:30Z in EST). On a scheduled release date a cache filled before
// 13:35Z is bypassed from 12:35Z on, so the new print is not held back for the full cache age. `schedules` is the
// macro-calendar.json `schedules` object (arrays of YYYY-MM-DD under 'us-cpi' / 'us-nfp').
export const BLS_RELEASE_SCHEDULE_IDS = Object.freeze(['us-cpi', 'us-nfp']);
export function blsReleaseCacheBypass(previousFetchedAtMs, nowMs, schedules = null) {
  if (!Number.isFinite(previousFetchedAtMs) || !Number.isFinite(nowMs) || !schedules || typeof schedules !== 'object') return false;
  return BLS_RELEASE_SCHEDULE_IDS.some((id) => (Array.isArray(schedules[id]) ? schedules[id] : []).some((date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) return false;
    const opens = Date.parse(`${date}T12:35:00Z`);
    const settles = Date.parse(`${date}T13:35:00Z`);
    return nowMs >= opens && previousFetchedAtMs < settles;
  }));
}

export async function fetchBlsSeries(previous = null, { releaseSchedules = null, nowMs = Date.now() } = {}) {
  const now = new Date(nowMs);
  const nowIso = now.toISOString();
  const previousFetchedAt = previous && previous.fetchedAt ? new Date(previous.fetchedAt).getTime() : NaN;
  if (previous && Number.isFinite(previousFetchedAt) && nowMs - previousFetchedAt <= BLS_CACHE_MAX_AGE_MS
      && !blsReleaseCacheBypass(previousFetchedAt, nowMs, releaseSchedules)) {
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
    sourceKind: 'T1_OFFICIAL',
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
    sourceKind: 'T3_PUBLIC_DELAYED',
    allowedUse: 'decision-with-daily-delay'
  };
}

// P1573: Cboe posts a session's ratios after the close, so the page may lag one session.
// Anything older than the session before the latest completed US close is stale, not current.
export function classifyCboePutCallCurrentness(asOf, now = Date.now()) {
  const session = latestCompletedUsSession(now);
  if (!asOf || !session) return 'stale-reference';
  const oldestCurrent = session.previousDate || session.date;
  return asOf >= oldestCurrent ? 'current-reference' : 'stale-reference';
}

export async function fetchCboePutCall() {
  const attemptedAt = new Date().toISOString();
  try {
    const html = await _fetchRss('https://www.cboe.com/data/mktstat.aspx', 18000);
    const parsed = parseCboePutCallHtml(html);
    if (!parsed) throw new Error('official page did not contain ratio/date contract');
    return { ...parsed, attemptedAt, status: classifyCboePutCallCurrentness(parsed.asOf) };
  } catch (error) {
    console.warn('[fetch-data] Cboe Put/Call 수집 실패:', error && error.message || error);
    return { source: 'Cboe Daily Market Statistics', sourceKind: 'unavailable', allowedUse: 'none', fetchedAt: null, attemptedAt, status: 'unavailable', totalPutCall: null, error: String(error && error.message || error) };
  }
}

