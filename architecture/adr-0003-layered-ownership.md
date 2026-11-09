# ADR-0003: 계층별 단일 소유자 구조 (전체 리팩토링 설계)

- 상태: 제안 (소유자 검토 대기, 2026-11-09)
- 근거 원칙: AGENTS.md "Architecture first (owner 2026-11-09)" — 기능은 담당 계층에 자연스럽게 놓고, 자리가 없으면 덧붙이지 말고 먼저 리팩토링안을 낸다.
- 선행 문서: `adr-0001`(strangler 기반), `adr-0002`(store 접근 계약), `README.md`(source adapter → validation → canonical evidence store → selector/view model → route UI)

## 1. 왜 지금 필요한가

#162~#167은 영역별 근본 원인을 고쳤다. 그런데 같은 일을 하는 코드가 여러 곳에 남아 있어서, 한 곳을 고쳐도 다른 사본이 계속 다른 값을 낸다. 2026-11-09 HEAD를 읽기 전용으로 감사한 결과(grep과 부분 읽기 기준)는 아래와 같다.

| 관심사 | 구현 수 | 대표 위치 |
|---|---:|---|
| 신선도 판정(최신/지연/참고/없음) | 약 15 | `data/contracts/artifact-freshness.js`(레지스트리), `data/quality/freshness.js`, `data/quality/freshness-engine.js`, `shared-artifacts.js`, `ui/pages/masters.js` `thirteenFStale`, `ui/components/market-temperature.js`, `domain/macro/liquidity-growth.js` … |
| 거래 세션·종가일 계산 | 약 10 | `domain/market/market-calendar.js`, `session-time.js`, `history-session.js`, `domain/shared/session-date.js`, `ai/time/market-session.js`, `ui/pages/themes/rrg.js` … |
| JSON 아티팩트 로더 | 3개 스택 + 직접 fetch | `data/artifact-cache.js` `loadJsonArtifact`, `data/shared-artifacts.js` `refreshSharedArtifact`, `data/server-data-loader.js`, `ui/knowledge/glossary-bridge.js:159`, `ai/retrieval/knowledge.js:305` |
| `src/data` 밖의 `public-data` 경로·로더 설정 | ui 약 66, domain 3, ai 1 | `ui/pages/atlas.js`, `principles.js`, `masters.js`, `ui/components/theme-playbook-view.js:193` … |
| RSI | 4 | `domain/technical/definitions.js` `rsiWilder`, `chart-layers.js` `rsiSeriesWilder`, `market-charts.js` `rsiOf`, `js/aio-core.js` `_calcRSILast` |
| SMA/EMA | 5 이상 | `domain/technical/definitions.js`, `sentiment/composite-fear-greed.js`, `ui/components/stock-chart.js` `smaOf`, `ui/components/kr-index-trend.js`, `js/aio-core.js` `_calcSMA/_calcEMA` |
| 평균·표준편차·백분위·변화율 | 약 16 | `macro/macro-signals.js`, `market-day/facts.js`, `portfolio/return-stats.js`, `fundamental/peer-read.js` …(null·0 처리 방식이 서로 다름) |
| 추세·MA 정렬 판정 | 6 이상 | `technical/stage.js`, `bands.js`, `trend-state.js`, `chart-layers.js`, `chart-strategies.js`, `market/regime-radar.js` |
| RRG 사분면 | 6 | `domain/themes/rrg.js` `classifyRRG` + domain 2곳, ui 3곳(별도 한국어 단어표 포함) |
| HTML escape | 8 | `js/aio-data.js` `escHtml` + `src/ui` 로컬 사본 7곳 |
| 숫자·퍼센트 포맷 | 공용 모듈 없음 | `toFixed`가 162개 파일에 있고, 이름 붙은 `fmt*` 로컬 헬퍼가 10개 이상 |
| 티커 해석 | 5 경로 | `ai/entity/resolver.js`(도메인에 위임, 올바른 방식), `chat-tickers.js`, `extract-tickers.js`, `js/aio-chat.js` `_resolveTickerFromFuzzy`, `js/aio-data.js` `extractTickers` |
| 포트폴리오 보유 표 | 2 작성자 | `js/aio-workspace.js` `renderPortfolio`(754, `dataset.aioPortfolioTableRenderer` 분기)와 `ui/pages/portfolio.js`(431) |

UI·AI 안의 판정 로직도 문제다. `ai/analysis/technical.js:12-17`은 RULES와 별개로 RSI 70/30을 하드코딩한다. `ui/components/portfolio-checklist.js:17-18`은 `domain/portfolio/checks.js`의 25%·40% 구간을 다시 정의한다. 시세 화면이 이미 계산한 값을 `js/aio-chat.js` `_fetchTickerTrend`(1596)는 Yahoo에서 다시 받아 재계산하고, `ai/context/chat-macro-lines.js`는 `_liveData`에서 원시값을 다시 읽는다. 그래서 화면과 AI가 같은 사실을 다른 값으로 말할 수 있다.

