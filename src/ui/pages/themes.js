import { createResourceBag } from '../../app/lifecycle.js';
import { selectThemesItems } from '../../state/selectors/themes.js';

const QUADRANTS = Object.freeze([
  { key: 'Leading', label: '선도 Leading', sub: '비중 유지', note: '상대강도·모멘텀 모두 우위' },
  { key: 'Improving', label: '개선 Improving', sub: '진입 후보', note: '상대모멘텀 개선 중' },
  { key: 'Weakening', label: '약화 Weakening', sub: '익절 검토', note: '상대강도 대비 모멘텀 둔화' },
  { key: 'Lagging', label: '후행 Lagging', sub: '회피', note: '상대강도·모멘텀 모두 열위' }
]);

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function activeView(root) {
  const value = String(root?._rrgViewMode || 'sectors');
  return value === 'subsectors' || value === 'all' ? value : 'sectors';
}

function viewItems(items, view) {
  if (view === 'all') return items;
  return items.filter((item) => String(item?.view || 'sectors') === view);
}

function createChip(documentRef, item) {
  const chip = documentRef.createElement('span');
  const pct = finite(item?.pct);
  const symbol = String(item?.symbol || item?.id || '');
  chip.dataset.themeSymbol = symbol;
  chip.textContent = `${symbol} ${String(item?.label || symbol)} ${pct == null ? '—' : `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`}`;
  chip.style.cssText = 'font-size:12px;border:1px solid var(--border-subtle);border-radius:6px;padding:4px 10px;background:var(--bg-elevated);color:var(--text-primary);font-variant-numeric:tabular-nums;';
  if (pct != null) chip.style.color = pct >= 0 ? 'var(--data-green)' : 'var(--data-red)';
  return chip;
}

function renderThemes({ documentRef, root, store, route }) {
  if (route !== 'themes') return;
  const container = documentRef?.getElementById('rrg-quadrant-cards');
  if (!container) return;
  const items = viewItems(selectThemesItems(store?.getState?.() || {}), activeView(root));
  const groups = new Map(QUADRANTS.map((quadrant) => [quadrant.key, []]));
  items.forEach((item) => {
    const quadrant = String(item?.quadrant || 'unknown');
    if (groups.has(quadrant) && (finite(item?.rsRatio) != null || finite(item?.rsMomentum) != null)) {
      groups.get(quadrant).push(item);
    }
  });
  groups.forEach((group) => group.sort((a, b) => (finite(b?.pct) ?? -Infinity) - (finite(a?.pct) ?? -Infinity)));
  const classifiedCount = [...groups.values()].reduce((count, group) => count + group.length, 0);
  container.replaceChildren();
  if (!classifiedCount) {
    const empty = documentRef.createElement('div');
    empty.textContent = 'RRG 판정 보류 · SPY 대비 상대가격 히스토리 20개 이상 필요';
    empty.style.cssText = 'grid-column:span 2;text-align:center;padding:20px;color:var(--text-dim);font-size:12px;';
    container.appendChild(empty);
    const read = documentRef.getElementById('rrg-rotation-read');
    if (read) read.textContent = '상대강도·모멘텀 시계열 미수신 — 정적 사분면 시드로 대체하지 않습니다.';
    return;
  }

  QUADRANTS.forEach((quadrant) => {
    const card = documentRef.createElement('section');
    card.dataset.themeQuadrant = quadrant.key;
    card.style.cssText = 'background:var(--bg-card);border:1px solid var(--border-subtle);border-radius:8px;padding:20px 24px;';
    const heading = documentRef.createElement('div');
    heading.textContent = `${quadrant.label} · ${quadrant.sub}`;
    heading.style.cssText = 'font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:12px;';
    card.appendChild(heading);
    const chips = documentRef.createElement('div');
    chips.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
    const group = groups.get(quadrant.key) || [];
    if (group.length) group.forEach((item) => chips.appendChild(createChip(documentRef, item)));
    else {
      const empty = documentRef.createElement('span');
      empty.textContent = '해당 섹터 없음';
      empty.style.cssText = 'font-size:12px;color:var(--text-dim);';
      chips.appendChild(empty);
    }
    card.appendChild(chips);
    const note = documentRef.createElement('div');
    note.textContent = quadrant.note;
    note.style.cssText = 'font-size:12px;color:var(--text-dim);margin-top:10px;';
    card.appendChild(note);
    container.appendChild(card);
  });
  const leading = (groups.get('Leading') || []).map((item) => item.label || item.symbol).join('·') || '없음';
  const improving = (groups.get('Improving') || []).map((item) => item.label || item.symbol).join('·') || '없음';
  const read = documentRef.getElementById('rrg-rotation-read');
  if (read) read.textContent = `선도 사분면: ${leading}. 개선 사분면: ${improving}. 차트는 별도 레거시 secondary surface입니다.`;
}

export function createThemesPage({ root = globalThis, documentRef, store, route = 'themes' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById(`page-${route}`);
      if (!page) return () => bag.dispose();
      page.dataset.aioArchitectureRoute = route;
      page.dataset.aioArchitectureSlice = 'themes';
      if (route === 'themes') {
        page.dataset.aioArchitectureRenderer = 'native';
        const container = documentRef.getElementById('rrg-quadrant-cards');
        if (container) container.dataset.aioThemesRenderer = 'native';
        const renderNow = () => renderThemes({ documentRef, root, store, route });
        renderNow();
        const unsubscribe = store?.subscribe?.(renderNow);
        if (unsubscribe) bag.add(unsubscribe);
        const eventTarget = documentRef || root;
        ['aio:themesViewChanged', 'aio:themesHistoryLoaded', 'aio:historyLoaded', 'aio:refresh:done', 'aio:liveQuotes'].forEach((eventName) => {
          eventTarget?.addEventListener?.(eventName, renderNow);
          bag.add(() => eventTarget?.removeEventListener?.(eventName, renderNow));
        });
        bag.add(() => {
          if (page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
          if (container?.dataset.aioThemesRenderer === 'native') delete container.dataset.aioThemesRenderer;
        });
      }
      bag.add(() => {
        if (page.dataset.aioArchitectureRoute === route) delete page.dataset.aioArchitectureRoute;
        if (page.dataset.aioArchitectureSlice === 'themes') delete page.dataset.aioArchitectureSlice;
      });
      return () => bag.dispose();
    }
  };
}
