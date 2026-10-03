import { createResourceBag, createChartRegistry } from '../../app/lifecycle.js';
import { renderBreadthBoard } from '../components/breadth-board.js';
import { loadJsonArtifact } from '../../data/artifact-cache.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { deriveMacroTransmissionEvidence, MACRO_FUNDING_LIQUIDITY_REFERENCE, MACRO_LAGGED_SUPPLY_DEMAND_REFERENCE } from '../../domain/macro/transmission.js';
import { deriveQuotePresentation, quoteDisplayKind } from '../../domain/market/quote-presentation.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { buildTreasuryCurveSpread } from '../../domain/macro/treasury-curve.js';

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

function historyRows(root, field) {
  try {
    const rows = typeof root?._aioHistorySeries === 'function' ? root._aioHistorySeries(field, 5) : [];
    return Array.isArray(rows)
      ? rows.map((row) => ({
        date: String(row?.date || row?.time || '').slice(0, 10),
        value: finite(row?.value ?? row?.close),
        sourceKind: row?.sourceKind || 'server-history',
        source: row?.source || `public-data/history.json:${field}`,
        valueBasis: row?.valueBasis || row?.changeBasis || row?.fieldMeta?.valueBasis || 'completed-market-series'
      })).filter((row) => row.date && row.value != null)
      : [];
  } catch (_) {
    return [];
  }
}

function destroyNativeChart(charts, id) {
  const entry = charts?.get(id);
  if (!entry) return;
  try { entry.chart?.destroy?.(); } catch (_) {}
  charts.delete(id);
}

function setCanvasState(canvas, { rendererKey, sourceKind, sourceLabel, operationalUse, title }) {
  if (!canvas) return;
  if (rendererKey) canvas.dataset[rendererKey] = 'native';
  canvas.setAttribute('data-source-kind', sourceKind);
  canvas.setAttribute('data-source-label', sourceLabel);
  canvas.setAttribute('data-operational-use', operationalUse);
  if (title) canvas.setAttribute('title', title);
  const statusId = `${canvas.id}-native-status`;
  let status = canvas.ownerDocument?.getElementById(statusId);
  if (sourceKind === 'unavailable') {
    if (!status && canvas.ownerDocument) {
      status = canvas.ownerDocument.createElement('p');
      status.id = statusId;
      status.setAttribute('role', 'status');
      status.style.cssText = 'padding:10px;color:var(--text-muted);font-size:12px;';
      canvas.insertAdjacentElement('afterend', status);
    }
    if (status) status.textContent = title || '차트 데이터를 아직 받지 못했습니다.';
  } else status?.remove();
}

function renderNativeHistoryChart(root, page, charts, { id, field, label, rendererKey, unavailableLabel, valueScale = 1, valueSuffix = '' }) {
  const canvas = page.querySelector(`#${id}`);
  if (!canvas) return;
  const rows = historyRows(root, field);
  const ChartConstructor = root?.Chart;
  if (rows.length < 2 || typeof ChartConstructor !== 'function') {
    destroyNativeChart(charts, id);
    setCanvasState(canvas, { rendererKey, sourceKind: 'unavailable', sourceLabel: `history:${field}:unavailable`, operationalUse: 'blocked', title: unavailableLabel });
    canvas.__rendered = 'native';
    return;
  }
  const signature = rows.map((row) => `${row.date}:${row.value}:${row.valueBasis}`).join('|');
  if (charts.get(id)?.signature === signature) return;
  destroyNativeChart(charts, id);
  let chart;
  try {
    chart = new ChartConstructor(canvas, {
      type: 'line',
      data: {
        labels: rows.map((row) => row.date.slice(5).replace('-', '/')),
        datasets: [{ label, data: rows.map((row) => row.value * valueScale), borderColor: '#4aa3df', backgroundColor: 'transparent', borderWidth: 1.8, pointRadius: 0, tension: 0.15, fill: false }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 5 }, grid: { display: false } },
          y: { ticks: { maxTicksLimit: 4 }, grid: { color: 'rgba(33,29,22,0.08)' } }
        },
        plugins: { legend: { display: false }, tooltip: { callbacks: {
          title: (items) => rows[items[0]?.dataIndex]?.date || '',
          label: (context) => `${label}: ${Number(context.parsed.y).toFixed(valueSuffix ? 1 : 2)}${valueSuffix}`
        } } }
      }
    });
  } catch (_) {
    setCanvasState(canvas, { rendererKey, sourceKind: 'unavailable', sourceLabel: `history:${field}:chart-runtime-failed`, operationalUse: 'blocked', title: unavailableLabel });
    canvas.__rendered = 'native';
    return;
  }
  charts.set(id, { chart, signature });
  canvas.__rendered = 'chartjs';
  const latestRow = rows[rows.length - 1];
  setCanvasState(canvas, { rendererKey, sourceKind: latestRow.sourceKind, sourceLabel: latestRow.source, operationalUse: 'reference-only', title: `${label} · source: ${latestRow.source} · basis: ${latestRow.valueBasis}` });
  canvas.setAttribute('data-change-basis', latestRow.valueBasis);
}

