import { STYLE_FRAMES, groupManagersByStyle } from '../../domain/masters/style-frames.js';
import { renderManagersPage } from '../knowledge/managers-view.js';
import { createResourceBag } from '../../app/lifecycle.js';
import { navigateKnowledgeTarget, parseKnowledgeRouteState, parseKnowledgeTargetContext, replaceKnowledgeRouteState } from '../../app/knowledge-route-state.js';
import { loadJsonArtifact } from '../../data/artifact-cache.js';
import { applySafeExternalLink } from '../../ui/knowledge/safe-external-link.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';

const REVIEWED_AT = '2026-08-16';
const FILINGS_URL = './public-data/masters/filings.json';
const HOLDINGS_URL = './public-data/masters/holdings-summary.json';
const SECURITY_MASTER_URL = './public-data/masters/security-master.json';
const SECURITY_MASTER_REFERENCE_URL = './public-data/masters/security-master-reference.json';
const HISTORY_INDEX_URL = './public-data/masters/history-index.json';
const MANAGER_CATALOG_URL = './public-data/masters/manager-catalog.json';
const ROW_PREVIEWS_URL = './public-data/masters/manager-row-previews.json';
const FILING_DISCOVERY_URL = './public-data/masters/filing-discovery.json';
const MANAGER_PRINCIPLES_URL = './public-data/masters/manager-principles.json';
const TICKER_INDEX_REFERENCE_URL = './public-data/masters/ticker-index-reference.json';
const TICKER_INDEX_LOAD_OPTIONS = Object.freeze({ timeoutMs: 8000 });

