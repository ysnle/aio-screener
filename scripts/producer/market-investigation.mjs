// The market investigation, published as data.json `marketInvestigation`: what the latest completed session did that was
// unusual, why (as far as the model could find out with the refresh's own data and a bounded search), what does not fit
// that cause and what would confirm or refute it next. Run by scripts/fetch-data.mjs after the per-screen readings.
//
// Per refresh: the leads (src/domain/market/investigation/leads.js) are read from the market-day ledger this run builds in
// memory from the artifacts on disk and this run's data.json payload (the same inputs scripts/build-market-day.mjs uses, so
// the 오늘 ledger and the investigation see the same moves). No lead: 'quiet', no call. The same lead set as the last
// verified investigation: reused, no call. A lead set the validator blocked is not asked again; a provider failure is
// retried on later runs up to providerAttempts. The month's ledger is a hard stop at RULES.investigation.monthlyBudgetUsd.
// Without a requester (Worker not configured) nothing is called.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { estimateAiCostUsd } from '../../src/domain/briefing/event-briefs.js'; // the Worker's rate card, one copy
import { buildMarketDay } from '../../src/domain/market/day/facts.js';
import { nextStateRecord, selectLeads } from '../../src/domain/market/investigation/leads.js';
import { RULES } from '../../src/domain/rules/thresholds.js';
import { SHARED_AI_MODEL } from '../lib/ai-shared-analysis.mjs';
import { createInvestigationRunner } from '../lib/investigation-tools.mjs';
import { INVESTIGATION_CHECK_REVISION, INVESTIGATION_SCHEMA_VERSION, buildLeadMessage, linkedHeadlines, repairInvestigation, runInvestigation, validateInvestigation } from '../lib/market-investigation.mjs';
import { buildScreenPacket } from '../lib/screen-reading.mjs';

const LIMIT = RULES.investigation;
const REASON = /^[a-z0-9:-]{1,64}$/;
const reasonCode = (reason, fallback) => (REASON.test(String(reason || '')) ? reason : fallback);
const monthOf = (iso) => String(iso || '').slice(0, 7);
const readPublic = (file) => { try { return JSON.parse(readFileSync(new URL(`../../public-data/${file}`, import.meta.url), 'utf8')); } catch (_) { return null; } };

function carryLedger(previous) {
  const ledger = {};
  for (const [month, row] of Object.entries(previous?.ledger || {})) {
    if (!/^\d{4}-\d{2}$/.test(month) || !row || typeof row !== 'object') continue;
    ledger[month] = { investigations: Number(row.investigations) || 0, requests: Number(row.requests) || 0, inputTokens: Number(row.inputTokens) || 0,
      outputTokens: Number(row.outputTokens) || 0, searchCalls: Number(row.searchCalls) || 0, estimatedUsd: Number(row.estimatedUsd) || 0 };
  }
  return ledger;
}

/** The rule words the screens draw from the shared interpretation: overall verdict, diagnosis, rebound, scenario counts. */
export function investigationWords(interpretation, signalPacket = null) {
  const regime = interpretation?.regime;
  if (!regime?.available) return null;
  const items = Array.isArray(interpretation?.crossroads?.items) ? interpretation.crossroads.items : [];
  return {
    overall: regime.overall || null, diagnosis: signalPacket?.diagnosis || null, rebound: signalPacket?.rebound || null,
    scenarios: Object.fromEntries(items.filter((item) => item?.id && Number.isFinite(item.met) && Number.isFinite(item.total)).map((item) => [item.id, `${item.met}/${item.total}`])),
    scenarioTitles: Object.fromEntries(items.filter((item) => item?.id && item.title).map((item) => [item.id, String(item.title).split(' — ')[0]]))
  };
}

/** The published files the investigation's company and market_data readers open (scripts/lib/investigation-tools.mjs). */
export const investigationArtifacts = (read) => ({ screener: read('screener.json'), consensus: read('consensus-estimates.json'), briefs: read('event-briefs.json'),
  calendar: read('earnings-calendar.json'), auctions: read('treasury-auctions.json'), krFlows: read('kr-investor-flows.json'), telegram: read('telegram-digest.json') });

/** The ledger this run would publish, built from the artifacts on disk with this run's payload as data.json. */
export async function marketDayForRun(data, nowMs) {
  const { marketDayInputs } = await import('../build-market-day.mjs');
  const inputs = marketDayInputs((file) => (file === 'data.json' ? data : readPublic(file)));
  if (!inputs.history.length || !inputs.screener?.data) return null;
  return buildMarketDay({ ...inputs, nowMs });
}

/**
 * @param {object} options
 * @param {object} options.data          this run's data.json payload
 * @param {Array}  options.history       history rows (this run's)
 * @param {object} [options.previous]    the last published `marketInvestigation`
 * @param {Function|null} options.request async (body) => { payload, reason } — the shared Worker; null when not configured
 * @param {object} [options.day]         the market-day ledger (fixture seam; production builds it)
 * @param {object} [options.interpretation] the shared interpretation (fixture seam)
 */
