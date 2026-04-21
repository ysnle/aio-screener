---
verified_by: human
last_verified: 2026-04-21
confidence: high
---

# AIO Screener -- 기술 지식 베이스 (Knowledge Base)

> **목적**: 대화/작업 중 발견한 기술적 인사이트를 축적하여, 새 대화에서 같은 것을 재발견하는 비효율을 제거.
> BUG-POSTMORTEM이 "무엇이 고장났나"를 기록한다면, 이 파일은 "어떻게 동작하는가"를 기록한다.
>
> **환류 규칙 (R26)**: 새 인사이트 발견 시 이 파일에 추가. 반복 패턴이면 RULES.md 규칙 승격 검토.
> **카테고리**: API, 브라우저, Chart.js, DOM/CSS, JS 패턴, 데이터

---

## 🧠 v48.61 5개 패러다임 전환 (2026-04-21 통합)

### 1. Apple 리더십 패러다임: 영업→하드웨어 회귀
**통찰**: Tim Cook(2011~) = 공급망/영업 중심. John Ternus(2026-09-01~) = 하드웨어/R&D 중심.
- Cook 재임 기간: 시총 $3000억 → $4조(13배), 서비스 매출 폭증, 규모 경제 극한 활용.
- Ternus 선택 배경: **"스마트폰 이후"(AI 글래스/로봇/XR) 폼팩터 경쟁 임박** → 하드웨어 CEO로 회귀는 **제품 혁신 가속 신호**.
- Cook은 Executive Chairman 잔류(정책/관세 관계). Johny Srouji(A4 설계자) Chief Hardware Officer = Apple Silicon 독립성 보강.
- **투자 시사**: AAPL 하드웨어 Capex 사이클 재가속 + AI 매개체(Siri 개인화 WWDC) 전략 전환. 현재 PE 조정에도 장기 재평가 가능성.

### 2. LLM 무기화 = 사이버 예산 패러다임 전환
**통찰**: Mythos(Anthropic)는 모델 무기화의 임계점. **"취약점 발견/악용 → 인간 개입 없이 자동화"**.
- Opus 4.7(의도적 축소) vs Mythos(제한 Project Glasswing 배포): Anthropic의 위험 관리 전략 = 제한적 엘리트 배포.
- OpenAI 대조: GPT-5.4-Cyber + TAC 14파트너 = "대중의 지혜" 접근.
- **구조 변화**: 탐지 중심 → **런타임 통제 중심**. CTEM(Continuous Threat Exposure Management) 지출 확대.
- **수혜 구조**: (a) 복수 인라인 제어포인트(CRWD/PANW/Cisco) (b) DDoS/WAF/API 보안(AKAM/NET) (c) 정부 표준화 경로(CAISI/AISI) = 예산 촉매 3중.
- **역설**: Mythos $25/$125 가격이 방어자도 제한 → 컴퓨팅 비용이 사이버 격차 심화.

### 3. 컴퓨팅 제약은 실리콘이 아닌 전력이다
**통찰**: AI 서밋 125개사 공통 메시지 = 2028년까지 용량 부족 지속. **병목은 GPU가 아닌 MW**.
- Lightning AI: 단일 기업 백만 에이전트 배포 시 추론 100배+, 컴퓨팅 1000배+.
- CoreWeave: 850MW → 3GW 계약 확보 필수.
- LTA 레버리지 역전: 과거 "LTA=정점" → 현재 "고객 선제안=공급사 레버리지"(AVGO 고객에 "연중반 HBM+CoWoS 주문 없으면 매진" 통지).
- **인접 수혜**: (a) 온사이트 발전(GEV/BE/CEG) (b) DC REIT(EQIX/DLR) (c) XPU 플랫폼(AVGO Broadcom 180억→500억→1000억 경로) (d) 피지컬 AI(로봇/자율차).

### 4. AV = 기존시장 잠식이 아닌 총량 확대
**통찰**: Goldman 보고서 핵심 프레임 — **로보택시는 UBER를 대체하지 않고 UBER 총예약을 키움**.
- 웨이모가 UBER 앱에 배치된 시장 = 차량당 일일 운행(TpVD) +30%.
- 2030년 AV 차량 62,750대로 UCAN 연 65억 건 수요 충족 불가 → 하이브리드 네트워크 필수.
- **수혜 구조**: (a) GOOGL(Waymo 2035 $200억+), (b) UBER/LYFT(2030 AV 라이드셰어 30%+ 중개), (c) AMZN(Zoox), (d) 부품(TEL/Hesai/APTV), (e) 중국 EV(XPEV).
- **중립/피해**: TSLA(FSD v14 중요 개입 2천마일 vs 웨이모 10만), AUR/RIVN/MBLY(실행 리스크), 전통 OEM(Ford/Daimler/Traton 밸류체인 위협).
- **극단 시나리오**: 모든 주행 공유 AV로 전환 시 SAAR 300-600만대 감소(자동차 판매).

