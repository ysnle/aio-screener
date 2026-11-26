import { createResourceBag } from '../../app/lifecycle.js';
import { consumeResearchHandoff } from '../../app/research-handoff.js';
import { renderBriefingRead } from '../components/briefing-read.js';
import { crossroadsForRoot } from '../components/macro-crossroads.js';
import { closeBasis } from '../../domain/briefing/market-read.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { selectNewsItems, selectNewsStatus } from '../../state/selectors/news.js';
import { subscribeToSlices } from '../../state/memoize.js';
import { groupNewsStories, newsArticleKey, newsEvidence, newsTopicOf, resolveNewsIssuers, selectIntradayNews } from '../../domain/news/stories.js';
import { briefingWindowKST, deriveNewsSummary, isNewsAnalysisEligible, isNewsHeadlineOnly, isNewsTopicReviewRequired } from '../../domain/news/scoring.js';
import { newsFlow } from '../../domain/market/story/page-flow.js';
import { renderNextSteps } from '../components/page-flow.js';
import { renderChannelData } from '../components/channel-data.js';
import { krIndexCloseNote } from '../../domain/news/kr-close-note.js';
import { leadLinkedNews, pickImportantNews, rollingNewsPool } from '../../domain/briefing/news-picks.js';
import { EARNINGS_CALENDAR, EVENT_BRIEFS, MARKET_DAY } from '../../data/artifact-registry.js';
import { getNewsSurfaceControls, resetNewsFeedFilter, setNewsFeedFilter } from '../components/news-controls.js';
import { applyFeedFilter, describeFeedRows, feedEntitiesOf, feedFacets, feedTiles, FEED_REGIONS, isFeedFiltered, tickerEntityKey, topicGroupFor, topicGroupLabel, topicGroupOf } from '../../domain/news/feed-filter.js';
import { articleFactReader } from '../../domain/news/article-facts.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { newsImpactChain } from '../../domain/briefing/event-guide.js';
import { fixKoreanTerms } from '../../domain/briefing/headline-terms.js';
import { renderMarketTimeline } from '../components/market-timeline.js';
import { symbolNames } from '../components/move-news.js';
import { macroReleasesFor } from '../../domain/briefing/macro-releases.js';
import { channelLineFor } from '../../domain/news/channel-lines.js';

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

// The article list follows the filter panel; the channel (Telegram) list below it is classified on its own and never
// follows it (내 종목 swaps it, which the page says separately). Both scopes are written out so a count is never read
// as covering the other list. A stray retired key (typeTab) is not a filter.
export function describeNewsScope(controls) {
  const active = !!controls && (['countryFilter', 'topicFilter', 'entityFilter'].some((key) => controls[key] && controls[key] !== 'all')
    || !!controls.figureOnly || !!controls.mineOnly || !!String(controls.query || '').trim());
  return { articles: active ? '필터 적용' : '필터 없음', channel: active ? '시장 신호는 국가·주제 필터와 무관하게 자체 분류로 표시됩니다.' : '' };
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
  // Once the news model has loaded, zero sources is a result, not a check still in progress.
  set('news-24h-sources', summary.sourceCount ? `${summary.sourceCount}개 출처` : (model ? '0개 출처' : '출처 확인 중'));
  // The keyword sentiment/risk strip left with P1391, so no news sentiment score is shown at all.
  let cut = null;
  try { cut = root?.AIO?.getSharedMarketCut?.() || null; } catch (_) {}
  const generatedAt = root?._serverDataMeta?.generatedAt || null;
  // v57.91 (wording audit): '10. 16. 오후 08:51' read unlike every other stamp on the screen — one M/D HH:MM form.
  const generatedStamp = generatedAt ? compactKstTime(generatedAt) : null;
  const generatedLabel = generatedStamp ? `${generatedStamp.date} ${generatedStamp.time}` : '';
  // The list is filtered to the 08:00 KST window of today, but the header named the
  // data revision's older cut ("기준시각 경과 · 10/04 08:00") beside 10/5 articles. The header now names
  // the window the list actually uses, and staleness is stated as the last collection time.
  const newsWindow = briefingWindowKST(Date.now());
  // One date format on the news screen (M/D HH:MM), the same as the cards and the intraday list.
  const fmt = (ms) => { const t = compactKstTime(new Date(ms).toISOString()); return t ? `${t.date} ${t.time}` : ''; };
  // When the published cycle is older than today's 08:00 window, the header names the cycle the
  // articles actually come from instead of the wall-clock window they do not fill.
  // X21: the list is filtered by the model's own window (the published cycle when it is admissible,
  // otherwise the latest completed 08:00 window). The header used the server cycle even when the model had fallen
  // back, so it named 10/11~10/12 above 10/12 23:00 articles. Name the window the list actually used.
  const modelStart = Date.parse(model?.newsCycle?.start || '');
  const modelEnd = Date.parse(model?.newsCycle?.end || '');
  const hasModelWindow = Number.isFinite(modelStart) && Number.isFinite(modelEnd) && modelEnd > modelStart;
  const cycleStart = hasModelWindow ? modelStart : Date.parse(root?._serverDataMeta?.newsCycleStart || '');
  const cycleEnd = hasModelWindow ? modelEnd : Date.parse(root?._serverDataMeta?.newsCycleEnd || '');
  const olderCycle = Number.isFinite(cycleEnd) && newsWindow.end != null && cycleEnd < newsWindow.end - 60000;
  if (olderCycle && Number.isFinite(cycleStart)) set('news-window-label', `직전 수집본, ${fmt(cycleStart)} ~ ${fmt(cycleEnd)} KST 기사 — 이번 ${fmt(newsWindow.end)} 수집본은 아직 없습니다`);
  else if (hasModelWindow) set('news-window-label', `${fmt(cycleStart)} ~ ${fmt(cycleEnd)} KST 기사`);
  else if (newsWindow.start != null) set('news-window-label', `${fmt(newsWindow.start)} ~ ${fmt(newsWindow.end)} KST 기사`);
  // A quarantined news lane is an earlier publish (scripts/lib/lane-quarantine.mjs); name that collection time.
  const heldNews = (root?._serverDataMeta?.laneQuarantine || []).find((lane) => lane?.lane === 'news');
  const heldStamp = heldNews?.previousGeneratedAt ? compactKstTime(heldNews.previousGeneratedAt) : null;
  if (heldNews) set('last-fetch-time', `뉴스 갱신 보류, 마지막 수집 ${heldStamp ? `${heldStamp.date} ${heldStamp.time}` : '확인 필요'}`);
  else set('last-fetch-time', cut?.status === 'stale' || status === 'stale'
    ? `수집 지연, 마지막 수집 ${generatedLabel || '확인 필요'}`
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
  // 개편 v2: the tone is a data attribute; its colour lives in v2-today.css (no inline style).
  if (isNewsAnalysisEligible(item)) return { label: '', tone: 'eligible' };
  return isNewsHeadlineOnly(item)
    ? { label: '본문 없음', tone: 'headline-only' }
    : { label: '검증 대기', tone: 'pending' };
}

function displayValue(root, functionName, item, fallback = '') {
  try {
    const fn = root?.[functionName];
    if (typeof fn === 'function') return fn(item) || fallback;
  } catch (_) {}
  return fallback;
}

// One formatting owner for the absolute publication time. The previous
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

// The 44px time column wrapped "2026. 10. 03. 14:20 GMT+9" over four lines.
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
  badge.title = `${direct ? '직접 당사자' : '기사에 언급된 관련 회사'}, ${symbol} 종목 분석`;
  badge.dataset.issuerRole = direct ? 'subject' : 'mentioned';
  badge.className = 'nws-ticker';
  return badge;
}

