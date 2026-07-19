---
verified_by: Codex (repository, live artifacts, GitHub Actions, official and direct-source spot checks)
last_verified: 2026-07-19
confidence: high
auto_refresh: durable-actions-partial; fast-plane-operator-required
target_version: v53.14
status: PARTIAL_WITH_EXECUTED_GATES
---

# 자동 데이터 신뢰성·대체 추론 구조 핸드오프

## 0. 결론

현재 AIO는 **전체 데이터 자동 최신화가 보장되는 상태가 아니다**. 2026-07-18 실측 기준으로 22개 범주 중 완전 자동 8개, 자동이지만 부분적 7개, 공식 수동 2개, 실질 공백 5개로 판정했다. 시세 수집 자체는 서버 실행에서 77/77 성공했지만 공개 `data.json`은 재배포 권리 보호를 위해 quote 배열을 비우므로, 브라우저 직접 수집이 실패했을 때 사용할 **공개 서버 quote backstop이 없다**.

구조 개선의 핵심은 두 가지다.

1. 시장 시세·개별 종목·글로벌 지수처럼 정확한 숫자가 필요한 영역은 `AI WebSearch`가 아니라 **복수 공급자 + 서버 정규화 + 관측시각 + 외부 스케줄러 + 마지막 정상값**으로 보장한다.
2. 직접 자동화가 불가능한 설문·유료 데이터는 WebSearch/뉴스를 **정성적 보조 근거**로만 사용한다. 검색 결과로 정확한 현재 수치를 합성하거나, 다른 지표를 원래 지표처럼 대체하지 않는다.

이 문서는 전체 시스템 상위 설계인 `ARCHITECTURE-REBUILD-HANDOFF-2026-07-18.md`의 **AR-07 데이터 운영면 하위 실행계획**이다. 기존 `INSTITUTIONAL-HANDOFF-RECONCILIATION-2026-07-15.md`의 WP-0~14를 재작성하지 않고, 그 실행 계약 위에 다음 세 가지를 추가한다.

- 중요 시세 자동 최신화 보장 계층
- 직접 관측과 AI 추론의 분리 계약
- 2026-07-18 공백별 우회 경로와 이진 완료 게이트

## 1. 인수 기준선

### 1.1 직접 확인된 상태

| 항목 | 2026-07-18 관측 | 판정 |
|---|---|---|
| 라이브 앱 | v53.7 | 로컬 v53.9 미커밋 변경과 다름 |
| `public-data/data.json` | `generatedAt=2026-07-18T04:14:55.888Z` | 생성시각은 현재 artifact 기준이며 개별 관측시각과 별개 |
| `public-data/screener.json` | `asOf=2026-07-18T03:40:36.109Z` | 자동 갱신되지만 종목·시장별 관측시각은 별도 보존 필요 |
| 서버 quote 수집 | 77/77 성공 | 수집 성공 |
| 공개 quote payload | `quotesPublished:false`, `quotes=[]` | 브라우저 실패 시 서버 시세 backstop 없음 |
| refresh workflow | cron `17,47 * * * *` | 실제 간격은 약 1~3시간, 최대 약 3시간 8분 관측 |
| watchdog | repo 240분, live 360분 허용 | 장애 감지는 있으나 시세 SLO 보장은 아님 |
| 공식 직접 대사 | Cboe Put/Call, FRED/BLS, BOK 값 일치 | 해당 원천은 신뢰 가능 |
| 핵심 공백 | AAII, II, breadth history, ISM, VKOSPI, SEC 저커버리지 | 자동 최신화 미보장 |

### 1.2 현재 구조에서 특히 위험한 의미 혼용

- `generatedAt`: 파일을 만든 시각
- `fetchedAt`: 공급자 응답을 받은 시각
- `observedAt`: 시장 또는 기관이 값을 관측·발표한 시각
- `releaseAt`: 경제지표가 공개된 시각
- `lastSuccessfulAt`: 마지막 정상 수집 시각

이 다섯 시각은 서로 바꿔 쓸 수 없다. 7월 18일 history의 한 행에 미국 7월 17일, 한국 7월 16일, 암호화폐 7월 18일 값이 함께 들어간 사례처럼, 공통 `date` 하나는 현재성을 증명하지 못한다. 모든 중요 값은 field-level `observedAt`을 가져야 한다.

## 2. 목표 구조

```text
정확 수치 계층
  공식/라이선스/시장 API
    -> provider adapter
    -> schema·단위·심볼 정규화
    -> freshness·coverage·divergence 검증
    -> canonical evidence store
    -> fast quote API + durable public artifact
    -> 페이지·차트·AI의 동일 Evidence ID

정성 보조 계층
  공식 발표문·뉴스·WebSearch·시장 피드
    -> 출처/시간/중복/권리 검사
    -> event/context evidence
    -> 범주형·구간형 추론
    -> 설명·경보·조사 큐에만 사용
```

### 2.1 단일 값 계약

모든 값은 최소 다음 envelope를 사용한다.

```json
{
  "metricId": "market.index.spx.last",
  "instrumentId": "US:INDEX:SPX",
  "value": 7457.69,
  "unit": "index_point",
  "currency": "USD",
  "source": "provider-id",
  "backupSource": "provider-id-or-null",
  "sourceKind": "market_api",
  "evidenceClass": "OBSERVED",
  "observedAt": "2026-07-17T20:00:00Z",
  "fetchedAt": "2026-07-18T11:18:00Z",
  "marketState": "CLOSED",
  "freshnessStatus": "CLOSED_CURRENT",
  "divergencePct": 0.08,
  "confidence": "high",
  "allowedUse": ["display", "derive", "ai_context"]
}
```

