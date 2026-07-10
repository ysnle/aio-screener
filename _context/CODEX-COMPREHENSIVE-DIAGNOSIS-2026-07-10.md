# AIO Screener 종합 진단 및 인수인계 — 2026-07-10

```yaml
audit_date: 2026-07-10 KST
auditor: Codex
purpose: 읽기 전용 전수 진단과 후속 에이전트용 작업 명세
local_target: v52.43 / 40a922b / main / origin/main 대비 1 commit ahead
live_target: https://ysnle.github.io/aio-screener/ / v52.43
verification:
  - repository static inspection
  - local executable gates
  - Chrome live-site inspection
  - GitHub repository, Pages and Actions read-only inspection
change_scope: 이 문서, _context/INDEX.md, _context/CLAUDE.md만
excluded: 애플리케이션 코드 수정, 설정 수정, 커밋, 푸시, 배포
```

## 0. 결론

AIO Screener는 **개인 개발형 투자 터미널 또는 내부 베타로는 상위권**, 일반 사용자가 실제 돈을 맡기는 공개 프로덕션으로는 **조건부**, 기관급 리서치·트레이딩 시스템으로는 **아직 미달**이다.

종합 성숙도는 **6.6/10**으로 판단한다. 이 숫자는 기능 수가 아니라 제품 범위, 구조, 데이터, 알고리즘 근거, 보안, QA, 운영 통제를 함께 본 상대 평가다.

- 제품 외형·기능 밀도: 8/10대
- 문서·작업 규율: 7/10대
- 런타임·데이터 운영: 6/10대
- 소프트웨어 구조·변경 안전성: 5~6/10대
- 투자 알고리즘 실증·재현성: 4~5/10대
- 보안·비용 통제의 프로덕션 준비도: 4~5/10대

가장 정확한 표현은 **보이는 제품은 성숙하지만 신뢰 경계와 실증 계층은 연구 프로토타입 성격이 남아 있다**는 것이다. 기능 부족이 주된 병목은 아니다.

1. 투자 판단 문구의 강도에 비해 표본 밖 검증과 시점 정합 데이터가 부족하다.
2. 단일 페이지 전역 상태와 대형 파일이 변경 영향 범위를 넓힌다.
3. 정적·시드 기반 QA는 강하지만 실제 초기화·외부 장애·브라우저 콘솔을 실패 조건으로 충분히 닫지 못한다.
4. 암호화 표기, 공유 LLM 프록시, 비보호 main, 자동 WIP 커밋 등 일부 신뢰 경계가 공개 서비스 수준에 미달한다.

### 0.1 영역별 판정

| 영역 | 점수 | 판정 | 핵심 근거 |
|---|---:|---|---|
| 제품 범위 | 8.5 | 강함 | 시세, 시그널, 브레드쓰, 매크로, 섹터/RRG, 포트폴리오, 채팅을 단일 경험으로 결합 |
| UI/정보 설계 | 7.5 | 양호 | 한국어 다크 터미널, 22개 경로, 반응형 무오버플로; 작은 글자와 고밀도 정보 부채 |
| 시스템 구조 | 5.9 | 전환기 | 모듈 분리는 시작됐지만 약 8.7만 LOC 런타임, 전역 결합, 대형 파일, DOM 직접 조작 |
| 데이터 운영 | 7.1 | 양호·취약점 있음 | 77/77 시세와 다수 데이터셋 자동 갱신; 출처·시점 혼합과 현재 watchdog 파손 |
| 알고리즘 설계 | 5.7 | 연구형 | 다중 요인·레짐·정규화는 좋으나 수작업 가중치와 약한 검증, 라이브/백테스트 불일치 |
| QA/테스트 | 7.2 | 정적 강함 | 948 headless, 88 viewport, 9개 정적 게이트 통과; 실제 full-init와 오류 실패 조건 부족 |
| 보안/프라이버시 | 4.9 | 보강 필요 | 비밀값 커밋은 없고 Vault는 존재; 포트폴리오 평문 저장과 공유 프록시 비용 경계 |
| CI/CD·운영 | 5.8 | 자동화됨·통제 약함 | Pages/Actions 자동화는 광범위; main 비보호, 높은 실패율, 무효 watchdog YAML |
| 문서/거버넌스 | 8.0 | 강함·비대함 | 규칙·사후분석·QA·코드맵 체계 우수; 문서 비대와 현재 상태 드리프트 |
| 실증 신뢰도 | 4.5 | 미달 | 거래비용·턴오버·PIT·OOS·표본 크기·캘리브레이션 근거 부족 |

점수는 절대 인증이 아니다. 후속 작업의 우선순위를 비교하기 위한 감사자 판단이며 아래 직접 증거가 우선한다.

---

## 1. 감사 범위와 검증 상태

### 1.1 직접 검증한 범위

- 저장소 현재 상태, git 이력, 파일 크기·라인 수·전역/DOM 패턴
- `_context/` 거버넌스, 최근 감사·사후분석·보류·증거부채 문서
- `index.html`, `js/` 런타임 모듈, 서비스 워커, Cloudflare Worker, 데이터 수집 스크립트
- GitHub Pages 설정, 브랜치 보호 여부, 워크플로 목록과 최근 100개 실행
- 로컬 정적 게이트, headless 회귀, viewport matrix, live invariant
- 운영 JSON의 현재 완전성·신선도와 백테스트 산출물
- 실제 Chrome에서 홈, 시그널, 브레드쓰, 매크로 화면과 콘솔 경고

### 1.2 부분 검증 또는 미검증

- 22개 경로 중 실제 시각·상호작용 확인은 4개 경로만 완료했다.
- 로그인 세션, 실제 개인 API 키, 사용자 포트폴리오 데이터는 열람하지 않았다.
- Anthropic 실키 호출, Cloudflare KV 바인딩·원자성, 모든 지역 POP 동작은 검증하지 않았다.
- iOS Safari, Firefox, Android 실기기, 키보드 전 경로, 스크린리더는 실행하지 않았다.
- 투자 성과는 저장된 산출물과 코드 계약을 진단했으며 독립 데이터로 재현 백테스트하지 않았다.
- GitHub 설정 중 조직 정책·외부 비밀관리 설정은 저장소 권한으로 보이는 범위만 확인했다.

이 문서에서 `확인`은 재현 가능한 코드·실행·UI 증거가 있는 항목, `추정`은 그 증거에서 합리적으로 도출한 판단을 뜻한다.

---

## 2. 현재 기준선

### 2.1 저장소·배포

- 로컬: `main`, `40a922b`, `v52.43`, 감사 시작 시 clean
- 원격: `origin/main` `9353df7`; 로컬은 문서 전용 WIP 커밋 1개 ahead
- Pages: `main` 루트, workflow build, HTTPS 적용
- 라이브 title과 `version.json`: 모두 `v52.43`
- main 브랜치 보호: 없음. GitHub API가 `Branch not protected`로 응답

### 2.2 런타임 크기

| 파일 | 바이트 | 라인 |
|---|---:|---:|
| `index.html` | 2,338,889 | 32,150 |
| `js/aio-core.js` | 1,461,623 | 24,392 |
| `js/aio-data.js` | 1,194,328 | 17,890 |
| `js/aio-ui.js` | 351,627 | 5,728 |
| `js/aio-chat.js` | 529,458 | 6,911 |
| `js/aio-tests.js` | 560,077 | 7,608 |
| `js/aio-glossary.js` | 57,618 | 314 |
| `sw.js` | 9,320 | 233 |
| `cloudflare-worker-proxy.js` | 15,948 | 359 |
| `scripts/fetch-data.mjs` | 78,428 | 1,360 |

