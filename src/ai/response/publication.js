// P1519: one evidence-publication policy shared by the legacy adapter and native ESM.
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
var ROW_UNITS = { USD: 'USD', KRW: 'KRW', PERCENT: 'percent', '%': 'percent', PCT: 'percent', BP: 'bp', BPS: 'bp', X: 'multiple', MULTIPLE: 'multiple', '배': 'multiple', INDEX: 'point', POINT: 'point', POINTS: 'point', PT: 'point' };
export function supportedNumbersFromEvidence(rows, nowMs = Date.now()) {
  var numbers = (Array.isArray(rows) ? rows : []).filter(function(row) {
    return evidenceCanPublish(row, nowMs) && typeof row.value === 'number' && isFinite(row.value) && String(row.scale || 'raw') === 'raw';
  }).map(function(row) { return { value: row.value, unit: ROW_UNITS[String(row.unit || '').trim().toUpperCase()] || '' }; });
  return numbers.length ? numbers : null;
}
// What is not a figure of the sentence: a link, a date or clock time, a window length that names a measure ("20거래일",
// "52주", "10년물", "3개월"; "3거래일 연속" is a count and stays), an index name ("S&P 500", "나스닥 100") and a code
// with digits ("US10Y", "H100", "2s10s").
var NOT_A_FIGURE = /(?:https?:\/\/|www\.)\S+|(?<!\d)(?:19|20)\d{2}\s*(?:[-./]|년)\s*\d{1,2}(?:\s*(?:[-./]|월)\s*\d{1,2}\s*일?)?(?!\d)|(?<!\d)\d{1,2}\s*월\s*\d{1,2}\s*일|(?<!\d)(?:19|20)\d{2}\s*년(?:대)?|(?<!\d)\d{1,2}:\d{2}(?!\d)|(?:S&P|나스닥|러셀|코스피|코스닥|\b(?:Nasdaq|NASDAQ|Russell|KOSPI|KOSDAQ)\b)\s*(?:500|100|2000|200|150)(?![\d,.])|(?<![\d.,])\d+\s*(?:개월|개년|년물|년간|년|분기|주(?![가식당요])|거래일|일선|일(?![부반정본간]))(?!\s*(?:연속|째|만에))|(?<![A-Za-z])(?!\b(?:USD|KRW|US)\d)[A-Za-z]+\d[\dA-Za-z]*|\d+s\d+s|\d+-\b(?:year|month|week|day)\b/g;
var WRITTEN_FIGURE = /(\$|₩|\b(?:USD|KRW|US\$)\s*)?([+\-−]?)(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)\s*(?<![A-Za-z])(%|퍼센트|percent\b|bps?\b|배|달러|dollars?\b|USD\b|원|KRW\b|포인트|pt\b|조|억|만|개|곳|건|명|종목)?/gi;
var WRITTEN_UNITS = [[/^(?:%|퍼센트|percent)$/i, 'percent'], [/^bps?$/i, 'bp'], [/^배$/, 'multiple'], [/^(?:\$|달러|dollars?|USD|US\$)$/i, 'USD'], [/^(?:₩|원|KRW)$/i, 'KRW'], [/^(?:포인트|pt)$/i, 'point']];
function writtenUnit(word) {
  if (!word) return '';
  var hit = WRITTEN_UNITS.filter(function(pair) { return pair[0].test(word); })[0];
  return hit ? hit[1] : 'unsupported';
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
export function supportedNumbersFromText(text) {
  var bare = normaliseForDetection(String(text || '')).replace(NOT_A_FIGURE, ' ');
  var numbers = [];
  var seen = new Set();
  var matches = bare.matchAll(WRITTEN_FIGURE);
  for (var match of matches) {
    var unit = writtenUnit(match[4] || String(match[1] || '').trim());
    if (unit === 'unsupported') continue;
    var size = Number(match[3].replace(/,/g, ''));
    if (!isFinite(size)) continue;
    var value = /^[-−]$/.test(match[2]) ? -size : size;
    var key = value + '|' + unit;
    if (seen.has(key)) continue;
    seen.add(key);
    numbers.push({ value: value, unit: unit, signed: match[2] !== '' });
    if (numbers.length >= REFERENCE_FIGURE_LIMIT) break;
  }
  return numbers.length ? numbers : null;
}
function supportedNumbers(rows, referenceText, nowMs) {
  var all = (supportedNumbersFromEvidence(rows, nowMs) || []).concat(supportedNumbersFromText(referenceText) || []);
  return all.length ? all : null;
}
export function figuresSupported(text, numbers) {
  if (!Array.isArray(numbers) || !numbers.length) return false;
  var bare = normaliseForDetection(text).replace(NOT_A_FIGURE, ' ');
  var figures = Array.from(bare.matchAll(WRITTEN_FIGURE));
  return figures.length > 0 && figures.every(function(match) {
    var unit = writtenUnit(match[4] || String(match[1] || '').trim());
    if (unit === 'unsupported') return false;
    var digits = match[3].replace(/,/g, '');
    var places = (digits.split('.')[1] || '').length;
    var written = Number(digits);
    if (/^\d{1,2}$/.test(digits) && !unit) return false; // an integer under 100
    var sign = match[2] === '' ? 0 : match[2] === '+' ? 1 : -1;
    return numbers.some(function(number) {
      if (unit && number.unit !== unit) return false;
      // A figure the material wrote without a sign ("1.2% 하락") carries its direction in words, so it supports either sign.
      if (sign && number.value !== 0 && number.signed !== false && sign !== Math.sign(number.value)) return false;
      var size = Math.abs(number.value);
      return written === size || ((String(size).split('.')[1] || '').length > places && Number(size.toFixed(places)) === written);
    });
  });
}

function stripNumericSentences(value, today, numbers) {
  var removed = 0;
  var text = String(value || '').split('\n').map(function(line) {
    if (!line.trim()) return '';
    // P1740: a markdown table keeps its rows; only an unverified current-number cell becomes "확인 필요". Dropping the
    // whole row left a header with no body. A cell whose every figure is a supported number keeps its value.
    if (/^\s*\|.*\|\s*$/.test(line)) {
      if (/^\s*\|[\s\-:|]+\|\s*$/.test(line)) return line;
      return line.split('|').map(function(cell, index, cells) {
        if (index === 0 || index === cells.length - 1) return cell;
        return (hasCurrentNumericContent(cell) || /^\s*[+\-−]?\d[\d,.]*\s*$/.test(cell)) && !figuresSupported(cell, numbers) ? ' 확인 필요 ' : cell;
      }).join('|');
    }
    var kept = splitAnswerSentences(line).filter(function(sentence) {
      // A current sentence stays when every figure it writes is in the evidence; one figure that is not removes it.
      var current = numericClaimKind(sentence, { today: today }) === 'current' && !figuresSupported(sentence.replace(CITED_URL, ' '), numbers);
      if (current) removed += 1;
      return !current;
    }).join(' ');
    return kept || null;
  }).filter(function(line) { return line !== null; }).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text: text, removed: removed };
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
    var kept = splitAnswerSentences(line).filter(function(sentence) {
      var bare = sentence.replace(CITED_URL, ' ');
      var normalised = normaliseForDetection(bare);
      var event = CURRENT_EVENT.test(bare) && !GENERAL_OR_HISTORICAL.test(bare) && !isConditionalNumericSentence(bare) && !CONDITIONAL_MARKER.test(bare.replace(NON_CONDITIONAL_MYEON, ' '))
        && !isDatedPast(normalised, nowMs) && !isFixedFact(normalised)
        && !(typeof isBound === 'function' && isBound(bare));
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
  var result = { text: text, removedNumericSentences: 0, removedEventSentences: 0, sentencesTotal: countSentences(text) };
  if (!currentSensitive) return result;
  var today = options && options.today;
  var numbers = options && supportedNumbers(options.evidenceRows, options.referenceText, todayMs(today));
  var numeric = stripNumericSentences(text, today, numbers);
  result.text = numeric.text;
  result.removedNumericSentences = numeric.removed;
  var events = null;
  if (options && options.evidenceCount === 0 && !numbers) events = stripUnverifiedCurrentEventSentences(numeric.text, null, { today: today });
  // v58.77 AI-01: with evidence rows handed in, an event sentence must name what one of them covers (same as the plan path).
  else if (options && (Array.isArray(options.evidenceRows) || numbers)) events = stripUnverifiedCurrentEventSentences(numeric.text, function(sentence) { return eventBoundToEvidence(sentence, options.evidenceRows || []) || figuresSupported(sentence, numbers); }, { today: today });
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
export function summarizeAnswerLimitations(reasons = [], { publishedClaimCount = 0 } = {}) {
  var list = Array.from(new Set(Array.isArray(reasons) ? reasons.map(String) : []));
  var phrases = [];
  var numericDropped = list.some(function(reason) { return NUMERIC_DROP_REASONS.indexOf(reason) >= 0; });
  var currentGap = list.some(function(reason) { return CURRENT_GAP_REASONS.indexOf(reason) >= 0; });
  if (publishedClaimCount > 0 && (numericDropped || currentGap)) phrases.push(numericDropped ? '일부 최신 수치 확인 안 됨 — 확인된 값만 표시' : '표시한 값 외의 최신 수치는 확인 안 됨');
  else if (numericDropped || currentGap) phrases.push('최신 수치 확인 안 됨 — 일반 설명만');
  if (list.indexOf('suitability-context-missing') >= 0) phrases.push('투자 성향 정보 없음 — 조건부 분석');
  if (list.indexOf('model-output-truncated') >= 0) phrases.push('응답 길이 한도 — 일부만 표시');
  var premise = list.filter(function(reason) { return /^premise-/.test(reason); })[0];
  if (premise) phrases.push(premise === 'premise-contradicted' ? '질문 전제와 반대 관측 — 조건부 설명' : '질문 전제 확인 안 됨 — 조건부 설명');
  return phrases.length ? '※ ' + phrases.join(' · ') : '';
}

export function buildPublishableAnswerPlan(plan, bindingEvidence, currentSensitive, { nowMs = Date.now(), referenceText = '' } = {}) {
  if (!plan) return { plan: null, droppedClaims: [], unboundEvidenceIds: [] };
  var rows = (Array.isArray(bindingEvidence) ? bindingEvidence : []).filter(row => evidenceCanPublish(row, nowMs));
  var bindingIds = new Set(rows.map(claimEvidenceId));
  var claims = plan.claims && Array.isArray(plan.claims.claims) ? plan.claims.claims : [];
  var droppedClaims = [];
  var unboundEvidenceIds = [];
  var boundLabels = new Map();
  var safeClaims = claims.filter(function(claim) {
    var reasons = [];
    var type = String(claim && claim.type || '');
    var ids = Array.isArray(claim && claim.evidenceIds) ? claim.evidenceIds.map(String) : [];
    // P1688 live check (2026-10-13): the model labelled exact registry copies type "market_data"; a claim that carries a
    // metric and a numeric value is numeric whatever its label, so it is validated (not dropped as untyped content).
    var numeric = /^(?:numeric|metric|percentage|probability)$/.test(type) || (type !== 'text' && !!(claim && claim.metric) && typeof (claim && claim.value) === 'number');
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
    if (!/^(?:numeric|metric|percentage|probability)$/.test(String(claim.type || '')) && !(String(claim.type || '') !== 'text' && claim.metric && typeof claim.value === 'number')) return claim;
    // Render the verified tuple separately; model prose must not smuggle a
    // second, conflicting number alongside a valid structured value.
    // v57.48 #7: a bound evidence row that carries its own display label (close-basis rows: "VIX 종가") names the value.
    var label = boundLabels.get(claim) || [claim.entity, claim.metric].filter(Boolean).join(' · ');
    return Object.assign({}, claim, { text: label || '검증된 수치' });
  });
  var eventsDropped = 0;
  var numericRemoved = 0;
  var sentencesTotal = 0;
  var noEvidence = currentSensitive && rows.length === 0;
  var noSupport = noEvidence && !referenceText;
  var numbers = supportedNumbers(rows, referenceText, nowMs);
  var stripNumeric = function(text) {
    var out = stripNumericSentences(text, nowMs, numbers);
    numericRemoved += out.removed;
    return out.text;
  };
  var clean = function(text) {
    var out = stripNumeric(text);
    // An event sentence whose figures are all in the evidence ("오늘 −1.2% 내렸지만") is bound by those values.
    var events = stripUnverifiedCurrentEventSentences(out, noSupport ? null : function(sentence) { return eventBoundToEvidence(sentence, rows) || figuresSupported(sentence, numbers); }, { today: nowMs });
    eventsDropped += events.dropped;
    return events.text;
  };
  sentencesTotal += countSentences(plan.summary);
  var summary = currentSensitive ? clean(plan.summary) : String(plan.summary || '').trim();
  var sections = (Array.isArray(plan.sections) ? plan.sections : []).map(function(section) {
    if (typeof section === 'string') { sentencesTotal += countSentences(section); return currentSensitive ? clean(section) : section; }
    if (!section || typeof section !== 'object') return null;
    sentencesTotal += countSentences(section.body);
    return Object.assign({}, section, { title: currentSensitive ? stripNumeric(section.title) : section.title, body: currentSensitive ? clean(section.body) : section.body });
  }).filter(function(section) { return typeof section === 'string' ? !!section.trim() : !!(section && section.title && section.body); });
  if (eventsDropped) droppedClaims.push({ claimId: null, reasons: ['current-event-unverified'], count: eventsDropped });
  return {
    plan: Object.assign({}, plan, { summary: summary, sections: sections, claims: { schemaVersion: 'claim-ledger.v1', claims: safeClaims }, citations: (Array.isArray(plan.citations) ? plan.citations : []).filter(function(citation) {
      var url = claimSourceUrl(typeof citation === 'string' ? citation : citation && citation.url);
      return url && rows.some(function(row) { return [claimSourceUrl(row.canonicalUrl), claimSourceUrl(row.sourceUrl), claimSourceUrl(row.source)].indexOf(url) >= 0; });
    }) }),
    droppedClaims: droppedClaims,
    unboundEvidenceIds: Array.from(new Set(unboundEvidenceIds)),
    filterCounts: { removedNumericSentences: numericRemoved, removedEventSentences: eventsDropped, sentencesTotal: sentencesTotal }
  };
}
