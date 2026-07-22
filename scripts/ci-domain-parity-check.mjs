import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeTradingScoreModel } from '../src/domain/signal/trading-score.js';
import { deriveSignalDecisionFromTradingScore } from '../src/domain/signal/trading-score.js';
import { computeRelativeRotation } from '../src/domain/themes/rrg.js';
import { classifyMovingAverageStructure, deriveMultiTimeframeView, deriveTechnicalStageFromOhlcv } from '../src/domain/technical/stage.js';
import { computeNewsSentimentScore, computeNewsRiskSignals } from '../src/domain/news/scoring.js';
import { deriveTreasuryCurveEvidence } from '../src/domain/macro/treasury-curve.js';
import { deriveConcentrationRisk } from '../src/domain/portfolio/concentration.js';
import { computeFactorRanks } from '../src/domain/screener/factor-ranks.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message) => { throw new Error(`[domain-parity] ${message}`); };

// RM-03: trading-score, RRG, Weinstein/MTF, and news scoring/risk-signals have REAL parity below
// (extracted models vs golden dumps of the unmodified legacy functions, captured by
// scripts/dump-trading-score-fixtures.mjs / dump-rrg-fixtures.mjs / dump-weinstein-mtf-
// fixtures.mjs / dump-news-scoring-fixtures.mjs before each extraction).
// 2026-07-21/P755: `deriveNewsClaim` (src/domain/news/claims.js, single-article title/source/url
// shape) is RETIRED — grep confirmed zero real callers anywhere in src/ or scripts/ beyond this
// smoke fixture, no corresponding legacy formula existed (it wasn't a stand-in for the real news
// scoring/risk-signal functions above, which were already extracted separately in P749), and
// _context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md:430-431 already documented it as
// out-of-scope. Deleted per R352 rather than left as unreferenced dead code.
// 2026-07-21/P756: `deriveTechnicalModel` (src/domain/technical/indicators.js) is RETIRED — it was
// an independently-invented MA20/50 toy with no legacy formula behind it, superseded by
// deriveTechnicalStageFromOhlcv (src/domain/technical/stage.js), which composes real closes-derived
// SMAs with the already-extracted, already-parity-verified classifyMovingAverageStructure below.
// It's no longer part of this file's smoke set (real assertions live in
// scripts/ci-esm-core-unit-check.mjs instead, matching how the breadth-participation classifier is
// covered) — normalizeAnalysis's real caller now uses it directly.
// 2026-07-21/P757: `deriveMacroModel` (src/domain/macro/model.js) is RETIRED — zero real callers,
// no legacy formula behind its twoYear/tenYear slope-only shape. Superseded by
// deriveTreasuryCurveEvidence (src/domain/macro/treasury-curve.js) below, extracted for real from
// js/aio-core.js:window.AIO.getUsTreasuryCurveEvidence with a golden-fixture dump (see
// architecture/fixtures/macro-curve-golden.json) — the first REAL parity for the "macro" domain.
// 2026-07-21/P758: `derivePortfolioRisk` (src/domain/portfolio/risk.js) is RETIRED — zero real
// callers, and its 20%/40% concentration bands were unrelated to legacy's actual 10%/15%/25%
// concentrationPenalty tiers. Superseded by deriveConcentrationRisk (src/domain/portfolio/
// concentration.js), extracted for real from js/aio-core.js's calcPortfolioTechnicalRisk/
// calcPositionTechnicalRisk (concentration slice only, not the full sell-pressure/heatScore
// model) — see architecture/fixtures/portfolio-concentration-golden.json.
// P761 retired the market and screener smoke models: both had zero real callers and no
// corresponding legacy formula. Market uses the canonical snapshot/quote state directly, and
// screener uses the extracted factor-ranks model. The remaining signal decision is still
// smoke-only until ARX-11 replaces it with the real trading-score-derived orchestration. The
// old same-fixture "live"/"backtest" comparison could only catch an import/crash regression, not
// a real divergence, so it must not be used as evidence of parity. RM-03 item 2 measured that
// F&G has no local synthesis to extract (the score is fetched pre-computed from CNN, never derived
// from sub-indicators in this codebase — see _context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md
// F-12) and that the signal toy had zero live consumers beyond `.status`. P762/ARX-11 now maps the
// canonical trading-score model into the signal envelope; the model-version assertion below is a
// smoke guard for that mapping, while the trading-score golden fixtures provide the real formula
// parity. Do not read this mapping check as an independent signal prediction backtest.
const inputVersion = 'fixture-input.v1';
const signalScore = computeTradingScoreModel({ mode: 'swing', vix: 18, vvix: 90, dxy: 100, tnx: 3.5, oilPrice: 80, fg: 50, maCurrent: true, spx200ma: 450, spx50ma: 480, spxPrice: 500, breadthAvailable: true, breadth200: 60, pcr: 1, hyBp: 300, newsSentimentScore: 50, newsRiskSignals: [] });
const signal = deriveSignalDecisionFromTradingScore({ score: signalScore, inputVersion });
if (signal.status === 'blocked' || !signal.modelVersion) fail('PARITY_SIGNAL_BLOCKED');

