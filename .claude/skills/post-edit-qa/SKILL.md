---
name: post-edit-qa
description: Deep QA 전수 조사. 22개 페이지, 10개 데이터 파이프라인, CSS/보안/접근성/성능 등 13개 티어 전수 점검.
---

# /qa -- Deep QA 전수 조사 (기본 모드)

## 목적
AIO Screener 전체를 12개 검증 티어에 걸쳐 전수 점검한다. 단순 div 균형 체크가 아닌, 모든 페이지/파이프라인/보안/접근성을 포괄하는 기관급 QA.

## 실행 전 필수 읽기
1. `_context/RULES.md` -- R1~R26 + P31~P41
2. `_context/BUG-POSTMORTEM.md` -- 최근 10건 (반복 패턴 확인)
3. `CHANGELOG.md` -- 최근 5개 항목 (최근 변경 영역 파악)

---

## TIER 1: 구조 무결성 (즉시 실행)

```bash
# 1-1. div 균형
echo "div open: $(grep -o '<div' index.html | wc -l), close: $(grep -o '</div' index.html | wc -l)"

# 1-2. 버전 6곳 동기화 (R1)
echo "=== title ===" && grep '<title>' index.html | head -1
echo "=== badge ===" && grep 'app-version-badge' index.html | grep -o '>v[^<]*<'
echo "=== APP_VERSION ===" && grep 'const APP_VERSION' index.html
echo "=== version.json ===" && cat version.json | grep version
echo "=== CLAUDE.md ===" && grep '현재 버전' _context/CLAUDE.md
echo "=== CHANGELOG ===" && head -5 CHANGELOG.md | grep '## v'

# 1-3. JS 구문 에러 (script 블록별)
# 브라우저 콘솔에서 확인 -- preview_console_logs level:error
```

판정: div 불균형 또는 버전 불일치 시 **즉시 중단 + 수정 후 재실행**

---

## TIER 2: 페이지 기능 전수 점검 (22개 페이지)

모든 페이지를 순회하며 확인. `showPage(id)` + 스크린샷 + 콘솔 에러 체크.

### 페이지 목록 및 점검 항목

**US 시장 (6개)**
| 페이지 | ID | 핵심 확인 |
|--------|-----|----------|
| 홈 대시보드 | home | 시세 카드 6개 렌더, 핵심뉴스 표시, 시장 품질/국면 카드 |
| 매매 시그널 | signal | 점수 게이지, CP 카드 8개, 브레드쓰 바, 스코어 바, 바닥 프로세스 |
| 차트/기술 | chart | TradingView 임베드, 건강도 점수, SPY/QQQ/VIX 카드 |
| 거시경제 | macro | 매크로 그리드, 7개 체크포인트, 금리 데이터 |
| 환율/채권 | fx-bond | 수익률 곡선 차트, FX 환율 테이블, 스프레드 |
| 테마/트렌드 | themes | RRG 차트, 섹터 퍼포먼스 바, 서브테마 그리드 |

**한국 시장 (5개)**
| 페이지 | ID | 핵심 확인 |
|--------|-----|----------|
| 한국 종합 | kr-home | KOSPI/KOSDAQ 시세, 외국인 동향 |
| 한국 기술 | kr-technical | 기술적 분석 결과 |
| 한국 매크로 | kr-macro | 한국 경제지표 |
| 한국 수급 | kr-supply | 기관/외인 수급 데이터 |
| 한국 테마 | kr-themes | 23개 테마, 종목 pill 정렬, 테마 퍼포먼스 랭킹 |

**분석/투자 (7개)**
| 페이지 | ID | 핵심 확인 |
|--------|-----|----------|
| 테마 상세 | theme-detail | 테마 심층 분석 카드 |
| 종목 분석 | ticker | 티커 입력 -> 분석 결과 렌더 |
| 기업 분석 | fundamental | SEC 재무 데이터, 밸류에이션 |
| 옵션 | options | 그리스, IV, 콜/풋 데이터 |
| 브레드쓰 | breadth | McClellan, A-D, 브레드쓰 차트 |
| 포트폴리오 | portfolio | 포지션 관리, 수익률 차트 |
| 시장 뉴스 | market-news | 뉴스 피드, 필터, 소스 표시 |

