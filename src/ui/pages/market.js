import { createResourceBag, createChartRegistry } from '../../app/lifecycle.js';
import { deriveMacroTransmissionEvidence, MACRO_FUNDING_LIQUIDITY_REFERENCE, MACRO_LAGGED_SUPPLY_DEMAND_REFERENCE } from '../../domain/macro/transmission.js';
import { MARKET_CONFIRMATION_REFERENCE } from '../../domain/market/breadth.js';
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
  const price = finite(quote.price ?? quote.regularMarketPrice);
  const pct = finite(quote.pct ?? quote.regularMarketChangePercent);
  const changeBasis = quote.changeBasis || quote.valueBasis || 'unknown';
  return { quote, price, pct, changeBasis };
}

function annotateChangeBasis(node, value) {
  if (!node || !value) return;
  const basis = String(value.changeBasis || 'unknown');
  node.setAttribute('data-change-basis', basis);
  node.setAttribute('title', `변화율 기준: ${basis}`);
  const observedAt = value.quote.observedAt || null;
  if (observedAt) node.setAttribute('data-as-of', observedAt);
  else node.removeAttribute('data-as-of');
}

function quoteLineage(node, value) {
  const source = String(value.quote.source || value.quote._source || value.quote.provider || 'unknown');
  const kind = /snapshot|cache|reference/.test(source) ? 'reference' : 'observed';
  writeLineage(node, kind, source);
  annotateChangeBasis(node, value);
}

function clearRenderedValue(node, title = '현재 관측값 미수신') {
  if (!node) return;
  writeText(node, '—');
  node.classList?.remove('pos', 'neg');
  node.removeAttribute('data-change-basis');
  node.removeAttribute('data-as-of');
  node.removeAttribute('data-release-at');
  writeLineage(node, 'unavailable', 'native:missing-observation');
  node.setAttribute('data-operational-use', 'blocked');
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
}

