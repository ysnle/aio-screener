// Executable /data-refresh closure: 22 durable snapshot categories plus the
// separately reported Korean dynamic pipeline checks. This is a freshness and
// lineage audit, not a claim that unavailable/licensed data exists.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { TIER_0_INSTRUMENTS } from '../src/data/contracts/market-snapshot.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const json = (file) => JSON.parse(read(file));
const MARKET_SNAPSHOT_MAX_AGE_DAYS = 0.5;
const MARKET_SNAPSHOT_MAX_AGE_MS = MARKET_SNAPSHOT_MAX_AGE_DAYS * 86400000;
const BOK_POLICY_MAX_AGE_DAYS = 60;
// P1556: a policy meeting passes before anyone can record its result (the value is a hand-kept official reference). The audit
// gates every 30-minute refresh, so an overdue meeting is a warning for this many days and blocks only after them; otherwise
// the whole pipeline would stop on the meeting day with nobody to update the value.
const BOK_MEETING_GRACE_DAYS = 14;
const DAY_MS = 86400000;

function assessPublishedSnapshot({ dataArtifact, snapshotArtifact, statusArtifact }) {
  const publishedAt = publishedSnapshotAt(snapshotArtifact);
  const publishedRevision = snapshotArtifact?.revision || statusArtifact?.lastKnownGoodRevision || null;
  const statusRevisionMatches = Boolean(
    publishedRevision
    && publishedAt
    && statusArtifact?.lastKnownGoodRevision === publishedRevision
    && Date.parse(statusArtifact?.lastSuccessfulAt || '') === Date.parse(publishedAt || '')
  );
  const statusIsSuccessful = statusArtifact?.schemaVersion === 'market-snapshot-status-v1'
    && statusArtifact?.attemptStatus === 'published'
    && (!Array.isArray(statusArtifact?.errors) || statusArtifact.errors.length === 0);
  const dataCycleIsPublished = dataArtifact?.meta?.cycleStatus === 'PUBLISHED'
    && dataArtifact?.meta?.marketSnapshotPublished === true
    && dataArtifact?.meta?.cycleComponents?.marketSnapshotPublished === true;
  const snapshotIsPublished = snapshotArtifact?.status === 'published'
    && (!Array.isArray(snapshotArtifact?.errors) || snapshotArtifact.errors.length === 0)
    && Number(snapshotArtifact?.coverage?.tier0Observed) === Number(snapshotArtifact?.coverage?.tier0Required);
  return {
    publishedAt,
    publishedRevision,
    attemptedRevision: dataArtifact?.meta?.marketSnapshotRevision || statusArtifact?.attemptedAt || null,
    attemptStatus: statusArtifact?.attemptStatus || 'unknown',
    currentCyclePublished: statusIsSuccessful && statusRevisionMatches && dataCycleIsPublished && snapshotIsPublished
  };
}

const TIER0_IDS = new Set(TIER_0_INSTRUMENTS.map((instrument) => instrument.instrumentId));
const SNAPSHOT_QUALITIES = new Set(['CURRENT', 'CLOSED_CURRENT', 'DELAYED', 'STALE', 'UNAVAILABLE', 'QUARANTINED']);
const SNAPSHOT_SESSIONS = new Set([
  'CURRENT_SESSION', 'DELAYED_IN_SESSION', 'MARKET_CLOSED', 'PREVIOUS_CLOSE_EXPECTED',
  'PREMARKET', 'AFTER_HOURS', 'STALE_UNEXPECTED', 'SOURCE_UNAVAILABLE'
]);
const MAX_DIAGNOSTIC_ERRORS = 128;
const MAX_BLOCKED_INSTRUMENTS = 16;

function boundedCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.min(9999, Math.floor(number)) : null;
}

