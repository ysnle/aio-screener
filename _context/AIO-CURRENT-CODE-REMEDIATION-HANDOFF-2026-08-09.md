---
verified_by: Codex
last_verified: 2026-08-10
confidence: high for repository structure and static code findings; live/operator state not re-certified
target_version: v53.97-local
status: VERIFIED_LOCAL
implementation_authorized: true
source_archive_sha256: 523C3B77E24094A1A70C91F214BDA815FC045BE41ABF46DC2026C840278102B4
---

# AIO 현재형 코드 개선 핸드오프

## 0. 결론

`AIO_Codex_Architecture_Handoff.zip`의 15개 파일은 **문제 영역을 넓게 잡은 기획 재료로는 가치가 있다.** 그러나 현재 저장소에 바로 투입할 실행 패키지로는 부적합하다.

핵심 이유는 다음과 같다.

1. 패키지는 `v53.21`, 17-route, 미완성 renderer 전환을 기준으로 작성됐다.
2. 현재 로컬은 `v53.96`, 20-route이며 lifecycle/primary renderer/data owner는 20/20이다.
3. `SEC-001`, `FAST-001`, `ARCH-001` 등은 이미 해결됐거나 목적이 바뀌었다.
4. 실제로 남은 P0는 테스트 그룹 예외가 성공으로 숨을 수 있는 문제와 브라우저 런타임 오류가 CI 실패로 연결되지 않는 문제다.
5. 패키지의 `machine/work-packets.json`은 존재하지 않는 `BASE-001`에 의존해 기계 실행 그래프가 처음부터 끊긴다.

따라서 이 문서는 기존 15개 파일을 대체 실행하지 않고, **현재 코드에 남은 가치 있는 작업만 보존·재범위화한 실행 설계 SSOT**다. 이 문서 작성은 구현, 버전 상승, 커밋, 배포를 의미하지 않는다.

---

## 1. 권위와 사용법

### 1.1 현재 권위 순서

1. 실제 코드와 생성 artifact
2. 현재 CI/검증 스크립트 결과
3. `architecture/route-owners.json`, `architecture/retirement-manifest.json`, `public-data/operations-status.json`
4. 이 문서의 현재형 작업 패킷
5. ZIP의 15개 원본 문서와 과거 `_context` 핸드오프

충돌하면 상위 항목을 따른다. ZIP의 작업 ID나 완료 판정을 현재 코드 위에 덮어쓰지 않는다.

### 1.2 상태 어휘

| 상태 | 의미 |
|---|---|
| `DESIGNED` | 파일·변경·게이트가 설계됨. 구현되지 않음 |
| `IMPLEMENTED_LOCAL` | 로컬 코드가 변경됨. 전체 검증 전 |
| `VERIFIED_LOCAL` | 지정 정적/동작 게이트 통과 |
| `VERIFIED_LIVE` | 배포 revision과 공개 동작까지 확인 |
| `CERTIFIED_OPERATOR` | 자격증명·권리·장기 SLO 등 운영자 증거까지 확인 |
| `BLOCKED_DECISION` | 코드가 아니라 사용자/운영자 결정이 먼저 필요 |

모든 신규 패킷의 초기 상태는 `DESIGNED`다.

---

## 2. 원본 패키지 무결성과 진단 품질

### 2.1 구성

ZIP SHA-256:

`523C3B77E24094A1A70C91F214BDA815FC045BE41ABF46DC2026C840278102B4`

총 15개 파일:

- 사람용 문서 12개: `README`, master prompt, issue register, target architecture, roadmap, work packets, data/AI, security/privacy, QA/SRE/release, acceptance, file map, combined master
- 기계용 자료 3개: `architecture-target.json`, `risk-register.csv`, `work-packets.json`

### 2.2 품질 판정

| 축 | 판정 | 근거 |
|---|---|---|
| 문제 영역 포괄성 | 좋음 | QA, 데이터, AI, 보안, SRE, 아키텍처를 함께 다룸 |
| 구조적 방향 | 대체로 유효 | canonical evidence, ownership, fail-closed, SLO, 점진 분해 방향은 현재 프로젝트와 정합 |
| 현재성 | 낮음 | `v53.21`, 17-route, 과거 SEC/renderer 상태를 고정 |
| 코드 근거 정확도 | 혼합 | QA/AI/Worker 지적은 유효하지만 완료 항목과 현재 수치를 오인 |
| 실행 가능성 | 낮음 | `BASE-001` 미정의, 사람/기계 문서 불일치, 운영자 조건 혼합 |
| 안전성 | 보완 필요 | 완료된 secret 복구를 P0로 강제하고 전 파일 광역 읽기를 요구 |

