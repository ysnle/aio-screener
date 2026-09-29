// RM-03 (continued): extracted from js/aio-data.js:computeNewsSentimentScore/
// computeNewsRiskSignals. Pure functions: no DOM, no global reads — every value the legacy
// wrapper read from its own globals (`newsCache`, `Date.now()`) is now an explicit parameter.
// The formulas (bull/bear keyword scoring, sentiment banding, risk-signal thresholds) are
// originally transcribed unchanged. v2 corrects lexical collisions and requires credit-stress context.
export const NEWS_SCORING_MODEL_VERSION = 'news-scoring.v2';
export const MIN_NEWS_ANALYSIS_SAMPLE = 5;

/** Keep only persisted chart points whose sample provenance matches this model and policy. */
export function normalizeNewsSentimentHistory(points, limit = 24) {
  const maxPoints = Number.isInteger(Number(limit)) && Number(limit) > 0 ? Number(limit) : 24;
  return (Array.isArray(points) ? points : []).filter((point) => {
    const eligibleCount = Number(point?.eligibleCount);
    const score = Number(point?.score);
    return point?.modelVersion === NEWS_SCORING_MODEL_VERSION
      && point?.sampleSufficient === true
      && Number.isInteger(eligibleCount) && eligibleCount >= MIN_NEWS_ANALYSIS_SAMPLE
      && Number.isFinite(score) && score >= 0 && score <= 100;
  }).slice(-maxPoints);
}

const BULL_KEYWORDS = ['surge', 'rally', 'beat', 'outperform', 'upgrade', 'record high', 'soar', 'market boom', 'bull', 'recovery', '급등', '상승', '호재', '상향', '돌파', '신고가', '반등', '회복'];
const BEAR_KEYWORDS = ['crash', 'plunge', 'miss', 'downgrade', 'sell-off', 'collapse', 'fear', 'crisis', 'trade war', 'default', 'military', 'conflict', 'sanctions', '급락', '하락', '악재', '하향', '폭락', '위기', '전쟁', '부도'];

// English terms match words and common inflections, never substrings in names or unrelated words.
const keywordPatterns = new Map([...BULL_KEYWORDS, ...BEAR_KEYWORDS].filter((kw) => /^[a-z]/.test(kw)).map((kw) => [kw, new RegExp('(?:^|[^a-z])' + kw + '(?:s|es|d|ed|ing)?(?=$|[^a-z])', 'i')]));
function hasKeyword(text, keyword) {
  return keywordPatterns.has(keyword) ? keywordPatterns.get(keyword).test(text) : text.includes(keyword);
}

export function classifyNewsTextStance(text) {
  const t = String(text || '').toLowerCase();
  let bullScore = 0, bearScore = 0;
  BULL_KEYWORDS.forEach((kw) => { if (hasKeyword(t, kw)) bullScore++; });
  BEAR_KEYWORDS.forEach((kw) => { if (hasKeyword(t, kw)) bearScore++; });
  if (bullScore > bearScore + 1) return 'bull';
  if (bearScore > bullScore + 1) return 'bear';
  if (bearScore > bullScore) return 'warn';
  return 'neut';
}

function filterByAgeHours(items, maxHours, now) {
  if (!maxHours || !items) return items || [];
  const cutoff = now - maxHours * 3600000;
  return items.filter((item) => {
    // An undated/invalid article has no freshness evidence.  Treating it as
    // current silently promotes stale or backfilled content into the score.
    if (!item?.pubDate) return false;
    const t = new Date(item.pubDate).getTime();
    return Number.isFinite(t) && t >= cutoff && t <= now;
  });
}

function publicationTime(item) {
  const raw = item?.pubDate || item?.publishedAt || item?.published || null;
  const time = raw instanceof Date ? raw.getTime() : Date.parse(raw || '');
  return Number.isFinite(time) ? time : null;
}

function filterByWindow(items, windowStart, windowEnd, now) {
  const start = windowStart instanceof Date ? windowStart.getTime() : Date.parse(windowStart || '');
  const end = windowEnd instanceof Date ? windowEnd.getTime() : Date.parse(windowEnd || '');
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end) return [];
  return (Array.isArray(items) ? items : []).filter((item) => {
    const time = publicationTime(item);
    return time != null && time >= start && time < end && time <= now;
  });
}

