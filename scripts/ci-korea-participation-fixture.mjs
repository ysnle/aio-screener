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
// P1723: the index day beside the same-session sample median, and the largest-traded names beside an equal-weight median.
{
  const { heavyweightLine } = await import('../src/domain/themes/group-strength.js');
  const sample = Array.from({ length: 30 }, (_, i) => ({ sym: `${String(100000 + i)}.KS`, factorSessionDate: '2026-10-13', pctSma50: i % 2 ? 1 : -1, pctSma200: 1, ret1m: 15, ret3m: 20,
    ret1d: i < 2 ? -9 : i < 8 ? -4 : -1, ret5d: -6, dollarVolume30d: i < 2 ? 5e9 : i === 2 ? 1e9 : 1e7 }));
  sample[0].ret1m = -18; sample[1].ret1m = -12; sample[2].ret1m = 1;
  const themes = { semi: sample.slice(0, 8).map((row) => ({ code: row.sym.slice(0, 6) })) };
  const shock = buildKoreaParticipation({ rows: sample, themes, nowMs: Date.parse('2026-10-13T09:00:00Z'), index: { date: '2026-10-13', d1: -5.46, d5: -13.8 } });
  assert.equal(shock.session.ret1d, -1, 'P1723 the sample 1-day median comes from the same session');
  assert.equal(shock.session.down3, 8, 'P1723 members down 3% or more are counted');
  assert.match(shock.session.text, /^코스피 10\/13 -5\.5% vs 한국 수집 표본 30개 하루 수익률 중앙값 -1\.0%.*시가총액이 큰 종목에 하락이 몰린 것으로 보입니다\. 5거래일은 지수 -13\.8% · 표본 중앙값 -6\.0%입니다\.$/, `P1723 index vs sample sentence (${shock.session.text})`);
  const other = buildKoreaParticipation({ rows: sample, themes, nowMs: Date.parse('2026-10-13T09:00:00Z'), index: { date: '2026-10-12', d1: -3 } });
  assert.ok(!/코스피/.test(other.session.text), 'P1723 an index close from another session is never set against the sample');
  const semi = shock.groups.find((group) => group.themeId === 'semi');
  const line = heavyweightLine(semi);
  assert.ok(/거래대금 상위 3종목의 1개월 수익률 중앙값은 -12\.0%/.test(line) && /동일가중 테마 중앙값 \+15\.0%와 방향이 반대입니다/.test(line), `P1723 the largest-traded names are not hidden by the median (${line})`);
}
console.log('PASS P1628 Korean completed-session participation and honest unavailable source boundaries; P1723 index vs sample day and largest-traded names.');
