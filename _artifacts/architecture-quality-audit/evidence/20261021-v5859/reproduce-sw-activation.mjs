// Evaluate the actual worker, capture registration, invoke activate against an in-memory CacheStorage seam.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const source=fs.readFileSync('sw.js','utf8');
const handlers=new Map(),deleted=[];
const names=['aio-shell-old-audit','aio-data-old-audit','another-app-v4'];
const context=vm.createContext({self:{addEventListener:(type,fn)=>handlers.set(type,fn),clients:{claim(){}},skipWaiting(){}},
  caches:{keys:async()=>names,delete:async name=>{deleted.push(name);return true;}},console,URL,Request,Response,Headers});
new vm.Script(source,{filename:'sw.js'}).runInContext(context);
const currentShell=new vm.Script('SHELL_CACHE').runInContext(context);
const currentData=new vm.Script('DATA_CACHE').runInContext(context);
names.push(currentShell,currentData);
let pending;
handlers.get('activate')({waitUntil:promise=>{pending=promise;}});
await pending;
const result={evidence:'Actual SW activate callback with synthetic CacheStorage; no browser or real cache mutation',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),names,deleted,
  unrelatedCacheDeleted:deleted.includes('another-app-v4'),currentShell,currentData,currentCachesKept:!deleted.includes(currentShell)&&!deleted.includes(currentData)};
fs.writeFileSync('_artifacts/architecture-quality-audit/evidence/20261021-v5859/sw-activation-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
