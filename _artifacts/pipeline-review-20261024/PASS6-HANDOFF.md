# 파이프라인 의미 감사 추가 — 스크리너 계산 계약

2026-10-26 / review only / 작업 트리 v58.80 기준. 제품 소스 수정 없음. 전체 감사는 진행 중이며 이 문서는 완료 선언이 아니다. 선행 PASS5의 판독 범위를 추가로 대장에 반영한다. 서브에이전트 재개 두 건은 사용량 한도로 실패하여 이번 추가 판독·재현은 주 담당자가 수행했다. 모델 독립 검토가 아니다.

## P6-STAT-01 — 결과 기간의 시간 순서를 검증하지 않는 조건부 통계 [ACT ON before activation, medium, E2]

`src/domain/screener/conditional-evidence.js:177–201` independentSample은 outcomeEndAt의 존재와 이전 표본과의 겹침을 검사하지만 관측일 이후인지, 평가 시점 전에 끝났는지는 검사하지 않는다. `evidence-lineage.js:53–75`는 observed/fetched/available 시각만 검증하며 결과 기간을 받지 않는다.

실제 evaluateConditionalEvidence에 30개의 서로 다른 instrument/session, 평가시점 2026-09-12, 관측일 2026-01-05를 넣었다. outcomeEndAt=2027-01-05인 미래 결과와 outcomeEndAt=2025-01-05인 역전 기간 모두 READY, 30/30, estimate=1이다. `reproduce-pass6.mjs` / `pass6-reproductions.json`에 보존했다. 합성 입력의 success=true를 함수가 검증된 과거 성공으로 받아들이는 경계 결함이며, 실제 시장에서 100% 성공이 관측됐다는 뜻이 아니다.

연결: provider/screener.js:800은 artifact.conditionalEvidence를 전달하고 ui/pages/screener.js:1536 이후는 버전·lineage 상태를 확인한 뒤 sample.estimate를 렌더한다. 그러나 evaluator의 제품 호출자는 현재 검색에서 찾지 못했고 gate fixture에서만 확인했다. 현재 artifact나 배포 화면에 잘못된 통계가 있다는 주장으로 확대하지 않는다. 활성화 전 보강 대상으로 분류한다.

개편안: 표본 채택 전에 observedAt <= outcomeEndAt <= evaluationCutoff와 결과 가용시각을 검증하고, 조건 입력의 당시 가용성과 결과 관측의 가용성을 별도 필드로 둔다. future/reversed/missing/overlapping 기간을 각각 제외 사유와 개수로 남긴다. 다종목 같은 날 표본의 시장 공통 충격은 현행 instrument별 독립성 검사로 해결되지 않으므로 신뢰구간의 독립성 가정도 설명해야 한다. 기존 gate는 중복·겹침·missing outcome을 다루지만 미래 outcome을 부정 대조로 다루지 않는다.

추가 미확인: 현행 반환 객체에는 같은 역사 모집단의 무조건부 base rate가 없다. R697의 rate+base rate 병기 요구를 만족하려면 활성 producer와 UI까지 모집단 계약을 정의해야 한다. 지금 자료 없음 화면이 잘못된 확률을 보여준다는 뜻은 아니다.

## P6-RANK-01 — 부족한 행의 이전 순위가 재계산 결과에 잔류 [CONSIDER active-path impact, medium, E2]

`factor-ranks.js:486` 부근 working은 입력 row를 펼쳐 복제한다. :675–705에서 부족한 근거는 _compositeZ=null이 되지만 이전 rank/quantSignal은 초기화하지 않는다. :710–724는 이번에 계산 가능한 행의 순위만 덮어쓰고 :733–734는 남아 있는 값을 반환한다.

실제 computeFactorRanks에 6행, momentum/lowvol 각 0.5 explicit weight, 마지막 행의 vol=null, 모든 행의 이전 rank=99를 주었다. 마지막 행은 rankingEligibility=insufficient-row-factor-coverage, _compositeZ=null인데 rank=99와 옛 문구가 유지됐다. 동일 입력에서 이전 rank/quantSignal을 제거하면 rank=null이다. 현행 주석의 '근거 없는 행은 null score/rank'와 함수 동작이 어긋난다.

호출 영향 한계: native orchestrator는 provider rows를 calculationRow로 변환하여 호출하며 provider가 실제로 이전 rank를 전달하는지는 확정하지 않았다. on-demand placeAgainstUniverse는 기존 universe 행을 받지만 반환 소비는 candidate 자신의 행 중심이다. 따라서 실제 화면의 잘못된 순위 발생으로 승격하지 않는다. 보강안은 순수 ranker 입구에서 모든 파생 출력 필드를 초기화하고, 재계산에 기존 출력이 섞여도 동일한 결과가 되는 멱등성 fixture를 두는 것이다. 작은 모집단(<5 ranked)에서도 동일 오염 가능성은 소스상 후보이며 이번 fixture는 부족한 단일 행만 재현했다.

## 주 담당자 추가 판독표

