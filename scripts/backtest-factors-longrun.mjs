// ─────────────────────────────────────────────────────────────────────────
// scripts/backtest-factors-longrun.mjs — WO-3 reduced-scope validation (P666)
//
// 왜: CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md WO-3("Factor Model 연구→프로덕션 검증")의
//     완료 게이트("최소 수년·다중 regime, 6개 rebalance보다 충분히 큰 표본")를 문자 그대로
//     만족하는 건 라이브 프로덕션 팩터 백테스트(scripts/fetch-data.mjs backtestFactors())가
//     현재 SCREENER_DB 873종목의 딱 1년치(6개 리밸런스 시점)만 쓰고 있어 불가능 — 코드 자체에
//     이미 "6개 리밸런스로는 부족"이라는 취지의 주석(P586/C2)이 있었다. 사용자 확인(2026-07-10,
//     AskUserQuestion) 후 "제한된 표본"으로 진행: 시총 상위 ~120종목만 골라(대형/유동성 높은
//     이름 위주 — Yahoo 부하와 표본 크기의 균형) 10년치를 fetch, 월간(~21거래일) 리밸런스로
//     ~100개 이상의 시점을 확보해 momentum/trend/lowvol/kalman(+composite) IC를 재검증한다.
//
// 정직하게 남는 한계(둘 다 무료 데이터로 근본 해결 불가 — 코드로 "PASS"라고 주장하지 않는다):
//   (1) survivorship bias — 오늘 시점 유니버스로 10년을 보므로, 그 기간에 상장폐지/인수/부실로
//       탈락한 종목은 표본에 아예 없다. 이는 모멘텀/퀄리티류 팩터의 겉보기 성과를 체계적으로
//       부풀리는 경향이 문헌에 잘 알려져 있다. Point-in-time 지수 구성종목 이력 데이터(유료)
//       없이는 구조적으로 해결 불가 — DEFERRED-BLOCKS.md B9(WO-6과 동일 성격의 "진짜 블록 아닌
//       엔지니어링/데이터 규모 문제")에 추가 기록.
//   (2) 표본은 873종목 전체가 아니라 시총 상위 ~120종목 — Yahoo 공개 API에 과거 IP 차단 이력이
//       있어(scripts/fetch-data.mjs 인접 ci.yml 주석) 대량 동시 요청을 피하기 위한 사용자 승인
//       범위 축소. size/value/quality 3개 팩터는 라이브 backtestFactors() 자체가 이미 무료
//       다년치 소스 부재로 제외(선先 기존 사실, 이 스크립트가 새로 만든 제약 아님).
//
// 실행: node scripts/backtest-factors-longrun.mjs [--range=10y] [--top=120] [--out=path]
//       (네트워크 호출 있음 — Yahoo 공개 chart API, concurrency=4로 제한. cron 미배선 — 연구용
//       수동 스크립트.)
// ─────────────────────────────────────────────────────────────────────────

import { writeFile, readFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { backtestFactors } from './fetch-data.mjs';
import { classifyRegime, spearmanWithCI } from './backtest-trading-score-longrun.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));

function argValue(name, fallback = null) {
  const pref = `--${name}=`;
  const found = process.argv.find(a => a.startsWith(pref));
  return found ? found.slice(pref.length) : fallback;
}

const RANGE = argValue('range', '10y');
const TOP_N = Number(argValue('top', '120'));
const OUT_PATH = argValue('out', `${__dir}/../public-data/factor-backtest-longrun.json`);
const CONCURRENCY = 4; // scripts/fetch-data.mjs backfillHistory()와 동일한 값 — 이미 검증된 안전 폭

const YAHOO_HOSTS = ['https://query1.finance.yahoo.com', 'https://query2.finance.yahoo.com'];
const _yhSym = (s) => s.replace(/^([A-Z]+)\.([A-Z])$/, '$1-$2'); // BRK.B → BRK-B (fetch-data.mjs와 동일 규칙)

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function fetchDailyBars(symbol, range) {
  for (const host of YAHOO_HOSTS) {
    try {
      const url = host + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=' + range;
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) continue;
      const j = await res.json();
      const r = j?.chart?.result?.[0];
      const ts = r?.timestamp;
      const closes = r?.indicators?.quote?.[0]?.close;
      const adjArr = r?.indicators?.adjclose?.[0]?.adjclose;
      if (!Array.isArray(ts) || !Array.isArray(closes)) continue;
      const dates = [], closeArr = [], adjArr2 = [];
      for (let i = 0; i < ts.length; i++) {
        const c = closes[i];
        if (typeof c !== 'number' || !isFinite(c)) continue;
        dates.push(new Date(ts[i] * 1000).toISOString().slice(0, 10));
        closeArr.push(c);
        const a = Array.isArray(adjArr) ? adjArr[i] : undefined;
        adjArr2.push((typeof a === 'number' && isFinite(a) && a > 0) ? a : c);
      }
      if (closeArr.length > 0) return { dates, closes: closeArr, adjCloses: adjArr2 };
    } catch { /* 다음 호스트 시도 */ }
  }
  return null;
}

