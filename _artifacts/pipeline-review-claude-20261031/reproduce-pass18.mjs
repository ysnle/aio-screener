import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { inflationDirection } from '../../src/domain/macro/macro-signals.js';
import { BRANCHES } from '../../src/domain/market/macro-crossroads.js';
import { deriveTreasuryCurveEvidence } from '../../src/domain/macro/treasury-curve.js';
import { buildRatesFx } from '../../src/domain/macro/rates-fx.js';
import { buildCrossAssetRelations } from '../../src/domain/macro/cross-asset-relations.js';
import { netLiquiditySeries } from '../../src/domain/macro/liquidity-growth.js';
import { krThemeArtifactRead } from '../../src/domain/themes/kr-themes.js';
import { longHistoryRows } from '../../src/domain/macro/long-history.js';
const inflationDir = inflationDirection({ pce: { pace: 1, yoy: 3, date: '2026-09-01' } });
const softlandCondition = BRANCHES.find(x => x.id === 'softland').conditions[0][1]({ inflationDir });
assert.equal(inflationDir.single, true);
assert.equal(softlandCondition, true);
const nullTenor = deriveTreasuryCurveEvidence({ treasury: { observedAt: '2026-10-28', values: { dgs2: 4, dgs5: null, dgs10: 4.2, dgs20: null, dgs30: 4.5 } } });
assert.equal(nullTenor.curve.points.find(x => x.tenor === '5Y').value, 0);
assert.equal(nullTenor.fiveY, null);
const macro = { t10y2y: -1, _asOf_t10y2y: '2026-01-01' };
for (const [key, value] of Object.entries({ dgs2: 4, dgs5: 4.1, dgs10: 5, dgs20: 5.1, dgs30: 5.2 })) {
  macro[key] = value; macro[`_asOf_${key}`] = '2026-10-28';
}
const mixedCurve = buildRatesFx({ macro }).treasury;
assert.equal(mixedCurve.sameCut, true);
assert.equal(mixedCurve.curve[0].value, -1);
assert.match(mixedCurve.fact, /역전/);
const history = [];
for (let i = 0; i < 75; i++) {
  const date = new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10);
  history.push({ date, spx: 100, tnx: 4, ...(i < 40 ? { gold: 100 } : {}) });
}
const missingRelations = buildCrossAssetRelations(history);
assert.equal(missingRelations.available, true);
assert.equal(missingRelations.moves.wti, null);
assert.match(missingRelations.reading, /평소 관계에서 크게 벗어나지/);
assert.notEqual(missingRelations.moves.spx.to, missingRelations.moves.gold.to);
const missingTga = netLiquiditySeries({ series: {
  fedBalanceSheet: { observations: [['2026-10-28', 7000000]] },
  treasuryAccount: { observations: [['2026-10-28', null]] },
  reverseRepo: { observations: [['2026-10-28', 100]] }
} });
assert.equal(missingTga[0].value, 6900);
const krRead = krThemeArtifactRead({ themeMap: { semi: [{code:'000001'}, {code:'000002'}, {code:'000003'}] }, rows: [
  {sym:'000001.KS', ret1m:50, factorSessionDate:'2026-01-01', factorQuality:{stale:true}},
  {sym:'000002.KS', ret1m:null, factorSessionDate:'2026-10-28'},
  {sym:'000003.KS', ret1m:null, factorSessionDate:'2026-10-28'}
] });
assert.equal(krRead.usable.length, 1);
assert.equal(krRead.usable[0].ret1m, 50);
assert.equal(krRead.usable[0].basis, '2026-10-28');
const observations = Array.from({length:129}, (_,i) => [new Date(Date.UTC(2016,i,1)).toISOString().slice(0,7), i]);
const retained = {series:{dgs10:{observations, stale:true}}};
const before = longHistoryRows({...retained, generatedAt:'2026-09-15'})[0];
const after = longHistoryRows({...retained, generatedAt:'2026-10-01'})[0];
assert.equal(before.last.month,'2026-08');
assert.equal(after.last.month,'2026-09');
const report = { scope: 'Pure local counterexamples; live occurrence and upstream contracts separately assessed', inflationDir, softlandCondition, nullTenor: { fiveY: nullTenor.fiveY, points: nullTenor.curve.points }, mixedCurve: { fact: mixedCurve.fact, asOf: mixedCurve.asOf, sameCut: mixedCurve.sameCut, curve: mixedCurve.curve }, missingRelations, missingTga, krRead, retainedPartialMonth: { before:before.last, after:after.last, afterLabel:after.monthText, stale:after.stale } };
writeFileSync(new URL('./pass18-reproductions.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
