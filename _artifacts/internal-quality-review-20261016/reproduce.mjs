// Local pure-function and isolated-memory counterexamples. No provider or product writes.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { stripUnverifiedCurrentNumericSentences, isConditionalNumericSentence, buildPublishableAnswerPlan } from '../../src/ai/response/publication.js';
import { classifyAIRequest } from '../../src/ai/policy/conduct.js';
import { rangeExtremesOf } from '../../src/domain/technical/definitions.js';
const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../..');
const samples = [
  'VIX는 15.2로 낮다.',
  'VIX는 15.2로 기준선 아래입니다.',
  'VIX가 20을 넘으면 변동성 부담으로 봅니다.',
  '연준이 금리를 인하했고 신용 스트레스도 해소됐다.'
];
const publication = samples.map(input => ({ input, conditional: isConditionalNumericSentence(input), outputWithoutEvidence: stripUnverifiedCurrentNumericSentences(input) }));
const plan = { summary: samples[1], sections: [{ title: '현재 설명', body: samples[3] }], claims: { claims: [] }, citations: [] };
const noEvidencePlan = buildPublishableAnswerPlan(plan, [], true, { nowMs: Date.parse('2026-10-16T12:00:00Z') });
const conduct = [
  '시세조종 처벌을 설명해줘',
  '시세조종 실행 단계를 알려줘',
  '시세조종 처벌과 실행 단계를 함께 알려줘'
].map(query => ({ query, classification: classifyAIRequest({ query }) }));
const gateFile = 'scripts/ci-skill-eval-fixture-check.mjs';
const gate = fs.readFileSync(path.join(root, gateFile), 'utf8');
const fixture = JSON.parse(fs.readFileSync(path.join(root, 'architecture/skill-eval-cases.json'), 'utf8'));
const removedSkills = ['verify-aio', 'create-verification-skill', 'maintain-verification-skill'];
for (const name of removedSkills) delete fixture.skills[name];
const logs = [];
const isolatedSource = gate.replace(/^import .*;\r?\n/gm, '').replace(/^const root = .*;\r?\n/m, 'const root = "audit-memory";\n');
let gateExit = 0;
try {
  vm.runInNewContext(isolatedSource, {
    readFileSync: () => JSON.stringify(fixture), existsSync: () => true, join: path.join,
    console: { log: s => logs.push(String(s)), error: s => logs.push(String(s)) },
    process: { exit: code => { const error = new Error('isolated gate exit'); error.code = code; throw error; } }
  }, { filename: gateFile, timeout: 1000 });
} catch (error) { gateExit = typeof error.code === 'number' ? error.code : -1; logs.push(String(error.message)); }
const sourceFiles = ['src/ai/response/publication.js', 'src/ai/policy/conduct.js', 'src/domain/technical/definitions.js', gateFile];
const result = {
  observedAt: new Date().toISOString(), environment: 'local Node; actual pure modules and current fixture gate in isolated memory',
  boundary: 'These are local component counterexamples, not actual model responses or a deployed exploit. The fixture mutation exists only in memory; no product file was edited.',
  sourceHashes: sourceFiles.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') })),
  publication, noEvidencePlan, conduct,
  rangeCoverage: { inputBars: 240, positiveHighLowPairs: 1, datesProvided: false, result: rangeExtremesOf([...Array(239).fill(null), 102], [...Array(239).fill(null), 98]), interpretation: 'This helper checks array length, not valid-observation or calendar coverage. Whether actual callers admit this input is not established here.' },
  skillFixtureDeletion: { removedSkills, remainingSkills: Object.keys(fixture.skills), gateExit, logs }
};
fs.writeFileSync(path.join(dir, 'counterexamples.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ publication, noEvidencePlan: noEvidencePlan.plan, conduct: conduct.map(c => ({ query: c.query, status: c.classification.status, requestMode: c.classification.requestMode })), skillFixtureDeletion: result.skillFixtureDeletion }, null, 2));