// A headline whose producer translation failed (titleKoFailed) shows the original with a short mark.
export function untranslatedMark(documentRef, item) {
  if (!item?.titleKoFailed || /[가-힣]/.test(item?.titleKo || '')) return null;
  const mark = documentRef.createElement('span');
  mark.className = 'news-item-untranslated';
  mark.textContent = '원문';
  mark.title = '한국어 번역에 실패해 원문 제목을 그대로 보여 줍니다';
  return mark;
}

// P1391: a headline-only item without a real translation used to get a generated sentence
// ("매크로 · Reuters 기사 · 중요도 48") as its title. Show the translated title or the original.
function realTitle(root, item) {
  // The producer's titleKo leads; an older session cache or ko_title is the fallback.
  let ko = /[가-힣]/.test(item?.titleKo || '') ? item.titleKo : '';
  if (!ko && !item?.titleKoFailed) {
    try {
      const cached = root?._translationCache?.get?.(root?._tcKey?.(item?.title));
      ko = (cached && !cached._failed && cached.ko_title) || item?.ko_title || '';
    } catch (_) { ko = item?.ko_title || ''; }
  }
  const original = typeof root?._aioTitleWithoutSource === 'function' ? root._aioTitleWithoutSource(item) : item?.title;
  const translated = /[가-힣]/.test(ko) && typeof root?._aioTitleWithoutSource === 'function' ? root._aioTitleWithoutSource(item, ko) : ko;
  const title = /[가-힣]/.test(ko) ? translated : (original || item?.headline || '제목 없음');
  const fixed = fixKoreanTerms(item?.title, title); // Shared glossary
  return typeof root?._aioStripPictographs === 'function' ? root._aioStripPictographs(fixed) : fixed; // P1500
}

// v58.74 (text audit 오늘 C6): a headline names a live scenario (the lead or the alternative) only when its topic feeds one of
// that scenario's axes; the old fixed topic → scenario names did not exist among the live branches. The model is
// computed once a minute, not per card.
// v58.75 (persona review): the topic alone named a scenario — every 거시 headline read "관련 시나리오 'AI 투자 꺾임'"
// because that branch shares the growth axis. The headline's own words decide (SCENARIO_TITLE_TERMS in
// src/domain/briefing/event-guide.js), and the card now carries the whole chain — axis → live branch → burdened and
// helped exposures → what to check — instead of the branch name alone ('고르는 법' E1).
// The topic only keeps a scenario off unrelated feeds, so the broad macro feed may reach the oil, rates and policy branches.
const TOPIC_AXES = Object.freeze({ macro: ['inflation', 'growth', 'commodities', 'rates', 'policy'], fxbond: ['rates', 'policy'], bond: ['rates', 'policy'], fx: ['rates', 'policy'], energy: ['commodities'], metals: ['commodities'], geo: ['commodities'], credit: ['credit'], semi: ['growth', 'credit'] });
let scenarioMemo = { at: 0, xr: null };
function liveScenarioFor(root, item, shownTitle = '') {
  const axes = TOPIC_AXES[item?.topic || item?.feedTopic];
  if (!axes) return null;
  const now = Date.now();
  // A model read before the close history loaded (no lead) is kept for 3 seconds, not a minute — the first paint
  // cached it and no card named a scenario until the minute passed.
  if (now - scenarioMemo.at > (scenarioMemo.xr?.leadId ? 60000 : 3000)) {
    let xr = null;
    try { xr = crossroadsForRoot(root, { nowMs: now }); } catch (_) { xr = null; }
    scenarioMemo = { at: now, xr };
  }
  return newsImpactChain(`${item?.title || ''} ${shownTitle || ''}`, scenarioMemo.xr, { axes });
}

// One reading of an article per render, shared by the filter rows and the card so a chip's count and the card it counts
// never disagree: the shown title, the original, the issuers (the same resolver the badges always used), the
// earnings-calendar line and the one extracted fact (article-facts.js).
function createArticleReader(root, factOf) {
  const memo = new Map();
  return (item) => {
    const key = newsArticleKey(item);
    if (memo.has(key)) return memo.get(key);
    // The free translator's known misreadings (earnings → 수익) are corrected against the shared glossary.
    const title = fixKoreanTerms(item?.title, displayValue(root, 'getDisplayTitle', item, '') || realTitle(root, item));
    const original = typeof root?._aioTitleWithoutSource === 'function' ? root._aioTitleWithoutSource(item) : String(item?.title || '');
    // Earnings headlines carry the structured estimate/actual line. It is resolved first so an earnings story is tagged
    // with the reporting company only — a mentioned analyst's firm (Morgan Stanley on a Nike story) is not its subject.
    let earnings = null;
    try {
      if (root?._aioEarningsSnapshot && typeof root._aioEarningsContext === 'function') earnings = root._aioEarningsContext(item?.title, { earnings: root._aioEarningsSnapshot.earnings, names: symbolNames(root) });
    } catch (_) { earnings = null; }
    const extracted = displayValue(root, 'getDisplayTickers', item, []);
    const tickers = earnings?.symbols?.length ? [...earnings.symbols] : earnings?.symbol ? [earnings.symbol] : extracted;
    // One badge per company — '$$삼성전자' and '$삼성전자' were the same symbol with a doubled marker.
    const entries = root?.AIO_TICKER_NAME_REGISTRY?.entries || {};
    const issuers = resolveNewsIssuers(item, tickers, entries);
    const names = Object.fromEntries(issuers.filter((symbol) => entries[symbol]?.kr).map((symbol) => [symbol, entries[symbol].kr]));
    const read = { title, original, issuers, names, earnings, fact: null };
    read.fact = typeof factOf === 'function' ? factOf(item, { issuers, earningsText: earnings?.text || '' }) : null;
    memo.set(key, read);
    return read;
  };
}