테스트를 제외한 주요 런타임은 약 **87,385 LOC, 5.93 MB 원문**이다. 단일 HTML이라는 제품 설명은 배포 단위 관점에서는 맞지만 실제 시스템은 HTML과 6개 대형 JS 모듈, 데이터 산출물, 서비스 워커, Worker, Actions가 결합된 다층 시스템이다.

### 2.3 결합도 대리 지표

- `window.` 참조: 주요 런타임 약 3,458건
- `innerHTML`: 약 420건
- CSS `!important`: 626건; 직전 감사 기준 512건에서 증가
- timer 관련 호출: 약 235건
- `addEventListener`: 113건, `removeEventListener`: 15건

이 수치만으로 버그를 단정할 수는 없다. 다만 전역 공유 상태, 문자열 기반 렌더링, 스타일 우선순위 경쟁, 타이머 수명주기 누락 가능성이 변경 위험을 키운다는 강한 구조 신호다.

### 2.4 이력과 변경 속도

- 전체 커밋: 746개
- 작성자 분포: data bot 289, session bot 233, 사람 계정 합계 227
- 최근 30일: 488개; data bot 288, session bot 195, 사람 5
- 최근 30일 `version.json` 140회, `index.html` 146회, `aio-core.js` 139회 변경
- git loose objects: 2,134개, 약 154 MB; pack 약 12.6 MB

자동화 밀도는 높지만 커밋과 버전 단위가 의미 있는 변경 단위보다 지나치게 촘촘하다. 리뷰 가능한 원자성, 원인 추적, release signal-to-noise를 약화시킨다.

---

## 3. 우선순위 발견사항

### P0-1. 현재 `data-watchdog.yml`은 YAML로 파싱되지 않는다 — 확인

`.github/workflows/data-watchdog.yml`에 U+0080 C1 제어문자 5개가 들어 있다. PyYAML은 약 3,858번째 위치에서 `unacceptable character #x0080`으로 실패하며, GitHub run `29059996134`는 job 생성 전 즉시 실패하고 `workflow file issue`를 반환했다.

- 위치: 86행 2개, 93행 1개, 95행 2개
- 유입: `40dbef8` WIP auto-save에서 한국어 문자열 mojibake
- 후속 `1e4781c`가 R290 단계를 추가했지만 제어문자를 제거하지 않음
- 영향: 시간당 저장소/라이브 신선도 감시와 R290 live invariant가 실행되지 않음
- 현재 데이터가 신선한 이유: 별도 refresh/deploy 워크플로가 성공하고 있기 때문이지 watchdog이 정상이라서가 아님
- 구조적 원인: CI에 YAML parse/control-character/actionlint 게이트가 없음

이것은 기능 코드 오류가 아니라 **감시기가 죽었는데 감시기의 죽음을 잡는 상위 게이트가 없는 상태**다.

### P0-2. 포트폴리오 “AES-256 암호화” 표기와 실제 저장 방식이 다르다 — 확인

UI는 “PIN 설정 후 저장 시 AES-256 암호화”라고 안내하지만, 실제 포트폴리오는 `aio_portfolio_data`에 JSON 평문으로 저장된다. PIN도 `aio_portfolio_pin`에 평문 저장 후 문자열 직접 비교한다.

- `_AioVault`의 AES-GCM/PBKDF2 구현은 존재한다.
- 그러나 Vault는 API 민감 키 경로에 연결되어 있고 포트폴리오 저장 경로에는 연결되지 않는다.
- 브라우저 로컬 접근, 동기화/백업, 악성 확장, XSS 상황에서 기대 보호 수준과 실제 보호 수준이 다르다.

보안 결함뿐 아니라 **사용자에게 표시한 보안 계약의 위반**이므로 최우선이다.

### P0-3. 공유 Anthropic Worker 경로는 비용 악용 경계가 부족하다 — 확인

`/anthropic` 분기는 일반 프록시의 bot-UA 검사, IP rate limit, URL allowlist보다 먼저 처리된다. `handleAnthropic`에는 신뢰할 수 있는 호출자 인증이나 강제 origin 검증이 없고, CORS는 서버·curl 호출을 막는 인증 수단이 아니다.

- 선택적 KV 일일 제한이 없으면 사실상 무제한
- KV get/put 방식은 동시성에서 원자적 한도가 아님
- 요청 본문·입력 토큰 상한이 명확하지 않음; 출력은 1,500 토큰 제한
- 공유 서버 키가 비용 경계를 부담
- HKG anycast에서 Anthropic 403/B8 간헐 이력 존재
- 파일 상단 설명은 Claude를 Worker로 우회하지 않는다고 쓰지만 실제 라우트는 존재해 문서가 드리프트함

비밀키가 저장소에 노출된 것은 확인되지 않았다. 문제는 **키 유출이 아니라 공개 비용 프록시의 권한 모델**이다.

### P1-1. 거래 점수는 설명 가능한 휴리스틱이지만 투자 성과 근거가 약하다 — 확인

`computeTradingScore`는 변동성 25, Fear & Greed를 momentum 명칭으로 25, 추세 20, breadth 20, macro 10을 중심으로 PCR, AAII, cross-risk, divergence, HY, oil, news 보정을 합산한다.

장점:

- 각 입력과 보정 논리를 코드로 추적할 수 있다.
- 데이터 누락 시 중립 fallback과 evidence 상태를 보유한다.
- 시장 상태, 교차자산, 심리, 브레드쓰를 한 화면에 결합한다.

한계:

- 가중치와 임계값이 수작업이며 학습·보정 근거가 없다.
- 상관 높은 위험·심리 입력이 중복 반영될 수 있다.
- `evidenceStatus`가 있어도 최종 행동 문구의 강도를 항상 제한하지 않는다.
- 중립 fallback은 장애 때 점수 변동을 줄이지만 “데이터 없음”을 “중립 시장”으로 오인하게 만들 수 있다.
- 일부 `||` fallback은 유효한 0을 누락으로 취급할 가능성이 있다.
- 정밀한 수치와 “매수/보류” 문구가 검증 수준보다 높은 확실성을 전달한다.

저장된 score backtest는 5일 표본 25개에서 상관 -0.542, 21일 표본 9개에서 -0.667이며 `statisticallyMeaningful: false`다. 여러 레코드에서 200MA trend가 false이고 breadth/PCR/AAII/HYG가 중립 fallback이며 news가 빠져 있다. 현재 결과로는 투자 유효성을 주장할 수 없다.

### P1-2. Factor Engine의 구현 품질과 검증 품질 사이에 간극이 있다 — 확인

구현에는 섹터 내 z-score, winsorize, 소표본 blend, 존재 factor 재정규화, adaptive weight, adjusted close, Wilder RSI, Kalman/VCP parity가 포함된다. 이는 단순 순위표를 넘어선 좋은 연구형 설계다.

하지만 라이브는 7 factor·레짐·사용자 프로필을 쓰는 반면 현재 백테스트는 가격 파생 4 factor의 중립 부분집합이다. 최신 산출물은 7일 기록이며 각 기록의 rebalance date가 6개뿐이다.

- 최신 composite IC: 0.060
- momentum IC: 0.102
- trend IC: 0.064
- low-vol IC: -0.058
- Kalman IC: -0.026
- quantile spread: 2.21
- hit rate: 83.3%, 사실상 6개 중 5개 규모

point-in-time 펀더멘털/주식수, 생존편향 통제, 거래비용, turnover, capacity, walk-forward/OOS, regime별 신뢰구간이 없어 기관급 검증으로 볼 수 없다.

