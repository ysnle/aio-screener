// v59.34 (roadmap 11, layer 4 boot sequence): the server data loader moved out of js/aio-data.js unchanged — the
// official Treasury curve projection (AIO_SERVER_TREASURY_FIELDS, _aioApplyServerTreasuryEvidence) and
// _aioLoadServerData, which applies public-data/data.json to DATA_SNAPSHOT and the legacy caches after
// src/data/server-data.js fetched it. It still sets the classic script-scope lets _aioServerMacroReady and
// _aioServerHyReady, which stay declared in js/aio-data.js because initV20DataEngine reads them there; a module
// resolves those names in the shared global scope. src/app/compatibility-globals.js installs this before DOMContentLoaded.
export function installServerDataLoader(window = globalThis) {
  // Server macro artifacts carry the complete official Treasury curve, but the
  // legacy/browser consumers historically only saw the Yahoo/FRED client cache.
  // Keep this projection in one place so DATA_SNAPSHOT, _fredData and the
  // per-maturity runtime variables cannot drift apart.  Values remain dated
  // observations; this helper never derives a missing maturity or spread.
  const AIO_SERVER_TREASURY_FIELDS = Object.freeze([
    { field: 'dgs2', fredId: 'DGS2', snapshotKey: 'tnx2y', runtimeKey: '_live2Y' },
    { field: 'dgs5', fredId: 'DGS5', snapshotKey: 'fvx', runtimeKey: '_live5Y' },
    { field: 'dgs10', fredId: 'DGS10', snapshotKey: 'tnx', runtimeKey: '_live10Y' },
    { field: 'dgs20', fredId: 'DGS20', snapshotKey: 'tnx20y', runtimeKey: '_live20Y' },
    { field: 'dgs30', fredId: 'DGS30', snapshotKey: 'tyx', runtimeKey: '_live30Y' },
    { field: 't10y2y', fredId: 'T10Y2Y', snapshotKey: 't10y2y', runtimeKey: null }
  ]);

  function _aioApplyServerTreasuryEvidence(macro, metadata) {
    if (!macro || !window.DATA_SNAPSHOT) return { applied: 0, fields: [] };
    const treasury = macro._treasury && typeof macro._treasury === 'object' ? macro._treasury : {};
    const fred = window._fredData && typeof window._fredData === 'object' ? window._fredData : {};
    const fields = [];
    AIO_SERVER_TREASURY_FIELDS.forEach(function(definition) {
      const value = Number(macro[definition.field] ?? (treasury.values && treasury.values[definition.field]));
      if (!Number.isFinite(value)) return;
      const observedAt = macro['_asOf_' + definition.field] || treasury.observedAt || null;
      const fetchedAt = treasury.fetchedAt || metadata?.treasuryLastSuccessfulAt || metadata?.generatedAt || null;
      const sourceMarker = macro['_source_' + definition.field] || treasury.source || 'server-data:treasury';
      const freshness = sourceMarker === 'last-known-good' ? 'stale-reference' : 'observed';
      const source = sourceMarker === 'last-known-good'
        ? (macro['_originSource_' + definition.field] || treasury.source || sourceMarker)
        : sourceMarker;
      const existing = fred[definition.fredId];
      const existingMs = existing && existing.date ? Date.parse(existing.date) : NaN;
      const observedMs = observedAt ? Date.parse(observedAt) : NaN;
      // A client FRED observation from a later date wins.  Equal-date server
      // evidence is preferred because it carries the official Treasury source.
      if (existing && Number.isFinite(existingMs) && (!Number.isFinite(observedMs) || existingMs > observedMs)) return;
      const delta = Number(macro[definition.field + 'Delta']);
      const entry = {
        value,
        prevValue: Number.isFinite(delta) ? value - delta : null,
        date: observedAt,
        observedAt,
        fetchedAt,
        source,
        sourceKind: 'T1_OFFICIAL',
        allowedUse: 'reference-only',
        freshness,
        _source: source
      };
      fred[definition.fredId] = entry;
      const snapshotKey = definition.snapshotKey;
      window.DATA_SNAPSHOT[snapshotKey] = value;
      window.DATA_SNAPSHOT['_' + snapshotKey + '_src'] = source;
      window.DATA_SNAPSHOT['_' + snapshotKey + '_freshness'] = freshness;
      window.DATA_SNAPSHOT._fieldTs = window.DATA_SNAPSHOT._fieldTs || {};
      if (observedAt) window.DATA_SNAPSHOT._fieldTs['macro_' + definition.field] = observedAt;
      if (definition.runtimeKey) globalThis[definition.runtimeKey] = value;
      if (window._serverMacroEvidence) {
        window._serverMacroEvidence[definition.field] = {
          value,
          observedAt,
          fetchedAt,
          source,
          sourceKind: 'T1_OFFICIAL',
          allowedUse: 'reference-only',
          freshness,
          seriesId: definition.fredId,
          seasonalAdjustment: null,
          status: treasury.status || 'unknown'
        };
      }
      fields.push(definition.field);
    });
    window._fredData = fred;
    window._serverDataMeta = window._serverDataMeta || {};
    window._serverDataMeta.treasury = window._serverDataMeta.treasury || Object.freeze({
      ...treasury,
      cutId: treasury.observedAt ? `us-treasury-daily:${treasury.observedAt}` : null,
      values: Object.freeze({ ...(treasury.values || {}) })
    });
    // Reuse the existing DOM projection so legacy macro/fx-bond sinks and the
    // native event-driven consumers observe the same dated field envelope.
    try { if (typeof applyFredToUI === 'function') applyFredToUI(fred); } catch (_) {}
    return { applied: fields.length, fields };
  }

  async function _aioLoadServerData() {
    try {
      // Fetch, reconciliation check and market-cycle gate: src/data/server-data.js (bound by the compat bridge).
      var fetched = await window._aioFetchServerData();
      if (!fetched.ok) {
        if (typeof _aioLog === 'function') _aioLog('warn', 'data', fetched.reason);
        return false;
      }
      var d = fetched.data;
      // P867: data.json can resolve before aio-core exposes DATA_SNAPSHOT on a
      // cold origin. Previously the macro block was then skipped permanently
      // even though cycle/news metadata loaded, producing saved-key + blank-card
      // behavior that disappeared only on warm-cache reloads.
      var _snapshotBridgeWait = 0;
      while (!window.DATA_SNAPSHOT && _snapshotBridgeWait < 60) {
        await new Promise(function(resolve) { setTimeout(resolve, 50); });
        _snapshotBridgeWait++;
      }
      if (!window.DATA_SNAPSHOT) {
        // The first parse of the large single-page bundle can legitimately take
        // longer than the bridge window on a cold device. Re-run the complete
        // idempotent loader instead of publishing metadata while permanently
        // skipping macro projection. Bound the retries so a genuinely broken
        // core does not create an endless fetch loop.
        globalThis._aioServerDataBridgeAttempts = (window._aioServerDataBridgeAttempts || 0) + 1;
        if (window._aioServerDataBridgeAttempts <= 5 && !window._aioServerDataBridgeRetryTimer) {
          globalThis._aioServerDataBridgeRetryTimer = setTimeout(function() {
            globalThis._aioServerDataBridgeRetryTimer = null;
            _aioLoadServerData();
          }, 1000);
        }
        return false;
      }
      globalThis._aioServerDataBridgeAttempts = 0;

      window._serverDataMeta = window._aioBuildServerDataMeta(d, fetched.reconciliation);
      var _serverGeneratedMs = d.meta.generatedAt ? new Date(d.meta.generatedAt).getTime() : NaN;
      var _liveCoreEligible = window._serverDataMeta.liveCoreEligible;
      var ageMin = window._serverDataMeta.ageMin;

      // Artifact provenance is the only snapshot-level timestamp. It describes
      // the payload, not every field; per-field timestamps remain authoritative.
      if (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs && d.meta.generatedAt) {
        window.DATA_SNAPSHOT._fieldTs.serverData = d.meta.generatedAt;
        // Keep the artifact fetch/attempt lineage separate from market observation
        // lineage. A failed or degraded cycle must not relabel an older LKG market
        // snapshot as fresh merely because its payload was generated now.
        var _existingSnapshotMs = new Date(window.DATA_SNAPSHOT._updated || window.DATA_SNAPSHOT._marketDataUpdated || 0).getTime();
        if (_liveCoreEligible && (!isFinite(_existingSnapshotMs) || _serverGeneratedMs >= _existingSnapshotMs)) {
          window.DATA_SNAPSHOT._updated = d.meta.generatedAt;
          window.DATA_SNAPSHOT._marketDataUpdated = d.meta.generatedAt;
          window.DATA_SNAPSHOT._snapshotDate = String(d.meta.generatedAt).slice(0, 10);
          window.DATA_SNAPSHOT._marketDataDate = window.DATA_SNAPSHOT._snapshotDate;
        }
        // A degraded/LKG artifact still needs a dated reference envelope for
        // freshness audits. This date is explicitly non-promoted artifact
        // provenance; it must never clear _isFallback or advance market data
        // freshness, and it is not an observation permission.
        if (!_liveCoreEligible && !window.DATA_SNAPSHOT._snapshotDate) {
          var _referenceArtifactDate = d.meta.marketSnapshotLastSuccessfulAt || d.meta.generatedAt || d.meta.artifactGeneratedAt || null;
          var _referenceArtifactMs = _referenceArtifactDate ? new Date(_referenceArtifactDate).getTime() : NaN;
          if (isFinite(_referenceArtifactMs)) {
            var _referenceArtifactIso = new Date(_referenceArtifactMs).toISOString();
            window.DATA_SNAPSHOT._snapshotDate = _referenceArtifactIso.slice(0, 10);
            window.DATA_SNAPSHOT._marketDataDate = window.DATA_SNAPSHOT._snapshotDate;
            window.DATA_SNAPSHOT._marketDataDateKind = 'artifact-reference-fallback';
            window.DATA_SNAPSHOT._fieldTs.serverData = d.meta.generatedAt;
          }
        }
      }

      // 1) 시세 → freshness SLA를 통과한 market-cycle만 live quote plane에 승격.
      // Stale data.json remains available as dated reference evidence below.
      if (_liveCoreEligible && Array.isArray(d.quotes) && d.quotes.length && typeof applyLiveQuotes === 'function') {
        applyLiveQuotes(d.quotes);
      }
      // 2) 매크로 → DATA_SNAPSHOT (FRED 서버값, 채팅/macro 페이지가 소비)
      globalThis._serverMacroEvidence = window._serverMacroEvidence || {}; globalThis._aioServerMacro = d.macro && typeof d.macro === 'object' ? d.macro : null; // P1425: native 거시 boards read the published macro block (dates, deltas, freshness)
      // FRED/BEA/BLS/HY OAS/surveys → DATA_SNAPSHOT + evidence: src/data/server-macro.js (bound by the compat bridge).
      var _serverMacro = window._aioApplyServerMacro(d, window.DATA_SNAPSHOT, window._serverMacroEvidence, window._serverDataMeta);
      var _serverFredApplied = _serverMacro.fredApplied;
      if (_serverMacro.highYield) {
        var _serverHy = _serverMacro.highYield.evidence;
        Object.assign(window, { _hySpreadBp: _serverHy.valueBp, _hySpreadDate: _serverHy.observedAt, _hySpreadSource: _serverHy.source });
        try {
          if (window.AIO_ARCH && typeof window.AIO_ARCH.ingestSentiment === 'function') {
            window.AIO_ARCH.ingestSentiment({ hySpread: _serverHy.valueBp, hySpreadSourceKind: _serverMacro.highYield.official ? 'delayed' : 'snapshot', hySpreadSource: _serverHy.source, hySpreadDate: _serverHy.observedAt || d.meta.generatedAt || null, hySpreadAllowedUse: 'reference', now: new Date().toISOString() });
          }
        } catch (_) {}
      }
      if (_serverMacro.aaiiBearish != null) window['_aaiiBearish'] = _serverMacro.aaiiBearish;
      if (d.macro && window.DATA_SNAPSHOT) {
        var _serverTreasuryProjection = _aioApplyServerTreasuryEvidence(d.macro, window._serverDataMeta);
        if (window._serverDataMeta) {
          window._serverDataMeta.treasury = d.macro._treasury ? Object.freeze({
            ...d.macro._treasury,
            cutId: d.macro._treasury.cutId || (d.macro._treasury.observedAt ? `us-treasury-daily:${d.macro._treasury.observedAt}` : null),
            values: Object.freeze({ ...(d.macro._treasury.values || {}) })
          }) : null;
          window._serverDataMeta.treasuryProjectedFields = _serverTreasuryProjection.fields;
        }
      }
      // P1737: the producer's Fed range (policyRates.fed) and the official web-reference artifact replace the hand-kept
      // policy/CPI/export values while they are current/verified; otherwise the manual values stay with their dates
      // and expire on their own (P1736). A missing or malformed artifact changes nothing.
      try {
        if (window.AIO && typeof window.AIO.applyProducedReferences === 'function') {
          window.AIO.applyProducedReferences({ policyRates: d.policyRates && typeof d.policyRates === 'object' ? d.policyRates : null });
          // Fetched only once the producer announces it in data.json (a 404 before the first lane run is a console error).
          if (d.meta && d.meta.officialReferencesCheckedAt) _aioLoadOfficialReferences();
        }
      } catch (_refErr) { if (typeof _aioLog === 'function') _aioLog('warn', 'reference', 'produced references: ' + (_refErr && _refErr.message || _refErr)); }
      // v51.67: F&G previousScore → _fearGreedDelta 계산
      if (d.fearGreed && typeof d.fearGreed.score === 'number') {
        if (typeof d.fearGreed.previousScore === 'number') {
          var _fgCloses = Array.isArray(d.fearGreed.history) ? d.fearGreed.history.filter(function(p) { return p && typeof p.score === 'number' && isFinite(p.score); }) : [];
          window.DATA_SNAPSHOT._fearGreedDelta = _fgCloses.length >= 2 ? (Math.round(_fgCloses[_fgCloses.length - 1].score) - Math.round(_fgCloses[_fgCloses.length - 2].score)) : (d.fearGreed.score - d.fearGreed.previousScore);
          window.DATA_SNAPSHOT._fearGreedPrev = d.fearGreed.previousScore;
        }
        if (typeof d.fearGreed.previousWeek === 'number') {
          window.DATA_SNAPSHOT._fearGreedWeekDelta = d.fearGreed.score - d.fearGreed.previousWeek;
        }
      }
      // v51.66: _fieldTs.macro_fred — FRED 매크로 마지막 적용 시각 기록
      if (d.meta.fredFetchOk && _serverFredApplied > 0 && window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs) {
        window.DATA_SNAPSHOT._fieldTs.macro_fred = d.meta.fredLastSuccessfulAt || d.meta.generatedAt || new Date().toISOString();
      }
      _aioServerMacroReady = !!(d.meta.fredFetchOk && _serverFredApplied > 0);
      _aioServerHyReady = !!(window._serverDataMeta && window._serverDataMeta.hyOAS);
      setTimeout(function() {
        try {
          if (typeof window._aioRenderAllPageDecisionHeaders === 'function') window._aioRenderAllPageDecisionHeaders();
          window.dispatchEvent(new CustomEvent('aio:sharedMarketCut', { detail: window._serverDataMeta }));
        } catch (_) {}
      }, 0);
      // 3) Fear & Greed
      if (d.fearGreed && typeof d.fearGreed.score === 'number' && isFinite(d.fearGreed.score)) {
        if (typeof _applyFearGreedScore === 'function') {
          _applyFearGreedScore({ score: d.fearGreed.score, sourceKind: 'T3_PUBLIC_DELAYED', sourceLabel: 'cnn-via-github-actions', sourceTs: d.fearGreed.asOf || d.meta.generatedAt, operationalUse: 'reference-only' });
        }
        // v51.66: _fieldTs.fearGreed — Fear & Greed 마지막 적용 시각 기록
        if (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs) {
          window.DATA_SNAPSHOT._fieldTs.fearGreed = d.fearGreed.asOf || d.meta.generatedAt || new Date().toISOString();
        }
      }
      // 4) Cboe official daily Put/Call. Server-side collection avoids the
      // public CORS proxy and is explicitly delayed, never called real-time.
      if (d.putCall && typeof d.putCall.totalPutCall === 'number' && isFinite(d.putCall.totalPutCall) && typeof _aioUpdatePutCallDom === 'function') {
        _aioUpdatePutCallDom({
          totalPutCall: d.putCall.totalPutCall,
          equityPutCall: d.putCall.equityPutCall,
          indexPutCall: d.putCall.indexPutCall,
          sourceKind: 'T1_OFFICIAL',
          sourceLabel: 'Cboe Daily Market Statistics',
          asOf: d.putCall.asOf || d.meta.generatedAt
        });
        if (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs) window.DATA_SNAPSHOT._fieldTs.putCall = d.putCall.asOf || d.meta.generatedAt;
      }
      // 5) v50.28/WO-6: 서버 뉴스 백스톱 저장 + (클라이언트 뉴스 비었을 때만) 적용 — additive
      if (Array.isArray(d.news) && d.news.length) {
        window._serverNewsBackstop = d.news;
        try { _aioApplyNewsBackstop(false); } catch(_) {}
      }
      // P1729/P1730: post-08:00 provisional headlines (producer P1720) — a separate slot, never merged into the 08:00 bundle.
      window._serverNewsIntraday = Array.isArray(d.newsIntraday) ? d.newsIntraday.slice(0, 12) : []; // NEWS_INTRADAY_MAX (src/domain/news/stories.js)
      // 2026-10-13 boot payload review: the 1MB Telegram digest was awaited here, so the market analysis, AI briefing
      // and every step below waited on a channel feed no first screen needs. It now loads beside them; the feeds
      // repaint themselves when it lands (_aioApplyTelegramDigestPayload) and the meta is filled in then.
      try {
        if (typeof _aioLoadServerTelegramDigest === 'function') {
          window._aioTelegramDigestReady = _aioLoadServerTelegramDigest().then(function(ok) {
            if (window._serverDataMeta) {
              if (window._serverDataMeta.artifacts) window._serverDataMeta.artifacts.telegramDigest = window._aioTelegramDigestMeta && window._aioTelegramDigestMeta.status || 'checked';
              window._serverDataMeta.telegramDigest = window._aioTelegramDigestMeta || null;
              window._serverDataMeta.telegramMemoOverlay = window._aioTelegramMemoOverlayAudit || null;
            }
            return ok;
          }, function() { return false; });
        }
      } catch(_) {}
      // 6) v50.48/Phase 4: 서버 LLM 시장 분석문(운영자 키 있을 때 cron 생성) — 있으면 합성 sink가 템플릿 대신 우선 사용.
      // v52.75/WP-AI0: do not expose generated-but-unverified LLM prose to any
      // public sink. A future typed/semantic producer must opt in explicitly.
      window._serverMarketAnalysis = null;
      // v57.71 (owner 2026-10-15): the producer's one-sentence line is validated on its own (no number, ticker or
      // instruction) and shown on the home card even when this run's long reading was held.
      window._aioMarketSentence = d.marketAnalysis && d.marketAnalysis.sentence && d.marketAnalysis.sentence.text ? d.marketAnalysis.sentence : null;
      try { if (typeof _aioRenderOperatorNote === 'function') _aioRenderOperatorNote(); } catch(_) {}
      // Typed-evidence + semantic + publish gate: src/data/server-market-analysis.js (bound by the compat bridge).
      var _serverMarketGate = window._aioVerifyServerMarketAnalysis(d.marketAnalysis, {
        fallbackGeneratedAt: d.meta.generatedAt,
        validatePublish: window.AIO && typeof window.AIO.validateAIAutomatedPublish === 'function' ? window.AIO.validateAIAutomatedPublish.bind(window.AIO) : null,
        describeScope: _aioMarketAnalysisScope,
        sourceLabelFor: window.AIO && typeof window.AIO.getAIOutputSourceLabel === 'function' ? window.AIO.getAIOutputSourceLabel.bind(window.AIO) : null
      });
      if (_serverMarketGate.meta) {
        window._serverMarketAnalysis = _serverMarketGate.analysis;
        if (window._serverDataMeta) window._serverDataMeta.marketAnalysis = _serverMarketGate.meta;
        try { if (window._aioRenderMarketAnalysisSinks) window._aioRenderMarketAnalysisSinks(); } catch(_) {}
      }
      // 6) P768/ARX-16: screener artifact는 native provider/orchestrator가 단일 fetch하고, 그 load state는
      // native slice에서 읽는다(src/data/page-completeness.js). P1186: 이 경로는 투영도 상태 기록도 하지 않는다.
      if (typeof _aioLog === 'function') _aioLog('info', 'data', 'server data.json 적용: quotes ' + (d.quotes ? d.quotes.length : 0) + ', age ' + ageMin + 'min');
      _aioRenderServerDataAge();  // v50.24/WO-4: 나이 배지 갱신
      try { if (typeof _aioRenderPipelineStatus === 'function') _aioRenderPipelineStatus(); } catch(_) {} // v51.65: 파이프라인 상태 배너
      try { _aioRenderDataFreshness(); } catch(_) {} // v51.66: 신선도 타임스탬프 UI
      try { _aioCheckManualFieldStaleness(); } catch(_) {} // v51.66: 수동 필드 staleness 경고
      try { _aioUpdatePipelineStatusToggle(); } catch(_) {} // v52.15 P616: pill 개수 집계 → 1줄 요약+펼치기
      try { _aioRenderDeltas(); } catch(_) {} // v51.67: 변화율 표시 (FRED MoM + F&G 전일 + 스코어)
      // v50.24/WO-4: 보이는 페이지 분석 텍스트도 새 데이터로 재생성 (숨은 페이지는 스킵)
      try { if (window.AIO && typeof window.AIO.refreshActivePageNarratives === 'function') window.AIO.refreshActivePageNarratives(); } catch(_) {}
      try {
        window.dispatchEvent(new CustomEvent('aio:serverDataLoaded', { detail: window._serverDataMeta }));
        if (document && typeof document.dispatchEvent === 'function') document.dispatchEvent(new CustomEvent('aio:serverDataLoaded', { detail: window._serverDataMeta }));
      } catch(_) {}
      return true;
    } catch (e) {
      if (typeof _aioLog === 'function') _aioLog('warn', 'data', 'server data.json 로드 실패(폴백): ' + (e && e.message || e));
      return false;
    }
  }

  window._aioApplyServerTreasuryEvidence = _aioApplyServerTreasuryEvidence;
  window._aioLoadServerData = _aioLoadServerData;
  return window;
}
