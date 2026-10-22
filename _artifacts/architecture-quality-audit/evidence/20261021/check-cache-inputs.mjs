// Audit import closure against the actual runner's declared cache inputs.
import fs from 'node:fs';
const dir='_artifacts/architecture-quality-audit/evidence/20261021';
const manifest=JSON.parse(fs.readFileSync('architecture/qa-pipeline.json','utf8'));
const edges=JSON.parse(fs.readFileSync(`${dir}/code-imports.json`,'utf8'));
function glob(pattern){return new RegExp('^'+String(pattern).replace(/[.+^${}()|[\]\\]/g,'\\$&').replaceAll('**','\u0000').replaceAll('*','[^/]*').replaceAll('?','[^/]').replaceAll('\u0000','.*')+'$');}
const rows=[];
for(const [groupName,group] of Object.entries(manifest.groups))for(const gate of group.gates){
  if(!(gate.cache??group.cache??true))continue;
  const seen=new Set(),q=[gate.script];
  while(q.length){const p=q.pop();if(seen.has(p))continue;seen.add(p);for(const e of edges.filter(e=>e.from===p))q.push(e.to);}
  const patterns=gate.inputs||group.inputs||[];
  const missing=[...seen].filter(p=>p!==gate.script&&!patterns.some(pattern=>glob(pattern).test(p)));
  if(missing.length)rows.push({id:gate.id,group:groupName,script:gate.script,inputs:patterns,uncoveredStaticImports:missing});
}
const result={boundary:'Parser-derived static local imports only. A missing declared input proves potential stale cache identity, not that current product QA is failing.',affectedGateCount:rows.length,rows};
fs.writeFileSync(`${dir}/cache-input-review.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({affectedGateCount:rows.length,rows:rows.map(r=>({id:r.id,missing:r.uncoveredStaticImports}))},null,2));
