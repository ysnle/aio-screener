// P1438: 포트폴리오's lead block — value share by trend state (one stacked bar), sector weights coloured
// by rotation quadrant, and the reading that ties the book to the market.
import { buildPortfolioRead } from '../../domain/portfolio/portfolio-read.js';
import { readMarketRegime } from './market-regime.js';
import { renderNextSteps } from './page-flow.js';
import { benchmarkRowFor, indexReturns } from '../../domain/market/benchmarks.js';
import { currentRotationItems } from '../../domain/themes/produced-rotation.js';
import { buildCloseSeries, koreaMoveRecord } from '../../domain/briefing/market-read.js';
import { el } from './dom.js';
import { loadJsonArtifact, stableFetcher } from '../../data/artifact-cache.js';
import { estimateBookSensitivities, bookWeights, STRESS_MIN_WEEKS } from '../../domain/portfolio/stress-sensitivity.js';
import { bondCushion, assetClassOf, BOND_ETF_MAP, BOND_KIND_LABEL } from '../../domain/portfolio/asset-class.js';
import { signedText } from '../../domain/shared/number.js';
import { lookThrough, lookThroughSentence, SP500_TRACKERS } from '../../domain/portfolio/look-through.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { BRANCHES } from '../../domain/market/macro-crossroads.js';
import { scenarioLead } from '../../domain/market/scenario-lead.js';
import { US_THEME_PROFILES, windFor } from '../../domain/scenarios/exposures.js';

// P1466: the 3-month gap to the blended index split into sector, stock selection, FX and cash —
// bars on one scale, the total underneath, then what the arithmetic does not claim.
function attributionBox(doc, attribution) {
  const box = el(doc, 'div', null, 'pf-attribution');
  box.append(el(doc, 'span', `지수 대비 차이의 원인, ${attribution.window}`, 'stock-read-vis-title'));
  const max = Math.max(0.5, ...attribution.excess.map((part) => Math.abs(part.pct)));
  for (const part of attribution.excess) {
    const line = el(doc, 'div', null, 'scr-ic-row');
    const track = el(doc, 'div', null, 'scr-ic-track');
    const fill = el(doc, 'span', null, `scr-ic-fill ${part.pct >= 0 ? 'is-up' : 'is-down'}`);
    fill.style.width = `${Math.min(50, Math.abs(part.pct) / max * 50).toFixed(1)}%`;
    fill.style[part.pct >= 0 ? 'left' : 'right'] = '50%';
    track.append(fill);
    line.append(el(doc, 'span', part.label, 'scr-ic-label'), track, el(doc, 'span', `${signedText(part.pct, 1)}%p`, 'scr-ic-value'));
    box.append(line);
  }
  const sign = (value) => `${signedText(value, 1)}`;
  box.append(el(doc, 'p', `합계 ${sign(attribution.excessPct)}%p = 지금 구성의 3개월 수익률 ${sign(attribution.totalPct)}% − ${attribution.blendedLabel} ${sign(attribution.blendedPct)}%`, 'theme-strength-basis'));
  const notes = [];
  if (attribution.sectorMappedPct < 100) notes.push(`섹터 효과는 미국 섹터 ETF가 대응되는 보유액 ${attribution.sectorMappedPct.toFixed(0)}%에서만 분리(나머지는 종목 선택에 포함)`);
  // v59.45 (P3-PF-01): a sector ETF whose close date differs from the stock's is not compared over another window.
  if (attribution.sectorBasisHeld?.length) notes.push(`섹터 ETF 종가 기준일이 종목과 다른 ${attribution.sectorBasisHeld.length}종목은 섹터 효과를 나누지 않음`);
  if (!attribution.cashDeclared) notes.push('현금을 입력하지 않아 주식 부분만 계산(현금 효과 0)');
  else if (attribution.cashSharePct > 0) notes.push(`현금 ${attribution.cashSharePct.toFixed(0)}% — 지수에 투자됐다면 얻었을 수익률만큼이 현금 효과`);
  const mismatched = (attribution.skipped || []).filter((item) => item.reason === 'basis-mismatch');
  if (mismatched.length) notes.push(`종가 기준일이 비교 지수와 다르거나 확인되지 않는 ${mismatched.length}종목은 제외`);
  const md = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
  const fxHeld = (attribution.skipped || []).filter((item) => item.reason === 'fx-basis-mismatch');
  if (fxHeld.length) notes.push(`원/달러 종가(${fxHeld[0].fxBasis ? md(fxHeld[0].fxBasis) : '날짜 미확인'})가 종목 종가 기준일과 달라 환율 효과를 계산하지 않은 ${fxHeld.length}종목은 제외`);
  if (attribution.fxHoldingsPct > 0) notes.push(`환율 효과는 기준 통화로 환산한 보유액 ${attribution.fxHoldingsPct.toFixed(0)}%의 원/달러 3개월 변동${attribution.fxAsOf ? `(${md(attribution.fxAsOf)} 종가까지)` : ''}`);
  notes.push('지금 비중을 3개월 동안 들고 있었다고 가정한 계산이라 실제 계좌 성과와 다릅니다');
  box.append(el(doc, 'p', `${notes.join(', ')}.`, 'theme-strength-basis'));
  return box;
}

