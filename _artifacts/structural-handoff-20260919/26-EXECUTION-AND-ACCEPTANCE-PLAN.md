# 구조 개편 실행 설계 — 결정, 작업 카드, 인수 증거

2026-09-23 · 설계 기준 v56.15 / HEAD `2195722dab571eaca0335249d02e84abdd128e94`. 제품 코드·데이터·설정의 변경 지시서이며 이 문서 작성 자체는 구현·승격·배포가 아니다. [25 현재성 표](25-CURRENT-FINDING-STATUS-CROSSWALK.md)로 이미 막힌 반증과 열린 작업을 먼저 구분하고, [19 선택 근거](19-DESIGN-DECISIONS-AND-MIGRATION.md)를 상위 원칙으로 사용한다. 이 문서의 카드와 상세 패키지 사이에 충돌이 있으면 현재 코드 증거와 명시적 인수 의미를 대조해 결정 기록을 남긴다.

## 제품 질문과 첫 수직 과업

우선 사용자는 종가·공시 기준으로 미국/한국 주식의 후보를 좁히고, 제외 이유와 반증을 확인하며 논지를 저장·복기하는 자기주도 연구자라는 **잠정 가정**이다. 첫 수직 과업은 `프리셋 선택 → 같은 입력의 미리보기/실행 → 후보·제외·보류 이유 → 종목 근거 → 저장/replay`다. 이 과업은 우선 사용자·데이터 cadence·비용을 실제로 확인할 수 있는 작은 범위다. 포트폴리오 배분/위험은 독립 두 번째 파일럿으로 진행한다. 사용자 연구가 다른 요구를 입증하면 19의 플랫폼·우선순위를 다시 결정한다.

모든 카드의 종료 정의: ① 현재 writer·input source를 열거하고, ② 하나의 결과 owner와 폐기할 compatibility writer를 정하고, ③ 고정 입력의 음성·양성 fixture를 실행하고, ④ 사용자 화면·저장/replay·오류 복구를 대조하고, ⑤ 현재성·증거 수준을 25에 갱신한다. 파일 수 감소만으로 종료하지 않는다.

## 공통 객체와 불변식

| 객체/계약 | 필수 의미와 소유자 | 검사할 불변식 |
|---|---|---|
| `Observation` / normalizer·원장 | `observationId`, `instrumentRef`(listing/venue/assetType 유효시점), `metricId/definitionVersion`, value/unit/currency, period/session, `barStart/availableAt/observedAt/retrievedAt`, source revision, quality/allowedUse, `rightsContractId`, supersedes | metric ID·quote kind·단위가 registry 기대와 맞는다. barStart는 종가를 알 수 있던 시간으로 변환하지 않는다. 정의/통화/시각 불명은 명시적 null과 reason. |
| `PublicationSet` / 발행 coordinator | set ID, 파일별 불변 hash/schema, compatible model/reference revision, dependency·필수/선택 상태, receipt ID, publication time | 가변 URL 세 개를 우연히 같은 세대로 추정하지 않는다. 읽기 실패 시 마지막 적격 묶음 또는 기능별 부분 보류. 권리 만료 객체는 승격·재배포 불가. |
| `CalculationInput` / 도메인 실행기 | artifact publication IDs, 실제 factor operand IDs/values/hash, universe/definition/model version, 정책(가격/FX/기업행동), 계산 시각 | 표시·진단용 live 값과 계산 입력을 분리. 랭킹에 영향을 주는 live mcap은 frozen 입력 ID를 바꾸거나 factor에서 제외. 동일 ID의 실제 입력이 달라지지 않음. |
| `AnalysisRun`·`Explanation` / 도메인·presentation | `runId → calculationInputId`, pass/eligible/ranked 상태·reason, operand·기여·반증, explanation revision, user/pipeline origin | preview/execute가 같은 정의·입력에서 같은 판정 집합. 보관 run은 background tick으로 변하지 않고, UI/AI/내보내기는 같은 result ID와 의미를 사용. |
| `AllocationSnapshot`·`RiskDefinition` / portfolio domain | mode, intended/resolved members, explicit 0/null/exclude, cash/leverage, valuation cut, quantity/price/FX/time source, risk path, rebalance, period, unit | 가격 이력 없는 멤버를 조용히 버리지 않음. start-date/explicit 배분은 미래 종점 가격 변화에 불변. account 실제·current retrospective·fixed-weight 가상 경로는 다른 타입/라벨. |
| `JobReceipt` / source job·운영 | domain, scheduled event/time, attempt ID, attempted/updated/retained/failed, quality, output hashes, publication/consumer confirmation | exit 0, 수동·push 실행, 이전 값 유지가 예정 도착을 대신하지 않음. `schedule`과 재시도/휴장 정책에 따라 분모를 고정. 미관측을 CURRENT로 표시하지 않음. |
| `ResearchCandidate`·`RightsContract` / 검색 보강·권리 owner | 원문 위치/해시/추출값·정의/기간, 검증·review, rights ID, canPersistRaw/canRedistribute/retentionUntil/deletionAction, permitted fields/uses | 검색 snippet이나 AI confidence만으로 Observation 승격 금지. 권리 미확인은 원문 지속 저장·공개 기본 허용이 아님. 삭제 시 tombstone과 재현 가능 범위 보존. |

