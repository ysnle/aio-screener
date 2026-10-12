# 시장·오늘·거시 작업 검토 — 1차 확정 기록

기록 시점: 2026-10-12 KST. 읽기 전용 전문 리뷰와 주 담당자의 Chrome v57.42 화면 대조를 통합했다. 제품 수정 없음. 아래 우선순위는 리뷰 분류이며 BUG ledger의 새 P 번호가 아니다.

## 결정과 전체 흐름

| 작업 | 의도와 실제 흐름 | 검토 판단 |
|---|---|---|
| 오늘·브리핑·뉴스 허브(P1371,P1380~1391,P1432) | Actions refresh → data/history/news → market-read/briefing-read/news → 요약·변화·일정·기사 | 질문 중심 동선은 타당하다. 세 route의 내용 통합과 legacy 삭제는 아직 별도 완료 기준이 필요하다. |
| 여섯 축 시장 상태(P1392,P1428) | 완료 종가+관측일이 있는 HY·금리 → collect/align → buildMarketRegime → 여러 화면 재사용 | 종합점수 제거와 공유 판정은 유지할 가치가 크다. 새 기능이 기존 alignment를 우회하는 문제가 핵심이다. |
| 시장 폭(P1395,P1416,P1633) | 조정 종가/표본 → 참여도·신고가/저가·급등락·분배일 → breadth-board와 오늘 카드 | 동일 비중·ETF 혼합·거래소 전체와 다른 모집단 표시가 좋다. 기간 간 수준 차이를 회복 방향으로 단정하는 문장은 수정이 필요하다. |
| 심리(P1396,P1586) | CNN/VIX/CBOE/FRED/AAII → 관측일 카드·종합 설명 → 자체 F&G 추가 | 기존 카드의 stale 제외는 타당하나 자체 합산은 그 정책을 재사용하지 않는다. |
| 거시(P1425~1427) | 공식 release+macro-history → 성장×근원물가 방향/수준 판정 → 전달 경로·금리/환율 | 방향과 수준을 구분한 설계가 좋다. 캐시가 새 artifact를 소비하지 않는 문제와 근원물가 라벨을 확인해야 한다. |
| 일별 연결(P1431~1432) | history·관심/보유종목 → daily-diff/page-flow → 오늘의 변화·다음 화면 | 다음 질문을 안내하는 설계는 유용하다. 전일 누락과 단위 추측이 결과를 왜곡한다. |
| 세 흐름(P1628,P1633) | 같은 여섯 축+RRG+테마 → scenarios → outlook → 오늘·시장·AI | 조건수와 확률 구분이 좋다. 보류 뒤 대표 흐름 선택은 실패한다. |
| 자동 AI 해석(P1635) | shared Worker → 기존 history context → validator → market-analysis | domain 재사용 의도와 생산 순서가 맞지 않는다. 새 요구 숫자·지시를 validator가 검사하지 않는다. |
| 레이더(P1637) | history/macro-history → 축별 percentile → 세 시점 SVG | 종합점수는 만들지 않으나 최신성·표본 기간·부분 축 계약이 빠졌다. |
| 등급별 신용(P1638) | FRED BB/B/CCC → 같은 날짜 join·bp 차감 → 신용 차트 | 계산은 타당하다. 현재 artifact에 신규 시리즈가 없어 실제 수집은 미실증이다. 상대 차이를 절대 부담 증가로 단정하면 안 된다. |
| 섹터 등락(P1641) | strict rotation artifact selector → 정렬 → 오늘 11개 ETF 막대 | 실제 Chrome에서 11행 확인. fixture의 정상 입력은 비어 있어도 PASS한다. |

## 확정·재현된 이슈

### M01 · P1 · 새 완료 세션의 AI와 화면 기준일 불일치

- 근거: `scripts/fetch-data.mjs:4144,4599,4662`. genMarketAnalysis가 기존 history를 읽고, updateHistory는 AI 생성 뒤 실행된다.
- 신규 10/9가 처음 들어오는 refresh에서 이전 history context는 10/8, 발행 후 화면은 10/9다. 실제 data를 두 history에 넣은 오프라인 실행에서 둘 다 held=false여도 기준일이 달랐다.
- HY 관측을 10/9로 주입하면 옛 context는 ahead/unknown/held, 새 context는 favorable/ready가 된다.
- AI 미설정 또는 evidence<2는 즉시 blocked fallback; 정상 AI 설정·충분한 근거일 때만 이 순서 문제가 발현한다. 실제 운영 답변 발생은 미검증이다.
- 최소 권고: 현재 cycle rows를 먼저 정규화하고 화면과 AI에 같은 인메모리 rows를 전달. 신규 세션·macro ahead·history 실패를 각각 회귀 검사.

### M02 · P1 · macro history가 탭 수명 동안 최초 값에 고정

