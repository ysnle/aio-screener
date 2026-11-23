// v58.75 (owner 2026-10-24): an expert's reading of this company — the business lens (which numbers matter for this kind
// of business), standing against named theme peers with what to keep watching, the thesis conditions and the
// favourable/unfavourable situations. 재무 공시 draws them on the face (lensCard, peerStandingCard, thesisCard,
// situationCard); 종목 개요 reads one peer line (peerLine); the AI panel reads the same data (window._aioStockLensFor).
// Readings come from src/domain/fundamental/stock-lens.js. Loaded with the entity route (never the boot set).
import { shortDate } from '../../domain/content/date-labels.js';
import { setResearchHandoff } from '../../app/research-handoff.js';
import { el } from './dom.js';
import { kindFold } from './indicator-face.js';
import { signedText } from '../../domain/shared/number.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { parseFiscalHistory, debtBasisFor, debtCurrentFor, issuerSic } from './fiscal-read.js';
import { marketInterpretation, readMarketRegime } from '../../data/selectors/interpretation.js';
import { reconcileFiscalHistory, financialKind } from '../../domain/fundamental/fiscal-read.js';
import { parseQuarterHistory, buildQuarterRead } from '../../domain/fundamental/quarter-read.js';
import { buildTrailingYearRead, buildEarningsSchedule, buildMarginCashRead, buildThemePeers, buildRdRead, buildSurpriseRead, reverseDcfInputs, impliedGrowth, REVERSE_DCF_DEFAULTS } from '../../domain/fundamental/analysis-read.js';
import { lensIdFor, buildLensRead, buildPeerStrengths, peerBasisText, buildSituationRead, buildThesisFrame, buildWatchList, buildMarketLink, dailyBeta } from '../../domain/fundamental/stock-lens.js';
import { themeStagesFor, themeMarketOf } from '../../domain/scenarios/theme-stage.js';
import { themeProfile } from '../../domain/scenarios/exposures.js';
import { themeCatalogFor, stockThemes } from '../../domain/entity/primary-theme.js';
import { buildCloseSeries } from '../../domain/market/session/close-series.js';
import { MARKET_WINDOWS, closeChange } from '../../domain/market/session/market-windows.js';
import { sharedArtifactState } from '../../data/shared-artifacts.js';
import { hasLeadingIsoDay } from '../../domain/shared/session-date.js';

const CALENDAR_KEY = '_aioEarningsCalendarArtifact';
const consensusOf = (root, sym) => root?._aioConsensusEstimates?.rows?.[String(sym || '').toUpperCase()] || null;
const isoOf = (bar) => { const ms = Number(bar?.epochMs ?? bar?.time); return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : String(bar?.date || '').slice(0, 10); };