### P1-3. 테스트 수는 많지만 실제 런타임 실패를 놓칠 수 있다 — 확인

통과한 게이트:

- JS·스크립트 syntax check
- 정적 CI 9종 전부 PASS
- headless tests 948/948 PASS
- viewport matrix 22경로 × 4 viewport = 88/88 PASS, overflow 0px
- direct live invariant PASS, live/local 버전 v52.43

그러나 다음 제한이 있다.

- headless suite는 외부 네트워크를 모두 abort하여 seed/fallback 중심이다.
- page error와 `console.error`를 수집하지만 테스트 실패로 만들지 않는다.
- viewport suite 기본값은 `FULL_INIT=false`; `showPage`와 데이터 fetch, 이벤트, 차트 초기화 없이 `.active` 클래스만 바꾼다.
- 7/8/9px 작은 글자 관찰 228건은 기록만 하고 실패하지 않는다. SVG만 10px 미만을 실패 처리한다.
- screenshot은 opt-in이고 CI viewport job은 report-only 성격이다.

따라서 “948개 통과”는 강한 회귀 자산이지만 “라이브가 정상”과 동의어가 아니다.

### P1-4. 실제 라이브는 동작하지만 경고 누적과 캐시 불일치가 있다 — 확인

Chrome에서 홈, 시그널, 브레드쓰, 매크로를 실제 확인했다. 화면은 렌더링됐고 console error는 없었으나 경고가 27건 수집됐다.

주요 그룹:

- `DATA_SNAPSHOT` 초기화 전 접근
- R74 불일치 6건이 2회 보고
- AutoOps: freshness 52, repair candidate 21, expired 6, geo overdue 5, hallucination field 7, hard-stale disabled
- CBOE PCR 실패 4회
- HY proxy 전부 실패 및 fetch 실패
- 번역 JSON parse 실패 3회
- 수동 필드 지연: Fed 23일, BOJ 24일, BOK 43일, BOE 71일, PBOC 59일, 한국채권 56일, 한국매크로 71일, 미국 수동 70일, breadth 14일
- 서비스 워커 `v52.34`와 앱 `v52.43` 불일치
- 일부 공개 CORS proxy cooldown

라이브 데이터 자체는 감사 시점에 다음 상태였다.

- `generatedAt`: 2026-07-10T01:16:05Z, 검사 시 약 77분 경과
- symbols 77/77
- Fear & Greed 있음
- FRED 19개 키
- news 40개
- marketAnalysis OK
- Telegram 419개 / 3채널, 약 76분 경과
- screener 851/870

즉 **전체 장애는 아니지만 fallback·수동 데이터·캐시 계층의 경고가 정상 운영 신호에 섞여 있다.**

### P1-5. 변경 통제는 자동화됐지만 보호되지 않았다 — 확인

- main 브랜치 보호 없음
- 최근 CI 38회 중 23 success, 15 failure
- 실패 원인은 T173/T174 stale token, T686 VIX mirror drift 등 실제 계약 위반이 다수
- data watchdog 최근 29회 중 25 success, 4 failure이며 현재 파일은 아예 파싱 불가
- refresh 최근 33회는 33 success
- `.codex/hooks.json`은 과거 OneDrive 경로를 참조
- `.codex/hooks/check-version-sync.sh`는 `APP_VERSION`이 이동한 현재 구조를 반영하지 않고, `v52.43`을 `v52.4`처럼 한 자리 patch로 캡처하는 정규식과 4개 위치 검사만 보유
- auto-commit hook은 `git add -A` 후 WIP 커밋을 만들도록 설계돼 관련 없는 변경의 혼입 위험이 큼
- `.claude`와 `.codex` hook hash가 달라 계약이 분기됨

최근 WIP 커밋이 실제 생성되므로 어떤 외부 hook 경로는 동작한다. 다만 저장소 안 Codex hook 계약은 현재 구조와 맞지 않으며 실행 주체별 정합성이 검증되지 않았다.

### P2-1. 문서 거버넌스는 강하지만 문서 자체가 운영 부채가 됐다 — 확인

| 문서 | 크기 | 라인 |
|---|---:|---:|
| `CHANGELOG.md` | 약 1.48 MB | 15,654 |
| `BUG-POSTMORTEM.md` | 약 955 KB | 5,784 |
| `_context/RULES.md` | 약 295 KB | 3,213 |
| `QA-CHECKLIST.md` | 약 194 KB | 2,649 |

사후분석, 규칙 승격, 코드맵, 작업 게이트는 이 프로젝트의 강점이다. 반면 주요 파일이 너무 커져 읽기 비용이 높고 `INDEX`, `CODE-MAP`, `WORKTREE-AUDIT` 일부 표현은 현재 모듈·워크플로 상태와 드리프트한다. `ci-workflow-compaction`도 위 대형 기록 파일을 예외 처리한다.

### P2-2. 대형 모듈 분리만으로 계층 분리가 완성되지는 않았다 — 확인

HTML에서 JS 파일을 뽑아낸 것은 배포와 편집 충돌을 개선했다. 그러나 `window.*` 전역 계약, 직접 DOM 갱신, storage key, 타이머, 데이터 fallback, 화면 라우팅이 여러 모듈에 걸쳐 교차한다. 물리 파일은 분리됐지만 논리 의존성 역전, 이벤트 경계, 타입/스키마 경계는 약하다.

전면 재작성은 권고하지 않는다. 위험이 큰 이유는 현재 테스트와 규칙이 기존 전역 계약에 강하게 묶여 있기 때문이다. 후속 개선은 경계 측정과 strangler 방식의 점진 격리가 맞다.

---

## 4. 시스템·구조·아키텍처 진단

### 4.1 실제 레이어 맵

| 레이어 | 주요 구성 | 장점 | 핵심 부채 |
|---|---|---|---|
| Delivery | GitHub Pages, `index.html`, CDN, version/cachebuster | 단순하고 저비용, 정적 배포 복구 쉬움 | CSP 적용 곤란, 2.3MB HTML, main 직접 배포 위험 |
| Offline/cache | `sw.js`, 브라우저 캐시 | 오프라인·재방문 경험 | 앱/SW 버전 드리프트, 다중 캐시 정합성 |
| Presentation | 인라인 CSS, `aio-ui.js`, Chart.js, 22 routes | 고밀도 터미널, 반응형 범위 넓음 | 626 `!important`, 작은 글자, 직접 DOM/innerHTML |
| Application/orchestration | `aio-core.js`, 전역 init, timers, page lifecycle | 기능 결합 속도 빠름 | 전역 상태, 생명주기·취소·중복 fetch 경계 약함 |
| Domain/data | `aio-data.js`, 시장상태, score, factor, snapshot | 시장 도메인 지식 풍부 | 데이터·알고리즘·UI 계약 혼재, fallback 의미 불명확 |
| Chat/LLM | `aio-chat.js`, provider routing, contexts | 터미널과 분석 대화 통합 | 모델 출력 근거·비용·프록시 신뢰 경계 |
| Persistence/security | localStorage, IndexedDB backup, `_AioVault` | 클라이언트 단독 저장과 선택형 Vault | portfolio/PIN 평문, 보호 수준이 기능별로 다름 |
| Edge integration | `cloudflare-worker-proxy.js` | CORS/SSRF 완화, domain allowlist | Anthropic 예외 경로, 선택형 quota, 단일 Worker 책임 과다 |
| Data pipeline | `fetch-data.mjs`, scheduled Actions, JSON artifacts | 서버 없는 자동 갱신, 재현 가능한 산출물 | source provenance 혼합, manual/seed/live 구분 부담 |
| Quality/governance | scripts, `_context/`, skills, postmortems | 광범위한 계약 회귀와 지식 환류 | 문서 비대, 현실 드리프트, 브라우저 full-init 공백 |

