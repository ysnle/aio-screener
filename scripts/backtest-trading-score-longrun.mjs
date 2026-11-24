// ─────────────────────────────────────────────────────────────────────────
// scripts/backtest-trading-score-longrun.mjs — WO-2 reduced-scope validation
//
// 왜: CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md WO-2("Trading Score를 의사결정 도구로 검증")의
//     완료 게이트는 "최소 수년·다중 regime, walk-forward, ablation, calibration"을 요구하지만,
//     public-data/history.json은 실측 확인 결과 약 7개월치(2025-12~)뿐이라 문자 그대로는 불가능
//     (score-backtest-history.json이 스스로 "n>=30 전까지 누적 진행상황"이라 명시하는 이유).
//     사용자 확인(2026-07-10, AskUserQuestion)에 따라 "축소 검증"으로 범위를 좁힌다:
//       (1) computeTradingScore()의 13개 입력 중 breadth200/PCR/AAII-bearish/F&G는 자유 소스로
//           수년치 PIT 데이터를 구할 수 없어 이번 검증 대상에서 제외 — momScore/breadthScore/PCR/
//           AAII 보정은 backtest-trading-score.mjs의 reconstructScore()가 이미 쓰는 것과 동일한
//           중립 상수로 고정한다(근사가 아니라 기존 코드 경로 재현, 새 가정 추가 없음).
//       (2) VIX/VVIX/SPX/TNX/DXY/WTI (신용 축은 FRED HY OAS 다년치가 없어 결측으로 둔다 — HYG 가격 대리는 R343로 제거) — Yahoo Finance chart API로 실제
//           10년치 일별 종가를 fetch 가능함을 사전 실측 확인(2016-07-11~2026-07-10, 7개 심볼
//           전부 2500+ 포인트) — 이 6~7개 입력이 실제로 반영하는 volScore(25%)+trendScore(20%)+
//           macroScore(10%) 및 신용/유가 보정을 진짜 다중 regime(2018 vol spike, 2020 COVID
//           crash, 2022 bear, 2023-25 bull 전부 포함)에 걸쳐 검증한다.
//       (3) 결론은 "computeTradingScore 전체가 검증됨"이 아니라 "매크로/변동성/추세 기반 부분
//           점수가 실제로 forward return과 관계가 있는지"로 명시적으로 한정한다. 화면에 노출되는
//           전체 합성 스코어는 momScore/breadthScore가 여전히 미검증 상태이므로 provisional로 유지.
//
// 통계적 정직성 메모: computeTradingScore()의 가중치·임계값은 fit된 모델 파라미터가 아니라
// 손으로 정한 상수다 — 따라서 "train/tune/test"는 전통적 의미의 모델 적합이 아니라 "고정된 규칙이
// 시간에 걸쳐 일관된 관계를 유지하는지"를 확인하는 것이다. 이 스크립트는 그 구분을 "reference
// period"(전반부)/"holdout period"(후반부)라는 용어로 명확히 하고 "train"이라는 표현을 쓰지 않는다.
// regime 구분도 서술형 역사적 날짜(기억 오류 위험)가 아니라 데이터 자체에서 계산되는 VIX/trailing
// drawdown 임계값으로 프로그램적으로 산출한다.
//
// 실행: node scripts/backtest-trading-score-longrun.mjs [--range=10y] [--out=path]
//       (네트워크 호출 있음 — Yahoo Finance 공개 chart API, 인증 불요. 실시간 cron에는 배선하지
//       않음 — 이 스크립트는 필요 시 수동/비정기 재실행하는 연구용 산출물이다.)
// ─────────────────────────────────────────────────────────────────────────

import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconstructScore } from './backtest-trading-score.mjs';
import { spearmanWithCI, spearmanWithEffectiveCI, nonOverlappingCount } from './lib/rank-statistics.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = null) {
  const pref = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(pref));
  return found ? found.slice(pref.length) : fallback;
}

const RANGE = argValue('range', '10y');
const OUT_PATH = argValue('out', `${__dir}/../public-data/score-backtest-longrun.json`);