// v58.75 (persona review): the holdings read against the branch whose conditions fit best now. Each holding takes the
// exposure tags of its US themes (THEME_MAP membership) or, failing that, of the theme its sector maps to; bond ETFs and
// broad ETFs carry no tag. The value share on each side of that branch (scenarios/exposures.js windFor) is one bar.
// The tags are reviewed hypotheses, not measured sensitivities, and the bar is not a probability or an instruction.
const SECTOR_PROFILE = Object.freeze({ Technology: 'software', 'Communication Services': 'comm', Consumer: 'consumer_disc', Healthcare: 'healthcare', 'Consumer Defensive': 'staples',
  Financials: 'financials', Energy: 'energy', Industrials: 'industrials', Utilities: 'utilities', Materials: 'materials', 'Real Estate': 'reits' });
const WIND_TONE = Object.freeze({ head: 'down', mixed: 'pullback', tail: 'up' });

export function scenarioExposure({ rows = [], branch = null, themeMap = [] } = {}) {
  if (!branch) return { available: false };
  const valued = rows.filter((row) => Number(row?.value) > 0);
  const total = valued.reduce((sum, row) => sum + Number(row.value), 0);
  if (!(total > 0)) return { available: false };
  const tagsOf = (row) => {
    const symbol = String(row.symbol || '').toUpperCase();
    if (assetClassOf(symbol)) return [];
    const themes = themeMap.filter((theme) => (Array.isArray(theme?.leaders) && theme.leaders.includes(symbol)) || (theme?.subThemes || []).some((sub) => Array.isArray(sub.tickers) && sub.tickers.includes(symbol)));
    const ids = themes.length ? themes.map((theme) => theme.id) : [SECTOR_PROFILE[row.sector]].filter(Boolean);
    return [...new Set(ids.flatMap((id) => US_THEME_PROFILES[id]?.tags || []))];
  };
  const share = { head: 0, mixed: 0, tail: 0, none: 0 };
  for (const row of valued) share[windFor(tagsOf(row), branch)] += Number(row.value) / total * 100;
  return { available: true, holdings: valued.length, share };
}

// v59.51 (area H, one scenario source): the exposure against the branch whose conditions fit best now — or, in a tie, one
// exposure per tied branch — read through scenarioLead (shared by the read fold and the 점검 기준 list). A tie is never
// shown as one lead. Returns null while the scenario model is held.
export function leadScenarioExposures(root, surface) {
  let crossroads = null;
  try { crossroads = marketInterpretation(root).crossroads || null; } catch (_) { crossroads = null; }
  const lead = scenarioLead(crossroads);
  if (lead.state !== 'lead' && lead.state !== 'tie') return null;
  const themeMap = Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : [];
  const items = lead.items.map((item) => {
    const model = scenarioExposure({ rows: surface?.rows || [], branch: BRANCHES.find((branch) => branch.id === item.id) || null, themeMap });
    return model.available ? { ...model, name: String(item.title || '').split(' — ')[0], fit: item.fit } : null;
  }).filter(Boolean);
  return items.length ? { state: lead.state, face: lead.face, items } : null;
}

