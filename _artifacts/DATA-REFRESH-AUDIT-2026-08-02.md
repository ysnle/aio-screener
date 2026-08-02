# 데이터 최신성·출처 감사

작성일: 2026-08-02  
대상 버전: v53.86
범위: `/data-refresh` 22개 durable category + 한국 동적 pipeline + 최근 24시간 이벤트 검색

## 판정

구조 게이트는 통과했다. 22개 category, Tier-0 16/16, unknown session 0, 한국 동적 pipeline 4/4가 확인됐다. 다만 이 감사는 모든 값이 최신이라는 뜻이 아니다. AAII/NAAIM/Investor Intelligence/McClellan/10Y-2Y는 공식 현재값을 확보하지 못해 `SKIPPED`로 남겼고, VIX/HY OAS·Put/Call·HY OAS는 현재 artifact 기준 `STALE`로 남겼다. 확인하지 못한 값을 합성하거나 외삽해 화면에 넣지 않았다.

| 구간 | 결과 |
|---|---|
| A1~A2 | `OK` — market snapshot/Fear & Greed 연결 |
| A3/D1 | `STALE` — VIX 2026-07-31, HY OAS 2026-07-30; 최신 공식 관측값 갱신 전 reference-only |
| B1~B3 | `SKIPPED` — 라이선스/구독 현재값 미확보 |
| B4 | `STALE` — Cboe Put/Call 2026-07-31 |
| C1~C2 | `OK` — breadth coverage 97.5% |
| C3 | `SKIPPED` — durable official A/D series unavailable |
| C4 | `SKIPPED` — runtime-derived Weinstein stage, hardcoded current claim 없음 |
| D2 | `OK` — Treasury fallback 2026-07-31 |
| D3 | `SKIPPED` — 10Y-2Y spread unavailable; single 10Y quote로 추론하지 않음 |
| E1~E4 | `OK` — CPI/PCE, employment, FOMC, policy-rate lineage 연결 |
| F1/G1~G3 | `OK` — completed news cycle, commodities/FX, indices, crypto 연결 |
| H-dynamic | `PASS` — `fetchKrSupplyData`, `fetchKrNaverQuotes`, `renderKrThemePerfBars`, catalyst retired |

실행 게이트: `node scripts/ci-data-refresh-audit.mjs`  
구조 결과: `D1-structural | yes | rows=22 unknownSessions=0 tier0=16/16`

공식 refresh 시도: `node scripts/fetch-data.mjs`는 provider 네트워크/키 부재로 78/78 quote 재시도 후 `CORE_QUOTE_COVERAGE_FAILED`로 종료했으며, 안전장치가 기존 `data.json`을 보존했다. 2026-08-02는 휴장일이고 직전 Tier-0 snapshot이 16/16·`QG-01_PASS`·errors 0이므로 `ci-data-lineage-audit`의 주말 유예를 적용해 live-core FAIL을 만들지 않는다. 이는 새 시세가 갱신됐다는 뜻이 아니다.

## 24시간 이벤트 검색

검색은 발견·맥락 확인에만 사용했으며, 현재 데이터 값이나 투자 신호로 승격하지 않았다.

| 영역 | 확인된 맥락 | 코드 반영 |
|---|---|---|
| 글로벌 | 2026-07-31 미국 주요 지수·국채금리·인플레이션 우려 보도 | 기존 snapshot/news pipeline 유지 |
| 지정학·원자재 | 최근 검색 결과는 유가·해상 운송 위험을 다루지만 날짜·직접성 기준이 혼재 | WTI/지정학 수치 갱신 보류 |
| Fed | 2026-07-29 FOMC 결과와 공식 일정 연결 | 기존 FOMC registry 유지 |
| AI·반도체 | NVIDIA–TSMC 공식 협력 자료는 구조 참고로 확인 | 현재 매출·생산·수율 claim 승격 없음 |
| 한국 | 검색 결과의 날짜·출처가 혼재해 2026-07-31 일별 수급값으로 확정하지 않음 | KRX/Naver 동적 pipeline 유지 |

## 운영 결론

- 최신 completed market cut이 필요하면 scheduled refresh가 `public-data/data.json`과 `public-data/market-snapshot.json`을 갱신해야 한다. 현재 local artifact는 2026-08-01 cycle이며 `ci-data-lineage-audit`에서 `data.json` freshness SLA 초과가 1건 보고된다.
- FRED/Cboe/라이선스 데이터가 확인되지 않은 상태에서 숫자를 수동 입력하지 않는다.
- 시장 데이터 갱신 후에는 `ci-data-lineage-audit`, `ci-data-refresh-audit`, `ci-refresh-artifact-integrity-check`, release-manifest parity를 같은 packet으로 재실행한다.
