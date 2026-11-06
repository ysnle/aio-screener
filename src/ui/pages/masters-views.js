// Masters (대가 보유 종목) view builders — the tables, change ledger, sector/quarter/compare/principles views and the
// top-weight bars the page assembles. Split out of src/ui/pages/masters.js (v59.70, page-module ceiling); behaviour unchanged.
import { ensureFrameStyle } from '../knowledge/analysis-frames.js';
import { readNumber } from '../../domain/shared/number.js';
import { describeValueScaleCarryover } from '../../domain/masters/value-scale.js';
import { applySafeExternalLink } from '../../ui/knowledge/safe-external-link.js';
import { withTopicParticle } from '../../domain/content/korean-particle.js';
import { displayActionOf, formatReportedValue, formatPercent, formatValueDelta, formatDelta, formatIssuerName, isPartialAmendmentPeriod } from '../../domain/masters/holdings-format.js';
import { EXACT_TICKER_RE, buildReferenceTickerMap, cleanIssuerName, normalizeCusip, resolveExactTicker } from '../../domain/masters/ticker-exact.js';

const ACTION_LABELS = Object.freeze({
  NEW: '신규 편입',
  INCREASED: '증가',
  REDUCED: '감소',
  UNCHANGED: '변화 없음',
  EXITED: '전량 제외',
  SPLIT_SUSPECT: '분할 의심, 수량 변화 보류',
  UNAVAILABLE: '비교 불가'
});

export const VIEW_LABELS = Object.freeze({
  changes: '핵심 변화',
  holdings: '보유 검색',
  sectors: '섹터 구성',
  quarters: '분기 추이',
  compare: '투자자 비교',
  principles: '투자 원칙',
  ownership: '대량 보유',
  filings: '원본 공시'
});