좋은 점도 있다. `src/domain`은 거의 순수하다(DOM·fetch·storage 접근은 기본 인자 `globalThis` 1곳뿐). 계층 폴더도 이미 있다. 필요한 것은 새 프레임워크가 아니라 정본을 하나로 정하고 사본을 지우는 일이다.

## 2. 목표 구조와 의존 규칙

```
scripts/ (producer, Actions 전용) ──▶ public-data/*.json ◀── schemas/ (형태 정본)
                                           │
src/data      로더·검증·신선도·저장소 ─────┤  (fetch·storage는 여기와 src/app만)
src/domain    순수 계산·판정·문구 규칙 ────┤  (DOM·fetch·window 금지, 시계·데이터는 인자로)
src/view      domain 결과 → 화면 모델 ─────┤  (선택 사항: 큰 페이지만, 처음엔 domain/*/read.js가 그 역할)
src/ui        렌더만 (view model 입력) ────┤
src/ai        같은 domain/view model 인용 ─┘  (자체 재계산 금지, Worker 계약 상수 공유)
src/app       조립 루트: 라우터, 부트, window 호환층, storage 주입
js/*.js       호환 셸: 새 기능 금지, 지우는 방향으로만 수정
```

의존 규칙(게이트로 강제):
1. `src/ui`, `src/domain`, `src/ai`는 `fetch`, `localStorage/sessionStorage`를 쓰지 않는다(이미 `ci-architecture-contract-check`가 막는다). `'./public-data/'` 경로도 갖지 않는다. 아티팩트는 `src/data/artifact-registry.js` 키로만 요청한다. 감사에서 본 위반은 직접 fetch가 아니었다. 경로 문자열을 들고 `loadJsonArtifact`를 부르는 우회 방식이었다.
2. `src/domain`은 `src/ui`·`src/ai`·`src/app`을 import하지 않는다. `src/ui`는 `src/ai`를 import하지 않는다(AI 패널은 app이 조립한다).
3. 한 관심사에는 정본 모듈이 하나다(아래 표). 다른 위치는 정본을 import하거나 위임하는 얇은 래퍼만 둔다.
4. 임계값·판정 문구는 `src/domain`(임계값은 `domain/rules/thresholds.js`)에만 둔다. UI와 AI는 판정 결과를 받는다.
5. AI context는 화면이 쓰는 같은 domain 함수나 근거 행을 읽는다(`ai/context/market-content.js` 방식). 시세나 지표를 따로 받아 다시 계산하지 않는다.

## 3. 관심사별 정본

| 관심사 | 정본 | 정리 대상 |
|---|---|---|
| 아티팩트 위치·형태·주기 | `src/data/artifact-registry.js`(신규, `ARTIFACT_FRESHNESS`에서 `maxAgeMs` 파생) | ui·domain·ai의 URL 상수와 `{key,url,schemas,maxAgeMs}` 설명자 |
| 로딩·캐시 | `data/artifact-cache.js` `loadJsonArtifact` | `refreshSharedArtifact`는 그 위의 얇은 클라이언트로, 직접 fetch 2곳은 위임으로 |
| 신선도 | `data/contracts/artifact-freshness.js` `freshnessState`/`sessionLagState` | `quality/freshness.js`·`freshness-engine.js`는 어댑터로, 화면별 `*Stale`은 레지스트리 주기로 |
| 세션·종가일 | `domain/market/market-calendar.js` | `ai/time/market-session.js`, ui의 `usCloseSession` 등 |
| 통계 | `domain/shared/stats.js`(신규: mean, stdev, pctChange는 null 정책을 명시) + `percentile.js` | domain·ui 로컬 사본 |
| 기술 지표 | `domain/technical/definitions.js`(SMA/EMA/RSI/ATR) | `chart-layers` `rsiSeriesWilder`, `market-charts` `rsiOf`, ui `smaOf`, legacy `_calc*` |
| 추세 판정 | `domain/technical/trend-state.js` | stage·bands·chart-strategies 분류기는 이 결과에서 파생 |
| RRG | `domain/themes/rrg.js` | domain 2곳, ui 3곳, 단어표 |
| 포맷·escape | `src/ui/format.js`(신규, `domain/shared/number.js` 위) + `src/ui/html.js`(신규) | `fmt*` 로컬 헬퍼, `esc` 사본 7곳(legacy `escHtml`은 이 모듈을 노출) |
| 상태 배지·빈 상태 | `ui/components/freshness-badge.js`, `empty-state.js` + 상태 문구표 1개 | legacy `renderDataQualityBadge`, 페이지별 empty 함수 |
| 티커 해석 | `domain/ticker/resolve-name.js` + `domain/entity/ticker-symbol.js` | AI 5경로는 QuestionPlan → resolver 하나로 |
| AI–Worker 계약 | `worker/ai-contract.mjs`(신규: 모델 id, 본문 한도, 헤더 이름) | `js/aio-chat.js`, `js/aio-core.js`, `cloudflare-worker-proxy.js`, `openai-budget.mjs` 하드코딩 |
| 포트폴리오 표 | `ui/pages/portfolio.js` | `js/aio-workspace.js` `renderPortfolio`의 tbody 분기 |

