# 화면 신선도 전수표 — 2026-11-04 (v59.70 후보, actions-reliability)

표기: [확인]은 코드·파일을 직접 읽은 것, [추정]은 흐름으로 미루어 판단한 것이다. 시각은 로컬 사본 기준이다(data.json generatedAt 11-03T12:55Z, 라이브보다 약 12h 이전).
주기: refresh-data는 cron :17/:47에 Worker dispatch :20/:50이 더해지고, 일일 레인은 07:33Z에 돈다. refresh-screener는 6h마다 :53과 21:53Z에 돌며, Worker 백업 dispatch가 07:25Z와 22:25Z에 있다. event-briefs는 :07/:27/:47에 돈다. 시세 KV는 Worker cron이 5분마다 갱신한다.
갱신 경로 레지스트리: `src/data/contracts/artifact-freshness.js`(자동 34개, 수기 7개). 게이트: `scripts/ci-artifact-refresh-path-check.mjs`.

## 1. 화면 · 탭 · 카드

| 화면 | 탭/카드 | 원천 | 프로듀서 / 워크플로 | 주기 | 최신(로컬) | 자동 여부 |
|---|---|---|---|---|---|---|
| 오늘 | 요약 · 판정 첫 페인트 | today-verdict.json | build-scenario-state / refresh-data | 30분 | 11-03T12:56Z, asOf 11-02 | 완전 자동 |
| 오늘 | 요약 · 판정 본계산 | history + data.json (브라우저 계산) | fetch-data / refresh-data | 30분 | 11-03 | 완전 자동 |
| 오늘 | 요약 · 오늘의 질문 | operator-note.json 또는 marketAnalysis.sentence | 수기 / market-narrative | 하루 1회 | note 10-15 | AI 자동 + 수기 덮어쓰기 |
| 오늘 | 요약 · 한국 줄 | market-snapshot + kr-index-weights | fetch-kr-index-weights / event-briefs | KRX 마감 후 | 11-03T14:40Z | 완전 자동 |
| 오늘 | 요약 · 지수 하루 흐름, 시세 칩 | Worker /relay·/quotes (+ data.json F&G) | 브라우저 3분 | 3분 | 라이브 | 완전 자동 |
| 오늘 | 요약 · 오늘의 핵심 / 브리핑 · 지난 24시간 | market-day.json | build-market-day / refresh-data | 30분 | 11-03T12:56Z | 완전 자동 |
| 오늘 | 브리핑 · AI 시황 해설, 한 주 흐름 | data.json marketAnalysis + history | market-narrative (Worker /openai) / refresh-data | 30분(입력이 바뀔 때만 호출) | 11-03T11:51Z | 완전 자동(실패 시 최대 12h 유지 표시) |
| 오늘 | 브리핑 · 섹터 등락, 자산별 흐름, 시간대별 시황 | data.json rotationHistory·DATA_SNAPSHOT·marketTimeline | fetch-data / refresh-data | 30분 | 11-03 | 완전 자동 |
| 오늘 | 브리핑 · 다음 확인 포인트 | macro-calendar + AIO_MACRO_OFFICIAL_SCHEDULES + SCHEDULED_EVENTS + earnings-calendar | refresh-data / refresh-screener + 코드 상수 | 30분/6h/수기 | 11-03 | 혼합(수동 참조값) |
| 오늘 | 브리핑 · 대만 월매출 | tw-monthly-revenue.json | refresh-screener | 월 | 11-01 | 완전 자동 |
| 오늘 | 뉴스 · 피드, 텔레그램 | data.json news, telegram-digest.json | fetch-data, fetch-telegram-digest / refresh-data | 30분 | 11-03T12:55Z | 완전 자동 |
| 시장 상태 | 국면 · 판정, 레이더, 같이 보기, 시나리오 | history, data, macro-history, macro-calendar, scenario-state/outcomes, stress-outcomes, screener | refresh-data + refresh-screener | 30분/일/6h | 11-03 | 완전 자동 |
| 시장 상태 | 국면 · 한국 투자자별 순매수 | kr-investor-flows.json | fetch-kr-investor-flows / refresh-screener | 6h | 10-20, not-collected | **막힘: BOK_API_KEY 시크릿 없음 [확인]** |
| 시장 상태 | 시장 폭 | screener breadth + history + breadth-contributors | refresh-screener | 6h + 21:53Z | 11-03T22:32Z | 완전 자동 |
| 시장 상태 | 투자 심리 | data.json fearGreed/putCall/AAII + market-temperature | refresh-data | 30분(온도 4h) | putCall asOf 10-22 | 자동. **putCall은 Cboe 403으로 멈춤** |
| 매크로 | 거시 · 사분면, 24개월 지표, 시나리오 | data.json macro + macro-history + scenario-state | refresh-data | 30분 | 11-03 | 완전 자동 |
| 매크로 | 거시 · S&P 500 이익 | consensus-estimates + screener | refresh-screener | 6h | 11-03T22:30Z | 완전 자동 |
| 매크로 | 거시 · 정책금리, FOMC 결과 | data.json policyRates(FRED) / AIO_EVENT_FRESHNESS_REGISTRY.fomc | refresh-data / 코드 상수 | 30분 / 수기 | 10-28 | 자동 + **수동 참조값** |
| 매크로 | 거시 · 한국 거시 | AIO_MANUAL_REFERENCE + official-references.json | refresh-web-research / refresh-data + 코드 상수 | 12h | 11-03T03:51Z | **수동 참조값** + 일부 자동 |
| 매크로 | 금리·환율 | data.json macro + history + live, treasury-auctions | refresh-data, refresh-screener | 30분/6h | 11-03 | 완전 자동 |
| 테마와 섹터 | 섹터 RRG | data.json rotationHistory (세션이 안 맞으면 브라우저가 다시 계산) | refresh-data | 30분 | 11-02T23:21Z | 자동(대체 계산 경로, theme-sector 소관) |
| 테마와 섹터 | 세부 테마, S&P 500 지도, 테마 상세 | screener.json + THEME_MAP | refresh-screener + 수기 구성 | 6h | 11-03T22:32Z | 자동(구성은 수기) |
| 테마와 섹터 | 테마 시나리오/단계 | scenario-state themes + theme-stage-history | refresh-data / refresh-screener | 30분/6h | 11-03 | 완전 자동 |
| 테마와 섹터 | AI 설비투자 흐름 | AI_CAPEX_FLOW (src/domain/themes/ai-capex-flow.js) | 코드 상수 | — | 2026-08/09 | **수동 참조값** |
| 테마와 섹터 | 빅테크 현금흐름, 한국 테마 | bigtech-cashflow / KR_THEME_MAP + screener + Naver live | refresh-screener + 브라우저 | 6h/30분 | 11-03 | 자동(구성은 수기) |
| 종목 | 개요 · 가격, 차트 | Worker /relay, Naver fchart | 브라우저 | 3분/요청 시 | 라이브 | 완전 자동 |
| 종목 | 개요 · 이 종목의 지금, 밸류, 브리프 | screener, rotationHistory, consensus, event-briefs | refresh-screener / event-briefs | 6h/20분 | 11-03 | 완전 자동 |
| 종목 | 개요 · 무엇을 하는 회사 | company-profiles/*.json (189개) | sync-company-profiles (워크플로 없음) | 분기 조사 | 10-28~30 | **사람 손**(실적일이 지나면 stale 표시) |
| 종목 | 재무 공시 · SEC | sec-fiscal-history, sec-fundamentals-summary | refresh-screener | 6h | 11-03T22:26Z | 완전 자동 |
| 종목 | 재무 공시 · 한국 | kr-fundamentals.json | fetch-dart-fundamentals / refresh-screener | 주 | 10-12, pending-operator-key | **막힘: DART_API_KEY (소유자 결정)** |
| 스크리너 | 순위·검색 | screener + screener-universe (+ extended) | refresh-screener | 6h + 21:53Z | 11-03T22:32Z | 자동(유니버스는 수기) |
| 스크리너 | 검증 카드 | backtest-history + screener-validation-gate + model-validation-status | refresh-screener + 수기 | 6h / 수기 | 게이트 08-13 | 혼합(게이트는 사람 손) |
| 스크리너 | 장기 팩터 백테스트 | factor-backtest-longrun.json | research-backtest.yml (수동, 커밋 안 함) | — | 07-10 | **사람 손**(이번에 120일 만료 게이트 추가) |
| 스크리너 | 후보 기록, 상장 목록 | candidate-archive, us-listings | refresh-screener | 6h/일 | 11-03 | 완전 자동 |
| 포트폴리오 | 보유·손익, 백테스트 | localStorage + live | 브라우저 | 3분 | 라이브 | 자동(보유는 사용자 입력) |
| 포트폴리오 | 포트폴리오 읽기 | sp500-weights + rotationHistory + screener | refresh-screener | 일 | 10-27 | 완전 자동 |
| 리서치 | 개념·분석, 산업 지도 | principles/*, knowledge/*, atlas/* | 수기 빌드(PR) | — | 08-15~10-17 | **사람 손**(nested 120일 WARN) |
| 리서치 | 대가 보유 종목 | masters/* (일부 수기: manager-principles, security-master, manager-row-previews) | collect-13f-* / refresh-data 일일 레인 | 일 | 11-02 | 자동 + 일부 수기 |
| 전 화면 | AI 패널 | 로드된 산출물 + aio-chat.js REFERENCE 팩 | Worker /openai | 질문마다 | — | 자동 + 수기 REFERENCE(08-09~09-11) |

## 2. AI 시스템

| 시스템 | 재생성 | 입력이 바뀌면 | 실패하면 |
|---|---|---|---|
| AI 시황 해설 (marketAnalysis, market-narrative.mjs, Worker /openai) | refresh-data가 돌 때마다 | 근거와 서명이 같으면 호출 없이 재사용한다. 08:00 KST에 날이 바뀌면 새 문장을 만든다 | 검증된 직전 해설을 최대 12h `retained`로 표시한다. 그 뒤에는 blocked fallback으로 바뀐다 [확인] |
| 헤드라인 번역 | 같은 실행 안 | 새 제목만 번역한다 | 브라우저가 번역한다 |
| scenario-state / today-verdict | refresh-data가 돌 때마다, 네트워크 없이 | 매번 다시 계산한다. screener 변경은 다음 refresh-data에 반영된다 [추정] | 이전 파일이 남는다. **v59.70부터 원장에 checkedAt/not-written이 남고, 시각만 다른 재작성은 커밋하지 않는다** |
| event-briefs | 20분 | 새 원문이 있을 때만 AI를 호출한다 | 이전 브리프를 이어받고 레인별 상태를 기록한다 |
| AI 패널 문맥 | 질문마다 그때 로드된 값으로 만든다 | 예 | 수기 REFERENCE 팩은 갱신 경로가 없다(aio-chat.js 08-22~09-11) |
| 기업 이야기 | 사람이 조사해 sync | 아니요 | 실적일이 지나면 stale로 표시된다 |

## 3. 갱신 경로가 없거나 수동인 항목과 처리

| 항목 | 처리 |
|---|---|
| structural-data-research.json (08-21 고정, 아무도 쓰지 않음) | MANUAL_ARTIFACTS에 등록. 만료는 lineage 14일(WARN) |
| factor-backtest-longrun.json (07-10, 만료 없음) | MANUAL 등록 + lineage maxAgeHours 120일 **신규** |
| operator-note, screener-validation-gate, model-validation-status, user-research-digest, screener-universe | MANUAL 등록. 기존 lineage 만료와 universe-review를 그대로 쓴다 |
| kr-investor-flows (BOK_API_KEY 없음 [확인: gh secret list]) | blockedBy로 표시. watchdog은 경고, 화면 상태는 'blocked'. 원천 교체는 data-refactor(Naver) |
| kr-fundamentals (DART_API_KEY, 소유자 결정) | blockedBy로 표시 |
| putCall (Cboe 403) | 미해결. 공개 CSV는 2019년까지이고 새 페이지는 클라이언트가 불러온다. 서버 수집은 봇 차단에 걸려 시도를 중단했다. 소유자 결정 필요 |
| AIO_MANUAL_REFERENCE, AIO_EVENT_FRESHNESS_REGISTRY | 기존 ci-manual-reference-expiry-check(watchdog)가 만료 이슈를 연다. 교체(R7)는 data-refactor |
| AI_CAPEX_FLOW, THEME_MAP/KR_THEME_MAP, SCHEDULED_EVENTS, 휴장일 표, AI REFERENCE 팩, company-profiles, knowledge/atlas/principles, masters 수기 3종 | 후속 과제. 코드 상수의 만료일 게이트는 R7 뒤로 미룬다(오케스트레이터 지시) |

## 4. 미국 마감 직후 screener 지연 [확인: gh run list]

- cron은 `53 21 * * *`이다. 10/25~11/02 동안 실제 시작은 2~104분 늦었고, 대개 45~67분이었다. 실행 시간은 8~17분이다.
- 11/02부터는 EST라 미국 마감이 21:00Z다. 그래서 마감에서 screener.json 커밋까지 약 1.2~2.5h가 걸리고, CI와 Pages까지 10~15분이 더 걸린다.
- Worker 백업 dispatch(22:25Z)가 있지만 cron보다 늦다. 권고: data-plane Worker의 screener dispatch를 21:10Z(마감 + 10분)로 당긴다. Worker 배포가 필요하므로 소유자 승인 사항이다.
