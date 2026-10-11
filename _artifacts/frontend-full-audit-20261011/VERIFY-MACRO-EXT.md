# VERIFY-MACRO-EXT — 거시(#macro/#fxbond) · 외부 종가 대조 발견 더블체크 (코드·데이터 추적)

- 일시: 2026-10-11 · 담당: frontend-full-audit-20261011 / verify-macro-ext (double-check)
- 방법: **브라우저 없음** · 읽기 전용 코드/데이터 추적. `MACRO-OBSERVATIONS.json`, `EXT-OBSERVATIONS.json`의 발견을
  `src/`, `js/`, `scripts/`, `public-data/` 원문과 수치 재계산(Node, 스크래치패드 전용 스크립트)으로 검증.
- 수정 파일: 이 문서 1개뿐. git/서버/다른 파일 조작 없음.
- 판정 기준: **확정** = file:line + 데이터 키로 재현됨 / **부분 기각** = 핵심 주장 일부가 사실과 다름 / **data-side** = 원천 데이터 결측 건(producer 수정 방향).
- 우선순위: P1 = 표시값 오류·계약 위반(사용자 오독 직결), P2 = 표기/basis 오독, P3 = 방어·정보 보강.

## 요약 표

| 항목ID | 판정 | 근거 (file:line / 데이터 키) | 수정 방향 | 우선순위 |
|---|---|---|---|---|
| MACRO-A1 | **확정** (A 유지) | `src/domain/macro/indicators.js:160-175` — 163행 `series[series.length - 13]`(위치 −13), 174행 `'1년 전 …'` 라벨. 렌더 `src/ui/components/macro-board.js:374`(`item.trendText`). 데이터 `macro-history.json series.cpiIndexNsa/unemployment` 2025-10 결측. 재현: CPI series[-13]=2025-07 YoY 2.70%(화면 2.7%), 달력 12개월 전 2025-08=2.92%(기대 2.9%) / 실업률 series[-13]=2025-08=4.3(화면), 달력 12개월 전 2025-09=4.4(기대) | (i) 코드: trendOf를 월 매칭으로 — 이미 있는 `monthsBack`(`macro-read.js:47-51`)을 '1년 전/6개월 전' 조회에 재사용, 대상월 결측이면 계열 결측 안내 또는 실제 기준월 명시('2025.07 대비') (ii) data-side는 아래 별도 행 | **P1** |
| MACRO-A1-data | **data-side 확정** (producer 수정) | `scripts/fetch-data.mjs:3927-3932` `parseFredObservations` — FRED 결측(`.`)을 조용히 필터, `3941-3945` 원천 통과. `macro-history.json`: cpiIndex/coreCpiIndex/cpiIndexNsa/coreCpiIndexNsa/unemployment는 2025-09 다음 2025-11(2025-10 없음), 반면 pceIndex/corePceIndex/payrolls/hourlyEarnings/retailSales/housingStarts/fedFunds는 2025-10 있음 | 원천(FRED) 결측이라 값 채우기 불가. producer가 카덴스 검사로 결측월을 아티팩트 메타(예: `missingMonths`)에 표기해 소비자(화면)가 hold/라벨할 수 있게 함 | **P2** |
| MACRO-B1 | **확정** (B 유지) | '5일': `src/domain/briefing/market-read.js:487`(미 10년물 근거)·`:513`(HY 근거), `src/domain/macro/macro-read.js:279`(신용 축 headline). '1주': `src/domain/macro/rates-fx.js:94`(`fredLevel.weekText`), `macro-read.js:338,361`(체인), `:366`(범례 '신용 스프레드 1주 ±25bp'). 같은 키 `data.json macro.hyOASDelta5=-0.09`, `macro.dgs10Delta5=-0.04` | '5거래일'로 통일 — 일별 계열의 5관측 변화이며 `market-read.js:99-106`(P1428)이 이미 "세션 스킵 시 보류" 가드를 두는 등 이 창은 '일' 단위가 원칙. '1주'가 부정확한 쪽. 판정기준 문구(`macro-read.js:366`)·RULES 주석과 낱말 맞춤 | **P2** |
| MACRO-C1 | **확정** (C 유지 · 타이밍 의심 해소) | 문자열 2원천: (a) 스냅샷 경로 `js/aio-core.js:3973`(`' · 시세 '+count+'종'`, count=coverage.observed)·`:3981`('서버 '+at+suffix, title+'실시간 시세가 아닌…') (b) 라이브 경로 `src/domain/market/quote-currentness.js:36`(count=라이브 관측 수)·`:44`·`:49`(close detail '10/9 마감…', title에 '실시간 시세가 아닌' 없음) — `aio-core.js:4017`이 이를 기록. `4048-4053`(`aio:liveQuotes`/`aio:liveDataReceived` 핸들러)이 스냅샷 렌더 이후 재렌더 → **last-writer-wins**. CI 게이트 `scripts/ci-architecture-browser-check.mjs:102`는 라이브 차단 환경만 검사해 미커버 | 칩의 종수·'서버' 접두·title은 durable 커버리지(16종) 고정, 라이브 플레인 상태는 별도 슬롯. 부분 라이브 환경(라이브 시세 1~15건)에서도 게이트 단언이 깨지지 않게 라이브 경로에서 close 상태를 스냅샷 표기로 되돌리지 않음 | **P1** |
| MACRO-C2 | **부분 기각** — 값(0.00%p)은 유효, '산출 아티팩트' 주장 기각; 방어 권고 유지 | 재현(`macro-read.js:69-77 sahmGap`): lastAvg3(2026-07~09 연속 평균)=4.133, 직전 12개 창 low=4.133@2026-08(연속월 평균) → 0.000%p. 결측을 건너뛴 평균 2025-11=4.400(2025-08·09·11)·2025-12=4.433(2025-09·11·12)은 창 안에 있으나 **low가 아니어서 결과 불변**. 이전 판정 `_context/BUG-POSTMORTEM.md:940`(P1506 'Sahm 0.00%p 정상값') 오늘도 유효 | 결측월 감지 시 Sahm·3개월 평균류를 보류하는 방어(월 연속 강제)를 P3 개선으로 유지 — 현재 값엔 영향 없으나 위치 기반 롤링 평균 구조는 결측에 취약 | **P3** |
| MACRO-C4 | **확정** (C 유지) | 데이터 `macro-history.json series.termPremium10` last=`2026-10-02`=1.0847(n=269). UI `src/ui/components/macro-board.js:514`(`ageDays` 일 단위)·`:522`(`ageDays > 30 ? 'stale' : 'observed'`) — 9일 지연은 통과, `:520` meta '10/2 · FRED THREEFYTP10'에 지연 표기 없음 | 지연 칩을 시리즈 주기 기준으로: 일별 계열은 기준일 대비 k거래일 뒤처짐을 meta에 병기('10/2 · 5거래일 전') — `market-read.js:91`의 `alignmentLabel` 'lagged' 문구 패턴 재사용 가능 | **P3** |
| MACRO-C5 | **확정** (C 유지) | (a) `macro-read.js:404`(유가·달러 축 link)·`src/ui/components/macro-board.js:351`(WTI note) '에너지는 CPI의 약 7%' — 화면 출처·기준시점 없음 (b) `macro-read.js:234` '(중립 약 1%)', 근거는 주석 `:8`뿐 (c) 발표일 캘린더 `js/aio-core.js:11076-11110`(AIO_MACRO_CALENDAR v53.4 / OFFICIAL_SCHEDULES, source/sourceUrl·'verified 2026-10-10' 주석 존재) — 그러나 `indicators.js:81-90 releaseInfo()`가 `nextRelease`만 읽고 `entry.source/sourceUrl`을 화면에 안 넘김 | 정적 참조 수치 옆 기준시점·출처 병기, 캘린더 source/sourceUrl·검증일을 releaseInfo→meta로 전달(예: '9/11 발표 · 다음 10/14 · BLS 일정(10/10 검증)') | **P3** |
| EXT-btc-live | **확정** (B · basis) | `market-snapshot.json quotes[market.crypto.btc]`: value=82871.3, `session=CURRENT_SESSION`, `valueBasis=provider-current-value`, observedAt=2026-10-10T15:22:01Z, **previousValue=82546.3203125(=10/9 종가, 외부 82,546.32와 정확 일치)**. EOD 열 `history.json last.btc=82546.32`와 상호 일관 | '종가' 타일은 history EOD(=previousValue)를, 라이브 값은 '현재(지연)' 라벨로 분리 — 관측 파일 권고(레이블/렌더러 수정, 값 수정 아님) 그대로 유효 | **P2** |
| EXT-us13w | **확정** (B · basis, 범위 외 참고) | `market-snapshot.json quotes[market.rates.us13w]`: ^IRX=4.057, `venue='Cboe Indices'`, `allowedUse='reference-only'` — 레코드에 '디스카운트 기준' 명시 없음. 외부 4.16%는 Treasury bill-rate 기준 → 직접 비교 불가(0.103%p 차) | quote 레코드 또는 카드에 basis 문구 추가('^IRX: 디스카운트 기준')하거나 Treasury bill-rate(공식)로 교체 — 최소한 둘을 나란히 두지 않음 | **P3** |
| EXT-advanceDecline | **부분 기각(정밀화)** — 10/9 행에 A/D 존재, 'data-refresh 필요' 권고 기각; basis 라벨 요구는 유지 | `history.json`: **2026-10-09 행 advanceDecline=224, advanceRatio=0.639, breadth50=34.7 존재**. null은 마지막 행 2026-10-10(주말, 미국 세션 없음 — 10/3·10/4 null과 동일 패턴, 전체 420행 중 283행 non-null). UI는 `market-read.js:45-57 buildCloseSeries`(null 스킵, `through`=closeBasis 2026-10-09)로 10/9 값을 정상 인출 — `breadth-board.js:60-62,76` A/D 라인 정상 표시 | 남는 것은 basis 표기뿐: AIO A/D는 스크리너 유니버스 기준(외부 교환 전체 5,798/3,668과 비교 불가) → 카드 note에 '유니버스 기준' 명시. 주말 completed-cut 행의 A/D null은 구조상 정상 | **P3** |