최종 판정: **진단 소재는 보존할 가치가 있으나, 실행 원장으로는 반드시 현재형 재조정이 필요하다.**

### 2.3 원본 패키지의 구체적 결함

1. `machine/work-packets.json`의 `SEC-001`, `QA-001`이 미정의 `BASE-001`에 의존한다.
2. `REL-001`이 `v53.21` 정렬을 요구해 현재 `v53.96`과 충돌한다.
3. 17 routes를 하드코딩한다. 현재 지원 route는 20개다.
4. 모든 route가 lifecycle/data/renderer/chart/narrative를 전부 `native`로 가져야 한다고 가정한다. 차트나 narrative가 본질적으로 없는 route에는 `not-applicable`이 필요하다.
5. `ARCH-001`은 “남은 renderer 2개”를 전제로 하지만 현재 primary renderer는 20/20이다.
6. `SEC-001`은 IndexedDB key backup 복구를 전제로 하지만 현재 코드는 해당 backup DB를 삭제하고 runtime gate가 재도입을 금지한다.
7. `FAST-001`은 fast plane 신규 구축을 전제로 하지만 현재 health는 16/16이다. 남은 것은 장기 soak와 권리/운영 증거다.
8. SEC fundamentals를 매우 낮은 초기 coverage로 취급하지만 현재 artifact는 539/655, 82.3%다.
9. master prompt는 `_context/RULES.md`, postmortem, QA, code map 등을 광역으로 전부 읽도록 지시해 현재의 작업별 라우팅·부분 읽기 원칙과 충돌한다.
10. local code gate와 자격증명·provider rights·7/30-day soak 같은 operator gate가 같은 acceptance로 섞여 있다.
11. combined master는 05/06/07/09의 상세 내용을 완전히 포함하지 않아 단일 통합본으로 신뢰할 수 없다.

---

## 3. 현재 저장소 기준선

### 3.1 revision 경계

| 항목 | 현재 사실 | 판정 |
|---|---|---|
| branch / HEAD | `main` / `8d893f1` | origin/main과 동일 commit |
| local version | `v53.96` | 기존 skill-system 변경이 미커밋 상태 |
| release/operations revision | `v53.95` | 현재 로컬 version과 불일치 |
| worktree | 다수의 기존 수정 존재 | 이 문서 작업과 분리 보존 필요 |

`v53.96` 대 `v53.95` 불일치는 이 설계 문서가 만든 것이 아니다. 향후 구현·릴리스 패킷에서 기존 미커밋 변경 전체의 범위를 확정한 뒤 일괄 정렬해야 한다.

### 3.2 이미 완료된 기반

| 영역 | 현재 근거 | 해석 |
|---|---|---|
| secret backup | `js/aio-core.js:16425-16443`, `scripts/ci-runtime-contract-check.mjs` | IndexedDB backup은 폐기·삭제되고 재도입 방지됨 |
| route lifecycle | `architecture/retirement-manifest.json:15-36` | 20/20 native |
| primary renderer | `architecture/retirement-manifest.json:37-58` | 20/20 native |
| route data owner | `public-data/operations-status.json:201-221` | 20/20 native |
| fast plane | `public-data/operations-status.json:29-52` | health 16/16, soak 0/7 |
| SEC fundamentals | `public-data/operations-status.json:96-102` | 539/655, 82.3% |
| AI foundations | `src/ai/`, AI reliability/intelligence gates | planner, evidence/claim/validator 기반 존재 |
| boot SLO | `architecture/operations-slo.json` | 최신 로컬 측정은 target compliant |
| supply-chain CI | Actions SHA pin + `npm ci`/lockfile | 과거 Actions/npm 우려는 핵심 blocker 아님 |

### 3.3 현재 남은 확정 결함