FULL은 해당 소스 본문 판독 완료이며 모든 입력·실행 환경의 인증이 아니다. 이전 턴에서 읽고 이번에 기록한 파일도 포함한다. 파일의 최신 해시는 관측 시점 값이며 과거 reader가 동일 해시를 읽었다는 인증은 아니다.

| 파일 | 판독 | 의미·정합성 확인 및 남은 한계 |
|---|---|---|
| cloudflare-worker-proxy.js | FULL cumulative | 예산·예약·정산·라우팅·검색 제한 경로의 누적 판독; 마지막 1317–1320 공백 구간 보완. 배포 서비스 미검증 |
| scripts/build-operations-status.mjs | FULL | health receipt, 12h/48h/24h 기준, fast promotion/soak/rights, 상태 발행 검토. fast blocker와 OPERATOR_REQUIRED 고정 값은 활성화 후 정책 일치 여부 추가 검토 후보; producer 실행 안 함 |
| src/data/normalize/screener.js | FULL | 유한 숫자 정규화·필드 whitelist·WeakMap 재사용. 숫자 정규화만으로 최신성 보장 안 됨 |
| src/data/providers/screener.js | READER full + parent gap | 이전 reader 판독의 290–300 부근 공백을 주 담당자가 281–310으로 보완. 전체 parent 판독으로 표시하지 않음 |
| src/data/contracts/market-snapshot.js | FULL cumulative | quote contract·coverage identity tuple·선택 필드. downstream freshness와 분리 |
| src/data/market-snapshot-loader.js | FULL | fast config·2h artifact age·usable quote·durable fallback. 실외 endpoint 실행 안 함 |
| src/domain/screener/factor-ranks.js | FULL | 입력 선별·시장 분리·lineage·80% 근거·sector 축소·이상값·동률·순위 최소 표본. P6-RANK-01 및 기존 P4-DATA-09 |
| src/domain/screener/factor-weights.js | FULL | 기본 가중치 재정규화·명시 프로필·승격 조건. 예측력 인증과 별개 |
| src/domain/screener/model-fingerprint.js | FULL | 모델/입력 identity 구성. fingerprint는 계산 정확성 증명이 아님 |
| src/domain/screener/market-scope.js | FULL | US/KR 비교 모집단 분리 |
| src/domain/screener/factor-overlap.js | FULL | 완전 사례 Spearman·최소30·상수 제외·고유값 참여율. 팩터 독립성 인증이 아닌 진단 |
| src/domain/screener/evidence-lineage.js | FULL | 출처·권리·관측/수집/가용 시각·calendar. 결과 확정일은 검사 대상 아님 |
| src/domain/screener/channel-signals.js | FULL | 정확 티커 매칭·채널 집계·earnings miss 우선. 14일 cutoff는 상위 데이터 의존 |
| src/domain/screener/saved-screens.js | FULL | v1/v2 migration·정의 검증·크기 제한·공유 정의. 결과 snapshot 공유와 구분 |
| src/domain/screener/condition-text-parser.js | FULL | strict 경계·RSI/return 입력·AND·잔여 문구. unsupported 부분을 조용히 성공시키지 않는 계약 |
| src/domain/screener/custom-conditions.js | FULL cumulative | 필수/선택 필드·strict 경계·중복 후행 승리·커버리지. caller read 함수의 유한값/최신성 책임 유지 |
| src/domain/screener/screen-engine.js | FULL cumulative | AST 삼값 논리·required readiness·필터와 순위 분리·동률·snapshot/input/result ID·v5 replay |
| src/domain/screener/conditional-evidence.js | FULL | 표본 중복/기간 겹침·최소10/30·연도/최근 분할·Wilson. P6-STAT-01 |
| scripts/ci-conditional-evidence-contract.mjs | FULL | 기존 긍정/부정 fixture와 실제 요구 간 공백. 이번 턴 gate 자체 실행은 안 함 |
| src/domain/screener/preset-lessons.js | FULL cumulative | preset별 설명·시장 환경 문구. 문헌의 효과와 이 앱 preset 검증을 구분한다는 코드 주석; 외부 연구 원문 검증은 미실시 |
| src/domain/screener/sector-label.js | FULL | alias→canonical→한국어 라벨·unknown fallback |
| src/domain/screener/price-factors.js | FULL | adjusted/raw 분리·완결 세션·거래량/FX·RSI/Kalman·VCP·결측 gap 보류·provenance. 기술 정의 의존 파일은 후속 판독 필요 |
| src/domain/technical/definitions.js | FULL | SMA/EMA·Wilder ATR·ADR·range·주봉·Weinstein·VCP·breakout 정의. 정렬/유효 OHLC 전제는 caller 책임 |
| src/domain/technical/follow-through.js | FULL | 포켓 피벗·큰 거래량 하락·base reset·climax·지수 하락일 대조. 아래 날짜 gap 후보 유지 |
| src/domain/screener/setup-profile.js | FULL | 결측 보류·USD 가격 조건·EMA basis·상대강도 눌림·과열·승자 필터. 자료 없는 wedge/earnings 구조는 unavailable |
| src/domain/screener/row-presentation.js | FULL cumulative | visible rank·field readiness·market별 session lag·가중치 보류·follow-through 설명 |
| src/domain/screener/screener-read.js | FULL | 상위 집단 분모·섹터 쏠림·회전의 비독립성 고지·validation model mismatch 보류·테마 중복 집계 |
| scripts/lib/factors.mjs | FULL | 날짜 정렬·최대 시장 달력·정확 target date·adjusted-only·rebalance 당시 가격 팩터·live rank 호출·turnover 비용·PIT/생존 편향 보류 |

