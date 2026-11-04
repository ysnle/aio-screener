# 데이터 커밋 CI의 라이브 데이터 단언 — 2026-11-04 (I8, v59.70 후보)

refresh 출처(데이터만 바뀐 봇 커밋) CI는 core·data·knowledge를 돈다. 이 세 그룹의 104 게이트 중 실행 중에 `public-data/*.json`을 읽는 게이트를 정적 스캔으로 찾았다(readFileSync·readJson·URL로 읽는 경로). 28개가 잡혔다. 일부 data 게이트(data-lineage, data-refresh)는 다른 방식으로 읽어서 스캔에 안 잡혔고, 아래 원장에 따로 넣었다.

## 1. 7일 원장 (ci.yml workflow_dispatch 실패 35회, 게이트 실패 49건, 10-28~11-04) [확인: gh run list/view]

| 게이트 | 건수 | 원인 | 처리 |
|---|---|---|---|
| esm-core | 10 | 뉴스 감사가 벽시계로 행 나이를 계산함 (10-29·10-30 21~23Z) | 고정 시계 — v59.48에 이미 수정 |
| runtime | 9 | LIVE3-03 20SMA breadth fixture가 벽시계 기준 (11-03 05~09Z) | 고정 시계 — 69f83d4e |
| data-pipeline | 9 | breadth 97h 행이 화요일 05~09Z에 current로 읽힘 | 고정 시계 — 이번 커밋 |
| scenario-guidance-fixture | 6 | P1743 "live state has at least one staged theme" | `liveData: content` + watchdog twin |
| data-refresh | 6 | 참조행 / screener·event-briefs 커밋에서 데이터 나이 | `liveData: content` (twin은 기존 watchdog-data-refresh) |
| data-lineage | 2 | refresh-data가 실패하는 동안 screener 커밋에서 data.json 12h SLA | `liveData: content` + watchdog twin |
| workflow-yaml | 3 | 소스 결함(reaction-read U+0008) | 계속 막는다 (69f83d4e에서 수정) |
| browser-secondary-text-budget | 2 | event-brief 글로 홈 글자 예산 초과 | v59.49부터 refresh 출처에서 브라우저 샤드를 돌리지 않음 |
| screener-extended | 2 | 원인 미상 (10-30 로그에 실패 행이 없음) | 계속 막는다 |

## 2. 라이브 데이터를 읽지만 7일간 refresh 출처에서 실패하지 않은 게이트 (계속 막는다)

core: fundamental-watchlist-timeline, research-model, research-validation, data-continuity, screener-market-fixture, crash-replay-check, lookahead-check, architecture-audit-regression-fixture, fiscal-quality-fixture, tw-monthly-revenue-fixture, 13f-figi-ticker-fixture
data: screener-workbench, market-snapshot, history-time, operations-slo, reconciliation, candidate-archive, us-listings, manual-reference-expiry, producer-dry-run, 13f-semantic-noop, artifact-headroom
knowledge: knowledge-corpus

이 게이트에서 refresh 출처 실패가 생기면 같은 규칙을 따른다. 시계에 묶인 코드 계약이면 fixture를 고정 시계로 옮기고, 라이브 내용 단언이면 `liveData: "content"`를 달고 watchdog-local에 twin을 둔다. `ci-refresh-origin-live-data-check`가 원장 행마다 처리됐는지, twin이 있는지 확인한다.

## 3. 바뀐 동작

- `AIO_QA_ORIGIN=refresh`(ci.yml contract 샤드, reduced_scope일 때): `liveData: content` 게이트가 실패하면 ADVISORY로 보고한다. `::warning`을 남기고, exit 0이며, 다음 phase를 막지 않는다.
- 소스 push, 프로듀서의 push 전 실행(refresh-data `--group data`), watchdog에서는 그대로 실패한다.
- 재현: 실제 qa-runner를 게이트 하나짜리 manifest로 돌렸다. 옛 구성은 refresh 출처에서 red, 새 구성은 green, 소스 push는 red다.

## 4. 함께 찾은 것 (수정하지 않음)

`observationSessionState`는 장 시작 전에 관측한 값(예: 금 05Z = 목 01시 ET)을 그날(금) 세션으로 셈한다. 그래서 화요일 오후 KST에는 97시간 지난 breadth가 lag 1, 12h grace 안으로 들어와 current로 읽힌다. 프로듀서는 장 마감 뒤에 관측하므로 실제 데이터에서 일어날 가능성은 낮다. 세션 분류기는 model-check 대상이라 이 세션에서는 고치지 않았다.
