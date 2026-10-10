# 운영 구조 개선 작업과 인계

기준: 2026-10-10. 기존 운영 실측은 [OPERATIONS-AI-REVIEW.md](./OPERATIONS-AI-REVIEW.md), 사용자 원문은 [REQUEST-CONTEXT.md](./REQUEST-CONTEXT.md)를 함께 읽는다. 아래는 추가 코드 작업이며 기존 프론트엔드 감사 220개 관찰 기록의 완료 판정을 바꾸지 않는다.

## 소유권과 실행 경계

- Claude가 수정 중인 index.html, js/aio-data.js, src/domain 및 src/ui 변경은 사용자 소유다. 운영 변경은 `.cache/operations-worktree`, `codex/operations-quality-20261010`에 먼저 격리했다. 기준 SHA `de0079c07823b97c3e22e183508985fb75338b03`, 기준 버전 v57.31이다.
- 프론트엔드 변경을 되돌리거나 포함해 커밋하지 않는다. 로컬 시장 데이터 생산, 유료 AI 재호출, workflow dispatch, 자격증명 생성/복사, commit/push/deploy는 이번 구현 검증에 포함하지 않는다.
- 스킬 적용 없이 저장소 실행 게이트와 직접 재현 fixture로 검증한다. 독립 SLO 조사는 읽기 전용 서브에이전트에 맡겼고 수정은 주 담당자가 통합한다.
- 작업 전 dirty 파일 SHA256 목록은 `.cache/operations-preserved-20261010.json`, 운영 기준선은 qa-runner의 `operations-quality-20261010` 및 `operations-isolated-20261010` 세션에 보존했다.

## 확인한 결함과 수정 방향 — 진행 기록

### P1594: AI 숫자와 언어 검증 — 구현 완료

정상 문장을 차단하는 경우와 잘못된 문장을 통과시키는 경우가 함께 있었다. VIX 설명 뒤 SPX 숫자를 VIX 값으로 빌려 읽었고, 3.6% 변동률을 VIX 현재 수준으로 읽었다. 동일 지표의 첫 숫자가 맞으면 두 번째 잘못된 숫자를 놓쳤다. 대문자 영어 문장은 지표 약어 제거 처리에서 삭제돼 한국어 검사도 우회했다. 네 경우를 로컬 fixture로 재현한 뒤 지표별 절 경계·단위/변동 표현·반복 언급 전체·알려진 지표 이름만 제거하는 언어 검사를 추가했다. 검증기 식별자를 v3로 올리고 실제 차단 이유를 producer metadata에 보존한다. 생성 분석의 사실 전체를 보증하는 범용 자연어 검증기는 아니다.

### P1595: Worker 보완 예약 실행 — 구현 완료

GitHub의 :17/:47 예약과 Worker의 :20/:50 보완 요청은 둘 다 실행되면 수집/Actions/AI 비용을 중복시킬 수 있다. 최근 main 실행을 읽어 대기·진행 중 작업 또는 25분 이내 성공이면 요청을 생략한다. 읽기 실패/403 또는 본문 정지에는 무조건 POST하지 않는다. 완료된 실패는 보완 요청할 수 있다. 결과를 자격증명 없는 KV receipt로 남기고 /health에 공개한다. 204는 접수이며 실행 성공으로 판정하지 않는다. 같은 슬롯 receipt는 최선 노력 중복 억제이고 KV의 eventual consistency 때문에 전역 원자적 중복 방지를 주장할 수 없다. 정상 KV 상한 432/일, 상태 변화 최악 상한 624/일로 receipt 48회를 포함했다. 정상 상한만 500/일 경고 목표보다 낮고 두 상한은 1,000/일 무료 한도보다 낮다. 토큰 실제 설정과 새 코드 배포는 별도다.

### P1596: 운영 상태와 진단 — 구현 완료

기존 외부 점검은 선택 기능/소스 경고가 있어도 overall PASS로 보고했고, Pages 파일 하나 실패가 나머지 파일 관찰을 가렸다. 각 파일 결과를 독립 수집하며 blocking gate PASS와 overall DEGRADED를 구분한다. LLM 차단을 키/예산 문제로 추측하지 않고 실제 이유를 남긴다. GitHub 시장/워치독 최근 도착 나이와 실행 간격, Worker 최근 receipt를 함께 관찰한다. receipt와 도착 관측은 실제 작업 성공 및 장기 SLO 인증과 별개다. Step Summary에 경고를 쓰고 watchdog이 machine-readable health artifact를 별도로 보존한다. 선택 소스 부재만으로 출시를 불필요하게 막지 않는 정책은 유지한다.

### P1597: 7/30일 SLO 인증 근거 — 구현 완료