function scenarioExposureBox(doc, model) {
  const box = el(doc, 'div', null, 'pf-trend-mix pf-scenario-exposure');
  box.append(el(doc, 'span', `가설 태그로 본 시나리오 노출, '${model.name}'(${model.fit})`, 'stock-read-vis-title'));
  const bar = el(doc, 'div', null, 'pf-trend-bar');
  bar.setAttribute('role', 'img');
  bar.setAttribute('aria-label', `평가액 중 부담 쪽 ${model.share.head.toFixed(0)}%, 혼재 ${model.share.mixed.toFixed(0)}%, 수혜 쪽 ${model.share.tail.toFixed(0)}%, 태그 없음 ${model.share.none.toFixed(0)}%`);
  const legend = el(doc, 'div', null, 'pf-trend-legend');
  for (const [wind, label] of [['head', '부담 쪽'], ['mixed', '혼재'], ['tail', '수혜 쪽'], ['none', '태그 없음·영향 작음']]) {
    const pct = model.share[wind];
    if (pct > 0) {
      const seg = el(doc, 'span', pct >= 12 ? `${pct.toFixed(0)}%` : '', `pf-trend-seg${WIND_TONE[wind] ? ` is-${WIND_TONE[wind]}` : ''}`);
      seg.style.width = `${pct.toFixed(1)}%`;
      if (!WIND_TONE[wind]) { seg.style.background = 'rgba(var(--ink-rgb),0.22)'; seg.style.color = 'var(--text-primary)'; }
      seg.title = `${label} ${pct.toFixed(1)}%`;
      bar.append(seg);
    }
    legend.append(el(doc, 'span', `${label} ${pct.toFixed(0)}%`, WIND_TONE[wind] ? `is-${WIND_TONE[wind]}` : null));
  }
  box.append(bar, legend, el(doc, 'p', `업종·테마의 가설 태그로 보면 평가액의 ${model.share.head.toFixed(0)}%가 부담 쪽, ${model.share.tail.toFixed(0)}%가 수혜 쪽 영역입니다.`, 'theme-strength-basis'));
  return box;
}

function scenarioExposureBoxes(doc, root, surface) {
  const lead = leadScenarioExposures(root, surface);
  if (!lead) return [];
  const note = el(doc, 'p', `${lead.face} 태그는 사람이 정한 민감도 가설이라 측정값이 아니며, 조건 충족 수는 시나리오가 일어날 확률이 아닙니다. 채권·광범위 ETF와 분류되지 않은 종목은 태그 없음으로 둡니다.`, 'theme-strength-basis');
  return [...lead.items.map((model) => scenarioExposureBox(doc, model)), note];
}