const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
// No credit series: the model's credit input is the FRED HY OAS and no free multi-year history of it is fetched
// here. The former HYG-price proxy is gone, so the risk-appetite axis is missing in both baseline and relative scores.
const SYMBOLS = { spx: '^GSPC', vix: '^VIX', vvix: '^VVIX', tnx: '^TNX', dxy: 'DX-Y.NYB', wti: 'CL=F' };
export const SCORE_LONGRUN_CREDIT_INPUT = 'none';
// A file written before the proxy was removed carries no creditInput field; readers label it with this.
export const SCORE_LONGRUN_LEGACY_CREDIT_INPUT = 'legacy-hyg-proxy, not comparable to live';
export const scoreLongrunCreditInput = (artifact) => artifact?.methodology?.creditInput || SCORE_LONGRUN_LEGACY_CREDIT_INPUT;

// ── Yahoo v8/chart 다일 종가 fetch (fetch-data.mjs의 fetchHistory()와 동일한 검증된 URL 패턴을
//    이 스크립트 안에서 자체 재구현 — 프로덕션 cron 파일(fetch-data.mjs)은 건드리지 않는다) ──
async function fetchDailyCloses(symbol, range) {
  for (const host of YAHOO_HOSTS) {
    try {
      const url = host + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=' + range;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const j = await res.json();
      const r = j?.chart?.result?.[0];
      const ts = r?.timestamp;
      const closes = r?.indicators?.quote?.[0]?.close;
      if (!Array.isArray(ts) || !Array.isArray(closes)) continue;
      const out = new Map();
      for (let i = 0; i < ts.length; i++) {
        const c = closes[i];
        if (typeof c === 'number' && isFinite(c)) out.set(new Date(ts[i] * 1000).toISOString().slice(0, 10), c);
      }
      if (out.size > 0) return out;
    } catch { /* 다음 호스트 시도 */ }
  }
  return new Map();
}

async function fetchAllSeries(range) {
  const entries = await Promise.all(
    Object.entries(SYMBOLS).map(async ([field, sym]) => [field, await fetchDailyCloses(sym, range)])
  );
  return Object.fromEntries(entries);
}

// ── 일별 병합: spx가 있는 날만 거래일로 채택(기존 backtest-trading-score.mjs 컨벤션과 동일) ──
function buildMergedSeries(seriesByField) {
  const dates = [...seriesByField.spx.keys()].sort();
  return dates.map((date) => ({
    date,
    spx: seriesByField.spx.get(date) ?? null,
    vix: seriesByField.vix.get(date) ?? null,
    vvix: seriesByField.vvix.get(date) ?? null,
    tnx: seriesByField.tnx.get(date) ?? null,
    dxy: seriesByField.dxy.get(date) ?? null,
    wti: seriesByField.wti.get(date) ?? null,
  }));
}

function trailingMA(series, idx, window, field = 'spx') {
  if (idx - window + 1 < 0) return null;
  let sum = 0;
  for (let i = idx - window + 1; i <= idx; i++) {
    const v = series[i][field];
    if (typeof v !== 'number') return null;
    sum += v;
  }
  return sum / window;
}

export function trailingMax(series, idx, window, field = 'spx') {
  const lo = Math.max(0, idx - window + 1);
  let max = -Infinity;
  for (let i = lo; i <= idx; i++) {
    const v = series[i][field];
    if (typeof v === 'number' && v > max) max = v;
  }
  return max === -Infinity ? null : max;
}

// `lag` moves the entry `lag` sessions after the scored close (a score known at the close cannot be traded at it).
function forwardReturn(series, idx, daysAhead, field = 'spx', lag = 0) {
  const i = idx + lag;
  const j = i + daysAhead;
  if (j >= series.length) return null;
  const cur = series[i][field], fut = series[j][field];
  if (typeof cur !== 'number' || typeof fut !== 'number' || !cur) return null;
  return (fut - cur) / cur * 100;
}

// Re-export the shared tie-aware implementation for the factor long-run
// producer, which historically imported this helper from this module.
export { spearmanWithCI };