`value`만 있는 객체, 파일 공통시각을 빌린 객체, 출처 또는 단위가 없는 객체는 중요 수치로 publish하지 않는다.

### 2.2 소비 우선순위

1. 검증을 통과한 fast server evidence
2. 같은 계약을 통과한 브라우저 직접 관측값
3. durable artifact의 last-known-good
4. `STALE` 표시가 붙은 참고값
5. `UNAVAILABLE`

후순위가 선순위보다 새로 보여도 `observedAt`, 세션, 단위, divergence 검증을 통과하지 못하면 덮어쓰지 않는다. stale 값을 현재값처럼 조용히 재사용하지 않는다.

## 3. 중요 시세 자동 최신화 보장 설계

### 3.1 “보장”의 정확한 의미

GitHub Pages와 GitHub Actions 예약 실행만으로는 실행 시각 SLA를 보장할 수 없다. 현재도 30분 cron 선언과 실제 1~3시간 간격이 달랐다. 따라서 다음 조건을 충족하기 전에는 `guaranteed`가 아니라 `best-effort`로 표시한다.

- 계약 또는 허용 범위가 명확한 공급자
- GitHub Actions와 독립된 외부 스케줄러
- 핵심 심볼 100% coverage gate
- 시장 세션을 반영한 freshness gate
- 공급자 장애 시 자동 fallback과 last-known-good
- 지연·공백·불일치 알림과 공개 상태 표시

### 3.2 이중 실행면

| 실행면 | 역할 | 권장 구현 |
|---|---|---|
| Fast plane | 장중 중요 시세 | Cloudflare Cron Worker가 5분마다 bounded allowlist를 수집·검증하고 KV/R2 또는 cache에 저장, `/quotes`로 제공 |
| Durable plane | 감사·복구·히스토리 | 기존 GitHub Actions가 30분/6시간/일간 주기로 versioned `public-data`와 last-known-good를 보존 |
| Browser overlay | 사용 시점 보강 | 서버보다 새롭고 계약 검증을 통과한 직접 관측만 임시 승격 |
| Watchdog | SLO 감시 | fast plane heartbeat, coverage, age, divergence를 외부에서 검사하고 workflow summary/issue/알림 생성 |

Cloudflare Cron을 새로 쓰기 어렵다면 외부 cron이 `repository_dispatch`를 호출할 수 있다. 다만 Actions queue가 다시 지연될 수 있으므로 이것은 완전한 fast plane이 아니라 실행 중복화에 가깝다.

### 3.3 중요도와 목표 cadence

| Tier | 범위 | 목표 cadence | 현재성 기준 |
|---|---|---:|---|
| Tier 0 | S&P 500, Nasdaq, Dow, Russell, VIX, KOSPI, KOSDAQ, USD/KRW, 2Y/10Y, DXY, WTI, Gold, BTC, ETH | 장중 5분, 장외 15분 | 장중 관측 age 10분 이내; 폐장 후 마지막 공식 세션은 `CLOSED_CURRENT` |
| Tier 1 | 사용자가 보유/검색한 종목, 스크리너 상위 종목, 주요 글로벌 지수·ETF | 장중 5~15분 | 시장별 관측 age 20분 이내 |
| Tier 2 | 870종목 스크리너·일봉·기술지표 | 6시간 또는 장 마감 후 | 최신 완료 거래일과 일치 |
| Tier 3 | 거시·정책·설문·공시 | release-aware | 다음 발표 전까지 최신 공식 관측값, 발표 직후 갱신 deadline 별도 |

장 종료 상태의 전일 종가는 오래된 값이 아니다. 반대로 파일이 방금 생성됐어도 실제 `observedAt`이 이전 세션보다 오래되면 최신값이 아니다.

### 3.4 공급자 전략

| 영역 | 1차 | 2차/검증 | 최후 경로 | 주의 |
|---|---|---|---|---|
| 미국 지수·주식·ETF | 현재 Yahoo chart adapter | Stooq EOD 또는 계약형 공급자 | durable LKG | Yahoo/Stooq는 통합 실시간 NBBO가 아님 |
| 글로벌 지수 | Yahoo index symbols | Stooq 지원 지수 또는 공식 거래소 지연값 | 명확히 표시한 ETF proxy | ETF 가격을 지수값으로 표시 금지 |
| 한국 지수·종목 | Naver/Yahoo `.KS`·`.KQ` 교차 | 승인된 KRX Open API 또는 증권사 API | durable LKG | KRX 제3자 제공·표시 조건 확인 |
| 환율 | 시장 quote adapter | 중앙은행 reference rate | durable LKG | 실시간 spot과 기준환율 구분 |
| 국채·금리 | 시장 quote + FRED/Treasury | 만기별 공식 series | durable LKG | 2Y/10Y 등 만기 합성 금지 |
| 원자재 | 선물 quote adapter | EIA/공식 settlement 또는 보조 provider | durable LKG | 현물·선물·근월물 구분 |
| 암호화폐 | CoinGecko 또는 거래소 집계 | Yahoo/다른 거래소 | durable LKG | 거래소·통화·24/7 시각 정규화 |

