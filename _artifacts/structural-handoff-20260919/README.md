# AIO 구조 개선 핸드오프 — 누적 작업본

작성일: 2026-09-19 · 기획·설계·집필: Astra · 코드 근거 조사: GPT-5.6 Luna / MAX

**기존 00–26 문서의 역사 기준선: v56.15, 2026-09-23, 당시 HEAD `2195722dab571eaca0335249d02e84abdd128e94`.** 2026-09-24의 새 라이브 배포 SHA와 로컬 v56.21→v56.23 비교는 [27](27-LIVE-LOCAL-CODE-SEMANTIC-AUDIT-20260924.md)에 별도로 기록했다. v56.01/`2bf963a76c6f2fb1079166ce806beaaa820b1c6a`는 9/21 조사 당시 기준선이다. 00–02는 v55.21, 03–09의 원래 발견은 주로 v55.22의 역사 근거다. [v56 재검증](RECHECK-V56.md)은 당시 반증에 한정되며 현재 전체 인증이 아니다. 기존 미커밋 README·22·23·증거 파일은 보존한 위에 9/23 설계를 추가했다. 이번 감사 문서 작업은 제품 코드·설정·데이터를 변경하지 않았다.

## 이 자료를 사용하는 방법

**2026-09-25 최신 읽기 경로:** [33 새 SHA 20개 라우트 재점검](33-NEW-SHA-20-ROUTE-LIVE-RECHECK-20260925.md) → [32 사용자 링크·차트·뉴스·검증 구조](32-EXTERNAL-REFERENCES-CHART-NEWS-AND-TEST-DESIGN-20260925.md) → [31 Principles·Masters 본문/SEC 감사](31-PRINCIPLES-MASTERS-LIVE-CONTENT-AND-SEC-AUDIT-20260925.md) → [30 Atlas·Guide·포트폴리오 심층 감사](30-ATLAS-GUIDE-PORTFOLIO-LIVE-DEPTH-AUDIT-20260925.md) → [29 2차 라이브 콘텐츠 감사](29-SECOND-PASS-LIVE-CONTENT-AUDIT-20260925.md) → [28 페이지별 사용자 감사](28-PAGE-BY-PAGE-LIVE-USER-AUDIT-20260924.md) → [25 발견 상태](25-CURRENT-FINDING-STATUS-CROSSWALK.md) → [26 실행·인수](26-EXECUTION-AND-ACCEPTANCE-PLAN.md) 순으로 읽는다. 원격 `v56.33`은 **두 sourceSha**에서 관찰됐고 로컬 working tree는 별개다. 열람 수와 의미·원문·사용자 인수를 혼동하지 않는다. 이 증분은 핸드오프 문서만 작성하며 제품 코드·설정·데이터를 수정하거나 커밋·배포하지 않는다.

**2026-09-24 실브라우저 재점검:** [27 라이브·로컬·코드 의미 정합성 감사](27-LIVE-LOCAL-CODE-SEMANTIC-AUDIT-20260924.md)는 배포 v56.15와 로컬 v56.21→v56.23의 20개 라우트 방문, 대표 상호작용, 코드·데이터 계약을 대조한 추가 증거다. LC-01~16의 확정 결함·설계 후보·미검증을 구분하며, 기존 25/26의 현행 상태를 자동 대체하지 않는다. 구현 전에는 27의 재현·인수 조건을 25의 상태 원장과 26의 E0–E7 작업 카드에 연결한다.

**지금 구현 계획을 세울 때:** [25 v56.15 발견 상태 교차표](25-CURRENT-FINDING-STATUS-CROSSWALK.md)에서 역사 반증 차단·부분 구현·열린 구조 과제를 먼저 분리하고, [26 실행·인수 설계](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)의 선행 결정과 E0–E7 카드를 따른다. [24 독립 재검토](24-INDEPENDENT-STRUCTURAL-REVIEW-20260923.md)는 9/23 기준 추가 발견의 원래 감사 기록이다. 19는 제품·구조 선택 근거, 20은 전체 범위와 미검수 대장이다. 25/26은 00–23의 사실을 전수 인증하거나 제품 구현을 완료했다는 선언이 아니다.

**2026-09-22 추가 기준 v56.15 / HEAD `2195722dab571eaca0335249d02e84abdd128e94`:** [23 당시 재검증·배분 계약](23-CURRENT-BASELINE-AND-ALLOCATION-CONTRACT.md). 이전 v56.01 결함을 현재 미해결로 일괄 취급하지 않는다. 목표가격과 초기 배분 finding 번호 혼용은 23과 최신 25에서 연결한다.

**2026-09-22 추가:** [21 전체 페이지 라이브·로컬 비교와 의미 경로 재설계](21-LIVE-LOCAL-SEMANTIC-REDESIGN.md), [22 포트폴리오 성과·위험 재설계](22-PORTFOLIO-PERFORMANCE-RISK-REDESIGN.md)를 반영했다. 이번에는 외부 통신을 허용한 실제 브라우저에서 20개 경계를 양쪽 모두 방문하고 대표 사용자 동선을 실행했다. 20/20 방문은 전체 기능·금융 의미 검수 완료가 아니다. 아래 과거 외부 차단 브라우저 설명은 당시 증거에만 적용한다.

9/22 문서 증분 검증: `full-browser-20260922` baseline의 affected 14 PASS, 추가 knowledge/skill/fixture/ledger/assertion/profile/mirror 검사 통과, diff whitespace 오류 없음. 기존 역사 문서 encoding 경고 2건은 유지됐다. 검사 스크립트 실행은 스킬 사용이 아니며, 기계적 PASS는 금융 의미나 라이브 정상 인증이 아니다. 이 증분도 제품 코드·설정·데이터 수정과 커밋·푸시·배포 없이 종료했다.

