---
verified_by: agent
last_verified: 2026-04-11
confidence: high
---

# AIO Screener -- 기술 지식 베이스 (Knowledge Base)

> **목적**: 대화/작업 중 발견한 기술적 인사이트를 축적하여, 새 대화에서 같은 것을 재발견하는 비효율을 제거.
> BUG-POSTMORTEM이 "무엇이 고장났나"를 기록한다면, 이 파일은 "어떻게 동작하는가"를 기록한다.
>
> **환류 규칙 (R26)**: 새 인사이트 발견 시 이 파일에 추가. 반복 패턴이면 RULES.md 규칙 승격 검토.
> **카테고리**: API, 브라우저, Chart.js, DOM/CSS, JS 패턴, 데이터

---

## API 동작

### Yahoo Finance API
- `meta` 객체에 `regularMarketChangePercent` 필드 **없음** -- `regularMarketPrice`와 `chartPreviousClose`에서 수동 계산 필요: `(price - prevClose) / prevClose * 100`
- `meta.regularMarketTime`은 Unix timestamp (초 단위). 장 마감 후에도 마지막 거래 시각 유지.
- pre/post market 데이터: `meta.preMarketPrice`/`meta.postMarketPrice` -- 장외 시간에만 존재, 정규 장 중에는 undefined.
- 쿼리 `range=1d&interval=5m` 시 미국 장 시간 기준 데이터 반환. 비미국 시장(KS, KQ)은 range=1d로도 전일 데이터가 올 수 있음.
- 한 번에 5개 이상 심볼 요청 시 일부 심볼 누락 가능 -- 배치 크기 조절 필요.
- ADR(20-F 기업)의 `financialData`에 IFRS 항목명이 올 수 있음 -- `us-gaap` 없으면 `ifrs-full` 폴백 필수 (R23).

### CoinGecko API
- 무료 티어 rate limit: 10-30 req/min. 초과 시 429 응답.
- `price_change_percentage_24h`가 null인 신규 상장 코인 존재 -- `|| 0` 패턴 사용 금지 (R15).

### SEC EDGAR (XBRL)
- CORS 차단됨 -- 직접 fetch 불가, Cloudflare Worker 프록시 필수.
- `companyfacts.json` 크기가 수 MB -- 무거운 종목(AAPL 등)은 파싱 지연 발생.
- 10-K(미국 기업) vs 20-F(외국 발행인) vs 20-F/A(수정본) -- formType 필터 시 셋 다 포함 필수 (R23).

### rss2json
- 무료 티어: 10,000 req/day, 단일 피드 10건 제한.
- 일부 RSS 피드의 `content` 필드에 HTML 태그 포함 -- `escHtml()` 또는 `textContent` 추출 필수.

---

## 브라우저 / DOM / CSS

### SPA 페이지 전환 패턴
- `showPage()` 호출 시 반드시 `destroyPageCharts()` 먼저 -- Chart.js 캔버스 해제 안 하면 메모리 누수.
- init 가드 변수(`_xxxInitDone`)는 destroy 시 반드시 `false`로 리셋 -- 안 하면 재진입 시 Dead Page (R9).
- `popstate` 핸들러는 `showPage()`와 **동일한 초기화 경로**를 타야 함 -- `aio:pageShown` 이벤트 발송 누락 시 12개 페이지 빈 화면.

### setInterval 관리
- 페이지에 `setInterval` 등록 시 반드시 `destroyPageCharts`에 대응 `clearInterval` 추가.
- `window._refreshSignalInterval` 같은 전역 타이머도 페이지 이탈 시 해제 필수.
- 타이머 ID는 변수에 저장, destroy 시 null 리셋.

### CSS 유의사항
- `* { scrollbar-width: thin }` -- 37,000+ 요소에 적용, `html` 셀렉터로 축소.
- `overflow: hidden` on parent -- 자식 콘텐츠 잘림 주의. 3중 방어: `overflow-x:hidden; overflow-y:auto; word-break:break-word` (R5).
- flex column에서 `overflow:auto` 사용 시 반드시 `min-height: 0` 추가 -- 없으면 전체 페이지 스크롤 불가.
- 인라인 `font-size: 11px` 미만 금지 -- CSS override가 자동 보정하지만 의도와 다른 크기 표시.
- 한국어 텍스트는 라틴 기준 grid 컬럼에서 오버플로우 -- `word-break: keep-all` + 최소 너비 확보 (R7).

