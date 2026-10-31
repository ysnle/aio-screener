// scripts/lib/regex-term-scan.mjs — v59.50 (recurrence audit 2026-10-31)
//
// The substring class (P1503, P1755, P2131, P2146, P2164: 'sPIKe' read as PIK, '시즌이란' as Iran, '유가증권' as 유가,
// '불안정' as 안정) recurred 18 times because each fix bounded the terms of one regex and the next keyword list was
// written bare. This finds, in regex literals, the alternatives that can match inside a longer word:
//   - a short Latin term (2–5 letters, optional s/?) with no word boundary on one side — \b, a lookaround, ^/$ or an
//     enclosing group that is itself bounded;
//   - a Korean term from KOREAN_TRAPS (a word that is also the tail or head of a common longer word) with no lookaround
//     on its trap side.
// It is a lexical scanner, not a parser: it reads literals after = : ( , | & ! ? [ and skips the rest. Counts feed a
// shrink-only ratchet (scripts/ci-regex-term-ratchet-check.mjs), so a false positive costs one baseline entry, never a
// rewrite.

export const KOREAN_TRAPS = Object.freeze({
  안정: 'before', // 불안정
  이란: 'before', // 시즌이란 (particle)
  유가: 'after', // 유가증권
});

const LITERAL = /(?<=[=:(,|&!?[]\s*)\/((?:[^/\\\n[]|\\.|\[(?:[^\]\\\n]|\\.)*\])+)\/([dgimsuvy]*)/g;
const LEFT_BOUND = /(?:\\b|\(\?<[!=][^)]*\)|\^)$/;
const RIGHT_BOUND = /^(?:s\??)?(?:\\b|\(\?[!=]|\$|\\d|\\s|[,.:;)\]]|$)/;
const BARE_LATIN = /^[A-Za-z]{2,5}(?:s\??)?$/;

// Splits a regex source into its alternatives with each one's left/right context, descending into groups. A group's
// context is inherited by the alternatives inside it, so \b(?:fed|cpi)\b bounds both.
function alternativesWithContext(source) {
  const out = [];
  const scan = (src, inheritedLeft, inheritedRight) => {
    let depth = 0;
    let cls = false;
    let start = 0;
    const parts = [];
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (c === '\\') { i++; continue; }
      if (cls) { if (c === ']') cls = false; continue; }
      if (c === '[') { cls = true; continue; }
      if (c === '(') depth++;
      else if (c === ')') depth--;
      else if (c === '|' && depth === 0) { parts.push([start, i]); start = i + 1; }
    }
    parts.push([start, src.length]);
    for (const [from, to] of parts) {
      const alt = src.slice(from, to);
      // Every alternative of a bounded group shares the group's edges: \b(?:a|b|c)\b bounds all three.
      const left = inheritedLeft;
      const right = inheritedRight;
      out.push({ alt, left, right });
      // Descend into each group of this alternative.
      let d = 0;
      let open = -1;
      let inCls = false;
      for (let i = 0; i < alt.length; i++) {
        const c = alt[i];
        if (c === '\\') { i++; continue; }
        if (inCls) { if (c === ']') inCls = false; continue; }
        if (c === '[') { inCls = true; continue; }
        if (c === '(') { if (d === 0) open = i; d++; }
        else if (c === ')') {
          d--;
          if (d === 0 && open >= 0) {
            const head = alt.slice(open + 1).match(/^\?(?:<[=!]|[=!])/);
            if (!head) {
              const inner = alt.slice(open + 1, i).replace(/^\?(?::|<[A-Za-z]\w*>)/, '');
              const before = alt.slice(0, open);
              const after = alt.slice(i + 1).replace(/^[?*+]|^\{\d+(?:,\d*)?\}/, '');
              // A group glued to a letter is an affix list ((?:analy)(?:st|sis), report(?:s|ed)), not a list of terms.
              if (!/[A-Za-z]$/.test(before) && !/^[A-Za-z]/.test(after)) {
                const groupLeft = LEFT_BOUND.test(before) || (before === '' && left);
                const groupRight = RIGHT_BOUND.test(after) || (after === '' && right);
                scan(inner, groupLeft, groupRight);
              }
            }
            open = -1;
          }
        }
      }
    }
  };
  scan(source, false, false);
  return out;
}

const stripEdges = (alt) => alt.replace(/^(?:\\b|\^|\(\?<[!=][^)]*\))+/, '').replace(/(?:\\b|\$|\(\?[!=][^)]*\))+$/, '');

export function unboundedTerms(source) {
  const found = [];
  for (const { alt, left, right } of alternativesWithContext(source)) {
    const core = stripEdges(alt);
    const hasLeft = left || /^(?:\\b|\^|\(\?<[!=])/.test(alt);
    const hasRight = right || /(?:\\b|\$|\(\?[!=][^)]*\))$/.test(alt) || /(?:\\b|\$)(?:s\??)?$/.test(alt);
    if (BARE_LATIN.test(core) && !(hasLeft && hasRight)) found.push(core);
    const side = KOREAN_TRAPS[core];
    if (side && !(side === 'before' ? hasLeft : hasRight)) found.push(core);
  }
  return found;
}

export function scanSource(text) {
  const terms = [];
  for (const match of String(text).matchAll(LITERAL)) {
    const [, source] = match;
    if (!source.includes('|')) continue; // a single-term literal is a pattern, not a keyword list
    terms.push(...unboundedTerms(source));
  }
  return terms;
}
