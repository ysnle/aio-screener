// P1436: 재무 공시's lead block — annual revenue and net income as bars, the margin under each year,
// and the connected reading (growth → profitability → earnings vs price → price vs results).
import { buildFiscalRead, reconcileFiscalHistory } from '../../domain/fundamental/fiscal-read.js';
import { buildPeerRead } from '../../domain/fundamental/peer-read.js';
import { buildQuarterRead, parseQuarterHistory } from '../../domain/fundamental/quarter-read.js';
import { renderNextSteps } from './page-flow.js';
import { emptyState } from './empty-state.js';
import { loadJsonArtifact } from '../../data/artifact-cache.js';
import { secFilingUrl } from '../../domain/fundamental/sec-report.js';

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

// E05: a success is kept for 6 hours and a failure only for 60 seconds, so a 503 is retried and a new artifact
// is picked up in a long-open tab.
const FISCAL_OK_TTL_MS = 6 * 60 * 60 * 1000;
const FISCAL_RETRY_MS = 60 * 1000;
export function requestFiscalHistory(root, onReady) {
  const age = Date.now() - Number(root._aioSecFiscalHistoryAt || 0);
  if (root._aioSecFiscalHistory && age < FISCAL_OK_TTL_MS) return;
  if (root._aioSecFiscalHistory === null && age < FISCAL_RETRY_MS) return;
  // P1627: the pending history request belongs to the most recently displayed
  // company. Its completion must not repaint the prior issuer after navigation.
  root._aioSecFiscalHistoryOnReady = onReady;
  if (root._aioSecFiscalHistoryRequested) return;
  const fetchFn = root?.fetch || globalThis.fetch;
  if (typeof fetchFn !== 'function') return;
  root._aioSecFiscalHistoryRequested = true;
  const load = (url, maxBytes) => loadJsonArtifact(fetchFn.bind(root), url, { maxAgeMs: 6 * 60 * 60 * 1000, maxBytes });
  // P1440: the summary manifest names the fiscal artifact once the producer has written it.
  load('./public-data/sec-fundamentals-summary.manifest.json', 64 * 1024)
    .then((manifest) => (manifest?.fiscalHistory?.path === 'public-data/sec-fiscal-history.json' ? load('./public-data/sec-fiscal-history.json', 1024 * 1024) : null))
    .then((artifact) => { root._aioSecFiscalHistoryAt = Date.now(); root._aioSecFiscalHistory = artifact?.data && typeof artifact.data === 'object' ? artifact.data : null; root._aioSecQuarterHistory = artifact?.quarters && typeof artifact.quarters === 'object' ? artifact.quarters : null; root._aioSecFiscalPrecision = artifact?.precision || null; })
    .catch(() => { root._aioSecFiscalHistoryAt = Date.now(); root._aioSecFiscalHistory = null; })
    .finally(() => { root._aioSecFiscalHistoryRequested = false; const ready = root._aioSecFiscalHistoryOnReady; delete root._aioSecFiscalHistoryOnReady; ready?.(); });
}

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}

const number = (value) => value != null && value !== '' && typeof value !== 'boolean' && Number.isFinite(Number(value)) ? Number(value) : null;

// P1627: all years share one zero line and one monetary scale. Losses point down;
// an actual zero has zero height and a missing fact has no bar.
export function fiscalBarGeometry(values = []) {
  const amounts = values.map(number).filter((value) => value != null);
  const positive = Math.max(0, ...amounts);
  const negative = Math.max(0, ...amounts.map((value) => -value));
  const range = positive + negative || 1;
  const baseline = amounts.some((value) => value !== 0) ? positive / range * 100 : 50;
  return { baseline, rect: (input) => {
    const value = number(input);
    return value == null ? null : { top: value >= 0 ? baseline - value / range * 100 : baseline, height: Math.abs(value) / range * 100 };
  } };
}

export function formatFiscalAmount(value) {
  const v = number(value);
  if (v == null) return '자료 없음';
  return `${v < 0 ? '−' : ''}$${(Math.abs(v) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 3 })}M`;
}

