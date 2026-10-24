// v57.60: the 테마 AI-infrastructure reference lens, moved out of src/ui/pages/themes.js unchanged
// (self-contained: it reads only the inference-efficiency reference data and the quote proxies).
// 2026-10-19 layout system: styling lives in src/ui/styles/reference-lens.css (it was 48 inline cssText strings at
// 10-11px that a substring !important rule in index.html raised to 12px, and fixed 4- and 2-column grids on phones).
import {
  AI_INFERENCE_EFFICIENCY_REFERENCE,
  AI_INFERENCE_ARCHITECTURE_REFERENCE,
  AI_INFRASTRUCTURE_REFERENCE_LENSES,
  AI_HARDWARE_SUPPLY_CHAIN_REFERENCE,
  AI_DEAL_ECOSYSTEM_EDGES,
  AI_DEAL_ECOSYSTEM_NODES,
  selectAiInferenceProxies
} from '../../domain/ai/inference-efficiency.js';
import { el } from './dom.js';

export function renderAiInfrastructureLens({ documentRef, root, route }) {
  if (route !== 'themes') return;
  const host = documentRef?.getElementById('ai-infra-efficiency-lens');
  if (!host) return;
  const doc = documentRef;
  const proxies = selectAiInferenceProxies(root?._liveData || {});
  host.replaceChildren();
  host.classList.add('ail');
  host.dataset.aioAiInfrastructureRenderer = 'native';
  host.setAttribute('data-source-kind', AI_INFERENCE_EFFICIENCY_REFERENCE.sourceKind);
  host.setAttribute('data-operational-use', AI_INFERENCE_EFFICIENCY_REFERENCE.operationalUse);
  const reference = (node, use = 'reference-only', kind = 'REFERENCE') => {
    node.setAttribute('data-source-kind', kind);
    node.setAttribute('data-operational-use', use);
    return node;
  };
  const card = (className, parts) => { const node = el(doc, 'div', null, className); node.append(...parts); return node; };
  const section = (text) => el(doc, 'div', text, 'ail-section');

  const header = el(doc, 'div', null, 'ail-head');
  const liveCount = proxies.filter((item) => item.pct != null).length;
  header.append(el(doc, 'div', 'AI 추론 효율, 메모리 벽 × 특화도', 'ail-title'),
    el(doc, 'span', liveCount ? `공개 지표 ${liveCount}/${proxies.length}개 수신` : '지표 수신 대기', 'ail-badge'));
  host.append(header, el(doc, 'div', '다음 AI 경쟁의 단위를 단일 칩 승자가 아니라 workload stage별 비용·지연·전력으로 재정의합니다. 아래 업체·구조·거래선은 자료에서 추출한 연구 지도이며 현재 매출·밸류에이션·성능 순위가 아닙니다.', 'ail-intro'));

  const architectureGrid = el(doc, 'div', null, 'ail-grid');
  AI_INFERENCE_ARCHITECTURE_REFERENCE.layers.forEach((layer) => {
    architectureGrid.append(reference(card('ail-card ail-card--tall', [el(doc, 'div', layer.label, 'ail-card-title'), el(doc, 'div', layer.focus, 'ail-text')])));
  });
  host.append(section('Jalapeño / AI 추론 시스템 아키텍처, REFERENCE'), architectureGrid,
    reference(el(doc, 'div', `목표: ${AI_INFERENCE_ARCHITECTURE_REFERENCE.objective}, 시계열: ${AI_INFERENCE_ARCHITECTURE_REFERENCE.timeSeriesChecks.map((item) => `${item.window}=${item.metrics}`).join(' | ')}`, 'ail-text ail-text--ink ail-rule-below')));

  const axes = el(doc, 'div');
  axes.append(section('구조 축'));
  AI_INFERENCE_EFFICIENCY_REFERENCE.axes.forEach((axis) => {
    axes.append(card('ail-card ail-card--stack', [el(doc, 'div', axis.label, 'ail-card-title'), el(doc, 'div', `${axis.low}  ←  ${axis.high}`, 'ail-text ail-text--ink ail-text--mono'), el(doc, 'div', axis.question, 'ail-text ail-text--gap')]));
  });
  const workloads = el(doc, 'div');
  workloads.append(section('workload fit'));
  AI_INFERENCE_EFFICIENCY_REFERENCE.workloads.forEach((workload) => {
    workloads.append(card('ail-row', [el(doc, 'div', `${workload.label}, ${workload.metric}`, 'ail-row-title'), el(doc, 'div', workload.fit, 'ail-text ail-text--gap')]));
  });
  host.append(card('ail-split', [axes, workloads]));

  const entities = el(doc, 'div', null, 'ail-grid ail-grid--wide');
  AI_INFERENCE_EFFICIENCY_REFERENCE.entities.forEach((entity) => {
    entities.append(reference(card('ail-card', [el(doc, 'div', entity.label, 'ail-card-title'), el(doc, 'div', `${entity.memory}, ${entity.specialization}`, 'ail-text ail-text--ink ail-text--gap'), el(doc, 'div', `${entity.fit}, ${entity.status}`, 'ail-text ail-text--gap')])));
  });
  host.append(section('추론 하드웨어 reference map'), entities);

  const proxyRow = el(doc, 'div', null, 'ail-chips ail-chips--spaced');
  proxies.forEach((item) => {
    const chip = reference(el(doc, 'span', item.pct == null ? item.symbol : `${item.symbol} ${item.pct >= 0 ? '+' : ''}${item.pct.toFixed(2)}%`, 'ail-chip ail-text--mono'), item.pct == null ? 'blocked' : 'reference-only', item.sourceKind);
    chip.title = item.pct == null ? `${item.label} 현재 시세 미수신` : `${item.label} 등락률은 구조적 승자 판정이 아님`;
    proxyRow.append(chip);
  });
  host.append(section('현재 시장 프록시 (구조 노출의 참고값, 판단 근거 아님)'), proxyRow);

  const nodes = el(doc, 'div', null, 'ail-chips');
  AI_DEAL_ECOSYSTEM_NODES.forEach((node) => {
    const chip = reference(el(doc, 'span', node.label, 'ail-chip'));
    chip.title = node.role;
    nodes.append(chip);
  });
  const edges = el(doc, 'div');
  AI_DEAL_ECOSYSTEM_EDGES.forEach((edge) => edges.append(reference(el(doc, 'div', `${edge.kind.toUpperCase()}, ${edge.label}`, 'ail-text ail-edge'))));
  host.append(section('AI 거래의 순환 구조, Bloomberg 도식의 역할/엣지 해석'), card('ail-split ail-split--map', [nodes, edges]));

  const lensGrid = el(doc, 'div', null, 'ail-grid ail-grid--pair');
  AI_INFRASTRUCTURE_REFERENCE_LENSES.forEach((lens) => {
    lensGrid.append(reference(card('ail-card', [el(doc, 'div', lens.label, 'ail-card-title'), el(doc, 'div', lens.thesis, 'ail-text ail-text--body'), el(doc, 'div', `관측: ${lens.observe}`, 'ail-text ail-text--ink ail-text--gap'), el(doc, 'div', `무효화: ${lens.invalidation}`, 'ail-text ail-text--gap')])));
  });
  host.append(section('추가 검증 렌즈, 자료 통합 (REFERENCE)'), lensGrid);

  const supplyGrid = el(doc, 'div', null, 'ail-grid');
  AI_HARDWARE_SUPPLY_CHAIN_REFERENCE.forEach((item) => {
    supplyGrid.append(reference(card('ail-card ail-card--muted', [el(doc, 'div', item.label, 'ail-card-title'), el(doc, 'div', item.roles, 'ail-text ail-text--ink ail-text--gap'), el(doc, 'div', item.question, 'ail-text ail-text--gap')])));
  });
  host.append(section('가속기 밸류체인 역할 map, 첨부 표 해석'), supplyGrid,
    reference(el(doc, 'div', '도식·첨부 표의 업체명·원 크기·화살표·사양은 역할과 검증 질문을 만드는 REFERENCE입니다. 현재 시가총액·계약·투자금액·공급사 매출·성능 순위를 의미하지 않으며, qualification·공시·현금흐름 확인 전 종목 점수에 편입하지 않습니다.', 'ail-text ail-note')));
}
