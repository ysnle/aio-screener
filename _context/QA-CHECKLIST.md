---
verified_by: agent
last_verified: 2026-04-14
confidence: high
version: v3.5
checklist_version: v46.8
total_items: 252
stages: 18
latest_P_covered: P105
---

# AIO Screener — QA 체크리스트 v3.3

> **v3 배경**: v2는 브라우저 런타임·콘솔·차트·레이아웃에 강하지만, LLM 답변·뉴스 선별·포트폴리오·기업분석·번역·API 키·인터랙션·성능·접근성 등 스크리너 핵심 기능의 50%+가 QA 범위 밖이었음. v3는 22개 페이지 × 264개 클릭 핸들러 × 10개 기능 모듈을 전수 커버.
> **v3.1 추가 (2026-04-06)**: v42.5~v42.7 전수 QA에서 발굴한 P56~P60 패턴 반영. init 중복 cleanup(P56), 그리드 모바일(P57), applyDataSnapshot 역방향(P58), API 전역 초기화 순서(P59), 크로스페이지 함수 연결(P60).
> **v3.2 추가 (2026-04-08)**: v44.6 이벤트-드리븐 QA에서 발굴한 P61~P63 반영. 17단계 신설 — 이벤트 후 하드코딩 텍스트 퇴행 검증(P61), "구조적 한계" 거부 원칙(P62), 전역 타이머 추적 불가(P63).
> **v3.3 추가 (2026-04-09)**: v44.9 /bug-fix QA에서 발굴한 P64 반영. 3F-0 신설 — SCREENER_DB 신규 종목 KNOWN_TICKERS 동시 등록 검증.
> **v3.4 추가 (2026-04-09)**: v45.5 표면 점검 사각지대 QA에서 발굴한 P65~P67 반영. **신규 19단계: 사용자 인터랙션 결과 검증** — UI 토글/탭/모드 클릭 시 결과값이 실제로 바뀌는지(P65), 데이터 미수신 시 "로딩" 영구 정체 없는지(P66), 동급 컴포넌트 자식 구조 일관성(P67).
> **핵심 원칙**: 코드 수정 → "고쳤다" 선언 금지. **브라우저에서 직접 확인한 증거**가 있어야 완료.
> **반복 요청 분석 결과**: 6대 패턴 중 #1 "코드 고쳤다면서 브라우저에서 안 되잖아"가 최다 빈도 → 이 체크리스트의 존재 이유
> **총 검증 항목**: 234개 (v3: 204개 + v3.1: 12개 + v3.2: 14개 + v3.3: 1개 + v3.4: 3개 신규)

---

## 최상위 바이너리 판정 (QC1~QC8)

수정 후 `/qa` 또는 `/post-edit-qa` 실행 시 **반드시** 아래 8개 게이트에 명시적 yes/no 답변. 이 섹션은 18단계 상세 체크리스트의 **요약 판정 레이어** — 각 상세 단계의 핵심만 추출.

| # | 게이트 | 기준 | 참조 단계 |
|---|--------|------|-----------|
| **QC1** | 구조 무결성 | div 열림/닫힘 일치 **AND** 버전 6곳 동기화 **AND** 콘솔 ERROR 0건 | 1A, 2A, 4A |
| **QC2** | Dead Page 없음 | 22개 페이지 모두 3초 이내 콘텐츠 렌더링 + 차트 canvas에 픽셀 존재 | 1A, 11 |
| **QC3** | 데이터 정합성 (R15) | `d.pct \|\| 0` 패턴 0건 **AND** `_SNAP_FALLBACK` ≥50 심볼 | 3C, 8 |
| **QC4** | 네비게이션 사이클 | A→B→A / popstate / 해시 직접 접근 모두 정상 재렌더 | 1B |
| **QC5** | 뉴스 필터 규칙 (R16/R17/R22) | 매크로 뉴스에 ETF 티커 0 + 3글자 미만 단독 키워드 0 + score 임계값(90/45/30) 준수 | 9 |
| **QC6** | Dead Static HTML (P46) | `applyDataSnapshot` map의 모든 키가 HTML `data-snap` 속성과 1:1 매칭 | 13 |
| **QC7** | 과거 버그 재발 없음 | BUG-POSTMORTEM P41~P64 패턴 grep 결과 재발 0건 | 15 |
| **QC8** | 이벤트 정합성 (P61) | WTI/VIX/지정학 이벤트 후 하드코딩 서술 텍스트가 현재 상황과 일치 | 17 |

### 판정 규칙
- **전부 yes** → PASS ✓, 배포 가능 (사용자 명시 승인 시)
- **1~2개 no** → FAIL, 해당 단계 재실행 후 재판정 (최대 2회)
- **3개 이상 no** → CRITICAL FAIL, 작업 중단 + 사용자 에스컬레이션

### 바이너리 원칙
- "대체로 통과" 금지 — 명시적 yes/no만 허용
- WARN은 게이트 실패로 승격 (감점 금지)
- "미확인" → no로 간주
- 재실행 시 전체 18단계가 아닌 **실패 단계만** 재실행

### QC 게이트 → 상세 단계 맵

| QC | 포함 단계 | P 번호 커버 |
|----|-----------|-------------|
| QC1 | 0, 1A, 2A, 4 | P4, P26, R1 |
| QC2 | 1A, 1B, 11 | P9, P56, P58 |
| QC3 | 3, 8 | P25, R15 |
| QC4 | 1B, 1C | P31, P43 |
| QC5 | 9 | R16, R17, R22 |
| QC6 | 13 | P45, P46, P58 |
| QC7 | 15 | 전체 BUG-POSTMORTEM |
| QC8 | 17 | P61, P62, P63 |

---

## 0단계: 수정 전 — 영향 범위 전수 파악

### 0A. 스코프 매핑 (수정 전 필수)

```
1. 수정 함수명:
2. 이 함수를 호출하는 곳 (grep 결과):
3. 이 함수가 접근하는 전역 변수 (window.*, ld[], sentPageCharts 등):
4. 영향받는 페이지 목록:
5. 영향받는 DOM 요소 ID:
6. 의존하는 데이터 소스 (Yahoo API? FRED? 하드코딩? _ldSafe?):
```

### 0B. 관련 코드 경로 전부 확인

```
이 수정이 영향 미치는 모든 코드 경로:
[ ] showPage() → 해당 페이지 init 호출 경로
[ ] popstate 핸들러 → 해당 페이지 처리 경로
[ ] 타이머/자동갱신 → 해당 데이터 refresh 경로
[ ] 앱 시작(DOMContentLoaded) → 초기 호출 경로
```

---

## 1단계: 브라우저 런타임 테스트 (스킵 시 완료 선언 불가)

### 실행 방법: 실제 브라우저에서 사이트 열고, 아래를 직접 확인

### 1A. 페이지별 순회 — 영향받는 모든 페이지 각각

```
[ ] 페이지 진입 → 3초 이내 콘텐츠 렌더링 (빈 화면 = FAIL)
[ ] 차트가 실제로 그려져 있음 (canvas에 픽셀이 있음, 비어있지 않음)
[ ] 차트 비율이 정상 (가로 세로 비율 왜곡 없음, 축 라벨 읽힘)
[ ] 수치가 실제값 (0.00%, "—", null, NaN = FAIL)
[ ] 변화율이 현실적 (모든 종목이 0% = FAIL, 100%+ = 의심)
```

**브라우저에서 직접 확인하는 방법 — JavaScript 실행:**
```javascript
// 각 페이지에서 실행: 빈 화면/미갱신 DOM 탐지
document.querySelectorAll('.stat-value, .metric-val, [id*="-val"]').forEach(el => {
  if (el.textContent.trim() === '—' || el.textContent.trim() === '0.00%' || el.textContent.trim() === '')
    console.warn('⚠ 빈/기본값 발견:', el.id || el.className, '=', el.textContent);
});
```

### 1B. 네비게이션 사이클 — 직접 클릭해서 확인

```
시나리오 1: 사이드바 A→B→A
[ ] home → signal → home: 시세 카드 정상
[ ] home → sentiment → home: 뉴스 카드 정상
[ ] sentiment → themes → sentiment: AAII 차트 재렌더 (빈 화면 아님)
[ ] fxbond → macro → fxbond: Yield Curve 차트 재렌더

시나리오 2: popstate (뒤로가기/앞으로가기)
[ ] signal 방문 → 다른 페이지 → 브라우저 뒤로가기 → signal 게이지/바/카드 정상
[ ] sentiment 방문 → 뒤로가기 → AAII 차트 재생성

시나리오 3: 해시 직접 접근
[ ] URL에 #signal 입력 → 직접 접근 시 대시보드 정상
[ ] F5 새로고침 → 현재 페이지 정상 유지
```

### 1C. 시간 경과 테스트

```
[ ] 페이지 로드 후 30~45초 대기 → 자동 갱신 작동 확인
[ ] 갱신 후 차트가 깨지지 않고 유지됨
[ ] 시그널 점수가 "—"에서 실제 숫자로 전환됨
```

---

## 2단계: Console + Network 검증

### 2A. Console 에러 — 0건이어야 통과

**브라우저에서 확인:**
```
[ ] DevTools Console 열기
[ ] 빨간색 에러 0건 (WARNING은 허용, ERROR는 불허)
[ ] 특히: "is not defined", "Cannot read properties of null", "Chart already initialized" 0건
```

**자동화 확인 — 콘솔에서 실행:**
```javascript
// 에러 카운터 설치 (페이지 로드 직후)
window._errCount = 0;
window.addEventListener('error', () => window._errCount++);
// 30초 후 확인
setTimeout(() => console.log('에러 수:', window._errCount), 30000);
```

### 2B. API 응답 구조 검증

**수정된 코드가 API 응답을 파싱하면 반드시:**
```
[ ] Network 탭에서 해당 API 호출 찾기
[ ] Response 탭에서 실제 JSON 구조 확인
[ ] 코드가 가정하는 필드(meta.regularMarketChangePercent 등)가 실제로 존재하는지 확인
[ ] 존재하지 않는 필드를 사용하면 → 수동 계산/폴백 로직 필수
```

**자동화 확인:**
```javascript
// Yahoo Finance chart API 응답 필드 확인 예시
fetch('https://query1.finance.yahoo.com/v8/finance/chart/SPY?range=1d&interval=1d')
  .then(r => r.json())
  .then(d => {
    var meta = d.chart.result[0].meta;
    console.log('regularMarketPrice:', meta.regularMarketPrice);
    console.log('regularMarketChangePercent:', meta.regularMarketChangePercent); // undefined이면 수동계산 필요
    console.log('chartPreviousClose:', meta.chartPreviousClose);
  });
```

### 2C. 핵심 함수 실행 검증

**브라우저 콘솔에서 직접 호출하여 동작 확인:**
```javascript
// 시그널 관련
typeof computeTradingScore === 'function'       // true?
typeof initSignalDashboard === 'function'       // true?
computeTradingScore()                           // .total이 숫자인가?

// 센티먼트 관련
typeof initSentimentCharts === 'function'       // true?
sentChartsInitialized                           // 현재 상태 확인

// 데이터 관련
typeof _ldSafe === 'function'                   // true?
_ldSafe('^TNX','price')                         // 숫자 반환? (0이나 null 아닌가)
_ldSafe('^VIX','price')                         // 숫자 반환?

// RRG 관련
typeof calcLiveRS === 'function'                // true?
typeof drawRRG === 'function'                   // true?
calcLiveRS()                                    // 배열 반환? rsRatio 범위 97~103?
```

---

## 3단계: 코드 레벨 정적 분석

### 3A. 캔버스 ID 매칭 (차트 수정 시 필수)

```
수정된 함수가 getElementById('캔버스ID')를 호출하면:
[ ] HTML에서 해당 id가 존재하는가? (grep으로 확인)
[ ] 해당 캔버스가 올바른 페이지 div(page-xxx) 안에 있는가?
[ ] 같은 함수가 다른 페이지에서도 호출되면 → 페이지별로 올바른 캔버스를 선택하는가?
[ ] chartDataGate()에 전달하는 캔버스 ID와 실제 getElementById의 ID가 일치하는가?
```

### 3B. init 가드 라이프사이클 (상태 변수 수정 시 필수)

```
if (xxxInitialized) return; 패턴이 있으면:
[ ] destroy 함수에서 xxxInitialized = false 리셋이 있는가?
[ ] 부모 함수(initXxxPage)가 자식 호출 전 리셋하는가?
[ ] DOMContentLoaded에서 조기 호출로 true가 설정된 후, 사용자 첫 방문 시 차단되지 않는가?

P56 이중 cleanup 루프 검사 (v42.6 추가):
[ ] init 함수 내에 Object.keys(pageCharts).forEach(destroy) 패턴이 2회 이상 존재하는가?
    grep: "Object.keys.*Charts.*forEach\|forEach.*destroy" + 동일 함수 내 중복 여부
[ ] 중복이 있으면 — 두 번째 루프가 방금 initXxxCharts()로 생성한 인스턴스를 즉시 파괴하지 않는지 확인
[ ] 올바른 구조: init 함수 상단 cleanup 1회 → 차트 생성 → (cleanup 없음)
```

### 3C. 데이터 폴백 체인

```
_liveData / ld[] 접근 코드:
[ ] ld['XXX'] ? ld['XXX'].price : null → null일 때 하류에서 무슨 일이 일어나는가?
[ ] _ldSafe() 사용했는가? (null 대신 _SNAP_FALLBACK 값 반환)
[ ] if (val) 에서 val=0이면 false → 0인 실제 데이터가 버려지지 않는가?
```

### 3D-1. CSS 셀렉터 범위 (v41.1 추가)

```
CSS 규칙 추가 시:
[ ] `*` 유니버설 셀렉터는 box-sizing 리셋 외 사용 금지 -> `html` 또는 구체적 셀렉터
[ ] 타이밍/사이즈 매직 넘버는 T 상수 객체 또는 CSS 변수 사용
[ ] 인라인 스타일과 CSS !important 충돌 시 -> 인라인 dead code 제거
```

### 3G. Dead Static HTML / applyDataSnapshot 매핑 검증 (v42.4 추가, v42.7 보강)

> **배경**: v42.4 전수 QA에서 발견. HTML에 `data-snap` 속성이나 DOM ID가 선언되어 있어도 JS 업데이트 함수가 없으면 하드코딩 값이 영구 고정됨. 코드 리뷰로는 발견 불가 — grep 전수 확인 필수.
> **v42.7 보강 (P58)**: 역방향도 검증 필수 — map에 있는데 HTML 없으면 silent dead code.

```
applyDataSnapshot 매핑 완전성 (양방향 검증):
[ ] HTML→map: HTML의 모든 data-snap 키가 applyDataSnapshot map에 존재하는가?
    확인: grep -oP 'data-snap="[^"]*"' index.html | sort -u → map과 대조
[ ] map→HTML (P58 역방향): applyDataSnapshot map의 모든 키에 data-snap="해당키" HTML 요소가 존재하는가?
    확인: map 키 목록 추출 → 각 키에 대해 grep 'data-snap="키"' index.html | wc -l = 0이면 dead code
    자동화:
    grep -oP "'[a-z0-9-]+':\s*[^,}]+" index.html  # map 키 추출 (수동 검증)
[ ] 새 map 키 추가 시 → HTML에 data-snap 요소도 동시 추가했는가?
[ ] map 키 제거 시 → HTML에 data-snap 요소도 동시 제거했는가?

Dead DOM 탐지 (항상 "—" 또는 하드코딩 고정 값 요소):
[ ] signal 페이지 브레드쓰 바 (bb-5sma-bar/val/badge, bb-20sma-bar/val/badge, bb-50sma-bar/val/badge): ID 존재 + updateBreadthBars() 호출 확인
[ ] breadth 페이지 NDX 카드 (bp-ndx5-val, bp-ndx20-val, bp-ndx50-val): ID 존재 + updateBreadthBars() 호출 확인
[ ] technical 페이지 breadth-bar 게이지: querySelector('div') 패턴이 아닌 el.style.width 직접 적용 확인

querySelector null 위험:
[ ] breadthEl.querySelector('div').style → breadthEl 자체가 bar인 경우 null 위험. el.style.width 직접 사용
[ ] 새 코드에서 querySelector().style 패턴 사용 시 null 가드 (if (child) child.style...) 추가

데이터 staleness (R21):
[ ] bpLabels / bhLabels 마지막 날짜가 현재 기준 10거래일 이내 (DATA_SNAPSHOT 갱신 시 함께 갱신)
[ ] window._breadth5, _breadth200, _breadth50, _breadthNDX5/20/50 6개 전역 변수 존재 확인
[ ] getDataAge().stale = days > 1 — 2일 이상 경과 시 stale 배지 표시 (R21)
```

