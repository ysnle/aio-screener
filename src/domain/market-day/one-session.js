import { buildCloseSeries, closeSessionMarket, sessionPointBack } from '../market/close-series.js';

// v59.70 (screen re-review 7·8): a published day move spans one session. A ledger written before the producer's own
// rule (facts.js priceFacts) still carries WTI -7.7% and 나스닥100 -0.7% for 11/3, steps over a carried 11/2 close; the
// close history the 오늘 cards and the 브리핑 table read has no 11/2 close for them, so the fact goes with it.
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