export function renderPortfolioRead({ documentRef: doc, root, surface }) {
  const host = doc?.getElementById('pf-read');
  if (!host) return null;
  host.dataset.aioPortfolioReadRenderer = 'native';
  let rows = [];
  try { rows = typeof root?._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() || [] : []; } catch (_) { rows = []; }
  // v57.81: holdings outside the screener universe read with their on-demand rows (same normalization, own date).
  if (Array.isArray(root?._aioPortfolioOnDemandRows) && root._aioPortfolioOnDemandRows.length) rows = [...rows, ...root._aioPortfolioOnDemandRows];
  const history = root?._aioHistory || [];
  const spy = rows.find((row) => row?.sym === 'SPY') || null;
  // P1466: US holdings are measured against SPY's adjusted return (dividends included, the same basis
  // as the stocks' and sector ETFs' returns); KRX holdings against the KOSPI/KOSDAQ price index.
  const marketReturnFor = (symbol) => {
    const bench = benchmarkRowFor(symbol, history);
    if (bench.market === 'US' && spy?.ret3m != null && spy.ret3m !== '' && Number.isFinite(Number(spy.ret3m))) {
      // E02: null is missing, not 0% return. X01 (2026-10-13): this return once sat inside the comment, so SPY was never used.
      return { ret3m: Number(spy.ret3m), label: 'S&P 500(SPY, 배당 포함)', asOf: spy.factorSessionDate || null };
    }
    return bench;
  };
  // #22: the USD/KRW 3-month return ends on the series' last close; that date travels with it so a holding whose
  // close is on another day has its FX effect held instead of mixing two windows.
  const usdkrwAsOf = buildCloseSeries(history, 'usdkrw').at(-1)?.date || null;
  const read = buildPortfolioRead({ surface, rows, benchmarkFor: (symbol) => benchmarkRowFor(symbol, history), marketReturnFor, usdkrwReturnPct: indexReturns(history, 'usdkrw').ret3m, usdkrwAsOf, rotation: currentRotationItems(root?._serverDataMeta?.rotationHistory, Date.now()), krRecord: koreaMoveRecord(history, { now: Date.now() }), regime: readMarketRegime(root, () => renderPortfolioRead({ documentRef: doc, root, surface: root?._aioPortfolioSurface || surface })) });
  const next = doc.getElementById('pf-next');
  if (!read.available) {
    // P1449: a hold is not an absence — the reason (currency mix without declared rates) is
    // user-facing content, printed here instead of silently removing the section.
    // Audit 2026-10-14: with no holdings the table's own empty state is the one message; this section stays hidden.
    host.hidden = read.empty === true;
    host.replaceChildren(el(doc, 'h2', '내 포트폴리오와 시장', 'briefing-h2'), el(doc, 'p', read.reason, 'daily-empty'));
    renderNextSteps(doc, next, []);
    return read;
  }
  host.hidden = false;
  host.replaceChildren(el(doc, 'h2', '내 포트폴리오와 시장', 'briefing-h2'));
  if (read.excluded) host.querySelector('h2').append(el(doc, 'span', `스크리너 기록이 없는 ${read.excluded}종목 제외${read.total > 0 && read.excludedValue != null ? ` — 제외 보유액은 평가액의 ${(read.excludedValue / read.total * 100).toFixed(0)}%` : ''}`, 'briefing-h2-note'));
  if (read.headline) host.append(el(doc, 'p', read.headline, 'briefing-read-headline'));
  // v59.51 (two layers): the face is the lead and one visual (value share by trend state). The sector/rotation bars, the
  // 3-month attribution, the scenario exposure and the four analysis points move into one closed expert fold.
  const visuals = el(doc, 'div', null, 'stock-read-visuals');
  const detail = el(doc, 'div', null, 'stock-read-visuals');
  if (read.trendMix.length) {
    const box = el(doc, 'div', null, 'pf-trend-mix');
    box.append(el(doc, 'span', '평가액 기준 추세 상태', 'stock-read-vis-title'));
    const bar = el(doc, 'div', null, 'pf-trend-bar');
    for (const row of read.trendMix.filter((item) => item.pct > 0)) {
      const seg = el(doc, 'span', row.pct >= 12 ? `${row.pct.toFixed(0)}%` : '', `pf-trend-seg is-${row.state}`);
      seg.style.width = `${row.pct.toFixed(1)}%`;
      seg.title = `${row.label} ${row.pct.toFixed(1)}%`;
      bar.append(seg);
    }
    const legend = el(doc, 'div', null, 'pf-trend-legend');
    for (const row of read.trendMix) legend.append(el(doc, 'span', `${row.label} ${row.pct.toFixed(0)}%`, `is-${row.state}`));
    box.append(bar, legend);
    visuals.append(box);
  }
  if (read.sectorMix.length) {
    const box = el(doc, 'div', null, 'pf-sector-mix');
    // v57.50 C24: the same denominator as the 비중 · 섹터 배분 bars, named on the title.
    box.append(el(doc, 'span', `섹터 비중(${read.sectorMix[0].basis === 'stock-part' ? '주식 부분 중' : '현금 포함 총자산 대비'}), 섹터 회전 단계`, 'stock-read-vis-title'));
    for (const row of read.sectorMix.slice(0, 6)) {
      const line = el(doc, 'div', null, 'stock-read-bars');
      line.append(el(doc, 'span', row.label, 'stock-read-bar-label'));
      const item = el(doc, 'div', null, 'stock-read-bar-row');
      const bar = el(doc, 'div', null, `stock-read-bar pf-sector-bar is-${row.quadrant?.tone || 'unknown'}`);
      bar.style.width = `${Math.max(2, row.pct).toFixed(1)}%`;
      item.append(bar, el(doc, 'span', `${row.pct.toFixed(0)}%${row.quadrant ? `, ${row.quadrant.label}` : ''}`, 'stock-read-bar-value'));
      line.append(item);
      box.append(line);
    }
    detail.append(box);
  }
  if (read.attribution?.available) detail.append(attributionBox(doc, read.attribution));
  detail.append(...scenarioExposureBoxes(doc, root, surface));
  if (visuals.childNodes.length) host.append(visuals);
  const list = el(doc, 'ul', null, 'stock-read-points');
  for (const point of read.points) {
    const li = el(doc, 'li', null, `stock-read-point is-${point.tone}`);
    li.append(el(doc, 'span', point.title, 'stock-read-point-title'), el(doc, 'span', point.text, 'stock-read-point-text'));
    list.append(li);
  }
  if (detail.childNodes.length || read.points.length) {
    const fold = el(doc, 'details', null, 'pf-read-detail');
    fold.dataset.userFold = '';
    fold.append(el(doc, 'summary', '자세히, 추세 기준 · 섹터 회전 · 지수 대비 원인 · 시나리오 노출'), list, detail);
    host.append(fold);
  }
  renderNextSteps(doc, next, read.next);
  return read;
}