### 4.2 구조적으로 잘된 점

- 정적 호스팅 제약 안에서 서버 비용을 최소화하면서 기능 범위를 크게 확장했다.
- adjusted price, factor normalization, evidence/freshness, proxy allowlist 등 중요한 개념이 코드에 실제 존재한다.
- 규칙, 사후분석, QA, 코드맵, 작업 게이트가 단발성 메모가 아니라 운영 체계를 형성한다.
- 948개 headless와 88개 viewport 검사는 단일 개발 프로젝트 기준으로 강한 회귀 자산이다.
- 데이터가 없을 때 완전히 무너지는 대신 fallback과 상태 표기를 시도한다.
- CDN SRI 3건, DOMPurify, Worker 도메인 allowlist/SSRF 방어, 저장소 비밀값 부재는 긍정적이다.

### 4.3 구조적으로 취약한 점

- `aio-core.js` 2.4만 라인과 `aio-data.js` 1.8만 라인은 이름보다 훨씬 많은 책임을 갖는다.
- 약 3,458개의 전역 참조는 숨은 읽기/쓰기 의존성을 만든다.
- 약 420개의 `innerHTML`은 DOMPurify가 있어도 XSS 검토 표면을 크게 만든다.
- 인라인 스크립트/스타일 중심 구조는 엄격한 CSP 도입을 어렵게 한다.
- fetch, timer, event listener, page activation의 소유권이 컴포넌트 단위로 닫혀 있지 않다.
- runtime, test, snapshot, manual source가 동일 전역 이름을 공유해 “값이 있음”과 “값이 신뢰 가능함”을 구분하기 어렵다.
- 버전, SW, cachebuster, 문서의 동기화가 스크립트 규칙에 의존하지만 hook 자체가 드리프트했다.

### 4.4 후속 구조 작업의 원칙

이 감사에서는 구조를 바꾸지 않는다. 후속 에이전트가 지켜야 할 방향은 다음뿐이다.

1. 전면 프레임워크 전환이나 전체 재작성 금지
2. 전역 read/write 계약부터 목록화하고 한 경계씩 adapter로 감싸기
3. market snapshot을 provenance·asOf·quality를 포함한 불변 입력으로 만들기
4. 계산 함수는 DOM/storage/fetch에서 분리하고 순수 입력·출력 계약으로 테스트하기
5. 페이지 활성화와 timer/fetch/listener cleanup의 소유권을 명시하기
6. 보안 계약과 사용자 표시 문구를 동일 테스트로 묶기

---

## 5. 알고리즘 전문 진단

### 5.1 시장 상태 엔진

`marketState`를 공통 두뇌로 두려는 방향은 맞다. 동일 데이터를 여러 화면에서 다시 해석하는 문제를 줄이고 레짐·리스크·신뢰도를 공유할 수 있다.

현재 한계:

- VIX/Fear & Greed 임계값을 closure 접근 문제 때문에 일부 함수가 복제한다.
- live quote, server snapshot, manual field가 하나의 상태에 섞일 수 있다.
- 최신성, 관측 시점, 발표 시점, 시장 시점이 하나의 `date`처럼 보일 수 있다.
- missing과 neutral의 의미가 일부 경로에서 합쳐진다.

필수 검증 질문:

- 같은 입력 snapshot이면 모든 화면이 같은 regime을 내는가?
- 하나의 source가 stale일 때 regime과 confidence가 함께 약화되는가?
- 미래 발표값이나 수정값이 과거 backtest에 들어가지 않는가?

### 5.2 Trading Score와 행동 문구

현 수준은 **설명 가능한 전문가 규칙 기반 합성 지표**다. ML 모델이나 통계적으로 보정된 확률 모델은 아니다.

- 위험 온도계·대시보드 요약으로는 유용
- 단독 매매 엔진 또는 수익률 예측 점수로는 근거 부족
- “신규 진입 보류” 같은 정책 라벨은 가능하지만 confidence 84%처럼 확률로 읽히는 표현은 별도 calibration 필요

후속 검증은 단순 수익률 상관 하나가 아니라 다음을 포함해야 한다.

- 점수 구간별 1/5/21/63일 forward return과 최대낙폭
- bull/bear/sideways, 고·저변동성 regime별 분해
- naive baseline, 200MA, buy-and-hold 대비 증분 가치
- 각 factor 제거 ablation과 중복 상관
- missing/fallback 비율별 결과
- rolling walk-forward와 embargo를 둔 OOS
- 행동 라벨별 빈도, hit rate, calibration, 비용 반영

### 5.3 종목 Factor Model

구현은 research prototype으로는 좋다. 문제는 계산 자체보다 데이터 계보와 검증 범위다.

기관급으로 가기 위한 미충족 조건:

- point-in-time universe와 delisted 종목 포함
- PIT fundamental과 corporate action 정합성
- turnover, spread, slippage, tax, capacity
- sector/size/vol exposure 중립화와 잔여 노출 리포트
- IC 평균뿐 아니라 ICIR, t-stat, decay, monotonicity, subperiod 안정성
- hyperparameter 선택 구간과 평가 구간 분리
- live 7-factor와 backtest factor의 완전 parity
- 사용자 프로필/레짐 adaptive weight의 별도 OOS 검증

### 5.4 RRG·브레드쓰·매크로·심리

표면 기능과 데이터 표시는 확인했으나 모든 산식의 독립 재현은 이번 감사 범위 밖이다.

- RRG: 상대강도와 모멘텀 사분면은 탐색 도구로 유용하나 벤치마크, lookback, smoothing, rebalancing sensitivity를 명시해야 한다.
- 브레드쓰: 시장 내부 확산을 보여주는 장점이 있으나 snapshot 날짜와 개별 필드 `asOf`가 다를 때 대표 날짜가 오해를 만들 수 있다.
- 매크로: FRED 자동 데이터는 강점이나 중앙은행·한국·수동 필드가 수십 일 stale인 상태를 동일 카드에서 소비한다.
- Fear & Greed/PCR/AAII: 심리 확인용으로는 유용하지만 서로 상관된 risk-on/off 신호의 중복 가산을 검증해야 한다.
- 뉴스/LLM: 정성 맥락 보강에는 유용하나 산출물 재현성과 hallucination control을 수익 신호와 분리해야 한다.

---

## 6. 인프라·운영·보안 진단

### 6.1 GitHub Actions 최근 상태

최근 100개 실행 집계:

| Workflow | 실행 | 성공 | 실패 | 중앙 실행시간 |
|---|---:|---:|---:|---:|
| Refresh Market Data | 33 | 33 | 0 | 0.47분 |
| CI | 38 | 23 | 15 | 6.18분 |
| Data Watchdog | 29 | 25 | 4 | 0.15분 |

CI 실패는 단순 flaky로 치부할 수 없다. 확인한 실패에는 stale token과 VIX mirror drift라는 실제 계약 위반이 있었다. 다만 실패율이 높으면 경고 피로로 이어지므로 원인별 분류와 복구시간을 운영 지표로 관리해야 한다.

### 6.2 데이터 파이프라인

강점:

- 정적 사이트에 필요한 시장 데이터를 scheduled Actions가 JSON으로 생성한다.
- symbols, FRED, news, Telegram, screener를 별도 산출물로 확인할 수 있다.
- live invariant와 mirror consistency 같은 계약을 자동화했다.