// ── A-1 (2026-07-17, REMAINING-WORK §A1): percentile/레짐 상대화 변형 "relative-v1" ──
// 왜: WO-2 원결과(21일 rho=-0.165, 63일 -0.255)의 유력 가설이 "dxy>107/tnx>4.5 같은 절대
//     임계값이 10년 금리 레짐 구조 이동에 대응 못 함" 이었다. 이 변형은 절대 임계값을
//     trailing 롤링 percentile(최대 2520거래일=10y, 최소 252일 warm-up)로 치환해 같은 데이터·
//     같은 밴드 구조·같은 가중치로 재백테스트한다.
// 정직성 메모: percentile 밴드 경계([0.20,0.40,0.60,0.80,0.95] 등)는 데이터에 fit한 값이 아니라
//     원 절대 밴드의 서수 구조를 보존한 손-지정 상수다(5밴드→5밴드). trailing-only라 look-ahead
//     없음. HYG 달러가격 신용 판정·hyBp 변환은 라이브가 P713/P714에서 듀레이션 오염으로 이미
//     제거했으므로 baseline·변형 어디에도 넣지 않는다.
const REL_WINDOW = 2520;   // 최대 10y trailing
const REL_MIN_OBS = 252;   // 최소 1y 확보 전엔 판정 보류(null)

export function rollingPercentile(values, idx, window = REL_WINDOW, minObs = REL_MIN_OBS) {
  const cur = values[idx];
  if (typeof cur !== 'number' || !isFinite(cur)) return null;
  const lo = Math.max(0, idx - window + 1);
  let n = 0, le = 0;
  for (let i = lo; i <= idx; i++) {
    const v = values[i];
    if (typeof v !== 'number' || !isFinite(v)) continue;
    n++;
    if (v <= cur) le++;
  }
  if (n < minObs) return null;
  return le / n;
}

// P9-BT-01 (owner 2026-10-31, "현행 모델로 다시"): relative-v2 changes ONLY the threshold units of the current
// model. Each input's trailing percentile picks the band it falls in (the a-priori edges below keep the ordinal structure
// of the absolute bands), and a representative level inside the matching absolute band of trading-score.js v5 goes into
// the same reconstructScore() the baseline uses — same trend rule, same missing risk-appetite axis (no PCR, no credit
// series), same missing-breadth handling and weights. The baseline-vs-relative gap is then the effect of percentile units alone.
// relative-v1 (2026-07) froze the then-model and is kept only as a summary of the previous file (previousExperiment).
const REL_LEVELS = Object.freeze({
  // [percentile upper edge, representative level] — levels sit inside the current model's bands (vix <15/18/22/27/35,
  // cross-risk vix>25; dxy >107/>110; tnx >4.5; vvix >110; oil >90/>100).
  vix: [[0.20, 13], [0.40, 16.5], [0.60, 20], [0.80, 24.5], [0.95, 31], [Infinity, 40]],
  dxy: [[0.80, 104], [0.90, 108.5], [Infinity, 112]],
  tnx: [[0.80, 4.0], [Infinity, 5.0]],
  vvix: [[0.80, 95], [Infinity, 120]],
  wti: [[0.85, 80], [0.95, 95], [Infinity, 110]]
});
export function percentileLevel(field, p) {
  if (typeof p !== 'number' || !Number.isFinite(p)) return null;
  return REL_LEVELS[field].find(([edge]) => p < edge || (edge === Infinity))[1];
}

export function reconstructRelativeScore({ vixP, dxyP, tnxP, vvixP, wtiP, spxPrice, spx50ma, spx200ma }) {
  // warm-up/결측이면 판정 보류 — 상수 폴백으로 채우지 않는다(fail-closed).
  if (vixP == null || dxyP == null || tnxP == null) return null;
  const result = reconstructScore({
    vix: percentileLevel('vix', vixP), fg: 45, dxy: percentileLevel('dxy', dxyP), tnx: percentileLevel('tnx', tnxP),
    wti: percentileLevel('wti', wtiP), vvix: percentileLevel('vvix', vvixP),
    spxPrice, spx50ma, spx200ma, mode: 'default'
  });
  return { total: result.total, volScore: result.volScore, trendScore: result.trendScore, macroScore: result.macroScore };
}

const horizonOf = (returnField) => Number(String(returnField).match(/\d+/)?.[0] || 1);
// Rows of one bucket in session order → how many of their forward windows do not overlap.
const bucketNEff = (rows, horizon) => nonOverlappingCount(rows.map((r) => r.idx).sort((a, b) => a - b), horizon);