export function element(documentRef, tag, className, text) {
  const node = documentRef.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

export function button(documentRef, className, text, action, value) {
  const node = element(documentRef, 'button', className, text);
  node.type = 'button';
  node.dataset.mastersAction = action;
  if (value != null) node.dataset.mastersValue = value;
  return node;
}
export function createMetric(documentRef, label, value) {
  const card = element(documentRef, 'div', 'masters-metric');
  card.append(element(documentRef, 'span', 'masters-metric-label', label), element(documentRef, 'strong', 'masters-metric-value', value));
  return card;
}

// 2026-10-14 audit: the lookup field had no rule of its own (a white default box in dark mode, too narrow in
// the 연결 column); it takes the same look as .masters-search-input and the full column width.
const MASTERS_EXTRA_STYLE = `
.masters-ticker-lookup{margin:0}
.masters-ticker-lookup .masters-search{display:block;margin:6px 0 0;min-width:0}
.masters-ticker-lookup-input{width:100%;box-sizing:border-box;padding:9px 11px;border:0.5px solid var(--border);border-radius:4px;background:var(--surface-1);color:var(--text-primary);font-size:12px}
.masters-ticker-lookup-input:focus{outline:2px solid var(--accent);outline-offset:1px}
.masters-weight-bars{margin:12px 0 4px}
.masters-weight-bars .af-bars{max-width:none}
`;

export function ensureMastersExtraStyle(documentRef) {
  if (!documentRef?.head || documentRef.getElementById('aio-masters-lookup-style')) return;
  const style = documentRef.createElement('style');
  style.id = 'aio-masters-lookup-style';
  style.textContent = MASTERS_EXTRA_STYLE;
  documentRef.head.appendChild(style);
}

// v57.54: the CUSIP (security code) is a lookup key, not a reading — it moves from its own column to the issuer
// cell's hover and accessible name.
// v57.92: "CAP STK CL A" → "A주". Two classes of one issuer (Alphabet A and C) otherwise read as the same name.
export function shareClassTag(title) {
  const letter = String(title || '').match(/\bCL(?:ASS)?\s*([A-Z])\b/i)?.[1];
  return letter ? `${letter.toUpperCase()}주` : null;
}

// v58.56 (re-audit #4): rows named the security only by the filer's text ("BANK OF AMER CORP"), with no way to the
// stock itself. A row gets a ticker chip that opens 종목 요약 only when its CUSIP maps to exactly one listed symbol —
// `row.tickerExact` written by the runtime builder (reference crosswalk + OpenFIGI, scripts/collect-13f-figi-tickers.mjs),
// or, until that build has run once, the exact entries of the reference crosswalk. Other rows keep the SEC name,
// only made readable; nothing is matched by name.
export function createSecurityLookup(holdings = null, referenceMaster = null) {
  const reference = buildReferenceTickerMap(referenceMaster);
  const builderMapped = Boolean(holdings?.tickerExactPolicy);
  const referenceOf = (row) => reference.get(normalizeCusip(row?.cusipNormalized || row?.cusip));
  const tickerOf = (row) => {
    if (!row) return null;
    if (row.tickerExact) return EXACT_TICKER_RE.test(String(row.tickerExact)) ? String(row.tickerExact) : null;
    if (builderMapped) return null; // the builder already decided; a missing field means no exact match
    return resolveExactTicker({ titleOfClass: row.titleOfClass, reference: referenceOf(row) });
  };
  const nameOf = (row) => {
    const ticker = tickerOf(row);
    const ref = referenceOf(row);
    return ticker && ref?.ticker === ticker && ref.name ? ref.name : (cleanIssuerName(row?.issuer) || '—');
  };
  return { tickerOf, nameOf };
}

export const PLAIN_LOOKUP = Object.freeze({ tickerOf: () => null, nameOf: (row) => cleanIssuerName(row?.issuer) || '—' });

export function tickerChip(documentRef, ticker) {
  const chip = element(documentRef, 'button', 'sx-chip sx-chip--sm masters-ticker-chip', ticker);
  chip.type = 'button';
  chip.dataset.action = 'showTicker';
  chip.dataset.arg = ticker;
  chip.title = `${ticker} 종목 개요 열기`;
  chip.setAttribute('aria-label', `${ticker} 종목 개요 열기`);
  return chip;
}

function issuerCell(documentRef, row, lookup = PLAIN_LOOKUP) {
  const cusip = row.cusipNormalized || row.cusip || '';
  const tag = shareClassTag(row.titleOfClass);
  const name = lookup.nameOf(row);
  const ticker = lookup.tickerOf(row);
  const td = element(documentRef, 'td', 'masters-issuer-cell');
  const label = element(documentRef, 'span', 'masters-issuer-name', `${name}${tag && !/\bclass\b/i.test(name) ? `, ${tag}` : ''}`);
  td.appendChild(label);
  if (ticker) { td.append(' ', tickerChip(documentRef, ticker)); td.dataset.ticker = ticker; } // run-3 B28: "Class AGOOGL" read and copied as one word
  const filed = row.issuer && row.issuer !== name ? `SEC 신고 표기 ${row.issuer}` : '';
  if (cusip || filed) td.title = [filed, cusip ? `CUSIP(증권 코드) ${cusip}` : ''].filter(Boolean).join(', ');
  if (cusip) td.dataset.cusip = cusip;
  return td;
}

export function createChangeSummary(documentRef, verification, comparisonRows = []) {
  if (!verification?.priorReportPeriod) return null;
  const splitSuspects = comparisonRows.filter((row) => displayActionOf(row) === 'SPLIT_SUSPECT').length;
  const summary = element(documentRef, 'div', 'masters-change-summary');
  summary.appendChild(element(documentRef, 'strong', 'masters-change-summary-title', `${verification.reportPeriod} 보고 주식 수 변화, 이전 보고분기 ${verification.priorReportPeriod}`));
  const counts = element(documentRef, 'div', 'masters-change-counts');
  ['NEW', 'INCREASED', 'REDUCED', 'UNCHANGED', 'EXITED'].forEach((action) => {
    const count = verification.comparisonActionCounts?.[action] || 0;
    counts.appendChild(element(documentRef, 'span', `masters-change-count masters-change-${action.toLowerCase()}`, `${ACTION_LABELS[action]} ${count}`));
  });
  summary.appendChild(counts);
  // #9: the counts are the filing's share deltas, not split-adjusted.
  summary.appendChild(element(documentRef, 'p', 'masters-holdings-meta', `주식 분할·병합 미보정 수량 기준${splitSuspects ? `, 불러온 행 중 분할 의심 ${splitSuspects}건이 증가·감소 수에 들어 있습니다` : ''}.`));
  return summary;
}


export function createOwnershipEvents(documentRef, manager, discovery) {
  if (manager.type === 'METHOD_ONLY') return null;
  const section = element(documentRef, 'section', 'masters-ownership-events masters-availability-note');
  section.appendChild(element(documentRef, 'strong', '', '5% 이상 대량 보유 신고(13D·13G)'));
  section.appendChild(element(documentRef, 'p', 'masters-catalog-boundary', '한 회사 지분을 5% 넘게 가지면 내는 수시 공시다. 13D는 경영에 영향을 줄 뜻이 있을 수 있는 보유, 13G는 단순 투자 목적의 보유이고, 끝에 /A가 붙으면 지분율이나 목적이 바뀌었다는 변경 신고다.'));
  if (!discovery || discovery.status === 'BLOCKED' || discovery.ownershipStatus === 'BLOCKED') {
    section.appendChild(element(documentRef, 'div', 'masters-empty-state', '대량 보유 신고 목록을 확인하지 못해 최근 신고를 보여 주지 않는다.'));
    return section;
  }
  const ownershipAsOf = String(discovery.ownershipCheckedAt || discovery.generatedAt || '').slice(0, 10);
  if (ownershipAsOf) section.appendChild(element(documentRef, 'p', 'masters-catalog-boundary', `${ownershipAsOf} 확인 기준`));
  const events = discovery.ownershipEvents || [];
  if (!events.length) {
    section.appendChild(element(documentRef, 'div', 'masters-empty-state', '최근 제출 목록에서 이 운용사의 대량 보유 신고를 찾지 못했다. 보유가 없다는 뜻은 아니다.'));
    return section;
  }
  // P1591 (L11): a holding without an identified issuer gives no investment context, so identified
  // filings are listed and the rest collapse into one line pointing to the originals. The date shown is
  // the filing date; the check date above is when the list was last read.
  const identified = events.filter((event) => event.subjectCompany);
  const unidentified = events.filter((event) => !event.subjectCompany);
  if (unidentified.length) {
    const fold = element(documentRef, 'p', 'masters-catalog-boundary', `발행사가 확인되지 않은 신고 ${unidentified.length}건은 원문에서만 확인할 수 있다(제출일 ${unidentified.map((event) => event.filedAt).filter(Boolean).sort().slice(-1)[0] || '확인 필요'}까지).`);
    section.appendChild(fold);
  }
  if (!identified.length) {
    section.appendChild(element(documentRef, 'div', 'masters-empty-state', '발행사가 확인된 최근 대량 보유 신고는 없다.'));
    return section;
  }
  const list = element(documentRef, 'ul', 'masters-ownership-list');
  identified.forEach((event) => {
    const item = element(documentRef, 'li', 'masters-ownership-item');
    const form = String(event.form || '');
    const kind = /13D/.test(form) ? '경영 참여 가능 보유(13D)' : /13G/.test(form) ? '단순 투자 보유(13G)' : form;
    const change = /\/A$/.test(form) ? ' 변경' : ' 최초';
    const issuer = event.subjectCompany ? formatIssuerName(event.subjectCompany) : '발행사 확인 전';
    const percent = Number.isFinite(event.percentOfClass) ? `, 지분 ${event.percentOfClass}%` : '';
    item.appendChild(element(documentRef, 'span', 'masters-ownership-issuer', `${issuer}${percent}`));
    item.appendChild(element(documentRef, 'span', '', `, ${kind}${change}, ${event.filedAt || '제출일 확인 필요'} `));
    const link = element(documentRef, 'a', 'masters-source-link', '원문');
    applySafeExternalLink(link, event.indexUrl);
    item.appendChild(link);
    list.appendChild(item);
  });
  section.appendChild(list);
  return section;
}

export function fullManagersLabel(summary) {
  return `${summary.currentFull + summary.staleFull}/${summary.filers}개 (최신 ${summary.currentFull}, 지연 ${summary.staleFull})`;
}

function createTable(documentRef, headers, rows, rowBuilder, className = 'masters-holdings-table') {
  const table = element(documentRef, 'table', className);
  const head = element(documentRef, 'thead', '');
  const headerRow = element(documentRef, 'tr', '');
  headers.forEach((label) => headerRow.appendChild(element(documentRef, 'th', '', label)));
  head.appendChild(headerRow);
  const body = element(documentRef, 'tbody', '');
  rows.forEach((row, index) => body.appendChild(rowBuilder(row, index)));
  table.append(head, body);
  return table;
}

function createHoldingRow(documentRef, row, index, includeAction = true, lookup = PLAIN_LOOKUP) {
  const tr = element(documentRef, 'tr', '');
  const formatter = new Intl.NumberFormat('en-US');
  tr.appendChild(element(documentRef, 'td', '', String(row.rank || index + 1)));
  tr.appendChild(issuerCell(documentRef, row, lookup));
  const values = [formatReportedValue(row.value), formatter.format(row.shares || 0)];
  if (includeAction) values.push(formatDelta(row.sharesDelta, formatter), formatValueDelta(row.valueDelta));
  values.push(row.putCall || '—');
  values.forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
  if (includeAction) {
    const action = displayActionOf(row);
    const prefix = row.actionConfidence === 'REVIEW_REQUIRED' && action !== 'SPLIT_SUSPECT' ? '신고 수량상 ' : '';
    tr.appendChild(element(documentRef, 'td', `masters-action masters-action-${action.toLowerCase()}`, `${prefix}${ACTION_LABELS[action] || action}`));
  }
  tr.title = `${row.evidenceId || 'SEC reference'}, ${row.reportPeriod || ''}`;
  return tr;
}

export function createTopHoldingTable(documentRef, manager, holdingMeta, rows, lookup = PLAIN_LOOKUP) {
  const section = element(documentRef, 'section', 'masters-holdings-section');
  const heading = element(documentRef, 'div', 'masters-holdings-heading');
  heading.append(
    element(documentRef, 'h3', 'masters-holdings-title', '상위 보고 보유 종목, 증권·주식 유형·옵션별 집계'),
    element(documentRef, 'p', 'masters-holdings-meta', `${holdingMeta?.verification?.reportPeriod || '보고분기 확인 필요'}, 상위 ${rows.length}개, 전체 신고 행 ${holdingMeta?.verification?.fullRowCount || '—'}개`)
  );
  const table = createTable(documentRef, ['가치 순위', '발행사', '신고 가치', '주식 수', '수량 변화', '가치 변화', '옵션', '변화 분류'], rows, (row, index) => createHoldingRow(documentRef, row, index, true, lookup));
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
  wrap.append(previous, element(documentRef, 'span', 'masters-page-status', `${page} / ${pageCount}, ${total}개`), next);
  return wrap;
}

export function createChangeLedger(documentRef, comparisonRows, state) {
  // v59.51 (content audit): the row ledger is the expert layer of the change counts above (the same quarter's share deltas);
  // it starts closed and keeps its open state across the filter and page re-renders.
  const section = element(documentRef, 'details', 'masters-holdings-section masters-change-ledger');
  section.open = state.changeLedgerOpen === true;
  section.addEventListener('toggle', () => { state.changeLedgerOpen = section.open; });
  section.appendChild(element(documentRef, 'summary', 'masters-holdings-title', `분기별 변화 표, 행 ${comparisonRows.length}개 (증권·주식 유형·옵션별 집계)`));
  // v58.79: the classification method is one fold down, not an open paragraph above the ledger.
  const method = element(documentRef, 'details', 'aio-note-fold masters-method-fold');
  method.append(element(documentRef, 'summary', '', '분류 방법'), element(documentRef, 'p', 'aio-note-fold__text', '두 보고분기의 신고 주식 수 차이로 나눈 분류입니다. 주식 분할·병합은 보정하지 않아, 주식 수는 크게 바뀌었는데 신고 가치가 비슷한 행은 분할 의심으로 따로 둡니다. 변화가 있는 행을 먼저 신고 가치 순으로 놓았고(왼쪽 번호는 표시 순서), 현재 가격·실제 매매·매매 신호·목표가를 뜻하지 않습니다.'));
  section.appendChild(method);
  const filters = element(documentRef, 'div', 'masters-action-filters');
  const splitSuspects = comparisonRows.filter((row) => displayActionOf(row) === 'SPLIT_SUSPECT').length;
  ['ALL', 'NEW', 'INCREASED', 'REDUCED', 'UNCHANGED', 'EXITED', ...(splitSuspects ? ['SPLIT_SUSPECT'] : [])].forEach((action) => {
    const label = action === 'ALL' ? '전체' : ACTION_LABELS[action];
    const filterButton = button(documentRef, `masters-action-filter${state.actionFilter === action ? ' is-active' : ''}`, label, 'change-filter', action);
    filterButton.setAttribute('aria-pressed', state.actionFilter === action ? 'true' : 'false');
    filters.appendChild(filterButton);
  });
  // P1593 (F99/F110): a 'changes' view shows rows that changed before unchanged ones (each group keeps the
  // reported-value order); the preview itself is the top rows by current reported value, and says so above.
  const changedFirst = [...comparisonRows].sort((a, b) => Number(a.action === 'UNCHANGED') - Number(b.action === 'UNCHANGED'));
  const filtered = state.actionFilter === 'ALL' ? changedFirst : comparisonRows.filter((row) => displayActionOf(row) === state.actionFilter);
  const pageCount = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = filtered.slice(start, start + state.pageSize);
  const table = createTable(documentRef, ['순번', '발행사', '신고 가치', '주식 수', '수량 변화', '가치 변화', '변화 분류'], pageRows, (row, index) => {
    const tr = element(documentRef, 'tr', '');
    const formatter = new Intl.NumberFormat('en-US');
    tr.appendChild(element(documentRef, 'td', '', String(start + index + 1)));
    tr.appendChild(issuerCell(documentRef, row, state.securityLookup || PLAIN_LOOKUP));
    [formatReportedValue(row.value), formatter.format(row.shares || 0), formatDelta(row.sharesDelta, formatter), formatValueDelta(row.valueDelta)].forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
    const shown = displayActionOf(row);
    tr.appendChild(element(documentRef, 'td', `masters-action masters-action-${String(shown).toLowerCase().replace(/_/g, '-')}`, `${ACTION_LABELS[shown] || shown || '비교 불가'}`));
    tr.title = `${row.evidenceId || 'SEC comparison'}, 이전 보고분기 ${row.priorReportPeriod || '확인 필요'}, ${row.actionBasis || 'REPORTED_SHARE_DELTA'}, ${row.actionConfidence || 'REVIEW_REQUIRED'}`;
    return tr;
  }, 'masters-comparison-table masters-holdings-table');
  section.append(filters, table, createPagination(documentRef, state.page, pageCount, filtered.length));
  return section;
}

export function createFullHoldingsView(documentRef, fullRows, state, descriptor = null) {
  const section = element(documentRef, 'section', 'masters-holdings-section');
  const heading = element(documentRef, 'div', 'masters-holdings-heading');
  heading.append(
    element(documentRef, 'h3', 'masters-holdings-title', `불러온 보유 행 ${fullRows.length.toLocaleString('en-US')}개`),
    element(documentRef, 'p', 'masters-holdings-meta', `이 분기 신고 전체 ${Number(descriptor?.fullRows || fullRows.length).toLocaleString('en-US')}행 가운데 ${fullRows.length.toLocaleString('en-US')}행을 불러왔습니다. 검색과 표는 불러온 행 안에서만 작동하므로, 여기서 찾지 못해도 보유하지 않았다는 뜻은 아닙니다.`),
    element(documentRef, 'p', 'masters-holdings-meta masters-raw-row-boundary', '원문 분할행은 이전 분기 행과 일대일 대응이 검증되지 않아 행별 변화를 표시하지 않습니다. 종목 집계 변화는 분기 변화 원장에서 확인하세요.')
  );
  const controls = element(documentRef, 'div', 'masters-holdings-controls');
  const search = element(documentRef, 'input', 'masters-holdings-search');
  search.type = 'search';
  search.placeholder = '회사명·티커·CUSIP 검색';
  search.value = state.holdingsQuery;
  search.setAttribute('aria-label', '불러온 보유 행 검색');
  search.dataset.mastersAction = 'holdings-search';
  controls.appendChild(search);
  const lookup = state.securityLookup || PLAIN_LOOKUP;
  const filtered = fullRows.filter((row) => !state.holdingsQuery || [row.issuer, lookup.nameOf(row), lookup.tickerOf(row), row.cusipNormalized, row.titleOfClass].join(' ').toLowerCase().includes(state.holdingsQuery));
  const pageCount = Math.max(1, Math.ceil(filtered.length / state.pageSize));
  state.page = Math.min(state.page, pageCount);
  const start = (state.page - 1) * state.pageSize;
  const pageRows = filtered.slice(start, start + state.pageSize);
  const table = createTable(documentRef, ['#', '발행사', '신고 가치', '주식 수', '옵션'], pageRows, (row, index) => createHoldingRow(documentRef, row, start + index, false, state.securityLookup || PLAIN_LOOKUP), 'masters-full-holdings-table masters-holdings-table');
  section.append(heading, controls, table, createPagination(documentRef, state.page, pageCount, filtered.length));
  return section;
}


export function createRowPreviewView(documentRef, manager, previewMeta, previewRows) {
  const section = element(documentRef, 'section', 'masters-holdings-section masters-row-preview');
  const heading = element(documentRef, 'div', 'masters-holdings-heading');
  heading.append(
    element(documentRef, 'h3', 'masters-holdings-title', 'SEC 원문 미리보기, 전체 표 불러오는 중'),
    element(documentRef, 'p', 'masters-holdings-meta', `${previewMeta?.reportPeriod || '보고분기 확인 필요'}, ${previewRows.length}개 표시 행, 전체 신고 행 수 미확정`)
  );
  const notice = element(documentRef, 'p', 'masters-coverage-warning', '이 표는 공식 SEC 정보표에서 확인된 일부 행의 연결 상태를 보여주는 미리보기입니다. 전체 보유·비중·분기 변화·섹터·신호 계산에는 사용하지 않습니다.');
  const formatter = new Intl.NumberFormat('en-US');
  const table = createTable(documentRef, ['#', '발행사', '증권 종류', 'CUSIP(증권 코드)', '신고 가치', '수량', '단위', '원문'], previewRows, (row, index) => {
    const tr = element(documentRef, 'tr', 'masters-row-preview-row');
    [String(index + 1), row.issuer || '—', row.titleOfClass || '—', row.cusip || '—', formatReportedValue(row.value), formatter.format(row.shares || 0), row.shareType || '—'].forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
    const sourceCell = element(documentRef, 'td', '');
    if (previewMeta?.sourceUrl) {
      const link = element(documentRef, 'a', 'masters-source-link', 'XML');
      applySafeExternalLink(link, previewMeta.sourceUrl);
      sourceCell.appendChild(link);
    } else sourceCell.textContent = '—';
    tr.appendChild(sourceCell);
    tr.title = `${previewMeta?.accession || 'SEC information table'}, preview only`;
    return tr;
  }, 'masters-row-preview-table masters-holdings-table');
  section.append(heading, notice, table);
  return section;
}

export function createSectorView(documentRef, fullRows = [], securityMaster = null) {
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
    ['security master artifact', securityMaster ? `${securityMaster.status}, ${securityMaster.coverage?.recordsPublished ?? 0} records` : 'NOT_CONNECTED']
  ].forEach(([label, value]) => metrics.appendChild(createMetric(documentRef, label, value)));
  empty.append(
    element(documentRef, 'strong', '', '섹터 구성은 아직 공개하지 않습니다.'),
    element(documentRef, 'p', '', `SEC CUSIP 행은 연결되어 있지만 검증된 issuer·ticker·sector master 기록은 ${securityMaster?.coverage?.recordsPublished ?? 0}개입니다. 현재 상태 ${securityMaster?.status || 'NOT_CONNECTED'}에서는 임의의 섹터와 포트폴리오 비중을 표시하지 않습니다.`),
    metrics,
    element(documentRef, 'p', 'masters-holdings-meta', '정규화 대기 원장: CUSIP·share class·put/call·법인행동을 issuer master와 대조한 뒤에만 섹터 비중을 계산합니다. 13F 보고가 없는 자산은 이 화면에 포함하지 않습니다.')
  );
  return empty;
}

