// ─────────────────────────────────────────────────────────────────────────
// scripts/backtest-trading-score.mjs — Phase 3 [C3] validation harness (P599)
//
// 왜: computeTradingScore(js/aio-core.js, 홈 화면 중심 지표)는 어떤 백테스트/IC/적중률 검증도
//     없다(Fable 진단 C3). 이 스크립트는 그 5개 서브스코어 계단함수를 순수 함수로 재구현해
//     public-data/history.json(일별 시장 스냅샷)에 대해 매일 재구성 점수 vs forward 5/21일
//     SPX 수익률을 계산·누적한다. scripts/fetch-data.mjs의 updateBacktestHistory()(P586, 팩터
//     IC 시계열 누적)와 동일한 날짜별 upsert + 캡 패턴.
//
// 중요한 데이터 제약(실측, 2026-07-04): history.json 201일 중 momScore의 유일한 입력인 fg
// (Fear&Greed)는 24일치뿐이고 전부 최근 2026-06-10~07-03 구간 — forward 21일 수익률 확인
// 가능한 표본은 현재 1~3개뿐이다. 이 스크립트는 그 사실을 감추지 않고 summary에 표본 수를
// 그대로 노출한다. 재튜닝 근거로 쓰기엔 표본이 턱없이 부족 — 인프라만 구축, 시간이 지나며
// history.json이 30분마다 계속 쌓이는 대로 표본이 자동으로 커진다.
//
// 실행: node scripts/backtest-trading-score.mjs [--history=path] [--out=path]
//       (public-data/history.json은 이미 커밋된 로컬 파일 — 네트워크 호출 없음, 안전)
// ─────────────────────────────────────────────────────────────────────────

import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = null) {
  const pref = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(pref));
  return found ? found.slice(pref.length) : fallback;
}

const HISTORY_PATH = argValue('history', `${__dir}/../public-data/history.json`);
const OUT_PATH = argValue('out', `${__dir}/../public-data/score-backtest-history.json`);

// ── 순수 함수 재구현 (js/aio-core.js computeTradingScore, v52.1 기준 — 로직/가중치/임계값 그대로 복사) ──
// 라이브 코드와의 정합성은 이 파일과 짝을 이루는 격리 유닛테스트(scratchpad)로 검증했음 — 여기서는
// 재튜닝하지 않는다(Phase 3 C3는 검증 인프라 구축이지 알고리즘 변경이 아님).

const CLAMP = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

// 1. Volatility Score (25%)
export function calcVolScore(vix, mode) {
  vix = CLAMP(vix, 5, 150);
  let volScore;
  if (vix < 15) volScore = 90;
  else if (vix < 18) volScore = 78;
  else if (vix < 22) volScore = 62;
  else if (vix < 27) volScore = 42;
  else if (vix < 35) volScore = 22;
  else volScore = 8;
  if (mode === 'day' && vix >= 18 && vix < 30) volScore = Math.min(100, volScore + 12);
  return volScore;
}

// 2. Momentum Score (25%) — F&G proxy
export function calcMomScore(fg) {
  fg = CLAMP(fg, 0, 100);
  if (fg >= 75) return 66;
  if (fg >= 55) return 74;
  if (fg >= 45) return 52;
  if (fg >= 25) return 34;
  return 25;
}

// 3. Trend Score (20%) — SPX vs 50/200MA. 200MA 데이터 부족 시 중립(50) — 라이브 코드와 동일 폴백.
export function calcTrendScore(spxPrice, spx50ma, spx200ma) {
  if (!spxPrice || !spx50ma || !spx200ma) return 50;
  if (spxPrice > spx50ma * 1.02) return 82;
  if (spxPrice > spx50ma) return 68;
  if (spxPrice > spx200ma) return 50;
  if (spxPrice > spx200ma * 0.97) return 32;
  return 15;
}

// 4. Breadth Score (20%) — history.json에 breadth 데이터 없음 → 항상 중립 폴백(57)으로 호출됨
export function calcBreadthScore(breadth200) {
  if (breadth200 > 70) return 88;
  if (breadth200 > 55) return 72;
  if (breadth200 > 40) return 52;
  if (breadth200 > 25) return 28;
  return 12;
}

