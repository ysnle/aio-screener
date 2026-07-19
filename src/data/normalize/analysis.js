import { deriveTechnicalModel } from '../../domain/technical/indicators.js';
import { deriveSignalDecision } from '../../domain/signal/decision.js';
import { deriveHomeSummary } from '../../domain/home/summary.js';

export function normalizeAnalysis(raw = {}) {
  const technical = raw.technical?.modelVersion ? raw.technical : deriveTechnicalModel(raw.technical || {});
  const signal = raw.signal?.modelVersion ? raw.signal : deriveSignalDecision({ technical: technical.indicators, sentiment: raw.sentiment, market: raw.market, inputVersion: raw.inputVersion });
  const home = raw.home?.modelVersion ? raw.home : deriveHomeSummary({ sentiment: raw.sentiment, signal, market: raw.market, newsCount: raw.newsCount, inputVersion: raw.inputVersion });
  return Object.freeze({ technical, signal, home, status: [technical, signal, home].some((item) => item?.status !== 'unavailable') ? 'current' : 'unavailable', updatedAt: raw.updatedAt || new Date().toISOString() });
}
