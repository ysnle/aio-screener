// v57.54: pure helper for scripts/qa-runner.mjs (kept apart so it can be tested without starting a QA run).
// The lines that say why a gate failed (assertion/FAIL/Error rows), at most five, each clipped, duplicates dropped.
export function failureCauseLines(text, { max = 5, width = 240 } = {}) {
  const seen = new Set();
  const out = [];
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || !/(^|\s)(FAIL|FAILED)\b|AssertionError|^Error\b|Error:|^not ok\b|✗/.test(line) || /^\[qa\]/.test(line) || /\bFAIL=0\b/.test(line)) continue;
    const clipped = line.length > width ? `${line.slice(0, width - 1)}…` : line;
    if (seen.has(clipped)) continue;
    seen.add(clipped);
    out.push(clipped);
    if (out.length >= max) break;
  }
  return out;
}