// MF-05: holding rows are rendered only from a verified SEC EDGAR
// filer/CIK/filing artifact; the registry itself never invents rows.
const MASTER_REGISTRY = Object.freeze([
  Object.freeze({ id: 'berkshire-hathaway', name: 'Warren Buffett', filer: 'Berkshire Hathaway Inc.', style: '집중·가치·장기 보유', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'duquesne-family-office', name: 'Stanley Druckenmiller', filer: 'Duquesne Family Office LLC', style: '거시·성장·변화 대응', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'fisher-asset-management', name: 'Ken Fisher', filer: 'Fisher Asset Management, LLC', style: '글로벌·분산·대형주', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'pershing-square', name: 'Bill Ackman', filer: 'Pershing Square Capital Management, L.P.', style: '집중·행동주의', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'appaloosa-management', name: 'David Tepper', filer: 'Appaloosa LP', style: '거시·가치·전환', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'baupost-group', name: 'Seth Klarman', filer: 'Baupost Group LLC/MA', style: '가치·하방 방어', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'scion-asset-management', name: 'Michael Burry', filer: 'Scion Asset Management, LLC', style: '비대칭·헤지·이벤트', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' })
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
  compare: '투자자 비교',
  principles: '투자 원칙',
  ownership: '13D/G 소유권',
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
    NOTICE_FILED: '13F 통지서 제출',
    CURRENT_ROWS: '최신 행 연결',
    STALE_OR_MISSING_ROWS: '최신 행 대사 필요',
    BLOCKED: '원천 확인 차단',
    METHOD_ONLY: '방법론 전용',
    PENDING_SEC_ROW_IMPORT: '행 가져오기 대기',
    SEC_ROW_PREVIEW: 'SEC 행 미리보기',
    UNVERIFIED_DISCOVERY: '발견 단서·미검증',
    PENDING: '준비 중'
  })[status] || status || '확인 필요';
}

function buildManagerRegistry(catalog) {
  const merged = MASTER_REGISTRY.map((manager) => ({ ...manager }));
  (catalog?.managers || []).forEach((entry) => {
    const sourceUrl = entry.sourceEvidence || entry.latestFiling?.indexUrl || 'https://www.sec.gov/edgar/search-and-access';
    const normalized = {
      id: entry.id,
      name: entry.displayName || entry.name || entry.id,
      filer: entry.filer || 'SEC institutional manager',
      style: entry.style || '분류 대기',
      type: entry.type || 'LIVE_13F',
      status: entry.status || 'PENDING',
      rowStatus: entry.rowStatus || null,
      cik: entry.cik || null,
      latestFiling: entry.latestFiling || null,
      latestAvailablePeriod: entry.latestAvailablePeriod || entry.latestFiling?.periodOfReport || null,
      latestSubmission: entry.latestSubmission || null,
      noticeStatus: entry.noticeStatus || null,
      freshnessStatus: entry.freshnessStatus || null,
      rowFreshnessStatus: entry.rowFreshnessStatus || null,
      audienceTier: entry.audienceTier || null,
      managerCategory: entry.managerCategory || null,
      scaleTier: entry.scaleTier || null,
      scaleBasis: entry.scaleBasis || null,
      scaleMetric: entry.scaleMetric || null,
      operator: entry.operator || null,
      strategyProfile: entry.strategyProfile || null,
      teachingUse: entry.teachingUse || null,
      selectionReason: entry.selectionReason || null,
      sourceName: entry.type === 'METHOD_ONLY' ? '공식 방법론 자료' : 'SEC EDGAR',
      sourceUrl
    };
    const index = merged.findIndex((manager) => manager.id === entry.id);
    if (index >= 0) merged[index] = { ...merged[index], ...normalized };
    else merged.push(normalized);
  });
  return merged;
}


function matches(manager, query) {
  if (!query) return true;
  return [manager.name, manager.filer, manager.style, manager.type, manager.status, manager.cik, manager.managerCategory, manager.scaleTier, manager.operator?.names?.join(' '), manager.strategyProfile?.approach, manager.strategyProfile?.horizon].join(' ').toLowerCase().includes(query);
}

function formatOperator(manager) {
  const names = manager.operator?.names || [];
  const roles = manager.operator?.roles || [];
  return names.length ? names.map((name, index) => roles[index] ? `${name} (${roles[index]})` : name).join(' · ') : '운영 책임자 확인 필요';
}

function createManagerCard(documentRef, manager, selected, statusOverride = manager.status, freshnessStatus = null, reportPeriod = null, holdingMeta = null) {
  const card = button(documentRef, `masters-manager-card${selected ? ' is-selected' : ''}`, '', 'select-manager', manager.id);
  card.setAttribute('aria-pressed', selected ? 'true' : 'false');
  card.setAttribute('aria-label', `${manager.name} ${reportPeriod ? `${reportPeriod} 13F` : statusLabel(statusOverride)} 보기`);
  const stateText = manager.type === 'METHOD_ONLY'
    ? '투자 방법론'
    : `${reportPeriod || '공시 연결 중'}${freshnessStatus === 'STALE_REFERENCE' ? ' · 최신 제출 공백' : ' · 13F'}`;
  card.append(
    element(documentRef, 'strong', 'masters-manager-name', manager.name),
    element(documentRef, 'span', 'masters-manager-filer', manager.filer),
    element(documentRef, 'span', 'masters-manager-style', manager.style),
    element(documentRef, 'span', 'masters-manager-operator', `운영 ${formatOperator(manager)}`),
    element(documentRef, 'span', 'masters-manager-profile', [manager.scaleTier, manager.strategyProfile?.approach].filter(Boolean).join(' · ') || '전략·규모 분류 확인 필요'),
    element(documentRef, 'span', 'masters-manager-scale', manager.scaleMetric?.label || '공식 규모값 확인 필요'),
    element(documentRef, 'span', `masters-manager-state${freshnessStatus === 'STALE_REFERENCE' ? ' is-stale' : ''}`, stateText),
    element(documentRef, 'span', 'masters-manager-profile', holdingMeta?.verification?.fullRowCount != null ? `신고 행 ${holdingMeta.verification.fullRowCount}개 · Top 10 ${formatPercent(holdingMeta.verification.top10ConcentrationPct)}` : '전체 행 대사 대기'),
    element(documentRef, 'span', 'masters-manager-state', holdingMeta?.verification?.comparisonActionCounts ? summarizeLatestChange(holdingMeta.verification.comparisonActionCounts) : statusLabel(manager.rowFreshnessStatus || manager.noticeStatus || statusOverride))
  );
  return card;
}

function createMetric(documentRef, label, value) {
  const card = element(documentRef, 'div', 'masters-metric');
  card.append(element(documentRef, 'span', 'masters-metric-label', label), element(documentRef, 'strong', 'masters-metric-value', value));
  return card;
}

function createTickerLookup(documentRef, tickerIndex, registry, query, loadState = 'loading') {
  const section = element(documentRef, 'section', 'masters-ticker-lookup');
  section.dataset.mastersTickerLookup = 'reference-only';
  section.dataset.mastersTickerLoadState = tickerIndex ? 'ready' : loadState;
  section.style.cssText = 'margin:0;';
  section.append(
    element(documentRef, 'p', 'masters-ticker-lookup-copy', '종목을 입력하면 이 화면의 운용사 가운데 그 종목을 보유했다고 신고한 곳을 찾아 줍니다.')
  );
  const label = element(documentRef, 'label', 'masters-search');
  label.appendChild(element(documentRef, 'span', 'masters-sr-only', '티커 또는 CUSIP 역조회'));
  const input = element(documentRef, 'input', 'masters-ticker-lookup-input');
  input.type = 'search';
  input.placeholder = '예: AAPL';
  input.value = query;
  input.autocomplete = 'off';
  input.setAttribute('aria-label', '티커 또는 CUSIP 역조회');
  input.dataset.mastersAction = 'ticker-search';
  label.appendChild(input);
  section.appendChild(label);

  const body = element(documentRef, 'div', 'masters-ticker-lookup-results');
  const normalized = String(query || '').trim().toUpperCase();
  if (!tickerIndex) {
    // P1325: this branch used to be the only non-ready state, so a failed/timed-out ledger fetch left
    // '불러오는 중' on screen forever. Every non-ready state is now explicit and a failure is retryable.
    if (loadState === 'error') {
      const failure = element(documentRef, 'p', 'masters-empty-state', '참조용 티커 원장을 불러오지 못했습니다. 잠시 뒤 다시 시도하세요. 역조회 없이도 위 대가 카드와 공시 원문은 그대로 사용할 수 있습니다.');
      failure.setAttribute('role', 'alert');
      body.append(failure, button(documentRef, 'aio-btn-table masters-ticker-lookup-retry', '티커 원장 다시 불러오기', 'retry-ticker-index', 'tickerIndex'));
    } else if (loadState === 'idle') {
      // P1330: the ledger is not part of the initial Masters payload (artifact budget); it loads on
      // first focus/typing or the "종목으로 역조회" button, so this idle state is never a spinner.
      const idle = element(documentRef, 'p', 'masters-empty-state', '예: NVDA · AAPL · 037833100');
      idle.setAttribute('role', 'status');
      body.appendChild(idle);
    } else {
      const pending = element(documentRef, 'p', 'masters-empty-state', '참조용 티커 원장을 불러오는 중입니다.');
      pending.setAttribute('role', 'status');
      body.appendChild(pending);
    }
  } else if (tickerIndex.status !== 'REFERENCE_ONLY') {
    body.appendChild(element(documentRef, 'p', 'masters-empty-state', '참조용 티커 원장의 상태를 확인할 수 없어 역조회를 보류합니다.'));
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
          element(documentRef, 'span', 'masters-ticker-lookup-issuer', (record.issuerReferences || []).join(' · ') || '발행인명 확인 필요'),
          element(documentRef, 'span', 'masters-ticker-lookup-meta', `CUSIP ${record.cusips?.join(', ') || '확인 필요'}`)
        );
        // Codex review 2026-10-05: the same manager appeared on several raw rows (separate filing lines,
        // classes, puts/calls) while the question is "who holds it". One line per manager: the latest
        // period's shares and value summed over direct holdings, with option positions named separately
        // (their share counts are underlying exposure, never added to holdings). Raw rows open on demand.
        const allRows = Array.isArray(record.rows) ? record.rows : [];
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
        }).sort((a, b) => b.value - a.value);
        const rows = element(documentRef, 'ul', 'masters-ticker-lookup-rows');
        summaries.forEach((summary) => {
          const manager = registryById.get(summary.managerId);
          const item = element(documentRef, 'li', 'masters-ticker-lookup-row');
          item.dataset.lookupManager = summary.managerId;
          const optionText = summary.options.length ? ` · 옵션 ${summary.options.map((row) => `${row.putCall === 'Put' ? '풋' : '콜'} ${Number(row.shares || 0).toLocaleString('en-US')}주 기준`).join(', ')}` : '';
          const holding = summary.direct ? `${summary.shares.toLocaleString('en-US')}주 · ${formatReportedValue(summary.value)}` : '직접 보유 없음';
          const detail = element(documentRef, 'details', 'masters-ticker-lookup-detail');
          detail.appendChild(element(documentRef, 'summary', '', `${manager?.name || summary.managerId} · ${summary.period} · ${holding}${optionText}`));
          const raw = element(documentRef, 'ul', 'masters-ticker-lookup-raw');
          summary.latest.forEach((row) => {
            const line = element(documentRef, 'li', '');
            const source = element(documentRef, 'a', 'masters-source-link', 'SEC 원문');
            applySafeExternalLink(source, row.sourceUrl);
            line.append(element(documentRef, 'span', '', `${row.titleOfClass || '보통주'}${row.putCall ? ` · ${row.putCall === 'Put' ? '풋옵션' : '콜옵션'}` : ''} · ${Number(row.shares || 0).toLocaleString('en-US')}주 · ${formatReportedValue(row.value)} `), source);
            raw.appendChild(line);
          });
          detail.appendChild(raw);
          item.appendChild(detail);
          rows.appendChild(item);
        });
        card.appendChild(rows);
        card.appendChild(element(documentRef, 'span', 'masters-ticker-lookup-count', `운용사 ${summaries.length}곳 · 원문 ${allRows.length}행`));
        body.appendChild(card);
      });
    }
  }
  body.appendChild(element(documentRef, 'p', 'masters-ticker-lookup-boundary', '결과는 분기 말 기준으로 신고된 보유다. 지금도 들고 있는지, 언제 사고팔았는지는 알 수 없고, 종목 코드 연결은 참고용이다.'));
  section.appendChild(body);
  return section;
}


