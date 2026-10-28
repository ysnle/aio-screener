// v59.42 (roadmap 11): the news scoring and selection entry points. The models moved out of js/aio-data.js into
// src/domain/news/selection.js; this file binds them to what the classic shell provides (extractTickers,
// getDisplayTickers/getDisplayTitle, the KST 08:00 window, the shared market cut, the news cache) and keeps the old
// window names for their remaining callers. newsCache, lastFetchTime and the display helpers stay declared in the classic
// scripts; a module resolves those names in the shared global scope at call time.
// src/app/compatibility-globals.js installs this before DOMContentLoaded.
import {
  scoreItem, classifyTopic, newsTextSentiment, calcNewsImpactVector, buildNewsSurfaceModel, newsSelectionAudit,
  normalizeNewsItem, newsDedupeKey, NEWS_SURFACE_CONTRACTS
} from '../domain/news/selection.js';
import { MACRO_KW, TECH_KW } from '../domain/news/selection-keywords.js';
import { briefingWindowKST } from '../domain/news/scoring.js';

const DAY_MS = 24 * 3600000;

// The briefing cycle in the legacy _getBriefingWindowKST shape (Date anchors + policy label) for its remaining callers.
function briefingWindowLegacyShape(now = Date.now()) {
  const { start, end } = briefingWindowKST(now);
  return {
    start,
    end,
    nextRefresh: new Date(end + DAY_MS),
    anchorDate: new Date(start),
    endAnchorDate: new Date(end),
    policy: 'kst-0800-completed-24h'
  };
}

export function installNewsSelection(window = globalThis) {
  window.AIO = window.AIO || {};
  window._getBriefingWindowKST = () => briefingWindowLegacyShape(Date.now());
  const cache = typeof window._aioLRU === 'function' ? window._aioLRU('scoreItem', 4000) : null; // v49.0 P182: no re-scoring of the same article
  const env = {
    cache,
    extractTickers: (item) => window.extractTickers(item),
    displayTickers: (item) => window.getDisplayTickers(item),
    displayTitle: (item) => window.getDisplayTitle(item),
    get stories() { return window._aioNewsStories || null; },
    controls: () => { const get = window.AIO && window.AIO.getNewsSurfaceControls; return (typeof get === 'function' && get()) || {}; },
    serverMeta: () => window._serverDataMeta || {},
    sharedCut: () => {
      try { return window.AIO && typeof window.AIO.getSharedMarketCut === 'function' ? window.AIO.getSharedMarketCut() : null; } catch (_) { return null; }
    },
    briefingWindow: () => briefingWindowLegacyShape(Date.now()),
    lastFetch: () => window.lastNewsFetchAt || window._lastNewsFetchAt || (typeof lastFetchTime !== 'undefined' ? lastFetchTime : 0) || null,
  };
  const newsItems = () => (typeof newsCache !== 'undefined' && Array.isArray(newsCache) ? newsCache : []);

  window.scoreItem = (item) => scoreItem(item, env);
  window.classifyTopic = classifyTopic;
  window.getSentimentFromText = newsTextSentiment;
  window.calcNewsImpactVector = (item) => calcNewsImpactVector(item, env);
  window.AIO_NEWS_SURFACE_CONTRACTS = NEWS_SURFACE_CONTRACTS;
  window.MACRO_KW = MACRO_KW; // T829 reads the seed keywords by name
  window.TECH_KW = TECH_KW;
  window._aioNewsDedupeKey = (item) => newsDedupeKey(item, env); // the RSS fetch dedupes with the story key
  window._aioNormalizeNewsItem = (surfaceId, item, contract, nowMs, cycleWindow) => normalizeNewsItem(surfaceId, item, contract, nowMs, cycleWindow, env);
  window.AIO.buildNewsSurfaceModel = (surfaceId, items, opts) => {
    const model = buildNewsSurfaceModel(surfaceId, items, opts, env);
    window._aioNewsSurfaceModels = window._aioNewsSurfaceModels || {};
    window._aioNewsSurfaceModels[surfaceId] = model;
    return model;
  };
  // The classic audit counted surface eligibility through a global that never existed, so homeEligible,
  // briefingEligible and marketNewsEligible were always 0 and the 뉴스 page source kind is held at SNAPSHOT on that
  // (js/aio-core.js). Counting them changes that label, so they stay 0 until the owner decides (v59.42 report).
  window.AIO.getNewsSelectionAudit = (items) => newsSelectionAudit(Array.isArray(items) ? items : newsItems(), env);
  window.AIO.getNewsSurfaceAudit = (opts = {}) => {
    const rows = {};
    // v50.41: primary 뉴스 surface(home/briefing/market-news)만 — 분석 페이지 topic-strip은 getConnectiveLayerAudit가 담당.
    const surfaces = Object.keys(NEWS_SURFACE_CONTRACTS).filter((id) => String((NEWS_SURFACE_CONTRACTS[id] || {}).role || '').indexOf('analysis-page') < 0);
    const issues = [];
    surfaces.forEach((id) => {
      let model = window._aioNewsSurfaceModels && window._aioNewsSurfaceModels[id];
      if (!model || opts.rebuild) {
        let buildOpts = {};
        if (id === 'market-news') buildOpts = { countryFilter: 'all', topicFilter: 'all', typeTab: 'all', sortMode: 'score' };
        const bw = id === 'briefing' ? env.briefingWindow() : null;
        if (bw) { buildOpts.windowStart = bw.start; buildOpts.windowEnd = bw.end; buildOpts.anchorDate = bw.anchorDate.toISOString().slice(0, 10); }
        model = window.AIO.buildNewsSurfaceModel(id, newsItems(), buildOpts);
      }
      rows[id] = {
        visibleCount: model.visibleCount,
        eligibleCount: model.eligibleCount,
        staleCount: model.staleCount,
        unverifiedCount: model.unverifiedCount,
        duplicateRemoved: model.duplicateRemoved,
        sourceCount: model.sourceCount,
        lastFetch: model.lastFetch,
        emptyReason: model.emptyReason,
        latestPubDate: model.latestPubDate,
        status: model.visibleCount ? 'ok' : 'warn'
      };
      if (!model.visibleCount) issues.push(id + ':' + model.emptyReason);
    });
    return { status: issues.length ? 'warn' : 'ok', surfaceCount: surfaces.length, issues, surfaces: rows, generatedAt: new Date().toISOString() };
  };
  window.AIO.diag = window.AIO.diag || {};
  window.AIO.diag.scoreCache = () => ({
    scoreItem: cache ? cache.stats() : 'N/A',
    tickerRegex: window._tickerRegexCache ? window._tickerRegexCache.stats() : 'N/A'
  });
}