위 객체는 최소 의미 스키마이며 한 DB/서비스를 요구하지 않는다. 같은 이름의 필드가 도메인마다 다른 뜻이면 타입·정의 버전을 나눈다. ID는 단순 시각이 아니라 실제 의존 입력에서 파생하고, nested field까지 hash 입력 투영을 점검한다. 권리·개인정보·사용 목적은 공개 결과와 별도 private vault 경계에서 판정한다.

## 실행 카드와 의존 관계

| 카드 | 선행·최종 owner | 계약·전환 범위 | 차단 fixture 및 완료 증거 |
|---|---|---|---|
| E0 현재성·원본 보존 | [25](25-CURRENT-FINDING-STATUS-CROSSWALK.md); 각 패키지 owner | 현재 writer/소비자 맵, 기준 SHA와 원본 저장 포맷, deprecated reader, shadow 종료 조건을 기록한다. P1176의 `22 PFR01` 주석은 의미 제목으로 PFR06에 매핑하고 역사 기록은 그대로 둔다. | 기존 run/portfolio 사본 export·복원, 이미 막힌 반증 불필요 재작업 방지, 변경 전후 입력·결과 차이표. |
| E1 시세 의미·시간 | [03](03-DATA-CONTRACTS.md)·[15](15-INSTRUMENT-AND-OBSERVATION-TIME.md); data-contract owner | `metricId`/kind·단위 검증, 시장별 close availability, factor barStart→UI lineage를 먼저 닫는다. producer가 만든 필드가 provider/normalizer whitelist에서 사라지면 승격 금지. | 정상 quote 통과와 종목·단위는 맞지만 metric만 틀린 quote 거부; DST/휴장/조기폐장·barStart·지연 계산 입력에서 시각·품질 라벨 일치. |
| E2 스크리너 결과 | E1 + 호환 PublicationSet; screener-domain owner, UI 단일 consumer | artifact snapshot과 실제 calculation input/result ID를 분리해 [07](07-SCREENER-MODEL-LOGIC.md)·[12](12-USER-VISIBLE-REASONING.md) 실행을 고정한다. 기존 legacy writer는 shadow 비교 후 한 경계씩 퇴역. | 같은 artifact+서로 다른 거부 quote에는 frozen run 불변; live mcap이 rank에 쓰이면 새 계산 입력/새 run, 아니면 rank 불변. 6 preset에 유효 ranked/pass/fail/unavailable 행을 넣어 preview=execute, Why, 저장/replay 확인. |
| E3 포트폴리오 정의·통화 | [02](02-PORTFOLIO-STATE.md)·[11](11-PORTFOLIO-DURABILITY-AND-CURRENCY.md)·[23](23-CURRENT-BASELINE-AND-ALLOCATION-CONTRACT.md); allocation/valuation owner | 목표가격과 목표비중, 0/null/exclude/현금, 누락 멤버 정책을 먼저 결정. Vault→reader→provider→normalizer→valuation/UI에서 원가·시세·현금 통화와 FX cut를 보존한다. | `[0,0]`, `[0,null]`, `[0,100]`, 가격 이력 없는 보유 멤버, USD/KRW·원가/시세 통화 불일치, 저장 실패·잠금·복구를 결과/표시까지 확인. 무언 재배분·무환산 P&L·거짓 저장 완료 금지. |
| E4 성과·위험 | E3; performance/risk 별도 owner | [22](22-PORTFOLIO-PERFORMANCE-RISK-REDESIGN.md)의 실제 계좌 성과, 현재 구성 소급, 연구 시뮬레이션, 현재/과거 위험을 다른 결과로 발행. 현금흐름·비용·배당·분할·FX, path/rebalance/RF/benchmark/tail N을 별도 입력으로 고정. | 미래 마지막 가격만 바꿔도 명시/시작 배분 불변, 실제 원장 없으면 account TWR/MWR 보류, cash 50%/주식 −10%의 전체 −5%와 주식 부분 −10%, 13수익률·tail 1개에서 인증 보류. |
| E5 발행·운영 | E1·E2의 한 projection; publication/operations owner | [17](17-AUTOMATION-DELIVERY-AND-OBSERVABILITY.md)의 receipt, schedule-only SLO, manifest 전환과 소비 확인을 한 경로에서 구축하고 확장. checked-in template은 원격 인증으로 읽지 않는다. | screener 0회, push만 성공, retry, timeout, pagination truncate, 원격 SHA/manifest mismatch, 새 파일 일부 404, old tab/new SW를 구분. 실제 scheduled arrival·consumer 도달을 관찰한 뒤에만 SLO 인증. |
| E6 AI·검색·사용자 설명 | E2·E5; request policy/evidence owner | [05](05-AI-EVIDENCE-FLOW.md)·[18](18-SEARCH-TO-VERIFIED-DATA.md)의 두 chat 진입점에 immutable request policy와 claim/publication gate를 공유. 검색 문서와 정형 숫자 승격을 분리하고 권리 판정 연결. | “나에게 매수 추천” 분류·제한 일치, unbound 숫자/무관 citation/역순 응답/취소, 원문 불일치, 권리 만료, candidate 검증 실패를 모두 fail-closed. 일반 교육 답변의 과차단도 반대 fixture로 검사. |
| E7 나머지 의미 범위 | E1–E6에서 필요한 계약 재사용; route/domain별 owner | [20](20-COVERAGE-AND-ACCEPTANCE-LEDGER.md)의 options·기술 기법·PIT universe·기관공시·콘텐츠·학습·모바일·접근성을 각 수직 경로로 처리. ‘route 방문’과 ‘함수 의미 완료’를 구분한다. | 각 route에서 입력→계산→소비→설명→오류·복구의 증거; 원문·경제적 의미 사람 검수; 키보드/보조공학 및 과업 시험. |

