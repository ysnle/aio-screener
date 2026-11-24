// The AI market reading's rejected attempts, kept for the operator. Pure: no I/O.
//
// A rejected model answer went to the Actions log only, cut at 400 characters. The week's second most frequent block,
// axis-state-contradiction:volatility (23 attempts), could then not be diagnosed: the cut text stopped before the
// sentence the validator judged. The producer now writes each run's rejected attempts — the whole text, its issue list
// and the fingerprint of the inputs it was written from — outside the repository ($RUNNER_TEMP in CI), and refresh-data
// uploads that file as a short-retention Actions artifact. P1719 holds: rejected AI text is never in a published
// artifact or in the repository. It holds no prompt and no reader data: only the model's own answer, scrubbed of links
// and addresses, bounded per attempt and in count.
export const REJECTIONS_SCHEMA = 'market-analysis-rejections.v1';
export const REJECTIONS_MAX = 40; // about a day of blocked 30-minute runs at two attempts each
export const REJECTION_TEXT_MAX = 3000; // a reading is 6-9 lines, well under this
const ISSUES_MAX = 24;

// A model answer can quote a headline URL or an address it saw; neither is needed to diagnose a rule.
export const scrubRejectedText = (text) => String(text || '')
  .replace(/https?:\/\/\S+/gi, '[link]')
  .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[address]')
  .slice(0, REJECTION_TEXT_MAX);

/**
 * The next log: the previous one's attempts plus this run's, newest last, at most REJECTIONS_MAX.
 * @param {object|null} previous the log as last written (any shape; an unreadable one starts afresh)
 * @param {{attempt:string, issues:string[], text:string}[]} attempts this run's rejected attempts
 * @param {{nowMs:number, inputKey:string, contextKey?:string|null}} run when and from what this run wrote
 */
export function nextRejectionLog(previous, attempts, { nowMs, inputKey, contextKey = null }) {
  const at = new Date(nowMs).toISOString();
  const kept = Array.isArray(previous?.attempts) ? previous.attempts.filter((row) => row && typeof row.text === 'string') : [];
  const added = (Array.isArray(attempts) ? attempts : []).map((row) => ({
    at, attempt: String(row.attempt || ''), issues: (Array.isArray(row.issues) ? row.issues : []).map(String).slice(0, ISSUES_MAX),
    inputKey: String(inputKey || ''), contextKey: contextKey ? String(contextKey) : null, text: scrubRejectedText(row.text)
  }));
  return { schemaVersion: REJECTIONS_SCHEMA, generatedAt: at, max: REJECTIONS_MAX, attempts: [...kept, ...added].slice(-REJECTIONS_MAX) };
}

/** Issue counts over the log, most frequent first (the weekly "which rule blocks most" question). */
export function rejectionIssueCounts(log) {
  const counts = new Map();
  for (const row of Array.isArray(log?.attempts) ? log.attempts : []) for (const issue of row.issues || []) counts.set(issue, (counts.get(issue) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]);
}
