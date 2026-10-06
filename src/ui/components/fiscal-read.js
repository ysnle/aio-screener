// P1436: 재무 공시's lead block — annual revenue and net income as bars, the margin under each year,
// and the connected reading (growth → profitability → earnings vs price → price vs results).
import { buildFiscalRead, formatUsdShort } from '../../domain/fundamental/fiscal-read.js';
import { buildPeerRead } from '../../domain/fundamental/peer-read.js';
import { buildQuarterRead, parseQuarterHistory } from '../../domain/fundamental/quarter-read.js';
import { renderNextSteps } from './page-flow.js';
import { emptyState } from './empty-state.js';
import { loadJsonArtifact } from '../../data/artifact-cache.js';

// P1436: "YYYY-MM-DD:revenue:netIncome;…" in USD millions (public-data/sec-fiscal-history.json).
export function parseFiscalHistory(text) {
  // P1446: periodEnd:revenue:netIncome:equity:operatingCashFlow:capex:longTermDebt:sharesMillions (USD millions).
  const num = (value, scale = 1e6) => (value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value) * scale);
  return String(text || '').split(';').map((part) => part.split(':')).filter((cells) => /^\d{4}-\d{2}-\d{2}$/.test(cells[0] || ''))
    .map(([periodEnd, revenue, netIncome, equity, operatingCashFlow, capex, longTermDebt, shares]) => ({
      periodEnd, revenue: num(revenue), netIncome: num(netIncome), equity: num(equity), operatingCashFlow: num(operatingCashFlow),
      capex: num(capex), longTermDebt: num(longTermDebt), shares: num(shares)
    }));
}

function requestFiscalHistory(root, onReady) {
  if (root._aioSecFiscalHistory !== undefined || root._aioSecFiscalHistoryRequested) return;
  const fetchFn = root?.fetch || globalThis.fetch;
  if (typeof fetchFn !== 'function') return;
  root._aioSecFiscalHistoryRequested = true;
  const load = (url, maxBytes) => loadJsonArtifact(fetchFn.bind(root), url, { maxAgeMs: 6 * 60 * 60 * 1000, maxBytes });
  // P1440: the summary manifest names the fiscal artifact once the producer has written it.
  load('./public-data/sec-fundamentals-summary.manifest.json', 64 * 1024)
    .then((manifest) => (manifest?.fiscalHistory?.path === 'public-data/sec-fiscal-history.json' ? load('./public-data/sec-fiscal-history.json', 1024 * 1024) : null))
    .then((artifact) => { root._aioSecFiscalHistory = artifact?.data && typeof artifact.data === 'object' ? artifact.data : null; root._aioSecQuarterHistory = artifact?.quarters && typeof artifact.quarters === 'object' ? artifact.quarters : null; })
    .catch(() => { root._aioSecFiscalHistory = null; })
    .finally(() => { root._aioSecFiscalHistoryRequested = false; onReady(); });
}

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function bars(doc, read) {
  const box = el(doc, 'div', null, 'fiscal-bars');
  const max = Math.max(...read.history.map((year) => Math.max(year.revenue || 0, year.netIncome || 0)), 1);
  for (const year of read.history) {
    const col = el(doc, 'div', null, 'fiscal-col');
    const stack = el(doc, 'div', null, 'fiscal-stack');
    const revenue = el(doc, 'div', null, 'fiscal-bar is-revenue');
    revenue.style.height = `${Math.max(2, year.revenue / max * 100).toFixed(1)}%`;
    revenue.title = `매출 ${formatUsdShort(year.revenue)}`;
    stack.append(revenue);
    if (year.netIncome != null) {
      const income = el(doc, 'div', null, `fiscal-bar is-income${year.netIncome < 0 ? ' is-loss' : ''}`);
      income.style.height = `${Math.max(2, Math.abs(year.netIncome) / max * 100).toFixed(1)}%`;
      income.title = `순이익 ${formatUsdShort(year.netIncome)}`;
      stack.append(income);
    }
    col.append(el(doc, 'span', formatUsdShort(year.revenue), 'fiscal-value'), stack,
      el(doc, 'span', `FY${String(year.periodEnd).slice(0, 4)}`, 'fiscal-year'),
      el(doc, 'span', year.margin == null ? '' : `${year.margin.toFixed(0)}%`, 'fiscal-margin'));
    box.append(col);
  }
  const legend = el(doc, 'div', null, 'fiscal-legend');
  legend.append(el(doc, 'span', '매출', 'is-revenue'), el(doc, 'span', '순이익', 'is-income'), el(doc, 'span', '아래 % = 순이익률', 'is-note'));
  const wrap = el(doc, 'div', null, 'fiscal-chart');
  wrap.append(box, legend);
  return wrap;
}

