import { latestCompletedUsSession } from '../market/session/market-calendar.js';
import { isFiniteNumber as finite } from '../shared/number.js';

export function selectProducedRotation(artifact, symbol, nowMs = Date.now(), { lagSessions = 0 } = {}) {
  const latest = latestCompletedUsSession(Number(nowMs) - 5 * 60000);
  const previous = lagSessions > 0 && latest ? latestCompletedUsSession(latest.closeMs - 1) : null;
  const basis = latest && artifact?.latestCompletedSession !== latest.date && previous?.date === artifact?.latestCompletedSession ? previous : latest;
  const row = artifact?.items?.[symbol];
  if (artifact?.schemaVersion !== 'rotation-history.v1' || artifact.modelVersion !== 'rrg.v3'
    || artifact.benchmark !== 'SPY' || artifact.timeframe !== '1d' || artifact.priceBasis !== 'adjusted-close'
    || artifact.decisionUse !== false || artifact.allowedUseCeiling !== 'reference'
    || !basis || artifact.latestCompletedSession !== basis.date || row?.status !== 'CURRENT' || row.sessionDate !== basis.date) return null;
  if (![row.rsRatio, row.rsMomentum].every(finite) || ![row.dailyPct, row.weeklyPct].every((value) => value === null || finite(value))
    || row.rsRatio <= 0 || row.rsMomentum <= 0 || row.alignedSessionCount < 30
    || Date.parse(row.observedAt) !== basis.closeMs || !Number.isFinite(Date.parse(row.fetchedAt)) || Date.parse(row.fetchedAt) > Number(nowMs)) return null;
  // The rrgQuadrantOf rule of rrg.js, written out: importing rrg.js here splits it into its own boot chunk (about 430 gzip
  // bytes over the boot ceiling). ci-esm-core-unit-check keeps the two equal.
  const quadrant = row.rsRatio >= 100 ? row.rsMomentum >= 100 ? 'Leading' : 'Weakening' : row.rsMomentum >= 100 ? 'Improving' : 'Lagging';
  if (row.quadrant !== quadrant) return null;
  return Object.freeze({ ...row, lagging: basis !== latest, source: 'Yahoo daily adjusted-close, SPY aligned research reference', sourceKind: artifact.sourceKind,
    revision: `${artifact.modelVersion}:${row.sessionDate}`, changeBasis: row.performanceBasis, allowedUse: 'reference', decisionEligible: false });
}

export function currentRotationItems(artifact, nowMs = Date.now()) {
  const out = {};
  for (const symbol of Object.keys(artifact?.items || {})) {
    const row = selectProducedRotation(artifact, symbol, nowMs);
    if (row) out[symbol] = row;
  }
  return out;
}