// ── REAL parity: computeTradingScoreModel vs golden legacy dump ──────────────────────────────
function clamp(value, lo, hi) {
  return value == null || !Number.isFinite(Number(value)) ? null : Math.max(lo, Math.min(hi, Number(value)));
}
function resolveTradingScoreInputs(fixtureInputs) {
  const liveData = fixtureInputs.liveData || {};
  const readPrice = (symbol) => (liveData[symbol] && liveData[symbol].price != null) ? liveData[symbol].price : null;
  const closingVal = (symbol) => {
    const point = liveData[symbol];
    if (!point) return null;
    return point.chartPreviousClose || point.previousClose || point.price || null;
  };
  const vix = clamp(readPrice('^VIX'), 5, 150);
  const vvix = clamp(readPrice('^VVIX'), 50, 250);
  const dxy = clamp(readPrice('DX-Y.NYB'), 80, 130);
  const tnx = clamp(readPrice('^TNX'), 0, 8);
  const oilPrice = clamp(readPrice('CL=F'), 0, 300);
  const fgInput = fixtureInputs.fg || {};
  const fg = clamp(fgInput.allowedUse ? fgInput.value : null, 0, 100);
  const spxMA = fixtureInputs.spxMA;
  const maCurrent = !!(spxMA && spxMA[50] != null && spxMA[200] != null && fixtureInputs.spxMATsFreshMs != null && fixtureInputs.spxMATsFreshMs <= 4 * 24 * 60 * 60 * 1000);
  const spx200ma = maCurrent ? Number(spxMA[200]) : null;
  const spx50ma = maCurrent ? Number(spxMA[50]) : null;
  const spxPrice = closingVal('^GSPC') || readPrice('^GSPC');
  const breadthInput = fixtureInputs.breadth || {};
  const breadthAvailable = !!breadthInput.available;
  const breadth200 = breadthAvailable ? breadthInput.sma20 : null;
  const evidenceRows = fixtureInputs.decisionEvidenceRows || [];
  const verified = (id, raw) => {
    const row = evidenceRows.find((candidate) => candidate.id === id);
    return row && row.status === 'verified_current' && raw != null && Number.isFinite(Number(raw)) ? Number(raw) : null;
  };
  return {
    mode: undefined, // set by caller
    vix, vvix, dxy, tnx, oilPrice, fg,
    maCurrent, spx200ma, spx50ma, spxPrice,
    breadthAvailable, breadth200,
    pcr: verified('pcr-putcall', fixtureInputs.pcr),
    hyBp: verified('hy-spread-bp', fixtureInputs.hyBp),
    newsSentimentScore: fixtureInputs.newsSentimentScore,
    newsRiskSignals: fixtureInputs.newsRiskImpacts
  };
}

const goldenPath = path.join(root, 'architecture/fixtures/trading-score-golden.json');
const golden = JSON.parse(readFileSync(goldenPath, 'utf8'));
if (!Array.isArray(golden.fixtures) || golden.fixtures.length < 5) fail('trading-score golden fixture missing or too small — re-run scripts/dump-trading-score-fixtures.mjs');
const SCORE_FIELDS = ['total', 'score', 'volScore', 'momScore', 'trendScore', 'breadthScore', 'macroScore', 'componentCoveragePct', 'partial'];
for (const fixture of golden.fixtures) {
  const resolved = resolveTradingScoreInputs(fixture.inputs);
  resolved.mode = fixture.mode;
  const extracted = computeTradingScoreModel(resolved);
  for (const field of SCORE_FIELDS) {
    if (extracted[field] !== fixture.legacyOutput[field]) {
      fail(`TRADING_SCORE_PARITY_MISMATCH:${fixture.name}.${field} extracted=${JSON.stringify(extracted[field])} golden=${JSON.stringify(fixture.legacyOutput[field])}`);
    }
  }
  const missingSorted = [...extracted.componentMissing].sort();
  const goldenMissingSorted = [...(fixture.legacyOutput.componentMissing || [])].sort();
  if (missingSorted.length !== goldenMissingSorted.length || missingSorted.some((value, index) => value !== goldenMissingSorted[index])) {
    fail(`TRADING_SCORE_PARITY_MISMATCH:${fixture.name}.componentMissing extracted=${JSON.stringify(missingSorted)} golden=${JSON.stringify(goldenMissingSorted)}`);
  }
}

