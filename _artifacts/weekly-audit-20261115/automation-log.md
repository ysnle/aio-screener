# 자동화 주간 로그 — 2026-11-09(월) ~ 2026-11-15(일)

작성 2026-11-15 05:55Z · 저장소 읽기 전용 감사(커밋·체크아웃 없음) · 표기: **[실측]** 도구로 직접 확인, **[추정]** 근거로 추론.

- 날짜 구분은 **UTC 달력일**이다. 미국 정규장 = 14:30–21:00 UTC(ET 09:30–16:00, EST), 한국 정규장 = 00:00–06:30 UTC(KST 09:00–15:30). 따라서 "UTC 11-12" 행은 KST 11-12 09:00–익일 09:00이다.
- 거래일: 미국·한국 모두 11-09~11-13(월~금). 11-11 미국 재향군인의 날은 주식시장 개장(채권만 휴장). 11-14·11-15는 주말.
- 비교 기준선: 11-07 마지막 커밋 `9dae3412e`(23:26Z). 얕은 클론이지만 11-07~11-15 각 일자 마지막 커밋이 모두 `git cat-file -e`로 존재 확인됨 [실측]. 11-08(일)은 기준 비교용으로 함께 표시한다.
- 원자료(같은 폴더): `actions-workflow-by-day.csv`, `actions-failures.csv`(실패 217건 원인 분류), `actions-runs-raw.json`(실행 4,193건), `artifact-day-matrix.csv/json`(public-data JSON 1,103개 × 9일), `artifact-key-values.csv`(주요 산출물 핵심 값), `refresh-commits-marketAnalysis.csv`(시장·뉴스 갱신 커밋 257개별 AI 해설 상태).

## 한 줄 결론

자동화는 일주일 내내 돌았고 저장소의 시장·뉴스 데이터도 매일 바뀌었다. 다만 **실서비스(GitHub Pages)는 두 번 멈췄다**. 11-10 17:57Z부터 11-11 00:47Z까지 약 6시간 50분, 11-11 23:28Z부터 11-12 14:12Z까지 약 14시간 44분이다. 원인은 CI가 데이터 커밋을 계속 거부한 것이고, 그동안 converge 단계가 배포를 막았다. 11-10 미국 장 후반과 11-12 한국 장 전체는 저장소에만 있고 사이트에는 늦게 올라갔다. 이와 별개로 **AI 시장 해설은 11-10 14:53Z부터 11-11 01:53Z까지 약 11시간 동안 공급자 429 오류(크레딧 소진)로 차단**됐다. **오늘 판정 문장은 한 주 동안 거의 같은 문장에 머물렀다.**

---

## 표 A — 워크플로 × 일자 (실행 / 성공 / 실패) [실측]

`gh run list`로 하루 단위 조회. 11-09는 1,000건 상한에 걸려 6시간 단위 4구간으로 나눠 다시 받았다(합계 1,052건). "건너뜀"은 skipped·startup_failure 같은 기타 결론이다.

