import { createResourceBag, createChartRegistry } from '../../app/lifecycle.js';
import { renderBreadthBoard } from '../components/breadth-board.js';
import { renderMacroBoard, renderRatesFxBoard } from '../components/macro-board.js';
import { loadJsonArtifact } from '../../data/artifact-cache.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { deriveMacroTransmissionEvidence, MACRO_FUNDING_LIQUIDITY_REFERENCE, MACRO_LAGGED_SUPPLY_DEMAND_REFERENCE } from '../../domain/macro/transmission.js';
import { deriveQuotePresentation, quoteDisplayKind } from '../../domain/market/quote-presentation.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';

function finite(value) {
  if (value == null || value === '' || typeof value === 'boolean') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isPlaceholder(value) {
  return !value || /^(?:—|-|--|N\/A|null|undefined)$/i.test(String(value).trim());
}

function writeText(node, value) {
  if (!node || value == null) return;
  const child = node.children?.length
    ? node.querySelector('.pill-price, .kr-etf-price')
    : null;
  (child || node).textContent = String(value);
}

function writeLineage(node, sourceKind, sourceLabel) {
  if (!node) return;
  node.setAttribute('data-source-kind', sourceKind);
  node.setAttribute('data-operational-use', 'reference-only');
  if (sourceLabel) node.setAttribute('data-source-label', sourceLabel);
}

function quoteValue(root, symbol) {
  const quote = root?._liveData?.[symbol];
  if (!quote) return null;
  const envelope = quote.quoteEnvelope || {};
  const price = finite(quote.price ?? quote.regularMarketPrice);
  const pct = finite(quote.pct ?? quote.regularMarketChangePercent);
  const changeBasis = quote.changeBasis || quote.valueBasis || 'unknown';
  return {
    quote,
    envelope,
    price,
    pct,
    changeBasis,
    observedAt: envelope.observedAt || quote.observedAt || null,
    fetchedAt: envelope.fetchedAt || quote.fetchedAt || null,
    quality: quote.quality || envelope.quality || null,
    session: quote.marketState || envelope.marketState || null,
    revision: envelope.revision || quote.revision || null,
    // W03-B/P1145: freshness/display state is derived from the envelope's declared
    // quality, not from the source label. One value carries observation time,
    // receipt time, source, revision, allowed use and display role together.
    presentation: deriveQuotePresentation(quote, { symbol })
  };
}

function annotateChangeBasis(node, value) {
  if (!node || !value) return;
  const basis = String(value.changeBasis || 'unknown');
  node.setAttribute('data-change-basis', basis);
  node.setAttribute('data-change-coherent', value.presentation?.changeCoherent ? 'true' : 'false');
  node.setAttribute('title', value.presentation?.changeCoherent ? `변화율 기준: ${basis}` : `변화율 기준 미확인(${basis}) — 같은 관측으로 확정하지 않음`);
  const observedAt = value.observedAt || null;
  if (observedAt) node.setAttribute('data-as-of', observedAt);
  else node.removeAttribute('data-as-of');
  if (observedAt) node.setAttribute('data-observed-at', observedAt);
  else node.removeAttribute('data-observed-at');
  if (value.fetchedAt) node.setAttribute('data-fetched-at', value.fetchedAt);
  else node.removeAttribute('data-fetched-at');
  if (value.quality) node.setAttribute('data-market-quality', value.quality);
  else node.removeAttribute('data-market-quality');
  if (value.session) node.setAttribute('data-market-session', value.session);
  else node.removeAttribute('data-market-session');
  if (value.revision) node.setAttribute('data-market-revision', value.revision);
  else node.removeAttribute('data-market-revision');
}

function quoteLineage(node, value) {
  const presentation = value.presentation;
  const source = presentation?.sourceId && presentation.sourceId !== 'unknown'
    ? presentation.sourceId
    : String(value.quote.source || value.quote._source || value.quote.provider || 'unknown');
  writeLineage(node, quoteDisplayKind(presentation?.displayState), source);
  annotateChangeBasis(node, value);
  if (node) node.setAttribute('data-quote-state', presentation?.displayState || 'missing');
  const observedAt = value.observedAt ? String(value.observedAt).replace('T', ' ').replace(/\.000Z$|Z$/, ' UTC') : '관측시각 미수신';
  const fetchedAt = value.fetchedAt ? String(value.fetchedAt).replace('T', ' ').replace(/\.000Z$|Z$/, ' UTC') : '수신시각 미수신';
  node.setAttribute('title', `${source} · 관측 ${observedAt} · 수신 ${fetchedAt} · 변화율 기준 ${value.changeBasis || 'unknown'} · 표시 상태 ${presentation?.displayState || 'missing'}`);
}

function clearRenderedValue(node, title = '현재 관측값 미수신') {
  if (!node) return;
  writeText(node, '—');
  node.classList?.remove('pos', 'neg');
  node.removeAttribute('data-change-basis');
  node.removeAttribute('data-as-of');
  node.removeAttribute('data-observed-at');
  node.removeAttribute('data-fetched-at');
  node.removeAttribute('data-market-quality');
  node.removeAttribute('data-market-session');
  node.removeAttribute('data-market-revision');
  node.removeAttribute('data-release-at');
  writeLineage(node, 'unavailable', 'native:missing-observation');
  node.setAttribute('data-operational-use', 'blocked');
  node.setAttribute('data-quote-state', 'missing');
  node.removeAttribute('data-change-coherent');
  node.setAttribute('title', title);
}

function formatPrice(root, symbol, value) {
  try {
    if (typeof root?._aioFormatLivePrice === 'function') return root._aioFormatLivePrice(symbol, value);
  } catch (_) {}
  const digits = Math.abs(value) >= 1000 ? 0 : 2;
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function renderLiveQuotes(root, page) {
  page.querySelectorAll('[data-live-price]').forEach((node) => {
    const symbol = node.getAttribute('data-live-price');
    const value = quoteValue(root, symbol);
    if (!value || value.price == null) {
      clearRenderedValue(node, `${symbol || '종목'} 현재 관측값 미수신`);
      return;
    }
    writeText(node, formatPrice(root, symbol, value.price));
    quoteLineage(node, value);
  });
  page.querySelectorAll('[data-live-chg],[data-live-pct]').forEach((node) => {
    const symbol = node.getAttribute('data-live-chg') || node.getAttribute('data-live-pct');
    const value = quoteValue(root, symbol);
    if (!value || value.pct == null) {
      clearRenderedValue(node, `${symbol || '종목'} 변화율 미수신`);
      return;
    }
    writeText(node, `${value.pct >= 0 ? '+' : ''}${value.pct.toFixed(2)}%`);
    node.classList?.toggle('pos', value.pct >= 0);
    node.classList?.toggle('neg', value.pct < 0);
    quoteLineage(node, value);
  });
}

const SNAPSHOT_ALIASES = {
  'fed-rate': ['fedRate'],
  cpi: ['cpi'],
  'cpi-yoy': ['cpi'],
  'core-cpi-yoy': ['coreCpi'],
  'cpi-sa-yoy': ['cpiSa'],
  'core-cpi-sa-yoy': ['coreCpiSa'],
  'pce-yoy': ['pce'],
  'core-pce-yoy': ['corePce'],
  nfp: ['nfp'],
  unemploy: ['unemploy', 'unemployment'],
  housing: ['housingStarts'],
  'retail-sales': ['retailSales'],
  'wage-growth': ['usWageGrowth'],
  'kr-cpi': ['krCpi']
};

const FRED_SERIES = {
  'fed-rate': 'FEDFUNDS',
  cpi: 'CPIAUCNS',
  'cpi-yoy': 'CPIAUCNS',
  'core-cpi-yoy': 'CPILFENS',
  'cpi-sa-yoy': 'CPIAUCSL',
  'core-cpi-sa-yoy': 'CPILFESL',
  'pce-yoy': 'PCEPI',
  'core-pce-yoy': 'PCEPILFE',
  nfp: 'PAYEMS',
  unemploy: 'UNRATE',
  housing: 'HOUST',
  'retail-sales': 'RSAFS',
  'wage-growth': 'CES0500000003'
};

function readSnapshotMetric(root, key) {
  if (key === 'move') {
    const live = quoteValue(root, '^MOVE');
    if (live && live.price != null) return { value: live.price, source: live.quote.source || live.quote.provider || 'live:quote' };
    const snapshotMove = finite(root?.DATA_SNAPSHOT?.move);
    if (snapshotMove != null) return { value: snapshotMove, source: 'DATA_SNAPSHOT' };
    return null;
  }
  const snapshot = root?.DATA_SNAPSHOT || {};
  for (const alias of SNAPSHOT_ALIASES[key] || []) {
    if (snapshot[alias] != null && !isPlaceholder(snapshot[alias])) {
      const evidence = root?._serverMacroEvidence?.[alias] || {};
      return {
        value: snapshot[alias],
        source: evidence.source || snapshot[`_${alias}_src`] || 'DATA_SNAPSHOT',
        observedAt: evidence.observedAt || null,
        releasedAt: evidence.releasedAt || null,
        allowedUse: evidence.allowedUse || 'reference-only'
      };
    }
  }
  const series = root?._fredData?.[FRED_SERIES[key]];
  if (series && typeof series === 'object') {
    if (/yoy/.test(key) && finite(series.yoy) != null) return { value: finite(series.yoy), source: `FRED:${FRED_SERIES[key]}`, yoy: true };
    if (key === 'nfp' && finite(series.value) != null && finite(series.prevValue) != null) {
      return { value: finite(series.value) - finite(series.prevValue), source: 'FRED:PAYEMS', nfp: true };
    }
    if (key === 'retail-sales' && finite(series.value) != null && finite(series.prevValue) > 0) {
      return { value: (finite(series.value) - finite(series.prevValue)) / finite(series.prevValue) * 100, source: 'FRED:RSAFS', retail: true };
    }
    if (key === 'wage-growth' && finite(series.value) != null) {
      const previous = finite(series.prevValue);
      return { value: finite(series.value), previous, source: 'FRED:CES0500000003', wage: true };
    }
    if (finite(series.value) != null) return { value: finite(series.value), source: `FRED:${FRED_SERIES[key]}` };
  }
  if (key === 'fed-target') {
    // P1375: the policy-rate comparison shows the FOMC target range (FRED DFEDTARL/U, daily), not the
    // FEDFUNDS monthly average; until the producer has published it, the official decision registry.
    const lower = finite(root?.DATA_SNAPSHOT?.fedTargetLower);
    const upper = finite(root?.DATA_SNAPSHOT?.fedTargetUpper);
    if (lower != null && upper != null) return { value: `${lower.toFixed(2)}–${upper.toFixed(2)}%`, source: 'FRED:DFEDTARL/DFEDTARU', formatted: true };
    const fomc = root?.AIO_EVENT_FRESHNESS_REGISTRY?.fomc;
    if (fomc?.policyRange) return { value: String(fomc.policyRange), source: `FOMC 결정 ${fomc.eventDate || ''}`.trim(), formatted: true };
    return null;
  }
  if (key === 'fed-rate') {
    const target = finite(root?._fredData?.DFEDTARU?.value);
    if (target != null) return { value: `${(target - 0.25).toFixed(2)}–${target.toFixed(2)}%`, source: 'FRED:DFEDTARU', formatted: true };
  }
  const bok = finite(root?._bokData?.bokRate?.value);
  if (key === 'bok-rate' && bok != null) return { value: bok, source: 'BOK:ECOS' };
  const kosis = finite(root?._kosisData?.krCpi?.value);
  if (key === 'kr-cpi' && kosis != null) return { value: kosis, source: 'KOSIS' };
  return null;
}

function formatSnapshotMetric(key, metric) {
  if (!metric) return null;
  if (metric.formatted) return metric.value;
  const value = finite(metric.value);
  if (value == null) return isPlaceholder(metric.value) ? null : String(metric.value);
  if (metric.nfp || key === 'nfp') return `${value >= 0 ? '+' : ''}${Math.round(value).toLocaleString('en-US')}K`;
  if (metric.retail) return `${value >= 0 ? '+' : ''}${value.toFixed(2)}% MoM`;
  if (metric.wage) {
    const mom = metric.previous > 0 ? (value - metric.previous) / metric.previous * 100 : null;
    return `$${value.toFixed(2)}${mom == null ? '' : ` (${mom >= 0 ? '+' : ''}${mom.toFixed(2)}%)`}`;
  }
  if (key === 'fed-rate') return `${value.toFixed(2)}% 월평균`;
  if (key === 'move') return value.toFixed(1);
  if (key === 'housing') return `${Math.round(value)}K`;
  if (key === 'kr-cpi') return value.toFixed(1);
  if (/yoy/.test(key) || key === 'unemploy') return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  return String(metric.value);
}

function renderSnapshotMetrics(root, page) {
  page.querySelectorAll('[data-snap]').forEach((node) => {
    const key = node.getAttribute('data-snap');
    const metric = readSnapshotMetric(root, key);
    const value = formatSnapshotMetric(key, metric);
    if (value == null) {
      clearRenderedValue(node, `${key || '지표'} 현재 관측값 미수신`);
      return;
    }
    writeText(node, value);
    const source = String(metric?.source || '');
    const sourceKind = source.startsWith('FRED') || source === 'fred-official-primary'
      ? 'official-primary'
      : source === 'bea-official-primary' ? 'official-primary'
        : source.startsWith('live') ? 'live' : source === 'last-known-good' ? 'reference' : 'snapshot';
    writeLineage(node, sourceKind, metric?.source);
    if (metric?.observedAt) node.setAttribute('data-as-of', metric.observedAt);
    if (metric?.releasedAt) node.setAttribute('data-release-at', metric.releasedAt);
    if (metric?.allowedUse) node.setAttribute('data-operational-use', metric.allowedUse);
  });
}

function renderMacroTransmissionLens(documentRef, root, page) {
  const host = page?.querySelector('#macro-transmission-lens');
  if (!host) return;
  const observedNumber = (value) => finite(value);
  const twoYear = observedNumber(root?._live2Y) ?? observedNumber(root?._fredData?.DGS2?.value);
  const tenYear = observedNumber(quoteValue(root, '^TNX')?.price);
  const thirtyYear = observedNumber(quoteValue(root, '^TYX')?.price);
  const fredHy = observedNumber(root?._fredData?.BAMLH0A0HYM2?.value);
  const hyOasBp = observedNumber(root?._hySpreadBp) ?? (fredHy == null ? null : fredHy * 100);
  const breadthState = root?._aioScreenerBreadthState;
  const breadth = breadthState?.status === 'verified_current'
    ? (observedNumber(root?._breadth50) ?? observedNumber(root?._breadth20))
    : null;
  const evidence = deriveMacroTransmissionEvidence({
    quotes: root?._liveData || {},
    twoYear,
    tenYear,
    thirtyYear,
    hyOasBp,
    breadth
  });
  host.replaceChildren();
  host.dataset.aioMacroTransmissionRenderer = 'native';
  host.setAttribute('data-source-kind', 'REFERENCE');
  host.setAttribute('data-operational-use', 'reference-only');

  const header = documentRef.createElement('div');
  header.style.cssText = 'display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:6px;';
  const title = documentRef.createElement('div');
  title.textContent = '시장 위험 전이 렌즈';
  title.style.cssText = 'font-family:var(--font-display);font-size:16px;font-weight:600;color:var(--text-primary);';
  const status = documentRef.createElement('span');
  status.textContent = evidence.status === 'partial-observed' ? '부분 관측 · 결론 보류' : '핵심 근거 미수신 · 판정 보류';
  status.style.cssText = `font-size:11px;font-weight:700;color:${evidence.status === 'partial-observed' ? 'var(--data-amber)' : 'var(--text-muted)'};`;
  header.append(title, status);
  host.appendChild(header);

  const intro = documentRef.createElement('div');
  intro.textContent = '자금 공급·기간 프리미엄 → 장기금리 → 신용·CAPEX → 시장폭·변동성 → 교차자산 헤지 순서로 읽습니다. 연결되지 않은 변수를 현재 사실처럼 보간하지 않습니다.';
  intro.style.cssText = 'font-size:12px;line-height:1.7;color:var(--text-secondary);margin-bottom:12px;';
  host.appendChild(intro);

  const observed = documentRef.createElement('div');
  observed.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;';
  [
    ['2Y', evidence.values.twoYear, '%'],
    ['10Y', evidence.values.tenYear, '%'],
    ['30Y', evidence.values.thirtyYear, '%'],
    ['HY OAS', evidence.values.hyOasBp, 'bp'],
    ['VIX', evidence.values.vix, ''],
    ['시장폭 50SMA', evidence.values.breadth, '%']
  ].forEach(([label, value, unit]) => {
    const chip = documentRef.createElement('span');
    chip.textContent = `${label} ${value == null ? '—' : `${value.toFixed(unit === 'bp' ? 0 : 2)}${unit}`}`;
    chip.style.cssText = 'font-family:var(--font-mono);font-size:10px;color:var(--text-secondary);background:var(--surface-1);border:1px solid var(--border-subtle);border-radius:3px;padding:4px 7px;';
    chip.setAttribute('data-source-kind', value == null ? 'UNAVAILABLE' : 'REFERENCE');
    chip.setAttribute('data-operational-use', value == null ? 'blocked' : 'reference-only');
    observed.appendChild(chip);
  });
  host.appendChild(observed);

  const chain = documentRef.createElement('div');
  chain.style.cssText = 'display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:7px;margin-bottom:14px;';
  evidence.chain.forEach((item, index) => {
    const card = documentRef.createElement('div');
    card.style.cssText = 'min-height:94px;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:5px;padding:9px;';
    const step = documentRef.createElement('div');
    step.textContent = `${index + 1}. ${item.label}`;
    step.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-primary);margin-bottom:5px;';
    const state = documentRef.createElement('div');
    state.textContent = item.status === 'observed' ? '관측 가능' : 'BLOCKED · 근거 미연결';
    state.style.cssText = `font-size:10px;font-weight:700;color:${item.status === 'observed' ? 'var(--data-green)' : 'var(--text-muted)'};margin-bottom:5px;`;
    const meaning = documentRef.createElement('div');
    meaning.textContent = item.meaning;
    meaning.style.cssText = 'font-size:10px;line-height:1.55;color:var(--text-muted);';
    card.append(step, state, meaning);
    card.setAttribute('data-evidence-key', item.evidenceKey);
    card.setAttribute('data-operational-use', item.status === 'observed' ? 'reference-only' : 'blocked');
    chain.appendChild(card);
  });
  host.appendChild(chain);

  const lower = documentRef.createElement('div');
  lower.style.cssText = 'display:grid;grid-template-columns:1.1fr 1fr;gap:14px;';
  const gaps = documentRef.createElement('div');
  const gapsTitle = documentRef.createElement('div');
  gapsTitle.textContent = '현재 개선 필요 데이터';
  gapsTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:5px;';
  gaps.appendChild(gapsTitle);
  evidence.gaps.forEach((item) => {
    const row = documentRef.createElement('div');
    row.textContent = `${item.label}: ${item.reason} · 다음 단계: ${item.next}`;
    row.style.cssText = 'font-size:10px;line-height:1.6;color:var(--text-muted);padding:3px 0;';
    row.setAttribute('data-operational-use', 'blocked');
    gaps.appendChild(row);
  });
  const reference = documentRef.createElement('div');
  const refTitle = documentRef.createElement('div');
  refTitle.textContent = '자료에서 추출한 관찰 프레임 (REFERENCE)';
  refTitle.style.cssText = 'font-size:11px;font-weight:800;color:var(--text-secondary);margin-bottom:5px;';
  reference.appendChild(refTitle);
  [
    ...MACRO_FUNDING_LIQUIDITY_REFERENCE.checks,
    ...MACRO_LAGGED_SUPPLY_DEMAND_REFERENCE.timeSeriesChecks,
    ...MACRO_LAGGED_SUPPLY_DEMAND_REFERENCE.channels.map((item) => `${item.label} · ${item.horizon}: ${item.checks}`),
    '옵션 만기·dealer gamma·낮은 거래량은 변동성의 비선형성을 설명할 수 있지만 현재 포지셔닝 데이터가 필요합니다.',
    '금·BTC가 함께 하락하면 헤지 수요보다 전 자산 디레버리징 가설을 우선 점검합니다.',
    'PCE/GDP → Jackson Hole/Fed 경로 → AI 실적·CAPEX → 월말 기관 리밸런싱은 자료가 제시한 관찰 순서입니다.',
    '삼성전자·SK하이닉스 주주환원·DRAM short squeeze·한국 레버리지는 IR/공시·수급·대차·거래량 확인 전 현재 신호가 아닙니다.'
  ].forEach((value) => {
    const row = documentRef.createElement('div');
    row.textContent = value;
    row.style.cssText = 'font-size:10px;line-height:1.6;color:var(--text-muted);padding:3px 0;';
    row.setAttribute('data-source-kind', 'REFERENCE');
    row.setAttribute('data-operational-use', 'reference-only');
    row.setAttribute('data-reference-framework', value.includes('주택') || value.includes('고용') || value.includes('물가')
      ? MACRO_LAGGED_SUPPLY_DEMAND_REFERENCE.id
      : MACRO_FUNDING_LIQUIDITY_REFERENCE.id);
    reference.appendChild(row);
  });
  lower.append(gaps, reference);
  host.appendChild(lower);
  const note = documentRef.createElement('div');
  note.textContent = '현재 연결된 수치는 관측값이고, 전이 해석은 연구 프레임입니다. 이 패널은 단일 종합점수나 매매 신호를 생성하지 않습니다.';
  note.style.cssText = 'font-size:10px;line-height:1.6;color:var(--text-muted);border-top:1px solid var(--border-subtle);margin-top:12px;padding-top:8px;';
  host.appendChild(note);
}

// P1425: the 거시 hub renders two native boards (../components/macro-board.js). The previous
// renderers painted fixed-threshold verdicts (2s10s bands, DXY/10Y risk pill, 4-axis bull/bear count,
// a 2Y colour scale) and a USD/JPY chart that read a 'jpy' history field that does not exist.
function renderMacro(documentRef, root, page) {
  renderLiveQuotes(root, page);
  renderSnapshotMetrics(root, page);
  renderMacroBoard({ documentRef, root });
  renderMacroTransmissionLens(documentRef, root, page);
  root?.AIO?.renderMacroNextRelease?.();
}

function renderFxbond(documentRef, root, page) {
  renderLiveQuotes(root, page);
  renderRatesFxBoard({ documentRef, root });
}

// P1395: the breadth page is rendered by ../components/breadth-board.js (trend cards per measure).

export function createMarketSlicePage({ root = globalThis, documentRef, store, route } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const charts = createChartRegistry({ maxCanvasHeight: 480 });
      bag.add(charts.dispose);
      const page = documentRef?.getElementById(`page-${route}`);
      if (!page) return () => bag.dispose();
      const suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
        routeId: route,
        heading: route === 'macro' ? '거시 · 금리·주택·고용의 전달 시차' : route === 'fxbond' ? '금리·환율 · 유동성·이벤트 리스크' : '시장폭 · 가격·breadth·리더십 확인'
      });
      page.appendChild(suppliedMaterialBridge);
      bag.add(() => suppliedMaterialBridge.remove());
      page.dataset.aioArchitectureRoute = route;
      page.dataset.aioArchitectureSlice = 'market';
      if (route === 'macro') {
        page.dataset.aioArchitectureRenderer = 'native';
        page.dataset.aioMacroRenderer = 'native';
      }
      if (route === 'fxbond') {
        page.dataset.aioArchitectureRenderer = 'native';
        page.dataset.aioFxbondRenderer = 'native';
      }
      if (route === 'breadth') {
        page.dataset.aioArchitectureRenderer = 'native';
        page.dataset.aioBreadthRenderer = 'native';
      }
      const renderNow = () => {
        if (route === 'macro') renderMacro(documentRef, root, page);
        if (route === 'fxbond') renderFxbond(documentRef, root, page);
        if (route === 'breadth') renderBreadthBoard({ documentRef, root });
      };
      renderNow();
      // P1416: the breadth drilldown (which stocks made each count) is a separate small artifact.
      if (route === 'breadth' && !root._aioBreadthContributors) {
        const fetchFn = root?.fetch || globalThis.fetch;
        let alive = true;
        bag.add(() => { alive = false; });
        if (typeof fetchFn === 'function') {
          loadJsonArtifact(fetchFn.bind(root), './public-data/breadth-contributors.json', { maxAgeMs: 30 * 60 * 1000, maxBytes: 1024 * 1024 })
            .then((payload) => { if (payload?.schemaVersion === 'breadth-contributors.v1') root._aioBreadthContributors = payload; if (alive) renderNow(); })
            .catch(() => {});
        }
      }
      const unsubscribe = store && subscribeToSlices(store, ['market', 'marketSnapshot', 'screener'], renderNow);
      if (unsubscribe) bag.add(unsubscribe);
      const eventTarget = documentRef || root;
      ['aio:liveQuotes', 'aio:liveDataReceived', 'aio:refresh:done', 'aio:serverDataLoaded', 'aio:historyLoaded', 'aio:macroUpdated'].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, renderNow);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, renderNow));
      });
        // P1417: history.json announces itself on window (js/aio-data.js), not on document.
        const windowTarget = root && root !== eventTarget ? root : null;
        if (windowTarget?.addEventListener) {
          windowTarget.addEventListener('aio:historyLoaded', renderNow);
          bag.add(() => windowTarget.removeEventListener?.('aio:historyLoaded', renderNow));
        }
      bag.add(() => {
        if (page.dataset.aioArchitectureRoute === route) delete page.dataset.aioArchitectureRoute;
        if (page.dataset.aioArchitectureSlice === 'market') delete page.dataset.aioArchitectureSlice;
        if ((route === 'macro' || route === 'fxbond') && page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (route === 'macro' && page.dataset.aioMacroRenderer === 'native') delete page.dataset.aioMacroRenderer;
        if (route === 'fxbond' && page.dataset.aioFxbondRenderer === 'native') delete page.dataset.aioFxbondRenderer;
        if (route === 'breadth' && page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (route === 'breadth' && page.dataset.aioBreadthRenderer === 'native') delete page.dataset.aioBreadthRenderer;
        if (route === 'breadth') {
          ['#breadth-diag-signal', '#breadth-diag-text'].forEach((selector) => {
            const node = page.querySelector(selector);
            if (node?.dataset.aioBreadthDiagnosticRenderer === 'native') delete node.dataset.aioBreadthDiagnosticRenderer;
          });
        }
        const signalNode = page.querySelector('#breadth-signal-val');
        if (route === 'breadth' && signalNode?.dataset.aioBreadthSignalRenderer === 'native') delete signalNode.dataset.aioBreadthSignalRenderer;
        if (route === 'breadth') {
          const stageNode = page.querySelector('#breadth-stage-summary');
          const mcclellanNode = page.querySelector('#breadth-mcclellan-summary');
          if (stageNode?.dataset.aioBreadthStageRenderer === 'native') delete stageNode.dataset.aioBreadthStageRenderer;
          if (mcclellanNode?.dataset.aioBreadthMcclellanRenderer === 'native') delete mcclellanNode.dataset.aioBreadthMcclellanRenderer;
          page.querySelectorAll('#bp-price-chart, #bp-ad-ratio-chart, #bp-5ma-chart, #bp-20ma-chart, #bp-50ma-chart').forEach((canvas) => {
            if (canvas.dataset.aioBreadthChartRenderer === 'native') delete canvas.dataset.aioBreadthChartRenderer;
            if (canvas.__rendered === 'native' || canvas.__rendered === 'chartjs') delete canvas.__rendered;
          });
          page.querySelector('#breadth-reference-lens')?.remove();
        }
      });
      return () => bag.dispose();
    }
  };
}
