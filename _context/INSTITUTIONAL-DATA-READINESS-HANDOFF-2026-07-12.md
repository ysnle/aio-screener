---
verified_by: Codex (data/source audit + v52.67 AI/data dependency re-audit)
last_verified: 2026-07-13
confidence: high
target_version: version.json
audit_baseline: v52.67-local / live not revalidated in 2026-07-13 pass
status: execution-handoff; design complete, implementation and live certification incomplete
scope: data sources, per-page coverage, semantic correctness, public/institutional readiness
---

# AIO Screener 기관급 데이터·콘텐츠 운영 준비도 핸드오프

이 문서는 2026-07-12 세션에서 확인한 데이터 수집, 정규화, 파생지표, 시장 국면, 페이지 결론, 행동 안내, AI 컨텍스트, 배포·감시 구조의 문제를 후속 에이전트가 바로 구현할 수 있도록 정리한 실행 원장이다.

이 문서는 코드 수정 완료 보고서가 아니다. 현재 상태를 과대평가하지 않기 위한 진단과 작업 계약이다.

## 0. 결론과 공개 판정

### 판정

- 로컬 UI·런타임·회귀 QA: 강함.
- 데이터 자동화 골격: 강함.
- 모든 페이지의 핵심 데이터 완전성: 미달.
- 관측시각·단위·의미 보존: 중대한 결함 존재.
- 자동 생성 시장 해설: 실제 공개 데이터에서 의미 오류 확인.
- Trading Score/Factor의 경제적 효능: 부분 검증이며 기관급 주장 불가.
- 외부 공개: 교육·연구용 제한 베타는 P0 해소 후 가능.
- 실제 매매 판단용 기관급 공개: 현재 `NO-GO`.

### 기관급과 현재 상태의 차이

기관급 시스템은 단순히 데이터가 많이 보이는 시스템이 아니다. 최소한 다음을 동시에 만족해야 한다.

1. 계약 또는 공식 원천에서 데이터를 받는다.
2. `observedAt`, `publishedAt`, `fetchedAt`을 분리한다.
3. 단위·스케일·시장 세션·수정 여부를 보존한다.
4. 값마다 원천과 변환식을 추적할 수 있다.
5. 결측·지연·충돌 시 강한 결론과 행동을 차단한다.
6. 자동 해설의 숫자·단위·라벨을 결정적으로 검증한다.
7. 전략·팩터는 PIT/OOS/비용/생존편향 검증을 통과한다.
8. 데이터 사용·재배포 권리와 운영 SLA가 명확하다.
9. 장애를 자동 탐지하고 사람에게 알리며 복구 이력을 남긴다.

현재 AIO는 4·5·9의 상당 부분과 UI QA는 강하지만 1·2·3·6·7·8이 부족하다.

---

## 1. 이번 세션에서 직접 검증한 사실

### 1.1 로컬과 라이브 상태

| 항목 | 결과 |
|---|---|
| 로컬 버전 | v52.62, 리디자인 미커밋 상태 |
| 공개 버전 | v52.61 |
| 라이브 invariant | PASS |
| 라이브 `data.json` 확인 | 2026-07-12T07:16:46Z 생성, quote 77/77 |
| 라이브 FRED | key 있음, fetch 성공, failed series 0 |
| 라이브 뉴스 | 38건, Google News 검색 피드 8종 |
| 라이브 F&G | 49, source CNN, asOf 2026-07-10T23:59:47Z |
| 라이브 스크리너 | 870 universe, 846 price-factor 성공 |
| 라이브 FMP | key 있음, plan error, fundamental enrichment 0건 |

### 1.2 실행한 QA

| 검사 | 결과 |
|---|---|
| version contract | PASS |
| structural contract | PASS |
| runtime contract | PASS |
| data-pipeline contract | PASS |
| workflow compaction | PASS |
| knowledge lint | PASS |
| AIO headless tests | 992/992 PASS |
| viewport FULL_INIT | 22 routes × 4 viewports = 88/88 PASS |
| viewport 결과 | overflow 0, tiny text 0, JS error 0 |
| accessibility matrix | 22/22 PASS, console error 0 |
| Critical-10 human surface | 10/10 PASS, console error 0 |

이 결과는 구조·렌더·계약 회귀를 증명하지만 데이터의 경제적 의미와 자동 해설 정확성을 증명하지 않는다.

---

## 2. P0/P1/P2 이슈 등록부

### P0-01. 자동 시장 해설이 원천 지표명과 단위를 바꿔 배포됨

실제 공개 `data.json.marketAnalysis.full`에서 다음 오류를 확인했다.

- F&G 49를 `VIX 49`로 표현했다. 실제 quote의 VIX는 약 15였다.
- FRED `PAYEMS` 월간 차이 57천 명을 `NFP 57만 명`으로 표현했다.
- `marketAnalysisOk:true`는 생성 성공만 뜻하며 숫자·단위·라벨 정합성을 검증하지 않는다.
- 이 문장은 `#home-market-analysis`에 직접 주입된다.

근본 원인:

- `scripts/fetch-data.mjs::genMarketAnalysis()`가 원천 값을 평문 prompt에 넣는다.
- 출력 후 구조화 파싱이나 숫자 provenance 검증이 없다.
- LLM이 숫자를 다른 지표에 붙이거나 단위를 변환해도 차단되지 않는다.
- 서버 marketAnalysis 경로는 typed evidence bundle과 canonical metric gate를 우회한다.

필수 개선:

1. LLM 입력을 typed JSON evidence로 바꾼다.
2. LLM 출력도 JSON schema로 제한한다.
3. 문장별 `evidenceIds[]`를 요구한다.
4. 출력의 모든 숫자를 입력 evidence에서 역조회한다.
5. 단위 변환은 registry에 선언된 변환만 허용한다.
6. 라벨-숫자 조합이 다르면 결과 전체를 폐기한다.
7. 검증 실패 시 결정론적 템플릿만 표시한다.
8. `marketAnalysisOk`를 `generated/validated/published`로 분리한다.

완료 게이트:

- `F&G 49`가 `VIX 49`로 변형된 fixture는 반드시 FAIL.
- `NFP 57 thousand`가 `570,000` 또는 `57만`으로 변형되면 FAIL.
- 입력에 없는 숫자가 출력되면 FAIL.
- reference-only evidence를 current action claim에 사용하면 FAIL.
- validator PASS가 아니면 `data-market-analysis-sink`에 주입 금지.

### P0-02. quote의 관측시각이 없고 수신시각이 현재성으로 승격됨

서버 `public-data/data.json.quotes[]`에는 다음이 없다.

- `observedAt`
- `regularMarketTime`
- `marketState`
- exchange timezone
- delayed flag

`applyLiveQuotes()`가 이 quote를 `PriceStore.set()`에 넣으면 `Date.now()`가 quote의 `ts`가 된다. 주말에 금요일 종가를 다시 받아도 일요일에 갱신된 live quote처럼 보일 수 있다.

근본 원인:

- `fetchedAt`과 `observedAt`이 동일 필드로 취급된다.
- Yahoo chart meta의 `regularMarketTime`, `exchangeTimezoneName`, `marketState`를 버린다.
- fresh 판정이 원천 관측시각이 아니라 브라우저 수신시각을 사용한다.

필수 개선:

- canonical quote schema를 도입한다.

```text
QuoteEvidence {
  evidenceId,
  symbol,
  value,
  previousClose,
  changePct,
  currency,
  venue,
  marketSession,
  observedAt,
  publishedAt,
  fetchedAt,
  delayedByMs,
  source,
  sourceTier,
  crossChecks,
  status,
  allowedUse
}
```

- `PriceStore.set()`은 timestamp와 market-state를 필수로 받는다.
- timestamp 없는 서버 quote는 `reference-only` 또는 `unverified-time`으로 낮춘다.
- 장 마감·주말·휴장일에는 `마지막 거래일 종가`로 표시한다.
- `live`라는 문자열은 시장 세션과 observation age가 모두 유효할 때만 허용한다.

완료 게이트:

- 일요일에 금요일 quote를 수신한 fixture가 `verified_current/live`가 되면 FAIL.
- `observedAt` 없는 quote가 `decisionUse:true`이면 FAIL.
- market closed 상태에서 `실시간` 문구가 노출되면 FAIL.

### P0-03. 경제적 효능이 검증되지 않은 점수와 랭킹이 행동 문구에 연결됨

Trading Score 축소 백테스트:

- 21일 forward rho -0.165.
- 63일 forward rho -0.255.
- 최근 holdout 21일 rho -0.184.
- 전체 점수의 약 55%만 검증.
- 비용·슬리피지·capacity 미반영.

Factor 축소 백테스트:

- 21일 composite IC 약 0.
- low-vol 평균 IC -0.048, 최근 holdout -0.119.
- 7개 중 4개 팩터만 검증.
- survivorship bias, delisted, PIT universe 미해결.
- regime adaptive weight 미검증.

필수 개선:

- 공개 UI에서 `experimental / unvalidated` 표시.
- 검증 전 점수는 포지션 크기·주문·매수/매도 강도와 직접 연결하지 않는다.
- 전략 변경은 연구 artifact와 production rule 변경을 분리한다.
- PIT/OOS/비용/turnover/calibration gate 완료 전 기관급 성과 주장을 금지한다.

### P0-04. 외부 공개용 데이터 사용·재배포 권리가 확정되지 않음

현재 핵심 가격은 Yahoo/Naver/Cboe 공개 endpoint와 공개 CORS proxy에 의존한다. 외부 공개·상업화·기관 사용자 제공 시 원천 제공자의 약관과 거래소 데이터 권리를 별도 검토해야 한다.

필수 개선:

- source별 `licenseClass`, `redistributionAllowed`, `attribution`, `commercialUse`, `publicDisplay`, `nonDisplayUse` registry 작성.
- 권리가 불명확한 source는 public build에서 제외하거나 계약형 vendor로 교체.
- 법률 검토 전 `기관급`, `실시간`, `트레이딩용` 마케팅 문구 금지.

### P1-01. DataLineage audit가 gap/manual을 가진 채 `ok`를 반환함

현재 13개 카테고리:

- connected 11.
- breadth gap 1.
- staticMacro manual 1.
- broken 0이면 전체 status가 `ok`가 될 수 있다.

필수 개선:

- `structuralStatus`와 `publicTradingReadiness`를 분리한다.
- `gap/manual` 데이터가 trading-core/current claim에 사용되면 PUBLIC gate FAIL.
- 교육·아카이브 reference-only에서만 manual을 허용한다.

### P1-02. 모든 페이지 계약은 있지만 의미 완전성 검증은 Critical-10 중심

- 22개 route contract는 존재한다.
- element-level 강한 lineage 검사는 주로 Critical-10에 집중된다.
- `companyFundamentals`, `filings`, `themeRanking`, `portfolioRisk`, `optionsSnapshot`, `krMacro` 같은 가상 task는 실제 scheduler task로 축약된다.
- 따라서 계약이 있다고 해서 해당 고유 데이터가 자동 수집된다는 뜻은 아니다.

필수 개선:

- 22페이지 각각에 `requiredEvidence[]`, `optionalEvidence[]`, `forbiddenFallbacks[]`를 선언한다.
- virtual task를 base task로 접는 compatibility layer를 폐기하거나 `derivedFrom`을 명시한다.
- 페이지마다 필수 evidence의 실제 producer 함수·artifact·last success를 검증한다.

### P1-03. FRED는 per-series asOf를 받지만 화면 field timestamp가 fetch 생성시각으로 평탄화됨

- 서버는 `_asOf_cpi`, `_asOf_pce`, `_asOf_nfp` 등을 보존한다.
- 브라우저 주입 시 `DATA_SNAPSHOT._fieldTs.macro_fred`를 `data.meta.generatedAt`으로 기록한다.
- 발표월과 fetch 시각이 섞일 수 있다.

필수 개선:

- 각 macro metric에 observation period와 release timestamp를 개별 저장한다.
- FRED 현재값 백테스트는 vintage 문제를 명시하고 PIT 연구에는 ALFRED 또는 자체 vintage snapshot 사용.

### P1-04. FMP 플랜 오류 상태에서도 스크리너는 부분 결과를 정상처럼 소비할 수 있음

- 라이브 FMP key는 존재하지만 ratios endpoint plan error.
- value/quality/fundamental enrichment는 0건.
- price factors 846종목은 생성되므로 화면이 풍부해 보여 결측이 숨기 쉽다.

필수 개선:

- factor별 availability mask 노출.
- value/quality가 없으면 composite에서 중립 대입하지 말고 모델 버전을 `price-only`로 명시.
- 유료 플랜을 쓰지 않을 경우 SEC XBRL 기반 fundamental pipeline으로 교체.

### P1-05. 스크리너 전 종목 데이터는 6시간 cadence이며 명목 실시간이 아님

- 77개 핵심 symbol quote는 명목 30분 서버 갱신과 3분 client refresh.
- 870종목 screener price factor는 6시간 이내면 재계산을 skip한다.
- 스크리너에 `실시간 랭킹` 표현을 사용하려면 부적합하다.

필수 개선:

- EOD/6h/intraday ranking을 명확히 구분.
- 1년 factor는 EOD 기준으로 고정하고 intraday quote overlay를 별도 표시.
- factor timestamp와 quote timestamp를 혼합하지 않는다.

### P1-06. Breadth 페이지가 실제 전 시장 breadth를 수집하지 않음

- `% above 20/50/200MA`, advance-decline, new highs/lows, up/down volume의 완전한 공식 feed가 없다.
- 현재는 ETF 상대강도·top gainers/losers·정적 seed 근사 경로가 존재한다.

필수 개선:

- 정의된 universe의 전 종목 EOD OHLCV를 서버에서 계산하거나 계약형 breadth feed 사용.
- index constituent PIT와 delisted 처리를 명시.
- proxy는 이름부터 `proxy`로 표시하고 같은 단위의 실제 breadth처럼 보여주지 않는다.

### P1-07. Sentiment 페이지의 핵심 일부가 수동/스냅샷

- 자동: VIX/VVIX/term structure 일부, CNN F&G, Cboe Put/Call, HY OAS.
- 수동 또는 약함: AAII, NAAIM, Investor Intelligence, SKEW/MOVE 일부, GEX/dealer gamma.

필수 개선:

- 각 카드 상단에 `current / delayed / weekly / manual / proxy`를 강제.
- 서로 다른 발표주기의 지표를 같은 현재성 합성점수로 더하지 않는다.
- 실시간 옵션 position 데이터 없이 dealer gamma를 단정하지 않는다.

### P1-08. Options 페이지는 실시간 options analytics가 아님

- 실시간 option chain, OI, IV surface, Greeks, flow, GEX가 연결되지 않았다.
- 코드와 UI도 reference-only임을 일부 인정하고 nav에서 제거했다.

조치 선택:

- 계약형 options feed 확보 전 페이지를 완전 제거하거나 `옵션 교육·참고`로 고정.
- 실전 옵션 분석 페이지로 복원하려면 chain snapshot time, NBBO, OI date, IV model, rates/dividend assumptions, corporate actions를 함께 관리.

### P1-09. 뉴스는 넓지만 authoritative event feed가 약함

- 서버 핵심 뉴스 8개는 모두 Google News 검색 RSS이다.
- client에는 다수 RSS/Telegram source가 있으나 CORS proxy와 mirror 의존도가 높다.
- 제목 기반 scoring이 중심이고 원문 사건 entity, duplicate story cluster, correction/retraction, filing linkage가 약하다.

필수 개선:

- SEC filing, Fed/BLS/BEA/BOK/KRX/DART 공식 release를 1순위 event feed로 분리.
- 언론 RSS는 2차 해설로 취급.
- 동일 사건 기사 clustering, 원출처 우선, 정정기사 반영, publish/event/ingest time 분리.

### P1-10. 공개 CORS proxy가 데이터 파이프라인 신뢰경계에 포함됨

- corsproxy.io, allorigins, codetabs, rss2json, RSSHub mirrors 등을 사용한다.
- 무결성, 지속성, 응답 변조, 개인정보/키 노출 위험을 계약으로 통제할 수 없다.

필수 개선:

- public proxy는 reference-only 콘텐츠에만 허용.
- trading/core 데이터는 자체 Worker 또는 server pipeline만 사용.
- upstream host allowlist, response schema/hash, size cap, content-type 검증, provenance 기록.

### P2-01. Single Evidence Store는 감사 projection이지 모든 producer의 강제 write path가 아님

- PriceStore, DATA_SNAPSHOT, globals, public-data, DOM attributes가 병존한다.
- buildEvidenceStore는 이들을 모아 감사하지만 모든 producer가 typed evidence를 쓰도록 강제하지 않는다.

목표:

`Source Adapter → Typed Evidence Store → Derived Evidence → Decision → UI/AI projection`

기존 전역·snapshot 직접 쓰기를 점진적으로 제거하고 adapter를 강제한다.

### P2-02. 성과·오류 관측이 규칙 후보를 만들지만 자동 승격되지는 않음

현재 postmortem→RULES→QA→CI 구조는 강하다. 다만 성과 저하가 자동으로 production threshold를 바꾸면 과적합 위험이 크므로 다음 구조가 적절하다.

`성과 관측 → drift alert → 변경 후보 → 연구 artifact → human approval → shadow test → production`

자동 threshold 변경은 금지한다.

---

## 3. 현재 데이터 원천과 출처 인벤토리

### 3.1 서버 자동 수집

| 데이터 | 현재 원천 | 방식 | 현재성/한계 | 공개 위험 |
|---|---|---|---|---|
| US/KR 지수·ETF·주식·금리 proxy·원자재 | Yahoo chart query1/query2 | GitHub Actions, 핵심 77 symbol | source observation time 제거, 약관/SLA 없음 | 높음 |
| Yahoo 실패 ETF fallback | Twelve Data | key가 있을 때 일부 ETF | 라이브 key 미설정 | 중간 |
| 미국 매크로 | FRED API | CPI/core/PCE/Fed/UNRATE/PAYEMS/HOUST/RSAFS/wage | revised data, release time와 fetch time 구분 필요 | 중간 |
| F&G | CNN dataviz 비공식 endpoint | server fetch | 비공식 endpoint, 2026-07-12 기준 1일+ 지연 | 중간 |
| 핵심 뉴스 | Google News RSS search 8개 | 제목·source·topic scoring | 검색 결과, 원문/정정/사건 식별 부족 | 중간 |
| 시장 해설 | Anthropic | Haiku/Sonnet 선택 생성 | 의미 validator 없음 | 매우 높음 |
| 전 종목 팩터 | Yahoo 1년 OHLCV | 6시간 cadence, 870 universe | 846 성공, PIT/상폐/비용 미해결 | 높음 |
| value/quality/growth | FMP | ratios/growth/surprise | 현재 plan error, 0건 | 높음 |
| Telegram digest | t.me public preview | 14일 수집, 3 channels | 비공식/정성 secondary source | 중간 |

### 3.2 브라우저/온디맨드 수집

