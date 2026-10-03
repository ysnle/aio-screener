// P1418 (owner request 2026-10-03, open-source comparison): a portfolio 점검 list in the manner of
// Ghostfolio's X-ray rules (apps/api/src/models/rules, defaults in rule-settings.ts), reimplemented on
// this screener's surface model. Only rules with a published default flag anything:
//   · single holding: the existing 10/15/25% concentration tiers (domain/portfolio/concentration.js)
//   · single currency: Ghostfolio CurrencyClusterRiskCurrentInvestment thresholdMax 0.5
//   · single account (not tracked here) and fees (no fee ledger) are reported as not measured.
// Region, asset type, sector and cash are shown as shares with no verdict — Ghostfolio's regional
// and asset-class bands are target allocations from world market-cap weights, which would be advice.
// All shares use the surface's base-currency values (P1407); a holding without a value is excluded
// and counted, never treated as zero.
import { listingCurrency, listingRegion } from './fx.js';
import { concentrationPenaltyForWeight } from './concentration.js';

export const PORTFOLIO_CHECKS_MODEL_VERSION = 'portfolio-checks.v1';
export const SINGLE_CURRENCY_MAX = 0.5;
export const SINGLE_HOLDING_TIERS = Object.freeze([10, 15, 25]);

const finite = (value) => (value == null || value === '' ? null : Number.isFinite(Number(value)) ? Number(value) : null);

function shares(entries, total) {
  const map = new Map();
  for (const [key, value] of entries) map.set(key, (map.get(key) || 0) + value);
  return [...map.entries()].map(([name, value]) => ({ name, value, pct: total > 0 ? value / total * 100 : null })).sort((a, b) => b.value - a.value);
}

/**
 * @param {{ surface: object, assetTypeOf?: (symbol:string)=>('ETF'|'주식'|null), sectorOf?: (symbol:string)=>string|null }} input
 */