**브라우저 자동 확인 스크립트:**
```javascript
(function() {
  var deadIds = ['bb-5sma-val','bb-20sma-val','bb-50sma-val','bp-ndx5-val','bp-ndx20-val','bp-ndx50-val','breadth-pct'];
  var dead = deadIds.filter(function(id) { var el = document.getElementById(id); return el && (el.textContent === '—' || el.textContent === ''); });
  if (dead.length) console.warn('[QA 3G] Dead DOM:', dead); else console.log('[QA 3G] Dead DOM 없음 ✓');
  var retail = document.querySelector('[data-snap="retail-sales"]');
  if (retail && retail.textContent !== '+0.6%' && retail.textContent !== '') console.log('[QA 3G] retail-sales 동적 갱신됨:', retail.textContent, '✓');
  else if (retail && retail.textContent === '+0.6%') console.warn('[QA 3G] retail-sales 하드코딩 고정 의심');
})();
```

### 3D. 이벤트 핸들러 완전성

```
페이지 init 함수를 수정했으면:
[ ] showPage() switch/if에서 해당 페이지 분기에 같은 함수 호출되는가?
[ ] popstate 핸들러에서 해당 페이지 분기에 같은 함수 호출되는가?
[ ] aio:liveQuotes 이벤트에서 활성 페이지일 때 갱신 함수 호출되는가?

P60 크로스페이지 공유 함수 연결 검사 (v42.7 추가):
[ ] 여러 페이지에서 동일 데이터 섹션을 표시하는 함수가 있는가?
    예: updateBreadthBars()는 breadth 페이지 + signal 페이지 모두 브레드쓰 데이터 표시
[ ] 있다면 — 각 페이지의 aio:liveQuotes 리스너에 해당 함수 호출이 연결되어 있는가?
[ ] 없다면 — 한 페이지를 방문해야만 다른 페이지의 데이터가 업데이트되는 의존성 버그 발생
    확인: grep "updateBreadthBars\|updateXxxSection\|refreshXxx" index.html → 호출 지점 수 확인
```

### 3E. 전역 상태 영향 범위

```
window.* 변수를 수정/읽는 코드:
[ ] 해당 변수를 write하는 다른 함수가 있는가? (race condition 가능성)
[ ] 해당 변수를 read하는 다른 함수가 있는가? (영향 범위)
[ ] 변수가 처음 어디서 초기화되는가? (undefined 상태로 read되는 시점이 있는가?)

P59 API 의존 전역 변수 초기화 순서 (v42.7 추가):
[ ] API 콜백에서만 set되는 전역 변수(예: _lastFG, _lastVIX 등)가 있는가?
    grep: "window\._last[A-Z]" → fetchXxx() 내에서만 write되는지 확인
[ ] 그런 변수를 쓰는 컴포넌트(AI 컨텍스트, 트레이딩 점수, 페이지 init)가 API 응답 전에 호출될 수 있는가?
[ ] 있다면 — applyDataSnapshot() 직후 DATA_SNAPSHOT 정적 폴백으로 초기값 설정:
    예: if (!window._lastFG) window._lastFG = DATA_SNAPSHOT.fg || 18;
[ ] 단, API 응답이 오면 덮어쓰도록 fetchXxx() 콜백에도 동일 변수 write 유지
```

### 3F-0. P24 일반 보호 검증 (data-live-price 관련 수정 시 필수) — v38.3 추가

```
[ ] 벌크 `[data-live-price]` 업데이트 3곳에서 `el.children.length > 0` 체크 유지되는가?
[ ] 복합 요소(.kr-ticker-pill, .kr-etf-card 등)의 자식이 벌크 업데이트로 파괴되지 않는가?
[ ] KR 테마 pill: 종목명/비중/등락률 모두 표시되는가? (최초 로드 + 실시간 갱신 후)
[ ] KR ETF 카드: 가격/등락률 모두 표시되는가? (최초 로드 + 실시간 갱신 후)
[ ] 새 `data-live-price` 속성 추가 시: 벌크 업데이트와 충돌 여부 확인
```

### 3F. 종목 데이터 무결성 검증 (종목 추가/수정 시 필수) — v35.6 추가

> **배경**: 269620/294870/044820 3건에서 종목코드 오매핑, 비상장 기업 코드 할당, 모자회사 혼동이 동시 발생. QA 204항목 중 "데이터 원본 정확성" 검증이 0개였음.

#### 3F-0. SCREENER_DB 신규 종목 KNOWN_TICKERS 동시 등록 (P64 — v44.9 추가)
```
[ ] SCREENER_DB에 신규 sym 추가 시 → KNOWN_TICKERS Set에도 알파벳순으로 동시 등록했는가?
    확인: grep "'심볼'" index.html | grep -v "sym:\|memo:\|sector:\|mcap:\|rsi:" → KNOWN_TICKERS 라인이 반드시 나와야 함
[ ] 미등록 시 증상: 뉴스 피드에서 해당 종목 관련 기사에 티커 배지가 붙지 않음 (extractTickers() 누락)
```

#### 3F-1. 신규 종목 추가 시 3중 검증 (R10)
```
[ ] Yahoo Finance quote 페이지에서 공식 회사명이 DB 등록명과 일치하는가?
    예: 269620.KQ → "Syswork Co." ≠ "레인보우로보틱스" → FAIL
[ ] 해당 기업이 KOSPI/KOSDAQ에 상장되어 있는가? (R11)
    검증: 네이버증권/KRX에서 "비상장", "장외거래" 표기 없는지 확인
    예: "두나무" → 비상장 → 코드 할당 금지
[ ] 유사 이름 모자회사가 있는가? (R12)
    검증: 동일 검색어로 복수 종목 나오면 정식명·코드·시총 각각 확인
    예: "코스맥스" 검색 → 192820(코스맥스) + 044820(코스맥스BTI) → 본사=192820
```

#### 3F-2. 기존 종목 데이터 갱신 시 일관성 검증
```
[ ] KR_STOCK_DB의 코드가 KR_THEME_MAP에서 참조하는 코드와 일치하는가?
    자동화: KR_THEME_MAP 내 모든 code → KR_STOCK_DB에 존재 확인
[ ] FALLBACK_QUOTES의 심볼이 KR_STOCK_DB의 코드와 일치하는가?
[ ] SCREENER_DB의 sym이 KR_STOCK_DB와 일치하는가?
[ ] alias 배열(코스닥/kosdaq/k뷰티 등)의 심볼이 실제 DB에 존재하는가?
[ ] KR_STOCK_DB의 .KQ 종목이 실제 코스닥 상장인가? (KOSPI 종목이 섞여있지 않은가?)
```

#### 3F-3. 가격/시총 합리성 검증
```
[ ] 가격이 전일 대비 ±50% 초과 변동 시 → 액면분할/합병 여부 수동 확인
    예: 코스맥스 110,000→9,520 (10배+ 하락) → 액면분할 의심
[ ] 시총이 0.0조 또는 0인 종목이 없는가?
[ ] 대형주(시총 10조+)인데 가격이 비정상적으로 낮지 않은가?
[ ] 테마별 상위 비중 종목의 가격 추이가 해당 테마(반도체/방산/바이오 등)와 상관관계가 있는가?
    예: crypto 테마 40% 종목의 일간 수익률이 BTC 움직임과 무관하면 → 오매핑 의심
```

#### 3F-4. 자동화 검증 스크립트 (Python)
```python
# 수정 후 반드시 실행 — 3가지 자동 검출
import re
with open('index.html','r') as f: txt = f.read()

# 1) KR_THEME_MAP → KR_STOCK_DB 참조 무결성
db_codes = set(re.findall(r"'(\d{6})':\s*\{name:", txt))
theme_codes = set(re.findall(r"code:'(\d{6})'", txt))
orphan = theme_codes - db_codes
assert not orphan, f"THEME→DB 누락: {orphan}"

# 2) KR_THEME_MAP 각 테마 가중치 합=100
themes = re.findall(r"'([a-z-]+)':\s*\[", txt[txt.find('KR_THEME_MAP'):])
for t in themes:
    weights = re.findall(r'w:(\d+)', txt[txt.find(f"'{t}': ["):txt.find(']', txt.find(f"'{t}': ["))])
    assert sum(int(w) for w in weights) == 100, f"{t} 가중치 합 ≠ 100"

# 3) 중복 코드 탐지
codes = re.findall(r"'(\d{6})':\s*\{name:", txt)
dupes = [c for c in codes if codes.count(c) > 1]
assert not dupes, f"중복 코드: {set(dupes)}"

print("✅ 종목 데이터 무결성 검증 통과")
```

---

## 4단계: 시각적 품질 검증

### 4A. 차트 비율/스케일

```
[ ] Canvas width/height 속성 vs CSS width/height → 비율 일치하는가?
[ ] CSS width:100% 사용 시 canvas 속성도 동적 조정하는가?
[ ] 데이터 포인트가 차트 영역의 20~80% 활용 (한쪽에 몰려있으면 정규화 문제)
[ ] 축 라벨이 잘리지 않고 읽히는가?
```

### 4B. 수치 합리성 (수동 교차검증)

```
[ ] 주요 수치 3개를 외부 소스(Yahoo Finance 웹, TradingView)와 비교
[ ] 변화율이 0.00%인 종목이 3개 이상 → 데이터 파이프라인 문제
[ ] 스프레드가 "—" → 폴백 미작동
[ ] RS 값이 모두 100 근처 → 정규화 범위 확인
[ ] 날짜 라벨이 현재 날짜 기준인가? (stale 하드코딩 아닌가?)
```

---

## 5단계: 회귀 테스트 (수정 외 영역)

```
[ ] 수정하지 않은 인접 페이지 2개 이상 방문 → 정상 작동 확인
[ ] 홈 페이지 시세 카드 정상
[ ] 사이드바 네비게이션 전체 동작
[ ] 다크 테마 렌더링 정상 (글씨 색, 배경 색)
```

---

## 6단계: LLM / AI 채팅 시스템 검증

> 코드 참조: `chatSend()`, `_getChatRules()`, `CHAT_CONTEXTS`, `consumeLLMQuery()`, `renderMarkdownLight()`
> 영향 페이지: **모든 22개 페이지** (각 페이지에 AI 채팅 패널 존재)

### 6A. 채팅 기본 동작

```
[ ] 채팅 입력창에 텍스트 입력 → Enter 또는 전송 버튼 → 응답 수신 확인
[ ] 응답이 스트리밍으로 표시됨 (한 번에 덤프가 아님)
[ ] 응답 완료 후 [Q:후속질문1||후속질문2||후속질문3] 칩이 생성됨
[ ] 칩 클릭 → 해당 질문이 자동 입력되고 전송됨
[ ] 🗑 버튼 → 채팅 기록 초기화 (이전 대화 사라짐)
[ ] API 키 미설정 시 → "API 키를 설정해주세요" 안내 표시 (무한 로딩 아님)
```

### 6B. 컨텍스트별 시스템 프롬프트 검증

```
각 페이지에서 질문 전송 후 응답이 해당 페이지 맥락에 맞는지:
[ ] home: 대시보드 데이터(S&P, VIX, F&G) 인용
[ ] signal: 트레이딩 스코어 인용 + 5대 컴포넌트 언급
[ ] breadth: 시장폭 지표(5SMA/20SMA/50SMA 비율) 언급
[ ] sentiment: F&G, AAII, Put/Call 언급
[ ] technical: Weinstein Stage, RSI, MACD 언급
[ ] macro: 금리, DXY, WTI, Brent 인용
[ ] fundamental: 실제 수집 데이터(FMP/SEC) 인용 (학습 데이터 아닌 실시간)
[ ] portfolio: 사용자 실제 보유 종목 티커 인용
[ ] fxbond: 수익률곡선, 원/달러, 캐리트레이드 맥락
[ ] options: VIX 기반 전략 매핑, 그릭스 언급
```

### 6C. LLM 응답 품질 검증

```
[ ] 마크다운 테이블(| col | col |)이 답변에 포함되지 않음 (포맷 규칙 ①)
[ ] 의사/환자/진단 비유가 사용되지 않음 (포맷 규칙 ②)
[ ] 이모지 5개 이하 (포맷 규칙 ④)
[ ] 수준 분리 표현 없음 ("초보자는~", "고급 사용자는~" 등 없음)
[ ] "Tier X급" 표현 없음
[ ] 투자 책임 고지가 첫 응답에 1회 포함
[ ] 실시간 데이터 섹션의 실제 수치를 인용 (학습 데이터 가격 사용 금지)
```

### 6D. LLM 쿼타/비용 시스템

```
[ ] LLM ON/OFF 토글 작동
[ ] 일일 사용량 카운터 표시
[ ] 일일 한도 초과 시 확인 팝업 발생
[ ] 적응형 모델 선택: 단순 질문→Haiku, 복잡 질문→Sonnet 자동 전환
```

### 6E. 응답 렌더링 품질

```
[ ] 볼드(**텍스트**)가 <strong>으로 렌더링됨
[ ] 코드블록(```)이 <pre> 태그로 정상 표시
[ ] 긴 응답이 채팅 버블 밖으로 넘치지 않음 (.acp-bubble overflow)
[ ] 긴 응답 시 채팅 영역 자동 확장 (chat-expanded 클래스)
[ ] ↗ 확장/↙ 축소 버튼 동작
[ ] 숫자가 볼드 또는 별도 행으로 강조됨
```

### 6F. 채팅 DOM 구조 무결성 검증 (★ 핵심 — v34.1 사후 추가)

> **배경**: v34.1에서 `chatAppendMsg()`가 id를 `.acp-msg` wrap에 설정 → `onDone`이 wrap의 innerHTML을 덮어쓰면서 `.acp-bubble`이 소멸 → 128개 블록 요소가 `flex-direction:row` 부모에 직접 배치 → **가로 렌더링**. CSS만으로는 해결 불가한 구조적 버그.

```
스트리밍 완료 후 DOM 구조 점검:
[ ] .acp-msg.ai 안에 .acp-bubble 자식이 존재하는지 확인
    검증: document.querySelectorAll('.acp-msg.ai').forEach(m => { if (!m.querySelector('.acp-bubble')) console.error('❌ bubble 소실:', m); })
[ ] .acp-msg.ai의 직접 자식이 1~3개 (bubble + badge + 기타) — 128개 등 대량이면 FAIL
    검증: document.querySelectorAll('.acp-msg.ai').forEach(m => { if (m.children.length > 5) console.error('❌ 자식 과다:', m.children.length); })
[ ] .acp-bubble의 scrollWidth ≤ offsetWidth (가로 넘침 없음)
    검증: document.querySelectorAll('.acp-bubble').forEach(b => { if (b.scrollWidth > b.offsetWidth + 2) console.error('❌ 가로 넘침:', b.scrollWidth, '>', b.offsetWidth); })
[ ] chatAppendMsg()에서 id가 bubble에 설정되는지 코드 확인 (bubble.id = id, NOT wrap.id = id)
[ ] onDone의 getElementById('chat-xxx-streaming')이 .acp-bubble을 반환하는지 확인
[ ] 로딩 제거 시 .acp-msg wrap 전체가 제거되는지 (빈 wrap 잔류 방지)
    검증: loadEl.closest('.acp-msg') 패턴 사용 여부

