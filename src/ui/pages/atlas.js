import { createResourceBag } from '../../app/lifecycle.js';

const REVIEWED_AT = '2026-08-02';
const RESEARCH_URL = './public-data/atlas/source-packets.json';
const FOUNDATIONS_URL = './public-data/atlas/foundations.json';
const FOUNDATIONS_LESSONS_URL = './public-data/atlas/foundation-lessons.json';
const DOMAIN_GUIDES_URL = './public-data/atlas/domain-guides.json';
const DOMAIN_PACKETS_URL = './public-data/atlas/domain-source-packets.json';
const DOMAIN_CLAIMS_URL = './public-data/atlas/domain-claim-ledger.json';
const TAXONOMY_COVERAGE_URL = './public-data/atlas/taxonomy-node-coverage.json';
const TELEGRAM_REFERENCE_URL = './public-data/telegram-reference-window.json';
const PLAYER_PRODUCT_URL = './public-data/atlas/player-product-registry.json';
const PLAYER_PRODUCT_CURRENTNESS_URL = './public-data/atlas/player-product-currentness.json';
const DEEP_TAXONOMY_URL = './public-data/atlas/deep-taxonomy.json';
const TELEGRAM_DISCOVERY_BOUNDARY = 'discovery only';

// The three design specs deliberately stop before source-packet completion.
// Keep this registry structural: no company metric, shipment, yield, price, or
// trading claim is promoted to the UI until an evidence ledger is reviewed.
const ATLAS_PACKETS = Object.freeze([
  Object.freeze({ id: 'ATLAS-00', title: 'Ontology · 정의 · 우선순위', scope: '공통 node·edge·knowledge class 계약', status: 'DESIGN_ONLY' }),
  Object.freeze({ id: 'ATLAS-01', title: 'P0 source packet · evidence ledger', scope: '공식 출처·claim·as-of·conflict 기록', status: 'DESIGN_ONLY' }),
  Object.freeze({ id: 'ATLAS-02', title: 'Cloud · neocloud · CAPEX/ROIC', scope: 'workload·인프라·계약·금융·KPI', status: 'DESIGN_ONLY' }),
  Object.freeze({ id: 'ATLAS-03', title: 'Memory · foundry · packaging', scope: 'HBM·공정·패키징·substrate 병목', status: 'DESIGN_ONLY' }),
  Object.freeze({ id: 'ATLAS-04', title: 'Network · photonics · CPO', scope: 'switch·optics·module·AI cluster 연결', status: 'DESIGN_ONLY' }),
  Object.freeze({ id: 'ATLAS-05', title: 'AIDC · cooling · power/grid', scope: 'rack·전력·냉각·허가·금융', status: 'DESIGN_ONLY' }),
  Object.freeze({ id: 'ATLAS-06', title: 'On-device · physical AI · robotics', scope: '모델·센서·제어·배치 경제성', status: 'DESIGN_ONLY' }),
  Object.freeze({ id: 'ATLAS-07', title: 'Drone · defense · space', scope: '임무·조달·생산·지속운영', status: 'DESIGN_ONLY' }),
  Object.freeze({ id: 'ATLAS-08', title: 'Player · product · deep links', scope: 'sector·subsector·player·product 연결', status: 'DESIGN_ONLY' }),
  Object.freeze({ id: 'ATLAS-09', title: 'Technical · finance · source QA', scope: '기술·재무·출처·수집 검증', status: 'DESIGN_ONLY' }),
  Object.freeze({ id: 'ATLAS-10', title: 'Graph edge · publication gate', scope: 'REVIEWED→PUBLISHED 승격 규칙', status: 'DESIGN_ONLY' })
]);

const FOUNDATION_TRACKS = Object.freeze([
  Object.freeze({ id: 'AI-0', title: '분류와 용어', duration: '기초', summary: 'Transformer·World Model·Agent·ASIC을 서로 다른 분류 층으로 구분합니다.', nodes: ['문제/출력', '학습 방식', '모델 구조', '서비스 시스템', '실행 하드웨어'] }),
  Object.freeze({ id: 'AI-1', title: '15분 · AI가 무엇인가', duration: '15분', summary: '규칙 기반 프로그램, 학습, parameter, training, inference, 검증을 연결합니다.', nodes: ['규칙 vs 학습', 'parameter', 'training/inference', '환각·검증'] }),
  Object.freeze({ id: 'AI-2', title: '물리 인프라', duration: '30분', summary: '벡터·병렬처리에서 GPU/ASIC·메모리·네트워크·AIDC·전력까지 이동합니다.', nodes: ['벡터/행렬', 'GPU/ASIC', 'HBM/memory wall', 'chip·package', 'AIDC·power'] }),
  Object.freeze({ id: 'AI-3', title: 'World Model · Agent', duration: '심화', summary: 'state/action/dynamics/planning과 도구·권한·검증 루프를 분리해 설명합니다.', nodes: ['state/action', 'dynamics', 'planning', 'tool use', 'human review'] }),
  Object.freeze({ id: 'AI-4', title: '경제 · 산업 · 자본', duration: '45분', summary: 'AI stack, 수익모델, 병목, CAPEX, utilization, depreciation과 반례를 연결합니다.', nodes: ['AI stack', 'unit economics', 'bottleneck', 'CAPEX/ROIC', 'counter-scenario'] }),
  Object.freeze({ id: 'AI-5', title: '시각화와 route 연결', duration: '제품화', summary: 'Tree/Graph/Path와 시장 분석·테마·기업 페이지의 경계를 정합니다.', nodes: ['Tree', 'Graph', 'Path', 'source badge', 'deep link'] }),
  Object.freeze({ id: 'AI-6', title: '검증과 접근성', duration: '품질 게이트', summary: '현재 주장·날짜·출처·키보드 탐색·읽기 순서를 출판 조건으로 둡니다.', nodes: ['claim truth', 'as-of', 'source', 'keyboard', 'review gate'] })
]);

const FOUNDATION_LAYER_DISPLAY = Object.freeze({
  F1: { title: '물리·수학·반도체의 출발점', summary: '에너지, 행렬, 확률, 병렬처리와 실리콘이 AI 계산의 물리적 바닥을 어떻게 만드는지 이해합니다.' },
  F2: { title: 'AI는 어떻게 학습하는가', summary: '규칙 기반 프로그램과 학습 시스템의 차이에서 신경망, 역전파, 일반화와 환각까지 연결합니다.' },
  F3: { title: 'Transformer와 LLM의 생애주기', summary: '문장이 토큰과 벡터가 되고 attention을 거쳐 학습·추론 서비스로 구현되는 순서를 따라갑니다.' },
  F4: { title: 'RAG·Agent·World Model', summary: '외부 기억, 도구 사용, 행동 루프와 세계 예측 모델이 실제 시스템에서 어떤 역할을 맡는지 구분합니다.' },
  F5: { title: '칩에서 데이터센터·전력망까지', summary: 'workload가 CPU·GPU·ASIC, HBM, 패키징, 네트워크, 냉각과 전력 수요로 번역되는 가치사슬입니다.' },
  F6: { title: '산업 경제성과 투자 검증', summary: '가동률·수율·CAPEX·FCF·ROIC를 통해 기술 수요가 기업 현금흐름과 자본 수익으로 이어지는지 검증합니다.' }
});

const FOUNDATION_MODULE_LABELS = Object.freeze({
  'energy-and-power': '에너지와 전력',
  'vectors-and-matrices': '벡터와 행렬',
  'probability-and-statistics': '확률과 통계',
  'parallel-processing': '병렬처리',
  'silicon-and-doping': '실리콘과 도핑',
  'bottlenecks-and-scarcity': '병목과 희소성',
  'capex-and-depreciation': 'CAPEX와 감가상각',
  'rules-vs-learning': '규칙 기반과 학습 시스템',
  'model-parameters-training': '모델·파라미터·학습',
  'data-quality': '데이터와 데이터 품질',
  'learning-types': '지도·비지도·강화학습',
  'neural-networks': '신경망',
  'forward-backpropagation': '순전파와 역전파',
  'generalization-and-memory': '일반화와 암기',
  'hallucination-and-verification': '환각과 검증',
  tokenization: '토큰화',
  'embedding-and-position': '임베딩과 위치 정보',
  'self-attention': 'Self-Attention',
  'multi-head-attention': 'Multi-Head Attention',
  'context-window': '컨텍스트 윈도우',
  'kv-cache': 'KV Cache',
  pretraining: '사전학습',
  'post-training': '후속학습',
  evaluation: '평가',
  deployment: '배포와 운영',
  'parameter-vs-external-memory': '파라미터 기억과 외부 기억',
  'retrieval-augmented-generation': 'RAG·검색 증강 생성',
  'tool-use': '도구 사용',
  'agent-loop': 'Agent 행동 루프',
  'state-action-dynamics': '상태·행동·동역학',
  'planning-and-control': '계획과 제어',
  'world-model-limitations': 'World Model의 한계',
  'workload-shape': 'AI Workload의 형태',
  'cpu-gpu-asic-npu': 'CPU·GPU·ASIC·NPU',
  'precision-and-tensor-core': '정밀도와 Tensor Core',
  'memory-wall': 'Memory Wall',
  hbm: 'HBM',
  interconnect: 'Interconnect',
  'advanced-packaging': '첨단 패키징',
  'rack-density-and-cooling': '랙 밀도와 냉각',
  'power-and-grid': '전력과 전력망',
  'unit-economics': '단위경제성',
  utilization: '가동률',
  'capacity-and-yield': '생산능력과 수율',
  'fcf-and-funding': 'FCF와 자금조달',
  'roic-and-counter-scenario': 'ROIC와 반대 시나리오',
  'claim-source-as-of': '주장·출처·기준일',
  'human-review': '사람의 검토'
});

const DOMAIN_LABELS = Object.freeze({
  'domain-cloud-platform': '클라우드·AI 플랫폼',
  'domain-neocloud-finance': '네오클라우드·GPU 금융',
  'domain-compute-silicon': 'AI 연산·주문형 반도체',
  'domain-memory-storage': '메모리·스토리지·데이터 이동',
  'domain-foundry-equipment': '파운드리·장비·소재',
  'domain-packaging-substrate': '첨단 패키징·기판',
  'domain-network-photonics': '네트워크·광학·CPO',
  'domain-aidc-cooling': 'AI 데이터센터·서버·냉각',
  'domain-power-grid': '전력·에너지·전력망',
  'domain-on-device-physical-ai': '온디바이스·Physical AI',
  'domain-ai-economics': 'AI CAPEX·ROIC·기업 재무',
  'domain-physical-ai-robotics': 'Physical AI·로보틱스·자율성',
  'domain-drone-defense': '드론·방산·자율 시스템',
  'domain-space-aerospace': '우주·항공·재사용 시스템',
  'domain-ai-applications': 'AI 응용 산업',
  'domain-resources-materials': '자원·소재·산업재',
  'domain-geopolitics-policy-security': '지정학·산업정책·보안',
  'domain-capital-markets-company-map': '자본시장·기업 지도',
  'domain-adjacent-future-tech': '인접 미래 기술'
});

const TAXONOMY_NODE_LABELS = Object.freeze({
  'cloud-hyperscaler': '하이퍼스케일러 클라우드',
  'cloud-ai-service': '관리형 AI 서비스',
  'cloud-utilization': '가동률·Workload 구성',
  'cloud-commitments': '클라우드 장기 약정',
  'cloud-depreciation': '감가상각 주기',
  'neocloud-gpu-rental': 'GPU 임대',
  'neocloud-capacity-reservation': '컴퓨트 용량 예약',
  'neocloud-lease-burden': '리스·고정비 부담',
  'neocloud-customer-concentration': '고객 집중도',
  'neocloud-rental-yield': '임대 수익률과 조달비용',
  'compute-gpu': 'GPU·범용 병렬 가속기',
  'compute-asic': 'ASIC·주문형 가속기',
  'compute-npu': 'NPU·엣지 가속기',
  'compute-precision': 'FP·BF·INT 연산 정밀도',
  'compute-interconnect': '가속기 Interconnect',
  'memory-sram': 'SRAM·Cache',
  'memory-dram-hbm': 'DRAM·HBM',
  'memory-nand': 'NAND Flash',
  'memory-enterprise-ssd': '기업·데이터센터용 SSD',
  'memory-cxl': 'CXL·메모리 Pooling',
  'foundry-design-ecosystem': 'EDA·IP·설계 생태계',
  'foundry-process-node': '미세공정 Node',
  'foundry-equipment': '반도체 공정 장비',
  'foundry-materials': '반도체 소재·화학물질',
  'foundry-capacity-yield': '생산능력·수율·가동률',
  'package-2-5d': '2.5D 패키징',
  'package-3d-stacking': '3D 적층',
  'package-interposer': 'Interposer·Bridge',
  'package-substrate': 'ABF·FC-BGA 기판',
  'package-glass': '유리기판',
  'network-switch': '스위치 반도체',
  'network-optical-module': '광학 모듈',
  'network-silicon-photonics': '실리콘 포토닉스',
  'network-cpo': 'CPO·공동 패키징 광학',
  'network-fabric': 'AI Cluster Fabric',
  'aidc-rack-density': '랙 전력 밀도',
  'aidc-liquid-cooling': '액체 냉각',
  'aidc-thermal-design': '열 설계',
  'aidc-server-platform': 'AI 서버 플랫폼',
  'aidc-pue': 'PUE·시설 에너지 효율',
  'power-it-load': '가속기 IT 부하',
  'power-generation': '발전원 구성',
  'power-transmission': '송전·변전소',
  'power-interconnection': '전력망 접속 대기열',
  'power-transformer': '변압기·Switchgear',
  'edge-soc-npu': '엣지 SoC·NPU',
  'edge-memory-power': '기기 메모리·전력 한계',
  'physical-ai-sensing': '센서·인지',
  'physical-ai-control': '제어·구동',
  'physical-ai-digital-twin': '시뮬레이션·Digital Twin',
  'economics-revenue-model': 'AI 수익모델',
  'economics-capex': 'CAPEX·리스',
  'economics-depreciation': '감가상각·내용연수',
  'economics-fcf': 'FCF·자금조달',
  'economics-roic': 'ROIC·반대 시나리오',
  'physical-ai-perception': '인지·센서 융합',
  'physical-ai-world-model': 'World Model·시뮬레이션',
  'physical-ai-planning': '계획·제어',
  'physical-ai-actuation': '구동·안전',
  'physical-ai-unit-economics': '로봇 단위경제성',
  'defense-kill-chain': '탐지→결정 작전 사슬',
  'defense-c2-isr-ew': 'C2·ISR·전자전',
  'defense-autonomy': '자율성·사람의 통제',
  'defense-drone-production': '드론 생산·소모',
  'defense-procurement-economics': '방산 조달 경제성',
  'space-rocket-physics': '로켓 물리·발사 에너지',
  'space-reusability': '로켓 재사용·Turnaround',
  'space-satellite-economics': '위성 데이터 경제성',
  'space-artemis-architecture': 'Artemis 프로그램 구조',
  'space-aircraft-supply-chain': '항공·우주 공급망',
  'application-healthcare': '의료 Workflow',
  'application-manufacturing': '제조 Workflow',
  'application-automotive': '자동차 자율주행',
  'application-finance': '금융 의사결정 Workflow',
  'application-roi-payer': '구매자·ROI·도입률',
  'resources-copper': '구리·도체',
  'resources-lithium': '리튬·저장 소재',
  'resources-rare-earths': '희토류·영구자석',
  'resources-refining': '채굴·정제·재활용',
  'resources-industrial-equipment': '산업 장비 병목',
  'policy-export-controls': '수출통제',
  'policy-supply-chain-resilience': '공급망 회복력',
  'policy-semiconductor-incentives': '반도체 보조금·인센티브',
  'policy-cybersecurity': '사이버보안·Sovereign AI',
  'policy-national-security-risk': '국가안보 위험',
  'capital-company-role': '기업 역할·가치 포착',
  'capital-revenue-quality': '매출 품질·가시성',
  'capital-margin-structure': '마진·비용 구조',
  'capital-balance-sheet': '대차대조표·자금조달',
  'capital-market-expectation': '시장 기대·주가',
  'future-quantum': '양자 컴퓨팅',
  'future-photonic-compute': '광자 컴퓨팅',
  'future-neuromorphic': '뉴로모픽 시스템',
  'future-new-energy': '차세대 에너지 시스템',
  'future-uncertainty-gate': '미래 기술 불확실성 게이트'
});

const TAXONOMY_LEVELS = Object.freeze([
  Object.freeze({ id: 'L0', label: '수요/문제', example: 'AI workload · 병목 문제' }),
  Object.freeze({ id: 'L1', label: '산업 domain', example: '반도체 · Cloud · AIDC · 전력' }),
  Object.freeze({ id: 'L2', label: 'sector', example: 'Memory · Foundry · Photonics' }),
  Object.freeze({ id: 'L3', label: 'subsector / 공정', example: 'HBM · EUV · CPO · cooling' }),
  Object.freeze({ id: 'L4', label: '제품 / 사업모델', example: 'product family · service · capacity' }),
  Object.freeze({ id: 'L5', label: 'player / 기관', example: 'role·의존성·고객·지리' }),
  Object.freeze({ id: 'L6', label: '제품·공장·프로그램·지표', example: 'as-of·status·source·KPI' })
]);