// ── REAL parity: computeRelativeRotation vs golden legacy dump (calcLiveRS/classifyRRG) ──────
const rrgGoldenPath = path.join(root, 'architecture/fixtures/rrg-golden.json');
const rrgGolden = JSON.parse(readFileSync(rrgGoldenPath, 'utf8'));
if (!Array.isArray(rrgGolden.fixtures) || rrgGolden.fixtures.length < 5) fail('rrg golden fixture missing or too small — re-run scripts/dump-rrg-fixtures.mjs');
for (const fixture of rrgGolden.fixtures) {
  const { history, benchmarkHistory, hasQuote, hasBenchmarkQuote } = fixture.inputs;
  const extracted = computeRelativeRotation({ history, benchmarkHistory, hasQuote, hasBenchmarkQuote });
  for (const field of ['rsRatio', 'rsMom', 'quadrant', 'reason']) {
    if (extracted[field] !== fixture.legacyOutput[field]) {
      fail(`RRG_PARITY_MISMATCH:${fixture.name}.${field} extracted=${JSON.stringify(extracted[field])} golden=${JSON.stringify(fixture.legacyOutput[field])}`);
    }
  }
}

// ── REAL parity: classifyMovingAverageStructure/deriveMultiTimeframeView vs golden legacy dump
// (calcTechnicalSnapshot/updateMTF) ───────────────────────────────────────────────────────────
const stageGoldenPath = path.join(root, 'architecture/fixtures/weinstein-mtf-golden.json');
const stageGolden = JSON.parse(readFileSync(stageGoldenPath, 'utf8'));
if (!Array.isArray(stageGolden.fixtures) || stageGolden.fixtures.length < 5) fail('weinstein-mtf golden fixture missing or too small — re-run scripts/dump-weinstein-mtf-fixtures.mjs');
const STAGE_FIELDS = ['shortMAState', 'longMAState', 'fullMAState', 'maStackScore', 'sma50Rising', 'trendState', 'stageEstimate'];
const MTF_DAILY_LABELS = { up: '상승', down: '하락', neutral: '중립', pending: '판정 보류' };
const MTF_TREND_LABELS = { up: '상승', down: '하락', mixed: '혼조', pending: '판정 보류' };
for (const fixture of stageGolden.fixtures) {
  const snap = fixture.snapshot;
  if (!snap.ok) continue;
  const extractedStage = classifyMovingAverageStructure({
    sma5: snap.sma5, sma10: snap.sma10, sma20: snap.sma20, sma50: snap.sma50, sma100: snap.sma100, sma200: snap.sma200,
    sma50Prior: fixture.sma50Prior, lastClose: snap.price
  });
  for (const field of STAGE_FIELDS) {
    if (extractedStage[field] !== snap[field]) {
      fail(`STAGE_PARITY_MISMATCH:${fixture.name}.${field} extracted=${JSON.stringify(extractedStage[field])} golden=${JSON.stringify(snap[field])}`);
    }
  }
  if (fixture.mtf && fixture.mtf.available) {
    const extractedMtf = deriveMultiTimeframeView(snap);
    const goldenRows = fixture.mtf.rows;
    const labelPairs = [[MTF_DAILY_LABELS[extractedMtf.daily], goldenRows[0], 'daily'], [MTF_TREND_LABELS[extractedMtf.weekly], goldenRows[1], 'weekly'], [MTF_TREND_LABELS[extractedMtf.medium], goldenRows[2], 'medium']];
    for (const [extractedLabel, goldenRow, axis] of labelPairs) {
      if ((extractedLabel || '판정 보류') !== goldenRow.value) {
        fail(`MTF_PARITY_MISMATCH:${fixture.name}.${axis} extracted=${extractedLabel} golden=${goldenRow.value}`);
      }
    }
  }
}

