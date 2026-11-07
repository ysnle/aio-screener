# AIO 데이터 구조 감사 — 2026-11-04 (읽기 전용)

기준: `main` v59.69 (HEAD 67b740e5), 로컬 `public-data/` 스냅샷 (data.json generatedAt 2026-11-03T12:55Z).
표기: **[확인]** = 명령·grep·코드로 직접 봄, **[추정]** = 코드 흐름·이름으로 미루어 판단함.
범위 밖: Actions 실패 원인은 actions-reliability 세션이, 테마/섹터 ETF 구성은 theme-sector 세션이 맡는다. 겹치는 발견은 §6에 짧게 적고 넘겼다.

---

## 1. 데이터 원장 (프로듀서 → 산출물 → 소비자)

주기는 워크플로 cron 기준이다. refresh-data는 :17/:47 cron에 Worker의 30분 dispatch가 더해지고, 주말 조용한 구간에는 뉴스만 도는 사이클이 1시간에 한 번 돈다(`scripts/refresh-cadence.mjs`). 크기는 원본 바이트이고 괄호 안은 gzip이다. 소비자는 `src/`, `js/`(aio-tests 제외), `index.html`, `sw.js`에서 파일명으로 grep했다 [확인].

### 1-1. refresh-data.yml (30분, 매일 07:33 UTC에 일일 레인)