function deriveCoverageSummary(registry = [], catalog = null, holdings = null, previews = null, discovery = null, principlesArtifact = null, securityMaster = null) {
  const filerIds = new Set(registry.filter((manager) => manager.type !== 'METHOD_ONLY').map((manager) => manager.id));
  const methodOnly = registry.filter((manager) => manager.type === 'METHOD_ONLY').length;
  const shardCount = Object.keys(holdings?.managerShards || {}).length;
  const shardIntegrityVerified = holdings?.shardIntegrityStatus === 'VERIFIED' && Number(holdings?.shardsVerified) === shardCount && shardCount === filerIds.size;
  const fullManagers = shardIntegrityVerified ? (holdings?.managers || []).filter((manager) => filerIds.has(manager.id) && Number(manager.verification?.fullRowCount) > 0) : [];
  const fullIds = new Set(fullManagers.map((manager) => manager.id));
  const latestPeriod = holdings?.latestAvailablePeriod || discovery?.latestAvailablePeriod || null;
  const currentFull = fullManagers.filter((manager) => manager.freshnessStatus === 'CURRENT_REFERENCE' && manager.verification?.reportPeriod === latestPeriod).length;
  const staleFull = fullManagers.length - currentFull;
  const previewIds = new Set((previews?.managers || []).map((manager) => manager.managerId).filter((managerId) => filerIds.has(managerId) && !fullIds.has(managerId)));
  const metadataOnly = [...filerIds].filter((managerId) => !fullIds.has(managerId) && !previewIds.has(managerId)).length;
  const officialPrinciples = principlesArtifact
    ? (principlesArtifact.profiles || []).filter((profile) => profile.sourceUrl && profile.statedPrinciples?.length).length
    : Number(holdings?.enrichmentSummary?.officialPrinciples || 0);
  const verifiedSecurityRecords = securityMaster
    ? Number(securityMaster.coverage?.recordsPublished || 0)
    : Number(holdings?.enrichmentSummary?.verifiedSecurityRecords || 0);
  const discovered = Number(discovery?.coverage?.discovered || 0);
  const blocked = Number(discovery?.coverage?.blocked || 0);
  const discoveryComplete = discovery?.status === 'CURRENT' && discovered === filerIds.size && blocked === 0;
  const rowCoverageComplete = currentFull === filerIds.size && staleFull === 0 && previewIds.size === 0 && metadataOnly === 0;
  const principlesComplete = registry.length > 0 && officialPrinciples === registry.length;
  const securityMasterComplete = verifiedSecurityRecords > 0
    && (securityMaster?.coverage?.sectorWeightsPublished === true || holdings?.enrichmentSummary?.sectorWeightsPublished === true)
    && !/PENDING|PARTIAL|REFERENCE/i.test(String(securityMaster?.status || holdings?.enrichmentSummary?.securityMasterStatus || ''));
  const enrichmentComplete = principlesComplete && securityMasterComplete;
  return {
    state: discoveryComplete && rowCoverageComplete && enrichmentComplete ? 'complete' : 'partial',
    discoveryState: discoveryComplete ? 'complete' : 'partial',
    rowCoverageState: rowCoverageComplete ? 'complete' : 'partial',
    enrichmentState: enrichmentComplete ? 'complete' : 'partial',
    profiles: registry.length,
    filers: filerIds.size,
    methodOnly,
    currentFull,
    staleFull,
    previewOnly: previewIds.size,
    metadataOnly,
    latestPeriod,
    latestPeriodMissing: Math.max(0, filerIds.size - currentFull),
    officialPrinciples,
    verifiedSecurityRecords,
    discovered,
    blocked,
    discoveryComplete,
    rowCoverageComplete,
    shardIntegrityVerified,
    catalogStatus: catalog?.status || 'NOT_CONNECTED'
  };
}

function createMastersArrivalContext(documentRef, context, onReturn) {
  if (!context || context.routeId !== 'masters') return null;
  const block = element(documentRef, 'aside', 'masters-arrival-context');
  block.setAttribute('aria-label', '개념·분석 프레임에서 이어 읽기');
  block.append(
    element(documentRef, 'span', 'masters-eyebrow', '개념·분석 프레임에서 이어 읽기'),
    element(documentRef, 'strong', 'masters-arrival-title', '시장의 기대를 기관의 공개 보유 변화와 대조합니다.'),
    element(documentRef, 'p', 'masters-catalog-copy', '13F는 분기 말의 지연된 스냅샷입니다. 먼저 같은 보고분기의 신고 수량 변화를 보고, 다음으로 원본 공시와 누락 자산 경계를 확인한 뒤, 이야기에서 세운 가설과 일치하는지 비교하세요.')
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
    element(documentRef, 'summary', 'masters-catalog-title', `데이터 범위와 검증 상태 보기 · SEC 발견 ${summary.discoveryState === 'complete' ? '전체' : '부분'} · 13F 행 ${summary.rowCoverageState === 'complete' ? '전체' : '부분'} · 보강 ${summary.enrichmentState === 'complete' ? '전체' : '부분'}`),
    element(documentRef, 'p', 'masters-catalog-copy masters-coverage-classification', `현재 분류 ${summary.profiles}개: 최신 전체 행 ${summary.currentFull} · 지연 전체 행 ${summary.staleFull} · 원문 미리보기만 ${summary.previewOnly} · 메타데이터만 ${summary.metadataOnly} · 방법론 전용 ${summary.methodOnly}`),
    element(documentRef, 'p', 'masters-catalog-boundary masters-latest-quarter-boundary', `${summary.latestPeriod || '최신분기 확인 필요'} 기준 13F 신고주체 ${summary.filers}개 중 ${summary.latestPeriodMissing}개는 최신분기 전체 행이 연결되지 않았습니다. 프로필·CIK·과거 공시 링크가 있어도 최신 보유 데이터 완성을 뜻하지 않습니다.`),
    element(documentRef, 'p', 'masters-catalog-boundary masters-discovery-boundary', `SEC 발견 artifact 기준일 ${discoveryAsOf}: 제출주체 ${summary.discovered}/${summary.filers} · 차단/미완료 ${summary.blocked}. 이 artifact 상태는 수집 실행 결과이며 repository 변수 설정 존재 여부와 같은 뜻이 아닙니다. 최신 온라인 조회 시각은 별도로 표시되지 않습니다.`),
    element(documentRef, 'p', 'masters-catalog-boundary masters-shard-integrity-boundary', `브라우저 전체 행 원장 무결성 ${summary.shardIntegrityVerified ? '검증 완료' : '검증 미완료'}. 신고 메타데이터의 행 수와 실제 선택 로드 shard 길이가 일치할 때만 전체 행 연결로 분류합니다.`),
    element(documentRef, 'p', 'masters-catalog-boundary masters-enrichment-boundary', `공식 투자 원칙 원고 ${summary.officialPrinciples}/${summary.profiles} · 검증 issuer·ticker·sector master ${summary.verifiedSecurityRecords}개. 나머지 원칙은 catalog 전략 분류이며, 참고 섹터 분류는 검증 master로 승격하지 않습니다.`),
    element(documentRef, 'p', 'masters-catalog-copy', `SEC 메타데이터 상태 ${coverage.secMetadataVerified || 0}개 · 전체 행 대사 ${fullManagersLabel(summary)} · 원문 행 미리보기 ${coverage.rowPreviewManagers || 0}개/${coverage.previewRows || 0}행`),
    element(documentRef, 'p', 'masters-catalog-boundary masters-history-boundary', `12분기 심화 이력은 우선순위 ${holdings?.historySummary?.connectedManagers || 0}/${summary.filers}개 기관에 연결되어 있습니다. 나머지 기관은 최신·직전 분기 비교까지만 제공하며 장기 이력이 있는 것처럼 확대 표시하지 않습니다.`),
    element(documentRef, 'p', 'masters-catalog-copy', '각 카드에는 운영 책임자, 규모 구간, 전략 성격을 함께 표시합니다. 13F 신고 주체와 실제 투자 책임자는 다를 수 있으므로 두 축을 구분해 읽습니다.'),
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

function formatReportedValue(value) {
  return value == null ? '—' : `$${new Intl.NumberFormat('en-US').format(value)}`;
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '—';
}

function summarizeLatestChange(counts = {}) {
  return `보고 수량상 신규 ${counts.NEW || 0} · 확대 ${counts.INCREASED || 0} · 축소 ${counts.REDUCED || 0} · 제외 ${counts.EXITED || 0}`;
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
    counts.appendChild(element(documentRef, 'span', `masters-change-count masters-change-${action.toLowerCase()}`, `보고 수량상 ${ACTION_LABELS[action]} ${count}`));
  });
  summary.appendChild(counts);
  return summary;
}