| 워크플로 | 11-08 | 11-09 | 11-10 | 11-11 | 11-12 | 11-13 | 11-14 | 11-15(~05:36Z) | 중앙 소요 |
|---|---|---|---|---|---|---|---|---|---|
| Refresh market data | 31/30/1 | 30/27/3 | 38/24/**14** | 51/49/1 (+1 startup_failure) | 52/24/**28** | 51/51/0 | 53/53/0 | 12/12/0 | 평일 340–460s, 11-14 14s(주말 skip) |
| Refresh screener and SEC fundamentals | 7/6/1 | 6/4/2 | 5/3/2 | 5/3/2 | 5/2/3 | 5/5/0 | 5/4/1 | 2/2/0 | 620–890s |
| Event briefs | 46/45/1 | 75/75/0 | 76/76/0 | 76/74/0 (+2) | 74/74/0 | 76/76/0 | 76/76/0 | 18/18/0 | 25–35s |
| CI | 98/77/7 (취소14) | 133/116/11 (취소6) | 106/71/**35** | 98/95/3 | 91/56/**35** | 102/102/0 | 40/40/0 | 13/12/1 | 205–267s |
| Deploy GitHub Pages | 80/45/0 (+35) | 92/50/1 | 34/31/0 (+3) | 51/51/0 | 25/25/0 | 52/52/0 | 33/33/0 | 11/10/0 | 30–43s |
| Deploy fast data plane | 49/14/0 (+35) | 60/19/0 (+41) | 6/3/0 | 4/4/0 | 2/2/0 | 1/1/0 | 3/3/0 | 2/1/0 | 6–105s |
| Deploy AI proxy | 49/14/0 (+35) | 60/19/0 (+41) | 6/2/1 | 4/3/1 | 2/2/0 | 1/1/0 | 3/3/0 | 2/1/0 | 1–170s |
| Data freshness watchdog | 113/41/23 (취소49) | 121/56/5 (취소60) | 16/1/**13** | 11/8/2 | 7/6/1 | 6/6/0 | 20/20/0 | 9/7/1 | 55–70s |
| Browser live-data watchdog | 2/2/0 | 2/1/1 | 2/1/1 | 2/1/1 | 2/1/1 | 2/1/1 | 2/1/1 | 1/1/0 | 400–650s |
| Operations failure escalation | 346/158/0 | 397/171/2 | 118/104/0 | 155/154/0 | 147/147/0 | 143/143/0 | 169/169/0 | 49/45/0 | 8–10s |
| CodeQL | 66/59/1 | 59/51/2 | 6/6/0 | 4/4/0 | 2/2/0 | 1/1/0 | 3/3/0 | 2/2/0 | 154–455s |
| Live user journey | – | 11/4/7 | – | – | – | – | – | – | 771s |
| 주간 작업(지식 lint, 매크로 달력 검토, 운영 리뷰) | – | 각 1/1/0 | – | – | – | – | – | – | – |
| AI effort experiment(수동) | – | – | – | 2/2/0 | 1/1/0 | – | – | – | – |

### 실패 원인 분류 (217건) [실측: 각 실패 실행의 `--log-failed`]

| 분류 | 건수 | 기간(UTC) | 대표 run id | 한 줄 원인 |
|---|---|---|---|---|
| CI `metric-consistency` | 42 | 11-09 07:24–08:00, 11-10 18:23–11-11 00:26 | 42894858984, 42579130676 | 두 화면의 신용 판정이 어긋남: "today credit judgement … favorable vs neutral", "매크로 신용 장 state … favorable vs neutral". 새 데이터가 들어올 때마다 이 불변식이 깨져 데이터 커밋 CI가 모두 빨강 |
| CI `data-pipeline` | 35 | 11-12 00:54–13:53 | 43130686267, 43231704666 | `screener-universe.json`이 `js/aio-data.js` SCREENER_DB와 어긋남(코드 변경 뒤 생성물 미갱신). 같은 로그에 FOMC 달력 HTTP 503 경고 |
| Refresh `converge: UNATTESTED_REVISION` | 46 (+1 AWAITING) | 11-08 14:27 – 11-12 13:50 | 42894352739 | 위 CI 실패의 결과. "CI finished … without a successful attested run; refusing to deploy" → 데이터는 커밋됐지만 Pages에 배포되지 않음 |
| Screener `converge: UNATTESTED_REVISION` | 7 | 11-08 07:25 – 11-12 07:46 | 42891215755 | 같은 원인(CI 빨강) |
| Screener 검증기 breadth < 80% | 3 | 11-09 07:15, 11-11 01:29, 11-14 01:52 | 42578182472, 43543115717 | "[screener-validator] all/us breadth coverage below 80%" |
| Screener 검증기 스키마 | 1 | 11-11 19:59 | 43092296406 | "row AACG has fields outside the core row schema: partialSessionDropped" |
| Data freshness watchdog `external-pipeline` | 20 | 11-09 10:45 – 11-15 03:39 | 43673336819 | 각 워크플로의 최근 완료 실행이 실패이거나 라이브 revision이 어긋나면 실패하는 게이트. 대부분 CI 빨강 구간과 겹침. 상세 JSON은 artifact에만 있어 실패한 하위 항목까지는 확인하지 못함 [추정] |
| Watchdog `browser-data-pin-drift` / `knowledge-lint` / 이전 실패 보존 | 9 / 2 / 12 | 11-08 00:46–08:23 | 42431276387 | 주간 시작 전(11-08). 프로듀서 출력 형태가 바뀌어 핀 데이터와 어긋남. 문서 인코딩 손상 |
| Browser live-data watchdog | 6 (평일 아침마다 1건) | 11-09 – 11-14 | 42548483487, 42755346559, 43147980326, 43455230073, 43547787010, 42944927002 | contrast/focus(뉴스 링크가 기본 색), 렌더 문구 lint("원/달러 0.0%(원화 강세)", "중앙값 +0.0%"), entity-quality, 재핀 checkout 충돌 |
| CI `browser-rendered-copy-lint` | 2 | 11-10 00:41, 11-15 03:32 | 43672788909 | zero-direction(fxbond), mixed-precision(AI 브리핑 "-3.67% … -13.1%") → v60.17(04:07Z)이 같은 문제를 다룸 |
| Deploy AI proxy 상위 공급자 429 | 2 | 11-10 13:45, 11-11 00:47 | 42934098837 | "ai_proxy_upstream_failed: HTTP 429", "credit_balance_exhausted". 13:45 실행은 digest-mismatch 뒤 자동 롤백 |
| Live user journey 브라우저 오류 | 7 | 11-09 02:27–05:23 | 42551054405 | 화면별 browser errors(당일 push 연쇄) |
| 기타 | 각 1–5 | 11-08–11-09 | 42556539058, 42480198913, 42466740668 | Pages 배포 timeout, event-briefs push 거부(rebase 충돌), CodeQL CLI 다운로드 실패, CI 게이트 다수(generated-state, interpretation-boundary, patch-comment-ratchet, narrative-lifecycle, browser-boot) |

### 공백 (예정 주기보다 길게 멈춘 구간) [실측]

- **Pages 성공 배포가 없던 구간(실서비스 동결)**
  - ① 11-10 17:57Z → 11-11 00:47Z (6h50m) = ET 11-10 12:57–19:47(미국 장 후반·마감·시간외), KST 11-11 02:57–09:47. 원인은 metric-consistency.
  - ② 11-11 23:28Z → 11-12 14:12Z (14h44m) = KST 11-12 08:28–23:12(**한국 정규장 전체**), ET 11-11 18:28 → 11-12 09:12(미국 개장 전까지). 원인은 data-pipeline.
- **Refresh 주기**: 코드상 평일은 30분 주기다. 일정은 Worker 디스패처의 :20/:50 호출과 GitHub cron :17/:47로 잡힌다(`scripts/refresh-cadence.mjs`). 실제 GitHub cron은 하루 4–5회만 실행됐고, 주기는 Worker 디스패치에 의존했다.
  - 11-09에는 :50 디스패치가 3회뿐이었다. 그 결과 **월요일 하루 종일 한 시간 간격**이었다(미국 장 14–20 UTC 시간당 1회).
  - 11-10에는 :50이 12회였고, 30분 주기는 11 UTC 무렵부터 회복됐다.
  - 11-11 20:20Z 실행(43095467730)은 startup_failure였다. 그래서 19:53→21:00 사이 67분 동안 커밋이 없었다(미국 마감 직전).
  - 11-11~11-13은 시간당 2회로 정상이었다. 11-14·15 주말은 설계대로 시간당 1회 뉴스 주기로 돌았다.
- Data freshness watchdog schedule 공백은 최대 647분(11-09 06:53→17:40)이다. 이 워크플로는 주로 workflow_run으로 실행되므로 공백 자체는 정상 범위로 본다 [추정].
- Event briefs: 20분마다 디스패치(하루 72회)됐고 전부 성공했다. 커밋은 내용이 바뀔 때만 생긴다. 11-14 08:26→11-15 00:06에 커밋이 없었는데, 주말이라 새 공시가 없었기 때문이다.

---

## 표 B — 데이터 커밋 / 일자 / 유형 (UTC, `git log HEAD --since=2026-11-08T00:00Z`, 954커밋, first-parent 464) [실측]

| 유형 | 11-08 | 11-09 | 11-10 | 11-11 | 11-12 | 11-13 | 11-14 | 11-15(~04:07Z) |
|---|---|---|---|---|---|---|---|---|
| 시장·뉴스 갱신 (`data: refresh market and news`) | 24 | 27 | 38 | 46 | 48 | 45 | 25 | 4 |
| event briefs | 16 | 39 | 54 | 43 | 33 | 49 | 7 | 1 |
| 스크리너+SEC 펀더멘털 | 6 | 4 | 5 | 3 | 5 | 4 | 4 | 1 |
| 확장 유니버스 | 3 | 3 | 2 | 1 | 2 | 2 | 0 | 2 |
| 병합 | 21 | 43 | 23 | 24 | 3 | 7 | 3 | 1 |
| 코드·문서 | 45 | 58 | 35 | 87 | 11 | 39 | 4 | 4 |

**시간대 분포 (시장·뉴스 커밋, UTC 시간별 0–23)**

```
11-08 1 1 1 1 1 1 1 1 1 1 1 1 1 0 2 1 1 1 1 1 1 1 1 1   (일, 주말 주기)
11-09 1 1 2 1 1 1 1 2 1 1 1 1 1 1 1 1 1 2 1 1 1 1 1 1   (월, 30분 주기 미달)
11-10 1 1 1 2 1 1 1 1 1 1 1 2 1 1 2 2 2 2 3 2 2 2 2 3
11-11 2 2 2 2 2 2 2 2 2 1 2 2 2 2 2 3 2 2 2 2 0 2 2 2   (20시 공백)
11-12 1 3 2 1 2 2 2 1 3 2 2 2 2 2 2 2 3 2 2 2 2 2 2 2   (00–14시는 저장소에만 있음, 배포 안 됨)
11-13 2 2 2 1 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 1 1
11-14 1 1 1 1 1 1 1 1 1 1 1 1 1 1 2 1 1 1 1 1 1 1 1 1   (토)
11-15 1 1 1 1 (04:07Z HEAD까지)
```

- **세션 커버리지**: 한국 장(00–06 UTC)·미국 장(14–21 UTC)·장외 모두 매일 커밋이 있었다. 다만 11-09는 두 장 모두 한 시간 간격이었다. 11-10 미국 장 후반과 11-12 한국 장은 커밋은 됐지만 위 동결 구간에 걸려 사이트에는 늦게 반영됐다 [실측].
- 스크리너+SEC는 하루 2회 돈다. 한국 마감 뒤(~07:2x–08:0x UTC)와 미국 마감 뒤(~20:0x–22:5x UTC)다. 확장 유니버스는 11-11 아침 실행분이 없었다(11-10 22:40 → 11-11 22:37, 1,437분). 11-14(토)는 실행분이 없었다.

---

## 표 C — 산출물 × 일자 변경 매트릭스 [실측]

방법: 각 UTC 일자의 마지막 커밋에서 `git ls-tree`로 blob을 비교했다. 바뀐 파일은 파싱한 뒤, 시각 필드(generatedAt·fetchedAt·revision 등)와 문자열 안의 ISO 시각을 지우고 다시 비교했다.
기호: `C` 내용 변경, `t` 시각만 변경, `.` 변경 없음, `B` 15MB 초과라 blob 비교만 함.
열 순서는 11-08 11-09 11-10 11-11 11-12 11-13 11-14 11-15이다.

```
CCCCCCCC data.json                         CCCCCCCC market-snapshot.json        tttttttt market-snapshot-status.json
CCCCCCCC history.json                      CCCCCCCC market-day.json             CCCCCCC. today-verdict.json
CCCCCCC. scenario-state.json               ......C. scenario-outcomes.json      ...C.... stress-outcomes.json
CCCCCCCC event-briefs.json                 CCCCCCCC telegram-digest.json        CCCCCCCC telegram-observed.json
CCCCCCCC screener.json                     CCCCCC.C screener-extended.json      CCCCCC.C screener-extended-universe.json
CCCCtCCC sec-fundamentals-summary(.manifest).json   CCCCCC.C sec-fundamentals-extended.json   CtCCtCCt sec-fiscal-history.json
tCCCCCCt theme-stage-history.json          tCCCCCCt breadth-contributors.json   tCCCCCCC consensus-estimates.json
CCCCCCCC earnings-calendar.json            ttttCCCC macro-calendar.json         CCCCCCCt macro-history.json
tCCCCC.. kr-index-weights.json             tCCCCCtt kr-investor-flows.json      .CCCCCC. market-temperature.json
.CCCCC.. rotation-detail.json              tCCCCCC. score-backtest-history.json tCCCCCCt screener-candidate-archive.json
CtCCCCtt sp500-weights.json                tCCCCCC. us-listings.json            tCCtCCCt treasury-auctions.json
...CCCC. tw-monthly-revenue.json           tttttttt bigtech-cashflow.json       CCCCCCC. official-references.json
CCCCCCCC operations-status.json            CCCCCCCC reconciliation-status.json  CCCCCCCC operations-slo-window.json
CCCCCCtt freshness/refresh-data.json       CCCCCCtt freshness/refresh-screener.json   CCCCCCC. backtest-history.json
.C..CC.. screener-universe.json            CCCCCCCC atlas/index.json
........ 한 주 내내 불변: atlas/* 13개, factor-backtest-longrun(07-10), model-validation-status(11-04), operator-note(10-15),
         score-backtest-longrun(10-31), screener-validation-gate(11-04), structural-data-research(08-21),
         telegram-reference-window(08-02), user-research-digest(10-12), objects/* 37, principles/* 7
묶음: company-profiles 276개 중 275개가 11-08에만 변경 뒤 불변 · knowledge 653개 중 1개만 11-08 변경 · masters 63→23개(11-08, 13F 저장소 이동)
```

### 주요 산출물 핵심 값 (일자별 마지막 커밋 기준) [실측]

| 일자 | S&P500 종가(일간%) | VIX | KOSPI(일간%) | US10Y | AI 해설 상태 | 오늘 판정(asOf·전체·문장) | 시나리오 선두/대안 | 뉴스 수·최신 |
|---|---|---|---|---|---|---|---|---|
| 11-08 | 7376.86 (+0.31) | 25.64 | 5059.69 (-6.02) | 4.86 | verified | 11-06 다소 부담 "지수를 받치던 주도주가 함께 약해지고 있습니다." | reflation/volshock | 39 · 11-08 22:59 |
| 11-09 | 7549.94 (**+2.35**) | 19.92 (-22.3%) | 5018.85 (-0.81) | 4.86 | verified(보존) | 11-09 혼조 같은 문장 | reflation/aibust | 38 · 11-09 22:57 |
| 11-10 | 7520.93 (-0.38) | 19.46 | 5239.13 (**+4.39**) | 4.98 | **blocked provider-http-429** | 11-10 혼조 "지수 쪽 지표는 우호적이지만 AI·반도체 주도주가 약해…" | reflation/aibust | 40 · 11-10 22:52 |
| 11-11 | 7619.38 (+1.31) | 17.49 | 5375.36 (+2.60) | 5.00 | verified(보존) | 11-11 혼조 "주도주가 함께 약해지고" | reflation/aibust | 40 · 11-11 22:48 |
| 11-12 | 7592.40 (-0.35) | 18.70 | 5342.73 (-0.61) | 5.10 | verified | 11-12 혼조 같은 문장 (2/3/1) | reflation/aibust | 39 · 11-12 22:40 |
| 11-13 | 7561.67 (-0.40) | 19.30 | 5290.53 (-0.98) | 5.15 | verified | 11-13 혼조 같은 문장 (2/3/1) | reflation/aibust | 40 · 11-13 22:52 |
| 11-14 | 7561.67 (금 종가) | 19.30 | 5290.53 | 5.15 | verified | 11-13 혼조 같은 문장 (**1**/4/1, 토요일에 바뀜) | reflation/aibust | 30 · 11-14 22:00 |
| 11-15 | 7561.67 | 19.30 | 5290.53 | 5.15 | verified **salvaged 1줄** | 11-13 혼조 (변경 없음) | reflation/aibust | 31 · 11-14 22:54 |