/** Every input the blocks read, from what the page already loaded (no fetch here). */
export function stockLensContext(root, symbol, { fundamentals = null, bars = null } = {}) {
  const sym = String(symbol || '').trim().toUpperCase();
  if (!sym) return null;
  // The issuer's SEC record seen on the page, kept for the AI reader (window._aioStockLensFor) and the memo template.
  if (fundamentals && root && String(fundamentals.symbol || sym).toUpperCase() === sym) (root.__aioLensFundamentals ||= {})[sym] = fundamentals;
  let rows = [];
  try { rows = root?._aioGetCanonicalScreenerRows?.() || []; } catch (_) { rows = []; }
  const row = rows.find((item) => item?.sym === sym) || null;
  const market = themeMarketOf(sym);
  const themes = themeCatalogFor(sym, { themeMap: root?.THEME_MAP, krThemeMap: root?.KR_THEME_MAP, rows });
  const fiscal = root?._aioSecFiscalHistory || null;
  const own = fundamentals && String(fundamentals.symbol || sym).toUpperCase() === sym ? fundamentals : null;
  const seriesFor = (s) => (fiscal?.[s] ? reconcileFiscalHistory(parseFiscalHistory(fiscal[s]), s === sym ? own : null, s) : null);
  const history = seriesFor(sym) || [];
  const quarters = root?._aioSecQuarterHistory?.[sym] ? parseQuarterHistory(root._aioSecQuarterHistory[sym]) : [];
  const consensus = consensusOf(root, sym);
  const quartersFor = (s) => (root?._aioSecQuarterHistory?.[s] ? parseQuarterHistory(root._aioSecQuarterHistory[s]) : null);
  const peers = buildThemePeers({ symbol: sym, themes, rows, seriesFor, consensusFor: (s) => consensusOf(root, s), quartersFor });
  // The stock's themes, primary first, from the one owner the 가격 line and the theme link also read.
  const themeList = stockThemes(themes, sym).map(({ id, label }) => ({ id, label }));
  const themeIds = themeList.map((theme) => theme.id);
  const stages = themeStagesFor(root, { symbol: sym, themeIds });
  const stage = stages.find((item) => item.id === themeIds[0]) || stages[0] || null;
  // MERGED #2 (run-6): the page's one crossroads model (a tie stays a tie in the readings built from it).
  let crossroads = null;
  try { crossroads = marketInterpretation(root).crossroads; } catch (_) { crossroads = null; }
  let regime = null;
  try { regime = readMarketRegime(root); } catch (_) { regime = null; }
  const spx = buildCloseSeries(root?._aioHistory || [], 'spx');
  const barsIn = (Array.isArray(bars) && bars.length ? bars : root?._aioEntitySummaries?.[sym]?.history || []).map((bar) => ({ date: isoOf(bar), close: bar?.close }));
  const beta = market === 'US' ? dailyBeta(barsIn, spx) : null;
  // v58.80 run-5 (skeptic #11): the stock's 3-month return is an adjusted close (dividends in), so its benchmark is SPY's
  // adjusted return from the same factor session — the basis the 지수 대비 card above already uses (F10). Without that row
  // the S&P 500 index window (MARKET_WINDOWS.quarter) stands in and is named as the index.
  const spyRow = market === 'US' && sym !== 'SPY' ? rows.find((item) => item?.sym === 'SPY' && item.factorSessionDate && item.factorSessionDate === row?.factorSessionDate && readRowNumber(item, 'ret3m', 'display') != null) : null;
  // v59.56 (screen review): a Korean stock is read against its own index, as the 지수 대비 card above it is (코스피, or 코스닥 for .KQ).
  const krIndex = /\.KQ$/i.test(sym) ? ['kosdaq', '코스닥 지수'] : ['kospi', '코스피 지수'];
  const benchmark = market !== 'US' ? { pct: closeChange(root?._aioHistory || [], krIndex[0], MARKET_WINDOWS.quarter)?.pct ?? null, label: krIndex[1] }
    : spyRow ? { pct: readRowNumber(spyRow, 'ret3m', 'display'), label: 'S&P 500(SPY, 배당 포함)' } : { pct: closeChange(root?._aioHistory || [], 'spx', MARKET_WINDOWS.quarter)?.pct ?? null, label: 'S&P 500 지수' };
  const sicCode = issuerSic(root, sym);
  const lens = lensIdFor({ sic: sicCode, themeIds, sector: row?.sector || null });
  const trailing = buildTrailingYearRead(quarters);
  const quarterRead = quarters.length >= 2 ? buildQuarterRead(quarters, { symbol: sym }) : null;
  const debtBasis = debtBasisFor(root, sym);
  const marginCash = history.length ? buildMarginCashRead(history, { debtBasis, debtCurrent: debtCurrentFor(root, sym) }) : null;
  const schedule = market === 'US' ? buildEarningsSchedule({ symbol: sym, calendar: root?.[CALENDAR_KEY], consensus, calendarState: sharedArtifactState(root, CALENDAR_KEY) }) : null;
  const levels = typeof root?._aioPriceLevelsFor === 'function' ? root._aioPriceLevelsFor(sym) : null;
  const financial = financialKind(sym, row?.sector, sicCode);
  const close = Number(row?._valuationPrice ?? row?.valuationPrice) > 0 && hasLeadingIsoDay(String(row?.factorSessionDate || '')) ? { value: Number(row._valuationPrice ?? row.valuationPrice), date: String(row.factorSessionDate).slice(0, 10), shares: Number(row?._valuationSharesOutstanding) > 0 ? Number(row._valuationSharesOutstanding) : null, sharesObservedAt: row?._valuationSharesObservedAt || null } : null;
  const inputs = history.length ? reverseDcfInputs({ history, fundamentals: own, close, financial }) : null;
  const implied = inputs?.state === 'ready' ? impliedGrowth({ fcf: inputs.fcf, marketValue: inputs.marketValue, discountRate: REVERSE_DCF_DEFAULTS.discountRate, terminalGrowth: REVERSE_DCF_DEFAULTS.terminalGrowth }) : inputs ? { state: inputs.state } : null;
  const strengths = peers ? buildPeerStrengths(peers.rows) : null;
  const pe = strengths?.facts?.find((fact) => fact.id === 'fwdPe');
  const situation = buildSituationRead({ themes: themeList, market, crossroads, beta });
  const tags = themeIds.flatMap((id) => themeProfile(market, id)?.tags || []);
  return {
    sym, market, row, history, peers, strengths, stage, themeList, situation, schedule, levels, consensus, trailing,
    lensRead: history.length ? buildLensRead({ lens, history, trailing, quarterRead, marginCash, debtBasis, rd: buildRdRead(history), consensus, surprise: buildSurpriseRead(consensus, { quarters }) }) : null,
    thesis: history.length ? buildThesisFrame({ implied, trailing, marginCash, consensus, schedule, levels, peerPe: pe ? { value: pe.value, median: pe.median } : null, situation }) : null,
    watch: buildWatchList({ schedule, consensus, trailing, row, stage, levels, benchmarkRet3m: benchmark.pct, benchmarkLabel: benchmark.label, currency: market === 'US' ? 'USD' : 'KRW' }),
    link: buildMarketLink({ regime, crossroads, stage, themeLabel: themeList[0]?.label || null, tags })
  };
}