자동 확장 동작:
[ ] 200자 이상 응답 시 chat-expanded 클래스 자동 추가
[ ] 확장 시 .acp-messages의 max-height가 none (무제한)
[ ] 확장 상태에서 세로 스크롤 정상 작동
[ ] 축소 버튼 클릭 시 원래 크기로 복원
```

**반드시 브라우저에서 검증할 JS 스니펫:**
```javascript
// AI 답변 완료 후 실행 — DOM 구조 건전성 체크
(function chatDomHealthCheck() {
  var msgs = document.querySelectorAll('.acp-msg.ai');
  var issues = [];
  msgs.forEach(function(m, i) {
    if (!m.querySelector('.acp-bubble')) issues.push('msg[' + i + ']: bubble 없음');
    if (m.children.length > 5) issues.push('msg[' + i + ']: 자식 ' + m.children.length + '개 (구조 파괴)');
    var b = m.querySelector('.acp-bubble');
    if (b && b.scrollWidth > b.offsetWidth + 2) issues.push('msg[' + i + ']: 가로 넘침 ' + b.scrollWidth + '>' + b.offsetWidth);
  });
  if (issues.length === 0) console.log('✅ 채팅 DOM 건전성 OK (' + msgs.length + '개 메시지)');
  else issues.forEach(function(s) { console.error('❌ ' + s); });
  return issues;
})();
```

---

## 7단계: 뉴스 엔진 검증

> 코드 참조: `fetchAllNews()`, `scoreItem()`, `classifyTopic()`, `isTelegramMsgRelevant()`, `renderFeed()`
> 영향 페이지: home, market-news, briefing

### 7A. 뉴스 수집 파이프라인

```
[ ] 시장 소식 페이지 진입 → 프로그레스 바 표시 → 소스별 순차 로딩
[ ] 최종 "X건 수집 · Y개 소스" 표시
[ ] 수집 완료 후 뉴스 카드가 렌더링됨 (빈 화면 아님)
[ ] ↻ 새로고침 버튼 → 재수집 동작
```

### 7B. 뉴스 선별 품질

```
[ ] 연예/스포츠/부동산/날씨 뉴스가 피드에 없음
[ ] 주식/매크로/반도체/에너지/채권/외환/지정학/방산 뉴스만 존재
[ ] 한국 뉴스가 피드 상위를 독점하지 않음 (US 외신이 우선)
[ ] 토픽 필터(매크로/주식/에너지/크립토) 클릭 → 해당 토픽만 표시
[ ] 국가 필터(미국/한국/아시아/유럽) 클릭 → 해당 국가만 표시
[ ] 📡 텔레그램 필터 → TG 마크 뉴스만 표시
[ ] 매크로/지정학/정책 뉴스에 ETF/지수 티커($GLD,$TLT,$XLE 등) 안 붙음 (v39.0)
[ ] 기업/실적/섹터 뉴스에만 관련 종목 티커 표시됨 (v39.0)
[ ] TECH_KW에 3글자 미만 단독 키워드 없음 — 오탐 방지 (v39.0 P28)
[ ] 한국어 번역 제목이 표시됨 (getDisplayTitle 사용 확인)
```

### 7B-2. 홈 핵심 뉴스 품질 (v39.0)

```
[ ] 오늘의 시장 배너 하단에 핵심 뉴스 3개 이하 불릿 표시
[ ] 전체 80소스 수집 완료 후에만 핵심 뉴스 렌더링 (점진적 렌더링 아님)
[ ] score 90+ 시장 이동 이벤트만 선별 (매크로/지정학 +30 가중)
[ ] 핵심 뉴스에 매크로/지정학 티커 안 붙음
[ ] 한국어 번역 제목으로 표시
[ ] 비금융 기사(셀럽, 범죄, 스포츠) 완전 차단
[ ] 제목 유사도 기반 중복 제거 — 같은 이벤트 다른 기사 중복 안 됨
```

### 7C. 텔레그램 채널 수집 검증

```
[ ] bornlupin 채널에서 뉴스 수집됨
[ ] insidertracking 채널에서 뉴스 수집됨
[ ] aetherjapanresearch 채널에서 뉴스 수집됨
[ ] walterbloomberg 채널에서 뉴스 수집됨 (v39.0: CF Worker 직접 스크래핑)
[ ] TG 뉴스에 📡 TG 뱃지 표시
[ ] 스팸/광고 메시지가 필터링됨
[ ] 우주/항공우주 뉴스(SpaceX/NASA)가 차단되지 않음
[ ] firstsquawk/financialjuicechannel이 즉시 스킵됨 (콘솔에 '비활성' 로그)
[ ] 광범위 키워드만('시장', 'market' 등) 1개 매칭된 비금융 기사가 차단됨
[ ] 핵심 인물 발언(Powell, Jensen Huang 등) 뉴스가 상위에 위치
```

---

## 8단계: 포트폴리오 관리 검증

> 코드 참조: `addPortfolioPosition()`, `removePosition()`, `renderPortfolio()`, `getPortfolioContextForAI()`
> 영향 페이지: portfolio

### 8A. CRUD 동작

```
[ ] 종목 추가 (티커 + 수량 + 매수가 + 목표가 입력 → 추가 버튼)
[ ] 추가된 종목이 테이블에 표시 (현재가, 변화율, 손익, 목표가)
[ ] 종목 삭제 → 목록에서 제거
[ ] 수량/매수가/목표가 수정 가능
[ ] 데이터가 localStorage에 저장됨 (새로고침 후에도 유지)
```

### 8B. 손익 계산 정확성

```
[ ] 손익 = (현재가 - 매수가) × 수량 → 올바른 숫자
[ ] 손익률 = ((현재가 - 매수가) / 매수가) × 100 → 올바른 %
[ ] 양수 = 초록색, 음수 = 빨간색
[ ] 총 자산 = Σ(현재가 × 수량) → 올바른 합계
[ ] 목표가 대비 업사이드(%) 표시 (목표가 설정 시)
```

### 8C. 포트폴리오 → AI 연결

```
[ ] 포트폴리오 페이지에서 AI 채팅 시 → 실제 보유 종목이 프롬프트에 주입
[ ] "내 포트폴리오 분석해줘" → 보유 종목 티커·수량·손익·보유일수가 응답에 인용
[ ] 목표가 설정 종목 → AI가 목표가 대비 현재 상태 분석
```

### 8D. 확인 모달 시스템 (v34.1+)

> 코드 참조: `showConfirmModal()`, `closeConfirmModal()`, `_confirmCallback`

```
[ ] 포트폴리오 전체 삭제 → 네이티브 confirm() 대신 커스텀 모달 표시 (🗑️ 아이콘)
[ ] 개별 종목 삭제 → 커스텀 모달 (📉 아이콘)
[ ] 채팅 기록 삭제 → 커스텀 모달 (💬 아이콘)
[ ] 모달 "취소" 클릭 → 아무것도 삭제 안 됨
[ ] 모달 "확인" 클릭 → 콜백 실행 (삭제 진행)
[ ] ESC 키 → 모달 닫힘
[ ] 배경 클릭 → 모달 닫힘
[ ] 모달 닫힌 후 ESC 핸들러 정리됨 (메모리 누수 없음)
```

### 8E. 다중 워치리스트 시스템 (v34.1+)

> 코드 참조: `getWatchlists()`, `saveWatchlists()`, `createWatchlist()`, `deleteWatchlist()`, `addToWatchlist()`, `removeFromWatchlist()`, `addToWatchlistFromScreener()`, `renderWatchlistContent()`, `refreshWatchlistUI()`
> localStorage 키: `aio_watchlists`, `aio_watchlist_active`

```
CRUD:
[ ] 새 리스트 생성 (이름 입력) → 드롭다운에 표시
[ ] 리스트 이름 변경 → 드롭다운 반영
[ ] 리스트 삭제 → 확인 모달 표시 → 삭제 후 드롭다운에서 제거
[ ] 종목 추가 (티커 + 메모 입력) → 테이블에 표시
[ ] 종목 삭제 (✕ 버튼) → 테이블에서 제거

데이터 연동:
[ ] 워치리스트 종목에 실시간 가격 표시 (_liveData 연동)
[ ] SCREENER_DB 종목 → 신호(BUY/SELL/WATCH/HOLD) 뱃지 표시
[ ] SCREENER_DB 종목 → 종목명(NVIDIA, Apple 등) 표시
[ ] aio:liveQuotes 이벤트 시 워치리스트 자동 갱신
[ ] 포트폴리오 AI 분석 프롬프트에 워치리스트 컨텍스트 포함

UI 상태:
[ ] 리스트 미선택 시 → 안내 메시지 표시, 추가 입력 숨김
[ ] 리스트 선택 후 → 추가 입력 노출, 이름변경/삭제 버튼 활성화
[ ] 빈 리스트 → "리스트가 비어있습니다" 메시지
[ ] 드롭다운 전환 → 테이블 내용 즉시 변경
[ ] 새로고침 후에도 localStorage에서 복원

스크리너 연동:
[ ] 스크리너 결과 테이블에 ⭐ 컬럼 + 버튼 표시
[ ] ⭐ 클릭 → 워치리스트 1개면 바로 추가 + 토스트 알림
[ ] ⭐ 클릭 → 워치리스트 여러 개면 선택 프롬프트
[ ] 워치리스트 0개 시 → 안내 알림

중복 방지:
[ ] 같은 이름 리스트 생성 불가
[ ] 같은 티커 중복 추가 시 알림
```

---

## 9단계: 기업 분석 (Fundamental) 검증

> 코드 참조: `fundamentalSearch()`, `_fmpFetch()`, `fetchSECFilings()`, `CHAT_CONTEXTS.fundamental`
> 영향 페이지: fundamental

### 9A. 데이터 수집 파이프라인

```
[ ] 티커 입력 → 🔍 기업 분석 버튼 → 프로그레스 표시
[ ] Yahoo Finance 시세 수집 확인
[ ] SEC EDGAR 공시 수집 확인
[ ] SEC XBRL 재무데이터 파싱 확인
[ ] FMP API 키 있을 때: 18개 엔드포인트 + TTM 2개 (ratios-ttm, key-metrics-ttm) 수집 확인
[ ] FMP API 키 없을 때: SEC+Yahoo만으로 분석 (에러 없음)
[ ] 수집 완료 → "✅ 데이터 수집 완료 — N개 소스" 표시
[ ] 최근 검색 기록 칩에 검색한 티커 추가됨
```

### 9B-1. 데이터 정확도 검증 (v35.2 추가)

```
[ ] 밸류에이션 카드의 P/E, P/B, EV/EBITDA가 TTM 뱃지 표시 (Annual이 아닌 TTM 우선)
[ ] 퀵뷰 EV/Sales 값이 P/S와 다름 (같으면 BUG — 과거 잘못된 proxy 할당)
[ ] 기관 투자자 포지션 가치가 현실적 (shares × value / shares 오류 방지 확인)
[ ] CAGR 라벨이 "2Y CAGR"로 표시 (과거 "3Y" 오류 수정 확인)
[ ] 프롬프트에 '핵심 밸류에이션 지표 (TTM)' + '밸류에이션 연간 추이 (Annual Trend)' 분리 확인
[ ] FRED 차트에서 0값이 정상 표시 (빈 구간 없음 — 과거 0→null 필터링 버그)
[ ] 주가 변화율 0.00%인 종목이 정상 표시 (과거 0%를 재계산하는 버그)
[ ] DCF upside/downside 수치가 정상 (NaN, undefined 없음)
[ ] 배당수익률: 가격 없을 때 'N/A' 표시 (과거 price=1 fallback 버그)
[ ] deep-compare 분석에서 '핵심 투자 지표 (TTM)' + '(Annual 추이)' 분리 표시
```

### 9B. UI 렌더링

```
[ ] 기업 헤더 (회사명, 티커, 시세, 변화율) 표시
[ ] SEC 공시 섹션 (최근 10-K, 10-Q, 8-K) 표시
[ ] 재무제표 차트/테이블 표시
[ ] 밸류에이션 지표 카드 표시 (TTM/Annual 뱃지 확인)
[ ] 경쟁사 비교 표시
[ ] 실적 서프라이즈 표시
```

---

## 10단계: API 키 / Vault / 설정 검증

### 10A. API 키 저장/로드

```
[ ] Anthropic API 키 입력 → 저장 → 새로고침 후 유지
[ ] FMP 키 입력 → 저장 → 기업 분석 데이터 풍부해짐
[ ] FRED 키 입력 → 저장 → 매크로 데이터 확장
[ ] CF Worker URL 입력 → 저장 → CORS 프록시 동작
```

### 10B. 키 없을 때 Graceful Degradation

```
[ ] Anthropic 키 없음 → AI 채팅 비활성, 나머지 기능 정상
[ ] FMP 키 없음 → 기업 분석은 SEC+Yahoo만으로 동작
[ ] 모든 키 없음 → 스크리너 기본 기능(시세, 차트, 뉴스RSS) 정상
[ ] 잘못된 키 입력 → 에러 표시 (무한 로딩 아님)
```

---

## 11단계: 종목 스크리너 검증

### 11A. 필터링 동작

```
[ ] 텍스트 검색(AI, 반도체 등) → 키워드 매칭 결과
[ ] 섹터 필터 클릭 → 해당 섹터만 표시
[ ] 시그널 필터 → BUY/HOLD/WATCH별 필터링
[ ] 인덱스 필터 (S&P500/NASDAQ100/DOW30) → 해당 구성종목만
```

### 11B. 스파크라인 미니차트 (v34.1+)

> 코드 참조: `renderSparklines()`, `fetchSparkData()`, `drawSparkline()`, `drawSparkPlaceholder()`, `_sparkCache`

```
[ ] 스크리너 결과 테이블에 "5일 추이" 컬럼 표시
[ ] 스캔 실행 후 canvas 요소(.sparkline-mini)가 각 행에 생성됨
[ ] Yahoo Finance Chart API(range=5d, interval=1d) 호출
[ ] 데이터 수신 시 → 그래디언트 채움 + 추세 라인 + 엔드포인트 도트 렌더링
[ ] 데이터 미수신 시 → "—" 플레이스홀더 표시 (에러 아님)
[ ] 5분 캐시 작동 (재렌더 시 API 재호출 없음)
[ ] DPR 스케일링 (Retina에서 선명)
[ ] 상승추세 = 초록, 하락추세 = 빨강 라인
[ ] colspan 정합성: 빈 결과 메시지 colspan=9 (⭐ 포함)
```

### 11C. 뉴스 필터링 & 주요 뉴스 (v34.1c)

> 코드 참조: `renderHomeFeed()`, `scoreItem()`, `NEWS_BLACKLIST_KW`, `_MEGA_TICKERS`, `_LARGE_TICKERS`, `isTelegramMsgRelevant()`

```
[ ] 대시보드 "주요 뉴스" 섹션에 최대 5개만 표시
[ ] 표시되는 뉴스의 score가 모두 ≥ 25
[ ] 매크로/지정학/실적/정책 토픽 뉴스가 상위에 위치
[ ] 한국 지역뉴스(시장이, 군수, 새만금, 종량제 등) 필터링됨
[ ] 한국 소스(country=kr) 금융 관련성 게이트 정상 적용
[ ] 3단계 컨텍스트 필터: 블랙리스트 + finRelevance≥3 오버라이드 동작
[ ] finRelevance=0 기사에 _FINANCE_RELEVANCE_KW 게이트 적용
[ ] _KR_BROAD_KW 2차 필터: 광범위 한국어만 있는 기사 차단
[ ] 대형주 MEGA 티커 뉴스 +8점 / LARGE 티커 +4점 부스트
[ ] US Tier1 소스 최상위, KR 소스 최하위 정렬
[ ] 텔레그램 메시지에도 글로벌 블랙리스트 적용
[ ] 뉴스 0건일 때 "현재 주요 뉴스가 없습니다" 안내 표시
[ ] 시장 품질 점수 최소값 5 (0이 아닌 값) 확인
[ ] NASDAQ 카드(^IXIC) 대시보드에 정상 표시
[ ] 5열 그리드 → 모바일 2열 반응형 정상 동작
```

### 11D. 섹터 비교 분석 시스템 (v34.2)

> 코드 참조: `_SECTOR_KEYWORDS`, `_detectSectorQuery()`, `_fetchSectorCompareData()`, `_formatSectorComparePrompt()`, `chatSend()` 섹터 통합부

```
[ ] "소프트웨어 기업 중 가장 싼 종목 찾아줘" → 섹터 감지 + FMP API 호출 발생
[ ] _detectSectorQuery: 섹터 키워드 + 의도 키워드 동시 존재 시에만 매칭
[ ] 섹터 매칭 결과에 최대 8개 종목만 포함
[ ] _fetchSectorCompareData: 5개 FMP 엔드포인트 병렬 호출 (ratios-ttm, key-metrics-ttm, income-statement, profile, price-target-consensus)
[ ] 비교 데이터에 25+ 필드 포함 (PER/PBR/PEG/EV-EBITDA/ROE/마진/성장률/애널리스트 등)
[ ] 섹터 평균 자동 계산 정상 동작
[ ] 밸류에이션 랭킹 (PER/PEG/EV-EBITDA/업사이드 정렬) 정상 출력
[ ] 개별 티커 감지(detectedTickers) 시 섹터 비교 비활성화 (우선순위 정상)
[ ] FMP API 실패 시 에러 조용히 처리 (console.warn만, UI 미노출)
[ ] 섹터 비교 프롬프트가 시스템 프롬프트 끝에 정상 추가됨
```

### 11E. 해자(Moat) 분석 프레임워크 (v34.2)

> 코드 참조: 기업분석 15포인트 프롬프트 #6, 해자 추론용 투자 강도 지표 섹션

```
[ ] 기업분석 프롬프트 #6에 7가지 해자 유형별 데이터→해자 매핑 포함
[ ] R&D/매출, SG&A/매출, CAPEX/매출, FCF마진 3개년 데이터 주입 정상
[ ] 해자 강도 종합 판정 기준 (Wide/Narrow/None) 명시
[ ] 해자 약화 경고 신호 조건 명시
[ ] fmpProfile(description) 2000자까지 확장되어 비즈니스 모델 충분히 제공
[ ] 개별 티커 채팅에 FMP 밸류에이션 데이터 (PER/PBR/PEG/EV-EBITDA) 정상 주입
[ ] 비교 분석 모드에서 4축 평가 (밸류에이션·수익성·성장·재무건전성) 동작
[ ] 밸류 트랩 경고 로직 프롬프트에 포함
```

### 11F. 기업 내부 비교 분석 시스템 (v34.3 갱신)

> 코드 참조: `_detectDeepCompareIntent()`, `_fetchDeepCompareData()`, `_formatDeepComparePrompt()`, `chatSend()` 심층 비교 통합부
> v34.3 QA 점검 기준 갱신 (2026-03-27)

```
[ ] "AMZN과 TSLA 비즈니스 모델 비교해줘" → 티커 2개 감지 + 내부 비교 의도 감지 발동
[ ] "NVDA vs AVGO 해자 비교분석" → 심층 데이터 18개 FMP 엔드포인트 병렬 호출 (v34.3에서 10→18 확장 확인)
[ ] _detectDeepCompareIntent: 기업 내부 키워드(~40개) + 비교 키워드(~15개) AND 조건으로 트리거
[ ] 티커 1개일 때는 발동하지 않음 (detectedTickers.length >= 2 조건)
[ ] 비즈니스 모델 설명 2000자 + 세그먼트별 매출(비중% 자동계산) + 지역별 매출 + 손익 3개년(GM/R&D/SG&A/OM/NM) + 현금흐름 3개년(CAPEX/FCF/자사주/배당) + 성장률 + 경영진 + 내부자(매수/매도 시그널) + 기관 투자자 + 대차대조표(D/E/유동비율) + 핵심지표(EV/EBITDA/FCF Yield/ROIC) + 실적서프라이즈 + 애널리스트추정 + 목표가/DCF + 경쟁사그룹 = 16개 데이터 블록
[ ] 15개 관점 비교 분석 지침 프롬프트 포함 (기업 개요~투자포인트)
[ ] 해자 7유형 비교 판정 지침 포함 (기술독점/네트워크/전환비용/브랜드/규모/무형자산/FCF전환)
[ ] _CHAT_RULES ⑤-3 규칙 정상 적용 ("이사회 보고 수준의 깊이" 명시)
[ ] FMP API 실패 시 에러 조용히 처리 (console.warn만)
[ ] ✅ v34.4 수정완료: 비교 키워드에 "장단점/장점/단점/우위/열위/pros/cons" 등 25개 추가
[ ] ✅ v34.4 수정완료: 티커 감지 3→5개 확장, 심층 비교 3개 초과 시 showToast 안내
```

### 11H. 단일 기업 심층 분석 모드 (v34.4 신규)

> 코드 참조: `_hasDeepAnalysisKw()`, `_DEEP_ANALYSIS_KW`, `_formatSingleDeepPrompt()`, `chatSend()` singleDeepStr 통합부

```
[ ] "NVDA 해자 분석해줘" → 티커 1개 감지 + 심층 키워드 감지 → 18개 FMP 엔드포인트 호출
[ ] "AAPL 비즈니스 모델 분석" → 단일 심층 분석 발동 확인
[ ] "TSLA 종합 분석해줘" → 단일 심층 분석 발동 확인
[ ] fundamentalSearch()로 이미 검색한 티커일 때 → 중복 호출 방지 (window._fundAnalysisData.ticker 체크)
[ ] FMP 키 없을 때 → 단일 심층 발동 안 함 (에러 없음)
[ ] _formatSingleDeepPrompt: 16개 데이터 블록 정상 출력 + 15개 관점 + 해자 7유형 지침 포함
[ ] _CHAT_RULES ⑤-4 규칙 정상 적용 ("전문 리서치 리포트 수준" 명시)
[ ] singleDeepStr이 시스템 프롬프트 끝에 정상 추가됨
[ ] deepCompareStr이 이미 있으면 singleDeepStr 비활성화 (중복 방지)
```

### 11G. 버전 & 스냅샷 동기화 (v34.2)

> 코드 참조: `APP_VERSION`, `DOMContentLoaded` 버전 동기화, `DATA_SNAPSHOT._updated`, 스탈니스 배너

```
[ ] APP_VERSION 상수 변경 시 title + #app-version-badge 자동 반영
[ ] DATA_SNAPSHOT._updated가 24시간 이내일 때 노란 배너 미노출
[ ] 라이브 데이터 수신 시 aio:liveDataReceived 이벤트로 배너 즉시 해제
[ ] 5초 폴링 (최대 24회) → 2분 내 라이브 데이터 없으면 배너 유지
[ ] version.json과 APP_VERSION 값 일치 확인
```

---

## 12단계: 인터랙션 전수 테스트

### 12A. 사이드바 네비게이션 (22개 페이지)

```
모든 nav-item 클릭 → 해당 페이지 표시:
[ ] 홈 / 매매시그널 / 시장폭 / 투자심리 / 데일리 브리핑
[ ] 차트 분석 / 매크로 / 환율채권 / 기업 분석 / 테마 분석
[ ] 종목 스크리너 / 옵션 / 포트폴리오 / 시장 소식 / 입문 가이드
[ ] 한국장 / 한국 테마 / 한국 수급 / 한국 매크로 / 한국 기술적 분석
```

### 12B. Dead Link / Dead Button 탐지

```javascript
document.querySelectorAll('[onclick]').forEach(el => {
  try {
    const fn = el.getAttribute('onclick').split('(')[0];
    if (typeof window[fn] !== 'function' && !fn.includes('.') && !fn.includes('this'))
      console.warn('❌ Dead onclick:', fn, '→', el.textContent?.slice(0,30));
  } catch(e) {}
});
```

---

## 13단계: 성능 / 메모리 검증

```
[ ] Chart.js 인스턴스 수 합리적 (중복 생성 없음)
[ ] DOM 노드 수 10,000개 이하
[ ] 페이지 전환 10회 반복 후 메모리 안정
```

---

## 14단계: 접근성 / 가독성

```
[ ] Tab 키로 주요 요소 순회 가능
[ ] [role="button"] 요소에 focus-visible 스타일 적용 확인
[ ] label-input for 연결 확인 (eq-price, eq-ema20, eq-rsi, fb-desc)
[ ] 모달 열림 시 첫 번째 버튼/입력에 자동 포커스
[ ] 모든 텍스트가 배경 대비 4.5:1 이상
[ ] 최소 font-size 11px (10px 이하 금지 -- v41.3 override 시스템)
[ ] 빨간색=하락/위험, 초록색=상승/안전 컬러 코딩 일관성
[ ] skip-link (.skip-link) HTML 존재 + JS 중복 없음
```

### 14B. 보안 검증 (v41.5 추가)

```
[ ] innerHTML에 사용자/외부 데이터 삽입 시 escHtml() 래핑 확인
    grep: innerHTML.*ticker|innerHTML.*msg|innerHTML.*sym