그 밖의 산출물 [실측]:

- **history.json**: 마지막 행 날짜가 매일 전진했다(11-09 7549.94 → 11-13 7561.67). 행 수는 420으로 고정이다. 주말 행(11-07·08, 11-14·15)은 직전 금요일 값을 그대로 담는다.
- **market-day.json**: sessions는 us/kr 11-09→11-13로 매일 전진했다. facts는 154→103개로 줄었다.
- **event-briefs.json**: 브리프 103→114개. 최신 공시는 11-09 21:49 → 11-10 21:05 → 11-12 21:10 → 11-13 11:02이고, 11-11에는 새 공시가 없었다.
- **telegram-digest.json**: 한 주 내내 `collectionStatus: partial`, 채널 3개였다. 최근 24시간 관측은 105→201→94건.
- **screener.json**: factorSessionDate가 11-09→11-13로 매일 전진했다. universe는 1,159에서 1,157이 됐고 `fmpOk=false`가 계속됐다.
- **screener-extended.json**: 11-14는 불변이었다. 11-15에는 ok 3,853에서 **3,669**로 줄었다.
- **sec-fundamentals-extended.json**: attempted가 0인 날이 11-09·11-12·11-15다. stored는 3,514→3,505→3,510, failures는 367→370으로 늘었다. 11-11에만 218건을 시도해 155건을 갱신했다.
- **macro-calendar.json**: 11-08~11-11은 시각만 바뀌었다. 11-12·11-13은 status `partial`이었고, 11-15에 이벤트가 48개에서 46개가 됐다.
- **macro-history.json**: 매 평일 변경됐고 status는 ok였다.
- **market-temperature, rotation-detail, kr-index-weights**: 거래일마다 갱신됐고, 주말에 멈춘 것은 정상이다.
- **stress-outcomes.json**: 11-11에만 갱신됐다(to=11-10). 주간 산출물이다.
- **scenario-outcomes.json**: 11-14에만 갱신됐다(to=11-06에서 11-13으로).
- **operations-status.json**: 한 주 내내 overall `OPERATOR_REQUIRED`였다. fast plane은 secretConfigured `OPERATOR_REQUIRED`, licensedForUse `REVIEW_REQUIRED`, browser plane은 `UNKNOWN/NOT_OBSERVED`였다.
- **reconciliation-status.json**: 한 주 내내 `PARTIAL`이었다. 11-10에 PARTIAL 12/MATCH 6/BLOCKED 4에서 13/5/4로 바뀌었다. BLOCKED는 Put/Call, NAAIM, Investors Intelligence, KRX 라이선스다.
- **operations-slo-window.json**: 한 주 내내 `NOT_CERTIFIED`였다. 11-15 watchdog 로그 기준으로 7d FAIL이고 market/screener/watchdog 영역이 DEGRADED다.
- **freshness/refresh-data.json**: 매 실행에서 `official-references`·`stress-outcomes`·`scenario-outcomes`는 not-written이다. 주기상 정상이다.
- **freshness/refresh-screener.json**: `kr-fundamentals.json: missing`이 한 주 내내 찍혔다.

