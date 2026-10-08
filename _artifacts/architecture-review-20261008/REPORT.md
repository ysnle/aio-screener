# v57.29 구조 점검 및 개선 기록

작업일: 2026-10-08. 작업 트리: `C:\Projects\AIO`, 로컬 `main`. 기준 HEAD: `3d295014d670959660b049c1cd2217800671f523`.

공유 런타임의 수명·취소·오류 전파, Worker 본문 제한 시간, 생산기 저장, AI 공개 정책, QA 증명과 캐시 입력의 경계를 개선했다. 전체 구조를 조사했지만 모든 투자 콘텐츠의 의미 검수나 레거시 전체 ESM 전환을 완료했다는 뜻은 아니다. 커밋·푸시·배포는 수행하지 않았다.

## 작업 경계와 보존

- 시작 전에 `qa-runner session-start --session architecture-20261008`로 파일 content hash를 저장했다. 기존 dirty 파일을 초기화하거나 다른 브랜치로 전환하지 않았다.
- `_artifacts/codex-browser-audit-v57.27-20261007/CLAUDE-RESPONSE-v57.28.md`는 시작 기준 SHA-256 `2dcdc82410a4f558a969264fbba8c04b900025eb2e61a3d064de392b4c71538d`를 유지한다. 그 문서에 남겨둔 Claude 콘텐츠·포트폴리오 작업을 수행한 것으로 기록하지 않는다.
- `bump-version`으로 v57.29를 적용하고 `record-fix`로 P1518/R690, P1519를 기록했다. workspace 생성물은 생성 스크립트로 갱신했다.
- 독립 조사·회의적 리뷰·AI 추출 리뷰를 병행했다. 사용자가 모델을 지정한 이후 추가·후속 하위 에이전트는 GPT 6.1 SOL이다. 하위 에이전트는 읽기 전용이며 편집·통합은 주 담당자가 수행했다.

## 구조별 판단과 조치

| 영역 | 의미·책임 경계 판단 | 이번 조치 및 증거 | 남은 범위 |
|---|---|---|---|
| 정적 셸·native ESM·라우트 | 정적 진입과 native 페이지 수명주기 분리는 유지할 가치가 있다. 재진입 중 이전 mount 결과가 새 화면을 오염시키는 것이 실제 결함이었다. | 동기 mount·lazy mount·cleanup 재진입 뒤 scope와 transition generation을 재검사. 늦게 반환된 disposer를 즉시 정리. | 19 route ID가 남아 있는 사실만으로 8화면 통합 실패를 판단하지 않는다. aliases와 실제 사용자 화면은 별도 계약이다. 전체 legacy 이동은 미완료. |
| 부팅·호환 이벤트 | 레거시 호환층은 과도기 adapter여야 하며 구독자 하나의 실패가 다른 구독자를 중단하면 안 된다. | `src/app/compatibility-events.js`로 adapter 추출. 동기 예외와 비동기 rejection을 소비자별 격리. 기존 dedupe 유지. | bootstrap은 여전히 조립 책임이 크다. 무작정 파일만 나누기보다 호출·수명 소유권 기준으로 후속 이동해야 한다. |
| 데이터 provider·orchestrator·state | 공유 whole-table 요청은 첫 화면의 취소 신호에 종속되면 안 된다. 소비자는 자신의 scope로 결과 반영을 제어한다. | entity provider가 shared single-flight 요청을 소유. 성공 완료부터 TTL 시작. 느린 in-flight 요청 재사용 및 실패 후 재시도. | domain의 일부 market-time 경로가 `src/ai/time`에 있어 공통 시간 모듈의 위치를 후속 정리할 수 있다. 현재 cycle·실행 결함으로 확인된 것은 아니다. |
| Worker·네트워크 | 응답 헤더 수신은 요청 완료가 아니다. 본문까지 제한 시간이 적용돼야 한다. | Worker data-plane이 공통 `createHttpClient`를 사용. 영구 대기 body/abort 무시 fixture에서 종료, fallback host, LKG와 heartbeat 유지 확인. | 실제 배포 Worker와 실 공급자 응답은 검증하지 않았다. |
| 데이터 생산·원자 저장 | 동일 저장 규칙의 재구현은 오류·임시 파일 처리의 차이를 만든다. | earnings-calendar, cftc-positioning, sec-fundamentals의 저장을 `atomicWriteFile`로 통합. 기존 JSON 포맷 보존. | 생산기를 로컬에서 실행하지 않았다. 공급자 권리·새 데이터 품질을 인증하지 않는다. |
| AI 계획·공개 검증·렌더 | parser는 형식, publication은 근거 결속, renderer는 표현을 담당해야 한다. 기존 공개 경로의 검증 우회는 발견하지 않았다. | `src/ai/response/publication.js`에 근거·시각·수치·출처 URL 결속과 fallback 복구 추출. 기존 orchestrator getter를 통해 연결하여 facade API 수를 늘리지 않음. bridge 부재 시 원문 보류와 null plan 처리. | ledger와 publication의 숫자 산문 탐지 범위 차이는 기존 의도대로 보존. AI 모델·가격·budget 정책은 변경하지 않았다. |
| 도메인·지식·학습 화면 | 파일 분리와 콘텐츠의 사실·예측력 검증은 다른 작업이다. | 정적 의존 그래프·도메인 parity·지식 생성물 및 학습 route 계약을 점검. | 모든 금융 주장에 대한 원문·관측 시각·예측력 재검증은 미수행. Claude 잔여 콘텐츠 작업은 그대로 남음. |
| 저장·포트폴리오 | 동의·보존·마이그레이션은 실제 호출 경로에서 판단해야 한다. | 기존 vault·스토리지 회귀 및 브라우저 검사 결과를 확인. | `migrateStored`의 동의 정책은 후속 설계 검토 대상이나 호출자가 확인되지 않아 활성 누출로 주장하지 않음. 포트폴리오 기능 개편은 이번 별도 범위에서 하지 않음. |
| QA·출시 증명 | 부분 실행 PASS는 전체 출시 증명이 아니며, 검사한 워킹 트리와 commit index가 달라질 수 있다. | full/no-cache 전체 PASS만 v2 proof 생성. runner/manifest/gate 집합 결속. 모든 tracked index 및 추가 staged bytes, QA 입력 새 파일 누락 검증. 28개 gate 및 watchdog mirror의 literal-read 입력 보강, 영향 경로 누락 보강. | literal-read 분석은 최소 하한이다. 동적·전이 의존성 전부의 자동 증명은 아니다. 현재 데이터 최신성 FAIL로 출시 인증은 성립하지 않는다. |
| 문서·에이전트 계약 | 구조 검토일을 투자 리서치 최신성으로 바꾸면 안 된다. | 구조 문서와 QA proof 절차를 갱신하고 생성물·프로필·스킬 동기화 검사. 지식 문서에는 기술 책임 경계만 기록. | 오래된 리서치의 날짜·의미 검수 상태를 일괄 갱신하지 않음. 과거 일부 인코딩 경고와 reference freshness 경고 유지. |

