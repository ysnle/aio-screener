// P1357: a completed-close reference and permission to act have separate contracts.
export function finalizePageDecision(decision, signal) {
  const d = { ...decision };
  const p = ['home', 'signal', 'briefing'].includes(d.pageId) ? signal?.presentation : null;
  if (p) {
    const score = typeof p.score === 'number' && Number.isFinite(p.score) ? p.score : null;
    if (score != null && p.basisLabel && p.status !== 'blocked') {
      d.referenceSummary = { score, displayScore: p.displayScore, basisLabel: p.basisLabel, status: p.status };
      d.decision = `${p.decision} · ${p.displayScore}/100`;
      d.sourceKind = 'REFERENCE';
      d.asOf = p.basisLabel;
      d.reasons = [p.description, ...(d.reasons || [])].slice(0, 3);
      d.caveat = p.description;
    } else {
      d.decision = p.decision || '시장환경 점수 산출 보류';
      d.sourceKind = 'UNAVAILABLE';
      d.asOf = '필수 종가 입력 확인 필요';
      d.caveat = p.description || d.caveat;
      d.referenceSummary = null;
      d.decisionBlocked = true;
      d.decisionEligible = false;
    }
    if (p.decisionEligible !== true || p.predictiveValidation !== 'established' || d.decisionBlocked) {
      d.decisionBlocked = true;
      d.decisionEligible = false;
      d.action = score == null
        ? '필수 종가 입력이 확인되기 전에는 점수와 매매·비중 결론을 생성하지 않습니다.'
        : '직전 미국장 종가의 시장환경 참고값입니다. 매매·비중 결론을 생성하지 않습니다.';
    }
  }
  const labels = { LIVE: '현재 관측', DELAYED: '지연 관측', SNAPSHOT: '저장 관측', REFERENCE: '참고 관측', UNAVAILABLE: '입력 확인 필요' };
  d.confidence = labels[d.sourceKind] || '근거 확인 필요';
  if (d.predictiveValidation !== 'established') d.confidence += ' · 예측 검증 미확립';
  return d;
}
