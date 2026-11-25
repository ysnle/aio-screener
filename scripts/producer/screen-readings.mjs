// The per-screen AI readings, published as data.json `screenReadings`. One reading per screen of
// scripts/lib/screen-reading.mjs SCREEN_READING_SCREENS, written when that screen's fact packet changes (in practice when
// a new US close lands, 1–3 times a day), never per refresh and never per visitor.
//
// Per screen: the packet's key equals the last verified reading's → that reading stays (no call). Otherwise one request,
// one retry carrying the validator's reasons, and then 'blocked' with a reason code and no text — the screen leaves the
// place empty ("a wrong paragraph is worse than an empty one"). A key that was blocked by the validator is not asked again
// (the same reason as market-narrative's blockedAttemptKey: unchanged facts, unchanged answer, two calls every run); a
// provider failure is retried on later runs, at most SCREEN_READING_PROVIDER_ATTEMPTS times per key. Without a requester
// (Worker not configured) nothing is called and the previous readings stay as they were.
import { readFileSync } from 'node:fs';
import { estimateAiCostUsd } from '../../src/domain/briefing/event-briefs.js'; // the Worker's rate card, one copy
import { SHARED_AI_MODEL } from '../lib/ai-shared-analysis.mjs';
import { softenReaderDuty } from '../lib/market-analysis-validate.mjs';
import { SCREEN_READING_IDS, SCREEN_READING_SCHEMA, buildScreenPacket, buildScreenReadingPrompt, buildScreenReadingRetryPrompt, normalizeScreenReading, validateScreenReading } from '../lib/screen-reading.mjs';

export const SCREEN_READING_PROVIDER_ATTEMPTS = 3;
// The published long-run tables, read once per run; absent (before the first weekly run) the opening falls back to the record.
const readPublished = (file) => { try { return JSON.parse(readFileSync(new URL(`../../public-data/${file}`, import.meta.url), 'utf8')); } catch (_) { return null; } };
const readPublishedLongrun = () => readPublished('index-longrun.json');
const REASON = /^[a-z0-9:-]{1,64}$/;
const reasonCode = (reason, fallback) => (REASON.test(String(reason || '')) ? reason : fallback);
const monthOf = (iso) => String(iso || '').slice(0, 7);

function carryLedger(previous) {
  const ledger = {};
  for (const [month, row] of Object.entries(previous?.ledger || {})) {
    if (!/^\d{4}-\d{2}$/.test(month) || !row || typeof row !== 'object') continue;
    ledger[month] = { requests: Number(row.requests) || 0, inputTokens: Number(row.inputTokens) || 0, outputTokens: Number(row.outputTokens) || 0, estimatedUsd: Number(row.estimatedUsd) || 0 };
  }
  return ledger;
}

/**
 * @param {object} options
 * @param {object} options.data           this run's data.json payload (macro, fearGreed, rotationHistory)
 * @param {Array}  options.history        history rows (the history this run just wrote)
 * @param {object} [options.previous]     the last published `screenReadings`
 * @param {Function|null} options.request  async (prompt) => { text, reason, usage } — the shared Worker; null when not configured
 * @param {number} [options.nowMs]
 * @param {object} [options.interpretation] the shared interpretation (fixture seam; production builds it from the published artifacts)
 * @param {string[]} [options.screens]
 */