const REPRESENTATIVE_NODES = Object.freeze([
  Object.freeze({ id: 'cloud-capex', label: 'Cloud · AI CAPEX', className: '산업 구조', edge: 'CAUSES → AIDC · accelerator · 전력' }),
  Object.freeze({ id: 'memory-wall', label: 'Memory wall', className: '물리 병목', edge: 'REQUIRES → HBM · package · network' }),
  Object.freeze({ id: 'advanced-packaging', label: 'Advanced packaging', className: '공정/제품', edge: 'CONSTRAINS → yield · throughput · cost' }),
  Object.freeze({ id: 'power-grid', label: 'Power · grid', className: '인프라/정책', edge: 'REGULATES → permit · interconnection · tariff' }),
  Object.freeze({ id: 'ai-application', label: 'AI application', className: '수요/서비스', edge: 'MONETIZES → workflow · revenue · savings' }),
  Object.freeze({ id: 'capital-cycle', label: 'CAPEX · ROIC cycle', className: '경제/자본', edge: 'MEASURES → utilization · FCF · return' })
]);

function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function createReferenceSourceLinks(documentRef, sourceIds, registry) {
  const links = element(documentRef, 'div', 'atlas-reference-source-links');
  const sourceById = new Map((registry?.sources || []).map((source) => [source.id, source]));
  (sourceIds || []).forEach((sourceId) => {
    const source = sourceById.get(sourceId);
    if (!source?.url) {
      links.appendChild(element(documentRef, 'span', 'atlas-reference-source-unresolved', `${sourceId} · registry source`));
      return;
    }
    const link = element(documentRef, 'a', 'atlas-reference-source-link', `${sourceId} · ${source.publisher}`);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.dataset.atlasSourceId = sourceId;
    links.appendChild(link);
  });
  return links;
}

function mergePlayerProductCurrentness(registry, currentness) {
  if (!registry || !currentness) return registry;
  const playerById = new Map((currentness.players || []).map((item) => [item.playerId, item]));
  const productById = new Map((currentness.products || []).map((item) => [item.productId, item]));
  return {
    ...registry,
    players: (registry.players || []).map((player) => ({ ...player, ...(playerById.get(player.playerId) || {}) })),
    products: (registry.products || []).map((product) => ({ ...product, ...(productById.get(product.productId) || {}) })),
    currentness
  };
}

function actionButton(documentRef, className, text, action, value) {
  const node = element(documentRef, 'button', className, text);
  node.type = 'button';
  node.dataset.atlasAction = action;
  if (value) node.dataset.atlasValue = value;
  return node;
}

const ATLAS_STATUS_LABELS = Object.freeze({
  DESIGN_ONLY: '구조 설계 단계',
  REVIEWED_CANDIDATE: '1차 출처 확인 후보',
  PARTIAL: '일부 확인',
  PRIMARY: '공식 1차 출처',
  RECONCILED: '출처 대조 완료',
  DRAFT: '설명 초안',
  AUTHORED_REFERENCE: '학습 원고 작성 완료',
  AUTHORED_REFERENCE_CONNECTED: '학습 원고·출처 연결'
});

const ATLAS_PACKET_DISPLAY = Object.freeze({
  'ATLAS-00': { title: 'AI 산업 지도 읽는 법', scope: '노드·관계·출처·검토 상태를 읽는 공통 언어' },
  'ATLAS-01': { title: '공식 출처와 근거 원장', scope: '주장·관찰·기준일·충돌을 분리하는 검증 구조' },
  'ATLAS-02': { title: '클라우드·네오클라우드·자본', scope: 'workload·가동률·CAPEX·ROIC·금융 비용' },
  'ATLAS-03': { title: '메모리·파운드리·패키징', scope: 'HBM·공정·수율·첨단 패키징의 공급망' },
  'ATLAS-04': { title: '네트워크·포토닉스·CPO', scope: '스위치·광학 모듈·클러스터 연결' },
  'ATLAS-05': { title: '데이터센터·냉각·전력망', scope: '랙 밀도·열 설계·전력 접속·자금조달' },
  'ATLAS-06': { title: '온디바이스·Physical AI·로보틱스', scope: '센서·제어·모델·전력 제약' },
  'ATLAS-07': { title: '드론·방산·우주 시스템', scope: '임무·생산·검증·공급망의 연결' },
  'ATLAS-08': { title: '기업·제품·딥링크', scope: '산업 계층에서 기업 역할과 제품군으로 이동' },
  'ATLAS-09': { title: '기술·재무·출처 QA', scope: '기술 주장과 재무 증거를 같은 기준일로 대조' },
  'ATLAS-10': { title: '관계 공개 게이트', scope: '검토된 관계만 사용자 지도에 공개하는 규칙' }
});

const FOUNDATION_TRACK_DISPLAY = Object.freeze({
  'AI-0': { title: 'AI 분류와 공통 언어', summary: '문제·출력·학습·모델·서비스·실행 하드웨어를 구분합니다.' },
  'AI-1': { title: '15분 · AI는 어떻게 작동하는가', summary: '규칙과 학습, 파라미터, 학습·추론, 평가를 연결합니다.' },
  'AI-2': { title: '30분 · 물리적 AI 인프라', summary: '벡터·병렬처리·가속기·메모리 벽·패키지·전력까지 이동합니다.' },
  'AI-3': { title: 'World Model과 Agent', summary: '상태·행동·동역학·계획·도구 사용·사람의 검토를 나눕니다.' },
  'AI-4': { title: '45분 · 경제성·산업·자본', summary: 'AI stack·수익모델·병목·CAPEX/ROIC·반대 시나리오를 연결합니다.' },
  'AI-5': { title: '지도에서 전문 페이지로 이동', summary: 'Tree·Graph·Path와 출처 배지를 사용해 분석 경계를 확인합니다.' },
  'AI-6': { title: '검증과 공개 기준', summary: '주장·기준일·출처·접근성·검토 게이트를 공개 조건으로 사용합니다.' }
});

const TAXONOMY_LEVEL_DISPLAY = Object.freeze({
  L0: { label: '수요·문제', example: 'AI workload와 사용 사례' },
  L1: { label: '산업 영역', example: '반도체·클라우드·데이터센터·전력' },
  L2: { label: '섹터', example: '메모리·파운드리·포토닉스' },
  L3: { label: '세부 공정', example: 'HBM·EUV·CPO·냉각' },
  L4: { label: '제품·수익모델', example: '제품군·서비스·생산능력' },
  L5: { label: '기업 역할', example: '설계·제조·장비·서비스·고객' },
  L6: { label: '검증 단위', example: '기준일·상태·출처·KPI·리스크' }
});

function statusBadge(documentRef, text) {
  const badge = element(documentRef, 'span', 'atlas-status', ATLAS_STATUS_LABELS[text] || text || '확인 필요');
  badge.dataset.atlasStatus = text || '';
  return badge;
}

function createPacketCard(documentRef, packet) {
  const card = element(documentRef, 'article', 'atlas-packet-card');
  const display = ATLAS_PACKET_DISPLAY[packet.id] || packet;
  const meta = element(documentRef, 'div', 'atlas-card-meta');
  const packetLabel = element(documentRef, 'span', 'atlas-card-id', '연구 범위');
  packetLabel.dataset.atlasPacketId = packet.id;
  meta.append(packetLabel, statusBadge(documentRef, packet.status));
  const counts = packet.sourceIds?.length || packet.claimIds?.length
    ? `${packet.sourceIds?.length || 0} sources · ${packet.claimIds?.length || 0} claims`
    : '연구 packet 준비 중';
  card.append(meta, element(documentRef, 'h3', 'atlas-card-title', display.title), element(documentRef, 'p', 'atlas-card-copy', display.scope), element(documentRef, 'span', 'atlas-packet-count', counts));
  return card;
}

function createResearchView(documentRef, research, query) {
  const view = element(documentRef, 'div', 'atlas-research-view');
  const claims = (research?.claims || []).filter((claim) => !query || [claim.id, claim.title, claim.summary, claim.status, (claim.evidence || []).join(' ')].join(' ').toLowerCase().includes(query));
  const intro = element(documentRef, 'p', 'atlas-card-copy', `${research?.sources?.length || 0} official sources · ${research?.claims?.length || 0} claim packets · ${research?.nodes?.length || 0} candidate nodes`);
  const claimGrid = element(documentRef, 'div', 'atlas-claim-grid');
  claims.forEach((claim) => {
    const card = element(documentRef, 'article', 'atlas-claim-card');
    const meta = element(documentRef, 'div', 'atlas-card-meta');
    const claimLabel = element(documentRef, 'span', 'atlas-card-id', '근거 주장');
    claimLabel.dataset.atlasClaimId = claim.id;
    meta.append(claimLabel, statusBadge(documentRef, claim.status));
    const evidence = element(documentRef, 'div', 'atlas-chip-row');
    (claim.evidence || []).forEach((sourceId, index) => {
      const chip = element(documentRef, 'span', 'atlas-chip', `출처 ${index + 1}`);
      chip.dataset.atlasSourceId = sourceId;
      evidence.appendChild(chip);
    });
    card.append(meta, element(documentRef, 'h3', 'atlas-card-title', claim.title), element(documentRef, 'p', 'atlas-card-copy', claim.summary), evidence);
    if (claim.observations?.length) {
      const observations = element(documentRef, 'ul', 'atlas-observation-list');
      claim.observations.forEach((observation) => observations.appendChild(element(documentRef, 'li', '', observation)));
      card.append(observations);
    }
    claimGrid.appendChild(card);
  });
  if (!claims.length) claimGrid.appendChild(element(documentRef, 'div', 'atlas-empty', '조건에 맞는 근거 주장이 없습니다.'));

  const sourceGrid = element(documentRef, 'div', 'atlas-source-grid');
  (research?.sources || []).forEach((source) => {
    if (query && ![source.id, source.title, source.publisher, source.scope].join(' ').toLowerCase().includes(query)) return;
    const card = element(documentRef, 'article', 'atlas-source-card');
    const meta = element(documentRef, 'div', 'atlas-card-meta');
    const sourceLabel = element(documentRef, 'span', 'atlas-card-id', '1차 출처');
    sourceLabel.dataset.atlasSourceId = source.id;
    meta.append(sourceLabel, statusBadge(documentRef, source.verification === 'opened_primary_source' ? 'PRIMARY' : 'RECONCILED'));
    const link = element(documentRef, 'a', 'atlas-source-link', source.title);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    card.append(meta, link, element(documentRef, 'p', 'atlas-card-copy', `${source.publisher} · ${source.publishedAt}`), element(documentRef, 'p', 'atlas-card-copy', source.scope));
    sourceGrid.appendChild(card);
  });
  const blocked = element(documentRef, 'div', 'atlas-governance-note');
  blocked.append(element(documentRef, 'strong', '', '공개 게이트'), element(documentRef, 'p', '', research?.publication?.gate || '후보 근거는 ontology·검토 게이트를 통과하기 전까지 교육용 참고 자료로만 표시됩니다.'));
  view.append(element(documentRef, 'h2', 'atlas-section-title atlas-section-title-spaced', 'P0 evidence ledger'), intro, claimGrid, element(documentRef, 'h2', 'atlas-section-title atlas-section-title-spaced', 'Primary source registry'), sourceGrid, blocked);
  return view;
}

function createTelegramReferenceView(documentRef, telegram, query) {
  if (!telegram) return null;
  const view = element(documentRef, 'section', 'atlas-telegram-reference');
  const channels = (telegram.channels || []).filter((channel) => !query || [channel.channel, channel.status, channel.focus.join(' ')].join(' ').toLowerCase().includes(query));
  view.append(
    element(documentRef, 'h2', 'atlas-section-title atlas-section-title-spaced', 'Telegram 5일 discovery window'),
    element(documentRef, 'p', 'atlas-card-copy', `${telegram.window?.start || '—'} ~ ${telegram.window?.end || '—'} · 관측 lineage ${telegram.observedLineageCount || 0}건 · 승격된 current claim ${telegram.promotedClaims || 0}건`),
    element(documentRef, 'p', 'atlas-governance-note', telegram.boundary)
  );
  const grid = element(documentRef, 'div', 'atlas-telegram-channel-grid');
  channels.forEach((channel) => {
    const card = element(documentRef, 'article', 'atlas-telegram-channel-card');
    const link = element(documentRef, 'a', 'atlas-reference-source-link', `@${channel.channel}`);
    link.href = channel.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.dataset.atlasTelegramChannel = channel.channel;
    const channelLabel = { REFERENCE_READY: '관측 완료', SPARSE_REFERENCE: '관측 희소', STALE_FOR_WINDOW: '기간 내 신규 없음' }[channel.status] || '확인 필요';
    card.append(element(documentRef, 'div', 'atlas-card-meta', `${channelLabel} · 관측 ${channel.observedCount}건`), link, element(documentRef, 'p', 'atlas-card-copy', channel.focus.join(' · ')));
    grid.appendChild(card);
  });
  if (!channels.length) grid.appendChild(element(documentRef, 'div', 'atlas-empty', '검색 결과가 없습니다.'));
  view.appendChild(grid);
  return view;
}

function createTrackCard(documentRef, track) {
  const card = element(documentRef, 'article', 'atlas-track-card');
  const display = FOUNDATION_TRACK_DISPLAY[track.id] || track;
  const meta = element(documentRef, 'div', 'atlas-card-meta');
  meta.append(element(documentRef, 'span', 'atlas-card-id', track.id), element(documentRef, 'span', 'atlas-track-duration', track.duration));
  const nodes = element(documentRef, 'div', 'atlas-chip-row');
  track.nodes.forEach((node) => nodes.appendChild(element(documentRef, 'span', 'atlas-chip', node)));
  card.append(meta, element(documentRef, 'h3', 'atlas-card-title', display.title), element(documentRef, 'p', 'atlas-card-copy', display.summary), nodes);
  return card;
}

function taxonomyLevelDisplay(level) {
  return TAXONOMY_LEVEL_DISPLAY[level.id] || level;
}

