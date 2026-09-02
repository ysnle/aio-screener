# AIO Screener 독립 코드·이력 감사 — 2026-08-31

감사 대상: 작업 시작 시 v54.72, 수정본 v54.73. Git HEAD `6ef2561`은 축약 식별이며 정확한 SHA는 `inventory.json.head`를 따른다. 기존 미커밋 변경은 유지했다. 감사 기준은 스킬의 통과 항목이 아니라 실제 계산·데이터 흐름·소유권·사용자 결과다. 커밋·푸시·배포 없음.

## 판정

**연구 도구의 방향은 타당하지만, 구현·검증·기록이 충분히 일치한다고 평가할 수 없다.** 실제 개선도 많다. 동시에 기능을 추가한 뒤 구 경로를 남기는 방식, 테스트에서만 실행되는 기반 모듈을 기능처럼 설명하는 방식, 정상 fixture와 문자열 검사에 의존하는 방식이 반복됐다. 기존 계약 93개 중 92개가 통과한 상태에서도 독립 입력으로 여러 계산 결함을 재현했다.

이번 작업은 전체 파일/이력 색인, 주요 실행 경로의 심층 리뷰, 확정 결함 수정, 로컬 검증과 개편안 작성이다. **1,730개 커밋의 모든 diff·모든 코드 줄·모든 시장 데이터 행·모든 지식 문장을 의미 검증한 전수 인증은 아니다.** 이를 완료했다고 표현하면 과장이다. 아래 미완료 사항은 실제로 남아 있다.

## 범위와 증거

| 범위 | 수행 | 한계 |
|---|---|---|
| 현재 파일 | Git tracked + untracked 1,783개 경로·바이트·줄·SHA-256 색인 | node_modules/ignored 파일 제외. 파일 존재와 내용 해시는 의미 품질을 증명하지 않음 |
| 실행/검사 소스 | HTML + js/src/worker/scripts 359개 파일 색인 | 핵심 파일/함수만 상세 읽기와 반례 실행 |
| Git 이력 | 접근 가능한 1,730개 커밋의 날짜/제목, non-merge 파일별 추가·삭제·변경 횟수 집계 | Git 최초가 2026-04-02 v38.9. 그 이전 v1~v38.8은 복원 가능한 원본 코드 이력이 없음 |
| ESM | 173개 모듈, bootstrap으로부터 정적/문자열 dynamic-import 그래프 | computed imports와 외부 소비자는 별도 검색 필요. 미도달=삭제 가능 판정 아님 |
| 기록 | BUG/RULES/QA/CHANGELOG 전체 구조 색인 + 관련 P/R/QA 본문/역사 diff 대조 | 압축된 과거 원장은 당시 Git 본문이 필요. 수백 원장의 모든 문장을 재판정하지 않음 |
| 현재 동작 | 독립 Node 반례, 계약 검사, Chromium 회귀·라우트·주요 화면·지식·접근성·Vault | 로컬 테스트는 배포/공급자/인간 평가 인증 아님 |

증거 파일: `inventory.mjs`, `inventory.json`, `probes.mjs`, `probes-before.json`, `probes-after.json`, `evidence-boundary-probes.json`, `qa-*/last-run.json`, `verification-summary.json`. 모든 명령은 저장소 루트에서 실행한다. 초기 색인은 수정 전 상태다. 세션의 변경 목록은 기준선 이후의 기계적 해시 차이이며, 기존 사용자 작업과 다른 진행 변경까지 모두 이번 감사의 수정으로 주장하지 않는다. 직접 수정한 계산/계약 8개와 검사 5개의 경로·해시는 verification-summary에 별도 보존한다. 디스크 바이트는 CRLF를 포함하여 CURRENT-STATE의 정규화 측정과 다를 수 있다.

## ‘근거’가 실제로 뜻하는 것

사용자의 질문에 대한 답은 **표시의 정직성을 높이는 장치는 있지만, 최신성과 정확성의 개선을 보증하는 시스템으로 완성되지는 않았다**는 것이다.

