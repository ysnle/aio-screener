import { latestCompletedUsSession } from '../../ai/time/market-session.js';

// P1358: consume durable derived evidence; do not fabricate price histories.
export function selectProducedRotation(artifact, symbol, nowMs = Date.now()) {
  const basis = latestCompletedUsSession(Number(nowMs) - 5 * 60000);
  const row = artifact?.items?.[symbol];
  if (artifact?.schemaVersion !== 'rotation-history.v1' || artifact.modelVersion !== 'rrg.v2'
    || artifact.benchmark !== 'SPY' || artifact.timeframe !== '1d' || artifact.priceBasis !== 'adjusted-close'
    || artifact.decisionUse !== false || artifact.allowedUseCeiling !== 'reference'
    || !basis || artifact.latestCompletedSession !== basis.date || row?.status !== 'CURRENT' || row.sessionDate !== basis.date) return null;
  const finite = (value) => typeof value === 'number' && Number.isFinite(value);
  if (![row.rsRatio, row.rsMomentum, row.dailyPct, row.weeklyPct].every(finite)
    || row.rsRatio <= 0 || row.rsMomentum <= 0 || row.alignedSessionCount < 30
    || Date.parse(row.observedAt) !== basis.closeMs || !Number.isFinite(Date.parse(row.fetchedAt)) || Date.parse(row.fetchedAt) > Number(nowMs)) return null;
  const quadrant = row.rsRatio >= 100 ? row.rsMomentum >= 100 ? 'Leading' : 'Weakening' : row.rsMomentum >= 100 ? 'Improving' : 'Lagging';
  if (row.quadrant !== quadrant) return null;
  return Object.freeze({ ...row, source: 'Yahoo daily adjusted-close · SPY aligned research reference', sourceKind: artifact.sourceKind,
    revision: `${artifact.modelVersion}:${row.sessionDate}`, changeBasis: row.performanceBasis, allowedUse: 'reference', decisionEligible: false });
}