const FOUNDATION_LESSON_GUIDES = Object.freeze({
  'energy-and-power': { definition: '에너지는 일을 할 수 있는 능력이고 전력은 그 에너지가 시간당 전달되는 속도입니다.', mechanism: 'AI 장비의 전력은 전기→계산·메모리 이동→열로 바뀌며, 냉각과 계통 용량이 실제 운영 상한을 만듭니다.', example: '같은 처리량이라도 전력당 성능이 높으면 랙과 시설의 비용·열 부담이 낮아집니다.', limit: '전력 사용량만으로 모델의 사회적 효율이나 기업 수익을 결론내릴 수 없습니다.' },
  'vectors-and-matrices': { definition: '벡터는 수치 묶음이고 행렬은 벡터를 변환하는 배열입니다.', mechanism: '신경망의 선형변환은 행렬곱과 덧셈으로 입력 표현을 다음 층으로 옮깁니다.', example: '큰 행렬곱을 병렬로 계산하기 때문에 GPU와 tensor core가 중요해집니다.', limit: '행렬곱의 이론 FLOPS가 실제 서비스 처리량과 같지는 않습니다.' },
  'probability-and-statistics': { definition: '확률은 불확실성을 표현하고 통계는 관측 자료에서 패턴과 오차를 추정합니다.', mechanism: '모델 출력은 가능한 token·class의 분포이며 평가는 표본·측정오차·분산을 함께 봐야 합니다.', example: '한 번의 benchmark보다 여러 seed와 업무 분포에서의 신뢰구간이 더 informative합니다.', limit: '통계적으로 유의해도 업무상 중요한 효과나 인과관계를 보장하지 않습니다.' },
  'parallel-processing': { definition: '병렬처리는 독립적인 계산을 여러 연산 유닛이 동시에 수행하는 방식입니다.', mechanism: '행렬과 tensor를 block으로 나누고 메모리·동기화 비용을 지불하면서 처리량을 높입니다.', example: '학습의 큰 batch 계산은 병렬화에 잘 맞지만 순차적인 token 생성은 지연 제약이 큽니다.', limit: '병렬 유닛 수를 늘려도 통신·메모리·직렬 구간이 성능 향상을 제한합니다.' },
  'silicon-and-doping': { definition: '실리콘은 반도체 재료이고 도핑은 전하 운반 특성을 조절하는 공정입니다.', mechanism: '불순물 농도와 접합 구조가 transistor의 전류 흐름·문턱전압·누설을 바꿉니다.', example: '칩 설계의 논리 기능은 웨이퍼 공정과 도핑·배선의 물리적 결과로 구현됩니다.', limit: '공정 노드 숫자만으로 transistor·배선·전력·수율의 모든 차이를 설명할 수 없습니다.' },
  'bottlenecks-and-scarcity': { definition: '병목은 전체 시스템의 처리량을 제한하는 가장 좁은 제약이고 희소성은 선택 가능한 자원이 제한된 상태입니다.', mechanism: '한 병목이 완화되면 수요와 부하가 다음 병목으로 이동할 수 있습니다.', example: '가속기 공급이 늘어도 HBM·패키징·전력 접속이 부족하면 클러스터 확장은 멈춥니다.', limit: '“병목이 이동했다”는 주장은 기간·지역·workload를 지정해야 합니다.' },
  'capex-and-depreciation': { definition: 'CAPEX는 장기간 사용할 자산에 대한 투자이고 감가상각은 그 원가를 사용기간에 배분하는 회계 처리입니다.', mechanism: '투자는 공급능력을 늘리지만 매출·가동률·현금 회수보다 비용 인식이 먼저 또는 늦게 나타날 수 있습니다.', example: '서버를 먼저 설치해도 수요와 가동률이 따라오지 않으면 감가상각 부담이 커집니다.', limit: '감가상각비는 비현금 비용이지만 자산 교체를 위한 현금 필요를 없애지 않습니다.' },
  'rules-vs-learning': { definition: '규칙 기반 프로그램은 사람이 조건을 작성하고 학습 시스템은 데이터에서 파라미터를 조정합니다.', mechanism: '규칙은 예외를 명시적으로 관리하고 학습은 일반화와 데이터 분포에 의존합니다.', example: '세금 계산 규칙과 이미지 분류 모델은 오류가 생기는 방식과 검증법이 다릅니다.', limit: '학습 시스템도 데이터·목표·규칙·도구의 설계를 포함하므로 완전히 규칙이 없는 것은 아닙니다.' },
  'model-parameters-training': { definition: '모델은 입력을 출력으로 바꾸는 구조이고 파라미터는 학습으로 조정되는 수치이며 training은 그 조정 과정입니다.', mechanism: '손실을 계산하고 gradient로 파라미터를 조금씩 업데이트해 목표 분포에 맞춥니다.', example: '파라미터 수가 늘어도 데이터·계산·추론 비용과 품질이 함께 검토되어야 합니다.', limit: '파라미터 수만으로 지식량·추론능력·서비스 품질을 판단할 수 없습니다.' },
  'data-quality': { definition: '데이터 품질은 정확성·대표성·일관성·권리·시간적 적합성을 포함합니다.', mechanism: '데이터의 오류와 편향이 학습·평가·검색 단계로 전파되어 출력 분포를 바꿉니다.', example: '중복·누수·낡은 문서가 있으면 benchmark는 높아도 실제 업무 성능이 낮을 수 있습니다.', limit: '데이터가 많다는 사실은 품질·합법성·현실 대표성을 보장하지 않습니다.' },
  'learning-types': { definition: '지도·비지도·강화학습은 feedback이 만들어지는 방식이 다릅니다.', mechanism: '정답 label, 데이터 구조, 보상 신호에 따라 최적화 목표와 필요한 환경이 달라집니다.', example: '분류는 label을 쓰고, 군집은 구조를 찾으며, 제어는 행동 결과의 보상을 학습합니다.', limit: '실제 시스템은 여러 학습 방식과 사람의 후처리를 조합하는 경우가 많습니다.' },
  'neural-networks': { definition: '신경망은 층별 함수 조합으로 입력 표현을 변환하는 parameterized model입니다.', mechanism: '선형변환과 비선형 활성화를 반복해 단순한 패턴에서 복합 표현으로 이동합니다.', example: '깊이·폭·정규화·데이터가 표현력과 학습 안정성에 영향을 줍니다.', limit: '표현력이 높아질수록 일반화·해석·계산비용 문제가 함께 커질 수 있습니다.' },
  'forward-backpropagation': { definition: 'forward pass는 출력과 손실을 계산하고 backpropagation은 손실의 gradient를 앞 층으로 전달합니다.', mechanism: 'chain rule로 각 파라미터가 손실에 미친 영향을 계산한 뒤 optimizer가 업데이트합니다.', example: '메모리에는 activation과 gradient를 저장해야 하므로 학습 비용이 큽니다.', limit: '학습이 수렴해도 목표가 현실 업무를 대표한다는 보장은 없습니다.' },
  'generalization-and-memory': { definition: '일반화는 보지 못한 입력에도 규칙을 적용하는 능력이고 암기는 학습 표본을 그대로 기억하는 현상입니다.', mechanism: '모델 용량·데이터·정규화·분포 차이가 일반화와 memorization의 균형을 바꿉니다.', example: '훈련 정확도와 새로운 업무의 정확도를 분리해 봐야 합니다.', limit: '암기와 일반화는 이분법이 아니며 개인정보·저작권 위험도 별도로 검토해야 합니다.' },
  'hallucination-and-verification': { definition: '환각은 모델이 근거가 부족한 내용을 그럴듯하게 생성하는 오류입니다.', mechanism: '다음 token 예측은 진실 판정과 동일하지 않으며 검색·도구·검증 루프가 별도 근거를 제공합니다.', example: '출처 링크·계산 재현·사람 검토를 결과 유형에 맞게 결합합니다.', limit: '모델의 확신도나 자연스러운 문체를 사실성 증거로 사용하지 않습니다.' },
  'tokenization': { definition: '토큰화는 문장을 모델이 처리할 작은 기호 단위로 나누는 과정입니다.', mechanism: '문자열이 token id로 바뀌고 token 수가 context·메모리·추론 비용에 영향을 줍니다.', example: '같은 의미라도 언어·기호·공백에 따라 token 수가 달라질 수 있습니다.', limit: 'token 수는 의미의 복잡도와 일치하지 않으며 tokenizer마다 결과가 다릅니다.' },
  'embedding-and-position': { definition: 'embedding은 token을 벡터로 바꾸고 position 정보는 순서와 위치를 표현합니다.', mechanism: '벡터 공간에서 token 관계를 계산 가능한 형태로 만들고 위치 신호를 결합합니다.', example: '같은 단어도 주변 문맥과 위치에 따라 다른 표현으로 변환됩니다.', limit: 'embedding 공간의 거리만으로 인간적 의미나 인과관계를 확정할 수 없습니다.' },
  'self-attention': { definition: 'self-attention은 각 token이 다른 token의 정보를 가중합으로 참고하는 연산입니다.', mechanism: 'Q·K 유사도로 가중치를 만들고 V를 합쳐 문맥 표현을 업데이트합니다.', example: '문장 안의 멀리 떨어진 단어 관계를 한 층에서 직접 연결할 수 있습니다.', limit: 'attention weight가 곧 설명·인과·의식의 지도는 아닙니다.' },
  'multi-head-attention': { definition: 'multi-head attention은 여러 projection 공간에서 관계를 나눠 계산하는 구조입니다.', mechanism: '각 head가 다른 관계 패턴을 포착하고 결과를 합쳐 표현을 풍부하게 만듭니다.', example: '문법·장거리 의존·위치 관계가 서로 다른 부분공간에서 표현될 수 있습니다.', limit: 'head 수가 늘면 자동으로 이해력이 선형 증가하지 않습니다.' },
  'context-window': { definition: 'context window는 한 번의 입력·출력 계산에 모델이 직접 참조할 수 있는 token 범위입니다.', mechanism: '범위가 길어지면 정보 접근은 늘지만 attention·메모리·지연 비용과 선택 문제가 커집니다.', example: '긴 문서를 넣어도 중요한 근거를 놓치거나 후반 정보의 활용이 달라질 수 있습니다.', limit: '큰 window가 장기 기억·정확한 검색·지속 상태를 자동으로 해결하지 않습니다.' },
  'kv-cache': { definition: 'KV cache는 autoregressive 생성에서 이미 계산한 key·value를 저장해 반복 계산을 줄이는 메모리입니다.', mechanism: '새 token만 추가 계산하고 이전 문맥의 K/V를 재사용해 추론 지연을 줄입니다.', example: '동시 사용자·긴 context·batch가 늘면 cache 용량과 메모리 대역폭이 병목이 됩니다.', limit: 'cache가 줄이는 것은 반복 계산이며 모델 품질·근거·저장장치 수요를 자동 개선하지 않습니다.' },
  'pretraining': { definition: '사전학습은 넓은 데이터에서 다음 token 등 일반 목적을 최적화해 기본 표현을 만드는 단계입니다.', mechanism: '대규모 dataset·분산 계산·optimizer가 반복되며 모델 파라미터를 조정합니다.', example: '데이터 정제와 compute scaling이 model capability와 비용의 큰 부분을 결정합니다.', limit: '사전학습 loss가 특정 업무의 안전성·정확성·수익성을 직접 보장하지 않습니다.' },
  'post-training': { definition: '후속학습은 기본 모델을 사람의 선호·지시·도메인 업무에 맞게 조정하는 단계입니다.', mechanism: 'instruction data·preference·reinforcement·fine-tuning으로 출력 형식과 행동 경향을 바꿉니다.', example: '같은 base model도 후속학습과 tool policy에 따라 서비스 특성이 달라집니다.', limit: '후속학습은 사실 근거를 새로 만들지 않으며 과적합·편향·거부 오류가 생길 수 있습니다.' },
  evaluation: { definition: '평가는 모델이 정한 업무 목표를 얼마나 안정적으로 달성하는지 측정하는 과정입니다.', mechanism: 'task metric·human judgment·robustness·cost·safety를 표본과 기준에 맞춰 비교합니다.', example: '정확도뿐 아니라 지연·비용·실패 심각도·분포 이동을 함께 기록합니다.', limit: '단일 benchmark나 데모는 실제 배포 성능의 충분조건이 아닙니다.' },
  deployment: { definition: '배포는 모델을 실제 사용자·데이터·권한·하드웨어 환경에서 운영하는 단계입니다.', mechanism: 'serving·batching·monitoring·rollback·access control이 모델 계산을 서비스로 바꿉니다.', example: '모델 품질이 같아도 latency·availability·비용·보안 설계에 따라 제품성이 달라집니다.', limit: '배포 성공은 모델의 보편적 지능이나 장기 수익을 뜻하지 않습니다.' },
  'parameter-vs-external-memory': { definition: '파라미터 메모리는 학습된 내부 표현이고 external memory는 검색·파일·DB 같은 외부 정보입니다.', mechanism: '모델의 일반 패턴과 최신·정확한 근거를 서로 다른 저장·갱신 경로로 관리합니다.', example: '정책 문서는 검색으로 가져오고 모델은 그 내용을 바탕으로 답을 구성할 수 있습니다.', limit: '외부 검색도 색인·권한·검색 품질·출처 검증이 틀리면 오류를 줄이지 못합니다.' },
  'retrieval-augmented-generation': { definition: 'RAG는 답변 전에 관련 문서를 검색해 생성 모델의 입력에 근거를 추가하는 방식입니다.', mechanism: 'chunk·embedding·retriever·reranker·prompt·citation이 하나의 pipeline을 구성합니다.', example: '기업 내부 문서를 최신 권한에 맞춰 찾고 답변에 문서 위치를 함께 표시합니다.', limit: '검색된 문서가 질문을 지지하는지와 생성 문장이 근거를 정확히 반영하는지는 별도 검증이 필요합니다.' },
  'tool-use': { definition: 'tool use는 모델이 검색·계산·API·파일 같은 외부 기능을 호출하는 패턴입니다.', mechanism: '모델이 도구 선택과 인자를 제안하고 실행 결과를 받아 다음 행동을 결정합니다.', example: '환율 계산은 계산기를 호출하고, 최신 문서는 공식 API에서 가져오는 식으로 역할을 분리합니다.', limit: '도구 권한·입력 검증·실패 처리 없이는 자동화가 위험해집니다.' },
  'agent-loop': { definition: 'agent loop는 목표·관찰·계획·행동·검증을 반복하는 시스템 구조입니다.', mechanism: '상태를 유지하며 도구를 여러 번 호출하고 종료 조건과 human review를 적용합니다.', example: '자료 수집→출처 대조→초안→검수의 반복을 명시적인 단계로 제한할 수 있습니다.', limit: '반복 횟수나 권한이 통제되지 않으면 비용·오류·부작용이 누적됩니다.' },
  'state-action-dynamics': { definition: '상태는 시스템의 현재 조건, action은 가능한 행동, dynamics는 행동 후 상태 변화의 규칙입니다.', mechanism: '관측과 행동의 결과를 연결해야 planning과 제어가 현실의 시간 흐름을 다룰 수 있습니다.', example: '로봇의 위치·속도·장애물이 상태이고 모터 명령이 action입니다.', limit: '현실의 상태가 완전히 관측되지 않거나 dynamics가 변하면 계획 오차가 커집니다.' },
  'planning-and-control': { definition: '계획은 목표까지의 행동 순서를 만들고 제어는 현재 오차를 줄이도록 행동을 조정합니다.', mechanism: '예측·목표·제약·feedback을 반복해 안전성과 성능 사이에서 선택합니다.', example: '로봇 팔은 경로를 계획한 뒤 센서 feedback으로 실제 오차를 보정합니다.', limit: '계획이 좋아도 센서·actuator 지연과 안전 제약이 실행을 제한합니다.' },
  'world-model-limitations': { definition: 'World model은 상태와 행동 결과를 예측하려는 내부 모델이지만 현실의 완전한 복제는 아닙니다.', mechanism: '데이터·시뮬레이션·행동 경험으로 dynamics를 근사하고 계획에 사용합니다.', example: '훈련 환경에서 성공한 정책이 조명·마찰·사람 행동이 달라진 현장에서 실패할 수 있습니다.', limit: '예측 오차·분포 이동·긴 horizon 누적오차·안전 검증을 별도 관리해야 합니다.' },
  'workload-shape': { definition: 'AI workload shape는 학습·추론·배치·실시간·모델 크기·sequence 길이의 조합입니다.', mechanism: '계산·메모리·통신·지연 요구의 비율이 하드웨어와 시설 설계를 결정합니다.', example: '학습은 대규모 병렬 처리량, 실시간 추론은 tail latency와 비용이 더 중요할 수 있습니다.', limit: '한 benchmark를 모든 workload의 대표로 사용하면 수요와 공급 해석이 왜곡됩니다.' },
  'cpu-gpu-asic-npu': { definition: 'CPU·GPU·ASIC·NPU는 범용성·병렬성·전용성·전력 예산이 다른 계산 자원입니다.', mechanism: 'workload와 소프트웨어 생태계가 비용·성능·배치 가능성을 함께 결정합니다.', example: '분기 많은 제어는 CPU, 대규모 tensor는 GPU, 반복 inference는 ASIC/NPU가 유리할 수 있습니다.', limit: '유리함은 모델·batch·compiler·공급·개발비 조건에 따라 달라집니다.' },
  'precision-and-tensor-core': { definition: '정밀도와 tensor core는 행렬 연산을 낮은 비트 형식과 전용 유닛으로 빠르게 계산하는 방법입니다.', mechanism: '표현 범위를 줄여 메모리·연산 비용을 낮추되 quantization 오차와 변환을 관리합니다.', example: '학습과 추론에서 허용 가능한 오차가 달라 형식 선택도 달라질 수 있습니다.', limit: 'TOPS 수치만으로 실제 모델 정확도·처리량·전력 효율을 비교할 수 없습니다.' },
  'memory-wall': { definition: 'memory wall은 계산 속도보다 데이터를 공급·이동하는 속도가 느려지는 병목입니다.', mechanism: 'cache miss·대역폭·지연·동시성·전력 비용이 연산기 활용률을 낮춥니다.', example: '연산 유닛을 추가해도 HBM과 인터커넥트가 데이터를 못 보내면 성능이 포화됩니다.', limit: '모든 모델이 같은 memory wall을 갖는 것은 아니며 데이터 재사용과 batch가 중요합니다.' },
  hbm: { definition: 'HBM은 여러 메모리 다이를 적층하고 넓은 인터페이스로 가속기 가까이 연결하는 고대역폭 메모리입니다.', mechanism: '대역폭을 높이는 대신 적층·패키징·열·수율·공급능력의 난도가 함께 올라갑니다.', example: '가속기 성능은 HBM의 용량·대역폭·전력과 패키지 연결에 의해 제한될 수 있습니다.', limit: 'HBM 수요가 곧 특정 업체의 매출·마진·가격을 의미하지 않으며 고객 인증과 공급 조건을 확인해야 합니다.' },
  interconnect: { definition: '인터커넥트는 칩·메모리·서버·랙 사이에서 데이터를 이동시키는 물리·프로토콜 계층입니다.', mechanism: '링크 대역폭·지연·토폴로지·집단통신이 분산 계산의 확장 효율을 만듭니다.', example: '가속기 수가 늘어도 all-reduce 통신이 병목이면 전체 학습 시간이 줄지 않습니다.', limit: '링크 속도만으로 시스템 성능을 판단할 수 없고 software stack과 traffic pattern이 필요합니다.' },
  'advanced-packaging': { definition: '첨단 패키징은 다이·칩렛·HBM을 가까이 묶어 시스템 성능을 만드는 후공정·통합 층입니다.', mechanism: '연결 거리·전력·열·기판·검사·수율을 동시에 최적화합니다.', example: '미세공정이 좋아져도 패키지 조립과 테스트 수율이 낮으면 출하가 제한됩니다.', limit: '패키징 기술 발표가 즉시 대량 양산·수익성·공급 확대를 뜻하지 않습니다.' },
  'rack-density-and-cooling': { definition: '랙 밀도는 랙이 수용하는 IT 전력과 열이고 냉각은 그 열을 안정적으로 제거하는 시스템입니다.', mechanism: '가속기 집적 → 칩 열 → cold plate·액체·공기 → 시설 열 배출로 이어집니다.', example: '서버를 더 넣는 결정은 전원·냉각·유지보수·공간·소방 조건과 함께 검토합니다.', limit: 'PUE 하나만으로 데이터센터의 공급능력·수익성·환경영향을 설명할 수 없습니다.' },
  'power-and-grid': { definition: '전력망은 발전·송전·변전·배전·수요가 실시간 균형을 이루는 시스템입니다.', mechanism: 'AIDC의 부하는 계통 접속·변압기·허가·가격·신뢰도 제약을 통해 실제 가동 시점에 영향을 줍니다.', example: '발전 계약이 있어도 접속선·변전소가 없으면 서버를 즉시 운영할 수 없습니다.', limit: '전력 수요 전망은 지역·시간·계약·계통 모델을 포함하지 않으면 과장될 수 있습니다.' },
  'unit-economics': { definition: '단위경제성은 서비스 한 단위가 만드는 매출과 변동·직접 비용을 비교하는 프레임입니다.', mechanism: '가격·사용량·전력·임대·지원·고객획득 비용이 단위당 기여이익을 결정합니다.', example: 'GPU 시간당 매출이 높아도 전력·리스·지원 비용이 크면 회수력이 낮습니다.', limit: '단위경제성이 좋아도 고정비·CAPEX·고객 집중·규모 확장 비용은 별도입니다.' },
  utilization: { definition: '가동률은 확보한 자산이 실제 workload를 처리하는 시간·용량의 비율입니다.', mechanism: '예약·트래픽·batching·장애·유휴 시간이 매출과 고정비 흡수율을 바꿉니다.', example: '같은 GPU 수라도 낮은 가동률이면 감가상각과 전력 인프라 부담이 커집니다.', limit: '평균 가동률은 피크 지연·고객 품질·수요 집중을 숨길 수 있습니다.' },
  'capacity-and-yield': { definition: '생산능력은 투입 가능한 물량이고 수율은 투입 중 규격을 만족하는 양품 비율입니다.', mechanism: '장비·공정 조건·결함·조립·검사가 양품 공급량·원가·lead time을 함께 결정합니다.', example: '설계상 생산능력이 있어도 수율 학습이 늦으면 실제 출하량이 낮아집니다.', limit: '공식 수율 수치는 공정·제품·시점별로 제한적으로 공개되므로 추정치를 사실처럼 쓰지 않습니다.' },
  'fcf-and-funding': { definition: 'FCF는 영업활동 후 투자에 필요한 현금을 제외하고 남는 현금이고 funding은 부족분을 조달하는 방식입니다.', mechanism: '마진·운전자본·CAPEX·리스·차입·증자가 성장 속도와 재무 위험을 결정합니다.', example: '매출이 커져도 CAPEX와 매출채권이 더 빨리 늘면 외부 자금이 필요합니다.', limit: 'FCF 정의와 조정 항목이 기업마다 달라 기간·회계정책을 함께 비교해야 합니다.' },
  'roic-and-counter-scenario': { definition: 'ROIC는 투자된 자본이 자본비용을 넘어 수익을 만드는지 보는 회수 프레임이고 counter-scenario는 반대 경로입니다.', mechanism: '수요·가격·가동률·마진·CAPEX·감가상각·자본비용을 연결해 회수 결과를 점검합니다.', example: 'AI 수요가 늘어도 가격 하락·가동률 저하·전력비 상승이면 수익률이 낮아질 수 있습니다.', limit: 'ROIC는 미래를 예언하지 않으며 사업부 배분·무형자산·리스 처리 가정에 민감합니다.' },
  'claim-source-as-of': { definition: 'claim-source-as-of 규율은 주장마다 무엇을 언제 어떤 출처에서 확인했는지 기록하는 방식입니다.', mechanism: '관찰·해석·추론·전망을 분리하고 기준일·단위·기간·출처를 함께 저장합니다.', example: '공식 공시의 보고기간과 발표일을 나눠 기록하면 최신성 오류를 줄일 수 있습니다.', limit: '출처가 있다고 해서 출처가 그 주장을 직접 지지하는 것은 아니므로 claim-source 직접성을 확인해야 합니다.' },
  'human-review': { definition: '사람의 검토는 모델·자동화 결과를 기술·출처·재무·안전 맥락에서 승인하거나 보류하는 단계입니다.', mechanism: '검토자는 불확실성·반대 시나리오·권한·재현성을 확인하고 공개 상태를 결정합니다.', example: '현재 수율이나 목표가처럼 영향이 큰 주장은 자동 승격하지 않고 1차 자료를 대조합니다.', limit: '사람 검토도 체크리스트·이해상충·전문성·시간 압박의 영향을 받으므로 기록과 재검토가 필요합니다.' }
});