| ID | 코드 근거 | 영향 |
|---|---|---|
| F-01 | `js/aio-tests.js:8794-8922` | 106개 그룹의 예외가 `console.error`로만 남고 `fail/allPass`에 반영되지 않을 수 있음 |
| F-02 | `scripts/ci-headless-tests.mjs:57-63,101-110` | page/console error를 출력하지만 unexpected test failure가 없으면 exit 0 가능 |
| F-03 | `scripts/fetch-data.mjs:2032,2073` | 서버 시장 분석이 뉴스 제목 8개와 첫 비어 있지 않은 줄을 one-line으로 사용 |
| F-04 | `public-data/operations-status.json:60-68` | scheduled market analysis가 현재 `BLOCKED`, `marketAnalysisOk:false` |
| F-05 | `cloudflare-worker-proxy.js:305-307` | KV get→put quota 예약이 원자적이지 않아 동시 요청에서 cap 초과 가능 |
| F-06 | `cloudflare-worker-proxy.js:51-54,177-178,279-280` | 허용 목록은 무포트 localhost인데 실제 dev origin은 포트를 포함해 불일치 가능 |
| F-07 | `architecture/route-owners.json` | 필드값과 일부 notes가 서로 모순되고 chart/narrative의 `not-applicable` 표현이 없음 |
| F-08 | `public-data/operations-status.json:41-51,83-102` | fast soak 0/7, provider rights review가 남음 |
| F-09 | `architecture/operations-slo.json` | 로컬 boot는 통과하지만 30-day/live certification은 미완료 |

---

## 4. 원본 15개 작업 패킷 재분류

| 원본 ID | 현재 판정 | 현재형 처리 |
|---|---|---|
| `SEC-001` | 완료된 과거 문제 + 정책 결정 잔여 | 코드 복구 금지. `DEC-SECRET-01`로 분리 |
| `QA-001` | 그대로 유효한 P0 | `CR-QA-01`로 승계 |
| `QA-002` | 그대로 유효한 P0 | `CR-QA-02`로 승계 |
| `REL-001` | 버전·의존성 stale | 마지막 release closure인 `CR-REL-01`로 재설계 |
| `DATA-001` | 기반 대부분 구현 | 잔여 직접 fetch/selector 우회만 `CR-DATA-01`로 감사·수렴 |
| `TIME-001` | 기반 존재 | calendar/DST/holiday fixture 보강인 `CR-TIME-01`로 축소 |
| `FAST-001` | 신규 구축은 완료 | 새 plane 구축 금지. `CR-OPS-01` soak/상태 증거로 전환 |
| `OPS-001` | 방향 유효 | `CR-OPS-01`로 승계하되 operator 단계 분리 |
| `ARCH-001` | primary renderer 기준으로 폐기 | secondary owner ledger 정합성인 `CR-ARCH-01`로 대체 |
| `ARCH-002` | 일부 유효 | chart/narrative `native/legacy/not-applicable`와 writer 증거로 재설계 |
| `DATA-002` | 유효 | `CR-FUND-01`로 승계 |
| `MODEL-001` | 유효 | `CR-MODEL-01`로 승계 |
| `AI-001` | 유효하나 greenfield 아님 | 기존 `src/ai` 재사용형 `CR-AI-01`로 재설계 |
| `SEC-002` | 유효하나 hosting 조건부 | `CR-CSP-01` + operator edge verification으로 분리 |
| `ARCH-003` | 방향 유효, 수치 기준은 임의 | 측정 기반 `CR-DECOMP-01`로 재설계 |

---

## 5. 실행 원칙

1. **P0 truth gate를 먼저 고친다.** 테스트가 거짓 성공할 수 있는 상태에서 대규모 아키텍처 변경을 시작하지 않는다.
2. **현재 존재하는 기반을 재사용한다.** Evidence/Claim/AI/route plane을 새로 만들지 않는다.
3. **primary와 secondary ownership을 분리한다.** primary 20/20 완료를 되돌리지 않고 남은 chart/narrative/legacy fallback만 좁게 다룬다.
4. **`not-applicable`을 정상 상태로 허용한다.** 모든 route에 억지 chart/narrative를 만들지 않는다.
5. **한 패킷에서 새 owner와 구 owner 삭제를 함께 처리한다.** 이중 writer 과도기를 완료로 기록하지 않는다.
6. **정적 문자열 검사는 최소 ratchet로만 쓴다.** 핵심 인수는 fixture와 Chromium 동작 검증으로 닫는다.
7. **운영자 상태를 코드 PASS로 승격하지 않는다.** secret, rights, edge headers, live deploy, 장기 soak는 별도 증거를 요구한다.
8. **`index.html` 전체를 읽거나 재작성하지 않는다.** `CODE-MAP.md`로 해당 범위만 패치한다.
9. **구현 시에만 프로젝트 환류를 적용한다.** 버그는 postmortem/QA/rule, 코드는 버전 일괄 동기화, 구조 이동은 code map 재스캔을 수행한다.

---

## 6. 우선순위와 실행 파동

