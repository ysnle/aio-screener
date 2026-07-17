// ─────────────────────────────────────────────────────────────────────────
// scripts/backtest-trading-score-longrun.mjs — WO-2 reduced-scope validation (P665)
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
//       (2) VIX/VVIX/SPX/TNX/DXY/WTI/HYG(신용 스트레스 대리) — Yahoo Finance chart API로 실제
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

import { writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reconstructScore } from './backtest-trading-score.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = null) {
  const pref = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(pref));
  return found ? found.slice(pref.length) : fallback;
}

const RANGE = argValue('range', '10y');
const OUT_PATH = argValue('out', `${__dir}/../public-data/score-backtest-longrun.json`);

const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const SYMBOLS = { spx: '^GSPC', vix: '^VIX', vvix: '^VVIX', tnx: '^TNX', dxy: 'DX-Y.NYB', wti: 'CL=F', hyg: 'HYG' };

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
    hyg: seriesByField.hyg.get(date) ?? null,
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

function forwardReturn(series, idx, daysAhead, field = 'spx') {
  const j = idx + daysAhead;
  if (j >= series.length) return null;
  const cur = series[idx][field], fut = series[j][field];
  if (typeof cur !== 'number' || typeof fut !== 'number' || !cur) return null;
  return (fut - cur) / cur * 100;
}

// ── Spearman 순위상관 + Fisher-z 근사 신뢰구간(단순 tie 처리, 표본이 클 때 충분 — 기존 하네스와
//    동일한 근사 수준 유지, n>=4에서만 CI 계산) ──
export function spearmanWithCI(pairs) {
  const clean = pairs.filter(p => p[0] != null && p[1] != null && isFinite(p[0]) && isFinite(p[1]));
  const n = clean.length;
  if (n < 3) return { n, rho: null, ci95: null };
  const rank = (arr) => {
    const sorted = arr.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(arr.length);
    sorted.forEach(([, i], rankIdx) => { r[i] = rankIdx + 1; });
    return r;
  };
  const xs = clean.map(p => p[0]), ys = clean.map(p => p[1]);
  const rx = rank(xs), ry = rank(ys);
  const dSq = rx.reduce((s, r, i) => s + (r - ry[i]) ** 2, 0);
  const rho = 1 - (6 * dSq) / (n * (n * n - 1));
  let ci95 = null;
  if (n >= 4 && Math.abs(rho) < 1) {
    const z = Math.atanh(rho);
    const se = 1 / Math.sqrt(n - 3);
    ci95 = [Math.tanh(z - 1.96 * se), Math.tanh(z + 1.96 * se)].map(v => Math.round(v * 1000) / 1000);
  }
  return { n, rho: Math.round(rho * 1000) / 1000, ci95 };
}

// ── A-1 (2026-07-17, REMAINING-WORK §A1): percentile/레짐 상대화 변형 "relative-v1" ──
// 왜: WO-2 원결과(21일 rho=-0.165, 63일 -0.255)의 유력 가설이 "dxy>107/tnx>4.5 같은 절대
//     임계값이 10년 금리 레짐 구조 이동에 대응 못 함"(R298)이었다. 이 변형은 절대 임계값을
//     trailing 롤링 percentile(최대 2520거래일=10y, 최소 252일 warm-up)로 치환해 같은 데이터·
//     같은 밴드 구조·같은 가중치로 재백테스트한다.
// 정직성 메모: percentile 밴드 경계([0.20,0.40,0.60,0.80,0.95] 등)는 데이터에 fit한 값이 아니라
//     원 절대 밴드의 서수 구조를 보존한 손-지정 상수다(5밴드→5밴드). trailing-only라 look-ahead
//     없음. HYG 달러가격 신용 판정·hyBp 변환은 라이브가 P713/P714에서 듀레이션 오염으로 이미
//     제거했으므로 이 변형에도 넣지 않는다(baseline은 WO-2 결과와의 비교 가능성을 위해 원형 유지).
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