const FOUNDATION_TEACHING_FRAME = Object.freeze({
  F0: { question: '이 개념은 문제·능력·모델·완성 시스템 중 어느 층을 설명하는가?', visualization: '문제 → 학습 → 모델 → 서비스 → 하드웨어 계층도' },
  F1: { question: '입력 자원과 물리적 제약이 어떤 단위로 결과를 제한하는가?', visualization: '에너지·연산·메모리·열의 병목 흐름도' },
  F2: { question: '데이터·목표·학습 피드백이 모델의 오류와 일반화를 어떻게 바꾸는가?', visualization: '데이터 → 손실 → 파라미터 → 평가 루프' },
  F3: { question: '표현·문맥·학습·배포 중 어느 단계에서 비용과 품질이 결정되는가?', visualization: 'token → attention → training → serving 수명주기' },
  F4: { question: '외부 정보·도구·상태·사람의 검토가 어떤 실패를 줄이거나 새로 만드는가?', visualization: '관찰 → 검색/도구 → 행동 → 검증 상태기계' },
  F5: { question: 'workload가 계산·메모리·네트워크·전력·냉각 중 무엇을 먼저 포화시키는가?', visualization: '가속기 → HBM → 인터커넥트 → 랙 → 전력망' },
  F6: { question: '기술 능력이 사용량·마진·현금흐름·자본수익률로 전달되는 증거는 무엇인가?', visualization: '수요 → CAPEX → 가동률 → FCF → ROIC 검증 원장' }
});

function createModuleLesson(documentRef, module, authoredLessons) {
  const authored = authoredLessons?.byId?.[module.id] || authoredLessons?.lessons?.find((lesson) => lesson.id === module.id);
  const guide = authored || FOUNDATION_LESSON_GUIDES[module.id] || {
    definition: `${module.title}은(는) AI 시스템을 이해하기 위한 기초 개념입니다.`,
    mechanism: '정의·작동 원리·산업 역할을 분리해 읽고 관찰 가능한 지표를 연결합니다.',
    example: '실제 시스템에서는 입력·변환·출력과 비용·품질·운영 제약을 함께 확인합니다.',
    limit: '현재 수치·투자 판단으로 확장하려면 기준일과 직접적인 1차 출처가 추가로 필요합니다.'
  };
  const teachingFrame = FOUNDATION_TEACHING_FRAME[module.layer] || FOUNDATION_TEACHING_FRAME.F6;
  const authoredStatusLabels = { AUTHORED_REFERENCE: '학습 원고 작성 완료', AUTHORED_REFERENCE_CONNECTED: '학습 원고·출처 연결' };
  const body = element(documentRef, 'div', 'atlas-module-lesson');
  body.dataset.atlasFoundationId = module.id;
  body.append(
    element(documentRef, 'p', 'atlas-card-copy atlas-module-authored', authored ? '학습 원고 · 교육용 참고 콘텐츠' : '기본 개념 프레임 · 교육용 참고 콘텐츠'),
    element(documentRef, 'p', 'atlas-card-copy', guide.definition),
    element(documentRef, 'p', 'atlas-card-copy', `작동 원리: ${guide.mechanism}`),
    element(documentRef, 'p', 'atlas-card-copy', `예시·관찰 포인트: ${guide.example}`),
    element(documentRef, 'p', 'atlas-card-copy atlas-node-guide-risk', `한계·실패 조건: ${guide.limit}`),
    element(documentRef, 'p', 'atlas-card-copy atlas-module-question', `학습 질문: ${guide.teachingQuestion || teachingFrame.question}`),
    element(documentRef, 'p', 'atlas-card-copy atlas-module-visualization', `권장 시각화: ${guide.visualization || teachingFrame.visualization}`),
    element(documentRef, 'p', 'atlas-card-copy atlas-node-guide-boundary', '현재 수치·투자 판단으로 사용하지 않는 구조적 학습 자료입니다.')
  );
  if (authored?.relatedAtlasNodeIds?.length) {
    const related = element(documentRef, 'div', 'atlas-chip-row atlas-module-related');
    authored.relatedAtlasNodeIds.forEach((nodeId) => related.appendChild(element(documentRef, 'span', 'atlas-chip', `연결: ${nodeId}`)));
    body.appendChild(related);
  }
  if (authored?.sourceIds?.length || module.evidence?.length) {
    const sourceDetails = element(documentRef, 'details', 'atlas-module-source-details');
    sourceDetails.appendChild(element(documentRef, 'summary', 'atlas-module-source-summary', '근거 및 더 읽기'));
    const sources = element(documentRef, 'div', 'atlas-chip-row atlas-module-sources');
    [...new Set([...(module.evidence || []), ...(authored?.sourceIds || [])])].forEach((sourceId) => sources.appendChild(element(documentRef, 'span', 'atlas-chip', `공식 자료 · ${sourceId}`)));
    sourceDetails.appendChild(sources);
    body.appendChild(sourceDetails);
  }
  return body;
}

function createCurriculumView(documentRef, curriculum, query, authoredLessons, selection = {}) {
  const view = element(documentRef, 'div', 'atlas-curriculum-view');
  const allModules = curriculum?.moduleIndex || [];
  const moduleById = new Map(allModules.map((module) => [module.id, module]));
  const searchable = (module) => [module.id, module.title, FOUNDATION_MODULE_LABELS[module.id], module.layer, module.sourceSection, (module.evidence || []).join(' ')].join(' ').toLowerCase();
  const matchingModules = allModules.filter((module) => !query || searchable(module).includes(query));
  const layers = (curriculum?.layers || []).filter((layer) => layer.id !== 'F0');
  const requestedLayer = layers.find((layer) => layer.id === selection.layerId);
  const activeLayer = requestedLayer || layers.find((layer) => (layer.modules || []).some((id) => matchingModules.some((module) => module.id === id))) || layers[0];
  const visibleModules = query
    ? matchingModules
    : (activeLayer?.modules || []).map((moduleId) => moduleById.get(moduleId)).filter(Boolean);
  const selectedModule = visibleModules.find((module) => module.id === selection.moduleId) || visibleModules[0] || null;
  view.dataset.atlasAuthoredLessonTotal = String(allModules.length);
  view.dataset.atlasVisibleLessonCount = String(visibleModules.length);

  const intro = element(documentRef, 'div', 'atlas-subsection-intro atlas-learning-intro');
  intro.append(
    element(documentRef, 'h2', 'atlas-section-title', 'AI를 이해하는 6단계'),
    element(documentRef, 'p', 'atlas-card-copy', '물리·수학의 바닥에서 시작해 학습 원리, Transformer, Agent·World Model, AI 인프라, 산업 경제성으로 내려갑니다. 왼쪽에서 큰 층을 고르고, 가운데에서 세부 개념을 선택해 한 번에 하나씩 읽으세요.')
  );

  const workspace = element(documentRef, 'div', 'atlas-learning-workspace');
  const layerTree = element(documentRef, 'nav', 'atlas-learning-layer-tree');
  layerTree.setAttribute('aria-label', 'AI 기초 개념 학습 단계');
  layerTree.appendChild(element(documentRef, 'p', 'atlas-learning-column-label', '1. 큰 흐름 선택'));
  layers.forEach((layer, index) => {
    const display = FOUNDATION_LAYER_DISPLAY[layer.id] || layer;
    const button = actionButton(documentRef, `atlas-learning-layer${activeLayer?.id === layer.id && !query ? ' is-active' : ''}`, '', 'layer', layer.id);
    button.setAttribute('aria-pressed', String(activeLayer?.id === layer.id && !query));
    button.append(
      element(documentRef, 'span', 'atlas-learning-step', `${index + 1}`),
      element(documentRef, 'span', 'atlas-learning-layer-copy', ''),
    );
    button.lastElementChild.append(
      element(documentRef, 'strong', 'atlas-learning-layer-title', display.title),
      element(documentRef, 'span', 'atlas-learning-layer-count', `${(layer.modules || []).length}개 개념`)
    );
    layerTree.appendChild(button);
  });

  const conceptList = element(documentRef, 'div', 'atlas-learning-concepts');
  conceptList.appendChild(element(documentRef, 'p', 'atlas-learning-column-label', query ? `검색 결과 ${visibleModules.length}개` : '2. 세부 개념 선택'));
  if (activeLayer && !query) {
    const display = FOUNDATION_LAYER_DISPLAY[activeLayer.id] || activeLayer;
    conceptList.append(
      element(documentRef, 'h3', 'atlas-learning-concepts-title', display.title),
      element(documentRef, 'p', 'atlas-card-copy atlas-learning-concepts-summary', display.summary)
    );
  }
  const conceptButtons = element(documentRef, 'div', 'atlas-learning-concept-list');
  visibleModules.forEach((module, index) => {
    const button = actionButton(documentRef, `atlas-learning-concept${selectedModule?.id === module.id ? ' is-active' : ''}`, '', 'module', module.id);
    button.setAttribute('aria-pressed', String(selectedModule?.id === module.id));
    button.append(
      element(documentRef, 'span', 'atlas-learning-concept-index', String(index + 1).padStart(2, '0')),
      element(documentRef, 'span', 'atlas-learning-concept-title', FOUNDATION_MODULE_LABELS[module.id] || module.title)
    );
    conceptButtons.appendChild(button);
  });
  if (!visibleModules.length) conceptButtons.appendChild(element(documentRef, 'div', 'atlas-empty', '일치하는 개념이 없습니다. 다른 검색어를 입력해 보세요.'));
  conceptList.appendChild(conceptButtons);

  const detail = element(documentRef, 'article', 'atlas-learning-detail');
  detail.appendChild(element(documentRef, 'p', 'atlas-learning-column-label', '3. 원리와 연결 이해'));
  if (selectedModule) {
    const displayLayerId = !query && activeLayer?.modules?.includes(selectedModule.id) ? activeLayer.id : selectedModule.layer;
    const layerDisplay = FOUNDATION_LAYER_DISPLAY[displayLayerId] || { title: displayLayerId };
    const breadcrumb = element(documentRef, 'p', 'atlas-learning-breadcrumb', `${displayLayerId} · ${layerDisplay.title}`);
    const title = element(documentRef, 'h3', 'atlas-learning-detail-title', FOUNDATION_MODULE_LABELS[selectedModule.id] || selectedModule.title);
    title.tabIndex = -1;
    title.dataset.atlasLearningDetailTitle = selectedModule.id;
    detail.append(breadcrumb, title, createModuleLesson(documentRef, selectedModule, authoredLessons));
    const position = allModules.findIndex((module) => module.id === selectedModule.id);
    const navigation = element(documentRef, 'div', 'atlas-learning-navigation');
    if (position > 0) navigation.appendChild(actionButton(documentRef, 'atlas-learning-nav-button', `← ${FOUNDATION_MODULE_LABELS[allModules[position - 1].id] || allModules[position - 1].title}`, 'module', allModules[position - 1].id));
    if (position >= 0 && position < allModules.length - 1) navigation.appendChild(actionButton(documentRef, 'atlas-learning-nav-button is-next', `${FOUNDATION_MODULE_LABELS[allModules[position + 1].id] || allModules[position + 1].title} →`, 'module', allModules[position + 1].id));
    detail.appendChild(navigation);
  } else {
    detail.appendChild(element(documentRef, 'div', 'atlas-empty', '왼쪽에서 학습할 개념을 선택하세요.'));
  }

  workspace.append(layerTree, conceptList, detail);
  view.append(intro, workspace);
  return view;
}

function createTaxonomyView(documentRef) {
  const view = element(documentRef, 'div', 'atlas-taxonomy-view');
  const intro = element(documentRef, 'div', 'atlas-subsection-intro');
  intro.append(element(documentRef, 'h2', 'atlas-section-title', 'L0 → L6 recursive taxonomy'), element(documentRef, 'p', 'atlas-card-copy', '기업명이나 제품명에서 출발하지 않고, 수요·산업·공정·제품·player·현재 데이터 순서로 깊이를 닫습니다. 현재는 구조 계약만 공개합니다.'));
  const levels = element(documentRef, 'div', 'atlas-level-rail');
  TAXONOMY_LEVELS.forEach((level, index) => {
    const card = element(documentRef, 'article', `atlas-level-card${index === TAXONOMY_LEVELS.length - 1 ? ' is-terminal' : ''}`);
    const display = taxonomyLevelDisplay(level);
    card.append(element(documentRef, 'span', 'atlas-level-id', level.id), element(documentRef, 'strong', 'atlas-level-label', display.label), element(documentRef, 'span', 'atlas-level-example', display.example));
    levels.appendChild(card);
  });
  const nodes = element(documentRef, 'div', 'atlas-node-grid');
  REPRESENTATIVE_NODES.forEach((node) => {
    const card = element(documentRef, 'article', 'atlas-node-card');
    card.append(element(documentRef, 'span', 'atlas-node-class', node.className), element(documentRef, 'h3', 'atlas-card-title', node.label), element(documentRef, 'p', 'atlas-card-copy', node.edge), statusBadge(documentRef, 'DRAFT'));
    nodes.appendChild(card);
  });
  view.append(intro, levels, element(documentRef, 'h2', 'atlas-section-title atlas-section-title-spaced', '대표 구조 node'), nodes);
  return view;
}