// 개편 v2 (3g): 실질 종목 수 · 시장 민감도 β in the hero and the three 읽는 법 cards beside the holdings. Every figure comes
// from the stored holdings (surface rows in the base currency), the book's own weekly regression on its home index
// (stress-sensitivity.js, inputs handed over by the legacy stress panel) and the published S&P 500 weights
// (public-data/sp500-weights.json, IVV holdings). No holdings → nothing renders; a missing input says 없음.
const SECTOR_CONCENTRATION_BAND = 40; // the exposure panel's internal band (js/aio-workspace.js, >40% 섹터 집중)
let sp500Weights = null;
let sp500Requested = false;
function requestSp500Weights(root, onReady) {
  if (sp500Requested) return;
  sp500Requested = true;
  const fetchFn = root?.fetch || globalThis.fetch;
  if (typeof fetchFn !== 'function') return;
  loadJsonArtifact(stableFetcher(root || globalThis), './public-data/sp500-weights.json', { maxAgeMs: 6 * 60 * 60 * 1000, maxBytes: 512 * 1024 })
    .then((data) => { if (data && Array.isArray(data.rows)) { sp500Weights = data; onReady?.(); } })
    .catch(() => {});
}

export function portfolioLens({ surface, stressInput = null, history = [], sp500 = null, sectorLabel = (name) => name } = {}) {
  const rows = (Array.isArray(surface?.rows) ? surface.rows : []).filter((row) => Number(row?.value) > 0);
  const total = rows.reduce((sum, row) => sum + Number(row.value), 0);
  if (!rows.length || !(total > 0) || surface?.currencyState === 'mixed-without-conversion') return { available: false };
  // v59.45 (PASS23): two lots of one ticker are one holding — the effective number of holdings and the stress weights were
  // computed per lot (and Object.fromEntries kept only the last lot's weight).
  const weights = bookWeights(rows.map((row) => ({ symbol: row.symbol, value: row.value })));
  const effectiveN = 1 / weights.reduce((sum, item) => sum + item.w * item.w, 0);
  let beta = null;
  let betaNote = '보유 종목 가격 기록을 받으면 계산합니다';
  if (stressInput?.historyMap && Array.isArray(stressInput.commonDates)) {
    const book = Object.fromEntries(weights.map((item) => [item.symbol, item.w]));
    const est = estimateBookSensitivities({ historyMap: stressInput.historyMap, commonDates: stressInput.commonDates, weights: book, history });
    if (est.available && est.fits?.equity) { beta = est.fits.equity.beta; betaNote = `${est.weeks}주 주간 수익률, 설명력 R² ${est.fits.equity.r2 == null ? '—' : est.fits.equity.r2.toFixed(2)}`; }
    else betaNote = est.reason === 'weeks-insufficient' ? `겹치는 가격 기록 ${est.weeks}주 — ${STRESS_MIN_WEEKS}주 이상 필요` : '가격 기록이 있는 종목이 80%에 못 미침';
  }
  // Sector shares of the stock part. v58.63 (architecture audit A09): the denominator is the stock part itself — bond
  // ETFs from the fixed asset-class list are left out, so NVDA 500 + TLT 500 reads Technology 100% of the stock part,
  // not 50% under a "주식 평가액" label.
  const stockRows = rows.filter((row) => !assetClassOf(String(row.symbol || '').toUpperCase()));
  const stockTotal = stockRows.reduce((sum, row) => sum + Number(row.value), 0);
  const sectorShares = new Map();
  if (stockTotal > 0) for (const row of stockRows) { const name = row.sector || 'Unclassified'; sectorShares.set(name, (sectorShares.get(name) || 0) + Number(row.value) / stockTotal * 100); }
  // v58.80 ETF look-through: S&P 500 trackers expanded into their members; the sector card then reads the expanded mix.
  const unpriced = (Array.isArray(surface?.rows) ? surface.rows : []).filter((row) => !(Number(row?.value) > 0)).map((row) => String(row?.symbol || '').toUpperCase()).filter((symbol) => SP500_TRACKERS.includes(symbol));
  const look = lookThrough({ rows, sp500, isBond: (symbol) => !!assetClassOf(symbol), unpriced });
  const topSector = look.available
    ? look.sectors.map((item) => ({ name: item.key, pct: item.pct })).find((item) => item.name !== 'Unclassified') || null
    : [...sectorShares.entries()].map(([name, pct]) => ({ name, pct })).sort((a, b) => b.pct - a.pct).find((item) => item.name !== 'Unclassified') || null;
  let index = null;
  if (sp500?.rows?.length) {
    const bySym = new Map(sp500.rows.map((row) => [String(row.sym || '').toUpperCase(), Number(row.weight)]));
    const top10 = [...sp500.rows].sort((a, b) => b.weight - a.weight).slice(0, 10);
    const top10Set = new Set(top10.map((row) => String(row.sym).toUpperCase()));
    index = {
      asOf: sp500.asOf || null,
      memberShare: weights.filter((item) => bySym.has(item.symbol)).reduce((sum, item) => sum + item.w, 0) * 100,
      top10Share: weights.filter((item) => top10Set.has(item.symbol)).reduce((sum, item) => sum + item.w, 0) * 100,
      top10IndexWeight: top10.reduce((sum, row) => sum + Number(row.weight || 0), 0)
    };
  }
  const bonds = bondCushion({ rows, stressInput, baseCurrency: surface?.baseCurrency || null, history });
  // v58.63 (architecture audit A10): β is fitted on the holdings alone (weights normalised over valued holdings, local
  // listing-currency prices). It is named as the holdings' sensitivity; the whole-account figure scales it by the
  // invested share only when cash and the total are known, and a foreign-listed holding in another base currency is
  // flagged (the exchange-rate move is outside this fit).
  const exposurePct = Number.isFinite(Number(surface?.exposurePct)) && surface?.exposurePct != null ? Number(surface.exposurePct) : null;
  const accountBeta = beta != null && exposurePct != null ? beta * exposurePct / 100 : null;
  const base = String(surface?.baseCurrency || '').toUpperCase();
  const fxOutside = !!base && rows.some((row) => { const ccy = String(row.currency || row.listingCurrency || '').toUpperCase(); return ccy && ccy !== base; });
  return { available: true, holdings: rows.length, effectiveN, lookThrough: look.available ? look : null, beta, betaNote, accountBeta, exposurePct, fxOutside, topSector: topSector ? { name: sectorLabel(topSector.name), pct: topSector.pct } : null, stockHoldings: stockRows.length, index, bonds };
}

