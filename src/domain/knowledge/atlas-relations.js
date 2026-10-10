// P1471 (knowledge review 2026-10-04, 1차·2차): the industry map turned each domain's list order into
// upstream → downstream edges (GPU → ASIC → NPU, copper → lithium → rare earths, healthcare →
// manufacturing → automotive → finance) and labelled them 상류/하류. A list is not a supply chain.
// This module is the canonical, typed relation set: every edge says what kind of link it is, and
// parallel members of a domain (alternative accelerators, separate commodities, separate applications)
// are left unlinked or linked as alternatives — never as stages.

export const RELATION_TYPES = Object.freeze({
  contains: { label: '포함', directed: true, forward: '포함하는 하위 개념', backward: '속한 상위 개념' },
  // P1593 (F88/F90): component edges are authored part → whole ('NAND가 SSD의 저장 매체'), so the part's
  // page names where it goes and the whole's page lists its parts — the labels used to read the other way.
  component: { label: '구성', directed: true, forward: '이것이 들어가는 곳', backward: '구성 요소' },
  // A technology or a contract that something rests on is not a physical part of it.
  basis: { label: '바탕', directed: true, forward: '이것을 바탕으로 하는 것', backward: '바탕이 되는 기술·계약' },
  // P1592 (F67): a design attribute is not a part — precision belongs to an accelerator as a property.
  property: { label: '성능 속성', directed: true, forward: '이 속성으로 비교하는 대상', backward: '성능 속성' },
  'next-step': { label: '다음 단계', directed: true, forward: '다음 단계', backward: '앞 단계' },
  supplies: { label: '공급', directed: true, forward: '공급받는 쪽', backward: '공급하는 쪽' },
  substitute: { label: '대체·경쟁', directed: false, forward: '대체·경쟁 관계(특정 용도에서)', backward: '대체·경쟁 관계(특정 용도에서)' },
  complement: { label: '보완', directed: false, forward: '함께 필요한 것', backward: '함께 필요한 것' },
  constrains: { label: '제약', directed: true, forward: '제약하는 대상', backward: '제약 요인' },
  conditional: { label: '조건부 영향', directed: true, forward: '조건에 따라 영향을 주는 대상', backward: '조건에 따라 영향을 받는 요인' },
  measures: { label: '측정', directed: true, forward: '측정 대상', backward: '측정 지표' },
  learning: { label: '학습 순서', directed: true, forward: '이어서 배울 것', backward: '먼저 알아야 할 것' }
});

// Korean reading of the producer's cross-domain edges (its conditions are English reference notes).
const CROSS_TEXT = Object.freeze({
  'atlas-edge-cloud-compute-demand': '클라우드의 AI 수요가 가속기 수요가 됨',
  'atlas-edge-compute-memory-bandwidth': '메모리 대역폭이 가속기 가동률을 제한',
  'atlas-edge-memory-package-integration': '적층 메모리와 연산 칩을 함께 묶는 첨단 패키징이 필요',
  'atlas-edge-package-network-scale': '패키지 단위 연산이 클러스터 규모로 확장',
  'atlas-edge-network-facility-deployment': '클러스터 네트워크가 서버 플랫폼에 설치됨',
  'atlas-edge-aidc-power-load': '서버 플랫폼이 IT 전력 부하를 만듦',
  'atlas-edge-power-grid-access': '전력 부하는 계통 접속이 있어야 공급됨',
  'atlas-edge-interconnection-transformer': '계통 접속에는 변전 설비가 필요',
  'atlas-edge-power-capex': '전력 수요가 설비투자 부담으로 이어짐',
  'atlas-edge-roic-company-role': '투하자본이익률이 기업이 가치를 가져가는지 보여줌',
  'atlas-edge-compute-edge-deployment': '데이터센터와 기기 안 연산이 작업을 나눠 맡음',
  'atlas-edge-edge-physical-perception': '기기 안 NPU가 현장 인식을 가능하게 함',
  'atlas-edge-compute-world-model': '대규모 연산이 시뮬레이션·월드 모델을 가능하게 함',
  'atlas-edge-planning-defense-autonomy': '계획·제어 기술이 국방 자율 시스템의 결정 고리가 됨',
  'atlas-edge-defense-space-procurement': '국방 조달이 위성 사업 수요를 만듦',
  'atlas-edge-policy-compute-access': '수출 통제가 가속기 접근을 제한',
  'atlas-edge-revenue-quality-roic': '매출의 질이 투하자본이익률을 검증',
  'atlas-edge-uncertainty-market-expectation': '검증 전 기술은 시장 기대의 근거로 제한',
  'atlas-edge-cloud-neocloud-rental': '클라우드의 초과 수요가 GPU 임대 사업으로 넘어감',
  'atlas-edge-foundry-compute-supply': '파운드리 생산능력·수율이 가속기 공급을 정함',
  'atlas-edge-application-revenue-model': '지불자가 있는 응용이 수익 모델을 검증',
  'atlas-edge-refining-foundry-materials': '정제 공급망이 반도체 소재 공급을 받침'
});

