// v59.74 (owner 2026-11-07): the 리서치 라이브러리 산업 지도 already explains how each AI industry earns, cycles and
// misleads (public-data/atlas/industry-stories.json: a domain's lead/body/twist and its nodes'), but the stock pages never
// pointed at it. This registry joins a story's AI value-chain layer (and, for a few companies whose business is a
// different domain than their layer suggests, the symbol) to the 산업 지도 domain and the two nodes that read closest.
export const LAYER_INDUSTRY = Object.freeze({
  'power-energy': { domain: 'domain-power-grid', nodes: ['power-generation', 'power-transmission'] },
  'cooling-electrical': { domain: 'domain-aidc-cooling', nodes: ['aidc-liquid-cooling', 'power-transformer'] },
  'data-center-real-estate': { domain: 'domain-aidc-cooling', nodes: ['aidc-rack-density', 'power-interconnection'] },
  'semicap-foundry': { domain: 'domain-foundry-equipment', nodes: ['foundry-equipment', 'foundry-capacity-yield'] },
  memory: { domain: 'domain-memory-storage', nodes: ['memory-dram-hbm', 'memory-nand'] },
  'chips-compute': { domain: 'domain-compute-silicon', nodes: ['compute-gpu', 'compute-asic'] },
  networking: { domain: 'domain-network-photonics', nodes: ['network-switch', 'network-optical-module'] },
  'cloud-infrastructure': { domain: 'domain-cloud-platform', nodes: ['cloud-hyperscaler', 'cloud-depreciation'] },
  'models-platforms': { domain: 'domain-ai-economics', nodes: ['economics-revenue-model', 'economics-capex'] },
  'software-applications': { domain: 'domain-ai-applications', nodes: ['application-roi-payer', 'capital-revenue-quality'] },
  devices: { domain: 'domain-on-device-physical-ai', nodes: ['edge-soc-npu', 'edge-memory-power'] }
});

// GPU renters and former miners read as a lease-and-debt business, not a hyperscaler; aerospace and defense have their
// own domains; packaging and test houses sit in the packaging domain.
const NEOCLOUD = { domain: 'domain-neocloud-finance', nodes: ['neocloud-gpu-rental', 'neocloud-lease-burden'] };
const PACKAGING = { domain: 'domain-packaging-substrate', nodes: ['package-2-5d', 'package-substrate'] };
export const SYMBOL_INDUSTRY = Object.freeze({
  CRWV: NEOCLOUD, NBIS: NEOCLOUD, IREN: NEOCLOUD, CORZ: NEOCLOUD, APLD: NEOCLOUD, CIFR: NEOCLOUD, WULF: NEOCLOUD, HUT: NEOCLOUD, BTDR: NEOCLOUD, GLXY: NEOCLOUD,
  AMKR: PACKAGING, ASX: PACKAGING, KLIC: PACKAGING, CAMT: PACKAGING, '009150.KS': PACKAGING,
  '012450.KS': { domain: 'domain-drone-defense', nodes: ['defense-procurement-economics', 'defense-drone-production'] },
  BA: { domain: 'domain-space-aerospace', nodes: ['space-aircraft-supply-chain', 'space-reusability'] },
  GE: { domain: 'domain-space-aerospace', nodes: ['space-aircraft-supply-chain', 'space-satellite-economics'] },
  RKLB: { domain: 'domain-space-aerospace', nodes: ['space-reusability', 'space-satellite-economics'] },
  SPCX: { domain: 'domain-space-aerospace', nodes: ['space-reusability', 'space-satellite-economics'] },
  TSLA: { domain: 'domain-physical-ai-robotics', nodes: ['physical-ai-unit-economics', 'application-automotive'] },
  '005380.KS': { domain: 'domain-physical-ai-robotics', nodes: ['application-automotive', 'physical-ai-unit-economics'] }
});

/** The 산업 지도 domain and nodes for a story, or null when its business has no domain there. */
export function industryFor(story) {
  const symbol = String(story?.symbol || '').toUpperCase();
  return SYMBOL_INDUSTRY[symbol] || LAYER_INDUSTRY[story?.aiChain?.layer] || null;
}

// The order money and technology move through the AI build-out (power and buildings → tools → chips → systems →
// services → users). Technology is built left to right; the end customer's money travels right to left.
export const CHAIN_ORDER = Object.freeze(['power-energy', 'cooling-electrical', 'data-center-real-estate', 'semicap-foundry', 'memory', 'chips-compute', 'networking', 'cloud-infrastructure', 'models-platforms', 'software-applications', 'devices']);
