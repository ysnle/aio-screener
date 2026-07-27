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

function historyRows(root, field) {
  try {
    const rows = typeof root?._aioHistorySeries === 'function' ? root._aioHistorySeries(field, 5) : [];
    return Array.isArray(rows)
      ? rows.map((row) => ({
        date: String(row?.date || row?.time || '').slice(0, 10),
        value: finite(row?.value ?? row?.close),
        sourceKind: row?.sourceKind || 'server-history',
        source: row?.source || `public-data/history.json:${field}`
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
  const signature = rows.map((row) => `${row.date}:${row.value}`).join('|');
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
  setCanvasState(canvas, { rendererKey, sourceKind: rows[rows.length - 1].sourceKind, sourceLabel: rows[rows.length - 1].source, operationalUse: 'reference-only', title: `${label} · source: ${rows[rows.length - 1].source}` });
}

function renderNativeCurveChart(root, page, charts) {
  const canvas = page.querySelector('#koreaCurveChart');
  if (!canvas) return;
  const values = [
    ['3M', quoteValue(root, '^IRX')?.price],
    ['2Y', finite(root?._live2Y) ?? finite(root?._fredData?.DGS2?.value)],
    ['5Y', quoteValue(root, '^FVX')?.price],
    ['10Y', quoteValue(root, '^TNX')?.price],
    ['30Y', quoteValue(root, '^TYX')?.price]
  ];
  if (!values.every(([, value]) => Number.isFinite(value)) || typeof root?.Chart !== 'function') {
    destroyNativeChart(charts, 'koreaCurveChart');
    setCanvasState(canvas, { rendererKey: 'aioFxbondChartRenderer', sourceKind: 'unavailable', sourceLabel: 'yield-curve:current-evidence-unavailable', operationalUse: 'blocked', title: '수익률 곡선 현재 관측값 미수신' });
    canvas.__rendered = 'native';
    return;
  }
  const signature = values.map(([, value]) => value).join('|');
  if (charts.get('koreaCurveChart')?.signature === signature) return;
  destroyNativeChart(charts, 'koreaCurveChart');
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
    setCanvasState(canvas, { rendererKey: 'aioFxbondChartRenderer', sourceKind: 'unavailable', sourceLabel: 'yield-curve:chart-runtime-failed', operationalUse: 'blocked', title: '수익률 곡선 차트 런타임 보류' });
    canvas.__rendered = 'native';
    return;
  }
  charts.set('koreaCurveChart', { chart, signature });
  canvas.__rendered = 'chartjs';
  setCanvasState(canvas, { rendererKey: 'aioFxbondChartRenderer', sourceKind: 'live', sourceLabel: 'live:^IRX+DGS2+^FVX+^TNX+^TYX', operationalUse: 'reference-only', title: 'US Treasury yield curve · current observed evidence' });
}

function renderMacro(root, page) {
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
    : `Fed 기준금리 수신 대기 · ${fomcText}`;
  writeText(fedMeaningNode, fedMeaning);
  if (fedMeaningNode) {
    fedMeaningNode.dataset.aioMacroFedMeaningRenderer = 'native';
    writeLineage(fedMeaningNode, fedMetric ? 'fred' : 'unavailable', fedMetric?.source || 'FEDFUNDS unavailable');
  }
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
    ? `${diagnosticSignal} · ${source}의 현재 관측입니다. 시장 참여도는 오늘 수준(추세국면 아님), McClellan은 A/D 시계열이 없어 판정을 보류합니다.`
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
    ? root.AIO_ARCH.classifyBreadthParticipation({ sma20: evidence.sma20, sma50: evidence.sma50 })
    : { available: false };
  writeText(stageNode, participation.available ? `${participation.level}${participation.direction ? ` · ${participation.direction}` : ''}` : '현재 참여도 미수신');
  if (stageNode) {
    stageNode.dataset.aioBreadthStageRenderer = 'native';
    stageNode.style.color = participation.available ? 'var(--text-primary)' : 'var(--text-muted)';
    writeLineage(stageNode, participation.available ? sourceKind : 'unavailable', participation.available ? source : 'breadth participation unavailable');
  }
  const mcclellanNode = page.querySelector('#breadth-mcclellan-summary');
  writeText(mcclellanNode, 'A/D 시계열 미수신 · 판단 보류');
  if (mcclellanNode) {
    mcclellanNode.dataset.aioBreadthMcclellanRenderer = 'native';
    mcclellanNode.setAttribute('data-mcclellan-signal', 'unavailable');
    writeLineage(mcclellanNode, 'unavailable', 'breadth A/D history unavailable');
  }
}

export function createMarketSlicePage({ root = globalThis, documentRef, store, route } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const charts = new Map();
      const page = documentRef?.getElementById(`page-${route}`);
      if (!page) return () => bag.dispose();
      page.dataset.aioArchitectureRoute = route;
      page.dataset.aioArchitectureSlice = 'market';
      if (route === 'macro') {
        page.dataset.aioArchitectureRenderer = 'native';
        page.dataset.aioMacroRenderer = 'native';
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
        if (route === 'macro') renderMacro(root, page);
        if (route === 'fxbond') renderFxbond(root, page, charts);
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
        charts.forEach((entry) => { try { entry.chart?.destroy?.(); } catch (_) {} });
        charts.clear();
        if (page.dataset.aioArchitectureRoute === route) delete page.dataset.aioArchitectureRoute;
        if (page.dataset.aioArchitectureSlice === 'market') delete page.dataset.aioArchitectureSlice;
        if (route === 'macro' && page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (route === 'macro' && page.dataset.aioMacroRenderer === 'native') delete page.dataset.aioMacroRenderer;
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
        }
      });
      return () => bag.dispose();
    }
  };
}