function normalizedIso(value) {
  const time = Date.parse(value || '');
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function boundedAgeHours(value, nowMs = Date.now()) {
  const observedMs = Date.parse(value || '');
  if (!Number.isFinite(observedMs)) return null;
  const hours = Math.round((nowMs - observedMs) / 360000) / 10;
  return Math.max(-9999, Math.min(9999, hours));
}

function classifySnapshotFreshness(value, nowMs = Date.now()) {
  const publishedMs = Date.parse(value || '');
  if (!Number.isFinite(publishedMs)) return 'MISSING';
  const ageMs = nowMs - publishedMs;
  if (ageMs < 0) return 'FUTURE';
  return ageMs <= MARKET_SNAPSHOT_MAX_AGE_MS ? 'CURRENT' : 'STALE';
}

function ageDaysAt(value, nowMs) {
  const observedMs = Date.parse(value || '');
  return Number.isFinite(observedMs) ? (nowMs - observedMs) / DAY_MS : null;
}

function statusForAt(observedAt, cadence, forced, maxAgeDays, nowMs) {
  const age = ageDaysAt(observedAt, nowMs);
  if (age == null) {
    if (forced && forced !== 'OK') return forced;
    return forced === 'OK' ? 'INVALID' : 'SKIPPED';
  }
  if (age < 0) return 'FUTURE';
  if (forced && forced !== 'OK') return forced;
  if (forced) return forced;
  const limit = Number.isFinite(maxAgeDays)
    ? maxAgeDays
    : cadence === 'daily' ? 2 : cadence === 'weekly' ? 8 : cadence === 'monthly' ? 35 : 120;
  return age <= limit ? 'OK' : age <= limit * 2 ? 'STALE' : 'CRITICAL';
}

function utcDateMs(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value ? ms : null;
}

function assessBokPolicyEvidence(policy, calendar, { snapshotWired = false, nowMs = Date.now() } = {}) {
  const reasons = [];
  const warnings = [];
  const asOfMs = utcDateMs(policy?.asOf);
  const nextMs = utcDateMs(policy?.next);
  const ageDays = asOfMs == null ? null : (nowMs - asOfMs) / DAY_MS;
  if (!policy || typeof policy !== 'object') reasons.push('policy-missing');
  const rateQuarterUnits = Number(policy?.value) * 4;
  if (typeof policy?.value !== 'number' || !Number.isFinite(policy.value) || policy.value < 0 || policy.value > 10
    || Math.abs(rateQuarterUnits - Math.round(rateQuarterUnits)) > 1e-8) reasons.push('value-missing-or-invalid');
  if (!['인상', '인하', '동결'].includes(policy?.status)) reasons.push('decision-status-missing-or-invalid');
  if (policy?.source !== 'Bank of Korea' || policy?.sourceKind !== 'official-primary'
    || policy?.operationalUse !== 'reference-only'
    || policy?.sourceUrl !== 'https://www.bok.or.kr/portal/singl/baseRate/list.do?menuNo=200643') {
    reasons.push('official-source-contract-invalid');
  }
  if (asOfMs == null) reasons.push('as-of-missing-or-invalid');
  else if (ageDays < 0) reasons.push('as-of-future');
  else if (ageDays > BOK_POLICY_MAX_AGE_DAYS + (nextMs != null && nextMs <= nowMs && (nowMs - nextMs) / DAY_MS <= BOK_MEETING_GRACE_DAYS ? BOK_MEETING_GRACE_DAYS : 0)) reasons.push('as-of-stale');
  if (nextMs == null || nextMs <= asOfMs) reasons.push('next-meeting-missing-or-invalid');
  else if (nextMs <= nowMs) {
    if ((nowMs - nextMs) / DAY_MS > BOK_MEETING_GRACE_DAYS) reasons.push('next-meeting-passed-beyond-grace');
    else warnings.push('next-meeting-passed-update-needed');
  }
  if (!calendar || calendar.lastRelease !== policy?.asOf || calendar.nextRelease !== policy?.next
    || typeof calendar.sourceUrl !== 'string' || !/^https:\/\/www\.bok\.or\.kr\//.test(calendar.sourceUrl)) {
    reasons.push('calendar-mismatch-or-unofficial');
  }
  if (snapshotWired !== true) reasons.push('data-snapshot-reference-missing');
  return {
    valid: reasons.length === 0,
    asOf: asOfMs == null ? null : policy.asOf,
    value: typeof policy?.value === 'number' && Number.isFinite(policy.value) ? policy.value : null,
    ageDays,
    reasons,
    warnings
  };
}

function officialFedStatementDate(value) {
  const match = /^https:\/\/www\.federalreserve\.gov\/newsevents\/pressreleases\/monetary(\d{4})(\d{2})(\d{2})a\.htm$/.exec(value || '');
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function officialFedCalendarSources(calendarFomc, calendarRate) {
  const canonicalUrl = 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm';
  return calendarFomc?.sourceUrl === canonicalUrl && calendarRate?.sourceUrl === canonicalUrl;
}

function policyRatesEligible(fomcRegistryAligned, bokPolicyEvidence) {
  return fomcRegistryAligned === true && bokPolicyEvidence?.valid === true;
}

function extractManualReference(coreRuntime) {
  const start = coreRuntime.indexOf('const AIO_MANUAL_REFERENCE = Object.freeze({');
  const end = coreRuntime.indexOf('\n});', start);
  if (start < 0 || end <= start) return null;
  const sandbox = { window: {} };
  try {
    runInNewContext(`${coreRuntime.slice(start, end + 4)}\nwindow.AIO_MANUAL_REFERENCE = AIO_MANUAL_REFERENCE;`, sandbox, { timeout: 1000 });
    return sandbox.window.AIO_MANUAL_REFERENCE || null;
  } catch (_) {
    return null;
  }
}

function hasBokSnapshotWiring(coreRuntime) {
  const start = coreRuntime.indexOf('const DATA_SNAPSHOT = {');
  const end = coreRuntime.indexOf('\n};', start);
  if (start < 0 || end <= start) return false;
  const block = coreRuntime.slice(start, end);
  const fieldTimes = block.match(/_fieldTs\s*:\s*\{([^}]*)\}/)?.[1] || '';
  return /\bbok_rate\s*:\s*AIO_MANUAL_REFERENCE\.bokPolicy\.asOf/.test(fieldTimes)
    && /\bbokRate\s*:\s*AIO_MANUAL_REFERENCE\.bokPolicy\.value/.test(block);
}

function shouldCaptureSnapshotDiagnostic({ marketFetchOutcome, attemptStatus, currentCyclePublished, snapshotFreshness }) {
  return marketFetchOutcome === 'failure'
    || attemptStatus !== 'published'
    || !currentCyclePublished
    || snapshotFreshness !== 'CURRENT';
}

function snapshotPromotionReady(snapshotAudit, nowMs = Date.now()) {
  return snapshotAudit?.currentCyclePublished === true
    && classifySnapshotFreshness(snapshotAudit.publishedAt, nowMs) === 'CURRENT';
}

function publishedSnapshotAt(snapshotArtifact) {
  // P1300/R649: status-side lastSuccessfulAt cannot substitute for the
  // published artifact's own generatedAt when deciding freshness/promotion.
  return snapshotArtifact?.generatedAt || null;
}

// `errors` is generated from provider-derived rows. Keep only registry symbols,
// internal quality/session enums, and bounded counts; never echo arbitrary text.
function summarizeSnapshotErrors(errors) {
  const source = Array.isArray(errors) ? errors : [];
  const blocked = new Map();
  const coverageFailures = [];
  let tier0QualityCount = 0;
  let tier0CoverageCount = 0;
  let unclassifiedCount = 0;
  let blockedInstrumentsTruncated = false;

  for (const error of source.slice(0, MAX_DIAGNOSTIC_ERRORS)) {
    if (typeof error !== 'string') {
      unclassifiedCount += 1;
      continue;
    }
    const qualityMatch = /^tier0_quality:([^:]{1,32}):([^:]{1,32}):([^:]{1,32})$/.exec(error);
    if (qualityMatch
      && TIER0_IDS.has(qualityMatch[1])
      && SNAPSHOT_QUALITIES.has(qualityMatch[2])
      && SNAPSHOT_SESSIONS.has(qualityMatch[3])) {
      tier0QualityCount += 1;
      const key = `${qualityMatch[1]}\u0000${qualityMatch[2]}\u0000${qualityMatch[3]}`;
      if (blocked.has(key)) {
        blocked.get(key).count += 1;
      } else if (blocked.size < MAX_BLOCKED_INSTRUMENTS) {
        blocked.set(key, { instrumentId: qualityMatch[1], quality: qualityMatch[2], session: qualityMatch[3], count: 1 });
      } else {
        blockedInstrumentsTruncated = true;
      }
      continue;
    }
    const coverageMatch = /^tier0_coverage:(\d{1,4})\/(\d{1,4})$/.exec(error);
    if (coverageMatch) {
      tier0CoverageCount += 1;
      if (coverageFailures.length < 4) {
        coverageFailures.push({ observed: boundedCount(coverageMatch[1]), required: boundedCount(coverageMatch[2]) });
      }
      continue;
    }
    unclassifiedCount += 1;
  }

  return {
    total: Math.min(source.length, 9999),
    totalCapped: source.length > 9999,
    tier0QualityCount,
    blockedInstruments: [...blocked.values()],
    blockedInstrumentsTruncated,
    tier0CoverageCount,
    coverageFailures,
    unclassifiedCount,
    truncated: source.length > MAX_DIAGNOSTIC_ERRORS
  };
}

function assertSnapshotDiagnosticRedaction() {
  const knownId = TIER_0_INSTRUMENTS[0]?.instrumentId;
  const secretMarker = 'DIAGNOSTIC-REDACTION-SENTINEL';
  const summary = summarizeSnapshotErrors([
    `tier0_quality:${knownId}:STALE:STALE_UNEXPECTED`,
    'tier0_coverage:0/16',
    `provider_failure:${secretMarker}:raw-provider-payload`,
    `tier0_quality:${knownId}:STALE:STALE_UNEXPECTED:${secretMarker}`
  ]);
  const serialized = JSON.stringify(summary);
  const oversized = summarizeSnapshotErrors(Array.from({ length: MAX_DIAGNOSTIC_ERRORS + 1 }, () =>
    `tier0_quality:${knownId}:STALE:STALE_UNEXPECTED`));
  const fixedNow = Date.parse('2026-09-27T00:00:00.000Z');
  const futureGeneratedAt = new Date(fixedNow + 1).toISOString();
  const recentGeneratedAt = new Date(fixedNow - 60 * 60 * 1000).toISOString();

  // P1289/R639 + P1290/R640: diagnostics stay redacted, and a stale LKG never passes promotion.
  if (!knownId
    || summary.total !== 4
    || summary.tier0QualityCount !== 1
    || summary.tier0CoverageCount !== 1
    || summary.unclassifiedCount !== 2
    || summary.blockedInstruments.length !== 1
    || summary.blockedInstruments[0]?.instrumentId !== knownId
    || summary.coverageFailures[0]?.observed !== 0
    || summary.coverageFailures[0]?.required !== 16
    || serialized.includes(secretMarker)
    || !oversized.truncated
    || oversized.blockedInstruments.length > MAX_BLOCKED_INSTRUMENTS
    || classifySnapshotFreshness('2026-09-26T11:59:59.999Z', fixedNow) !== 'STALE'
    || classifySnapshotFreshness('2026-09-26T12:00:00.000Z', fixedNow) !== 'CURRENT'
    || classifySnapshotFreshness('2026-09-27T00:00:00.001Z', fixedNow) !== 'FUTURE'
    || classifySnapshotFreshness(null, fixedNow) !== 'MISSING'
    || ageDaysAt(futureGeneratedAt, fixedNow) >= 0
    || statusForAt(futureGeneratedAt, 'daily', null, MARKET_SNAPSHOT_MAX_AGE_DAYS, fixedNow) !== 'FUTURE'
    || statusForAt(futureGeneratedAt, 'daily', 'OK', MARKET_SNAPSHOT_MAX_AGE_DAYS, fixedNow) !== 'FUTURE'
    || statusForAt(recentGeneratedAt, 'daily', null, MARKET_SNAPSHOT_MAX_AGE_DAYS, fixedNow) !== 'OK'
    || !snapshotPromotionReady({ currentCyclePublished: true, publishedAt: '2026-09-26T12:00:00.000Z' }, fixedNow)
    || snapshotPromotionReady({ currentCyclePublished: true, publishedAt: '2026-09-26T11:59:59.999Z' }, fixedNow)
    || snapshotPromotionReady({ currentCyclePublished: false, publishedAt: '2026-09-26T23:59:59.999Z' }, fixedNow)
    || boundedAgeHours('2000-01-01T00:00:00.000Z', fixedNow) !== 9999
    || boundedAgeHours('invalid', fixedNow) !== null
    || !shouldCaptureSnapshotDiagnostic({ marketFetchOutcome: 'success', attemptStatus: 'failed', currentCyclePublished: false, snapshotFreshness: 'CURRENT' })
    || !shouldCaptureSnapshotDiagnostic({ marketFetchOutcome: 'failure', attemptStatus: 'published', currentCyclePublished: true, snapshotFreshness: 'CURRENT' })
    || !shouldCaptureSnapshotDiagnostic({ marketFetchOutcome: 'success', attemptStatus: 'published', currentCyclePublished: true, snapshotFreshness: 'STALE' })
    || shouldCaptureSnapshotDiagnostic({ marketFetchOutcome: 'success', attemptStatus: 'published', currentCyclePublished: true, snapshotFreshness: 'CURRENT' })) {
    throw new Error('P1289/R639 snapshot diagnostics redaction/freshness contract failed');
  }
}

function assertPublishedSnapshotGeneratedAtRequired() {
  const recentGeneratedAt = '2026-09-26T23:00:00.000Z';
  const snapshotArtifact = {
    status: 'published',
    revision: 'fixture-revision',
    generatedAt: null,
    lastSuccessfulAt: recentGeneratedAt,
    coverage: { tier0Required: TIER0_IDS.size, tier0Observed: TIER0_IDS.size },
    errors: []
  };
  const audit = assessPublishedSnapshot({
    dataArtifact: { meta: {
      cycleStatus: 'PUBLISHED',
      marketSnapshotPublished: true,
      cycleComponents: { marketSnapshotPublished: true }
    } },
    snapshotArtifact,
    statusArtifact: {
      schemaVersion: 'market-snapshot-status-v1',
      attemptStatus: 'published',
      lastSuccessfulAt: recentGeneratedAt,
      lastKnownGoodRevision: 'fixture-revision',
      errors: []
    }
  });
  const fixedNow = Date.parse('2026-09-27T00:00:00.000Z');
  const freshness = classifySnapshotFreshness(publishedSnapshotAt(snapshotArtifact), fixedNow);
  if (audit.publishedAt !== null
    || audit.currentCyclePublished
    || snapshotPromotionReady(audit, fixedNow)
    || freshness !== 'MISSING'
    || !shouldCaptureSnapshotDiagnostic({
      marketFetchOutcome: 'success',
      attemptStatus: 'published',
      currentCyclePublished: audit.currentCyclePublished,
      snapshotFreshness: freshness
    })) {
    throw new Error('P1300/R649/QA-DATA-43 missing published generatedAt must block promotion and trigger diagnostics');
  }
}

function workflowStep(workflow, name) {
  const normalized = workflow.replace(/\r\n/g, '\n');
  const marker = `      - name: ${name}\n`;
  const start = normalized.indexOf(marker);
  if (start < 0 || normalized.indexOf(marker, start + marker.length) >= 0) return null;
  const end = normalized.indexOf('\n      - name:', start + marker.length);
  return normalized.slice(start, end < 0 ? undefined : end);
}

function assertSnapshotDiagnosticWorkflowContract(source = read('.github/workflows/refresh-data.yml')) {
  const workflow = source.replace(/\r\n/g, '\n');
  const capture = workflowStep(workflow, 'Capture redacted market snapshot diagnostics') || '';
  const upload = workflowStep(workflow, 'Upload failed market snapshot diagnostics') || '';
  const reconciliation = workflowStep(workflow, 'Validate evidence-derived 22-category reconciliation') || '';
  const promotion = workflowStep(workflow, 'Fail-closed promotion candidate gate before push') || '';
  const failures = [];
  const check = (ok, message) => { if (!ok) failures.push(message); };
  const fetchAt = workflow.indexOf('      - name: Fetch market data\n');
  const captureAt = workflow.indexOf('      - name: Capture redacted market snapshot diagnostics\n');
  const uploadAt = workflow.indexOf('      - name: Upload failed market snapshot diagnostics\n');

  // P1289/R639/QA-DATA-32: keep the run-scoped diagnostic upload wired after fetch and fail closed.
  check(fetchAt >= 0 && fetchAt < captureAt && captureAt < uploadAt, 'capture/upload order after market fetch');
  check(/^\s+id:\s*snapshot-diagnostic\s*$/m.test(capture), 'capture step exposes the snapshot-diagnostic output id');
  check(/if:\s*\$\{\{\s*always\(\)\s*&&\s*!cancelled\(\)\s*\}\}/.test(capture), 'capture runs after failed fetch steps');
  check(/AIO_MARKET_FETCH_OUTCOME:\s*\$\{\{\s*steps\.fetch-market\.outcome\s*\}\}/.test(capture), 'capture records market fetch outcome');
  check(/run:\s*node scripts\/ci-data-refresh-audit\.mjs --write-snapshot-diagnostic "\$RUNNER_TEMP\/market-snapshot-diagnostic\.json"/.test(capture), 'capture writes the runner-temp diagnostic');
  check(/if:\s*\$\{\{\s*always\(\)\s*&&\s*!cancelled\(\)\s*&&\s*steps\.snapshot-diagnostic\.outputs\.capture\s*==\s*'true'\s*\}\}/.test(upload), 'upload runs only for a captured diagnostic');
  check(/uses:\s*actions\/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02(?:\s|$)/.test(upload), 'artifact action is pinned to its reviewed full SHA');
  check(/name:\s*market-snapshot-diagnostic-\$\{\{\s*github\.run_id\s*\}\}/.test(upload), 'artifact name is run scoped');
  check(/path:\s*\$\{\{\s*runner\.temp\s*\}\}\/market-snapshot-diagnostic\.json/.test(upload), 'upload path matches the captured file');
  check(/if-no-files-found:\s*error\b/.test(upload), 'missing diagnostic file fails the upload step');
  check(/retention-days:\s*7\b/.test(upload), 'diagnostic retention is limited to seven days');

  const auditAt = reconciliation.indexOf('node scripts/ci-data-refresh-audit.mjs');
  const recordAt = reconciliation.indexOf('node scripts/verify-refresh-candidate.mjs --record');
  check(auditAt >= 0 && recordAt > auditAt, 'full freshness audit remains before candidate recording');
  check(/node scripts\/verify-refresh-candidate\.mjs --expect "\$RUNNER_TEMP\/aio-refresh-data-candidate\.json"/.test(promotion), 'fail-closed promotion candidate check remains wired');

  if (failures.length) throw new Error(`P1289/R639/QA-DATA-32 diagnostic workflow contract failed: ${failures.join('; ')}`);
}

function assertSnapshotDiagnosticWorkflowNegativeControl() {
  const workflow = read('.github/workflows/refresh-data.yml');
  const brokenWorkflow = workflow.replace(/retention-days:\s*7\b/, 'retention-days: 8');
  const captureIdLine = '      - name: Capture redacted market snapshot diagnostics\n        id: snapshot-diagnostic';
  const brokenCaptureId = workflow.replace(captureIdLine, captureIdLine.replace('id: snapshot-diagnostic', 'id: renamed-diagnostic'));
  const rejectedFor = (source, reason) => {
    try { assertSnapshotDiagnosticWorkflowContract(source); }
    catch (error) { return String(error.message).includes(reason); }
    return false;
  };
  if (!rejectedFor(brokenWorkflow, 'retention is limited to seven days')
    || !rejectedFor(brokenCaptureId, 'capture step exposes the snapshot-diagnostic output id')) {
    throw new Error('P1289/R639/QA-DATA-32 retention or diagnostic output-id negative control was accepted');
  }
}

function assertRefreshCandidateSelfTestWiring(source = read('.github/workflows/refresh-data.yml')) {
  const reconciliation = workflowStep(source, 'Validate evidence-derived 22-category reconciliation') || '';
  const selfTestAt = reconciliation.indexOf('node scripts/verify-refresh-candidate.mjs --self-test');
  const auditAt = reconciliation.indexOf('node scripts/ci-data-refresh-audit.mjs');
  // P1299/QA-DATA-42: a valid >1 MiB staged/commit blob must be exercised on every data refresh.
  if (selfTestAt < 0 || auditAt < 0 || selfTestAt >= auditAt) {
    throw new Error('P1299/QA-DATA-42 candidate helper self-test must run before the refresh data audit');
  }
}

function assertRefreshCandidateSelfTestWiringNegativeControl() {
  const workflow = read('.github/workflows/refresh-data.yml');
  const brokenWorkflow = workflow.replace('node scripts/verify-refresh-candidate.mjs --self-test', 'node scripts/verify-refresh-candidate.mjs --help');
  let rejected = false;
  try { assertRefreshCandidateSelfTestWiring(brokenWorkflow); }
  catch (error) { rejected = String(error.message).includes('P1299/QA-DATA-42'); }
  if (!rejected) throw new Error('P1299/QA-DATA-42 self-test wiring negative control was accepted');
}

function assertBokPolicyFixtures() {
  const fixedNow = Date.parse('2026-09-27T00:00:00.000Z');
  const currentPolicy = {
    value: 3.00,
    status: '인상',
    asOf: '2026-08-27',
    next: '2026-10-22',
    source: 'Bank of Korea',
    sourceKind: 'official-primary',
    sourceUrl: 'https://www.bok.or.kr/portal/singl/baseRate/list.do?menuNo=200643',
    operationalUse: 'reference-only'
  };
  const currentCalendar = {
    lastRelease: '2026-08-27',
    nextRelease: '2026-10-22',
    sourceUrl: 'https://www.bok.or.kr/eng/bbs/E0000627/view.do?menuNo=400022&nttId=10094301'
  };
  const valid = assessBokPolicyEvidence(currentPolicy, currentCalendar, { snapshotWired: true, nowMs: fixedNow });
  const stale = assessBokPolicyEvidence(
    { ...currentPolicy, asOf: '2026-07-27' },
    { ...currentCalendar, lastRelease: '2026-07-27' },
    { snapshotWired: true, nowMs: fixedNow }
  );
  const missing = assessBokPolicyEvidence(
    { ...currentPolicy, value: null, asOf: null },
    { ...currentCalendar, lastRelease: null },
    { snapshotWired: false, nowMs: fixedNow }
  );
  const future = assessBokPolicyEvidence(
    { ...currentPolicy, asOf: '2026-09-28' },
    { ...currentCalendar, lastRelease: '2026-09-28' },
    { snapshotWired: true, nowMs: fixedNow }
  );
  const unofficial = assessBokPolicyEvidence(
    { ...currentPolicy, sourceUrl: 'https://example.invalid/rate' },
    currentCalendar,
    { snapshotWired: true, nowMs: fixedNow }
  );
  const implausible = assessBokPolicyEvidence(
    { ...currentPolicy, value: 25 },
    currentCalendar,
    { snapshotWired: true, nowMs: fixedNow }
  );
  // P1556: the day after the meeting is a warning (the result is still being recorded), three weeks after it blocks again.
  const meetingMs = Date.parse('2026-10-22T00:00:00.000Z');
  const dayAfter = assessBokPolicyEvidence(currentPolicy, currentCalendar, { snapshotWired: true, nowMs: meetingMs + 86400000 });
  const beyondGrace = assessBokPolicyEvidence(currentPolicy, currentCalendar, { snapshotWired: true, nowMs: meetingMs + 20 * 86400000 });
  if (!dayAfter.valid || !dayAfter.warnings.includes('next-meeting-passed-update-needed')
    || beyondGrace.valid || !beyondGrace.reasons.includes('next-meeting-passed-beyond-grace')
    || valid.warnings.length !== 0) {
    throw new Error('P1556 BOK meeting grace window fixtures failed');
  }
  if (!valid.valid
    || valid.ageDays !== 31
    || stale.valid
    || !stale.reasons.includes('as-of-stale')
    || missing.valid
    || !missing.reasons.includes('value-missing-or-invalid')
    || !missing.reasons.includes('as-of-missing-or-invalid')
    || !missing.reasons.includes('data-snapshot-reference-missing')
    || future.valid
    || !future.reasons.includes('as-of-future')
    || unofficial.valid
    || !unofficial.reasons.includes('official-source-contract-invalid')
    || implausible.valid
    || !implausible.reasons.includes('value-missing-or-invalid')
    || !policyRatesEligible(true, valid)
    || policyRatesEligible(true, missing)
    || policyRatesEligible(false, valid)
    || !officialFedCalendarSources(
      { sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm' },
      { sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm' }
    )
    || officialFedCalendarSources(
      { sourceUrl: 'https://federalreserve.gov.evil.example/monetarypolicy/fomccalendars.htm' },
      { sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm' }
    )
    || officialFedStatementDate('https://www.federalreserve.gov/newsevents/pressreleases/monetary20260916a.htm') !== '2026-09-16'
    || officialFedStatementDate('https://www.federalreserve.gov/newsevents/pressreleases/monetary20260826a.htm') === '2026-09-16') {
    throw new Error('P1293/R643 Fed+BOK joint policy evidence fixtures failed');
  }
}

// P1292/R642: future publication timestamps are visible as FUTURE and cannot
// become A1 OK through a forced result or enter structural promotion.
function assertFutureSnapshotFixtures() {
  const fixedNow = Date.parse('2026-09-27T00:00:00.000Z');
  const future = '2026-09-27T00:00:00.001Z';
  if (statusForAt(future, 'daily', 'OK', MARKET_SNAPSHOT_MAX_AGE_DAYS, fixedNow) !== 'FUTURE'
    || statusForAt(future, 'daily', 'BLOCKED', MARKET_SNAPSHOT_MAX_AGE_DAYS, fixedNow) !== 'FUTURE'
    || statusForAt('malformed', 'daily', 'OK', MARKET_SNAPSHOT_MAX_AGE_DAYS, fixedNow) !== 'INVALID'
    || snapshotPromotionReady({ currentCyclePublished: true, publishedAt: future }, fixedNow)
    || snapshotPromotionReady({ currentCyclePublished: true, publishedAt: 'invalid' }, fixedNow)) {
    throw new Error('P1292/R642 + P1297/R647 future/malformed snapshot status fixtures failed');
  }
}

assertSnapshotDiagnosticRedaction();
assertPublishedSnapshotGeneratedAtRequired();
assertSnapshotDiagnosticWorkflowContract();
assertSnapshotDiagnosticWorkflowNegativeControl();
assertRefreshCandidateSelfTestWiring();
assertRefreshCandidateSelfTestWiringNegativeControl();
assertBokPolicyFixtures();
assertFutureSnapshotFixtures();

if (process.argv[2] === '--self-test-snapshot-diagnostics') {
  console.log('P1289/R639/QA-DATA-32, P1299/QA-DATA-42, and P1300/R649/QA-DATA-43 snapshot/candidate workflow fixtures OK');
  process.exit(0);
}

function optionalJson(file) {
  try { return json(file); } catch (_) { return null; }
}

function buildSnapshotDiagnostic() {
  const statusArtifact = optionalJson('public-data/market-snapshot-status.json');
  const snapshotArtifact = optionalJson('public-data/market-snapshot.json');
  const dataArtifact = optionalJson('public-data/data.json');
  const marketFetchOutcome = ['success', 'failure', 'cancelled', 'skipped'].includes(process.env.AIO_MARKET_FETCH_OUTCOME)
    ? process.env.AIO_MARKET_FETCH_OUTCOME
    : 'unknown';
  const recognizedStatus = statusArtifact?.schemaVersion === 'market-snapshot-status-v1';
  const attemptStatus = recognizedStatus && ['published', 'failed'].includes(statusArtifact?.attemptStatus)
    ? statusArtifact.attemptStatus
    : 'unknown';
  const currentCyclePublished = assessPublishedSnapshot({ dataArtifact, snapshotArtifact, statusArtifact }).currentCyclePublished;
  const attemptedRevision = dataArtifact?.meta?.marketSnapshotAttemptRevision;
  const lastKnownGoodRevision = statusArtifact?.lastKnownGoodRevision;
  const ageHours = boundedAgeHours(statusArtifact?.lastSuccessfulAt);
  const snapshotAt = publishedSnapshotAt(snapshotArtifact);
  const snapshotFreshness = classifySnapshotFreshness(snapshotAt);
  const snapshotAgeHours = boundedAgeHours(snapshotAt);
  const statusCoverage = statusArtifact?.coverage || {};
  const snapshotCoverage = snapshotArtifact?.coverage || {};
  const dataCycle = dataArtifact?.meta || {};
  const capture = shouldCaptureSnapshotDiagnostic({ marketFetchOutcome, attemptStatus, currentCyclePublished, snapshotFreshness });

  return {
    schemaVersion: 'market-snapshot-diagnostic-v1',
    diagnosticState: !statusArtifact ? 'status-unavailable' : recognizedStatus ? 'available' : 'status-schema-unrecognized',
    capture,
    marketFetchOutcome,
    attemptStatus,
    currentCyclePublished,
    snapshotFreshness,
    snapshotAgeHours,
    attemptedAt: normalizedIso(statusArtifact?.attemptedAt),
    lastSuccessfulAt: normalizedIso(statusArtifact?.lastSuccessfulAt),
    lastKnownGoodPresent: typeof lastKnownGoodRevision === 'string' && lastKnownGoodRevision.length > 0,
    lastKnownGoodAgeHours: ageHours,
    attemptedRevisionDiffersFromLastKnownGood: typeof attemptedRevision === 'string'
      && typeof lastKnownGoodRevision === 'string'
      ? attemptedRevision !== lastKnownGoodRevision
      : null,
    coverage: {
      tier0Observed: boundedCount(statusCoverage.tier0Observed ?? statusCoverage.observed ?? snapshotCoverage.tier0Observed ?? snapshotCoverage.observed),
      tier0Required: boundedCount(statusCoverage.tier0Required ?? statusCoverage.required ?? snapshotCoverage.tier0Required ?? snapshotCoverage.required)
    },
    snapshotArtifactStatus: ['published', 'failed'].includes(snapshotArtifact?.status) ? snapshotArtifact.status : 'unknown',
    dataCycle: {
      status: ['PUBLISHED', 'DEGRADED', 'PENDING'].includes(dataCycle.cycleStatus) ? dataCycle.cycleStatus : 'unknown',
      marketSnapshotPublished: typeof dataCycle.marketSnapshotPublished === 'boolean' ? dataCycle.marketSnapshotPublished : null,
      componentMarketSnapshotPublished: typeof dataCycle.cycleComponents?.marketSnapshotPublished === 'boolean'
        ? dataCycle.cycleComponents.marketSnapshotPublished
        : null
    },
    errors: summarizeSnapshotErrors(statusArtifact?.errors)
  };
}

if (process.argv[2] === '--write-snapshot-diagnostic') {
  const outputPath = process.argv[3];
  if (!outputPath || !path.isAbsolute(outputPath)) throw new Error('snapshot diagnostic output path must be absolute');
  const diagnostic = buildSnapshotDiagnostic();
  fs.writeFileSync(outputPath, `${JSON.stringify(diagnostic, null, 2)}\n`, { mode: 0o600 });
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `capture=${diagnostic.capture ? 'true' : 'false'}\n`);
  console.log(`Market snapshot diagnostic captured=${diagnostic.capture ? 'true' : 'false'} state=${diagnostic.diagnosticState} errors=${diagnostic.errors.total}`);
  process.exit(0);
}

const now = Date.now();
const data = json('public-data/data.json');
const snapshot = json('public-data/market-snapshot.json');
const snapshotStatus = json('public-data/market-snapshot-status.json');
const screener = json('public-data/screener.json');
const history = json('public-data/history.json');
const dataRuntime = read('js/aio-data.js');
const coreRuntime = (read('js/aio-core.js') + String.fromCharCode(10) + read('js/aio-qa-audits.js')) /* P1329: audits live in the QA bundle */;
const rows = [];

function ageDays(value) {
  return ageDaysAt(value, now);
}

function statusFor(observedAt, cadence, forced = null, maxAgeDays = null) {
  return statusForAt(observedAt, cadence, forced, maxAgeDays, now);
}

function add(id, category, observedAt, cadence, detail, forced = null, maxAgeDays = null) {
  rows.push({ id, category, observedAt: observedAt || null, ageDays: ageDays(observedAt), cadence, status: statusFor(observedAt, cadence, forced, maxAgeDays), detail });
}

// Regression fixture: a failed new attempt must not promote its attempted
// timestamp/revision over the older last-known-good published artifact.
const failedAttemptFixture = assessPublishedSnapshot({
  dataArtifact: { meta: { marketSnapshotRevision: 'attempted-revision', marketSnapshotPublished: false, cycleStatus: 'DEGRADED', cycleComponents: { marketSnapshotPublished: false } } },
  snapshotArtifact: { status: 'published', revision: 'lkg-revision', generatedAt: '2026-09-11T02:36:03.988Z', coverage: { tier0Required: 16, tier0Observed: 16 }, errors: [] },
  statusArtifact: { schemaVersion: 'market-snapshot-status-v1', attemptedAt: '2026-09-12T15:16:10.361Z', attemptStatus: 'failed', lastSuccessfulAt: '2026-09-11T02:36:03.988Z', lastKnownGoodRevision: 'lkg-revision', errors: ['tier0_quality:^KS11:STALE:STALE_UNEXPECTED'] }
});
if (failedAttemptFixture.publishedAt !== '2026-09-11T02:36:03.988Z'
  || failedAttemptFixture.publishedRevision !== 'lkg-revision'
  || failedAttemptFixture.currentCyclePublished) {
  throw new Error('snapshot lineage regression: failed attempt was promoted over the published LKG artifact');
}

// P1069/R591: mirror the runtime publication gate with a fixed fixture. A
// fresh generatedAt plus complete *attempted* coverage is still not eligible
// when the producer reports DEGRADED/marketSnapshotPublished=false.
const cycleFixture = json('architecture/fixtures/data-cycle-freshness.json');
function assessRuntimeCycle(fixture) {
  const coverage = fixture.coverage || {};
  const coverageComplete = Number(coverage.tier0Required) > 0
    && Number(coverage.tier0Observed) === Number(coverage.tier0Required);
  const published = fixture.cycleStatus === 'PUBLISHED'
    && fixture.marketSnapshotPublished === true
    && coverageComplete;
  const generatedMs = Date.parse(fixture.generatedAt || '');
  const nowMs = Date.parse(fixture.now || '');
  const fresh = Number.isFinite(generatedMs) && Number.isFinite(nowMs)
    && nowMs >= generatedMs && nowMs - generatedMs <= 12 * 60 * 60 * 1000;
  return {
    marketCyclePublished: published,
    liveCoreEligible: published && fresh,
    snapshotClockAdvances: published && fresh
  };
}
for (const name of ['failedAttempt', 'publishedCycle', 'futurePublishedCycle', 'extendedMetadataSlaCycle', 'exactTwelveHourBoundary']) {
  const assessed = assessRuntimeCycle(cycleFixture[name]);
  const expected = cycleFixture[name].expected;
  if (assessed.marketCyclePublished !== expected.marketCyclePublished
    || assessed.liveCoreEligible !== expected.liveCoreEligible
    || assessed.snapshotClockAdvances !== expected.snapshotClockAdvances) {
    throw new Error(`runtime cycle fixture mismatch (${name}): ${JSON.stringify(assessed)}`);
  }
}
{
  const assessed = assessRuntimeCycle(cycleFixture.staleWeekendCycle);
  const expected = cycleFixture.staleWeekendCycle.expected;
  if (assessed.marketCyclePublished !== expected.marketCyclePublished
    || assessed.liveCoreEligible !== expected.liveCoreEligible
    || assessed.snapshotClockAdvances !== expected.snapshotClockAdvances) {
    throw new Error(`runtime cycle fixture mismatch (staleWeekendCycle): ${JSON.stringify(assessed)}`);
  }
}
if (!/var _marketCyclePublished = d\.meta\.cycleStatus === 'PUBLISHED'[\s\S]{0,180}d\.meta\.marketSnapshotPublished === true[\s\S]{0,100}_marketCoverageComplete/.test(dataRuntime)
  || !/if \(_liveCoreEligible && \(!isFinite\(_existingSnapshotMs\)/.test(dataRuntime)) {
  throw new Error('runtime cycle regression: loader publication/clock gate is missing');
}

const quote = (symbol) => (snapshot.quotes || []).find((row) => row.instrumentId === symbol) || null;
const macro = data.macro || {};
const snapshotAudit = assessPublishedSnapshot({ dataArtifact: data, snapshotArtifact: snapshot, statusArtifact: snapshotStatus });
const snapshotReadyForPromotion = snapshotPromotionReady(snapshotAudit, now);

// The 22 durable categories defined by the data-refresh contract. A1 uses the
// published artifact's generatedAt/revision; data.meta values describe the
// latest refresh attempt and must not renew an older LKG snapshot.
// P1290/R640: closed-session quotes never waive the generated artifact's 12h age budget.
add('A1', 'DATA_SNAPSHOT / durable market artifact', snapshotAudit.publishedAt, 'daily', `revision=${snapshotAudit.publishedRevision || '—'} attemptedRevision=${snapshotAudit.attemptedRevision || '—'} attempt=${snapshotAudit.attemptStatus}; SLA=12h`, null, MARKET_SNAPSHOT_MAX_AGE_DAYS);
add('A2', 'Fear & Greed', data.fearGreed?.asOf || data.meta?.generatedAt, 'daily', `score=${data.fearGreed?.score ?? '—'} source=${data.fearGreed?._source || 'unknown'}`);
add('A3', 'VIX + HY OAS shared evidence', quote('^VIX')?.observedAt || macro._asOf_hyOAS, 'daily', `vix=${quote('^VIX')?.value ?? '—'} hyOAS=${macro.hyOAS ?? '—'} hyAsOf=${macro._asOf_hyOAS || '—'}; session=${quote('^VIX')?.session || 'missing'}`, ageDays(macro._asOf_hyOAS) != null && ageDays(macro._asOf_hyOAS) > 3 ? 'STALE' : null);
const surveys = data.marketSurveys || {};
const aaii = surveys.aaii || {};
const aaiiComplete = aaii.status === 'current-reference'
  && ['bullish', 'neutral', 'bearish'].every((field) => Number.isFinite(Number(aaii[field])));
add('B1', 'AAII sentiment', aaii.observedAt, 'weekly', aaiiComplete
  ? `bull=${aaii.bullish}% neutral=${aaii.neutral}% bear=${aaii.bearish}% source=${aaii.source || 'AAII'}; public current observation, reference-only`
  : 'BLOCKED: no complete current official public observation; exact percentage synthesis forbidden', aaiiComplete ? null : 'BLOCKED', 9);
const naaim = surveys.naaim || {};
add('B2', 'NAAIM exposure', naaim.observedAt, 'weekly', `BLOCKED_CURRENT: latest/API access is subscription-based; retained public reference=${naaim.exposure ?? '—'} observed=${naaim.observedAt || '—'} and must not be relabeled current`, 'BLOCKED');
add('B3', 'Investor Intelligence bull/bear', null, 'weekly', 'BLOCKED: current publisher numeric values require subscriber access; no extrapolated value promoted', 'BLOCKED');
add('B4', 'Put/Call ratio', data.putCall?.asOf || data.meta?.putCallAsOf, 'daily', `total=${data.putCall?.totalPutCall ?? '—'} equity=${data.putCall?.equityPutCall ?? '—'} source=${data.putCall?._source || 'Cboe Daily Market Statistics'}`, Number.isFinite(Number(data.putCall?.totalPutCall)) ? null : 'SKIPPED');
add('C1', 'US breadth / labels', screener.breadth?.segments?.us?.observedAt || screener.factorObservedAt, 'daily', `coverage=${screener.breadth?.segments?.us?.coveragePct ?? '—'}%`);
add('C2', 'NDX breadth', screener.breadth?.segments?.us?.observedAt || screener.factorObservedAt, 'daily', 'uses AIO universe contract; official exchange breadth remains separate');
const aioBreadthHistory = history.filter((row) => Number.isFinite(Number(row?.breadth50)) && row?.breadth50 != null);
const latestAioBreadthHistory = aioBreadthHistory[aioBreadthHistory.length - 1] || null;
add('C3', 'AIO breadth history / official McClellan boundary', latestAioBreadthHistory?.fieldMeta?.breadth50?.observedAt || latestAioBreadthHistory?.date, 'daily', aioBreadthHistory.length >= 60 ? `AIO-universe history=${aioBreadthHistory.length} rows; official exchange A/D and McClellan remain unavailable` : 'SKIPPED: AIO history producer has not completed 60 rows; official A/D remains unavailable', aioBreadthHistory.length >= 60 ? null : 'SKIPPED');
add('C4', 'Weinstein stage', screener.factorObservedAt || snapshot.generatedAt, 'daily', 'DYNAMIC: computed from selected runtime OHLCV/30-week evidence; not an external refresh category', 'DYNAMIC');
add('D1', 'HY OAS', macro._asOf_hyOAS || quote('HYG')?.observedAt, 'daily', `value=${macro.hyOAS ?? '—'} observed=${macro._asOf_hyOAS || '—'}; FRED/ICE publication-lag budget=3d; stale points remain reference-only`, Number.isFinite(Number(macro.hyOAS)) ? null : 'SKIPPED', 3);
add('D2', 'Treasury yield fallback', quote('^TNX')?.observedAt, 'daily', `10Y=${quote('^TNX')?.value ?? '—'} session=${quote('^TNX')?.session || 'missing'}`);
add(
  'D3',
  '10Y-2Y spread',
  macro._asOf_t10y2y,
  'daily',
  Number.isFinite(Number(macro.t10y2y))
    ? `value=${macro.t10y2y}%p source=${macro._source_t10y2y || 'unknown'}; official observation date retained`
    : 'SKIPPED: official spread is unavailable; do not infer from a single 10Y quote',
  Number.isFinite(Number(macro.t10y2y)) ? null : 'SKIPPED'
);
const officialMacroFetchAt = data.meta?.blsLastSuccessfulAt || data.meta?.generatedAt;
const bea = macro._bea || {};
const pceReleaseAt = bea.releasedAt || data.meta?.beaReleaseAt || null;
const pceForced = bea.status === 'ok' && macro._source_pce === 'bea-official-primary'
  ? null
  : (pceReleaseAt && ageDays(pceReleaseAt) <= 35 ? 'CRITICAL' : 'SKIPPED');
add('E1', 'CPI / PCE', pceReleaseAt, 'monthly', `CPI=${macro.cpi ?? '—'} (obs ${macro._asOf_cpi || '—'}) PCE=${macro.pce ?? '—'} (obs ${macro._asOf_pce || '—'}) corePCE=${macro.corePce ?? '—'} BEA=${bea.status || 'unavailable'} source=${macro._source_pce || macro._source || 'unknown'}`, pceForced);
add('E2', 'Employment / wages / retail / housing', officialMacroFetchAt, 'monthly', `unemployment=${macro.unemployment ?? '—'} wage=${macro.usWageGrowth ?? '—'}; observation period is retained separately from fetch freshness`);
// P1275: derive the audit from the user-visible FOMC registry. A copied July
// date made E3/E4 report STALE after the September decision was already shown.
const eventStart = coreRuntime.indexOf('window.AIO_EVENT_FRESHNESS_REGISTRY = {');
const eventEnd = coreRuntime.indexOf('\n};', eventStart);
let fomc = null;
if (eventStart >= 0 && eventEnd > eventStart) {
  const sandbox = { window: {} };
  runInNewContext(coreRuntime.slice(eventStart, eventEnd + 3), sandbox, { timeout: 1000 });
  fomc = sandbox.window.AIO_EVENT_FRESHNESS_REGISTRY?.fomc || null;
}
const calendarFomc = coreRuntime.match(/'us-fomc':\s*\{[^}]*lastRelease:\s*'([^']+)'\s*,\s*nextRelease:\s*'([^']+)'[^}]*?sourceUrl:\s*'([^']+)'/);
const calendarRate = coreRuntime.match(/'us-fed-rate':\s*\{[^}]*lastRelease:\s*'([^']+)'\s*,\s*nextRelease:\s*'([^']+)'[^}]*?sourceUrl:\s*'([^']+)'/);
const calendarBokMatch = coreRuntime.match(/'kr-bok':\s*\{[^}]*lastRelease:\s*'([^']+)'\s*,\s*nextRelease:\s*'([^']+)'[^}]*sourceUrl:\s*'([^']+)'/);
const calendarBok = calendarBokMatch
  ? { lastRelease: calendarBokMatch[1], nextRelease: calendarBokMatch[2], sourceUrl: calendarBokMatch[3] }
  : null;