---

## 목록 D — 멈춤·지연·저하 항목 (사용자 눈에 띄는 순)

1. **실서비스 동결 2회** [실측]
   - 11-10 17:57Z → 11-11 00:47Z: CI 42건 실패(metric-consistency 신용 판정 불일치, run 42894858984 등) → converge 46건 거부 → Pages 성공 배포 없음. 저장소 커밋은 계속됐다(11-10 18–23시 UTC에 시장·뉴스 14커밋).
   - 11-11 23:28Z → 11-12 14:12Z: CI 35건 실패(data-pipeline screener-universe drift, run 43130686267→43231704666). 한국 11-12 정규장 데이터가 장중 내내 사이트에 없었다.
   - 사용자가 그동안 본 것은 마지막으로 배포된 정적 데이터다 [추정]. 시세만큼은 fast data plane(Cloudflare Worker)이 따로 제공했을 수 있지만, 이 감사에서는 확인하지 못했다.
2. **AI 시장 해설 11시간 차단** [실측]
   - 11-10 14:53Z부터 11-11 01:53Z까지 시장·뉴스 커밋 25개가 `marketAnalysis.status=blocked`, reason `provider-http-429`였다(첫 커밋 be745561b, 마지막 a72642d46). 화면 문구는 "이번 갱신의 시장 해석이 자동 검증을 통과하지 못해 확인된 지표만 보여 드립니다"였다.
   - 같은 시각 Deploy AI proxy 로그에 `credit_balance_exhausted`가 찍혔다(42934098837). event-briefs의 ai 상태도 11-10에 `provider-http-429`였다.
   - 11-11 02:24에는 다른 사유(axis-state-contradiction:credit)로 1회 더 차단됐다.
