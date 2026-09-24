# 독립 재검토 — 구조 핸드오프의 현재성·완결성

**후속 설계 연결:** 이 문서는 발견 당시의 독립 감사 기록이다. 보완 후의 현재성·P 연결은 [25](25-CURRENT-FINDING-STATUS-CROSSWALK.md), 구현 전 결정·작업·인수 계약은 [26](26-EXECUTION-AND-ACCEPTANCE-PLAN.md), 영역별 세부안은 00–23의 해당 문서에서 읽는다. 설계 반영만으로 아래 제품 결함이 수정된 것은 아니다.

아래 `R24-*`는 이 감사 문서 안에서만 쓰는 발견 번호이며, 저장소 `RULES.md`의 R 번호가 아니다.

2026-09-23 KST. 기준: `v56.15`, HEAD `2195722dab571eaca0335249d02e84abdd128e94`. 기존 README·22·23 및 증거 JSON의 미커밋 변경은 사용자 소유로 보존했다. 제품 코드와 기존 핸드오프 파일은 수정하지 않았다. 스킬은 사용하지 않았다.

## 판정과 증거 경계

이 묶음은 **구조 개편의 방향, 주요 금융 의미 경계, 미검수 범위가 잘 정리된 누적 설계 초안**이다. 특히 [19](19-DESIGN-DECISIONS-AND-MIGRATION.md)의 대안·이행·복구 기준, [20](20-COVERAGE-AND-ACCEPTANCE-LEDGER.md)의 20개 라우트와 사각지대, [22](22-PORTFOLIO-PERFORMANCE-RISK-REDESIGN.md)·[23](23-CURRENT-BASELINE-AND-ALLOCATION-CONTRACT.md)의 계좌 성과/시뮬레이션 구분은 유효한 출발점이다. 자료 자체도 전수 의미 검수나 최적 구조의 실증을 주장하지 않는다.

그러나 **완전하거나 바로 일괄 구현 가능한 최종 명세는 아니다**. 아래에는 현재 코드로 확인된 계약 결함, 정적 경로상 잔여 위험, 문서 상태 추적의 공백이 있다. 구현자는 과거 문서의 문제를 전부 열린 버그로 취급하거나, 최근 P 항목이 있다는 이유로 전체 설계 과제가 끝났다고 취급하면 안 된다.

검토 방식: 이 폴더의 기존 Markdown 28개·JSON 21개·PNG 11개를 영역별로 검토하고, 현재 코드·레지스트리·관련 P 항목을 대조했다. JSON 21개는 모두 파싱됐고 당시 로컬 문서 링크 58개는 모두 존재했다. PNG는 과거 화면 증거로 읽었으며 현재 v56.15 화면 인증에는 사용하지 않았다. [route registry](../../architecture/route-owners.json)의 20개 항목은 20의 표에 모두 있다. 이 기계적 점검은 콘텐츠의 금융 타당성 증명이 아니다. 이번 감사에서 새 라이브 브라우저·원격 공급자·실사용자 시험은 하지 않았다.

## 먼저 닫아야 할 발견