const manualReference = extractManualReference(coreRuntime);
const bokPolicy = manualReference?.bokPolicy || null;
const bokPolicyEvidence = assessBokPolicyEvidence(bokPolicy, calendarBok, {
  snapshotWired: hasBokSnapshotWiring(coreRuntime),
  nowMs: now
});
const fomcSourceDate = officialFedStatementDate(fomc?.sourceUrl);
const fomcSourceOfficial = fomcSourceDate != null;
const fomcRegistryAligned = Boolean(fomc?.eventDate && fomc?.policyRange && fomc?.result?.includes(fomc.policyRange)
  && fomcSourceOfficial && fomcSourceDate === fomc.eventDate && calendarFomc?.[1] === fomc.eventDate && calendarRate?.[1] === fomc.eventDate
  && calendarFomc?.[2] === calendarRate?.[2]
  && officialFedCalendarSources({ sourceUrl: calendarFomc?.[3] }, { sourceUrl: calendarRate?.[3] })
  && Date.parse(calendarFomc?.[2]) > Date.parse(fomc.eventDate));
const nextMeeting = fomcRegistryAligned ? calendarFomc[2] : null;
const eventBudgetDays = nextMeeting ? (Date.parse(nextMeeting) - Date.parse(fomc.eventDate)) / 86400000 + 1 : null;
const policyRatesValid = policyRatesEligible(fomcRegistryAligned, bokPolicyEvidence);
const policyObservationDates = [fomc?.eventDate, bokPolicyEvidence.asOf]
  .filter((date) => utcDateMs(date) != null)
  .sort((left, right) => utcDateMs(left) - utcDateMs(right));
