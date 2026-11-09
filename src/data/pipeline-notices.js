// What the 데이터 파이프라인 상태 bar says — moved from js/aio-data.js _aioRenderPipelineStatus
// (v51.65, the producer notices) and _aioCheckManualFieldStaleness (v51.66, the hand-kept _fieldTs dates). Pure: it
// reads the server data meta the loader stored and returns notices; src/ui/components/pipeline-status.js draws them.
// Texts are the legacy ones.

// A notice carries a tone (risk / warn / muted), not a colour. The legacy bar wrote an inline border-left-color that never
// showed (.lda-pipe has no left border), so the tone is a data attribute a stylesheet may use.
const TONE_OF_COLOR = { '#e5484d': 'risk', '#e2a336': 'warn', '#f59e0b': 'warn', '#b9a88d': 'muted' };

// The producer's own notices (src/data/server-data.js pipelineNotices) come first, then the publish/coverage/key checks.
export function pipelineNotices(meta, { universeStale = false } = {}) {
  if (!meta) return null;
  const msgs = (Array.isArray(meta.pipelineNotices) ? meta.pipelineNotices : [])
    .map(({ color, ...notice }) => ({ ...notice, tone: notice.tone || TONE_OF_COLOR[String(color || '').toLowerCase()] || 'warn' }));
  if (meta.marketCyclePublished !== true) {
    msgs.push({ icon: '', text: '시장 스냅샷 미발행', detail: '최근 refresh 시도는 완전한 시장 cycle로 발행되지 않았습니다. 현재 시세는 마지막 성공본 참고자료입니다.', tone: 'risk' });
  }
  if (meta.marketAnalysisOk === false) {
    msgs.push({ icon: '', text: 'AI 시장 분석 비활성', detail: '운영자의 공용 AI 연결 설정 후 자동 분석을 사용할 수 있습니다.', tone: 'warn' });
  }
  if (meta.fmpHasKey && meta.fmpOk === false && (meta.fundamentalCoveragePct == null || Number(meta.fundamentalCoveragePct) < 80)) {
    const coverage = meta.fundamentalCoveragePct == null ? null : Number(meta.fundamentalCoveragePct);
    const label = Number.isFinite(coverage) ? `${coverage.toFixed(1)}%` : '미확인';
    msgs.push({ icon: '', text: '재무 팩터 축소 모드', detail: `유료 FMP는 사용하지 않음, 무료 SEC companyfacts 누적 커버리지 ${label}`, tone: 'risk' });
  }
  if (universeStale) {
    msgs.push({ icon: '!', text: '스크리너 종목 유니버스 갱신 필요', detail: '팩터 파일과 종목 식별 유니버스의 기준일이 다릅니다. 현재 결과는 연구용 부분 상태입니다.', tone: 'warn' });
  }
  if (!meta.fredHasKey) {
    msgs.push({ icon: '', text: 'FRED 거시 서버갱신 비활성', detail: 'GitHub Secrets → FRED_API_KEY 등록 시 자동 활성화', tone: 'muted' });
  }
  if (meta.fredHasKey && meta.fredFetchOk === false) {
    msgs.push({ icon: '', text: 'FRED 거시 수집 실패', detail: 'FRED_API_KEY 등록됨 → API 오류 또는 레이트리밋. 키 유효성 확인', tone: 'risk' });
  }
  const reconciliation = meta.reconciliation || null;
  if (!reconciliation || reconciliation.status === 'unavailable') {
    msgs.push({ icon: '!', text: '데이터 범주 상태 미수신', detail: '22개 데이터 범주의 자동 조정 상태를 불러오지 못했습니다.', tone: 'risk' });
  } else if (reconciliation.status === 'stale') {
    msgs.push({ icon: '!', text: '데이터 범주 상태 불일치', detail: '현재 시장 스냅샷과 조정 상태의 revision이 다릅니다.', tone: 'risk' });
  } else if (Array.isArray(reconciliation.runtimeBlockedCategories) && reconciliation.runtimeBlockedCategories.length) {
    msgs.push({ icon: '!', text: `자동 데이터 경로 차단 ${reconciliation.runtimeBlockedCategories.length}건`, detail: reconciliation.runtimeBlockedCategories.slice(0, 6).join(', '), tone: 'risk' });
  }
  return msgs;
}

// v51.66: the DATA_SNAPSHOT._fieldTs dates an operator keeps by hand. A policy rate can stay unchanged between meetings,
// so each field has its own observation cycle instead of one 7-day rule.
export const MANUAL_FIELD_LABELS = Object.freeze({
  fed_rate: 'Fed 연방기금금리 월평균',
  boj_rate: 'BOJ 정책금리',
  bok_rate: 'BOK 기준금리',
  boe_rate: 'BOE 정책금리',
  pboc_rate: 'PBOC LPR',
  kr_bond: '한국 국고채',
  kr_macro: '한국 거시경제',
  kr_cpi: '한국 소비자물가',
  kr_pmi: '한국 제조업 PMI',
  us_macro_manual: '미국 거시경제(수동)',
  breadth_sma: '시장 폭 SMA'
});
export const MANUAL_FIELD_MAX_DAYS = Object.freeze({
  fed_rate: 55, boj_rate: 60, bok_rate: 60, boe_rate: 60, pboc_rate: 45,
  kr_bond: 7, kr_macro: 40, kr_cpi: 40, kr_pmi: 40, us_macro_manual: 40, breadth_sma: 3
});

/** Hand-kept fields older than their cycle. `staleDays(date)` is the app's calendar-day age (js/aio-core.js _aioStaleDays). */
export function staleManualFields(fieldTs, staleDays) {
  if (!fieldTs || typeof staleDays !== 'function') return [];
  return Object.keys(MANUAL_FIELD_LABELS).flatMap((key) => {
    const date = fieldTs[key];
    if (!date) return [];
    const days = staleDays(date);
    return days > (MANUAL_FIELD_MAX_DAYS[key] || 7) ? [{ key, label: MANUAL_FIELD_LABELS[key], days, date }] : [];
  });
}
