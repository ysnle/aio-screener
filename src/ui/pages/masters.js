import { STYLE_FRAMES, groupManagersByStyle } from '../../domain/masters/style-frames.js';
import { thirteenFStale } from '../../domain/masters/filing-deadline.js';
import { renderManagersPage } from '../knowledge/managers-view.js';
import { createResourceBag } from '../../app/lifecycle.js';
import { navigateKnowledgeTarget, parseKnowledgeRouteState, parseKnowledgeTargetContext, pushKnowledgeRouteState, replaceKnowledgeRouteState } from '../../app/knowledge-route-state.js';
import { artifactUrl, loadArtifactUrl } from '../../data/artifact-registry.js';
import { detectValueScaleSuspects, withholdSuspectValues, withholdManagerValues, managersUnderScaleReview, describeValueScaleReview } from '../../domain/masters/value-scale.js';
import { applySafeExternalLink } from '../knowledge/safe-external-link.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { consumeResearchHandoff } from '../../app/research-handoff.js';
import { MASTER_REGISTRY, buildManagerRegistry, deriveCoverageSummary, formatReportedValue, formatCompactUsd, formatScale, formatPercent, summarizeLatestChange, formatQuarterLabel } from '../../domain/masters/holdings-format.js';
export { displayActionOf, isPartialAmendmentPeriod } from '../../domain/masters/holdings-format.js'; // v57.60: same page exports as before
import { VIEW_LABELS, element, button, createMetric, ensureMastersExtraStyle, createSecurityLookup, PLAIN_LOOKUP, tickerChip, createChangeSummary, createOwnershipEvents, fullManagersLabel, createTopHoldingTable, createChangeLedger, createFullHoldingsView, createRowPreviewView, createSectorView, createReferenceSectorView, createQuarterView, createIssuerAggregateView, createFilingArtifact, createPrinciplesView, createInvestorCompareView, createTopWeightBars } from './masters-views.js';
export { createSecurityLookup, shareClassTag } from './masters-views.js'; // v59.70: moved with the view builders

const REVIEWED_AT = '2026-08-16';
const FILINGS_URL = artifactUrl('masters/filings.json');
const HOLDINGS_URL = artifactUrl('masters/holdings-summary.json');
const SECURITY_MASTER_URL = artifactUrl('masters/security-master.json');
const SECURITY_MASTER_REFERENCE_URL = artifactUrl('masters/security-master-reference.json');
const HISTORY_INDEX_URL = artifactUrl('masters/history-index.json');
const MANAGER_CATALOG_URL = artifactUrl('masters/manager-catalog.json');
const ROW_PREVIEWS_URL = artifactUrl('masters/manager-row-previews.json');
const FILING_DISCOVERY_URL = artifactUrl('masters/filing-discovery.json');
const MANAGER_PRINCIPLES_URL = artifactUrl('masters/manager-principles.json');
const TICKER_INDEX_REFERENCE_URL = artifactUrl('masters/ticker-index-reference.json');
const TICKER_INDEX_LOAD_OPTIONS = Object.freeze({ timeoutMs: 8000 });

function statusLabel(status) {
  return ({
    VERIFIED_ROWS: '행 검증 완료',
    VERIFIED_METADATA: '공시 메타데이터 확인',
    CURRENT_REFERENCE: '최신 연결 기준',
    STALE_REFERENCE: '최신성 지연 참고',
    NOTICE_FILED: '13F 통지서 제출',
    CURRENT_ROWS: '최신 행 연결',
    STALE_OR_MISSING_ROWS: '최신 자료 맞춰 보는 중',
    BLOCKED: '원문 확인 안 됨',
    METHOD_ONLY: '방법론 전용',
    PENDING_SEC_ROW_IMPORT: '불러오는 중',
    SEC_ROW_PREVIEW: 'SEC 행 미리보기',
    UNVERIFIED_DISCOVERY: '발견 단서·미검증',
    PENDING: '준비 중'
  })[status] || status || '확인 필요';
}

function matches(manager, query) {
  if (!query) return true;
  return [manager.name, manager.filer, manager.style, manager.type, manager.status, manager.cik, manager.managerCategory, manager.scaleTier, manager.operator?.names?.join(' '), manager.strategyProfile?.approach, manager.strategyProfile?.horizon].join(' ').toLowerCase().includes(query);
}

function formatOperator(manager) {
  const names = manager.operator?.names || [];
  const roles = manager.operator?.roles || [];
  return names.length ? names.map((name, index) => roles[index] ? `${name} (${roles[index]})` : name).join(', ') : '운영 책임자 확인 필요';
}

function createManagerCard(documentRef, manager, selected, statusOverride = manager.status, freshnessStatus = null, reportPeriod = null, holdingMeta = null) {
  const card = button(documentRef, `masters-manager-card${selected ? ' is-selected' : ''}`, '', 'select-manager', manager.id);
  card.setAttribute('aria-pressed', selected ? 'true' : 'false');
  card.setAttribute('aria-label', `${manager.name} ${reportPeriod ? `${reportPeriod} 13F` : statusLabel(statusOverride)} 보기`);
  const stateText = manager.type === 'METHOD_ONLY'
    ? '투자 방법론'
    : `${reportPeriod || '공시 연결 중'}${freshnessStatus === 'STALE_REFERENCE' ? ', 최신 제출 공백' : ', 13F'}`;
  card.append(
    element(documentRef, 'strong', 'masters-manager-name', manager.name),
    element(documentRef, 'span', 'masters-manager-filer', manager.filer),
    element(documentRef, 'span', 'masters-manager-style', manager.style),
    element(documentRef, 'span', 'masters-manager-operator', `운영 ${formatOperator(manager)}`),
    element(documentRef, 'span', 'masters-manager-profile', [manager.scaleTier, manager.strategyProfile?.approach].filter(Boolean).join(', ') || '전략·규모 분류 확인 필요'),
    element(documentRef, 'span', 'masters-manager-scale', manager.scaleMetric?.label || '공식 규모값 확인 필요'),
    element(documentRef, 'span', `masters-manager-state${freshnessStatus === 'STALE_REFERENCE' ? ' is-stale' : ''}`, stateText),
    element(documentRef, 'span', 'masters-manager-profile', holdingMeta?.verification?.fullRowCount != null ? `신고 행 ${holdingMeta.verification.fullRowCount}개, Top 10 ${formatPercent(holdingMeta.verification.top10ConcentrationPct)}` : '전체 행 대사 대기'),
    element(documentRef, 'span', 'masters-manager-state', holdingMeta?.verification?.comparisonActionCounts ? summarizeLatestChange(holdingMeta.verification.comparisonActionCounts) : statusLabel(manager.rowFreshnessStatus || manager.noticeStatus || statusOverride))
  );
  return card;
}

