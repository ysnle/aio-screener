// P1436: 재무 공시's lead block — annual revenue and net income as bars, the margin under each year,
// and the connected reading (growth → profitability → earnings vs price → price vs results).
import { buildFiscalRead, formatUsdShort, reconcileFiscalHistory, shareSplitBreaks } from '../../domain/fundamental/fiscal-read.js';
import { buildPeerRead } from '../../domain/fundamental/peer-read.js';
import { buildQuarterRead, parseQuarterHistory } from '../../domain/fundamental/quarter-read.js';
import { renderNextSteps } from './page-flow.js';
import { emptyState } from './empty-state.js';
import { loadJsonArtifact, stableFetcher } from '../../data/artifact-cache.js';
import { secFilingUrl } from '../../domain/fundamental/sec-report.js';
import { buildConsensusPoint } from '../../domain/fundamental/consensus-read.js';
import { requestConsensusEstimates, consensusRowFor } from '../../data/consensus-estimates.js';
import { el } from './dom.js';
import { fiscalYearLabel, fiscalYearShortLabel } from '../../domain/fundamental/period.js';
import { loadFundamentalAnalysis } from './fundamental-analysis-lazy.js';
import { signedText, usdKoreanText } from '../../domain/shared/number.js';
import { sectorLabel } from '../../domain/screener/sector-label.js';
import { refreshSharedArtifact, sharedArtifactState } from '../../data/shared-artifacts.js';

// The provider earnings calendar (week rows + the v58.75 six-week `upcoming` map), shared with the company summary.
export const EARNINGS_CALENDAR = Object.freeze({ key: '_aioEarningsCalendarArtifact', url: './public-data/earnings-calendar.json', schemas: ['earnings-calendar.v1'], maxAgeMs: 6 * 60 * 60 * 1000, maxBytes: 512 * 1024 });

const CAPITAL_COLUMNS = ['grossProfit', 'operatingIncome', 'cash', 'shortTermInvestments', 'shareBasedCompensation', 'buybacks', 'dividends'];
// P1436: "YYYY-MM-DD:revenue:netIncome;…" in USD millions (public-data/sec-fiscal-history.json).
export function parseFiscalHistory(text) {
  // P1446: periodEnd:revenue:netIncome:equity:operatingCashFlow:capex:longTermDebt:sharesMillions (USD millions).
  // v58.55: [:totalAssets:researchAndDevelopment] — present once the issuer was read with those concepts (assetChain);
  // a row without them was written before, so its assets/R&D are "not yet collected", not "not reported".
  const num = (value, scale = 1e6) => (value === '' || value == null || !Number.isFinite(Number(value)) ? null : Number(value) * scale);
  return String(text || '').split(';').map((part) => part.split(':')).filter((cells) => /^\d{4}-\d{2}-\d{2}$/.test(cells[0] || ''))
    .map(([periodEnd, revenue, netIncome, equity, operatingCashFlow, capex, longTermDebt, shares, ...rest]) => ({
      periodEnd, revenue: num(revenue), netIncome: num(netIncome), equity: num(equity), operatingCashFlow: num(operatingCashFlow),
      capex: num(capex), longTermDebt: num(longTermDebt), shares: num(shares),
      ...(rest.length >= 2 ? { assetChain: true, totalAssets: num(rest[0]), researchAndDevelopment: num(rest[1]) } : {}),
      // v58.75 (persona review): the latest two years carry seven capital columns once read with them (absent = not yet collected).
      ...(rest.length >= 9 ? { capitalChain: true, ...Object.fromEntries(CAPITAL_COLUMNS.map((field, i) => [field, num(rest[2 + i])])) } : {})
    }));
}