무료 공급자만으로는 거래소 통합 실시간 품질을 보장할 수 없다. 무료 모드의 제품 문구는 `지연/참고 시세`로 유지하고, 진짜 실시간 보장은 공급자 계약이 승인된 뒤 별도 capability로 승격한다.

### 3.5 publish gate 초기값

| Gate | 통과 조건 |
|---|---|
| QG-01 Tier 0 coverage | 100%; 하나라도 없으면 새 snapshot publish 실패, 이전 정상본 보존 |
| QG-02 Tier 1 coverage | 99% 이상; 누락 심볼 목록 공개 |
| QG-03 field time | 중요 값 100%에 `observedAt`, `fetchedAt`, session 존재 |
| QG-04 freshness | 시장별 budget 초과 값은 `CURRENT` 금지 |
| QG-05 divergence | 지수 0.5%, 주식 1.0%, FX 0.3%, crypto 1.0%, 금리 10bp 초과 시 quarantine; 초기값이며 실측으로 조정 |
| QG-06 overwrite safety | 실패·저커버리지 run이 last-known-good를 덮지 않음 |
| QG-07 live parity | fast API, durable artifact, 화면 Evidence ID와 값이 허용 오차 내 일치 |
| QG-08 scheduler | 24시간 rolling window에서 목표 실행의 99% 이상, 연속 2회 miss 시 경보 |

## 4. AI WebSearch·시장/뉴스 피드의 허용 범위

### 4.1 Evidence class

| Class | 의미 | 숫자 표시 | 판단 사용 |
|---|---|---|---|
| `OBSERVED` | API·공식 파일·공식 발표에서 직접 읽은 값 | 정확값 허용 | freshness/rights 통과 시 허용 |
| `DERIVED` | OBSERVED 입력으로 결정론적으로 계산한 값 | 산식·입력 ID와 함께 허용 | coverage 충족 시 조건부 허용 |
| `INFERRED` | WebSearch·뉴스·복수 기사에서 유추한 방향·범위 | 정확값 금지; 범주/구간만 | 설명·경보·조사 큐만 |
| `MANUAL_REFERENCE` | 사람이 공식 원천에서 확인해 등록한 일정·정책·설문 | 기준일과 함께 허용 | reference/calendar만 |
| `UNAVAILABLE` | 근거가 없거나 상충·권리 미승인 | 표시 금지 | 사용 금지 |

### 4.2 WebSearch가 가능한 것

- “위험선호가 강화됐다”, “투자자 노출이 높은 편이다” 같은 범주형 설명
- 복수 출처가 공통으로 보도한 이벤트 발생 여부와 원인 후보
- 공식 발표 페이지·원문·대체 공급자 발견
- 수치 공백이 있는 영역의 조사 우선순위와 confidence 부여
- 직전 관측치 대비 방향 또는 넓은 구간 추정. 단 `INFERRED` 라벨과 근거 링크가 필수다.

### 4.3 WebSearch가 하면 안 되는 것

- 검색 스니펫 여러 개의 숫자를 평균해 현재 AAII/NAAIM/II 값 만들기
- 뉴스의 “급등/급락” 표현으로 현재 지수·종목 가격 계산하기
- VIX/Fear & Greed를 VKOSPI나 AAII의 정확한 대체값으로 표시하기
- ETF 가격을 원지수 값으로, HYG 가격을 HY OAS로, 기사 서술을 ISM 수치로 변환하기
- paywall 뒤 숫자, 라이선스 미승인 수치, 날짜 불명 수치를 현재 판단에 사용하기

## 5. 22개 영역별 자동화·우회 설계

