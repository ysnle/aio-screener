# AIO 전체 파이프라인 구조·의미·정합성 검토 핸드오프

작성일: 2026-10-24 (한국 시간). MODE: review. 대상: 현재 작업 트리 v58.73, HEAD `07ecac5735aa09e2363a60d61e3fce05d740bdc2`와 기존 미커밋 변경을 합친 상태.

## 1. 목적과 판단 범위

사용자가 요청한 것은 전체 코드베이스의 파이프라인 구조 검토와 의미·정합성 검사, 그리고 발견 사항과 향후 개편·보강안을 상세히 넘기는 것이다. 실제 애플리케이션·생산자·워크플로 개선은 요청 범위가 아니다. 이번 작업은 해당 소스를 고치지 않았고, producer 실행·외부 AI 호출·Actions dispatch·commit·push·deploy를 하지 않았다. 날짜가 붙은 이 보고서와 재현 증거만 추가했다. 버전·원장·생성 레지스트리도 변경하지 않았다.

‘전체’는 실행 진입점과 주요 생산→검증→게시→소비 경계를 모두 목록화했다는 뜻이다. 모든 파일의 모든 분기, 공급자 응답, 재무 수식, 프로덕션 동작을 전수 증명했다는 뜻은 아니다. 심층 검토한 부분과 미검증 부분을 아래에 명시한다. 현재 작업 트리에 존재한 문제이며 어느 기존 작업자가 도입했는지는 판정하지 않았다.

증거 수준은 다음과 같이 구별한다.

- **E1 정적 확인**: 실제 소스·레지스트리·호출 경로를 읽어 확인.
- **E2 로컬 재현**: 실제 export 또는 실제 스크립트를 주입형 fixture로 실행. 외부 서비스와 브라우저 동작의 증거는 아니다.
- **E3 브라우저**: 이번 감사에서 실행하지 않음.
- **E4 배포·외부**: 이번 감사에서 실행하지 않음. 현재 서비스 장애·청구·공급자 건강 상태를 단정하지 않는다.
- **inferred**: 도달 가능한 조건과 코드로부터 추론한 영향. 실제 경합·네트워크 사고가 발생했다는 뜻이 아니다.

`ACT ON`은 수정 권고, `CONSIDER`는 설계 보강 검토, `NOTED`는 유지할 경계, `DISMISSED`는 근거가 부족하거나 기존 보호로 반박한 가설이다. 모든 수정 권고는 미적용 상태다.

## 2. 코드베이스 전체 경로 지도

기계 목록은 `inventory.json`에 있다. 13개 workflow의 trigger, concurrency, job 의존성, step과 명령을 수집했다. 4,263개 작업 파일의 SHA-256은 검토 기준점 식별용이며, 그 수만큼 의미 검수를 했다는 뜻이 아니다. QA manifest의 등록 게이트 수는 실행된 계약 검사가 197개로 보고했다. 이번에 197개를 모두 실행한 것은 아니다.

