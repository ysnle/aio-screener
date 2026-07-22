import { deriveTechnicalStageFromOhlcv } from '../../domain/technical/stage.js';
import { computeTradingScoreModel, deriveSignalDecisionFromTradingScore } from '../../domain/signal/trading-score.js';
import { deriveHomeSummary } from '../../domain/home/summary.js';

export function normalizeAnalysis(raw = {}) {
  const technical = raw.technical?.modelVersion ? raw.technical : deriveTechnicalStageFromOhlcv(raw.technical || {});
  const tradingScore = raw.tradingScore?.modelVersion === 'trading-score.v1'
    ? raw.tradingScore
    : computeTradingScoreModel(raw.tradingScoreInputs || {});
  const signal = raw.signal?.modelVersion
    ? raw.signal
    : deriveSignalDecisionFromTradingScore({ score: tradingScore, inputVersion: raw.inputVersion });
  const home = raw.home?.modelVersion ? raw.home : deriveHomeSummary({ sentiment: raw.sentiment, signal, market: raw.market, newsCount: raw.newsCount, inputVersion: raw.inputVersion });
  return Object.freeze({ technical, signal, home, status: [technical, signal, home].some((item) => item?.status !== 'unavailable') ? 'current' : 'unavailable', updatedAt: raw.updatedAt || new Date().toISOString() });
}
