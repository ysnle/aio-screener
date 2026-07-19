import { createResourceBag } from '../../app/lifecycle.js';
import { selectSelectedThemeId, selectThemesItems } from '../../state/selectors/themes.js';

function createThemeCard(documentRef, item) {
  const card = documentRef.createElement('article');
  card.className = 'rrg-native-card';
  card.dataset.themeId = item.id;
  card.style.cssText = 'padding:10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-1);';
  const title = documentRef.createElement('strong');
  title.textContent = `${item.label}${item.symbol && item.symbol !== item.label ? ` (${item.symbol})` : ''}`;
  card.appendChild(title);
  const meta = documentRef.createElement('div');
  meta.style.cssText = 'margin-top:5px;color:var(--text-muted);font-size:10px;';
  meta.textContent = `quadrant: ${item.quadrant} · change: ${item.pct == null ? '—' : `${item.pct.toFixed(2)}%`}`;
  card.appendChild(meta);
  return card;
}

function renderThemes(documentRef, state) {
  const container = documentRef?.getElementById('rrg-quadrant-cards');
  const items = selectThemesItems(state).slice(0, 24);
  if (container) {
    const fragment = documentRef.createDocumentFragment();
    if (!items.length) {
      const empty = documentRef.createElement('div');
      empty.textContent = 'RRG data unavailable.';
      empty.style.color = 'var(--text-muted)';
      fragment.appendChild(empty);
    } else items.forEach((item) => fragment.appendChild(createThemeCard(documentRef, item)));
    container.replaceChildren(fragment);
  }
  const status = documentRef?.getElementById('rrg-chart-status');
  if (status) status.textContent = items.length ? `${items.length} normalized themes` : 'RRG data unavailable';
  const selectedId = selectSelectedThemeId(state);
  const title = documentRef?.getElementById('theme-detail-title');
  const selected = items.find((item) => item.id === selectedId || item.symbol === selectedId);
  if (title && selected) title.textContent = selected.label;
}

export function createThemesPage({ documentRef, store, route = 'themes' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById(`page-${route}`);
      if (!page) return () => bag.dispose();
      page.dataset.aioArchitectureSlice = 'themes';
      const render = () => renderThemes(documentRef, store?.getState?.() || {});
      const unsubscribe = store?.subscribe?.(render);
      if (unsubscribe) bag.add(unsubscribe);
      ['aio:liveQuotes', 'aio:refresh:done', 'aio:marketSnapshot'].forEach((eventName) => {
        documentRef?.addEventListener?.(eventName, render);
        bag.add(() => documentRef?.removeEventListener?.(eventName, render));
      });
      bag.add(() => {
        if (page.dataset.aioArchitectureSlice === 'themes') delete page.dataset.aioArchitectureSlice;
      });
      render();
      return () => bag.dispose();
    }
  };
}