**유틸리티 (4개)**
| 페이지 | ID | 핵심 확인 |
|--------|-----|----------|
| 오늘의 브리핑 | briefing | AI 브리핑, 실시간 뉴스 |
| 사용 설명서 | guide | 정적 콘텐츠 (init 불필요) |
| 용어 사전 | glossary | 정적 콘텐츠 |
| 투자 심리 | mindset | 투자 원칙/격언 |

### 페이지별 공통 점검 매트릭스

각 페이지에서 확인:
- [ ] 페이지 진입 시 콘솔 에러 0건
- [ ] DOM 콘텐츠 비어있지 않음 ("--", "null", "undefined", "$0" 없음)
- [ ] 차트 렌더링 완료 (canvas에 그려짐, 빈 상자 아님)
- [ ] 수치 정확도 (가격, %, 카운트가 합리적 범위)
- [ ] 자동 갱신 동작 (aio:liveQuotes 이벤트 시 업데이트)
- [ ] 사이드바 네비게이션 정상
- [ ] 브라우저 뒤로가기 정상 (popstate)

실행 방법:
```javascript
// 브라우저에서 각 페이지 순회
['home','signal','chart','macro','fx-bond','themes','kr-home','kr-technical','kr-macro','kr-supply','kr-themes','theme-detail','ticker','fundamental','options','breadth','portfolio','market-news','briefing','guide','glossary','mindset'].forEach(function(p,i) {
  setTimeout(function(){ showPage(p); console.log('[QA] page: ' + p + ' OK'); }, i * 2000);
});
```

---

## TIER 3: 데이터 파이프라인 10개 검증

| # | 파이프라인 | 소스 | 변환 | DOM 타겟 | 검증 방법 |
|---|-----------|------|------|---------|----------|
| 1 | Live Quotes | Yahoo Finance | PriceStore | 264+ 요소 | `Object.keys(_liveData).length > 50` |
| 2 | FRED Macro | FRED API | DATA_SNAPSHOT | 매크로 그리드 | 차트/카드에 수치 표시 |
| 3 | News Feed | Finnhub/NewsData | scoreItem() | 뉴스 피드 | 피드에 기사 5건+ |
| 4 | Breadth | API/하드코딩 | calcSectorBreadth | 브레드쓰 차트 | 차트 데이터 포인트 존재 |
| 5 | Technical | 가격 데이터 | MA/RSI/MACD | 기술분석 카드 | 지표값 합리적 범위 |
| 6 | Sentiment | AAII/VIX | 차트 렌더링 | 심리 페이지 | 차트 3개+ 렌더 |
| 7 | Chart Data | Yahoo/Stooq | Chart.js | 캔버스 | 차트 인스턴스 존재 |
| 8 | Options | FMP | Greeks 계산 | 옵션 페이지 | IV/Delta 표시 |
| 9 | KRX Data | KR 프록시 | fetchKr* | 한국 페이지 | KOSPI/KOSDAQ 시세 |
| 10 | Telegram | rsshub/직접 | 필터링 | 뉴스 피드 | 텔레그램 뉴스 포함 |

```javascript
// 파이프라인 빠른 상태 확인
(function() {
  var ld = window._liveData || {};
  var checks = {
    liveQuotes: Object.keys(ld).length,
    spyPrice: ld['SPY'] ? ld['SPY'].price : 'MISSING',
    vixPrice: ld['^VIX'] ? ld['^VIX'].price : 'MISSING',
    newsCount: document.querySelectorAll('.news-item, .feed-item').length,
    chartInstances: Object.keys(Chart.instances || {}).length
  };
  console.log('[QA Pipeline]', JSON.stringify(checks));
})();
```

