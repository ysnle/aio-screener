import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';
const wt='.cache/worktrees/semantic-operations';
for(const file of ['src/domain/signal/page-decision.js','scripts/ci-page-decision-reference-check.mjs','src/app/bootstrap.js']){
  mkdirSync(file.slice(0,file.lastIndexOf('/')),{recursive:true});
  copyFileSync(`${wt}/${file}`,file);
}
let main=readFileSync('js/aio-core.js','utf8');
const other=readFileSync(`${wt}/js/aio-core.js`,'utf8');
for(const name of ['_aioBuildPageDecision','_aioRenderPageDecisionHeader']){
  const start=`window.${name} = function(pageId) {`;
  const from=main.indexOf(start), to=main.indexOf('\n};',from)+4;
  const a=other.indexOf(start), b=other.indexOf('\n};',a)+4;
  if(from<0||a<0||to<from||b<a)throw Error(`function boundary ${name}`);
  main=main.slice(0,from)+other.slice(a,b)+main.slice(to);
}
writeFileSync('js/aio-core.js',main);
console.log('Integrated two exact owned functions, helper, regression gate and inspected bootstrap diff.');
