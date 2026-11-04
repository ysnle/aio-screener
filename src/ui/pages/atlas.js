import { createResourceBag } from '../../app/lifecycle.js';
import { createEvidenceRegistry } from '../../domain/knowledge/evidence.js';
import { createKnowledgeCapabilityBatchLoader } from '../knowledge/capability-loader.js';
import { navigateKnowledgeRoute, navigateKnowledgeTarget, parseKnowledgeRouteState, parseKnowledgeTargetContext, pushKnowledgeRouteState, replaceKnowledgeRouteState } from '../../app/knowledge-route-state.js';
import { createAppKnowledgeLearningState } from '../../app/knowledge-learning-state.js';
import { renderKnowledgeLesson } from '../../ui/knowledge/lesson.js';
import { createCurrentObservationBlock, validateCurrentObservationsArtifact } from '../../ui/knowledge/current-observations.js';
import { createKnowledgeLearningControls } from '../../ui/knowledge/learning-controls.js';
import { loadJsonArtifact, stableFetcher } from '../../data/artifact-cache.js';
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
// S18 (D8): concept guides and layer titles come from content/research/atlas/page-copy.json via build-research-content.
const ATLAS_COPY_URL = './public-data/atlas/page-copy.json';
const INDUSTRY_STORIES_URL = './public-data/atlas/industry-stories.json';
const TELEGRAM_DISCOVERY_BOUNDARY = 'discovery only';

// The three design specs deliberately stop before source-packet completion.
// Keep this registry structural: no company metric, shipment, yield, price, or
// trading claim is promoted to the UI until an evidence ledger is reviewed.



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
  'domain-ai-economics': 'AI 설비투자·ROIC·기업 재무',
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
  Object.freeze({ id: 'L0', label: '수요/문제', example: 'AI 작업 부하, 병목 문제' }),
  Object.freeze({ id: 'L1', label: '산업 domain', example: '반도체, Cloud, AIDC, 전력' }),
  Object.freeze({ id: 'L2', label: 'sector', example: 'Memory, Foundry, Photonics' }),
  Object.freeze({ id: 'L3', label: 'subsector / 공정', example: 'HBM, EUV, CPO, cooling' }),
  Object.freeze({ id: 'L4', label: '제품 / 사업모델', example: 'product family, service, capacity' }),
  Object.freeze({ id: 'L5', label: 'player / 기관', example: 'role·의존성·고객·지리' }),
  Object.freeze({ id: 'L6', label: '제품·공장·프로그램·지표', example: 'as-of·status·source·KPI' })
]);

const REPRESENTATIVE_NODES = Object.freeze([
  Object.freeze({ id: 'cloud-capex', label: 'Cloud, AI CAPEX', className: '산업 구조', edge: 'CAUSES → AIDC, accelerator, 전력' }),
  Object.freeze({ id: 'memory-wall', label: 'Memory wall', className: '물리 병목', edge: 'REQUIRES → HBM, package, network' }),
  Object.freeze({ id: 'advanced-packaging', label: 'Advanced packaging', className: '공정/제품', edge: 'CONSTRAINS → yield, throughput, cost' }),
  Object.freeze({ id: 'power-grid', label: 'Power, grid', className: '인프라/정책', edge: 'REGULATES → permit, interconnection, tariff' }),
  Object.freeze({ id: 'ai-application', label: 'AI application', className: '수요/서비스', edge: 'MONETIZES → workflow, revenue, savings' }),
  Object.freeze({ id: 'capital-cycle', label: 'CAPEX, ROIC cycle', className: '경제/자본', edge: 'MEASURES → utilization, FCF, return' })
]);