| # | 영역 | 현재 판정 | 직접 자동화 목표 | 직접값 부재 시 우회 | 허용되는 최종 상태 |
|---:|---|---|---|---|---|
| 1 | 미국·글로벌 주요지수 | 자동/부분; 브라우저 의존 | fast quote allowlist + 보조 provider 교차검증 | ETF proxy는 별도 metric으로만 표시 | OBSERVED 또는 STALE |
| 2 | 미국 개별주식·ETF | 자동/부분; 공개 서버 backstop 없음 | Tier 1 fast snapshot, 사용자 보유/검색 종목 우선 | 최신 EOD LKG | OBSERVED 또는 STALE |
| 3 | 한국 지수 | 자동/부분 | Naver/Yahoo 교차 + KRX/증권사 승인 경로 | 상충 시 이전 정상 종가 | OBSERVED 또는 QUARANTINED |
| 4 | 환율 | 자동 | 시장 spot + 중앙은행 reference 분리 | 최근 공식 기준환율 | OBSERVED/REFERENCE 분리 |
| 5 | 국채·금리 | 자동 | 시장 quote와 FRED/Treasury 만기별 evidence | 최근 공식 close | OBSERVED 또는 CLOSED_CURRENT |
| 6 | 원자재 | 자동 | 선물/현물/settlement instrument 분리 | EIA·공식 settlement | OBSERVED 또는 REFERENCE |
| 7 | 암호화폐 | 자동 | CoinGecko/거래소 다중값 median 검증 | 24/7 freshness 초과 시 즉시 STALE | OBSERVED 또는 STALE |
| 8 | Fear & Greed | 자동 | 현재 canonical envelope 유지 | 구성요소 기반 자체 지수는 다른 이름으로만 | OBSERVED 또는 UNAVAILABLE |
| 9 | VIX·VVIX·기간구조 | 자동/부분 | Cboe/시장 API + 만기별 직접 quote | 실측 만기 부족 시 term structure 보류 | OBSERVED/DERIVED 또는 UNAVAILABLE |
| 10 | Put/Call | 자동 delayed | Cboe 서버 일별 parser 지속 | 최신 공식 거래일 LKG | OBSERVED_DELAYED 또는 STALE |
| 11 | AAII·NAAIM·II 설문 | 공백/수동 | 공식 구독·허용 범위 확정 후 주간 adapter | WebSearch 복수 출처로 high/neutral/low만 추론 | MANUAL_REFERENCE/INFERRED |
| 12 | 시장폭 | 자동 snapshot, history 공백 | AIO 유니버스 advance/decline·MA breadth 일별 history 저장 | 뉴스의 “broad/narrow”는 설명에만 | DERIVED_AIO; 공식 breadth로 명명 금지 |
| 13 | FRED 거시 | 자동 | 서버 official series 유지, per-series time 보존 | LKG + release budget | OBSERVED_OFFICIAL |
| 14 | BLS·BEA·ISM | 부분; ISM 공백 | BLS/BEA 직접 adapter, ISM 공식 발표 parser/권리 검토 | 뉴스로 expansion/contraction 범주만 | OBSERVED_OFFICIAL 또는 INFERRED |
| 15 | Fed·글로벌 중앙은행 | 자동/수동 혼합 | 공식 calendar·statement·rate parser | 일정은 MANUAL_REFERENCE, 정책 해석은 INFERRED | OBSERVED/MANUAL_REFERENCE |
| 16 | BOK·KOSIS·한국 거시 | 부분 | ECOS/KOSIS server adapter + release calendar | 공식 발표 수동 등록 | OBSERVED_OFFICIAL/MANUAL_REFERENCE |
| 17 | 한국 수급·VKOSPI | 부분/공백; VKOSPI 409 | 승인 KRX/Koscom/증권사 API | 옵션 IV 자체모델은 `AIO IV proxy`; 뉴스는 방향만 | OBSERVED 또는 INFERRED; VKOSPI 합성 금지 |
| 18 | OHLCV·기술지표·RRG | 자동/부분 | 충분한 history와 각 field time 보장 | 입력 부족 시 계산·판정 모두 보류 | DERIVED 또는 UNAVAILABLE |
| 19 | 시장 뉴스·이벤트 | 자동, 품질 편중 | 공식 RSS + 다중 뉴스, 한국어·Tier-1 최소 quota | WebSearch로 공백 보강 | OBSERVED_EVENT/INFERRED_CONTEXT |
| 20 | Telegram·리서치 | 자동/부분 | 승인 채널·API, retention/coverage 정확화 | 공개 mirror 실패 시 cached reference | REFERENCE; 현재 수치 근거 금지 |
| 21 | 기업 펀더멘털·공시 | 부분; SEC 94/655 | US-GAAP/IFRS/해외발행인 분리, SEC/OpenDART 누적 | 뉴스의 실적 보도는 이벤트만 | OBSERVED_FILING 또는 UNAVAILABLE |
| 22 | 전술점수·AI 해설 | 파생/검증 제한 | OBSERVED/DERIVED 입력만 계산, 모델 manifest 고정 | INFERRED는 별도 문단에만 | 환경 설명/연구 전용 |

## 6. 공백별 구체 우회안

| 공백 | 1순위 해결 | 우회 가능성 | 금지선 |
|---|---|---|---|
| AAII | 공식 licensed/current feed | 복수 검색 근거로 `bullish/neutral/bearish`, confidence 표시 | 정확 % 합성 |
| NAAIM | 공식 페이지의 사용조건 확인 후 adapter 또는 구독 | “노출 높음/중립/낮음” 추론 | 2026-08-01 이후 권리 확인 없이 상업적 사용 |
| Investors Intelligence | 구독/라이선스 | 공신력 있는 2차 보도의 범주형 요약 | subscriber 숫자 재배포 |
| HY OAS | FRED CSV를 서버 artifact에 직접 포함 | 없음; LKG만 허용 | 공용 CORS proxy나 HYG 가격으로 수치 추정 |
| VKOSPI | KRX/Koscom/증권사 승인 API | KOSPI200 옵션 IV 기반 `AIO IV proxy`, 뉴스 방향 | proxy를 VKOSPI라고 표시 |
| ISM | 공식 발표문 parser와 release-aware job | 뉴스로 50 상·하, 개선·악화 범주 | 기사로 정확 PMI 작성 |
| breadth history | screener universe에서 일별 재계산·저장 | 뉴스 breadth 서술 | AIO breadth를 NYSE/Nasdaq 공식 breadth로 표시 |
| SEC coverage | 실패 유형별 universe 분모 분리, companyfacts/filing parser 보강 | 실적 기사 event만 보조 | 뉴스 숫자를 정규화 재무제표로 승격 |
| 한국어 뉴스 부족 | 한국 공식기관/기업 RSS + 허용된 국내 피드 quota | WebSearch KR query 슬롯 | 번역본을 원문 또는 독립 출처로 계산 |
| macro calendar | 공식 release calendar 자동 파서 | 수동 공식 일정 레지스트리 | 과거 날짜 하드코딩 자동 이월 |

## 7. 구현 패킷

### Batch 0 — 핵심 시세 backstop과 시각 계약

목표: 시장 시세·개별 주식·글로벌 지수가 브라우저 단일 경로에 의존하지 않게 한다.

