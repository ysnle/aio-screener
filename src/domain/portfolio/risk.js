export const PORTFOLIO_MODEL_VERSION = 'portfolio-risk.v1';

export function derivePortfolioRisk({ holdings = [], totalValue = null, inputVersion = 'unknown' } = {}) {
  const values = (Array.isArray(holdings) ? holdings : []).map((holding) => Number(holding?.value)).filter(Number.isFinite);
  const total = Number.isFinite(Number(totalValue)) ? Number(totalValue) : values.reduce((sum, value) => sum + value, 0);
  const largest = values.length && total > 0 ? Math.max(...values) / total : null;
  return Object.freeze({ modelVersion: PORTFOLIO_MODEL_VERSION, inputVersion, status: values.length ? 'current' : 'unavailable', holdingCount: values.length, concentration: largest, concentrationBand: largest == null ? 'unknown' : largest > 0.4 ? 'high' : largest > 0.2 ? 'medium' : 'low' });
}