// v58.80 ETF look-through card: the six largest names after expansion, each bar split into the part held directly and the
// part held through the trackers, then one sentence on the largest overlap. Shown only when a tracker has a value.
const LOOK_THROUGH_ROWS = 6;
const lookThroughLabel = (line) => (line.symbol === 'GOOGL' ? '알파벳' : line.symbol);
function lookThroughCard(doc, look, card) {
  const [, month, day] = String(look.asOf || '').split('-');
  const node = card('ETF 속까지 본 상위 종목', month ? `${Number(month)}/${Number(day)} 비중` : '비중', null, lookThroughSentence(look, lookThroughLabel));
  node.dataset.pfReading = 'look-through';
  const max = look.exposures[0]?.pct || 1;
  const bars = el(doc, 'div', null, 'pf-look-bars');
  for (const line of look.exposures.slice(0, LOOK_THROUGH_ROWS)) {
    const row = el(doc, 'div', null, 'pf-look-row');
    const track = el(doc, 'div', null, 'pf-look-track');
    const direct = el(doc, 'i', null, 'pf-look-direct');
    direct.style.width = `${(line.directPct / max * 100).toFixed(1)}%`;
    const via = el(doc, 'i', null, 'pf-look-via');
    via.style.width = `${(line.viaPct / max * 100).toFixed(1)}%`;
    track.append(direct, via);
    track.setAttribute('role', 'img');
    track.setAttribute('aria-label', `${lookThroughLabel(line)} 직접 ${line.directPct.toFixed(1)}%, ETF 통해 ${line.viaPct.toFixed(1)}%`);
    row.append(el(doc, 'span', lookThroughLabel(line), 'pf-look-sym'), track, el(doc, 'span', `${line.pct.toFixed(1)}%`, 'pf-look-pct'));
    bars.append(row);
  }
  const legend = el(doc, 'div', null, 'pf-look-legend');
  legend.append(el(doc, 'span', '직접 보유', 'is-direct'), el(doc, 'span', `${look.trackers.join('·')} 통해`, 'is-via'));
  node.querySelector('p').before(bars, legend);
  return node;
}