---

## TIER 4: 바/그래프/차트 정렬 점검

5개 바 패턴 + 차트 렌더링 전수 확인:

| 패턴 | 위치 | CSS 구조 | 확인 |
|------|------|---------|------|
| KR 종목 pill | kr-themes | grid 1fr auto auto auto + ::before bar | 열 정렬 일관성 |
| KR 테마 퍼포먼스 바 | kr-themes 하단 | grid 105px 1fr 58px, 양방향 | 중심선 + 바 정렬 |
| US 섹터 퍼포먼스 바 | themes | flex + 50% 중심선 | 양방향 바 정렬 |
| 서브테마 그리드 | themes | 4열 카드 + 내부 모멘텀 바 | 카드 간 높이 균등 |
| 점수/시장폭 바 | signal | grid 140px/120px 1fr 50px/44px 30px/80px | 4열 정렬 |

차트 점검:
- [ ] RRG 차트: 4사분면 + 데이터 포인트 표시
- [ ] 수익률 곡선: 올바른 tenor 순서 (3M->30Y)
- [ ] 센티먼트 차트: AAII/NAAIM 시계열
- [ ] 포트폴리오 도넛: 비중 합계 100%
- [ ] 브레드쓰 차트: 히스토리컬 시계열

---

## TIER 5: CSS/레이아웃 패턴 (R4~R8)

```bash
# 5-1. overflow 3중 방어 확인 (R5)
grep -c "overflow-y.*auto" index.html
grep -c "overflow-x.*hidden" index.html

# 5-2. 한국어 텍스트 오버플로우 방어 (R7)
grep -c "text-overflow.*ellipsis" index.html
grep -c "white-space.*nowrap" index.html

# 5-3. display:none 자식이 grid에 미치는 영향 (P40)
grep "display:none" index.html | grep -i "pill\|grid\|flex" | head -5

# 5-4. 반응형 브레이크포인트
grep -c "@media.*768\|@media.*480" index.html
```

브라우저에서 확인:
- [ ] 1440px (데스크톱): 모든 레이아웃 정상
- [ ] 768px (태블릿): 그리드 컬럼 축소, 텍스트 잘림 없음
- [ ] 480px (모바일): 사이드바 토글, 카드 1열 배치

---

## TIER 6: 보안 점검 (XSS/인젝션)

6개 고위험 함수의 사용자 입력 이스케이프 확인:

```bash
# 6-1. 사용자 입력이 innerHTML에 직접 삽입되는 곳
grep -n "innerHTML.*ticker\|innerHTML.*sym\|innerHTML.*input" index.html | head -10

# 6-2. escHtml() 래핑 확인
grep -n "escHtml" index.html | wc -l

# 6-3. 고위험 함수 목록
grep -n "analyzeTickerDeep\|analyzeKrTickerDeep\|showDataError\|updateFail\|updateProgress" index.html | grep "innerHTML" | head -10
```

확인 항목:
- [ ] `analyzeTickerDeep()` -- ticker 입력 escHtml 처리
- [ ] `analyzeKrTickerDeep()` -- ticker 입력 escHtml 처리
- [ ] `showDataError()` -- msg 파라미터 escHtml 처리
- [ ] `updateFail()` -- e.message escHtml 처리
- [ ] `updateProgress()` -- e.message escHtml 처리
- [ ] API 응답 (뉴스 제목, 회사명) -- 렌더 전 새니타이즈

---

## TIER 7: 접근성 (WCAG 2.1 AA)

```bash
# 7-1. aria 속성
grep -c "aria-label\|aria-live\|aria-hidden\|role=" index.html

# 7-2. skip-link
grep -n "skip.*link\|skip-nav" index.html | head -3

# 7-3. 랜드마크
grep -c "role=\"main\"\|role=\"nav\"\|role=\"banner\"\|role=\"complementary\"" index.html

# 7-4. 폰트 크기 하한 (P37: 11px 미만 금지)
grep -oP "font-size:\s*[0-9]+px" index.html | sort | uniq -c | sort -rn | head -10
```

