import { execFileSync } from 'node:child_process';
import { SourceTextModule } from 'node:vm';
import { posix } from 'node:path';
import { writeFileSync } from 'node:fs';
const ref = '7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const get = (p) => execFileSync('git', ['show', `${ref}:${p}`], {encoding:'utf8',maxBuffer:32*1024*1024});
const mods = new Map();
const moduleFor = (p) => { if (!mods.has(p)) mods.set(p,new SourceTextModule(get(p),{identifier:p})); return mods.get(p); };
async function load(p) { const m=moduleFor(p); if(m.status==='unlinked') await m.link((s,f)=>{ if(!s.startsWith('.'))throw Error('external import forbidden'); return moduleFor(posix.normalize(posix.join(posix.dirname(f.identifier),s))); }); if(m.status!=='evaluated') await m.evaluate(); return m.namespace; }
const {buildDupontRead,reverseDcfInputs,buildRdRead}=await load('src/domain/fundamental/analysis-read.js');
const {fiscalYearLabel}=await load('src/domain/fundamental/period.js');
const nowMs=Date.parse('2026-10-21T04:00:00Z');
const h=[
 {periodEnd:'2023-12-31',revenue:100,netIncome:10,totalAssets:100,equity:50,assetChain:true},
 {periodEnd:'2024-12-31',revenue:100,netIncome:10,totalAssets:100,equity:50,assetChain:true},
 {periodEnd:'2025-12-31',revenue:140,netIncome:14*1.4,totalAssets:250,equity:180,assetChain:true}
];
const dupont=buildDupontRead(h,{nowMs});
const factors=dupont.columns.length===2? ['margin','turnover','leverage'].map(id=>({id,log:Math.log(dupont.columns[1][id]/dupont.columns[0][id])})):[];
const fiscal=JSON.parse(get('public-data/sec-fiscal-history.json'));
const actualFiscal=['LDOS','SNA','TXT','SWK'].map(symbol=>({symbol,lastRecord:fiscal.data[symbol]?.split(';').at(-1)}));
const fyHistory=[{periodEnd:'2026-01-02',revenue:100,netIncome:20,totalAssets:100,equity:50,assetChain:true,researchAndDevelopment:3,operatingCashFlow:30,capex:10}];
const fiscalLabels={existing:fiscalYearLabel('2026-01-02'),dupont:buildDupontRead(fyHistory,{nowMs}).columns?.[0]?.label,rd:buildRdRead(fyHistory).latest?.label,dcf:reverseDcfInputs({history:fyHistory,fundamentals:{sharesOutstanding:10,sharesObservedAt:'2026-02-01'},close:{date:'2026-10-20',value:100},nowMs}).label};
const actualLdosHistory=fiscal.data.LDOS.split(';').map(part=>{const [periodEnd,revenue,netIncome,equity,operatingCashFlow,capex]=part.split(':');const num=x=>x===''?null:Number(x)*1e6;return {periodEnd,revenue:num(revenue),netIncome:num(netIncome),equity:num(equity),operatingCashFlow:num(operatingCashFlow),capex:num(capex)};});
// The actual pinned LDOS annual history, with explicitly synthetic share/price inputs to exercise the dated label path.
const actualLdosDcf=reverseDcfInputs({history:actualLdosHistory,fundamentals:{sharesOutstanding:100,sharesObservedAt:'2026-02-01'},close:{date:'2026-10-20',value:100},nowMs});
const {buildKrInvestorFlowView}=await load('src/domain/market/kr-investor-flows.js');
const krView=buildKrInvestorFlowView({schemaVersion:'kr-investor-flows.v1',status:'ok',markets:{kospi:{latestDate:'2026-10-16',investors:{foreign:{series:[{date:'2026-10-16',value:123}]}}}}},{nowMs});
const {buildReferenceTickerMap}=await load('src/domain/masters/ticker-exact.js');
const reference=JSON.parse(get('public-data/masters/security-master-reference.json'));
const byCusip=new Map(); for(const r of reference.records||[]){ const k=r.cusipNormalized; const rows=byCusip.get(k)||[];rows.push(r.tickerReference);byCusip.set(k,rows); }
const actualCollisions=[...byCusip].filter(([,v])=>new Set(v).size>1);
const {estimateBookSensitivities}=await load('src/domain/portfolio/stress-sensitivity.js');
const {buildCloseSeries}=await load('src/domain/briefing/market-read.js');
const allDates=Array.from({length:320},(_,i)=>new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10));
const dates=buildCloseSeries(allDates.map((date)=>({date,spx:100})),'spx').slice(0,180).map(p=>p.date);
const fxHistory=dates.map((date,i)=>({date,spx:100+i+i*i/100,usdkrw:100+i+i*i/100}));
const price=Object.fromEntries(dates.map(d=>[d,100]));
const translatedPrice=Object.fromEntries(fxHistory.map(r=>[r.date,100*r.usdkrw]));
const localFit=estimateBookSensitivities({historyMap:{AAA:price},commonDates:dates,weights:{AAA:1},history:fxHistory});
const krwBookFit=estimateBookSensitivities({historyMap:{AAA:translatedPrice},commonDates:dates,weights:{AAA:1},history:fxHistory});
const portfolioFx={localEquityFit:localFit.fits?.equity,krwBookEquityFit:krwBookFit.fits?.equity,dates:dates.length};
const out={ref,dupont,factors,actualFiscal,fiscalLabels,actualLdosDcf,krAge5:krView,actualReferenceConflicts:actualCollisions,portfolioFx,loaded:[...mods.keys()]};
writeFileSync(new URL('./domain-probe-result.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out,null,2));