```text
Wave 0: CR-QA-01 -> CR-QA-02 -> CR-BASE-01
                           |             |
Wave 1:                   CR-WORKER-01  CR-DATA-01 -> CR-AI-01
                                           |
Wave 2:                  CR-ARCH-01      CR-TIME-01 -> CR-FUND-01
                           |                                |
Wave 3:                  CR-CSP-01      CR-MODEL-01         CR-OPS-01
                           |
                         CR-DECOMP-01

선택한 구현 묶음 완료 후: CR-REL-01
운영자/사용자 결정: DEC-SECRET-01, DEC-RIGHTS-01, DEC-LIVE-01
```

`CR-WORKER-01`과 `CR-DATA-01`은 Wave 0 완료 후 병렬 가능하다. 그 외에는 명시 의존성을 지킨다.

### 6.1 가치/비용 요약

| 패킷 | 가치 | 비용 | 우선순위 | 지금 할 가치 |
|---|---:|---:|---:|---|
| CR-QA-01 | 매우 높음 | 중 | P0 | 즉시 |
| CR-QA-02 | 매우 높음 | 낮음~중 | P0 | 즉시 |
| CR-BASE-01 | 높음 | 낮음 | P0 | 즉시 |
| CR-AI-01 | 높음 | 중 | P1 | 즉시 후속 |
| CR-WORKER-01 | 높음 | 중~높음 | P1 | 공유 AI를 운영할 때 필수 |
| CR-DATA-01 | 높음 | 중 | P1 | 현재 기반의 실질 수렴 |
| CR-ARCH-01 | 높음 | 중 | P1 | 진척 회계 신뢰성 확보 |
| CR-TIME-01 | 중~높음 | 중 | P1 | stale/시장상태 오판 방지 |
| CR-FUND-01 | 높음 | 중~높음 | P1 | coverage보다 품질 개선 |
| CR-MODEL-01 | 매우 높음 | 높음 | P1 | 투자 모델 주장 검증에 필수 |
| CR-CSP-01 | 높음 | 높음 | P2 | hosting 경계 결정 후 |
| CR-DECOMP-01 | 중~높음 | 높음 | P2 | hotspot 측정 후만 |
| CR-OPS-01 | 높음 | 중 + 시간 | P1/P2 | 코드와 운영자 단계를 분리해 진행 |
| CR-REL-01 | 높음 | 낮음 | release | 선택 패킷 완료 후 |

---

## 7. 코드 작업 패킷

### CR-QA-01 — 테스트 그룹 예외를 실패로 승격

- 상태: `DESIGNED`
- 의존성: 없음
- 목표: 그룹 함수가 throw하면 해당 그룹과 전체 run을 실패시킨다.
- 주요 파일: `js/aio-tests.js`, `scripts/ci-headless-tests.mjs`, 필요 시 신규 runner gate
- 설계:
  1. 106개 수동 `try/catch` 나열을 `{ id, name, run }` registry로 바꾼다.
  2. `runGroup()`이 시작/완료/예외를 구조화해 `groupResults`에 기록한다.
  3. 예외마다 synthetic failed assertion을 추가하고 `fail`, `allPass`, `exceptions`에 반영한다.
  4. `plannedGroups === completedGroups + exceptionGroups`를 강제한다.
  5. 중복 group ID와 assertion ID를 실패시킨다.
  6. sentinel 그룹이 의도적으로 throw하는 self-test를 제공해 거짓 성공 회귀를 막는다.
- 인수 조건:
  - 예외 주입 시 process exit 1.
  - 이후 그룹은 계속 실행하되 최종 `allPass:false`.
  - 정상 run의 기존 assertion 결과와 순서를 보존.
  - 그룹 수를 코드 상수로 복제하지 않고 registry에서 파생.
- 금지: 예외를 skip-list에 넣거나 `console.error`만 추가해 통과시키기.

### CR-QA-02 — 브라우저 런타임 오류를 release blocker로 연결

- 상태: `DESIGNED`
- 의존성: CR-QA-01
- 목표: unexpected `pageerror`, `console.error`, unhandled rejection을 exit 1로 만든다.
- 주요 파일: `scripts/ci-headless-tests.mjs`, `.github/workflows/ci.yml`, 필요 시 `architecture/browser-error-allowlist.json`
- 설계:
  1. test assertion failure와 browser runtime failure를 별도 배열로 수집한다.
  2. 외부 요청 차단은 `requestfailed` 이벤트와 harness가 abort한 URL로 식별한다.
  3. broad regex `net::ERR_FAILED` 무시는 제거한다.
  4. allowlist는 `id`, `scope`, `pattern`, `reason`, `owner`, `expiresAt`을 요구한다.
  5. 만료·미사용 allowlist 항목도 실패 또는 명시 WARN으로 만든다.
  6. CI summary에 assertions/runtime/expected-blocked-network를 분리한다.