현재 코드에는 서로 다른 개념이 ‘근거’라는 이름 아래 묶여 있다.

| 코드/표시 | 실제 의미 | 보증하지 않는 것 |
|---|---|---|
| Evidence | 값, 출처, 관측/수집/공표 시각, 상태, 허용 용도 | 출처가 실제로 정확한지, 수치가 정정되지 않았는지 |
| 시그널 coverage | 변동성 25 + 심리 25 + 추세 20 + 시장폭 20 + 거시 10 중 사용 가능한 구성요소의 가중치 합 | 정확도 80%, 성공 확률 80% |
| 필드 readiness | 필요한 필드가 있고 상태가 사용 가능 범주인지 | 실제 전략의 예측력·수익성 |
| 팩터 confidence | 입력 가중치 coverage 55% + 표본 크기 25% + 섹터 표본 20%의 공학적 진단값 | 통계적으로 보정된 수익률 확률이나 신뢰구간 |
| allowedUse | 현재 참고/파생 판단/사용 금지 구분을 위한 내부 정책 | 데이터 자체의 품질, 법률 검토 완료 |
| AI evidence floor | 해당 답변을 뒷받침할 자료 종류/출처/시간의 충족 여부 | 문장 전체의 사실성 또는 인과관계 증명 |

좋은 효과는 있다. 기준일이 다른 자료를 한 시점의 관측처럼 쓰지 않고, 없는 값을 0으로 만들지 않으며, 역사·참고 문장을 현재 시장 사실로 바꾸지 않는 데 도움이 된다. 반면 **관측을 수집하거나 공급자를 복구하지 않으므로 제한만 늘려서는 정보가 좋아지지 않는다.** 80% 등의 수치는 현재 설계값이지, 이 저장소가 실증한 최적값이 아니다. 이번 수정은 80을 올린 것이 아니라 null이 0으로 바뀌는 버그만 고쳤다.

직접 실행한 현재 반례:

1. `createScreenerProvider.readCurrent()`는 산출물 생성 시각이 48시간을 넘으면 필드별 사용 가능성을 보기 전에 rows 전체를 `[]`로 반환한다. 감사 시 `SCREENER_ARTIFACT_STALE`, 0행이었다. 마지막 완료 거래일 자료나 종목 정체성까지 숨길 수 있는 구조다.
2. 반대 방향의 허점도 있다. 일반 `createEvidence`/`validateEvidence`/`selectForDecision` 경로는 관측일이 없어도 `status:'fresh'`라고 붙이면 통과한다. `normalizeAllowedUse('not-for-decision')`도 부분 문자열 때문에 `decision`으로 해석한다. 이는 공통 API의 반례이며 실제 현재 공급자가 그 문자열을 보낸다는 증거는 없다.
3. 위 두 사례가 동시에 존재하므로 ‘근거 시스템은 엄격해서 무조건 안전하다’고 말할 수 없다. UI는 너무 많이 숨기면서 내부 분류는 느슨할 수 있다.

권장 구조는 **원자료 표시 / 지표 계산 / 복합 해석 / 개인 행동**의 네 단계를 분리하는 것이다. 허용된 원자료는 출처·기준일·실패 상태와 함께 표시하고, 없는 필드만 비워 둔다. 지표가 계산 불가능하면 그 지표만 보류한다. 종합점수에는 입력 충족도와 사용한 정의를 붙인다. 공급자 장애는 실제 갱신 재시도와 관측 이력으로 해결한다. 광범위한 ‘근거 부족’ 문구로 원자료·뉴스·설명 전체를 막는 설계는 줄여야 한다. 권리상 표시 불가인 자료와 단순히 오래된 자료는 구분해야 한다.

이 재설계는 소스 정책·주말/거래소 달력·필드 상태·화면 표시·파생 모델을 함께 바꿔야 한다. 이번 감사에서 임의로 SLA를 완화하거나 stale 데이터를 현재 데이터로 승격하지 않았다.

## 이력에서 확인한 발전과 반복

