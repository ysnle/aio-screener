// v58.70 (owner 2026-10-23): one failing auxiliary check used to refuse the whole refresh. Of 100 refresh runs from
// 10/21 00:58Z to 10/23 01:20Z, 34 were refused at artifact validation by checks that each concern one lane: the
// intraday news count (P1982), the narrative's evidence lineage (P1977) and macro freshness markers (P1975). Quotes,
// closes, history and the snapshot were valid in those runs and stayed off the site with them.
//
// A degradable lane is a part of data.json whose failure can be contained: the lane is put back to its last
// published value (or, for a flag lane, published as-is with a notice), the quarantine is written to
// data.meta.laneQuarantine, and every other check still blocks. Checks without a lane tag never degrade.

export const DEGRADABLE_LANES = Object.freeze({
  news: Object.freeze({
    label: '뉴스 묶음',
    remedy: 'restore-previous',
    keys: Object.freeze(['news', 'newsIntraday']),
    // v58.71 (pipeline audit): the cycle identity (start, cut, label, next refresh) travels with the restored articles.
    // Keeping this run's label put yesterday's articles under "today 08:00 ~" with a 48-hour window.
    metaKeys: (key) => /^news/.test(key),
    notice: '직전 게시본의 뉴스를 보여 줍니다',
  }),
  narrative: Object.freeze({
    label: 'AI 시황 해설',
    remedy: 'restore-previous',
    keys: Object.freeze(['marketAnalysis']),
    metaKeys: (key) => /^marketAnalysis/.test(key),
    notice: '직전에 검증된 해설을 보여 줍니다',
  }),
  macro: Object.freeze({
    label: '거시 지표 신선도 표시',
    remedy: 'flag',
    keys: Object.freeze([]),
    metaKeys: () => false,
    notice: '값은 게시하되 신선도 표시를 확인하지 못했습니다',
  }),
});

const LANE_IDS = new Set(Object.keys(DEGRADABLE_LANES));

/** The quarantine entries a published meta declares, keyed by lane; unknown lanes are reported, never honoured. */
export function readLaneQuarantine(meta) {
  const lanes = new Map();
  const invalid = [];
  for (const entry of Array.isArray(meta?.laneQuarantine) ? meta.laneQuarantine : []) {
    const ok = entry && LANE_IDS.has(entry.lane) && Number.isFinite(Date.parse(entry.since || '')) && typeof entry.check === 'string' && entry.check.length > 0;
    if (ok) lanes.set(entry.lane, entry);
    else invalid.push(JSON.stringify(entry).slice(0, 160));
  }
  return { lanes, invalid };
}

/**
 * Put each failing lane back to the previous publish (or flag it) and declare it in meta.laneQuarantine.
 * `failures` is [{ lane, check }] from the artifact-semantics report; `retainNarrative(previousAnalysis)` may return the
 * retained verified reading (scripts/lib/market-analysis-validate.mjs) or null.
 */
export function applyLaneQuarantine(current, previous, failures, { nowIso = new Date().toISOString(), retainNarrative = null } = {}) {
  const next = { ...current, meta: { ...(current?.meta || {}) } };
  delete next.meta.laneQuarantine;
  const prior = readLaneQuarantine(previous?.meta).lanes;
  const byLane = new Map();
  for (const failure of failures || []) {
    if (!LANE_IDS.has(failure?.lane)) throw new Error(`LANE_QUARANTINE_UNKNOWN_LANE:${failure?.lane}`);
    if (!byLane.has(failure.lane)) byLane.set(failure.lane, []);
    byLane.get(failure.lane).push(String(failure.check || '').slice(0, 300));
  }
  const entries = [];
  for (const [lane, checks] of byLane) {
    const spec = DEGRADABLE_LANES[lane];
    let remedy = spec.remedy;
    if (remedy === 'restore-previous') {
      if (!previous) remedy = 'flag';
      else {
        for (const key of spec.keys) {
          if (key === 'marketAnalysis') {
            // v58.71 (pipeline audit): only a reading the retention rule accepts (verified, within its age) comes back;
            // an unverified or expired previous reading was being republished as "retained" with a fresh time.
            const kept = (typeof retainNarrative === 'function' && retainNarrative(previous[key])) || null;
            // The reading card labels a retained reading with its own time ('HH:MM 기준 직전 검증본', js/aio-core.js).
            next[key] = kept && !kept.retained && kept.generatedAt ? { ...kept, retained: { at: nowIso, from: kept.generatedAt, reason: 'lane-quarantine', maxAgeHours: 12 } } : kept;
          }
          else if (key in previous) next[key] = previous[key];
          else delete next[key];
        }
        for (const key of Object.keys(next.meta)) if (spec.metaKeys(key)) delete next.meta[key];
        for (const [key, value] of Object.entries(previous.meta || {})) if (spec.metaKeys(key)) next.meta[key] = value;
        if (lane === 'narrative' && next.marketAnalysis?.retained) next.meta.marketAnalysisRetained = next.marketAnalysis.retained;
      }
    }
    entries.push({
      lane,
      label: spec.label,
      remedy,
      notice: remedy === spec.remedy ? spec.notice : '직전 게시본이 없어 이번 값을 그대로 보여 줍니다',
      since: prior.get(lane)?.since || nowIso,
      at: nowIso,
      check: checks[0],
      checks: checks.length,
      // A lane held over several refreshes keeps the time of the publish its content actually came from.
      previousGeneratedAt: remedy === 'restore-previous' ? prior.get(lane)?.previousGeneratedAt || previous?.meta?.generatedAt || null : null,
    });
  }
  if (entries.length) next.meta.laneQuarantine = entries;
  return next;
}