// Codex review 2026-10-05: the last eight fiscal quarters — revenue bars with the change against the same
// quarter a year earlier underneath; a derived fourth quarter is marked.
function quarterSection(doc, root, symbol) {
  const text = root?._aioSecQuarterHistory?.[symbol];
  if (!text) return null;
  const read = buildQuarterRead(parseQuarterHistory(text));
  if (!read.available) return null;
  const box = el(doc, 'div', null, 'fiscal-quarters');
  box.append(el(doc, 'span', `분기 흐름 · 최근 ${read.rows.length}개 분기`, 'stock-read-vis-title'), el(doc, 'p', read.headline, 'briefing-read-headline'));
  const bars = el(doc, 'div', null, 'fiscal-bars');
  const max = Math.max(...read.rows.map((q) => Math.abs(q.revenue || 0)), 1);
  for (const q of read.rows) {
    const col = el(doc, 'div', null, 'fiscal-col');
    const stack = el(doc, 'div', null, 'fiscal-stack');
    const bar = el(doc, 'div', null, 'fiscal-bar is-revenue');
    bar.style.height = `${Math.max(2, (q.revenue || 0) / max * 100).toFixed(1)}%`;
    bar.title = `매출 ${formatUsdShort(q.revenue)}${q.netIncome != null ? ` · 순이익 ${formatUsdShort(q.netIncome)}` : ''}${q.derived ? ' · 연간 − 1~3분기로 계산' : ''}`;
    stack.append(bar);
    col.append(el(doc, 'span', formatUsdShort(q.revenue), 'fiscal-value'), stack,
      el(doc, 'span', `${q.periodEnd.slice(2, 7).replace('-', '.')}${q.derived ? '*' : ''}`, 'fiscal-year'),
      el(doc, 'span', q.revenueYoy == null ? '' : `${q.revenueYoy >= 0 ? '+' : ''}${q.revenueYoy.toFixed(0)}%`, 'fiscal-margin'));
    bars.append(col);
  }
  box.append(bars, el(doc, 'p', `아래 % = 전년 같은 분기 대비 매출 변화 · 분기 마감 월 기준${read.hasDerived ? ' · * 표시 분기는 연간 실적에서 1~3분기를 빼 계산한 값' : ''}.`, 'theme-strength-basis'));
  return box;
}

// P1467: where the company sits among same-sector SEC filers on the same four definitions.
function peerSection(doc, root, symbol, row, rows) {
  const history = root?._aioSecFiscalHistory;
  if (!history || !row?.sector) return null;
  const parsed = new Map();
  const seriesFor = (sym) => {
    if (!parsed.has(sym)) parsed.set(sym, history[sym] ? parseFiscalHistory(history[sym]) : null);
    return parsed.get(sym);
  };
  const peers = rows.filter((item) => item?.sector === row.sector && item.sym !== symbol && history[item.sym]).map((item) => item.sym);
  const read = buildPeerRead({ symbol, sector: row.sector, peers, seriesFor });
  if (!read.available) return null;
  const box = el(doc, 'div', null, 'fiscal-peers');
  box.append(el(doc, 'span', `같은 섹터와 비교 · ${row.sector} ${read.peers}곳`, 'stock-read-vis-title'), el(doc, 'p', read.summary, 'briefing-read-headline'));
  for (const metric of read.rows) {
    const line = el(doc, 'div', null, 'stock-read-bars');
    line.append(el(doc, 'span', metric.label, 'stock-read-bar-label'));
    const item = el(doc, 'div', null, 'stock-read-bar-row');
    if (metric.percentile == null) {
      item.append(el(doc, 'span', metric.value == null ? '이 회사 값 미수집' : `비교 가능한 기업 ${metric.n}곳 — 부족`, 'stock-read-bar-value'));
    } else {
      const tone = metric.percentile >= 75 ? 'favorable' : metric.percentile <= 25 ? 'burden' : 'neutral';
      const bar = el(doc, 'div', null, `stock-read-bar is-${tone}`);
      bar.style.width = `${Math.max(2, metric.percentile).toFixed(1)}%`;
      item.append(bar, el(doc, 'span', `${metric.value.toFixed(1)}% · 중앙값 ${metric.median.toFixed(1)}% · 상위 ${Math.max(1, Math.round(100 - metric.percentile))}%`, 'stock-read-bar-value'));
    }
    line.append(item);
    box.append(line);
  }
  const notes = ['막대 = 같은 섹터 기업 중 이 회사보다 낮은 비율(백분위)', '각 회사의 최근 회계연도 기준이며 회계연도 마감이 1년 이상 떨어진 기업은 제외', '섹터는 넓은 분류라 사업 구조가 다른 기업이 섞입니다'];
  if (/financ/i.test(row.sector)) notes.push('금융사는 매출·현금흐름의 의미가 일반 기업과 달라 마진·잉여현금 비교를 그대로 읽지 않습니다');
  if (read.rows.find((metric) => metric.id === 'fcfMargin')?.percentile == null) notes.push('잉여현금 마진은 현금흐름 공시가 수집되는 대로(약 1주) 채워집니다');
  box.append(el(doc, 'p', `${notes.join(' · ')}.`, 'theme-strength-basis'));
  return box;
}