E1과 E3은 독립 조사가 가능하다. E2가 E1의 판정 전 가변 자료를 과거 run으로 저장하거나, E4가 E3의 통화·배분이 결정되기 전에 계좌 성과를 발행하면 안 된다. E5의 한 projection publication은 E2 파일럿부터 최소 manifest로 시작하되, 모든 도메인 동시 이전을 기다리지 않는다. 구현 패키지마다 관련 QA gate의 실제 선택 여부를 확인하고, 실패 전체 배치를 수정한 뒤 정확한 실패 gate를 재검증한다.

## 전환·복구·삭제 결정

1. 구 reader와 새 reader의 동일 입력 shadow 비교는 임시다. 종료 기준은 값 일치가 아니라 의도된 의미 차이를 승인된 model revision·이유·화면 라벨로 설명할 수 있고, 양성/음성 fixture·저장 복원을 통과하는 것이다.
2. 구 저장 실행은 원본 input/result/schema를 보존해 historical read-only로 보이거나 명시적 선택으로만 재실행한다. 현재 데이터를 넣어 과거 result ID를 재해석하지 않는다. 구 포트폴리오 `target:0`은 P1176의 당시 직렬화 정책을 고려해 미설정으로 읽되, 명시 0% 비중은 제외 의도로 보존한다.
3. 새 경로가 실패하면 마지막 **동일 계약의 적격 publication/result**로 돌아가거나 그 기능을 보류한다. 결측→0, 누락 멤버→재분배, 종점 가격→초기배분, 통화 없는 합산, unbound AI claim을 구형 fallback으로 되살리지 않는다.
4. 저장·원문·개인 자료 삭제는 rights/retention와 참조 중인 manifest/run을 확인한 뒤 별도 운영 결정을 거친다. 원문 삭제 후도 재현 범위를 과장하지 않는 tombstone을 남긴다. 파괴적 migration·commit·배포는 이 문서로 승인되지 않는다.

## 보안·권리 선행 설계

