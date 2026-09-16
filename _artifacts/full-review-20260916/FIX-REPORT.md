# AIO Screener — 근본원인 수정 리포트 (v54.98)

| 항목 | 값 |
|---|---|
| 릴리스 | `v54.98` (2026-09-16) |
| 기준 커밋 | `9fccf5ff` (수정 전) |
| 근거 원장 | `_context/BUG-POSTMORTEM.md` **P1074~P1078** · `_context/RULES.md` **R596~R602** · `_context/QA-CHECKLIST.md` **QA-EXHAUST-38~43** |
| 범위 | 배포 정지 해제 4건 + P0 의미 결함 5건 + 후속 세션 4건(P1075~P1078) + 거버넌스 기록 |
| 커밋/배포 | 사용자 명시 요청으로 진행 |

## 1. 배포 정지 해제 (P0)

CI는 `2026-09-11T21:21Z` 이후 28회 연속 실패했고, 실패 shard는 `Browser / browser-runtime` 하나뿐이었다. 그 결과 attest가 건너뛰어지고 `Deploy GitHub Pages`가 계속 skipped 되어 라이브 사이트가 v54.89(5일 전)에 고정됐다.

### 1.1 `.gitattributes` — 체크아웃 개행이 바이트 계약을 깨던 문제

- **원인**: `core.autocrlf=true` 환경에 `.gitattributes`가 없어 content-addressed 객체(`public-data/objects/masters/*.json`)가 CRLF로 체크아웃됐다. 파일명이 곧 내용 sha256인데 체크아웃 변환 때문에 37개 매니저 projection의 digest가 전부 어긋났다. Linux CI는 LF라 통과 → **로컬에서만** 실패.
- **파급**: `masters-contract`(phase 1) 실패 → 브라우저 게이트 23개 전부 SKIP → CI 재현 불가. 추가로 `browser-masters`·`artifact-budget`이 30초 타임아웃, 그리고 Masters 페이지 자체가 `src/ui/pages/masters.js:1151`의 클라이언트 무결성 검증에서 막혀 행을 렌더할 수 없었다.
- **수정**: `public-data/objects/** -text`(+`*.png binary`). 전체 텍스트 파일 `eol=lf` 정규화는 워킹 트리 전면 재작성이 필요해 **의도적으로 별도 커밋으로 분리**했다.
- **검증**: 강제 재적용 후 `objects 555 / crlfFiles 0 / shaMismatch 0` — 역사적 객체까지 자신의 파일명 해시와 일치. `masters-contract` PASS, `browser-knowledge` 6/6(이전 4/2), 두 게이트 소요시간 34초대 → 4~5초.

### 1.2 gate 3건

| gate | 결함 | 수정 |
|---|---|---|
| `ci-chat-ui-state-browser-check.mjs` | 앱에 **존재한 적 없는** `#chat-home-stop`을 단언(실제 id는 `chat-home-btn-stop`). `git log -S`로 앱 파일에 전무함을 확인 | 실제 id로 교정 |
| `ci-architecture-browser-check.mjs` | `chartKinds` 허용목록이 런타임이 방출하는 정본 tier `T3_PUBLIC_DELAYED`를 누락 | 손 목록을 제거하고 `src/data/contracts/source-kind.js`의 `isRecognizedSourceKind`로 검증(비-tier sentinel `unavailable`/`live`/`derived`만 명시) |
| `ci-screener-auto-refresh-browser-check.mjs` | (a) 가격 미표시를 요구하는 단언이 실제 제품 결함을 정확히 지적하고 있었고 (b) "quote tick은 새 snapshotId를 만든다"는 overlay 이전 설계를 고정 | (a) 제품을 수정(§2.1) (b) 설계가 실제로 보장하는 불변성으로 교체 |

## 2. P0 의미 결함

### 2.1 스크리너 가격 컬럼의 소유권 공백 (HIGH, 제품 결함)

- **증상**: 스크리너 가격 컬럼이 **모든 행에서 영구히 `미수신`**. 라이브 시세가 있어도 표시되지 않는다.
- **원인**: `field-readiness` 마이그레이션 이후 `liveRow`(`src/ui/pages/screener.js:142`)는 `row.fieldReadiness`가 있으면 계약 경로만 읽고 `_liveData`를 **전혀 보지 않는다**. 런타임 행은 모두 `fieldReadiness`를 보유(provider가 추가)하므로 live 경로가 죽는다. legacy `updateScreenerFromLiveData`는 "RSI/팩터는 native가 소유한다"며 **mcap만** 남기고 좁혀졌고, native는 price 투영을 승계하지 않았다 → **소유자 없음**.
- **수정**: field-readiness 경로에서도 계약이 값을 주지 못한 경우에만 live quote를 overlay하고, 그 값의 기준(관측시각·출처)을 함께 싣는다. 통화 충돌(양쪽이 선언하고 다름)일 때만 배제한다. `_aioSetLiveData`는 이제 `currency`를 저장해 충돌 검출이 가능해졌다.
- **검증**: `browser-screener-refresh` PASS(`quoteCoverage: 1`, `frozenRunSurvivesQuoteRefresh: true`). 진단 스크립트로 수정 전 `12/12 미수신` → 수정 후 실제 가격 렌더를 확인.