| 기간/대표 증거 | 개선된 점 | 반복 또는 미완료 |
|---|---|---|
| 4월 v38.9~v48 계열 | 로컬 Git, 뉴스/테마 확대, 이벤트 위임·로깅·프록시 정리 | 기능 증가가 거대 셸/전역 파일에 누적됨. 코드 분리는 곧 소유권 분리가 아니었음 |
| 5월 v49 계열 | 사용자 화면 단순화, freshness, 교차 화면 검사 | `92597e8`은 이전 표면 통합에서 누락된 코드를 재통합한 이력을 명시. 완료 표현과 구현 범위 차이 존재 |
| 7월 초 v51.91 | `35cde2a`의 RSI 방식 통일, adjusted-close·HY·backtest 수정은 계산 원인에 접근한 좋은 수정. producer와 parity gate를 같이 다룸 | 동일 계산을 둘 이상 유지하면 parity 검사 비용이 계속 필요함 |
| 7월 중순 ESM 전환 | P736/P740이 scaffold·owner 과장을 인정, `69a1fa5`가 이중 DOM writer와 이벤트 차단을 실제 삭제, `e031a88`이 store 복제/이벤트 fan-out을 축소 | 현재도 runtime-readers는 legacy 전역을 읽음. registry의 dataOwner=native와 독립 데이터 소유는 동의어가 아님 |
| 8월 Workbench | `6de3449`가 AST·필드 계약·저장 조건·설명·PIT·성과·planner를 추가, `2910a8e`가 비용 누락/승격 조건 보강 | 해당 첫 커밋은 3,065행 추가/74행 삭제. 이것만으로 나쁜 추가라고 판단하지 않지만, 현재도 PIT/outcome/planner는 테스트 소비만 확인됨. 정상 fixture가 미래 관측·동점·단위 혼합을 놓침 |
| v54.57 이후 | 생성형 현재 상태, 영향 기반 QA, exact failed-group retry, 명시적 배포 승인, 데이터 projection은 좋은 방향 | 문서/게이트가 설계 선언을 검증하는 비중이 크고, 오래된 QA 완료 문구가 현재 상태로 재사용될 위험 |
| 기존 dirty v54.65~72 | 취소/프록시/시각·UI 결측 보완과 연구자료 reference 구분이 있음 | 이번 full headless에서 구식 기대값 5개가 남아 있었음. 기존 사용자 작업을 삭제하거나 되돌리지 않고 회귀 검사만 정합화 |

이력 집계: 4월 110, 5월 122, 6월 340, 7월 662, 8월 496 커밋. 이 중 제목이 `data: refresh`인 것은 1,006개다. 커밋 수를 기능 작업량으로 읽어서는 안 된다. `index.html`은 non-merge 441회(188,575 추가/158,941 삭제), `aio-core.js` 358회(33,805/6,145), `aio-data.js` 200회(23,313/6,551) 변경됐다. 초기 추가분도 포함하므로 삭제 비율 하나로 코드 품질을 점수화하지 않는다.

## 이번에 수정한 결함