function quantileSplit(records, scoreField, returnField, buckets = 3) {
  const clean = records.filter(r => r[scoreField] != null && r[returnField] != null);
  const sorted = [...clean].sort((a, b) => a[scoreField] - b[scoreField]);
  const size = Math.floor(sorted.length / buckets);
  if (size < 5) return null; // 표본 부족 시 생략(허위 정밀도 방지)
  const low = sorted.slice(0, size);
  const high = sorted.slice(sorted.length - size);
  const horizon = horizonOf(returnField);
  const meanRet = (arr) => arr.reduce((s, r) => s + r[returnField], 0) / arr.length;
  const hitRate = (arr) => Math.round((arr.filter(r => r[returnField] > 0).length / arr.length) * 1000) / 10;
  return {
    n: sorted.length,
    bottomTercile: { n: low.length, nEff: bucketNEff(low, horizon), meanReturn: Math.round(meanRet(low) * 100) / 100, hitRate: hitRate(low) },
    topTercile: { n: high.length, nEff: bucketNEff(high, horizon), meanReturn: Math.round(meanRet(high) * 100) / 100, hitRate: hitRate(high) },
    unconditional: { nEff: bucketNEff(clean, horizon), meanReturn: Math.round(meanRet(clean) * 100) / 100, hitRate: hitRate(clean) },
    quantileSpread: Math.round((meanRet(high) - meanRet(low)) * 100) / 100,
  };
}

// Calibration disclosure: fixed score bands → the forward return that followed, with the count of non-overlapping
// windows behind each mean and its standard error on that count. A band with fewer than CALIBRATION_MIN_NEFF
// independent windows reports no mean. It describes the past record; it is not a forecast for a band.
export const CALIBRATION_BANDS = Object.freeze([[0, 40], [40, 50], [50, 60], [60, 70], [70, 101]]);
export const CALIBRATION_MIN_NEFF = 8;
export function calibrationTable(records, scoreField, returnField) {
  const horizon = horizonOf(returnField);
  const clean = records.filter((r) => r[scoreField] != null && r[returnField] != null);
  const round2 = (value) => Math.round(value * 100) / 100;
  return {
    horizonDays: horizon,
    allowedUse: 'disclosure-only; not a forecast',
    minNEff: CALIBRATION_MIN_NEFF,
    bands: CALIBRATION_BANDS.map(([lo, hi]) => {
      const rows = clean.filter((r) => r[scoreField] >= lo && r[scoreField] < hi);
      const nEff = bucketNEff(rows, horizon);
      const band = `${lo}-${Math.min(hi, 100)}`;
      if (nEff < CALIBRATION_MIN_NEFF) return { band, n: rows.length, nEff, meanReturn: null, se: null, hitRate: null };
      const values = rows.map((r) => r[returnField]);
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const sd = Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length - 1));
      return { band, n: rows.length, nEff, meanReturn: round2(mean), se: round2(sd / Math.sqrt(nEff)), hitRate: Math.round(values.filter((value) => value > 0).length / values.length * 1000) / 10 };
    })
  };
}

// Daily T+n forward returns overlap for n>1, so treating every row as an independent
// observation makes Fisher intervals too narrow. Retain the pooled estimate for descriptive
// continuity, but evaluate every possible non-overlapping phase separately. Promotion may use
// only the conservative phase-stability result, never the pooled IID interval alone.
// The phases are not independent of each other: phase k and k+1 share (h-1)/h of every forward window, so "all h
// phases agree" is one finding repeated h times, and a count of significant phases is not a count of confirmations.
// The decision reading is therefore one phase — the median-rho phase with its own interval (n = rows / h) — and
// supportsPositive/supportsNegative require that interval to exclude zero as well as the sign agreement.
export function nonOverlappingPhaseCorrelations(records, scoreField, returnField, horizonDays) {
  const step = Math.max(1, Math.trunc(Number(horizonDays) || 1));
  const phases = Array.from({ length: step }, (_, phase) => {
    const pairs = records.filter((_, index) => index % step === phase).map((row) => [row?.[scoreField], row?.[returnField]]);
    return { phase, ...spearmanWithCI(pairs) };
  }).filter((result) => result.n >= 3 && result.rho != null);
  const positive = phases.filter((result) => result.rho > 0).length;
  const negative = phases.filter((result) => result.rho < 0).length;
  const significantPositive = phases.filter((result) => Array.isArray(result.ci95) && result.ci95[0] > 0).length;
  const significantNegative = phases.filter((result) => Array.isArray(result.ci95) && result.ci95[1] < 0).length;
  const byRho = [...phases].sort((a, b) => a.rho - b.rho);
  const median = byRho.length ? byRho[Math.floor((byRho.length - 1) / 2)] : null;
  const signStablePositive = phases.length === step && positive === phases.length;
  const signStableNegative = phases.length === step && negative === phases.length;
  return {
    horizonDays: step,
    phaseCount: phases.length,
    phases,
    positivePhasePct: phases.length ? Math.round(positive / phases.length * 1000) / 10 : null,
    negativePhasePct: phases.length ? Math.round(negative / phases.length * 1000) / 10 : null,
    significantPositivePhases: significantPositive,
    significantNegativePhases: significantNegative,
    signStablePositive,
    signStableNegative,
    phaseDependence: 'neighbouring phases share (h-1)/h of every forward window; agreement across phases is one finding, not h',
    independentFindings: phases.length ? 1 : 0,
    medianPhase: median ? { phase: median.phase, n: median.n, rho: median.rho, ci95: median.ci95 } : null,
    supportsPositive: signStablePositive && Array.isArray(median?.ci95) && median.ci95[0] > 0,
    supportsNegative: signStableNegative && Array.isArray(median?.ci95) && median.ci95[1] < 0,
    allowedUse: 'validation-diagnostic-only'
  };
}

