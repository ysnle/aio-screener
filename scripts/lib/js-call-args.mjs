// Argument scanner for one JavaScript call; used by scripts/ci-assertion-trace-check.mjs.
// Given the offset of a call's opening '(', returns its top-level arguments as trimmed source slices, or null when
// the call does not close. Strings, template literals (with nested ${...}), comments and regex literals are skipped
// as units, so brackets and commas inside them never count. A '/' starts a regex when the previous significant token
// is not a value (identifier, number, ')' or ']'), or is a keyword such as return or typeof; inside a regex a
// character class [...] may hold an unescaped '/'.
const KEYWORDS_BEFORE_REGEX = new Set(['return', 'typeof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'instanceof', 'yield', 'await']);
const OPENERS = { '(': ')', '[': ']', '{': '}' };
const isWordChar = (ch) => /[\w$]/.test(ch) || ch > '\u007f';

export function callArguments(source, open) {
  const n = source.length;
  const args = [];
  const stack = []; // expected closers; '${' marks a template interpolation
  let start = open + 1;
  let prevValue = false; // previous significant token ends a value, so '/' is division
  let i = open + 1;
  const comments = []; // [from, to) ranges left out of the argument text
  const argument = (to) => {
    let text = '', at = start;
    for (const [from, end] of comments) if (from >= start && end <= to) { text += source.slice(at, from); at = end; }
    return (text + source.slice(at, to)).trim();
  };

  // Scans template text from `from` (just after '`' or after the '}' that closes an interpolation).
  // Returns the index after the closing '`' or after '${', and whether an interpolation opened.
  const templateText = (from) => {
    for (let j = from; j < n; j += 1) {
      const ch = source[j];
      if (ch === '\\') { j += 1; continue; }
      if (ch === '`') return { end: j + 1, interpolation: false };
      if (ch === '$' && source[j + 1] === '{') return { end: j + 2, interpolation: true };
    }
    return null;
  };
  const enterTemplate = (from) => {
    const text = templateText(from);
    if (!text) return false;
    i = text.end;
    if (text.interpolation) { stack.push('${'); prevValue = false; } else prevValue = true;
    return true;
  };

  while (i < n) {
    const ch = source[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    if (ch === '/' && source[i + 1] === '/') { const end = source.indexOf('\n', i); comments.push([i, end < 0 ? n : end]); i = end < 0 ? n : end; continue; }
    if (ch === '/' && source[i + 1] === '*') { const end = source.indexOf('*/', i + 2); if (end < 0) return null; comments.push([i, end + 2]); i = end + 2; continue; }
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      for (; j < n && source[j] !== ch; j += 1) { if (source[j] === '\\') j += 1; else if (source[j] === '\n') return null; }
      if (j >= n) return null;
      i = j + 1; prevValue = true; continue;
    }
    if (ch === '`') { if (!enterTemplate(i + 1)) return null; continue; }
    if (ch === '/' && !prevValue) {
      let j = i + 1, inClass = false;
      for (; j < n; j += 1) {
        const c = source[j];
        if (c === '\\') { j += 1; continue; }
        if (c === '\n') return null;
        if (inClass) { if (c === ']') inClass = false; continue; }
        if (c === '[') inClass = true;
        else if (c === '/') break;
      }
      if (j >= n) return null;
      i = j + 1;
      while (i < n && /[a-z]/i.test(source[i])) i += 1;
      prevValue = true; continue;
    }
    if (isWordChar(ch)) {
      let j = i + 1;
      while (j < n && isWordChar(source[j])) j += 1;
      prevValue = !KEYWORDS_BEFORE_REGEX.has(source.slice(i, j));
      i = j; continue;
    }
    if (OPENERS[ch]) { stack.push(OPENERS[ch]); prevValue = false; i += 1; continue; }
    if (ch === ')' || ch === ']' || ch === '}') {
      if (!stack.length) {
        if (ch !== ')') return null;
        args.push(argument(i));
        return args;
      }
      const expected = stack.pop();
      if (expected === '${' && ch === '}') { if (!enterTemplate(i + 1)) return null; continue; }
      if (expected !== ch) return null;
      prevValue = ch !== '}';
      i += 1; continue;
    }
    if (ch === ',' && !stack.length) { args.push(argument(i)); start = i + 1; }
    prevValue = false;
    i += 1;
  }
  return null;
}

// Snippet -> expected arguments. The calling gate runs these first and fails when the scanner misreads one.
export const CALL_ARGUMENT_CASES = [
  { name: 'regex with an escaped paren', source: "check(/foo\\(/.test(s), 'P1 msg')", args: ['/foo\\(/.test(s)', "'P1 msg'"] },
  { name: 'regex with a paren in a class', source: "check(/[)]/.test(s), 'P1 msg')", args: ['/[)]/.test(s)', "'P1 msg'"] },
  { name: 'regex with a slash in a class', source: "check(/a[/(]b/.test(s), 'P1 msg')", args: ['/a[/(]b/.test(s)', "'P1 msg'"] },
  { name: 'regex with an escaped brace', source: "assert.match(src, /x\\{/, 'P1 msg')", args: ['src', '/x\\{/', "'P1 msg'"] },
  { name: 'string holding a paren', source: "assert.equal(a, ')', 'P1 msg')", args: ['a', "')'", "'P1 msg'"] },
  { name: 'template with a call in ${}', source: "check(ok, `P1 ${a(b)} and ${`n${c[0]}`}`)", args: ['ok', '`P1 ${a(b)} and ${`n${c[0]}`}`'] },
  { name: 'division is not a regex', source: "check(a / b > c / (d), 'P1 msg')", args: ['a / b > c / (d)', "'P1 msg'"] },
  { name: 'line comment holding a paren', source: "check(ok, // note (\n  'P1 msg')", args: ['ok', "'P1 msg'"] },
  { name: 'block comment holding a comma', source: "check(ok /* a, b) */, 'P1 msg')", args: ['ok', "'P1 msg'"] },
  { name: 'regex after return in an arrow body', source: "check(() => { return /\\)/.test(s); }, 'P1 msg')", args: ['() => { return /\\)/.test(s); }', "'P1 msg'"] },
  { name: 'unclosed call', source: "check(a, 'P1 msg'", args: null },
];

export function callArgumentCaseFailures(scan = callArguments) {
  const failures = [];
  for (const testCase of CALL_ARGUMENT_CASES) {
    let actual;
    try { actual = scan(testCase.source, testCase.source.indexOf('(')); } catch (error) { actual = `threw ${error.message}`; }
    if (JSON.stringify(actual) !== JSON.stringify(testCase.args)) failures.push(`${testCase.name}: expected ${JSON.stringify(testCase.args)}, got ${JSON.stringify(actual)}`);
  }
  return failures;
}
