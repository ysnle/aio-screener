# 수동 데이터 자동화·지속 운영 구조 — 작업자 공통 지시서 (2026-10-13, v57.53)

## 소유자 요청 (2026-10-13)
"놓치는 데이터/정보가 너무 많다. 모두 구조적으로 개선하고 최대한 할 수 있는 선에서 자동화하자. 지속적인 자동 운영 시스템이 되도록."

소유자 결정:
- 한국 공식 API(ECOS·KOSIS) 키 발급은 하지 않는다. 한국 지표는 웹검색 보조 + 공식 페이지 대조로 처리한다.
- 웹검색 보조는 사람이 매일 하지 않는다. Actions에서 자동으로 돈다.

## 점검 결과 (요약)
화면 데이터 37개 항목 중 자동 20(54%), 반자동 4(11%), 수동 13(35%).

곧 낡거나 이미 낡은 수동 값:
- `js/aio-core.js:17381-17407` `AIO_MANUAL_REFERENCE`
  - bokPolicy 3.00, 다음 회의 10-22
  - krInflation 10-02 발표값
  - usCpiCalendar 다음 일정 10-14에서 끝남
- `js/aio-core.js:4149` `AIO_EVENT_FRESHNESS_REGISTRY.fomc`: "3.75-4.00%", 10-28 이후 만료
- `js/aio-core.js:10829-10862`
  - `AIO_MACRO_CALENDAR`
  - `AIO_MACRO_OFFICIAL_SCHEDULES`: FOMC는 12-09, BOK는 11-26까지만 있음
- `scripts/refresh-web-research.mjs`
  - 운영자가 찍은 스냅샷(CHECKED_AT 2026-08-21)
  - NAAIM 07-22, 한국 수출 07-13 (stale)
- 휴장일 표가 세 곳에 중복
  - `js/aio-core.js:17687-17729`
  - `src/domain/market/market-calendar.js:20-30`
  - `src/domain/briefing/schedule.js:61-62` (2026년만 있음)

이미 자동인 것:
- FRED 공표일(CPI·NFP·PCE·소매판매): `public-data/macro-calendar.json`, fetch-data.mjs `writeMacroCalendar`
- FRED 매크로 값
- AAII

## 공통 규칙 (v57.52 지시서와 동일)
- 로컬 main에서 작업한다.
- 조정자만 하는 일: 커밋·push·버전 범프·record-fix.
- 데이터 생산 스크립트(`scripts/fetch-*`, `build-*`, `refresh-*`, `sync-*`)는 로컬에서 실행하지 않는다.
  - export 함수를 fixture로 검증한다.
  - 원천 확인용 읽기 요청(curl/fetch 한두 번)은 허용한다.
- AI 호출과 워크플로 dispatch는 하지 않는다.
- 수정 방식
  - 소유 파일·구간만 정확한 문자열 Edit로 고친다. 전체 재작성, Python, node heredoc은 금지다.
  - 수정한 JS는 `node --check`를 통과해야 한다.
  - 새 단언 라벨에는 P 번호를 붙인다.
- 소유자 원칙
  - 종가 기준.
  - 근거 없는 등급·신호 금지.
  - 이모지 금지.
  - 본문에 제공자명·URL 금지(hover와 접힌 데이터 출처에만).
  - 원천이 의심스러우면 값을 만들지 말고 보류(fail-closed)한다.
  - 만료된 값을 현재처럼 보이지 않게 한다.
- 갱신 주기는 GitHub 예약 실행에 기대지 않는다(도달률 11%).
  - refresh-data는 Worker가 30분마다 dispatch한다(P1718, 라이브 확인됨).
  - 새 수집 lane은 refresh-data 안에서 "직전 확인 후 N시간 지남" 게이트로 돈다.
- 끝나면 관련 gate를 돌린다.
  - 자기 구간 단언은 고친다.
  - 공용 gate 실패는 보고만 한다.

## 산출물 스키마 (작업자 간 계약 — 이름 고정)
**W1 → `public-data/macro-calendar.json`**
- 기존 이벤트 배열에 다음을 추가한다(기존 FRED 이벤트 형태를 따름, W1이 실제 형태를 확인).
  - FOMC 회의: `source: 'fed-official'`, 회의 2일차 날짜, `sep: true|false`
  - ISM 제조업·서비스업 PMI: `source: 'ism-rule'`
    - 규칙: 제조업은 매월 첫 영업일, 서비스업은 세 번째 영업일.
    - 미국 휴장일을 반영한다.
- meta에 `fomcFetchedAt` / `fomcStatus` 를 둔다.

**W1 → `public-data/data.json`**
```
policyRates.fed = {lower, upper, asOf, source:'FRED DFEDTARL/DFEDTARU', status:'current'|'stale'}
```
- 이미 수집 중인 FRED 값에서 파생한다. 없으면 W1이 시리즈를 추가한다.