// ── REAL parity: computeNewsSentimentScore/computeNewsRiskSignals vs golden legacy dump ──────
const newsGoldenPath = path.join(root, 'architecture/fixtures/news-scoring-golden.json');
const newsGolden = JSON.parse(readFileSync(newsGoldenPath, 'utf8'));
if (!Array.isArray(newsGolden.fixtures) || newsGolden.fixtures.length < 5) fail('news-scoring golden fixture missing or too small — re-run scripts/dump-news-scoring-fixtures.mjs');
const NEWS_SENTIMENT_FIELDS = ['score', 'label', 'bullCount', 'bearCount', 'total', 'bullRatio', 'bearRatio'];
for (const fixture of newsGolden.fixtures) {
  const extractedSentiment = computeNewsSentimentScore({ items: fixture.items, now: fixture.now });
  for (const field of NEWS_SENTIMENT_FIELDS) {
    if (extractedSentiment[field] !== fixture.legacyOutput.sentiment[field]) {
      fail(`NEWS_SENTIMENT_PARITY_MISMATCH:${fixture.name}.${field} extracted=${JSON.stringify(extractedSentiment[field])} golden=${JSON.stringify(fixture.legacyOutput.sentiment[field])}`);
    }
  }
  const extractedRisk = computeNewsRiskSignals({ items: fixture.items, now: fixture.now });
  const goldenRisk = fixture.legacyOutput.risk;
  if (extractedRisk.length !== goldenRisk.length) {
    fail(`NEWS_RISK_PARITY_MISMATCH:${fixture.name}.length extracted=${extractedRisk.length} golden=${goldenRisk.length}`);
  }
  for (let i = 0; i < goldenRisk.length; i++) {
    for (const field of ['type', 'level', 'label', 'impact']) {
      if (extractedRisk[i]?.[field] !== goldenRisk[i][field]) {
        fail(`NEWS_RISK_PARITY_MISMATCH:${fixture.name}[${i}].${field} extracted=${JSON.stringify(extractedRisk[i]?.[field])} golden=${JSON.stringify(goldenRisk[i][field])}`);
      }
    }
  }
}

// ── REAL parity: deriveTreasuryCurveEvidence vs golden legacy dump (getUsTreasuryCurveEvidence) ──
const macroCurveGoldenPath = path.join(root, 'architecture/fixtures/macro-curve-golden.json');
const macroCurveGolden = JSON.parse(readFileSync(macroCurveGoldenPath, 'utf8'));
if (!Array.isArray(macroCurveGolden.fixtures) || macroCurveGolden.fixtures.length < 5) fail('macro-curve golden fixture missing or too small — re-run scripts/dump-macro-curve-fixtures.mjs');
const CURVE_FIELDS = ['threeM', 'twoY', 'fiveY', 'tenY', 'thirtyY', 'spread2s10s', 'available', 'complete', 'source'];
for (const fixture of macroCurveGolden.fixtures) {
  const s = fixture.inputs;
  const extracted = deriveTreasuryCurveEvidence({
    live: { irx: s.liveData?.['^IRX']?.price ?? null, twoY: s.live2Y ?? null, fvx: s.liveData?.['^FVX']?.price ?? null, tnx: s.liveData?.['^TNX']?.price ?? null, tenYRaw: s.live10Y ?? null, tyx: s.liveData?.['^TYX']?.price ?? null, thirtyYRaw: s.live30Y ?? null },
    fred: { dgs3mo: s.fredData?.DGS3MO?.value ?? null, dgs2: s.fredData?.DGS2?.value ?? null, dgs5: s.fredData?.DGS5?.value ?? null, dgs10: s.fredData?.DGS10?.value ?? null, dgs30: s.fredData?.DGS30?.value ?? null, t10y2y: s.fredData?.T10Y2Y?.value ?? null },
    snapshot: { irx: s.snapshot?.irx ?? null, fvx: s.snapshot?.fvx ?? null, tnx: s.snapshot?.tnx ?? null, tyx: s.snapshot?.tyx ?? null, t10y2y: s.snapshot?.t10y2y ?? null }
  });
  for (const field of CURVE_FIELDS) {
    if (extracted[field] !== fixture.legacyOutput[field]) {
      fail(`MACRO_CURVE_PARITY_MISMATCH:${fixture.name}.${field} extracted=${JSON.stringify(extracted[field])} golden=${JSON.stringify(fixture.legacyOutput[field])}`);
    }
  }
}