**2026-09-21 재감사 당시 시작점:** [19 설계 결정·대안·이행](19-DESIGN-DECISIONS-AND-MIGRATION.md)과 [20 전역 범위·미검수 대장](20-COVERAGE-AND-ACCEPTANCE-LEDGER.md)이었다. 지금은 위의 25→26→19/20 순서로 읽는다. 기존 문서의 보존 전제와 초기 번호순 구현 요청보다 19·26의 계약·우선순위를 따른다. 어떤 문서도 전체 전수 완료나 최선의 구조가 실증됐다는 선언이 아니다.

이 문서는 전체 코드베이스 심층 점검을 **부분별로 누적**하는 구현 핸드오프다. 전체 코드·콘텐츠의 의미 검수가 끝났다는 선언이 아니다. 각 패키지가 확인한 경계 안에서 구현하고, 미검증 항목은 그대로 남긴다.

- 사용자 요청: 코드 수정 없이 구조적 개선·보강 및 필요한 부분 재설계를 기획한다. 스킬은 사용하지 않는다.
- 조사 에이전트는 코드 근거를 수집한다. 개선안의 선택, 설계, 작업 순서, 인수조건과 최종 문서는 Astra가 작성한다.
- 기준: 작업 시작 시 HEAD `70893c1a5a503417a3525b4d862735ab6cb6cf14`, `version.json`의 `v55.21` 및 **기존 미커밋 변경을 포함한 작업 트리**. HEAD만 체크아웃하면 같은 코드가 아니다.
- 기존 dirty 파일에는 `index.html`, `js/aio-data.js`, `js/aio-chat.js`, `js/aio-kr-data.js`, `scripts/fetch-data.mjs`, proxy, SW 및 이전 감사 산출물이 포함된다. 이를 이번 작업의 수정으로 간주하거나 되돌리지 않는다.
- 수정 허용 범위: 이 디렉터리의 감사·핸드오프 문서 및 증거 복사본. 실제 제품 코드, 설정, 생성물, 원장, 버전은 수정하지 않는다. 커밋·푸시·배포하지 않는다.

## 패키지 목록