// 2026-10-13 review S20: the table and bar labels read in the same B/T units as the reading ($416.2B, not
// $416,161M); the exact filed amount (formatFiscalAmount) stays in the cell title.
export function formatFiscalCompact(value) {
  const v = number(value);
  if (v == null) return '자료 없음';
  const abs = Math.abs(v);
  const body = abs >= 1e12 ? `${(abs / 1e12).toFixed(2)}T` : abs >= 1e9 ? `${(abs / 1e9).toFixed(1)}B` : abs >= 1e6 ? `${(abs / 1e6).toFixed(1)}M` : abs.toLocaleString('en-US', { maximumFractionDigits: 0 });
  return `${v < 0 ? '−' : ''}$${body}`;
}
function amountNode(doc, tag, prefix, value, className) {
  const node = el(doc, tag, `${prefix}${formatFiscalCompact(value)}`, className);
  if (number(value) != null) node.title = `${prefix}${formatFiscalAmount(value)}`;
  return node;
}

function fiscalChart(doc, rows, { quarter = false } = {}) {
  const scale = fiscalBarGeometry(rows.flatMap((year) => [year.revenue, year.netIncome]));
  const box = el(doc, 'div', null, 'fiscal-bars');
  box.style.setProperty('--fiscal-zero', `${scale.baseline.toFixed(3)}%`);
  for (const year of rows) {
    const col = el(doc, 'div', null, 'fiscal-col');
    const amounts = el(doc, 'div', null, 'fiscal-values');
    amounts.append(amountNode(doc, 'span', '매출 ', year.revenue, 'fiscal-value'),
      amountNode(doc, 'span', '순이익 ', year.netIncome, `fiscal-value${year.netIncome < 0 ? ' is-loss' : ''}`));
    const stack = el(doc, 'div', null, 'fiscal-stack');
    if (box.children.length === 0) {
      const zero = el(doc, 'span', '0', 'fiscal-zero-label');
      zero.style.top = `${scale.baseline.toFixed(3)}%`;
      stack.append(zero);
    }
    for (const [field, label, className] of [['revenue', '매출', 'is-revenue'], ['netIncome', '순이익', 'is-income']]) {
      const geometry = scale.rect(year[field]);
      if (!geometry) continue;
      const bar = el(doc, 'div', null, `fiscal-bar ${className}${year[field] < 0 ? ' is-loss' : ''}`);
      bar.style.top = `${geometry.top.toFixed(3)}%`;
      bar.style.height = `${geometry.height.toFixed(3)}%`;
      bar.title = `${year.periodEnd} ${label} ${formatFiscalAmount(year[field])}`;
      stack.append(bar);
    }
    const change = quarter ? year.revenueYoy : year.margin;
    col.append(amounts, stack, el(doc, 'span', `${quarter ? '분기' : '연간'} ${year.periodEnd}${year.derived ? '*' : ''}`, 'fiscal-year'),
      el(doc, 'span', change == null ? '비율 자료 없음' : quarter ? `매출 전년비 ${change >= 0 ? '+' : ''}${change.toFixed(1)}%` : `순이익률 ${change.toFixed(1)}%`, 'fiscal-margin'));
    box.append(col);
  }
  const scroll = el(doc, 'div', null, 'fiscal-chart-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', quarter ? '분기 매출과 순이익 차트, 가로 스크롤' : '연간 매출과 순이익 차트, 가로 스크롤');
  scroll.append(box);
  const legend = el(doc, 'div', null, 'fiscal-legend');
  legend.append(el(doc, 'span', '매출', 'is-revenue'), el(doc, 'span', '순이익', 'is-income'), el(doc, 'span', '0선 위 이익 · 아래 손실, 같은 금액 척도', 'is-note'));
  const wrap = el(doc, 'div', null, 'fiscal-chart fiscal-quality-chart');
  wrap.append(scroll, legend);
  return wrap;
}