function filterByEvidenceWindow(items, now, windowStart, windowEnd) {
  if (windowStart != null || windowEnd != null) return filterByWindow(items, windowStart, windowEnd, now);
  return filterByAgeHours(items, 24, now);
}

export function isNewsHeadlineOnly(item) {
  return String(item?.contentDepth || '').trim().toLowerCase() === 'headline-only'
    || String(item?.verificationStatus || '').trim().toLowerCase() === 'headline-only';
}

/** A title can be discovered and displayed without being eligible as article-level evidence. */
export function isNewsAnalysisEligible(item) {
  if (!item || isNewsHeadlineOnly(item)) return false;
  const status = String(item.verificationStatus || '').trim().toLowerCase();
  if (status === 'unverified' || status === 'secondary-only' || status === 'stale') return false;
  const body = item.summary ?? item.desc ?? item.description ?? '';
  return String(body).trim().length >= 40;
}

export function isNewsTopicReviewRequired(item) {
  return item?.topicReviewRequired === true || String(item?.topicSource || '').toLowerCase() === 'feed-query';
}

function hasReviewedArticleTopic(item) {
  return !isNewsTopicReviewRequired(item);
}

/** KST 08:00-anchored completed-24h briefing window, matching legacy _getBriefingWindowKST. */
export function briefingWindowKST(now) {
  const KST_OFFSET_MS = 9 * 3600000;
  const DAY_MS = 24 * 3600000;
  const nowMs = Number(now);
  if (!Number.isFinite(nowMs)) return Object.freeze({ start: null, end: null });
  const kstNow = new Date(nowMs + KST_OFFSET_MS);
  let endMs = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate(), 8, 0, 0, 0) - KST_OFFSET_MS;
  if (nowMs < endMs) endMs -= DAY_MS;
  const completedStart = endMs - DAY_MS;
  return Object.freeze({ start: completedStart, end: endMs });
}

function filterByKst0800Cycle(items, now) {
  if (!items) return [];
  const cycleWindow = briefingWindowKST(now);
  if (cycleWindow.start == null || cycleWindow.end == null) return [];
  return items.filter((item) => {
    if (!item || !item.pubDate) return false;
    const t = new Date(item.pubDate).getTime();
    return Number.isFinite(t) && t >= cycleWindow.start && t < cycleWindow.end;
  });
}

/** @param {object} input @param {Array} input.items @param {number} input.now epoch ms */
export function computeNewsSentimentScore({ items = [], now = Date.now(), windowStart, windowEnd } = {}) {
  const empty = (label, total = 0) => Object.freeze({
    modelVersion: NEWS_SCORING_MODEL_VERSION,
    score: total > 0 ? null : 50,
    label,
    bullCount: 0,
    bearCount: 0,
    total,
    bullRatio: 0,
    bearRatio: 0,
    sampleSufficient: false
  });
  const list = Array.isArray(items) ? items : [];
  const nowMs = Number(now);
  if (list.length === 0) return empty('뉴스 없음');
  if (!Number.isFinite(nowMs)) return empty('데이터 부족');
  const recent = filterByEvidenceWindow(list, nowMs, windowStart, windowEnd).filter(isNewsAnalysisEligible);
  if (recent.length === 0) return empty('데이터 부족');
  if (recent.length < MIN_NEWS_ANALYSIS_SAMPLE) return empty('표본 부족', recent.length);

  let bullCount = 0, bearCount = 0;
  const total = recent.length;
  recent.forEach((item) => {
    const stance = classifyNewsTextStance(`${item.title || ''} ${item.desc || ''}`);
    if (stance === 'bull') bullCount++;
    else if (stance === 'bear' || stance === 'warn') bearCount++;
  });

  const bullRatio = Math.round((bullCount / total) * 100);
  const bearRatio = Math.round((bearCount / total) * 100);
  const sentimentScore = Math.round(50 + ((bullCount - bearCount) / total) * 50);
  const label = sentimentScore >= 70 ? '강한 낙관' : sentimentScore >= 55 ? '약한 낙관' : sentimentScore >= 45 ? '중립' : sentimentScore >= 30 ? '약한 비관' : '강한 비관';

  return Object.freeze({
    modelVersion: NEWS_SCORING_MODEL_VERSION,
    score: Math.max(0, Math.min(100, sentimentScore)),
    label, bullCount, bearCount, total, bullRatio, bearRatio,
    sampleSufficient: true
  });
}