function createTickerLookup(documentRef, tickerIndex, registry, query, loadState = 'loading', summaryRows = [], valueScale = new Map()) {
  ensureMastersExtraStyle(documentRef);
  const section = element(documentRef, 'section', 'masters-ticker-lookup');
  section.dataset.mastersTickerLookup = 'reference-only';
  section.dataset.mastersTickerLoadState = tickerIndex ? 'ready' : loadState;
  // v59.55 (alignment pass): the how-to sentence left; the field's placeholder and label say what it does.
  const label = element(documentRef, 'label', 'masters-search');
  label.appendChild(element(documentRef, 'span', 'masters-sr-only', '종목으로 찾기 (티커 또는 CUSIP)'));
  const input = element(documentRef, 'input', 'masters-ticker-lookup-input');
  input.type = 'search';
  input.placeholder = '예: AAPL';
  input.value = query;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', '종목으로 찾기 (티커 또는 CUSIP)');
  input.dataset.mastersAction = 'ticker-search';
  label.appendChild(input);
  section.appendChild(label);

  const body = element(documentRef, 'div', 'masters-ticker-lookup-results');
  const normalized = String(query || '').trim().toUpperCase();
  if (!tickerIndex) {
    // P1325: this branch used to be the only non-ready state, so a failed/timed-out ledger fetch left
    // '불러오는 중' on screen forever. Every non-ready state is now explicit and a failure is retryable.
    if (loadState === 'error') {
      const failure = element(documentRef, 'p', 'masters-empty-state', '종목 목록을 불러오지 못했습니다. 잠시 뒤 다시 시도하세요. 종목 찾기 없이도 위 대가 카드와 공시 원문은 그대로 사용할 수 있습니다.');
      failure.setAttribute('role', 'alert');
      body.append(failure, button(documentRef, 'aio-btn-table masters-ticker-lookup-retry', '종목 목록 다시 불러오기', 'retry-ticker-index', 'tickerIndex'));
    } else if (loadState === 'idle') {
      // P1330: the ledger is not part of the initial Masters payload (artifact budget); it loads on
      // first focus/typing or the "종목으로 역조회" button, so this idle state is never a spinner.
      // 2026-10-14 audit: the idle box only repeated the placeholder example, so idle shows nothing.
    } else {
      const pending = element(documentRef, 'p', 'masters-empty-state', '종목 목록을 불러오는 중입니다.');
      pending.setAttribute('role', 'status');
      body.appendChild(pending);
    }
  } else if (tickerIndex.status !== 'REFERENCE_ONLY') {
    body.appendChild(element(documentRef, 'p', 'masters-empty-state', '종목 목록의 상태를 확인할 수 없어 종목 찾기를 보류합니다.'));
  } else if (!normalized) {
    } else {
    const matches = (tickerIndex.records || []).filter((record) => [record.tickerReference, ...(record.issuerReferences || []), ...(record.cusips || [])].join(' ').toUpperCase().includes(normalized));
    if (!matches.length) {
      body.appendChild(element(documentRef, 'p', 'masters-empty-state', '이 화면의 운용사 가운데 일치하는 보유를 찾지 못했습니다. 다른 기관이 보유하지 않았다는 뜻은 아닙니다.'));
    } else {
      const registryById = new Map(registry.map((manager) => [manager.id, manager]));
      matches.slice(0, 6).forEach((record) => {
        const card = element(documentRef, 'article', 'masters-ticker-lookup-card');
        card.dataset.tickerReference = record.tickerReference;
        card.append(
          element(documentRef, 'strong', 'masters-ticker-lookup-symbol', record.tickerReference),
          element(documentRef, 'span', 'masters-ticker-lookup-issuer', (record.issuerReferences || []).join(', ') || '발행인명 확인 필요'),
          element(documentRef, 'span', 'masters-ticker-lookup-meta', `CUSIP ${record.cusips?.join(', ') || '확인 필요'}`)
        );
        // v57.50 I12: from a holder back to the stock itself (the reference ticker the ledger already names).
        if (/^[A-Z][A-Z0-9.-]{0,9}$/.test(String(record.tickerReference || ''))) {
          const open = element(documentRef, 'button', 'aio-btn-table masters-ticker-lookup-open', `${record.tickerReference} 종목 개요`);
          open.type = 'button';
          open.dataset.action = 'showTicker';
          open.dataset.arg = record.tickerReference;
          card.appendChild(open);
        }
        // Codex review 2026-10-05: the same manager appeared on several raw rows (separate filing lines,
        // classes, puts/calls) while the question is "who holds it". One line per manager: the latest
        // period's shares and value summed over direct holdings, with option positions named separately
        // (their share counts are underlying exposure, never added to holdings). Raw rows open on demand.
        // Codex browser audit H98: NVDA found Fisher, Tepper and Burry only, while BlackRock's and DFA's top
        // holdings on this same page held NVDA. The reference index covers a subset of filers; the published
        // top holdings of every filer (same CUSIP, same quarter) are merged in so one lookup covers both sources.
        const recordCusips = new Set((record.cusips || []).map((cusip) => String(cusip).toUpperCase()));
        // P1522: index rows are filed amounts too; a manager under scale review is withheld here as well, in any period.
        const indexedRows = withholdManagerValues(Array.isArray(record.rows) ? record.rows : [], managersUnderScaleReview(valueScale));
        const indexedKeys = new Set(indexedRows.map((row) => `${row.managerId}|${row.reportPeriod}|${row.putCall || ''}`));
        const extraRows = (summaryRows || []).filter((row) => recordCusips.has(String(row.cusipNormalized || row.cusip || '').toUpperCase()) && !indexedKeys.has(`${row.managerId}|${row.reportPeriod}|${row.putCall || ''}`));
        const allRows = [...indexedRows, ...extraRows];
        const byManager = new Map();
        allRows.forEach((row) => {
          const list = byManager.get(row.managerId) || [];
          list.push(row);
          byManager.set(row.managerId, list);
        });
        const summaries = [...byManager.entries()].map(([managerId, list]) => {
          const period = list.map((row) => row.reportPeriod).sort().at(-1);
          const latest = list.filter((row) => row.reportPeriod === period);
          const direct = latest.filter((row) => !row.putCall);
          const options = latest.filter((row) => row.putCall);
          return { managerId, period, latest, shares: direct.reduce((sum, row) => sum + (Number(row.shares) || 0), 0), value: direct.reduce((sum, row) => sum + (Number(row.value) || 0), 0), direct: direct.length, options };
        }).sort((a, b) => (b.value || 0) - (a.value || 0) || b.shares - a.shares);
        const rows = element(documentRef, 'ul', 'masters-ticker-lookup-rows');
        // v58.63 (architecture audit UI-05): each filer's latest quarter differs (Pershing 2026-03-31 beside others' 06-30), and
        // one median across quarters flagged a normal price change as "다른 신고보다 12.6% 낮음". The value-per-share check
        // compares filers of the same reportPeriod only, and needs three of them.
        const impliedOf = (summary) => (summary.shares > 0 && summary.value > 0 && !summary.latest.some((row) => row.valueScaleStatus === 'SCALE_REVIEW') ? summary.value / summary.shares : null);
        const medianByPeriod = new Map();
        for (const period of new Set(summaries.map((summary) => summary.period))) {
          const prices = summaries.filter((summary) => summary.period === period).map(impliedOf).filter((value) => value != null).sort((x, y) => x - y);
          medianByPeriod.set(period, prices.length >= 3 ? prices[Math.floor(prices.length / 2)] : null);
        }
        let priceGaps = 0;
        summaries.forEach((summary) => {
          const manager = registryById.get(summary.managerId);
          const item = element(documentRef, 'li', 'masters-ticker-lookup-row');
          item.dataset.lookupManager = summary.managerId;
          const optionText = summary.options.length ? `, 옵션 ${summary.options.map((row) => `${row.putCall === 'Put' ? '풋' : '콜'} ${Number(row.shares || 0).toLocaleString('en-US')}주 기준`).join(', ')}` : '';
          const withheldValue = summary.latest.some((row) => row.valueScaleStatus === 'SCALE_REVIEW');
          // F38: for the same stock and quarter the filed value per share should agree across filers. A filer whose
          // implied price is more than 1% off the others is marked, so the gap is visible without a column of prices.
          const implied = !withheldValue && summary.shares > 0 && summary.value > 0 ? summary.value / summary.shares : null;
          const medianImplied = medianByPeriod.get(summary.period) || null;
          const gap = implied && medianImplied ? implied / medianImplied - 1 : 0;
          const perShare = Math.abs(gap) > 0.01 ? ` (주당 약 $${implied.toFixed(2)}, 같은 분기 다른 신고보다 ${Math.abs(gap * 100).toFixed(1)}% ${gap < 0 ? '낮음' : '높음'})` : '';
          if (perShare) priceGaps += 1;
          const holding = summary.direct ? `${summary.shares.toLocaleString('en-US')}주, ${withheldValue ? '금액 단위 확인 중' : formatReportedValue(summary.value)}${perShare}` : '직접 보유 없음';
          const detail = element(documentRef, 'details', 'masters-ticker-lookup-detail');
          detail.appendChild(element(documentRef, 'summary', '', `${manager?.name || summary.managerId}, ${summary.period}, ${holding}${optionText}`));
          const raw = element(documentRef, 'ul', 'masters-ticker-lookup-raw');
          // F39: several rows for one stock are the filer's own split (by manager or discretion), not duplicates.
          if (summary.latest.length > 1) raw.appendChild(element(documentRef, 'li', 'masters-holdings-meta', `원문 ${summary.latest.length}행은 같은 종목을 운용 주체·재량 구분별로 나눠 신고한 것이며, 위 합계는 이 행들을 더한 값입니다.`));
          summary.latest.forEach((row) => {
            const line = element(documentRef, 'li', '');
            // P1592 (F39): a row without a filing URL says so instead of a link-looking label that goes nowhere.
            const source = row.sourceUrl ? element(documentRef, 'a', 'masters-source-link', 'SEC 원문') : element(documentRef, 'span', 'masters-holdings-meta', '원문 링크 없음');
            if (row.sourceUrl) applySafeExternalLink(source, row.sourceUrl);
            line.append(element(documentRef, 'span', '', `${row.titleOfClass || '보통주'}${row.putCall ? `, ${row.putCall === 'Put' ? '풋옵션' : '콜옵션'}` : ''}, ${Number(row.shares || 0).toLocaleString('en-US')}주, ${formatReportedValue(row.value)} `), source);
            raw.appendChild(line);
          });
          detail.appendChild(raw);
          item.appendChild(detail);
          rows.appendChild(item);
        });
        card.appendChild(rows);
        card.appendChild(element(documentRef, 'span', 'masters-ticker-lookup-count', `운용사 ${summaries.length}곳, 원문 ${allRows.length}행 — 검색 범위: 참조 원장과 각 운용사의 상위 10개 보유. 그 밖의 보유는 운용사 상세에서 확인합니다.${priceGaps ? ' 주당 값이 다른 신고와 어긋나는 운용사는 원문 신고 가치를 그대로 옮긴 것이며, 정정 신고 여부를 원문에서 확인해야 합니다.' : ''}`));
        body.appendChild(card);
      });
    }
  }
  body.appendChild(element(documentRef, 'p', 'masters-ticker-lookup-boundary', '분기 말 기준으로 신고된 보유라 지금 보유 여부와 매매 시점은 알 수 없습니다.'));
  section.appendChild(body);
  return section;
}

function createMastersArrivalContext(documentRef, context, onReturn) {
  if (!context || context.routeId !== 'masters') return null;
  const block = element(documentRef, 'aside', 'masters-arrival-context');
  block.setAttribute('aria-label', '개념·분석에서 이어 읽기');
  block.append(
    element(documentRef, 'span', 'masters-eyebrow', '개념·분석에서 이어 읽기'),
    element(documentRef, 'strong', 'masters-arrival-title', '시장의 기대를 기관의 공개 보유 변화와 대조합니다.'),
    element(documentRef, 'p', 'masters-catalog-copy', '13F는 분기 말의 지연된 스냅샷입니다.')
  );
  if (context.returnContext?.route) {
    const back = element(documentRef, 'button', 'masters-route-button is-secondary', '읽던 이야기로 돌아가기');
    back.type = 'button';
    back.addEventListener('click', onReturn);
    block.appendChild(back);
  }
  return block;
}

