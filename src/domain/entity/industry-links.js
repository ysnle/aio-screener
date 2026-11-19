// The research library's 산업 지도 (public-data/atlas/industry-stories.json) explains how each AI industry earns, cycles
// and misleads. This registry joins a company story's AI value-chain layer (and, for companies whose business is a
// different domain than their layer suggests, the symbol) to that 산업 지도 domain, so 종목 개요 can link to the reading
// instead of copying it. A company whose business has no domain there (a bank, a consumer brand) gets no link.
export const LAYER_INDUSTRY = Object.freeze({
  'power-energy': { domain: 'domain-power-grid' },
  'cooling-electrical': { domain: 'domain-aidc-cooling' },
  'data-center-real-estate': { domain: 'domain-aidc-cooling' },
  'semicap-foundry': { domain: 'domain-foundry-equipment' },
  memory: { domain: 'domain-memory-storage' },
  'chips-compute': { domain: 'domain-compute-silicon' },
  networking: { domain: 'domain-network-photonics' },
  'cloud-infrastructure': { domain: 'domain-cloud-platform' },
  'models-platforms': { domain: 'domain-ai-economics' },
  'software-applications': { domain: 'domain-ai-applications' },
  devices: { domain: 'domain-on-device-physical-ai' }
});

// GPU renters and former miners read as a lease-and-debt business, not a hyperscaler; aerospace and defense have their
// own domains; packaging and test houses sit in the packaging domain.
const NEOCLOUD = { domain: 'domain-neocloud-finance' };
const PACKAGING = { domain: 'domain-packaging-substrate' };
export const SYMBOL_INDUSTRY = Object.freeze({
  CRWV: NEOCLOUD, NBIS: NEOCLOUD, IREN: NEOCLOUD, CORZ: NEOCLOUD, APLD: NEOCLOUD, CIFR: NEOCLOUD, WULF: NEOCLOUD, HUT: NEOCLOUD, BTDR: NEOCLOUD, GLXY: NEOCLOUD,
  AMKR: PACKAGING, ASX: PACKAGING, KLIC: PACKAGING, CAMT: PACKAGING, '009150.KS': PACKAGING,
  '012450.KS': { domain: 'domain-drone-defense' },
  BA: { domain: 'domain-space-aerospace' }, GE: { domain: 'domain-space-aerospace' }, RKLB: { domain: 'domain-space-aerospace' }, SPCX: { domain: 'domain-space-aerospace' },
  TSLA: { domain: 'domain-physical-ai-robotics' }, '005380.KS': { domain: 'domain-physical-ai-robotics' }
});

/** The 산업 지도 domain for a company story, or null when its business has no domain there. */
export function industryFor(story) {
  const symbol = String(story?.symbol || '').toUpperCase();
  return SYMBOL_INDUSTRY[symbol] || LAYER_INDUSTRY[story?.aiChain?.layer] || null;
}
