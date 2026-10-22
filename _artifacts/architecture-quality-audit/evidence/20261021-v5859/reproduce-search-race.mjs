// Actual ESM function + minimal isolated DOM; no browser, network or user storage.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {installCompatibilityGlobals} from '../../../../src/app/compatibility-globals.js';
import {resetUsListingsCache} from '../../../../src/data/us-listings.js';
class Element extends EventTarget {
  constructor(tag){super();this.tagName=tag;this.children=[];this.dataset={};this.style={};this.textContent='';this.isConnected=true;}
  setAttribute(name,value){this[name]=value;}
  replaceChildren(...children){this.children=children;}
  append(...children){this.children.push(...children);}
}
class Document extends EventTarget {
  constructor(){super();this.input=new Element('input');this.hint=null;this.input.parentElement={insertAdjacentElement:(_,element)=>{this.hint=element;}};}
  getElementById(id){return id==='ticker-direct-search'?this.input:id==='ticker-search-hint'?this.hint:null;}
  createElement(tag){return new Element(tag);}
}
const nextTurn=()=>new Promise(resolve=>setImmediate(resolve));
const originalFetch=globalThis.fetch;
async function scenario(clearEvent){
  resetUsListingsCache();
  let release,fetches=0;
  globalThis.fetch=function auditListingsFetch(){fetches++;return new Promise(resolve=>{release=resolve;});};
  const document=new Document();
  const root={document,_aioGlossaryBridgeInstalled:true,AIO_TICKER_NAME_REGISTRY:{entries:[]}};
  installCompatibilityGlobals(root);
  root._aioTickerSearchMiss('Acme');
  for(let n=0;n<100&&!release;n++)await nextTurn();
  if(!release)throw new Error('Directory fetch was not reached');
  if(clearEvent==='input')document.input.dispatchEvent(new Event('input'));
  if(clearEvent==='reset')document.dispatchEvent(new Event('aio:tickerViewReset'));
  const afterClear=document.hint.children.length;
  release(new Response(JSON.stringify({schemaVersion:'us-listings.v1',asOf:'2026-10-17',exchanges:{N:'Nasdaq'},columns:{sym:['ACME'],name:['Acme Holdings Common Stock'],exch:'N',etf:'0'}}),{status:200,headers:{'content-type':'application/json'}}));
  for(let n=0;n<100;n++)await nextTurn();
  return {clearEvent,fetches,afterClear,afterResponse:document.hint.children.length,candidates:document.hint.children.flatMap(el=>el.children||[]).map(el=>el.textContent)};
}
try{
  const cases=[];
  for(const event of [null,'input','reset'])cases.push(await scenario(event));
  const result={observedAt:new Date().toISOString(),boundary:'Actual imported function with minimal DOM and deferred fetch stub; not browser UI certification',sourceSha256:crypto.createHash('sha256').update(fs.readFileSync('src/app/compatibility-globals.js')).digest('hex'),cases};
  fs.writeFileSync(new URL('search-race-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result,null,2));
}finally{globalThis.fetch=originalFetch;resetUsListingsCache();}
