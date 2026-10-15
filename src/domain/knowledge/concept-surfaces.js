// Which surfaces explain each canonical concept (industry-map nodes and analysis notes). Shared by the
// search index builder and the research pages' 연결 column.
export const CONCEPT_SURFACES = Object.freeze({
  hbm: ['atlas:memory-dram-hbm', 'frame:memory-optics'],
  'bandwidth-vs-capacity': ['atlas:memory-dram-hbm', 'frame:memory-optics'],
  'optical-interconnect': ['atlas:network-optical-module', 'frame:memory-optics'],
  'silicon-photonics': ['atlas:network-silicon-photonics', 'frame:memory-optics'],
  cpo: ['atlas:network-cpo', 'frame:memory-optics'],
  'photonic-compute': ['atlas:future-photonic-compute'],
  roic: ['atlas:economics-roic', 'frame:capex-roic'],
  capex: ['atlas:economics-capex', 'frame:capex-roic'],
  depreciation: ['atlas:economics-depreciation', 'frame:capex-roic'],
  'fcf-vs-funding': ['atlas:economics-fcf', 'frame:three-statements'],
  yield: ['atlas:foundry-capacity-yield', 'frame:semi-process'],
  'front-back-end': ['atlas:foundry-process-node', 'frame:semi-process'],
  pue: ['atlas:aidc-pue'],
  'term-premium': ['frame:long-bond'],
  'credit-creation': ['frame:credit-money'],
  nim: ['frame:bank'], 'combined-ratio': ['frame:insurance'], 'loss-ratio': ['frame:insurance'],
  'cap-rate': ['frame:reit'], ffo: ['frame:reit'], noi: ['frame:reit'],
  'clinical-phases': ['frame:biotech'], 'crack-spread': ['frame:energy'], retention: ['frame:software'],
  'gmv-vs-revenue': ['frame:software'], 'price-volume-mix': ['frame:consumer'], 'freight-capacity': ['frame:transport'],
  'stocks-to-use': ['frame:agri'], 'fx-revenue-cost': ['frame:fx-exporters'], 'arith-vs-geo': ['frame:geo-mean'],
  'nominal-real-relative': ['frame:real-relative'], 'working-capital': ['frame:three-statements'], elasticity: ['frame:elasticity'],
  // v57.50 I18: `route:<routeId>` is the analysis screen that measures the concept today. Canonical concepts gain
  // their screen; the market indicators below are glossary terms (not CONCEPT_CORE entries) whose search keys are
  // listed in SCREEN_TERMS. The search index builder ignores route: surfaces (no index entry has that id).
  'term-premium': ['frame:long-bond', 'route:fxbond'],
  'policy-vs-long-rate': ['route:fxbond'],
  'fx-return-for-foreigners': ['route:macro'],
  'hy-spread': ['route:sentiment'],
  vix: ['route:sentiment'],
  'fear-greed': ['route:sentiment'],
  'put-call': ['route:sentiment'],
  aaii: ['route:sentiment'],
  rsi: ['route:technical'],
  macd: ['route:technical'],
  'moving-average': ['route:technical'],
  breadth: ['route:breadth'],
  'yield-curve': ['route:fxbond'],
  'real-rate': ['route:fxbond'],
  'net-liquidity': ['route:macro'],
  'market-regime': ['route:signal']
});

// v57.50 I18: search keys for the screen-measured terms above that have no CONCEPT_CORE entry. Keys are glossary
// term spellings (js/aio-glossary.js) so a glossary search for the term also offers the screen that shows it.
export const SCREEN_TERMS = Object.freeze({
  'hy-spread': Object.freeze(['하이일드 스프레드', 'HY 스프레드', 'OAS', '신용스프레드', '신용 스프레드', 'high yield']),
  vix: Object.freeze(['VIX', '공포지수', '변동성 지수', 'VIX3M', '기간 구조']),
  'fear-greed': Object.freeze(['Fear & Greed', '공포 탐욕', '공포·탐욕', '공포탐욕']),
  'put-call': Object.freeze(['Put/Call', '풋콜', '풋/콜', 'put call']),
  aaii: Object.freeze(['AAII', '개인투자자 설문']),
  rsi: Object.freeze(['RSI', '상대강도지수']),
  macd: Object.freeze(['MACD']),
  'moving-average': Object.freeze(['이동평균', '이동평균선', '50일선', '200일선', '골든크로스', '데드크로스']),
  breadth: Object.freeze(['시장 폭', '시장폭', 'Breadth', 'Advance-Decline', '등락주선', 'McClellan']),
  'yield-curve': Object.freeze(['수익률 곡선', 'Yield Curve', '장단기 금리차', 'Term Spread']),
  'real-rate': Object.freeze(['실질금리', 'TIPS', 'BEI', '기대인플레이션']),
  'net-liquidity': Object.freeze(['순유동성', '연준 대차대조표', '역RP', 'Reverse Repo', 'TGA']),
  'market-regime': Object.freeze(['마켓 레짐', 'Market Regime', '시장 국면', '시장 국면(Market Regime · 레짐)'])
});

export const SCREEN_ROUTE_LABELS = Object.freeze({ sentiment: '투자 심리', technical: '종목 · 차트', breadth: '시장 폭', fxbond: '금리 · 환율', macro: '거시 경제', signal: '시장 상태' });

// conceptId → screen route ids ('route:<id>' surfaces).
export function screenRoutesFor(conceptId) {
  return (CONCEPT_SURFACES[conceptId] || []).filter((surface) => surface.startsWith('route:')).map((surface) => surface.slice('route:'.length));
}

// Inverse: surface id (e.g. 'atlas:memory-dram-hbm', 'frame:memory-optics') → concept ids.
export function conceptsForSurface(surfaceId) {
  return Object.entries(CONCEPT_SURFACES).filter(([, surfaces]) => surfaces.includes(surfaceId)).map(([conceptId]) => conceptId);
}