/** window._aioStockLensFor(sym): the same readings as plain data for the AI panel (null without a symbol). */
export function installStockLensGlobal(root) {
  if (!root || typeof root._aioStockLensFor === 'function') return;
  root._aioStockLensFor = (symbol) => {
    const sym = String(symbol || root?._currentTickerId || '').trim().toUpperCase();
    if (!sym) return null;
    const ctx = stockLensContext(root, sym, { fundamentals: root.__aioLensFundamentals?.[sym] || null });
    if (!ctx) return null;
    return {
      symbol: sym, marketLink: ctx.link?.text || null,
      lens: ctx.lensRead ? { name: ctx.lensRead.label, basis: ctx.lensRead.basis, metrics: ctx.lensRead.rows.map((row) => ({ metric: row.label, value: row.value || '미확인', trend: row.trend, why: row.why })) } : null,
      strengths: ctx.strengths?.strengths.map((fact) => fact.text) || [], weaknesses: ctx.strengths?.weaknesses.map((fact) => fact.text) || [],
      peers: ctx.peers ? { theme: ctx.peers.themeName, symbols: ctx.peers.rows.slice(1).map((row) => row.sym), basis: peerBasisText(ctx.peers.basis) } : null,
      situation: ctx.situation ? { favour: ctx.situation.favour, burden: ctx.situation.burden, now: ctx.situation.now, beta: ctx.situation.beta?.value ?? null } : null,
      thesis: ctx.thesis ? { priced: ctx.thesis.priced, conditions: ctx.thesis.conditions, checks: ctx.thesis.checks, breaks: ctx.thesis.breaks, paths: ctx.thesis.paths } : null,
      watch: ctx.watch.map((item) => `${item.label}: ${item.now}`),
      note: '사실·조건·충족 개수이며 매수·매도·가격·비중 판단이 아님'
    };
  };
}

// ── Drawing (재무 공시 face; 종목 개요 reads peerLine only) ─────────────────────────────────────────────────────────────
function cardHead(doc, title, meta) {
  const head = el(doc, 'div', null, 'sx-card__head');
  head.append(el(doc, 'h3', title, 'sx-card__title'));
  if (meta) head.append(el(doc, 'span', meta, 'sx-card__meta'));
  return head;
}
const list = (doc, items) => { const ul = el(doc, 'ul', null, 'v2-lens-list'); for (const text of items) ul.append(el(doc, 'li', text)); return ul; };
const block = (doc, title, items, tone = '') => {
  const box = el(doc, 'div', null, `v2-thesis-block${tone ? ` is-${tone}` : ''}`);
  box.append(el(doc, 'p', title, 'v2-thesis-block__title'), list(doc, items));
  return box;
};
const methodText = (doc, text) => el(doc, 'p', text, 'ind-method__text');

