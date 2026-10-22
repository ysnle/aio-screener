// Execute only the runner's extracted fingerprint functions with an in-memory mutation seam.
// No gate or producer is executed and no repository input is modified.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
const dir = '_artifacts/architecture-quality-audit/evidence/20261021-v5859';
const source = fs.readFileSync('scripts/qa-runner.mjs', 'utf8');
const manifest = JSON.parse(fs.readFileSync('architecture/qa-pipeline.json', 'utf8'));
const allFiles = execFileSync('git', ['ls-files', '-z'], {encoding:'utf8'}).split('\0').filter(Boolean);
const functionText = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const code = functionText('function globRegex(pattern)', 'function gitList(args)')
  + '\nconst inputDigestCache = new Map();\n'
  + functionText('function inputFingerprint(patterns)', 'const outputLimit =');
const group = Object.values(manifest.groups).find(group => group.gates.some(gate => gate.id === 'data-continuity'));
const rawGate = group.gates.find(gate => gate.id === 'data-continuity');
const gate = {...rawGate, inputs:rawGate.inputs || group.inputs || []};
const dependency = 'src/domain/screener/price-factors.js';
function fingerprint(changedPath) {
  const readFileSync = filename => {
    const value = fs.readFileSync(filename);
    return path.resolve(filename) === path.resolve(changedPath || '__no_mutation__')
      ? Buffer.concat([value, Buffer.from('\n// isolated audit mutation\n')]) : value;
  };
  const context = vm.createContext({manifest, allFiles, root:process.cwd(), join:path.join, readFileSync,
    createHash:crypto.createHash, process:{platform:process.platform, versions:{node:process.versions.node}},
    fileDigest:file => crypto.createHash('sha256').update(readFileSync(file)).digest('hex'), gate});
  return new vm.Script(code + '\ngateFingerprint(gate)').runInContext(context);
}
const baseline = fingerprint();
const dependencyChanged = fingerprint(dependency);
const gateChanged = fingerprint(gate.script);
const result = {
  evidence:'Isolated execution of actual runner fingerprint functions, in-memory input mutation; no gate/producer execution',
  runnerSha256:crypto.createHash('sha256').update(source).digest('hex'),
  gate:gate.id, script:gate.script, dependency, baseline, dependencyChanged, gateChanged,
  dependencyMutationDetected:baseline !== dependencyChanged,
  positiveControlDetected:baseline !== gateChanged,
};
fs.writeFileSync(`${dir}/cache-identity-result.json`, JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
if(result.dependencyMutationDetected || !result.positiveControlDetected) process.exitCode=1;