확인 항목:
- [ ] 색상 대비 4.5:1 이상 (AA)
- [ ] Tab 키로 모든 인터랙티브 요소 접근 가능
- [ ] 포커스 인디케이터 시각적 표시
- [ ] 스크린 리더: aria-label 주요 요소에 부착
- [ ] 키보드 단축키: Esc로 모달/패널 닫기

---

## TIER 8: 데이터 무결성 (R10~R15)

```bash
# 8-1. R15 위반: d.pct || 0 패턴 (금지)
grep -n "\.pct || 0\|\.pct||0" index.html | head -10

# 8-2. _ldSafe 사용률 vs raw 접근
echo "ldSafe: $(grep -c '_ldSafe' index.html), raw ld[: $(grep -c "ld\['" index.html)"

# 8-3. KNOWN_TICKERS 구성 검증
grep -A5 "KNOWN_TICKERS" index.html | head -10

# 8-4. FX_INVERTED 완전성
grep -A10 "FX_INVERTED" index.html | head -12

# 8-5. SUB_THEMES weights 합계 100 검증
# Python이나 JS로 각 서브테마 weights 합산
```

확인 항목:
- [ ] 모든 종목 코드 실재 (phantom ticker 없음, R10)
- [ ] 비상장 기업 매핑 없음 (ghost stock 없음, R11)
- [ ] 모자회사 구분 정확 (R12)
- [ ] 데이터 미수신 vs 0% 구분 (R15)
- [ ] FX 반전 목록 완전 (CADUSD, CHFUSD 포함)

---

## TIER 9: 뉴스 필터링 품질 (R16~R18, R22)

```bash
# 9-1. 3글자 미만 키워드 (R17 위반)
grep -A50 "MACRO_KW\|TECH_KW\|MED_KW" index.html | grep -oP "'[A-Za-z]{1,2}'" | head -10

# 9-2. 티커 표시 규칙 (R16)
grep -n "isCompanyNews\|macro.*ticker\|hideTickerForMacro" index.html | head -10

# 9-3. 텔레그램 채널 가용성 (R18)
grep -n "_TG_UNAVAILABLE\|_TG_DIRECT_ONLY" index.html | head -10

# 9-4. 뉴스 3단계 선별 (R22)
grep -n "score.*90\|score.*45\|score.*30" index.html | head -10
```

---

## TIER 10: 성능/메모리

```bash
# 10-1. 타이머 중복 위험
grep -c "setInterval\|jitteredInterval" index.html
grep -c "clearInterval" index.html

# 10-2. Chart.js 인스턴스 관리
grep -c "destroyPageCharts\|\.destroy()" index.html

# 10-3. 이벤트 리스너 해제
grep -c "removeEventListener" index.html
```

브라우저에서 확인:
- [ ] 페이지 전환 5회 후 메모리 증가 < 20MB
- [ ] setInterval 누적 없음 (DevTools > Performance > Timers)
- [ ] Chart.js "Canvas is already in use" 경고 없음

---

## TIER 11: Dead Page 방지 (R9)

각 동적 페이지에 3종 세트 확인:

```bash
# 11-1. init 함수 존재
grep -n "function init.*Page\|function init.*Charts\|function refresh.*Page\|function update.*Page" index.html | head -20

# 11-2. aio:pageShown 리스너
grep -n "aio:pageShown" index.html | head -15

# 11-3. aio:liveQuotes 리스너
grep -n "aio:liveQuotes" index.html | head -15
```

매트릭스: 각 동적 페이지에 init + pageShown + liveQuotes 3개 모두 있는지 확인

---

## TIER 12: 종목/테마 데이터 품질

