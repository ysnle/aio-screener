// Legacy unification (2026-10-26, roadmap item 11, screen 포트폴리오): the 익스포저·집중도 panel (#pf-exposure-panel) and
// the stress panel placement (#pf-stress-panel) moved here from js/aio-workspace.js (v50.54 3D/3E). Texts, thresholds
// (sector > 40%, top 3 > 60%, mean pairwise correlation > 0.70) and the base-currency weights (P1445, window._pfBaseValues)
// are unchanged. refreshPortfolioRisk still collects the returns and history and calls the two window names that
// src/app/legacy-screen-bridges.js installs; the pairwise correlation is the same window._pfPearson its matrix uses.

const esc = (root, s) => (typeof root.escHtml === 'function' ? root.escHtml(String(s)) : String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));

export function renderPortfolioExposure(positions, returnsMap, { documentRef = globalThis.document, root = globalThis } = {}) {
  const el = documentRef.getElementById('pf-exposure-panel');
  if (!el) return;
  if (!positions || !positions.length) { el.innerHTML = ''; return; }
  const db = typeof root._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() : [];
  const find = (sym) => db.find((row) => row.sym === sym) || null;
  const base = root._pfBaseValues(positions);
  if (base.blocked) { el.innerHTML = root._pfBaseNote(base); return; }
  const rows = base.rows.map((r) => ({ sym: r.sym, value: r.value, stock: find(r.sym) }));
  // v57.50 review R1 (C24): weights over total assets including cash, the denominator of the native sector bars and the
  // 포트폴리오 해석; without a known total the panel falls back to the position sum and says so. Cash is not a sector.
  const surf = root._aioPortfolioSurface || {};
  const posSum = rows.reduce((s, r) => s + (r.value || 0), 0);
  const total = surf.totalAssets != null && isFinite(surf.totalAssets) && surf.totalAssets >= posSum && surf.totalAssets > 0 ? surf.totalAssets : posSum;
  const basisNote = total === posSum ? '주식 부분 중' : '현금 포함 총자산 대비';
  if (total <= 0) { el.innerHTML = root._pfBaseNote(base); return; }
  rows.forEach((r) => { r.w = r.value / total; });
  const secLabel = typeof root._aioPortfolioSectorLabel === 'function' ? root._aioPortfolioSectorLabel : (s) => s;
  const bySec = {};
  rows.forEach((r) => { const sec = secLabel((r.stock && r.stock.sector) || '기타'); bySec[sec] = (bySec[sec] || 0) + r.w; });
  const secArr = Object.keys(bySec).map((k) => [k, bySec[k]]).sort((a, b) => b[1] - a[1]);
  const top3 = rows.slice().sort((a, b) => b.w - a.w).slice(0, 3).reduce((s, r) => s + r.w, 0);
  const ranked = rows.filter((r) => r.stock && typeof r.stock.rank === 'number');
  const wr = ranked.reduce((s, r) => s + r.w, 0);
  const avgRank = wr > 0 ? Math.round(ranked.reduce((s, r) => s + r.stock.rank * r.w, 0) / wr) : null;
  // Mean pairwise correlation.
  const tk = Object.keys(returnsMap || {});
  let cs = 0; let cn = 0;
  for (let a = 0; a < tk.length; a++) {
    for (let b = a + 1; b < tk.length; b++) {
      const c = root._pfPearson(returnsMap[tk[a]], returnsMap[tk[b]]);
      if (c != null) { cs += c; cn++; }
    }
  }
  const avgCorr = cn > 0 ? cs / cn : null;
  const warns = [];
  if (secArr.length && secArr[0][1] > 0.40) warns.push(`${secArr[0][0]} 섹터 ${Math.round(secArr[0][1] * 100)}% 집중(>40%)`);
  if (top3 > 0.60) warns.push(`상위 3종목 ${Math.round(top3 * 100)}% 집중(>60%)`);
  if (avgCorr != null && avgCorr > 0.7) warns.push(`평균 상관 ${avgCorr.toFixed(2)} — 분산효과 약함(>0.70)`);
  const secHtml = secArr.slice(0, 5).map((s) => {
    const tone = s[1] > 0.4 ? ' is-over' : s[1] > 0.25 ? ' is-near' : ' is-within';
    return `<div class="wsl-xp-kv wsl-fs-sm"><span class="wsl-dim">${esc(root, s[0])}</span><span class="wsl-b${tone}">${Math.round(s[1] * 100)}%</span></div>`;
  }).join('');
  el.innerHTML =
    `<div class="wsl-head">익스포저, 집중도 <span class="wsl-w500">(${basisNote})</span></div>` +
    '<div class="wsl-xp-cols">' +
      `<div>${secHtml}</div>` +
      '<div class="wsl-fs-sm">' +
        `<div class="wsl-xp-kv"><span class="wsl-dim">상위3 집중</span><span class="wsl-b${top3 > 0.6 ? ' is-over' : ' is-plain'}">${Math.round(top3 * 100)}%</span></div>` +
        `<div class="wsl-xp-kv"><span class="wsl-dim">평균 상관</span><span class="wsl-b">${avgCorr != null ? avgCorr.toFixed(2) : '—'}</span></div>` +
        `<div class="wsl-xp-kv"><span class="wsl-dim">평균 퀀트 랭크</span><span class="wsl-b">${avgRank != null ? avgRank : '—'}</span></div>` +
        `<div class="wsl-xp-kv"><span class="wsl-dim">종목/섹터 수</span><span class="wsl-b">${rows.length}/${secArr.length}</span></div>` +
      '</div>' +
    '</div>' +
    (warns.length ? `<div class="wsl-xp-note is-warn">${warns.map((w) => esc(root, w)).join(', ')}</div>` : '<div class="wsl-xp-note is-ok">집중도·상관 한도 내</div>');
  el.insertAdjacentHTML('beforeend', root._pfBaseNote(base)); // P1445
}

// v50.54 3E: the stress scenarios. 개편 v2 (3g): the same price records feed the 포트폴리오 hero's 시장 민감도 β
// (src/ui/components/portfolio-read.js); 2026-10-19: sensitivities are regressed on the book's own weekly returns
// (src/ui/panels/portfolio-stress.js builds the HTML), not hand-set sector betas.
export function renderPortfolioStress(positions, historyMap, commonDates, { documentRef = globalThis.document, root = globalThis } = {}) {
  root._aioPortfolioStressInput = { historyMap: historyMap || {}, commonDates: commonDates || [] };
  try { root.dispatchEvent(new CustomEvent('aio:portfolioStressInput')); } catch (_) {}
  const el = documentRef.getElementById('pf-stress-panel');
  if (!el) return;
  if (!positions || !positions.length || typeof root._aioPortfolioStressHtml !== 'function') { el.innerHTML = ''; return; }
  const base = root._pfBaseValues(positions);
  if (base.blocked) { el.innerHTML = root._pfBaseNote(base); return; }
  el.innerHTML = root._aioPortfolioStressHtml({ base, historyMap: historyMap || {}, commonDates: commonDates || [] });
  el.insertAdjacentHTML('beforeend', root._pfBaseNote(base)); // P1445
}
