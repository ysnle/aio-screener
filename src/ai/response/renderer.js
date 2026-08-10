export const AI_RENDERER_VERSION = 'answer-renderer.v1';

function line(value) { return String(value == null ? '' : value).trim(); }

export function renderAnswerPlan(plan, { format = 'text' } = {}) {
  if (!plan || plan.schemaVersion !== 'answer-plan.v1') return format === 'text' ? 'AI 응답 계약을 확인할 수 없어 표시하지 않습니다.' : { status: 'blocked', text: 'AI 응답 계약을 확인할 수 없어 표시하지 않습니다.' };
  const parts = [];
  if (line(plan.summary)) parts.push(line(plan.summary));
  const claims = Array.isArray(plan.claims?.claims) ? plan.claims.claims : [];
  claims.filter((claim) => claim.status !== 'blocked').forEach((claim) => {
    const value = claim.value == null ? '' : `: ${claim.value}${claim.unit || ''}`;
    const trace = claim.asOf && claim.source ? ` [${claim.source} · ${claim.asOf}]` : '';
    parts.push(`- ${line(claim.text)}${value}${trace}`);
  });
  (Array.isArray(plan.sections) ? plan.sections : []).forEach((section) => {
    if (typeof section === 'string' && line(section)) parts.push(line(section));
    else if (section?.title && section?.body) parts.push(`${line(section.title)}\n${line(section.body)}`);
  });
  if (Array.isArray(plan.citations) && plan.citations.length) {
    parts.push(`출처\n${plan.citations.slice(0, 8).map((citation) => {
      if (typeof citation === 'string') return `- ${line(citation)}`;
      return `- ${line(citation?.label || citation?.source || '원문')}${citation?.url ? `: ${line(citation.url)}` : ''}`;
    }).join('\n')}`);
  }
  if (plan.scenario?.probabilities == null && plan.scenario) parts.push('시나리오 확률은 보정된 모델 근거가 없어 제시하지 않습니다. 조건과 재검증 신호를 확인하세요.');
  return format === 'text' ? parts.join('\n\n') : { status: 'ok', text: parts.join('\n\n'), viewModel: plan };
}