// ── regime 분류: 서술형 역사적 날짜 대신 데이터 자체에서 계산되는 VIX·trailing 1y drawdown으로
//    산출 — 과거 사건의 정확한 날짜를 기억에 의존해 재현하는 위험을 피한다. ──
export function classifyRegime(record, series, idx) {
  const vix = record.vix;
  const ath1y = trailingMax(series, idx, 252, 'spx');
  const drawdown = (ath1y && record.spx) ? (record.spx - ath1y) / ath1y * 100 : null;
  const volRegime = (typeof vix === 'number') ? (vix >= 28 ? 'high-vol' : vix >= 18 ? 'mid-vol' : 'low-vol') : 'unknown-vol';
  const trendRegime = (drawdown == null) ? 'unknown-trend' : (drawdown <= -15 ? 'bear(-15%+)' : drawdown <= -5 ? 'correction(-5~-15%)' : 'bull(within-5%-of-1y-high)');
  return `${volRegime}_${trendRegime}`;
}

export async function runLongrunBacktest(range, outPath) {
  // The relative-v1 (2026-07) result is kept as a summary before this run overwrites the file.
  let previousExperiment = null;
  try {
    const prev = JSON.parse(await readFile(outPath, 'utf8'));
    if (/relative-v1/.test(prev?.relativeVariant?.name || '')) {
      previousExperiment = { name: prev.relativeVariant.name, generatedAt: prev.generatedAt || null, model: '2026-07 frozen model (not the current trading-score v5)',
        fwd21d: { baseline: prev.overallCorrelations?.fwd21d?.composite || null, relative: prev.overallCorrelations?.fwd21d?.compositeRel || null },
        fwd63d: { baseline: prev.overallCorrelations?.fwd63d?.composite || null, relative: prev.overallCorrelations?.fwd63d?.compositeRel || null } };
    } else if (prev?.previousExperiment) previousExperiment = prev.previousExperiment;
  } catch { /* first run */ }
  const seriesByField = await fetchAllSeries(range);
  const fetchCounts = Object.fromEntries(Object.entries(seriesByField).map(([k, v]) => [k, v.size]));
  const series = buildMergedSeries(seriesByField);
  if (series.length < 300) {
    throw new Error(`insufficient merged series length (${series.length}) — Yahoo fetch likely degraded, aborting rather than reporting on a truncated window`);
  }
  const output = analyzeLongrunSeries(series, { fetchCounts, previousExperiment });
  await writeFile(outPath, JSON.stringify(output, null, 1) + '\n', 'utf8');
  return output;
}