조회 metadata 누락, 하루 집중 실행, 미래 실행, 같은 run ID 반복을 넣었을 때 CERTIFIED_WINDOW를 반환하는 순수 함수 fixture를 재현했다. 생성기에는 필수 도메인 조회 완전성·실제 관측 일수·유효 평가 시각·중복 ID 배제를 추가했다. cron `*/7` 및 `*/5`를 floor로 계산한 분모 오류, 중복/불가능한 슬롯도 고쳤다. 정상 시장 예약은 49회/일 × 30일=1,470회인데 기존 조회 상한 1,000회로 정상 이력을 끝까지 읽을 수 없었다. main만 최대 3,000회까지 읽되 상한 도달 시 인증 보류를 유지한다. alert 이슈 페이지의 PR 제거 후 길이로 조기 종료하던 조건도 원응답 길이로 바꿨다. 이 발견들은 합성 입력에 대한 결함 재현이며 실제 운영 기록이 허위 PASS였다고 입증한 것이 아니다. Worker workflow_dispatch는 기존 schedule SLO를 대신 채우지 않는다.

## 현재 검증과 잔여 작업

수정 후 독립 작업 트리에서 data-pipeline/data-plane/SLO 계약 게이트가 통과했다. queued/recent success/403/동일 슬롯/본문 정지/receipt 노출과 기존 정상 SLO 사례를 포함한다. 원본 main 작업 트리에 운영 변경을 통합했고 로컬 버전은 v57.32다. P1594~P1598 및 R701을 record-fix로 기록했다. commit/push/deploy 및 운영 적용은 하지 않았다.

실측 당시 Worker refresh dispatcher 설정은 false였다. 전용 저장소 Actions read/write 토큰이 필요하며 개인용 광범위 gh 토큰을 Worker에 복사해서 해결하지 않는다. 새 코드의 실제 다음 예약 갱신/AI 분석 품질/장기 SLO 회복은 로컬 게이트로 인증할 수 없다. 자동 PR 코드 리뷰와 실행 승인 auto_review는 별개이고, main push만으로 PR 리뷰가 실행됐다고 판정하지 않는다.

### P1598: 실패 알림의 최신성·서명·API 읽기 — 구현 완료

operations-alert의 늦게 도착한 완료 이벤트가 최신 실패/복구 이슈 상태를 바꿀 수 있었고, 실패 JSON을 Base64 앞 96자로 자른 서명은 긴 공통 job 이름 뒤의 서로 다른 실패를 구분하지 못했다. 신뢰된 동일 저장소 main의 해당 workflow 최근 100개 완료 상태를 먼저 조회하고 최신 의미 있는 실행만 알림을 변경한다. skipped/neutral/cancelled 및 PR 완료는 운영 실패로 세지 않는다. 전체 SHA256 서명으로 구분하고 성공 복구는 실패 job 조회 전에 처리한다. 전체 저장소 실행 이력을 매번 끝까지 읽던 호출을 해당 workflow 한 페이지로 줄였다. 실제 github-script를 mock API로 실행해 다른 서명·stale/skipped mutation 없음·성공 job 읽기 없음이 통과했다. 실제 이슈 생성/댓글/변경은 수행하지 않았다. 최근 100개를 넘어선 연속 실패는 정확한 전체 횟수가 아니라 관측된 횟수로 문구를 수정했다.

## 전체 운영 연결 검토의 판정 범위