| 패키지 | 대상 | 작성 당시 상태·설계 성격(현행 finding은 25) | 선행 조건 |
|---|---|---|---|
| [00](00-CORE-ARCHITECTURE.md) | 핵심 구조·navigation·소유권·개편 순서 | 1차 설계 작성, 다른 작업 구현분 재검증 중 | 현재 근거와 역사 근거 구분 |
| [01](01-SURFACE-CONSISTENCY.md) | 화면 수치·해석·신뢰 상태의 정합성 | 1차 설계 작성, 다른 작업 구현분 재검증 중 | 00의 의미 단위 소유권 |
| [02](02-PORTFOLIO-STATE.md) | 포트폴리오 빈 상태·현금·평가 상태 | 1차 설계 작성, 다른 작업 구현분 재검증 중 | 01의 표현 계약 |
| [03](03-DATA-CONTRACTS.md) | 데이터 계약·producer/consumer·freshness | 1차 설계, v56 반증 일부 차단 확인 | 필수 종목·단위·실측 coverage |
| [04](04-CONTENT-SEMANTICS.md) | 지식·기관공시 콘텐츠 의미와 집계 범위 | 1차 설계, v56 상세 인수 미완료 | 생성 필드와 사용자 해석 연결 |
| [05](05-AI-EVIDENCE-FLOW.md) | AI 계획·근거·정책·스트리밍 공개 | 정적 근거 기반 1차 설계, 실행 검증 필요 | 정책 정본과 현재 사용자 의도 확인 |
| [06](06-OPERATIONS-AND-VERIFICATION.md) | 운영·SW·배포·QA 증거 | 1차 설계, live 미검증 | 로컬과 실제 배포 근거 구분 |
| [07](07-SCREENER-MODEL-LOGIC.md) | 팩터·필터·순위·백테스트 금융 수식 | 합성 반증 및 설계, v56 일부 수정 확인 | 입력 시점·가중치·월별 calendar |
| [08](08-MARKET-SCORE-AND-CURVE.md) | 시장 점수·매크로·curve 해석 | 1차 설계, health 일부 수정 확인 | 표본·시점·관측과 행동의 구별 |
| [09](09-SEC-PIT-AND-NEWS-LINEAGE.md) | SEC 가용시각·회계기간·뉴스 lineage | 합성 반증 및 설계, v56 SEC 일부 수정 확인 | operand·공시 revision·원문 연결 |
| [10](10-TECHNICAL-AND-THEME-LOGIC.md) | 기술지표·RRG·테마 가중치 | v56 새 반증 및 1차 설계 | 같은 날짜·주기·weight 의미 |
| [11](11-PORTFOLIO-DURABILITY-AND-CURRENCY.md) | 저장 성공·통화·개인자료 경계 | v56 새 반증 및 1차 설계 | durable 저장·currency 보존 |
| [12](12-USER-VISIBLE-REASONING.md) | 사용자가 이해하는 전체 흐름과 설명 화면 | v56 표본 브라우저 + UX 인수 설계 | 계산 계약과 같은 presentation model |
| [13](13-SEMANTIC-ARCHITECTURE-AND-LEARNING.md) | 화면·AI·차트·학습의 공통 의미 계약 | Astra 구조 설계 | 동일 결과와 설명의 소유권 |
| [14](14-TECHNICAL-STRATEGY-CONTRACTS.md) | 주봉·VCP·진입/축소 전략 | v56.01 합성 반증 + 정적 조사 | 관측/해석/적용 조건 분리 |
| [15](15-INSTRUMENT-AND-OBSERVATION-TIME.md) | 종목 식별·종가 가용시각·시장 비교 | v56.01 정적/provider 조사 | listing·통화·세션 계약 |
| [16](16-PRODUCT-FIRST-DATA-STRATEGY.md) | 제품 목적 재심사·전역 검수 범위·refresh/검색 역할 | Astra 재설계 기준 | 기존 구조 보존을 전제하지 않음 |
| [17](17-AUTOMATION-DELIVERY-AND-OBSERVABILITY.md) | 자동화 완료·발행·도달·누락 감시 | 실제 운영집계 스크립트 합성 반증 | 도메인별 예정 도착률 |
| [18](18-SEARCH-TO-VERIFIED-DATA.md) | 검색→후보→검증→정형 데이터 보강 | 현재 연결 경계 정적 조사 + 재설계 | 문서 검색과 숫자 승격 분리 |
| [19](19-DESIGN-DECISIONS-AND-MIGRATION.md) | 핸드오프 재감사·대안 선택·계약 연결·이전/복구 | Astra 통합 실행 설계, Luna MAX 독립 리뷰 반영 | 첫 파일럿부터 입력 고정 |
| [20](20-COVERAGE-AND-ACCEPTANCE-LEDGER.md) | 사용자 요청·20 route·시스템 사각지대·다음 조사 | 범위 대장, 완료율 인증 아님 | 미검수를 숨기지 않음 |
| [21](21-LIVE-LOCAL-SEMANTIC-REDESIGN.md) | 당시 20 route 라이브/로컬 관찰, 화면 의미 경로 | v56.01 브라우저 표본; 일부 P 반증 차단·전체 흐름 잔여 | raw trace 없는 역사 관찰로 취급 |
| [22](22-PORTFOLIO-PERFORMANCE-RISK-REDESIGN.md) | 성과·현재 구성 소급·위험의 도메인 분리 | 초기 발견+v56.15 보강; PFR06만 제한적 차단 | 23의 배분 정의 및 25 상태와 함께 읽기 |
| [23](23-CURRENT-BASELINE-AND-ALLOCATION-CONTRACT.md) | v56.15 재검증, 명시 0/부분 배분 | native 합성 입력·정적 경로; 구현 아님 | AllocationSnapshot·누락 멤버·valuation cut 인수 |
| [24](24-INDEPENDENT-STRUCTURAL-REVIEW-20260923.md) | 독립 감사의 신규 공백·증거 한계 | 현재 코드 대조·일부 순수 합성; 역사 감사 기록 | 상세 보강은 각 패키지·25/26 참조 |
| [25](25-CURRENT-FINDING-STATUS-CROSSWALK.md) | finding별 현재성·P/QA 연결 | v56.15 역사 색인 + 9/25 LC 후속 상태; 구현 전 재검증 필요 | 중복 구현과 미해결 누락 방지 |
| [26](26-EXECUTION-AND-ACCEPTANCE-PLAN.md) | 객체 계약·우선순위·작업 카드·복구·증거·사용자 인수 | 9/23 통합 설계 + 9/25 C1~C7 추가; 기능 구현·live 인증 아님 | E0→필수 선행→수직 과업→옛 경로 삭제·독립 증거 |
| [27](27-LIVE-LOCAL-CODE-SEMANTIC-AUDIT-20260924.md) | 20개 라우트의 live/local/코드 대조, 의미 결함·인수 경계 | 9/24 브라우저 표본과 코드 감사; 전체 기능·외부 사실 인증 아님 | LC-01~16을 25 상태·26 실행 카드와 연결 |
| [28](28-PAGE-BY-PAGE-LIVE-USER-AUDIT-20260924.md) | 20 route의 사용자 관점·콘텐츠 흐름·좁은 화면 감사 | 실제 화면과 코드 대조, 상태별 열린 범위 명시 | UX 과업과 원문/양성 흐름의 미검증 보존 |
| [29](29-SECOND-PASS-LIVE-CONTENT-AUDIT-20260925.md) | Screener·뉴스·기술·Principles·Masters 2차 라이브 본문 대조 | 이전 원격 SHA의 조작·문장 검수, LC-54~73 | 현재 배포 SHA 차이를 재검증 |
| [30](30-ATLAS-GUIDE-PORTFOLIO-LIVE-DEPTH-AUDIT-20260925.md) | Atlas 55배치·95산업노드, Guide 전체 문장, 포트폴리오 공개 경계 | 이전 원격 SHA의 렌더/조작, LC-74~82 | 원전 직접성·PIN/양성 계좌·다른 폭 인수 |
| [31](31-PRINCIPLES-MASTERS-LIVE-CONTENT-AND-SEC-AUDIT-20260925.md) | Principles 112확장 원고, Masters SEC 행/값/단위·투영 범위 | 새 원격 SHA의 전수 열람/대표 SEC 대사, LC-83~85 | 개별 원전·37기관 원행 전수와 사용자 이해도 |
| [32](32-EXTERNAL-REFERENCES-CHART-NEWS-AND-TEST-DESIGN-20260925.md) | 사용자 X/웹 링크·9이미지의 출처 경계와 차트·뉴스·환경/테스트 통합 | 외부 설계 참고, 이미지 정적 분석, LC-86~90 | 시장 사실·패턴 성능·전체 답글·외부 전문 별도 검증 |
| [33](33-NEW-SHA-20-ROUTE-LIVE-RECHECK-20260925.md) | 새 sourceSha의 20개 route 대표 화면·동선, LC-91~95 | Chrome 1920/1280 폭 대표 확인; 상세 조합·원전·실사용자는 미인수 | QQQ 결과 정체성, rank/뉴스/SEC/RRG 상태를 25/26에 연결 |

개별 함수 상태와 미검수 영역은 [검수 대장](FUNCTION-REVIEW.md)을 따른다. 패키지 작성은 해당 영역 전수 검수 완료를 뜻하지 않는다. 구현 시작 전에 해당 발견이 현재 트리에 남았는지 재검증한다.

## 공통 설계 방향