function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// v58.56 (re-audit #8, design 5j "AI 산업 아틀라스 · 가치사슬 · 아래에서 위로"): the 19 domains read as seven stacked
// layers, each with the registry companies whose taxonomy nodes fall in it (public-data/atlas/player-product-registry.json).
// The grouping of domains into layers is structural (which layer a domain supplies), not a ranking or a bottleneck claim,
// so no layer is highlighted as "where the profit is". The model layer has no registry company yet and says so.
export const VALUE_CHAIN_LAYERS = Object.freeze([
  Object.freeze({ n: 7, title: '애플리케이션', desc: '산업·업무 AI, 피지컬 AI, 방산·우주', domains: ['domain-ai-applications', 'domain-on-device-physical-ai', 'domain-physical-ai-robotics', 'domain-drone-defense', 'domain-space-aerospace'] }),
  Object.freeze({ n: 6, title: '모델', desc: '파운데이션 모델, 추론 서비스', domains: [], node: 'cloud-ai-service' }),
  Object.freeze({ n: 5, title: '클라우드', desc: '연산 임대, 플랫폼, 네오클라우드', domains: ['domain-cloud-platform', 'domain-neocloud-finance'] }),
  Object.freeze({ n: 4, title: '데이터센터, 전력', desc: '서버, 냉각, 전력망', domains: ['domain-aidc-cooling', 'domain-power-grid'] }),
  Object.freeze({ n: 3, title: '네트워크', desc: '스위치, 광통신', domains: ['domain-network-photonics'] }),
  Object.freeze({ n: 2, title: '반도체, 메모리', desc: 'GPU, 맞춤형 칩, HBM, SSD', domains: ['domain-compute-silicon', 'domain-memory-storage'] }),
  Object.freeze({ n: 1, title: '장비, 파운드리', desc: '공정, 노광, 패키징, 소재', domains: ['domain-foundry-equipment', 'domain-packaging-substrate', 'domain-resources-materials'] })
]);
const VALUE_CHAIN_CROSS_DOMAINS = Object.freeze(['domain-ai-economics', 'domain-geopolitics-policy-security', 'domain-capital-markets-company-map', 'domain-adjacent-future-tech']);

// v58.56 (#8): tickers for registry companies only where the listing is one exact symbol. US symbols carry the SEC CIK
// so scripts/ci-atlas-contract-check.mjs can prove each pair against public-data/us-listings.json (Nasdaq Trader + SEC CIK);
// Samsung Electronics is its KRX code (checked against public-data/screener-universe.json). No ticker: private (Shield AI), listed only
// outside the US/Korea (KIOXIA, Siemens), or a subsidiary whose parent has two share classes (Google Cloud → Alphabet).
// AWS is shown through its parent's single listing, labelled as the parent.
export const ATLAS_PLAYER_LISTINGS = Object.freeze({
  nvidia: Object.freeze({ ticker: 'NVDA', cik: '0001045810' }),
  amd: Object.freeze({ ticker: 'AMD', cik: '0000002488' }),
  aws: Object.freeze({ ticker: 'AMZN', cik: '0001018724', parent: 'Amazon' }),
  tsmc: Object.freeze({ ticker: 'TSM', cik: '0001046179' }),
  asml: Object.freeze({ ticker: 'ASML', cik: '0000937966' }),
  micron: Object.freeze({ ticker: 'MU', cik: '0000723125' }),
  sandisk: Object.freeze({ ticker: 'SNDK', cik: '0002023554' }),
  synopsys: Object.freeze({ ticker: 'SNPS', cik: '0000883241' }),
  broadcom: Object.freeze({ ticker: 'AVGO', cik: '0001730168' }),
  coherent: Object.freeze({ ticker: 'COHR', cik: '0000820318' }),
  vertiv: Object.freeze({ ticker: 'VRT', cik: '0001674101' }),
  tesla: Object.freeze({ ticker: 'TSLA', cik: '0001318605' }),
  'rocket-lab': Object.freeze({ ticker: 'RKLB', cik: '0001819994' }),
  palantir: Object.freeze({ ticker: 'PLTR', cik: '0001321655' }),
  'mp-materials': Object.freeze({ ticker: 'MP', cik: '0001801368' }),
  ibm: Object.freeze({ ticker: 'IBM', cik: '0000051143' }),
  'samsung-electronics': Object.freeze({ ticker: '005930.KS', krCode: '005930', krName: '삼성전자' })
});
const PLAYER_NO_TICKER_REASON = Object.freeze({ PRIVATE: '비상장', 'google-cloud': '모회사 Alphabet, 보통주 두 종류', kioxia: '도쿄 상장', siemens: '독일 상장' });

export function valueChainLayerPlayers(layer, research, registry) {
  if (layer.node) return []; // no model company in the registry; the managed-AI-service node holds cloud companies
  const nodeIds = new Set((research?.taxonomyDomains || []).filter((domain) => layer.domains.includes(domain.id)).flatMap((domain) => (domain.nodes || []).map((node) => node.id)));
  // Feature audit 2026-11-02: counting matching tags pushed NVIDIA (two compute tags, one network tag) behind four
  // memory makers in 반도체·메모리. A player whose first (primary) tag is in this layer comes first, then registry order.
  return (registry?.players || [])
    .map((player, order) => ({ player, order, primary: nodeIds.has((player.taxonomyNodeIds || [])[0]), hits: (player.taxonomyNodeIds || []).filter((id) => nodeIds.has(id)).length }))
    .filter((item) => item.hits > 0)
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.order - b.order)
    .map((item) => item.player);
}

