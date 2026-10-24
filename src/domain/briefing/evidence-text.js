// Evidence ids stay in the evidence store, not in the reader's text. X20: short ledger ids ([90b7eec7], [regime-context]);
// P1428: evidence ids and raw ISO stamps; P1651: whole citation brackets incl. headline URLs; codex audit F11 (2026-10-15,
// P1847): a comma list "[market.index.spx, market.index.kospi]" survived because only one id per bracket was matched.
// Ordinary brackets and parentheses (Korean words, "(S&P 500)", "(node.js)") are kept. The legacy analysis sink reads this
// through the compatibility layer (src/app/compatibility-globals.js), which installs it as the legacy global.
const ID = '(?:[0-9a-f]{8}|[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)+(?::[0-9a-f]{8})?)';
const DOTTED = '[a-z][a-z0-9]*(?:\\.[a-z0-9_-]+){2,}';
const ID_LIST = new RegExp(`[ \\t]*\\[\\s*${ID}(?:\\s*,\\s*${ID})*\\s*\\](?!\\()`, 'g');
const DOTTED_LIST = new RegExp(`[ \\t]*\\(\\s*${DOTTED}(?:\\s*,\\s*${DOTTED})*\\s*\\)`, 'g');

export function stripEvidenceIds(text) {
  return String(text || '')
    .replace(/\s*\[[^\]\n]*(?:headline:|market-analysis:|[a-z]+(?:[.-][a-z0-9]+)+:[0-9a-f]{8})[^\]\n]*\]/gi, '')
    .replace(/\s*\(?\b(?:market-analysis:[^\s,)]+|[a-z]+(?:[.-][a-z0-9]+)+:[0-9a-f]{8})\b\)?/gi, '')
    .replace(/\s*\(\d{4}-\d{2}-\d{2}T[\d:.]+Z\)/g, '')
    .replace(ID_LIST, '')
    .replace(DOTTED_LIST, '')
    // v58.72: "-1.21%([market.index.spx:75cea69c])" left an empty "()" once the bracketed id was removed.
    .replace(/[ \t]*\(\s*\)/g, '')
    // v58.74: "[[regime-context]]" and "[[regime-context];]" left "[]" and "[;]" behind.
    .replace(/[ \t]*\[[\s;,]*\](?!\()/g, '')
    .replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([.,;])/g, '$1');
}
