import { execFileSync } from 'node:child_process';
import { SourceTextModule } from 'node:vm';
import { posix } from 'node:path';
import { writeFileSync } from 'node:fs';
const ref = 'd36bb256ddf60468d6c7a134628053c5796be6be';
const get = (path) => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const modules = new Map();
function moduleFor(path) {
  if (!modules.has(path)) modules.set(path, new SourceTextModule(get(path), { identifier: path }));
  return modules.get(path);
}
async function load(path) {
  const mod = moduleFor(path);
  if (mod.status === 'unlinked') await mod.link((specifier, from) => {
    if (!specifier.startsWith('.')) throw new Error(`External dependency forbidden: ${specifier}`);
    return moduleFor(posix.normalize(posix.join(posix.dirname(from.identifier), specifier)));
  });
  if (mod.status !== 'evaluated') await mod.evaluate();
  return mod.namespace;
}
const out = { ref, cases: [] };
const { buildIndexEarnings } = await load('src/domain/market/index-earnings.js');
const { consensusView } = await load('src/domain/fundamental/consensus-read.js');
const now = Date.parse('2026-10-21T12:00:00Z');
const row = { sym: 'AAA', valuationPrice: 100, factorSessionDate: '2026-10-20' };
const stale = { asOf: '2020-01-01T00:00:00Z', fwd: { eps: 5, up4w: 10, down4w: 0 }, trailing: { eps: 4 } };
const input = { rows: [row], weights: { asOf: '2026-10-20', rows: [['AAA', 'Technology', 100]] }, consensus: { rows: { AAA: stale } }, realYield10: 2 };
out.cases.push({ id: 'stale-consensus', stockView: consensusView(row, stale, { now }), indexView: buildIndexEarnings(input) });
const fresh = { ...stale, asOf: '2026-10-20T00:00:00Z' };
out.cases.push({ id: 'stale-price', stockView: consensusView({ ...row, factorSessionDate: '2020-01-01' }, fresh, { now }), indexView: buildIndexEarnings({ ...input, rows: [{ ...row, factorSessionDate: '2020-01-01' }], consensus: { rows: { AAA: fresh } } }) });
const { curveDynamics } = await load('src/domain/macro/rates-fx.js');
const dates = Array.from({ length: 25 }, (_, i) => new Date(Date.UTC(2026, 8, 1 + i)).toISOString().slice(0, 10));
out.cases.push({ id: 'short-inversion-at-history-boundary', actual: curveDynamics({ series: { dgs2: { observations: dates.map((d) => [d, 4]) }, dgs10: { observations: dates.map((d, i) => [d, i === 0 ? 3.9 : 4.1]) } } }) });
const { formatSlotMove } = await load('src/domain/market/market-timeline.js');
out.cases.push({ id: 'missing-slot-move', actual: formatSlotMove({ label: 'S&P 500', change: null }) });
const { buildMacroRead } = await load('src/domain/macro/macro-read.js');
try { out.cases.push({ id: 'prior-M01', actual: buildMacroRead({ macro: { fedTargetUpper: 5 } }) }); }
catch (error) { out.cases.push({ id: 'prior-M01', error: error.message }); }
const { buildMacroCrossroads } = await load('src/domain/market/macro-crossroads.js');
const crossroads = buildMacroCrossroads({ signals: { payroll3: 250, payrollPrior3: 200, retailYoy: 4, tnx20: 0.5, curve20: 0.3, termPremium20: null, breadth: 'favorable', bands: { tnx20: 0.1, curve20: 0.1, termPremium20: 0.1 } } });
const reflation = crossroads.items.find((b) => b.id === 'reflation');
out.cases.push({ id: 'prior-M02', leadId: crossroads.leadId, met: reflation.met, known: reflation.known, fit: reflation.fit, condition: reflation.conditions[2] });
const { themeDetailFlow } = await load('src/domain/market/page-flow.js');
out.cases.push({ id: 'prior-M03', actual: themeDetailFlow({ themeId: 'a', groups: [{ themeId: 'a', name: 'One', smallSample: true, ret3m: 20 }, { themeId: 'a', name: 'Two', smallSample: true, ret3m: -5 }] }) });
const consensus = JSON.parse(get('public-data/consensus-estimates.json'));
out.artifactConsensus = { latest: Object.values(consensus.rows).map((r) => r.asOf).filter(Boolean).sort().at(-1), oldest: Object.values(consensus.rows).map((r) => r.asOf).filter(Boolean).sort()[0], staleAtReview: Object.values(consensus.rows).filter((r) => r.asOf && now - Date.parse(r.asOf) > 21 * 86400000).length };
writeFileSync(new URL('./financial-delta-probe-result.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