- 인수 조건:
  - fixture `pageerror` 또는 `console.error` 1건이면 exit 1.
  - harness가 의도적으로 abort한 외부 요청만 비차단 분류.
  - allowlist 없는 unexpected error 0.

### CR-BASE-01 — 현재형 baseline/작업 그래프 정합성 gate

- 상태: `DESIGNED`
- 의존성: CR-QA-01, CR-QA-02
- 목표: stale route/version/미정의 dependency가 다시 실행 원장으로 승격되지 못하게 한다.
- 주요 파일: architecture owner/retirement manifest, operations status, 기존 architecture/operations gates
- 설계:
  1. supported route set을 단일 manifest에서 파생한다.
  2. dependency는 선언된 packet ID 또는 명시 external gate만 참조한다.
  3. baseline에 `observedRevision`, `observedAt`, `source`를 기록한다.
  4. local/release/live revision을 분리한다.
  5. stale artifact와 operator-required를 구분한다.
- 인수 조건:
  - 미정의 dependency fixture가 실패한다.
  - route 추가/삭제 시 복수 하드코딩 없이 파생된다.
  - local/release/live가 다르면 동일하다고 표시하지 않는다.

### CR-DATA-01 — canonical evidence selector 잔여 우회 수렴

- 상태: `DESIGNED`
- 의존성: CR-BASE-01
- 목표: Tier-0 지표의 browser/server/fast 경로가 같은 evidence identity를 선택하게 한다.
- 주요 파일: `src/data/`, `src/state/`, `src/domain/`, `scripts/fetch-data.mjs`, 관련 compatibility adapter
- 설계:
  1. browser direct provider orchestration 또는 raw global을 읽는 Tier-0 consumer를 inventory한다.
  2. `value/unit/observedAt/collectedAt/source/sourceKind/evidenceId/allowedUse/status`를 보장한다.
  3. selector가 freshness/quality/rights를 함께 평가하고 missing을 숫자로 대체하지 않는다.
  4. compatibility adapter는 projection만 담당하며 새 fetch를 시작하지 않는다.
  5. server/fast/browser 동일 fixture에 같은 selected evidenceId를 기대한다.
- 인수 조건:
  - Tier-0 direct-fetch inventory가 0 또는 승인된 BYOK 예외만 남는다.
  - source 불일치가 reconciliation 상태로 노출된다.
  - cache/LKG가 원 관측시각을 보존한다.

### CR-AI-01 — scheduled market analysis를 기존 검증 파이프라인에 연결

- 상태: `DESIGNED`
- 의존성: CR-DATA-01, CR-QA-01
- 목표: 뉴스 제목 8개 기반 자유 서술을 구조화된 evidence-grounded brief로 대체한다.
- 주요 파일: `scripts/fetch-data.mjs`, `src/ai/question-planner.js`, `claim-ledger.js`, `evidence-graph.js`, `answer-orchestrator.js`, `output-validators.js`
- 설계:
  1. `genMarketAnalysis`를 독립 모듈/순수 orchestration으로 추출한다.
  2. 입력은 canonical market evidence와 중복 제거된 news cluster다.
  3. 출력은 `summary/regime/drivers/risks/watch/claims/evidenceIds/generatedAt/model/validatorVersion` 구조다.
  4. 숫자·단위·방향·asOf·인과 문장은 ClaimLedger와 validator를 통과한다.
  5. `oneLine`은 첫 markdown 줄이 아니라 검증된 `summary`에서 생성한다.
  6. 실패 시 `marketAnalysisOk:false`와 deterministic evidence summary를 게시한다.
- fixture: markdown heading 첫 줄, 제목만 인과 주장, stale evidence, 중복 기사, timeout/빈 응답/schema 불일치.
- 인수 조건:
  - 검증되지 않은 prose가 `verified`로 게시되지 않는다.
  - 모든 수치 claim이 evidenceId와 결속한다.
  - fallback도 동일 output schema를 만족한다.

### CR-WORKER-01 — 공유 AI quota 원자성 + dev origin 계약

- 상태: `DESIGNED`
- 의존성: CR-QA-02
- 목표: 동시 요청에서 일일 cap을 넘지 않고 개발 origin과 production allowlist를 분리한다.
- 주요 파일: `cloudflare-worker-proxy.js`, `scripts/ci-worker-anthropic-check.mjs`, Worker 설정/문서
- 설계:
  1. KV get→put을 quota source of truth로 쓰지 않는다.
  2. Durable Object 또는 동등한 단일 writer/transaction primitive로 reserve/commit/release를 구현한다.
  3. provider 실패 rollback과 idempotency key를 명시한다.
  4. production은 exact HTTPS allowlist만 허용한다.
  5. localhost/127.0.0.1은 dev mode의 hostname+port 정책으로만 허용한다.
  6. CORS origin은 검증된 origin만 echo한다.