// E05: a success is kept for 6 hours and a failure only for 60 seconds, so a 503 is retried and a new artifact
// is picked up in a long-open tab.
const FISCAL_OK_TTL_MS = 6 * 60 * 60 * 1000;
const FISCAL_RETRY_MS = 60 * 1000;
export function requestFiscalHistory(root, onReady, key = 'default') {
  const age = Date.now() - Number(root._aioSecFiscalHistoryAt || 0);
  if (root._aioSecFiscalHistory && age < FISCAL_OK_TTL_MS) return;
  if (root._aioSecFiscalHistory === null && age < FISCAL_RETRY_MS) return;
  // P1627: the pending history request belongs to the most recently displayed
  // company. Its completion must not repaint the prior issuer after navigation.
  // v58.55: one pending callback per caller (key) — 종목 요약 renders the company card and the analysis cards from the
  // same request, and a single slot let the later caller drop the earlier one's repaint.
  (root._aioSecFiscalHistoryOnReady ||= {})[key] = onReady;
  if (root._aioSecFiscalHistoryRequested) return;
  const fetchFn = root?.fetch || globalThis.fetch;
  if (typeof fetchFn !== 'function') return;
  root._aioSecFiscalHistoryRequested = true;
  const load = (url, maxBytes) => loadJsonArtifact(stableFetcher(root), url, { maxAgeMs: 6 * 60 * 60 * 1000, maxBytes });
  // P1440: the summary manifest names the fiscal artifact once the producer has written it.
  load('./public-data/sec-fundamentals-summary.manifest.json', 64 * 1024)
    .then((manifest) => (manifest?.fiscalHistory?.path === 'public-data/sec-fiscal-history.json' ? load('./public-data/sec-fiscal-history.json', 1024 * 1024) : null))
    .then((artifact) => { root._aioSecFiscalHistoryAt = Date.now(); root._aioSecFiscalHistoryFailed = false; root._aioSecFiscalHistory = artifact?.data && typeof artifact.data === 'object' ? artifact.data : null; root._aioSecQuarterHistory = artifact?.quarters && typeof artifact.quarters === 'object' ? artifact.quarters : null; root._aioSecFiscalPrecision = artifact?.precision || null; root._aioSecIssuerSic = artifact?.issuerSic && typeof artifact.issuerSic === 'object' ? artifact.issuerSic : null; })
    .catch(() => { root._aioSecFiscalHistoryAt = Date.now(); root._aioSecFiscalHistoryFailed = true; root._aioSecFiscalHistory = null; })
    .finally(() => { root._aioSecFiscalHistoryRequested = false; const ready = Object.values(root._aioSecFiscalHistoryOnReady || {}); delete root._aioSecFiscalHistoryOnReady; ready.forEach((fn) => fn?.()); });
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
  return v == null ? '자료 없음' : usdKoreanText(v, { precise: true });
}

// 2026-10-13 review S20: the table and bar labels read in the same units as the reading; the exact filed amount
// (formatFiscalAmount) stays in the cell title. First-users F33: Korean units (조·억·만 달러).
export function formatFiscalCompact(value) {
  const v = number(value);
  return v == null ? '자료 없음' : usdKoreanText(v);
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
    // 2026-10-14 audit #8: quarters carry the same net margin label as years (the table below has it); the
    // year-over-year line says plainly when the same quarter a year earlier is not in the record.
    col.append(amounts, stack, el(doc, 'span', `${quarter ? '분기' : '연간'} ${year.periodEnd}${year.derived ? '*' : ''}`, 'fiscal-year'),
      el(doc, 'span', year.margin == null ? '순이익률 자료 없음' : `순이익률 ${year.margin.toFixed(1)}%`, 'fiscal-margin'));
    if (quarter) col.append(el(doc, 'span', year.revenueYoy == null ? '전년 분기 비교 범위 밖' : `매출 전년비 ${signedText(year.revenueYoy, 1)}%`, 'fiscal-margin'));
    box.append(col);
  }
  const scroll = el(doc, 'div', null, 'fiscal-chart-scroll');
  scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region');
  scroll.setAttribute('aria-label', quarter ? '분기 매출과 순이익 차트, 가로 스크롤' : '연간 매출과 순이익 차트, 가로 스크롤');
  scroll.append(box);
  const legend = el(doc, 'div', null, 'fiscal-legend');
  legend.append(el(doc, 'span', '매출', 'is-revenue'), el(doc, 'span', '순이익', 'is-income'), el(doc, 'span', '0선 위 이익, 아래 손실, 같은 금액 척도', 'is-note'));
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
  table.append(el(doc, 'caption', `${quarter ? '분기' : '연간'} 금액, USD(B=10억·T=1조, 정확한 금액은 칸 위에 마우스), 자료 없음은 0이 아닙니다`));
  const head = el(doc, 'thead'); const headRow = el(doc, 'tr');
  // 2026-10-14 audit #21: a cover-page share count is not split-adjusted (620M → 24,400M across a split); the column
  // says so when such a jump is in the rows, and every year uses one unit (M주, one digit count for all rows).
  const splitBreaks = quarter ? [] : shareSplitBreaks(rows);
  const shareValues = rows.map((year) => number(year.shares)).filter((value) => value != null);
  const shareDigits = shareValues.length && Math.max(...shareValues) < 1e8 ? 1 : 0;
  const definitions = quarter ? [['periodEnd', '분기 말'], ['revenue', '매출'], ['netIncome', '순이익'], ['margin', '순이익률']]
    : [['periodEnd', '회계연도 말'], ['revenue', '매출'], ['netIncome', '순이익'], ['operatingCashFlow', '영업현금흐름'], ['capex', '설비투자'], ['fcf', '잉여현금흐름'], ['equity', '자기자본(기말)'], ['longTermDebt', '장기부채'], ['shares', splitBreaks.length ? '주식 수(분할 미조정)' : '주식 수']];
  for (const [, label] of definitions) { const th = el(doc, 'th', label); th.scope = 'col'; headRow.append(th); }
  head.append(headRow); table.append(head);
  const body = el(doc, 'tbody');
  for (const year of rows) {
    const tr = el(doc, 'tr');
    for (const [field] of definitions) {
      const value = field === 'fcf' ? number(year.operatingCashFlow) != null && number(year.capex) != null ? year.operatingCashFlow - year.capex : null : year[field];
      const text = field === 'periodEnd' ? `${year.periodEnd}${year.derived ? '*' : ''}` : field === 'margin' ? number(value) == null ? '자료 없음' : `${Number(value).toFixed(1)}%`
        : field === 'shares' ? number(value) == null ? '자료 없음' : `${(Number(value) / 1e6).toLocaleString('en-US', { minimumFractionDigits: shareDigits, maximumFractionDigits: shareDigits })}M주${splitBreaks.includes(year.periodEnd) ? '*' : ''}`
          : formatFiscalCompact(value);
      const cell = el(doc, field === 'periodEnd' ? 'th' : 'td', text, number(value) < 0 ? 'is-loss' : null);
      if (field === 'periodEnd') cell.scope = 'row';
      else if (!['margin', 'shares'].includes(field) && number(value) != null) cell.title = formatFiscalAmount(value);
      if (field === 'shares') cell.title = `${year.sharesObservedAt ? `관측일 ${year.sharesObservedAt}` : '해당 회계연도 종료 뒤 표지에 신고한 주식 수'}${splitBreaks.includes(year.periodEnd) ? ', 직전 해와의 차이는 주식 분할로 보이며 조정하지 않은 값' : ''}`;
      tr.append(cell);
    }
    body.append(tr);
  }
  table.append(body); region.append(table);
  return region;
}