function factLine(documentRef, fact) {
  if (!fact?.text) return null;
  const line = documentRef.createElement('div');
  line.className = 'news-item-fact';
  line.dataset.factSource = fact.source || '';
  const tag = documentRef.createElement('span');
  tag.className = 'news-fact-kind';
  tag.dataset.kind = fact.kind;
  tag.textContent = fact.kind;
  const said = documentRef.createElement('span');
  said.className = 'news-fact-text';
  said.textContent = fact.text;
  line.append(tag, said);
  return line;
}

function createNewsCard(documentRef, root, item, index, readArticle) {
  const card = documentRef.createElement('div');
  const tone = articleStatus(item);
  const link = safeUrl(item?.link);
  const publishedIso = publicationIso(item);
  // The legacy hook is still preferred when a host actually provides it; otherwise the local
  // formatter supplies the absolute, timezone-aware timestamp instead of ''.
  const absTime = displayValue(root, 'getAbsoluteTime', item, '') || formatAbsoluteTime(publishedIso);
  const timeAgo = item?.pubDate ? displayValue(root, 'getTimeAgo', new Date(item.pubDate), '') : '';
  const read = (typeof readArticle === 'function' ? readArticle : createArticleReader(root, null))(item);
  const { title, earnings } = read;
  const summary = displayValue(root, 'getDisplaySummary', item, item?.summary || item?.desc || '');

  card.className = 'news-item-card';
  card.dataset.tone = tone.tone;
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
  // Keep the raw publication instant and its timezone representation on the node so
  // the absolute time survives independently of the display string and the original article link.
  if (publishedIso) {
    absolute.dataset.publishedAt = publishedIso;
    absolute.setAttribute('title', `발행 ${absTime || publishedIso} (한국 시간)`);
  }
  if (link) absolute.dataset.articleUrl = link;
  const dot = documentRef.createElement('span');
  dot.className = 'news-time-dot';
  dot.dataset.tone = tone.tone;
  timeColumn.append(absolute, dot);

  const body = documentRef.createElement('div');
  body.className = 'news-item-body';
  // The card reads top to bottom: topic and time, the headline (the original under a translated one), the one
  // extracted fact, then the companies and keywords it names.
  const meta = documentRef.createElement('div');
  meta.className = 'news-item-meta';
  // Developer markers (selection score, headline-only boundary, feed-review flag) are not
  // user content. LC-31 still holds — a feed-query topic is shown only as a plain label, never as a verified sector
  // assignment elsewhere. The label is the filter panel's topic group, so the chip and the card name it alike.
  const shownTopic = newsTopicOf(item, title);
  const topicLabel = topicGroupLabel(topicGroupOf(item, title));
  if (topicLabel) {
    const chip = documentRef.createElement('span');
    chip.className = 'sx-chip sx-chip--sm news-topic-chip';
    chip.textContent = topicLabel;
    // LC-31: a feed-query topic says how it was classified, on the chip's hover.
    if (isNewsTopicReviewRequired(item)) chip.title = `${shownTopic !== (item?.topic || item?.feedTopic) ? '제목 기준 분류' : '출처 기준 분류'}, 기사 본문으로 확인 전`;
    meta.append(chip);
  }
  // A rumour or anonymous-source headline is labelled where the reader sees it, not only scored down.
  const verificationLabel = item?.verification === 'unconfirmed' ? '미확인 보도(루머·익명 소식통)' : '';
  // The evidence kind (공시, 기업 발표…) and a correction or retraction are facts about the article, so they sit
  // on the meta line beside the time; '기사' is every row's kind and says nothing.
  const facts = newsEvidence(item);
  const metaText = [timeAgo, facts.kind === '기사' ? '' : facts.kind, facts.revision, verificationLabel].filter(Boolean).join(', ');
  if (metaText) meta.append(documentRef.createTextNode(metaText));
  const headlineOnly = isNewsHeadlineOnly(item);
  const stance = documentRef.createElement('span');
  stance.textContent = headlineOnly ? '' : tone.label;
  stance.className = 'nws-stance';
  stance.dataset.tone = tone.tone;
  meta.append(stance);
  body.appendChild(meta);
  const headline = documentRef.createElement('div');
  headline.className = 'news-item-headline';
  // A Cyrillic/CJK feed name is shown as '외신' instead of leaking untranslated.
  const rawSource = typeof root?._aioSafeSourceLabel === 'function' ? root._aioSafeSourceLabel(item?.source || '') : item?.source || '';
  const source = item?._tgChannel ? `TG, ${rawSource}` : rawSource;
  // LC-34: the headline is the link to the original (new tab, noopener); the card keeps its larger pointer target, and the
  // delegation ignores the anchor so the URL cannot open twice. The publisher, the original title and the full
  // publication time are the headline's hover (sources stay off the screen text, owner 2026-10-06); the per-card
  // '원문과 출처' fold that held them left.
  const hover = [source, item?.title && item.title !== title ? `원문 제목 ${item.title}` : '', absTime ? `발행 ${absTime}` : ''].filter(Boolean).join(', ');
  if (link) {
    const anchor = documentRef.createElement('a');
    anchor.className = 'news-item-link';
    anchor.href = link;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.textContent = title || '제목 없음';
    if (hover) anchor.title = hover;
    anchor.setAttribute('aria-label', `${title || '제목 없음'} — 원문 새 창에서 열기`);
    headline.appendChild(anchor);
  } else {
    const plain = text(documentRef, title, '제목 없음');
    if (hover) plain.title = hover;
    headline.appendChild(plain);
  }
  const untranslated = untranslatedMark(documentRef, item);
  if (untranslated) headline.appendChild(untranslated);
  body.appendChild(headline);
  // The original headline under a translated one, small; the same words twice are said once.
  const original = String(read.original || '').trim();
  if (original && /[가-힣]/.test(title || '') && original !== title && !/[가-힣]/.test(original)) {
    const originalNode = documentRef.createElement('div');
    originalNode.className = 'news-item-original';
    originalNode.lang = 'en';
    originalNode.textContent = original;
    body.appendChild(originalNode);
  }
  const fact = factLine(documentRef, read.fact);
  if (fact) {
    if (read.fact.source === 'earnings' && earnings?.source) fact.title = earnings.source;
    body.appendChild(fact);
  }
  // The entity tags: the resolved companies as ticker badges (they open the company), then the keywords as plain tags.
  // Registry topic keys (GE_VRN, TSLA_AUTOPILOT) are not symbols and never become a badge (feedEntitiesOf).
  const entities = feedEntitiesOf(item, read);
  const badges = entities.filter((entity) => entity.kind === 'ticker').slice(0, 4);
  const words = entities.filter((entity) => entity.kind === 'keyword').slice(0, 3);
  if (badges.length || words.length) {
    const row = documentRef.createElement('div');
    row.className = 'news-item-tickers';
    badges.forEach((entity, at) => {
      if (at) row.appendChild(documentRef.createTextNode(' '));
      const symbol = entity.key.slice(2);
      row.appendChild(createTickerBadge(documentRef, `$${symbol}`, symbol === String(item?.issuerSymbol || '').toUpperCase()));
    });
    for (const entity of words) {
      if (row.childNodes.length) row.appendChild(documentRef.createTextNode(' '));
      row.appendChild(Object.assign(documentRef.createElement('span'), { className: 'news-entity-tag', textContent: entity.label }));
    }
    body.appendChild(row);
  }
  // LC-32: a headline-only card has no article body, so no causal summary is shown (P1391: and no
  // boundary sentence either — the absence is the boundary).
  if (summary && !headlineOnly) {
    const summaryNode = documentRef.createElement('div');
    summaryNode.className = 'news-item-summary';
    summaryNode.textContent = summary;
    body.appendChild(summaryNode);
  }
  // An intraday KOSPI/KOSDAQ crash or surge headline carries the session's close when the close reversed it.
  const closeNote = krIndexCloseNote(item, root?._aioHistory || []);
  if (closeNote) {
    const closeNode = documentRef.createElement('div');
    closeNode.className = 'news-item-summary';
    closeNode.textContent = closeNote;
    body.appendChild(closeNode);
  }
  // The face is never folded: the scenario chain — axis → branch → burdened/helped exposures →
  // what to check — is one line on the face; how the link is made is its hover.
  const chain = liveScenarioFor(root, item, title);
  const chainNote = '헤드라인의 주제가 지금 선두·대안 시나리오가 보는 축과 맞을 때만 잇고, 영향은 시나리오의 노출 분류이며 예측이 아닙니다.';
  if (chain) {
    const chainNode = documentRef.createElement('div');
    chainNode.className = 'news-item-chain';
    chainNode.textContent = `시나리오 연결, ${chain.text}.`;
    chainNode.title = chainNote;
    body.appendChild(chainNode);
  }
  // A story with earlier versions keeps them as its one fold, a sources list (the originals in publication order).
  if (item?.storyArticles?.length > 1) {
    const evidence = documentRef.createElement('details');
    evidence.className = 'news-evidence';
    evidence.dataset.foldKind = 'sources';
    evidence.addEventListener('click', (event) => event.stopPropagation());
    const evidenceTitle = documentRef.createElement('summary');
    evidenceTitle.textContent = `변경 이력 ${item.storyArticles.length}건`;
    evidenceTitle.title = item.storySelection || '';
    // Each fold names its headline to a screen reader.
    evidenceTitle.setAttribute('aria-label', `${evidenceTitle.textContent} — ${String(title || '').slice(0, 80)}`);
    evidence.appendChild(evidenceTitle);
    const timeline = documentRef.createElement('ol');
    for (const article of item.storyArticles) {
      const row = documentRef.createElement('li');
      const articleFacts = newsEvidence(article);
      const articleUrl = safeUrl(article?.link || article?.url);
      const label = `${formatAbsoluteTime(articleFacts.publishedAt) || '발행 시각 미제공'}, ${articleFacts.revision || articleFacts.kind}, ${realTitle(root, article)}`;
      if (articleUrl) {
        const anchor = documentRef.createElement('a');
        anchor.href = articleUrl; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = label;
        // same-cycle carry made multi-article stories common; a 15px inline link failed the 24px target rule on ipad820.
        anchor.classList.add('aio-inline-target'); // --touch-min, src/ui/styles/layout-primitives.css
        row.appendChild(anchor);
      } else row.textContent = label;
      timeline.appendChild(row);
    }
    evidence.appendChild(timeline);
    body.appendChild(evidence);
  }

  card.append(timeColumn, body);
  return card;
}

