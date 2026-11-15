# 백테스트·사후 검증 하네스 실행 결과 (2026-11-15, HEAD 139972316, v60.17)

모든 수치는 이번에 직접 실행해 출력 파일에서 읽은 값이다(**실측**). 해석·연결 판단은 **추정**으로 표시했다.
산출물: `C:\Users\zmfhd\AppData\Local\Temp\claude\fe0e2d61e9e39447\05a1a053-597e-40e5-994a-9d0c651e5fe4\scratchpad\backtests\` (커밋된 파일 사본은 `committed\`).
nEff = 겹치지 않는 forward 구간 수(하네스 자체 계산). 상관 rho는 Spearman, 신뢰구간은 하네스가 낸 nEff 기반 Fisher 구간 또는 Newey-West(HAC) 구간이다.

## 요약 표

| 하네스 | 실행 명령 | exit | 표본 n | 핵심 지표 (실측) | 커밋본 vs 새 실행 (실측) | n으로 결론 가능? |
|---|---|---|---|---|---|---|
| 트레이딩 점수 단기 (history.json) | `node scripts/backtest-trading-score.mjs --out=<scratch>` | 0 | 행 n5d=285, n21d=269 / **nEff5d=57, nEff21d=12** (records 180) | corr5d −0.244, corr21d −0.412, lag1 −0.229/−0.385, significance UNKNOWN, statisticallyMeaningful false | 커밋(11-14 17:21Z): corr5d −0.234, corr21d −0.417, **sampleSizeSufficient true** → 새 실행 **false** (v60.15 nEff 도입 뒤 판정 바뀜) | **아니오** — 21일 독립 구간 12개, CI/p값 없음 |
| 트레이딩 점수 10년 (vol+trend+macro 부분) | `node scripts/backtest-trading-score-longrun.mjs --range=10y --out=<scratch>` | 0 | 2,514거래일(2016-11-14~2026-11-13), 21d nEff 119, 63d nEff 39 | 종합 21d rho −0.158 (nEff CI [−0.329, 0.022], HAC CI [−0.299,−0.014]은 lag-1 진입 기준); 63d rho −0.241 (CI [−0.517,0.081], HAC [−0.463,−0.018]); vol 부분 21d rho −0.175 HAC [−0.311,−0.04]; holdout(2023-11~) 21d rho −0.13 nEff 35 CI [−0.444,0.212]. 점수대별 21d 평균: 0-40 +2.87%(nEff 33), 40-50 +1.82%, 50-60 +0.85%, 60-70 +0.96%, 70-100 +0.73%(nEff 78). 3분위 스프레드 21d −1.06%p(상위 0.82% vs 하위 1.88%). relative-v2 통과 기준(supportsPositive) **미충족** (21d·63d 모두 false) | 커밋(10-31): 21d rho −0.17, CI [−0.208,−0.132](행 수 기준 — 과도하게 좁음), holdout −0.221, 스프레드 −1.25. 새 실행은 같은 방향, 구간은 nEff 기준으로 넓어짐 | **부분적** — 부호는 일관되게 음(+)이 아님. 양의 예측력은 기각에 가깝고, 음의 관계도 nEff CI로는 0 포함(HAC로는 일부 배제). 점수 전체의 ~55% 가중만 다룸 |
| 팩터 10년 (상위 120종목) | `node scripts/backtest-factors-longrun.mjs --range=10y --top=120 --out=<scratch>` | 0 | 120/120 종목, 리밸런스 117 (IC 표본 n=114, momentum 105) | 21d IC: momentum +0.011(HAC t 0.56), trend +0.003, **lowvol −0.051(HAC t −2.14, CI [−0.097,−0.004])**, kalman −0.011, composite −0.016(HAC t −0.83, CI [−0.055,0.022]). 63d composite −0.046(HAC t −1.52), lowvol −0.091(HAC t −2.32). 상위−하위 21d 총 −0.45%p, 비용 후 −0.75%p(HAC CI [−1.97,0.48]), hit 48.2%. holdout composite IC −0.011 (n=36). 외부 Ken French 모멘텀 대조: **UNAVAILABLE (fetch failed)** | 커밋(**2026-07-10**, 128일 경과 > staleAfterDays 120): 21d composite 0.000(t 0.01), lowvol −0.048(t −2.04), 스프레드 −0.36, hit 50. 새 실행 결론 동일 | **예(부정적 결론에 한해)** — 114 시점이면 "종합 순위가 21일 수익률을 예측한다"는 근거가 없다는 결론은 가능. 생존 편향 미통제라 양(+) 결과였어도 상한 추정 |
| 검증 게이트 판정 | `node scripts/build-validation-gates.mjs --backtest <scratch>/factor-backtest-longrun.json --out-dir <scratch>/gates` (+ `--check`) | 첫 시도 1 (out-dir 미생성 ENOENT) → 0; `--check`(새 backtest) 1; `--check`(커밋 backtest) 0 | 요건 7개 | 새 실행: BLOCKED/BLOCKED, blockers 5개(pointInTimeUniverse, delistingAndCorporateAction, filingAvailableDate, liquidityCapacityModeled, liveBacktestParity). predictiveValidation not-established. evidenceModelMatchesLive **false**(백테스트 4팩터 vs 라이브 6팩터: quality·value 포함) | 커밋: BLOCKED, blockers 7개(+transactionCostsModeled, turnoverModeled). 새 백테스트는 turnover·비용 필드가 있어 그 2개가 풀림 — 커밋 백테스트가 오래돼서 생긴 차이 | 해당 없음(구조 요건 판정) |
| 폭락 구간 재생 | `node scripts/ci-crash-replay-check.mjs --verbose` | 0 | 3개 합성 앵커 창(2022 약세, 2024-08, 2025-04) + 3개 실측 2026 창, 판독 24개 | PASS. 스크립트 스스로 "regression/consistency only, not predictive validation (R708)" | 커밋 결과 파일 없음(CI 체크) | **아니오** — 예측 검증이 아님(정의상) |
| VIX 구간별 이후 수익 | `STRESS_FORCE=1 node scripts/build-stress-outcomes.mjs` (public-data 덮어씀 → 사본 후 `git checkout`) | 0 | 1990-01-02~2026-11-13, 9,286일 | 전체 21d: 평균 +0.81%, 상승 63.9%, nEff 441. 구간별 21d 상승률·nEff: <15 65.2%/141, 15-20 63.2%/137, 20-25 59.7%/87, 25-30 64.3%/41, 30-40 74.2%/**25.1**, 40+ 63.5%/**9.9**. 63d: 30-40 80.7% nEff 8.4, 40+ 66.8% nEff 3.3 | 커밋(11-11)과 소수점 수준만 다름(전체 21d n 9262→9265, 63d 평균 2.44→2.43). diff 1줄(파일이 한 줄 JSON) | **대부분 아니오** — 30 이상 구간은 nEff 25 이하(63d는 8 이하). 하위 구간만 n 충분하지만 기본값과 차이가 작음 |
| 시나리오 분기·테마 단계·조정 기저율 | `SCENARIO_OUTCOMES_FORCE=1 node scripts/build-scenario-outcomes.mjs` (위와 같은 복원 절차) | 0 | 분기 10개(겹치지 않는 사례 67~139), 테마 15개, 나스닥 7% 조정 40건 | 분기 20일 상승 비율(기본 64%): reheat 81/139, softland 62/87, slowdown 61/94, oilshock 43/67, creditstress 39/70, dollarsurge 58/101, reflation 41/73, volshock 49/69, aibust 41/73, fiscalsteep 54/83. 조정 40건 중 약세장 8건(빠른 조정 32건 중 4건). 테마 단계(63일, **지수 대비 초과** 기준): 예 SMH 주도 26/39(기준 57%), XLU 방어 3/10(기준 46%) | 분기·조정: 커밋과 동일(중앙값 2곳만 slowdown 1.5→1.8, creditstress 0.9→1.2). **테마: 커밋본은 절대 수익 기준**(outcome 필드 없음, 기준율 64%), 새 실행은 초과 수익 기준 → 상승 횟수 크게 다름(XLU 방어 9/10 → 3/10, XLP 방어 9/11 → 2/11, SMH 횡보 50/72 → 38/72) | 분기: 사례 수는 결론 가능 수준(≥67)이나 대부분 기본 64%와 가까움(추정: 표준오차 약 ±5~6%p). 테마 단계: 사례 2~39개, 대부분 30 미만 → **아니오** |
| 연구 검증 오프라인 체크 | `node scripts/ci-research-validation-check.mjs` | 0 | 픽스처 | "research-validation check passed" | — | 해당 없음(구현 검사) |
| 프로덕션 팩터 IC 누적 (fetch-data 내부) | 실행 안 함(로컬 프로듀서 금지) — 커밋된 `public-data/backtest-history.json`만 읽음 | — | 일별 96행, 각 행은 **6개 리밸런스** | 최신(11-13): composite IC +0.011, 스프레드 +0.07, 비용 후 −0.35, hit 66.7%, net hit 50%. 96행 composite IC 평균 +0.017(범위 −0.09~+0.10, 양수 61%). 모델 지문 5종 혼재, 최신 지문 factor-ranks.v8(라이브는 v9) | 비교 대상 없음 | **아니오** — 행마다 6개 시점이고 96행은 서로 거의 같은 창을 겹쳐 씀(추정) |

## 하네스별 의미

**트레이딩 점수 단기.** 홈 중심 지표를 history.json으로 재구성하면 점수가 높을수록 이후 5·21일 SPX 수익이 낮았다(−0.24/−0.41, 실측). 하지만 21일 독립 구간이 12개뿐이라 어떤 방향도 말할 수 없다. 커밋본은 `sampleSizeSufficient: true`였고 새 코드는 false로 바뀌었다 — 커밋본을 근거로 "표본 충분"이라고 읽으면 안 된다(다음 데이터 갱신에서 덮어씌워질 것으로 추정).

**트레이딩 점수 10년.** 이 제품의 점수 방향 가정(양호할수록 좋다)에 대해 가장 강한 증거다. 10년, nEff 119에서 종합 점수는 21일 rho −0.158, 점수대 0-40 뒤 평균 +2.87% vs 70-100 뒤 +0.73%(실측) — 점수가 낮은 날 뒤가 더 좋았다. 양(+)의 예측력은 지지되지 않으며 relative-v2 통과 기준도 실패. 화면 쪽은 `trading-score.js:283-292`가 `predictiveValidation`과 `researchBoundary: 'market-condition-index-reference-only'`로 막고 있어 점수 자체를 예측으로 부르지는 않는다. 다만 아래 "주장 점검" 1번 참고.

**팩터 10년.** 스크리너 종합 순위(모멘텀·추세·저변동·칼만)는 21·63일 수익과 관계가 없다(composite IC −0.016, HAC t −0.83, 실측). 유일하게 0을 벗어난 팩터는 저변동인데 **부호가 반대**다(IC −0.051, HAC CI 상한 −0.004 — 저변동 종목이 오히려 덜 올랐다; 생존 편향된 대형주 120개, 2016~2026 강세장 표본이라는 점이 섞였을 것으로 추정). 비용 후 상위−하위는 −0.75%p. 커밋된 결과는 7월 것이라 128일로 stale(화면은 `validation-records.js:12`가 stale로 표시). 외부 대조(Ken French)는 네트워크 리셋으로 실패.

**검증 게이트.** 새 백테스트로도 BLOCKED 유지. 라이브 모델은 quality·value를 포함한 6팩터인데 백테스트는 4팩터라 `evidenceModelMatchesLive: false` — 라이브 순위 가중의 3분의 1 이상(추정)은 어떤 과거 검증도 받지 않았다. 화면 `validation-tab.js:29`의 "과거 검증으로는 아직 효과를 판단할 수 없습니다"는 증거와 맞는다.

**폭락 재생.** 규칙이 폭락 모양에서 말이 되는 판독을 내는지만 확인한다(PASS). 예측력에 대해서는 아무것도 말하지 않으며 스크립트도 그렇게 밝힌다.

**VIX 구간.** VIX 30~40 뒤 21일 상승 74.2%(기본 63.9%)지만 nEff 25.1로 30 미만이다. 시장 기울기에서는 `market-lean.js:69-72`가 이 항목을 참고로만 두고 표결에 넣지 않으며, 화면 `stress-outcomes.js:87-95`도 평균 범위가 겹치는지 말해 준다 — 증거보다 강한 주장은 찾지 못했다.

**시나리오·테마.** 분기 대부분은 20일 상승 비율이 기본 64% 근처라 "이 분기면 이렇게 된다"는 정보가 거의 없다(추정: softland 71%, volshock 71%만 기본 대비 +7%p). 중요한 발견: **커밋된 `scenario-outcomes.json`의 테마 단계 수치는 v60.15 이전의 절대 수익 기준**인데, v60.15(8a77e6e34)부터 코드는 지수 대비 초과 기준을 낸다. 규칙 문자열이 `theme-stage.v2` 그대로라 프로듀서의 7일 신선도 검사(`build-scenario-outcomes.mjs:75-76`)가 재생성을 건너뛰고, 커밋본(11-14 14:26Z)은 **2026-11-21 무렵까지** 시장 상승분이 섞인 수치를 계속 낸다(추정: 다음 refresh-data 실행 일정 기준). 화면 문구(`analogs.js:191-193`)는 outcome 필드가 없으면 "올랐습니다"로 쓰므로 거짓 표기는 아니지만, 단계 판독이 주장하지 않는 시장 상승분을 근거로 보여 준다(예: 유틸리티 방어 단계 10번 중 9번 상승 → 초과 기준이면 10번 중 3번).

## 화면 주장 점검 (증거보다 강한가)

1. **시장 기울기 "약한 매수 우위 (조건 기준)"** — `src/domain/market/regime/market-lean.js:17`(라벨), `:46`(양호가 부담보다 2개 많으면 +1 표), `:125`(라벨 조립). 미국 6개 지표 개수가 양호 쪽이면 "매수 우위" 쪽으로 기운다. 그 6개 지표 개수 자체를 이후 수익과 맞춘 하네스는 없다(폭락 재생은 일관성 검사뿐). 가장 가까운 증거인 트레이딩 점수 10년 백테스트(변동성·추세·매크로)는 **양호할수록 이후 21일 수익이 낮았다**(실측). 문구가 "(조건 기준)", "방향이 정해졌다는 뜻은 아닙니다"(`:101`)로 한정하고 R697로 확률이라 부르지 않는 점은 맞지만, "매수/매도 우위"라는 단어는 방향 주장이며 증거는 그 방향을 지지하지 않는다(6개 지표와 점수 구성이 같지 않으므로 연결은 **추정**). 소유자 판단 대상.
2. **테마 단계 과거 빈도** — 위 시나리오 항목. 2026-11-21 재생성 전까지 절대 수익 기준 수치(시장 상승분 포함)가 표시됨(실측: 커밋본에 outcome 필드 없음, 기준율 64% vs 새 실행 38~57%).
3. 스크리너 검증 탭(`validation-tab.js:212-214`): 현재 값(composite 0.011, 비용 후 −0.35)이면 "관계가 확인되지 않았습니다"가 나온다 — 증거와 일치. 단 `composite > 0.03 && net > 0`이면 6개 시점만으로 "약하게 같은 방향"이라고 쓰는 분기가 있다(지금은 발동 안 함, 참고).
4. 트레이딩 점수, VIX 구간, 검증 게이트: 증거보다 강한 표현을 찾지 못함.

## 실패·이상

- `backtest-factors-longrun.mjs` 외부 벤치마크: `{"status":"UNAVAILABLE","windows":0,"reason":"fetch failed"}`. 직접 확인: `curl: (35) Recv failure: Connection was reset` (mba.tuck.dartmouth.edu). 백테스트 자체는 exit 0.
- `build-validation-gates.mjs` 첫 실행: `Error: ENOENT: no such file or directory, open '...\scratchpad\backtests\gates\screener-validation-gate.json'` — 스크립트가 `--out-dir`를 만들지 않음. 디렉터리를 만든 뒤 exit 0.
- `build-validation-gates.mjs --backtest <새 결과> --check`: exit 1 — 커밋된 게이트 파일(blockers 7)과 새 백테스트 판정(blockers 5)이 다름. 커밋된 백테스트 기준 `--check`는 `validation gates OK: BLOCKED/BLOCKED`.
- 프로덕션 팩터 IC(`fetch-data.mjs` backtestFactors)는 로컬 프로듀서 금지 원칙에 따라 실행하지 않고 커밋 파일만 읽음.
- `build-scenario-state.mjs`의 eventOutcomes는 발표치를 분기 규칙과 대조할 뿐 이후 수익을 채점하지 않아 대상에서 제외.

## 작업 트리

`build-stress-outcomes`·`build-scenario-outcomes`는 `public-data/`를 직접 덮어써서 `git diff --stat` 각 1줄 변경(파일이 한 줄 JSON) 기록 후 scratch로 복사하고 `git checkout --`으로 되돌림. 나머지는 모두 `--out`/`--out-dir`로 scratch에 씀.
