// v58.80 (owner 2026-10-25, ETF look-through stage 1): holdings in S&P 500 trackers expanded into the index members with
// the published weights (public-data/sp500-weights.json, IVV holdings), then merged with the stocks held directly, so the
// 읽는 법 cards show the overlap (NVDA held directly and through SPY) and the real single-name and sector concentration.
// Other ETFs (QQQ, sector funds) stay one line each: their holdings need issuer files (stage 2, an owner decision).
import { normalizeSectorKey } from '../screener/sector-label.js';

export const SP500_TRACKERS = Object.freeze(['SPY', 'VOO', 'IVV', 'SPLG']);
// One company, two listed classes in the index (GOOGL 2.9% + GOOG 2.3% is one Alphabet line).
const SHARE_CLASS = Object.freeze({ GOOG: 'GOOGL', FOX: 'FOXA', NWS: 'NWSA' });
const keyOf = (symbol) => { const sym = String(symbol || '').toUpperCase().replace(/\./g, '-'); return SHARE_CLASS[sym] || sym; };

// rows: valued holdings { symbol, value, sector } in one currency; isBond: bond ETFs stay out of the stock part (the
// sector card's denominator) but count as one line in the effective number of holdings, as before.
// unpriced: tracker symbols held without a value, named on the card instead of being expanded.
export function lookThrough({ rows = [], sp500 = null, isBond = () => false, unpriced = [] } = {}) {
  const members = Array.isArray(sp500?.rows) ? sp500.rows.filter((row) => Number(row?.weight) > 0) : [];
  const valued = rows.filter((row) => Number(row?.value) > 0);
  const trackers = valued.filter((row) => SP500_TRACKERS.includes(String(row.symbol || '').toUpperCase()));
  if (!members.length || !trackers.length) return { available: false };
  const weightSum = Number(sp500.totalWeight) > 0 ? Number(sp500.totalWeight) : members.reduce((sum, row) => sum + Number(row.weight), 0);
  const lines = new Map();
  // v59.45 (PASS22 P22-LOOKTHROUGH-01): the first add fixed the sector, so NVDA held directly with no sector before SPY
  // read Unclassified and after SPY read Technology. A known sector fills an unknown one, and the index file's GICS
  // sector wins over the holding row's on a conflict, so the input order no longer changes the sector card.
  const add = (symbol, part, value, sector, etf = null) => {
    const key = keyOf(symbol);
    const known = normalizeSectorKey(sector) || null;
    const line = lines.get(key) || { symbol: key, direct: 0, via: 0, sector: known || 'Unclassified', sectorFromIndex: false, etfs: [], bond: false };
    if (known && (line.sector === 'Unclassified' || (part === 'via' && !line.sectorFromIndex))) line.sector = known;
    if (known && part === 'via') line.sectorFromIndex = true;
    line[part] += value;
    if (etf && !line.etfs.includes(etf)) line.etfs.push(etf);
    lines.set(key, line);
  };
  for (const row of valued) {
    const symbol = String(row.symbol || '').toUpperCase();
    if (SP500_TRACKERS.includes(symbol)) for (const member of members) add(member.sym, 'via', Number(row.value) * Number(member.weight) / weightSum, member.sector, symbol);
    else { add(symbol, 'direct', Number(row.value), row.sector); if (isBond(symbol)) lines.get(keyOf(symbol)).bond = true; }
  }
  const all = [...lines.values()].map((line) => ({ ...line, total: line.direct + line.via }));
  const total = all.reduce((sum, line) => sum + line.total, 0);
  const stock = all.filter((line) => !line.bond);
  const stockTotal = stock.reduce((sum, line) => sum + line.total, 0);
  if (!(total > 0) || !(stockTotal > 0)) return { available: false };
  const exposures = stock.map((line) => ({ ...line, pct: line.total / stockTotal * 100, directPct: line.direct / stockTotal * 100, viaPct: line.via / stockTotal * 100 }))
    .sort((a, b) => b.total - a.total);
  const sectorMap = new Map();
  for (const line of exposures) sectorMap.set(line.sector, (sectorMap.get(line.sector) || 0) + line.pct);
  return {
    available: true,
    trackers: trackers.map((row) => String(row.symbol).toUpperCase()),
    unpriced: unpriced.map((symbol) => String(symbol).toUpperCase()).filter((symbol) => SP500_TRACKERS.includes(symbol)),
    asOf: sp500.asOf || null,
    effectiveN: 1 / all.reduce((sum, line) => sum + (line.total / total) ** 2, 0),
    exposures,
    // Held directly and through a tracker, the largest tracker part first: the overlap the card names.
    overlap: exposures.filter((line) => line.direct > 0 && line.via > 0).sort((a, b) => b.via - a.via),
    top10Pct: exposures.slice(0, 10).reduce((sum, line) => sum + line.pct, 0),
    sectors: [...sectorMap].map(([key, pct]) => ({ key, pct })).sort((a, b) => b.pct - a.pct)
  };
}

// The card's one sentence: the largest overlap, two more, and any tracker left unexpanded for want of a price.
export function lookThroughSentence(look, label = (line) => line.symbol) {
  if (!look?.available) return '';
  const etfs = look.trackers.join('·');
  const lead = look.overlap[0];
  const more = look.overlap.slice(1, 3).map((line) => `${label(line)} ${line.pct.toFixed(0)}%`).join(', ');
  const parts = [lead
    ? `${label(lead)}는 직접 ${lead.directPct.toFixed(1)}%에 ${lead.etfs.join('·')}를 통해 ${lead.viaPct.toFixed(1)}%가 더해져 주식 부분의 ${lead.pct.toFixed(1)}%입니다.${more ? ` 같은 식으로 ${more}.` : ''}`
    : `직접 보유와 ${etfs} 속 종목이 겹치지 않습니다. 펼친 상위 10종목이 주식 부분의 ${look.top10Pct.toFixed(0)}%입니다.`];
  if (look.unpriced.length) parts.push(`${look.unpriced.join('·')}는 가격이 없어 펼치지 않았습니다.`);
  return parts.join(' ');
}
