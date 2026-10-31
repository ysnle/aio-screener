import { finiteNumber as finite } from '../shared/number.js';
/**
 * Decades of context for a few macro gauges (live review 4f, 2026-10-14).
 *
 * Reads public-data/macro-long-history.json (monthly FRED means since 1990) and says where the latest month sits in
 * that history: its percentile among all months, and the period's high and low with their months. It describes a
 * level against the past — not a direction, a signal or a forecast.
 */

// Expert review 2026-10-14: these are monthly means of daily observations, so the artifact's own calendar month is still
// in progress (a partial mean). That month is left out and the card names the completed month it compares.
const DAILY_MEANS = new Set(['dgs10', 'dgs2', 't10y3m', 'realYield10', 'vix']);

export const LONG_HISTORY_ORDER = Object.freeze(['fedFunds', 'dgs10', 'dgs2', 't10y3m', 'realYield10', 'coreCpiYoY', 'unemployment', 'vix']);

function monthLabel(month) {
  const [year, mm] = String(month || '').split('-');
  return year && mm ? `${year}년 ${Number(mm)}월` : '';
}

export function longHistoryRows(artifact) {
  const series = artifact?.series || {};
  const monthOf = (at) => (/^\d{4}-\d{2}/.test(String(at || '')) ? String(at).slice(0, 7) : null);
  return LONG_HISTORY_ORDER.map((field) => {
    const entry = series[field];
    const all = (Array.isArray(entry?.observations) ? entry.observations : [])
      .map(([month, value]) => ({ month: String(month || ''), value: finite(value) }))
      .filter((point) => /^\d{4}-\d{2}$/.test(point.month) && point.value != null);
    // v59.45 (P18-LONG-01): the open month is the month this series was fetched, not the artifact's date — a retained
    // (stale) series keeps its mid-month mean while generatedAt moves on. A stale series without its own fetch date
    // cannot show its last month was complete, so that month is left out.
    const openMonth = monthOf(entry?.fetchedAt) || (entry?.stale === true ? null : monthOf(artifact?.generatedAt));
    const unprovenLast = DAILY_MEANS.has(field) && entry?.stale === true && !monthOf(entry?.fetchedAt);
    const partial = DAILY_MEANS.has(field) && all.length && (unprovenLast || (openMonth && all[all.length - 1].month >= openMonth)) ? all[all.length - 1] : null;
    const points = partial ? all.slice(0, -1) : all;
    if (points.length < 120) return null;
    const last = points[points.length - 1];
    const below = points.filter((point) => point.value <= last.value).length;
    const max = points.reduce((best, point) => (point.value > best.value ? point : best), points[0]);
    const min = points.reduce((best, point) => (point.value < best.value ? point : best), points[0]);
    const percentile = Math.round((below / points.length) * 100);
    const unit = entry.unit === 'index' ? '' : entry.unit === 'percentage-points' ? '%p' : '%';
    const fmt = (value) => `${value.toFixed(2)}${unit}`;
    const place = percentile >= 80 ? '과거 기준 높은 편' : percentile <= 20 ? '과거 기준 낮은 편' : '과거 기준 중간쯤';
    return Object.freeze({
      field,
      label: entry.label || field,
      unit,
      stale: entry.stale === true,
      last,
      percentile,
      min,
      max,
      startMonth: points[0].month,
      series: points.map((point) => ({ date: `${point.month}-01`, value: point.value })),
      valueText: fmt(last.value),
      positionText: `${monthLabel(points[0].month)} 이후 ${points.length}개월 중 ${percentile}%가 ${monthLabel(last.month)} 값 이하, ${place}`,
      rangeText: `최고 ${fmt(max.value)}(${monthLabel(max.month)}), 최저 ${fmt(min.value)}(${monthLabel(min.month)})`,
      partialMonth: partial ? partial.month : null,
      monthText: `${monthLabel(last.month)} 월평균${partial ? `, 진행 중인 ${monthLabel(partial.month)}은 빼고 비교` : ''}`
    });
  }).filter(Boolean);
}
