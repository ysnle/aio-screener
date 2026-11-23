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

  window._aioFactorWeights = function(ms) {
    var _weightFn = window.AIO_ARCH && typeof window.AIO_ARCH.deriveFactorWeights === 'function' ? window.AIO_ARCH.deriveFactorWeights : null;
    if (!_weightFn) return null;
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
