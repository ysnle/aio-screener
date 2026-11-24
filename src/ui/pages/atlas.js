import { createResourceBag } from '../../app/lifecycle.js';
import { createEvidenceRegistry } from '../../domain/knowledge/evidence.js';
import { createKnowledgeCapabilityBatchLoader } from '../knowledge/capability-loader.js';
import { navigateKnowledgeRoute, navigateKnowledgeTarget, parseKnowledgeRouteState, parseKnowledgeTargetContext, pushKnowledgeRouteState, replaceKnowledgeRouteState } from '../../app/knowledge-route-state.js';
import { createAppKnowledgeLearningState } from '../../app/knowledge-learning-state.js';
import { validateCurrentObservationsArtifact } from '../knowledge/current-observations.js';
import { createKnowledgeLearningControls } from '../knowledge/learning-controls.js';
import { BIGTECH_CASHFLOW, COMPANY_PROFILE_INDEX, artifactFamilyUrl, artifactFetcher, artifactUrl, loadArtifact, loadArtifactUrl } from '../../data/artifact-registry.js';
import { AI_MAP_IDS, DATACENTER_GUIDE_ID, aiMapLayer, capitalFlowsView, datacenterChain, layerSupplyLinks } from '../../domain/knowledge/ai-map.js';
import { DOMAIN_LABELS, FOUNDATION_MODULE_LABELS, TAXONOMY_NODE_LABELS } from '../../domain/knowledge/atlas-labels.js';
import { VALUE_CHAIN_LAYERS, PROFILE_LAYER_TO_ATLAS } from '../../domain/knowledge/value-chain-layers.js';
import { AI_BOTTLENECK_LEAD_TIMES, AI_CAPEX_FLOW } from '../../domain/themes/ai-capex-flow.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { listingMarket } from '../../domain/screener/market-scope.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { applySafeExternalLink } from '../knowledge/safe-external-link.js';
import { nodeCategory, relationGroups, typedRelations } from '../../domain/knowledge/atlas-relations.js';
import { renderIndustryPage } from '../knowledge/industry-view.js';
import { withDirectionParticle } from '../../domain/content/korean-particle.js';

const REVIEWED_AT = '2026-08-18';
const RESEARCH_URL = artifactUrl('atlas/source-packets.json');
const FOUNDATIONS_URL = artifactUrl('atlas/foundations.json');
const FOUNDATIONS_LESSONS_URL = artifactUrl('atlas/foundation-lessons.json');
const DOMAIN_GUIDES_URL = artifactUrl('atlas/domain-guides.json');
const DOMAIN_PACKETS_URL = artifactUrl('atlas/domain-source-packets.json');
const DOMAIN_CLAIMS_URL = artifactUrl('atlas/domain-claim-ledger.json');
const TAXONOMY_COVERAGE_URL = artifactUrl('atlas/taxonomy-node-coverage.json');
const TELEGRAM_REFERENCE_URL = artifactUrl('telegram-digest.json');
const PLAYER_PRODUCT_URL = artifactUrl('atlas/player-product-registry.json');
const PLAYER_PRODUCT_CURRENTNESS_URL = artifactUrl('atlas/player-product-currentness.json');
const DEEP_TAXONOMY_URL = artifactUrl('atlas/deep-taxonomy.json');
const KNOWLEDGE_SOURCES_URL = artifactUrl('knowledge/sources.json');
const KNOWLEDGE_STATUS_URL = artifactUrl('knowledge/status-summary.json');
const KNOWLEDGE_RELATIONSHIP_GUIDES_URL = artifactUrl('knowledge/relationship-guides.json');
const CURRENT_OBSERVATIONS_URL = artifactUrl('knowledge/current-observations.json');
const CURRENT_EVIDENCE_LEDGER_URL = artifactUrl('atlas/current-evidence-ledger.json');
const ROUTE_TARGETS_URL = artifactUrl('knowledge/route-targets.json');
// S18 (D8): concept guides and layer titles come from content/research/atlas/page-copy.json via build-research-content.
const ATLAS_COPY_URL = artifactUrl('atlas/page-copy.json');
const INDUSTRY_STORIES_URL = artifactUrl('atlas/industry-stories.json');
// AI 지도: the company graph (supply links between layers) and the dated capital-flow file, a file of its own beside the
// atlas reference set (src/domain/knowledge/ai-map.js); a missing or empty capital file leaves that map out.
const COMPANY_GRAPH_ID = 'company-profiles/graph.json';
const CAPITAL_FLOWS_URL = artifactUrl('atlas/capital-flows.json');
const ATLAS_SECTIONS = Object.freeze(['foundations', 'relationships', 'taxonomy', 'aimap']);

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

