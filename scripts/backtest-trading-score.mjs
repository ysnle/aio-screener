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
// reconstructScore() now calls the single extracted src/domain/market/signal/trading-score.js model
// instead (R352: extraction is code motion, not a parallel model) — see that file's own comment
// for the full parity story and architecture/fixtures/trading-score-golden.json /
// scripts/ci-domain-parity-check.mjs for the standing parity gate.
//
// 중요한 데이터 제약(실측, 2026-07-04): history.json 201일 중 당시 momScore의 유일한 입력인 fg
// (Fear&Greed)는 24일치뿐이고 전부 최근 2026-06-10~07-03 구간 — forward 21일 수익률 확인
// 가능한 표본은 1~3개뿐이었다. v59.45 P9-BT-02: P1388(trading-score v4)부터 fg는 합성 점수의
// 입력이 아니다(위험선호 = PCR·HY). 그래서 fg 유무로 표본을 고르지 않는다 — 점수에 쓰지 않는 공급자의
// 결측이 평가 행을 지웠다. 이 스크립트는 그 사실을 감추지 않고 summary에 표본 수를
// 그대로 노출한다. 재튜닝 근거로 쓰기엔 표본이 턱없이 부족 — 인프라만 구축, 시간이 지나며
// history.json이 30분마다 계속 쌓이는 대로 표본이 자동으로 커진다. 표본 수 충분성은
// 통계적 유의성 검정과 별개이며, 이 짧은 하네스는 CI/p-value를 계산하지 않으므로
// `statisticallyMeaningful`을 절대 true로 승격하지 않는다.
//
// 실행: node scripts/backtest-trading-score.mjs [--history=path] [--out=path]
//       (public-data/history.json은 이미 커밋된 로컬 파일 — 네트워크 호출 없음, 안전)
// ─────────────────────────────────────────────────────────────────────────

import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeTradingScoreModel } from '../src/domain/market/signal/trading-score.js';
import { spearman as spearmanWithMidranks, nonOverlappingCount } from './lib/rank-statistics.mjs';
import { readHistoryRows } from '../src/domain/market/indices/history-rows.js';
import { isCloseSessionDate } from '../src/domain/market/session/close-series.js';

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
// Credit (R343): the model's hyBp is the FRED HY OAS in bp. The former HYG-price proxy ((100 - HYG) * 15, with a
// constant HYG 78 = 330 bp when the caller had no HYG) fed a fabricated, duration-contaminated spread into the
// risk-appetite axis of every reconstructed score. A caller passes a measured OAS as `hyBp` or nothing; with nothing
// the axis is missing and the model re-normalises over the components it has.
// Every other input follows the same rule: a missing VIX, VVIX, DXY, 10-year yield or WTI stays missing (the former
// defaults 100 / 104 / 4.3 / 0 scored a session without the reading as a calm one).
export function reconstructScore({ vix, fg, dxy, tnx, wti, vvix, spxPrice, spx50ma, spx200ma, mode, hyBp = null }) {
  const measured = (value, lo, hi) => (typeof value === 'number' && Number.isFinite(value) ? CLAMP(value, lo, hi) : null);
  const maCurrent = spx50ma != null && spx200ma != null;

  const model = computeTradingScoreModel({
    mode,
    vix: measured(vix, 5, 150), vvix: measured(vvix, 50, 250), dxy: measured(dxy, 80, 130), tnx: measured(tnx, 0, 8),
    oilPrice: measured(wti, 0, 300), fg: measured(fg, 0, 100),
    maCurrent, spx200ma: maCurrent ? spx200ma : null, spx50ma: maCurrent ? spx50ma : null, spxPrice,
    breadthAvailable: false, breadth200: null,
    pcr: null,
    hyBp: measured(hyBp, 0, 10000),
    newsSentimentScore: null, newsRiskSignals: []
  });

  return {
    total: model.total, volScore: model.volScore, momScore: model.momScore,
    trendScore: model.trendScore, breadthScore: model.breadthScore, macroScore: model.macroScore,
    componentMissing: model.componentMissing, componentCoveragePct: model.componentCoveragePct
  };
}