/** The memo template the thesis seeds (the reader writes their own conditions under it). */
export function thesisTemplate(ctx) {
  const t = ctx?.thesis;
  if (!t) return '';
  return [`내 논지(${ctx.sym}):`, t.priced ? `가격이 가정하는 것 — ${t.priced}` : null, ...t.conditions.map((c) => `맞으려면 — ${c}`), ...t.breaks.slice(0, 3).map((b) => `깨짐 신호 — ${b}`)].filter(Boolean).join('\n');
}
// The memo is 종목 개요's 내 메모 section: hand the template over and open the company (entity.js consumes it once).
function openThesisMemo(root, symbol, template) {
  setResearchHandoff({ root, routeId: 'ticker', context: { symbol, memoTemplate: template } });
  if (typeof root?.showTicker === 'function') root.showTicker(symbol);
}

/** Which numbers matter for this kind of business, this company's value and direction for each. */
export function lensCard(doc, read) {
  if (!read) return null;
  const card = el(doc, 'section', null, 'sx-card v2-analysis-card v2-stock-lens');
  card.dataset.analysis = 'lens';
  card.append(cardHead(doc, `사업 종류별 핵심 지표, ${read.label}`, `${read.rows.length}개 중 ${read.known}개 확인`));
  card.append(el(doc, 'p', read.why, 'v2-analysis-lede'));
  const region = el(doc, 'div', null, 'fiscal-table-scroll');
  region.tabIndex = 0;
  region.setAttribute('role', 'region');
  region.setAttribute('aria-label', '핵심 지표표, 가로 스크롤');
  const table = el(doc, 'table', null, 'fiscal-amount-table');
  table.append(el(doc, 'caption', '지표, 이 기업의 값과 방향, 미확인은 공시 수집본에 없는 항목'));
  const head = el(doc, 'thead'); const hr = el(doc, 'tr');
  for (const label of ['지표', '이 기업', '방향', '보는 이유']) { const th = el(doc, 'th', label); th.scope = 'col'; hr.append(th); }
  head.append(hr); table.append(head);
  const body = el(doc, 'tbody');
  for (const row of read.rows) {
    const tr = el(doc, 'tr');
    const th = el(doc, 'th', row.label); th.scope = 'row';
    tr.append(th, el(doc, 'td', row.value || '미확인', row.value ? null : 'is-muted'), el(doc, 'td', row.trend || '—'), el(doc, 'td', row.value ? row.why : `${row.why} 확인처: ${row.check}`));
    body.append(tr);
  }
  table.append(body); region.append(table); card.append(region);
  card.append(kindFold(doc, 'method', '지표를 고른 기준', [methodText(doc, `분류 기준: ${read.basis}. 업종마다 정상 수준이 달라, 값은 같은 업종 안에서 비교합니다.`)]));
  return card;
}

// The rank figure: every metric that has peers, this company's place from 1위 (left) to last (right).
const SVG_NS = 'http://www.w3.org/2000/svg';
function rankChart(doc, facts) {
  const rowH = 26;
  const svg = doc.createElementNS ? doc.createElementNS(SVG_NS, 'svg') : doc.createElement('svg');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', String(facts.length * rowH));
  svg.setAttribute('class', 'v2-peer-rank__svg');
  svg.setAttribute('aria-hidden', 'true');
  const node = (tag, attrs) => { const item = doc.createElementNS ? doc.createElementNS(SVG_NS, tag) : doc.createElement(tag); for (const [key, value] of Object.entries(attrs)) item.setAttribute(key, String(value)); return item; };
  facts.forEach((fact, index) => {
    const y = index * rowH + rowH / 2;
    const x = 2 + Math.min(1, Math.max(0, fact.side)) * 96; // side 0 = 1위 (left), 1 = last (right), 2% inset each end
    svg.append(node('line', { x1: '2%', x2: '98%', y1: y, y2: y, class: 'v2-peer-rank__track' }));
    svg.append(node('circle', { cx: `${x.toFixed(1)}%`, cy: y, r: 5, class: `v2-peer-rank__dot is-${fact.vsMedian > 0 ? 'favorable' : fact.vsMedian < 0 ? 'burden' : 'neutral'}` }));
  });
  return svg;
}
// The watch items that belong to this screen: the price-level and relative-strength items live on 기술적 분석.
const FUNDAMENTAL_WATCH = new Set(['earnings', 'revisions', 'margin', 'theme']);
const watchOf = (ctx) => (ctx?.watch || []).filter((item) => FUNDAMENTAL_WATCH.has(item.id));