### 2.2 NFP 전월대비 델타가 항상 0

- `data.json`은 천명 단위(`nfpDelta: 141`)로 발행하는데 `js/aio-data.js`가 다시 `/1000` → `0.141` → `toFixed(0)` → `+0K`. 같은 함수의 다른 델타는 변환하지 않아 `/1000`이 유일한 이상치였다.
- **수정**: 이중 환산 제거. 쓰기 지점은 동적 키(`'_' + k + 'Delta'`)라 리터럴 grep에 잡히지 않는다는 점을 확인 후 반영.

### 2.3 관측 Equity/Index Put/Call이 합성값으로 대체

- `_aioUpdatePutCallDom`이 관측 Cboe 값을 payload로는 받지만 `DATA_SNAPSHOT`에는 `pcr`만 저장 → `fetchPutCallRatios`의 `snap.equityPutCall`이 항상 NaN → total×0.72/×1.18 합성 발화. OPEX 패널이 관측 `index 0.96` 대신 `1.10`을 표시했고, `estimated` 플래그는 합성 후 항상 true라 판별력이 없었다.
- **수정**: 관측값을 `DATA_SNAPSHOT`에 보존(합성이 관측을 덮어쓰지 못함), `estimated`를 실제 합성 여부로 계산.

### 2.4 엔캐리 라벨이 실제 입력과 불일치

- 계산은 `미 10Y − 한국 BOK 기준금리`인데 라벨은 `미일 정책금리 차 (BOJ 수동 확인값 기준)`이었다. 위험 점수 규칙이 이 값에 의존해 **점수 기여가 라벨과 반대로 움직인다**(합성 기준 1.7%p → 최대 위험 가산, 실제 미일차 ≈3.7%p → 최소 가산).
- **수정**: 라벨·검증 문구를 실제 입력에 일치. 진짜 미일 정책금리차로 바꾸려면 BOJ 입력 배관이 필요해 **의도적으로 범위 밖**으로 두고 잔여 위험으로 기록.

### 2.5 AI 차단 게이트가 스스로 선언한 불변식을 깨던 fail-open

- `js/aio-chat.js`의 research degrade 경로가 사본의 `blocked`를 `false`로 강제 해제해, 바로 아래 조기 반환이 무력화되고 차단 본문 아래에 실행 카드가 재부착될 수 있었다. 해당 코드의 주석이 그 금지를 **스스로 선언**하고 있었다.
- **수정**: `degraded`/`reason`만 설정하고 `blocked`는 보존.

### 2.6 뉴스 현재성 노출

- `#news-stale-banner`는 `body:not(.aio-dev-mode)` 숨김 목록에 있어 공개 모드에서 **경고가 절대 보이지 않았고**, 헤더는 "45분 자동 갱신"을 상시 주장했다(수집은 cron 스로틀로 1~4시간 지연).
- **수정**: 숨김 목록에서 제거해 배너를 공개 모드에서도 노출, 헤더를 "08:00 KST 수집분 기준 · 수집 주기 45분(실제 수집은 지연될 수 있음)"으로 하향, 리스크 뉴스 기본값의 false all-clear(`0 · 리스크 없음`) → `— · 뉴스 수신 대기`.

## 2B. 후속 세션 수정 (P1075~P1078)

같은 v54.98 안에서 백로그를 순서대로 닫았다. 각 항목은 근본원인 수준이며 실행 가능한 회귀 방지가 함께 들어갔다.

