// Weekly operator review (v58.84): the slow failures nothing else watches — an expiring
// GitHub dispatch token or Cloudflare token, the repository creeping toward GitHub's
// size limits, and the shared AI month nearing its budget. Pure evaluation only; the
// workflow fetches the evidence. Issue bodies are public, so AI usage appears only as
// a status, never as an amount (R658).

export const WEEKLY_REVIEW_POLICY = Object.freeze({
  tokenExpiryWarnDays: 30,
  repoSizeWarnKb: 900 * 1024,
  repoSizeAlertKb: 2 * 1024 * 1024,
  aiMonthlyWarnPercent: 80
});

const DAY_MS = 86_400_000;
const SECRET_ACTION = 'Settings → Secrets and variables → Actions에서 새 값으로 교체';

function daysUntil(isoOrMs, nowMs) {
  const at = typeof isoOrMs === 'number' ? isoOrMs : Date.parse(isoOrMs);
  return Number.isFinite(at) ? Math.floor((at - nowMs) / DAY_MS) : null;
}

/** GitHub sends `github-authentication-token-expiration: 2027-01-01 00:00:00 UTC` for expiring tokens. */
export function parseGithubTokenExpiration(header) {
  const match = /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) (UTC|[+-]\d{4})$/.exec(String(header || '').trim());
  if (!match) return null;
  const zone = match[3] === 'UTC' ? 'Z' : `${match[3].slice(0, 3)}:${match[3].slice(3)}`;
  const ms = Date.parse(`${match[1]}T${match[2]}${zone}`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function tokenFinding(id, label, evidence, nowMs, action) {
  if (!evidence || evidence.configured === false) {
    return { id, label, status: 'NOT_CONFIGURED', note: '저장소 시크릿이 없어 확인하지 않았습니다.' };
  }
  if (evidence.valid !== true) {
    return { id, label, status: 'ALERT', note: `토큰이 거절됐습니다(HTTP ${evidence.httpStatus ?? '?'}). ${action}.` };
  }
  if (!evidence.expiresAt) return { id, label, status: 'CLEAR', note: '유효하고 만료일이 없습니다.' };
  const days = daysUntil(evidence.expiresAt, nowMs);
  if (days === null) return { id, label, status: 'UNKNOWN', note: '만료일을 읽지 못했습니다.' };
  const date = evidence.expiresAt.slice(0, 10);
  if (days < 0) return { id, label, status: 'ALERT', note: `${date}에 만료됐습니다. ${action}.` };
  if (days <= WEEKLY_REVIEW_POLICY.tokenExpiryWarnDays) {
    return { id, label, status: 'WARN', note: `${date} 만료(${days}일 남음). ${action}.` };
  }
  return { id, label, status: 'CLEAR', note: `${date} 만료(${days}일 남음).` };
}

function repoSizeFinding(sizeKb) {
  const label = '저장소 크기';
  if (!Number.isSafeInteger(sizeKb) || sizeKb < 0) return { id: 'repo-size', label, status: 'UNKNOWN', note: '크기를 읽지 못했습니다.' };
  const mb = Math.round(sizeKb / 1024);
  if (sizeKb >= WEEKLY_REVIEW_POLICY.repoSizeAlertKb) {
    return { id: 'repo-size', label, status: 'ALERT', note: `${mb} MB. 큰 데이터 파일을 git 밖으로 옮기는 결정이 필요합니다.` };
  }
  if (sizeKb >= WEEKLY_REVIEW_POLICY.repoSizeWarnKb) {
    return { id: 'repo-size', label, status: 'WARN', note: `${mb} MB(경고 기준 900 MB). 커지는 파일을 먼저 확인하세요.` };
  }
  return { id: 'repo-size', label, status: 'CLEAR', note: `${mb} MB.` };
}

function aiBudgetFinding(usage) {
  const label = '공용 AI 월 예산';
  if (!usage || usage.configured === false) {
    return { id: 'ai-monthly-budget', label, status: 'NOT_CONFIGURED', note: 'AIO_OPERATOR_TOKEN이 없어 확인하지 않았습니다.' };
  }
  const reserved = usage.monthlyReservedMicroUsd;
  const budget = usage.monthlyBudgetMicroUsd;
  if (!Number.isSafeInteger(reserved) || !Number.isSafeInteger(budget) || budget <= 0 || reserved < 0) {
    return { id: 'ai-monthly-budget', label, status: 'UNKNOWN', note: '사용량을 읽지 못했습니다.' };
  }
  return reserved * 100 >= budget * WEEKLY_REVIEW_POLICY.aiMonthlyWarnPercent
    ? { id: 'ai-monthly-budget', label, status: 'WARN', note: `이번 달 예약액이 예산의 ${WEEKLY_REVIEW_POLICY.aiMonthlyWarnPercent}% 이상입니다. OpenAI 대시보드의 실제 청구액을 확인하세요.` }
    : { id: 'ai-monthly-budget', label, status: 'CLEAR', note: `예산의 ${WEEKLY_REVIEW_POLICY.aiMonthlyWarnPercent}% 미만입니다.` };
}

export function evaluateWeeklyReview({ now, githubDispatchToken, cloudflareToken, repoSizeKb, aiUsage } = {}) {
  const nowMs = Date.parse(now);
  if (!Number.isFinite(nowMs)) throw new Error('evaluateWeeklyReview: now must be an ISO timestamp');
  const findings = [
    tokenFinding('github-dispatch-token', 'AIO_REFRESH_DISPATCH_TOKEN (GitHub)', githubDispatchToken, nowMs,
      `GitHub Settings → Developer settings → Fine-grained tokens에서 재발급한 뒤 ${SECRET_ACTION}하고 데이터 평면 배포를 다시 실행`),
    tokenFinding('cloudflare-token', 'CLOUDFLARE_API_TOKEN', cloudflareToken, nowMs,
      `Cloudflare 대시보드 → My Profile → API Tokens에서 Roll한 뒤 ${SECRET_ACTION}`),
    repoSizeFinding(repoSizeKb),
    aiBudgetFinding(aiUsage)
  ];
  const needsAction = findings.some((finding) => finding.status === 'ALERT' || finding.status === 'WARN');
  return { now: new Date(nowMs).toISOString(), needsAction, findings };
}

const BADGE = { ALERT: '🔴 조치 필요', WARN: '🟡 곧 조치', CLEAR: '🟢 정상', NOT_CONFIGURED: '⚪ 미설정', UNKNOWN: '⚪ 확인 불가' };

export function renderWeeklyReviewMarkdown(review, marker) {
  const rows = review.findings.map((finding) => `| ${finding.label} | ${BADGE[finding.status]} | ${finding.note} |`);
  return [
    marker,
    '## 주간 운영 점검',
    '',
    `점검 시각: ${review.now}`,
    '',
    '| 항목 | 상태 | 내용 |',
    '|---|---|---|',
    ...rows,
    '',
    '조치가 필요한 항목이 모두 정상이 되면 다음 주간 점검이 이 이슈를 닫습니다. 대응 방법은 `_context/OPERATOR-RUNBOOK.md`의 "증상별 빠른 대응"을 보세요.'
  ].join('\n');
}