우선순위는 **수집 시점·단위·계산 기준의 정확성과 사용자에게 보이는 의미를 연결하는 것**이다. 입력 계약→순수 계산→결과/설명→화면/AI의 순서로 소유권을 정리한다. 함수가 돌아가도 사용자가 기준·비교대상·결측·결과 이유를 알 수 없으면 완료가 아니다. 파일 크기 감소와 native 모듈 수 증가는 결과 지표이며 그 자체로 완료 조건이 아니다.

구현 전에는 최신 32→31→30→29→28의 해당 증거와 25 현재성 → 26 실행 카드를 함께 읽고, 19 선택 근거·20 범위를 참조한다. 금융 계산은 07/09/11/22/23, 데이터 계약은 03/15/17/18, 사용자 동선은 12/21을 교차 확인한다. 모든 영역을 한 변경으로 개편하지 않고 각 패키지의 작은 인수 단위로 진행한다.

기존 `src/domain`, state slice, provider/normalizer/orchestrator, resource bag, evidence store는 재사용 가능성을 평가한다. 제품 목적과 요구 계약을 충족하지 못하면 구조와 저장·발행 경계를 교체한다. 보존이나 전면 재작성 어느 쪽도 미리 전제하지 않는다. 작업 패키지마다 현재 writer, 최종 owner, 폐기할 경로, migration/rollback과 검증할 사용자 동선을 명시한다. 최신 상위 판단 기준은 16을 따른다.

## 증거 수준과 한계

1. **현재 코드 읽기**: 경로와 줄을 근거로 사용한다. 구현 시작 때 함수명과 최신 줄을 다시 확인한다.
2. **순수 함수 실행**: 합성 입력으로 반환값을 재현한다. 실제 UI에서 같은 입력을 만들 수 있는지는 별도 확인한다.
3. **로컬 브라우저**: Chromium 149.0.7827.55, 1440×1000, 저장소 로컬 서버. 외부 요청을 의도적으로 차단하고 service worker도 차단했다. 저장소의 public-data는 읽을 수 있다. 이는 장애/부분 데이터 화면 증거다.
4. **미실행**: 정상 외부 공급자, 실제 AI 응답, 배포 환경, edge 헤더, 장기간 운영, 모집 사용자 연구, 보조공학 사용자 시험.

20개 등록 라우트를 순회했고 uncaught page error 및 문서 전체의 가로 넘침은 해당 실행에서 관찰되지 않았다. 라우트당 대기 1.2초의 순회는 상세 인터랙션·최종 비동기 완료·의미 전수 검증이 아니다. `theme-detail`은 `themes` 화면의 파생 패널이다. 외부 차단 요청 1,188건은 **전체 순회 누적**이며 부팅 요청 수나 정상 네트워크 성능으로 사용할 수 없다.

## 구현 에이전트의 공통 인수 규칙

- 패키지에 명시된 확정 문제와 조사 필요 항목을 구분한다. 가설을 바로 버그 수정으로 전환하지 않는다.
- 작업 시작 시 자신의 hash 기준선을 새로 잡고 기존 dirty 변경을 보존한다.
- 결측·실패·참고값을 0 또는 정상 상태로 바꾸지 않는다. 정상적인 0과 명시적인 빈 입력도 결측으로 바꾸지 않는다.
- 수치, 단위, 관측일, 분모/유니버스, 출처, 허용 용도가 맞는지 데이터에서 실제 화면까지 추적한다.
- 패키지별 검증이 끝나면 필요한 affected 게이트를 실행한다. 정적 PASS, 합성 런타임 PASS, 로컬 브라우저 확인, live 검증을 별도로 보고한다.
- 로컬 규칙에 따른 버그 P 항목·필요한 회귀 게이트는 **실제 구현 작업에서** 작성한다. 이 감사는 구현 없이 P 항목을 선점하지 않는다.
- 커밋·푸시·배포는 별도 명시 요청이 있어야 한다.

## 진행 기록

### 2026-09-25 E7 잔여 배치 — 감사 3종 확정 결함 클러스터 + 큐 3종 종료 (P1248~P1258, v56.48, 로컬 미커밋 · 중간 기록)

이 배치는 E7의 "남은 의미 범위" 조사(감사 3건 병렬 위임: 기업행동/조정가격 · 백테스트·위험 · 차트기법/옵션)에서 확정된 결함을 클러스터로 수정하고, 큐의 셸 위험 입력 분해·테마 숨김 섹션·E5 O06 receipt를 닫았다. 같은 배치 안에서 **게이트 정리**(P1258 계약 이관·조립 fixture·decomp ratchet)와 **QA-FX-SERIES**(P1259 기준 통화 수익률)까지 마무리했다(v56.48→v56.49). 커밋·푸시·배포는 하지 않았다.