// The producer's cross-domain edge verbs mapped onto the same vocabulary.
const CROSS_TYPE = Object.freeze({ REQUIRES: 'complement', ENABLES: 'conditional', CAUSES: 'conditional', MEASURES: 'measures', EXPOSES_TO: 'substitute', FUNDS: 'conditional', CONSTRAINS: 'constrains', EVIDENCES: 'measures' });

// What a node IS, from its kind — one consistent classification instead of mixed layer labels
// (GPU as '세부 공정', numeric precision as '제품·수익모델').
const KIND_CATEGORY = Object.freeze({
  accelerator: '기술·부품', memory: '기술·부품', storage: '기술·부품', interface: '기술·부품', network: '기술·부품', photonics: '기술·부품', hardware: '기술·부품',
  technical: '기술 속성', 'emerging-technology': '신기술(검증 전)',
  manufacturing: '제조 공정', process: '제조 공정', packaging: '제조 공정',
  equipment: '장비·소재', materials: '장비·소재',
  system: '시스템·시설', facility: '시스템·시설', thermal: '시스템·시설', engineering: '시스템·시설', energy: '시스템·시설', grid: '시스템·시설',
  metric: '측정 지표', demand: '수요', constraint: '제약 조건', risk: '위험 요인',
  'business-model': '사업·수익 구조', service: '사업·수익 구조', contract: '사업·수익 구조', 'value-chain': '사업·수익 구조', company: '사업·수익 구조', market: '시장·가격',
  economics: '재무·경제성 개념', finance: '재무·경제성 개념', accounting: '재무·경제성 개념', 'investment-framework': '분석 틀', method: '분석 틀',
  policy: '정책·제도', regulation: '정책·제도', security: '정책·제도', defense: '국방 시스템', program: '프로그램',
  application: '응용 분야', robotics: '로봇 기술', software: '소프트웨어', physics: '기초 원리'
});
export const nodeCategory = (kind) => KIND_CATEGORY[kind] || '개념';

