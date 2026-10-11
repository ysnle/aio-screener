import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROUTE_HUBS, hubForRoute } from '../../src/ui/navigation/route-hubs.js';
export const evidenceDigest = (value) => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const hash = (value) => /^[a-f0-9]{64}$/.test(value || '');
const statuses = new Set(['observed', 'blocked', 'failed', 'unverified', 'excluded']);
const modes = new Set(['headless-fixture', 'headless-local', 'browser-local', 'browser-live']);
const safePath = (path) => typeof path === 'string' && path && !isAbsolute(path) && !/^[a-z]+:/i.test(path) && !path.replaceAll('\\', '/').split('/').includes('..');

export function browserEvidenceTarget(root) {
  const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' }).stdout?.trim() || '';
  const files = [...new Set(git(['ls-files', '--cached', '--others', '--exclude-standard']).split(/\r?\n/))]
    .filter((file) => /^(src\/|js\/|scripts\/|architecture\/|public-data\/|index.html$|sw.js$|version.json$|public-config.json$)/.test(file) && existsSync(resolve(root, file))).sort();
  return { gitHead: git(['rev-parse', 'HEAD']), version: JSON.parse(readFileSync(resolve(root, 'version.json'), 'utf8')).version,
    contentDigest: evidenceDigest(files.map((file) => [file, evidenceDigest(readFileSync(resolve(root, file)))])),
    digestScope: 'src, js, scripts, architecture, public-data, index.html, sw.js, version.json, public-config.json' };
}

export function createBrowserEvidence({ root, runId, providerVersion, environment, fixture, operation }) {
  return { schemaVersion: 'aio-browser-evidence.v1', runId, observedAt: new Date().toISOString(), target: browserEvidenceTarget(root),
    provider: { name: 'playwright', version: providerVersion, operation },
    environment: { ...environment, fixtureDigest: evidenceDigest(fixture) },
    normalization: { policyId: 'none', policyHash: evidenceDigest({ policyId: 'none', rules: [] }), rules: [] },
    coverage: ROUTE_HUBS.map((hub) => ({ screenId: hub.id, route: hub.routes[0].id, stateId: 'representative', status: 'unverified', reason: '이번 시나리오에서 관찰하지 않음', stepIds: [] })),
    steps: [], semanticReview: { status: 'unverified', reason: '자동 브라우저 관찰은 한국어 의미·미적 품질·운영 공급자를 인증하지 않음' },
    limitations: ['로컬 격리 fixture 관찰. 실제 사용자 계정·보유정보·외부 API는 사용하지 않음'] };
}

export function addBrowserEvidenceStep(report, step) {
  report.steps.push(step);
  const hub = hubForRoute(step.route);
  if (!hub || hub.id !== step.screenId) throw Error('Unknown route/screen');
  let coverage = report.coverage.find((row) => row.screenId === hub.id && row.stateId === step.stateId);
  if (!coverage) { coverage = { screenId: hub.id, route: step.route, stateId: step.stateId, status: step.status, reason: step.reason || '', stepIds: [] }; report.coverage.push(coverage); }
  coverage.stepIds.push(step.stepId);
  coverage.status = step.status;
  if (step.reason) coverage.reason = step.reason;
}