한계:

- live, delayed, manual, seed, fallback의 provenance가 UI·알고리즘·테스트에서 일관된 타입으로 강제되지 않는다.
- 수동 필드가 오래돼도 전체 snapshot의 최신 timestamp가 신선해 보일 수 있다.
- watchdog 파일 자체가 파손돼 메타 모니터링이 중단됐다.
- 무료 프록시와 공개 source 장애가 콘솔 정상 상태에 반복 노출된다.

### 6.3 보안

확인한 긍정 요소:

- 저장소에서 실제 API key/token 패턴 미검출; placeholder만 존재
- CDN 3개에 SRI
- DOMPurify 사용
- Worker URL allowlist와 SSRF 방어
- WebCrypto 기반 AES-GCM/PBKDF2 Vault 구현

남은 위험:

- 포트폴리오/PIN 평문과 UI 암호화 표기 불일치
- API key 보호가 사용자가 Vault를 명시적으로 해제해야만 적용되는 선택형 계약
- IndexedDB backup과 localStorage 간 민감정보 복제 경계
- 공유 Anthropic Worker의 인증·원자 quota·body limit 부재
- 엄격 CSP 부재와 420개 `innerHTML`의 넓은 검토 표면
- main 비보호와 WIP auto-commit의 공급망/변경 통제 위험

---

## 7. 후속 에이전트 작업 패킷

아래는 구현이 아니라 **독립적으로 인수 가능한 작업 명세**다. 각 패킷은 한 PR 또는 한 명확한 변경 단위로 처리하고 AIO의 버전·사후분석·QA 규칙을 따라야 한다.

### WO-0 — Watchdog 워크플로 복구와 워크플로 자체 검증

> **상태(2026-07-10, Sonnet 5 세션, v52.45/P660/R293): 구현 완료.** `data-watchdog.yml` U+0080 5개는 원인 커밋(`40dbef8`) diff에서 손상 직전 원문을 확보해 완전 복구(추측 아님), curl/`gh run view`로 실제 파싱 실패·라이브 run 실패를 직접 재현 확인. `scripts/ci-control-char-check.mjs` 신설 — 워크플로 YAML은 제어문자 0건+`js-yaml` 파싱 PASS 하드 게이트(예외 없음), `ci.yml`에 배선 완료. 부가로 저장소 전체 스캔을 실제 수행한 결과 `CHANGELOG.md`(6,386)·`BUG-POSTMORTEM.md`(3,208)·`eval-guide.md`(44) — 이 문서가 다루지 않은 훨씬 큰 규모의 기존 mojibake를 발견해 78%(7,486건)를 git 히스토리 대조로 복구, 나머지 2,153건은 baseline 파일로 회귀만 차단(완전 제거는 원본 부재로 불가능 — `_context/KNOWLEDGE-BASE.md` TM-VII 참조). "watchdog 수동 실행 후 job PASS" 게이트는 로컬에서 YAML parse+gate 통과까지 확인했고, 실제 GitHub 라이브 재실행 확인은 커밋/푸시 이후로 남음(사용자 배포 지시 대기). 상세: `_context/BUG-POSTMORTEM.md` P660.
>
> 실행 순서표(§8)와 달리 WO-1A/1B/WO-5보다 먼저 사용자에게 "이 발견을 어디까지 복구할지" 확인하는 판단 지점이 하나 더 생겼다(§9 체크리스트의 "수정 전 실패 테스트" 원칙과 같은 정신 — 예상보다 큰 발견 시 사용자 확인 후 진행).

우선순위: P0 / 즉시

입력:

- `.github/workflows/data-watchdog.yml`
- `.github/workflows/ci.yml`
- `scripts/ci-live-invariant-check.mjs`

작업 범위:

- C1 제어문자와 mojibake 제거
- 모든 workflow YAML parser 검증
- actionlint 또는 동등한 workflow schema 검사
- 저장소 전체 금지 제어문자 게이트
- watchdog 수동 실행 후 job과 R290 결과 확인

완료 게이트:

- 4개 workflow YAML parse PASS
- 제어문자 스캔 0건
- GitHub Data Watchdog run이 job 생성 후 PASS
- R290가 실제 live 버전과 일치
- 관련 postmortem, QA, RULES, 버전 계약 반영

### WO-1A — 포트폴리오 보안 계약 일치

> **상태(2026-07-10, Sonnet 5 세션, v52.46/P661/R294): 구현 완료.** 사용자에게 두 선택지(실제 암호화 vs UI 문구 정직화)를 제시해 "실제 암호화"로 확정. 기존 API 키용 `_AioVault`(AES-GCM-256+PBKDF2, 이미 구현돼 있었음)에 포트폴리오를 편입 — 신규 암호화 로직 작성 없이 `_AIO_SENSITIVE_KEYS`+`safeLS`+`_migrateToEncrypted` 기존 계약을 재사용. 동기 호출부 수십 곳을 async로 바꾸지 않기 위해 API 키가 이미 쓰는 `_keyRuntime` 동기 캐시 패턴을 그대로 재사용했다. **부수 발견**: 이 문서가 지목한 "PIN도 평문 비교"보다 한 단계 더 근본적인 버그가 있었다 — 잠금화면을 띄우는 게이트 `checkPortfolioPin()`이 리포 전체에서 호출부가 0건인 고아 함수였다(PIN을 설정한 사용자도 페이지 진입 시 잠금화면을 본 적이 없음). `renderPortfolio()` 자체를 게이트로 재설계해 해결. Playwright로 실제 페이지를 구동해 완료 게이트가 요구한 4개 항목(평문 없음/PIN 직접비교 없음/오PIN·마이그레이션·backup 테스트/암호화 주장과 런타임 저장값 동시 검사) 전부를 7개 시나리오·17개 어서션으로 실측 확인(17/17 PASS). 상세: `_context/BUG-POSTMORTEM.md` P661.

우선순위: P0

작업 범위 선택지는 둘 중 하나다.

1. 포트폴리오와 PIN verifier를 실제 authenticated encryption/KDF 계약으로 이전
2. 암호화를 제공하지 않을 경우 UI 문구를 정확히 낮추고 PIN의 보호 한계를 명시

완료 게이트:

- storage에 포트폴리오 JSON 평문이 없음 또는 UI가 평문임을 정직하게 명시
- PIN 원문 직접 저장·비교 없음
- 잘못된 PIN, migration, legacy data, backup/restore, XSS 경계 테스트
- 암호화 주장과 런타임 저장값을 함께 검사하는 자동 테스트

### WO-1B — Anthropic 프록시 권한·비용 경계

> **상태(2026-07-10, Sonnet 5 세션, v52.47/P662/R295): 구현 완료.** 사용자에게 2건 확인 — 보호 수준("계층형 경량 강화" 선택, 정적 사이트+무료 Workers 구조상 진짜 인증 불가라는 이 문서의 한계 인정을 전제로) + KV 미바인딩 정책("Fail-closed" 선택). 구현: kill switch·서버측 Origin 강제(기존엔 CORS 헤더만 발급하고 요청 자체는 거부 안 했음)·선택적 앱 토큰(`AIO_APP_TOKEN`, 미설정 시 하위호환)·`/anthropic` 전용 레이트리밋(20/분, 데이터 프록시 300/분과 분리)·KV fail-closed·body 200KB 상한. 완료 게이트 4개(인증없는 curl 거부/quota 상한 확인/oversized body·token 거부/서버키 노출 0+kill switch) 전부 충족 확인. **검증 방법**: Worker가 표준 Fetch API만 사용하므로 Node 18+에서 실제 `fetch` 핸들러를 직접 호출하는 진짜 동작 테스트(`scripts/ci-worker-anthropic-check.mjs`, `ci.yml` 배선) — 13개 시나리오 13/13 PASS, 정적 계약이 아닌 실제 호출 검증. KV get→put 원자성 자체(동시 요청 시 캡 소폭 초과 가능)는 Durable Objects 없이는 근본 해결 불가로 범위 밖 유지(문서화만). 상세: `_context/BUG-POSTMORTEM.md` P662.