- **감사 결함 8클러스터(P1248~P1255)**: 용어 사전 금융 정의 정정(ITM/OTM·NBER·headline PCE·CLI·OAS·다크풀·거래세 + 미검증 확률 격하 + 중복 2쌍·분류 파생) / 캔들 패턴 "형태 관측" 제한 + Guide 척도·행동 문구 분리 / SKEW 변화량 단일 read model(보류된 본값 옆 pct 제거) / 스크리너 실행-표시 분리·무효 입력 명시 거부·시총 빈상태 분리 / 백테스트·집중도 12건(비용 미상 조용 제외= PFR08 우회, 원가 분모 혼합 등) / 차트 기법 9건(죽은 다이버전스 감지기 통일·이중 모델명 분리) / 조정가격 혼합 D1~D5(raw·조정 계열 분리, basis 선언 소실 복구) / 테마 칩 `detailAvailability`.
- **큐 3종**: ① **셸 위험 입력 조립 분해(P1258)** — `src/ui/panels/portfolio-risk-input.js`로 조립을 옮기고 셸은 증거 수집·문구만 유지(`aio-workspace.js` −51행). ② **테마 숨김 섹션(P1257, QA-THM-35 결정 종료)** — 퇴역(시장 리더십·20일 추이·히트맵·대표 ETF) / **공개 이전**(경기 사이클 리드 판정 — T806 재배치 계약, 섹터 퍼포먼스 — 아키텍처 네이티브 계약) / **개발자 번들 이전**(세분화 45·한국 28테마 — P702 고급 토글, 계약 DOM 보존). 일괄 숨김 규칙 제거 + 결정 기록 + 공개 문구=실제 노출. ③ **E5 O06 도메인 receipt(P1256, QA-E5-RECEIPT 종료)** — `scripts/lib/domain-receipt.mjs` 정본화, fetch-data 8도메인 receipt 발행, 운영 상태 소비 + "기존값 유지 ≠ 새 수집 성공" 사용자 복구 설명.
- **과정의 실측**: 테마 섹션 삭제 직후 `ci-headless-tests`가 **12건 실패**로 계약된 소비자(T806/T824/T869/T1018/T642·T178 등)를 즉시 드러냈다 — "숨김=미결정 보관"이 아니라 계약된 표면이었다는 근거로, 분류 결정(공개/개발자/퇴역)에 반영했다. 잔여 4건(고아 data-snap sink)은 `skew-pct`를 R97 시드 alias(`→skewChg`)로 선언해 해소했다.
- **검증(이 시점)**: `ci-headless-tests`(예상 밖 실패 0)·`ci-runtime-contract-check`·`ci-architecture-contract-check`·`ci-operations-status-check`(도메인 receipt 픽스처 4종)·`ci-sec-runtime-projection-check`(SEC 픽스처 5종)·`ci-syntax-check`(411) PASS.
- **미검증·잔여**: ① ~~게이트 정리~~ **종료** — esm-core 셸 소스 계약 6건을 코드의 새 소유자로 갱신 + 조립 fixture(P1258) + FX fixture(P1259), decomp ratchet `--write --allow-growth`(전체 순 −48), affected 풀런 **pass 79 / cached 7 / skip 31** ② ~~QA-FX-SERIES~~ **종료(P1259)** — 기준 통화 수익률(월말 FX 정렬)을 현지 통화 결과와 라벨·수치가 다른 별도 결과로 발행 ③ `history.json:usdkrw` 실값은 다음 정식 refresh(`QA-FX-REFRESH`) — 그 전까지 기준 통화 결과는 정직하게 보류, 남은 fail 1건도 같은 데이터 노후(환경 `data-lineage`) ④ P1257 residual: 퇴역 섹션의 legacy writer·CSS 잔재(`QA-THM-CLEANUP` — 선언 전용 함수는 structural 게이트가 이미 차단) ⑤ P1248 residual: 용어집 나머지 역사 수치 전수 대조(`QA-GLOSSARY-SWEEP`).

### 2026-09-25 구현 배치 — E6 A05 요청 결속 종료 + FX 축 선행 해소 + 백테스트 통화축 (P1245~P1247, v56.45→v56.47, 로컬 미커밋)

이 배치는 26의 카드를 바꾸지 않고 세 가지를 실제로 닫았다. 커밋·푸시·배포는 하지 않았다.

- **E6 A05 종료(P1245)**: 인용·연구 tool 오류가 단일 전역에 저장되고 그 전역을 **응답 파이프라인이 쓰고 수집기가 읽어**, 겹친 두 요청(per-page + unified, 재시도)에서 서로의 인용을 지우고 다른 질문의 출처가 이 답변의 검증된 근거로 승격될 수 있었다. `requestId` 스코프 저장소로 대체하고 공유 전역 3종을 제거했다. **게이트 결정 기록**: P1172 assertion이 `requestId: window._aioActiveAIRequestId || null` **리터럴**을 요구해 그 요구와 모순되는 구현을 보증하고 있었으므로, 리터럴을 의미·행동(겹친 두 스트림 비혼입 VM 실행 + 사전 소스 음성 검증) 기준으로 교체했다. 실공급자 trace는 `QA-AI-A05-STREAM`으로 미검증 등록.
- **FX 축 선행 조건 해소(P1246)**: `HIST_SYMBOLS`에 `KRW=X→usdkrw`가 없어 `history.json`이 FX 이력을 생산하지 못하던 것을 기존 Yahoo chart producer 경로(1년 백필 + 일별 완료 컷)로 해소했다. 품질 경계는 `HIST_FIELD_PLAUSIBILITY` 한 곳에서 선언하고 producer와 게이트가 같은 맵을 쓴다(종전에는 게이트가 별도 리터럴을 들고 있었다). 공식 대조는 FRED **DEXKOUS**(연준 H.10, 키 없는 fredgraph.csv)를 `providerCrossChecks.fx`로 발행한다. **실측이 설계를 고쳤다**: DEXKOUS가 7일 지연되어 최신값끼리 비교하면 정상 계열이 2.09% `divergent`로 오표기됐을 것이고, **같은 시점 정렬**로 바꾼 뒤 실제로는 0.61% 일치(`ok`)였다(Yahoo 봉이 공식 관측일보다 하루 앞으로 스탬프되는 것도 실측 확인).
- **백테스트 통화축 배선(P1247)**: 랩이 `qty × 시작가`를 통화 구분 없이 더해 비중 분모를 만들던 것을 평가 경로와 같은 `fx.js` `convertWithDeclaredRates` 계약으로 환산하거나 보류하도록 바꿨다. 명시 목표비중은 단위 없는 비율이므로 막지 않는다(첫 구현의 과차단을 새 픽스처가 잡아냈다). 수익률은 현지 통화 가중이며 `returnCurrencyBasis`·`fxTranslation`과 경고로 공시한다. reconciliation `commodities-fx`에 FX 일별 이력·공식 대조 evidence를 추가했다(카테고리·`overall`은 `PARTIAL` 불변 — 증거만 정직해졌다).
- **검증**: `ci-ai-intelligence-contract-check`·`ci-ai-provider-stream-check`·`ci-headless-tests`(1145/1145)·`ci-runtime-contract-check`·`ci-esm-core-unit-check`(P1247 픽스처 6종)·`ci-history-field-time-contract-check`(FX 계약 6종)·`ci-reconciliation-contract-check`·`ci-operations-status-check`·`ci-data-pipeline-contract-check`·`ci-retirement-contract`·`ci-domain-parity-check`·`ci-syntax-check`(409)·`ci-decomp-hotspot-check`·workspace/knowledge-lint/ledger/assertion-trace/version PASS. 실측 프로브로 두 공급자에 실제 접속해 파싱·경계·정렬·판정을 확인했다.
- **미검증으로 남긴 것**: ① `history.json:usdkrw`·`providerCrossChecks.fx` **실값은 다음 정식 refresh에서** 채워진다(`QA-FX-REFRESH`) ② 기준 통화 수익률(FX 시계열 월말 정렬)은 미구현(`QA-FX-SERIES`) ③ 데이터 노후로 affected 브라우저 그룹 31개가 skip, `ci-data-lineage-audit`가 `data.json`(live-core) SLA 초과로 1건 실패(환경 조건, 이 배치와 무관) ④ E6 A01~A04 미착수.
- **분해 예산**: `js/aio-chat.js` +64·`js/aio-core.js` +3·`js/aio-tests.js` +2·`js/aio-workspace.js` +4를 `--write --allow-growth`로 기록·정당화했다(중복 구현이 아니라 공유 싱글턴 대체·새 소유권·도메인 위임이며, R620이 게이밍으로 규정한 "주석 압축"을 쓰지 않았다).