| 데이터 | 현재 원천 | 비고 |
|---|---|---|
| 실시간 시세 보강 | Yahoo, Naver, Finnhub, FMP, Stooq, CoinGecko | source별 시각·라이선스 수준 불균일 |
| KR 지수·종목·수급 | Naver 모바일/주식 API, polling, sise/fchart | 비공식 endpoint, 계약/SLA 없음 |
| 환율 | open.er-api, exchangerate-api, jsdelivr currency API | cross-check는 있으나 trading-grade 아님 |
| crypto | CoinGecko | last_updated_at 일부 제공 |
| Put/Call | Cboe public options volume JSON | options volume이지 full chain 아님 |
| HY spread | FRED CSV BAMLH0A0HYM2 | 6시간 cadence |
| 기업 공시 | SEC submissions/EDGAR | CORS 때문에 proxy 사용, on-demand |
| 기업 재무·segments·earnings | FMP/Naver | key·plan 의존, 전체 universe 자동 아님 |
| insider/news | Finnhub | 사용자 key 의존 |
| 기업 소개 | Wikipedia | 정성 참고 |
| 뉴스 | RSS, Google News, Telegram, RSSHub mirrors | 다수 source이나 authoritative event feed와 혼재 |

### 3.3 신뢰도 분류

| Tier | 의미 | 현재 예 |
|---|---|---|
| A | 공식 통계·공시 API | SEC, FRED, BLS/BEA 후보, DART/KRX/ECOS/KOSIS 후보 |
| B | 계약형 시장 데이터 vendor | 현재 핵심 경로에는 사실상 없음 |
| C | 공개 정보 서비스/API | Yahoo, Naver, CNN, Google News, CoinGecko |
| D | public proxy·mirror·Telegram·수동 snapshot | allorigins, corsproxy, RSSHub mirror, t.me |

Trading decision은 A/B 중심이어야 하며 C는 교차검증, D는 reference-only로 제한한다.

---

## 4. 22페이지별 필수 데이터와 현재 커버리지

상태 정의:

- `AUTO`: 원천→scheduler→transform→render 연결.
- `PARTIAL`: 일부 핵심만 자동, 나머지 수동/프록시/결측.
- `ON_DEMAND`: 사용자 입력 후 수집.
- `REFERENCE`: 교육·스냅샷 전용.
- `NO-GO`: 현재 상태로 실전 페이지 주장 불가.

| 페이지 | 반드시 필요한 핵심 데이터 | 현재 상태 | 빠진 것/약한 것 | 공개 판정 |
|---|---|---|---|---|
| home | 주요 지수, VIX, 금리, 달러, 유가, breadth, 뉴스, 국면 | PARTIAL | true observation time, 실제 breadth, 검증된 AI 해설 | NO-GO P0 |
| signal | trend, momentum, vol, breadth, credit, sentiment, event risk | PARTIAL | 전체 점수 효능, AAII/NAAIM currentness, 실제 breadth | experimental only |
| breadth | A/D, up/down volume, new high/low, % above MA, equal-weight | PARTIAL | 실제 universe breadth 대부분 | NO-GO |
| sentiment | VIX curve, F&G, P/C, AAII, NAAIM, credit, positioning | PARTIAL | AAII/NAAIM/II/SKEW/MOVE/GEX current data | reference-heavy |
| briefing | verified current evidence, official events, news clusters | PARTIAL | LLM semantic validator, source event linkage | NO-GO P0 |
| market-news | market-moving official events, filings, corrections, clusters | AUTO/PARTIAL | official-first event feed, dedupe/retraction/entity graph | beta |
| technical | adjusted OHLCV, volume, corp actions, indicators, benchmark | AUTO/PARTIAL | intraday bars/SLA, corporate-action audit, source timestamp | beta |
| screener | full universe PIT, adjusted price, fundamentals, liquidity, costs | PARTIAL | FMP 0, PIT/delisted, turnover/cost, 6h cadence disclosure | experimental |
| ticker | current quote, OHLCV, filings, earnings, news, estimates | ON_DEMAND | deterministic source completeness, analyst revisions, options/short data | beta with warnings |
| portfolio | user positions, current prices, beta/corr/vol/drawdown, FX | AUTO/PARTIAL | tax lots, dividends, cash, benchmark PIT, scenario shocks | personal tool |
| themes | constituent map, ETF/stock returns, flows, breadth, news, valuation | PARTIAL | dynamic constituent updates, ETF flows, theme-level fundamentals | beta |
| theme-detail | constituent-level factor/earnings/news/breadth | PARTIAL | full constituent auto collection, source-owned taxonomy | beta |
| macro | CPI/PCE/jobs/GDP/PMI/retail/housing/rates/liquidity/calendar | PARTIAL | direct BLS/BEA, vintage, PMI, Fed balance sheet/TGA/RRP/reserves | beta/reference |
| fxbond | yield curve, real yields, breakevens, credit OAS, FX, auctions | PARTIAL | Treasury auctions, SOFR/repo, real yield/breakeven full set, COT | beta |
| fundamental | XBRL financials, segments, guidance, estimates, valuation | ON_DEMAND/PARTIAL | FMP plan, SEC XBRL auto pipeline, estimate revisions | NO-GO as full coverage |
| options | chain, NBBO, OI, IV surface, Greeks, gamma, flow | REFERENCE | 대부분 전부 | remove/education |
| kr-home | KOSPI/KOSDAQ, FX, investor flow, breadth, policy/events | PARTIAL | official KRX feed, market breadth, short/credit balance | beta |
| kr-supply | investor type flow, program, futures/options, short selling | PARTIAL | official KRX, program/arbitrage, lending/short balance | beta/reference |
| kr-themes | constituents, returns, flows, disclosures, earnings | PARTIAL | official constituent/sector DB, DART events, dynamic taxonomy | beta |
| kr-macro | BOK rate, ECOS, KOSIS, exports, FX reserves, trade, housing | PARTIAL | ECOS/KOSIS server automation, per-series asOf | beta/reference |
| kr-technical | adjusted KRX OHLCV, volume, investor flow, corp actions | PARTIAL | official adjusted history, corp-action normalization | beta |
| guide | 교육 콘텐츠와 최신 사용법 | REFERENCE | 데이터 수집 불필요, 문서 최신성만 필요 | ready |

---

## 5. 현재 시장 상황 파악을 위해 추가로 필요한 데이터

### 5.1 무료·공식 원천으로 우선 보강 가능한 항목

| 중요 데이터 | 왜 필요한가 | 권장 공식 원천 | 대상 페이지 | 우선순위 |
|---|---|---|---|---|
| 미국 CPI/PPI/고용 원발표 | FRED 재가공·수정과 release event 분리 | BLS Public Data API | macro, briefing | P1 |
| GDP/PCE/기업이익 원발표 | 성장·인플레 국면 | BEA API | macro, briefing | P1 |
| SEC XBRL companyfacts | FMP 없이 재무·성장·quality 계산 | SEC data API/bulk ZIP | fundamental, screener, ticker | P0/P1 |
| 실시간/최신 SEC filings | 8-K, 10-Q/K, Form 4, 13D/G, 13F | SEC submissions/RSS/bulk | ticker, fundamental, news | P1 |
| Treasury auction | 금리 공급 충격·tail·bid-to-cover | Treasury FiscalData | fxbond, macro | P1 |
| SOFR/repo/RRP | 자금시장·유동성 스트레스 | New York Fed Markets Data API | macro, fxbond, signal | P1 |
| CFTC COT | 채권·달러·원유·금·지수 positioning | CFTC PRE API | fxbond, sentiment, themes | P1 |
| FINRA short interest | 종목 crowded short·squeeze 위험 | FINRA Equity API/files | ticker, screener | P1 |
| FINRA short volume | 단기 flow 보조 | FINRA files/API, 한계 명시 | ticker | P2 |
| KRX 종가·시장 통계 | Naver 비공식 경로 대체 | KRX Open API/Data Marketplace | KR 전체 | P0/P1 |
| DART 공시·재무·지분 | 한국 기업 공식 fundamentals/event | OpenDART | KR themes/ticker/fundamental | P1 |
| 한국 거시·금융 | 금리·통화·신용·국제수지 | BOK ECOS | kr-macro, briefing | P1 |
| 한국 CPI/산업/고용 | 국내 경기 국면 | KOSIS Open API | kr-macro | P1 |

공식 문서:

- SEC EDGAR APIs: https://www.sec.gov/search-filings/edgar-application-programming-interfaces
- BLS API: https://www.bls.gov/developers/
- BEA API: https://apps.bea.gov/api/
- Treasury FiscalData: https://fiscaldata.treasury.gov/
- CFTC COT: https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm
- FINRA Short Interest: https://www.finra.org/finra-data/browse-catalog/equity-short-interest
- New York Fed Markets Data: https://www.newyorkfed.org/markets
- KRX Open API: https://openapi.krx.co.kr/
- OpenDART: https://opendart.fss.or.kr/
- BOK ECOS: https://ecos.bok.or.kr/api/
- KOSIS Open API: https://kosis.kr/openapi/

### 5.2 기관급 판단에 중요하지만 보통 계약형/유료가 필요한 항목

| 데이터 | 필요한 이유 | 후보 유형 | 처리 원칙 |
|---|---|---|---|
| consolidated real-time US quotes/NBBO | 정확한 실시간 가격·spread·halt | exchange/SIP licensed vendor | 계약 전 실시간 주장 금지 |
| full options chain/OI/IV surface | 옵션·gamma·dealer risk | Cboe/OPRA licensed vendor | 없으면 options 실전 페이지 제거 |
| analyst estimates/revisions | earnings revision·surprise 기대 | FactSet/LSEG/Bloomberg/Visible Alpha류 | 없으면 consensus를 정성 참고로 제한 |
| ETF daily creations/redemptions/flows | 섹터·테마 자금 흐름 | fund sponsor/vendor | 가격 수익률과 flow를 혼동 금지 |
| point-in-time constituents/delisted | survivorship-free 연구 | CRSP/Compustat/Norgate류 | 없으면 기관급 백테스트 주장 금지 |
| corporate actions master | adjusted prices·split/dividend·merger | vendor/exchange | 전 종목 factor 전제 |
| institutional ownership/holdings normalized | 13F 변화·ownership | SEC raw + normalization vendor | raw filing 지연·중복 처리 필요 |
| credit CDS/IG/HY curve | 신용 스트레스 정밀도 | ICE/Markit/Bloomberg류 | HYG ETF만으로 대체했다고 주장 금지 |
| dealer positioning/options flow | gamma/vanna/charm | specialist vendor | 모델 추정임을 명시 |

