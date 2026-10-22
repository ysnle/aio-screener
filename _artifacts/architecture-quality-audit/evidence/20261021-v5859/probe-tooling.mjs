import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {writeFileSync} from 'node:fs';
const ref='7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const read=p=>execFileSync('git',['show',ref+':'+p],{encoding:'utf8',maxBuffer:3e7});
const ledger=read('scripts/ci-ledger-integrity-check.mjs');
const rules=read('_context/RULES.md'),manifest=JSON.parse(read('_context/rule-gap-manifest.json'));
const parser=read('scripts/lib/rule-ids.mjs').replace(/export /g,'');
const parse=vm.runInNewContext(parser+';ruleIdOccurrences');
const max=Math.max(...parse(rules));
const ruleHeading=new RegExp('^#{2,3} R'+max+'\\.[^\\n]*\\n[\\s\\S]*?(?=^#{2,3} R\\d|$(?![\\s\\S]))','m');
const match=ruleHeading.exec(rules);
if(!match)throw new Error('highest rule block not found');
const reduced=rules.slice(0,match.index)+rules.slice(match.index+match[0].length);
const section=ledger.slice(ledger.indexOf('const rulesText ='),ledger.indexOf('// ── 2.'));
function ledgerFixture(text){
 const errors=[];
 const ctx={root:'fixture',RULE_GAP_PATH:'manifest',write:false,read:p=>p==='_context/RULES.md'?text:JSON.stringify(manifest),ruleIdOccurrences:parse,existsSync:()=>true,join:(...p)=>p.join('/'),console:{log(){}},check:(label,ok,detail)=>{if(!ok)errors.push({label,detail});},errors};
 vm.runInNewContext(section,ctx);return errors;
}
const ratchet=read('scripts/ci-text-pin-ratchet-check.mjs');
const functions=ratchet.slice(ratchet.indexOf('const SOURCE_PATH ='),ratchet.indexOf('function countExemptions()')).replace(/export /g,'');
const count=vm.runInNewContext(functions+';countTextPins');
const textPins=[
 {name:'direct',source:"const source = read('src/ui/pages/home.js');\ncheck('v58.59 x', source.includes('x'));"},
 {name:'alias',source:"const source = read('src/ui/pages/home.js');\nconst alias = source;\ncheck('v58.59 x', alias.includes('x'));"},
 {name:'multiline',source:"const source = read('src/ui/pages/home.js');\ncheck('v58.59 x', /x/.test(\n source));"},
].map(f=>({name:f.name,pins:count(f.source),source:f.source}));
const trace=read('scripts/ci-assertion-trace-check.mjs');
const labels=vm.runInNewContext(trace.slice(trace.indexOf('const LABEL_RE ='),trace.indexOf('const targets ='))+';collectLabels');
const traceFixtures=[{name:'literal',source:"check('untraceable new assertion', condition)"},{name:'variable',source:"const label='untraceable new assertion'; check(label, condition)"}].map(f=>({...f,labels:labels(f.source)}));
const fresh=read('scripts/ci-knowledge-lint-check.mjs');
const freshExpr=fresh.match(/staleDocs\.length <= Number\(freshnessBaseline\.staleCount \?\? 0\)/)?.[0];
if(!freshExpr)throw new Error('freshness comparison not found');
const swapped=vm.runInNewContext(freshExpr,{staleDocs:['new-document.md (46d)'],freshnessBaseline:{staleCount:1,stale:['old-document.md (60d)']}});
const result={ref,evidence:'Extracted pure sections/functions in VM; repository gates were not executed; no product writes or external calls',ledger:{originalMax:max,deletedRuleHeading:match[0].split('\n')[0],originalErrors:ledgerFixture(rules),afterRemovingHighestRuleErrors:ledgerFixture(reduced),remainingMax:Math.max(...parse(reduced)),manifestMax:manifest.maxR},textPins,traceFixtures,freshness:{newPathReplacingOldStalePathPasses:swapped,comparison:freshExpr}};
writeFileSync(new URL('./tooling-probe.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
