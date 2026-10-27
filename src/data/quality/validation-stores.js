// v59.17 (roadmap 11, layer 2 quality/evidence): the data validation stores moved out of js/aio-core.js unchanged —
// PriceStore (quotes), MacroStore (FRED), NewsStore (dedup/feeds), DataHealth (their combined report) and SnapshotStore
// (static snapshot seeds). The classic scripts keep reading them as window globals; src/app/compatibility-globals.js
// installs them before any fetch runs. The `window` parameter keeps the moved bodies identical.
export function installValidationStores(window = globalThis) {
  // ═══════════════════════════════════════════════════════════════════
  // v31.8: DATA VALIDATION STORES — 데이터 정확성/최신성/신뢰성 검증 레이어
  // ═══════════════════════════════════════════════════════════════════

  // ── 1. PriceStore — 시세 데이터 검증 저장소 ──
  const PriceStore = {
    _data: {},        // sym → { price, pct, source, ts, stale, pctMissing }
    _prev: {},        // sym → 이전 가격 (급변 감지용)
    _rejected: [],    // 최근 거부된 데이터 로그 (최대 50건)
    _stats: { accepted: 0, rejected: 0, staleCount: 0 },
    _sessionStart: Date.now(),

    /** 시세 데이터 저장 (검증 후) */
    set(sym, price, pct, source, opts) {
      opts = opts || {};
      // v46.4: symbol 유효성 검증
      if (!sym || typeof sym !== 'string' || sym.trim() === '') {
        this._reject(sym, price, source, 'invalid_symbol', '심볼 빈값/비문자열');
        return false;
      }
      if (typeof price !== 'number' || isNaN(price) || price <= 0) {
        this._reject(sym, price, source, 'invalid_price', '가격이 숫자가 아니거나 0 이하');
        return false;
      }
      const pctMissing = (typeof pct !== 'number' || isNaN(pct) || !isFinite(pct));
      if (pctMissing) pct = null;
      const age = Date.now() - this._sessionStart;
      if (this._prev[sym] && age > 180000) {
        const jump = Math.abs(price - this._prev[sym]) / this._prev[sym];
        if (jump > 0.5) {
          this._reject(sym, price, source, 'price_jump', `${(jump*100).toFixed(1)}% 급변 (이전: ${this._prev[sym]})`);
          return false;
        }
      }
      // The provider observation is the only timestamp that can promote a quote.
      // Fetch/receive time is provenance, not market time: using Date.now() here
      // made an old provider quote look live merely because it was fetched again.
      const ts = (typeof _aioMetricTs === 'function') ? _aioMetricTs(opts.observedAt) : null;
      const policyKey = opts.policyKey || 'quote';
      var metric = (typeof makeMetric === 'function') ? makeMetric(price, source || 'unknown', ts, policyKey, { pct: pct, pctMissing: pctMissing }) : null;
      var sourceKind = (typeof _aioDecisionSourceKind === 'function')
        ? _aioDecisionSourceKind(source || 'unknown')
        : (window.AIO_SOURCE_KIND && window.AIO_SOURCE_KIND.UNAVAILABLE) || 'UNAVAILABLE';
      var metricFresh = metric && /^(live|delayed)$/i.test(String(metric.freshness || ''))
        && metric.timestampValid === true && metric.ageMs >= 0;
      var explicitDecisionUse = _aioExplicitDecisionUse(opts.allowedUse != null ? opts.allowedUse : opts.decisionUse);
      var qualityReady = _aioDecisionQualityReady(metric)
        && (opts.quality == null || _aioDecisionQualityReady(opts.quality));
      var explicitBlocked = opts.allowedUse === false || opts.decisionUse === false
        || /^(none|blocked|reference|reference-only)$/i.test(String(opts.allowedUse || opts.decisionUse || ''));
      var decisionAllowed = !!(metricFresh && qualityReady && explicitDecisionUse && !explicitBlocked
        && (sourceKind === ((window.AIO_SOURCE_KIND || {}).LIVE || 'LIVE') || sourceKind === ((window.AIO_SOURCE_KIND || {}).DELAYED || 'DELAYED')));
      var allowedUse = decisionAllowed ? 'decision' : 'none';
      var stale = !metric || !!metric.stale || !decisionAllowed;
      if (metric) {
        metric.allowedUse = allowedUse;
        metric.decisionUse = allowedUse;
        metric.sourceKind = sourceKind;
      }
      this._data[sym] = {
        price, pct, source: source || 'unknown', sourceKind: sourceKind, ts: ts, stale: stale, allowedUse: allowedUse, decisionUse: allowedUse, pctMissing: pctMissing, metric: metric, quality: metric,
        observedAt: opts.observedAt || null,
        fetchedAt: opts.fetchedAt || null,
        marketState: opts.marketState || null,
        venue: opts.venue || null,
        regularMarketPreviousClose: opts.regularMarketPreviousClose ?? opts.previousClose ?? null,
        changeBasis: opts.changeBasis || opts.valueBasis || 'unknown',
        valueBasis: opts.valueBasis || opts.changeBasis || 'unknown',
        revision: opts.revision || null,
        policyKey: policyKey
      };
      this._prev[sym] = price;
      this._stats.accepted++;
      window._liveData = window._liveData || {};
      window._liveData[sym] = Object.assign({}, window._liveData[sym] || {}, {
        price: price,
        pct: pct,
        source: source || 'unknown',
        sourceKind: sourceKind,
        ts: ts,
        stale: stale,
        allowedUse: allowedUse,
        decisionUse: allowedUse,
        pctMissing: pctMissing,
        metric: metric,
        quality: metric,
        observedAt: opts.observedAt || null,
        fetchedAt: opts.fetchedAt || null,
        marketState: opts.marketState || null,
        venue: opts.venue || null,
        regularMarketPreviousClose: opts.regularMarketPreviousClose ?? opts.previousClose ?? null,
        changeBasis: opts.changeBasis || opts.valueBasis || 'unknown',
        valueBasis: opts.valueBasis || opts.changeBasis || 'unknown',
        revision: opts.revision || null,
        policyKey: policyKey
      });
      window._quoteTimestamps = window._quoteTimestamps || {};
      if (ts != null) window._quoteTimestamps[sym] = ts;
      else delete window._quoteTimestamps[sym];
      window._dataSource = window._dataSource || {};
      window._dataSource[sym] = {
        source: source || 'live:yahoo', sourceKind: sourceKind, ts: ts, allowedUse: allowedUse, decisionUse: allowedUse, pctMissing: pctMissing, policyKey: policyKey, metric: metric,
        observedAt: opts.observedAt || null, fetchedAt: opts.fetchedAt || null,
        marketState: opts.marketState || null, venue: opts.venue || null,
        changeBasis: opts.changeBasis || opts.valueBasis || 'unknown',
        valueBasis: opts.valueBasis || opts.changeBasis || 'unknown',
        revision: opts.revision || null
      };
      if (!opts.deferDomAnnotation && window.AIO && typeof window.AIO.annotateLiveDataSinks === 'function') {
        window.AIO.annotateLiveDataSinks(document, { symbol: sym, force: true });
      }
      return true;
    },
    get(sym) {
      const d = this._data[sym];
      if (!d) return null;
      var evaluated = (typeof evaluateMetric === 'function') ? evaluateMetric(d.metric || { value: d.price, source: d.source, ts: d.ts, policyKey: 'quote' }) : null;
      d.quality = evaluated || d.quality || null;
      d.stale = evaluated ? (evaluated.stale || d.allowedUse !== 'decision') : (d.ts == null || (Date.now() - d.ts) > 300000 || d.allowedUse !== 'decision');
      return d;
    },
    _reject(sym, price, source, reason, detail) {
      this._stats.rejected++;
      if (this._rejected.length >= 50) this._rejected.shift();
      this._rejected.push({ sym, price, source, reason, detail, ts: Date.now() });
      _aioLog('warn', 'price', '거부: ' + sym + ' = ' + price + ' (' + reason + ': ' + detail + ')');
    },
    health() {
      const now = Date.now();
      let total = 0, stale = 0, fresh = 0;
      const sources = {};
      for (const [sym, d] of Object.entries(this._data)) {
        total++;
        var q = (typeof evaluateMetric === 'function') ? evaluateMetric(d.metric || { value: d.price, source: d.source, ts: d.ts, policyKey: 'quote' }, now) : null;
        if (q) { d.quality = q; d.stale = q.stale || d.allowedUse !== 'decision'; }
        if (d.stale || (!q && (d.ts == null || now - d.ts > 300000)) || d.allowedUse !== 'decision') { stale++; d.stale = true; } else fresh++;
        sources[d.source] = (sources[d.source] || 0) + 1;
      }
      this._stats.staleCount = stale;
      return { total, fresh, stale, accepted: this._stats.accepted, rejected: this._stats.rejected,
        rejectRate: this._stats.accepted > 0 ? (this._stats.rejected / (this._stats.accepted + this._stats.rejected) * 100).toFixed(1) + '%' : '0%',
        sources, lastRejects: this._rejected.slice(-5) };
    }
  };

  // ── 2. MacroStore — 거시경제(FRED) 데이터 검증 저장소 ──
  const MacroStore = {
    _data: {}, _rejected: [], _stats: { accepted: 0, rejected: 0 },
    _ranges: {
      'UNRATE':       { min: 0, max: 30, warnMax: 15, label: '실업률(%)' },
      'FEDFUNDS':     { min: 0, max: 25, warnMax: 10, label: '기준금리(%)' },
      'CPIAUCSL':     { min: 50, max: 500, warnMax: 400, label: 'CPI' },
      'DGS2':         { min: -2, max: 20, warnMax: 15, label: '2년 국채(%)' },
      'DGS10':        { min: -2, max: 20, warnMax: 15, label: '10년 국채(%)' },
      'DGS30':        { min: -2, max: 20, warnMax: 15, label: '30년 국채(%)' },
      'T10Y2Y':       { min: -5, max: 5, warnMax: 4, label: '10-2년 스프레드' },
      'T10Y3M':       { min: -5, max: 5, warnMax: 4, label: '10년-3개월 스프레드' },
      'BAMLH0A0HYM2': { min: 0, max: 30, warnMax: 15, label: 'HY 스프레드' },
      'VIXCLS':       { min: 0, max: 100, warnMax: 80, label: 'VIX(FRED)' },
      'ICSA':         { min: 0, max: 1000000, warnMax: 500000, label: '신규 실업수당' },
      'DTWEXBGS':     { min: 50, max: 200, warnMax: 160, label: '달러 인덱스(FRED)' },
    },
    set(id, value, prevValue, date) {
      if (value === '.' || value === '' || value == null || isNaN(parseFloat(value))) {
        this._reject(id, value, 'missing_value', 'FRED 결측치(.)');
        return false;
      }
      const val = parseFloat(value);
      const prev = prevValue != null ? parseFloat(prevValue) : null;
      const range = this._ranges[id];
      if (range) {
        if (val < range.min || val > range.max) {
          this._reject(id, val, 'out_of_range', `${range.label}: ${val} (범위: ${range.min}~${range.max})`);
          return false;
        }
        if (val > range.warnMax) _aioLog('warn', 'macro', '경고: ' + id + '(' + range.label + ') = ' + val + ' — 이상 고값');
      }
      const observationTs = (typeof _aioMetricTs === 'function') ? _aioMetricTs(date) : null;
      const dataAge = observationTs == null ? null : Math.floor((Date.now() - observationTs) / 86400000);
      var policyKey = ['CPIAUCSL','UNRATE','ICSA','FEDFUNDS'].indexOf(id) >= 0 ? 'macro_monthly' : 'macro_daily';
      var metric = (typeof makeMetric === 'function') ? makeMetric(val, 'fred', observationTs, policyKey, { seriesId: id, dataDate: date, observedAt: date || null, prevValue: prev }) : null;
      this._data[id] = { value: val, prevValue: prev, date, ts: observationTs, dataAgeDays: dataAge, stale: !metric || !!metric.stale, policyKey: policyKey, metric: metric, quality: metric };
      this._stats.accepted++;
      window._fredData = window._fredData || {};
      window._fredData[id] = { value: val, prevValue: prev, date };
      return true;
    },
    get(id) { const d = this._data[id]; if (!d) return null; var q = (typeof evaluateMetric === 'function') ? evaluateMetric(d.metric || { value: d.value, source: 'fred', ts: d.ts, policyKey: d.policyKey || 'macro_daily' }) : null; d.quality = q || d.quality || null; d.stale = q ? q.stale : (d.ts == null || (Date.now() - d.ts) > 7200000); return d; },
    _reject(id, value, reason, detail) {
      this._stats.rejected++;
      if (this._rejected.length >= 30) this._rejected.shift();
      this._rejected.push({ id, value, reason, detail, ts: Date.now() });
      _aioLog('warn', 'macro', '거부: ' + id + ' = ' + value + ' (' + reason + ': ' + detail + ')');
    },
    health() {
      const now = Date.now();
      let total = 0, stale = 0, fresh = 0;
      for (const [id, d] of Object.entries(this._data)) {
        total++;
        var q = (typeof evaluateMetric === 'function') ? evaluateMetric(d.metric || { value: d.value, source: 'fred', ts: d.ts, policyKey: d.policyKey || 'macro_daily' }, now) : null;
        if (q) { d.quality = q; d.stale = q.stale; }
        if (d.stale || (!q && (d.ts == null || (now - d.ts) > 7200000))) { stale++; d.stale = true; } else fresh++;
      }
      return { total, fresh, stale, accepted: this._stats.accepted, rejected: this._stats.rejected,
        lastRejects: this._rejected.slice(-5),
        series: Object.fromEntries(Object.entries(this._data).map(([k,v]) => [k, { value: v.value, date: v.date, ageDays: v.dataAgeDays }])) };
    }
  };

  // ── 3. NewsStore — 뉴스 품질/중복 필터 저장소 ──
  const NewsStore = {
    _seen: new Set(), _deadFeeds: {}, _stats: { total: 0, duplicates: 0, filtered: 0, deadFeedHits: 0 },
    filter(articles) {
      if (!Array.isArray(articles)) return [];
      const result = [];
      for (const a of articles) {
        this._stats.total++;
        const key = window._aioNewsStories ? window._aioNewsStories.key(a) : JSON.stringify([a.source, a.link || a.url || a.guid, a.title, a.desc, a.pubDate]); // P1601: query ids and changed versions remain distinct.
        if (key && this._seen.has(key)) { this._stats.duplicates++; continue; }
        const title = a.title || '';
        if (title.trim().length < 5) { this._stats.filtered++; continue; }
        // Do not manufacture a publication time.  Undated articles may remain
        // visible as reference material, but _aioComputeNewsSignal must reject
        // them from the current decision aggregate.
        if (key) this._seen.add(key);
        result.push(a);
      }
      return result;
    },
    reportDeadFeed(feedUrl, status) {
      if (!this._deadFeeds[feedUrl]) this._deadFeeds[feedUrl] = { errorCount: 0, lastError: null, status: null };
      const df = this._deadFeeds[feedUrl]; df.errorCount++; df.lastError = Date.now(); df.status = status;
      this._stats.deadFeedHits++;
    },
    isDeadFeed(feedUrl) { const df = this._deadFeeds[feedUrl]; return df && df.errorCount >= 3; },
    resetDuplicates() { this._seen.clear(); },
    health() {
      return { totalProcessed: this._stats.total, duplicatesRemoved: this._stats.duplicates, qualityFiltered: this._stats.filtered,
        deadFeeds: Object.entries(this._deadFeeds).filter(([,v]) => v.errorCount >= 3).map(([url, v]) => ({ url: url.substring(0, 60), errors: v.errorCount, status: v.status })),
        uniqueArticles: this._seen.size, deadFeedHits: this._stats.deadFeedHits };
    }
  };

  // ── DataHealth — 통합 헬스 대시보드 ──
  const DataHealth = {
    report() { return { price: PriceStore.health(), macro: MacroStore.health(), news: NewsStore.health(), timestamp: new Date().toISOString(), summary: this._summary() }; },
    _summary() {
      const p = PriceStore.health(), m = MacroStore.health(), n = NewsStore.health();
      const issues = [];
      if (p.stale > p.total * 0.3) issues.push(`시세 ${p.stale}/${p.total} stale`);
      if (p.rejected > 10) issues.push(`시세 거부 ${p.rejected}건`);
      if (m.stale > 0) issues.push(`거시 ${m.stale}/${m.total} stale`);
      if (m.rejected > 0) issues.push(`거시 거부 ${m.rejected}건`);
      if (n.deadFeeds.length > 0) issues.push(`죽은 피드 ${n.deadFeeds.length}개`);
      if (n.duplicatesRemoved > n.totalProcessed * 0.3) issues.push(`뉴스 중복률 ${(n.duplicatesRemoved/n.totalProcessed*100).toFixed(0)}%`);
      return { status: issues.length === 0 ? '정상' : issues.length <= 2 ? '주의' : ' 점검 필요', issues };
    },
    log() {
      const r = this.report();
      console.log('%c[DataHealth] 데이터 파이프라인 헬스 리포트', 'color:var(--blue-11);font-weight:bold;font-size:12px;');
      console.log(`  상태: ${r.summary.status}`);
      console.log(`  시세: ${r.price.fresh} fresh / ${r.price.stale} stale / ${r.price.rejected} rejected (${r.price.rejectRate})`);
      console.log(`  거시: ${r.macro.fresh} fresh / ${r.macro.stale} stale / ${r.macro.rejected} rejected`);
      console.log(`  뉴스: ${r.news.uniqueArticles} unique / ${r.news.duplicatesRemoved} dupes / ${r.news.deadFeeds.length} dead feeds`);
      if (r.summary.issues.length > 0) _aioLog('warn', 'debug', '이슈: ' + r.summary.issues.join(' | '));
      return r;
    }
  };
  window.PriceStore = PriceStore; window.MacroStore = MacroStore;

  const SnapshotStore = {
    _data: {},
    set(sym, price, pct, ts, meta) {
      if (!sym || price == null || !isFinite(Number(price))) return false;
      var metric = (typeof makeMetric === 'function') ? makeMetric(Number(price), 'snapshot', ts, 'static_snapshot', Object.assign({ pct: pct, pctMissing: pct == null }, meta || {})) : null;
      this._data[sym] = { price: Number(price), pct: pct != null ? Number(pct) : null, pctMissing: pct == null, source: 'snapshot', ts: metric ? metric.ts : _aioMetricTs(ts), metric: metric, quality: metric };
      return true;
    },
    get(sym) {
      var d = this._data[sym];
      if (!d) return null;
      if (typeof evaluateMetric === 'function') d.quality = evaluateMetric(d.metric || { value: d.price, source: 'snapshot', ts: d.ts, policyKey: 'static_snapshot' });
      return d;
    },
    seedFromMap(map, ts, meta) {
      var count = 0;
      Object.entries(map || {}).forEach(([sym, val]) => {
        if (val && val.price != null && this.set(sym, val.price, val.pct, ts, meta)) count++;
      });
      return count;
    },
    health() {
      var total = 0, stale = 0, hardStale = 0;
      Object.keys(this._data).forEach((sym) => {
        var d = this.get(sym);
        if (!d) return;
        total++;
        if (d.quality && d.quality.stale) stale++;
        if (d.quality && d.quality.hardStale) hardStale++;
      });
      return { total: total, stale: stale, hardStale: hardStale };
    }
  };
  window.SnapshotStore = SnapshotStore;
  window.NewsStore = NewsStore; window.DataHealth = DataHealth;
  return { PriceStore, MacroStore, NewsStore, DataHealth, SnapshotStore };
}
