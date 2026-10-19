import { createResourceBag } from '../../app/lifecycle.js';
import { consumeResearchHandoff } from '../../app/research-handoff.js';
import { renderBriefingRead } from '../components/briefing-read.js';
import { closeBasis } from '../../domain/briefing/market-read.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { selectNewsItems, selectNewsStatus } from '../../state/selectors/news.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { groupNewsStories, newsArticleKey, newsEvidence, resolveNewsIssuers, selectIntradayNews } from '../../domain/news/stories.js';
import { briefingWindowKST, deriveNewsSummary, isNewsAnalysisEligible, isNewsHeadlineOnly, isNewsTopicReviewRequired } from '../../domain/news/scoring.js';
import { finiteNumber as finite } from '../../domain/shared/number.js';
import { newsFlow } from '../../domain/market/page-flow.js';
import { renderNextSteps } from '../components/page-flow.js';

function text(documentRef, value, fallback = '—') {
  const node = documentRef.createElement('span');
  node.textContent = value == null || value === '' ? fallback : String(value);
  return node;
}

// LC-33: `emptyReason` is a pipeline enum (`_aioNewsEmptyReason`), not user copy. The old empty
// state interpolated the raw token (`all-news-outside-time-window`) into the sentence, which reads
// as a bug to a user. Every known reason is translated to filter/period/count wording, and an
// unknown token falls back to a generic sentence instead of leaking itself.
const NEWS_EMPTY_REASON_COPY = Object.freeze({
  'no-input-news': '수신된 뉴스가 없습니다.',
  'all-news-outside-time-window': '선택한 조건으로 오늘 08:00 KST까지 24시간 동안 들어온 뉴스가 없습니다.',
  'below-score-threshold-or-policy-excluded': '들어온 뉴스 가운데 중요도 기준을 넘은 것이 없습니다.',
  'filters-removed-all-eligible-news': '선택한 필터에 맞는 뉴스가 없습니다.',
  'no-verified-current-news-for-surface-policy': '확인된 최신 뉴스가 없습니다.',
  'native-model-unavailable': '뉴스 분류를 불러오지 못했습니다.'
});

// P1537 (audit H07): the article list follows the country/topic controls; the channel (Telegram) list below it is classified
// on its own and never follows them. Both scopes are written out so a count is never read as covering the other list.
// v57.77: the type tabs left (기업 is a topic chip now), so only country and topic count as filters.
export function describeNewsScope(controls) {
  const active = !!controls && ['countryFilter', 'topicFilter'].some((key) => controls[key] && controls[key] !== 'all');
  return { articles: active ? '필터 적용' : '필터 없음', channel: active ? '채널 소식은 국가·주제 필터와 무관하게 자체 분류로 표시됩니다.' : '' };
}

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
  // P1673: once the news model has loaded, zero sources is a result, not a check still in progress.
  set('news-24h-sources', summary.sourceCount ? `${summary.sourceCount}개 출처` : (model ? '0개 출처' : '출처 확인 중'));
  // P1672: the keyword sentiment/risk strip left with P1391, so no news sentiment score is shown at all.
  let cut = null;
  try { cut = root?.AIO?.getSharedMarketCut?.() || null; } catch (_) {}
  const generatedAt = root?._serverDataMeta?.generatedAt || null;
  // v57.91 (wording audit): '10. 16. 오후 08:51' read unlike every other stamp on the screen — one M/D HH:MM form.
  const generatedStamp = generatedAt ? compactKstTime(generatedAt) : null;
  const generatedLabel = generatedStamp ? `${generatedStamp.date} ${generatedStamp.time}` : '';
  // Codex review 2026-10-05: the list is filtered to the 08:00 KST window of today, but the header named the
  // data revision's older cut ("기준시각 경과 · 10/04 08:00") beside 10/5 articles. The header now names
  // the window the list actually uses, and staleness is stated as the last collection time.
  const newsWindow = briefingWindowKST(Date.now());
  // Audit 2026-10-14: one date format on the news screen (M/D HH:MM), the same as the cards and the intraday list.
  const fmt = (ms) => { const t = compactKstTime(new Date(ms).toISOString()); return t ? `${t.date} ${t.time}` : ''; };
  // P1591 (E03): when the published cycle is older than today's 08:00 window, the header names the cycle the
  // articles actually come from instead of the wall-clock window they do not fill.
  // X21 (2026-10-13): the list is filtered by the model's own window (the published cycle when it is admissible,
  // otherwise the latest completed 08:00 window). The header used the server cycle even when the model had fallen
  // back, so it named 10/11~10/12 above 10/12 23:00 articles. Name the window the list actually used.
  const modelStart = Date.parse(model?.newsCycle?.start || '');
  const modelEnd = Date.parse(model?.newsCycle?.end || '');
  const hasModelWindow = Number.isFinite(modelStart) && Number.isFinite(modelEnd) && modelEnd > modelStart;
  const cycleStart = hasModelWindow ? modelStart : Date.parse(root?._serverDataMeta?.newsCycleStart || '');
  const cycleEnd = hasModelWindow ? modelEnd : Date.parse(root?._serverDataMeta?.newsCycleEnd || '');
  const olderCycle = Number.isFinite(cycleEnd) && newsWindow.end != null && cycleEnd < newsWindow.end - 60000;
  if (olderCycle && Number.isFinite(cycleStart)) set('news-window-label', `직전 수집본 · ${fmt(cycleStart)} ~ ${fmt(cycleEnd)} KST 기사 — 이번 ${fmt(newsWindow.end)} 수집본은 아직 없습니다`);
  else if (hasModelWindow) set('news-window-label', `${fmt(cycleStart)} ~ ${fmt(cycleEnd)} KST 기사`);
  else if (newsWindow.start != null) set('news-window-label', `${fmt(newsWindow.start)} ~ ${fmt(newsWindow.end)} KST 기사`);
  const importantNote = documentRef?.querySelector('#news-important-title .briefing-h2-note');
  if (importantNote) importantNote.textContent = `주제별 핵심 · ${fmt(olderCycle ? cycleEnd : newsWindow.end)} KST까지 24시간`;
  set('last-fetch-time', cut?.status === 'stale' || status === 'stale'
    ? `수집 지연 · 마지막 수집 ${generatedLabel || '확인 필요'}`
    : generatedLabel ? `마지막 수집 ${generatedLabel}` : (status === 'current' ? '정상 수신' : '수신 대기'));
}