// v58.55 개편 v2 (3g) 채권 완충: the bond share of the holdings (0% is a reading too) and, with price records, how the bond
// part moved in the weeks the stock part fell. Past association only — the text says rates can push both down together.
const signedPct = (value) => `${signedText(value, 1)}%`;
export function bondCushionCard(bonds) {
  if (!bonds?.available) return null;
  const listed = Object.keys(BOND_ETF_MAP).length;
  if (!(bonds.bondPct > 0)) {
    return { title: '채권 완충', value: '0%', tone: null, text: `보유 ${bonds.holdings}종목 가운데 채권 ETF가 없습니다(채권 분류는 미국 상장 채권 ETF ${listed}개 고정 목록 기준). 주식이 함께 내리는 구간에 평가액을 받쳐 줄 채권 부분이 이 계좌에는 없다는 뜻입니다.` };
  }
  const names = bonds.bonds.slice(0, 3).map((row) => `${row.symbol}(${BOND_KIND_LABEL[row.kind] || '채권'}) ${row.pct.toFixed(0)}%`).join(', ');
  const parts = [`채권 ETF가 보유 평가액의 ${bonds.bondPct.toFixed(0)}%입니다 — ${names}${bonds.bonds.length > 3 ? ` 외 ${bonds.bonds.length - 3}개` : ''}.`];
  if (bonds.highYieldPct > 0) parts.push(`이 가운데 하이일드 회사채 ${bonds.highYieldPct.toFixed(0)}%는 주식과 함께 움직이는 경향이 있어 완충으로 보기 어렵습니다.`);
  const corr = bonds.correlation || {};
  let tone = null;
  if (corr.available) {
    parts.push(`최근 ${corr.weeks}주 주간 수익률${corr.translatedTo ? `(${corr.translatedTo === 'KRW' ? '원화' : '달러'} 환산, 원/달러 종가 기준)` : ''}에서 채권 부분과 주식 부분의 상관은 ${corr.r.toFixed(2)}입니다.`);
    if (corr.downWeeks > 0) parts.push(`주식 부분이 내린 ${corr.downWeeks}주에 채권 부분은 평균 ${signedPct(corr.downBondMean)}(주식 ${signedPct(corr.downStockMean)}) 움직였습니다.`);
    parts.push('지난 관계일 뿐이며, 금리가 오르는 구간에는 주식과 채권이 함께 내릴 수 있습니다.');
    tone = corr.r < 0 ? 'favorable' : corr.r >= 0.3 ? 'burden' : null;
  } else if (corr.reason === 'one-sided') {
    parts.push('보유가 모두 채권이라 주식 부분과의 관계는 계산하지 않습니다.');
  } else if (corr.reason === 'currency-mixed') {
    parts.push('보유 종목의 상장 통화(원화·달러)가 섞여 있고 기준 통화가 정해지지 않아 주식–채권 상관은 계산하지 않습니다.');
  } else if (corr.reason === 'currency-unsupported') {
    parts.push('원화·달러 외 통화로 상장된 종목이 있어 주식–채권 상관은 계산하지 않습니다.');
  } else if (corr.reason === 'fx-missing') {
    parts.push('기준 통화로 환산할 원/달러 종가 기록이 없어 주식–채권 상관은 계산하지 않습니다.');
  } else if (corr.reason === 'weeks-insufficient') {
    parts.push(`주식–채권 상관은 겹치는 가격 기록 ${corr.weeks}주 — ${STRESS_MIN_WEEKS}주 이상이면 계산합니다.`);
  } else {
    parts.push('주식–채권 상관은 보유 종목 가격 기록을 받으면 계산합니다.');
  }
  return { title: '채권 완충', value: corr.available ? `${bonds.bondPct.toFixed(0)}%, 상관 ${corr.r.toFixed(2)}` : `${bonds.bondPct.toFixed(0)}%`, tone, text: parts.join(' ') };
}