// SEC conformed names (e.g. "OCCIDENTAL PETROLEUM CORP /DE/") without the state suffix.
function formatIssuerName(name) {
  return String(name).replace(/\s*\/[A-Z]{2,3}\/?\s*$/, '').trim();
}

function createOwnershipEvents(documentRef, manager, discovery) {
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
  const list = element(documentRef, 'ul', 'masters-ownership-list');
  events.forEach((event) => {
    const item = element(documentRef, 'li', 'masters-ownership-item');
    const form = String(event.form || '');
    const kind = /13D/.test(form) ? '경영 참여 가능 보유(13D)' : /13G/.test(form) ? '단순 투자 보유(13G)' : form;
    const change = /\/A$/.test(form) ? ' 변경' : ' 최초';
    const issuer = event.subjectCompany ? formatIssuerName(event.subjectCompany) : '발행사 확인 전';
    const percent = Number.isFinite(event.percentOfClass) ? ` · 지분 ${event.percentOfClass}%` : '';
    item.appendChild(element(documentRef, 'span', 'masters-ownership-issuer', `${issuer}${percent}`));
    item.appendChild(element(documentRef, 'span', '', ` · ${kind}${change} · ${event.filedAt || '제출일 확인 필요'} `));
    const link = element(documentRef, 'a', 'masters-source-link', '원문');
    applySafeExternalLink(link, event.indexUrl);
    item.appendChild(link);
    list.appendChild(item);
  });
  section.appendChild(list);
  return section;
}

function fullManagersLabel(summary) {
  return `${summary.currentFull + summary.staleFull}/${summary.filers}개 (최신 ${summary.currentFull} · 지연 ${summary.staleFull})`;
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

function createHoldingRow(documentRef, row, index, includeAction = true) {
  const tr = element(documentRef, 'tr', '');
  const formatter = new Intl.NumberFormat('en-US');
  const values = [String(row.rank || index + 1), row.issuer || '—', row.cusipNormalized || row.cusip || '—', formatReportedValue(row.value), formatter.format(row.shares || 0)];
  if (includeAction) values.push(formatDelta(row.sharesDelta, formatter), formatDelta(row.valueDelta, formatter));
  values.push(row.putCall || '—');
  values.forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
  if (includeAction) {
    const action = row.action || 'UNAVAILABLE';
    const prefix = row.actionConfidence === 'REVIEW_REQUIRED' ? '신고 수량상 ' : '';
    tr.appendChild(element(documentRef, 'td', `masters-action masters-action-${action.toLowerCase()}`, `${prefix}${ACTION_LABELS[action] || action}`));
  }
  tr.title = `${row.evidenceId || 'SEC reference'} · ${row.reportPeriod || ''}`;
  return tr;
}

function createTopHoldingTable(documentRef, manager, holdingMeta, rows) {
  const section = element(documentRef, 'section', 'masters-holdings-section');
  const heading = element(documentRef, 'div', 'masters-holdings-heading');
  heading.append(
    element(documentRef, 'h4', 'masters-holdings-title', '상위 보고 보유 종목 · CUSIP·주식 유형·Put/Call 집계'),
    element(documentRef, 'p', 'masters-holdings-meta', `${holdingMeta?.verification?.reportPeriod || '보고분기 확인 필요'} · 상위 ${rows.length}개 · 전체 신고 행 ${holdingMeta?.verification?.fullRowCount || '—'}개`)
  );
  const table = createTable(documentRef, ['#', '발행사', 'CUSIP(증권 코드)', '신고 가치', '주식 수', '수량 변화', '가치 변화', '옵션', '변화 분류'], rows, (row, index) => createHoldingRow(documentRef, row, index, true));
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
  section.appendChild(element(documentRef, 'h4', 'masters-holdings-title', '분기 변화 원장 · CUSIP·주식 유형·Put/Call 집계'));
  section.appendChild(element(documentRef, 'p', 'masters-holdings-meta', '두 보고분기의 신고 주식 수 차이에서 계산한 분류이며 모든 행은 재검토 대상입니다. 현재 가격, 실제 체결 매매, 매매 신호, 목표가를 뜻하지 않습니다.'));
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
  const table = createTable(documentRef, ['#', '발행사', 'CUSIP(증권 코드)', '신고 가치', '주식 수', '수량 변화', '가치 변화', '변화 분류'], pageRows, (row, index) => {
    const tr = element(documentRef, 'tr', '');
    const formatter = new Intl.NumberFormat('en-US');
    [String(start + index + 1), row.issuer || '—', row.cusipNormalized || row.cusip || '—', formatReportedValue(row.value), formatter.format(row.shares || 0), formatDelta(row.sharesDelta, formatter), formatDelta(row.valueDelta, formatter)].forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
    tr.appendChild(element(documentRef, 'td', `masters-action masters-action-${String(row.action || 'UNAVAILABLE').toLowerCase()}`, `${ACTION_LABELS[row.action] || row.action || '비교 불가'}`));
    tr.title = `${row.evidenceId || 'SEC comparison'} · 이전 보고분기 ${row.priorReportPeriod || '확인 필요'} · ${row.actionBasis || 'REPORTED_SHARE_DELTA'} · ${row.actionConfidence || 'REVIEW_REQUIRED'}`;
    return tr;
  }, 'masters-comparison-table masters-holdings-table');
  section.append(filters, table, createPagination(documentRef, state.page, pageCount, filtered.length));
  return section;
}

function createFullHoldingsView(documentRef, fullRows, state, descriptor = null) {
  const section = element(documentRef, 'section', 'masters-holdings-section');
  const heading = element(documentRef, 'div', 'masters-holdings-heading');
  heading.append(
    element(documentRef, 'h4', 'masters-holdings-title', '신고 보유 행 웹 투영'),
    element(documentRef, 'p', 'masters-holdings-meta', `SEC 정보표 중 ${fullRows.length.toLocaleString('en-US')}행 투영 / 전체 ${Number(descriptor?.fullRows || fullRows.length).toLocaleString('en-US')}행 · 페이지당 25개 · 검색은 현재 투영 범위`),
    element(documentRef, 'p', 'masters-holdings-meta masters-raw-row-boundary', '원문 분할행은 이전 분기 행과 일대일 대응이 검증되지 않아 행별 변화를 표시하지 않습니다. 종목 집계 변화는 분기 변화 원장에서 확인하세요.')
  );
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
  const table = createTable(documentRef, ['#', '발행사', 'CUSIP(증권 코드)', '신고 가치', '주식 수', '옵션'], pageRows, (row, index) => createHoldingRow(documentRef, row, start + index, false), 'masters-full-holdings-table masters-holdings-table');
  section.append(heading, controls, table, createPagination(documentRef, state.page, pageCount, filtered.length));
  return section;
}



function createRowPreviewView(documentRef, manager, previewMeta, previewRows) {
  const section = element(documentRef, 'section', 'masters-holdings-section masters-row-preview');
  const heading = element(documentRef, 'div', 'masters-holdings-heading');
  heading.append(
    element(documentRef, 'h4', 'masters-holdings-title', 'SEC 원문 행 미리보기 · 전체 원장 대기'),
    element(documentRef, 'p', 'masters-holdings-meta', `${previewMeta?.reportPeriod || '보고분기 확인 필요'} · ${previewRows.length}개 표시 행 · 전체 신고 행 수 미확정`)
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
    tr.title = `${previewMeta?.accession || 'SEC information table'} · preview only`;
    return tr;
  }, 'masters-row-preview-table masters-holdings-table');
  section.append(heading, notice, table);
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
    element(documentRef, 'h4', 'masters-holdings-title', '섹터 구성 · 참고 분류'),
    element(documentRef, 'p', 'masters-holdings-meta', `신고 보유 ${fullRows.length}행 가운데 공개 식별자로 섹터를 붙일 수 있었던 ${mappedRows.length}행(${formatReportedValue(totalValue)}) 기준이다. 분류는 참고용이라, 공식 섹터 자료로 한 번 더 확인되기 전까지 비중은 대략적인 구성으로만 읽는다.`)
  );
  const rows = [...sectorTotals.entries()].sort((a, b) => b[1].value - a[1].value).map(([sector, values]) => ({ sector, ...values }));
  section.appendChild(createTable(documentRef, ['참고 섹터', '보유 행', '신고 가치', '분류된 보유 중 비중'], rows, (row) => {
    const tr = element(documentRef, 'tr', '');
    [row.sector, String(row.rows), formatReportedValue(row.value), totalValue ? `${((row.value / totalValue) * 100).toFixed(1)}%` : '—'].forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
    return tr;
  }, 'masters-sector-reference-table masters-holdings-table'));
  section.appendChild(element(documentRef, 'p', 'masters-holdings-meta', `분류 기준일 ${referenceMaster.reviewedAt} · SEC 신고 원문의 발행사·CUSIP와 공개 식별자 대조로 붙인 섹터다.`));
  return section;
}

