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

// Supplied-materials integration: keep long-duration and short-funding
// mechanisms distinct. A Treasury buyback or TGA movement is not, by itself,
// equivalent to monetary easing or a lower long yield.
export const MACRO_FUNDING_LIQUIDITY_REFERENCE = Object.freeze({
  id: 'macro-funding-liquidity-v1',
  sourceKind: 'REFERENCE',
  operationalUse: 'reference-only',
  channels: Object.freeze([
    Object.freeze({ id: 'long-duration', label: '장기 듀레이션 채널', sequence: '국채·기업채 공급/수요 → term premium·장기금리 → 신용·CAPEX·감가상각' }),
    Object.freeze({ id: 'short-funding', label: '단기 자금 채널', sequence: 'TGA·FIMA·repo·OIS·SOFR·MMF → 담보·현금 조달 → 레버리지·강제축소' }),
    Object.freeze({ id: 'communication', label: '정책 커뮤니케이션 채널', sequence: '조건부 데이터·시장 internals·자산가격 → 기대 형성 → 할인율·포지셔닝' })
  ]),
  checks: Object.freeze([
    '국채 환매는 통화발행과 동일하지 않으며 발행 만기·총공급·수요를 함께 확인합니다.',
    '정책금리 인하와 장기금리 하락은 분리해 보고 term premium·재정 공급·기업채 경쟁을 확인합니다.',
    'TGA·repo·SOFR/OIS·MMF가 연결되지 않으면 단기 유동성 스트레스의 현재 판정을 보류합니다.',
    'AI 인프라 채권·네오클라우드 재융자·데이터센터 규제는 CAPEX와 현금흐름의 확인 변수입니다.',
    '연준 발언은 단일 수치나 기계적 Taylor-rule보다 추세·복수 지표·시장 반응의 조건부 경로로 읽습니다.'
  ])
});

// 2026-08-30 supplied-material integration: rate shocks can have a short-run
// demand effect and a longer-run supply/fiscal/employment effect. Keep the
// mechanisms and release lags explicit instead of collapsing them into one
// directional macro score.
export const MACRO_LAGGED_SUPPLY_DEMAND_REFERENCE = Object.freeze({
  id: 'macro-lagged-supply-demand-v1',
  sourceKind: 'REFERENCE',
  operationalUse: 'reference-only',
  channels: Object.freeze([
    Object.freeze({ id: 'housing-demand', label: '주택 수요', horizon: '즉시~단기', checks: '모기지 금리·거래량·구매 여력·주택 가격' }),
    Object.freeze({ id: 'housing-supply', label: '주택 공급', horizon: '중기~장기', checks: '허가·착공·완공·재고·건설금융·공급 파이프라인' }),
    Object.freeze({ id: 'local-fiscal-employment', label: '지방재정·고용', horizon: '후행', checks: '재산세·지방예산·교육·지방정부 고용·세입' }),
    Object.freeze({ id: 'inflation-policy', label: '물가·정책 반응', horizon: '발표/정책 창', checks: '서비스·주거비·임금·고용·기대인플레이션·정책 커뮤니케이션' })
  ]),
  timeSeriesChecks: Object.freeze([
    '정책금리·장기금리·모기지금리는 event date와 observation period를 분리합니다.',
    '주택 수요 반응과 공급 pipeline은 같은 주기로 비교하지 않고 lead/lag를 보존합니다.',
    '주택 가격·재산세·지방정부 고용은 상관관계만으로 인과를 확정하지 않고 독립 지표를 대조합니다.',
    '다음 고용·물가 발표가 가설을 갱신하는 관찰 창이며, 예상치·실제치·수정치를 함께 기록합니다.'
  ]),
  boundary: '금리 인상이 수요를 낮추거나 공급을 줄일 수 있다는 설명은 시차가 있는 가설입니다. 현재 인플레이션·고용·정책 경로는 최신 공식 시계열 없이는 확정하지 않습니다.'
});

function finite(value) {
  if (value == null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function quotePrice(quotes, symbol) {
  const quote = quotes?.[symbol];
  return finite(quote?.price ?? quote?.regularMarketPrice);
}

function present(value) {
  return value != null && value !== '';
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
    issuance: present(treasurySupply),
    credit: finite(hyOasBp) != null,
    volatility: vix != null || vix3m != null || finite(breadth) != null,
    dealerGamma: present(dealerGamma),
    chinaCredit: present(chinaCredit),
    hedges: gold != null || btc != null || dxy != null
  };
  return Object.freeze({
    status: observed.credit && observed.volatility ? 'partial-observed' : 'blocked-missing-evidence',
    values: Object.freeze({ twoYear: finite(twoYear), tenYear: finite(tenYear), thirtyYear: finite(thirtyYear), curveSpread, hyOasBp: finite(hyOasBp), breadth: finite(breadth), vix, vix3m, gold, btc, dxy }),
    observed: Object.freeze(observed),
    chain: Object.freeze(MACRO_TRANSMISSION_CHAIN.map((item) => Object.freeze({ ...item, status: observed[item.evidenceKey] ? 'observed' : 'blocked' }))),
    gaps: Object.freeze(MACRO_TRANSMISSION_GAPS.filter((item) => !observed[item.id]))
  });
}
