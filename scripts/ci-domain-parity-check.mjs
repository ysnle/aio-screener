import { deriveMarketModel } from '../src/domain/market/model.js';
import { deriveMacroModel } from '../src/domain/macro/model.js';
import { derivePortfolioRisk } from '../src/domain/portfolio/risk.js';
import { deriveScreenerRanking } from '../src/domain/screener/ranking.js';
import { deriveNewsClaim } from '../src/domain/news/claims.js';
import { deriveTechnicalModel } from '../src/domain/technical/indicators.js';
import { deriveSignalDecision } from '../src/domain/signal/decision.js';

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
  if (live[key].modelVersion !== backtest[key].modelVersion || live[key].inputVersion !== backtest[key].inputVersion) throw new Error(`PARITY_VERSION_MISMATCH:${key}`);
}
const signal = deriveSignalDecision({ technical: live.technical.indicators, sentiment: { fearGreed: 40 }, market: { breadthAdvanceRatio: 1.1 }, inputVersion });
if (signal.status === 'blocked' || !signal.modelVersion) throw new Error('PARITY_SIGNAL_BLOCKED');
console.log(JSON.stringify({ ok: true, inputVersion, models: Object.fromEntries(Object.entries(live).map(([key, value]) => [key, value.modelVersion])) }));
