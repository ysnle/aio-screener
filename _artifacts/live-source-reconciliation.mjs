import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { closesToFactors } from '../scripts/fetch-data.mjs';

const ROOT = 'C:/Projects/AIO';
const LIVE = 'https://ysnle.github.io/aio-screener/public-data';
const OUT = resolve(ROOT, '_artifacts', 'live-source-reconciliation.json');
const UA = { 'User-Agent': 'Mozilla/5.0 (compatible; AIO-Screener-audit/1.0)' };
const report = { generatedAt:new Date().toISOString(), target:LIVE, live:{}, quoteReconciliation:{}, screenerReconciliation:{}, macroReconciliation:{}, newsReachability:{}, failures:[], limitations:[] };

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fetchTimeout(url, opts={}, ms=20000) {
  const ctrl = new AbortController(); const timer=setTimeout(()=>ctrl.abort(),ms);
  try { return await fetch(url,{...opts,signal:ctrl.signal,headers:{...UA,...(opts.headers||{})}}); }
  finally { clearTimeout(timer); }
}
async function json(url) { const r=await fetchTimeout(url,{},30000); if(!r.ok) throw new Error(`${r.status} ${url}`); return r.json(); }
async function pool(items, concurrency, fn, label) {
  const out=new Array(items.length); let next=0, done=0;
  const workers=Array.from({length:concurrency},async()=>{
    for (;;) { const i=next++; if(i>=items.length) break; try{out[i]=await fn(items[i],i);}catch(e){out[i]={ok:false,error:String(e?.message||e)};} done++; if(done%50===0||done===items.length) console.log(`[reconcile] ${label} ${done}/${items.length}`); }
  });
  await Promise.all(workers); return out;
}
function mean(a){return a.length?a.reduce((x,y)=>x+y,0)/a.length:null;}
function near(a,b,tol){return typeof a==='number'&&typeof b==='number'&&Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tol;}
function yahooSym(s){return String(s).replace(/^([A-Z]+)\.([A-Z])$/,'$1-$2');}
async function yahooChart(symbol, range='1y') {
  let last;
  for(const host of ['https://query1.finance.yahoo.com','https://query2.finance.yahoo.com']){
    try{
      const u=`${host}/v8/finance/chart/${encodeURIComponent(yahooSym(symbol))}?interval=1d&range=${range}&events=div%2Csplits`;
      const j=await json(u); const r=j?.chart?.result?.[0]; if(!r?.meta) throw new Error('missing Yahoo chart result');
      const raw=r.indicators?.quote?.[0]?.close||[]; const adj=r.indicators?.adjclose?.[0]?.adjclose||[];
      const pairs=[]; for(let i=0;i<raw.length;i++){const c=raw[i],a=adj[i]; if(typeof c==='number'&&c>0)pairs.push({ts:r.timestamp?.[i]||null,close:c,adj:typeof a==='number'&&a>0?a:c});}
      return {ok:true,symbol,meta:r.meta,pairs};
    }catch(e){last=e; await sleep(120);}
  }
  throw last;
}

const [data,screener]=await Promise.all([json(`${LIVE}/data.json?audit=${Date.now()}`),json(`${LIVE}/screener.json?audit=${Date.now()}`)]);
report.live={dataGeneratedAt:data.meta?.generatedAt||data.generatedAt||null,screenerAsOf:screener.asOf||null,quoteCount:(data.quotes||[]).length,screenerCount:Object.keys(screener.data||{}).length,newsCount:(data.news||[]).length,macroCount:Object.keys(data.macro||{}).filter(k=>!k.startsWith('_')&&!k.endsWith('Delta')).length};