// The seven layers and the story-layer table live in src/domain/knowledge/value-chain-layers.js (the 종목 개요 reads them too).
const VALUE_CHAIN_CROSS_DOMAINS = Object.freeze(['domain-ai-economics', 'domain-geopolitics-policy-security', 'domain-capital-markets-company-map', 'domain-adjacent-future-tech']);

// Tickers for registry companies only where the listing is one exact symbol. US symbols carry the SEC CIK
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

// A registry player whose company story is filed under another symbol than its own listing.
const PLAYER_PROFILE_SYMBOL = Object.freeze({ 'google-cloud': 'GOOGL' });
// The one listing-market rule (domain/screener/market-scope.js): a Korean listing shows its Korean name, US first.
const isKrListing = (symbol) => listingMarket({ sym: symbol }) === 'KR';

// The companies of one layer: every researched company story (public-data/company-profiles/index.json) whose AI layer
// maps here — the single source — and, for a registry player with no story (private, or listed only abroad), the
// registry's taxonomy tags as before. Registry players come first in registry order (primary tag first), then the
// other stories, US before Korea. Each row: { name, symbol (null when not listed here), label, note }.
export function valueChainLayerPlayers(layer, research, registry, profiles = []) {
  const profileRows = Array.isArray(profiles) ? profiles.filter((row) => row?.symbol && row.layer) : [];
  const profileBySymbol = new Map(profileRows.map((row) => [String(row.symbol).toUpperCase(), row]));
  const nodeIds = new Set((research?.taxonomyDomains || []).filter((domain) => layer.domains.includes(domain.id)).flatMap((domain) => (domain.nodes || []).map((node) => node.id)));
  const rowOf = (profile) => {
    const symbol = String(profile.symbol).toUpperCase();
    const shortName = String(profile.name || symbol).split(' (')[0].trim();
    return { name: String(profile.name || symbol), symbol, label: isKrListing(symbol) ? shortName : symbol, note: '' };
  };
  const rows = [];
  const seen = new Set();
  // Counting matching tags pushed NVIDIA (two compute tags, one network tag) behind four
  // memory makers in 반도체·메모리. A player whose first (primary) tag is in this layer comes first, then registry order.
  (registry?.players || [])
    .map((player, order) => {
      const symbol = PLAYER_PROFILE_SYMBOL[player.playerId] || ATLAS_PLAYER_LISTINGS[player.playerId]?.ticker || null;
      const profile = symbol ? profileBySymbol.get(symbol.toUpperCase()) : null;
      const inLayer = profile ? PROFILE_LAYER_TO_ATLAS[profile.layer] === layer.n : (player.taxonomyNodeIds || []).some((id) => nodeIds.has(id));
      return { player, profile, order, inLayer, primary: profile ? true : nodeIds.has((player.taxonomyNodeIds || [])[0]) };
    })
    .filter((item) => item.inLayer)
    .sort((a, b) => Number(b.primary) - Number(a.primary) || a.order - b.order)
    .forEach(({ player, profile }) => {
      if (profile) { const row = rowOf(profile); if (!seen.has(row.symbol)) { seen.add(row.symbol); rows.push(row); } return; }
      const listing = ATLAS_PLAYER_LISTINGS[player.playerId];
      if (listing) {
        if (seen.has(listing.ticker)) return;
        seen.add(listing.ticker);
        rows.push({ name: player.name, symbol: listing.ticker, label: listing.krName || listing.ticker, note: listing.parent ? `모회사 ${listing.parent}` : '' });
      } else rows.push({ name: player.name, symbol: null, label: player.name, note: PLAYER_NO_TICKER_REASON[player.playerId] || PLAYER_NO_TICKER_REASON[player.publicPrivate] || '' });
    });
  profileRows
    .filter((profile) => PROFILE_LAYER_TO_ATLAS[profile.layer] === layer.n)
    .map(rowOf)
    .filter((row) => !seen.has(row.symbol))
    .sort((a, b) => Number(isKrListing(a.symbol)) - Number(isKrListing(b.symbol)) || a.symbol.localeCompare(b.symbol))
    .forEach((row) => { seen.add(row.symbol); rows.push(row); });
  return rows;
}

