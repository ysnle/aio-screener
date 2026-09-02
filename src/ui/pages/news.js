import { createResourceBag } from '../../app/lifecycle.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { selectNewsItems, selectNewsStatus } from '../../state/selectors/news.js';

function text(documentRef, value, fallback = '—') {
  const node = documentRef.createElement('span');
  node.textContent = value == null || value === '' ? fallback : String(value);
  return node;
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function isNewsAnalysisEligible(item) {
  if (!item || item.verificationStatus === 'unverified' || item.verificationStatus === 'secondary-only') return false;
  if (String(item.contentDepth || '').toLowerCase() === 'headline-only' || item.verificationStatus === 'headline-only') return false;
  return String(item.summary || item.desc || '').trim().length >= 40;
}

function renderNewsSummary(documentRef, root, model, status) {
  const rows = Array.isArray(model?.items) ? model.items : [];
  const distinctSources = new Set(rows.map((item) => item?._tgChannel || item?.source || item?.feed).filter(Boolean));
  const analyzableRows = rows.filter(isNewsAnalysisEligible);
  const tones = analyzableRows.map((item) => sentimentTone(root, item).label);
  const bull = tones.filter((label) => label === '긍정').length;
  const bear = tones.filter((label) => label === '부정').length;
  const risk = rows.filter((item) => !isNewsAnalysisEligible(item)).length;
  const score = analyzableRows.length ? Math.max(0, Math.min(100, Math.round(50 + ((bull - bear) / analyzableRows.length) * 50))) : null;
  const set = (id, value, fallback = '—') => {
    const node = documentRef?.getElementById(id);
    if (node) node.textContent = value == null || value === '' ? fallback : String(value);
  };
  documentRef?.querySelectorAll?.('[data-news-source-count]').forEach((node) => {
    node.textContent = String(distinctSources.size || '—');
  });
  set('news-24h-count', model?.eligibleCount ?? rows.length, '0');
  set('news-24h-sources', distinctSources.size ? `${distinctSources.size}개 소스` : '소스 확인 중');
  set('news-risk-count', risk, '0');
  set('news-risk-label', risk ? '본문/검증 필요' : '분석 가능');
  set('news-sent-score', score);
  set('news-sent-label', score == null ? '분석 보류' : score >= 60 ? '긍정' : score <= 40 ? '주의' : '중립');
  let cut = null;
  try { cut = root?.AIO?.getSharedMarketCut?.() || null; } catch (_) {}
  const generatedAt = root?._serverDataMeta?.generatedAt || null;
  const generatedLabel = generatedAt ? new Date(generatedAt).toLocaleString('ko-KR', { month:'numeric', day:'numeric', hour:'2-digit', minute:'2-digit' }) : '';
  set('last-fetch-time', cut?.status === 'stale' || status === 'stale'
    ? `뉴스 기준시각 경과 · ${cut?.endLabel || '최신 완료컷 확인 필요'}`
    : generatedLabel || (status === 'current' ? '정상 수신' : '수신 대기'));
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''), 'https://invalid.local');
    if (url.origin === 'https://invalid.local' && !/^https?:/i.test(String(value || ''))) return '';
    return /^https?:$/i.test(url.protocol) ? url.href : '';
  } catch (_) {
    return '';
  }
}

function sentimentTone(root, item) {
  if (!isNewsAnalysisEligible(item)) {
    return String(item?.contentDepth || '').toLowerCase() === 'headline-only' || item?.verificationStatus === 'headline-only'
      ? { label: '본문 미수신', color: 'var(--text-muted)' }
      : { label: '검증 대기', color: 'var(--data-amber)' };
  }
  try {
    const sentiment = typeof root?.getSentimentFromText === 'function'
      ? root.getSentimentFromText(`${item?.title || ''} ${item?.desc || ''}`)
      : 'neutral';
    if (sentiment === 'bull') return { label: '긍정', color: 'var(--data-green)' };
    if (sentiment === 'bear') return { label: '부정', color: 'var(--data-red)' };
    if (sentiment === 'warn') return { label: '주의', color: 'var(--data-amber)' };
  } catch (_) {}
  return { label: '중립', color: 'var(--text-muted)' };
}

function displayValue(root, functionName, item, fallback = '') {
  try {
    const fn = root?.[functionName];
    if (typeof fn === 'function') return fn(item) || fallback;
  } catch (_) {}
  return fallback;
}