export async function genScreenReadings({ data = null, history = [], previous = null, request = null, nowMs = Date.now(), interpretation = undefined, screens = SCREEN_READING_IDS, longrun = undefined, telegram = undefined, day = undefined, briefs = undefined } = {}) {
  const generatedAt = new Date(nowMs).toISOString();
  const held = previous?.schemaVersion === SCREEN_READING_SCHEMA && previous.readings && typeof previous.readings === 'object' ? previous.readings : {};
  const ledger = carryLedger(previous?.schemaVersion === SCREEN_READING_SCHEMA ? previous : null);
  const readings = {};
  const outcomes = {};
  if (typeof request !== 'function') {
    // Nothing is called; the previous readings stay (each screen shows one only while its basis is the shown close).
    for (const screen of screens) { if (held[screen]) readings[screen] = held[screen]; outcomes[screen] = 'not-configured'; }
    return { result: { schemaVersion: SCREEN_READING_SCHEMA, generatedAt: previous?.generatedAt || generatedAt, readings, ledger }, outcomes, requests: 0 };
  }
  let shared = interpretation;
  if (shared === undefined) {
    const { publishedMarketInterpretation } = await import('./market-narrative.mjs');
    try { shared = publishedMarketInterpretation(data, history).interpretation; } catch (_) { shared = null; }
  }
  const month = monthOf(generatedAt);
  const maxRequests = screens.length * 2;
  let requests = 0;
  const ask = async (prompt) => {
    requests += 1;
    let answer = null;
    try { answer = await request(prompt); } catch (_) { answer = { text: null, reason: 'provider-error' }; }
    const usage = { inputTokens: Number(answer?.usage?.inputTokens) || 0, outputTokens: Number(answer?.usage?.outputTokens) || 0 };
    const row = (ledger[month] ||= { requests: 0, inputTokens: 0, outputTokens: 0, estimatedUsd: 0 });
    row.requests += 1; row.inputTokens += usage.inputTokens; row.outputTokens += usage.outputTokens;
    row.estimatedUsd = Math.round((row.estimatedUsd + estimateAiCostUsd(usage)) * 1e5) / 1e5;
    return { text: answer?.text ? normalizeScreenReading(softenReaderDuty(answer.text)) : null, reason: answer?.reason || null, usage };
  };
  // The long-run index tables (weekly, index-longrun.json) for the 시장 상태 opening's standing sentences, and this run's
  // data.json for the boards that read it directly (금리와 환율: macro), and the channels' relayed releases (매크로).
  const context = { longrun: longrun !== undefined ? longrun : readPublishedLongrun(), data, telegram: telegram !== undefined ? telegram : readPublished('telegram-digest.json'),
    day: day !== undefined ? day : readPublished('market-day.json'), briefs: briefs !== undefined ? briefs : readPublished('event-briefs.json') };
  for (const screen of screens) {
    const packet = buildScreenPacket(screen, shared, context);
    const prior = held[screen] || null;
    if (!packet) { readings[screen] = { status: 'blocked', reason: 'packet-unavailable', text: null, basis: null, key: null, generatedAt }; outcomes[screen] = 'packet-unavailable'; continue; }
    if (prior?.status === 'verified' && prior.key === packet.key && prior.text) { readings[screen] = prior; outcomes[screen] = 'reused'; continue; }
    if (prior?.status === 'blocked' && prior.key === packet.key && (prior.reason === 'validation-failed' || (Number(prior.attempts) || 0) >= SCREEN_READING_PROVIDER_ATTEMPTS)) {
      readings[screen] = prior; outcomes[screen] = 'blocked-key-held'; continue;
    }
    if (requests + 1 > maxRequests) { readings[screen] = prior || { status: 'blocked', reason: 'run-request-cap', text: null, basis: packet.basis, key: null, generatedAt }; outcomes[screen] = 'run-request-cap'; continue; }
    const prompt = buildScreenReadingPrompt(packet);
    const usage = { inputTokens: 0, outputTokens: 0 };
    const add = (more) => { usage.inputTokens += more.inputTokens; usage.outputTokens += more.outputTokens; };
    let answer = await ask(prompt);
    add(answer.usage);
    let verdict = answer.text ? validateScreenReading(answer.text, packet) : null;
    let retried = false;
    if (answer.text && verdict.issues.length && requests < maxRequests) {
      retried = true;
      answer = await ask(buildScreenReadingRetryPrompt(prompt, verdict));
      add(answer.usage);
      verdict = answer.text ? validateScreenReading(answer.text, packet) : null;
    }
    const estimatedUsd = estimateAiCostUsd(usage);
    if (answer.text && verdict && !verdict.issues.length) {
      readings[screen] = { status: 'verified', text: answer.text, basis: packet.basis, key: packet.key, generatedAt, model: SHARED_AI_MODEL, warnings: verdict.warnings, usage, estimatedUsd };
      outcomes[screen] = retried ? 'verified-after-retry' : 'verified';
      continue;
    }
    // Blocked: no text, a reason code (and the validator's codes, never the rejected text).
    const provider = !answer.text;
    const attempts = provider ? (prior?.key === packet.key ? Number(prior.attempts) || 0 : 0) + 1 : undefined;
    readings[screen] = { status: 'blocked', text: null, basis: packet.basis, key: packet.key, generatedAt, model: SHARED_AI_MODEL,
      reason: provider ? reasonCode(answer.reason, 'provider-response-incomplete') : 'validation-failed',
      ...(provider ? { attempts } : { issues: (verdict?.issues || []).map((issue) => issue.split(':')[0]).filter((code, index, all) => all.indexOf(code) === index) }),
      usage, estimatedUsd };
    outcomes[screen] = provider ? reasonCode(answer.reason, 'provider-response-incomplete') : 'blocked';
  }
  return { result: { schemaVersion: SCREEN_READING_SCHEMA, generatedAt, readings, ledger }, outcomes, requests };
}

/** One short outcome code for meta.aiUsage (a code only): the most telling screen outcome of the run. */
const OUTCOME_ORDER = ['blocked', 'verified-after-retry', 'verified', 'run-request-cap', 'blocked-key-held', 'packet-unavailable', 'reused', 'not-configured'];
export function screenReadingsOutcome(run) {
  const seen = Object.values(run?.outcomes || {});
  const code = OUTCOME_ORDER.find((outcome) => seen.includes(outcome)) || seen.find((outcome) => REASON.test(String(outcome))) || 'no-screens';
  return reasonCode(code, 'unknown');
}