첫 파일럿에서 데이터가 `공개 원천 → 수집 job/CI secret → 불변 publication → 브라우저 캐시/SW → 개인 Vault → AI 외부 요청`을 넘는 경계를 표로 만든다. 경계별로 정보 종류, 허용된 수신자, 저장 위치·기간, 사용 목적, 인증/권한, 로그·백업·삭제와 공급자 약관을 기록한다. 특히 public manifest에 개인 보유·메모가 들어가지 않고, AI 전송은 현재 동의 범위와 실제 payload가 맞아야 한다.

위협/실패 사례는 CI 권한·secret 노출, 잘못된 출처의 원문 재배포, stale/서로 다른 세대의 데이터 승격, browser storage 분실·잠금 해제 오류, prompt injection, 요청별 citation 혼합, API quota/남용, 삭제 후 캐시·백업 잔존이다. 각 사례에 예방 owner·검출 신호·복구/삭제 행동과 검증 fixture를 정한다. 권리 정보가 없으면 원문 보존·공개를 차단하되, 허용된 링크·필드와 필요한 provenance까지 무조건 제거하지 않는다. 보안·권리 판정과 사용자 과업 성공은 별개의 출시 조건이다.

## 사용자·접근성 인수 프로토콜

실제 사용성 기준을 임의의 사후 숫자로 맞추지 않는다. 파일럿 시작 **전에** 초보/숙련 자기주도 연구자의 모집 조건, 과업·데이터 fixture, 관찰 방법, 성공 기준·치명적 오해, 중단/복구 조건을 등록하고 초기 표본으로 시간·도움 요청 분포를 측정한다. 같은 과업을 키보드만 사용, 주요 스크린리더, 좁은 뷰포트에서도 수행한다. 시험 참여자의 개인 계좌·자격증명은 사용하지 않는다.

필수 과업은 ① 현재 비교집단·기준일/통화 찾기, ② 후보 선정/제외/보류를 구분해 설명하기, ③ 결측과 유효 0/낮은 점수 구분하기, ④ 가정 하나 변경 후 달라질 결과 예측하기, ⑤ 원문·반대 근거 열기, ⑥ 저장 run과 새 run을 구분해 복기하기다. 상대 점수를 수익 확률로, 오래된 관측을 현재 값으로, 계산 불가를 저평가로 읽거나, 다른 종목·다른 통화 결과를 같은 것으로 취급하면 해당 과업은 실패다. 포커스가 사라져 완료/복구가 불가능하거나 핵심 근거를 보조공학으로 찾을 수 없으면 접근성 인수 실패다. 성공률·완료시간 목표는 실제 baseline과 제품 요구를 보고 **사전 등록한 뒤** 변경 이유를 기록한다.

## 증거 패키지와 보고 형식

각 수직 인수는 `testCaseId, findingId, codeSha, dataPublicationIds, modelVersion, environment, route, actionSequence, input fixture hash, expected/actual, timestamp/timezone, evidence level, result, artifact paths, unresolved risk`를 가진다. 브라우저·live에는 배포 `sourceSha`, viewport, SW/cache 세대, 콘솔 오류, 요청 실패, 스크린샷 또는 구조화 DOM trace를 추가한다. 개인 키·보유 자료·검색 원문 사용권 위반 내용은 저장하지 않는다. [21](21-LIVE-LOCAL-SEMANTIC-REDESIGN.md)의 역사 표는 재현용 raw trace가 없으므로 새 실브라우저 인수에서 이 포맷으로 다시 수집한다.

보고는 정적 계약/순수 합성/헤드리스/실브라우저/원격 live/장기 운영/사용자 시험을 독립 행으로 기록한다. 낮은 수준 PASS를 높은 수준 완료로 승격하지 않는다. 데이터 freshness 실패로 affected가 하위 브라우저 그룹을 SKIP하면 SKIP을 PASS로 쓰지 않고 실제 그룹 실행 또는 미검증으로 남긴다. 무엇이 검증됐고 무엇이 차단·미검증인지, 제품 코드·commit·push·deploy가 있었는지를 종료 보고에 적는다.

## 구현 진행 기록 — 재개 지점 (2026-09-24, v56.21, 로컬 working tree / 커밋·배포 없음)

이 절은 카드 정의를 바꾸지 않고, 어디까지 실제로 구현·검증됐고 어디서 재개하는지만 기록한다. 결함·fix·잔여의 상세는 `_context/BUG-POSTMORTEM.md` P1183~P1190, 영역별 현재성은 [25](25-CURRENT-FINDING-STATUS-CROSSWALK.md), writer/consumer 차이는 [E0](E0-WRITER-CONSUMER-MAP.md) §1·§4, 데이터 신선도는 `_context/QA-CHECKLIST.md`의 "data-refresh 상태" 절을 따른다.

