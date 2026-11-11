// Chat context budget (2026-11-02, handed over by the AI-text thread). Measured with the fixture Worker on the local app:
// one chat question sent 35–76K characters of instructions (about 12–19K input tokens by chars/4), against ~2.5K tokens
// per request on 10/10 (owner usage CSV, 10/26). The largest parts were reference material, not live evidence:
// supplied materials ~9.4K characters on every question (chosen by page, so "PER이 뭐야?" carried it too), the
// AI-infrastructure framework ~16K when an AI topic is asked, and the imported research digest ~5.6K.
// These caps bound only those reference blocks. Live quotes, the screen basis, screener rows, news and the evidence
// registry are untouched, so answers keep every current number they could cite before.
// The news block is live evidence with its own explicit size (its wrapper's default is 2,400 characters): up to 8 items,
// titles 160 and summaries 300 characters, 6,000 characters in total.
export const CHAT_REFERENCE_BUDGET = Object.freeze({
  suppliedMaterials: 3600,
  aiInfraFramework: 6000,
  importedResearch: 3200,
  news: 6000,
  newsItems: 8,
  newsTitleChars: 160,
  newsSummaryChars: 300
});

// Keeps whole lines: the first `head` lines (block header and provenance) and the last `tail` lines (the block's own
// rules) always, then middle lines in order while they fit. A trimmed block says so, so the model discloses omissions.
export function capReferenceLines(text, maxChars, { head = 3, tail = 3 } = {}) {
  const raw = String(text == null ? '' : text);
  const limit = Number(maxChars);
  if (!raw || !Number.isFinite(limit) || limit <= 0 || raw.length <= limit) return raw;
  const lines = raw.split('\n');
  if (lines.length <= head + tail) return raw.slice(0, limit);
  const note = '[reference trimmed to the chat budget — some framework lines omitted; do not infer what they said]';
  const first = lines.slice(0, head);
  const last = lines.slice(lines.length - tail);
  let used = first.join('\n').length + last.join('\n').length + note.length + 3;
  const middle = [];
  for (const line of lines.slice(head, lines.length - tail)) {
    if (used + line.length + 1 > limit) break;
    middle.push(line);
    used += line.length + 1;
  }
  return [...first, ...middle, note, ...last].join('\n');
}
