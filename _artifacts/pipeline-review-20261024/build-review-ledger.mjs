// Audit metadata only. No content from ignored/private files is read.
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const paths = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).split('\0').filter(Boolean))].sort();
const direct = new Map([
  ['scripts/fetch-sec-fundamentals.mjs', 'FULL_CUMULATIVE'],
  ['scripts/build-sec-runtime-projection.mjs', 'FULL_PRIOR_TURN'],
  ['scripts/lib/candidate-archive.mjs', 'FULL_THIS_PASS'],
  ['src/domain/screener/candidate-record.js', 'FULL_THIS_PASS'],
  ['src/domain/fundamental/sec-earnings.js', 'FULL_THIS_PASS'],
  ['src/domain/screener/factor-ranks.js', 'PARTIAL'],
  ['scripts/build-reconciliation-status.mjs', 'PARTIAL'],
  ['scripts/lib/macro-sources.mjs', 'PARTIAL'],
  ['scripts/ci-masters-contract-check.mjs', 'PARTIAL'],
  ['.github/workflows/refresh-data.yml', 'PARTIAL_PARENT'],
  ['src/data/server-data.js', 'PARTIAL']
]);
const parentPass5 = ['worker/data-plane.js', 'scripts/lib/extended-universe.mjs', 'scripts/lib/13f-compose.mjs',
  'scripts/lib/masters-raw-rows.mjs', 'scripts/resolve-13f-prior-filings.mjs', 'scripts/reconcile-13f-prior-from-history.mjs',
  'scripts/recover-masters-holdings-from-shards.mjs', 'scripts/split-masters-manager-rows.mjs', 'scripts/ci-masters-manager-store-check.mjs'];
parentPass5.forEach(path => direct.set(path, 'FULL_PARENT_PASS5'));
const parentPass6 = ['cloudflare-worker-proxy.js', 'scripts/build-operations-status.mjs',
  'src/data/normalize/screener.js', 'src/data/contracts/market-snapshot.js', 'src/data/market-snapshot-loader.js',
  ...['factor-ranks', 'factor-weights', 'model-fingerprint', 'market-scope', 'factor-overlap', 'evidence-lineage',
    'channel-signals', 'saved-screens', 'condition-text-parser', 'custom-conditions', 'screen-engine',
    'conditional-evidence', 'preset-lessons', 'sector-label', 'price-factors'].map(name => `src/domain/screener/${name}.js`),
  'scripts/ci-conditional-evidence-contract.mjs', 'src/domain/technical/definitions.js',
  'src/domain/technical/follow-through.js', 'src/domain/screener/setup-profile.js',
  'src/domain/screener/row-presentation.js', 'src/domain/screener/screener-read.js', 'scripts/lib/factors.mjs'];
parentPass6.forEach(path => direct.set(path, 'FULL_PARENT_PASS6_CUMULATIVE'));
const parentPass78 = ['scripts/backtest-factors-longrun.mjs', 'scripts/lib/rank-statistics.mjs',
  'src/ui/components/screener-validation.js', 'src/domain/scenarios/theme-criteria.js',
  'src/domain/scenarios/exposures.js', 'src/domain/scenarios/theme-stage.js', 'src/domain/scenarios/analogs.js'];
parentPass78.forEach(path => direct.set(path, 'FULL_PARENT_PASS7_8_CUMULATIVE'));
const parentPass9 = ['src/domain/interpretation/market-interpretation.js', 'scripts/lib/market-interpretation-inputs.mjs'];
parentPass9.forEach(path => direct.set(path, 'FULL_PARENT_PASS9'));
const parentPass10 = ['src/data/selectors/interpretation.js', 'src/data/selectors/market-inputs.js',
  'src/data/shared-artifacts.js', 'src/data/artifact-cache.js', 'src/platform/http.js',
  'src/data/consensus-estimates.js', 'src/ui/knowledge/theme-stage-links.js', 'src/ui/components/portfolio-checklist.js'];