| 원장 | 결함 | 근본 수정 | 검증 |
|---|---|---|---|
| **P1075** / R599 | 수치·현재성 가드의 스위치가 "질문에 라틴 티커가 있는가"라는 대리 변수였고, 한글 종목명·지표 질문(`"삼성전자 실적 어때?"`, `"AAPL PER 얼마야?"`, `"AAPL 밸류에이션 분석해줘"`)에서 가드 5개가 전부 꺼졌다 | 계측 질문(`hit.ENTITY_FACT`)을 스위치로 사용, EDUCATION-primary 개념 질문은 제외, `EPS·FCF·밸류에이션·valuation` 어휘 보강 | `tools/probe-taxonomy.mjs` 13/13 (양성 8·음성 5) |
| **P1076** / R600 | `getPageContractAudit`가 `applyPageContractCompatibility`가 채운 **뒤**의 상태를 검사해 항상 `ok` — 배포 게이트의 "contract incomplete" 차단이 구조적으로 발화 불가 | 파생 항목을 **합성 시점에 기록**(`_aioDerivedContractIds`)하고 작성/파생을 구분해 `authoredCoverage`로 보고. headless T913을 더 강한 단언으로 교체 | `tools/probe-page-contract-audit.mjs`: `status=warn`, deep-audit 15/20, sequential 16/20, 파생 5개 라우트 명시 |
| **P1077** / R601 | 게이트가 같은 파일에 "숨김(표시 패널 아님)"과 "감사·claim 원장을 렌더한다"를 동시에 요구 — 후자는 호출부 0건 렌더러 7종 안의 문자열로만 충족 | 죽은 렌더러 ~230줄 삭제, 단언을 "메타데이터 존재 + 렌더러 부재(음성)"와 "claim 원장은 내부 API로만 도달"로 교체 | `ci-research-flow-contract-check` 66 assertions PASS, browser-knowledge 6/6 |
| **P1078** / R602 | 한 라벨이 두 정의를 가리키던 6건(등급 vs 순위, 필터 라벨 vs 실제 임계, breadth enum 노출, RSP/SPY 라벨, 마켓 폭 라벨, MACD 라인/히스토그램) | `rankGrade()`·`syncRankFilterLabels()` 단일화, 한국어 매핑 공유, 라벨을 실제 기저로 교정, MACD 히스토그램 기저 통일 | `tools/probe-screener-grade.mjs` 전체 PASS + DOM 위반 0 |

시행착오도 기록했다: P1076에서 처음 시도한 "감사 진입 시점 스냅샷"은 브라우저 실측에서 `derivedDeepAudit: []`로 무효가 확인되어(부팅이 먼저 채움) 생성 시점 기록으로 교체했다.

## 3. 검증 (실브라우저)

| 검증 | 결과 |
|---|---|
| preflight | 13/13 PASS |
| workspace | 9/9 PASS |
| core | 34/34 PASS |
| data | 21/21 PASS |
| browser-runtime (CI를 막던 shard) | **8/8 PASS** |
| browser-knowledge | **6/6 PASS** (이전 4/2) |
| `qa-runner affected --session full-review-20260916` | **91 PASS + 3 CACHED, 0 FAIL, 0 SKIP** (preflight, core, data, workspace, browser-unit/runtime/resilience/viewport/surface) |
| `masters-contract` | PASS |
| 객체 무결성 | 555개 LF · digest 일치 |

브라우저 게이트는 로컬 서버에 대해 실제 Chromium으로 실행되므로, 스크리너 가격 렌더·챗 키보드 중지·Masters 렌더·접근성/뷰포트/표면 게이트는 **실사용자 경로 기준**으로 확인된 것이다.

## 4. 잔여 위험 (해소하지 않음)

- **배포 검증은 아직 아니다.** 라이브는 여전히 v54.89이고, 위 수정은 push 이후에야 Pages에 반영된다. external/live gate는 배포 후에만 유효하다.
- `main` 보호 규칙과 staging→attestation 승격은 미구현(QA-EXHAUST-36) → 검증 전 revision이 main에 남을 수 있다.
- semantic coverage는 **6.89% / `releaseCertified=false`** 그대로다. 본 수정은 그 미검토 영역의 **표본** 심층 검토에서 나왔다(QA-EXHAUST-39로 남은 표면 기록).
- 전체 텍스트 파일 `eol=lf` 정규화는 별도 커밋으로 분리했다(현재 다른 파일들은 여전히 체크아웃 시 CRLF).
- 뉴스 수집 지연은 구조적이라 문구로 완화했을 뿐 해소가 아니다.
- `_artifacts/`의 게이트 산출물 일부(boot-interaction, structural-quality)가 이번 실행으로 v54.98로 재스탬프됐다.

## 5. 다음 후보 (아직 미수정)

의미 검토에서 확정된 HIGH/MEDIUM 중 다음 묶음:
1. `currentSensitive` 단일 축(한글 종목명·실적·밸류에이션 질문에서 수치 가드 OFF).
2. `js/aio-core.js`의 공허한 계약 감사(자동 채움) + `AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY` stale + 16/20 라우트만 심층 감사.
3. 공급 리서치 provenance 렌더러가 죽은 코드라 사용자에게 출처가 도달하지 않는 문제 + 이를 문자열로만 단언하는 게이트.
4. 스크리너 등급/순위 불일치, breadth enum·basis 노출, MACD writer 이중화.
5. `sw.js` 등록부 드리프트(유령 11 / 누락 17), AG-DOM-WRITER 추출기 사각지대, `compatibility-facade` 3중 입력 매핑.
6. semantic ledger 신선도(`asOf` vs HEAD) 검사와 `coverage-summary.json` 재생성.