| 파이프라인 | 진입점과 주요 경로 | 출력/소비자 | 핵심 불변조건 | 검토 수준 |
|---|---|---|---|---|
| 시장 일괄 수집 | `refresh-data.yml` → cadence → `fetch-data.mjs` → `producer/source-planes.mjs` → quote 검증·macro 병합 | data, market-snapshot, history, narrative, timeline → 브라우저·AI | 값·관측일·출처·변화량이 같은 관측을 가리킴 | E1 + macro E2 |
| 보조 시장 lane | daily poll, 13D/G·13F, stress/scenario outcomes, temperature, web reference | 지연·참고 자료와 파생 시나리오 | 보조 수집 장애가 정상 핵심 데이터 게시를 막지 않음 | E1 + temperature E2 |
| core screener/재무 | `refresh-screener.yml` → SEC ledger 복원 → SEC/한국/earnings/consensus/weights/listings → runtime projection → factors | screener·SEC projection → 종목/스크리너 | issuer·분기·단위·membership·원장 digest 결속 | E1, 개별 재무 수식 전수 미검증 |
| extended screener | core 후 별도 due/job/lock → extended membership/SEC/factors → 3개 artifact | 확장 유니버스 | 검증한 core 입력과 rebase 후 게시 후보 일치 | E1 |
| 데이터 승격 | manifests → quarantine → integrity/continuity/reconciliation → candidate digest → commit → CI dispatch | main의 데이터 release | 일부 실패는 명시적 유지/지연, 의미가 다른 결합 금지 | E1 |
| 고속 가격 | `worker/data-plane.js` cron → provider → KV → endpoint → snapshot client | intraday/fast quote 소비 | session·관측일·revision, fallback의 비승격 | E1 + client 후보 검증 |
| AI/번역/검색 | client context/retrieval → proxy → Durable Object quota/reservation → upstream → publication checks | 채팅·번역·Actions narrative | 공용 월 예산, 근거 있는 주장, 출처와 값의 결속 | E1 + publication E2 |
| 브라우저 상태·캐시 | SW → boot/native ESM+legacy → artifact loader → slices/selectors → route/render | 8개 화면·19 route ids·AI context | 실패 후 복구, 새 값과 날짜의 원자성, lifecycle 종료 | E1, DOM 전수 미검증 |
| 지식 생성 | content/domain authoring → knowledge builders → evidence/articles/graph/index/route-targets | library·learning·AI retrieval | reference와 current 관측 분리, 출처·검수 상태 보존 | E1 + 선택 계약 확인 |
| 코드 QA/릴리스 | qa-pipeline/qa-runner → preflight → contract/browser shards → attestation | Pages/Workers | 테스트한 SHA·선택 scope·배포 대상 일치 | E1 + 계약 게이트 E2 |
| Pages 패키징/배포 | exact SHA checkout → allowlist stage → minify/bundle → SW code hash → deploy → external checks | 공개 정적 사이트 | 최종 배포 bytes와 테스트 대상 관계, 신규 main 역행 방지 | E1 |
| Worker 배포 | successful push CI → attestation → import impact/convergence → main guard → deploy/smoke/rollback | AI proxy·fast plane | 배포 소스 식별·rollback target 보존 | E1 + 배포 계약 E2 |
| 운영 관측/복구 | watchdog → local/external checks → rolling SLO; operations-alert → issue reconcile; ensure-live-convergence | 운영 상태·알림·Pages handover | 성공/생략/대기/복구를 혼동하지 않음 | E1 + 운영 E2 |
| 수동 검수 후보 | 월간 universe, 주간 macro calendar, 연간 exchange calendar, knowledge candidate | artifact·검수 issue | 후보 생성은 승인/자동 게시가 아님 | E1 |
| 개발 지식·거버넌스 | bump/record-fix → workspace state → catalog; canonical skills → mirrors; route registry | 에이전트 context·QA 선택 | 파생물 재생성, 과거 기록과 현재 상태 구별 | E1 |

주요 연결을 요약하면 다음과 같다.

```text
공급자 → 수집 lane → 관측 정규화 → 파생값·서술 → artifact 후보
    → 의미/연속성 검사 → 게시 후보 결속 → main → CI attestation
    → Pages 패키징·배포 → 브라우저 캐시/상태 → 화면·AI context

Worker cron → 빠른 가격 KV ──────────────────┘
content/지식 원본 → 생성물/검색 index ─────────┘
AI context → 예산 예약 → upstream/검색 → 응답 검증 → 표시/저장

각 실행 결과 → watchdog/운영 상태 → 알림·수렴 드라이버
원본 변경 → QA impact 선택 → 해당 의미/행동 검사
```

## 3. 유지할 구조와 반박된 가설