export function createReferenceSectorView(documentRef, fullRows = [], referenceMaster = null) {
  const referenceByCusip = new Map((referenceMaster?.records || []).map((record) => [record.cusipNormalized, record]));
  const mappedRows = fullRows.map((row) => ({ ...row, ...(referenceByCusip.get(row.cusipNormalized || row.cusip) || {}) })).filter((row) => row.tickerReference && row.sectorReference);
  if (!mappedRows.length) return null;
  // P1522: withheld rows carry value null; summing them as 0 would draw "$0" and a sort by nothing.
  const scaleWithheld = mappedRows.some((row) => row.valueScaleStatus === 'SCALE_REVIEW');
  const totalValue = scaleWithheld ? null : mappedRows.reduce((sum, row) => sum + (Number(row.value) || 0), 0);
  const sectorTotals = new Map();
  mappedRows.forEach((row) => {
    const current = sectorTotals.get(row.sectorReference) || { rows: 0, value: 0 };
    current.rows += 1;
    current.value += Number(row.value) || 0;
    sectorTotals.set(row.sectorReference, current);
  });
  const section = element(documentRef, 'section', 'masters-holdings-section masters-reference-sector-view');
  section.append(
    element(documentRef, 'h3', 'masters-holdings-title', '섹터 구성, 참고 분류'),
    element(documentRef, 'p', 'masters-holdings-meta', `신고 보유 ${fullRows.length}행 가운데 공개 식별자로 섹터를 붙일 수 있었던 ${mappedRows.length}행(${scaleWithheld ? '금액 단위 확인 중' : formatReportedValue(totalValue)}) 기준이다. 분류는 참고용이라, 공식 섹터 자료로 한 번 더 확인되기 전까지 비중은 대략적인 구성으로만 읽는다.`)
  );
  const rows = [...sectorTotals.entries()].sort((a, b) => (scaleWithheld ? b[1].rows - a[1].rows : b[1].value - a[1].value)).map(([sector, values]) => ({ sector, ...values }));
  section.appendChild(createTable(documentRef, ['참고 섹터', '보유 행', '신고 가치', '분류된 보유 중 비중'], rows, (row) => {
    const tr = element(documentRef, 'tr', '');
    [row.sector, String(row.rows), scaleWithheld ? '—' : formatReportedValue(row.value), totalValue ? `${((row.value / totalValue) * 100).toFixed(1)}%` : '—'].forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
    return tr;
  }, 'masters-sector-reference-table masters-holdings-table'));
  section.appendChild(element(documentRef, 'p', 'masters-holdings-meta', `분류 기준일 ${referenceMaster.reviewedAt}, SEC 신고 원문의 발행사·CUSIP와 공개 식별자 대조로 붙인 섹터다.`));
  return section;
}

