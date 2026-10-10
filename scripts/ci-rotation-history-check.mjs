// P1358: isolated producer regression, no real network, no data artifact writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildRotationHistory, collectRotationHistory, ROTATION_SYMBOLS } from './lib/rotation-history.mjs';
import { latestCompletedUsSession, resolveMarketCalendarSession } from '../src/ai/time/market-session.js';

globalThis.fetch = () => { throw new Error('P1358 fixture attempted real network'); };
const now = Date.parse('2026-10-01T00:34:01Z');
const target = latestCompletedUsSession(now);
function bars(count = 75, end = target.date, asset = false) {
  const dates = [];
  let cursor = Date.parse(`${end}T12:00:00Z`);
  while (dates.length < count) {
    const date = new Date(cursor).toISOString().slice(0,10);
    if (resolveMarketCalendarSession({ market: 'US', date }).status === 'open') dates.unshift(date);
    cursor -= 86400000;
  }
  return dates.map((date,index) => {
    const session = latestCompletedUsSession(Date.parse(`${date}T23:00:00Z`), { requirePrevious: false });
    const close = resolveMarketCalendarSession({ market: 'US', date }).close;
    const duration = Number(close.slice(0,2)) * 60 + Number(close.slice(3)) - 570;
    const endSession=latestCompletedUsSession(Date.parse(`${end}T23:00:00Z`),{requirePrevious:false});
    return { date, instrumentId: asset ? 'XLK' : 'SPY', timeframe: '1d', currency: 'USD', observedAt: new Date(session.closeMs-duration*60000).toISOString(), adjClose: asset ? 100 + index*2 : 200 + index, fetchedAt: new Date(Math.max(now,endSession.closeMs+6*60000)).toISOString() };
  });
}
const wrap = rows => ({ timeframe: '1d', priceBasis: 'adjusted-close', rows });
const spy = bars();
const sector = bars(75,target.date,true);
const histories = { SPY: wrap(spy), XLK: wrap(sector) };
const build = overrides => buildRotationHistory({ histories, now, symbols: ['XLK'], ...overrides });
const baseline = build();
const row = baseline.items.XLK;
assert.equal(row.status,'CURRENT','P1358 valid observed daily bars generate actual rotation evidence');
assert.equal(row.sessionDate,'2026-09-30','P1358 US close date differs from collection UTC date');
assert.equal(row.observedAt,'2026-09-30T20:00:00.000Z','P1358 daily bar-start timestamp is not labelled close observation');
assert.notEqual(row.observedAt,row.fetchedAt,'P1358 collection and close observation remain separate');
assert.equal(row.alignedSessionCount,75,'P1358 complete common dates counted');
const ratios = sector.map((item,index) => item.adjClose/spy[index].adjClose);
const mean = values => values.reduce((sum,value)=>sum+value,0)/values.length;
const rs = 100*ratios.at(-1)/mean(ratios);
const mid = Math.floor(ratios.length/2);
const rsMid = 100*ratios[mid]/mean(ratios.slice(0,mid+1));
assert.ok(Math.abs(row.rsRatio-rs)<1e-7 && Math.abs(row.rsMomentum-100*rs/rsMid)<1e-7,'P1358 rotation matches independently calculated date-aligned ratio oracle');
assert.ok(Math.abs(row.dailyPct-100*(sector.at(-1).adjClose/sector.at(-2).adjClose-1))<1e-7,'P1358 daily percentage is one completed session total return');
assert.ok(Math.abs(row.weeklyPct-100*(sector.at(-1).adjClose/sector.at(-6).adjClose-1))<1e-7,'P1358 weekly percentage is five completed sessions total return');
assert.equal(row.relativeStrength[0].value,100,'P1358 indexed relative history removes absolute quote prices');
assert.ok(!/("close"|"adjClose"|"price"|"closes")\s*:/.test(JSON.stringify(baseline)),'P1358 raw quote prices remain unpublished under P715');
assert.equal(row.allowedUseCeiling,'reference','P1358 delayed source is not promoted to decision use');
assert.equal(row.rightsStatus,'REVIEW_REQUIRED','P1358 free access does not establish redistribution rights');