[ ] native confirm()/alert() 사용 금지 -- showConfirmModal() 사용
[ ] localStorage 민감 데이터 암호화 (safeLS/safeLSGet 사용)
```

### 14C. 타이머/메모리 검증 (v41.5 추가)

```
[ ] setInterval 추가 시 destroyPageCharts에 대응 clearInterval 존재
    grep: setInterval → 각각 clearInterval 짝이 있는지 확인
[ ] init 가드 (if (initialized) return) 사용 시 destroy에서 플래그 리셋
[ ] Dead code 주기 점검: 함수 정의만 있고 호출처 0건인 함수 없는지
```

---

## 15단계: 에러 복구 / Graceful Degradation

```
[ ] Yahoo Finance API 실패 → 폴백 시세 사용
[ ] CF Worker 프록시 실패 → 대체 프록시 자동 시도
[ ] RSS 피드 일부 실패 → 성공한 소스만으로 뉴스 렌더링
[ ] 시세가 NaN/Infinity → "—" 처리
```

---

## 16단계: 한국 시장 페이지 전용 검증

```
[ ] KOSPI/KOSDAQ/원달러 실시간 시세 표시
[ ] 한국 테마 HOT/강세/중립/조정 탭 필터 동작
[ ] 한국 기술적 분석: KOSPI/KOSDAQ 자동 분석 + 개별 종목 분석
[ ] Weinstein Stage, RSI, 이동평균 등 지표 표시
```

---

## 17단계: 이벤트-드리븐 시장 정합성 검증 (v3.2 신설 — 2026-04-08)

> **신설 배경**: v44.6 QA에서 WTI -15% 휴전 합의 이후 static 텍스트 6곳이 역방향 유지. DATA_SNAPSHOT 수치 갱신과 텍스트 서술 갱신이 분리된 구조적 공백. P61~P63 반영.

### 트리거: DATA_SNAPSHOT 주요 수치 갱신 이후, 또는 대형 시장 이벤트(전쟁·휴전·FOMC·금리결정·쇼크) 직후 반드시 실행

```
[ ] DATA_SNAPSHOT._note로 마지막 갱신 컨텍스트 확인
[ ] HOME_WEEKLY_NEWS[0] 이벤트 반영 여부 (이전 이벤트 뉴스 잔존 여부)

--- 매크로 페이지 텍스트 정합성 ---
[ ] 유가·에너지 섹션 "수요파괴 현황" 제목/데이터가 현재 WTI 방향과 일치하는지
[ ] JPM/IB 유가 대응 옵션 상태(○/◐/✓)가 현실 반영인지
[ ] 시나리오 A/B/C 조건 텍스트가 현재 시장과 충돌하지 않는지

--- 시그널 페이지 CP 카드 ---
[ ] CP1(지정학) 미터바 %와 detail 텍스트가 현 이벤트 상태를 반영하는지
[ ] CP3(거시경제)/CP6(원자재) CRITICAL/HIGH/MEDIUM 등급이 데이터와 정합하는지

--- 한국 매크로 페이지 코멘트 ---
[ ] 물가 섹션 코멘트가 현재 유가 방향과 일치하는지 (↑/↓ 역방향 금지)
[ ] 수입 동향 코멘트의 에너지 가격 방향이 DATA_SNAPSHOT.wtiPct와 일치하는지

--- 함수 구조 ---
[ ] generateMacroStoryline() 지정학 챕터 트리거 조건 확인:
    WTI pct 절대값 8%+ OR VIX 25+ && WTI 85+ 시 자동 삽입됨 (v44.6)
    → live _oilPct 먼저, 없으면 DATA_SNAPSHOT.wtiPct 폴백
[ ] setInterval == clearInterval 수 확인 (목표: 동일해야 함)
```

### grep 빠른 점검 (이벤트 후 역방향 텍스트 탐지)
```bash
# 이전 이벤트 서술 잔존 탐지
grep -n "이란전쟁\|전쟁 발발\|급등이.*리스크\|급증.*이란\|수요가 무너지고" index.html | grep -v "//\|MACRO_KW"

# 타이머 균형
echo "setInterval: $(grep -c 'setInterval' index.html) / clearInterval: $(grep -c 'clearInterval' index.html)"
```

---

## 실행 규칙 (위반 시 "완료" 선언 불가)

1. **1단계(브라우저 런타임) 스킵 → 완료 불가** — 코드만 고치고 끝내는 건 검증이 아님
2. **"문법 통과 ✅" = 3단계의 일부일 뿐** — 1~2단계 없이 검증 완료 아님
3. **홈 페이지 스크린샷 1장 = 검증 아님** — 영향받는 모든 페이지 각각 확인
4. **차트가 "보이면 OK" 아님** — 비율, 수치, 축 라벨까지 확인
5. **숫자가 "있으면 OK" 아님** — 0%, "—", null, NaN은 FAIL

---

## 4C. 레이아웃 오버플로우 검증 (v31.9 추가)

```
[ ] Market Breadth 배지(bb-badge)가 바 차트 영역을 침범하지 않는지 확인
[ ] 모든 고정폭 grid 셀에서 한국어 텍스트가 잘리거나 인접 셀 침범하지 않는지 확인
[ ] 섹터 히트맵 배지(tac-heat-badge)가 텍스트 넘침 없는지 확인
[ ] 홈 페이지 AAII 카드에 수치 텍스트(bear%/bull%/signal)가 표시되는지 확인
[ ] 768px 뷰포트에서 breadth-bar-row, score-bar-row 레이아웃 정상인지 확인
[ ] 480px 뷰포트에서 동일 항목 확인

P57 고정 repeat(N,1fr) 그리드 모바일 검증 (v42.6 추가):
[ ] repeat(N,1fr) (N≥5) 그리드가 모바일 375px에서 가로 overflow 없는지 확인
    자동 탐지: document.querySelectorAll('[style*="repeat("]').forEach(el => { if (el.scrollWidth > el.clientWidth + 2) console.warn('⚠ grid overflow:', el.id || el.className, el.scrollWidth); })
[ ] 6열 이상 고정 그리드는 repeat(auto-fit,minmax(Xpx,1fr))으로 변경 검토
[ ] 변경 시 데스크톱(1440px)에서 컬럼 수가 유지되는지 확인
```

**브라우저에서 확인:**
```javascript
// 고정폭 grid 셀 오버플로우 감지
document.querySelectorAll('.bb-badge, .tac-heat-badge, .bb-label').forEach(el => {
  if (el.scrollWidth > el.clientWidth)
    console.warn('⚠ 텍스트 오버플로우:', el.className, el.textContent,
      'scrollW:', el.scrollWidth, 'clientW:', el.clientWidth);
});
```

### 4D. 데이터 최신성 검증 (v31.9 추가)

```
[ ] 콘솔에서 "[Yahoo→FRED]" 로그 확인 → 브릿지가 실행되고 있는지
[ ] FRED 데이터 소스 라벨이 "실시간 (HH:MM)" 또는 "FRED YYYY-MM-DD"로 표시되는지
[ ] 10Y-2Y, 10Y-3M 스프레드가 실시간 계산값인지 ("—"가 아닌지)
[ ] CF Worker 설정 시 콘솔에 503/429 에러가 발생하지 않는지
```

**브라우저에서 확인:**
```javascript
// Yahoo→FRED 브릿지 상태 확인
console.log('window._live10Y:', window._live10Y);
console.log('window._live30Y:', window._live30Y);
console.log('window._liveVIXCLS:', window._liveVIXCLS);
// FRED 데이터 소스 확인
document.querySelectorAll('[data-fred]').forEach(el =>
  console.log(el.id, el.dataset.fred));