// ── REAL parity: deriveConcentrationRisk vs golden legacy dump (calcPortfolioTechnicalRisk,
// concentration slice only — sellPressure isolated to 0 via empty-ohlcv riskItems in the dump) ──
const portfolioGoldenPath = path.join(root, 'architecture/fixtures/portfolio-concentration-golden.json');
const portfolioGolden = JSON.parse(readFileSync(portfolioGoldenPath, 'utf8'));
if (!Array.isArray(portfolioGolden.fixtures) || portfolioGolden.fixtures.length < 5) fail('portfolio-concentration golden fixture missing or too small — re-run scripts/dump-portfolio-concentration-fixtures.mjs');
for (const fixture of portfolioGolden.fixtures) {
  const { positions, context } = fixture.inputs;
  const extracted = deriveConcentrationRisk({ positions, totalValue: context?.totalValue ?? null });
  const goldenTopWeight = fixture.legacyOutput.topWeightPct ?? 0;
  if (Math.abs((extracted.topWeightPct || 0) - goldenTopWeight) > 1e-9) {
    fail(`PORTFOLIO_CONCENTRATION_PARITY_MISMATCH:${fixture.name}.topWeightPct extracted=${extracted.topWeightPct} golden=${goldenTopWeight}`);
  }
  const goldenItems = fixture.legacyOutput.items || [];
  if (extracted.items.length !== goldenItems.length) {
    fail(`PORTFOLIO_CONCENTRATION_PARITY_MISMATCH:${fixture.name}.items.length extracted=${extracted.items.length} golden=${goldenItems.length}`);
  }
  for (let i = 0; i < goldenItems.length; i++) {
    if (Math.abs(extracted.items[i].weightPct - goldenItems[i].weightPct) > 1e-9) {
      fail(`PORTFOLIO_CONCENTRATION_PARITY_MISMATCH:${fixture.name}.items[${i}].weightPct extracted=${extracted.items[i].weightPct} golden=${goldenItems[i].weightPct}`);
    }
    // sellPressure is isolated to score:0 in the dump (empty-ohlcv riskItems), so the legacy
    // item's own .score IS exactly its concentrationPenalty for every fixture here.
    if (extracted.items[i].concentrationPenalty !== goldenItems[i].score) {
      fail(`PORTFOLIO_CONCENTRATION_PARITY_MISMATCH:${fixture.name}.items[${i}].concentrationPenalty extracted=${extracted.items[i].concentrationPenalty} golden(item.score)=${goldenItems[i].score}`);
    }
  }
}

