import { createResourceBag } from '../../app/lifecycle.js';
import { createEvidenceRegistry } from '../../domain/knowledge/evidence.js';
import { createKnowledgeCapabilityBatchLoader } from '../knowledge/capability-loader.js';
import { navigateKnowledgeTarget, parseKnowledgeRouteState, parseKnowledgeTargetContext, replaceKnowledgeRouteState } from '../../app/knowledge-route-state.js';
import { createAppKnowledgeLearningState } from '../../app/knowledge-learning-state.js';
import { renderKnowledgeLesson } from '../../ui/knowledge/lesson.js';
import { createCurrentObservationBlock, validateCurrentObservationsArtifact } from '../../ui/knowledge/current-observations.js';
import { createKnowledgeLearningControls } from '../../ui/knowledge/learning-controls.js';
import { loadJsonArtifact } from '../../data/artifact-cache.js';
import { createSuppliedMaterialBridge } from '../../ui/knowledge/supplied-material-bridge.js';
import { applySafeExternalLink } from '../../ui/knowledge/safe-external-link.js';
import { createIntegratedFrameworkSpine } from '../../ui/knowledge/integrated-framework-spine.js';
import { nodeCategory, relationGroups, typedRelations } from '../../domain/knowledge/atlas-relations.js';
import { registryCadenceSummary } from '../../domain/knowledge/knowledge-cadence.js';
import { renderIndustryPage } from '../knowledge/industry-view.js';
import { withDirectionParticle } from '../../domain/content/korean-particle.js';

const REVIEWED_AT = '2026-08-18';
const RESEARCH_URL = './public-data/atlas/source-packets.json';
const FOUNDATIONS_URL = './public-data/atlas/foundations.json';
const FOUNDATIONS_LESSONS_URL = './public-data/atlas/foundation-lessons.json';
const DOMAIN_GUIDES_URL = './public-data/atlas/domain-guides.json';
const DOMAIN_PACKETS_URL = './public-data/atlas/domain-source-packets.json';
const DOMAIN_CLAIMS_URL = './public-data/atlas/domain-claim-ledger.json';
const TAXONOMY_COVERAGE_URL = './public-data/atlas/taxonomy-node-coverage.json';
const TELEGRAM_REFERENCE_URL = './public-data/telegram-digest.json';
const PLAYER_PRODUCT_URL = './public-data/atlas/player-product-registry.json';
const PLAYER_PRODUCT_CURRENTNESS_URL = './public-data/atlas/player-product-currentness.json';
const DEEP_TAXONOMY_URL = './public-data/atlas/deep-taxonomy.json';
const KNOWLEDGE_SOURCES_URL = './public-data/knowledge/sources.json';
const KNOWLEDGE_STATUS_URL = './public-data/knowledge/status-summary.json';
const KNOWLEDGE_RELATIONSHIP_GUIDES_URL = './public-data/knowledge/relationship-guides.json';
const CURRENT_OBSERVATIONS_URL = './public-data/knowledge/current-observations.json';
const CURRENT_EVIDENCE_LEDGER_URL = './public-data/atlas/current-evidence-ledger.json';
const ROUTE_TARGETS_URL = './public-data/knowledge/route-targets.json';
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
  Object.freeze({ id: 'AI-1', title: 'AI 작동 원리', duration: '기초', summary: '규칙 기반 프로그램, 학습, parameter, training, inference, 검증을 연결합니다.', nodes: ['규칙 vs 학습', 'parameter', 'training/inference', '환각·검증'] }),
  Object.freeze({ id: 'AI-2', title: '물리 인프라', duration: '인프라', summary: '벡터·병렬처리에서 GPU/ASIC·메모리·네트워크·AIDC·전력까지 이동합니다.', nodes: ['벡터/행렬', 'GPU/ASIC', 'HBM/memory wall', 'chip·package', 'AIDC·power'] }),
  Object.freeze({ id: 'AI-3', title: 'World Model · Agent', duration: '심화', summary: 'state/action/dynamics/planning과 도구·권한·검증 루프를 분리해 설명합니다.', nodes: ['state/action', 'dynamics', 'planning', 'tool use', 'human review'] }),
  Object.freeze({ id: 'AI-4', title: '경제 · 산업 · 자본', duration: '경제성', summary: 'AI stack, 수익모델, 병목, CAPEX, utilization, depreciation과 반례를 연결합니다.', nodes: ['AI stack', 'unit economics', 'bottleneck', 'CAPEX/ROIC', 'counter-scenario'] }),
  Object.freeze({ id: 'AI-5', title: '시각화와 route 연결', duration: '제품화', summary: 'Tree/Graph/Path와 시장 분석·테마·기업 페이지의 경계를 정합니다.', nodes: ['Tree', 'Graph', 'Path', 'source badge', 'deep link'] }),
  Object.freeze({ id: 'AI-6', title: '검증과 접근성', duration: '품질 게이트', summary: '현재 주장·날짜·출처·키보드 탐색·읽기 순서를 출판 조건으로 둡니다.', nodes: ['claim truth', 'as-of', 'source', 'keyboard', 'review gate'] })
]);

const FOUNDATION_LAYER_DISPLAY = Object.freeze({
  F0: { title: '문제·학습·시스템의 공통 언어', summary: '무엇을 해결하려는지, 어떻게 학습하는지, 모델과 완성 시스템을 어떻게 구분하는지 먼저 정리합니다.' },
  F1: { title: '물리·수학·반도체의 출발점', summary: '에너지, 행렬, 확률, 병렬처리와 실리콘이 AI 계산의 물리적 바닥을 어떻게 만드는지 이해합니다.' },
  F2: { title: 'AI는 어떻게 학습하는가', summary: '규칙 기반 프로그램과 학습 시스템의 차이에서 신경망, 역전파, 일반화와 환각까지 연결합니다.' },
  F3: { title: 'Transformer와 LLM의 생애주기', summary: '문장이 토큰과 벡터가 되고 attention을 거쳐 학습·추론 서비스로 구현되는 순서를 따라갑니다.' },
  F4: { title: 'RAG·Agent·World Model', summary: '외부 기억, 도구 사용, 행동 루프와 세계 예측 모델이 실제 시스템에서 어떤 역할을 맡는지 구분합니다.' },
  F5: { title: '칩에서 데이터센터·전력망까지', summary: '작업 부하가 CPU·GPU·ASIC, HBM, 패키징, 네트워크, 냉각과 전력 수요로 번역되는 가치사슬입니다.' },
  F6: { title: '산업 경제성과 투자 검증', summary: '가동률·수율·CAPEX·FCF·ROIC를 통해 기술 수요가 기업 현금흐름과 자본 수익으로 이어지는지 검증합니다.' }
});

const FOUNDATION_PRIMER_MODULES = Object.freeze([
  Object.freeze({ id: 'problem-and-ability', title: 'Problem and ability', layer: 'F0', sourceSection: 'F0', evidence: [] }),
  Object.freeze({ id: 'learning-method', title: 'Learning method', layer: 'F0', sourceSection: 'F0', evidence: [] }),
  Object.freeze({ id: 'model-architecture', title: 'Model architecture', layer: 'F0', sourceSection: 'F0', evidence: [] }),
  Object.freeze({ id: 'learning-objective', title: 'Learning objective', layer: 'F0', sourceSection: 'F0', evidence: [] }),
  Object.freeze({ id: 'finished-system', title: 'Finished system', layer: 'F0', sourceSection: 'F0', evidence: [] }),
  Object.freeze({ id: 'execution-hardware', title: 'Execution hardware', layer: 'F0', sourceSection: 'F0', evidence: [] })
]);