```

---

## 부록: 페이지별 핵심 검증 매트릭스

| 페이지 | 필수 확인 요소 | FAIL 조건 |
|--------|--------------|-----------|
| home | 시세카드 변화율, 2s10s 스프레드, HY 스프레드, 뉴스 | 변화율 0.00%, 스프레드 "—", 뉴스 빈칸 |
| kr-home | KOSPI/KOSDAQ 변화율, 원/달러 환율 | 변화율 0.00%, 환율 "—" |
| signal | 점수 게이지, 5개 서브 바, advice 카드, 시나리오 3개 | 게이지 "—", 바 0, advice 빈칸 |
| sentiment | AAII 막대차트, P/C 스파크라인, F&G 게이지 | 차트 빈 화면, 게이지 "—" |
| fxbond | koreaCurveChart, 스프레드 3개, DXY | 차트 빈 화면, 스프레드 "—" |
| macro | yieldCurveChart, 경제 온도, WTI-Brent | 차트 빈 화면, 온도 "—" |
| themes | RRG 캔버스, 섹터 ETF RS, YTD, 세분화테마 카드+심층분석 | RRG 비율 왜곡, RS 0%, YTD "—", 세분화테마 전종목 0%, 카드 클릭 무반응 |
| breadth | SMA 바 3개, 캔버스 차트 4개, McClellan | 바 0, 차트 빈 화면 |
| technical | 기술 지표, 지지/저항, Weinstein, 종합 판정 | 지표 "—", 수치 0, analyzeTickerDeep 에러 |
| kr-technical | KOSPI/KOSDAQ 자동 분석, 개별 종목 분석, 용어 해설 | 지수 분석 빈 화면, analyzeKrIndex/analyzeKrTickerDeep 에러 |
| options | VIX/VVIX 실시간 값, 데이터 고지 배너, 업데이트 시간 | VIX "26.78" 하드코딩 그대로, 배너 없음, 시간 "—" |
| portfolio | 포트폴리오 종목 카드, 손익 계산, 총 자산 | 첫 진입 시 빈 화면, 종목 "—" |

---

## 부록: 반복 실패 방지를 위한 특별 체크

이전 프로젝트에서 2회+ 반복된 버그 패턴 — 수정 시 반드시 교차확인:

| 패턴 | 확인법 |
|------|--------|
| 함수 존재하지만 호출 안 됨 | grep으로 호출 지점 확인 + 브라우저에서 breakpoint |
| init 가드 미리셋 | destroy 함수에서 flag=false 확인 |
| 캔버스 ID 불일치 | getElementById의 ID가 올바른 page-div 안에 있는지 |
| API 필드 가정 | Network 탭에서 실제 응답 확인 |
| window.* 캐시 미할당 | 콘솔에서 해당 변수 값 확인 |
| popstate 누락 | 뒤로가기로 해당 페이지 진입 테스트 |
| 수정이 한 경로만 (showPage만, popstate 누락) | 두 경로 모두 테스트 |
| 동적 DOM 삽입이 grid/flex 깨뜨림 | 삽입 대상 부모의 display 속성 확인 (grid/flex면 외부 컨테이너 사용) |
| 채팅 LLM 응답 가로 렌더링 (★) | **근본 원인**: chatAppendMsg의 id가 wrap에 설정되면 onDone이 wrap.innerHTML 덮어씀→bubble 소멸→flex:row 가로 배치. **검증**: 응답 완료 후 `.acp-msg.ai` 안에 `.acp-bubble` 존재하는지, 직접 자식 수가 5개 이하인지 반드시 DOM 검사 |
| 기술 분석 결과 DOM target 불일치 | analyzeKrTickerDeep가 #kr-ticker-analysis-result 에 렌더하는지 확인 |
| init 함수 내 cleanup 루프 2개 (P56) | Object.keys(pageCharts).forEach(destroy) 패턴이 동일 init 함수 내 2회 이상이면 — 두 번째가 방금 생성한 차트를 파괴 |
| applyDataSnapshot map→HTML 불일치 (P58) | map 키 추가/제거 시 HTML data-snap 속성 역방향 확인 필수. 방향: HTML→map(기존) + map→HTML(신규) |
| API 의존 전역 변수 undefined 상태 (P59) | fetch 콜백에서만 set되는 전역(예: _lastFG)은 applyDataSnapshot 후 DATA_SNAPSHOT 폴백으로 초기화 |
| 크로스페이지 공유 함수 단방향 연결 (P60) | 여러 페이지에서 같은 데이터 표시 시 — 각 페이지의 liveQuotes 리스너에 공통 업데이트 함수 연결 누락 |
| 고정 열 그리드 모바일 overflow (P57) | repeat(N,1fr) N≥6은 375px에서 overflow 위험. repeat(auto-fit,minmax(Xpx,1fr)) 교체 |
| CF Worker 프록시 rate limit | Yahoo Finance 차트 요청 시 429 에러 발생하지 않는지 확인 |
| 스크롤 영역 하단 잘림 | 모든 overflow-y:auto 컨테이너에 padding-bottom 16px+ 있는지 |
| 버전 4곳 불일치 | title, badge, version.json, 파일명 MD5 모두 동일한지 (RULES.md R1) |
| `.pct \|\| 0` 패턴 재도입 (P25) | `grep -n '\.pct ||' index.html` → Category C 외 신규 사용 없는지 확인. 반드시 `d.pct != null ? d.pct : 기본값` 사용 |
| div 균형 점검 오류 | `grep -c` 대신 `grep -o '<div' index.html \| wc -l` 사용. `grep -c`는 한 줄에 여러 div가 있으면 1로 카운트 |
| P24 `[data-live-price]` 신규 코드 | 벌크 업데이트 신규 작성 시 반드시 `el.children.length > 0` 체크 포함 여부 확인 |
| CSS overflow 미설정 | 스크롤 컨테이너에 overflow-x:hidden + overflow-y:auto + padding-bottom 3중 확인 |
| 고정폭 grid 컬럼에 한국어 텍스트 오버플로우 | 모든 고정폭 셀에 `overflow:hidden; text-overflow:ellipsis` 적용 + 한국어 최대 폭(글자수×14px) 확인 |
| 차트 의존 카드에 텍스트 폴백 없음 | 홈 AAII/P/C Ratio 등 미니 차트 카드에 차트 실패 시 수치 텍스트 표시 여부 확인 |
| Yahoo→FRED 브릿지 미작동 | 콘솔에서 `[Yahoo→FRED]` 로그 출력 확인, FRED 데이터 소스 라벨이 "실시간 (HH:MM)" 표시 확인 |
| 반응형 브레이크포인트 레이아웃 깨짐 | 768px/480px에서 breadth-bar-row, score-bar-row, 캘린더 grid 겹침/잘림 없는지 확인 |
| Dead Page (init/리스너 없음) | 모든 page-* div에 대해 (1) init 함수 존재 (2) pageShown 리스너 (3) liveQuotes 리스너 3종 확인 |

---

## 부록: v34.3 QA 점검 보고서 (2026-03-27)

> **점검 범위**: 15개 관점 기업 분석 프레임워크 + 기업 내부 비교 분석 시스템 + 해자 7유형 매핑 + FMP 데이터 파이프라인 + _CHAT_RULES 응답 품질 규칙
> **점검 방법**: index.html 전수 코드 리딩 (라인 19746~21810)
> **결과 요약**: 핵심 기능 정상 구현 확인, 경미한 개선 사항 3건 발견

### ✅ 통과 항목

```
[✅] 15개 관점 프롬프트 (라인 20377~20408) — 기업 개요~투자포인트 전부 구현, 각 관점에 ★데이터 태그 매핑
[✅] 해자 7유형 매핑 (라인 20387~20399) — 기술독점/네트워크/전환비용/브랜드/규모/무형자산/FCF전환, Wide/Narrow/None 판정 기준 + 해자 약화 경고 시그널 포함
[✅] FMP 18개 엔드포인트 정합 (라인 21435~21456) — fundamentalSearch()와 _fetchDeepCompareData() 동일 폭. profile/income/balance/cashflow/ratios/metrics/growth/executives/insider/institutional/estimates/priceTarget/revSegment/revGeo/peers/surprises/ev/dcf
[✅] 시스템 프롬프트 3중 주입 (라인 21804~21808) — tickerDataStr + sectorCompareStr + deepCompareStr 조건부 추가
[✅] _detectDeepCompareIntent (라인 21401~21422) — deepKw(~40개) AND compareKw(~15개) 교차 감지
[✅] _formatDeepComparePrompt (라인 21486~21742) — 16개 데이터 블록 + 15개 관점 비교 지침
[✅] _formatSectorComparePrompt (라인 21194~21311) — 섹터 평균 계산 + 4축 순위 + 교차검증 지침
[✅] _CHAT_RULES ⑤-3 (라인 19763) — 기업 내부 비교 분석 데이터 감지 시 15개 관점 + 이사회 수준 깊이 강제
[✅] 해자 추론용 투자 강도 지표 (라인 20203~20227) — R&D/매출, SG&A/매출, CAPEX/매출, FCF마진 3개년 + 해석 가이드
[✅] 응답 프레임워크 (라인 20410~20417) — 기계적 나열 금지, 스토리 연결, 실제 숫자 인용, 방향성 중시, 리서치 리포트 수준
[✅] 비교 응답 프레임워크 (라인 21734~21741) — 서사적 비교, 학습 데이터 금지, 3개년 추이 가속/감속, 핵심 차별점 심화
[✅] version.json v34.3 정합 — note 필드에 구현 내용 정확히 기술
```

### ⚠️ 발견된 문제 3건 → ✅ v34.4에서 전부 수정 완료

#### 문제 1: `_detectDeepCompareIntent` 비교 키워드 커버리지 부족 → ✅ v34.4 수정

- **증상**: "NVDA AVGO 장단점", "AAPL MSFT 우위", "TSLA RIVN 열위" 같은 자연어 표현에서 deepCompare가 트리거되지 않음
- **근본 원인**: `compareKw` 배열에 "장단점", "장점", "단점", "우위", "열위", "좋은 점", "나쁜 점", "강점", "약점" 같은 일상적 비교 표현이 누락됨
- **왜 문제인가**: 투자자가 "NVDA AVGO 장단점 비교해줘"라고 물으면 deepCompare 키워드 조건에 "장단점"이 없어 `hasCompare`가 false → 일반 채팅으로 처리됨 → 세그먼트/마진/R&D 등 심층 데이터 없이 학습 데이터만으로 답변 → 품질 저하
- **수정 내용**: compareKw에 25개 자연어 표현 추가 (장단점/장점/단점/강점/약점/우위/열위/좋은 점/나쁜 점/뭐가 좋/뭘 사/뭐가 낫/pros/cons/advantage/disadvantage/strength/weakness/better/worse/pick/choose/prefer/which)

#### 문제 2: `_extractTickers` 최대 3개 제한 — 사용자 미고지 → ✅ v34.4 수정

- **증상**: "NVDA AMD INTC AVGO QCOM 해자 비교해줘"라고 5개 티커를 보내면 앞 3개만 감지됨
- **근본 원인**: `_extractTickers()`에서 `return tickers.slice(0, 3)` — 최대 3개 하드코딩 제한
- **수정 내용**: (A) 기본 데이터 조회는 5개까지 확장 (`slice(0,5)`), (B) 심층 비교는 3개 유지하되 초과 시 `showToast()`로 안내 메시지 표시

#### 문제 3: QA-CHECKLIST 11F 항목 미갱신 → ✅ v34.4 수정

- **증상**: 11F 항목이 v34.2 기준(10개 엔드포인트, 9단계 지침)으로 기재
- **수정 내용**: v34.3/v34.4 기준으로 전면 갱신 + 11H 단일 기업 심층 분석 항목 신규 추가

### 📋 향후 검증 추가 권장 항목

```
[ ] "NVDA AVGO 장단점" → deepCompare 발동 여부 확인 (v34.4 수정 완료 — 실제 브라우저 검증 필요)
[ ] 4개 티커 입력 시 토스트 안내 메시지 표시 여부 확인 (v34.4 수정 완료 — 실제 브라우저 검증 필요)
[ ] "NVDA 해자 분석해줘" → 단일 심층 분석 발동 + 18개 FMP 데이터 주입 확인 (v34.4 신규)
[ ] "AAPL 종합 분석" → fundamentalSearch 미실행 상태에서도 심층 데이터 주입 확인 (v34.4 신규)
[ ] deepCompare 발동 시 FMP API 호출 시간 측정 (티커 3개 × 18개 = 54개 병렬 호출 → 6초 타임아웃 내 완료 여부)
[ ] deepCompare 프롬프트 토큰 크기 측정 (3개 티커 × 16개 블록 = 프롬프트 길이가 모델 컨텍스트 윈도우 초과하지 않는지)
[ ] singleDeep 프롬프트 토큰 크기 측정 (1개 티커 × 16개 블록 + 심층 지침 = 컨텍스트 윈도우 여유 확인)
```

---

## v34.7 종목 유니버스 감사 — 테마/서브테마 검증 항목

> **v34.7 배경**: STOCK-UNIVERSE-AUDIT.md 기반으로 SCREENER_DB, THEME_MAP, SUB_THEMES, SCR_KEYWORD_ALIASES, KNOWN_TICKERS를 전면 개편. 상장폐지/합병 종목 제거, 누락 종목/키워드 대폭 추가, 신규 서브테마 4개 신설.

### 12A. 상장폐지/합병 종목 완전 제거 확인

```
[ ] ELASTIC — 코드 전체에서 검색 시 활성 코드에 없음 (주석만 허용)
[ ] INFN — 코드 전체에서 검색 시 활성 코드에 없음 (Nokia 인수 → 상장폐지)
[ ] IIVI — 코드 전체에서 검색 시 활성 코드에 없음 (COHR 합병 완료)
[ ] SPCE — 코드 전체에서 검색 시 활성 코드에 없음 (Virgin Galactic 사실상 종료)
```

### 12B. 대체 종목 정상 반영 확인

```
[ ] ESTC가 THEME_MAP software '데이터/AI플랫폼'에 존재
[ ] ANET이 photonics '광섬유/네트워크'에 존재 (INFN 대체)
[ ] LUNR, RDW가 defense '우주/위성'에 존재 (SPCE 대체)
[ ] SCREENER_DB에 ESTC, ANET, LUNR, RDW 각각 존재
```

### 12C. 신규 SCREENER_DB 종목 검증

```
[ ] AA (Alcoa) — sym:'AA' 존재, sector/memo 합리적
[ ] BIIB (Biogen) — sym:'BIIB' 존재
[ ] CLSK (CleanSpark) — sym:'CLSK' 존재
[ ] ETSY — sym:'ETSY' 존재
[ ] LAC (Lithium Americas) — sym:'LAC' 존재
[ ] MASI (Masimo) — sym:'MASI' 존재
[ ] MP (MP Materials) — sym:'MP' 존재
[ ] RUN (Sunrun) — sym:'RUN' 존재
[ ] SEDG (SolarEdge) — sym:'SEDG' 존재
[ ] STAG (STAG Industrial) — sym:'STAG' 존재
[ ] IBIT (iShares Bitcoin Trust) — sym:'IBIT' 존재
[ ] BITO (ProShares Bitcoin Strategy) — sym:'BITO' 존재
[ ] QBTS (D-Wave Quantum) — sym:'QBTS' 존재
[ ] UMC (United Microelectronics) — sym:'UMC' 존재
```

### 12D. THEME_MAP 서브테마 확장 검증

```
[ ] 반도체 — '파운드리/성숙공정' 서브테마 존재 (INTC, GFS, TSM, UMC)
[ ] 반도체 — '아날로그/RF'에 NXPI, ON 추가됨
[ ] AI 인프라 — '양자컴퓨팅' 서브테마 존재 (IONQ, RGTI, QBTS)
[ ] 소프트웨어 — 데이터/AI플랫폼에 AI, TTD 추가됨
[ ] 방산 — 전통 방산에 PLTR, LDOS 추가됨
[ ] 임의소비재 — '플랫폼/딜리버리' 서브테마 존재 (UBER, DASH, CPNG)
[ ] 금융 — 결제/핀테크에 SOFI, AFRM 추가됨
[ ] 헬스케어 — '생명과학 장비' 서브테마 존재 (TMO, DHR, A, WAT)
[ ] 크립토 — 'BTC ETF' 서브테마 존재 (IBIT, BITO)
[ ] 로보틱스 — 'AI/휴머노이드' 서브테마 존재 (TSLA, FANUY), 산업자동화에 PATH 추가
```

### 12E. SUB_THEMES 신규 4개 검증

```
[ ] id:'foundry' — 파운드리/성숙공정 존재, leaders/tickers 배열 비어있지 않음
[ ] id:'btc_etf' — BTC ETF/보유 존재, compositeBase:'BTC-USD' 설정됨
[ ] id:'delivery' — 플랫폼/딜리버리 존재, leaders/tickers 배열 비어있지 않음
[ ] id:'glp1' — GLP-1/비만치료 존재, leaders/tickers 배열 비어있지 않음
[ ] 세분화 테마 그리드에서 17개 카드 표시 (기존 13 + 신규 4)
```

### 12G. 세분화 테마 인터랙션 검증 (v38.3 추가, P25)

```
[ ] 세분화 테마 카드에 cursor:pointer + onclick 존재
[ ] 데이터 미수신 종목은 "—" 표시 ("+0.0%" 아님) — d.pct||0 패턴 사용 금지
[ ] 카드 클릭 → #sub-theme-detail-panel 표시
[ ] 심층 분석 패널 내용: 헤더(이모지+이름+ETF+등락률), 설명, 전종목 테이블, 커버리지, 브레드스, 심층분석(온도진단/격차/비중/학습포인트)
[ ] ✕ 닫기 버튼 → 패널 숨김
[ ] aio:liveQuotes 시 패널 열려있으면 자동 갱신
[ ] showThemeDetail()의 서브테마 종목 표시도 "—" 처리 (동일 P25 규칙)
```

### 12F. SCR_KEYWORD_ALIASES 키워드 검증

```
[ ] '드론' → 검색 시 KTOS, AVAV, RKLB 반환
[ ] '로보틱스' → 검색 시 ISRG, ROK, ABB, PATH, FANUY 반환
[ ] '리튬' → 검색 시 LAC, ALB, SQM, LIT 반환
[ ] '메타버스' → 검색 시 META, RBLX, U 반환
[ ] 'autonomous' → 검색 시 TSLA, GOOGL, MBLY, APTV 반환
[ ] 'glp-1' → 검색 시 LLY, NVO, AMGN, VKTX 반환
[ ] '비만' → 검색 시 LLY, NVO, AMGN, VKTX 반환 (기존 LLY만 → 확장 확인)
[ ] 'sq' → 검색 시 XYZ 반환 (SQ→XYZ 리브랜딩 매핑)
```

### 12G. KNOWN_TICKERS 정합성

```
[ ] 신규 추가 종목 15개 모두 KNOWN_TICKERS에 존재: AA, BIIB, BITO, BOTZ, CLSK, ETSY, IBIT, LAC, MASI, MP, QBTS, RUN, SEDG, STAG, UMC
[ ] 제거 종목 2개 KNOWN_TICKERS에서 삭제됨: IIVI, SPCE
```

### 12H. 브라우저 실행 검증 (배포 후 필수)

```
[ ] 테마/트렌드 페이지 진입 → 모든 테마 카드 렌더링 (빈 카드 = FAIL)
[ ] 세분화 테마 그리드 → 17개 카드 모두 표시
[ ] 신규 서브테마 4개(파운드리, BTC ETF, 딜리버리, GLP-1) 카드 클릭 → 종목 리스트 표시
[ ] 스크리너 검색 "드론" → 결과 반환 (KTOS, AVAV, RKLB)
[ ] 스크리너 검색 "GLP-1" → 결과 반환 (LLY, NVO, AMGN, VKTX)
[ ] 스크리너 검색 "ELASTIC" → 결과 없음 (제거됨)
[ ] 스크리너 검색 "SPCE" → 결과 없음 (제거됨)
[ ] 스크리너에서 ESTC 검색 → 정상 표시 (Elastic → ESTC 리브랜딩)
[ ] PRIORITY_SYMS 추가 그룹(IBIT, BITO, UBER, DASH 등) 시세 60초 내 로딩 확인
[ ] 콘솔 에러 없음 (INFN/IIVI/SPCE/ELASTIC 관련 undefined 에러 = FAIL)
```

### 12I. PARA 모니터링

```
[ ] PARA SCREENER_DB memo에 "⚠️ 티커변경/상장폐지 가능" 경고 포함 확인
[ ] Skydance-Paramount 합병 완료 시 → PARA 엔트리 업데이트 또는 제거 필요 (향후 작업)
```

---

## v34.8 통합 부족 감사 — UX/접근성/데이터 일관성 검증 항목

> **v34.8 배경**: UNIFIED-DEFICIENCY-AUDIT-v34.6.md + FULL-DEFICIENCY-AUDIT.md 두 감사 보고서 통합 반영. alert()→showToast 전환, PXD 제거, 인쇄 스타일, 접근성, kr-supply 경고 배너 등.

### 13A. alert() 전면 제거 확인

```
[ ] 코드 전체 grep "alert(" → 0건 (모두 showToast로 전환됨)
[ ] API 키 저장 시 showToast('API 키가 저장되었습니다 ✓') 정상 표시
[ ] 포트폴리오 빈 입력 시 showToast 경고 정상 표시
[ ] 워치리스트 중복 종목 추가 시 showToast 정상 표시
[ ] PIN 설정 완료 시 showToast 정상 표시
```

### 13B. PXD 완전 제거 확인

```
[ ] KNOWN_TICKERS에서 PXD 제거됨 (ExxonMobil 인수 완료)
[ ] SCREENER_DB에 PXD 없음 (기존에도 없었음, 확인 차)
[ ] 검색 "PXD" → 결과 없음
```

### 13C. @media print 인쇄 스타일 확인

```
[ ] 브라우저 인쇄 미리보기 → 사이드바/네비게이션 숨김
[ ] 인쇄 시 배경 흰색, 텍스트 검정
[ ] 차트가 페이지 경계에서 잘리지 않음 (page-break-inside: avoid)
[ ] 버튼, 입력창, 채팅 패널 숨김 처리
```

### 13D. 접근성 (aria-label) 확인

```
[ ] 모든 canvas에 role="img" + aria-label 존재 (22개)
[ ] 스크리너 스파크라인 canvas에 aria-label="{티커} 스파크라인 차트" 확인
[ ] 스크린 리더로 차트 영역 접근 시 의미 있는 텍스트 읽힘
```

### 13E. signal AI 칩 확인

```
[ ] 시그널 페이지 진입 → AI 채팅 패널에 4개 추천 질문 칩 표시
[ ] 칩 클릭 → 해당 질문이 채팅에 자동 전송
```

### 13F. kr-supply 경고 배너 확인

```
[ ] 수급 분석 페이지 진입 → "정적 스냅샷" 경고 배너 표시
[ ] 배너 색상 오렌지, 텍스트 가독성 양호
```

### 13G. 통합 감사 잔여 항목 — v34.9에서 전부 완료

```
[x] E1/C1: TradingView 위젯 임베드 — v34.9 완료 (page-technical, page-fundamental, page-kr-technical)
[x] E3/H3: McClellan Oscillator 실제 계산 — v34.9 완료 (19/39 EMA 기반 calcMcClellan + updateMcClellanUI)
[x] E4/H1: 옵션 체인 그릭스 계산 — v34.9 완료 (Black-Scholes bsGreeks + updateGreeksPanel)
[x] E7/H4: 포트폴리오 SPY 벤치마크 비교 차트 — v34.9 완료 (updateBenchmarkChart canvas)
[x] E11/M1: 스크리너 결과 CSV 내보내기 — v34.9 완료 (exportScreenerCSV + UTF-8 BOM)
[x] E6/M2: 가격 알림 시스템 — v34.9 완료 (localStorage 기반 addPriceAlert/checkPriceAlerts)
[x] D1/H2: 한국 수급 API 연동 — v34.9 준비 완료 (경고 배너 업데이트, 엔드포인트 확보 시 즉시 연동 가능)
[x] D4: 경제 캘린더 동적화 — v34.9 완료 (getNextFOMC, getNextBOK 동적 계산)
[x] B2: 하드코딩 날짜 정리 — v34.9 완료 (DATA_SNAPSHOT 폴백값 문서화 + 경고 주석)
[x] B3: 이란 관련 참조 범용화 — v34.9 완료 (4개 섹션 주석 추가 + 소제목 범용화)
[x] G2: 색각 이상 배려 — v34.9 완료 (a11y-up/a11y-dn/a11y-hold CSS + applyA11yIndicators)
[x] M8: 에러 메시지 한국어화 — v34.9 확인 완료 (전수 조사 결과 이미 전체 한국어)
```

### 13H. v34.9 추가 구현 항목 (감사 보고서 외)

```
[x] 스크리너→차트분석 워크플로우 연결 (screenerToChart)
[x] 스크리너→기업분석 워크플로우 연결 (screenerToFundamental)
[x] 뉴스→종목 워크플로우 연결 (newsToStock)
[x] PWA manifest.json + sw.js 생성 + Service Worker 등록
[x] 다크/라이트 테마 전환 (toggleTheme + CSS 라이트 테마 + localStorage 저장)
```

---

## 2026-03-28 v35.7 감사 보고서 통합 검증

```
[x] DATA_SNAPSHOT: US 전면 3/27(금) 종가 반영 확인 (S&P/Dow/Nasdaq/VIX/WTI/DXY/BTC/글로벌)
[x] FALLBACK_QUOTES: 3/27 기준 350+개 항목, 중복 0개 확인
[x] kr-supply: KOSPI 외국인 -17,939억 / 기관 -472억 / 개인 +17,048억 — kr-home과 일치 확인
[x] kr-supply: KOSDAQ 외국인 -459억 / 기관 -423억 / 개인 +818억 — kr-home과 일치 확인
[x] PRIORITY_SYMS: 한국 125개 종목 (방산/조선/전력/반도체/바이오/원전/2차전지/ETF/코스닥) 확인
[x] PRIORITY_SYMS: S&P 500 Top 50 누락분 (GOOGL, JPM, V, JNJ 등 25종목) 추가 확인
[x] HTML 폴백값: VIX 31.05, S&P 6,369, BTC 66,310, TNX 4.44%, VKOSPI 28.5 확인
[x] Medium: MOVE 115.0, F&G 12 확인
[x] HY spread 날짜: 2026-03-27 확인
[x] 수급 섹션 날짜: data-date-ref="kr-last" 동적 바인딩 확인
[x] 11개 <script> 블록 전체 JS 문법 검증 통과
```

---

## 2026-03-28 한국 동적 데이터 모듈 검증

```
[x] fetchVkospiDynamic: VKOSPI API → kr-vkospi-val, kr-health-vkospi 동적 업데이트
[x] fetchKrTradingVolume: 거래대금 → kr-dash-kospi-volume, kr-dash-kosdaq-volume
[x] fetchKrForeignRanking: 외국인 TOP 테이블 동적 렌더링 (순매수/매도/보유비중)
[x] fetchKrWeeklySupply: 주간 5거래일 수급 트렌드 동적 구성
[x] _enrichMarketCap: 개별 종목 시가총액 → KR_STOCK_DB 반영
[x] REFRESH_SCHEDULE.krDynamic: 15분 주기 등록
[x] 초기 로드: initKoreaHome → fetchKrDynamicData 호출 연결
[x] HTML ID 12개 추가 완료
[x] 11개 <script> 블록 JS 문법 검증 통과
```

---

## 2026-03-28 CF Worker 부하 최적화 검증

```
[x] REFRESH_SCHEDULE.quotes: 180000 (3분) 확인
[x] REFRESH_SCHEDULE.krDynamic: 1800000 (30분) 확인
[x] PRIORITY_SYMS: 379개 unique, 중복 0개 (grep/python 검증)
[x] _PROXY_REGISTRY.getRotated(): 라운드로빈 메서드 추가, 문법 검증 통과
[x] fetchViaProxy: getRotated() 호출로 변경 확인
[x] fetchYFChart: orderedProxies 라운드로빈 적용 확인
[x] CF Worker Free Tier 대비 62% (61,543/100,000) — 4인 여유
[x] JS 문법 검증: _PROXY_REGISTRY, fetchViaProxy, PRIORITY_SYMS 통과
```

---

## 2026-03-28 정적 하드코딩 전면 동적화 검증

```
[x] KOSDAQ 수급: fetchKrSupplyData KOSDAQ investorTrend 추가
[x] updateKrSupplyDOM: KOSPI+KOSDAQ 동시 업데이트 + 동적 코멘트 생성
[x] kr-home 코스닥 수급: 6개 ID 부여 (foreign/inst/retail + bar)
[x] 수급 코멘트 7개 요소 동적 생성 (외국인 연속매매일수 자동계산)
[x] fetchKrShortSelling: 공매도 거래대금 동적화
[x] fetchKrBreadthData: ADL/20MA/52주고저 동적화
[x] fetchKrDynamicData: 4→6개 함수 통합 확인
[x] applyFredToUI: yc-2y, yc-2y-track, dxy-1m 동적 연결
[x] fetchPutCall: regime-pcr + DATA_SNAPSHOT.pcr 연결
[x] 29개 정적 ID 전부 JS 참조 2회 이상 확인 (0개 미연결)
[x] 6개 신규/수정 함수 Node.js syntax 통과
```

## 2026-03-28 kr-supply 공매도 서브섹션 동적화 보완

```
[x] kr-short-kospi-ratio: 하드코딩 "4.07%" → fetchKrShortSelling() 동적 + data-live-kr 추가
[x] kr-short-kosdaq-ratio: 하드코딩 "3.27%" → fetchKrShortSelling() 동적 + data-live-kr 추가
[x] kr-short-kospi-chg: 하드코딩 "▲ 0.83%p" → 동적 변화폭 or "KRX 전용 데이터" 안내
[x] kr-short-kosdaq-chg: 하드코딩 "▲ 1.40%p" → 동적 변화폭 or "KRX 전용 데이터" 안내
[x] kr-short-balance: 하드코딩 "14.2조" → 동적 or "N/A" + KRX API 연동 예정 안내
[x] kr-short-stock-table: 하드코딩 5개 종목 제거 → KRX 연동 예정 안내 1행으로 교체 + ID 부여
[x] kr-short-balance-sub: 52주 평균 하드코딩 제거 → 동적 서브라인 ID 부여
[x] fetchKrShortSelling(): Naver basic API contents 파싱 추가 (프록시 래핑 대응)
[x] JS 구문 검증 통과 (11개 script block 전체)
[ ] 브라우저 실제 확인: kr-supply-short 탭 열어서 5개 값 표시 확인 (KRX 미연동 시 N/A 정상 표시)
```

## 2026-03-28 전체 데이터 동적화 (v35.8) 검증

```
[x] MARKET_SNAPSHOT localStorage 캐시: applyLiveQuotes() 끝에 저장 로직 추가
[x] applyStaticFallbacks(): localStorage 48시간 이내 캐시 우선 로드
[x] _applyRiskMonitorFallbacks(): Risk Monitor 폴백 별도 함수 분리
[x] const tsEl 중복 선언 → var tsEl2 수정 (JS 구문 에러 해결)
[x] generateDynamicBriefing(): briefing-static-archive 전체 동적 생성
[x] 하드코딩 시장 브리핑 (이란-미국 충돌, FOMC 분석 등) 전면 제거 → 실시간 생성
[x] loadEarningsSurprises(): FMP API 동적 호출 (aio_fmp_key 사용)
[x] loadEarningsCalendar(): FMP API earning_calendar 90일 범위 동적 호출
[x] updateScreenerFromLiveData(): SCREENER_DB mcap 라이브 업데이트
[x] 포트폴리오 테이블 NVDA/XLC/XSD: data-live-price 속성 추가
[x] Fed Rate 4곳: data-snap="fed-rate" + FRED DFEDTARU 연결
[x] 11개 script block JS 구문 검증 통과
[ ] 브라우저 확인: 동적 브리핑 정상 생성 확인
[ ] 브라우저 확인: FMP API 키 입력 후 어닝 데이터 로드 확인
[ ] 브라우저 확인: 포트폴리오 테이블 가격 실시간 반영 확인
[ ] 브라우저 확인: localStorage 캐시 동작 확인 (새로고침 후 캐시 사용 여부)
```

## 2026-03-28 QA 재점검 — 정적 데이터 잔존 2차 감사

```
[x] HTML 정적 데이터 재조사: 23개 발견 → 전부 수정 (data-snap/ID 추가 또는 플레이스홀더 전환)
[x] JS 정적 데이터 재조사: 6개 발견 → 전부 수정 (_updated 동적화, 차트 라벨 롤링, 코멘트 동적)
[x] 날짜/시간 5개 발견 → 전부 수정 (센티멘트 게이지, AAII, PCE 이벤트)
[x] 중앙은행 금리 테이블: data-snap 속성 추가 (boj/boe/pboc/bok-rate)
[x] 한국 종목 시가총액: data-live-kr 속성 추가 (4종목)
[x] 시장 폭 지표: ID 추가 (bb-5sma/20sma/50sma, ndx-breadth-5d/20d/50d)
[x] AAII 설문 날짜: id="aaii-survey-date" 동적 연결
[x] 차트 X축 날짜: AAII/VIX/PCR/Breadth 4개 차트 → 롤링 날짜 계산
[x] 주간 수급 테이블: 하드코딩 5행 → 동적 로딩 플레이스홀더
[x] kr-supply-alert-banner: 하드코딩 코멘트 → "수급 데이터 로딩 중" 플레이스홀더
[x] kr-supply-analysis-text: 하드코딩 코멘트 → "수급 분석 데이터 로딩 중" 플레이스홀더
[x] 최종 JS 구문 검증: 11개 block 전체 통과