async function loadTopUniverse(topN) {
  const raw = await readFile(`${__dir}/../public-data/screener-universe.json`, 'utf8');
  const j = JSON.parse(raw);
  const rows = (j.universe || []).filter(r => r && r.sym && typeof r.mcap === 'number');
  rows.sort((a, b) => b.mcap - a.mcap);
  return rows.slice(0, topN);
}

export async function runFactorLongrunBacktest(range, topN, outPath) {
  const universe = await loadTopUniverse(topN);

  // 종목 데이터 + regime 분류용 시장 시리즈(SPX/VIX)를 동일 range로 병렬 fetch(concurrency=4)
  const stockResults = await mapLimit(universe, CONCURRENCY, async (row) => {
    const bars = await fetchDailyBars(_yhSym(row.sym), range);
    return bars ? { sym: row.sym, mcap: row.mcap, closes: bars.closes, adjCloses: bars.adjCloses, dates: bars.dates } : null;
  });
  const stockData = stockResults.filter(Boolean);
  if (stockData.length < 20) {
    throw new Error(`insufficient fetched tickers (${stockData.length}/${universe.length}) — Yahoo fetch likely degraded, aborting rather than reporting on a truncated universe`);
  }

  const [spxBars, vixBars] = await Promise.all([
    fetchDailyBars('^GSPC', range),
    fetchDailyBars('^VIX', range),
  ]);
  if (!spxBars || !vixBars) throw new Error('failed to fetch SPX/VIX for regime classification');
  const marketSeries = spxBars.dates.map((date, i) => ({ date, spx: spxBars.closes[i], vix: null }));
  // VIX는 날징 인덱스가 SPX와 정확히 일치한다는 보장이 없어(휴장일 미세 차이 가능) 날짜 문자열로 매칭
  const vixByDate = new Map(vixBars.dates.map((d, i) => [d, vixBars.closes[i]]));
  marketSeries.forEach((r) => { r.vix = vixByDate.get(r.date) ?? null; });

  // 월간(~21거래일) 리밸런스 offset 생성 — 프로덕션의 6개(147~42일) 대비 훨씬 큰 표본.
  // 가장 긴 종목 시리즈를 기준으로 offset 범위를 잡고, 각 종목/offset 조합은
  // backtestFactors 자체의 길이 가드(c.length < off+1이면 skip)가 개별적으로 처리한다.
  const maxLen = Math.max(...stockData.map(s => s.closes.length));
  const offsetsAsc = [];
  for (let off = 63; off < maxLen - 1; off += 21) offsetsAsc.push(off);
  const offsetsDesc = [...offsetsAsc].sort((a, b) => b - a); // 큰 off(더 과거) 먼저 = 시간순 오름차순

  const FWD_HORIZONS = [1, 5, 21, 63];
  const overall = {};
  for (const fwd of FWD_HORIZONS) {
    const r = backtestFactors(stockData, { offsets: offsetsAsc, fwdDays: fwd });
    overall[`fwd${fwd}d`] = { dates: r.dates, n: r.n, ic: r.ic, icIR: computeICIR(r.icByDate), quantileSpread: r.quantileSpread, hitRate: r.hitRate };
  }

  // walk-forward: 시간순 70/30 분할(reference/holdout) — offset이 클수록 과거이므로
  // 오름차순(과거→최근)으로 정렬한 뒤 앞 70%=reference(과거), 뒤 30%=holdout(최근).
  const splitIdx = Math.floor(offsetsDesc.length * 0.7);
  const referenceOffsets = offsetsDesc.slice(0, splitIdx);
  const holdoutOffsets = offsetsDesc.slice(splitIdx);
  const refResult = backtestFactors(stockData, { offsets: referenceOffsets, fwdDays: 21 });
  const holdResult = backtestFactors(stockData, { offsets: holdoutOffsets, fwdDays: 21 });
  const walkForward = {
    referencePeriod: { n: refResult.dates, ic: refResult.ic, icIR: computeICIR(refResult.icByDate) },
    holdoutPeriod: { n: holdResult.dates, ic: holdResult.ic, icIR: computeICIR(holdResult.icByDate) },
  };

  // regime별 분해: 각 offset(리밸런스 시점)을 시장 시리즈에서 근사 매칭해 regime 라벨 부여 후 그룹핑.
  // marketSeries와 종목 시리즈 길이가 정확히 같지 않을 수 있어(휴장일 미세 차이) 근사 매칭 —
  // regime은 범주형 라벨이라 며칠 오차는 실질적 영향이 미미하다(수치형 팩터 계산 자체와는 무관).
  const regimeGroups = new Map();
  offsetsAsc.forEach((off) => {
    const idx = marketSeries.length - off;
    if (idx < 0 || idx >= marketSeries.length) return;
    const label = classifyRegime(marketSeries[idx], marketSeries, idx);
    if (!regimeGroups.has(label)) regimeGroups.set(label, []);
    regimeGroups.get(label).push(off);
  });
  const regimes = [...regimeGroups.entries()]
    .filter(([, offs]) => offs.length >= 5)
    .map(([label, offs]) => {
      const r = backtestFactors(stockData, { offsets: offs, fwdDays: 21 });
      return { label, n: r.dates, ic: r.ic, icIR: computeICIR(r.icByDate) };
    })
    .sort((a, b) => b.n - a.n);

  const baselineRef = backtestFactors(stockData, { offsets: offsetsAsc, fwdDays: 21 });
  const output = {
    generatedAt: new Date().toISOString(),
    methodology: {
      scope: `Reduced-scope validation of the live factor ranking model's momentum/trend/lowvol/kalman(+composite) sub-formula, using top ${topN} tickers by market cap (of ${universe.length} in the full SCREENER_DB universe) with real ${range} daily history.`,
      excludedFactors: baselineRef.excludedFactors,
      excludedFactorsReason: baselineRef.excludedFactorsReason,
      survivorshipBiasCaveat: 'Uses TODAY\'s top-mcap universe applied retroactively over the full lookback window — any ticker that would have been delisted/acquired/failed during this period is entirely absent from the sample. This systematically tends to overstate momentum/quality-style factor performance in the finance literature. Not resolvable without paid point-in-time index-constituent history; NOT claimed as resolved or "passed" here.',
      subsetNotFullUniverse: `Uses top ${topN} by market cap, not the full ${universe.length}-ticker universe, to bound Yahoo Finance request volume (this repo's own fetch-data.mjs/ci.yml comments document a prior Yahoo IP-blocking incident from excess request volume).`,
      icIRNote: 'ICIR = mean(IC across rebalance dates) / stddev(IC across rebalance dates), with a t-stat and approximate 95% CI via the standard IC-IR normal approximation (t = ICIR * sqrt(dates), CI = mean ± 1.96*stddev/sqrt(dates)) — this is what Codex\'s WO-3 gate means by "IC/ICIR/t-stat", distinct from the pooled-cross-section Fisher-z CI used in the WO-2 score backtest.',
      liveModelParity: 'This still validates only 4 of the live _aioComputeFactorRanks() model\'s 7 factors, always at NEUTRAL-regime weights (same limitation already documented in fetch-data.mjs backtestFactors() since P586/C2) — RISK_OFF/RISK_ON adaptive weight blending remains unvalidated here.',
    },
    universe: { requestedTop: topN, fetchedTickers: stockData.length, fullUniverseSize: universe.length, dataRange: range },
    rebalanceDates: { count: offsetsAsc.length, comparedToProductionBacktest: 6 },
    overallByHorizon: overall,
    walkForward,
    regimes,
    caveats: [
      'Survivorship bias is NOT resolved (see methodology.survivorshipBiasCaveat) — treat all IC/ICIR figures here as an upper-bound-leaning estimate, not a clean out-of-sample figure.',
      'Only 4 of 7 live-model factors covered (size/value/quality excluded — pre-existing limitation, not new to this script).',
      'Top-mcap subset, not the full 873-ticker universe.',
      'Live adaptive regime-weight blending (RISK_OFF/RISK_ON) is not validated — only the fixed NEUTRAL-weight composite.',
    ],
  };

  await writeFile(outPath, JSON.stringify(output, null, 1) + '\n', 'utf8');
  return output;
}