| ID / 우선도 | 재현과 영향 | 수정/검증 |
|---|---|---|
| F01 / P1 | 시그널 coverage 설정이 null/blank이면 0%가 되어 VIX만으로 62점 표시 가능 | 기존 finiteNumber 경계 사용. null/blank/boolean 기본 80 유지, 실제 숫자 0은 구분. native-decision gate |
| F02 / P2 | 전일 기준 없음→provider baseline, 지연 없음→0ms | snapshot 정규화에서 missing과 실제 0 분리. market-snapshot gate |
| F03 / P1 | 완전히 같은 여섯 종목이 파일 순서 때문에 0~100으로 갈림 | 같은 composite에 같은 midrank. 전체 동점은 모두 50. 순서 반전 회귀 + 기존 5개 factor parity fixture |
| F04 / P1 | 저변동 프리셋이 변동성과 상방 composite rank를 평균한 뒤 오름차순. 20% 변동 종목이 10%보다 먼저 옴 | 저변동 목적에 맞춰 volatility 단독 오름차순. 다른 rank를 주어도 순서 유지하는 반례 |
| F05 / P1 | Object.freeze가 바깥만 고정. 외부 AST 변경이 같은 hash의 의미를 변경 | 정의를 deep-copy/freeze하고 실행 검증에서 hash mismatch 거부. 입력 객체 소유권 유지 |
| F06 / P1 | LAST_GOOD가 금지 목록에 없어서 필터 통과. requiredFields가 비면 추가 방어 없음 | 기존 usable status allowlist를 필터에도 적용. 오래된 수치의 표시 허용과 현재 조건 통과는 구분 |
| F07 / P1 기반 모듈 | PIT가 universe만 시점 비교하고 observations는 날짜 형식만 검사 | observedAt/availableAt/filedAt/effectiveAt와 asOf 비교, 누락 availability 거부. 실제 운영 PIT 활성화는 아님 |
| F08 / P2 기반 모듈 | benchmark null→-100%, exit<entry 허용, 두 점으로 MDD 생성, T+1을 다음 달력일로 계산 | strict numeric/time, MDD=null, 명시 sessionDates 없으면 exitDate=null. **실제 T+n 성과 수집/검증/조정 경로는 아직 없음** |
| F09 / P2 기반 모듈 | planner가 in-flight와 blocked 작업을 다시 선택 | plan에서 상태 점유, in-flight/terminal 제외. 완료·재시도 계약 유지. 영속 worker lease/회복은 후속 |
| F10 / P2 검사 | 기존 headless 5개 assertion이 현재 timer/인자/lazy/memory 의미와 불일치 | T1041은 단일 probe를 실행, T160은 관련/무관 두 경우, T143은 동기 no-inline-handler만 담당. T775/T813은 AbortSignal-aware 정적 배선임을 명시 |

P1011/P1012, R573, QA-AUDIT-20260831-01~06에 연결했다. 새 CI 파일을 늘리지 않고 기존 네 계약 게이트와 headless에 회귀를 넣었다. 거래 전략의 가중치나 예측 성공을 최적화했다고 주장하지 않는다.

## 남은 중요한 설계·코드 문제

### F11 / P1 — 근거가 있는데 숨기는 경로와 증거 없이 허용하는 경로의 비대칭

위 evidence 절의 두 반례가 핵심이다. `src/data/providers/screener.js`의 early return, `src/data/contracts/evidence.js`의 분류/기본값, `src/data/selectors/evidence.js`의 소비 경계가 다른 정책을 구현한다. 차단 문구를 늘리기보다 field별 display/calculation readiness와 동일한 관측 시각 계산을 연결해야 한다. 일반 evidence selector는 status를 발급한 producer를 신뢰하는 얇은 API인데, 문서에서는 완결된 검증기처럼 읽힐 수 있다.

### F12 / P1 — immutable snapshot이라는 이름과 재실행 가능성의 차이

`src/data/providers/screener.js`의 snapshotId는 revision/source/symbol 목록을 해시한다. 실제 field observation 값·라이브 시총·provider 응답 내용은 포함하지 않는다. 동일 ID에서 실행 시 입력이 달라질 수 있다. `runHistory`는 메모리의 최근 20개 요약이며, 이후 같은 관측 묶음을 복원할 저장소가 없다. ScreenRun/resultHash는 계산 결과 추적이지 독립 재현 가능한 데이터 스냅샷은 아니다. 선언을 낮추고, 불변 관측 묶음 + 정의/모델 버전 + 데이터 content hash를 저장한 뒤 replay를 검증해야 한다.

### F13 / P1 — factor-level 80%와 row-level 유효성은 다르다

`factor-ranks.js`는 size/value/quality 활성 여부를 집합의 신선도 80%로 정한 뒤, 활성화되면 나머지 stale/future 행도 값이 있으면 통계에 포함할 수 있다. momentum/trend/lowvol에는 모델 내부 날짜 검사가 없고 provider의 aggregate epoch에 의존한다. 필터에서 문제 행을 가려도 이미 peer 통계에 영향을 줄 수 있다. 또한 개별 결측 팩터는 z=0, 표시 score=50이며 confidence만 줄어든다. ‘결측은 중립점수로 채우지 않는다’는 R572와 실제 계산/표시 의미가 완전히 일치하지 않는다. row별 유효값 마스킹 → 표본/분모 계산 → rank로 순서를 정리하고, 결측 팩터 바는 숫자 50 대신 없음으로 보여줘야 한다. 이는 모델 이행/분모 변화 검증을 동반해야 하므로 이번 tie 수정과 섞지 않았다.