function createTickerBadge(documentRef, ticker) {
  const badge = documentRef.createElement('span');
  const symbol = String(ticker || '').replace('$', '');
  badge.dataset.action = '_aioNewsTickerClick';
  badge.dataset.arg = symbol;
  badge.setAttribute('role', 'button');
  badge.tabIndex = 0;
  badge.textContent = ticker;
  badge.title = `${symbol} 종목 분석`;
  badge.style.cssText = 'font-size:11px;font-weight:800;color:#60a5fa;font-family:var(--font-mono);background:var(--data-cyan-soft);padding:1px 4px;border-radius:3px;margin-right:3px;cursor:pointer;';
  return badge;
}

function createNewsCard(documentRef, root, item, index) {
  const card = documentRef.createElement('div');
  const tone = sentimentTone(root, item);
  const link = safeUrl(item?.link);
  const absTime = displayValue(root, 'getAbsoluteTime', item, '');
  const timeAgo = item?.pubDate ? displayValue(root, 'getTimeAgo', new Date(item.pubDate), '') : '';
  const title = displayValue(root, 'getDisplayTitle', item, item?.title || item?.headline || '제목 없음');
  const summary = displayValue(root, 'getDisplaySummary', item, item?.summary || item?.desc || '');
  const tickers = displayValue(root, 'getDisplayTickers', item, []);

  card.className = 'news-item-card';
  card.dataset.newsId = item?.newsId || item?.id || `news-${index}`;
  card.dataset.newsIdx = String(index);
  if (link) card.dataset.openUrl = link;
  card.title = String(item?.title || title).slice(0, 200);

  const timeColumn = documentRef.createElement('div');
  timeColumn.className = 'news-time-col';
  const absolute = documentRef.createElement('span');
  absolute.className = 'news-time-abs';
  absolute.textContent = absTime || timeAgo || '—';
  const dot = documentRef.createElement('span');
  dot.className = 'news-time-dot';
  dot.style.background = tone.color;
  timeColumn.append(absolute, dot);

  const body = documentRef.createElement('div');
  body.className = 'news-item-body';
  const headline = documentRef.createElement('div');
  headline.className = 'news-item-headline';
  if (Array.isArray(tickers)) tickers.slice(0, 4).forEach((ticker) => headline.appendChild(createTickerBadge(documentRef, ticker)));
  headline.appendChild(text(documentRef, title, '제목 없음'));
  body.appendChild(headline);
  if (summary) {
    const summaryNode = documentRef.createElement('div');
    summaryNode.className = 'news-item-summary';
    summaryNode.textContent = summary;
    body.appendChild(summaryNode);
  }
  const meta = documentRef.createElement('div');
  meta.className = 'news-item-meta';
  const source = item?._tgChannel ? `TG · ${item?.source || ''}` : item?.source || '';
  const score = finite(item?.score);
  const contentBoundary = String(item?.contentDepth || '').toLowerCase() === 'headline-only'
    ? '헤드라인 전용 · 단독 분석 근거 사용 금지'
    : '';
  meta.textContent = [item?.verificationStatus === 'unverified' ? '미검증' : '', contentBoundary, item?.sourceTierLabel || '', item?.flag || '', source, item?.topic || '', timeAgo, score == null ? '' : `선별 점수 ${score}`]
    .filter(Boolean)
    .join(' · ');
  body.appendChild(meta);

  const stance = documentRef.createElement('span');
  stance.textContent = tone.label;
  stance.style.cssText = `font-size:12px;font-weight:600;color:${tone.color};flex-shrink:0;`;
  card.append(timeColumn, body, stance);
  return card;
}

