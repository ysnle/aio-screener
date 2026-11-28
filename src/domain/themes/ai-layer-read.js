// Each AI supply-chain layer (the sub-themes aiChainFlow groups) as one table row: its one-month price median, which
// way its members' earnings estimates moved over the same four weeks, how many beat their last reported quarter, and
// its PER pair (layer-valuation.js). Two rules judge the row, both from the stock page's own readings gathered per layer
// — consensusView and priceVersusRevisions (fundamental/consensus-read.js) decide each member, this module only counts:
//   - a falling layer whose estimates still rise is multiple compression; one whose estimates fall too is earnings
//     damage (2080185527014465976, 2113256617881763902, 2076646507948970180)
//   - a layer where most members beat the last quarter is confirmed by results; one whose estimates rise without that
//     majority is running on expectation (1953099384557899920, the majority is the post's line)
import { LEADER_THEMES } from '../briefing/ai-chain-flow.js';
import { consensusView, priceVersusRevisions } from '../fundamental/consensus-read.js';
import { layerValuation, LAYER_PER_MIN_MEASURED } from './layer-valuation.js';

export const AI_LAYER_RULES = Object.freeze({
  minMeasured: LAYER_PER_MIN_MEASURED, // members with a reading before a layer gets a tag (the layer PER's own floor)
  beatMajorityPct: 50, // more than half of the reporting members beat → confirmed by results
  sameCycleMonths: 2 // a quarter ending up to two months before the layer's newest is the same reporting season
});
export const AI_LAYER_WORDS = Object.freeze({
  compression: '배수 압축', damage: '이익 훼손',
  confirmed: '실적 확인', expected: '기대 선행'
});

const monthIndex = (ym) => { const [y, m] = String(ym || '').split('-').map(Number); return Number.isFinite(y) && Number.isFinite(m) ? y * 12 + m - 1 : null; };
// `hist` is newest first, `quarter-end month:actual:estimate`.
function lastQuarter(hist) {
  const [month, actual, estimate] = String(hist || '').split(';')[0].split(':');
  const a = Number(actual), e = Number(estimate);
  return monthIndex(month) != null && Number.isFinite(a) && Number.isFinite(e) ? { month, index: monthIndex(month), beat: a > e } : null;
}

/**
 * { layers: [{ id, name, ret1m, measured, revisions: { up, down, flat, measured }, tag, beats: { beat, measured, quarter },
 *   beatTag, per }], asOf } in the flow's order. `flow` is aiChainFlow(); `consensus` public-data/consensus-estimates.json.
 */
export function aiLayerRead({ themes = [], rows = [], consensus = null, flow = null, now = Date.now() } = {}) {
  const estimates = consensus?.rows && typeof consensus.rows === 'object' ? consensus.rows : null;
  const groups = flow?.groups || [];
  if (!estimates || !groups.length) return { layers: [], asOf: null };
  const bySym = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  const tickers = new Map((Array.isArray(themes) ? themes : []).filter((theme) => LEADER_THEMES.includes(theme?.id))
    .flatMap((theme) => (theme.subThemes || []).map((sub) => [`${theme.id}:${sub.name}`, [...new Set((sub.tickers || []).map((sym) => String(sym).toUpperCase()))].filter((sym) => !/\.K[SQ]$/.test(sym))])));
  const per = new Map(layerValuation({ themes, rows, consensus, now }).layers.map((layer) => [layer.id, layer]));
  let asOf = null;
  const layers = groups.map((group) => {
    const views = (tickers.get(group.id) || []).map((sym) => ({ sym, row: bySym.get(sym), view: consensusView(bySym.get(sym), estimates[sym], { now }), hist: estimates[sym]?.hist }))
      .filter((member) => member.view);
    for (const member of views) if (!asOf || member.view.asOf > asOf) asOf = member.view.asOf;
    const directions = views.filter((member) => member.view.revisionsKnown).map((member) => priceVersusRevisions(member.row, member.view).revDir);
    const revisions = { up: directions.filter((dir) => dir === 'up').length, down: directions.filter((dir) => dir === 'down').length, measured: directions.length };
    revisions.flat = revisions.measured - revisions.up - revisions.down;
    const revDir = revisions.up > revisions.down ? 'up' : revisions.down > revisions.up ? 'down' : null;
    // The layer's price direction on the same line the stock page uses, from the layer's one-month median.
    const priceDir = priceVersusRevisions({ ret1m: group.ret1m }, null).priceDir;
    const tag = revisions.measured < AI_LAYER_RULES.minMeasured || priceDir !== 'down' || !revDir ? null : revDir === 'up' ? 'compression' : 'damage';
    const quarters = views.map((member) => lastQuarter(member.hist)).filter(Boolean);
    const newest = quarters.length ? Math.max(...quarters.map((q) => q.index)) : null;
    // A member whose newest reported quarter is older than this season has not reported it yet: out of the count.
    const season = quarters.filter((q) => newest - q.index <= AI_LAYER_RULES.sameCycleMonths);
    const beats = { beat: season.filter((q) => q.beat).length, measured: season.length, quarter: quarters.find((q) => q.index === newest)?.month || null };
    const majority = beats.measured && beats.beat / beats.measured * 100 > AI_LAYER_RULES.beatMajorityPct;
    const beatTag = beats.measured < AI_LAYER_RULES.minMeasured ? null : majority ? 'confirmed' : revDir === 'up' ? 'expected' : null;
    return { id: group.id, name: group.name, ret1m: group.ret1m, measured: group.measured, priceDir, revDir, revisions, tag, beats, beatTag, per: per.get(group.id) || null };
  });
  return { layers, asOf };
}