function fiscalTable(doc, rows, { quarter = false } = {}) {
  const region = el(doc, 'div', null, 'fiscal-table-scroll');
  region.tabIndex = 0;
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', quarter ? '분기 공시 금액표, 가로 스크롤' : '연간 공시 금액표, 가로 스크롤');
  const table = el(doc, 'table', null, 'fiscal-amount-table');
  table.append(el(doc, 'caption', `${quarter ? '분기' : '연간'} 금액 · USD(B=10억·T=1조, 정확한 금액은 칸 위에 마우스) · 자료 없음은 0이 아닙니다`));
  const head = el(doc, 'thead'); const headRow = el(doc, 'tr');
  const definitions = quarter ? [['periodEnd', '분기 말'], ['revenue', '매출'], ['netIncome', '순이익'], ['margin', '순이익률']]
    : [['periodEnd', '회계연도 말'], ['revenue', '매출'], ['netIncome', '순이익'], ['operatingCashFlow', '영업현금흐름'], ['capex', '설비투자'], ['fcf', '잉여현금흐름'], ['equity', '자기자본(기말)'], ['longTermDebt', '장기부채'], ['shares', '주식 수']];
  for (const [, label] of definitions) { const th = el(doc, 'th', label); th.scope = 'col'; headRow.append(th); }
  head.append(headRow); table.append(head);
  const body = el(doc, 'tbody');
  for (const year of rows) {
    const tr = el(doc, 'tr');
    for (const [field] of definitions) {
      const value = field === 'fcf' ? number(year.operatingCashFlow) != null && number(year.capex) != null ? year.operatingCashFlow - year.capex : null : year[field];
      const text = field === 'periodEnd' ? `${year.periodEnd}${year.derived ? '*' : ''}` : field === 'margin' ? number(value) == null ? '자료 없음' : `${Number(value).toFixed(1)}%`
        : field === 'shares' ? number(value) == null ? '자료 없음' : `${(Number(value) / 1e6).toLocaleString('en-US', { maximumFractionDigits: Number(value) < 1e8 ? 1 : 0 })}M주`
          : formatFiscalCompact(value);
      const cell = el(doc, field === 'periodEnd' ? 'th' : 'td', text, number(value) < 0 ? 'is-loss' : null);
      if (field === 'periodEnd') cell.scope = 'row';
      else if (!['margin', 'shares'].includes(field) && number(value) != null) cell.title = formatFiscalAmount(value);
      if (field === 'shares') cell.title = year.sharesObservedAt ? `관측일 ${year.sharesObservedAt}` : '해당 회계연도 종료 뒤 표지에 신고한 주식 수';
      tr.append(cell);
    }
    body.append(tr);
  }
  table.append(body); region.append(table);
  return region;
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
  box.append(fiscalChart(doc, read.rows, { quarter: true }), fiscalTable(doc, read.rows, { quarter: true }),
    el(doc, 'p', `각 3개월의 실적이며 연간 금액과 구분합니다.${read.hasDerived ? ' * 분기는 연간 실적에서 1~3분기를 뺀 계산값입니다.' : ''}`, 'theme-strength-basis'));
  return box;
}

// P1467: where the company sits among same-sector SEC filers on the same four definitions.
function peerSection(doc, root, symbol, row, rows, fundamentals) {
  const history = root?._aioSecFiscalHistory;
  if (!history || !row?.sector) return null;
  const parsed = new Map();
  const seriesFor = (sym) => {
    if (!parsed.has(sym)) parsed.set(sym, history[sym] ? reconcileFiscalHistory(parseFiscalHistory(history[sym]), sym === symbol ? fundamentals : null, sym) : null);
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
      const track = el(doc, 'div', null, 'stock-read-track'); // P1591: the fill sits on a 0-100 track
      track.append(bar);
      item.append(track, el(doc, 'span', `${metric.value.toFixed(1)}% · 중앙값 ${metric.median.toFixed(1)}% · 상위 ${Math.max(1, Math.round(100 - metric.percentile))}%`, 'stock-read-bar-value'));
    }
    line.append(item);
    box.append(line);
  }
  const notes = ['막대 = 같은 섹터 기업 중 이 회사보다 낮은 비율(백분위)', '각 회사의 최근 회계연도 기준이며 회계연도 마감이 1년 이상 떨어진 기업은 제외', '섹터는 넓은 분류라 사업 구조가 다른 기업이 섞입니다'];
  if (/financ/i.test(row.sector)) notes.push('금융사는 매출·현금흐름의 의미가 일반 기업과 달라 마진·잉여현금 비교를 그대로 읽지 않습니다');
  if (read.rows.find((metric) => metric.id === 'fcfMargin')?.percentile == null) notes.push('잉여현금 마진은 영업현금흐름과 설비투자가 모두 수집된 기간에만 비교합니다');
  const details = el(doc, 'details', null, 'fiscal-method-details');
  details.append(el(doc, 'summary', '비교 범위와 계산 기준'), el(doc, 'p', `${notes.join(' · ')}.`, 'theme-strength-basis'));
  box.append(details);
  return box;
}