추가 소스 후보(미확정): follow-through의 downDayResilience는 종목의 직전 유효 행 수익률을 지수의 당일 수익률과 비교한다. priceHistory가 결측 close 날짜를 제외하므로 gap이 있는 종목에서 서로 다른 기간이 비교될 가능성이 있다. priceFactorRow는 ret1d/5d/10d만 gap 보류하고 followThroughFields에 gap 목록을 전달하지 않는다. 실제 artifact 발생·격리 재현은 아직 없으므로 확정 이슈로 세지 않는다. 보강 시 두 관측의 시작·끝 session까지 맞춰야 한다.

백테스트 연결: producer/screener.mjs:616은 148개 이상 이력의 results를 backtestFactors에 넘기고 현재 sector map을 제공한다. 역사 fundamentals·역사 종목 구성·실행 유동성·완전 비용 모델이 없음을 반환 객체가 BLOCKED로 명시한다. 코드 호출 하나의 일치가 라이브 전체 7팩터 예측 검증을 뜻하지 않는다. mixed-market percentile 결합과 동률 분위 경계의 선택 의미는 후속 fixture 대상으로 남긴다.

## 현행 코드와 주석의 불일치

- technical/definitions와 RULES.technical은 rangeSessions=252, fullYearSessions=240이다. price-factors의 일부 주석은 여전히 '252세션 아래는 52주 아님'이라고 설명한다. 실행은 shared RULES를 따르므로 주석 252를 실제 현재 임계값으로 보고하지 않는다.
- setup-profile의 S04 주석은 RVOL이 어떤 행에도 발행되지 않는다고 하지만 price-factors는 rvol20을 계산한다. 주석은 현행 producer 설명으로 부정확하다.
- scripts/lib/factors의 과거 주석/제외 사유는 FMP today-only TTM·수동 시총 seed를 설명하지만 현행 producer는 SEC fundamentals를 병합하고 이 감사에서도 SEC PIT 모듈을 확인했다. 역사 fundamentals가 이 백테스트에 연결됐다는 뜻은 아니다. '백테스트가 역사 재무를 사용하지 않는다'와 '저장소 어디에도 역사 자료가 없다'를 구분해 문서를 개편해야 한다.
- 기존 조건부 통계 gate의 긍정 대조 문구 'closed windows'는 미래 outcome 기간을 검증하지 않는 함수의 실제 책임보다 강하다(P6-STAT-01).

부분 판독: src/data/contracts/screener.js(1–160 및 401–485 부근), src/data/on-demand-symbol.js(초반 및 placement), src/ui/pages/screener.js(conditional evidence 렌더 구간), scripts/ci-research-model-contract-check.mjs(1–45). 이 파일들은 이번 판독으로 FULL 승격하지 않는다.

## 증거·미완료

- 재현: node _artifacts/pipeline-review-20261024/reproduce-pass6.mjs exit 0. 미래/역전 outcome READY와 이전 rank 잔류를 독립 케이스로 확인했다.
- 제품 코드 개선·외부 수집·commit·push·deploy 없음. 브라우저/배포 검증 없음.
- 최초 파일 쓰기는 자동 승인 검토의 사용량 오류로 실행되지 않았다. 사용자 계속 지시 후 같은 apply_patch 재시도가 성공했고 그 후 실제 재현을 실행했다. 실패한 실행을 성공 증거로 계산하지 않았다.
- 다음 남은 주요 경로: 백테스트 longrun과 전체 caller·검증 소비, 전체 UI 및 나머지 미대조 파일. technical 정의/후속 신호, setup/presentation/read, factors 본문은 위 표처럼 추가 판독했다. 전체 파일 대장 NOT_RECONCILED는 이전 기록을 아직 파일별로 대조하지 않았다는 뜻이며 '전혀 안 읽음'으로 해석하지 않는다.

선택 QA: 2026-10-26T08-21-19-780Z-13628-hlsxp1, PASS 5 / CACHED 8 / FAIL 1(syntax). 최초 실패는 동시 작업 중인 src/data/orchestrators/entity.js:20의 디버그 문장 문법 오류였다. 감사 담당자는 수정하지 않았다. 후속 읽기에서 내용이 변경된 것을 확인한 뒤 해당 실패만 rerun-failed했다. 2026-10-26T08-21-51-167Z-10144-tpqokq PASS 1 / FAIL 0. 두 보고서는 pass6-affected-qa.json, pass6-rerun-qa.json에 보존한다. 이 통과는 변화하는 작업 트리 전체 의미 검증이나 배포 인증이 아니다. 감사 스크립트 두 개 node --check 및 감사 폴더 git diff --check도 통과했다.