// v59.51 (content audit, two layers): the 읽는 법 cards left the face. Their sector and single-holding cards were the same
// facts as 점검's criteria and were dropped; the parts nothing else says — the effective number of holdings, ETF
// look-through, the index overlap with β, and the bond cushion — render into 점검's expert fold (.pf-checks-fold).
export function renderPortfolioLens({ documentRef: doc, root, surface, checks = null, sectorLabel = (name) => name }) {
  const fold = doc?.querySelector?.('#pf-checks .pf-checks-fold');
  fold?.querySelector(':scope > .pf-reading')?.remove();
  requestSp500Weights(root, () => renderPortfolioLens({ documentRef: doc, root, surface: root?._aioPortfolioSurface || surface, checks, sectorLabel }));
  const lens = portfolioLens({ surface, stressInput: root?._aioPortfolioStressInput || null, history: root?._aioHistory || [], sp500: sp500Weights, sectorLabel });
  if (!lens.available || !fold) return lens;
  const look = lens.lookThrough;
  const card = (title, value, tone, text) => {
    const node = el(doc, 'section', null, 'pf-reading-card');
    const head = el(doc, 'div', null, 'pf-reading-head');
    head.append(el(doc, 'span', title), el(doc, 'span', value, `pf-reading-value${tone ? ` is-${tone}` : ''}`));
    node.append(head, el(doc, 'p', text));
    return node;
  };
  const cards = [];
  if (look) cards.push(lookThroughCard(doc, look, card));
  if (lens.topSector) {
    const heavy = lens.topSector.pct > SECTOR_CONCENTRATION_BAND;
    // v58.80 (first-users bundle 2): one holding read "비중이 고르게 나뉘어" — there is nothing to spread.
    const spread = lens.holdings <= 1 ? ' 한 종목만 보유해 종목 사이의 분산은 없습니다.'
      : lens.effectiveN < lens.holdings - 0.5
      ? ` 실질 종목 수가 ${lens.effectiveN.toFixed(1)}개로 보유 수(${lens.holdings}개)보다 적은 것은 비중이 몇 종목에 몰려 있기 때문입니다.`
      : ` 비중이 고르게 나뉘어 실질 종목 수(${lens.effectiveN.toFixed(1)}개)가 보유 수와 비슷합니다.`;
    const bondNote = lens.stockHoldings < lens.holdings ? ' 채권 ETF는 이 섹터 비중의 분모에서 뺐습니다.' : '';
    const next = look ? look.sectors.filter((item) => item.key !== 'Unclassified').slice(1, 3).map((item) => `${sectorLabel(item.key)} ${item.pct.toFixed(0)}%`).join(', ') : '';
    cards.push(card(`${lens.topSector.name} 비중`, `${lens.topSector.pct.toFixed(0)}%`, heavy ? 'burden' : null, look
      ? `${look.trackers.join('·')} 속 종목을 섹터별로 나눠 더하면 가장 큰 섹터가 주식 부분의 ${lens.topSector.pct.toFixed(0)}%입니다${heavy ? '(내부 구간 40% 초과)' : ''}.${next ? ` 다음은 ${next}.` : ''}${bondNote}`
      : `가장 큰 섹터가 주식 부분 평가액의 ${lens.topSector.pct.toFixed(0)}%입니다${heavy ? '(내부 구간 40% 초과)' : ''}.${bondNote}${spread}`));
  }
  const indexLine = lens.index && !look; // with trackers held, the look-through card shows the index overlap instead
  if (lens.index || lens.beta != null) {
    const parts = [];
    if (indexLine) parts.push(`보유액의 ${lens.index.memberShare.toFixed(0)}%가 S&P 500 구성 종목이고, 지수 비중 상위 10종목(지수의 ${lens.index.top10IndexWeight.toFixed(0)}%)에 ${lens.index.top10Share.toFixed(0)}%가 있습니다.`);
    if (lens.beta != null) parts.push(`과거 주간 기준으로 보유 시장 지수가 1% 움직일 때 보유 종목 부분(현금 제외)은 평균 ${lens.beta.toFixed(2)}% 움직였습니다${lens.accountBeta != null ? ` — 현금을 포함한 계좌 전체(투자 비중 ${lens.exposurePct.toFixed(0)}%)로는 약 ${lens.accountBeta.toFixed(2)}%입니다` : ' — 현금 입력이 없어 계좌 전체 기준은 계산하지 않습니다'}${lens.fxOutside ? '. 상장 통화 가격 기준이라 기준 통화로 바꿀 때의 환율 움직임은 이 값에 들어 있지 않습니다' : ''}. 예측이 아니라 지난 관계입니다.`);
    else parts.push(`시장 민감도(베타)는 아직 계산 전입니다 — ${lens.betaNote}.`);
    cards.push(card('지수와의 관계', lens.beta != null ? `β ${lens.beta.toFixed(2)}` : indexLine ? `상위 10 ${lens.index.top10Share.toFixed(0)}%` : '없음', null, parts.join(' ')));
  }
  // The single-holding card repeated 점검's own single-holding card in the same fold; it is not drawn twice.
  const cushion = bondCushionCard(lens.bonds);
  if (cushion) { const node = card(cushion.title, cushion.value, cushion.tone, cushion.text); node.dataset.pfReading = 'bond-cushion'; cards.push(node); }
  if (!cards.length) return lens;
  const block = el(doc, 'div', null, 'pf-reading');
  block.append(el(doc, 'h3', '분산·지수·채권으로 본 구성', 'pf-reading-title'), ...cards);
  const evidence = el(doc, 'div', null, 'sx-evidence pf-reading-evidence');
  evidence.append(el(doc, 'span', '근거, Markowitz(1952) 분산, 허핀달 지수(실질 종목 수), CAPM 베타'), el(doc, 'span', `S&P 500 지수 비중 ${lens.index?.asOf || '없음'}`), el(doc, 'span', '채권·현금 ETF 분류, 앱이 정한 목록'), el(doc, 'span', '투자 권유 아님'));
  block.append(evidence);
  fold.append(block);
  return lens;
}