- **NOTED / E1·E2:** CI는 attestation의 tested SHA를 기록하고 Pages는 run id·repository·branch·SHA를 재확인한다. “항상 최신 main을 임의 배포한다”는 가설은 맞지 않는다. Worker도 소스 graph 변화와 main 전진을 확인하며 smoke 실패 시 이전 version 복구 경로가 있다.
- **NOTED / E1:** 정상 데이터와 실패 lane을 분리하는 registry·last-known-good·quarantine·continuity가 이미 있다. 전체 오케스트레이터를 새로 만드는 것보다 빠진 의미 불변조건을 공통 지점에 넣는 편이 작고 검증 가능하다.
- **NOTED / E1:** SEC bulk ledger와 Pages bounded projection을 구별한다. public artifact가 있다고 모든 원장을 공개하는 구조는 아니다. 실제 저장소/스토리지 권한 상태는 외부 미검증이다.
- **NOTED / E1:** AI 인증·공용 quota·reservation 및 미국 Durable Object authority가 존재한다. 이번 감사에서 이를 우회하여 비용을 발생시키는 실증은 하지 않았다. publication 검사의 결함을 예산 우회 결함으로 확대하지 않는다.
- **NOTED / E1:** 지식의 reference 상태와 검수 미완료를 명시하는 장치가 있다. 구조적인 coverage 수나 gate PASS를 내용의 참·투자 효용 검증으로 해석해서는 안 된다.
- **DISMISSED:** watchdog가 환경변수 cache 경로 때문에 operational-health artifact를 못 찾는다는 초기 의심. `ci-external-pipeline-check.mjs:18`은 실제로 저장소 `.cache/aio-qa/external-pipeline-status.json`을 쓰므로 upload 경로와 맞는다.
- **DISMISSED:** release parity 검사가 항상 변경된 manifest를 남긴다는 의심. `ci-generated-release-parity-check.mjs`에는 실패·차이 시 원본 복원이 있다. 다만 실제 파일을 잠시 재작성하므로 이번 읽기 전용 감사에서는 실행하지 않았다.

## 4. 확정 사항과 개선 권고

### DATA-01 · 높음 · ACT ON · E2 — 새 CPI/PCE에 이전 월 변화량이 남는다

근거: `scripts/producer/macro-merge.mjs:12`, `:44`, `:86`, `:89`; 소비 경로 `scripts/producer/market-narrative.mjs:378`, `src/domain/macro/macro-read.js:196`.

BLS/BEA가 FRED보다 먼저 새 기준월을 공급하면 promote는 값·기준월·출처·freshness만 바꾼다. CPI/PCE delta는 기존 FRED 값으로 남는다. 실제 함수에서 CPI 2.5(9월)와 +0.4(이전 관측 변화량), corePCE 2.4(8월)와 +0.3이 함께 반환됐다. narrative는 이 delta를 읽고 물가 상승을 지시하므로 화면 숫자 하나의 문제가 아니라 해석 전파 문제다. 재현 숫자는 fixture이며 실제 경제 통계가 아니다.

최소 보강: 기준월 변경 시 delta를 같은 정의의 이전 관측으로 재계산하거나 없음을 표시한다. 장기 개편: `{value, observationDate, comparisonDate, delta, unit, adjustment, source}`를 하나의 관측 객체로 승격한다. 수용검사: BLS/BEA가 한 달 빠른 경우 값과 delta가 서로 다른 월에 속하지 않고 AI 방향 문장도 보류되거나 올바르게 계산되어야 한다. Treasury/HY OAS의 기존 delta 교체 처리와 일관되게 적용하되 지표 정의 차이는 보존한다.

### DATA-02 · 높음 · ACT ON · E2 — 확보했던 최신 공식 관측이 다음 런에서 역행한다

근거: `scripts/lib/macro-sources.mjs:442`, `:455`; `scripts/producer/macro-merge.mjs:21`.

직전 런은 BLS 9월 CPI 2.5를 확보했고 다음 런에서는 BLS가 실패, FRED만 8월 CPI 3.0을 공급하는 조건이다. last-known-good merge의 spread가 current를 날짜 비교 없이 덮어쓴다. 실제 반환은 값 3.0, 날짜 8월, `fred-official-primary`, `observed`였다. 뒤의 official promotion 날짜 비교는 이미 사라진 이전 최신 관측을 복구하지 못한다.

최소 보강: 필드별 관측일을 비교하여 더 최신의 이전 관측을 유지하고 이번 수집 결과는 별도 receipt로 남긴다. 장기 개편: 값 선택과 provider health를 분리하고, 날짜 단조성·동일 날짜 revision·출처 우선순위를 공통 정책으로 만든다. 수용검사: 최신 공식 → 공식 실패+FRED 지연 → FRED 추격의 3회 순서에서 기준월이 역행하지 않아야 한다. 같은 날짜 정정치는 별도 허용 규칙이 필요하다.

