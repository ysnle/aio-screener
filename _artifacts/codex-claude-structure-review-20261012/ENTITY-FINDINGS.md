# 종목·테마·스크리너·포트폴리오·리서치 검토 — 3차 기록

2026-10-12 KST. 전문 리뷰의 static/offline 반례와 주 담당자의 실제 Chrome 대표 입력을 분리해 기록한다. 제품 수정 없음.

## 작업별 의도와 경로

| 작업 | 데이터부터 화면까지 | 판단 |
|---|---|---|
|종목3뷰(P1430,P1624,P1640)|route-hubs→showTicker/normalizeTickerInput→Yahoo identity→summary hydrator→entity store→company-analysis/stock-read|issuer·통화·관측일 확인, 회사별 특례 제거, cancellation은 타당. 검색 정규화/중복 요약/갱신 경계는 미완성.|
|차트(P1397,P1420,P1626,P1634,P1639)|Yahoo OHLCV→completedBars/intervalBars→analysis/scenarios→stock-chart|일봉셋업·진행봉안내·현지시각·4시간합성·한국색·ATR/저점/EMA근거가 좋다. volume결측/평탄역배열/재진입갱신은 결함.|
|SEC재무(P1436,P1440,P1446,P1467,P1627,P1632)|Actions SEC→runtime projection→manifest/summary/fiscal-history→reconciliation→재무흐름/peer/company|동일issuer/FY우선·외국공시보존·연간/분기·평균자본ROE·금융FCF보류가 타당. 이력cache가 성공/실패모두 고정. 새 생산복구는 미실증.|
|스크리너(P1419,P1443,P1452,P1625,P1629)|artifact→calculation rows→market factor ranks→screen engine→table/read/validation|US/KR분리·완료세션·결측마지막·순위구분 타당. fingerprint변경 후 과거검증보류는 정직한 결과. 새 Actions 검증은 별도 필요.|
|테마(P1417,P1441,P1622,P1623)|curated map+스크리너→group-strength→theme/detail|중앙값·표본·전체구성원·동률 처리 타당. 그룹 간 날짜/quality가 달라 STALE도 현재순위에 들어간다.|
|포트폴리오(P1418,P1438,P1445,P1466)|Vault→FX/surface→read/attribution/checks→비중/성과|환산보류·가정수익률vs실제성과·커버리지는 타당. 결측SPY와시장혼합회전 해석이 틀린다.|
|리서치(P1462,P1479,P1636,P1642)|versioned catalog/index→capability loader→concept/industry/manager→research-shell|목차/본문/연결·운용방식/13F사각지대 좋다. 최신관측함수의소비자0·provenance·서가같은페이지칼럼동선 문제.|
|도움말/딥링크|shared ROUTE_HUBS→GUIDE_SCREEN_TEXT|8개사용자질문 안내 좋다. 19active/legacy잔여를 통합완료로 부르면 안 된다.|

## 이슈와 최소 대안

