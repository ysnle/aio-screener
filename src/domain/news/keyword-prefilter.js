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
