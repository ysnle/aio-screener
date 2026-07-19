import { createResourceBag } from '../../app/lifecycle.js';
import { selectNewsItems } from '../../state/selectors/news.js';

function setText(documentRef, id, value) {
  const element = documentRef?.getElementById(id);
  if (element) element.textContent = value == null ? '' : String(value);
  return element;
}

function sourceItems(root, store) {
  const stateItems = selectNewsItems(store?.getState?.() || {});
  if (stateItems.length) return stateItems;
  if (Array.isArray(root?._allNewsItems)) return root._allNewsItems;
  if (Array.isArray(root?.newsCache)) return root.newsCache;
  return [];
}

function displayTitle(item) {
  return item?.displayTitle || item?.translatedTitle || item?.headline || item?.title || 'Untitled story';
}

function displaySummary(item) {
  return item?.displaySummary || item?.translatedSummary || item?.summary || item?.desc || '';
}

function safeHref(value) {
  const href = String(value || '').trim();
  return /^https?:\/\//i.test(href) ? href : '';
}

function createStory(documentRef, item, index) {
  const article = documentRef.createElement('article');
  article.className = 'news-item-card';
  article.dataset.newsId = String(item?.newsId || item?.id || index);
  article.style.cssText = 'display:flex;gap:10px;padding:10px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface-1);';

  const body = documentRef.createElement('div');
  body.style.cssText = 'min-width:0;flex:1;';
  const title = documentRef.createElement('div');
  title.className = 'news-item-headline';
  title.style.cssText = 'font-weight:700;line-height:1.45;';
  const href = safeHref(item?.link || item?.url);
  if (href) {
    const link = documentRef.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = displayTitle(item);
    title.appendChild(link);
  } else {
    title.textContent = displayTitle(item);
  }
  body.appendChild(title);

  const summaryText = displaySummary(item);
  if (summaryText) {
    const summary = documentRef.createElement('div');
    summary.className = 'news-item-summary';
    summary.style.cssText = 'margin-top:4px;color:var(--text-secondary);font-size:11px;line-height:1.45;';
    summary.textContent = String(summaryText).slice(0, 260);
    body.appendChild(summary);
  }

  const meta = documentRef.createElement('div');
  meta.className = 'news-item-meta';
  meta.style.cssText = 'margin-top:6px;color:var(--text-muted);font-size:10px;';
  const parts = [item?.source, item?.topic, item?.pubDate ? new Date(item.pubDate).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : null, Number.isFinite(Number(item?.score)) ? `score ${Number(item.score)}` : null].filter(Boolean);
  meta.textContent = parts.join(' · ');
  body.appendChild(meta);
  article.appendChild(body);
  return article;
}

function renderStories(documentRef, container, model) {
  if (!container) return;
  const items = Array.isArray(model?.items) ? model.items : [];
  const fragment = documentRef.createDocumentFragment();
  if (!items.length) {
    const empty = documentRef.createElement('div');
    empty.style.cssText = 'padding:24px;text-align:center;color:var(--text-muted);font-size:11px;';
    empty.textContent = model?.emptyReason || 'No verified current news is available.';
    fragment.appendChild(empty);
  } else {
    items.forEach((item, index) => fragment.appendChild(createStory(documentRef, item, index)));
  }
  container.replaceChildren(fragment);
}

function createModel(root, store, route, filters) {
  const items = sourceItems(root, store);
  const build = root?.AIO?.buildNewsSurfaceModel;
  if (typeof build !== 'function') return { items, visibleCount: items.length, eligibleCount: items.length, sourceCount: new Set(items.map((item) => item?.source).filter(Boolean)).size };
  try {
    return build(route, items, route === 'market-news' ? {
      countryFilter: filters.country,
      topicFilter: filters.topic,
      typeTab: filters.type,
      sortMode: filters.sort
    } : {});
  } catch (_) {
    return { items: [], emptyReason: 'news_surface_model_failed', visibleCount: 0, eligibleCount: 0, sourceCount: 0 };
  }
}

export function createNewsPage({ root, documentRef, store, route = 'market-news' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById(`page-${route}`);
      const container = documentRef?.getElementById(route === 'briefing' ? 'briefing-live-news-list' : 'live-news-feed');
      if (!page || !container) return () => bag.dispose();
      const filters = { country: 'all', topic: 'all', type: 'all', sort: 'time' };
      page.dataset.aioArchitectureRoute = route;
      page.dataset.aioArchitectureRenderer = 'native';

      const render = () => {
        const model = createModel(root, store, route, filters);
        renderStories(documentRef, container, model);
        page.dataset.aioArchitectureState = model?.visibleCount ? 'observed' : 'blocked';
        if (route === 'market-news') {
          setText(documentRef, 'market-news-count', `${model.visibleCount || 0}/${model.eligibleCount || 0}`);
          setText(documentRef, 'news-24h-count', model.visibleCount || 0);
          setText(documentRef, 'news-24h-sources', model.sourceCount ? `${model.sourceCount} sources` : '');
        } else {
          setText(documentRef, 'briefing-24h-count', model.visibleCount || 0);
        }
      };

      const onClick = (event) => {
        const action = event.target?.closest?.('[data-action]');
        if (!action || !page.contains(action)) return;
        const name = action.getAttribute('data-action');
        if (route !== 'market-news' || !['filterNewsByCountry', 'filterNewsByTopic', 'filterNewsByTelegramOnly', 'setNewsSortMode', 'setNewsTypeTab'].includes(name)) return;
        event.preventDefault();
        event.stopPropagation();
        if (name === 'filterNewsByCountry') filters.country = action.getAttribute('data-arg') || 'all';
        if (name === 'filterNewsByTopic') filters.topic = action.getAttribute('data-arg') || 'all';
        if (name === 'filterNewsByTelegramOnly') filters.country = 'tg';
        if (name === 'setNewsSortMode') filters.sort = action.getAttribute('data-arg') || 'time';
        if (name === 'setNewsTypeTab') filters.type = action.getAttribute('data-arg') || 'all';
        render();
      };
      const refreshButton = documentRef?.getElementById('news-refresh-btn');
      const onRefresh = (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (typeof root?.fetchAllNews === 'function') {
          const request = root.fetchAllNews(true);
          request?.catch?.(() => {});
        }
      };
      const eventTargets = [...new Set([documentRef, root].filter((target) => target && typeof target.addEventListener === 'function'))];
      page.addEventListener('click', onClick);
      refreshButton?.addEventListener('click', onRefresh);
      eventTargets.forEach((target) => ['aio:newsUpdated', 'aio:refresh:done', 'aio:serverDataLoaded'].forEach((eventName) => {
        target.addEventListener(eventName, render);
        bag.add(() => target.removeEventListener(eventName, render));
      }));
      bag.add(() => page.removeEventListener('click', onClick));
      bag.add(() => refreshButton?.removeEventListener('click', onRefresh));
      bag.add(() => {
        if (page.dataset.aioArchitectureRoute === route) delete page.dataset.aioArchitectureRoute;
        if (page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
        if (page.dataset.aioArchitectureState) delete page.dataset.aioArchitectureState;
      });
      render();
      return () => bag.dispose();
    }
  };
}