function createValueChainLayers(documentRef, research, registry, selectedDomainId) {
  if (!research?.taxonomyDomains?.length) return null;
  const block = element(documentRef, 'section', 'rl-aside-block atlas-layers');
  block.dataset.atlasLayers = 'value-chain';
  const head = element(documentRef, 'div', 'atlas-layers-head');
  head.append(element(documentRef, 'h3', 'atlas-layers-title', 'AI 산업 아틀라스'), element(documentRef, 'span', 'atlas-layers-sub', '가치사슬, 아래에서 위로'));
  block.appendChild(head);
  const list = element(documentRef, 'ol', 'atlas-layers-list');
  VALUE_CHAIN_LAYERS.forEach((layer) => {
    const current = layer.domains.includes(selectedDomainId);
    const item = element(documentRef, 'li', `atlas-layer${current ? ' is-current' : ''}`);
    item.dataset.atlasLayer = String(layer.n);
    const open = element(documentRef, 'button', 'atlas-layer-open');
    open.type = 'button';
    open.dataset.atlasAction = layer.node ? 'domain-node' : 'domain';
    open.dataset.atlasValue = layer.node || layer.domains[0];
    if (current) open.setAttribute('aria-current', 'true');
    open.setAttribute('aria-label', `${layer.n}층 ${layer.title} — ${layer.desc} 설명 열기`);
    const text = element(documentRef, 'span', 'atlas-layer-text');
    text.append(element(documentRef, 'b', 'atlas-layer-name', layer.title), element(documentRef, 'span', 'atlas-layer-desc', layer.desc));
    open.append(element(documentRef, 'span', 'atlas-layer-n', String(layer.n)), text);
    item.appendChild(open);
    const players = valueChainLayerPlayers(layer, research, registry);
    const chips = element(documentRef, 'div', 'atlas-layer-players');
    if (!players.length) chips.appendChild(element(documentRef, 'span', 'atlas-layer-empty', layer.node ? '등록된 모델 기업 없음, 관리형 AI 서비스에서 설명' : '등록된 기업 없음'));
    players.slice(0, 4).forEach((player) => {
      const listing = ATLAS_PLAYER_LISTINGS[player.playerId];
      if (listing) {
        const chip = element(documentRef, 'button', 'sx-chip sx-chip--sm atlas-layer-ticker', listing.krName || listing.ticker);
        chip.type = 'button';
        chip.dataset.action = 'showTicker';
        chip.dataset.arg = listing.ticker;
        chip.title = `${player.name}${listing.parent ? ` (모회사 ${listing.parent})` : ''}, 종목 개요 열기`;
        chip.setAttribute('aria-label', chip.title);
        chips.appendChild(chip);
      } else {
        const reason = PLAYER_NO_TICKER_REASON[player.playerId] || PLAYER_NO_TICKER_REASON[player.publicPrivate] || '';
        const chip = element(documentRef, 'span', 'sx-chip sx-chip--sm atlas-layer-company', player.name);
        if (reason) chip.title = `${player.name}, ${reason}`;
        chips.appendChild(chip);
      }
    });
    if (players.length > 4) { const more = element(documentRef, 'span', 'atlas-layer-more', `외 ${players.length - 4}곳`); more.title = players.slice(4).map((player) => player.name).join(', '); chips.appendChild(more); }
    item.appendChild(chips);
    list.appendChild(item);
  });
  block.appendChild(list);
  const cross = element(documentRef, 'div', 'atlas-layers-cross');
  cross.appendChild(element(documentRef, 'span', 'atlas-layers-cross-label', '모든 층에 걸친 주제'));
  VALUE_CHAIN_CROSS_DOMAINS.forEach((id) => {
    const link = element(documentRef, 'button', 'atlas-layers-cross-link', DOMAIN_LABELS[id] || id);
    link.type = 'button';
    link.dataset.atlasAction = 'domain';
    link.dataset.atlasValue = id;
    if (id === selectedDomainId) link.setAttribute('aria-current', 'true');
    cross.appendChild(link);
  });
  block.appendChild(cross);
  // v58.79: the not-a-recommendation line stays; how to use the layers is its hover.
  block.appendChild(Object.assign(element(documentRef, 'p', 'atlas-layers-note', '기업은 역할 예시, 추천 아님'), { title: '층을 누르면 그 분야 설명이, 티커를 누르면 종목 개요가 열립니다.' }));
  return block;
}