function renderNativeHistoryChart(root, page, charts, { id, field, label, rendererKey, unavailableLabel }) {
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
        datasets: [{ label, data: rows.map((row) => row.value), borderColor: '#4aa3df', backgroundColor: 'transparent', borderWidth: 1.8, pointRadius: 0, tension: 0.15, fill: false }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 5 }, grid: { display: false } },
          y: { ticks: { maxTicksLimit: 4 }, grid: { color: 'rgba(33,29,22,0.08)' } }
        },
        plugins: { legend: { display: false }, tooltip: { callbacks: { title: (items) => rows[items[0]?.dataIndex]?.date || '' } } }
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
  const values = [
    ['3M', quoteValue(root, '^IRX')?.price],
    ['2Y', finite(root?._live2Y) ?? finite(root?._fredData?.DGS2?.value)],
    ['5Y', quoteValue(root, '^FVX')?.price],
    ['10Y', quoteValue(root, '^TNX')?.price],
    ['30Y', quoteValue(root, '^TYX')?.price]
  ];
  if (!values.every(([, value]) => Number.isFinite(value)) || typeof root?.Chart !== 'function') {
    destroyNativeChart(charts, canvasId);
    setCanvasState(canvas, { rendererKey, sourceKind: 'unavailable', sourceLabel: 'yield-curve:current-evidence-unavailable', operationalUse: 'blocked', title: '수익률 곡선 현재 관측값 미수신' });
    canvas.__rendered = 'native';
    return;
  }
  const signature = values.map(([, value]) => value).join('|');
  if (charts.get(canvasId)?.signature === signature) return;
  destroyNativeChart(charts, canvasId);
  let chart;
  try {
    chart = new root.Chart(canvas, {
      type: 'line',
      data: {
        labels: values.map(([label]) => label),
        datasets: [{ label: 'US Treasury yield (%)', data: values.map(([, value]) => value), borderColor: '#4aa3df', backgroundColor: 'rgba(74,163,223,0.12)', borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#4aa3df', fill: true, tension: 0.2 }]
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
  setCanvasState(canvas, { rendererKey, sourceKind: 'live', sourceLabel: 'live:^IRX+DGS2+^FVX+^TNX+^TYX', operationalUse: 'reference-only', title: 'US Treasury yield curve · current observed evidence' });
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
  const twoYear = finite(root?._live2Y) ?? finite(root?._fredData?.DGS2?.value);
  const tenYear = quoteValue(root, '^TNX')?.price;
  const twoYearNode = page.querySelector('#macro-2y-value');
  const twoYearSourceNode = page.querySelector('#macro-2y-source');
  writeText(twoYearNode, Number.isFinite(twoYear) ? `${twoYear.toFixed(2)}%` : '—');
  writeText(twoYearSourceNode, Number.isFinite(twoYear) ? 'FRED DGS2 · 기준금리 참고' : 'FRED DGS2 수신 대기');
  [twoYearNode, twoYearSourceNode].forEach((node) => {
    if (!node) return;
    node.dataset.aioMacroTwoYearRenderer = 'native';
    writeLineage(node, Number.isFinite(twoYear) ? 'fred' : 'unavailable', Number.isFinite(twoYear) ? 'FRED:DGS2' : 'FRED:DGS2 unavailable');
  });
  const spreadValueNode = page.querySelector('#macro-spread-value');
  const spreadMeaningNode = page.querySelector('#macro-spread-meaning');
  const spreadStatusNode = page.querySelector('#spread-status');
  const available = Number.isFinite(twoYear) && Number.isFinite(tenYear);
  const spread = available ? tenYear - twoYear : null;
  const valueText = spread == null ? '—' : `${spread >= 0 ? '+' : ''}${spread.toFixed(2)}%p`;
  const meaningText = spread == null
    ? '판정 보류 · 2Y·10Y 관측값 미수신'
    : spread < -0.1 ? '역전 · 경기침체 경고 구간' : spread < 0.3 ? '평탄 · 방향성 확인 필요' : '정상 기울기 · 단독 매수 신호 아님';
  writeText(spreadValueNode, valueText);
  writeText(spreadMeaningNode, meaningText);
  writeText(spreadStatusNode, spread == null ? '2s10s: —' : `2s10s: ${valueText}`);
  [spreadValueNode, spreadMeaningNode, spreadStatusNode].forEach((node) => {
    if (!node) return;
    node.dataset.aioMacroSpreadRenderer = 'native';
    writeLineage(node, available ? 'live' : 'unavailable', available ? 'live:^TNX+DGS2' : 'yield-curve evidence unavailable');
  });
  const curveStatusNode = page.querySelector('#curve-status');
  const curveMeaningNode = page.querySelector('#curve-meaning');
  const curveAvailable = Number.isFinite(twoYear) && Number.isFinite(tenYear);
  const curveSpread = curveAvailable ? tenYear - twoYear : null;
  const curveStatus = curveSpread == null
    ? '판정 보류'
    : curveSpread < -0.1 ? '역전 곡선' : curveSpread < 0.3 ? '평탄 곡선' : '양(+)의 곡선';
  const curveMeaning = curveSpread == null
    ? '판정 보류 · 2Y·10Y 관측값 미수신'
    : curveSpread < -0.1 ? '2s10s 역전 · 경기·신용 위험을 함께 확인합니다.'
      : curveSpread < 0.3 ? '2s10s 평탄 · 곡선 방향성 확인이 필요합니다.'
        : '10Y > 2Y · 정상 양(+) 기울기입니다.';
  writeText(curveStatusNode, curveStatus);
  writeText(curveMeaningNode, curveMeaning);
  [curveStatusNode, curveMeaningNode].forEach((node) => {
    if (!node) return;
    node.dataset.aioMacroCurveRenderer = 'native';
    writeLineage(node, curveAvailable ? 'live' : 'unavailable', curveAvailable ? 'live:^TNX+DGS2' : 'yield-curve evidence unavailable');
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
}

function renderFxbond(root, page, charts) {
  renderLiveQuotes(root, page);
  renderSnapshotMetrics(root, page);
  const twoYear = finite(root?._live2Y) ?? finite(root?._fredData?.DGS2?.value);
  ['#yc-2y', '#yc-2y-track'].forEach((selector) => {
    const node = page.querySelector(selector);
    if (!node) return;
    writeText(node, Number.isFinite(twoYear) ? `${twoYear.toFixed(2)}%` : '—');
    node.dataset.aioFxbondTwoYearRenderer = 'native';
    node.style.color = Number.isFinite(twoYear)
      ? (twoYear > 4.5 ? 'var(--data-red)' : twoYear > 4 ? 'var(--data-amber)' : 'var(--data-green)')
      : 'var(--text-muted)';
    writeLineage(node, Number.isFinite(twoYear) ? 'fred' : 'unavailable', Number.isFinite(twoYear) ? 'FRED:DGS2' : 'FRED:DGS2 unavailable');
  });
  const riskNode = page.querySelector('#fxbond-risk-pill');
  const dxy = quoteValue(root, 'DX-Y.NYB')?.price;
  const tnx = quoteValue(root, '^TNX')?.price;
  const hasEvidence = Number.isFinite(dxy) && Number.isFinite(tnx);
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
  const irx = quoteValue(root, '^IRX')?.price;
  const curveEvidence = Number.isFinite(tnx) && Number.isFinite(irx);
  let inversionText = '판정 보류 · 3개월·10년 금리 입력 미수신';
  let inversionColor = 'var(--text-muted)';
  let inversionBackground = 'rgba(33,29,22,0.06)';
  if (curveEvidence) {
    const spread = tnx - irx;
    if (spread < -0.2) {
      inversionText = '깊은 역전 · 경기침체 경고';
      inversionColor = 'var(--data-red)';
      inversionBackground = 'rgba(177,58,48,0.15)';
    } else if (spread < 0) {
      inversionText = '역전 지속 · 주의';
      inversionColor = 'var(--data-amber)';
      inversionBackground = 'rgba(177,58,48,0.08)';
    } else if (spread < 0.3) {
      inversionText = '역전 해소 중 · 위험 구간';
      inversionColor = 'var(--data-amber)';
      inversionBackground = 'rgba(177,58,48,0.08)';
    } else {
      inversionText = '정상 곡선 · 안정';
      inversionColor = 'var(--data-green)';
      inversionBackground = 'rgba(34,117,76,0.12)';
    }
  }
  writeText(inversionNode, inversionText);
  if (inversionNode) {
    inversionNode.dataset.aioFxbondCurveRenderer = 'native';
    inversionNode.style.background = inversionBackground;
    inversionNode.style.color = inversionColor;
    writeLineage(inversionNode, curveEvidence ? 'live' : 'unavailable', curveEvidence ? 'live:^TNX-^IRX' : 'yield-curve evidence unavailable');
  }
  const carryNode = page.querySelector('#carry-risk-level');
  const carryScoreNode = page.querySelector('#carry-score-text');
  const carryBarNode = page.querySelector('#carry-score-bar');
  const carryVerdictNode = page.querySelector('#carry-verdict');
  const jpy = quoteValue(root, 'JPY=X')?.price;
  const vix = quoteValue(root, '^VIX')?.price;
  const bojRate = finite(root?._bokData?.bokRate?.value);
  const hyOasBp = finite(root?._hySpreadBp) ?? finite(root?._fredData?.BAMLH0A0HYM2?.value) * 100;
  const carryEvidence = [jpy, vix, tnx, bojRate, hyOasBp].every((value) => Number.isFinite(value));
  let carryText = '보류';
  let carryColor = 'var(--text-muted)';
  let carryScore = null;
  let carryVerdict = '판정 보류 · USD/JPY·VIX·미일 정책금리·HY OAS 입력 미수신';
  if (carryEvidence) {
    const rateDiff = tnx - bojRate;
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
    writeLineage(carryNode, carryEvidence ? 'live' : 'unavailable', carryEvidence ? 'live:JPY+^VIX+^TNX+BOK+FRED-HY-OAS' : 'carry proxy evidence unavailable');
  }
  writeText(carryScoreNode, carryScore == null ? '—' : String(carryScore));
  if (carryBarNode) {
    carryBarNode.style.width = `${carryScore == null ? 0 : carryScore}%`;
    carryBarNode.style.background = carryScore == null ? 'var(--text-muted)' : carryColor;
    carryBarNode.dataset.aioFxbondCarryScoreRenderer = 'native';
    writeLineage(carryBarNode, carryEvidence ? 'live' : 'unavailable', carryEvidence ? 'live:JPY+^VIX+^TNX+BOK+FRED-HY-OAS' : 'carry proxy evidence unavailable');
  }
  writeText(carryVerdictNode, carryVerdict);
  [carryScoreNode, carryVerdictNode].forEach((node) => {
    if (!node) return;
    node.dataset.aioFxbondCarryScoreRenderer = 'native';
    writeLineage(node, carryEvidence ? 'live' : 'unavailable', carryEvidence ? 'live:JPY+^VIX+^TNX+BOK+FRED-HY-OAS' : 'carry proxy evidence unavailable');
  });
  const camNode = page.querySelector('#cam-verdict-text');
  const dxyPct = quoteValue(root, 'DX-Y.NYB')?.pct;
  const hygPct = quoteValue(root, 'HYG')?.pct;
  const camSpread = Number.isFinite(twoYear) && Number.isFinite(tnx) ? tnx - twoYear : null;
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
  const chartStatus = !curveEvidence
    ? '수익률 곡선 대기'
    : tnx - irx < 0 ? '역전 감지' : '정상 곡선';
  writeText(chartStatusNode, chartStatus);
  if (chartStatusNode) {
    chartStatusNode.style.color = !curveEvidence ? 'var(--text-muted)' : tnx - irx < 0 ? 'var(--data-red)' : 'var(--data-green)';
    chartStatusNode.dataset.aioFxbondCurveStatusRenderer = 'native';
    writeLineage(chartStatusNode, curveEvidence ? 'live' : 'unavailable', curveEvidence ? 'live:^TNX-^IRX' : 'yield-curve evidence unavailable');
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

function breadthHistoryEvidence(root) {
  const rows = (Array.isArray(root?._aioHistory) ? root._aioHistory : Array.isArray(root?._historyData) ? root._historyData : [])
    .filter((row) => row?.date && row.breadth20 != null && row.breadth50 != null && Number.isFinite(Number(row.breadth20)) && Number.isFinite(Number(row.breadth50)))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (rows.length < 2) return { available: false, rows: rows.length };
  const latest = rows[rows.length - 1];
  const comparison = rows[Math.max(0, rows.length - 6)];
  const meta = latest.fieldMeta?.breadth50 || latest.fieldMeta?.breadth20 || {};
  return {
    available: true,
    rows: rows.length,
    latest,
    comparison,
    sma20Delta: Number(latest.breadth20) - Number(comparison.breadth20),
    sma50Delta: Number(latest.breadth50) - Number(comparison.breadth50),
    observedAt: meta.observedAt || latest.date,
    source: meta.source || 'AIO US screener universe daily history',
    sourceKind: meta.sourceKind || 'derived-research'
  };
}

function renderBreadthReferenceLens(page) {
  const documentRef = page?.ownerDocument;
  if (!documentRef || !page) return;
  let host = page.querySelector('#breadth-reference-lens');
  if (!host) {
    host = documentRef.createElement('section');
    host.id = 'breadth-reference-lens';
    host.style.cssText = 'background:var(--surface-1);border:1px solid var(--border-subtle);border-radius:6px;padding:16px 18px;margin-bottom:26px;';
    page.appendChild(host);
  }
  host.replaceChildren();
  host.setAttribute('data-source-kind', MARKET_CONFIRMATION_REFERENCE.sourceKind);
  host.setAttribute('data-operational-use', MARKET_CONFIRMATION_REFERENCE.operationalUse);
  const make = (tag, text = '') => {
    const node = documentRef.createElement(tag);
    if (text) node.textContent = text;
    return node;
  };
  const title = make('div', '시장 확인 프로토콜 · 자료에서 추출한 시계열 판독');
  title.style.cssText = 'font-family:var(--font-display);font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:6px;';
  const boundary = make('p', MARKET_CONFIRMATION_REFERENCE.boundary);
  boundary.style.cssText = 'font-size:11px;line-height:1.65;color:var(--text-muted);margin:0 0 11px;';
  host.append(title, boundary);
  const grid = make('div');
  grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:7px;margin-bottom:11px;';
  MARKET_CONFIRMATION_REFERENCE.sequence.forEach((item, index) => {
    const card = make('div');
    card.style.cssText = 'min-height:76px;background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:5px;padding:8px;';
    const label = make('div', `${index + 1}. ${item.label}`);
    label.style.cssText = 'font-size:10px;font-weight:800;color:var(--text-primary);margin-bottom:4px;';
    const checks = make('div', item.checks);
    checks.style.cssText = 'font-size:10px;line-height:1.55;color:var(--text-muted);';
    card.append(label, checks);
    card.setAttribute('data-source-kind', 'REFERENCE');
    card.setAttribute('data-operational-use', 'reference-only');
    grid.appendChild(card);
  });
  host.appendChild(grid);
  const timeline = make('div');
  timeline.style.cssText = 'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:7px;';
  MARKET_CONFIRMATION_REFERENCE.timeSeries.forEach((item) => {
    const row = make('div', `${item.window} · ${item.purpose}`);
    row.style.cssText = 'font-size:10px;line-height:1.55;color:var(--data-cyan);border-top:1px solid var(--border-subtle);padding-top:6px;';
    row.setAttribute('data-source-kind', 'REFERENCE');
    row.setAttribute('data-operational-use', 'reference-only');
    timeline.appendChild(row);
  });
  host.appendChild(timeline);
}

function renderBreadth(root, page) {
  const evidence = breadthEvidence(root);
  const historyEvidence = breadthHistoryEvidence(root);
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
  const signalNode = page.querySelector('#breadth-signal-val');
  const ratio = evidence.available ? Number(evidence.advanceRatio) : null;
  writeText(advanceNode, Number.isFinite(ratio) ? `${(ratio * 100).toFixed(1)}%` : '—');
  if (advanceNode) {
    advanceNode.style.color = Number.isFinite(ratio)
      ? (ratio > 0.5 ? 'var(--data-green)' : ratio > 0.3 ? 'var(--data-amber)' : 'var(--data-red)')
      : 'var(--text-muted)';
    writeLineage(advanceNode, sourceKind, source);
  }
  const signalText = Number.isFinite(ratio)
    ? (ratio > 0.55 ? '광범위 상승' : ratio > 0.45 ? '중립' : '쏠림 장세')
    : '시장 폭 시그널 보류 · A/D 입력 미수신';
  writeText(signalNode, signalText);
  if (signalNode) {
    signalNode.dataset.aioBreadthSignalRenderer = 'native';
    signalNode.style.color = Number.isFinite(ratio)
      ? (ratio > 0.55 ? 'var(--data-green)' : ratio > 0.45 ? 'var(--data-amber)' : 'var(--data-red)')
      : 'var(--text-muted)';
    writeLineage(signalNode, sourceKind, source);
  }
  const diagnosticSignalNode = page.querySelector('#breadth-diag-signal');
  const diagnosticTextNode = page.querySelector('#breadth-diag-text');
  const diagnosticSignal = evidence.available
    ? `5/20/50일선 상회 ${Math.round(evidence.sma5)}/${Math.round(evidence.sma20)}/${Math.round(evidence.sma50)}%`
    : '판정 보류';
  const diagnosticText = evidence.available
    ? `${diagnosticSignal} · ${source}의 현재 관측입니다.${historyEvidence.available ? ` 동일 AIO 유니버스 ${historyEvidence.rows}일 이력에서 20일선 참여도 5거래일 변화는 ${historyEvidence.sma20Delta >= 0 ? '+' : ''}${historyEvidence.sma20Delta.toFixed(1)}%p입니다.` : ' 동일 유니버스 다일 이력은 아직 생성 대기 중입니다.'} 공식 거래소 A/D·McClellan은 별도 원천이 없어 판정을 보류합니다.`
    : '현재 5/20/50일선 breadth 및 A/D 시계열 원천이 없어 종합 진단을 보류합니다.';
  writeText(diagnosticSignalNode, diagnosticSignal);
  writeText(diagnosticTextNode, diagnosticText);
  [diagnosticSignalNode, diagnosticTextNode].forEach((node) => {
    if (!node) return;
    node.dataset.aioBreadthDiagnosticRenderer = 'native';
    node.style.color = evidence.available ? 'var(--text-primary)' : 'var(--text-muted)';
    writeLineage(node, sourceKind, source);
  });
  const stageNode = page.querySelector('#breadth-stage-summary');
  const participation = evidence.available && typeof root?.AIO_ARCH?.classifyBreadthParticipation === 'function'
    ? root.AIO_ARCH.classifyBreadthParticipation({ sma20: evidence.sma20, sma50: evidence.sma50, sma20Delta: historyEvidence.available ? historyEvidence.sma20Delta : null })
    : { available: false };
  writeText(stageNode, participation.available ? `${participation.level}${participation.direction ? ` · ${participation.direction}` : ''}` : '현재 참여도 미수신');
  if (stageNode) {
    stageNode.dataset.aioBreadthStageRenderer = 'native';
    stageNode.style.color = participation.available ? 'var(--text-primary)' : 'var(--text-muted)';
    writeLineage(stageNode, participation.available ? sourceKind : 'unavailable', participation.available ? source : 'breadth participation unavailable');
  }
  const mcclellanNode = page.querySelector('#breadth-mcclellan-summary');
  writeText(mcclellanNode, historyEvidence.available
    ? `AIO 50일선 참여도 ${historyEvidence.rows}일 이력 · 5거래일 Δ ${historyEvidence.sma50Delta >= 0 ? '+' : ''}${historyEvidence.sma50Delta.toFixed(1)}%p · 공식 McClellan 아님`
    : 'AIO 참여도 이력 생성 대기 · 공식 A/D·McClellan 판단 보류');
  if (mcclellanNode) {
    mcclellanNode.dataset.aioBreadthMcclellanRenderer = 'native';
    mcclellanNode.setAttribute('data-mcclellan-signal', historyEvidence.available ? 'aio-history-not-mcclellan' : 'unavailable');
    writeLineage(mcclellanNode, historyEvidence.available ? historyEvidence.sourceKind : 'unavailable', historyEvidence.available ? historyEvidence.source : 'official breadth A/D history unavailable');
  }
  const chartSourceKind = evidence.available || historyEvidence.available ? 'server-history' : 'unavailable';
  page.querySelectorAll('#bp-price-chart, #bp-ad-ratio-chart, #bp-5ma-chart, #bp-20ma-chart, #bp-50ma-chart').forEach((canvas) => {
    writeLineage(canvas, chartSourceKind, historyEvidence.source || source);
  });
  renderBreadthReferenceLens(page);
}

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
        const signalNode = page.querySelector('#breadth-signal-val');
        if (signalNode) signalNode.dataset.aioBreadthSignalRenderer = 'native';
        ['#breadth-diag-signal', '#breadth-diag-text'].forEach((selector) => {
          const node = page.querySelector(selector);
          if (node) node.dataset.aioBreadthDiagnosticRenderer = 'native';
        });
        page.querySelectorAll('#bp-price-chart, #bp-ad-ratio-chart, #bp-5ma-chart, #bp-20ma-chart, #bp-50ma-chart').forEach((canvas) => {
          canvas.dataset.aioBreadthChartRenderer = 'native';
        });
      }
      const renderNow = () => {
        if (route === 'macro') renderMacro(documentRef, root, page, charts);
        if (route === 'fxbond') renderFxbond(root, page, charts);
        if (route === 'breadth') renderBreadth(root, page);
      };
      renderNow();
      const unsubscribe = store?.subscribe?.(renderNow);
      if (unsubscribe) bag.add(unsubscribe);
      const eventTarget = documentRef || root;
      ['aio:liveQuotes', 'aio:liveDataReceived', 'aio:refresh:done', 'aio:serverDataLoaded', 'aio:historyLoaded', 'aio:macroUpdated'].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, renderNow);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, renderNow));
      });
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