| 산출물 | 원천 | 크기 | 브라우저 소비자 (대표) | 비고 |
|---|---|---|---|---|
| data.json | Yahoo chart(지수·금리·원자재·FX·ETF·대형주), FRED, CNN F&G, Cboe P/C, AAII, BLS/BEA, 뉴스 RSS, Worker AI(번역·시장 해설) | 600KB (93KB) | boot-prefetch(index.html:8), server-data*.js, aio-core/aio-data | 키별 바이트는 §2-2 |
| history.json | data.json과 시세 스냅샷에서 매일 누적 | **4.68MB (175KB)** | boot-prefetch(index.html:8), 33개 이상 모듈 | 420행. **fieldMeta가 4.37MB(93%)** [확인] |
| market-snapshot.json, market-snapshot-status.json | Yahoo Tier 0 시세 | 18KB, 0.5KB | market-snapshot-loader, sw.js | 정상 |
| macro-history.json | FRED 53개 시계열(일 27·주 4·월 19·분기 2) + long 8개 | 207KB | liquidity-growth, macro-chapters, taylor-rule 등 9곳 | **매 실행마다 53개를 전부 다시 받음** (§2-4) |
| macro-calendar.json | FRED release + 공식 캘린더 | 7KB | macro-calendar.js, aio-core | |
| telegram-digest.json / telegram-observed.json | Telegram 공개 채널 | 405KB / 456KB | digest: channel-lines.js 등 6곳 / observed: **브라우저 소비자 없음** | observed는 프로듀서 내부 상태인데 Pages로 배포됨 |
| stress-outcomes, scenario-outcomes, market-temperature | history + macro 파생 | 2KB, 28KB, 77KB | shared-artifacts.js 경유 | |
| scenario-state.json / today-verdict.json | build-scenario-state (screener + history + macro) | 212KB / 0.3KB | theme-playbook-view, market-interpretation / index.html 첫 페인트 | scenario-state 커밋 8번 중 7번은 시각만 바뀜 (§2-4) |
| market-day.json | build-market-day | 94KB | daily-loop, market-regime, news | |
| official-references.json, structural-data-research.json | refresh-web-research | 4KB, 5KB | aio-core, aio-data | |
| operations-status, operations-slo-window, reconciliation-status | 빌드 스크립트 | 19KB, 12KB, 65KB | operations-status: sw.js만 / slo-window: 브라우저 없음(빌드 입력) / reconciliation: server-data.js | |
| score-backtest-history.json | backtest-trading-score (매 실행) | 92KB | **브라우저 소비자 없음** [확인] | fetch-data.mjs:236에서 매 실행 재계산 |
| 13F/masters/* | SEC 13F (일일 레인) | 디렉터리 | 투자 대가 화면 | 대형 holdings는 Pages에서 제외 |

### 1-2. refresh-screener.yml (6시간마다 :53, 21:53 UTC 미국 마감 직후)

| 산출물 | 원천 | 크기 | 브라우저 소비자 | 비고 |
|---|---|---|---|---|
| screener.json | Yahoo 1년 일봉(유니버스 약 1,159종목) + SEC 파생 | 1.79MB (351KB) | 47개 모듈 | 테마·폭·종목의 기반 |
| screener-extended.json | 확장 유니버스 | 5.07MB (955KB) | providers/screener.js, screener-extended.js | 정해진 때에만 돎(screener-extended-due) |
| screener-extended-universe.json | Nasdaq Trader | 530KB | 스키마 상수만 참조 | 프로듀서 입력이 Pages로 배포됨 |
| sec-fundamentals.json | SEC companyfacts 원장 | **83.9MB** | 없음 (.gitignore:95, Pages 제외) | 프로듀서 전용 원장이라 정상 |
| sec-fundamentals-extended.json | SEC | **10.1MB (827KB)** | **브라우저 소비자 없음** [확인] | git에 추적되고 Pages에도 배포됨 (pages-deploy.yml:146-152에서 제외하지 않음) |
| sec-fundamentals-summary(.manifest).json, sec-fiscal-history.json | SEC 런타임 투영 | 668KB, 557KB | entity.js, fiscal-read, quarter-read | |
| earnings-calendar.json | Finnhub 무료 | 391KB | 8곳 | |
| consensus-estimates.json | 회전 배치(한 번에 240개) | 263KB | consensus-read, index-earnings, themes | |
| sp500-weights.json, us-listings.json | 공개 목록 | 40KB, 699KB | portfolio look-through / 모르는 기호일 때만 lazy import | |
| bigtech-cashflow, treasury-auctions, tw-monthly-revenue | SEC, TreasuryDirect, TWSE | 32KB, 36KB, 9KB | shared-artifacts, tw-monthly-revenue.js | |
| kr-fundamentals.json | OpenDART | **182B, 비어 있음** | company-analysis.js | `pending-operator-key` — 소유자 결정(2026-10-14)으로 키 미등록 |
| kr-investor-flows.json | BOK ECOS 802Y001 | **407B, 비어 있음** | korea-participation.js:139 | `awaiting-first-collection`. 10/20 이후 한 번도 수집되지 않음 |
| breadth-contributors.json, backtest-history, factor-backtest-longrun, candidate-archive | screener 파생 | 113KB 등 | screener.js 등 | |

### 1-3. 그 밖의 워크플로

| 워크플로 | 주기 | 산출물 | 비고 |
|---|---|---|---|
| event-briefs.yml | 20분 (:07/:27/:47) | event-briefs.json (407KB), kr-index-weights.json | 시각만 바뀐 커밋을 버리는 장치가 이미 있음(`json-same-except`, event-briefs.yml:63) — §5 R3의 선례 |
| universe-review | 매월 1일 | screener-universe.json | |
| macro-calendar-review, operations-weekly-review, knowledge-lint | 매주 | 리뷰 산출물 | |
| research-backtest | 수동 | factor/score-backtest-longrun | score-backtest-longrun은 **브라우저 소비자 없음** |
| 손으로 쓴 파일 | — | operator-note, screener-validation-gate, model-validation-status, user-research-digest | 뒤의 두 게이트는 observedAt 2026-08-13에 고정. 측정값이 아니라 선언 |

---

## 2. 판정

### 2-1. 죽은 데이터 (브라우저 소비자 없이 배포되는 것)

| 대상 | 크기 | 판정 | 근거 |
|---|---|---|---|
| sec-fundamentals-extended.json | 10.1MB | 프로듀서 입력이 Pages로 배포됨 | 런타임 grep 0건. 읽는 쪽은 scripts/producer/screener*.mjs뿐 [확인] |
| telegram-observed.json | 456KB | 프로듀서 상태가 배포됨 | fetch-telegram-digest.mjs만 읽음 [확인] |
| screener-extended-universe.json | 530KB | 프로듀서 입력이 배포됨 | src는 스키마 문자열만 참조 [확인] |
| score-backtest-history.json, score-backtest-longrun.json | 92KB, 37KB | 화면에 쓰이지 않음 | CI·스크립트만 읽음. history의 백테스트는 30분마다 다시 계산됨(fetch-data.mjs:236) [확인] |
| telegram-reference-window.json | 2KB | 쓰는 쪽도 읽는 쪽도 없음 | ci-data-lineage-audit에만 이름이 나옴 [확인] |
| data.json `providerCrossChecks`, `afterHours` | 1.7KB, 2.1KB | 브라우저 소비자 없음 | afterHours는 내러티브 프롬프트 입력 [추정] |
| data.json `quotes` (`[]`), `officialWebReferences` (`null`) | — | 빈 껍데기 | 소비자는 남아 있음 (P715 이후 시세는 클라이언트가 직접 받음) |
| history.json `seriesMode` | — | 소비자 0 | [확인] |
| aio-core.js:13327 `getFGRegime` | — | RULES와 다른 밴드, 호출자 없음 | 25–55를 중립으로 봄. thresholds.js:163은 45 미만을 공포로 봄 [확인/호출자 없음은 추정] |

### 2-2. 중복 계산 · 단일 출처 위반

| # | 값 | 계산하는 곳 | 문제 | 근거 |
|---|---|---|---|---|
| D1 | **섹터 RRG(rsRatio·rsMomentum)** | 프로듀서 `scripts/lib/rotation-history.mjs`와 브라우저 대체 계산 `src/data/providers/themes.js:113-135` | 공식은 하나(rrg.js:80)지만 **런타임 출처가 둘**이다. 브라우저는 `selectProducedRotation`이 산출물 세션 ≠ 최신 완료 세션(produced-rotation.js:11)이면 산출물을 버리고 `_priceHistory`로 다시 계산한다. 그래도 안 되면 정의의 기본값(`item?.rsRatio`)을 쓴다. 미국 마감 직후 세 번째 캡처에는 IGV·XBI·ITA·OIH·AMLP가 한 점(약 101.7/101.8, 선도)에 겹쳐 있고 "선도 28·개선 0·약화 1·후행 2"로 나온다. 같은 11/2 산출물에서는 IGV 97.1/97.0(후행), XBI 99.1/105.7(개선), OIH 98.95/103.8(개선), XLK·XLC·SMH·GDX·URA·LIT·COPX 후행이다. **화면과 산출물이 정면으로 다르다.** | 값 [확인], 캡처, providers/themes.js:133-135 |
| D2 | **미국 테마 단계표** | 프로듀서 `scenario-state.json.themes`(미국 18, 한국 28)와 브라우저 `buildThemePlaybook`(theme-playbook.js:233-) | 브라우저 표가 우선이고(theme-playbook.js:307 "live wins") 산출물은 대체로만 쓴다. 브라우저는 `group.current === false`인 그룹을 버린다. current의 조건은 basis === 기대 세션이다(group-strength.js:140). 그래서 미국 마감 뒤 screener.json이 11/2에 머물면 **미국 0개**가 된다(첫 캡처). 산출물에는 미국 18개(themeAsOf US 11/2)가 있다. | [확인] 코드+산출물, 캡처 |
| D3 | 시장 폭(% above MA) | 프로듀서 screener.mjs:331·355와 screener-breadth.mjs:35는 서로 다른 카운터다. 브라우저도 group-strength.js:125, kr-themes.js:90, korea-participation.js:71에서 각각 센다 | 카운터가 다섯 곳이다. 레거시 js/aio-pages.js:503 `calcSectorBreadth`는 같은 이름으로 '오늘 오른 비율'을 센다. 라벨 함수도 aio-core.js:13328과 breadth.js:18 두 벌이다 | [확인] |
| D4 | 테마 1M/5D 중앙값 | group-strength.js:117, kr-themes.js:85, theme-criteria.js:45, theme-playbook.js:341, ai-chain-flow.js:37 | 다섯 모듈이 각자 중앙값을 낸다 | [확인] |
| D5 | 시장 상태(레짐) | 공용 `buildMarketInterpretation`에 입력을 만드는 쪽이 둘이다. 프로듀서 market-interpretation-inputs.mjs:13에는 rotationHistory·indexEarnings·releases·breadthSp500가 빠져 있다 | AI 해설(프로듀서)과 화면 판정이 서로 다른 입력으로 같은 함수를 돈다. 둘이 어긋날 수 있다 | selectors/interpretation.js:55-71 주석 [확인] |
| D6 | 위험 합성 점수 | aio-core.js:2752 `riskScore`, aio-core.js:14688 `_aioMarketAuditRegime` | 레거시 합성 점수가 남아 있다 | [확인] 존재 / 노출 여부 [추정] |

### 2-3. 같은 지표, 화면마다 다른 기준일

| 증상 | 근거 |
|---|---|
| 같은 시각에 **테마 시나리오는 미국 0개**(버림), **세부 테마 상위는 "11/2 미국 종가 기준, 11/3 반영 전" 꼬리표를 붙여 보여 줌**, **섹터 RRG는 산출물을 버리고 클라이언트 값**을 그린다. 낡은 데이터를 다루는 방식이 화면마다 세 가지다 | 캡처 1~3, group-strength.js:140, produced-rotation.js:11 |
| 테마 시나리오 머리글은 "11/3 종가"인데 본문은 한국 데이터뿐이다(한국 11/3, 미국 11/2) | scenario-state.basis.themeAsOfByMarket [확인] |
| putCall: `status:"stale-reference"`, asOf 10-22(약 13일 전, HTTP 403)인데 `allowedUse:"decision-with-daily-delay"`가 그대로다 | data.json [확인] |
| 미국 CPI 다음 발표일은 수기값(aio-core.js:12919-12945, 10-14)이 지나서 null이 된다. 한국 CPI는 official-references가 stale/null이라 수기 2.9가 노출된다 | 보조 감사 [확인] |

### 2-4. 주기가 중요도와 맞는가

| 대상 | 현재 | 판정 | 근거 |
|---|---|---|---|
| macro-history (FRED 53개) | 30분마다 전량 요청, 하루 약 48회 → **약 2,500회/일 호출**. 207KB 커밋 | **과다.** 11/2 이후 48커밋, 표본 5개 연속이 **시각만 다름** | macro-history.mjs:150-162에 due/캐시가 없음 [확인], git diff 비교 [확인] |
| scenario-state.json | 30분마다 212KB 커밋 | **과다.** 최근 8개 중 7개가 시각만 다름 | git 비교 [확인] |
| market-temperature | 30분 | 7개 중 2개가 시각만 다름 | [확인] |
| score-backtest-history | 30분마다 재계산 | 소비자 없음. 일일 레인이면 충분 | fetch-data.mjs:236 |
| screener.json (테마·폭의 기반) | 6시간 + 21:53 UTC | **마감 직후 공백이 있음.** 미국 마감(20/21 UTC)부터 21:53 실행이 끝날 때까지 기대 세션이 산출물보다 앞서, 테마 미국 0·RRG 대체 계산이 생긴다 | 캡처, group-strength.js:140 [확인] / 공백 길이 [추정, 실행 시간 포함 1~2시간] |
| rotationHistory (data.json) | 30분, 완료 세션 + 5분 여유 | 21:17 실행이 새 세션을 잡을 때까지 브라우저가 대체 계산 | produced-rotation.js:11 |
| putCall (Cboe) | 매 실행 시도, 403 | 원천이 막힘 — §3 | |
| kr-investor-flows | 하루 1회 시도 | 10/20 이후 0건 — §3 | |

### 2-5. 바이트 분배

| 대상 | 판정 | 근거 |
|---|---|---|
| history.json fieldMeta | **첫 페인트 경로(index.html:8 prefetch)에서 4.68MB를 파싱하고 175KB를 전송한다. fieldMeta를 빼면 305KB/43KB다.** 행마다 `source`·`sourceKind`·`allowedUse`·`observedAt` 등 22개 키가 반복된다. 소비자가 실제로 읽는 것은 sessionDate·observationRelation·observedAtSource·eligible 정도다(runtime-readers.js:542-549, index-levels.js:24, leadership-verdict.js:29) | [확인] 크기, 키 목록 |
| data.json rotationHistory | 223KB로 data.json의 37%를 차지한다. 31개 ETF × trail 20점과 메타 반복 | [확인] |
| 프로듀서 전용 파일의 Pages 배포 | 약 11MB(sec-fundamentals-extended, telegram-observed, screener-extended-universe) | pages-deploy.yml:146-152 |

---

## 3. 빠진 데이터

| 화면/판단 | 현재 상태 | 무료 원천 후보 | 근거 |
|---|---|---|---|
| 한국 종목 재무 | kr-fundamentals 비어 있음(키 미등록, 소유자 결정) | OpenDART(무료 키). 결정을 다시 물을 항목 | refresh-screener.yml:89 |
| 한국 투자자별 순매수 | 10/20 이후 미수집. ECOS 802Y001은 외국인만 줌 | KRX 정보데이터시스템은 로그인이 필요하다. Naver 금융 투자자별 매매동향(코스피/코스닥 일별 개인·외국인·기관)이 대안 — kr-index-weights가 이미 Naver를 쓰는 선례 | fetch-kr-investor-flows.mjs:11,121-135 [확인]. Actions에 `BOK_API_KEY` 시크릿이 없을 가능성 [추정] — actions-reliability와 겹침 |
| 풋/콜 비율 | Cboe 403, 13일째 낡음 | Cboe CDN CSV(`cdn.cboe.com/api/global/us_indices/daily_prices/` 계열)나 Worker 경유 | data.json putCall [확인] |
| 한국 금리·CD91·국고채·PMI·GDP·PPI·실업 | DATA_SNAPSHOT에 null 자리만 있음 | BOK ECOS(721Y001 시장금리, 200Y 계열 GDP, 404Y PPI) — 이미 키가 있는 원천 | aio-core.js:13017-13022 |
| 한국 CPI | 수기 2.9 노출 | KOSIS/ECOS 901Y009 | official-references krCpi stale |
| Fed·BOK 기준금리·FOMC 다음 일정 | 수기 AIO_MANUAL_REFERENCE(aio-core.js:12919) | FRED DFEDTARU는 이미 받고 있음. FOMC 일정은 macro-history가 공식 페이지에서 12시간마다 받음 → **수기값을 지우고 기존 산출물로 대체** | macro-history.mjs:184 |
| VKOSPI | SYMBOLS에 없음 | Yahoo에 없음. Naver(`VKOSPI` 지수 페이지)나 KRX | quotes.mjs |
| MOVE, SKEW, VIX9D, VIX6M | 필드만 있고 심볼이 없음 | Yahoo `^MOVE`, `^SKEW`, `^VIX9D`, `^VIX6M` (무료, 기존 경로) | 보조 감사 [확인/일부 추정] |
| "AI 주도" 판정 | 반도체 시계열이 없어 NDX/SMH로 대신함 | history에 smh가 이미 있음. SOX(`^SOX`)를 SYMBOLS에 추가 | market-read.js:822-836, macro-crossroads.js:352 |
| 펀드 플로 | 원천 없음(텔레그램 텍스트에만 있음) | ICI 주간 MMF·주식형 플로(무료 공개 표) | |
| 시장 폭 | 스크리너 유니버스 기준(S&P 500 아님) | sp500-weights와 screener의 교집합으로 S&P 500 폭을 이미 만들 수 있음 | aio-core.js:2715-2729 |
| 스크리너 검증 게이트 | 2026-08-13 수기 선언에 고정 | backtest-history·factor-backtest-longrun에서 매주 계산 | screener-validation-gate.json |

---

## 4. 경중 표 (판단 기여 × 비용)

| 데이터 | 기여 | 비용 | 권고 |
|---|---|---|---|
| history.json | 상 | **상** (첫 페인트 4.7MB 파싱) | fieldMeta 축소 (R2) |
| data.json 시세·매크로·뉴스 | 상 | 중 | 유지. rotationHistory trail은 lazy |
| screener.json | 상 | 상 (1.8MB, 6시간) | 미국 마감 직후 한 번 더 돌리거나 브라우저 정책 통일 (R1) |
| rotationHistory | 상 (테마·포트폴리오·종목) | 중 (223KB) | 단일 출처로 만들고 클라이언트 대체 계산 제거 (R1) |
| scenario-state / today-verdict | 상 | 중 (시각만 다른 커밋 7/8) | 내용이 바뀔 때만 커밋 (R3) |
| macro-history | 중 (주로 월·주간) | **상** (약 2,500 호출/일, 48커밋) | 빈도별 due 도입 (R3) |
| event-briefs | 중 | 중 (20분) | 유지 (이미 시각만 다른 커밋을 버림) |
| telegram-digest | 중 | 중 | 유지 / observed는 배포 제외 |
| consensus·earnings·sp500 | 중 | 하 | 유지 |
| sec-fundamentals-extended | 하 (화면 없음) | 상 (10MB 배포·git) | Pages 제외, 저장 위치 재검토 (R4) |
| score-backtest-history | 하 | 중 (30분마다 계산) | 일일 레인으로 이동 (R4) |
| kr-fundamentals / kr-investor-flows | 중 (한국 화면 칸) | 0 (비어 있음) | 키 결정 또는 대체 원천. 빈 칸은 화면에서 숨김 (R6) |
| putCall | 중 (심리) | 하 | 원천 교체, stale일 때 allowedUse 낮춤 (R5) |
| 수기 게이트 2종 | 중 (스크리너 사용 한계) | 하 | 측정값으로 교체 (R9) |

---

## 5. 개편안 (우선순위 순)

**R1. 미국 마감 직후 '산출물 세션 < 기대 세션' 공백을 하나의 정책으로 처리하고, 브라우저 대체 계산을 없앤다.**
- 근거: produced-rotation.js:11, providers/themes.js:113-135, group-strength.js:140, theme-playbook.js:233-235·307, 캡처 1~3.
- 할 일: 세 화면이 같은 규칙을 쓰게 한다. 직전 완료 세션 산출물을 "11/2 종가 기준, 11/3 반영 전" 꼬리표와 함께 보여 준다. 세부 테마 상위가 이미 이렇게 한다. 클라이언트 RRG 재계산과 정의 기본값(`item?.rsRatio`) 대체를 지운다.
- 기대 효과: 미국 테마 0개, 겹친 RRG 점, 산출물과 반대인 사분면이 사라진다.
- 위험: 라이브 렌더 경로를 바꾼다(소유자에게 먼저 확인할 사항). theme-sector 세션과 파일이 겹친다(themes.js, theme-playbook-view.js).

**R2. history.json fieldMeta를 줄인다.**
- 근거: 4.37MB/4.68MB, index.html:8 prefetch.
- 할 일: 행마다 같은 값(`source`·`sourceKind`·`allowedUse`·`marketSession` 등)을 파일 머리의 필드별 사전으로 올린다. 행에는 달라지는 키(sessionDate·observationRelation·observedAtSource·eligible·heldReason)만 남긴다. 아니면 최근 N행에만 전체 meta를 남긴다.
- 기대 효과: 파싱 약 4.7MB → 0.4MB, 전송 175KB → 약 50KB, 매 30분 git 커밋 크기도 준다.
- 위험: runtime-readers.js:542-549, close-series.js:118, breadth-snapshot.js:22 등 fieldMeta를 읽는 곳을 하나의 접근자로 모아야 한다. model-check(history session 레인) 게이트가 영향을 받는다.

**R3. 시각만 바뀐 산출물은 커밋하지 않고, 느린 시계열에는 due를 둔다.**
- 근거: macro-history 연속 5커밋이 시각만 다름, scenario-state 7/8, macro-history.mjs:150-162에 due 없음. 선례는 event-briefs.yml:63 `json-same-except`.
- 할 일: refresh-data 커밋 단계에 같은 비교를 넣는다. FRED는 frequency별 최소 간격을 둔다(daily는 미국 장 마감·FRED 갱신 창에만, weekly/monthly는 release 캘린더가 지난 뒤에만).
- 기대 효과: FRED 호출이 하루 약 2,500회에서 100회 미만으로 준다 [추정]. 데이터 커밋과 Pages 재배포가 준다.
- 위험: 시각을 신선도 근거로 쓰는 게이트(ci-data-lineage-audit, operations-status)가 attemptedAt을 따로 기록하게 해야 한다(P1160 계열).

**R4. 프로듀서 전용 파일을 Pages와 런타임 비용에서 뺀다.**
- 근거: pages-deploy.yml:146-152, §2-1.
- 할 일: sec-fundamentals-extended(10MB), telegram-observed, screener-extended-universe, score-backtest-*, operations-slo-window를 배포 제외 목록에 넣는다. score-backtest-history는 30분 레인에서 일일 레인으로 옮긴다(fetch-data.mjs:236).
- 기대 효과: 배포 약 11MB 감소, 30분 실행 시간 감소.
- 위험: 낮다. ci-data-lineage-audit와 artifact-size 게이트의 목록을 함께 고쳐야 한다.

**R5. stale 원천의 사용 등급을 자동으로 낮추고, 막힌 원천을 교체한다.**
- 근거: putCall `stale-reference`인데 `decision-with-daily-delay`.
- 할 일: 프로듀서가 status≠ok일 때 allowedUse를 reference로 낮추는 공통 규칙을 둔다. Cboe는 CDN CSV나 Worker 경유로 바꾼다.
- 기대 효과: 13일 전 값이 판단에 섞이지 않는다.
- 위험: 심리 합성 점수(composite-fear-greed.js:94) 입력이 빠질 때의 표시를 확인해야 한다.

**R6. 한국 빈 산출물을 정리한다.**
- 근거: kr-fundamentals 0건(소유자 결정), kr-investor-flows 10/20 이후 0건, ECOS는 외국인만 줌.
- 할 일: (a) Actions의 `BOK_API_KEY` 시크릿 여부 확인(actions-reliability로 넘김). (b) 개인·기관까지 주는 Naver 투자자별 매매동향으로 바꾸는 안. (c) OpenDART 키 결정을 소유자에게 다시 묻기. 그때까지 빈 칸은 화면에서 숨긴다.
- 기대 효과: 한국 화면의 "수집 전" 칸이 없어지거나 채워진다.
- 위험: Naver 스크래핑은 형식 변경에 취약하다(kr-index-weights와 같은 위험).

**R7. 수기 기준값(AIO_MANUAL_REFERENCE)을 기존 산출물로 바꾼다.**
- 근거: aio-core.js:12919-12945. 이미 받는 FRED DFEDTARU, macro-history FOMC 일정(macro-history.mjs:184), macro-calendar의 CPI 일정이 있다.
- 기대 효과: 지난 CPI 일정은 null이 되고 수기 한국 CPI가 노출되는 문제가 끝난다. AI 맥락(policy-lines.js:29-31)도 같은 출처를 쓴다.
- 위험: BOK 일정과 한국 CPI는 원천을 새로 붙여야 한다(§3 ECOS).

**R8. 시장 상태 입력을 하나로 만든다.**
- 근거: market-interpretation-inputs.mjs:13과 selectors/interpretation.js:55-71. 프로듀서에는 rotationHistory·indexEarnings·releases·breadthSp500가 없다.
- 할 일: 입력 빌더 하나를 src/domain에 두고 두 쪽이 import한다.
- 기대 효과: AI 해설과 화면 판정이 어긋나지 않는다.
- 위험: 중간. market-narrative 모델 체크 게이트를 다시 돌려야 한다.

**R9. 폭과 테마 중앙값 계산을 각각 하나로 모은다.**
- 근거: D3(카운터 5곳, 라벨 2벌, 같은 이름의 다른 의미), D4(중앙값 5곳).
- 할 일: `breadthCounts(rows, field)` 하나와 `themeMedians(members)` 하나로 모은다. 레거시 `calcSectorBreadth`는 이름을 바꾸고, `getBreadthRegime`·`getFGRegime`은 지운다.
- 기대 효과: 같은 지표가 화면마다 다른 숫자를 낼 여지가 사라진다.
- 위험: 레거시 js 전역의 호출자를 확인해야 한다. 전면 재작성은 금지이므로 부분 패치로 한다.

**R10. 수기 검증 게이트를 측정값으로 바꾼다.**
- 근거: screener-validation-gate·model-validation-status가 2026-08-13에 고정. backtest-history·factor-backtest-longrun이 이미 있다.
- 할 일: research-backtest 워크플로가 게이트 상태를 계산해 쓰게 한다.
- 기대 효과: 스크리너 사용 한계가 근거를 가진다.
- 위험: 통과 기준을 소유자가 정해야 한다.

**R11. rotationHistory를 둘로 나눈다.**
- 근거: data.json의 37%(223KB).
- 할 일: 현재 좌표만 data.json에 두고, 20점 trail은 별도 파일로 떼어 테마 화면에서 lazy로 받는다.
- 기대 효과: 첫 페인트 data.json 약 −35%.
- 위험: 13개 소비자가 `_serverDataMeta.rotationHistory`를 읽는다. 접근자를 유지해야 한다.

**R12. 빠진 시장 지표를 기존 경로로 추가한다.**
- 할 일: ^SOX, ^MOVE, ^SKEW, ^VIX9D 등 Yahoo 무료 심볼을 SYMBOLS에 넣는다. "AI 주도" 판정의 NDX 대리를 SOX로 바꾼다.
- 기대 효과: 대리 지표가 직접 지표로 바뀐다.
- 위험: 30분 실행의 호출 수가 소폭 늘고 Tier 0 커버리지 게이트(CORE_QUOTE_COVERAGE)에 영향이 있다. 핵심이 아닌 심볼로 분류해야 한다.

---

## 6. 다른 세션과 겹치는 발견 (짧게)

- **actions-reliability**: kr-investor-flows가 10/20 이후 미수집인 원인(시크릿 부재 [추정]), putCall HTTP 403, 미국 마감 직후 screener 실행 지연 여부.
- **theme-sector**: R1의 화면 쪽 처리. RRG에서 겹친 점의 기본값 출처(정의의 rsRatio)를 확인할 것. 캡처 2의 "선도 20, 개선 0, 약화 0, 후행 0"도 같은 원인 [추정].
- **ui-states**: R1·R6의 빈 칸이나 "반영 전" 꼬리표는 `renderDataState`를 쓸 것(ui-states-API.md).

## 7. 확인하지 못한 것

- 라이브 사이트에서 미국 마감 뒤 공백이 실제로 얼마나 이어지는지(Actions 실행 시각 기록은 보지 않았다).
- 보조 감사(Explore 2개)가 낸 수기·대리값 줄 번호 가운데 일부는 표본만 다시 확인했다(aio-core.js:12919 블록, 13017 null 자리, putCall). 나머지는 보조 보고를 그대로 옮겼다.
- 압축 전송량은 gzip -9 기준이다. 실제 Pages는 brotli일 수 있다.