- 근거: `src/ui/components/market-regime.js:47~55`, `src/ui/pages/market.js:333~340`, `src/ui/pages/sentiment.js:51~54`.
- `_aioMacroHistory`가 truthy이면 loader 호출 자체를 생략한다. loader TTL이 지나도 새 artifact는 요청되지 않는다. 전역 assignment는 이 최초 경로들뿐이다.
- 결과: 새 server/history와 옛 macro chart/심리 근거가 공존한다. 정적 연결 확정, 장시간 브라우저의 실제 producer 전환은 미검증.
- 권고: producer revision/만료를 확인하는 한 loader owner로 통일하고 v1→v2 refresh를 검사.

### M03 · P1 · 자체 F&G가 수개월 지난 근거를 최신 점수로 합산

- 근거: `src/domain/sentiment/composite-fear-greed.js:125~127`, `src/ui/components/sentiment-board.js:137~144`.
- component status는 개수만 보며 전체 asOf는 가장 새 component다. renderer는 숫자가 있으면 aligned를 강제한다.
- SPX는 10/9, breadth/VIX/TLT/HY/IG는 6/1로 제한한 재현에서 10/9 기준 65 탐욕(partial)이 나왔다. 5개 중 4개 입력은 6/1이었다.
- carried-forward 관측도 표본에 포함한다. 실제 입력에서 이를 빼면 component rank가 바뀌지만 최종 정수 51은 우연히 동일했다.
- 권고: component별 alignInput/admission, 실제 관측일 보존, stale/누락 시 보류. stale 조합·carried-forward 표본 테스트 필요.

### M04 · P1 · 레이더가 판정 제외된 stale 값을 오늘 값으로 표시

- 근거: `src/domain/market/regime-radar.js:40~45,69~70`, `src/ui/components/regime-radar.js:53`.
- target 이전의 마지막 값을 날짜 간격과 무관하게 선택한다. 축별 실제 날짜를 반환하지 않는다.
- VIX를 6/1까지만 남기면 기존 시장 축은 unknown/오래됨인데 레이더는 10/9 변동성 안정 76, 5·20일 변화 0이다.
- DXY/WTI 하나가 없으면 나머지만 평균해 달러·유가 축을 만든다.
- 권고: 기존 alignment와 필수 입력 admission을 재사용하고 실제 관측일을 tooltip에 전달.

### M05 · P1 · 전체 artifact가 오래됐어도 현재 대표 판정 생성

- 근거: `src/domain/briefing/market-read.js:60~63,155~160,389~394`.
- 기준일은 history의 마지막 SPX이며 최신 완료 세션과 대조하지 않는다. 6/1까지만 남겨도 available=true/여러 축 aligned/변동성 favorable이다.
- 권고: 최신 완료 세션과 producer revision admission. 주말 최신 금요일 종가를 오염으로 취급하는 단순 시간 상한은 대안이 아니다.

### M06 · P1 · AI validator가 허위 변화율·조건수·확률·직접 지시 승인

- 근거: `scripts/fetch-data.mjs:3532~3635,4150~4155,4164~4166`.
- SPX6000/VIX15 유효 근거에서 '+999% 변화, 조건99/4'와 '지금 즉시 매수하세요, 상승 확률99%' 텍스트 모두 ok=true/issues=[]로 재현했다.
- 일부 수준·한국어·세션 검사는 존재하지만 신규 변화·조건수와 금지 지시는 빠졌다. 실제 AI가 이를 출력했다는 주장이 아닌 admission 결함이다.
- 권고: typed 변화/조건수 근거와 금지 지시·확률 negative fixture. 자유 텍스트 regex만으로 의미 검증을 완료했다고 선언하지 않는다.

### M07 · P2 · 시나리오 판단 보류 뒤에도 대표 대응 문장 표시

- 근거: `src/domain/market/scenario-outlook.js:71~74`, `src/ui/components/market-regime.js:307~313`.
- credit 누락으로 held=true인데 leadId=concentration이 남아 '소수 주도 영역에 노출 없으면 기회비용' 문장을 오늘에 렌더한다.
- 권고: held이면 대표 leadId=null, 오늘에는 누락 근거·확인 링크. 세 가능성의 조건부 교육 내용은 별도 유지 가능.

### M08 · P2 · 1년 위치 설명과 실제 레이더 표본 불일치

- 근거: `src/domain/market/regime-radar.js:30~45,56`, `src/ui/components/regime-radar.js:68`.
- SPX288개에서 200일 거리 percentile 표본은 오늘89/5일전84/20일전69개, breadth202개다. 60개부터 값을 낸다.
- '지난1년252거래일'이라는 설명과 다르다. 세 시점의 비교 표본도 다르다.
- 권고: 실제 기간·개수 표시 또는 충분한 관측까지 보류(200일 준비+252 derived 관측 필요).

### M09 · P2 · partial 레이더에서 그림 전체 소실

- 근거: `src/ui/components/regime-radar.js:37~43`, domain available 조건 `:82`.
- macro-history 없이 5축 값은 있고 available=true지만 polygon은0개. 범례와 넓어졌다는 문장만 남는다.
- 권고: 유효 점/선분과 누락 상태를 표현하거나 전체 그림 보류. 각 축 누락 fixture 필요.