| ID·순위 | 근거·트리거·확인된 결과 | 최소 권고·검증 |
|---|---|---|
|E01·P1|`src/ai/entity/resolver.js:86~88`: 끝 경계 없는KRXregex. 0059300/005930.KSXYZ→005930.KS, 날짜20261012→202610.KS,999999도verified=true. **offline runtime**.|완전한코드/접미사·조사경계,registry확인시에만verified. malformed/날짜/미등록negative fixtures.|
|E02·P1|`src/ui/components/portfolio-read.js:63~65`: SPY ret3m=null을 Number(null)=0으로 바꿔 지수+0.0%,보유+10%는초과10%p. **renderer+DOMstub**.|null과유효숫자구분·동일종가기준. 지수결측이면비교보류; 음수/0/결측fixtures.|
|E03·P2|`src/domain/portfolio/portfolio-read.js:78~92`: AAPL10+삼성90 동일Technology를XLK Leading100%로 분류하며한국미분류라안내. **runtime**.|시장별bucket 또는KR제외,US회전coverage분모명시. 10/90혼합case.|
|E04·P2|`src/ui/components/stock-chart.js:435~437`, `src/ui/pages/analysis.js:220`: 동일symbol설치면earlyreturn. refresh/reentry/history갱신에도옛chart. **static+재호출runtime**.|symbol+revision/session/TTL갱신; 새봉/같은종목재진입/종료요청fixture.|
|E05·P2|`src/ui/components/fiscal-read.js:22~37`: undefined일때만요청,503뒤null로영구고정; 성공도새artifact불러오지않음. **runtime503→재요청1회**.|성공/실패cache분리,retry/TTL/revision.503→200,manifest변경fixture.|
|E06·P2|`src/ui/components/stock-chart.js:440~445`, `js/aio-data.js:2028~2033`:trim/uppercase만 사용.005930 raw요청. **Chrome확정**:title='005930 일봉', hub='005930',미수신;요약은005930.KS.|공통normalizeTickerInput. 미국→한국→미국,회사명/코드입력UI검사.|
|E07·P2|`src/domain/themes/group-strength.js:49~68,73~86`:그룹내날짜만확인.10/1STALE30%그룹이10/9CURRENT10%보다1위. **runtime**.|공통시장완료세션+quality/readiness 후보제한.과거참고는현재순위에서분리.|
|E08·P2|`src/domain/technical/chart-analysis.js:120,137~138,270`:volume null→0.최근10봉중9누락이면'10일평균12% 거래감소'. **runtime**.|결측유지·창별coverage만족시평균/돌파. volume-by-price결측계약과통일.|
|E09·P2|`src/ui/components/stock-chart.js:309~313`:!greater가down.250개동일100→단기/장기역배열. **runtime**,M14공유종류.|역배열은엄격<,같음은평탄/혼조. 동률/정/역교차fixture.|
|E10·P2|`src/domain/entity/stock-read.js:83~86`:MA보다100%위면'50일선까지100%하락'.정답50%. **runtime**.|pct/(100+pct)×100.20%확장→16.67%하락,100→50검증.|
|E11·P2|`src/domain/entity/stock-read.js`의시장환경분기:시장폭부담+50/200일선위만으로'지수받치는쪽'.구성/당일기여없음. **runtime+Chrome AAPL문구**.|추세유지까지만설명.지수기여는구성·동일세션가중기여근거있을때만.|
|E12·P2|`src/ui/pages/principles.js:580~582,600~604`, `atlas.js:703~706`:currentObservations로드후renderer전달없음;block정의/import만,caller0. **static**.|현concept/industry DOM에실제연결+refresh재렌더;fixture함수PASS를화면PASS로보지않기.|
|E13·P2|`src/ui/knowledge/current-observations.js:83,90~93`:Fed3.875%/9·16으로교체하면서6·17공시URL/sourceId유지. **runtime**,E12때문에현재잠재경로.|값/날짜/source/URL모두같은lineage로교체.|
|E14·P2|`principles.js:585~591`, `research-shell.js:136~139,285`:같은페이지서가칼럼/story클릭이onLocal→selectLocal의story분기없음으로그대로재렌더. **static**,Chrome후속확인.|story/chapter/capability처리;동일페이지와타페이지같은문서click동일결과.|

## P1640 통합의 잔여 UX 문제

`entity.js:688~693`에서company-analysis와stock-read를함께렌더한다. Chrome AAPL에서회사요약은3개월211/806,+6.2%,아래이종목의지금은균형팩터239/806와1·3·6개월수익률,레거시팩터레이더48/53/76/51이모두존재했다. 수익률순위와팩터순위는서로다른정당한지표지만,통합의도인반복축소는부분달성이다. 대표요약1개/차트/접힌정의로정리할제안이며삭제는미적용.

## 실제 대표 입력 기록

Chrome localv57.42에서순차입력:

|입력|표시신원|artifact결과|
|---|---|---|
|AAPL|Apple Inc.|3개월+6.2%,수익률211/806,팩터239/806;연간2025·09·27매출416.161B/순이익112.010B,순이익률26.9%,평균자본ROE171.4%|
|NVDA|NVIDIA Corporation|3개월+12.8%,135/806;매출+65.5%,순이익률55.6%,ROE101.5%|
|삼성전자|005930.KS|3개월−17.6%,140/179;한국재무에SEC를대입하지않고자료없음|
|005930|삼성전자005930.KS|회사명입력과같은결과|
|247540|에코프로비엠247540.KQ|3개월+5.8%,57/179;한국공시없음안내|
|GOOG|GOOG/Alphabet Class C|3개월−0.7%,349/806;GOOGL로재작성하지않음|
|0059300|0059300/시장미확인|요약에서는삼성으로잘라읽지않음;AIresolver와정책차이|
|999999|999999.KS|자료없음;이전기업재무를승격하지않음.미등록한국시장추정표시는WARN|
|애플리케이션|이전999999.KS유지|Apple로오인하지않음;실패안내의지속성/입력-결과불일치사용성추가점검|

현재가/가격history는제공처실패로많이미수신이었다. 위수치들은localpublished스크리너/SECartifact이지livequote검증이아니다. 합성시세브라우저gate를별도로실행하고실제시세와구분한다.

정상offlinefixture10개PASS: company-analysis/entity-summary/fiscal-quality/chart-scenarios/screener-market/research-flow/principles/atlas/masters/knowledge-renderer. 반례는그PASS가잡지못한경계다.394편자료전편의투자서술·답변을각각인증한것은아니다.
