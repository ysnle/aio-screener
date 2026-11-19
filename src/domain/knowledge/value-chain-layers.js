// The seven layers of the AI value chain (산업 지도 › AI 지도) and the one table from a company story's AI layer
// (src/domain/entity/company-story.js AI_LAYERS) to them. Both the map (src/ui/pages/atlas.js) and the 종목 개요's
// 밸류체인 안의 자리 read these, so a company sits in the same layer on both screens.
//
// The 19 domains read as seven stacked layers, from the bottom up. The grouping of domains into layers is structural (which layer a domain supplies), not a ranking or a bottleneck
// claim, so no layer is highlighted as "where the profit is". 2026-11-18: the companies of a layer come from the company
// stories' AI layer (atlas.js valueChainLayerPlayers); a layer with none says so.
export const VALUE_CHAIN_LAYERS = Object.freeze([
  Object.freeze({ n: 7, title: '애플리케이션', desc: '산업·업무 AI, 피지컬 AI, 방산·우주', domains: ['domain-ai-applications', 'domain-on-device-physical-ai', 'domain-physical-ai-robotics', 'domain-drone-defense', 'domain-space-aerospace'] }),
  Object.freeze({ n: 6, title: '모델', desc: '파운데이션 모델, 추론 서비스', domains: [], node: 'cloud-ai-service' }),
  Object.freeze({ n: 5, title: '클라우드', desc: '연산 임대, 플랫폼, 네오클라우드', domains: ['domain-cloud-platform', 'domain-neocloud-finance'] }),
  Object.freeze({ n: 4, title: '데이터센터, 전력', desc: '서버, 냉각, 전력망', domains: ['domain-aidc-cooling', 'domain-power-grid'] }),
  Object.freeze({ n: 3, title: '네트워크', desc: '스위치, 광통신', domains: ['domain-network-photonics'] }),
  Object.freeze({ n: 2, title: '반도체, 메모리', desc: 'GPU, 맞춤형 칩, HBM, SSD', domains: ['domain-compute-silicon', 'domain-memory-storage'] }),
  Object.freeze({ n: 1, title: '장비, 파운드리', desc: '공정, 노광, 패키징, 소재', domains: ['domain-foundry-equipment', 'domain-packaging-substrate', 'domain-resources-materials'] })
]);

// 2026-11-18: the story layers that sit in a layer. The last three story layers are users of AI, not suppliers, and sit in
// no layer. scripts/ci-atlas-contract-check.mjs fails when a story layer is in neither list.
export const PROFILE_LAYER_TO_ATLAS = Object.freeze({
  'software-applications': 7, devices: 7, 'models-platforms': 6, 'cloud-infrastructure': 5,
  'power-energy': 4, 'cooling-electrical': 4, 'data-center-real-estate': 4, networking: 3,
  'chips-compute': 2, memory: 2, 'semicap-foundry': 1
});
export const PROFILE_LAYERS_OUTSIDE_ATLAS = Object.freeze(['ai-adopter', 'ai-exposed', 'limited']);

/** The map layer ({ n, title, desc }) of a story layer id, or null when the story layer sits in none. */
export function atlasLayerOf(profileLayer) {
  const n = PROFILE_LAYER_TO_ATLAS[profileLayer];
  return n == null ? null : VALUE_CHAIN_LAYERS.find((layer) => layer.n === n) || null;
}