### M10 · P2 · 단기 참여 수준을 회복 방향으로 잘못 해석

- 근거: `src/domain/briefing/market-read.js:483~485`.
- b20>b50+10만으로 '먼저 회복'이다. b20가 최근20개 동안71.07→69.67 하락, b50=30이어도 회복 문장이 나온다.
- 권고: 수준 격차로 표현하거나 실제 같은 기간 상승 확인. 현재 artifact의 b20는 상승이므로 현 화면에서 반례가 발현한 것은 아니다.

### M11 · P2 · 지표별 전일 누락을 건너뛴 하루 변화

- 근거: `src/domain/briefing/daily-diff.js:41~42`, `src/ui/components/daily-loop.js:29~33`.
- 10/8 VIX가 없고10/7=10,10/9=15이면 '10/8→10/9 +5'로 표시되며 missing=[]다.
- 권고: 전일 정확 관측이 없으면 보류 또는 지표별 실제 비교 날짜 반환.

### M12 · P2 · 1% 이하 시장 폭의100배 단위 추측

- 근거: `src/domain/briefing/daily-diff.js:45~50`.
- percent 계약 입력0.5→0.8을 현재80%,+30%p로 변환한다. 정답은0.8%,+0.3%p다.
- 권고: producer 단위 직접 사용, magnitude 추측 제거. P1623의 다른 소비자와 일치 검사.

### M13 · P2 · 신규 섹터 fixture가 빈 배열 PASS

- 근거: `scripts/ci-scenario-guidance-fixture.mjs:95~97`.
- schema/model/benchmark/좌표/시각 없는 fixture가 strict selector에서 모두 거부돼 rows=[]/session=null인데 PASS한다.
- 권고: 정상 schema의 정확한 행 수·순서 assert, stale/누락 별도 negative case.
- renderer는6개만 있어도 '미국11개 ETF', 최강/최약을 표시한다. 일부 누락 시 확인n/11개 모집단 표시 필요. 현재 Chrome에서는 실제11개였다.

### M14 · P2 · 동일 이동평균을 역배열로 분류

- 근거: `src/domain/briefing/market-read.js:128~131`.
- 모든 종가/MA=100이면 >가 전부false여서 단기·장기 역배열. 엄격< 별도 확인 후 동일값은 평탄/혼조가 맞다.

### M15 · P2 · CCC−B 격차를 절대 차환 부담 증가로 단정

- 근거: `src/domain/market/regime-scenarios.js:50~51`.
- CCC10%고정/B4→3%이면 격차600→700bp지만 CCC 절대 부담은 증가하지 않는다.
- 권고: 상대적 위험 차별화로 표현하고 CCC/B 수준과 변화 함께 확인.

## 실제 화면에서 확인한 의미·사용성

- Chrome 로컬 v57.42/1920×945에서 signal은6128자·5472px다. 가로 넘침은0, 보이는 zero-size canvas는 없었다. 첫머리 결론은 좋아졌지만 약5.8개 viewport 길이로, 한 줄→3초 그림→근거 목표는 여전히 부분 달성이다.
- 동일 화면 '신용·위험선호 우호'와 레이더 '신용 안정9,20일−88'가 함께 나타났다. 절대 판정과 과거 상대 위치가 다른 것은 수학적 모순이 아니지만 현재 제목 '바깥일수록 우호'는 같은 판정처럼 읽히기 쉽다. 상대 위치·원자료 수준·실제 관측일을 함께 설명하는 것이 필요하다.
- radar SVG380px가 폭1645px section 왼쪽에 있고 오른쪽은 범례/접기만 있어 큰 빈 공간이 남았다. 설계 판단이며 제품 수정 제안은 미적용이다.
- breadth는 표본811개/동일 비중/주식+ETF를 실제로 안내한다. 의미 정직성의 좋은 사례다.
- macro 사분면은 '물가 둔화', 실제 기준은 근원PCE3개월 속도다. 수준/방향 차이를 설명하나 제목을 '근원 물가 속도'로 더 명시하는 것이 좋다.
- 뉴스는 기본 화면에서 영어 본문/제목이 많았다. 번역 요청 실패와 원문 fallback의 실제 동작은 별도 AI/입력 기록에 남긴다. 영어가 존재한다는 이유만으로 데이터 결함으로 분류하지 않는다.

## 유지할 판단

공유 thresholds, 관측일 정렬, 한국시장 분리, same-date 신용 join, 뉴스 원문 권리 경계, safe textContent/link, lifecycle dispose는 좋은 기반이다. 이번 핵심은 기능을 더 늘리기보다 새 renderer가 기존 freshness/admission을 재사용하도록 끝까지 연결하는 것이다.

정적/오프라인 PASS: ci-scenario-guidance-fixture, ci-regime-scenarios-fixture. 이 PASS가 위 반례를 막지 못하므로 의미 검증 완료가 아니다. 실제 AI 응답·신규 FRED 시리즈 수집·장시간 producer 전환은 미검증이다.
