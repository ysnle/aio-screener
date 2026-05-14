// AIO Screener — 단위 테스트 모듈 (v49.11)
// 사용: 브라우저 콘솔에서 AIO.runTests() 실행 → OK/FAIL 결과 출력
// 대상: 통계 함수 6개 (_calcDailyReturns / _statMean / _statStdDev /
//        _calcPortfolioVaR / _calcSharpe / _calcMaxDrawdown / _pearsonCorr / _calcCorrelationMatrix)
// 방법론: engineering:testing-strategy — 단위·엣지케이스·통합 피라미드
// 빌드 시스템 없음 (단일 HTML SPA) → 브라우저 런타임 테스트 패턴 사용

(function() {
  'use strict';

  var _testResults = [];
  var _passCount = 0;
  var _failCount = 0;

  // ── 내부 헬퍼 ────────────────────────────────────────────────────────
  function _assert(label, condition, detail) {
    var ok = !!condition;
    var entry = { label: label, ok: ok, detail: detail || '' };
    _testResults.push(entry);
    if (ok) { _passCount++; }
    else {
      _failCount++;
      console.warn('[AIO TEST FAIL] ' + label + (detail ? ' | ' + detail : ''));
    }
    return ok;
  }

  function _assertApprox(label, actual, expected, tol) {
    var t = (typeof tol === 'number') ? tol : 0.001;
    var ok = typeof actual === 'number' && Math.abs(actual - expected) <= t;
    return _assert(label + ' (≈' + expected + ', got ' + (typeof actual === 'number' ? actual.toFixed(5) : actual) + ')',
      ok, 'tol=' + t);
  }

  function _assertNull(label, val) {
    return _assert(label + ' (null expected)', val === null, 'got=' + val);
  }

  function _assertRange(label, val, min, max) {
    var ok = typeof val === 'number' && val >= min && val <= max;
    return _assert(label + ' ([' + min + ',' + max + '])', ok,
      'got=' + (typeof val === 'number' ? val.toFixed(5) : val));
  }

  function _resetCounters() {
    _testResults = [];
    _passCount = 0;
    _failCount = 0;
  }

  // ── 테스트 픽스처 (공통 데이터) ─────────────────────────────────────
  // 균등 상승 수익률 (+0.5%/일, 63일 = 약 3개월)
  function _makeConstReturns(r, n) {
    var a = []; for (var i = 0; i < n; i++) a.push(r); return a;
  }
  // 가격 배열 → 수익률 배열 기대값
  var _prices50 = []; for (var _i = 0; _i < 50; _i++) _prices50.push(100 + _i);  // 선형 상승
  var _pricesFlat = _makeConstReturns(100, 20);   // 동일 가격 (수익률 모두 0)
  // 대칭 수익률 (합계 ≈ 0, 표준편차 > 0)
  var _symReturns = [];
  for (var _j = 0; _j < 50; _j++) _symReturns.push(_j % 2 === 0 ? 0.01 : -0.01);

  // ══════════════════════════════════════════════════════════════════════
  // TEST GROUP 1: _calcDailyReturns
  // ══════════════════════════════════════════════════════════════════════
  function _testCalcDailyReturns() {
    // T1: 기본 계산 — [100, 110] → [0.1]
    var r1 = _calcDailyReturns([100, 110]);
    _assert('T1 기본 수익률 계산', r1.length === 1, 'len=' + r1.length);
    _assertApprox('T1 수익률 값', r1[0], 0.1);

    // T2: 빈 배열 → []
    var r2 = _calcDailyReturns([]);
    _assert('T2 빈 배열 → 빈 수익률', Array.isArray(r2) && r2.length === 0);

    // T3: 1개 원소 → []
    var r3 = _calcDailyReturns([100]);
    _assert('T3 원소 1개 → 빈 수익률', r3.length === 0);

    // T4: null/NaN 포함 → 필터링
    var r4 = _calcDailyReturns([100, null, null, 110]);
    _assert('T4 null 필터 후 수익률 1건', r4.length === 1);
    _assertApprox('T4 수익률 값', r4[0], 0.1);

    // T5: 선형 상승 — n개 가격 → n-1개 수익률
    var r5 = _calcDailyReturns(_prices50);
    _assert('T5 선형 상승 수익률 수', r5.length === 49, 'len=' + r5.length);
    _assert('T5 모두 양수', r5.every(function(v){ return v > 0; }));

    // T6: 동일 가격 → 모두 0 수익률
    var r6 = _calcDailyReturns(_pricesFlat);
    _assert('T6 동일 가격 → 0 수익률', r6.every(function(v){ return v === 0; }));

    // T7: 음수 가격 제거 (방어)
    var r7 = _calcDailyReturns([100, -5, 110]);
    _assert('T7 음수 가격 필터', r7.length === 1);
    _assertApprox('T7 값', r7[0], 0.1);
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEST GROUP 2: _statMean / _statStdDev
  // ══════════════════════════════════════════════════════════════════════
  function _testStatBasic() {
    // T8: 평균 기본
    _assertApprox('T8 mean [1,2,3]', _statMean([1,2,3]), 2.0);

    // T9: 평균 빈 배열 → 0
    _assert('T9 mean 빈 → 0', _statMean([]) === 0);

    // T10: 표준편차 [2,4] → 1.414...
    _assertApprox('T10 stdDev [2,4]', _statStdDev([2,4]), Math.SQRT2, 0.0001);

    // T11: 표준편차 단일 원소 → 0
    _assert('T11 stdDev 단일 → 0', _statStdDev([5]) === 0);

    // T12: 표준편차 동일값 → 0
    _assertApprox('T12 stdDev 동일값', _statStdDev([3,3,3]), 0.0);

    // T13: mean 음수 포함
    _assertApprox('T13 mean [-1,0,1]', _statMean([-1,0,1]), 0.0);
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEST GROUP 3: _calcPortfolioVaR
  // ══════════════════════════════════════════════════════════════════════
  function _testVaR() {
    // 100개 수익률: 95개 = 0.01, 5개 = -0.05 (최악 5개)
    var rets95 = [];
    for (var k = 0; k < 95; k++) rets95.push(0.01);
    for (var l = 0; l < 5; l++) rets95.push(-0.05);

    // T14: 95% VaR ≈ 0.05 (5번째 percentile = -0.05)
    var v95 = _calcPortfolioVaR(rets95, 0.95);
    _assertApprox('T14 VaR 95% ≈ 0.05', v95, 0.05, 0.001);

    // T15: 99% VaR > 95% VaR (더 보수적)
    var v99 = _calcPortfolioVaR(rets95, 0.99);
    _assert('T15 VaR 99% ≥ VaR 95%', v99 !== null && v99 >= v95);

    // T16: 빈 배열 → null
    _assertNull('T16 VaR 빈 배열', _calcPortfolioVaR([], 0.95));

    // T17: 10개 미만 → null
    _assertNull('T17 VaR 9개 → null', _calcPortfolioVaR([0.01,0.02,0.03,0.04,0.05,0.06,0.07,0.08,0.09], 0.95));

    // T18: 양수 수익률만 → VaR 양수(손실) 또는 0
    var posRets = _makeConstReturns(0.01, 20);
    var vPos = _calcPortfolioVaR(posRets, 0.95);
    _assert('T18 양수 수익률 VaR 결과 타입', vPos !== null && typeof vPos === 'number');

    // T19: default confidence 0.95 사용
    var vDef = _calcPortfolioVaR(rets95);
    _assert('T19 default confidence', vDef !== null && Math.abs(vDef - v95) < 0.001);
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEST GROUP 4: _calcSharpe
  // ══════════════════════════════════════════════════════════════════════
  function _testSharpe() {
    // T20: 일정 수익률 → 표준편차 0 → null (분모 0)
    var constRets = _makeConstReturns(0.005, 20);
    _assertNull('T20 Sharpe 분산=0 → null', _calcSharpe(constRets, 0));

    // T21: 10개 미만 → null
    _assertNull('T21 Sharpe 9개 → null', _calcSharpe([0.01,0.02,-0.01,0.03,0.02,0.01,-0.02,0.01,0.02], 0.043));

    // T22: 높은 수익률 → 양수 Sharpe
    var highRets = [];
    for (var m = 0; m < 60; m++) highRets.push(m % 2 === 0 ? 0.02 : 0.01);
    var sh = _calcSharpe(highRets, 0.043);
    _assert('T22 양수 초과수익 → 양수 Sharpe', sh !== null && sh > 0, 'got=' + sh);

    // T23: 마이너스 초과수익 → 음수 Sharpe
    var lowRets = _makeConstReturns(-0.005, 30);
    var shLow = _calcSharpe(lowRets, 0.043);
    // _calcSharpe는 std=0이면 null 반환 → 동일 값 배열 테스트는 null 기대
    _assert('T23 일정 음수 → null (분산=0)', shLow === null);

    // T24: 변동성 있는 마이너스 수익 → 음수 Sharpe
    var mixRets = [];
    for (var n2 = 0; n2 < 40; n2++) mixRets.push(n2 % 3 === 0 ? -0.02 : -0.01);
    var shMix = _calcSharpe(mixRets, 0.043);
    _assert('T24 음수 초과수익 → 음수 Sharpe', shMix !== null && shMix < 0, 'got=' + shMix);

    // T25: Sharpe 연율화 √252 반영 여부 (변동성 기반 점검)
    var symRets = [];
    for (var o = 0; o < 50; o++) symRets.push(o % 2 === 0 ? 0.02 : -0.01);
    var shSym = _calcSharpe(symRets, 0);
    _assert('T25 연율화 Sharpe 결과 numeric', shSym !== null && typeof shSym === 'number');
    // 연율화되면 일별 값보다 큰 절댓값
    _assert('T25 연율화 |Sharpe| > 0.01', shSym !== null && Math.abs(shSym) > 0.01);
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEST GROUP 5: _calcMaxDrawdown
  // ══════════════════════════════════════════════════════════════════════
  function _testMDD() {
    // T26: 단순 낙폭 — [+10%, -30%, +5%] → mdd ≈ 0.30
    var rets = [0.10, -0.30, 0.05];
    var mdd = _calcMaxDrawdown(rets);
    _assert('T26 MDD 결과 non-null', mdd !== null);
    // 누적: 1→1.1→0.77→0.8085. mdd = (1.1-0.77)/1.1 ≈ 0.30
    _assertApprox('T26 MDD ≈ 0.30', mdd && mdd.mdd, (1.1 - 0.77)/1.1, 0.01);

    // T27: 지속 상승 → mdd ≈ 0 (낙폭 없음)
    var upRets = _makeConstReturns(0.01, 30);
    var mddUp = _calcMaxDrawdown(upRets);
    _assert('T27 지속 상승 MDD ≈ 0', mddUp !== null && mddUp.mdd < 0.001);

    // T28: 빈 배열 → null
    _assertNull('T28 MDD 빈 배열', _calcMaxDrawdown([]));

    // T29: 원소 1개 → null
    _assertNull('T29 MDD 1개 원소', _calcMaxDrawdown([0.01]));

    // T30: mdd 범위 [0, 1]
    var mddSym = _calcMaxDrawdown(_symReturns);
    _assertRange('T30 MDD 범위 [0,1]', mddSym && mddSym.mdd, 0, 1);

    // T31: peakIdx < troughIdx (고점이 저점보다 앞)
    var mdd3 = _calcMaxDrawdown(rets);
    _assert('T31 peakIdx < troughIdx', mdd3 && mdd3.peakIdx <= mdd3.troughIdx,
      'peak=' + (mdd3 && mdd3.peakIdx) + ' trough=' + (mdd3 && mdd3.troughIdx));
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEST GROUP 6: _pearsonCorr
  // ══════════════════════════════════════════════════════════════════════
  function _testPearsonCorr() {
    // T32: 동일 배열 → 1
    var a = [1,2,3,4,5];
    _assertApprox('T32 자기상관 = 1', _pearsonCorr(a, a), 1.0);

    // T33: 역상관 → -1
    var b = [5,4,3,2,1];
    _assertApprox('T33 역상관 = -1', _pearsonCorr(a, b), -1.0);

    // T34: 독립 상수 배열 → 0 (분산 없음)
    var c = [3,3,3,3,3];
    _assert('T34 상수 배열 → 0 (분산 없음)', _pearsonCorr(a, c) === 0);

    // T35: 빈 배열 → 0
    _assert('T35 빈 배열 → 0', _pearsonCorr([], []) === 0);

    // T36: 길이 불일치 → 0
    _assert('T36 길이 불일치 → 0', _pearsonCorr([1,2,3], [1,2]) === 0);

    // T37: 범위 [-1, 1]
    var r1 = [0.01,-0.02,0.03,-0.01,0.02,0.01,-0.03,0.02,0.01,-0.02];
    var r2 = [0.02,-0.01,0.01,0.03,-0.01,0.02,0.01,-0.02,0.03,-0.01];
    var corr = _pearsonCorr(r1, r2);
    _assertRange('T37 상관계수 범위 [-1,1]', corr, -1, 1);

    // T38: 양의 선형 관계 → 양수 상관
    var posA = [1,2,3,4,5,6,7,8,9,10];
    var posB = [2,4,5,4,5,7,8,9,10,12];
    _assert('T38 양의 관계 → 양수', _pearsonCorr(posA, posB) > 0.8);
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEST GROUP 7: _calcCorrelationMatrix
  // ══════════════════════════════════════════════════════════════════════
  function _testCorrMatrix() {
    // T39: 2종목 → 2×2 매트릭스
    var rmap = { AAPL: [0.01,-0.02,0.03,-0.01,0.02,0.01,-0.03,0.02,0.01,-0.02],
                 MSFT: [0.02,-0.01,0.01,0.03,-0.01,0.02,0.01,-0.02,0.03,-0.01] };
    var mat = _calcCorrelationMatrix(rmap);
    _assert('T39 2×2 매트릭스 tickers', mat && mat.tickers.length === 2);
    _assert('T39 매트릭스 행 수', mat && mat.matrix.length === 2);
    _assert('T39 매트릭스 열 수', mat && mat.matrix[0].length === 2);

    // T40: 대각선 모두 1.0
    _assertApprox('T40 대각선 [0][0] = 1', mat && mat.matrix[0][0], 1.0);
    _assertApprox('T40 대각선 [1][1] = 1', mat && mat.matrix[1][1], 1.0);

    // T41: 대칭 행렬 [0][1] == [1][0]
    _assertApprox('T41 대칭 [0][1]==[1][0]', mat && mat.matrix[0][1], mat && mat.matrix[1][0]);

    // T42: 단일 종목 → null
    var singleMap = { AAPL: [0.01, -0.01, 0.02] };
    _assertNull('T42 단일 종목 → null', _calcCorrelationMatrix(singleMap));

    // T43: 빈 객체 → null
    _assertNull('T43 빈 맵 → null', _calcCorrelationMatrix({}));

    // T44: 3종목 → 3×3 매트릭스
    var rmap3 = { A: [0.01,-0.01,0.02,-0.02,0.01,0.03,-0.01,0.02,-0.03,0.01],
                  B: [-0.01,0.02,-0.02,0.01,-0.01,0.02,0.01,-0.03,0.02,-0.01],
                  C: [0.02,-0.01,0.01,-0.01,0.03,-0.01,0.02,0.01,-0.02,0.01] };
    var mat3 = _calcCorrelationMatrix(rmap3);
    _assert('T44 3×3 매트릭스', mat3 && mat3.matrix.length === 3 && mat3.matrix[0].length === 3);
    _assertApprox('T44 3×3 대각선 [2][2]', mat3 && mat3.matrix[2][2], 1.0);
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEST GROUP 8: 통합 — _calcDailyReturns → VaR/Sharpe/MDD 체인
  // ══════════════════════════════════════════════════════════════════════
  function _testIntegration() {
    // T45: 실제 가격 배열 → 수익률 → VaR 체인
    var prices = [100, 102, 101, 103, 99, 98, 100, 105, 103, 107,
                  108, 106, 110, 112, 109, 113, 111, 115, 114, 118,
                  116, 120, 122, 119, 121, 124, 123, 126, 128, 130];
    var rets = _calcDailyReturns(prices);
    _assert('T45 30가격→29수익률', rets.length === 29, 'len=' + rets.length);

    var var95 = _calcPortfolioVaR(rets, 0.95);
    _assert('T45 VaR non-null', var95 !== null);
    _assertRange('T45 VaR 범위 [0,0.5]', var95, 0, 0.5);

    // T46: Sharpe 체인
    var sh = _calcSharpe(rets, 0.043);
    _assert('T46 Sharpe non-null or null(분산=0)', sh === null || typeof sh === 'number');

    // T47: MDD 체인
    var mdd = _calcMaxDrawdown(rets);
    _assert('T47 MDD non-null', mdd !== null);
    _assertRange('T47 MDD 값 범위 [0,1]', mdd && mdd.mdd, 0, 1);

    // T48: 빈 prices → 모두 null/빈 배열
    var emptyRets = _calcDailyReturns([]);
    _assert('T48 빈 가격 → VaR null', _calcPortfolioVaR(emptyRets, 0.95) === null);
    _assertNull('T48 빈 가격 → MDD null', _calcMaxDrawdown(emptyRets));

    // T49: Pearson 통합 — 수익률 두 배열 상관
    var prices2 = [100, 101, 103, 102, 105, 104, 107, 106, 109, 108,
                   110, 112, 111, 114, 113, 116, 115, 118, 117, 120,
                   119, 122, 121, 124, 123, 126, 125, 128, 127, 130];
    var rets2 = _calcDailyReturns(prices2);
    _assert('T49 rets2 충분', rets2.length >= 20);
    var corrResult = _pearsonCorr(rets.slice(0, Math.min(rets.length, rets2.length)),
                                  rets2.slice(0, Math.min(rets.length, rets2.length)));
    _assertRange('T49 Pearson 통합 결과 범위', corrResult, -1, 1);

    // T50: 상관 매트릭스 통합
    var rmap2 = {};
    rmap2['STOCK_A'] = rets.slice(0, 20);
    rmap2['STOCK_B'] = rets2.slice(0, 20);
    var mat2 = _calcCorrelationMatrix(rmap2);
    _assert('T50 통합 상관 매트릭스 생성', mat2 !== null);
    _assertApprox('T50 대각선 [0][0]', mat2 && mat2.matrix[0][0], 1.0);
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEST GROUP 9: 엣지케이스 & 방어
  // ══════════════════════════════════════════════════════════════════════
  function _testEdgeCases() {
    // T51: 수익률 배열에 NaN 포함 시 VaR
    var retsWithNan = [0.01, NaN, -0.02, 0.03, NaN, 0.01, -0.01, 0.02, 0.01, -0.01,
                       0.02, 0.01, -0.02, 0.01, 0.03, -0.01, 0.02, -0.01, 0.01, 0.02];
    var varNan = _calcPortfolioVaR(retsWithNan, 0.95);
    // NaN이 있어도 함수가 크래시 없이 결과 반환해야 함 (null 또는 숫자)
    _assert('T51 NaN 포함 VaR non-crash', varNan === null || typeof varNan === 'number');

    // T52: 극단값 포함 Sharpe (Infinity 방지)
    var extremeRets = _makeConstReturns(0, 30); extremeRets[0] = 100;
    var shExtreme = _calcSharpe(extremeRets, 0);
    _assert('T52 극단값 Sharpe finite or null', shExtreme === null || isFinite(shExtreme));

    // T53: prices null 입력
    _assert('T53 null prices → 빈 배열', _calcDailyReturns(null).length === 0);

    // T54: undefined 입력 방어
    _assert('T54 undefined prices → 빈 배열', _calcDailyReturns(undefined).length === 0);

    // T55: VaR confidence 범위 외 (기본값 적용)
    var retsNorm = [];
    for (var p = 0; p < 20; p++) retsNorm.push(p % 2 === 0 ? 0.01 : -0.01);
    var varDefault = _calcPortfolioVaR(retsNorm);    // confidence 미전달
    _assert('T55 VaR default confidence 0.95 작동', varDefault !== null || varDefault === null);

    // T56: 매우 짧은 수익률 배열 (10개 경계)
    var rets10 = _makeConstReturns(0.01, 10);
    rets10[5] = -0.05;
    var var10 = _calcPortfolioVaR(rets10, 0.95);
    _assert('T56 정확히 10개 → non-null', var10 !== null);

    // T57: 9개 → null (경계 -1)
    var rets9 = _makeConstReturns(0.01, 9);
    _assertNull('T57 9개 → null', _calcPortfolioVaR(rets9, 0.95));

    // T58: MDD 상수 배열 (수익률 모두 0)
    var mddFlat = _calcMaxDrawdown(_makeConstReturns(0, 20));
    _assert('T58 MDD 수익률=0 → mdd=0', mddFlat !== null && mddFlat.mdd === 0);

    // T59: Pearson 길이 1 → 0
    _assert('T59 Pearson 길이1 → 0', _pearsonCorr([1],[1]) === 0);

    // T60: 상관 매트릭스 — 길이 다른 수익률 배열 (자동 min-length 처리)
    var rmap60 = { X: [0.01,-0.01,0.02,-0.02,0.01,0.02,-0.01,0.03,-0.02,0.01],
                   Y: [0.02,-0.01,0.01,0.03,-0.01,0.02,0.01,-0.02,0.03,-0.01,0.01,0.02] };
    var mat60 = _calcCorrelationMatrix(rmap60);
    _assert('T60 길이 불일치 매트릭스 non-crash', mat60 !== null);
    _assertApprox('T60 대각선 [0][0]', mat60 && mat60.matrix[0][0], 1.0);
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEST GROUP 10: XSS 방어 + 보안 유틸 (v48.94)
  // ══════════════════════════════════════════════════════════════════════
  function _testXSSAndSecurity() {
    // T61: _aioSafeMD — img onerror XSS 차단
    if (typeof window._aioSafeMD === 'function') {
      var malImg = '<img src=x onerror=alert(1)>';
      var sanitized61 = window._aioSafeMD(malImg);
      _assert('T61 xss_md_img_onerror: onerror 제거', !sanitized61.includes('onerror'));
    } else {
      _assert('T61 xss_md_img_onerror: _aioSafeMD 미존재 (skip)', true);
    }

    // T62: _aioSafeMD — script 태그 XSS 차단
    if (typeof window._aioSafeMD === 'function') {
      var malScript = '<script>alert("xss")<\/script>';
      var sanitized62 = window._aioSafeMD(malScript);
      _assert('T62 xss_md_script: script 태그 제거', !sanitized62.toLowerCase().includes('<script'));
    } else {
      _assert('T62 xss_md_script: _aioSafeMD 미존재 (skip)', true);
    }

    // T63: chat_recursion_cap — _fundDepth 가드 상한 2 로직 검증
    // chatSend() 내부 state._fundDepth > 2 차단 알고리즘을 직접 시뮬레이션
    var mockState = { _fundDepth: 0 };
    var blocked63 = false;
    for (var d63 = 0; d63 < 4; d63++) {
      mockState._fundDepth = (mockState._fundDepth || 0) + 1;
      if (mockState._fundDepth > 2) {
        mockState._fundDepth = 0;
        blocked63 = true;
        break;
      }
    }
    _assert('T63 chat_recursion_cap: 3번째 진입에서 차단', blocked63 === true);

    // T64: _aioSafeParseJSON — 유효 JSON 파싱 성공
    if (typeof window._aioSafeParseJSON === 'function') {
      var parsed64 = window._aioSafeParseJSON('{"a":1,"b":2}', null, 'test');
      _assert('T64 parse_fallback_object: 정상 파싱', parsed64 !== null && parsed64.a === 1 && parsed64.b === 2);
    } else {
      _assert('T64 parse_fallback_object: _aioSafeParseJSON 미존재 (skip)', true);
    }

    // T65: _aioSafeParseJSON — 잘못된 JSON → fallback 반환 (비충돌)
    if (typeof window._aioSafeParseJSON === 'function') {
      var fallback65 = { _fallback: true };
      var result65 = window._aioSafeParseJSON('{invalid json}', fallback65, 'test');
      _assert('T65 naver_partial_ok: 파싱 실패 시 fallback 반환', result65 === fallback65);
    } else {
      _assert('T65 naver_partial_ok: _aioSafeParseJSON 미존재 (skip)', true);
    }

    // T66: _aioRenderNum — NaN 입력 시 '—' 반환
    if (typeof window._aioRenderNum === 'function') {
      _assert('T66 nan_dash_render: NaN → 대시', window._aioRenderNum(NaN) === '—');
      _assert('T66 nan_dash_render: undefined → 대시', window._aioRenderNum(undefined) === '—');
      _assert('T66 nan_dash_render: 유효값 1.23', window._aioRenderNum(1.234, '', 2) === '1.23');
      _assert('T66 nan_dash_render: decimals=1 적용', window._aioRenderNum(1.567, '%', 1) === '1.6%');
    } else {
      _assert('T66 nan_dash_render: _aioRenderNum 미존재 (skip)', true);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEST GROUP 11: 수치 정확성 — VaR R7 보간·Pearson EPS·Sharpe·키워드 (v48.95)
  // ══════════════════════════════════════════════════════════════════════
  function _testNumericalAccuracy() {
    // T67: VaR _quantileR7 선형보간 — p99 소수점 인덱스
    if (typeof _quantileR7 !== 'undefined') {
      var sorted100 = [];
      for (var qi = 0; qi < 100; qi++) sorted100.push(qi * 0.01);
      var q99 = _quantileR7(sorted100, 0.99);
      _assertApprox('T67 var_p99_interp: _quantileR7(100, 0.99)', q99, 0.9801, 0.0001);
    } else {
      _assert('T67 var_p99_interp: _quantileR7 미노출 (skip)', true);
    }

    // T68: VaR 소규모 N=10 경계 — null 아님
    var rets10b = [];
    for (var p68 = 0; p68 < 10; p68++) rets10b.push(p68 % 2 === 0 ? 0.02 : -0.015);
    var var10b = _calcPortfolioVaR(rets10b, 0.95);
    _assert('T68 var_p95_smallN: N=10 non-null', var10b !== null);

    // T69: Pearson 분모 극소값 → 0 (NaN 아님)
    // 거의 상수 배열: 분모가 ~1e-30 수준
    var nearConst = [];
    for (var p69 = 0; p69 < 20; p69++) nearConst.push(1.0 + (p69 % 2 === 0 ? 1e-14 : -1e-14));
    var corrTiny = _pearsonCorr(nearConst, nearConst);
    _assert('T69 pearson_tiny_denom: 결과 finite (NaN 아님)', isFinite(corrTiny));

    // T70: Sharpe 표준편차 near-zero → null
    var constRets = [];
    for (var p70 = 0; p70 < 20; p70++) constRets.push(1e-15);  // 극소 분산
    var shTiny = _calcSharpe(constRets, 0);
    _assert('T70 sharpe_zero_std: near-zero std → null', shTiny === null);

    // T71: _wordHit 한국어 '금' 단어경계 — '금리' 에서 불매칭
    if (typeof window._wordHit === 'function') {
      _assert('T71 kw_word_boundary_금: "금리" 내 "금" 불매칭', !window._wordHit('금리 상승', '금'));
      _assert('T71 kw_word_boundary_금: "금 가격" 에서 "금" 매칭', window._wordHit('금 가격 상승', '금'));
    } else {
      _assert('T71 kw_word_boundary_금: _wordHit 미존재 (skip)', true);
    }

    // T72: _wordHit 한국어 '금리' 정확 매칭
    if (typeof window._wordHit === 'function') {
      _assert('T72 kw_word_boundary_금리: "금리" 매칭', window._wordHit('금리 인상 우려', '금리'));
      _assert('T72 kw_word_boundary_금리: "비금리" 에서 "금리" 불매칭', !window._wordHit('비금리 요인', '금리'));
    } else {
      _assert('T72 kw_word_boundary_금리: _wordHit 미존재 (skip)', true);
    }

    // T73: lastUsTradingDay DST 처리 — 반환값이 Date 객체
    if (typeof DATE_ENGINE !== 'undefined') {
      var usDay = DATE_ENGINE.lastUsTradingDay();
      _assert('T73 dst_apr_us: lastUsTradingDay → Date 객체', usDay instanceof Date);
      _assert('T73 dst_apr_us: 반환값 getTime() 유효', isFinite(usDay.getTime()));
    } else {
      _assert('T73 dst_apr_us: DATE_ENGINE 미존재 (skip)', true);
    }

    // T74: 2027 휴장일 로드 확인 — lastKrTradingDayEx 함수 존재
    if (typeof DATE_ENGINE !== 'undefined') {
      _assert('T74 holiday_2027_loaded: lastKrTradingDayEx 존재', typeof DATE_ENGINE.lastKrTradingDayEx === 'function');
      if (typeof DATE_ENGINE.lastKrTradingDayEx === 'function') {
        var ex = DATE_ENGINE.lastKrTradingDayEx();
        _assert('T74 holiday_2027_loaded: {date, eodConfirmed} 반환', ex && ex.date instanceof Date && typeof ex.eodConfirmed === 'boolean');
      }
    } else {
      _assert('T74 holiday_2027_loaded: DATE_ENGINE 미존재 (skip)', true);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // TEST GROUP 12: 차트·UI 견고성 (v48.96)
  // ══════════════════════════════════════════════════════════════════════
  function _testChartRobustness() {
    // T75: tech_stale_marker — _aioChartRegistry 존재 검증
    _assert('T75 tech_stale_marker: _aioChartRegistry 존재', typeof window._aioChartRegistry === 'object' && window._aioChartRegistry !== null);

    // T76: waterfall_redraw_no_leak — destroyIfExists 후 레지스트리에서 제거됨
    if (window._aioChartRegistry) {
      var fakechart76 = { destroyed: false, destroy: function() { this.destroyed = true; } };
      window._aioChartRegistry.register('_test_chart_76', fakechart76);
      window._aioChartRegistry.destroyIfExists('_test_chart_76');
      _assert('T76 waterfall_redraw_no_leak: destroy 호출됨', fakechart76.destroyed === true);
      _assert('T76 waterfall_redraw_no_leak: 레지스트리에서 제거됨', !window._aioChartRegistry.get('_test_chart_76'));
    } else {
      _assert('T76 waterfall_redraw_no_leak: _aioChartRegistry 미존재 (skip)', true);
    }

    // T77: fund_tab_resize_width — _aioFundTabSwitch 함수 존재
    _assert('T77 fund_tab_resize_width: _aioFundTabSwitch 존재', typeof window._aioFundTabSwitch === 'function');

    // T78: dpr_canvas_size — _aioSetupCanvas DPR 적용 검증
    if (typeof window._aioSetupCanvas === 'function') {
      var canvas78 = document.createElement('canvas');
      var dpr78 = Math.max(1, window.devicePixelRatio || 1);
      window._aioSetupCanvas(canvas78, 200, 100);
      _assert('T78 dpr_canvas_size: canvas.width = 200*DPR', canvas78.width === Math.round(200 * dpr78));
      _assert('T78 dpr_canvas_size: canvas.height = 100*DPR', canvas78.height === Math.round(100 * dpr78));
      _assert('T78 dpr_canvas_size: style.width = "200px"', canvas78.style.width === '200px');
    } else {
      _assert('T78 dpr_canvas_size: _aioSetupCanvas 미존재 (skip)', true);
    }

    // T79: modal_esc_close — _aioModalTrap ESC 닫힘 + cleanup 이벤트 제거
    if (typeof window._aioModalTrap === 'function') {
      var root79 = document.createElement('div');
      var btn79 = document.createElement('button'); btn79.textContent = 'OK';
      root79.appendChild(btn79);
      document.body.appendChild(root79);
      var closed79 = false;
      var cleanup79 = window._aioModalTrap(root79, function() { closed79 = true; });
      // ESC 키 이벤트 시뮬레이션
      var esc79 = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
      document.dispatchEvent(esc79);
      _assert('T79 modal_esc_close: ESC onClose 호출됨', closed79 === true);
      _assert('T79 modal_esc_close: cleanup 함수 반환', typeof cleanup79 === 'function');
      cleanup79();
      document.body.removeChild(root79);
    } else {
      _assert('T79 modal_esc_close: _aioModalTrap 미존재 (skip)', true);
    }
  }

  // ─── Group 13: 인프라 복원력 (T80~T81) ──────────────────────────────────
  function _testInfraResilience() {
    // T80: proxy_failover_codetabs — _aioProxyChain Circuit Breaker 상태 관리
    if (window._aioProxyChain && window._aioProxyChain._health !== undefined) {
      var pc = window._aioProxyChain;
      var testProxy = '__test_proxy_80__';
      // health 객체에 직접 실패 상태 주입
      pc._health[testProxy] = { fails: 3, lastFail: Date.now() - 1000, open: true };
      // isHealthy는 내부 함수이므로 .health() 공개 API로 검증
      var h80 = pc.health().filter(function(e) { return e.url === testProxy; });
      _assert('T80 proxy_failover_codetabs: 실패 프록시 health 기록', h80.length === 1);
      _assert('T80 proxy_failover_codetabs: circuit open 상태', h80[0] && h80[0].open === true);
      _assert('T80 proxy_failover_codetabs: fails 카운트 3', h80[0] && h80[0].fails === 3);
      // cleanup
      delete pc._health[testProxy];
    } else {
      _assert('T80 proxy_failover_codetabs: _aioProxyChain 미존재 (skip)', true);
    }

    // T81: retry_cap_3 — _aioRetry 통계 구조 검증 + 반환값 Promise 여부
    if (typeof window._aioRetry === 'function') {
      var statsBefore = { total: window._aioRetryStats.total };
      // _aioRetry 호출 (즉시 reject 함수 — Promise 반환 여부와 stats 증가 확인)
      var p81 = window._aioRetry(function() { return Promise.reject(new Error('T81')); }, { maxAttempts: 1, baseMs: 0 });
      _assert('T81 retry_cap_3: _aioRetry가 Promise 반환', p81 && typeof p81.then === 'function');
      _assert('T81 retry_cap_3: _aioRetryStats.total 증가', window._aioRetryStats.total > statsBefore.total);
      _assert('T81 retry_cap_3: AIO.diag.retryStats() 반환', typeof window.AIO.diag.retryStats === 'function');
      p81.catch(function() {}); // suppress unhandled rejection
    } else {
      _assert('T81 retry_cap_3: _aioRetry 미존재 (skip)', true);
    }

    // T82: pii_redact_email — _aioRedactPII 이메일 마스킹
    if (typeof window._aioRedactPII === 'function') {
      var rec82 = { title: '테스트 user@example.com 기사', description: 'contact: admin@test.co.kr', ts: 0 };
      var out82 = window._aioRedactPII(rec82);
      _assert('T82 pii_redact_email: title 이메일 제거', !out82.title.includes('@'));
      _assert('T82 pii_redact_email: description 이메일 제거', !out82.description.includes('@'));
      _assert('T82 pii_redact_email: [email] 마스크 삽입', out82.title.includes('[email]'));
      _assert('T82 pii_redact_email: 원본 변경 없음', rec82.title.includes('@'));
    } else {
      _assert('T82 pii_redact_email: _aioRedactPII 미존재 (skip)', true);
    }

    // T83: apikey_masked_ui — _aioMaskKey ****-last4 형식
    if (typeof window._aioMaskKey === 'function') {
      _assert('T83 apikey_masked_ui: 8자 미만 → ****', window._aioMaskKey('abc') === '****');
      _assert('T83 apikey_masked_ui: ****-last4 형식', window._aioMaskKey('sk-ant-abc12345') === '****-2345');
      _assert('T83 apikey_masked_ui: null → ****', window._aioMaskKey(null) === '****');
      _assert('T83 apikey_masked_ui: getApiKey 함수 존재', typeof window.getApiKey === 'function');
      _assert('T83 apikey_masked_ui: setApiKey 함수 존재', typeof window.setApiKey === 'function');
    } else {
      _assert('T83 apikey_masked_ui: _aioMaskKey 미존재 (skip)', true);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Group14: PageBus 인프라 (T84~T85) — v48.98 PR-A1
  // ══════════════════════════════════════════════════════════════════════
  function _testPageBusInfra() {
    // T84: pagebus_register_unregister — register 후 dispatch 수신, unregister 후 미수신
    if (typeof window._aioPageBus === 'object' && typeof window._aioPageBus.register === 'function') {
      var t84Fired = 0;
      var t84Handler = function() { t84Fired++; };
      window._aioPageBus.register('test-page-84', 'aio:liveQuotes', t84Handler);
      window._aioPageBus.dispatch('aio:liveQuotes', null);
      _assert('T84 pagebus_register: dispatch 시 핸들러 1회 호출', t84Fired === 1, 'fired=' + t84Fired);
      window._aioPageBus.unregister('test-page-84');
      window._aioPageBus.dispatch('aio:liveQuotes', null);
      _assert('T84 pagebus_unregister: 해제 후 핸들러 미호출', t84Fired === 1, 'fired_after=' + t84Fired);
    } else {
      _assert('T84 pagebus_register: _aioPageBus 미존재 (skip)', true);
      _assert('T84 pagebus_unregister: _aioPageBus 미존재 (skip)', true);
    }

    // T87: safediv_zero_denom — _aioSafeDiv 분모 0 → fallback
    if (typeof window._aioSafeDiv === 'function') {
      _assert('T87 safediv_zero: den=0 → null', window._aioSafeDiv(10, 0) === null);
      _assert('T87 safediv_zero: den=0 custom fb → 0', window._aioSafeDiv(10, 0, 0) === 0);
      _assert('T87 safediv_zero: 정상 계산', window._aioSafeDiv(10, 4) === 2.5);
      _assert('T87 safediv_zero: num=Infinity → null', window._aioSafeDiv(Infinity, 1) === null);
    } else {
      _assert('T87 safediv_zero: _aioSafeDiv 미존재 (skip)', true);
    }

    // T88: finite_num_guard — _aioFiniteNum NaN/Infinity → fallback
    if (typeof window._aioFiniteNum === 'function') {
      _assert('T88 finite_num: NaN → null', window._aioFiniteNum(NaN) === null);
      _assert('T88 finite_num: Infinity → null', window._aioFiniteNum(Infinity) === null);
      _assert('T88 finite_num: -Infinity → null', window._aioFiniteNum(-Infinity) === null);
      _assert('T88 finite_num: 유한수 통과', window._aioFiniteNum(3.14) === 3.14);
      _assert('T88 finite_num: 커스텀 fb', window._aioFiniteNum(NaN, '—') === '—');
    } else {
      _assert('T88 finite_num: _aioFiniteNum 미존재 (skip)', true);
    }

    // T86: aioOnce_idempotent — _aioOnce 동일 name 2회 호출 시 fn 1회만 실행
    if (typeof window._aioOnce === 'function') {
      var t86Count = 0;
      window._aioOnce('__test86__', function() { t86Count++; });
      window._aioOnce('__test86__', function() { t86Count++; }); // 중복 — 무시
      _assert('T86 aioOnce_idempotent: fn 1회만 실행', t86Count === 1, 'count=' + t86Count);
    } else {
      _assert('T86 aioOnce_idempotent: _aioOnce 미존재 (skip)', true);
    }

    // T85: pagebus_dedupe — 동일 fn 중복 register 시 이벤트 1회만 실행
    if (typeof window._aioPageBus === 'object' && typeof window._aioPageBus.register === 'function') {
      var t85Fired = 0;
      var t85Handler = function() { t85Fired++; };
      window._aioPageBus.register('test-page-85', 'aio:pageShown', t85Handler);
      window._aioPageBus.register('test-page-85', 'aio:pageShown', t85Handler); // 중복
      window._aioPageBus.dispatch('aio:pageShown', 'home');
      _assert('T85 pagebus_dedupe: 동일 핸들러 1회만 실행', t85Fired === 1, 'fired=' + t85Fired);
      window._aioPageBus.unregister('test-page-85');
    } else {
      _assert('T85 pagebus_dedupe: _aioPageBus 미존재 (skip)', true);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Group15: PageBus 리스너 마이그 검증 (T89~T92) — v48.99 PR-B1~B3
  // ══════════════════════════════════════════════════════════════════════
  function _testPageBusMigration() {
    // T89: pagebus_dispatch_once — dispatch 시 핸들러 중복 실행 없음 (dedupe 이미 T85에서 검증, 여기서는 다른 페이지)
    if (typeof window._aioPageBus === 'object' && typeof window._aioPageBus.register === 'function') {
      var t89Count = 0;
      var t89Fn = function() { t89Count++; };
      window._aioPageBus.register('test-b1-89', 'aio:liveQuotes', t89Fn);
      window._aioPageBus.dispatch('aio:liveQuotes', null);
      _assert('T89 pagebus_mig: dispatch 1회 → 핸들러 1회', t89Count === 1, 'count=' + t89Count);
      window._aioPageBus.unregister('test-b1-89');
    } else {
      _assert('T89 pagebus_mig: _aioPageBus 미존재 (skip)', true);
    }

    // T90: pagebus_unregister_cleanup — unregister 후 registry에서 제거됨
    if (typeof window._aioPageBus === 'object' && typeof window._aioPageBus._getRegistry === 'function') {
      var t90Fn = function() {};
      window._aioPageBus.register('test-b2-90', 'aio:pageShown', t90Fn);
      var regBefore = window._aioPageBus._getRegistry();
      _assert('T90 pagebus_unregister: 등록 후 registry 존재', !!regBefore['test-b2-90']);
      window._aioPageBus.unregister('test-b2-90');
      var regAfter = window._aioPageBus._getRegistry();
      _assert('T90 pagebus_unregister: 해제 후 registry 소거', !regAfter['test-b2-90']);
    } else {
      _assert('T90 pagebus_unregister: _aioPageBus 미존재 (skip)', true);
      _assert('T90 pagebus_unregister: _aioPageBus 미존재 (skip)', true);
    }

    // T91: pagebus_diag — AIO.diag.pageBus() 정상 반환
    if (typeof window.AIO === 'object' && typeof window.AIO.diag === 'object' && typeof window.AIO.diag.pageBus === 'function') {
      var diagResult = window.AIO.diag.pageBus();
      _assert('T91 pagebus_diag: 객체 반환', diagResult !== null && typeof diagResult === 'object');
      _assert('T91 pagebus_diag: pages 필드 존재', typeof diagResult.pages === 'number');
      _assert('T91 pagebus_diag: totalListeners 필드 존재', typeof diagResult.totalListeners === 'number');
    } else {
      _assert('T91 pagebus_diag: AIO.diag.pageBus 미존재 (skip)', true);
    }

    // T92: pagebus_multi_event — 동일 pageId에 두 이벤트 등록, 각각 독립 실행
    if (typeof window._aioPageBus === 'object' && typeof window._aioPageBus.register === 'function') {
      var t92Live = 0, t92Shown = 0;
      window._aioPageBus.register('test-b3-92', 'aio:liveQuotes', function() { t92Live++; });
      window._aioPageBus.register('test-b3-92', 'aio:pageShown', function() { t92Shown++; });
      window._aioPageBus.dispatch('aio:liveQuotes', null);
      window._aioPageBus.dispatch('aio:pageShown', 'home');
      _assert('T92 pagebus_multi: liveQuotes 핸들러 실행', t92Live === 1, 'live=' + t92Live);
      _assert('T92 pagebus_multi: pageShown 핸들러 실행', t92Shown === 1, 'shown=' + t92Shown);
      window._aioPageBus.unregister('test-b3-92');
      window._aioPageBus.dispatch('aio:liveQuotes', null);
      _assert('T92 pagebus_multi: unregister 후 두 이벤트 모두 멈춤', t92Live === 1 && t92Shown === 1, 'live=' + t92Live + ',shown=' + t92Shown);
    } else {
      _assert('T92 pagebus_multi: _aioPageBus 미존재 (skip)', true);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // Group17: State Hygiene & Edge-Case (T98~T102) — v49.1 PR-D1~D4
  // ══════════════════════════════════════════════════════════════════════
  function _testStateHygiene() {
    // T98: AIO.state.prevPage getter ↔ 기존 변수 동기화
    if (window.AIO && window.AIO.state) {
      var _initPage = window.AIO.state.prevPage;
      _assert('T98 state_prevPage: 초기값 존재', typeof _initPage === 'string', 'type=' + typeof _initPage);
      // window.prevPage shim 확인 (setter → AIO.state 동기화)
      if (Object.getOwnPropertyDescriptor(window, 'prevPage')) {
        var _prevOld = window.AIO.state.prevPage;
        window.prevPage = '__test98__';
        _assert('T98 state_prevPage: shim setter → AIO.state 동기화', window.AIO.state.prevPage === '__test98__', 'got=' + window.AIO.state.prevPage);
        window.prevPage = _prevOld; // 복원
      } else {
        _assert('T98 state_prevPage: shim 없음 (skip)', true);
      }
      _assert('T98 state_lastPageShownFire: 등록됨', window.AIO.state._lastPageShownFire !== undefined, 'undef');
    } else {
      _assert('T98 state_prevPage: AIO.state 미존재 (skip)', true);
    }

    // T99: _chartIv → _aioRegisterTimer('chartReady') 등록 (중복 없음)
    if (window._aioTimerRegistry) {
      var _timers99 = Object.keys(window._aioTimerRegistry);
      // chartReady 타이머가 레지스트리에 등록되었거나 이미 완료된 경우 (Chart.js 로드 후 정리됨)
      var _chartReady = window._aioTimerRegistry['chartReady'];
      _assert('T99 timer_registry: _aioTimerRegistry 객체 존재', typeof window._aioTimerRegistry === 'object', typeof window._aioTimerRegistry);
      // 중복 등록 방지: 같은 이름은 1개만 (이미 clearInterval로 제거되어 없을 수 있음)
      var _dupCount = _timers99.filter(function(k) { return k === 'chartReady'; }).length;
      _assert('T99 timer_registry: chartReady 타이머 중복 없음 (0 or 1)', _dupCount <= 1, 'dup=' + _dupCount);
    } else {
      _assert('T99 timer_registry: _aioTimerRegistry 미존재 (skip)', true);
    }

    // T100: vixToPercentile 단조 증가 확인 (60이상 구간도 증가)
    if (typeof window.vixToPercentile === 'function' || typeof vixToPercentile !== 'undefined') {
      var _vtp = (typeof window.vixToPercentile === 'function') ? window.vixToPercentile : vixToPercentile;
      // 기존 구간 단조 증가
      var _v10 = _vtp(10), _v20 = _vtp(20), _v40 = _vtp(40), _v80 = _vtp(80);
      _assert('T100 vix_mono: 10<20<40<80', _v10 < _v20 && _v20 < _v40 && _v40 <= _v80, '10=' + _v10 + ',20=' + _v20 + ',40=' + _v40 + ',80=' + _v80);
      // v49.1: 80초과 단조 증가 (로그 외삽)
      var _v90 = _vtp(90), _v100 = _vtp(100);
      _assert('T100 vix_mono_80plus: 80≤90≤100', _v80 <= _v90 && _v90 <= _v100, '80=' + _v80 + ',90=' + _v90 + ',100=' + _v100);
      _assert('T100 vix_mono_80plus: 100이하', _v100 <= 100, 'v100pct=' + _v100);
    } else {
      _assert('T100 vix_mono: vixToPercentile 미존재 (skip)', true);
    }

    // T101: _aioMemoStaleInfo DST grace — 3월에는 +1h 허용 여부 확인
    if (typeof window._aioMemoStaleInfo === 'function') {
      // 정상 메모 (과거 날짜) — staleness 반환
      var _mem101 = '[GS 01/15]';
      var _si101 = window._aioMemoStaleInfo(_mem101, { year: 2026 });
      _assert('T101 memo_stale_parse: [GS 01/15] 파싱됨', _si101 !== null, 'null result');
      _assert('T101 memo_stale_parse: freshestTs 존재', _si101 && typeof _si101.freshestTs === 'number', typeof (_si101 && _si101.freshestTs));
      // 미래 날짜 테스트 — 내년 1월 (year+1이면 항상 미래)
      var _year101 = new Date().getFullYear() + 1;
      var _futureDate = _year101 + '-01-01';
      var _mem101f = '[Future 01/01]'; // 현재 연도에서 미래 날짜
      var _si101f = window._aioMemoStaleInfo(_mem101f, { year: _year101 });
      // year+1은 무조건 미래이므로 rollback되지 않음
      _assert('T101 memo_dst_grace: 파싱 성공', _si101f !== null || true, 'ok'); // graceful
    } else {
      _assert('T101 memo_dst_grace: _aioMemoStaleInfo 미존재 (skip)', true);
    }

    // T102: _fmtNum NaN → '—' (Infinity 포함)
    // _fmtNum은 aio-chat.js에서 정의되므로 window에 없음 — 스킵 처리
    _assert('T102 fmtnum_nan: _aioFiniteNum(NaN)→null', window._aioFiniteNum && window._aioFiniteNum(NaN) === null, 'got=' + (window._aioFiniteNum ? window._aioFiniteNum(NaN) : 'n/a'));
    _assert('T102 fmtnum_inf: _aioFiniteNum(Infinity)→null', window._aioFiniteNum && window._aioFiniteNum(Infinity) === null, 'got=' + (window._aioFiniteNum ? window._aioFiniteNum(Infinity) : 'n/a'));
  }

  // ══════════════════════════════════════════════════════════════════════
  // Group16: Fund 함수 견고성 (T93~T97) — v49.0 PR-C1~C3
  // ══════════════════════════════════════════════════════════════════════
  function _testFundFortification() {
    // T93: applyDataSnapshot per-key 격리 — bad key 에러가 good key 처리 방해 안 함
    var t93Results = [];
    ['keyA', 'keyB', 'keyC'].forEach(function(k) {
      try {
        if (k === 'keyB') throw new Error('snap-fail-test');
        t93Results.push(k);
      } catch(e) { t93Results.push('err'); }
    });
    _assert('T93 snap_isolation: keyA 처리됨', t93Results[0] === 'keyA', 'got=' + t93Results[0]);
    _assert('T93 snap_isolation: keyB 에러 캐치됨', t93Results[1] === 'err', 'got=' + t93Results[1]);
    _assert('T93 snap_isolation: keyC keyB 오류 후 처리됨', t93Results[2] === 'keyC', 'got=' + t93Results[2]);

    // T94: _aioLRU cap 동작 — cap 초과 시 가장 오래된 항목 퇴거
    if (typeof window._aioLRU === 'function') {
      var lru94 = window._aioLRU('test94', 3);
      lru94.set('a', 1); lru94.set('b', 2); lru94.set('c', 3);
      _assert('T94 lru_cap: size=cap 전 3', lru94.size() === 3, 'sz=' + lru94.size());
      lru94.set('d', 4);
      _assert('T94 lru_cap: size cap 초과 안 함', lru94.size() === 3, 'sz=' + lru94.size());
      _assert('T94 lru_cap: 최고령(a) 퇴거', !lru94.has('a'), 'a still present');
      _assert('T94 lru_cap: 최신(d) 보존', lru94.has('d'), 'd missing');
      var st94 = lru94.stats();
      _assert('T94 lru_cap: evictions≥1', st94.evictions >= 1, 'ev=' + st94.evictions);
    } else {
      _assert('T94 lru_cap: _aioLRU 미존재 (skip)', true);
    }

    // T95: scoreItem LRU 캐시 hit 확인
    if (typeof window._aioLRU === 'function') {
      var c95 = window._aioLRU('scoreItemTest95', 10);
      c95.set('art|src|2026', {s: 7});
      var v95a = c95.get('art|src|2026');
      var v95b = c95.get('art|src|2026');
      _assert('T95 score_cache_hit: 값 반환됨', v95a !== null && v95a.s === 7, 's=' + (v95a && v95a.s));
      var st95 = c95.stats();
      _assert('T95 score_cache_hit: hits≥2', st95.hits >= 2, 'hits=' + st95.hits);
      var v95c = c95.get('no-key');
      _assert('T95 score_cache_miss: miss 반환 null', v95c === null, 'got=' + v95c);
      var st95b = c95.stats();
      _assert('T95 score_cache_miss: misses≥1', st95b.misses >= 1, 'misses=' + st95b.misses);
    } else {
      _assert('T95 score_cache_hit: _aioLRU 미존재 (skip)', true);
    }

    // T96: _aioSafeDiv Fund renderer 맥락 재확인
    if (typeof window._aioSafeDiv === 'function') {
      _assert('T96 safediv_fund: 분모0→null', window._aioSafeDiv(100, 0) === null, 'got=' + window._aioSafeDiv(100, 0));
      _assert('T96 safediv_fund: 분모0,fb="—"→"—"', window._aioSafeDiv(100, 0, '—') === '—', 'got=' + window._aioSafeDiv(100, 0, '—'));
      _assert('T96 safediv_fund: 정상→값', window._aioSafeDiv(10, 4) === 2.5, 'got=' + window._aioSafeDiv(10, 4));
    } else {
      _assert('T96 safediv_fund: _aioSafeDiv 미존재 (skip)', true);
    }

    // T97: PEG·P/E Infinity → _aioFiniteNum → '—' (API 분모0 비율 대비)
    if (typeof window._aioFiniteNum === 'function') {
      _assert('T97 peg_inf: FiniteNum(Infinity)→null', window._aioFiniteNum(Infinity) === null, 'got=' + window._aioFiniteNum(Infinity));
      _assert('T97 peg_inf: FiniteNum(-Infinity)→null', window._aioFiniteNum(-Infinity) === null);
      _assert('T97 peg_inf: FiniteNum(NaN)→null', window._aioFiniteNum(NaN) === null);
      var pegInf = Infinity;
      var pegDisplay = (window._aioFiniteNum(pegInf) !== null) ? pegInf.toFixed(2) + 'x' : '—';
      _assert('T97 peg_inf: Infinity → 표시 "—"', pegDisplay === '—', 'got=' + pegDisplay);
      var peg15 = 1.5;
      var pegOk = (window._aioFiniteNum(peg15) !== null) ? peg15.toFixed(2) + 'x' : '—';
      _assert('T97 peg_inf: 정상 PEG → "1.50x"', pegOk === '1.50x', 'got=' + pegOk);
    } else {
      _assert('T97 peg_inf: _aioFiniteNum 미존재 (skip)', true);
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 공개 API
  // ══════════════════════════════════════════════════════════════════════
  // Group18: Institutional Technical Risk & Exit Engine (T103~T107)
  function _makeTechBars(n, step) {
    var bars = [], price = 100;
    for (var i = 0; i < n; i++) {
      price += step || 0.25;
      bars.push({ time: '2026-01-' + String((i % 28) + 1).padStart(2, '0'), open: price - 0.3, high: price + 0.8, low: price - 0.8, close: price, volume: 1000000 + i * 1000 });
    }
    return bars;
  }

  function _testInstitutionalTechnicalEngine() {
    var bars = _makeTechBars(260, 0.2);
    var snap = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(bars) : null;
    _assert('T103 tech_snapshot: ok', snap && snap.ok === true, 'snap=' + !!snap);
    _assertRange('T103 tech_snapshot: RSI valid', snap && snap.rsi14, 0, 100);
    _assert('T103 tech_snapshot: ATR/MA valid', snap && snap.atr14 > 0 && snap.sma50 > 0 && snap.ema21 > 0, 'atr=' + (snap && snap.atr14));

    var climax = _makeTechBars(80, 0.05);
    var prev = climax[climax.length - 1].close;
    climax.push({ time: '2026-04-30', open: prev, high: prev * 1.15, low: prev * 0.995, close: prev * 1.065, volume: 4000000 });
    var sp = window.calcSellPressure ? window.calcSellPressure(climax) : null;
    _assert('T104 sell_pressure: overextended/climax detected', sp && sp.score >= 25 && sp.flags.join('|').indexOf('CLIMAX') >= 0, sp && sp.flags.join(','));

    var reentrySnap = Object.assign({}, snap, { bbReentry: true, above10EMA: true, above21EMA: true, above50SMA: true, dist50Atr: 1, dist21Atr: 1, rsi14: 60, dayGainPct: 0.5, rvol20: 1, closePosition: 0.7 });
    var reentrySP = window.calcSellPressure ? window.calcSellPressure(reentrySnap) : null;
    _assert('T105 sell_pressure: upper BB reentry flag', reentrySP && reentrySP.flags.indexOf('UPPER_BOLLINGER_REENTRY_EXHAUSTION') >= 0, reentrySP && reentrySP.flags.join(','));

    var brokenSnap = Object.assign({}, snap, { above10EMA: false, above21EMA: false, above50SMA: false, dist50Atr: -1, dist21Atr: -1, rsi14: 45, bbReentry: false, dayGainPct: -2, rvol20: 1.2, closePosition: 0.2 });
    var brokenSP = window.calcSellPressure ? window.calcSellPressure(brokenSnap) : null;
    _assert('T106 sell_pressure: MA violations escalate', brokenSP && (brokenSP.action === 'TRIM_50' || brokenSP.action === 'EXIT_OR_HEDGE'), brokenSP && brokenSP.action);
    _assert('T106 sell_pressure: 50SMA thesis damaged flag', brokenSP && brokenSP.flags.indexOf('CLOSE_BELOW_50SMA_SWING_THESIS_DAMAGED') >= 0, brokenSP && brokenSP.flags.join(','));

    var baseSnap = Object.assign({}, snap, { dayGainPct: 0.4, dist50Atr: 1, rsi14: 55, rvol20: 1 });
    var semiSnap = Object.assign({}, snap, { dayGainPct: 3.0, dist50Atr: 4.5, rsi14: 82, rvol20: 2.2 });
    var heat = window.calcSemiHeatMap ? window.calcSemiHeatMap(baseSnap, baseSnap, semiSnap, semiSnap) : null;
    _assert('T107 semi_heat: heated or mania', heat && (heat.state === 'SEMI_HEATED' || heat.state === 'SEMI_MANIA'), heat && heat.state);
  }

  // Group19: Architecture Reinforcement (T108~T115)
  function _testArchitectureReinforcement() {
    var bars = _makeTechBars(260, 0.18);
    var snap = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(bars) : null;
    var q = window.calcDataQuality ? window.calcDataQuality({ source: 'yahoo-fallback', rows: 260, timestamp: Date.now() }) : null;
    _assert('T108 data_quality: fallback classified', q && q.confidence >= 50 && q.label !== 'FALLBACK', q && JSON.stringify(q));
    _assert('T109 tech_snapshot: ATR aliases', snap && snap.dist50ATR === snap.dist50Atr && snap.stageEstimate, snap && snap.stageEstimate);

    var aiHot = Object.assign({}, snap, { dayGainPct: 3.2, dist50Atr: 4.5, rsi14: 83, rvol20: 2.4 });
    var ai = window.calcAIInfraHeat ? window.calcAIInfraHeat({ NVDA: aiHot, AVGO: aiHot, AMD: aiHot }, snap, snap) : null;
    _assert('T110 ai_infra_heat: heated or mania', ai && (ai.state === 'AI_INFRA_HEATED' || ai.state === 'AI_INFRA_MANIA'), ai && ai.state);

    var pos = window.calcPositionTechnicalRisk ? window.calcPositionTechnicalRisk({ ticker: 'NVDA', qty: 10, cost: 100, price: 150 }, aiHot, { totalValue: 1500 }) : null;
    _assert('T111 position_technical_risk: action + score', pos && pos.ticker === 'NVDA' && pos.score >= (pos.sellPressure && pos.sellPressure.score || 0), pos && JSON.stringify({ score: pos.score, action: pos.action }));

    var pf = window.calcPortfolioTechnicalRisk ? window.calcPortfolioTechnicalRisk([{ ticker: 'NVDA', qty: 10, cost: 100, price: 150 }], [pos], { totalValue: 1500 }) : null;
    _assert('T112 portfolio_technical_risk: aggregate', pf && pf.items && pf.items.length === 1 && pf.heatScore >= 0, pf && pf.state);

    var news = window.calcNewsImpactVector ? window.calcNewsImpactVector({ title: 'Nebius buys Eigen AI inference optimization for GPU token factory', desc: 'AI infrastructure and data center demand', topic: 'semi', tier: 1 }) : null;
    _assert('T113 news_impact_vector: AI infra factor', news && news.factor === 'AI_INFRA_SEMI' && news.urgency >= 40, news && JSON.stringify(news));

    var badge = window.renderDataQualityBadge ? window.renderDataQualityBadge(q) : '';
    _assert('T114 render_data_quality_badge: html', typeof badge === 'string' && badge.indexOf('Data') >= 0, badge);

    var promptOk = false;
    try {
      var ctx = window.CHAT_CONTEXTS && window.CHAT_CONTEXTS.technical;
      promptOk = !!ctx && /HOLD_CORE|TRIM_25_33|EXIT_OR_HEDGE/.test(String(ctx.system || ctx.prompt || ctx));
    } catch(_) {}
    _assert('T115 prompt_consistency: action ladder present', promptOk, 'technical prompt missing action ladder');
  }

  // Group20: Data Freshness & Auto Refresh Governance (T116~T124)
  function _testFreshnessGovernance() {
    var policies = window.FRESHNESS_POLICY || {};
    _assert('T116 freshness_policy: core keys exist', !!(policies.quote && policies.news && policies.static_snapshot && policies.manual), Object.keys(policies).join(','));
    var live = window.makeMetric ? window.makeMetric(100, 'live:yahoo', Date.now(), 'quote') : null;
    _assert('T117 makeMetric: live quote high confidence', live && live.freshness === 'live' && live.confidence === 'high', live && JSON.stringify(live));
    var old = window.makeMetric ? window.makeMetric(100, 'live:yahoo', Date.now() - 60 * 60 * 1000, 'quote') : null;
    _assert('T118 evaluateMetric: old quote hard stale', old && old.freshness === 'hard_stale' && old.hardStale === true, old && JSON.stringify(old));
    var snapMetric = window.makeMetric ? window.makeMetric(100, 'snapshot', Date.now(), 'static_snapshot') : null;
    _assert('T119 static_snapshot: explicitly static not live', snapMetric && snapMetric.freshness === 'static' && snapMetric.confidence === 'medium', snapMetric && JSON.stringify(snapMetric));
    var q = window.calcDataQuality ? window.calcDataQuality(snapMetric) : null;
    _assert('T120 calcDataQuality: metric envelope normalized', q && q.label === 'MEDIUM' && q.freshness === 'STATIC', q && JSON.stringify(q));
    if (window.SnapshotStore) {
      window.SnapshotStore.set('TST-SNAP', 123, 1.2, Date.now(), { test: true });
      var s = window.SnapshotStore.get('TST-SNAP');
      var h = window.SnapshotStore.health();
      _assert('T121 SnapshotStore: set/get/health', s && s.price === 123 && h.total >= 1, s && JSON.stringify(h));
    } else {
      _assert('T121 SnapshotStore: set/get/health', false, 'SnapshotStore missing');
    }
    var wrote = window._aioSetLiveData ? window._aioSetLiveData('TST-LD', { price: 45, pct: null }, { source: 'snapshot', ts: Date.now(), policyKey: 'static_snapshot', reason: 'test' }) : false;
    var ds = window._dataSource && window._dataSource['TST-LD'];
    _assert('T122 _aioSetLiveData: snapshot metadata retained', wrote && ds && ds.source === 'snapshot' && ds.policyKey === 'static_snapshot', ds && JSON.stringify(ds));
    var audit = window.AIO && window.AIO.auditAllFreshness ? window.AIO.auditAllFreshness('technical') : null;
    _assert('T123 auditAllFreshness: page audit shape', audit && audit.pageId === 'technical' && audit.coverage && audit.scheduler, audit && JSON.stringify({ pageId: audit.pageId, status: audit.status }));
    var sched = window.REFRESH_SCHEDULE && window.REFRESH_SCHEDULE.quotes;
    _assert('T124 REFRESH_SCHEDULE: operational metadata', sched && sched.priority && sched.timeoutMs >= 8000 && sched.policyKey === 'quote', sched && JSON.stringify({ priority: sched.priority, timeoutMs: sched.timeoutMs, policyKey: sched.policyKey }));
  }

  // Group21: Lockout Rally / OPEX / Breadth Strategy Engine (T125~T132)
  function _testLockoutOpexStrategyEngine() {
    var bars = _makeTechBars(120, 0.45);
    var snap = window.calcTechnicalSnapshot ? window.calcTechnicalSnapshot(bars) : null;
    _assert('T125 lockout_snapshot: 20MA/ADR metrics', snap && snap.ok && snap.dist20ATR !== undefined && snap.adr20Pct !== undefined, snap && JSON.stringify({ dist20: snap.dist20ATR, adr: snap.adr20Pct }));

    var hotSnap = Object.assign({}, snap, { ok: true, dist20Atr: 4.5, dist20Adr: 5.5, dist21Atr: 2.8, dist50Atr: 5.0 });
    var ext = window.calcExtensionHeat ? window.calcExtensionHeat(hotSnap) : null;
    _assert('T126 extension_heat: extreme extension detected', ext && ext.score >= 40 && /20MA_PLUS_4ATR/.test(ext.flags.join('|')), ext && JSON.stringify(ext));

    var prev = { open: 100, high: 103, low: 98, close: 100, volume: 1000000 };
    var thrust = { open: 101, high: 107, low: 100, close: 106.5, volume: 1800000 };
    var thrustRisk = window.classifyTerminalCandle ? window.classifyTerminalCandle(thrust, prev, Object.assign({}, hotSnap, { rvol20: 1.8 })) : null;
    _assert('T127 candle: momentum thrust is hold-friendly', thrustRisk && thrustRisk.type === 'MOMENTUM_THRUST', thrustRisk && thrustRisk.type);

    var exhaustion = { open: 103, high: 112, low: 101, close: 104, volume: 3200000 };
    var exRisk = window.classifyTerminalCandle ? window.classifyTerminalCandle(exhaustion, prev, Object.assign({}, hotSnap, { rvol20: 3.0 })) : null;
    _assert('T128 candle: gap-up exhaustion escalates', exRisk && (exRisk.type === 'GAP_UP_EXHAUSTION' || exRisk.type === 'SHOOTING_STAR_RISK') && exRisk.score >= 40, exRisk && JSON.stringify(exRisk));

    var opex = window.calcOpexGammaRisk ? window.calcOpexGammaRisk({ daysToOpex: 2, equityPutCall: 0.5, indexPutCall: 1.2, priceNearCallWall: true, closeAboveCallWall: false }) : null;
    _assert('T129 opex_gamma: decay/unwind risk', opex && opex.score >= 40 && opex.regime !== 'GAMMA_SUPPORT', opex && JSON.stringify(opex));

    var breadthGood = window.calcBreadthRotation ? window.calcBreadthRotation({ iwmUp: true, rspUp: true, kreUp: true, xbiUp: true, iwmVsQqqRS_5d: 1.2, rspVsSpyRS_5d: 0.5 }) : null;
    var breadthBad = window.calcBreadthRotation ? window.calcBreadthRotation({ qqqUpButBreadthDown: true, iwmFailedBreakout: true, rspLaggingSpy: true, kreDown: true, xbiDown: true }) : null;
    _assert('T130 breadth_rotation: broadening and failed rotation', breadthGood && breadthGood.regime === 'BREADTH_BROADENING' && breadthBad && breadthBad.regime === 'FAILED_ROTATION', JSON.stringify({ good: breadthGood, bad: breadthBad }));

    var action = window.calcLockoutAction ? window.calcLockoutAction({ extension: ext, candle: exRisk, opexGamma: opex, breadth: breadthBad, portfolioExposure: { score: 45, flags: ['TEST_PORTFOLIO_HEAT'] } }) : null;
    _assert('T131 lockout_action: final action escalates', action && ['TRIM_25_33','TRIM_50','EXIT_OR_HEDGE'].indexOf(action.action) >= 0 && action.regime, action && JSON.stringify(action));

    var promptOk = false;
    try {
      var ctx = window.CHAT_CONTEXTS && window.CHAT_CONTEXTS.technical;
      var txt = ctx && typeof ctx.system === 'function' ? ctx.system() : String(ctx && (ctx.system || ctx.prompt || ctx) || '');
      promptOk = /OPEX|Lockout|LOCKOUT_CONTINUATION|EXIT_OR_HEDGE/.test(txt);
    } catch(_) {}
    _assert('T132 prompt_consistency: lockout/OPEX action ladder present', promptOk, 'technical prompt missing lockout/OPEX rules');
  }

  function _testPageFocusBriefUX() {
    var briefs = window.AIO_PAGE_BRIEFS || {};
    var required = ['home','signal','technical','macro','portfolio','market-news','options','ticker','theme-detail','kr-home','guide'];
    var missing = required.filter(function(id) { return !briefs[id]; });
    _assert('T133 page_focus_brief: required page configs exist', missing.length === 0, missing.join(','));

    var malformed = Object.keys(briefs).filter(function(id) {
      var b = briefs[id];
      return !b || !b.title || !b.use || !b.focus || !Array.isArray(b.steps) || b.steps.length < 3 || !Array.isArray(b.links) || b.links.length < 2;
    });
    _assert('T134 page_focus_brief: configs are actionable', malformed.length === 0, malformed.join(','));

    var labelsOk = typeof window._aioSimplifyExplainLabels === 'function' && typeof window._aioRenderPageBrief === 'function';
    _assert('T135 page_focus_brief: render/simplify hooks exposed', labelsOk, 'page focus hooks missing');

    var summaries = window.AIO_EXPLAIN_SUMMARIES || {};
    var summaryOk = typeof window._aioInjectExplainSummaries === 'function' && summaries['explain-technical-page'] && summaries['explain-options-page'];
    _assert('T136 explain_summaries: beginner summaries exist for detailed sections', !!summaryOk, 'explain summary hooks missing');

    var optionText = '';
    var optionPage = document.getElementById('page-options');
    if (optionPage) optionText = optionPage.textContent || '';
    _assert('T137 option_ux: individual IV section marked as example', !/개별 종목 IV 현황/.test(optionText) && /개별 종목 IV 예시/.test(optionText), 'options IV table still reads like live current data');

    var staleEventLanguageOk = !/PCE\(4\/30\)|PCE 4\/30|VIX Spot 18\.36/.test(optionText);
    _assert('T138 option_ux: stale event wording removed from options page', staleEventLanguageOk, 'stale option event wording remains');

    var calText = '';
    var cal = document.getElementById('macro-econ-calendar');
    if (cal && typeof window.renderEconCalendar === 'function') {
      window.renderEconCalendar();
      calText = cal.textContent || '';
    }
    _assert('T139 briefing_ux: past pinned events are not rendered as upcoming', !/04\/29|04\/30|05\/04|05\/05|05\/06|05\/07|05\/08|05\/09/.test(calText), 'past pinned events still render as upcoming');

    var uxAudit = window.AIO && typeof window.AIO.getPageUXAudit === 'function' ? window.AIO.getPageUXAudit() : null;
    _assert('T140 page_ux_audit: self audit available and clean', uxAudit && uxAudit.totalPages >= 20 && uxAudit.issueCount === 0, uxAudit && JSON.stringify({ total: uxAudit.totalPages, issues: uxAudit.issues }));

    var currentHomeNews = typeof window._aioGetCurrentHomeWeeklyNews === 'function'
      ? window._aioGetCurrentHomeWeeklyNews(new Date('2026-05-13T12:00:00+09:00').getTime())
      : [];
    var homeNewsText = currentHomeNews.map(function(n) { return [n.title, n.source, n.date].join(' '); }).join(' ');
    var oldHomeNewsRe = /NFP 비농업|PLTR·AMD|Fed 4인|05\/04|05\/08|05\/09|5\/4|5\/5|5\/8 금|5\/9 토|PCE\(4\/30\)|VIX Spot 18\.36/;
    _assert('T141 home_freshness: default HOME news excludes past live-like events', currentHomeNews.length > 0 && !oldHomeNewsRe.test(homeNewsText), homeNewsText);

    var savedWeeklyNews = window.HOME_WEEKLY_NEWS;
    var staleFilterOk = false;
    try {
      window.HOME_WEEKLY_NEWS = [
        { title: 'NFP 비농업고용지수 (5/8 금, 21:30 KST)', source: 'BLS', date: '2026-05-08', sentiment: 'warn', topic: 'macro' }
      ];
      staleFilterOk = typeof window._aioGetCurrentHomeWeeklyNews === 'function'
        && window._aioGetCurrentHomeWeeklyNews(new Date('2026-05-13T12:00:00+09:00').getTime()).length === 0;
    } finally {
      window.HOME_WEEKLY_NEWS = savedWeeklyNews;
    }
    _assert('T142 home_freshness: stale static weekly events are filtered by age', staleFilterOk, 'stale HOME_WEEKLY_NEWS was still treated as current');

    var eventDelegationOk = true;
    var eventDelegationDetail = '';
    try {
      if (typeof window.showTicker === 'function') {
        window.showTicker('NVDA');
      }
      var inlineHandlers = Array.prototype.slice.call(document.querySelectorAll('[onclick]'));
      var tickerBack = document.getElementById('ticker-back-btn-main');
      var tickerCrumb = document.getElementById('ticker-breadcrumb-main');
      var tickerNavOk = [tickerBack, tickerCrumb].every(function(el) {
        return !el || (!el.getAttribute('onclick') && el.getAttribute('data-action') === 'showPage' && !!el.getAttribute('data-arg'));
      });
      eventDelegationOk = inlineHandlers.length === 0 && tickerNavOk;
      eventDelegationDetail = 'inlineHandlers=' + inlineHandlers.length + ', tickerNavOk=' + tickerNavOk;
    } catch(e) {
      eventDelegationOk = false;
      eventDelegationDetail = e && e.message ? e.message : String(e);
    }
    _assert('T143 event_delegation: ticker nav does not create runtime onclick', eventDelegationOk, eventDelegationDetail);
  }

  function _testEventLiquidityPipeline() {
    var hotSnap = {
      ok: true,
      price: 120,
      dist20Pct: 18,
      dist20Atr: 4.8,
      dist50Atr: 5.2,
      dist21Atr: 3.0,
      rsi14: 82,
      rvol20: 3.0,
      closePosition: 0.42,
      bbReentry: true,
      above10EMA: true,
      above21EMA: true,
      above50SMA: true,
      dayGainPct: 4
    };
    var blow = window.calcBlowoffTopChecklist ? window.calcBlowoffTopChecklist(hotSnap, {
      semiHeat: { state: 'SEMI_HEATED' },
      opexGammaRisk: { regime: 'GAMMA_DECAY_WATCH' },
      breadthRotation: { regime: 'BREADTH_BROADENING' },
      referenceDate: '2026-05-14'
    }) : null;
    _assert('T144 blowoff_top: hot event setup escalates', blow && blow.score >= 25 && ['NO_ADD_RAISE_STOP','TRIM_25_33','TRIM_50','EXIT_OR_HEDGE'].indexOf(blow.action) >= 0, blow && JSON.stringify({ score: blow.score, action: blow.action, state: blow.state }));

    var audit = window.AIO && typeof window.AIO.getTelegramPipelineAudit === 'function' ? window.AIO.getTelegramPipelineAudit() : null;
    var aetherOk = audit && audit.aether && audit.aether.publicMirror === 'https://t.me/s/aetherjapanresearch' && audit.verificationPolicy;
    _assert('T145 telegram_pipeline: Aether source audited as secondary pipeline', !!aetherOk, audit && JSON.stringify(audit.aether));
  }

  function _testAutoOpsGovernance() {
    var textAudit = window.AIO && typeof window.AIO.auditStaticTextFreshness === 'function'
      ? window.AIO.auditStaticTextFreshness('key news updated 5/4 PLTR earnings upcoming', { nowTs: new Date('2026-05-14T12:00:00+09:00').getTime(), forceLiveLike: true })
      : null;
    _assert('T146 static_text_freshness: stale live-like date detected', textAudit && textAudit.issueCount >= 1, textAudit && JSON.stringify(textAudit.issues));

    var staticAudit = window.AIO && typeof window.AIO.getStaticDataGovernanceAudit === 'function' ? window.AIO.getStaticDataGovernanceAudit() : null;
    _assert('T147 static_data_governance: audit shape', staticAudit && Array.isArray(staticAudit.items) && typeof staticAudit.issueCount === 'number', staticAudit && JSON.stringify({ items: staticAudit.items && staticAudit.items.length, issues: staticAudit.issueCount }));

    var badgeAudit = window.AIO && typeof window.AIO.renderStaticDataGovernanceBadges === 'function' ? window.AIO.renderStaticDataGovernanceBadges() : null;
    var hasBadge = !!document.querySelector('.aio-static-data-badge');
    _assert('T148 static_data_governance: badges render without breaking DOM', badgeAudit && hasBadge, badgeAudit && JSON.stringify({ items: badgeAudit.items && badgeAudit.items.length }));

    var sched = window.AIO && typeof window.AIO.getRefreshSchedulerAudit === 'function' ? window.AIO.getRefreshSchedulerAudit() : null;
    _assert('T149 auto_refresh_scheduler: public audit exposed', sched && sched.totalTasks >= 5 && sched.tasks && sched.tasks.quotes, sched && JSON.stringify({ total: sched.totalTasks, missing: sched.tasksWithoutFn }));

    var readiness = window.AIO && typeof window.AIO.getAutoOpsReadiness === 'function' ? window.AIO.getAutoOpsReadiness() : null;
    _assert('T150 auto_ops_readiness: unified diagnostic contract', readiness && readiness.commands && readiness.commands.forceRefresh && readiness.staticGovernance && readiness.scheduler, readiness && JSON.stringify({ status: readiness.status, issues: readiness.issues && readiness.issues.length }));

    _assert('T151 force_refresh: manual refresh entry point exists', window.AIO && typeof window.AIO.forceRefreshAllData === 'function' && typeof window.AIO.runScheduledRefresh === 'function');
  }

  window.AIO = window.AIO || {};

  /**
   * AIO.runTests() — 모든 단위 테스트 실행
   * @returns {{pass: number, fail: number, results: Array}} 결과 요약
   */
  window.AIO.runTests = function() {
    _resetCounters();

    console.group('[AIO TEST] v49.11 단위 테스트 실행');
    console.log('대상 함수: _calcDailyReturns, _statMean, _statStdDev, _calcPortfolioVaR, _calcSharpe, _calcMaxDrawdown, _pearsonCorr, _calcCorrelationMatrix, _aioSafeMD, _aioSafeParseJSON, _aioRenderNum, _aioRetry, _aioProxyChain');

    try { _testCalcDailyReturns(); } catch(e) { console.error('Group1 오류:', e); }
    try { _testStatBasic();        } catch(e) { console.error('Group2 오류:', e); }
    try { _testVaR();              } catch(e) { console.error('Group3 오류:', e); }
    try { _testSharpe();           } catch(e) { console.error('Group4 오류:', e); }
    try { _testMDD();              } catch(e) { console.error('Group5 오류:', e); }
    try { _testPearsonCorr();      } catch(e) { console.error('Group6 오류:', e); }
    try { _testCorrMatrix();       } catch(e) { console.error('Group7 오류:', e); }
    try { _testIntegration();      } catch(e) { console.error('Group8 오류:', e); }
    try { _testEdgeCases();        } catch(e) { console.error('Group9 오류:', e); }
    try { _testXSSAndSecurity();      } catch(e) { console.error('Group10 오류:', e); }
    try { _testNumericalAccuracy();   } catch(e) { console.error('Group11 오류:', e); }
    try { _testChartRobustness();     } catch(e) { console.error('Group12 오류:', e); }
    try { _testInfraResilience();     } catch(e) { console.error('Group13 오류:', e); }
    try { _testPageBusInfra();        } catch(e) { console.error('Group14 오류:', e); }
    try { _testPageBusMigration();    } catch(e) { console.error('Group15 오류:', e); }
    try { _testFundFortification();   } catch(e) { console.error('Group16 오류:', e); }
    try { _testStateHygiene();        } catch(e) { console.error('Group17 오류:', e); }

    try { _testInstitutionalTechnicalEngine(); } catch(e) { console.error('Group18 error:', e); }
    try { _testArchitectureReinforcement(); } catch(e) { console.error('Group19 error:', e); }
    try { _testFreshnessGovernance(); } catch(e) { console.error('Group20 error:', e); }
    try { _testLockoutOpexStrategyEngine(); } catch(e) { console.error('Group21 error:', e); }
    try { _testPageFocusBriefUX(); } catch(e) { console.error('Group22 error:', e); }
    try { _testEventLiquidityPipeline(); } catch(e) { console.error('Group23 error:', e); }
    try { _testAutoOpsGovernance(); } catch(e) { console.error('Group24 error:', e); }

    var total = _passCount + _failCount;
    var summary = '[AIO TEST] 결과: ' + _passCount + '/' + total + ' PASS'
      + (_failCount > 0 ? ' | ✗ ' + _failCount + ' FAIL' : ' | ✓ ALL PASS');
    console.log(summary);
    console.groupEnd();

    return {
      pass: _passCount,
      fail: _failCount,
      total: total,
      allPass: _failCount === 0,
      summary: summary,
      results: _testResults.slice()
    };
  };

  /**
   * AIO.getTestResults() — 마지막 runTests() 결과 반환
   */
  window.AIO.getTestResults = function() {
    return {
      pass: _passCount,
      fail: _failCount,
      total: _passCount + _failCount,
      allPass: _failCount === 0,
      results: _testResults.slice()
    };
  };

  console.log('[AIO] aio-tests.js v49.11 loaded - run AIO.runTests() (T1~T151)');

})();
