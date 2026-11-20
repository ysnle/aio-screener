import { createResourceBag } from '../../app/lifecycle.js';
import { ensureResearchSnapshots, focusResearchMemo } from '../components/research-snapshots.js';
import { consumeResearchHandoff } from '../../app/research-handoff.js';
import { parseKnowledgeTargetContext, navigateKnowledgeRoute } from '../../app/knowledge-route-state.js';
import { selectEntityState } from '../../state/selectors/entity.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { selectPortfolioState } from '../../state/selectors/portfolio.js';
import { listingCurrency } from '../../domain/portfolio/fx.js';
import { deriveSecReport } from '../../domain/fundamental/sec-report.js';
import { canonicalEpochMs } from '../../domain/technical/chart-contract.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { setStockSubject } from '../navigation/route-hubs.js';
import { renderTickerStart } from '../components/ticker-start.js';
import { renderFiscalRead, requestFiscalHistory, parseFiscalHistory, debtBasisFor, debtCurrentFor, issuerSic } from '../components/fiscal-read.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { createSummaryHydrator } from '../../domain/entity/summary-hydration.js';
import { businessProfileFor } from '../../domain/entity/business-profiles.js';
import { renderCompanyAnalysis, companyAskButton } from '../components/company-analysis.js';
import { renderCompanyOverview, renderCompanyReport } from '../components/company-overview.js';
import { renderTickerContext } from '../components/ticker-context.js';
import { paintTickerBrief } from '../components/event-briefs.js';
import { companyPlace, moneyGlance } from '../../domain/entity/company-overview.js';
import { industryFor } from '../../domain/entity/industry-links.js';
import { aiMapRouteParams } from '../../domain/knowledge/ai-map.js';
import { krFundamentalPoints } from '../../domain/entity/kr-fundamentals.js';
import { parseQuarterHistory } from '../../domain/fundamental/quarter-read.js';
import { reconcileFiscalHistory, financialKind } from '../../domain/fundamental/fiscal-read.js';
import { buildMarginCashRead } from '../../domain/fundamental/analysis-read.js';
import { sectorLabel } from '../../domain/screener/sector-label.js';
import { requestCompanyStory, companyStoryFor, companySideArtifact } from '../../data/company-profiles.js';
import { entityFundamentalsState, dataStateText } from '../../domain/content/data-state.js';
import { renderDataState } from '../components/data-state.js';
import { emptyState } from '../components/empty-state.js';
import { finiteNumber as finite, signedText, directionOf, usdKoreanText } from '../../domain/shared/number.js';
import { latestCompletedKrSession } from '../../domain/market/session/market-calendar.js';
import { installStockLensGlobal, stockLensContext, peerLine } from '../components/stock-lens-cards.js';
import { isIsoDay } from '../../domain/shared/session-date.js';
import { EARNINGS_CALENDAR, EVENT_BRIEFS } from '../../data/artifact-registry.js';

// 2026-10-13 review S21: observation times read in Korean time, not "… 20:00:00 UTC".

// The official US listing name for a symbol none of AIO's registries name; cached per symbol, written once it arrives.
function usListingNameFor(root, documentRef, id, state) {
  if ((state?.name && state.name !== id) || typeof root?._aioCheckUsListing !== 'function') return null;
  const names = (root._aioListingNames ||= {});
  // v59.74 (integration review): the cached name first — a listing this session confirmed makes _aioIsKnownTicker true
  // (listedSeen), so the next render (the symbol's own quote, now really requested) dropped the name back to the letters.
  if (id in names) return names[id];
  if (root?._aioIsKnownTicker?.(id)) return null;
  names[id] = null;
  Promise.resolve(root._aioCheckUsListing(id)).then((listing) => {
    if (listing?.listed !== true || !listing.name) return;
    names[id] = listing.name;
    if (String(root._currentTickerId || '').toUpperCase() === id) setText(documentRef, 'ticker-hero-fullname', listing.name);
  }).catch(() => {});
  return null;
}
export function formatKstStamp(value) {
  const ms = Date.parse(value || '');
  if (!Number.isFinite(ms)) return null;
  return `${new Date(ms).toLocaleString('sv-SE', { timeZone: 'Asia/Seoul', hour12: false }).slice(0, 16)} 한국 시간`;
}
const isKrSymbol = (symbol) => /\.K[SQ]$/i.test(String(symbol || ''));

// The latest daily bar with a close (the dated close the hero falls back to; the price chart itself is 기술적 분석's).
function latestBar(history = []) {
  return (Array.isArray(history) ? history : [])
    .map((row) => ({ ...row, epochMs: canonicalEpochMs(row?.epochMs ?? row?.time ?? row?.date ?? row?.timestamp) }))
    .filter((row) => row.epochMs != null && finite(row.close) != null)
    .sort((left, right) => left.epochMs - right.epochMs).at(-1) || null;
}
const utcDayOf = (epochMs) => (epochMs == null ? '—' : new Date(epochMs).toISOString().slice(0, 10));

function setText(documentRef, id, value) {
  const element = documentRef?.getElementById(id);
  if (element) element.textContent = value;
  return element;
}

function formatMoney(value, currency, { maximumFractionDigits = 2 } = {}) {
  const amount = finite(value);
  if (amount == null) return '—';
  const code = String(currency || '').trim().toUpperCase();
  if (!code) return `${amount.toLocaleString('en-US', { maximumFractionDigits })}, 통화 미확인`;
  try {
    return new Intl.NumberFormat(code === 'KRW' ? 'ko-KR' : 'en-US', {
      style: 'currency', currency: code, maximumFractionDigits: code === 'KRW' ? 0 : maximumFractionDigits
    }).format(amount);
  } catch (_) {
    return `${code} ${amount.toLocaleString('en-US', { maximumFractionDigits })}`;
  }
}

