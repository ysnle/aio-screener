import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const ROOT='C:/Projects/AIO',PORT=8899,BASE=`http://127.0.0.1:${PORT}/index.html`;
const server=spawn(process.execPath,['scripts/start-local-node.mjs',String(PORT)],{cwd:ROOT,stdio:'ignore'});await new Promise(r=>setTimeout(r,2000));
const browser=await chromium.launch({headless:true}),page=await browser.newPage({viewport:{width:1440,height:900}});
await page.route('**/*',r=>r.request().url().startsWith(`http://127.0.0.1:${PORT}/`)?r.continue():r.fulfill({status:204,body:''}));
await page.goto(BASE,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>typeof window.showPage==='function');await page.waitForTimeout(5000);
const result={generatedAt:new Date().toISOString(),global:await page.evaluate(()=>({canonical:window.AIO?.getCanonicalMetric?.('fg')||null,lastFG:window._lastFG??null,snapshotFG:window.DATA_SNAPSHOT?.fg??null,fieldTs:window.DATA_SNAPSHOT?._fieldTs?.fearGreed??null,lastFetch:window._lastFetch?.fearGreed??null})),routes:{}};
for(const route of ['home','signal','sentiment','briefing']){await page.evaluate(x=>window.showPage(x,null),route);await page.waitForTimeout(1000);result.routes[route]=await page.evaluate(()=>{const a=document.querySelector('.page.active');const vis=e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.height>0;};return[...a.querySelectorAll('[id*="fg" i],[class*="fg" i],[data-snap="fg"]')].filter(vis).map(e=>({tag:e.tagName,id:e.id||'',class:String(e.className||''),snap:e.getAttribute('data-snap'),text:(e.innerText||e.textContent||'').replace(/\s+/g,' ').trim().slice(0,240)}));});}
writeFileSync(`${ROOT}/_artifacts/canonical-fg-probe.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await browser.close();server.kill();
