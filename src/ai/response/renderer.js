export const AI_RENDERER_VERSION = 'answer-renderer.v1';

function line(value) { return String(value == null ? '' : value).trim(); }

// v57.48 #7: a bound value reads as the user sees it on screen — "VIX 종가: 15.21 [종가 기준 · 2026-10-12 종가]",
// not "15.21index [close-basis · 2026-10-12]". Unknown units and sources pass through unchanged.
const UNIT_TEXT = Object.freeze({ index: '', percent: '%', bp: 'bp', usd_per_barrel: '달러', usd_per_ounce: '달러', krw_per_usd: '원' });
const SOURCE_TEXT = Object.freeze({ 'close-basis': '종가 기준' });
const unitText = (unit) => Object.prototype.hasOwnProperty.call(UNIT_TEXT, unit) ? UNIT_TEXT[unit] : (unit || '');

function safeUrl(value) {
  try {
    const url = new URL(line(value));
    return /^https?:$/.test(url.protocol) ? url.toString() : '';
  } catch (_) { return ''; }
}

export function renderAnswerPlan(plan, { format = 'text' } = {}) {
  if (!plan || plan.schemaVersion !== 'answer-plan.v1') return format === 'text' ? 'AI 응답 계약을 확인할 수 없어 표시하지 않습니다.' : { status: 'blocked', text: 'AI 응답 계약을 확인할 수 없어 표시하지 않습니다.' };
  const parts = [];
  if (line(plan.summary)) parts.push(line(plan.summary));
  const claims = Array.isArray(plan.claims?.claims) ? plan.claims.claims : [];
  claims.filter((claim) => claim.status !== 'blocked').forEach((claim) => {
    const value = claim.value == null ? '' : `: ${claim.value}${unitText(claim.unit)}`;
    const trace = claim.asOf && claim.source ? ` [${SOURCE_TEXT[claim.source] || claim.source} · ${claim.asOf}${claim.source === 'close-basis' ? ' 종가' : ''}]` : '';
    parts.push(`- ${line(claim.text)}${value}${trace}`);
  });
  (Array.isArray(plan.sections) ? plan.sections : []).forEach((section) => {
    if (typeof section === 'string' && line(section)) parts.push(line(section));
    else if (section?.title && section?.body) parts.push(`${line(section.title)}\n${line(section.body)}`);
  });
  if (Array.isArray(plan.citations) && plan.citations.length) {
    const citationLines = plan.citations.slice(0, 8).map((citation) => {
      if (typeof citation === 'string') return safeUrl(citation) ? `- ${safeUrl(citation)}` : '';
      const url = safeUrl(citation?.url);
      const label = line(citation?.label || citation?.source || '원문');
      return label && url ? `- ${label}: ${url}` : label ? `- ${label}` : '';
    }).filter(Boolean);
    if (citationLines.length) parts.push(`출처\n${citationLines.join('\n')}`);
  }
  if (plan.scenario?.probabilities == null && plan.scenario) parts.push('시나리오 확률은 보정된 모델 근거가 없어 제시하지 않습니다. 조건과 재검증 신호를 확인하세요.');
  return format === 'text' ? parts.join('\n\n') : { status: 'ok', text: parts.join('\n\n'), viewModel: plan };
}