const newsKey = (item) => newsArticleKey(item);
// The entity chip a 재무 공시 hand-off pressed, so a later plain visit can release it without touching the reader's own.
let handoffEntity = null;

function narrowModel(model, test) {
  const keep = (list) => (Array.isArray(list) ? list.filter(test) : list);
  const eligibleItems = keep(model.eligibleItems);
  const eligibleCount = Array.isArray(eligibleItems) ? eligibleItems.length : model.eligibleCount;
  return { ...model, items: keep(model.items), eligibleItems, eligibleCount, ...(eligibleCount === 0 ? { emptyReason: 'filters-removed-all-eligible-news' } : {}) };
}

// v58.75 (persona review): '내 종목' narrows the articles to stories about a watched or held company (the same issuer
// resolver as the badges) and swaps the channel feed for the channel posts whose extracted tickers name one. With no
// watched or held company the toggle is disabled and says why.
function myNewsSymbols(root, store) {
  const watched = displayValue(root, '_aioWatchlistGet', undefined, []);
  const holdings = store?.getState?.()?.portfolio?.holdings;
  return new Set([...(Array.isArray(watched) ? watched : []), ...(Array.isArray(holdings) ? holdings.map((row) => row?.symbol || row?.sym) : [])]
    .map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean));
}

// The panel's choices as the pure filter reads them (feed-filter.js); 내 종목 with no watched or held name is off.
function feedFilterOf(controls, mine) {
  return { region: controls.countryFilter, topic: controls.topicFilter, entity: controls.entityFilter, figure: controls.figureOnly, mine: controls.mineOnly && mine.size > 0, query: controls.query };
}
const FILTER_FIELDS = Object.freeze({ region: 'countryFilter', topic: 'topicFilter', entity: 'entityFilter' });

// Chips are kept by value across renders, so the chip a reader just pressed keeps focus while its count changes.
function syncChips(documentRef, row, chips, field) {
  if (!row) return;
  const existing = new Map([...row.children].map((node) => [node.dataset.feedValue, node]));
  const active = documentRef.activeElement;
  const next = chips.map((chip) => {
    let node = existing.get(chip.key);
    if (!node) {
      node = documentRef.createElement('button');
      node.type = 'button';
      node.className = 'news-feed-chip';
      node.dataset.feedField = field;
      node.dataset.feedValue = chip.key;
    }
    paintChip(documentRef, node, chip);
    return node;
  });
  if (next.length !== row.children.length || next.some((node, at) => row.children[at] !== node)) row.replaceChildren(...next);
  if (active && next.includes(active) && documentRef.activeElement !== active) active.focus?.({ preventScroll: true });
}
function paintChip(documentRef, node, chip) {
  node.setAttribute('aria-pressed', String(!!chip.pressed));
  if (chip.kind) node.dataset.kind = chip.kind;
  const parts = [];
  if (chip.kind) parts.push(Object.assign(documentRef.createElement('span'), { className: 'news-feed-chip-dot' }));
  parts.push(documentRef.createTextNode(chip.label));
  parts.push(Object.assign(documentRef.createElement('span'), { className: 'news-feed-chip-count', textContent: String(chip.count) }));
  node.replaceChildren(...parts);
  node.setAttribute('aria-label', `${chip.label} ${chip.count}건`);
}