// 2026-10-14 audit #21: amount tables fold (closed) under the chart so the chart and the reading come first.
function tableFold(doc, label, ...nodes) {
  const fold = el(doc, 'details', null, 'fiscal-method-details fiscal-table-fold');
  fold.append(el(doc, 'summary', label), ...nodes.filter(Boolean));
  return fold;
}

// Codex review 2026-10-05: the last eight fiscal quarters — revenue bars with the change against the same
// quarter a year earlier underneath; a derived fourth quarter is marked.
function quarterSection(doc, root, symbol) {
  const text = root?._aioSecQuarterHistory?.[symbol];
  if (!text) return null;
  const read = buildQuarterRead(parseQuarterHistory(text));
  if (!read.available) return null;
  const box = el(doc, 'div', null, 'fiscal-quarters');
  box.append(el(doc, 'span', `분기 흐름, 최근 ${read.rows.length}개 분기`, 'stock-read-vis-title'), el(doc, 'p', read.headline, 'briefing-read-headline'));
  box.append(fiscalChart(doc, read.rows, { quarter: true }),
    el(doc, 'p', `각 3개월의 실적이며 연간 금액과 구분합니다.${read.hasDerived ? ' * 분기는 연간 실적에서 1~3분기를 뺀 계산값입니다.' : ''}`, 'theme-strength-basis'),
    tableFold(doc, `분기 금액표 보기, ${read.rows.length}개 분기`, fiscalTable(doc, read.rows, { quarter: true })));
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
  box.append(el(doc, 'span', `같은 섹터와 비교, ${sectorLabel(row.sector)} ${read.peers}곳`, 'stock-read-vis-title'), el(doc, 'p', read.summary, 'briefing-read-headline'));
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
      item.append(track, el(doc, 'span', `${metric.value.toFixed(1)}%, 중앙값 ${metric.median.toFixed(1)}%, ${metric.percentile >= 50 ? `상위 ${Math.max(1, Math.round(100 - metric.percentile))}%` : `하위 ${Math.max(1, Math.round(metric.percentile))}%`}`, 'stock-read-bar-value'));
    }
    line.append(item);
    box.append(line);
  }
  const notes = ['막대 = 같은 섹터 기업 중 이 회사보다 낮은 비율(백분위)', '각 회사의 최근 회계연도 기준이며 회계연도 마감이 1년 이상 떨어진 기업은 제외', '섹터는 넓은 분류라 사업 구조가 다른 기업이 섞입니다'];
  if (/financ/i.test(row.sector)) notes.push('금융사는 매출·현금흐름의 의미가 일반 기업과 달라 마진·잉여현금 비교를 그대로 읽지 않습니다');
  if (read.rows.find((metric) => metric.id === 'fcfMargin')?.percentile == null) notes.push('잉여현금 마진은 영업현금흐름과 설비투자가 모두 수집된 기간에만 비교합니다');
  const details = el(doc, 'details', null, 'fiscal-method-details');
  details.append(el(doc, 'summary', '비교 범위와 계산 기준'), el(doc, 'p', `${notes.join(', ')}.`, 'theme-strength-basis'));
  box.append(details);
  return box;
}

