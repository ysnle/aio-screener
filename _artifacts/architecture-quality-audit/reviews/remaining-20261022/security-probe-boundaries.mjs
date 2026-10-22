import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
const ref = '7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const root = new URL('../../../../', import.meta.url);
const files = ['cloudflare-worker-proxy.js','worker/openai-budget.mjs','worker/openai-usage.mjs','worker/openai-contract.test.mjs','src/ai/policy/conduct.js','src/ai/response/publication.js','src/ai/orchestrator/answer-orchestrator.js'];
const hash = b => createHash('sha256').update(b).digest('hex');
const receipts = files.map(path => {
  const fixed = execFileSync('git', ['show', `${ref}:${path}`], { cwd: root });
  const current = readFileSync(new URL(path, root));
  const same = hash(fixed) === hash(current);
  if (!same) throw Error(`Changed target: ${path}; separate full diff required`);
  return { path, ref, sha256: hash(fixed), status: 'FULL', read_ranges: `1-${fixed.toString().split('\n').length}`, reason: 'fixed blob full text read; working bytes SHA256 identical' };
});
writeFileSync(new URL('security-reading.tsv', import.meta.url), ['path\tref\tsha256\tstatus\tread_ranges\treason', ...receipts.map(x => Object.values(x).join('\t'))].join('\n')+'\n');
globalThis.fetch = async () => { throw Error('NETWORK DENIED'); };
const { default: worker, AIOQuotaDurableObject } = await import(new URL('cloudflare-worker-proxy.js', root));
const pub = await import(new URL('src/ai/response/publication.js', root));
const day = new Date().toISOString().slice(0,10);
let rows;
let queue = Promise.resolve();
const state = { storage: { get: async () => structuredClone(rows), put: async (_, value) => { rows = structuredClone(value); } }, blockConcurrencyWhile(fn) { const job = queue.then(fn, fn); queue = job.catch(()=>{}); return job; } };
const env = { BOK_API_KEY: 'fixture-secret', RELAY_DAILY_CAP: '1' };
const durable = new AIOQuotaDurableObject(state, env);
env.AIO_QUOTA_DO = { reserve: p => durable.mutateQuota('reserve', p), release: p => durable.mutateQuota('release', p) };
let fetchCalls = 0;
globalThis.fetch = async url => {
  if (!String(url).startsWith('https://ecos.bok.or.kr/api/StatisticSearch/fixture-secret/')) throw Error('NETWORK DENIED');
  fetchCalls++;
  let sent = false;
  return new Response(new ReadableStream({ pull(c) { if (!sent) { sent = true; c.enqueue(new TextEncoder().encode('{"partial":')); } else c.error(new Error('fixture body interrupted after provider received request')); } }), { headers: {'content-type':'application/json'} });
};
const statuses = [];
for (let i=0; i<3; i++) {
  const response = await worker.fetch(new Request('https://worker.example/relay?provider=bok&statCode=722Y001&cycle=D&start=20261020&end=20261021', { headers: { Origin:'https://ysnle.github.io' } }), env);
  statuses.push(response.status); await response.text();
}
globalThis.fetch = async () => { throw Error('NETWORK DENIED'); };
const event = '연준이 금리를 인하했고 신용 스트레스도 해소됐다.';
const structured = pub.buildPublishableAnswerPlan({ summary:event, sections:[], claims:{claims:[]}, citations:[] }, [], true);
const fallback = pub.extractAnswerFallback(event, true);
// Execute the real legacy pipeline function with its external boundaries controlled.
const chat = readFileSync(new URL('js/aio-chat.js',root),'utf8');
const start = chat.indexOf('function _aioRunAIResponsePipeline(');
const end = chat.indexOf('\nfunction ',start+1);
const pipelineSource = chat.slice(start,end);
const context = { window: { AIO_ARCH: { parseAIAnswerPlan:()=>({status:'not-structured', plan:null}) }, AIO: {} }, Set,
  _AIO_AI_PIPELINE_VERSION:'fixture', _AIO_AI_VALIDATOR_VERSION:'fixture', _AIO_AI_BLOCK_POLICY_VERSION:'fixture',
  _aioCollectAIClaimEvidence:()=>[], _aioEvidenceCanPublish:pub.evidenceCanPublish, _aioAIClaimEvidenceId:pub.claimEvidenceId,
  _aioBuildPublishableAnswerPlan:pub.buildPublishableAnswerPlan, _aioExtractAIAnswerFallback:pub.extractAnswerFallback,
  _aioApplyAIActionGate:text=>({blocked:false,text,reasons:[]}), _aioHasCurrentNumericContent:pub.hasCurrentNumericContent };
let pipeline;
try { vm.createContext(context); const gateStart = chat.indexOf('function _aioApplyAIActionGate('); const gateEnd = chat.indexOf('\nfunction ', gateStart+1); vm.runInContext(chat.slice(gateStart,gateEnd),context); vm.runInContext(pipelineSource,context); pipeline = context._aioRunAIResponsePipeline(event,{request:{entrypoint:'chat',query:'시장 상황'},currentSensitive:true,stripChips:false,record:false}); }
catch(error) { pipeline = { probeError:String(error) }; }
const result = { ref, fileReceipts:receipts, network:'all global fetch requests stubbed or denied; fake secret only', relay:{cap:1,statuses,fetchCalls,persistedDayCount:rows.days[`relay:bok:${day}`]}, publication:{event,structuredSummary:structured.plan.summary,fallback,pipeline} };
writeFileSync(new URL('security-probe-boundaries.json',import.meta.url), JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({relay:result.relay,publication:result.publication},null,2));