우선순위: P0

작업 범위:

- 호출자 인증 모델 결정
- 강제 per-user/IP/token quota와 원자 카운터
- body size, 입력·출력 token, timeout, concurrency 상한
- origin은 보조 신호로만 사용
- KV 미바인딩 시 fail-closed 여부 결정
- HKG/B8 지역 장애와 우회 정책 문서화

완료 게이트:

- 인증 없는 curl 호출 거부
- quota 경합 테스트에서 상한 초과 0
- oversized body와 무제한 token 요청 거부
- 서버 키 노출 0, 비용 경보와 kill switch 확인

### WO-2 — Trading Score를 의사결정 도구로 검증

우선순위: P1

작업 범위:

- 점수 입력 snapshot을 PIT 형태로 보존
- live 계산과 backtest 계산 parity
- missing/neutral 분리
- 1/5/21/63일, regime, ablation, baseline, walk-forward 평가
- confidence를 확률처럼 표시할 경우 calibration

완료 게이트:

- 표본수와 기간을 사전 정의하고 train/tune/test 분리
- 모든 행동 라벨에 OOS 결과·신뢰구간·최대낙폭 제공
- fallback 포함률 리포트
- 음의 상관 또는 무효 결과일 때 라벨 자동 완화 정책
- 결과가 나쁘더라도 삭제하지 않는 재현 가능한 artifact

> **상태(2026-07-10, Sonnet 5 세션, v52.50/P665/R298): 축소 검증 구현 완료 — 완료 게이트 전체 충족은 아님(정직하게 기록).** 코드 확인 결과 `history.json`이 약 7개월치뿐이라 "최소 수년·다중 regime"을 문자 그대로 만족할 데이터가 없었음(이미 있던 자체 검증 하네스도 스스로 n≥30 미달을 명시). 사용자에게 AskUserQuestion으로 확인 후 "축소 검증"(자유 소스로 구할 수 있는 부분만 별도 장기 검증) 선택. computeTradingScore 13개 입력 중 SPX/VIX/VVIX/TNX/DXY/WTI/HYG(가중치 55%)는 Yahoo Finance 공개 API로 10년치가 실제로 fetch됨을 사전 확인 후 신규 `scripts/backtest-trading-score-longrun.mjs`로 재구성·검증. **결과**: 21일 forward rho=-0.165(95% CI [-0.203,-0.127], n=2492)·63일 rho=-0.255(CI [-0.291,-0.217]) — 통계적으로 유의미한 음의 상관, walk-forward 양분(2016-23/2023-26)에도 부호 일관. 이는 Codex 게이트가 명시적으로 예견한 "음의 상관 또는 무효 결과" 시나리오와 정확히 일치하지만, **완료 게이트의 "라벨 자동 완화 정책"은 제품 사용자 노출 문구를 바꾸는 결정이라 이번 세션에서 코드로 실행하지 않았다** — 발견만 기록하고 별도 확인이 필요한 후속 결정으로 사용자에게 보고(`computeTradingScore()`/`getScoreAdvice()`/밴드 임계값 전혀 무변경). 미충족 게이트: train/tune/test의 "tune"(스코어는 애초에 fit된 파라미터가 없는 hand-set 규칙이라 해당 없음, methodology 필드에 명시), momScore/breadthScore/PCR/AAII 45%는 자유 다년치 소스 부재로 검증 범위 밖(DEFERRED 성격 — 유료/대체 데이터 소스 확보 시 재개 가능), calibration(확률적 신뢰도 캘리브레이션)은 미시도. 상세: `_context/BUG-POSTMORTEM.md` P665, `_context/KNOWLEDGE-BASE.md` TM-VIII.

### WO-3 — Factor Model 연구→프로덕션 검증

우선순위: P1

작업 범위:

- 라이브 7 factor와 backtest parity
- PIT universe/fundamental/corporate action
- 거래비용·turnover·capacity
- walk-forward/OOS와 regime/sector/size 노출
- adaptive weight와 사용자 프로필을 별도 실험

완료 게이트:

- 최소 수년·다중 regime, 6개 rebalance보다 충분히 큰 표본
- IC/ICIR/t-stat/decay/monotonicity/turnover/cost 공개
- survivorship·look-ahead 검사 PASS
- baseline 대비 증분 성과와 실패 구간 공개

> **상태(2026-07-10, Sonnet 5 세션, v52.51/P666/R299): 축소 검증 구현 완료 — 완료 게이트 전체 충족은 아님(정직하게 기록).** WO-2와 동일한 벽(라이브 팩터 백테스트가 이미 873종목의 1년치·6개 리밸런스만 사용, 코드 자체 주석이 이미 "부족"이라 자인) + WO-3 고유의 새 문제(오늘 유니버스로 다년치를 보면 survivorship bias 발생, 무료 데이터로 해결 불가)를 확인. 사용자에게 AskUserQuestion으로 실행 방식 확인(Yahoo IP 차단 이력 고려) 후 "제한된 표본"(시총 상위 120종목, concurrency=4) 선택. `backtestFactors()`에 선택적 offsets/fwdDays 파라미터 추가(하위호환 확인) + `fetch-data.mjs`에 direct-run 가드 신설(다른 스크립트가 import만 해도 라이브 파이프라인이 부작용으로 실행될 뻔했던 것을 발견·수정) 후, 신규 `scripts/backtest-factors-longrun.mjs`로 10년·117개 리밸런스(프로덕션 대비 ~20배) 검증. **결과**: composite는 1/5/21/63일 전 구간 통계적으로 무의미. lowvol 서브팩터만 5/21/63일에서 유의미한 음의 상관(21일 ICIR=-0.191/t=-2.04, 63일 ICIR=-0.308/t=-3.27, walk-forward holdout에서 더 강해짐) — 저변동성 팩터 통념과 반대 방향(표본 구성·정의 차이가 유력 가설, 확정 아님). **미충족 게이트**: survivorship bias(무료 데이터로 근본 불가), 873종목 전체(120종목 부분표본), decay/monotonicity/turnover/cost(미측정), baseline 비교(미시도). 이 발견으로 라이브 `_aioComputeFactorRanks()` 코드를 변경하지 않음(제품 결정 사항으로 사용자에게 별도 보고). 상세: `_context/BUG-POSTMORTEM.md` P666, `_context/KNOWLEDGE-BASE.md` TM-IX.

### WO-4 — 브라우저 실제 초기화 QA 폐쇄

우선순위: P1

작업 범위:

- viewport CI를 `FULL_INIT=true` 경로로 확장
- `pageerror`, `console.error`, 선택된 critical warning을 실패 조건화
- 외부 정상/장애/timeout/partial data 시나리오
- 22경로 실제 `showPage`, 차트, 이벤트, timer cleanup
- small text 기준과 접근성 게이트 결정
- 핵심 경로 screenshot diff 또는 semantic assertion

완료 게이트:

- 22×4 full-init PASS
- unhandled pageerror/console.error 0
- critical warning allowlist 밖 0
- route 왕복 후 listener/timer/fetch 증가 없음
- 키보드와 screen reader 핵심 흐름 수동 증거

