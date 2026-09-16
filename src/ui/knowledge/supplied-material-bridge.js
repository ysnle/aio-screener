import { SUPPLIED_MATERIALS_REFERENCE } from '../../domain/research/supplied-materials.js';

function element(documentRef, tag, className, text = '') {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text !== '') node.textContent = text;
  return node;
}

function unique(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => String(value || '').trim()).filter(Boolean))];
}

/**
 * Supplied third-party research is consumed by the internal knowledge/protocol
 * layer. It is deliberately NOT a user-facing research page or a raw-link index,
 * so this bridge exposes scope metadata only and never renders the source audit,
 * media audit, time-series alignment, claim ledger or X-link catalog (P1077).
 *
 * The 2026-08/09 renderers that drew those panels were unreachable code: nothing
 * called them, and the mount is hidden by design. Keeping them let
 * `ci-research-flow-contract-check.mjs` assert that the bridge *renders* the audit
 * and claim ledger while the same gate asserted it renders nothing visible, and
 * no user-visible provenance ever reached a page.
 */
export function createSuppliedMaterialBridge(documentRef, { routeId = '', sectionIds = null, timeSeriesIds = null, heading = '' } = {}) {
  const mapping = SUPPLIED_MATERIALS_REFERENCE.routeMappings?.[routeId] || {};
  const resolvedSectionIds = unique(sectionIds == null ? mapping.sectionIds : sectionIds);
  const resolvedTimeSeriesIds = unique(timeSeriesIds == null ? mapping.timeSeriesIds : timeSeriesIds);
  const section = element(documentRef, 'aside', 'aio-integrated-analysis-context');
  section.hidden = true;
  section.setAttribute('aria-hidden', 'true');
  section.dataset.sourceKind = SUPPLIED_MATERIALS_REFERENCE.sourceKind;
  section.dataset.operationalUse = SUPPLIED_MATERIALS_REFERENCE.operationalUse;
  section.dataset.referenceId = SUPPLIED_MATERIALS_REFERENCE.id;
  section.dataset.integrationMode = 'internal-protocol-only';
  section.dataset.referenceFrameworkCount = String(mapping.nathanFrameworkIds?.length || 0);
  section.dataset.referenceSectionCount = String(resolvedSectionIds.length);
  section.dataset.referenceTimeSeriesCount = String(resolvedTimeSeriesIds.length);
  section.dataset.processingBoundary = 'current-observation-separated-from-structural-reference';
  if (routeId) section.dataset.aioSuppliedMaterialRoute = routeId;
  if (resolvedTimeSeriesIds.length) section.dataset.aioSuppliedMaterialTimeseries = resolvedTimeSeriesIds.join(',');
  section.textContent = `${heading || '구조 분석 프로토콜'}: 현재 데이터·구조적 참고·추론·행동 경계를 분리합니다.`;
  return section;
}
