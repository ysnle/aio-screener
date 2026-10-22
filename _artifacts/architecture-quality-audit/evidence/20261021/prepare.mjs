// Continue the review without replacing previous versions' evidence.
import fs from 'node:fs';
const from='_artifacts/architecture-quality-audit/evidence/20261020',to='_artifacts/architecture-quality-audit/evidence/20261021';
for(const name of fs.readdirSync(from).filter(n=>n.endsWith('.mjs')&&!['resume-current.mjs','assemble.mjs'].includes(n))){
  if(!fs.existsSync(`${to}/${name}`))fs.writeFileSync(`${to}/${name}`,fs.readFileSync(`${from}/${name}`,'utf8').replaceAll(from,to));
}
console.log('Current source runners copied; historical receipts preserved.');