// Codex review 2026-10-05 (Berkshire 2025Q1: 4 rows, $1.1B beside $250B+ quarters): a 13F-HR/A that
// only adds holdings released from confidential treatment is not the quarter. A period represented by an
// amendment without a composed original (or a restatement) holds its count and value instead of being
// compared with full quarters. The producer composes these since P1449; this guards older artifacts.
export function isPartialAmendmentPeriod(period, imported = null) {
  if (imported) return false;
  if (!/\/A$/.test(String(period?.form || ''))) return false;
  const roles = period?.composition?.roles || [];
  if (roles.includes('ORIGINAL') || roles[0] === 'RESTATEMENT') return false;
  if (period?.compositionStatus === 'ORIGINAL_CONNECTED') return false;
  return true;
}

function createQuarterView(documentRef, holdingMeta, historyManager, historyRowsArtifact) {
  const verification = holdingMeta?.verification;
  const section = element(documentRef, 'section', 'masters-holdings-section');
  section.appendChild(element(documentRef, 'h4', 'masters-holdings-title', '분기 보고 추이'));
  section.appendChild(element(documentRef, 'p', 'masters-holdings-meta', `최근 ${historyManager?.historyDepthTarget || 12}개 분기에 SEC에 신고한 보유 행 수와 신고 가치입니다. 정정 공시는 원본과 합쳐 분기 전체가 확인될 때만 추이에 넣습니다.`));
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
    const partial = isPartialAmendmentPeriod(period, imported);
    return { period: period.periodOfReport, partial, count: partial ? null : imported?.count ?? period.rowCount ?? historical?.count ?? null, partialCount: partial ? period.rowCount ?? historical?.count ?? null : null, value: partial ? null : imported?.value ?? period.reportedValueTotal ?? historical?.value ?? null, reconciliation: imported?.reconciliation ?? period.countReconciled ?? false, filedAt: period.filedAt, accession: period.accession, rowImportStatus: period.rowImportStatus, indexUrl: period.indexUrl, composition: period.composition || null };
  });
  const table = createTable(documentRef, ['보고 분기', '보유 행', '신고 가치 합계', '상태', '원문'], rows, (row) => {
    const tr = element(documentRef, 'tr', '');
    let state;
    if (row.partial) state = `부분 공시 — 정정 공시의 추가 보유 ${row.partialCount ?? '일부'}행만 연결돼 분기 전체 비교 보류`;
    else if (row.rowImportStatus === 'REVIEW_REQUIRED') state = '분기 전체를 구성하지 못해 보류';
    else if (row.rowImportStatus === 'IMPORTED_CURRENT' || row.rowImportStatus === 'IMPORTED_PRIOR' || row.rowImportStatus === 'IMPORTED_HISTORICAL') {
      const reconciledLabel = row.reconciliation ? '표지 합계와 일치' : '표지 합계와 차이 — 확인 필요';
      state = row.composition?.composite ? `${reconciledLabel} · ${row.composition.label}` : reconciledLabel;
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

function createIssuerAggregateView(documentRef, aggregateArtifact, managerId) {
  const section = element(documentRef, 'section', 'masters-holdings-section masters-issuer-aggregate-view');
  const records = (aggregateArtifact?.aggregates || []).filter((record) => record.managerId === managerId);
  const periods = new Set(records.flatMap((record) => record.periods || []).map((period) => period.reportPeriod).filter(Boolean));
  const reviewQueue = records.filter((record) => record.reviewFlags?.length || record.corporateActionStatus !== 'REVIEWED');
  // W04-A/P1149 (C01): the per-manager summary must be computed from the selected manager's
  // records with the SAME function as the table below. The whole-artifact coverage belongs in its
  // own labelled block — a manager-scoped card must never show another scope's denominator.
  // CUSIP count, unique report periods, and manager·CUSIP·share-type·put/call records are
  // different counts and are never assumed equal.
  const managerCusips = new Set(records.map((record) => record.cusipNormalized).filter(Boolean));
  const managerPeriodRows = records.reduce((sum, record) => sum + (record.periods?.length || 0), 0);
  const scope = { managerId: managerId || null, reportPeriods: [...periods].sort(), aggregationKey: 'manager·CUSIP·shareType·putCall' };
  section.append(
    element(documentRef, 'h4', 'masters-holdings-title', 'issuer·CUSIP 다분기 집계 원장'),
    element(documentRef, 'p', 'masters-holdings-meta', `SEC 원문 행을 manager·CUSIP·share type·put/call 단위로만 묶은 원장입니다. ticker·sector·기업행동 검증 전 단계이며, 현재 가격이나 추천을 생성하지 않습니다.`)
  );
  const metrics = element(documentRef, 'div', 'masters-normalization-metrics');
  [
    ['선택 manager 집계 CUSIP', String(managerCusips.size)],
    ['선택 manager 고유 보고기간', String(periods.size)],
    ['선택 manager 집계 record', String(records.length)],
    ['선택 manager 기간행 수', String(managerPeriodRows)],
    ['선택 manager 검토 대기', String(reviewQueue.length)],
    ['전체 수집 원장 (모든 manager)', `${aggregateArtifact?.coverage?.aggregateRecords ?? '—'} records · 기간 ${aggregateArtifact?.coverage?.periods ?? '—'} · 검토 대기 ${aggregateArtifact?.coverage?.reviewQueue ?? '—'}`]
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
        (record.issuerNames || []).join(' · ') || 'issuer text 없음',
        record.cusipNormalized || '—',
        latest?.reportPeriod || '—',
        latest ? formatReportedValue(latest.valueUsd) : '—',
        String(record.periodCount || 0),
        record.reviewFlags?.length ? record.reviewFlags.join(' · ') : '추가 플래그 없음'
      ];
      values.forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
      return tr;
    }, 'masters-issuer-aggregate-table masters-holdings-table'));
  }
  section.appendChild(element(documentRef, 'p', 'masters-holdings-meta', `집계 상태 ${aggregateArtifact?.status || 'NOT_CONNECTED'} · 기준일 ${aggregateArtifact?.reviewedAt || '확인 필요'} · 범위 manager=${scope.managerId || '—'} · 보고기간 ${scope.reportPeriods.length}개 · 집계키 ${scope.aggregationKey} · 검토 대기 CUSIP는 공식 security master와 기업행동 원장 확인 전까지 ticker·sector로 승격하지 않습니다.`));
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

