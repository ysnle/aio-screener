// v57.91 (P1901, performance audit): the legacy news scorer (js/aio-data.js scoreItem) tests about 2,500 keywords
// against every article with a Unicode word-boundary regex — about 5 million calls per news cycle, a 36-second task on
// a phone. A keyword can only match where its first two letters occur, so the article's letter pairs prefilter the
// list: keywords whose pair is absent are skipped, the rest go through the same matcher (identical hits and score).

/** Every single character and adjacent pair in `text` (UTF-16 units, as String.prototype.indexOf compares). */
export function textPairs(text) {
  const pairs = new Set();
  const value = String(text ?? '');
  for (let index = 0; index < value.length; index += 1) {
    pairs.add(value[index]);
    pairs.add(value.substr(index, 2));
  }
  return pairs;
}

const KEY_CACHE = new Map();
/** False only when `keyword` (lowercased, as the scorer lowercases it) cannot occur in a text with these `pairs`. */
export function keywordMayMatch(keyword, pairs) {
  let key = KEY_CACHE.get(keyword);
  if (key === undefined) {
    key = String(keyword ?? '').toLowerCase().slice(0, 2);
    KEY_CACHE.set(keyword, key);
  }
  return !key || !pairs || pairs.has(key);
}