export async function genMarketInvestigation({ data = null, history = [], previous = null, request = null, nowMs = Date.now(), day = undefined, interpretation = undefined, longrun = undefined, artifacts = undefined } = {}) {
  const generatedAt = new Date(nowMs).toISOString();
  const prior = previous?.schemaVersion === INVESTIGATION_SCHEMA_VERSION ? previous : null;
  const ledger = carryLedger(prior);
  const month = monthOf(generatedAt);
  let shared = interpretation;
  if (shared === undefined) {
    const { publishedMarketInterpretation } = await import('./market-narrative.mjs');
    try { shared = publishedMarketInterpretation(data, history).interpretation; } catch (_) { shared = null; }
  }
  const context = { longrun: longrun !== undefined ? longrun : readPublic('index-longrun.json') };
  const ledgerDay = day !== undefined ? day : await marketDayForRun(data, nowMs).catch(() => null);
  if (!ledgerDay) return { result: prior ? { ...prior, ledger } : null, outcome: 'ledger-unavailable', requests: 0 };
  const signal = buildScreenPacket('signal', shared, context);
  const session = { us: ledgerDay.sessions?.us || null, kr: ledgerDay.sessions?.kr || null };
  const state = nextStateRecord(prior?.state, session.us, investigationWords(shared, signal));
  const selection = selectLeads({ day: ledgerDay, state });
  // The checks' revision is part of the key: an answer the old checks blocked is asked again under the new ones.
  const key = createHash('sha1').update(`${selection.keySource}|checks:${INVESTIGATION_CHECK_REVISION}`).digest('hex').slice(0, 16);
  const base = { schemaVersion: INVESTIGATION_SCHEMA_VERSION, generatedAt, session, key, leads: selection.leads, state, ledger };
  const sameKey = prior?.key === key;
  const retainOr = (reason, extra = {}) => (prior?.status === 'verified' && prior.session?.us === session.us
    ? { ...prior, state, ledger, retained: { reason, at: generatedAt, leads: selection.leads.length } }
    : { ...base, status: 'blocked', reason, verdict: null, paragraphs: [], causes: [], unknowns: [], ...extra });

  if (selection.quiet) return { result: { ...base, status: 'quiet', verdict: null, paragraphs: [], causes: [], unknowns: [] }, outcome: 'quiet', requests: 0 };
  if (sameKey && prior.status === 'verified') return { result: { ...prior, state, ledger }, outcome: 'reused', requests: 0 };
  // A blocked lead set is remembered by its key, whether the face shows nothing (status blocked) or the session's earlier
  // verified investigation (retained, blockedKey).
  const heldKey = prior?.status === 'blocked' ? prior.key : prior?.blockedKey || null;
  const heldReason = prior?.status === 'blocked' ? prior.reason : prior?.blockedReason || null;
  const heldAttempts = heldKey === key ? Number(prior?.attempts) || 0 : 0;
  if (heldKey === key && (heldReason === 'validation-failed' || heldAttempts >= LIMIT.providerAttempts)) return { result: { ...prior, state, ledger }, outcome: 'blocked-key-held', requests: 0 };
  if (typeof request !== 'function') return { result: retainOr('not-configured'), outcome: 'not-configured', requests: 0 };
  const spent = Number(ledger[month]?.estimatedUsd) || 0;
  if (spent + LIMIT.runReserveUsd > LIMIT.monthlyBudgetUsd) return { result: retainOr('monthly-budget'), outcome: 'monthly-budget', requests: 0 };

  const runner = createInvestigationRunner({ day: ledgerDay, screenFacts: (screen) => buildScreenPacket(screen, shared, context), nowMs,
    artifacts: artifacts !== undefined ? artifacts : investigationArtifacts(readPublic) });
  const linked = linkedHeadlines(ledgerDay, selection.leads);
  const message = buildLeadMessage({ session, leads: selection.leads, linked });
  const run = await runInvestigation({ request, runTool: runner, message, corpus: [message] });
  const usage = { ...run.usage };
  let requests = run.requests;
  let verdict = run.answer ? validateInvestigation(run.answer, { corpus: run.corpus, session, cited: run.cited, nowMs }) : null;
  let repaired = false;
  if (verdict?.issues.length && requests < LIMIT.maxRequests) {
    const fix = await repairInvestigation({ request, input: run.input, rawText: run.rawText, issues: verdict.issues, cited: run.cited });
    requests += 1; repaired = true;
    usage.inputTokens += fix.usage.inputTokens; usage.outputTokens += fix.usage.outputTokens; usage.searchCalls += fix.usage.searchCalls;
    if (fix.answer) verdict = validateInvestigation(fix.answer, { corpus: run.corpus, session, cited: run.cited, nowMs });
  }
  const estimatedUsd = estimateAiCostUsd(usage);
  const row = (ledger[month] ||= { investigations: 0, requests: 0, inputTokens: 0, outputTokens: 0, searchCalls: 0, estimatedUsd: 0 });
  row.investigations += 1; row.requests += requests; row.inputTokens += usage.inputTokens; row.outputTokens += usage.outputTokens; row.searchCalls += usage.searchCalls;
  row.estimatedUsd = Math.round((row.estimatedUsd + estimatedUsd) * 1e5) / 1e5;
  const spend = { usage: { ...usage, requests }, estimatedUsd, model: SHARED_AI_MODEL };
  if (verdict && !verdict.issues.length) {
    return { result: { ...base, ledger, status: 'verified', ...verdict.published, warnings: verdict.warnings, trail: run.trail, ...spend }, outcome: repaired ? 'verified-after-repair' : 'verified', requests };
  }
  // Blocked: reason codes only, never the rejected text.
  const provider = !run.answer;
  const attempts = provider ? heldAttempts + 1 : undefined;
  const reason = provider ? reasonCode(run.reason, 'provider-response-incomplete') : 'validation-failed';
  const issues = provider ? undefined : [...new Set((verdict?.issues || []).map((issue) => issue.split(':')[0]))];
  const blocked = retainOr(reason, { ...(attempts ? { attempts } : {}), ...(issues ? { issues } : {}), ...spend });
  return { result: blocked.status === 'blocked' ? blocked : { ...blocked, key: prior.key, blockedKey: key, blockedReason: reason, ...(attempts ? { attempts } : {}) }, outcome: provider ? reason : 'blocked', requests };
}
