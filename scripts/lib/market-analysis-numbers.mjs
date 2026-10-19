// P1594: bind a level to its own metric mention; never borrow the next metric's number.
const escapeRe = value => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const moveVerb = /^\s*(?:오른|내린|상승|하락|올라|내려|떨어|급등|급락|반등|증가|감소|높아|낮아|올랐|내렸|빠진|뛴)/;
const labelPattern = labels => `(?<![A-Za-z0-9_.:-])(?:${[...new Set(labels)].sort((a, b) => b.length - a.length).map(escapeRe).join('|')})(?![A-Za-z0-9_.:-])`;

// P1719 (live 10/13): "S&P 500은 10월 12일 7,807.24로 마감" was read as SPX=10 and "한국시간 오후 3시 기준" as a level of 3,
// blocking a correct commentary. A date, clock time, period or count is never a metric level or move. Both validators
// (label levels here, Korean-name mentions in fetch-data validateAnalysisMetricMentions) share this one rule.
const NON_METRIC_AFTER = /^\s*(?:일(?!본)|주(?![가식요])|월(?![가요])|개월|년|거래일|세션|배(?!럴)|명|개|종목|곳|건|위(?![로에])|번째|조건|시(?![장점가총작])|분|KST\b|ET\b)|^[:/]\d/;
const CLOCK_BEFORE = /(?:오전|오후|한국\s?시간|미국\s?시간|현지\s?시간|뉴욕\s?시간)\s*$/;
// 2026-10-19 data audit: "나스닥100·반도체의 50일선 회복" read 100 as a WTI level (98.64, in session) and blocked a verified
// analysis for intraday-time-missing:market.wti. An index's constituent count glued to its name is part of the name.
const INDEX_NAME_BEFORE = /(?:나스닥|코스피|코스닥|닛케이|러셀|유로스톡스|S&P|Nasdaq|KOSPI|KOSDAQ|Nikkei|Russell|Stoxx|FTSE|CSI)\s?$/i;
const INDEX_CONSTITUENT_COUNTS = new Set(['50', '100', '150', '200', '225', '300', '400', '500', '600', '1000', '2000', '3000']);
export function isNonMetricNumber(text, index, length) {
  const source = String(text);
  const digits = source.slice(index, index + length).replace(/^[+\-±]/, '').trim();
  if (INDEX_CONSTITUENT_COUNTS.has(digits) && INDEX_NAME_BEFORE.test(source.slice(Math.max(0, index - 12), index))) return true;
  const after = source.slice(index + length, index + length + 14);
  const prev = source[index - 1];
  return NON_METRIC_AFTER.test(after) || prev === ':' || prev === '/' || CLOCK_BEFORE.test(source.slice(Math.max(0, index - 8), index));
}

// v57.81 (10/15 crash day): one number per list item. "S&P 500 -1.11%, 공포·탐욕 지수 32점" read 32 as the S&P 500 level and
// "VIX +10.48%, 미국 주가지수 -1.11%" read -1.11% as VIX's move — the next item's subject is a name the label list does not
// know. Once a number of the clause has been read, a list comma before the next number ends the clause.
export const LIST_ITEM_BREAK = /[,，、]/;

export function analysisLevelsAfterLabels(text, labels, { allLabels = labels, unit = null } = {}) {
  // v57.81: citation brackets ("[7890d4bb]", "[d94fc971]") were read as levels — 7890 for the S&P 500 on 10/15.
  const body = String(text).replace(/https?:\/\/\S+/g, ' ').replace(/\[[^\]]*\]/g, ' ').replace(/\b[a-z][a-z0-9-]*(?:\.[a-z0-9-]+)+(?::[a-zA-Z0-9_-]+)?/g, ' ');
  const values = [];
  const mentions = new RegExp(labelPattern(labels), 'gi');
  for (const label of body.matchAll(mentions)) {
    let clause = body.slice(label.index + label[0].length, label.index + label[0].length + 80);
    const nextMetric = clause.search(new RegExp(labelPattern(allLabels), 'i'));
    if (nextMetric >= 0) clause = clause.slice(0, nextMetric);
    clause = clause.split(/(?<!\d)[.。](?!\d)|\n|[;；]/)[0];
    const numbers = /([+\-±]?)(\d[\d,]*(?:\.\d+)?)\s*(%포인트|%p|bp|포인트|%)?/gi;
    let previousEnd = -1;
    for (const match of clause.matchAll(numbers)) {
      const [, sign, digits, suffix = ''] = match;
      const after = clause.slice(match.index + match[0].length);
      // P1688 review: a count ("상위 10개 기업", "500종목") is not the metric's level. P1719: nor a date or clock time.
      if (isNonMetricNumber(clause, match.index, match[0].length)) continue;
      if (previousEnd >= 0 && LIST_ITEM_BREAK.test(clause.slice(previousEnd, match.index))) break;
      previousEnd = match.index + match[0].length;
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
