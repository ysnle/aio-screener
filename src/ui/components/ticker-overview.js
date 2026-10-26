// Legacy unification (2026-10-26, roadmap item 11, screen 종목): the 요약 tab's 팩터 성격 fold (#ticker-ov-provenance,
// #ticker-ov-factor-rows, #ticker-ov-factor-radar) moved here from window._aioRenderTickerOverview in js/aio-ui.js.
// Texts, the radar options and the chart registry key are unchanged. Real values only: quotes come from _liveData and
// factor scores from the canonical screener rows (the same source and values as the screener page, R276). showTicker
// and the aio:liveQuotes listener in src/app/bootstrap.js still call it by that window name.

const FACTOR_LABELS = { momentum: '모멘텀', trend: '추세', lowvol: '저변동성', size: '사이즈', value: '밸류', quality: '퀄리티', kalman: '칼만 추세' };
const FACTOR_HINTS = { kalman: '칼만 추세: 잡음을 걸러 낸 추세 추정' };

export function renderTickerOverview(tkr, { documentRef = globalThis.document, root = globalThis } = {}) {
  tkr = String(tkr || '').toUpperCase();
  if (!tkr) return;
  const esc = (s) => (typeof root.escHtml === 'function' ? root.escHtml(s) : String(s));
  const registry = root._aioChartRegistry;
  const live = (root._liveData || {})[tkr] || {};
  const scrRows = typeof root._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() : [];
  const scr = Array.isArray(scrRows) ? (scrRows.find((r) => r && r.sym === tkr) || null) : null;
  const price = Number(live.price); // P1640: price/52-week/return rows retired (summary owns them)
  const prov = documentRef.getElementById('ticker-ov-provenance');
  if (prov) {
    const srcs = [];
    const dsrc = root._dataSource && root._dataSource[tkr];
    if (price > 0) { srcs.push('시세: 실시간 관측'); prov.title = `시세 출처: ${live.source || (dsrc && dsrc.source) || 'live'}`; } // v57.54: provider id on hover
    if (scr) srcs.push('수익률·팩터: 확정 종가 기준');
    prov.textContent = srcs.length ? srcs.join(', ') : '원천 미수신 — 표시값 없음';
  }
  // P1748: related-theme chips retired; company-analysis.js owns the theme link.
  // Factor profile: sector-normalised 0~100 scores from the screener rank run (descriptive; W07-C/P1146 — neither an
  // empirical percentile nor a normal CDF; the rank percentile is a separate composite rank).
  const rowsEl = documentRef.getElementById('ticker-ov-factor-rows');
  const radarC = documentRef.getElementById('ticker-ov-factor-radar');
  const radarWrap = radarC && radarC.parentElement;
  const fs = scr && scr.factorScores;
  const Chart = root.Chart;
  if (fs && rowsEl) {
    const keys = Object.keys(fs).filter((k) => typeof fs[k] === 'number' && isFinite(fs[k]));
    rowsEl.innerHTML = keys.map((k) => `<div class="ticker-ov-row"${FACTOR_HINTS[k] ? ` title="${esc(FACTOR_HINTS[k])}"` : ''}><span class="ov-lbl">${esc(FACTOR_LABELS[k] || k)}</span><span class="ov-val">${fs[k]}</span></div>`).join('');
    const sig = `${tkr}|${keys.map((k) => `${k}:${fs[k]}`).join(',')}`;
    if (radarC && typeof Chart !== 'undefined' && keys.length >= 3 && radarC.dataset.sig !== sig) {
      radarC.dataset.sig = sig;
      if (radarWrap) radarWrap.style.display = 'block';
      try {
        if (registry) registry.destroyIfExists('ticker-ov-factor-radar');
        const radarChart = new Chart(radarC.getContext('2d'), {
          type: 'radar',
          data: {
            labels: keys.map((k) => FACTOR_LABELS[k] || k),
            datasets: [{ data: keys.map((k) => fs[k]), backgroundColor: 'rgba(47,124,87,0.12)', borderColor: '#2f7c57', borderWidth: 1.5, pointRadius: 2, pointBackgroundColor: '#2f7c57' }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { r: { min: 0, max: 100, ticks: { display: false }, pointLabels: { font: { size: 12 }, color: '#544f46' }, grid: { color: 'rgba(27,26,23,0.08)' }, angleLines: { color: 'rgba(27,26,23,0.08)' } } },
          },
        });
        if (registry) registry.register('ticker-ov-factor-radar', radarChart);
      } catch (_) {}
    } else if (radarWrap && (typeof Chart === 'undefined' || keys.length < 3)) {
      radarWrap.style.display = 'none';
    }
  } else if (rowsEl) {
    rowsEl.innerHTML = `<span class="lu-tk-empty">${scr ? '팩터 점수 미계산 — 스크리너 데이터 수신 대기' : '스크리너 유니버스 외 종목 — 팩터 정규화 점수는 섹터 상대값이라 제공되지 않습니다'}</span>`;
    if (radarWrap) radarWrap.style.display = 'none';
    if (radarC) radarC.dataset.sig = '';
    if (registry) registry.destroyIfExists('ticker-ov-factor-radar');
  }
}