export function validateBrowserEvidence(report, { secrets = [] } = {}) {
  const errors = [];
  if (report?.schemaVersion !== 'aio-browser-evidence.v1') return ['P1603: wrong evidence schema'];
  if (!report.runId || !Number.isFinite(Date.parse(report.observedAt)) || !hash(report.target?.contentDigest) || !report.target?.gitHead || !report.target?.version || !report.target?.digestScope) errors.push('P1603: incomplete target identity');
  if (!report.provider?.name || !report.provider?.version || !report.provider?.operation) errors.push('P1603: missing provider operation/version');
  if (!modes.has(report.environment?.mode) || !hash(report.environment?.fixtureDigest) || !report.environment?.initialStateId || !report.environment?.viewport || !report.environment?.timezone || !report.environment?.networkPolicy) errors.push('P1603: incomplete environment');
  if (report.normalization?.policyId !== 'none' || report.normalization?.rules?.length !== 0 || report.normalization?.policyHash !== evidenceDigest({ policyId: 'none', rules: [] })) errors.push('P1603: unsupported normalization policy');
  if (!Array.isArray(report.steps) || !Array.isArray(report.coverage)) return [...errors, 'P1603: missing step/coverage arrays'];
  const ids = new Set();
  for (const step of report.steps) {
    if (!step.stepId || ids.has(step.stepId)) errors.push('P1603: missing/duplicate step id');
    ids.add(step.stepId);
    if (hubForRoute(step.route)?.id !== step.screenId || !step.stateId || !step.initialCondition || !step.action?.type || !step.action?.target || !step.readyCondition) errors.push(`P1603: incomplete step ${step.stepId}`);
    if (!statuses.has(step.status) || (step.status !== 'observed' && !step.reason)) errors.push(`P1603: unexplained coverage ${step.stepId}`);
    if (step.status === 'observed') {
      const selected = step.captureSelection || [];
      if (step.readyObserved !== true || !selected.length || !Array.isArray(step.evidence) || !step.expected || !step.actual || step.authority !== report.environment.mode) errors.push(`P1603: unready/unproven observation ${step.stepId}`);
      for (const kind of selected) if (!['dom', 'accessibility', 'screenshot'].includes(kind) || !step.evidence?.some((e) => e.kind === kind && hash(e.digest))) errors.push(`P1603: missing selected capture ${step.stepId}`);
      if (step.claimType === 'layout' && !selected.includes('screenshot')) errors.push(`P1603: layout requires screenshot ${step.stepId}`);
      if (step.claimType === 'text' && !selected.some((kind) => ['dom', 'accessibility'].includes(kind))) errors.push(`P1603: text requires DOM/accessibility ${step.stepId}`);
    }
    for (const item of step.evidence || []) if (item.path && !safePath(item.path)) errors.push(`P1603: unsafe evidence path ${step.stepId}`);
    if (!Array.isArray(step.limitations)) errors.push(`P1603: missing step limitations ${step.stepId}`);
  }
  for (const row of report.coverage) {
    if (hubForRoute(row.route)?.id !== row.screenId || !statuses.has(row.status) || (row.status !== 'observed' && !row.reason) || !Array.isArray(row.stepIds) || row.stepIds.some((id) => !ids.has(id))) errors.push('P1603: invalid coverage reference');
    if (row.status === 'observed' && (!row.stepIds.length || row.stepIds.some((id) => report.steps.find((step) => step.stepId === id)?.status !== 'observed'))) errors.push('P1603: coverage cannot promote incomplete steps');
  }
  if (ROUTE_HUBS.some((hub) => !report.coverage.some((row) => row.screenId === hub.id))) errors.push('P1603: omitted screen coverage');
  if (report.semanticReview?.status !== 'unverified' || !report.semanticReview?.reason || !Array.isArray(report.limitations)) errors.push('P1603: automatic semantic promotion forbidden');
  const raw = JSON.stringify(report);
  if (secrets.filter((secret) => secret?.length >= 4).some((secret) => raw.includes(secret))) errors.push('P1603: declared secret in evidence');
  const scan = (value) => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (/^(cookies?|headers?|tokens?|authorization|rawBody|requestBody|responseBody|holdings|shares|avgCost|account)$/i.test(key)) errors.push('P1603: raw sensitive fields forbidden');
      if (typeof child === 'string' && /https?:\/\/[^/\s]+@/.test(child)) errors.push('P1603: URL credentials forbidden');
      scan(child);
    }
  };
  scan(report);
  return errors;
}

export function compareBrowserEvidence(before, after) {
  const invalid = validateBrowserEvidence(before).length || validateBrowserEvidence(after).length;
  const ids = new Set([...(before.steps || []), ...(after.steps || [])].map((step) => step.stepId));
  return [...ids].map((stepId) => {
    const a = before.steps?.find((step) => step.stepId === stepId), b = after.steps?.find((step) => step.stepId === stepId);
    let reason = invalid ? 'invalid-evidence' : !a || !b ? 'missing-step' : a.status !== 'observed' || b.status !== 'observed' ? 'incomplete-observation' : null;
    if (!reason && JSON.stringify([before.provider, before.environment, before.normalization, a.route, a.stateId, a.entity, a.claimType, a.initialCondition, a.action, a.readyCondition, a.captureSelection]) !== JSON.stringify([after.provider, after.environment, after.normalization, b.route, b.stateId, b.entity, b.claimType, b.initialCondition, b.action, b.readyCondition, b.captureSelection])) reason = 'incompatible-scenario';
    return { stepId, status: reason ? 'unknown' : evidenceDigest(a.evidence.map((row) => [row.kind, row.digest])) === evidenceDigest(b.evidence.map((row) => [row.kind, row.digest])) ? 'equal' : 'changed', reason };
  });
}