function renderNativeCurveChart(root, page, charts, canvasId = 'koreaCurveChart', rendererKey = 'aioFxbondChartRenderer') {
  const canvas = page.querySelector(`#${canvasId}`);
  if (!canvas) return;
  const curve = root?.AIO?.getUsTreasuryCurveEvidence?.()?.curve || null;
  const points = Array.isArray(curve?.points) ? curve.points : [];
  const cutIds = new Set(points.map((point) => point?.cutId).filter(Boolean));
  if (points.length < 2 || cutIds.size !== 1 || !curve?.curveCutId || typeof root?.Chart !== 'function') {
    destroyNativeChart(charts, canvasId);
    setCanvasState(canvas, { rendererKey, sourceKind: 'unavailable', sourceLabel: 'yield-curve:current-evidence-unavailable', operationalUse: 'blocked', title: '수익률 곡선 현재 관측값 미수신' });
    canvas.__rendered = 'native';
    return;
  }
  const signature = `${curve.curveCutId}|${points.map((point) => `${point.tenor}:${point.value}`).join('|')}`;
  if (charts.get(canvasId)?.signature === signature) return;
  destroyNativeChart(charts, canvasId);
  let chart;
  try {
    chart = new root.Chart(canvas, {
      type: 'line',
      data: {
        labels: points.map((point) => point.tenor),
        datasets: [{ label: 'US Treasury yield (%)', data: points.map((point) => point.value), borderColor: '#4aa3df', backgroundColor: 'rgba(74,163,223,0.12)', borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#4aa3df', fill: true, tension: 0.2 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => `${Number(context.parsed.y).toFixed(2)}%` } } },
        scales: { x: { ticks: { maxTicksLimit: 5 } }, y: { ticks: { maxTicksLimit: 5, callback: (value) => `${Number(value).toFixed(1)}%` } } }
      }
    });
  } catch (_) {
    setCanvasState(canvas, { rendererKey, sourceKind: 'unavailable', sourceLabel: 'yield-curve:chart-runtime-failed', operationalUse: 'blocked', title: '수익률 곡선 차트 런타임 보류' });
    canvas.__rendered = 'native';
    return;
  }
  charts.set(canvasId, { chart, signature });
  canvas.__rendered = 'chartjs';
  canvas.setAttribute('data-curve-cut-id', curve.curveCutId);
  setCanvasState(canvas, { rendererKey, sourceKind: points.every((point) => point.sourceKind === 'T1_OFFICIAL') ? 'T1_OFFICIAL' : 'unavailable', sourceLabel: `treasury-daily:${curve.curveCutId}`, operationalUse: 'reference-only', title: `US Treasury yield curve · cut ${curve.curveCutId}` });
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

function renderMacro(documentRef, root, page, charts) {
  renderLiveQuotes(root, page);
  renderSnapshotMetrics(root, page);
  const curveEvidence = root?.AIO?.getUsTreasuryCurveEvidence?.() || null;
  const curveSpread = curveEvidence?.curve || buildTreasuryCurveSpread({});
  const twoYear = finite(curveEvidence?.twoY);
  const tenYear = finite(curveEvidence?.tenY);
  const twoYearNode = page.querySelector('#macro-2y-value');
  const twoYearSourceNode = page.querySelector('#macro-2y-source');
  writeText(twoYearNode, Number.isFinite(twoYear) ? `${twoYear.toFixed(2)}%` : '—');
  writeText(twoYearSourceNode, Number.isFinite(twoYear) ? `${curveSpread.legs?.[0]?.source || 'U.S. Treasury'} DGS2 · 기준금리 참고` : 'DGS2 수신 대기');
  [twoYearNode, twoYearSourceNode].forEach((node) => {
    if (!node) return;
    node.dataset.aioMacroTwoYearRenderer = 'native';
    writeLineage(node, Number.isFinite(twoYear) ? 'fred' : 'unavailable', Number.isFinite(twoYear) ? `${curveSpread.legs?.[0]?.source || 'U.S. Treasury'}:DGS2` : 'DGS2 unavailable');
  });
  const spreadValueNode = page.querySelector('#macro-spread-value');
  const spreadMeaningNode = page.querySelector('#macro-spread-meaning');
  const spreadStatusNode = page.querySelector('#spread-status');
  const spread = curveSpread.spread;
  const available = spread != null;
  const valueText = spread == null ? '—' : `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%p`;
  const meaningText = spread == null
    ? `${curveSpread.label} — 동일 cut 값을 확정할 수 없습니다.`
    : curveSpread.mixedDates
      ? `${curveSpread.label} — 실시간 곡선으로 해석하지 않습니다.`
      : spread < -0.1 ? '역전 · 경기침체 경고 구간' : spread < 0.3 ? '평탄 · 방향성 확인 필요' : '정상 기울기 · 단독 매수 신호 아님';
  writeText(spreadValueNode, valueText);
  writeText(spreadMeaningNode, meaningText);
  writeText(spreadStatusNode, spread == null ? '2s10s: —' : `2s10s: ${valueText} · ${curveSpread.mode}`);
  [spreadValueNode, spreadMeaningNode, spreadStatusNode].forEach((node) => {
    if (!node) return;
    node.dataset.aioMacroSpreadRenderer = 'native';
    node.setAttribute('data-curve-mode', curveSpread.mode);
    node.setAttribute('data-curve-cut-id', curveSpread.curveCutId || '');
    node.setAttribute('data-spread-unit', curveSpread.unit || 'percentage-point');
    node.setAttribute('data-curve-comparable', curveSpread.comparable ? 'true' : 'false');
    writeLineage(node, available ? (curveSpread.mixedDates ? 'reference' : 'live') : 'unavailable', available ? curveSpread.label : 'yield-curve evidence unavailable');
  });
  const curveStatusNode = page.querySelector('#curve-status');
  const curveMeaningNode = page.querySelector('#curve-meaning');
  // LC-49: the drawn curve (2Y/10Y legs) and the official T10Y2Y spread are independent inputs. The
  // curve card used to be 'available' only when the official spread resolved, so a pending official
  // scalar hid an observed curve (and vice versa). Curve availability now comes from its own legs;
  // the spread band is only applied when the official cut is comparable.
  const curveLegsPresent = Number.isFinite(twoYear) && Number.isFinite(tenYear);
  const curveAvailable = curveLegsPresent;
  const curveSpreadComparable = curveLegsPresent && curveSpread.comparable === true && spread != null;
  const curveSpreadValue = curveSpreadComparable ? spread : null;
  const curveStatus = !curveLegsPresent
    ? '비교 판정 보류'
    : !curveSpreadComparable ? '2Y·10Y 관측 · 2s10s cut 미확정'
      : curveSpreadValue < -0.1 ? '역전 곡선' : curveSpreadValue < 0.3 ? '평탄 곡선' : '양(+)의 곡선';
  const curveMeaning = !curveLegsPresent
    ? `${curveSpread.label}`
    : !curveSpreadComparable ? '2Y·10Y는 관측됐지만 공식 2s10s와 같은 cut이 아니어서 스프레드 판정은 보류합니다.'
      : curveSpreadValue < -0.1 ? '2s10s 역전 · 경기·신용 위험을 함께 확인합니다.'
        : curveSpreadValue < 0.3 ? '2s10s 평탄 · 곡선 방향성 확인이 필요합니다.'
          : '10Y > 2Y · 정상 양(+) 기울기입니다.';
  writeText(curveStatusNode, curveStatus);
  writeText(curveMeaningNode, curveMeaning);
  [curveStatusNode, curveMeaningNode].forEach((node) => {
    if (!node) return;
    node.dataset.aioMacroCurveRenderer = 'native';
    node.setAttribute('data-curve-mode', curveSpread.mode);
    node.setAttribute('data-curve-cut-id', curveSpread.curveCutId || '');
    writeLineage(node, curveAvailable ? (curveSpread.mixedDates ? 'reference' : 'live') : 'unavailable', curveAvailable ? curveSpread.label : 'yield-curve evidence unavailable');
  });
  const fedMeaningNode = page.querySelector('#macro-fed-meaning');
  const fedMetric = readSnapshotMetric(root, 'fed-rate');
  const fomc = root?.AIO_EVENT_FRESHNESS_REGISTRY?.fomc;
  const fomcText = fomc?.eventDate ? `FOMC ${fomc.eventDate} 결과 확인` : 'FOMC 일정·결과 대기';
  const fedMeaning = fedMetric
    ? `Fed ${formatSnapshotMetric('fed-rate', fedMetric)} · ${fomcText}`
    : `Fed 연방기금금리 월평균 수신 대기 · ${fomcText}`;
  writeText(fedMeaningNode, fedMeaning);
  if (fedMeaningNode) {
    fedMeaningNode.dataset.aioMacroFedMeaningRenderer = 'native';
    writeLineage(fedMeaningNode, fedMetric ? 'fred' : 'unavailable', fedMetric?.source || 'FEDFUNDS unavailable');
  }
  renderNativeCurveChart(root, page, charts, 'yieldCurveChart', 'aioMacroChartRenderer');
  renderMacroTransmissionLens(documentRef, root, page);
  // LC-46: the banner was a static fail-closed notice that nothing updated, so the CPI/PCE cards could
  // carry values while the banner still claimed '원천 수신 대기'. Reflect what the cards actually show,
  // from the same render pass, instead of a hardcoded state.
  const staleBanner = page.querySelector('#macro-fred-stale-banner');
  if (staleBanner) {
    const renderedCards = ['cpi-yoy', 'core-cpi-yoy', 'pce-yoy', 'core-pce-yoy']
      .map((key) => String(page.querySelector(`[data-snap="${key}"]`)?.textContent || '').trim())
      .filter((text) => text && text !== '—');
    const received = renderedCards.length > 0;
    staleBanner.textContent = received
      ? `CPI/PCE ${renderedCards.length}/4 지표 수신 — 관측월·발표일과 함께 확인하세요. 미수신 값은 현재 판단에 사용하지 않습니다.`
      : 'CPI/PCE: FRED·BLS 원천 수신 대기 · 미수신 값은 현재 판단에 사용하지 않습니다.';
    staleBanner.dataset.runtimeState = received ? 'partial' : 'unavailable';
    staleBanner.setAttribute('data-operational-use', received ? 'reference-only' : 'blocked');
    staleBanner.style.color = received ? 'var(--text-secondary)' : 'var(--data-amber)';
  }
}

function renderFxbond(root, page, charts) {
  renderLiveQuotes(root, page);
  renderSnapshotMetrics(root, page);
  const curveEvidence = root?.AIO?.getUsTreasuryCurveEvidence?.() || null;
  const curveSpread = curveEvidence?.curve || buildTreasuryCurveSpread({});
  const twoYear = finite(curveEvidence?.twoY);
  const tnx = finite(curveEvidence?.tenY) ?? quoteValue(root, '^TNX')?.price;
  const dxy = quoteValue(root, 'DX-Y.NYB')?.price;
  const hasEvidence = Number.isFinite(dxy) && Number.isFinite(tnx);
  ['#yc-2y', '#yc-2y-track'].forEach((selector) => {
    const node = page.querySelector(selector);
    if (!node) return;
    writeText(node, Number.isFinite(twoYear) ? `${twoYear.toFixed(2)}%` : '—');
    node.dataset.aioFxbondTwoYearRenderer = 'native';
    node.style.color = Number.isFinite(twoYear)
      ? (twoYear > 4.5 ? 'var(--data-red)' : twoYear > 4 ? 'var(--data-amber)' : 'var(--data-green)')
      : 'var(--text-muted)';
    writeLineage(node, Number.isFinite(twoYear) ? 'fred' : 'unavailable', Number.isFinite(twoYear) ? `${curveSpread.legs?.[0]?.source || 'U.S. Treasury'}:DGS2` : 'DGS2 unavailable');
  });
  const spreadNode = page.querySelector('#sc-2s10s');
  const spread = curveSpread.spread;
  const spreadComparable = Number.isFinite(spread);
  if (spreadNode) {
    writeText(spreadNode, spread == null ? '—' : `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%p`);
    spreadNode.dataset.aioFxbondSpreadRenderer = 'native';
    spreadNode.setAttribute('data-curve-mode', curveSpread.mode);
    spreadNode.setAttribute('data-curve-cut-id', curveSpread.curveCutId || '');
    spreadNode.setAttribute('data-spread-unit', curveSpread.unit || 'percentage-point');
    spreadNode.setAttribute('data-curve-comparable', curveSpread.comparable ? 'true' : 'false');
    spreadNode.style.color = spread == null ? 'var(--text-muted)' : spread < 0 ? 'var(--data-red)' : spread < 0.1 ? 'var(--data-amber)' : 'var(--data-green)';
    spreadNode.title = curveSpread.label;
    writeLineage(spreadNode, spread == null ? 'unavailable' : curveSpread.mixedDates ? 'reference' : 'live', curveSpread.spreadSource || 'yield-curve evidence unavailable');
  }
  const riskNode = page.querySelector('#fxbond-risk-pill');
  let riskText = '판정 보류 · 달러·금리 입력 미수신';
  let riskClass = 'status-pill sp-neutral';
  if (hasEvidence) {
    if (dxy >= 107 || tnx >= 5) {
      riskText = '관측 · 높은 달러·금리 수준';
      riskClass = 'status-pill sp-risk-off';
    } else if (dxy >= 104 || tnx >= 4.5) {
      riskText = '관측 · 달러·금리 수준 확인';
      riskClass = 'status-pill sp-risk-off';
    } else if (dxy >= 100) {
      riskText = '관측 · 달러·금리 모니터링';
    } else {
      riskText = '관측 · 달러·금리 수준';
    }
  }
  writeText(riskNode, riskText);
  if (riskNode) {
    riskNode.className = riskClass;
    riskNode.dataset.aioFxbondRiskRenderer = 'native';
    writeLineage(riskNode, hasEvidence ? 'live' : 'unavailable', hasEvidence ? 'live:DX-Y.NYB+^TNX' : 'fxbond evidence unavailable');
  }
  const inversionNode = page.querySelector('#yc-inversion-badge');
  let inversionText = spreadComparable
    ? spread < -0.1 ? '2s10s 역전 · 비교 가능' : spread < 0.3 ? '2s10s 평탄 · 비교 가능' : '2s10s 정상 기울기 · 비교 가능'
    : curveSpread.label;
  let inversionColor = !spreadComparable ? 'var(--text-muted)' : spread < -0.1 ? 'var(--data-red)' : spread < 0.3 ? 'var(--data-amber)' : 'var(--data-green)';
  let inversionBackground = !spreadComparable ? 'rgba(33,29,22,0.06)' : spread < -0.1 ? 'rgba(177,58,48,0.15)' : spread < 0.3 ? 'rgba(177,58,48,0.08)' : 'rgba(34,117,76,0.12)';
  writeText(inversionNode, inversionText);
  if (inversionNode) {
    inversionNode.dataset.aioFxbondCurveRenderer = 'native';
    inversionNode.style.background = inversionBackground;
    inversionNode.style.color = inversionColor;
    writeLineage(inversionNode, spreadComparable ? (curveSpread.mixedDates ? 'reference' : 'live') : 'unavailable', spreadComparable ? curveSpread.label : 'yield-curve comparison unavailable');
  }
  const carryNode = page.querySelector('#carry-risk-level');
  const carryScoreNode = page.querySelector('#carry-score-text');
  const carryBarNode = page.querySelector('#carry-score-bar');
  const carryVerdictNode = page.querySelector('#carry-verdict');
  const jpy = quoteValue(root, 'JPY=X')?.price;
  const vix = quoteValue(root, '^VIX')?.price;
  const bokRate = finite(root?.DATA_SNAPSHOT?.bokRate);
  const directHyOasBp = finite(root?._hySpreadBp);
  const fredHyOasPct = finite(root?._fredData?.BAMLH0A0HYM2?.value);
  const hyOasBp = directHyOasBp ?? (fredHyOasPct == null ? null : fredHyOasPct * 100);
  const carryEvidence = [jpy, vix, tnx, bokRate, hyOasBp].every((value) => Number.isFinite(value));
  let carryText = '보류';
  let carryColor = 'var(--text-muted)';
  let carryScore = null;
  let carryVerdict = '판정 보류 · USD/JPY·VIX·미일 정책금리·HY OAS 입력 미수신';
  if (carryEvidence) {
    const rateDiff = tnx - bokRate;
    let score = 0;
    score += jpy > 158 ? 35 : jpy > 152 ? 25 : jpy > 145 ? 15 : 30;
    score += vix > 30 ? 30 : vix > 22 ? 20 : vix > 15 ? 10 : 5;
    score += rateDiff < 2.5 ? 20 : rateDiff < 3.5 ? 10 : 5;
    score += hyOasBp > 450 ? 15 : hyOasBp > 350 ? 8 : 3;
    score = Math.min(100, score);
    carryScore = score;
    carryText = score >= 70 ? '높음' : score >= 45 ? '주의' : '참고';
    carryColor = score >= 70 ? 'var(--data-red)' : score >= 45 ? 'var(--data-amber)' : 'var(--data-green)';
    carryVerdict = `관측 프록시 ${carryScore}/100 · 방향·비중 신호가 아니며 원인과 지속성을 교차 확인합니다.`;
  }
  writeText(carryNode, carryText);
  if (carryNode) {
    carryNode.dataset.aioFxbondCarryRenderer = 'native';
    carryNode.style.color = carryColor;
    writeLineage(carryNode, carryEvidence ? 'derived-reference' : 'unavailable', carryEvidence ? 'runtime:JPY+^VIX+^TNX · DATA_SNAPSHOT:BOK · FRED:HY-OAS' : 'carry proxy evidence unavailable');
  }
  writeText(carryScoreNode, carryScore == null ? '—' : String(carryScore));
  if (carryBarNode) {
    carryBarNode.style.width = `${carryScore == null ? 0 : carryScore}%`;
    carryBarNode.style.background = carryScore == null ? 'var(--text-muted)' : carryColor;
    carryBarNode.dataset.aioFxbondCarryScoreRenderer = 'native';
    writeLineage(carryBarNode, carryEvidence ? 'derived-reference' : 'unavailable', carryEvidence ? 'runtime:JPY+^VIX+^TNX · DATA_SNAPSHOT:BOK · FRED:HY-OAS' : 'carry proxy evidence unavailable');
  }
  writeText(carryVerdictNode, carryVerdict);
  [carryScoreNode, carryVerdictNode].forEach((node) => {
    if (!node) return;
    node.dataset.aioFxbondCarryScoreRenderer = 'native';
    writeLineage(node, carryEvidence ? 'derived-reference' : 'unavailable', carryEvidence ? 'runtime:JPY+^VIX+^TNX · DATA_SNAPSHOT:BOK · FRED:HY-OAS' : 'carry proxy evidence unavailable');
  });
  const camNode = page.querySelector('#cam-verdict-text');
  const dxyPct = quoteValue(root, 'DX-Y.NYB')?.pct;
  const hygPct = quoteValue(root, 'HYG')?.pct;
  const camSpread = spreadComparable ? spread : null;
  const camAvailable = [dxyPct, tnx, hygPct, camSpread].every((value) => Number.isFinite(value));
  let camText = '판정 보류 · DXY·10Y·HYG·2Y 입력 미수신';
  if (camAvailable) {
    let bullScore = 0;
    let bearScore = 0;
    let available = 0;
    if (dxyPct != null) { available++; if (dxyPct <= -0.3) bullScore++; else if (dxyPct >= 0.3) bearScore++; }
    if (tnx != null) { available++; if (tnx <= 3.5) bullScore++; else if (tnx >= 4.7) bearScore++; }
    if (hygPct != null) { available++; if (hygPct >= 0.3) bullScore++; else if (hygPct <= -0.3) bearScore++; }
    if (camSpread != null) { available++; if (camSpread >= 0.2) bullScore++; else if (camSpread < -0.2) bearScore++; }
    if (bullScore >= 3) camText = `위험선호 성격 관측 우세 (${bullScore}/${available}) · 방향·비중 신호 아님`;
    else if (bearScore >= 3) camText = `위험회피 성격 관측 우세 (${bearScore}/${available}) · 원인·지속성 확인 필요`;
    else if (bullScore > bearScore) camText = `상승 입력이 더 많음 (${bullScore}/${available}) · 단일 축 과잉 해석 금지`;
    else if (bearScore > bullScore) camText = `하락 입력이 더 많음 (${bearScore}/${available}) · 교차 확인 필요`;
    else camText = '입력 혼조 · 방향·비중을 단독 판정하지 않음';
  }
  writeText(camNode, camText);
  if (camNode) {
    camNode.dataset.aioFxbondCamRenderer = 'native';
    writeLineage(camNode, camAvailable ? 'live' : 'unavailable', camAvailable ? 'live:DX-Y.NYB+^TNX+HYG+DGS2' : 'cross-asset evidence unavailable');
  }
  const chartStatusNode = page.querySelector('#yc-chart-status');
  const chartStatus = !spreadComparable
    ? '2s10s 비교 판정 보류'
    : spread < 0 ? '역전 감지' : '정상 곡선';
  writeText(chartStatusNode, chartStatus);
  if (chartStatusNode) {
    chartStatusNode.style.color = !spreadComparable ? 'var(--text-muted)' : spread < 0 ? 'var(--data-red)' : 'var(--data-green)';
    chartStatusNode.dataset.aioFxbondCurveStatusRenderer = 'native';
    writeLineage(chartStatusNode, spreadComparable ? (curveSpread.mixedDates ? 'reference' : 'live') : 'unavailable', spreadComparable ? curveSpread.label : 'yield-curve comparison unavailable');
  }
  renderNativeHistoryChart(root, page, charts, {
    id: 'fxbond-tnx-trend',
    field: 'tnx',
    label: '10Y Treasury',
    rendererKey: 'aioFxbondChartRenderer',
    unavailableLabel: '미 10년물 공식 히스토리 미수신'
  });
  renderNativeHistoryChart(root, page, charts, {
    id: 'fxbond-jpy-trend',
    field: 'jpy',
    label: 'USD/JPY',
    rendererKey: 'aioFxbondChartRenderer',
    unavailableLabel: 'USD/JPY 공식 히스토리 미수신'
  });
  renderNativeCurveChart(root, page, charts);
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
        page.dataset.aioMacroChartRenderer = 'native';
        page.querySelectorAll('#yieldCurveChart').forEach((canvas) => { canvas.dataset.aioMacroChartRenderer = 'native'; });
        ['#macro-2y-value', '#macro-2y-source'].forEach((selector) => {
          const node = page.querySelector(selector);
          if (node) node.dataset.aioMacroTwoYearRenderer = 'native';
        });
        ['#macro-spread-value', '#macro-spread-meaning', '#spread-status'].forEach((selector) => {
          const node = page.querySelector(selector);
          if (node) node.dataset.aioMacroSpreadRenderer = 'native';
        });
        ['#curve-status', '#curve-meaning'].forEach((selector) => {
          const node = page.querySelector(selector);
          if (node) node.dataset.aioMacroCurveRenderer = 'native';
        });
        const fedMeaningNode = page.querySelector('#macro-fed-meaning');
        if (fedMeaningNode) fedMeaningNode.dataset.aioMacroFedMeaningRenderer = 'native';
      }
      if (route === 'fxbond') {
        page.dataset.aioArchitectureRenderer = 'native';
        page.dataset.aioFxbondRenderer = 'native';
        const inversionNode = page.querySelector('#yc-inversion-badge');
        if (inversionNode) inversionNode.dataset.aioFxbondCurveRenderer = 'native';
        const carryNode = page.querySelector('#carry-risk-level');
        if (carryNode) carryNode.dataset.aioFxbondCarryRenderer = 'native';
        ['#carry-score-text', '#carry-score-bar', '#carry-verdict'].forEach((selector) => {
          const node = page.querySelector(selector);
          if (node) node.dataset.aioFxbondCarryScoreRenderer = 'native';
        });
        const camNode = page.querySelector('#cam-verdict-text');
        if (camNode) camNode.dataset.aioFxbondCamRenderer = 'native';
        const chartStatusNode = page.querySelector('#yc-chart-status');
        if (chartStatusNode) chartStatusNode.dataset.aioFxbondCurveStatusRenderer = 'native';
        ['#yc-2y', '#yc-2y-track'].forEach((selector) => {
          const node = page.querySelector(selector);
          if (node) node.dataset.aioFxbondTwoYearRenderer = 'native';
        });
        const riskNode = page.querySelector('#fxbond-risk-pill');
        if (riskNode) riskNode.dataset.aioFxbondRiskRenderer = 'native';
        page.querySelectorAll('#fxbond-tnx-trend, #fxbond-jpy-trend, #koreaCurveChart').forEach((canvas) => {
          canvas.dataset.aioFxbondChartRenderer = 'native';
        });
      }
      if (route === 'breadth') {
        page.dataset.aioArchitectureRenderer = 'native';
        page.dataset.aioBreadthRenderer = 'native';
      }
      const renderNow = () => {
        if (route === 'macro') renderMacro(documentRef, root, page, charts);
        if (route === 'fxbond') renderFxbond(root, page, charts);
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
        if (route === 'macro' && page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (route === 'macro' && page.dataset.aioMacroRenderer === 'native') delete page.dataset.aioMacroRenderer;
        if (route === 'macro' && page.dataset.aioMacroChartRenderer === 'native') delete page.dataset.aioMacroChartRenderer;
        if (route === 'macro') page.querySelectorAll('#yieldCurveChart').forEach((canvas) => {
          if (canvas.dataset.aioMacroChartRenderer === 'native') delete canvas.dataset.aioMacroChartRenderer;
          if (canvas.__rendered === 'native' || canvas.__rendered === 'chartjs') delete canvas.__rendered;
        });
        if (route === 'macro') {
          ['#macro-2y-value', '#macro-2y-source'].forEach((selector) => {
            const node = page.querySelector(selector);
            if (node?.dataset.aioMacroTwoYearRenderer === 'native') delete node.dataset.aioMacroTwoYearRenderer;
          });
          ['#macro-spread-value', '#macro-spread-meaning', '#spread-status'].forEach((selector) => {
            const node = page.querySelector(selector);
            if (node?.dataset.aioMacroSpreadRenderer === 'native') delete node.dataset.aioMacroSpreadRenderer;
          });
          ['#curve-status', '#curve-meaning'].forEach((selector) => {
            const node = page.querySelector(selector);
            if (node?.dataset.aioMacroCurveRenderer === 'native') delete node.dataset.aioMacroCurveRenderer;
          });
          const fedMeaningNode = page.querySelector('#macro-fed-meaning');
          if (fedMeaningNode?.dataset.aioMacroFedMeaningRenderer === 'native') delete fedMeaningNode.dataset.aioMacroFedMeaningRenderer;
        }
        if (route === 'fxbond' && page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (route === 'fxbond' && page.dataset.aioFxbondRenderer === 'native') delete page.dataset.aioFxbondRenderer;
        const inversionNode = page.querySelector('#yc-inversion-badge');
        if (route === 'fxbond' && inversionNode?.dataset.aioFxbondCurveRenderer === 'native') delete inversionNode.dataset.aioFxbondCurveRenderer;
        const carryNode = page.querySelector('#carry-risk-level');
        if (route === 'fxbond' && carryNode?.dataset.aioFxbondCarryRenderer === 'native') delete carryNode.dataset.aioFxbondCarryRenderer;
        if (route === 'fxbond') {
          ['#carry-score-text', '#carry-score-bar', '#carry-verdict'].forEach((selector) => {
            const node = page.querySelector(selector);
            if (node?.dataset.aioFxbondCarryScoreRenderer === 'native') delete node.dataset.aioFxbondCarryScoreRenderer;
          });
          const camNode = page.querySelector('#cam-verdict-text');
          if (camNode?.dataset.aioFxbondCamRenderer === 'native') delete camNode.dataset.aioFxbondCamRenderer;
          const chartStatusNode = page.querySelector('#yc-chart-status');
          if (chartStatusNode?.dataset.aioFxbondCurveStatusRenderer === 'native') delete chartStatusNode.dataset.aioFxbondCurveStatusRenderer;
        }
        if (route === 'fxbond') {
          ['#yc-2y', '#yc-2y-track'].forEach((selector) => {
            const node = page.querySelector(selector);
            if (node?.dataset.aioFxbondTwoYearRenderer === 'native') delete node.dataset.aioFxbondTwoYearRenderer;
          });
        }
        const riskNode = page.querySelector('#fxbond-risk-pill');
        if (route === 'fxbond' && riskNode?.dataset.aioFxbondRiskRenderer === 'native') delete riskNode.dataset.aioFxbondRiskRenderer;
        if (route === 'fxbond') page.querySelectorAll('#fxbond-tnx-trend, #fxbond-jpy-trend, #koreaCurveChart').forEach((canvas) => {
          if (canvas.dataset.aioFxbondChartRenderer === 'native') delete canvas.dataset.aioFxbondChartRenderer;
          if (canvas.__rendered === 'native' || canvas.__rendered === 'chartjs') delete canvas.__rendered;
        });
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
