// Legacy unification (2026-10-26, roadmap item 11, screen 거시 · 금리): the 한국 거시 fold's 기준일 badges moved here from
// js/aio-core.js (window._aioRenderKrMacroFreshnessBadges). v59.51 (content audit): the header's separate next-release
// line left — the board header carries the one next-release answer (crossroads.nextEvent, macro-board.js).

// v52.42 (P657/EF-16): one "기준: MM/DD (N일 전)" badge from the shared _fieldTs on the three main 한국 거시 cards.
const KR_MACRO_BADGES = Object.freeze([['kr-macro-bokrate-freshness', 'bok_rate'], ['kr-macro-cpi-freshness', 'kr_cpi'], ['kr-macro-pmi-freshness', 'kr_pmi']]);

export function renderKrMacroFreshnessBadges({ documentRef = globalThis.document, root = globalThis } = {}) {
  const ts = root.DATA_SNAPSHOT?._fieldTs || {};
  for (const [id, key] of KR_MACRO_BADGES) {
    const el = documentRef?.getElementById?.(id);
    const dateStr = ts[key];
    if (!el) continue;
    if (!dateStr) {
      el.textContent = '기준: 미수신';
      el.style.color = 'var(--text-muted)';
      el.setAttribute('data-runtime-state', 'unavailable');
      continue;
    }
    const days = typeof root._aioStaleDays === 'function' ? root._aioStaleDays(dateStr) : Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
    el.textContent = `기준: ${dateStr.slice(5).replace('-', '/')} (${days}일 전)`;
    el.style.color = days > 30 ? 'var(--data-amber)' : 'var(--text-muted)';
  }
}
