// v57.60: the 테마 AI-infrastructure reference lens, moved out of src/ui/pages/themes.js unchanged
// (self-contained: it reads only the inference-efficiency reference data and the quote proxies).
import {
  AI_INFERENCE_EFFICIENCY_REFERENCE,
  AI_INFERENCE_ARCHITECTURE_REFERENCE,
  AI_INFRASTRUCTURE_REFERENCE_LENSES,
  AI_HARDWARE_SUPPLY_CHAIN_REFERENCE,
  AI_DEAL_ECOSYSTEM_EDGES,
  AI_DEAL_ECOSYSTEM_NODES,
  selectAiInferenceProxies
} from '../../domain/ai/inference-efficiency.js';

export function renderAiInfrastructureLens({ documentRef, root, route }) {
  if (route !== 'themes') return;
  const host = documentRef?.getElementById('ai-infra-efficiency-lens');
  if (!host) return;
  const proxies = selectAiInferenceProxies(root?._liveData || {});
  host.replaceChildren();
  host.dataset.aioAiInfrastructureRenderer = 'native';
  host.setAttribute('data-source-kind', AI_INFERENCE_EFFICIENCY_REFERENCE.sourceKind);
  host.setAttribute('data-operational-use', AI_INFERENCE_EFFICIENCY_REFERENCE.operationalUse);

  const header = documentRef.createElement('div');
  header.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px;';
  const title = documentRef.createElement('div');
  title.textContent = 'AI 추론 효율 · 메모리 벽 × 특화도';
  title.style.cssText = 'font-family:var(--font-display);font-size:16px;font-weight:600;color:var(--text-primary);';
  const badge = documentRef.createElement('span');
  const liveCount = proxies.filter((item) => item.pct != null).length;
  badge.textContent = liveCount ? `참고용 · 공개 지표 ${liveCount}/${proxies.length}개 수신` : '참고용 · 지표 수신 대기';
  badge.style.cssText = 'font-size:10px;font-weight:700;color:var(--text-muted);';
  header.append(title, badge);
  host.appendChild(header);

  const intro = documentRef.createElement('div');
  intro.textContent = '다음 AI 경쟁의 단위를 단일 칩 승자가 아니라 workload stage별 비용·지연·전력으로 재정의합니다. 아래 업체·구조·거래선은 자료에서 추출한 연구 지도이며 현재 매출·밸류에이션·성능 순위가 아닙니다.';
  intro.style.cssText = 'font-size:12px;line-height:1.7;color:var(--text-secondary);margin-bottom:12px;';
  host.appendChild(intro);

  const architectureTitle = documentRef.createElement('div');
  architectureTitle.textContent = 'Jalapeño / AI 추론 시스템 아키텍처 · REFERENCE';
  architectureTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin:4px 0 6px;';
  host.appendChild(architectureTitle);
  const architectureGrid = documentRef.createElement('div');
  architectureGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:7px;margin-bottom:8px;';
  AI_INFERENCE_ARCHITECTURE_REFERENCE.layers.forEach((layer) => {
    const card = documentRef.createElement('div');
    card.style.cssText = 'min-height:78px;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:4px;padding:8px;';
    const label = documentRef.createElement('div');
    label.textContent = layer.label;
    label.style.cssText = 'font-size:10px;font-weight:800;color:var(--text-primary);margin-bottom:4px;';
    const focus = documentRef.createElement('div');
    focus.textContent = layer.focus;
    focus.style.cssText = 'font-size:10px;line-height:1.55;color:var(--text-muted);';
    card.append(label, focus);
    card.setAttribute('data-source-kind', 'REFERENCE');
    card.setAttribute('data-operational-use', 'reference-only');
    architectureGrid.appendChild(card);
  });
  host.appendChild(architectureGrid);
  const architectureMeta = documentRef.createElement('div');
  architectureMeta.textContent = `목표: ${AI_INFERENCE_ARCHITECTURE_REFERENCE.objective} · 시계열: ${AI_INFERENCE_ARCHITECTURE_REFERENCE.timeSeriesChecks.map((item) => `${item.window}=${item.metrics}`).join(' | ')}`;
  architectureMeta.style.cssText = 'font-size:10px;line-height:1.6;color:var(--data-cyan);border-bottom:1px solid var(--border-subtle);padding-bottom:10px;margin-bottom:12px;';
  architectureMeta.setAttribute('data-source-kind', 'REFERENCE');
  architectureMeta.setAttribute('data-operational-use', 'reference-only');
  host.appendChild(architectureMeta);

  const topGrid = documentRef.createElement('div');
  topGrid.style.cssText = 'display:grid;grid-template-columns:1.1fr 1fr;gap:14px;margin-bottom:14px;';
  const axes = documentRef.createElement('div');
  const axesTitle = documentRef.createElement('div');
  axesTitle.textContent = '구조 축';
  axesTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;';
  axes.appendChild(axesTitle);
  AI_INFERENCE_EFFICIENCY_REFERENCE.axes.forEach((axis) => {
    const row = documentRef.createElement('div');
    row.style.cssText = 'border:1px solid var(--border-subtle);border-radius:4px;background:var(--bg-card);padding:8px;margin-bottom:6px;';
    const label = documentRef.createElement('div');
    label.textContent = axis.label;
    label.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-primary);margin-bottom:4px;';
    const range = documentRef.createElement('div');
    range.textContent = `${axis.low}  ←  ${axis.high}`;
    range.style.cssText = 'font-size:10px;font-family:var(--font-mono);color:var(--data-cyan);';
    const question = documentRef.createElement('div');
    question.textContent = axis.question;
    question.style.cssText = 'font-size:10px;line-height:1.5;color:var(--text-muted);margin-top:4px;';
    row.append(label, range, question);
    axes.appendChild(row);
  });
  const workloads = documentRef.createElement('div');
  const workloadsTitle = documentRef.createElement('div');
  workloadsTitle.textContent = 'workload fit';
  workloadsTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;';
  workloads.appendChild(workloadsTitle);
  AI_INFERENCE_EFFICIENCY_REFERENCE.workloads.forEach((workload) => {
    const row = documentRef.createElement('div');
    row.style.cssText = 'border-bottom:1px solid var(--border-subtle);padding:7px 0;';
    const label = documentRef.createElement('div');
    label.textContent = `${workload.label} · ${workload.metric}`;
    label.style.cssText = 'font-size:11px;font-weight:700;color:var(--text-primary);';
    const fit = documentRef.createElement('div');
    fit.textContent = workload.fit;
    fit.style.cssText = 'font-size:10px;line-height:1.5;color:var(--text-muted);margin-top:3px;';
    row.append(label, fit);
    workloads.appendChild(row);
  });
  topGrid.append(axes, workloads);
  host.appendChild(topGrid);

  const entityTitle = documentRef.createElement('div');
  entityTitle.textContent = '추론 하드웨어 reference map';
  entityTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;';
  host.appendChild(entityTitle);
  const entities = documentRef.createElement('div');
  entities.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;margin-bottom:14px;';
  AI_INFERENCE_EFFICIENCY_REFERENCE.entities.forEach((entity) => {
    const card = documentRef.createElement('div');
    card.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:4px;padding:8px;';
    const name = documentRef.createElement('div');
    name.textContent = entity.label;
    name.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-primary);';
    const detail = documentRef.createElement('div');
    detail.textContent = `${entity.memory} · ${entity.specialization}`;
    detail.style.cssText = 'font-size:10px;line-height:1.5;color:var(--data-cyan);margin-top:4px;';
    const fit = documentRef.createElement('div');
    fit.textContent = `${entity.fit} · ${entity.status}`;
    fit.style.cssText = 'font-size:10px;line-height:1.5;color:var(--text-muted);margin-top:3px;';
    card.append(name, detail, fit);
    card.setAttribute('data-source-kind', 'REFERENCE');
    card.setAttribute('data-operational-use', 'reference-only');
    entities.appendChild(card);
  });
  host.appendChild(entities);

  const proxyTitle = documentRef.createElement('div');
  proxyTitle.textContent = '현재 시장 프록시 (구조 노출의 참고값, 판단 근거 아님)';
  proxyTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;';
  host.appendChild(proxyTitle);
  const proxyRow = documentRef.createElement('div');
  proxyRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;';
  proxies.forEach((item) => {
    const chip = documentRef.createElement('span');
    chip.textContent = item.pct == null ? item.symbol : `${item.symbol} ${item.pct >= 0 ? '+' : ''}${item.pct.toFixed(2)}%`;
    chip.style.cssText = 'font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);background:var(--surface-1);border:1px solid var(--border-subtle);border-radius:3px;padding:4px 7px;';
    chip.setAttribute('data-source-kind', item.sourceKind);
    chip.setAttribute('data-operational-use', item.pct == null ? 'blocked' : 'reference-only');
    chip.title = item.pct == null ? `${item.label} 현재 시세 미수신` : `${item.label} 등락률은 구조적 승자 판정이 아님`;
    proxyRow.appendChild(chip);
  });
  host.appendChild(proxyRow);

  const mapTitle = documentRef.createElement('div');
  mapTitle.textContent = 'AI 거래의 순환 구조 · Bloomberg 도식의 역할/엣지 해석';
  mapTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:6px;';
  host.appendChild(mapTitle);
  const map = documentRef.createElement('div');
  map.style.cssText = 'display:grid;grid-template-columns:1.05fr 1fr;gap:14px;margin-bottom:10px;';
  const nodes = documentRef.createElement('div');
  nodes.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;align-content:flex-start;';
  AI_DEAL_ECOSYSTEM_NODES.forEach((node) => {
    const chip = documentRef.createElement('span');
    chip.textContent = node.label;
    chip.title = node.role;
    chip.style.cssText = 'font-size:10px;color:var(--text-secondary);background:var(--surface-1);border:1px solid var(--border-subtle);border-radius:3px;padding:3px 5px;';
    chip.setAttribute('data-source-kind', 'REFERENCE');
    chip.setAttribute('data-operational-use', 'reference-only');
    nodes.appendChild(chip);
  });
  const edges = documentRef.createElement('div');
  AI_DEAL_ECOSYSTEM_EDGES.forEach((edge) => {
    const row = documentRef.createElement('div');
    row.textContent = `${edge.kind.toUpperCase()} · ${edge.label}`;
    row.style.cssText = 'font-size:10px;line-height:1.6;color:var(--text-muted);border-bottom:1px solid var(--border-subtle);padding:3px 0;';
    row.setAttribute('data-source-kind', 'REFERENCE');
    row.setAttribute('data-operational-use', 'reference-only');
    edges.appendChild(row);
  });
  map.append(nodes, edges);
  host.appendChild(map);

  const lensTitle = documentRef.createElement('div');
  lensTitle.textContent = '추가 검증 렌즈 · 자료 통합 (REFERENCE)';
  lensTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin:4px 0 6px;';
  host.appendChild(lensTitle);
  const lensGrid = documentRef.createElement('div');
  lensGrid.style.cssText = 'display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-bottom:10px;';
  AI_INFRASTRUCTURE_REFERENCE_LENSES.forEach((lens) => {
    const card = documentRef.createElement('div');
    card.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:4px;padding:8px;';
    const label = documentRef.createElement('div');
    label.textContent = lens.label;
    label.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-primary);margin-bottom:4px;';
    const thesis = documentRef.createElement('div');
    thesis.textContent = lens.thesis;
    thesis.style.cssText = 'font-size:10px;line-height:1.55;color:var(--text-secondary);';
    const observe = documentRef.createElement('div');
    observe.textContent = `관측: ${lens.observe}`;
    observe.style.cssText = 'font-size:10px;line-height:1.5;color:var(--data-cyan);margin-top:4px;';
    const invalidation = documentRef.createElement('div');
    invalidation.textContent = `무효화: ${lens.invalidation}`;
    invalidation.style.cssText = 'font-size:10px;line-height:1.5;color:var(--text-muted);margin-top:3px;';
    card.append(label, thesis, observe, invalidation);
    card.setAttribute('data-source-kind', 'REFERENCE');
    card.setAttribute('data-operational-use', 'reference-only');
    lensGrid.appendChild(card);
  });
  host.appendChild(lensGrid);

  const supplyTitle = documentRef.createElement('div');
  supplyTitle.textContent = '가속기 밸류체인 역할 map · 첨부 표 해석';
  supplyTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin:4px 0 6px;';
  host.appendChild(supplyTitle);
  const supplyGrid = documentRef.createElement('div');
  supplyGrid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:7px;margin-bottom:10px;';
  AI_HARDWARE_SUPPLY_CHAIN_REFERENCE.forEach((item) => {
    const card = documentRef.createElement('div');
    card.style.cssText = 'background:var(--surface-1);border:1px solid var(--border-subtle);border-radius:4px;padding:7px;';
    const label = documentRef.createElement('div');
    label.textContent = item.label;
    label.style.cssText = 'font-size:10px;font-weight:800;color:var(--text-primary);';
    const roles = documentRef.createElement('div');
    roles.textContent = item.roles;
    roles.style.cssText = 'font-size:10px;line-height:1.5;color:var(--data-cyan);margin-top:3px;';
    const question = documentRef.createElement('div');
    question.textContent = item.question;
    question.style.cssText = 'font-size:10px;line-height:1.5;color:var(--text-muted);margin-top:3px;';
    card.append(label, roles, question);
    card.setAttribute('data-source-kind', 'REFERENCE');
    card.setAttribute('data-operational-use', 'reference-only');
    supplyGrid.appendChild(card);
  });
  host.appendChild(supplyGrid);
  const note = documentRef.createElement('div');
  note.textContent = '도식·첨부 표의 업체명·원 크기·화살표·사양은 역할과 검증 질문을 만드는 REFERENCE입니다. 현재 시가총액·계약·투자금액·공급사 매출·성능 순위를 의미하지 않으며, qualification·공시·현금흐름 확인 전 종목 점수에 편입하지 않습니다.';
  note.style.cssText = 'font-size:10px;line-height:1.6;color:var(--text-muted);border-top:1px solid var(--border-subtle);padding-top:8px;';
  note.setAttribute('data-source-kind', 'REFERENCE');
  note.setAttribute('data-operational-use', 'reference-only');
  host.appendChild(note);
}
