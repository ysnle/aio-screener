import { createResourceBag, createChartRegistry } from '../../app/lifecycle.js';
import { selectPortfolioState } from '../../state/selectors/portfolio.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { derivePortfolioSurface } from '../../domain/portfolio/surface.js';
import { appUsdKrwClose } from '../../domain/portfolio/cash.js';
import { vixBand } from '../../domain/sentiment/narrative.js';
import { buildCloseSeries, closeBasis } from '../../domain/briefing/market-read.js';
import { derivePortfolioChecks } from '../../domain/portfolio/checks.js';
import { renderPortfolioRead, renderPortfolioLens } from '../components/portfolio-read.js';
import { portfolioRowsForAI, portfolioSectorLabel } from '../../domain/portfolio/portfolio-read.js';
import { clearKnowledgeArrival, renderKnowledgeArrival } from '../components/knowledge-arrival.js';
import { navigateKnowledgeRoute } from '../../app/knowledge-route-state.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { renderTradeJournal, installTradeJournal } from '../panels/portfolio-trade-journal.js';

// RM-01 (2026-07-19): this module used to fully repaint pf-total-value/pf-total-pnl/etc. and
// replaceChildren() the pf-positions-tbody table with a 5-column row, while legacy
// (js/aio-ui.js liveEls + an inline index.html script at :12742/:12928-:12952) kept writing the
// same ids/table with the real column set. That is the highest-severity contested container in
// F-03/route-owners.json: whichever writer runs last wins the race, and native losing means the
// table silently shrinks. P780 transfers only the independently owned pf-analysis-status
// readiness text. P810 adds a bounded native hero projection for total value and total P/L;
// P830 transfers the Vault-backed nine-column holdings table. Prices, risk, AI workbench,
// and chart surfaces remain separately legacy-owned.
function renderPortfolioStatus(documentRef, state, surface) {
  const element = documentRef?.getElementById('pf-analysis-status');
  if (!element) return;
  const readState = surface?.readState || state?.readState || 'unavailable';
  const valuation = surface?.valuationState || 'unavailable';
  if (readState === 'locked') {
    element.textContent = '포트폴리오 잠김 — 잠금 해제 후 금액을 표시합니다.';
  } else if (readState === 'loading') {
    element.textContent = '포트폴리오 불러오는 중...';
  } else if (readState === 'failed') {
    element.textContent = '포트폴리오 읽기 실패 — 입력 유무를 단정하지 않습니다. 재시도해 주세요.';
  } else if (valuation === 'cash-only') {
    element.textContent = surface?.totalAssets == null ? '현금만 보유 중입니다, 환율 자료가 없어 통화별 금액만 표시합니다' : '현금만 보유 중입니다, 총자산 = 현금';
  } else if (valuation === 'empty') {
    element.textContent = '포트폴리오 등록 후 자동 계산됩니다.';
  } else if (valuation === 'partial') {
    // v57.86 (live review): the hero shows no partial total, so the line says the totals wait (it said the holding was "left out").
    element.textContent = `${surface?.valuedHoldingCount ?? 0}/${surface?.holdingCount ?? 0}종목 평가, 가격 없음 ${(surface?.holdingCount ?? 0) - (surface?.valuedHoldingCount ?? 0)}종목이 있어 총자산과 손익은 모든 종목 가격을 받은 뒤 표시합니다${closeNote(surface)}`; // v57.81: same words as the row state
  } else if (valuation === 'unavailable' && readState === 'ready' && (surface?.holdingCount ?? 0) > 0) {
    // v57.81: every holding is on 가격 없음 (no quote and no close yet), so no total is shown rather than a partial one.
    element.textContent = `${surface.holdingCount}종목 모두 가격 없음, 가격을 받으면 총자산과 손익을 계산합니다`;
  } else if (valuation === 'complete') {
    element.textContent = `${surface?.holdingCount ?? 0}종목 평가 완료${surface?.cash == null && !surface?.cashHeld ? ', 현금 미입력 — 총자산은 주식 평가액' : ''}${closeNote(surface)}`;
  } else {
    element.textContent = '포트폴리오 데이터 수신 대기';
  }
  // v57.77: the line sits in the hero now (the 리스크 분석 shell that hid it with an empty portfolio is gone); with no
  // holdings the table's empty state stays the one message, so the readiness line is hidden.
  element.hidden = readState === 'ready' && valuation === 'empty';
  element.setAttribute('data-source-kind', valuation === 'complete' || valuation === 'cash-only' ? 'portfolio-state' : 'unavailable');
  element.setAttribute('data-source-label', valuation === 'complete' || valuation === 'cash-only' ? 'native-portfolio-slice' : 'portfolio-state-unavailable');
  element.setAttribute('data-operational-use', 'reference-only');
  element.setAttribute('data-read-state', readState);
  element.setAttribute('data-valuation-state', valuation);
  element.setAttribute('data-decision-eligible', surface?.decisionEligible === true ? 'true' : 'false');
  element.setAttribute('data-promotion-status', surface?.promotionBlocked === false ? 'eligible' : 'blocked');
  if (state?.updatedAt) element.setAttribute('data-observed-at', state.updatedAt);
  else element.removeAttribute('data-observed-at');
}

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

// P1407: the totals are in the surface's base currency (the same rule as the holdings table: an
// undeclared single basis is shown as USD, and the currency note says it was assumed).
export function formatMoney(value, currency = 'USD') {
  if (value == null) return '—';
  const code = String(currency || 'USD').trim().toUpperCase();
  const amount = Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return code === 'USD' ? `$${amount}` : code === 'KRW' ? `₩${amount}` : `${amount} ${code}`;
}

function renderPortfolioHero(documentRef, surface) {
  const valueElement = documentRef?.getElementById('pf-total-value');
  const pnlElement = documentRef?.getElementById('pf-total-pnl');
  if (!valueElement && !pnlElement) return;
  // v57.86 (live review): with no cash entered the total is the holdings' value (the status line says so) — P&L showed beside "—".
  const totalValue = surface.valuationState === 'cash-only' || surface.valuationState === 'complete' ? surface.totalAssets ?? (surface.valuationState === 'complete' && surface.cash == null && !surface.cashHeld ? surface.positionValue ?? null : null) : null;
  const totalPnl = surface.valuationState === 'complete' ? surface.totalPnl : null;
  if (valueElement) {
    valueElement.textContent = formatMoney(totalValue, surface.baseCurrency || surface.declaredBaseCurrency || 'USD');
    valueElement.setAttribute('data-aio-portfolio-hero-renderer', 'native');
    valueElement.setAttribute('data-source-kind', totalValue == null ? 'unavailable' : 'portfolio-state');
    valueElement.setAttribute('data-source-label', totalValue == null ? 'portfolio-value-unavailable' : 'native-portfolio-totals');
    valueElement.setAttribute('data-operational-use', 'reference-only');
  }
  if (pnlElement) {
    pnlElement.textContent = totalPnl == null ? '—' : `${totalPnl >= 0 ? '+' : '-'}${formatMoney(totalPnl, surface.baseCurrency || surface.declaredBaseCurrency || 'USD')}`;
    pnlElement.style.color = totalPnl == null ? 'var(--text-dim)' : totalPnl >= 0 ? 'var(--green)' : 'var(--red)';
    pnlElement.setAttribute('data-aio-portfolio-hero-renderer', 'native');
    pnlElement.setAttribute('data-source-kind', totalPnl == null ? 'unavailable' : 'portfolio-state');
    pnlElement.setAttribute('data-source-label', totalPnl == null ? 'portfolio-pnl-unavailable' : 'native-portfolio-totals');
    pnlElement.setAttribute('data-operational-use', 'reference-only');
  }
}

