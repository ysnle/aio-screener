// Top-level statement splitter for classic (non-module) scripts; used by scripts/dead-code.mjs.
// Minimal JS scanner: splits a classic script into top-level statements with exact
// [start,end) character offsets. Handles comments, strings, template literals (with
// nested ${}), regex literals (heuristic on the previous significant token) and
// brace/paren/bracket depth. A top-level statement ends at depth 0 on ';' or on a
// closing '}' that completes a function declaration / block, or at a newline when the
// next significant char starts a new statement after a complete expression (ASI-lite).
export function splitTopLevel(src) {
  const n = src.length;
  let i = 0;
  let depth = 0;
  let stmtStart = null;
  const stmts = [];
  let prevSig = ''; // previous significant token char/word for regex heuristic
  let prevWord = '';
  const regexAllowedAfter = new Set(['', '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
  const kwBeforeRegex = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof']);
  const openStmt = (at) => { if (stmtStart === null) stmtStart = at; };
  const closeStmt = (at) => { if (stmtStart !== null) { stmts.push([stmtStart, at]); stmtStart = null; } };
  const skipTemplate = () => { // at '`'
    i++;
    while (i < n) {
      const c = src[i];
      if (c === '\\') { i += 2; continue; }
      if (c === '`') { i++; return; }
      if (c === '$' && src[i + 1] === '{') {
        i += 2; let d = 1;
        while (i < n && d > 0) {
          const ch = src[i];
          if (ch === '{') { d++; i++; continue; }
          if (ch === '}') { d--; i++; continue; }
          if (ch === '`') { skipTemplate(); continue; }
          if (ch === '"' || ch === "'") { skipString(ch); continue; }
          if (ch === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
          if (ch === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
          i++;
        }
        continue;
      }
      i++;
    }
  };
  function skipString(q) { i++; while (i < n) { const c = src[i]; if (c === '\\') { i += 2; continue; } if (c === q) { i++; return; } if (c === '\n') { i++; return; } i++; } }
  const skipRegex = () => { i++; let inClass = false; while (i < n) { const c = src[i]; if (c === '\\') { i += 2; continue; } if (c === '[') inClass = true; else if (c === ']') inClass = false; else if (c === '/' && !inClass) { i++; while (/[a-z]/i.test(src[i] || '')) i++; return; } else if (c === '\n') { return; } i++; } };
  while (i < n) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (/\s/.test(c)) {
      // ASI-lite at depth 0: a newline after a complete statement-ish token followed by a new statement start
      if (c === '\n' && depth === 0 && stmtStart !== null) {
        let j = i + 1; while (j < n && /[ \t\r]/.test(src[j])) j++;
        const nextIsStmt = /^(function\b|var\b|let\b|const\b|window\.|if\b|try\b|\(function|\(\(\)|document\.|_aio[\w$.]*\(|AIO\.[\w$.]+\s*=|setTimeout|async function)/.test(src.slice(j, j + 40));
        if ((prevSig === '}' || prevSig === ')' ) && nextIsStmt && !/^[.?:,+\-*/&|=]/.test(src.slice(j, j + 1))) closeStmt(i);
      }
      i++; continue;
    }
    openStmt(i);
    if (c === '"' || c === "'") { skipString(c); prevSig = 'x'; prevWord = ''; continue; }
    if (c === '`') { skipTemplate(); prevSig = 'x'; prevWord = ''; continue; }
    if (c === '/') {
      if (regexAllowedAfter.has(prevSig) || kwBeforeRegex.has(prevWord)) { skipRegex(); prevSig = 'x'; prevWord = ''; continue; }
      i++; prevSig = '/'; prevWord = ''; continue;
    }
    if (/[A-Za-z_$0-9]/.test(c)) { let j = i; while (j < n && /[\w$]/.test(src[j])) j++; prevWord = src.slice(i, j); prevSig = 'x'; i = j; continue; }
    if (c === '{' || c === '(' || c === '[') { depth++; prevSig = c; prevWord = ''; i++; continue; }
    if (c === '}' || c === ')' || c === ']') {
      depth--; prevSig = c; prevWord = ''; i++;
      if (depth === 0 && c === '}') {
        // function declaration or block ends here unless followed by ; ) , . etc on same statement
        let j = i; while (j < n && /[ \t\r]/.test(src[j])) j++;
        const next = src[j];
        const head = src.slice(stmtStart, stmtStart + 40);
        if (/^(function\b|async function\b|if\b|try\b|for\b|while\b|\{)/.test(head) && !(head.startsWith('if') && /^\s*else\b/.test(src.slice(j, j + 10))) && !(head.startsWith('try') && /^\s*(catch|finally)\b/.test(src.slice(j, j + 12))) && next !== '.' && next !== ',' && next !== ')') closeStmt(i);
      }
      continue;
    }
    if (c === ';' && depth === 0) { i++; closeStmt(i); prevSig = ';'; prevWord = ''; continue; }
    prevSig = c; prevWord = ''; i++;
  }
  closeStmt(n);
  return stmts;
}

export function describeStatement(text) {
  const t = text.trimStart();
  let m;
  if ((m = t.match(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/))) return { kind: 'function', name: m[1] };
  if ((m = t.match(/^window\.(AIO(?:\.[A-Za-z_$][\w$]*)+|[A-Za-z_$][\w$]*)\s*=(?!=)/))) return { kind: 'assign', name: m[1] };
  if ((m = t.match(/^(?:var|let|const)\s+([A-Za-z_$][\w$]*)/))) return { kind: 'var', name: m[1] };
  if ((m = t.match(/^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*=(?!=)/))) return { kind: 'assign', name: m[1] };
  return { kind: 'other', name: null };
}
