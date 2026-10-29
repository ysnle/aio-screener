// v59.42: plain text from a simple PDF (the Fed's press-conference transcript) without a dependency. Flate streams are
// inflated; text-showing operators (Tj, TJ, ', ") are read from literal strings, and hex strings through the ToUnicode
// maps found in the file. The result is checked by the caller (readableEnglish): a PDF this cannot read keeps the
// summary on its report basis instead of producing a garbled "transcript".
import { inflateSync } from 'node:zlib';

function streams(buffer) {
  const text = buffer.toString('latin1');
  const out = [];
  const re = /<<([\s\S]*?)>>\s*stream\r?\n/g;
  let match;
  while ((match = re.exec(text))) {
    const start = match.index + match[0].length;
    const end = text.indexOf('endstream', start);
    if (end < 0) break;
    let data = buffer.subarray(start, end);
    if (/\/FlateDecode/.test(match[1])) {
      try { data = inflateSync(data); } catch { try { data = inflateSync(data.subarray(0, Math.max(0, data.length - 2))); } catch { continue; } }
    } else if (/\/Filter/.test(match[1])) continue;
    out.push(data.toString('latin1'));
    re.lastIndex = end;
  }
  return out;
}

function toUnicodeMap(sources) {
  const map = new Map();
  const hex = (h) => String.fromCodePoint(...(h.match(/.{1,4}/g) || []).map((part) => parseInt(part, 16)));
  for (const source of sources) {
    if (!source.includes('begincmap')) continue;
    for (const block of source.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(m[1].toLowerCase(), hex(m[2]));
    for (const block of source.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) for (const m of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const lo = parseInt(m[1], 16), hi = parseInt(m[2], 16), base = parseInt(m[3], 16), width = m[1].length;
      for (let code = lo; code <= hi && code - lo < 65536; code += 1) map.set(code.toString(16).padStart(width, '0'), String.fromCodePoint(base + code - lo));
    }
  }
  return map;
}

function literal(s) {
  return s.replace(/\\([nrtbf()\\]|[0-7]{1,3})/g, (_, e) => ({ n: '\n', r: '\r', t: '\t', b: '', f: '', '(': '(', ')': ')', '\\': '\\' }[e] ?? String.fromCharCode(parseInt(e, 8))));
}

function decodeHex(h, cmap) {
  const clean = h.replace(/\s+/g, '').toLowerCase();
  for (const width of [4, 2]) {
    if (clean.length % width) continue;
    const parts = clean.match(new RegExp(`.{${width}}`, 'g')) || [];
    if (parts.every((part) => cmap.has(part))) return parts.map((part) => cmap.get(part)).join('');
  }
  return '';
}

export function pdfText(buffer) {
  const all = streams(Buffer.from(buffer));
  const cmap = toUnicodeMap(all);
  const lines = [];
  for (const content of all) {
    if (!/\bBT\b/.test(content)) continue;
    for (const block of content.matchAll(/\bBT\b([\s\S]*?)\bET\b/g)) {
      let line = '';
      for (const op of block[1].matchAll(/\[((?:\\.|[^\]])*)\]\s*TJ|\(((?:\\.|[^\\)])*)\)\s*(?:Tj|'|")|<([0-9a-fA-F\s]+)>\s*Tj|(T\*|Td|TD)/g)) {
        // A positioning operator splits words mid-line in these files ("a" Td "bove"); line ends carry their own space.
        if (op[4]) continue;
        if (op[2] != null) { line += literal(op[2]); continue; }
        if (op[3] != null) { line += decodeHex(op[3], cmap); continue; }
        for (const part of op[1].matchAll(/\(((?:\\.|[^\\)])*)\)|<([0-9a-fA-F\s]+)>|(-?\d+(?:\.\d+)?)/g)) {
          if (part[1] != null) line += literal(part[1]);
          else if (part[2] != null) line += decodeHex(part[2], cmap);
          else if (Number(part[3]) < -200) line += ' ';
        }
      }
      lines.push(line);
    }
  }
  return lines.join('\n').replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
}

/** True when the text reads as English prose (most tokens are words), not glyph codes. */
export function readableEnglish(text, { minChars = 3000 } = {}) {
  const tokens = String(text || '').split(/\s+/).filter(Boolean);
  if (String(text || '').length < minChars || tokens.length < Math.min(400, minChars / 8)) return false;
  const words = tokens.filter((token) => /^[A-Za-z][a-z'’.,;:?!-]*$/.test(token)).length;
  return words / tokens.length > 0.6 && /\b(the|and|inflation|Committee)\b/.test(text);
}