function safeUrl(value) {
  try {
    const url = new URL(String(value || ''), 'https://invalid.local');
    if (url.origin === 'https://invalid.local' && !/^https?:/i.test(String(value || ''))) return '';
    return /^https?:$/i.test(url.protocol) && !url.username && !url.password ? url.href : '';
  } catch (_) {
    return '';
  }
}

// T17 (expert review 2026-10-13): the 긍정/부정/주의 badge counted bull/bear words in the headline — a grade with no
// validated basis. Only the article's verification state is shown; an analysed article carries no badge.
function articleStatus(item) {
  if (isNewsAnalysisEligible(item)) return { label: '', color: 'transparent' };
  return isNewsHeadlineOnly(item)
    ? { label: '본문 없음', color: 'var(--text-muted)' }
    : { label: '검증 대기', color: 'var(--data-amber)' };
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

function createTickerBadge(documentRef, ticker, direct = false) {
  const badge = documentRef.createElement('span');
  const symbol = String(ticker || '').replace('$', '');
  badge.dataset.action = '_aioNewsTickerClick';
  badge.dataset.arg = symbol;
  badge.setAttribute('role', 'button');
  badge.tabIndex = 0;
  badge.textContent = /^[A-Z0-9.^=-]+$/.test(symbol) ? ticker : symbol; // Korean company names carry no $ marker
  badge.title = `${direct ? '직접 당사자' : '기사에 언급된 관련 회사'} · ${symbol} 종목 분석`;
  badge.dataset.issuerRole = direct ? 'subject' : 'mentioned';
  badge.className = 'nws-ticker';
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
  const original = typeof root?._aioTitleWithoutSource === 'function' ? root._aioTitleWithoutSource(item) : item?.title;
  const translated = /[가-힣]/.test(ko) && typeof root?._aioTitleWithoutSource === 'function' ? root._aioTitleWithoutSource(item, ko) : ko;
  const title = /[가-힣]/.test(ko) ? translated : (original || item?.headline || '제목 없음');
  return typeof root?._aioStripPictographs === 'function' ? root._aioStripPictographs(title) : title; // P1500
}

// Audit 2026-10-14: a topic names the forward branch it feeds (거시 · 향후 시나리오), so a headline is read as
// evidence for or against a path rather than as an isolated event. Topics without a clear branch stay unlabelled.
const TOPIC_BRANCHES = Object.freeze({ macro: '물가·고용 시나리오', fxbond: '물가·달러 시나리오', bond: '물가 재가속 시나리오', fx: '달러 급등 시나리오', energy: '유가 충격 시나리오', credit: '신용 경색 시나리오', geo: '유가·변동성 충격 시나리오' });
const TOPIC_LABELS = Object.freeze({ macro: '거시', semi: '반도체·AI', geo: '지정학', energy: '에너지', fxbond: '금리·외환', bond: '금리', fx: '외환', credit: '신용', crypto: '크립토', equity: '주식', earnings: '실적', kr: '한국' });

function createNewsCard(documentRef, root, item, index) {
  const card = documentRef.createElement('div');
  const tone = articleStatus(item);
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
  card.dataset.articleKey = newsArticleKey(item);
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
  const tickers = earnings?.symbol ? [earnings.symbol] : extractedTickers;
  // P1591 (E05): one badge per company — '$$삼성전자' and '$삼성전자' were the same symbol with a doubled marker.
  const uniqueTickers = resolveNewsIssuers(item, tickers, root?.AIO_TICKER_NAME_REGISTRY?.entries);
  // v57.88 (screen audit): registry topic keys (GE_VRN, TSLA_AUTOPILOT) are not symbols and never become a badge.
  uniqueTickers.filter((ticker) => !String(ticker).includes('_')).slice(0, 4).forEach((ticker) => headline.appendChild(createTickerBadge(documentRef, `$${ticker}`, ticker === item?.issuerSymbol)));
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
  // v57.76: the NewsData free-plan delay marker left with the personal NewsData fetcher (no producer sets it).
  const branchLabel = TOPIC_BRANCHES[item?.topic || item?.feedTopic] || '';
  // Owner 2026-10-18: a rumour or anonymous-source headline is labelled where the reader sees it, not only scored down.
  const verificationLabel = item?.verification === 'unconfirmed' ? '미확인 보도(루머·익명 소식통)' : '';
  meta.textContent = [source, verificationLabel, topicLabel, branchLabel, timeAgo]
    .filter(Boolean)
    .join(' · ');
  body.appendChild(meta);
  const evidence = documentRef.createElement('details');
  evidence.className = 'news-evidence';
  evidence.addEventListener('click', (event) => event.stopPropagation());
  const facts = newsEvidence(item);
  const evidenceTitle = documentRef.createElement('summary');
  evidenceTitle.textContent = [facts.kind, facts.revision, item?.storyArticles?.length > 1 ? `변경 이력 ${item.storyArticles.length}건` : '출처·시각'].filter(Boolean).join(' · ');
  // v57.54 audit (11): seventeen identical "기사 · 출처·시각" folds were indistinguishable to a screen reader; each names its headline.
  evidenceTitle.setAttribute('aria-label', `${evidenceTitle.textContent} — ${String(title || '').slice(0, 80)}`);
  evidence.appendChild(evidenceTitle);
  const detail = documentRef.createElement('div');
  detail.textContent = [`발행 ${formatAbsoluteTime(facts.publishedAt) || '미제공'}`, `관찰 ${formatAbsoluteTime(facts.observedAt) || '미제공'}`,
    `수집 ${formatAbsoluteTime(item?.fetchedAt) || '미제공'}`,
    // LC-31 (v57.77): the 카테고리별 view that named this boundary left; a feed-query topic says so in the card's fold.
    isNewsTopicReviewRequired(item) && topicLabel ? `주제 표시(${topicLabel})는 출처 기준 분류 · 기사 본문으로 확인 전` : ''].filter(Boolean).join(' · ');
  evidence.appendChild(detail);
  if (item?.storyArticles?.length > 1) {
    evidence.appendChild(text(documentRef, item.storySelection));
    const timeline = documentRef.createElement('ol');
    for (const article of item.storyArticles) {
      const row = documentRef.createElement('li');
      const articleFacts = newsEvidence(article);
      const articleUrl = safeUrl(article?.link || article?.url);
      const label = `${formatAbsoluteTime(articleFacts.publishedAt) || '발행 시각 미제공'} · ${articleFacts.revision || articleFacts.kind} · ${realTitle(root, article)}`;
      if (articleUrl) {
        const anchor = documentRef.createElement('a');
        anchor.href = articleUrl; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = label;
        // 2026-10-19: same-cycle carry made multi-article stories common; a 15px inline link failed the 24px target rule on ipad820.
        anchor.classList.add('aio-inline-target'); // --touch-min, src/ui/styles/layout-primitives.css
        row.appendChild(anchor);
      } else row.textContent = label;
      timeline.appendChild(row);
    }
    evidence.appendChild(timeline);
  } else if (item?.title && title !== item.title) {
    const original = documentRef.createElement('div');
    original.textContent = `원문 제목 · ${item.title}`;
    evidence.appendChild(original);
  }
  body.appendChild(evidence);

  const stance = documentRef.createElement('span');
  stance.textContent = headlineOnly ? '' : tone.label;
  stance.className = 'nws-stance';
  stance.style.color = tone.color;
  card.append(timeColumn, body, stance);
  return card;
}

const newsKey = (item) => newsArticleKey(item);

// v57.50 I23: 재무 공시 → 뉴스 arrives with one ticker. The feed is narrowed to stories whose issuer resolves to that
// ticker (the same resolver the card badges use), until the reader clears it.
function newsTickerFocus(root) {
  const value = String(root?._aioNewsTickerFocus || '').trim().toUpperCase();
  return /^[A-Z0-9][A-Z0-9.^=-]{0,11}$/.test(value) ? value : null;
}
function mentionsTicker(root, item, ticker) {
  if (String(item?.issuerSymbol || '').toUpperCase() === ticker) return true;
  const issuers = resolveNewsIssuers(item, displayValue(root, 'getDisplayTickers', item, []), root?.AIO_TICKER_NAME_REGISTRY?.entries || {});
  return issuers.some((symbol) => String(symbol).toUpperCase() === ticker);
}
function focusModel(root, model, ticker) {
  if (!ticker || !model) return model;
  const keep = (list) => (Array.isArray(list) ? list.filter((item) => mentionsTicker(root, item, ticker)) : list);
  return { ...model, items: keep(model.items), eligibleItems: keep(model.eligibleItems), eligibleCount: Array.isArray(model.eligibleItems) ? keep(model.eligibleItems).length : model.eligibleCount };
}
function renderTickerFocusNote(documentRef, root, container, ticker, count) {
  let note = documentRef.getElementById('news-ticker-focus');
  if (!ticker) { note?.remove?.(); return; }
  if (!note) {
    note = documentRef.createElement('p');
    note.id = 'news-ticker-focus';
    note.className = 'theme-strength-basis';
    container.insertAdjacentElement?.('beforebegin', note);
  }
  const clear = documentRef.createElement('button');
  clear.type = 'button'; clear.className = 'aio-btn-table'; clear.textContent = '전체 뉴스 보기';
  clear.addEventListener('click', () => {
    root._aioNewsTickerFocus = null;
    documentRef.dispatchEvent?.(new CustomEvent('aio:newsSurfaceInvalidated', { detail: { reason: 'news-ticker-focus' } }));
  });
  note.replaceChildren(documentRef.createTextNode(`${ticker} 관련 기사 ${count}건만 표시 중 · `), clear);
}

// P1391 (owner review 2026-10-02): the news screen leads with important stories — the highest-scored
// item per topic inside the completed 24h window — and the full feed below excludes them.
// P1730: '08:00 이후 장중 속보 · 잠정' — a short slot above the important list for headlines published after the 08:00
// bundle closed (producer P1720 newsIntraday). Title and time only; the publisher sits in the hover. No data, no slot.
function renderIntradayNews(documentRef, root, canonicalItems, nowMs = Date.now()) {
  const anchor = documentRef?.getElementById('news-important');
  let section = documentRef?.getElementById('news-intraday');
  const cycleEndMs = Date.parse(root?._serverDataMeta?.newsCycleEnd || '');
  const picked = selectIntradayNews(root?._serverNewsIntraday, { cycleEndMs, canonical: canonicalItems, nowMs });
  if (!picked.length || !anchor) {
    if (section) section.hidden = true;
    return 0;
  }
  if (!section) {
    section = documentRef.createElement('section');
    section.id = 'news-intraday';
    section.className = 'aio-section briefing-block';
    section.setAttribute('aria-labelledby', 'news-intraday-title');
    anchor.before(section);
  }
  const kst = (ms) => compactKstTime(new Date(ms).toISOString());
  const end = kst(cycleEndMs);
  const today = kst(nowMs)?.date;
  const heading = documentRef.createElement('h2');
  heading.className = 'briefing-h2';
  heading.id = 'news-intraday-title';
  heading.append('08:00 이후 속보 · 잠정 ');
  const note = documentRef.createElement('span');
  note.className = 'briefing-h2-note';
  note.textContent = `${end ? `${end.date} ${end.time}` : '08:00'} 이후 헤드라인 · 다음 08:00 수집본 전까지`;
  heading.append(note);
  const list = documentRef.createElement('ul');
  list.className = 'news-intraday-list';
  picked.forEach((item) => {
    const row = documentRef.createElement('li');
    const stampParts = kst(item.publishedMs);
    const time = documentRef.createElement('time');
    time.dateTime = new Date(item.publishedMs).toISOString();
    time.textContent = stampParts ? (stampParts.date === today ? stampParts.time : `${stampParts.date} ${stampParts.time}`) : '';
    const href = safeUrl(item.link || item.url);
    const titleNode = documentRef.createElement(href ? 'a' : 'span');
    titleNode.textContent = `${item.verification === 'unconfirmed' ? '[미확인] ' : ''}${String(item.title || '')}`;
    if (href) { titleNode.href = href; titleNode.target = '_blank'; titleNode.rel = 'noopener noreferrer'; }
    // P1739: a 12px/1.5 link was an 18-21px target; padding keeps every headline link at least 24px tall.
    // v57.77 (a11y 1.4.3): the browser-default link blue measured 1.94:1 in dark; the text colour token passes in both themes.
    titleNode.className = 'nws-intraday-link'; // src/ui/styles/news-page.css
    // Sources stay off the screen text (owner 2026-10-06): publisher and full time live in the hover.
    titleNode.title = [item.source, formatAbsoluteTime(item.publishedMs ? new Date(item.publishedMs) : null)].filter(Boolean).join(' · ');
    row.append(time, titleNode);
    list.appendChild(row);
  });
  section.replaceChildren(heading, list);
  section.hidden = false;
  return picked.length;
}

function pickImportantNews(items = [], limit = 5) {
  const picked = items.filter((item) => item.storyHasRevision);
  const topics = new Set();
  for (const item of [...items].sort((a, b) => (finite(b?.score) || 0) - (finite(a?.score) || 0))) {
    const topic = item?.topic || item?.feedTopic || 'general';
    // Filler is worse than a shorter list: unclassified and low-score items stay in the full feed.
    if (picked.includes(item) || item?._tgChannel || topic === 'general' || (finite(item?.score) || 0) < 50 || topics.has(topic) || picked.length >= limit) continue;
    topics.add(topic);
    picked.push(item);
    if (picked.length >= limit) break;
  }
  return picked;
}

function appendMarketNews(documentRef, root, container, model, status, visibleLimit, controls, exclude = new Set()) {
  const eligible = groupNewsStories(Array.isArray(model?.eligibleItems) ? model.eligibleItems : model?.items || []).filter((item) => !exclude.has(newsKey(item)));
  const displayed = eligible.slice(0, visibleLimit);
  container.replaceChildren();
  if (!displayed.length) {
    const empty = documentRef.createElement('div');
    empty.className = 'nws-empty';
    // P1164/B03: 창 밖에 남은 과거 수집분을 오늘 뉴스로 읽히게 두지 않는다.
    // LC-32: 분류가 피드 query에서 복사된 경우, 0건은 '해당 주제 뉴스가 없다'가 아니라
    // '이 필터가 피드 분류를 기준으로 걸러낸 결과'임을 함께 밝힌다.
    const reviewFlagged = eligible.filter(isNewsTopicReviewRequired).length;
    const outOfWindow = Number(model?.outOfWindowCount || 0);
    empty.textContent = status === 'unavailable'
      ? '뉴스 수신 대기 — 새로고침 후 검증된 뉴스가 표시됩니다.'
      : (model?.emptyReason === 'all-news-outside-time-window' && outOfWindow > 0
          ? `이 조건의 오늘 뉴스(08:00 KST까지 24시간)가 아직 없습니다 · 이전 뉴스 ${outOfWindow}건은 기간 밖입니다.`
          : `현재 조건에서 08:00 KST까지 24시간 · 중요도 기준 뉴스가 없습니다. ${describeNewsEmptyReason(model?.emptyReason)}${outOfWindow > 0 ? ` (수집 제외 항목 제외 후 · 창 밖 이전 수집분 ${outOfWindow}건 제외)` : ''}${reviewFlagged > 0 ? ` · 피드 분류로만 걸러진 항목 ${reviewFlagged}건은 기사별 검토가 필요합니다.` : ''}`);
    container.appendChild(empty);
    if (describeNewsScope(controls).articles === '필터 적용') {
      const reset = documentRef.createElement('button');
      reset.type = 'button'; reset.textContent = '필터 초기화';
      reset.addEventListener('click', () => {
        const all = (group) => documentRef.querySelector?.(`#${group} [data-arg="all"]`) || null;
        root?.filterNewsByCountry?.('all', all('news-country-chips'));
        root?.filterNewsByTopic?.('all', all('news-topic-chips'));
      });
      empty.append(documentRef.createElement('br'), reset);
    }
  } else {
    // v57.77: the 카테고리별 grouped view left with the type tabs — each card already names its topic, and the topic
    // chips narrow the list to one group.
    displayed.forEach((item, index) => container.appendChild(createNewsCard(documentRef, root, item, index)));
  }

  const count = documentRef.getElementById('market-news-count');
  if (count) { count.setAttribute('role', 'status'); count.setAttribute('aria-live', 'polite'); count.textContent = `조건에 맞는 기사 ${model?.eligibleCount || 0}건 · 같은 사건 묶은 뒤 ${eligible.length}건 중 ${displayed.length}건 표시 · 중요 사건 ${exclude.size}건 · ${describeNewsScope(controls).articles}`; }
  const summary = documentRef.getElementById('news-visible-summary');
  if (summary) summary.textContent = `기사 ${model?.eligibleCount || 0}건 · 아래 사건 ${eligible.length}건 중 ${displayed.length}건 표시`;
  const more = documentRef.getElementById('news-load-more-wrap');
  if (more) {
    // P1449: "더 보기"는 렌더 가능한 풀(model.items, maxItems 계약)을 기준으로 숨긴다 —
    // eligibleCount(전체 창 개수)는 계약 캡보다 클 수 있어, 모든 기사를 표시한 뒤에도 버튼이
    // 남아 클릭해도 아무것도 추가되지 않는 결함이 나왔다. 남은 이유는 요약이 말한다.
    const poolSize = eligible.length;
    more.hidden = displayed.length >= poolSize;
    // P1592 (F29): name what 'more' does and where the list ends, in reader terms.
    const moreButton = more.querySelector('[data-action="_aioNewsLoadMore"]');
    if (moreButton) moreButton.textContent = `${Math.min(12, Math.max(0, poolSize - displayed.length))}개 더 보기`;
    more.title = `아래 사건 ${poolSize}건 중 아직 표시하지 않은 사건을 펼칩니다.`;
  }
}

// P1592 (F25): the selected country/topic is carried in the accessibility tree, not only in inline
// colour — chips are toggle buttons with aria-pressed.
function syncNewsControlState(documentRef, controls) {
  const mark = (selector, current) => {
    documentRef?.querySelectorAll?.(selector).forEach((node) => {
      if (node.tagName !== 'BUTTON') {
        node.setAttribute('role', 'button');
        if (!node.hasAttribute('tabindex')) node.tabIndex = 0;
      }
      const value = node.dataset.arg || (node.dataset.action === 'filterNewsByTelegramOnly' ? 'tg' : 'all');
      node.setAttribute('aria-pressed', String(value === current));
    });
  };
  mark('#news-country-chips [data-action]', controls?.countryFilter || 'all');
  mark('#news-topic-chips [data-action="filterNewsByTopic"]', controls?.topicFilter || 'all');
}

// v57.54 audit (11): the native list never asked for translation — the legacy trigger ran only at the end of a direct
// RSS fetch, which the published-news path skips, so live headlines stayed English (translation cache 0 on 10/14). The
// shown, untranslated titles are requested once per session through the same pipeline, which repaints this list
// through aio:newsSurfaceInvalidated when it finishes.
function requestShownTranslations(root, items) {
  if (typeof root?.autoTranslateNews !== 'function') return;
  const asked = root.__aioNewsTranslationAsked || (root.__aioNewsTranslationAsked = new Set());
  const pending = (items || []).filter((item) => {
    const title = String(item?.title || '');
    if (!title || /[가-힣]/.test(title) || asked.has(title)) return false;
    const cached = root?._translationCache?.get?.(root?._tcKey?.(title));
    return !(cached && cached.ko_title && /[가-힣]/.test(cached.ko_title));
  }).slice(0, 18);
  if (!pending.length) return;
  pending.forEach((item) => asked.add(String(item.title)));
  try { Promise.resolve(root.autoTranslateNews(pending)).catch(() => {}); } catch (_) {}
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
    // T18: the title date is the US close the read is based on, not the KST calendar day.
    root?._aioRenderBriefingDateLine?.(undefined, closeBasis(root?._aioHistory || []));
    return;
  }
  if (route !== 'market-news') return;

  const controls = root?.AIO?.getNewsSurfaceControls?.() || { countryFilter: 'all', topicFilter: 'all', typeTab: 'all', sortMode: 'time' };
  const tickerFocus = newsTickerFocus(root);
  const model = focusModel(root, root?.AIO?.buildNewsSurfaceModel?.('market-news', items, { ...controls, nowMs: Date.now() }) || { items: [], eligibleCount: 0, emptyReason: 'native-model-unavailable' }, tickerFocus);
  const container = documentRef?.getElementById('live-news-feed');
  if (!container) return;
  const configuredLimit = Number(root?._aioNewsVisibleLimit);
  const visibleLimit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 12;
  renderNewsSummary(documentRef, root, model, selectNewsStatus(state));
  // P1730: after the Korean close (15:30 KST) until the next 08:00 bundle, the header says where the session's articles are.
  const nowMs = Date.now();
  const intradayCount = renderIntradayNews(documentRef, root, items, nowMs);
  const kstMinutes = ((new Date(nowMs).getUTCHours() + 9) % 24) * 60 + new Date(nowMs).getUTCMinutes();
  const windowLabel = documentRef?.getElementById('news-window-label');
  if (intradayCount && windowLabel && (kstMinutes >= 15 * 60 + 30 || kstMinutes < 8 * 60)) {
    windowLabel.textContent = `${windowLabel.textContent} · 한국장 시간대 기사는 속보 칸에, 정식 묶음은 다음 08:00 수집본`;
  }
  syncNewsControlState(documentRef, controls);
  // P1428 (Codex review): the important list follows the same country/topic filter as the feed — a 한국
  // filter that emptied the feed still showed overseas stories above it.
  const importantModel = focusModel(root, root?.AIO?.buildNewsSurfaceModel?.('market-news', items, { countryFilter: controls.countryFilter || 'all', topicFilter: controls.topicFilter || 'all', typeTab: 'all', sortMode: 'score', nowMs: Date.now() }), tickerFocus);
  renderTickerFocusNote(documentRef, root, container, tickerFocus, Array.isArray(model?.eligibleItems) ? model.eligibleItems.length : (model?.items || []).length);
  const tgScope = documentRef?.getElementById('news-tg-scope');
  if (tgScope) tgScope.textContent = describeNewsScope(controls).channel;
  const important = pickImportantNews(groupNewsStories(importantModel?.eligibleItems || importantModel?.items || []));
  const importantList = documentRef?.getElementById('news-important-list');
  if (importantList) {
    importantList.replaceChildren(...(important.length
      ? important.map((item, index) => createNewsCard(documentRef, root, item, index))
      : [Object.assign(documentRef.createElement('div'), { className: 'briefing-empty', textContent: '표시 기간과 선택한 조건에 맞는 중요 뉴스가 없습니다.' })]));
  }
  if (!root._aioEarningsSnapshot && typeof root._fetchEarningsCalendarSnapshot === 'function' && !root._aioNewsEarningsRequested) {
    root._aioNewsEarningsRequested = true;
    Promise.resolve(root._fetchEarningsCalendarSnapshot()).then((snap) => {
      if (snap) {
        root._aioEarningsSnapshot = snap;
        documentRef?.dispatchEvent?.(new CustomEvent('aio:newsSurfaceInvalidated', { detail: { reason: 'news-earnings-ready' } }));
      }
    }).catch(() => {});
  }
  appendMarketNews(documentRef, root, container, model, selectNewsStatus(state), visibleLimit, controls, new Set(important.map(newsKey)));
  requestShownTranslations(root, [...important, ...(model?.items || []).slice(0, visibleLimit)]);
  renderNextSteps(documentRef, documentRef.getElementById('news-next'), newsFlow({ countryFilter: controls.countryFilter }).next); // v57.77
  container.dataset.aioNewsRenderer = 'native';
}