const reordered = build({ histories:{ SPY:wrap([...spy].reverse()), XLK:wrap([...sector].reverse()) } });
assert.equal(reordered.items.XLK.rsRatio,row.rsRatio,'P1358 provider order cannot misalign trading dates');
const missingInterior = sector.filter((_,index)=>index!==20);
assert.equal(build({ histories:{SPY:wrap(spy),XLK:wrap(missingInterior)} }).items.XLK.alignedSessionCount,74,'P1358 unequal histories join exact date intersection, never positional tail');
const missingPrevious = sector.filter((_,index)=>index!==sector.length-2);
assert.equal(build({histories:{SPY:wrap(spy),XLK:wrap(missingPrevious)}}).items.XLK.dailyPct,null,'P1358 missing previous session cannot become a multi-day daily return');
const missingFifthBenchmark = spy.filter((_,index)=>index!==spy.length-6);
assert.equal(build({histories:{SPY:wrap(missingFifthBenchmark),XLK:wrap(sector)}}).items.XLK.weeklyPct,null,'P1358 missing benchmark date cannot shift five-session horizon');
const missingLatest = build({histories:{SPY:wrap(spy),XLK:wrap(sector.slice(0,-1))}});
assert.equal(missingLatest.items.XLK.status,'UNAVAILABLE','P1358 stale last ETF bar cannot certify latest completed session');
for (const bad of [null,'',true,'100',-1,Infinity,NaN]) {
  const rows=sector.map((item,index)=>index===sector.length-1?{...item,adjClose:bad}:item);
  assert.equal(build({histories:{SPY:wrap(spy),XLK:wrap(rows)}}).items.XLK.status,'UNAVAILABLE','P1358 invalid adjusted close cannot fall back to raw or synthetic price');
}
for (const timeframe of ['1wk','1mo','1h',null]) {
  assert.equal(build({histories:{SPY:wrap(spy),XLK:{...wrap(sector),timeframe}}}).items.XLK.status,'UNAVAILABLE','P1358 timeframe validity is explicit');
}
for (const mismatch of [{instrumentId:'QQQ'},{timeframe:'1wk'},{currency:'KRW'}]) {
  assert.equal(build({histories:{SPY:wrap(spy),XLK:wrap(sector.map(item=>({...item,...mismatch})))}}).items.XLK.reason,'provider-instrument-timeframe-or-currency-mismatch','P1358 provider identity and unit metadata cannot be guessed from requested ETF');
}
assert.equal(build({histories:{SPY:wrap(spy.map(item=>({...item,adjClose:1e300}))),XLK:wrap(sector.map(item=>({...item,adjClose:1e-300})))}}).items.XLK.reason,'relative-ratio-invalid','P1358 arithmetic underflow cannot fabricate neutral 100/100 rotation');
const conflict = [...sector,{...sector[10],adjClose:sector[10].adjClose+10}];
assert.equal(build({histories:{SPY:wrap(spy),XLK:wrap(conflict)}}).items.XLK.reason,'conflicting-session-bars','P1358 conflicting same-date bars fail closed');
assert.equal(build({histories:{SPY:wrap(spy),XLK:wrap([...sector,sector[10]])}}).items.XLK.alignedSessionCount,75,'P1358 identical duplicates never inflate evidence');
const malformedDates = [...sector,{...sector[0],date:'2026-13-40',observedAt:'invalid',adjClose:999},{...sector[0],date:'2026-02-30'},{...sector.at(-1),date:'2026-10-01',observedAt:'2026-10-01T13:30:00Z',adjClose:999}];
assert.equal(build({histories:{SPY:wrap(spy),XLK:wrap(malformedDates)}}).items.XLK.rsRatio,row.rsRatio,'P1358 invalid rollover dates and incomplete future daily bars cannot contaminate result');
assert.equal(build({now:Date.parse('2028-10-01T00:34:01Z')}).status,'UNAVAILABLE','P1358 unknown calendar fails closed');
const inSession = Date.parse('2026-09-30T18:00:00Z');
const fetchedAsOf=(rows,stamp)=>rows.map(item=>({...item,fetchedAt:new Date(stamp).toISOString()}));
const during=build({now:inSession,histories:{SPY:wrap(fetchedAsOf(spy,inSession)),XLK:wrap(fetchedAsOf(sector,inSession))}});
assert.equal(during.items.XLK.sessionDate,'2026-09-29','P1358 live current-session daily bar never enters completed rotation');
const graceNow=Date.parse('2026-09-30T20:02:00Z');
assert.equal(build({now:graceNow,histories:{SPY:wrap(fetchedAsOf(spy,graceNow)),XLK:wrap(fetchedAsOf(sector,graceNow))}}).items.XLK.sessionDate,'2026-09-29','P1358 closing grace avoids treating unfinished provider close as settled');
const halfDay='2026-11-27';
const halfNow=Date.parse('2026-11-27T18:06:00Z');
const halfHist={SPY:wrap(bars(75,halfDay)),XLK:wrap(bars(75,halfDay,true))};
assert.equal(build({now:halfNow,histories:halfHist}).items.XLK.observedAt,'2026-11-27T18:00:00.000Z','P1358 official winter half-day close is DST-aware');
assert.equal(build({now:Date.parse('2026-11-26T22:00:00Z'),histories:{}}).latestCompletedSession,'2026-11-25','P1358 holiday cannot become a regular session');
assert.equal(build({histories:{SPY:wrap(spy),XLK:wrap(fetchedAsOf(sector,now+60000))}}).items.XLK.reason,'provider-collection-time-invalid','P1358 future collection timestamp is not usable evidence');
assert.equal(build({histories:{SPY:wrap(spy),XLK:wrap(fetchedAsOf(sector,target.closeMs-60000))}}).items.XLK.reason,'daily-bar-collected-before-completed-close','P1358 cached intraday daily bar cannot become a completed close merely because the clock advanced');