- 인수 조건:
  - cap N에 N+K 동시 요청을 넣어도 provider dispatch는 N 이하.
  - quota backend 미설정 시 fail-closed 유지.
  - null/lookalike/미허용 origin 차단, dev port는 명시 설정에서만 통과.
- 운영자 경계: binding과 Worker 배포는 `DEC-LIVE-01` 승인 후.

### CR-ARCH-01 — secondary ownership ledger 정합성

- 상태: `DESIGNED`
- 의존성: CR-BASE-01
- 목표: primary 20/20 완료를 보존하면서 chart/narrative/fallback owner를 증거 기반으로 관리한다.
- 주요 파일: `architecture/route-owners.json`, retirement manifest, architecture/retirement gates
- 설계:
  1. owner enum을 `native | legacy | not-applicable`로 정의한다.
  2. `native`에는 module, sinks/canvases, legacy fence/deletion evidence를 요구한다.
  3. `legacy`에는 exact writer/function과 종료 packet을 요구한다.
  4. `not-applicable`에는 route contract상 불필요한 근거를 요구한다.
  5. fields와 notes가 모순되면 실패한다.
  6. primary 완료와 secondary debt를 별도 집계한다.
- 인수 조건:
  - 20 routes × 5 dimensions가 모두 유효 enum.
  - notes/필드 모순 0, 이중 writer 0, route leave 후 write 0, chart growth 0.
  - 불필요한 route에 가짜 chart/narrative를 추가하지 않는다.

### CR-TIME-01 — 시장 시간/달력 경계 인증

- 상태: `DESIGNED`
- 의존성: CR-DATA-01
- 목표: 기존 session/freshness 로직을 NYSE/KRX 휴일·DST·주말·장전/장후 fixture로 인증한다.
- 주요 파일: 기존 market session/time module, 관련 selector와 tests
- 설계:
  1. `eventTime/observedAt/collectedAt/publishedAt`을 분리한다.
  2. NYSE와 KRX calendar adapter를 분리한다.
  3. DST 전환일과 half-day를 fixture로 고정한다.
  4. 폐장 중 stale과 다음 세션 대기를 구분한다.
  5. calendar source가 없으면 `UNKNOWN`으로 fail closed한다.
- 인수 조건: 주말, DST 시작/종료, 미국/한국 휴일, half-day, 장전/장후 fixture가 통과한다.

### CR-FUND-01 — fundamentals anomaly quarantine와 applicability

- 상태: `DESIGNED`
- 의존성: CR-DATA-01, CR-TIME-01
- 목표: coverage 비율만 올리지 않고 잘못된 filing/분모/단위/기업 유형을 격리한다.
- 주요 파일: `scripts/fetch-data.mjs`, SEC/fundamentals normalize 모듈, screener/public-data schema와 tests
- 설계:
  1. 일반 기업, 금융, REIT, 외국발행사, ETF/펀드, 비신고 대상을 분류한다.
  2. filing period/form/amendment/currency/scale/taxonomy tag를 보존한다.
  3. impossible margin, sign inversion, stale filing, duplicate accession, unit mismatch를 quarantine한다.
  4. `missing/not-applicable/quarantined/current`를 분리한다.
  5. coverage는 eligible 분모와 category별 분포를 함께 공개한다.
- 인수 조건: anomaly가 UI/ranking으로 승격되지 않고 quarantine reason과 source filing을 추적할 수 있다.

### CR-MODEL-01 — screener walk-forward/PIT 검증

- 상태: `DESIGNED`
- 의존성: CR-FUND-01, CR-TIME-01
- 목표: ranking model의 예측력이 샘플·생존편향·비용 통제 후에도 존재하는지 검증한다.
- 주요 파일: `scripts/backtest-*.mjs`, `src/domain/signal/`, 검증 fixture/artifact
- 설계:
  1. point-in-time universe와 filing availability lag를 사용한다.
  2. chronological walk-forward/holdout, turnover, 비용, liquidity filter를 포함한다.
  3. factor별 IC/ICIR/hit rate/decile spread/drawdown/bootstrap CI를 기록한다.
  4. live score와 backtest 함수의 golden parity를 강제한다.
  5. 기준 전에는 `research-relative-ranking-only`를 유지한다.