export function reconstructRelativeScore({ vixP, dxyP, tnxP, vvixP, wtiP, spxPrice, spx50ma, spx200ma }) {
  // warm-up/결측이면 판정 보류 — 절대 변형과 달리 상수 폴백으로 채우지 않는다(fail-closed).
  if (vixP == null || dxyP == null || tnxP == null) return null;

  // vol: 원 5밴드(vix<15/18/22/27/35 → 90/78/62/42/22/8)의 서수 구조를 percentile 밴드로 보존
  let volScore;
  if (vixP < 0.20) volScore = 90;
  else if (vixP < 0.40) volScore = 78;
  else if (vixP < 0.60) volScore = 62;
  else if (vixP < 0.80) volScore = 42;
  else if (vixP < 0.95) volScore = 22;
  else volScore = 8;

  // mom/breadth: baseline과 동일한 중립 상수 경로(fg=45→52, breadth200=57→72) — 비교 변인 통제
  const momScore = 52;
  let breadthScore = 72;

  // trend: 이미 상대 지표(가격 vs 자기 MA)라 원형 유지
  const trendScore = calcTrendScoreRel(spxPrice, spx50ma, spx200ma);

  // macro: dxy>107→상위 20%, dxy>110→상위 10%, tnx>4.5→상위 20%, vvix>110→상위 20%
  let macroScore = 55;
  if (dxyP > 0.80) macroScore -= 12;
  if (dxyP > 0.90) macroScore -= 8;
  if (tnxP > 0.80) macroScore -= 10;
  if (vvixP != null && vvixP > 0.80) macroScore -= 8;
  macroScore = Math.max(10, Math.min(90, macroScore));

  // cross-risk: 원형(vix>25/dxy>107/tnx>4.5/oil>100)의 percentile 등가
  let crossRiskCount = 0;
  if (vixP > 0.80) crossRiskCount++;
  if (dxyP > 0.80) crossRiskCount++;
  if (tnxP > 0.80) crossRiskCount++;
  if (wtiP != null && wtiP > 0.95) crossRiskCount++;
  if (crossRiskCount >= 3) macroScore = Math.max(10, macroScore - 10);

  let composite = Math.round(
    volScore * 0.25 + momScore * 0.25 + trendScore * 0.20 + breadthScore * 0.20 + macroScore * 0.10
  );

  // oil 보정: 원형($100/$90 절대가)의 percentile 등가(상위 5%/15%)
  if (wtiP != null) {
    if (wtiP > 0.95) composite -= 10;
    else if (wtiP > 0.85) composite -= 5;
  }

  const total = Math.max(5, Math.min(100, composite));
  return { total, volScore, trendScore, macroScore };
}

// trend 밴드는 reconstructScore 내부(calcTrendScore)와 동일 — import 순환 없이 로컬 재현
function calcTrendScoreRel(spxPrice, spx50ma, spx200ma) {
  if (!spxPrice || !spx50ma || !spx200ma) return 50;
  if (spxPrice > spx50ma * 1.02) return 82;
  if (spxPrice > spx50ma) return 68;
  if (spxPrice > spx200ma) return 50;
  if (spxPrice > spx200ma * 0.97) return 32;
  return 15;
}

