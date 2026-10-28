// v59.28 (roadmap 11, layer 3 providers): the Naver Finance Korea collector moved out of js/aio-data.js unchanged —
// fetchKrNaverQuotes (KOSPI/KOSDAQ indices and every KR_STOCK_DB name, Yahoo-compatible rows) and fetchKrDailyCandles
// (the fchart daily OHLCV series behind the own candle chart). The names stay window globals for the classic callers
// (fetchLiveQuotes, the KR dynamic loader, aio-kr-data). src/app/compatibility-globals.js installs this before
// DOMContentLoaded.
export function installNaverKrCollector(window = globalThis) {
  // ═══ v36: 네이버 파이낸스 — 한국 시장 1차 데이터 소스 ═══════════════════
  // 네이버 API → CORS 프록시 → Yahoo-compatible 포맷 변환
  // 지수(KOSPI/KOSDAQ) + 전 종목(KR_STOCK_DB) 일괄 fetch
  async function fetchKrNaverQuotes(requestedSymbols) {
    var results = [];
    var _startTs = Date.now();

    // ── 1. 지수 데이터 (KOSPI, KOSDAQ) ──
    var indexMap = [
      { naver: 'KOSPI', yahoo: '^KS11' },
      { naver: 'KOSDAQ', yahoo: '^KQ11' }
    ];

    await Promise.allSettled(indexMap.map(async function(idx) {
      var url = 'https://m.stock.naver.com/api/index/' + idx.naver + '/basic';
      try {
        var r = await fetchViaProxy(url, 8000);
        if (!r.ok) return;
        var raw = await r.json();
        var data = raw;
        if (raw.contents) try { data = JSON.parse(raw.contents); } catch(e) { return; }

        // m.stock API 응답: closePrice, compareToPreviousClosePrice, fluctuationsRatio
        var price = parseFloat(String(data.closePrice || data.now || '0').replace(/,/g, ''));
        var chgPct = parseFloat(String(data.fluctuationsRatio ?? data.cr ?? '').replace(/,/g, ''));
        var chgVal = parseFloat(String(data.compareToPreviousClosePrice ?? data.cv ?? '').replace(/,/g, ''));

        if (price > 0) {
          // FABLE-LIVE-AUDIT-2026-07-07 C5/L2-2: Naver의 compareToPreviousClosePrice(부호 포함, 원 단위)로
          // 전일종가를 직접 역산해 첨부. Yahoo ^KS11/^KQ11의 chartPreviousClose는 미국 휴장일 인접 주간에
          // 한 세션 어긋난 값을 돌려주는 경우가 실측됐음(예: 7/3 종가를 7/6 전일종가로 반환) — KR 지수는
          // KRX 소스(Naver)가 항상 정확하므로 이 값을 우선 사용해야 함(아래 병합부에서 sticky 처리).
          var _prevClose = isFinite(chgVal) ? (price - chgVal) : null;
          results.push({
            symbol: idx.yahoo,
            regularMarketPrice: price,
            regularMarketChangePercent: chgPct,
            regularMarketChange: chgVal,
            regularMarketPreviousClose: (_prevClose > 0 ? _prevClose : undefined),
             _source: 'live:naver', sourceKind: 'T3_PUBLIC_DELAYED', allowedUse: 'reference-only', allowedUseCeiling: 'reference', rightsId: 'PUBLIC_REFERENCE', qualityStatus: 'CURRENT', quality: { status: 'CURRENT', stale: false, decisionUse: false, allowedUse: 'reference' }
          });
        }
      } catch(e) { _aioLog('warn', 'fetch', 'KR-Naver 지수 ' + idx.naver + ' 실패: ' + e.message); }
    }));

    // ── 2. 전 종목 가격 (배치 요청) ──
    var allCodes = (typeof KR_STOCK_DB !== 'undefined') ? Object.keys(KR_STOCK_DB) : [];
    var scopedCodes = Array.isArray(requestedSymbols) ? new Set(requestedSymbols.map(function(symbol) {
      return String(symbol || '').replace(/\.(KS|KQ)$/i, '');
    }).filter(function(code) { return /^\d{6}$/.test(code); })) : null;
    if (scopedCodes) allCodes = Array.from(scopedCodes);
    var BATCH_SIZE = 20; // polling API 배치 크기

    for (var bi = 0; bi < allCodes.length; bi += BATCH_SIZE) {
      var batch = allCodes.slice(bi, bi + BATCH_SIZE);
      var codeStr = batch.join(',');
      var batchOk = false;

      // polling API (배치 지원) 먼저 시도
      var batchUrl = 'https://polling.finance.naver.com/api/realtime/domestic/stock/' + codeStr;
      try {
        var r = await fetchViaProxy(batchUrl, 10000);
        if (r.ok) {
          var raw = await r.json();
          var data = raw;
          if (raw.contents) try { data = JSON.parse(raw.contents); } catch(e) {}

          // polling API 응답 파싱 (다중 포맷 지원)
          var datas = null;
          if (data.result && data.result.areas && data.result.areas[0]) {
            datas = data.result.areas[0].datas;
          } else if (data.datas) {
            datas = data.datas;
          } else if (Array.isArray(data)) {
            datas = data;
          }

          if (datas && datas.length > 0) {
            datas.forEach(function(d) {
              var code = d.cd || d.symbolCode || '';
              var price = parseFloat(String(d.nv || d.closePrice || '0').replace(/,/g, ''));
              var chgPct = parseFloat(String(d.cr ?? d.fluctuationsRatio ?? '').replace(/,/g, ''));
              var chgVal = parseFloat(String(d.cv ?? d.compareToPreviousClosePrice ?? '').replace(/,/g, ''));

              // v46.4: 가격/등락률 유효성 검증
              if (!isFinite(price)) price = 0;
              if (!isFinite(chgPct) || Math.abs(chgPct) > 30) chgPct = null; // 한국 상한가 ±30%
              if (!isFinite(chgVal)) chgVal = null;

              if (code && batch.includes(String(code)) && price > 0) {
                var yahooSym = krTickerToYahoo(code);
                results.push({
                  symbol: yahooSym,
                  regularMarketPrice: price,
                  regularMarketChangePercent: chgPct,
                  regularMarketChange: chgVal,
                   _source: 'live:naver', sourceKind: 'T3_PUBLIC_DELAYED', allowedUse: 'reference-only', allowedUseCeiling: 'reference', rightsId: 'PUBLIC_REFERENCE', qualityStatus: 'CURRENT', quality: { status: 'CURRENT', stale: false, decisionUse: false, allowedUse: 'reference' }
                });
              }
            });
            batchOk = true;
          }
        }
      } catch(e) { /* polling batch 실패 — m.stock 개별 폴백 */ }

      // 배치 실패 시 m.stock 개별 요청 폴백 (v46.3: 5→10개로 확대, 가중치 높은 종목 우선)
      if (!batchOk) {
        var fallbackBatch = batch.slice(0, 10);
        await Promise.allSettled(fallbackBatch.map(async function(code) {
          var url = 'https://m.stock.naver.com/api/stock/' + code + '/basic';
          try {
            var r = await fetchViaProxy(url, 6000);
            if (!r.ok) return;
            var raw = await r.json();
            var data = raw;
            if (raw.contents) try { data = JSON.parse(raw.contents); } catch(e) { return; }

            var price = parseFloat(String(data.closePrice || data.now || '0').replace(/,/g, ''));
            var chgPct = parseFloat(String(data.fluctuationsRatio ?? data.cr ?? '').replace(/,/g, ''));
            var chgVal = parseFloat(String(data.compareToPreviousClosePrice ?? data.cv ?? '').replace(/,/g, ''));

            if (price > 0) {
              results.push({
                symbol: krTickerToYahoo(code),
                regularMarketPrice: price,
                regularMarketChangePercent: chgPct,
                regularMarketChange: chgVal,
                 _source: 'live:naver-fb', sourceKind: 'T3_PUBLIC_DELAYED', allowedUse: 'reference-only', allowedUseCeiling: 'reference', rightsId: 'PUBLIC_REFERENCE', qualityStatus: 'CURRENT', quality: { status: 'CURRENT', stale: false, decisionUse: false, allowedUse: 'reference' }
              });
            }
          } catch(e) {}
        }));
      }
    }

    // ── 3차/4차 폴백: api.finance.naver.com / fchart.stock.naver.com (v46.3) ──
    // 1차(배치)+2차(개별) 완료 후 아직 데이터 없는 종목에 대해 siseJson 엔드포인트 시도
    var allCodesFlat = [];
    function _aioCollectKrCodes(src) {
      if (!src) return;
      if (Array.isArray(src)) {
        src.forEach(_aioCollectKrCodes);
        return;
      }
      if (typeof src === 'object') {
        if (src.code) allCodesFlat.push(src.code);
        else if (src.symbol && /^[0-9]{6}$/.test(String(src.symbol))) allCodesFlat.push(src.symbol);
        else Object.keys(src).forEach(function(k) {
          // v49.96 P460: KR_STOCK_DB는 코드가 KEY ('103140': {name,price,...})이고 값엔 .code/.symbol 없음.
          // 이전엔 값만 재귀해 6자리 KEY를 놓쳐 0개 추출 → siseJson 최종 폴백 tier 무력화. 키가 6자리 코드면 직접 수집.
          if (/^[0-9]{6}$/.test(k)) allCodesFlat.push(k);
          _aioCollectKrCodes(src[k]);
        });
      }
    }
    if (typeof KR_STOCK_DB !== 'undefined') {
      _aioCollectKrCodes(KR_STOCK_DB);
    }
    if (!allCodesFlat.length && window.AIO && window.AIO.recordDataQualityIssue) {
      window.AIO.recordDataQualityIssue({ source: 'kr-stock-db', severity: 'warn', message: 'KR_STOCK_DB code extraction returned 0 codes' });
    }
    var gotSyms = {};
    results.forEach(function(r) { gotSyms[r.symbol] = true; });
    var missing = allCodesFlat.filter(function(c) { return !gotSyms[krTickerToYahoo(c)]; });
    if (scopedCodes) missing = Array.from(scopedCodes).filter(function(c) { return !gotSyms[krTickerToYahoo(c)]; });

    if (missing.length > 0) {
      var today = new Date();
      var yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 2); // 주말 대비 2일 전
      var fmt = function(d) { return d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0'); };
      var startD = fmt(yesterday), endD = fmt(today);

      var siseEndpoints = [
        {url: 'https://api.finance.naver.com/siseJson.naver', tag: 'live:naver-sise'},
        {url: 'https://fchart.stock.naver.com/siseJson.nhn', tag: 'live:naver-fchart'}
      ];

      // 가중치 상위 20개만 (API 부하 최소화)
      var topMissing = missing.slice(0, 20);

      for (var epIdx = 0; epIdx < siseEndpoints.length; epIdx++) {
        if (topMissing.length === 0) break;
        var ep = siseEndpoints[epIdx];
        var siseResults = [];

        await Promise.allSettled(topMissing.map(async function(code) {
          var sUrl = ep.url + '?symbol=' + code + '&requestType=1&startTime=' + startD + '&endTime=' + endD + '&timeframe=day';
          try {
            // 직접 fetch 시도 (CORS 허용 가능), 실패 시 프록시
            var r;
            try { r = await fetchWithTimeout(sUrl, {}, 5000); } catch(e) { r = await fetchViaProxy(sUrl, 6000); }
            if (!r.ok) return;
            var text = typeof r.text === 'function' ? await r.text() : '';
            if (typeof r.json === 'function' && !text) { var j = await r.json(); text = JSON.stringify(j); }
            // 파싱: ["YYYYMMDD", 시가, 고가, 저가, 종가, 거래량, 외국인소진율]
            var rows = [];
            var rx = /\["(\d{8})",\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\]/g;
            var m;
            while ((m = rx.exec(text)) !== null) {
              rows.push({ date: m[1], open: +m[2], high: +m[3], low: +m[4], close: +m[5], vol: +m[6] });
            }
            if (rows.length === 0) return;
            // v46.4: 파싱 결과 검증 — 가격 유효성 + 범위
            rows = rows.filter(function(r) { return r.close > 0 && isFinite(r.close) && r.open > 0; });
            if (rows.length === 0) return;
            var latest = rows[rows.length - 1];
            var prev = rows.length >= 2 ? rows[rows.length - 2] : null;
            var price = latest.close;
            var pct = prev && prev.close > 0 ? ((price - prev.close) / prev.close * 100) : null;
            // pct 범위 검증: ±30% 이상은 데이터 오류 가능 (한국 상한가 ±30%)
            if (pct != null && (!isFinite(pct) || Math.abs(pct) > 30)) pct = null;

            if (price > 0 && isFinite(price)) {
              siseResults.push({
                symbol: krTickerToYahoo(code),
                regularMarketPrice: price,
                regularMarketChangePercent: pct != null ? +pct.toFixed(2) : null,
                regularMarketChange: prev ? (price - prev.close) : null,
                _source: ep.tag, sourceKind: 'T3_PUBLIC_DELAYED', allowedUse: 'reference-only', allowedUseCeiling: 'reference', rightsId: 'PUBLIC_REFERENCE', qualityStatus: 'CURRENT', quality: { status: 'CURRENT', stale: false, decisionUse: false, allowedUse: 'reference' }
              });
            }
          } catch(e) {}
        }));

        if (siseResults.length > 0) {
          results.push.apply(results, siseResults);
          console.log('[KR-sise] ' + ep.tag + ' 폴백:', siseResults.length + '개 추가');
          // 성공 종목 제거
          var gotNow = {};
          siseResults.forEach(function(r) { gotNow[r.symbol] = true; });
          topMissing = topMissing.filter(function(c) { return !gotNow[krTickerToYahoo(c)]; });
        }
      }
    }

    var elapsed = Date.now() - _startTs;
    console.log('[KR-Naver] 네이버 파이낸스 완료:', results.length + '개 (' + elapsed + 'ms)');
    return results;
  }

  // v52.13 P610/B7: TradingView KRX 위젯 하드 브레이크(FABLE-LIVE-AUDIT-2026-07-04.md P3) 대체용 —
  // Naver fchart 일봉 OHLCV 시리즈 직접 fetch(자체 캔들 차트 렌더용). 파싱 정규식은 위 fetchKrNaverQuotes()의
  // siseJson 폴백 파서와 동일 패턴 재사용(이미 이 코드베이스에서 검증된 방식 — eval/Function 없이 안전 추출).
  async function fetchKrDailyCandles(code, count) {
    code = String(code || '').replace(/\.(KS|KQ)$/i, '').trim();
    count = count || 120;
    if (!/^[0-9]{6}$/.test(code)) return null;
    var url = 'https://fchart.stock.naver.com/siseJson.nhn?symbol=' + code + '&timeframe=day&count=' + count + '&requestType=0';
    try {
      var r;
      try { r = await fetchWithTimeout(url, {}, 6000); } catch (e) { r = await fetchViaProxy(url, 8000); }
      if (!r || !r.ok) return null;
      var text = typeof r.text === 'function' ? await r.text() : '';
      if (typeof r.json === 'function' && !text) { var j = await r.json(); text = JSON.stringify(j); }
      var rows = [];
      var rx = /\["(\d{8})",\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*[\d.]+)?\]/g;
      var m;
      while ((m = rx.exec(text)) !== null) {
        var d = m[1];
        rows.push({
          date: d.slice(0, 4) + '-' + d.slice(4, 6) + '-' + d.slice(6, 8),
          open: +m[2], high: +m[3], low: +m[4], close: +m[5], volume: +m[6]
        });
      }
      rows = rows.filter(function(row) { return row.close > 0 && row.open > 0 && isFinite(row.close); });
      return rows.length ? rows : null; // Naver 응답은 이미 날짜 오름차순
    } catch (e) {
      _aioLog('warn', 'fetch', 'KR 일봉 캔들 fetch 실패(' + code + '): ' + e.message);
      return null;
    }
  }
  window.fetchKrNaverQuotes = fetchKrNaverQuotes;
  window.fetchKrDailyCandles = fetchKrDailyCandles;
  return window;
}
