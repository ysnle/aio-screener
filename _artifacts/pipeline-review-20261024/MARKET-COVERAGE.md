# 시장·거시·뉴스 보조 파이프라인 2차 소스 추적

작성: 2026-10-24. 읽기 전용 감사이며 이 파일만 기록한다. producer 실행, 네트워크 요청, 소스·데이터 변경 없음. 공유 작업 트리가 조사 중 v58.74→v58.75 변경을 받고 있어 아래 line은 읽은 시점 좌표다. 정적 연결 확인과 순수 fixture를 구별하며 브라우저/배포는 미검증이다. **전체 codebase 전수 검사는 아직 완료하지 않았다.**

## 추적한 정상 경로

| ID | 진입→입력·시간·단위→변환→출력 | 소비자 | 실패·재시도·멱등 | 확인 좌표 / 검증 계약 |
|---|---|---|---|---|
| M01 | refresh-data workflow→fetch-data main→이전 data.json 및 13 source plane→macro merge, quote verify, snapshot/history/narrative→data.json | legacy data adapter, snapshot, AI | allSettled 독립 fallback; quote 50% 미만 main 중단; public quotes=[] readback; artifact 단위 atomic write이나 여러 artifact의 로컬 트랜잭션은 아님 | scripts/fetch-data.mjs:54,124,133,153,196,282; scripts/producer/source-planes.mjs:46,96; ci-data-pipeline-contract-check |
| M02 | Yahoo chart 5d meta/일봉→거래소-local previous session 및 일간 %→검증 quote→market-snapshot | history, market analysis, snapshot clients | query1/query2 각 2회; 이상 폭 재조회; 일치한 큰 변동 보존; ETF TwelveData fallback; T3/reference 권한 | scripts/producer/quotes.mjs:52,59,282,305,422; snapshot gate |
| M03 | Yahoo FX hourly→마지막 완료 23:00Z cut 이전 4시간의 마지막 종가→previous close·session date | history USDKRW, FX cross-check | hourly 실패 시 daily path; 휴일 보정은 요일 기반; 60m close를 관측으로 기록 | quotes.mjs:175,244; history.mjs:359,588 |
| M04 | FRED configured series→최근14 관측→level/scale, MoM%, MoM difference, 정확히 12개월 comparator YoY 및 delta | macro-read, narrative, policyRates | JSON retry 및 추가 3초 retry; series별 실패; comparator gap 별도; LKG 보존 | fred.mjs:10,141; macro-sources.mjs:18,440; macro-merge.mjs:20 |
| M05 | BLS 8 series, BEA release HTML, Treasury 당월·전월 XML, HY OAS CSV→dated values→FRED canonical 승격 | data.macro, macro UI, AI | BLS12h+release bypass, Treasury12h, HY12h; BEA 매 실행; 실패 LKG; 승격 date 비교(기존 DATA-01/02 잔존) | macro-sources.mjs:84,282,333,531,565,693,799; macro-merge.mjs:12,20 |
| M06 | CNN F&G graph, Cboe ratio/date, AAII public table/direct→relay→설문·sentiment→data.json | sentiment, history, receipts | CNN LKG; Cboe stale-reference LKG(v58.74); AAII6h cache+direct/relay timeout; 수치·observedAt와 fetch시간 분리 | macro-sources.mjs:369,408,593,859,892; source-planes.mjs:67 |
| M07 | data quotes + snapshot session→completed close 선택→UTC-day upsert+session owner 정리→history.json(420행) | briefing market-read, regime/scenarios, backtest | core SPX/VIX 없음 skip; 60개 미만/결측 recent US/backfill flag 시 1y 백필; null daily US는 hourly approximate; 반복 session carried-forward | history.mjs:77,97,118,185,250,306,359,531; artifact semantics/history lineage gates |
| M08 | KR portal daily + Yahoo factor rows→KRX-only-through 2026-09-13 빈 날짜 보충 | screener factor rows | 기존 Yahoo close는 유지; >15% basis mismatch 거절; 인접 adj/raw ratio 합치면 fill; 최초실패8회 circuit | kr-exchange.mjs:24,30,49,142; price factor gates |
| M09 | FRED raw history(일·주·월·분기) 및 1990년 이후 monthly long series→macro-history.json | macro-read/rates-fx/liquidity-growth/long-history/Taylor | short series >=3; long >=120; long20h cache; field별 stale LKG; raw unit 그대로 보존 | macro-history.mjs:15,91,101,139; consumers 상세 수식은 아래 미검증 참조 |
| M10 | FRED release dates + Fed HTML + ISM business-day rule→macro-calendar.json→runtime schedule | macro, briefing, macro-crossroads | FRED 실패 해당 schedule 보존; FOMC8회·SEP4회 검증+12h 재확인; runtime FRED union, FOMC year replace(정상일 때), ISM month replace | macro-history.mjs:182; official-calendars.mjs:43,95,114,185,209; src/data/macro-calendar.js:16,34,64; ci-macro-calendar-review-contract-check |
| M11 | Google RSS 11 + 연합 RSS→08:00 KST 완료24h selection, 한국5 slot·source/topic cap→news40 및 intraday·6h slotPool | home/news/AI/timeline | 피드 retry2, 2d→7d 검색 확대해도 canonical window 고정; same-cycle carry; 제목/사건 dedupe; feed health 누적 | news-selection.mjs:57,77,218,425,445,638; news contracts |
| M12 | headline title→previous translation 재사용→Workers AI→shared OpenAI→titleKo | 뉴스와 timeline | 최대30; 이름/금액/일부 시장용어 fidelity gate; free 80% 미만이면 전체 shared fallback; 날짜·원문 유지 | market-narrative.mjs:231,266,275; AI shared quota는 별도 담당 |
| M13 | snapshot metric evidence+history+news+interpretation+Telegram narrative context→AI 7–9줄→semantic validate→marketAnalysis | 오늘·AI context | evidence<2 blocked; unchanged signature reuse; blockedAttemptKey 재호출 차단; validate 실패 1회 재요청; 검증된 이전 분석 제한적 보존 | market-narrative.mjs:329,350,453,503; market-analysis-validate 연결은 부분 확인 |
| M14 | Telegram4 channel 공개 mirror,14d,기존 cursor→태그·ticker role·signals·score/dedupe→telegram-digest / observed / atlas count | atlas, channel-data, narrative context | 채널15초, page cap50; known/old cursor 종료; 전체실패 old generatedAt 보존; partial 합침; summary120자만 공개 | fetch-telegram-digest.mjs:10,115,346,396,453,510,682,700; Telegram contract |
| M15 | Yahoo1990+ SPX/VIX→date join→VIX band별21/63 session forward return→stress-outcomes | stress-outcomes UI | 주7일 cache,5000행 floor,실패 unchanged exit0; 통계 daily overlapping과 cluster count 구분 | build-stress-outcomes.mjs:17,38; domain/signal/stress-outcomes.js:60 |
| M16 | Yahoo SPX/TNX/VIX/WTI/DXY+ETF/RSP→market analog 및 relative theme stage→scenario-outcomes | macro-crossroads/theme-playbook | 주7일 cache; horizon별 비중복 sample; proxy가격수익률(배당제외); missing ETF skip | build-scenario-outcomes.mjs:26,45,68; domain/scenarios/analogs.js:25,121,157 |
| M17 | 현 data/history/macro/calendar/screener/theme/outcomes→공유 interpretation→state transition·release outcomes·theme daily snapshot | macro/테마/company/screener, narrative | previous pending 제외; release period로 중복 방지; transitions60/event24/theme120 cap; 실패 unchanged exit0 | build-scenario-state.mjs:34,49,98,109,144 |
| M18 | Yahoo5 지수1990+ 및 KR portal150d→completed sessions→5 component trailing rank/3개 extreme→market-temperature | sentiment temperature UI | 4h cache; >=504 rows; market별 LKG retained; 전부 실패 unchanged; gap 날짜 기록 | build-market-temperature.mjs:26,69,79; domain/sentiment/market-temperature.js:38,70,103 |
| M19 | previous official-reference artifact+비공개 ledger→refreshOfficialReferences→validation→official-references.json | official reference selector/UI/AI | ledger 먼저 지속; artifact 계약 오류면 write 거절 exit1; unchanged면 write 생략 | refresh-web-research.mjs:20; web-reference-verify 심층 추적 진행 중 |