const policyObservedAt = policyObservationDates[0] || null;
add('E3', 'FOMC calendar', fomcRegistryAligned ? fomc.eventDate : null, 'event-driven',
  fomcRegistryAligned ? `official result=${fomc.sourceUrl}; next meeting=${nextMeeting}` : 'BLOCKED: visible event and release calendar are not aligned with an official source',
  fomcRegistryAligned ? null : 'BLOCKED', eventBudgetDays);
add('E4', 'Fed + BOK policy rates', policyObservedAt, 'event-driven',
  `Fed=${fomc?.policyRange || '—'} (asOf=${fomc?.eventDate || '—'}, ${fomcRegistryAligned ? 'official-source metadata aligned; page body not fetched' : 'blocked'}); BOK=${bokPolicy?.value ?? '—'}% (asOf=${bokPolicyEvidence.asOf || '—'}, ${bokPolicyEvidence.valid ? 'official-source metadata/currentness contract passed; page body not fetched' : `blocked:${bokPolicyEvidence.reasons.join(',') || 'invalid'}`})`,
  policyRatesValid ? null : 'BLOCKED', BOK_POLICY_MAX_AGE_DAYS);
add('F1', '24h news / HOME_WEEKLY_NEWS', data.meta?.generatedAt, 'daily', `count=${data.meta?.newsCount ?? data.news?.length ?? 0} cycle=${data.meta?.newsCyclePolicy || 'unknown'}`);
add('G1', 'Commodities / FX', quote('CL=F')?.observedAt || quote('DX-Y.NYB')?.observedAt, 'daily', `WTI=${quote('CL=F')?.value ?? '—'} DXY=${quote('DX-Y.NYB')?.value ?? '—'}`);
add('G2', 'Global indices', quote('^GSPC')?.observedAt, 'daily', `SPX=${quote('^GSPC')?.value ?? '—'}; global non-tier history remains reference-only`);
add('G3', 'Crypto', quote('BTC-USD')?.observedAt, 'daily', `BTC=${quote('BTC-USD')?.value ?? '—'} ETH=${quote('ETH-USD')?.value ?? '—'}`);