// P1449 (LC-45 residual): surface writers stopped hard-coding `$`. A KRW cash or KRW daily
// change labeled with a dollar sign is a lie about its unit, not a formatting choice; the
// surface's DECLARED currency is the unit those amounts are denominated in — even while a
// mixed-currency conversion is held (the hold blocks the total, not the unit of each number).
function formatSurfaceMoney(value, currency = 'USD') {
  if (value == null) return '—';
  const code = String(currency || 'USD').trim().toUpperCase();
  const sign = value < 0 ? '-' : '';
  const amount = Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return code === 'USD' ? `${sign}$${amount}` : code === 'KRW' ? `${sign}₩${amount}` : `${sign}${amount} ${code}`;
}

function markSurfaceElement(element, value, sourceKind, sourceLabel, observedAt) {
  if (!element) return;
  element.dataset.aioPortfolioSurfaceRenderer = 'native';
  element.dataset.sourceKind = value == null ? 'unavailable' : sourceKind;
  element.dataset.sourceLabel = value == null ? 'portfolio-surface-unavailable' : sourceLabel;
  element.dataset.operationalUse = 'reference-only';
  if (observedAt) element.dataset.observedAt = observedAt;
  else delete element.dataset.observedAt;
}

function setSurfaceText(documentRef, id, text, value, surface, color = null) {
  const element = documentRef?.getElementById(id);
  if (!element) return;
  element.textContent = text;
  if (color) element.style.color = color;
  markSurfaceElement(element, value, surface.sourceKind, surface.sourceLabel, surface.observedAt);
}

// v57.50 I11: the bars and the 포트폴리오 해석 use one sector vocabulary (the screener's labels via portfolioSectorLabel).
const sectorLabel = portfolioSectorLabel;

