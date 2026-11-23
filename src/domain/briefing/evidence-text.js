const ID = '(?:[0-9a-f]{8}|[a-z][a-z0-9]*(?:[-_.][a-z0-9]+)+(?::[0-9a-f]{8})?)';
const DOTTED = '[a-z][a-z0-9]*(?:\\.[a-z0-9_-]+){2,}';
const ID_LIST = new RegExp(`[ \\t]*\\[\\s*(?:[;,]\\s*)*${ID}(?:\\s*[;,]\\s*(?:${ID})?)*\\s*\\](?!\\()`, 'g');
const DOTTED_LIST = new RegExp(`[ \\t]*\\(\\s*${DOTTED}(?:\\s*,\\s*${DOTTED})*\\s*\\)`, 'g');

export function stripEvidenceIds(text) {
  return String(text || '')
    .replace(/\s*\[[^\]\n]*(?:headline:|market-analysis:|[a-z]+(?:[.-][a-z0-9]+)+:[0-9a-f]{8})[^\]\n]*\]/gi, '')
    .replace(/\s*\(?\b(?:market-analysis:[^\s,)]+|[a-z]+(?:[.-][a-z0-9]+)+:[0-9a-f]{8})\b\)?/gi, '')
    .replace(/\s*\(\d{4}-\d{2}-\d{2}T[\d:.]+Z\)/g, '')
    .replace(ID_LIST, '')
    .replace(DOTTED_LIST, '')
    .replace(/[ \t]*\(\s*\)/g, '')
    .replace(/[ \t]*\[[\s;,]*\](?!\()/g, '')
    // A packet section named as a source ("[향후 시나리오]") and the tail of a bracket whose opening was already
    // removed (".; regime-context]", ".;]", ".]") are citation debris too.
    .replace(/[ \t]*\[(?:향후|테마|중심|반대)?\s?시나리오\]/g, '')
    .replace(/^([^\[\n]*?)[ \t]*[;,]?[ \t]*(?:[a-z][a-z0-9-]*)?\](?=\s*$)/gm, '$1')
    .replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+([.,;])/g, '$1');
}
