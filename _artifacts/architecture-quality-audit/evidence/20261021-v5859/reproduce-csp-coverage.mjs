// Run only the actual collector function with real read-only directory listing. Execute the read-only gate as a control.
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
const p='scripts/ci-csp-ratchet-check.mjs',source=fs.readFileSync(p,'utf8');
const collector=source.slice(source.indexOf('async function collect(directory)'),source.indexOf("await collect('js');"));
const files=['index.html'];
await new vm.Script(`(async()=>{${collector}\nawait collect('js'); await collect('src');})()`).runInNewContext({readdir:fsp.readdir,join:path.join,relative:path.relative,rootPath:process.cwd(),files});
const inventory=JSON.parse(fs.readFileSync('_artifacts/architecture-quality-audit/evidence/20261021-v5859/source-inventory.json','utf8')).sources;
const expected=inventory.filter(row=>/^(js|src)\//.test(row.path)&&row.path.endsWith('.js'));
const count=p=>(fs.readFileSync(p,'utf8').match(/\.innerHTML\s*=/g)||[]).length;
const result={evidence:'Actual collector with real read-only directory listing and actual read-only gate execution; no source mutation',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),
  emptyPathJoin:path.join('',''),collected:files,expectedJsFiles:expected.length,collectedInnerHTMLAssignments:files.reduce((n,p)=>n+count(p),0),
  expectedAdditionalInnerHTMLAssignments:expected.reduce((n,row)=>n+count(row.path),0),gateOutput:execFileSync(process.execPath,[p],{encoding:'utf8'}).trim()};
fs.writeFileSync('_artifacts/architecture-quality-audit/evidence/20261021-v5859/csp-coverage-result.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