// ── REAL parity: computeFactorRanks vs golden legacy dump (_aioComputeFactorRanks) ───────────────
// 6 fixtures: 5 synthetic (multi-sector/blend-fallback/size-inactive/value-quality-inactive/NaN-
// mixed) + 1 real currently-loaded SCREENER_DB snapshot (873 rows) — the latter hits legacy's
// items.length<5 early-return (this offline test harness blocks the network enrichment fetch that
// populates ret1m/ret3m on the real seed data), so it only asserts the fail-closed shape, not row
// computation; the 5 synthetic fixtures carry the real per-row/per-global parity coverage.
const factorRanksGoldenPath = path.join(root, 'architecture/fixtures/factor-ranks-golden.json');
const factorRanksGolden = JSON.parse(readFileSync(factorRanksGoldenPath, 'utf8'));
if (!Array.isArray(factorRanksGolden.fixtures) || factorRanksGolden.fixtures.length < 5) fail('factor-ranks golden fixture missing or too small — re-run scripts/dump-factor-ranks-fixtures.mjs');
for (const fixture of factorRanksGolden.fixtures) {
  const { rows, serverScreener } = fixture.inputs;
  const extracted = computeFactorRanks({
    rows,
    // every fixture ran with window.AIO.marketState unset -> legacy _aioFactorWeights(null) still
    // resolves the real NEUTRAL constant (not this module's own "_aioFactorWeights is unavailable"
    // fallback, which is a DIFFERENT, deliberately-not-invoked-here literal) -> use the dumped
    // activeFactorWeights, exactly what the real wrapper would pass through after calling legacy
    // _aioFactorWeights() itself.
    weights: fixture.legacyOutput.activeFactorWeights,
    regimeLabel: '중립 → 균형 가중',
    fundamentalCoveragePct: Number(serverScreener?.fundamentalCoveragePct || 0),
    fmpOk: !!serverScreener?.fmpOk,
    now: Date.parse(factorRanksGolden.generatedAt)
  });
  if (fixture.legacyOutput.summary === null) {
    if (extracted.available !== false) fail(`FACTOR_RANKS_PARITY_MISMATCH:${fixture.name} legacy returned null (insufficient items) but extracted.available=${extracted.available}`);
    continue;
  }
  if (extracted.ranked !== fixture.legacyOutput.summary.ranked) fail(`FACTOR_RANKS_PARITY_MISMATCH:${fixture.name}.ranked extracted=${extracted.ranked} golden=${fixture.legacyOutput.summary.ranked}`);
  const extractedFactors = [...extracted.activeFactors].sort();
  const goldenFactors = [...(fixture.legacyOutput.activeFactors || [])].sort();
  if (JSON.stringify(extractedFactors) !== JSON.stringify(goldenFactors)) fail(`FACTOR_RANKS_PARITY_MISMATCH:${fixture.name}.activeFactors extracted=${JSON.stringify(extractedFactors)} golden=${JSON.stringify(goldenFactors)}`);
  for (const key of ['size', 'value', 'quality']) {
    if (extracted.inactiveFactorReasons[key] !== (fixture.legacyOutput.inactiveFactorReasons || {})[key]) {
      fail(`FACTOR_RANKS_PARITY_MISMATCH:${fixture.name}.inactiveFactorReasons.${key} extracted=${JSON.stringify(extracted.inactiveFactorReasons[key])} golden=${JSON.stringify((fixture.legacyOutput.inactiveFactorReasons || {})[key])}`);
    }
  }
  const goldenRowsBySym = new Map((fixture.legacyOutput.rows || []).map((row) => [row.sym, row]));
  if (extracted.rows.length !== goldenRowsBySym.size) fail(`FACTOR_RANKS_PARITY_MISMATCH:${fixture.name}.rows.length extracted=${extracted.rows.length} golden=${goldenRowsBySym.size}`);
  for (const row of extracted.rows) {
    const goldenRow = goldenRowsBySym.get(row.sym);
    if (!goldenRow) fail(`FACTOR_RANKS_PARITY_MISMATCH:${fixture.name} extracted row sym=${row.sym} missing from golden`);
    if (row.rank !== goldenRow.rank || row.quantSignal !== goldenRow.quantSignal) {
      fail(`FACTOR_RANKS_PARITY_MISMATCH:${fixture.name}.rows[sym=${row.sym}] rank/quantSignal extracted=${row.rank}/${row.quantSignal} golden=${goldenRow.rank}/${goldenRow.quantSignal}`);
    }
    if (Math.abs(row._compositeZ - goldenRow._compositeZ) > 1e-9) {
      fail(`FACTOR_RANKS_PARITY_MISMATCH:${fixture.name}.rows[sym=${row.sym}]._compositeZ extracted=${row._compositeZ} golden=${goldenRow._compositeZ}`);
    }
    for (const key of extracted.activeFactors) {
      if (row.factorScores[key] !== goldenRow.factorScores[key]) {
        fail(`FACTOR_RANKS_PARITY_MISMATCH:${fixture.name}.rows[sym=${row.sym}].factorScores.${key} extracted=${row.factorScores[key]} golden=${goldenRow.factorScores[key]}`);
      }
      if (Math.abs((row['_z_' + key] || 0) - (goldenRow['_z_' + key] || 0)) > 1e-9) {
        fail(`FACTOR_RANKS_PARITY_MISMATCH:${fixture.name}.rows[sym=${row.sym}]._z_${key} extracted=${row['_z_' + key]} golden=${goldenRow['_z_' + key]}`);
      }
    }
  }
}

console.log(JSON.stringify({ ok: true, inputVersion, models: { signal: signal.modelVersion }, tradingScoreParity: { fixtures: golden.fixtures.length, modelVersion: computeTradingScoreModel({}).modelVersion }, rrgParity: { fixtures: rrgGolden.fixtures.length }, stageParity: { fixtures: stageGolden.fixtures.length }, newsScoringParity: { fixtures: newsGolden.fixtures.length }, macroCurveParity: { fixtures: macroCurveGolden.fixtures.length }, portfolioConcentrationParity: { fixtures: portfolioGolden.fixtures.length }, factorRanksParity: { fixtures: factorRanksGolden.fixtures.length } }));