**W2 → `public-data/official-references.json`** (신규)
```
{ schemaVersion:'official-web-references.v2', checkedAt, items:{
  bokBaseRate:{ value, unit:'%', effectiveDate, nextMeeting, ... },
  krCpi:{ yoy, period, publishedAt, ... },
  krExports:{ exportsYoyPct, exportsBillionUsd, period, periodLabel, publishedAt, ... },
  naaim:{ exposure, observedAt, ... } } }
```
- 모든 항목에 공통 필드를 둔다.
  - `status: 'verified'|'stale'|'unverified'|'unavailable'`
  - `sourceUrl`
  - `verifiedQuote` (원문에서 찾은 짧은 문자열, 200자 이하)
  - `checkedAt`
  - `nextExpectedAt` (다음 공표 예정 또는 null)

## 소유 표
| 작업자 | 소유 | P 배정 |
|---|---|---|
| W1 공식 일정·금리 (키 불필요) | fetch-data.mjs의 macro-calendar 구간(`writeMacroCalendar` 주변)과 FRED 정책금리. 신규 `scripts/lib/official-calendars.mjs`(FOMC 페이지 파서, ISM 규칙). 관련 gate 단언(ci-data-pipeline-contract-check, ci-artifact-semantics-check의 해당 블록) | P1731 FOMC 일정 공식 페이지 수집(federalreserve.gov fomccalendars, 올해·내년, SEP 표시, 파싱 실패 시 직전 값 유지 + 상태). P1732 연준 정책금리를 FRED 상·하단에서 파생. P1733 ISM PMI 규칙 일정 |
| W2 웹검색 보조 자동 lane | `scripts/refresh-web-research.mjs`(운영자 스냅샷 → 자동 lane으로 재구성), 신규 `scripts/lib/web-reference-verify.mjs`, `.github/workflows/refresh-data.yml`(lane 단계 추가만), `scripts/lib/ai-shared-analysis.mjs`(웹검색 요청 함수 추가만), 관련 gate | P1734 아래 상세 |
| W3 소비처·만료·운영 감시 | `js/aio-core.js`의 `AIO_MANUAL_REFERENCE`·`AIO_EVENT_FRESHNESS_REGISTRY`·`AIO_MACRO_CALENDAR`·`AIO_MACRO_OFFICIAL_SCHEDULES`·휴장일 구간과 그 소비처. `src/domain/briefing/schedule.js`, `src/domain/market/market-calendar.js`. 데이터 로더(js/aio-data.js에서 새 산출물 로드 부분만). 신규 gate `scripts/ci-manual-reference-expiry-check.mjs`(qa-runner 등록 포함). data-watchdog 워크플로·스크립트의 만료 감시 부분 | P1735 휴장일 단일 원천 + 2027년 반영 + 세 표 일치 gate. P1736 수동 참조 만료 레지스트리(모든 남은 수동 값에 `asOf`·`nextExpectedAt`/`maxAgeDays`) → 만료 시 화면은 '기한 지남'으로 보류, watchdog가 이슈 생성. P1737 소비처를 W1·W2 산출물로 전환(산출물이 없거나 status가 verified·current가 아니면 기존 값을 기한과 함께 보여 줌) |

## P1734 상세 (W2)
**호출 경로**
- 공용 Worker `/openai`를 Actions 토큰으로 호출한다(`resolveSharedAiConfig`).
- 도구는 `web_search`, `search_context_size:'low'`, `return_token_budget:'default'`이다.
- `filters.allowed_domains`는 공식 도메인만 둔다.
  - bok.or.kr, kostat.go.kr, customs.go.kr, motie.go.kr, naaim.org, korea.kr
  - W2가 실제 공표 도메인을 확인해 확정한다.
- 출력은 `text.format` json_schema다.
- Worker 예산 계약은 `worker/openai-budget.mjs:70-92`를 따른다.

**2단계 검증**
1. 모델이 `{value, date, sourceUrl, quote}`를 돌려준다.
2. 스크립트가 sourceUrl을 직접 가져온다.
   - 허용 도메인·https인지 확인한다.
   - 본문 텍스트에 value(표기 변형 허용)와 date가 들어 있는지 확인한다.
   - 둘 다 맞을 때만 verified로 발행한다.
   - 실패하면 직전 verified 값을 유지하고 status를 stale로 둔다(원인 기록). 모델 요약값은 절대 발행하지 않는다.

**실행 주기·예산**
- refresh-data에서 항목별로 `nextExpectedAt` 이후이거나 마지막 확인 후 24시간이 지났을 때만 호출한다.
- 하루 항목당 최대 1회, 월 최대 약 150회 이내로 둔다.
- 예상 비용을 보고에 적는다.

**NAAIM**
- 공식 페이지가 최신값을 공개하지 않을 수 있다(기존 노트: 3개월 지연·구독 필요).
- 검증이 안 되면 unavailable로 두고, 화면에서 빼야 하는지 보고한다.

**마이그레이션**
- 기존 `data.json` `marketSurveys.naaim`·`officialWebReferences.krExports`의 소비처를 보고한다(W3가 전환).
- AAII는 이미 자동이므로 건드리지 않는다.

## 보고 형식 (한국어)
- 표: `항목 | 처리(완료/부분/보류) | 변경 file:line | 확인(fixture·재현·gate)`
- 다른 작업자에게 요청할 것
- 배포 후 확인할 것
- W2는 예상 월 호출 수와 비용도 함께 적는다.
