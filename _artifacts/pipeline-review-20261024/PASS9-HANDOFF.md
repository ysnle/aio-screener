# PASS9 — 거래점수 연구 비교와 테마 과거 빈도 감사

2026-10-28 / cstack review / 현재 관측 v59.42 / 주 담당자 직접 검토, 독립 리뷰 없음.

Important 0 · Pre-existing 3. 제품 수정 없이 감사 자료만 추가했다. 전체 파이프라인 전수 검토는 **미완료**다. v58.80에서 읽은 내용을 v59.42 전체 인증으로 승격하지 않는다. 기존 dirty 변경은 다른 작업 소유이며 보존한다. 지난 회차의 PASS9 쓰기·실행은 자동 승인 검토의 사용량 제한으로 실행되지 않았고, 이번에 파일 부재를 확인한 뒤 새로 실행했다.

## P9-BT-01 — 상대화 실험이 추세·위험선호·결측 처리까지 함께 바꿈

분류: Pre-existing / ACT ON / medium. 순수 함수 재현, 브라우저·라이브 증거 없음.

`scripts/backtest-trading-score-longrun.mjs:174`의 momScore=52, breadthScore=72와 :211의 별도 추세 함수는 현재 기준 모델과 다르다. 설명은 같은 밴드·가중치와 중립 경로로 비교 변인을 통제한다고 하지만, 기준 경로는 `reconstructScore`를 통해 현재 `trading-score.js`를 호출한다. 현재 모델은 200일선 아래의 반등을 먼저 판정하고, F&G 대신 PCR/HY를 위험선호 입력으로 쓰며 결측 시장 폭을 분모에서 뺀다.

실행 입력: 가격95, 50MA90, 200MA100; 기준 VIX20/DXY104/TNX4.3/WTI70/VVIX100/HYG78, 상대모델 percentile 모두0.5. 변동성62와 거시55는 같지만 추세는 기준15/상대82, 총점52/65였다. 기준 위험선호70, 시장 폭null, 가중치 coverage80이다. 비교 모델에는 52/72 상수가 있고 고정 가중치100으로 합산한다. 총점 차이를 percentile 방식의 효과로 분리할 수 없다.

실제 장기 runner가 두 함수를 같은 날짜에서 호출한다. 단기 runner는 `fetch-data.mjs`의 갱신 경로에서 호출되어 score-backtest-history.json을 기록한다. 장기 producer는 이번에 실행하지 않았으며 현재 배포에서 장기 숫자를 읽는 사용자 화면은 미확인이다. 점수의 연구 전용 경계가 있어도 비교 실험의 의미가 맞아지는 것은 아니다.

개편안: 실험을 유지한다면 기준 모델 버전·사용 입력·결측 정책을 먼저 고정하고, 의도적으로 바꾸는 변환만 교체한다. 옛 모델 비교를 보존하려면 현행 모델 비교라는 설명을 제거하고 별도 버전의 역사 실험으로 구분한다. 회귀 사례에는 200일선 아래/50일선 위, 50일선 ±1%, 시장 폭 결측, PCR/HY 각 결측을 포함한다. 예측 검증 없이 제품 점수나 매매 판정으로 복귀시키지 않는다.

## P9-BT-02 — 더 이상 점수 입력이 아닌 F&G가 표본을 탈락시킴

분류: Pre-existing / ACT ON / medium. 함수 재현 + 현재 artifact 읽기 + 정적 호출 경로.

`scripts/backtest-trading-score.mjs:145`는 fg가 유한 숫자가 아니면 행을 건너뛴다. 주석은 momScore 재구성 불가라고 설명하지만 현재 모델은 fg를 합성 입력으로 사용하지 않는다. 같은 나머지 입력에서 fg=null/0/45/100 모두 총점52로 재현됐다. 현재 history.json을 runner의 SPX·carried-forward·session 중복 제외 조건으로 읽으면 290세션 중 1개가 fg 조건으로 탈락한다. 이는 이번 로컬 artifact 관측이며 과거 전체 발생량이 아니다. runner 본체를 실행하거나 public-data를 쓰지 않았다.

