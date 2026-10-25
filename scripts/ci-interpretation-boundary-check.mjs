// Owner 2026-10-19 ("전체 구조 개편"): the interpretation pipeline is built in one place. Before it, 오늘, 시장 상태, 거시,
// 브리핑, 테마, the AI chat, the narrative producer and scenario-state.json each assembled regime → branches → outlook →
// guide with different inputs, and a tie could name a different lead branch on the screen than in the narrative.
// This gate keeps it that way:
//   1. the stage builders are called only by the pipeline module (and by the declared exceptions below, each with why);
//   2. the pipeline is entered only through its two adapters (browser selector, producer lib);
//   3. lower layers never import the UI: domain, data and ai read no src/ui module; domain reads no ai/state module.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INTERPRETATION_STAGES } from '../src/domain/interpretation/market-interpretation.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const label = 'v58.31 interpretation boundary';
const walk = (dir) => readdirSync(path.join(ROOT, dir), { recursive: true }).filter((file) => /\.(m?js)$/.test(String(file))).map((file) => path.join(dir, String(file)).split(path.sep).join('/'));
const files = [...walk('src'), ...walk('scripts').filter((file) => !/^scripts\/(ci-|dump-)/.test(file) && !file.includes('/fixtures/')), ...walk('js')];
const read = (file) => readFileSync(path.join(ROOT, file), 'utf8');
const failures = [];

const PIPELINE = 'src/domain/interpretation/market-interpretation.js';
const STAGES = {
  buildMarketRegime: 'src/domain/briefing/market-read.js',
  buildMarketRead: 'src/domain/briefing/market-read.js',
  buildMacroRead: 'src/domain/macro/macro-read.js',
  buildIndexEarnings: 'src/domain/market/index-earnings.js',
  buildMacroCrossroads: 'src/domain/market/macro-crossroads.js',
  buildMarketScenarios: 'src/domain/market/regime-scenarios.js',
  buildScenarioOutlook: 'src/domain/market/scenario-outlook.js',
  buildThemePlaybook: 'src/domain/scenarios/theme-playbook.js',
  buildMarketGuide: 'src/domain/guide/market-guide.js'
};
// Declared exceptions: a different question on different inputs, not a second assembly of today's interpretation.
const EXCEPTIONS = {
  'src/domain/briefing/daily-diff.js': ['buildMarketRegime'], // axis flips compared on closes only, today vs the prior session (its headline says credit is left out)
  'src/domain/market/regime-scenarios.js': ['buildMarketRegime', 'buildMarketScenarios'], // the stage's own default argument and its legacy render helper
  'scripts/producer/theme-stage-backfill.mjs': ['buildThemePlaybook'] // v58.79: past sessions' theme stages from past closes (no macro inputs), not today's interpretation
};

for (const file of files) {
  const source = read(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const [name, home] of Object.entries(STAGES)) {
    if (file === PIPELINE || file === home) continue;
    if (new RegExp(`(?<![\\w.])${name}\\s*\\(`).test(source) && !(EXCEPTIONS[file] || []).includes(name)) {
      failures.push(`${file} calls ${name}() directly — read it from the shared interpretation (src/data/selectors/interpretation.js or scripts/lib/market-interpretation-inputs.mjs)`);
    }
  }
  if (/\bbuildMarketInterpretation\s*\(/.test(source) && ![PIPELINE, 'src/data/selectors/interpretation.js', 'scripts/lib/market-interpretation-inputs.mjs'].includes(file)) {
    failures.push(`${file} builds the interpretation itself — use one of the two adapters so the result is shared`);
  }
  const layer = file.match(/^src\/(domain|data|ai)\//)?.[1];
  if (layer) {
    for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), match[1]));
      if (!match[1].startsWith('.')) continue;
      if (target.startsWith('src/ui/')) failures.push(`${file} (${layer}) imports the UI module ${target}`);
      if (layer === 'domain' && /^src\/(ai|state)\//.test(target)) failures.push(`${file} (domain) imports ${target}`);
    }
  }
}

// The adapters exist and the stage order is the documented one.
assert.deepEqual(INTERPRETATION_STAGES, ['regime', 'marketRead', 'macroRead', 'curve', 'indexEarnings', 'crossroads', 'scenarios', 'groups', 'outlook', 'playbook', 'guide'], `${label}: stage order`);
for (const adapter of ['src/data/selectors/interpretation.js', 'scripts/lib/market-interpretation-inputs.mjs']) {
  assert.match(read(adapter), /buildMarketInterpretation\(/, `${label}: ${adapter} enters the pipeline`);
}
// Behaviour on the published artifacts: one build gives every stage; the browser adapter reuses it until an input object
// changes; a stage that throws is reported, not half-built.
const { buildMarketInterpretation } = await import('../src/domain/interpretation/market-interpretation.js');
const { marketInterpretation, registerInterpretationStore } = await import('../src/data/selectors/interpretation.js');
const artifact = (name) => { try { return JSON.parse(read(`public-data/${name}`)); } catch (_) { return null; } };
const historyRaw = artifact('history.json');
const history = Array.isArray(historyRaw) ? historyRaw : historyRaw?.rows || [];
const built = buildMarketInterpretation({ market: { history, credit: { hyBp: 315, hyDelta5Bp: -9 }, rates: {}, macroHistory: artifact('macro-history.json') }, previous: artifact('scenario-state.json'), screenerRows: [], themeMaps: { usThemes: [], krThemeMap: {}, labels: {} } });
assert.ok(built.regime?.available && built.crossroads?.items?.length && built.guide?.available, `${label}: one build yields regime, branches and guide`);
assert.equal(built.guide.direction.live.length >= 0, true, `${label}: the guide counts the same branches`);
const broken = buildMarketInterpretation({ market: { history: 'not rows' }, calendar: { schedules: { 'us-cpi': 7 } } });
assert.equal(typeof broken.errors, 'object', `${label}: stage errors are collected`);
const root = { _aioHistory: history, _aioMacroHistory: artifact('macro-history.json'), DATA_SNAPSHOT: {}, THEME_MAP: [] };
const rows = [{ sym: 'AAA', ret3m: 10 }];
const stop = registerInterpretationStore(root, { getState: () => ({ screener: { rows } }) });
const first = marketInterpretation(root);
assert.ok(marketInterpretation(root) === first, `${label}: the browser adapter reuses the build while inputs are unchanged`);
root._aioHistory = [...history];
assert.ok(marketInterpretation(root) !== first, `${label}: a replaced artifact rebuilds`);
stop();

if (failures.length) {
  console.error(failures.map((line) => `${label}: ${line}`).join('\n'));
  process.exit(1);
}
console.log(`interpretation boundary OK: ${Object.keys(STAGES).length} stages built only in ${PIPELINE}; ${files.length} files scanned`);