// v57.50 C24: the sector of a holding comes from the same screener row the 포트폴리오 해석 reads.
// v57.54 review: the latest completed close per symbol (canonical screener row), so holdings without a live quote
// are still valued — and the status line says which date that close is.
// v57.55 review (B4-F5): a Korean holding is stored as its six digits, but quotes, charts and screener rows key it with
// the exchange suffix (105560 -> 105560.KS), so it never got a price. One lookup symbol for all three.
const quoteSymbolOf = (root, symbol) => {
  const code = String(symbol || '').trim().toUpperCase();
  if (!/^\d{6}$/.test(code)) return code;
  try { if (typeof root?.krTickerToYahoo === 'function') return root.krTickerToYahoo(code) || `${code}.KS`; } catch (_) {}
  return `${code}.KS`;
};
const liveDataFor = (root, holdings, liveData) => {
  const view = { ...liveData };
  for (const holding of holdings || []) {
    const code = String(holding?.symbol || holding?.ticker || '').toUpperCase();
    const mapped = quoteSymbolOf(root, code);
    if (mapped !== code && !view[code] && liveData[mapped]) view[code] = liveData[mapped];
  }
  return view;
};
// v57.78 perf: one symbol map per render, shared by the close and sector lookups (each built its own from a fresh
// bridge read). A non-empty native store set is read in place; an empty one defers to the bridge, which owns the
// pre-publication fallback (screener-row-policy, same rule as scenario-outlook), then the bundled DB as before.
function screenerRowsBySymbol(root, store) {
  let rows = [];
  try {
    const nativeRows = store?.getState?.()?.screener?.rows;
    rows = Array.isArray(nativeRows) && nativeRows.length ? nativeRows : (typeof root?._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() || [] : []);
  } catch (_) { rows = []; }
  if (!rows.length && Array.isArray(root?.SCREENER_DB)) rows = root.SCREENER_DB;
  return new Map(rows.map((row) => [String(row?.sym || '').toUpperCase(), row]));
}
// v57.81: a holding that is a US listing outside the screener universe is read on demand (session cache, the reader's
// two-at-a-time cap, at most eight new requests per render) and joins the symbol map with its own row; missing inputs
// stay missing (the listing carries no sector, so none is invented). The record's arrival re-renders ('aio:onDemandSymbol').
const ON_DEMAND_HOLDING_REQUESTS = 8;
function withOnDemandHoldings(root, bySymbol, holdings) {
  const records = new Map();
  if (typeof root?._aioOnDemandSymbol !== 'function') return records;
  let requested = 0;
  for (const holding of Array.isArray(holdings) ? holdings : []) {
    const symbol = String(holding?.symbol || holding?.ticker || '').trim().toUpperCase();
    if (!symbol || records.has(symbol) || bySymbol.has(symbol) || /\.K[SQ]$/.test(symbol)) continue;
    const record = root._aioOnDemandSymbol(symbol);
    if (record?.status === 'ready' && record.row) { records.set(symbol, record); bySymbol.set(symbol, record.row); }
    else if (!record && requested < ON_DEMAND_HOLDING_REQUESTS && typeof root._aioRequestOnDemandSymbol === 'function') {
      requested += 1;
      Promise.resolve(root._aioRequestOnDemandSymbol(symbol)).catch(() => {});
    }
  }
  return records;
}
function screenerCloseOf(root, bySymbol, onDemand = new Map()) {
  return (symbol) => {
    const row = bySymbol.get(String(symbol || '').toUpperCase()) || bySymbol.get(quoteSymbolOf(root, symbol));
    // v58.63 (SCR03): the canonical valuation close first, as every other close reader does.
    const price = finite(row?._valuationPrice ?? row?._valuationPePrice ?? row?._valuationPbPrice ?? row?.valuationPrice ?? row?.pePrice);
    const own = onDemand.get(String(symbol || '').toUpperCase())?.lastClose;
    if ((price == null || price <= 0) && own) return { price: own.price, date: own.date };
    if (price != null && price > 0) return { price, date: row?.factorSessionDate || null };
    return null;
  };
}
// v57.54 review: holdings outside the ~30 market symbols never asked for a quote, so P&L stayed "—" (the screener
// already asks for its visible rows the same way). Throttled per symbol set; the close fallback covers the wait.
let holdingQuoteSignature = '';
let holdingQuoteRequestedAt = 0;
// v57.86 (live review): the request fired while another quotes run was in flight — the scheduler skipped it ("already in
// flight") or fetchLiveQuotes returned at once and reported ok — and the 55-second throttle kept it from retrying, so
// Korean holdings stayed 가격 없음. A run that leaves a requested symbol without a quote retries.
const unquoted = (root, symbols) => symbols.filter((symbol) => !(Number(root?._liveData?.[symbol]?.price) > 0));
let portfolioMounted = false;
function requestHoldingQuotes(root, rows, attempt = 0) { // attempt > 0: a retry, which alone passes the throttle
  const symbols = [...new Set((rows || []).filter((row) => row?.sourceKind !== 'live-quote').map((row) => quoteSymbolOf(root, row?.symbol)).filter(Boolean))].slice(0, 60);
  if (!symbols.length) return;
  symbols.forEach((symbol) => root?.AIO?.registerLiveSymbol?.(symbol, { reason: 'portfolio-holding' }));
  const signature = symbols.join('|');
  const nowMs = Date.now();
  if (!attempt && signature === holdingQuoteSignature && nowMs - holdingQuoteRequestedAt < 55_000) return;
  if (root?._aioBootPhase?.quoteReady === false || typeof root?.AIO?.runScheduledRefresh !== 'function') return;
  holdingQuoteSignature = signature;
  holdingQuoteRequestedAt = nowMs;
  Promise.resolve(root.AIO.runScheduledRefresh({ keys: ['quotes'], symbols, pageId: 'portfolio', reason: 'portfolio-holding-quotes' }))
    // v57.88 (review): a retry is dropped once the page has unmounted.
    .then(() => { if (attempt < 3 && unquoted(root, symbols).length) setTimeout(() => { if (portfolioMounted) requestHoldingQuotes(root, rows, attempt + 1); }, 4000); })
    .catch(() => {});
}
const closeNote = (surface) => {
  const n = surface?.closeValuedCount || 0;
  const date = String(surface?.closeDate || '');
  const md = /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} ` : '';
  const delayed = surface?.delayedValuedCount || 0;
  return `${n ? `, ${n}종목은 실시간 시세 대신 ${md}종가 기준` : ''}${delayed ? `, ${delayed}종목은 지연 시세(참고) 기준` : ''}`;
};

function screenerSectorOf(bySymbol) {
  return (symbol) => bySymbol.get(String(symbol || '').toUpperCase())?.sector || null;
}

// v57.81: cash is one balance per currency. Each box shows its own currency's amount; the hero shows the total in the
// unit the surface converted to (with the rate basis below the boxes), or each balance when no rate exists.
function renderCashBalances(documentRef, surface) {
  const balances = Array.isArray(surface?.cashBalances) ? surface.cashBalances : [];
  const amountOf = (code) => balances.find((row) => row.currency === code)?.amount;
  for (const [id, code] of [['pf-cash-krw-input', 'KRW'], ['pf-cash-usd-input', 'USD']]) {
    const input = documentRef?.getElementById(id);
    if (!input || documentRef.activeElement === input) continue;
    const amount = amountOf(code);
    input.value = amount == null ? '' : String(amount);
  }
  const conversion = surface?.cashConversion || {};
  const each = balances.filter((row) => row.amount > 0).map((row) => formatSurfaceMoney(row.amount, row.currency || conversion.target || surface.declaredBaseCurrency));
  const unit = conversion.target || surface.declaredCashCurrency || surface.declaredBaseCurrency;
  const heroText = surface.cash != null ? formatSurfaceMoney(surface.cash, unit) : each.length ? `${each.join(', ')}, 합계 보류` : '—';
  setSurfaceText(documentRef, 'pf-cash-hero', heroText, surface.cash, surface);
  const line = documentRef?.getElementById('pf-cash-total');
  if (!line) return;
  const rateText = conversion.basisLabel || '';
  let text = '';
  if (surface.cashHeld) {
    const names = (conversion.held || []).map((code) => ({ KRW: '원화', USD: '달러' }[code] || code)).join('·');
    text = `환율 자료가 없어 합계를 계산하지 않았습니다, ${names ? `${names} 현금은 ` : ''}통화별 금액만 표시`;
  } else if (surface.cash != null && conversion.converted) {
    const undeclared = !surface.declaredBaseCurrency && !surface.holdingCount ? ', 기준 통화 미선언이라 달러로 표시' : '';
    text = `합계 ${formatSurfaceMoney(surface.cash, unit)}, ${rateText}${undeclared}`;
  }
  line.textContent = text;
  line.title = conversion.appRate ? `원/달러 ${conversion.appRate.toLocaleString('en-US', { maximumFractionDigits: 2 })}원` : '';
  line.dataset.cashBasis = surface.cashHeld ? 'held' : conversion.converted ? 'converted' : balances.length ? 'single-unit' : 'empty';
}

function renderPortfolioSurface(documentRef, page, surface) {
  if (!page) return;
  page.dataset.aioPortfolioSurface = 'native';
  page.dataset.aioPortfolioSurfaceModel = surface.modelVersion;
  page.dataset.aioPortfolioSurfaceUse = surface.allowedUse || 'reference-only';
  page.dataset.aioPortfolioPromotion = surface.promotionBlocked === false ? 'eligible' : 'blocked';
  // v57.79 review: with no holdings and no cash the strip read as eight '—' placeholders; it collapses to one line.
  const heroEmpty = surface.readState === 'ready' && surface.valuationState === 'empty';
  documentRef?.getElementById('pf-hero')?.classList.toggle('is-empty', heroEmpty);
  const heroEmptyLine = documentRef?.getElementById('pf-hero-empty');
  if (heroEmptyLine) heroEmptyLine.hidden = !heroEmpty;
  setSurfaceText(documentRef, 'pf-holding-count', surface.holdingCount ? `${surface.holdingCount} 종목` : '—', surface.holdingCount || null, surface);
  setSurfaceText(documentRef, 'pf-total-pnl-pct', surface.totalPnlPct == null ? '—' : `${surface.totalPnlPct >= 0 ? '+' : ''}${surface.totalPnlPct.toFixed(1)}%`, surface.totalPnlPct, surface, surface.totalPnl == null ? 'var(--text-dim)' : surface.totalPnl >= 0 ? 'var(--green)' : 'var(--red)');
  setSurfaceText(documentRef, 'pf-daily-chg', formatSurfaceMoney(surface.dailyChange, surface.declaredBaseCurrency), surface.dailyChange, surface, surface.dailyChange == null ? 'var(--text-dim)' : surface.dailyChange >= 0 ? 'var(--green)' : 'var(--red)');
  setSurfaceText(documentRef, 'pf-daily-pct', surface.dailyPct == null ? '—' : `오늘 ${surface.dailyPct >= 0 ? '+' : ''}${surface.dailyPct.toFixed(2)}%`, surface.dailyPct, surface, surface.dailyChange == null ? 'var(--text-dim)' : surface.dailyChange >= 0 ? 'var(--green)' : 'var(--red)');
  renderCashBalances(documentRef, surface);
  setSurfaceText(documentRef, 'pf-cash-pct-hero', surface.cashPct == null ? '—' : `${surface.cashPct.toFixed(1)}%`, surface.cashPct, surface);
  // E3/P1181 (11 P11-02): 통화 상태를 표시에 드러낸다 — 혼합 통화는 환산근거가 없어 합계를 만들지
  // 않았고, 그 이유를 화면이 말해야 '값 소실'과 '의도된 보류'를 구분할 수 있다.
  // v57.84 P1864: a USD/KRW conversion may use the app's own close instead of a declared leg; the note names which.
  const fxSources = new Set((surface.conversion?.legs || []).map((leg) => leg.source === 'app-close' ? 'app' : 'declared'));
  const fxBasisLabel = fxSources.has('app') ? (fxSources.has('declared') ? '선언 rate·앱 USD/KRW 종가' : '앱 USD/KRW 종가') : '선언 rate';
  const currencyNoteBase = surface.readState !== 'ready' || !surface.holdingCount
    ? '—'
    : surface.currencyState === 'converted-with-declared-rates'
      ? `통화 환산(${fxBasisLabel}) → ${surface.baseCurrency}`
      : surface.currencyState === 'mixed-without-conversion'
        ? `통화 혼합(${(surface.declaredCurrencies || []).join('/')}) — 환산 없어 합계 보류`
        : surface.currencyState === 'declared-single' ? `통화 ${surface.baseCurrency}`
          : '통화 선택 전, 모두 같은 통화로 보고 계산';
  // E3/P1196: 원가/시세 불일치는 이제 두 갈래다 — 선언된 leg로 환산됐으면 P&L이 성립하고, 근거가
  // 없으면 예전처럼 보류한다. 화면이 둘을 구분해야 "값 소실"과 "의도된 보류"가 구분된다.
  // v57.48 expert review #23: a converted cost uses today's declared rate, not the rate on the purchase date —
  // the P&L then leaves out the currency move since purchase, and the note says so.
  const currencyHeld = (surface.costCurrencyState === 'cost-price-mismatch-held' ? ', 원가/시세 불일치 — P&L 보류'
    : surface.costCurrencyState === 'cost-price-mismatch-converted' ? `, 원가/시세 불일치 — ${fxBasisLabel}로 환산` : '')
    + (surface.conversion?.costApplied ? ', 원가는 현재 환율로 환산 — 매수 이후 환율 효과 제외' : '');
  const currencyHeldActive = (surface.currencyState === 'mixed-without-conversion' || surface.costCurrencyState === 'cost-price-mismatch-held') && surface.readState === 'ready' && !!surface.holdingCount;
  setSurfaceText(documentRef, 'pf-currency-note', currencyNoteBase === '—' ? '—' : currencyNoteBase + currencyHeld, surface.holdingCount || null, surface, currencyHeldActive ? 'var(--data-amber)' : 'var(--text-dim)');
  // Codex browser audit H50: "VIX 확인 중" stayed while every market screen showed VIX — the live quote did not
  // qualify here. The completed close (the market screens' basis) is used then, labelled with its date; and an
  // empty portfolio says what needs input instead of looking like a pending calculation.
  const vixHistory = buildCloseSeries(documentRef?.defaultView?._aioHistory || globalThis._aioHistory || [], 'vix', { through: closeBasis(documentRef?.defaultView?._aioHistory || globalThis._aioHistory || []) });
  const vixClose = vixHistory[vixHistory.length - 1] || null;
  // P1574: the VIX-to-max-exposure ladder (100/80/50/30/15 on 15/20/25/30) was a sizing instruction on
  // retired bands. The card states the volatility band (shared 18/25/32 edges) and the user's own exposure.
  const liveVix = surface.vix != null && Number.isFinite(surface.vix) ? surface.vix : null;
  const vixValue = liveVix ?? vixClose?.value ?? null;
  const band = vixBand(vixValue);
  const rule = band.blocked ? 'VIX 자료 없음'
    : liveVix != null ? `VIX ${liveVix.toFixed(1)}, ${band.label}`
      : `VIX ${vixClose.value.toFixed(1)}(${Number(vixClose.date.slice(5, 7))}/${Number(vixClose.date.slice(8, 10))} 종가), ${band.label}`;
  // v57.70 (2026-10-15 audit): "VIX 16.9 · 저변동 구간" stood while KOSPI was down 13% in five sessions. VIX is the US
  // option market's gauge; a Korean move of 5% or more over five completed sessions is named beside it.
  const historyRows = documentRef?.defaultView?._aioHistory || globalThis._aioHistory || [];
  const kospi = buildCloseSeries(historyRows, 'kospi');
  const kospiLast = kospi[kospi.length - 1] || null;
  const kospiBack = kospi.length >= 6 ? kospi[kospi.length - 6] : null;
  const kospi5 = kospiLast && kospiBack?.value > 0 ? (kospiLast.value / kospiBack.value - 1) * 100 : null;
  const krNote = kospi5 != null && Math.abs(kospi5) >= 5
    ? `, 한국은 코스피 5거래일 ${kospi5 >= 0 ? '+' : ''}${kospi5.toFixed(1)}%(${Number(kospiLast.date.slice(5, 7))}/${Number(kospiLast.date.slice(8, 10))} 종가) — VIX는 미국 시장 기준입니다` : '';
  setSurfaceText(documentRef, 'pf-exposure-rule', rule + (band.blocked ? '' : krNote), band.blocked ? null : band.value, surface);
  const current = surface.exposurePct == null ? (surface.holdingCount ? '현재 노출 —' : '보유 내역을 입력하면 계산됩니다') : `현재 노출 ${surface.exposurePct.toFixed(1)}%`;
  setSurfaceText(documentRef, 'pf-exposure-current', current, surface.exposurePct, surface, 'var(--text-dim)');
  // v57.71 (2026-10-15 audit): the volatility card led nowhere on a crash morning; the sizing and survival lessons are one
  // step away (principles J3·J4), the same research-library links the market screens use.
  const currentNode = documentRef?.getElementById('pf-exposure-current');
  if (currentNode && !documentRef.getElementById('pf-learn-links')) {
    const links = documentRef.createElement('div');
    links.id = 'pf-learn-links';
    for (const [lesson, label] of [['J3', '원리 레슨, 포지션 사이징'], ['J4', '원리 레슨, 손실과 생존']]) {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.className = 'flow-next-link';
      button.textContent = `${label} →`;
      button.addEventListener('click', () => navigateKnowledgeRoute({ root: documentRef.defaultView || globalThis, page: 'principles', params: { lesson } }));
      links.append(button);
    }
    currentNode.after(links);
  }

  const sectorElement = documentRef?.getElementById('pf-sector-breakdown');
  if (sectorElement) {
    sectorElement.replaceChildren();
    sectorElement.dataset.aioPortfolioSurfaceRenderer = 'native';
    sectorElement.dataset.sourceKind = surface.sectorBreakdown.length ? surface.sourceKind : 'unavailable';
    sectorElement.dataset.sourceLabel = surface.sectorBreakdown.length ? surface.sourceLabel : 'portfolio-sector-unavailable';
    sectorElement.dataset.operationalUse = 'reference-only';
    if (surface.sectorBreakdown.length) {
      // v57.48 expert review #24: the denominator is stated once above the bars, not on every label.
      const basisHead = documentRef.createElement('div');
      basisHead.textContent = '현금 포함 총자산 대비 비중';
      basisHead.className = 'pfp-basis';
      sectorElement.appendChild(basisHead);
      for (const sector of surface.sectorBreakdown) {
        const row = documentRef.createElement('div');
        row.className = 'pfp-sector-row';
        const label = documentRef.createElement('span');
        label.textContent = sectorLabel(sector.name);
        label.title = `${sectorLabel(sector.name)}, 현금 포함 총자산 대비`;
        label.dataset.basis = sector.basis || 'total-assets-including-cash';
        label.className = 'pfp-sector-label';
        const track = documentRef.createElement('div');
        track.className = 'pfp-sector-track';
        const bar = documentRef.createElement('div');
        bar.className = 'pfp-sector-fill';
        bar.style.width = `${Math.max(0, Math.min(100, sector.pct))}%`;
        track.appendChild(bar);
        const pct = documentRef.createElement('span');
        pct.textContent = `${sector.pct.toFixed(0)}%`;
        pct.className = 'pfp-sector-pct';
        row.append(label, track, pct);
        sectorElement.appendChild(row);
      }
    } else {
      const empty = documentRef.createElement('div');
      empty.textContent = surface.cashHeld ? '현금 합계가 보류돼 총자산 대비 섹터 비중을 계산하지 않았습니다' : surface.holdingCount ? '평가액이 확인되면 섹터 비중이 표시됩니다' : '종목을 추가하면 섹터 비중이 표시됩니다'; // v57.81
      empty.className = 'pfp-sector-empty';
      sectorElement.appendChild(empty);
    }
  }
}

function tableCell(documentRef, headerId, value, className = 'pfp-cell') {
  const cell = documentRef.createElement('td');
  cell.setAttribute('headers', headerId);
  cell.className = className;
  cell.textContent = value;
  return cell;
}

// v58.56 (re-audit #11): ten columns (오늘 joined). At ≥1280px the table is compact — 종목 · 손익 · 수익률 · 오늘 · 비중 —
// and 수량·매수 단가·현재가·목표가·관리 open in a per-row disclosure (CSS hides those cells there; every cell stays in the
// DOM with its `headers` id, so readers and the vault e2e still find them). Below 1280px the full table is unchanged.
const PORTFOLIO_TABLE_COLUMNS = 10;
const expandedHoldings = new Set();
function holdingDetailRow(documentRef, { symbol, holding, items, detailId, expanded }) {
  const row = documentRef.createElement('tr');
  row.className = 'pfp-detail';
  row.id = detailId;
  row.hidden = !expanded;
  const cell = documentRef.createElement('td');
  cell.colSpan = PORTFOLIO_TABLE_COLUMNS;
  const list = documentRef.createElement('dl');
  list.className = 'pfp-detail-list';
  for (const [label, value] of items) {
    const item = documentRef.createElement('div');
    const term = documentRef.createElement('dt');
    term.textContent = label;
    const desc = documentRef.createElement('dd');
    desc.textContent = value;
    item.append(term, desc);
    list.append(item);
  }
  if (holding?.memo) {
    const memo = documentRef.createElement('p');
    memo.className = 'pfp-detail-memo';
    memo.textContent = `메모, ${holding.memo}`;
    cell.append(list, memo);
  } else cell.append(list);
  const actions = documentRef.createElement('div');
  actions.className = 'pfp-detail-actions';
  [['차트', '_aioTechnicalTicker'], ['수정', '_aioEditPosition'], ['삭제', '_aioRemovePosition']].forEach(([label, action]) => {
    const button = documentRef.createElement('button');
    button.type = 'button';
    button.setAttribute('data-action', action);
    button.setAttribute('data-arg', symbol);
    button.setAttribute('data-stop', '1');
    button.setAttribute('aria-label', `${symbol} ${label}`);
    button.className = 'pfp-manage-btn';
    button.textContent = label;
    actions.append(button);
  });
  cell.append(actions);
  row.append(cell);
  return row;
}

function renderPortfolioTable(documentRef, page, state, surface) {
  const tbody = page?.querySelector?.('#pf-positions-tbody');
  if (!tbody) return;
  const holdings = Array.isArray(state?.holdings) ? state.holdings : [];
  const sourceHoldings = holdings.filter((entry) => entry?.symbol || entry?.ticker);
  const rows = surface.rows.map((item, index) => {
    const holding = sourceHoldings[index];
    const { symbol, shares, avgCost, price, value, cost: costValue } = item;
    const pnl = value != null && costValue != null ? value - costValue : null;
    const pnlPct = pnl != null && costValue > 0 ? pnl / costValue * 100 : null;
    return { holding, symbol, shares, avgCost, price, value, costValue, pnl, pnlPct, sourceKind: item.sourceKind, closeDate: item.closeDate || null, dailyPct: item.dailyPct ?? null, dailyPctEligible: item.dailyPctEligible === true };
  });
  const totalValue = surface.positionValue;
  tbody.replaceChildren();
  tbody.dataset.aioPortfolioTableRenderer = 'native';
  tbody.setAttribute('data-source-kind', rows.length ? 'portfolio-state' : 'unavailable');
  tbody.setAttribute('data-source-label', rows.length ? 'native-portfolio-slice' : 'portfolio-state-unavailable');
  tbody.setAttribute('data-operational-use', 'reference-only');
  // P1591 (P03): nothing to delete, so the destructive control is not offered as active.
  const clearAll = documentRef.querySelector?.('[data-action="clearAllPositions"]');
  if (clearAll) { clearAll.disabled = !rows.length; clearAll.style.opacity = rows.length ? '' : '0.4'; }
  if (!rows.length) {
    const row = documentRef.createElement('tr');
    row.className = 'pf-empty-state';
    const cell = documentRef.createElement('td');
    cell.colSpan = PORTFOLIO_TABLE_COLUMNS;
    cell.className = 'pfp-empty';
    const heading = documentRef.createElement('div');
    heading.textContent = '포트폴리오가 비어 있습니다';
    heading.className = 'pfp-empty-title';
    const body = documentRef.createElement('div');
    // v57.54: one line on what appears, no how-to prose.
    body.textContent = '종목을 추가하면 변동성·섹터 쏠림·시장 상태와의 연결이 여기에 나타납니다.';
    const addButton = documentRef.createElement('button');
    addButton.className = 'aio-btn-table primary pfp-add';
    addButton.setAttribute('data-action', '_aioTogglePortfolioEntry');
    addButton.textContent = '첫 종목 추가';
    const privacy = documentRef.createElement('div');
    privacy.textContent = '보유 내역은 이 브라우저에만 저장됩니다. AI 분석을 직접 누를 때만 종목·섹터·비중·수익률이 전송됩니다(수량·매수가·메모 제외). PIN을 설정하면 암호화해 저장합니다.'; // P1593 (F108): same scope as the page header
    privacy.className = 'pfp-privacy'; // v57.91 (visual audit): one ~850px grey line became a readable block
    cell.append(heading, body, addButton, privacy);
    row.appendChild(cell);
    tbody.appendChild(row);
    return;
  }
  rows.forEach((rowData) => {
    const { holding, symbol, shares, avgCost, price, value, pnl, pnlPct } = rowData;
    const row = documentRef.createElement('tr');
    row.className = 'pfp-row';
    row.setAttribute('data-action', 'showTicker');
    row.setAttribute('data-arg', symbol);
    const tickerCell = documentRef.createElement('td');
    tickerCell.setAttribute('headers', 'pf-th-ticker');
    tickerCell.className = 'pfp-ticker';
    const ticker = documentRef.createElement('b');
    ticker.textContent = symbol;
    ticker.style.color = 'var(--text-primary)';
    tickerCell.appendChild(ticker);
    if (holding?.memo) {
      const memo = documentRef.createElement('div');
      memo.textContent = String(holding.memo);
      memo.className = 'pfp-memo';
      tickerCell.appendChild(memo);
      // v58.56: the compact desktop table shows a quiet 메모 mark; the text is in the row's 상세.
      const memoChip = documentRef.createElement('span');
      memoChip.className = 'sx-chip sx-chip--sm sx-chip--neutral pfp-memo-chip';
      memoChip.textContent = '메모';
      memoChip.title = String(holding.memo);
      tickerCell.appendChild(memoChip);
    }
    const detailId = `pf-detail-${String(symbol).replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const expanded = expandedHoldings.has(symbol);
    const more = documentRef.createElement('button');
    more.type = 'button';
    more.className = 'pfp-more';
    more.textContent = '상세';
    more.setAttribute('aria-expanded', String(expanded));
    more.setAttribute('aria-controls', detailId);
    more.setAttribute('aria-label', `${symbol} 수량·단가·관리 보기`);
    more.addEventListener('click', (event) => {
      event.stopPropagation(); // the row itself opens the stock page
      const open = !expandedHoldings.has(symbol);
      if (open) expandedHoldings.add(symbol); else expandedHoldings.delete(symbol);
      more.setAttribute('aria-expanded', String(open));
      const detail = documentRef.getElementById(detailId);
      if (detail) detail.hidden = !open;
    });
    tickerCell.appendChild(more);
    row.appendChild(tickerCell);
    // LC-45: the table printed `$` for every row while the domain already declares each row's price
    // and cost currency. Print the declared code instead, so a KRW/mixed row is not relabelled as USD.
    const baseCurrency = String(surface?.baseCurrency || 'USD').trim().toUpperCase();
    // Codex browser audit H49: the P&L column is summed in the base currency; its header names it.
    const pnlHeader = documentRef.getElementById('pf-th-pnl');
    if (pnlHeader) pnlHeader.textContent = `손익 (${baseCurrency})`;
    const priceCurrency = String(holding?.currency || '').trim().toUpperCase() || baseCurrency;
    const costCurrency = String(holding?.costCurrency || holding?.currency || '').trim().toUpperCase() || baseCurrency;
    const money = (amount, currency) => (amount == null
      ? '—'
      : `${currency === 'USD' ? '$' : currency === 'KRW' ? '₩' : `${currency} `}${Math.abs(amount).toLocaleString('en-US', currency === 'KRW' ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`); // v57.55 B4-F14: won has no decimals
    row.appendChild(tableCell(documentRef, 'pf-th-qty', shares == null ? '—' : String(shares)));
    const costCell = tableCell(documentRef, 'pf-th-cost', money(avgCost, costCurrency));
    costCell.title = `원가 통화 ${holding?.costCurrency ? costCurrency : `${costCurrency}(추정)`}`;
    row.appendChild(costCell);
    // v57.81: one failure state for a holding whose quote and close both came back empty (any listed symbol is requested).
    const priceCellNode = tableCell(documentRef, 'pf-th-price', price == null ? '가격 없음' : money(price, priceCurrency));
    priceCellNode.style.color = price == null ? 'var(--text-muted)' : 'var(--text-primary)';
    const closeDated = rowData.sourceKind === 'completed-close' && rowData.closeDate ? `, 실시간 시세 대신 ${rowData.closeDate} 종가` : '';
    priceCellNode.title = price == null ? '시세와 종가를 받지 못했습니다, 총자산과 손익 합계에서 뺐습니다' : `시세 통화 ${priceCurrency}${closeDated}`;
    if (price == null) priceCellNode.dataset.priceState = 'missing';
    row.appendChild(priceCellNode);
    const pnlCell = tableCell(documentRef, 'pf-th-pnl', pnl == null ? '—' : `${pnl >= 0 ? '+' : '-'}${money(Math.abs(pnl), baseCurrency)}`, 'pfp-cell is-bold');
    if (pnl == null) pnlCell.title = '손익 보류, 원가/시세 통화 불일치 또는 시세 미수신';
    pnlCell.style.color = pnl == null ? 'var(--text-muted)' : pnl >= 0 ? 'var(--green)' : 'var(--red)';
    row.appendChild(pnlCell);
    const pctCell = tableCell(documentRef, 'pf-th-pct', pnlPct == null ? '—' : `${pnlPct >= 0 ? '+' : ''}${pnlPct.toFixed(1)}%`, 'pfp-cell is-bold');
    pctCell.style.color = pnlPct == null ? 'var(--text-muted)' : pnlPct >= 0 ? 'var(--green)' : 'var(--red)';
    row.appendChild(pctCell);
    // v58.56: today's move of the holding — only from a live quote with a stated basis (the hero's 오늘 uses the same rule).
    const dayPct = rowData.dailyPctEligible && Number.isFinite(rowData.dailyPct) ? rowData.dailyPct : null;
    const dayCell = tableCell(documentRef, 'pf-th-day', dayPct == null ? '—' : `${dayPct >= 0 ? '+' : ''}${dayPct.toFixed(2)}%`, 'pfp-cell');
    dayCell.style.color = dayPct == null ? 'var(--text-muted)' : dayPct >= 0 ? 'var(--green)' : 'var(--red)';
    if (dayPct == null) dayCell.title = rowData.sourceKind === 'completed-close' ? `${rowData.closeDate || ''} 종가로 평가 중 — 오늘 변화는 실시간 시세를 받으면 표시합니다`.trim() : '실시간 시세를 받으면 표시합니다';
    row.appendChild(dayCell);
    // P1176 (22 PFR01): `finite(0)`은 0이라 미설정 표시를 통과하지 못했다. legacy 테이블은 이미
    // `target > 0`을 "설정됨"으로 정의하므로(js/aio-workspace.js), native도 같은 정의를 쓴다 —
    // 저장된 0은 옛 "빈 칸" sentinel이고, $0.00 + -100% 잠재수익으로 그리지 않는다.
    const targetValue = finite(holding?.target);
    const targetSet = targetValue != null && targetValue > 0 ? targetValue : null;
    // P1449: the target is entered in the position's own currency (cost currency when declared,
    // price currency otherwise) — a KRW target must not print with `$`.
    const targetCurrency = costCurrency || priceCurrency;
    const targetCell = tableCell(documentRef, 'pf-th-target', targetSet == null ? '미설정' : money(targetSet, targetCurrency));
    if (targetSet != null && price != null && price > 0 && targetCurrency === priceCurrency) {
      const upside = (targetSet - price) / price * 100;
      const upsideNode = documentRef.createElement('div');
      upsideNode.textContent = `${upside >= 0 ? '+' : ''}${upside.toFixed(1)}%`;
      upsideNode.className = 'pfp-upside';
      upsideNode.style.color = upside >= 0 ? 'var(--green)' : 'var(--red)';
      targetCell.appendChild(upsideNode);
    }
    row.appendChild(targetCell);
    // 개편 v2 (3g): the weight reads as a bar beside its number (same share of the stock part).
    const weightPct = totalValue > 0 && value != null ? value / totalValue * 100 : null;
    const weightCell = tableCell(documentRef, 'pf-th-weight', '', 'pfp-cell is-bold is-sans');
    if (weightPct == null) weightCell.textContent = '—';
    else {
      const wrap = documentRef.createElement('span');
      wrap.className = 'pf-weight-cell';
      const bar = documentRef.createElement('span');
      bar.className = 'pf-weight-bar';
      bar.setAttribute('aria-hidden', 'true');
      const fill = documentRef.createElement('span');
      fill.style.width = `${Math.max(1, Math.min(100, weightPct)).toFixed(1)}%`;
      bar.append(fill);
      wrap.append(bar, documentRef.createTextNode(`${weightPct.toFixed(1)}%`));
      weightCell.append(wrap);
      weightCell.title = '주식 평가액 중 비중';
    }
    row.appendChild(weightCell);
    const manageCell = documentRef.createElement('td');
    manageCell.setAttribute('headers', 'pf-th-manage');
    manageCell.className = 'pfp-manage';
    [['차트', '_aioTechnicalTicker'], ['수정', '_aioEditPosition'], ['삭제', '_aioRemovePosition']].forEach(([label, action]) => {
      const button = documentRef.createElement('button');
      button.setAttribute('data-action', action);
      button.setAttribute('data-arg', symbol);
      button.setAttribute('data-stop', '1');
      button.setAttribute('aria-label', `${symbol} ${label}`);
      button.title = label;
      button.className = 'pfp-manage-btn';
      button.textContent = label;
      manageCell.appendChild(button);
    });
    row.appendChild(manageCell);
    tbody.appendChild(row);
    tbody.appendChild(holdingDetailRow(documentRef, {
      symbol, holding, detailId, expanded,
      items: [
        ['수량', shares == null ? '—' : String(shares)],
        ['매수 단가', money(avgCost, costCurrency)],
        ['현재가', `${price == null ? '가격 없음' : money(price, priceCurrency)}${closeDated ? ` (${rowData.closeDate} 종가)` : ''}`],
        ['목표가(내 메모)', targetSet == null ? '미설정' : money(targetSet, targetCurrency)]
      ]
    }));
  });
}