### F14 / P1 — native data owner라는 회계가 의존성 제거를 뜻하지 않음

registry는 lifecycle/renderer/data 각각 20개 native, chart 8, narrative 1, fullNativeOwner 4개(guide/principles/masters/atlas)를 선언한다. 실제 `runtime-readers.js`는 `_liveData`, `DATA_SNAPSHOT`, `_allNewsItems`, `_portfolioState`, `AIO.getMarketHealth` 등을 읽는다. bootstrap에서 readers→provider로 이름이 옮겨진 것은 UI 의존성 개선이지만 legacy producer 제거는 아니다. `ci-architecture-contract-check.mjs`는 themes native data를 확인하면서 오히려 root._liveData 배선 존재를 요구한다. registry 필드 설명과 구현 검사가 서로 다른 ‘native’를 말하고 있다. producerOwner/projectionOwner/rendererOwner를 구분하고, 단 하나의 화면을 end-to-end 이전한 후 기존 writer·이벤트·timer를 삭제해야 한다.

### F15 / P2 — 실행에 연결되지 않은 기반 모듈

bootstrap 그래프 미도달 후보 31개. `operations/reconciliation/source-registry`는 빌더가 쓰는 공용 계약이므로 삭제 대상이 아니다. `vault/repository/migrations`는 비활성 경계와 테스트가 있는 별도 표면이다. 다음은 명시적인 사용/퇴역 결정을 해야 한다.

- 테스트 소비만 확인: screener PIT/outcome/provider-capability/refresh-planner/regime, knowledge repository/selectors/ontology/route-bridge, 일부 knowledge UI, AI benchmark/control-plane.
- exported 심볼 호출을 별도 검색했으나 runtime 호출을 찾지 못함: `createEvidenceGraph`, `createAIProvider`, `createTelemetry`, `createLegacyObserverPage`. 일반 sanitizer는 계약 fixture만 확인됐다.
- `createLegacyObserverPage`는 retirement gate가 bootstrap 금지를 검사하지만 파일 자체는 남는다. Pages workflow는 src 전체를 rsync한다.

‘필요 없어 보인다’며 31개를 삭제하면 빌더/fixture를 훼손한다. production/shared-build/test-only/retire 네 범주로 나누고 runtime manifest에서 test-only/retire를 빼는 것이 우선이다. 새 아키텍처 파일을 더 만들기보다 기존 기반을 실제 소비 경로에 연결하거나 제거할 필요가 있다.

### F16 / P2 — monolith 부채가 초기 성능과 수정 비용을 지배

초기 색인에서 index + 배포 legacy JS 5개가 디스크 기준 약 5.49 MB이며 src 전체는 약 1.50 MB다. 이는 전송 압축 크기나 실제 route별 다운로드량이 아니다. route dynamic import는 개선이지만 legacy 전역 평가·대형 HTML·inactive DOM이 남아 있다. core 27,705행, data 16,438행, HTML 28,226행 수준이다. 전체 프레임워크 교체를 먼저 하지 말고 `screener→ticker→fundamental`의 provider/view model/render/event/chart를 각각 단일 소유자로 이전하며 예전 경로를 함께 지워야 한다.

### F17 / P2 — 동일/유사 코드의 중복

450자 이상인 완전 동일 12행 block 검사는 atlas/principles의 `loadGroup` 한 사례를 찾았다. 이 좁은 검사에서 한 건이라는 결과는 전체 중복이 한 건이라는 뜻이 아니다. UI/서사·데이터 정규화의 의미상 중복은 더 크다. 특히 UI별 knowledge loader, legacy/native reader, AI chat/unified 흐름은 기능을 유지하면서 같은 취소/수명/실패 의미를 가져야 한다. 모든 짧은 helper를 공유화하지 말고, 정책·라이프사이클이 정말 같은 부분만 기존 공용 모듈로 수렴시킨다.