결과: 점수에 불필요한 공급자의 가용성이 평가 표본을 선택한다. 향후 fg 공급 중단 시 다른 관측이 있어도 신규 평가 행이 사라질 수 있다. 또한 단기 어댑터는 HYG 기본78에서 만든 HY 근사330bp를 사용한다. 현재 실제 HY 관측을 그대로 재현한다고 해석해서는 안 된다.

보강안: 현행 모델의 실제 필수 입력과 허용 coverage로 표본을 결정하고, 제외 사유별 수를 산출한다. 역사적 신용 입력을 확보할 수 없으면 결측 또는 명시된 대용 실험으로 다루며 모형 버전과 입력 계보를 결과에 남긴다. fg 유무만 바꿔 유효 표본이 변하지 않는지 검사한다.

## P9-THEME-02 — 테마 기본 빈도와 조건 사례의 비교 가능 기간이 다름

분류: Pre-existing / ACT ON / medium. 실제 `themeStateOutcomes`와 `pastEvidence` 함수 재현.

`src/domain/scenarios/analogs.js:127`은 ETF 관측 전체에서 baseN/baseUpPct를 계산한다. :133은 조건 사례를 고를 때만 비교지수의 현재·21세션 전·126세션 전 관측을 요구한다. 따라서 비교지수가 생기기 전에는 해당 조건을 판정할 수 없는데도 그 기간의 수익률이 기본 빈도에 들어간다. 거시 analogOutcome은 같은 파일 :34에서 testable 조건을 기본 빈도에도 적용하므로 두 경로의 계약이 다르다.

2500개 합성 관측에서 비교지수를 1500번째부터 제공했다. 조건 판정 가능한 관측은 811개인데 baseN은2311이었다. 판정 가능한 구간과 13개의 주도 사례를 그대로 두고 이전 ETF 구간만 바꾸면, 두 결과 모두 n13/up13/중앙값13.4%임에도 기본 상승률은100%→41%, informative는false→true로 변했다. 이는 실제 역사·실거래일 데이터가 아닌 격리 합성 사례다.

연결: `build-scenario-outcomes.mjs`는 RSP가 있으면 이를 전체 proxy ETF에 넘기며, `themeStateOutcomes` 결과를 scenario-outcomes.json에 담는다. ETF와 RSP의 시작일이 다르거나 비교지수에 결측이 있으면 이 경계가 발생할 수 있다. 현재 공개 산출물 중 영향을 받은 테마 수와 화면별 표현은 아직 집계하지 않았다.

개편안: 조건 사례와 기본 빈도에 같은 testable 모집단을 사용한다. from/to도 전체 ETF 기간과 실제 비교 가능한 기간을 구분한다. 신규·짧은 지수 역사, 중간 결측, 동일 모집단, 10개 미만 사례를 검증한다. base-rate 오차와 겹치는 기본 관측의 의존성은 별도 통계 검토 대상이며 이번 재현으로 통계적 타당성 전체를 인증하지 않는다.

## 직접 판독한 연결 구조와 추가 검토 후보