### DATA-03 · 중간 · ACT ON · E2 — 전 시장 온도계 동시 중단을 stale로 인식하지 못한다

근거: `scripts/build-market-temperature.mjs:94`; `src/ui/components/market-temperature.js:17`, `:98`.

모든 시장 fetch가 실패하면 기존 artifact가 그대로 남는다. consumer는 retained 목록과 시장끼리 날짜 차이만 비교한다. 모두 같이 오래되면 차이가 0이다. 2025-01-01의 두 시장을 넣었는데 stale 집합은 비어 있었다. renderer에는 이 집합을 이용해 ‘지금’ 극단 구간을 설명하는 경로가 있다. 이 DOM을 실제 브라우저에서 재현한 것은 아니다.

최소 보강: 시장별 최신 완료 세션 대비 asOf를 판정한다. 장기 개편: cadence 정책을 consumer마다 다시 쓰지 말고 공통 presenter에서 사용한다. 수용검사: 전체 outage, 일부 outage, 주말·휴일, 한국/미국/일본 종료 시각 차이 모두에서 날짜·지연 표시가 맞아야 한다. 현재 artifact 날짜만으로 실제 live 장애를 단정하지 않는다.

### DATA-04 · 중간 · ACT ON · E1/inferred — 보조 온도계 요청에 실행 시간 상한이 빠졌다

근거: `scripts/build-market-temperature.mjs:29`, `:85`; `.github/workflows/refresh-data.yml:184`.

Yahoo fetch에 명시적인 AbortSignal이 없고 다섯 시장을 순차로 처리한다. 해당 step 자체의 timeout도 없다. Naver fetch에는 12초 timeout이 있어 정책이 비대칭이다. 계속 응답을 기다리는 공급자 조건에서는 보조 lane이 job 전체 시간 예산을 소비하고 뒤의 promotion/commit을 막을 수 있다. continue-on-error는 반환된 실패만 격리한다. 실제 네트워크 정지 사고는 미재현이다.

최소 보강: 요청·body 처리와 step 시간 상한을 둔다. 장기 개편: lane마다 deadline·retry·retention·receipt를 선언한다. 수용검사: 끝나지 않는 mock 응답에서도 정해진 시간 내 lane이 종료되고 정상 quotes/news가 게시 후보로 남아야 한다.

### DATA-05 · 중간 · ACT ON · E1/inferred — extended rebase 뒤 검증 입력 결속이 빠졌다

근거: `.github/workflows/refresh-screener.yml:343`, `:375`.

core는 후보 digest 기록과 staged/commit 검증, 충돌 후 재실행이 있지만 extended는 검증→commit→push 실패→rebase→push다. 검증과 push 사이에 core membership 또는 계약이 바뀌면 이전 입력으로 검증한 shard가 새 main과 결합된다. 이후 CI가 있으므로 ‘검증 없는 배포’라고 주장하지 않는다. 문제는 재배치된 조합의 사전 검증·원인 추적이 약하다는 것이다.

최소 보강: core membership·producer 입력 digest를 candidate에 포함하고 rebase 후 달라지면 재검증/재생성한다. 장기 개편: core와 extended release의 의존 revision을 manifest로 명시한다. 수용검사: main membership을 검증과 push 사이 바꾸는 경합 fixture에서 새로운 조합이 검증되기 전에는 후보 승격이 막혀야 한다.

### OPS-01 · 중간 · ACT ON · E2 — 배포하지 않은 성공이 이전 장애를 복구 처리한다

근거: `.github/workflows/operations-alert.yml:65`, `:66`, `:97`; `.github/workflows/pages-deploy.yml:178`, `:191` 부근의 main guard와 deploy 조건.

Pages는 main이 전진하면 deploy를 skip하고 workflow는 success일 수 있다. alert의 observedWork는 Refresh market data만 검사하며 Pages는 즉시 true다. 실제 workflow script에 success·배포 없음 fixture와 열린 Pages issue를 주입하자 recovered comment와 closed update가 요청됐다. 외부 GitHub에는 아무 요청도 보내지 않았다.