parentPass10.forEach(path => direct.set(path, 'FULL_PARENT_PASS10'));
const parentPass11 = ['context/market-content', 'context/manifest', 'context-builder', 'orchestrator/answer-orchestrator',
  'response/request-pipeline', 'response/publication', 'response/claim-ledger', 'response/renderer', 'policy',
  'policy/conduct', 'policy/suitability', 'policies/budget', 'session/chat-sessions', 'session/user-profile',
  'session/usage-learning', 'entity/resolver', 'entity/extract-tickers', 'entity/chat-tickers',
  'research/native-search', 'research/capability', 'research/decision'].map(name => `src/ai/${name}.js`);
parentPass11.forEach(path => direct.set(path, 'FULL_PARENT_PASS11'));
const parentPass12 = ['research/plan', 'research/evidence', 'time/market-session',
  'orchestrator/question-planner', 'orchestrator/capability-planner', 'orchestrator/premise',
  'retrieval/evidence', 'retrieval/knowledge', 'analysis/evidence-inputs', 'analysis/registry',
  'analysis/company', 'analysis/sector', 'analysis/technical', 'analysis/macro-fx', 'analysis/causal',
  'inference', 'response/answer-visual-choice', 'response/answer-modes', 'response/answer-principles'].map(name => `src/ai/${name}.js`);
parentPass12.forEach(path => direct.set(path, 'FULL_PARENT_PASS12'));
const parentPass13 = ['context/policy-lines', 'context/portfolio-rows', 'context/channel-signals',
  'context/close-basis-evidence', 'context/sec-fundamentals', 'context/screener-query',
  'context/panel-contexts', 'context/choosing-blocks', 'intent/taxonomy'].map(name => `src/ai/${name}.js`);
parentPass13.forEach(path => direct.set(path, 'FULL_PARENT_PASS13'));
const parentPass14 = ['.github/workflows/deploy-ai-proxy.yml', '.github/workflows/deploy-data-plane.yml',
  '.github/workflows/pages-deploy.yml', 'scripts/worker-deploy-impact.mjs', 'scripts/resolve-worker-rollback-version.mjs'];
parentPass14.forEach(path => direct.set(path, 'FULL_PARENT_PASS14'));
const parentPass15 = ['.github/workflows/operations-alert.yml', '.github/workflows/knowledge-lint.yml',
  'scripts/deployment-provenance.mjs', 'scripts/build-operations-slo-window.mjs',
  'scripts/lib/operations-alert-policy.mjs', 'scripts/operations-alert/collect-observations.mjs'];
parentPass15.forEach(path => direct.set(path, 'FULL_PARENT_PASS15'));
const parentPass16 = [...['market-calendar','session-bridge','session-time','quote-currentness','quote-presentation',
  'history-session','moving-average','market-windows','close-series','benchmarks','instrument-registry'].map(name => `src/domain/market/${name}.js`),
  'src/ui/components/session-lean.js'];
parentPass16.forEach(path => direct.set(path, 'FULL_PARENT_PASS16'));
const parentPass17 = [...['market-lean','breadth','breadth-signals','breadth-snapshot','breadth-consensus',
  'screener-breadth','sector-map','leadership-verdict','kr-index-record','kr-investor-flows','korea-participation',
  'index-earnings','market-flow','page-flow','market-timeline','regime-radar','regime-scenarios','scenario-outlook',
  'macro-crossroads'].map(name => `src/domain/market/${name}.js`), 'src/app/score-entry-points.js',
  'src/domain/themes/produced-rotation.js', 'src/domain/themes/recent-check.js'];