### 2026-09-24 구현 배치 — E0~E4 종료 (P1188~P1203, v56.16→v56.32)

26의 실행 카드 E0–E4를 이 트리에서 **구현으로 닫았다**. 이 항목은 설계가 아니라 구현 기록이며, 각 항목의 증거 수준(정적·순수 합성·로컬 브라우저·데이터 계약)은 26 표에 그대로 남긴다.

- **E3(통화·저장 경계)**: P1187(종목 원가 통화 writer·수정 경로 보존·import/전체삭제 durable ack), P1188(계좌·현금 통화 + 현금 수익률·RF writer), **P1194**(11 §23 FX 환산 — 사용자가 **선언한 관측 rate leg**만 소비, 컷 이후·창 초과 leg 거부, 사용 leg·창·실패 통화쌍 게시, 삼각 환산 금지), **P1196**(원가/시세 통화 불일치도 같은 근거로 환산해 P&L 성립 — 값 환산 실패는 합계 전체 보류, 원가 환산 실패는 P&L만 보류).
- **E4(원장·성과·위험)**: P1182(위험 선언 계약), P1188(TWR/MWR 원장 엔진 — 수익률·현금흐름 시점 규약·actual-365), P1190(VaR 표본 안정성 bootstrap·민감도 인증), P1191(원장 입력 UI → Vault 경로 저장 → TWR/MWR 표시), P1193(측정 경로·리밸런싱 정책 선언), P1195(선언 패널 마크업·ack 문구 네이티브 분해), P1197(소비되지 않는 선언 정리 — 회고 경로 정책 미요구·정체성 제외), P1198(선언 정직성 — 미선언·미인식 열거형이 기본값으로 승격되지 않음, 오타가 전략 주장이 되지 않음), P1199(선언 저장소 ack 계약 분해), **P1200**(전략 목표비중의 **현금 몫**이 계좌 범위를 선언 — 선언 현금으로 계좌 수익 합성), P1201(회고 경로 정책 셀렉터 비활성), **P1203**(VaR 인증 도달 가능성 — 정렬 표본을 넘겨 '최근 절반' 민감도가 상위 절반이 되던 결함, 인증이 현실 표본에서 영원히 불가능했다).
- **E1/E2 부분**: P1178·P1179·P1183·P1184·P1185·P1186(기존 배치). E2 S-C/S-E/S-F는 **여전히 미착수**이며 이유는 아래.
- **검증**: `qa-runner affected`(제품 파일 목록) = **pass 94~105 / cached 2~9 / fail 0 / skip 0**. `ci-portfolio-vault-e2e` **26/26 PASS**(PFE2-16~23 — 원장 입력·통화 주석·측정 경로·FX 환산·원가축 P&L·정책 미사용·현금 몫·인증 렌더). `ci-esm-core-unit-check`(P1182/P1191/P1193 기대값 갱신 + P1190~P1200 fixture), `ci-artifact-semantics-check`, `ci-history-field-time-contract-check`, `ci-data-lineage-audit`(FAIL 0), `ci-reconciliation-contract-check`, `ci-operations-status-check`, `ci-version-check`, `ci-ledger-integrity-check`, `ci-assertion-trace-check`, `ci-knowledge-lint-check`, `ci-workspace-contract-check`, `ci-decomp-hotspot-check`, `ci-architecture-contract-check` 전부 PASS. `git diff --check` clean.
- **소유자 결정 확정**(QA에 근거 기록): 자동 관측 환율 미도입(스냅샷 `KRW=X`는 환산 근거로 쓰지 않는다)·삼각 환산 불허·선언 창 72시간·P1192 값 보존 바인딩.
- **아직 열린 것**: ① E2 S-C는 legacy 번들을 실제로 실행해 shadow 비교하는 **실행 하니스**가 필요하다(현재 `page.route`로 외부를 전부 차단하므로 legacy 번들 실행 경로가 없다 — 시크릿이 아니라 설계·코드 작업이다). S-F(IDB 개명)는 마이그레이션 선행. ② 셸 위험 입력 조립(약 60줄)의 네이티브 분해. ③ 백테스트 랩 통화축은 **데이터 부재**로 BLOCKED(`backtest.js` 통화 참조 0건, `fetch-data.mjs` FX 이력 미생산). ④ `recent-half` 입력 순서 계약은 주석으로만 알린다. ⑤ 정식 refresh 사이클은 CI 시크릿이 필요하다. ⑥ E5~E7은 미착수.
- **이 배치는 소유자의 명시 요청("전체 커밋/배포")으로 커밋·푸시까지 수행했다** — README의 "커밋·푸시·배포는 별도 명시 요청이 있어야 한다" 규칙에 따른 예외다. 커밋 2건(`5bec58e6` 구현 배치, `98fe885c` 리베이스 후 projection 재생성)을 `main`에 푸시했고, 푸시 전에 CI 데이터 refresh 커밋 11건 위로 리베이스해 **데이터는 CI 정식 산출물, 코드·문서는 이 배치**를 유지했다.
- **배포 상태(2026-09-24 02:5xZ 기준): 푸시 완료, Pages 배포는 대기.** `pages-deploy.yml`은 **CI 워크플로가 성공으로 끝날 때만** 배포하므로(`workflow_run.conclusion == 'success'`), 이번 푸시의 배포는 CI 결과에 달려 있다. 그런데 원격 `main`(ac5fc72c)의 CI는 이미 **실패 상태**였고(“Contracts / knowledge”·“Contracts / data” 샤드 실패, Browser/Attest는 skip), 원인은 `ci-artifact-semantics-check`가 잡는 **CI 생산 산출물의 P1095 위반**(`2026-09-24.dxy/wti/gold previous close stamped after the completed cut`)이다. 이 조건은 P1192가 `scripts/fetch-data.mjs`에서 고친 **producer 이전**에 생산된 산출물에 남아 있으며, 이번 배치가 만든 것이 아니다.
- **해소 경로**: `refresh-data.yml`이 **30분 주기**(`17,47 * * * *`)로 돌기 때문에, 수정된 producer가 이제 `main`에 있으므로 다음 사이클이 준수 산출물을 재생성하고 → 다음 CI가 성공하고 → Pages 배포가 자동으로 진행된다. **별도 조치가 필요 없다.** 즉시 우회하려면 로컬 무키 refresh가 필요하지만, 그것은 FRED LKG·LLM fallback 라벨을 게시 데이터에 싣는 **열화**이므로 소유자 승인 없이는 하지 않았다.
- **worker 배포(`deploy-ai-proxy.yml`·`deploy-data-plane.yml`)는 `workflow_dispatch` 전용 + Cloudflare 시크릿 필요**라 이 배치에서 실행하지 않았다 — 소유자가 수동 디스패치해야 한다.