### 5. 광통신 변곡점 = 구리 거리 한계 2028말~2029초
**통찰**: Lumentum CEO Michael Hurlston(Citi AI서밋) = **"3.2T 노드에서 구리 유효거리 1.5-2m로 급락 → 광학이 주 백플레인"**.
- 기존: 구리 인터커넥트 > 광학(비용 우위).
- 2028말: 대역폭 요구가 구리 물리 한계 초과 → **광학 유일 대안**.
- **공급 부족 2028-2029 지속**: InP(인듐 인화물) 공급이 수요 미따름 → Lumentum 7년 Sumitomo 약정.
- **산업 역사적 사건**: 광학 업계 사상 처음 공급자 가격 인상 + 원가 전가 구조.
- **수혜 구조**: (a) 광모듈(Innolight/Eoptolink/TFC) 1.6T→3.2T 업그레이드 사이클, (b) EML/CW 레이저(LITE InP), (c) CPO 장비(RoboTechnik), (d) OCS(광회로 스위치), (e) PCB 미드플레인(Victory Giant/WUS/EMC/Shengyi), (f) HCF(중공 광섬유) 적용 확대.
- **Broadcom 역설**: PA 레이저 용량 4배 확장 해도 판도 영향 미미 = LITE 경쟁 위치 확고.

---

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

### NARRATIVE_ENGINE 패턴 (v47.6 신설)
- **문제**: DATA_SNAPSHOT 숫자만 갱신하면 분석 서술 텍스트(§71·§72 채팅 AI 프롬프트, DOM rm-* 꼬리위험 보드)가 자동 반영되지 않음 — 정적 문자열이기 때문. v47.4 P61 반복 위반의 근본 원인.
- **해결 패턴**: `NARRATIVE_ENGINE` 헬퍼 모듈을 `_snap` 아래 삽입. 3개 계층으로 구성:
  1. **레짐 분류기** (`getXxxRegime(v)`): 값 → `{level, label, color, bar%}` 객체 반환. 텍스트·DOM 색상·바 폭 모두 같은 레짐에서 파생.
  2. **동적 텍스트 생성기** (`getXxxText()`): DATA_SNAPSHOT 필드 + 레짐 분류기 조합으로 완성된 문단 생성. 템플릿 리터럴 + `_snap.fixed()` 포맷터.
  3. **DOM 렌더러** (`renderXxx()`): 분류기 결과를 DOM에 바인딩. DOMContentLoaded 훅에서 자동 실행.
- **효과**: DATA_SNAPSHOT.skew 141.86 → 150으로 바꾸면 SKEW 레짐이 자동으로 "꼬리위험 고점" → "극단 꼬리헤지 비쌈"으로 바뀌고, §72 트레이딩 규칙 문단의 모든 관련 수치·판정·모니터링 트리거가 동시에 갱신됨. P61 근본 해결.
- **CHAT_CONTEXTS 통합 포인트**: `NARRATIVE_ENGINE.getDistributionDiagnosisText(DATE_ENGINE.today())` — 14줄 정적 문자열이 2줄 함수 호출로 축약.
- **적용 범위**: 현재 F&G 내부 구조 + 분배 진단 + rm-* 보드. 확장 가능: CP3 매크로 카드, MACRO_KW 키워드 자동 생성, Wall Street IB 인용.
- **주의**: NARRATIVE_ENGINE은 DATA_SNAPSHOT 정의 이후 실행되어야 함. IIFE + `try { NARRATIVE_ENGINE.init() } catch(e)` 이중 안전장치로 순서 의존성 완화.

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

### 군사적 승리 ≠ 전략적 승리 — 호르무즈 역학 (돈스/JPM Kavanagh 2026.04)
- 기존 틀: 군사 우위 = 협상 레버리지. 전쟁 승리 → 조건부 항복.
- 새 틀: 이란 해군/공군 파괴됐으나 IRGC가 호르무즈 통제 유지 = 생존 자체가 승리. 기뢰는 군대가 패배해도 바다에 남음.
- 물리적 현실: 14M bbl/d 공급 갭, 해협 11% 가동, 기뢰 제거 수개월, 미국 도착 42일. 헤드라인(시작됨)과 규모(얼마나 부족한지)의 괴리.
- 시간 = 이란 편: 이란이 협상 안 하는 건 미국이 더 절박해지길 기다리는 전술 (중간선거 7개월, 디젤 $8).
- 투자 함의: 유가 정상화 기대 시 "물리적 타임라인(분기 단위)" vs "헤드라인 타임라인(일 단위)" 구분 필수.
- 관련: macro §70, CP1/CP6, 유가 에스컬레이션 래더
- 발견 버전: v46.6

