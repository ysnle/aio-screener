// Actual gate bodies with isolated I/O seams. No live endpoint, generator or repository write is executed.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const dir='_artifacts/architecture-quality-audit/evidence/20261021';
const fastPath='scripts/ci-fast-plane-live-check.mjs',fastSource=fs.readFileSync(fastPath,'utf8');
const removeImports=source=>source.replace(/^import[^\r\n]*;\r?\n/gm,'');
async function fast(health,quotes){
  const logs=[];
  try{
    await new vm.Script(`(async()=>{${removeImports(fastSource)}})()`).runInNewContext({
      fs:{readFileSync:()=>JSON.stringify({fastQuotes:{baseUrl:'https://audit.example.invalid'}})},
      process:{env:{}},AbortSignal,console:{log:value=>logs.push(value)},
      fetch:async url=>({ok:true,status:200,json:async()=>new URL(url).pathname==='/health'?health:quotes}),
    });
    return {accepted:true,logs};
  }catch(error){return {accepted:false,error:error.message};}
}
const parityPath='scripts/ci-generated-release-parity-check.mjs',paritySource=fs.readFileSync(parityPath,'utf8');
function parity(){
  const virtual=new Map(['architecture/asset-manifest.json','architecture/release-manifest.json'].map(p=>[p,Buffer.from('{"revision":"old"}\n')]));
  let exitCode=null;
  try{
    new vm.Script(removeImports(paritySource)).runInNewContext({createHash:crypto.createHash,
      readFileSync:p=>virtual.get(p),console:{error(){},log(){}},
      spawnSync:()=>{for(const p of virtual.keys())virtual.set(p,Buffer.from('{"revision":"new"}\n'));return {status:0};},
      process:{execPath:process.execPath,exit:code=>{exitCode=code;throw new Error('isolated process exit');}},
    });
  }catch(error){if(error.message!=='isolated process exit')throw error;}
  return {exitCode,filesAfter:[...virtual].map(([path,bytes])=>({path,text:bytes.toString()})),restored:[...virtual.values()].every(bytes=>bytes.toString().includes('old'))};
}
const result={evidence:'Actual gate code with mocked fetch/process/fs boundaries. No browser/live/generator execution.',
  fastPlane:{zeroCoverageAndNoQuotes:await fast({ok:true,coverage:{required:0,observed:0}},{status:'published',revision:'audit'}),
    declaredCompleteButNoQuotes:await fast({ok:true,coverage:{required:16,observed:16}},{status:'published',revision:'audit',coverage:{tier0Required:16,tier0Observed:16},quotes:[]}),
    incompleteCoverageNegativeControl:await fast({ok:true,coverage:{required:16,observed:15}},{status:'published',revision:'audit'})},
  parity:parity(),sources:Object.fromEntries([[fastPath,fastSource],[parityPath,paritySource]].map(([p,s])=>[p,crypto.createHash('sha256').update(s).digest('hex')]))};
fs.writeFileSync(`${dir}/gate-oracle-result.json`,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
