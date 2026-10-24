// P1467 (review 2026-10-04, "동종 기업 비교"): one company's growth, margin, cash and capital
// efficiency only mean something next to companies doing similar business. Peers are the screener
// universe's issuers in the same sector that file with the SEC; each metric is computed the same way
// for every issuer from its own latest fiscal year (and the year before), and the company is placed
// by percentile among peers whose latest fiscal year ended within a year of its own.
import { finiteFact, isPriorAnnualPeriod } from './period.js';
import { isLendingFinancial } from './fiscal-read.js';
const finite = finiteFact;

export const PEER_METRICS = Object.freeze([
  { id: 'growth', label: '매출 성장', unit: '%', higherIs: 'better' },
  { id: 'margin', label: '순이익률', unit: '%', higherIs: 'better' },
  { id: 'fcfMargin', label: '잉여현금 마진', unit: '%', higherIs: 'better' },
  { id: 'roe', label: 'ROE(평균 자기자본)', unit: '%', higherIs: 'better' }
]);

// Metrics from one issuer's fiscal series (oldest → newest, USD).
export function fiscalMetrics(series = []) {
  const source = Array.isArray(series) ? series : [];
  if (source.some((year,index) => index && String(year?.periodEnd) <= String(source[index-1]?.periodEnd))) return null; // P1627: a corrupt period sequence cannot turn a stale row into a newer filing.
  const years = source.filter((year) => finite(year?.revenue) > 0)
    .sort((a, b) => String(a.periodEnd).localeCompare(String(b.periodEnd)));
  const latest = years[years.length - 1];
  const prior = years[years.length - 2];
  if (!latest) return null;
  const ni = finite(latest.netIncome);
  const ocf = finite(latest.operatingCashFlow);
  const capex = finite(latest.capex);
  const annualPair = isPriorAnnualPeriod(latest, prior);
  const avgEquity = annualPair && finite(latest.equity) > 0 && finite(prior?.equity) > 0 ? (latest.equity + prior.equity) / 2 : null;
  return {
    periodEnd: latest.periodEnd || null,
    // P1627: the precise same-FY annual receipt outranks a ratio from legacy rounded millions.
    growth: annualPair ? finite(latest.verifiedRevGrowth) ?? (latest.revenue / prior.revenue - 1) * 100 : null,
    margin: ni != null ? ni / latest.revenue * 100 : null,
    fcfMargin: ocf != null && capex != null ? (ocf - capex) / latest.revenue * 100 : null,
    roe: avgEquity && ni != null ? ni / avgEquity * 100 : null
  };
}

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// Share of peers the company is above (ties count half), 0–100.
const percentileAmong = (value, values) => {
  if (!values.length) return null;
  const below = values.filter((v) => v < value).length;
  const equal = values.filter((v) => v === value).length;
  return (below + equal * 0.5) / values.length * 100;
};

const monthsApart = (a, b) => {
  const ta = Date.parse(a || '');
  const tb = Date.parse(b || '');
  return Number.isFinite(ta) && Number.isFinite(tb) ? Math.abs(ta - tb) / (30.44 * 86400000) : null;
};

export function buildPeerRead({ symbol, sector = null, seriesFor = () => null, peers = [], minPeers = 5 } = {}) {
  const own = fiscalMetrics(seriesFor(symbol));
  if (!own || !sector) return { available: false, reason: !sector ? 'sector-unknown' : 'own-series-missing' };
  // P1627: banks' operating cash flows include deposit/loan/trading asset changes.
  // OCF minus capex remains an arithmetic fact, but it is not an industrial FCF
  // margin and cannot supply a higher-is-better financial-sector percentile.
  const financial = isLendingFinancial(symbol, sector); // v57.84: one lending-financial rule (Visa is not a bank)
  const peerMetrics = (peers || [])
    .filter((peer) => peer && peer !== symbol)
    .map((peer) => ({ symbol: peer, metrics: fiscalMetrics(seriesFor(peer)) }))
    .filter((peer) => peer.metrics && (monthsApart(peer.metrics.periodEnd, own.periodEnd) ?? 99) <= 12);
  if (peerMetrics.length < minPeers) return { available: false, reason: 'too-few-peers', peers: peerMetrics.length };
  const rows = PEER_METRICS.map((metric) => {
    const value = finite(own[metric.id]);
    if (financial && metric.id === 'fcfMargin') return { ...metric, label: '잉여현금 마진(금융사 비교 보류)', higherIs: null,
      value, median: null, percentile: null, n: 0, reason: 'financial-cash-flow-not-comparable' };
    // v57.92: the same rule applies to the peer side — a card network's FCF margin was ranked against five banks' OCF−capex
    // (0th percentile) while the bank itself was held. Lending peers drop out of the FCF comparison set, so n shrinks.
    const values = peerMetrics.filter((peer) => metric.id !== 'fcfMargin' || !isLendingFinancial(peer.symbol, sector))
      .map((peer) => finite(peer.metrics[metric.id])).filter((v) => v != null);
    if (value == null || values.length < minPeers) return { ...metric, value, median: median(values), percentile: null, n: values.length };
    return { ...metric, value, median: median(values), percentile: percentileAmong(value, values), n: values.length };
  });
  const ranked = rows.filter((row) => row.percentile != null);
  if (!ranked.length) return { available: false, reason: 'no-comparable-metric', peers: peerMetrics.length };
  const strong = ranked.filter((row) => row.percentile >= 75).map((row) => row.label);
  const weak = ranked.filter((row) => row.percentile <= 25).map((row) => row.label);
  const parts = [strong.length ? `상위 25% 안 — ${strong.join(', ')}` : null, weak.length ? `하위 25% 안 — ${weak.join(', ')}` : null].filter(Boolean);
  const summary = `같은 섹터 SEC 공시 기업 ${peerMetrics.length}곳과 비교: ${parts.length ? parts.join(' / ') : '비교한 지표 모두 중간 범위(25~75%)'}.${financial ? ' 금융사의 영업현금흐름에는 예금·대출·트레이딩 자산 변화가 섞이므로 일반 기업의 영업 FCF와 구분하고, 잉여현금 마진 순위는 보류합니다.' : ''}`;
  return { available: true, symbol, sector, peers: peerMetrics.length, rows, summary };
}