### 실질금리 마이너스 전환 리스크 — 2차 파급효과 (돈스/부산아재 2026.04)
- 기존 틀: 전쟁 종료 → 유가 안정 → 인플레 하락 → 금리 인하.
- 새 틀: 근원물가 3M 연율 4.4%(전쟁 전부터 가속). 전쟁은 불에 기름을 부은 것이지 불을 지른 게 아님. Warsh 5월 취임 시 인상 회피 → 실질금리 마이너스 → 1974-78 재현 리스크.
- 전이 경로: 에너지→연료비→항공료(서비스 물가) + WGT 상승 + 미시간대 장기 기대인플레 3.2→3.4% = 2차 파급 초기 신호.
- Inverse-L 필립스 함의: V/U<1(실업 민감) 구간에서도 기대인플레 반응함수는 여전히 작동 — 노동시장 약세가 기대인플레 방어를 보장하지 않음.
- 미국 순원유수입국(220만bbl/d), 셰일 반응 4-6개월, 퍼블릭 비중 75% = 자본규율 우선.
- 관련: macro §70, Fed 정책 경로, 금리 에스컬레이션 래더
- 발견 버전: v46.6

---

새 인사이트 추가 시 아래 형식 준수:
```
### {주제}
- {핵심 동작/제약/주의사항}
- 관련 규칙: R{N} / P{N} (있으면)
- 발견 버전: v{X.Y}
```

### NAND SCA 패러다임 — 사이클주→구조적 AI수혜주 전환 (Citi+Evercore 수렴, 2026.04)
- 기존 틀: NAND = 사이클주. 가격 정점→하락→마진 압축→재고소진→반등 반복.
- 새 틀: SCA(전략적 계약합의) = 가격 하한선 + 선급현금 보장. AI 수요 + 공급 절제 = 2028년까지 공급 제약 지속. 사이클 변동성 구조적 완화.
- TurboQuant 역설: 시장 "압축기술=메모리 수요↓" vs 경영진 "효율↑→AI 채택 가속→추론↑→스토리지 총수요↑" = DeepSeek 역설의 스토리지 버전.
- HDD도 멀티플 재평가 18x→21x: HAMR 44TB→140TB 로드맵 + 장기 GM50%+.
- 투자 함의: 메모리/스토리지 섹터를 사이클주 밸류에이션이 아닌 구조적 성장주로 재분류 필요. SNDK/MU/WDC/STX 공통.
- 관련: themes L1 밸류체인, fundamental §74
- 발견 버전: v46.8

반복 발견 3회 이상이면 RULES.md 규칙 승격 대상으로 `/knowledge-lint`에서 자동 플래그.

### PPI 수요파괴 3중 확인 — 마진 붕괴가 전달하는 신호 (2026.04 3월 PPI)
- 기존 틀: PPI 하락 = 인플레 완화 긍정. 헤드라인 MoM -0.4% = 호재.
- 새 틀: 헤드라인 하락의 원인이 수요파괴. 3중 확인: ① 무역 마진 MoM -1.4%(기업이 관세분 자체 흡수=마진 붕괴), ② 중간재 수요 MoM -0.4%(생산 투입 위축), ③ 원자재 MoM -1.9%(최종 수요 감소 역류).
- 투자 함의: PPI→PCE 전달 경로 분석 시 "수요파괴형 하락"과 "공급 개선형 하락"을 구분해야 함. 전자는 마진 압축→실적 하향→주가 하방, 후자는 비용 절감→마진 확대→주가 상방. 같은 PPI -0.4%도 원인에 따라 정반대 투자 결론.
- 관련: macro §71, MACRO_KW(margin compression, trade margin squeeze)
- 발견 버전: v47.1

### Michigan 기대인플레 탈앵커링 — 모델 무효화 리스크 (2026.04)
- 기존 틀: Michigan 서베이 = 소비자 심리 참고지표. 1Y 기대인플레가 높아도 5-10Y가 앵커되면 Fed 정책 여유.
- 새 틀: 1Y 기대인플레 4.8%(1993년 이후 최고) + 5-10Y 3.4%(2011년 이후 최고) = 장단기 동시 상승 = 앵커링 모델 자체가 무효화 위험. Fed가 의지하는 "장기 기대 안정" 논거 붕괴 시 매파 전환 강제.
- Bessent 재무장관 변화: 4월 초 "Recession OK"→4월 15일 "Big Beautiful Bill = biggest stimulus ever" = 성장 우선 선회. 재정 확대+인플레 기대 탈앵커링 동시 발생 = 1970년대 정책 실수 재현 리스크.
- 관련: macro §71, 실질금리 마이너스 전환 리스크(기존 인사이트), MACRO_KW(inflation expectation de-anchoring)
- 발견 버전: v47.1