export const FOUNDATION_MODULE_LABELS = Object.freeze({
  'problem-and-ability': '문제와 능력',
  'learning-method': '학습 방식',
  'model-architecture': '모델 구조',
  'learning-objective': '학습 목표',
  'finished-system': '완성 시스템',
  'execution-hardware': '실행 하드웨어',
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
  'workload-shape': 'AI 작업 부하의 형태',
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

export const DOMAIN_LABELS = Object.freeze({
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

export const TAXONOMY_NODE_LABELS = Object.freeze({
  'cloud-hyperscaler': '하이퍼스케일러 클라우드',
  'cloud-ai-service': '관리형 AI 서비스',
  'cloud-utilization': '가동률·작업 구성',
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
  'compute-interconnect': '가속기 연결(인터커넥트)',
  'memory-sram': 'SRAM·캐시',
  'memory-dram-hbm': 'DRAM·HBM',
  'memory-nand': 'NAND Flash',
  'memory-enterprise-ssd': '기업·데이터센터용 SSD',
  'memory-cxl': 'CXL·메모리 공유(풀링)',
  'foundry-design-ecosystem': 'EDA·IP·설계 생태계',
  'foundry-process-node': '미세공정 노드',
  'foundry-equipment': '반도체 공정 장비',
  'foundry-materials': '반도체 소재·화학물질',
  'foundry-capacity-yield': '생산능력·수율·가동률',
  'package-2-5d': '2.5D 패키징',
  'package-3d-stacking': '3D 적층',
  'package-interposer': '인터포저·브리지',
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
  'power-transformer': '변압기·개폐 장치',
  'edge-soc-npu': '엣지 SoC·NPU',
  'edge-memory-power': '기기 메모리·전력 한계',
  'physical-ai-sensing': '센서·인지',
  'physical-ai-control': '제어·구동',
  'physical-ai-digital-twin': '시뮬레이션·디지털 트윈',
  'economics-revenue-model': 'AI 수익모델',
  'economics-capex': 'CAPEX·리스',
  'economics-depreciation': '감가상각·내용연수',
  'economics-fcf': 'FCF·자금조달',
  'economics-roic': 'ROIC·반대 시나리오',
  'physical-ai-perception': '인지·센서 융합',
  'physical-ai-world-model': '월드 모델·시뮬레이션',
  'physical-ai-planning': '계획·제어',
  'physical-ai-actuation': '구동·안전',
  'physical-ai-unit-economics': '로봇 단위경제성',
  'defense-kill-chain': '탐지→결정 작전 사슬',
  'defense-c2-isr-ew': 'C2·ISR·전자전',
  'defense-autonomy': '자율성·사람의 통제',
  'defense-drone-production': '드론 생산·소모',
  'defense-procurement-economics': '방산 조달 경제성',
  'space-rocket-physics': '로켓 물리·발사 에너지',
  'space-reusability': '로켓 재사용·재발사 준비',
  'space-satellite-economics': '위성 데이터 경제성',
  'space-artemis-architecture': 'Artemis 프로그램 구조',
  'space-aircraft-supply-chain': '항공·우주 공급망',
  'application-healthcare': '의료 업무 흐름',
  'application-manufacturing': '제조 공정 흐름',
  'application-automotive': '자동차 자율주행',
  'application-finance': '금융 의사결정 흐름',
  'application-roi-payer': '구매자·ROI·도입률',
  'resources-copper': '구리·도체',
  'resources-lithium': '리튬·저장 소재',
  'resources-rare-earths': '희토류·영구자석',
  'resources-refining': '채굴·정제·재활용',
  'resources-industrial-equipment': '산업 장비 병목',
  'policy-export-controls': '수출통제',
  'policy-supply-chain-resilience': '공급망 회복력',
  'policy-semiconductor-incentives': '반도체 보조금·인센티브',
  'policy-cybersecurity': '사이버보안·소버린 AI',
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
  Object.freeze({ id: 'L0', label: '수요/문제', example: 'AI 작업 부하 · 병목 문제' }),
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

const ARRIVAL_METRIC_LABELS = Object.freeze({ BOTTLENECK_CAPACITY: '병목과 공급능력', CAPEX_FCF_ROIC: 'CAPEX → FCF → ROIC' });
const ARRIVAL_TIMEFRAME_LABELS = Object.freeze({ STRUCTURAL: '구조적 장기 흐름', '3Y_5Y': '3~5년' });

function createAtlasArrivalContext(documentRef, context, onReturn) {
  if (!context || context.routeId !== 'atlas') return null;
  const nodeId = String(context.knowledgeNode || '').replace(/^atlas:/, '');
  const block = element(documentRef, 'aside', 'atlas-arrival-context');
  block.setAttribute('aria-label', '이전 이야기에서 이어 읽기');
  block.append(
    element(documentRef, 'span', 'atlas-learning-column-label', '개념·분석 프레임에서 이어 읽기'),
    element(documentRef, 'h2', 'atlas-section-title', `${withDirectionParticle(TAXONOMY_NODE_LABELS[nodeId] || 'AI 가치사슬')} 연결했습니다.`),
    element(documentRef, 'p', 'atlas-card-copy', `앞 장의 질문을 ${ARRIVAL_METRIC_LABELS[context.metric] || '산업 전달 경로'} 관점에서 이어갑니다. 관찰 기간은 ${ARRIVAL_TIMEFRAME_LABELS[context.timeframe] || '별도 확인'}이며, 아래에서 상류 병목이 제품·기업·현금흐름으로 전달되는 순서를 확인하세요.`)
  );
  if (context.returnContext?.route) {
    const back = element(documentRef, 'button', 'atlas-route-button is-secondary', '읽던 이야기로 돌아가기');
    back.type = 'button';
    back.addEventListener('click', onReturn);
    block.appendChild(back);
  }
  return block;
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

const ATLAS_RELATIONSHIP_KIND_LABELS = Object.freeze({ concept: '핵심 개념', metric: '관찰 지표', company_claim: '기업 주장', evidence: '검증 근거', market: '시장 연결', financial: '재무 결과', constraint: '제약 조건' });
const ATLAS_CRITICALITY_LABELS = Object.freeze({ structural: '구조 관계', conditional: '조건부 관계', claim: '기업 주장' });
const ATLAS_ROUTE_LABELS = Object.freeze({ principles: '개념·분석 프레임', atlas: '산업·밸류체인', masters: '운용사·13F', fundamental: '재무 공시', themes: '테마·산업', macro: '거시 경제', fxbond: '금리 · 환율', technical: '차트·기술 분석' });

const ATLAS_PACKET_DISPLAY = Object.freeze({
  'ATLAS-00': { title: 'AI 산업 지도 읽는 법', scope: '노드·관계·출처·검토 상태를 읽는 공통 언어' },
  'ATLAS-01': { title: '공식 출처와 근거 원장', scope: '주장·관찰·기준일·충돌을 분리하는 검증 구조' },
  'ATLAS-02': { title: '클라우드·네오클라우드·자본', scope: '작업 부하·가동률·CAPEX·ROIC·금융 비용' },
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
  'AI-1': { title: 'AI 작동 원리', summary: '규칙과 학습, 파라미터, 학습·추론, 평가를 연결합니다.' },
  'AI-2': { title: '물리적 AI 인프라', summary: '벡터·병렬처리·가속기·메모리 벽·패키지·전력까지 이동합니다.' },
  'AI-3': { title: 'World Model과 Agent', summary: '상태·행동·동역학·계획·도구 사용·사람의 검토를 나눕니다.' },
  'AI-4': { title: '경제성·산업·자본', summary: 'AI stack·수익모델·병목·CAPEX/ROIC·반대 시나리오를 연결합니다.' },
  'AI-5': { title: '지도에서 전문 페이지로 이동', summary: 'Tree·Graph·Path와 출처 배지를 사용해 분석 경계를 확인합니다.' },
  'AI-6': { title: '검증과 공개 기준', summary: '주장·기준일·출처·접근성·검토 게이트를 공개 조건으로 사용합니다.' }
});

const TAXONOMY_LEVEL_DISPLAY = Object.freeze({
  L0: { label: '수요·문제', example: 'AI 작업 부하와 사용 사례' },
  L1: { label: '산업 영역', example: '반도체·클라우드·데이터센터·전력' },
  L2: { label: '섹터', example: '메모리·파운드리·포토닉스' },
  L3: { label: '세부 공정', example: 'HBM·EUV·CPO·냉각' },
  L4: { label: '제품·수익모델', example: '제품군·서비스·생산능력' },
  L5: { label: '기업 역할', example: '설계·제조·장비·서비스·고객' },
  L6: { label: '검증 단위', example: '기준일·상태·출처·KPI·리스크' }
});


const FOUNDATION_TEACHING_FRAME = Object.freeze({
  F0: { lens: '문제 → 능력 → 모델 → 서비스 → 하드웨어의 층위를 분리해 읽습니다.', visualization: '문제 → 학습 → 모델 → 서비스 → 하드웨어 계층도' },
  F1: { lens: '입력 자원과 물리적 제약이 결과를 제한하는 단위를 먼저 봅니다.', visualization: '에너지·연산·메모리·열의 병목 흐름도' },
  F2: { lens: '데이터·목표·학습 피드백이 오류와 일반화를 바꾸는 경로를 따라갑니다.', visualization: '데이터 → 손실 → 파라미터 → 평가 루프' },
  F3: { lens: '표현·문맥·학습·배포 중 비용과 품질이 결정되는 지점을 분리합니다.', visualization: 'token → attention → training → serving 수명주기' },
  F4: { lens: '외부 정보·도구·상태·사람의 검토가 실패와 권한을 어떻게 바꾸는지 봅니다.', visualization: '관찰 → 검색/도구 → 행동 → 검토 상태 흐름' },
  F5: { lens: '작업 부하가 계산·메모리·네트워크·전력·냉각 중 어디를 먼저 포화시키는지 추적합니다.', visualization: '가속기 → HBM → 인터커넥트 → 랙 → 전력망' },
  F6: { lens: '기술 능력이 사용량·마진·현금흐름·자본수익률로 번역되는 증거를 연결합니다.', visualization: '수요 → CAPEX → 가동률 → FCF → ROIC 원장' }
});


const ATLAS_CONCEPT_GUIDES = Object.freeze({
  'compute-gpu': { definition: 'GPU는 병렬 계산을 반복 수행하는 가속기입니다.', chain: '모델 작업 부하 → 가속기 → HBM·인터커넥트 → 서버 시스템', role: '대표 역할: 연산 처리와 소프트웨어 생태계 제공', kpi: '실제 처리량·지연시간·전력당 성능·활용률' },
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
  'cloud-hyperscaler': { definition: '하이퍼스케일러 클라우드는 대규모 컴퓨트·스토리지·네트워크를 공용 플랫폼으로 운영합니다.', chain: '데이터센터 자산 → 공유 인프라 → 사용량·예약 기반 서비스 매출', role: '대표 역할: 여러 작업 부하를 한 시설과 소프트웨어 층에서 통합', kpi: '가동률·사용량·단위 매출·CAPEX·감가상각·고객 집중도' },
  'cloud-ai-service': { definition: '관리형 AI 서비스는 모델 실행·데이터 연결·권한·관측 기능을 API나 플랫폼으로 묶습니다.', chain: '모델·데이터·도구 → 관리형 API → 개발자 사용량·반복 매출', role: '대표 역할: 모델 사용의 복잡성을 서비스 운영 층으로 흡수', kpi: '요청량·지연·단위 원가·총마진·갱신률·오류율' },
  'cloud-utilization': { definition: '가동률과 작업 구성은 고정비가 큰 컴퓨트 자산이 실제 매출로 전환되는 정도를 보여줍니다.', chain: '예약·트래픽·배치 패턴 → 장비 사용률 → 단위 원가·마진', role: '대표 역할: 수요의 양뿐 아니라 시간대·모델·고객별 사용 패턴을 해석', kpi: '평균·피크 가동률·유휴시간·GPU 시간당 원가·작업 부하 mix' },
  'cloud-commitments': { definition: '클라우드 commitment는 고객이 일정 기간 사용량이나 지출을 약정하는 계약 구조입니다.', chain: '고객 계획 → 예약·약정 → 공급능력·매출 가시성', role: '대표 역할: 미래 매출 단서를 제공하지만 사용량·해지·회계 인식과 분리', kpi: 'RPO·계약기간·해지조건·고객 집중도·실사용률' },
  'cloud-depreciation': { definition: '감가상각 주기는 서버·시설 투자액이 회계상 비용으로 인식되는 시간 구조입니다.', chain: 'CAPEX·내용연수 → 감가상각비 → 이익·현금흐름·재투자', role: '대표 역할: 매출 성장과 회계비용·자산 회수 속도를 연결', kpi: 'CAPEX/매출·감가상각·내용연수·자산 가동률·장부가' },
  'neocloud-gpu-rental': { definition: 'GPU 임대는 대규모 가속기 자산을 시간·예약 단위로 고객에게 제공하는 사업모델입니다.', chain: '조달·호스팅 → GPU 시간 판매 → 임대료·전력·금융비용', role: '대표 역할: 자산 소유와 서비스 판매 사이의 수익 구조를 보여줌', kpi: '임대 단가·가동률·전력비·감가상각·고객 집중도' },
  'neocloud-capacity-reservation': { definition: '용량 예약은 고객이 미래의 컴퓨트 공급을 미리 확보하는 계약입니다.', chain: '고객 수요 예측 → 용량 예약 → 선투자·공급 보장·취소 위험', role: '대표 역할: 수요 가시성과 자산 선투자의 균형을 확인', kpi: '예약 기간·선급금·취소·실사용률·남은 의무' },
  'neocloud-lease-burden': { definition: '리스 부담은 시설·서버 사용권에 대한 미래 고정 지급 의무입니다.', chain: '리스 계약 → 고정 지급·부채 → 가동률·금리 민감도', role: '대표 역할: 손익보다 먼저 고정비와 재무 레버리지를 드러냄', kpi: '리스부채·만기·이자비용·최소 지급액·가동률' },
  'neocloud-customer-concentration': { definition: '고객 집중도는 소수 고객이 매출·채권·예약의 큰 부분을 차지하는 정도입니다.', chain: '대형 고객 → 수요·가격 협상력 → 매출 안정성과 하방 위험', role: '대표 역할: 계약 가시성과 협상력·대체 수요를 함께 평가', kpi: '상위 고객 매출 비중·채권·계약기간·갱신률·해지조건' },
  'neocloud-rental-yield': { definition: '임대 수익률에서 자금조달비용을 뺀 값은 자산 확장의 경제성을 보는 개념적 프레임입니다.', chain: '임대료·가동률 → 자산 수익률 → 이자·리스비용 → 잉여', role: '대표 역할: 성장률이 아니라 자본비용을 넘는 회수 가능성을 점검', kpi: '단위 매출·총마진·자본비용·가동률·현금 회수기간' },
  'compute-asic': { definition: 'ASIC은 특정 작업 부하에 맞춰 설계된 주문형 집적회로입니다.', chain: '반복 작업 부하 → 전용 회로·compiler → 성능·전력·개발비 절충', role: '대표 역할: 범용성보다 반복 규모와 효율이 중요한 계산을 담당', kpi: '성능/전력·개발기간·NRE·수율·software enablement' },
  'compute-npu': { definition: 'NPU는 신경망 연산을 기기나 시스템의 전력 예산 안에서 처리하도록 만든 가속기입니다.', chain: '모델 연산 → 전용 MAC·메모리 → 저전력 추론', role: '대표 역할: CPU/GPU와 다른 지연·전력·프라이버시 요구를 처리', kpi: 'TOPS보다 실제 모델 처리량·전력·메모리·지원 연산·지연' },
  'compute-precision': { definition: 'FP·BF·INT 정밀도는 숫자를 표현하는 비트 수와 형식으로 계산 비용·오차를 바꿉니다.', chain: '정밀도 선택 → 메모리·연산량 → 속도·전력·정확도', role: '대표 역할: 모델 품질을 유지하면서 계산·메모리 비용을 줄이는 설계 축', kpi: '정확도 변화·처리량·메모리 사용량·전력·변환 오버헤드' },
  'compute-interconnect': { definition: '가속기 인터커넥트는 여러 칩과 메모리 사이에서 데이터를 이동시키는 연결 계층입니다.', chain: '분산 작업 부하 → 링크·스위치·프로토콜 → 집단 통신 성능', role: '대표 역할: 개별 칩 성능이 클러스터 성능으로 확장되는 조건을 결정', kpi: '대역폭·지연·scale-out 효율·전력/bit·오류율' },
  'memory-sram': { definition: 'SRAM과 cache는 연산기 가까이에서 자주 쓰는 데이터를 빠르게 보관하는 메모리 계층입니다.', chain: '반복 접근 → 근접 cache → 지연·외부 메모리 트래픽 감소', role: '대표 역할: 평균 메모리 지연과 전력 접근을 낮춤', kpi: 'hit rate·latency·용량·면적·전력·대역폭' },
  'memory-nand': { definition: 'NAND flash는 전원이 꺼져도 데이터를 보존하는 고밀도 비휘발성 저장 매체입니다.', chain: '데이터·모델·로그 → NAND·컨트롤러 → 용량·비용·내구성', role: '대표 역할: 대규모 데이터셋과 체크포인트·검색 데이터를 저장', kpi: 'bit density·GB당 비용·쓰기 내구성·지연·수율' },
  'memory-cxl': { definition: 'CXL은 CPU·가속기·메모리 장치 사이의 연결과 메모리 공유를 위한 인터페이스 계층입니다.', chain: '분리된 메모리 자원 → 일관성을 유지하는 연결 → 용량 활용·확장성', role: '대표 역할: 로컬 메모리와 풀링 메모리 사이의 시스템 설계 선택 제공', kpi: '지연·대역폭·일관성 유지 부담·공유 메모리 활용률·지원 생태계' },
  'foundry-design-ecosystem': { definition: '설계 생태계는 EDA·IP·PDK·설계서비스·고객 설계팀이 제조 플랫폼을 사용 가능하게 만드는 층입니다.', chain: '공정 규칙 → 검증·IP·설계도구 → 설계 완료(테이프아웃) 가능성', role: '대표 역할: 공정 성능을 실제 고객 칩으로 변환', kpi: 'IP 준비도·PDK 안정성·설계비·테이프아웃·고객 수' },
  'foundry-materials': { definition: '반도체 소재·화학물질은 웨이퍼 표면을 만들고 패턴·식각·세정을 가능하게 합니다.', chain: '원재료·순도 → 공정 반응 → 결함·수율·양산 안정성', role: '대표 역할: 장비와 함께 공정 조건과 양품률을 결정', kpi: '순도·공급 안정성·불량률·원가·qualification 기간' },
  'package-3d-stacking': { definition: '3D 적층은 칩이나 메모리를 수직으로 쌓아 연결 거리와 면적을 줄이는 패키징 방식입니다.', chain: '다이 적층 → 수직 연결·열 제거 → 밀도·대역폭·수율', role: '대표 역할: 시스템 집적도를 높이되 열과 검사 난도를 함께 증가', kpi: '적층 수·열저항·bonding 수율·대역폭·테스트 비용' },
  'package-interposer': { definition: '인터포저·브리지는 칩렛과 메모리를 짧고 넓은 연결로 묶는 중간 연결 계층입니다.', chain: '다이 → 인터포저·브리지 → 신호 무결성·대역폭·패키지 크기', role: '대표 역할: 서로 다른 다이의 고밀도 연결을 지원', kpi: '배선 밀도·신호 손실·패키지 수율·원가·공급능력' },
  'package-substrate': { definition: 'ABF·FC-BGA 기판은 패키지와 보드 사이에서 전력·신호·기계적 지지를 제공합니다.', chain: '패키지 다이 → 기판 배선 → 보드·서버 시스템', role: '대표 역할: 고성능 패키지의 연결·전력 전달·열 경로 제공', kpi: '층수·미세배선·크기·수율·납기·원가' },
  'package-glass': { definition: '유리기판은 대형 패키지와 미세 배선의 기계·전기적 요구를 해결하려는 개발 방향입니다.', chain: '패키지 확대 → 평탄성·치수 안정성 → 신호·조립 조건', role: '대표 역할: 차세대 기판의 후보가 되지만 양산·원가·생태계 검증이 필요', kpi: '평탄성·열팽창·절연 특성·패널 수율·장비 호환성' },
  'network-switch': { definition: '스위치 실리콘은 서버·가속기·랙 사이의 패킷을 전달하고 경로를 제어합니다.', chain: '분산 계산 → 패킷 스위칭 → 클러스터 처리량·지연', role: '대표 역할: scale-out 시스템의 통신 병목과 토폴로지를 결정', kpi: '포트 속도·처리량·지연·전력/bit·버퍼·소프트웨어 기능' },
  'network-optical-module': { definition: '광학 모듈은 전기 신호를 광으로 바꾸고 다시 전기 신호로 복원해 데이터센터 링크를 구성합니다.', chain: '스위치 전기 신호 → 광 변환·전송 → 랙·행·센터 연결', role: '대표 역할: 거리와 대역폭이 커질 때 전기 링크를 보완', kpi: '거리·대역폭·전력/bit·오류율·수율·모듈 원가' },
  'network-fabric': { definition: 'AI cluster fabric은 다수의 가속기와 스위치를 하나의 분산 시스템처럼 연결하는 네트워크 구조입니다.', chain: '모델 병렬화 → 토폴로지·프로토콜 → 집단 통신·완료시간', role: '대표 역할: 가속기 수를 늘려도 통신 효율을 유지하는 시스템 층', kpi: 'all-reduce 효율·bisection bandwidth·tail latency·가동률·전력' },
  'aidc-thermal-design': { definition: '열 설계는 칩에서 발생한 열을 냉각 장치와 시설로 전달해 안정적인 동작 온도를 유지합니다.', chain: '칩 전력 → 열전도 소재·냉각판·냉각수 순환 → 시설 열 배출', role: '대표 역할: 고밀도 서버의 성능 지속성과 장애율을 결정', kpi: '칩 내부 온도·열저항·냉각 용량·팬/펌프 전력·장애율' },
  'aidc-server-platform': { definition: '서버 플랫폼은 가속기·CPU·메모리·스토리지·전원·네트워크를 하나의 운영 단위로 통합합니다.', chain: '부품 조합 → 보드·섀시·랙 → 작업 부하 실행', role: '대표 역할: 부품 성능을 실제 배치·운영 가능한 시스템으로 변환', kpi: '성능/랙·전력·서비스성·조달 납기·가동률' },
  'aidc-pue': { definition: 'PUE는 데이터센터 전체 에너지와 IT 장비 에너지의 비율로 시설 오버헤드를 보는 지표입니다.', chain: 'IT 부하 → 냉각·전력변환·시설 오버헤드 → 총 에너지', role: '대표 역할: 서버 효율과 시설 효율을 분리해 비교', kpi: 'PUE·WUE·IT 부하·냉각 전력·계절별 변동' },
  'power-it-load': { definition: 'IT 부하는 가속기·서버·네트워크가 실제로 소비하는 전력입니다.', chain: '모델 작업 부하 → 장비 사용률 → 랙·시설 전력 수요', role: '대표 역할: AI 수요를 전력망이 처리해야 하는 물리량으로 번역', kpi: 'kW/랙·평균/피크 부하·전력당 처리량·가동률·전력 품질' },
  'power-generation': { definition: '발전 믹스는 데이터센터가 사용할 전력이 어떤 발전원과 계약·시장 구조에서 나오는지 보여줍니다.', chain: '전력 수요 → 발전·계약·시장 → 가격·탄소·신뢰도', role: '대표 역할: 전력의 양뿐 아니라 비용·시간대·정책 제약을 설명', kpi: '가용 용량·가격·계통 예비력·탄소강도·계약기간' },
  'power-transmission': { definition: '송전·변전은 발전된 전력을 대규모 부하까지 전달하고 전압을 변환하는 계통 계층입니다.', chain: '발전소 → 송전선·변전소 → 데이터센터 접속', role: '대표 역할: 발전 용량이 있어도 실제 접속 가능한지 결정', kpi: '접속 용량·혼잡·변압기 납기·신뢰도·증설 기간' },
  'power-transformer': { definition: '변압기·스위치기어는 전압을 바꾸고 전력 흐름을 보호·분배하는 핵심 전력 장비입니다.', chain: '계통 전압 → 변압·보호·분배 → 시설 IT 부하', role: '대표 역할: 전력 인입을 실제 서버 전원으로 변환', kpi: 'MVA 용량·효율·납기·고장률·유지보수·보호 등급' },
  'edge-memory-power': { definition: '엣지 메모리·전력 envelope는 기기 안에서 모델 크기·지연·배터리 사이의 상한을 정합니다.', chain: '모델·센서 → 메모리 접근·전력 → 배터리·열·지연', role: '대표 역할: 클라우드 모델을 기기에 옮길 수 있는 조건을 결정', kpi: '모델 메모리·대역폭·추론 전력·배터리 시간·열 한계' },
  'physical-ai-sensing': { definition: '센싱·인식은 카메라·라이다·힘 센서 등에서 물리 세계의 상태를 추정하는 단계입니다.', chain: '환경 신호 → 센서·perception → 상태 추정·불확실성', role: '대표 역할: 제어기가 사용할 입력의 정확도·지연·안전성을 결정', kpi: '정확도·지연·오탐/미탐·센서 비용·조도/환경 강건성' },
  'physical-ai-digital-twin': { definition: '시뮬레이션·디지털 트윈은 실제 장비와 환경의 상태·행동을 가상 공간에서 시험하는 모델입니다.', chain: '물리 시스템 → 모델·시뮬레이션 → 계획·검증·현장 전이', role: '대표 역할: 실제 시험 비용과 위험을 줄이고 데이터 부족을 보완', kpi: 'sim-to-real gap·시뮬레이션 속도·현실성·검증 커버리지·운영 비용' },
  'economics-capex': { definition: 'CAPEX·리스는 장비·시설을 확보하기 위해 현재 현금과 미래 지급 의무를 투입하는 방식입니다.', chain: '수요 전망 → 장기 투자·리스 → 감가상각·고정비·공급능력', role: '대표 역할: 성장 투자와 자본 부담을 같은 표에서 읽게 함', kpi: 'CAPEX·리스부채·CAPEX/매출·가동률·회수기간' },
  'economics-depreciation': { definition: '감가상각과 내용연수는 자산 원가를 사용기간에 배분하는 회계·경제 가정입니다.', chain: '자산 취득 → 내용연수·잔존가치 → 기간별 비용·장부가', role: '대표 역할: 장비 세대 교체와 이익률·현금흐름의 시차를 설명', kpi: '내용연수·감가상각비·장부가·폐기·자산 세대 전환' },
  'economics-fcf': { definition: 'FCF는 영업현금흐름에서 설비투자(CAPEX)를 뺀, 사업이 만든 현금입니다. 차입·리스·증자 같은 자금조달은 투자 부족분을 메우는 별도 흐름이며 FCF를 늘리지 않습니다.', chain: '매출·마진 → 영업현금 − CAPEX = FCF │ 부족분 ↔ 차입·리스·증자(자금조달, 별도 흐름)', role: '대표 역할: 회계상 성장과 실제 자금 조달 여력을 분리', kpi: 'FCF·CAPEX·순부채·이자보상·자금조달 비용·만기' },
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
  'application-roi-payer': { definition: '응용 AI의 경제성은 세 가지를 나눠 봅니다 — 순편익(개선된 결과의 가치 − 도입·운영·전환 비용), ROI(순편익 ÷ 투입 비용), 회수기간(투입을 되찾는 기간). 구매자가 실제로 지불하는지가 출발점입니다.', chain: '업무 개선 → 지불자 가치 → 도입·통합·전환 비용 → 순편익·ROI·회수기간 → 반복 계약', role: '대표 역할: 기술 사용량과 실제 지불 의사를 분리', kpi: 'payback·사용률·갱신률·인력 절감·통합 비용·마진' },
  'resources-copper': { definition: '구리와 도체는 전력망·모터·서버·데이터센터의 전기 전달을 담당하는 산업 소재입니다.', chain: '광산·정제 → 전선·부품 → 전력·통신·산업 설비', role: '대표 역할: AI 수요를 전력 인프라의 물질 수요로 번역', kpi: '정제능력·품위·재고·가격·프로젝트 납기·재활용률' },
  'resources-lithium': { definition: '리튬은 배터리 저장의 핵심 소재지만 화학계열·정제·가격·재활용 조건이 중요합니다.', chain: '광산·정제 → 양극재·셀 → 저장·이동성', role: '대표 역할: 배터리 수요와 광물 가격을 단순히 동일시하지 않기', kpi: '정제량·셀 원가·에너지 밀도·cycle life·가격·재활용' },
  'resources-rare-earths': { definition: '희토류와 자석은 모터·풍력·방산 등 높은 자력과 소형화가 필요한 시스템에 들어갑니다.', chain: '채굴·분리 → 자석·모터 → 로봇·차량·방산', role: '대표 역할: 매장량보다 분리·정제·대체·지역 집중을 확인', kpi: '분리능력·중국 의존도·대체재·원가·수출 제한' },
  'resources-refining': { definition: '정제와 재활용은 채굴량을 실제 사용 가능한 고순도 소재 공급으로 바꾸는 공정입니다.', chain: '원광·폐기물 → 정제·재활용 → 규격 소재·공급 안정성', role: '대표 역할: 자원 풍부함과 상업적 공급능력의 차이 설명', kpi: '회수율·순도·처리량·허가·에너지 비용·폐기물' },
  'resources-industrial-equipment': { definition: '산업 장비 병목은 대형 설비의 제작·설치·인증·서비스 능력이 수요 확장을 제한하는 현상입니다.', chain: '수요 증가 → 장비 주문·제작 → 설치·가동 → 생산능력', role: '대표 역할: 소재 가격과 장비 공급의 시간 지연을 함께 읽기', kpi: '수주잔고·납기·설치 기반·서비스 매출·공급자 집중' },
  'policy-export-controls': { definition: '수출통제는 특정 기술·장비·소프트웨어의 국가 간 이전을 제한하는 정책 장치입니다.', chain: '안보 목표 → 허가·규제 → 공급망·고객·대체 기술', role: '대표 역할: 기술 경쟁을 제품 성능뿐 아니라 접근권의 문제로 확장', kpi: '통제 품목·허가 기간·대상 국가·대체 가능성·매출 노출' },
  'policy-supply-chain-resilience': { definition: '공급망 회복력은 한 충격 이후 조달·생산·대체·재고가 기능을 유지하고 복구하는 능력입니다.', chain: '지역·공급자 집중 → 충격 → 재고·대체·다변화 → 복구', role: '대표 역할: 효율성과 회복력 사이의 자본비용을 확인', kpi: '공급자 수·납기·재고일수·대체 인증·지역 집중' },
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
  'future-neuromorphic': { definition: '뉴로모픽 시스템은 뇌의 사건 기반·메모리 근접 계산에서 영감을 받은 하드웨어·알고리즘입니다.', chain: '사건 입력 → 희소 연산·메모리 → 저전력 추론', role: '대표 역할: 특정 edge 작업 부하에서의 효율과 생태계 성숙도를 검증', kpi: 'event latency·전력·정확도·개발도구·양산성' },
  'future-new-energy': { definition: '차세대 에너지 시스템은 발전·저장·연료·열관리의 새로운 조합으로 전력과 탄소 제약을 해결하려는 영역입니다.', chain: '자원·변환 → 발전·저장 → 계통·수요 → 비용·규제', role: '대표 역할: 기술 효율과 상업적 설치·허가·금융의 간극 확인', kpi: 'LCOE·저장 지속시간·수명·건설 기간·보조금·안전' },
  'future-uncertainty-gate': { definition: '기술 불확실성 게이트는 연구 결과를 제품·생산·현금흐름 주장으로 승격하기 전 확인할 조건입니다.', chain: '논문·시연 → 반복성·규모화 → 인증·생산 → 고객 지불', role: '대표 역할: 미래 기술의 가능성과 현재 투자 사실을 분리', kpi: 'TRL·재현성·양산 상태·고객 검증·단위경제성·규제' }
});


function createDeepTaxonomyView(documentRef, node, deepTaxonomy, selectedTopicId) {
  const topics = (deepTaxonomy?.topics || []).filter((topic) => topic.anchorNodeIds?.includes(node.id));
  if (!topics.length) return null;
  const selectedTopic = topics.find((topic) => topic.id === selectedTopicId) || topics[0];
  const block = element(documentRef, 'section', 'atlas-deep-taxonomy');
  block.dataset.atlasDeepTopicTotal = String(deepTaxonomy?.topics?.length || 0);
  block.dataset.atlasDeepBranchTotal = String((deepTaxonomy?.topics || []).reduce((sum, topic) => sum + (topic.branches?.length || 0), 0));
  block.append(
    element(documentRef, 'h3', 'af-section atlas-deep-taxonomy-heading', '한 걸음 더 들어가면')
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
    element(documentRef, 'h4', 'atlas-deep-topic-title', selectedTopic.title),
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
      applySafeExternalLink(link, source.url);
      links.appendChild(link);
    });
    sources.appendChild(links);
    block.appendChild(sources);
  }
  return block;
}

// P1471: relations come from the typed canonical set (atlas-relations.js). The producer's per-domain
// list order (domainChains) is not a supply chain and no longer becomes 상류/하류 edges.
function mergeTaxonomyRelationships(taxonomyCoverage) {
  const nodes = taxonomyCoverage?.nodes || [];
  const byId = new Map(nodes.map((node) => [node.nodeId, node]));
  const title = (nodeId) => TAXONOMY_NODE_LABELS[nodeId] || byId.get(nodeId)?.title || nodeId;
  const neighbours = typedRelations(taxonomyCoverage, title);
  return nodes.map((node) => ({ ...node, relationGroups: relationGroups(neighbours.get(node.nodeId) || []) }));
}

function relationList(documentRef, groups = []) {
  const box = element(documentRef, 'div', 'atlas-card-copy atlas-taxonomy-relations');
  if (!groups.length) { box.textContent = '이 분야 안에서 정의된 관계가 없습니다 — 다른 항목과 나란히 놓인 독립 영역입니다.'; return box; }
  for (const group of groups) {
    const line = element(documentRef, 'p', 'atlas-relation-line');
    line.dataset.relationType = group.type;
    line.append(element(documentRef, 'strong', 'atlas-relation-type', `${group.label}: `), documentRef.createTextNode(group.items.map((item) => item.text ? `${item.title}(${item.text})` : item.title).join(' · ')));
    box.appendChild(line);
  }
  return box;
}


function createDomainGuide(documentRef, domain, guide, packet, claimLedger) {
  if (!guide) return null;
  const block = element(documentRef, 'section', 'atlas-domain-guide');
  block.append(
    element(documentRef, 'h3', 'atlas-domain-detail-title', DOMAIN_LABELS[domain.id] || domain.title),
    element(documentRef, 'p', 'atlas-learning-column-label', '산업의 흐름'),
    element(documentRef, 'p', 'atlas-domain-detail-lede', `${guide.definition} 실제 흐름은 ${guide.mechanism}의 순서로 이어집니다.`),
    element(documentRef, 'p', 'atlas-learning-column-label', '숫자가 말해주는 것과 감추는 것'),
    element(documentRef, 'p', 'atlas-card-copy atlas-domain-guide-observation', `기본 관찰 단위는 ${guide.unit}입니다. 그러나 ${guide.bottleneck}에서 흐름이 막히면 겉으로 보이는 성장과 실제 현금 회수가 달라질 수 있습니다. 그래서 “${guide.verificationQuestion}”를 다음 확인 질문으로 남깁니다.`),
    element(documentRef, 'p', 'atlas-card-copy atlas-domain-guide-exploration', '이제 아래 세부 영역에서 상류 제약이 제품·서비스를 거쳐 매출과 현금흐름으로 이동하는 경로를 한 단계씩 따라가세요.')
  );

  const evidence = element(documentRef, 'details', 'atlas-domain-evidence');
  evidence.appendChild(element(documentRef, 'summary', 'atlas-module-source-summary', '근거와 검증 메모 보기'));
  const links = element(documentRef, 'div', 'atlas-domain-guide-links');
  if (guide.sourceUrl) {
    const link = element(documentRef, 'a', 'atlas-reference-source-link', guide.sourceName || '공식 자료');
    applySafeExternalLink(link, guide.sourceUrl);
    link.dataset.atlasDomainGuideSource = domain.id;
    links.appendChild(link);
  }
  evidence.appendChild(links);
  if (packet) {
    evidence.appendChild(element(documentRef, 'p', 'atlas-card-copy atlas-domain-guide-boundary', `검토일 ${packet.reviewedAt}`));
    evidence.appendChild(element(documentRef, 'p', 'atlas-card-copy atlas-domain-guide-boundary', `근거 범위: ${packet.evidenceQuestions?.length || 0}개 검토 포인트를 출처 목록과 함께 보존합니다.`));
    const packetLinks = element(documentRef, 'div', 'atlas-domain-guide-links atlas-domain-packet-links');
    (packet.sources || []).forEach((source) => {
      const sourceLink = element(documentRef, 'a', 'atlas-reference-source-link', source.publisher);
      applySafeExternalLink(sourceLink, source.url);
      sourceLink.dataset.atlasDomainPacketSource = packet.id;
      packetLinks.appendChild(sourceLink);
    });
    evidence.appendChild(packetLinks);
  }
  const claims = (claimLedger?.claims || []).filter((claim) => claim.domainId === domain.id);
  if (claims.length) {
    const claimBlock = element(documentRef, 'div', 'atlas-domain-claim-ledger');
    claimBlock.appendChild(element(documentRef, 'strong', 'atlas-card-id', `근거와 함께 읽는 구조 설명 ${claims.length}개`));
    const packetSourceById = new Map((packet?.sources || []).map((source) => [source.id, source]));
    claims.forEach((claim) => {
      const item = element(documentRef, 'article', 'atlas-domain-claim');
      item.append(
        element(documentRef, 'p', 'atlas-card-copy atlas-domain-claim-statement', claim.statement),
        element(documentRef, 'p', 'atlas-card-copy atlas-domain-guide-boundary', `${claim.claimType === 'STRUCTURAL_REFERENCE' ? '구조 참고' : '검토 후보'} · ${claim.currentnessPolicy === 'NOT_APPLICABLE_STRUCTURAL_REFERENCE' ? '현재성 비적용' : '기준일 확인 필요'} · 검토일 ${claim.reviewedAt || '미확정'} · ${claim.status === 'PARTIAL' ? '부분 검토' : claim.status || '상태 확인 필요'}`),
        element(documentRef, 'p', 'atlas-card-copy atlas-domain-guide-boundary', claim.evidenceBoundary || '현재 수치·가격·생산 상태로 일반화하지 않습니다.')
      );
      const claimLinks = element(documentRef, 'div', 'atlas-domain-guide-links');
      (claim.sourceIds || []).forEach((sourceId) => {
        const source = packetSourceById.get(sourceId);
        if (!source?.url) return;
        const link = element(documentRef, 'a', 'atlas-reference-source-link', `${source.publisher}${source.title ? ` · ${source.title}` : ''}`);
        applySafeExternalLink(link, source.url);
        claimLinks.appendChild(link);
      });
      if (claimLinks.childElementCount) item.appendChild(claimLinks);
      claimBlock.appendChild(item);
    });
    evidence.appendChild(claimBlock);
  }
  block.appendChild(evidence);
  return block;
}




export function createAtlasPage({ root = globalThis, documentRef = root.document } = {}) {
  return {
    route: 'atlas',
    mount({ scope } = {}) {
      const bag = createResourceBag();
      const page = documentRef?.getElementById('page-atlas');
      const content = page?.querySelector('[data-atlas-content]');
      if (!page || !content) return () => bag.dispose();
      const suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
        routeId: 'atlas',
        heading: 'AI 시대의 산업·자본·기관 증거 브리지'
      });
      page.appendChild(suppliedMaterialBridge);
      bag.add(() => suppliedMaterialBridge.remove());
       const isAlive = () => !scope?.disposed && (typeof scope?.isCurrent !== 'function' || scope.isCurrent());
       const sharedRoute = parseKnowledgeRouteState(root?.location);
       const arrivalContext = parseKnowledgeTargetContext({ root, locationLike: root?.location });
       const arrivalNode = arrivalContext?.routeId === 'atlas' ? String(arrivalContext.knowledgeNode || '').replace(/^atlas:/, '') : '';
       const initialTab = arrivalNode ? 'taxonomy' : ['foundations', 'relationships', 'taxonomy'].includes(sharedRoute.mode) ? sharedRoute.mode : 'taxonomy';
       const learning = createAppKnowledgeLearningState(root);
       const initialLayerId = sharedRoute.chapter || 'F1';
       const initialModuleId = sharedRoute.lesson || (initialLayerId === 'F0' ? FOUNDATION_PRIMER_MODULES[0].id : 'energy-and-power');
       const state = { tab: initialTab, query: '', arrivalContext: arrivalContext?.routeId === 'atlas' ? arrivalContext : null, selectedLayerId: initialLayerId, selectedModuleId: initialModuleId, selectedDomainId: sharedRoute.domain || 'domain-cloud-platform', selectedDomainNodeId: arrivalNode || sharedRoute.node || (sharedRoute.domain ? '' : 'cloud-hyperscaler'), atlasView: !arrivalNode && (sharedRoute.view === 'domain' || !sharedRoute.node) ? 'domain' : 'node', selectedDeepTopicId: sharedRoute.topic || '', selectedRelationshipGuideId: sharedRoute.guide || 'neutral-rate-policy-gap', selectedRelationshipNodeId: initialTab === 'relationships' ? sharedRoute.node || '' : '', relationshipCriticality: ['all', 'structural', 'conditional', 'claim'].includes(sharedRoute.criticality) ? sharedRoute.criticality : 'all', relationshipGuides: null, currentObservations: null, research: null, foundations: null, foundationLessons: null, knowledgeArticles: { articles: [] }, knowledgeStatus: null, routeTargets: null, registry: null, domainGuides: null, domainPackets: null, claimLedger: null, taxonomyCoverage: null, deepTaxonomy: null, telegram: null, currentness: null, currentEvidenceLedger: null, knowledgeSources: null, relationshipGuidesError: false, currentObservationsError: false, researchError: false, foundationsError: false, foundationLessonsError: false, knowledgeArticlesError: false, knowledgeStatusError: false, routeTargetsError: false, registryError: false, domainGuidesError: false, domainPacketsError: false, claimLedgerError: false, taxonomyCoverageError: false, deepTaxonomyError: false, telegramError: false, currentnessError: false, currentEvidenceLedgerError: false, knowledgeSourcesError: false, loadingArticleIds: new Set(), articleErrors: new Set() };
      page.dataset.aioArchitectureRoute = 'atlas';
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioContentKind = 'REFERENCE';
      page.dataset.aioReviewedAt = REVIEWED_AT;
      page.dataset.aioKnowledgeLearningState = 'local-persistent';

      const route = (routeId) => { if (typeof root?.showPage === 'function') root.showPage(routeId); };
      const navigateTarget = (target) => {
        if (!target?.routeId) return;
        navigateKnowledgeTarget({ root, target: { ...target, returnContext: target.returnContext || { route: 'atlas' } } });
      };
      const syncSharedState = () => replaceKnowledgeRouteState({ root, state: {
        mode: state.tab,
        node: state.tab === 'taxonomy' ? state.selectedDomainNodeId : state.tab === 'relationships' ? state.selectedRelationshipNodeId : null,
        chapter: state.tab === 'foundations' ? state.selectedLayerId : null,
        lesson: state.tab === 'foundations' ? state.selectedModuleId : null,
        domain: state.tab === 'taxonomy' ? state.selectedDomainId : null,
        topic: state.tab === 'taxonomy' ? state.selectedDeepTopicId : null,
        guide: state.tab === 'relationships' ? state.selectedRelationshipGuideId : null,
        criticality: state.tab === 'relationships' ? state.relationshipCriticality : null,
        view: state.tab === 'taxonomy' && state.atlasView === 'domain' ? 'domain' : null
      } });
       syncSharedState();
       let ensureTabCapabilities = () => {};
       let ensureSearchCapabilities = () => {};
       let ensureFoundationDetailCapabilities = () => {};
       let retryCapabilities = () => {};
       let loadKnowledgeArticle = () => {};
       // 2026-10-05 리서치 라이브러리 redesign: 목차 · 본문 · 연결 shell (industry-view.js). The tab is now the
       // open contents section; the view is the open document (domain overview, part, AI-foundation module, guide).
       const viewOf = () => state.tab === 'foundations' ? 'module' : state.tab === 'relationships' ? 'guide' : state.atlasView === 'domain' ? 'domain' : 'node';
       const stripReferenceChrome = (node) => {
         node?.querySelectorAll?.('.atlas-deep-sources, .atlas-module-source-details, .atlas-reference-source-links, .atlas-node-guide-boundary, .atlas-player-product-boundary, .atlas-governance-note').forEach((item) => item.remove());
         return node;
       };
       const render = () => {
         if (!isAlive()) return;
         const coverage = state.taxonomyCoverage ? mergeTaxonomyRelationships(state.taxonomyCoverage) : [];
         const shell = renderIndustryPage(documentRef, {
           root,
           state: { section: state.tab, view: viewOf(), selectedDomainId: state.selectedDomainId, selectedDomainNodeId: state.selectedDomainNodeId, selectedModuleId: state.selectedModuleId, selectedRelationshipGuideId: state.selectedRelationshipGuideId, selectedRelationshipNodeId: state.selectedRelationshipNodeId },
           data: { research: state.research, foundations: state.foundations, foundationLessons: state.foundationLessons, relationshipGuides: state.relationshipGuides, knowledgeSources: state.knowledgeSources, registry: state.registry, failed: { taxonomy: Boolean(state.researchError), foundations: Boolean(state.foundationsError || state.foundationLessonsError), relationships: Boolean(state.relationshipGuidesError) } },
           labels: {
             domain: (domain) => DOMAIN_LABELS[domain.id] || domain.title,
             node: (node) => TAXONOMY_NODE_LABELS[node.id] || node.title,
             nodeId: (id) => TAXONOMY_NODE_LABELS[id] || id,
             layer: (layer) => FOUNDATION_LAYER_DISPLAY[layer.id]?.title || layer.title,
             module: (id) => FOUNDATION_MODULE_LABELS[id] || id,
             category: (kind) => nodeCategory(kind)
           },
           parts: {
             guide: (node) => ATLAS_CONCEPT_GUIDES[node.id] || null,
             story: (node) => state.nodeStories?.[node.id] || null,
             domainText: (domain) => state.domainStories?.[domain.id] || null,
             deep: (node) => stripReferenceChrome(createDeepTaxonomyView(documentRef, node, state.deepTaxonomy, state.selectedDeepTopicId)),
             domainStory: (domain) => stripReferenceChrome(createDomainGuide(documentRef, domain, (state.domainGuides?.guides || []).find((guide) => guide.id === domain.id), (state.domainPackets?.packets || []).find((packet) => packet.domainId === domain.id), state.claimLedger)),
             relations: (nodeId) => { const entry = coverage.find((item) => item.nodeId === nodeId); return entry ? relationList(documentRef, entry.relationGroups) : null; },
           },
           onLocal: (params = {}) => {
             if (params.node) {
               const domain = (state.research?.taxonomyDomains || []).find((item) => (item.nodes || []).some((node) => node.id === params.node));
               state.tab = 'taxonomy'; state.atlasView = 'node';
               if (domain) state.selectedDomainId = domain.id;
               state.selectedDomainNodeId = params.node;
               ensureTabCapabilities('taxonomy');
             } else if (params.lesson) {
               state.tab = 'foundations'; state.selectedModuleId = params.lesson; if (params.chapter) state.selectedLayerId = params.chapter;
               ensureTabCapabilities('foundations'); ensureFoundationDetailCapabilities();
             }
             syncSharedState();
             render();
           },
           onFrame: (id) => { root.history?.pushState?.(null, '', `${root.location.pathname}?mode=frames&node=${encodeURIComponent(id)}#principles`); route('principles'); },
           onConcept: (id) => { root.history?.pushState?.(null, '', `${root.location.pathname}?mode=concept&node=${encodeURIComponent(id)}#principles`); route('principles'); }
         });
         const arrival = createAtlasArrivalContext(documentRef, state.arrivalContext, () => {
           if (typeof root?.history?.back === 'function') root.history.back();
           else if (state.arrivalContext?.returnContext?.route && typeof root?.showPage === 'function') root.showPage(state.arrivalContext.returnContext.route);
         });
         if (arrival) shell.querySelector('.rl-main')?.prepend(arrival);
         content.replaceChildren(shell);
       };
      const onClick = (event) => {
        const target = event.target.closest?.('[data-atlas-action]');
        if (!target || !page.contains(target)) return;
        const action = target.dataset.atlasAction;
        const value = target.dataset.atlasValue;
        if (action === 'retry-capability') { retryCapabilities(value); return; }
        if (action === 'tab' || action === 'section') {
          state.tab = value;
          state.query = '';
          if (value === 'taxonomy') state.atlasView = 'domain';
        }
        if (action === 'layer') {
          state.selectedLayerId = value;
          const layer = state.foundations?.layers?.find((item) => item.id === value);
          state.selectedModuleId = layer?.modules?.[0] || '';
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
          state.atlasView = 'domain';
          state.selectedDomainId = value;
          const domain = state.research?.taxonomyDomains?.find((item) => item.id === value);
          state.selectedDomainNodeId = domain?.nodes?.[0]?.id || '';
          state.selectedDeepTopicId = state.deepTaxonomy?.topics?.find((topic) => topic.anchorNodeIds?.includes(state.selectedDomainNodeId))?.id || '';
        }
        if (action === 'domain-node') {
          state.atlasView = 'node';
          state.selectedDomainNodeId = value;
          state.selectedDeepTopicId = state.deepTaxonomy?.topics?.find((topic) => topic.anchorNodeIds?.includes(value))?.id || '';
        }
        if (action === 'deep-topic') state.selectedDeepTopicId = value;
        if (action === 'relationship-guide') {
          state.selectedRelationshipGuideId = value;
          state.selectedRelationshipNodeId = '';
        }
        if (action === 'relationship-node') state.selectedRelationshipNodeId = value;
        if (action === 'relationship-criticality') {
          state.relationshipCriticality = value;
          state.selectedRelationshipNodeId = '';
        }
        if (action === 'load-article') loadKnowledgeArticle(value);
        if (action !== 'route') {
          event.preventDefault();
          if (action === 'module') learning.markViewed(`atlas-foundations:${value}`);
          if (action === 'domain-node') learning.markViewed(`atlas-node:${value}`);
          syncSharedState();
          render();
          if (action === 'tab' || action === 'section') ensureTabCapabilities(value);
          if (action === 'module') ensureFoundationDetailCapabilities();
          if (state.query) ensureSearchCapabilities();
          if (action === 'module') content.querySelector('[data-atlas-learning-detail-title]')?.focus({ preventScroll: true });
          if (['tab', 'domain', 'domain-node', 'deep-topic', 'relationship-guide', 'relationship-node', 'relationship-criticality'].includes(action)) {
            queueMicrotask(() => content.querySelector(`[data-atlas-action="${action}"][data-atlas-value="${CSS.escape(value)}"]`)?.focus({ preventScroll: true }));
          }
        }
      };
      page.addEventListener('click', onClick);
      bag.add(() => page.removeEventListener('click', onClick));
      import('../../domain/knowledge/industry-node-stories.js').then((module) => { state.nodeStories = module.INDUSTRY_NODE_STORIES; state.domainStories = module.INDUSTRY_DOMAIN_STORIES; if (isAlive()) render(); }).catch(() => {});
           bag.add(() => { delete page.dataset.aioArchitectureRoute; delete page.dataset.aioArchitectureRenderer; delete page.dataset.aioContentKind; delete page.dataset.aioReviewedAt; delete page.dataset.aioKnowledgeLearningState; delete page.dataset.aioAtlasResearch; delete page.dataset.aioAtlasFoundations; delete page.dataset.aioAtlasFoundationLessons; delete page.dataset.aioAtlasKnowledgeArticles; delete page.dataset.aioAtlasKnowledgeStatus; delete page.dataset.aioAtlasRouteTargets; delete page.dataset.aioAtlasRegistry; delete page.dataset.aioAtlasDomainGuides; delete page.dataset.aioAtlasDomainPackets; delete page.dataset.aioAtlasClaims; delete page.dataset.aioAtlasTaxonomyCoverage; delete page.dataset.aioAtlasDeepTaxonomy; delete page.dataset.aioAtlasTelegram; delete page.dataset.aioAtlasCurrentness; delete page.dataset.aioAtlasCurrentEvidenceLedger; delete page.dataset.aioAtlasKnowledgeSources; delete page.dataset.aioAtlasKnowledgeClaims; delete page.dataset.aioAtlasKnowledgeCoverage; delete page.dataset.aioAtlasKnowledgeResearchDossiers; delete page.dataset.aioAtlasKnowledgeDomainDossiers; delete page.dataset.aioAtlasRelationshipGuides; delete page.dataset.aioAtlasCurrentObservations; content.replaceChildren(); });
      render();
      const fetchFn = root?.fetch || globalThis.fetch;
       if (typeof fetchFn === 'function') {
          const datasetMap = {
            research: 'aioAtlasResearch', foundations: 'aioAtlasFoundations', foundationLessons: 'aioAtlasFoundationLessons', knowledgeArticles: 'aioAtlasKnowledgeArticles', routeTargets: 'aioAtlasRouteTargets',
            domainGuides: 'aioAtlasDomainGuides', domainPackets: 'aioAtlasDomainPackets', claimLedger: 'aioAtlasClaims',
            taxonomyCoverage: 'aioAtlasTaxonomyCoverage', deepTaxonomy: 'aioAtlasDeepTaxonomy', telegram: 'aioAtlasTelegram',
            registry: 'aioAtlasRegistry', currentness: 'aioAtlasCurrentness', currentEvidenceLedger: 'aioAtlasCurrentEvidenceLedger',
            knowledgeSources: 'aioAtlasKnowledgeSources', knowledgeStatus: 'aioAtlasKnowledgeStatus', relationshipGuides: 'aioAtlasRelationshipGuides', currentObservations: 'aioAtlasCurrentObservations'
          };
          const finalizeCapabilities = () => {
            const sourceCoverage = state.foundationLessons?.sourceCoverage || {};
            if (state.foundationLessons && !state.foundationLessons.byId) {
              state.foundationLessons = { ...state.foundationLessons, byId: Object.fromEntries((state.foundationLessons.lessons || []).map((lesson) => [lesson.id, { ...lesson, sourceIds: [...new Set([...(lesson.sourceIds || []), ...(sourceCoverage[lesson.id] || [])])] }])) };
            }
            if (state.registry || state.currentness || state.taxonomyCoverage || state.knowledgeSources || state.domainPackets) {
              const evidence = createEvidenceRegistry(state.knowledgeSources, state.research, state.registry, state.foundationLessons, state.domainPackets);
              state.registry = {
                ...(mergePlayerProductCurrentness(state.registry, state.currentness) || { players: [], products: [], sources: [] }),
                sources: evidence.sources,
                evidenceById: Object.freeze({ get: evidence.resolve }),
                evidenceConflicts: evidence.conflicts,
                nodeCoverage: mergeTaxonomyRelationships(state.taxonomyCoverage)
              };
            }
            if (state.research?.taxonomyDomains) {
              const selectedDomain = state.research.taxonomyDomains.find((domain) => domain.id === state.selectedDomainId && domain.nodes?.some((node) => node.id === state.selectedDomainNodeId))
                || state.research.taxonomyDomains.find((domain) => domain.nodes?.some((node) => node.id === state.selectedDomainNodeId))
                || state.research.taxonomyDomains.find((domain) => domain.id === state.selectedDomainId)
                || state.research.taxonomyDomains[0];
              state.selectedDomainId = selectedDomain?.id || state.selectedDomainId;
              if (!selectedDomain?.nodes?.some((node) => node.id === state.selectedDomainNodeId)) state.selectedDomainNodeId = selectedDomain?.nodes?.[0]?.id || '';
              syncSharedState();
            }
            if (state.deepTaxonomy?.topics?.length && !state.deepTaxonomy.topics.some((topic) => topic.id === state.selectedDeepTopicId)) {
              state.selectedDeepTopicId = state.deepTaxonomy.topics.find((topic) => topic.anchorNodeIds?.includes(state.selectedDomainNodeId))?.id || '';
            }
            page.dataset.aioReviewedAt = [state.research?.reviewedAt, state.foundations?.reviewedAt, state.foundationLessons?.reviewedAt, state.taxonomyCoverage?.reviewedAt, state.deepTaxonomy?.reviewedAt, state.relationshipGuides?.reviewedAt, REVIEWED_AT].filter(Boolean).sort().at(-1) || REVIEWED_AT;
          };
          const capabilityLoader = createKnowledgeCapabilityBatchLoader({
            fetchFn,
            state,
            dataset: page.dataset,
            datasetMap,
            signal: scope?.signal,
            isActive: isAlive,
            validators: { currentObservations: validateCurrentObservationsArtifact }
          });
          const loadGroup = async (definitions) => {
            if (!await capabilityLoader.load(definitions)) return;
            finalizeCapabilities();
            render();
          };
          const foundationDefinitions = [{ key: 'foundations', url: FOUNDATIONS_URL }, { key: 'foundationLessons', url: FOUNDATIONS_LESSONS_URL }, { key: 'routeTargets', url: ROUTE_TARGETS_URL }, { key: 'currentObservations', url: CURRENT_OBSERVATIONS_URL }];
          const taxonomyDefinitions = [{ key: 'research', url: RESEARCH_URL }, { key: 'domainGuides', url: DOMAIN_GUIDES_URL }, { key: 'domainPackets', url: DOMAIN_PACKETS_URL }, { key: 'claimLedger', url: DOMAIN_CLAIMS_URL }, { key: 'taxonomyCoverage', url: TAXONOMY_COVERAGE_URL }, { key: 'deepTaxonomy', url: DEEP_TAXONOMY_URL }, { key: 'registry', url: PLAYER_PRODUCT_URL }, { key: 'currentness', url: PLAYER_PRODUCT_CURRENTNESS_URL }, { key: 'knowledgeSources', url: KNOWLEDGE_SOURCES_URL }];
          const relationshipDefinitions = [{ key: 'relationshipGuides', url: KNOWLEDGE_RELATIONSHIP_GUIDES_URL }, { key: 'currentObservations', url: CURRENT_OBSERVATIONS_URL }, { key: 'registry', url: PLAYER_PRODUCT_URL }, { key: 'knowledgeSources', url: KNOWLEDGE_SOURCES_URL }];
          const overviewDefinitions = [{ key: 'research', url: RESEARCH_URL }, { key: 'telegram', url: TELEGRAM_REFERENCE_URL }, { key: 'currentEvidenceLedger', url: CURRENT_EVIDENCE_LEDGER_URL }, { key: 'knowledgeStatus', url: KNOWLEDGE_STATUS_URL }];
          ensureTabCapabilities = (tab = state.tab) => loadGroup(tab === 'taxonomy' ? taxonomyDefinitions : tab === 'relationships' ? relationshipDefinitions : tab === 'overview' ? overviewDefinitions : foundationDefinitions);
          ensureSearchCapabilities = () => {
            if (!state.query) return;
            const searchBase = state.tab === 'foundations' ? foundationDefinitions : state.tab === 'taxonomy' ? taxonomyDefinitions : state.tab === 'relationships' ? relationshipDefinitions : overviewDefinitions;
            loadGroup(searchBase);
          };
          ensureFoundationDetailCapabilities = () => loadGroup([{ key: 'routeTargets', url: ROUTE_TARGETS_URL }]);
          // A failed section load ends in a stated failure; retry clears the failed keys and reloads that section.
          retryCapabilities = (tab = state.tab) => {
            const definitions = tab === 'taxonomy' ? taxonomyDefinitions : tab === 'relationships' ? relationshipDefinitions : foundationDefinitions;
            definitions.forEach(({ key }) => { if (state[`${key}Error`]) { state[`${key}Error`] = false; state[key] = null; } });
            render();
            loadGroup(definitions);
          };
          loadKnowledgeArticle = async (moduleId) => {
            if (!moduleId || state.loadingArticleIds.has(moduleId) || state.knowledgeArticles.articles.some((article) => article.lessonId === moduleId)) return;
            state.articleErrors.delete(moduleId);
            state.loadingArticleIds.add(moduleId);
            render();
            try {
              const article = await loadJsonArtifact(fetchFn, `./public-data/knowledge/articles/atlas-foundations/${encodeURIComponent(moduleId)}.json`, { signal: scope?.signal });
              if (article?.articleId !== `atlas-foundations:${moduleId}` || article?.surface !== 'atlas-foundations' || article?.lessonId !== moduleId) throw new Error(`article identity mismatch: ${moduleId}`);
              if (!isAlive()) return;
              state.knowledgeArticles = { articles: [...state.knowledgeArticles.articles, article] };
              state.knowledgeArticlesError = false;
              state.articleErrors.delete(moduleId);
              page.dataset.aioAtlasKnowledgeArticles = 'connected';
            } catch (error) {
              if (error?.name !== 'AbortError') {
                state.knowledgeArticlesError = true;
                state.articleErrors.add(moduleId);
                page.dataset.aioAtlasKnowledgeArticles = 'unavailable';
              }
            } finally {
              state.loadingArticleIds.delete(moduleId);
              if (isAlive()) render();
            }
          };
          ensureTabCapabilities(state.tab);
       }
      return () => bag.dispose();
    }
  };
}

export { ATLAS_PACKETS, FOUNDATION_TRACKS, TAXONOMY_LEVELS, REPRESENTATIVE_NODES, RESEARCH_URL, FOUNDATIONS_URL, FOUNDATIONS_LESSONS_URL, DOMAIN_GUIDES_URL, DOMAIN_PACKETS_URL, DOMAIN_CLAIMS_URL, TAXONOMY_COVERAGE_URL, DEEP_TAXONOMY_URL, TELEGRAM_REFERENCE_URL, PLAYER_PRODUCT_URL, PLAYER_PRODUCT_CURRENTNESS_URL, KNOWLEDGE_SOURCES_URL, KNOWLEDGE_STATUS_URL, ROUTE_TARGETS_URL, KNOWLEDGE_RELATIONSHIP_GUIDES_URL, CURRENT_OBSERVATIONS_URL };