### 2026-09-23 현재성 통합·구조 설계 보강

v56.15/HEAD `2195722dab571eaca0335249d02e84abdd128e94` 기준으로 [24 독립 감사](24-INDEPENDENT-STRUCTURAL-REVIEW-20260923.md)의 R24-01–08(06A 포함)을 00/03/06/07/11/15/17/18/22/23 등의 상세 계약에 연결했다. [25](25-CURRENT-FINDING-STATUS-CROSSWALK.md)는 이미 차단한 반증과 부분 구현·열린 결함을 구분하며, [26](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)은 객체 소유권, E0–E7 선행 순서, fixture, 전환·복구, 권리·보안, 사용자·접근성 및 증거 형식을 정한다. 화면/AI/콘텐츠의 현재 상태와 독립 브라우저 trace 요구도 01/04/05/12/21에 반영했다. 기존 미커밋 22/23/증거는 덮어쓰지 않고 보강했다.

검증: task-owned 문서 25개를 명시한 `qa-runner affected` preflight **14 PASS, 0 FAIL, 0 SKIP**. workspace state/contract, knowledge lint, skill contract/eval fixture, ledger/assertion trace, agent profile/skill mirror 및 `git diff --check` 통과. 로컬 문서 링크 183개 중 깨진 대상 0개, JSON 21개 파싱 성공. knowledge lint의 역사 문서 encoding 경고 2개는 기존 범위이며, 기계 검사는 금융 의미·실브라우저·원격 운영·권리 확인·사용자 이해도 인증이 아니다. QA 기록은 TEMP `aio-structural-handoff-design-20260923/last-run.json`에 있다. 제품 코드·설정·데이터를 수정하거나 스킬을 사용하지 않았고, 커밋·푸시·배포하지 않았다.

### 2026-09-21 핸드오프 자체 재감사

Luna MAX 두 에이전트가 구조/이행과 금융/사용자 의미를 독립 검토했고 Astra가 19–20을 작성하고 기존 문서를 정정했다. 역사 발견과 현재 반증 차단 안내, 중복 구현 지시, 기존 구조 보존 문구, 라벨·수익률 비교 계약을 보강했다. 대안과 잠정 선택 이유, 공통 객체의 연결 키, 파일럿 우선 사용자/과업, 입력 고정 선행 조건, 보존/이전/rollback과 이해도 인수조건을 추가했다.

새 세션 hash 기준선으로 선택된 affected preflight 14 PASS, 추가 knowledge/skill/ledger/assertion/profile/mirror 계약 검사 통과. 로컬 링크 52개, JSON 20개, route registry 20개와 범위표의 누락 없음 확인. 이는 20개 route의 의미 검수 완료가 아니라 **범위표 포함 여부** 확인이다. 기록은 TEMP `aio-handoff-review-20260921/last-run.json`. 문서만 변경했고 HEAD는 그대로다. 제품 구현·커밋·푸시·배포 없음. 실제 비용 비교·사용자 과업 실험·남은 함수 전수 검수는 여전히 미완료다.

