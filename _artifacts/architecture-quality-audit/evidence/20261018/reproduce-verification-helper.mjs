// Actual verification helper with browser-evaluation callbacks run in a synthetic DOM VM.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {expectText} from '../../../../.claude/skills/verify-aio/scripts/lib/drive.mjs';
async function probe(hidden){
  const element={innerText:'실제 내용처럼 보이는 숨겨진 텍스트',offsetParent:hidden?null:{}};
  const evaluate=(fn,arg)=>vm.runInNewContext(`(${fn.toString()})(argument)`,{document:{querySelector:()=>element},argument:arg});
  const page={evaluate,waitForFunction:async(fn,arg)=>{if(!evaluate(fn,arg))throw new Error('synthetic wait predicate remained false');}};
  try{return {hidden,accepted:true,observed:await expectText(page,'#audit-hidden')};}
  catch(error){return {hidden,accepted:false,error:error.message};}
}
const p='.claude/skills/verify-aio/scripts/lib/drive.mjs';
const result={evidence:'Actual expectText with serialized browser predicates in a minimal DOM VM; no real browser certification',
  hidden:await probe(true),visiblePositiveControl:await probe(false),sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')};
fs.writeFileSync('_artifacts/architecture-quality-audit/evidence/20261018/verification-helper-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