const sourceChecks = {
  // P1134/R620: these KR functions and the catalyst meta block moved from index.html's inline
  // block C to js/aio-kr-data.js — the audit must read the file that now owns them.
  fetchKrSupplyData: /fetchKrSupplyData/.test(read('js/aio-kr-data.js')),
  fetchKrNaverQuotes: /fetchKrNaverQuotes/.test(read('js/aio-kr-data.js')),
  renderKrThemePerfBars: /renderKrThemePerfBars/.test(read('js/aio-kr-data.js')),
  themeCatalystRetired: /KR_THEME_CATALYSTS_META[\s\S]{0,120}status:'unavailable'/.test(read('js/aio-kr-data.js'))
};
const unknownSessions = (snapshot.quotes || []).filter((row) => !row.session || row.session === 'UNKNOWN');
const dynamicOk = Object.values(sourceChecks).every(Boolean);
const auditState = Object.fromEntries(rows.map((row) => [row.id, row.status]));
const policyStateOk = auditState.B1 === 'OK'
  && auditState.B2 === 'BLOCKED'
  && auditState.B3 === 'BLOCKED'
  && auditState.C4 === 'DYNAMIC';
const structuralOk = rows.length === 22 && snapshotReadyForPromotion && auditState.A1 === 'OK' && Number(snapshot.coverage?.observed) >= Number(snapshot.coverage?.required) && unknownSessions.length === 0 && policyStateOk
  && fomcRegistryAligned && bokPolicyEvidence.valid && auditState.E3 === 'OK' && auditState.E4 === 'OK';