```bash
# 12-1. SUB_THEMES 가중치 합계 100 검증
# 각 서브테마의 weights 값 합산

# 12-2. KR_THEME_MAP 가중치 합계 100 검증
# 각 한국 테마의 w 값 합산

# 12-3. 상폐/파산 위험 종목 스캔
# LCID, STEM, SSNLF 같은 종목이 남아있지 않은지
grep -n "LCID\|STEM\|SSNLF\|BTBT\b" index.html | head -10

# 12-4. KR_STOCK_DB themes 배열 정합성
# 각 종목의 themes 배열에 나열된 테마가 KR_THEME_MAP에 실존하는지
```

---

## 최종 리포트 형식

```
# AIO Screener Deep QA Report v{버전}

실행일: {날짜}
실행자: Claude Agent

## 요약
| 티어 | 영역 | 점검 항목 | PASS | FAIL | WARN |
|------|------|----------|------|------|------|
| T1 | 구조 무결성 | 3 | 3 | 0 | 0 |
| T2 | 페이지 기능 (22p) | 154 | 150 | 2 | 2 |
| T3 | 데이터 파이프라인 | 10 | 8 | 1 | 1 |
| ... | ... | ... | ... | ... | ... |
| 합계 | | {N} | {N} | {N} | {N} |

## FAIL 항목 (즉시 수정 필요)
1. ...
2. ...

## WARN 항목 (검토 필요)
1. ...

## 수정 완료 항목
1. ...

## 권장사항
1. ...
```

---

## TIER 13: Dead Static HTML / applyDataSnapshot 매핑 전수 확인 (v42.4 추가)

> **배경**: v42.4 전수 QA에서 4개 FAIL 발견 — DOM ID는 있으나 JS 업데이트 없음, data-snap 키가 applyDataSnapshot map에서 누락, breadth 차트 데이터 6주 괴리. 코드 리뷰만으로 발견 불가. grep 전수 확인 필수.

```bash
# 13-1. applyDataSnapshot map에 없는 data-snap 키 탐지
# HTML에 선언된 data-snap 값 목록
grep -oP 'data-snap="[^"]*"' index.html | sort -u

# JS map에 등록된 키 목록 (applyDataSnapshot 함수 내)
grep -A200 "const map = {" index.html | grep -oP "'[a-z-]+(?=':)" | sort -u

# 차집합 확인: HTML에는 있지만 map에 없는 키 = 하드코딩 고정값
# 발견 시 → 해당 DATA_SNAPSHOT 필드 연결 필수

# 13-2. ID 선언 vs JS 업데이트 함수 존재 여부 (Dead DOM 탐지)
# "항상 —을 보이는 요소" 패턴: id 있으나 getElementById/querySelector 없음
# 중점 확인 대상: signal 페이지 지표 바, breadth 바 행, technical 페이지 게이지
grep -n 'id="bb-.*-bar\|id="bb-.*-val\|id="bb-.*-badge"' index.html | head -10
grep -n 'getElementById.*bb-' index.html | head -10

# 13-3. Canvas ID 선택자 querySelector null 위험
# .querySelector('div') 패턴: 자식이 없을 때 null → .style 접근 시 TypeError
grep -n "querySelector('div')" index.html | head -10

# 13-4. 브레드쓰 차트 데이터 날짜 범위 (2주 이상 괴리 금지, R21)
grep -n "bpLabels\|bhLabels" index.html | head -5
# 마지막 날짜가 현재 기준 10거래일 이내인지 확인

# 13-5. 브레드쓰 전역 캐시 동기화 (window._breadth* vs 차트 배열 마지막 값)
grep -n "window._breadth" index.html | head -10
# _breadth5, _breadth200, _breadth50, _breadthNDX5/20/50 6개 모두 존재하는지 확인

# 13-6. destroyPageCharts 모든 canvas-heavy 페이지 케이스 존재 확인
grep -n "if (pageId === '" index.html | grep -i "destroyPageCharts" -A1 | head -20
# 누락 페이지: themes, macro, options, kr-macro 등
```

