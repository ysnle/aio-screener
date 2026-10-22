import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const ref='7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const oldRef='d36bb256ddf60468d6c7a134628053c5796be6be';
const read=(p,r=ref)=>execFileSync('git',['show',r+':'+p],{encoding:'utf8',maxBuffer:3e7});
const core=read('js/aio-core.js'),old=read('js/aio-core.js',oldRef);
const diff=execFileSync('git',['diff','--unified=0',oldRef,ref,'--','js/aio-core.js'],{encoding:'utf8'});
// The full diff was read before prefix reuse; additionally reconstruct all unchanged line runs.
let oi=0,ni=0,verified=true;const ol=old.split('\n'),nl=core.split('\n');const changes=[];
for(const m of diff.matchAll(/^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/gm)){
 const os=Number(m[1])-1,ns=Number(m[3])-1,oc=m[2]===undefined?1:Number(m[2]),nc=m[4]===undefined?1:Number(m[4]);
 // For zero-length insertion the preceding line is the anchor.
 const oe=oc===0?os+1:os,ne=nc===0?ns+1:ns;
 verified &&= ol.slice(oi,oe).join('\n')===nl.slice(ni,ne).join('\n');
 changes.push({oldStart:oe,oldCount:oc,newStart:ne,newCount:nc});oi=oe+oc;ni=ne+nc;
}
verified &&= ol.slice(oi).join('\n')===nl.slice(ni).join('\n');
const mapText=core.slice(core.indexOf('  var CIK_MAP = {'));const map=vm.runInNewContext('('+mapText.slice(mapText.indexOf('{'),mapText.indexOf('\n  };')+4).trim().replace(/;$/,'')+')');
const canon=JSON.parse(read('public-data/sec-fundamentals-summary.json')).data;
const comparisons=Object.entries(map).map(([symbol,cik])=>({symbol,legacyCik:cik,canonicalCik:canon[symbol]?.cik??null,entityName:canon[symbol]?.entityName??null,status:!canon[symbol]?.cik?'not-covered':Number(cik)===Number(canon[symbol].cik)?'match':'mismatch'}));
const result={ref,sha256:createHash('sha256').update(core).digest('hex'),utf16Chars:core.length,oldRef,unchangedDiffRunsVerified:verified,changes,cikMap:{count:comparisons.length,matched:comparisons.filter(x=>x.status==='match').length,mismatches:comparisons.filter(x=>x.status==='mismatch'),notCovered:comparisons.filter(x=>x.status==='not-covered')},comparisons};
writeFileSync(new URL('./legacy-core-probe.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,comparisons:undefined},null,2));