- `scripts/fetch-data.mjs`: quote 수집과 공개 payload 정책 분리. 전체 원문 재배포가 아니라 권리 승인된 bounded Tier 0/1 snapshot만 별도 산출물로 생성한다.
- 신규 `public-data/market-snapshot.json`: 중요 심볼의 canonical evidence, coverage, session, divergence, LKG 포함.
- `js/aio-data.js`: canonical merge 우선순위와 field-level time 적용.
- `js/aio-core.js`: freshness/coverage 상태를 페이지와 AI에 동일하게 노출.
- `scripts/ci-data-pipeline-contract-check.mjs`: QG-01~06 이진 gate.
- `scripts/ci-data-lineage-audit.mjs`: 파일시각 대신 field observation age를 보고.
- `history.json`의 공통 `date`를 폐기하고 심볼별 `observedAt/session/source`를 보존한다. 미국 7/17·한국 7/16·암호화폐 7/18 값을 한 `2026-07-18` 행에 넣지 않는다.
- Tier 0/1은 원천의 마지막 관측값과 artifact/UI 마지막 값을 자동 대조하는 reconciliation manifest를 발행한다.

완료 조건: Tier 0 100%, field time 100%, 브라우저 quote 실패 fixture에서도 서버 snapshot 렌더, stale silent fallback 0, 원천↔artifact↔UI 값·단위·시각 1:1 일치.

### Batch 1 — 독립 스케줄러와 live SLO

- `cloudflare-worker-proxy.js` 또는 별도 Worker module: Cron Trigger, provider adapter, KV/R2 LKG, `/quotes` endpoint.
- `.github/workflows/refresh-data.yml`: durable plane과 fast plane 역할 분리, 수동 dispatch 보존.
- `.github/workflows/data-watchdog.yml`: fast endpoint age/coverage/divergence 검사.
- `scripts/ci-live-invariant-check.mjs`: live 앱이 현재 Evidence ID를 소비하는지 검사.

완료 조건: 7일 soak에서 목표 실행 99% 이상, 연속 miss 경보 작동, GitHub Actions 지연 중에도 Tier 0 endpoint가 freshness budget 유지.

### Batch 2 — 서버로 옮길 수 있는 공백 제거

- HY OAS FRED server ingest
- AIO breadth 일별 history
- BLS/BEA/ISM release-aware adapter
- ECOS/KOSIS/OpenDART server adapter
- SEC 분모·실패사유·US-GAAP/IFRS coverage 분리
- VKOSPI/한국 수급의 승인 provider 결정 전 `UNAVAILABLE` 유지

완료 조건: 공용 CORS proxy가 중요 지표의 유일 경로인 경우 0, 각 producer에 last-success/failure/coverage 존재.

### Batch 3 — WebSearch inference plane

- 검색/뉴스 결과를 quote store와 다른 `context-evidence` 저장소에 둔다.
- claim은 `direction`, `range`, `confidence`, `sourceCount`, `sourceUrls`, `observedWindow`만 허용한다.
- `metricId`가 정확 수치형이면 `INFERRED` 값을 numeric sink에 bind하지 못하게 한다.
- AAII/NAAIM/II/ISM/VKOSPI 공백 UI에 “직접 관측 없음”과 추론 라벨을 함께 표시한다.

완료 조건: 검색 결과에서 exact numeric current value를 만드는 경로 0, inferred claim의 출처 2개 미만이면 confidence high 금지.

### Batch 4 — 품질 대시보드와 운영 인수

- source별 success rate, p95 latency, observation age, coverage, divergence, rights status
- 20개 사용자 표면/22개 내부 route의 required producer 상태
- `CURRENT`, `CLOSED_CURRENT`, `DELAYED`, `STALE`, `QUARANTINED`, `UNAVAILABLE` 사용자 배지
- provider 비용·quota·권리 만료일 운영 대장
- 페이지별 current narrative의 숫자 token → Evidence ID 역추적과 raw AI producer 검증 결과
- `MATCH/PARTIAL/BLOCKED/NOT_APPLICABLE` 22영역 source reconciliation 대시보드

완료 조건: 한 화면에서 “무엇이 자동이고 무엇이 추론/수동/공백인지” 식별 가능, 상태와 실제 Evidence가 일치.

## 8. 다음 실행자의 파일 소유권

| 책임 | 주 파일 | 산출물 |
|---|---|---|
| quote producer | `scripts/fetch-data.mjs`, 신규 adapter module | `market-snapshot.json`, provider fixture |
| scheduler/edge | `cloudflare-worker-proxy.js`, workflows | fast `/quotes`, heartbeat, LKG |
| canonical consumer | `js/aio-data.js`, `js/aio-core.js` | merge/freshness/lineage runtime audit |
| UI 상태 | `index.html`, `js/aio-ui.js` | 상태 배지와 unavailable/inferred 표현 |
| AI 경계 | `js/aio-chat.js` | OBSERVED/DERIVED와 INFERRED 분리 |
| gates | `scripts/ci-*.mjs`, `js/aio-tests.js` | QG·inference·live parity 회귀 방지 |

다음 실행자는 Batch 0부터 한 배치씩 수행한다. 기존 `data.json`과 브라우저 quote 경로 옆에 세 번째 독립 canonical 경로를 추가하지 말고, `market-snapshot`을 canonical quote 계약으로 만든 뒤 기존 소비자를 그 계약으로 이관한다.

## 9. 승인 또는 외부 결정이 필요한 항목