### 5.3 현재 시장 파악에서 빠진 핵심 축

현재 AIO는 가격·VIX·F&G·금리·달러·유가·뉴스 중심이다. 기관급 top-down 상황판에는 아래 축이 추가되어야 한다.

1. **유동성**: Fed balance sheet, TGA, RRP, bank reserves, SOFR/repo, dollar funding.
2. **금리 공급**: Treasury refunding/auction size, tail, bid-to-cover, indirect bidder.
3. **실질금리·기대인플레**: 5Y/10Y real yield, breakeven, inflation swap 대체 지표.
4. **신용**: IG/HY OAS term structure, default/distress ratio, bank lending conditions.
5. **시장 내부**: full A/D, up/down volume, new highs/lows, % above 20/50/200MA.
6. **포지셔닝**: CFTC COT, fund manager exposure, CTA trend proxy, short interest.
7. **수급**: ETF flows, buybacks, issuance, systematic rebalance, options expiry positioning.
8. **실적 사이클**: earnings revisions, surprise breadth, margin guidance, capex revisions.
9. **밸류에이션**: forward earnings yield, ERP, sector-relative z-score, rates-adjusted valuation.
10. **이벤트 캘린더**: official release calendar, earnings, Treasury auction, index rebalance, OPEX.
11. **리스크 이벤트**: halt, exchange status, corporate action, filing event, sanctions/export controls.
12. **한국 특화**: KRX 공식 투자자·프로그램·공매도, DART 공시, 수출 20일, ECOS 신용/통화.

모든 축을 한 번에 구현하지 말고, 현재 행동 결론에 실제로 영향을 주는지부터 검증한다.

---

## 6. 목표 아키텍처

```text
Official/Licensed Sources
        ↓
Source Adapters
  - schema validation
  - units/currency/venue normalization
  - observedAt/publishedAt/fetchedAt
  - licensing/source tier
        ↓
Typed Evidence Store (single write path)
  - immutable evidenceId
  - revisions/vintage
  - cross-source reconciliation
  - missing/delayed/conflict state
        ↓
Derived Evidence Registry
  - formula version
  - exact input evidenceIds
  - calculation timestamp
  - confidence and allowedUse
        ↓
Regime/Decision Engine
  - blocked when quorum missing
  - experimental model flag
  - action-strength ceiling
        ↓
Projection Layer
  - page/UI/chart/table
  - deterministic narrative
  - validated AI narrative
  - same evidence bundle
        ↓
Outcome Store
  - prediction/action snapshot
  - realized outcome
  - drift/calibration report
        ↓
Human-approved rule promotion
```

핵심 원칙:

- UI와 AI는 데이터를 직접 읽지 않는다.
- 모든 파생지표는 input evidence ID 목록을 가진다.
- LLM은 새로운 숫자를 만들 수 없다.
- currentness는 수신 성공이 아니라 observation age와 market session으로 판정한다.
- 모든 강한 행동 문구에는 검증된 current evidence quorum이 필요하다.

---

## 7. 후속 작업 패킷

### WP-0. 공개 위험 즉시 차단

범위:

- server marketAnalysis를 validated-only로 변경.
- validator 구현 전 deterministic template fallback.
- experimental score/factor 라벨.
- options 페이지 실전 주장 제거.

완료 기준:

- P0-01 fixture 전부 차단.
- 공개 화면에서 검증되지 않은 자동 해설 0.
- experimental output이 assertive action을 생성하지 않음.

### WP-1. Canonical Quote Evidence

범위:

- 서버 Yahoo adapter에 observation/session metadata 보존.
- PriceStore API 변경.
- weekend/closed/delayed state UI.
- quote source cross-check 시각 일치.

완료 기준:

- 77개 핵심 quote 모두 observedAt/fetchedAt/marketState 보유.
- missing timestamp decision-use 0.
- 장마감 quote의 `실시간` 오표기 0.

### WP-2. Typed Macro Evidence와 공식 원발표

범위:

- per-series asOf 보존.
- BLS/BEA release adapter.
- revision/vintage policy.
- official calendar.

완료 기준:

- CPI/PCE/NFP/GDP가 metric별 observation/release/fetch time 보유.
- 단위 registry와 sanity range.
- release 전 placeholder가 숫자를 생성하지 않음.

### WP-3. Breadth 엔진 재구축

범위:

- 명시적 universe와 adjusted OHLCV.
- A/D, up/down volume, new high/low, % above MA 계산.
- index constituent history 제약 명시.

완료 기준:

- proxy와 actual breadth의 ID·단위 분리.
- full-market breadth가 없으면 trading action 제한.

### WP-4. Fundamental/Filings 공식 파이프라인

범위:

- SEC submissions/companyfacts/bulk.
- DART disclosure/financials.
- FMP optional enrichment로 강등.

완료 기준:

- FMP 0건이어도 core financial factors 생성 가능.
- filing별 publishedAt/form/accession provenance.
- TTM/quarter/annual period mismatch 차단.

### WP-5. Official Event and News Graph

범위:

- official releases/filings 1순위.
- news clustering, source-original detection, corrections.
- event time와 article publish time 분리.

완료 기준:

- 동일 사건 중복 카드 제한.
- official source가 있으면 해당 source가 canonical.
- rumor는 action evidence 사용 금지.

### WP-6. KR 공식 데이터 전환

범위:

- KRX Open API/분배상품 정책 검토.
- DART, ECOS, KOSIS server adapter.
- Naver는 fallback/cross-check로 강등.

완료 기준:

- KR 핵심 숫자의 official source 비율 측정.
- investor flow, short, program, disclosure의 asOf 보존.

### WP-7. 연구·효능 검증

범위:

- PIT universe, delisted, corp actions.
- transaction cost/turnover.
- walk-forward, calibration, regime stability.
- shadow model과 production model 분리.

완료 기준:

- score/factor별 coverage와 unresolved bias 공개.
- 불리한 결과도 artifact에 보존.
- production 변경은 별도 승인.

### WP-8. Public/Institutional Release Gate

필수 predicate:

```text
sourceRightsKnown == true
criticalEvidenceMissing == 0
criticalObservedAtMissing == 0
criticalUnitMismatch == 0
semanticNarrativeValidationFailures == 0
assertiveActionFromReferenceOnly == 0
publicPageGapOrManualTradingUse == 0
liveBrowserOpenMarketSoakPass == true
incidentNotificationTestPass == true
```

---

## 8. 다음 에이전트 실행 순서

1. `git status --short`, `version.json`, live version을 먼저 분리한다.
2. 현재 v52.62 리디자인 변경을 보존한다.
3. WP-0만 한 패킷으로 구현한다. 다른 refactor를 섞지 않는다.
4. P0-01 실패 fixture를 먼저 작성하고 실패를 재현한다.
5. validator와 fallback을 구현한다.
6. headless/runtime/data-pipeline/full viewport를 실행한다.
7. BUG-POSTMORTEM, RULES, QA-CHECKLIST에 환류한다.
8. `bump-version.mjs`로 버전 동기화한다.
9. 사용자 승인 없이 commit/push/deploy하지 않는다.

첫 구현 권장 파일:

- `scripts/fetch-data.mjs`
- `scripts/ci-data-pipeline-contract-check.mjs`
- `js/aio-data.js`
- `js/aio-core.js`
- `js/aio-tests.js`
- `_context/BUG-POSTMORTEM.md`
- `_context/QA-CHECKLIST.md`
- `_context/RULES.md`

---

## 9. 검증 상태 경계

이 문서의 1차 작성 뒤 2026-07-12 확장 감사에서 다음 범위는 추가 검증했다.

- `public-data` 18,064개 leaf field 형식·결측·범위 검사.
- 라이브 시세 77개, 스크리너 846종목, FRED 10개, 뉴스 38개 행별 원천 대사.
- 22페이지 1024/1440 화면 44개 캡처와 수동 시각 검수.
- 22페이지 × 4 viewport FULL_INIT 88/88.
- 22페이지 접근성 자동 검사와 10페이지 first-human-surface 검사.
- 22페이지 5초 안정화 후 표시값·placeholder·evidence·상태 문구 의미 프로브.

그래도 아래는 외부·장기·사람 검증이 필요하므로 PASS로 승격하지 않는다.

- 실제 장중 수시간 이상 live soak와 장 시작/마감/조기폐장/DST 경계.
- Firefox/WebKit 및 실제 iOS/Android 저사양 기기.
- 실제 NVDA/VoiceOver/스크린리더 사용자 실사.
- 거래소·vendor 재배포 권리에 대한 법률 의견.
- 계약형 data vendor SLA·가격·entitlement 비교.
- Worker edge-region 403의 완전 제거와 실제 Worker revision parity.
- v52.62의 라이브 배포 검증. 감사 시 공개 데이터/앱 기준은 v52.61 계열이다.
- 뉴스 기사 38건의 모든 주장에 대한 원문 사실검증. 링크 도달성만 전수 확인했다.
- Yahoo 외 독립 시세 vendor와의 846종목 교차검증. 이번 수치 대사는 생산과 같은 Yahoo 계열 재현성 검사다.

---

## 10. 최종 제품 원칙

기능 수와 설명의 화려함보다 아래 순서를 우선한다.