export function derivePortfolioChecks({ surface = null, assetTypeOf = () => null, sectorOf = () => null } = {}) {
  const rows = Array.isArray(surface?.rows) ? surface.rows : [];
  // Shares need one unit: a currency mix without a declared rate is held, not summed.
  if (surface?.currencyState === 'mixed-without-conversion') {
    return Object.freeze({ model: PORTFOLIO_CHECKS_MODEL_VERSION, status: 'unavailable', reason: 'currency-unconverted', excluded: rows.length, checks: Object.freeze([]), breakdowns: Object.freeze({}) });
  }
  const valued = rows.filter((row) => finite(row?.value) != null && finite(row.value) > 0);
  const excluded = rows.length - valued.length;
  const invested = valued.reduce((sum, row) => sum + finite(row.value), 0);
  const cash = finite(surface?.totalAssets) != null && finite(surface?.positionValue) != null ? finite(surface.totalAssets) - finite(surface.positionValue) : null;
  if (!valued.length || !(invested > 0)) {
    return Object.freeze({ model: PORTFOLIO_CHECKS_MODEL_VERSION, status: 'unavailable', reason: rows.length ? 'no-valued-holdings' : 'no-holdings', excluded, checks: Object.freeze([]), breakdowns: Object.freeze({}) });
  }
  const symbolOf = (row) => String(row.symbol || row.ticker || '').toUpperCase();
  const currencyOf = (row) => String(row.convertedFrom || row.currency || '').toUpperCase() || listingCurrency(symbolOf(row));
  const byHolding = shares(valued.map((row) => [symbolOf(row), finite(row.value)]), invested);
  const byCurrency = shares(valued.map((row) => [currencyOf(row), finite(row.value)]), invested);
  const byRegion = shares(valued.map((row) => [listingRegion(symbolOf(row)), finite(row.value)]), invested);
  const byType = shares(valued.map((row) => [assetTypeOf(symbolOf(row)) || '미분류', finite(row.value)]), invested);
  const bySector = shares(valued.map((row) => [sectorOf(symbolOf(row)) || row.sector || '미분류', finite(row.value)]), invested);
  const top = byHolding[0];
  const topCurrency = byCurrency[0];
  const holdingTier = concentrationPenaltyForWeight(top.pct);
  const checks = [
    { id: 'single-holding', label: '한 종목 쏠림', value: `${top.name} ${top.pct.toFixed(1)}%`,
      status: top.pct > SINGLE_HOLDING_TIERS[0] ? 'attention' : 'ok',
      detail: top.pct > SINGLE_HOLDING_TIERS[2] ? '한 종목이 투자금의 25%를 넘습니다 — 이 종목 하나의 급락이 계좌 전체를 좌우할 수 있는 수준입니다.'
        : top.pct > SINGLE_HOLDING_TIERS[1] ? '한 종목이 15%를 넘습니다.' : top.pct > SINGLE_HOLDING_TIERS[0] ? '한 종목이 10%를 넘습니다.' : '가장 큰 종목도 투자금의 10% 이하입니다.',
      basis: '기준: 10% · 15% · 25% 구간(기존 쏠림 모델)', tier: holdingTier },
    { id: 'single-currency', label: '한 통화 쏠림', value: `${topCurrency.name} ${topCurrency.pct.toFixed(0)}%`,
      status: topCurrency.pct / 100 > SINGLE_CURRENCY_MAX ? (byCurrency.length === 1 ? 'info' : 'attention') : 'ok',
      detail: byCurrency.length === 1 ? `모든 종목이 ${topCurrency.name} 자산입니다 — 환율 변동이 계좌 전체에 같은 방향으로 작용합니다.`
        : topCurrency.pct / 100 > SINGLE_CURRENCY_MAX ? `${topCurrency.name} 자산이 절반을 넘습니다 — 환율 변동의 영향이 한쪽으로 쏠립니다.` : '통화가 한쪽으로 절반 이상 쏠리지 않았습니다.',
      basis: '기준: 한 통화 50% 초과(Ghostfolio 기본값)' },
    { id: 'region', label: '상장 지역 비중', value: byRegion.map((row) => `${row.name} ${row.pct.toFixed(0)}%`).join(' · '), status: 'info',
      detail: '판정하지 않는 참고 비중입니다. 세계 주식 시가총액에서 북미 비중은 약 65~69%로 쓰입니다(Ghostfolio 기본 비교 구간).', basis: '상장 시장 기준(거래소 접미사)' },
    { id: 'asset-type', label: '개별 주식 / ETF', value: byType.map((row) => `${row.name} ${row.pct.toFixed(0)}%`).join(' · '), status: 'info',
      detail: 'ETF 비중이 높을수록 개별 기업 위험은 분산되지만, 같은 지수를 겹쳐 담으면 실제 분산은 줄어듭니다.', basis: '스크리너 분류 기준' },
    { id: 'sector', label: '섹터 비중', value: bySector.slice(0, 3).map((row) => `${row.name} ${row.pct.toFixed(0)}%`).join(' · '), status: 'info',
      detail: bySector[0].pct >= 50 ? `${bySector[0].name} 섹터가 절반을 넘습니다 — 업종 전체가 함께 움직일 때 영향이 큽니다.` : '한 섹터가 절반을 넘지 않습니다.', basis: '참고(공개 기준값 없음)' },
    { id: 'cash', label: '현금 비중', value: cash != null && finite(surface.totalAssets) > 0 ? `${(cash / finite(surface.totalAssets) * 100).toFixed(0)}%` : '미입력', status: cash != null ? 'info' : 'unknown',
      detail: cash != null ? '급락 때 추가 매수 여력과 생활 비상금은 별개입니다 — 비상금은 이 계좌 밖에 따로 두는 것이 일반적입니다.' : '현금을 입력하면 투자금 대비 현금 비중이 계산됩니다.', basis: '포트폴리오 설정의 현금' },
    { id: 'fees', label: '수수료 비율', value: '측정 안 함', status: 'unknown', detail: '거래 수수료 원장이 없어 계산하지 않습니다(Ghostfolio 기준: 투자액의 1% 초과 시 주의).', basis: '원장 필요' }
  ];
  return Object.freeze({
    model: PORTFOLIO_CHECKS_MODEL_VERSION,
    status: 'current',
    currency: surface?.baseCurrency || null,
    excluded,
    invested,
    checks: Object.freeze(checks.map((check) => Object.freeze(check))),
    breakdowns: Object.freeze({ holdings: byHolding, currencies: byCurrency, regions: byRegion, types: byType, sectors: bySector })
  });
}