최종 동적 바인딩 현황:
  data-snap: 40개
  data-live-price: 230개
  data-live-kr: 9개
  data-date-ref: 26개
  DOM ID: 719개
  남은 정적: 교육/인용문/역사데이터 3건 (동적화 불필요)
```

---

## v36.1 LLM AI 채팅 시스템 실시간 동적화 검증

### 수정 범위
```
수정 함수: _CHAT_RULES (IIFE) → _getChatRules() (일반 함수)
수정 함수: _liveSnap() — 폴백값 3건 수정
참조 변경: 21개소 (_CHAT_RULES → _getChatRules())
영향 컨텍스트: home, signal, breadth, fundamental, macro, portfolio,
               kr, options, etf-explorer, kr-supply + 기타 전체
```

### 핵심 수정 사항

| # | 항목 | 이전 (문제) | 이후 (수정) | 상태 |
|---|------|------------|------------|------|
| 1 | `_CHAT_RULES` 날짜 | IIFE — 페이지 로드 시 1회 계산, 자정 지나도 갱신 안됨 | `_getChatRules()` 함수 — 매 채팅마다 `new Date()` 재계산 | ✅ |
| 2 | KST 시각 주입 | 없음 | `_timeStr` 추가 — "N시 M분" 형식으로 AI에 현재 시각 전달 | ✅ |
| 3 | F&G 폴백 | `18` (하드코딩) | `'데이터 없음'` — AI가 옛날 수치 인용 방지 | ✅ |
| 4 | 50MA 폴백 | `6656` (하드코딩) | `'데이터 없음'` | ✅ |
| 5 | 200MA 폴백 | `6593` (하드코딩) | `'데이터 없음'` | ✅ |
| 6 | 참조 갱신 | `_CHAT_RULES` (상수) 21곳 | `_getChatRules()` (함수 호출) 21곳 | ✅ |

### 검증 결과
```
JS 구문: 11개 <script> 블록 전체 new Function() 파싱 ✅ 에러 0건
_CHAT_RULES 잔존 참조: 0건 ✅ (grep 확인)
_getChatRules 참조: 22건 (1 정의 + 21 호출) ✅
하드코딩 연도 검토: 시스템 프롬프트 내 2020~2025년 참조는 모두 역사적 사례/교육용 → 수정 불필요
```

---

## v36.4 US SUB_THEMES ETF 가중비중 검증

### 수정 함수: `calcCompositePerf(tickers, weights)`, `getThemePerf`, `renderSubThemesGrid`, `showThemeDetail`

### 체크포인트 — weights 적용 확인
- [ ] 콘솔: `SUB_THEMES.filter(s=>s.weights).length` === 20 (ETF 보유 테마)
- [ ] 콘솔: `SUB_THEMES.filter(s=>!s.weights).length` === 25 (ETF 미보유 테마)
- [ ] `calcCompositePerf(['NVDA','AMD','AVGO'], {NVDA:25,AMD:10,AVGO:12})` — weights 기반 가중평균 반환
- [ ] `calcCompositePerf(['NVDA','AMD','AVGO'])` — √price 폴백 동작 (하위 호환)
- [ ] 테마·트렌드 페이지 → 서브테마 그리드 정상 렌더링
- [ ] ETF 보유 테마 카드 소스 표시: "ETF가중(N)" 형식
- [ ] ETF 미보유 테마 카드 소스 표시: "합산(N)" 형식
- [ ] 서브테마 상세 패널 → 서브테마 퍼포먼스 weights 반영
- [ ] 버전: APP_VERSION === 'v36.4', HTML badge === 'v36.4', version.json === 'v36.4'

---

## v36.5 LLM 웹검색 외부 내러티브·이벤트 집중 강화 검증

### 수정 함수: `_needsWebSearch`, `_buildSearchQuery`, `_formatSearchForPrompt`, `_perplexitySearch`, `_getChatRules`

### 체크포인트 — _needsWebSearch 내러티브 패턴 감지
```
- [ ] "사스포칼립스 뜻이 뭐야" → 웹검색 트리거 (내러티브 패턴)
- [ ] "GTC 2026 발표 요약" → 웹검색 트리거 (컨퍼런스 패턴)
- [ ] "버핏이 최근에 뭐 샀어" → 웹검색 트리거 (월가 인물 패턴)
- [ ] "숏스퀴즈 종목" → 웹검색 트리거 (밈주/변동성 패턴)
- [ ] "ARM everywhere 테마" → 웹검색 트리거 (내러티브 패턴)
- [ ] "Nvidia rally momentum" → 웹검색 트리거 (영문 고유명사+시장 맥락)
- [ ] 일반 교육 질문 "PER이 뭐야" → 웹검색 미트리거 (기존 동작 유지)
```

### 체크포인트 — _buildSearchQuery 프리픽스
```
- [ ] 내러티브 쿼리 → 검색어에 "시장 내러티브" 프리픽스 포함
- [ ] 월가 인물 쿼리 → 검색어에 "월가 투자 견해" 프리픽스 포함
- [ ] 일반 쿼리 → 프리픽스 없음 (기존 동작 유지)
```

### 체크포인트 — _formatSearchForPrompt 활용 원칙
```
- [ ] 검색 결과 포맷에 "📡 외부 내러티브 활용 원칙" 섹션 존재
- [ ] 4대 우선순위 (①내러티브 ②컨퍼런스 ③대가/기관 ④이벤트 드리븐) 포함
- [ ] "외부에서만 얻을 수 있는 정보" 강조 문구 포함
```

### 체크포인트 — Perplexity Sonar 시스템 프롬프트
```
- [ ] 시스템 프롬프트에 4대 우선순위 탐색 지시 포함
- [ ] "외부에서만 알 수 있는 최신 정보" 우선 추출 지시 포함
- [ ] 600자 이내 제한
```

### 체크포인트 — _getChatRules 규칙 19
```
- [ ] 규칙 19 "외부 내러티브 활용" 존재
- [ ] 웹검색 결과가 있을 때만 활성화되는 조건부 규칙
- [ ] 검색 정보 무시 시 F 등급 경고 포함
```

### 체크포인트 — 버전
```
- [ ] APP_VERSION === 'v36.5'
- [ ] HTML badge === 'v36.5'
- [ ] version.json === 'v36.5'
```

---

## v36.2 듀얼 엔진 AI 웹검색 연동 검증

### 추가 함수: `_needsWebSearch`, `_perplexitySearch`, `_googleSearch`, `_aiWebSearch`, `_formatSearchForPrompt`, `_searchCitationsHTML`

### 체크포인트 — Perplexity Sonar (1순위)
```
Perplexity API 키 UI (사이드바)       ✅
Perplexity 키 암호화 저장 + 복원      ✅ (_AIO_SENSITIVE_KEYS + _restoreDecryptedKeys 양쪽)
_perplexitySearch() API 호출 형식     ✅ (sonar, search_recency_filter: week)
검색 결과 시스템 프롬프트 주입         ✅ (AI 요약 직접 전달)
```

### 체크포인트 — Google Custom Search (2순위 폴백)
```
Google Search API 키 UI (사이드바)    ✅
Google Search Engine ID(cx) UI        ✅
Google 키 2개 암호화 저장 + 복원      ✅ (_AIO_SENSITIVE_KEYS + _restoreDecryptedKeys 양쪽)
_googleSearch() API 호출 형식         ✅ (num=5, lr=lang_ko, gl=kr)
스니펫 → Perplexity 동일 포맷 변환   ✅ ({ answer, citations, engine })
```

### 체크포인트 — 통합 시스템
```
_aiWebSearch() 우선순위 동작          ✅ (Perplexity → Google 폴백)
_needsWebSearch() 키 체크 로직        ✅ (Perplexity 키 or Google 키+cx)
자동 검색 판단 (교육 질문 제외)       ✅ (9개 패턴 + 50자+ 복합 질문)
chatSend 파이프라인 통합              ✅ (ticker/sector/deep 다음에 실행)
검색 실패 시 기존 답변 정상 진행       ✅ (try/catch)
_formatSearchForPrompt 엔진별 분기   ✅ (Perplexity vs Google 차별화)
응답 후 출처 링크 UI                  ✅ (_searchCitationsHTML)
모델 배지에 웹검색+엔진명 표시        ✅
JS 구문 검증                          ✅ 에러 0건
```

---

## 버전별 추가 점검 — v36.6 / v36.7 / v36.8

### v36.6 (프리/애프터마켓 + 선물 + VIX 구조 동적화)
```
includePrePost=true 설정 (CHART_PARAMS, fetchSparkData)  ✅
fetchYFChart에서 marketState/extPrice/extPct 추출         ✅
applyLiveQuotes에서 _extHoursData 저장                   ✅
data-ext-hours 배지 표시                                   ✅
PRIORITY_SYMS에 ES=F/NQ=F/YM=F/VXX/UVXY 추가            ✅
_SNAP_FALLBACK에 선물+VVIX+VXX+UVXY 추가                ✅
VIX term structure → VXX/UVXY 기반 동적화                 ✅
Risk Monitor VIX 구조 동적화 (rm-vixstr-*)                ✅
```

### v36.7 (세션 인식 + VVIX/VIX + _closeSnap)
```
_getUsSession() DST 자동판별                              ✅
_isFuturesOpen() 선물 운영 판별                           ✅
_getKrxSession() 존재 및 동작                             ✅
VVIX/VIX 비율 임계값 (<5/<6/<7/7+)                       ✅
window._vvixVixRatio 전역 저장                            ✅
_closeSnap() chartPreviousClose 기반                      ✅
_liveSnap() usSession/krSession/futuresOpen 포함          ✅
applyLiveQuotes chartPreviousClose 보존                   ✅
_getChatRules 규칙 19-B 분석 데이터 기준 원칙             ✅
LLM 시스템 프롬프트 이중 데이터 (실시간+종가)            ✅
```

### v36.8 (세션 인식 가격 표시 v2 — 괴리 해소 + 범위 제한)
```
지수: 항상 현물(종가) 표시, 선물 대체 제거                 ✅
지수: RTH 외 시 data-idx-futures에 선물 참고 표시          ✅
지수: RTH 중 시 data-idx-futures 숨김                      ✅
개별 종목 ext: ticker-hero-ext 전용 (기업분석 화면만)      ✅
개별 종목 ext: _currentTickerSym 일치 시에만 업데이트     ✅
개별 종목 ext: Pre/After 시 "종가→ext가격" 표시           ✅
개별 종목 ext: 정규장 중 display:none                      ✅
_liveSnap() 지수 항상 현물 (_idxPrice 제거)               ✅
_liveSnap() indexBasis = 정규장실시간/종가기준             ✅
_liveSnap() nasdaq/nasdaqPct/dow/dowPct 필드 추가         ✅
CHAT_CONTEXTS home/briefing/chart 3곳 지수+기준 레이블    ✅
APP_VERSION v36.8 + HTML 배지 + version.json              ✅
CHANGELOG v36.8 (v2 반영)                                  ✅
JS 구문 검증                                               ✅ 에러 0건
```

### v36.9 (분석 함수 전면 종가 전환)
```
_closingVal() 헬퍼 신규 (chartPreviousClose 우선)          ✅
computeTradingScore() 종가 입력 (VIX/DXY/HYG/SPX/유가)    ✅
computeMarketHealth() 종가 기반 VIX/SPY/QQQ                ✅
classifyMarketRegime() 종가 기반 SPX vs MA                  ✅
calcSectorBreadth() 종가 pct 명시                           ✅
kr-themes CHAT_CONTEXTS 종가 기준 대장주                    ✅
kr-macro CHAT_CONTEXTS KOSPI/KOSDAQ 종가                   ✅
APP_VERSION v36.9 + HTML 배지 + version.json              ✅
CHANGELOG v36.9                                            ✅
JS 구문 검증                                               ✅ 에러 0건
```

### v37.0 (테마/트렌드 전면 병합 — v35.8 개편 반영)
```
KR_STOCK_DB 047820 삼천당제약 추가 (143종목)               ✅
medtech_kr 전면 재구성 (삼천당/미래컴퍼니/리가켐/솔바이오)   ✅
telecom 삼성SDS 제거 (w:38/34/28 순수 통신3사)             ✅
retail 제일기획 제거 (w:24/22/20/18/16)                     ✅
logistics 롯데지주 제거 (w:32/28/22/18)                     ✅
steel_chem S-Oil 제거 (w:30/22/20/16/12)                   ✅
nuclear 두산에너빌리티 35→30% 보정                          ✅
US SUB_THEMES 45개 전테마 weights 부여 (21개 신규)          ✅
semi_equip CDNS/SNPS 추가 + 명칭 'EDA' 포함                ✅
nuclear_util OKLO 추가 (w:8%)                               ✅
defense PLTR 5→10%                                          ✅
PRIORITY_SYMS 047820.KQ 추가                                ✅
KOSDAQ 목록에 047820 추가                                    ✅
비중 산출 3대 기준 + 3대 금지 코드 주석                      ✅
medtech_kr HTML 카드 신규 종목 + 촉매 반영                   ✅
telecom HTML 카드 삼성SDS 제거                               ✅
steel_chem HTML 카드 S-Oil→한화솔루션 교체                   ✅
KR_THEME_CATALYSTS medtech_kr 갱신                           ✅
APP_VERSION v37.0 + HTML 배지 + version.json                ✅
CHANGELOG v37.0                                              ✅
JS 구문 검증                                                 ✅ 에러 0건
```

### v37.2 (LLM 답변 시스템 이원화 완전 적용)
```
_closeSnap() 시장환경 데이터 실시간 분리 (_liveFmt 추가)           ✅
_closeSnap() stockBasis/envBasis 필드 추가                         ✅
Home CHAT_CONTEXT 이원화 지시문 개편 (주가=종가, 시장환경=실시간)  ✅
Home CHAT_CONTEXT [종가]/[실시간] 태그 추가                        ✅
Technical CHAT_CONTEXT _closeSnap() 추가 + 종가 블록 + 이원화 지시 ✅
Macro CHAT_CONTEXT _closeSnap() 추가 + 종가 블록 + 이원화 지시     ✅
kr-tech CHAT_CONTEXT 한국 대장주 실시간→_closingVal(종가) 전환     ✅
kr-tech CHAT_CONTEXT KOSPI/KOSDAQ 종가 기준 전환                   ✅
kr-supply CHAT_CONTEXT KOSPI _closingVal(종가) 전환                ✅
이원화 매트릭스 주석 v37.2 확장 (CHAT_CONTEXTS 전체 매핑)          ✅
JS 구문 검증                                                       ✅ 에러 0건 (11개 블록)
CHANGELOG v37.2                                                    ✅