## 항목별 상세 (재현 수치)

### MACRO-A1 — 확정 (화면 라벨 = A, 데이터 결측 = data-side 분리)
- **계산 방식 확정: 위치 오프셋(−13)이다.** `indicators.js:160-175 trendOf()`는 `series[series.length-13]`(163행)을 `'1년 전'`(174행)으로, `series[series.length-7]`(164행)을 '6개월 전'으로 라벨한다. 월 매칭 없음. 반면 계열 값 자체는 `macro-read.js:54-59 yoySeries`가 `monthsBack`(`:47-51`, 정확히 12개월 전 달 탐색)으로 월 매칭 — 즉 **YoY 값은 정확한데 추이 줄의 '1년 전' 조회만 위치 기반**이다.
- **결측 확인**: `macro-history.json`에서 cpiIndex·coreCpiIndex·cpiIndexNsa·coreCpiIndexNsa·unemployment 5계열 모두 `2025-09-01 → 2025-11-01`(2025-10 없음). 같은 파일의 pceIndex·corePceIndex·payrolls·hourlyEarnings·retailSales·housingStarts·fedFunds는 2025-10 존재 — PCE 카드 '1년 전 2.7%'가 정상인 이유(2025-08 대비 가능)가 정확히 설명됨.
- **재현(화면값 그대로)**: CPI YoY 계열 last=2026-08(3.40%), series[-13]=**2025-07(2.70%)** → 화면 2.7%. 달력 매칭이면 2025-08=**2.92%** → 관측 파일의 기대값 2.9%. 실업률 last=2026-09(4.2), series[-13]=**2025-08(4.3)** → 화면 4.3%. 달력 매칭이면 2025-09=**4.4**.
- **data-side 분리**: producer는 FRED 관측을 그대로 통과하고(`fetch-data.mjs:3941-3945`), 결측은 `parseFredObservations`(`:3927-3932`)에서 값이 없는 행이 조용히 사라지는 방식이다. 2025-10 CPI(가계조사 실업률 포함)는 미국 연방정부 셧다운 기간 원천 자체가 없었던 달로, 원천 결측을 producer가 왜곡 없이 반영한 것 — **값을 채우는 수정은 불가/불요**. producer 수정은 결측 가시화(카덴스 검사 → `missingMonths` 메타 등)로 한정.
- writer 체인: `indicators.js:174 trendText` → `macro-board.js:374 statCard lines`.