export function createNewsPage({ root = globalThis, documentRef, store, route = 'market-news' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById(`page-${route}`);
      // P1601/ST-10: incoming data stays pending while the reader is on this screen.
      // Filter/load-more actions apply immediately; arrivals never replace a focused article.
      let renderedKeys = null;
      let renderedControls = '';
      const updates = route === 'market-news' ? documentRef.createElement('button') : null;
      if (updates) {
        updates.type = 'button'; updates.className = 'flow-next-link'; updates.hidden = true;
        updates.dataset.newsUpdates = 'pending';
        updates.setAttribute('aria-live', 'polite');
        const count = documentRef.getElementById('market-news-count');
        count?.insertAdjacentElement?.('afterend', updates);
        bag.add(() => updates.remove());
      }
      const renderNow = (force = false) => {
        const rows = selectNewsItems(store?.getState?.() || {});
        const keys = new Set(rows.map(newsArticleKey));
        const controls = JSON.stringify([root?.AIO?.getNewsSurfaceControls?.() || {}, root?._aioNewsVisibleLimit, root?._aioNewsTickerFocus || null]);
        const changed = renderedKeys && (keys.size !== renderedKeys.size || [...keys].some((key) => !renderedKeys.has(key)));
        const explicit = force === true || (force?.type === 'aio:newsSurfaceInvalidated' && ['news-sort', 'news-load-more', 'news-country-telegram', 'news-country-filter', 'news-topic-filter'].includes(force?.detail?.reason)) || controls !== renderedControls;
        if (updates && renderedKeys?.size > 0 && changed && !explicit) {
          const arriving = [...keys].filter((key) => !renderedKeys.has(key)).length;
          updates.textContent = arriving ? `새 뉴스·변경 ${arriving}건 보기` : '갱신된 뉴스 보기';
          updates.hidden = false;
          return;
        }
        const active = documentRef.activeElement;
        if (updates && renderedKeys && !changed && !explicit && page?.contains?.(active) && active?.closest?.('.news-item-card')) return;
        render({ documentRef, root, store, route });
        renderedKeys = keys; renderedControls = controls;
        if (updates) updates.hidden = true;
      };
      if (updates) updates.addEventListener('click', () => {
        const firstVisible = [...(page?.querySelectorAll?.('.news-item-card') || [])].find((node) => node.getBoundingClientRect().bottom > 0);
        const anchorKey = firstVisible?.dataset.articleKey;
        const offset = firstVisible?.getBoundingClientRect().top;
        renderNow(true);
        const anchor = [...(page?.querySelectorAll?.('.news-item-card') || [])].find((node) => node.dataset.articleKey === anchorKey);
        if (anchor && Number.isFinite(offset)) root?.scrollBy?.(0, anchor.getBoundingClientRect().top - offset);
        const count = documentRef.getElementById('market-news-count');
        count?.setAttribute('tabindex', '-1'); count?.focus?.({ preventScroll: true });
      });
      const suppliedMaterialBridge = page ? createSuppliedMaterialBridge(documentRef, {
        routeId: route,
        heading: route === 'briefing' ? '브리핑 · 시장 확인·거시 시차·이벤트 전후' : '시장 뉴스 · 이벤트 전후 가격 반응'
      }) : null;
      if (suppliedMaterialBridge) {
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge.remove());
      }
      // v57.50 I23: a ticker handed over from 재무 공시 opens 기업 뉴스 narrowed to it; a plain visit shows everything.
      // v57.77: 기업 뉴스 is the 기업 topic chip (the type tabs left).
      if (route === 'market-news') {
        const handoffContext = consumeResearchHandoff({ root, routeId: 'market-news' })?.context || {};
        const focus = String(handoffContext.ticker || '').trim().toUpperCase();
        root._aioNewsTickerFocus = focus || null;
        // P1730 (R2 next-step links): a briefing link that names a topic or country opens the list already filtered,
        // through the same filter functions and chips the reader would press.
        const chip = (group, value) => [...(documentRef.querySelectorAll?.(`#${group} [data-arg]`) || [])].find((node) => node.dataset.arg === value) || null;
        if (focus && typeof root?.filterNewsByTopic === 'function') {
          try { root.filterNewsByTopic('company', chip('news-topic-chips', 'company')); } catch (_) {}
        }
        const topic = String(handoffContext.topic || '').trim();
        const country = String(handoffContext.country || '').trim();
        if (topic && chip('news-topic-chips', topic) && typeof root?.filterNewsByTopic === 'function') {
          try { root.filterNewsByTopic(topic, chip('news-topic-chips', topic)); } catch (_) {}
        }
        if (country && chip('news-country-chips', country) && typeof root?.filterNewsByCountry === 'function') {
          try { root.filterNewsByCountry(country, chip('news-country-chips', country)); } catch (_) {}
        }
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