console.log('| # | Category | Observed | Age(d) | Cadence | Status | Detail |');
console.log('|---|---|---|---:|---|---|---|');
for (const row of rows) console.log(`| ${row.id} | ${row.category} | ${row.observedAt || '—'} | ${row.ageDays == null ? '—' : row.ageDays.toFixed(2)} | ${row.cadence} | ${row.status} | ${row.detail} |`);
console.log(`H-dynamic | ${dynamicOk ? 'PASS' : 'FAIL'} | ${JSON.stringify(sourceChecks)}`);
if (bokPolicyEvidence.warnings.length) console.log(`WARN | BOK policy: ${bokPolicyEvidence.warnings.join(', ')} — record the latest decision in AIO_MANUAL_REFERENCE.bokPolicy (value, status, asOf, next) and the us-/kr- calendar entry within ${BOK_MEETING_GRACE_DAYS} days of the meeting.`);
// P1276: retain useful rejected-row context while keeping provider-derived error text bounded and redacted.
const snapshotErrorSummary = summarizeSnapshotErrors(snapshotStatus.errors);
console.log(`D1-structural | ${structuralOk ? 'yes' : 'no'} | rows=${rows.length} unknownSessions=${unknownSessions.length} tier0=${snapshot.coverage?.observed}/${snapshot.coverage?.required} snapshotFreshness=${classifySnapshotFreshness(snapshotAudit.publishedAt, now)} attempt=${snapshotStatus.attemptStatus || 'unknown'} snapshotErrors=${JSON.stringify(snapshotErrorSummary)} policyStates=${JSON.stringify({ A1: auditState.A1, B1: auditState.B1, B2: auditState.B2, B3: auditState.B3, C4: auditState.C4, E3: auditState.E3, E4: auditState.E4 })}`);

if (!structuralOk || !dynamicOk) process.exit(1);
