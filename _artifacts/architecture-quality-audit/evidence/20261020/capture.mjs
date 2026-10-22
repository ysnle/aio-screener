// Read-only source inventory; writes only this audit's receipts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const dir='_artifacts/architecture-quality-audit/evidence/20261020';
const tracked=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const sourceExt=/\.(?:[cm]?js|ts|tsx|jsx|css|html|ya?ml|toml|ps1|cmd|sh|py)$/i;
const excluded=p=>/^(?:_artifacts|node_modules|\.cache|data-store)\//.test(p);
const sources=tracked.filter(p=>sourceExt.test(p)&&!excluded(p)).map(p=>{
  const bytes=fs.readFileSync(p),text=bytes.toString('utf8');
  let category=p.startsWith('scripts/')?'tooling':p.startsWith('src/')?p.split('/').slice(0,2).join('/'):p.startsWith('js/')?'legacy':p.startsWith('worker/')?'worker':p.startsWith('.github/')?'workflows':p.startsWith('.agents/')?'generated-agent-mirror':p.startsWith('.claude/')?'canonical-agent-tooling':'root-or-other';
  return {path:p,category,bytes:bytes.length,lines:text.split('\n').length,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),reviewStatus:'INVENTORIED_NOT_YET_SEMANTICALLY_READ'};
});
const contracts=tracked.filter(p=>/^(?:architecture\/.*\.json|package(?:-lock)?\.json|public-config\.json)$/.test(p));
const receipt={capturedAt:new Date().toISOString(),version:JSON.parse(fs.readFileSync('version.json','utf8')).version,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Tracked first-party executable/configuration source; historical audit outputs, dependencies, caches and generated market/knowledge JSON are separate data surfaces',counts:{sources:sources.length,lines:sources.reduce((n,f)=>n+f.lines,0),categories:Object.fromEntries([...new Set(sources.map(f=>f.category))].map(c=>[c,sources.filter(f=>f.category===c).length]))},contracts,sources};
fs.writeFileSync(path.join(dir,'source-inventory.json'),JSON.stringify(receipt,null,2)+'\n');
console.log(JSON.stringify({version:receipt.version,head:receipt.head,counts:receipt.counts,other:sources.filter(f=>f.category==='root-or-other').map(f=>f.path)},null,2));