function appendMarketNews(documentRef, root, container, model, status, visibleLimit, controls) {
  const eligible = Array.isArray(model?.items) ? model.items : [];
  const displayed = eligible.slice(0, visibleLimit);
  container.replaceChildren();
  if (!displayed.length) {
    const empty = documentRef.createElement('div');
    empty.style.cssText = 'text-align:center;padding:30px;color:var(--text-muted);font-size:12px;line-height:1.7;';
    empty.textContent = status === 'unavailable'
      ? '뉴스 수신 대기 — 새로고침 후 검증된 뉴스가 표시됩니다.'
      : `현재 조건에서 08:00 KST 완료 24h · 중요도 기준 뉴스가 없습니다. (${model?.emptyReason || 'no-eligible-news'})`;
    container.appendChild(empty);
  } else if (controls.typeTab === 'category') {
    const groups = new Map();
    displayed.forEach((item) => {
      const key = item?.topic || 'general';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(item);
    });
    groups.forEach((items, topic) => {
      const group = documentRef.createElement('section');
      group.className = 'news-category-group';
      const heading = documentRef.createElement('div');
      heading.style.cssText = 'padding:8px 12px 4px;font-size:11px;font-weight:700;color:var(--accent);border-bottom:1px solid var(--border-accent-dim);';
      heading.textContent = `${topic} · ${items.length}건`;
      group.appendChild(heading);
      items.forEach((item, index) => group.appendChild(createNewsCard(documentRef, root, item, index)));
      container.appendChild(group);
    });
  } else {
    displayed.forEach((item, index) => container.appendChild(createNewsCard(documentRef, root, item, index)));
  }

  const count = documentRef.getElementById('market-news-count');
  if (count) count.textContent = model?.eligibleCount > displayed.length ? `${displayed.length}건 표시 / ${model.eligibleCount}건 일치` : `${displayed.length}건`;
  const more = documentRef.getElementById('news-load-more-wrap');
  if (more) more.hidden = displayed.length >= (model?.eligibleCount || 0);
  const summary = documentRef.getElementById('news-visible-summary');
  if (summary) summary.textContent = `전체 ${model?.eligibleCount || 0}건 중 ${displayed.length}건 표시`;
}

function getBriefingWindow(root) {
  try {
    if (typeof root?._getBriefingWindowKST === 'function') return root._getBriefingWindowKST();
  } catch (_) {}
  return null;
}

function appendBriefingNews(documentRef, root, container, model, status, windowInfo, moreButton) {
  const eligible = Array.isArray(model?.items) ? model.items : [];
  const displayed = eligible.slice(0, 40);
  container.replaceChildren();
  if (!displayed.length) {
    const empty = documentRef.createElement('div');
    empty.style.cssText = 'text-align:center;padding:24px;color:var(--text-muted);font-size:11px;line-height:1.7;';
    empty.textContent = status === 'unavailable'
      ? '뉴스 수신 대기 중입니다.'
      : `08:00 KST 완료 24h 검증 뉴스가 없습니다. (${model?.emptyReason || 'no-briefing-news'})`;
    container.appendChild(empty);
  } else {
    const groups = new Map();
    displayed.forEach((item) => {
      const topic = item?.topic || 'general';
      if (!groups.has(topic)) groups.set(topic, []);
      groups.get(topic).push(item);
    });
    groups.forEach((items, topic) => {
      const group = documentRef.createElement('section');
      group.className = 'briefing-section';
      const heading = documentRef.createElement('div');
      heading.style.cssText = 'padding:8px 12px 4px;font-size:11px;font-weight:700;color:var(--accent);border-bottom:1px solid var(--border-accent-dim);';
      heading.textContent = `${topic} · ${items.length}건`;
      group.appendChild(heading);
      items.forEach((item, index) => {
        const card = createNewsCard(documentRef, root, item, index);
        card.className = 'briefing-news-card aio-hover-news-card';
        group.appendChild(card);
      });
      container.appendChild(group);
    });
  }

  const count = documentRef.getElementById('briefing-24h-count');
  if (count) count.textContent = `${displayed.length}건`;
  const timestamp = documentRef.getElementById('briefing-24h-ts');
  if (timestamp) {
    const start = windowInfo?.anchorDate ? new Date(windowInfo.anchorDate) : null;
    const end = windowInfo?.endAnchorDate ? new Date(windowInfo.endAnchorDate) : null;
    timestamp.textContent = start && end
      ? `${start.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 08:00 ~ ${end.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} 08:00 KST`
      : '08:00 KST 완료 24h';
  }
  if (moreButton) {
    moreButton.hidden = displayed.length <= 12;
    moreButton.textContent = moreButton.dataset.aioExpanded === '1' ? '핵심만 보기 ▲' : '전체 뉴스 보기 ▼';
  }
}

