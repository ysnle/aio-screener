// P1436: 재무 공시's lead block — annual revenue and net income as bars, the margin under each year,
// and the connected reading (growth → profitability → earnings vs price → price vs results).
import { buildFiscalRead, formatUsdShort } from '../../domain/fundamental/fiscal-read.js';
import { renderNextSteps } from './page-flow.js';
import { emptyState } from './empty-state.js';

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
  const read = buildFiscalRead({ symbol, fundamentals: state?.fundamentals || null, row });
  host.replaceChildren(el(doc, 'h2', '재무 흐름', 'briefing-h2'));
  if (!read.available) {
    host.append(emptyState(doc, { title: 'SEC 연간 재무 기록이 없습니다', reason: `${symbol} — SEC 공시 대상(미국 상장 기업)이 아니거나 아직 수집되지 않은 종목입니다.`, next: 'ETF·해외 상장 종목은 공시 재무가 없습니다.', compact: true }));
  } else {
    host.querySelector('h2').append(el(doc, 'span', `SEC 10-K 연간 · ${read.history.length}개 회계연도`, 'briefing-h2-note'));
    if (read.headline) host.append(el(doc, 'p', `${symbol} — ${read.headline}`, 'briefing-read-headline'));
    if (read.history.length >= 2) host.append(bars(doc, read));
    const list = el(doc, 'ul', null, 'stock-read-points');
    for (const point of read.points) {
      const li = el(doc, 'li', null, `stock-read-point is-${point.tone}`);
      li.append(el(doc, 'span', point.title, 'stock-read-point-title'), el(doc, 'span', point.text, 'stock-read-point-text'));
      list.append(li);
    }
    host.append(list);
  }
  renderNextSteps(doc, next, [
    { action: 'showTicker', arg: symbol, route: 'ticker', label: '요약', why: '실적 흐름과 주가 추세·섹터 회전이 같은 방향인지' },
    { route: 'technical', label: '차트', why: '실적이 뒷받침하는 추세에서 지금이 셋업 구간인지' },
    { route: 'market-news', label: '뉴스', why: `${symbol} 실적 발표·가이던스 소식` }
  ]);
  return read;
}
