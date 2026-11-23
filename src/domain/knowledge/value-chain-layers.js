export const VALUE_CHAIN_LAYERS = Object.freeze([
  Object.freeze({ n: 7, title: '애플리케이션', desc: '산업·업무 AI, 피지컬 AI, 방산·우주', domains: ['domain-ai-applications', 'domain-on-device-physical-ai', 'domain-physical-ai-robotics', 'domain-drone-defense', 'domain-space-aerospace'] }),
  Object.freeze({ n: 6, title: '모델', desc: '파운데이션 모델, 추론 서비스', domains: [], node: 'cloud-ai-service' }),
  Object.freeze({ n: 5, title: '클라우드', desc: '연산 임대, 플랫폼, 네오클라우드', domains: ['domain-cloud-platform', 'domain-neocloud-finance'] }),
  Object.freeze({ n: 4, title: '데이터센터, 전력', desc: '서버, 냉각, 전력망', domains: ['domain-aidc-cooling', 'domain-power-grid'] }),
  Object.freeze({ n: 3, title: '네트워크', desc: '스위치, 광통신', domains: ['domain-network-photonics'] }),
  Object.freeze({ n: 2, title: '반도체, 메모리', desc: 'GPU, 맞춤형 칩, HBM, SSD', domains: ['domain-compute-silicon', 'domain-memory-storage'] }),
  Object.freeze({ n: 1, title: '장비, 파운드리', desc: '공정, 노광, 패키징, 소재', domains: ['domain-foundry-equipment', 'domain-packaging-substrate', 'domain-resources-materials'] })
]);

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