## 읽기 범위 (진행 기록)

전체 실행문 읽음(큰 comment는 일부 생략): scripts/fetch-data.mjs; scripts/producer/{quotes,fred,history,kr-exchange,macro-history,macro-merge,market-narrative,receipts,run-meta,source-planes}.mjs; scripts/lib/{producer-http,producer-math,producer-source,macro-sources,news-selection,official-calendars}.mjs; scripts/{build-stress-outcomes,build-scenario-outcomes,build-scenario-state,build-market-temperature,refresh-web-research,fetch-telegram-digest}.mjs; src/domain/{signal/stress-outcomes,sentiment/market-temperature,scenarios/analogs}.js; src/data/macro-calendar.js.

부분/연결 위치만: .github/workflows/refresh-data.yml; architecture/qa-pipeline.json; src/data/shared-artifacts.js; src/app/bootstrap.js; src/domain/macro/*; src/ui/components/{macro-crossroads,market-temperature,stress-outcomes}; market-analysis-validate; narrative-context; market-interpretation-inputs. 전수 미확인: Telegram helpers, web-reference-verify, market-timeline, 모든 macro/scenario consumer 수식과 runtime UI, release calendar review producer. 이후 읽은 항목을 갱신한다.

## 기존 결함 현재성

- DATA-01: macro-merge promote는 CPI/PCE value/date/source만 바꾸고 Delta를 보존한다. 현재 소스에서도 잔존.
- DATA-02: mergeMacroLastKnownGood spread/currentValue 유효성만 확인하고 previous observation date와 비교하지 않는다. 현재 소스에서도 잔존.
- Cboe stale LKG fresh receipt 판정: 부모 에이전트가 재현 완료, 중복 finding으로 추가하지 않음.
- 온도 보조 lane 결함은 기존 보고와 소비자까지 대조 중이며 해결/미해결을 아직 판정하지 않는다.
