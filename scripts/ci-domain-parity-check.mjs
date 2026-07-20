import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deriveMarketModel } from '../src/domain/market/model.js';
import { deriveMacroModel } from '../src/domain/macro/model.js';
import { derivePortfolioRisk } from '../src/domain/portfolio/risk.js';
import { deriveScreenerRanking } from '../src/domain/screener/ranking.js';
import { deriveNewsClaim } from '../src/domain/news/claims.js';
import { deriveTechnicalModel } from '../src/domain/technical/indicators.js';
import { deriveSignalDecision } from '../src/domain/signal/decision.js';
import { computeTradingScoreModel } from '../src/domain/signal/trading-score.js';
import { computeRelativeRotation } from '../src/domain/themes/rrg.js';
import { classifyMovingAverageStructure, deriveMultiTimeframeView } from '../src/domain/technical/stage.js';
import { computeNewsSentimentScore, computeNewsRiskSignals } from '../src/domain/news/scoring.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message) => { throw new Error(`[domain-parity] ${message}`); };

// RM-03: trading-score, RRG, Weinstein/MTF, and news scoring/risk-signals have REAL parity below
// (extracted models vs golden dumps of the unmodified legacy functions, captured by
// scripts/dump-trading-score-fixtures.mjs / dump-rrg-fixtures.mjs / dump-weinstein-mtf-
// fixtures.mjs / dump-news-scoring-fixtures.mjs before each extraction). `deriveNewsClaim`
// (single-article claim shape, src/domain/news/claims.js) is a DIFFERENT, still smoke-only model
// from the news scoring/risk-signal aggregate functions above — don't conflate the two "news"
// entries. The other domains below (market/macro/portfolio/screener/technical/signal) remain
// smoke-only (F-04): the "live"/"backtest" objects call the same function twice with the same
// fixture, which can only catch an import/crash regression, not a real live/backtest divergence.
// RM-03 item 2 measured that F&G has no local synthesis to extract (the score is fetched
// pre-computed from CNN, never derived from sub-indicators in this codebase — see
// _context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md F-12) and that signal/decision.js's
// toy model has zero live consumers beyond `.status` (proper replacement is ARX-11's scope, not a
// small patch — see the same handoff, RM-03 item 3 note). Do not read this PASS as the remaining
// smoke-only domains having real parity.
const inputVersion = 'fixture-input.v1';
const live = {
  market: deriveMarketModel({ quotes: { SPY: { value: 500, pct: 1 } }, inputVersion }),
  macro: deriveMacroModel({ metrics: { twoYear: 4.2, tenYear: 4.4 }, inputVersion }),
  portfolio: derivePortfolioRisk({ holdings: [{ value: 600 }, { value: 400 }], inputVersion }),
  screener: deriveScreenerRanking({ rows: [{ symbol: 'AAA', score: 90 }, { symbol: 'BBB', score: 70 }], inputVersion }),
  news: deriveNewsClaim({ title: 'Fixture headline', source: 'fixture', url: 'https://example.com', inputVersion }),
  technical: deriveTechnicalModel({ symbol: 'SPY', ohlcv: Array.from({ length: 50 }, (_, index) => ({ close: 450 + index })), inputVersion })
};
const backtest = {
  market: deriveMarketModel({ quotes: { SPY: { value: 500, pct: 1 } }, inputVersion }),
  macro: deriveMacroModel({ metrics: { twoYear: 4.2, tenYear: 4.4 }, inputVersion }),
  portfolio: derivePortfolioRisk({ holdings: [{ value: 600 }, { value: 400 }], inputVersion }),
  screener: deriveScreenerRanking({ rows: [{ symbol: 'AAA', score: 90 }, { symbol: 'BBB', score: 70 }], inputVersion }),
  news: deriveNewsClaim({ title: 'Fixture headline', source: 'fixture', url: 'https://example.com', inputVersion }),
  technical: deriveTechnicalModel({ symbol: 'SPY', ohlcv: Array.from({ length: 50 }, (_, index) => ({ close: 450 + index })), inputVersion })
};
for (const key of Object.keys(live)) {
  if (live[key].modelVersion !== backtest[key].modelVersion || live[key].inputVersion !== backtest[key].inputVersion) fail(`PARITY_VERSION_MISMATCH:${key}`);
}
const signal = deriveSignalDecision({ technical: live.technical.indicators, sentiment: { fearGreed: 40 }, market: { breadthAdvanceRatio: 1.1 }, inputVersion });
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

console.log(JSON.stringify({ ok: true, inputVersion, models: Object.fromEntries(Object.entries(live).map(([key, value]) => [key, value.modelVersion])), tradingScoreParity: { fixtures: golden.fixtures.length, modelVersion: computeTradingScoreModel({}).modelVersion }, rrgParity: { fixtures: rrgGolden.fixtures.length }, stageParity: { fixtures: stageGolden.fixtures.length }, newsScoringParity: { fixtures: newsGolden.fixtures.length } }));