// The analysis of one merged daily series ({ date, spx, vix, vvix, tnx, dxy, wti }); no network, so gates can run it.
export function analyzeLongrunSeries(series, { fetchCounts = null, previousExperiment = null, generatedAt = new Date().toISOString() } = {}) {
  // A-1 relative-v1: 필드별 값 배열(시리즈 인덱스 정렬)을 만들어 trailing percentile 사전계산
  const relFields = ['vix', 'dxy', 'tnx', 'vvix', 'wti'];
  const relValues = Object.fromEntries(relFields.map(f => [f, series.map(d => d[f])]));

  const records = [];
  for (let i = 0; i < series.length; i++) {
    const d = series[i];
    const spx50ma = trailingMA(series, i, 50);
    const spx200ma = trailingMA(series, i, 200);
    // fg는 P1388(v4)부터 합성 점수 입력이 아니다 — 넘기는 45는 점수에 영향이 없다(호환 인자).
    const result = reconstructScore({
      vix: d.vix, fg: 45, dxy: d.dxy, tnx: d.tnx, wti: d.wti, vvix: d.vvix,
      spxPrice: d.spx, spx50ma, spx200ma, mode: 'default',
    });
    const pct = Object.fromEntries(relFields.map(f => [f, rollingPercentile(relValues[f], i)]));
    const rel = reconstructRelativeScore({
      vixP: pct.vix, dxyP: pct.dxy, tnxP: pct.tnx, vvixP: pct.vvix, wtiP: pct.wti,
      spxPrice: d.spx, spx50ma, spx200ma,
    });
    records.push({
      date: d.date,
      idx: i,
      composite: result.total,
      vol: result.volScore,
      trend: result.trendScore,
      macro: result.macroScore,
      compositeRel: rel ? rel.total : null,
      volRel: rel ? rel.volScore : null,
      macroRel: rel ? rel.macroScore : null,
      regime: classifyRegime(d, series, i),
      fwd1d: forwardReturn(series, i, 1),
      fwd5d: forwardReturn(series, i, 5),
      fwd21d: forwardReturn(series, i, 21),
      fwd63d: forwardReturn(series, i, 63),
      fwd21dLag1: forwardReturn(series, i, 21, 'spx', 1),
      fwd63dLag1: forwardReturn(series, i, 63, 'spx', 1),
    });
  }

  const horizons = ['fwd1d', 'fwd5d', 'fwd21d', 'fwd63d'];
  const subScores = ['composite', 'vol', 'trend', 'macro', 'compositeRel', 'volRel', 'macroRel'];
  // Every interval below is on the count of non-overlapping forward windows; the session index rides along so
  // subsets with gaps (regimes) count their own non-overlapping windows.
  const corr = (rows, scoreField, returnField) => spearmanWithEffectiveCI(rows.map((r) => [r[scoreField], r[returnField], r.idx]), horizonOf(returnField));

  const overall = {};
  const nonOverlapping = {};
  for (const h of horizons) {
    overall[h] = Object.fromEntries(subScores.map(s => [s, corr(records, s, h)]));
    const days = horizonOf(h);
    nonOverlapping[h] = {
      composite: nonOverlappingPhaseCorrelations(records, 'composite', h, days),
      compositeRel: nonOverlappingPhaseCorrelations(records, 'compositeRel', h, days)
    };
  }
  // Entry one session after the scored close, beside the same-close figures above.
  const executionLag = {
    note: 'overallCorrelations enter at the close the score is computed from; these enter one session later',
    fwd21d: { composite: corr(records, 'composite', 'fwd21dLag1'), compositeRel: corr(records, 'compositeRel', 'fwd21dLag1') },
    fwd63d: { composite: corr(records, 'composite', 'fwd63dLag1'), compositeRel: corr(records, 'compositeRel', 'fwd63dLag1') }
  };

  // walk-forward: 시간순 70/30 분할(reference/holdout) — "train"이 아님, 위 메모 참조.
  const splitIdx = Math.floor(records.length * 0.7);
  const referencePeriod = records.slice(0, splitIdx);
  const holdoutPeriod = records.slice(splitIdx);
  const walkForward = {
    referencePeriod: {
      dateRange: [referencePeriod[0]?.date, referencePeriod[referencePeriod.length - 1]?.date],
      n: referencePeriod.length,
      corr21d_composite: corr(referencePeriod, 'composite', 'fwd21d'),
      corr21d_compositeRel: corr(referencePeriod, 'compositeRel', 'fwd21d'),
      corr63d_compositeRel: corr(referencePeriod, 'compositeRel', 'fwd63d'),
    },
    holdoutPeriod: {
      dateRange: [holdoutPeriod[0]?.date, holdoutPeriod[holdoutPeriod.length - 1]?.date],
      n: holdoutPeriod.length,
      corr21d_composite: corr(holdoutPeriod, 'composite', 'fwd21d'),
      corr21d_compositeRel: corr(holdoutPeriod, 'compositeRel', 'fwd21d'),
      corr63d_compositeRel: corr(holdoutPeriod, 'compositeRel', 'fwd63d'),
    },
  };

  const regimeGroups = new Map();
  for (const r of records) {
    if (!regimeGroups.has(r.regime)) regimeGroups.set(r.regime, []);
    regimeGroups.get(r.regime).push(r);
  }
  const regimes = [...regimeGroups.entries()]
    .map(([label, rows]) => ({
      label, n: rows.length,
      corr21d_composite: corr(rows, 'composite', 'fwd21d'),
      corr21d_compositeRel: corr(rows, 'compositeRel', 'fwd21d'),
    }))
    .sort((a, b) => b.n - a.n);

  const quantile21d = quantileSplit(records, 'composite', 'fwd21d');
  const quantile5d = quantileSplit(records, 'composite', 'fwd5d');
  const quantileRel21d = quantileSplit(records, 'compositeRel', 'fwd21d');
  const quantileRel63d = quantileSplit(records, 'compositeRel', 'fwd63d');

  return {
    generatedAt,
    methodology: {
      scope: 'PARTIAL validation of computeTradingScore() — covers only volScore(VIX)+trendScore(SPX vs 50/200MA)+macroScore(DXY/TNX/VVIX/oil) inputs, which are the ones with freely obtainable multi-year PIT history.',
      // Credit is judged only on the FRED HY OAS. A file without this field was built with the HYG-price proxy.
      creditInput: SCORE_LONGRUN_CREDIT_INPUT,
      // P9-BT-01: described against the current model (trading-score v5), which the baseline path calls.
      excludedInputs: ['risk appetite — put/call and the FRED HY OAS have no free multi-year history here, so the 25% risk-appetite axis is missing (dropped from the denominator); no HYG-price proxy stands in for it', 'breadth — no free multi-year history; the current model drops the missing breadth axis from the denominator (weights re-normalised), it is not held at a constant', 'Fear&Greed — not a composite input since P1388 (v4); the value passed is ignored', 'news sentiment correction — omitted, no historical news corpus'],
      missingInputPolicy: 'a session without VVIX, DXY, the 10-year yield or WTI scores without that input; no neutral default is substituted',
      inference: 'Every ci95 is a Fisher interval on nEff = the count of non-overlapping forward windows (rows / horizon; by session index inside regimes). hac is a Newey-West interval of the same rho at lag >= horizon - 1. ci95NaiveIid is the row-count interval kept for comparison only; it is too narrow and decides nothing.',
      executionLag: 'overallCorrelations measure the forward return from the scored close; executionLag repeats 21/63-day rows with entry one session later.',
      fixedRuleNotFittedModel: 'computeTradingScore weights/thresholds are hand-set constants, not parameters fit to data. "referencePeriod"/"holdoutPeriod" below check temporal stability of a FIXED rule, not generalization of a fitted model — deliberately not called "train/test".',
      regimeClassification: 'Computed from the fetched data itself (trailing VIX level + trailing-252-day drawdown from rolling ATH) — not from hardcoded historical narrative dates, to avoid relying on memorized calendar boundaries.',
      dataSource: 'Yahoo Finance public chart API (query1/query2.finance.yahoo.com/v8/finance/chart), same endpoint pattern already used in production by scripts/fetch-data.mjs fetchHistory().',
      dependenceControl: 'T+n returns sampled daily overlap. nonOverlappingPhaseCorrelations evaluates every start phase at n-session spacing, but the phases share (h-1)/h of each window, so their agreement is one finding. Promotion requires supportsPositive (sign agreement AND the median phase interval above zero) plus a holdout interval on nEff above zero.',
    },
    dataRange: { from: series[0].date, to: series[series.length - 1].date, tradingDays: series.length, perSymbolFetchCount: fetchCounts },
    overallCorrelations: overall,
    nonOverlappingPhaseCorrelations: nonOverlapping,
    executionLag,
    calibration: { fwd21d: calibrationTable(records, 'composite', 'fwd21d'), fwd63d: calibrationTable(records, 'composite', 'fwd63d') },
    walkForward,
    regimes,
    ablationNote: 'overallCorrelations above already reports vol/trend/macro sub-scores individually alongside the composite — that IS the ablation (isolates which sub-score, if any, carries signal vs the blended total).',
    relativeVariant: {
      name: 'relative-v2 (current model, 2026-10-31)',
      hypothesis: 'R298 — absolute thresholds (dxy>107, tnx>4.5, vix bands) fail to track structural regime shifts over 10y; replacing them with trailing rolling percentiles (window ≤2520d, warm-up ≥252d, trailing-only → no look-ahead) may restore a positive score↔forward-return relationship.',
      design: 'Controlled comparison on the current model: baseline and relative both call reconstructScore() → trading-score.js v5 with the same trend rule and the same missing risk-appetite and breadth axes. Only the threshold unit differs: each of VIX/DXY/TNX/VVIX/WTI enters as a representative level of the absolute band its trailing percentile maps to. Percentile band edges ([0.20,0.40,0.60,0.80,0.95] for VIX; 0.80/0.90 DXY; 0.80 TNX/VVIX; 0.85/0.95 WTI) are hand-set a priori to keep the ordinal band structure — NOT fitted to returns.',
      passCriterion: 'nonOverlappingPhaseCorrelations.supportsPositive at T+21 and T+63 (every start phase positive AND the median phase interval above zero) and a walk-forward holdout rho whose nEff interval is above zero. A pooled daily 95% CI alone is ineligible because forward-return windows overlap, and a count of agreeing phases is not a count of confirmations. Anything else keeps the live score environment-descriptive and blocks formula promotion.',
      warmupExcludedDays: records.filter(r => r.compositeRel == null).length,
    },
    previousExperiment,
    quantileSpread: { fwd5d: quantile5d, fwd21d: quantile21d, rel_fwd21d: quantileRel21d, rel_fwd63d: quantileRel63d },
    caveats: [
      'This validates only ~55% of computeTradingScore\'s weight (vol 25% + trend 20% + macro 10%) — momScore(25%) and breadthScore(20%) remain unvalidated placeholders here.',
      'The live app\'s displayed composite score must stay labeled provisional/unvalidated regardless of this result, since its momScore/breadthScore/PCR/AAII inputs are not covered by this backtest.',
      'No transaction costs, slippage, or capacity constraints modeled — this measures statistical association with forward index returns only, not tradeable strategy performance.',
      'A significant correlation here would support only the macro/vol/trend sub-formula, not the full scoring system Codex\'s WO-2 gate describes.',
      'calibration lists what followed each score band in this one 10-year sample with the non-overlapping window count behind it; it is a disclosure of the record, not an expected return.',
    ],
  };
}

