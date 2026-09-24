# 전역 범위·요청 추적·미검수 대장

2026-09-21 · Astra 작성. 라우트 목록은 현재 `architecture/route-owners.json`의 20개 항목과 대조했다. theme-detail은 themes의 파생 경계다. 파일 수나 라우트 방문 수로 전수 의미 검수율을 계산하지 않는다.

**2026-09-23 v56.15 범위 갱신:** 이 표는 조사 범위 목록이며 현재 결함 상태표가 아니다. [25 발견 상태 교차표](25-CURRENT-FINDING-STATUS-CROSSWALK.md)가 P1143–P1177과 [24 독립 감사](24-INDEPENDENT-STRUCTURAL-REVIEW-20260923.md)의 열린/부분/차단 상태를 구분하고, [26 실행·인수 설계](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)가 선행 결정·작업 카드·증거 수준을 규정한다. 기존 20행은 현재 route registry와 전부 일치함을 다시 확인했다. 이는 내부 의미 전수 검수 완료가 아니다.

## 사용자 요청과 산출물의 연결

| 요청 | 반영 문서 | 아직 충족되지 않은 완료 조건 |
|---|---|---|
| 기존 의도부터 객관적으로 재심사 | 16,19 | 사용자 과업·비용·운영 제약 실측 후 선택 확정 |
| 구조적 보강·필요시 재설계 | 00,13,16–19 | 실제 구현·writer 폐기·migration/rollback 검증 |
| 전체 수집/가공/분배/연결 | 03,09,15,17,18 | 모든 source/field의 끝단 소비까지 검증 |
| 함수·기준·금융/수학 의미 | 07–11,14,15 | 전체 함수·전략의 독립 검증 및 경계 반증 |
| AI 전체 응답 경로 | 05,13,18 | 실제 모델/검색/취소/동시성·의미 일치 |
| 사용자가 직관적으로 이해·체득 | 12,13,19 | 실제 사용자 과업 평가·접근성 검증 |
| 빠진 영역도 포함 | 이 문서·FUNCTION-REVIEW | 아래 미검수 항목을 증거로 닫기 |
| 부분별 누적·Astra 집필·Luna MAX 조사 | README 진행 기록 | 향후 증분에서도 동일 경계 유지 |
| 제품 코드 수정 금지·스킬 금지 | 감사 폴더만 변경, 스킬 미사용 | 구현 작업은 별도 요청 범위에서 수행 |

## 모든 라우트의 의미 검수 범위

**9/22 역사 증분:** [21](21-LIVE-LOCAL-SEMANTIC-REDESIGN.md)의 20행 비교표에 라이브/로컬 각각의 실브라우저 방문과 대표 상호작용을 추가했다. 당시 null.toFixed 오류도 발견했으나 P1164의 해당 반증은 v56.15 코드에서 차단됐다. 선택 종목·차트·설명의 더 넓은 B02 의미 경계는 남는다. 모든 페이지 내부 상태·콘텐츠·금융 로직은 여전히 아래 과업별로 남는다. 포트폴리오 함수 의미와 재설계는 [22](22-PORTFOLIO-PERFORMANCE-RISK-REDESIGN.md)·[23](23-CURRENT-BASELINE-AND-ALLOCATION-CONTRACT.md)에 누적했다.

공통: 초기 20 route 순회는 외부 차단·짧은 대기의 로컬 브라우저 표본이다. 아래 어느 행도 라우트 전체 완료를 뜻하지 않는다. ‘근거 있음’은 연결 문서에 명시된 부분만이다.