const quoteResults=await pool(data.quotes||[],4,async q=>{
  const y=await yahooChart(q.symbol,'5d'); const last=y.pairs.at(-1),prev=y.pairs.at(-2); const sourcePrice=y.meta.regularMarketPrice??last?.close;
  const sourcePrev=prev?.close??y.meta.chartPreviousClose??y.meta.previousClose;
  const sourcePct=sourcePrice&&sourcePrev?(sourcePrice/sourcePrev-1)*100:null;
  const checks={price:near(q.regularMarketPrice,sourcePrice,Math.max(0.02,Math.abs(sourcePrice||0)*0.0002)),previousClose:near(q.regularMarketPreviousClose,sourcePrev,Math.max(0.02,Math.abs(sourcePrev||0)*0.0002)),pct:near(q.regularMarketChangePercent,sourcePct,0.03)};
  const expectedContinuousMarketDrift=/-USD$/.test(q.symbol)&&typeof y.meta.regularMarketTime==='number'&&Date.parse(data.meta?.generatedAt||0)<y.meta.regularMarketTime*1000;
  return {ok:Object.values(checks).every(Boolean),expectedContinuousMarketDrift,symbol:q.symbol,checks,artifact:{price:q.regularMarketPrice,previousClose:q.regularMarketPreviousClose,pct:q.regularMarketChangePercent},source:{price:sourcePrice,previousClose:sourcePrev,pct:sourcePct,regularMarketTime:y.meta.regularMarketTime||null,exchange:y.meta.exchangeName||y.meta.fullExchangeName||null,timezone:y.meta.exchangeTimezoneName||null,gmtoffset:y.meta.gmtoffset??null,dataGranularity:y.meta.dataGranularity||null}};
},'quotes');
report.quoteReconciliation={total:quoteResults.length,passed:quoteResults.filter(x=>x.ok).length,failed:quoteResults.filter(x=>!x.ok).length,expectedContinuousMarketDrift:quoteResults.filter(x=>x.expectedContinuousMarketDrift).length,networkFailed:quoteResults.filter(x=>x.error).length,rows:quoteResults};

const stockEntries=Object.entries(screener.data||{}).map(([symbol,row])=>({symbol,...row}));
const stockResults=await pool(stockEntries,4,async s=>{
  const y=await yahooChart(s.symbol,'1y'); const closes=y.pairs.map(x=>x.adj); const f=closesToFactors(closes); if(!f) throw new Error('insufficient valid closes');
  const tolerances={price:0.03,ret1m:0.03,ret3m:0.03,ret6m:0.03,vol:0.04,rsi:0.11,pctSma50:0.03,pctSma200:0.03,kalmanVel:0.000002,kalmanPt:0.000002,kalmanInnovZ:0.0002,kalmanVelConf:0.000002};
  const materialTolerances={price:Math.max(0.03,Math.abs(f.price||0)*0.0002),ret1m:0.15,ret3m:0.15,ret6m:0.15,vol:0.12,rsi:0.2,pctSma50:0.08,pctSma200:0.08,kalmanVel:0.003,kalmanPt:0.00001,kalmanInnovZ:0.005,kalmanVelConf:0.003};
  const checks={},materialChecks={}; for(const [k,t] of Object.entries(tolerances)){ if(s[k]==null&&f[k]==null){checks[k]=true;materialChecks[k]=true;}else{checks[k]=near(s[k],f[k],t);materialChecks[k]=near(s[k],f[k],materialTolerances[k]);} }
  return {ok:Object.values(checks).every(Boolean),materiallyOk:Object.values(materialChecks).every(Boolean),symbol:s.symbol,checks,materialChecks,mismatches:Object.keys(checks).filter(k=>!checks[k]).map(k=>({field:k,artifact:s[k],sourceDerived:f[k],absoluteDifference:Math.abs(Number(s[k])-Number(f[k]))})),materialMismatches:Object.keys(materialChecks).filter(k=>!materialChecks[k]).map(k=>({field:k,artifact:s[k],sourceDerived:f[k]})),source:{lastTimestamp:y.pairs.at(-1)?.ts||null,exchange:y.meta.exchangeName||null,timezone:y.meta.exchangeTimezoneName||null,validBars:closes.length}};
},'screener');
const mismatchByField={}; for(const x of stockResults) for(const m of x.mismatches||[]) mismatchByField[m.field]=(mismatchByField[m.field]||0)+1;
report.screenerReconciliation={total:stockResults.length,strictPassed:stockResults.filter(x=>x.ok).length,strictFailed:stockResults.filter(x=>!x.ok).length,materialPassed:stockResults.filter(x=>x.materiallyOk).length,materialFailed:stockResults.filter(x=>!x.materiallyOk).length,networkFailed:stockResults.filter(x=>x.error).length,mismatchByField,rows:stockResults};

