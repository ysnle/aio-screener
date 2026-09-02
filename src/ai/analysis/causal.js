export const AI_CAUSAL_ENGINE_VERSION = 'causal-attribution.v1';

function time(value) { const parsed = value ? new Date(value).getTime() : NaN; return Number.isFinite(parsed) ? parsed : null; }

function usableSourceKind(value) {
  const kind = String(value || '').trim().toUpperCase();
  return Boolean(kind) && !['REFERENCE', 'UNTRUSTED', 'UNKNOWN', 'UNAVAILABLE'].includes(kind);
}

function frozenProjection(value) { return value ? Object.freeze(value) : null; }

export function buildCausalAttribution({ target = {}, events = [], crossAssets = [], windowMinutes = 180 } = {}) {
  const targetAt = time(target.observedAt || target.asOf);
  const requestedWindow = typeof windowMinutes === 'number' && Number.isFinite(windowMinutes) && windowMinutes > 0 ? windowMinutes : 180;
  const candidates = (Array.isArray(events) ? events : []).map((event) => ({ ...event, _time: time(event?.publishedAt || event?.eventTime || event?.asOf) }))
    .filter((event) => event._time != null && targetAt != null && event._time <= targetAt && targetAt - event._time <= requestedWindow * 60000)
    .sort((a, b) => b._time - a._time);
  const aligned = candidates.filter((event) => event.source && event.evidenceId && usableSourceKind(event.sourceKind));
  const primaryEvent = aligned[0] || null;
  const alternatives = candidates.filter((event) => event !== primaryEvent && event.source && event.evidenceId && usableSourceKind(event.sourceKind) && /alternative|대안|other|macro|sector|flow/i.test(String(event.type || event.category || event.title || '')));
  const corroboration = (Array.isArray(crossAssets) ? crossAssets : []).filter((row) => {
    const rowAt = time(row?.observedAt || row?.asOf);
    return rowAt != null && targetAt != null && row?.source && row?.evidenceId && usableSourceKind(row?.sourceKind) && Math.abs(rowAt - targetAt) <= requestedWindow * 60000;
  });
  const status = aligned.length > 0 && (corroboration.length > 0 || alternatives.length > 0) ? 'supported' : aligned.length > 0 ? 'partial' : 'insufficient';
  return Object.freeze({
    schemaVersion: AI_CAUSAL_ENGINE_VERSION,
    status,
    target: frozenProjection({ metricId: target.metricId || null, direction: target.direction || null, observedAt: target.observedAt || target.asOf || null }),
    primary: primaryEvent ? frozenProjection({ id: primaryEvent.eventId || null, title: primaryEvent.title || null, source: primaryEvent.source, sourceKind: primaryEvent.sourceKind, evidenceId: primaryEvent.evidenceId, eventTime: primaryEvent.publishedAt || primaryEvent.eventTime || primaryEvent.asOf }) : null,
    alignedEventCount: aligned.length,
    alternativeCount: alternatives.length,
    corroboratingCrossAssetCount: corroboration.length,
    conclusion: status === 'supported' ? '시간 정렬된 이벤트와 교차자산 신호가 함께 확인되어 원인 후보로 제시할 수 있습니다.' : status === 'partial' ? '시간 정렬된 원인 후보는 있으나 교차자산 확인이 부족해 원인으로 단정하지 않습니다.' : '시간 정렬·출처가 충분한 원인 근거가 없어 원인을 단정하지 않습니다.'
  });
}
