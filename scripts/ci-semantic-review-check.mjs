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
const core = (read('js/aio-core.js') + String.fromCharCode(10) + read('js/aio-qa-audits.js')) /* P1329: audits live in the QA bundle */;
// P1132/R619: the ticker deep-analysis entry-verdict gate moved from index.html's block F to js/aio-ui.js.
const ui = read('js/aio-ui.js');
const tests = read('js/aio-tests.js');
const runtimeGate = read('scripts/ci-runtime-contract-check.mjs');
const tradingScoreDomain = read('src/domain/signal/trading-score.js');
// v57.54: the R219/P513/P513-Q1/v50.89 prose-marker checks that used to read RULES.md, QA-CHECKLIST.md,
// BUG-POSTMORTEM.md and CHANGELOG.md are replaced by architecture/governance-markers.json (policy
// "semantic-review"), verified by ci-workflow-compaction-check.mjs. This gate checks code and evidence only.
const coveragePath = '_artifacts/exhaustive-audit-20260831/coverage-summary.json';
let coverage = null;
try { coverage = JSON.parse(read(coveragePath)); } catch (_) {}
const currentCoveragePct = coverage && Number.isFinite(coverage.codeConfigCurrentLines) && coverage.codeConfigCurrentLines > 0
  ? (Number(coverage.currentSemanticallyReviewedLines || 0) / coverage.codeConfigCurrentLines) * 100 : null;
const historyCoveragePct = coverage && Number.isFinite(coverage.codeHistoryTransitions) && coverage.codeHistoryTransitions > 0
  ? (Number(coverage.historyReviewedTransitions || 0) / coverage.codeHistoryTransitions) * 100 : null;

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
  sampleShapeOrCoverageLabels: shapeOnlyLabels.slice(0, 16),
  semanticCoverage: {
    artifact: coveragePath,
    currentLines: coverage?.codeConfigCurrentLines ?? null,
    reviewedCurrentLines: coverage?.currentSemanticallyReviewedLines ?? null,
    currentCoveragePct,
    historyTransitions: coverage?.codeHistoryTransitions ?? null,
    reviewedHistoryTransitions: coverage?.historyReviewedTransitions ?? null,
    historyCoveragePct,
    releaseCertified: coverage?.releaseCertified === true,
    status: coverage?.releaseCertified === true ? 'CERTIFIED' : 'OPEN'
  }
};

check('semantic review script exists', exists('scripts/ci-semantic-review-check.mjs'));
// v57.84: the inventory is a report, not a floor. The old `shapeOnlyLabels >= 50` floor made deleting a shallow
// shape-only assertion fail CI, so the gate rewarded keeping the very tests it called a backlog.
check('audit inventory is measurable', assertLabels.length > 0, JSON.stringify(report));
check('runtime contract gate references semantic review', /ci-semantic-review-check\.mjs/.test(runtimeGate) && /semantic review/.test(runtimeGate));
// v57.84: certification was impossible by construction (`releaseCertified === false` was required). It may now
// be true only with a named reviewer, a date, an evidence path, and full current-line coverage.
const certificationValid = coverage?.releaseCertified === false
  || (coverage?.releaseCertified === true && typeof coverage.certifiedAt === 'string' && /^\d{4}-\d{2}-\d{2}/.test(coverage.certifiedAt)
    && typeof coverage.certifiedBy === 'string' && coverage.certifiedBy.trim() && typeof coverage.certificationEvidence === 'string'
    && exists(coverage.certificationEvidence) && currentCoveragePct >= 100);
check('line-level semantic coverage ledger exists and stays fail-closed until certified',
  !!coverage
  && certificationValid
  && Number.isFinite(currentCoveragePct) && currentCoveragePct >= 0 && currentCoveragePct <= 100
  && Number.isFinite(historyCoveragePct) && historyCoveragePct >= 0 && historyCoveragePct <= 100
  && Number(coverage.currentSemanticallyReviewedLines || 0) <= Number(coverage.codeConfigCurrentLines || 0)
  && Number(coverage.historyReviewedTransitions || 0) <= Number(coverage.codeHistoryTransitions || 0),
  JSON.stringify(report.semanticCoverage));
warnings.push(`SEMANTIC_REVIEW_OPEN current=${currentCoveragePct === null ? 'unknown' : currentCoveragePct.toFixed(2)}% (${coverage?.currentSemanticallyReviewedLines || 0}/${coverage?.codeConfigCurrentLines || 0} lines), history=${historyCoveragePct === null ? 'unknown' : historyCoveragePct.toFixed(2)}% (${coverage?.historyReviewedTransitions || 0}/${coverage?.codeHistoryTransitions || 0} transitions); structural/audit PASS is not semantic certification.`);

// P553: aligned with the same relaxation in ci-runtime-contract-check.mjs — the object literal
// no longer has to be the literal return expression (computeTradingScore builds it into a
// variable first so the result can be cached), only the `{ total, score: total` shape must exist.
// v51.98/Phase 3 [A3]: computeTradingScore/classifyMarketRegime moved from index.html inline to
// js/aio-core.js (P594) — these now search `core`, not `html`. The breadth200 check is additionally
// scoped to classifyMarketRegime's own body (not a free-floating search across all of `core`,
// which is large enough to contain an unrelated coincidental "breadth200...: 75)" match elsewhere).
// RM-03 (2026-07-19): the alias-producing literal moved into
// src/domain/signal/trading-score.js's computeTradingScoreModel (single-implementation
// extraction) — checks the domain module (where the shape now genuinely lives) plus proof the
// legacy wrapper in `core` actually delegates to it.
check('trading score semantic gate is present', /computeTradingScore returns both total and score/.test(runtimeGate) && /AIO_ARCH\.computeTradingScoreModel/.test(core) && /\{\s*total\s*,\s*score\s*:\s*total/.test(tradingScoreDomain));
// The legacy classifyMarketRegime was retired as dead code; the runtime gate now asserts it stays gone.
check('P1753 breadth neutral fallback semantic gate is present', /optimistic breadth default 75/.test(runtimeGate) && !/function\s+classifyMarketRegime\b/.test(core));
check('P1753 P1538 ticker deep analysis is retired and issues no entry verdict', /retired ticker deep analysis stays gone and issues no entry verdict/.test(runtimeGate) && !/function\s+analyzeTickerDeep\b/.test(ui) && !/marketAllowsEntry/.test(ui));
check('event-risk semantic gate fails closed without an embedded point-in-time timeline', /event risk context fails closed/.test(runtimeGate) && /AIO_EVENT_RISK_CONTEXT/.test(core) && /available:\s*false/.test(core) && /asOf:\s*null/.test(core) && /timeline:\s*\[\]/.test(core));

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
console.log(`SEMANTIC_REVIEW_OPEN current=${currentCoveragePct === null ? 'unknown' : currentCoveragePct.toFixed(2)}% history=${historyCoveragePct === null ? 'unknown' : historyCoveragePct.toFixed(2)}% releaseCertified=${coverage?.releaseCertified === true ? 'true' : 'false'}`);
console.log('Semantic review backlog sample:');
shapeOnlyLabels.slice(0, 8).forEach((label) => console.log(' - ' + label));
if (warnings.length) warnings.forEach((warning) => console.warn('WARN: ' + warning));