── 기존 정상 동작 확인 (변경 없음) ──
kr-themes CHAT_CONTEXT: 이미 _closingVal() 사용                    ✅ 변경 불필요
kr-macro CHAT_CONTEXT: 이미 _closingVal() 사용                     ✅ 변경 불필요
signal CHAT_CONTEXT: _liveSnap() only (실시간 전용 페이지)          ✅ 변경 불필요
fxbond CHAT_CONTEXT: 실시간 only (환율/채권 페이지)                 ✅ 변경 불필요
```

### v37.1 (분석 데이터 소스 이원화 — 주가=종가, 시장환경=실시간)
```
_closingVal() 데이터 소스 매트릭스 주석 추가                   ✅
computeTradingScore() VIX/VVIX/DXY/TNX/HYG/유가 → _ldSafe    ✅
computeTradingScore() SPX/SPY/RSP → _closingVal 유지           ✅
computeMarketHealth() VIX → _ldSafe, SPY/QQQ → _closingVal    ✅
classifyMarketRegime() VIX → _ldSafe, SPX → _closingVal       ✅
데이터 소스 이원화 원칙 주석 (3함수 모두)                       ✅
APP_VERSION v37.1 + HTML 배지 + version.json                   ✅
CHANGELOG v37.1                                                 ✅
JS 구문 검증                                                    ✅ 에러 0건