function renderPortfolioChart({ root, page, surface, charts }) {
  const canvas = page?.querySelector?.('#pf-position-donut');
  if (!canvas) return;
  const holdings = surface.positionValue == null ? [] : surface.rows.filter((item) => item.value > 0);
  const total = holdings.reduce((sum, item) => sum + item.value, 0);
  const ChartConstructor = root?.Chart;
  const unavailable = !holdings.length || !(total > 0) || typeof ChartConstructor !== 'function';
  const signature = holdings.map((item) => `${item.symbol}:${item.value}`).join('|');
  canvas.dataset.aioPortfolioChartRenderer = 'native';
  canvas.dataset.sourceKind = unavailable ? 'unavailable' : 'portfolio-state';
  canvas.dataset.sourceLabel = unavailable ? 'portfolio-chart-input-unavailable' : 'native:portfolio-state';
  canvas.dataset.operationalUse = 'reference-only';
  const loading = page.querySelector('#pf-donut-legend');
  if (unavailable) {
    charts.destroy('pf-position-donut');
    // P1592 (F16): a held chart shows no slices or totals — clear anything drawn before this renderer owned the canvas.
    try { canvas.getContext?.('2d')?.clearRect(0, 0, canvas.width, canvas.height); } catch (_) {}
    if (loading) loading.textContent = !surface.rows?.length ? '종목을 추가하면 비중이 표시됩니다'
      : !holdings.length ? '시세를 받으면 평가액 기준 비중을 그립니다 — 매수 원가로 대신 그리지 않습니다'
        : '차트 모듈 대기, 차트 보류';
    return;
  }
  if (charts.get('pf-position-donut')?.signature === signature) return;
  charts.destroy('pf-position-donut');
  try {
    const colors = ['#1b1a17', '#544f46', '#978365', '#696256', '#a39073', '#3b352b', '#b9a88d'];
    const chart = new ChartConstructor(canvas, {
      type: 'doughnut',
      data: { labels: holdings.map((item) => item.symbol), datasets: [{ data: holdings.map((item) => item.value), backgroundColor: holdings.map((_, index) => colors[index % colors.length]), borderColor: '#faf9f2', borderWidth: 1 }] },
      options: { responsive: false, maintainAspectRatio: false, cutout: '55%', plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => ` ${context.label}: ${(context.parsed / total * 100).toFixed(1)}%` } } } }
    });
    charts.set('pf-position-donut', { chart, signature });
    // P1599 (F108): weights as a sorted bar list (bars compare lengths better than donut slices); the donut stays as the overview.
    if (loading) {
      const doc = loading.ownerDocument;
      const sorted = [...holdings].sort((a, b) => b.value - a.value);
      loading.replaceChildren(...sorted.slice(0, 8).map((item) => {
        const share = item.value / total * 100;
        const row = doc.createElement('div');
        row.className = 'pf-weight-row';
        const name = doc.createElement('span');
        name.textContent = item.symbol;
        const track = doc.createElement('span');
        track.className = 'pf-weight-track';
        const bar = doc.createElement('span');
        bar.className = 'pf-weight-bar';
        bar.style.width = `${Math.max(1, share).toFixed(1)}%`;
        track.append(bar);
        const value = doc.createElement('span');
        value.textContent = `${share.toFixed(1)}%`;
        row.append(name, track, value);
        return row;
      }));
      if (sorted.length > 8) loading.append(Object.assign(doc.createElement('div'), { className: 'pf-weight-more', textContent: `외 ${sorted.length - 8}종목` }));
    }
  } catch (_) {
    charts.destroy('pf-position-donut');
    if (loading) loading.textContent = '포트폴리오 차트 런타임 실패, 차트 보류';
  }
}