parentPass17.forEach(path => direct.set(path, 'FULL_PARENT_PASS17'));
const parentPass18 = [...['indicators','treasury-curve','taylor-rule','liquidity-growth','long-history','cross-asset-relations','macro-signals','rates-fx','macro-read'].map(name => `src/domain/macro/${name}.js`), ...['rrg','kr-themes','group-strength','ai-capex-flow'].map(name => `src/domain/themes/${name}.js`), 'scripts/producer/macro-history.mjs', 'src/domain/market/move-attribution.js'];
parentPass18.forEach(path => direct.set(path, 'FULL_PARENT_PASS18'));
const parentPass19 = [...['period','sec-row-fields','sec-normalize','sic-sector','sec-report','quarter-read','consensus-read','fiscal-read','peer-read','analysis-read','stock-lens','sec-statements'].map(name => `src/domain/fundamental/${name}.js`), 'src/domain/entity/kr-fundamentals.js','src/domain/entity/summary-hydration.js'];
parentPass19.forEach(path => direct.set(path, 'FULL_PARENT_PASS19'));
const parentPass20 = [...['selection','scoring','keyword-match','keyword-prefilter','report-verification','stories','earnings-context','kr-close-note'].map(name => `src/domain/news/${name}.js`), 'src/app/news-selection-entry-points.js', ...['news-picks','macro-releases','market-movers'].map(name => `src/domain/briefing/${name}.js`), 'scripts/lib/news-selection.mjs'];
parentPass20.forEach(path => direct.set(path, 'FULL_PARENT_PASS20'));
const parentPass21 = ['src/domain/briefing/event-briefs.js','scripts/fetch-event-briefs.mjs','.github/workflows/event-briefs.yml','src/ui/components/event-briefs.js','src/data/event-artifacts.js','src/domain/briefing/ai-chain-flow.js','src/ui/components/ai-chain-flow.js','src/domain/market/move-attribution.js'];
parentPass21.forEach(path => direct.set(path, 'FULL_PARENT_PASS21'));
const parentPass22 = [...['fx','cash','return-stats','asset-class','concentration','risk','look-through','checks','attribution','trade-journal','kr-stress'].map(name => `src/domain/portfolio/${name}.js`), 'src/ui/panels/portfolio-risk-input.js'];
parentPass22.forEach(path => direct.set(path, 'FULL_PARENT_PASS22'));
const parentPass23 = [...['surface','backtest','stress-sensitivity','portfolio-read'].map(name => `src/domain/portfolio/${name}.js`), 'src/ui/panels/portfolio-stress.js'];
parentPass23.forEach(path => direct.set(path, 'FULL_PARENT_PASS23'));
const parentPass24 = [...['bands','signal-history','price-levels','chart-scenarios','chart-compare','chart-drawings','chart-strategies','stage','setup-coach','chart-analysis'].map(name => `src/domain/technical/${name}.js`), 'src/ui/components/stock-chart-strategies.js'];
parentPass24.forEach(path => direct.set(path, 'FULL_PARENT_PASS24'));
const parentPass25 = [...['stock-read','ticker-symbol','out-of-universe-read','company-analysis','company-story','business-profiles'].map(name => `src/domain/entity/${name}.js`), ...['numeric-input','number'].map(name => `src/domain/shared/${name}.js`), 'src/data/on-demand-symbol.js','src/data/company-profiles.js','src/ui/components/company-story.js','scripts/ci-company-profile-contract-check.mjs','scripts/sync-company-profiles.mjs','_artifacts/company-profile-pilot-20261028/SCHEMA-v2.md'];
parentPass25.forEach(path => direct.set(path, 'FULL_PARENT_PASS25'));
const parentPass26 = ['daily-diff','event-guide','schedule','scheduled-events','evidence-text','headline-terms','regime-pulse'].map(name => `src/domain/briefing/${name}.js`);
parentPass26.forEach(path => direct.set(path, 'FULL_PARENT_PASS26'));
const parentPass27 = ['portfolio-assumptions','portfolio-backup','portfolio-cash','portfolio-declarations-store','portfolio-ledger','watchlist-store','shell-prefs','stock-subject-store'].map(name => `src/data/${name}.js`);
parentPass27.forEach(path => direct.set(path, 'FULL_PARENT_PASS27'));
const parentPass28 = ['src/data/page-completeness.js','src/data/public-readiness.js','src/domain/interpretation/concepts.js','src/domain/interpretation/market-interpretation.js','src/data/selectors/interpretation.js','src/data/selectors/market-inputs.js','scripts/lib/market-interpretation-inputs.mjs','scripts/ci-interpretation-boundary-check.mjs'];
parentPass28.forEach(path => direct.set(path, 'FULL_PARENT_PASS28'));
const parentPass29 = [...['learning-state','evidence','knowledge-cadence','graph','concept-surfaces','theme-research-links','atlas-relations','order','deferred-screen-terms'].map(name => `src/domain/knowledge/${name}.js`), 'src/app/knowledge-learning-state.js','src/ui/knowledge/learning-controls.js'];
parentPass29.forEach(path => direct.set(path, 'FULL_PARENT_PASS29'));
const parentPass30 = ['src/data/knowledge/load-capabilities.js','src/data/artifact-cache.js','src/data/research-snapshots.js','src/ui/knowledge/safe-external-link.js','src/ui/knowledge/capability-loader.js','src/ui/knowledge/knowledge-search.js'];
parentPass30.forEach(path => direct.set(path, 'FULL_PARENT_PASS30'));
// Cumulative reads finished before the version advance; do not call them current-version certification.
const cumulativePass9 = ['src/domain/scenarios/theme-playbook.js', 'scripts/backtest-trading-score.mjs',
  'scripts/backtest-trading-score-longrun.mjs', 'src/domain/signal/trading-score.js',
  'scripts/build-scenario-outcomes.mjs', 'scripts/build-scenario-state.mjs'];
