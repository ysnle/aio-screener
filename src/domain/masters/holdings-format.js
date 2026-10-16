// v57.60: pure Masters (13F) registry, coverage and value formatters, moved out of src/ui/pages/masters.js
// unchanged. No DOM here; the page imports these and keeps re-exporting the names it exported before.

// MF-05: holding rows are rendered only from a verified SEC EDGAR
// filer/CIK/filing artifact; the registry itself never invents rows.
const MASTER_REGISTRY = Object.freeze([
  Object.freeze({ id: 'berkshire-hathaway', name: 'Warren Buffett', filer: 'Berkshire Hathaway Inc.', style: '집중·가치·장기 보유', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'duquesne-family-office', name: 'Stanley Druckenmiller', filer: 'Duquesne Family Office LLC', style: '거시·성장·변화 대응', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'fisher-asset-management', name: 'Ken Fisher', filer: 'Fisher Asset Management, LLC', style: '글로벌·분산·대형주', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'pershing-square', name: 'Bill Ackman', filer: 'Pershing Square Capital Management, L.P.', style: '집중·행동주의', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'appaloosa-management', name: 'David Tepper', filer: 'Appaloosa LP', style: '가치·전환·부실 신용', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'baupost-group', name: 'Seth Klarman', filer: 'Baupost Group LLC/MA', style: '가치·하방 방어', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' }),
  Object.freeze({ id: 'scion-asset-management', name: 'Michael Burry', filer: 'Scion Asset Management, LLC', style: '비대칭·헤지·이벤트', type: 'LIVE_13F', status: 'PENDING', sourceName: 'SEC EDGAR', sourceUrl: 'https://www.sec.gov/edgar/search-and-access' })
]);

// v57.48 expert review #9: 13F share counts are not split-adjusted, so a 23.35× share count at ×0.99 value
// read as '증가'. When the share count moves ≥1.5× (or ≤0.67×) while the value stays within 0.6~1.6×, AND the
// implied per-share price moved by more than a quarter's plausible range (≤0.6× or ≥1.67×), the row is a split
// suspect and its quantity change is held. The per-share condition keeps a real half-sale whose price rose
// (shares ×0.48, value ×0.63 → per-share ×1.31) classified as 감소.
function displayActionOf(row) {
  const action = row?.action || 'UNAVAILABLE';
  if (action !== 'INCREASED' && action !== 'REDUCED') return action;
  const shares = Number(row.shares);
  const priorShares = Number(row.priorShares ?? (Number(row.shares) - Number(row.sharesDelta)));
  const value = Number(row.value);
  const priorValue = Number(row.priorValue ?? (Number(row.value) - Number(row.valueDelta)));
  if (!(shares > 0 && priorShares > 0 && value > 0 && priorValue > 0)) return action;
  const shareRatio = shares / priorShares;
  const valueRatio = value / priorValue;
  const perShare = valueRatio / shareRatio;
  return (shareRatio >= 1.5 || shareRatio <= 0.67) && valueRatio >= 0.6 && valueRatio <= 1.6 && (perShare <= 0.6 || perShare >= 1.67) ? 'SPLIT_SUSPECT' : action;
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

// P1591 (L07): table amounts read in B/M like the summary tiles; sub-million values keep full digits.
function formatReportedValue(value) {
  const number = Number(value);
  if (value == null || !Number.isFinite(number)) return '—';
  if (Math.abs(number) >= 1e9) return `$${(number / 1e9).toFixed(2)}B`;
  if (Math.abs(number) >= 1e6) return `$${(number / 1e6).toFixed(1)}M`;
  return `$${new Intl.NumberFormat('en-US').format(number)}`;
}

// P1499: a metric tile shows the reported total in billions; the full dollar figure stays in the quarter table.
function formatCompactUsd(value) {
  const number = Number(value);
  if (value == null || !Number.isFinite(number)) return '—';
  if (Math.abs(number) >= 1e12) return `$${(number / 1e12).toFixed(2)}T`;
  if (Math.abs(number) >= 1e9) return `$${(number / 1e9).toFixed(1)}B`;
  if (Math.abs(number) >= 1e6) return `$${(number / 1e6).toFixed(1)}M`;
  return formatReportedValue(number);
}

const SCALE_TIER_LABELS = { MEGA: '초대형', LARGE: '대형', MID: '중형', SPECIALIST: '특화 운용' };
function formatScale(manager) {
  const tier = SCALE_TIER_LABELS[manager?.scaleTier] || '';
  const label = String(manager?.scaleMetric?.label || '');
  if (/^\$/.test(label)) return tier ? `${tier} · ${label}` : label;
  return tier ? `${tier} (공식 AUM 미공개)` : '—';
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : '—';
}

function summarizeLatestChange(counts = {}) {
  return `신규 ${counts.NEW || 0} · 확대 ${counts.INCREASED || 0} · 축소 ${counts.REDUCED || 0} · 제외 ${counts.EXITED || 0}`;
}

// v57.54: a reported-value change reads in the same unit as the value beside it ("+$12.56B" next to "$28.16B"),
// not as a raw dollar count ("+12,557,527,438").
function formatValueDelta(value) {
  const number = Number(value);
  if (value == null || !Number.isFinite(number)) return '—';
  if (number === 0) return '0';
  return `${number > 0 ? '+' : '-'}${formatReportedValue(Math.abs(number))}`;
}

function formatDelta(value, formatter = new Intl.NumberFormat('en-US')) {
  if (value == null) return '—';
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${formatter.format(value)}`;
}

function formatQuarterLabel(period) {
  const [year, month] = String(period || '').split('-').map(Number);
  if (!year || !month) return '';
  return `${year} Q${Math.min(4, Math.max(1, Math.ceil(month / 3)))}`;
}

// SEC conformed names (e.g. "OCCIDENTAL PETROLEUM CORP /DE/") without the state suffix.
function formatIssuerName(name) {
  return String(name).replace(/\s*\/[A-Z]{2,3}\/?\s*$/, '').trim();
}

// Codex review 2026-10-05 (Berkshire 2025Q1: 4 rows, $1.1B beside $250B+ quarters): a 13F-HR/A that
// only adds holdings released from confidential treatment is not the quarter. A period represented by an
// amendment without a composed original (or a restatement) holds its count and value instead of being
// compared with full quarters. The producer composes these since P1449; this guards older artifacts.
function isPartialAmendmentPeriod(period, imported = null) {
  if (imported) return false;
  if (!/\/A$/.test(String(period?.form || ''))) return false;
  const roles = period?.composition?.roles || [];
  if (roles.includes('ORIGINAL') || roles[0] === 'RESTATEMENT') return false;
  if (period?.compositionStatus === 'ORIGINAL_CONNECTED') return false;
  return true;
}

export {
  MASTER_REGISTRY,
  displayActionOf,
  buildManagerRegistry,
  deriveCoverageSummary,
  formatReportedValue,
  formatCompactUsd,
  SCALE_TIER_LABELS,
  formatScale,
  formatPercent,
  summarizeLatestChange,
  formatValueDelta,
  formatDelta,
  formatQuarterLabel,
  formatIssuerName,
  isPartialAmendmentPeriod
};
