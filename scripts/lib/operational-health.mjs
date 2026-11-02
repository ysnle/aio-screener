import { idleNewsFeeds, newsFeedQuietAllowanceMs } from './news-selection.mjs';
// Watchdog thresholds in one place, each with the cadence it is measured against. ci-external-pipeline-check reads these;
// ci-data-pipeline-contract-check pins the values, so changing one is a reviewed decision, not an edit in a long check line.
export const WATCHDOG_THRESHOLDS = Object.freeze({
  // 30-minute market refresh: one missed slot plus start jitter.
  refreshMarketCadenceMinutes: 65,
  // Hourly cron or a workflow_run follow-up: about two missed hours.
  watchdogCadenceMinutes: 125,
  // Daily screener refresh (KR + US sessions), plus one missed day.
  screenerMaxAgeMinutes: 48 * 60,
  // Public data floors: tier-0 quotes, news bundle, Telegram digest and its healthy channels.
  minSymbolsOk: 70,
  minNewsCount: 10,
  minTelegramCount: 100,
  minHealthyTelegramChannels: 3,
  // A news feed with no current item: a warning after a day, a failure after three (quiet feeds get their own allowance).
  newsFeedStaleMs: 24 * 3600000,
  newsFeedDeadMs: 72 * 3600000,
  // A domain receipt without a success for this long is named in the warnings.
  receiptStaleMs: 3 * 86400000
});

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

// `events` names the triggers that count as an arrival. The watchdog also runs after every Pages/refresh/proxy completion
// (workflow_run), and those runs check the same planes: 11-01~02 GitHub fired its hourly cron 4 times in 24 h (gap 458m)
// while workflow_run runs kept the largest gap at 103m, so counting the cron alone warned about coverage that existed.
export const CADENCE_EVENTS = Object.freeze(['schedule', 'workflow_dispatch']);
export function workflowCadence(runs, { now = Date.now(), maxAgeMinutes, events = CADENCE_EVENTS } = {}) {
  const times = runs.filter(run => run.head_branch === 'main' && events.includes(run.event))
    .map(run => Date.parse(run.created_at)).filter(time => Number.isFinite(time) && time <= now).sort((a, b) => b - a);
  if (!times.length) return { ok: false, ageMinutes: null, latestGapMinutes: null, reason: 'not-observed' };
  const ageMinutes = Math.round((now - times[0]) / 60000);
  const latestGapMinutes = times.length > 1 ? Math.round((times[0] - times[1]) / 60000) : null;
  return { ok: ageMinutes <= maxAgeMinutes && (latestGapMinutes == null || latestGapMinutes <= maxAgeMinutes), ageMinutes, latestGapMinutes, reason: 'observed-arrivals' };
}

// 2026-10-19 data audit: a feed that stopped answering, a day's sentence that never replaced yesterday's and a receipt
// stuck on "collection failed" were each visible only by reading the artifacts by hand. The watchdog names them.
export function dataSourceWarnings(data, { nowMs = Date.now(), feedStaleMs = WATCHDOG_THRESHOLDS.newsFeedStaleMs } = {}) {
  const warnings = [];
  const meta = data?.meta || {};
  for (const feed of (Array.isArray(meta.newsFeedHealth) ? meta.newsFeedHealth : [])) {
    const since = Date.parse(feed?.lastHealthyAt || '');
    if (feed?.missStreak > 0 && Number.isFinite(since) && nowMs - since > newsFeedQuietAllowanceMs(feed, feedStaleMs)) {
      warnings.push(`news feed "${feed.source}" has had no usable current item for ${Math.round((nowMs - since) / 3600000)}h (${feed.missStreak} runs, last status ${feed.status})`);
    }
  }
  // 2026-10-19 pipeline redesign: a feed that answers every run but has not placed one article in the bundle for a week of
  // refreshes (counted in time, NEWS_FEED_IDLE_MS) costs a request and a slot guarantee for nothing; name it with the reason its articles were dropped.
  for (const feed of idleNewsFeeds(meta.newsFeedHealth, nowMs)) {
    const reasons = Object.entries(feed.dropped || {}).sort((a, b) => b[1] - a[1]).map(([why, n]) => `${why} ${n}`).join(', ');
    warnings.push(`news feed "${feed.source}" placed no article in ${feed.runs} runs (kept ${feed.keptTotal || 0}${reasons ? `; last run dropped: ${reasons}` : ''}) — prune or rewrite its query`);
  }
  const sentenceDay = data?.marketAnalysis?.sentence?.day;
  const today = new Date(nowMs + 3600000).toISOString().slice(0, 10); // KST day of (now - 08:00), as marketSentenceDay
  if (sentenceDay && sentenceDay < today && meta.marketSentenceReject && meta.marketSentenceReject !== 'no-new-candidate') {
    warnings.push(`daily sentence still ${sentenceDay}: today's candidate was rejected (${meta.marketSentenceReject})`);
  }
  for (const [domain, receipt] of Object.entries(meta.domainReceipts || {})) {
    const last = Date.parse(receipt?.lastSuccessfulObservation || '');
    if (receipt?.publication?.status && receipt.publication.status !== 'SUCCESS' && (!Number.isFinite(last) || nowMs - last > WATCHDOG_THRESHOLDS.receiptStaleMs)) {
      warnings.push(`collection receipt "${domain}" has not succeeded for 3+ days (${receipt.publication.status})`);
    }
  }
  return warnings;
}
// A feed with no usable item for three days is broken, not quiet: the watchdog fails, which opens the operations issue.
// v59.57: a low-cadence official feed that still answers with items (the Fed after an FOMC week) gets its own quiet
// allowance (NEWS_FEED_QUIET_MAX_MS); 11/01 22:55Z it failed every Pages release and watchdog run at exactly 72h.
export function deadNewsFeeds(data, { nowMs = Date.now(), deadMs = WATCHDOG_THRESHOLDS.newsFeedDeadMs } = {}) {
  return (Array.isArray(data?.meta?.newsFeedHealth) ? data.meta.newsFeedHealth : [])
    .filter((feed) => feed?.missStreak > 0 && nowMs - Date.parse(feed.lastHealthyAt || '') > newsFeedQuietAllowanceMs(feed, deadMs))
    .map((feed) => feed.source);
}