// A chip row that would wrap past three lines on a phone scrolls sideways instead (data-overflow, v2-today.css).
function fitChipRows(documentRef, rows) {
  const narrow = !!documentRef?.defaultView?.matchMedia?.('(max-width: 479px)')?.matches;
  for (const row of rows) {
    if (!row) continue;
    delete row.dataset.overflow;
    const first = row.firstElementChild;
    const last = row.lastElementChild;
    if (!narrow || !first || first === last) continue;
    if (last.offsetTop - first.offsetTop > first.offsetHeight * 2.5) row.dataset.overflow = 'scroll';
  }
}

function renderFeedPanel(documentRef, { facets, tiles, controls, mine }) {
  const tileBox = documentRef?.getElementById('news-feed-tiles');
  if (tileBox) {
    const tile = (label, value, note = '') => {
      const box = documentRef.createElement('div');
      box.className = 'sx-tile news-feed-tile';
      const valueNode = Object.assign(documentRef.createElement('b'), { className: 'news-feed-tile-value', textContent: value });
      if (note) valueNode.append(Object.assign(documentRef.createElement('span'), { className: 'news-feed-tile-note', textContent: note }));
      box.append(Object.assign(documentRef.createElement('span'), { className: 'sx-kicker', textContent: label }), valueNode);
      return box;
    };
    tileBox.replaceChildren(tile('기사', String(tiles.articles)), tile('사실 추출', String(tiles.withFact), ` / ${tiles.articles}`), tile('수치', String(tiles.withFigure)));
  }
  const rows = ['region', 'topic', 'entity'].map((name) => documentRef?.getElementById(`news-filter-${name}`));
  rows.forEach((row, at) => syncChips(documentRef, row, facets[['region', 'topic', 'entity'][at]], FILTER_FIELDS[['region', 'topic', 'entity'][at]]));
  const toggles = documentRef?.getElementById('news-filter-toggles');
  if (toggles) {
    const mineTitle = mine.size ? `관심·보유 ${mine.size}개(${[...mine].slice(0, 5).join(', ')}${mine.size > 5 ? ' 등' : ''}) 관련 기사와 채널 글만 보기` : '관심·보유 종목이 없어 쓸 수 없습니다. 스크리너에서 관심 종목을 추가하면 켜집니다.';
    syncChips(documentRef, toggles, [
      { key: 'figure', label: '수치 있음', count: facets.figure.count, pressed: facets.figure.pressed },
      { key: 'mine', label: '내 종목', count: facets.mine.count, pressed: facets.mine.pressed && mine.size > 0 }
    ], 'toggle');
    const mineChip = toggles.querySelector('[data-feed-value="mine"]');
    if (mineChip) {
      mineChip.setAttribute('aria-disabled', String(!mine.size));
      mineChip.title = mineTitle;
    }
  }
  const query = documentRef?.getElementById('news-filter-query');
  if (query && documentRef.activeElement !== query && query.value !== controls.query) query.value = controls.query;
  const sort = documentRef?.getElementById('news-filter-sort');
  if (sort && sort.value !== controls.sortMode) sort.value = controls.sortMode;
  fitChipRows(documentRef, [...rows, toggles]);
}