/** Where the company stands against named theme peers, the strength and weakness lines and what to keep watching. */
export function peerStandingCard(doc, ctx) {
  const s = ctx?.strengths;
  const watch = watchOf(ctx);
  if (!s?.facts?.length && !watch.length) return null;
  const card = el(doc, 'section', null, 'sx-card v2-analysis-card v2-peer-strengths');
  card.dataset.analysis = 'peer-standing';
  card.append(cardHead(doc, '동종 기업 안의 위치', s?.facts?.length ? `${ctx.peers.themeName}, 이 회사 포함 ${s.peers + 1}곳` : '비교할 동종 공시 부족'));
  if (s?.facts?.length) {
    const chart = el(doc, 'div', null, 'v2-peer-rank');
    chart.dataset.sectionVisual = 'peer-rank';
    chart.setAttribute('role', 'img');
    chart.setAttribute('aria-label', `동종 안 순위, ${s.facts.map((fact) => `${fact.label} ${fact.n}곳 중 ${fact.tied ? '공동 ' : ''}${fact.rank}위`).join(', ')}`);
    const labels = el(doc, 'div', null, 'v2-peer-rank__labels');
    const values = el(doc, 'div', null, 'v2-peer-rank__values');
    for (const fact of s.facts) {
      labels.append(el(doc, 'span', fact.label, 'v2-peer-rank__label'));
      values.append(el(doc, 'span', `${fact.valueText}, ${fact.tied ? '공동 ' : ''}${fact.rank}/${fact.n}`, 'v2-peer-rank__value'));
    }
    const plot = el(doc, 'div', null, 'v2-peer-rank__plot');
    plot.append(rankChart(doc, s.facts));
    const axis = el(doc, 'span', null, 'v2-peer-rank__axis');
    axis.append(el(doc, 'span', '1위'), el(doc, 'span', '마지막'));
    chart.append(labels, plot, values, axis);
    card.append(chart);
    const line = (label, fact, tone) => { const p = el(doc, 'p', null, `v2-peer-line is-${tone}`); p.append(el(doc, 'b', label), doc.createTextNode(` ${fact.text}`)); return p; };
    for (const fact of s.strengths) card.append(line('강한 점', fact, 'favorable'));
    for (const fact of s.weaknesses) card.append(line('약한 점', fact, 'burden'));
  }
  if (watch.length) {
    const box = el(doc, 'div', null, 'v2-thesis-block');
    box.append(el(doc, 'p', `계속 볼 것 ${watch.length}가지`, 'v2-thesis-block__title'), list(doc, watch.map((item) => `${item.label}: ${item.now}`)));
    card.append(box);
  }
  if (s?.facts?.length) {
    card.append(kindFold(doc, 'method', '동종 구성과 비교 기준', [
      methodText(doc, `${ctx.peers.themeName}의 같은 하위 테마 기업부터 테마 대표 기업까지 SEC 연간 공시가 있는 ${s.peers}곳: ${ctx.peers.rows.slice(1).map((row) => row.sym).join(', ')}.`),
      methodText(doc, '각 지표에서 동종 안 순위와 동종 중앙값을 적었습니다. 강한 점·약한 점은 중앙값보다 앞·뒤인 지표 중 차이가 큰 순서이며, 등급이나 매수 판단이 아닙니다. Forward PER은 낮을수록 이익 대비 가격 부담이 가벼운 쪽입니다.'),
      methodText(doc, peerBasisText(ctx.peers.basis)),
      methodText(doc, '회계연도 마감 시점이 회사마다 다르고, 테마는 AIO의 투자 분류라 사업 구성이 같지 않습니다.'),
      ...watch.map((item) => methodText(doc, `${item.label}: ${item.why}`))
    ]));
  }
  return card;
}

/** 종목 개요's one peer line: the strongest and the weakest standing, or null without a peer group. */
export function peerLine(ctx) {
  const s = ctx?.strengths;
  if (!s?.facts?.length || (!s.strengths.length && !s.weaknesses.length)) return null;
  return { theme: ctx.peers.themeName, count: s.peers + 1, strength: s.strengths[0]?.text || null, weakness: s.weaknesses[0]?.text || null };
}

