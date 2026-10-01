import { isValidMarketDate } from './session-time.js';

// P1357: informational cards may show a dated delayed market observation without
// granting it score-close or trade-decision eligibility.
export function selectReferenceObservation(candidates, { nowMs = Date.now(), maxAgeMs = 4 * 86400000 } = {}) {
  const eligible = (Array.isArray(candidates) ? candidates : [candidates]).filter((row) => {
    if (!row || !['number', 'string'].includes(typeof row.value) || !String(row.value).trim()) return false;
    const value = Number(row.value);
    if (!Number.isFinite(value) || value <= 0 || !row.source || !row.observedAt) return false;
    const time = Date.parse(row.observedAt);
    if (!Number.isFinite(time) || time > nowMs || nowMs - time > maxAgeMs) return false;
    if (/^\d{4}-\d{2}-\d{2}/.test(row.observedAt) && !isValidMarketDate(row.observedAt.slice(0, 10))) return false;
    if (['BLOCKED', 'UNAVAILABLE', 'INVALID', 'MISSING'].includes(String(row.quality || '').toUpperCase())) return false;
    if (['none', 'blocked', 'unavailable'].includes(String(row.allowedUse || '').toLowerCase())) return false;
    return ['DELAYED_IN_SESSION', 'REGULAR', 'IN_SESSION', 'MARKET_CLOSED', 'CLOSED_CURRENT', 'COMPLETED', 'CLOSED', 'PRE', 'POST', 'PRE_MARKET', 'POST_MARKET'].includes(row.session || row.marketState);
  }).sort((a, b) => Date.parse(b.observedAt) - Date.parse(a.observedAt));
  const row = eligible[0];
  const sessionLabel = { DELAYED_IN_SESSION: '장중 지연 관측', REGULAR: '정규장 관측', IN_SESSION: '장중 관측', MARKET_CLOSED: '마감 관측', CLOSED_CURRENT: '마감 관측', COMPLETED: '마감 관측', CLOSED: '마감 관측', PRE: '장전 관측', POST: '장후 관측', PRE_MARKET: '장전 관측', POST_MARKET: '장후 관측' };
  const observedLabel = row ? new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(row.observedAt)) : '';
  return row ? Object.freeze({ ...row, value: Number(row.value), status: 'reference_observation', allowedUse: 'reference', decisionEligible: false, asOf: row.observedAt,
    basisLabel: `${observedLabel} KST · ${sessionLabel[row.session || row.marketState]} · 참고용` }) : null;
}
