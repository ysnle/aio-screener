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
import { estimateBookSensitivities, STRESS_MIN_WEEKS } from '../../domain/portfolio/stress-sensitivity.js';
import { bondCushion, assetClassOf, BOND_ETF_MAP, BOND_KIND_LABEL, ASSET_CLASS_MAP_VERSION } from '../../domain/portfolio/asset-class.js';

// P1466: the 3-month gap to the blended index split into sector, stock selection, FX and cash —
// bars on one scale, the total underneath, then what the arithmetic does not claim.
function attributionBox(doc, attribution) {
  const box = el(doc, 'div', null, 'pf-attribution');
  box.append(el(doc, 'span', `지수 대비 차이의 원인 · ${attribution.window}`, 'stock-read-vis-title'));
  const max = Math.max(0.5, ...attribution.excess.map((part) => Math.abs(part.pct)));
  for (const part of attribution.excess) {
    const line = el(doc, 'div', null, 'scr-ic-row');
    const track = el(doc, 'div', null, 'scr-ic-track');
    const fill = el(doc, 'span', null, `scr-ic-fill ${part.pct >= 0 ? 'is-up' : 'is-down'}`);
    fill.style.width = `${Math.min(50, Math.abs(part.pct) / max * 50).toFixed(1)}%`;
    fill.style[part.pct >= 0 ? 'left' : 'right'] = '50%';
    track.append(fill);
    line.append(el(doc, 'span', part.label, 'scr-ic-label'), track, el(doc, 'span', `${part.pct >= 0 ? '+' : ''}${part.pct.toFixed(1)}%p`, 'scr-ic-value'));
    box.append(line);
  }
  const sign = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}`;
  box.append(el(doc, 'p', `합계 ${sign(attribution.excessPct)}%p = 내 수익률 ${sign(attribution.totalPct)}% − ${attribution.blendedLabel} ${sign(attribution.blendedPct)}%`, 'theme-strength-basis'));
  const notes = [];
  if (attribution.sectorMappedPct < 100) notes.push(`섹터 효과는 미국 섹터 ETF가 대응되는 보유액 ${attribution.sectorMappedPct.toFixed(0)}%에서만 분리(나머지는 종목 선택에 포함)`);
  if (!attribution.cashDeclared) notes.push('현금을 입력하지 않아 주식 부분만 계산(현금 효과 0)');
  else if (attribution.cashSharePct > 0) notes.push(`현금 ${attribution.cashSharePct.toFixed(0)}% — 지수에 투자됐다면 얻었을 수익률만큼이 현금 효과`);
  const mismatched = (attribution.skipped || []).filter((item) => item.reason === 'basis-mismatch');
  if (mismatched.length) notes.push(`종가 기준일이 비교 지수와 다르거나 확인되지 않는 ${mismatched.length}종목은 제외`);
  const md = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
  const fxHeld = (attribution.skipped || []).filter((item) => item.reason === 'fx-basis-mismatch');
  if (fxHeld.length) notes.push(`원/달러 종가(${fxHeld[0].fxBasis ? md(fxHeld[0].fxBasis) : '날짜 미확인'})가 종목 종가 기준일과 달라 환율 효과를 계산하지 않은 ${fxHeld.length}종목은 제외`);
  if (attribution.fxHoldingsPct > 0) notes.push(`환율 효과는 기준 통화로 환산한 보유액 ${attribution.fxHoldingsPct.toFixed(0)}%의 원/달러 3개월 변동${attribution.fxAsOf ? `(${md(attribution.fxAsOf)} 종가까지)` : ''}`);
  notes.push('지금 비중을 3개월 동안 들고 있었다고 가정한 계산이라 실제 계좌 성과와 다릅니다');
  box.append(el(doc, 'p', `${notes.join(' · ')}.`, 'theme-strength-basis'));
  return box;
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
      return { ret3m: Number(spy.ret3m), label: 'S&P 500(SPY)', asOf: spy.factorSessionDate || null };
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
  const visuals = el(doc, 'div', null, 'stock-read-visuals');
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
    box.append(el(doc, 'span', `섹터 비중(${read.sectorMix[0].basis === 'stock-part' ? '주식 부분 중' : '현금 포함 총자산 대비'}) · 섹터 회전 단계`, 'stock-read-vis-title'));
    for (const row of read.sectorMix.slice(0, 6)) {
      const line = el(doc, 'div', null, 'stock-read-bars');
      line.append(el(doc, 'span', row.label, 'stock-read-bar-label'));
      const item = el(doc, 'div', null, 'stock-read-bar-row');
      const bar = el(doc, 'div', null, `stock-read-bar pf-sector-bar is-${row.quadrant?.tone || 'unknown'}`);
      bar.style.width = `${Math.max(2, row.pct).toFixed(1)}%`;
      item.append(bar, el(doc, 'span', `${row.pct.toFixed(0)}%${row.quadrant ? ` · ${row.quadrant.label}` : ''}`, 'stock-read-bar-value'));
      line.append(item);
      box.append(line);
    }
    visuals.append(box);
  }
  if (read.attribution?.available) visuals.append(attributionBox(doc, read.attribution));
  if (visuals.childNodes.length) host.append(visuals);
  const list = el(doc, 'ul', null, 'stock-read-points');
  for (const point of read.points) {
    const li = el(doc, 'li', null, `stock-read-point is-${point.tone}`);
    li.append(el(doc, 'span', point.title, 'stock-read-point-title'), el(doc, 'span', point.text, 'stock-read-point-text'));
    list.append(li);
  }
  host.append(list);
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
  const weights = rows.map((row) => ({ symbol: String(row.symbol || '').toUpperCase(), w: Number(row.value) / total }));
  const effectiveN = 1 / weights.reduce((sum, item) => sum + item.w * item.w, 0);
  let beta = null;
  let betaNote = '보유 종목 가격 기록을 받으면 계산합니다';
  if (stressInput?.historyMap && Array.isArray(stressInput.commonDates)) {
    const book = Object.fromEntries(weights.map((item) => [item.symbol, item.w]));
    const est = estimateBookSensitivities({ historyMap: stressInput.historyMap, commonDates: stressInput.commonDates, weights: book, history });
    if (est.available && est.fits?.equity) { beta = est.fits.equity.beta; betaNote = `${est.weeks}주 주간 수익률 · 설명력 R² ${est.fits.equity.r2 == null ? '—' : est.fits.equity.r2.toFixed(2)}`; }
    else betaNote = est.reason === 'weeks-insufficient' ? `겹치는 가격 기록 ${est.weeks}주 — ${STRESS_MIN_WEEKS}주 이상 필요` : '가격 기록이 있는 종목이 80%에 못 미침';
  }
  // Sector shares of the stock part. v58.63 (architecture audit A09): the denominator is the stock part itself — bond
  // ETFs from the fixed asset-class list are left out, so NVDA 500 + TLT 500 reads Technology 100% of the stock part,
  // not 50% under a "주식 평가액" label.
  const stockRows = rows.filter((row) => !assetClassOf(String(row.symbol || '').toUpperCase()));
  const stockTotal = stockRows.reduce((sum, row) => sum + Number(row.value), 0);
  const sectorShares = new Map();
  if (stockTotal > 0) for (const row of stockRows) { const name = row.sector || 'Unclassified'; sectorShares.set(name, (sectorShares.get(name) || 0) + Number(row.value) / stockTotal * 100); }
  const topSector = [...sectorShares.entries()].map(([name, pct]) => ({ name, pct })).sort((a, b) => b.pct - a.pct).find((item) => item.name !== 'Unclassified') || null;
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
  return { available: true, holdings: rows.length, effectiveN, beta, betaNote, accountBeta, exposurePct, fxOutside, topSector: topSector ? { name: sectorLabel(topSector.name), pct: topSector.pct } : null, stockHoldings: stockRows.length, index, bonds };
}

// v58.55 개편 v2 (3g) 채권 완충: the bond share of the holdings (0% is a reading too) and, with price records, how the bond
// part moved in the weeks the stock part fell. Past association only — the text says rates can push both down together.
const signedPct = (value) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
export function bondCushionCard(bonds) {
  if (!bonds?.available) return null;
  const listed = Object.keys(BOND_ETF_MAP).length;
  if (!(bonds.bondPct > 0)) {
    return { title: '채권 완충', value: '0%', tone: null, text: `보유 ${bonds.holdings}종목 가운데 채권 ETF가 없습니다(채권 분류는 미국 상장 채권 ETF ${listed}개 고정 목록 기준). 주식이 함께 내리는 구간에 평가액을 받쳐 줄 채권 부분이 이 계좌에는 없다는 뜻입니다.` };
  }
  const names = bonds.bonds.slice(0, 3).map((row) => `${row.symbol}(${BOND_KIND_LABEL[row.kind] || '채권'}) ${row.pct.toFixed(0)}%`).join(' · ');
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
  } else if (corr.reason === 'fx-missing') {
    parts.push('기준 통화로 환산할 원/달러 종가 기록이 없어 주식–채권 상관은 계산하지 않습니다.');
  } else if (corr.reason === 'weeks-insufficient') {
    parts.push(`주식–채권 상관은 겹치는 가격 기록 ${corr.weeks}주 — ${STRESS_MIN_WEEKS}주 이상이면 계산합니다.`);
  } else {
    parts.push('주식–채권 상관은 보유 종목 가격 기록을 받으면 계산합니다.');
  }
  return { title: '채권 완충', value: corr.available ? `${bonds.bondPct.toFixed(0)}% · 상관 ${corr.r.toFixed(2)}` : `${bonds.bondPct.toFixed(0)}%`, tone, text: parts.join(' ') };
}

export function renderPortfolioLens({ documentRef: doc, root, surface, checks = null, sectorLabel = (name) => name }) {
  const aside = doc?.getElementById('pf-reading');
  const set = (id, text) => { const node = doc?.getElementById(id); if (node) node.textContent = text; return node; };
  requestSp500Weights(root, () => renderPortfolioLens({ documentRef: doc, root, surface: root?._aioPortfolioSurface || surface, checks, sectorLabel }));
  const lens = portfolioLens({ surface, stressInput: root?._aioPortfolioStressInput || null, history: root?._aioHistory || [], sp500: sp500Weights, sectorLabel });
  if (!lens.available) {
    set('pf-effective-n', '—'); set('pf-beta', '—');
    if (aside) { aside.hidden = true; aside.replaceChildren(); }
    return lens;
  }
  set('pf-effective-n', `${lens.effectiveN.toFixed(1)}개`);
  set('pf-effective-n-note', `평가액 있는 ${lens.holdings}종목 · 1 ÷ Σ비중²`);
  set('pf-beta', lens.beta == null ? '없음' : lens.beta.toFixed(2));
  set('pf-beta-note', lens.beta == null ? lens.betaNote : `보유 종목 부분(현금 제외): 시장 1% 움직일 때 평균 ${lens.beta.toFixed(2)}%${lens.accountBeta != null ? ` · 현금 포함 계좌 약 ${lens.accountBeta.toFixed(2)}%` : ''} · ${lens.betaNote}`);
  if (!aside) return lens;
  const card = (title, value, tone, text) => {
    const node = el(doc, 'section', null, 'pf-reading-card');
    const head = el(doc, 'div', null, 'pf-reading-head');
    head.append(el(doc, 'span', title), el(doc, 'span', value, `pf-reading-value${tone ? ` is-${tone}` : ''}`));
    node.append(head, el(doc, 'p', text));
    return node;
  };
  const cards = [];
  if (lens.topSector) {
    const heavy = lens.topSector.pct > SECTOR_CONCENTRATION_BAND;
    const spread = lens.effectiveN < lens.holdings - 0.5
      ? ` 실질 종목 수가 ${lens.effectiveN.toFixed(1)}개로 보유 수(${lens.holdings}개)보다 적은 것은 비중이 몇 종목에 몰려 있기 때문입니다.`
      : ` 비중이 고르게 나뉘어 실질 종목 수(${lens.effectiveN.toFixed(1)}개)가 보유 수와 비슷합니다.`;
    const bondNote = lens.stockHoldings < lens.holdings ? ' 채권 ETF는 이 섹터 비중의 분모에서 뺐습니다.' : '';
    cards.push(card(`${lens.topSector.name} 비중`, `${lens.topSector.pct.toFixed(0)}%`, heavy ? 'burden' : null, `가장 큰 섹터가 주식 부분 평가액의 ${lens.topSector.pct.toFixed(0)}%입니다${heavy ? '(내부 구간 40% 초과)' : ''}.${bondNote}${spread}`));
  }
  if (lens.index || lens.beta != null) {
    const parts = [];
    if (lens.index) parts.push(`보유액의 ${lens.index.memberShare.toFixed(0)}%가 S&P 500 구성 종목이고, 지수 비중 상위 10종목(지수의 ${lens.index.top10IndexWeight.toFixed(0)}%)에 ${lens.index.top10Share.toFixed(0)}%가 있습니다.`);
    if (lens.beta != null) parts.push(`과거 주간 기준으로 보유 시장 지수가 1% 움직일 때 보유 종목 부분(현금 제외)은 평균 ${lens.beta.toFixed(2)}% 움직였습니다${lens.accountBeta != null ? ` — 현금을 포함한 계좌 전체(투자 비중 ${lens.exposurePct.toFixed(0)}%)로는 약 ${lens.accountBeta.toFixed(2)}%입니다` : ' — 현금 입력이 없어 계좌 전체 기준은 계산하지 않습니다'}${lens.fxOutside ? '. 상장 통화 가격 기준이라 기준 통화로 바꿀 때의 환율 움직임은 이 값에 들어 있지 않습니다' : ''}. 예측이 아니라 지난 관계입니다.`);
    else parts.push(`시장 민감도 β는 없음 — ${lens.betaNote}.`);
    cards.push(card('지수와의 관계', lens.beta != null ? `β ${lens.beta.toFixed(2)}` : lens.index ? `상위 10 ${lens.index.top10Share.toFixed(0)}%` : '없음', null, parts.join(' ')));
  }
  const single = checks?.checks?.find?.((check) => check.id === 'single-holding');
  if (single) cards.push(card('한 종목 쏠림', single.value, single.status === 'attention' ? 'burden' : null, single.detail));
  const cushion = bondCushionCard(lens.bonds);
  if (cushion) { const node = card(cushion.title, cushion.value, cushion.tone, cushion.text); node.dataset.pfReading = 'bond-cushion'; cards.push(node); }
  aside.replaceChildren(el(doc, 'h2', '이 포트폴리오를 읽는 법', 'sx-card__title'), ...cards);
  const evidence = el(doc, 'div', null, 'sx-evidence pf-reading-evidence');
  evidence.append(el(doc, 'span', '근거 · Markowitz(1952) 분산 · 허핀달 지수(실질 종목 수) · CAPM 베타'), el(doc, 'span', `지수 비중 · iShares IVV 보유 ${lens.index?.asOf || '없음'}`), el(doc, 'span', `채권 분류 · 고정 목록 ${ASSET_CLASS_MAP_VERSION}`), el(doc, 'span', '투자 권유 아님'));
  aside.append(evidence);
  aside.querySelector('h2').id = 'pf-reading-title';
  aside.hidden = cards.length === 0;
  return lens;
}