// The panel's controls are static in index.html; one delegated listener set per mount, released with the page.
function bindFeedPanel(documentRef, root) {
  const panel = documentRef?.getElementById('news-feed-panel');
  if (!panel) return () => {};
  const repaint = () => documentRef.dispatchEvent?.(new CustomEvent('aio:newsSurfaceInvalidated', { detail: { reason: 'news-feed-filter' } }));
  const onClick = (event) => {
    const chip = event.target?.closest?.('button[data-feed-field]');
    if (!chip || !panel.contains(chip)) return;
    // first-users run-3 N#23: a disabled chip gave no reason on touch (a title never shows); a tap now says what to do.
    if (chip.getAttribute('aria-disabled') === 'true') { root?.showToast?.(chip.title); return; }
    const controls = getNewsSurfaceControls();
    const { feedField: field, feedValue: value } = chip.dataset;
    if (field === 'toggle') setNewsFeedFilter(value === 'figure' ? { figureOnly: !controls.figureOnly } : { mineOnly: !controls.mineOnly });
    else if (Object.values(FILTER_FIELDS).includes(field)) setNewsFeedFilter({ [field]: value === 'all' || controls[field] === value ? 'all' : value });
    else return;
    repaint();
  };
  const query = documentRef.getElementById('news-filter-query');
  let timer = null;
  const onQuery = (event) => {
    root?.clearTimeout?.(timer);
    const apply = () => { setNewsFeedFilter({ query: String(query.value || '').slice(0, 80) }); repaint(); };
    if (event.type === 'search') apply(); else timer = root?.setTimeout ? root.setTimeout(apply, 250) : apply();
  };
  const sort = documentRef.getElementById('news-filter-sort');
  const onSort = () => { setNewsFeedFilter({ sortMode: sort.value === 'score' ? 'score' : 'time' }); repaint(); };
  const media = documentRef.defaultView?.matchMedia?.('(max-width: 479px)');
  const onMedia = () => fitChipRows(documentRef, ['region', 'topic', 'entity', 'toggles'].map((name) => documentRef.getElementById(`news-filter-${name}`)));
  panel.addEventListener('click', onClick);
  query?.addEventListener('input', onQuery);
  query?.addEventListener('search', onQuery);
  sort?.addEventListener('change', onSort);
  media?.addEventListener?.('change', onMedia);
  return () => {
    root?.clearTimeout?.(timer);
    panel.removeEventListener('click', onClick);
    query?.removeEventListener('input', onQuery);
    query?.removeEventListener('search', onQuery);
    sort?.removeEventListener('change', onSort);
    media?.removeEventListener?.('change', onMedia);
  };
}
function renderMineChannelPosts(documentRef, card, root, symbols, active) {
  const feed = documentRef?.getElementById('tg-feed-market-news');
  let box = documentRef?.getElementById('news-tg-mine');
  if (!active) { if (box) box.hidden = true; if (feed) feed.hidden = false; return; }
  if (!card) return;
  if (!box) {
    box = documentRef.createElement('div');
    box.id = 'news-tg-mine';
    card.append(box);
  }
  // A post shows as the fact extracted from it about my name (channel-lines.js), never its text.
  const signals = Array.isArray(root?.AIO_TELEGRAM_SIGNALS) ? root.AIO_TELEGRAM_SIGNALS : [];
  const posts = (Array.isArray(root?.AIO_TELEGRAM_CURRENT_ITEMS) ? root.AIO_TELEGRAM_CURRENT_ITEMS : [])
    .map((post) => {
      const symbol = (Array.isArray(post?.tickers) ? post.tickers : []).map((tag) => String(tag).replace(/^\$/, '').toUpperCase()).find((sym) => symbols.has(sym) && channelLineFor(sym, post, signals));
      return { post, symbol, line: symbol ? channelLineFor(symbol, post, signals) : null };
    })
    .filter((row) => row.line).sort((a, b) => Date.parse(b.post.datetime || '') - Date.parse(a.post.datetime || '')).slice(0, 8);
  if (feed) feed.hidden = true;
  box.hidden = false;
  if (!posts.length) { box.replaceChildren(Object.assign(documentRef.createElement('p'), { className: 'briefing-empty', textContent: '최근 24시간 내 종목에 대한 목표주가·실적 신호가 없습니다.' })); return; }
  const list = documentRef.createElement('ul');
  list.className = 'news-intraday-list';
  for (const { post, line } of posts) {
    const row = documentRef.createElement('li');
    const stamp = compactKstTime(post.datetime);
    const time = documentRef.createElement('time');
    time.textContent = stamp ? `${stamp.date} ${stamp.time}` : '';
    const href = safeUrl(post.url);
    const title = documentRef.createElement(href ? 'a' : 'span');
    title.className = 'nws-intraday-link';
    title.textContent = line;
    if (href) { title.href = href; title.target = '_blank'; title.rel = 'noopener noreferrer'; }
    title.title = `텔레그램 공개 채널 @${post.channel || ''}`;
    row.append(time, title);
    list.append(row);
  }
  box.replaceChildren(list);
}
// The scored articles published after the 08:00 cut: they join the 중요 뉴스 pool (rollingNewsPool), and the ones it
// does not pick stay in this provisional list.
const laterNews = (root, canonicalItems, nowMs) => selectIntradayNews(root?._serverNewsIntraday, { cycleEndMs: Date.parse(root?._serverDataMeta?.newsCycleEnd || ''), canonical: canonicalItems, nowMs });
function renderIntradayNews(documentRef, root, later, important = new Set(), nowMs = Date.now()) {
  const anchor = documentRef?.getElementById('news-important');
  let section = documentRef?.getElementById('news-intraday');
  const cycleEndMs = Date.parse(root?._serverDataMeta?.newsCycleEnd || '');
  const picked = later.filter((item) => !important.has(newsKey(item)));
  if (!picked.length || !anchor) {
    if (section) section.hidden = true;
    return [];
  }
  if (!section) {
    section = documentRef.createElement('section');
    section.id = 'news-intraday';
    section.className = 'aio-section briefing-block sx-card news-card news-intraday-card';
    section.setAttribute('aria-labelledby', 'news-intraday-title');
    anchor.after(section);
  }
  const kst = (ms) => compactKstTime(new Date(ms).toISOString());
  const end = kst(cycleEndMs);
  const today = kst(nowMs)?.date;
  const heading = documentRef.createElement('h2');
  heading.className = 'briefing-h2';
  heading.id = 'news-intraday-title';
  heading.append('08:00 이후 속보, 잠정 ');
  const note = documentRef.createElement('span');
  note.className = 'briefing-h2-note';
  note.textContent = `${end ? `${end.date} ${end.time}` : '08:00'} 이후`;
  note.title = '다음 08:00 수집본 전까지의 헤드라인'; note.classList.add('aio-asof'); // Chip
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
    // The intraday headlines read in Korean like the cards (same display/translation path).
    titleNode.textContent = `${item.verification === 'unconfirmed' ? '[미확인] ' : ''}${fixKoreanTerms(item.title, displayValue(root, 'getDisplayTitle', item, '') || realTitle(root, item)) || String(item.title || '')}`;
    if (href) { titleNode.href = href; titleNode.target = '_blank'; titleNode.rel = 'noopener noreferrer'; }
    // A 12px/1.5 link was an 18-21px target; padding keeps every headline link at least 24px tall.
    // The browser-default link blue measured 1.94:1 in dark; the text colour token passes in both themes.
    titleNode.className = 'nws-intraday-link'; // src/ui/styles/news-page.css
    // Sources stay off the screen text: publisher and full time live in the hover.
    titleNode.title = [item.source, formatAbsoluteTime(item.publishedMs ? new Date(item.publishedMs) : null)].filter(Boolean).join(', ');
    row.append(time, titleNode);
    const untranslatedRow = untranslatedMark(documentRef, item);
    if (untranslatedRow) row.append(untranslatedRow);
    list.appendChild(row);
  });
  section.replaceChildren(heading, list);
  section.hidden = false;
  return picked;
}

