import { readFileSync, writeFileSync } from 'node:fs';
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
// P1388: an intentional model change (trading-score.v4) re-baselines the scenarios through the same
// input resolver. The legacy wrapper now reads close-basis runtime evidence, so the Chromium dump
// can no longer inject scenario inputs; AIO_REGEN_TRADING_GOLDEN=1 rewrites expected outputs only.
if (process.env.AIO_REGEN_TRADING_GOLDEN === '1') {
  for (const fixture of golden.fixtures) {
    const out = computeTradingScoreModel({ ...resolveTradingScoreInputs(fixture.inputs), mode: fixture.mode });
    fixture.legacyOutput = Object.fromEntries([...SCORE_FIELDS, 'componentMissing'].map((field) => [field, out[field]]));
  }
  golden.rebaselinedAt = new Date().toISOString();
  golden.rebaselineReason = 'P1388 trading-score.v4: risk-appetite axis = put/call + HY; F&G removed from the composite';
  writeFileSync(goldenPath, `${JSON.stringify(golden, null, 2)}\n`);
}
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

// ── P1268: intentional news evidence boundary vs legacy headline-only golden dump ──────────
const newsGoldenPath = path.join(root, 'architecture/fixtures/news-scoring-golden.json');
const newsGolden = JSON.parse(readFileSync(newsGoldenPath, 'utf8'));
if (!Array.isArray(newsGolden.fixtures) || newsGolden.fixtures.length < 5) fail('news-scoring golden fixture missing or too small — re-run scripts/dump-news-scoring-fixtures.mjs');
for (const fixture of newsGolden.fixtures) {
  const extractedSentiment = computeNewsSentimentScore({ items: fixture.items, now: fixture.now });
  const extractedRisk = computeNewsRiskSignals({ items: fixture.items, now: fixture.now });
  // The historical legacy fixtures contain title/empty-desc rows only. The
  // old output is kept as evidence of the unsafe parity that was retired.
  if (fixture.items.some((item) => String(item?.summary || item?.desc || '').trim().length >= 40)) fail(`NEWS_GOLDEN_FIXTURE_UNEXPECTED_ARTICLE:${fixture.name}`);
  if (extractedSentiment.score !== 50 || extractedSentiment.total !== 0 || extractedRisk.length !== 0) {
    fail(`NEWS_HEADLINE_BOUNDARY_MISMATCH:${fixture.name} sentiment=${JSON.stringify(extractedSentiment)} risk=${JSON.stringify(extractedRisk)}`);
  }
}

// ── Legacy field-projection parity; spread semantics now use the explicit v2 cut contract ──
const macroCurveGoldenPath = path.join(root, 'architecture/fixtures/macro-curve-golden.json');
const macroCurveGolden = JSON.parse(readFileSync(macroCurveGoldenPath, 'utf8'));
if (!Array.isArray(macroCurveGolden.fixtures) || macroCurveGolden.fixtures.length < 5) fail('macro-curve golden fixture missing or too small — re-run scripts/dump-macro-curve-fixtures.mjs');
const CURVE_FIELDS = ['threeM', 'twoY', 'fiveY', 'tenY', 'thirtyY', 'complete'];
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
  const officialCurve = deriveTreasuryCurveEvidence({ treasury: { observedAt: '2026-09-24', source: 'U.S. Treasury', values: { dgs2: 4.85, dgs10: 5.11, t10y2y: 0.26 } } });
  const atomicPrecedenceCurve = deriveTreasuryCurveEvidence({
    treasury: {
      observedAt: '2026-09-24',
      source: 'U.S. Treasury',
      values: { dgs2: 4.85, dgs10: 5.11, t10y2y: 0.26 }
    },
    live: { tnx: 5.2 }
  });
  if (officialCurve.spread2s10s !== 0.26 || officialCurve.curve.mode !== 'official-same-date' || officialCurve.curve.unit !== 'percentage-point') fail(`MACRO_CURVE_V2_SAME_CUT:${JSON.stringify(officialCurve)}`);
  if (atomicPrecedenceCurve.spread2s10s !== 0.26 || atomicPrecedenceCurve.curve.curveCutId !== 'us-treasury-daily:2026-09-24') fail(`MACRO_CURVE_V2_ATOMIC_PRIORITY:${JSON.stringify(atomicPrecedenceCurve)}`);
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

