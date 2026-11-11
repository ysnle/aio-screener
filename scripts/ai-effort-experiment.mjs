// Manual experiment (Actions only, .github/workflows/ai-effort-experiment.yml): the market reading is written with
// reasoning off and a 1,500-token ceiling, and the deterministic validator rejects many first attempts. This replays
// the published inputs of one checkout through the production path (genMarketAnalysis with its validator and single
// retry) once per variant and reports attempts, the validator's reasons, token usage and the text. It writes no
// public-data file and does not touch the ledgers; the Worker's budget ledger meters the calls as usual.
//
// Usage: node scripts/ai-effort-experiment.mjs --out <file> [--variants none:1500,low:4000,medium:6000] [--label <text>]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { genMarketAnalysis } from './producer/market-narrative.mjs';
import { SHARED_AI_MODEL, SHARED_AI_TIMEOUT_MS, requestSharedText, resolveSharedAiConfig } from './lib/ai-shared-analysis.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (name, fallback = null) => { const at = process.argv.indexOf(name); return at >= 0 ? process.argv[at + 1] : fallback; };
const EFFORTS = ['none', 'low', 'medium', 'high'];
const variants = String(arg('--variants', 'none:1500,low:4000,medium:6000')).split(',').map((item) => {
  const [effort, tokens] = item.split(':');
  if (!EFFORTS.includes(effort) || !/^\d{3,5}$/.test(String(tokens))) throw new Error(`invalid variant: ${item}`);
  return { effort, maxOutputTokens: Number(tokens) };
});
const out = arg('--out');
if (!out) throw new Error('--out required');
if (!resolveSharedAiConfig()) throw new Error('shared AI is not configured (AI_PROXY_URL, AIO_AUTOMATION_TOKEN)');

const readJson = (rel) => JSON.parse(readFileSync(join(root, rel), 'utf8'));
const published = readJson('public-data/data.json');
const snapshot = (() => { try { return readJson('public-data/market-snapshot.json'); } catch { return null; } })();
const nowMs = Date.parse(published.generatedAt || published.meta?.generatedAt || '') || Date.now();
const productionMeta = published.meta || {};

async function runVariant({ effort, maxOutputTokens }) {
  const data = structuredClone(published);
  delete data.marketAnalysis; // production calls the reading before this key exists
  const calls = [];
  const blocked = [];
  const warn = console.warn;
  console.warn = (...parts) => {
    const line = parts.join(' ');
    const match = line.match(/marketAnalysis (attempt-\d) blocked: ([^:]*?) ::/);
    if (match) blocked.push({ attempt: match[1], issues: match[2].trim() });
    warn(...parts);
  };
  const request = async (prompt) => {
    const started = Date.now();
    const body = { model: SHARED_AI_MODEL, input: [{ role: 'user', content: prompt }], max_output_tokens: maxOutputTokens, reasoning: { effort }, store: false, stream: false };
    // Medium reasoning runs under the Worker's 180 s deadline; the client waits just past it.
    const result = await requestSharedText(body, { purpose: 'market-analysis', timeoutMs: effort === 'none' ? SHARED_AI_TIMEOUT_MS.analysis : 185000 });
    // Every attempt's text is kept (rejected ones too) so a validator reason can be read against the sentence it judged.
    calls.push({ ms: Date.now() - started, promptChars: prompt.length, ok: !!result.text, reason: result.reason || null, usage: result.usage || null, chars: result.text ? result.text.length : 0, text: result.text || null });
    return result;
  };
  let reading;
  try { reading = await genMarketAnalysis(data, snapshot, { previous: null, request, nowMs }); }
  finally { console.warn = warn; }
  const text = String(reading?.full || reading?.summary || '');
  return {
    effort, maxOutputTokens, status: reading?.status || null, reason: reading?.reason || null,
    attempts: calls.length, firstAttemptPassed: calls.length === 1 && reading?.status === 'verified', blocked, calls,
    inputTokens: calls.reduce((sum, call) => sum + (call.usage?.inputTokens || 0), 0),
    outputTokens: calls.reduce((sum, call) => sum + (call.usage?.outputTokens || 0), 0),
    textChars: reading?.status === 'verified' ? text.length : 0,
    text: reading?.status === 'verified' ? text : null
  };
}

const results = [];
for (const variant of variants) {
  console.log(`[ai-effort-experiment] ${variant.effort}:${variant.maxOutputTokens} …`);
  try { results.push(await runVariant(variant)); }
  catch (error) { results.push({ ...variant, status: 'error', reason: String(error?.message || error).slice(0, 200), attempts: 0, blocked: [], calls: [] }); }
}
const report = {
  schemaVersion: 'ai-effort-experiment.v1', label: arg('--label', ''), dataGeneratedAt: published.generatedAt || productionMeta.generatedAt || null,
  production: { ok: productionMeta.marketAnalysisOk ?? null, retained: productionMeta.marketAnalysisRetained?.reason || null, outcome: productionMeta.aiUsage?.purposes?.['market-analysis']?.outcome || null },
  results
};
writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
for (const row of results) console.log(`[ai-effort-experiment] ${row.effort}:${row.maxOutputTokens} status=${row.status} attempts=${row.attempts} blocked=${row.blocked.map((item) => item.issues).join(' | ') || '-'} in=${row.inputTokens} out=${row.outputTokens} chars=${row.textChars}`);
