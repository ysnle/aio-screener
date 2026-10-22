// Structural analysis; never executes application modules or writes product data.
// Run with node --experimental-vm-modules. No package installation is required.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
const dir='_artifacts/architecture-quality-audit/evidence/20261020';
const inventory=JSON.parse(fs.readFileSync(`${dir}/source-inventory.json`,'utf8'));
const write=(p,v)=>fs.writeFileSync(`${dir}/${p}`,JSON.stringify(v,null,2)+'\n');
const layer=p=>p.startsWith('src/')?p.split('/').slice(0,2).join('/'):'other';
const parsed=[],edges=[],unresolved=[],codeEdges=[];
for(const f of inventory.sources.filter(f=>/\.[cm]?js$/.test(f.path))){
  const code=fs.readFileSync(f.path,'utf8');
  try{
    const module=new vm.SourceTextModule(code,{identifier:f.path});
    parsed.push({path:f.path,status:'PARSED_NOT_EXECUTED',sha256:f.sha256});
    for(const specifier of module.dependencySpecifiers.filter(s=>s.startsWith('.'))){
      const to=path.posix.normalize(path.posix.join(path.posix.dirname(f.path),specifier.split(/[?#]/)[0]));
      if(fs.existsSync(to))codeEdges.push({from:f.path,to,kind:'static'});
    }
    if(f.path.startsWith('src/')){
      const imports=module.dependencySpecifiers.map(specifier=>({specifier,kind:'static'}));
      for(const match of code.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g))imports.push({specifier:match[1],kind:'literal-dynamic'});
      for(const item of imports){
        if(!item.specifier.startsWith('.')){unresolved.push({from:f.path,...item,reason:'non-relative specifier'});continue;}
        const to=path.posix.normalize(path.posix.join(path.posix.dirname(f.path),item.specifier.split(/[?#]/)[0]));
        if(!fs.existsSync(to))unresolved.push({from:f.path,to,...item,reason:'not found'});
        else edges.push({from:f.path,to,kind:item.kind});
      }
    }
  }catch(e){parsed.push({path:f.path,status:'PARSE_ERROR',message:e.message,sha256:f.sha256});}
}
const reachable=(dynamic)=>{const seen=new Set(),q=['src/app/bootstrap.js'];while(q.length){const id=q.pop();if(seen.has(id))continue;seen.add(id);for(const e of edges.filter(e=>e.from===id&&(dynamic||e.kind==='static')))q.push(e.to);}return seen;};
const boot=reachable(false),all=reachable(true);
let index=0;const indices=new Map(),low=new Map(),stack=[],active=new Set(),components=[];
function visit(v){indices.set(v,index);low.set(v,index++);stack.push(v);active.add(v);for(const e of edges.filter(e=>e.from===v&&e.kind==='static')){const w=e.to;if(!indices.has(w)){visit(w);low.set(v,Math.min(low.get(v),low.get(w)));}else if(active.has(w))low.set(v,Math.min(low.get(v),indices.get(w)));}if(low.get(v)===indices.get(v)){const part=[];let w;do{w=stack.pop();active.delete(w);part.push(w);}while(w!==v);if(part.length>1)components.push(part.sort());}}
for(const p of inventory.sources.filter(f=>f.path.startsWith('src/')&&f.path.endsWith('.js')).map(f=>f.path))if(!indices.has(p))visit(p);
const fanIn=new Map(),fanOut=new Map();for(const e of edges){fanIn.set(e.to,(fanIn.get(e.to)||0)+1);fanOut.set(e.from,(fanOut.get(e.from)||0)+1);}
const ranked=map=>[...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,25).map(([path,count])=>({path,count}));
const patterns={globalRead:/\b(?:window|globalThis)\b/g,domAccess:/\b(?:document|innerHTML|querySelector|getElementById)\b/g,storage:/\b(?:localStorage|sessionStorage|indexedDB)\b/g,network:/\bfetch\s*\(/g,emptyCatch:/catch\s*\([^)]*\)\s*\{\s*\}/g,timer:/\b(?:setInterval|setTimeout)\s*\(/g};
const indicators=inventory.sources.filter(f=>/\.[cm]?js$/.test(f.path)&&!f.path.startsWith('.agents/')).map(f=>{const s=fs.readFileSync(f.path,'utf8');return {path:f.path,lines:f.lines,counts:Object.fromEntries(Object.entries(patterns).map(([k,r])=>[k,[...s.matchAll(r)].length]))};});
const layerEdges=edges.filter(e=>layer(e.from)!==layer(e.to));
const sourceByPath=new Map(inventory.sources.map(f=>[f.path,f]));
const summary={boundary:'Syntax parsed with Node SourceTextModule. Static import/export specifiers are parser-derived; literal dynamic imports are regex-derived. No tree-shaking, transferred-byte, global-consumer or runtime correctness certification.',parser:{files:parsed.length,errors:parsed.filter(p=>p.status==='PARSE_ERROR')},browserGraph:{modules:all.size,edges:edges.filter(e=>all.has(e.from)).length,staticBootModules:boot.size,staticBootSourceBytes:[...boot].reduce((n,p)=>n+(sourceByPath.get(p)?.bytes||0),0),cycles:components,fanIn:ranked(fanIn),fanOut:ranked(fanOut)},unresolved,domainCrossLayer:layerEdges.filter(e=>e.from.startsWith('src/domain/')),notInBrowserBootstrap:inventory.sources.filter(f=>f.path.startsWith('src/')&&f.path.endsWith('.js')&&!all.has(f.path)).map(f=>f.path)};
write('structural-analysis.json',summary);write('parse-ledger.json',parsed);write('module-graph.json',{edges,staticBootModules:[...boot].sort(),reachable:[...all].sort(),layerEdges});write('code-imports.json',codeEdges);write('search-indicators.json',indicators);
console.log(JSON.stringify(summary,null,2));