const r = (from, to, type, text) => Object.freeze({ from, to, type, text });
export const DOMAIN_RELATIONS = Object.freeze([
  // Cloud platform
  r('cloud-hyperscaler', 'cloud-ai-service', 'contains', '하이퍼스케일러 사업 안의 관리형 AI 서비스'),
  r('cloud-ai-service', 'cloud-utilization', 'measures', '서비스 수익성은 장비 가동률·작업 구성에 달림'),
  r('cloud-commitments', 'cloud-utilization', 'conditional', '장기 약정은 가동률의 하한을 받쳐 줄 수 있음'),
  r('cloud-hyperscaler', 'cloud-depreciation', 'conditional', '설비투자가 크면 이후 감가상각비가 커짐'),
  // Neocloud
  r('neocloud-capacity-reservation', 'neocloud-gpu-rental', 'basis', '예약 계약이 임대 매출의 바탕'),
  r('neocloud-lease-burden', 'neocloud-rental-yield', 'constrains', '리스·차입 비용이 임대 수익률을 깎음'),
  r('neocloud-customer-concentration', 'neocloud-rental-yield', 'conditional', '소수 고객 의존 시 재계약 조건에 수익이 흔들림'),
  // Compute: alternative accelerators, not stages
  r('compute-gpu', 'compute-asic', 'substitute', '특정 학습·추론 작업에서 범용 GPU와 전용 가속기가 경쟁'),
  r('compute-asic', 'compute-npu', 'substitute', '데이터센터용 전용칩과 기기 안 가속기는 쓰임새가 다른 대안'),
  r('compute-precision', 'compute-gpu', 'property', '연산 정밀도(FP/BF/INT)는 가속기 성능을 비교하는 속성'),
  r('compute-interconnect', 'compute-gpu', 'complement', '여러 가속기를 묶는 연결이 있어야 큰 모델을 돌림'),
  // Memory: a hierarchy of complements
  r('memory-sram', 'memory-dram-hbm', 'complement', '칩 안 캐시와 칩 옆 메모리는 속도·용량 계층'),
  r('memory-dram-hbm', 'memory-nand', 'complement', '휘발성 작업 메모리와 비휘발성 저장의 계층'),
  r('memory-nand', 'memory-enterprise-ssd', 'component', 'NAND가 SSD의 저장 매체'),
  r('memory-cxl', 'memory-dram-hbm', 'complement', 'CXL은 메모리를 서버 사이에서 나눠 쓰는 연결 규격'),
  // Foundry: production steps and suppliers
  r('foundry-design-ecosystem', 'foundry-process-node', 'next-step', '설계(라이브러리·EDA)가 끝나야 공정에서 만든다'),
  r('foundry-equipment', 'foundry-process-node', 'supplies', '장비 회사가 공정 장비를 공급'),
  r('foundry-materials', 'foundry-process-node', 'supplies', '소재 회사가 웨이퍼·화학물질을 공급'),
  r('foundry-capacity-yield', 'foundry-process-node', 'measures', '생산능력·수율·가동률은 공정의 결과 지표'),
  // Packaging
  r('package-2-5d', 'package-3d-stacking', 'substitute', '옆으로 잇는 방식과 위로 쌓는 방식(함께 쓰기도 함)'),
  r('package-interposer', 'package-2-5d', 'component', '인터포저·브리지가 2.5D 연결의 핵심 부품'),
  r('package-substrate', 'package-2-5d', 'component', '기판이 패키지를 보드에 연결'),
  r('package-glass', 'package-substrate', 'substitute', '유리기판은 유기 기판의 대체 후보(개발 단계)'),
  // Network / photonics
  r('network-switch', 'network-optical-module', 'complement', '스위치의 전기 신호를 광모듈이 빛으로 바꿔 멀리 보냄'),
  r('network-silicon-photonics', 'network-optical-module', 'basis', '실리콘 포토닉스는 광모듈을 만드는 기술 기반의 하나'),
  r('network-cpo', 'network-optical-module', 'substitute', 'CPO는 꽂는 광모듈 대신 광 소자를 스위치 칩 옆에 두는 배치'),
  r('network-silicon-photonics', 'network-cpo', 'basis', 'CPO 구현에 실리콘 포토닉스가 쓰임'),
  r('network-fabric', 'network-switch', 'contains', '클러스터 네트워크는 스위치·광링크·토폴로지를 포함'),
  // AI data center
  r('aidc-rack-density', 'aidc-liquid-cooling', 'conditional', '랙 전력 밀도가 높아지면 공랭 대신 액체 냉각이 필요해짐'),
  r('aidc-thermal-design', 'aidc-liquid-cooling', 'contains', '열 설계 안에 냉각 방식 선택이 포함'),
  r('aidc-server-platform', 'aidc-rack-density', 'conditional', '서버 구성이 랙당 전력을 정함'),
  r('aidc-pue', 'aidc-thermal-design', 'measures', 'PUE는 시설 전체 에너지 효율 지표'),
  // Power
  r('power-it-load', 'power-generation', 'conditional', '부하 증가가 발전·전력 계약 수요를 만듦'),
  r('power-generation', 'power-transmission', 'next-step', '발전된 전력은 송전·변전을 거쳐 부하에 도달'),
  r('power-interconnection', 'power-transmission', 'constrains', '계통 접속 대기·허가가 연결 시점을 늦춤'),
  r('power-transformer', 'power-transmission', 'component', '변압기·스위치기어가 변전 설비의 핵심'),
  // Edge / physical AI
  r('edge-memory-power', 'edge-soc-npu', 'constrains', '기기 안 메모리·배터리가 돌릴 수 있는 모델 크기를 제한'),
  r('physical-ai-sensing', 'physical-ai-control', 'next-step', '인식 결과가 제어 명령의 입력'),
  r('physical-ai-digital-twin', 'physical-ai-control', 'complement', '가상 시험이 실제 제어를 보완'),
  // AI economics: accounting and calculation links
  r('economics-capex', 'economics-depreciation', 'conditional', '설비투자는 이후 기간에 감가상각비로 나뉘어 비용이 됨'),
  r('economics-revenue-model', 'economics-fcf', 'learning', '매출 구조를 알아야 영업현금흐름을 읽음'),
  r('economics-capex', 'economics-fcf', 'conditional', '설비투자는 잉여현금흐름에서 빠짐(차입은 별도 자금조달 흐름)'),
  r('economics-fcf', 'economics-roic', 'learning', '현금흐름 다음에 투하자본 대비 수익률을 봄'),
  // Robotics: processing order of one control loop
  r('physical-ai-perception', 'physical-ai-world-model', 'next-step', '감지 → 상태 예측'),
  r('physical-ai-world-model', 'physical-ai-planning', 'next-step', '예측 → 행동 계획'),
  r('physical-ai-planning', 'physical-ai-actuation', 'next-step', '계획 → 실제 구동'),
  r('physical-ai-unit-economics', 'physical-ai-actuation', 'measures', '단위경제성은 장비 한 대의 작업 가치와 비용'),
  // Defense
  r('defense-c2-isr-ew', 'defense-kill-chain', 'component', '지휘통제·정찰·전자전이 탐지→결정 고리를 이룸'),
  r('defense-autonomy', 'defense-kill-chain', 'conditional', '자율성 범위와 사람 승인 규칙이 결정 단계를 바꿈'),
  r('defense-procurement-economics', 'defense-drone-production', 'conditional', '조달 예산·계약이 생산 규모를 정함'),
  // Space
  r('space-rocket-physics', 'space-reusability', 'learning', '발사 물리를 알아야 재사용 경제성을 읽음'),
  r('space-reusability', 'space-satellite-economics', 'conditional', '발사 단가가 낮아지면 위성 사업의 비용이 줄 수 있음'),
  r('space-artemis-architecture', 'space-aircraft-supply-chain', 'conditional', '대형 프로그램 일정이 공급망 수요를 만듦'),
  // Applications: parallel fields, each read through the same payer/ROI frame
  r('application-healthcare', 'application-roi-payer', 'learning', '의료 AI도 누가 돈을 내는지(지불자)로 검증'),
  r('application-manufacturing', 'application-roi-payer', 'learning', '제조 AI의 가치는 수율·가동률 개선과 도입 비용의 비교'),
  r('application-automotive', 'application-roi-payer', 'learning', '자율주행의 가치는 안전 검증·책임·지불 구조와 함께'),
  r('application-finance', 'application-roi-payer', 'learning', '금융 AI의 가치는 손실 감소·처리비용과 규제 비용의 비교'),
  // Resources: separate commodities, each through refining
  r('resources-refining', 'resources-copper', 'supplies', '채굴·정련을 거쳐 전선·전력망용 구리가 공급'),
  r('resources-refining', 'resources-lithium', 'supplies', '정제 공정을 거쳐 배터리용 리튬이 공급'),
  r('resources-refining', 'resources-rare-earths', 'supplies', '분리·정제를 거쳐 자석용 희토류가 공급'),
  r('resources-industrial-equipment', 'resources-refining', 'constrains', '설비·장비 리드타임이 증설 속도를 제한'),
  // Policy
  r('policy-supply-chain-resilience', 'policy-semiconductor-incentives', 'conditional', '공급망 자립 목표가 보조금 정책을 만듦'),
  r('policy-national-security-risk', 'policy-export-controls', 'conditional', '안보 판단이 수출 통제 범위를 정함'),
  r('policy-cybersecurity', 'policy-national-security-risk', 'component', '사이버 보안은 안보 위험의 한 축'),
  // Capital-markets map: analysis order, not a supply chain
  r('capital-company-role', 'capital-revenue-quality', 'learning', '역할 → 매출의 질'),
  r('capital-revenue-quality', 'capital-margin-structure', 'learning', '매출 → 마진 구조'),
  r('capital-margin-structure', 'capital-balance-sheet', 'learning', '마진 → 재무구조·자금조달'),
  r('capital-balance-sheet', 'capital-market-expectation', 'learning', '재무 → 가격에 반영된 기대'),
  // Adjacent future tech: parallel candidates, each through the uncertainty gate
  r('future-uncertainty-gate', 'future-quantum', 'measures', '검증 전 기술은 같은 불확실성 기준으로 평가'),
  r('future-uncertainty-gate', 'future-photonic-compute', 'measures', '광 컴퓨팅(빛으로 계산)은 광통신과 다른 영역'),
  r('future-uncertainty-gate', 'future-neuromorphic', 'measures', '같은 불확실성 기준'),
  r('future-uncertainty-gate', 'future-new-energy', 'measures', '같은 불확실성 기준')
]);

