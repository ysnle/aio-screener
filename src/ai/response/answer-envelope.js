// The model writes the answer as ordinary text first and one trailing
// [AI_ANSWER_META]{claims, citations, followUps, remember}[/AI_ANSWER_META] block. The old envelope was one JSON object
// holding the prose, so an answer cut at the length limit lost all of it and nothing could be shown while it streamed.
// The body is everything before the block's opening marker, so a partial stream and a truncated answer both have a body.
const META_OPEN = /\[AI_ANSWER_META\]/i;
const META_CLOSE = /\[\/AI_ANSWER_META\]/gi;

/**
 * `unfinished`: the text is a stream still running or an answer cut at the length limit; with no trailing block yet,
 * its last, unfinished sentence is held back.
 */
export function splitAnswerText(text, { unfinished = false } = {}) {
  const source = String(text == null ? '' : text);
  const open = source.search(META_OPEN);
  if (open < 0) {
    // A marker still being typed at the end of a partial stream ("[AI_ANSW") and a stray closing marker are not body text.
    const body = source.replace(META_CLOSE, '').replace(/\[A?I?_?[A-Z_]*$/i, (tail) => ('[AI_ANSWER_META]'.startsWith(tail.toUpperCase()) ? '' : tail)).trim();
    return { body: unfinished ? finishedText(body) : body, meta: {}, metaState: 'missing' };
  }
  const body = source.slice(0, open).trim();
  const block = source.slice(open).match(/\[AI_ANSWER_META\]([\s\S]*?)\[\/AI_ANSWER_META\]/i);
  if (!block) return { body, meta: {}, metaState: 'incomplete' };
  try {
    const meta = JSON.parse(block[1]);
    return meta && typeof meta === 'object' && !Array.isArray(meta) ? { body, meta, metaState: 'ok' } : { body, meta: {}, metaState: 'invalid' };
  } catch (_) {
    return { body, meta: {}, metaState: 'invalid' };
  }
}

// The last line is kept up to its last sentence end; a line with none (a heading, list item or table row being written)
// is dropped. A sentence end is a terminator followed by a space or the end, so "3.5%" is not one.
const SENTENCE_END = /[.!?。…]["'”’)\]]*(?=\s|$)/g;
export function finishedText(body) {
  const lines = String(body || '').replace(/\s+$/, '').split('\n');
  const last = lines.pop() || '';
  if (/^\s*\|/.test(last)) return (/\|\s*$/.test(last) ? [...lines, last] : lines).join('\n').trim();
  let end = -1;
  for (const match of last.matchAll(SENTENCE_END)) {
    const at = match.index + match[0].length;
    if (at === last.length && /\d\.$/.test(last)) continue; // "… 12." may be the start of "12.5"
    end = at;
  }
  return (end > 0 ? [...lines, last.slice(0, end)] : lines).join('\n').trim();
}