function createCatalogCoverage(documentRef, catalog, registry, holdings, previews, discovery, principlesArtifact, securityMaster) {
  if (!catalog) return null;
  const summary = deriveCoverageSummary(registry, catalog, holdings, previews, discovery, principlesArtifact, securityMaster);
  const section = element(documentRef, 'details', 'masters-catalog-coverage');
  section.dataset.mastersCatalogState = summary.catalogStatus;
  section.dataset.mastersCoverageState = summary.state;
  section.dataset.mastersDiscoveryState = summary.discoveryState;
  section.dataset.mastersRowCoverageState = summary.rowCoverageState;
  section.dataset.mastersEnrichmentState = summary.enrichmentState;
  section.dataset.mastersCurrentFull = String(summary.currentFull);
  section.dataset.mastersStaleFull = String(summary.staleFull);
  section.dataset.mastersPreviewOnly = String(summary.previewOnly);
  section.dataset.mastersMetadataOnly = String(summary.metadataOnly);
  section.dataset.mastersMethodOnly = String(summary.methodOnly);
  section.dataset.mastersOfficialPrinciples = String(summary.officialPrinciples);
  section.dataset.mastersVerifiedSecurityRecords = String(summary.verifiedSecurityRecords);
  const coverage = catalog.coverage || {};
  const discoveryAsOf = String(discovery?.reviewedAt || discovery?.generatedAt || '기준일 확인 필요').slice(0, 10);
  section.append(
    element(documentRef, 'summary', 'masters-catalog-title', `데이터 범위와 검증 상태 보기, SEC 발견 ${summary.discoveryState === 'complete' ? '전체' : '부분'}, 13F 행 ${summary.rowCoverageState === 'complete' ? '전체' : '부분'}, 보강 ${summary.enrichmentState === 'complete' ? '전체' : '부분'}`),
    element(documentRef, 'p', 'masters-catalog-copy masters-coverage-classification', `현재 분류 ${summary.profiles}개: 최신 전체 행 ${summary.currentFull}, 지연 전체 행 ${summary.staleFull}, 원문 미리보기만 ${summary.previewOnly}, 메타데이터만 ${summary.metadataOnly}, 방법론 전용 ${summary.methodOnly}`),
    element(documentRef, 'p', 'masters-catalog-boundary masters-latest-quarter-boundary', `${summary.latestPeriod || '최신분기 확인 필요'} 기준 13F 신고주체 ${summary.filers}개 중 ${summary.latestPeriodMissing}개는 최신분기 전체 행이 연결되지 않았습니다. 프로필·CIK·과거 공시 링크가 있어도 최신 보유 데이터 완성을 뜻하지 않습니다.`),
    element(documentRef, 'p', 'masters-catalog-boundary masters-discovery-boundary', `SEC 발견 artifact 기준일 ${discoveryAsOf}: 제출주체 ${summary.discovered}/${summary.filers}, 차단/미완료 ${summary.blocked}. 이 artifact 상태는 수집 실행 결과이며 repository 변수 설정 존재 여부와 같은 뜻이 아닙니다. 최신 온라인 조회 시각은 별도로 표시되지 않습니다.`),
    element(documentRef, 'p', 'masters-catalog-boundary masters-shard-integrity-boundary', `브라우저 전체 행 원장 무결성 ${summary.shardIntegrityVerified ? '검증 완료' : '검증 미완료'}. 신고 메타데이터의 행 수와 실제 선택 로드 shard 길이가 일치할 때만 전체 행 연결로 분류합니다.`),
    element(documentRef, 'p', 'masters-catalog-boundary masters-enrichment-boundary', `공식 투자 원칙 원고 ${summary.officialPrinciples}/${summary.profiles}, 검증 issuer·ticker·sector master ${summary.verifiedSecurityRecords}개. 나머지 원칙은 catalog 전략 분류이며, 참고 섹터 분류는 검증 master로 승격하지 않습니다.`),
    element(documentRef, 'p', 'masters-catalog-copy', `SEC 메타데이터 상태 ${coverage.secMetadataVerified || 0}개, 전체 행 대사 ${fullManagersLabel(summary)}, 원문 행 미리보기 ${coverage.rowPreviewManagers || 0}개/${coverage.previewRows || 0}행`),
    element(documentRef, 'p', 'masters-catalog-boundary masters-history-boundary', `12분기 심화 이력은 우선순위 ${holdings?.historySummary?.connectedManagers || 0}/${summary.filers}개 기관에 연결되어 있습니다. 나머지 기관은 최신·직전 분기 비교까지만 제공하며 장기 이력이 있는 것처럼 확대 표시하지 않습니다.`),
    element(documentRef, 'p', 'masters-catalog-copy', '13F 신고 주체와 실제 투자 책임자는 다를 수 있습니다.'),
    element(documentRef, 'p', 'masters-catalog-boundary', `텔레그램 발견 단서 ${coverage.telegramDiscoveryLeads || coverage.discoveryLeads || 0}개는 검증 포트폴리오에 합산하지 않습니다. X 13F 검색은 ${coverage.xSearchStatus === 'UNREADABLE_BY_BROWSER_TOOL' ? '본문을 읽지 못해 소비하지 않음' : '별도 검증 필요'} 상태입니다.`)
  );
  const links = element(documentRef, 'div', 'masters-filing-links');
  const addLink = (label, url) => {
    if (!url) return;
    const link = element(documentRef, 'a', 'masters-source-link', label);
    applySafeExternalLink(link, url);
    links.appendChild(link);
  };
  addLink('SEC 13F 데이터셋', 'https://www.sec.gov/data-research/sec-markets-data/form-13f-data-sets');
  addLink('텔레그램 발견 원문', 'https://t.me/insidertracking');
  section.appendChild(links);
  return section;
}