## 4. 실행 순서 (동작 보존, 단계마다 QA·CI 녹색)

각 단계는 독립 커밋 묶음이다. 먼저 동일성 테스트(기존 출력 고정)를 쓰고, 정본으로 옮긴 다음, 사본을 지우고, 다시 늘지 않게 게이트를 건다.

| 단계 | 내용 | 규모 | 위험 |
|---|---|---|---|
| S0 경계 게이트 | 새 게이트를 만들지 않고 기존 소유 게이트를 넓혔다. `ci-architecture-contract-check`는 이미 domain·ui·ai의 fetch·storage와 ui import를 금지하고 있다. `ci-shared-primitive-ratchet-check`에 `localEscape`·`localIndicator`·`publicDataPath` 지표를 더해 파일별로 줄어들기만 허용한다(v59.87, 측정값 7·6·60). 정본 표는 이 문서 §3이 정본이다 | 작음 | 낮음 |
| S1 공용 원시 함수 | `ui/html.js` escape, `domain/shared/number.js`의 부호 표기·평균·표준편차 정본화(별도 `stats.js`는 부트 청크 하나를 더 만들어 number.js로 합침). RSI/SMA/EMA/ATR을 `definitions.js` 하나로, RRG 사분면을 `rrg.js` 하나로 | 중간(약 30파일) | 낮음~중간. RSI 시드 차이와 null·0 처리 차이는 동일성 테스트로 먼저 드러낸다 |
| S2 데이터 경계 | `artifact-registry.js`, URL·설명자 이전, 직접 fetch 2곳 위임, `refreshSharedArtifact`를 `loadJsonArtifact` 위로 | 중간 | 낮음~중간 |
| S3 신선도·세션 단일화 | 판정은 레지스트리 하나로, 배지 문구는 문구표 하나로. 세션 계산은 `market-calendar` | 중간 | 중간(사용자에게 보이는 상태 문구가 바뀔 수 있어 visual-state 테스트로 확인) |
| S4 판정 로직 이전 | UI·AI 안의 임계값·판정 문구를 domain으로 옮기고 view model로 받기. 포트폴리오 25/40 구간 중복 제거 | 중간 | 중간 |
| S5 AI가 화면과 같은 사실 읽기 | `_fetchTickerTrend`·`_liveData` 직접 읽기를 domain 결과로 교체, Worker 계약 상수 공유, policy 폴더 3개 통합 | 중간 | 중간(프롬프트 전후 스냅샷 비교) |
| S6 legacy 이중 소유자 제거 | 포트폴리오 표, 워치리스트 저장소, `extractTickers`, 신선도 렌더러(약 330줄), `_calc*` 지표(약 500줄)를 native에 위임 | 큼 | 중간~높음 |
| S7 폴더 재편 | `market/` 내부 분할(regime·breadth·korea) 후 market-day·signal·sentiment·interpretation 흡수, entity·ticker·masters를 instruments로, stub 폴더 삭제 | 큼(import 대량 변경) | 높음. codemod로 한 번에, 마지막에 |

S1에서 확인한 제약: esbuild는 공유 모듈의 진입점 집합이 바뀌면 청크를 따로 떼므로, 부트 모듈 사이에 import 한 줄이 늘면 청크당 약 200~430 gzip B가 붙는다. 그래서 `produced-rotation.js`는 사분면 규칙을 풀어 쓰고 동일성 검사로 묶었다. 부트 청크 배치 자체는 이 단계들과 따로, 부트 예산(`architecture/boot-budget.json`)의 라우트 lazy화로 다룬다.

이번 배치 범위는 S0~S3을 권장한다. S4~S5는 이어지는 배치로, S6~S7은 각각 다시 보고한 뒤 진행한다. `fetchAllNews`(약 570줄)와 `applyLiveQuotes`(약 500줄)의 native 이전은 전역 결합이 커서 별도 설계가 필요하고, 이 ADR 범위 밖이다.

## 5. 하지 않는 것

- 프레임워크·빌드 도입(Vite/TS)은 ADR-0002에 따라 계속 보류한다. 지금 문제는 도구가 아니라 소유자 중복이다.
- 동작 변경 없이 이름만 바꾸는 대량 이동은 S7 한 번으로 모은다. 그 전 단계는 파일 위치를 유지하고 정본 import만 바꾼다.
- `js/*.js`에 새 기능을 넣지 않는다. 고칠 때는 native로 위임하고 줄 수를 줄이는 방향으로만 고친다(`decomposition-hotspots.json` ratchet 유지).

## 6. 확인 안 된 것

`research`, `knowledge`, `news`, `portfolio`, `screener`, `briefing` domain 폴더의 내부 중복은 일부만 읽었다. `soft-ui.css`·`*-quality.css`의 덮어쓰기 충돌도 확인하지 않았다. 각 단계 시작 때 해당 범위를 다시 읽는다. `_context/CODE-MAP.md`의 js 줄 범위는 낡아 있다(aio-core를 27k줄로 적고 있지만 실제는 15,423줄). 다음 CODE-MAP 재스캔 때 고친다.