export function createQuarterView(documentRef, holdingMeta, historyManager, historyRowsArtifact, scaleReviewed = false) {
  const verification = holdingMeta?.verification;
  const section = element(documentRef, 'section', 'masters-holdings-section');
  section.appendChild(element(documentRef, 'h3', 'masters-holdings-title', '분기 보고 추이'));
  if (scaleReviewed) section.appendChild(element(documentRef, 'p', 'masters-holdings-meta masters-scale-review', describeValueScaleCarryover()));
  const importedRows = [
    { period: verification?.priorReportPeriod, count: verification?.priorFullRowCount, value: scaleReviewed ? null : verification?.priorParsedValueTotal, reconciliation: verification?.priorCountReconciled },
    { period: verification?.reportPeriod, count: verification?.fullRowCount, value: verification?.valueScaleReview ? null : verification?.parsedValueTotal, reconciliation: verification?.countReconciled }
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
    const partial = isPartialAmendmentPeriod(period, imported);
    return { period: period.periodOfReport, partial, count: partial ? null : imported?.count ?? period.rowCount ?? historical?.count ?? null, partialCount: partial ? period.rowCount ?? historical?.count ?? null : null, value: partial || scaleReviewed ? null : imported?.value ?? period.reportedValueTotal ?? historical?.value ?? null, reconciliation: imported?.reconciliation ?? period.countReconciled ?? false, filedAt: period.filedAt, accession: period.accession, rowImportStatus: period.rowImportStatus, indexUrl: period.indexUrl, composition: period.composition || null };
  });
  // Feature audit 2026-11-02: only managers in history-index.json carry a multi-quarter history; the rest have the
  // current and prior quarter, so the sentence states the quarters actually shown instead of a 12-quarter default.
  section.appendChild(element(documentRef, 'p', 'masters-holdings-meta', `최근 ${rows.length}개 분기에 SEC에 신고한 보유 행 수와 신고 가치입니다.${historyManager ? '' : ' 이 운용사는 이번·직전 분기만 연결돼 있습니다.'} 정정 공시는 원본과 합쳐 분기 전체가 확인될 때만 추이에 넣습니다.`));
  section.appendChild(createQuarterTrend(documentRef, rows));
  const table = createTable(documentRef, ['보고 분기', '보유 행', '신고 가치 합계', '상태', '원문'], rows, (row) => {
    const tr = element(documentRef, 'tr', '');
    let state;
    if (row.partial) state = `부분 공시 — 정정 공시의 추가 보유 ${row.partialCount ?? '일부'}행만 연결돼 분기 전체 비교 보류`;
    else if (row.rowImportStatus === 'REVIEW_REQUIRED') state = '분기 전체를 구성하지 못해 보류';
    else if (row.rowImportStatus === 'IMPORTED_CURRENT' || row.rowImportStatus === 'IMPORTED_PRIOR' || row.rowImportStatus === 'IMPORTED_HISTORICAL') {
      const reconciledLabel = row.reconciliation ? '표지 합계와 일치' : '표지 합계와 차이 — 확인 필요';
      state = row.composition?.composite ? `${reconciledLabel}, ${row.composition.label}` : reconciledLabel;
    } else state = '공시 목록만 연결';
    if (row.partial) tr.dataset.mastersPartialPeriod = 'true';
    [row.period, row.count == null ? '—' : String(row.count), formatReportedValue(row.value), state].forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
    const sourceCell = element(documentRef, 'td', '');
    if (row.indexUrl) {
      const link = element(documentRef, 'a', 'masters-source-link', 'SEC');
      applySafeExternalLink(link, row.indexUrl);
      sourceCell.appendChild(link);
    } else sourceCell.textContent = '—';
    tr.appendChild(sourceCell);
    return tr;
  }, 'masters-quarter-table masters-holdings-table');
  section.appendChild(table);
  return section;
}