| 카드 | 상태 | 근거(P·게이트) | 재개 지점 |
|---|---|---|---|
| E0 | 완료 | [E0](E0-WRITER-CONSUMER-MAP.md) | 없음 |
| E1 | 종료(정적·순수 합성 수준) | P1178·P1179·P1183(identity 잔여)·P1184(품질·basis); `ci-market-snapshot-contract-check`(16/16)·`ci-data-pipeline-contract-check`·`ci-research-model-contract-check`·`ci-esm-core-unit-check`·`ci-domain-parity-check` PASS | artifact 재생성(fetch-data) 후 실데이터·PIT 확인, 실브라우저 provenance/Why 표시 |
| E2 | 부분 — S-A·S-B·S-D 종료 | P1185(no-op hook·dead reader 퇴역, `legacySymbolsMustBeAbsent` 등록)·P1186(단일 투영 트리거); `ci-retirement-contract`·`ci-runtime-contract-check` PASS | S-C(shadow 비교 — legacy 번들 실행 하니스 부재로 browser 그룹 필요)·S-E(공통 helper)·S-F(IDB 개명은 마이그레이션 선행) |
| E3 | 종료(정적·순수 합성·실브라우저·데이터 계약 수준) | P1187(종목 원가 통화 writer·수정 경로 보존·import/전체삭제 ack)·P1188(계좌·현금 통화 writer)·P1194(FX 환산 — 선언된 관측 rate leg 입력·저장·5개 경계 통과, 사용 leg·창·실패 사유 게시)·P1196(원가축 환산 — 원가/시세 불일치의 P&L 성립, 값 실패는 전부 보류·원가 실패는 P&L만 보류); `ci-portfolio-vault-e2e` PFE2-12~20 PASS·`ci-esm-core-unit-check` P1194/P1196 PASS | 백테스트 랩 통화축, 통화쌍별 FX 창·삼각 환산 정책(design-intake), P&L·금리 백테스트 통화축 |
| E4 | 종료(정적·순수 합성·실브라우저 수준) | P1182(위험 선언 계약)·P1188(TWR/MWR 원장 엔진, 현금 수익률·RF·계좌/현금 통화 입력 UI)·P1190(VaR 표본 안정성 bootstrap·민감도 인증)·P1191(원장 입력 UI→Vault 경로 저장→TWR/MWR 표시, 인증 문구)·P1193(측정 경로·리밸런싱 정책 선언, 전략 경로 도달 가능)·P1195(선언 패널 마크업·ack 문구 네이티브 분해, 셸 -32)·P1197(소비되지 않는 선언 정리 — 회고 경로 정책 미요구·정체성 제외, 선언/적용 분리 발행)·P1198(선언 정직성 — 미선언·미인식 열거형 null, 지어낸 daily 제거); `ci-esm-core-unit-check`(P1182/P1193 갱신 + P1188·P1190·P1191·P1193·P1195·P1197·P1198 fixture)·`ci-portfolio-vault-e2e`(PFE2-12~21 포함 **24/24**) PASS | VaR `certified` 렌더 문구, 전략 경로 UX 잔여(정책 셀렉터 노출·`unrecognized` 표시·현금 미포함), Vault 저장 경로·위험 입력 조립의 분해 잔여 |
| E5~E7 | 미착수 | — | schedule-only SLO·receipt, AI request policy, 나머지 의미 범위 |

차단 상태(v56.23): `qa-runner affected --files index.html,js/aio-workspace.js,src/data/portfolio-ledger.js,src/domain/portfolio/backtest.js,scripts/fetch-data.mjs` = **pass 87 / cached 8 / fail 0 / skip 0**. **신선도 fail 2건과 skip 31이 모두 닫혔다** — P1192가 완료 컷 행의 previous-close 경계를 직전 bar로 제한해 P1095·history-time 충돌을 풀었고, 로컬 `fetch-data.mjs` 재실행으로 `data-lineage`(24 artifacts, FAIL 0)·`reconciliation`이 PASS가 되면서 데이터 노후로 SKIP되던 23개 브라우저 그룹이 실제로 실행·통과했다. 남은 한계는 시크릿이다: 로컬 무키 사이클이라 FRED는 LKG(`fredHasKey:false`)·LLM 분석문은 fallback이고 readiness fred 기준선은 `OPERATOR_REQUIRED`다 — 정식 사이클(`.github/workflows/refresh-data.yml`)로 덮어야 한다.

