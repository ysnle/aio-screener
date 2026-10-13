# 스크리너 데이터 품질·원천·커버리지 보강 — 작업자 공통 지시서 (2026-10-13, v57.51)

소유자 요청: "스크리너에서 가져오는 모든 정보/데이터/소식들의 퀄리티와 품질, 정확성, 최신성, 정합성 … 원천/출처까지 모두 확인 … 다양성/커버리지 범위까지 모두 세밀하게 확인해서 보강".

점검 원본은 읽기 전용 점검자 3명이 냈다.
- 필드 원천·정확성 F01–F23. 증거는 scratchpad `sa\`.
- 커버리지 V01–V24. 증거는 `sc\`, 공식 구성 목록 원자료는 `sc\dl\`.
- 소식 N01–N24. 증거는 `sn\`.

scratchpad 경로: `C:\Users\zmfhd\AppData\Local\Temp\claude\C--Projects-AIO\6dabf95e-eaf2-4f68-b9fd-fc8e999848d1\scratchpad\`

## 공통 규칙
- 로컬 main에서 작업한다. 다음은 모두 금지다(조정자가 한다): 커밋, 푸시, 버전 범프, record-fix, generate-workspace-state.
- 데이터 생산 스크립트(`scripts/fetch-*`, `build-*`, `refresh-*`, `sync-*`)를 **실행하지 않는다**. 코드 수정은 허용한다.
  - 검증은 함수 단위로 한다: export한 함수를 node로 import해 fixture나 캡처한 원천 응답으로 확인한다.
  - 외부 원천 응답 확인은 WebFetch나 node fetch 단발 조회로 허용한다. 대량 반복 호출은 금지다.
- 소유 파일·구간만 수정한다. `scripts/fetch-data.mjs`는 구간별로 나눠 소유한다(아래 표).
  - 남의 구간은 Edit하지 말고 보고서에 "요청"으로 적는다.
  - Edit은 정확한 문자열 치환만 쓴다. 파일 전체 재작성, Python 재작성, node heredoc은 금지다(백슬래시 손실 사고 P1692).
  - 수정한 JS는 `node --check`를 통과해야 한다.
- 소유자 원칙:
  - 티커를 추정하지 않는다. 공식 구성 목록에 있는 티커만 쓴다.
  - 종가 기준.
  - 원천 없는 필드·근거 없는 등급은 퇴역시킨다.
  - 본문에 제공자명·URL을 쓰지 않는다. hover와 접힌 데이터 출처에만 둔다.
  - 이모지 금지.
  - 뉴스는 큐레이션 방식이다. 원천을 무작정 늘리지 않는다.
  - CFTC·KRX 수급은 퇴역됐다.
- 원천이 막히거나 의심스러우면 **값을 만들지 말고** 보류 표시를 한다(fail-closed).
- 끝나면 관련 gate를 돌린다(`node scripts/qa-runner.mjs --list`로 찾는다).
  - 의도된 변경으로 깨지는 단언이 자기 파일·구간만 다루면 고치고 보고한다.
  - 공용 gate가 깨지면 보고만 한다.

## 조정자 결정
- **F09 가격 열:** 지금 구조를 유지한다(산출물에는 종가 원시가가 없고 실시간 시세만 쓴다). pePrice·pbPrice는 산식 근거로 남긴다.
- **N14 KST 08:00 뉴스 마감:** 소유자 정책이므로 바꾸지 않는다. 제안만 보고한다.
- **F12·N20 DART:** 키가 없으므로 코드 경로만 점검한다. 공시 목록 경로 신설은 이번 범위가 아니다.
- **유니버스 확장(V01·V05·V06·V14·V18·V10):** 1~3단계는 진행한다.
  - 정합 + 신규 5종목.
  - KQ150 상위 40 + K200 상위 20.
  - IJH 섹터별 상위 약 90종목.
  - 테마 보강(FORM, COHU, KLIC, APPN, PEGA, PRCT, GMED).
  - 4단계 Russell 2000 표본 150은 하지 않는다. 2,000종목 중 150은 대표 표본이 아니고 유동성 꼬리만 늘린다. 근거와 함께 보고서에만 남긴다.
- **시장 폭:** 지금 구간은 'AIO 관찰 목록'으로 두고, 'S&P 500 구성 종목' 구간을 추가한다(V16).
- **섹터:** S&P 500 구성 종목은 sp500-weights의 GICS 섹터를 정본으로 한다(F14·V11). 테마는 편집 분류로 유지한다.

## `scripts/fetch-data.mjs` 구간 소유와 파일 소유
| 작업자 | 소유 |
|---|---|
| D1 가격·시장·breadth | fetch-data.mjs의 Yahoo 일봉·스크리너 행 구간(약 :1700-1800 chart 수신, :2200-2240 assetType·_yhSym, :2290-2380 파생, :3050-3250 행 생성·세션·통화, :3370-3430, :3980-4070 breadth·segment). src/data/providers/screener.js의 통화·거래대금 부분(:330-450). src/domain/market/session-time.js. .github/workflows/refresh-screener.yml(cron). |
| D2 SEC 재무 | scripts/fetch-sec-fundamentals.mjs 전체. fetch-data.mjs SEC 병합 구간(약 :2880-2965). src/data/providers/screener.js의 재무·시총 부분(:40-80, :460-500). src/data/contracts/screener.js(F11 퇴역). src/domain/screener/factor-ranks.js(:100-115 밸류 공식). src/domain/entity/stock-read.js와 src/ui/components/stock-read.js는 재무 표기만. |
| D3 뉴스·소식 | fetch-data.mjs 뉴스 구간(약 :1290-1700 시장 뉴스·메모 수집, :3285-3320 _enrichTickerNews). src/domain/news/**. scripts/lib/telegram-tickers.mjs. scripts/fetch-telegram-digest.mjs. scripts/fetch-earnings-calendar.mjs. src/ui/pages/screener.js(:300-310 haystack, :530-540 근거 셀만). js/aio-data.js의 :16500-16700 AI 프롬프트 구간만. |
| D4 유니버스 | js/aio-data.js의 SCREENER_DB 구간(:1~:1700)과 SCR_KEYWORD_ALIASES만. js/aio-kr-data.js(이름·KR 테마). js/aio-pages.js THEME_MAP(:940-1115). public-data/screener-universe.json(미러 — 갱신 방법은 아래). src/domain/screener/screener-read.js·stock-read.js·aio-pages.js:32의 섹터 키 정규화(V13). scripts/ci-architecture-contract-check.mjs의 1000행 성능 fixture(:700-720). |

## 보고 형식 (한국어)
- 표: `항목ID | 처리(완료/부분/보류) | 변경 file:line | 확인(node 재현·원천 대조·gate)`.
- 다른 작업자 구간 요청.
- 다음 생산 실행 뒤 확인할 것(배포 후 체크리스트).