function appendMarketNews(documentRef, root, container, model, status, visibleLimit, controls, exclude = new Set(), readArticle = null) {
  const eligible = groupNewsStories(Array.isArray(model?.eligibleItems) ? model.eligibleItems : model?.items || []).filter((item) => !exclude.has(newsKey(item)));
  const displayed = eligible.slice(0, visibleLimit);
  container.replaceChildren();
  if (!displayed.length) {
    const empty = documentRef.createElement('div');
    empty.className = 'nws-empty';
    // 창 밖에 남은 과거 수집분을 오늘 뉴스로 읽히게 두지 않는다.
    // LC-32: 분류가 피드 query에서 복사된 경우, 0건은 '해당 주제 뉴스가 없다'가 아니라
    // '이 필터가 피드 분류를 기준으로 걸러낸 결과'임을 함께 밝힌다.
    const reviewFlagged = eligible.filter(isNewsTopicReviewRequired).length;
    const outOfWindow = Number(model?.outOfWindowCount || 0);
    empty.textContent = status === 'unavailable'
      ? '뉴스 수신 대기 — 새로고침 후 검증된 뉴스가 표시됩니다.'
      : (model?.emptyReason === 'all-news-outside-time-window' && outOfWindow > 0
          ? `이 조건의 오늘 뉴스(08:00 KST까지 24시간)가 아직 없습니다, 이전 뉴스 ${outOfWindow}건은 기간 밖입니다.`
          : `현재 조건에서 08:00 KST까지 24시간, 중요도 기준 뉴스가 없습니다. ${describeNewsEmptyReason(model?.emptyReason)}${outOfWindow > 0 ? ` (수집 제외 항목 제외 후, 창 밖 이전 수집분 ${outOfWindow}건 제외)` : ''}${reviewFlagged > 0 ? `, 피드 분류로만 걸러진 항목 ${reviewFlagged}건은 기사별 검토가 필요합니다.` : ''}`);
    container.appendChild(empty);
    if (describeNewsScope(controls).articles === '필터 적용') {
      const reset = documentRef.createElement('button');
      reset.type = 'button'; reset.textContent = '필터 초기화';
      reset.addEventListener('click', () => {
        resetNewsFeedFilter();
        documentRef.dispatchEvent?.(new CustomEvent('aio:newsSurfaceInvalidated', { detail: { reason: 'news-feed-filter' } }));
      });
      empty.append(documentRef.createElement('br'), reset);
    }
  } else {
    // The 카테고리별 grouped view left with the type tabs — each card already names its topic, and the topic
    // chips narrow the list to one group.
    displayed.forEach((item, index) => container.appendChild(createNewsCard(documentRef, root, item, index, readArticle)));
  }

  const count = documentRef.getElementById('market-news-count');
  if (count) { count.setAttribute('role', 'status'); count.setAttribute('aria-live', 'polite'); count.textContent = `중요 사건 ${exclude.size}건, 그 밖의 사건 ${eligible.length}건${describeNewsScope(controls).articles === '필터 적용' ? ', 필터 적용' : ''}`; count.title = `조건에 맞는 기사 ${model?.eligibleCount || 0}건을 같은 사건끼리 묶은 수`; } // One status line; the shown/total split stays beside 더 보기
  const summary = documentRef.getElementById('news-visible-summary');
  if (summary) summary.textContent = `기사 ${model?.eligibleCount || 0}건, 아래 사건 ${eligible.length}건 중 ${displayed.length}건 표시`;
  const more = documentRef.getElementById('news-load-more-wrap');
  if (more) {
    // "더 보기"는 렌더 가능한 풀(model.items, maxItems 계약)을 기준으로 숨긴다 —
    // eligibleCount(전체 창 개수)는 계약 캡보다 클 수 있어, 모든 기사를 표시한 뒤에도 버튼이
    // 남아 클릭해도 아무것도 추가되지 않는 결함이 나왔다. 남은 이유는 요약이 말한다.
    const poolSize = eligible.length;
    more.hidden = displayed.length >= poolSize;
    // Name what 'more' does and where the list ends, in reader terms.
    const moreButton = more.querySelector('[data-action="_aioNewsLoadMore"]');
    if (moreButton) moreButton.textContent = `${Math.min(12, Math.max(0, poolSize - displayed.length))}개 더 보기`;
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
    renderBriefingRead({ documentRef, root, store });
    // The last 24 hours as linked stories (a lazy chunk; market-day.json loads on first use).
    import('../components/briefing-day.js').then(({ renderBriefingDay }) => renderBriefingDay({ documentRef, root })).catch(() => {});
    // T18: the title date is the US close the read is based on, not the KST calendar day.
    root?._aioRenderBriefingDateLine?.(undefined, closeBasis(root?._aioHistory || []));
    return;
  }
  if (route !== 'market-news') return;

  const controls = getNewsSurfaceControls();
  const mine = myNewsSymbols(root, store);
  const filter = feedFilterOf(controls, mine);
  const mineOnly = filter.mine;
  const container = documentRef?.getElementById('live-news-feed');
  if (!container) return;
  const nowMs = Date.now();
  // The panel cuts one unfiltered window: the model is built with every chip at 전체 and the panel's choices are applied
  // to its rows (feed-filter.js), so each chip can count what pressing it would show.
  const build = (sortMode) => root?.AIO?.buildNewsSurfaceModel?.('market-news', items, { countryFilter: 'all', topicFilter: 'all', typeTab: 'all', sortMode, nowMs }) || null;
  const baseModel = build(controls.sortMode) || { items: [], eligibleItems: [], eligibleCount: 0, emptyReason: 'native-model-unavailable' };
  const day = root?.[MARKET_DAY.key] || null;
  const briefs = root?.[EVENT_BRIEFS.key] || null;
  // A direct visit to 뉴스 had no ledger unless another screen had loaded it, so neither the lead-move order nor the
  // fact lines showed; the page asks for the ledger and the release briefs and repaints once they arrive.
  const repaintWhenReady = (descriptor, reason) => refreshSharedArtifact(root, descriptor).then(({ changed }) => { if (changed) documentRef?.dispatchEvent?.(new CustomEvent('aio:newsSurfaceInvalidated', { detail: { reason } })); }).catch(() => {});
  if (root && !day) repaintWhenReady(MARKET_DAY, 'news-market-day-ready');
  if (root && !briefs) repaintWhenReady(EVENT_BRIEFS, 'news-briefs-ready');
  // One reading per article for this render: the rows the chips count and the cards read the same issuers and fact.
  const readArticle = createArticleReader(root, articleFactReader({ day, briefs, calendar: root?.[EARNINGS_CALENDAR.key] || null, nowMs }));
  const rows = describeFeedRows(baseModel.eligibleItems || baseModel.items || [], { read: readArticle, mine, keyOf: newsKey });
  const shownKeys = new Set(applyFeedFilter(rows, filter).map((row) => row.key));
  const filtered = isFeedFiltered(filter);
  const narrow = (model) => (filtered && model ? narrowModel(model, (item) => shownKeys.has(newsKey(item))) : model);
  const model = narrow(baseModel);
  renderFeedPanel(documentRef, { facets: feedFacets(rows, filter), tiles: feedTiles(rows.filter((row) => shownKeys.has(row.key))), controls: { ...controls, query: controls.query || '' }, mine });
  const configuredLimit = Number(root?._aioNewsVisibleLimit);
  const visibleLimit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? configuredLimit : 12;
  // The 데이터 출처 fold counts the collection, not the reader's cut of it.
  renderNewsSummary(documentRef, root, baseModel, selectNewsStatus(state));
  // After the Korean close (15:30 KST) until the next 08:00 bundle, the header says where the session's articles are.
  const importantModel = narrow(build('score'));
  const later = laterNews(root, items, nowMs);
  // Importance rolls to the newest article and puts the stories the day's lead moves are
  // tied to first (the same pool and pick as 오늘's 주요 뉴스). A filtered view keeps to the articles the panel counted.
  const pool = rollingNewsPool(importantModel?.eligibleItems || importantModel?.items || [], filtered ? [] : later);
  const important = pickImportantNews(groupNewsStories(pool), 5, { linked: day ? leadLinkedNews(day) : null });
  const importantKeys = new Set(important.flatMap((story) => (story.storyArticles || [story]).map(newsKey)));
  // The pool's own end: the newest article it ranked over, not the 08:00 cut.
  const importantNote = documentRef?.querySelector('#news-important-title .briefing-h2-note');
  const poolEnd = compactKstTime(new Date(Math.max(0, ...pool.map((row) => Date.parse(row.pubDate || row.publishedAt || '')).filter(Number.isFinite))).toISOString());
  if (importantNote && important.length && poolEnd) Object.assign(importantNote, { textContent: `최근 24시간, ${poolEnd.date} ${poolEnd.time}까지`, title: '주제별 핵심, 가장 새 기사까지 24시간' });
  const intraday = renderIntradayNews(documentRef, root, later, importantKeys, nowMs);
  const intradayCount = intraday.length;
  const kstMinutes = ((new Date(nowMs).getUTCHours() + 9) % 24) * 60 + new Date(nowMs).getUTCMinutes();
  const windowLabel = documentRef?.getElementById('news-window-label');
  if (intradayCount && windowLabel && (kstMinutes >= 15 * 60 + 30 || kstMinutes < 8 * 60)) {
    windowLabel.title = '한국장 시간대 기사는 속보 칸에, 정식 묶음은 다음 08:00 수집본'; // The window stays, the routing rule is its hover
  }
  // v59.44 (owner 2026-10-30, "each screen too"): the release summaries in the same tiers as 오늘 (a lazy chunk), with the
  // monthly releases of the last week, ahead of 중요 뉴스 — what came out and why the price moved, then the coverage.
  import('../components/event-briefs.js').then(({ paintNewsBriefs }) => {
    const repaint = () => { if (documentRef.getElementById('page-market-news')?.classList?.contains('active')) paintNewsBriefs(documentRef, root, null, macroReleasesFor(root, { days: 7 })); };
    paintNewsBriefs(documentRef, root, repaint, macroReleasesFor(root, { days: 7 }));
  }).catch(() => {});
  const tgScope = documentRef?.getElementById('news-tg-scope');
  if (tgScope) tgScope.textContent = mineOnly ? '내 종목 필터: 채널 글 중 관심·보유 종목을 다룬 글만 표시합니다.' : describeNewsScope(controls).channel;
  renderChannelData(documentRef, documentRef?.getElementById('news-tg-card'), root?.AIO_TELEGRAM_SIGNALS); // v58.71
  renderMineChannelPosts(documentRef, documentRef?.getElementById('news-tg-card'), root, mine, mineOnly);
  const importantList = documentRef?.getElementById('news-important-list');
  if (importantList) {
    importantList.replaceChildren(...(important.length
      ? important.map((item, index) => createNewsCard(documentRef, root, item, index, readArticle))
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
  appendMarketNews(documentRef, root, container, model, selectNewsStatus(state), visibleLimit, controls, new Set(important.map(newsKey)), readArticle);
  renderMarketTimeline({ documentRef, root, nowMs }); // The six-hour slots moved here from 브리핑 (a closed fold)
  renderNextSteps(documentRef, documentRef.getElementById('news-next'), newsFlow({ countryFilter: controls.countryFilter }).next); // v57.77
  container.dataset.aioNewsRenderer = 'native';
}

export function createNewsPage({ root = globalThis, documentRef, store, route = 'market-news' } = {}) {
  return {
    route,
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById(`page-${route}`);
      // Incoming data stays pending while the reader is on this screen.
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
        const controls = JSON.stringify([getNewsSurfaceControls(), root?._aioNewsVisibleLimit]);
        const changed = renderedKeys && (keys.size !== renderedKeys.size || [...keys].some((key) => !renderedKeys.has(key)));
        const explicit = force === true || (force?.type === 'aio:newsSurfaceInvalidated' && ['news-sort', 'news-load-more', 'news-country-telegram', 'news-country-filter', 'news-topic-filter', 'news-feed-filter'].includes(force?.detail?.reason)) || controls !== renderedControls;
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
        heading: route === 'briefing' ? '브리핑, 시장 확인·거시 시차·이벤트 전후' : '시장 뉴스, 이벤트 전후 가격 반응'
      }) : null;
      if (suppliedMaterialBridge) {
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge.remove());
      }
      // A ticker handed over from 재무 공시 opens the feed with that company's entity chip pressed; a later plain visit
      // releases a chip a hand-off pressed, while the reader's own choices last for the session.
      // P1730 (R2 next-step links): a link that names a topic or country opens the list with that chip pressed.
      if (route === 'market-news') {
        bag.add(bindFeedPanel(documentRef, root));
        const handoffContext = consumeResearchHandoff({ root, routeId: 'market-news' })?.context || {};
        const focus = String(handoffContext.ticker || '').trim().toUpperCase();
        if (/^[A-Z0-9][A-Z0-9.^=-]{0,11}$/.test(focus)) {
          handoffEntity = tickerEntityKey(focus);
          setNewsFeedFilter({ entityFilter: handoffEntity });
        } else if (handoffEntity && getNewsSurfaceControls().entityFilter === handoffEntity) {
          setNewsFeedFilter({ entityFilter: 'all' });
          handoffEntity = null;
        }
        const topic = topicGroupFor(handoffContext.topic);
        const country = String(handoffContext.country || '').trim().toLowerCase();
        if (topic) setNewsFeedFilter({ topicFilter: topic });
        if (FEED_REGIONS.some((region) => region.key === country)) setNewsFeedFilter({ countryFilter: country });
      }
      // A render that throws during mount releases what this page already attached; the
      // router disposes only its own scope.
      try { renderNow(); } catch (error) { bag.dispose(); throw error; }
      const unsubscribe = store && subscribeToSlices(store, route === 'briefing' ? ['news', 'analysis', 'marketSnapshot'] : ['news'], renderNow);
      if (unsubscribe) bag.add(unsubscribe);
      const eventTarget = documentRef || root;
      // The news cards read the close history too (krIndexCloseNote), so both routes redraw when it loads.
      ['aio:newsUpdated', 'aio:newsSurfaceInvalidated', 'aio:refresh:done', 'aio:serverDataLoaded', 'aio:historyLoaded',
        ...(route === 'briefing' ? ['aio:sentimentUpdated', 'aio:liveQuotes', 'aio:marketSnapshot'] : [])].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, renderNow);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, renderNow));
      });
      // The refresh scheduler announces on window; the document registration above stays.
      if (typeof root?.addEventListener === 'function' && root !== eventTarget) {
        root.addEventListener('aio:refresh:done', renderNow);
        bag.add(() => root.removeEventListener?.('aio:refresh:done', renderNow));
      }
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