1. Cloudflare Cron/KV/R2를 운영 plane으로 사용할지
2. 무료 지연 시세를 목표로 할지, 계약형 실시간 공급자를 도입할지
3. KRX/Koscom/증권사 API의 제3자 표시·재배포 허용 범위
4. AAII/NAAIM/II 구독·상업 이용 권리
5. SEC/OpenDART/ECOS/KOSIS 운영자 키·User-Agent 설정
6. 장애 알림 채널과 담당자

이 항목은 코드가 해결할 수 없다. 승인 전에는 capability를 `operator_required`, `rights_review`, `unavailable` 중 하나로 명시한다.

## 10. 최종 인수 게이트

| ID | Yes 조건 |
|---|---|
| AR-01 | Tier 0 중요 지표 100%가 source/unit/observedAt/fetchedAt/session을 가짐 |
| AR-02 | GitHub Actions 외 독립 스케줄러가 있고 7일 SLO 증거가 있음 |
| AR-03 | 브라우저 직접 요청 전부 실패 시에도 fresh server snapshot이 렌더됨 |
| AR-04 | stale·quarantined·unavailable 값이 점수/레짐/행동형 문구에 들어가지 않음 |
| AR-05 | 22개 영역 각각의 direct/inferred/manual/unavailable 상태가 runtime audit에 노출됨 |
| AR-06 | AI/WebSearch가 exact numeric market sink를 채우는 경로가 0임 |
| AR-07 | QG-01~08과 live invariant가 CI/Watchdog에서 실행됨 |
| AR-08 | 공급자 권리·비용·quota·연락처가 승인 상태와 함께 기록됨 |
| AR-09 | Tier 0/1 마지막 값의 원천↔artifact↔UI 1:1 대조가 값·단위·observedAt 모두 일치함 |
| AR-10 | 현재형 분석문의 모든 숫자 claim이 Evidence ID로 역추적되고 raw producer와 public renderer 모두 claim gate를 통과함 |

하나라도 `no`이면 “전체 자동 최신화 보장”이라고 보고하지 않는다. 부분 완료는 Tier와 영역을 명시해 보고한다.

## 11. 이번 문서의 검증·미검증 경계

검증됨:

- 2026-07-18 라이브 artifact와 workflow cadence, quote publish 정책, 주요 공식/직접 원천 spot check에 기반한 공백 분류
- 기존 WP-0~14, 외부 데이터 대체 계획, data-refresh의 22개 범주·fail-closed 규칙과의 구조적 정합성
- WebSearch/뉴스를 exact numeric plane에서 분리해야 한다는 데이터 계약

미검증:

- 특정 상용 공급자의 실제 계약 조건·비용·재배포 권리
- Cloudflare Cron/KV/R2의 이 저장소 운영 설정과 7일 SLO
- 새 `market-snapshot`의 구현·실브라우저 렌더·배포
- AAII/NAAIM/II/KRX/Koscom의 법률·상업 이용 승인

이 문서는 `DESIGNED_WITH_RUNTIME_AUDIT` 상태다. 아래 §12의 대조 결과와 페이지 실측은 설계 입력으로 반영했지만, 코드·workflow·Worker·공개 데이터는 변경하지 않았으며 커밋·배포도 수행하지 않는다.

## 12. 2026-07-18 원천↔artifact↔UI 1:1 대조 결과

### 12.1 판정 규칙과 실행 경계

- `MATCH`: 값·단위·실제 관측일이 원천과 일치한다.
- `PARTIAL`: 일부 대표값은 일치하지만 전체 series, 전체 심볼, 원문 또는 field-level time 중 하나가 검증되지 않았다.
- `BLOCKED`: 직접 원천·권리·키·입력 부족으로 대조할 수 없거나 값이 존재하지 않는다.
- `NOT_APPLICABLE`: 정적 교육문, 사용자 입력 전 포트폴리오처럼 자동 원천 대조 대상이 아니다.

대조 대상은 로컬 `v53.9`의 `public-data/data.json`, `history.json`, `screener.json`, `telegram-digest.json`, 배포본 `v53.7`의 14개 사용자 페이지, 그리고 원천/공식 공개 페이지다. 배포본과 로컬본의 revision 차이 때문에 live UI 결과를 로컬 코드 완료 증거로 승격하지 않는다.

### 12.2 확인된 정확 일치와 불일치

