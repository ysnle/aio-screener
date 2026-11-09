// Legacy unification (2026-10-26, roadmap item 11, screen 포트폴리오): the 익스포저·집중도 panel (#pf-exposure-panel) and
// the stress panel placement (#pf-stress-panel) moved here from js/aio-workspace.js (v50.54 3D/3E). The reading (shares,
// bands, warnings) is src/domain/portfolio/exposure-panel.js on RULES.portfolio; this module collects the base-currency rows
// (P1445, window._pfBaseValues) and renders. refreshPortfolioRisk still collects the returns and history and calls the two window names that
// src/app/legacy-screen-bridges.js installs; the pairwise correlation is the same window._pfPearson its matrix uses.
import { escapeHtml } from '../html.js';
import { deriveExposurePanel } from '../../domain/portfolio/exposure-panel.js';


export function renderPortfolioExposure(positions, returnsMap, { documentRef = globalThis.document, root = globalThis, corrRes = null } = {}) {
  const el = documentRef.getElementById('pf-exposure-panel');
  if (!el) return;
  if (!positions || !positions.length) { el.innerHTML = ''; return; }
  const db = typeof root._aioGetCanonicalScreenerRows === 'function' ? root._aioGetCanonicalScreenerRows() : [];
  const find = (sym) => {
    const listing = root._aioResolveHoldingInput?.(sym)?.listingSymbol || sym;
    return db.find((row) => row.sym === sym || row.sym === listing) || null;
  };
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
  const model = deriveExposurePanel({ rows, total, posSum, corrMatrix: Array.isArray(corrRes?.matrix) ? corrRes.matrix : null, returnsMap, pearson: root._pfPearson,
    sectorLabel: typeof root._aioPortfolioSectorLabel === 'function' ? root._aioPortfolioSectorLabel : (s) => s });
  const { avgCorr, avgRank, rankCoverage, top3 } = model;
  const secHtml = model.sectors.slice(0, 5).map((s) => {
    const tone = s.band ? ` is-${s.band}` : ' is-plain'; // over · near · within are the band words
    return `<div class="wsl-xp-kv wsl-fs-sm"><span class="wsl-dim">${escapeHtml(s.name)}</span><span class="wsl-b${tone}">${Math.round(s.share * 100)}%</span></div>`;
  }).join('');
  el.innerHTML =
    `<div class="wsl-head">익스포저, 집중도 <span class="wsl-w500">(${basisNote})</span></div>` +
    '<div class="wsl-xp-cols">' +
      `<div>${secHtml}</div>` +
      '<div class="wsl-fs-sm">' +
        `<div class="wsl-xp-kv"><span class="wsl-dim">상위3 집중</span><span class="wsl-b${model.top3Over ? ' is-over' : ' is-plain'}">${Math.round(top3 * 100)}%</span></div>` +
        `<div class="wsl-xp-kv"><span class="wsl-dim">평균 상관</span><span class="wsl-b">${avgCorr != null ? avgCorr.toFixed(2) : '—'}</span></div>` +
        `<div class="wsl-xp-kv"><span class="wsl-dim">평균 퀀트 랭크</span><span class="wsl-b">${avgRank != null ? `${avgRank}${rankCoverage != null && rankCoverage < 100 ? ` (랭크 확인 ${rankCoverage}%)` : ''}` : '—'}</span></div>` +
        `<div class="wsl-xp-kv"><span class="wsl-dim">종목/섹터 수</span><span class="wsl-b">${model.holdings}/${model.sectorCount}</span></div>` +
      '</div>' +
    '</div>' +
    (model.warnings.length ? `<div class="wsl-xp-note is-warn">${model.warnings.map(escapeHtml).join(', ')}</div>` : `<div class="wsl-xp-note is-ok">${model.clearNote}</div>`);
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