const ATLAS_CONCEPT_GUIDES = Object.freeze({
  'compute-gpu': { definition: 'GPU는 병렬 계산을 반복 수행하는 가속기입니다.', chain: '모델 workload → 가속기 → HBM·인터커넥트 → 서버 시스템', role: '대표 역할: 연산 처리와 소프트웨어 생태계 제공', kpi: '실제 처리량·지연시간·전력당 성능·활용률' },
  'memory-dram-hbm': { definition: 'DRAM·HBM은 연산기에 데이터를 공급하는 고대역폭 메모리 계층입니다.', chain: '메모리 대역폭 → 패키징·수율 → 가속기 처리량', role: '대표 역할: 데이터 공급 병목 완화', kpi: '대역폭·용량·수율·전력·고객 인증' },
  'memory-enterprise-ssd': { definition: '데이터센터 SSD는 모델·데이터·검색 인덱스를 저장하고 이동시킵니다.', chain: '추론·RAG 데이터 → SSD·파일시스템 → 지연시간·비용', role: '대표 역할: 저장 용량과 I/O 성능 제공', kpi: 'IOPS·지연시간·내구성·GB당 비용' },
  'foundry-process-node': { definition: '공정 노드는 트랜지스터와 배선의 제조 세대를 표현하는 제조 플랫폼입니다.', chain: '설계 규칙·장비·재료 → 웨이퍼 공정 → 성능·전력·수율', role: '대표 역할: 고객 칩의 제조·공정 통합', kpi: '성능·전력·면적·수율·양산 시점' },
  'foundry-capacity-yield': { definition: '생산능력과 수율은 설계된 칩이 실제로 얼마나 안정적으로 출하되는지를 결정합니다.', chain: '장비·공정 조건 → 양품률 → 공급량·원가·마진', role: '대표 역할: 병목 생산능력과 양산 안정성 관리', kpi: '가동률·수율·리드타임·웨이퍼 투입량' },
  'foundry-equipment': { definition: '공정 장비는 노광·식각·증착·검사 등 웨이퍼 제조 단계를 수행합니다.', chain: '장비 성능·납기 → 공정 능력 → 고객 양산', role: '대표 역할: 특정 공정의 정밀도와 처리량 제공', kpi: '처리량·정밀도·서비스 매출·설치 기반' },
  'package-2-5d': { definition: '2.5D 패키징은 칩렛과 HBM을 인터포저 계층으로 가깝게 연결합니다.', chain: '칩렛·메모리 → 인터포저·기판 → 대역폭·열·수율', role: '대표 역할: 시스템 수준 통합과 연결 밀도 향상', kpi: '패키지 수율·대역폭·열 특성·생산능력' },
  'network-cpo': { definition: 'CPO는 광학 부품을 스위치와 가까이 통합해 데이터 이동 비용과 전력을 줄이려는 구조입니다.', chain: 'AI 클러스터 통신 → 광학 연결 → 대역폭·전력·열', role: '대표 역할: 클러스터 내부 통신 병목 완화', kpi: '포트 속도·전력/비트·거리·수율·고객 도입' },
  'network-silicon-photonics': { definition: '실리콘 포토닉스는 실리콘 기반 회로와 광 신호를 결합해 데이터를 전송합니다.', chain: '전기 신호 → 광 변환 → 랙·클러스터 연결', role: '대표 역할: 고속·장거리 데이터 이동', kpi: '대역폭·전력·신뢰성·모듈 원가' },
  'aidc-rack-density': { definition: '랙 밀도는 한 랙에 배치되는 IT 전력과 열의 규모입니다.', chain: '가속기 집적 → 전력·냉각 요구 → 데이터센터 용량', role: '대표 역할: 시설 설계와 서버 배치의 물리적 제약 관리', kpi: 'kW/랙·가동률·냉각 용량·전력 접속' },
  'aidc-liquid-cooling': { definition: '액체 냉각은 공기보다 높은 열밀도를 처리하기 위한 열 제거 방식입니다.', chain: '칩 열 → 냉각 루프 → 랙 안정성·시설 효율', role: '대표 역할: 고밀도 AI 서버의 열 설계와 가동 안정성', kpi: 'PUE·열 제거 용량·누수 위험·유지보수' },
  'power-interconnection': { definition: '전력 접속 대기열은 발전·송전망에 신규 데이터센터가 연결되는 시간과 불확실성을 뜻합니다.', chain: 'IT 부하 → 계통 접속·변전 → 실제 가동 시점', role: '대표 역할: 전력 공급 일정과 확장 속도 결정', kpi: '대기기간·접속 용량·변전 설비·전력 단가' },
  'economics-revenue-model': { definition: '수익모델은 AI 인프라의 처리능력을 고객 과금과 현금흐름으로 바꾸는 방식입니다.', chain: '사용량·예약·구독 → 매출 인식 → CAPEX 회수', role: '대표 역할: 기술 사용을 반복 매출로 번역', kpi: '단위 매출·가동률·총마진·갱신률·고객 집중도' },
  'economics-roic': { definition: 'ROIC는 투자된 자본이 비용을 넘어서는 수익을 만드는지 보는 회수 프레임입니다.', chain: 'CAPEX·리스 → 매출·마진·감가상각 → FCF·자본수익률', role: '대표 역할: 성장과 자본 효율의 균형 점검', kpi: '가동률·FCF·감가상각·자본비용·ROIC' },
  'edge-soc-npu': { definition: '엣지 SoC·NPU는 기기 안에서 제한된 전력과 메모리로 AI 추론을 수행합니다.', chain: '센서·모델 → 온디바이스 추론 → 지연·프라이버시·배터리', role: '대표 역할: 클라우드 왕복 없이 기기 내 AI 제공', kpi: '전력당 성능·지연시간·메모리·배터리·출하량' },
  'physical-ai-control': { definition: '제어·구동은 인식 결과를 실제 로봇·기계의 안전한 행동으로 변환합니다.', chain: '센싱·시뮬레이션 → 계획 → 구동·안전 검증', role: '대표 역할: 디지털 모델을 물리적 행동으로 연결', kpi: '오류율·지연·안전성·가동률·현장 학습 비용' },
  'cloud-hyperscaler': { definition: '하이퍼스케일러 클라우드는 대규모 컴퓨트·스토리지·네트워크를 공용 플랫폼으로 운영합니다.', chain: '데이터센터 자산 → 공유 인프라 → 사용량·예약 기반 서비스 매출', role: '대표 역할: 여러 workload를 한 시설과 소프트웨어 층에서 통합', kpi: '가동률·사용량·단위 매출·CAPEX·감가상각·고객 집중도' },
  'cloud-ai-service': { definition: '관리형 AI 서비스는 모델 실행·데이터 연결·권한·관측 기능을 API나 플랫폼으로 묶습니다.', chain: '모델·데이터·도구 → 관리형 API → 개발자 사용량·반복 매출', role: '대표 역할: 모델 사용의 복잡성을 서비스 운영 층으로 흡수', kpi: '요청량·지연·단위 원가·총마진·갱신률·오류율' },
  'cloud-utilization': { definition: '가동률과 workload mix는 고정비가 큰 컴퓨트 자산이 실제 매출로 전환되는 정도를 보여줍니다.', chain: '예약·트래픽·배치 패턴 → 장비 사용률 → 단위 원가·마진', role: '대표 역할: 수요의 양뿐 아니라 시간대·모델·고객별 사용 패턴을 해석', kpi: '평균·피크 가동률·유휴시간·GPU 시간당 원가·workload mix' },
  'cloud-commitments': { definition: '클라우드 commitment는 고객이 일정 기간 사용량이나 지출을 약정하는 계약 구조입니다.', chain: '고객 계획 → 예약·약정 → 공급능력·매출 가시성', role: '대표 역할: 미래 매출 단서를 제공하지만 사용량·해지·회계 인식과 분리', kpi: 'RPO·계약기간·해지조건·고객 집중도·실사용률' },
  'cloud-depreciation': { definition: '감가상각 주기는 서버·시설 투자액이 회계상 비용으로 인식되는 시간 구조입니다.', chain: 'CAPEX·내용연수 → 감가상각비 → 이익·현금흐름·재투자', role: '대표 역할: 매출 성장과 회계비용·자산 회수 속도를 연결', kpi: 'CAPEX/매출·감가상각·내용연수·자산 가동률·장부가' },
  'neocloud-gpu-rental': { definition: 'GPU 임대는 대규모 가속기 자산을 시간·예약 단위로 고객에게 제공하는 사업모델입니다.', chain: '조달·호스팅 → GPU 시간 판매 → 임대료·전력·금융비용', role: '대표 역할: 자산 소유와 서비스 판매 사이의 수익 구조를 보여줌', kpi: '임대 단가·가동률·전력비·감가상각·고객 집중도' },
  'neocloud-capacity-reservation': { definition: '용량 예약은 고객이 미래의 컴퓨트 공급을 미리 확보하는 계약입니다.', chain: '고객 forecast → 용량 예약 → 선투자·공급 보장·취소 위험', role: '대표 역할: 수요 가시성과 자산 선투자의 균형을 확인', kpi: '예약 기간·선급금·취소·실사용률·남은 의무' },
  'neocloud-lease-burden': { definition: '리스 부담은 시설·서버 사용권에 대한 미래 고정 지급 의무입니다.', chain: '리스 계약 → 고정 지급·부채 → 가동률·금리 민감도', role: '대표 역할: 손익보다 먼저 고정비와 재무 레버리지를 드러냄', kpi: '리스부채·만기·이자비용·최소 지급액·가동률' },
  'neocloud-customer-concentration': { definition: '고객 집중도는 소수 고객이 매출·채권·예약의 큰 부분을 차지하는 정도입니다.', chain: '대형 고객 → 수요·가격 협상력 → 매출 안정성과 하방 위험', role: '대표 역할: 계약 가시성과 협상력·대체 수요를 함께 평가', kpi: '상위 고객 매출 비중·채권·계약기간·갱신률·해지조건' },
  'neocloud-rental-yield': { definition: '임대 수익률에서 자금조달비용을 뺀 값은 자산 확장의 경제성을 보는 개념적 프레임입니다.', chain: '임대료·가동률 → 자산 수익률 → 이자·리스비용 → 잉여', role: '대표 역할: 성장률이 아니라 자본비용을 넘는 회수 가능성을 점검', kpi: '단위 매출·총마진·자본비용·가동률·현금 회수기간' },
  'compute-asic': { definition: 'ASIC은 특정 workload에 맞춰 설계된 주문형 집적회로입니다.', chain: '반복 workload → 전용 회로·compiler → 성능·전력·개발비 절충', role: '대표 역할: 범용성보다 반복 규모와 효율이 중요한 계산을 담당', kpi: '성능/전력·개발기간·NRE·수율·software enablement' },
  'compute-npu': { definition: 'NPU는 신경망 연산을 기기나 시스템의 전력 예산 안에서 처리하도록 만든 가속기입니다.', chain: '모델 연산 → 전용 MAC·메모리 → 저전력 추론', role: '대표 역할: CPU/GPU와 다른 지연·전력·프라이버시 요구를 처리', kpi: 'TOPS보다 실제 모델 처리량·전력·메모리·지원 연산·지연' },
  'compute-precision': { definition: 'FP·BF·INT 정밀도는 숫자를 표현하는 비트 수와 형식으로 계산 비용·오차를 바꿉니다.', chain: '정밀도 선택 → 메모리·연산량 → 속도·전력·정확도', role: '대표 역할: 모델 품질을 유지하면서 계산·메모리 비용을 줄이는 설계 축', kpi: '정확도 변화·처리량·메모리 사용량·전력·변환 오버헤드' },
  'compute-interconnect': { definition: '가속기 인터커넥트는 여러 칩과 메모리 사이에서 데이터를 이동시키는 연결 계층입니다.', chain: '분산 workload → 링크·스위치·프로토콜 → 집단 통신 성능', role: '대표 역할: 개별 칩 성능이 클러스터 성능으로 확장되는 조건을 결정', kpi: '대역폭·지연·scale-out 효율·전력/bit·오류율' },
  'memory-sram': { definition: 'SRAM과 cache는 연산기 가까이에서 자주 쓰는 데이터를 빠르게 보관하는 메모리 계층입니다.', chain: '반복 접근 → 근접 cache → 지연·외부 메모리 트래픽 감소', role: '대표 역할: 평균 메모리 지연과 전력 접근을 낮춤', kpi: 'hit rate·latency·용량·면적·전력·대역폭' },
  'memory-nand': { definition: 'NAND flash는 전원이 꺼져도 데이터를 보존하는 고밀도 비휘발성 저장 매체입니다.', chain: '데이터·모델·로그 → NAND·컨트롤러 → 용량·비용·내구성', role: '대표 역할: 대규모 데이터셋과 체크포인트·검색 데이터를 저장', kpi: 'bit density·GB당 비용·쓰기 내구성·지연·수율' },
  'memory-cxl': { definition: 'CXL은 CPU·가속기·메모리 장치 사이의 연결과 메모리 공유를 위한 인터페이스 계층입니다.', chain: '분리된 메모리 자원 → coherent link → 용량 활용·확장성', role: '대표 역할: 로컬 메모리와 풀링 메모리 사이의 시스템 설계 선택 제공', kpi: '지연·대역폭·coherency overhead·pool utilization·지원 생태계' },
  'foundry-design-ecosystem': { definition: '설계 생태계는 EDA·IP·PDK·설계서비스·고객 설계팀이 제조 플랫폼을 사용 가능하게 만드는 층입니다.', chain: '공정 규칙 → 검증·IP·설계도구 → tape-out 가능성', role: '대표 역할: 공정 성능을 실제 고객 칩으로 변환', kpi: 'IP 준비도·PDK 안정성·설계비·tape-out·고객 수' },
  'foundry-materials': { definition: '반도체 소재·화학물질은 웨이퍼 표면을 만들고 패턴·식각·세정을 가능하게 합니다.', chain: '원재료·순도 → 공정 반응 → 결함·수율·양산 안정성', role: '대표 역할: 장비와 함께 공정 조건과 양품률을 결정', kpi: '순도·공급 안정성·불량률·원가·qualification 기간' },
  'package-3d-stacking': { definition: '3D 적층은 칩이나 메모리를 수직으로 쌓아 연결 거리와 면적을 줄이는 패키징 방식입니다.', chain: '다이 적층 → 수직 연결·열 제거 → 밀도·대역폭·수율', role: '대표 역할: 시스템 집적도를 높이되 열과 검사 난도를 함께 증가', kpi: '적층 수·열저항·bonding 수율·대역폭·테스트 비용' },
  'package-interposer': { definition: '인터포저·브리지는 칩렛과 메모리를 짧고 넓은 연결로 묶는 중간 연결 계층입니다.', chain: '다이 → 인터포저·브리지 → 신호 무결성·대역폭·패키지 크기', role: '대표 역할: 서로 다른 다이의 고밀도 연결을 지원', kpi: '배선 밀도·신호 손실·패키지 수율·원가·공급능력' },
  'package-substrate': { definition: 'ABF·FC-BGA 기판은 패키지와 보드 사이에서 전력·신호·기계적 지지를 제공합니다.', chain: '패키지 다이 → 기판 배선 → 보드·서버 시스템', role: '대표 역할: 고성능 패키지의 연결·전력 전달·열 경로 제공', kpi: '층수·미세배선·크기·수율·lead time·원가' },
  'package-glass': { definition: '유리기판은 대형 패키지와 미세 배선의 기계·전기적 요구를 해결하려는 개발 방향입니다.', chain: '패키지 확대 → 평탄성·치수 안정성 → 신호·조립 조건', role: '대표 역할: 차세대 기판의 후보가 되지만 양산·원가·생태계 검증이 필요', kpi: '평탄성·열팽창·절연 특성·패널 수율·장비 호환성' },
  'network-switch': { definition: '스위치 실리콘은 서버·가속기·랙 사이의 패킷을 전달하고 경로를 제어합니다.', chain: '분산 계산 → 패킷 스위칭 → 클러스터 처리량·지연', role: '대표 역할: scale-out 시스템의 통신 병목과 토폴로지를 결정', kpi: '포트 속도·처리량·지연·전력/bit·버퍼·소프트웨어 기능' },
  'network-optical-module': { definition: '광학 모듈은 전기 신호를 광으로 바꾸고 다시 전기 신호로 복원해 데이터센터 링크를 구성합니다.', chain: '스위치 전기 신호 → 광 변환·전송 → 랙·행·센터 연결', role: '대표 역할: 거리와 대역폭이 커질 때 전기 링크를 보완', kpi: '거리·대역폭·전력/bit·오류율·수율·모듈 원가' },
  'network-fabric': { definition: 'AI cluster fabric은 다수의 가속기와 스위치를 하나의 분산 시스템처럼 연결하는 네트워크 구조입니다.', chain: '모델 병렬화 → 토폴로지·프로토콜 → 집단 통신·완료시간', role: '대표 역할: 가속기 수를 늘려도 통신 효율을 유지하는 시스템 층', kpi: 'all-reduce 효율·bisection bandwidth·tail latency·가동률·전력' },
  'aidc-thermal-design': { definition: '열 설계는 칩에서 발생한 열을 냉각 장치와 시설로 전달해 안정적인 동작 온도를 유지합니다.', chain: '칩 전력 → TIM·cold plate·loop → 시설 열 배출', role: '대표 역할: 고밀도 서버의 성능 지속성과 장애율을 결정', kpi: 'junction 온도·열저항·냉각 용량·팬/펌프 전력·장애율' },
  'aidc-server-platform': { definition: '서버 플랫폼은 가속기·CPU·메모리·스토리지·전원·네트워크를 하나의 운영 단위로 통합합니다.', chain: '부품 조합 → 보드·섀시·랙 → workload 실행', role: '대표 역할: 부품 성능을 실제 배치·운영 가능한 시스템으로 변환', kpi: '성능/랙·전력·서비스성·조달 lead time·가동률' },
  'aidc-pue': { definition: 'PUE는 데이터센터 전체 에너지와 IT 장비 에너지의 비율로 시설 오버헤드를 보는 지표입니다.', chain: 'IT 부하 → 냉각·전력변환·시설 오버헤드 → 총 에너지', role: '대표 역할: 서버 효율과 시설 효율을 분리해 비교', kpi: 'PUE·WUE·IT load·냉각 전력·계절별 변동' },
  'power-it-load': { definition: 'IT load는 가속기·서버·네트워크가 실제로 소비하는 전력입니다.', chain: '모델 workload → 장비 사용률 → 랙·시설 전력 수요', role: '대표 역할: AI 수요를 전력망이 처리해야 하는 물리량으로 번역', kpi: 'kW/랙·평균/피크 부하·전력당 처리량·가동률·전력 품질' },
  'power-generation': { definition: '발전 믹스는 데이터센터가 사용할 전력이 어떤 발전원과 계약·시장 구조에서 나오는지 보여줍니다.', chain: '전력 수요 → 발전·계약·시장 → 가격·탄소·신뢰도', role: '대표 역할: 전력의 양뿐 아니라 비용·시간대·정책 제약을 설명', kpi: '가용 용량·가격·계통 예비력·탄소강도·계약기간' },
  'power-transmission': { definition: '송전·변전은 발전된 전력을 대규모 부하까지 전달하고 전압을 변환하는 계통 계층입니다.', chain: '발전소 → 송전선·변전소 → 데이터센터 접속', role: '대표 역할: 발전 용량이 있어도 실제 접속 가능한지 결정', kpi: '접속 용량·혼잡·변압기 lead time·신뢰도·증설 기간' },
  'power-transformer': { definition: '변압기·스위치기어는 전압을 바꾸고 전력 흐름을 보호·분배하는 핵심 전력 장비입니다.', chain: '계통 전압 → 변압·보호·분배 → 시설 IT load', role: '대표 역할: 전력 인입을 실제 서버 전원으로 변환', kpi: 'MVA 용량·효율·납기·고장률·유지보수·보호 등급' },
  'edge-memory-power': { definition: '엣지 메모리·전력 envelope는 기기 안에서 모델 크기·지연·배터리 사이의 상한을 정합니다.', chain: '모델·센서 → 메모리 접근·전력 → 배터리·열·지연', role: '대표 역할: 클라우드 모델을 기기에 옮길 수 있는 조건을 결정', kpi: '모델 메모리·대역폭·추론 전력·배터리 시간·열 한계' },
  'physical-ai-sensing': { definition: '센싱·인식은 카메라·라이다·힘 센서 등에서 물리 세계의 상태를 추정하는 단계입니다.', chain: '환경 신호 → 센서·perception → 상태 추정·불확실성', role: '대표 역할: 제어기가 사용할 입력의 정확도·지연·안전성을 결정', kpi: '정확도·지연·오탐/미탐·센서 비용·조도/환경 강건성' },
  'physical-ai-digital-twin': { definition: '시뮬레이션·디지털 트윈은 실제 장비와 환경의 상태·행동을 가상 공간에서 시험하는 모델입니다.', chain: '물리 시스템 → 모델·시뮬레이션 → 계획·검증·현장 전이', role: '대표 역할: 실제 시험 비용과 위험을 줄이고 데이터 부족을 보완', kpi: 'sim-to-real gap·시뮬레이션 속도·현실성·검증 커버리지·운영 비용' },
  'economics-capex': { definition: 'CAPEX·리스는 장비·시설을 확보하기 위해 현재 현금과 미래 지급 의무를 투입하는 방식입니다.', chain: '수요 전망 → 장기 투자·리스 → 감가상각·고정비·공급능력', role: '대표 역할: 성장 투자와 자본 부담을 같은 표에서 읽게 함', kpi: 'CAPEX·리스부채·CAPEX/매출·가동률·회수기간' },
  'economics-depreciation': { definition: '감가상각과 내용연수는 자산 원가를 사용기간에 배분하는 회계·경제 가정입니다.', chain: '자산 취득 → 내용연수·잔존가치 → 기간별 비용·장부가', role: '대표 역할: 장비 세대 교체와 이익률·현금흐름의 시차를 설명', kpi: '내용연수·감가상각비·장부가·폐기·자산 세대 전환' },
  'economics-fcf': { definition: 'FCF와 funding은 영업에서 남은 현금이 투자·부채·자본조달을 어떻게 감당하는지 보여줍니다.', chain: '매출·마진 → 영업현금 → CAPEX·리스·차입 → 잉여현금', role: '대표 역할: 회계상 성장과 실제 자금 조달 여력을 분리', kpi: 'FCF·CAPEX·순부채·이자보상·자금조달 비용·만기' },
  'physical-ai-perception': { definition: '센서 융합은 카메라·라이다·힘 센서 등 서로 다른 관측을 하나의 상태 추정으로 결합합니다.', chain: '환경 신호 → 센서 융합 → 상태 추정 → 계획·제어', role: '대표 역할: 물리 시스템이 볼 수 있는 세계의 품질과 불확실성 결정', kpi: '정확도·지연·오탐/미탐·환경 강건성·센서 비용' },
  'physical-ai-world-model': { definition: '월드 모델은 행동에 따른 환경 변화를 예측하는 내부 모델입니다.', chain: '관측·시뮬레이션 → 상태·동역학 모델 → 계획·검증', role: '대표 역할: 실제 시행착오를 줄이고 긴 행동 순서를 시험', kpi: 'sim-to-real gap·예측오차·rollout 비용·검증 커버리지' },
  'physical-ai-planning': { definition: '계획과 제어는 목표·제약·피드백을 사용해 안전한 행동 순서를 만듭니다.', chain: '목표·상태 → 계획 → 행동 → feedback 보정', role: '대표 역할: 모델 출력을 실제 작업 순서로 변환', kpi: '완료율·지연·실패율·재계획 횟수·안전 위반' },
  'physical-ai-actuation': { definition: '구동과 안전은 계산된 명령을 모터·그리퍼·차량의 물리적 힘으로 전달하는 계층입니다.', chain: '제어 명령 → actuator·전력 → 움직임·안전 상태', role: '대표 역할: 디지털 예측과 현실 행동 사이의 마지막 검증 게이트', kpi: '정밀도·응답시간·고장률·안전 정지·유지보수 비용' },
  'physical-ai-unit-economics': { definition: '로봇 단위경제성은 장비 한 대가 만드는 작업 가치와 하드웨어·운영·감가 비용을 비교합니다.', chain: '작업량·품질 → 시간당 가치 → 장비·서비스·현장 비용', role: '대표 역할: 데모를 반복 가능한 고객 ROI로 변환하는 기준', kpi: '가동률·작업당 비용·회수기간·고장시간·고객 유지율' },
  'defense-kill-chain': { definition: '탐지에서 결정·행동·평가로 이어지는 kill chain은 센서와 효과의 시간 연결을 보여줍니다.', chain: '탐지 → 식별 → 결정 → 행동 → 피해 평가', role: '대표 역할: 개별 장비보다 전체 임무 시스템의 병목을 확인', kpi: '탐지 지연·식별 정확도·결정 시간·통신 가용성·효과' },
  'defense-c2-isr-ew': { definition: 'C2·ISR·EW는 지휘통제, 정보·감시·정찰, 전자전을 연결하는 방산 시스템 층입니다.', chain: '센서·통신 → 정보 융합 → 지휘·전자 대응', role: '대표 역할: 자율 플랫폼이 전장 네트워크에서 작동하는 조건 설명', kpi: '통신 가용성·재밍 내성·센서 범위·데이터 지연·상호운용성' },
  'defense-autonomy': { definition: '자율성은 사람이 개입하는 방식과 시스템이 판단·행동하는 범위를 함께 정하는 설계 문제입니다.', chain: '규칙·모델 → 인간 승인·감독 → 시스템 행동', role: '대표 역할: 성능뿐 아니라 책임·규칙·안전의 경계를 명시', kpi: 'human-in/on-the-loop·오판율·감사로그·fail-safe·훈련 커버리지' },
  'defense-drone-production': { definition: '드론 생산과 소모는 단가·납기·수리·재보급이 임무 지속성을 결정하는 제조 문제입니다.', chain: '부품·조립 → 배치·운용 → 손실·수리·재보급', role: '대표 역할: 한 번의 시연을 지속 가능한 생산·운용 능력으로 구분', kpi: '월 생산량·단가·납기·고장/손실률·부품 공통화' },
  'defense-procurement-economics': { definition: '조달 경제성은 예산·요구사항·시험·계약·유지비가 장기간의 국방 수요를 만드는 구조입니다.', chain: '임무 요구 → 시험·조달 → 배치·유지·개량', role: '대표 역할: 발표된 기술과 실제 반복 매출의 시간차를 설명', kpi: '수주잔고·계약기간·초도율·유지보수·예산 의존도' },
  'space-rocket-physics': { definition: '로켓 물리는 질량비·추력·비추력·궤도 에너지가 발사 가능성과 비용을 결정하는 기초입니다.', chain: '추진제·구조 질량 → 추력·delta-v → 궤도 투입', role: '대표 역할: 발사 성능을 마케팅 문구가 아닌 물리 제약으로 읽기', kpi: 'payload·추력·비추력·질량비·발사 성공률' },
  'space-reusability': { definition: '재사용성은 회수만이 아니라 검사·정비·재비행까지 포함한 turnaround 시스템입니다.', chain: '회수 → 검사·정비 → 재비행 → 자산 회전율', role: '대표 역할: 발사 단가를 실제 운영 경제성으로 연결', kpi: 'turnaround 기간·재비행 횟수·정비비·성공률·고정비 흡수' },
  'space-satellite-economics': { definition: '위성 경제성은 우주 자산이 관측·통신·항법 데이터를 지상 고객의 반복 지불로 바꾸는 방식입니다.', chain: '위성·주파수 → 데이터·서비스 → 고객·계약·현금흐름', role: '대표 역할: 발사 성공과 서비스 수익을 별도 검증', kpi: '위성 수명·가동률·ARPU·계약갱신·지상 인프라 비용' },
  'space-artemis-architecture': { definition: 'Artemis architecture는 발사체·우주선·착륙선·통신·지상 운영을 묶는 프로그램 구조입니다.', chain: '임무 목표 → 구성요소·인터페이스 → 일정·예산·운영', role: '대표 역할: 단일 제품이 아니라 다기관 시스템의 의존성 확인', kpi: '마일스톤·예산·인터페이스 readiness·발사 창·지연' },
  'space-aircraft-supply-chain': { definition: '항공·우주 공급망은 인증·품질·납기·소량 생산이 결합된 고신뢰 제조 생태계입니다.', chain: '소재·부품 → 인증·통합 → 항공기·우주 시스템', role: '대표 역할: 기술 수요가 실제 출하와 반복 계약으로 전환되는 조건 설명', kpi: 'backlog·인증 기간·불량률·납기·단일 공급자 의존도' },
  'application-healthcare': { definition: '헬스케어 AI는 데이터·모델을 진단·임상·운영 workflow와 지불자에 연결해야 합니다.', chain: '의료 데이터 → 모델 → 임상 workflow → 환자·지불자 ROI', role: '대표 역할: 정확도와 임상 유용성·규제·상환을 분리', kpi: '민감도·특이도·workflow 시간·규제 상태·상환·의사 채택' },
  'application-manufacturing': { definition: '제조 AI는 센서·공정 데이터·예측·제어를 생산성과 품질 개선으로 연결합니다.', chain: '설비·공정 데이터 → 모델 → 조정·예방정비 → 수율·가동률', role: '대표 역할: 모델 성능을 실제 line outcome으로 검증', kpi: 'OEE·수율·스크랩·downtime·현장 배포 비용' },
  'application-automotive': { definition: '자동차 자율성은 인지·계획·제어·안전·차량 플랫폼이 함께 검증되는 응용입니다.', chain: '센서·지도 → 인지·계획 → 차량 제어 → 안전·서비스', role: '대표 역할: 기능 데모와 대규모 배포·책임 구조를 구분', kpi: '개입률·안전 사건·주행거리·센서 비용·소프트웨어 매출' },
  'application-finance': { definition: '금융 AI는 데이터·모델이 승인·사기·리서치·고객지원의 의사결정으로 들어가는 workflow입니다.', chain: '거래·고객 데이터 → 모델 → 결정·검토 → 손실·수익·규제', role: '대표 역할: 정확도뿐 아니라 설명·공정성·권한·감사 가능성 확인', kpi: '오탐/미탐·손실률·처리시간·검토율·규제 예외' },
  'application-roi-payer': { definition: '응용 AI의 ROI는 모델 비용이 아니라 구매자가 지불하는 개선된 결과와 전환 비용의 차이입니다.', chain: '업무 개선 → 지불자 가치 → 도입·통합 비용 → 반복 계약', role: '대표 역할: 기술 사용량과 실제 지불 의사를 분리', kpi: 'payback·사용률·갱신률·인력 절감·통합 비용·마진' },
  'resources-copper': { definition: '구리와 도체는 전력망·모터·서버·데이터센터의 전기 전달을 담당하는 산업 소재입니다.', chain: '광산·정제 → 전선·부품 → 전력·통신·산업 설비', role: '대표 역할: AI 수요를 전력 인프라의 물질 수요로 번역', kpi: '정제능력·품위·재고·가격·프로젝트 lead time·재활용률' },
  'resources-lithium': { definition: '리튬은 배터리 저장의 핵심 소재지만 화학계열·정제·가격·재활용 조건이 중요합니다.', chain: '광산·정제 → 양극재·셀 → 저장·이동성', role: '대표 역할: 배터리 수요와 광물 가격을 단순히 동일시하지 않기', kpi: '정제량·셀 원가·에너지 밀도·cycle life·가격·재활용' },
  'resources-rare-earths': { definition: '희토류와 자석은 모터·풍력·방산 등 높은 자력과 소형화가 필요한 시스템에 들어갑니다.', chain: '채굴·분리 → 자석·모터 → 로봇·차량·방산', role: '대표 역할: 매장량보다 분리·정제·대체·지역 집중을 확인', kpi: '분리능력·중국 의존도·대체재·원가·수출 제한' },
  'resources-refining': { definition: '정제와 재활용은 채굴량을 실제 사용 가능한 고순도 소재 공급으로 바꾸는 공정입니다.', chain: '원광·폐기물 → 정제·재활용 → 규격 소재·공급 안정성', role: '대표 역할: 자원 풍부함과 상업적 공급능력의 차이 설명', kpi: '회수율·순도·처리량·허가·에너지 비용·폐기물' },
  'resources-industrial-equipment': { definition: '산업 장비 병목은 대형 설비의 제작·설치·인증·서비스 능력이 수요 확장을 제한하는 현상입니다.', chain: '수요 증가 → 장비 주문·제작 → 설치·가동 → 생산능력', role: '대표 역할: 소재 가격과 장비 공급의 시간 지연을 함께 읽기', kpi: '수주잔고·납기·설치 기반·서비스 매출·공급자 집중' },
  'policy-export-controls': { definition: '수출통제는 특정 기술·장비·소프트웨어의 국가 간 이전을 제한하는 정책 장치입니다.', chain: '안보 목표 → 허가·규제 → 공급망·고객·대체 기술', role: '대표 역할: 기술 경쟁을 제품 성능뿐 아니라 접근권의 문제로 확장', kpi: '통제 품목·허가 기간·대상 국가·대체 가능성·매출 노출' },
  'policy-supply-chain-resilience': { definition: '공급망 회복력은 한 충격 이후 조달·생산·대체·재고가 기능을 유지하고 복구하는 능력입니다.', chain: '지역·공급자 집중 → 충격 → 재고·대체·다변화 → 복구', role: '대표 역할: 효율성과 회복력 사이의 자본비용을 확인', kpi: '공급자 수·lead time·재고일수·대체 인증·지역 집중' },
  'policy-semiconductor-incentives': { definition: '반도체 인센티브는 세제·보조금·인프라·인력 정책으로 생산능력과 지역 투자를 유도합니다.', chain: '정책 지원 → 공장·장비 투자 → 고용·공급망·재정 부담', role: '대표 역할: 발표된 지원액과 실제 집행·수익성·추가 자본을 구분', kpi: '지원금·조건·집행률·민간 매칭·가동 시점·고용' },
  'policy-cybersecurity': { definition: '사이버보안과 sovereign AI는 데이터·모델·인프라를 외부 공격과 관할권 위험에서 보호하는 층입니다.', chain: '데이터·모델·권한 → 공격·감사 → 보안 통제·복구', role: '대표 역할: AI 도입의 신뢰·규제·운영비를 산업 가치사슬에 포함', kpi: '사고·복구시간·권한 위반·감사 범위·보안 비용' },
  'policy-national-security-risk': { definition: '국가안보 위험은 기술·공급망·데이터·자본이 정책 목표와 충돌할 때 발생하는 하방 조건입니다.', chain: '전략 의존 → 정책 충격 → 접근·비용·수요 변화', role: '대표 역할: 지정학적 사건을 매출·조달·자본비용의 경로로 구체화', kpi: '노출 매출·대체 기간·규제 시나리오·보험·고객 지역' },
  'capital-company-role': { definition: '기업 역할은 가치사슬에서 누가 설계·제조·통합·유통·운영·지불을 담당하는지 구분합니다.', chain: '산업 수요 → 가치사슬 위치 → 제품·고객·현금흐름', role: '대표 역할: 종목명 대신 이익 풀과 병목의 소유자를 찾음', kpi: '시장·고객 집중·가격결정력·설치 기반·재투자' },
  'capital-revenue-quality': { definition: '매출 품질은 반복성·계약·고객 집중·현금 회수·취소 조건을 함께 읽는 프레임입니다.', chain: '계약·사용량 → 매출 인식 → 현금 회수·갱신', role: '대표 역할: 성장률과 지속 가능한 수요의 차이 확인', kpi: 'RPO·갱신률·순매출 유지율·채권·고객 집중·취소' },
  'capital-margin-structure': { definition: '마진 구조는 가격·원가·고정비·가동률·감가상각이 이익률로 번역되는 방식입니다.', chain: '수요·가격 → 변동·고정 비용 → 총마진·영업레버리지', role: '대표 역할: 매출 확대가 이익·현금 확대인지 검증', kpi: '총마진·단위 원가·가동률·감가상각·서비스 mix' },
  'capital-balance-sheet': { definition: '대차대조표와 자금조달은 성장 투자를 누가 부담하고 만기·금리 위험이 어디에 있는지 보여줍니다.', chain: 'CAPEX → 현금·부채·증자·리스 → 이자·희석·만기', role: '대표 역할: 기술 수요를 재무 생존성과 연결', kpi: '순부채·이자보상·만기·리스·FCF·희석' },
  'capital-market-expectation': { definition: '시장 기대는 기업의 미래 현금흐름·위험·금리·수급에 대한 집단적 가격 반영입니다.', chain: '공시·전망 → 기대 변화 → 유동성·가격·변동성', role: '대표 역할: 좋은 사업과 이미 반영된 가격을 분리', kpi: '예상·실제 차이·밸류에이션·거래량·변동성·포지셔닝' },
  'future-quantum': { definition: '양자 컴퓨팅은 중첩·얽힘·측정을 이용하는 계산 패러다임으로 아직 업무별 유용성과 오류 보정이 핵심 과제입니다.', chain: '양자 상태 → 회로·측정 → 오류 보정 → 특정 문제', role: '대표 역할: 물리적 가능성과 상업적 유용성을 분리', kpi: 'logical qubit·오류율·회로 깊이·유용한 작업·운영 비용' },
  'future-photonic-compute': { definition: '포토닉 컴퓨팅은 빛의 전파·변조·간섭을 계산과 데이터 이동에 활용하려는 접근입니다.', chain: '광 신호 → 변조·간섭 → 연산·통신 → 시스템 통합', role: '대표 역할: 광학 효율과 전자 제어·정밀도의 trade-off를 확인', kpi: '전력/연산·정확도·대역폭·변환 손실·제조 수율' },
  'future-neuromorphic': { definition: '뉴로모픽 시스템은 뇌의 사건 기반·메모리 근접 계산에서 영감을 받은 하드웨어·알고리즘입니다.', chain: '사건 입력 → 희소 연산·메모리 → 저전력 추론', role: '대표 역할: 특정 edge workload에서의 효율과 생태계 성숙도를 검증', kpi: 'event latency·전력·정확도·개발도구·양산성' },
  'future-new-energy': { definition: '차세대 에너지 시스템은 발전·저장·연료·열관리의 새로운 조합으로 전력과 탄소 제약을 해결하려는 영역입니다.', chain: '자원·변환 → 발전·저장 → 계통·수요 → 비용·규제', role: '대표 역할: 기술 효율과 상업적 설치·허가·금융의 간극 확인', kpi: 'LCOE·저장 지속시간·수명·건설 기간·보조금·안전' },
  'future-uncertainty-gate': { definition: '기술 불확실성 게이트는 연구 결과를 제품·생산·현금흐름 주장으로 승격하기 전 확인할 조건입니다.', chain: '논문·시연 → 반복성·규모화 → 인증·생산 → 고객 지불', role: '대표 역할: 미래 기술의 가능성과 현재 투자 사실을 분리', kpi: 'TRL·재현성·양산 상태·고객 검증·단위경제성·규제' }
});

