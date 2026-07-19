// ─────────────────────────────────────────────────────────────────────────
// scripts/backtest-trading-score.mjs — Phase 3 [C3] validation harness (P599)
//
// 왜: computeTradingScore(js/aio-core.js, 홈 화면 중심 지표)는 어떤 백테스트/IC/적중률 검증도
//     없다(Fable 진단 C3). 이 스크립트는 public-data/history.json(일별 시장 스냅샷)에 대해 매일
//     재구성 점수 vs forward 5/21일 SPX 수익률을 계산·누적한다. scripts/fetch-data.mjs의
//     updateBacktestHistory()(P586, 팩터 IC 시계열 누적)와 동일한 날짜별 upsert + 캡 패턴.
//
// RM-03 (2026-07-19): this file used to keep its own "v52.1 기준 — 로직/가중치/임계값 그대로
// 복사" copy of the 5 sub-score functions. That copy had already drifted from the live formula in
// three ways the copy-paste comment did not track (F-11): a stale neutral-50 trend fallback where
// live now returns null/missing, a `hyg<76` HYG-dollar-price credit-stress channel live removed
// (P714/R343) that this file was still double-counting alongside its own separate bp
// approximation, and an aaiiBear breadth-floor adjustment with no live counterpart at all.
// reconstructScore() now calls the single extracted src/domain/signal/trading-score.js model
// instead (R352: extraction is code motion, not a parallel model) — see that file's own comment
// for the full parity story and architecture/fixtures/trading-score-golden.json /
// scripts/ci-domain-parity-check.mjs for the standing parity gate.
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
import { computeTradingScoreModel } from '../src/domain/signal/trading-score.js';

const __dir = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = null) {
  const pref = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(pref));
  return found ? found.slice(pref.length) : fallback;
}

const HISTORY_PATH = argValue('history', `${__dir}/../public-data/history.json`);
const OUT_PATH = argValue('out', `${__dir}/../public-data/score-backtest-history.json`);

const CLAMP = (v, lo, hi) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : lo));

// 전체 조합 — 재현 가능한 입력만 사용. breadth200/pcr는 history.json에 구조적으로 없다(가끔
// 결측이 아니라 이 데이터소스 자체에 필드가 없음). RM-03 이전에는 라이브의 옛(v52.1) "실시간
// 미수신" 폴백 상수(57/0.95)를 재현한다고 문서화돼 있었지만, 그 폴백 상수 자체가 F-11이 찾은
// 드리프트였다 — 라이브의 현재 동작(모델의 fail-closed null/false)에 맞춰 정직하게 정렬한다.
// 결과적으로 componentCoveragePct가 100→80(초기 200MA 트레일링 미형성 구간은 더 낮게)으로
// 낮아지고 재구성 점수도 소폭 이동한다. 의도된 정정이며 버그 아님(재현이 아니라 정렬).
// 뉴스감성 보정은 과거 뉴스 데이터가 없어 완전히 생략(모델에 null/[] 전달 — "실패 시 두 보정
// 모두 건너뜀"과 같은 경로).
// hyg(HYG 종가, 달러)는 선택적 override를 받는다 — 기본값 78은 그대로라 기존 호출부
// (fetch-data.mjs의 30분 cron 프로덕션 하네스, history.json 기반 단기 재구성)는 동작 무변화.
// 장기(수년) 백테스트 스크립트만 실제 과거 HYG 종가를 넘겨 신용 스트레스 보정을 상수 대신
// 진짜 값으로 재현할 수 있다. hyg(달러)→hyBp(bp) 근사는 그대로 유지(포뮬러가 아니라 이 데이터
// 소스만의 입력 변환이므로 R352 대상 아님) — 다만 이제 모델의 hyBp 파라미터 하나로만 들어간다.
export function reconstructScore({ vix, fg, dxy, tnx, wti, vvix, spxPrice, spx50ma, spx200ma, mode, hyg: hygOverride }) {
  const clampedVix = CLAMP(vix, 5, 150);
  const clampedVvix = CLAMP(vvix ?? 100, 50, 250);
  const clampedDxy = CLAMP(dxy ?? 104, 80, 130);
  const clampedTnx = CLAMP(tnx ?? 4.3, 0, 8);
  const oilPrice = CLAMP(wti ?? 0, 0, 300);
  const clampedFg = CLAMP(fg, 0, 100);
  const hyg = (typeof hygOverride === 'number' && isFinite(hygOverride)) ? hygOverride : 78;
  const hyBp = (hyg > 0 && hyg < 90) ? Math.round((100 - hyg) * 15) : 0;
  const maCurrent = spx50ma != null && spx200ma != null;

  const model = computeTradingScoreModel({
    mode,
    vix: clampedVix, vvix: clampedVvix, dxy: clampedDxy, tnx: clampedTnx, oilPrice, fg: clampedFg,
    maCurrent, spx200ma: maCurrent ? spx200ma : null, spx50ma: maCurrent ? spx50ma : null, spxPrice,
    breadthAvailable: false, breadth200: null,
    pcr: null,
    hyBp: hyBp > 0 ? hyBp : null,
    newsSentimentScore: null, newsRiskSignals: []
  });

  return {
    total: model.total, volScore: model.volScore, momScore: model.momScore,
    trendScore: model.trendScore, breadthScore: model.breadthScore, macroScore: model.macroScore,
    componentMissing: model.componentMissing, componentCoveragePct: model.componentCoveragePct
  };
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
        breadthPcrFellBackToUnavailable: true, // history.json에 이 필드들은 아예 없음 — 항상 참(RM-03: 중립 근사가 아니라 정직한 미수신)
        newsSentimentOmitted: true,
        componentCoveragePct: result.componentCoveragePct,
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
    note: 'Phase 3 [C3] P599 — computeTradingScore 재구성 검증 하네스. RM-03(2026-07-19)부터 src/domain/signal/trading-score.js 단일 구현을 호출한다. breadth/pcr/뉴스감성은 history.json에 구조적으로 없어 라이브의 현재 fail-closed 미수신 처리(null/false)를 그대로 따른다 — 예전의 중립 상수 근사(57/0.95)는 제거됨(F-11 드리프트였음). 표본 수가 통계적으로 유의미해질 때까지(대략 n>=30) summary를 "검증 결과"가 아니라 "누적 진행 상황"으로 취급할 것.',
    summary: { n5d: corr5d.n, corr5d: corr5d.rho, n21d: corr21d.n, corr21d: corr21d.rho, statisticallyMeaningful: corr5d.n >= 30 && corr21d.n >= 30 },
    records: merged,
  };
  await writeFile(outPath, JSON.stringify(output, null, 1) + '\n', 'utf8');
  return output;
}

// 직접 실행 시에만 동작(다른 스크립트가 함수만 import할 수 있도록 top-level 부작용 없음)
const __entryArg = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (__entryArg && (import.meta.url === `file://${__entryArg}` || import.meta.url === `file:///${__entryArg}`)) {
  runBacktest(HISTORY_PATH, OUT_PATH).then((output) => {
    console.log(`[backtest-trading-score] records=${output.records.length} summary=${JSON.stringify(output.summary)}`);
  }).catch((e) => { console.error('[backtest-trading-score] error:', e.stack || e.message); process.exit(1); });
}