// 5. Macro Score (10%)
export function calcMacroScore(dxy, tnx, hyg, fg, vvix) {
  let macroScore = 55;
  if (dxy > 107) macroScore -= 12;
  if (dxy > 110) macroScore -= 8;
  if (tnx > 4.5) macroScore -= 10;
  if (hyg < 76) macroScore -= 12;
  if (fg < 20) macroScore -= 5;
  if (vvix > 110) macroScore -= 8;
  return Math.max(10, Math.min(90, macroScore));
}

// 전체 조합 — 재현 가능한 입력만 사용. breadth200/pcr/aaiiBear/hyg는 history.json에 없어 라이브
// 코드 자신의 "실시간 미수신" 폴백 상수 그대로 사용(근사가 아니라 이미 존재하는 코드 경로 재현).
// 뉴스감성 보정은 과거 뉴스 데이터가 없어 완전히 생략(0 기여, 임의 대입 금지).
export function reconstructScore({ vix, fg, dxy, tnx, wti, vvix, spxPrice, spx50ma, spx200ma, mode }) {
  vix = CLAMP(vix, 5, 150);
  vvix = CLAMP(vvix ?? 100, 50, 250);
  dxy = CLAMP(dxy ?? 104, 80, 130);
  tnx = CLAMP(tnx ?? 4.3, 0, 8);
  const oilPrice = CLAMP(wti ?? 0, 0, 300);
  fg = CLAMP(fg, 0, 100);
  const breadth200 = 57;  // history.json에 없음 — 라이브 코드 폴백 상수(_fb.breadth200 없을 때)
  const pcr = 0.95;       // history.json에 없음 — 라이브 코드 폴백 상수
  const aaiiBear = 50;    // history.json에 없음 — 라이브 코드 폴백 상수
  const hyg = 78;         // history.json에 없음 — 라이브 코드 최종 폴백 상수

  let volScore = calcVolScore(vix, mode);
  let momScore = calcMomScore(fg);
  let trendScore = calcTrendScore(spxPrice, spx50ma, spx200ma);
  let breadthScore = calcBreadthScore(breadth200);
  let macroScore = calcMacroScore(dxy, tnx, hyg, fg, vvix);

  if (pcr > 1.3) momScore = Math.max(5, momScore - 8);
  else if (pcr > 1.1) momScore = Math.max(5, momScore - 4);

  if (aaiiBear > 55) breadthScore = Math.max(breadthScore, 20);

  let crossRiskCount = 0;
  if (vix > 25) crossRiskCount++;
  if (dxy > 107) crossRiskCount++;
  if (tnx > 4.5) crossRiskCount++;
  if (oilPrice > 100) crossRiskCount++;
  if (crossRiskCount >= 3) macroScore = Math.max(10, macroScore - 10);

  if (trendScore > 65 && breadthScore < 30) trendScore = Math.max(10, trendScore - 10);
  else if (trendScore < 35 && breadthScore > 55) breadthScore = Math.min(90, breadthScore + 8);

  let compositeScore = Math.round(
    volScore * 0.25 + momScore * 0.25 + trendScore * 0.20 + breadthScore * 0.20 + macroScore * 0.10
  );

  // credit-stress 보정 — history.json에 hyg 없어 3순위(최종) 폴백만 재현 가능
  const hyBp = (hyg > 0 && hyg < 90) ? Math.round((100 - hyg) * 15) : 0;
  if (hyBp > 500) compositeScore -= 15;
  else if (hyBp > 400) compositeScore -= 8;
  else if (hyBp > 350) compositeScore -= 3;

  if (oilPrice > 100) compositeScore -= 10;
  else if (oilPrice > 90) compositeScore -= 5;

  // 뉴스감성 보정: 생략(0) — history.json에 과거 뉴스 데이터 없음

  const total = Math.max(5, Math.min(100, compositeScore));
  return { total, volScore, momScore, trendScore, breadthScore, macroScore };
}

// ── history.json → 거래일(spx 존재)만 필터링, forward return + trailing MA 계산 ──
function buildTradingDaySeries(history) {
  return history.filter(d => d && typeof d.spx === 'number' && Number.isFinite(d.spx));
}

function trailingMA(series, idx, window) {
  if (idx - window + 1 < 0) return null;
  let sum = 0;
  for (let i = idx - window + 1; i <= idx; i++) sum += series[i].spx;
  return sum / window;
}

