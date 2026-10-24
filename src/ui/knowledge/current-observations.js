function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function formatObservedAt(value) {
  if (!value) return '기준일 확인 필요';
  const normalized = String(value).replace('T', ' ').replace('Z', ' UTC');
  return normalized.length > 19 ? normalized.slice(0, 19) : normalized;
}

function sourceKindLabel(value) {
  const labels = {
    PUBLIC_INFORMATION_SERVICE: '공개 정보 서비스',
    OFFICIAL_PRIMARY: '공식 1차 자료',
    OFFICIAL_STATISTICS: '공식 통계',
    MARKET_DATA: '시장 데이터',
    COMPANY_IR_FORWARD_LOOKING: '회사 IR 미래 목표',
    COMPANY_IR_FORWARD_LOOKING_NON_GAAP: '회사 IR 미래 목표, 비GAAP'
  };
  return labels[value] || '출처 확인 자료';
}

function unitLabel(value) {
  const labels = {
    index: '지수',
    percent: '%',
    'percent-yoy': '% 전년동월비',
    'percent-of-revenue': '매출 대비 %',
    'approximately-percent-of-revenue': '매출 대비 약 %',
    'approximately-percent-non-gaap': '비GAAP 약 %'
  };
  return labels[value] || value || '단위 미상';
}

function observationDateLabel(observation) {
  const observedAt = formatObservedAt(observation?.observedAt);
  const eventDate = formatObservedAt(observation?.eventDate);
  if (observation?.eventDate && eventDate !== observedAt) return `기준 ${eventDate}, 확인 ${observedAt}`;
  if (String(observation?.sourceKind || '').startsWith('COMPANY_IR_FORWARD_LOOKING')) return `회사 발표 확인 ${observedAt}`;
  return `관측 ${observedAt}`;
}


function currentObservationMatches(observation, page, context = {}) {
  if (!observation || !Array.isArray(observation.pageTargets) || !observation.pageTargets.includes(page)) return false;
  const requestedIds = [
    ...(Array.isArray(context.nodeIds) ? context.nodeIds : []),
    context.nodeId,
    context.lessonId
  ].filter(Boolean);
  if (!requestedIds.length) return !observation.nodeIds?.length;
  if (!observation.nodeIds?.length) return false;
  return requestedIds.some((id) => observation.nodeIds.includes(id));
}

// P1636: the research pages showed the 2026-08 snapshot (S&P 500 7,785, June CPI) two months later
// while the same site already held newer closes and releases. Rows whose value the site refreshes
// automatically are replaced at render from the current history/macro; dated company-IR targets and
// FOMC projections stay as dated references.
const LIVE_ROWS = [
  [/^market-spx-/, 'spx', 'S&P 500 종가'],
  [/^market-vix-/, 'vix', 'VIX 종가']
];

function latestClose(history, field) {
  const rows = (Array.isArray(history) ? history : []).filter((row) => typeof row?.[field] === 'number' && row[field] > 0 && row.fieldMeta?.[field]?.observationRelation !== 'carried-forward');
  const row = rows.sort((a, b) => String(a.date).localeCompare(String(b.date))).at(-1);
  return row ? { value: row[field], date: String(row.fieldMeta?.[field]?.observedAt || row.date).slice(0, 10) } : null;
}

