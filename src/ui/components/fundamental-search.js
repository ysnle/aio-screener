// Legacy unification (2026-10-27, roadmap item 11, layer 1 채팅): the 종목 · 재무 공시 search (the search box, its 최근
// 검색 list, the report reset and the SEC/Yahoo collection that feeds the js/aio-ui.js _renderFund* renderers) moved
// here from js/aio-chat.js, which only hosted it. Texts, the 8 s collection deadline, the 30 minute report cache, the
// request epoch and the AI question prefill are unchanged. The legacy collectors and renderers are still called
// through their window names; src/app/legacy-screen-bridges.js installs fundamentalSearch, fundSearchQuick,
// _fundRecentSearches and _resetFundamentalReport.
import { readRecentSymbols, rememberRecentSymbol } from '../../data/stock-subject-store.js';

const esc = (root, s) => (typeof root.escHtml === 'function' ? root.escHtml(String(s)) : String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
const log = (root, level, area, msg) => { if (typeof root._aioLog === 'function') root._aioLog(level, area, msg); };
const CHART_IDS = ['fund-growth-chart', 'fund-profitability-chart', 'fund-balance-chart', 'fund-cashflow-chart', 'fund-liquidity-chart', 'fund-curratio-donut', 'fund-workingcap-chart'];
const REPORT_TTL_MS = 30 * 60 * 1000;
const FUND_PROMPT = ' 종합 기업 분석해줘. 아래 17개 관점과 데이터 가용성 매트릭스를 모두 다뤄줘:\n1)기업 개요 2)설립 배경&성장 과정 3)경영진 분석 4)비즈니스 모델 5)제품 포트폴리오 6)기술력&해자 7)수익 구조 8)재무제표 분석 9)밸류에이션 10)시장 분석(TAM) 11)수요·공급망 12)파트너십 13)경쟁 구조 14)리스크 15)촉매·실적수정 16)포트폴리오 적합성 17)투자 포인트';

// v33.4: the 최근 검색 list; a ticker is recorded first (the store keeps 8).
export function renderFundRecentSearches(ticker, { documentRef = globalThis.document, root = globalThis } = {}) {
  if (ticker) rememberRecentSymbol(root, ticker);
  const el = documentRef.getElementById('fund-recent-searches');
  if (!el) return;
  const list = readRecentSymbols(root);
  // P566/R257: the label and the data-arg are both escaped (the stored history is user input).
  el.innerHTML = list.map((t) => `<span class="aio-hover-fund-ticker" data-action="fundSearchQuick" data-arg="${esc(root, t)}">${esc(root, t)}</span>`).join('');
}

export function resetFundamentalReport(message, { documentRef = globalThis.document, root = globalThis } = {}) {
  root._fundAnalysisData = null;
  const radarWrap = documentRef.getElementById('vis-fundamental');
  const radar = documentRef.getElementById('vis-fundamental-radar');
  if (radarWrap) radarWrap.style.display = 'none';
  if (radar) radar.textContent = '';
  const container = documentRef.getElementById('fund-report-container');
  if (!container) return;
  container.style.display = 'block';
  container.querySelectorAll('[data-fund-tab]').forEach((node) => { node.style.display = 'none'; });
  container.querySelectorAll('[id$="-body"], #fund-rpt-header, #fund-rpt-fin-grid').forEach((node) => { node.textContent = ''; });
  const loading = documentRef.getElementById('fund-rpt-loading');
  if (loading) {
    loading.style.display = 'block';
    loading.innerHTML = `<div id="fund-rpt-progress" role="status" class="lch-fp-msg">${esc(root, message || '기업 데이터 확인 중')}</div>`;
  }
  CHART_IDS.forEach((id) => {
    if (root._aioChartRegistry && typeof root._aioChartRegistry.destroyIfExists === 'function') root._aioChartRegistry.destroyIfExists(id);
  });
}

// A 최근 검색 chip: the ticker goes into the box and the search runs.
export function fundSearchQuick(ticker, search, { documentRef = globalThis.document } = {}) {
  if (!ticker) return undefined;
  const searchInp = documentRef.getElementById('fund-search-input');
  if (searchInp) searchInp.value = ticker.toString().trim().toUpperCase();
  return search();
}

// The cached report is painted without the qualitative card, as before the move.
function renderReport(collected, root, { qualitative = true } = {}) {
  root._renderFundHeader(collected);
  if (qualitative && typeof root._renderFundQualitative === 'function') root._renderFundQualitative(collected);
  root._renderFundSEC(collected);
  root._renderFundFinancials(collected);
  root._renderFundStatements(collected);
  root._renderFundValuation(collected);
  if (typeof root._renderFundMultiPeriod === 'function') root._renderFundMultiPeriod(collected); // v48.89
  root._renderFundPeers(collected);
  root._renderFundEarnings(collected);
  if (typeof root._renderFundVariance === 'function') root._renderFundVariance(collected); // v48.90
  if (typeof root._renderFundNews === 'function') root._renderFundNews(collected); // v48.13
  root._renderFundSources(collected);
}

function renderRadar(ticker, root) {
  try {
    if (typeof root._aioRenderFundamentalRadar === 'function') {
      const rows = typeof root._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() : [];
      root._aioRenderFundamentalRadar(ticker, rows.find((r) => r.sym === ticker) || null);
    }
  } catch (_) { /* the radar is optional */ }
}

export function createFundamentalSearch({ documentRef = globalThis.document, root = globalThis } = {}) {
  const at = { documentRef, root };
  // The 재무 공시 report for the ticker in the search box (SEC EDGAR, Yahoo; the 7 quarterly charts load after). The
  // returned function takes no arguments, like the data-action and data-on-enter callers.
  async function fundamentalSearch() {
    const inp = documentRef.getElementById('fund-search-input');
    if (!inp) return;
    const ticker = inp.value.trim().toUpperCase();
    const requestEpoch = (root._fundRequestEpoch || 0) + 1;
    root._fundRequestEpoch = requestEpoch;
    const isCurrent = () => root._fundRequestEpoch === requestEpoch && root._currentTickerId === ticker;
    resetFundamentalReport(ticker ? `${ticker} 기업 데이터 확인 중` : '분석할 티커를 입력하세요.', at);
    // P566/R257: anything that does not look like a ticker (AAPL, 005930.KS, BRK-A) is never stored or searched.
    if (!ticker || !/^[A-Z0-9.\-]{1,12}$/.test(ticker)) {
      root._currentTickerId = '';
      root._currentTickerSym = '';
      root._currentTickerName = '';
      if (root.AIO && root.AIO.state) root.AIO.state._currentTickerSym = '';
      try { documentRef.dispatchEvent(new root.CustomEvent('aio:entityChanged', { detail: { id: null, source: 'fundamental-invalid-selection' } })); } catch (_) { /* no listener */ }
      const earlyProgress = documentRef.getElementById('fund-rpt-progress');
      const earlyContainer = documentRef.getElementById('fund-report-container');
      if (earlyContainer) earlyContainer.style.display = 'block';
      if (earlyProgress) earlyProgress.innerHTML = '<div class="lch-fp-err">올바른 티커 형식이 아닙니다 (예: AAPL, 005930.KS)</div>';
      return;
    }
    // The selection is published before the slower provider work, so the native entity slice can project the SEC row.
    root._currentTickerId = ticker;
    root._currentTickerName = ticker;
    try { documentRef.dispatchEvent(new root.CustomEvent('aio:entityChanged', { detail: { id: ticker, source: 'fundamental-search' } })); } catch (_) { /* no listener */ }
    renderFundRecentSearches(ticker, at);

    const container = documentRef.getElementById('fund-report-container');
    const progressEl = documentRef.getElementById('fund-rpt-progress');
    const loadingEl = documentRef.getElementById('fund-rpt-loading');
    if (container) container.style.display = 'block';
    if (loadingEl) loadingEl.style.display = 'block';

    // v48.8: a report from the last 30 minutes is painted again without the network.
    root._fundCache = root._fundCache || {};
    const cached = root._fundCache[ticker];
    if (cached && (Date.now() - cached._ts < REPORT_TTL_MS)) {
      const ageMin = Math.round((Date.now() - cached._ts) / 60000);
      if (progressEl) progressEl.innerHTML = `<div class="lch-fp-ok">캐시 사용: ${ageMin}분 전 분석 결과 (FMP 무료 250/day 보호)</div>`;
      const collected = cached.data;
      root._fundAnalysisData = collected;
      // v49.58 R106: the chat context follows the active company.
      if (collected && collected.ticker) root._currentTickerId = collected.ticker;
      try { renderReport(collected, root, { qualitative: false }); } catch (e) { log(root, 'warn', 'fund', `캐시 렌더 실패: ${e.message}`); }
      // v49.72 R138: the 7 quarterly charts (their own 5 minute cache).
      try {
        if (root.AIO && typeof root.AIO.fetchQuarterlyFinancials === 'function') {
          root.AIO.fetchQuarterlyFinancials(ticker).then((qd) => { if (isCurrent() && (!qd || !qd.ticker || qd.ticker === ticker)) root._renderFundamentalFinancialsCharts(qd); }).catch(() => {});
        }
      } catch (_) { /* charts are optional */ }
      if (loadingEl) {
        const srcList = (collected.sources || []).map((s) => esc(root, String(s || '')));
        loadingEl.innerHTML = `<div class="lch-fp-cache">캐시 데이터 (${ageMin}분 전) — ${srcList.length}개 소스</div><div class="lch-fp-src">${srcList.join(', ')}</div>`;
      }
      renderRadar(ticker, root);
      return;
    }

    const collected = { ticker, sources: [], ts: new Date().toISOString() };
    const deadline = Date.now() + 8000;
    const remaining = (cap) => Math.max(0, Math.min(cap, deadline - Date.now()));
    const updateProgress = (msg) => { if (isCurrent() && progressEl) progressEl.innerHTML += `<div>${esc(root, msg)}</div>`; };
    const withTimeout = (promise, ms, fallback) => root._withTimeout(promise, ms, fallback);

    // Yahoo and SEC in parallel within a bound: one stalled CORS/proxy chain still leaves a report in 8 s.
    if (progressEl) progressEl.innerHTML = '<div>Yahoo Finance 시세, SEC 공시/재무 병렬 조회 중...</div>';
    const [liveData, secFilings, secFin] = await Promise.all([
      withTimeout(root.dynamicTickerLookup(ticker), remaining(5200), null),
      withTimeout(root.fetchSECFilings(ticker), remaining(5200), null),
      withTimeout(root.fetchSECFinancials(ticker), remaining(5200), null)
    ]);
    if (!isCurrent()) return;
    if (liveData && liveData.price) {
      collected.price = liveData.price;
      collected.pct = liveData.pct != null ? liveData.pct : null;
      collected.name = liveData.name || ticker;
      collected.volume = liveData.volume;
      collected.sources.push('Yahoo Finance (시세)');
      updateProgress(`시세: $${liveData.price.toFixed(2)} (${root._fmtPct(liveData.pct)})`);
    } else { updateProgress('Yahoo Finance 응답 없음 — 확보된 데이터로 계속'); }
    if (secFilings) {
      collected.sec = secFilings;
      collected.sources.push('SEC EDGAR (공시 정보)');
      updateProgress(`SEC 공시: ${secFilings.name || ticker} | CIK: ${secFilings.cik || 'N/A'} | SIC: ${secFilings.sicDescription || 'N/A'}`);
      if (!collected.name || collected.name === ticker) collected.name = secFilings.name || ticker;
    } else { updateProgress('SEC 공시 시간 제한 — 부분 데이터로 분석'); }
    if (secFin && root.AIO && typeof root.AIO.loadSecStatements === 'function' && typeof root.AIO.parseSecStatements !== 'function') {
      await root.AIO.loadSecStatements().catch(() => null); // v59.48: the SEC statement parser loads on the first 재무 search
      if (!isCurrent()) return;
    }
    if (secFin) {
      const parsed = root.AIO && typeof root.AIO.parseSecStatements === 'function' ? root.AIO.parseSecStatements(secFin, { symbol: ticker, price: collected.price }) : null;
      if (parsed) {
        collected.secFin = parsed;
        collected.sources.push('SEC EDGAR XBRL (재무제표 원본)');
        updateProgress(`XBRL 재무데이터: ${(parsed.revenue || []).length}개년 재무 파싱 완료`);
      }
    } else { updateProgress('SEC XBRL 시간 제한 — 재무 원문 없이 계속'); }

    // v48.5: SEC Frames percentile of the latest completed quarter among all US-GAAP filers (not sector-adjusted).
    try {
      const cik = collected.sec && collected.sec.cik;
      if (cik) {
        // P1910: the latest quarter that ended more than 75 days ago (10-Q filing room); duration frames, not instants.
        const ref = new Date(Date.now() - 75 * 86400000);
        let year = ref.getUTCFullYear(), quarter = Math.floor(ref.getUTCMonth() / 3);
        if (quarter <= 0) { quarter = 4; year -= 1; }
        const period = `CY${year}Q${quarter}`;
        updateProgress(`SEC Frames 보고기업 비교 조회 중 (${period})...`);
        const [frameRev, frameNI] = await withTimeout(Promise.all([
          root.fetchSECFrame('Revenues', period),
          root.fetchSECFrame('NetIncomeLoss', period)
        ]), remaining(1400), [null, null]);
        if (!isCurrent()) return;
        const rankSummary = {};
        if (frameRev) {
          const revRank = root._secFrameRank(frameRev, cik);
          if (revRank && revRank.myVal != null) {
            rankSummary.revenue = revRank;
            updateProgress(`Revenues 보고기업 비교: ${period}, ${revRank.n}개 기업 중 상위 ${(100 - (revRank.pctile || 0)).toFixed(0)}% (업종 미조정)`);
          }
        }
        if (frameNI) {
          const niRank = root._secFrameRank(frameNI, cik);
          if (niRank && niRank.myVal != null) rankSummary.netIncome = niRank;
        }
        if (Object.keys(rankSummary).length > 0) {
          collected.secFrameRank = rankSummary;
          collected.sources.push('SEC Frames (전체 보고기업 백분위·업종 미조정)');
        }
      }
    } catch (e) { log(root, 'warn', 'fetch', `SEC Frames 조회 실패: ${e.message}`); }

    if (!isCurrent()) return;
    if (loadingEl) {
      const progressHtml = progressEl ? progressEl.innerHTML : '';
      let loadHtml = '';
      if (collected.sources.length) {
        // Codex browser audit H38: the line says only that responses arrived; the provider list stays folded.
        loadHtml = `<div class="lch-fp-sum">응답을 받은 외부 요청 ${collected.sources.length}건 — 받지 못한 지표는 아래 표에 N/A로 남습니다.</div>`;
        loadHtml += `<details class="lch-fp-log"><summary class="lch-fp-log-sum">요청 내역 보기</summary><div class="lch-fp-log-src">${esc(root, collected.sources.join(', '))}</div><div id="fund-rpt-progress" class="lch-fp-log-lines">${progressHtml}</div></details>`;
      } else {
        loadHtml = '<div class="lch-fp-fail">외부 데이터 수신 실패 — 빈 보고서로 단정하지 않습니다</div>';
        loadHtml += '<div class="lch-fp-fail-txt">네트워크·공급자 응답을 확인한 뒤 다시 시도하세요. 확보된 데이터가 없어 현재 분석은 참고용으로도 생성하지 않습니다.</div>';
        loadHtml += `<div id="fund-rpt-progress" class="lch-fp-lines">${progressHtml}</div>`;
      }
      loadingEl.innerHTML = loadHtml;
    }
    if (!collected.sources.length) return;

    // Kept for the AI prompt and the chat context (v49.58 R106).
    root._fundAnalysisData = collected;
    if (collected && collected.ticker) root._currentTickerId = collected.ticker;
    // v48.8: the 30 minute report cache, at most 10 companies (oldest dropped).
    try {
      root._fundCache[ticker] = { data: collected, _ts: Date.now() };
      const keys = Object.keys(root._fundCache);
      if (keys.length > 10) {
        keys.sort((a, b) => (root._fundCache[a]._ts || 0) - (root._fundCache[b]._ts || 0));
        for (let i = 0; i < keys.length - 10; i++) delete root._fundCache[keys[i]];
      }
    } catch (_) { /* cache is optional */ }

    renderReport(collected, root);
    renderRadar(ticker, root);

    // v49.72 R138: the 7 quarterly charts (5 year quarterly data, 5 minute cache), with a waiting line first (R115).
    try {
      if (root.AIO && typeof root.AIO.fetchQuarterlyFinancials === 'function') {
        const chartCard = documentRef.getElementById('fund-rpt-fincharts');
        if (chartCard) {
          const meta = documentRef.getElementById('fund-fin-meta');
          if (meta) meta.textContent = `분기 재무 수신 대기 (${ticker})`;
          chartCard.style.display = 'block';
        }
        root.AIO.fetchQuarterlyFinancials(ticker).then((qd) => {
          if (!isCurrent() || (qd && qd.ticker && qd.ticker !== ticker)) return;
          try { root._renderFundamentalFinancialsCharts(qd); } catch (err) { log(root, 'warn', 'fund', `7 차트 렌더 실패: ${(err && err.message) || err}`); }
        }).catch(() => {
          if (!isCurrent()) return;
          try { root._renderFundamentalFinancialsCharts({ available: false, dataSource: 'fetch-error', reason: 'fetch 실패 (5초 timeout 또는 네트워크)', ticker }); } catch (_) { /* charts are optional */ }
        });
      }
    } catch (err) { log(root, 'warn', 'fund', `7 차트 fetch 진입 실패: ${(err && err.message) || err}`); }

    // v50.22 P497: the analysis question is only prefilled in the unified AI panel; the user sends it.
    const askInput = documentRef.getElementById('ai-panel-inp');
    if (askInput && !askInput.value.trim()) askInput.value = ticker + FUND_PROMPT;
  }
  return fundamentalSearch;
}
