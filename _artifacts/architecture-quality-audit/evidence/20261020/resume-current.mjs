// Audit receipts only. Preserve previous-version evidence; never overwrite it.
import fs from 'node:fs';
const prior='_artifacts/architecture-quality-audit/evidence/20261019';
const dir='_artifacts/architecture-quality-audit/evidence/20261020';
for(const name of fs.readdirSync(prior).filter(n=>n.endsWith('.mjs')&&!['resume.mjs','assemble.mjs'].includes(n))){
  const target=`${dir}/${name}`;
  if(!fs.existsSync(target))fs.writeFileSync(target,fs.readFileSync(`${prior}/${name}`,'utf8').replaceAll(prior,dir));
}
console.log('Copied current-source audit runners without changing old receipts.');
