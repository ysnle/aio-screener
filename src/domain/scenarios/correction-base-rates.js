// v59.70 (X bookmarks #1): how often a Nasdaq Composite correction of 7% or more went on to a bear market, counted on
// the index's own daily closes. A correction starts on the first close 7% under the prior record close and ends on
// the next record close; it is a bear market if any close in between was 20% under that record, and "fast" if the 7%
// came within 28 sessions of the record. The packet recount (Yahoo ^IXIC 1986~2026) gave 40 corrections, 8 bear markets,
// 32 fast, 4 of them bear. The counts are shown as "N번 중 N번" with this definition, never as a probability or a score.
export const CORRECTION_RULE = Object.freeze({ depthPct: 7, bearPct: 20, fastSessions: 28, since: '1986-01-01' });

/** Pure: daily closes [[date, close]] → completed and open correction episodes under CORRECTION_RULE. */
export function correctionEpisodes(closes = [], rule = CORRECTION_RULE) {
  const rows = (closes || []).filter((row) => Array.isArray(row) && Number.isFinite(row[1]) && row[1] > 0 && row[0] >= rule.since);
  const episodes = [];
  let peak = null; let open = null;
  rows.forEach(([date, close], index) => {
    if (!peak || close >= peak.close) {
      if (open) { open.recoveredDate = date; episodes.push(open); open = null; }
      peak = { date, close, index };
      return;
    }
    const depth = (close / peak.close - 1) * 100;
    if (!open && depth <= -rule.depthPct) {
      const sessions = index - peak.index;
      open = { peakDate: peak.date, peakClose: peak.close, startDate: date, sessionsToDepth: sessions, fast: sessions <= rule.fastSessions, troughDate: date, troughPct: depth, bear: false, recoveredDate: null };
    }
    if (open && depth < open.troughPct) { open.troughPct = depth; open.troughDate = date; }
    if (open && depth <= -rule.bearPct) open.bear = true;
  });
  const last = rows.at(-1);
  return { episodes, open, high: peak ? { date: peak.date, close: peak.close } : null, from: rows[0]?.[0] || null, to: last?.[0] || null };
}

/** Pure: the published base rates (the producer's `corrections` block in scenario-outcomes.json). */
export function correctionBaseRates(closes = [], rule = CORRECTION_RULE) {
  const { episodes, open, high, from, to } = correctionEpisodes(closes, rule);
  if (episodes.length < 10) return null;
  const fast = episodes.filter((episode) => episode.fast);
  const round = (value) => Math.round(value * 10) / 10;
  return {
    symbol: '^IXIC', rule: { ...rule }, from, to, high,
    n: episodes.length, bear: episodes.filter((episode) => episode.bear).length,
    fastN: fast.length, fastBear: fast.filter((episode) => episode.bear).length,
    bearPeaks: episodes.filter((episode) => episode.bear).map((episode) => episode.peakDate),
    // One row per completed correction, oldest first: [record date, deepest close vs record %, fast 0/1, bear 0/1].
    events: episodes.map((episode) => [episode.peakDate, round(episode.troughPct), episode.fast ? 1 : 0, episode.bear ? 1 : 0]),
    open: open ? { peakDate: open.peakDate, startDate: open.startDate, fast: open.fast, troughPct: round(open.troughPct), bear: open.bear } : null,
  };
}

/**
 * Pure: the 시장 상태 trend-row line. `rates` is the published block; `nasdaq` the latest completed close and the
 * history's own record close (the producer runs weekly, so a newer record or a fresh 7% break comes from history).
 */
export function correctionReading(rates, { close = null, closeDate = null, recordClose = null } = {}) {
  if (!rates?.n || !Number.isFinite(close)) return null;
  const high = Math.max(rates.high?.close || 0, Number.isFinite(recordClose) ? recordClose : 0);
  if (!(high > 0)) return null;
  const depth = (close / high - 1) * 100;
  const since = String(rates.from || '').slice(0, 4);
  const base = `${since}년 이후 나스닥 종합 ${rates.rule.depthPct}% 이상 조정 ${rates.n}번 중 ${rates.bear}번이 -${rates.rule.bearPct}%까지 갔습니다`;
  const fast = `${rates.rule.fastSessions}거래일 안에 -${rates.rule.depthPct}%가 된 빠른 조정은 ${rates.fastN}번 중 ${rates.fastBear}번`;
  const inCorrection = depth <= -rates.rule.depthPct;
  return {
    depth, high, closeDate, inCorrection, n: rates.n, bear: rates.bear, fastN: rates.fastN, fastBear: rates.fastBear,
    lead: `나스닥 종합 고점 대비 ${depth.toFixed(1)}%`,
    text: inCorrection ? `${base}. ${fast}.` : `${rates.rule.depthPct}% 조정 전입니다. ${base}.`,
    definition: `정의: 직전 최고 종가보다 ${rates.rule.depthPct}% 이상 낮은 종가가 나오면 조정, 다음 최고 종가까지 한 번이라도 -${rates.rule.bearPct}%면 약세장. 판정 점수에는 넣지 않습니다.`,
  };
}