function render({ documentRef, root, store, route }) {
  const state = store?.getState?.() || {};
  const items = selectNewsItems(state);
  const page = documentRef?.getElementById(`page-${route}`);
  if (page) {
    page.dataset.aioArchitectureRoute = route;
    page.dataset.aioArchitectureSlice = 'news';
    const newsStatus = selectNewsStatus(state);
    page.dataset.aioArchitectureState = newsStatus === 'current' && items.length ? 'observed' : newsStatus === 'stale' && items.length ? 'stale' : 'blocked';
  }
  if (route === 'briefing') {
    const windowInfo = getBriefingWindow(root);
    const model = root?.AIO?.buildNewsSurfaceModel?.('briefing', items, windowInfo ? {
      windowStart: windowInfo.start,
      windowEnd: windowInfo.end,
      anchorDate: windowInfo.anchorDate?.toISOString?.().slice(0, 10)
    } : {}) || { items: [], eligibleCount: 0, emptyReason: 'native-model-unavailable' };
    const container = documentRef?.getElementById('briefing-live-news-list');
    if (container) {
      container.dataset.aioBriefingRenderer = 'native';
      renderNewsSummary(documentRef, root, model, selectNewsStatus(state));
      appendBriefingNews(documentRef, root, container, model, selectNewsStatus(state), windowInfo, documentRef.getElementById('briefing-news-more'));
    }
    return;
  }
  if (route !== 'market-news') return;

  const controls = root?.AIO?.getNewsSurfaceControls?.() || { countryFilter: 'all', topicFilter: 'all', typeTab: 'all', sortMode: 'time' };
  const model = root?.AIO?.buildNewsSurfaceModel?.('market-news', items, { ...controls, nowMs: Date.now() }) || { items: [], eligibleCount: 0, emptyReason: 'native-model-unavailable' };
  const container = documentRef?.getElementById('live-news-feed');
  if (!container) return;
  const configuredLimit = Number(root?._aioNewsVisibleLimit);
  const visibleLimit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 12;
  renderNewsSummary(documentRef, root, model, selectNewsStatus(state));
  appendMarketNews(documentRef, root, container, model, selectNewsStatus(state), visibleLimit, controls);
  container.dataset.aioNewsRenderer = 'native';
}

export function createNewsPage({ root = globalThis, documentRef, store, route = 'market-news' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const renderNow = () => render({ documentRef, root, store, route });
      const page = documentRef?.getElementById(`page-${route}`);
      const suppliedMaterialBridge = page ? createSuppliedMaterialBridge(documentRef, {
        routeId: route,
        heading: route === 'briefing' ? '브리핑 · 시장 확인·거시 시차·이벤트 창' : '시장 뉴스 · 이벤트와 가격 반응 창'
      }) : null;
      if (suppliedMaterialBridge) {
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge.remove());
      }
      renderNow();
      const unsubscribe = store?.subscribe?.(renderNow);
      if (unsubscribe) bag.add(unsubscribe);
      const eventTarget = documentRef || root;
      ['aio:newsUpdated', 'aio:newsSurfaceInvalidated', 'aio:refresh:done', 'aio:serverDataLoaded'].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, renderNow);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, renderNow));
      });
       if ((route === 'market-news' || route === 'briefing') && page) page.dataset.aioArchitectureRenderer = 'native';
       const briefingMore = route === 'briefing' ? documentRef?.getElementById('briefing-news-more') : null;
       if (briefingMore) {
         briefingMore.removeAttribute('data-action');
         const onToggle = () => {
           const list = documentRef?.getElementById('briefing-live-news-list');
           const expanded = list?.classList.toggle('is-expanded');
           briefingMore.dataset.aioExpanded = expanded ? '1' : '0';
           if (list) list.style.maxHeight = expanded ? 'none' : '';
           renderNow();
         };
         briefingMore.addEventListener('click', onToggle);
         bag.add(() => briefingMore.removeEventListener('click', onToggle));
       }
      bag.add(() => {
        if (page?.dataset.aioArchitectureSlice === 'news') delete page.dataset.aioArchitectureSlice;
        if (page?.dataset.aioArchitectureState) delete page.dataset.aioArchitectureState;
         if ((route === 'market-news' || route === 'briefing') && page?.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
         const container = documentRef?.getElementById('live-news-feed');
         if (route === 'market-news' && container?.dataset.aioNewsRenderer === 'native') delete container.dataset.aioNewsRenderer;
         const briefingContainer = documentRef?.getElementById('briefing-live-news-list');
         if (route === 'briefing' && briefingContainer?.dataset.aioBriefingRenderer === 'native') delete briefingContainer.dataset.aioBriefingRenderer;
      });
      return () => bag.dispose();
    }
  };
}