function createTaxonomyGuide(documentRef, node) {
  const guide = ATLAS_CONCEPT_GUIDES[node.id] || {
    definition: `${TAXONOMY_NODE_LABELS[node.id] || node.title}는 ${node.kind} 관점에서 AI 가치사슬을 설명하는 구조적 개념입니다.`,
    chain: '수요·공정·제품·기업 역할을 연결한 뒤 검증된 출처와 기준일을 붙입니다.',
    role: '대표 역할: 해당 계층의 병목·제품·경제성을 분리해 확인',
    kpi: '출처가 제시한 성능·공급능력·비용·고객·현금흐름 지표를 기준일과 함께 확인',
    risk: '구조 설명을 특정 기업의 현재 실적·양산·시장점유율로 확대하지 않습니다.'
  };
  const block = element(documentRef, 'div', 'atlas-node-guide');
  block.append(element(documentRef, 'p', 'atlas-card-copy', guide.definition), element(documentRef, 'p', 'atlas-card-copy', `연결 논리: ${guide.chain}`), element(documentRef, 'p', 'atlas-card-copy', guide.role), element(documentRef, 'p', 'atlas-card-copy', `확인할 KPI: ${guide.kpi}`), element(documentRef, 'p', 'atlas-card-copy atlas-node-guide-risk', `실패·반대 시나리오: ${guide.risk || '수요·공급능력·원가·규제 조건이 달라지면 예상 경제성이 성립하지 않을 수 있습니다.'}`));
  block.appendChild(element(documentRef, 'p', 'atlas-card-copy atlas-node-guide-boundary', '현재 수치·목표가·매매 신호가 아닌 학습용 구조 설명입니다. 기업별 제품과 최신 수치는 연결된 1차 출처에서 별도로 확인합니다.'));
  return block;
}