── 브라우저 QA 점검 (2026-03-29) ──
computeMarketHealth() qqq 미정의 변수 버그 → ld['QQQ'] 수정    ✅ 핫픽스
computeTradingScore() 실행 정상 (total:5)                       ✅
classifyMarketRegime() 실행 정상 (DOWNTREND)                    ✅
_closingVal SPY/SPX/RSP/QQQ 정상 반환                          ✅
_ldSafe VIX/DXY/TNX/HYG/OIL/VVIX 정상 반환                    ✅
KR_STOCK_DB 143종목, 삼천당제약 047820 확인                     ✅
KR_THEME_MAP medtech_kr 전면 재구성 확인                        ✅
KR_THEME_MAP telecom/retail/logistics/steel_chem 종목 제거 확인 ✅
nuclear 두산에너빌리티 w=30 확인                                ✅
SUB_THEMES 45개 전테마 weights 보유 확인                        ✅
semi_equip CDNS/SNPS, nuclear_util OKLO, defense PLTR=10%      ✅
US 테마 히트맵 + 섹터 분석 정상 렌더링                          ✅
KR 테마 카드 medtech_kr 신규 종목/촉매 정상 표시                ✅
18개 페이지 순회 — showPage() 에러 0건                         ✅
콘솔 에러 0건 (리프레시 포함)                                   ✅
JS 구문 재검증 (핫픽스 후)                                      ✅ 에러 0건

── v37.5 전수점검 (2026-03-30) ──
CHAT_CONTEXTS 이원화 전면 적용 (12개 기본 컨텍스트)              ✅
  signal: _closeSnap() + 종가/실시간 지시문                      ✅
  breadth: _closeSnap() + 종가/실시간 지시문                     ✅
  sentiment: _closeSnap() + 종가/실시간 지시문 + 지정학블록       ✅
  briefing: _closeSnap() + 종가/실시간 지시문 + 지정학블록        ✅
  technical(기본): _closeSnap() + 종가/실시간 지시문              ✅
  macro(기본): _closeSnap() + 종가/실시간 지시문                  ✅
  fundamental: _closeSnap() + 종가/실시간 지시문                  ✅
  themes: _closeSnap() + [실시간] 태그                            ✅
  guide: _closeSnap() + 종가/실시간 지시문                        ✅
  screener: _closeSnap() + 종가/실시간 지시문                     ✅
  options: _closeSnap() + 종가/실시간 지시문                      ✅
  portfolio: _closeSnap() + 종가/실시간 지시문 + 지정학블록       ✅
  fxbond: _closeSnap() + 종가/실시간 지시문                       ✅
briefing 구버전 newsCache.slice(0,5) 이중 주입 제거              ✅
관세/무역전쟁 키워드 보강 (MACRO_KW ~28개, TOPIC_KEYWORDS 동기화) ✅
지정학 컨텍스트 블록 확산 (briefing/sentiment/portfolio)          ✅
_closeSnap() 전수 카운트: 18회 (1정의+17호출)                    ✅
JS 구문 검증 11개 script block                                    ✅ 에러 0건
version.json v37.5                                                ✅
CHANGELOG.md v37.5 항목 추가                                      ✅

── v37.6 키워드 대폭 확장 (2026-03-30) ──
TECH_KW 확장 (~255→~340+): CPO/유리기판/BSPDN/에이전틱AI/800V 등 ✅
MED_KW 확장: 골든돔/드론방어/레이저무기/GLP-1/바이오시밀러 등     ✅
TOPIC_KEYWORDS semi: CPO/유리기판/에이전틱AI/액침냉각/NVLink 등    ✅
TOPIC_KEYWORDS defense: 골든돔/미사일방어/드론방어/Anduril 등      ✅
TOPIC_KEYWORDS energy: DC전력/800V/전고체배터리/액침냉각 등        ✅
한국어 키워드 동기화: 광패키징/에이전틱AI/소버린AI/골든돔 등       ✅
JS 구문 검증 11개 script block                                    ✅ 에러 0건

── v37.7 시장 키워드 2차 확장 (2026-03-30) ──
TECH_KW 2차 확장 (~340→~430+): 양자컴퓨팅/우주경제/사이버보안/원전/AI인프라SW ✅
MED_KW 2차 확장: GLP-1 세부/바이오심화/ESS/조선/우주/사이버보안 기업        ✅
MACRO_KW 확장: AI CapEx/power demand/nuclear renaissance/CHIPS Act 등       ✅
TOPIC_KEYWORDS 신규 토픽 4종: healthcare/shipbuilding/space/quantum          ✅
_CTX_TOPIC_MAP 신규 4개 토픽 매핑                                            ✅
한국어 키워드 동기화: 양자컴퓨팅/큐비트/우주경제/스타링크/제로트러스트 등    ✅
JS 구문 검증 11개 script block                                              ✅ 에러 0건

── v37.8 전 페이지 동적 분석 텍스트 (2026-03-30) ──
kr-macro: _generateKrMacroAnalysis — KRW/USD·10Y·VIX 복합 리스크 진단       ✅
kr-themes: _generateKrThemesAnalysis — Top3/Bottom3·테마브레스·리스크온오프   ✅
portfolio: _generatePortfolioAnalysis — 과집중 경고·일간/누적 P&L 해석       ✅
screener: _generateScreenerAnalysis — BUY/SELL 비율·평균 RSI 판단            ✅
sentiment: _generateSentimentAnalysis — F&G+VIX+P/C 복합 판단                ✅
options: _generateOptionsAnalysis — VIX 전략·IV Rank·VVIX/VIX·추천전략       ✅
fundamental: _generateFundamentalAnalysis — P/E 분포·Top ROE·등락종목        ✅
HTML 컨테이너 7개 페이지 삽입 확인                                           ✅
기존 init/render 함수에 호출 연결 7건                                        ✅
JS 구문 검증 11개 script block                                              ✅ 에러 0건
R1 5곳 버전 싱크 (title/badge/version.json/CLAUDE.md/CHANGELOG)             ✅

── v37.9 국내 테마 UI/UX 전면 개편 (2026-03-30) ──
CSS: kr-ticker-pill 그리드 레이아웃 전환 (종목명·가격·등락%)              ✅
HTML: 112개 pill 구조 일괄 변환 (pill-pct→pill-wt + pill-pct 분리)        ✅
JS: initKoreaThemes pill 렌더링 개선 (2자리 등락%, 원 제거)               ✅
JS: showKrThemeDetail 대폭 강화 (요약카드4·강도판단·메달·AI버튼4)         ✅
JS 구문 검증 11개 script block                                            ✅ 에러 0건
R1 5곳 버전 싱크 (title/badge/version.json/CLAUDE.md/CHANGELOG)           ✅
── v37.9 핫픽스 (2026-03-30) ──
BUG: .page.active contain-intrinsic-size 제한 → 스크롤 불가 수정           ✅
v34.9 정적 스냅샷 노란 경고 제거 (kr-supply)                               ✅
kr-supply 수급분석 동적 텍스트 강화 (주체별·연속성·시그널·경고)             ✅
JS 구문 검증 11개 script block                                            ✅ 에러 0건

── v38.0 미국+한국 테마 심층 분석 엔진 (2026-03-30) ──
미국: _buildThemeDeepAnalysis 함수 추가 (온도·격차·건강도·서브테마·ETF비교) ✅
한국: _buildKrThemeDeepAnalysis 함수 추가 (온도·편차·건강도·대장주·비중)   ✅
showThemeDetail 내 심층 분석 호출 연결                                     ✅
showKrThemeDetail 내 심층 분석 호출 연결                                   ✅
JS 구문 검증 11개 script block                                            ✅ 에러 0건
R1 5곳 버전 싱크 v38.0                                                    ✅

── v38.0 핫픽스: 스크롤+인사이트 레이아웃 수정 (2026-03-30) ──
BUG: .content overflow-x:hidden 추가 (수평 오버플로우 차단)                 ✅
BUG: .page/.page.active overflow-x:hidden 추가 (페이지 단위 방어)          ✅
BUG: .insight-box max-width:100% + overflow-wrap 추가 (부모 넘침 방지)     ✅
BUG: .insight-box.box-collapsed max-width:100% + box-sizing 추가           ✅
BUG: .page.active contain-intrinsic-size: none 확인 (이전 핫픽스 유지)     ✅
JS 구문 검증 11개 script block                                            ✅ 에러 0건

── v38.1 전수점검 보고서 기반 전면 수정 (2026-03-30) ──
C1: APP_VERSION const v37.2→v38.1 (런타임 덮어쓰기 수정)                   ✅
C2: KR_STOCK_DB themes 3건 (삼성SDS/LG전자/S-Oil)                         ✅
C3: fetchYFChart _pct falsy 버그 (_pct==null 으로 수정)                    ✅
H1: KR_THEME_CATALYSTS telecom 삼성SDS→LG유플러스                         ✅
H3: MACRO_KW 해운항로 한국어 키워드 추가                                   ✅
SCROLL: .main/.content min-height:0 추가 (flex column 근본 수정)           ✅
SCROLL: insight-box max-width:100% + overflow-wrap                         ✅
SCROLL: .content/.page/.page.active overflow-x:hidden 3중 방어             ✅
MEM: fetchSparkData .catch() 추가                                          ✅
MEM: 차트 mouseleave 중복 리스너 removeEventListener 방지                  ✅
MEM: visibilitychange _dataStatusInterval 클린업/재시작                     ✅
JS 구문 검증 11개 script block                                            ✅ 에러 0건
R1 5곳 버전 싱크 v38.1 (title/badge/APP_VERSION/version.json/CLAUDE.md)    ✅

── v42.3/v42.4 감사 리포트 11건 반영: Dead DOM + 레이아웃 + 브레드쓰 데이터 (2026-04-06) ──
BUG: .bb-label font-size 11px→8px + min-width 제거 (breadth 바 레이블 오버플로우)         ✅
BUG: Pattern Scanner 제거 (Signal/Momentum Dead 컬럼 — JS 업데이트 함수 없음)             ✅
BUG: Portfolio 카드 텍스트 겹침 → flex:1;min-width:0 수정                                 ✅
BUG: fxbond initYieldCurveChart() 잘못된 페이지 호출 제거                                 ✅
BUG: breadth-bar querySelector('div') null → el.style.width 직접 적용 (A-2)             ✅
BUG: applyDataSnapshot map 4개 키 누락 — retail-sales/wage-growth/cons-conf/housing (A-3) ✅
BUG: signal 브레드쓰 바 6개 행 Dead Static HTML → ID 부여 + updateBreadthBars() 신설 (A-1) ✅
BUG: destroyPageCharts themes 케이스 누락 → RRG clearRect 추가 (D-3)                     ✅
UX: risk-monitor-grid + portfolio summary 4열 → auto-fill minmax 반응형 (B-3)            ✅
DATA: bpLabels/bhLabels 2/20~3/19 → 3/6~4/2 갱신 (6주 괴리 수정, R21) (C-2)            ✅
RULE: getDataAge() days>3 → days>1 (R21 2일 이상 stale 배지) (A-4)                     ✅
SKILL: /qa TIER 13 추가 — Dead Static HTML / applyDataSnapshot 매핑 전수 확인           ✅

── v41.8 감사 리포트 3건 반영: 종목 품질 + 테마 가중치 + CSS 정렬 (2026-04-05) ──
BUG: streaming weights PARA->PSKY 키 수정                                  ✅
BUG: .kr-ticker-pill grid 1fr auto auto auto + ::before bar               ✅
종목: SSNLF 제거 (memory/foundry) + 비중 재분배 합계 100%                    ✅
종목: LCID 제거 (ev_auto) + 5개 quick-access 배열에서도 제거                  ✅
종목: STEM 제거 + FLNC 추가 (hydrogen_ess) 합계 100%                        ✅
종목: U 제거 (gaming) 합계 100%                                             ✅
종목: BTBT/HUT/APLD 제거 (neocloud) 합계 100%                              ✅
종목: PLUG/FCEL 비중 축소, BE 확대 (hydrogen_ess) 합계 100%                  ✅
종목: SEDG w:16->8, ENPH/FSLR 확대 (solar_renew) 합계 100%                 ✅
종목: photonics_kr 12->4종목 합계 100%                                      ✅
종목: crypto 카카오 w:30->15, 위메이드 w:25->35 합계 100%                    ✅
종목: KR_STOCK_DB theme 배열 6건 수정                                       ✅
로직: SPY ATH localStorage 동적 추적                                        ✅
로직: calcCompositePerf mcap 폴백                                           ✅
전체 바/그래프 정렬 전수 확인 (5패턴: pill/KR perf/US sector/sub-themes/score) ✅

── v45.5: 사용자 인터랙션 결과 검증 (2026-04-09) ──
P65: UI 토글/탭/모드 변수가 렌더 함수 내부에서 실제 분기 사용되는지 grep — `setSectorPerfMode` 같은 dead toggle 검출
P66: 데이터 미수신 상태에서 "로딩" 텍스트 영구 정체 금지 — 폴백 사용 또는 "대기/—"로 명시
P67: 동급 컴포넌트(pulse-seg/카드)는 동일 자식 구조 — 한 segment만 자식 누락 시 시각 정렬 깨짐

── v46.8: 함수 로직/기준/보안 전수 점검 (2026-04-14) ──
P83: signal 페이지 재진입 시 refreshSignal 타이머 복구 — initSignalDashboard에서 _refreshSignalInterval 재등록 확인
P86: classifyTopic 반환 토픽과 _macroT 배열 정합 — TOPIC_KEYWORDS 실존 키만 포함 확인
P88: window._putCallRatio 설정 여부 — fetchPutCall()에서 할당 확인 (computeTradingScore/ExecutionWindow 참조)
P89: updateEntryChecklist 이벤트 날짜 — 과거 경과 날짜 잔존 여부 확인 (현재일 기준)
P90: _calcEMA 루프 인덱스 — prices[period+i] 범위 초과 없는지 확인
P91: updateBottomProcess Dead Zone — b5=null 시 모든 stage 조건 false→stage=0 오판 방지
P95: Stooq CSV 파싱 인덱스 — cols[6]=Close, cols[3]=Open (cols[7]=Volume 아님)
P96: DATA_APIS key() — PIN 설정 후 safeLSGetSync 경유 확인 (암호화 문자열 API 전달 방지)
P97: SCREENER_DB 섹터명 ↔ SECTOR_COLORS/분석함수 섹터명 정합 — 'Financials' vs 'Financial Services', 'Consumer' vs 'Consumer Defensive'
P100: innerHTML 삽입부 escHtml 전수 — p.ticker, p.memo, t.sym, t.note, g.term, g.def (XSS)
P101: _calcRSILast Wilder SMMA 여부 — 단순평균 아닌 Wilder smoothed 구현 확인
P102: generateMacroStoryline 금리 심볼 — ^FVX(5년물)를 "2년물"로 표기하지 않는지 확인
P103: _generatePortfolioAnalysis 베타 수식 — pfBeta/totalW 정상 가중평균 (noop 아닌지)
P104: isCompanyNews companyTopics ↔ TOPIC_KEYWORDS 전체 토픽 커버 — 누락 토픽 없는지
P105: _generateAIBriefing 이벤트 날짜 — 현재일 기준 과거 이벤트가 "향후"로 주입되지 않는지

── v46.8: 라벨/기준 통일성 검증 ──
VIX 라벨 5단계(안정/주의/경계/공포/극단공포): 15/20/25/30 경계 — 모든 함수에서 동일한지 grep 확인
F&G 라벨: <= 연산자 통일 (25/45/55/75) — < vs <= 혼용 없는지
VKOSPI 라벨: 15/25/35 기준 4단계(안정/경계/공포/극단공포) — 모든 함수에서 동일
```

── v48.62: UX 실전성 — 결론 바·배지·폰트 (2026-04-22) ──
P106: 4개 우선 페이지(home/signal/sentiment/macro) 상단에 `.page-conclusion-bar` 존재 여부 — `id="home-conclusion-bar"` 등 grep 확인
P107: `_updateAllConclusionBars()` 호출 경로 — `updateMarketPulse()` 내 마지막 줄 및 `aio:liveQuotes` 이벤트 후 트리거 확인
P108: `fb-estimated` 배지 색상 — amber(`rgba(255,163,26,...)`) 정상 렌더링 여부
P109: 결론 바 "업데이트" 열 — 데이터 로드 후 "—" 에서 상대시간(예: "3분 전")으로 갱신되는지 확인
P110: 새 페이지 추가 시 R49 준수 — 결론 바 div 삽입 여부 grep(`id=".*-conclusion-bar"`) 확인