function createDetail(documentRef, manager, onRoute, filingMeta, ownershipDiscovery, holdingMeta, compactRows, fullRows, comparisonRows, previewMeta, previewRows, state, securityMaster, referenceMaster, historyManager, historyRowsArtifact, issuerAggregates, principlesArtifact, registry, holdingManagers, rowsByManager) {
  const detail = element(documentRef, 'article', 'masters-detail-card');
  const dataStatus = holdingMeta?.status || (previewRows.length ? 'SEC_ROW_PREVIEW' : filingMeta?.status || manager.status);
  const freshnessStatus = holdingMeta?.freshnessStatus || filingMeta?.freshnessStatus || null;
  detail.append(
    element(documentRef, 'div', 'masters-eyebrow', manager.type === 'METHOD_ONLY' ? '방법론 전용 프로필' : '공개 13F 신고 보유'),
    // 2026-10-14 audit: the detail title sits directly under the page h1, so it is an h2 (same class and look).
    element(documentRef, 'h2', 'masters-detail-title', manager.name),
    element(documentRef, 'p', 'masters-detail-filer', [manager.filer && manager.filer !== manager.name ? `신고 법인 ${manager.filer}` : manager.filer, manager.style].filter(Boolean).join(', '))
  );
  // Codex review 2026-10-05: a person's philosophy and the filer's holdings are different things. The
  // filing is the entity's — several funds and portfolio managers — not one person's every decision.
  if (manager.type !== 'METHOD_ONLY' && manager.filer && manager.filer !== manager.name && !/^(BlackRock|Vanguard|Citi|Goldman|JPMorgan|State Street|Capital Group|Fidelity|T\. Rowe|Wellington|Dimensional|Millennium|Renaissance|Two Sigma|Tudor|Starboard|Trian|ValueAct|Harvard)/.test(manager.name)) {
    // v58.79: short label; the full caveat is its hover.
    detail.appendChild(Object.assign(element(documentRef, 'p', 'masters-holdings-meta masters-entity-note', '법인 전체 신고분'), { title: '보유는 위 법인 전체의 신고분이며, 모든 종목을 한 사람이 직접 골랐다는 뜻은 아닙니다.' }));
  }
  // A method-only profile has no 13F: no empty metric grid, compare toggle or filing tabs — only what exists.
  if (manager.type === 'METHOD_ONLY') {
    detail.appendChild(createPrinciplesView(documentRef, manager, principlesArtifact));
    return detail;
  }
  // 2026-10-05 리서치 라이브러리: verification badges and the how-to panel are internal; the reader sees the manager.
  void freshnessStatus;
  detail.querySelector('.masters-detail-title')?.setAttribute('tabindex', '-1');
  // v58.53 개편 v2 (5j): the quarter-end date sits under the name; once the next 13F deadline (45 days after the next
  // quarter end) has passed it turns amber (AGENTS freshness: 13F is stale only after the next filing is due).
  const quarterEnd = filingMeta?.latestFiling?.periodOfReport || holdingMeta?.verification?.reportPeriod || null;
  if (quarterEnd) {
    const stale = thirteenFStale(quarterEnd);
    // Feature audit 2026-11-02: a stale chip names why — a 13F-NT for the next quarter means another filer reports the
    // holdings (Pershing), and no later 13F at all means the filer may have stopped filing (Scion).
    const submission = ownershipDiscovery?.latestSubmission;
    const noticeAfter = submission?.baseForm === '13F-NT' && submission.periodOfReport > quarterEnd;
    const staleReason = noticeAfter ? `, 다음 분기는 13F-NT(보유는 다른 신고자 보고)` : ', 다음 신고 지남';
    const chip = element(documentRef, 'span', `sx-chip sx-chip--sm masters-quarter-chip${stale ? ' sx-chip--date' : ''}`, `${quarterEnd} 분기 말 기준${stale ? staleReason : ''}`);
    chip.dataset.mastersQuarterEnd = quarterEnd;
    detail.querySelector('.masters-detail-filer')?.before(chip);
  }
  // v58.56 (#4, design 5j): the manager's largest reported holdings as ticker chips that open 종목 요약 — exact
  // CUSIP matches only, in reported-value order, options excluded. No chip row when none of the top rows has one.
  const topTickers = [];
  const topPeriod = holdingMeta?.verification?.reportPeriod || null;
  [...compactRows].filter((row) => !row.putCall && (!topPeriod || row.reportPeriod === topPeriod))
    .sort((a, b) => (Number(a.rank) || 0) - (Number(b.rank) || 0))
    .forEach((row) => { const ticker = (state.securityLookup || PLAIN_LOOKUP).tickerOf(row); if (ticker && !topTickers.includes(ticker) && topTickers.length < 5) topTickers.push(ticker); });
  if (topTickers.length) {
    const chips = element(documentRef, 'div', 'sx-chips masters-top-tickers');
    chips.dataset.mastersTopTickers = topTickers.join(',');
    chips.appendChild(element(documentRef, 'span', 'masters-top-tickers-label', '상위 보유'));
    topTickers.forEach((ticker) => chips.appendChild(tickerChip(documentRef, ticker)));
    detail.querySelector('.masters-detail-filer')?.after(chips);
  }

  const metrics = element(documentRef, 'div', 'masters-metric-grid');
  // Fail closed: when the SEC cover total and the parsed rows disagree, every reading built on reported-value
  // totals (concentration, weight change, total) is withheld rather than shown from an unreconciled base.
  // Codex browser audit H97: a filing whose amounts are ~1,000× off the other filers is withheld the same way.
  const scaleReview = state?.valueScale?.has?.(`${manager.id}|${holdingMeta?.verification?.reportPeriod || ''}`) || false;
  const valueMismatch = holdingMeta?.verification?.valueReconciliationStatus === 'MISMATCH' || scaleReview;
  const withheld = (text) => (valueMismatch ? '보류' : text);
  metrics.append(
    createMetric(documentRef, '보유 종목 수', holdingMeta?.verification?.reportedPositionCount != null ? `${holdingMeta.verification.reportedPositionCount}개` : '—'),
    createMetric(documentRef, '상위 5, 10 비중', withheld(`${formatPercent(holdingMeta?.verification?.top5ConcentrationPct)}, ${formatPercent(holdingMeta?.verification?.top10ConcentrationPct)}`)),
    createMetric(documentRef, '직전 분기 대비', holdingMeta?.verification?.comparisonActionCounts ? summarizeLatestChange(holdingMeta.verification.comparisonActionCounts) : '—'),
    // P1444: the distance between reported-value weights — price moves alone change it — not trading turnover (the
    // v59.55 label drops the defensive parenthetical; the metric's hover keeps the definition).
    Object.assign(createMetric(documentRef, '보유 비중 변화', withheld(formatPercent(holdingMeta?.verification?.turnoverProxyPct))), { title: '신고 가치 기준 비중이 직전 분기와 얼마나 달라졌는지입니다. 주가 변동만으로도 바뀌어 매매 회전율이 아닙니다.' }),
    createMetric(documentRef, '신고 가치 합계', withheld(formatCompactUsd(holdingMeta?.verification?.parsedValueTotal))),
    createMetric(documentRef, '운용 규모', formatScale(manager)),
    createMetric(documentRef, '전략 성격', manager.strategyProfile?.approach || manager.style || '—')
  );
  detail.append(metrics);
  const weightBars = createTopWeightBars(documentRef, manager, holdingMeta, compactRows, valueMismatch, state.securityLookup || PLAIN_LOOKUP);
  if (weightBars) detail.appendChild(weightBars);
  const reportPeriod = filingMeta?.latestFiling?.periodOfReport || holdingMeta?.verification?.reportPeriod || null;
  const reviewedAt = state?.holdings?.reviewedAt ? String(state.holdings.reviewedAt).slice(0, 10) : null;
  const filingDates = [
    reportPeriod ? `보고분기 ${formatQuarterLabel(reportPeriod)}(${reportPeriod})` : null,
    filingMeta?.latestFiling?.filedAt ? `${filingMeta.latestFiling.form || '13F'} 제출 ${filingMeta.latestFiling.filedAt}` : null,
    reviewedAt ? `자료 검토 ${reviewedAt}` : null
  ].filter(Boolean);
  if (filingDates.length) detail.appendChild(element(documentRef, 'p', 'masters-holdings-meta masters-filing-dates', filingDates.join(', ')));
  if (holdingMeta?.verification?.valueReconciliationStatus === 'MISMATCH') detail.appendChild(element(documentRef, 'p', 'masters-note', '이 분기는 공시 표지의 합계와 보유 내역의 합계가 달라, 비중과 합계처럼 총액 기반 해석을 보류한다.'));
  const compareToggle = button(documentRef, 'masters-route-button is-secondary', state.compareIds.includes(manager.id) ? '비교에서 제거' : '비교에 추가', 'toggle-compare', manager.id);
  compareToggle.disabled = !state.compareIds.includes(manager.id) && state.compareIds.length >= 4;
  detail.appendChild(compareToggle);

  const tabs = element(documentRef, 'div', 'masters-detail-tabs');
  tabs.setAttribute('role', 'group');
  tabs.setAttribute('aria-label', `${manager.name} 공시 읽기 방식`);
  Object.entries(VIEW_LABELS).forEach(([view, label]) => {
    const tab = button(documentRef, `masters-detail-tab${state.view === view ? ' is-active' : ''}`, label, 'view', view);
    tab.setAttribute('aria-pressed', state.view === view ? 'true' : 'false');
    tabs.appendChild(tab);
  });
  detail.appendChild(tabs);

  const managerShard = state.holdings?.managerShards?.[manager.id];
  const createDeferredRowsState = () => {
    const block = element(documentRef, 'div', 'masters-empty-state');
    if (state.loadingManagers.has(manager.id)) {
      block.textContent = '보유 내역을 불러오는 중입니다.';
      block.setAttribute('role', 'status');
      return block;
    }
    if (state.managerRowErrors.has(manager.id)) {
      const error = element(documentRef, 'p', 'masters-holdings-meta', '보유 내역을 불러오지 못했습니다. 요약과 원문 링크는 계속 볼 수 있습니다.');
      error.setAttribute('role', 'alert');
      block.appendChild(error);
    } else {
      block.appendChild(element(documentRef, 'p', 'masters-holdings-meta', '전체 보유 내역은 필요할 때만 불러옵니다.'));
    }
    if (managerShard?.url) block.appendChild(button(documentRef, 'masters-route-button is-secondary', state.managerRowErrors.has(manager.id) ? '다시 불러오기' : `전체 보유 ${managerShard.projectionRows || ''}개 불러오기`, 'load-manager', manager.id));
    return block;
  };

  if (state.view === 'principles' || manager.type === 'METHOD_ONLY') {
    detail.appendChild(createPrinciplesView(documentRef, manager, principlesArtifact));
  } else if (state.view === 'ownership') {
    detail.appendChild(createOwnershipEvents(documentRef, manager, ownershipDiscovery) || element(documentRef, 'div', 'masters-empty-state', '5% 이상 대량 보유(13D/G) 기록은 아직 제공하지 않습니다. SEC 수시 공시 정규화가 끝나면 이 탭에 표시합니다.'));
  } else if (state.view === 'compare') {
    detail.appendChild(createInvestorCompareView(documentRef, state.compareIds, registry, holdingManagers, rowsByManager, state.securityLookup || PLAIN_LOOKUP));
  } else if (state.view === 'changes') {
    const summary = createChangeSummary(documentRef, holdingMeta?.verification, comparisonRows);
    if (summary) detail.appendChild(summary);
    if (compactRows.length && !comparisonRows.length) detail.appendChild(createTopHoldingTable(documentRef, manager, holdingMeta, compactRows, state.securityLookup || PLAIN_LOOKUP));
    if (comparisonRows.length) {
      const expected = Number(holdingMeta?.verification?.comparisonRowCount) || null;
      // P1444 (review 2026-10-04): the ledger first shows the embedded preview (the full manager shard is
      // loaded only on request — artifact budget). Say how much of the comparison is on screen and offer
      // the full ledger instead of letting the scope change silently after another view loads it.
      if (expected && comparisonRows.length < expected) {
        // X06 (2026-10-13): the manager shard is itself a bounded web projection (top rows by reported value).
        // Once it is loaded, a "전체 N개 보기" button promised rows the site never ships — say the real scope
        // and point to the SEC filing for the rest instead.
        const shardLoaded = state.managerRows?.has?.(manager.id);
        const filingUrl = filingMeta?.latestFiling?.informationTableXml || filingMeta?.latestFiling?.indexUrl || holdingMeta?.latestFiling?.indexUrl || manager.sourceUrl || 'https://www.sec.gov/edgar/search-and-access';
        // first-users run-3 B28: "보유 종목 수 29개" beside "신고 30건" read as two counts of one list. The comparison also
        // carries the positions sold out since the prior quarter, so the sentence names both parts.
        const exited = Number(holdingMeta?.verification?.comparisonActionCounts?.EXITED) || 0;
        const parts = exited ? `이번 분기 보유 ${(expected - exited).toLocaleString('en-US')}개, 전량 매도 ${exited.toLocaleString('en-US')}개` : '';
        const scope = element(documentRef, 'p', 'masters-holdings-meta masters-ledger-scope', shardLoaded
          ? `웹 화면은 신고 가치 상위 ${comparisonRows.length.toLocaleString('en-US')}개 비교 행까지만 제공합니다(비교 행 전체 ${expected.toLocaleString('en-US')}개${parts ? `: ${parts}` : ''}). 아래 표는 변화가 있는 행을 먼저 놓습니다. 나머지는 `
          : `비교 행 ${expected.toLocaleString('en-US')}개${parts ? `(${parts})` : ''} 중 가치 상위 ${comparisonRows.length}개, 변화 있는 행 먼저 `);
        if (shardLoaded) {
          const link = element(documentRef, 'a', 'masters-source-link', 'SEC 원문 신고서');
          applySafeExternalLink(link, filingUrl);
          scope.append(link, documentRef.createTextNode('에서 확인합니다.'));
        } else {
          scope.appendChild(button(documentRef, 'masters-route-button is-secondary', state.loadingManagers?.has?.(manager.id) ? '표 불러오는 중…' : (Number(state.holdings?.managerShards?.[manager.id]?.comparisonProjectionRows) > comparisonRows.length ? `${Number(state.holdings.managerShards[manager.id].comparisonProjectionRows).toLocaleString('en-US')}행 모두 보기` : '변화 기록 더 보기'), 'load-manager', manager.id));
        }
        detail.appendChild(scope);
      }
      detail.appendChild(createChangeLedger(documentRef, comparisonRows, state));
    }
    if (!compactRows.length && previewRows.length) detail.appendChild(createRowPreviewView(documentRef, manager, previewMeta, previewRows));
  } else if (state.view === 'holdings') {
    detail.appendChild(fullRows.length ? createFullHoldingsView(documentRef, fullRows, state, managerShard) : managerShard?.url ? createDeferredRowsState() : previewRows.length ? createRowPreviewView(documentRef, manager, previewMeta, previewRows) : element(documentRef, 'div', 'masters-empty-state', '이 운용사의 보유 내역은 아직 연결되지 않았습니다.'));
  } else if (state.view === 'sectors') {
    if (fullRows.length) {
      const referenceSectorView = createReferenceSectorView(documentRef, fullRows, referenceMaster);
      // One status per card: the reference classification when it exists, the unavailable state otherwise —
      // not a sector table followed by "섹터 구성은 아직 공개하지 않습니다".
      detail.appendChild(referenceSectorView || createSectorView(documentRef, fullRows, securityMaster));
    } else if (managerShard?.url) detail.appendChild(createDeferredRowsState());
    else detail.appendChild(createSectorView(documentRef, fullRows, securityMaster));
  } else if (state.view === 'quarters') {
    // P1522: earlier quarters and issuer aggregates of a manager under scale review are withheld too (same filer, same unit).
    const managerScaleReviewed = managersUnderScaleReview(state?.valueScale).has(manager.id);
    detail.appendChild(createQuarterView(documentRef, holdingMeta, historyManager, historyRowsArtifact, managerScaleReviewed));
    detail.appendChild(createIssuerAggregateView(documentRef, issuerAggregates, manager.id, managerScaleReviewed));
  } else if (state.view === 'filings') {
    const filingView = element(documentRef, 'section', 'masters-filing-view');
    filingView.append(element(documentRef, 'h3', 'masters-holdings-title', '원본 공시와 검증 경계'), element(documentRef, 'p', 'masters-holdings-meta', '아래 링크는 SEC EDGAR 원문입니다. 공시의 보고 기준일과 제출일을 확인한 뒤 행 비교를 해석하세요.'), createFilingArtifact(documentRef, filingMeta, holdingMeta));
    detail.appendChild(filingView);
  }

  const principles = button(documentRef, 'masters-route-button is-secondary', '개념·분석에서 이어 읽기', 'route', 'principles');
  principles.addEventListener('click', onRoute);
  detail.appendChild(principles);
  return detail;
}

