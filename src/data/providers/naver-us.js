// v59.26 (roadmap 11, layer 3 providers): the Naver US collector moved out of js/aio-data.js unchanged — the NYSE
// listing set that picks the Reuters suffix (_NAVER_NYSE), the 10-minute cache (_naverUSCache), the Yahoo→Reuters
// code map (_toNaverReuters) and fetchNaverUSData (basic, integration and optional annual finance through fetchViaProxy).
// The names stay window globals for the classic callers (aio-core research checks, aio-chat ticker answers).
// src/app/compatibility-globals.js installs this before DOMContentLoaded.
export function installNaverUsCollector(window = globalThis) {
  var _NAVER_NYSE = 'JPM V XOM MA UNH JNJ HD PG ABBV MRK CVX BAC DIS WMT KO PEP MCD TMO LLY GS MS BMY RTX HON CAT DE UPS IBM GE NKE VZ T PM AXP C WFC PFE ABT DHR LOW SYK BDX ZTS CME ICE APD SHW ECL EMR ETN ITW NSC UNP LMT NOC GD BA F GM SO NEE DUK SPGI MCO BLK MMC AON CL WMB KMI MPC VLO PSX SLB HAL FCX NUE URI DD HCA SYY YUM WM PLD SPG PSA O AEP EXC SRE WEC DOW COP OXY EOG BKR COF BK MET PRU AIG AFL TRV CB RSG TFC PNC USB HUBB GPN OTIS STE VRSK EFX NRG PCAR KHC MCK MAR IQV STZ CNC CI MDLZ BSX TJX GEV VRT DELL HPE GLW CCJ PGR TDG RMD TRGP ROP CARR WELL TSM BABA NVO NVS AZN HSBC TM SHEL RIO BHP UBS UL BUD TTE BP TD RY SONY HUM A'.split(' ').reduce(function(s,t){s[t]=1;return s;},{});

  var _naverUSCache = {};

  // Yahoo 티커 → Naver Reuters 코드 변환
  function _toNaverReuters(sym) {
    if (!sym || /\.\w{1,2}$/.test(sym)) return null; // 한국 종목(.KS/.KQ) 제외
    if (sym === 'BRK-B' || sym === 'BRK.B') return 'BRKb.N';
    return sym + (_NAVER_NYSE[sym] ? '.N' : '.O');
  }

  // Naver US 주식 통합 조회: basic + integration + finance(옵션)
  async function fetchNaverUSData(sym, includeFinance) {
    var ck = sym + (includeFinance ? '_f' : '');
    if (_naverUSCache[ck] && (Date.now() - _naverUSCache[ck]._ts < 600000)) return _naverUSCache[ck];
    var code = _toNaverReuters(sym);
    if (!code) return null;
    var base = 'https://api.stock.naver.com/stock/' + code;
    try {
      var ps = [
        fetchViaProxy(base + '/basic', 5000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
        fetchViaProxy(base + '/integration', 5000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
      ];
      if (includeFinance) ps.push(fetchViaProxy(base + '/finance/annual', 5000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}));
      // v48.94 P159: Promise.allSettled — 1개 실패 시 나머지 결과 보존
      var res = await Promise.allSettled(ps);
      var basic = (res[0].status === 'fulfilled') ? res[0].value : null;
      var integ = (res[1].status === 'fulfilled') ? res[1].value : null;
      var fin   = (res[2] && res[2].status === 'fulfilled') ? res[2].value : null;
      if (!basic && !integ) return null;

      var result = { _ts: Date.now(), _code: code };

      // Basic: 한국어명, 로고, 업종, 거래소
      if (basic) {
        result.nameKr = basic.stockName || null;
        result.logoUrl = basic.itemLogoPngUrl || null;
        result.industryKr = basic.industryCodeType ? basic.industryCodeType.industryGroupKor : null;
        result.exchange = basic.stockExchangeName || null;
      }

      // Integration → 컨센서스 (목표가, 추천등급)
      if (integ && integ.consensusInfo && integ.consensusInfo.priceTargetMean) {
        var ci = integ.consensusInfo;
        // v59.45 (R2-04): parseFloat('1,105.20') is 1, which read as a −99.9% upside; drop thousands separators first.
        var num = function(v) { var n = Number(String(v == null ? '' : v).replace(/,/g, '').trim()); return Number.isFinite(n) && n > 0 ? n : null; };
        result.consensus = {
          recommMean: num(ci.recommMean),
          targetMean: num(ci.priceTargetMean),
          targetHigh: num(ci.priceTargetHigh),
          targetLow: num(ci.priceTargetLow),
          date: ci.createDate || null
        };
      }

      // Integration → 기업개요 (한국어)
      if (integ && integ.corporateOverview) result.overview = integ.corporateOverview;

      // Integration → 경영진/직원
      if (integ && integ.summaries) {
        result.ceo = integ.summaries.representativeName || null;
        result.employees = integ.summaries.employees || null;
      }

      // Integration → 동종업계 비교
      if (integ && integ.industryCompareInfo) {
        var gl = integ.industryCompareInfo.globalStocks || [];
        result.peers = gl.slice(0, 6).map(function(s) {
          return { sym: s.symbolCode, name: s.stockName, price: s.closePrice, chg: s.fluctuationsRatio, mcap: s.marketValueHangeul };
        });
      }

      // Finance → 연간 재무제표
      if (fin && fin.rowList) {
        var fd = {};
        fin.rowList.forEach(function(row) {
          var cols = row.columns || {};
          var keys = Object.keys(cols);
          if (keys.length > 0) { var v = cols[keys[keys.length - 1]]; fd[row.title] = v ? v.value : null; }
        });
        result.financials = fd;
        result.finUnit = fin.unit || null;
      }

      _naverUSCache[ck] = result;
      return result;
    } catch(e) {
      _aioLog('warn', 'fetch', 'Naver US error: ' + sym + ' ' + (e.message || e));
      return null;
    }
  }

  window._NAVER_NYSE = _NAVER_NYSE;
  window._naverUSCache = _naverUSCache;
  window._toNaverReuters = _toNaverReuters;
  window.fetchNaverUSData = fetchNaverUSData;
  return window;
}
