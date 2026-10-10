// P1594: bind a level to its own metric mention; never borrow the next metric's number.
const escapeRe = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const moveVerb = /^\s*(?:오른|내린|상승|하락|올라|내려|떨어|급등|급락|반등|증가|감소|높아|낮아|올랐|내렸|빠진|뛴)/;
const labelPattern = labels => `(?<![A-Za-z0-9_.:-])(?:${[...new Set(labels)].sort((a, b) => b.length - a.length).map(escapeRe).join('|')})(?![A-Za-z0-9_.:-])`;

export function analysisLevelsAfterLabels(text, labels, { allLabels = labels, unit = null } = {}) {
  const body = String(text).replace(/https?:\/\/\S+/g, ' ').replace(/\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+(?::[a-zA-Z0-9_-]+)?/g, ' ');
  const values = [];
  const mentions = new RegExp(labelPattern(labels), 'gi');
  for (const label of body.matchAll(mentions)) {
    let clause = body.slice(label.index + label[0].length, label.index + label[0].length + 80);
    const nextMetric = clause.search(new RegExp(labelPattern(allLabels), 'i'));
    if (nextMetric >= 0) clause = clause.slice(0, nextMetric);
    clause = clause.split(/(?<!\d)[.。](?!\d)|\n|[;；]/)[0];
    const numbers = /([+\-±]?)(\d[\d,]*(?:\.\d+)?)\s*(%포인트|%p|bp|포인트|%)?/gi;
    for (const match of clause.matchAll(numbers)) {
      const [, sign, digits, suffix = ''] = match;
      const after = clause.slice(match.index + match[0].length);
      if (/^\s*(?:일|주|개월|년)(?:간|동안|치|전|후|\s|$)/.test(after)) continue;
      if (/^(?:%p|%포인트|bp|포인트)$/i.test(suffix) || moveVerb.test(after)
          || (suffix === '%' && unit !== 'percent') || sign === '+' || sign === '±') continue;
      const value = Number((sign + digits).replace(/,/g, ''));
      if (Number.isFinite(value)) values.push(value);
      break;
    }
  }
  return values;
}

export function analysisProse(text, labels) {
  return String(text).replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+(?::[a-zA-Z0-9_-]+)?/g, ' ')
    .replace(new RegExp(labelPattern(labels), 'gi'), ' ');
}