### MACRO-B1 — 확정 (값 동일, 창 이름 이중화)
- 근거값: `data.json macro.hyOASDelta5=-0.09`, `macro.dgs10Delta5=-0.04`(그 외 realYield10Delta5=−0.01, breakeven10Delta5=−0.03 — 모두 5영업일 delta 키).
- `#macro`: 신용 축 headline `'HY 315bp (5일 −9bp)'` = `macro-read.js:279`, 신용 축 근거 `(5일 …)` = `market-read.js:513`, 금리 축 근거 `'미 10년물 5.24% (5일 -4bp, 20일 +27bp)'` = `market-read.js:487`.
- `#fxbond`: 하이일드/실질금리/기대인플레 카드 `'1주 …'` = `rates-fx.js:94`(`fredLevel().weekText` — 같은 `*Delta5` 키 사용). 체인 노드·범례도 '1주'(`macro-read.js:338,361,366`).
- 보강: 일별 계열 5관측 변화에는 이미 세션 스킵 가드가 있다(`market-read.js:99-106`, P1428 — 스킵 시 보류). 즉 이 창의 정확한 이름은 '5거래일'이고 '1주'가 틀린 쪽. 통일 방향은 '5거래일'.

### MACRO-C1 — 확정 (두 에이전트의 상충 관찰이 모두 참인 구조)
- '시세 N종' 문자열은 두 코드 경로에서 만들어진다.
  1. **스냅샷 경로**: `aio-core.js:3956-3983 _aioRenderMarketSnapshotTopbar` — count=`meta.count||coverage.observed`(3960행, market-snapshot coverage={required:16,observed:16} → 16), `'서버 '+at+suffix`(3981행), title+'· 실시간 시세가 아닌 서버 기준 스냅샷', `data-currentness='close'` — CI 게이트(`ci-architecture-browser-check.mjs:91-104`, 102행 단언)가 검증하는 형태.
  2. **라이브 경로**: `quote-currentness.js:33-52` — count=**넘겨진 관측 배열의 타임스탬프 수**(36행), close 상태 detail `'10/9 마감 · 시세 7종'`·title `'미국 정규장 마감 · 10/9 종가 기준 (최신 관측 …)'`(49행, '실시간 시세가 아닌' 없음). `_aioRenderQuoteTopbar`(aio-core.js:4017)가 `_liveData`에서 온 7건(부분 라이브)의 관측으로 이 detail을 그대로 기록.