const FRED={cpi:{id:'CPIAUCSL',kind:'yoy'},coreCpi:{id:'CPILFESL',kind:'yoy'},pce:{id:'PCEPI',kind:'yoy'},corePce:{id:'PCEPILFE',kind:'yoy'},fedRate:{id:'FEDFUNDS',kind:'level'},unemployment:{id:'UNRATE',kind:'level'},nfp:{id:'PAYEMS',kind:'mom_diff'},housingStarts:{id:'HOUST',kind:'level',scale:0.001},retailSales:{id:'RSAFS',kind:'mom_pct'},usWageGrowth:{id:'CES0500000003',kind:'yoy'}};
function monthsBetween(a,b){const x=new Date(`${a}T00:00:00Z`),y=new Date(`${b}T00:00:00Z`);return (y.getUTCFullYear()-x.getUTCFullYear())*12+y.getUTCMonth()-x.getUTCMonth();}
function round(v,n){const p=10**n;return Math.round(v*p)/p;}
async function fredCsv(id){const r=await fetchTimeout(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`,{},30000);if(!r.ok)throw new Error(`FRED ${id} ${r.status}`);const txt=await r.text();return txt.trim().split(/\r?\n/).slice(1).map(line=>{const i=line.indexOf(',');return{d:line.slice(0,i),v:Number(line.slice(i+1))};}).filter(x=>Number.isFinite(x.v)).reverse();}
function fredDerive(obs,spec){if(spec.kind==='level')return round(obs[0].v*(spec.scale||1),3);if(spec.kind==='mom_pct')return round((obs[0].v/obs[1].v-1)*100,1);if(spec.kind==='mom_diff')return Math.round(obs[0].v-obs[1].v);if(spec.kind==='yoy'){const cur=obs[0],base=obs.find(o=>monthsBetween(o.d,cur.d)>=12)||obs.at(-1);return round((cur.v/base.v-1)*100,1);}return null;}
const macroResults=await pool(Object.entries(FRED),2,async([field,spec])=>{const obs=await fredCsv(spec.id);const derived=fredDerive(obs,spec),artifact=data.macro?.[field],asOf=data.macro?.[`_asOf_${field}`]||null;return{ok:near(artifact,derived,0.011),field,series:spec.id,artifact,sourceDerived:derived,artifactAsOf:asOf,sourceAsOf:obs[0]?.d||null,sourceRows:obs.length};},'macro');
report.macroReconciliation={total:macroResults.length,passed:macroResults.filter(x=>x.ok).length,failed:macroResults.filter(x=>!x.ok).length,networkFailed:macroResults.filter(x=>x.error).length,rows:macroResults};

const newsResults=await pool(data.news||[],4,async n=>{const r=await fetchTimeout(n.link,{redirect:'follow'},15000);return{ok:r.ok,title:n.title,source:n.source,status:r.status,original:n.link,finalUrl:r.url,redirected:r.url!==n.link,pubDate:n.pubDate};},'news');
report.newsReachability={total:newsResults.length,passed:newsResults.filter(x=>x.ok).length,failed:newsResults.filter(x=>!x.ok).length,networkFailed:newsResults.filter(x=>x.error).length,rows:newsResults};

for(const [name,part] of Object.entries({quotes:report.quoteReconciliation,macro:report.macroReconciliation,news:report.newsReachability})) if(part.failed||part.networkFailed)report.failures.push(`${name}: failed=${part.failed}, networkFailed=${part.networkFailed}`);
if(report.screenerReconciliation.materialFailed||report.screenerReconciliation.networkFailed)report.failures.push(`screener: materialFailed=${report.screenerReconciliation.materialFailed}, networkFailed=${report.screenerReconciliation.networkFailed}`);
report.limitations.push('Yahoo is the same upstream family used by production, so this proves reproducibility/parity, not independent vendor confirmation.');
report.limitations.push('News HTTP reachability does not prove article claims are factually correct or that redistribution rights exist.');
report.limitations.push('FRED latest CSV values may revise; this audit does not reconstruct vintage values without ALFRED.');
writeFileSync(OUT,JSON.stringify(report,null,2));
console.log(JSON.stringify({output:OUT,live:report.live,quotes:{...report.quoteReconciliation,rows:undefined},screener:{...report.screenerReconciliation,rows:undefined},macro:{...report.macroReconciliation,rows:undefined},news:{...report.newsReachability,rows:undefined},failures:report.failures,limitations:report.limitations},null,2));