export function renderFiscalRead({ documentRef: doc, root, state }) {
  const host = doc?.getElementById('fund-flow');
  if (!host) return null;
  host.dataset.aioFiscalReadRenderer = 'native';
  const symbol = String(state?.id || '').toUpperCase();
  const next = doc.getElementById('fund-next');
  if (!symbol) { host.hidden = true; host.replaceChildren(); renderNextSteps(doc, next, []); return null; }
  host.hidden = false;
  let rows = [];
  try { rows = typeof root?._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() || [] : []; } catch (_) { rows = []; }
  const row = rows.find((item) => item?.sym === symbol) || null;
  requestFiscalHistory(root, () => renderFiscalRead({ documentRef: doc, root, state }));
  const series = root?._aioSecFiscalHistory?.[symbol];
  const fundamentals = series ? { ...(state?.fundamentals || {}), fiscalHistory: parseFiscalHistory(series) } : state?.fundamentals || null;
  const read = buildFiscalRead({ symbol, fundamentals, row });
  host.replaceChildren(el(doc, 'h2', '재무 흐름', 'briefing-h2'));
  if (!read.available) {
    host.append(emptyState(doc, { title: 'SEC 연간 재무 기록이 없습니다', reason: `${symbol} — SEC 공시 대상(미국 상장 기업)이 아니거나 아직 수집되지 않은 종목입니다.`, next: 'ETF·해외 상장 종목은 공시 재무가 없습니다.', compact: true }));
  } else {
    host.querySelector('h2').append(el(doc, 'span', `SEC 10-K 연간 · ${read.history.length}개 회계연도`, 'briefing-h2-note'));
    if (read.headline) host.append(el(doc, 'p', `${symbol} — ${read.headline}`, 'briefing-read-headline'));
    if (read.history.length >= 2) host.append(bars(doc, read));
    const quarterBox = quarterSection(doc, root, symbol);
    if (quarterBox) host.append(quarterBox);
    const list = el(doc, 'ul', null, 'stock-read-points');
    for (const point of read.points) {
      const li = el(doc, 'li', null, `stock-read-point is-${point.tone}`);
      li.append(el(doc, 'span', point.title, 'stock-read-point-title'), el(doc, 'span', point.text, 'stock-read-point-text'));
      list.append(li);
    }
    host.append(list);
    const peerBox = peerSection(doc, root, symbol, row, rows);
    if (peerBox) host.append(peerBox);
  }
  renderNextSteps(doc, next, [
    { action: 'showTicker', arg: symbol, route: 'ticker', label: '요약', why: '실적 흐름과 주가 추세·섹터 회전이 같은 방향인지' },
    { route: 'technical', label: '차트', why: '실적이 뒷받침하는 추세에서 지금이 셋업 구간인지' },
    { route: 'market-news', label: '뉴스', why: `${symbol} 실적 발표·가이던스 소식` }
  ]);
  return read;
}