| 영역 | 확인한 구조·목적 | 판정과 한계 |
|---|---|---|
| CI / Pages / Worker 배포 | exact SHA CI attestation, 동일 저장소 main 검증, 배포 provenance, bounded timeout, 실패 시 게시 차단, bot data commit에 대한 별도 수렴 | 계약 게이트 PASS. 최신 실제 성공은 아래 실측에 기록. 이번 로컬 v57.32는 미배포 |
| refresh-data / refresh-screener | 동일 refresh-data concurrency group으로 산출물 충돌 직렬화, 취소하지 않음, 시장 half-hour+daily / screener 6-hour | source/gate 연결 PASS. 실제 도착 cadence는 저하. Worker coalesce는 market workflow만 관찰하며 shared queue 대기는 실제 완료 기록으로 확인해야 함 |
| watchdog | hourly :23, aggregate planes, independent diagnostics, rolling 7/30 evidence | optional DEGRADED 기록/health artifact 추가. 장기 정상 인증은 아직 불가 |
| operations-alert | workflow별 marker issue, 연속 실패 임계 2, 성공 복구, 서명 dedupe, issues-only mutation | 최신성·SHA256·bounded workflow 조회 수정. 이슈/댓글 자체의 pagination은 역사 증가에 따라 API 읽기가 늘 수 있으며 현재 비용 상한을 실측하지 않음 |
| knowledge-lint / knowledge-build-candidate | weekly lint 및 변경 후보 생성/검증, 정적 지식 업데이트와 실제 발행 분리 | 기존 최근 run 성공과 지식/생성 parity 게이트 PASS. 모든 원천 연구 내용의 재검증 또는 신규 후보 발행은 미수행 |
| macro-calendar / universe / annual calendar review | 주간 거시·월간 종목·연간 일정 후보/이슈 검토, 무조건 반영하지 않음 | macro/universe 후보 이슈가 남아 있음. 연간 workflow 실행 이력 없음은 다음 정책 일정 전 결함으로 단정하지 않음 |
| 공유 AI / API | browser+Actions가 동일 Worker gpt-6-luna·atomic 월 예산 ledger 사용, provider secret 비노출, 미완료 response 차단, 추가 자동 유료 재시도 없음 | AI/budget/relay/cloudflare 계약 PASS; 이전 browser 연결 1회 성공. 현재 실제 청구 총액·응답의 투자 의미 품질은 별도 미검증 |
| 데이터 소스·pipeline | producer→candidate validation→reconciliation→runtime artifacts→consumer→CI→Pages, LKG 보존, 누락 시 상태 보류 | data-pipeline/source-registry/data-lineage/static-data/SEC projection/reconciliation/professional-gap/data-refresh 계약 PASS. 모든 공급자의 권리·업타임·수치 정확성을 실측한 것은 아님 |
| fast quote plane | Tier0 16/16, 5분 cron, semantic revision no-op, 15분 heartbeat, KV-only | 공개 health PASS. fastQuotes consumer enabled=false·권리/soak 조건은 그대로이며 제공 API가 곧 사용 승인이라는 뜻은 아님 |
| PR code review / 승인 자동 검토 | main CI·CodeQL, Code Review plugin 연결, auto_review 실행 권한 검토 | 연결과 기존 CI는 확인. Codex PR 자동 리뷰가 실제 작성됐다는 증거는 없음. 설정을 바꾸거나 PR review를 요청하지 않음 |

## 22:27 KST 읽기 전용 재관측

원본: [OPERATIONS-LIVE-20261010-2227.json](./OPERATIONS-LIVE-20261010-2227.json). 인증 토큰은 프로세스 메모리에만 잠시 사용했고 출력/파일/Worker에는 저장하지 않았다. HTTP GET만 수행했으며 유료 AI 호출·dispatch 없음.

