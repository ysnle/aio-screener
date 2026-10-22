// Actual inline chart coordinator, simulated CDN errors and Canvas recorder. No browser/CDN requests.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const html=fs.readFileSync('index.html','utf8');
const blocks=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  .filter(match=>!/(?:^|\s)src\s*=/.test(match[1])&&!/type\s*=\s*["']text\/plain/.test(match[1])&&match[2].trim());
const parsed=blocks.map((match,index)=>{new vm.Script(match[2],{filename:`index.html:inline-${index+1}`});return {index:index+1,startLine:html.slice(0,match.index).split('\n').length,chars:match[2].length,status:'PARSED_NOT_EXECUTED'};});
const source=blocks.find(match=>match[2].includes('function coordinateChartDependency()'))[2];
function probe(values){
  const scripts=[],points=[];
  const canvas={isConnected:true,clientWidth:320,clientHeight:160};
  const ctx={canvas,clearRect(){},fillText(){},beginPath(){},stroke(){},moveTo(x,y){points.push([x,y]);},lineTo(x,y){points.push([x,y]);}};
  canvas.getContext=()=>ctx;
  const placeholder={getAttribute:key=>key==='data-aio-src'?'https://example.invalid/primary.js':'',dispatchEvent(){}};
  const document={body:{},head:{appendChild:script=>scripts.push(script)},getElementById:()=>placeholder,addEventListener(){},
    createElement:()=>({handlers:{},addEventListener(type,fn){this.handlers[type]=fn;}})};
  const window={};
  new vm.Script(source).runInNewContext({window,document,location:{hash:''},setTimeout:()=>1,clearTimeout(){},console:{warn(){}},getComputedStyle:()=>({getPropertyValue:()=>''})});
  new window.Chart(canvas,{data:{datasets:[{data:values}]}});
  scripts[0].handlers.error();
  scripts[1].handlers.error();
  return {fallbackInstalled:window.Chart.__aioFallback===true,points};
}
const result={evidence:'Actual inline coordinator with simulated CDN error events and a canvas recorder; no browser/layout/live certification',
  parsedInlineScripts:parsed,missingValue:probe([10,null,20]),actualZeroPositiveControl:probe([10,0,20]),sourceSha256:crypto.createHash('sha256').update(html).digest('hex')};
fs.writeFileSync('_artifacts/architecture-quality-audit/evidence/20261019/chart-fallback-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