| ID | 확인한 공백과 증거 수준 | 핸드오프 보강·인수 조건 |
|---|---|---|
| R24-01 현재성 정본 | [README](README.md)의 5행은 최신 기준을 v56.01로, 9행은 v56.15로 적고 패키지 표는 20에서 끝난다. 01/05/12/17/21의 일부 발견은 P1143, P1164–P1169, P1172–P1173에서 수정되거나 부분 구현됐는데 패키지별 상태표는 그 전이다. 23은 B02 예외와 일부 포트폴리오 발견만 갱신한다. 문서·원장 대조. | finding ID별 `발견 SHA → 현재 SHA → 상태(열림/부분/반증 차단/기각) → 남은 인수 → 코드·게이트 근거` 단일 crosswalk를 만든다. 21–23을 목록에 넣고, 구 구현 지시를 완료/잔여로 분리한다. |
| R24-02 시세 metric 의미 | [03 W03-A](03-DATA-CONTRACTS.md)의 validator는 registry의 종목·단위를 대조하지만 quote `metricId`를 기대 metric과 대조하지 않는다. 저장된 snapshot의 첫 quote에서 metricId만 `wrong.metric.id`로 바꾼 순수 함수 실행에서 `validateMarketSnapshot`은 `ok:true`였다. 실제 발행물 손상은 관찰하지 않았다. | 기대 metricId와 quote/source kind를 registry 계약에 묶고 mismatch를 fail-closed로 처리한다. 올바른 종목·단위와 틀린 metricId인 양성/음성 반증을 CI와 화면 의미 인수에 추가한다. |
| R24-03 팩터 관측 시각 | [15 D04](15-INSTRUMENT-AND-OBSERVATION-TIME.md)의 producer는 `factorBarStart`, 세션·time-basis 필드를 일부 기록하지만 screener provider/normalizer는 대부분 전달하지 않고 runtime reader는 bar-start `factorObservedAt`을 일반 `observedAt`으로 노출한다. `factorQuality`도 timestamp 존재만으로 CURRENT가 될 수 있다. 현재 코드 경로 확인. | D04를 부분 구현으로 표시한다. producer→artifact→provider→normalizer→runtime/store→시장별 행·UI까지 bar-start, 종가 가용시각, 계산시각, 품질 상태를 추적하는 fixture를 둔다. |
| R24-04 스크리너 입력 정체성 | `snapshotIdentityRows`는 직접 live mcap 필드를 제외하지만 중첩 `fieldReadiness`·`fieldObservations`에는 live market-cap 값/시각이 남는다. 같은 artifact/universe의 5행에서 AAA live mcap만 1B→10B로 바꿔 provider→size factor를 실행하니 AAA score/rank는 `75/100 → 25/0`, snapshotId도 `3bef8131 → 352b12a7`로 바뀌었다. **같은 ID에 다른 결과가 저장된 사례는 재현하지 않았다.** | [07](07-SCREENER-MODEL-LOGIC.md)·19에 artifact input ID와 live 값에 의존하는 calculation input/result ID의 관계를 명시한다. size factor가 frozen artifact mcap을 쓰거나 live mcap revision을 새 run 입력으로 고정하도록 선택한다. 동일 artifact·다른 live mcap, 저장 run 보존, 새 결과 정체성의 인수를 분리한다. |
| R24-05 포트폴리오 누락 자산 | `src/domain/portfolio/backtest.js:272–275`는 가격 이력이 없는 보유 ticker를 먼저 제외하고 남은 멤버를 이후 100%로 재정규화한다. [22](22-PORTFOLIO-PERFORMANCE-RISK-REDESIGN.md)·23은 현금/제외/부분 비중을 논하지만, **의도한 보유 종목의 가격 시계열이 없는 경우**의 정책은 인수에 없다. 정적 코드 경로 확인. | AllocationSnapshot을 만들기 전에 의도 멤버 전원의 기간·가격 자격을 검증한다. 누락분을 무언의 재배분으로 바꾸지 말고 실행 보류 또는 명시적으로 선택한 현금/잔여 정책을 적용한다. 한 종목의 가격만 누락된 fixture를 추가한다. |
| R24-06 포트폴리오 경로·통화 | `refreshPortfolioRisk`는 현재 시세 비중을 과거 모든 일별 수익률에 반복 적용하고 현금을 제외한다(`js/aio-workspace.js:893–920`). 이는 실제 계좌 보유 이력과 다른 계산이다. 또한 reader/provider에서 `costCurrency`, `baseCurrency`, `cashCurrency`가 떨어질 수 있고 `surface.js:225–230`은 cost와 market price를 통화 확인 없이 뺀다. 정적 경로 확인. | [22](22-PORTFOLIO-PERFORMANCE-RISK-REDESIGN.md)에 risk path 종류(실제 보유 이력/현재 구성 소급/고정 비중), 재조정 규칙, as-of, 현금 수익을 필수로 둔다. [11](11-PORTFOLIO-DURABILITY-AND-CURRENCY.md)은 Vault→reader→provider→normalizer→P&L→UI까지 통화 보존과 불일치 시 계산 보류를 인수한다. |
| R24-06A 현재 구성 기준 | [23](23-CURRENT-BASELINE-AND-ALLOCATION-CONTRACT.md)의 `current_composition_retrospective`는 현재 비중을 어느 valuation snapshot·가격·FX·시각에서 확정하는지 지정하지 않는다. 현 PFR01의 기간 마지막 adjusted close×수량 폴백을 폐기해도 새 모드의 출처가 빈 채 남는다. 정적 설계 대조. | 각 멤버의 resolved weight source, 수량 기준, 가격/FX 관측시각, 통화와 평가 ID를 AllocationSnapshot에 보존한다. 현재 구성 소급 모드만 그 고정 snapshot을 과거에 적용한다. |
| R24-07 예정 실행 분모 | [17 O04](17-AUTOMATION-DELIVERY-AND-OBSERVABILITY.md)은 도메인별 예정 실행률을 요구하고 P1166이 이를 일부 구현했다. 그러나 `scripts/build-operations-slo-window.mjs:132–135,192`는 `workflow_dispatch`만 빼고 `push` 등 나머지를 모두 scheduled로 센다. 30일간의 성공한 screener `push` 실행만 넣은 순수 SLO 계산도 해당 lane을 MEASURED, 30일 상태를 PASS로 만들었다. 실제 원격 운영 실패는 관찰하지 않았다. | workflow의 실제 예정 event·cadence와 실행 ID를 분모/분자에 연결한다. push, 수동, 재시도, schedule 지연·미실행·휴장을 각각 넣은 반증을 추가한다. 17의 O04–O07은 P1166/P1169/P1173 이후 완료·부분·원격 미검증 상태로 갱신한다. |
| R24-08 navigation 이행 | [00](00-CORE-ARCHITECTURE.md) 상단은 W00 구현을 기록하지만 126행의 표는 W00 전체를 다시 첫 작업으로 제시한다. 현재 facade는 `originalShowPage` 효과를 먼저 낸 뒤 router transition을 호출하고, router same-route fast path는 `viewState` 변화를 보지 않는다. 정적 경로 확인. | W00을 완료/잔여로 분리한다. route/entity가 같고 detail·query/viewState만 다른 전환, history·DOM·scope의 원자성, import 실패 복구를 인수한다. |