// ICIR = mean(IC)/stddev(IC) across rebalance dates, with t-stat and normal-approximation 95% CI —
// standard quant factor-research convention (distinct from WO-2's Fisher-z pooled-observation CI,
// since here each "observation" is itself a cross-sectional IC estimate, not a single date's return).
function computeICIR(icByDateMap) {
  const out = {};
  for (const [factor, values] of Object.entries(icByDateMap || {})) {
    const clean = values.filter((v) => typeof v === 'number' && isFinite(v));
    const n = clean.length;
    if (n < 3) { out[factor] = { n, mean: null, std: null, icIR: null, tStat: null, ci95: null }; continue; }
    const mean = clean.reduce((s, v) => s + v, 0) / n;
    const variance = clean.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    const std = Math.sqrt(variance);
    const icIR = std > 0 ? mean / std : null;
    const se = std / Math.sqrt(n);
    const tStat = se > 0 ? mean / se : null;
    const ci95 = se > 0 ? [Math.round((mean - 1.96 * se) * 1000) / 1000, Math.round((mean + 1.96 * se) * 1000) / 1000] : null;
    out[factor] = { n, mean: Math.round(mean * 1000) / 1000, std: Math.round(std * 1000) / 1000, icIR: icIR != null ? Math.round(icIR * 1000) / 1000 : null, tStat: tStat != null ? Math.round(tStat * 100) / 100 : null, ci95 };
  }
  return out;
}