// P1479: how each way of managing money works and what 13F can and cannot show about it.
function createStyleComparison(documentRef, catalog) {
  const box = documentRef.createElement('details');
  box.className = 'masters-style-compare';
  box.dataset.mastersStyleCompare = 'native';
  const summary = documentRef.createElement('summary');
  summary.textContent = '운용 방식별 비교 — 해결하려는 문제·수익 원천·감수하는 위험·13F에 보이는 것';
  box.appendChild(summary);
  const note = documentRef.createElement('p');
  note.className = 'masters-style-note';
  note.textContent = '13F는 분기 말 미국 상장 주식(일부 옵션·전환사채 포함)의 롱 포지션만 보여 주고, 분기 말로부터 최대 45일 뒤에 공개됩니다. 사라진 종목은 매도했거나 보고 대상(소액·비밀 취급)에서 빠진 것입니다. 같은 13F라도 운용 방식에 따라 보이는 부분과 보이지 않는 부분이 크게 다릅니다.';
  box.appendChild(note);
  const groups = groupManagersByStyle(catalog?.managers || []);
  const methodOnlyNames = new Set((catalog?.managers || []).filter((manager) => manager.type === 'METHOD_ONLY').map((manager) => manager.displayName || manager.id));
  const table = documentRef.createElement('table');
  table.className = 'masters-style-table';
  const head = documentRef.createElement('tr');
  ['방식', '해결하려는 문제', '수익 원천', '감수하는 위험', '13F에 보이는 것', '13F로 알 수 없는 것', '이 화면의 운용사'].forEach((label) => { const th = documentRef.createElement('th'); th.textContent = label; th.scope = 'col'; head.appendChild(th); });
  table.appendChild(head);
  for (const frame of STYLE_FRAMES) {
    const tr = documentRef.createElement('tr');
    tr.dataset.styleFrame = frame.id;
    [frame.label, frame.problem, frame.source, frame.risk, frame.sees, frame.blind, (groups.get(frame.id) || []).map((name) => (methodOnlyNames.has(name) ? `${name}(13F 미신고)` : name)).join(', ') || '—'].forEach((value, index) => {
      const cell = documentRef.createElement(index ? 'td' : 'th');
      if (!index) cell.scope = 'row';
      cell.textContent = value;
      tr.appendChild(cell);
    });
    table.appendChild(tr);
  }
  const scroll = documentRef.createElement('div');
  scroll.className = 'masters-style-scroll';
  scroll.appendChild(table);
  box.appendChild(scroll);
  return box;
}