3. **오늘 판정이 고정된 것처럼 보임** [값은 실측, 판단은 추정]
   - `today-verdict.json`의 heroLine이 11-07~11-15 스냅샷 9개 중 8개에서 같은 문장이었다("지수를 받치던 주도주가 함께 약해지고 있습니다."). 다른 문장이 나온 것은 11-10 18:23~11-11 01:53뿐이다.
   - counts는 11-11·11-12·11-13에 2/3/1로 같았다. 그사이 S&P500은 +1.31/-0.35/-0.40%, KOSPI는 +2.60/-0.61/-0.98%였고, 11-12 AI 해설은 SOXX 5거래일 +17.51%를 적었다.
   - overall은 11-09~11-15 내내 "혼조"였다.
   - 11-14(토) 10:25에는 새 거래일 없이 favorable이 2에서 1로 바뀌었다. 입력이 시각에 따라 달라지는 것으로 보인다 [추정].
4. **AI 해설 salvaged·보존** [실측]
   - `salvaged`의 뜻: 검증기가 두 번(원 답변·재시도) 막았을 때, 위반 줄을 최대 2개 지우고 나머지가 통과하면 verified로 공개한다는 표시다(`scripts/producer/market-narrative.mjs:532-542`, v60.02, 커밋 c3b65f510 11-13 00:39Z 도입).
   - 도입 뒤 시장·뉴스 커밋 73개(해설 생성 60회) 중 **16커밋(생성 15회)이 salvaged**였다. 11-13에 14회(주로 `session-wording-mismatch:market.semis`, 일부 `axis-state-contradiction:volatility`, `leadership-claim-during-break`), 11-15에 2회(d66592788 02:28, da7e4e5df 03:24 — `axis-state-contradiction:volatility`)다.
   - 같은 주에 이전 해설을 보존한(retained) 커밋은 51개다. 주된 사유는 session-wording-mismatch 10, axis-state-contradiction:volatility 계열 약 14, likelihood-qualitative 5, rate-change-not-bp 4다.
   - 정리하면 해설 생성 대략 4번 중 1번이 검증을 한 번에 통과하지 못했다.