## 영역별로 유지해야 할 열린 과업

- **사용자 화면·콘텐츠:** [04 C03](04-CONTENT-SEMANTICS.md)은 manager 전체 coverage와 top-10 preview를 UI에서 혼동하는 경로가 현재도 남는다(`scripts/build-masters-runtime-artifacts.mjs:222–252`, `src/ui/pages/masters.js:695–719`). [21 B02](21-LIVE-LOCAL-SEMANTIC-REDESIGN.md)의 HYG null 예외는 P1164로 수정됐지만 선택 종목·지표·차트의 서로 다른 scope/result라는 더 큰 계약은 남는다.
- **AI:** [05 A06](05-AI-EVIDENCE-FLOW.md)의 “나에게 MSFT 매수 추천해줘”는 intent와 conduct/legacy permission 분류가 다를 수 있고, 공개 단계가 request의 `actionLimitations` 대신 재계산 결과를 쓰는 경로가 남는다. 실제 모델 답변 문제로 승격하기 전에 양쪽 chat entry와 역순 응답 fixture로 확인한다. A04/A05는 P1172의 부분 수정과 전역 citation·unbound evidence 잔여를 따로 기록한다.
- **검색·권리·보안:** [18](18-SEARCH-TO-VERIFIED-DATA.md)의 ResearchCandidate 필드와 [19](19-DESIGN-DECISIONS-AND-MIGRATION.md)의 Observation/Publication 계약에 출처별 권리 ID, 원문 보존 허용, 재배포 허용, 만료·삭제 상태의 연결이 없다. 19는 prose로 retention을 요구하지만 승격·공개 게이트가 검사할 필드를 정하지 않았다. [16](16-PRODUCT-FIRST-DATA-STRATEGY.md)의 위협 모델·개인정보·접근·삭제 미검수를 19의 파일럿 선행 작업과 출시 게이트에 연결한다.
- **증거와 사용자 인수:** [21](21-LIVE-LOCAL-SEMANTIC-REDESIGN.md)의 live/local 20-route 표는 관찰 요약으로 유용하지만 raw 브라우저 trace와 이번 증분 스크린샷이 번들에 없다. route·action·시각·코드/배포 SHA·화면/콘솔 증거 ID를 함께 저장해야 독립 재검토가 가능하다. [12](12-USER-VISIBLE-REASONING.md)·20의 이해도/접근성 인수에는 참여자 유형, 과업, 오해 실패 조건, 키보드·스크린리더 범위와 사전 합의된 기준이 더 필요하다. P1165의 3 preset·전 행 unavailable 시험으로 6 preset과 실제 통과 집합의 동등성을 인증할 수 없다.

## 권고 실행 순서

1. **상태 crosswalk와 우선순위를 먼저 고정한다.** 새 버전에서 이미 닫힌 재현, 부분 수정, 여전히 열린 구조 과제를 구분한다. 23의 PFR01/PFR06 번호 충돌도 코드 주석·릴리즈 기록과 동의어 맵으로 연결한다.
2. **거짓 값이나 거짓 PASS를 만들 수 있는 계약을 반증으로 닫는다.** R24-02, R24-03, R24-05, R24-07을 각각 작고 독립적인 입력→소비자 fixture로 만든다. R24-04는 저장 run 불변성과 새 계산 정체성을 함께 검증한다.
3. **한 사용자 과업을 end-to-end로 이행한다.** 19의 screener 파일럿 또는 portfolio의 명시 배분 파일럿을 선택해 writer, 불변 입력, 계산, 설명, 저장, replay, 구 경로 폐기, rollback, 화면 인수를 한 묶음으로 닫는다. 플랫폼 선택은 실측 비용·지연·권리·운영 제약 뒤 확정한다.
4. **나머지 기능을 조사 완료로 표시하지 않는다.** options, 전체 기술 기법, 기업행동/PIT universe, 실제 계좌 원장, AI 실제 응답, 20-route 내부 상태, 접근성·사용성, 원격 delivery는 각 증거를 확보할 때까지 열린 범위로 둔다.

이 문서는 제품 결함을 수정하거나 기존 핸드오프를 대체하지 않는다. 새 발견의 사실성과 영향은 위의 증거 수준만큼만 주장한다. 구현·커밋·푸시·배포는 수행하지 않았다.