function quantileSplit(records, scoreField, returnField, buckets = 3) {
  const clean = records.filter(r => r[scoreField] != null && r[returnField] != null);
  const sorted = [...clean].sort((a, b) => a[scoreField] - b[scoreField]);
  const size = Math.floor(sorted.length / buckets);
  if (size < 5) return null; // 표본 부족 시 생략(허위 정밀도 방지)
  const low = sorted.slice(0, size);
  const high = sorted.slice(sorted.length - size);
  const meanRet = (arr) => arr.reduce((s, r) => s + r[returnField], 0) / arr.length;
  const hitRate = (arr) => Math.round((arr.filter(r => r[returnField] > 0).length / arr.length) * 1000) / 10;
  return {
    n: sorted.length,
    bottomTercile: { n: low.length, meanReturn: Math.round(meanRet(low) * 100) / 100, hitRate: hitRate(low) },
    topTercile: { n: high.length, meanReturn: Math.round(meanRet(high) * 100) / 100, hitRate: hitRate(high) },
    unconditional: { meanReturn: Math.round(meanRet(clean) * 100) / 100, hitRate: hitRate(clean) },
    quantileSpread: Math.round((meanRet(high) - meanRet(low)) * 100) / 100,
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
  const seriesByField = await fetchAllSeries(range);
  const fetchCounts = Object.fromEntries(Object.entries(seriesByField).map(([k, v]) => [k, v.size]));
  const series = buildMergedSeries(seriesByField);
  if (series.length < 300) {
    throw new Error(`insufficient merged series length (${series.length}) — Yahoo fetch likely degraded, aborting rather than reporting on a truncated window`);
  }

  // A-1 relative-v1: 필드별 값 배열(시리즈 인덱스 정렬)을 만들어 trailing percentile 사전계산
  const relFields = ['vix', 'dxy', 'tnx', 'vvix', 'wti'];
  const relValues = Object.fromEntries(relFields.map(f => [f, series.map(d => d[f])]));

  const records = [];
  for (let i = 0; i < series.length; i++) {
    const d = series[i];
    const spx50ma = trailingMA(series, i, 50);
    const spx200ma = trailingMA(series, i, 200);
    // fg 없음(momScore 재구성 불가) — reconstructScore가 momScore 계산엔 여전히 fg를 쓰지만,
    // 결론은 "부분 점수(vol/trend/macro)"로만 해석하므로 fg는 중립값(45, Neutral 밴드 중앙)으로 고정.
    const result = reconstructScore({
      vix: d.vix, fg: 45, dxy: d.dxy, tnx: d.tnx, wti: d.wti, vvix: d.vvix,
      spxPrice: d.spx, spx50ma, spx200ma, mode: 'default', hyg: d.hyg,
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
    });
  }

  const horizons = ['fwd1d', 'fwd5d', 'fwd21d', 'fwd63d'];
  const subScores = ['composite', 'vol', 'trend', 'macro', 'compositeRel', 'volRel', 'macroRel'];

  const overall = {};
  for (const h of horizons) {
    overall[h] = Object.fromEntries(subScores.map(s => [s, spearmanWithCI(records.map(r => [r[s], r[h]]))]));
  }

  // walk-forward: 시간순 70/30 분할(reference/holdout) — "train"이 아님, 위 메모 참조.
  const splitIdx = Math.floor(records.length * 0.7);
  const referencePeriod = records.slice(0, splitIdx);
  const holdoutPeriod = records.slice(splitIdx);
  const walkForward = {
    referencePeriod: {
      dateRange: [referencePeriod[0]?.date, referencePeriod[referencePeriod.length - 1]?.date],
      n: referencePeriod.length,
      corr21d_composite: spearmanWithCI(referencePeriod.map(r => [r.composite, r.fwd21d])),
      corr21d_compositeRel: spearmanWithCI(referencePeriod.map(r => [r.compositeRel, r.fwd21d])),
      corr63d_compositeRel: spearmanWithCI(referencePeriod.map(r => [r.compositeRel, r.fwd63d])),
    },
    holdoutPeriod: {
      dateRange: [holdoutPeriod[0]?.date, holdoutPeriod[holdoutPeriod.length - 1]?.date],
      n: holdoutPeriod.length,
      corr21d_composite: spearmanWithCI(holdoutPeriod.map(r => [r.composite, r.fwd21d])),
      corr21d_compositeRel: spearmanWithCI(holdoutPeriod.map(r => [r.compositeRel, r.fwd21d])),
      corr63d_compositeRel: spearmanWithCI(holdoutPeriod.map(r => [r.compositeRel, r.fwd63d])),
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
      corr21d_composite: spearmanWithCI(rows.map(r => [r.composite, r.fwd21d])),
      corr21d_compositeRel: spearmanWithCI(rows.map(r => [r.compositeRel, r.fwd21d])),
    }))
    .sort((a, b) => b.n - a.n);

  const quantile21d = quantileSplit(records, 'composite', 'fwd21d');
  const quantile5d = quantileSplit(records, 'composite', 'fwd5d');
  const quantileRel21d = quantileSplit(records, 'compositeRel', 'fwd21d');
  const quantileRel63d = quantileSplit(records, 'compositeRel', 'fwd63d');

  const output = {
    generatedAt: new Date().toISOString(),
    methodology: {
      scope: 'PARTIAL validation of computeTradingScore() — covers only volScore(VIX)+trendScore(SPX vs 50/200MA)+macroScore(DXY/TNX/HYG/VIX/oil) inputs, which are the ones with freely obtainable multi-year PIT history.',
      excludedInputs: ['momScore (Fear&Greed) — held at neutral constant (45), no free multi-year historical source', 'breadthScore (breadth200) — held at code fallback constant (57), no free multi-year historical source', 'PCR correction — held at code fallback constant (0.95)', 'AAII-bearish correction — held at code fallback constant (50)', 'news sentiment correction — omitted (0), no historical news corpus'],
      fixedRuleNotFittedModel: 'computeTradingScore weights/thresholds are hand-set constants, not parameters fit to data. "referencePeriod"/"holdoutPeriod" below check temporal stability of a FIXED rule, not generalization of a fitted model — deliberately not called "train/test".',
      regimeClassification: 'Computed from the fetched data itself (trailing VIX level + trailing-252-day drawdown from rolling ATH) — not from hardcoded historical narrative dates, to avoid relying on memorized calendar boundaries.',
      dataSource: 'Yahoo Finance public chart API (query1/query2.finance.yahoo.com/v8/finance/chart), same endpoint pattern already used in production by scripts/fetch-data.mjs fetchHistory().',
    },
    dataRange: { from: series[0].date, to: series[series.length - 1].date, tradingDays: series.length, perSymbolFetchCount: fetchCounts },
    overallCorrelations: overall,
    walkForward,
    regimes,
    ablationNote: 'overallCorrelations above already reports vol/trend/macro sub-scores individually alongside the composite — that IS the ablation (isolates which sub-score, if any, carries signal vs the blended total).',
    relativeVariant: {
      name: 'relative-v1 (A-1, 2026-07-17)',
      hypothesis: 'R298 — absolute thresholds (dxy>107, tnx>4.5, vix bands) fail to track structural regime shifts over 10y; replacing them with trailing rolling percentiles (window ≤2520d, warm-up ≥252d, trailing-only → no look-ahead) may restore a positive score↔forward-return relationship.',
      design: 'Same band structure, same weights, same neutral constants for mom/breadth as baseline. Only the threshold *units* change (absolute level → trailing percentile). Percentile band edges ([0.20,0.40,0.60,0.80,0.95]) are hand-set a priori to preserve the ordinal structure of the original bands — NOT fitted to returns. HYG price-band credit corrections are excluded (live already removed them in P713/P714 as duration-polluted).',
      passCriterion: 'Statistically significant POSITIVE rho (95% CI excluding 0) for compositeRel vs fwd21d/fwd63d, consistent sign across walk-forward reference/holdout. Anything else → the confirmed policy stands: keep the live score labeled as an environment-descriptive value, no live formula change.',
      warmupExcludedDays: records.filter(r => r.compositeRel == null).length,
    },
    quantileSpread: { fwd5d: quantile5d, fwd21d: quantile21d, rel_fwd21d: quantileRel21d, rel_fwd63d: quantileRel63d },
    caveats: [
      'This validates only ~55% of computeTradingScore\'s weight (vol 25% + trend 20% + macro 10%) — momScore(25%) and breadthScore(20%) remain unvalidated placeholders here.',
      'The live app\'s displayed composite score must stay labeled provisional/unvalidated regardless of this result, since its momScore/breadthScore/PCR/AAII inputs are not covered by this backtest.',
      'No transaction costs, slippage, or capacity constraints modeled — this measures statistical association with forward index returns only, not tradeable strategy performance.',
      'A significant correlation here would support only the macro/vol/trend sub-formula, not the full scoring system Codex\'s WO-2 gate describes.',
    ],
  };

  await writeFile(outPath, JSON.stringify(output, null, 1) + '\n', 'utf8');
  return output;
}