cumulativePass9.forEach(path => direct.set(path, 'FULL_PARENT_CUMULATIVE_THROUGH_20261027_REVALIDATION_PARTIAL'));
direct.set('src/data/providers/screener.js', 'FULL_READER_PLUS_PARENT_GAP');
const reader = new Map();
const coverage = fs.readFileSync(new URL('./PASS5-COVERAGE.md', import.meta.url), 'utf8');
let section = '';
for (const line of coverage.split('\n')) {
  if (line.startsWith('## ')) section = line;
  const match = line.match(/^\| ([^|]+?) \|/);
  if (!match || !/\.m?js$|\.yml$/.test(match[1])) continue;
  const path = section.includes('Workflow') ? '.github/workflows/' + match[1] : match[1];
  reader.set(path, section.includes('Workflow') ? 'ops_audit' : section.includes('13F') ? 'sec_audit' : 'screener_audit');
}
for (const name of ['qa-runner','verify-refresh-candidate','worker-deploy-impact','ensure-live-convergence','deployment-provenance','sync-data-release-manifests','build-reconciliation-status','build-operations-slo-window','generate-workspace-state','workspace-state-lib','sync-agent-profiles','sync-agent-skills','agent-hook','bump-version','record-fix']) reader.set(`scripts/${name}.mjs`, 'ops_audit');
const driftUrl = new URL('./pass9-prior-ledger-drift.json', import.meta.url);
const changedSincePrior = new Set(fs.existsSync(driftUrl) ? JSON.parse(fs.readFileSync(driftUrl, 'utf8')).changed.map(row => row.path) : []);
const pass15DriftUrl = new URL('./pass15-inventory-drift.json', import.meta.url);
const changedSincePass14 = new Set(fs.existsSync(pass15DriftUrl) ? JSON.parse(fs.readFileSync(pass15DriftUrl, 'utf8')).changedObserved.map(row => row.path) : []);
const files = paths.map(path => ({ path,
  revalidation: changedSincePass14.has(path) ? 'REQUIRED_CHANGED_AFTER_PASS14' : changedSincePrior.has(path) ? (parentPass15.includes(path) ? 'CURRENT_SOURCE_REREAD_PASS15' : parentPass14.includes(path) ? 'CURRENT_SOURCE_REREAD_PASS14' : 'REQUIRED_CHANGED_SINCE_PRIOR_OBSERVATION') : 'NOT_ASSESSED_FOR_ALL_HISTORICAL_READS',
  semanticStatus: direct.get(path) || (reader.has(path) ? 'FULL_READER_REPORTED_PASS5' : 'NOT_RECONCILED_IN_FILE_LEDGER'),
  reader: reader.get(path) || null,
  latestDirectEvidence: parentPass19.includes(path) ? 'PASS19-HANDOFF.md' : parentPass18.includes(path) ? 'PASS18-HANDOFF.md' : parentPass17.includes(path) ? 'PASS17-HANDOFF.md' : parentPass16.includes(path) ? 'PASS16-HANDOFF.md' : parentPass15.includes(path) ? 'PASS15-HANDOFF.md' : parentPass14.includes(path) ? 'PASS14-HANDOFF.md' : parentPass13.includes(path) ? 'PASS13-HANDOFF.md' : parentPass12.includes(path) ? 'PASS12-HANDOFF.md' : parentPass11.includes(path) ? 'PASS11-HANDOFF.md' : parentPass10.includes(path) ? 'PASS10-HANDOFF.md' : null,
  evidence: parentPass9.includes(path) || cumulativePass9.includes(path) ? 'PASS9-HANDOFF.md' : parentPass78.includes(path) ? 'PASS7-8-HANDOFF.md' : parentPass6.includes(path) || path === 'src/data/providers/screener.js' ? 'PASS6-HANDOFF.md; PASS5-COVERAGE.md' : reader.has(path) || parentPass5.includes(path) ? 'PASS5-COVERAGE.md; PASS5-HANDOFF.md' : direct.has(path) ? 'PASS4-HANDOFF.md; parent source reads' : null,
  observedSha256: (direct.has(path) || reader.has(path)) && fs.existsSync(path) ? createHash('sha256').update(fs.readFileSync(path)).digest('hex') : null
}));
const pass20DriftUrl = new URL('./pass20-inventory-drift.json', import.meta.url);
const pass20Changed = new Set(fs.existsSync(pass20DriftUrl) ? JSON.parse(fs.readFileSync(pass20DriftUrl, 'utf8')).changedObserved.map(row => row.path) : []);
// A regenerated inventory hash is an observation, never proof that the current dirty revision was read.
// Conservatively requeue dirty source with historical reads after concurrent work; retain the evidence document.
const currentlyDirty = new Set(execFileSync('git', ['diff', '--name-only', '-z'], {encoding:'utf8',maxBuffer:32*1024*1024}).split('\0').filter(Boolean));
for (const row of files) {
  if (parentPass24.includes(row.path)) row.latestDirectEvidence = 'PASS24-HANDOFF.md';
  if (parentPass25.includes(row.path)) row.latestDirectEvidence = 'PASS25-HANDOFF.md';
  if (parentPass26.includes(row.path)) row.latestDirectEvidence = 'PASS26-HANDOFF.md';
  if (parentPass27.includes(row.path)) row.latestDirectEvidence = 'PASS27-HANDOFF.md';
  if (parentPass28.includes(row.path)) row.latestDirectEvidence = 'PASS28-HANDOFF.md';
  if (parentPass29.includes(row.path)) row.latestDirectEvidence = 'PASS29-HANDOFF.md';
  if (parentPass30.includes(row.path)) row.latestDirectEvidence = 'PASS30-HANDOFF.md';
  if (parentPass22.includes(row.path)) row.latestDirectEvidence = 'PASS22-HANDOFF.md';
  if (parentPass23.includes(row.path)) row.latestDirectEvidence = 'PASS23-HANDOFF.md';
  if (pass20Changed.has(row.path)) row.revalidation = 'REQUIRED_CHANGED_AFTER_PRIOR_READ_PASS20';
  if (parentPass20.includes(row.path)) row.latestDirectEvidence = 'PASS20-HANDOFF.md';
  if (parentPass21.includes(row.path)) {
    row.latestDirectEvidence = 'PASS21-HANDOFF.md';
    if (pass20Changed.has(row.path)) row.revalidation = 'CURRENT_SOURCE_REREAD_PASS21';
  }
  if (currentlyDirty.has(row.path) && (direct.has(row.path) || reader.has(row.path))) row.revalidation = 'REQUIRED_DIRTY_REVISION_READ_NOT_CERTIFIED';
}
const report = { generatedAt: new Date().toISOString(), files: files.length,
  limits: 'Conservative coverage ledger. NOT_RECONCILED means prior narrative evidence has not been reconciled per file, not proof that the file was never read. FULL means source read, not runtime/semantic certification. No automatic scan promotes semantic status. Ignored/private paths are outside this ledger; prior IGNORED-PATHS inventories are separate.',
  counts: files.reduce((all, row) => { all[row.semanticStatus] = (all[row.semanticStatus] || 0) + 1; return all; }, {}) };
fs.writeFileSync(new URL('./FILE-REVIEW-LEDGER.json', import.meta.url), JSON.stringify({ report, files }, null, 2) + '\n');
console.log(JSON.stringify(report));