5. **11-09(월) 갱신 주기 30분 미달, 11-11 20시 공백** [실측]
   - Worker :50 디스패치가 빠져 11-09는 하루 종일 한 시간 간격이었다(시장·뉴스 27커밋).
   - 11-11 20:20Z startup_failure로 미국 마감 직전 67분 공백이 생겼다.
6. **렌더 문구 결함이 매 평일 watchdog에 걸림** [실측]
   - 걸린 문구: "원/달러 0.0%(원화 강세)"(11-10 zero-direction), "중앙값 +0.0%"(11-13 negative-zero), AI 브리핑의 섞인 소수 자릿수(11-15 03:32 CI). v60.17(04:07Z) 이후 해소됐는지는 다음 watchdog 실행으로 확인해야 한다.
   - 11-09에는 뉴스 링크 색 대비 위반도 있었다.
7. **telegram-digest 한 주 내내 partial(채널 3개)** [실측]. `telegram-reference-window`의 runtimePolicy가 "현재 3개 채널, 5개 채…"라고 적고 있어 설계상 축소일 수 있다 [추정].
8. **운영 상태 상시 경고** [실측]: operations-status `OPERATOR_REQUIRED`, reconciliation `PARTIAL`, operations-slo-window `NOT_CERTIFIED`가 한 주 내내 바뀌지 않았다. 고정 값이라 경보로서의 정보 가치가 낮다.
9. **스크리너 검증 실패와 커버리지 저하** [실측]
   - breadth < 80%로 3회 실패했다(11-09 07:15, 11-11 01:29, 11-14 01:52).
   - AACG 행 스키마(partialSessionDropped) 위반으로 1회 실패했다(11-11 19:59).
   - 확장 스크리너 ok가 11-15에 3,853에서 3,669로 184개 줄었다.
   - SEC 확장 펀더멘털은 attempted 0인 날이 3일이고 stored가 줄고 있다(3,514→3,510).
   - 그래도 screener.json 자체는 매일 갱신됐다.
