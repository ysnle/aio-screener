// Legacy unification (2026-10-26, roadmap item 11, screen 테마 · 섹터): the 한국 테마 '테마 더 보기' toggle under
// #kr-theme-container moved here from window._aioEnsureKrThemeProgressive in js/aio-core.js. It stays idempotent;
// js/aio-kr-data.js initKoreaThemes still calls it by that name, and src/app/legacy-screen-bridges.js runs it once on
// install for a themes page that was initialised first.

export function ensureKrThemeProgressive({ documentRef = globalThis.document } = {}) {
  const container = documentRef?.getElementById?.('kr-theme-container');
  if (!container || documentRef.getElementById('kr-theme-more')) return;
  container.classList.add('aio-theme-progressive');
  const button = documentRef.createElement('button');
  button.id = 'kr-theme-more';
  button.className = 'aio-btn-table aio-comp-more';
  button.type = 'button';
  button.textContent = '테마 더 보기';
  button.addEventListener('click', () => {
    const expanded = container.classList.toggle('is-expanded');
    button.textContent = expanded ? '핵심 테마만 보기' : '테마 더 보기';
  });
  container.insertAdjacentElement('afterend', button);
}
