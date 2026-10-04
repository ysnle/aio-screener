import { createResourceBag } from '../../app/lifecycle.js';
import { renderBriefingRead } from '../components/briefing-read.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { selectNewsItems, selectNewsStatus } from '../../state/selectors/news.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { classifyNewsTextStance, deriveNewsSummary, isNewsAnalysisEligible, isNewsHeadlineOnly, isNewsTopicReviewRequired } from '../../domain/news/scoring.js';

function text(documentRef, value, fallback = '—') {
  const node = documentRef.createElement('span');
  node.textContent = value == null || value === '' ? fallback : String(value);
  return node;
}

function finite(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

// LC-33: `emptyReason` is a pipeline enum (`_aioNewsEmptyReason`), not user copy. The old empty
// state interpolated the raw token (`all-news-outside-time-window`) into the sentence, which reads
// as a bug to a user. Every known reason is translated to filter/period/count wording, and an
// unknown token falls back to a generic sentence instead of leaking itself.
const NEWS_EMPTY_REASON_COPY = Object.freeze({
  'no-input-news': '수신된 뉴스가 없습니다.',
  'all-news-outside-time-window': '선택한 조건의 완료 24h 창 안에 들어온 뉴스가 없습니다.',
  'below-score-threshold-or-policy-excluded': '수신된 뉴스가 중요도·정책 기준을 통과하지 못했습니다.',
  'filters-removed-all-eligible-news': '현재 필터 조합이 적격 뉴스를 모두 제외했습니다.',
  'no-verified-current-news-for-surface-policy': '이 화면의 검증·현재성 기준을 통과한 뉴스가 없습니다.',
  'native-model-unavailable': '뉴스 판정 모델을 사용할 수 없어 표시를 보류합니다.'
});

function describeNewsEmptyReason(reason) {
  return NEWS_EMPTY_REASON_COPY[String(reason || '')] || '현재 조건에 맞는 뉴스가 없습니다.';
}

function renderNewsSummary(documentRef, root, model, status) {
  const rows = Array.isArray(model?.eligibleItems)
    ? model.eligibleItems
    : (Array.isArray(model?.items) ? model.items : []);
  const generatedAtMs = Date.parse(model?.generatedAt || '');
  const summary = deriveNewsSummary({
    items: rows,
    now: Number.isFinite(generatedAtMs) ? generatedAtMs : Date.now(),
    windowStart: model?.newsCycle?.start,
    windowEnd: model?.newsCycle?.end
  });
  const set = (id, value, fallback = '—') => {
    const node = documentRef?.getElementById(id);
    if (node) node.textContent = value == null || value === '' ? fallback : String(value);
  };
  set('news-24h-count', model?.eligibleCount ?? summary.itemCount, '0');
  set('news-24h-sources', summary.sourceCount ? `${summary.sourceCount}개 소스` : '소스 확인 중');
  set('news-sent-score', summary.score);
  set('news-sent-label', summary.label);
  const riskCopy = summary.riskSignals.map((signal) => signal.label);
  if (summary.pendingCount > 0) riskCopy.push(`본문/검증 필요 ${summary.pendingCount}건`);
  set('news-risk-count', summary.riskSignals.length, '0');
  set('news-risk-label', riskCopy.length
    ? riskCopy.join(' · ')
    : (summary.analyzedCount > 0 && !summary.sampleSufficient
      ? '표본 부족'
      : (summary.analyzedCount > 0 ? '식별된 위험 신호 없음' : '분석 보류')));
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

function sentimentTone(item) {
  if (!isNewsAnalysisEligible(item)) {
    return isNewsHeadlineOnly(item)
      ? { label: '본문 미수신', color: 'var(--text-muted)' }
      : { label: '검증 대기', color: 'var(--data-amber)' };
  }
  const sentiment = classifyNewsTextStance(`${item?.title || ''} ${item?.summary || item?.desc || ''}`);
  if (sentiment === 'bull') return { label: '긍정', color: 'var(--data-green)' };
  if (sentiment === 'bear') return { label: '부정', color: 'var(--data-red)' };
  if (sentiment === 'warn') return { label: '주의', color: 'var(--data-amber)' };
  return { label: '중립', color: 'var(--text-muted)' };
}

function displayValue(root, functionName, item, fallback = '') {
  try {
    const fn = root?.[functionName];
    if (typeof fn === 'function') return fn(item) || fallback;
  } catch (_) {}
  return fallback;
}

// W09-C/P1148 (F03): one formatting owner for the absolute publication time. The previous
// `root.getAbsoluteTime` lookup has no implementation anywhere in the repo, so the card silently
// dropped the absolute time and showed only a relative label. The publication time is rendered
// with its timezone and is never treated as the underlying event time.
export function formatAbsoluteTime(value, timeZone = 'Asia/Seoul') {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value || '');
  if (!Number.isFinite(ms)) return '';
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false, timeZoneName: 'short'
    }).format(new Date(ms));
  } catch (_) {
    return `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
  }
}

// P1428 (Codex review): the 44px time column wrapped "2026. 10. 03. 14:20 GMT+9" over four lines.
// It shows month/day over HH:mm in KST; the full stamp stays in the tooltip and data attribute.
export function compactKstTime(value) {
  const ms = Date.parse(value || '');
  if (!Number.isFinite(ms)) return null;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date(ms)).map((part) => [part.type, part.value]));
  return { date: `${Number(parts.month)}/${Number(parts.day)}`, time: `${parts.hour}:${parts.minute}` };
}

function publicationIso(item) {
  const raw = item?.publishedAt || item?.pubDate || item?.published || null;
  const ms = raw instanceof Date ? raw.getTime() : Date.parse(raw || '');
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
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

// P1391: a headline-only item without a real translation used to get a generated sentence
// ("매크로 · Reuters 기사 · 중요도 48") as its title. Show the translated title or the original.
function realTitle(root, item) {
  let ko = '';
  try {
    const cached = root?._translationCache?.get?.(root?._tcKey?.(item?.title));
    ko = (cached && !cached._failed && cached.ko_title) || item?.ko_title || '';
  } catch (_) { ko = item?.ko_title || ''; }
  return /[가-힣]/.test(ko) ? ko : (item?.title || item?.headline || '제목 없음');
}

const TOPIC_LABELS = Object.freeze({ macro: '매크로', semi: '반도체·AI', geo: '지정학', energy: '에너지', fxbond: '금리·외환', bond: '금리', fx: '외환', credit: '신용', crypto: '크립토', equity: '주식', earnings: '실적', kr: '한국' });

function createNewsCard(documentRef, root, item, index) {
  const card = documentRef.createElement('div');
  const tone = sentimentTone(item);
  const link = safeUrl(item?.link);
  const publishedIso = publicationIso(item);
  // The legacy hook is still preferred when a host actually provides it; otherwise the local
  // formatter supplies the absolute, timezone-aware timestamp instead of ''.
  const absTime = displayValue(root, 'getAbsoluteTime', item, '') || formatAbsoluteTime(publishedIso);
  const timeAgo = item?.pubDate ? displayValue(root, 'getTimeAgo', new Date(item.pubDate), '') : '';
  const title = displayValue(root, 'getDisplayTitle', item, '') || realTitle(root, item);
  const summary = displayValue(root, 'getDisplaySummary', item, item?.summary || item?.desc || '');
  const extractedTickers = displayValue(root, 'getDisplayTickers', item, []);

  card.className = 'news-item-card';
  card.dataset.newsId = item?.newsId || item?.id || `news-${index}`;
  card.dataset.newsIdx = String(index);
  if (link) card.dataset.openUrl = link;
  card.title = String(item?.title || title).slice(0, 200);

  const timeColumn = documentRef.createElement('div');
  timeColumn.className = 'news-time-col';
  const absolute = documentRef.createElement('span');
  absolute.className = 'news-time-abs';
  const compact = compactKstTime(publishedIso);
  if (compact) {
    const day = documentRef.createElement('span');
    day.className = 'news-time-day';
    day.textContent = compact.date;
    absolute.append(day, documentRef.createTextNode(compact.time));
  } else absolute.textContent = absTime || timeAgo || '—';
  // W09-C/P1148: keep the raw publication instant and its timezone representation on the node so
  // the absolute time survives independently of the display string and the original article link.
  if (publishedIso) {
    absolute.dataset.publishedAt = publishedIso;
    absolute.setAttribute('title', `발행 ${absTime || publishedIso} (한국 시간)`);
  }
  if (link) absolute.dataset.articleUrl = link;
  const dot = documentRef.createElement('span');
  dot.className = 'news-time-dot';
  dot.style.background = tone.color;
  timeColumn.append(absolute, dot);

  const body = documentRef.createElement('div');
  body.className = 'news-item-body';
  const headline = documentRef.createElement('div');
  headline.className = 'news-item-headline';
  // P1382/P1391: earnings headlines carry the structured estimate/actual line on the news screen too.
  // P1428: it is resolved first so an earnings story is tagged with the reporting company only — a
  // mentioned analyst's firm (Morgan Stanley on a Nike story) is not the article's subject.
  let earnings = null;
  try {
    if (root?._aioEarningsSnapshot && typeof root._aioEarningsContext === 'function') earnings = root._aioEarningsContext(item?.title, { earnings: root._aioEarningsSnapshot.earnings, names: root._aioSymNames || (root._aioSymNames = Object.fromEntries((Array.isArray(root.SCREENER_DB) ? root.SCREENER_DB : []).filter((row) => row?.sym && row?.name).map((row) => [row.sym, row.name]))) });
  } catch (_) { earnings = null; }
  const tickers = earnings?.symbol ? [`$${earnings.symbol}`] : extractedTickers;
  if (Array.isArray(tickers)) tickers.slice(0, 4).forEach((ticker) => headline.appendChild(createTickerBadge(documentRef, ticker)));
  // LC-34: the original article was reachable only through the card's `data-open-url` click
  // delegation, so keyboard/AT users had no focusable link. The headline is now a real anchor
  // (new tab, noopener); the card keeps its larger pointer target, and the delegation ignores the
  // anchor so the URL cannot open twice.
  if (link) {
    const anchor = documentRef.createElement('a');
    anchor.className = 'news-item-link';
    anchor.href = link;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = title || '제목 없음';
    anchor.setAttribute('aria-label', `${title || '제목 없음'} — 원문 새 창에서 열기`);
    headline.appendChild(anchor);
  } else {
    headline.appendChild(text(documentRef, title, '제목 없음'));
  }
  body.appendChild(headline);
  const headlineOnly = isNewsHeadlineOnly(item);
  // LC-32: a headline-only card has no article body, so no causal summary is shown (P1391: and no
  // boundary sentence either — the absence is the boundary).
  if (summary && !headlineOnly) {
    const summaryNode = documentRef.createElement('div');
    summaryNode.className = 'news-item-summary';
    summaryNode.textContent = summary;
    body.appendChild(summaryNode);
  }
  if (earnings?.text) {
    const earningsNode = documentRef.createElement('div');
    earningsNode.className = 'news-item-summary';
    earningsNode.textContent = earnings.text;
    earningsNode.title = earnings.source || '';
    body.appendChild(earningsNode);
  }
  const meta = documentRef.createElement('div');
  meta.className = 'news-item-meta';
  // EF-14/P1411: the source-name script guard moved here with the retired digest — a Cyrillic/CJK
  // feed name is shown as '외신' instead of leaking untranslated.
  const rawSource = typeof root?._aioSafeSourceLabel === 'function' ? root._aioSafeSourceLabel(item?.source || '') : item?.source || '';
  const source = item?._tgChannel ? `TG · ${rawSource}` : rawSource;
  // P1391: developer markers (selection score, headline-only boundary, feed-review flag) are not
  // user content; the card keeps source, topic and time. LC-31 still holds — a feed-query topic is
  // shown only as a plain label, never as a verified sector assignment elsewhere.
  const topicLabel = TOPIC_LABELS[item?.topic || item?.feedTopic] || '';
  const providerDelay = item?.providerDelayPolicy === 'plan-dependent-free-12h' ? '지연 가능' : '';
  if (providerDelay) meta.title = 'NewsData 무료 요금제는 12시간 지연됩니다. 게시 시각과 전달 지연은 다릅니다.';
  meta.textContent = [source, topicLabel, timeAgo, providerDelay]
    .filter(Boolean)
    .join(' · ');
  body.appendChild(meta);

  const stance = documentRef.createElement('span');
  stance.textContent = headlineOnly ? '' : tone.label;
  stance.style.cssText = `font-size:12px;font-weight:600;color:${tone.color};flex-shrink:0;`;
  card.append(timeColumn, body, stance);
  return card;
}

const newsKey = (item) => item?.newsId || item?.id || item?.link || item?.title;

// P1391 (owner review 2026-10-02): the news screen leads with important stories — the highest-scored
// item per topic inside the completed 24h window — and the full feed below excludes them.
function pickImportantNews(items = [], limit = 6) {
  const picked = [];
  const topics = new Set();
  for (const item of [...items].sort((a, b) => (finite(b?.score) || 0) - (finite(a?.score) || 0))) {
    const topic = item?.topic || item?.feedTopic || 'general';
    // Filler is worse than a shorter list: unclassified and low-score items stay in the full feed.
    if (item?._tgChannel || topic === 'general' || (finite(item?.score) || 0) < 50 || topics.has(topic)) continue;
    topics.add(topic);
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
}

function appendMarketNews(documentRef, root, container, model, status, visibleLimit, controls, exclude = new Set()) {
  const eligible = (Array.isArray(model?.items) ? model.items : []).filter((item) => !exclude.has(newsKey(item)));
  const displayed = eligible.slice(0, visibleLimit);
  container.replaceChildren();
  if (!displayed.length) {
    const empty = documentRef.createElement('div');
    empty.style.cssText = 'text-align:center;padding:30px;color:var(--text-muted);font-size:12px;line-height:1.7;';
    // P1164/B03: 창 밖에 남은 과거 수집분을 오늘 뉴스로 읽히게 두지 않는다.
    // LC-32: 분류가 피드 query에서 복사된 경우, 0건은 '해당 주제 뉴스가 없다'가 아니라
    // '이 필터가 피드 분류를 기준으로 걸러낸 결과'임을 함께 밝힌다.
    const reviewFlagged = eligible.filter(isNewsTopicReviewRequired).length;
    const outOfWindow = Number(model?.outOfWindowCount || 0);
    empty.textContent = status === 'unavailable'
      ? '뉴스 수신 대기 — 새로고침 후 검증된 뉴스가 표시됩니다.'
      : (model?.emptyReason === 'all-news-outside-time-window' && outOfWindow > 0
          ? `현재 조건에서 오늘(08:00 KST 완료 24h) 자료 미확보 · 이전 수집분 ${outOfWindow}건은 오늘 뉴스가 아닙니다.`
          : `현재 조건에서 08:00 KST 완료 24h · 중요도 기준 뉴스가 없습니다. ${describeNewsEmptyReason(model?.emptyReason)}${outOfWindow > 0 ? ` (창 밖 이전 수집분 ${outOfWindow}건 제외)` : ''}${reviewFlagged > 0 ? ` · 피드 분류로만 걸러진 항목 ${reviewFlagged}건은 기사별 검토가 필요합니다.` : ''}`);
    container.appendChild(empty);
  } else if (controls.typeTab === 'category') {
    const groups = new Map();
    displayed.forEach((item) => {
      const key = isNewsTopicReviewRequired(item)
        ? `${item?.feedTopic || item?.topic || 'general'} · 피드 분류 검토 필요`
        : (item?.topic || 'general');
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
  const summary = documentRef.getElementById('news-visible-summary');
  if (summary) summary.textContent = `전체 ${model?.eligibleCount || 0}건 중 ${displayed.length}건 표시`;
  const more = documentRef.getElementById('news-load-more-wrap');
  if (more) {
    // P1449: "더 보기"는 렌더 가능한 풀(model.items, maxItems 계약)을 기준으로 숨긴다 —
    // eligibleCount(전체 창 개수)는 계약 캡보다 클 수 있어, 모든 기사를 표시한 뒤에도 버튼이
    // 남아 클릭해도 아무것도 추가되지 않는 결함이 나왔다. 남은 이유는 요약이 말한다.
    const poolSize = eligible.length;
    const capped = Number(model?.eligibleCount || 0) > poolSize;
    more.hidden = displayed.length >= poolSize;
    if (capped) more.title = '일치 N건 중 계약 상한만 이 화면에 표시됩니다(더 보기로 확장되지 않습니다).';
    else more.title = '';
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
    // P1389: the briefing is a connected read of the completed close plus the schedule; its news
    // list moved to the news screen (important / general split).
    renderBriefingRead({ documentRef, root });
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
  // P1428 (Codex review): the important list follows the same country/topic filter as the feed — a 한국
  // filter that emptied the feed still showed overseas stories above it.
  const importantModel = root?.AIO?.buildNewsSurfaceModel?.('market-news', items, { countryFilter: controls.countryFilter || 'all', topicFilter: controls.topicFilter || 'all', typeTab: 'all', sortMode: 'score', nowMs: Date.now() });
  const tgScope = documentRef?.getElementById('news-tg-scope');
  if (tgScope) tgScope.textContent = (controls.countryFilter && controls.countryFilter !== 'all') || (controls.topicFilter && controls.topicFilter !== 'all') ? '선택한 필터는 텔레그램 채널 소식에는 적용되지 않습니다.' : '';
  const important = pickImportantNews(importantModel?.items || []);
  const importantList = documentRef?.getElementById('news-important-list');
  if (importantList) {
    importantList.replaceChildren(...(important.length
      ? important.map((item, index) => createNewsCard(documentRef, root, item, index))
      : [Object.assign(documentRef.createElement('div'), { className: 'briefing-empty', textContent: '오늘 24시간 안에 들어온 중요 뉴스가 없습니다.' })]));
  }
  if (!root._aioEarningsSnapshot && typeof root._fetchEarningsCalendarSnapshot === 'function' && !root._aioNewsEarningsRequested) {
    root._aioNewsEarningsRequested = true;
    Promise.resolve(root._fetchEarningsCalendarSnapshot()).then((snap) => { if (snap) { root._aioEarningsSnapshot = snap; render({ documentRef, root, store, route }); } }).catch(() => {});
  }
  appendMarketNews(documentRef, root, container, model, selectNewsStatus(state), visibleLimit, controls, new Set(important.map(newsKey)));
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
      // P1408: a render that throws during mount releases what this page already attached; the
      // router disposes only its own scope.
      try { renderNow(); } catch (error) { bag.dispose(); throw error; }
      const unsubscribe = store && subscribeToSlices(store, route === 'briefing' ? ['news', 'analysis', 'marketSnapshot'] : ['news'], renderNow);
      if (unsubscribe) bag.add(unsubscribe);
      const eventTarget = documentRef || root;
      ['aio:newsUpdated', 'aio:newsSurfaceInvalidated', 'aio:refresh:done', 'aio:serverDataLoaded',
        ...(route === 'briefing' ? ['aio:historyLoaded', 'aio:sentimentUpdated', 'aio:liveQuotes', 'aio:marketSnapshot'] : [])].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, renderNow);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, renderNow));
      });
       if ((route === 'market-news' || route === 'briefing') && page) page.dataset.aioArchitectureRenderer = 'native';
      bag.add(() => {
        if (page?.dataset.aioArchitectureSlice === 'news') delete page.dataset.aioArchitectureSlice;
        if (page?.dataset.aioArchitectureState) delete page.dataset.aioArchitectureState;
         if ((route === 'market-news' || route === 'briefing') && page?.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
         const container = documentRef?.getElementById('live-news-feed');
         if (route === 'market-news' && container?.dataset.aioNewsRenderer === 'native') delete container.dataset.aioNewsRenderer;
      });
      return () => bag.dispose();
    }
  };
}
