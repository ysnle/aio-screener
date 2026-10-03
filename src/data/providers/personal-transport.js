// P1422: translate only documented FMP contracts. Never invent a year/quarter
// for ownership or transcripts; those inputs must come from their dated source.
export function _aioFmpStableUrls(raw) {
  var u = new URL(raw);
  if (u.hostname !== 'financialmodelingprep.com' || u.protocol !== 'https:') return null;
  if (u.pathname.startsWith('/stable/')) return [u.href];
  var match = u.pathname.match(/^\/api\/v[34]\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (!match) return [];
  var name = match[1], symbol = decodeURIComponent(match[2] || u.searchParams.get('symbol') || '');
  var mapping = {
    profile: 'profile', quote: 'quote', 'income-statement': 'income-statement',
    'balance-sheet-statement': 'balance-sheet-statement', 'cash-flow-statement': 'cash-flow-statement',
    'financial-growth': 'financial-growth', ratios: 'ratios', 'ratios-ttm': 'ratios-ttm',
    'key-metrics': 'key-metrics', 'key-metrics-ttm': 'key-metrics-ttm',
    'enterprise-values': 'enterprise-values', 'key-executives': 'key-executives',
    'revenue-product-segmentation': 'revenue-product-segmentation',
    'revenue-geographic-segmentation': 'revenue-geographic-segmentation',
    'price-target-consensus': 'price-target-consensus', 'analyst-estimates': 'analyst-estimates',
    'discounted-cash-flow': 'discounted-cash-flow', 'stock_peers': 'stock-peers',
    'earnings-surprises': 'earnings', 'analyst-stock-recommendations': 'grades-consensus',
    'insider-trading': 'insider-trading/search'
  };
  if (name === 'institutional-holder') {
    if (!u.searchParams.has('year') || !u.searchParams.has('quarter')) return [];
    mapping[name] = 'institutional-ownership/extract-analytics/holder';
  }
  if (name === 'earning_call_transcript') {
    if (!u.searchParams.has('year') || !u.searchParams.has('quarter')) return [];
    mapping[name] = 'earning-call-transcript';
  }
  if (!mapping[name] || !symbol || !/^[A-Za-z0-9.^=-]+(?:,[A-Za-z0-9.^=-]+)*$/.test(symbol)) return [];
  return symbol.split(',').map(function(ticker) {
    var out = new URL('https://financialmodelingprep.com/stable/' + mapping[name]);
    for (var pair of u.searchParams) if (pair[0] !== 'symbol' && pair[0] !== 'structure') out.searchParams.set(pair[0], pair[1]);
    out.searchParams.set('symbol', ticker);
    if (name === 'analyst-estimates' && !out.searchParams.has('period')) out.searchParams.set('period', 'annual');
    return out.href;
  });
}
export function _aioNormalizeFmpStable(payload, path) {
  if (!Array.isArray(payload)) return payload;
  if (path === '/stable/stock-peers') return [{ peersList: payload.map(function(row) { return row.symbol; }).filter(Boolean) }];
  return payload.map(function(row) {
    var out = Object.assign({}, row);
    var aliases = { mktCap: 'marketCap', changesPercentage: 'changePercentage', calendarYear: 'fiscalYear',
      priceEarningsRatio: 'priceToEarningsRatio', peRatio: 'priceToEarningsRatio',
      priceEarningsToGrowthRatio: 'priceToEarningsGrowthRatio', debtEquityRatio: 'debtToEquityRatio',
      peRatioTTM: 'priceToEarningsRatioTTM', pegRatioTTM: 'priceToEarningsGrowthRatioTTM',
      debtEquityRatioTTM: 'debtToEquityRatioTTM', enterpriseValueOverEBITDATTM: 'enterpriseValueMultipleTTM',
      estimatedRevenueAvg: 'revenueAvg', estimatedEpsAvg: 'epsAvg',
      actualEarningResult: 'epsActual', estimatedEarning: 'epsEstimated' };
    Object.keys(aliases).forEach(function(old) {
      if (out[old] == null && out[aliases[old]] != null) out[old] = out[aliases[old]];
    });
    return out;
  });
}
// P1423: native ownership; the app boundary injects storage and quota policy.
export function createPersonalProviderTransport({ fetch, localStorage, _isQuotaExceeded, _bumpApiCounter, _QUOTA_LIMITS }) {
function fetchWithTimeout(url, opts = {}, ms = 8000) {
  opts = opts || {};
  // P1422: count every personal FMP dispatch, including direct comparison/chart calls.
  // This browser counter is a local guard, not a provider/account billing limit.
  try {
    if (new URL(url, 'https://aio.invalid').hostname === 'financialmodelingprep.com') {
      var stableUrls = _aioFmpStableUrls(url);
      if (!stableUrls || !stableUrls.length) return Promise.resolve(Response.json({ error: 'DATED_SOURCE_PARAMETERS_REQUIRED_OR_UNSUPPORTED_FMP_CONTRACT' }, { status: 422 }));
      if (stableUrls.length > 1) return Promise.all(stableUrls.map(function(item) {
        return fetchWithTimeout(item, opts, ms).then(function(r) { return r.ok ? r.json() : null; });
      })).then(function(rows) { return Response.json(rows.filter(Array.isArray).flat()); });
      url = stableUrls[0];
      if (typeof _isQuotaExceeded === 'function' && _isQuotaExceeded('fmp')) return Promise.resolve(new Response('', { status: 429 }));
      if (typeof _bumpApiCounter === 'function') _bumpApiCounter('fmp');
    }
  } catch (_) { return Promise.resolve(Response.json({ error: 'INVALID_PROVIDER_CONTRACT' }, { status: 422 })); }
  const ctrl = new AbortController();
  const externalSignal = opts.signal;
  const relayAbort = () => { try { ctrl.abort(); } catch(_) {} };
  if (externalSignal) {
    if (externalSignal.aborted) relayAbort();
    else if (typeof externalSignal.addEventListener === 'function') externalSignal.addEventListener('abort', relayAbort, { once: true });
  }
  const timer = setTimeout(() => ctrl.abort(), ms);
  var isFmpRequest = new URL(url, 'https://aio.invalid').hostname === 'financialmodelingprep.com';
  return fetch(url, { ...opts, ...(isFmpRequest ? { redirect: 'error' } : {}), signal: ctrl.signal }).then(async function(response) {
    var parsed = new URL(url, 'https://aio.invalid');
    if (parsed.hostname === 'financialmodelingprep.com' && response.ok) {
      var body = await response.json();
      if (!Array.isArray(body)) return Response.json({ error: 'FMP_DATA_UNAVAILABLE' }, { status: 502 });
      return Response.json(_aioNormalizeFmpStable(body, parsed.pathname), { status: response.status });
    }
    return response;
  }).finally(() => {
    clearTimeout(timer);
    if (externalSignal && typeof externalSignal.removeEventListener === 'function') externalSignal.removeEventListener('abort', relayAbort);
  });
}

function _aioReserveTwelveCredits(weight) {
  // P1422: one /complex_data containing six methods costs six credits, not one.
  // Unknown/failed attempts retain a conservative local reservation.
  if (typeof _isQuotaExceeded !== 'function' || typeof _bumpApiCounter !== 'function') return true;
  try {
    var raw = localStorage.getItem('aio_quota_twelveData');
    var quota = raw ? JSON.parse(raw) : null;
    var today = new Date().toISOString().slice(0, 10);
    if (quota && quota.date === today && quota.count + weight > _QUOTA_LIMITS.twelveData.daily) return false;
  } catch (_) { return false; }
  for (var i = 0; i < weight; i++) {
    if (_isQuotaExceeded('twelveData')) return false;
    _bumpApiCounter('twelveData');
  }
  return true;
}
return { fetchWithTimeout, reserveTwelveCredits: _aioReserveTwelveCredits };
}
