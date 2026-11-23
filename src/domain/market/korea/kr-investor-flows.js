import { isoDay } from '../../shared/session-date.js';
export const KR_INVESTOR_FLOWS_SCHEMA = 'kr-investor-flows.v1';
export const KR_FLOW_TREND_SESSIONS = 20;
const STALE_AFTER_DAYS = 5; // a weekend plus a holiday; later than that the card says 지연

const MARKETS = Object.freeze([['kospi', '코스피'], ['kosdaq', '코스닥']]);
const INVESTOR_ORDER = Object.freeze([['individual', '개인'], ['foreign', '외국인'], ['institution', '기관']]);

const sum = (points) => points.reduce((s, p) => s + p.value, 0);
const kstToday = (nowMs) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(nowMs));

export function buildKrInvestorFlowView(artifact, { nowMs = Date.now(), loadState = 'loading' } = {}) {
  if (!artifact) return loadState === 'failed' ? { state: 'unavailable', reason: 'fetch-failed' } : { state: 'loading' };
  if (artifact.schemaVersion !== KR_INVESTOR_FLOWS_SCHEMA) return { state: 'unavailable', reason: 'schema' };
  if (artifact.status === 'not-collected') return { state: 'pending', reason: artifact.reason || null };
  const sourceStale = artifact.status === 'stale';
  if (artifact.status !== 'ok' && !sourceStale) return { state: 'unavailable', reason: artifact.status || 'unknown', source: artifact.source || null };
  const today = kstToday(nowMs);
  const markets = [];
  for (const [id, label] of MARKETS) {
    const market = artifact.markets?.[id];
    if (!market?.investors) continue;
    const date = market.latestDate || null;
    const rows = []; const trends = [];
    for (const [investor, investorLabel] of INVESTOR_ORDER) {
      const series = (market.investors[investor]?.series || []).filter((p) => p && isoDay(p.date) && Number.isFinite(p.value) && p.date <= today);
      if (!series.length) continue;
      const last = series.at(-1);
      rows.push({ id: investor, label: investorLabel, value: last.date === date ? last.value : null, date: last.date });
      const recent = series.slice(-KR_FLOW_TREND_SESSIONS);
      const current = last.date === date;
      trends.push({ id: investor, label: investorLabel, points: recent, sum5: current && series.length >= 5 ? sum(series.slice(-5)) : null, sum20: current && series.length >= KR_FLOW_TREND_SESSIONS ? sum(recent) : null, sessions: recent.length });
    }
    if (!rows.length || !date) continue;
    const ageDays = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86400000);
    markets.push({ id, label, date, stale: sourceStale || ageDays > STALE_AFTER_DAYS, ageDays, rows, trends });
  }
  if (!markets.length) return { state: 'unavailable', reason: 'no-series', source: artifact.source || null };
  const published = new Set(markets.flatMap((m) => m.rows.map((r) => r.id)));
  return {
    state: 'ok',
    source: artifact.source || 'Naver Finance 투자자별 매매동향',
    sourceChip: /naver/i.test(String(artifact.sourceUrl || artifact.source || '')) ? 'Naver Finance' : '한국은행',
    sourceKind: artifact.sourceKind === 'T1_OFFICIAL' ? 'official-statistics' : 'public-delayed',
    basis: artifact.basis || null,
    allowedUse: artifact.allowedUse || null,
    sourceStale,
    generatedAt: artifact.generatedAt || null,
    unit: artifact.unit || '억원',
    markets,
    missing: INVESTOR_ORDER.filter(([id]) => !published.has(id)).map(([, label]) => label)
  };
}

/** 1,234억 / -5,678억 / 1.2조 — the size word Korean market news uses. */
export function formatEok(value) {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  const abs = Math.abs(value);
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(abs >= 100000 ? 0 : 1)}조`;
  return `${sign}${Math.round(abs).toLocaleString('en-US')}억`;
}
