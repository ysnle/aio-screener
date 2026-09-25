// P1256 (E5 O06 / 17 작업 단위 1): 도메인 receipt의 단일 소유자.
// SEC 배치가 먼저 도입한 계약(P1169)을 모든 수집 도메인이 공유한다 — job exit code는 수집 성공의
// 근거가 아니며, "이번 batch가 값을 갱신했는가"와 "기존 적격값이 그대로 발행되는가"는 다른 축이다.
//  - publication.status: SUCCESS / PARTIAL / NO_REFRESH_RETAINED / EMPTY / NOT_ATTEMPTED
//  - lastSuccessfulObservation은 이번 batch가 실제로 값을 갱신했을 때만 전진한다.
//  - 파일의 generatedAt은 신선도가 아니다(generatedAtIsNotFreshness).
export const DOMAIN_RECEIPT_PUBLICATION_STATUS = Object.freeze(['SUCCESS', 'PARTIAL', 'NO_REFRESH_RETAINED', 'EMPTY', 'NOT_ATTEMPTED']);

export function buildDomainReceipt({
  domain = 'unknown',
  runId = null,
  attemptedAt = null,
  sourceRevision = null,
  inputWatermarks = {},
  eligible = 0,
  attempted = 0,
  updated = 0,
  stored = 0,
  failures = [],
  priorReceipt = null,
  batchLimit = null,
  basisNote = 'per-symbol independent collection; retained eligible rows stay published while rows that lose their period requirements are excluded from analysis'
} = {}) {
  const ledger = (Array.isArray(failures) ? failures : []).filter(Boolean);
  const countStatus = (status) => ledger.filter((row) => row.status === status).length;
  // 이번 batch가 남긴 기록과 누적 원장은 다른 축이다. status 없는 구형 기록은 이번 실패도 terminal도
  // 아니므로 어느 쪽으로도 승격하지 않고 그대로 보존한다.
  const batchRows = attemptedAt ? ledger.filter((row) => row.attemptedAt === attemptedAt) : [];
  const batchTransient = batchRows.filter((row) => row.status === 'TRANSIENT_PROVIDER_FAILURE').length;
  const batchTerminal = batchRows.filter((row) => row.status === 'TERMINAL_UNSUPPORTED').length;
  const attemptedCount = Number(attempted) || 0;
  const updatedCount = Number(updated) || 0;
  const retained = Math.max(0, (Number(stored) || 0) - updatedCount);
  const pendingEligible = Math.max(0, (Number(eligible) || 0) - (Number(stored) || 0));
  const publication = attemptedCount === 0
    ? { status: 'NOT_ATTEMPTED', reason: 'no target was due in this batch' }
    : updatedCount === 0
      ? (retained > 0
        ? { status: 'NO_REFRESH_RETAINED', reason: 'every attempted target failed; previously stored rows stay published' }
        : { status: 'EMPTY', reason: 'every attempted target failed and no eligible row is stored' })
      : (batchTransient === 0 && batchTerminal === 0
        ? { status: 'SUCCESS', reason: 'every attempted target was updated' }
        : { status: 'PARTIAL', reason: 'some attempted targets were not updated' });
  return {
    schemaVersion: 'domain-receipt.v1',
    domain,
    runId,
    attemptedAt,
    sourceRevision,
    inputWatermarks: { ...inputWatermarks },
    batchLimit,
    counts: { eligible: Number(eligible) || 0, attempted: attemptedCount, updated: updatedCount, retained, pendingEligible },
    thisBatch: { updated: updatedCount, terminalUnsupported: batchTerminal, transientFailed: batchTransient, recorded: batchRows.length },
    ledger: {
      total: ledger.length,
      terminalUnsupported: countStatus('TERMINAL_UNSUPPORTED'),
      transientFailed: countStatus('TRANSIENT_PROVIDER_FAILURE'),
      legacyUnknown: ledger.filter((row) => !row.status).length
    },
    // 마지막 성공 관측은 이번 batch가 실제로 값을 갱신했을 때만 전진한다.
    lastSuccessfulObservation: updatedCount > 0 ? attemptedAt : (priorReceipt?.lastSuccessfulObservation || null),
    publication: {
      ...publication,
      allowsPartial: true,
      basis: basisNote,
      terminalExcludedFromBatchFailures: true,
      generatedAtIsNotFreshness: true
    }
  };
}

// P1256: 사용자 복구 설명 — "기존값 유지"와 "새 수집 성공"을 같은 성공으로 말하지 않는다.
// O05의 기능 수준 언어와 같은 축을 쓴다: 내부 runId 대신 사용자가 지금 무엇을 믿을 수 있는지.
export function describeDomainReceipt(receipt) {
  const status = receipt?.publication?.status || 'NOT_ATTEMPTED';
  const last = receipt?.lastSuccessfulObservation || null;
  const copy = {
    SUCCESS: '새 수집 성공',
    PARTIAL: '일부만 갱신 — 나머지는 기존값 유지 중',
    NO_REFRESH_RETAINED: '새 수집 실패 — 기존값 유지 중',
    EMPTY: '수집 실패 · 보관된 기존값 없음',
    NOT_ATTEMPTED: '이번 배치 미수집'
  }[status] || '상태 미확인';
  return {
    publicationStatus: DOMAIN_RECEIPT_PUBLICATION_STATUS.includes(status) ? status : 'NOT_ATTEMPTED',
    userCopy: last ? `${copy} · 마지막 성공 관측 ${last}` : `${copy} · 성공 관측 기록 없음`,
    lastSuccessfulObservation: last
  };
}
