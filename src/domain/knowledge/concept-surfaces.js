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
  'nominal-real-relative': ['frame:real-relative'], 'working-capital': ['frame:three-statements'], elasticity: ['frame:elasticity']
});

// Inverse: surface id (e.g. 'atlas:memory-dram-hbm', 'frame:memory-optics') → concept ids.
export function conceptsForSurface(surfaceId) {
  return Object.entries(CONCEPT_SURFACES).filter(([, surfaces]) => surfaces.includes(surfaceId)).map(([conceptId]) => conceptId);
}