/** @param {object} input @param {Array} input.items @param {number} input.now epoch ms */
export function computeNewsRiskSignals({ items = [], now = Date.now(), windowStart, windowEnd } = {}) {
  if (!Array.isArray(items) || !Number.isFinite(Number(now))) return Object.freeze([]);
  const recent = (windowStart != null || windowEnd != null
    ? filterByWindow(items, windowStart, windowEnd, Number(now))
    : filterByKst0800Cycle(items, Number(now)))
    .filter(isNewsAnalysisEligible);
  if (recent.length < MIN_NEWS_ANALYSIS_SAMPLE) return Object.freeze([]);
  const riskSignals = [];

  // Feed query topics are discovery metadata until an article-level classification is supplied.
  const topicEvidence = recent.filter(hasReviewedArticleTopic);
  const geoNews = topicEvidence.filter((i) => i.topic === 'geo');
  if (geoNews.length >= 5) riskSignals.push({ type: 'geo', level: 'high', label: `지정학 리스크 고조 (${geoNews.length}건)`, impact: -10 });
  else if (geoNews.length >= 2) riskSignals.push({ type: 'geo', level: 'mid', label: `지정학 이슈 존재 (${geoNews.length}건)`, impact: -5 });

  const energyBear = topicEvidence.filter((i) => i.topic === 'energy' && classifyNewsTextStance(i.title) === 'bear');
  if (energyBear.length >= 3) riskSignals.push({ type: 'energy', level: 'high', label: `에너지 위기 신호 (${energyBear.length}건)`, impact: -8 });

  const creditStress = recent.filter((i) => {
    const t = String(i.title || '').toLowerCase();
    const financialContext = /\b(?:credit|debt|bond|loan|lender|bank|borrower|corporate)\b|신용|채권|채무|대출|은행/.test(t);
    const stress = /\b(?:defaults?|defaulted|stress|crisis|distress|delinquency|bankrupt(?:cy)?|widen(?:s|ed|ing)?)\b|부도|경색|연체|파산|스프레드.*확대/.test(t);
    return financialContext && stress;
  });
  if (creditStress.length >= 3) riskSignals.push({ type: 'credit', level: 'high', label: '신용 스트레스 신호', impact: -12 });

  const earningsBull = topicEvidence.filter((i) => i.topic === 'earnings' && classifyNewsTextStance(i.title) === 'bull');
  const earningsBear = topicEvidence.filter((i) => i.topic === 'earnings' && classifyNewsTextStance(i.title) === 'bear');
  if (earningsBull.length > earningsBear.length + 3) riskSignals.push({ type: 'earnings', level: 'positive', label: '실적 시즌 긍정적', impact: 8 });
  else if (earningsBear.length > earningsBull.length + 3) riskSignals.push({ type: 'earnings', level: 'negative', label: '실적 시즌 부진', impact: -8 });

  return Object.freeze(riskSignals.map((signal) => Object.freeze(signal)));
}

/** Shared native-page summary projection; the scoring producer keeps its historical 50 baseline. */
export function deriveNewsSummary({ items = [], now = Date.now(), windowStart, windowEnd } = {}) {
  const rows = Array.isArray(items) ? items : [];
  const sentiment = computeNewsSentimentScore({ items: rows, now, windowStart, windowEnd });
  const sources = new Set(rows.map((item) => String(
    (typeof item?._tgChannel === 'string' && item._tgChannel) || item?.source || item?.feed || item?.tgSlug || ''
  ).trim()).filter(Boolean));
  const riskSignals = computeNewsRiskSignals({ items: rows, now, windowStart, windowEnd });
  return Object.freeze({
    itemCount: rows.length,
    sourceCount: sources.size,
    analyzedCount: sentiment.total,
    pendingCount: Math.max(0, rows.length - sentiment.total),
    score: sentiment.sampleSufficient ? sentiment.score : null,
    label: sentiment.total > 0 ? sentiment.label : '분석 보류',
    sampleSufficient: sentiment.sampleSufficient,
    bullCount: sentiment.bullCount,
    bearCount: sentiment.bearCount,
    riskSignals
  });
}
