// macro-history.json and macro-calendar.json lanes: raw FRED observations and official release schedules.
// Split out of scripts/fetch-data.mjs (pipeline redesign, 2026-10-19); fetch-data.mjs keeps the run order and re-exports
// every name it exported before.
import { readFile } from 'node:fs/promises';
import { atomicWriteFile } from '../lib/atomic-write.mjs';
import { buildIsmRuleEvents, buildMacroCalendarPayload, resolveFomcSchedule } from '../lib/official-calendars.mjs';
import { fetchJSON, _fetchRss } from '../lib/producer-http.mjs';
import { REPO_ROOT } from './paths.mjs';

// P1426 (owner review 2026-10-03): the 거시 screen needs direction, not just the latest print — the
// three-month pace of inflation, the Sahm-rule unemployment gap, the payroll trend, weekly claims and
// a year of daily rates/credit. One raw-observation artifact from FRED (the operator key in Actions);
// every derived figure is computed in src/domain/macro so the rule and its inputs stay inspectable.
// A series that fails keeps its previous observations, marked stale, instead of disappearing.
export const MACRO_HISTORY_SERIES = Object.freeze({
  cpiIndex:       { id: 'CPIAUCSL',      frequency: 'monthly', limit: 40,  unit: 'index', label: 'CPI-U (계절조정 지수)' },
  coreCpiIndex:   { id: 'CPILFESL',      frequency: 'monthly', limit: 40,  unit: 'index', label: '근원 CPI-U (계절조정 지수)' },
  // P1427: the official headline YoY is the NSA index; cards plot NSA so their history matches the value shown.
  cpiIndexNsa:    { id: 'CPIAUCNS',      frequency: 'monthly', limit: 40,  unit: 'index', label: 'CPI-U (계절조정 전 지수)' },
  coreCpiIndexNsa:{ id: 'CPILFENS',      frequency: 'monthly', limit: 40,  unit: 'index', label: '근원 CPI-U (계절조정 전 지수)' },
  pceIndex:       { id: 'PCEPI',         frequency: 'monthly', limit: 40,  unit: 'index', label: 'PCE 물가지수' },
  corePceIndex:   { id: 'PCEPILFE',      frequency: 'monthly', limit: 40,  unit: 'index', label: '근원 PCE 물가지수' },
  unemployment:   { id: 'UNRATE',        frequency: 'monthly', limit: 40,  unit: 'percent', label: '실업률' },
  // v58.55 (개편 v2 3e): CBO's natural rate of unemployment for the Taylor-rule reference (Okun gap). FRED also carries CBO's
  // projections years ahead, so the request stops at today — the latest row is the current quarter's estimate, not 2036.
  naturalUnemployment: { id: 'NROU',     frequency: 'quarterly', limit: 12, unit: 'percent', label: '자연실업률 (CBO 추정)', throughToday: true },
  payrolls:       { id: 'PAYEMS',        frequency: 'monthly', limit: 40,  unit: 'thousands', label: '비농업 고용자 수' },
  hourlyEarnings: { id: 'CES0500000003', frequency: 'monthly', limit: 40,  unit: 'usd-per-hour', label: '평균 시간당 임금' },
  retailSales:    { id: 'RSAFS',         frequency: 'monthly', limit: 40,  unit: 'usd-millions', label: '소매판매' },
  housingStarts:  { id: 'HOUST',         frequency: 'monthly', limit: 40,  unit: 'thousands-saar', label: '주택 착공' },
  // 2026-10-19 (expertise review): permits lead starts; shelter and services ex-shelter ("supercore") split sticky CPI.
  buildingPermits:{ id: 'PERMIT',        frequency: 'monthly', limit: 40,  unit: 'thousands-saar', label: '건축 허가' },
  shelterCpiIndex:{ id: 'CUSR0000SAH1',  frequency: 'monthly', limit: 40,  unit: 'index', label: 'CPI 주거비 (계절조정 지수)' },
  supercoreCpiIndex:{ id: 'CUSR0000SASL2RS', frequency: 'monthly', limit: 40, unit: 'index', label: 'CPI 주거비 제외 서비스 (계절조정 지수)' },
  fedFunds:       { id: 'FEDFUNDS',      frequency: 'monthly', limit: 40,  unit: 'percent', label: '실효 연방기금금리' },
  initialClaims:  { id: 'ICSA',          frequency: 'weekly',  limit: 110, unit: 'claims', label: '신규 실업수당 청구' },
  fedTargetUpper: { id: 'DFEDTARU',      frequency: 'daily',   limit: 400, unit: 'percent', label: '연준 목표 상단' },
  dgs2:           { id: 'DGS2',          frequency: 'daily',   limit: 280, unit: 'percent', label: '미 국채 2년' },
  dgs10:          { id: 'DGS10',         frequency: 'daily',   limit: 280, unit: 'percent', label: '미 국채 10년' },
  // v58.55 (개편 v2 5e): the remaining tenors of the 금리 · 환율 curve, so its dashed "1개월 전" line can be drawn. The
  // Treasury XML feed the curve reads carries only the current month (~8 sessions); FRED's H.15 constant-maturity series
  // are the same Treasury par yields with history. 50 observations (~10 weeks with holidays) cover 21 sessions back.
  dgs5:           { id: 'DGS5',          frequency: 'daily',   limit: 50,  unit: 'percent', label: '미 국채 5년' },
  dgs20:          { id: 'DGS20',         frequency: 'daily',   limit: 50,  unit: 'percent', label: '미 국채 20년' },
  dgs30:          { id: 'DGS30',         frequency: 'daily',   limit: 50,  unit: 'percent', label: '미 국채 30년' },
  // v58.56 (re-audit #9): the short and middle tenors the curve was missing (1개월·3개월·6개월·1년·3년·7년). The Treasury
  // XML feed now carries them for today's cut (scripts/lib/macro-sources.mjs); these H.15 series give the same par yields
  // with history for the dashed "1개월 전" line, and DGS3MO replaces the 3-month point derived from T10Y3M.
  dgs1mo:         { id: 'DGS1MO',        frequency: 'daily',   limit: 50,  unit: 'percent', label: '미 국채 1개월' },
  dgs3mo:         { id: 'DGS3MO',        frequency: 'daily',   limit: 50,  unit: 'percent', label: '미 국채 3개월' },
  dgs6mo:         { id: 'DGS6MO',        frequency: 'daily',   limit: 50,  unit: 'percent', label: '미 국채 6개월' },
  dgs1:           { id: 'DGS1',          frequency: 'daily',   limit: 50,  unit: 'percent', label: '미 국채 1년' },
  dgs3:           { id: 'DGS3',          frequency: 'daily',   limit: 50,  unit: 'percent', label: '미 국채 3년' },
  dgs7:           { id: 'DGS7',          frequency: 'daily',   limit: 50,  unit: 'percent', label: '미 국채 7년' },
  // v58.56 (re-audit #14): the FOMC Summary of Economic Projections' longer-run federal funds rate median (FRED FEDTARMDLR,
  // "Longer Run FOMC Summary of Economic Projections for the Fed Funds Rate, Median", one observation per SEP release date,
  // four a year). The Taylor tile's default r* = this median − the 2% inflation target, shown with the SEP date.
  sepLongRunFedFunds: { id: 'FEDTARMDLR', frequency: 'sep-release', limit: 8, unit: 'percent', label: 'FOMC 장기 연방기금금리 전망 중앙값 (SEP)' },
  t10y3m:         { id: 'T10Y3M',        frequency: 'daily',   limit: 280, unit: 'percentage-point', label: '10년-3개월 금리차' },
  realYield10:    { id: 'DFII10',        frequency: 'daily',   limit: 280, unit: 'percent', label: '10년 실질금리 (TIPS)' },
  breakeven10:    { id: 'T10YIE',        frequency: 'daily',   limit: 280, unit: 'percent', label: '10년 기대인플레이션' },
  // P1469 (review 2026-10-04, term premium): the Federal Reserve Board's Kim-Wright 10-year term premium
  // (model estimate, official FRED series). NY Fed ACM is published only as a spreadsheet, so the same
  // concept is taken from the official FRED path and named by its model on screen.
  termPremium10:  { id: 'THREEFYTP10',   frequency: 'daily',   limit: 280, unit: 'percent', label: '10년 기간 프리미엄 (Kim-Wright)' },
  hyOas:          { id: 'BAMLH0A0HYM2',  frequency: 'daily',   limit: 280, unit: 'percent', label: '하이일드 스프레드' },
  // P1586: investment-grade OAS — the junk-bond component is HY minus IG.
  igOas:          { id: 'BAMLC0A0CM',    frequency: 'daily',   limit: 280, unit: 'percent', label: '투자등급 회사채 스프레드' },
  // P1638: rating tiers — stress usually starts in the weakest borrowers (CCC) before the HY average moves.
  bbOas:          { id: 'BAMLH0A1HYBB',  frequency: 'daily',   limit: 280, unit: 'percent', label: 'BB 등급 스프레드' },
  bOas:           { id: 'BAMLH0A2HYB',   frequency: 'daily',   limit: 280, unit: 'percent', label: 'B 등급 스프레드' },
  cccOas:         { id: 'BAMLH0A3HYC',   frequency: 'daily',   limit: 280, unit: 'percent', label: 'CCC 이하 스프레드' },
  // P1654 (owner 2026-10-12: fill free official data gaps): liquidity, growth and wider commodity/FX context from the
  // same operator FRED key. Raw observations only; readings are derived in src/domain/macro.
  fedBalanceSheet:{ id: 'WALCL',         frequency: 'weekly',  limit: 110, unit: 'usd-millions', label: '연준 총자산' },
  reverseRepo:    { id: 'RRPONTSYD',     frequency: 'daily',   limit: 280, unit: 'usd-billions', label: '역레포 잔액' },
  treasuryAccount:{ id: 'WTREGEN',       frequency: 'weekly',  limit: 110, unit: 'usd-millions', label: '재무부 일반계정(TGA)' },
  sofr:           { id: 'SOFR',          frequency: 'daily',   limit: 280, unit: 'percent', label: 'SOFR 단기금리' },
  financialConditions: { id: 'NFCI',     frequency: 'weekly',  limit: 110, unit: 'index', label: '시카고 연은 금융여건지수' },
  realGdp:        { id: 'GDPC1',         frequency: 'quarterly', limit: 24, unit: 'usd-billions-chained', label: '실질 GDP' },
  ppiFinalDemand: { id: 'PPIFIS',        frequency: 'monthly', limit: 40,  unit: 'index', label: '생산자물가(최종수요)' },
  consumerSentiment: { id: 'UMCSENT',    frequency: 'monthly', limit: 40,  unit: 'index', label: '미시간대 소비자심리' },
  jobOpenings:    { id: 'JTSJOL',        frequency: 'monthly', limit: 40,  unit: 'thousands', label: '구인 건수(JOLTS)' },
  brent:          { id: 'DCOILBRENTEU',  frequency: 'daily',   limit: 280, unit: 'usd-per-barrel', label: '브렌트유' },
  natGas:         { id: 'DHHNGSP',       frequency: 'daily',   limit: 280, unit: 'usd-per-mmbtu', label: '천연가스(헨리허브)' },
  copper:         { id: 'PCOPPUSDM',     frequency: 'monthly', limit: 40,  unit: 'usd-per-ton', label: '구리' },
  usdCny:         { id: 'DEXCHUS',       frequency: 'daily',   limit: 280, unit: 'cny-per-usd', label: '위안/달러' }
});
export const MACRO_HISTORY_OUT = `${REPO_ROOT}/public-data/macro-history.json`;