10. **시나리오 선두가 한 주 내내 같음** [실측]: scenario-state 선두 reflation이 9개 스냅샷 모두 같았고, 대안은 11-09부터 aibust, 최상위 테마는 11-09부터 healthcare leading이었다. 조건이 실제로 변하지 않았을 수 있어 멈춤이라고 단정하지 않는다 [추정].
11. **주간 산출물 지연(설계)** [실측]: stress-outcomes to=11-10(11-11 갱신), scenario-outcomes to=11-06(11-14까지, 5거래일 뒤처짐 뒤 갱신). 둘 다 7일 주기 설계다.
12. **내용 불변 또는 시각만 변경** [실측]
    - bigtech-cashflow는 8일 내내 시각만 바뀌었다.
    - sec-fiscal-history(11-09, 11-12, 11-15), treasury-auctions(11-08, 11-11, 11-15), sp500-weights(11-09, 11-14, 11-15), macro-calendar(11-08~11-11)는 시각만 바뀐 날이 있다.
    - market-snapshot-status는 성격상 늘 시각만 바뀐다.
    - 불변 파일은 표 C 하단에 있다. model-validation-status와 screener-validation-gate는 observedAt 11-04에 고정이다.
13. **sp500-weights asOf가 1거래일 뒤처짐** [실측]: 11-13 마감 스냅샷에도 asOf 11-12이고, 11-15에도 11-12다. 경계값이다.
14. **history.json 주말 행** [실측]: 11-07·08 행은 11-06 값, 11-14·15 행은 11-13 값을 그대로 담는다. 행 수가 420으로 고정이라 주말 행이 창을 차지한다. 일 단위 통계에 영향을 주는지는 확인하지 않았다 [추정].
15. **freshness 원장의 죽은 항목** [실측]: refresh-screener.json에 `kr-fundamentals.json: missing`이 한 주 내내 찍혔다. 이 파일은 의도적으로 공개하지 않는 파일이다(`scripts/ci-data-audit-contract-check.mjs:63-67`).
16. **비공개 로컬 캐시** [실측]: `public-data/sec-fundamentals.json`(82MB, generatedAt 2026-10-16)은 .gitignore 대상이라 배포되지 않는다. 사용자 영향은 없다.

