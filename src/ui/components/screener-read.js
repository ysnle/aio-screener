// P1437: 스크리너's lead block — top-fifth sector mix against the universe (bars), the connected reading
// (mix → rotation → trend health → past performance), and where to continue.
import { buildScreenerRead } from '../../domain/screener/screener-read.js';
import { summarizeValidation } from './screener-validation.js';
import { readMarketRegime } from './market-regime.js';
import { renderNextSteps } from './page-flow.js';
import { currentRotationItems } from '../../domain/themes/produced-rotation.js';
import { el } from './dom.js';
import { askRow } from './ask-row.js';

function mixVisual(doc, read, limit = 6) {
  const box = el(doc, 'div', null, 'screener-mix');
  box.append(el(doc, 'span', `${read.topName || '상위 20%'}와 전체의 업종 비중`, 'stock-read-vis-title'));
  const max = Math.max(...read.mix.slice(0, limit).map((row) => Math.max(row.top, row.all)), 1);
  for (const row of read.mix.slice(0, limit)) {
    const line = el(doc, 'div', null, 'stock-read-bars');
    line.append(el(doc, 'span', row.label, 'stock-read-bar-label'));
    const pair = el(doc, 'div', null, 'stock-read-bar-pair');
    for (const [kind, value] of [['stock', row.top], ['bench', row.all]]) {
      const item = el(doc, 'div', null, 'stock-read-bar-row');
      // v59.55 (visual review): a share, not a move — ink against the universe's gold, not the rising red.
      const bar = el(doc, 'div', null, `stock-read-bar is-${kind}`);
      bar.style.width = `${Math.max(2, value / max * 100).toFixed(1)}%`;
      item.append(bar, el(doc, 'span', `${value.toFixed(0)}%`, 'stock-read-bar-value'));
      pair.append(item);
    }
    line.append(pair);
    box.append(line);
  }
  const legend = el(doc, 'div', null, 'stock-read-legend');
  legend.append(el(doc, 'span', read.topName || '상위 20%', 'is-stock'), el(doc, 'span', '전체 유니버스', 'is-bench'));
  box.append(legend);
  return box;
}

// Codex browser audit H44: "1위 ILMN" pointed at the whole universe's top rank while the table showed a
// Technology-only, passed-only set. The ticker link follows the first row of the table as it is filtered
// and sorted now; the read above keeps describing the full ranking.
// P1592 (F01): once the table has rendered, an empty table means no lead — a re-render of the read must
// not bring back the previous first row's link.
let tableLead = null;
let tableRendered = false;
export function syncScreenerNextLead(doc, row, { scoped = false } = {}) {
  tableRendered = true;
  tableLead = row?.sym ? { sym: row.sym, scoped } : null;
  const button = doc?.querySelector?.('#screener-next .flow-next-link[data-action="showTicker"]');
  if (!button) return;
  const item = button.closest('li');
  if (!tableLead) { if (item) item.hidden = true; return; }
  if (item) item.hidden = false;
  button.dataset.arg = tableLead.sym;
  button.textContent = `${tableLead.sym} 종목 보기 →`;
  const why = item?.querySelector('.flow-next-why');
  if (why) why.textContent = tableLead.scoped ? '지금 표(조건·표시 필터·정렬)의 맨 위 종목을 요약·차트·재무로 확인' : '상위 종목 하나를 요약·차트·재무로 확인';
  if (why) button.title = why.textContent; // v58.79: the why is the link's hover
}

// v57.50 I22: a next list rendered outside renderScreenerRead (the KR branch) re-points its ticker link the same way.
export function reapplyScreenerNextLead(doc) {
  if (tableRendered) syncScreenerNextLead(doc, tableLead, { scoped: tableLead?.scoped });
}

export function renderScreenerRead({ documentRef: doc, root, rows = [] }) {
  const host = doc?.getElementById('screener-read');
  if (!host) return null;
  host.dataset.aioScreenerReadRenderer = 'native';
  const read = buildScreenerRead({
    rows,
    rotation: currentRotationItems(root?._serverDataMeta?.rotationHistory, Date.now()),
    regime: readMarketRegime(root),
    validation: summarizeValidation(root?._aioScreenerBacktestHistory || [], root?._aioModelValidationStatus || null, root?._aioRankingWeights || null)
  });
  host.replaceChildren(el(doc, 'h2', '지금 순위가 말하는 것', 'briefing-h2'));
  if (!read.available) { const rankRead = doc.getElementById('screener-rank-read'); if (rankRead) rankRead.hidden = true; host.append(el(doc, 'p', read.reason, 'daily-empty')); renderNextSteps(doc, doc.getElementById('screener-next'), []); return read; }
  host.append(el(doc, 'p', read.headline, 'briefing-read-headline'));
  // v59.51 (content audit): the 순위 view's head is one line — where the top fifth leans — over the three largest sector
  // bars. The validation verdict is the banner chip below; rotation, theme stage and the reasoning live in 사후 검증.
  const rankRead = doc.getElementById('screener-rank-read');
  if (rankRead) {
    const mixLine = String(read.points.find((point) => point.id === 'mix')?.text || read.headline).split(' — ')[0];
    // v59.56: questions that start from the ranking, at the end of the 순위 view's read (the default view).
    const ask = askRow(doc, [
      ['상위 종목의 공통점', '지금 스크리너 상위 종목들의 공통점과 섹터·테마 쏠림을 설명해줘'],
      ['지금 국면에 맞는 종목', '스크리너 상위 종목 중 지금 시장 국면에 맞는 종목을 고르는 기준을 알려줘'],
      ['이 순위를 믿어도 되나', '이 스크리너 점수가 잘 맞았던 때와 틀렸던 때, 사후 검증 결과를 어떻게 읽어야 하는지 알려줘']
    ], 'screener-read-ask');
    rankRead.replaceChildren(el(doc, 'p', mixLine, 'scr-rank-read-line'), mixVisual(doc, read, 3), ...(ask ? [ask] : []));
    rankRead.hidden = false;
  }
  // P1599 (F106/C01): the reasoning comes first, but the table is one click away instead of two screens down.
  const jump = el(doc, 'button', '순위 표로 가기', 'flow-next-link');
  jump.type = 'button';
  jump.addEventListener('click', () => {
    // 개편 v2: this reading sits in the 사후 검증 view; the table is the 순위 view, so switch to it first.
    if (doc.getElementById('page-screener')?.dataset.scrView !== 'rank') doc.getElementById('scr-tab-button-ranking')?.click();
    const table = doc.getElementById('screener-results-table');
    table?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    table?.querySelector?.('[data-aio-screener-ticker]')?.focus?.({ preventScroll: true });
  });
  host.append(jump);
  const layout = el(doc, 'div', null, 'screener-read-layout');
  const list = el(doc, 'ul', null, 'stock-read-points');
  for (const point of read.points) {
    const li = el(doc, 'li', null, `stock-read-point is-${point.tone}`);
    li.append(el(doc, 'span', point.title, 'stock-read-point-title'), el(doc, 'span', point.text, 'stock-read-point-text'));
    list.append(li);
  }
  layout.append(mixVisual(doc, read), list);
  host.append(layout);
  renderNextSteps(doc, doc.getElementById('screener-next'), read.next);
  if (tableRendered) syncScreenerNextLead(doc, tableLead, { scoped: tableLead?.scoped });
  return read;
}