function createPrinciplesView(documentRef, manager, principlesArtifact) {
  const section = element(documentRef, 'section', 'masters-principles-view masters-holdings-section');
  const profile = principlesArtifact?.profiles?.find((item) => item.managerId === manager.id);
  section.append(
    element(documentRef, 'h4', 'masters-holdings-title', '공식 원칙과 관찰 패턴'),
    element(documentRef, 'p', 'masters-holdings-meta', profile
      ? '공식 자료에서 확인되는 원칙과 공개 13F에서 관찰되는 패턴을 분리해 표시합니다.'
      : '공식 원칙 원고가 아직 연결되지 않아 catalog의 전략 분류만 표시합니다. 이 분류를 본인의 직접 발언으로 해석하지 않습니다.')
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
    section.appendChild(element(documentRef, 'h5', 'masters-holdings-title', '공개 보유에서 관찰되는 패턴'));
    const observed = element(documentRef, 'ul', 'masters-principles-limitations');
    profile.observedHoldingsPatterns.forEach((item) => observed.appendChild(element(documentRef, 'li', '', item)));
    section.appendChild(observed);
  }
  const limits = profile?.limitations || [manager.teachingUse || '교육용 전략 분류', '현재 종목 추천이나 성과 예측으로 사용하지 않습니다.'];
  const limitationList = element(documentRef, 'ul', 'masters-principles-limitations');
  limits.forEach((item) => limitationList.appendChild(element(documentRef, 'li', '', item)));
  section.appendChild(limitationList);
  if (profile?.sourceUrl) {
    const link = element(documentRef, 'a', 'masters-source-link', `${profile.sourceName || '공식 자료'} · 검토 ${profile.reviewedAt || principlesArtifact.reviewedAt}`);
    applySafeExternalLink(link, profile.sourceUrl);
    section.appendChild(link);
  }
  return section;
}

function createInvestorCompareView(documentRef, selectedIds, registry, holdingManagers, rowsByManager) {
  const section = element(documentRef, 'section', 'masters-compare-view masters-holdings-section');
  section.append(
    element(documentRef, 'h4', 'masters-holdings-title', '2~4명 공개 신고 비교'),
    element(documentRef, 'p', 'masters-holdings-meta', '같은 보고분기의 SEC 신고 행만 비교합니다. 공통 보유나 같은 방향 변화는 추천·공모·현재 포지션의 증거가 아닙니다.')
  );
  const ids = selectedIds.slice(0, 4);
  if (ids.length < 2) {
    section.appendChild(element(documentRef, 'div', 'masters-empty-state', '상세 상단의 “비교에 추가”를 눌러 2~4명을 선택하세요.'));
    return section;
  }
  const metrics = element(documentRef, 'div', 'masters-metric-grid');
  const reportPeriods = [];
  ids.forEach((id) => {
    const manager = registry.find((item) => item.id === id);
    const holding = holdingManagers.find((item) => item.id === id);
    const reportPeriod = holding?.verification?.reportPeriod || null;
    if (reportPeriod) reportPeriods.push(reportPeriod);
    const rowCount = Number.isFinite(Number(holding?.verification?.fullRowCount)) ? `${Number(holding.verification.fullRowCount)}행` : '행 확인 필요';
    metrics.appendChild(createMetric(documentRef, manager?.name || id, `${reportPeriod || '분기 확인 필요'} · Top10 ${formatPercent(holding?.verification?.top10ConcentrationPct)} · ${rowCount}`));
  });
  section.appendChild(metrics);
  const uniquePeriods = [...new Set(reportPeriods)];
  if (reportPeriods.length !== ids.length || uniquePeriods.length !== 1) {
    const periodSummary = ids.map((id) => {
      const manager = registry.find((item) => item.id === id);
      const holding = holdingManagers.find((item) => item.id === id);
      return `${manager?.name || id} ${holding?.verification?.reportPeriod || '분기 미확인'}`;
    }).join(' · ');
    section.appendChild(element(documentRef, 'div', 'masters-empty-state masters-compare-period-mismatch', `선택 운용사의 보고분기가 일치하지 않아 공통 보유 비교를 보류합니다. ${periodSummary}`));
    return section;
  }
  const commonPeriod = uniquePeriods[0];
  const rowMaps = ids.map((id) => new Map((rowsByManager.get(id)?.holdings || [])
    .filter((row) => row.reportPeriod === commonPeriod)
    .map((row) => [row.key || `${row.cusipNormalized || row.cusip}|${row.putCall || ''}|${row.shareType || ''}`, row])));
  const commonKeys = rowMaps.length ? [...rowMaps[0].keys()].filter((key) => rowMaps.every((map) => map.has(key))) : [];
  if (commonKeys.length) {
    const common = commonKeys.slice(0, 25).map((key) => ({ key, rows: rowMaps.map((map) => map.get(key)) }));
    section.appendChild(createTable(documentRef, ['발행사', 'CUSIP(증권 코드)', '함께 보유한 운용사 수', '보고 분기'], common, ({ rows }) => {
      const tr = element(documentRef, 'tr', '');
      [rows[0]?.issuer || '—', rows[0]?.cusipNormalized || rows[0]?.cusip || '—', String(rows.length), [...new Set(rows.map((row) => row.reportPeriod).filter(Boolean))].join(' · ')].forEach((value) => tr.appendChild(element(documentRef, 'td', '', value)));
      return tr;
    }));
  } else {
    section.appendChild(element(documentRef, 'div', 'masters-empty-state', '현재 연결된 동일 CUSIP 공통 보유가 없거나 선택 운용사의 전체 행 shard가 아직 로드되지 않았습니다.'));
  }
  return section;
}

