> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# Legacy data 책임·구조 감사 — 진행 중

고정 검토 REF: `df6f0b33abd1c15c268d818efcbfc3c5547ed9b0` / v58.20. 2026-10-20 이어 읽는 동안 checkout이 `143f4c6e2b954754f6df1bad7b5d07bcd54d2955` / v58.50으로 달라졌음을 확인했다. 부모 지시에 따라 이후 원문은 `git show <고정 REF>:<path>`로 읽는다. 최신 파일은 다른 SHA이므로 기존 FULL을 최신 FULL로 재사용하지 않는다. 현재 전문 완료: aio-pages.js, aio-kr-data.js. aio-data.js는 TSV 경계부터 계속 읽는 중이다.

## LD-01 [PRE-EXISTING][warning] KR 시세 미수신 상세가 0% 및 하락 우세 판단으로 바뀜

- 고정 위치: `js/aio-kr-data.js:379`, `:400–421`, `:455–481`.
- Trigger: 한국 테마 장중 섹션에서 시세를 받지 못한 카드의 상세를 연다. 카드 목록은 커버리지 검사를 통해 시세 미수신으로 표시하지만 클릭은 허용된다.
- Failure: 상세의 `avg=ws>0?vs/ws:0`이 결측을 +0.00%로 표시하고, `_buildKrThemeDeepAnalysis`는 보합과 건강도 취약을 함께 서술한다. 상승/하락 모두 0인데 “하락 종목(0개)이 상승 종목(0개)보다 많습니다”라고 말한다. 카드에서 적용한 결측/커버리지 계약이 상세 경계에서 사라진다.
- 도달성: 고정 `index.html:5029–5090` 한국 시장/장중 보기 접기 → `renderKrThemeCardsFromMap` 카드 click/keyboard → `showKrThemeDetail`. native `kr-themes-artifact-read`는 별도 section이며 이 장중 상세 DOM을 대체하지 않는다.
- 실행 증거: 고정 소스 전체를 Node VM에 로드(이벤트·DOM만 무네트워크 stub), `_liveData={}`에서 `showKrThemeDetail('defense')` 호출 후 위 +0.00% 및 0>0 문구를 assert했다. 출력: `FROZEN REPRO: no quotes -> +0.00%; 0 decliners said greater than 0 advancers`. 실제 브라우저 증거는 아님.
- 최소 대안: 카드와 같은 커버리지 판정을 상세에도 넘겨 결측이면 수익률·상승비율·진단을 보류하고 구성종목만 표시한다.
- 최신 한계: 143f4c6e 현재 소스 VM에서도 같은 분기는 재현했다. 최신 UI 도달성은 원문 검색으로만 확인했으며 최신 전문/실브라우저 완료가 아니다.

## LD-02 [PRE-EXISTING][warning] KST 오전 실적 캘린더가 날짜 열을 하루 뒤로 배치함

- 고정 위치: `js/aio-pages.js:305–311`, `:353–367`.
- Trigger: Asia/Seoul에서 자정~08:59에 실적 캘린더를 연다. 예: 2026-10-19 월요일 08:00 KST.
- Failure: monday는 로컬 `getDay()`와 현재 시각으로 만들지만 비교용 `ymd`는 `toISOString().slice(0,10)`을 사용한다. 열 제목은 로컬 `getDay/getDate`라 월19 열은 UTC 일18 일정을 조회하고 화20 열에 월19 실적을 넣는다. 같은 주 금요일 일정은 5열 창에서 빠질 수 있다.
- 도달성: `index.html`의 실제 `earnings-calendar-body` → fundamental 진입 초기화/주 이동 → `loadEarningsCalendar` → `_fetchEarningsCalendarSnapshot` → `_renderEarningsCalendarWeekly`. native SEC 카드는 별도 소유이고 이 legacy 캘린더를 대신하지 않는다.
- 실행 증거: 고정 renderer 본문을 VM에 로드하고 TZ=Asia/Seoul 및 Date를 월19 08:00으로 고정, date=2026-10-19/BMO 한 건을 전달했다. 월19 열에는 없고 화20 열에 있음을 assert. 출력: `FROZEN REPRO: KST08 Monday19 earnings displayed under Tuesday20`. 브라우저 재현은 아님.
- 최소 대안: 날짜 없는 시각을 그대로 carry하지 않고 날짜-only/UTC 또는 로컬 날짜 형식을 하나로 통일한다. 주 계산·비교·제목이 같은 달력 날짜를 써야 한다.
- 최신 한계: 143f4c6e에서도 날짜 계산 분기는 동일하다. CSS class 변경 때문에 초기 fixture의 분할 문자열이 실패한 것은 test harness 불일치였으며 제품 추가 결함으로 세지 않았다.

## 진행 중 후보 — finding으로 확정하지 않음

KR 테마 heat/sector 필터는 card의 style.display만 바꾸는데 liveQuotes → initKoreaThemes → container.innerHTML 재생성 경로가 스타일을 초기화한다. 현재 필터 tab의 active/aria-pressed는 유지되어 결과와 어긋날 가능성이 있다. 실제 필터 상태/DOM 재현이 끝나기 전까지 UNPROVEN으로 남긴다.

## 경계 기록

`aio-pages.js`는 native fenced portfolio donut/RRG/sector bars와 실제 살아 있는 legacy 실적 캘린더·세분화 테마·가격 이력 수집을 함께 가진다. 단순 함수 존재만으로 fenced fallback의 금융 오표시를 finding으로 만들지 않았다. `aio-kr-data.js`의 macro/technical 설명은 `_aioKrDevSectionsVisible()`로 dev mode만 진입하고, KR 테마 장중 section은 일반 사용자 접기 안에 남아 있다. SEC frame cache return-shape 차이는 실제 product caller를 아직 입증하지 못해 finding으로 올리지 않았다.

제품 코드·데이터 수정/producer/외부 API/commit/push/deploy 없음. 보고/receipt만 이 폴더에 작성했다. `legacy-data-reading.tsv`의 hash는 고정 REF의 읽기 원문이고 최신 checkout hash와 일치하지 않는다.


### 2026-10-20 추가 진행
고정 df6f0b33 원문 aio-data.js UTF16 [0,384000)까지 읽음. scheduler, route refresh, chat freshness, server/native metadata projection, history/news cache 경계를 읽었으며 추가 확정 finding은 아직 없음. LD-01 최신 도달성: 주 담당자가 v58.50 실제 브라우저에서 한국 테마 → 장중 실시간 → K-방산/항공우주 시세 미수신 카드를 눌러 +0.00%, 상승비율0%, 하락0개가 상승0개보다 많다는 건강도취약 문구를 확인함. 증거: 최신 20261020 감사 폴더 browser-desktop-korea-missing-detail.aria.txt/.png 및 browser-events.json. 이는 주 담당자 제공 브라우저 증거이고 본 리뷰어의 실행 증거는 고정 SHA VM 재현임.