// ── history.json → 거래일(spx 존재)만 필터링, forward return + trailing MA 계산 ──
// 2026-10-19 data audit: weekend/holiday rows repeat the last close (fieldMeta.spx.observationRelation 'carried-forward'),
// so 30 of 180 records were one session scored twice and "5d" forward returns spanned calendar rows, not sessions.
// A row dated on a weekend or exchange holiday is never a session, whatever its field metadata says (rows written before
// the metadata existed carry none).
export function buildTradingDaySeries(history) {
  const seenSessions = new Set();
  return history.filter(d => {
    if (!d || typeof d.spx !== 'number' || !Number.isFinite(d.spx)) return false;
    if (!isCloseSessionDate(String(d.date || ''), 'US')) return false;
    const meta = d.fieldMeta?.spx;
    if (meta?.observationRelation === 'carried-forward') return false;
    const session = meta?.sessionDate;
    if (session) { if (seenSessions.has(session)) return false; seenSessions.add(session); }
    return true;
  });
}

function trailingMA(series, idx, window) {
  if (idx - window + 1 < 0) return null;
  let sum = 0;
  for (let i = idx - window + 1; i <= idx; i++) sum += series[i].spx;
  return sum / window;
}

function forwardReturn(series, idx, daysAhead, lag = 0) {
  const i = idx + lag;
  const j = i + daysAhead;
  if (j >= series.length) return null;
  const cur = series[i].spx, fut = series[j].spx;
  if (!cur || !fut) return null;
  return (fut - cur) / cur * 100;
}

// A sample-size floor is not a significance test. Keep the legacy boolean fail-closed until
// this producer emits an actual CI or p-value with an explicitly reviewed method.
// Daily rows with an n-session forward return overlap: n consecutive rows share most of one window (R1247). The floor is
// judged on the count of windows that do not overlap, counted from the rows' own session positions (a window may start
// at the session that closed the one before) — rows / n rounded down read 284 rows as 56 windows where 57 exist. A
// correlation without its counted windows (`nEff`) has none: the floor fails closed.
export const SCORE_BACKTEST_MIN_INDEPENDENT = 30;
export function summarizeTradingScoreBacktest(corr5d = {}, corr21d = {}, lagged = {}) {
  const n5d = Number.isInteger(corr5d.n) ? corr5d.n : 0;
  const n21d = Number.isInteger(corr21d.n) ? corr21d.n : 0;
  const nEff5d = Number.isInteger(corr5d.nEff) ? corr5d.nEff : 0;
  const nEff21d = Number.isInteger(corr21d.nEff) ? corr21d.nEff : 0;
  const sample = (nEff) => (nEff >= SCORE_BACKTEST_MIN_INDEPENDENT ? 'sufficient' : 'insufficient');
  return {
    n5d,
    corr5d: corr5d.rho ?? null,
    n21d,
    corr21d: corr21d.rho ?? null,
    nEff5d,
    nEff21d,
    // Per horizon, so a 21-session correlation on 13 windows reads as insufficient beside a sufficient 5-session one.
    sample5d: sample(nEff5d),
    sample21d: sample(nEff21d),
    minIndependent: SCORE_BACKTEST_MIN_INDEPENDENT,
    sampleBasis: 'non-overlapping windows counted from session positions: a kept window starts at or after the previous kept window\'s closing session',
    // Entry one session after the score's close (a score known only at the close cannot be traded at that close).
    corr5dLag1: lagged.corr5d?.rho ?? null,
    corr21dLag1: lagged.corr21d?.rho ?? null,
    sampleSizeSufficient: nEff5d >= SCORE_BACKTEST_MIN_INDEPENDENT && nEff21d >= SCORE_BACKTEST_MIN_INDEPENDENT,
    significanceStatus: 'UNKNOWN',
    statisticallyMeaningful: false
  };
}

