import { createResourceBag } from '../../app/lifecycle.js';

function finite(value) {
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
  const price = finite(quote.price ?? quote.regularMarketPrice);
  const pct = finite(quote.pct ?? quote.regularMarketChangePercent);
  return { quote, price, pct };
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
    if (!value || value.price == null) return;
    writeText(node, formatPrice(root, symbol, value.price));
    writeLineage(node, 'live', value.quote.source || value.quote.provider || 'live:quote');
  });
  page.querySelectorAll('[data-live-chg],[data-live-pct]').forEach((node) => {
    const symbol = node.getAttribute('data-live-chg') || node.getAttribute('data-live-pct');
    const value = quoteValue(root, symbol);
    if (!value || value.pct == null) return;
    writeText(node, `${value.pct >= 0 ? '+' : ''}${value.pct.toFixed(2)}%`);
    node.classList?.toggle('pos', value.pct >= 0);
    node.classList?.toggle('neg', value.pct < 0);
    writeLineage(node, 'live', value.quote.source || value.quote.provider || 'live:quote');
  });
}

const SNAPSHOT_ALIASES = {
  'fed-rate': ['fedRate'],
  cpi: ['cpi'],
  'cpi-yoy': ['cpi'],
  'core-cpi-yoy': ['coreCpi'],
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
  cpi: 'CPIAUCSL',
  'cpi-yoy': 'CPIAUCSL',
  'core-cpi-yoy': 'CPILFESL',
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
    if (snapshot[alias] != null && !isPlaceholder(snapshot[alias])) return { value: snapshot[alias], source: 'DATA_SNAPSHOT' };
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
  if (key === 'fed-rate') return `${value.toFixed(2)}%`;
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
    if (value == null) return;
    writeText(node, value);
    const source = String(metric?.source || '');
    writeLineage(node, source.startsWith('FRED') ? 'fred' : source.startsWith('live') ? 'live' : 'snapshot', metric?.source);
  });
}

function renderMacro(root, page) {
  renderLiveQuotes(root, page);
  renderSnapshotMetrics(root, page);
}

function renderFxbond(root, page) {
  renderLiveQuotes(root, page);
  renderSnapshotMetrics(root, page);
}

function breadthEvidence(root) {
  try {
    const getter = root?.AIO?.getCurrentBreadthEvidence;
    if (typeof getter === 'function') {
      const legacy = getter();
      if (legacy?.available) return legacy;
    }
    const nativeState = root?.AIO_ARCH?.getScreenerState?.();
    const segment = nativeState?.metadata?.breadth?.segments?.us;
    const observedAt = segment?.observedAt ? Date.parse(segment.observedAt) : NaN;
    const ageMs = Number.isFinite(observedAt) ? Date.now() - observedAt : Infinity;
    const valid = segment && Number.isFinite(ageMs) && ageMs >= -60 * 60 * 1000 && ageMs <= 4 * 24 * 60 * 60 * 1000 &&
      ['above5', 'above20', 'above50', 'advanceRatio'].every((key) => Number.isFinite(Number(segment[key])));
    if (valid) {
      return {
        available: true,
        sma5: Number(segment.above5),
        sma20: Number(segment.above20),
        sma50: Number(segment.above50),
        advanceRatio: Number(segment.advanceRatio),
        ts: observedAt,
        ageMs,
        source: nativeState.metadata.breadth.source || segment.label || 'AIO screener universe'
      };
    }
  } catch (_) {}
  return { available: false };
}

function breadthTone(value, key) {
  if (!Number.isFinite(Number(value))) return 'var(--text-muted)';
  const number = Number(value);
  if (key === 'sma20' && number >= 70) return 'var(--data-amber)';
  if (number >= 55) return 'var(--data-green)';
  if (number >= 40) return 'var(--data-amber)';
  return 'var(--data-red)';
}