// S12: the Korean filing button. A receipt number opens that report (DART viewer, rcpNo); without one the DART
// disclosure search opens. The address stays in href/title, never in the body text.
export function dartLinkHref(company) {
  const receipt = String(company?.receiptNo || '').trim();
  return /^\d{14}$/.test(receipt) ? `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${receipt}` : 'https://dart.fss.or.kr/dsab007/main.do';
}
export function dartLink(doc, company) {
  const href = dartLinkHref(company);
  const link = el(doc, 'a', company?.receiptNo ? '한국 공시(DART) 사업보고서 원문' : '한국 공시(DART)에서 공시 검색', 'aio-btn-table fiscal-source-link');
  link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.title = '금융감독원 전자공시시스템(DART) · 새 창';
  return link;
}

function sourceLink(doc, fundamentals, { filings = false } = {}) {
  const cik = String(fundamentals?.cik || '');
  const href = filings ? /^\d{1,10}$/.test(cik) && Number(cik) > 0 ? `https://www.sec.gov/edgar/browse/?CIK=${Number(cik)}&owner=exclude` : null
    : secFilingUrl(cik, fundamentals?.accession);
  if (!href) return null;
  const link = el(doc, 'a', filings ? 'SEC 분기·연간 공시 목록 확인' : '이 연간 공시 원문 확인', 'fiscal-source-link');
  link.href = href; link.target = '_blank'; link.rel = 'noopener noreferrer';
  return link;
}

