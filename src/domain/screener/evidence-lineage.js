// Pure evidence-lineage contract for research artifacts.  It does not fetch
// data or grant rights; it makes missing provenance fail closed at the point
// where a producer hands observations to the screener/statistics layer.

export const EVIDENCE_LINEAGE_VERSION = 'evidence-lineage.v2';

const VERIFIED_RIGHTS = Object.freeze(new Set(['OWNED', 'LICENSED', 'VERIFIED']));
const VERIFIED_CALENDARS = Object.freeze(new Set(['EXCHANGE_VERIFIED', 'VERIFIED', 'USER_VERIFIED']));

function clean(value) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
}

function timestampMs(value) {
  if (value == null || value === '') return null;
  if (Number.isFinite(Number(value))) return Number(value);
  const parsed = Date.parse(String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function timestampIso(value) {
  const ms = timestampMs(value);
  return ms == null ? null : new Date(ms).toISOString();
}

export function normalizeEvidenceLineage(input = {}) {
  const observedAtMs = timestampMs(input.observedAt);
  const fetchedAtMs = timestampMs(input.fetchedAt);
  const availableAtMs = timestampMs(input.availableAt);
  return Object.freeze({
    version: EVIDENCE_LINEAGE_VERSION,
    sourceId: clean(input.sourceId || input.source || '') || null,
    sourceKind: clean(input.sourceKind || 'UNKNOWN').toUpperCase(),
    rightsId: clean(input.rightsId || '') || null,
    rightsStatus: clean(input.rightsStatus || input.dataRights || 'UNKNOWN').toUpperCase(),
    observedAt: timestampIso(input.observedAt),
    observedAtMs,
    fetchedAt: timestampIso(input.fetchedAt),
    fetchedAtMs,
    availableAt: timestampIso(input.availableAt),
    availableAtMs,
    revisionId: clean(input.revisionId || input.revision || '') || null,
    watermark: clean(input.watermark || '') || null,
    timezone: clean(input.timezone || '') || null,
    calendarId: clean(input.calendarId || '') || null,
    calendarStatus: clean(input.calendarStatus || input.sessionCalendarStatus || 'UNKNOWN').toUpperCase(),
    provisional: input.provisional === true
  });
}

export function classifyEvidenceLineage(input = {}, { now = Date.now(), requireRights = true, requireCalendar = true } = {}) {
  const lineage = input?.version === EVIDENCE_LINEAGE_VERSION
    ? input
    : normalizeEvidenceLineage(input);
  const nowMs = timestampMs(now) ?? Date.now();
  const reasons = [];
  if (!lineage.sourceId) reasons.push('missing_source');
  if (lineage.observedAtMs == null) reasons.push('missing_observed_at');
  if (lineage.observedAtMs != null && lineage.observedAtMs > nowMs) reasons.push('future_observed_at');
  if (lineage.fetchedAtMs == null) reasons.push('missing_fetched_at');
  if (lineage.availableAtMs == null) reasons.push('missing_available_at');
  if (lineage.fetchedAtMs != null && lineage.fetchedAtMs > nowMs) reasons.push('future_fetched_at');
  if (lineage.availableAtMs != null && lineage.availableAtMs > nowMs) reasons.push('future_available_at');
  if (lineage.availableAtMs != null && lineage.observedAtMs != null && lineage.availableAtMs < lineage.observedAtMs) reasons.push('available_before_observed');
  if (!lineage.revisionId) reasons.push('missing_revision');
  if (!lineage.watermark) reasons.push('missing_watermark');
  if (!lineage.timezone) reasons.push('missing_timezone');
  if (!lineage.rightsId) reasons.push('missing_rights_id');
  if (requireRights && !VERIFIED_RIGHTS.has(lineage.rightsStatus)) reasons.push(`rights_${lineage.rightsStatus.toLowerCase()}`);
  if (!lineage.calendarId) reasons.push('missing_calendar');
  if (requireCalendar && !VERIFIED_CALENDARS.has(lineage.calendarStatus)) reasons.push(`calendar_${lineage.calendarStatus.toLowerCase()}`);
  if (lineage.provisional) reasons.push('provisional_observation');
  const status = reasons.length ? 'BLOCKED' : 'CURRENT_CANDIDATE';
  return Object.freeze({
    version: EVIDENCE_LINEAGE_VERSION,
    status,
    reasons: Object.freeze(reasons),
    lineage
  });
}

export function summarizeEvidenceLineage(results = []) {
  const rows = Array.isArray(results) ? results : [];
  const usable = rows.filter((row) => row?.status === 'CURRENT_CANDIDATE');
  const blocked = rows.filter((row) => row?.status === 'BLOCKED');
  return Object.freeze({
    version: EVIDENCE_LINEAGE_VERSION,
    status: usable.length ? 'CURRENT_CANDIDATE' : rows.length ? 'BLOCKED' : 'MISSING',
    totalRecords: rows.length,
    usableRecords: usable.length,
    blockedRecords: blocked.length,
    sourceIds: Object.freeze([...new Set(usable.map((row) => row.lineage?.sourceId).filter(Boolean))]),
    rightsIds: Object.freeze([...new Set(usable.map((row) => row.lineage?.rightsId).filter(Boolean))]),
    calendarIds: Object.freeze([...new Set(usable.map((row) => row.lineage?.calendarId).filter(Boolean))]),
    blockedReasons: Object.freeze([...new Set(blocked.flatMap((row) => row.reasons || []))])
  });
}