export async function runBacktest(historyPath, outPath) {
  const history = readHistoryRows(JSON.parse(await readFile(historyPath, 'utf8')));
  const tradingDays = buildTradingDaySeries(history);

  const records = [];
  for (let i = 0; i < tradingDays.length; i++) {
    const d = tradingDays[i];
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
      fwd5dReturnLag1: forwardReturn(tradingDays, i, 5, 1),
      fwd21dReturnLag1: forwardReturn(tradingDays, i, 21, 1),
      dataCompleteness: {
        vix: typeof d.vix === 'number', dxy: typeof d.dxy === 'number', tnx: typeof d.tnx === 'number',
        wti: typeof d.wti === 'number', vvix: typeof d.vvix === 'number',
        hyOas: false, // history.json carries no FRED HY OAS; the risk-appetite axis is missing, never proxied (R343)
        trend200maAvailable: spx200ma != null,
        breadthPcrFellBackToUnavailable: true, // history.json에 이 필드들은 아예 없음 — 항상 참(RM-03: 중립 근사가 아니라 정직한 미수신)
        newsSentimentOmitted: true,
        componentCoveragePct: result.componentCoveragePct,
      },
    });
  }

  // Spearman 순위상관 — 동점은 평균순위(midrank)로 처리한다.
  // Each pair carries its session position (the record's index in the session series) for the window count.
  function spearman(pairs, horizon) {
    const clean = pairs.filter(p => Array.isArray(p) && p[0] != null && p[1] != null);
    const rho = spearmanWithMidranks(clean.map(p => p[0]), clean.map(p => p[1]));
    return { n: clean.length, nEff: nonOverlappingCount(clean.map(p => p[2]), horizon), rho: rho == null ? null : Math.round(rho * 1000) / 1000 };
  }

  const corr5d = spearman(records.map((r, i) => [r.reconstructedScore, r.fwd5dReturn, i]), 5);
  const corr21d = spearman(records.map((r, i) => [r.reconstructedScore, r.fwd21dReturn, i]), 21);
  const lagged = {
    corr5d: spearman(records.map((r, i) => [r.reconstructedScore, r.fwd5dReturnLag1, i]), 5),
    corr21d: spearman(records.map((r, i) => [r.reconstructedScore, r.fwd21dReturnLag1, i]), 21)
  };

  // 날짜별 upsert + 180일 캡 (updateBacktestHistory, fetch-data.mjs:886-909와 동일 패턴)
  let existing = [];
  try { const raw = JSON.parse(await readFile(outPath, 'utf8')); if (Array.isArray(raw.records)) existing = raw.records; } catch { /* 최초 실행 */ }
  const recomputedFrom = records.length ? records.map((r) => r.date).sort()[0] : null;
  // Rows kept from an earlier file are held to the same session rule as new ones.
  const byDate = new Map(existing.filter((r) => (!recomputedFrom || r.date < recomputedFrom) && isCloseSessionDate(String(r?.date || ''), 'US')).map(r => [r.date, r]));
  for (const r of records) byDate.set(r.date, r); // 새 계산이 항상 최신 우선
  let merged = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  if (merged.length > 180) merged = merged.slice(merged.length - 180);

  const output = {
    generatedAt: new Date().toISOString(),
    note: 'Phase 3 [C3] P599 — computeTradingScore 재구성 검증 하네스. RM-03(2026-07-19)부터 src/domain/market/signal/trading-score.js 단일 구현을 호출한다. breadth/pcr/뉴스감성은 history.json에 구조적으로 없어 라이브의 현재 fail-closed 미수신 처리(null/false)를 그대로 따른다 — 예전의 중립 상수 근사(57/0.95)는 제거됨(F-11 드리프트였음). 과거 행은 발행 당시 값이 아니라 실행마다 history.json 창으로 다시 계산한 값이다(restatement). summary의 sampleSizeSufficient는 관측 수 바닥일 뿐이며, 이 하네스는 CI/p-value를 계산하지 않아 statistical significance는 UNKNOWN, statisticallyMeaningful은 false로 fail-closed한다.',
    summary: summarizeTradingScoreBacktest(corr5d, corr21d, lagged),
    // What the reconstructed score rests on: no credit input (R343) and no breadth, so it is a volatility + trend + macro read.
    inputs: { credit: 'none: no FRED HY OAS in history.json; the HYG-price proxy is not used', missingInputPolicy: 'missing stays missing (no neutral default)', rowBasis: 'completed US sessions only' },
    // The rows are reconstructions, not the scores the screens published: every run recomputes each row inside history.json's
    // rolling window, so a past row changes when sessions leave the window's start (its 200-session average stops
    // forming: 2026-07-15 read 68, then 69). Rows older than the window keep the run that last computed them. Like the
    // theme-stage backfill (`recomputed`) and the stamped weekly outcome tables, the series says it is recomputed.
    restatement: { pastRows: 'recomputed', recomputedFrom, rule: 'every run recomputes rows from recomputedFrom on; earlier rows keep the run that last computed them' },
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