### "Mission Accomplished" 자산괴리 — 주식 vs 모든 것 (2026.04 Week 3)
- 기존 틀: 자산시장은 하나의 내러티브로 수렴. 주식↑=리스크온=채권↓금↓달러↓.
- 새 틀: 주식만 "모든 위험 해소" 프라이싱, 채권·금·유가·VIX는 "위험 잔존" 프라이싱. F&G 68(탐욕) vs 금 $3,200+·10Y 4.3%+·유가 $60대(수요파괴 반영). 이런 괴리는 2000년 1월, 2007년 10월에도 관찰됨 — "주식이 맞거나, 나머지가 맞거나."
- CTA 매커니즘: Goldman $43.5B CTA 기계적 매수(가격 모멘텀 추종) vs 펀더멘탈 투자자 매도 = 수급 괴리가 가격 괴리를 만듦. 감마 만기(4/17) 후 CTA 지지 소멸 시 조정 리스크.
- SW vs Semi 로테이션: 소프트웨어가 반도체 대비 아웃퍼폼 = 시장이 "매출 가시성(구독)>Capex 사이클(반도체)"을 선호하는 방어적 성장 내 로테이션.
- 관련: macro §71, F&G 데이터 갱신(32→68)
- 발견 버전: v47.1

### TD Cowen DC 채널체크 — 9.4GW 역대 최대 + 리싱 구조 전환 (2026.04)
- 기존 틀: DC 수요 = 하이퍼스케일러 직접 건설 중심. 리싱은 보조적.
- 새 틀: 1Q26 하이퍼스케일러 DC 리싱 9.4GW = 역대 최대(전분기 대비 +40%+). Powered shell(전력 확보된 빈 건물) + Triple-net pricing(모든 비용 임차인 부담) 구조 확산 = 자본 경직성 회피 수단으로 리싱 가속.
- 투자 함의: Cantor AI DC 패러다임("부동산이 딸린 전력 인프라")과 수렴. 리싱 가속 = DLR/EQIX/AMT 같은 DC REIT 재평가 + 네오클라우드(CRWV/CORZ/WULF) 구조적 수혜 재확인.
- 관련: AI 인프라 패러다임 전환(기존 인사이트), TECH_KW(DC leasing, powered shell, triple-net pricing)
- 발견 버전: v47.1

### QCOM 추론시장 리레이팅 — 모바일SoC에서 EdgeAI 플랫폼으로 (2026.04)
- 기존 틀: QCOM = 모바일SoC + 로열티. 밸류에이션 12-18x (성숙 반도체).
- 새 틀: 클라우드AI→디바이스AI 전환 구간에서 QCOM 재평가. Snapdragon X Elite/Plus = Windows on ARM + Copilot+ PC = AI PC 시장 게이트키퍼. 온디바이스 추론 = 레이턴시 0 + 프라이버시 + 오프라인 = 클라우드 추론 대비 구조적 우위 영역 존재. 모바일SoC(12-18x)→AI PC+EdgeAI+온디바이스추론 플랫폼(20-30x) 멀티플 재평가 가능.
- 리스크: Intel Lunar Lake/Arrow Lake, Apple M-series, MediaTek Dimensity = AI PC 경쟁 심화. ARM 라이선스 분쟁 잔존.
- 관련: SCREENER_DB QCOM 메모 갱신, TECH_KW(Snapdragon X Elite, on-device inference)
- 발견 버전: v47.1

### 실제 클릭 테스트의 중요성 (P82 교훈, v46.5)
- `typeof fn === 'function'` = true여도 내부에서 TypeError 발생 가능
- KNOWN_TICKERS가 Set인데 .indexOf() 호출 → 코드 레벨 검증으로는 발견 불가
- **수정 후 반드시 실제 브라우저에서 버튼 클릭 + 입력 + 결과 확인**
- placeholder(화면에 보이는 숫자) ≠ value(실제 입력값) — 폼 테스트 시 주의
- 관련 규칙: R28
- 발견 버전: v46.5

