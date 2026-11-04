// The control-character rule, once: ci-control-char-check (the gate) and agent-hook post-edit (the advisory warning on
// every Edit/Write, v59.70) both read it. C0 except tab/LF/CR, plus DEL and C1 — the mojibake signature (U+0080) and the
// heredoc signature (U+0008 where `\b` was meant: reaction-read.js v59.69).
export const CONTROL_CODE_RANGES = Object.freeze([
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x9f],
]);

export function isControlCode(code) {
  for (const [lo, hi] of CONTROL_CODE_RANGES) {
    if (code >= lo && code <= hi) return true;
  }
  return false;
}

export function countControlChars(text) {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (isControlCode(text.charCodeAt(i))) n++;
  }
  return n;
}

/** The first `limit` control characters as { line, code: 'U+0008' }. */
export function controlCharSites(text, limit = 5) {
  const sites = [];
  let line = 1;
  for (let i = 0; i < text.length && sites.length < limit; i++) {
    const code = text.charCodeAt(i);
    if (code === 0x0a) line++;
    else if (isControlCode(code)) sites.push({ line, code: `U+${code.toString(16).toUpperCase().padStart(4, '0')}` });
  }
  return sites;
}
