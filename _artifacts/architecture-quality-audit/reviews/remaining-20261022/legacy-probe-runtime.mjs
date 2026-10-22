// Read-only fixed-blob audit. Only isolated VM/Chromium fixture state is mutated.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
const REF = '7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const OUT = new URL('./', import.meta.url);
const paths = ['js/aio-workspace.js', 'js/aio-pages.js', 'js/aio-kr-data.js'];
const sources = Object.fromEntries(paths.map(path => [path, execFileSync('git', ['show', `${REF}:${path}`])]));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const identity = paths.map(path => ({ path, ref: REF, blob: execFileSync('git', ['rev-parse', `${REF}:${path}`], { encoding: 'utf8' }).trim(), sha256: sha(sources[path]), currentSha256: sha(fs.readFileSync(path)), lineCountWithTerminalBlank: sources[path].toString().split('\n').length, diff: execFileSync('git', ['diff', REF, '--', path], { encoding: 'utf8' }) }));
const assert = (ok, msg) => { if (!ok) throw new Error(msg); };
function watchlistContext() {
  const data = new Map([['aio_watchlists', JSON.stringify([{ id:'A', name:'A', tickers:[] }, { id:'B', name:'B', tickers:[] }])], ['aio_watchlist_active','A']]);
  const fields = { 'wl-add-ticker': {value:'UFPT'}, 'wl-add-note': {value:'A note'}, 'wl-select': {value:'A'} };
  const c = { window: {}, localStorage:{ getItem:k=>data.get(k) ?? null, setItem:(k,v)=>data.set(k,String(v)) }, document:{addEventListener(){}, getElementById:id=>fields[id] || null}, setTimeout(){}, console };
  vm.createContext(c); vm.runInContext(sources[paths[0]].toString(),c);
  vm.runInContext('var toasts=[]; var renders=0; showToast=function(s){toasts.push(s)}; renderWatchlistContent=function(){renders++}; updateWatchlistButtons=function(){};',c);
  return { c, fields, data };
}
async function watchlistRace({ switchTo='B', resolve={ok:true,id:'UFPT'}, removeA=false }={}) {
  const {c,fields,data}=watchlistContext(); let release;
  c.window._aioAcceptSymbol=()=>new Promise(r=>release=r); c.window._aioToastWithNameHint=()=>{};
  c.addToWatchlist();
  fields['wl-select'].value=switchTo; c.switchWatchlist();
  fields['wl-add-ticker'].value='MSFT'; fields['wl-add-note'].value='B draft';
  if(removeA) data.set('aio_watchlists', JSON.stringify([{id:'B',name:'B',tickers:[]}]));
  release(resolve); await new Promise(r=>setImmediate(r));
  return {requested:'A',active:c.getActiveWatchlistId(),lists:JSON.parse(data.get('aio_watchlists')),draftTicker:fields['wl-add-ticker'].value,draftNote:fields['wl-add-note'].value,renders:c.renders};
}
const watchlist = { switched: await watchlistRace(), unchanged:await watchlistRace({switchTo:'A'}), rejected:await watchlistRace({resolve:{ok:false,id:'UFPT',reason:'not-listed'}}), removed:await watchlistRace({removeA:true}) };
assert(watchlist.switched.lists.find(x=>x.id==='A').tickers.length===0 && watchlist.switched.lists.find(x=>x.id==='B').tickers[0].sym==='UFPT','BND-01 not reproduced');
assert(watchlist.switched.draftTicker==='' && watchlist.unchanged.lists[0].tickers[0].sym==='UFPT' && watchlist.rejected.lists.every(x=>x.tickers.length===0),'watchlist controls failed');
const listing=JSON.parse(execFileSync('git',['show',`${REF}:public-data/us-listings.json`],{encoding:'utf8',maxBuffer:10e6}));
watchlist.symbolEvidence={ symbol:'UFPT', listingIndex:listing.columns.sym.indexOf('UFPT'), listingName:listing.columns.name[listing.columns.sym.indexOf('UFPT')], universeLiteral:execFileSync('git',['show',`${REF}:public-data/screener-universe.json`],{encoding:'utf8',maxBuffer:30e6}).includes('"UFPT"') };
const browser = await chromium.launch({headless:true, executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
let kr;
try {
  const page=await browser.newPage();
  await page.route('**/*',route=>route.abort());
  await page.setContent('<style>#kr-integrated-themes .aio-theme-progressive .kr-theme-card:nth-child(n+4){display:none}#kr-integrated-themes .aio-theme-progressive.is-expanded .kr-theme-card{display:block}</style><main><div class="page active" id="page-themes"><details open id="kr-integrated-themes"><details open id="kr-themes-live"><div id="heat"><button id="all" class="kr-tab active">전체</button><button id="hot" class="kr-tab">hot</button></div><div id="sector"><button id="allsector" class="kr-tab kr-sector-tab active">전체</button><button id="tech" class="kr-tab kr-sector-tab">tech</button></div><div id="kr-theme-container" class="aio-theme-progressive is-expanded"></div></details></details></div></main>');
  await page.addScriptTag({content:'window._aioPageBus={register:(id,event,fn)=>document.addEventListener(event,fn)}; window.escHtml=s=>String(s).replace(/[&<>"\\\']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\\\'":"&#39;","\\\"":"&quot;"}[c]||c));'});
  await page.addScriptTag({content:sources['js/aio-kr-data.js'].toString()});
  kr=await page.evaluate(()=>{
    document.dispatchEvent(new Event('DOMContentLoaded'));
    window._liveData={}; Object.values(KR_THEME_MAP).forEach(rows=>rows.forEach(row=>window._liveData[krTickerToYahoo(row.code)]={price:100,pct:0}));
    KR_THEME_MAP.defense.forEach(row=>window._liveData[krTickerToYahoo(row.code)].pct=4);
    const visible=()=>[...document.querySelectorAll('.kr-theme-card')].filter(x=>getComputedStyle(x).display!=='none').map(x=>x.dataset.themeId);
    const emit=()=>document.dispatchEvent(new CustomEvent('aio:liveQuotes'));
    emit(); filterKrThemes(document.getElementById('hot'),'hot');
    const heatBefore=visible(); emit(); const heatAfter=visible(), heatPressed=document.getElementById('hot').getAttribute('aria-pressed');
    filterKrSector(document.getElementById('tech'),'tech'); const sectorBefore=visible(); emit(); const sectorAfter=visible(), sectorPressed=document.getElementById('tech').getAttribute('aria-pressed');
    filterKrThemes(document.getElementById('hot'),'hot'); filterKrSector(document.getElementById('tech'),'tech'); const combined=visible();
    filterKrSector(document.getElementById('allsector'),'all'); filterKrThemes(document.getElementById('all'),'all');
    const header=document.querySelector('.kr-theme-header'); header.focus(); const focusBefore=document.activeElement.className; emit(); const focusAfter=document.activeElement.tagName;
    return {heatBefore,heatAfter,heatPressed,sectorBefore,sectorAfter,sectorPressed,combined,focusBefore,focusAfter};
  });
  assert(kr.heatBefore.length<kr.heatAfter.length && kr.heatPressed==='true','heat filter reset not reproduced');
  assert(kr.sectorBefore.length<kr.sectorAfter.length && kr.sectorPressed==='true','sector filter reset not reproduced');
} finally { await browser.close(); }
// Full actual risk function, fake observations only. Show old response replacing a newer composition's hold.
const risk=await (async()=>{
  let positions=[{ticker:'A',qty:1,cost:100}], release;
  const host={innerHTML:'',insertAdjacentHTML(){}};
  const c={window:{},document:{addEventListener(){},getElementById:id=>id==='pf-risk-metrics'?host:null},setTimeout(){},console};
  vm.createContext(c); vm.runInContext(sources[paths[0]].toString(),c);
  c.getPortfolioData=()=>positions; c.refreshPortfolioLedgerPerformance=()=>null; c.readPortfolioAssumptionDeclarations=()=>({}); c.getPortfolioFxLegs=()=>[];
  c._fetchYahooChartData=t=>t==='A'?new Promise(r=>release=r):Promise.resolve(null);
  c.window._pfAssembleRiskEstimateInput=({positions})=>({ok:true,returnsMap:{A:[0.1,0.2]},snapshot:{ticker:positions[0].ticker},estimate:{status:'ready',compositionSnapshotId:'book:'+positions[0].ticker,publishedReturns:[0.1,0.2],publishedScope:'invested_sleeve'},minLen:5});
  c._aioRenderPortfolioExposure=()=>{}; c._aioRenderPortfolioStress=()=>{}; c.refreshPortfolioTechnicalRisk=()=>{};
  const first=c.refreshPortfolioRisk(); positions=[{ticker:'B',qty:1,cost:100}]; await c.refreshPortfolioRisk(); const newer=host.innerHTML;
  release({adjustedCloses:[1,2,3,4,5,6],timestamps:[1,86401,172801,259201,345601,432001]}); await first;
  const result={currentHolding:positions[0].ticker,newerResponse:newer,finalResponse:host.innerHTML.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(),finalSnapshotTicker:c.window._lastPortfolioRiskEstimate.snapshot.ticker}; assert(result.newerResponse.includes('B')&&result.finalSnapshotTicker==='A'&&result.finalResponse.includes('snapshot book:A'),'risk response inversion not reproduced'); return result;
})();
const report={ref:REF,identity,watchlist,kr,risk,evidenceLevel:'isolated VM and Chromium DOM; no live product/account/network/AI action'};
fs.writeFileSync(new URL('legacy-probe-runtime.json',OUT),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