### AI 채팅 할루시네이션 방지 패턴 (v46.5)
- systemPrompt에 데이터 검증 태그 주입: ✓(수집됨) / ✗(미수집) / ⚠(경과)
- ✗ 표시된 소스에 대해 "확인되지 않음"이라고 밝히도록 강제
- 응답 하단에 데이터 소스 배지(📊재무/📰뉴스/🔍웹검색) 자동 표시
- 피드백 버튼(👍/👎) → localStorage에 100건 저장
- messages 60K자 초과 시 자동 trim → 토큰 폭발 방지
- API 실패 시 모델 폴백(sonnet→haiku) + 자동 재시도 2회
- 관련 규칙: R29
- 발견 버전: v46.5

### ZBT 부재 = 강세 검증 실패 진단 (v47.2, 2026.04.16)
- **정의**: Zweig Breadth Thrust = NYSE 10일 이평 상승종목/(상승+하락) 비율이 0.40→0.615로 10영업일 내 급등. 1945년 이후 14회 발생, 전부 강한 강세 사이클 시작점.
- **현재(2026.04.15)**: 비율 0.576, 트리거 0.615 미달. 마지막 트리거는 2025.04.25, 그 이후 1년간 부재.
- **의미**: 지수 신고가 + 모멘텀 지표 과열(CNN 모멘텀 80.6, UW 프리미엄 트렌드 100)에도 **브레드쓰가 확장되지 않음** = 상위 소수 종목이 지수를 떠받치는 **"Lock-out Rally" 가장(假裝) 상태**.
- **역사 회귀**: 2000.01, 2007.10, 2021.11 분배 단계도 ZBT 부재 + 신고가 + 내부 괴리 동반. 셋 다 대폭락 선행.
- **검증 근거**: DATA_SNAPSHOT.zbt.current=0.5756, status='no_trigger', breadth_0313=0.37→breadth_0330=0.44 (회복 진행 중이지만 임계 미달).
- **반영 위치**: §72 macro, technical CHAT_CONTEXT, sentiment CHAT_CONTEXT, CP3 카드
- **관련 규칙**: R13 (dual sourcing), R26 (환류)
- **발견 버전**: v47.2

### 분배 단계 3/3 체크리스트 (v47.2, 2026.04.16)
- **정의**: 시장 분배(Distribution, 매수→매도 전환) 단계의 3대 구조적 특징. 1950년 이후 주요 천정(2000.01, 2007.10, 2021.11) 모두 3/3 부합.
- **체크리스트**:
  1. **내부 괴리**: 지수 신고가 vs 브레드쓰/신고저가 비율 악화. 현재 CNN 모멘텀 80.6 vs 주가 강도 24.8 = 54점 괴리. F&G 68(탐욕)이나 구성 요소의 절반이 중립/공포권.
  2. **꼬리위험 역설**: 채권 변동성(MOVE 68)은 역사적 저점이나 주식 꼬리위험(SKEW 139) 고점. 자산군 간 리스크 인식 불일치 = 보호 매수가 주식에만 집중.
  3. **브레드쓰 부실 돌파**: ZBT 트리거 부재. Mag7 조정 중 SPX 신고가 = 지수 Top-Heavy, 섹터 순환 기능 마비.
- **현재(2026.04.15)**: 3/3 모두 부합 → **분배 단계 경보**.
- **반례 주의**: 3/3 부합해도 시점은 1주~3개월 편차. 트리거(크레딧 스프레드 확대, 정책 실수, 블랙스완)까지 지연 랠리 가능 = "Pain Trade" 구간.
- **시그널 조합**: 분배 단계 + 숏 항복 완결 + VIX 커브 콘탱고 극대화 = 고점 임박.
- **반영 위치**: §72 macro, CP3 카드, KNOWLEDGE-BASE
- **관련 규칙**: R26 (환류)
- **발견 버전**: v47.2

### Pain Trade 완결 = 시장 고점 메커니즘 (v47.2, 2026.04.16)
- **정의**: 최대 다수(특히 헤지펀드 숏)가 고통받는 방향으로 시장이 움직이는 기간. 숏 커버 → 순매수 전환 → "숏충이(bears) 항복"이 완결되면 마지막 지지층(FOMO 매수자) 소진.
- **메커니즘 4단계**:
  1. **초기 랠리**: 긍정 촉매(실적, 정책, 지정학 완화) → 숏 압박 시작 (F&G 50→65).
  2. **숏 커버 가속**: Net-Short 포지션 급감, Goldman 프라임북 "롱온리 +24%", CTA 기계적 매수 진입 (F&G 65→75).
  3. **FOMO 폭발**: 리테일 감마 스퀴즈, 0DTE 콜 과매수. 주가 강도↓인데 모멘텀↑ = 상위 5종목만 상승 (F&G 75→80, UW 프리미엄 트렌드 100).
  4. **항복 완결**: 숏 포지션 제로, 대기매수 소진, 내부자 매수 0.1% (Insider Sentiment 제로). **신규 매수자 부재 → 작은 충격에도 급락**.