- 인수 조건: look-ahead/survivorship fixture가 실패를 탐지하고 비용 전/후 성과와 표본 수를 공개한다.

### CR-CSP-01 — trusted rendering ratchet와 실제 배포 경계

- 상태: `DESIGNED`
- 의존성: CR-QA-02, CR-ARCH-01
- 목표: 동적 HTML sink를 줄이고 실제 호스팅에서 검증 가능한 CSP로 수렴한다.
- 주요 파일: `_headers`, CODE-MAP으로 지정한 HTML/JS sink 범위, unsafe-sink inventory/gate
- 설계:
  1. sink를 trusted static template, escaped text, sanitized markdown으로 분류한다.
  2. 현재 baseline을 고정하고 신규 unsafe sink를 차단하는 감소 ratchet를 둔다.
  3. 사용자/외부/AI 문자열은 text node 또는 검증 sanitizer만 사용한다.
  4. inline handler/style/script 의존성을 패킷별로 제거한다.
  5. GitHub Pages의 `_headers` 파일 존재만으로 CSP 적용을 주장하지 않는다.
  6. report-only 가능한 edge/hosting을 정한 뒤 enforcement로 승격한다.
- 인수 조건: DOM XSS fixture 차단, 신규 unsafe sink 0, baseline 감소, 공개 응답 header 일치 시에만 `VERIFIED_LIVE`.

### CR-DECOMP-01 — 측정 기반 monolith 분해

- 상태: `DESIGNED`
- 의존성: CR-ARCH-01, CR-CSP-01
- 목표: 파일 크기 자체가 아니라 변경 위험과 중복 owner를 줄인다.
- 주요 파일: CODE-MAP 지정 HTML 범위, `js/aio-core.js`, `js/aio-data.js`, `js/aio-ui.js`, `scripts/fetch-data.mjs`, `src/`
- 후보: `genMarketAnalysis`, direct provider orchestration 상위 hotspot, global write+DOM sink+storage가 결합된 고변경 함수.
- 설계:
  1. churn, complexity, global writes, DOM sinks, direct storage/fetch, duplicates를 점수화한다.
  2. 한 패킷은 한 bounded owner만 이동한다.
  3. 새 module과 구 body 삭제를 같은 패킷에서 끝낸다.
  4. facade를 영구 복제 구현으로 두지 않는다.
  5. 10KB/300줄/1000줄 같은 임의 기준만으로 분해하지 않는다.
- 인수 조건: behavior parity, duplicate owner/global write 감소, dead code 0, ±500줄이면 CODE-MAP 재스캔.

### CR-OPS-01 — soak/SLO artifact와 운영 상태 분리

- 상태: `DESIGNED`
- 의존성: CR-TIME-01; 공유 AI 범위는 CR-WORKER-01
- 목표: 이미 존재하는 fast plane을 새로 만들지 않고 실제 지속성·오류 상태를 증명한다.
- 주요 파일: operations status builder, `architecture/operations-slo.json`, watchdog/workflow, operations status artifact
- 설계:
  1. `NOT_CONFIGURED/CONFIGURED_HEALTHY/CONFIGURED_BROKEN/STALE/RIGHTS_REVIEW_REQUIRED`를 분리한다.
  2. 7일 fast soak와 30일 artifact/watchdog SLO를 rolling artifact로 생성한다.
  3. success rate, p95 age, consecutive failure, alert dedupe, last recovery를 기록한다.
  4. live revision과 data revision을 별도로 확인한다.
  5. 운영자 증거가 없으면 local fixture를 live healthy로 승격하지 않는다.
- 인수 조건: synthetic failure/recovery/dedupe fixture 통과, 기간 경과 전 operator certification 금지.

### CR-REL-01 — 선택 구현 묶음의 release closure

- 상태: `DESIGNED`
- 의존성: 사용자가 승인해 실제 구현한 모든 패킷
- 목표: local app, generated artifacts, release manifest, SW, cachebuster, docs를 한 revision으로 정렬한다.
- 설계:
  1. 기존 미커밋 skill-system 변경과 새 패킷의 release 범위를 먼저 확정한다.
  2. `scripts/bump-version.mjs`로만 버전을 일괄 상승한다.
  3. release/architecture/operations artifact를 재생성한다.
  4. 범위에 맞는 static/unit/headless/route/security/data/AI/doc gates를 실행한다.
  5. 사용자 요청 없이는 commit/push/deploy하지 않는다.