| 데이터 | 로컬 artifact | 외부 원천 | 판정 |
|---|---|---|---|
| S&P 500 | `history` 7,457.69 | AP 2026-07-17 종가 7,457.69 | 값 MATCH; artifact 행 날짜 7/18은 불일치 |
| Nasdaq Composite | 25,520.24 | AP 2026-07-17 종가 25,520.24 | 값 MATCH; 공통 행 날짜는 불일치 |
| Dow | 52,146.42 | FRED/AP 2026-07-17 종가 52,146.42 | 값 MATCH; 공통 행 날짜는 불일치 |
| Russell 2000 | 2,962.22 | AP 2026-07-17 종가 2,962.22 | 값 MATCH; 공통 행 날짜는 불일치 |
| KOSPI | 6,820.60 | 2026-07-16 종가 6,820.60; 7/17 휴장 | 값 MATCH, `history.date=2026-07-18`은 2일 오표기 |
| KOSDAQ | 791.84 | 연합뉴스 2026-07-16 종가 791.84 | 값 MATCH, 관측일 오표기 |
| VIX | 18.77 | Cboe 2026-07-17 spot 18.77 | MATCH |
| Put/Call | total 0.97, index 0.98, equity 0.73 | Cboe daily statistics 동일 | MATCH |
| Fear & Greed | 37, fear, asOf 7/17 | CNN 계열 2차 검증값 37 | 값 MATCH; CNN 원응답 재대조는 PARTIAL |
| CPI/Core CPI | 3.5% / 2.6%, 2026-06 | BLS June release 3.5% / 2.6% | MATCH |
| NFP/실업률 | +57천 / 4.2%, 2026-06 | BLS +57,000 / 4.2% | MATCH |
| PCE/Core PCE | 4.1% / 3.4%, 2026-05 | BEA May release 4.1% / 3.4% | MATCH |
| HY OAS | UI 미수신 | FRED 2026-07-16 2.71% | **BLOCKED/MISMATCH**: 원천에는 값이 있지만 현재 공개 UI 성공 경로는 미수신 |
| 10Y-2Y | runtime 혼합 경로 | FRED 2026-07-17 0.37% | PARTIAL: 직접 series와 live maturity 계산이 혼재 |
| 서버 AI 시장분석 NFP | raw 문장 `NFP 57만` | Evidence는 57천명=5.7만명 | **FAIL**: 10배 단위 오류. client semantic gate가 공개를 차단하지만 producer 품질은 실패 |

직접 확인 URL:

- 미국 지수: `https://apnews.com/article/5e44034ea86fa8d9c73184f3559e74a2`
- VIX: `https://www.cboe.com/tradable-products/vix/`
- Put/Call: `https://www.cboe.com/markets/us/options/market-statistics/daily`
- DGS10/DGS2/T10Y2Y/HY OAS: `https://fred.stlouisfed.org/series/DGS10`, `DGS2`, `T10Y2Y`, `BAMLH0A0HYM2`
- CPI·고용: `https://www.bls.gov/news.release/cpi.htm`, `https://www.bls.gov/ces/news.htm`
- PCE: `https://www.bea.gov/news/2026/personal-income-and-outlays-may-2026`
- KOSDAQ: `https://www.yna.co.kr/amp/view/AKR20260716150800008`

### 12.3 22개 영역 판정표

| # | 영역 | 대조 상태 | 직접 확인 결과와 남은 공백 |
|---:|---|---|---|
| 1 | 미국·글로벌 주요지수 | PARTIAL | 미국 4지수 마지막 값 일치. 행 날짜가 수집일로 덮여 field observedAt 부재; 나머지 글로벌 지수 미대조 |
| 2 | 미국 개별주식·ETF | BLOCKED | 수집은 77/77 성공했으나 public quotes=[]; 전체 종목 원천 1:1 미수행 |
| 3 | 한국 지수 | PARTIAL | KOSPI/KOSDAQ 값 일치, 7/16 관측값이 7/18 행에 저장됨 |
| 4 | 환율 | PARTIAL | live/history 경로 존재, instrument·session·원천별 마지막 값 미대조 |
| 5 | 국채·금리 | PARTIAL | FRED 원천 spot check 완료; UI는 Yahoo/FRED/snapshot 우선순위가 혼합됨 |
| 6 | 원자재 | PARTIAL | WTI/Gold history 값은 있으나 settlement/spot 계약과 원천 1:1 미완료 |
| 7 | 암호화폐 | PARTIAL | CoinGecko live 수신 확인, 24/7 값에 field observedAt 없는 history 구조 |
| 8 | Fear & Greed | PARTIAL | 값 37 일치; CNN 원응답과 구성요소 전체 대조 미완료 |
| 9 | VIX·VVIX·기간구조 | PARTIAL | VIX 18.77 일치; VVIX와 만기별 기간구조 전체 point 미대조 |
| 10 | Put/Call | MATCH | Cboe 세 비율 값·asOf 일치 |
| 11 | AAII·NAAIM·II 설문 | BLOCKED | current licensed 수치 artifact 없음; 정확값 합성 금지 |
| 12 | 시장폭 | PARTIAL | AIO universe snapshot 97%대 coverage 확인; 일별 history·McClellan A/D 없음 |
| 13 | FRED 거시 | PARTIAL | artifact fetch 구조·일부 series 원천 일치; 모든 25 series 전구간 point 대조 미완료 |
| 14 | BLS·BEA·ISM | PARTIAL | CPI/Core/NFP/실업/PCE/Core PCE 일치; ISM 직접값 없음 |
| 15 | Fed·글로벌 중앙은행 | PARTIAL | 공식 reference 구조는 있으나 이번 실행에서 모든 은행 current statement 1:1 미대조 |
| 16 | BOK·KOSIS·한국 거시 | PARTIAL | 공식/수동 reference 혼합; ECOS/KOSIS server adapter 미완성 |
| 17 | 한국 수급·VKOSPI | BLOCKED | 현재 UI/API 성공 근거 없음; VKOSPI는 UNAVAILABLE 유지 |
| 18 | OHLCV·기술지표·RRG | PARTIAL | SPY 90일 차트 렌더 확인; 200일 Weinstein·RRG 20일+ 성공 경로와 전 point 원천 대조 미완료 |
| 19 | 시장 뉴스·이벤트 | PARTIAL | server 40건/8 source 및 라이브 렌더 확인; 40건 원문·번역 전수 대조 미완료 |
| 20 | Telegram·리서치 | PARTIAL | observed 573, top 45, broad 360 확인; 각 게시물 원문·권리 전수 대조 미완료 |
| 21 | 기업 펀더멘털·공시 | PARTIAL | SEC 93/655=14.2%; 전체 filing 1:1 및 80% gate 미달 |
| 22 | 전술점수·AI 해설 | **FAIL** | raw AI NFP 단위 10배 오류 발견. 공개 sink는 차단되지만 producer→claim parity는 실패 |

