import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const exists = (path) => existsSync(join(root, path));

const errors = [];
const warnings = [];
const check = (label, condition, detail = '') => {
  if (!condition) errors.push(label + (detail ? ': ' + detail : ''));
};

const version = JSON.parse(read('version.json')).version;
const html = read('index.html');
const core = read('js/aio-core.js');
const tests = read('js/aio-tests.js');
const runtimeGate = read('scripts/ci-runtime-contract-check.mjs');
const rules = read('_context/RULES.md');
const qa = read('_context/QA-CHECKLIST.md');
const postmortem = read('_context/BUG-POSTMORTEM.md');
const changelog = read('CHANGELOG.md');

const auditDefPattern = /(?:window\.AIO\.)?(?:get|assert)[A-Za-z0-9_]*(?:Audit|Readiness)\s*=\s*function|function\s+(?:get|assert)[A-Za-z0-9_]*(?:Audit|Readiness)/g;
const auditDefs = (core.match(auditDefPattern) || []).length;
const assertLabels = [...tests.matchAll(/_assert\('([^']+)/g)].map((m) => m[1]);
const auditLikeLabels = assertLabels.filter((label) => /(audit|Audit|gate|contract|readiness|coverage|감사|게이트|계약)/.test(label));
const shapeOnlyLabels = auditLikeLabels.filter((label) => /(defined|정의|exists|존재|shape|structure|coveragePct|coverage|DOM 존재|row DOM|function|호출 가능|available)/.test(label));

const report = {
  version,
  auditDefs,
  totalAssertLabels: assertLabels.length,
  auditLikeAssertLabels: auditLikeLabels.length,
  shapeOrCoverageAuditLabels: shapeOnlyLabels.length,
  sampleShapeOrCoverageLabels: shapeOnlyLabels.slice(0, 16)
};

check('semantic review script exists', exists('scripts/ci-semantic-review-check.mjs'));
check('audit inventory is measurable', auditDefs >= 50 && auditLikeLabels.length >= 100 && shapeOnlyLabels.length >= 50, JSON.stringify(report));
check('R219 semantic review rule exists', /R219/.test(rules) && /Audit\/gate is not semantic review/.test(rules));
check('P513 semantic QA checklist exists', /P513-Q1/.test(qa) && /ci-semantic-review-check\.mjs/.test(qa));
check('P513 postmortem exists', /P513/.test(postmortem) && /audit-only/.test(postmortem) && /semantic review/.test(postmortem));
check('v50.89 changelog records semantic review gate', /## v50\.89/.test(changelog) && /semantic review/.test(changelog));
check('runtime contract gate references semantic review', /ci-semantic-review-check\.mjs/.test(runtimeGate) && /semantic review/.test(runtimeGate));

check('trading score semantic gate is present', /computeTradingScore returns both total and score/.test(runtimeGate) && /return\s*\{\s*total\s*,\s*score\s*:\s*total/.test(html));
check('breadth neutral fallback semantic gate is present', /optimistic breadth default 75/.test(runtimeGate) && !/breadth200[\s\S]{0,220}:\s*75\)/.test(html));
check('ticker entry verdict semantic gate is present', /ticker deep analysis gates entry verdict/.test(runtimeGate) && /computeTradingScore\('swing'\)/.test(html) && /marketAllowsEntry/.test(html));
check('current event-risk semantic gate is present', /event risk context is refreshed/.test(runtimeGate) && /asOf:\s*'2026-06-19'/.test(core));

const r219Path = /user request\/intent -> affected function\(s\) and criteria[\s\S]*affected function\(s\) -> downstream consumer\(s\)[\s\S]*downstream consumer\(s\) -> visible page\/chat\/report output[\s\S]*visible output -> market\/domain meaning/.test(rules);
check('R219 defines the full semantic path', r219Path);

if (errors.length) {
  console.error('Semantic review check failed:');
  errors.forEach((error) => console.error(' - ' + error));
  console.error('Inventory:');
  console.error(JSON.stringify(report, null, 2));
  if (warnings.length) {
    console.error('Warnings:');
    warnings.forEach((warning) => console.error(' - ' + warning));
  }
  process.exit(1);
}

console.log(`Semantic review check OK: ${version}, audit defs ${auditDefs}, audit-like asserts ${auditLikeLabels.length}, shape/coverage audit asserts ${shapeOnlyLabels.length}.`);
console.log('Semantic review backlog sample:');
shapeOnlyLabels.slice(0, 8).forEach((label) => console.log(' - ' + label));
if (warnings.length) warnings.forEach((warning) => console.warn('WARN: ' + warning));