> **상태(2026-07-10, Sonnet 5 세션, v52.52/P667/R300): 부분 구현 완료 — 완료 게이트 전체 충족은 아님(정직하게 기록).** 동시 실행 중인 별도 Codex 세션의 `CODEX-SECOND-PASS-HANDOFF-2026-07-10.md`(사용자가 이번 지시 범위 밖이라고 확인한 문서)에 이미 이 WO의 진단(F-01/F-02)이 있었음을 발견 — 코드 파일에 미커밋 충돌이 없음을 먼저 확인한 뒤 참고만 하고 전부 직접 재검증(그 문서의 더 큰 UX 재설계 의제는 채택하지 않고 WO-4 자체 게이트만 구현). `AIO_VIEWPORT_FULL_INIT=1`로 직접 실행해 22×4 중 technical route 4콤보가 `_pricePosition()` SVG 라벨-값 겹침으로 실패함을 재현 확인 → 라벨/값 baseline 간격을 10px→14px로 넓혀 수정, 재실행으로 해소 확인. `pageerror`/`console.error` 수집을 처음으로 게이트에 추가(이전엔 전혀 없었음) — 켜자마자 앱 자체의 정상적인 API 헬스 warn→error 로그 8건이 걸렸으나 소스 추적으로 버그 아님을 확인 후 정확한 패턴만 허용목록화(포괄 억제 아님, R300). `zeroCanvases`(선언만 되고 채워진 적 없던 죽은 코드) 실구현. small-text 정책 결정: 8px 이하는 게이트 실패, 9px(기존 34곳)는 관찰만 유지. 최종 88/88 PASS 확인 후 `ci.yml`의 viewport-matrix를 `continue-on-error` 제거+FULL_INIT=1 기본+deploy `needs:` 편입으로 실제 배포 차단 게이트 승격. **미충족 게이트**: 외부 정상/timeout/partial-data 시나리오(현재 "전부 abort=장애"만), route 왕복 리소스 누수 계측, 키보드/screen reader 실사(자동화 불가, 사람 필요). 상세: `_context/BUG-POSTMORTEM.md` P667, `_context/DEFERRED-BLOCKS.md` B9.

### WO-5 — 변경 통제와 hook 단일화

> **상태(2026-07-10, Sonnet 5 세션, v52.48/P663/R296): 구현 완료.** 사용자에게 2건 확인 — 브랜치 보호 범위("안전망만": force-push+삭제 차단, PR/상태체크 요구 없음 — 이 저장소는 봇/훅이 PR 없이 main에 직접 push하는 구조라 확인) + auto-commit 범위("세션 시작 스냅샷 대조"). `gh api`로 브랜치 보호를 실제로 활성화(재조회로 확인). `.codex/hooks.json`을 직접 읽어 이 문서가 지목한 OneDrive 경로가 **실제로 존재하지 않아 6개 훅 전부가 무력화**돼 있었음을 확정(상대경로로 전환). "hash가 다르다"고 지목한 `.claude`/`.codex` 6쌍 hook 스크립트는 실제로는 CRLF/LF 차이일 뿐 로직은 완전히 동일함을 확인. 신규 `SessionStart` 훅으로 auto-commit의 "관련 없는 파일 혼입" 문제를 스냅샷 대조 방식으로 해결(이 문서 작성 이후 같은 세션에서 실제로 재현된 사례를 근거로 확정). 버전 정규식 자릿수 고정 버그도 재현·수정. 상세: `_context/BUG-POSTMORTEM.md` P663.

우선순위: P1

작업 범위:

- main branch protection과 required checks
- WIP `git add -A` 자동 커밋 범위 재설계
- `.claude`/`.codex` hook source of truth 단일화
- 절대 OneDrive 경로 제거
- `v{major}.{patch}` 다자리 patch와 현재 7개 버전 위치 검증

완료 게이트:

- required CI 우회 없는 main
- hook 테스트가 v52.43 전체 문자열과 현재 APP_VERSION 위치를 잡음
- 관련 없는 untracked/user file 자동 stage 0
- 한 hook 계약에서 Claude/Codex wrapper 생성

### WO-6 — 데이터 provenance와 freshness 타입 통합

우선순위: P1

작업 범위:

- 모든 값에 source, observedAt, publishedAt, fetchedAt, freshnessClass, fallbackReason
- snapshot 대표 시각과 필드 시각 분리
- manual/seed/live/delayed의 알고리즘 사용 정책
- stale 시 confidence와 행동 라벨 강등

완료 게이트:

- 화면과 score가 같은 provenance 객체를 소비
- stale/manual/seed가 최신 live처럼 표시되는 사례 0
- field별 freshness fixture와 boundary test
- 감사 가능한 source lineage export

> **상태(2026-07-10, Sonnet 5 세션, v52.49/P664/R297): 핵심 슬라이스 구현 완료, 전면 범위는 잔여(정직하게 미완료로 기록).** 코드 확인 결과 evidence 인프라(`TRADING_DECISION_CRITICAL_INPUTS`·`_aioMetricRuntimeEvidence`·`getTradingDecisionInputEvidence`·`getTradingDecisionLogicAudit`)는 이미 존재했고 `computeTradingScore()`가 `evidenceAudit`를 실제로 계산해 반환하고 있었으나, repo 전체에서 `.evidenceAudit`/`.evidenceStatus`를 **읽는 코드가 0곳**이었다(계산만 되고 완전히 버려짐). 또한 등록된 입력은 7개뿐이었는데 `computeTradingScore()`가 실제로 읽는 입력은 13개(VVIX/F&G/breadth200/PCR/HY스프레드/AAII 6개 누락). 화면 쪽에는 이미 20개 페이지에 실제 렌더링되는 별도의 성숙한 provenance 시스템(`_aioDefaultDecision`→`_aioRenderPageDecisionHeader`, source badge+confidence badge)이 있었지만 이쪽은 VIX/SPX/TNX/DXY/WTI 5개 지표만 보고 `computeTradingScore().total`은 숫자만 취해 evidenceAudit을 참조하지 않았다 — "화면과 score가 다른 provenance"라는 이 문서의 지적이 코드로 정확히 확인됨. **구현**: 6개 누락 입력 등록(심볼 시세 경로 1개 + `window` 전역/`_markFetch` 경로 5개로 evidence 엔진 이원화), AAII는 실시간 fetch 경로가 없어 `decisionUse:'reference'`로 정직하게 표시(trading 게이트에서 정당하게 제외), `fetchHYSpread`에 `_markFetch` 배선, `_aioDefaultDecision`이 `evidenceAudit.criticalMissing` 개수로 화면 `sourceKind`를 병합(0→무변화/1-2→DELAYED/3+→SNAPSHOT — 무제한 병합은 "신선한데 항상 스냅샷으로 표시"라는 반대방향 오탐을 만들므로 의도적으로 제한)하고 결측 입력명을 caveat로 병기. **정직하게 미구현으로 남긴 것**: 이 문서가 요구한 "모든 값"(20개 페이지의 개별 표시값 전체) 리트로핏, `DATA_SNAPSHOT` 파일 자체의 필드별 타임스탬프 구조화, 전용 source-lineage export UI — 전부 단일 세션 범위를 넘는 다주 단위 작업이라 `_context/DEFERRED-BLOCKS.md` B9로 이관(§1 "진짜 블록"이 아니라 순수 엔지니어링 규모 문제로 명시 — 다음 세션에 이어서 가능). 헤드리스 963/963(신규 T896~900 포함, 오프라인/차단 네트워크 조건에서도 통과) + 로컬 게이트 7종 PASS. 상세: `_context/BUG-POSTMORTEM.md` P664.