- **현재(2026.04.15)**: 3단계 진입 중. UW 프리미엄 트렌드 100 + Insider Sentiment 0.1 = 4단계 근접.
- **역사 선례**: 2000.03 닷컴 고점(롱온리 +28%, 리테일 FOMO), 2007.10 CDO 고점(숏 플립 후 -55%), 2021.11 밈스톡 고점(리테일 FOMO + 숏 소진).
- **카운터 시그널**: 숏 비율 재증가, VIX 콘탱고 붕괴, 크레딧 스프레드 >75bps 확대 시 고점 확인.
- **반영 위치**: §72 macro, sentiment CHAT_CONTEXT
- **관련 규칙**: R26 (환류)
- **발견 버전**: v47.2

### ASML 가이던스 체계 전환 — 조기 상향 패턴 (v48.16, 2026.04.18)
- **정의**: 오더 비공시 체제 전환 이후 ASML이 "연초 보수적 가이던스 제시 → 연중 상향 조정" 방식으로 가이던스 철학을 변경. 과거는 반기 실적 발표 시점(7월)에 상향하는 패턴.
- **관찰**: 2026년 1분기 실적에서 FY26 매출 가이던스를 €340-390억 → €360-400억(중간값 €380억, +€15억) **조기 상향**. JPM/Citi 모두 이를 "수요 강도에 대한 자신감 신호"로 해석.
- **신호 메커니즘**: 1) 오더 공시 폐지 → 투자자들이 수요 강도를 직접 관찰 불가 → 2) 가이던스 상향 자체가 대체 신호 → 3) **조기 상향 = 강한 수요 + 회사 자신감**. 반대로 연중 상향 지연 = 수요 약화 경고.
- **동종업계 파급**: TSMC도 유사 패턴(2026 매출 가이던스 "30% 근접" → "30% 초과"로 상향). WFE 장비 전반 긍정 신호 — 한 공급사의 가이던스 상향이 전체 생태계 수요 검증.
- **반영 위치**: §70 macro/fxbond, CHAT_CONTEXT fundamental, CP2 CP 카드
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.16

### HBM+HBF 3계층 메모리 패러다임 (v48.16, 2026.04.18)
- **정의**: AI 메모리 아키텍처가 기존 2계층(HBM 고속 + SSD 대용량)에서 3계층(HBM 훈련 + HBF 추론 + SSD 아카이브)으로 재편. HBF = "고대역폭 플래시", TSV 적층 16레이어 NAND 기반.
- **스펙**: 스택당 512GB, HBM 대비 **동일 비용으로 8-16배 용량**. DRAM HBM과 용량 최적 SSD 사이 중간 계층.
- **트리거**: AI 워크로드 훈련 → 추론 전환. 추론은 용량 최적화가 핵심이고, HBM은 용량 대비 비용이 높아 추론에 부적합. SanDisk가 2025.08 기술 공개, 2026.04 파일럿 일정 6개월 앞당김(26H2 파일럿, 27초 양산).
- **구조적 영향**: 
  1. NAND 공급사 재평가 — SanDisk(선점), WDC, 키옥시아 JV.
  2. HBM 전용 플레이(SK하이닉스 HBM 점유 프리미엄) 부분 잠식 리스크.
  3. TSV 적층 장비 수요(LRCX/AMAT) 추가 확장.
  4. AI 추론 디바이스 메모리 아키텍처 표준 변화 → 기존 SSD 전환만으로 대응 불가.
- **반례 주의**: HBM이 16-20레이어로 용량 확장해 HBF 범위 잠식 시나리오 존재. 표준화 지연 리스크.
- **반영 위치**: §71 fundamental/themes, SNDK SCREENER_DB, TECH_KW 'HBF'
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.16

### LTA 레버리지 역전 — 메모리 공급사 협상력 (v48.16, 2026.04.18)
- **정의**: 장기공급계약(Long-Term Agreement)이 전통적으로 "산업 사이클 정점 신호"로 해석됐으나, 2026년 메모리 LTA는 역학이 반전. 공급 부족 극심 + 고객이 선제안 = 공급사 레버리지 확보 구간.
- **과거 패턴**: LTA 논의 시작 → 사이클 정점 → 고객이 합의 파기 → 다운사이클. 투자자들이 이 패턴을 이유로 LTA에 부정적.
- **이번 전환**: 
  1. 공급 부족으로 하이퍼스케일러(고객)가 먼저 LTA 제안.
  2. 공급사들이 선불금/공동투자/최저가 보장 등 구속력 강화 조건 포함 가능.
  3. 메모리 이익 가시성 확대 → 밸류에이션 배수 재평가 논거.