정적 모듈 인벤토리: `src/**/*.js` 277개. 이번 단순 literal static import/export 탐색에서 로컬 edge 467개, cycle 0개. 동적 import와 런타임 전역 호출은 이 수치에 포함되지 않으므로 전체 의존성 무순환 증명이 아니다. 레거시 core 22,972행, data 16,707행이 남아 있어 전면 ESM 전환 완료로 표현하지 않는다.

## 회귀 방지

- P1518: 동기·lazy mount 재진입, cleanup 재진입, mount throw, 늦은 disposer, 이벤트 sync/async 오류, 공유 재무 요청 취소·느린 TTL·실패 재시도, Worker body timeout, 생산기 공통 writer 연결.
- P1518/R690: 전체 proof를 부분 실행으로 덮지 않기, 추가 staged 파일 차이, 미스테이징 tracked 의존성, 새 QA 입력 미포함, runner/manifest와 proof 범위 일치, 실제 literal 읽기와 캐시·영향 선택의 연결.
- P1519: tuple 위조, 잘못된 metric/entity/scale, 허위 citation, 문서 ID로 숫자 위조, 숫자 산문 위장, 미래 시각 60초 경계, 모듈 부재, 안전한 truncated fallback. 독립 SOL 리뷰의 읽기 전용 Node/VM 검사 20개도 통과했다.
- 기존 screener replay 브라우저 검사는 H113의 현재 문구 `보관 실행 재현`/`자료 기준`을 기다리도록 수정했다. 결과·설명 hash와 rows 재현 검사는 유지했다. 제품 screener 코드는 이 수정에서 변경하지 않았다.

## 검증 기록

QA JSON의 PASS는 해당 gate 범위에서만 해석한다. 아래 경로는 repository root 기준이다.

