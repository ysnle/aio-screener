// The holding technical engine and the portfolio return statistics under the names the classic shell calls
// (js/aio-workspace.js refreshPortfolioRisk / refreshPortfolioTechnicalRisk, js/aio-tests.js). Only
// 포트폴리오 reads them, so they load on demand through window._aioLoadTechnicalEngine
// (src/app/compatibility-globals.js) instead of riding every route's post-boot budget.
import * as returnStats from '../domain/portfolio/return-stats.js';
import { technicalSnapshot, extensionHeat } from '../domain/technical/snapshot.js';
import { sellPressure, positionTechnicalRisk, portfolioTechnicalRisk } from '../domain/portfolio/technical-risk.js';

const STAT_NAMES = ['_statMean', '_statStdDev', '_calcDailyReturns', '_quantileR7', '_calcPortfolioVaR', '_calcSharpe', '_calcMaxDrawdown', '_pearsonCorr', '_calcCorrelationMatrix'];

export function installTechnicalEngine(root) {
  for (const name of STAT_NAMES) root[name] = returnStats[name];
  Object.assign(root, {
    calcTechnicalSnapshot: technicalSnapshot,
    calcExtensionHeat: extensionHeat,
    calcSellPressure: sellPressure,
    calcPositionTechnicalRisk: positionTechnicalRisk,
    calcPortfolioTechnicalRisk: portfolioTechnicalRisk
  });
  return root;
}