function createDeepTaxonomyView(documentRef, node, deepTaxonomy, selectedTopicId) {
  const topics = (deepTaxonomy?.topics || []).filter((topic) => topic.anchorNodeIds?.includes(node.id));
  if (!topics.length) return null;
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId) || topics[0];
  const block = element(documentRef, 'section', 'atlas-deep-taxonomy');
  block.dataset.atlasDeepTopicTotal = String(deepTaxonomy?.topics?.length || 0);
  block.dataset.atlasDeepBranchTotal = String((deepTaxonomy?.topics || []).reduce((sum, topic) => sum + (topic.branches?.length || 0), 0));
  block.append(
    element(documentRef, 'p', 'atlas-learning-column-label', '4. 더 깊이 내려가기'),
    element(documentRef, 'h4', 'atlas-deep-taxonomy-heading', '세부 원리 트리')
  );
  if (topics.length > 1) {
    const tabs = element(documentRef, 'div', 'atlas-deep-topic-tabs');
    topics.forEach((topic) => {
      const button = actionButton(documentRef, `atlas-deep-topic-button${topic.id === selectedTopic.id ? ' is-active' : ''}`, topic.title, 'deep-topic', topic.id);
      button.setAttribute('aria-pressed', String(topic.id === selectedTopic.id));
      tabs.appendChild(button);
    });
    block.appendChild(tabs);
  }
  block.append(
    element(documentRef, 'h5', 'atlas-deep-topic-title', selectedTopic.title),
    element(documentRef, 'p', 'atlas-deep-topic-relation', selectedTopic.relation),
    element(documentRef, 'p', 'atlas-card-copy atlas-deep-topic-why', selectedTopic.why)
  );
  const tree = element(documentRef, 'div', 'atlas-deep-branch-tree');
  (selectedTopic.branches || []).forEach((branch, index) => {
    const detail = element(documentRef, 'details', 'atlas-deep-branch');
    if (index === 0) detail.open = true;
    detail.dataset.atlasDeepBranchId = branch.id;
    const summary = element(documentRef, 'summary', 'atlas-deep-branch-summary');
    summary.append(
      element(documentRef, 'span', 'atlas-deep-branch-index', String(index + 1).padStart(2, '0')),
      element(documentRef, 'strong', 'atlas-deep-branch-title', branch.title)
    );
    const content = element(documentRef, 'div', 'atlas-deep-branch-content');
    content.append(
      element(documentRef, 'p', 'atlas-card-copy', branch.summary),
      element(documentRef, 'p', 'atlas-card-copy', `작동 원리 · ${branch.mechanism}`),
      element(documentRef, 'p', 'atlas-card-copy atlas-deep-observe', `관찰 지표 · ${branch.observe}`),
      element(documentRef, 'p', 'atlas-card-copy atlas-node-guide-risk', `오해 방지 · ${branch.caution}`)
    );
    const children = element(documentRef, 'div', 'atlas-deep-children');
    (branch.children || []).forEach((child) => children.appendChild(element(documentRef, 'span', 'atlas-chip', child)));
    content.appendChild(children);
    detail.append(summary, content);
    tree.appendChild(detail);
  });
  block.appendChild(tree);
  if (selectedTopic.sources?.length) {
    const sources = element(documentRef, 'details', 'atlas-module-source-details atlas-deep-sources');
    sources.appendChild(element(documentRef, 'summary', 'atlas-module-source-summary', '공식 참고 자료'));
    const links = element(documentRef, 'div', 'atlas-domain-guide-links');
    selectedTopic.sources.forEach((source) => {
      const link = element(documentRef, 'a', 'atlas-reference-source-link', source.label);
      link.href = source.url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      links.appendChild(link);
    });
    sources.appendChild(links);
    block.appendChild(sources);
  }
  return block;
}

function createPlayerProductView(documentRef, node, registry) {
  if (!registry) return null;
  const players = (registry.players || []).filter((player) => player.taxonomyNodeIds?.includes(node.id));
  const products = (registry.products || []).filter((product) => product.taxonomyNodeIds?.includes(node.id));
  const coverage = (registry.nodeCoverage || []).find((item) => item.nodeId === node.id);
  if (!players.length && !products.length && !coverage) return null;
  const block = element(documentRef, 'section', 'atlas-player-product-map');
  block.append(element(documentRef, 'h4', 'atlas-player-product-title', '역할·제품군 reference map'));
  const grid = element(documentRef, 'div', 'atlas-player-product-grid');
  const productStatusLabel = (status) => ({
    MATURE: '서비스·제품 페이지 확인',
    RAMP: '확장 단계 참고 분류',
    RESEARCH: '연구·개발 참고 분류'
  })[status] || '상태 확인 전';
  players.forEach((player) => {
    const card = element(documentRef, 'article', 'atlas-player-card');
    card.dataset.atlasPlayerId = player.playerId;
    card.append(element(documentRef, 'strong', 'atlas-player-name', player.name), element(documentRef, 'p', 'atlas-card-copy', `역할: ${(player.roleIds || []).join(' · ')}`), element(documentRef, 'p', 'atlas-card-copy', `제품군: ${(player.productFamilies || []).join(' · ')}`), element(documentRef, 'p', 'atlas-card-copy', `확인 지표: ${(player.kpis || []).join(' · ')}`));
    const sourceIds = element(documentRef, 'p', 'atlas-card-copy atlas-player-product-boundary', `출처·기준일: ${(player.sourceIds || []).join(' · ') || '추가 출처 필요'} · 기준일 ${player.asOf || '미확정'} · 현재 실적·양산상태 아님`);
    card.appendChild(sourceIds);
    card.appendChild(createReferenceSourceLinks(documentRef, player.sourceIds, registry));
    grid.appendChild(card);
  });
  products.forEach((product) => {
    const card = element(documentRef, 'article', 'atlas-product-card');
    card.dataset.atlasProductId = product.productId;
    card.append(element(documentRef, 'strong', 'atlas-product-name', product.productId), element(documentRef, 'p', 'atlas-card-copy', `해결 문제: ${product.problemSolved}`), element(documentRef, 'p', 'atlas-card-copy', `입력 → 출력: ${(product.inputs || []).join(' · ')} → ${(product.outputs || []).join(' · ')}`), element(documentRef, 'p', 'atlas-card-copy', `기술 지표: ${(product.technicalMetrics || []).join(' · ')}`), element(documentRef, 'p', 'atlas-card-copy atlas-player-product-boundary', `경제 지표: ${(product.economicMetrics || []).join(' · ')} · 상태 참고 분류: ${productStatusLabel(product.productionStatus)} · 기준일 ${product.asOf || '미확정'}`));
    card.appendChild(createReferenceSourceLinks(documentRef, product.sourceIds, registry));
    grid.appendChild(card);
  });
  if (coverage) {
    const card = element(documentRef, 'article', 'atlas-coverage-card');
    card.dataset.atlasTaxonomyCoverageNode = coverage.nodeId;
    card.append(
      element(documentRef, 'strong', 'atlas-player-name', '전체 taxonomy coverage'),
      element(documentRef, 'p', 'atlas-card-copy', `역할: ${coverage.roleReference} · 분류: ${coverage.kind}`),
      element(documentRef, 'p', 'atlas-card-copy', `제품·서비스군: ${coverage.productFamilyReference}`),
      element(documentRef, 'p', 'atlas-card-copy', `상류 → 하류: ${(coverage.upstream || []).join(' · ') || '확장 필요'} → ${(coverage.downstream || []).join(' · ') || '확장 필요'}`),
      element(documentRef, 'p', 'atlas-card-copy atlas-player-product-boundary', `대표 연결: ${(coverage.representativePlayerIds || []).join(' · ') || '대표 player 추가 조사 필요'} · 현재 claim ${coverage.currentClaims} · 기준일 ${coverage.asOf || '현재값 없음'}`),
      element(documentRef, 'p', 'atlas-card-copy atlas-node-guide-boundary', `검증 질문: ${coverage.verificationQuestion}`)
    );
    const sourceLinks = element(documentRef, 'div', 'atlas-reference-source-links');
    (coverage.sourceIds || []).forEach((sourceId) => {
      const link = element(documentRef, 'span', 'atlas-chip', `source seed ${sourceId}`);
      sourceLinks.appendChild(link);
    });
    card.appendChild(sourceLinks);
    grid.appendChild(card);
  }
  block.appendChild(grid);
  block.appendChild(element(documentRef, 'p', 'atlas-card-copy atlas-node-guide-boundary', registry.boundary));
  return block;
}

function createDomainGuide(documentRef, domain, guide, packet, claimLedger) {
  if (!guide) return null;
  const block = element(documentRef, 'section', 'atlas-domain-guide');
  block.append(
    element(documentRef, 'h3', 'atlas-domain-detail-title', DOMAIN_LABELS[domain.id] || domain.title),
    element(documentRef, 'p', 'atlas-domain-detail-lede', guide.definition),
    element(documentRef, 'h4', 'atlas-detail-label', '어떻게 움직이는가'),
    element(documentRef, 'p', 'atlas-card-copy', guide.mechanism),
    element(documentRef, 'h4', 'atlas-detail-label', '무엇을 관찰해야 하는가'),
    element(documentRef, 'p', 'atlas-card-copy', guide.unit),
    element(documentRef, 'h4', 'atlas-detail-label', '어디에서 막히는가'),
    element(documentRef, 'p', 'atlas-card-copy atlas-domain-guide-bottleneck', guide.bottleneck),
    element(documentRef, 'p', 'atlas-domain-verification-question', `스스로 확인할 질문 · ${guide.verificationQuestion}`)
  );

  const evidence = element(documentRef, 'details', 'atlas-domain-evidence');
  evidence.appendChild(element(documentRef, 'summary', 'atlas-module-source-summary', '근거와 검증 메모 보기'));
  const links = element(documentRef, 'div', 'atlas-domain-guide-links');
  if (guide.sourceUrl) {
    const link = element(documentRef, 'a', 'atlas-reference-source-link', guide.sourceName || '공식 자료');
    link.href = guide.sourceUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.dataset.atlasDomainGuideSource = domain.id;
    links.appendChild(link);
  }
  evidence.appendChild(links);
  if (packet) {
    evidence.appendChild(element(documentRef, 'p', 'atlas-card-copy atlas-domain-guide-boundary', `검토일 ${packet.reviewedAt}`));
    const questions = element(documentRef, 'div', 'atlas-domain-packet-questions');
    (packet.evidenceQuestions || []).forEach((question) => questions.appendChild(element(documentRef, 'span', 'atlas-chip', question)));
    evidence.appendChild(questions);
    const packetLinks = element(documentRef, 'div', 'atlas-domain-guide-links atlas-domain-packet-links');
    (packet.sources || []).forEach((source) => {
      const sourceLink = element(documentRef, 'a', 'atlas-reference-source-link', source.publisher);
      sourceLink.href = source.url;
      sourceLink.target = '_blank';
      sourceLink.rel = 'noopener noreferrer';
      sourceLink.dataset.atlasDomainPacketSource = packet.id;
      packetLinks.appendChild(sourceLink);
    });
    evidence.appendChild(packetLinks);
  }
  const claims = (claimLedger?.claims || []).filter((claim) => claim.domainId === domain.id);
  if (claims.length) {
    const claimBlock = element(documentRef, 'div', 'atlas-domain-claim-ledger');
    claimBlock.appendChild(element(documentRef, 'strong', 'atlas-card-id', `검증 중인 구조 설명 ${claims.length}개`));
    claims.forEach((claim) => {
      const item = element(documentRef, 'p', 'atlas-card-copy');
      item.textContent = claim.statement;
      claimBlock.appendChild(item);
    });
    evidence.appendChild(claimBlock);
  }
  block.appendChild(evidence);
  return block;
}