// P1534 (owner decision, agent-recommended): one set of Fear & Greed and VIX band edges. src/domain/rules/thresholds.js owns the
// numbers; the legacy shell cannot import ESM at parse time, so its closures keep inline copies that this block pins to the
// src result over the whole scale. F&G edges are CNN's published integer bands (0-24, 25-44, 45-55, 56-75, 76-100); VIX
// 18 / 25 / 32 is the band set the regime alert already used (P1367). Alerts compare band indexes, so the copies must agree.
{
  const { RULES } = await import('../src/domain/rules/thresholds.js');
  const { fearGreedBand } = await import('../src/domain/sentiment/metrics.js');
  const { vixBand } = await import('../src/domain/sentiment/narrative.js');
  const board = await import('../src/ui/components/sentiment-board.js');
  const core = readFileSync(path.join(root, 'js/aio-core.js'), 'utf8');
  const pick = (name) => [...core.matchAll(new RegExp(`(?:function ${name}\\(v\\)\\s*\\{[^\\n]*\\}|var ${name} = function\\(v\\)\\{[^\\n]*\\};)`, 'g'))].map((match) => match[0]);
  const build = (name, text) => new Function(`${text}\nreturn ${name};`)();
  const fgLabels = ['극단 공포', '공포', '중립', '탐욕', '극단 탐욕'];
  const vixLabels = ['저변동 구간', '통상 범위', '변동성 경계 구간', '고변동 구간'];
  const legacyFg = pick('_fgZone'), legacyVix = pick('_vixBand');
  if (legacyFg.length !== 2 || legacyVix.length !== 2) fail(`P1534 expected two legacy copies each of _fgZone/_vixBand in js/aio-core.js, found ${legacyFg.length}/${legacyVix.length}`);
  if (RULES.volatility.highAt !== 32 || RULES.volatility.calmBelow !== 18 || RULES.volatility.stressAt !== 25) fail('P1534 RULES.volatility must carry the 18 / 25 / 32 band edges');
  const mismatches = [];
  for (let tenth = 0; tenth <= 1000; tenth += 1) {
    const value = tenth / 10;
    const band = fearGreedBand(value);
    const index = fgLabels.indexOf(band.label);
    for (const [copy, text] of legacyFg.entries()) if (build('_fgZone', text)(value) !== index) mismatches.push(`_fgZone#${copy + 1}(${value})`);
    const boardBand = board.fearGreedBand(value);
    if (!boardBand || boardBand.label !== band.label) mismatches.push(`sentiment-board(${value})`);
  }
  for (let tenth = 50; tenth <= 800; tenth += 1) {
    const value = tenth / 10;
    const index = vixLabels.indexOf(vixBand(value).label);
    for (const [copy, text] of legacyVix.entries()) if (build('_vixBand', text)(value) !== index) mismatches.push(`_vixBand#${copy + 1}(${value})`);
  }
  if (mismatches.length) fail(`P1534 band edges drifted between src and the legacy copies (${mismatches.length}): ${mismatches.slice(0, 8).join(', ')}`);
  for (const [value, label] of [[24, '극단 공포'], [25, '공포'], [44, '공포'], [45, '중립'], [55, '중립'], [56, '탐욕'], [75, '탐욕'], [76, '극단 탐욕'], [55.4, '중립'], [55.6, '탐욕']]) {
    if (fearGreedBand(value).label !== label) fail(`P1534 Fear & Greed ${value} must read ${label} (CNN integer bands), got ${fearGreedBand(value).label}`);
  }
  for (const [value, label] of [[17.9, '저변동 구간'], [18, '통상 범위'], [24.9, '통상 범위'], [25, '변동성 경계 구간'], [31.9, '변동성 경계 구간'], [32, '고변동 구간']]) {
    if (vixBand(value).label !== label) fail(`P1534 VIX ${value} must read ${label}, got ${vixBand(value).label}`);
  }
  // The alert's own severity must not move: the same VIX/F&G pairs keep their band distance.
  const vixIndex = (value) => vixLabels.indexOf(vixBand(value).label);
  if (Math.abs(vixIndex(32) - vixIndex(24)) !== 2) fail('P1534 VIX 24 -> 32 must still span two bands (severe regime drift)');
  // A copy of the label ladder with a non-CNN edge must not come back anywhere in product code.
  const copies = [];
  for (const file of ['js/aio-pages.js', 'js/aio-chat.js', 'js/aio-data.js', 'js/aio-ui.js', 'js/aio-core.js', 'src/ui/pages/analysis.js', 'src/ui/components/sentiment-board.js']) {
    readFileSync(path.join(root, file), 'utf8').split('\n').forEach((line, index) => {
      if (/<=\s*25\s*\?\s*'극단/.test(line) || /<=\s*45\s*\?\s*'공포'/.test(line) || /<\s*55\s*\?\s*(?:2|'중립')/.test(line) || /<\s*75\s*\?\s*(?:3|'탐욕')/.test(line) || /\bvix\s*<\s*(?:15|20|30)\s*\?/.test(line)) copies.push(`${file}:${index + 1}`);
    });
  }
  if (copies.length) fail(`P1534 Fear & Greed label ladder with a non-CNN edge (${copies.length}): ${copies.slice(0, 8).join(', ')}`);
  const rules = [...core.matchAll(/fgMax:\s*(\d+)/g)].map((match) => Number(match[1]));
  const expectedMax = [RULES.fearGreed.extremeFearBelow, RULES.fearGreed.fearBelow, RULES.fearGreed.greedAbove + 1, RULES.fearGreed.extremeGreedAbove + 1, 101];
  if (JSON.stringify(rules) !== JSON.stringify(expectedMax)) fail(`P1534 AIO_ACTION_RULES.sentimentAction edges ${JSON.stringify(rules)} must match RULES.fearGreed ${JSON.stringify(expectedMax)}`);
}

console.log(JSON.stringify({ ok: true, inputVersion, models: { signal: signal.modelVersion }, tradingScoreParity: { fixtures: golden.fixtures.length, modelVersion: computeTradingScoreModel({}).modelVersion }, rrgParity: { fixtures: rrgGolden.fixtures.length }, stageParity: { fixtures: stageGolden.fixtures.length }, newsHeadlineBoundary: { fixtures: newsGolden.fixtures.length, legacyParityIntentionallyRetired: true }, macroCurveParity: { fixtures: macroCurveGolden.fixtures.length }, portfolioConcentrationParity: { fixtures: portfolioGolden.fixtures.length }, factorRanksParity: { fixtures: factorRanksGolden.fixtures.length } }));