- **타이밍 메커니즘**: `aio-core.js:4048-4053`(`aio:liveQuotes`/`aio:liveDataReceived` → `_aioRenderQuoteTopbar()` 재렌더, v50.16 보강)가 스냅샷 렌더 이후 실행되면 라이브 경로가 **last-writer-wins로 덮어쓴다**. 같은 세션에서 16종(스냅샷 렌더 직후)과 7종(라이브 실패 반복 후)이 모두 관찰된 것은 이 이벤트 순서 차이로 완전히 설명됨 — 매크로 에이전트와 횡단 에이전트의 관찰은 상충이 아니다.
- CI가 놓치는 이유: 게이트는 외부 제공자 차단 환경(라이브 0건 → 스냅샷 경로 고정)에서만 돈다. 부분 라이브(1~15건) 환경은 미검증.

### MACRO-C2 — 부분 기각 (값 유효, P1506 판정 유지)
- `macro-read.js:69-77 sahmGap` 재현: lastAvg3 = avg(2026-07, 2026-08, 2026-09) = **4.133**(결측 무관, 연속 3개월), 직전 12개 창 low = **4.133@2026-08**(avg(2026-06~08), 연속 정상 평균) → gap = **0.000%p**. 화면값과 정확히 일치.
- 결측을 건너뛴 평균은 실제로 만들어진다: 2025-11 avg3 = avg(2025-08, 2025-09, 2025-11)=4.400, 2025-12 avg3 = avg(2025-09, 2025-11, 2025-12)=4.433. 그러나 둘 다 low(4.133)가 아니어서 **현재 0.00%p에 영향 없음** — '산출 아티팩트' 주장은 기각.
- `_context/BUG-POSTMORTEM.md:940`(P1506, 2026-10-07) 'Sahm 0.00%p는 최근 실업률 3개월 평균(4.13%)이 1년 저점이라 정상값' — 오늘 데이터로 동일하게 재확인. **'결측 안내 없음' 지적은 필수 요건이 아니라 방어 개선**(결측월이 low/last에 걸리면 값이 흔들리는 구조)으로 강등해 유지.

### MACRO-C4 — 확정
- `macro-history.json series.termPremium10`: n=269, last=`2026-10-02=1.0847`(이후 관측 없음 — 일별 계열).
- `macro-board.js:508-525`: meta=`'10/2 · FRED THREEFYTP10 (연준 이사회 모형)'`(520행), stale 판정은 `ageDays > 30`(514·522행) — 10/11 기준 9일은 'observed' 통과, 지연 칩 없음. 참고로 같은 파일의 완충 장치(`market-read.js:91 alignmentLabel` 'lagged — N거래일 전')가 이미 있어 재사용이 가능.

