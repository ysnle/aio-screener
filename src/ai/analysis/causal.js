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
  const timed = (Array.isArray(crossAssets) ? crossAssets : []).filter((row) => {
    const rowAt = time(row?.observedAt || row?.asOf);
    return rowAt != null && targetAt != null && row?.source && row?.evidenceId && usableSourceKind(row?.sourceKind) && Math.abs(rowAt - targetAt) <= requestedWindow * 60000;
  });
  // v57.93 (internal audit A05): a cross-asset move supports the cause only when it went the way that cause predicts
  // (row.direction === row.expectedDirection); a move the other way contradicts it, and a row without both is only
  // co-timed. A competing event in the window is another candidate cause, not support, so it keeps the reading partial.
  const directed = timed.filter((row) => row.direction && row.expectedDirection);
  const corroboration = directed.filter((row) => String(row.direction).toUpperCase() === String(row.expectedDirection).toUpperCase());
  const contradiction = directed.filter((row) => String(row.direction).toUpperCase() !== String(row.expectedDirection).toUpperCase());
  const status = aligned.length > 0 && corroboration.length > 0 && contradiction.length === 0 && alternatives.length === 0 ? 'supported' : aligned.length > 0 ? 'partial' : 'insufficient';
  return Object.freeze({
    schemaVersion: AI_CAUSAL_ENGINE_VERSION,
    status,
    target: frozenProjection({ metricId: target.metricId || null, direction: target.direction || null, observedAt: target.observedAt || target.asOf || null }),
    primary: primaryEvent ? frozenProjection({ id: primaryEvent.eventId || null, title: primaryEvent.title || null, source: primaryEvent.source, sourceKind: primaryEvent.sourceKind, evidenceId: primaryEvent.evidenceId, eventTime: primaryEvent.publishedAt || primaryEvent.eventTime || primaryEvent.asOf }) : null,
    alignedEventCount: aligned.length,
    alternativeCount: alternatives.length,
    corroboratingCrossAssetCount: corroboration.length,
    contradictingCrossAssetCount: contradiction.length,
    conclusion: status === 'supported' ? '시간이 맞는 이벤트가 있고, 교차자산이 그 원인이 예측하는 방향으로 움직여 원인 후보로 제시할 수 있습니다.'
      : status === 'partial' ? (contradiction.length ? '시간이 맞는 원인 후보는 있으나 반대 방향으로 움직인 교차자산이 있어 원인으로 단정하지 않습니다.'
        : alternatives.length ? '같은 시간대에 다른 원인 후보도 있어 하나를 원인으로 단정하지 않습니다.'
        : '시간이 맞는 원인 후보는 있으나 같은 방향의 교차자산 확인이 없어 원인으로 단정하지 않습니다.')
      : '시간 정렬·출처가 충분한 원인 근거가 없어 원인을 단정하지 않습니다.'
  });
}