**브라우저에서 확인:**
```javascript
// Dead DOM 탐지: 페이지 로드 후 "—" 상태로 남아 있는 업데이트 대상 요소
(function() {
  var deadIds = [];
  ['bb-5sma-val','bb-20sma-val','bb-50sma-val',
   'bb-rsp-val','breadth-pct','bp-ndx5-val','bp-ndx20-val','bp-ndx50-val'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el && (el.textContent === '—' || el.textContent === '')) deadIds.push(id);
  });
  if (deadIds.length) console.warn('[QA T13] Dead DOM 의심:', deadIds);
  else console.log('[QA T13] Dead DOM 없음 ✓');

  // applyDataSnapshot 실행 확인
  var retailEl = document.querySelector('[data-snap="retail-sales"]');
  if (retailEl && retailEl.textContent === '+0.6%') console.log('[QA T13] data-snap 매핑 정상 ✓');
  else console.warn('[QA T13] data-snap retail-sales 미갱신:', retailEl && retailEl.textContent);
})();
```

**판정 기준:**
- Dead DOM 아이디 발견 → FAIL (JS 업데이트 함수 연결 또는 섹션 제거)
- data-snap 키 매핑 누락 → FAIL (applyDataSnapshot map 추가)
- 브레드쓰 차트 날짜 10거래일 초과 괴리 → WARN (데이터 갱신 권고)
- `querySelector('div')` null 위험 패턴 → FAIL (직접 style 적용으로 수정)

---

## TIER 14: 동적 텍스트 + CHAT_CONTEXTS 콘텐츠 검증 (v45.6 신설)

> 배경: v45.6 CONTENT-AUDIT에서 홈 브리핑 하드코딩(F1), macro Pro 전쟁 극점 고착(F3), 5개 CHAT_CONTEXTS 미정의 발견. 코드 구조가 아니라 **콘텐츠가 데이터와 연결되어 있는지** 검증하는 티어.

### 14-1. 동적 텍스트 생성 함수 하드코딩 점검

```bash
# refreshHomeDashboard 섹터 브리핑 — 하드코딩 잔존 여부
grep -n "topSector\|bottomSector" index.html | grep -v "_sectorETFs\|_sPcts\|function\|var \|//" | head -5
# 결과에 고정 문자열('에너지', 'XLE 99%ile' 등) 있으면 FAIL

# macro Pro 시나리오 — 전쟁 극점 수치 잔존 여부
grep -n "퍼펙트 스톰\|6,368\|Brent \$113\|전쟁 5주차" index.html | head -5
# 결과 0건이 목표

# fedRate 해설 "동결" 하드코딩 여부
grep -n "fedRate.*동결" index.html | grep -v "fedStatus\|DATA_SNAPSHOT.fed" | head -5
# 결과 0건이 목표

# portfolio 지정학 "전쟁 지속" 잔존 여부
grep -n "전쟁 지속.*Brent \$120\|호르무즈 봉쇄 위험" index.html | head -5
# 결과 0건이 목표
```

### 14-2. CHAT_CONTEXTS 정합도 점검

```bash
# 정의된 컨텍스트 키 목록
grep -n "CHAT_CONTEXTS\['" index.html | head -20

# chatSend 호출되는 컨텍스트 키 목록
grep -n "chatSend('" index.html | grep -oP "chatSend\('([^']+)" | sort -u

# 미정의 컨텍스트 = chatSend 호출 키 중 CHAT_CONTEXTS에 없는 것
# signal, breadth, sentiment, theme-detail → 미정의 시 silent failure (응답 없음)
```

### 14-3. CHAT_CONTEXTS 시나리오 수치 vs DATA_SNAPSHOT 대조