function createValueChainLayers(documentRef, research, registry, selectedDomainId, profiles = []) {
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
    const players = valueChainLayerPlayers(layer, research, registry, profiles);
    const chips = element(documentRef, 'div', 'atlas-layer-players');
    if (!players.length) chips.appendChild(element(documentRef, 'span', 'atlas-layer-empty', layer.node ? '등록된 모델 기업 없음, 관리형 AI 서비스에서 설명' : '등록된 기업 없음'));
    players.slice(0, 4).forEach((player) => {
      if (player.symbol) {
        const chip = element(documentRef, 'button', 'sx-chip sx-chip--sm atlas-layer-ticker', player.label);
        chip.type = 'button';
        chip.dataset.action = 'showTicker';
        chip.dataset.arg = player.symbol;
        chip.title = `${player.name}${player.note ? ` (${player.note})` : ''}, 종목 개요 열기`;
        chip.setAttribute('aria-label', chip.title);
        chips.appendChild(chip);
      } else {
        const chip = element(documentRef, 'span', 'sx-chip sx-chip--sm atlas-layer-company', player.label);
        if (player.note) chip.title = `${player.name}, ${player.note}`;
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
  // The not-a-recommendation line stays; how to use the layers is its hover.
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

// Actions that open a different document (a history entry each); selections inside one document replace the URL.
const ATLAS_DOCUMENT_ACTIONS = new Set(['tab', 'section', 'layer', 'module', 'domain', 'domain-node', 'relationship-guide', 'ai-map']);

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

// Relations come from the typed canonical set (atlas-relations.js). The producer's per-domain
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
  // v59.70 (QUALITY-BAR 6): the face is the domain's name and its one-paragraph flow. The column labels are gone, the
  // observation/verification paragraph opens the evidence fold, and the 'follow the sub-areas below' how-to line is cut.
  const block = element(documentRef, 'section', 'atlas-domain-brief');
  block.append(
    element(documentRef, 'h3', 'atlas-domain-detail-title', DOMAIN_LABELS[domain.id] || domain.title),
    element(documentRef, 'p', 'atlas-domain-detail-lede', `${guide.definition} 실제 흐름은 ${guide.mechanism}의 순서로 이어집니다.`)
  );

  const evidence = element(documentRef, 'details', 'atlas-domain-evidence');
  evidence.appendChild(element(documentRef, 'summary', 'atlas-module-source-summary', '확인 질문과 근거'));
  evidence.appendChild(element(documentRef, 'p', 'atlas-card-copy atlas-domain-brief-observation', `기본 관찰 단위는 ${guide.unit}입니다. 그러나 ${guide.bottleneck}에서 흐름이 막히면 겉으로 보이는 성장과 실제 현금 회수가 달라질 수 있습니다. 그래서 “${guide.verificationQuestion}”를 다음 확인 질문으로 남깁니다.`));
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
       const initialTab = arrivalNode ? 'taxonomy' : ATLAS_SECTIONS.includes(sharedRoute.mode) ? sharedRoute.mode : 'taxonomy';
       // AI 지도 selection: which map, a layer of the value chain, and one node (a company, a chain stage); a link of the
       // value chain is picked on the page and not kept in the address.
       const aiMapFrom = (shared) => ({ map: AI_MAP_IDS.includes(shared.map) ? shared.map : 'value-chain', layer: aiMapLayer(shared.layer), node: shared.mode === 'aimap' ? shared.node || null : null, link: null });
       const learning = createAppKnowledgeLearningState(root);
       const initialLayerId = sharedRoute.chapter || 'F1';
       const initialModuleId = sharedRoute.lesson || (initialLayerId === 'F0' ? FOUNDATION_PRIMER_MODULES[0].id : 'energy-and-power');
       const state = { tab: initialTab, query: '', arrivalContext: arrivalContext?.routeId === 'atlas' ? arrivalContext : null, selectedLayerId: initialLayerId, selectedModuleId: initialModuleId, selectedDomainId: sharedRoute.domain || 'domain-cloud-platform', selectedDomainNodeId: arrivalNode || sharedRoute.node || (sharedRoute.domain ? '' : 'cloud-hyperscaler'), atlasView: !arrivalNode && (sharedRoute.view === 'domain' || !sharedRoute.node) ? 'domain' : 'node', selectedDeepTopicId: sharedRoute.topic || '', selectedRelationshipGuideId: sharedRoute.guide || 'neutral-rate-policy-gap', selectedRelationshipNodeId: initialTab === 'relationships' ? sharedRoute.node || '' : '', relationshipCriticality: ['all', 'structural', 'conditional', 'claim'].includes(sharedRoute.criticality) ? sharedRoute.criticality : 'all', aiMap: aiMapFrom(sharedRoute), aiMapView: null, companyGraph: null, companyGraphError: false, capitalFlows: null, capitalFlowsLoaded: false, relationshipGuides: null, currentObservations: null, research: null, foundations: null, foundationLessons: null, knowledgeArticles: { articles: [] }, knowledgeStatus: null, routeTargets: null, registry: null, domainGuides: null, domainPackets: null, claimLedger: null, taxonomyCoverage: null, deepTaxonomy: null, telegram: null, currentness: null, currentEvidenceLedger: null, knowledgeSources: null, relationshipGuidesError: false, currentObservationsError: false, researchError: false, foundationsError: false, foundationLessonsError: false, knowledgeArticlesError: false, knowledgeStatusError: false, routeTargetsError: false, registryError: false, domainGuidesError: false, domainPacketsError: false, claimLedgerError: false, taxonomyCoverageError: false, deepTaxonomyError: false, telegramError: false, currentnessError: false, currentEvidenceLedgerError: false, knowledgeSourcesError: false, loadingArticleIds: new Set(), articleErrors: new Set() };
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
      const syncSharedState = ({ push = false } = {}) => (push ? pushKnowledgeRouteState : replaceKnowledgeRouteState)({ root, page: 'atlas', state: {
        mode: state.tab,
        node: state.tab === 'taxonomy' ? state.selectedDomainNodeId : state.tab === 'relationships' ? state.selectedRelationshipNodeId : state.tab === 'aimap' ? state.aiMap.node : null,
        map: state.tab === 'aimap' && state.aiMap.map !== AI_MAP_IDS[0] ? state.aiMap.map : null,
        layer: state.tab === 'aimap' && state.aiMap.map === 'value-chain' ? state.aiMap.layer : null,
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
       const viewOf = () => state.tab === 'foundations' ? 'module' : state.tab === 'relationships' ? 'guide' : state.tab === 'aimap' ? 'aimap' : state.atlasView === 'domain' ? 'domain' : 'node';
       const todayIso = () => new Date().toISOString().slice(0, 10);
       const capitalView = () => capitalFlowsView(state.capitalFlows, { today: todayIso() });
       // The AI 지도 document: its renderer loads on first use (ai-map-view.js), the data from the loaded artifacts.
       const aiMapDocument = () => {
         const view = state.aiMapView;
         if (!view) return element(documentRef, 'p', 'rl-copy', '불러오는 중입니다.');
         const profiles = root?.[COMPANY_PROFILE_INDEX.key]?.profiles || [];
         const layerOf = (symbol) => PROFILE_LAYER_TO_ATLAS[state.companyGraph?.nodes?.[symbol]?.layer] ?? null;
         const guide = (state.relationshipGuides?.guides || []).find((item) => item.id === DATACENTER_GUIDE_ID) || null;
         return view.renderAiMap(documentRef, {
           selection: state.aiMap,
           data: {
             layers: state.research?.taxonomyDomains?.length ? VALUE_CHAIN_LAYERS : [],
             playersOf: (layer) => valueChainLayerPlayers(layer, state.research, state.registry, profiles),
             supply: state.companyGraph ? layerSupplyLinks(state.companyGraph, layerOf) : null,
             failed: state.companyGraphError,
             chain: state.taxonomyCoverage && guide ? datacenterChain({ coverage: state.taxonomyCoverage, guide, capexFlow: AI_CAPEX_FLOW, leadTimes: AI_BOTTLENECK_LEAD_TIMES, bigtech: root?.[BIGTECH_CASHFLOW.key] || null }) : null,
             nodeLabel: (id) => TAXONOMY_NODE_LABELS[id] || id,
             capital: capitalView()
           }
         });
       };
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
           data: { aiMaps: AI_MAP_IDS.filter((id) => id !== 'capital' || capitalView()), aiMapId: state.aiMap.map, currentObservations: state.currentObservations, research: state.research, foundations: state.foundations, foundationLessons: state.foundationLessons, relationshipGuides: state.relationshipGuides, knowledgeSources: state.knowledgeSources, registry: state.registry, failed: { taxonomy: Boolean(state.researchError), foundations: Boolean(state.foundationsError || state.foundationLessonsError), relationships: Boolean(state.relationshipGuidesError) } },
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
             aiMap: () => aiMapDocument(),
             layers: (domain) => createValueChainLayers(documentRef, state.research, state.registry, domain?.id || null, root?.[COMPANY_PROFILE_INDEX.key]?.profiles || []),
             domainStory: (domain) => stripReferenceChrome(createDomainGuide(documentRef, domain, (state.domainGuides?.guides || []).find((guide) => guide.id === domain.id), (state.domainPackets?.packets || []).find((packet) => packet.domainId === domain.id), state.claimLedger)),
             relations: (nodeId) => { const entry = coverage.find((item) => item.nodeId === nodeId); return entry ? relationList(documentRef, entry.relationGroups) : null; },
             // X07: the reading view strips the old source chrome, so domain and node documents lost every
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
        if (action === 'ai-map') state.tab = 'aimap';
        if (action === 'ai-map') state.aiMap = { map: AI_MAP_IDS.includes(value) ? value : AI_MAP_IDS[0], layer: null, node: null, link: null };
        if (action === 'ai-map-layer') state.aiMap = { ...state.aiMap, layer: aiMapLayer(value), node: null, link: null };
        if (action === 'ai-map-link') state.aiMap = { ...state.aiMap, link: state.aiMap.link === value ? null : value, node: null };
        if (action === 'ai-map-node') state.aiMap = { ...state.aiMap, node: value, layer: null, link: null };
        if (action === 'ai-map-clear') state.aiMap = { ...state.aiMap, layer: null, node: null, link: null };
        if (action === 'domain-node') {
          state.tab = 'taxonomy'; // also from an AI 지도 stage, which lists the atlas parts it holds
          state.atlasView = 'node';
          // A node opened from outside its domain's TOC (the value-chain card) selects that domain too.
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
          if (action === 'ai-map') ensureTabCapabilities('aimap');
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
          } else if (['tab', 'domain', 'domain-node', 'deep-topic', 'relationship-guide', 'relationship-node', 'relationship-criticality', 'ai-map', 'ai-map-layer', 'ai-map-link', 'ai-map-node'].includes(action)) {
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
        if (ATLAS_SECTIONS.includes(shared.mode)) state.tab = shared.mode;
        if (state.tab === 'aimap') state.aiMap = aiMapFrom(shared);
        else if (state.tab === 'foundations') {
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
      loadArtifactUrl(root, ATLAS_COPY_URL, { signal: scope?.signal }).then((copy) => { state.copy = copy; if (isAlive()) render(); }).catch(() => {});
      // The value-chain card's companies: the shared company-story index (~55 KB, already read by the 종목 회사 tab).
      refreshSharedArtifact(root, COMPANY_PROFILE_INDEX).then(({ changed }) => { if (changed && isAlive()) render(); }).catch(() => {});
      loadArtifactUrl(root, INDUSTRY_STORIES_URL, { signal: scope?.signal }).then((stories) => { state.nodeStories = stories.nodes; state.domainStories = stories.domains; if (isAlive()) render(); }).catch(() => {});
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
            fetchFn: artifactFetcher(root),
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
          // AI 지도: the layers and their companies (research, registry), the chain's atlas parts (coverage) and guide, then
          // the company graph, the capital-flow file and the big-tech cash flows, each repainting when it lands. The
          // renderer itself is a chunk of its own, fetched the first time the section opens.
          const aiMapDefinitions = [{ key: 'research', url: RESEARCH_URL }, { key: 'registry', url: PLAYER_PRODUCT_URL }, { key: 'currentness', url: PLAYER_PRODUCT_CURRENTNESS_URL }, { key: 'taxonomyCoverage', url: TAXONOMY_COVERAGE_URL }, { key: 'relationshipGuides', url: KNOWLEDGE_RELATIONSHIP_GUIDES_URL }, { key: 'knowledgeSources', url: KNOWLEDGE_SOURCES_URL }];
          const ensureAiMap = () => {
            if (!state.aiMapView) import('../knowledge/ai-map-view.js').then((view) => { state.aiMapView = view; if (isAlive()) render(); }).catch(() => {});
            if (!state.companyGraph && !state.companyGraphPending) {
              state.companyGraphPending = true;
              loadArtifact(root, COMPANY_GRAPH_ID, { signal: scope?.signal })
                .then((graph) => { state.companyGraph = graph; state.companyGraphError = false; })
                .catch((error) => { if (error?.name !== 'AbortError') state.companyGraphError = true; })
                .finally(() => { state.companyGraphPending = false; if (isAlive()) render(); });
            }
            if (!state.capitalFlowsLoaded) {
              state.capitalFlowsLoaded = true;
              loadArtifactUrl(root, CAPITAL_FLOWS_URL, { signal: scope?.signal })
                .then((flows) => { state.capitalFlows = flows; })
                .catch(() => { state.capitalFlows = null; })
                .finally(() => {
                  // An address that names the capital map opens the value chain while that map has nothing to draw.
                  if (state.aiMap.map === 'capital' && !capitalView()) { state.aiMap = { ...state.aiMap, map: AI_MAP_IDS[0], node: null }; if (state.tab === 'aimap') syncSharedState(); }
                  if (isAlive()) render();
                });
            }
            refreshSharedArtifact(root, BIGTECH_CASHFLOW).then(({ changed }) => { if (changed && isAlive()) render(); }).catch(() => {});
          };
          ensureTabCapabilities = (tab = state.tab) => {
            if (tab === 'aimap') { ensureAiMap(); return loadGroup(aiMapDefinitions); }
            return loadGroup(tab === 'taxonomy' ? taxonomyDefinitions : tab === 'relationships' ? relationshipDefinitions : tab === 'overview' ? overviewDefinitions : foundationDefinitions);
          };
          ensureSearchCapabilities = () => {
            if (!state.query) return;
            const searchBase = state.tab === 'foundations' ? foundationDefinitions : state.tab === 'taxonomy' ? taxonomyDefinitions : state.tab === 'relationships' ? relationshipDefinitions : overviewDefinitions;
            loadGroup(searchBase);
          };
          ensureFoundationDetailCapabilities = () => loadGroup([{ key: 'routeTargets', url: ROUTE_TARGETS_URL }]);
          // A failed section load ends in a stated failure; retry clears the failed keys and reloads that section.
          retryCapabilities = (tab = state.tab) => {
            const definitions = tab === 'taxonomy' ? taxonomyDefinitions : tab === 'relationships' ? relationshipDefinitions : tab === 'aimap' ? aiMapDefinitions : foundationDefinitions;
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
              const article = await loadArtifactUrl(root, artifactFamilyUrl('knowledge-article', 'atlas-foundations', moduleId), { signal: scope?.signal, force: retryAfterFailure });
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