---

## 라이브 사이트 대조 (2026-11-15 05:55Z, 단순 GET) [실측]

| 항목 | 라이브 | origin/main `a3c588ace` (05:25Z) | 로컬 HEAD `139972316` |
|---|---|---|---|
| version.json | v60.17, built 2026-11-15T12:43+09:00 | 같음 | 같음 |
| freshness/refresh-data.json writtenAt | 2026-11-15T05:21:31.652Z | **같음** | 03:21:37.073Z |
| data.json Last-Modified | Sun, 15 Nov 2026 05:30:40 GMT | – | – |

결론: 라이브는 origin/main 최신 데이터 커밋과 일치한다. 로컬 main은 v60.17 코드 커밋을 포함하는 origin/main의 조상이다. 다만 그 뒤 데이터 커밋 2개(`dbe28cc51` 04:24Z, `a3c588ace` 05:25Z)만큼 뒤처져 있다. 코드는 어긋나지 않았다.

## 확인하지 못한 것

- **external-pipeline 게이트의 실패 하위 항목**: 상세 JSON이 Actions artifact에만 있다. 파일 다운로드는 별도 승인이 필요해 받지 않았다.
- **동결 구간에 사용자가 실제로 본 값**: fast data plane(Worker)이 시세를 별도로 제공했는지 모른다. Worker 응답 이력은 저장소에 없다.
- **cancelled 실행(11-08·09 watchdog 109건, CI 20건)의 개별 사유**: concurrency 취소로 추정만 했다.
- **11-08 이전 baseline**: 11-07 23:26Z 스냅샷만 기준으로 썼다. 더 이른 히스토리도 있지만 이번 범위가 아니다.
- **knowledge, company-profiles, objects, atlas, masters, principles 묶음**: blob 변경 여부만 봤다. 내용 차이는 비교하지 않았다.

## 지시 문서와 코드의 어긋남

- `.github/workflows/refresh-data.yml:210-220`은 stress-outcomes·scenario-outcomes 단계를 "daily lane"이라고 부른다. 하지만 `scripts/build-stress-outcomes.mjs:2-4`는 "weekly producer … skipped while the artifact is under 7 days old"이고, 실제 갱신도 주 1회였다. 코드(주간)를 따랐다.
- 요청의 "refresh ~30 min during sessions"는 코드와 일치한다(`scripts/refresh-cadence.mjs`). 11-09에는 실제 운영이 이 설계에 못 미쳤다.
