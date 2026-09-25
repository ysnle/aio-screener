import { deriveTechnicalStageFromOhlcv } from '../../domain/technical/stage.js';
import { computeTradingScoreModel, deriveSignalDecisionFromTradingScore, deriveTradingScoreDecisionPresentation } from '../../domain/signal/trading-score.js';
import { normalizeSignalScoreMode, describeSignalScoreMode } from '../../domain/signal/mode.js';
import { deriveHomeSummary } from '../../domain/home/summary.js';

export function normalizeAnalysis(raw = {}) {
  const technicalBase = raw.technical?.modelVersion ? raw.technical : deriveTechnicalStageFromOhlcv(raw.technical || {});
  const technical = raw.technical?.health
    ? Object.freeze({ ...technicalBase, health: raw.technical.health })
    : technicalBase;
  const tradingScore = raw.tradingScore?.modelVersion === 'trading-score.v3'
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
  return Object.freeze({ technical, signal, home, status: [technical, signal, home].some((item) => item?.status !== 'unavailable') ? 'current' : 'unavailable', updatedAt: raw.updatedAt || null });
}
