import { createResourceBag } from '../../app/lifecycle.js';

const REVIEWED_AT = '2026-08-02';
const FILINGS_URL = './public-data/masters/filings.json';
const HOLDINGS_URL = './public-data/masters/holdings.json';
const SECURITY_MASTER_URL = './public-data/masters/security-master.json';
const SECURITY_MASTER_REFERENCE_URL = './public-data/masters/security-master-reference.json';
const HISTORY_INDEX_URL = './public-data/masters/history-index.json';
const HISTORY_HOLDINGS_URL = './public-data/masters/history-holdings.json';

// MF-05: holding rows are rendered only from a verified SEC EDGAR
// filer/CIK/filing artifact; the registry itself never invents rows.
const MASTER_REGISTRY = Object.freeze([
  Object.freeze({ id: 'berkshire-hathaway', name: 'Warren Buffett', filer: 'Berkshire Hathaway Inc.', style: '집중·가치·장기 보유', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'duquesne-family-office', name: 'Stanley Druckenmiller', filer: 'Duquesne Family Office LLC', style: '거시·성장·변화 대응', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'fisher-asset-management', name: 'Ken Fisher', filer: 'Fisher Asset Management, LLC', style: '글로벌·분산·대형주', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'pershing-square', name: 'Bill Ackman', filer: 'Pershing Square Capital Management, L.P.', style: '집중·행동주의', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'appaloosa-management', name: 'David Tepper', filer: 'Appaloosa LP', style: '거시·가치·전환', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'baupost-group', name: 'Seth Klarman', filer: 'Baupost Group LLC/MA', style: '가치·하방 방어', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'scion-asset-management', name: 'Michael Burry', filer: 'Scion Asset Management, LLC', style: '비대칭·헤지·이벤트', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'mark-minervini', name: 'Mark Minervini', filer: '방법론 전용 프로필', style: '모멘텀·성장·리스크 관리', type: 'METHOD_ONLY', status: 'METHOD_ONLY', sourceName: '공식 웹사이트', sourceUrl: 'https://www.minervini.com/' })
]);

const ACTION_LABELS = Object.freeze({
  NEW: '신규 편입',
  INCREASED: '증가',
  REDUCED: '감소',
  UNCHANGED: '변화 없음',
  EXITED: '전량 제외',
  UNAVAILABLE: '비교 불가'
});

const VIEW_LABELS = Object.freeze({
  changes: '핵심 변화',
  holdings: '전체 보유',
  sectors: '섹터 구성',
  quarters: '분기 추이',
  filings: '원본 공시'
});

function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function button(documentRef, className, text, action, value) {
  const node = element(documentRef, 'button', className, text);
  node.type = 'button';
  node.dataset.mastersAction = action;
  if (value != null) node.dataset.mastersValue = value;
  return node;
}

function statusLabel(status) {
  return ({
    VERIFIED_ROWS: '행 검증 완료',
    VERIFIED_METADATA: '공시 메타데이터 확인',
    CURRENT_REFERENCE: '최신 연결 기준',
    STALE_REFERENCE: '최신성 지연 참고',
    METHOD_ONLY: '방법론 전용',
    PENDING: '준비 중'
  })[status] || status || '확인 필요';
}

function sourceBadge(documentRef, manager, statusOverride = manager.status, freshnessStatus = null) {
  const wrap = element(documentRef, 'div', 'masters-source');
  const status = element(documentRef, 'span', `masters-status masters-status-${String(statusOverride).toLowerCase()}`, statusLabel(statusOverride));
  status.dataset.mastersStatus = statusOverride || '';
  const reviewed = element(documentRef, 'span', 'masters-reviewed', `검토 ${REVIEWED_AT}`);
  const link = element(documentRef, 'a', 'masters-source-link', manager.sourceName);
  link.href = manager.sourceUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  wrap.append(status, reviewed, link);
  if (freshnessStatus) wrap.appendChild(element(documentRef, 'span', `masters-freshness masters-freshness-${freshnessStatus.toLowerCase()}`, statusLabel(freshnessStatus)));
  return wrap;
}

function matches(manager, query) {
  if (!query) return true;
  return [manager.name, manager.filer, manager.style, manager.type, manager.status].join(' ').toLowerCase().includes(query);
}

function createManagerCard(documentRef, manager, selected, statusOverride = manager.status, freshnessStatus = null) {
  const card = button(documentRef, `masters-manager-card${selected ? ' is-selected' : ''}`, '', 'select-manager', manager.id);
  card.setAttribute('aria-pressed', selected ? 'true' : 'false');
  card.append(
    element(documentRef, 'strong', 'masters-manager-name', manager.name),
    element(documentRef, 'span', 'masters-manager-filer', manager.filer),
    element(documentRef, 'span', 'masters-manager-style', manager.style),
    sourceBadge(documentRef, manager, statusOverride, freshnessStatus)
  );
  return card;
}

