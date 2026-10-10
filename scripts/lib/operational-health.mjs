// P1596: passing blocking gates does not certify optional services or workflow cadence.
export function summarizeOperationalChecks(checks = [], warnings = []) {
  const failed = checks.filter(check => !check.ok && check.severity === 'error');
  const degraded = checks.filter(check => !check.ok && check.severity !== 'error');
  return { gateStatus: failed.length ? 'FAIL' : 'PASS', status: failed.length ? 'FAIL' : degraded.length || warnings.length ? 'DEGRADED' : 'PASS' };
}

export function marketAnalysisDiagnostic(data) {
  if (data?.meta?.marketAnalysisOk) return 'verified';
  const analysis = data?.marketAnalysis;
  return String(analysis?.reason || data?.meta?.marketAnalysisReason || analysis?.semanticIssues?.join(',') || 'analysis-unavailable').slice(0, 600);
}

export function operationalSummary(result) {
  const safe = value => String(value ?? '').replace(/[\r\n|<>]/g, ' ').slice(0, 800);
  const issues = (result.checks || []).filter(check => !check.ok).map(check => `${safe(check.id)}: ${safe(check.detail)}`);
  const warnings = (result.warnings || []).map(safe);
  return `## Operational health\n\n- Overall: **${safe(result.status)}**; blocking gates: **${safe(result.gateStatus)}**\n- Observed: ${safe(result.observedAt)}\n\n${[...issues, ...warnings].map(value => `- ${value}`).join('\n') || '- No issues observed.'}\n`;
}

export function workflowCadence(runs, { now = Date.now(), maxAgeMinutes } = {}) {
  const times = runs.filter(run => run.head_branch === 'main' && ['schedule', 'workflow_dispatch'].includes(run.event))
    .map(run => Date.parse(run.created_at)).filter(time => Number.isFinite(time) && time <= now).sort((a, b) => b - a);
  if (!times.length) return { ok: false, ageMinutes: null, latestGapMinutes: null, reason: 'not-observed' };
  const ageMinutes = Math.round((now - times[0]) / 60000);
  const latestGapMinutes = times.length > 1 ? Math.round((times[0] - times[1]) / 60000) : null;
  return { ok: ageMinutes <= maxAgeMinutes && (latestGapMinutes == null || latestGapMinutes <= maxAgeMinutes), ageMinutes, latestGapMinutes, reason: 'observed-arrivals' };
}
