import { deriveTechnicalStageFromOhlcv } from '../../domain/technical/stage.js';
import { computeTradingScoreModel, deriveSignalDecisionFromTradingScore, deriveTradingScoreDecisionPresentation, TRADING_SCORE_MODEL_VERSION } from '../../domain/signal/trading-score.js';
import { normalizeSignalScoreMode, describeSignalScoreMode } from '../../domain/signal/mode.js';
import { deriveHomeSummary } from '../../domain/home/summary.js';

export function normalizeAnalysis(raw = {}) {
  // The retired 0-100 market-health grade no longer rides on the technical slice (no surface read it after P1420).
  const technical = raw.technical?.modelVersion ? raw.technical : deriveTechnicalStageFromOhlcv(raw.technical || {});
  const tradingScore = raw.tradingScore?.modelVersion === TRADING_SCORE_MODEL_VERSION
    ? raw.tradingScore
    : computeTradingScoreModel(raw.tradingScoreInputs || {});
  const signalBase = raw.signal?.modelVersion
    ? raw.signal
    : deriveSignalDecisionFromTradingScore({ score: tradingScore, inputVersion: raw.inputVersion });
  // E2/LC-26: the mode that actually produced this score travels with the signal slice, so the
  // hero and any evidence consumer can prove parity with the declared mode instead of reading a
  // separate (and previously hardcoded) copy.
  const scoreMode = normalizeSignalScoreMode(raw.tradingScoreInputs?.mode);
  const signal = Object.freeze({
    ...signalBase,
    scoreMode,
    scoreModeRevision: describeSignalScoreMode(scoreMode).revision,
    presentation: signalBase.presentation?.modelVersion
      ? signalBase.presentation
      : deriveTradingScoreDecisionPresentation({ score: tradingScore, inputVersion: raw.inputVersion })
  });
  const home = raw.home?.modelVersion ? raw.home : deriveHomeSummary({ sentiment: raw.sentiment, signal, market: raw.market, newsCount: raw.newsCount, inputVersion: raw.inputVersion });
  return Object.freeze({ tradingScore, technical, signal, home, status: [technical, signal, home].some((item) => item?.status !== 'unavailable') ? 'current' : 'unavailable', updatedAt: raw.updatedAt || null });
}
