import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const ROOT='C:/Projects/AIO', PORT=8897, BASE=`http://127.0.0.1:${PORT}/index.html`;
const server=spawn(process.execPath,['scripts/start-local-node.mjs',String(PORT)],{cwd:ROOT,stdio:['ignore','pipe','pipe']});
await new Promise(r=>setTimeout(r,2000));
const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:1024,height:768}});
const errors=[];
page.on('pageerror',e=>errors.push(String(e?.message||e)));
page.on('console',m=>{if(m.type()==='error'&&!/integrity.*resource.*blocked/i.test(m.text())) errors.push(m.text());});
await page.route('**/*',route=>{
  const url=route.request().url();
  if(url.startsWith(`http://127.0.0.1:${PORT}/`)) return route.continue();
  return route.fulfill({status:204,body:''});
});
await page.goto(BASE,{waitUntil:'domcontentloaded',timeout:30000});
await page.waitForFunction(()=>typeof window.showPage==='function');
const result={generatedAt:new Date().toISOString(),viewport:'1024x768',checks:[],errors};
async function shown(id){await page.evaluate(id=>window.showPage(id,null),id);await page.waitForTimeout(250);}
async function check(name,fn){try{const detail=await fn();result.checks.push({name,pass:!!detail.pass,detail});}catch(e){result.checks.push({name,pass:false,error:String(e?.message||e)});}}

await shown('screener');
await check('screener-tabs-profile-advanced-search',async()=>page.evaluate(()=>{
  const click=s=>document.querySelector(s)?.click();
  click('[data-action="_aioScreenerTab"][data-arg="factors"]');
  const factorsVisible=document.getElementById('scr-tab-factors')?.style.display!=='none';
  click('[data-action="_aioScreenerTab"][data-arg="ranking"]');
  const rankingVisible=document.getElementById('scr-tab-ranking')?.style.display!=='none';
  click('[data-action="_aioToggleAdvFilters"]'); const advOn=document.getElementById('scr-adv-filter-row')?.classList.contains('active');
  click('[data-action="_aioToggleAdvFilters"]'); const advOff=!document.getElementById('scr-adv-filter-row')?.classList.contains('active');
  click('[data-action="_aioSetProfile"][data-arg="momentum"]'); const momentum=document.querySelector('[data-action="_aioSetProfile"][data-arg="momentum"]')?.classList.contains('active');
  click('[data-action="_aioSetProfile"][data-arg="balanced"]');
  const input=document.getElementById('scr-text-search'); if(input){input.value='NVDA';input.dispatchEvent(new Event('input',{bubbles:true}));input.value='';input.dispatchEvent(new Event('input',{bubbles:true}));}
  return {pass:factorsVisible&&rankingVisible&&advOn&&advOff&&momentum, factorsVisible,rankingVisible,advOn,advOff,momentum,searchExists:!!input};
}));

await shown('kr-supply');
await check('kr-supply-tabs',async()=>page.evaluate(()=>{
  const tabs=[...document.querySelectorAll('[data-action="krSupplyTab"]')]; const target=tabs.find(x=>x.dataset.arg==='weekly')||tabs[1]; target?.click();
  const id=target?.dataset.arg||''; const visible=document.getElementById('kr-supply-'+id)?.style.display!== 'none';
  tabs[0]?.click(); return {pass:!!target&&visible,tab:id,visible};
}));

await shown('kr-themes');
await check('kr-themes-filter-roundtrip',async()=>page.evaluate(()=>{
  const all=[...document.querySelectorAll('#kr-theme-container .kr-theme-card')]; const hot=document.querySelector('[data-action="filterKrThemes"][data-arg="hot"]'); hot?.click();
  const filtered=[...document.querySelectorAll('#kr-theme-container .kr-theme-card')].filter(x=>getComputedStyle(x).display!=='none').length;
  const reset=document.querySelector('[data-action="filterKrThemes"][data-arg="all"]'); reset?.click();
  const restored=[...document.querySelectorAll('#kr-theme-container .kr-theme-card')].filter(x=>getComputedStyle(x).display!=='none').length;
  return {pass:!!hot&&!!reset&&filtered<=all.length&&restored===all.length,total:all.length,filtered,restored};
}));

await shown('guide');
await check('guide-search',async()=>page.evaluate(()=>{
  const input=document.querySelector('#guide-search-input,input[placeholder*="검색"]'); if(input){input.value='스크리너';input.dispatchEvent(new Event('input',{bubbles:true}));}
  const trigger=document.querySelector('[data-action="_aioGuideSearchTrigger"]'); trigger?.click();
  return {pass:!!input&&!!trigger,input:!!input,trigger:!!trigger};
}));

await shown('home'); await shown('signal');
await check('browser-back-route',async()=>{
  await page.goBack({waitUntil:'domcontentloaded',timeout:10000}).catch(()=>null); await page.waitForTimeout(300);
  return page.evaluate(()=>({pass:document.querySelector('.page.active')?.id==='page-home',active:document.querySelector('.page.active')?.id,hash:location.hash}));
});

await shown('screener');
await check('reload-route-recovery',async()=>{
  await page.reload({waitUntil:'commit',timeout:10000}); await page.waitForFunction(()=>typeof window.showPage==='function',{timeout:45000}); await page.waitForTimeout(400);
  return page.evaluate(()=>({pass:document.querySelector('.page.active')?.id==='page-screener',active:document.querySelector('.page.active')?.id,hash:location.hash}));
});

result.pass=result.checks.every(x=>x.pass)&&result.errors.length===0;
writeFileSync(ROOT+'/_artifacts/desktop-journey-audit.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({pass:result.pass,checks:result.checks,errors:result.errors},null,2));
await browser.close();server.kill();