function render({ root, documentRef, store, charts }) {
  const state = selectPortfolioState(store.getState());
  const page = documentRef?.getElementById('page-portfolio');
  if (page) {
    page.dataset.aioArchitectureRoute = 'portfolio';
    page.dataset.aioArchitectureSlice = 'portfolio';
    page.dataset.aioArchitectureStatus = state?.status || 'unavailable';
    page.dataset.aioArchitectureRenderer = 'native';
  }
  const liveData = root?._liveData || {};
  const bySymbol = screenerRowsBySymbol(root, store);
  // v57.81: cash balances in other currencies convert with the app's own published USD/KRW close (date in the label).
  const cashFx = appUsdKrwClose(root?._aioHistory || globalThis._aioHistory || []);
  const onDemand = withOnDemandHoldings(root, bySymbol, state?.holdings);
  if (root) root._aioPortfolioOnDemandRows = [...onDemand.values()].map((record) => record.row); // v57.81: 포트폴리오 해석 rows
  const surface = derivePortfolioSurface({ state, liveData: liveDataFor(root, state?.holdings, liveData), vix: liveData?.['^VIX'] || null, sectorOf: screenerSectorOf(bySymbol), closeOf: screenerCloseOf(root, bySymbol, onDemand), cashFx });
  requestHoldingQuotes(root, surface.rows);
  if (root) root._aioPortfolioSurface = surface; // P1445: legacy exposure/stress panels share these base-currency values
  if (root) root._aioPortfolioSectorLabel = portfolioSectorLabel; // v57.50 review R1: one sector vocabulary for the legacy exposure panel
  // #12: the legacy AI workbench sends these rows (ticker·sector·weight·return in the base currency, with the date).
  if (root) root._aioPortfolioAiRows = () => portfolioRowsForAI(root._aioPortfolioSurface, { sectorOf: (symbol) => (Array.isArray(root.SCREENER_DB) ? root.SCREENER_DB : []).find((row) => String(row?.sym || '').toUpperCase() === symbol)?.sector || null });
  renderPortfolioSurface(documentRef, page, surface);
  renderPortfolioHero(documentRef, surface);
  renderPortfolioStatus(documentRef, state, surface);
  renderPortfolioTable(documentRef, page, state, surface);
  renderPortfolioChart({ root, page, surface, charts });
  const checks = renderPortfolioChecks(documentRef, root, surface);
  renderPortfolioLens({ documentRef, root, surface, checks, sectorLabel: portfolioSectorLabel }); // 개편 v2 (3g)
  renderPortfolioRead({ documentRef, root, surface }); // P1438
  renderTradeJournal({ documentRef, root, surface }); // v58.52
}