// P1599 (F110): the quarter trend as two small column charts — reported value and row count are different
// measures (value moves with prices; neither is AUM or performance), so each gets its own scale. A quarter
// without a complete filing is a gap, never a zero.
function createQuarterTrend(documentRef, rows) {
  const ordered = [...rows].filter((row) => row.period).sort((a, b) => String(a.period).localeCompare(String(b.period)));
  const wrap = element(documentRef, 'div', 'masters-quarter-trend');
  for (const [key, title, format] of [['value', '신고 가치 합계 (가격 변화 포함, 운용 수익이나 AUM 아님)', formatReportedValue], ['count', '보고 행 수', (value) => `${value}행`]]) {
    const values = ordered.map((row) => readNumber(row[key]));
    const known = values.filter((value) => value != null);
    if (known.length < 2) continue;
    const max = Math.max(...known);
    const block = element(documentRef, 'div', 'masters-trend-block');
    block.appendChild(element(documentRef, 'p', 'masters-holdings-meta', `${title} — ${ordered[0].period} ~ ${ordered[ordered.length - 1].period}`));
    const bars = element(documentRef, 'div', 'masters-trend-bars');
    bars.setAttribute('role', 'img');
    bars.setAttribute('aria-label', `${title}: ${ordered.map((row, index) => `${row.period} ${values[index] == null ? '자료 없음' : format(values[index])}`).join(', ')}`);
    ordered.forEach((row, index) => {
      const bar = element(documentRef, 'span', `masters-trend-bar${values[index] == null ? ' is-gap' : ''}`);
      bar.style.height = values[index] == null ? '100%' : `${Math.max(3, values[index] / max * 100).toFixed(1)}%`;
      bar.title = `${row.period}, ${values[index] == null ? '분기 전체 미확인' : format(values[index])}`;
      bars.appendChild(bar);
    });
    block.appendChild(bars);
    const first = known[0];
    const last = known[known.length - 1];
    block.appendChild(element(documentRef, 'p', 'masters-holdings-meta', `처음 ${format(first)} → 최근 ${format(last)}`));
    wrap.appendChild(block);
  }
  return wrap;
}

