// P1519: one evidence-publication policy shared by the legacy adapter and native ESM.
import { stampDay } from '../../domain/shared/session-date.js';
export function claimEvidenceId(row) {
  return String(row && (row.evidenceId || row.documentId || row.id) || '').trim();
}

export function claimEvidenceTuple(row) {
  row = row || {};
  return JSON.stringify({
    source: String(row.source || row.publisher || row.canonicalUrl || row.sourceUrl || '').trim(),
    asOf: String(row.asOf || row.publishedAt || row.retrievedAt || '').trim(),
    metric: String(row.metric || row.metricId || '').trim(),
    entity: String(row.entity || row.entityId || row.ticker || row.symbol || '').trim(),
    value: row.value == null ? null : (typeof row.value === 'number' ? row.value : String(row.value).trim()),
    unit: String(row.unit || '').trim(),
    scale: String(row.scale || 'raw').trim()
  });
}

export function evidenceCanPublish(row, nowMs = Date.now()) {
  var status = String(row && (row.status || row.truthStatus) || '').toLowerCase();
  var rights = String(row && row.rights || '').toUpperCase();
  var allowedUse = String(row && row.allowedUse || '').toLowerCase();
  var asOfTime = Date.parse(row && (row.asOf || row.observedAt || row.publishedAt || row.retrievedAt) || '');
  var futureAsOf = Number.isFinite(asOfTime) && asOfTime > nowMs + 60000;
  return !!claimEvidenceId(row) &&
    /^(ok|verified|fresh|live|reference|results_found)$/.test(status) &&
    !/(blocked|missing|stale|mismatch|invalid|refresh_required|unavailable|conflict|contradicted)/.test(status) &&
    !/^(SNIPPET|SUMMARY)$/.test(String(row && row.contentDepth || '')) &&
    rights !== 'BLOCKED' && allowedUse !== 'none' && !futureAsOf;
}

export function claimSourceUrl(value) {
  try {
    var url = new URL(String(value || ''));
    if (url.protocol !== 'https:' || url.username || url.password) return '';
    url.hash = '';
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'oc'].forEach(function(key) { url.searchParams.delete(key); });
    return url.toString().replace(/\/$/, '');
  } catch (_) { return ''; }
}