// P1418: 점검 — only rules with a published default carry a verdict; the rest are shares.
const CHECK_TONE = Object.freeze({ ok: ['양호', 'favorable'], attention: ['주의', 'burden'], info: ['참고', 'neutral'], unknown: ['측정 안 함', 'unknown'] });
function renderPortfolioChecks(documentRef, root, surface) {
  const host = documentRef?.getElementById('pf-checks');
  if (!host) return null;
  const universe = Array.isArray(root?.SCREENER_DB) ? root.SCREENER_DB : [];
  const rowOf = (symbol) => universe.find((row) => String(row?.sym || '').toUpperCase() === symbol) || null;
  const result = derivePortfolioChecks({
    surface,
    // Sector ETFs (XLE …) carry index 'ETF' with their real sector; broad ETFs carry sector 'ETF'.
    // v57.81: an out-of-universe US listing takes its type from the listing directory / chart instrument type.
    assetTypeOf: (symbol) => { const row = rowOf(symbol); if (row) return row.index === 'ETF' || row.sector === 'ETF' ? 'ETF' : '개별 주식'; if (/\.(KS|KQ)$/.test(symbol)) return '개별 주식'; const record = root?._aioOnDemandSymbol?.(symbol); return record?.status === 'ready' ? (record.etf ? 'ETF' : '개별 주식') : null; },
    sectorOf: (symbol) => { const row = rowOf(symbol); return row ? (row.sector === 'ETF' ? '광범위 ETF' : row.sector) : null; }
  });
  const el = (tag, text, className) => { const node = documentRef.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  host.replaceChildren(el('h2', '포트폴리오 점검', 'briefing-h2'));
  host.dataset.aioPortfolioChecksRenderer = 'native';
  // Audit 2026-10-14: an empty portfolio shows one empty state (the holdings table); a currency hold is still explained.
  host.hidden = result.status !== 'current' && result.reason !== 'currency-unconverted';
  if (result.status !== 'current') {
    host.append(el('p', result.reason === 'currency-unconverted' ? '통화가 다른 종목이 섞여 있고 환율이 선언되지 않아, 비중을 한 통화로 맞출 수 없습니다. 포트폴리오 설정에서 기준 통화와 환율을 선언하세요.' : '평가액이 있는 포지션을 추가하면 점검이 표시됩니다.', 'briefing-empty'));
    return result;
  }
  host.append(el('p', `투자금 ${result.currency ? `${result.currency} ` : ''}기준 비중${result.excluded ? `, 평가액이 없는 ${result.excluded}종목 제외` : ''}, 한 종목은 내부 구간(10~25% 참고, 25% 초과 주의), 한 통화는 공개 기본값으로 판정하고 나머지는 참고 비중으로 표시`, 'theme-strength-basis'));
  const list = el('div', null, 'pf-checks-list');
  for (const check of result.checks) {
    const card = el('section', null, 'pf-check');
    card.dataset.check = check.id;
    if (check.source) card.title = check.source; // #25: product/rule reference on hover, not in the body
    const head = el('div', null, 'pf-check-head');
    const tone = CHECK_TONE[check.status] || CHECK_TONE.info;
    head.append(el('span', check.label, 'pf-check-label'), el('span', tone[0], `regime-state is-${tone[1]}`));
    card.append(head, el('div', check.value, 'pf-check-value'), el('p', check.detail, 'pf-check-detail'), el('span', check.basis, 'pf-check-basis'));
    list.append(card);
  }
  host.append(list);
  return result;
}

export function createPortfolioPage({ root = globalThis, documentRef, store } = {}) {
  return {
    route: 'portfolio',
    mount() {
      const bag = createResourceBag();
      portfolioMounted = true;
      bag.add(() => { portfolioMounted = false; });
      const charts = createChartRegistry({ maxCanvasHeight: 260 });
      bag.add(charts.dispose);
      const renderNow = () => render({ root, documentRef, store, charts });
      renderNow();
      bag.add(installTradeJournal({ documentRef, root, getSurface: () => root?._aioPortfolioSurface || null }));
      // v57.50 I05: what a research document sent the reader here to check (each entry to this route mounts again).
      renderKnowledgeArrival({ documentRef, root, routeId: 'portfolio' });
      bag.add(() => clearKnowledgeArrival({ documentRef, routeId: 'portfolio' }));
      bag.add(subscribeToSlices(store, ['portfolio'], renderNow));
      const eventTarget = documentRef || globalThis;
      eventTarget?.addEventListener?.('aio:liveQuotes', renderNow);
      bag.add(() => eventTarget?.removeEventListener?.('aio:liveQuotes', renderNow));
      // v57.81: the cash total converts with the published USD/KRW close, which arrives with the history (window event).
      root?.addEventListener?.('aio:historyLoaded', renderNow);
      bag.add(() => root?.removeEventListener?.('aio:historyLoaded', renderNow));
      // 개편 v2 (3g): β waits for the holdings' price records the legacy stress panel gathers.
      root?.addEventListener?.('aio:portfolioStressInput', renderNow);
      bag.add(() => root?.removeEventListener?.('aio:portfolioStressInput', renderNow));
      // v57.81: an out-of-universe holding's on-demand row arrives after the first render.
      const onOnDemand = (event) => { const symbol = String(event?.detail?.symbol || '').toUpperCase(); if ((selectPortfolioState(store.getState())?.holdings || []).some((holding) => String(holding?.symbol || holding?.ticker || '').toUpperCase() === symbol)) renderNow(); };
      eventTarget?.addEventListener?.('aio:onDemandSymbol', onOnDemand);
      bag.add(() => eventTarget?.removeEventListener?.('aio:onDemandSymbol', onOnDemand));
      const page = documentRef?.getElementById('page-portfolio');
      let suppliedMaterialBridge = page?.querySelector?.('[data-aio-supplied-material-route="portfolio"]') || null;
      if (page && !suppliedMaterialBridge) {
        suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
          routeId: 'portfolio',
          heading: '포트폴리오, 노출·기관 시차·AI 자본구조'
        });
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge?.remove?.());
      }
      const table = page?.querySelector?.('#pf-positions-tbody');
      if (page) page.dataset.aioPortfolioSurface = 'native';
      if (page) page.dataset.aioPortfolioChartRenderer = 'native';
      if (table) table.dataset.aioPortfolioTableRenderer = 'native';
      ['pf-total-value', 'pf-total-pnl'].forEach((id) => {
        const element = documentRef?.getElementById(id);
        if (element) element.setAttribute('data-aio-portfolio-hero-renderer', 'native');
      });
      bag.add(() => {
        if (table?.dataset.aioPortfolioTableRenderer === 'native') delete table.dataset.aioPortfolioTableRenderer;
        const chartCanvas = documentRef?.getElementById('pf-position-donut');
        if (chartCanvas?.dataset.aioPortfolioChartRenderer === 'native') {
          delete chartCanvas.dataset.aioPortfolioChartRenderer;
          delete chartCanvas.dataset.sourceKind;
          delete chartCanvas.dataset.sourceLabel;
          delete chartCanvas.dataset.operationalUse;
        }
        ['pf-total-value', 'pf-total-pnl'].forEach((id) => {
          const element = documentRef?.getElementById(id);
          if (element?.dataset.aioPortfolioHeroRenderer === 'native') delete element.dataset.aioPortfolioHeroRenderer;
        });
        if (page?.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (page?.dataset.aioArchitectureSlice === 'portfolio') delete page.dataset.aioArchitectureSlice;
        if (page?.dataset.aioPortfolioSurface === 'native') delete page.dataset.aioPortfolioSurface;
        if (page?.dataset.aioPortfolioChartRenderer === 'native') delete page.dataset.aioPortfolioChartRenderer;
        if (page?.dataset.aioPortfolioSurfaceModel) delete page.dataset.aioPortfolioSurfaceModel;
        if (page?.dataset.aioPortfolioSurfaceUse) delete page.dataset.aioPortfolioSurfaceUse;
        if (page?.dataset.aioPortfolioPromotion) delete page.dataset.aioPortfolioPromotion;
        page?.querySelectorAll?.('[data-aio-portfolio-surface-renderer="native"], [data-aioPortfolioSurfaceRenderer="native"]')?.forEach((element) => {
          delete element.dataset.aioPortfolioSurfaceRenderer;
          delete element.dataset.sourceKind;
          delete element.dataset.sourceLabel;
          delete element.dataset.operationalUse;
          delete element.dataset.observedAt;
        });
      });
      return () => bag.dispose();
    }
  };
}
