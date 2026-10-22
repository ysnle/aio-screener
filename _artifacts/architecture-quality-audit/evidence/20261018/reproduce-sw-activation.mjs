// Evaluate the actual worker, capture registration, invoke activate against an in-memory CacheStorage seam.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const source=fs.readFileSync('sw.js','utf8');
const handlers=new Map(),deleted=[];
const names=['aio-shell-v57.97-old','aio-data-v57.97','another-app-v4','aio-shell-v57.98-local','aio-data-v57.98'];
const context=vm.createContext({self:{addEventListener:(type,fn)=>handlers.set(type,fn),clients:{claim(){}},skipWaiting(){}},
  caches:{keys:async()=>names,delete:async name=>{deleted.push(name);return true;}},console,URL,Request,Response,Headers});
new vm.Script(source,{filename:'sw.js'}).runInContext(context);
let pending;
handlers.get('activate')({waitUntil:promise=>{pending=promise;}});
await pending;
const result={evidence:'Actual SW activate callback with synthetic CacheStorage; no browser or real cache mutation',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),names,deleted,
  unrelatedCacheDeleted:deleted.includes('another-app-v4'),currentCachesKept:!deleted.includes('aio-shell-v57.98-local')&&!deleted.includes('aio-data-v57.98')};
fs.writeFileSync('_artifacts/architecture-quality-audit/evidence/20261018/sw-activation-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