function renderBreadth(root, page) {
  const evidence = breadthEvidence(root);
  const source = evidence.available ? (evidence.source || 'AIO screener universe') : 'breadth source unavailable';
  const sourceKind = evidence.available ? 'server-artifact' : 'unavailable';
  const observed = evidence.available && evidence.ts ? new Date(evidence.ts) : null;
  const observedLabel = observed && !Number.isNaN(observed.getTime())
    ? observed.toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit' })
    : null;
  const cards = [
    ['sma5', 'breadth-5sma-big', 'breadth-5sma-label', 'breadth-5sma-bar', 'breadth-5sma-freshness'],
    ['sma20', 'breadth-20sma-big', 'breadth-20sma-label', 'breadth-20sma-bar', 'breadth-20sma-freshness'],
    ['sma50', 'breadth-50sma-big', 'breadth-50sma-label', 'breadth-50sma-bar', 'breadth-50sma-freshness']
  ];
  cards.forEach(([key, valueId, labelId, barId, freshnessId]) => {
    const value = evidence.available ? Number(evidence[key]) : null;
    const valueNode = page.querySelector(`#${valueId}`);
    const labelNode = page.querySelector(`#${labelId}`);
    const barNode = page.querySelector(`#${barId}`);
    const freshnessNode = page.querySelector(`#${freshnessId}`);
    const tone = breadthTone(value, key);
    const text = value == null || !Number.isFinite(value) ? '—' : `${Math.round(value)}%`;
    const label = value == null || !Number.isFinite(value) ? '현재 원천 미수신' : '현재 관측';
    const freshness = value == null || !Number.isFinite(value)
      ? '현재 원천 미수신'
      : `관측: ${observedLabel || '현재'} · ${source}`;
    writeText(valueNode, text);
    writeText(labelNode, label);
    if (barNode) {
      barNode.style.width = value == null || !Number.isFinite(value) ? '0%' : `${Math.max(0, Math.min(100, value))}%`;
      barNode.style.background = tone;
    }
    writeText(freshnessNode, freshness);
    [valueNode, labelNode, barNode, freshnessNode].forEach((node) => writeLineage(node, sourceKind, source));
    if (labelNode) labelNode.style.color = tone;
    if (freshnessNode) freshnessNode.style.color = value == null ? 'var(--text-muted)' : 'var(--text-dim)';
  });
  const advanceNode = page.querySelector('#breadth-advance-ratio');
  const ratio = evidence.available ? Number(evidence.advanceRatio) : null;
  writeText(advanceNode, Number.isFinite(ratio) ? `${(ratio * 100).toFixed(1)}%` : '—');
  if (advanceNode) {
    advanceNode.style.color = Number.isFinite(ratio)
      ? (ratio > 0.5 ? 'var(--data-green)' : ratio > 0.3 ? 'var(--data-amber)' : 'var(--data-red)')
      : 'var(--text-muted)';
    writeLineage(advanceNode, sourceKind, source);
  }
}

export function createMarketSlicePage({ root = globalThis, documentRef, store, route } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById(`page-${route}`);
      if (!page) return () => bag.dispose();
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
        if (route === 'macro') renderMacro(root, page);
        if (route === 'fxbond') renderFxbond(root, page);
        if (route === 'breadth') renderBreadth(root, page);
      };
      renderNow();
      const unsubscribe = store?.subscribe?.(renderNow);
      if (unsubscribe) bag.add(unsubscribe);
      const eventTarget = documentRef || root;
      ['aio:liveQuotes', 'aio:liveDataReceived', 'aio:refresh:done', 'aio:serverDataLoaded'].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, renderNow);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, renderNow));
      });
      bag.add(() => {
        if (page.dataset.aioArchitectureRoute === route) delete page.dataset.aioArchitectureRoute;
        if (page.dataset.aioArchitectureSlice === 'market') delete page.dataset.aioArchitectureSlice;
        if (route === 'macro' && page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (route === 'macro' && page.dataset.aioMacroRenderer === 'native') delete page.dataset.aioMacroRenderer;
        if (route === 'fxbond' && page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (route === 'fxbond' && page.dataset.aioFxbondRenderer === 'native') delete page.dataset.aioFxbondRenderer;
        if (route === 'breadth' && page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (route === 'breadth' && page.dataset.aioBreadthRenderer === 'native') delete page.dataset.aioBreadthRenderer;
      });
      return () => bag.dispose();
    }
  };
}
