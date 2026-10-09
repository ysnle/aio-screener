import { createResourceBag, createChartRegistry } from '../../app/lifecycle.js';
import { renderBreadthBoard } from '../components/breadth-board.js';
import { renderMacroBoard, renderRatesFxBoard } from '../components/macro-board.js';
import { loadJsonArtifact } from '../../data/artifact-cache.js';
import { subscribeToSlices } from '../../state/memoize.js';
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
  // P1555: the tooltip states source and times in reader words; the internal basis and display-state enums stay in the data attributes.
  node.setAttribute('title', `${source} · 관측 ${observedAt} · 수신 ${fetchedAt}`);
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

// P1425: the 거시 hub renders two native boards (../components/macro-board.js). The previous
// renderers painted fixed-threshold verdicts (2s10s bands, DXY/10Y risk pill, 4-axis bull/bear count,
// a 2Y colour scale) and a USD/JPY chart that read a 'jpy' history field that does not exist.
function renderMacro(documentRef, root, page) {
  renderLiveQuotes(root, page);
  renderSnapshotMetrics(root, page);
  renderMacroBoard({ documentRef, root });
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
      // P1426: the 거시 direction reads use the FRED observation artifact (published by refresh-data).
      if ((route === 'macro' || route === 'fxbond') && !root._aioMacroHistory) {
        const fetchFn = root?.fetch || globalThis.fetch;
        let alive = true;
        bag.add(() => { alive = false; });
        if (typeof fetchFn === 'function') {
          loadJsonArtifact(fetchFn.bind(root), './public-data/macro-history.json', { maxAgeMs: 60 * 60 * 1000, maxBytes: 2 * 1024 * 1024 })
            .then((payload) => { if (payload?.schemaVersion === 'macro-history.v1') root._aioMacroHistory = payload; if (alive) renderNow(); })
            .catch(() => {});
        }
      }
      // P1416: the breadth drilldown (which stocks made each count) is a separate small artifact.
      if (route === 'breadth' && !root._aioBreadthContributors) {
        const fetchFn = root?.fetch || globalThis.fetch;
        let alive = true;
        bag.add(() => { alive = false; });
        if (typeof fetchFn === 'function') {
          loadJsonArtifact(fetchFn.bind(root), './public-data/breadth-contributors.json', { maxAgeMs: 30 * 60 * 1000, maxBytes: 1024 * 1024 })
            // Codex browser audit H10: the producer moved to v2 (object rows with asset type and corporate-action flag) and
            // this check still required v1, so the lists stayed "수집 대기" beside counts. Both shapes render.
            .then((payload) => { if (['breadth-contributors.v1', 'breadth-contributors.v2'].includes(payload?.schemaVersion)) root._aioBreadthContributors = payload; if (alive) renderNow(); })
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