```text
정확한 관측값
→ 검증된 단위·시각·원천
→ 재현 가능한 파생지표
→ 불확실성을 포함한 시장 국면
→ 근거가 같은 페이지 결론
→ 제한된 행동 강도
→ 숫자를 만들지 않는 AI 설명
→ 실제 결과 검증
→ 사람 승인 후 규칙 보강
```

현재 AIO의 가장 큰 자산은 이미 존재하는 page contract, evidence ID, decision block, QA gate다. 다음 단계는 새 화면을 늘리는 것이 아니라 이 구조를 모든 producer와 모든 자동 해설에 강제하는 것이다.

---

## 11. 확장 전수 감사 실행 원장

### 11.1 실제 실행 범위

| 감사 대상 | 전수 범위 | 결과 | 증거 |
|---|---:|---|---|
| `data.json` | 1,145 leaf | null/non-finite 0 | `_artifacts/institutional-data-field-audit.json` |
| `screener.json` | 13,769 leaf, 846종목 | null 4, non-finite 0 | 같은 파일 |
| `history.json` | 3,150 leaf, 210일 | null 870, 시리즈별 커버리지 편차 큼 | 같은 파일 |
| 라이브 quotes | 77/77 | 75 exact, BTC/ETH 2건 생성 후 연속시장 변동 | `_artifacts/live-source-reconciliation.json` |
| screener 가격 파생 | 846 × 12필드 | material parity 846/846, strict parity 583/846 | 같은 파일 |
| FRED | 10/10 | 최신 CSV 재계산 일치 10/10 | 같은 파일 |
| 뉴스 | 38/38 | 필수 필드 38/38, 링크 도달 38/38 | 같은 파일 |
| 페이지 화면 | 22 × 2 = 44 | fatal/overflow/clipping/zero canvas 0, 의미 이슈 다수 | `_artifacts/desktop-browser-audit/report.json` + PNG 44개 |
| 반응형 FULL_INIT | 22 × 4 = 88 | 88/88, overflow/tiny/JS error 0 | `ci-viewport-matrix-check.mjs` 실측 |
| 접근성 자동 | 22 | 22/22, console error 0 | `_artifacts/accessibility-matrix-audit.json` |
| 핵심 사용자 표면 | 10 | 10/10, console error 0 | `_artifacts/critical10-human-surface-audit.json` |
| 안정화 의미 프로브 | 22 | 모든 route 조사, F&G 분열·대량 placeholder 확인 | `_artifacts/current-semantic-runtime-probe.json` |
| F&G 소비처 집중 대사 | 4 핵심 페이지 | home 49 vs sentiment/briefing 31 | `_artifacts/canonical-fg-probe.json` |
| 회귀 테스트 | 992 | 992/992 PASS | `ci-headless-tests.mjs` 실측 |

`18,064 leaf` 검사는 저장된 모든 원자 필드의 형식과 결측을 실제로 읽었다는 뜻이다. 그러나 값의 경제적 진실성을 독립 vendor로 전부 확인했다는 뜻은 아니다. 가격·파생필드는 생산과 같은 Yahoo 원시 OHLCV로 재계산했고, 매크로는 FRED CSV로 독립 재계산했다.

### 11.2 재현 가능한 감사기

- `_artifacts/institutional-data-field-audit.mjs`: JSON leaf, 필드 커버리지, 관측시각·source metadata 검사.
- `_artifacts/live-source-reconciliation.mjs`: 라이브 artifact와 Yahoo/FRED/뉴스 URL 행별 대사.
- `_artifacts/reclassify-reconciliation.mjs`: 이미 수집한 source pair를 strict/material 기준으로 오프라인 재분류.
- `_artifacts/current-semantic-runtime-probe.mjs`: 22페이지 visible placeholder/evidence/status/action 조사.
- `_artifacts/canonical-fg-probe.mjs`: F&G canonical과 실제 반복 sink 비교.

이 파일들은 앱 기능이 아니라 감사 재현물이다. 제품 게이트로 승격할 때는 `_artifacts`에 남기지 말고 `scripts/ci-*`로 정리하고 fixture를 고정해야 한다.

---

## 12. 데이터 하나씩 대사한 결과

### 12.1 시세 77개

정상:

- 77개 모두 양수 가격, 전일종가, 변화율 내부 계산이 일치했다.
- 75개는 감사 시점 Yahoo 5일 chart와 가격·전일종가·등락률까지 exact tolerance 안에서 일치했다.
- BTC/ETH의 전일종가는 일치했다.

실패:

- 77/77 모두 `observedAt`, `fetchedAt`, `marketState`, 거래소 timezone, delay metadata가 없다.
- BTC와 ETH는 artifact 생성 뒤에도 거래가 계속되어 감사 시점 가격이 각각 변했다. 파일에는 관측시각이 없어 사용자에게 “언제 값”인지 설명할 수 없다.
- 화면 상단 `LIVE`는 개별 필드의 live 상태가 아니라 앱 연결/캐시 상태에 가까워 금융 의미의 live 라벨로 부적절하다.

판정: 수치 파싱은 양호하지만 canonical quote evidence 계약은 미달이다.

### 12.2 스크리너 846종목

전수 재계산 필드:

- `price`, `ret1m`, `ret3m`, `ret6m`, `vol`, `rsi`, `pctSma50`, `pctSma200`
- `kalmanVel`, `kalmanPt`, `kalmanInnovZ`, `kalmanVelConf`

결과:

- material tolerance: 846/846 일치.
- strict tolerance: 583/846 일치.
- strict 차이 최대값은 `ret1m 0.05%p`, `ret3m 0.13%p`, `ret6m 0.14%p`, `vol 0.11%p`, `kalmanVel 0.002824`, `kalmanInnovZ 0.004`였다. Yahoo 조정주가 revision/1년 window 경계의 미세한 재현 차이로 분류한다.
- `XNDU.ret6m`, `XNDU.pctSma200`, `WOLF.pctSma200`, `MDLN.pctSma200` 4개 null.
- 뉴스 메모는 87/846종목에만 있다.
- 모든 행에 `observedAt`과 source가 없다.

사용자 표면의 추가 오류:

- live artifact: `universe=870`, `ok=846`.
- 스크리너 화면: `873 총 종목`.
- 서로 다른 universe 정의가 같은 화면에서 설명 없이 사용된다.
- 화면 전체에서 exact placeholder `—`가 4,254개 검출됐다. FMP 실패로 value/quality 컬럼이 비어 있어도 5개 활성 팩터와 종합 랭크가 함께 노출된다.

판정: 가격 파생 계산은 재현되지만 universe/coverage/현재성/결측 공개 계약은 미달이다.

### 12.3 FRED 10개

`CPIAUCSL`, `CPILFESL`, `PCEPI`, `PCEPILFE`, `FEDFUNDS`, `UNRATE`, `PAYEMS`, `HOUST`, `RSAFS`, `CES0500000003`을 FRED CSV에서 다시 계산했다.

- 10/10 artifact 값 일치.
- 10/10 series별 `_asOf_*`가 존재.
- `publishedAt`, realtime vintage, revision metadata는 0/10.
- 현재 파일의 CPI/PCE/주택/소매 일부는 2026-05 observation, 고용/금리는 2026-06 observation이다. 이것은 월간 발표 주기상 정상일 수 있으나 화면의 fetch 시각과 observation 시각을 분리해야 한다.
- FRED 최신값은 사후 수정될 수 있으므로 연구·백테스트는 ALFRED vintage가 필요하다.

판정: 값은 정확하지만 point-in-time/revision 계약은 미달이다.

### 12.4 Fear & Greed

라이브 artifact:

- score 49, previous 47, previous week 32, asOf `2026-07-10T23:59:47Z`.
- 감사 시 canonical `fg`는 value 49, `STALE`, `allowedUse:false`였다.

실제 화면:

- home: 49 중립.
- signal 종합점수 설명: F&G 31.
- sentiment gauge: 31 공포.
- briefing: 31.

근본원인:

- `_lastFG=49`와 `DATA_SNAPSHOT.fg=31`이 공존한다.
- canonical selector를 쓰는 sink와 정적 snapshot을 직접 쓰는 sink가 남아 있다.
- 기존 T901~T904/canonical gate가 모든 반복 sink의 표시값을 검사하지 않는다.

판정: P0. 같은 시점에 같은 지표가 페이지마다 다르므로 외부 공개 차단 사유다.

### 12.5 뉴스 38개

정상:

- 제목/링크/source/pubDate 필수 필드 38/38.
- exact duplicate title 0.
- HTTP 도달 38/38.
- 08:00 KST 완료 24h cycle metadata 존재.

품질 문제:

- authoritative event ID 0/38.
- source 집중: Kavout 8, AOL 6, MSN 3, TradingKey 3 등 2차·재배포·AI형 매체 비중이 높다.
- 링크 도달은 사실성·원문성·라이선스를 증명하지 않는다.
- 공식 Fed/SEC/BLS/BEA/기업 IR/거래소 이벤트를 단일 event graph로 우선하지 않는다.

2026-07-12 24h 맥락 대조:

- AI/반도체 반등과 이란·호르무즈/유가 리스크는 현재 뉴스 풀에 대체로 포함됐다.
- [Fed 6월 FOMC 의사록](https://www.federalreserve.gov/monetarypolicy/files/fomcminutes20260617.pdf)과 [Fed 공식 7월 캘린더](https://www.federalreserve.gov/newsevents/2026-july.htm) 같은 1차 이벤트 식별은 약하다.
- 한국 시장은 [KRX 공식 지수](https://indices.krx.co.kr/)와 BOK 공식 일정을 server-side event로 자동 대조하지 않는다.

판정: 주제 폭은 있으나 기관급 source authority와 event identity는 미달이다.

### 12.6 히스토리 210일

| 필드 | 유효 일수 |
|---|---:|
| BTC | 209 |
| TNX/VIX | 154 |
| SPX/NASDAQ/DOW/RUT/VVIX/DXY/WTI/Gold | 153 |
| KOSPI/KOSDAQ | 148 |
| F&G | 33 |

- 기간은 `2025-12-15~2026-07-12`.
- 3,150 leaf 중 870개가 null.
- 같은 날짜 행에서 시장별 휴장과 수집 실패가 구분되지 않는다.
- 장기 백테스트, regime, 상관 분석에는 표본 길이와 동기화가 부족하다.

### 12.7 자동 AI 시장 해설

- `marketAnalysisOk:true`는 모델 호출/텍스트 생성 성공만 뜻한다.
- F&G 49를 VIX 49로 바꾸고 NFP 57천명을 57만명으로 바꾼 P0가 실제 라이브 텍스트에 존재했다.
- watchdog은 `marketAnalysisOk=false`만 warn하며 숫자·단위·라벨 provenance를 검사하지 않는다.

판정: 현재 자동 해설은 매매 판단 근거로 사용할 수 없다.

---

## 13. 22페이지 실제 사용자 관점 전수 판정

| 페이지 | 사용자가 실제 보는 상태 | 핵심 문제 | 공개 판정 |
|---|---|---|---|
| home | 첫 화면 상단에 12일 지난 운영자 메모, 내부 PUBLIC STATUS, 판단 보류 | 제품 내부 운영 표면이 사용자 결론보다 앞섬. `LIVE`와 stale/snapshot 혼재. F&G 49지만 score evidence는 missing | NO-GO P0 |
| signal | 지수·VIX·점수·뉴스가 잘 정렬됨 | F&G 31, breadth snapshot, 검증 전 score가 Buy Alert 언어와 공존 | NO-GO P0 |
| breadth | 혼조/Stage 3/McClellan 추정 표시 | 실제 % above MA/NYSE A-D가 아니라 근사·정적값 | NO-GO |
| sentiment | 지표와 참고 배지는 명확 | F&G 31로 canonical 49와 분열. static 9일 기준 | NO-GO P0 |
| briefing | 요약과 일정은 읽기 쉬움 | F&G 31, 일부 캐시 결론, 공식 event identity 부족 | NO-GO P0 |
| market-news | stale 경고·cycle·새로고침 노출 양호 | 권위 낮은 source 편중, 공식 이벤트/중복 사건 graph 없음 | BETA only |
| technical | SPY 기술 점수 표시 | 첫 화면 오른쪽 대형 공백, 혼합 live/snapshot, 외부 Chart widget 상실 시 제한 | BETA only |
| screener | 표·필터·랭킹은 풍부 | 873 vs 870/846, `—` 4,254개, FMP plan error, 검증 전 BUY/HOLD | NO-GO P0 |
| ticker | 검색 입력과 탭 존재 | 초기 상태가 NVDA/`Portfolio > NVDA`처럼 보이나 데이터 미수신. 사용자가 분석 완료로 오해 가능 | NO-GO |
| portfolio | 빈 상태·로컬 저장 설명은 명확 | 포지션 없는데 전역 시장 판단/`LIVE`가 강함. 실제 가격 fallback 신뢰도 필요 | BETA conditional |
| themes | cycle·섹터 전략 제시 | 전략 문구가 데이터 계약보다 강하고 일부 고정 기업/테마 narrative | NO-GO as institutional |
| theme-detail | 별도 route 요청 | 실제 active DOM은 `page-themes`; 독립 상세 페이지가 아님 | NO-GO claim |
| macro | FRED 상태와 다음 발표 노출 | 관련 뉴스가 핵심 매크로 표보다 먼저 보여 정보 위계 불량. 오래된 FOMC context | BETA only |
| fxbond | 달러/금리 경고와 source 배지 | 뉴스가 핵심 curve/credit보다 먼저, HY/curve 일부 snapshot | BETA only |
| fundamental | SEC/FMP/Yahoo 표기 | 초기 화면은 뉴스 위주, ticker별 XBRL/valuation coverage 없음, FMP 0 | NO-GO |
| options | VIX/PCR/SKEW와 제한 경고 | 실제 chain/Greeks/OI/IV surface 없음 | reference-only 유지 |
| kr-home | KOSPI/KOSDAQ/FX/수급 카드 | 일부 API 성공·일부 fallback. VKOSPI 추정, source time 불완전 | NO-GO as live |
| kr-supply | 실패와 참고 fallback을 정직하게 표시 | 실시간 수급 미수신인데 정적 금액이 크게 노출 | reference-only |
| kr-themes | 3열 테마 카드/필터 | exact `—` 212개, 대부분 종목 시세 미수신, 테마 성과 계산 불가 | NO-GO |
| kr-macro | BOK rate/회의 이력 | 기준 05/28, 45일 경과. ECOS/KOSIS/BOK 공식 자동화 미완성 | reference-only |
| kr-technical | ticker input/차트 영역 | Naver 시세 수신 실패로 차트 공란. 아래 건강점수는 snapshot에서 계속 표시 | NO-GO P0 |
| guide | 검색·루틴·방법론 접근성 양호 | `극단 공포=역사적 매수 기회` 등 강한 교육 문구가 현재 검증 수준보다 강함 | PASS docs, copy review |

### 자동 UI PASS가 뜻하지 않는 것

- 88/88 viewport PASS: 화면이 열리고 넘치지 않는다는 뜻이다.
- 22/22 accessibility PASS: 자동 DOM 규칙을 통과했다는 뜻이다.
- 10/10 human surface PASS: 첫 화면에 결론/evidence/action이 있다는 뜻이다.
- 위 세 결과는 값·단위·경제적 의미·페이지 간 일관성을 증명하지 않는다.

---

## 14. 자동 수집·운영 실패모드 전수 진단

### 14.1 실제 cadence와 허용 지연

| 계층 | 실제 정책 | 기관급 관점 문제 |
|---|---|---|
| refresh workflow | 매시 `:17/:47`, 30분 | GitHub schedule/CI/deploy/CDN을 거쳐 사용자 반영까지 추가 지연 |
| repo data watchdog | `data.json` 최대 240분 | 30분 cadence 서비스가 4시간 지연돼도 그전까지 green |
| live watchdog | 최대 360분 | 6시간 동안 live stale 허용 |
| screener watchdog | 24h warn, 48h fail | 랭킹/시그널 용도에는 과도하게 느슨함 |
| news | 10건 이상이면 pass | source authority, event completeness, semantic quality 미검사 |
| F&G/FRED/AI | 실패 시 warn | trading-critical 입력과 해설 실패가 release를 막지 않음 |
| FMP | plan error라도 workflow 성공 | value/quality 0개 상태 장기 고착 가능 |

### 14.2 실패 상태별 실제 사용자 결과

| 실패 | 현재 결과 | 평가 |
|---|---|---|
| 외부 CDN 전부 차단 | 로컬 모듈은 부팅, Chart.js/DOMPurify/Lightweight Charts console error | 부팅은 개선됐으나 기능 축소 상태를 페이지마다 완전 설명하지 않음 |
| F&G source stale | canonical 49를 blocked하지만 일부 sink는 snapshot 31 표시 | P0, single truth 실패 |
| KR 수급 일부 실패 | 실패 문구와 reference fallback 표시 | 정직성 개선은 유효 |
| KR 기술 시세 실패 | 차트 공란 + 재시도 문구, 아래 snapshot 건강점수 유지 | 사용자가 두 상태를 합쳐 오해할 수 있음 |
| FMP plan error | 배너는 보이나 랭크/BUY/HOLD 계속 표시 | 강한 행동 surface 차단 부족 |
| 모든 외부 fetch abort | headless/viewport는 통과 | failure-only fixture는 있으나 success/partial/timeout/malformed 실연동 matrix 부족 |
| LLM 의미 오류 | 생성 성공으로 처리 | semantic validator 없음 |
| public proxy 장애 | 다음 cycle retry/폴백 | vendor별 circuit breaker, SLA, 독립 alert routing 없음 |

### 14.3 아직 없는 운영 체계

- 필드별 SLO와 error budget.
- source별 성공률·지연 p50/p95/p99·schema drift dashboard.
- incident severity, on-call, escalation, 사용자 장애 공지.
- RTO/RPO, backfill, replay, immutable raw archive.
- source 간 divergence alert와 quarantine.
- corporate action 재처리와 historical restatement.
- deploy/data/Worker revision을 묶는 단일 release manifest.

---

## 15. 기존 개선·보강의 실효성 재판정

| 기존 개선/게이트 | 실제로 잘 된 것 | 아직 잡지 못한 것 | 판정 |
|---|---|---|---|
| 992 headless tests | 함수·회귀 계약 강함 | F&G 49/31 split, 873/846 count split | 부분 유효 |
| FULL_INIT viewport | 22×4 레이아웃·JS 안정성 | 빈 값과 금융 의미 | 유효하나 범위 제한 |
| accessibility matrix | nameless control/canvas/작은 글자 방지 | NVDA/VoiceOver, 정보 과밀 | 부분 유효 |
| Critical-10 surface | 결론·근거·행동 first surface | 12개 비핵심 페이지와 깊은 스크롤 | 부분 유효 |
| canonical F&G P671 | home과 일부 소비처는 49/stale 차단 | sentiment/briefing/signal은 31 직접 소비 | 실패, 재개 필요 |
| lineage audit | broken/orphan 0 시각화 | gap 1/manual 1인데 overall `ok`; 13 category가 completeness를 뜻하지 않음 | 오해 위험 |
| element lineage | 1,091 visible item의 13필드 shape | 실제로 10페이지만 검사, 값 정답 여부 미검사 | shape-only |
| page contract 22 | DOM/profile/refresh map 존재 | theme-detail이 themes alias, 페이지별 unique data producer 없음 | 존재성-only |
| source state normalization | timeout/malformed 정책 fixture 존재 | 실제 source별 live success/partial matrix 부족 | 부분 유효 |
| options 축소 | 실전 options인 척하지 않고 reference-only | SKEW 등 snapshot observation time | 방향 적절 |
| KR failure copy | 수급/차트 실패를 사용자에게 표시 | fallback 숫자와 건강점수의 동시 노출 | 개선됐으나 불충분 |
| watchdog/live invariant | repo/live stale, deploy drift 탐지 | field freshness·semantic·source divergence | 부분 유효 |

핵심 교훈: “기존 개선 완료”는 해당 테스트 계약을 통과했다는 뜻일 뿐, 사용자의 금융 판단이 정확해졌다는 뜻이 아니다. 모든 완료 항목은 source→field→display→decision의 실제 결과로 재검증해야 한다.

---

## 16. 사용자가 놓치기 쉬운 추가 영역 전체 목록

### 데이터·시장 미시구조

- 분할·배당·권리락·합병·스핀오프·상장폐지·ticker/ISIN/FIGI 변경.
- 거래정지, 서킷브레이커, 조기폐장, 장전/장후, auction price.
- bad tick, zero/negative price, stale quote, cross-vendor divergence.
- adjusted/unadjusted price 정책과 total return 분리.
- FX conversion 기준시각과 다통화 포트폴리오.
- bid/ask, spread, depth, ADV, market impact, borrow availability.

### 연구·모델 거버넌스

- point-in-time universe, delisted names, survivorship/look-ahead bias.
- revision vintage, label leakage, multiple testing, data snooping.
- transaction cost, slippage, tax, borrow fee, capacity.
- walk-forward/OOS, calibration, regime stability, decay monitoring.
- model version, feature version, reproducible training artifact, approval log.
- kill switch와 사용자에게 공개되는 model limitation.

### 원천·법률·권리

- 거래소 entitlement, display/non-display, delayed/real-time 구분.
- redistribution, caching, derived data, commercial use 권리.
- robots/ToS뿐 아니라 계약서·audit right·vendor termination plan.
- 투자자문/리서치/광고 문구의 관할별 법적 검토.

### 보안·AI

- 뉴스/RSS/Telegram/공시를 통한 prompt injection.
- source spoofing, Unicode confusable, malicious links, HTML sanitization.
- API key·portfolio vault·browser storage·backup의 threat model.
- CDN/SRI/supply-chain compromise와 dependency pinning.
- LLM hallucination, number mutation, citation fabrication, model drift.

### 운영·사용자 보호

- SLO/SLA, on-call, incident response, status page, postmortem.
- 장애 시 strong action copy 자동 제거와 전역 kill switch.
- 초보자 suitability, leverage/options 경고, loss scenario 설명.
- color-blind/keyboard/screen-reader 실제 사용자 시험.
- Firefox/WebKit/iOS/Android/저속망/저사양/동시접속 부하.
- 개인정보·포트폴리오 데이터 보존/삭제/내보내기 정책.
- 언어·단위·통화·timezone locale 오해 방지.

---

## 17. 수정된 외부 공개 Release Gate

다음 중 하나라도 실패하면 PUBLIC 금지다.

| Gate | Yes 조건 | 현재 |
|---|---|---|
| RG-1 single metric truth | 같은 evidence ID가 모든 페이지에서 같은 값·시각·상태 | NO: F&G 49/31 |
| RG-2 quote observation | 모든 시세에 observedAt/marketState/timezone/delay | NO: 0/77 |
| RG-3 page evidence quorum | 22페이지 필수 evidence producer와 last success 확인 | NO |
| RG-4 semantic AI | 숫자·단위·라벨 validator 통과, 실패 시 템플릿 | NO |
| RG-5 universe truth | universe/ok/displayed count 일치 또는 명시 | NO: 870/846/873 |
| RG-6 no hidden missingness | 행동 surface에 영향 주는 placeholder 0 | NO |
| RG-7 authoritative events | Fed/SEC/BLS/BEA/KRX/BOK 등 event ID와 source tier | NO |
| RG-8 strategy efficacy | PIT/OOS/cost/survivorship/holdout 승인 | NO |
| RG-9 operational SLO | field/source SLO, alert, replay, kill switch | NO |
| RG-10 rights | 공개·상업 재배포 법률 승인 | NO |
| RG-11 human accessibility | 실제 SR/keyboard/device walkthrough | NO |
| RG-12 live parity | app/data/Worker/release manifest 일치 | NO |

현재 판정: `PUBLIC NO-GO`. 제한된 내부 연구용 `BETA`도 strong action copy를 제거한 뒤에만 가능하다.

---

## 18. 후속 에이전트 추가 작업 패킷

### WP-9. Cross-page Semantic Reconciliation

- F&G, VIX, breadth, score, regime, universe count를 반복 sink 전체에서 수집하는 CI 작성.
- 값·sourceKind·asOf·allowedUse가 하나라도 다르면 fail.
- 첫 fixture는 현재 F&G 49/31과 870/846/873을 재현해야 한다.

완료 게이트: 22페이지 반복 metric split 0.

### WP-10. Page Completeness Contract

- 22페이지 각각 `requiredEvidence`, `uniqueProducer`, `minCoverage`, `failureCopy`, `allowedActionStrength` 선언.
- theme-detail alias를 독립 페이지 주장하지 않거나 실제 상세 producer 구현.
- exact placeholder 수를 페이지 계약과 비교해 핵심 필드 결측 시 행동 surface 차단.

완료 게이트: page contract가 DOM 존재가 아니라 실제 producer success를 증명.

### WP-11. Screener Truth and Coverage

- universe, fetched, valid, ranked, displayed를 분리 표기.
- FMP value/quality가 없으면 해당 팩터와 종합등급/BUY 문구를 비활성 또는 reduced-model로 명시.
- per-row observedAt/source/coverageReason 저장.

완료 게이트: 화면 count와 artifact count 차이 0 또는 설명 100%.

### WP-12. Operational SLO and Quarantine

- 30분 cadence에 맞는 field SLO 정의. 4h/6h/48h 완화값을 제품 용도별로 축소.
- F&G/FRED/FMP/AI semantic 실패를 warn이 아니라 action gate로 연결.
- source divergence·schema drift·bad tick은 quarantine 후 마지막 검증값/reference-only로 전환.

완료 게이트: stale/semantic failure 주입 시 strong action copy 0.

### WP-13. Human Journey Certification

- 22페이지 모든 visible control을 정상/partial/timeout/malformed 4상태에서 실제 클릭.
- Chrome 외 Firefox/WebKit, 실제 mobile, keyboard, NVDA/VoiceOver.
- 정보 위계·과밀·오해 가능성을 사람 체크리스트로 기록.

완료 게이트: 22페이지 × 4상태 × 지원 브라우저 matrix와 사람 서명.

### WP-14. Independent Data and Rights Review

- Yahoo 재현 검사와 별개로 계약 vendor/공식 거래소 cross-check.
- corporate action, identifier, exchange calendar, entitlement 적용.
- 법률 검토 전 PUBLIC/상업 사용 금지.

완료 게이트: source별 데이터 권리·SLA·fallback·termination plan 승인.

---

## 19. AI 핸드오프와 통합한 단일 구조개편 프로그램 (2026-07-13)

이 문서는 `_context/AI-CHAT-INSTITUTIONAL-AUDIT-2026-07-12.md`의 데이터 기반이다. 두 문서는 서로 다른 Evidence Store, validator, page contract, release manifest를 만들면 안 된다.

```text
Source Rights Registry
  -> Source Adapter
  -> Typed Evidence Store (single write path)
  -> Derived/Calculation Evidence
  -> Page Evidence Contract
  -> Regime/Decision/Action Permission
  -> one AI Response Pipeline
  -> UI/Chart/AI projection
  -> Outcome/Feedback/Incident Store
  -> human-approved rule/model promotion
```

각 작업은 아래 상태를 별도 기록한다.

```text
DESIGNED -> IMPLEMENTED_LOCAL -> VERIFIED_LOCAL -> VERIFIED_LIVE
```

문서에 WP와 gate가 존재하는 것은 `DESIGNED`일 뿐이다. current code가 기존 direct read, snapshot fallback, 별도 AI validator를 계속 사용하면 구현 완료가 아니다.

### 19.1 중복 금지·단일 소유권

| 공통 영역 | 단일 소유 구조 | 데이터 문서 책임 | AI 문서 책임 |
|---|---|---|---|
| Evidence | Typed Evidence Store | source/field/time/unit/right/status | claim binding과 abstention |
| 계산 | CalculationEvidence | 공식·입력·가정·버전 | 설명만 수행, 새 숫자 생성 금지 |
| 페이지 | `AIO_PAGE_CONTRACTS` | required producer/minCoverage/failure state | 같은 계약의 AI projection |
| 자동 해설 | `AIResponsePipeline` | typed input와 publish sink | schema/semantic/policy validator |
| 권리 | Source/Provider Rights Registry | 수집·캐시·재배포·상업 이용 | 모델 보존·학습·지역·생성물 권리 |
| 운영 | Release Manifest | app/data/source revision | Worker/model/prompt/retriever/validator revision |
| 성과 | Outcome Store | 예측/결정 시점 snapshot와 실현값 | 답변/행동/feedback/eval 연결 |

### 19.2 두 문서 작업 패킷 의존성

| 데이터 packet | 연결되는 AI packet | 통합 완료 조건 |
|---|---|---|
| WP-0 | WP-AI0/1/6 | 검증 실패 marketAnalysis가 어떤 sink에도 publish되지 않음 |
| WP-1 | WP-AI2/5/12 | quote evidence와 계산/행동 permission이 동일 ID 사용 |
| WP-2 | WP-AI2/7/13 | macro release/observation/fetch/vintage가 claim/retrieval에 보존 |
| WP-3 | WP-AI7/17 | breadth proxy/actual coverage와 AI 표현 강도 일치 |
| WP-4 | WP-AI3/13/20 | filing/XBRL version, retrieval, 권리가 연결 |
| WP-5 | WP-AI6/13/14 | official event가 news/briefing/chat의 canonical source |
| WP-6 | WP-AI7/17 | KR official coverage와 KR/US 분석 깊이 차이 측정 |
| WP-7 | WP-AI5/9/17 | 효능 미검증 모델의 personalized action 0 |
| WP-8/12 | WP-AI8/15/16 | data/app/Worker/model manifest와 SLO 단일화 |
| WP-9/10/11 | WP-AI2/7/11 | cross-page truth, universe, route/entity state 일치 |
| WP-13 | WP-AI18 | 페이지+AI 동일 journey 인간 검증 |
| WP-14 | WP-AI20 | 수집/표시/AI 생성물 전체 권리 승인 |

## 20. 데이터 프로그램에 추가된 AI·운영 책임

AI 감사에서 새로 확정한 AI-X01~10은 AI 팀만의 문제가 아니다. 데이터·운영 계층이 아래 필드를 제공하지 않으면 AI 계층에서 해결할 수 없다.

### DR-AI01 — Conversation snapshot binding

각 turn은 `route`, `entityIds`, `portfolioVersion`, `evidenceSnapshotHash`, `requestId`, `parentTurnId`, `startedAt`, `completedAt`, `completionState`를 가진다. route/entity가 바뀌면 이전 snapshot을 current claim에 재사용하지 않는다.

### DR-AI02 — CalculationEvidence

옵션·포트폴리오·환율·수익률·리스크 계산은 다음 구조를 사용한다.

```text
CalculationEvidence {
  calculationId, formulaId, formulaVersion,
  inputEvidenceIds[], assumptions,
  value, unit, currency, rounding,
  calculatedAt, validatorVersion, status, allowedUse
}
```

LLM 출력 숫자를 Evidence Store에 write하거나 다른 계산의 입력으로 사용하지 않는다.

### DR-AI03 — Versioned retrieval document

뉴스·공시·리서치·Telegram·사용자 문서는 `documentId`, `version`, `sourceTier`, `publishedAt`, `ingestedAt`, `supersedes`, `retractedAt`, `rights`, `untrustedContent`, `entityIds`를 가진다. vector/index 삭제도 원문 권한·정정 상태와 동기화한다.

### DR-AI04 — Conduct and restriction evidence

거래정지, 제재, restricted list, corporate action, market status, 정보 공개 여부를 action permission 입력으로 제공한다. 미확인 내부정보는 current evidence로 승격하지 않는다.

### DR-AI05 — Response/release manifest

app/data/Worker/model/prompt/retriever/validator/calculator version과 evidence snapshot hash를 하나의 manifest로 묶는다. 운영 sample과 incident는 이 manifest 없이는 기관급 검증 표본으로 인정하지 않는다.

### DR-AI06 — Cache isolation and idempotency

cache key는 user/session/route/entity/evidence hash/version을 포함하며 portfolio/chat data는 공유 cache에서 제외한다. retry/cancel/timeout에는 idempotency key와 terminal state를 기록한다.

### DR-AI07 — Coverage and bias telemetry

universe/sector/region/cap/liquidity/language/source coverage를 기록한다. `missing`과 `neutral`을 분리하고 데이터가 적다는 이유로 후보를 승격하거나 감점한 경우 이유를 노출한다.

### DR-AI08 — Human-readable evidence state

screen reader와 초보 사용자가 `current`, `delayed`, `snapshot`, `reference`, `conflict`, `blocked`를 구분할 수 있도록 짧은 label과 상세 설명을 Evidence 상태에 함께 저장한다. UI와 AI가 별도 문구를 만들지 않는다.

### DR-AI09 — Read/write capability registry

현재 제품은 read-only 분석 시스템이다. 데이터 fetch/read와 외부 mutation을 구분하고 주문·메시지·업로드·계정 변경 capability는 기본 deny한다.

### DR-AI10 — Rights/retention/region registry

source data뿐 아니라 LLM provider와 생성물에 대해 retention, training use, processing region, copyright, redistribution, commercial display, deletion을 기록한다.

## 21. 실행 가능한 통합 백로그

### Batch 0 — 공개 위험 차단

- 데이터 WP-0과 AI WP-AI0/6을 함께 수행한다.
- 미검증 marketAnalysis, score/factor 강한 행동 문구, options 구체 추천을 차단한다.
- `generated`, `validated`, `published` 상태를 분리한다.

완료 게이트: semantic validation을 통과하지 않은 자동 해설·계산·행동 문구의 visible sink 0.

### Batch 1 — 단일 Evidence와 페이지 계약

- WP-1/2/9/10/11과 WP-AI1/2/7을 수행한다.
- 기존 `PriceStore`, `DATA_SNAPSHOT`, global, DOM direct read를 inventory하고 adapter 경유로 축소한다.
- 새 parallel registry를 만들지 않고 `AIO_PAGE_CONTRACTS`를 확장한다.

완료 게이트: 22 route의 required producer, last success, evidence ID, status, action permission과 AI projection이 일치.

### Batch 2 — 계산·상태·행동 정책

- DR-AI01/02/04/06/09와 WP-AI5/11/12/14/16/19를 수행한다.
- route/entity race, suitability, conduct, calculation, cache isolation을 fixture로 고정한다.

완료 게이트: stale entity claim, LLM-created decision number, conduct P0, cross-user leak, unauthorized mutation 각각 0.

### Batch 3 — 공식 데이터·문서 graph·권리

- WP-3~6/14, DR-AI03/10, WP-AI3/4/13/20을 수행한다.
- official event/filing을 1차 source로 만들고 secondary news/research와 연결한다.

완료 게이트: stale/retracted/poisoned/권리미승인 document가 current action claim에 사용된 건수 0.

### Batch 4 — 효능·편향·운영·인간 인증

- WP-7/8/12/13, DR-AI05/07/08, WP-AI8/9/10/15/17/18을 수행한다.
- 실제 모델 A/B, live soak, SLO, bias report, 초보/숙련/보조기술 사용자를 검증한다.

완료 게이트: 두 문서의 모든 PUBLIC gate가 실제 artifact/CI/live/human/legal evidence에 연결됨.

## 22. 통합 Release Gate RG-13~22

| Gate | Yes 조건 | 현재 |
|---|---|---|
| RG-13 conversation binding | turn이 route/entity/evidence snapshot에 고정되고 stale late response 0 | NO |
| RG-14 deterministic compute | 금융 계산 100% CalculationEvidence, LLM-created decision number 0 | NO |
| RG-15 retrieval integrity | version/retraction/poisoning/rights가 retrieval과 cache에 반영 | NO |
| RG-16 financial conduct | MNPI/조작/제재/restricted/관할 정책과 red-team 승인 | NO |
| RG-17 response replay | app/data/Worker/model/prompt/retriever/validator manifest로 replay | NO |
| RG-18 cache isolation | cross-user leak, duplicate bill/store, partial-complete 오분류 0 | NO |
| RG-19 coverage bias | universe/region/sector/cap/liquidity/language/source coverage 승인 | NO |
| RG-20 human chat | keyboard/SR/mobile/초보·숙련 task와 오해율 기준 통과 | NO |
| RG-21 non-agentic boundary | 사용자 승인 없는 외부 mutation 0 | NO |
| RG-22 rights/retention/region | data/provider/output 권리·보존·지역 정책 승인 | NO |

## 23. 다음 에이전트 인수 계약

다음 에이전트는 작업 시작 전에 이 문서와 AI 핸드오프의 packet dependency를 함께 읽는다. 각 PR/세션은 하나의 Batch 또는 원자적 packet만 맡고 다음을 보고한다.

```text
Packet/Batch:
Status: DESIGNED | IMPLEMENTED_LOCAL | VERIFIED_LOCAL | VERIFIED_LIVE
Existing paths inventoried:
Old path removed or retired:
New single path:
Data schema/migration:
Failure fixtures:
CI/runtime gate:
Local browser result:
Live result:
Human/legal/vendor evidence:
Unverified and blocker:
Rollback:
```

완료를 주장하려면 source -> adapter -> evidence -> derived/calculation -> decision -> UI/AI -> outcome 경로를 한 샘플 이상 실제 값으로 추적하고, 결측/지연/충돌/악성 입력 fixture를 함께 통과해야 한다. 함수·registry·문구의 존재만으로 완료 처리하지 않는다.

## 24. 2026-07-13 검증·미검증 경계

검증됨:

- 로컬 `version.json`은 v52.67.
- v52.67 AI route/context 재감사에서 22 route, AI 활성 20, `briefing` context 부재가 재현됨.
- `themes`와 `theme-detail` prompt 동일, screener universe/portfolio suitability/options chain 부재가 재현됨.
- 기존 데이터 필드·source reconciliation 감사기와 AI route audit artifact가 저장소에 존재함.

미검증:

- v52.67 live 배포 parity.
- 실제 유료 모델 답변 corpus와 일반 LLM blind A/B.
- live Worker/model/KV/region/retention 설정.
- 실제 사용자·NVDA/VoiceOver·다중 브라우저·다중 사용자 race.
- 데이터 vendor/LLM provider/생성물의 법률·재배포 승인.
- 이 문서의 WP/DR/RG 구현 완료 여부. 현재는 설계와 인수 계약만 보강됨.

현재 판정은 계속 `PUBLIC NO-GO`다.
