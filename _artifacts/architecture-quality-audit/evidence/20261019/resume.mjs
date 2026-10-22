// Keep the previous audit immutable; refresh current source identity and copy its runnable probes.
import fs from 'node:fs';
import crypto from 'node:crypto';
const prior='_artifacts/architecture-quality-audit/evidence/20261018';
const current='_artifacts/architecture-quality-audit/evidence/20261019';
fs.mkdirSync(current,{recursive:true});
for(const name of fs.readdirSync(prior).filter(name=>name.endsWith('.mjs')&&name!=='assemble-reading-ledger.mjs')){
  fs.writeFileSync(`${current}/${name}`,fs.readFileSync(`${prior}/${name}`,'utf8').replaceAll(prior,current));
}
const old=JSON.parse(fs.readFileSync(`${prior}/source-inventory.json`,'utf8')).sources;
const rows=old.map(row=>({path:row.path,priorSha256:row.sha256,currentSha256:fs.existsSync(row.path)?crypto.createHash('sha256').update(fs.readFileSync(row.path)).digest('hex'):null}));
fs.writeFileSync(`${current}/prior-source-drift.json`,JSON.stringify({observedAt:new Date().toISOString(),same:rows.filter(r=>r.priorSha256===r.currentSha256).length,changed:rows.filter(r=>r.currentSha256&&r.priorSha256!==r.currentSha256).length,removed:rows.filter(r=>!r.currentSha256).length,rows},null,2)+'\n');