v56.22 변경분(P1191 원장 입력 UI): 동일 파일 목록의 affected 실행에 포함됐고 `ci-portfolio-vault-e2e`는 **standalone으로 20/20 PASS**(PFE2-16·17)다. `decomposition`은 `index.html` +45·`js/aio-workspace.js` +201을 `--write --allow-growth`로 기록했다 — 순수 계약은 `src/data/portfolio-ledger.js`로 추출했고 남은 것은 DOM·Vault glue이며, 후속 분해 항목을 QA에 등록했다.

**data-refresh 시도 결과(v56.21, 로컬)**: `node scripts/fetch-data.mjs`를 실제로 2회 실행했다. 1회차는 P1189(FRED 제공자 상태가 OPERATIONS_STATUS 밖 값)로 중단 → **수정·게이트 등록** → 2회차는 완료됐고 `reconciliation`·`data-lineage`가 PASS로 전환되는 것을 확인했다. 그러나 2회차 산출물은 `ci-artifact-semantics-check`(P1095)를 실패시켰다 — 00:00~04:00Z 창에서 FX/상품 일봉이 KST-08:00 뉴스 컷보다 뒤에 관측된 `previous-completed-close`를 발행한다. `ci-history-field-time-contract-check`가 같은 값을 **요구**하므로 두 게이트의 권위 결정이 선행돼야 한다(상세·verify_by는 QA-CHECKLIST "data-refresh 상태" 절). 결정 전까지 **갱신 산출물은 되돌렸고**, 위 fail 2와 skip 31은 미해소다. 정식 사이클은 CI 시크릿(FRED/ANTHROPIC/TWELVE_DATA)이 있는 `.github/workflows/refresh-data.yml`에서만 수행된다.

재개 순서(v56.32 갱신 — 위 "차단 상태"·"data-refresh 시도 결과"는 v56.23 기준 기록이며, 아래가 현재 상태다):

1. **닫힌 것**: E0, E1, E3(통화·저장 경계), E4(원장·성과·위험) — P1187~P1203. P1095 ↔ history-time 권위 문제는 **P1192**(완료 컷 행의 previous-close를 직전 bar 경계로 제한)로 해소됐고, 로컬 `fetch-data.mjs` 재실행으로 `ci-data-lineage-audit`(FAIL 0)·`ci-reconciliation-contract-check`가 PASS로 전환되면서 데이터 노후로 SKIP되던 브라우저 그룹이 실제로 실행됐다(`ci-portfolio-vault-e2e` 26/26). FX 환산은 P1194/P1196에서 **선언된 관측 rate leg**로 구현했고, E4는 P1200(목표비중 현금 몫 = 계좌 범위 선언)·P1203(VaR 인증 도달 가능성)까지 닫았다.
2. **남은 것(우선순위)**: ① E2 S-C/S-E/S-F — S-C는 legacy 번들을 실제로 실행하는 **shadow 실행 하니스**가 선행이다(현재 e2e가 외부 요청을 전부 abort하므로 legacy 실행 경로 자체가 없다). 시크릿이 아니라 코드·설계 작업이며 별도 배치 규모다. S-F(IDB 개명)는 마이그레이션 선행. ② 셸 위험 입력 조립(약 60줄)의 네이티브 분해(P1195/P1199 선례). ③ 백테스트 랩 통화축 — `backtest.js`에 통화 참조 0건, `fetch-data.mjs`는 FX 이력을 생산하지 않는다 → **과거 FX 시계열 공급원 결정**이 선행(BLOCKED). ④ `recent-half` 입력 순서 계약의 런타임 검증. ⑤ E5~E7(별도 세션 범위).
3. **시크릿 의존(로컬에서 닫을 수 없음)**: 정식 데이터 refresh는 `.github/workflows/refresh-data.yml`의 CI 시크릿(FRED/ANTHROPIC/TWELVE_DATA)에서만 수행된다. 로컬 무키 산출물은 LKG/폴백 라벨(`fredHasKey:false`, `anthropic-key-not-configured`)을 포함하므로 그대로 배포하면 그 라벨이 그대로 실린다 — 이번 커밋에 로컬 refresh 산출물이 포함됐다면 그 사실을 배포 후 readiness에서 재확인해야 한다.
