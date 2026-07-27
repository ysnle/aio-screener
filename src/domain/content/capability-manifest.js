// Wave 4: the guide publishes only capabilities that have an observable
// implementation boundary. This is a content contract, not a second data store.

export const CAPABILITY_MANIFEST_VERSION = 'wave4.capability.v1';

const rows = [
  {
    id: 'quote-currentness', label: '시세 현재성', status: 'conditional',
    evidence: 'source + observedAt + freshness state',
    wording: 'source-aware 시세 참고',
    forbiddenClaims: ['실시간 보장', '실시간 정확성 보장', '현재가 확정']
  },
  {
    id: 'translation', label: '뉴스 번역', status: 'optional',
    evidence: 'AI key/provider response or 원문 fallback',
    wording: '선택적 AI 번역 보강 · 원문 우선',
    forbiddenClaims: ['자동 번역 보장', '모든 뉴스 자동 번역']
  },
  {
    id: 'ai-analysis', label: 'AI 분석', status: 'optional',
    evidence: 'AI beta policy + injected evidence + response audit',
    wording: 'AI 교육·리서치 보조',
    forbiddenClaims: ['AI 기반 예측', 'AI 매매 지시', 'AI가 검증한 수익']
  },
  {
    id: 'rrg', label: 'RRG', status: 'reference',
    evidence: 'daily close relative-strength history versus benchmark',
    wording: '상대강도 로테이션 참고 분류',
    forbiddenClaims: ['RRG 선도 = 매수', '우상단 = 매수 확정']
  },
  {
    id: 'stage', label: 'Stage', status: 'conditional',
    evidence: 'OHLCV history and moving-average structure',
    wording: 'Weinstein 방식 추세 단계 참고',
    forbiddenClaims: ['Stage 2 = 매수', 'Stage 2 매수 타이밍']
  },
  {
    id: 'news-sentiment', label: '뉴스 감성', status: 'reference',
    evidence: 'headline/text heuristic score with source and date',
    wording: '뉴스 감성 점수 · 휴리스틱 참고',
    forbiddenClaims: ['뉴스 감성 = 주가 예측', '감성 점수 매수 신호']
  },
  {
    id: 'market-health', label: '시장 점수', status: 'reference',
    evidence: 'breadth, sentiment, volatility inputs with coverage',
    wording: '시장 환경 설명 지표',
    forbiddenClaims: ['매수 승인', '매도 승인', '시장 점수로 수익 보장']
  },
  {
    id: 'macro-causality', label: '금리·물가·역전·공포', status: 'reference',
    evidence: 'dated macro observation and source status',
    wording: '관측된 관계와 확인 항목',
    forbiddenClaims: ['침체 확정', '금리 상승 = 주가 하락 확정', '공포 = 매수 신호']
  },
  {
    id: 'decision-checklist', label: '행동 안내', status: 'observation-only',
    evidence: 'missing/evidence/freshness checklist',
    wording: '관측·확인·무효화 체크리스트',
    forbiddenClaims: ['지금 매수하세요', '지금 매도하세요', '포지션을 늘리세요']
  }
];

export const CAPABILITY_MANIFEST = Object.freeze(rows.map((row) => Object.freeze({
  ...row,
  forbiddenClaims: Object.freeze(row.forbiddenClaims.slice())
})));

function findCapability(id) {
  return CAPABILITY_MANIFEST.find((row) => row.id === String(id || '')) || null;
}

export function getCapabilityManifest() {
  return CAPABILITY_MANIFEST.slice();
}

export function getCapability(id) {
  return findCapability(id);
}

export function auditCapabilityClaims({ documentRef, claims = null } = {}) {
  const nodes = claims || (documentRef?.querySelectorAll
    ? [...documentRef.querySelectorAll('[data-aio-capability-claim]')]
    : []);
  const issues = [];
  const checked = nodes.map((node) => {
    const id = node?.dataset?.capability || node?.capability || null;
    const mode = node?.dataset?.claimMode || node?.claimMode || null;
    const text = String(node?.textContent || node?.text || '').replace(/\s+/g, ' ').trim();
    const capability = findCapability(id);
    const rowIssues = [];
    if (!capability) rowIssues.push('unknown-capability');
    if (!['observation', 'conditional', 'optional', 'reference'].includes(mode)) rowIssues.push('claim-mode-missing');
    if (capability && capability.forbiddenClaims.some((claim) => text.includes(claim))) rowIssues.push('forbidden-claim');
    if (rowIssues.length) issues.push({ id, mode, text, issues: rowIssues });
    return { id, mode, text, status: rowIssues.length ? 'blocked' : 'pass' };
  });
  return Object.freeze({
    version: CAPABILITY_MANIFEST_VERSION,
    ok: issues.length === 0,
    checkedCount: checked.length,
    capabilityCount: CAPABILITY_MANIFEST.length,
    issues,
    checked
  });
}