### 12.4 페이지 텍스트·차트와 연결된 실행 요구사항

1. `briefing/home/signal`의 현재형 문장에는 숫자별 `evidenceId`, `unit`, `observedAt`을 강제한다.
2. `breadth/sentiment/technical/themes`는 “canvas 존재”가 아니라 series coverage와 마지막 원천 point가 있어야 통과한다.
3. `macro/fxbond`는 Yahoo 금리 quote와 FRED 공식 close를 동일 metric에 조용히 혼합하지 않고 instrument를 분리한다.
4. `fundamental`은 기업 설명·가격 포지션·재무 series 각각의 성공/결측을 독립 표시한다.
5. `portfolio/guide/screener/news`처럼 차트가 없거나 사용자 입력 의존인 페이지는 `NOT_APPLICABLE`을 실패와 구분한다.
6. `theme-detail/ticker/options` 조건부 성공 상태는 fixture와 provider mock으로 재현한 뒤 live key/provider 환경에서 별도 인증한다.

### 12.5 새 이진 게이트

| ID | Yes 조건 |
|---|---|
| QG-09 Field time | history/market snapshot의 Tier 0/1 값 100%가 수집일이 아닌 실제 `observedAt`과 session을 가짐 |
| QG-10 Source reconciliation | 원천 마지막 값과 artifact/UI 마지막 값의 값·단위·시각이 tolerance 계약 안에서 일치 |
| QG-11 Narrative claim | 현재형 텍스트 숫자 100%가 Evidence ID로 역추적되고 단위 변환 fixture를 통과 |
| QG-12 Raw/public parity | raw AI producer와 public renderer 양쪽이 같은 typed-claim gate를 통과; client 차단만으로 PASS 금지 |
| QG-13 Series completeness | 차트별 expected cadence 대비 결측 구간·coverage·lastPoint를 기록하고 임계 미달 시 렌더 보류 |
| QG-14 Route coverage | 14 사용자 페이지와 3 조건부 route의 required producer/text/chart 상태가 모두 기록됨 |

이번 1:1 대조의 최종 판정은 `PARTIAL/FAIL`이다. 대표 핵심값은 다수 일치했지만 field-level 시간 오표기, HY OAS 전달 공백, 여러 시계열 미검증, raw AI NFP 단위 오류가 있어 “전수 1:1 대조 완료” 또는 “자동 최신화 보장”으로 승격할 수 없다.

## 13. 2026-07-19 실행 보정 및 현재 상태 (v53.14 / P735)

이 문서의 과거 §12 표는 v53.11 시점의 1:1 대조 기록이다. 이후 이번 실행에서 다음 변경을 실제 코드·산출물·CI 계약으로 반영했다.

| 항목 | 현재 실행 결과 | 판정 |
|---|---|---|
| Batch 0 history field time | `history.json` 369행, numeric field 3,535/3,535가 `observedAt/fetchedAt/lastSuccessfulAt/source/sourceKind/allowedUse` 보유. 휴장일 값은 `carried-forward/reference-only`로 명시 | PASS |
| Batch 0 LKG | FRED 키/series 실패 시 이전 macro 값과 관측일을 보존하고 `fredHasKey/fredFetchOk/fredLkgUsed`를 분리 | PASS |
| Batch 0 Tier 0 | canonical market snapshot 16/16, incomplete fixture fail-closed | PASS |
| Batch 2 HY OAS | FRED `BAMLH0A0HYM2` durable artifact → `window._hySpreadBp`/`DATA_SNAPSHOT.hySpread` server UI path 연결. provider rights/direct freshness는 별도 | PARTIAL |
| Batch 3 AI | NFP `thousands` context와 10x semantic fixture를 추가. 검증 실패 문장은 publish하지 않으며 현재 local key 없음은 `marketAnalysisSemanticOk=false` | PASS (local) |
| 22-category reconciliation | MATCH 3 / PARTIAL 14 / BLOCKED 5 | PARTIAL |
| Fast plane / SLO | Cloudflare endpoint/resource/credentials 없음, observed soak 0/7일 | OPERATOR_REQUIRED |

재현 게이트: `node scripts/ci-history-field-time-contract-check.mjs`, `ci-static-data-contract-check.mjs`, `ci-market-snapshot-contract-check.mjs`, `ci-data-lineage-audit.mjs`, `ci-data-pipeline-contract-check.mjs`, `ci-operations-status-check.mjs`, `ci-reconciliation-contract-check.mjs`는 현재 체크아웃에서 PASS한다. 외부 권한 없는 실행은 quote coverage를 fail-closed하고 기존 LKG를 보존했으며, 승인된 외부 연결 실행은 78/78 quote와 1년 history backfill을 완료했다.

따라서 현재 전체 AR-07 acceptance는 `PARTIAL`이다. Cloudflare Fast plane 7-day 99% soak, Yahoo/FRED/SEC/한국 데이터 provider rights, AAII/NAAIM/II·VKOSPI·공식 breadth history 등은 운영자 결정/외부 권한 없이 완료로 보고하지 않는다.