최소 보강: Pages/Worker도 실제 배포·smoke 또는 명시적인 already-converged receipt가 있을 때만 복구로 처리한다. 장기 개편: workflow conclusion 대신 `workPerformed`, `targetSha`, `observedLiveSha`, `health`, `reason`을 가진 운영 결과를 소비한다. 수용검사: stale skip은 issue 유지, 실제 성공한 smoke/수렴만 issue 종료. 예정된 skip을 새 실패로 취급하는 것도 금지한다.

### OPS-02 · 중간 · ACT ON · E2 — CI timeout을 수렴 실패로 전달하지 않는다

근거: `scripts/ensure-live-convergence.mjs:153`, `:209`, `:229`.

CI가 모두 끝났지만 conclusion이 timed_out인 경우 failure 문자열 비교에 걸리지 않는다. 실제 스크립트를 fetch만 대체한 별도 Node 프로세스로 실행했을 때 `UNATTESTED_REVISION`을 출력하고 exit 0이었다. 배포는 거부되므로 안전하지 않은 SHA를 배포하는 결함은 아니다. 운영 상위 workflow가 성공으로 보이고 실패 알림·복구 판단이 왜곡되는 문제다.

최소 보강: terminal unsuccessful 상태를 명시적으로 분류하고 cancelled/skipped와 분리한다. 장기 개편: 대기/취소/검증실패/시간초과/승인필요/수렴완료를 하나의 상태 모델로 정리한다. 수용검사: failure·timed_out·action_required는 실행 가능한 실패/주의 결과로, 아직 running은 대기로, 취소는 정책대로 구별되어야 한다.

## 5. 추가 설계 검토 사항

### ARCH-01 · CONSIDER · E1 — 배포 번들의 실행 증거를 CI attestation에 연결

Pages는 배포 job에서 classic minify, ESM chunk 생성, CSS bundle, HTML/SW rewriting을 수행한다. CI의 boot-bundle-budget는 동일 ESM 옵션을 사용하지만 크기/정적 도달성을 검사한다. 소스 기반 브라우저 검증을 배포된 bundle 전체 행동 검증으로 승격해서는 안 된다. 이번 검색에서 전체 staged Pages에 대한 전용 browser smoke 결속은 확인하지 못했다.

제안: exact source SHA에서 public dist를 한 번 생성하고 소규모 boot/route/lazy-import/SW update smoke를 돌린 뒤 dist digest를 attestation에 포함한다. 배포는 그 artifact를 소비한다. 전면 bundler 교체보다 현재 build-pages-bundle의 출력 검증을 추가하는 것이 작다. 대형 browser 전수 검사를 데이터 갱신마다 반복하라는 뜻은 아니다.

### ARCH-02 · CONSIDER · E1 — 축소 CI scope를 입력 문자열에서 실제 변경 계약으로

`ci.yml:66`, `:109`, `:216`은 origin으로 shard를 줄이고 public-data 및 일부 manifest/config를 제외한 source ancestry를 검사한다. 완전한 소스 CI 기반을 요구하는 보호는 있다. 다만 public-data 전체는 정적 지식·라우트·일부 소비 정책까지 포함하므로 ‘모든 public-data 변경이 동일 위험’이라는 전제는 오래 유지하기 어렵다.

제안: producer-owned 출력 allowlist와 schema/semantic 영향으로 reduced scope를 산출하고 attestation에 selected/excluded gates 및 기준 source SHA를 남긴다. 현재 축소 CI를 무조건 없애지 않는다. 최신 데이터가 browser 설치 지연 때문에 게시되지 않던 문제를 다시 만들지 않는 것이 수용조건이다.

### ARCH-03 · CONSIDER · E1 — 검증 키워드보다 경계 행동을 검사

이번에 QA/배포/운영 계약 게이트가 모두 통과한 상태에서도 의미 불일치와 운영 fixture 결함이 재현됐다. 토큰 존재 검사만 늘리면 이 종류를 잡지 못한다. 구조 게이트는 배선 누락을 잡는 용도로 유지하고, 입력 날짜 역행·전체 outage·timeout·skip·wrong evidence 같은 negative control을 실제 함수와 workflow adapter에 붙인다.

### ARCH-04 · CONSIDER · E1 — 운영 감시 범위와 검수 후보 실패의 연결