// v58.53 개편 v2 (5g): 이익의 질 — operating cash flow ÷ net income for each filed year (the trend is only the years in
// sec-fiscal-history; no year is estimated), the latest free-cash-flow margin and the one-year share count change.
// Banks are skipped: their operating cash flow mixes deposits and loans, so the ratio does not read as earnings quality.
function earningsQualityCard(doc, read, analysis) {
  if (read.points.some((point) => point.id === 'bank')) return null;
  const years = read.history.filter((year) => number(year.operatingCashFlow) != null && number(year.netIncome) != null).slice(-5);
  const latest = read.history.at(-1);
  if (!latest || number(latest.operatingCashFlow) == null) return null;
  const ratioOf = (year) => (year.netIncome > 0 && year.operatingCashFlow > 0 ? year.operatingCashFlow / year.netIncome : null);
  const card = el(doc, 'div', null, 'sx-card v2-fiscal-quality');
  const head = el(doc, 'div', null, 'sx-card__head');
  head.append(el(doc, 'h3', '이익의 질', 'sx-card__title'), el(doc, 'span', `회계연도 말 ${latest.periodEnd}`, 'sx-card__meta'));
  card.append(head);
  const rows = el(doc, 'div', null, 'v2-fiscal-rows');
  const row = (name, detail, value, extra = null) => {
    const line = el(doc, 'div', null, 'v2-fiscal-row');
    const label = el(doc, 'span', null, 'v2-fiscal-row__label');
    label.append(el(doc, 'span', name, 'v2-fiscal-row__name'), el(doc, 'span', detail, 'v2-fiscal-row__detail'));
    line.append(label, el(doc, 'b', value, 'v2-fiscal-row__value'));
    if (extra) line.append(extra);
    rows.append(line);
    return line;
  };
  const ratio = ratioOf(latest);
  // The trend: one small bar per filed year (ratio capped at 2 for the drawing; the number is printed as filed).
  let trend = null;
  const plotted = years.map((year) => ({ year, ratio: ratioOf(year) }));
  if (plotted.filter((item) => item.ratio != null).length >= 2) {
    trend = el(doc, 'div', null, 'v2-fiscal-trend');
    trend.setAttribute('role', 'img');
    trend.setAttribute('aria-label', `영업현금흐름 ÷ 순이익 ${plotted.length}개 회계연도: ${plotted.map((item) => `${fiscalYearLabel(item.year.periodEnd)} ${item.ratio == null ? '해당 없음' : item.ratio.toFixed(2)}`).join(', ')}`);
    for (const item of plotted) {
      const col = el(doc, 'span', null, 'v2-fiscal-trend__col');
      const bar = el(doc, 'span', null, `v2-fiscal-trend__bar${item.ratio == null ? ' is-na' : item.ratio < 0.8 ? ' is-low' : ''}`);
      bar.style.height = `${item.ratio == null ? 4 : Math.max(6, Math.min(item.ratio, 2) / 2 * 100).toFixed(1)}%`;
      col.title = `${item.year.periodEnd} ${item.ratio == null ? '순이익 또는 영업현금흐름이 마이너스 — 비율 해당 없음' : item.ratio.toFixed(2)}`;
      col.append(el(doc, 'span', item.ratio == null ? '—' : item.ratio.toFixed(2), 'v2-fiscal-trend__value'), bar, el(doc, 'span', fiscalYearShortLabel(item.year.periodEnd), 'v2-fiscal-trend__year'));
      trend.append(col);
    }
  }
  row('영업현금흐름 ÷ 순이익', ratio == null ? '순이익·현금흐름 중 하나가 마이너스 — 비율 해석 보류' : ratio >= 1 ? '1 이상 — 이익이 현금으로 들어옴' : ratio >= 0.8 ? '0.8~1 — 이익 대부분이 현금으로 들어옴' : '1보다 낮음 — 장부 이익보다 현금이 적음', ratio == null ? '해당 없음' : ratio.toFixed(2), trend);
  // v58.55: the Sloan (1996) accrual ratio on its original denominator (average total assets), now that assets are collected.
  // The analysis module loads on first use (fundamental-analysis-lazy.js); until it arrives the accrual row waits for the repaint.
  const accrual = analysis ? analysis.buildAccrualRead(read.history) : { state: 'loading' };
  const COLLECTION_PENDING_LABEL = analysis?.COLLECTION_PENDING_LABEL || '';
  const accrualLatest = accrual.state === 'ready' ? accrual.latest : null;
  if (accrual.state === 'pending') row('이익 중 현금이 아닌 몫 (발생액 비율)', COLLECTION_PENDING_LABEL, '대기');
  else if (accrual.state === 'unreported') row('이익 중 현금이 아닌 몫 (발생액 비율)', '총자산이 공시 수집본에 없어 계산하지 않음', '해당 없음');
  else if (accrualLatest) {
    const value = accrualLatest.ratio;
    // v58.80 (first-users run-4): the formula moved to the hover; the row reads in words.
    const line = row('이익 중 현금이 아닌 몫 (발생액 비율)', `순이익에서 실제 들어온 영업 현금을 뺀 값을 총자산으로 나눔, ${accrualLatest.label}${accrual.latestIsNewest ? '' : ' (최근 연도 자료 없음)'} — ${Math.abs(value) < 0.01 ? '장부 이익과 현금이 거의 같음' : value < 0 ? '현금이 장부 이익보다 많이 들어옴' : value < 0.05 ? '장부 이익 일부가 아직 현금이 아님' : '장부 이익 중 현금이 아닌 부분이 자산 대비 큼'}`,
      signedText(value * 100, 1, '%'));
    line.title = `(순이익 − 영업현금흐름) ÷ ${accrualLatest.basis === 'average' ? '평균' : '기말'} 총자산 (Sloan 1996). ` + accrual.years.map((year) => `${year.label} ${signedText(year.ratio * 100, 1, '%')}${year.basis === 'average' ? '' : '(기말)'}`).join(', ');
    if (value >= 0.05) line.classList.add('is-burden');
  }
  const capex = number(latest.capex);
  if (capex != null && latest.revenue > 0) row('잉여현금흐름 마진', '매출 중 설비투자까지 쓰고 남은 현금의 비율', `${((latest.operatingCashFlow - capex) / latest.revenue * 100).toFixed(1)}%`);
  const prev = read.history.at(-2);
  if (number(latest.shares) > 0 && number(prev?.shares) > 0) {
    const split = shareSplitBreaks(read.history).includes(latest.periodEnd);
    const change = (latest.shares / prev.shares - 1) * 100;
    row('주식 수 변화 (1년)', split ? '주식 분할 해 — 분할 전후라 비교 보류' : change <= -0.5 ? '자사주 매입이 보상 주식 발행보다 많음' : change >= 0.5 ? '신주·보상 주식으로 주식 수 증가' : '거의 변하지 않음', split ? '분할' : signedText(change, 1, '%'));
  }
  card.append(rows);
  // v58.74 (text audit 종목 C4): the two signals can disagree (NVDA: cash 0.86 of income, yet accruals +10.9% of assets) —
  // the expert says how both are true and what to check next.
  if (ratio != null && ratio >= 0.8 && accrualLatest && accrualLatest.ratio >= 0.05 && latest.netIncome > latest.operatingCashFlow) {
    card.append(el(doc, 'p', `이익의 ${Math.round(ratio * 100)}%는 현금으로 들어왔지만, 현금이 아닌 이익 ${formatUsdShort(latest.netIncome - latest.operatingCashFlow)}이 자산 대비 큽니다(발생액 비율 ${signedText(accrualLatest.ratio * 100, 1, '%')}). 매출이 빠르게 늘 때는 매출채권·재고가 함께 느는 경우가 많아, 다음 분기 현금 전환을 확인합니다.`, 'v2-fiscal-quality__reconcile'));
  }
  // ③ 원리 / 지금 읽기 / 한계 behind one disclosure row; ④ the evidence line.
  const fold = el(doc, 'details', null, 'sx-disclosure v2-fiscal-principle');
  fold.append(el(doc, 'summary', '원리, 이익의 질'));
  const body = el(doc, 'div', null, 'sx-disclosure__body');
  const box = (label, text) => { const c = el(doc, 'div', null, 'sx-disclosure__card'); c.append(el(doc, 'span', label, 'sx-disclosure__label'), el(doc, 'p', text, 'sx-disclosure__text')); return c; };
  body.append(
    box('원리', '회계 이익은 발생주의라 현금보다 먼저 잡힐 수 있습니다. 영업현금흐름 ÷ 순이익이 1 근처면 이익이 현금으로 뒷받침되고, 발생액(순이익 − 영업현금흐름)이 큰 기업은 이후 수익률이 낮은 경향이 관측됐습니다.'),
    box('지금 읽기', `${ratio == null ? `${latest.periodEnd} 회계연도는 순이익이나 영업현금흐름이 마이너스라 비율로 읽지 않고 두 금액을 따로 봅니다.` : `${latest.periodEnd} 회계연도 영업현금흐름은 순이익의 ${(ratio * 100).toFixed(0)}%입니다${plotted.length >= 2 ? ` — 위 막대는 공시된 ${plotted.length}개 회계연도의 같은 비율입니다` : ''}.`}${accrualLatest ? ` 발생액 비율은 ${accrualLatest.label} ${accrualLatest.ratio >= 0 ? '+' : '-'}${Math.abs(accrualLatest.ratio * 100).toFixed(1)}%로, 마이너스일수록 현금이 이익보다 많이 들어왔다는 뜻입니다.` : ''}`),
    box('한계, 함께 볼 것', `${accrual.state === 'pending' ? '발생액을 평균 총자산으로 나눈 비율(원 연구의 정의)은 총자산 수집이 끝나면 표시됩니다. ' : '발생액 비율의 5% 구간은 이 화면의 읽기 기준이며 원 연구의 분위 경계가 아닙니다. '}운전자본이 크게 변한 해나 대규모 일회성 항목은 10-K 현금흐름표에서 확인합니다.`));
  fold.append(body);
  card.append(fold, el(doc, 'p', '근거, Sloan(1996) 발생액 이상 현상, 데이터, 미국 증권거래위원회 연간 공시(10-K)', 'sx-evidence'));
  return card;
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
  link.title = '금융감독원 전자공시시스템(DART), 새 창';
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
  host.dataset.fiscalSymbol = symbol;
  host.classList.add('fiscal-quality');
  let rows = [];
  try { rows = typeof root?._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() || [] : []; } catch (_) { rows = []; }
  const row = rows.find((item) => item?.sym === symbol) || null;
  requestFiscalHistory(root, () => renderFiscalRead({ documentRef: doc, root, state }), 'fiscal');
  const analysis = loadFundamentalAnalysis(() => { if (doc.getElementById('fund-flow')?.dataset.fiscalSymbol === symbol) renderFiscalRead({ documentRef: doc, root, state }); });
  const series = root?._aioSecFiscalHistory?.[symbol];
  const fundamentals = series ? { ...(state?.fundamentals || {}), fiscalHistory: parseFiscalHistory(series) } : state?.fundamentals || null;
  const quarterText = root?._aioSecQuarterHistory?.[symbol];
  const read = buildFiscalRead({ symbol, fundamentals, row, quarters: quarterText ? parseQuarterHistory(quarterText) : [] });
  // v57.54: the forward view (consensus, reference only) follows the reported reading.
  if (!/\.K[SQ]$/.test(symbol)) {
    requestConsensusEstimates(root, () => renderFiscalRead({ documentRef: doc, root, state }));
    refreshSharedArtifact(root, EARNINGS_CALENDAR).then(({ changed }) => { if (changed && doc.getElementById('fund-flow')?.dataset.fiscalSymbol === symbol) renderFiscalRead({ documentRef: doc, root, state }); }).catch(() => {});
  }
  const consensusPoint = buildConsensusPoint(row, consensusRowFor(root, symbol));
  host.replaceChildren(el(doc, 'h2', '재무 흐름', 'briefing-h2'));
  if (!read.available) {
    // 2026-10-13 review S12: a KRX listing is read from Korean filings (DART), not as "SEC 미수신".
    if (/\.K[SQ]$/.test(symbol)) {
      host.append(emptyState(doc, { title: '한국 공시(DART) 재무', reason: `${symbol} — 한국 상장 종목의 연간 재무는 한국 공시(DART) 사업보고서 원문에서 확인합니다.`, compact: true }));
      const dart = dartLink(doc, root?._aioKrFundamentals?.companies?.[symbol]);
      if (dart) host.append(dart);
    // v58.80 (first-users F03): on a slow phone NVDA read "SEC 공시 대상이 아니거나…" while the history file was still on its
    // way (undefined = not answered yet); run-2: a failed download is not "no record" either.
    } else if (root?._aioSecFiscalHistory === undefined) host.append(emptyState(doc, { title: '재무 기록을 불러오는 중입니다', reason: `${symbol} — 공시 재무 파일이 도착하면 여기에 그립니다.`, compact: true }));
    else if (root?._aioSecFiscalHistoryFailed) host.append(emptyState(doc, { title: '재무 파일을 받지 못했습니다', reason: `${symbol} — 연결이 느리거나 끊겨 공시 재무 파일이 도착하지 않았습니다.`, next: '1분 뒤 이 화면을 다시 열면 다시 받습니다.', compact: true }));
    else host.append(emptyState(doc, { title: 'SEC 연간 재무 기록이 없습니다', reason: `${symbol} — SEC 공시 대상이 아니거나 아직 수집되지 않은 종목입니다.`, next: 'ETF는 사업회사 재무와 구분합니다.', compact: true }));
  } else {
    // v58.53 개편 v2 (5g): ① hero (the reading in one line + basis) → ② revenue/income card beside 이익의 질 → quarters,
    // the reading rows and peers as cards.
    host.querySelector('h2').classList.add('sr-only');
    const hero = el(doc, 'div', null, 'sx-card sx-card--hero v2-fiscal-hero');
    hero.append(el(doc, 'span', `SEC 연간, ${read.history.length}개 회계연도`, 'sx-kicker'));
    // 2026-10-14 audit #9: how old the annual figures are sits on this one basis line (it was on the SEC card).
    const fyAgeDays = /^\d{4}-\d{2}-\d{2}$/.test(String(read.latest.periodEnd || '')) ? Math.floor((Date.now() - Date.parse(read.latest.periodEnd)) / 86400000) : null;
    const basis = el(doc, 'p', `연간 공시, 회계연도 말 ${read.latest.periodEnd || '미상'}${fyAgeDays != null && fyAgeDays >= 0 ? `, 회계연도 말로부터 ${fyAgeDays}일` : ''}${fundamentals?.filedAt ? `, 제출 ${fundamentals.filedAt}` : ''}, 금액 USD`, 'fiscal-period-basis sx-meta');
    const annualSource = sourceLink(doc, fundamentals);
    if (annualSource) basis.append(doc.createTextNode(', '), annualSource);
    if (read.headline) hero.append(el(doc, 'p', `${symbol} — ${read.headline}`, 'briefing-read-headline v2-stock-lede'));
    // v58.75 (persona review): the last four filed quarters and the next report date under the (possibly old) annual line.
    const extra = analysis ? analysis.fiscalExtras(doc, { root, symbol, quarters: quarterText ? parseQuarterHistory(quarterText) : [], history: read.history, consensus: consensusRowFor(root, symbol), calendar: root?.[EARNINGS_CALENDAR.key], calendarState: sharedArtifactState(root, EARNINGS_CALENDAR.key), rows, fundamentals, series: !!series, financial: read.points.some((point) => point.id === 'bank') }) : null;
    if (extra) hero.append(...extra.hero);
    hero.append(basis);
    host.append(hero);
    const chartCard = el(doc, 'div', null, 'sx-card v2-fiscal-chart');
    const chartHead = el(doc, 'div', null, 'sx-card__head');
    chartHead.append(el(doc, 'h3', '매출과 순이익', 'sx-card__title'), el(doc, 'span', '막대 = 금액, 아래 = 순이익률', 'sx-card__meta'));
    chartCard.append(chartHead);
    if (read.history.length >= 2) chartCard.append(fiscalChart(doc, read.history));
    const splitNote = shareSplitBreaks(read.history).length ? ' 주식 수는 분할을 조정하지 않은 값이라, * 표시 해의 차이는 주식 분할입니다.' : '';
    chartCard.append(tableFold(doc, `연간 금액표 보기, ${read.history.length}개 회계연도`, fiscalTable(doc, read.history),
      el(doc, 'p', `잉여현금흐름 = 영업현금흐름 − 설비투자. 주식 수는 회계연도 종료 뒤 공시 표지의 관측값으로, 평균 유통주식 수와 다릅니다.${splitNote}`, 'theme-strength-basis')));
    if (root._aioSecFiscalPrecision?.decimalPlaces !== 3 && series) {
      const precision = el(doc, 'details', null, 'fiscal-method-details');
      precision.append(el(doc, 'summary', '과거 기록의 표시 정밀도'),
        el(doc, 'p', `${read.latest.preciseAnnual ? '최근 연간 값은 같은 회계연도의 정확한 공시 금액으로 맞췄습니다. ' : ''}기존 연간·분기 이력은 백만 달러 단위로 반올림되어 과거 비율과 평균 자기자본 ROE에 근사 오차가 있습니다. 정밀 이력이 갱신되기 전까지 소수 금액을 복원하지 않습니다.`, 'theme-strength-basis'));
      chartCard.append(precision);
    }
    const pair = el(doc, 'div', null, 'v2-fiscal-pair');
    const quality = earningsQualityCard(doc, read, analysis);
    pair.append(chartCard, ...(quality ? [quality] : []));
    host.append(pair);
    // v58.55 (5g): R&D ÷ revenue beside the cash reading's years (US filers with a fiscal series only).
    const rd = series && analysis ? analysis.rdCard(doc, read.history) : null;
    if (rd) host.append(rd);
    if (extra) host.append(...extra.cards); // v58.75: margin ladder · net cash · capital return, EPS against consensus
    const quarterBox = quarterSection(doc, root, symbol);
    if (quarterBox) { quarterBox.classList.add('sx-card'); host.append(quarterBox); }
    // Codex browser audit H35: "최신" annual data is not the latest company state. Without quarters the gap after
    // the fiscal year end is named, so an old 10-K is not read as the current quarter.
    else if (read.latest?.periodEnd) {
      const missing = el(doc, 'p', `분기 실적 자료 없음, 위 연간 숫자는 ${read.latest.periodEnd}까지입니다.`, 'fiscal-missing-period');
      const quarterSource = sourceLink(doc, fundamentals, { filings: true });
      if (quarterSource) missing.append(doc.createTextNode(' '), quarterSource);
      host.append(missing);
    }
    const readingCard = el(doc, 'div', null, 'sx-card v2-fiscal-reading');
    const readingHead = el(doc, 'div', null, 'sx-card__head');
    readingHead.append(el(doc, 'h3', '공시를 문장으로 읽기', 'sx-card__title'), el(doc, 'span', '성장, 수익성, 현금, 부채, 주식 수', 'sx-card__meta'));
    const list = el(doc, 'ul', null, 'stock-read-points');
    for (const point of consensusPoint ? [...read.points, consensusPoint] : read.points) {
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
    readingCard.append(readingHead, list);
    host.append(readingCard, ...(extra?.after || []));
    // v58.75 (persona review): same-theme companies by name first; the broad-sector percentile folds under it.
    const themePeers = extra?.themePeers || null;
    if (themePeers) host.append(themePeers);
    const peerBox = peerSection(doc, root, symbol, row, rows, fundamentals);
    if (peerBox && themePeers) {
      const fold = el(doc, 'details', null, 'fiscal-method-details fiscal-peer-fold');
      fold.append(el(doc, 'summary', `넓은 섹터 안 위치 보기, ${sectorLabel(row.sector)}`), ...[...peerBox.children]);
      host.append(fold);
    } else if (peerBox) { peerBox.classList.add('sx-card'); host.append(peerBox); }
  }
  renderNextSteps(doc, next, [
    { action: 'showTicker', arg: symbol, route: 'ticker', label: '요약', why: '실적 흐름과 주가 추세·섹터 회전이 같은 방향인지' },
    { route: 'technical', label: '차트', why: '실적이 뒷받침하는 추세에서 지금이 셋업 구간인지' },
    // v57.50 I23: the news screen opens on 기업 뉴스 narrowed to this ticker.
    { route: 'market-news', label: '뉴스', why: `${row?.name || symbol} 실적 발표·가이던스 소식`, ctx: { ticker: symbol } },
    // 2026-10-14 audit #22: the company's numbers continue into the theme and macro crossroads.
    { route: 'themes', label: '테마 시나리오', why: '이 회사가 속한 테마가 지금 어느 단계이고 거시와 어떤 방향인지', ctx: { anchor: 'theme-playbook' } },
    { route: 'macro', label: '거시 시나리오', why: '금리·경기 시나리오에서 이 실적 흐름이 수혜인지 부담인지' }
  ]);
  return read;
}
