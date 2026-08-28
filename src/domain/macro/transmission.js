// Causal market-risk lens. This module exposes evidence states, never a synthetic risk score.

export const MACRO_TRANSMISSION_CHAIN = Object.freeze([
  Object.freeze({ id: 'funding-supply', label: '자금조달·공급', meaning: '국채·기업채 공급과 수요가 장기 자금비용을 움직이는 시작점', evidenceKey: 'issuance' }),
  Object.freeze({ id: 'term-premium', label: 'Term premium·장기금리', meaning: '정책금리 기대와 별개인 장기 보상·수급 압력', evidenceKey: 'termPremium' }),
  Object.freeze({ id: 'credit-capex', label: '신용·CAPEX', meaning: '높은 할인율이 기업 조달·AI CAPEX·소비 금융비용으로 전이', evidenceKey: 'credit' }),
  Object.freeze({ id: 'breadth-vol', label: '시장폭·변동성', meaning: '좁은 상승과 낮은 유동성이 가격 충격을 비선형화할 수 있음', evidenceKey: 'volatility' }),
  Object.freeze({ id: 'hedges', label: '교차자산 헤지', meaning: '금·BTC·달러가 함께 움직이는지, 아니면 전 자산 디레버리징인지 확인', evidenceKey: 'hedges' })
]);

export const MACRO_TRANSMISSION_GAPS = Object.freeze([
  Object.freeze({ id: 'termPremium', label: 'Term premium', reason: '10Y 수준만으로 term premium을 추정하지 않음', next: '공식 ACM term premium 또는 동등한 공개 시계열 연결' }),
  Object.freeze({ id: 'issuance', label: 'Treasury·기업채 공급', reason: '국채 환매·발행 및 기업채 발행을 현재 수치로 연결하지 않음', next: 'Treasury auction/buyback와 기업채 issuance artifact 연결' }),
  Object.freeze({ id: 'dealerGamma', label: 'Dealer gamma·옵션 포지셔닝', reason: 'VIX 만으로 gamma·expiry·딜러 헤지를 대체하지 않음', next: '권리·정의가 확보된 옵션 체인/포지셔닝 producer 연결' }),
  Object.freeze({ id: 'chinaCredit', label: '중국 신용·투자', reason: '중국 성장·부채 서사를 현재 지표로 승격하지 않음', next: '공식 신용·고정자산투자 계열과 관측일 연결' })
]);

function finite(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function quotePrice(quotes, symbol) {
  const quote = quotes?.[symbol];
  return finite(quote?.price ?? quote?.regularMarketPrice);
}

export function deriveMacroTransmissionEvidence({
  quotes = {},
  twoYear = null,
  tenYear = null,
  thirtyYear = null,
  hyOasBp = null,
  breadth = null,
  termPremiumBp = null,
  treasurySupply = null,
  dealerGamma = null,
  chinaCredit = null
} = {}) {
  const vix = quotePrice(quotes, '^VIX');
  const vix3m = quotePrice(quotes, '^VIX3M');
  const gold = quotePrice(quotes, 'GC=F') ?? quotePrice(quotes, 'GLD');
  const btc = quotePrice(quotes, 'BTC-USD');
  const dxy = quotePrice(quotes, 'DX-Y.NYB');
  const curveSpread = finite(twoYear) != null && finite(tenYear) != null ? finite(tenYear) - finite(twoYear) : null;
  const observed = {
    longEnd: finite(tenYear) != null || finite(thirtyYear) != null,
    termPremium: finite(termPremiumBp) != null,
    issuance: treasurySupply != null,
    credit: finite(hyOasBp) != null,
    volatility: vix != null || vix3m != null || finite(breadth) != null,
    dealerGamma: dealerGamma != null,
    chinaCredit: chinaCredit != null,
    hedges: gold != null || btc != null || dxy != null
  };
  return {
    status: observed.credit && observed.volatility ? 'partial-observed' : 'blocked-missing-evidence',
    values: { twoYear: finite(twoYear), tenYear: finite(tenYear), thirtyYear: finite(thirtyYear), curveSpread, hyOasBp: finite(hyOasBp), breadth: finite(breadth), vix, vix3m, gold, btc, dxy },
    observed,
    chain: MACRO_TRANSMISSION_CHAIN.map((item) => ({ ...item, status: observed[item.evidenceKey] ? 'observed' : 'blocked' })),
    gaps: MACRO_TRANSMISSION_GAPS.filter((item) => !observed[item.id])
  };
}