### MACRO-C5 — 확정
- (a) '에너지는 CPI의 약 7%' = `macro-read.js:404`(유가·달러 축 link) 및 `macro-board.js:351`(WTI 카드 note) — 정적 문자열, 화면에 관측일·출처 없음.
- (b) '(중립 약 1%)' = `macro-read.js:234`(통화정책 축 근거) — 산출 근거('3.0% nominal − 2%')는 주석 `:8`에만 존재.
- (c) 발표일 정적 캘린더 = `js/aio-core.js:11076-11110` — 항목에 `source`/`sourceUrl`과 검증일 주석('verified 2026-10-02/2026-10-10')이 있으나, `indicators.js:81-90 releaseInfo()`는 `entry.nextRelease`와 schedules 배열만 읽어 provenance가 화면에 도달하지 않는다. (관측 파일이 인용한 `macro-read.js:158,305` 행번호는 현재 파일 기준 404/234 — 문자열 자체는 동일하게 확인.)

### EXT 항목
- **btc-live 확정(B)**: `market-snapshot.json quotes[market.crypto.btc]` = 82871.3, `session=CURRENT_SESSION`, `valueBasis=provider-current-value`, observedAt=2026-10-10T15:22:01Z. **previousValue=82546.3203125** — 10/9 EOD 종가가 스냅샷에 동승되어 외부 82,546.32와 정확히 일치. 즉 값 오류가 아니라 라벨 basis 문제이며, '종가' 라벨이면 0.39% 오독. history.json last.btc=82546.32(`fieldMeta.btc.valueBasis='previous-completed-close'`)와 상호 일관 — EXT의 B 판정 확정.
- **us13w 확정(B)**: `quotes[market.rates.us13w]` = ^IRX 4.057, `venue='Cboe Indices'`, `allowedUse='reference-only'`. ^IRX는 Cboe 디스카운트 기준 지수이고 외부 4.16%는 Treasury bill-rate — basis 차(0.103%p)로 직접 비교 불가. 레코드에 basis 필드가 없어 화면이 구분할 수단이 없다는 점까지 EXT 지적대로.
- **advanceDecline 부분 기각**: `history.json`의 **2026-10-09 행 = advanceDecline 224, advanceRatio 0.639, breadth50 34.7**. null은 2026-10-10(주말) 행 — 10/3·10/4 null과 같은 주말 패턴이며 420행 중 283행이 non-null. UI는 `buildCloseSeries`(`market-read.js:45-57`, null 스킵 + `through`=closeBasis 10/9)로 10/9 값을 인출하므로 A/D 라인 카드(`breadth-board.js:76`)는 정상 표시된다. EXT의 'data-refresh 필요' 권고는 기각. 유지되는 부분: AIO A/D는 스크리너 유니버스 기준이라 외부 교환 전체 수(5,798/3,668)와 비교 불가 → 'undetermined' 판정과 basis 라벨 요구는 유효.

## 구조적 시사점
1. **월 매칭 헬퍼 공용화**: `monthsBack`(`macro-read.js:47-51`)은 yoySeries에만 쓰이고 '1년 전' 조회(`indicators.js:163`)·3개월 롤링 평균(`macro-read.js:69-71`)은 위치 기반 — 'N개월 전' 라벨과 월별 평균은 전부 같은 월 매칭 헬퍼로 통일해야 결측월에 강하다.
2. **결측 hold 원칙**: 결측월은 `parseFredObservations`(`fetch-data.mjs:3927-3932`)에서 조용히 사라져 계열이 짧아진다. producer가 카덴스 검사로 결측월을 아티팩트 메타로 표기하고, 소비자(화면)는 결측이 창에 걸리면 계산 보류 또는 실제 기준월 명시가 원칙 — 원천 결측은 채우지 않는다.
3. **라이브/EOD·durable basis 단일화**: 상태칩(#live-quote-ts)과 crypto 카드 모두 durable 커버리지(16종)/EOD(previousValue)를 1차 표기하고 라이브 플레인은 별도 슬롯으로 — `aio-core.js:4017/4048-4053`의 last-writer-wins 재렌더가 스냅샷 계약(CI 게이트 102행)을 덮어쓰는 구조가 원인.
4. **basis 필드의 원천 명시**: ^IRX(디스카운트) vs Treasury bill-rate, GC=F(선물) vs 현물, 유니버스 A/D vs 교환 전체 — quote 레코드/아티팩트에 basis 필드가 없으면 서로 다른 basis가 나란히 놓여 '불일치'로 읽힌다. 데이터 키에 basis 문구를 싣는 것이 화면별 수습보다 근본 해법.
