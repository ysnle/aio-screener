// The market investigation gate (public-data/data.json `marketInvestigation`, scripts/producer/market-investigation.mjs).
// The boot loader keeps the raw block (window._aioMarketInvestigation, src/data/server-data-loader.js); this route-side
// reader admits it for the close a screen shows: a verified investigation with its text inside the face's sizes, or a quiet
// session (no lead, nothing investigated). Anything else is no investigation: the screen leaves the place empty. The chat
// reads the same admitted block (src/ai/context/investigation-context.js), so screen and chat say the same thing.
import { isIsoDay } from '../domain/shared/session-date.js';

export const INVESTIGATION_SCHEMA = 'market-investigation.v1';
const VERDICT_MAX = 160;
const PARAGRAPH_MAX = 400;
const KINDS = ['price', 'official', 'news', 'inference'];
const text = (value, max) => (typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null);

/** { status: 'verified'|'quiet', session, verdict, paragraphs, causes, unknowns, leads, generatedAt } or null. */
export function serverInvestigation(root, { basis = null } = {}) {
  const block = root?._aioMarketInvestigation;
  if (!block || block.schemaVersion !== INVESTIGATION_SCHEMA || !isIsoDay(block.session?.us)) return null;
  if (basis && block.session.us !== basis) return null;
  const leads = (Array.isArray(block.leads) ? block.leads : []).map((lead) => text(lead?.text, 300)).filter(Boolean).slice(0, 8);
  if (block.status === 'quiet') return { status: 'quiet', session: block.session, verdict: null, paragraphs: [], causes: [], unknowns: [], leads, generatedAt: block.generatedAt || null };
  if (block.status !== 'verified') return null;
  const verdict = text(block.verdict, VERDICT_MAX);
  const paragraphs = (Array.isArray(block.paragraphs) ? block.paragraphs : []).map((row) => text(row, PARAGRAPH_MAX));
  if (!verdict || !paragraphs.length || paragraphs.length > 4 || paragraphs.some((row) => !row)) return null;
  const causes = (Array.isArray(block.causes) ? block.causes : []).filter((row) => row && KINDS.includes(row.kind) && text(row.claim, 400))
    .map((row) => ({ claim: row.claim.trim(), kind: row.kind, outlet: text(row.outlet, 40), date: isIsoDay(row.date) ? row.date : null, url: /^https:\/\//.test(String(row.url || '')) ? String(row.url) : null }));
  const unknowns = (Array.isArray(block.unknowns) ? block.unknowns : []).map((row) => text(row, 200)).filter(Boolean).slice(0, 4);
  return { status: 'verified', session: block.session, verdict, paragraphs, causes, unknowns, leads, generatedAt: block.generatedAt || null, retained: !!block.retained };
}
