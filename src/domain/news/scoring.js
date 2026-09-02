// RM-03 (continued): extracted from js/aio-data.js:computeNewsSentimentScore/
// computeNewsRiskSignals. Pure functions: no DOM, no global reads — every value the legacy
// wrapper read from its own globals (`newsCache`, `Date.now()`) is now an explicit parameter.
// The formulas (bull/bear keyword scoring, sentiment banding, risk-signal thresholds) are
// transcribed unchanged — this is code motion, not a new model (R352/F-03).
export const NEWS_SCORING_MODEL_VERSION = 'news-scoring.v1';

const BULL_KEYWORDS = ['surge', 'rally', 'beat', 'outperform', 'upgrade', 'record high', 'soar', 'market boom', 'bull', 'recovery', '급등', '상승', '호재', '상향', '돌파', '신고가', '반등', '회복'];
const BEAR_KEYWORDS = ['crash', 'plunge', 'miss', 'downgrade', 'sell-off', 'collapse', 'fear', 'crisis', 'trade war', 'default', 'military', 'conflict', 'sanctions', '급락', '하락', '악재', '하향', '폭락', '위기', '전쟁', '부도'];

export function classifyNewsTextStance(text) {
  const t = String(text || '').toLowerCase();
  let bullScore = 0, bearScore = 0;
  BULL_KEYWORDS.forEach((kw) => { if (t.includes(kw)) bullScore++; });
  BEAR_KEYWORDS.forEach((kw) => { if (t.includes(kw)) bearScore++; });
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
export function computeNewsSentimentScore({ items = [], now = Date.now() } = {}) {
  const empty = (label) => Object.freeze({ modelVersion: NEWS_SCORING_MODEL_VERSION, score: 50, label, bullCount: 0, bearCount: 0, total: 0, bullRatio: 0, bearRatio: 0 });
  const list = Array.isArray(items) ? items : [];
  const nowMs = Number(now);
  if (list.length === 0) return empty('뉴스 없음');
  if (!Number.isFinite(nowMs)) return empty('데이터 부족');
  const recent = filterByAgeHours(list, 24, nowMs);
  if (recent.length === 0) return empty('데이터 부족');

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
    label, bullCount, bearCount, total, bullRatio, bearRatio
  });
}

/** @param {object} input @param {Array} input.items @param {number} input.now epoch ms */
export function computeNewsRiskSignals({ items = [], now = Date.now() } = {}) {
  if (!Array.isArray(items) || !Number.isFinite(Number(now))) return Object.freeze([]);
  const recent = filterByKst0800Cycle(items, Number(now));
  const riskSignals = [];

  const geoNews = recent.filter((i) => i.topic === 'geo');
  if (geoNews.length >= 5) riskSignals.push({ type: 'geo', level: 'high', label: `지정학 리스크 고조 (${geoNews.length}건)`, impact: -10 });
  else if (geoNews.length >= 2) riskSignals.push({ type: 'geo', level: 'mid', label: `지정학 이슈 존재 (${geoNews.length}건)`, impact: -5 });

  const energyBear = recent.filter((i) => i.topic === 'energy' && classifyNewsTextStance(i.title) === 'bear');
  if (energyBear.length >= 3) riskSignals.push({ type: 'energy', level: 'high', label: `에너지 위기 신호 (${energyBear.length}건)`, impact: -8 });

  const creditStress = recent.filter((i) => {
    const t = String(i.title || '').toLowerCase();
    return t.includes('credit') || t.includes('default') || t.includes('spread') || t.includes('부도') || t.includes('신용');
  });
  if (creditStress.length >= 3) riskSignals.push({ type: 'credit', level: 'high', label: '신용 스트레스 신호', impact: -12 });

  const earningsBull = recent.filter((i) => i.topic === 'earnings' && classifyNewsTextStance(i.title) === 'bull');
  const earningsBear = recent.filter((i) => i.topic === 'earnings' && classifyNewsTextStance(i.title) === 'bear');
  if (earningsBull.length > earningsBear.length + 3) riskSignals.push({ type: 'earnings', level: 'positive', label: '실적 시즌 긍정적', impact: 8 });
  else if (earningsBear.length > earningsBull.length + 3) riskSignals.push({ type: 'earnings', level: 'negative', label: '실적 시즌 부진', impact: -8 });

  return Object.freeze(riskSignals.map((signal) => Object.freeze(signal)));
}