// v57.79 review: without a current quote the hero read "—" although the screener row already carries the completed
// close the page dates elsewhere. The latest published close (entity history or the screener's valuation close) is
// shown as that dated close — never a current price, never an estimate.
export function lastPublishedClose(id, state, root) {
  const candidates = [];
  const bars = state?.id === id && Array.isArray(state?.history) && state.history.length ? state.history : (root?._technicalOHLCV?.[id] || root?._tickerHistory?.[id] || []);
  const lastBar = latestBar(bars);
  if (lastBar && finite(lastBar.close) > 0) candidates.push({ value: finite(lastBar.close), date: utcDayOf(lastBar.epochMs), currency: null });
  let rows = [];
  try { rows = root?._aioGetCanonicalScreenerRows?.() || []; } catch (_) { rows = []; }
  const row = rows.find(item => item?.sym === id);
  const rowClose = finite(row?._valuationPrice ?? row?._valuationPePrice ?? row?.valuationPrice);
  const rowDate = String(row?.factorSessionDate || '').slice(0, 10);
  if (rowClose > 0 && isIsoDay(rowDate)) candidates.push({ value: rowClose, date: rowDate, currency: String(row.instrumentRef?.currency || row.currency || '').trim().toUpperCase() || null });
  return candidates.filter(item => isIsoDay(item.date)).sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

export function renderTickerHero(documentRef, state, root) {
  const requestedId = String(root?._currentTickerId || '').trim().toUpperCase() || null;
  const id = state?.id || requestedId;
  let quote = state?.quote || {};
  const price = finite(quote.value);
  // P1728: the change basis travels on the live envelope; a state quote built from the same envelope keeps it.
  const envelope = root?._liveData?.[id]?.quoteEnvelope;
  if (envelope && quote.changeBasisDate == null && envelope.changeBasis && (quote.changeBasis == null || quote.changeBasis === envelope.changeBasis) && finite(envelope.pct) === finite(quote.pct)) {
    quote = { ...quote, changeBasis: envelope.changeBasis, changeBasisDate: envelope.changeBasisDate, changeCheck: envelope.changeCheck,
      providerPreviousClose: envelope.providerPreviousClose, providerPct: envelope.providerPct };
  }
  // P1728: a KR change withheld before the history/screener arrived is checked again at render time.
  if (quote.changeCheck === 'unverified' && price != null && typeof root?._aioVerifyKrQuoteChange === 'function') {
    const recheck = root._aioVerifyKrQuoteChange({ symbol: id, _source: quote.source, observedAt: quote.observedAt, regularMarketPreviousClose: quote.providerPreviousClose }, price, finite(quote.providerPct));
    if (recheck && recheck.status !== 'unverified') quote = { ...quote, pct: recheck.pct, changeBasis: recheck.basis, changeBasisDate: recheck.basisDate, changeCheck: recheck.status };
  }
  // v57.86 (live review): during a KRX session the previous completed session's daily bar is that session's base —
  // 005930 read '전일 기준 미확인' all morning while the page held the 10/15 bar. Used only when that bar's date is the
  // latest completed KRX session in the index history (no skipped session between) and the quote is from a later day.
  if (quote.changeCheck === 'unverified' && price != null && /\.(KS|KQ)$/.test(String(id || ''))) {
    const lastKrx = root?._aioKrIndexCloseRead?.('kospi', root?._aioHistory)?.date || null;
    const bars = state?.id === id && Array.isArray(state?.history) && state.history.length ? state.history : (root?._technicalOHLCV?.[id] || root?._tickerHistory?.[id] || []);
    const bar = lastKrx ? bars.find((row) => row && utcDayOf(row.epochMs) === lastKrx && finite(row.close) > 0) : null;
    const ms = Date.parse(quote.observedAt || '');
    const session = Number.isFinite(ms) ? new Date(ms + 9 * 3600000).toISOString().slice(0, 10) : null;
    // v57.88 (review): the "no skipped session" promise is checked against the KRX calendar — the bar must be the last
    // completed session before the quote's own day, or a two-session change would read as 전일 대비.
    const expected = session ? latestCompletedKrSession(Date.parse(`${session}T00:00:00+09:00`))?.date || null : null;
    if (bar && session && session > lastKrx && expected === lastKrx) quote ={ ...quote, pct: (price / finite(bar.close) - 1) * 100, changeBasis: 'previous-session-daily-bar', changeBasisDate: lastKrx, changeCheck: 'agree' };
  }
  const pct = finite(quote.pct);
  // P1317: Korean users recognise a KRX listing by its name, not its code — lead with the name.
  // P1652: the provider name is English ("Samsung Electronics Co., Ltd."); the exact KRX registry name comes first.
  const isKr = /\.(KS|KQ)$/.test(String(id || ''));
  const registryName = isKr ? root?.KR_STOCK_DB?.[String(id).slice(0, 6)]?.name || null : null;
  const krName = isKr ? (registryName || (state?.name && state.name !== id ? state.name : null)) : null;
  setText(documentRef, 'ticker-hero-name', krName || id || '종목');
  // v59.54 (first-users run-6 #11): a symbol outside AIO's registries showed only its letters, so FB read as Facebook when the
  // listed FB is a ProShares ETF. The official listing's name (already loaded for the listed/not-listed check) names it.
  const listingName = !isKr && id ? usListingNameFor(root, documentRef, id, state) : null;
  // The page title already names the company from the screener row (SoFi Technologies); a provider quote without a
  // long name left the line under the symbol reading the symbol again (SOFI / SOFI).
  let screenerName = null;
  if (!isKr && id) { try { screenerName = (root?._aioGetCanonicalScreenerRows?.() || []).find((row) => row?.sym === id)?.name || null; } catch (_) { screenerName = null; } }
  const knownName = screenerName && String(screenerName).trim().toUpperCase() !== id ? String(screenerName).trim() : null;
  setText(documentRef, 'ticker-hero-fullname', id
    ? (krName ? id : (state?.name && state.name !== id ? state.name : listingName || knownName || (state?.id ? id : `${root?._currentTickerName || id}, ${root?._aioEntitySummaryStatus?.[id] === 'unavailable' ? '시세를 불러오지 못했습니다' : '시세 불러오는 중'}`)))
    : ''); // v59.55: the search box right below says it
  // P1317: a KRX listing (.KS/.KQ) trades only in KRW — the venue, not a guess, fixes the quote currency.
  // P1689: a fallback quote can arrive without a currency; use one already observed for this symbol (live envelope or
  // entity summary) before saying "통화 미확인" — still never inferred from the symbol alone outside the KRX suffix.
  const heroCurrency = quote.currency || root?._liveData?.[id]?.currency || root?._liveData?.[id]?.quoteEnvelope?.currency || root?._aioEntitySummaries?.[id]?.quote?.currency || (/\.(KS|KQ)$/.test(String(id || '')) ? 'KRW' : null);
  const close = price == null && id ? lastPublishedClose(id, state, root) : null;
  const closeLabel = close ? `${Number(close.date.slice(5, 7))}/${Number(close.date.slice(8, 10))} 종가` : null;
  const heroPrice = setText(documentRef, 'ticker-hero-price', close ? formatMoney(close.value, heroCurrency || close.currency) : formatMoney(price, heroCurrency));
  if (heroPrice) { if (close) heroPrice.dataset.priceBasis = 'last-close'; else delete heroPrice.dataset.priceBasis; }
  // P1728: a Korean change without a verified previous KRX close says so instead of showing a dash or a wrong base.
  const krUnverified = pct == null && price != null && quote.changeBasis === 'kr-previous-close-unverified';
  const heroDirection = directionOf(pct, 2);
  const heroChangeText = heroDirection === 'up' ? `▲ ${signedText(pct, 2, '%')}` : heroDirection === 'down' ? `▼ ${Math.abs(pct).toFixed(2)}%` : signedText(pct, 2, '%');
  const change = setText(documentRef, 'ticker-hero-chg', closeLabel || (pct == null ? (krUnverified ? '전일 기준 미확인' : '—') : heroChangeText));
  if (change) {
    change.className = `ticker-chg-big ${pct == null || closeLabel ? '' : heroDirection || ''}`;
    const basisDate = String(quote.changeBasisDate || '').slice(5).replace('-', '/');
    change.title = closeLabel ? `${close.date} 확정 종가(수정 종가), 현재 시세가 아닙니다` : krUnverified ? '직전 완료 거래일 종가를 검증하지 못해 등락률을 보류합니다.'
      : quote.changeBasis === 'screener-reconciled-session-change' && basisDate ? `${basisDate} 거래소 종가 기준 1일 변화`
      : quote.changeBasis === 'krx-history-previous-close' && basisDate ? `${basisDate} 거래소 종가 대비`
      : quote.changeBasis === 'provider-previous-close-index-checked' && basisDate ? `${basisDate} 종가 대비, 같은 날 지수 기준 일치 확인`
      : '';
  }
  const priceNode = documentRef?.getElementById('ticker-hero-price');
  if (priceNode) {
    let status = documentRef.getElementById('ticker-summary-price-basis');
    if (!status) { status = documentRef.createElement('div'); status.id = 'ticker-summary-price-basis'; status.className = 'entity-summary-price-basis'; priceNode.after(status); }
    // v57.61 WCAG 4.1.3: loading -> failure/ready is announced without moving focus.
    if (status.getAttribute('role') !== 'status') status.setAttribute('role', 'status');
    const meta = root?._aioEntitySummaries?.[id];
    const valueBasis = root?._liveData?.[id]?.quoteEnvelope?.valueBasis || meta?.quote?.valueBasis;
    // Live review 2026-10-14: a failed fetch says so; only a request still in flight reads as loading.
    const statusText = price == null ? closeLabel ? `현재 시세 ${root?._aioEntitySummaryStatus?.[id] === 'loading' ? '불러오는 중' : '받지 못함'}` : root?._aioEntitySummaryStatus?.[id] === 'unavailable' ? '시세를 불러오지 못했습니다, 종목을 다시 선택해 확인' : root?._aioEntitySummaryStatus?.[id] === 'ready' ? '현재 시세 받지 못함, 이 종목은 앱에 실린 종가가 없어 시세를 받으면 표시' : '현재 시세 불러오는 중' : `${valueBasis === 'completed-daily-close' ? '완료 일봉 종가' : '정규장 관측가'}${quote.observedAt ? `, ${formatKstStamp(quote.observedAt) || String(quote.observedAt)}` : ', 관측 시각 미확인'}${quote.changeCheck === 'corrected' && quote.changeBasisDate ? `, 등락률은 ${String(quote.changeBasisDate).slice(5).replace('-', '/')} ${quote.changeBasis === 'screener-reconciled-session-change' ? '거래소 종가 기준' : '거래소 종가 대비'}` : ''}`;
    if (status.textContent !== statusText) status.textContent = statusText;
  }
  // P1317/N27: showPage titles the route from the stale hero before this render runs, so the tab,
  // history and bookmarks kept "종목 선택 대기" (or the previous symbol). The owner of the hero owns the title.
  if (id && documentRef && documentRef.getElementById?.('page-ticker')?.classList?.contains('active')) {
    const label = state?.name && state.name !== id ? `${state.name} (${id})` : id;
    documentRef.title = `${label}${price == null ? '' : ` ${formatMoney(price, heroCurrency)}`} - AIO Screener`;
  }
}

// 종목 개요 (owner 2026-11-19): under the name and price, one line of what the company is, then 사업 · 밸류체인 안의 자리 ·
// 재무 한눈에 (src/ui/components/company-overview.js). Rebuilt only when its inputs change (quote ticks repaint often).
function renderOverview(documentRef, root, state, store = null) {
  const host = documentRef?.getElementById('ticker-company');
  const line = documentRef?.getElementById('ticker-hero-line');
  if (!host) return;
  const id = String(state?.id || root?._currentTickerId || '').trim().toUpperCase();
  // v57.54: the screen's h1 (screen-reader heading; the hero shows the name visually).
  const title = documentRef.getElementById('ticker-page-title');
  if (!id) {
    host.hidden = true; host.replaceChildren(); delete host.dataset.signature;
    if (line) { line.hidden = true; line.textContent = ''; }
    if (title) title.textContent = '종목';
    return;
  }
  const again = () => { if (String(root?._currentTickerId || '').toUpperCase() === id && documentRef.getElementById('page-ticker')?.classList.contains('active')) renderOverview(documentRef, root, state, store); };
  let rows = [];
  try { rows = root?._aioGetCanonicalScreenerRows?.() || []; } catch (_) { rows = []; }
  const kr = isKrSymbol(id);
  const row = rows.find((item) => item?.sym === id) || null;
  // v57.81: a US listing outside the screener universe is read on demand; its SEC record arrives with it.
  const onDemand = !kr && typeof root?._aioOnDemandSymbol === 'function' ? root._aioOnDemandSymbol(id) : null;
  if (!row && !kr && !onDemand && rows.length && typeof root?._aioRequestOnDemandSymbol === 'function') {
    Promise.resolve(root._aioRequestOnDemandSymbol(id)).then((settled) => { if (settled) again(); }).catch(() => {});
  }
  const listingRow = row || (onDemand?.status === 'ready' ? onDemand.row : null) || {};
  const profile = businessProfileFor(id, listingRow, root?._aioEntitySummaries?.[id] || {});
  if (title) title.textContent = profile.name && profile.name !== id ? `종목, ${profile.name} (${id})` : `종목, ${id}`;
  // First-users run-6 #11: a retired or unknown symbol (FB, AAP) is one "no match" state, not a half-empty company page.
  if (onDemand?.status === 'not-listed') {
    if (line) line.hidden = true;
    if (host.dataset.signature !== `${id}|not-listed`) {
      host.dataset.signature = `${id}|not-listed`;
      host.replaceChildren(emptyState(documentRef, { title: `${id}와 맞는 종목이 없습니다`, reason: '미국 상장 목록과 AIO 등록 종목 어디에도 없는 기호입니다. 상장 폐지됐거나 기호가 바뀐 종목일 수 있습니다.', next: '회사 이름으로 다시 검색해 보세요.', compact: true }));
    }
    host.hidden = false;
    return;
  }
  // The story, the company graph and the capital flows arrive once per tab; each repaints the overview when it lands.
  requestCompanyStory(root, id, again);
  const story = companyStoryFor(root, id);
  requestFiscalHistory(root, again, 'overview');
  refreshSharedArtifact(root, EVENT_BRIEFS).then(({ changed }) => { if (changed) again(); }).catch(() => {});
  const graph = companySideArtifact(root, 'graph', again);
  const capital = companySideArtifact(root, 'capital', again);
  const etf = listingRow.sector === 'ETF' || listingRow.index === 'ETF' || /ETF/.test(profile.kind);
  // 재무 한눈에: the SEC record (route state or the on-demand read) with its quarters and fiscal years; DART for KRX.
  const fundamentals = state?.id === id && state?.fundamentals ? state.fundamentals : onDemand?.sec?.symbol === id ? onDemand.sec : null;
  const quarterText = root?._aioSecQuarterHistory?.[id];
  const series = root?._aioSecFiscalHistory?.[id];
  const history = series ? reconcileFiscalHistory(parseFiscalHistory(series), fundamentals, id) : [];
  const money = etf ? { rows: [] } : moneyGlance({ symbol: id, fundamentals, quarters: quarterText ? parseQuarterHistory(quarterText) : [],
    marginCash: history.length ? buildMarginCashRead(history, { debtBasis: debtBasisFor(root, id), debtCurrent: debtCurrentFor(root, id) }) : null,
    kr: kr ? krFundamentalPoints(root?._aioKrFundamentals?.companies?.[id]) : null, story, financial: !!financialKind(id, listingRow.sector, issuerSic(root, id)) });
  // A SEC record still on its way, a failed load and a confirmed absence read differently (data-state.js).
  const secState = fundamentals ? 'ready' : onDemand?.status === 'ready' ? 'absent' : onDemand?.status === 'unavailable' ? 'failed'
    : entityFundamentalsState(state, { requestedId: id });
  const moneyEmpty = etf ? 'ETF는 기업 재무 공시가 없습니다' : kr ? '한국 공시(DART) 재무 자료 없음'
    : secState === 'ready' ? '재무 자료 없음' : dataStateText(secState, '재무 기록');
  // One line of standing among named theme peers (the rank figure and the rest live on 재무 공시).
  const peer = etf || kr ? null : peerLine(stockLensContext(root, id, { fundamentals }));
  const place = companyPlace({ symbol: id, story, graph, capital });
  // One line of what the company is: the story's own line, else the listing's sourced description, else its classification.
  const what = story?.oneLine || profile.description || [profile.kind, profile.sector ? sectorLabel(profile.sector) : null, profile.industry].filter(Boolean).join(', ');
  if (line) { if (line.textContent !== what) line.textContent = what || ''; line.hidden = !what; }
  renderTickerContext(documentRef, documentRef.getElementById('ticker-hero-context'), { root, store, symbol: id, name: profile.name, row: listingRow, rows });
  const earnings = root?.[EARNINGS_CALENDAR.key]?.earnings || [];
  const briefs = (root?._aioEventBriefs?.briefs || []).filter((brief) => brief?.kind === 'earnings' && String(brief?.symbol || '').toUpperCase() === id);
  const watched = (root?._aioWatchlistGet?.() || []).includes(id);
  const signature = JSON.stringify([id, story?.researchedAt || null, profile.name, profile.description, profile.sourceUrl, profile.sector, profile.industry, profile.kind, !!graph, !!capital, place.inMap, place.capital.length, money.rows.map((item) => item.value), moneyEmpty, peer?.strength || null, peer?.weakness || null,
    earnings.filter((item) => String(item?.symbol || '').toUpperCase() === id).map((item) => `${item.date}:${item.epsActual ?? item.revenueActual ?? ''}`), briefs.map((brief) => brief.eventDate), String(quarterText || '').split(';').at(-1), watched]);
  if (host.dataset.signature !== signature) {
    // A repaint keeps the folds the reader opened (matched by their summary text).
    const opened = new Set([...host.querySelectorAll('details[open] > summary')].map((node) => node.textContent));
    const actions = [];
    if (typeof root?._aioWLToggle === 'function') {
      // v58.80 (first-users run-3 B15): the button says whether the stock is in a 관심 종목 list and toggles the one store.
      const watch = documentRef.createElement('button');
      watch.type = 'button';
      watch.className = 'aio-btn-table';
      watch.textContent = watched ? '관심 종목에서 빼기' : '관심 종목에 추가';
      watch.setAttribute('aria-pressed', watched ? 'true' : 'false');
      watch.addEventListener('click', () => { root._aioWLToggle(id); again(); });
      actions.push(watch);
    }
    actions.push(companyAskButton(documentRef, root, id, { fund: etf }));
    renderCompanyOverview(documentRef, host, { symbol: id, story, profile, place, money, moneyEmpty, peer, earnings, briefs, quarters: String(quarterText || ''), actions,
      openTicker: (symbol) => root?.showTicker?.(symbol),
      industry: story ? industryFor(story) : null,
      openIndustry: (domain) => navigateKnowledgeRoute({ root, page: 'atlas', params: { mode: 'taxonomy', domain, view: 'domain' } }),
      openMap: (where) => navigateKnowledgeRoute({ root, page: 'atlas', params: aiMapRouteParams({ map: where.layer ? 'value-chain' : 'capital', layer: where.layer?.n ?? null, node: id }) }),
      openFundamental: () => root?.showPage?.('fundamental') });
    for (const summary of host.querySelectorAll('details > summary')) if (opened.has(summary.textContent)) summary.parentElement.open = true;
    host.dataset.signature = signature;
  }
  host.hidden = false;
}

function summaryState(root, state) {
  const id = String(root?._currentTickerId || state?.id || '').trim().toUpperCase();
  const summary = root?._aioEntitySummaries?.[id];
  if (!summary) return state?.id === id ? state : { ...state, id, name: root?._currentTickerName || id, quote: null, history: [] };
  const live = root?._liveData?.[id]?.quoteEnvelope || root?._liveData?.[id];
  const quote = live ? { ...live, value: live.price } : state?.quote;
  const history = (state?.id === id && (state.history?.length || 0) > summary.history.length) ? state.history : summary.history;
  return { ...state, id, name: summary.name, quote, history };
}

function renderTickerSecondarySymbols(documentRef, state, root) {
  const symbol = state?.id || String(root?._currentTickerId || '').trim().toUpperCase() || '—';
  // P1405: display continuity only (the 차트 · 기술 chart opens on it). The AI context scope stays
  // _currentTickerId, which the router clears outside entity routes.
  if (state?.id && root) setStockSubject({ root, documentRef, symbol: state.id, name: state.name && state.name !== state.id ? state.name : '' });
  // v57.76: the candle/entry symbol labels left with the 요약 tab's 최근 3봉 형태 section; only the subject hand-off remains.
  return symbol;
}

function tickerElement(documentRef, id) {
  return documentRef?.querySelector?.(`[id="${id}"]`) || null;
}

function renderTickerActivity(documentRef, root, state, portfolioState) {
  const id = state?.id || null;
  const quote = state?.quote || {};
  const live = id ? root?._liveData?.[id] || {} : {};
  const livePrice = finite(quote.value) ?? finite(live.price) ?? finite(live.regularMarketPrice);
  // First-users run 4: without a live quote the published close values the position, as the portfolio does.
  const close = livePrice == null && id ? lastPublishedClose(id, state, root) : null;
  const price = livePrice ?? (close ? close.value : null);
  // v59.49: a quote without a currency (fallback quotes) falls back to the listing currency, as the portfolio surface does;
  // an unknown currency let a KRW cost be subtracted from a USD price.
  const currency = quote.currency || live.currency || live.quoteEnvelope?.currency || close?.currency || (id ? listingCurrency(id) : null) || null;
  const holding = (Array.isArray(portfolioState?.holdings) ? portfolioState.holdings : [])
    .find((item) => String(item?.symbol || '').toUpperCase() === String(id || '').toUpperCase());
  const shares = finite(holding?.shares);
  const avgCost = finite(holding?.avgCost);
  // v58.63 (architecture audit UI-02): a KRW cost basis was subtracted from a USD quote ("-$139,900"). A cost recorded in
  // another currency than the quote has no conversion here, so the P&L waits — as the portfolio surface does.
  const costCurrency = String(holding?.costCurrency || '').trim().toUpperCase() || null;
  const currencyConflict = !!(costCurrency && currency && costCurrency !== String(currency).toUpperCase());
  const pnl = !currencyConflict && price != null && shares != null && avgCost != null ? (price - avgCost) * shares : null;
  const pnlPct = pnl != null && avgCost > 0 ? (price - avgCost) / avgCost * 100 : null;
  const valueNode = tickerElement(documentRef, 'ticker-hero-value');
  const pnlNode = tickerElement(documentRef, 'ticker-hero-pnl');
  const hasPosition = !!holding && shares != null && avgCost != null;
  if (valueNode) {
    valueNode.textContent = !hasPosition ? '포트폴리오에 없는 종목' : currencyConflict
      ? `원가 통화(${costCurrency})가 시세 통화와 달라 손익은 포트폴리오에서 환산합니다`
      : pnl == null
      ? '손익 계산 대기'
      : `${directionOf(pnl, 0) === 'up' ? '+' : directionOf(pnl, 0) === 'down' ? '-' : ''}${formatMoney(Math.abs(pnl), currency, { maximumFractionDigits: 0 })}${pnlPct == null ? '' : ` (${signedText(pnlPct, 1)}%)`}${livePrice == null && close ? `, ${Number(close.date.slice(5, 7))}/${Number(close.date.slice(8, 10))} 종가 기준` : ''}`;
    valueNode.dataset.aioTickerPnlRenderer = 'native';
    valueNode.setAttribute('data-source-kind', pnl == null ? 'unavailable' : 'portfolio-state');
    valueNode.setAttribute('data-source-label', pnl == null ? 'portfolio position or quote unavailable' : 'portfolio-state+entity-quote');
    valueNode.setAttribute('data-operational-use', 'reference-only');
  }
  if (pnlNode) {
    // v59.51 (content audit): a stock the reader does not hold shows no P&L line.
    pnlNode.hidden = !hasPosition;
    // v59.49: the direction class follows the sign (a loss carried the gain colour, 'pos', for any non-null P&L).
    pnlNode.className = `pnl${pnl == null ? '' : directionOf(pnl, 0) === 'up' ? ' pos' : directionOf(pnl, 0) === 'down' ? ' neg' : ' neutral'}`;
    pnlNode.dataset.aioTickerPnlRenderer = 'native';
    pnlNode.setAttribute('data-source-kind', pnl == null ? 'unavailable' : 'portfolio-state');
    pnlNode.setAttribute('data-source-label', pnl == null ? 'portfolio P&L unavailable' : 'portfolio-state+entity-quote');
    pnlNode.setAttribute('data-operational-use', 'reference-only');
  }
  const extensionNode = tickerElement(documentRef, 'ticker-hero-ext');
  if (extensionNode) {
    const extPrice = finite(live.extPrice ?? live.postMarketPrice);
    const extPct = finite(live.extPct ?? live.postMarketChangePercent);
    const session = live.extSession === 'pre' || live.extSession === 'after' ? live.extSession : (typeof root?._getUsSession === 'function' ? root._getUsSession() : 'unknown');
    const visible = (session === 'pre' || session === 'after') && extPrice != null;
    extensionNode.textContent = visible
      ? `${session === 'pre' ? 'Pre' : 'After'} ${formatMoney(extPrice, currency)}${extPct == null ? '' : ` (${signedText(extPct, 2)}%)`}`
      : '';
    extensionNode.style.display = visible ? '' : 'none';
    extensionNode.dataset.aioTickerExtensionRenderer = 'native';
    extensionNode.setAttribute('data-source-kind', visible ? 'live' : 'unavailable');
    extensionNode.setAttribute('data-source-label', visible ? 'live:extended-session' : 'extended-session unavailable');
    extensionNode.setAttribute('data-operational-use', 'reference-only');
  }
}

function renderTickerNavigation(documentRef, state, root) {
  const breadcrumb = tickerElement(documentRef, 'ticker-breadcrumb-main');
  const backButton = tickerElement(documentRef, 'ticker-back-btn-main');
  const hasSelection = !!state?.id || !!String(root?._currentTickerId || '').trim();
  const fundamentalLink = tickerElement(documentRef, 'ticker-fundamental-link');
  if (fundamentalLink) {
    const symbol = String(state?.id || root?._currentTickerId || '').trim();
    fundamentalLink.disabled = !symbol;
    // 2026-10-13 review S12: a KRX listing's filings are Korean (DART), not SEC.
    fundamentalLink.textContent = symbol ? `${symbol} ${/\.K[SQ]$/i.test(symbol) ? '한국 공시(DART)' : 'SEC'} 재무 보기` : '종목 선택 후 재무 공시 보기';
    fundamentalLink.setAttribute('aria-label', fundamentalLink.textContent);
  }
  // P1505: with no symbol the page showed an empty price block, chart circle and factor panel; it now shows the
  // search only (CSS on .is-empty), which is the one action available.
  documentRef.getElementById?.('page-ticker')?.classList.toggle('is-empty', !hasSelection);
  if (!hasSelection) {
    if (breadcrumb) { breadcrumb.textContent = '종목'; breadcrumb.setAttribute('aria-label', '종목'); }
    if (backButton) { backButton.textContent = '← 돌아가기'; backButton.setAttribute('aria-label', '돌아가기'); }
    return;
  }
  const origins = { screener: '스크리너', themes: '테마와 섹터', portfolio: '포트폴리오', fundamental: '재무 공시', technical: '차트', 'market-news': '뉴스', briefing: '브리핑', masters: '대가 보유 종목', home: '오늘' };
  const requestedOrigin = root?.AIO?.state?.tickerReturnRoute;
  // P1599 (S01): with no recorded entry route (left menu, search, a shared link) there is no screen to name —
  // the old default printed '← 재무 공시' for a page the reader never came from. The tabs already move between views.
  if (!Object.hasOwn(origins, requestedOrigin)) {
    if (breadcrumb) { breadcrumb.hidden = false; breadcrumb.textContent = '종목'; breadcrumb.setAttribute('aria-label', '종목'); breadcrumb.removeAttribute('data-action'); breadcrumb.removeAttribute('role'); breadcrumb.removeAttribute('tabindex'); }
    if (backButton) backButton.hidden = true;
    return;
  }
  if (backButton) backButton.hidden = false;
  // P1599 (G03): the back button already names the origin; the same word printed beside it read as a third link.
  if (breadcrumb) breadcrumb.hidden = true;
  const origin = requestedOrigin;
  const label = origins[origin];
  if (breadcrumb) {
    breadcrumb.textContent = label;
    breadcrumb.setAttribute('aria-label', label);
    breadcrumb.setAttribute('data-action', 'showPage');
    breadcrumb.setAttribute('data-arg', origin);
    breadcrumb.setAttribute('role', 'button');
    breadcrumb.setAttribute('tabindex', '0');
  }
  if (backButton) {
    backButton.textContent = `← ${label}`;
    backButton.setAttribute('aria-label', `${label} 화면으로 돌아가기`);
    backButton.setAttribute('data-action', 'showPage');
    backButton.setAttribute('data-arg', origin);
  }
}


// v57.81: why an out-of-universe listing has no SEC filing on screen (never an estimate in its place).
const ON_DEMAND_SEC_STATUS = Object.freeze({
  'no-cik': '○ 랭킹 대상 밖 종목, SEC 등록번호(CIK) 미확인 — 공시 미조회',
  unavailable: '○ 랭킹 대상 밖 종목, SEC 공시 조회 실패',
  'no-annual-facts': '○ 랭킹 대상 밖 종목, SEC 연간 공시 항목 없음',
  'no-current-fields': '○ 랭킹 대상 밖 종목, 현재 기준에 맞는 연간 공시 없음',
  'not-applicable': '○ ETF, 기업 재무 공시 대상 아님'
});

function renderFundamentalStatus(documentRef, state, onDemand = null) {
  const element = documentRef?.getElementById('fund-data-status');
  if (!element) return;
  const fundamentals = state?.fundamentals;
  const available = !!fundamentals && typeof fundamentals === 'object'
    && Array.isArray(fundamentals.coverage) && fundamentals.coverage.length > 0;
  const observedAt = fundamentals?.observedAt || fundamentals?.filedAt || null;
  const unselected = !String(state?.id || '').trim(); // P1365: no selection ≠ SEC 미수신.
  // v59.51 (content audit): one filing date per page — it is on the 재무 흐름 basis line; the badge names the source only.
  element.textContent = available ? '● SEC 연간 공시' : unselected ? '○ 종목 선택 전' : isKrSymbol(state?.id) ? '○ 한국 공시(DART) 기준, SEC 대상 아님' : ON_DEMAND_SEC_STATUS[onDemand?.secStatus] || '○ SEC 데이터 미수신';
  element.className = 'freshness-badge fb-static';
  element.setAttribute('data-source-kind', available ? (fundamentals.sourceTier || 'official-regulator') : 'unavailable');
  element.setAttribute('data-source-label', available ? (fundamentals.source || 'SEC EDGAR companyfacts') : 'sec-fundamentals.json');
  element.setAttribute('data-operational-use', 'reference-only');
  if (observedAt) { element.setAttribute('data-observed-at', observedAt); element.title = `회계연도 말 ${String(observedAt).slice(0, 10)}`; }
  else { element.removeAttribute('data-observed-at'); element.removeAttribute('title'); }
  element.setAttribute('data-cadence', 'annual'); // codex audit F16: a fiscal-year-end date is judged by the filing cadence, not two sessions
  renderFundamentalEmpty(documentRef, unselected);
}

// v59.70 (screen review #18): before a stock is chosen the page was a '종목 선택 전' pill over an empty SEC fold; it is the
// shared empty state with the action that fills it (the hub's 종목 고르기: the command search's 종목 scope).
function renderFundamentalEmpty(documentRef, unselected) {
  const status = documentRef.getElementById('fund-data-status');
  const report = documentRef.getElementById('fund-native-sec-report');
  let host = documentRef.getElementById('fund-empty-state');
  if (status) status.hidden = unselected;
  if (!unselected) { host?.remove(); return; }
  if (!host) {
    host = documentRef.createElement('section');
    host.id = 'fund-empty-state';
    host.className = 'briefing-block sx-card fund-empty';
    host.setAttribute('aria-label', '재무 공시');
    (report || documentRef.getElementById('fund-next'))?.before(host);
  }
  if (host.firstElementChild?.dataset.state === 'empty') return;
  const root = documentRef.defaultView;
  renderDataState(host, {
    state: 'empty',
    text: '고른 종목이 없습니다',
    action: { label: '종목 고르기', haspopup: 'dialog', onClick: () => { if (!root?._aioOpenCommandSearch?.({ scope: 'stock' })) root?.showPage?.('ticker'); } },
  });
}

// v58.76: the developer-only SEC 연간 재무 스캔 (summary line + watchlist cards) is retired; 재무 흐름 and the company card read the filings.

function formatSecMetric(metric) {
  if (metric?.value == null) return '—';
  // P1591: compact units like the fiscal reading ($215.9B), not raw dollars; the exact value stays in the tooltip.
  const compact = (v) => { const a = Math.abs(v); return a >= 1e12 ? `${(a / 1e12).toFixed(2)}T` : a >= 1e9 ? `${(a / 1e9).toFixed(1)}B` : a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a.toLocaleString('en-US', { maximumFractionDigits: 0 }); };
  if (metric.unit === 'currency') return usdKoreanText(metric.value); // first-users F33
  if (metric.unit === 'shares') return `${compact(metric.value)}주`;
  if (metric.unit === 'percent') return `${metric.value.toFixed(1)}%`;
  return `${metric.value.toFixed(2)}x`;
}

function markSecReportElement(element, report) {
  if (!element) return;
  element.dataset.aioSecReportRenderer = 'native';
  element.setAttribute('data-source-kind', report.status === 'current' ? report.sourceKind : 'unavailable');
  element.setAttribute('data-source-label', report.status === 'current' ? report.source : 'sec-fundamentals.json');
  element.setAttribute('data-operational-use', 'reference-only');
  element.setAttribute('data-freshness-state', report.freshness?.state || 'unknown');
  element.setAttribute('data-decision-eligible', report.decisionEligible === true ? 'true' : 'false');
  if (report.observedAt) element.setAttribute('data-observed-at', report.observedAt);
  else element.removeAttribute('data-observed-at');
}

// P1449: the arrival note for a learning link — user vocabulary only (ROIC·CAPEX·FCF 본 labels);
// a metric this page does not present keeps the note hidden instead of leaking a raw id.
const FUNDAMENTAL_METRIC_LABELS = Object.freeze({
  // P1593 (F98): the column links send these ids; without them the arrival line stayed hidden.
  fcf_roic: '번 돈이 현금으로 남는지(잉여현금흐름)와 투입한 자본 대비 얼마나 버는지(ROIC)',
  dcf_expectations: '지금 주가가 가정하는 성장과 마진(역산 DCF) — 아래 매출·이익률 추이와 비교',
  roe: 'ROE(자본 효율)',
  revenue: '매출',
  margin: '순이익률',
  pe: 'PER(밸류에이션)',
  pb: 'PBR',
  ocf: '영업현금흐름',
  capex: '설비투자(CAPEX)',
  fcf: '잉여현금흐름(FCF)',
  roic: 'ROIC(투하자본 수익률)',
  debt: '부채',
  shares: '주식 수'
});
function renderFundamentalArrival(documentRef, { metric, question, symbol, fromRoute, timeframe = null, returnContext = null, root = null }) {
  const note = documentRef?.getElementById('fund-arrival-question');
  if (!note) return;
  note.querySelector?.('.fund-arrival-return')?.remove?.();
  const metricLabel = metric ? FUNDAMENTAL_METRIC_LABELS[String(metric).toLowerCase()] || null : null;
  const text = metricLabel || question;
  if (!text) { note.hidden = true; return; }
  const period = { TTM_3Y: '최근 12개월과 3년', '5Y': '5년', '3Y_5Y': '3~5년' }[String(timeframe || '')] || null;
  note.textContent = `${fromRoute ? `${fromRoute} 링크에서 넘어온 확인 대상: ` : '이 화면으로 건너온 확인 대상: '}${text}${period ? `, 볼 기간 ${period}` : ''}${symbol ? `, 대상 종목 ${symbol}(아래 보고에서 함께 확인)` : ', 종목을 선택해 아래 보고에서 함께 확인하세요'}${metricLabel && question ? ` — ${question}` : ''}`;
  if (returnContext?.route) {
    const back = documentRef.createElement('button');
    back.type = 'button';
    back.className = 'aio-btn-table fund-arrival-return';
    back.style.marginLeft = '8px';
    back.textContent = '읽던 이야기로 돌아가기';
    back.addEventListener('click', () => { if (typeof root?.history?.back === 'function') root.history.back(); else root?.showPage?.(returnContext.route); });
    note.appendChild(back);
  }
  note.hidden = false;
}

function renderFundamentalReport(documentRef, page, state) {
  const report = deriveSecReport(state?.fundamentals);
  // P1365: no selected issuer is not an SEC receipt failure; the watchlist below carries SEC rows.
  const unselected = !String(state?.id || '').trim();
  if (page) {
    page.dataset.aioFundamentalReportRenderer = 'native';
    page.dataset.aioSecReportModel = report.modelVersion;
  }
  const container = documentRef?.getElementById('fund-native-sec-report');
  const title = documentRef?.getElementById('fund-native-sec-title');
  const meta = documentRef?.getElementById('fund-native-sec-meta');
  const coverage = documentRef?.getElementById('fund-native-sec-coverage');
  const grid = documentRef?.getElementById('fund-native-sec-grid');
  markSecReportElement(container, report);
  markSecReportElement(title, report);
  markSecReportElement(meta, report);
  markSecReportElement(coverage, report);
  markSecReportElement(grid, report);
  if (title) title.textContent = report.entityName || report.symbol ? `SEC 연간 공시 요약, ${report.entityName || report.symbol}` : 'SEC 연간 공시 요약';
  // v59.56 (screen review): a Korean listing has no SEC report; the DART card above says so, and the empty SEC fold under it
  // only repeated that, so it is not shown for .KS/.KQ.
  const secFold = documentRef?.getElementById('fund-native-sec-report');
  if (secFold) secFold.hidden = isKrSymbol(state?.id) || unselected; // v59.70 (#18): the empty state stands in before a pick
  if (meta) {
    // P1591 (S08): the reader line says which report and how old it is; filing ledger details
    // (acceptance time, accession, point-in-time count) move to the tooltip.
    meta.textContent = report.status === 'current'
      ? `${report.form || '연간 보고서'}, 회계연도 말 ${report.observedAt || '—'}, 제출 ${report.filedAt || '—'}${report.freshness?.ageDays != null ? `, 회계연도 말로부터 ${report.freshness.ageDays}일` : ''}${report.freshness?.state && report.freshness.state !== 'current' ? ', 최신 연간 보고서 아님' : ''}`
      : unselected ? '선택한 종목 없음, 티커를 입력하거나 관심종목을 선택하면 해당 기업의 SEC 연간 보고서를 표시합니다'
        : isKrSymbol(state?.id) ? '한국 상장 종목은 SEC 연간 보고서 대상이 아닙니다, 연간 재무는 한국 공시(DART) 기준'
          : 'SEC 연간 보고서를 아직 받지 못했습니다, 값이 없는 항목은 추정하지 않습니다';
    if (report.status === 'current') meta.title = [report.filingMetadata?.acceptedAt ? `접수 ${report.filingMetadata.acceptedAt}` : null, report.accession ? `접수번호 ${report.accession}` : null, report.pointInTime?.observationCount ? `시점 기록(PIT) ${report.pointInTime.observationCount}건 (${report.pointInTime.status})` : null].filter(Boolean).join(', ');
    if (report.filingUrl && report.status === 'current') {
      const original = documentRef.createElement('a');
      original.href = report.filingUrl; original.target = '_blank'; original.rel = 'noopener noreferrer';
      original.textContent = 'SEC 공시 원문';
      original.setAttribute('aria-label', `${report.entityName || report.symbol || ''} ${report.form || ''} 제출 ${report.filedAt || ''} SEC 공시 원문 새 창`);
      meta.append(documentRef.createTextNode(', '), original);
    }
  }
  if (coverage) {
    coverage.textContent = report.status === 'current'
      ? `관측 항목 ${report.coverage.length}개, ${report.freshness?.state === 'current' ? '현재 참고 가능' : '과거 참고 전용'}`
      : unselected ? '선택 기업 없음' : '관측 항목 없음';
    if (report.status === 'current' && report.source) coverage.title = report.source; else coverage.removeAttribute?.('title');
  }
  if (!grid) return;
  grid.replaceChildren();
  if (report.metrics.length === 0) {
    const empty = documentRef.createElement('div');
    empty.textContent = unselected ? '종목을 선택하면 핵심 재무 지표가 표시됩니다.' : isKrSymbol(state?.id) ? '한국 상장 종목의 주요 재무는 한국 공시(DART) 수집 뒤 표시됩니다. 지금은 DART 원문에서 확인합니다.' : 'SEC 연간 공시를 받으면 핵심 재무 지표가 표시됩니다.';
    empty.className = 'fsr-empty';
    grid.appendChild(empty);
    return;
  }
  for (const metric of report.metrics) {
    const card = documentRef.createElement('div');
    card.className = 'fsr-item';
    const label = documentRef.createElement('div');
    label.textContent = metric.label;
    label.className = 'fsr-label';
    const value = documentRef.createElement('div');
    value.textContent = formatSecMetric(metric);
    value.className = 'fsr-value';
    card.append(label, value);
    grid.appendChild(card);
  }
}

// RM-01 (2026-07-19): every id this module used to write (ticker-m-*,
// fund-analysis-text, opt-pcr-val-secondary, the candle/entry symbol labels retired in v57.76) has a
// live legacy writer in js/aio-core.js/aio-data.js or an inline index.html script
// (route-owners.json legacyWriterEvidence). P777 transfers only the ticker hero
// name/fullname/price/change primary surface; P817 transfers ticker candle/entry symbol labels.
// P778 transfers only the three options replacement-metric values; P779 transfers only the
// SEC annual-data availability/source badge on fundamental. P815 transfers only the bounded
// SEC-derived summary line; options-chain, report sections, charts, and AI narrative remain
// legacy-owned.
function render({ root, documentRef, store, route }) {
  const selected = selectEntityState(store.getState());
  const state = route === 'ticker' ? summaryState(root, selected) : selected;
  const portfolioState = selectPortfolioState(store.getState());
  const routeNode = documentRef?.getElementById(`page-${route}`);
  if (routeNode) {
    routeNode.dataset.aioArchitectureRoute = route;
    routeNode.dataset.aioArchitectureSlice = 'entity';
    routeNode.dataset.aioArchitectureStatus = state?.status || 'unavailable';
    if (route === 'ticker' || route === 'fundamental') routeNode.dataset.aioArchitectureRenderer = 'native';
  }
  if (route === 'ticker') {
    renderTickerHero(documentRef, state, root);
    renderTickerSecondarySymbols(documentRef, state, root);
    renderTickerActivity(documentRef, root, state, portfolioState);
    renderTickerNavigation(documentRef, state, root);
    renderTickerStart({ documentRef, root, portfolioState, show: !state?.id && !String(root?._currentTickerId || '').trim() });
    installStockLensGlobal(root); // the AI panel's stock readings (window._aioStockLensFor)
    renderCompanyAnalysis({ documentRef, root, state }); // the 시총·PER line and the AI company model
    renderOverview(documentRef, root, state, store);
    // The reader's own notes close the overview (a section on the face, not a fold or a view).
    const memo = ensureResearchSnapshots({ documentRef, root, host: routeNode, kind: 'stock', open: true, collect: () => ({ kind: 'stock',
      symbol: state?.id, name: state?.name, quote: { ...state?.quote, basis: state?.quote?.changeBasis || 'unknown' } }) });
    // 재무 공시's '이 조건으로 내 메모 시작' hands the thesis template over; it lands once the requested company is drawn.
    if (state?.id && state.id === String(root?._currentTickerId || '').trim().toUpperCase()) {
      const handoff = consumeResearchHandoff({ root, routeId: 'ticker', symbol: state.id });
      if (handoff) focusResearchMemo(memo, handoff.context.memoTemplate);
    }
  }
  if (route === 'fundamental') {
    // P1430: 재무 공시 is the same company as 요약 · 차트.
    if (state?.id) setStockSubject({ root, documentRef, symbol: state.id, name: state.name && state.name !== state.id ? state.name : '' });
    // P1449 (검토판 9): a learning link (ROIC · CAPEX · FCF) that arrives must say what it
    // came to check and on which company — the route opened is not the same as the question
    // continuing. One-shot consume; unknown metrics show nothing rather than dev vocabulary.
    const handoff = consumeResearchHandoff({ root, routeId: 'fundamental' });
    const knowledge = parseKnowledgeTargetContext({ root });
    const arrivingTicker = handoff?.context?.ticker || null;
    if (arrivingTicker) setStockSubject({ root, documentRef, symbol: arrivingTicker });
    renderFundamentalArrival(documentRef, {
      metric: handoff?.context?.metric || knowledge?.metric || null,
      question: handoff?.context?.question || null,
      symbol: state?.id || arrivingTicker || null,
      fromRoute: handoff?.fromRoute || (knowledge ? '리서치 라이브러리' : null),
      timeframe: knowledge?.timeframe || null,
      returnContext: knowledge?.returnContext || null,
      root
    });
    // v57.81: a US listing outside the screener universe reads its SEC filing on demand (session cache, two at a time);
    // the record's arrival re-renders through 'aio:entityChanged', and a missing CIK says so instead of '미수신'.
    const onDemandId = String(state?.id || '').trim().toUpperCase();
    // A screener ETF row is the same fact the on-demand check reaches later ('not-applicable'): no company filings.
    let etfRow = false;
    try { etfRow = !!onDemandId && (root?._aioGetCanonicalScreenerRows?.() || []).some((row) => row?.sym === onDemandId && (row.sector === 'ETF' || row.index === 'ETF')); } catch (_) { etfRow = false; }
    const onDemand = onDemandId && !isKrSymbol(onDemandId) && !state?.fundamentals ? root?._aioOnDemandSymbol?.(onDemandId) || null : null;
    if (onDemandId && !isKrSymbol(onDemandId) && !state?.fundamentals && !onDemand && !etfRow) root?._aioRequestOnDemandSymbol?.(onDemandId)?.catch?.(() => {});
    renderFundamentalStatus(documentRef, state, etfRow && !state?.fundamentals ? { secStatus: 'not-applicable' } : onDemand);
    renderFundamentalReport(documentRef, routeNode, state);
    // v58.55 (3d) → v59.51: 듀폰 분해 + 역 DCF live in 재무 공시's 투자 논지 틀 fold. The price is the screener's completed-session
    // valuation close (the same close its P/E uses), else the latest dated close; never the live quote, so the calculator
    // does not move with every tick.
    const analysisId = String(state?.id || '').toUpperCase();
    let analysisRow = null;
    try { analysisRow = (root?._aioGetCanonicalScreenerRows?.() || []).find((item) => item?.sym === analysisId) || null; } catch (_) { analysisRow = null; }
    const valuationClose = finite(analysisRow?._valuationPrice ?? analysisRow?._valuationPePrice ?? analysisRow?.valuationPrice);
    const valuationDate = String(analysisRow?.factorSessionDate || '').slice(0, 10);
    const close = valuationClose > 0 && isIsoDay(valuationDate) ? { value: valuationClose, date: valuationDate, shares: finite(analysisRow?._valuationSharesOutstanding), sharesObservedAt: analysisRow?._valuationSharesObservedAt || null } : analysisId ? lastPublishedClose(analysisId, state, root) : null;
    renderFiscalRead({ documentRef, root, state, close }); // P1436
    // The company's own account of the period, read from its researched story (asked for here when 재무 공시 opens first).
    const paintReport = () => renderCompanyReport(documentRef, documentRef?.getElementById('fund-company-report'), { story: analysisId ? companyStoryFor(root, analysisId) : null });
    if (analysisId && !companyStoryFor(root, analysisId)) requestCompanyStory(root, analysisId, paintReport);
    paintReport();
    // The latest earnings release of this company leads, then the company's own account, then the filings.
    const flow = documentRef?.getElementById('fund-company-report') || documentRef?.getElementById('fund-flow');
    if (analysisId) paintTickerBrief(documentRef, root, analysisId, flow, () => render({ root, documentRef, store, route }));
    else { const brief = documentRef?.getElementById('fund-event-brief'); if (brief) brief.hidden = true; }
  }
}

export function createEntityPage({ root = globalThis, documentRef, store, route = 'ticker' } = {}) {
  // v58.80 (first-users run-4): the 차트 tab's failure names the same last close the 요약 header shows.
  if (root && !root._aioLastPublishedClose) root._aioLastPublishedClose = (sym) => lastPublishedClose(sym, null, root);
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const hydrator = route === 'ticker' ? createSummaryHydrator({ root,
        onReady: () => {
          const EventConstructor = root.CustomEvent || globalThis.CustomEvent;
          if (typeof EventConstructor === 'function') documentRef?.dispatchEvent?.(new EventConstructor('aio:entityChanged', { detail: { source: 'summary-hydration', id: root._currentTickerId } }));
          renderNow();
        }, onStatus: (status, id) => {
          root._aioEntitySummaryStatus ||= {}; root._aioEntitySummaryStatus[id] = status;
          const page = documentRef?.getElementById('page-ticker');
          if (page) page.dataset.summaryHydrationStatus = status;
          if (status !== 'unavailable') return;
          // Live review 2026-10-14: a failure arrives without onReady, so the hero and chart re-render once to drop '불러오는 중'.
          Promise.resolve().then(() => {
            if (root?._currentTickerId && String(root._currentTickerId).toUpperCase() === id) renderNow();
            const label = documentRef?.getElementById('ticker-summary-price-basis');
            if (!label || root?._liveData?.[id]?.price || documentRef?.getElementById('ticker-hero-price')?.dataset.priceBasis === 'last-close') return;
            const quoteFailed = '시세를 불러오지 못했습니다, 잠시 후 종목을 다시 선택해 확인하세요';
            if (typeof root?._aioIsKnownTicker !== 'function' || root._aioIsKnownTicker(id)) { label.textContent = quoteFailed; return; }
            // v57.81: a symbol outside AIO's registries may still be US-listed — the lazy official listing decides (exact
            // symbol). Unchecked (listing unavailable) reads as a quote failure, never as "not listed".
            label.textContent = quoteFailed;
            Promise.resolve(typeof root?._aioCheckUsListing === 'function' ? root._aioCheckUsListing(id) : { listed: false }).then((listing) => {
              if (String(root?._currentTickerId || '').toUpperCase() !== id || root?._liveData?.[id]?.price) return;
              label.textContent = listing?.listed === true ? `미국 상장 종목${listing.name ? `(${listing.name})` : ''}, ${quoteFailed}`
                : listing?.listed === false ? 'AIO에 등록된 종목이 아니고 미국 상장 목록에도 없습니다, 티커 철자를 확인하세요' : quoteFailed; // v57.54 review: NVDAA is not a slow source
              // v57.83: a one-word company name ("Opendoor") has ticker shape and lands here; offer listing-name candidates.
              if (listing?.listed === false && /^[A-Z]{3,12}$/.test(id) && typeof root?._aioTickerSearchMiss === 'function') root._aioTickerSearchMiss(id);
            }).catch(() => {});
          });
        } }) : null;
      if (hydrator) bag.add(() => hydrator.dispose());
      const renderNow = () => {
        if (hydrator) hydrator.ensure(root?._currentTickerId || selectEntityState(store.getState())?.id || '');
        render({ root, documentRef, store, route });
      };
      renderNow();
      bag.add(subscribeToSlices(store, ['entity', 'portfolio'], renderNow));
      const eventTarget = documentRef || globalThis;
      const refresh = () => renderNow();
      const onPageShown = (event) => {
        const detail = event?.detail;
        const shownRoute = typeof detail === 'string' ? detail : detail?.pageId || detail?.route;
        if (route === 'ticker' && shownRoute === 'ticker') refresh();
      };
      // P1430: 재무 공시 opened from 요약 · 차트 loads the company those tabs show (the legacy search owns
      // the input and the full report). Leaving the entity routes clears the selection, so the subject
      // (display continuity) re-requests it on mount unless that company's report was already requested.
      if (route === 'fundamental') {
        const subject = String(root?._aioLastOpenedSymbol || '').trim().toUpperCase();
        // P1593 (F107/E04): compare against the company actually loaded, not the last one ever requested — leaving
        // the entity routes clears the selection, and the old guard then left '종목 선택 전' beside the same ticker.
        const loaded = String(selectEntityState(store.getState())?.id || '').trim().toUpperCase();
        if (subject && loaded !== subject && typeof root?.fundamentalSearch === 'function') {
          root._aioFundRequestedSymbol = subject;
          const timer = setTimeout(() => root.fundamentalSearch(subject), 0);
          bag.add(() => clearTimeout(timer));
        }
      }
      ['aio:liveQuotes', 'aio:refresh:done', 'aio:sentimentUpdated', 'aio:serverDataLoaded', 'aio:rotationDetailLoaded', 'aio:entityChanged'].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, refresh);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, refresh));
      });
      // The refresh scheduler announces on window; the document registration above stays.
      if (typeof root?.addEventListener === 'function' && root !== eventTarget) {
        root.addEventListener('aio:refresh:done', refresh);
        bag.add(() => root.removeEventListener?.('aio:refresh:done', refresh));
      }
      eventTarget?.addEventListener?.('aio:pageShown', onPageShown);
      bag.add(() => eventTarget?.removeEventListener?.('aio:pageShown', onPageShown));
      const page = documentRef?.getElementById(`page-${route}`);
      let suppliedMaterialBridge = page?.querySelector?.(`[data-aio-supplied-material-route="${route}"]`) || null;
      if (page && !suppliedMaterialBridge) {
        suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
          routeId: route,
          heading: route === 'ticker' ? '종목, AI 경제성·자본·13F 맥락' : route === 'fundamental' ? '펀더멘털, 매출 전환·소프트웨어·Physical AI' : '옵션, 이벤트·시장 리스크 정렬'
        });
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge?.remove?.());
      }
      if (route === 'fundamental') {
        const report = documentRef?.getElementById('page-fundamental');
        bag.add(() => {
          if (report?.dataset.aioFundamentalReportRenderer === 'native') delete report.dataset.aioFundamentalReportRenderer;
          if (report?.dataset.aioSecReportModel) delete report.dataset.aioSecReportModel;
          report?.querySelectorAll?.('[data-aio-sec-report-renderer="native"]')?.forEach((element) => {
            delete element.dataset.aioSecReportRenderer;
            delete element.dataset.sourceKind;
            delete element.dataset.sourceLabel;
            delete element.dataset.operationalUse;
            delete element.dataset.observedAt;
          });
        });
      }
      if (route === 'ticker') {
        ['ticker-hero-ext', 'ticker-hero-pnl', 'ticker-hero-value'].forEach((id) => { // v57.76: candle/entry symbol labels retired
          const element = documentRef?.getElementById(id);
          if (!element) return;
          if (id === 'ticker-hero-ext') element.dataset.aioTickerExtensionRenderer = 'native';
          else if (id === 'ticker-hero-pnl' || id === 'ticker-hero-value') element.dataset.aioTickerPnlRenderer = 'native';
          else element.dataset.aioTickerSymbolRenderer = 'native';
          bag.add(() => {
            if (element?.dataset.aioTickerSymbolRenderer === 'native') delete element.dataset.aioTickerSymbolRenderer;
            if (element?.dataset.aioTickerExtensionRenderer === 'native') delete element.dataset.aioTickerExtensionRenderer;
            if (element?.dataset.aioTickerPnlRenderer === 'native') delete element.dataset.aioTickerPnlRenderer;
          });
        });
      }
      const routeNode = documentRef?.getElementById(`page-${route}`);
      bag.add(() => {
        if (routeNode?.dataset.aioArchitectureRenderer === 'native') delete routeNode.dataset.aioArchitectureRenderer;
        if (routeNode?.dataset.aioArchitectureRoute === route) delete routeNode.dataset.aioArchitectureRoute;
        if (routeNode?.dataset.aioArchitectureSlice === 'entity') delete routeNode.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