### 2026-09-21 자동화·제품 목적 증분

16–18을 추가했다. 제품 목적부터 기존 구조를 재심사하며 전체 영역의 남은 검수 범위를 명시했다. 예정 작업 누락을 놓치는 운영 SLO는 실제 스크립트에 합성 API 응답을 넣어 재현했다. SEC 부분 수집/보존, Pages SHA attestation, provider 다중 fetch/SW 호환성, 고정 web-research seed와 AI 검색 문서의 정형 데이터 연결 경계를 조사했다. 설계·문서 작성은 Astra, 수집/검색 코드 근거 조사는 Luna MAX가 담당했다. 분배 O07은 Astra 정적 조사이며 실제 혼합 오류는 미재현이다.

문서 범위 affected preflight 14 PASS, 추가 workspace knowledge/skill/ledger/assertion/profile/mirror 검사 통과. 스킬 문서는 읽거나 실행하지 않았다. QA 기록은 TEMP `aio-audit-automation-20260921/last-run.json`. 제품 코드·데이터·설정 수정, 원격 job 실행, 커밋·푸시·배포 없음. 기존 파일과 기준 HEAD를 보존했다. 새 설계 문서의 추가를 제품 기능 구현이나 운영 인증으로 해석하지 않는다.

현재 막힌 작업은 없으며, 원격 장기 실행·데이터 도착률, 공급자 전체 실패 주입, 배포 전환 브라우저 호환성은 미검증으로 남긴다. 전체 코드/금융 의미 전수 완료가 아니다. 후속 조사에서는 16의 범위표와 FUNCTION-REVIEW의 큐를 따라 기업행동/조정가격·과거 유니버스·위험/성과·추가 차트 기법을 이어간다.

### 2026-09-21 증분 — v56.01

13의 공통 의미·학습 설계, 14의 차트/행동 전략, 15의 식별/관측 시각을 추가했다. 04에는 실제 manager shard의 preview/전체 범위 혼동, 05에는 claim 공개·정책 전달·요청 출처 소유권, 12에는 같은 선택의 미리보기와 실행 결과 불일치를 보강했다. 모든 설계·집필은 Astra가 맡았다. Luna MAX는 근거 조사만 수행했다.

검증: task-owned artifact 목록으로 `qa-runner affected`를 실행해 preflight 14 PASS, 0 FAIL, 0 SKIP. 추가 knowledge/skill contract/fixture/ledger/assertion 및 agent profile/skill mirror 검사는 통과했다. 이는 스킬 실행이나 의미 전수 검증이 아니라 저장소 계약 검사다. JSON 19개 파싱, 문서 로컬 링크 40개 존재 확인, `git diff --check` 통과. 상세 QA 기록은 로컬 TEMP의 `aio-audit-handoff-20260921/last-run.json`에 있다.

제품 파일 변경 없음, HEAD 변화 없음, 이 작업의 커밋·푸시·배포 없음. 현재 실행을 막은 사항은 없다. 정상 외부 공급자, 실제 AI 답변/동시성, 투자 전략 성능, 전체 기능의 사용자 이해도는 여전히 미검증이다. 다음 범위는 기업행동/조정가격, 옵션·volume profile·divergence, 포트폴리오 위험/성과, PIT 유니버스와 운영 publication의 세부 함수다. 이번 패키지 작성으로 이 범위가 완료되지는 않는다.

### 1차 — 기준선과 사용자 화면 표본

- 기존 변경 포함 기준선 확보. 기본 `.cache` 쓰기는 권한 오류로 실패했고, QA runner가 지원하는 `AIO_QA_CACHE_DIR`을 임시 디렉터리로 지정하여 hash 기준선 2,542개 파일을 확보했다.
- 20라우트의 장애 조건 표시를 수집하고 대표 화면을 캡처했다.
- 첫 패키지는 sentiment의 수치/서술 불일치와 home의 근거가 다른 상태 표시를 중심으로 작성한다.
- 전체 조사·설계는 진행 중이다. 이 기록을 전체 완료로 해석하지 않는다.

### 2차 — 2026-09-20 이어서 조사

- 다른 작업이 `e55eef47`에서 00–02 일부를 구현하고 이후 P1144 데이터 수정을 커밋했다. 시작 시 기존 추적 파일의 미커밋 변경은 없었으며 이전 감사의 이미지/JSON은 미추적 상태였다.
- 새 QA hash 기준선을 `audit-handoff-20260920`으로 별도 확보했다. 이전 날짜의 브라우저 증거를 새 버전의 완료 근거로 재사용하지 않는다.
- snapshot validator의 coverage/단위 반증 입력 실행, Masters 집계와 dossier 생성 의미 추적을 계속하고 있다.

### 3차 — 함수별 금융 검수와 v56 대조

- 팩터 가중치 대체, 점수 없는 순위, 월별 기간 압축, SEC operand 가용시각, 시장 점수 표본을 합성 입력으로 확인했다. 다른 작업의 v56 구현에서 같은 반증 일부가 차단되는 결과도 별도 보존했다.
- v56에서 테마의0가중치, RRG의 마지막 결측·주기 계약, 시간 타입, 저장 실패 후 완료 경로, 통화 소실을 추가 점검했다. 실제 사용자 자료나 자격증명을 읽지 않았다.
- v56 스크리너/테마/Masters를 로컬 브라우저에서 확인하고 사용자에게 계산 흐름을 설명하는 패키지12를 작성했다. 실사용자 이해도 시험은 미실행이다.
- Luna MAX 두 에이전트는 사용량 한도로 중단됐다. 기술지표 전수 조사는 완료로 표시하지 않았고 Astra가 한정된 함수 집합을 직접 이어 조사했다. 모델을 임의로 바꾸거나 reset credit을 사용하지 않았다.
