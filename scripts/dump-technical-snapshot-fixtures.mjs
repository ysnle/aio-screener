#!/usr/bin/env node
// v59.88 (ADR-0003 S6): golden dump of the legacy technical engine — js/aio-core.js calcTechnicalSnapshot and its _calc*
// helpers, calcExtensionHeat, calcSellPressure, calcPositionTechnicalRisk and calcPortfolioTechnicalRisk — taken from a
// git revision BEFORE they moved to src/domain/technical/snapshot.js and src/domain/portfolio/technical-risk.js.
// The legacy functions run unmodified in a VM with the same window.AIO_ARCH the browser gives them (technical
// definitions, the producer VCP, the MA-structure classifier, the concentration ladder), so the fixture is what the
// shipped page computed. scripts/ci-domain-parity-check.mjs compares the domain modules against it.
// Usage: node scripts/dump-technical-snapshot-fixtures.mjs [--rev <git-rev>]   (default: the pre-extraction d505113)
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { smaLast, emaSeries, rsiWilder, atrWilder, adrPctOf } from '../src/domain/technical/definitions.js';
import { classifyMovingAverageStructure } from '../src/domain/technical/stage.js';
import { concentrationPenaltyForWeight } from '../src/domain/portfolio/concentration.js';
import { _calcVCPServer } from '../src/domain/screener/price-factors.js';
import { TECHNICAL_SNAPSHOT_SCENARIOS, POSITION_RISK_SCENARIOS } from './fixtures/technical-snapshot-scenarios.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const rev = argv.includes('--rev') ? argv[argv.indexOf('--rev') + 1] : 'd505113';
const OUT = join(root, 'architecture/fixtures/technical-snapshot-golden.json');

const shown = spawnSync('git', ['show', `${rev}:js/aio-core.js`], { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (shown.status !== 0) { console.error(`dump-technical-snapshot-fixtures: git show ${rev}:js/aio-core.js failed: ${shown.stderr}`); process.exit(2); }
const core = shown.stdout;

function extract(name) {
  const sig = `function ${name}(`;
  const start = core.indexOf(sig);
  if (start < 0) throw new Error(`legacy function ${name} not found at ${rev}`);
  let depth = 0;
  for (let i = core.indexOf('{', start); i < core.length; i++) {
    if (core[i] === '{') depth++;
    else if (core[i] === '}' && --depth === 0) return core.slice(start, i + 1);
  }
  throw new Error(`unbalanced ${name}`);
}

const NAMES = ['_aioCleanNums', '_aioCleanOHLCV', '_aioTechDef', '_calcSMA', '_calcEMAFull', '_calcEMA', '_calcATR', '_calcRSILast', '_calcMACD',
  '_calcBB', '_calcRVOL', '_calcClosePosition', '_calcADRPercent', '_calcCandleMetrics', '_calcRecentLevel', '_calcVCP', '_calcRSISeries',
  '_calcRSIDivergence', '_calcFib', '_calcVolProfile', '_calcWeeklyContext', '_aioRetPct', 'calcTechnicalSnapshot', 'calcExtensionHeat',
  'calcSellPressure', '_aioStrictFinite', '_statMean', 'calcPositionTechnicalRisk', 'calcPortfolioTechnicalRisk'];
const window = { AIO_ARCH: { smaLast, emaSeries, rsiWilder, atrWilder, adrPctOf, vcpRead: _calcVCPServer, classifyMovingAverageStructure, concentrationPenaltyForWeight } };
const legacy = runInNewContext(`${NAMES.map(extract).join('\n')}\n({ ${NAMES.join(', ')} })`, { window, Math, Number, Object, Array, isFinite, JSON });

// JSON keeps what the comparison needs: the bars echo (snapshot.raw) is the input, and a derived result's own `snapshot`
// is the snapshot already stored beside it, so both are dropped.
const strip = (value, nested = false) => (value && typeof value === 'object'
  ? JSON.parse(JSON.stringify(value, function (k, v) { return k === 'raw' || (nested && k === 'snapshot' && this === value) ? undefined : v; }))
  : value);
const fixtures = TECHNICAL_SNAPSHOT_SCENARIOS.map(({ name, ohlcv }) => {
  const snapshot = legacy.calcTechnicalSnapshot(ohlcv);
  return { name, snapshot: strip(snapshot), extensionHeat: strip(legacy.calcExtensionHeat(snapshot), true), sellPressure: strip(legacy.calcSellPressure(snapshot, {}), true) };
});
const positions = POSITION_RISK_SCENARIOS.map(({ name, positions: list, context }) => {
  const items = list.map((p) => legacy.calcPositionTechnicalRisk(p, p.ohlcv || [], context));
  return { name, items: items.map((item) => strip(item, true)), portfolio: { ...strip(legacy.calcPortfolioTechnicalRisk(list, items, context), true), items: undefined } };
});
writeFileSync(OUT, `${JSON.stringify({ generatedFrom: `git ${rev}:js/aio-core.js`, fixtures, positions })}\n`);
console.log(`dump-technical-snapshot-fixtures: ${fixtures.length} snapshot + ${positions.length} position scenarios -> ${OUT}`);