### innerHTML 보안
- 사용자/외부 데이터를 `innerHTML`에 삽입 시 반드시 `escHtml()` 래핑 -- XSS 벡터.
- `textContent`는 안전하지만 HTML 구조가 필요하면 `escHtml()` + `innerHTML` 조합.
- `el.children.length > 0`이면 `textContent` 직접 설정 금지 -- 자식 DOM 파괴됨 (P24).

---

## Chart.js 패턴

### 데이터 방어
- `chartDataGate()` 통과 후에만 차트 생성 -- NaN, null, undefined, Infinity 방어.
- `_sanitizeChartData()` -- 배열 데이터 정제, NaN을 null로 변환 (Chart.js는 null을 gap으로 표시).
- `spanGaps: true` 설정 시 null 구간도 선으로 연결 -- 의도치 않으면 false 유지.

### 인스턴스 관리
- `destroyPageCharts(pageId)`로 페이지별 차트 인스턴스 정리 -- `chart.destroy()` 호출 후 변수 null 리셋.
- 캔버스 ID가 실제 해당 페이지 DOM과 일치하는지 확인 -- 불일치 시 다른 페이지 캔버스에 그림.
- CDN 로딩 지연 시 Chart.js 미로드 상태에서 차트 생성 시도 -- 텍스트 폴백 필수 (R8).

---

## JS 패턴

### 데이터 수집
- `_pct || 0` 패턴 **절대 금지** -- null(미수신)과 0%(보합)을 구분 불가 (R15).
- 올바른 패턴: `_pct != null ? _pct : null` (미수신 시 null 유지) 또는 `_pct != null ? _pct : 0` (폴백 명시).
- `_ldSafe(ticker, field)` -- `_liveData` 안전 접근 + `_SNAP_FALLBACK` 자동 폴백. raw `ld['XXX']` 직접 접근 금지.

### 키워드 필터링
- TECH_KW/MACRO_KW에 3글자 미만 단독 키워드 금지 (R17) -- `'S'`, `'QE'` 같은 단일/이중 문자가 모든 텍스트에서 오탐.
- 영어 일반 단어와 겹치는 티커(ARM, CAN, CASH 등)는 `_TICKER_WORD_OVERLAP`에 등록.
- `extractTickers()` 내 RegExp는 함수 밖에서 캐시 -- 반복문 내부 `new RegExp()` 금지 (P36).

### 에러 처리
- `const` 변수는 반드시 첫 사용 전에 선언 -- TDZ(Temporal Dead Zone) ReferenceError 방지.
- `fetch` 타임아웃: `{timeout: N}` 옵션은 **비표준** -- 반드시 `AbortController` 또는 `withTimeout()` 사용.
- `native confirm()` / `alert()` 사용 금지 -- `showConfirmModal()` 사용 (비동기 + 커스텀 UI).

---

## 데이터 정합성

### 하드코딩 vs 동적 데이터
- 하드코딩 차트 데이터(VIX/NAAIM/AAII/브레드쓰)는 `DATA_SNAPSHOT._updated`와 함께 관리.
- 3일+ 경과 시 `renderStaleWarning()` 경고 배지 자동 표시 (R21).
- 동적 전환 가능한 데이터(VIX/HYG/SPY/QQQ)는 Yahoo Finance API로 자동 교체, 하드코딩은 폴백.
- 동일 데이터가 여러 곳(home sidebar vs 전용 페이지)에 표시 시 **단일 원천** 원칙 -- grep으로 모든 표시 지점 확인.

### KR_STOCK_DB 품질
- 비상장 종목 혼입 금지 -- 종목 추가 시 KOSPI(.KS)/KOSDAQ(.KQ) 상장 여부 확인 필수.
- `themes: []` 고아 엔트리 금지 -- 최소 1개 테마 배정.
- SUB_THEMES에 새 종목 추가 시 반드시 KNOWN_TICKERS에도 포함 (P37).

---

## 뉴스 파이프라인

### 선별 계층
- **홈 핵심**: 정적 큐레이션 (`HOME_WEEKLY_NEWS`), 2-3건 (R22).
- **브리핑**: score 45+, 5-20건, score 우선 선별 후 시간순 재정렬.
- **시장 뉴스**: score 30+, 150건 상한, 48h, 시간순.
- `scoreItem()`에 5대 토픽 부스트 + 비시장 정치 감점(-25) 필수.

