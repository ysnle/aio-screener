import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeFactorRanks } from '../src/domain/screener/factor-ranks.js';
import { marketRows, screenerMarket, formatScreenerPrice, MARKET_POPULATION_POLICY } from '../src/domain/screener/market-scope.js';
import { filterRows, sortRows } from '../src/ui/pages/screener.js';
import { buildGroupStrength } from '../src/domain/themes/group-strength.js';
import { normalizeScreener } from '../src/data/normalize/screener.js';
import { createScreenerOrchestrator } from '../src/data/orchestrators/screener.js';
import { expandScreenerArtifact } from '../src/data/screener-extended.js'; // v57.95 core row encoding

// P1625: extreme observations in another listing market must not move US peer ranks.
const fixtureRow = (sym, seed, market = 'US') => ({
  sym, market, sector: 'Technology', ret1m: seed, ret3m: seed * 2, ret6m: seed * 3,
  pctSma50: seed, pctSma200: seed * 2, vol: 10 + seed, rsi: 40 + seed,
  kalmanVel: seed / 10, kalmanVelConf: 1, kalmanScale: 'log_pct_day',
  factorSessionDate: market==='KR'?'2026-10-08':'2026-10-09', factorObservedAt: market==='KR'?'2026-10-08T00:00:00Z':'2026-10-09T13:30:00Z',
  factorTimeBasis:'bar-start', factorBarCompleteness:'completed-sessions-only',
  factorSourceKind: 'T3_PUBLIC_DELAYED', factorAllowedUse: 'research-relative-ranking-only',
  factorQuality: { status: 'CURRENT', stale: false }
});
const us = [1,2,3,4,5,6].map(seed => fixtureRow(`US${seed}`, seed));
const kr = [1,2,3,4,5,6].map(seed => fixtureRow(`KR${seed}.KS`, 1000 + seed * 100, 'KR'));
const now = Date.parse('2026-10-10T01:00:00Z');
const alone = computeFactorRanks({ rows: us, now });
const mixed = computeFactorRanks({ rows: [...us, ...kr], now });
assert.equal(mixed.populationPolicy, MARKET_POPULATION_POLICY, 'P1625: policy must identify market separation');
assert.equal(mixed.byMarket.US.ranked, alone.ranked, 'P1625: US cohort size is independent');
assert.equal(mixed.byMarket.KR.ranked, 6, 'P1625: KR cohort is independently ranked');
const holidayWeekend=computeFactorRanks({rows:kr,now:Date.parse('2026-10-12T01:00:00Z')});
assert.equal(holidayWeekend.ranked,6,'P1625 latest completed Korean close stays valid across holiday and weekend beyond four calendar days');
assert.equal(computeFactorRanks({rows:kr,now:Date.parse('2026-10-13T01:00:00Z')}).available,false,'P1625 an older Korean session remains stale once a newer session closes');
assert.deepEqual(marketRows(mixed.rows, 'US').map(row => [row.sym, row.rank, row._compositeZ]), alone.rows.map(row => [row.sym, row.rank, row._compositeZ]), 'P1625: KR extremes cannot change US ranks');
const small = computeFactorRanks({ rows: [...us, ...kr.slice(0, 4)], now });
assert.equal(small.byMarket.KR.available, false, 'P1625: four KR rows cannot borrow US peers to make a rank');
assert.equal(small.byMarket.US.available, true, 'P1625: held KR ranks must not suppress US ranks');
assert.equal(screenerMarket({ sym: '005930.KS' }), 'KR', 'P1625: Korean listing suffix is preserved');
assert.equal(screenerMarket({ sym: 'TSM', instrumentRef: { market: 'US' } }), 'US', 'P1625: a US ADR stays in its listing market');
assert.equal(formatScreenerPrice(123.45, 'USD'), '$123.45', 'P1625/P1630: USD prices declare dollars with the same sign-first notation as KRW');
assert.equal(formatScreenerPrice(73000, 'KRW'), '₩73,000', 'P1625: KRW prices have whole won units');
assert.ok(formatScreenerPrice(10, null).includes('통화 미확인'), 'P1625: undeclared currency cannot become USD');
const controls = { 'scr-listing-market': { value: 'KR' } };
const doc = { getElementById: id => controls[id] || null };
assert.equal(filterRows([...us, ...kr], doc).length, kr.length, 'P1625: selected market filters the actual UI result');
controls['scr-listing-market'].value = 'US';
assert.equal(filterRows([...us, ...kr], doc).length, us.length, 'P1625: switching market uses the same filter boundary');
assert.deepEqual(sortRows([{ sym:'A',rank:100,screenRank:2 },{ sym:'B',rank:20,screenRank:1 }], 'screenRank', true).map(row => row.sym), ['B','A'], 'P1625: declared preset order must not be overwritten by composite rank');
assert.deepEqual(sortRows([{ sym:'A',ret3m:null },{ sym:'B',ret3m:0 },{ sym:'C',ret3m:20 }], 'ret3m', false).map(row => row.sym), ['C','B','A'], 'P1625: missing returns sort last and zero stays a real observation');
const normal = normalizeScreener({ rows:[{ sym:'005930.KS', market:'KR', currency:'KRW' }] });
assert.equal(normal.rows[0].market, 'KR', 'P1625: normalization cannot drop listing-market scope');
assert.equal(normal.rows[0].currency, 'KRW', 'P1625: normalization cannot drop currency');
assert.equal(normalizeScreener({rows:[kr[0]]}).rows[0].factorBarCompleteness,'completed-sessions-only','P1629 native normalization preserves producer completion evidence');
const themes = [{ id:'mixed',nameKr:'혼합 테스트',subThemes:[{name:'그룹',tickers:[...us.slice(0,3),...kr.slice(0,3)].map(row=>row.sym)}]}];
const theme = buildGroupStrength({ themes, rows:[...us,...kr], benchmark:{ asOf:'2026-10-09',ret3m:0 } });
assert.equal(theme.groups[0].listed, 3, 'P1625: US theme strength cannot pool Korean returns');
assert.equal(theme.groups[0].ret3m, 4, 'P1625: US group median cannot include Korean observations');
let published;
const orchestrator = createScreenerOrchestrator({ provider:{readCurrent:async()=>({ rows:[{sym:'US1',rank:99,ret3m:1}] })},commands:{setData:value=>{published=value;}},ranker:()=>({available:false,rows:[]}) });
await orchestrator.sync();
assert.equal(published.rows[0].rank, null, 'P1625: unavailable rerank cannot retain artifact rank');

// Actual artifact audit is local read-only evidence, not a forced PLTR ranking expectation.
const artifact = expandScreenerArtifact(JSON.parse(readFileSync(new URL('../public-data/screener.json', import.meta.url))));
const pltr = artifact.data?.PLTR;
assert.ok(pltr, 'P1625: PLTR remains in the published screener artifact');
assert.equal(typeof pltr.ret3m, 'number', 'P1625: PLTR return evidence is present');
console.log(JSON.stringify({status:'PASS',entry:'P1625',checks:22,policy:mixed.populationPolicy,us:alone.ranked,kr:mixed.byMarket.KR.ranked,PLTR:{ret1m:pltr.ret1m,ret3m:pltr.ret3m,ret6m:pltr.ret6m,pctSma50:pltr.pctSma50,pctSma200:pltr.pctSma200}},null,2));
