// P1628: Korean sessions, sample denominators, currency-independent participation and missingness.
import assert from 'node:assert/strict';
import { buildKoreaParticipation } from '../src/domain/market/korea-participation.js';
const rows=[{sym:'005930.KS',factorSessionDate:'2026-10-08',pctSma50:3,pctSma200:-2,ret1m:2,ret3m:6},
 {sym:'000660.KS',factorSessionDate:'2026-10-08',pctSma50:-3,pctSma200:2,ret1m:4,ret3m:10},
 {sym:'NVDA',factorSessionDate:'2026-10-09',pctSma50:20,ret3m:90},
 {sym:'042700.KS',factorSessionDate:'2026-10-09',pctSma50:20,ret3m:90}];
const model=buildKoreaParticipation({rows,nowMs:Date.parse('2026-10-11T18:00:00Z')});
assert.equal(model.date,'2026-10-08','P1628 Hangul holiday cannot be a Korean completed close');
assert.equal(model.observed,2,'P1628 US and invalid-session Korean rows are excluded');
assert.equal(model.breadth50.pct,50,'P1628 missing/cross-market rows cannot change Korean denominator');
assert.equal(model.returns.ret3m,8,'P1628 Korean returns use the same session sample');
assert.equal(buildKoreaParticipation({rows:[],nowMs:Date.parse('2026-10-11T18:00:00Z')}).available,false,'P1628 absent Korean rows generate no market numbers');
assert.ok(model.missing.includes('외국인·기관 순매수'),'P1628 FX direction is not invented institutional flow');
console.log('PASS P1628 Korean completed-session participation and honest unavailable source boundaries.');