### F18 / P2 — 문서 보존은 잘하나 완료 상태의 의미가 불안정

BUG/RULES/QA/CHANGELOG가 합계 약 1.37 MB이며 원장을 압축해도 과거 수치/완료 문구가 계속 남는다. CODE-MAP 상단은 v54.57, 헌장 본문은 fullNativeOwner=0 등 당시 기준이고 현재 registry는 4개다. 기술 라우트 notes는 캔버스가 legacy라고 하면서 chartOwner는 native인 설명도 남아 있다. 역사 문서는 기준일을 보존해야 하지만 ‘현재’ 설명의 예전 수치를 다음 작업의 판단 근거로 쓰면 안 된다. 이번에는 QA-SCR-OS14의 과도한 범위를 교정했고 전체 문서를 새 현재 상태로 덮어쓰지는 않았다. QA의 raw 열린 행 수와 unique ID 수는 다르므로 합계 하나만 복사하지 않는다.

### F19 / P2 — 주기적 수집·신선도 실패가 사용자 경로를 막음

초기 data-lineage는 data.json 12시간/market-snapshot 24시간 SLA를 초과해 FAIL. screener는 48시간 processing TTL을 초과한다. 생성 성공 시각과 마지막 완료 시장 관측 시각을 구분해야 하며, 거래소 휴일/주말/각 지표의 발표주기가 필요하다. TTL 숫자 일괄 증가는 해법이 아니다. 로컬 파일을 외부에서 최신이라고 주장하지 않았고 GitHub workflow dispatch도 하지 않았다. 원격 scheduler 실행 여부·현재 provider 응답·실제 배포 상태는 별도 운영 관측이 필요하다.

### F20 / P2 — 연구 품질과 자동 검사 수를 분리할 것

정상 스키마/출처 URL/문서 수/페이지 통과는 콘텐츠의 경제적 의미·현재 사실·사용자 효용을 인증하지 않는다. 현재 publicationReady/humanReviewComplete가 false인 것은 정직한 경계다. 학습/Atlas를 늘리는 것보다 하나의 종목 선별을 사용자가 재현하고 비교하고 되돌아갈 수 있게 하는 편이 스크리너의 가치에 직접적이다. 투자 수익성, 개인 적합성, 전문 실시간 피드 수준은 이번 감사로 증명되지 않았다.

## 유지할 설계

- 순수 모델을 DOM·네트워크에서 분리한 방향과 기존 계산 parity fixture.
- 사용자 데이터 opt-in, 검증된 암호화 경로, 외부 쓰기/배포 승인 경계.
- 정적 원본과 bounded runtime projection의 분리, 이미 구현된 lazy route와 dispose/cancellation 소유권.
- 소스/브라우저/live를 나눈 검증과 task hash baseline, exact failed-group retry.
- 연구 참고값과 관측 사실의 구분. 다만 표시 허용과 판단 허용을 더 분명히 분리해야 한다.

## 다음 개편 순서와 완료 조건