function createMetric(documentRef, label, value) {
  const card = element(documentRef, 'div', 'masters-metric');
  card.append(element(documentRef, 'span', 'masters-metric-label', label), element(documentRef, 'strong', 'masters-metric-value', value));
  return card;
}

function formatReportedValue(value) {
  return value == null ? '—' : `$${new Intl.NumberFormat('en-US').format(value)}`;
}

function formatDelta(value, formatter = new Intl.NumberFormat('en-US')) {
  if (value == null) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatter.format(value)}`;
}

function createChangeSummary(documentRef, verification) {
  if (!verification?.priorReportPeriod) return null;
  const summary = element(documentRef, 'div', 'masters-change-summary');
  summary.appendChild(element(documentRef, 'strong', 'masters-change-summary-title', `${verification.reportPeriod} 보고 주식 수 변화 · 이전 보고분기 ${verification.priorReportPeriod}`));
  const counts = element(documentRef, 'div', 'masters-change-counts');
  ['NEW', 'INCREASED', 'REDUCED', 'UNCHANGED', 'EXITED'].forEach((action) => {
    const count = verification.comparisonActionCounts?.[action] || 0;
    counts.appendChild(element(documentRef, 'span', `masters-change-count masters-change-${action.toLowerCase()}`, `${ACTION_LABELS[action]} ${count}`));
  });
  summary.appendChild(counts);
  return summary;
}

function createAvailabilityNote(documentRef, check) {
  if (!check?.result) return null;
  const note = element(documentRef, 'section', 'masters-availability-note');
  note.appendChild(element(documentRef, 'strong', '', '최신 13F 제출 확인'));
  note.appendChild(element(documentRef, 'p', '', check.result === 'NO_LATER_13F_HR_REPORTED'
    ? `SEC 제출목록 기준 ${check.latest13fPeriod || '확인된 분기'} 이후 새 13F-HR/13F-HR/A가 없습니다. 최신 제출분을 유지하고 공백을 표시합니다.`
    : 'SEC 제출목록의 최신성 확인 결과를 표시합니다.'));
  const link = element(documentRef, 'a', 'masters-source-link', check.source || 'SEC submissions JSON');
  link.href = check.sourceUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  note.appendChild(link);
  return note;
}

function createTable(documentRef, headers, rows, rowBuilder, className = 'masters-holdings-table') {
  const table = element(documentRef, 'table', className);
  const head = element(documentRef, 'thead', '');
  const headerRow = element(documentRef, 'tr', '');
  headers.forEach((label) => headerRow.appendChild(element(documentRef, 'th', '', label)));
  head.appendChild(headerRow);
  const body = element(documentRef, 'tbody', '');
  rows.forEach((row) => body.appendChild(rowBuilder(row)));
  table.append(head, body);
  return table;
}

function createHoldingRow(documentRef, row, index, includeAction = true) {
  const tr = element(documentRef, 'tr', '');
  const formatter = new Intl.NumberFormat('en-US');
  [String(row.rank || index + 1), row.issuer || '—', row.cusipNormalized || row.cusip || '—', formatReportedValue(row.value), formatter.format(row.shares || 0), formatDelta(row.sharesDelta, formatter), formatDelta(row.valueDelta, formatter), row.putCall || '—'].forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
  if (includeAction) {
    const action = row.action || 'UNAVAILABLE';
    tr.appendChild(element(documentRef, 'td', `masters-action masters-action-${action.toLowerCase()}`, ACTION_LABELS[action] || action));
  }
  tr.title = `${row.evidenceId || 'SEC reference'} · ${row.reportPeriod || ''}`;
  return tr;
}

function createTopHoldingTable(documentRef, manager, holdingMeta, rows) {
  const section = element(documentRef, 'section', 'masters-holdings-section');
  const heading = element(documentRef, 'div', 'masters-holdings-heading');
  heading.append(
    element(documentRef, 'h4', 'masters-holdings-title', '상위 보고 보유 종목'),
    element(documentRef, 'p', 'masters-holdings-meta', `${holdingMeta?.verification?.reportPeriod || '보고분기 확인 필요'} · 상위 ${rows.length}개 · 전체 신고 행 ${holdingMeta?.verification?.fullRowCount || '—'}개`)
  );
  const table = createTable(documentRef, ['#', 'Issuer', 'CUSIP', 'Reported value', 'Shares', 'Δ shares', 'Δ value', 'Put/Call', 'Reported change'], rows, (row, index) => createHoldingRow(documentRef, row, index, true));
  table.setAttribute('aria-label', `${manager.name} reported top holdings`);
  section.append(heading, table);
  return section;
}

function createPagination(documentRef, page, pageCount, total, action = 'detail-page') {
  const wrap = element(documentRef, 'div', 'masters-pagination');
  const previous = button(documentRef, 'masters-page-button', '이전', action, 'prev');
  const next = button(documentRef, 'masters-page-button', '다음', action, 'next');
  previous.disabled = page <= 1;
  next.disabled = page >= pageCount;
  wrap.append(previous, element(documentRef, 'span', 'masters-page-status', `${page} / ${pageCount} · ${total}개`), next);
  return wrap;
}

function createChangeLedger(documentRef, comparisonRows, state) {
  const section = element(documentRef, 'section', 'masters-holdings-section masters-change-ledger');
  section.appendChild(element(documentRef, 'h4', 'masters-holdings-title', '분기 변화 원장'));
  section.appendChild(element(documentRef, 'p', 'masters-holdings-meta', '보고된 주식 수 기준입니다. 현재 가격, 매매 신호, 목표가는 계산하지 않습니다.'));
  const filters = element(documentRef, 'div', 'masters-action-filters');
  ['ALL', 'NEW', 'INCREASED', 'REDUCED', 'UNCHANGED', 'EXITED'].forEach((action) => {
    const label = action === 'ALL' ? '전체' : ACTION_LABELS[action];
    const filterButton = button(documentRef, `masters-action-filter${state.actionFilter === action ? ' is-active' : ''}`, label, 'change-filter', action);
    filterButton.setAttribute('aria-pressed', state.actionFilter === action ? 'true' : 'false');
    filters.appendChild(filterButton);
  });
  const filtered = state.actionFilter === 'ALL' ? comparisonRows : comparisonRows.filter((row) => row.action === state.actionFilter);
  const pageCount = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = filtered.slice(start, start + state.pageSize);
  const table = createTable(documentRef, ['#', 'Issuer', 'CUSIP', 'Current value', 'Current shares', 'Δ shares', 'Δ value', 'Action'], pageRows, (row, index) => {
    const tr = element(documentRef, 'tr', '');
    const formatter = new Intl.NumberFormat('en-US');
    [String(start + index + 1), row.issuer || '—', row.cusipNormalized || row.cusip || '—', formatReportedValue(row.value), formatter.format(row.shares || 0), formatDelta(row.sharesDelta, formatter), formatDelta(row.valueDelta, formatter)].forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
    tr.appendChild(element(documentRef, 'td', `masters-action masters-action-${String(row.action || 'UNAVAILABLE').toLowerCase()}`, ACTION_LABELS[row.action] || row.action || '—'));
    tr.title = `${row.evidenceId || 'SEC comparison'} · ${row.priorReportPeriod || ''}`;
    return tr;
  }, 'masters-comparison-table masters-holdings-table');
  section.append(filters, table, createPagination(documentRef, state.page, pageCount, filtered.length));
  return section;
}

function createFullHoldingsView(documentRef, fullRows, state) {
  const section = element(documentRef, 'section', 'masters-holdings-section');
  const heading = element(documentRef, 'div', 'masters-holdings-heading');
  heading.append(element(documentRef, 'h4', 'masters-holdings-title', '전체 신고 보유 행'), element(documentRef, 'p', 'masters-holdings-meta', 'SEC 정보표의 원문 행 · 페이지당 25개'));
  const controls = element(documentRef, 'div', 'masters-holdings-controls');
  const search = element(documentRef, 'input', 'masters-holdings-search');
  search.type = 'search';
  search.placeholder = '발행사·CUSIP 검색';
  search.value = state.holdingsQuery;
  search.setAttribute('aria-label', '전체 보유 검색');
  search.dataset.mastersAction = 'holdings-search';
  controls.appendChild(search);
  const filtered = fullRows.filter((row) => !state.holdingsQuery || [row.issuer, row.cusipNormalized, row.titleOfClass].join(' ').toLowerCase().includes(state.holdingsQuery));
  const pageCount = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = filtered.slice(start, start + state.pageSize);
  const table = createTable(documentRef, ['#', 'Issuer', 'CUSIP', 'Reported value', 'Shares', 'Δ shares', 'Δ value', 'Put/Call', 'Comparison'], pageRows, (row, index) => createHoldingRow(documentRef, row, start + index, true), 'masters-full-holdings-table masters-holdings-table');
  section.append(heading, controls, table, createPagination(documentRef, state.page, pageCount, filtered.length));
  return section;
}

function createSectorView(documentRef, fullRows = [], securityMaster = null) {
  const empty = element(documentRef, 'section', 'masters-empty-state masters-sector-unavailable');
  empty.dataset.mastersSectorState = 'unavailable';
  empty.dataset.mastersSecurityMaster = securityMaster?.status || 'NOT_CONNECTED';
  const cusips = new Set(fullRows.map((row) => row.cusipNormalized || row.cusip).filter(Boolean));
  const issuers = new Set(fullRows.map((row) => row.issuer).filter(Boolean));
  const mappedRows = fullRows.filter((row) => row.ticker && row.sector);
  const metrics = element(documentRef, 'div', 'masters-normalization-metrics');
  [
    ['현재 SEC 행', fullRows.length.toLocaleString('en-US')],
    ['고유 CUSIP', cusips.size.toLocaleString('en-US')],
    ['고유 신고 발행사명', issuers.size.toLocaleString('en-US')],
    ['검증 ticker·sector 연결', mappedRows.length.toLocaleString('en-US')],
    ['security master artifact', securityMaster ? `${securityMaster.status} · ${securityMaster.coverage?.recordsPublished ?? 0} records` : 'NOT_CONNECTED']
  ].forEach(([label, value]) => metrics.appendChild(createMetric(documentRef, label, value)));
  empty.append(
    element(documentRef, 'strong', '', '섹터 구성은 아직 공개하지 않습니다.'),
    element(documentRef, 'p', '', `SEC CUSIP 행은 연결되어 있지만 검증된 issuer·ticker·sector master 기록은 ${securityMaster?.coverage?.recordsPublished ?? 0}개입니다. 현재 상태 ${securityMaster?.status || 'NOT_CONNECTED'}에서는 임의의 섹터와 포트폴리오 비중을 표시하지 않습니다.`),
    metrics,
    element(documentRef, 'p', 'masters-holdings-meta', '정규화 대기 원장: CUSIP·share class·put/call·법인행동을 issuer master와 대조한 뒤에만 섹터 비중을 계산합니다. 13F 보고가 없는 자산은 이 화면에 포함하지 않습니다.')
  );
  return empty;
}

function createReferenceSectorView(documentRef, fullRows = [], referenceMaster = null) {
  const referenceByCusip = new Map((referenceMaster?.records || []).map((record) => [record.cusipNormalized, record]));
  const mappedRows = fullRows.map((row) => ({ ...row, ...(referenceByCusip.get(row.cusipNormalized || row.cusip) || {}) })).filter((row) => row.tickerReference && row.sectorReference);
  if (!mappedRows.length) return null;
  const totalValue = mappedRows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
  const sectorTotals = new Map();
  mappedRows.forEach((row) => {
    const current = sectorTotals.get(row.sectorReference) || { rows: 0, value: 0 };
    current.rows += 1;
    current.value += Number(row.value) || 0;
    sectorTotals.set(row.sectorReference, current);
  });
  const section = element(documentRef, 'section', 'masters-holdings-section masters-reference-sector-view');
  section.append(
    element(documentRef, 'h4', 'masters-holdings-title', '참고용 섹터 분류 · 표시된 매핑행 기준'),
    element(documentRef, 'p', 'masters-holdings-meta', `${mappedRows.length}개 참고 매핑행 · 보고가치 합계 ${formatReportedValue(totalValue)} · 검증된 sector master가 아니며 포트폴리오 비중·추천으로 사용하지 않습니다.`)
  );
  const rows = [...sectorTotals.entries()].sort((a, b) => b[1].value - a[1].value).map(([sector, values]) => ({ sector, ...values }));
  section.appendChild(createTable(documentRef, ['참고 sector', '행 수', '보고가치', '매핑행 내 참고비중'], rows, (row) => {
    const tr = element(documentRef, 'tr', '');
    [row.sector, String(row.rows), formatReportedValue(row.value), totalValue ? `${((row.value / totalValue) * 100).toFixed(1)}%` : '—'].forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
    return tr;
  }, 'masters-sector-reference-table masters-holdings-table'));
  section.appendChild(element(documentRef, 'p', 'masters-holdings-meta', `참고 매핑 상태 ${referenceMaster.status} · 기준일 ${referenceMaster.reviewedAt} · SEC CUSIP·issuer 원문과 공개 issuer identifier cross-reference를 결합한 교육용 분류입니다.`));
  return section;
}

function createQuarterView(documentRef, holdingMeta, historyManager, historyRowsArtifact) {
  const verification = holdingMeta?.verification;
  const section = element(documentRef, 'section', 'masters-holdings-section');
  section.appendChild(element(documentRef, 'h4', 'masters-holdings-title', '분기 보고 추이'));
  section.appendChild(element(documentRef, 'p', 'masters-holdings-meta', `SEC filing history · 목표 ${historyManager?.historyDepthTarget || 12}개 분기 · SEC 정보표 원문 행이 연결된 기간의 shares/value를 계산합니다. ticker·sector·corporate action은 포함하지 않습니다.`));
  const importedRows = [
    { period: verification?.priorReportPeriod, count: verification?.priorFullRowCount, value: verification?.priorParsedValueTotal, reconciliation: verification?.priorCountReconciled },
    { period: verification?.reportPeriod, count: verification?.fullRowCount, value: verification?.parsedValueTotal, reconciliation: verification?.countReconciled }
  ].filter((row) => row.period);
  const importedByPeriod = new Map(importedRows.map((row) => [row.period, row]));
  const historicalByPeriod = new Map();
  (historyRowsArtifact?.rows || []).filter((row) => row.managerId === historyManager?.managerId).forEach((row) => {
    const current = historicalByPeriod.get(row.reportPeriod) || { count: 0, value: 0, shares: 0 };
    current.count += 1;
    current.value += Number(row.value) || 0;
    current.shares += Number(row.shares) || 0;
    historicalByPeriod.set(row.reportPeriod, current);
  });
  const rows = (historyManager?.periods || importedRows.map((row) => ({ periodOfReport: row.period }))).map((period) => {
    const imported = importedByPeriod.get(period.periodOfReport);
    const historical = historicalByPeriod.get(period.periodOfReport);
    return { period: period.periodOfReport, count: imported?.count ?? period.rowCount ?? historical?.count ?? '—', value: imported?.value ?? period.reportedValueTotal ?? historical?.value ?? null, reconciliation: imported?.reconciliation ?? period.countReconciled ?? false, filedAt: period.filedAt, accession: period.accession, rowImportStatus: period.rowImportStatus, indexUrl: period.indexUrl };
  });
  const table = createTable(documentRef, ['보고분기', '정보표 행', '보고 가치 합계', 'row 상태', '원문'], rows, (row) => {
    const tr = element(documentRef, 'tr', '');
    [row.period, String(row.count ?? '—'), formatReportedValue(row.value), row.rowImportStatus === 'IMPORTED_CURRENT' || row.rowImportStatus === 'IMPORTED_PRIOR' || row.rowImportStatus === 'IMPORTED_HISTORICAL' ? (row.reconciliation ? '행·cover 일치' : '검토 필요') : '공시 메타데이터만'].forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
    const sourceCell = element(documentRef, 'td', '');
    if (row.indexUrl) {
      const link = element(documentRef, 'a', 'masters-source-link', 'SEC');
      link.href = row.indexUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      sourceCell.appendChild(link);
    } else sourceCell.textContent = '—';
    tr.appendChild(sourceCell);
    return tr;
  }, 'masters-quarter-table masters-holdings-table');
  section.appendChild(table);
  return section;
}

function createFilingArtifact(documentRef, filingMeta, holdingMeta) {
  const filing = filingMeta?.latestFiling || holdingMeta?.latestFiling;
  const artifact = element(documentRef, 'div', 'masters-filing-artifact');
  artifact.append(
    element(documentRef, 'strong', '', filing ? 'SEC 공시 메타데이터 검증 완료' : 'SEC 공시 메타데이터 확인 필요'),
    element(documentRef, 'p', '', filing ? `CIK ${filingMeta?.cik || holdingMeta?.cik || '—'} · ${filing.form} · 보고분기 ${filing.periodOfReport} · 제출 ${filing.filedAt}` : `CIK ${filingMeta?.cik || holdingMeta?.cik || '확인 필요'} · ${filingMeta?.status || 'PENDING'}`)
  );
  if (!filing) return artifact;
  const links = element(documentRef, 'div', 'masters-filing-links');
  const addLink = (label, url) => {
    if (!url) return;
    const link = element(documentRef, 'a', 'masters-source-link', label);
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    links.appendChild(link);
  };
  addLink('SEC filing index', filing.indexUrl);
  addLink('Information table XML', filing.informationTableXml);
  addLink('Primary document XML', filing.primaryDocumentXml || holdingMeta?.latestFiling?.primaryDocumentXml);
  addLink('이전 분기 정보표', filingMeta?.priorFiling?.informationTableXml);
  artifact.appendChild(links);
  return artifact;
}

function createDetail(documentRef, manager, onRoute, filingMeta, holdingMeta, compactRows, fullRows, comparisonRows, state, securityMaster, referenceMaster, historyManager, historyRowsArtifact) {
  const detail = element(documentRef, 'article', 'masters-detail-card');
  const dataStatus = holdingMeta?.status || filingMeta?.status || manager.status;
  const freshnessStatus = holdingMeta?.freshnessStatus || filingMeta?.freshnessStatus || null;
  detail.append(
    element(documentRef, 'div', 'masters-eyebrow', manager.type === 'METHOD_ONLY' ? '방법론 전용 프로필' : '공개 13F 포트폴리오'),
    element(documentRef, 'h3', 'masters-detail-title', manager.name),
    element(documentRef, 'p', 'masters-detail-filer', manager.filer),
    sourceBadge(documentRef, manager, dataStatus, freshnessStatus)
  );
  detail.querySelector('.masters-detail-title')?.setAttribute('tabindex', '-1');

  const metrics = element(documentRef, 'div', 'masters-metric-grid');
  const fullRowCount = holdingMeta?.verification?.fullRowCount || fullRows.length || 0;
  metrics.append(
    createMetric(documentRef, '최신 보고분기', filingMeta?.latestFiling?.periodOfReport || holdingMeta?.verification?.reportPeriod || '확인 필요'),
    createMetric(documentRef, '전체 신고 행', fullRowCount ? `${fullRowCount}행` : '준비 중'),
    createMetric(documentRef, 'Filer / CIK', filingMeta?.cik || holdingMeta?.cik || '확인 필요'),
    createMetric(documentRef, '이전 보고분기', holdingMeta?.verification?.priorReportPeriod || '연결 안 됨'),
    createMetric(documentRef, '비교 행', holdingMeta?.verification?.comparisonRowCount ? `${holdingMeta.verification.comparisonRowCount}행` : '확인 필요'),
    createMetric(documentRef, '데이터 상태', statusLabel(dataStatus))
  );
  detail.append(metrics, createFilingArtifact(documentRef, filingMeta, holdingMeta));
  const availabilityNote = createAvailabilityNote(documentRef, filingMeta?.latestAvailabilityCheck);
  if (availabilityNote) detail.appendChild(availabilityNote);

  const warning = element(documentRef, 'div', 'masters-coverage-warning');
  warning.textContent = manager.type === 'METHOD_ONLY'
    ? '방법론 전용 프로필입니다. 교육 자료에서 보유 종목·비중·매매 신호를 생성하지 않습니다.'
    : compactRows.length
      ? 'SEC가 보고한 보유 행만 표시합니다. 13F는 전체 자산이 아니며, 현재 가격·포트폴리오 비중·매수·매도 신호를 계산하지 않습니다.'
      : 'SEC filer와 공시 메타데이터는 연결됐지만 이 프로필의 행 데이터가 아직 연결되지 않았습니다.';
  detail.appendChild(warning);

  const tabs = element(documentRef, 'div', 'masters-detail-tabs');
  Object.entries(VIEW_LABELS).forEach(([view, label]) => {
    const tab = button(documentRef, `masters-detail-tab${state.view === view ? ' is-active' : ''}`, label, 'view', view);
    tab.setAttribute('aria-pressed', state.view === view ? 'true' : 'false');
    tabs.appendChild(tab);
  });
  detail.appendChild(tabs);

  if (manager.type === 'METHOD_ONLY') {
    const empty = element(documentRef, 'div', 'masters-empty-state');
    empty.append(element(documentRef, 'strong', '', '방법론 콘텐츠는 별도 학습 자료로 연결됩니다.'), element(documentRef, 'p', '', '공식 자료의 검증된 원칙과 체크리스트를 연결하기 전에는 신고 보유 데이터로 오인될 수 있는 내용을 표시하지 않습니다.'));
    detail.appendChild(empty);
  } else if (state.view === 'changes') {
    const summary = createChangeSummary(documentRef, holdingMeta?.verification);
    if (summary) detail.appendChild(summary);
    if (compactRows.length) detail.appendChild(createTopHoldingTable(documentRef, manager, holdingMeta, compactRows));
    if (comparisonRows.length) detail.appendChild(createChangeLedger(documentRef, comparisonRows, state));
  } else if (state.view === 'holdings') {
    detail.appendChild(fullRows.length ? createFullHoldingsView(documentRef, fullRows, state) : element(documentRef, 'div', 'masters-empty-state', '전체 보유 행이 아직 연결되지 않았습니다.'));
  } else if (state.view === 'sectors') {
    const referenceSectorView = createReferenceSectorView(documentRef, fullRows, referenceMaster);
    if (referenceSectorView) detail.appendChild(referenceSectorView);
    detail.appendChild(createSectorView(documentRef, fullRows, securityMaster));
  } else if (state.view === 'quarters') {
    detail.appendChild(createQuarterView(documentRef, holdingMeta, historyManager, historyRowsArtifact));
  } else if (state.view === 'filings') {
    const filingView = element(documentRef, 'section', 'masters-filing-view');
    filingView.append(element(documentRef, 'h4', 'masters-holdings-title', '원본 공시와 검증 경계'), element(documentRef, 'p', 'masters-holdings-meta', '아래 링크는 SEC EDGAR 원문입니다. 공시의 보고 기준일과 제출일을 확인한 뒤 행 비교를 해석하세요.'), createFilingArtifact(documentRef, filingMeta, holdingMeta));
    detail.appendChild(filingView);
  }

  const principles = button(documentRef, 'masters-route-button is-secondary', '시장 원리 페이지에서 검증 프레임 보기', 'route', 'principles');
  principles.addEventListener('click', onRoute);
  detail.appendChild(principles);
  return detail;
}

export function createMastersPage({ root = globalThis, documentRef = root.document } = {}) {
  return {
    route: 'masters',
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById('page-masters');
      const content = page?.querySelector('[data-masters-content]');
      if (!page || !content) return () => bag.dispose();
       const state = { query: '', filter: 'ALL', selectedId: MASTER_REGISTRY[0].id, view: 'changes', actionFilter: 'ALL', holdingsQuery: '', page: 1, pageSize: 25, filings: null, holdings: null, securityMaster: null, referenceMaster: null, history: null, historyRows: null, filingsError: false, holdingsError: false, securityMasterError: false, referenceMasterError: false, historyError: false, historyRowsError: false };
      page.dataset.aioArchitectureRoute = 'masters';
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioContentKind = 'REFERENCE';
      page.dataset.aioReviewedAt = REVIEWED_AT;

      const route = (routeId) => { if (typeof root?.showPage === 'function') root.showPage(routeId); };
      const focusDetail = () => {
        const heading = page.querySelector('.masters-detail-title');
        if (!heading) return;
        heading.scrollIntoView({ block: 'start', behavior: 'auto' });
        heading.focus({ preventScroll: true });
      };
      const render = () => {
        const toolbar = element(documentRef, 'div', 'masters-toolbar');
        const filters = element(documentRef, 'div', 'masters-filter-tabs');
        [['ALL', '전체'], ['LIVE_13F', '13F 연결'], ['METHOD_ONLY', '방법론 전용']].forEach(([value, label]) => filters.appendChild(button(documentRef, `masters-filter-tab${state.filter === value ? ' is-active' : ''}`, label, 'filter', value)));
        const searchLabel = element(documentRef, 'label', 'masters-search');
        searchLabel.appendChild(element(documentRef, 'span', 'masters-sr-only', '투자자 검색'));
        const input = element(documentRef, 'input', 'masters-search-input');
        input.type = 'search';
        input.placeholder = '이름·신고주체·스타일 검색';
        input.value = state.query;
        input.setAttribute('aria-label', '투자자 검색');
        input.addEventListener('input', (event) => { state.query = String(event.target.value || '').trim().toLowerCase(); render(); });
        searchLabel.appendChild(input);
        toolbar.append(filters, searchLabel);
        const matchesList = MASTER_REGISTRY.filter((manager) => (state.filter === 'ALL' || manager.type === state.filter) && matches(manager, state.query));
        const layout = element(documentRef, 'div', 'masters-layout');
        const list = element(documentRef, 'div', 'masters-manager-list');
        matchesList.forEach((manager) => {
          const filingMeta = state.filings?.managers?.find((item) => item.id === manager.id);
          const holdingMeta = state.holdings?.managers?.find((item) => item.id === manager.id);
          list.appendChild(createManagerCard(documentRef, manager, manager.id === state.selectedId, holdingMeta?.status || filingMeta?.status || manager.status, holdingMeta?.freshnessStatus || filingMeta?.freshnessStatus));
        });
        if (!matchesList.length) list.appendChild(element(documentRef, 'div', 'masters-empty-state', '조건에 맞는 프로필이 없습니다.'));
        const selected = MASTER_REGISTRY.find((manager) => manager.id === state.selectedId) || matchesList[0] || MASTER_REGISTRY[0];
        if (selected) state.selectedId = selected.id;
        const filingMeta = state.filings?.managers?.find((item) => item.id === selected.id);
        const holdingMeta = state.holdings?.managers?.find((item) => item.id === selected.id);
        const compactRows = (state.holdings?.holdings || []).filter((item) => item.managerId === selected.id);
        const fullRows = (state.holdings?.allHoldings || state.holdings?.holdings || []).filter((item) => item.managerId === selected.id);
         const comparisonRows = (state.holdings?.comparisons || []).filter((item) => item.managerId === selected.id);
          const historyManager = state.history?.managers?.find((item) => item.managerId === selected.id);
          layout.append(list, createDetail(documentRef, selected, () => route('principles'), filingMeta, holdingMeta, compactRows, fullRows, comparisonRows, state, state.securityMaster, state.referenceMaster, historyManager, state.historyRows));
        if (state.filingsError) layout.appendChild(element(documentRef, 'div', 'masters-empty-state', 'SEC metadata artifact could not be loaded; profile shell remains available.'));
        if (state.holdingsError) layout.appendChild(element(documentRef, 'div', 'masters-empty-state', 'SEC holdings artifact could not be loaded; metadata remains available.'));
         if (state.securityMasterError || state.referenceMasterError) layout.appendChild(element(documentRef, 'div', 'masters-empty-state', 'Security master artifact could not be loaded; sector mapping remains fail-closed.'));
          if (state.historyError || state.historyRowsError) layout.appendChild(element(documentRef, 'div', 'masters-empty-state', 'SEC filing history row artifact could not be loaded; metadata and current/prior rows remain available.'));
        page.dataset.aioMastersView = state.view;
        page.dataset.aioMastersFullRows = String(fullRows.length);
        page.dataset.aioMastersComparisonRows = String(comparisonRows.length);
        page.dataset.aioMastersActionFilter = state.actionFilter;
        content.replaceChildren(toolbar, layout);
      };
      const onClick = (event) => {
        const target = event.target.closest?.('[data-masters-action]');
        if (!target || !page.contains(target)) return;
        const action = target.dataset.mastersAction;
        const value = target.dataset.mastersValue;
        const previousSelection = state.selectedId;
        if (action === 'filter') { state.filter = value; }
        if (action === 'select-manager') { state.selectedId = value; state.view = 'changes'; state.actionFilter = 'ALL'; state.holdingsQuery = ''; state.page = 1; }
        if (action === 'view') { state.view = value; state.page = 1; }
        if (action === 'change-filter') { state.actionFilter = value; state.page = 1; }
        if (action === 'detail-page') {
          state.page = Math.max(1, state.page + (value === 'next' ? 1 : -1));
        }
        if (action !== 'route') {
          event.preventDefault();
          render();
          if (action === 'select-manager' || action === 'view' || (action === 'change-filter' && previousSelection !== state.selectedId)) queueMicrotask(focusDetail);
        }
      };
      const onInput = (event) => {
        const target = event.target.closest?.('[data-masters-action="holdings-search"]');
        if (!target || !page.contains(target)) return;
        state.holdingsQuery = String(target.value || '').trim().toLowerCase();
        state.page = 1;
        render();
      };
      page.addEventListener('click', onClick);
      page.addEventListener('input', onInput);
      bag.add(() => page.removeEventListener('click', onClick));
      bag.add(() => page.removeEventListener('input', onInput));
       bag.add(() => { delete page.dataset.aioArchitectureRoute; delete page.dataset.aioArchitectureRenderer; delete page.dataset.aioContentKind; delete page.dataset.aioReviewedAt; delete page.dataset.aioMastersData; delete page.dataset.aioMastersHoldings; delete page.dataset.aioMastersSecurityMaster; delete page.dataset.aioMastersReferenceMaster; delete page.dataset.aioMastersHistory; delete page.dataset.aioMastersHistoryRows; delete page.dataset.aioMastersView; delete page.dataset.aioMastersFullRows; delete page.dataset.aioMastersComparisonRows; delete page.dataset.aioMastersActionFilter; content.replaceChildren(); });
      render();
      const fetchFn = root?.fetch || globalThis.fetch;
      if (typeof fetchFn === 'function') {
        const loadJson = (url) => fetchFn(url).then((response) => { if (!response.ok) throw new Error(`Masters artifact ${response.status}`); return response.json(); });
         Promise.all([loadJson(FILINGS_URL), loadJson(HOLDINGS_URL), loadJson(SECURITY_MASTER_URL), loadJson(SECURITY_MASTER_REFERENCE_URL), loadJson(HISTORY_INDEX_URL), loadJson(HISTORY_HOLDINGS_URL)])
            .then(([filings, holdings, securityMaster, referenceMaster, history, historyRows]) => { state.filings = filings; state.holdings = holdings; state.securityMaster = securityMaster; state.referenceMaster = referenceMaster; state.history = history; state.historyRows = historyRows; page.dataset.aioMastersData = 'connected'; page.dataset.aioMastersHoldings = 'connected'; page.dataset.aioMastersSecurityMaster = 'connected'; page.dataset.aioMastersReferenceMaster = 'connected'; page.dataset.aioMastersHistory = 'connected'; page.dataset.aioMastersHistoryRows = 'connected'; render(); })
            .catch(() => { state.filingsError = true; state.holdingsError = true; state.securityMasterError = true; state.referenceMasterError = true; state.historyError = true; state.historyRowsError = true; page.dataset.aioMastersData = 'fallback'; page.dataset.aioMastersHoldings = 'fallback'; page.dataset.aioMastersSecurityMaster = 'fallback'; page.dataset.aioMastersReferenceMaster = 'fallback'; page.dataset.aioMastersHistory = 'fallback'; page.dataset.aioMastersHistoryRows = 'fallback'; render(); });
      }
      return () => bag.dispose();
    }
  };
}

export { MASTER_REGISTRY, FILINGS_URL, HOLDINGS_URL, SECURITY_MASTER_URL, SECURITY_MASTER_REFERENCE_URL, HISTORY_INDEX_URL, HISTORY_HOLDINGS_URL };
