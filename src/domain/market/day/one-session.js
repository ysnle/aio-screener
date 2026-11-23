import { buildCloseSeries, closeSessionMarket, sessionPointBack } from '../session/close-series.js';

export function oneSessionDay(day, history) {
  if (!Array.isArray(day?.facts) || !Array.isArray(history) || !history.length) return day;
  const gap = new Set(day.facts.filter((fact) => {
    if (fact.kind !== 'price' || !fact.asset || !fact.date) return false;
    const series = buildCloseSeries(history, fact.asset, { through: fact.date });
    return series.at(-1)?.date === fact.date && !sessionPointBack(series, 1, closeSessionMarket(fact.asset) || 'US');
  }).map((fact) => fact.id));
  if (!gap.size) return day;
  return { ...day, facts: day.facts.filter((fact) => !gap.has(fact.id)), links: (day.links || []).filter((link) => !gap.has(link.from) && !gap.has(link.to)) };
}