const __entryArg = process.argv[1] ? process.argv[1].replace(/\\/g, '/') : '';
if (__entryArg && (import.meta.url === `file://${__entryArg}` || import.meta.url === `file:///${__entryArg}`)) {
  runFactorLongrunBacktest(RANGE, TOP_N, OUT_PATH).then((output) => {
    console.log(`[backtest-factors-longrun] tickers=${output.universe.fetchedTickers}/${output.universe.requestedTop} rebalanceDates=${output.rebalanceDates.count} (vs production's 6)`);
    console.log(`[backtest-factors-longrun] fwd21d composite: ${JSON.stringify(output.overallByHorizon.fwd21d.ic)} icIR=${JSON.stringify(output.overallByHorizon.fwd21d.icIR.composite)}`);
    console.log(`[backtest-factors-longrun] walk-forward: reference.composite=${JSON.stringify(walkForwardSummary(output.walkForward.referencePeriod))} holdout.composite=${JSON.stringify(walkForwardSummary(output.walkForward.holdoutPeriod))}`);
    console.log(`[backtest-factors-longrun] regimes: ${output.regimes.map(r => r.label + '(n=' + r.n + ')').join(', ')}`);
  }).catch((e) => { console.error('[backtest-factors-longrun] error:', e.stack || e.message); process.exit(1); });
}
function walkForwardSummary(period) { return { ic: period.ic.composite, icIR: period.icIR.composite && period.icIR.composite.icIR }; }