const __entryArg = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (__entryArg && (import.meta.url === `file://${__entryArg}` || import.meta.url === `file:///${__entryArg}`)) {
  runLongrunBacktest(RANGE, OUT_PATH).then((output) => {
    console.log(`[backtest-trading-score-longrun] tradingDays=${output.dataRange.tradingDays} range=${output.dataRange.from}..${output.dataRange.to}`);
    console.log(`[backtest-trading-score-longrun] overall fwd21d composite: n=${output.overallCorrelations.fwd21d.composite.n} rho=${output.overallCorrelations.fwd21d.composite.rho} ci95=${JSON.stringify(output.overallCorrelations.fwd21d.composite.ci95)}`);
    console.log(`[backtest-trading-score-longrun] walk-forward holdout fwd21d: n=${output.walkForward.holdoutPeriod.n} rho=${output.walkForward.holdoutPeriod.corr21d_composite.rho}`);
    for (const h of ['fwd1d', 'fwd5d', 'fwd21d', 'fwd63d']) {
      const abs = output.overallCorrelations[h].composite, rel = output.overallCorrelations[h].compositeRel;
      console.log(`[relative-v1] ${h}: baseline rho=${abs.rho} ci95=${JSON.stringify(abs.ci95)} | relative rho=${rel.rho} ci95=${JSON.stringify(rel.ci95)} (n=${rel.n})`);
    }
    console.log(`[relative-v1] walk-forward 21d ref=${output.walkForward.referencePeriod.corr21d_compositeRel.rho} holdout=${output.walkForward.holdoutPeriod.corr21d_compositeRel.rho} | 63d ref=${output.walkForward.referencePeriod.corr63d_compositeRel.rho} holdout=${output.walkForward.holdoutPeriod.corr63d_compositeRel.rho}`);
    console.log(`[backtest-trading-score-longrun] regimes found: ${output.regimes.map(r => r.label + '(n=' + r.n + ')').join(', ')}`);
  }).catch((e) => { console.error('[backtest-trading-score-longrun] error:', e.stack || e.message); process.exit(1); });
}
