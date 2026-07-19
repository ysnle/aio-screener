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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fail = (message) => { throw new Error(`[domain-parity] ${message}`); };

// RM-03: trading-score has REAL parity below (extracted model vs a golden dump of the
// unmodified legacy js/aio-core.js:computeTradingScore, captured by
// scripts/dump-trading-score-fixtures.mjs before extraction). The other domains below remain
// smoke-only (F-04): the "live"/"backtest" objects call the same function twice with the same
// fixture, which can only catch an import/crash regression, not a real live/backtest divergence.
// Extracting each one for real parity is RM-03 item 2 (F&G synthesis, RRG, Weinstein/MTF), not
// done in this batch — do not read a PASS here as those models having real parity.
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

console.log(JSON.stringify({ ok: true, inputVersion, models: Object.fromEntries(Object.entries(live).map(([key, value]) => [key, value.modelVersion])), tradingScoreParity: { fixtures: golden.fixtures.length, modelVersion: computeTradingScoreModel({}).modelVersion } }));