export function createIssuerAggregateView(documentRef, aggregateArtifact, managerId, scaleReviewed = false) {
  const section = element(documentRef, 'section', 'masters-holdings-section masters-issuer-aggregate-view');
  const records = (aggregateArtifact?.aggregates || []).filter((record) => record.managerId === managerId);
  const periods = new Set(records.flatMap((record) => record.periods || []).map((period) => period.reportPeriod).filter(Boolean));
  // F110: counted the same way as the all-filer total and the table's '확인할 점' column (filing flags only);
  // corporate actions are still unreviewed for every bundle, which the section note already says once.
  const reviewQueue = records.filter((record) => record.reviewFlags?.length);
  // W04-A/P1149 (C01): the per-manager summary must be computed from the selected manager's
  // records with the SAME function as the table below. The whole-artifact coverage belongs in its
  // own labelled block — a manager-scoped card must never show another scope's denominator.
  // CUSIP count, unique report periods, and manager·CUSIP·share-type·put/call records are
  // different counts and are never assumed equal.
  const managerCusips = new Set(records.map((record) => record.cusipNormalized).filter(Boolean));
  const managerPeriodRows = records.reduce((sum, record) => sum + (record.periods?.length || 0), 0);
  const scope = { managerId: managerId || null, reportPeriods: [...periods].sort(), aggregationKey: 'manager·CUSIP·shareType·putCall' };
  section.append(
    element(documentRef, 'h3', 'masters-holdings-title', '보유 증권별 여러 분기 공시 모음'),
    element(documentRef, 'p', 'masters-holdings-meta', '공시 원문을 증권별로 모은 자료입니다. 회사 연결(티커·업종)과 분할·합병 같은 기업 행동은 아직 확인 전이라, 확인된 항목만 종목 분석에 씁니다.') // P1591 (L10)
  );
  if (scaleReviewed) section.appendChild(element(documentRef, 'p', 'masters-holdings-meta masters-scale-review', describeValueScaleCarryover()));
  const metrics = element(documentRef, 'div', 'masters-normalization-metrics');
  [
    ['이 운용사 보유 증권 수', String(managerCusips.size)],
    ['공시된 분기 수', String(periods.size)],
    ['증권·유형별 묶음', String(records.length)],
    ['분기별 공시 행', String(managerPeriodRows)],
    ['확인할 점이 있는 묶음', String(reviewQueue.length)],
    ['전체 수집 자료 (모든 운용사)', `${aggregateArtifact?.coverage?.aggregateRecords ?? '—'}개 묶음, ${aggregateArtifact?.coverage?.periods ?? '—'}개 분기, 확인할 점 ${aggregateArtifact?.coverage?.reviewQueue ?? '—'}개 묶음`]
  ].forEach(([label, value]) => metrics.appendChild(createMetric(documentRef, label, value)));
  section.appendChild(metrics);
  const top = records
    .map((record) => ({ record, latest: record.periods?.at(-1) || null }))
    .sort((a, b) => (Number(b.latest?.valueUsd) || 0) - (Number(a.latest?.valueUsd) || 0))
    .slice(0, 10);
  if (top.length) {
    section.appendChild(createTable(documentRef, ['발행사(신고 원문)', 'CUSIP(증권 코드)', '최근 보고 분기', '신고 가치', '보고된 분기 수', '확인할 점'], top, ({ record, latest }) => {
      const tr = element(documentRef, 'tr', '');
      const values = [
        (record.issuerNames || []).join(', ') || '회사명 표기 없음',
        record.cusipNormalized || '—',
        latest?.reportPeriod || '—',
        latest && !scaleReviewed ? formatReportedValue(latest.valueUsd) : '—',
        String(record.periodCount || 0),
        record.reviewFlags?.length ? record.reviewFlags.map((flag) => REVIEW_FLAG_WORDS[flag] || flag).join(', ') : '없음'
      ];
      values.forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
      return tr;
    }, 'masters-issuer-aggregate-table masters-holdings-table'));
  }
  const aggregateMeta = element(documentRef, 'p', 'masters-holdings-meta', `종목별 분기 합산, 기준일 ${aggregateArtifact?.reviewedAt || '확인 필요'}, 보고 분기 ${scope.reportPeriods.length}개. 종목 코드·업종은 공식 증권 원장과 대조한 뒤에만 붙입니다.`);
  aggregateMeta.title = `집계 상태 ${aggregateArtifact?.status || 'NOT_CONNECTED'}, manager=${scope.managerId || '—'}, 집계키 ${scope.aggregationKey}`;
  section.appendChild(aggregateMeta);
  return section;
}

// P1591 (L10): review codes in reader words.
const REVIEW_FLAG_WORDS = Object.freeze({ ISSUER_NAME_VARIATION: '신고마다 회사명 표기가 다름', TITLE_OF_CLASS_VARIATION: '증권 종류 표기가 다름', SHARE_TYPE_VARIATION: '수량 단위가 다름', PUT_CALL_REVIEW: '옵션 포함', CUSIP_FORMAT_REVIEW: '증권 코드 형식 확인 필요' });

export function createFilingArtifact(documentRef, filingMeta, holdingMeta) {
  const filing = filingMeta?.latestFiling || holdingMeta?.latestFiling;
  const artifact = element(documentRef, 'div', 'masters-filing-artifact');
  artifact.append(
    element(documentRef, 'strong', '', filing ? 'SEC 공시 메타데이터 검증 완료' : 'SEC 공시 메타데이터 확인 필요'),
    element(documentRef, 'p', '', filing ? `CIK ${filingMeta?.cik || holdingMeta?.cik || '—'}, ${filing.form}, 보고분기 ${filing.periodOfReport}, 제출 ${filing.filedAt}` : `CIK ${filingMeta?.cik || holdingMeta?.cik || '확인 필요'}, ${filingMeta?.status || 'PENDING'}`)
  );
  if (!filing) return artifact;
  const links = element(documentRef, 'div', 'masters-filing-links');
  const addLink = (label, url) => {
    if (!url) return;
    const link = element(documentRef, 'a', 'masters-source-link', label);
    applySafeExternalLink(link, url);
    links.appendChild(link);
  };
  addLink('SEC filing index', filing.indexUrl);
  addLink('Information table XML', filing.informationTableXml);
  addLink('Primary document', filing.primaryDocumentUrl || filing.primaryDocumentXml || holdingMeta?.latestFiling?.primaryDocumentUrl || holdingMeta?.latestFiling?.primaryDocumentXml);
  addLink('이전 분기 정보표', filingMeta?.priorFiling?.informationTableXml);
  artifact.appendChild(links);
  return artifact;
}