- 인수 조건: version/release/operations/SW/cachebuster parity, 선택 패킷 모두 `VERIFIED_LOCAL`, operator/live 상태 분리.

---

## 8. 코드보다 결정이 먼저인 항목

### DEC-SECRET-01 — PIN 미사용 시 개인 키 보존 정책

- backup DB 취약점은 재도입하지 않는다.
- 선택지는 session-only, 명시적 plaintext opt-in, PIN 암호화 저장이다.
- 기본값 변경은 사용자 경험과 데이터 손실 위험이 있어 제품 결정 없이 자동 적용하지 않는다.
- 결정 후 UI disclosure, migration, delete, wrong-PIN, reload E2E를 함께 설계한다.

### DEC-RIGHTS-01 — provider 재배포/상업 이용 권리

- 공급자별 수집, 저장, 재배포, 파생값, 보존기간을 사람 검토로 확정한다.
- 코드는 rights metadata와 차단 상태를 표현할 수 있지만 법적 허용을 스스로 인증할 수 없다.

### DEC-LIVE-01 — Worker/edge/Pages 운영 권한

- binding, secret, cron, public Worker deploy, CSP edge 적용, live revision 확인은 운영자 권한이 필요하다.
- 로컬 구현과 실제 배포를 같은 패킷으로 완료 처리하지 않는다.

---

## 9. 지금 하지 않을 작업

1. IndexedDB secret backup 복구.
2. primary renderer 20개를 다시 전환하는 작업.
3. fast quote plane의 greenfield 재구축.
4. 기존 `src/ai` 기반을 무시한 AI 전면 재작성.
5. 모든 route에 chart/narrative를 억지로 추가.
6. 파일 크기 임계치만을 근거로 한 대량 분할.
7. local PASS만으로 provider rights, 장기 SLO, CSP live 적용을 완료 선언.
8. 이 설계 문서만으로 버전 상승·커밋·배포.

---

## 10. 후속 에이전트용 실행 계약

1. 이 문서에서 **한 패킷 ID**를 선택한다.
2. `git status --short`, version, HEAD, origin/main, 관련 artifact revision을 기록한다.
3. 작업 유형에 맞는 `_context`와 CODE-MAP의 해당 범위만 읽는다.
4. 코드 수정 전에 실패를 fixture 또는 재현으로 증명한다.
5. 최소 patch로 구현하고 구 owner/dead path를 같은 패킷에서 제거한다.
6. 패킷 인수 조건과 프로젝트 공통 gate를 실행한다.
7. 버그면 postmortem/QA/rule에 환류하고 예방 gate로 닫는다.
8. 코드 변경이면 `scripts/bump-version.mjs`로 버전을 동기화한다.
9. live/operator 증거 없이는 `VERIFIED_LOCAL`보다 높게 기록하지 않는다.
10. 사용자 요청 없이는 commit/push/deploy하지 않는다.

세션 종료 보고 형식:

```text
Packet: CR-...
Before: revision / failing fixture
Changed: exact files and owner boundary
Deleted: old writer/fetch/storage path
Verification: command -> result
Residual: local / live / operator / decision
Status: IMPLEMENTED_LOCAL | VERIFIED_LOCAL | BLOCKED_DECISION
```

---

## 11. 전체 인수 기준

- 테스트 그룹 throw가 실패로 집계되고 sentinel fixture가 이를 증명한다.
- unexpected browser runtime error가 CI exit 1로 연결된다.
- work packet dependency에 미정의 ID가 없다.
- 지원 route 수가 단일 source에서 파생된다.
- 20 routes의 5 owner 차원이 정합하고 이중 writer가 없다.
- Tier-0 evidence selector 우회가 0 또는 승인 예외만 남는다.
- scheduled market analysis claim이 evidence와 결속하거나 fail closed한다.
- shared AI quota가 동시성 fixture에서 cap을 넘지 않는다.
- market time/calendar 경계 fixture가 통과한다.
- fundamentals anomaly가 quarantine되고 applicability가 분리된다.
- screener는 PIT/walk-forward/비용 통제 전 predictive claim을 하지 않는다.
- unsafe HTML sink는 신규 0, baseline 단조 감소다.
- monolith 분해는 duplicate owner/global write/dead code 감소를 증명한다.
- local/release/live/operator 상태가 서로 섞이지 않는다.
- version/release/SW/cachebuster/docs가 선택 release에서 동기화된다.
- rights, live Worker/CSP, 7/30-day SLO는 실제 운영자 증거가 있을 때만 완료다.

현재 상태: **설계 완료, 구현 미착수. 첫 실행 패킷은 `CR-QA-01`이다.**