| route | 현재 의미 근거 | 남은 핵심 과업 |
|---|---|---|
| home | 00/01의 route·배지·요약 | 모든 카드→근거 일치, 갱신 경쟁, 전체 서술 |
| signal | 08/14의 일부 점수/행동 | 조합·상관 중복·regime별 성능·행동 적용 |
| breadth | 03/10/15의 모집단·시각 관련 | 전체 참여율·A/D·누적값·휴장 처리 |
| sentiment | 01/08/18의 지표·서술·소스 | 전체 지표 산식·조합·갱신·결측 의미 |
| briefing | 09의 뉴스 lineage 일부 | 뉴스 선정/중복/시간/중요도·원문 entailment |
| technical | 10/14의 stage·주봉·VCP | divergence·volume profile·Kalman·기업행동 |
| macro | 08의 curve·일부 데이터 | 주기/계절조정/빈티지·인과 가설 전체 |
| fxbond | 08의 금리 입력 일부 | FX 방향·yield/price·duration·단위 전수 |
| fundamental | 09/15의 SEC·식별 | FY/TTM·평균자본·ratio·산업별 비교 전수 |
| themes | 10의 가중치/RRG | 테마 포함 기준·중복 노출·기간·composition revision |
| theme-detail | 00/10의 파생 경계 일부 | 부모와 동일 집단/수익률·복귀·시점 유지 |
| portfolio | 02/07/11의 평가·달력·저장/통화 | 현금흐름·성과·위험·세금/비용·복구 전수 |
| ticker | 07/09/14 일부 점수/근거 | 기업분석/차트/뉴스/AI 동일 identity·snapshot |
| market-news | 09의 lineage 일부 | scoring·중복·다국어·사건 시점·정정 |
| options | 순회 외 금융 로직 상세 검수 없음 | 계약승수·만기·행사·Greeks·IV/payoff·데이터 자격 |
| principles | 04/13의 구조/학습 상태 | 전체 문장·경제 가설·반례·연습 정답 |
| masters | 04의 실제 집계/preview 범위 | 13F 시차·변경·CUSIP·포트폴리오 해석 전체 |
| atlas | 04/13의 지식 구조 일부 | 그래프 관계·인과/연관 구분·누락/개념 충돌 |
| guide | 순회 외 사용자 과업 검증 없음 | 현재 기능과 안내 일치·첫 사용 성공 |
| screener | 07/12/15의 팩터/조건/표시·식별 | 전 profile/조건·저장/replay·정렬·실행 비교 |

## 라우트 밖의 사각지대

| 경계 | 지금 남은 검사 | 완료 증거 |
|---|---|---|
| 시장 identity·기업행동 | 원주/ADR/클래스, split/dividend, 상장폐지·합병·심볼 이력 | 같은 경제 자산의 수익률·보유 수량/가격 연결 fixture |
| 시간·회계 | exchange calendar/DST, 빈티지, restatement, filing availability | 경계일·조기폐장·정정 전후 replay |
| 통계·백테스트 | look-ahead/survivorship, 중복 forward window, 다중검정, 비용·선정 편향 | 독립 계산 대조·표본 외 결과·오류 범위 |
| 포트폴리오 회계 | 매수/매도/입출금/배당/수수료·FX, TWR/MWR 기준 | 알려진 cash-flow 사례와 계산 대조 |
| 포트폴리오 위험 | VaR/CVaR·공분산·beta·stress·집중도·ETF 중복 | 표본/기간/방법 공개, 작은 분석 가능 fixture |
| HTTP/캐시·동시성 | timeout/retry/backoff·quota·cache key·abort/late write | 가상 clock/장애 주입과 실제 화면 recovery |
| 개인 데이터 | 저장quota·암호화/잠금·import/export·schema migration·삭제 | 개인정보 없는 테스트 vault의 전체 수명주기 |
| AI 신뢰/보안 | prompt injection·민감정보 전송·도구 권한·출처 지지 여부 | 공격/정상 질문군, 요청·출력 trace |
| UI·접근성 | focus/키보드/보조공학·색각·responsive·오류 복구 | 동일 연구 과업의 실제 조작 결과 |
| 성능·비용 | boot/route 예산·대량 데이터·검색 비용·메모리 해제 | 현재 revision 측정, 대표 저사양/지연 환경 |
| 자동화·운영 | 누락 실행·부분 발행·배포 순서·rollback·외부 감시 | 17 반증+원격 delivery 기록 |
| 데이터 사용 조건 | 수집/표시/저장/재배포별 실제 조건 | 해당 공급자의 확인된 조건과 운영 설정 |

### 2026-09-23 추가 교차 경계