function createDetail(documentRef, manager, onRoute, filingMeta, ownershipDiscovery, holdingMeta, compactRows, fullRows, comparisonRows, previewMeta, previewRows, state, securityMaster, referenceMaster, historyManager, historyRowsArtifact, issuerAggregates, principlesArtifact, registry, holdingManagers, rowsByManager) {
  const detail = element(documentRef, 'article', 'masters-detail-card');
  const dataStatus = holdingMeta?.status || (previewRows.length ? 'SEC_ROW_PREVIEW' : filingMeta?.status || manager.status);
  const freshnessStatus = holdingMeta?.freshnessStatus || filingMeta?.freshnessStatus || null;
  detail.append(
    element(documentRef, 'div', 'masters-eyebrow', manager.type === 'METHOD_ONLY' ? '방법론 전용 프로필' : '공개 13F 신고 보유'),
    element(documentRef, 'h3', 'masters-detail-title', manager.name),
    element(documentRef, 'p', 'masters-detail-filer', [manager.filer && manager.filer !== manager.name ? `신고 법인 ${manager.filer}` : manager.filer, manager.style].filter(Boolean).join(' · '))
  );
  // Codex review 2026-10-05: a person's philosophy and the filer's holdings are different things. The
  // filing is the entity's — several funds and portfolio managers — not one person's every decision.
  if (manager.type !== 'METHOD_ONLY' && manager.filer && manager.filer !== manager.name && !/^(BlackRock|Vanguard|Citi|Goldman|JPMorgan|State Street|Capital Group|Fidelity|T\. Rowe|Wellington|Dimensional|Millennium|Renaissance|Two Sigma|Tudor|Starboard|Trian|ValueAct|Harvard)/.test(manager.name)) {
    detail.appendChild(element(documentRef, 'p', 'masters-holdings-meta masters-entity-note', `아래 보유는 ${manager.filer} 명의로 신고된 법인 전체의 보유다. ${manager.name}의 투자 철학을 보여 주는 단서이지만, 모든 종목을 한 사람이 직접 결정했다는 뜻은 아니다.`));
  }
  // A method-only profile has no 13F: no empty metric grid, compare toggle or filing tabs — only what exists.
  if (manager.type === 'METHOD_ONLY') {
    detail.appendChild(createPrinciplesView(documentRef, manager, principlesArtifact));
    return detail;
  }
  // 2026-10-05 리서치 라이브러리: verification badges and the how-to panel are internal; the reader sees the manager.
  void freshnessStatus;
  detail.querySelector('.masters-detail-title')?.setAttribute('tabindex', '-1');

  const metrics = element(documentRef, 'div', 'masters-metric-grid');
  // Fail closed: when the SEC cover total and the parsed rows disagree, every reading built on reported-value
  // totals (concentration, weight change, total) is withheld rather than shown from an unreconciled base.
  const valueMismatch = holdingMeta?.verification?.valueReconciliationStatus === 'MISMATCH';
  const withheld = (text) => (valueMismatch ? '보류' : text);
  metrics.append(
    createMetric(documentRef, '최신 보고분기', filingMeta?.latestFiling?.periodOfReport || holdingMeta?.verification?.reportPeriod || '—'),
    createMetric(documentRef, '보유 종목 수', holdingMeta?.verification?.reportedPositionCount != null ? `${holdingMeta.verification.reportedPositionCount}개` : '—'),
    createMetric(documentRef, '상위 5 · 10 비중', withheld(`${formatPercent(holdingMeta?.verification?.top5ConcentrationPct)} · ${formatPercent(holdingMeta?.verification?.top10ConcentrationPct)}`)),
    createMetric(documentRef, '직전 분기 대비', holdingMeta?.verification?.comparisonActionCounts ? summarizeLatestChange(holdingMeta.verification.comparisonActionCounts) : '—'),
    // P1444: the distance between reported-value weights — price moves alone change it — not trading turnover.
    createMetric(documentRef, '보고가치 비중 변화(회전율 아님)', withheld(formatPercent(holdingMeta?.verification?.turnoverProxyPct))),
    createMetric(documentRef, '신고 가치 합계', withheld(formatReportedValue(holdingMeta?.verification?.parsedValueTotal))),
    createMetric(documentRef, '운용 규모', manager.scaleMetric?.label || manager.scaleTier || '—'),
    createMetric(documentRef, '전략 성격', manager.strategyProfile?.approach || manager.style || '—')
  );
  detail.append(metrics);
  if (valueMismatch) detail.appendChild(element(documentRef, 'p', 'masters-note', '이 분기는 공시 표지의 합계와 보유 내역의 합계가 달라, 비중과 합계처럼 총액 기반 해석을 보류한다.'));
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
    detail.appendChild(createOwnershipEvents(documentRef, manager, ownershipDiscovery) || element(documentRef, 'div', 'masters-empty-state', 'Schedule 13D/G 소유권 이벤트 원장을 불러오는 중입니다.'));
  } else if (state.view === 'compare') {
    detail.appendChild(createInvestorCompareView(documentRef, state.compareIds, registry, holdingManagers, rowsByManager));
  } else if (state.view === 'changes') {
    const summary = createChangeSummary(documentRef, holdingMeta?.verification);
    if (summary) detail.appendChild(summary);
    if (compactRows.length && !comparisonRows.length) detail.appendChild(createTopHoldingTable(documentRef, manager, holdingMeta, compactRows));
    if (comparisonRows.length) {
      const expected = Number(holdingMeta?.verification?.comparisonRowCount) || null;
      // P1444 (review 2026-10-04): the ledger first shows the embedded preview (the full manager shard is
      // loaded only on request — artifact budget). Say how much of the comparison is on screen and offer
      // the full ledger instead of letting the scope change silently after another view loads it.
      if (expected && comparisonRows.length < expected) {
        const scope = element(documentRef, 'p', 'masters-holdings-meta masters-ledger-scope', `변화가 큰 ${comparisonRows.length}개 보유를 먼저 보여 줍니다(전체 ${expected}개). `);
        scope.appendChild(button(documentRef, 'masters-route-button is-secondary', state.loadingManagers?.has?.(manager.id) ? '전체 원장 불러오는 중…' : `전체 ${expected}개 보기`, 'load-manager', manager.id));
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
    detail.appendChild(createQuarterView(documentRef, holdingMeta, historyManager, historyRowsArtifact));
    detail.appendChild(createIssuerAggregateView(documentRef, issuerAggregates, manager.id));
  } else if (state.view === 'filings') {
    const filingView = element(documentRef, 'section', 'masters-filing-view');
    filingView.append(element(documentRef, 'h4', 'masters-holdings-title', '원본 공시와 검증 경계'), element(documentRef, 'p', 'masters-holdings-meta', '아래 링크는 SEC EDGAR 원문입니다. 공시의 보고 기준일과 제출일을 확인한 뒤 행 비교를 해석하세요.'), createFilingArtifact(documentRef, filingMeta, holdingMeta));
    detail.appendChild(filingView);
  }

  const principles = button(documentRef, 'masters-route-button is-secondary', '개념·분석 프레임에서 이어 읽기', 'route', 'principles');
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
  note.textContent = '13F는 분기 말 미국 상장 주식(일부 옵션·전환사채 포함)의 롱 포지션만 보여 줍니다. 같은 13F라도 운용 방식에 따라 보이는 부분과 보이지 않는 부분이 크게 다릅니다.';
  box.appendChild(note);
  const groups = groupManagersByStyle(catalog?.managers || []);
  const table = documentRef.createElement('table');
  table.className = 'masters-style-table';
  const head = documentRef.createElement('tr');
  ['방식', '해결하려는 문제', '수익 원천', '감수하는 위험', '13F에 보이는 것', '13F로 알 수 없는 것', '이 화면의 운용사'].forEach((label) => { const th = documentRef.createElement('th'); th.textContent = label; th.scope = 'col'; head.appendChild(th); });
  table.appendChild(head);
  for (const frame of STYLE_FRAMES) {
    const tr = documentRef.createElement('tr');
    tr.dataset.styleFrame = frame.id;
    [frame.label, frame.problem, frame.source, frame.risk, frame.sees, frame.blind, (groups.get(frame.id) || []).join(', ') || '—'].forEach((value, index) => {
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
          heading: 'Masters · 13F 분기 지연과 교차검증'
        });
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge.remove());
      }
       const sharedRoute = parseKnowledgeRouteState(root?.location);
       const arrivalContext = parseKnowledgeTargetContext({ root, locationLike: root?.location });
       const initialView = Object.hasOwn(VIEW_LABELS, sharedRoute.mode) ? sharedRoute.mode : 'changes';
       const state = { query: '', tickerQuery: '', filter: 'ALL', arrivalContext: arrivalContext?.routeId === 'masters' ? arrivalContext : null, selectedId: sharedRoute.manager || MASTER_REGISTRY[0].id, view: initialView, actionFilter: 'ALL', holdingsQuery: '', page: 1, pageSize: 25, compareIds: [], managerRows: new Map(), managerRowErrors: new Set(), loadingManagers: new Set(), loadingCapabilities: new Set(), quarterBundles: new Map(), loadingQuarterManagers: new Set(), filings: null, holdings: null, catalog: null, previews: null, discovery: null, principles: null, securityMaster: null, referenceMaster: null, history: null, tickerIndex: null, filingsError: false, holdingsError: false, catalogError: false, previewsError: false, discoveryError: false, principlesError: false, securityMasterError: false, referenceMasterError: false, historyError: false, historyRowsError: false, issuerAggregatesError: false, tickerIndexError: false };
       const isAlive = () => !scope?.disposed && (typeof scope?.isCurrent !== 'function' || scope.isCurrent());
      page.dataset.aioArchitectureRoute = 'masters';
      page.dataset.aioArchitectureRenderer = 'native';
      page.dataset.aioContentKind = 'REFERENCE';
      page.dataset.aioReviewedAt = REVIEWED_AT;

      const route = (routeId) => { if (typeof root?.showPage === 'function') root.showPage(routeId); };
      const syncSharedState = () => replaceKnowledgeRouteState({ root, state: {
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
        toolbar.append(filters, searchLabel, button(documentRef, 'masters-filter-tab masters-ticker-jump', '종목으로 역조회', 'goto-ticker-lookup', 'tickerIndex'));
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
            const rows = (state.holdings?.allHoldings || []).filter((row) => row.managerId === item.id);
            const comparisons = (state.holdings?.comparisons || []).filter((row) => row.managerId === item.id);
            if (rows.length || comparisons.length) rowsByManager.set(item.id, { holdings: rows, comparisons });
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
        if (state.filingsError) layout.appendChild(element(documentRef, 'div', 'masters-empty-state', 'SEC 공시 메타데이터를 불러오지 못했습니다. 기관 소개는 계속 볼 수 있습니다.'));
        if (state.holdingsError) layout.appendChild(element(documentRef, 'div', 'masters-empty-state', 'SEC 보유 행을 불러오지 못했습니다. 공시 메타데이터는 계속 볼 수 있습니다.'));
         if (state.securityMasterError || state.referenceMasterError) layout.appendChild(element(documentRef, 'div', 'masters-empty-state', '종목 분류 원장을 불러오지 못해 섹터를 임의로 추정하지 않습니다.'));
          if (state.historyError || state.historyRowsError) layout.appendChild(element(documentRef, 'div', 'masters-empty-state', 'SEC 과거 공시 행을 불러오지 못했습니다. 현재·직전 분기 행과 공시 메타데이터는 계속 볼 수 있습니다.'));
          if (state.issuerAggregatesError) layout.appendChild(element(documentRef, 'div', 'masters-empty-state', '종목별 과거 합산 자료를 불러오지 못했습니다. 원본 현재·직전 분기 행은 계속 볼 수 있습니다.'));
         if (state.previewsError) layout.appendChild(element(documentRef, 'div', 'masters-empty-state', '공시 행 미리보기를 불러오지 못했습니다. 전체 행 요청과 메타데이터는 계속 사용할 수 있습니다.'));
         if (state.discoveryError) layout.appendChild(element(documentRef, 'div', 'masters-empty-state', 'SEC 최신 제출 확인 자료를 불러오지 못했습니다. 저장된 제출일은 표시하되 최신이라고 단정하지 않습니다.'));
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
          const tickerLookup = createTickerLookup(documentRef, state.tickerIndex, registry, state.tickerQuery, tickerLoadState);
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
      const loadJson = (url) => loadJsonArtifact(fetchFn, url, { signal: scope?.signal });
      const loadOptionalArtifact = async (key, url, options = {}) => {
        if (!isAlive() || state[key] != null || state.loadingCapabilities.has(key)) return;
        state.loadingCapabilities.add(key);
        state[`${key}Error`] = false;
        page.dataset[`aioMasters${key[0].toUpperCase()}${key.slice(1)}`] = 'loading';
        try {
          state[key] = await loadJsonArtifact(fetchFn, url, { signal: scope?.signal, ...options });
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
          const artifact = await loadJsonArtifact(fetchFn, descriptor.url, { signal: scope?.signal, integrity: descriptor.sha256, maxBytes: descriptor.bytes });
          if (!isAlive()) return;
          if (artifact?.managerId !== managerId || artifact?.artifactRole !== 'BOUNDED_WEB_PROJECTION' || artifact?.holdings?.length !== descriptor.projectionRows || artifact?.comparisons?.length !== descriptor.comparisonProjectionRows || artifact?.fullRowsAvailable !== descriptor.fullRows || artifact?.fullComparisonsAvailable !== descriptor.comparisonRows || artifact?.latestFiling?.accession !== descriptor.accession) {
            throw new Error(`manager shard integrity mismatch: ${managerId}`);
          }
          state.managerRows.set(managerId, artifact);
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
        if (action === 'view') { state.view = value; state.page = 1; }
        if (action === 'toggle-compare') {
          state.compareIds = state.compareIds.includes(value) ? state.compareIds.filter((id) => id !== value) : [...state.compareIds, value].slice(0, 4);
        }
        if (action === 'change-filter') { state.actionFilter = value; state.page = 1; }
        if (action === 'detail-page') {
          state.page = Math.max(1, state.page + (value === 'next' ? 1 : -1));
        }
        if (action !== 'route') {
          event.preventDefault();
          syncSharedState();
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
       bag.add(() => { delete page.dataset.aioArchitectureRoute; delete page.dataset.aioArchitectureRenderer; delete page.dataset.aioContentKind; delete page.dataset.aioReviewedAt; delete page.dataset.aioMastersData; delete page.dataset.aioMastersCoverageState; delete page.dataset.aioMastersCurrentFull; delete page.dataset.aioMastersStaleFull; delete page.dataset.aioMastersPreviewOnly; delete page.dataset.aioMastersMetadataOnly; delete page.dataset.aioMastersMethodOnly; delete page.dataset.aioMastersOfficialPrinciples; delete page.dataset.aioMastersVerifiedSecurityRecords; delete page.dataset.aioMastersLatestPeriodMissing; delete page.dataset.aioMastersHoldings; delete page.dataset.aioMastersCatalog; delete page.dataset.aioMastersPreviews; delete page.dataset.aioMastersDiscovery; delete page.dataset.aioMastersPrinciples; delete page.dataset.aioMastersSelectedShard; delete page.dataset.aioMastersSecurityMaster; delete page.dataset.aioMastersReferenceMaster; delete page.dataset.aioMastersHistory; delete page.dataset.aioMastersHistoryRows; delete page.dataset.aioMastersIssuerAggregates; delete page.dataset.aioMastersTickerIndex; delete page.dataset.aioMastersView; delete page.dataset.aioMastersFullRows; delete page.dataset.aioMastersComparisonRows; delete page.dataset.aioMastersActionFilter; content.replaceChildren(); });
      render();
       if (typeof fetchFn === 'function') {
          const entries = [['holdings', HOLDINGS_URL], ['catalog', MANAGER_CATALOG_URL]];
         Promise.allSettled(entries.map(([, url]) => loadJson(url))).then((results) => {
           if (!isAlive()) return;
           results.forEach((result, index) => {
             const key = entries[index][0];
             if (result.status === 'fulfilled') {
               state[key] = result.value;
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
