import fs from 'node:fs';
const from='_artifacts/architecture-quality-audit/evidence/20261021',to='_artifacts/architecture-quality-audit/evidence/20261021-v5859';
for(const name of fs.readdirSync(from).filter(n=>n.endsWith('.mjs')&&/^(?:capture|analyze|check-cache-inputs|reproduce-)/.test(n))){
  if(!fs.existsSync(`${to}/${name}`))fs.writeFileSync(`${to}/${name}`,fs.readFileSync(`${from}/${name}`,'utf8').replaceAll(from,to));
}
console.log('Historical evidence preserved. Latest audit runners ready.');