export function parseFredObservations(payload) {
  return (payload?.observations || [])
    .map((row) => ({ date: String(row?.date || ''), value: Number.parseFloat(row?.value) }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.value))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 2026-10-14 (live review 4f): decades of context for the few gauges a reader compares with history — monthly means since
// 1990 (or the series' start) via FRED's own aggregation/transformation. Carried inside macro-history.json as `long`
// and refetched at most once a day. The screen reads where today's value sits in that history; a range, not a forecast.
export const MACRO_LONG_SERIES = Object.freeze({
  fedFunds:     { id: 'FEDFUNDS',     units: 'lin', unit: 'percent', label: '기준금리(실효 연방기금금리)' },
  dgs10:        { id: 'DGS10',        units: 'lin', unit: 'percent', label: '미국 10년물 금리' },
  dgs2:         { id: 'DGS2',         units: 'lin', unit: 'percent', label: '미국 2년물 금리' },
  t10y3m:       { id: 'T10Y3M',       units: 'lin', unit: 'percentage-points', label: '10년물 − 3개월물 금리차' },
  realYield10:  { id: 'DFII10',       units: 'lin', unit: 'percent', label: '10년 실질금리' },
  coreCpiYoY:   { id: 'CPILFESL',     units: 'pc1', unit: 'percent', label: '근원 CPI 전년 대비' },
  unemployment: { id: 'UNRATE',       units: 'lin', unit: 'percent', label: '실업률' },
  vix:          { id: 'VIXCLS',       units: 'lin', unit: 'index', label: 'VIX' }
});
export async function collectMacroLongHistory(key, previousLong, { fetchFn = fetchJSON, nowMs = Date.now(), minAgeMs = 20 * 3600000 } = {}) {
  const previousMs = Date.parse(previousLong?.generatedAt || '');
  if (previousLong?.series && Number.isFinite(previousMs) && nowMs - previousMs >= 0 && nowMs - previousMs < minAgeMs) return previousLong; // a series FRED cannot serve is retried next day, not every run
  const series = {};
  const failed = [];
  for (const [field, spec] of Object.entries(MACRO_LONG_SERIES)) {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${spec.id}&api_key=${key}&file_type=json&observation_start=1990-01-01&frequency=m&aggregation_method=avg&units=${spec.units}`;
    try {
      const observations = parseFredObservations(await fetchFn(url));
      if (observations.length < 120) throw new Error('too-few-observations');
      series[field] = { id: spec.id, label: spec.label, unit: spec.unit, transform: spec.units === 'pc1' ? 'percent-change-from-year-ago' : 'monthly-mean', observations: observations.map((row) => [row.date.slice(0, 7), Math.round(row.value * 100) / 100]) };
    } catch (error) {
      failed.push(field);
      const kept = previousLong?.series?.[field];
      if (kept?.observations?.length) series[field] = { ...kept, stale: true };
      console.warn(`[fetch-data] macro long history ${spec.id} failed: ${error?.message || error}`);
    }
  }
  if (!Object.keys(series).length) return previousLong || null;
  return { generatedAt: new Date(nowMs).toISOString(), frequency: 'monthly', columns: ['month', 'value'], failed, series };
}

// The newest `limit` observations of one series; a series with published projections (NROU) stops at today.
export function macroHistoryUrl(spec, key, nowMs = Date.now()) {
  const end = spec.throughToday ? `&observation_end=${new Date(nowMs).toISOString().slice(0, 10)}` : '';
  return `https://api.stlouisfed.org/fred/series/observations?series_id=${spec.id}&api_key=${key}&file_type=json&sort_order=desc&limit=${spec.limit}${end}`;
}

export async function writeMacroHistory(key, { fetchFn = fetchJSON, nowMs = Date.now() } = {}) {
  let previous = null;
  try { previous = JSON.parse(await readFile(MACRO_HISTORY_OUT, 'utf8')); } catch { /* first producer run */ }
  if (!key) return { written: false, reason: 'api-key-not-configured' };
  const series = {};
  const failed = [];
  for (const [field, spec] of Object.entries(MACRO_HISTORY_SERIES)) {
    const url = macroHistoryUrl(spec, key, nowMs);
    try {
      const observations = parseFredObservations(await fetchFn(url));
      if (observations.length < 3) throw new Error('too-few-observations');
      series[field] = { id: spec.id, label: spec.label, frequency: spec.frequency, unit: spec.unit, fetchedAt: new Date(nowMs).toISOString(), stale: false, observations: observations.map((row) => [row.date, row.value]) };
    } catch (error) {
      failed.push(field);
      const kept = previous?.series?.[field];
      if (kept?.observations?.length) series[field] = { ...kept, stale: true };
      console.warn(`[fetch-data] macro history ${spec.id} failed: ${error?.message || error}`);
    }
  }
  if (!Object.keys(series).length) return { written: false, reason: 'all-series-failed' };
  const payload = {
    schemaVersion: 'macro-history.v1',
    generatedAt: new Date(nowMs).toISOString(),
    source: 'FRED, Federal Reserve Bank of St. Louis',
    sourceKind: 'T1_OFFICIAL',
    status: failed.length ? 'partial' : 'ok',
    failed,
    columns: ['date', 'value'],
    series,
    long: await collectMacroLongHistory(key, previous?.long || null, { fetchFn, nowMs }).catch(() => previous?.long || null)
  };
  await atomicWriteFile(MACRO_HISTORY_OUT, JSON.stringify(payload));
  return { written: true, series: Object.keys(series).length, failed };
}

// P1654: the release dates of the four FRED-published indicators the calendar shows. The browser calendar was a
// hand-maintained array that ran out after 2026-12; the producer now writes the official FRED release schedule each
// run (BOK is not a FRED release and stays on its annual official calendar; FOMC/ISM: see P1731/P1733 below).
export const MACRO_CALENDAR_OUT = `${REPO_ROOT}/public-data/macro-calendar.json`;
export const MACRO_CALENDAR_RELEASES = Object.freeze({ 'us-retail': 9, 'us-cpi': 10, 'us-nfp': 50, 'us-pce': 54 });
// P1731/P1733: the same artifact now also carries the FOMC meetings (official Fed page, rechecked at most every 12h,
// previous parse kept on failure) and the rule-derived ISM PMI dates; neither needs the FRED key. I/O is injectable
// so the gate can run this end to end on fixtures without touching public-data.
export async function writeMacroCalendar(key, { fetchFn = fetchJSON, fetchTextFn = (url) => _fetchRss(url, 15000), nowMs = Date.now(), outPath = MACRO_CALENDAR_OUT, readFn = readFile, writeFn = atomicWriteFile } = {}) {
  let previous = null;
  try { previous = JSON.parse(await readFn(outPath, 'utf8')); } catch { /* first producer run */ }
  const start = new Date(nowMs - 45 * 86400000).toISOString().slice(0, 10);
  const end = new Date(nowMs + 400 * 86400000).toISOString().slice(0, 10);
  const schedules = {};
  const failed = [];
  for (const [calendarId, releaseId] of Object.entries(MACRO_CALENDAR_RELEASES)) {
    if (!key) { failed.push(calendarId); continue; }
    const url = `https://api.stlouisfed.org/fred/release/dates?release_id=${releaseId}&realtime_start=${start}&realtime_end=${end}&include_release_dates_with_no_data=true&sort_order=asc&limit=60&api_key=${key}&file_type=json`;
    try {
      const payload = await fetchFn(url);
      const dates = [...new Set((payload?.release_dates || []).map((row) => String(row?.date || '')).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)))].sort();
      if (!dates.length) throw new Error('no-dates');
      schedules[calendarId] = dates;
    } catch (error) {
      failed.push(calendarId);
      console.warn(`[fetch-data] macro calendar ${calendarId} failed: ${error?.message || error}`);
    }
  }
  const fomc = await resolveFomcSchedule({ previous, fetchHtml: fetchTextFn, nowMs });
  if (fomc.meta.fomcStatus !== 'ok') console.warn(`[fetch-data] FOMC calendar ${fomc.meta.fomcStatus}: ${fomc.meta.fomcReason}`);
  const ismEvents = buildIsmRuleEvents({ fromMs: nowMs - 45 * 86400000, toMs: nowMs + 400 * 86400000 });
  const payload = buildMacroCalendarPayload({ nowMs, fredSchedules: schedules, fredFailed: failed, fredFailureReason: key ? null : 'api-key-not-configured', previous, fomc, ismEvents });
  if (!payload) return { written: false, reason: 'nothing-to-publish' };
  await writeFn(outPath, JSON.stringify(payload));
  return { written: true, releases: Object.keys(payload.schedules).length, failed, fomcStatus: payload.meta.fomcStatus, fomcReason: payload.meta.fomcReason, fomcFetched: fomc.fetched };
}