export function renderFiscalRead({ documentRef: doc, root, state }) {
  const host = doc?.getElementById('fund-flow');
  if (!host) return null;
  host.dataset.aioFiscalReadRenderer = 'native';
  const symbol = String(state?.id || '').toUpperCase();
  const next = doc.getElementById('fund-next');
  if (!symbol) { host.hidden = true; host.replaceChildren(); renderNextSteps(doc, next, []); return null; }
  host.hidden = false;
  host.classList.add('fiscal-quality');
  let rows = [];
  try { rows = typeof root?._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() || [] : []; } catch (_) { rows = []; }
  const row = rows.find((item) => item?.sym === symbol) || null;
  requestFiscalHistory(root, () => renderFiscalRead({ documentRef: doc, root, state }));
  const series = root?._aioSecFiscalHistory?.[symbol];
  const fundamentals = series ? { ...(state?.fundamentals || {}), fiscalHistory: parseFiscalHistory(series) } : state?.fundamentals || null;
  const read = buildFiscalRead({ symbol, fundamentals, row });
  host.replaceChildren(el(doc, 'h2', '재무 흐름', 'briefing-h2'));
  if (!read.available) {
    // 2026-10-13 review S12: a KRX listing is read from Korean filings (DART), not as "SEC 미수신".
    if (/\.K[SQ]$/.test(symbol)) {
      host.append(emptyState(doc, { title: '한국 공시(DART) 재무', reason: `${symbol} — 한국 상장 종목이라 SEC 공시 대상이 아닙니다. 연간 재무는 한국 공시(DART) 사업보고서 기준이며, 이 화면의 한국 공시 수집본은 아직 연결되지 않았습니다.`, next: '공시 원문은 아래 버튼에서 확인합니다.', compact: true }));
      const dart = dartLink(doc, root?._aioKrFundamentals?.companies?.[symbol]);
      if (dart) host.append(dart);
    } else host.append(emptyState(doc, { title: 'SEC 연간 재무 기록이 없습니다', reason: `${symbol} — SEC 공시 대상이 아니거나 아직 수집되지 않은 종목입니다.`, next: 'ETF는 사업회사 재무와 구분합니다.', compact: true }));
  } else {
    host.querySelector('h2').append(el(doc, 'span', `SEC 연간 · ${read.history.length}개 회계연도`, 'briefing-h2-note'));
    const basis = el(doc, 'p', `연간 공시 · 회계연도 말 ${read.latest.periodEnd || '미상'}${fundamentals?.filedAt ? ` · 제출 ${fundamentals.filedAt}` : ''} · 금액 USD`, 'fiscal-period-basis');
    const annualSource = sourceLink(doc, fundamentals);
    if (annualSource) basis.append(doc.createTextNode(' · '), annualSource);
    host.append(basis);
    if (read.headline) host.append(el(doc, 'p', `${symbol} — ${read.headline}`, 'briefing-read-headline'));
    if (read.history.length >= 2) host.append(fiscalChart(doc, read.history));
    host.append(fiscalTable(doc, read.history));
    host.append(el(doc, 'p', '잉여현금흐름 = 영업현금흐름 − 설비투자. 주식 수는 회계연도 종료 뒤 공시 표지의 관측값으로, 평균 유통주식 수와 다릅니다.', 'theme-strength-basis'));
    if (root._aioSecFiscalPrecision?.decimalPlaces !== 3 && series) {
      const precision = el(doc, 'details', null, 'fiscal-method-details');
      precision.append(el(doc, 'summary', '과거 기록의 표시 정밀도'),
        el(doc, 'p', `${read.latest.preciseAnnual ? '최근 연간 값은 같은 회계연도의 정확한 공시 금액으로 맞췄습니다. ' : ''}기존 연간·분기 이력은 백만 달러 단위로 반올림되어 과거 비율과 평균 자기자본 ROE에 근사 오차가 있습니다. 정밀 이력이 갱신되기 전까지 소수 금액을 복원하지 않습니다.`, 'theme-strength-basis'));
      host.append(precision);
    }
    const quarterBox = quarterSection(doc, root, symbol);
    if (quarterBox) host.append(quarterBox);
    // Codex browser audit H35: "최신" annual data is not the latest company state. Without quarters the gap after
    // the fiscal year end is named, so an old 10-K is not read as the current quarter.
    else if (read.latest?.periodEnd) {
      const missing = el(doc, 'p', `분기 실적 자료 없음 · 위 연간 숫자는 ${read.latest.periodEnd}까지입니다.`, 'fiscal-missing-period');
      const quarterSource = sourceLink(doc, fundamentals, { filings: true });
      if (quarterSource) missing.append(doc.createTextNode(' '), quarterSource);
      host.append(missing);
    }
    const list = el(doc, 'ul', null, 'stock-read-points');
    for (const point of read.points) {
      const li = el(doc, 'li', null, `stock-read-point is-${point.tone}`);
      const text = el(doc, 'div', null, 'stock-read-point-text');
      const separator = point.text.indexOf(' — ');
      if (point.text.length > 140 && separator > 0) {
        text.append(el(doc, 'span', point.text.slice(0, separator)));
        const details = el(doc, 'details', null, 'fiscal-method-details');
        details.append(el(doc, 'summary', '해석과 확인할 조건'), el(doc, 'p', point.text.slice(separator + 3)));
        text.append(details);
      } else text.textContent = point.text;
      li.append(el(doc, 'span', point.title, 'stock-read-point-title'), text);
      list.append(li);
    }
    host.append(list);
    const peerBox = peerSection(doc, root, symbol, row, rows, fundamentals);
    if (peerBox) host.append(peerBox);
  }
  renderNextSteps(doc, next, [
    { action: 'showTicker', arg: symbol, route: 'ticker', label: '요약', why: '실적 흐름과 주가 추세·섹터 회전이 같은 방향인지' },
    { route: 'technical', label: '차트', why: '실적이 뒷받침하는 추세에서 지금이 셋업 구간인지' },
    // v57.50 I23: the news screen opens on 기업 뉴스 narrowed to this ticker.
    { route: 'market-news', label: '뉴스', why: `${symbol} 실적 발표·가이던스 소식`, ctx: { ticker: symbol } }
  ]);
  return read;
}