// P1525 (audit H104 class): a current-sensitive sentence carrying a count or a magnitude must be bound to evidence, not
// slip through because its unit was not on the list. Counts (개/곳/건/명/종목) and Korean magnitudes (조/억/만) are
// covered; 개월/개년 stay out so a period like "3개월" is not read as a current figure.
// Briefing audit 2026-10-17: the particles 가/도/의 joined the metric list ("VIX가 15.2로" published unbound); a period after
// the number ("금리가 3개월") stays out. v58.77 (pipeline audit AI-02): index levels without a unit ("코스피는 2,450이다") are covered.
// A market instrument whose level is quoted without a unit, optionally with an alias or a per-unit word:
// "달러인덱스(DXY)는 104.2입니다", "WTI는 배럴당 71.4입니다", "10년물은 4.15에 마감했다".
var UNITLESS_MARKET_LEVEL = /(?:10년물|2년물|30년물|국채\s*금리|원\/달러|달러\/원|달러인덱스|\b(?:DXY|WTI)\b|브렌트|유가(?!증권)|금\s*가격|금값|비트코인)(?:\s*\([^)]{1,20}\))?\s*(?:는|은|이|가|도|의|:)?\s*(?:배럴당|온스당)?\s*\d[\d,.]*(?!\s*(?:개월|개년|년|분기|주|일|거래일|세션))/i;
// A decimal or comma-grouped number that is not a period, date or count: "182.3", "1,385.2". It counts only in a
// sentence that also reports an observation ("엔비디아는 어제 182.3에 마감했다").
var OBSERVED_PLAIN_NUMBER = /(?<![\d,.])(?:\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+\.\d+)(?![\d,.]|\s*(?:년|월|일|개월|분기|주|쪽|번|차례|회|명|개|곳|건))/;
// Detection reads a normalised copy: NFKC turns full-width digits and "％" into ASCII, and markdown emphasis and backticks
// are removed so "**VIX** 15.2" reads "VIX 15.2".
function normaliseForDetection(value) {
  return String(value || '').normalize('NFKC').replace(/\*\*|__|[*`]/g, '');
}
// Units and currency codes spelled out: "4.1 퍼센트", "72,000 KRW", "182.3 dollars", "4.15 percent", "KRW 72,000", "USD 182.3".
var SPELLED_UNIT_NUMBER = /\d[\d,.]*\s*(?:퍼센트|\b(?:KRW|USD)\b|\bdollars?\b|\bpercent\b)|\b(?:USD|KRW|US\$)\s*\d/i;
export function hasCurrentNumericContent(value) {
  var text = normaliseForDetection(value);
  if (UNITLESS_MARKET_LEVEL.test(text) || SPELLED_UNIT_NUMBER.test(text) || (OBSERVATION_MARKER.test(text) && OBSERVED_PLAIN_NUMBER.test(text))) return true;
  return /(?:[$₩€]\s*\d[\d,.]*|\d[\d,.]*\s*(?:%|bp|bps|원|달러|USD|배|포인트|pt|지수)|(?:VIX(?:\s*지수)?|PER|PBR|PSR|PEG|ROE|RSI|주가|시세|환율|금리|시가총액|매출|영업이익)\s*(?:는|은|이|가|도|의|:)?\s*\d[\d,.]*(?!\s*(?:개월|개년|년|분기|주|일|거래일|세션))|(?:코스피|KOSPI)(?:\s*200)?\s*(?:지수)?\s*(?:는|은|이|가|도|의|:)?\s*\d[\d,.]*(?!\s*(?:개월|개년|년|분기|주|일|거래일|세션))|(?:코스닥|나스닥|다우|닛케이|니케이|러셀\s*2000|S&P\s*500|KOSDAQ|Nasdaq|Dow|Nikkei)\s*(?:지수)?\s*(?:는|은|이|가|도|의|:)?\s*\d[\d,.]*(?!\s*(?:개월|개년|년|분기|주|일|거래일|세션))|(?:현재|최신|지금|오늘)[^.!?。！？\n]{0,40}?\d[\d,.]*|\d[\d,.]*\s*(?:개(?![월년])|곳|건|명|종목|조|억|만)|\b(?:19|20)\d{2}-\d{2}-\d{2}(?!\d))/i.test(text);
}

// X02 (2026-10-13): a period/question mark only ends a sentence when it is not glued to the next
// ASCII token — "14.84", "apnews.com" and "?utm_source" stay whole, so a dropped numeric claim
// leaves no "84, 미 10년물 5." fragment and a kept URL is never re-joined with inserted spaces.
export function splitAnswerSentences(line) {
  var text = String(line || '');
  var pieces = [];
  var start = 0;
  for (var i = 0; i < text.length; i++) {
    var ch = text[i];
    var ends = '。！？'.indexOf(ch) >= 0 || ('.!?'.indexOf(ch) >= 0 && !/[A-Za-z0-9_%\/=&#~+\-０-９Ａ-Ｚａ-ｚ]/.test(text[i + 1] || ''));
    if (!ends) continue;
    while (i + 1 < text.length && '.!?。！？'.indexOf(text[i + 1]) >= 0) i++;
    pieces.push(text.slice(start, i + 1));
    start = i + 1;
  }
  if (start < text.length) pieces.push(text.slice(start));
  return pieces.map(function(piece) { return piece.trim(); }).filter(Boolean);
}

// An inline web citation as the search model writes it: "([investor.nvidia.com](https://…?utm_source=openai))". A piece
// that is nothing but citations belongs to the sentence before it, so a removed sentence takes its sources with it.
var INLINE_LINK = /\[([^\[\]\n]*)\]\((https?:\/\/[^)\s]+)\)/g;
var CITATION_ONLY = /^\(?\s*(?:\[[^\[\]\n]*\]\(https?:\/\/[^)\s]+\)\s*[,;·]?\s*)+\)?[.!?。]*$/;
function answerSentences(line) {
  return splitAnswerSentences(line).reduce(function(out, piece) {
    if (out.length && CITATION_ONLY.test(piece)) out[out.length - 1] += ' ' + piece;
    else out.push(piece);
    return out;
  }, []);
}
// The tail of a link whose opening bracket is gone ("…dia.com](https://…))") is never published as text: whole links stay
// (the bubble renders them), the broken tail goes (its source is in the reference list under the answer).
var LINK_TAIL = /[A-Za-z0-9.\-]*\]\(https?:\/\/[^)\s]+\)\)?/g;
var LINK_MASK = /\uE000(\d+)\uE001/g;
export function tidyInlineCitations(value) {
  var links = [];
  var masked = String(value || '').replace(INLINE_LINK, function(all) { links.push(all); return '\uE000' + (links.length - 1) + '\uE001'; });
  return masked.replace(LINK_TAIL, '').replace(/[ \t]+$/gm, '').replace(LINK_MASK, function(all, index) { return links[Number(index)]; });
}
// A current figure the reader asked to be searched is published when its sentence cites one of this request's web
// sources (plan 044: "a current figure must exist in what the model was given — injected evidence, search citations").
// It is not when the sentence derives the figure itself, or when an AIO figure for the same subject, metric and unit
// says otherwise. Table cells and typed claims never take search figures (AGENTS: search never feeds tables or scores).
var DERIVED_FIGURE = /(?:계산|환산|합치면|합산|더하면|빼면|나누면|곱하면|평균하면|차이(?:는|가)|격차(?:는|가)|이므로|따라서|즉,?\s)/;
function citationUrlSet(citations) {
  var urls = (Array.isArray(citations) ? citations : []).map(function(item) { return claimSourceUrl(typeof item === 'string' ? item : item && item.url); }).filter(Boolean);
  return urls.length ? new Set(urls) : null;
}
function citesSearchSource(sentence, urls) {
  return !!urls && Array.from(String(sentence || '').matchAll(INLINE_LINK)).some(function(match) { return urls.has(claimSourceUrl(match[2])); });
}
function contradictsReference(text, numbers, entities) {
  if (!Array.isArray(numbers) || !numbers.length) return false;
  var matchers = entityMatchers(entities);
  var named = matchers ? namedEntities(text, matchers) : [];
  return readWrittenFigures(text, { subject: named.length === 1 ? named[0] : null }).some(function(figure) {
    var unit = writtenUnit(figure.match[4] || String(figure.match[1] || '').trim());
    if (!figure.want.metric || figureSupported(figure.match, numbers, figure.want)) return false;
    return numbers.some(function(number) { return number.metric === figure.want.metric && number.unit === unit && (number.entity || null) === (figure.want.subject || null); });
  });
}
function searchedSentenceKept(sentence, urls, numbers, entities) {
  if (!citesSearchSource(sentence, urls)) return false;
  var text = String(sentence).replace(INLINE_LINK, ' $1 ').replace(CITED_URL, ' ');
  return !DERIVED_FIGURE.test(normaliseForDetection(text)) && !contradictsReference(text, numbers, entities);
}

// P1740: a threshold inside a condition ("VIX가 20을 넘으면", "RSI 70 이상이면 과매수로 본다", "if yields top 5%")
// is a rule, not an observation. Stripping every sentence with a number removed exactly the invalidation levels and
// confirmation signals the answer contract asks for. A sentence is a condition only when it has a conditional
// ending and no marker of a present or past observation; "현재 15인 VIX가 20을 넘으면" still carries a current value.
var CONDITIONAL_MARKER = /(?:[가-힣](?:으면|면|라면|이라면)(?=[\s,.!?)]|$)|(?:경우|때)(?:에는|에|는)?(?=[\s,.!?)]|$)|\s시(?:에는|에)?(?=[\s,.!?)]|$)|이상이면|이하이면|넘어서면|웃돌면|밑돌면|\b(?:if|when|unless|above|below)\b)/i;
// v57.92 (internal audit A02): a threshold noun alone made "VIX는 15.2로 기준선 아래입니다" a condition, so an unverified
// current reading survived. The noun now counts only when the number is the threshold it names ("20을 기준선으로",
// "임계값 70", "무효화 가격 95") — not when a metric's own value sits beside it.
var THRESHOLD_NOUN_RULE = /(?:\d[\d,.]*\s*(?:%|bp|포인트|pt)?\s*(?:을|를|이|가|은|는)?\s*(?:기준선|임계|트리거|무효화|조건)|(?:기준선|임계(?:값|치)?|트리거|무효화\s*(?:선|가격|수준|기준)?|조건)\s*(?:은|는|이|가|:|=|으로|로)?\s*\d)/i;
var NON_CONDITIONAL_MYEON = /(?:반면|측면|전면|국면|이면서|표면|화면|단면|정면|방면|양면|평면|내면|외면|지면|장면)(?=[\s,.!?)]|$)/;
var OBSERVATION_MARKER = /(?:현재|지금|오늘|금일|현시점|방금|최근|어제|전일|전날|지난\s*(?:주|달|분기|해)|이번\s*(?:주|달|분기)|마감|종가|기록(?:했|한|하)|나타냈|보였|올랐|내렸|떨어졌|하락했|상승했|급등|급락|발표된|발표했|as of|currently|today|yesterday|closed at|now)/i;
export function isConditionalNumericSentence(sentence) {
  var text = String(sentence || '');
  if (!CONDITIONAL_MARKER.test(text.replace(NON_CONDITIONAL_MYEON, ' ')) && !THRESHOLD_NOUN_RULE.test(text)) return false;
  if (OBSERVATION_MARKER.test(text)) return false;
  return !/\b(?:19|20)\d{2}-\d{2}-\d{2}\b|\b(?:19|20)\d{2}년\s*\d{1,2}월/.test(text);
}

// A number about the past or a fixed structure is not a current observation. "2008년 금융위기 때 S&P 500은 약 57%
// 하락했습니다" and "S&P 500은 11개 섹터로 구성됩니다" were stripped from current-sensitive answers as unbound current
// figures, which removed the history and definitions a reader asked for. numericClaimKind names what a numeric sentence
// is; only 'current' must be bound to evidence.
// A calendar year in prose ("2008년", "2020년 3월", "1970년대"); "10년물" and "3년" are not calendar years.
var CALENDAR_YEAR = /(?<!\d)((?:19|20)\d{2})\s*년/g;
// A completed period named without a year: a named crisis, or a trailing span of five years or more ("지난 10년간").
var COMPLETED_PERIOD = /(?:금융\s*위기|닷컴\s*버블|블랙\s*먼데이|대공황|외환\s*위기|오일\s*쇼크|석유\s*파동)\s*(?:때|당시|기간|에)/;
var TRAILING_YEARS = /지난\s*(?:[5-9]|[1-9]\d)\s*년\s*(?:간|동안)/;
var CURRENT_MARKER = /(?:현재|지금|오늘|최근|이번\s*(?:주|달|분기)|올해|금일|현\s*시점|어제|전일|전날|방금|\bas of\b|\bcurrently\b|\btoday\b|\byesterday\b)/i;
var RECENT_DATE_DAYS = 60;
var RECENT_REPORT_WORD = /분기|매출|영업이익|순이익|실적|EPS|가이던스|현금흐름|마진|이익률|배당/i;
function todayMs(today) {
  var ms = today instanceof Date ? today.getTime() : typeof today === 'number' ? today : today ? Date.parse(today) : NaN;
  return Number.isFinite(ms) ? ms : Date.now();
}
// A date within the last 60 days (or ahead of today) reads as current: "2026-11-02", "2026년 10월 30일", "2026년 10월".
function namesRecentDate(text, nowMs) {
  var dates = [];
  var match;
  var iso = /(?<!\d)((?:19|20)\d{2})-(\d{2})-(\d{2})(?!\d)/g;
  while ((match = iso.exec(text))) dates.push(Date.UTC(+match[1], +match[2] - 1, +match[3]));
  var korean = /(?<!\d)((?:19|20)\d{2})\s*년\s*(\d{1,2})\s*월(?:\s*(\d{1,2})\s*일)?/g;
  while ((match = korean.exec(text))) dates.push(match[3] ? Date.UTC(+match[1], +match[2] - 1, +match[3]) : Date.UTC(+match[1], +match[2], 0));
  return dates.some(function(time) { return nowMs - time <= RECENT_DATE_DAYS * 86400000; });
}
function isDatedPast(text, nowMs) {
  var year = new Date(nowMs).getUTCFullYear();
  var years = Array.from(text.matchAll(CALENDAR_YEAR)).map(function(match) { return +match[1]; });
  if (years.some(function(value) { return value >= year; })) return false;
  // Last year's company results are the newest reported figures, not history: they stay bound to evidence.
  if (years.some(function(value) { return value === year - 1; }) && RECENT_REPORT_WORD.test(text)) return false;
  var past = years.some(function(value) { return value < year; }) || COMPLETED_PERIOD.test(text) || TRAILING_YEARS.test(text);
  return past && !CURRENT_MARKER.test(text) && !namesRecentDate(text, nowMs);
}
// A definition or structural count: "11개 섹터로 구성됩니다", "연 8회 열립니다", "최대 2,100만 개로 제한됩니다". The count
// is the only number, the verb defines, and nothing is observed. "200일선 위 44개 종목이다" is a reading, not a definition:
// a bare copula counts only beside a defining word.
var FIXED_COUNT_SOURCE = '(?:연\\s*)?\\d[\\d,]*\\s*(?:만\\s*)?(?:개(?![월년])|곳|종목|회|차례|명|가지)';
var FIXED_COUNT = new RegExp(FIXED_COUNT_SOURCE);
var DEFINITIONAL_END = /(?:구성(?:됩니다|된다|돼\s*있습니다|되어\s*있습니다)|이루어(?:집니다|진다|져\s*있습니다)|나뉩니다|나뉜다|제한됩니다|제한된다|정해져\s*있습니다|정해집니다|열립니다|열린다|엽니다|발표됩니다|발표된다|뜻합니다|뜻한다|의미합니다|의미한다)[.!?。]*\s*$/;
var COPULA_END = /(?:입니다|이다)[.!?。]*\s*$/;
var DEFINITIONAL_WORD = /(?:구성|이루어|나뉘|나뉜|제한|정해|정의|뜻|의미)/;
var OBSERVATION_VERB = /(?:올랐|내렸|하락했|상승했|마감|기록했|거래)/;
function isFixedFact(text) {
  if (!FIXED_COUNT.test(text) || OBSERVATION_VERB.test(text) || CURRENT_MARKER.test(text)) return false;
  if (!DEFINITIONAL_END.test(text) && !(COPULA_END.test(text) && DEFINITIONAL_WORD.test(text))) return false;
  return !hasCurrentNumericContent(text.replace(new RegExp(FIXED_COUNT_SOURCE, 'g'), ' '));
}
var CITED_URL = /(?:https?:\/\/|www\.)\S+/gi;
// 'current' | 'dated-past' | 'fixed-fact' | 'conditional' | 'none', checked in that order after the numeric test.
export function numericClaimKind(sentence, { today } = {}) {
  // P1681: a date or number inside a cited URL path ("…/2026/10/12/fed-…") is not a current claim of the sentence.
  var bare = String(sentence || '').replace(CITED_URL, ' ');
  if (!hasCurrentNumericContent(bare)) return 'none';
  var text = normaliseForDetection(bare);
  var nowMs = todayMs(today);
  if (isDatedPast(text, nowMs)) return 'dated-past';
  if (isFixedFact(text)) return 'fixed-fact';
  if (isConditionalNumericSentence(bare)) return 'conditional';
  return 'current';
}

function countSentences(value) {
  return String(value || '').split('\n').reduce(function(total, line) {
    if (!line.trim() || /^\s*\|[\s\-:|]+\|\s*$/.test(line)) return total;
    return total + (/^\s*\|.*\|\s*$/.test(line) ? 1 : splitAnswerSentences(line).length);
  }, 0);
}

// Supported numbers: the numeric values of the publishable evidence rows the model was given, each with its unit.
// Search results reach this module only as document rows without a numeric value, so they add nothing here.
var ROW_UNITS = { USD: 'USD', KRW: 'KRW', PERCENT: 'percent', '%': 'percent', PCT: 'percent', PP: 'pp', '%P': 'pp', BP: 'bp', BPS: 'bp', X: 'multiple', MULTIPLE: 'multiple', '배': 'multiple', INDEX: 'point', POINT: 'point', POINTS: 'point', PT: 'point' };
// With the question's entities, a row's figure belongs to the entity its ticker/entity field names when that is one of
// them; a row about anything else (an index, a rate) supports every subject.
export function supportedNumbersFromEvidence(rows, nowMs = Date.now(), { entities } = {}) {
  var ids = entityIds(entities);
  var numbers = (Array.isArray(rows) ? rows : []).filter(function(row) {
    return evidenceCanPublish(row, nowMs) && typeof row.value === 'number' && isFinite(row.value) && String(row.scale || 'raw') === 'raw';
  }).map(function(row) {
    var number = { value: row.value, unit: ROW_UNITS[String(row.unit || '').trim().toUpperCase()] || '' };
    // What the row says about its figure (see readWrittenFigures): its metric, basis, direction and day.
    var metricText = String(row.metric || row.metricId || '');
    var metric = figureMetric(metricText + ' ' + String(row.label || ''), number.unit);
    if (metric) number.metric = metric;
    var status = String(row.status || row.truthStatus || '').toLowerCase();
    var basis = row.source === 'close-basis' || /^close\b/i.test(metricText) ? 'close' : status === 'live' ? 'intraday' : null;
    if (basis) number.basis = basis;
    if (CHANGE_METRIC.test(metricText)) number.moves = true;
    var day = dayOf(row.asOf || row.observedAt);
    if (day) number.dates = [day];
    if (ids) {
      var own = String(row.entity || row.entityId || row.ticker || row.symbol || '').trim().toUpperCase();
      number.entity = ids.indexOf(own) >= 0 ? own : null;
    }
    return number;
  });
  return numbers.length ? numbers : null;
}

// The subjects of a question: [{ id, names: [...] }] (a ticker and its registry names). A Latin name matches as a whole
// word (one of three letters or fewer only in capitals, so "ON" or "ALL" is not read in English prose); a Hangul name
// matches inside a word ("엔비디아는"). Longer names are matched first and blanked, so a short name inside a longer one
// does not count twice.
// The subjects as { id, names }: a bare ticker takes its names from the ticker registry entries ({ en, kr, alt }), leaving
// out a name that is itself another registry ticker ('ms' on MSFT is Morgan Stanley's symbol).
export function answerEntities(list, entries) {
  var registry = entries && typeof entries === 'object' ? entries : {};
  return (Array.isArray(list) ? list : []).map(function(item) {
    if (item && typeof item === 'object') return item;
    var id = String(item || '').trim().toUpperCase();
    var entry = registry[id] || {};
    return { id: id, names: [entry.en, entry.kr].concat(Array.isArray(entry.alt) ? entry.alt : []).filter(function(name) {
      var upper = String(name || '').toUpperCase();
      return !!name && (upper === id || !registry[upper]);
    }) };
  }).filter(function(entity) { return !!String(entity.id || '').trim(); });
}
function entityIds(entities) {
  if (!Array.isArray(entities)) return null;
  var ids = answerEntities(entities).map(function(entity) { return String(entity.id).trim().toUpperCase(); });
  return ids.length ? ids : null;
}
function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function entityMatchers(entities) {
  if (!entityIds(entities)) return null;
  var matchers = [];
  answerEntities(entities).forEach(function(entity) {
    var id = String(entity && entity.id || '').trim().toUpperCase();
    if (!id) return;
    var names = [id].concat(Array.isArray(entity.names) ? entity.names : []);
    Array.from(new Set(names.map(function(name) { return String(name || '').normalize('NFKC').trim(); }))).forEach(function(name) {
      if (name.length < 2 || /^_/.test(name)) return;
      var pattern;
      if (/[가-힣]/.test(name)) pattern = new RegExp('()(' + escapeRegExp(name) + ')', 'g');
      else if (name.length <= 3) pattern = new RegExp('(^|[^A-Za-z0-9])(' + escapeRegExp(name.toUpperCase()) + ')(?=$|[^A-Za-z0-9])', 'g');
      else pattern = new RegExp('(^|[^A-Za-z0-9])(' + escapeRegExp(name) + ')(?=$|[^A-Za-z0-9])', 'gi');
      matchers.push({ id: id, length: name.length, pattern: pattern });
    });
  });
  return matchers.sort(function(a, b) { return b.length - a.length; });
}
function namedEntities(text, matchers) {
  var found = [];
  var rest = normaliseForDetection(text);
  matchers.forEach(function(matcher) {
    matcher.pattern.lastIndex = 0;
    if (!matcher.pattern.test(rest)) return;
    if (found.indexOf(matcher.id) < 0) found.push(matcher.id);
    matcher.pattern.lastIndex = 0;
    rest = rest.replace(matcher.pattern, function(all, before, name) { return before + ' '.repeat(name.length); });
  });
  return found;
}
function soleEntity(text, matchers) {
  var found = namedEntities(text, matchers);
  return found.length === 1 ? found[0] : null;
}

// The reference text cut into pieces that each belong to one subject or to none (null):
// - a quarantined data block ("item[0] … data=\"…\"") is read as the text it quotes, and its pieces never run past it;
// - a section opens at a line starting with a run of ━ and runs to the next one; when its first lines name exactly one
//   subject, the whole section (blank lines included) is that subject's;
// - outside such a section, a top-level "• X …" bullet naming exactly one subject opens a section that runs to the next
//   such bullet, a ━ line or a blank line;
// - anything else is cut at blank lines: a block naming exactly one subject is that subject's, otherwise each line
//   naming exactly one subject is its, and the rest belongs to none.
var QUARANTINED_ITEM = /^item\[\d+\][^\n]*? data=("(?:\\.|[^"\\])*")[ \t]*$/gm;
var SECTION_RULE = /^\s*━{2,}/;
var SECTION_HEAD_LINES = 3;
// Material that declares itself reference-only (the knowledge block, src/ai/retrieval/knowledge.js: "currentClaimsAllowed
// =false", educational definitions and worked examples) supports no current figure: a quoted item or a paragraph that
// carries the marker is left out of the supporting figures.
var REFERENCE_ONLY = /currentClaimsAllowed\s*=\s*false/;
function currentMaterial(text) {
  return REFERENCE_ONLY.test(text) ? text.split(/\n[ \t]*\n/).filter(function(part) { return !REFERENCE_ONLY.test(part); }).join('\n\n') : text;
}
function referenceRegions(text) {
  var regions = [];
  var start = 0;
  var match;
  QUARANTINED_ITEM.lastIndex = 0;
  while ((match = QUARANTINED_ITEM.exec(text))) {
    var decoded = null;
    try { decoded = JSON.parse(match[1]); } catch (_) { decoded = null; }
    if (typeof decoded !== 'string') continue;
    regions.push(currentMaterial(text.slice(start, match.index)));
    regions.push(REFERENCE_ONLY.test(decoded) ? '' : decoded);
    start = match.index + match[0].length;
  }
  regions.push(currentMaterial(text.slice(start)));
  return regions;
}
function blockPieces(lines, matchers, pieces) {
  var blocks = [[]];
  lines.forEach(function(line) {
    if (!line.trim()) { if (blocks[blocks.length - 1].length) blocks.push([]); return; }
    blocks[blocks.length - 1].push(line);
  });
  blocks.forEach(function(block) {
    if (!block.length) return;
    var owner = soleEntity(block.join('\n'), matchers);
    if (owner) { pieces.push({ text: block.join('\n'), entity: owner }); return; }
    block.forEach(function(line) { pieces.push({ text: line, entity: soleEntity(line, matchers) }); });
  });
}
function referencePieces(text, matchers) {
  var pieces = [];
  referenceRegions(String(text || '')).forEach(function(region) {
    var sections = [{ kind: null, lines: [] }];
    region.split('\n').forEach(function(line) {
      var current = sections[sections.length - 1];
      var bulletOwner = current.kind !== 'rule' && /^•/.test(line) ? soleEntity(line, matchers) : null;
      if (SECTION_RULE.test(line)) sections.push({ kind: 'rule', lines: [line] });
      else if (bulletOwner) sections.push({ kind: 'bullet', entity: bulletOwner, lines: [line] });
      else if (current.kind === 'bullet' && !line.trim()) sections.push({ kind: null, lines: [line] });
      else current.lines.push(line);
    });
    sections.forEach(function(section) {
      var owner = section.kind === 'bullet' ? section.entity
        : section.kind === 'rule' ? soleEntity(section.lines.filter(function(line) { return line.replace(/━/g, '').trim(); }).slice(0, SECTION_HEAD_LINES).join('\n'), matchers)
        : null;
      if (!owner) { blockPieces(section.lines, matchers, pieces); return; }
      // Inside a subject's section a line that names exactly one other subject carries that subject's figures: text
      // appended after the last section (a tool result about another company) must not inherit the section's owner.
      var own = [];
      section.lines.forEach(function(line) {
        var named = soleEntity(line, matchers);
        if (named && named !== owner) pieces.push({ text: line, entity: named });
        else own.push(line);
      });
      pieces.push({ text: own.join('\n'), entity: owner });
    });
  });
  return pieces;
}
// What is not a figure of the sentence: a link, a date or clock time, a window length that names a measure ("20거래일",
// "52주", "10년물", "3개월"; "3거래일 연속" is a count and stays), an index name ("S&P 500", "나스닥 100"), a code
// with digits ("US10Y", "H100", "2s10s"), an indicator's parameters ("RSI(14)", "MACD(12,26,9)") and a month/day
// ("11/12 종가").
var NOT_A_FIGURE = /(?:https?:\/\/|www\.)\S+|(?<=\b[A-Za-z]{2,}\s?)\(\s*\d{1,3}(?:\s*,\s*\d{1,3})*\s*\)|(?<![\d/.,])(?:1[0-2]|0?[1-9])\/(?:3[01]|[12]\d|0?[1-9])(?![\d/.,])|(?<!\d)(?:19|20)\d{2}\s*(?:[-./]|년)\s*\d{1,2}(?:\s*(?:[-./]|월)\s*\d{1,2}\s*일?)?(?!\d)|(?<!\d)\d{1,2}\s*월\s*\d{1,2}\s*일|(?<!\d)(?:19|20)\d{2}\s*년(?:대)?|(?<!\d)\d{1,2}:\d{2}(?!\d)|(?:S&P|나스닥|러셀|코스피|코스닥|\b(?:Nasdaq|NASDAQ|Russell|KOSPI|KOSDAQ)\b)\s*(?:500|100|2000|200|150)(?![\d,.])|(?<![\d.,])\d+\s*(?:개월|개년|년물|년간|년|분기|주(?![가식당요])|거래일|일선|일(?![부반정본간]))(?!\s*(?:연속|째|만에))|(?<![A-Za-z])(?!\b(?:USD|KRW|US)\d)[A-Za-z]+\d[\dA-Za-z]*|\d+s\d+s|\d+-\b(?:year|month|week|day)\b/g;
var WRITTEN_FIGURE = /(\$|₩|\b(?:USD|KRW|US\$)\s*)?([+\-−]?)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?<![A-Za-z])(%p(?![A-Za-z])|(?:%|퍼센트)\s*포인트|%|퍼센트|percent\b|bps?\b|배|달러|dollars?\b|USD\b|원|KRW\b|포인트|pt\b|조|억|만|개|곳|건|명|종목|(?<=\d)x(?![A-Za-z0-9]))?/gi;
// "41.2x" (an x glued to the digits) is a multiple, as "41.2배" is. "0.5%p" is a difference in percentage points, not a
// 0.5% level, so a percent row does not support it.
var WRITTEN_UNITS = [[/^(?:%p|(?:%|퍼센트)\s*포인트)$/i, 'pp'], [/^(?:%|퍼센트|percent)$/i, 'percent'], [/^bps?$/i, 'bp'], [/^(?:배|x)$/i, 'multiple'], [/^(?:\$|달러|dollars?|USD|US\$)$/i, 'USD'], [/^(?:₩|원|KRW)$/i, 'KRW'], [/^(?:포인트|pt)$/i, 'point']];
function writtenUnit(word) {
  if (!word) return '';
  var hit = WRITTEN_UNITS.filter(function(pair) { return pair[0].test(word); })[0];
  return hit ? hit[1] : 'unsupported';
}

// What a figure is about, read from the words beside it, on both sides of the check (the material the model was given
// and the answer): the metric named closest before it, the price basis (a close or an intraday quote), the direction
// its sentence gives it, and the dates of its material line. A written figure and a supporting one must agree on every
// part both name; a part only one side names does not decide, so grounded prose that leaves a word out is kept.
// The external audit of 2026-11-14 found one boundary in four shapes: a close certifying an "intraday" claim, an RSI
// moved to the other column of a table, a falling figure written as a rise, and a figure from an educational example
// reading as a current one. Each is a figure matched on its value alone.
var METRIC_WORDS = [['ev_ebitda', /EV\s*\/\s*EBITDA/gi], ['peg', /\bPEG\b/gi], ['per', /\bPER\b|\bP\/E\b|주가\s*수익\s*비율/gi],
  ['pbr', /\bPBR\b|\bP\/B\b/gi], ['psr', /\bPSR\b|\bP\/S\b/gi], ['roe', /\bROE\b/gi], ['rsi', /\bRSI\b/gi],
  ['target', /목표\s*주?가|\btarget\b/gi], ['price', /주가|종가|현재가|가격|시세|\bprice\b|\bclose\b/gi]];
// A price word names a metric only for a money figure: "주가 추이 · 5거래일 -8.5%" is a change, not a price.
var MONEY_METRICS = { target: true, price: true };
function lastWord(pairs, text) {
  var best = null, bestEnd = -1;
  pairs.forEach(function(pair) {
    pair[1].lastIndex = 0;
    var match;
    while ((match = pair[1].exec(text))) { if (match.index + match[0].length > bestEnd) { bestEnd = match.index + match[0].length; best = pair[0]; } }
  });
  return best;
}
function firstWord(pairs, text) {
  var best = null, bestAt = Infinity;
  pairs.forEach(function(pair) {
    pair[1].lastIndex = 0;
    var match = pair[1].exec(text);
    if (match && match.index < bestAt) { bestAt = match.index; best = pair[0]; }
  });
  return best;
}
export function figureMetric(context, unit) {
  var metric = lastWord(METRIC_WORDS, String(context || ''));
  return metric && MONEY_METRICS[metric] && unit !== 'USD' && unit !== 'KRW' ? null : metric;
}
var BASIS_WORDS = [['intraday', /장중|실시간|현재가|intraday|real[- ]?time|\blive\b/gi], ['close', /종가|마감|\bclosed?\b/gi]];
var DIRECTION_WORDS = [[1, /올랐|오른|올라|오르|상승|급등|반등|뛰었|뛴|높아|높습|높은|늘었|늘어|증가|웃돌|\b(?:up|rose|gained|higher)\b/gi],
  [-1, /내렸|내린|내려|내리|하락|급락|떨어|밀렸|빠졌|빠진|낮아|낮습|낮은|줄었|줄어|감소|밑돌|\b(?:down|fell|dropped|lower)\b/gi]];
// A typed row whose metric is a change ("change.pct") carries a direction; a level ("price", "close.us10y") does not.
var CHANGE_METRIC = /change|return|(?<![A-Za-z])(?:chg|delta|diff|gap)(?![A-Za-z])/i;
// The days a material line names: "2026-11-12", "2026년 11월 12일", and a month/day without a year ("11/12", "11월 12일").
function lineDates(line) {
  var days = [];
  var add = function(year, month, day) { days.push((year ? year : '-') + '-' + String(month).padStart(2, '0') + '-' + String(day).padStart(2, '0')); };
  var match;
  var iso = /(?<!\d)((?:19|20)\d{2})-(\d{2})-(\d{2})(?!\d)/g;
  while ((match = iso.exec(line))) add(match[1], match[2], match[3]);
  var korean = /(?:(?<!\d)((?:19|20)\d{2})\s*년\s*)?(?<!\d)(\d{1,2})\s*월\s*(\d{1,2})\s*일/g;
  while ((match = korean.exec(line))) add(match[1], match[2], match[3]);
  var short = /(?<![\d/.,])(1[0-2]|0?[1-9])\/(3[01]|[12]\d|0?[1-9])(?![\d/.,])/g;
  while ((match = short.exec(line))) add(null, match[1], match[2]);
  return Array.from(new Set(days));
}
function dayOf(value) {
  var text = String(value || '').trim();
  var day = stampDay(text);
  if (day) return day;
  var ms = Date.parse(text);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}
// A supporting figure against what the written one says about itself (`want`: subject, metric, basis, direction, day).
function contextAgrees(number, want) {
  if (!want) return true;
  if (want.subject && number.entity && number.entity !== want.subject) return false;
  if (want.metric && number.metric && number.metric !== want.metric) return false;
  if (want.basis && number.basis && number.basis !== want.basis) return false;
  if (want.direction && number.moves === true && number.value !== 0 && want.direction !== Math.sign(number.value)) return false;
  if (want.day && Array.isArray(number.dates) && number.dates.length && !number.dates.some(function(day) {
    return day === want.day || (day.charAt(0) === '-' && day.slice(1) === want.day.slice(4));
  })) return false;
  return true;
}
// The written figures of a text, each with what its own words say about it. `frame` adds what a table row and column
// say (subject, and a label text read for the metric and the basis when the cell itself names neither).
function readWrittenFigures(text, frame) {
  frame = frame || {};
  var bare = normaliseForDetection(text).replace(NOT_A_FIGURE, ' ');
  var matches = Array.from(bare.matchAll(WRITTEN_FIGURE));
  return matches.map(function(match, index) {
    var unit = writtenUnit(match[4] || String(match[1] || '').trim());
    var before = bare.slice(index ? matches[index - 1].index + matches[index - 1][0].length : 0, match.index);
    var after = bare.slice(match.index + match[0].length, index + 1 < matches.length ? matches[index + 1].index : bare.length);
    return { match: match, want: {
      subject: frame.subject || null,
      metric: figureMetric(before, unit) || (frame.label ? figureMetric(frame.label, unit) : null),
      basis: lastWord(BASIS_WORDS, bare.slice(0, match.index)) || (frame.label ? lastWord(BASIS_WORDS, frame.label) : null),
      direction: firstWord(DIRECTION_WORDS, after)
    } };
  });
}
// True when the text writes at least one figure and every figure equals a supported number in a printed form
// (180.25 → "180.25", "180.3", "180"), with the sign it writes and a unit that agrees. An integer under 100 must be
// written with a unit that agrees with its row's unit: a bare "5" is not supported by every row. A count or a
// 조/억/만 magnitude is never supported this way.
// The same for the reference material the model was given as text (the injected data blocks of the prompt): every
// figure written there, with its sign and unit. A figure the answer repeats from that material is supported; one that
// appears nowhere in it is not. Capped so a very long prompt cannot make each sentence check slow.
var REFERENCE_FIGURE_LIMIT = 6000;
// The part of a system prompt that is reference material: everything before the instruction tail, without the blocks
// that quote another day's conversation (their figures were true then, not now).
var REFERENCE_TAIL = '\n\n[AIO EXTERNAL EVIDENCE CONTRACT]';
var OTHER_DAY_BLOCK = /\n\n【(?:이전 대화에서|사용자가 알려준 것)】[\s\S]*?(?=\n\n[【\[]|$)/g;
export function answerReferenceText(systemPrompt) {
  var text = String(systemPrompt || '');
  var tailAt = text.lastIndexOf(REFERENCE_TAIL);
  return (tailAt >= 0 ? text.slice(0, tailAt) : text).replace(OTHER_DAY_BLOCK, '');
}
// With `entities`, each figure also carries the subject it was given for (`entity`: an id, or null for material about no
// single subject: macro lines, rows naming several tickers, generic data). Without them the rows are as before.
export function supportedNumbersFromText(text, { entities } = {}) {
  var matchers = entityMatchers(entities);
  var pieces = matchers ? referencePieces(text, matchers) : referenceRegions(String(text || '')).map(function(region) { return { text: region, entity: undefined }; });
  var numbers = [];
  var seen = new Set();
  // Each figure also carries what its line says about it (readWrittenFigures): the metric named before it, its basis
  // (a basis word before it, else the first one after it on the line: "166.19달러 (2026-11-12 종가)") and the line's days.
  for (var piece of pieces) {
    for (var line of normaliseForDetection(piece.text).split('\n')) {
      var bare = line.replace(NOT_A_FIGURE, ' ');
      var dates = lineDates(line);
      var matches = Array.from(bare.matchAll(WRITTEN_FIGURE));
      for (var index = 0; index < matches.length; index += 1) {
        var match = matches[index];
        var unit = writtenUnit(match[4] || String(match[1] || '').trim());
        if (unit === 'unsupported') continue;
        var size = Number(match[3].replace(/,/g, ''));
        if (!isFinite(size)) continue;
        var value = /^[-−]$/.test(match[2]) ? -size : size;
        var metric = figureMetric(bare.slice(index ? matches[index - 1].index + matches[index - 1][0].length : 0, match.index), unit);
        var basis = lastWord(BASIS_WORDS, bare.slice(0, match.index)) || firstWord(BASIS_WORDS, bare.slice(match.index + match[0].length));
        var key = [value, unit, matchers ? piece.entity : '', metric, basis, dates.join(',')].join('|');
        if (seen.has(key)) continue;
        seen.add(key);
        var number = { value: value, unit: unit, signed: match[2] !== '' };
        if (match[2] !== '') number.moves = true;
        if (metric) number.metric = metric;
        if (basis) number.basis = basis;
        if (dates.length) number.dates = dates;
        if (matchers) number.entity = piece.entity;
        numbers.push(number);
        if (numbers.length >= REFERENCE_FIGURE_LIMIT) break;
      }
      if (numbers.length >= REFERENCE_FIGURE_LIMIT) break;
    }
    if (numbers.length >= REFERENCE_FIGURE_LIMIT) break;
  }
  return numbers.length ? numbers : null;
}
function supportedNumbers(rows, referenceText, nowMs, entities) {
  var all = (supportedNumbersFromEvidence(rows, nowMs, { entities: entities }) || []).concat(supportedNumbersFromText(referenceText, { entities: entities }) || []);
  return all.length ? all : null;
}
// One written figure against the supported numbers; `want` (readWrittenFigures) limits them to the figures that agree
// with what the answer's words say about it: its subject (or a subject-free figure), metric, basis and direction.
function figureSupported(match, numbers, want) {
  var unit = writtenUnit(match[4] || String(match[1] || '').trim());
  if (unit === 'unsupported') return false;
  var digits = match[3].replace(/,/g, '');
  var places = (digits.split('.')[1] || '').length;
  var written = Number(digits);
  if (/^\d$/.test(digits) && !unit) return false; // a bare single digit is supported by nothing
  // A bare two-digit integer ("RSI 58") is supported only by a figure the material also wrote without a unit.
  var bareSmall = /^\d{2}$/.test(digits) && !unit;
  var sign = match[2] === '' ? 0 : match[2] === '+' ? 1 : -1;
  return numbers.some(function(number) {
    if (!contextAgrees(number, want)) return false;
    if (bareSmall && number.unit !== '') return false;
    if (unit && number.unit !== unit) return false;
    // A figure the material wrote without a sign ("1.2% 하락") carries its direction in words, so it supports either sign.
    if (sign && number.value !== 0 && number.signed !== false && sign !== Math.sign(number.value)) return false;
    var size = Math.abs(number.value);
    return written === size || ((String(size).split('.')[1] || '').length > places && Number(size.toFixed(places)) === written);
  });
}
// A typed claim's value against the supported numbers: the same subject (or a subject-free figure), the metric and the
// basis its metric and text name, a figure of the claim's day when the material dates the line, an agreeing unit when
// the claim's unit is one the material writes, the claim's sign, and the value as written or rounded.
function claimInReference(claim, numbers, entities) {
  if (!Array.isArray(numbers) || !numbers.length || typeof claim.value !== 'number' || !isFinite(claim.value)) return false;
  var matchers = entityMatchers(entities);
  var subject = matchers && claim.entity ? soleEntity(String(claim.entity), matchers) : null;
  var unitWord = String(claim.unit || '').trim();
  var unit = ROW_UNITS[unitWord.toUpperCase()] || writtenUnit(unitWord);
  if (unit === 'unsupported') unit = '';
  var places = (String(Math.abs(claim.value)).split('.')[1] || '').length;
  var size = Math.abs(claim.value);
  var words = normaliseForDetection(String(claim.metric || '') + ' ' + String(claim.text || ''));
  var want = { subject: subject, metric: figureMetric(claim.metric, unit) || figureMetric(words, unit), basis: lastWord(BASIS_WORDS, words), day: dayOf(claim.asOf) };
  return numbers.some(function(number) {
    if (!contextAgrees(number, want)) return false;
    if (unit ? number.unit !== unit : number.unit !== '') return false;
    if (claim.value !== 0 && number.signed !== false && number.value !== 0 && Math.sign(claim.value) !== Math.sign(number.value)) return false;
    var given = Math.abs(number.value);
    return given === size || ((String(given).split('.')[1] || '').length > places && Number(given.toFixed(places)) === size);
  });
}
function writtenFigures(text) {
  return Array.from(normaliseForDetection(text).replace(NOT_A_FIGURE, ' ').matchAll(WRITTEN_FIGURE));
}
// A comparison sentence is checked clause by clause: a comma that is not a thousands separator, "；", "반면", "이고",
// "이며", "but", "while".
var CLAUSE_BREAK = /(?<!\d),|,(?!\d)|[;；]|반면|이고|이며|\bbut\b|\bwhile\b/i;
// With `entities`, a sentence (or a clause of a sentence naming several) that names exactly one subject is supported
// only by that subject's figures and the subject-free ones. `frame` is a table cell's row and column: its subject and
// the label text whose metric and basis the cell's figures take when the cell names none (see stripNumericSentences).
export function figuresSupported(text, numbers, { entities, frame } = {}) {
  if (!Array.isArray(numbers) || !numbers.length) return false;
  var matchers = entityMatchers(entities);
  var named = matchers ? namedEntities(text, matchers) : [];
  var parts = frame ? [{ text: String(text || ''), frame: frame }]
    : named.length > 1 ? String(text || '').split(CLAUSE_BREAK).map(function(clause) { return { text: clause, frame: { subject: soleEntity(clause, matchers) } }; })
    : [{ text: String(text || ''), frame: { subject: named.length === 1 ? named[0] : null } }];
  var total = 0;
  var supported = parts.every(function(part) {
    var figures = readWrittenFigures(part.text, part.frame);
    total += figures.length;
    return figures.every(function(figure) { return figureSupported(figure.match, numbers, figure.want); });
  });
  return total > 0 && supported;
}

// A claim's own text must not write a figure other than its value: "NVDA 오늘 장중 가격 999달러" with value 166.19 is
// not a label of that value. Counts and the entity's own code are not figures of the value; 조/억/만 scale the number.
var LABEL_MAGNITUDE = { '조': 1e12, '억': 1e8, '만': 1e4 };
function claimLabelAgrees(claim) {
  if (typeof claim.value !== 'number' || !isFinite(claim.value)) return true;
  var size = Math.abs(claim.value);
  var code = String(claim.entity || '').match(/^\d{6}/);
  var text = code ? String(claim.text || '').split(code[0]).join(' ') : String(claim.text || '');
  return writtenFigures(text).every(function(match) {
    if (/^(?:개|곳|건|명|종목)$/.test(match[4] || '')) return true;
    var digits = match[3].replace(/,/g, '');
    var written = Number(digits);
    var scale = LABEL_MAGNITUDE[match[4]];
    if (scale) return Math.abs(written * scale - size) <= size * 0.005;
    var places = (digits.split('.')[1] || '').length;
    return written === size || Number(size.toFixed(places)) === written;
  });
}

const APP_TOOL_SOURCE = /(?:앱|AIO)\s*(?:의\s*)?자료\s*도구/i;
const TREND_BASIS = /주가\s*(?:추이|흐름)|(?:최근\s*)?\d+\s*거래일\s*(?:주가\s*)?(?:추이|흐름)/;
const BARE_CITATION_HOST = /^\((?:[a-z0-9-]+\.)+[a-z]{2,}\)[.!?。]*$/i;
const APP_TREND_CREDIT = 'AIO 앱의 주가 추이 자료';

// A date-only app trend claim uses the successful tool's subject and basis. Unrelated historical dates and web dates
// retain their normal path. A search citation is not a source for the result of the app call.
function bindAppTrendBasis(sentence, bare, toolBasis, matchers) {
  if (!Array.isArray(toolBasis) || !APP_TOOL_SOURCE.test(bare) || !TREND_BASIS.test(bare)
      || !/기준일|종가\s*기준/.test(bare) || !lineDates(bare).length || writtenFigures(bare).length) return null;
  const entity = matchers && soleEntity(bare, matchers);
  const dates = new Set(toolBasis.filter((row) => entity && row?.name === 'trend'
    && row.entities?.includes(entity) && /^\d{4}-\d{2}-\d{2} 종가$/.test(row.asOf)).map((row) => row.asOf));
  const prefix = sentence.match(/^(?:[-*+]\s+|\d+[.)]\s+)/)?.[0] || '';
  if (dates.size !== 1) return { text: `${prefix}해당 주가 추이의 기준일은 앱 자료에서 확인하지 못했습니다.`, date: null };
  const [date] = dates;
  return { text: `${prefix}${entity} 주가 추이 기준일은 ${date}입니다. 출처는 ${APP_TREND_CREDIT}입니다.`, date };
}

function stripNumericSentences(value, today, numbers, entities, searchUrls, toolBasis) {
  var removed = 0;
  var searched = 0;
  var toolDates = 0;
  var matchers = entityMatchers(entities);
  var toolMatchers = Array.isArray(toolBasis)
    ? entityMatchers((entities || []).concat(toolBasis.flatMap((row) => row?.entities || [])))
    : null;
  var header = null;
  var text = String(value || '').split('\n').map(function(line) {
    if (!line.trim()) { header = null; return ''; }
    // P1740: a markdown table keeps its rows; only an unverified current-number cell becomes "확인 필요". Dropping the
    // whole row left a header with no body. A cell whose every figure is a supported number keeps its value.
    // A cell is checked as its row and column read it: the subject its column header (or its row label) names, and the
    // metric and basis of its row label (or its column header). "| RSI | 58 | 26 |" under "| 기준 | NVDA | AMD |" needs
    // NVDA's RSI 58, not any 58 in the material.
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (/^\s*\|[\s\-:|]+\|\s*$/.test(line)) return line;
      var cells = line.split('|');
      var head = header;
      if (!head) header = cells.map(function(cell) { return cell.trim(); });
      const basis = bindAppTrendBasis(line, line.replace(CITED_URL, ' '), toolBasis, toolMatchers);
      if (basis) {
        if (basis.date) toolDates += 1;
        return cells.map((cell) => {
          const bare = cell.replace(CITED_URL, ' ');
          const hasDate = lineDates(bare).length > 0;
          const hasSource = APP_TOOL_SOURCE.test(bare) || bare !== cell || BARE_CITATION_HOST.test(bare.trim());
          if (hasDate && hasSource) return ` ${basis.text} `;
          if (hasDate) return ` ${basis.date || '기준일 확인 불가'} `;
          if (hasSource) return ` ${basis.date ? APP_TREND_CREDIT : '앱 자료 확인 불가'} `;
          return cell;
        }).join('|');
      }
      var label = String(cells[1] || '').trim();
      return cells.map(function(cell, index) {
        if (index === 0 || index === cells.length - 1) return cell;
        var column = head ? String(head[index] || '') : '';
        var frame = index === 1 ? { subject: matchers ? soleEntity(label, matchers) : null }
          : { subject: matchers ? soleEntity(column, matchers) || soleEntity(label, matchers) : null, label: [column, label].join(' ') };
        return (hasCurrentNumericContent(cell) || /^\s*[+\-−]?\d[\d,.]*\s*$/.test(cell)) && !figuresSupported(cell, numbers, { entities: entities, frame: frame }) ? ' 확인 필요 ' : cell;
      }).join('|');
    }
    header = null;
    var appBasisBefore = false;
    let boundAttribution = -1;
    var kept = answerSentences(line).flatMap(function(sentence, index, sentences) {
      if (index === boundAttribution) return [];
      if (appBasisBefore && BARE_CITATION_HOST.test(sentence)) return [];
      appBasisBefore = false;
      // A current sentence stays when every figure it writes is in the evidence; one figure that is not removes it.
      var bare = sentence.replace(CITED_URL, ' ');
      let basis = bindAppTrendBasis(sentence, bare, toolBasis, toolMatchers);
      const next = sentences[index + 1];
      if (!basis && next?.search(APP_TOOL_SOURCE) === 0) {
        basis = bindAppTrendBasis(sentence, `${bare} ${next.replace(CITED_URL, ' ')}`, toolBasis, toolMatchers);
        if (basis) boundAttribution = index + 1;
      }
      if (basis) {
        appBasisBefore = true;
        if (basis.date) toolDates += 1;
        return [basis.text];
      }
      // With reference material in hand, a sentence whose only numbers are dates or window lengths ("11월 12일 종가
      // 기준 자료입니다") states no figure to check and stays.
      var nothingToCheck = Array.isArray(numbers) && numbers.length > 0 && writtenFigures(bare).length === 0;
      var current = numericClaimKind(sentence, { today: today }) === 'current' && !nothingToCheck && !figuresSupported(bare, numbers, { entities: entities });
      if (current && searchedSentenceKept(sentence, searchUrls, numbers, entities)) { searched += 1; return [sentence]; }
      if (current) removed += 1;
      return current ? [] : [sentence];
    }).join(' ');
    return kept || null;
  }).filter(function(line) { return line !== null; }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text: text, removed: removed, searched: searched, toolDates: toolDates };
}

export function stripUnverifiedCurrentNumericSentences(value, { today } = {}) {
  return stripNumericSentences(value, today).text;
}

// v57.92 (internal audit A03): the numeric checks never saw a current event without a number — "연준이 금리를 인하했고 신용
// 스트레스도 해소됐다" stayed in an answer plan bound to no evidence at all. With zero publishable evidence, a sentence that
// reports a completed market event is dropped; a dated history ("2020년 3월"), a general pattern ("과거에는", "보통") and
// a condition stay, so general explanation is untouched.
var CURRENT_EVENT = /(?:인하|인상|동결|발표|해소|급등|급락|상승|하락|반등|폭락|폭등|돌파|붕괴|경신|확대|축소|완화|악화|개선|둔화|가속|진정|전환)(?:했|됐|되었|하였|되면서|하면서)|(?:올랐|내렸|떨어졌|뛰었|밀렸|꺾였|풀렸)/;
var GENERAL_OR_HISTORICAL = /(?:\b(?:19|20)\d{2}\s*년|역사적으로|과거에|과거\s|예전에|일반적으로|보통|대체로|흔히|전형적으로|사례|예를\s*들어|가령|historically|typically|in\s+general)/i;
// v58.77 (pipeline audit AI-01): one unrelated evidence row (an AAPL price) switched the rule off for every sentence, so
// "연준이 금리를 인하했고 신용 스트레스도 해소됐다" was published next to it. With evidence present, a current event sentence
// stays only when an evidence row names one of its subjects (a word of two or more letters, particles trimmed).
var EVENT_STOPWORDS = /^(?:시장|증시|오늘|현재|지금|이번|지난|최근|이후|이전|우리|투자|투자자|가격|흐름|상황|분위기|기대|우려|영향|가능성|정도|수준|부분|전체|모두|함께|다시|계속|크게|소폭|일부|the|and|for|with|market|markets|today|now)$/i;
var PARTICLE_TAIL = /(?:으로|에서|에게|까지|부터|이라|라는|이며|하고|이고|으며|이나|은|는|이|가|을|를|의|도|로|에|와|과|고|만|며)$/;
function eventSubjects(sentence) {
  return (String(sentence || '').match(/[가-힣]{2,}|[A-Za-z][A-Za-z0-9&.]{1,}/g) || [])
    .map(function(word) { return /[가-힣]/.test(word) && word.length > 2 ? word.replace(PARTICLE_TAIL, '') : word; })
    .filter(function(word) { return word.length >= 2 && !EVENT_STOPWORDS.test(word) && !CURRENT_EVENT.test(word); });
}
export function eventBoundToEvidence(sentence, rows) {
  var subjects = eventSubjects(sentence).map(function(word) { return word.toLowerCase(); });
  if (!subjects.length) return false;
  return (Array.isArray(rows) ? rows : []).some(function(row) {
    var text = Object.keys(row || {}).map(function(key) { return typeof row[key] === 'string' ? row[key] : ''; }).join(' ').toLowerCase();
    return subjects.some(function(word) { return text.indexOf(word) >= 0; });
  });
}
// A dated or completed past ("지난 10년간 약 100% 올랐습니다") and a fixed structure are history, not an unbound current event.
export function stripUnverifiedCurrentEventSentences(value, isBound, { today } = {}) {
  var dropped = 0;
  var nowMs = todayMs(today);
  var text = String(value || '').split('\n').map(function(line) {
    if (!line.trim() || /^\s*\|.*\|\s*$/.test(line)) return line;
    var kept = answerSentences(line).filter(function(sentence) {
      var bare = sentence.replace(CITED_URL, ' ');
      var normalised = normaliseForDetection(bare);
      var event = CURRENT_EVENT.test(bare) && !GENERAL_OR_HISTORICAL.test(bare) && !isConditionalNumericSentence(bare) && !CONDITIONAL_MARKER.test(bare.replace(NON_CONDITIONAL_MYEON, ' '))
        && !isDatedPast(normalised, nowMs) && !isFixedFact(normalised)
        && !(typeof isBound === 'function' && isBound(bare, sentence));
      if (event) dropped += 1;
      return !event;
    }).join(' ');
    return kept || null;
  }).filter(function(line) { return line !== null; }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text: text, dropped: dropped };
}
// v59.45 P11-AI-01: the same event rule, read as "would this text lose a sentence against these rows".
function currentEventSentenceUnbound(value, rows) {
  return stripUnverifiedCurrentEventSentences(value, function(sentence) { return eventBoundToEvidence(sentence, rows); }).dropped > 0;
}

// v58.63 (architecture audit SEC02): the fallback path (a plan that failed to parse) stripped only unverified numbers, so
// "연준이 금리를 인하했고 신용 스트레스도 해소됐다" was dropped from a structured plan but published from the same text when
// the plan block broke. With zero publishable evidence on a current-sensitive question, the fallback applies the same
// current-event rule as the plan path. `options.evidenceCount` omitted keeps the old two-argument behaviour.
// The result carries what the filters removed: { text, removedNumericSentences, removedEventSentences, sentencesTotal }.
function guardFallback(text, currentSensitive, options) {
  var result = { text: tidyInlineCitations(text), removedNumericSentences: 0, removedEventSentences: 0, searchedSentences: 0, toolDates: 0, sentencesTotal: countSentences(text) };
  if (!currentSensitive) return result;
  var today = options && options.today;
  var entities = options && Array.isArray(options.entities) ? answerEntities(options.entities, options.nameEntries) : null;
  var numbers = options && supportedNumbers(options.evidenceRows, options.referenceText, todayMs(today), entities);
  var searchUrls = citationUrlSet(options && options.searchCitations);
  var numeric = stripNumericSentences(result.text, today, numbers, entities, searchUrls, options?.toolBasis);
  result.text = numeric.text;
  result.removedNumericSentences = numeric.removed;
  result.searchedSentences = numeric.searched;
  result.toolDates = numeric.toolDates;
  var cited = function(bare, sentence) { return searchedSentenceKept(sentence, searchUrls, numbers, entities); };
  var events = null;
  if (options && options.evidenceCount === 0 && !numbers) events = stripUnverifiedCurrentEventSentences(numeric.text, searchUrls ? cited : null, { today: today });
  // v58.77 AI-01: with evidence rows handed in, an event sentence must name what one of them covers (same as the plan path).
  else if (options && (Array.isArray(options.evidenceRows) || numbers)) events = stripUnverifiedCurrentEventSentences(numeric.text, function(sentence, whole) { return eventBoundToEvidence(sentence, options.evidenceRows || []) || figuresSupported(sentence, numbers, { entities: entities }) || cited(sentence, whole); }, { today: today });
  if (events) { result.text = events.text; result.removedEventSentences = events.dropped; }
  return result;
}
export function extractAnswerFallback(rawText, currentSensitive, options) {
  return extractAnswerFallbackResult(rawText, currentSensitive, options).text;
}
export function extractAnswerFallbackResult(rawText, currentSensitive, options) {
  var raw = String(rawText || '');
  var hasControlBlock = /\[\/?AI_ANSWER_PLAN\]/i.test(raw);
  if (!hasControlBlock) return currentSensitive ? guardFallback(raw, true, options) : guardFallback(raw.trim(), false, options);
  var values = [];
  var fieldRe = /"\b(?:summary|body)\b"\s*:\s*("(?:\\.|[^"\\])*")/g;
  var match;
  while ((match = fieldRe.exec(raw)) && values.length < 8) {
    try {
      var decoded = JSON.parse(match[1]);
      if (decoded && values.indexOf(decoded) < 0) values.push(decoded);
    } catch (_) {}
  }
  var fallback = values.join('\n\n').trim();
  return guardFallback(fallback, currentSensitive, options);
}

// v57.48 review #19: an answer opened with up to five "※" notices, three of them in English ("decision-grade",
// "Web Research", "Evidence"). The reader now gets one Korean line naming what was not confirmed; each detailed
// notice moves to the folded answer-evidence panel. `publishedClaimCount` keeps the line truthful when some values
// were confirmed (close-basis or live) and only the rest was withheld.
const NUMERIC_DROP_REASONS = ['answer-plan-claim-degraded', 'current-numeric-claim-unverified', 'typed-claim-validation'];
const CURRENT_GAP_REASONS = ['market-session-evidence-unavailable', 'current-evidence-limited', 'research-evidence-unavailable', 'research-freshness-unverified'];
// The line is the one owner of what happened to the figures; the search status line under the panel says only whether a
// search ran and how many sources it cited. `search` ({ searchedSentences, removedNumericSentences }) is given when this
// answer's search cited sources: then the line never says "일반 설명만" — it says which figures are the searched ones.
var REMOVAL_REASONS = ['answer-plan-claim-degraded', 'typed-claim-validation'];
function searchedFiguresPhrase(list, search, numericDropped, currentGap) {
  var removed = Number(search.removedNumericSentences) > 0 || list.some(function(reason) { return REMOVAL_REASONS.indexOf(reason) >= 0; });
  if (Number(search.toolDates) > 0) return '주가 추이 기준일은 앱 자료, 웹검색 내용은 링크 원문 기준' + (removed ? ' · 확인되지 않은 일부 수치 제외' : '');
  if (Number(search.searchedSentences) > 0) return removed ? '웹검색 출처가 붙은 수치만 표시 — AIO가 확인한 값 아님' : '웹검색 출처의 수치 — AIO가 확인한 값 아님, 링크 원문 기준';
  if (removed) return '출처가 붙지 않은 최신 수치는 뺌 — 아래 참고 링크 원문 확인';
  return numericDropped || currentGap ? '최신 수치는 아래 참고 링크 원문 기준' : '';
}
export function summarizeAnswerLimitations(reasons = [], { publishedClaimCount = 0, search = null } = {}) {
  var list = Array.from(new Set(Array.isArray(reasons) ? reasons.map(String) : []));
  var phrases = [];
  var numericDropped = list.some(function(reason) { return NUMERIC_DROP_REASONS.indexOf(reason) >= 0; });
  var currentGap = list.some(function(reason) { return CURRENT_GAP_REASONS.indexOf(reason) >= 0; });
  var searchedLine = search ? searchedFiguresPhrase(list, search, numericDropped, currentGap) : '';
  if (search) { if (searchedLine) phrases.push(searchedLine); }
  else if (publishedClaimCount > 0 && (numericDropped || currentGap)) phrases.push(numericDropped ? '일부 최신 수치 확인 안 됨 — 확인된 값만 표시' : '표시한 값 외의 최신 수치는 확인 안 됨');
  else if (numericDropped || currentGap) phrases.push('최신 수치 확인 안 됨 — 일반 설명만');
  if (list.indexOf('suitability-context-missing') >= 0) phrases.push('투자 성향 정보 없음 — 조건부 분석');
  if (list.indexOf('model-output-truncated') >= 0) phrases.push('응답 길이 한도 — 일부만 표시');
  var premise = list.filter(function(reason) { return /^premise-/.test(reason); })[0];
  if (premise) phrases.push(premise === 'premise-contradicted' ? '질문 전제와 반대 관측 — 조건부 설명' : '질문 전제 확인 안 됨 — 조건부 설명');
  return phrases.length ? '※ ' + phrases.join(' · ') : '';
}

export function buildPublishableAnswerPlan(plan, bindingEvidence, currentSensitive, { nowMs = Date.now(), referenceText = '', entities = null, nameEntries = null, searchCitations = null, toolBasis = null } = {}) {
  entities = Array.isArray(entities) ? answerEntities(entities, nameEntries) : null;
  if (!plan) return { plan: null, droppedClaims: [], unboundEvidenceIds: [] };
  var rows = (Array.isArray(bindingEvidence) ? bindingEvidence : []).filter(row => evidenceCanPublish(row, nowMs));
  var bindingIds = new Set(rows.map(claimEvidenceId));
  var claims = plan.claims && Array.isArray(plan.claims.claims) ? plan.claims.claims : [];
  var droppedClaims = [];
  var unboundEvidenceIds = [];
  var boundLabels = new Map();
  var referenceClaims = new Set();
  var claimNumbers = supportedNumbers(rows, referenceText, nowMs, entities);
  var safeClaims = claims.filter(function(claim) {
    var reasons = [];
    var type = String(claim && claim.type || '');
    var ids = Array.isArray(claim && claim.evidenceIds) ? claim.evidenceIds.map(String) : [];
    // P1688 live check (2026-10-13): the model labelled exact registry copies type "market_data"; a claim that carries a
    // metric and a numeric value is numeric whatever its label, so it is validated (not dropped as untyped content).
    var numeric = /^(?:numeric|metric|percentage|probability)$/.test(type) || (type !== 'text' && !!(claim && claim.metric) && typeof (claim && claim.value) === 'number');
    var labelAgrees = !numeric || claimLabelAgrees(claim);
    // A figure copied from the injected data or a tool result has no evidence id to cite, but it is in the material the
    // model was given for that subject: it is kept as a reference figure (its own text, dated) instead of being dropped
    // as unverified. A figure that is nowhere in that material, or only there for another metric, basis or day, still
    // fails below, as does a claim whose text writes another figure than its value.
    if (numeric && labelAgrees && !ids.length && type !== 'probability' && claim.status !== 'blocked' && claim.asOf && claimInReference(claim, claimNumbers, entities)) {
      referenceClaims.add(claim);
      return true;
    }
    // The label check guards the claim's own text, which is published only on the reference path (no
    // evidence id). An evidence-bound claim is published under its bound row's label (below), so a second figure in its
    // text ("4.21% (전일 대비 +5bp)") is never shown and is no reason to drop a value the evidence proves.
    if (!labelAgrees && !ids.length) reasons.push('claim-label-mismatch');
    if (numeric) {
      if (typeof claim.value !== 'number' || !isFinite(claim.value)) reasons.push('numeric-value');
      if (!claim.unit || !claim.asOf || !claim.source || !ids.length) reasons.push('traceability');
    }
    if (currentSensitive && (!claim.asOf || !claim.source || !ids.length)) reasons.push('current-traceability');
    if (type === 'probability' && !(claim.calibration && claim.calibration.modelId)) reasons.push('calibration');
    if (claim.allowedUse === 'decision' && (!ids.length || claim.status !== 'verified')) reasons.push('decision-use');
    ids.forEach(function(id) { if (!bindingIds.has(id)) { reasons.push('evidence-unbound'); unboundEvidenceIds.push(id); } });
    var boundRows = rows.filter(function(row) { return ids.indexOf(claimEvidenceId(row)) >= 0; });
    if (currentSensitive && !numeric && hasCurrentNumericContent(claim.text)) reasons.push('untyped-numeric-content');
    // v59.45 (pipeline review P11-AI-01): a text claim matched only on source and date, so an AAPL price row "proved"
    // "연준이 금리를 인하했고 신용 스트레스도 해소됐다" and it was listed as a verified value while the same sentence was cut from
    // the summary. A current-event sentence in a text claim now needs the rows it cites to name its subject, as summary text does.
    if (currentSensitive && !numeric && currentEventSentenceUnbound(claim.text, boundRows)) reasons.push('current-event-unverified');
    var matchedRow = null;
    if ((numeric || currentSensitive || ids.length) && !boundRows.some(function(row) {
      var source = String(claim.source || '').trim();
      var sourceMatches = source && (source === String(row.source || '').trim() || source === String(row.publisher || '').trim() ||
        (claimSourceUrl(source) && [claimSourceUrl(row.canonicalUrl), claimSourceUrl(row.sourceUrl)].indexOf(claimSourceUrl(source)) >= 0));
      var claimTime = Date.parse(claim.asOf);
      var rowTime = Date.parse(row.asOf || row.publishedAt || '');
      var timeMatches = Number.isFinite(claimTime) && claimTime === rowTime;
      var rowEntity = String(row.entity || row.ticker || row.symbol || '').trim();
      var identityMatches = !!claim.metric && claim.metric === row.metric &&
        String(claim.entity || '').trim() === rowEntity &&
        String(claim.scale || 'raw') === String(row.scale || 'raw');
      var matches = sourceMatches && (!(numeric || currentSensitive) || timeMatches) &&
        (!numeric || (identityMatches && typeof row.value === 'number' && claim.value === row.value && claim.unit === row.unit));
      if (matches) matchedRow = row;
      return matches;
    })) reasons.push('evidence-content-mismatch');
    if (claim.status === 'blocked') reasons.push('claim-blocked');
    if (reasons.length) {
      droppedClaims.push({ claimId: claim.claimId || null, reasons: Array.from(new Set(reasons)) });
      return false;
    }
    if (matchedRow && matchedRow.label) boundLabels.set(claim, String(matchedRow.label));
    return true;
  }).map(function(claim) {
    if (referenceClaims.has(claim)) return claim;
    if (!/^(?:numeric|metric|percentage|probability)$/.test(String(claim.type || '')) && !(String(claim.type || '') !== 'text' && claim.metric && typeof claim.value === 'number')) return claim;
    // Render the verified tuple separately; model prose must not smuggle a
    // second, conflicting number alongside a valid structured value.
    // v57.48 #7: a bound evidence row that carries its own display label (close-basis rows: "VIX 종가") names the value.
    var label = boundLabels.get(claim) || [claim.entity, claim.metric].filter(Boolean).join(' · ');
    return Object.assign({}, claim, { text: label || '검증된 수치' });
  });
  var eventsDropped = 0;
  var numericRemoved = 0;
  var searchedKept = 0;
  var toolDates = 0;
  var sentencesTotal = 0;
  var noEvidence = currentSensitive && rows.length === 0;
  var noSupport = noEvidence && !referenceText;
  var numbers = supportedNumbers(rows, referenceText, nowMs, entities);
  var searchUrls = citationUrlSet(searchCitations);
  var stripNumeric = function(text) {
    var out = stripNumericSentences(text, nowMs, numbers, entities, searchUrls, toolBasis);
    numericRemoved += out.removed;
    searchedKept += out.searched;
    toolDates += out.toolDates;
    return out.text;
  };
  var cited = function(bare, sentence) { return searchedSentenceKept(sentence, searchUrls, numbers, entities); };
  var clean = function(text) {
    var out = stripNumeric(tidyInlineCitations(text));
    // An event sentence whose figures are all in the evidence ("오늘 −1.2% 내렸지만") is bound by those values.
    var events = stripUnverifiedCurrentEventSentences(out, noSupport ? (searchUrls ? cited : null) : function(sentence, whole) { return eventBoundToEvidence(sentence, rows) || figuresSupported(sentence, numbers, { entities: entities }) || cited(sentence, whole); }, { today: nowMs });
    eventsDropped += events.dropped;
    return events.text;
  };
  sentencesTotal += countSentences(plan.summary);
  var summary = currentSensitive ? clean(plan.summary) : tidyInlineCitations(plan.summary).trim();
  var sections = (Array.isArray(plan.sections) ? plan.sections : []).map(function(section) {
    if (typeof section === 'string') { sentencesTotal += countSentences(section); return currentSensitive ? clean(section) : tidyInlineCitations(section); }
    if (!section || typeof section !== 'object') return null;
    sentencesTotal += countSentences(section.body);
    return Object.assign({}, section, { title: currentSensitive ? stripNumeric(section.title) : section.title, body: currentSensitive ? clean(section.body) : tidyInlineCitations(section.body) });
  }).filter(function(section) { return typeof section === 'string' ? !!section.trim() : !!(section && section.title && section.body); });
  if (eventsDropped) droppedClaims.push({ claimId: null, reasons: ['current-event-unverified'], count: eventsDropped });
  return {
    plan: Object.assign({}, plan, { summary: summary, sections: sections, claims: { schemaVersion: 'claim-ledger.v1', claims: safeClaims }, citations: (Array.isArray(plan.citations) ? plan.citations : []).filter(function(citation) {
      var url = claimSourceUrl(typeof citation === 'string' ? citation : citation && citation.url);
      return url && rows.some(function(row) { return [claimSourceUrl(row.canonicalUrl), claimSourceUrl(row.sourceUrl), claimSourceUrl(row.source)].indexOf(url) >= 0; });
    }) }),
    droppedClaims: droppedClaims,
    unboundEvidenceIds: Array.from(new Set(unboundEvidenceIds)),
    filterCounts: { removedNumericSentences: numericRemoved, removedEventSentences: eventsDropped, searchedSentences: searchedKept, toolDates: toolDates, sentencesTotal: sentencesTotal }
  };
}