export function createMastersPage({ root = globalThis, documentRef = root.document } = {}) {
  return {
    route: 'masters',
    mount({ scope } = {}) {
      const bag = createResourceBag();
      const page = documentRef?.getElementById('page-masters');
      const content = page?.querySelector('[data-masters-content]');
      if (!page || !content) return () => bag.dispose();
      let suppliedMaterialBridge = page.querySelector('[data-aio-supplied-material-route="masters"]');
      if (!suppliedMaterialBridge) {
        suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
          routeId: 'masters',
          heading: '대가 보유 종목, 13F는 분기 뒤 늦게 공개됨'
        });
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge.remove());
      }
       const sharedRoute = parseKnowledgeRouteState(root?.location);
       const arrivalContext = parseKnowledgeTargetContext({ root, locationLike: root?.location });
       const initialView = Object.hasOwn(VIEW_LABELS, sharedRoute.mode) ? sharedRoute.mode : 'changes';
       const state = { query: '', tickerQuery: '', filter: 'ALL', arrivalContext: arrivalContext?.routeId === 'masters' ? arrivalContext : null, selectedId: sharedRoute.manager || MASTER_REGISTRY[0].id, view: initialView, actionFilter: 'ALL', holdingsQuery: '', page: 1, pageSize: 25, compareIds: [], managerRows: new Map(), managerRowErrors: new Set(), loadingManagers: new Set(), loadingCapabilities: new Set(), quarterBundles: new Map(), loadingQuarterManagers: new Set(), filings: null, holdings: null, catalog: null, previews: null, discovery: null, principles: null, securityMaster: null, referenceMaster: null, history: null, tickerIndex: null, filingsError: false, holdingsError: false, catalogError: false, previewsError: false, discoveryError: false, principlesError: false, securityMasterError: false, referenceMasterError: false, historyError: false, historyRowsError: false, issuerAggregatesError: false, tickerIndexError: false };
       const isAlive = () => !scope?.disposed && (typeof scope?.isCurrent !== 'function' || scope.isCurrent());
       // v57.50 I12: 종목 요약's '대가 보유 종목' link arrives with its ticker — the reverse lookup opens on it.
       const handoffTicker = String(consumeResearchHandoff({ root, routeId: 'masters' })?.context?.ticker || '').trim().toUpperCase();
       if (/^[A-Z][A-Z0-9.-]{0,9}$/.test(handoffTicker)) state.tickerQuery = handoffTicker;
      page.dataset.aioArchitectureRoute = 'masters';
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioContentKind = 'REFERENCE';
      page.dataset.aioReviewedAt = REVIEWED_AT;

      const route = (routeId) => { if (typeof root?.showPage === 'function') root.showPage(routeId); };
      const syncSharedState = ({ push = false } = {}) => (push ? pushKnowledgeRouteState : replaceKnowledgeRouteState)({ root, state: {
        mode: state.view,
        manager: state.selectedId,
        period: state.holdings?.managers?.find((manager) => manager.id === state.selectedId)?.verification?.reportPeriod || null
      } });
      syncSharedState();
      const focusDetail = () => {
        const heading = page.querySelector('.masters-detail-title');
        if (!heading) return;
        heading.scrollIntoView({ block: 'start', behavior: 'auto' });
        heading.focus({ preventScroll: true });
      };
       const render = () => {
         if (!isAlive()) return;
         const registry = buildManagerRegistry(state.catalog);
         state.securityLookup = createSecurityLookup(state.holdings, state.referenceMaster);
         // P1325: a late artifact load re-renders the page; keep the field the user is typing in.
         const activeField = documentRef.activeElement;
         const focusSelector = activeField && activeField.tagName === 'INPUT' && page.contains(activeField)
           ? (activeField.dataset?.mastersAction ? `input[data-masters-action="${activeField.dataset.mastersAction}"]` : (activeField.classList.contains('masters-search-input') ? 'input.masters-search-input' : null))
           : null;
         const focusSelection = focusSelector ? [activeField.selectionStart, activeField.selectionEnd] : [0, 0];
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
        input.addEventListener('input', (event) => {
          state.query = String(event.target.value || '').trim().toLowerCase();
          render();
          queueMicrotask(() => {
            const nextInput = page.querySelector('.masters-search-input');
            nextInput?.focus({ preventScroll: true });
            nextInput?.setSelectionRange(nextInput.value.length, nextInput.value.length);
          });
        });
        searchLabel.appendChild(input);
        toolbar.append(filters, searchLabel, button(documentRef, 'masters-filter-tab masters-ticker-jump', '종목으로 찾기', 'goto-ticker-lookup', 'tickerIndex'));
         const matchesList = registry.filter((manager) => (state.filter === 'ALL' || manager.type === state.filter) && matches(manager, state.query));
         const selected = matchesList.find((manager) => manager.id === state.selectedId) || matchesList[0] || null;
         if (selected) state.selectedId = selected.id;
         const layout = element(documentRef, 'div', 'masters-layout');
         const list = element(documentRef, 'div', 'masters-manager-list');
         matchesList.forEach((manager) => {
           const filingMeta = state.filings?.managers?.find((item) => item.id === manager.id) || state.catalog?.managers?.find((item) => item.id === manager.id);
          const holdingMeta = state.holdings?.managers?.find((item) => item.id === manager.id);
          const previewMeta = state.previews?.managers?.find((item) => item.managerId === manager.id);
          list.appendChild(createManagerCard(
            documentRef,
            manager,
            manager.id === state.selectedId,
            holdingMeta?.status || (previewMeta ? 'SEC_ROW_PREVIEW' : filingMeta?.status || manager.status),
            holdingMeta?.freshnessStatus || filingMeta?.freshnessStatus,
             holdingMeta?.verification?.reportPeriod || filingMeta?.latestSubmission?.periodOfReport || filingMeta?.latestFiling?.periodOfReport || null,
             holdingMeta
          ));
        });
        if (!matchesList.length) list.appendChild(element(documentRef, 'div', 'masters-empty-state', '조건에 맞는 프로필이 없습니다.'));
         const catalogMeta = selected ? state.catalog?.managers?.find((item) => item.id === selected.id) : null;
         const filingMeta = selected ? state.filings?.managers?.find((item) => item.id === selected.id) || catalogMeta : null;
        const holdingMeta = selected ? state.holdings?.managers?.find((item) => item.id === selected.id) : null;
        const compactRows = selected ? (state.holdings?.holdings || []).filter((item) => item.managerId === selected.id) : [];
         const selectedShard = selected ? state.managerRows.get(selected.id) : null;
         const embeddedRows = selected ? (state.holdings?.allHoldings || []).filter((item) => item.managerId === selected.id) : [];
         const fullRows = selectedShard?.holdings || embeddedRows;
          const selectedComparisons = selected ? (state.holdings?.comparisons || []).filter((item) => item.managerId === selected.id) : [];
          const comparisonRows = selectedShard?.comparisons?.length ? selectedShard.comparisons : selectedComparisons.length ? selectedComparisons : compactRows.filter((item) => item.comparisonStatus === 'VERIFIED_PRIOR_PERIOD');
          const previewMeta = selected ? state.previews?.managers?.find((item) => item.managerId === selected.id) : null;
          const previewRows = previewMeta?.rows || [];
          const historyManager = selected ? state.history?.managers?.find((item) => item.managerId === selected.id) : null;
          const quarterBundle = selected ? state.quarterBundles.get(selected.id) : null;
          const rowsByManager = new Map(state.managerRows);
          registry.forEach((item) => {
            if (rowsByManager.has(item.id)) return;
            // Codex browser audit H99: the fallback read `allHoldings`, which the page bootstrap does not carry, so
            // every manager without a loaded shard had no rows and the compare said "no common holdings". The
            // published top holdings are the fallback, and the basis is recorded so the result names its scope.
            const rows = (state.holdings?.allHoldings || state.holdings?.holdings || []).filter((row) => row.managerId === item.id);
            const comparisons = (state.holdings?.comparisons || []).filter((row) => row.managerId === item.id);
            if (rows.length || comparisons.length) rowsByManager.set(item.id, { holdings: rows, comparisons, basis: state.holdings?.allHoldings ? 'full' : 'top' });
          });
          const ownershipDiscovery = selected ? state.discovery?.managers?.find((item) => item.managerId === selected.id) : null;
          if (selected) layout.append(list, createDetail(documentRef, selected, () => navigateKnowledgeTarget({ root, target: {
            routeId: 'principles',
            conceptId: 'institutional-position-change',
            metric: '13F_QUARTERLY_CHANGE',
            timeframe: holdingMeta?.verification?.reportPeriod || 'QUARTERLY_LAGGED',
            returnContext: { route: 'masters', manager: selected.id, mode: state.view, period: holdingMeta?.verification?.reportPeriod || null }
          } }), filingMeta, ownershipDiscovery, holdingMeta, compactRows, fullRows, comparisonRows, previewMeta, previewRows, state, state.securityMaster, state.referenceMaster, historyManager, quarterBundle ? { rows: quarterBundle.historyRows || [] } : null, quarterBundle?.issuerAggregates || null, state.principles, registry, state.holdings?.managers || [], rowsByManager));
          else layout.append(list, element(documentRef, 'div', 'masters-empty-state', '현재 필터에 표시할 상세 프로필이 없습니다. 필터나 검색어를 변경하세요.'));
        if (selected && state.valueScale?.size) {
          const scaleReview = state.valueScale.get(`${selected.id}|${holdingMeta?.verification?.reportPeriod || ''}`);
          const detailNode = layout.lastElementChild;
          if (scaleReview && detailNode) {
            const notice = element(documentRef, 'div', 'masters-empty-state masters-scale-review', describeValueScaleReview(scaleReview));
            notice.setAttribute('role', 'note');
            detailNode.prepend(notice);
          }
        }
        // v57.48 expert review #14: `layout` itself is not mounted (only its detail node is), so load-failure notices
        // appended to it never reached the screen — they are collected and put at the top of the document column.
        const loadNotices = [];
        if (state.filingsError) loadNotices.push(element(documentRef, 'div', 'masters-empty-state', 'SEC 공시 메타데이터를 불러오지 못했습니다. 기관 소개는 계속 볼 수 있습니다.'));
        if (state.holdingsError) loadNotices.push(element(documentRef, 'div', 'masters-empty-state', 'SEC 보유 행을 불러오지 못했습니다. 공시 메타데이터는 계속 볼 수 있습니다.'));
         if (state.securityMasterError || state.referenceMasterError) loadNotices.push(element(documentRef, 'div', 'masters-empty-state', '종목 분류 원장을 불러오지 못해 섹터·티커를 추정하지 않고 공시 이름만 표시합니다.'));
          if (state.historyError || state.historyRowsError) loadNotices.push(element(documentRef, 'div', 'masters-empty-state', 'SEC 과거 공시 행을 불러오지 못했습니다. 현재·직전 분기 행과 공시 메타데이터는 계속 볼 수 있습니다.'));
          if (state.issuerAggregatesError) loadNotices.push(element(documentRef, 'div', 'masters-empty-state', '종목별 과거 합산 자료를 불러오지 못했습니다. 원본 현재·직전 분기 행은 계속 볼 수 있습니다.'));
         if (state.previewsError) loadNotices.push(element(documentRef, 'div', 'masters-empty-state', '공시 행 미리보기를 불러오지 못했습니다. 전체 행 요청과 메타데이터는 계속 사용할 수 있습니다.'));
         if (state.discoveryError) loadNotices.push(element(documentRef, 'div', 'masters-empty-state', 'SEC 최신 제출 확인 자료를 불러오지 못했습니다. 저장된 제출일은 표시하되 최신이라고 단정하지 않습니다.'));
         const discoveryState = state.discovery || state.holdings?.filingDiscoverySummary;
         const coverageSummary = deriveCoverageSummary(registry, state.catalog, state.holdings, state.previews, discoveryState, state.principles, state.securityMaster);
         const coverage = createCatalogCoverage(documentRef, state.catalog, registry, state.holdings, state.previews, discoveryState, state.principles, state.securityMaster);
         const coreArtifactsConnected = !!(state.holdings && state.catalog);
         page.dataset.aioMastersData = coreArtifactsConnected ? coverageSummary.state : 'fallback';
         page.dataset.aioMastersCoverageState = coverageSummary.state;
         page.dataset.aioMastersCurrentFull = String(coverageSummary.currentFull);
         page.dataset.aioMastersStaleFull = String(coverageSummary.staleFull);
         page.dataset.aioMastersPreviewOnly = String(coverageSummary.previewOnly);
         page.dataset.aioMastersMetadataOnly = String(coverageSummary.metadataOnly);
         page.dataset.aioMastersMethodOnly = String(coverageSummary.methodOnly);
         page.dataset.aioMastersOfficialPrinciples = String(coverageSummary.officialPrinciples);
         page.dataset.aioMastersVerifiedSecurityRecords = String(coverageSummary.verifiedSecurityRecords);
         page.dataset.aioMastersLatestPeriodMissing = String(coverageSummary.latestPeriodMissing);
         page.dataset.aioMastersView = state.view;
        page.dataset.aioMastersFullRows = String(fullRows.length);
        page.dataset.aioMastersComparisonRows = String(comparisonRows.length);
        page.dataset.aioMastersActionFilter = state.actionFilter;
        page.dataset.aioMastersIssuerAggregates = quarterBundle?.issuerAggregates ? 'connected' : 'pending';
         const arrival = createMastersArrivalContext(documentRef, state.arrivalContext, () => {
           if (typeof root?.history?.back === 'function') root.history.back();
           else if (state.arrivalContext?.returnContext?.route && typeof root?.showPage === 'function') root.showPage(state.arrivalContext.returnContext.route);
         });
          const tickerLoadState = state.tickerIndex ? 'ready' : (state.tickerIndexError && !state.loadingCapabilities.has('tickerIndex') ? 'error' : (state.loadingCapabilities.has('tickerIndex') ? 'loading' : 'idle'));
          const tickerLookup = createTickerLookup(documentRef, state.tickerIndex, registry, state.tickerQuery, tickerLoadState, state.holdings?.holdings || [], state.valueScale);
          page.dataset.aioMastersTickerIndex = tickerLoadState === 'ready' ? 'connected' : (tickerLoadState === 'error' ? 'fallback' : 'loading');
          // P1325: manager cards (the investors) come first; the reverse lookup and the coverage
          // explanation are secondary and follow. The toolbar carries a jump link to the lookup.
          // 2026-10-05 리서치 라이브러리 redesign: the manager list moves into the contents column (grouped by
          // style); the detail card is the document; style, peers and the ticker lookup form the 연결 column.
          // The catalog coverage panel and filter tabs are no longer shown on screen.
          void toolbar; void coverage;
          const detailNode = layout.children[1] || null;
          const shell = renderManagersPage(documentRef, {
            root,
            catalog: state.catalog,
            registry,
            selectedId: state.selectedId,
            overview: state.styleOverview === true,
            detail: detailNode,
            styleTable: state.catalog ? createStyleComparison(documentRef, state.catalog) : null,
            tickerLookup,
            onLocal: (params = {}) => { if (params.manager) { state.selectedId = params.manager; state.styleOverview = false; render(); } }
          });
          if (loadNotices.length) loadNotices.forEach((notice) => notice.setAttribute('role', 'status'));
          if (loadNotices.length) shell.querySelector('.rl-main')?.prepend(...loadNotices);
          if (arrival) shell.querySelector('.rl-main')?.prepend(arrival);
          content.replaceChildren(shell);
         if (focusSelector) {
           const nextField = content.querySelector(focusSelector);
           if (nextField && documentRef.activeElement !== nextField) {
             nextField.focus({ preventScroll: true });
             try { nextField.setSelectionRange(focusSelection[0], focusSelection[1]); } catch { /* non-text input */ }
           }
         }
      };
      const fetchFn = root?.fetch || globalThis.fetch;
      const loadJson = (url) => loadArtifactUrl(root, url, { signal: scope?.signal });
      const loadOptionalArtifact = async (key, url, options = {}) => {
        if (!isAlive() || state[key] != null || state.loadingCapabilities.has(key)) return;
        state.loadingCapabilities.add(key);
        state[`${key}Error`] = false;
        page.dataset[`aioMasters${key[0].toUpperCase()}${key.slice(1)}`] = 'loading';
        try {
          state[key] = await loadArtifactUrl(root, url, { signal: scope?.signal, ...options });
          if (!isAlive()) return;
          page.dataset[`aioMasters${key[0].toUpperCase()}${key.slice(1)}`] = 'connected';
        } catch (error) {
          if (scope?.signal?.aborted) return;
          state[`${key}Error`] = true;
          page.dataset[`aioMasters${key[0].toUpperCase()}${key.slice(1)}`] = 'fallback';
        } finally {
          state.loadingCapabilities.delete(key);
          if (isAlive()) render();
        }
      };
      const loadManagerRows = async (managerId) => {
        if (!isAlive() || state.managerRows.has(managerId) || state.loadingManagers.has(managerId)) return;
        const descriptor = state.holdings?.managerShards?.[managerId];
        if (!descriptor?.url) return;
        state.loadingManagers.add(managerId);
        state.managerRowErrors.delete(managerId);
        render();
        try {
          const artifact = await loadArtifactUrl(root, descriptor.url, { signal: scope?.signal, integrity: descriptor.sha256, maxBytes: descriptor.bytes });
          if (!isAlive()) return;
          if (artifact?.managerId !== managerId || artifact?.artifactRole !== 'BOUNDED_WEB_PROJECTION' || artifact?.holdings?.length !== descriptor.projectionRows || artifact?.comparisons?.length !== descriptor.comparisonProjectionRows || artifact?.fullRowsAvailable !== descriptor.fullRows || artifact?.fullComparisonsAvailable !== descriptor.comparisonRows || artifact?.latestFiling?.accession !== descriptor.accession) {
            throw new Error(`manager shard integrity mismatch: ${managerId}`);
          }
          // Codex browser audit H97: a filing under scale review keeps its shares but not its dollar amounts.
          const shardPeriod = artifact.reportPeriod || descriptor.reportPeriod || state.holdings?.managers?.find((item) => item.id === managerId)?.verification?.reportPeriod || null;
          state.managerRows.set(managerId, state.valueScale?.size ? { ...artifact, holdings: withholdSuspectValues(artifact.holdings, state.valueScale, { managerId, period: shardPeriod }), comparisons: withholdSuspectValues(artifact.comparisons, state.valueScale, { managerId, period: shardPeriod }) } : artifact);
          state.managerRowErrors.delete(managerId);
          page.dataset.aioMastersSelectedShard = 'connected';
        } catch (error) {
          if (scope?.signal?.aborted) return;
          state.managerRowErrors.add(managerId);
          page.dataset.aioMastersSelectedShard = 'fallback';
        } finally {
          state.loadingManagers.delete(managerId);
          render();
        }
      };
      const loadQuarterArtifacts = async (managerId = state.selectedId) => {
        if (!isAlive() || state.quarterBundles.has(managerId) || state.loadingQuarterManagers.has(managerId)) return;
        state.loadingQuarterManagers.add(managerId);
        try {
          if (!state.history) state.history = await loadJson(HISTORY_INDEX_URL);
          if (!isAlive()) return;
          page.dataset.aioMastersHistory = 'connected';
          const descriptor = state.history?.managerShards?.[managerId];
          if (!descriptor?.url) throw new Error(`manager history shard missing: ${managerId}`);
          const bundle = await loadJson(descriptor.url);
          if (!isAlive()) return;
          // LC-30: the history shard used to be trusted on URL alone, so a swapped/older shard could
          // feed the change ledger with another manager's periods. Verify it is the shard the index
          // declares for this manager and generation, and that its row scope matches, before use.
          const shardSchema = state.history?.runtimeShardSchema;
          if (bundle?.managerId !== managerId
            || (shardSchema && bundle?.schema !== shardSchema)
            || bundle?.historySummary?.rawRowsAvailable !== descriptor.historyRows) {
            throw new Error(`manager history shard identity mismatch: ${managerId}`);
          }
          state.quarterBundles.set(managerId, bundle);
          state.historyRowsError = false;
          state.issuerAggregatesError = false;
          page.dataset.aioMastersHistoryRows = 'connected';
          page.dataset.aioMastersIssuerAggregates = 'connected';
        } catch (error) {
          if (scope?.signal?.aborted) return;
          state.historyError = !state.history;
          state.historyRowsError = true;
          state.issuerAggregatesError = true;
          page.dataset.aioMastersHistoryRows = 'fallback';
          page.dataset.aioMastersIssuerAggregates = 'fallback';
        } finally {
          state.loadingQuarterManagers.delete(managerId);
          render();
        }
      };
      const onClick = (event) => {
        const target = event.target.closest?.('[data-masters-action]');
        if (!target || !page.contains(target)) return;
        const action = target.dataset.mastersAction;
        const value = target.dataset.mastersValue;
        const previousSelection = state.selectedId;
        if (action === 'retry-ticker-index') { state.tickerIndexError = false; loadOptionalArtifact('tickerIndex', TICKER_INDEX_REFERENCE_URL, TICKER_INDEX_LOAD_OPTIONS); }
        if (action === 'goto-ticker-lookup') loadOptionalArtifact('tickerIndex', TICKER_INDEX_REFERENCE_URL, TICKER_INDEX_LOAD_OPTIONS);
        if (action === 'filter') { state.filter = value; }
        // P1449 review note: the 2~4명 비교 accumulates DELIBERATELY across managers
        // (ci-masters-browser-check pins the accumulation), so a manager switch must NOT
        // reset the selection — the review's "Fisher 비교에 다른 인물 내용" reading was about
        // a specific surfacing, not this accumulation design.
        if (action === 'style-overview') state.styleOverview = true;
        if (action === 'select-manager') { state.styleOverview = false; state.selectedId = value; state.view = 'changes'; state.actionFilter = 'ALL'; state.holdingsQuery = ''; state.page = 1; }
        if (action === 'view') { state.view = value; state.page = 1; if (value === 'changes') state.changeLedgerOpen = true; } // v59.51: choosing the 변화 tab asks for the table, so it opens
        if (action === 'toggle-compare') {
          state.compareIds = state.compareIds.includes(value) ? state.compareIds.filter((id) => id !== value) : [...state.compareIds, value].slice(0, 4);
        }
        if (action === 'change-filter') { state.actionFilter = value; state.page = 1; }
        if (action === 'detail-page') {
          state.page = Math.max(1, state.page + (value === 'next' ? 1 : -1));
        }
        if (action !== 'route') {
          event.preventDefault();
          syncSharedState({ push: action === 'select-manager' || action === 'view' }); // run-2 R2-17: Back returns to the previous manager or view
          render();
          if (action === 'load-manager' || action === 'toggle-compare') loadManagerRows(value);
          if (action === 'view' && (value === 'holdings' || value === 'sectors')) loadManagerRows(state.selectedId);
          if (action === 'view' && value === 'quarters') loadQuarterArtifacts(state.selectedId);
          if (action === 'view' && value === 'filings') loadOptionalArtifact('filings', FILINGS_URL);
          if (action === 'view' && value === 'ownership') loadOptionalArtifact('discovery', FILING_DISCOVERY_URL);
          // P1488: a method-only profile opens straight on its principles, so selecting it loads them.
          if ((action === 'view' && value === 'principles') || (action === 'select-manager' && state.catalog?.managers?.find?.((m) => m.id === value)?.type === 'METHOD_ONLY')) loadOptionalArtifact('principles', MANAGER_PRINCIPLES_URL);
          if (action === 'view' && value === 'sectors') {
            loadOptionalArtifact('securityMaster', SECURITY_MASTER_URL);
            loadOptionalArtifact('referenceMaster', SECURITY_MASTER_REFERENCE_URL);
          }
          if (action === 'goto-ticker-lookup') queueMicrotask(() => { const field = page.querySelector('.masters-ticker-lookup-input'); field?.scrollIntoView({ block: 'center', behavior: 'auto' }); field?.focus({ preventScroll: true }); });
          if (action === 'select-manager' || action === 'view' || (action === 'change-filter' && previousSelection !== state.selectedId)) queueMicrotask(focusDetail);
        }
      };
      const onInput = (event) => {
         const target = event.target.closest?.('[data-masters-action="holdings-search"], [data-masters-action="ticker-search"]');
         if (!target || !page.contains(target)) return;
         if (target.dataset.mastersAction === 'ticker-search') {
           state.tickerQuery = String(target.value || '').trim();
         } else {
           state.holdingsQuery = String(target.value || '').trim().toLowerCase();
         }
         state.page = 1;
         render();
         if (target.dataset.mastersAction === 'ticker-search' && !state.tickerIndexError) loadOptionalArtifact('tickerIndex', TICKER_INDEX_REFERENCE_URL, TICKER_INDEX_LOAD_OPTIONS);
         queueMicrotask(() => {
           const nextInput = page.querySelector(`[data-masters-action="${target.dataset.mastersAction}"]`);
           nextInput?.focus({ preventScroll: true });
           nextInput?.setSelectionRange(nextInput.value.length, nextInput.value.length);
        });
      };
      page.addEventListener('click', onClick);
      page.addEventListener('input', onInput);
      // P1330: load the ticker ledger on first focus of the lookup field (not at mount — budget).
      const onFocusIn = (event) => { if (event.target?.dataset?.mastersAction === 'ticker-search' && !state.tickerIndex && !state.tickerIndexError) loadOptionalArtifact('tickerIndex', TICKER_INDEX_REFERENCE_URL, TICKER_INDEX_LOAD_OPTIONS); };
      page.addEventListener('focusin', onFocusIn);
      bag.add(() => page.removeEventListener('focusin', onFocusIn));
      bag.add(() => page.removeEventListener('click', onClick));
      bag.add(() => page.removeEventListener('input', onInput));
      const onPop = () => {
        if (!isAlive() || !/^#masters(?:$|[?&])/.test(String(root?.location?.hash || ''))) return;
        const next = parseKnowledgeRouteState(root.location);
        const view = Object.hasOwn(VIEW_LABELS, next.mode) ? next.mode : 'changes';
        const manager = next.manager || MASTER_REGISTRY[0].id;
        if (manager === state.selectedId && view === state.view) return;
        Object.assign(state, { styleOverview: false, selectedId: manager, view, page: 1 });
        render();
        if (view === 'holdings' || view === 'sectors') loadManagerRows(manager);
        if (view === 'quarters') loadQuarterArtifacts(manager);
      };
      root?.addEventListener?.('popstate', onPop);
      bag.add(() => root?.removeEventListener?.('popstate', onPop));
       bag.add(() => { delete page.dataset.aioArchitectureRoute; delete page.dataset.aioArchitectureRenderer; delete page.dataset.aioContentKind; delete page.dataset.aioReviewedAt; delete page.dataset.aioMastersData; delete page.dataset.aioMastersCoverageState; delete page.dataset.aioMastersCurrentFull; delete page.dataset.aioMastersStaleFull; delete page.dataset.aioMastersPreviewOnly; delete page.dataset.aioMastersMetadataOnly; delete page.dataset.aioMastersMethodOnly; delete page.dataset.aioMastersOfficialPrinciples; delete page.dataset.aioMastersVerifiedSecurityRecords; delete page.dataset.aioMastersLatestPeriodMissing; delete page.dataset.aioMastersHoldings; delete page.dataset.aioMastersCatalog; delete page.dataset.aioMastersPreviews; delete page.dataset.aioMastersDiscovery; delete page.dataset.aioMastersPrinciples; delete page.dataset.aioMastersSelectedShard; delete page.dataset.aioMastersSecurityMaster; delete page.dataset.aioMastersReferenceMaster; delete page.dataset.aioMastersHistory; delete page.dataset.aioMastersHistoryRows; delete page.dataset.aioMastersIssuerAggregates; delete page.dataset.aioMastersTickerIndex; delete page.dataset.aioMastersView; delete page.dataset.aioMastersFullRows; delete page.dataset.aioMastersComparisonRows; delete page.dataset.aioMastersActionFilter; content.replaceChildren(); });
      render();
      if (state.tickerQuery) {
        loadOptionalArtifact('tickerIndex', TICKER_INDEX_REFERENCE_URL, TICKER_INDEX_LOAD_OPTIONS);
        queueMicrotask(() => page.querySelector('.masters-ticker-lookup')?.scrollIntoView?.({ block: 'start', behavior: 'auto' }));
      }
       if (typeof fetchFn === 'function') {
          // v58.56 (#4): the reference crosswalk (29 KB) loads with the page so holdings rows show exact ticker chips
          // from the first render; before this it loaded only for the sector view.
          loadOptionalArtifact('referenceMaster', SECURITY_MASTER_REFERENCE_URL);
          const entries = [['holdings', HOLDINGS_URL], ['catalog', MANAGER_CATALOG_URL]];
         Promise.allSettled(entries.map(([, url]) => loadJson(url))).then((results) => {
           if (!isAlive()) return;
           results.forEach((result, index) => {
             const key = entries[index][0];
             if (result.status === 'fulfilled') {
               state[key] = result.value;
               if (key === 'holdings' && Array.isArray(result.value?.holdings)) {
                 // Codex browser audit H97: find filings whose amounts sit ~1,000× off the other filers of the same
                 // security and period, and withhold their amounts before any table, total or weight is drawn.
                 state.valueScale = detectValueScaleSuspects(result.value.holdings);
                 if (state.valueScale.size) {
                   const managers = (result.value.managers || []).map((manager) => (state.valueScale.has(`${manager.id}|${manager.verification?.reportPeriod || ''}`)
                     ? { ...manager, verification: { ...manager.verification, valueScaleReview: true } } : manager));
                   state[key] = { ...result.value, managers, holdings: withholdSuspectValues(result.value.holdings, state.valueScale), comparisons: withholdSuspectValues(result.value.comparisons || [], state.valueScale), ...(Array.isArray(result.value.allHoldings) ? { allHoldings: withholdSuspectValues(result.value.allHoldings, state.valueScale) } : {}) };
                   // P1522: a manager shard that finished before detection kept the filed amounts; withhold it again now.
                   state.managerRows.forEach((artifact, managerId) => {
                     const shardPeriod = artifact.reportPeriod || state.holdings?.managerShards?.[managerId]?.reportPeriod || state.holdings?.managers?.find((item) => item.id === managerId)?.verification?.reportPeriod || null;
                     state.managerRows.set(managerId, { ...artifact, holdings: withholdSuspectValues(artifact.holdings, state.valueScale, { managerId, period: shardPeriod }), comparisons: withholdSuspectValues(artifact.comparisons, state.valueScale, { managerId, period: shardPeriod }) });
                   });
                 }
               }
               page.dataset[`aioMasters${key[0].toUpperCase()}${key.slice(1)}`] = 'connected';
             } else {
               state[`${key}Error`] = true;
               page.dataset[`aioMasters${key[0].toUpperCase()}${key.slice(1)}`] = 'fallback';
             }
           });
           const reviewedAt = [state.discovery?.reviewedAt, state.holdings?.reviewedAt, state.catalog?.reviewedAt, state.principles?.reviewedAt, REVIEWED_AT].filter(Boolean).sort().at(-1);
           page.dataset.aioReviewedAt = reviewedAt || REVIEWED_AT;
           render();
            page.dataset.aioMastersSelectedShard = 'deferred';
         });
       }
      return () => bag.dispose();
    }
  };
}

export { MASTER_REGISTRY, FILINGS_URL, HOLDINGS_URL, MANAGER_CATALOG_URL, ROW_PREVIEWS_URL, FILING_DISCOVERY_URL, MANAGER_PRINCIPLES_URL, SECURITY_MASTER_URL, SECURITY_MASTER_REFERENCE_URL, HISTORY_INDEX_URL, TICKER_INDEX_REFERENCE_URL, buildManagerRegistry, deriveCoverageSummary };