export function createPrinciplesView(documentRef, manager, principlesArtifact) {
  const section = element(documentRef, 'section', 'masters-principles-view masters-holdings-section');
  const profile = principlesArtifact?.profiles?.find((item) => item.managerId === manager.id);
  section.append(
    element(documentRef, 'h3', 'masters-holdings-title', '공식 원칙과 관찰 패턴'),
    // Codex browser audit H102: "not connected" showed while the principles file was still loading, so a profile
    // that has official principles looked empty on first visit. Loading, absent and present are three states.
    element(documentRef, 'p', 'masters-holdings-meta', profile
      ? '공식 자료에서 확인되는 원칙과 공개 13F에서 관찰되는 패턴을 분리해 표시합니다.'
      : !principlesArtifact
        ? '공식 원칙 자료를 불러오는 중입니다. 그동안 전략 분류만 표시합니다.'
        : '이 운용사의 공식 원칙 원고는 아직 정리되지 않았습니다. 아래는 전략 분류이며, 본인의 직접 발언으로 해석하지 않습니다.')
  );
  const principles = profile?.statedPrinciples || [
    { title: '전략 분류', summary: manager.strategyProfile?.approach || manager.style || '분류 확인 필요' },
    { title: '관찰 기간', summary: manager.strategyProfile?.horizon || '기간 확인 필요' },
    { title: '주요 수단', summary: manager.strategyProfile?.instrumentFocus || '수단 확인 필요' },
    { title: '위험 성격', summary: manager.strategyProfile?.riskStyle || '위험 성격 확인 필요' }
  ];
  const list = element(documentRef, 'div', 'masters-principles-list');
  principles.forEach((principle) => {
    const card = element(documentRef, 'article', 'masters-principle-card');
    card.append(element(documentRef, 'strong', '', principle.title), element(documentRef, 'p', '', principle.summary));
    list.appendChild(card);
  });
  section.appendChild(list);
  if (profile?.observedHoldingsPatterns?.length) {
    section.appendChild(element(documentRef, 'h4', 'masters-holdings-title', '공개 보유에서 관찰되는 패턴'));
    const observed = element(documentRef, 'ul', 'masters-principles-limitations');
    profile.observedHoldingsPatterns.forEach((item) => observed.appendChild(element(documentRef, 'li', '', item)));
    section.appendChild(observed);
  }
  const limits = profile?.limitations || [manager.teachingUse || '교육용 전략 분류', '현재 종목 추천이나 성과 예측으로 사용하지 않습니다.'];
  const limitationList = element(documentRef, 'ul', 'masters-principles-limitations');
  limits.forEach((item) => limitationList.appendChild(element(documentRef, 'li', '', item)));
  section.appendChild(limitationList);
  if (profile?.sourceUrl) {
    const link = element(documentRef, 'a', 'masters-source-link', `${profile.sourceName || '공식 자료'}, 검토 ${profile.reviewedAt || principlesArtifact.reviewedAt}`);
    applySafeExternalLink(link, profile.sourceUrl);
    section.appendChild(link);
  }
  return section;
}

export function createInvestorCompareView(documentRef, selectedIds, registry, holdingManagers, rowsByManager, lookup = PLAIN_LOOKUP) {
  const section = element(documentRef, 'section', 'masters-compare-view masters-holdings-section');
  section.append(
    element(documentRef, 'h3', 'masters-holdings-title', '2~4명 공개 신고 비교'),
    element(documentRef, 'p', 'masters-holdings-meta', '같은 보고분기의 SEC 신고 행만 비교합니다. 공통 보유나 같은 방향 변화는 추천·공모·현재 포지션의 증거가 아닙니다.')
  );
  const ids = selectedIds.slice(0, 4);
  if (ids.length < 2) {
    // P1592 (F36): name who is already picked — the comparison list is separate from the manager being read.
    const picked = ids.map((id) => registry.find((item) => item.id === id)?.name || id);
    section.appendChild(element(documentRef, 'div', 'masters-empty-state', picked.length
      ? `지금 ${picked.join(', ')} 1명을 골랐습니다. 다른 운용사 상세에서 “비교에 추가”를 눌러 1명 이상 더 고르면 비교합니다(최대 4명).`
      : '상세 상단의 “비교에 추가”를 눌러 2~4명을 선택하세요.'));
    return section;
  }
  const metrics = element(documentRef, 'div', 'masters-metric-grid');
  const reportPeriods = [];
  ids.forEach((id) => {
    const manager = registry.find((item) => item.id === id);
    const holding = holdingManagers.find((item) => item.id === id);
    const reportPeriod = holding?.verification?.reportPeriod || null;
    if (reportPeriod) reportPeriods.push(reportPeriod);
    const rowCount = readNumber(holding?.verification?.fullRowCount) != null ? `${readNumber(holding.verification.fullRowCount)}행` : '행 확인 필요';
    metrics.appendChild(createMetric(documentRef, manager?.name || id, `${reportPeriod || '분기 확인 필요'}, Top10 ${formatPercent(holding?.verification?.top10ConcentrationPct)}, ${rowCount}`));
  });
  section.appendChild(metrics);
  const uniquePeriods = [...new Set(reportPeriods)];
  if (reportPeriods.length !== ids.length || uniquePeriods.length !== 1) {
    const periodSummary = ids.map((id) => {
      const manager = registry.find((item) => item.id === id);
      const holding = holdingManagers.find((item) => item.id === id);
      return `${manager?.name || id} ${holding?.verification?.reportPeriod || '분기 미확인'}`;
    }).join(', ');
    section.appendChild(element(documentRef, 'div', 'masters-empty-state masters-compare-period-mismatch', `선택 운용사의 보고분기가 일치하지 않아 공통 보유 비교를 보류합니다. ${periodSummary}`));
    return section;
  }
  const commonPeriod = uniquePeriods[0];
  // One key shape for shard rows and bootstrap rows (their stored `key` strings differ in layout).
  const keyOf = (row) => `${String(row.cusipNormalized || row.cusip || '').toUpperCase()}|${row.putCall || ''}|${row.shareType || ''}`;
  const missing = ids.filter((id) => !(rowsByManager.get(id)?.holdings || []).some((row) => row.reportPeriod === commonPeriod));
  const scopeOf = (id) => (rowsByManager.get(id)?.basis === 'top' ? '상위 보유' : `불러온 ${(rowsByManager.get(id)?.holdings || []).length}행`);
  const nameOf = (id) => registry.find((item) => item.id === id)?.name || id;
  if (missing.length) {
    section.appendChild(element(documentRef, 'div', 'masters-empty-state', `비교 미완료 — ${missing.map(nameOf).join(', ')}의 ${commonPeriod} 보유 행을 아직 불러오지 못했습니다. 공통 보유가 없다는 뜻이 아닙니다.`));
    return section;
  }
  const rowMaps = ids.map((id) => new Map((rowsByManager.get(id)?.holdings || [])
    .filter((row) => row.reportPeriod === commonPeriod)
    .map((row) => [keyOf(row), row])));
  const commonKeys = rowMaps.length ? [...rowMaps[0].keys()].filter((key) => rowMaps.every((map) => map.has(key))) : [];
  section.appendChild(element(documentRef, 'p', 'masters-holdings-meta', `비교 범위: ${ids.map((id) => `${nameOf(id)} ${scopeOf(id)}`).join(', ')} — 범위 밖의 보유는 비교에 들어가지 않습니다.`));
  const partialIds = ids.filter((id) => {
    const full = Number(holdingManagers.find((item) => item.id === id)?.verification?.fullRowCount);
    return rowsByManager.get(id)?.basis === 'top' || (Number.isFinite(full) && (rowsByManager.get(id)?.holdings || []).length < full);
  });
  if (commonKeys.length) {
    section.appendChild(element(documentRef, 'h3', 'masters-holdings-title', `함께 보유한 증권 ${commonKeys.length}개${commonKeys.length > 25 ? ', 상위 25개 표시' : ''}${partialIds.length ? `, 부분 비교(${withTopicParticle(partialIds.map(nameOf).join(', '))} 신고 전체가 아닌 불러온 행만)` : ''}`));
    const common = commonKeys.slice(0, 25).map((key) => ({ key, rows: rowMaps.map((map) => map.get(key)) }));
    section.appendChild(createTable(documentRef, ['발행사', 'CUSIP(증권 코드)', '함께 보유한 운용사 수', '보고 분기'], common, ({ rows }) => {
      const tr = element(documentRef, 'tr', '');
      tr.appendChild(issuerCell(documentRef, rows[0] || {}, lookup));
      [rows[0]?.cusipNormalized || rows[0]?.cusip || '—', String(rows.length), [...new Set(rows.map((row) => row.reportPeriod).filter(Boolean))].join(', ')].forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
      return tr;
    }));
  } else {
    section.appendChild(element(documentRef, 'div', 'masters-empty-state', '위 비교 범위 안에서는 같은 증권(CUSIP)을 함께 보유한 종목이 없습니다. 운용사 상세에서 전체 보유를 불러오면 범위가 넓어집니다.'));
  }
  return section;
}