- Pages v57.31, SHA `ea37cd6cfc0c22ac3f405500d83c4d0904534eda`. screener data bot 갱신 이후 CI [38054160092](https://github.com/ysnle/aio-screener/actions/runs/38054160092)와 Pages [38054505528](https://github.com/ysnle/aio-screener/actions/runs/38054505528)가 성공했고 exact provenance도 통과했다. 기존 de0079c0 배포 관찰은 과거 시점 사실로 유지한다. root HEAD를 pull/merge하지는 않았다.
- AI Worker ready=true·quota/authority 계약 통과, fast plane coverage 16/16·source SHA de0079c0. data-only Pages 갱신과 Worker 코드 revision은 서로 독립이다.
- market 마지막 성공 run 38039987647, 도착 나이 265분·직전 도착 간격 399분. watchdog 마지막 성공 run 38033897726, 도착 나이 371분·직전 간격 377분. 마지막 성공이 있다는 사실만으로 정해진 예약 주기가 지켜진다고 볼 수 없다.
- dispatcher configured=false 유지. 기존 운영 시장 분석은 language/metric mismatch로 차단되고 typed fallback이 동작한다. 이 분석은 이번 변경 후 재생성된 자료가 아니다.
- 28개 관측 check 중 23개 PASS, 3개 warning 실패(미설정 dispatcher·market/watchdog cadence), 2개 error 실패(local v57.32 vs live v57.31 비교)였다. 두 revision error는 이번 미배포 로컬 버전 차이를 정확히 보여주며 현재 서비스 장애의 증거로 바꾸지 않는다. observe 모드 exit 0은 관측 완료이며 모든 check PASS가 아니다.

## 최종 QA와 Claude 변경 보존

1. 최신 원본 프론트엔드 파일을 격리 작업 트리에 복사해 검사했다. 원본 Claude QA artifact를 덮어쓰지 않기 위해 자동 브라우저 산출물은 격리 트리에만 썼다. 통합 전 원래 tracked dirty 파일과 비교한 unexpected hash change는 0이다. index.html은 bump-version이 수행한 13 cachebuster·title/badge 버전 치환 외 내용이 정확히 같다. 실제 프론트엔드 코드/기존 화면 증거는 보존했다.
2. affected 본 검사 `2026-10-10T13-22-28-034Z-17884-un13c3`: 120 PASS / 2 FAIL / 32 SKIP. 제가 추가한 Pages assertion label의 P1596 trace 누락은 고쳤다. 정확한 rerun `2026-10-10T13-27-08-967Z-18916-iv4r1j`에서 assertion PASS, decomposition FAIL만 남았다.
3. 잔여 decomposition FAIL: index.html 10,185→10,206줄(+21), js/aio-data.js 16,779→16,780줄(+1). 운영 코드 통합 전 보존본에도 같은 증가가 있었다. 코드 삭제나 성장 기준 완화를 하지 않았다. Claude 프론트엔드 담당이 이 기준을 해결해야 전체 릴리스 QA를 통과할 수 있다. 이 때문에 본 검사에서 32개 후속 게이트가 SKIP됐으며 SKIP을 PASS로 합치지 않는다.
4. 알림 수정 후 affected `2026-10-10T13-29-09-941Z-6136-06pyn2`: preflight+workspace 20 PASS / 7 CACHED / 0 FAIL / 0 SKIP. P1598 실제 script mock 실행 포함. 별도 workspace group `2026-10-10T13-27-44-881Z-24960-a5holt`: 12 PASS / 1 CACHED / 0 FAIL.
5. browser-runtime `2026-10-10T13-27-43-402Z-5948-7sgsiv`: 8 PASS / 0 FAIL / 0 SKIP. 공개 AI 소비 fixture, 채팅 UI 상태·응답 레이아웃, market epoch, screener refresh, boot, architecture, vertical integration을 Chromium에서 확인했다. 실제 API 청구/운영 AI 답변 품질 검사가 아니다.
6. SLO의 alert pagination 불완전 상태도 dedupe PASS로 승격하지 않도록 추가했다. 후속 SLO contract 및 assertion trace PASS. root generate-workspace-state --check, version sync 및 git diff --check PASS. 생성된 profile/skill 동기화는 게이트로 검사했으며 스킬 워크플로를 적용했다는 뜻은 아니다.
7. 원본 main의 최종 workspace 최소 검사 10개도 모두 exit 0이었다. knowledge lint 경고 3개는 기존 문서 두 개의 replacement-character 인코딩 손상(7/19 ARCHITECTURE-REBUILD-EXECUTION-PLAN, ARCHITECTURE-REMEDIATION-HANDOFF) 및 8/22 RESEARCH-INTEGRATION-AI-INFRA-MARKET-RISK의 last_verified 49일 경과다. 역사 복원/내용 재검증은 이번 운영 코드 범위에서 하지 않았으며 기계적 PASS를 의미 정확성 검증으로 바꾸지 않는다. ledger의 기존 open QA 232개/legacy verify_by 없는 168개도 이번 작업으로 완료됐다고 판정하지 않는다.

## 다음 Harness 작업 경계와 운영 적용 조건

- 로컬 main에 P1594~P1598 구현이 있으며 사용자 frontend 변경도 함께 남아 있다. commit/push/deploy 없음. 운영 직접 변경 목록과 QA scope는 `OPERATIONS-OWNERSHIP.json`을 확인한다. 별도 브랜치/작업 트리는 미커밋 검증 복사본이므로 이중으로 merge하거나 frontend snapshot을 원본에 덮어쓰지 않는다.
- Claude는 기존 UI/UX 구현 및 decomposition을 계속 담당한다. v57.32 버전 표면과 P1594~P1598/R701 번호를 보존하고 번호를 중복 사용하지 않는다. 원래 `_artifacts/*` QA 결과도 이번 새 Chromium 결과로 교체하지 않았다.
- 전용 fine-grained Actions read/write 토큰을 사용자가 준비/설정해야 한다. 저장소 Secret `AIO_REFRESH_DISPATCH_TOKEN`→승인된 data-plane 배포→Worker `GITHUB_DISPATCH_TOKEN`. 다른 개인 토큰을 재사용하거나 파일에 붙여넣지 않는다. 토큰이 없으면 새 구현도 dispatcher를 활성화할 수 없다.
- 프론트엔드 잔여 게이트 해결 후 요청된 릴리스 전체 QA를 수행한다. 사용자가 실제 commit/push를 명시하면 push 전에 `git pull --no-rebase origin main`, 생성물 충돌은 저장소 resolver와 인쇄된 release gate로 해결한다. 이미 관측한 data bot 새 SHA를 덮어쓰지 않는다.
- 승인된 CI-attested 배포 후 새 dispatcher receipt/Actions 실제 완료·AI 분석 v3·DEGRADED summary/artifact를 별도 live 검증한다. 7/30일 SLO는 실제 이후 기록으로 다시 판단한다. 현재 코드 완료가 이 운영 조건 완료를 의미하지 않는다.