| 경계 | 현재 근거·상태 | 끝단 인수 |
|---|---|---|
| quote metric/팩터 시각 | 24 R24-02의 잘못된 metricId 수용은 순수 함수 재현, R24-03의 barStart 필드 손실은 정적 경로 확인 | producer→validator→provider→normalizer→계산→UI의 metric·시간·품질이 같은 의미 |
| 계산 입력 정체성 | 24 R24-04의 live mcap 변경에서 size rank와 snapshotId가 함께 변한 합성 실행 | artifact 관측 ID·계산 operand ID·보관 result ID의 관계, background quote에 보관 run 불변 |
| 포트폴리오 구성 | 24 R24-05/06/06A의 이력 누락·현재 비중 과거 적용·통화 손실은 정적 경로 확인 | 의도 멤버 전원·현금·FX·valuation cut·risk path를 결과/화면에서 대조 |
| 예정 운영 실행 | 24 R24-07의 push 실행이 schedule PASS를 만드는 순수 SLO 합성 반증 | schedule-only 분모, 실패/수동/retry/휴장, publication→consumer 도달 구분 |
| 개인·권리 | 16에 미검수, 18/19의 보존 prose는 schema linkage가 부족 | threat model, RightsContract→candidate/observation/publication, Vault/AI 전송·삭제 인수 |
| 브라우저 증거 | 21의 20-route 방문은 당시 도구 출력 요약이며 그 증분 raw trace·PNG 없음 | route·action·환경·SHA·시각·DOM/console·화면 증거 ID가 사례에 묶임 |

각 행은 [24](24-INDEPENDENT-STRUCTURAL-REVIEW-20260923.md)의 증거 한계를 유지한다. 기능별 구체 계약은 해당 패키지와 26을 따른다.

## 다음 실제 조사 순서

아래 원래 순서는 미검수 **조사 큐**다. 구현 우선순위는 [26의 E0–E7](26-EXECUTION-AND-ACCEPTANCE-PLAN.md), 현재성은 [25](25-CURRENT-FINDING-STATUS-CROSSWALK.md)를 따른다. 예를 들어 `07:M04`의 raw→adjusted 대체는 P1146의 해당 반증이 차단됐으므로 그대로 재수정하지 않고, 실제 공급자 adjusted 결측·기업행동 정책을 추가 조사한다.

1. 기업행동/조정가격과 과거 universe를 collection→factor/backtest→차트까지 추적한다. 07:M04는 현재 코드에서 재검증 전 역사 후보다.
2. `src/domain/portfolio/backtest.js`, `concentration.js`, legacy `_calcPortfolioVaR`의 방법·단위·분모·표본·현금흐름을 조사한다. 현재 함수가 있다는 사실은 타당성 증거가 아니다.
3. options route와 `_detectDivergence`, `_calcRSIDivergence` 등 미검수 차트 기법을 처리한다. 같은 이름/다른 구현이면 목적과 계약을 먼저 비교한다.
4. HTTP/storage/state 수명주기와 운영 delivery 장애를 교차 기능으로 검증한다.
5. 나머지 콘텐츠·사용자 과업·접근성·성능 검수를 넓힌다. 높은 영향의 새 결함이 나오면 우선순위를 조정하고 이유를 남긴다.

이 순서는 의도적 조사 큐다. 문서에 이름을 올린 것만으로 검사했다고 보고하지 않는다. 모든 단계는 입력→변환→소비자→표현→사용자 오해 가능성을 한 묶음으로 닫는다.

## 발견의 상태 전이

`미검수 → 정적 후보 → 실행 반증/정적 확정 → 설계 → 구현 → 해당 반증 차단 → 전체 인수 → 배포 관측`을 구분한다. 정적 계약 결함은 실행이 없어도 근거로 확정할 수 있으나 실제 장애 빈도는 별도다. 후보가 기각되면 원래 가설·기각 근거를 남긴다. 구현 완료와 금융 성능 검증 완료는 서로 다른 축이다.

새 발견에는 패키지:ID, 기준 revision/파일 hash, 함수 경계, 입력, 기대/실제 의미, 영향 소비자, 증거 수준, 제안/대안, 남은 검증을 붙인다. 고정 baseline 없이 현재 코드에 과거 결과를 대입하지 않는다. 현재 데이터가 바뀌면 새 증거로 기록한다.

## 종료 보고의 필수 분리

`설계 작성`, `코드 구현`, `정적 계약`, `순수 합성`, `헤드리스`, `로컬 실브라우저`, `원격 live`, `장기 운영`, `사용자·접근성 시험`을 독립 상태로 보고한다. route 방문 수나 문서·fixture 수를 의미 검수율로 쓰지 않는다. P 원장의 특정 반증 차단은 해당 finding에만 붙이고, 더 넓은 사용자 결과와 금융 방법 인수는 열린 상태로 둔다. QA FAIL/SKIP은 이유와 영향을 보고하고 PASS로 승격하지 않는다. 코드·commit·push·deploy 여부도 명시한다.