/** The thesis conditions: what the price assumes, what must hold, when it is checked and what would break it. */
export function thesisCard(doc, root, ctx) {
  const t = ctx?.thesis;
  if (!t) return null;
  const card = el(doc, 'section', null, 'sx-card v2-analysis-card v2-thesis');
  card.dataset.analysis = 'thesis';
  card.append(cardHead(doc, '투자 논지 조건', '앱의 결론 아님'));
  if (t.priced) card.append(el(doc, 'p', t.priced, 'v2-analysis-lede'));
  if (t.impliedPct != null && t.ttm != null) {
    const bars = el(doc, 'div', null, 'v2-thesis-bars');
    const top = Math.max(Math.abs(t.impliedPct), Math.abs(t.ttm), 1);
    for (const [label, value] of [['가격이 가정한 성장(연)', t.impliedPct], ['최근 4개 분기 매출 성장', t.ttm]]) {
      const line = el(doc, 'div', null, 'stock-read-bars');
      line.append(el(doc, 'span', label, 'stock-read-bar-label'));
      const item = el(doc, 'div', null, 'stock-read-bar-row');
      const track = el(doc, 'div', null, 'stock-read-track');
      const fill = el(doc, 'div', null, `stock-read-bar is-${value < 0 ? 'burden' : 'neutral'}`);
      fill.style.width = `${Math.max(2, Math.abs(value) / top * 100).toFixed(1)}%`;
      track.append(fill);
      item.append(track, el(doc, 'span', signedText(value, 1, '%'), 'stock-read-bar-value'));
      line.append(item); bars.append(line);
    }
    card.append(bars);
  }
  const grid = el(doc, 'div', null, 'v2-thesis-grid');
  if (t.conditions.length) grid.append(block(doc, `맞으려면 ${t.conditions.length}가지`, t.conditions));
  if (t.checks.length) grid.append(block(doc, '확인 일정', t.checks));
  if (t.breaks.length) grid.append(block(doc, '틀렸다는 신호', t.breaks, 'burden'));
  card.append(grid);
  if (t.paths.length) {
    const paths = el(doc, 'div', null, 'v2-thesis-grid is-pair');
    for (const path of t.paths) paths.append(block(doc, path.label, [`성립 — ${path.holds}`, `깨짐 — ${path.fails}`]));
    card.append(paths);
  }
  const save = el(doc, 'button', '이 조건으로 내 메모 시작', 'aio-btn-table');
  save.type = 'button';
  save.addEventListener('click', () => openThesisMemo(root, ctx.sym, thesisTemplate(ctx)));
  card.append(save);
  return card;
}

/** The macro environments that favour or burden the company's themes, and where the market is now. */
export function situationCard(doc, ctx) {
  const s = ctx?.situation;
  if (!s || (!s.favour.length && !s.burden.length)) return null;
  const card = el(doc, 'section', null, 'sx-card v2-analysis-card v2-situation');
  card.dataset.analysis = 'situation';
  card.append(cardHead(doc, '유리한 환경과 불리한 환경', s.themes.map((theme) => theme.label).join(', ')));
  if (s.now) {
    // The scenario fit is a market reading with its own close date, not the stock's.
    const lede = el(doc, 'p', s.now, 'v2-analysis-lede');
    if (s.asOf) lede.append(el(doc, 'span', ` (${shortDate(s.asOf)} 관측 기준)`, 'sx-meta'));
    card.append(lede);
  }
  const pair = el(doc, 'div', null, 'v2-thesis-grid is-pair');
  const leadFirst = (items) => (s.lead?.title && items.includes(s.lead.title) ? [s.lead.title, ...items.filter((item) => item !== s.lead.title)] : items);
  if (s.favour.length) pair.append(block(doc, `유리 ${s.favour.length}`, leadFirst(s.favour), 'favorable'));
  if (s.burden.length) pair.append(block(doc, `불리 ${s.burden.length}`, leadFirst(s.burden), 'burden'));
  card.append(pair);
  if (s.beta) card.append(el(doc, 'p', `시장 대비 민감도(베타) ${s.beta.value.toFixed(2)}, 최근 ${s.beta.sessions}거래일`, 'sx-meta'));
  card.append(kindFold(doc, 'method', '노출과 테마 논지', [
    methodText(doc, `노출: ${s.tags.join(', ')}. 이 노출이 각 시나리오에서 순풍인지 역풍인지로 나눴습니다.`),
    ...s.themes.map((theme) => methodText(doc, `${theme.label} 논지: ${theme.thesis}. 깨지는 조건: ${theme.breaks.join(', ')}.`)),
    s.beta ? methodText(doc, '베타는 일간 수익률을 S&P 500과 비교한 값으로, 1보다 크면 시장이 움직일 때 더 크게 움직였다는 뜻입니다.') : null
  ]));
  return card;
}