- **구조적 근거**: 2026 DRAM/NAND 공급 부족 극심 + 향후 12-18개월 웨이퍼 생산능력 추가 여지 제한(클린룸 공간 부족) + 삼성전자 1Q26 OP만으로 역대 최강 2017-2018 사이클 연간 평균 상회 = ROE 구조 전환.
- **반례 주의**: 
  1. 과거 사례(아시아 투자자들의 주 우려) — 고객이 계약 파기할 가능성.
  2. 2028 신규 캐파 공급과잉 우려.
  3. 중국 DRAM/NAND 공급 위협.
- **관찰 지표**: LTA 발표 시 공급사 주가 반응(상승 = 시장이 레버리지 역전 인정), 배당/자사주 매입 규모 확대.
- **반영 위치**: §72 fundamental, SEC/HXSCL SCREENER_DB, MACRO_KW 'LTA'
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.16

### CoreWeave 프론티어 랩 독점 메커니즘 (v48.16, 2026.04.18)
- **정의**: 네오클라우드 중 CoreWeave가 프론티어 AI 연구소(OpenAI, Meta, Anthropic, Perplexity) 인프라 수요의 압도적 다수를 차지하는 구조. NVIDIA와의 긴밀 관계(공급업체+고객+투자자 3중)가 핵심 차별점.
- **계약 스택 (2026.04)**: Meta $14B(기존) + Meta $21B(신규 2032) + OpenAI $22B + Anthropic 수십억 = 합산 **$58B+**.
- **메커니즘**:
  1. NVIDIA 3중 관계 → 대용량 GPU 우선 배정 → 프론티어 랩 선호.
  2. Nebius 대비 우위 = 대규모 신용도 높은 고객 집중 가능.
  3. 가격 인상 레버리지 — 2025말 +20% 인상 보고(WSJ), 장기 1-3년 계약 요구.
  4. 비NVDA 칩(TPU/Trainium) 호스팅은 NVIDIA 관계로 인해 사실상 차단.
- **Bear Case**: 
  1. 고객 집중도(OpenAI/Meta/MSFT 중심) 리스크 — IPO 시점 주요 우려.
  2. 금리/자본 조달 비용 상승 시 마진 압박.
  3. Anthropic Trainium/TPU 병행 사용 → NVIDIA 칩 범위 축소.
- **인접 파급**: 프론티어 랩 수요 → NVIDIA Blackwell/Vera Rubin 수요 → TSMC CoWoS 캐파 → AVGO 네트워킹. Nebius는 제2티어 네오클라우드로 차별화 필요.
- **반영 위치**: CRWV SCREENER_DB, TECH_KW '네오클라우드', themes CHAT_CONTEXT
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.16

### NVDA 제외 매그7 역전 — 이익 집중도 위험 (v48.18, 2026-04-18)
- **정의**: S&P 500 Q1 2026 실적 시즌에서 "매그7"을 하나의 덩어리로 보면 22.8% 성장이지만, NVDA를 제외하면 6.4%로 **급락**해 나머지 493개사 10.1%에 **역전**. CY 2026 전체로도 NVDA 제외 시 매그7 24.8%→13.2%로 하락해 493개사 15.9%에 역전.
- **메커니즘**:
  1. NVDA 단독이 S&P 500 이익 성장의 과반을 기여 → 지수 집중도 극단화.
  2. NVDA 다음 기여도 상위: SNDK, MU, LLY, AVGO 순 → AI 반도체 메모리 + GLP-1 헬스케어 쏠림.
  3. "매그7"은 이제 단일 카테고리가 아니라 "NVDA + 나머지 6"으로 분해해서 봐야 함.
- **시장 반응 변화 (핵심 신호)**: 긍정 EPS 서프라이즈 주가 반응 **-0.2%** (5년 평균 +1.0% 대비 크게 부진). "좋은 실적은 이미 가격에 반영" 해석 → 프리미엄 부담.
- **섹터 극단화**: IT 성장률 +45.1%(반도체 +95% 주도), 금융 +19.7%, 소재 +21.6% vs 에너지 -13.1%(Exxon EPS $1.83→$1.07) 헬스케어 -10.5%(Merck Cidara 일회성). 순이익률 IT 28.9% vs 에너지 6.8%(5년 평균 9.7% 하회).
- **반례 주의**: NVDA 실적 or 가이던스 한 번 삐끗하면 지수 전체 충격 전이. 2024년 NVDA 실적 미스 시 S&P 500 -3% 선례.
- **시그널 조합**: 지수 집중도 + 긍정 서프라이즈 주가 약반응 + 밸류에이션 프리미엄(S&P 500 NTM PE 20.9배, 5년 평균 19.9배 상회) = 시클리컬 로테이션 대신 **소수 리더 재집중 국면**.
- **반영 위치**: §75 market CHAT_CONTEXT, _generateAIBriefing 매크로 블록, HOME_WEEKLY_NEWS
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.18