const ARRIVAL_METRIC_LABELS = Object.freeze({ BOTTLENECK_CAPACITY: '병목과 공급능력', CAPEX_FCF_ROIC: 'CAPEX → FCF → ROIC' });
const ARRIVAL_TIMEFRAME_LABELS = Object.freeze({ STRUCTURAL: '구조적 장기 흐름', '3Y_5Y': '3~5년' });

function createAtlasArrivalContext(documentRef, context, onReturn) {
  if (!context || context.routeId !== 'atlas') return null;
  const nodeId = String(context.knowledgeNode || '').replace(/^atlas:/, '');
  const block = element(documentRef, 'aside', 'atlas-arrival-context');
  block.setAttribute('aria-label', '이전 이야기에서 이어 읽기');
  block.append(
    element(documentRef, 'span', 'atlas-learning-column-label', '개념·분석에서 이어 읽기'),
    element(documentRef, 'h2', 'atlas-section-title', `${withDirectionParticle(TAXONOMY_NODE_LABELS[nodeId] || 'AI 가치사슬')} 연결했습니다.`),
    element(documentRef, 'p', 'atlas-card-copy', `${ARRIVAL_METRIC_LABELS[context.metric] || '산업 전달 경로'} 관점, 관찰 기간 ${ARRIVAL_TIMEFRAME_LABELS[context.timeframe] || '별도 확인'}`)
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
// Actions that open a different document (a history entry each); selections inside one document replace the URL.
const ATLAS_DOCUMENT_ACTIONS = new Set(['tab', 'section', 'layer', 'module', 'domain', 'domain-node', 'relationship-guide']);
const ATLAS_ROUTE_LABELS = Object.freeze({ principles: '개념·분석', atlas: '산업 지도', masters: '대가 보유 종목', fundamental: '재무 공시', themes: '테마·산업', macro: '매크로', fxbond: '금리와 환율', technical: '종목, 차트' });









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
      element(documentRef, 'p', 'atlas-card-copy', `작동 원리, ${branch.mechanism}`),
      element(documentRef, 'p', 'atlas-card-copy atlas-deep-observe', `관찰 지표, ${branch.observe}`),
      element(documentRef, 'p', 'atlas-card-copy atlas-node-guide-risk', `오해 방지, ${branch.caution}`)
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
    line.append(element(documentRef, 'strong', 'atlas-relation-type', `${group.label}: `), documentRef.createTextNode(group.items.map((item) => item.text ? `${item.title}(${item.text})` : item.title).join(', ')));
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
        element(documentRef, 'p', 'atlas-card-copy atlas-domain-guide-boundary', `${claim.claimType === 'STRUCTURAL_REFERENCE' ? '구조 참고' : '검토 후보'}, ${claim.currentnessPolicy === 'NOT_APPLICABLE_STRUCTURAL_REFERENCE' ? '현재성 비적용' : '기준일 확인 필요'}, 검토일 ${claim.reviewedAt || '미확정'}, ${claim.status === 'PARTIAL' ? '부분 검토' : claim.status || '상태 확인 필요'}`),
        element(documentRef, 'p', 'atlas-card-copy atlas-domain-guide-boundary', claim.evidenceBoundary || '현재 수치·가격·생산 상태로 일반화하지 않습니다.')
      );
      const claimLinks = element(documentRef, 'div', 'atlas-domain-guide-links');
      (claim.sourceIds || []).forEach((sourceId) => {
        const source = packetSourceById.get(sourceId);
        if (!source?.url) return;
        const link = element(documentRef, 'a', 'atlas-reference-source-link', `${source.publisher}${source.title ? `, ${source.title}` : ''}`);
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
      // v58.80 (first-users R2-17, atlas): opening a document adds a history entry, so Back returns to the previous one.
      const syncSharedState = ({ push = false } = {}) => (push ? pushKnowledgeRouteState : replaceKnowledgeRouteState)({ root, state: {
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
           data: { currentObservations: state.currentObservations, research: state.research, foundations: state.foundations, foundationLessons: state.foundationLessons, relationshipGuides: state.relationshipGuides, knowledgeSources: state.knowledgeSources, registry: state.registry, failed: { taxonomy: Boolean(state.researchError), foundations: Boolean(state.foundationsError || state.foundationLessonsError), relationships: Boolean(state.relationshipGuidesError) } },
           labels: {
             domain: (domain) => DOMAIN_LABELS[domain.id] || domain.title,
             node: (node) => TAXONOMY_NODE_LABELS[node.id] || node.title,
             nodeId: (id) => TAXONOMY_NODE_LABELS[id] || id,
             layer: (layer) => state.copy?.FOUNDATION_LAYER_DISPLAY?.[layer.id]?.title || layer.title,
             module: (id) => FOUNDATION_MODULE_LABELS[id] || id,
             category: (kind) => nodeCategory(kind)
           },
           parts: {
             guide: (node) => state.copy?.ATLAS_CONCEPT_GUIDES?.[node.id] || null,
             story: (node) => state.nodeStories?.[node.id] || null,
             domainText: (domain) => state.domainStories?.[domain.id] || null,
             deep: (node) => stripReferenceChrome(createDeepTaxonomyView(documentRef, node, state.deepTaxonomy, state.selectedDeepTopicId)),
             layers: (domain) => createValueChainLayers(documentRef, state.research, state.registry, domain?.id || null),
             domainStory: (domain) => stripReferenceChrome(createDomainGuide(documentRef, domain, (state.domainGuides?.guides || []).find((guide) => guide.id === domain.id), (state.domainPackets?.packets || []).find((packet) => packet.domainId === domain.id), state.claimLedger)),
             relations: (nodeId) => { const entry = coverage.find((item) => item.nodeId === nodeId); return entry ? relationList(documentRef, entry.relationGroups) : null; },
             // X07 (2026-10-13): the reading view strips the old source chrome, so domain and node documents lost every
             // path to their evidence. One folded "근거와 가정" carries the same sources: the domain guide and review
             // packet for a domain; the anchored deep-taxonomy topics (then the domain packet) for a node.
             basis: (domain, node = null) => {
               const guide = (state.domainGuides?.guides || []).find((item) => item.id === domain?.id) || null;
               const packet = (state.domainPackets?.packets || []).find((item) => item.domainId === domain?.id) || null;
               const packetSources = (packet?.sources || []).map((source) => ({ label: `${source.publisher || ''}${source.title ? `${source.publisher ? ', ' : ''}${source.title}` : ''}` || source.url, url: source.url }));
               const topicSources = node ? (state.deepTaxonomy?.topics || []).filter((topic) => topic.anchorNodeIds?.includes(node.id)).flatMap((topic) => topic.sources || []).map((source) => ({ label: source.label, url: source.url })) : [];
               const guideSource = guide?.sourceUrl ? [{ label: guide.sourceName || '공식 자료', url: guide.sourceUrl }] : [];
               const seen = new Set();
               const sources = [...topicSources, ...guideSource, ...packetSources].filter((source) => source.url && !seen.has(source.url) && seen.add(source.url)).slice(0, 8);
               return { sources, asOf: packet?.reviewedAt || null };
             },
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
             syncSharedState({ push: true });
             render();
           },
           // v58.63 (architecture audit UI-04): pushState then route() lost mode/node — the legacy showPage clears the query
           // of a plain route first. The shared knowledge navigator carries them through, as research-shell does.
           onFrame: (id) => { navigateKnowledgeRoute({ root, page: 'principles', params: { mode: 'frames', node: id } }); },
           onConcept: (id) => { navigateKnowledgeRoute({ root, page: 'principles', params: { mode: 'concept', node: id } }); }
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
          // v58.56 (#8): a node opened from outside its domain's TOC (the value-chain card) selects that domain too.
          const owner = state.research?.taxonomyDomains?.find((item) => (item.nodes || []).some((node) => node.id === value));
          if (owner) state.selectedDomainId = owner.id;
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
          syncSharedState({ push: ATLAS_DOCUMENT_ACTIONS.has(action) });
          render();
          if (action === 'tab' || action === 'section') ensureTabCapabilities(value);
          if (action === 'module') ensureFoundationDetailCapabilities();
          if (state.query) ensureSearchCapabilities();
          if (action === 'module') content.querySelector('[data-atlas-learning-detail-title]')?.focus({ preventScroll: true });
          // v57.81 (phone/iPad audit): on compact layouts the table of contents sits below the document, so a domain
          // picked there loaded the new document out of sight. As on #principles, the view moves to the document and
          // its title takes focus; on wide layouts, where the title is already in view, the picked item keeps focus.
          const docTitle = ['domain', 'domain-node', 'relationship-guide'].includes(action) && target.closest('.rl-nav')
            ? content.querySelector('.rl-main .af-issue, .rl-main h2') : null;
          const titleBox = docTitle?.getBoundingClientRect?.();
          if (docTitle && titleBox && (titleBox.top < 0 || titleBox.top > (root?.innerHeight || 0))) {
            if (!docTitle.hasAttribute('tabindex')) docTitle.setAttribute('tabindex', '-1');
            docTitle.closest('.rl-main')?.scrollIntoView({ block: 'start', behavior: 'auto' });
            docTitle.focus({ preventScroll: true });
          } else if (['tab', 'domain', 'domain-node', 'deep-topic', 'relationship-guide', 'relationship-node', 'relationship-criticality'].includes(action)) {
            queueMicrotask(() => content.querySelector(`[data-atlas-action="${action}"][data-atlas-value="${CSS.escape(value)}"]`)?.focus({ preventScroll: true }));
          }
        }
      };
      page.addEventListener('click', onClick);
      bag.add(() => page.removeEventListener('click', onClick));
      // Back and Forward between atlas documents: the URL names the open section and document, so the page re-reads it.
      const onPop = () => {
        if (!isAlive() || !/^#atlas(?:$|[?&])/.test(String(root?.location?.hash || ''))) return;
        const shared = parseKnowledgeRouteState(root.location);
        if (['foundations', 'relationships', 'taxonomy'].includes(shared.mode)) state.tab = shared.mode;
        if (state.tab === 'foundations') {
          if (shared.chapter) state.selectedLayerId = shared.chapter;
          if (shared.lesson) state.selectedModuleId = shared.lesson;
        } else if (state.tab === 'taxonomy') {
          state.atlasView = shared.view === 'domain' ? 'domain' : 'node';
          if (shared.domain) state.selectedDomainId = shared.domain;
          if (shared.node) state.selectedDomainNodeId = shared.node;
          state.selectedDeepTopicId = shared.topic || '';
        } else {
          if (shared.guide) state.selectedRelationshipGuideId = shared.guide;
          state.selectedRelationshipNodeId = shared.node || '';
          if (shared.criticality) state.relationshipCriticality = shared.criticality;
        }
        state.query = '';
        ensureTabCapabilities(state.tab);
        if (state.tab === 'foundations') ensureFoundationDetailCapabilities();
        render();
      };
      root?.addEventListener?.('popstate', onPop);
      bag.add(() => root?.removeEventListener?.('popstate', onPop));
      loadJsonArtifact(stableFetcher(root), ATLAS_COPY_URL, { signal: scope?.signal }).then((copy) => { state.copy = copy; if (isAlive()) render(); }).catch(() => {});
      loadJsonArtifact(stableFetcher(root), INDUSTRY_STORIES_URL, { signal: scope?.signal }).then((stories) => { state.nodeStories = stories.nodes; state.domainStories = stories.domains; if (isAlive()) render(); }).catch(() => {});
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
            fetchFn: stableFetcher(root),
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
            // v59.45 (P30-LOAD-01 class): the artifact cache keeps a parsed copy that failed the identity check, so a
            // retry after a failure fetches the file again instead of re-reading the same rejected copy.
            const retryAfterFailure = state.articleErrors.has(moduleId);
            state.articleErrors.delete(moduleId);
            state.loadingArticleIds.add(moduleId);
            render();
            try {
              const article = await loadJsonArtifact(stableFetcher(root), `./public-data/knowledge/articles/atlas-foundations/${encodeURIComponent(moduleId)}.json`, { signal: scope?.signal, force: retryAfterFailure });
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

export { ATLAS_COPY_URL, INDUSTRY_STORIES_URL, TAXONOMY_LEVELS, REPRESENTATIVE_NODES, RESEARCH_URL, FOUNDATIONS_URL, FOUNDATIONS_LESSONS_URL, DOMAIN_GUIDES_URL, DOMAIN_PACKETS_URL, DOMAIN_CLAIMS_URL, TAXONOMY_COVERAGE_URL, DEEP_TAXONOMY_URL, TELEGRAM_REFERENCE_URL, PLAYER_PRODUCT_URL, PLAYER_PRODUCT_CURRENTNESS_URL, KNOWLEDGE_SOURCES_URL, KNOWLEDGE_STATUS_URL, ROUTE_TARGETS_URL, KNOWLEDGE_RELATIONSHIP_GUIDES_URL, CURRENT_OBSERVATIONS_URL };