const __entryArg = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (__entryArg && (import.meta.url === `file://${__entryArg}` || import.meta.url === `file:///${__entryArg}`)) {
  runLongrunBacktest(RANGE, OUT_PATH).then((output) => {
    console.log(`[backtest-trading-score-longrun] tradingDays=${output.dataRange.tradingDays} range=${output.dataRange.from}..${output.dataRange.to}`);
    console.log(`[backtest-trading-score-longrun] overall fwd21d composite: n=${output.overallCorrelations.fwd21d.composite.n} rho=${output.overallCorrelations.fwd21d.composite.rho} ci95=${JSON.stringify(output.overallCorrelations.fwd21d.composite.ci95)}`);
    console.log(`[backtest-trading-score-longrun] walk-forward holdout fwd21d: n=${output.walkForward.holdoutPeriod.n} rho=${output.walkForward.holdoutPeriod.corr21d_composite.rho}`);
    for (const h of ['fwd1d', 'fwd5d', 'fwd21d', 'fwd63d']) {
      const abs = output.overallCorrelations[h].composite, rel = output.overallCorrelations[h].compositeRel;
      console.log(`[relative-v2] ${h}: baseline rho=${abs.rho} ci95=${JSON.stringify(abs.ci95)} | relative rho=${rel.rho} ci95=${JSON.stringify(rel.ci95)} (n=${rel.n})`);
    }
    console.log(`[relative-v2] walk-forward 21d ref=${output.walkForward.referencePeriod.corr21d_compositeRel.rho} holdout=${output.walkForward.holdoutPeriod.corr21d_compositeRel.rho} | 63d ref=${output.walkForward.referencePeriod.corr63d_compositeRel.rho} holdout=${output.walkForward.holdoutPeriod.corr63d_compositeRel.rho}`);
    console.log(`[backtest-trading-score-longrun] regimes found: ${output.regimes.map(r => r.label + '(n=' + r.n + ')').join(', ')}`);
  }).catch((e) => { console.error('[backtest-trading-score-longrun] error:', e.stack || e.message); process.exit(1); });
}