// Typed neighbours of every node: canonical domain relations plus the producer's typed cross-domain
// edges. The producer's per-domain list order (domainChains) and its derived upstream/downstream
// fields are deliberately ignored.
export function typedRelations(taxonomyCoverage, titleOf = (id) => id) {
  const nodes = taxonomyCoverage?.nodes || [];
  const ids = new Set(nodes.map((node) => node.nodeId));
  const edges = [...DOMAIN_RELATIONS];
  for (const edge of taxonomyCoverage?.relationshipModel?.crossDomainEdges || []) {
    const type = CROSS_TYPE[edge.type] || 'conditional';
    edges.push({ from: edge.from, to: edge.to, type, text: CROSS_TEXT[edge.id] || '' });
  }
  const byNode = new Map(nodes.map((node) => [node.nodeId, []]));
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to)) continue;
    const meta = RELATION_TYPES[edge.type];
    byNode.get(edge.from).push({ id: edge.to, title: titleOf(edge.to), type: edge.type, label: meta.forward, text: edge.text });
    byNode.get(edge.to).push({ id: edge.from, title: titleOf(edge.from), type: edge.type, label: meta.backward, text: edge.text });
  }
  return byNode;
}

// Grouped for display: "구성 요소: A · B / 함께 필요한 것: C".
export function relationGroups(neighbours = []) {
  const groups = new Map();
  for (const item of neighbours) {
    const key = `${item.type}:${item.label}`;
    if (!groups.has(key)) groups.set(key, { type: item.type, label: item.label, items: [] });
    if (!groups.get(key).items.some((existing) => existing.id === item.id)) groups.get(key).items.push(item);
  }
  return [...groups.values()];
}