const failLater=await collectRotationHistory({previous:baseline,now:now+86400000,symbols:['XLK'],fetchHistory:async()=>[],clock:()=>now+86400000});
assert.equal(failLater.status,'RETAINED','P1358 empty source retains durable artifact');
assert.equal(failLater.items.XLK.sessionDate,row.sessionDate,'P1358 failed refresh never advances retained observation date');
assert.equal(failLater.items.XLK.observedAt,row.observedAt,'P1358 failed refresh preserves original observation timestamp');
assert.equal(failLater.generatedAt,baseline.generatedAt,'P1358 empty retry never refreshes artifact production timestamp');
let requests=0;
const cached=await collectRotationHistory({previous:baseline,now:now+10000,symbols:['XLK'],fetchHistory:async()=>{requests++;throw Error('cache failed');},clock:()=>now+10000});
assert.equal(requests,0,'P1358 same completed session uses zero provider calls');
assert.equal(cached.generatedAt,baseline.generatedAt,'P1358 cache reuse does not fabricate a new observation');
assert.equal(cached.collectionStatus,'CACHED_COMPLETED_SESSION','P1358 cache provenance stays explicit');
let active=0,peak=0;
const all=await collectRotationHistory({now,symbols:ROTATION_SYMBOLS,concurrency:3,clock:()=>now,fetchHistory:async(symbol,range)=>{
  assert.equal(range,'6mo','P1358 bounded history source window');requests++;active++;peak=Math.max(peak,active);
  await Promise.resolve();active--;return symbol==='SPY'?spy:sector.map(item=>({...item,instrumentId:symbol}));
}});
assert.equal(all.counts.updated,ROTATION_SYMBOLS.length,'P1358/P1590 every configured sector/subsector ETF can produce evidence');
assert.equal(requests,ROTATION_SYMBOLS.length+1,'P1358 SPY is fetched once for common benchmark');
assert.ok(peak<=3,'P1358 collector preserves bounded concurrency');
const source=await readFile(new URL('./fetch-data.mjs',import.meta.url),'utf8');
assert.match(source,/collectRotationHistory\(\{ fetchHistory, previous: previous\?\.rotationHistory/,'P1358 production collector consumes durable previous evidence');
assert.match(source,/data\.rotationHistory = await rotationHistoryTask;[\s\S]{0,120}atomicWriteFile\(OUT/,'P1358 derived evidence is connected to actual public producer write');
const definitions=await readFile(new URL('../js/aio-pages.js',import.meta.url),'utf8');
const definitionBlock=definitions.slice(definitions.indexOf('var RRG_SECTORS'),definitions.indexOf('// ── 종합 테마 맵'));
const actualSymbols=[...definitionBlock.matchAll(/sym:\s*'([^']+)'/g)].map(match=>match[1]);
assert.deepEqual([...ROTATION_SYMBOLS].sort(),actualSymbols.sort(),'P1358 producer coverage follows actual configured sector and subsector ETF set');
console.log('[rotation-history] P1358 PASS: alignment, completed sessions, input contracts, raw-price ceiling, retention, cache and mock collection (' + ROTATION_SYMBOLS.length + ' ETFs; no network/write)');