### WO-7 — 점진적 구조 격리

우선순위: P2 / WO-0~6 이후

금지: 전체 재작성, 한 번에 프레임워크 전환, 대규모 전역 제거

작업 범위:

- 전역 read/write inventory와 소유자 지정
- snapshot adapter, storage adapter, page lifecycle adapter부터 도입
- 계산 순수 함수와 DOM side effect 분리
- route 단위 timer/listener/fetch cleanup
- `innerHTML` 입력 신뢰도 분류

완료 게이트:

- 패킷마다 전역 write 수·innerHTML 수·누수 대리 지표가 감소 또는 증가 근거 명시
- 기존 948+88과 full-init 신규 게이트 유지
- ±500줄 이상 변경 시 CODE-MAP 갱신

> **상태(2026-07-10, Sonnet 5 세션, v52.53/P668): Packet 1(전역 read/write 인벤토리) 완료 — 다개 패킷 중 첫 걸음일 뿐, WO-7 전체 완료 아님(자체 정의상 원래 여러 세션에 걸친 점진적 작업).** baseline 실측: innerHTML 395·전역쓰기 1,318·이스케이프 호출 282·localStorage direct 146 vs safeLS 8. 핵심 발견: Codex가 "도입하라"고 한 timer/chart/page-lifecycle 어댑터는 **이미 존재**(`_aioTimerRegistry`/`_aioChartRegistry`/`_aioPageBus`) — 실제 갭은 어댑터 부재가 아니라 채택률. snapshot adapter만 진짜 부재. 위험 0에 가까운 수정 1건(raw setInterval 1건을 기존 레지스트리 경유로 전환)만 실행, 나머지(storage adapter 전면화·snapshot adapter 신설·innerHTML 전수 분류)는 규모상 별도 패킷으로 명시 이관. 상세: `_context/WO7-GLOBAL-INVENTORY-2026-07-10.md`, `_context/BUG-POSTMORTEM.md` P668.

### WO-8 — 문서·운영 기록 압축과 현재성 회복

우선순위: P2

작업 범위:

- append-only 기록을 연도/버전별 archive와 active summary로 분리
- INDEX/CODE-MAP/WORKTREE-AUDIT 자동 현재성 검사
- 오래된 규칙·중복 규칙·폐기된 경로 정리
- 감사 문서의 resolved/open 상태 명시

완료 게이트:

- active 문서에서 현재 계약을 한 번에 찾을 수 있음
- archive 이동 뒤 링크·knowledge lint PASS
- 운영 사실과 문서 drift를 CI가 검출

> **상태(2026-07-10, Sonnet 5 세션, v52.54/P669): Packet 1(CODE-MAP 현재성 검사+갱신, 감사 문서 상태 명시) 완료 — WO-8 전체 완료 아님.** 신규 `scripts/ci-doc-currency-check.mjs`로 CODE-MAP.md §1 파일 크기 표를 실제 코드와 대조 — v51.90(2026-07-02) 이후 무재검증으로 최대 484줄(aio-tests.js) 드리프트를 발견, CI에 정보성(non-blocking) 단계로 배선 후 CODE-MAP §1을 실측치로 갱신(§2 이하 개별 함수 line 범위는 이번에 재검증하지 않았음을 문서에 명시, confidence high→medium). 6개 주요 감사 문서 중 상태 배너가 없던 유일한 문서(FABLE-LIVE-AUDIT-2026-07-04.md)에 resolved/closed-by-decision 요약 추가, 나머지는 이미 자체 배너 보유 확인. **미완료**: CHANGELOG.md/BUG-POSTMORTEM.md의 연도·버전별 archive 분리(440+/600+ 항목의 대규모 콘텐츠 이동 — 별도의 신중한 패킷 필요), INDEX.md/WORKTREE-AUDIT.md 자동 현재성 검사(INDEX.md는 동시 실행 중인 별도 세션이 편집 중이라 이번엔 읽기만 함), 오래된/중복 규칙 정리. 상세: `_context/BUG-POSTMORTEM.md` P669.

---

## 8. 권장 실행 순서와 의존성

```text
WO-0 Watchdog 복구
  ├─ WO-1A Portfolio 보안
  ├─ WO-1B Anthropic 비용 경계
  └─ WO-5 변경 통제
        ↓
WO-6 Provenance 계약
  ├─ WO-2 Trading Score 검증
  └─ WO-3 Factor 검증
        ↓
WO-4 Full-init QA
        ↓
WO-7 점진 구조 격리
        ↓
WO-8 문서 압축
```

WO-0이 최우선인 이유는 다른 모든 변경의 운영 안전망이기 때문이다. WO-2/3보다 WO-6이 먼저인 이유는 잘못된 시점·fallback 데이터로 정교한 백테스트를 해도 결과가 신뢰 가능하지 않기 때문이다. WO-7은 보안·데이터·검증 계약이 먼저 고정된 뒤 진행해야 한다.

---

## 9. 후속 에이전트 시작 체크리스트

1. `_context/WORKFLOW-GOVERNANCE.md`, `_context/RULES.md`, 이 문서, 해당 WO의 원본 파일을 읽는다.
2. 감사 기준선 `v52.43`, 948/948, 88/88, live invariant를 재현한다.
3. 한 번에 하나의 WO만 선택하고 수정 전 실패 테스트를 만든다.
4. 버그라면 BUG-POSTMORTEM과 예방 규칙을 같이 닫는다.
5. 코드 변경이면 `scripts/bump-version.mjs` 외 수동 버전 수정은 하지 않는다.
6. 자동 커밋·푸시·배포는 하지 않는다. 사용자 명시 권한이 있을 때만 수행한다.
7. UI 표시, 데이터 계약, 런타임 저장값, CI를 같은 완료 조건으로 묶는다.
8. 성능 결과가 부정적이어도 삭제하거나 유리한 기간만 선택하지 않는다.

---

## 10. 감사 실행 기록

### PASS

- 모든 주요 JS/MJS syntax check
- `ci-version-check.mjs`
- `ci-structural-check.mjs`
- `ci-ux-default-path-check.mjs`
- `ci-runtime-contract-check.mjs`
- `ci-data-pipeline-contract-check.mjs`
- `ci-semantic-review-check.mjs`
- `ci-workflow-compaction-check.mjs`
- `ci-skill-contract-check.mjs`
- `ci-knowledge-lint-check.mjs`: 기존 `_context/*.md` 28개, warning 0
- `ci-headless-tests.mjs`: 948/948
- `ci-viewport-matrix-check.mjs`: 88/88, overflow 0px
- `ci-live-invariant-check.mjs`: live v52.43 PASS

### FAIL 또는 주의

- `.github/workflows/data-watchdog.yml`: YAML parse FAIL, U+0080 5개
- GitHub Data Watchdog run `29059996134`: workflow file issue, jobs 0
- Chrome live warning 27건
- service worker v52.34 / app v52.43 불일치 경고
- score backtest: 통계적으로 의미 없음, 현재 표본에서 음의 상관
- factor backtest: 표본·factor parity·PIT·비용 부족

### 이번 감사에서 변경하지 않은 것

- `index.html`, `js/`, `sw.js`, Worker, scripts, workflows, data artifact
- GitHub 설정, 브랜치 보호, Actions 재실행
- 커밋, 푸시, 배포

이 문서는 문제를 고치지 않는다. **문제, 근거, 우선순위, 완료 게이트를 다음 에이전트가 그대로 실행할 수 있게 고정한 인수인계 문서**다.
