import { refreshSharedArtifact } from './shared-artifacts.js';
import { mergeRotationDetail, rotationDetailPending } from '../domain/themes/rotation-detail.js';
import { ROTATION_DETAIL } from './artifact-registry.js';

const ROTATION_DETAIL_WAIT_MS = 1500;
function attachRotationDetail(window) {
  const meta = window._serverDataMeta;
  if (!rotationDetailPending(meta?.rotationHistory)) return Promise.resolve(false);
  const apply = (payload) => {
    const current = window._serverDataMeta;
    if (!payload || !rotationDetailPending(current?.rotationHistory)) return false;
    current.rotationHistory = mergeRotationDetail(current.rotationHistory, payload);
    return true;
  };
  if (apply(window[ROTATION_DETAIL.key]) && !window.__aioSharedArtifacts?.[ROTATION_DETAIL.key]?.inFlight) {
    // A cached copy merged at once; a newer one (after a data refresh) still loads in the background.
    refreshSharedArtifact(window, ROTATION_DETAIL).then(({ changed, payload }) => { if (changed && payload) notifyRotationDetail(window); });
    return Promise.resolve(true);
  }
  const loading = refreshSharedArtifact(window, ROTATION_DETAIL).then(({ payload }) => apply(payload));
  const timeout = new Promise((resolve) => setTimeout(() => resolve('late'), ROTATION_DETAIL_WAIT_MS));
  return Promise.race([loading, timeout]).then((first) => {
    if (first !== 'late') return first;
    loading.then((merged) => { if (merged) notifyRotationDetail(window); });
    return false;
  });
}
function notifyRotationDetail(window) {
  try { window.dispatchEvent(new CustomEvent('aio:rotationDetailLoaded')); } catch (_) {}
  try { window.document?.dispatchEvent?.(new CustomEvent('aio:rotationDetailLoaded')); } catch (_) {}
}

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
      const finiteOrNaN = (raw) => (raw == null || raw === '' ? NaN : Number(raw));
      const value = finiteOrNaN(macro[definition.field] ?? (treasury.values && treasury.values[definition.field]));
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
      const delta = finiteOrNaN(macro[definition.field + 'Delta']);
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

  var _loadInFlight = null;
  async function _aioLoadServerData() {
    if (_loadInFlight) return _loadInFlight;
    _loadInFlight = (async function() {
      try {
        if (rotationDetailPending(window._serverDataMeta?.rotationHistory) || window[ROTATION_DETAIL.key]) refreshSharedArtifact(window, ROTATION_DETAIL);
        // Fetch, reconciliation check and market-cycle gate: src/data/server-data.js (bound by the compat bridge).
        var fetched = await window._aioFetchServerData();
        if (!fetched.ok) {
          if (typeof _aioLog === 'function') _aioLog('warn', 'data', fetched.reason);
          _aioServerDataFailed(fetched.reason, fetched.empty ? 'empty' : 'failed');
          return false;
        }
        window.__aioServerDataLoadState = 'ready';
        window.__aioServerDataApplied = true;
        var d = fetched.data;
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
        await attachRotationDetail(window);
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
        globalThis._serverMacroEvidence = window._serverMacroEvidence || {}; globalThis._aioServerMacro = d.macro && typeof d.macro === 'object' ? d.macro : null;
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
        try {
          if (window.AIO && typeof window.AIO.applyProducedReferences === 'function') {
            window.AIO.applyProducedReferences({ policyRates: d.policyRates && typeof d.policyRates === 'object' ? d.policyRates : null });
            // Fetched only once the producer announces it in data.json (a 404 before the first lane run is a console error).
            if (d.meta && d.meta.officialReferencesCheckedAt) _aioLoadOfficialReferences();
          }
        } catch (_refErr) { if (typeof _aioLog === 'function') _aioLog('warn', 'reference', 'produced references: ' + (_refErr && _refErr.message || _refErr)); }
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
        if (d.meta.fredFetchOk && _serverFredApplied > 0 && window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs) {
          window.DATA_SNAPSHOT._fieldTs.macro_fred = d.meta.fredLastSuccessfulAt || d.meta.generatedAt || new Date().toISOString();
        }
        setTimeout(function() {
          try {
            if (typeof window._aioRefreshAllPageSurfaces === 'function') window._aioRefreshAllPageSurfaces();
            window.dispatchEvent(new CustomEvent('aio:sharedMarketCut', { detail: window._serverDataMeta }));
          } catch (_) {}
        }, 0);
        // 3) Fear & Greed
        if (d.fearGreed && typeof d.fearGreed.score === 'number' && isFinite(d.fearGreed.score)) {
          if (typeof _applyFearGreedScore === 'function') {
            _applyFearGreedScore({ score: d.fearGreed.score, sourceKind: 'T3_PUBLIC_DELAYED', sourceLabel: 'cnn-via-github-actions', sourceTs: d.fearGreed.asOf || d.meta.generatedAt, operationalUse: 'reference-only' });
          }
          if (window.DATA_SNAPSHOT && window.DATA_SNAPSHOT._fieldTs) {
            window.DATA_SNAPSHOT._fieldTs.fearGreed = d.fearGreed.asOf || d.meta.generatedAt || new Date().toISOString();
          }
        }
        if (Array.isArray(d.news) && d.news.length) {
          window._serverNewsBackstop = d.news;
          try { _aioApplyNewsBackstop(false); } catch(_) {}
        }
        window._serverNewsIntraday = Array.isArray(d.newsIntraday) ? d.newsIntraday.slice(0, 12) : []; // NEWS_INTRADAY_MAX (src/domain/news/stories.js)
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
        window._serverMarketAnalysis = null;
        window._aioMarketSentence = d.marketAnalysis && d.marketAnalysis.sentence && d.marketAnalysis.sentence.text ? d.marketAnalysis.sentence : null;
        // The per-screen AI readings, kept raw; each screen admits its own (src/data/server-screen-readings.js).
        window._aioScreenReadings = d.screenReadings && typeof d.screenReadings === 'object' ? d.screenReadings : null;
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
        if (typeof _aioLog === 'function') _aioLog('info', 'data', 'server data.json 적용: quotes ' + (d.quotes ? d.quotes.length : 0) + ', age ' + ageMin + 'min');
        _aioRenderServerDataAge();
        try { if (typeof window._aioRenderPipelineStatus === 'function') window._aioRenderPipelineStatus(); } catch(_) {}
        try { if (window.AIO && typeof window.AIO.refreshActivePageNarratives === 'function') window.AIO.refreshActivePageNarratives(); } catch(_) {}
        try {
          window.dispatchEvent(new CustomEvent('aio:serverDataLoaded', { detail: window._serverDataMeta }));
          if (document && typeof document.dispatchEvent === 'function') document.dispatchEvent(new CustomEvent('aio:serverDataLoaded', { detail: window._serverDataMeta }));
        } catch(_) {}
        return true;
      } catch (e) {
        if (typeof _aioLog === 'function') _aioLog('warn', 'data', 'server data.json 로드 실패(폴백): ' + (e && e.message || e));
        if (window.__aioServerDataLoadState !== 'ready') _aioServerDataFailed(e && e.message || String(e));
        return false;
      }
    })();
    try { return await _loadInFlight; } finally { _loadInFlight = null; }
  }

  function _aioServerDataFailed(reason, state) {
    if (window.__aioServerDataApplied) return;
    window.__aioServerDataLoadState = state === 'empty' ? 'empty' : 'failed'; // empty: answered without a payload
    try { window.dispatchEvent(new CustomEvent('aio:serverDataFailed', { detail: { reason: reason, state: window.__aioServerDataLoadState } })); } catch (_) {}
  }

  window._aioApplyServerTreasuryEvidence = _aioApplyServerTreasuryEvidence;
  window._aioLoadServerData = _aioLoadServerData;
  return window;
}
