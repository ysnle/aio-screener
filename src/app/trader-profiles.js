// v59.39 (roadmap 11, layer 5 score/ranking): the trader-profile storage boundary moved out of js/aio-data.js unchanged —
// window.AIO_TRADER_PROFILES, the saved-profile read and write (aio_trader_profile) and _aioFactorWeights, which resolves
// the saved profile through the pure deriveFactorWeights. The table itself is src/domain/screener/trader-profiles.js.
// src/app/compatibility-globals.js installs this before DOMContentLoaded.
import { TRADER_PROFILES } from '../domain/screener/trader-profiles.js';

export function installTraderProfiles(window = globalThis) {
  // ARX-10: native screener owns controls, table, factor panel, and backtest DOM.
  var AIO_TRADER_PROFILES = TRADER_PROFILES;
  window.AIO_TRADER_PROFILES = AIO_TRADER_PROFILES;
  window._aioGetActiveProfile = function() {
    var profile = null;
    try { profile = localStorage.getItem('aio_trader_profile'); } catch (_) {}
    return profile && AIO_TRADER_PROFILES[profile] ? profile : 'balanced';
  };
  window._aioSetProfile = function(key) {
    if (!key || !AIO_TRADER_PROFILES[key]) key = 'balanced';
    try { localStorage.setItem('aio_trader_profile', key); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent('aio:screener:profile', { detail:key })); } catch (_) {}
  };

  // ── v50.52 Track2: 멀티팩터 랭킹 엔진 (기관/퀀트급) ──
  // 정적 BUY/HOLD 태그(editorial)는 보존하고, 가격 파생 4팩터로 객관적 퀀트 랭크를 부가한다.
  //   momentum(ret1/3/6m) · trend(가격 vs SMA50/200) · low-vol(연율 변동성, 역방향) · size(log mcap).
  //   각 팩터를 섹터 상대 z-score(표본<5면 유니버스 상대) + winsorize(±3σ) → 가중합 → composite rank는 0~100 percentile, factorScores는 섹터 기준 정규화 점수(z 스케일, percentile 아님).
  //   팩터 데이터(screener.json) 없으면 null → 소비자는 정적 signal 폴백(무회귀).
  // v50.54 3A: marketState 기반 가중은 검토용 proposal로만 산출한다.
  //   위험회피/선호/후기사이클 틸트는 live/backtest 정의 패리티와 사람 검토를 거쳐
  //   명시적으로 승격하기 전까지 실제 랭크에 적용하지 않고 NEUTRAL 가중을 유지한다.
  window._aioFactorWeights = function(ms) {
    // P763/ARX-10 follow-up: storage/profile lookup remains here, but deterministic weight math
    // belongs to the native pure module and is shared by native + compatibility consumers.
    var _weightFn = window.AIO_ARCH && typeof window.AIO_ARCH.deriveFactorWeights === 'function' ? window.AIO_ARCH.deriveFactorWeights : null;
    if (!_weightFn) return null;
    // v57.50 C09: the regime input is the 시장 상태 screen's overall verdict (bootstrap), not the legacy marketState.
    if (typeof window._aioScreenRegimeWeightInput === 'function') { try { ms = window._aioScreenRegimeWeightInput(); } catch(_) { ms = null; } }
    try {
      var profileKey = localStorage.getItem('aio_trader_profile');
      if (profileKey && profileKey !== 'balanced' && typeof AIO_TRADER_PROFILES !== 'undefined') {
        var prof = AIO_TRADER_PROFILES[profileKey];
        if (prof && prof.weights) return _weightFn({ marketState: ms || null, profile: prof });
      }
    } catch(_) {}
    return _weightFn({ marketState: ms || null, profile: null });
  };

  return window;
}