function createResearchTaxonomyView(documentRef, research, query, registry, domainGuides, domainPackets, claimLedger, deepTaxonomy, selection = {}) {
  const view = element(documentRef, 'div', 'atlas-taxonomy-view');
  const guideById = new Map((domainGuides?.guides || []).map((guide) => [guide.id, guide]));
  const packetByDomainId = new Map((domainPackets?.packets || []).map((packet) => [packet.domainId, packet]));
  const domains = (research?.taxonomyDomains || []).filter((domain) => !query || [domain.id, domain.title, DOMAIN_LABELS[domain.id], domain.priority, domain.status, (domain.sourceSeeds || []).join(' '), ...(domain.nodes || []).map((node) => `${node.id} ${node.title} ${TAXONOMY_NODE_LABELS[node.id] || ''} ${node.kind}`)].join(' ').toLowerCase().includes(query));
  const selectedDomain = domains.find((domain) => domain.id === selection.domainId) || domains[0] || null;
  const selectedNode = selectedDomain?.nodes?.find((node) => node.id === selection.nodeId) || selectedDomain?.nodes?.[0] || null;
  view.dataset.atlasTaxonomyDomainTotal = String(research?.taxonomyDomains?.length || 0);
  view.dataset.atlasTaxonomyNodeTotal = String((research?.taxonomyDomains || []).reduce((sum, domain) => sum + (domain.nodes?.length || 0), 0));
  const intro = element(documentRef, 'div', 'atlas-subsection-intro');
  intro.append(
    element(documentRef, 'h2', 'atlas-section-title', 'AI 산업을 큰 시장에서 기업·제품까지 내려가며 읽기'),
    element(documentRef, 'p', 'atlas-card-copy', '산업을 먼저 선택하고, 그 산업 안의 공정·제품·사업모델을 하나씩 고르세요. 선택한 세부 노드에서 작동 원리, 병목, KPI와 연결된 기업·제품 역할을 확인할 수 있습니다.')
  );
  const levels = element(documentRef, 'div', 'atlas-level-rail');
  TAXONOMY_LEVELS.forEach((level, index) => {
    const card = element(documentRef, 'article', `atlas-level-card${index === TAXONOMY_LEVELS.length - 1 ? ' is-terminal' : ''}`);
    const display = taxonomyLevelDisplay(level);
    card.append(element(documentRef, 'span', 'atlas-level-id', level.id), element(documentRef, 'strong', 'atlas-level-label', display.label), element(documentRef, 'span', 'atlas-level-example', display.example));
    levels.appendChild(card);
  });
  const workspace = element(documentRef, 'div', 'atlas-industry-workspace');
  const domainList = element(documentRef, 'nav', 'atlas-industry-domain-list');
  domainList.setAttribute('aria-label', 'AI 산업 분류');
  domainList.appendChild(element(documentRef, 'p', 'atlas-learning-column-label', '1. 산업 선택'));
  domains.forEach((domain) => {
    const button = actionButton(documentRef, `atlas-industry-domain${selectedDomain?.id === domain.id ? ' is-active' : ''}`, '', 'domain', domain.id);
    button.setAttribute('aria-pressed', String(selectedDomain?.id === domain.id));
    button.append(
      element(documentRef, 'span', 'atlas-industry-domain-priority', domain.priority),
      element(documentRef, 'span', 'atlas-industry-domain-title', DOMAIN_LABELS[domain.id] || domain.title),
      element(documentRef, 'span', 'atlas-industry-domain-count', `${domain.nodes?.length || 0}개 세부 영역`)
    );
    domainList.appendChild(button);
  });
  if (!domains.length) domainList.appendChild(element(documentRef, 'div', 'atlas-empty', '일치하는 산업이 없습니다.'));

  const domainDetail = element(documentRef, 'div', 'atlas-industry-domain-detail');
  domainDetail.appendChild(element(documentRef, 'p', 'atlas-learning-column-label', '2. 세부 영역 선택'));
  if (selectedDomain) {
    const guide = createDomainGuide(documentRef, selectedDomain, guideById.get(selectedDomain.id), packetByDomainId.get(selectedDomain.id), claimLedger);
    if (guide) domainDetail.appendChild(guide);
    const nodeList = element(documentRef, 'div', 'atlas-industry-node-list');
    (selectedDomain.nodes || []).forEach((node, index) => {
      const button = actionButton(documentRef, `atlas-industry-node-button${selectedNode?.id === node.id ? ' is-active' : ''}`, '', 'domain-node', node.id);
      button.dataset.atlasNodeId = node.id;
      button.setAttribute('aria-pressed', String(selectedNode?.id === node.id));
      button.append(
        element(documentRef, 'span', 'atlas-learning-concept-index', String(index + 1).padStart(2, '0')),
        element(documentRef, 'span', 'atlas-industry-node-title', TAXONOMY_NODE_LABELS[node.id] || node.title),
        element(documentRef, 'span', 'atlas-node-class', `${node.layer} · ${node.kind}`)
      );
      nodeList.appendChild(button);
    });
    domainDetail.appendChild(nodeList);
  }

  const nodeDetail = element(documentRef, 'article', 'atlas-industry-node-detail');
  nodeDetail.appendChild(element(documentRef, 'p', 'atlas-learning-column-label', '3. 원리·기업·제품 연결'));
  if (selectedNode) {
    nodeDetail.append(
      element(documentRef, 'p', 'atlas-learning-breadcrumb', `${DOMAIN_LABELS[selectedDomain.id] || selectedDomain.title} · ${selectedNode.layer}`),
      element(documentRef, 'h3', 'atlas-learning-detail-title', TAXONOMY_NODE_LABELS[selectedNode.id] || selectedNode.title),
      createTaxonomyGuide(documentRef, selectedNode)
    );
    const deepView = createDeepTaxonomyView(documentRef, selectedNode, deepTaxonomy, selection.deepTopicId);
    if (deepView) nodeDetail.appendChild(deepView);
    const playerProduct = createPlayerProductView(documentRef, selectedNode, registry);
    if (playerProduct) nodeDetail.appendChild(playerProduct);
  } else {
    nodeDetail.appendChild(element(documentRef, 'div', 'atlas-empty', '왼쪽에서 산업과 세부 영역을 선택하세요.'));
  }
  workspace.append(domainList, domainDetail, nodeDetail);
  view.append(intro, levels, workspace);
  return view;
}

export function createAtlasPage({ root = globalThis, documentRef = root.document } = {}) {
  return {
    route: 'atlas',
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById('page-atlas');
      const content = page?.querySelector('[data-atlas-content]');
      if (!page || !content) return () => bag.dispose();
       const state = { tab: 'foundations', query: '', selectedLayerId: 'F1', selectedModuleId: 'energy-and-power', selectedDomainId: 'domain-cloud-platform', selectedDomainNodeId: 'cloud-hyperscaler', selectedDeepTopicId: '', research: null, foundations: null, foundationLessons: null, registry: null, domainGuides: null, domainPackets: null, claimLedger: null, deepTaxonomy: null, telegram: null, researchError: false, foundationsError: false, foundationLessonsError: false, registryError: false, domainGuidesError: false, domainPacketsError: false, claimLedgerError: false, deepTaxonomyError: false, telegramError: false };
      page.dataset.aioArchitectureRoute = 'atlas';
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioContentKind = 'REFERENCE';
      page.dataset.aioReviewedAt = REVIEWED_AT;

      const route = (routeId) => { if (typeof root?.showPage === 'function') root.showPage(routeId); };
      const render = () => {
        const toolbar = element(documentRef, 'div', 'atlas-toolbar');
        const tabs = element(documentRef, 'div', 'atlas-tabs');
        [['foundations', '학습 지도'], ['taxonomy', '산업·가치사슬'], ['overview', '근거 자료실']].forEach(([value, label]) => tabs.appendChild(actionButton(documentRef, `atlas-tab${state.tab === value ? ' is-active' : ''}`, label, 'tab', value)));
        const searchLabel = element(documentRef, 'label', 'atlas-search');
        searchLabel.appendChild(element(documentRef, 'span', 'atlas-sr-only', 'Atlas 검색'));
        const input = element(documentRef, 'input', 'atlas-search-input');
        input.type = 'search';
        input.placeholder = 'packet·lesson·node 검색';
        input.value = state.query;
        input.setAttribute('aria-label', 'Atlas 검색');
        input.addEventListener('input', (event) => {
          state.query = String(event.target.value || '').trim().toLowerCase();
          render();
          const nextInput = content.querySelector('.atlas-search-input');
          if (nextInput) {
            nextInput.focus();
            nextInput.setSelectionRange(nextInput.value.length, nextInput.value.length);
          }
        });
        searchLabel.appendChild(input);
        toolbar.append(tabs, searchLabel);
        const body = element(documentRef, 'div', 'atlas-body');
        if (state.tab === 'taxonomy') {
           body.appendChild(state.research?.taxonomyDomains ? createResearchTaxonomyView(documentRef, state.research, state.query, state.registry, state.domainGuides, state.domainPackets, state.claimLedger, state.deepTaxonomy, { domainId: state.selectedDomainId, nodeId: state.selectedDomainNodeId, deepTopicId: state.selectedDeepTopicId }) : createTaxonomyView(documentRef));
        } else if (state.tab === 'foundations') {
          const tracks = FOUNDATION_TRACKS.filter((track) => !state.query || [track.id, track.title, track.duration, track.summary, track.nodes.join(' ')].join(' ').toLowerCase().includes(state.query));
          if (!state.query) {
            const pathDetails = element(documentRef, 'details', 'atlas-learning-paths');
            pathDetails.appendChild(element(documentRef, 'summary', 'atlas-learning-paths-summary', '목적별 추천 학습 경로 보기'));
            const grid = element(documentRef, 'div', 'atlas-track-grid');
            tracks.forEach((track) => grid.appendChild(createTrackCard(documentRef, track)));
            pathDetails.appendChild(grid);
            body.appendChild(pathDetails);
          }
          if (state.foundations) body.appendChild(createCurriculumView(documentRef, state.foundations, state.query, state.foundationLessons, { layerId: state.selectedLayerId, moduleId: state.selectedModuleId }));
          if (state.foundationsError) body.appendChild(element(documentRef, 'div', 'atlas-empty', 'Curriculum artifact could not be loaded; summary tracks remain available.'));
          if (state.foundationLessonsError) body.appendChild(element(documentRef, 'div', 'atlas-empty', 'Authored lesson artifact could not be loaded; the reference frame remains available.'));
        } else {
          const packetMeta = new Map((state.research?.packets || []).map((packet) => [packet.id, packet]));
          const packets = ATLAS_PACKETS.map((packet) => ({ ...packet, ...(packetMeta.get(packet.id) || {}) })).filter((packet) => !state.query || [packet.id, packet.title, packet.scope, packet.status].join(' ').toLowerCase().includes(state.query));
          const metrics = element(documentRef, 'div', 'atlas-metric-grid');
          metrics.replaceChildren();
          const research = state.research;
          [['공식 1차 출처', String(research?.sources?.length || 0)], ['검토 후보 노드', String(research?.nodes?.length || 0)], ['Telegram 역할', '발견 보조'], ['현재 주장', String(research?.publication?.currentClaims || 0)]].forEach(([label, value]) => { const card = element(documentRef, 'div', 'atlas-metric'); card.append(element(documentRef, 'span', 'atlas-metric-label', label), element(documentRef, 'strong', 'atlas-metric-value', value)); metrics.appendChild(card); });
          const grid = element(documentRef, 'div', 'atlas-packet-grid');
          packets.forEach((packet) => grid.appendChild(createPacketCard(documentRef, packet)));
          if (!packets.length) grid.appendChild(element(documentRef, 'div', 'atlas-empty', '검색 결과가 없습니다.'));
          const note = element(documentRef, 'div', 'atlas-governance-note');
          note.append(element(documentRef, 'strong', '', '출판 게이트'), element(documentRef, 'p', '', 'Telegram은 keyword·framework·source-link 발견용입니다. 공식 primary source와 evidence ledger가 검토되기 전에는 CURRENT 숫자, shipment, yield, valuation, 매매 신호로 승격하지 않습니다.'));
          const links = element(documentRef, 'div', 'atlas-route-links');
          const principles = actionButton(documentRef, 'atlas-route-button', '시장 원리로 이동', 'route', 'principles');
          const masters = actionButton(documentRef, 'atlas-route-button is-secondary', '13F 경계 보기', 'route', 'masters');
          principles.addEventListener('click', () => route('principles'));
          masters.addEventListener('click', () => route('masters'));
          links.append(principles, masters);
           body.append(metrics, grid, note, links);
           if (research) body.appendChild(createResearchView(documentRef, research, state.query));
           const telegramView = createTelegramReferenceView(documentRef, state.telegram, state.query);
           if (telegramView) body.appendChild(telegramView);
          if (state.researchError) body.appendChild(element(documentRef, 'div', 'atlas-empty', 'Research artifact could not be loaded; structural packet view remains available.'));
        }
        content.replaceChildren(toolbar, body);
        const resultCount = page.querySelector('[data-atlas-result-count]');
         if (resultCount) resultCount.textContent = state.tab === 'foundations' ? `기초 개념 ${state.foundations?.moduleIndex?.length || 48}개 · 학습 원고 연결 · 근거는 접힘` : state.tab === 'taxonomy' ? `산업 분류 19개 · 구조 노드 95개 · 근거는 상세` : `연구 패킷 ${ATLAS_PACKETS.length}개 · 공식 출처 ${state.research?.sources?.length || 0}개`;
      };
      const onClick = (event) => {
        const target = event.target.closest?.('[data-atlas-action]');
        if (!target || !page.contains(target)) return;
        const action = target.dataset.atlasAction;
        const value = target.dataset.atlasValue;
        if (action === 'tab') {
          state.tab = value;
          state.query = '';
        }
        if (action === 'layer') {
          state.selectedLayerId = value;
          const layer = state.foundations?.layers?.find((item) => item.id === value);
          state.selectedModuleId = (layer?.modules || []).find((id) => state.foundations?.moduleIndex?.some((module) => module.id === id)) || '';
        }
        if (action === 'module') {
          state.selectedModuleId = value;
          const currentLayer = state.foundations?.layers?.find((item) => item.id === state.selectedLayerId);
          if (!currentLayer?.modules?.includes(value)) {
            const module = state.foundations?.moduleIndex?.find((item) => item.id === value);
            if (module?.layer) state.selectedLayerId = module.layer;
          }
        }
        if (action === 'domain') {
          state.selectedDomainId = value;
          const domain = state.research?.taxonomyDomains?.find((item) => item.id === value);
          state.selectedDomainNodeId = domain?.nodes?.[0]?.id || '';
          state.selectedDeepTopicId = state.deepTaxonomy?.topics?.find((topic) => topic.anchorNodeIds?.includes(state.selectedDomainNodeId))?.id || '';
        }
        if (action === 'domain-node') {
          state.selectedDomainNodeId = value;
          state.selectedDeepTopicId = state.deepTaxonomy?.topics?.find((topic) => topic.anchorNodeIds?.includes(value))?.id || '';
        }
        if (action === 'deep-topic') state.selectedDeepTopicId = value;
        if (action !== 'route') {
          event.preventDefault();
          render();
          if (action === 'module') content.querySelector('[data-atlas-learning-detail-title]')?.focus({ preventScroll: true });
        }
      };
      page.addEventListener('click', onClick);
      bag.add(() => page.removeEventListener('click', onClick));
         bag.add(() => { delete page.dataset.aioArchitectureRoute; delete page.dataset.aioArchitectureRenderer; delete page.dataset.aioContentKind; delete page.dataset.aioReviewedAt; delete page.dataset.aioAtlasResearch; delete page.dataset.aioAtlasFoundations; delete page.dataset.aioAtlasFoundationLessons; delete page.dataset.aioAtlasRegistry; delete page.dataset.aioAtlasDomainGuides; delete page.dataset.aioAtlasDomainPackets; delete page.dataset.aioAtlasClaims; delete page.dataset.aioAtlasTaxonomyCoverage; delete page.dataset.aioAtlasDeepTaxonomy; delete page.dataset.aioAtlasTelegram; delete page.dataset.aioAtlasCurrentness; content.replaceChildren(); });
      render();
      const fetchFn = root?.fetch || globalThis.fetch;
       if (typeof fetchFn === 'function') {
         const loadJson = (url) => fetchFn(url).then((response) => { if (!response.ok) throw new Error(`Atlas artifact ${response.status}`); return response.json(); });
          Promise.all([loadJson(RESEARCH_URL), loadJson(FOUNDATIONS_URL), loadJson(FOUNDATIONS_LESSONS_URL), loadJson(DOMAIN_GUIDES_URL), loadJson(DOMAIN_PACKETS_URL), loadJson(DOMAIN_CLAIMS_URL), loadJson(TAXONOMY_COVERAGE_URL), loadJson(DEEP_TAXONOMY_URL), loadJson(TELEGRAM_REFERENCE_URL), loadJson(PLAYER_PRODUCT_URL), loadJson(PLAYER_PRODUCT_CURRENTNESS_URL)])
            .then(([research, foundations, foundationLessons, domainGuides, domainPackets, claimLedger, taxonomyCoverage, deepTaxonomy, telegram, registry, currentness]) => { state.research = research; state.foundations = foundations; state.foundationLessons = { ...foundationLessons, byId: Object.fromEntries((foundationLessons.lessons || []).map((lesson) => [lesson.id, lesson])) }; state.domainGuides = domainGuides; state.domainPackets = domainPackets; state.claimLedger = claimLedger; state.deepTaxonomy = deepTaxonomy; state.telegram = telegram; state.registry = { ...mergePlayerProductCurrentness(registry, currentness), nodeCoverage: taxonomyCoverage.nodes || [] }; page.dataset.aioAtlasResearch = 'connected'; page.dataset.aioAtlasFoundations = 'connected'; page.dataset.aioAtlasFoundationLessons = 'connected'; page.dataset.aioAtlasDomainGuides = 'connected'; page.dataset.aioAtlasDomainPackets = 'connected'; page.dataset.aioAtlasClaims = 'connected'; page.dataset.aioAtlasTaxonomyCoverage = 'connected'; page.dataset.aioAtlasDeepTaxonomy = 'connected'; page.dataset.aioAtlasTelegram = 'connected'; page.dataset.aioAtlasCurrentness = 'connected'; page.dataset.aioAtlasRegistry = 'connected'; render(); })
            .catch(() => { state.researchError = true; state.foundationsError = true; state.foundationLessonsError = true; state.domainGuidesError = true; state.domainPacketsError = true; state.claimLedgerError = true; state.deepTaxonomyError = true; state.telegramError = true; state.registryError = true; page.dataset.aioAtlasResearch = 'fallback'; page.dataset.aioAtlasFoundations = 'fallback'; page.dataset.aioAtlasFoundationLessons = 'fallback'; page.dataset.aioAtlasDomainGuides = 'fallback'; page.dataset.aioAtlasDomainPackets = 'fallback'; page.dataset.aioAtlasClaims = 'fallback'; page.dataset.aioAtlasTaxonomyCoverage = 'fallback'; page.dataset.aioAtlasDeepTaxonomy = 'fallback'; page.dataset.aioAtlasTelegram = 'fallback'; page.dataset.aioAtlasRegistry = 'fallback'; render(); });
       }
      return () => bag.dispose();
    }
  };
}

export { ATLAS_PACKETS, FOUNDATION_TRACKS, TAXONOMY_LEVELS, REPRESENTATIVE_NODES, RESEARCH_URL, FOUNDATIONS_URL, FOUNDATIONS_LESSONS_URL, DOMAIN_GUIDES_URL, DOMAIN_PACKETS_URL, DOMAIN_CLAIMS_URL, TAXONOMY_COVERAGE_URL, DEEP_TAXONOMY_URL, TELEGRAM_REFERENCE_URL, PLAYER_PRODUCT_URL, PLAYER_PRODUCT_CURRENTNESS_URL };