| 순서 | 작업 | 완료 판정 |
|---|---|---|
| 1 | 데이터 표시/계산 readiness 분리 | 오래된 artifact에서도 허용된 identity·기준일 있는 원자료는 보이고, 필요한 파생값만 보류. missing/주말/부분 provider 실패/복구 fixture와 실제 화면 흐름 검증 |
| 2 | evidence 발급·해석 단일화 | negated/unknown use 문자열이 승격되지 않음. source/observation time/권리 검토/수집 실패를 분리. display 자료량과 잘못 차단한 건수를 함께 측정 |
| 3 | 실제 ScreenRun 재현 | 정의·모델·universe·필드 observations 저장 후 외부 API 없이 동일 결과 재생. 동일 snapshot ID에서 payload가 바뀌지 않음 |
| 4 | factor 정확성 경계 | 행별 freshness/결측 마스킹과 peer 분모, 동점 top-set 정책, ranking multi-field 단위/방향 정의. 현 snapshot/오염 fixture/reverse-order 비교 |
| 5 | 핵심 사용자 연구 흐름 한 단위 이전 | screener→ticker→SEC→비교→복귀 완결, 기존 writer/event/timer 삭제 목록, facade 감소, route 시간/네트워크/오류 측정 |
| 6 | 미연결 모듈 처리 | test-only/shared-build/retired 명시, public runtime 자산에서 제외. 실제 필요할 때 연결하고 중복 구현하지 않음 |
| 7 | 실증/운영 품질 | 거래소별 세션·기업행사·시점별 universe, horizon별 실제 성과 수집. 외부 provider·scheduler·deployed SHA·SLO 관측. 데이터 정확성 표본 대조와 인간 사용성 평가 |

신규 기능 수, native wrapper 수, 검사 개수를 성과 지표로 쓰지 않는다. 유효 자료 표시율, 잘못 숨긴 필드 수, 관측 지연, 계산 재현률, legacy writer 감소, 주 연구 흐름 완료율과 실제 오류를 함께 본다.

## 검증 기록

아래는 이 감사에서 실제 실행한 로컬 검증 결과다. 전체 릴리스 인증은 실패 상태이며, 부분 PASS를 전체 PASS로 승격하지 않는다.

- 초기 contracts: 93개 중 92 PASS, data-lineage 1 FAIL. stale data.json / market-snapshot.json을 기록했다.
- 독립 probes: 수정 전/후 동일 입력 차이를 JSON으로 보존. 추가 null coverage/baseline/delay는 기존 native-decision/market-snapshot gate의 양성·음성 fixture로 검증.
- 연구 모델·기존 domain parity: PASS. 기존 7 score / 8 RRG / 8 stage / 8 news / 8 curve / 8 portfolio / 5 factor fixture를 유지했다.
- 초기 browser-runtime(v54.72): 6개 중 4 PASS(AI public mocked route, boot, 20-route architecture, vertical slices), 2 FAIL(market epoch/screener auto refresh). provider의 stale-artifact 전체 차단을 직접 재현했다. 수정 후 버전 인증으로 승격하지 않는다.
- v54.73 전체 headless: 최초 1,119/1,124 PASS. 구식 기대값 5건 수정 후 exact failed groups 4개 PASS. 최종 109개 그룹 전체 재실행 **1,124/1,124 PASS**. 외부 요청 18건은 fixture의 의도된 차단이므로 실제 공급자 성공이 아니다.
- v54.73 browser-surface: critical surface / Vault / 20-route automated accessibility 3/3 PASS.
- v54.73 browser-knowledge: artifact budget / Atlas / Principles / Masters / learning flow 5/5 PASS.
- v54.73 viewport: 1280/1440/1920의 세 너비 × 20개 라우트 PASS. 모바일 범위는 이 검사의 대상이 아니다.
- v54.73 resilience: 반복 라우트 전환, 장애 fixture, SW controller, boot network budget 4/4 PASS.
- 최종 `affected --session deep-audit-20260831 --no-cache`: **70 PASS / 1 FAIL / 15 SKIP**. FAIL은 data-lineage의 data.json(12h)/market-snapshot(24h) SLA 초과이며 감사 중 약 47시간이었다. phase 차단으로 SKIP된 브라우저와 별도로 실행한 위 브라우저 기록은 구분했다. workspace 필수 생성 상태·계약·지식 lint·skill 계약/fixture·agent 동기화 검사 모두 PASS. `git diff --check` PASS.
- 미검증: 실제 사용자 수동 검토, screen reader, 전수 문장 의미, 실시간 공급자, 외부 배포·권리, 모든 horizon 실증. 자동 접근성 PASS는 수동 WCAG 인증이 아니다.

큰 개편을 마쳤다고 선언하지 않는다. 이번에 검증한 수정과 남은 구조 과제를 분리하여 인계한다.