```javascript
// 브라우저에서 실행 — CHAT_CONTEXTS 시나리오 텍스트 내 수치와 실시간 데이터 비교
(function() {
  var ctx = CHAT_CONTEXTS['macro'];
  if (!ctx) return 'macro context not found';
  var sys = typeof ctx.system === 'function' ? ctx.system() : ctx.system;
  // "SPX" 뒤의 숫자, "Brent $" 뒤의 숫자 추출
  var spxMatch = sys.match(/SPX[:\s]+([0-9,.]+)/);
  var brentMatch = sys.match(/Brent \$([0-9,.]+)/);
  return { spxInPrompt: spxMatch?.[1], spxLive: DATA_SNAPSHOT.spx, brentInPrompt: brentMatch?.[1], brentLive: DATA_SNAPSHOT.brent };
})();
```

판정:
- 동적 함수 내 하드코딩 고정 텍스트 → FAIL
- CHAT_CONTEXTS 미정의 → FAIL (silent failure = 사용자 체감 무응답)
- 시나리오 수치와 DATA_SNAPSHOT ±20% 괴리 → WARN (갱신 권고)

---

## Gotchas (과거 반복 실수)

1. **"코드 고쳤다" != "동작한다"** -- 수정 후 반드시 브라우저에서 확인. 코드 레벨 검증만으로 완료 선언 금지.
2. **init 가드 미리셋** -- `if (initialized) return;` 패턴에서 destroy 시 플래그를 false로 리셋 안 하면 페이지 재진입 실패.
3. **APP_VERSION 누락** -- v38.4 사고: HTML title/badge만 수정하고 `const APP_VERSION` JS 상수를 놓침.
4. **`d.pct || 0` 패턴 금지** -- 미수신(null)과 진짜 0% 구분 불가. 명시적 null 체크 필수.
5. **Yahoo Finance meta에 변동률 없음** -- `regularMarketChangePercent` 필드 없음, 수동 계산 필요.
6. **display:none 자식 + CSS Grid** -- grid 배치에서 완전히 제외되어 열 매핑 파괴 (P40).
7. **KNOWN_TICKERS Set 생성자** -- `new Set([...], extra)` 형태에서 extra 인자 무시됨 (v41.7 사고).
8. **FX_INVERTED 누락** -- 새 통화 페어 추가 시 반전 목록 미등록하면 PriceStore 300+ 경고.
9. **querySelector('div') null** -- v42.4 사고: `el.querySelector('div').style.width` 에서 자식이 없으면 null → TypeError. ID 요소가 직접 bar일 경우 `el.style.width` 직접 적용.
10. **applyDataSnapshot map 누락** -- v42.4 사고: HTML에 `data-snap="retail-sales"` 등 4개 존재하나 map에 없어 HTML 하드코딩 고정. data-snap 추가 시 map도 함께 추가.
11. **Dead Section vs 시각적 오해** -- 사용자가 보고한 "숫자 안 바뀜" = Dead DOM일 가능성 높음. ID 존재 여부 + JS 업데이트 함수 연결 여부를 항상 코드 레벨에서 확인 (TIER 13).
12. **브레드쓰 차트 날짜 괴리** -- v42.4 사고: bpLabels가 2/20~3/19 범위로 6주 이상 구식. 데이터 갱신 없이 계속 표시됨. DATA_SNAPSHOT 갱신 시 브레드쓰 배열도 함께 갱신 필요.
13. **data-snap grep이 주석을 오탐** -- `grep 'data-snap="[^"]*"' index.html`이 `// data-snap="키" 속성이 있는 모든 요소에 값을 주입합니다.` 같은 주석 라인을 포함. T13 실행 시 `grep -v "^[[:space:]]*//"` 필터 추가 필요. 또는 `grep -n 'data-snap='` 후 라인 번호로 컨텍스트 확인.
14. **TECH_KW 단독 키워드 grep 과대 포착** -- `grep -A200 "TECH_KW"` 는 배열 범위 밖의 코드까지 포함해 'B', 'C' 같은 오탐 발생. TECH_KW/MACRO_KW 배열 내부만 정확히 추출하려면 배열 시작(`[`)과 끝(`]`) 사이만 grep해야 함. 오탐으로 R17 FAIL 오판 주의.