// 2026-10-14 audit: the card had numbers only. One visual — the top holdings' share of the quarter's reported
// value, from the rows already loaded for the card (value / parsed total; the sum equals the published top-10
// concentration). Withheld with the totals when the cover and rows disagree or the value scale is under review.
export function createTopWeightBars(documentRef, manager, holdingMeta, rows, withheld, lookup = PLAIN_LOOKUP) {
  const verification = holdingMeta?.verification || {};
  const total = Number(verification.parsedValueTotal);
  const period = verification.reportPeriod || null;
  const top = (rows || [])
    .filter((row) => (!period || row.reportPeriod === period) && readNumber(row.value) > 0)
    .sort((a, b) => (Number(a.rank) || 0) - (Number(b.rank) || 0) || Number(b.value) - Number(a.value))
    .slice(0, 10);
  if (withheld || !(total > 0) || top.length < 2) return null;
  ensureFrameStyle(documentRef);
  ensureMastersExtraStyle(documentRef);
  // v58.56 (#4): the exact ticker leads the label (the part an ellipsis keeps), then the readable name.
  const baseLabel = (row) => { const ticker = lookup.tickerOf(row); const name = row.issuer ? lookup.nameOf(row) : row.cusipNormalized || '—'; const tag = shareClassTag(row.titleOfClass); return `${ticker ? `${ticker}, ` : ''}${name}${tag && !/\bclass\b/i.test(name) ? `, ${tag}` : ''}${row.putCall ? ` ${row.putCall}` : ''}`; };
  const repeated = new Set(top.map(baseLabel).filter((label, index, all) => all.indexOf(label) !== index));
  // Two share classes of one issuer (e.g. class A and C) are separate rows; name the class so they read apart.
  // v57.92: the full class title ("CAP STK CL A") was cut by the label ellipsis on a tablet, so both Alphabet rows read
  // "ALPHABET INC · CAP STK…"; the class letter is kept short ("A주") so the part that tells them apart stays visible.
  const classTag = (title) => shareClassTag(title) || title;
  // Screen review #28 (2026-11-04): on a phone the name after the ticker was cut ('AXP, American Expres…'); the bar
  // shows the ticker alone (class letter and put/call kept) and the full name moves to the hover title and aria-label.
  const tickerLabel = (row) => { const ticker = lookup.tickerOf(row); if (!ticker) return null; const tag = repeated.has(baseLabel(row)) && row.titleOfClass ? ` ${classTag(row.titleOfClass)}` : ''; return `${ticker}${tag}${row.putCall ? ` ${row.putCall}` : ''}`; };
  const weights = top.map((row) => ({ label: tickerLabel(row) || (repeated.has(baseLabel(row)) && row.titleOfClass ? `${baseLabel(row)}, ${classTag(row.titleOfClass)}` : baseLabel(row)), fullLabel: repeated.has(baseLabel(row)) && row.titleOfClass ? `${baseLabel(row)}, ${row.titleOfClass}` : baseLabel(row), pct: Number(row.value) / total * 100 }));
  const max = Math.max(...weights.map((item) => item.pct));
  const sum = weights.reduce((acc, item) => acc + item.pct, 0);
  const section = element(documentRef, 'section', 'masters-weight-bars');
  section.append(
    element(documentRef, 'h3', 'masters-holdings-title', `상위 ${weights.length}개 보유 비중`),
    element(documentRef, 'p', 'masters-holdings-meta', `${period ? `${period} 신고 가치 기준` : '신고 가치 기준'}, 합계 ${sum.toFixed(1)}% — 나머지 ${Math.max(0, 100 - sum).toFixed(1)}%는 그 밖의 보유입니다.`)
  );
  const bars = element(documentRef, 'div', 'af-bars');
  bars.setAttribute('role', 'img');
  bars.setAttribute('aria-label', `${manager.name} 상위 보유 비중: ${weights.map((item) => `${item.fullLabel} ${item.pct.toFixed(1)}%`).join(', ')}`);
  weights.forEach((item) => {
    const row = element(documentRef, 'div', 'af-bar-row');
    const label = element(documentRef, 'span', 'af-bar-label', item.label);
    label.title = item.fullLabel;
    const track = element(documentRef, 'div', 'af-bar-track');
    const fill = element(documentRef, 'span', 'af-bar-fill');
    fill.style.width = `${Math.max(1, item.pct / max * 100).toFixed(1)}%`;
    fill.style.left = '0';
    track.appendChild(fill);
    row.append(label, track, element(documentRef, 'span', 'af-bar-value', `${item.pct.toFixed(1)}%`));
    bars.appendChild(row);
  });
  section.appendChild(bars);
  return section;
}

