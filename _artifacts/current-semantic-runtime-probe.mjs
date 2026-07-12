import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const ROOT='C:/Projects/AIO',PORT=8898,BASE=`http://127.0.0.1:${PORT}/index.html`;
const ROUTES=['home','signal','breadth','sentiment','briefing','market-news','technical','screener','ticker','portfolio','themes','theme-detail','macro','fxbond','fundamental','options','kr-home','kr-supply','kr-themes','kr-macro','kr-technical','guide'];
const server=spawn(process.execPath,['scripts/start-local-node.mjs',String(PORT)],{cwd:ROOT,stdio:['ignore','pipe','pipe']});
await new Promise(r=>setTimeout(r,2000));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push({kind:'pageerror',message:String(e?.message||e)}));
page.on('console',m=>{if(m.type()==='error')errors.push({kind:'console',message:m.text()});});
await page.route('**/*',route=>{const u=route.request().url();if(u.startsWith(`http://127.0.0.1:${PORT}/`))return route.continue();return route.fulfill({status:204,body:''});});
await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForFunction(()=>typeof window.showPage==='function');
await page.waitForTimeout(5000);
const report={generatedAt:new Date().toISOString(),waitBeforeAuditMs:5000,global:{},routes:[],errors};
report.global=await page.evaluate(()=>{
  const cm=window.AIO?.getCanonicalMetric?.('fearGreed')||window.AIO?.getCanonicalMetric?.('fg')||null;
  const audit=window.AIO?.getDataLineageAudit?.()||null;
  const contracts=window.AIO?.getPageContractAudit?.()||null;
  return {
    version:window.APP_VERSION||null,
    canonicalFearGreed:cm,
    lastFG:window._lastFG??null,
    snapshotFG:window.DATA_SNAPSHOT?.fg??null,
    liveQuoteCount:Object.keys(window._liveData||{}).length,
    screenerRuntimeCount:Object.keys(window._screenerData||window.SCREENER_DATA||{}).length,
    lineage:audit,
    pageContracts:contracts
  };
});
for(const id of ROUTES){
  const before=errors.length;
  await page.evaluate(x=>window.showPage(x,null),id);
  await page.waitForTimeout(1000);
  const row=await page.evaluate(id=>{
    const active=document.querySelector('.page.active');
    const visible=e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return c.display!=='none'&&c.visibility!=='hidden'&&r.width>0&&r.height>0;};
    const text=e=>(e.innerText||e.textContent||'').replace(/\s+/g,' ').trim();
    const els=[...active.querySelectorAll('*')].filter(visible);
    const exactPlaceholder=els.filter(e=>/^(?:—|--|N\/A|null|undefined|NaN|데이터 수신 대기|연결 필요|산정 불가)$/i.test(text(e))).map(e=>({tag:e.tagName.toLowerCase(),id:e.id||'',class:String(e.className||'').slice(0,100),text:text(e)}));
    const evidence=els.filter(e=>e.hasAttribute('data-evidence-id')).map(e=>({id:e.getAttribute('data-evidence-id'),use:e.getAttribute('data-operational-use')||'',text:text(e).slice(0,140)}));
    const fg=els.filter(e=>/(?:Fear\s*&\s*Greed|F&G|공포탐욕)/i.test(text(e))&&e.children.length<5).map(e=>text(e).slice(0,180));
    const status=els.filter(e=>/(?:데이터:|신뢰도|정상 수신|수신 실패|폴백|fallback|스냅샷|실시간|지연|미수신|참고)/i.test(text(e))&&e.children.length<5).map(e=>text(e).slice(0,180));
    const actions=els.filter(e=>/(?:매수|매도|BUY|SELL|진입|청산|비중|포지션)/i.test(text(e))&&e.children.length<4).map(e=>text(e).slice(0,180));
    const firstHeading=active.querySelector('h1,h2,h3,[role=heading]');
    const decision=active.querySelector('[data-page-decision],.aio-page-decision,.page-decision,.decision-header');
    return {requested:id,activeId:active?.id||null,title:firstHeading?text(firstHeading):'',textLength:text(active).length,decision:decision?text(decision).slice(0,600):'',exactPlaceholderCount:exactPlaceholder.length,exactPlaceholder:exactPlaceholder.slice(0,100),evidenceCount:evidence.length,evidence:evidence.slice(0,100),fearGreedMentions:[...new Set(fg)].slice(0,30),statusMentions:[...new Set(status)].slice(0,50),actionMentions:[...new Set(actions)].slice(0,50)};
  },id);
  row.errors=errors.slice(before);
  report.routes.push(row);
  console.log(`[semantic-probe] ${id} active=${row.activeId} placeholders=${row.exactPlaceholderCount} evidence=${row.evidenceCount}`);
}
writeFileSync(`${ROOT}/_artifacts/current-semantic-runtime-probe.json`,JSON.stringify(report,null,2));
console.log(JSON.stringify({global:report.global,routes:report.routes.map(x=>({id:x.requested,active:x.activeId,placeholders:x.exactPlaceholderCount,evidence:x.evidenceCount,fg:x.fearGreedMentions,errors:x.errors.length})),errors:errors.length},null,2));
await browser.close();server.kill();
