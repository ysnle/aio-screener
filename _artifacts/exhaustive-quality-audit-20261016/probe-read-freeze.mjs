// Read-only adversarial probe: change bytes in memory while keeping all IDs intact.
import fs from 'node:fs';
const target=process.argv[2];
if(!['js/aio-glossary.js','public-data/knowledge/research-facts.json'].includes(target))throw new Error('Choose a reviewed audit source');
const read=fs.readFileSync;
let writes=0;
fs.readFileSync=function(p,...args){
  const result=read.call(this,p,...args);
  if(String(p)!==target)return result;
  return typeof result==='string'?result+'\n ':Buffer.concat([result,Buffer.from('\n ')]);
};
fs.writeFileSync=()=>{writes++;throw new Error('Unexpected write before rejecting changed source');};
try{
  await import('./assemble-latest.mjs');
  throw new Error('Changed read source was accepted');
}catch(error){
  if(!error.message.startsWith(`Read source changed: ${target};`)||writes)throw error;
  console.log(JSON.stringify({target,identitiesUnchanged:true,changedBytesRejected:true,writes}));
}