### 텔레그램 소스
- rsshub 403 차단 채널: `_TG_DIRECT_ONLY`에 등록, CF Worker 직접 스크래핑.
- 공개 미리보기 비활성 채널: `_TG_UNAVAILABLE`에 등록, 즉시 스킵.
- `isFetching` 안전장치: 80개 소스 기준 180초 (60초는 부족).
- 광범위 키워드(`market`, `space`)만 1개 매칭 시 불통과 -- `_TG_BROAD_KW` 체크.

---

## 스킬 최적화 패턴 (Autoresearch)

### Karpathy Autoresearch 방법론
- 출처: Andrej Karpathy의 자율 실험 루프 → Claude Code 스킬 적용 버전
- 핵심: 스킬을 반복 실행 + 바이너리 yes/no eval + 변수 1개씩 변경 + 점수 하락 시 롤백
- 스킬 설치 위치: `.claude/skills/autoresearch/SKILL.md`
- 발견 버전: v43.5

### 바이너리 Eval 원칙 (eval-guide.md 핵심 요약)
- **척도 금지**: "1~7점" 대신 yes/no만. 척도는 가변성을 증폭시켜 신뢰 불가.
- **3~6개 최적**: 6개 초과 시 스킬이 eval만 앵무새처럼 반복하기 시작 (게임 현상).
- **측정 가능성**: "유용한가?" 금지. "수치 ≥3개 포함인가?" 처럼 관찰 가능한 신호로 변환.
- **독립성**: eval 간 중복 금지. 각 eval은 다른 차원을 측정.
- **게임 내성**: 스킬이 내용 개선 없이 eval만 통과할 수 없어야 함.

### AIO 스킬 자기평가 적용 현황
| 스킬 | Eval 추가 여부 | 주요 체크 항목 |
|------|---------------|---------------|
| `/integrate` | **완료** (v43.5) | TECH_KW ≥3, SCREENER_DB ≥1, CHAT_CONTEXTS, CHANGELOG, R17 |
| `/data-refresh` | 후보 (autoresearch SKILL.md에 eval 정의됨) | 22카테고리 스캔, CRITICAL 0 미처리, 배열 길이, 버전 범프 |
| `/qa` | 후보 (autoresearch SKILL.md에 eval 정의됨) | div 균형, 버전 6곳, Dead Page 없음, 스코어링 |

### 단일 변수 변경 원칙
- 좋은 변경: 가장 빈번한 실패를 다루는 지시사항 하나 추가/수정/이동/예시 추가
- 나쁜 변경: 동시에 여러 규칙 추가, 스킬 전체 재작성, "더 잘해" 같은 모호한 지시
- 점수 동일도 폐기: 복잡성만 추가하고 이득 없음

### /integrate 자기평가 5단계 (v43.5 적용)
통합 완료 전 5개 yes/no 체크 강제:
1. TECH_KW/MACRO_KW 신규 키워드 ≥3개
2. 원문 핵심 티커 SCREENER_DB 갱신 ≥1개
3. CHAT_CONTEXTS 해당 섹션 업데이트
4. CHANGELOG.md 항목 추가
5. 모든 신규 키워드 ≥3글자 (R17)

---

## 매크로 프레임워크 인사이트

### FOMC "수량 표현" 해석 계층 (2026.04 의사록 기준)
- "Vast majority" > "Most" > "Many" > "Several" > "Some" > "A few" > "A couple of"
- "Vast majority"가 고용 하방 + 인플레 상방 동시 경고 = 듀얼 리스크 인식 (일방향 해석 금지)
- "Some"이 양방향 금리 시그널(인상 포함) 언급 = 시장의 인하 일변도 기대와 괴리
- 발견 버전: v46.3

### 재무부-연준 힘겨루기 메커니즘 (2023년 증거)
- 연준 긴축(5% + QT $950억/월)에도 옐런 TGA 방출 + T-bill 발행으로 역레포→시장 유동성 이전 → S&P +24%
- TGA 변동 ≠ 시장 유동성 변동 (T-bill→MMF→역레포 인출 경로로 은행 준비금 거의 미감소)
- 정치적 인센티브(선거 전) = 재무부 유동성 공급 의지의 충분조건
- 2026년 베센트(소로스 출신) = 발행 전략 조절 도구 보유, BUT 2023식 강제 TGA 방출 메커니즘(부채한도)은 없음
- 관련 규칙: 매크로 분석 시 연준 단독 해석 금지, 재무부 발행 전략 동시 고려
- 발견 버전: v46.3