function forwardReturn(series, idx, daysAhead) {
  const j = idx + daysAhead;
  if (j >= series.length) return null;
  const cur = series[idx].spx, fut = series[j].spx;
  if (!cur || !fut) return null;
  return (fut - cur) / cur * 100;
}

export async function runBacktest(historyPath, outPath) {
  const history = JSON.parse(await readFile(historyPath, 'utf8'));
  const tradingDays = buildTradingDaySeries(history);

  const records = [];
  for (let i = 0; i < tradingDays.length; i++) {
    const d = tradingDays[i];
    if (typeof d.fg !== 'number' || !Number.isFinite(d.fg)) continue; // momScore 재구성 불가 → 스킵
    const spx50ma = trailingMA(tradingDays, i, 50);
    const spx200ma = trailingMA(tradingDays, i, 200);
    const result = reconstructScore({
      vix: d.vix, fg: d.fg, dxy: d.dxy, tnx: d.tnx, wti: d.wti, vvix: d.vvix,
      spxPrice: d.spx, spx50ma, spx200ma, mode: 'default',
    });
    records.push({
      date: d.date,
      reconstructedScore: result.total,
      subScores: { vol: result.volScore, mom: result.momScore, trend: result.trendScore, breadth: result.breadthScore, macro: result.macroScore },
      fwd5dReturn: forwardReturn(tradingDays, i, 5),
      fwd21dReturn: forwardReturn(tradingDays, i, 21),
      dataCompleteness: {
        vix: typeof d.vix === 'number', dxy: typeof d.dxy === 'number', tnx: typeof d.tnx === 'number',
        wti: typeof d.wti === 'number', vvix: typeof d.vvix === 'number',
        trend200maAvailable: spx200ma != null,
        breadthPcrAaiiHygFellBackToNeutral: true, // history.json에 이 4개는 아예 없음 — 항상 참
        newsSentimentOmitted: true,
      },
    });
  }

  // Spearman 순위상관 (동순위는 평균순위로 처리하지 않는 단순 근사 — 표본이 이 정도로 작을 땐 충분)
  function spearman(pairs) {
    const clean = pairs.filter(p => p[0] != null && p[1] != null);
    const n = clean.length;
    if (n < 3) return { n, rho: null };
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
    return { n, rho: Math.round(rho * 1000) / 1000 };
  }

  const corr5d = spearman(records.map(r => [r.reconstructedScore, r.fwd5dReturn]));
  const corr21d = spearman(records.map(r => [r.reconstructedScore, r.fwd21dReturn]));

  // 날짜별 upsert + 180일 캡 (updateBacktestHistory, fetch-data.mjs:886-909와 동일 패턴)
  let existing = [];
  try { const raw = JSON.parse(await readFile(outPath, 'utf8')); if (Array.isArray(raw.records)) existing = raw.records; } catch { /* 최초 실행 */ }
  const byDate = new Map(existing.map(r => [r.date, r]));
  for (const r of records) byDate.set(r.date, r); // 새 계산이 항상 최신 우선
  let merged = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (merged.length > 180) merged = merged.slice(merged.length - 180);

  const output = {
    generatedAt: new Date().toISOString(),
    note: 'Phase 3 [C3] P599 — computeTradingScore 재구성 검증 하네스. breadth/pcr/aaiiBear/hyg/뉴스감성은 history.json에 없어 라이브 코드의 실시간-미수신 폴백 상수(또는 완전 생략)를 사용 — 근사가 아니라 이미 존재하는 코드 경로 재현. 표본 수가 통계적으로 유의미해질 때까지(대략 n>=30) summary를 "검증 결과"가 아니라 "누적 진행 상황"으로 취급할 것.',
    summary: { n5d: corr5d.n, corr5d: corr5d.rho, n21d: corr21d.n, corr21d: corr21d.rho, statisticallyMeaningful: corr5d.n >= 30 && corr21d.n >= 30 },
    records: merged,
  };
  await writeFile(outPath, JSON.stringify(output, null, 1) + '\n', 'utf8');
  return output;
}

// 직접 실행 시에만 동작(다른 스크립트가 함수만 import할 수 있도록 top-level 부작용 없음)
if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  runBacktest(HISTORY_PATH, OUT_PATH).then((output) => {
    console.log(`[backtest-trading-score] records=${output.records.length} summary=${JSON.stringify(output.summary)}`);
  }).catch((e) => { console.error('[backtest-trading-score] error:', e.stack || e.message); process.exit(1); });
}