export function liveCurrentObservations(artifact, root) {
  if (!artifact || !Array.isArray(artifact.observations) || !root) return artifact;
  const snapshot = root.DATA_SNAPSHOT || {};
  const ts = snapshot._fieldTs || {};
  const finite = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;
  // E13: a replaced value takes its own lineage — the old dated source/URL must not stay beside a new number.
  const SOURCES = {
    MARKET_DATA: { source: '사이트 종가 기록(지수 일봉 확정 종가)', sourceId: 'aio-history-close', sourceUrl: null },
    FED: { source: '연방준비제도 FOMC 정책금리 목표 범위', sourceId: 'fed-fomc-target-range', sourceUrl: 'https://www.federalreserve.gov/monetarypolicy/openmarket.htm' },
    BLS: { source: '미 노동통계국(BLS) 소비자물가지수', sourceId: 'bls-cpi', sourceUrl: 'https://www.bls.gov/cpi/' }
  };
  const live = (row, value, observedAt, displayValue, sourceKind = 'MARKET_DATA', lineage = SOURCES.MARKET_DATA) => value == null || !observedAt ? row : { ...row, ...lineage, value, displayValue, observedAt, eventDate: null, sourceKind, allowedUse: 'current-context', live: true };
  const observations = artifact.observations.map((row) => {
    for (const [pattern, field] of LIVE_ROWS) {
      if (!pattern.test(row.id)) continue;
      const close = latestClose(root._aioHistory, field);
      return close ? live(row, close.value, close.date, close.value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : row;
    }
    if (/^fed-funds-midpoint-/.test(row.id)) {
      const lower = finite(snapshot.fedTargetLower), upper = finite(snapshot.fedTargetUpper);
      return lower != null && upper != null ? live(row, (lower + upper) / 2, ts.macro_fedTargetLower || null, `${((lower + upper) / 2).toFixed(3)}%`, 'OFFICIAL_STATISTICS', SOURCES.FED) : row;
    }
    if (/^bls-cpi-/.test(row.id)) return live(row, finite(snapshot.cpi), ts.macro_cpi ? `${ts.macro_cpi.slice(0, 7)} 기준월` : null, finite(snapshot.cpi) == null ? null : `${snapshot.cpi}% YoY`, 'OFFICIAL_STATISTICS', SOURCES.BLS);
    if (/^bls-core-cpi-/.test(row.id)) return live(row, finite(snapshot.coreCpi), ts.macro_coreCpi ? `${ts.macro_coreCpi.slice(0, 7)} 기준월` : null, finite(snapshot.coreCpi) == null ? null : `${snapshot.coreCpi}% YoY`, 'OFFICIAL_STATISTICS', SOURCES.BLS);
    return row;
  });
  return { ...artifact, observations };
}

export function createCurrentObservationBlock(documentRef, rawArtifact, { page, nodeIds = [], nodeId = '', lessonId = '', title = '실제 관측값' } = {}) {
  const artifact = liveCurrentObservations(rawArtifact, documentRef?.defaultView || null);
  const observations = (artifact?.observations || []).filter((item) => currentObservationMatches(item, page, { nodeIds, nodeId, lessonId }));
  const block = element(documentRef, 'section', 'knowledge-current-observations');
  const validArtifact = validateCurrentObservationsArtifact(artifact);
  block.dataset.knowledgeCurrentObservations = validArtifact ? 'connected' : 'invalid';
  block.dataset.knowledgeCurrentObservationCount = String(observations.length);
  block.append(
    element(documentRef, 'div', 'knowledge-current-observations-eyebrow', '기준일이 있는 참고 관측값'),
    element(documentRef, 'h4', 'knowledge-current-observations-title', title),
    element(documentRef, 'p', 'knowledge-current-observations-boundary', observations.length
      ? '선택한 개념에 직접 연결된 관측값을 기준일과 함께 보여 줍니다.'
      : '이 개념에 직접 연결된 관측값은 아직 없습니다. 전체 시장 수치로 확대 해석하지 말고, 연결 그래프와 원문 출처를 따라가세요.')
  );
  const grid = element(documentRef, 'div', 'knowledge-current-observations-grid');
  observations.forEach((observation) => {
    const card = element(documentRef, 'article', 'knowledge-current-observation-card');
    card.dataset.knowledgeObservationId = observation.id;
    card.dataset.knowledgeObservationSourceKind = observation.sourceKind || '';
    card.dataset.knowledgeObservationAllowedUse = observation.allowedUse || '';
    const value = element(documentRef, 'strong', 'knowledge-current-observation-value', observation.displayValue ?? String(observation.value ?? '—'));
    const meta = element(documentRef, 'div', 'knowledge-current-observation-meta', `${observation.label}, ${unitLabel(observation.unit)}`);
    const dateLabel = observation.live ? `자동 갱신, 관측 ${observation.observedAt}` : observationDateLabel(observation);
    const provenance = element(documentRef, 'p', 'knowledge-current-observation-provenance', `${sourceKindLabel(observation.sourceKind)}, ${dateLabel}` /* v57.84: usage chips (참고용 / 학습 참고 …) dropped; the date stays */);
    const source = element(documentRef, 'a', 'knowledge-current-observation-source', observation.source || observation.sourceId || '출처 보기');
    applySafeExternalLink(source, observation.sourceUrl);
    source.title = `${observation.source || '원문 출처'}, ${dateLabel}`;
    card.append(value, meta, provenance, source);
    grid.appendChild(card);
  });
  if (!observations.length) grid.appendChild(element(documentRef, 'p', 'knowledge-current-observations-empty', '이 개념에 직접 연결된 관측값이 아직 없습니다. 구조적 설명과 출처 원장을 먼저 확인하세요.'));
  block.appendChild(grid);
  return block;
}

export function validateCurrentObservationsArtifact(artifact) {
  const rows = Array.isArray(artifact?.observations) ? artifact.observations : [];
  return Boolean(artifact && Array.isArray(artifact.observations)) && rows.every((row) => row.id && row.label && row.displayValue != null && row.unit && row.observedAt && row.sourceId && row.sourceKind && row.allowedUse && Array.isArray(row.pageTargets) && row.pageTargets.length);
}
import { applySafeExternalLink } from './safe-external-link.js';