### CSS overflow-x:hidden의 overflow-y 자동 변환 (P74)
- CSS 명세: `overflow-x: hidden`만 설정 → 브라우저가 `overflow-y`를 자동으로 `auto`로 변환
- 결과: 의도하지 않게 스크롤 컨테이너가 됨 → 부모의 스크롤과 충돌
- `.content(overflow-y:auto)` > `.page(overflow-x:hidden → overflow-y:auto 자동)` = 이중 스크롤 충돌
- 해결: `.page`에서 overflow-x:hidden 제거 (`.content`가 이미 처리)
- 발견 버전: v46.4

### 폴백값 구조화 원칙 (P72)
- 폴백값은 각 함수에 하드코딩 금지 → `DATA_SNAPSHOT._fallback` 단일 진실 원천
- /data-refresh 시 DATA_SNAPSHOT과 _fallback 동시 갱신 → 자동 동기화
- 발견: 3월 전쟁 피크 폴백값(F&G=18, breadth=27.1)이 4월 휴전 후에도 잔존 → 극단 공포 표시
- 발견 버전: v46.4

### 데이터 검증 3단계 원칙
- L1 입력: PriceStore.set() (symbol 유효성 + 가격 범위 + 급변 감지)
- L2 가공: _clamp(v, lo, hi) (VIX 5~150, DXY 80~130 등 합리 범위)
- L3 출력: escHtml() (XSS 방어) + isFinite() (NaN 노출 방지)
- FMP 전용: _validateFMPData() 7개 검증 (ticker 매칭, 가격 괴리, PE 범위, 이익의 질, 희석)
- 발견 버전: v46.4

---

## 인사이트 추가 규칙

### AI 인프라 패러다임 전환 (Cantor 2026.04)
- 기존 틀: AI DC = "서버가 들어간 부동산", 병목 = GPU 공급
- 새 틀: AI DC = "부동산이 딸린 전력 인프라 프로젝트", 병목 = "GPU를 꽂을 전력이 있는 부지" (time-to-power > time-to-build)
- NVDA 5년 39GW 추산 vs 미국 DC 21GW = 20GW 갭 → 네오클라우드(CRWV/CORZ/WULF/IREN) 구조적 기회
- 하이퍼스케일러가 내재화 못하는 이유: 자본이 아닌 전력조달+자본배분 경직성+리스크 이전 필요
- 크레딧 래퍼 구조: GOOGL 백스톱 → SOFR+600bp→250bp (WULF→CIFR→HUT 순차 확산)
- 관련: themes L0/L1.5 밸류체인, SCREENER_DB CRWV/CORZ/IREN
- 발견 버전: v46.5

### 소프트웨어 $100B AI Shock (Citi 2026.04)
- 기존 틀: AI 예산 = 기존 SW 예산에 추가 (additive)
- 새 틀: AI 비상장 기업 매출 $1,000억+가 전통 앱 SW 신규 ACV $500-600억 압도 → 역전 발생 (2026년 중)
- 에이전틱 AI → 좁은 워크플로우 앱 우회 → 좌석 기반 앱 구조적 위험
- 방어적: 시스템 오브 레코드, 데이터 플랫폼, 미션 크리티컬 인프라 (데이터 중력+컴플라이언스)
- 취약: 좌석 기반 앱(차별화 제한 시), 수직형 SW(의외의 위험 — 프리미엄 밸류에이션+AI 수직화 모델 출시)
- 상대적 안전: SMB 지향 SW (SHOP/KVYO/HUBS — AI 생산성 향상이 신규 사업 형성 촉진)
- 관련: themes L3 밸류체인, Citi 톱픽 MDB/MSFT/SNOW/PLTR/SHOP
- 발견 버전: v46.5

---

새 인사이트 추가 시 아래 형식 준수:
```
### {주제}
- {핵심 동작/제약/주의사항}
- 관련 규칙: R{N} / P{N} (있으면)
- 발견 버전: v{X.Y}
```

반복 발견 3회 이상이면 RULES.md 규칙 승격 대상으로 `/knowledge-lint`에서 자동 플래그.