| 실행 | 결과·해석 |
|---|---|
| `.cache/aio-qa/runs/2026-10-08T00-16-09-262Z-7436-h4csnu.json` | 최초 full/no-cache: 119 PASS, 3 FAIL, 23 SKIP. 공통 writer 연결 assertion, 임시 경로 parity, 구조 문서 날짜를 수정. |
| `.cache/aio-qa/runs/2026-10-08T00-18-11-504Z-15028-wgv5qu.json` | 위 3개 실패 재검사 PASS. |
| `.cache/aio-qa/runs/2026-10-08T00-19-24-532Z-14836-2y1em4.json` | 99 PASS + 23 CACHED. sandbox 브라우저 설치 경로 문제 23 FAIL. |
| `.cache/aio-qa/runs/2026-10-08T00-20-24-676Z-45144-jrw9xl.json` | 설치된 브라우저 환경 재검사: 22 PASS, screener 과거 문구 대기 1 FAIL. headless 111 groups, route soak·a11y·vault·viewport·학습 화면 등 포함. |
| `.cache/aio-qa/runs/2026-10-08T13-46-54-674Z-11416-voy9ug.json` | screener 문구 계약 수정 후 1 PASS. |
| `.cache/aio-qa/runs/2026-10-08T13-54-47-925Z-39632-zsftlk.json` | AI 추출 후 full/no-cache: 118 PASS, 4 FAIL, 23 SKIP. unused wrappers/facade 증가는 제거. data-refresh/data-lineage는 시간 경과로 stale. |
| `.cache/aio-qa/runs/2026-10-08T13-57-12-959Z-38424-3ttijv.json` | 원래 실패 배치 재검사: 구조 2 PASS, 데이터 최신성 2 FAIL 유지. |

최종 세션 affected와 AI 추출 이후의 브라우저 실행 결과는 아래 최종 증거 절에 추가한다. 데이터 FAIL 때문에 full의 브라우저 phase가 SKIP된 사실을 개별 브라우저 PASS로 소급 변경하지 않는다.

### 최종 증거

- `.cache/aio-qa/runs/2026-10-08T13-57-41-325Z-12104-3opzgd.json`: 세션 affected **101 PASS + 19 CACHED, 2 FAIL, 32 SKIP**. 실패는 `data-refresh`, `data-lineage` 두 최신성 검사뿐이다. SKIP은 browser 23개와 watchdog-local 9개다. workspace 생성 상태·지식/스킬 계약·ledger/assertion trace·프로필/스킬 동기화는 통과했다.
- `.cache/aio-qa/runs/2026-10-08T14-00-05-924Z-41444-t9y53g.json`: 최종 코드의 browser-runtime **8 PASS**. AI 공개 경로/모듈 부재, 채팅 상태/레이아웃, market epoch, screener 재현, 부팅, architecture, vertical slice 포함. 앞선 최신성 실패 배치는 그대로 보존됐다.
- `.cache/aio-qa/runs/2026-10-08T14-02-36-792Z-3332-izpzq7.json`: 최종 코드의 headless gate **PASS, 내부 111개 그룹 완료**. 기존 데이터 실패를 지우거나 전체 proof로 승격하지 않았다.
- 최종 getter 연결은 SOL 리뷰에서 다시 읽어 확인했다. 기존 `getAIOrchestrator`만 사용하며 삭제된 helper 잔여 참조가 없다.
- `git diff --check` 통과. 새 JS/fixture/report는 LF. 보호된 Claude 문서의 content hash 동일 여부를 재확인했다.
- `CHANGE-INVENTORY.json`은 HEAD diff와 구분되는 세션 시작 대비 content hash 목록이다. version generator·QA 출력도 포함하며 기존 dirty 변경을 모두 이번 작업의 변경이라고 주장하지 않는다.

수동 in-app browser: 로컬 8878에서 종목 AAPL→MSFT 전환 후 재무 공시 화면을 확인했다. MSFT의 2026-06-30 annual, FY2021–26 6개 연도가 표시됐으며 시장 상태로 다시 이동했다. 이 수동 확인은 AI 추출 전이다. 외부 proxy 연결 오류 로그 1종을 관찰했으므로 콘솔 전체 무오류라고 주장하지 않는다.

## 차단·미검증 및 후속 경계

1. **차단:** 로컬 `public-data/data.json` 관측/생성 시각 `2026-10-07T14:27:26.078Z`, 2026-10-08 13:55 UTC 검사 때 약 23.46시간 경과로 12시간 SLA 초과. shared VIX evidence도 delayed 상태다. freshness gate를 완화하거나 데이터를 현재 시각으로 다시 찍지 않았다. 생산 워크플로의 실제 갱신 산출물이 필요하다.
2. **미검증:** 배포본, Worker provisioning, 실 API 답변 품질·비용 정산, 실 공급자의 최신 데이터·권리, 전체 투자 지식의 내용 의미 검수. 로컬 fixture는 이를 대신하지 않는다.
3. **후속 구조 작업:** legacy 화면별 소유권의 지속적인 src 이동, market-time 공통 위치, pure data contract의 계층 명칭, 쓰이지 않는 helper의 실제 caller 검토. 단순 파일 수 감소보다 입력·수명·공개 경계를 우선한다.
4. **출시:** 현 상태는 commit-ready 전체 PASS 증명이 아니다. 최신 데이터 산출물 반영 후 full/no-cache와 명시적인 사용자 commit/push/deploy 지시가 필요하다. 이번 작업에서 자동 커밋·배포하지 않았다.