- 단기 연구: history → 세션 필터 → trailing MA → 현행 모델 어댑터 → forward return → 상관 요약 → 날짜 upsert/180행. summary는 이번 계산 records, 저장 records는 이전 결과와 merged이므로 서로 다른 모집단일 수 있다. 이 후보의 현재 영향은 미재현.
- 장기 연구: Yahoo 일봉 병합 → trailing 값/percentile → 기준·상대 모델 → 국면/분위/기간 분리 → 연구 artifact. 현재 소스의 고정 규칙 holdout은 학습 모델 검증과 구분해야 한다.
- 테마 역사: Yahoo market/proxy/RSP → 날짜 정렬 → 비중첩 analog → 기본 빈도 대비 해석 → 주간 artifact. 부분 fetch 실패 시 일부 테마가 빠져도 payload status=current가 될 수 있다. 이전 값을 보존한다는 파일 머리 설명과 실제 부분 실패 정책의 범위 차이를 추가 확인해야 한다.
- 시나리오 상태: artifact adapter → 공통 interpretation → crossroads/playbook/guide → 이전 상태 diff·발표 평가·테마 일별 기록 → scenario-state/today-verdict. producer의 catch는 exitCode0이며 playbook 실패는 빈 themes로 대체된다. 실패가 운영 상태·transition에 어떻게 전달되는지 미검증이다.
- 공통 interpretation: 각 단계 예외를 errors에 남기고 null을 반환한다. consumers가 errors를 모두 처리하는지는 추가 추적 필요. producer adapter는 rotationHistory와 indexEarnings를 전달하지 않으므로 공통 함수 사용만으로 브라우저와 모든 단계 입력이 같다고 볼 수 없다.
- 새 owner 정책: 공유 AI $20는 2026-10-27부터 중단 상한이 아닌 목표다. 이전 감사의 예산 관련 서술은 당시 정책 증거로 보존하고, 현재 정책 위반 판단에는 그대로 재사용하지 않는다.

누적 전체 판독 완료(무결성 PASS 뜻 아님): theme-playbook.js, backtest-trading-score.mjs, backtest-trading-score-longrun.mjs, trading-score.js, build-scenario-outcomes.mjs, build-scenario-state.mjs는 10/27 판독을 포함한다. 10/28에 재현에 필요한 함수와 경계는 다시 확인했다. 새로 전체 판독한 파일은 src/domain/interpretation/market-interpretation.js 및 scripts/lib/market-interpretation-inputs.mjs다. research-model gate는 일부 출력이 잘려 FULL로 세지 않는다. recent-check.js도 부분 판독이다.

## 실행 및 남은 범위

`node _artifacts/pipeline-review-20261024/reproduce-pass9.mjs` → exit0. 결과는 pass9-reproductions.json. 첫 합성 사례는 선형 상승이 주도 band에 못 미쳐 informative=null이었고 assertion이 실패했다. 기하 상승으로 입력을 바꿔 주도 상태 13개를 만든 뒤 재현했다. 제품 소스는 수정하지 않았다.

전체 파일·자료의 의미 검토, 기존 판독 후 변경된 소스 재검토, 현재 데이터의 영향 빈도, 화면·AI 소비 결과 검증은 남아 있다. 자동 inventory나 파일 hash 일치는 의미 검수 완료로 세지 않는다. commit/push/deploy 없음.

QA 종료 기록: affected 실행 `2026-10-28T02-53-44-354Z-22140-w5unir`는 pass6/cached5/fail1. 실패는 generated-state의 `_context/CURRENT-STATE.md is stale`다. 현재 작업 트리에 해당 생성 문서와 다수 제품 변경이 이미 있었으며 이 감사가 만든 실패라고 귀속하지 않는다. 원인 귀속은 미검증이고, 검토 전용 지시 때문에 생성 문서를 수정하지 않았다. syntax·workflow-yaml·product-charter·architecture·operations-contract·workspace-contract는 이번 실행 통과. 이 실행은 preflight 그룹이며 전체 QA나 브라우저 인증은 아니다. 별도 `node --check reproduce-pass9.mjs` 및 감사 폴더의 `git diff --check` 통과.

파일 대장: 관측4491파일, 4371개는 파일별 이전 증거와 아직 대조되지 않음(NOT_RECONCILED; 전부 미독이라는 뜻 아님). 이전 hash가 있던 파일 중19개가 바뀌었으며 pass9-prior-ledger-drift.json에 보존했다. 해당 행의 revalidation=REQUIRED_CHANGED_SINCE_PRIOR_OBSERVATION은 현재 버전 재검토 필요를 뜻한다. 특히 Worker, CI/배포 workflow, factors, qa-runner 변경을 이전 FULL 판독 상태만으로 통과 처리하지 않는다.
