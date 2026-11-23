import { createResourceBag } from '../../app/lifecycle.js';
import { screenerRowsState, refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { MACRO_HISTORY } from '../../data/artifact-registry.js';
import { selectPortfolioState } from '../../state/selectors/portfolio.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { derivePortfolioSurface } from '../../domain/portfolio/surface.js';
import { appUsdKrwClose } from '../../domain/portfolio/cash.js';
import { derivePortfolioChecks } from '../../domain/portfolio/checks.js';
import { HOLDING_BAND_BASIS } from '../../domain/portfolio/concentration-bands.js';
import { renderPortfolioRead, renderPortfolioLens } from '../components/portfolio-read.js';
import { renderPortfolioCriteria, renderThesisCheck } from '../components/portfolio-checklist.js';
import { portfolioRowsForAI, portfolioSectorLabel } from '../../domain/portfolio/portfolio-read.js';
import { clearKnowledgeArrival, renderKnowledgeArrival } from '../components/knowledge-arrival.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { renderTradeJournal, installTradeJournal } from '../panels/portfolio-trade-journal.js';
import { renderPortfolioValueTrend } from '../components/portfolio-value-trend.js';
import { renderPortfolioExposureBar } from '../components/portfolio-exposure-bar.js';
import { installPlanCheck } from '../components/portfolio-plan-check.js';
import { paintCashBox } from '../panels/portfolio-cash-entry.js';
import { paintRiskFreeFill } from '../panels/portfolio-rf-fill.js';
import { marketInterpretation, readMarketRegime } from '../../data/selectors/interpretation.js';
import { signedText, signMark, directionColor, readNumber as finite } from '../../domain/shared/number.js';
import { isIsoDay } from '../../domain/shared/session-date.js';

export function renderPortfolioStatus(documentRef, state, surface, { pricesLoading = false } = {}) {
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
  } else if ((valuation === 'partial' || valuation === 'unavailable') && pricesLoading && (surface?.holdingCount ?? 0) > 0) {
    element.textContent = `${surface?.valuedHoldingCount ?? 0}/${surface?.holdingCount ?? 0}종목 평가, 나머지 종목의 종가를 불러오는 중입니다. 받으면 총자산과 손익을 계산합니다`;
  } else if (valuation === 'partial') {
    element.textContent = `${surface?.valuedHoldingCount ?? 0}/${surface?.holdingCount ?? 0}종목 평가, 가격 없음 ${(surface?.holdingCount ?? 0) - (surface?.valuedHoldingCount ?? 0)}종목이 있어 총자산과 손익은 모든 종목 가격을 받은 뒤 표시합니다${closeNote(surface)}`;
  } else if (valuation === 'mixed-currency') {
    // Each unit's own total, never one sum across units; the base currency setting adds them up.
    const parts = (surface.currencySubtotals || []).map((row) => (row.value != null ? `${CURRENCY_WORD[row.currency] || row.currency} ${formatMoney(row.value, row.currency)}`
      : `${CURRENCY_WORD[row.currency] || row.currency} ${row.valuedCount}/${row.holdingCount}종목 가격`));
    const appFxCovers = (surface.currencySubtotals || []).every((row) => row.currency === 'USD' || row.currency === 'KRW');
    element.textContent = `통화별 평가 ${parts.join(' · ')}, ${appFxCovers ? '기준 통화를 정하면 원/달러 종가로 합산합니다' : '기준 통화와 환율을 정하면 합산합니다'}${closeNote(surface)}`;
  } else if (valuation === 'unavailable' && readState === 'ready' && (surface?.holdingCount ?? 0) > 0) {
    element.textContent = `${surface.holdingCount}종목 모두 가격 없음, 가격을 받으면 총자산과 손익을 계산합니다`;
  } else if (valuation === 'complete') {
    element.textContent = `${surface?.holdingCount ?? 0}종목 평가 완료${surface?.cash == null && !surface?.cashHeld ? ', 현금 미입력 — 총자산은 주식 평가액' : ''}${closeNote(surface)}`;
  } else {
    element.textContent = '포트폴리오 데이터 수신 대기';
  }
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

const CURRENCY_WORD = Object.freeze({ USD: '달러', KRW: '원화', JPY: '엔화', EUR: '유로' });
// The units the holdings are in; declaredCurrencies alone was empty and printed "통화 혼합()".
export const heldCurrencyList = (surface) => [...new Set([...(surface?.declaredCurrencies || []), ...(surface?.heldCurrencies || [])])].join('/');
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
  const totalValue = surface.valuationState === 'cash-only' || surface.valuationState === 'complete' ? surface.totalAssets ?? (surface.valuationState === 'complete' && surface.cash == null && !surface.cashHeld ? surface.positionValue ?? null : null) : null;
  const totalPnl = surface.valuationState === 'complete' ? surface.totalPnl : null;
  if (valueElement) {
    valueElement.textContent = formatMoney(totalValue, surface.valuationCurrency || surface.declaredBaseCurrency || 'USD');
    valueElement.setAttribute('data-aio-portfolio-hero-renderer', 'native');
    valueElement.setAttribute('data-source-kind', totalValue == null ? 'unavailable' : 'portfolio-state');
    valueElement.setAttribute('data-source-label', totalValue == null ? 'portfolio-value-unavailable' : 'native-portfolio-totals');
    valueElement.setAttribute('data-operational-use', 'reference-only');
  }
  if (pnlElement) {
    pnlElement.textContent = totalPnl == null ? '—' : `${signMark(totalPnl, 0)}${formatMoney(totalPnl, surface.valuationCurrency || surface.declaredBaseCurrency || 'USD')}`;
    pnlElement.style.color = totalPnl == null ? 'var(--color-text-secondary)' : directionColor(totalPnl, 0);
    pnlElement.setAttribute('data-aio-portfolio-hero-renderer', 'native');
    pnlElement.setAttribute('data-source-kind', totalPnl == null ? 'unavailable' : 'portfolio-state');
    pnlElement.setAttribute('data-source-label', totalPnl == null ? 'portfolio-pnl-unavailable' : 'native-portfolio-totals');
    pnlElement.setAttribute('data-operational-use', 'reference-only');
  }
}

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