operations-alert는 8개 workflow를 감시한다. 13개 workflow 전체와는 다르며 calendar/universe/knowledge candidate 같은 검수 후보 경로는 별도다. 이것만으로 결함은 아니다. 다만 후보 생성이 장기간 실패해도 사람이 성공적으로 검수한 것처럼 방치되지 않도록 last successful review candidate와 due 상태를 운영 화면/기존 issue에 연결하는 보강을 검토한다. 별도 유료 관측 서비스나 SaaS 운영 체계를 도입할 필요는 없다.

## 6. 후속 구현 순서와 완료 기준

1. **관측 의미를 먼저 고정:** DATA-01/02와 값·날짜 결합 문제를 fixture로 동결한다. 기존 함수를 최소 수정한 후 narrative/AI context까지 같은 observation을 소비하는지 확인한다. 전체 데이터 schema 전환은 이 후에 점진적으로 진행한다.
2. **복구와 stale 판정:** DATA-03, client 초기 실패 복구, 보조 lane timeout을 처리한다. offline→online, 빈 초기 payload→정상 payload, 전 시장 동시 outage가 수용 시나리오다.
3. **AI 사실성:** 주장마다 실제 근거 연결 및 숫자 적합성 보강. 증거가 없을 때 일반 설명과 검증된 현재 사실을 분리하고 unsupported assertion은 보류한다.
4. **승격·운영 상태:** DATA-05, OPS-01/02, SHA identity 후보를 경합 fixture로 확인한 뒤 수정한다. succeeded와 converged를 같은 값으로 사용하지 않는다.
5. **검증 파이프라인:** dependency에서 impact coverage를 보강하고 의미 negative controls를 정규 gate에 등록한다. 최종 배포 dist smoke를 결속한다.
6. **장기 통합:** 관측 객체, lane receipt, release manifest, knowledge claim/evidence, QA dependency graph를 각각 단일 원본으로 관리한다. 기존 구조를 대체할 때만 중복 코드를 제거하고 먼저 전체 재작성하지 않는다.

각 배치는 구현자가 red fixture → 최소 수정 → 같은 fixture green → 영향 consumer 검사 → 독립 reviewer → 필요한 QA를 완료한다. 이후 버전/record-fix/생성 문서는 저장소 규칙대로 처리한다. 이번 보고서 번호는 감사 내부 ID이며 P/R 번호를 선점하지 않았다. 기능 삭제/통합이나 비용·공급자 변경은 별도 사용자 판단이 필요하다.

## 7. 증거 파일과 재실행

- `inventory.json`: 기준 파일 digest, 13개 workflow job/step, QA group/profile 목록.
- `checks.json`: 직접 실행한 7개 read-only 계약 게이트의 exit code·stdout·stderr.
- `reproduce-data.mjs` / `data-reproductions.json`: 실제 함수로 DATA-01/02/03 재현.
- `reproduce-operations.mjs`: 실제 GitHub script에 API fixture를 주입해 OPS-01 재현. 모든 API는 mock이다.
- `reproduce-convergence.mjs` / `reproductions.json`: 실제 별도 Node 프로세스에서 OPS-02 exit code 확인. 외부 fetch는 mock이다.

재현 스크립트는 저장소 루트에서 실행하며 출력 JSON만 이 보고서 폴더에 쓴다. production source나 public-data를 쓰지 않는다. defect 재현의 exit 0은 ‘결함 조건이 재현됨’을 뜻하며 정상 제품 인증이 아니다.

## 8. 미검증·차단·권한 상태

외부 공급자 최신 응답, GitHub Actions 실제 동시 실행, Cloudflare secret/DO/KV provisioning·실청구, 실제 공개 페이지·캐시 업데이트, 전 route DOM, SEC/13F 모든 form/단위/amendment와 factor 수식 전수 검증은 수행하지 않았다. 인증·네트워크 실패 때문에 시도하다 막힌 것이 아니라 읽기 전용 범위에서 해당 생산·배포 동작을 실행하지 않은 것이다.

기존 dirty 파일과 이 감사 사이의 변경 구분은 마지막 `scope-check.json`으로 확인한다. 다른 세션이 작업 트리를 바꾸면 그 파일은 본 감사의 수정으로 취급하지 않으며 해당 근거를 재확인해야 한다. 커밋·push·배포는 없었다.