### AI 밸류에이션 로테이션 — 광학→HDD/EMS/DELL (v48.18, 2026-04-18)
- **정의**: JPM 1Q26 하드웨어/네트워킹 프리뷰에서 확인된 구조 — AI 관련주 밸류에이션 프리미엄 과거 평균 **+83%**(직전 +79%)까지 확대. 광학(Corning/Fabrinet)·T&M·HDD로 프리미엄 쏠림, EMS/네트워킹/IT HW 프리미엄 완화.
- **재평가 궤적**:
  1. 광학은 2027년이 아닌 **2028년 이익**을 봐야 밸류에이션 정당화 — GLW NTM PE 50배+, FN PE 59배 등 극단.
  2. HDD는 가장 압도적 긍정 — STX/WDC가 "완만한 가격 인상↑ + HAMR 전환 가속 COGS↓" 동시 진행. 밸류에이션+펀더멘털 교차 정당화.
  3. 구리 인터커넥트(APH/CRDO)는 광학 대체 우려 과도 = 구리 공존 테시스로 재평가.
- **OW→N 하향 4건 (JPM)**: GLW PT$175(광학 과열), FN PT$700+Negative Catalyst(신규 고객 가시성 제한), NTAP PT$110(NAND 계약가 C4Q25 +36%→C2Q26 +73% 전례 없음→FY27 GPM -200bps), QCOM PT$140+Negative Catalyst(ARM AGI CPU+Nvidia Groq LPX 경쟁).
- **Rank Order Top10**: ANET(AFL 1위) → APH(AFL 2위) → CLS → STX → WDC → CRDO → CSCO → JBL → FLEX → COHR. HDD/EMS/DELL 상승, 광학주 하락.
- **구조적 원인**:
  1. AI 지출 증가는 지속 → 네트워킹/스위치(ANET) 지속 수혜.
  2. 메모리 원가 상승(NAND 계약가 CQ 기준 +36%/+88%/+73%)을 사후 반영하는 스토리지(NTAP)는 구조적 마진 압박.
  3. 스마트폰/IoT 시장 부진 + ARM/Nvidia 신규 경쟁 = QCOM 리레이팅 논거 단기 약화.
- **반영 위치**: §74 fundamental CHAT_CONTEXT, 관련 SCREENER_DB 10개 티커 메모
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.18

### DC 규제 전환 + 온사이트 발전 (v48.18, 2026-04-18)
- **정의**: 2026년 4월 Maine 주가 미국 최초 주 단위 대형 DC 금지 법안 통과(2027 가을까지 20MW+ 신규 DC 건설 중단). 최소 12개 주 유사 모라토리엄 검토 → DC 입지 제약 구조적 전환.
- **수요 재편 3요소**:
  1. **지역 집중**: Maine 금지 → Virginia/Ohio/Texas 쏠림 가속 → 전력망 부하 집중.
  2. **온사이트 발전 신수요**: Wartsila 34SG 엔진 412MW 오하이오 DC 공급(선박 엔진 DC 전력 첫 사례, 리드타임 2년). GEV/BE/CEG + Wartsila 수혜.
  3. **프로젝트 손실**: 지난해 반발로 무산된 DC 프로젝트 총 **$1,520억** = 매우 큰 억제된 투자 규모.
- **원인 구조**: 1개 DC = 인구 50만 도시 전력 소비 = 전력·수자원·농지 소비 우려 결집 + 미국 내 초당파적 문제화(재닛 밀스 메인 주지사 서명 대기).
- **인접 파급**:
  1. 하이퍼스케일러 Capex 속도 조절 리스크(2027-2028 DC 성장 둔화 가능).
  2. 전력 인프라주(GEV/VST/CEG/BE) 구조적 수혜.
  3. DC 디벨로퍼 중 온사이트 발전 가능한 사업자 우위.
  4. 반대로 AI Capex 사이클 강세가 전력 인프라 병목에 의해 제약되는 "time-to-power" 테시스 재부각.
- **반영 위치**: §76 macro/energy CHAT_CONTEXT, MACRO_KW 'DC moratorium'/'Wartsila', renderEconCalendar
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.18