const closeField = (row) => finite(row?._valuationPrice ?? row?._valuationPePrice ?? row?._valuationPbPrice ?? row?.valuationPrice ?? row?.pePrice);
function screenerRowsBySymbol(root, store) {
  const sources = [];
  try { sources.push(store?.getState?.()?.screener?.rows); } catch (_) { /* unreadable store */ }
  try { sources.push(typeof root?._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() : null); } catch (_) { /* legacy reader failed */ }
  sources.push(root?.SCREENER_DB);
  const map = new Map();
  for (const rows of sources) {
    if (!Array.isArray(rows)) continue;
    for (const row of rows) {
      const key = String(row?.sym || '').toUpperCase();
      if (!key) continue;
      const held = map.get(key);
      if (!held || (!(closeField(held) > 0) && closeField(row) > 0)) map.set(key, row);
    }
  }
  return map;
}
const ON_DEMAND_HOLDING_REQUESTS = 8;
function withOnDemandHoldings(root, bySymbol, holdings) {
  const records = new Map();
  if (typeof root?._aioOnDemandSymbol !== 'function') return records;
  let requested = 0;
  for (const holding of Array.isArray(holdings) ? holdings : []) {
    const symbol = String(holding?.symbol || holding?.ticker || '').trim().toUpperCase();
    if (!symbol || records.has(symbol) || bySymbol.has(symbol) || /^(?:\d{6}|.*\.K[SQ])$/.test(symbol)) continue;
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
    const row = bySymbol.get(String(symbol || '').toUpperCase());
    const price = closeField(row);
    const own = onDemand.get(String(symbol || '').toUpperCase())?.lastClose;
    if ((price == null || price <= 0) && own) return { price: own.price, date: own.date };
    if (price != null && price > 0) return { price, date: row?.factorSessionDate || null, changePct: finite(row?.ret1d) };
    return null;
  };
}
let holdingQuoteSignature = '';
let holdingQuoteRequestedAt = 0;
const unquoted = (root, symbols) => symbols.filter((symbol) => !(Number(root?._liveData?.[symbol]?.price) > 0));
let portfolioMounted = false;
let rerenderPortfolio = null;
let crossTabChanged = false;
let crossTabListening = false;
function paintCrossTabNotice(documentRef, root) {
  const page = documentRef?.getElementById('page-portfolio');
  if (!crossTabChanged || !page || documentRef.getElementById('pf-crosstab-note')) return;
  const note = documentRef.createElement('div');
  note.id = 'pf-crosstab-note';
  note.className = 'pf-crosstab-note';
  note.setAttribute('role', 'status');
  const button = documentRef.createElement('button');
  button.type = 'button';
  button.className = 'aio-btn-table';
  button.textContent = '다시 불러오기';
  button.addEventListener('click', () => root?.location?.reload?.());
  note.append(documentRef.createTextNode('다른 탭에서 포트폴리오가 바뀌었습니다. 이 탭에 반영하려면 다시 불러오세요. '), button);
  page.prepend(note);
}
function listenCrossTab(documentRef, root) {
  if (crossTabListening || typeof root?.addEventListener !== 'function') return;
  crossTabListening = true;
  root.addEventListener('storage', (event) => {
    const key = String(event?.key || '');
    if (key === 'aio_watchlists') { try { root.refreshWatchlistUI?.(); } catch (_) {} return; }
    if (!key.startsWith('aio_portfolio_') || key === 'aio_portfolio_vault_optout') return;
    crossTabChanged = true;
    if (portfolioMounted) paintCrossTabNotice(documentRef, root);
  });
}
function requestHoldingQuotes(root, rows, attempt = 0) { // attempt > 0: a retry, which alone passes the throttle
  const symbols = [...new Set((rows || []).filter((row) => row?.sourceKind !== 'live-quote').map((row) => row?.listingSymbol || row?.symbol).filter(Boolean))].slice(0, 60);
  if (!symbols.length) return;
  symbols.forEach((symbol) => root?.AIO?.registerLiveSymbol?.(symbol, { reason: 'portfolio-holding' }));
  const signature = symbols.join('|');
  const nowMs = Date.now();
  if (!attempt && signature === holdingQuoteSignature && nowMs - holdingQuoteRequestedAt < 55_000) return;
  if (root?._aioBootPhase?.quoteReady === false || typeof root?.AIO?.runScheduledRefresh !== 'function') return;
  holdingQuoteSignature = signature;
  holdingQuoteRequestedAt = nowMs;
  Promise.resolve(root.AIO.runScheduledRefresh({ keys: ['quotes'], symbols, pageId: 'portfolio', reason: 'portfolio-holding-quotes' }))
    .then(() => { if (attempt < 3 && unquoted(root, symbols).length) setTimeout(() => { if (portfolioMounted) requestHoldingQuotes(root, rows, attempt + 1); }, 4000); })
    .catch(() => {});
}
const closeNote = (surface) => {
  const n = surface?.closeValuedCount || 0;
  const date = String(surface?.closeDate || '');
  const md = isIsoDay(date) ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))} ` : '';
  const delayed = surface?.delayedValuedCount || 0;
  const stale = surface?.staleCloseCount || 0;
  const oldest = String(surface?.oldestCloseDate || '');
  const oldMd = isIsoDay(oldest) ? `${Number(oldest.slice(5, 7))}/${Number(oldest.slice(8, 10))} ` : '';
  // Every holding on the close: the count is already at the head of the line, so it is not said twice.
  const all = n > 0 && n === surface?.holdingCount;
  return `${n ? (all ? `, 모두 ${md}종가 기준` : `, ${n}종목은 실시간 시세 대신 ${md}종가 기준`) : ''}${stale ? `, 이 중 ${stale}종목은 일주일 넘은 ${oldMd}종가` : ''}${delayed ? `, ${delayed}종목은 지연 시세(참고) 기준` : ''}`;
};

function screenerSectorOf(bySymbol) {
  return (symbol) => bySymbol.get(String(symbol || '').toUpperCase())?.sector || null;
}

function renderCashBalances(documentRef, surface) {
  const balances = Array.isArray(surface?.cashBalances) ? surface.cashBalances : [];
  const amountOf = (code) => balances.find((row) => row.currency === code)?.amount;
  // A box being typed in or saved, or holding a refused amount, is the reader's and is left alone.
  for (const [id, code] of [['pf-cash-krw-input', 'KRW'], ['pf-cash-usd-input', 'USD']]) paintCashBox(documentRef?.getElementById(id), amountOf(code));
  const conversion = surface?.cashConversion || {};
  const each = balances.filter((row) => row.amount > 0).map((row) => formatSurfaceMoney(row.amount, row.currency || conversion.target || surface.declaredBaseCurrency));
  const unit = conversion.target || surface.declaredCashCurrency || surface.declaredBaseCurrency;
  const heroText = surface.cash != null ? formatSurfaceMoney(surface.cash, unit) : each.length ? `${each.join(', ')}, 합계 보류` : '입력 안 함';
  setSurfaceText(documentRef, 'pf-cash-hero', heroText, surface.cash, surface);
  const line = documentRef?.getElementById('pf-cash-total');
  if (!line) return;
  const rateText = conversion.basisLabel || '';
  let text = '';
  if (surface.cashInvalidCount > 0) {
    text = `읽을 수 없는 현금 잔액 ${surface.cashInvalidCount}건이 있어 합계를 계산하지 않았습니다`;
  } else if (surface.cashHeld) {
    const names = (conversion.held || []).map((code) => ({ KRW: '원화', USD: '달러' }[code] || code)).join('·');
    // A USD/KRW mix with no base currency is held for the base choice, not for a missing rate (the app close converts it).
    text = surface.baseChoiceConverts
      ? `기준 통화를 고르지 않아 ${names ? `${names} ` : ''}현금을 통화별로 표시, 설정에서 고르면 원/달러 종가로 합산`
      : `환율 자료가 없어 합계를 계산하지 않았습니다, ${names ? `${names} 현금은 ` : ''}통화별 금액만 표시`;
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
  const heroEmpty = surface.readState === 'ready' && surface.valuationState === 'empty';
  documentRef?.getElementById('pf-hero')?.classList.toggle('is-empty', heroEmpty);
  const heroEmptyLine = documentRef?.getElementById('pf-hero-empty');
  if (heroEmptyLine) heroEmptyLine.hidden = !heroEmpty;
  page.classList.toggle('pf-is-empty', heroEmpty);
  setSurfaceText(documentRef, 'pf-holding-count', surface.holdingCount ? `${surface.holdingCount}종목` : '—', surface.holdingCount || null, surface);
  setSurfaceText(documentRef, 'pf-total-pnl-pct', surface.totalPnlPct == null ? '—' : `${signedText(surface.totalPnlPct, 1)}%`, surface.totalPnlPct, surface, surface.totalPnl == null ? 'var(--color-text-secondary)' : surface.totalPnl >= 0 ? 'var(--color-data-up)' : 'var(--color-data-down)');
  setSurfaceText(documentRef, 'pf-daily-chg', formatSurfaceMoney(surface.dailyChange, surface.declaredBaseCurrency), surface.dailyChange, surface, surface.dailyChange == null ? 'var(--color-text-secondary)' : surface.dailyChange >= 0 ? 'var(--color-data-up)' : 'var(--color-data-down)');
  setSurfaceText(documentRef, 'pf-daily-pct', surface.dailyPct == null ? '—' : `${signedText(surface.dailyPct, 2)}%`, surface.dailyPct, surface, surface.dailyChange == null ? 'var(--color-text-secondary)' : surface.dailyChange >= 0 ? 'var(--color-data-up)' : 'var(--color-data-down)');
  const dailyLine = documentRef?.getElementById('pf-daily-line');
  if (dailyLine) dailyLine.hidden = surface.dailyChange == null;
  renderCashBalances(documentRef, surface);
  setSurfaceText(documentRef, 'pf-cash-pct-hero', surface.cashPct == null ? (surface.cash == null ? '' : '—') : `${surface.cashPct.toFixed(1)}%`, surface.cashPct, surface);
  const fxSources = new Set((surface.conversion?.legs || []).map((leg) => leg.source === 'app-close' ? 'app' : 'declared'));
  const fxBasisLabel = fxSources.has('app') ? (fxSources.has('declared') ? '선언 rate·앱 USD/KRW 종가' : '앱 USD/KRW 종가') : '선언 rate';
  const currencyNoteBase = surface.readState !== 'ready' || !surface.holdingCount
    ? '—'
    : surface.currencyState === 'converted-with-declared-rates'
      ? `통화 환산(${fxBasisLabel}) → ${surface.baseCurrency}`
      : surface.currencyState === 'mixed-without-conversion'
        ? surface.currencyHeldReason === 'unknown-unit' ? `시세 통화 미확인 ${surface.unknownCurrencyCount}종목 — 합계 보류`
          : surface.baseChoiceConverts ? `통화 혼합(${heldCurrencyList(surface)}) — 설정에서 기준 통화를 고르면 원/달러 종가로 합산`
            : `통화 혼합(${heldCurrencyList(surface)}) — 환산 없어 합계 보류`
        : surface.currencyState === 'declared-single' ? `통화 ${surface.baseCurrency}`
          : '기준 통화를 따로 고르지 않아 종목의 시장 통화 그대로 계산';
  const currencyHeld = (surface.costCurrencyState === 'cost-price-mismatch-held' ? ', 원가/시세 불일치 — P&L 보류'
    : surface.costCurrencyState === 'cost-price-mismatch-converted' ? `, 원가/시세 불일치 — ${fxBasisLabel}로 환산` : '')
    + (surface.conversion?.costApplied ? ', 원가는 현재 환율로 환산 — 매수 이후 환율 효과 제외' : '');
  const currencyHeldActive = (surface.currencyState === 'mixed-without-conversion' || surface.costCurrencyState === 'cost-price-mismatch-held') && surface.readState === 'ready' && !!surface.holdingCount;
  setSurfaceText(documentRef, 'pf-currency-note', currencyNoteBase === '—' ? '—' : currencyNoteBase + currencyHeld, surface.holdingCount || null, surface, currencyHeldActive ? 'var(--color-text-warning)' : 'var(--color-text-secondary)');
}

function tableCell(documentRef, headerId, value, className = 'pfp-cell') {
  const cell = documentRef.createElement('td');
  cell.setAttribute('headers', headerId);
  cell.className = className;
  cell.textContent = value;
  const label = documentRef.getElementById?.(headerId)?.textContent?.trim();
  if (label) cell.dataset.label = label;
  return cell;
}

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

function renderPortfolioTable(documentRef, page, state, surface, { preview = false, root = null } = {}) {
  const tbody = page?.querySelector?.('#pf-positions-tbody');
  if (!tbody) return;
  const holdings = Array.isArray(state?.holdings) ? state.holdings : [];
  const sourceHoldings = holdings.filter((entry) => entry?.symbol || entry?.ticker);
  const rows = surface.rows.map((item, index) => {
    const holding = sourceHoldings[index];
    const { value, cost: costValue } = item;
    const sameUnit = !item.valueUnit || !item.costUnit || item.valueUnit === item.costUnit;
    const pnl = value != null && costValue != null && sameUnit ? value - costValue : null;
    const pnlPct = pnl != null && costValue > 0 ? pnl / costValue * 100 : null;
    return { ...item, holding, costValue, pnl, pnlPct };
  });
  const totalValue = surface.positionValue;
  tbody.replaceChildren();
  tbody.dataset.aioPortfolioTableRenderer = 'native';
  tbody.setAttribute('data-source-kind', rows.length ? 'portfolio-state' : 'unavailable');
  tbody.setAttribute('data-source-label', rows.length ? 'native-portfolio-slice' : 'portfolio-state-unavailable');
  tbody.setAttribute('data-operational-use', 'reference-only');
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
    body.textContent = '종목을 추가하면 변동성·섹터 쏠림·시장 상태와의 연결이 여기에 나타납니다.';
    const addButton = documentRef.createElement('button');
    addButton.className = 'aio-btn-table primary pfp-add';
    addButton.setAttribute('data-action', '_aioTogglePortfolioEntry');
    addButton.textContent = '첫 종목 추가';
    const importButton = documentRef.createElement('button');
    importButton.type = 'button';
    importButton.className = 'aio-btn-table pfp-add';
    importButton.setAttribute('data-action', '_aioTriggerPortfolioImport');
    importButton.textContent = '백업 가져오기';
    const previewButton = documentRef.createElement('button');
    previewButton.type = 'button';
    previewButton.className = 'aio-btn-table pfp-add';
    previewButton.textContent = '예시로 미리 보기 (저장 안 함)';
    previewButton.addEventListener('click', () => { if (root) root.__aioPortfolioPreview = true; rerenderPortfolio?.(); });
    // One wrapping block, so the phone rule (portfolio-page.css: each direct child sticky within the viewport) wraps the buttons.
    const actions = documentRef.createElement('div');
    actions.className = 'pfp-empty-actions';
    actions.append(addButton, importButton, previewButton);
    cell.append(heading, body, actions);
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
    row.dataset.holding = symbol;
    const tickerCell = documentRef.createElement('td');
    tickerCell.setAttribute('headers', 'pf-th-ticker');
    tickerCell.className = 'pfp-ticker';
    const ticker = documentRef.createElement('b');
    ticker.textContent = symbol;
    ticker.style.color = 'var(--color-text-primary)';
    tickerCell.appendChild(ticker);
    if (holding?.memo) {
      const memo = documentRef.createElement('div');
      memo.textContent = String(holding.memo);
      memo.className = 'pfp-memo';
      tickerCell.appendChild(memo);
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
    const baseCurrency = String(surface?.valuationCurrency || (surface?.currencyHeldReason === 'unknown-unit' ? '통화 미확인' : 'USD')).trim().toUpperCase();
    const rowUnits = [...new Set(rows.map((entry) => entry.valueUnit).filter(Boolean))];
    const pnlHeader = documentRef.getElementById('pf-th-pnl');
    if (pnlHeader) pnlHeader.textContent = rowUnits.length > 1 ? '손익 (보유 통화)' : `손익 (${baseCurrency})`;
    const pnlCurrency = rowUnits.length > 1 ? String(rowData.valueUnit || '').toUpperCase() || baseCurrency : baseCurrency;
    const priceCurrency = String(holding?.currency || rowData.listingCurrency || '').trim().toUpperCase() || null;
    const costCurrency = String(holding?.costCurrency || holding?.currency || rowData.listingCurrency || '').trim().toUpperCase() || null;
    const money = (amount, currency) => (amount == null
      ? '—'
      : `${currency === 'USD' ? '$' : currency === 'KRW' ? '₩' : currency ? `${currency} ` : '통화 미확인 '}${Math.abs(amount).toLocaleString('en-US', currency === 'KRW' ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    row.appendChild(tableCell(documentRef, 'pf-th-qty', shares == null ? '—' : String(shares)));
    const costCell = tableCell(documentRef, 'pf-th-cost', money(avgCost, costCurrency));
    costCell.title = costCurrency ? `원가 통화 ${costCurrency}${holding?.costCurrency ? '' : '(상장 시장 기준)'}` : '원가 통화 미확인';
    row.appendChild(costCell);
    const priceCellNode = tableCell(documentRef, 'pf-th-price', price == null ? (root && screenerRowsState(root) === 'loading' ? '가격 불러오는 중' : '가격 없음') : money(price, priceCurrency));
    priceCellNode.style.color = price == null ? 'var(--color-text-secondary)' : 'var(--color-text-primary)';
    const closeDated = rowData.sourceKind === 'completed-close' && rowData.closeDate ? `, 실시간 시세 대신 ${rowData.closeDate} 종가` : '';
    priceCellNode.title = price == null ? '시세와 종가를 받지 못했습니다, 총자산과 손익 합계에서 뺐습니다' : `시세 통화 ${priceCurrency || '미확인'}${closeDated}`;
    if (price == null) priceCellNode.dataset.priceState = 'missing';
    row.appendChild(priceCellNode);
    const heldText = avgCost == null ? '매수가 없음' : price == null ? '가격 없음' : '보류';
    const pnlCell = tableCell(documentRef, 'pf-th-pnl', pnl == null ? heldText : `${signMark(pnl, 2)}${money(Math.abs(pnl), pnlCurrency)}`, 'pfp-cell is-bold');
    if (pnl == null) pnlCell.title = '손익 보류, 원가/시세 통화 불일치 또는 시세 미수신';
    pnlCell.style.color = pnl == null ? 'var(--color-text-secondary)' : directionColor(pnl, 2);
    row.appendChild(pnlCell);
    const pctCell = tableCell(documentRef, 'pf-th-pct', pnlPct == null ? heldText : `${signedText(pnlPct, 1)}%`, 'pfp-cell is-bold');
    pctCell.style.color = pnlPct == null ? 'var(--color-text-secondary)' : directionColor(pnlPct, 1);
    row.appendChild(pctCell);
    const dayPct = rowData.dailyPctEligible && Number.isFinite(rowData.dailyPct) ? rowData.dailyPct : null;
    const closeDay = dayPct == null && rowData.sourceKind === 'completed-close' && isIsoDay(String(rowData.closeDate || '')) ? rowData.closeDate : null;
    const closePct = closeDay && Number.isFinite(rowData.closeChangePct) ? rowData.closeChangePct : null;
    const shownPct = dayPct ?? closePct;
    const dayCell = tableCell(documentRef, 'pf-th-day', shownPct == null ? (closeDay ? '종가 기준' : '시세 대기') : `${signedText(shownPct, 2)}%${closePct != null ? ` (${Number(closeDay.slice(5, 7))}/${Number(closeDay.slice(8, 10))})` : ''}`, 'pfp-cell');
    dayCell.style.color = shownPct == null ? 'var(--color-text-secondary)' : directionColor(shownPct, 2);
    if (dayPct == null) dayCell.title = closeDay ? `${closeDay} 종가의 전 거래일 대비 변화 — 오늘 변화는 실시간 시세를 받으면 표시합니다` : '실시간 시세를 받으면 표시합니다';
    row.appendChild(dayCell);
    const targetValue = finite(holding?.target);
    const targetSet = targetValue != null && targetValue > 0 ? targetValue : null;
    const targetCurrency = costCurrency || priceCurrency;
    const targetCell = tableCell(documentRef, 'pf-th-target', targetSet == null ? '미설정' : money(targetSet, targetCurrency));
    if (targetSet != null && price != null && price > 0 && targetCurrency === priceCurrency) {
      const upside = (targetSet - price) / price * 100;
      const upsideNode = documentRef.createElement('div');
      upsideNode.textContent = `${signedText(upside, 1)}%`;
      upsideNode.className = 'pfp-upside';
      upsideNode.style.color = upside >= 0 ? 'var(--color-data-up)' : 'var(--color-data-down)';
      targetCell.appendChild(upsideNode);
    }
    row.appendChild(targetCell);
    const weightPct = totalValue > 0 && value != null ? value / totalValue * 100 : null;
    const weightCell = tableCell(documentRef, 'pf-th-weight', '', 'pfp-cell is-bold is-sans');
    if (weightPct == null) weightCell.textContent = value == null ? '가격 없음' : '합계 대기';
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
    (preview ? [['차트', '_aioTechnicalTicker']] : [['차트', '_aioTechnicalTicker'], ['수정', '_aioEditPosition'], ['삭제', '_aioRemovePosition']]).forEach(([label, action]) => {
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
  const reveal = !preview && root?._aioRevealHolding;
  const added = reveal ? [...tbody.querySelectorAll('tr[data-holding]')].find((item) => item.dataset.holding === reveal) : null;
  if (added) {
    root._aioRevealHolding = null;
    added.classList.add('is-just-added');
    added.scrollIntoView?.({ block: 'center' });
    root.setTimeout?.(() => added.classList.remove('is-just-added'), 2400);
  }
}

function render({ root, documentRef, store }) {
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
  const cashFx = appUsdKrwClose(root?._aioHistory || globalThis._aioHistory || []);
  const onDemand = withOnDemandHoldings(root, bySymbol, state?.holdings);
  if (root) root._aioPortfolioOnDemandRows = [...onDemand.values()].map((record) => record.row);
  const surface = derivePortfolioSurface({ state, liveData, vix: liveData?.['^VIX'] || null, sectorOf: screenerSectorOf(bySymbol), closeOf: screenerCloseOf(root, bySymbol, onDemand), cashFx });
  const empty = surface.readState === 'ready' && surface.valuationState === 'empty';
  if (!empty && root) root.__aioPortfolioPreview = false;
  const preview = empty && root?.__aioPortfolioPreview === true;
  if (preview) {
    const shownState = previewPortfolioState();
    const shown = derivePortfolioSurface({ state: shownState, liveData: {}, vix: liveData?.['^VIX'] || null, sectorOf: screenerSectorOf(bySymbol), closeOf: screenerCloseOf(root, bySymbol), cashFx });
    renderPortfolioSurface(documentRef, page, shown);
    renderPortfolioHero(documentRef, shown);
    renderPortfolioStatus(documentRef, shownState, shown, { pricesLoading: screenerRowsState(root) === 'loading' });
    renderPortfolioTable(documentRef, page, shownState, shown, { preview: true, root });
    const shownChecks = renderPortfolioChecks(documentRef, root, shown);
    renderPortfolioLens({ documentRef, root, surface: shown, checks: shownChecks, sectorLabel: portfolioSectorLabel });
    renderPortfolioRead({ documentRef, root, surface: shown });
    renderFirstScreen(documentRef, root, shown, bySymbol);
    renderPortfolioCriteria({ documentRef, root, surface: shown, checks: shownChecks, sectorLabel: portfolioSectorLabel });
    renderThesisCheck({ documentRef, root, surface: shown, holdings: shownState.holdings, bySymbol });
    syncEmptyState(documentRef, root, page, { empty: true, preview: true });
    return;
  }
  requestHoldingQuotes(root, surface.rows);
  if (root) root._aioPortfolioSurface = surface;
  if (root) root._aioPortfolioSectorLabel = portfolioSectorLabel;
  // #12: the legacy AI workbench sends these rows (ticker·sector·weight·return in the base currency, with the date).
  if (root) root._aioPortfolioAiRows = () => portfolioRowsForAI(root._aioPortfolioSurface, { sectorOf: (symbol) => (Array.isArray(root.SCREENER_DB) ? root.SCREENER_DB : []).find((row) => String(row?.sym || '').toUpperCase() === symbol)?.sector || null });
  renderPortfolioSurface(documentRef, page, surface);
  renderPortfolioHero(documentRef, surface);
  renderPortfolioStatus(documentRef, state, surface, { pricesLoading: screenerRowsState(root) === 'loading' });
  renderPortfolioTable(documentRef, page, state, surface, { root });
  const checks = renderPortfolioChecks(documentRef, root, surface);
  renderPortfolioLens({ documentRef, root, surface, checks, sectorLabel: portfolioSectorLabel });
  renderPortfolioRead({ documentRef, root, surface });
  renderFirstScreen(documentRef, root, surface, bySymbol);
  renderPortfolioCriteria({ documentRef, root, surface, checks, sectorLabel: portfolioSectorLabel });
  renderThesisCheck({ documentRef, root, surface: empty ? null : surface, holdings: state?.holdings || [], bySymbol, rerender: () => rerenderPortfolio?.() });
  renderTradeJournal({ documentRef, root, surface });
  renderRiskFreeFill(documentRef, root);
  syncEmptyState(documentRef, root, page, { empty, preview: false });
}

// The risk-free box offers the published short rate (SOFR, the shared macro reading's cash rate) as a one-click
// entry; the macro history is asked for when stale and the button appears once it arrives.
function renderRiskFreeFill(documentRef, root, { request = true } = {}) {
  let cash = null;
  try { readMarketRegime(root, () => rerenderPortfolio?.()); cash = marketInterpretation(root).crossroads?.cash || null; } catch (_) { cash = null; }
  paintRiskFreeFill({ documentRef, cash, save: (id, value) => root?.savePortfolioAssumption?.(id, value) });
  // The rate comes from the macro history, which this route does not otherwise load: ask once and paint the button alone.
  if (!cash && request) refreshSharedArtifact(root, MACRO_HISTORY).then(() => renderRiskFreeFill(documentRef, root, { request: false })).catch(() => {});
}

const PREVIEW_HOLDINGS = Object.freeze([['MSFT', 10], ['NVDA', 20], ['JPM', 12], ['XOM', 20], ['JNJ', 15], ['PG', 20]]);
function previewPortfolioState() {
  return { status: 'ready', readState: 'ready', holdingsKnown: true, cashKnown: true, cashBalances: [], holdings: PREVIEW_HOLDINGS.map(([symbol, shares]) => ({ symbol, shares })) };
}

function renderFirstScreen(documentRef, root, surface, bySymbol) {
  renderPortfolioValueTrend({ documentRef, root, surface, rowOf: (symbol) => bySymbol.get(String(symbol || '').toUpperCase()) || null });
  renderPortfolioExposureBar({ documentRef, surface, sectorLabel: portfolioSectorLabel });
}

// 거래와 현금 기록은 첫 보유 종목을 추가하기 전에도 쓸 수 있다.
const EMPTY_HIDDEN_IDS = Object.freeze(['pf-freshness-strip', 'pf-check-fold', 'pf-value-trend', 'pf-exposure-bar']);
const PREVIEW_SHOWN = new Set(['pf-value-trend', 'pf-exposure-bar']);
function syncEmptyState(documentRef, root, page, { empty, preview }) {
  if (!page || !documentRef) return;
  page.dataset.pfEmpty = String(empty);
  // Keep real trading and cash forms out of the unsaved example.
  documentRef.getElementById('pf-records-fold')?.toggleAttribute('hidden', preview);
  for (const id of EMPTY_HIDDEN_IDS) {
    const node = documentRef.getElementById(id);
    if (!node) continue;
    // The example preview shows the first screen it fills (chart, exposure) like a real book.
    const hide = empty && !(preview && PREVIEW_SHOWN.has(id));
    if (hide) { if (!node.hidden) { node.hidden = true; node.dataset.pfEmptyHidden = '1'; } } else if (node.dataset.pfEmptyHidden) { node.hidden = false; delete node.dataset.pfEmptyHidden; }
  }
  const section = documentRef.getElementById('pf-holdings-table-section');
  let note = documentRef.getElementById('pf-preview-note');
  if (!preview) { note?.remove(); return; }
  if (!note && section) {
    note = documentRef.createElement('div');
    note.id = 'pf-preview-note';
    note.className = 'briefing-empty';
    note.setAttribute('role', 'status');
    section.prepend(note);
  }
  if (!note) return;
  const stop = documentRef.createElement('button');
  stop.type = 'button';
  stop.className = 'aio-btn-table';
  stop.textContent = '미리 보기 끝내기';
  stop.addEventListener('click', () => { root.__aioPortfolioPreview = false; rerenderPortfolio?.(); });
  note.replaceChildren(documentRef.createTextNode(`예시 미리 보기 — ${PREVIEW_HOLDINGS.map(([symbol]) => symbol).join(', ')}를 최근 종가로 평가한 화면입니다. 저장되지 않고, 추천 구성이 아니며, 매수가가 없어 손익은 비워 둡니다. `), stop);
}

const CHECK_TONE = Object.freeze({ ok: ['양호', 'favorable'], attention: ['주의', 'burden'], info: ['참고', 'neutral'], unknown: ['측정 안 함', 'unknown'] });
function renderPortfolioChecks(documentRef, root, surface) {
  const host = documentRef?.getElementById('pf-checks');
  if (!host) return null;
  const universe = Array.isArray(root?.SCREENER_DB) ? root.SCREENER_DB : [];
  const rowOf = (symbol) => universe.find((row) => String(row?.sym || '').toUpperCase() === symbol) || null;
  const result = derivePortfolioChecks({
    surface,
    assetTypeOf: (symbol) => { const row = rowOf(symbol); if (row) return row.index === 'ETF' || row.sector === 'ETF' ? 'ETF' : '개별 주식'; if (/\.(KS|KQ)$/.test(symbol)) return '개별 주식'; const record = root?._aioOnDemandSymbol?.(symbol); return record?.status === 'ready' ? (record.etf ? 'ETF' : '개별 주식') : null; },
    sectorOf: (symbol) => { const row = rowOf(symbol); return row ? (row.sector === 'ETF' ? '광범위 ETF' : row.sector) : null; }
  });
  const el = (tag, text, className) => { const node = documentRef.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  host.replaceChildren(el('h2', '포트폴리오 점검', 'briefing-h2'));
  host.dataset.aioPortfolioChecksRenderer = 'native';
  const currencyHold = { 'currency-unconverted': surface?.baseChoiceConverts ? '원화와 달러 종목이 섞여 있고 기준 통화를 고르지 않아 비중을 한 통화로 맞추지 않았습니다. 포트폴리오 설정에서 기준 통화를 고르면 원/달러 종가로 환산합니다.' : '통화가 다른 종목이 섞여 있고 환율이 선언되지 않아, 비중을 한 통화로 맞출 수 없습니다. 포트폴리오 설정에서 기준 통화와 환율을 선언하세요.',
    'currency-unknown': '시세 통화를 알 수 없는 종목이 있어 비중을 한 통화로 맞출 수 없습니다. 그 종목의 시세 통화를 입력하세요.' }[result.reason];
  host.hidden = result.status !== 'current' && !currencyHold;
  if (result.status !== 'current') {
    host.append(el('p', currencyHold || '평가액이 있는 포지션을 추가하면 점검이 표시됩니다.', 'briefing-empty'));
    return result;
  }
  const fold = el('details', null, 'pf-checks-fold');
  fold.dataset.userFold = '';
  fold.append(el('summary', '자세히, 점검 기준 · 비중 세부 · 지수와의 관계 · 채권 완충'));
  fold.append(el('p', `투자금 ${result.currency ? `${result.currency} ` : ''}기준 비중${result.excluded ? `, 평가액이 없는 ${result.excluded}종목 제외` : ''}, 한 종목은 앱 점검선(${HOLDING_BAND_BASIS}), 한 통화는 공개 기본값으로 판정하고 나머지는 참고 비중으로 표시. 점검선은 쏠림을 세는 선이며 권장 비중이 아닙니다`, 'theme-strength-basis'));
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
  fold.append(list);
  host.append(fold);
  return result;
}

export function createPortfolioPage({ root = globalThis, documentRef, store } = {}) {
  return {
    route: 'portfolio',
    mount() {
      const bag = createResourceBag();
      portfolioMounted = true;
      bag.add(() => { portfolioMounted = false; });
      const renderNow = () => render({ root, documentRef, store });
      rerenderPortfolio = renderNow;
      bag.add(() => { if (rerenderPortfolio === renderNow) rerenderPortfolio = null; if (root) root.__aioPortfolioPreview = false; });
      renderNow();
      listenCrossTab(documentRef, root);
      paintCrossTabNotice(documentRef, root);
      bag.add(installTradeJournal({ documentRef, root, getSurface: () => root?._aioPortfolioSurface || null }));
      bag.add(installPlanCheck({ documentRef, root }));
      renderKnowledgeArrival({ documentRef, root, routeId: 'portfolio' });
      bag.add(() => clearKnowledgeArrival({ documentRef, routeId: 'portfolio' }));
      bag.add(subscribeToSlices(store, ['portfolio'], renderNow));
      const eventTarget = documentRef || globalThis;
      eventTarget?.addEventListener?.('aio:liveQuotes', renderNow);
      bag.add(() => eventTarget?.removeEventListener?.('aio:liveQuotes', renderNow));
      root?.addEventListener?.('aio:historyLoaded', renderNow);
      bag.add(() => root?.removeEventListener?.('aio:historyLoaded', renderNow));
      root?.addEventListener?.('aio:portfolioStressInput', renderNow);
      bag.add(() => root?.removeEventListener?.('aio:portfolioStressInput', renderNow));
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
      if (table) table.dataset.aioPortfolioTableRenderer = 'native';
      ['pf-total-value', 'pf-total-pnl'].forEach((id) => {
        const element = documentRef?.getElementById(id);
        if (element) element.setAttribute('data-aio-portfolio-hero-renderer', 'native');
      });
      bag.add(() => {
        if (table?.dataset.aioPortfolioTableRenderer === 'native') delete table.dataset.aioPortfolioTableRenderer;
        ['pf-total-value', 'pf-total-pnl'].forEach((id) => {
          const element = documentRef?.getElementById(id);
          if (element?.dataset.aioPortfolioHeroRenderer === 'native') delete element.dataset.aioPortfolioHeroRenderer;
        });
        if (page?.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (page?.dataset.aioArchitectureSlice === 'portfolio') delete page.dataset.aioArchitectureSlice;
        if (page?.dataset.aioPortfolioSurface === 'native') delete page.dataset.aioPortfolioSurface;
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
