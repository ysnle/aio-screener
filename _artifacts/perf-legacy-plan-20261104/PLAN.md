# 2차 개편 설계 — 성능 · 레거시 경계 · 화면 5종 (2026-11-04, 읽기 전용)

범위: 커버리지 감사의 I3(성능), I7(레거시 경계), S12(스크리너), S13·S15(종목 개요·재무), S16(포트폴리오), S17~S19(리서치), S23(검색).
기준: main `1da80799`(v59.69). 구현은 1차 배치 네 브랜치를 통합한 뒤 진행한다.
표기: **[측정]** 이번에 직접 잰 값, **[확인]** 파일·코드로 본 것, **[추정]** 계산이나 정황으로 낸 값.

측정 방법: 배포와 같은 번들을 만들어 측정했다(`scripts/build-pages-bundle.mjs`를 스크래치 디렉터리의 스테이징 사본에 실행, 10:41). 소스 모드는 저장소 루트를 그대로 띄워 쟀다. 두 모드 모두 19개 라우트를 새 페이지에서 `index.html#<route>`로 열고, 1440×900 화면에서 외부 요청을 막고 6.5초를 지켜봤다. 측정 도구: Playwright 리소스 타이밍, CDP JS 커버리지, DOM writer 프로브(`textContent`·`innerHTML`·노드 삽입 setter를 감싸 스택 첫 스크립트 프레임에 귀속). 스크립트와 원자료는 세션 스크래치패드(`…/scratchpad/{measure,cold-fns,writer-probe,hdr}.mjs`, `dist-all.json`, `cold-full.json`, `writers.json`)에 있다. 저장소 파일은 이 문서 말고는 건드리지 않았다.
작업 중 공유 checkout의 `node_modules`가 10:44에 비었다. 다른 세션이 한 일로 보이며, 원인은 확인하지 못했다. 그 뒤 측정은 ui-states worktree의 playwright를 빌려 읽기 전용으로 돌렸다.

---

## 1. 측정 표 (전 → 목표)

### 1-1. 부팅 성능 (배포 번들 기준, 19개 라우트) [측정]

| 지표 | 지금 (최소~최대) | SLO 목표 (`operations-slo.json`) | 이 설계의 단계 목표 |
|---|---|---|---|
| 같은 출처 JS 디코딩 바이트 (6.5초까지) | **3.86~4.38 MB** (모든 라우트 공통 3.85 MB) | 1.5 MB | 1단계 3.0 · 2단계 2.6 · 4단계 ≤1.5 MB |
| 그중 부팅 클래식 스크립트(min, chat 제외) | 1,236 KB (gzip 약 405 KB) | 예산 없음 | 2단계 ≤1,000 KB · 4단계 ≤700 KB |
| ESM 부팅 모듈 집합 | 1,550 KB raw / 574 KB gzip (예산 1,606 / 594) | `boot-budget.json` | 4단계 ≤900 KB raw |
| 부팅 뒤 모든 라우트가 받는 지연 청크 | 802 KB (연구 corpus 573) | — | 1단계 ≤100 KB |
| 활성 라우트 DOM | 94~**4,198** (signal 2,677 · themes 4,198이 넘음) | 2,500 | 모든 라우트 ≤2,500 |
| 전체 DOM | 2,461~6,486 (숨은 페이지 1,614~1,969) | 진단 7,500 | ≤3,500 |
| long task 합 (첫 4초) | 1,249~3,436 ms (market-news 최대 1,031 ms 한 번) | 합 1,000 · 최대 200 ms | 합 ≤1,000 |
| 공용 데이터 디코딩 (6.5초까지) | 8.0~9.3 MB (history 4.68 MB · screener 1.79 MB가 모든 라우트) | — | DR R2 뒤 ≤3 MB |
| FCP | 60~2,056 ms (home 첫 실행에서 튐) | 2,500 | 유지 |

### 1-2. 지금 CI 게이트가 실제 배포를 재지 못하는 점 [확인 + 측정]

- `scripts/ci-boot-interaction-check.mjs`는 번들 전 소스를 띄워서 잰다. 소스 모드에서는 모듈 556개를 따로 받으므로 리소스 타이밍 버퍼(기본 250개)가 찬다. 이번 측정에서 리소스 248개에서 멈췄다. 그래서 보고된 3.85 MB는 잘린 값이다. 같은 측정을 배포본에 하면 4.02 MB다.
- 같은 게이트는 `navigator.webdriver` 때문에 `js/aio-qa-audits.js`(325 KB)를 받는다(`aio-core.js:2957`). 이 파일은 배포되지 않는다. 배포본에서는 0바이트로 404가 났다.
- `architecture/boot-budget.json`은 ESM 부팅 집합만 잰다. 클래식 스크립트 1.24 MB와 부팅 뒤 받는 지연 청크는 어떤 바이트 예산에도 걸리지 않는다.

### 1-3. 라우트별 필요한 코드와 미리 받는 코드 [측정]

"공통"은 19개 라우트 모두가 받은 JS 97개 파일, 3,851 KB다. "라우트 전용"은 그 라우트만 받은 것이다. 커버리지는 6.5초 안에 실행된 문자 수 / 받은 문자 수다(CDP, 함수 단위).

| 라우트 | 받은 JS | 라우트 전용 (큰 파일) | 실행률 | 활성 DOM |
|---|---:|---|---:|---:|
| home | 4,017 | 167 (analysis 27, session-lean 28) | 53% | 246 |
| briefing | 3,961 | 111 (news 69) | 54% | 947 |
| market-news | 3,982 | 131 (news 69, event-briefs 26) | 54% | 2,120 |
| signal | 4,037 | 186 (analysis 27, session-lean 28) | 55% | **2,677** |
| breadth | 3,990 | 140 (market 83) | 53% | 741 |
| sentiment | 3,888 | 37 (sentiment 32) | 54% | 375 |
| macro | 4,057 | 206 (market 83, macro-chapters 22) | 54% | 1,957 |
| fxbond | 3,997 | 146 (market 83) | 54% | 558 |
| charts | 3,946 | 95 (charts 12) | 53% | 440 |
| themes | 4,047 | 197 (themes 140) | 54% | **4,198** |
| screener | 4,072 | 221 (screener 176) | 54% | 1,455 |
| ticker · fundamental | 4,047 | 196 (entity 67 + 39 + 28) | 52% | 94 · 276 |
| technical | 3,960 | 110 | 53% | 160 |
| portfolio | 4,027 | 177 (portfolio 113) | 53% | 466 |
| principles | 4,177 | 326 (principles 116, 지식 청크 97+58+52) | 56% | 547 |
| atlas | 4,376 | **525** (atlas 177, industry-node-stories 138) | 56% | 200 |
| masters | 4,092 | 241 (masters 91) | 54% | 376 |
| guide | 3,859 | 8 | 54% | 307 |

**읽기**: 라우트에 실제로 필요한 코드는 8~525 KB다. 나머지 3.85 MB는 어느 라우트든 똑같이 받는다. 공통분의 구성은 다음과 같다.

| 공통분 | KB | 비고 |
|---|---:|---|
| 클래식 부팅 7개 | 1,236 | aio-core 597 · aio-data 318 · glossary 108 · workspace 68 · kr-data 56 · pages 52 · ui 38 |
| aio-chat (idle 로드) | 226 | 실행률 20% |
| ESM 부팅 집합 | 1,550 | `bootstrap.js` 한 파일이 708 KB |
| 부팅 뒤 지연 청크 | 802 | 연구 corpus(supplied-materials 173 + chunk-3T73 400)는 2.8초에 받는다(`bootstrap.js:719` idle prefetch). 그 밖에 legacy-screen-bridges 41 · chat-globals 35 · request-pipeline 28 · backtest 28 · ai-profile 17 |

### 1-4. 클래식 스크립트 중 어느 라우트에서도 실행되지 않은 함수 [측정, 소스 모드 합집합 커버리지]

AI 패널과 용어집을 한 번 연 경우를 포함했다. 부팅부터 6초까지만 본 것이므로, 클릭할 때만 도는 함수도 '차가움'에 들어간다. 지워도 된다는 뜻이 아니다.

| 파일 | 문자 수 | 차가운 바깥 함수 | 차가운 문자 | 그중 QA·감사 이름 함수 |
|---|---:|---:|---:|---|
| aio-core.js | 944,590 | 482 / 697 | 405,990 (43%) | **62개, 132,545** (getThemeTrendDeepAudit 10.5K, getFullSurfaceAudit, getDeploymentGateAudit, collectCritical10…, assertChat…) |
| aio-chat.js | 322,576 | 85 / 93 | 252,710 (78%) | 2개 |
| aio-data.js | 478,268 | 80 / 169 | 106,049 | 6개 11,090. 번역 3개(autoTranslateNews 11K, freeTranslateNews 7.7K, _gtBatchTranslate 3.9K) |
| aio-workspace.js | 121,469 | — | 82,075 (68%) | — |
| aio-kr-data.js | 94,654 | — | 48,490 | 한국 이름 함수 40,064 |
| aio-ui.js | 71,897 | 25 / 42 | 26,845 | — |
| aio-pages.js | 66,594 | 12 / 15 | 13,246 | — |

### 1-5. 레거시 DOM writer, 실제로 쓰는 것 [측정, writer 프로브]

`route-owners.json`은 15개 라우트의 narrativeOwner를 legacy로 적는다. 실제로 화면에 쓰는 레거시 writer는 다음과 같다.

| writer | 라우트 | 쓰기 수 | 보이나 |
|---|---|---:|---|
| `aio-core.js:5171 _aioRenderPageDecisionHeader` (+ `_aioBuildPageDecision` :3935, 시장 epoch 함수들) | **19개 전부** ("full native"로 적힌 sentiment·charts·principles·masters·atlas·guide 포함) | 364 | **안 보인다**: `index.html:3072 body:not(.aio-dev-mode) .page > .aio-decision-header{display:none}`. 숨은 DOM 269개를 만든다 |
| `aio-data.js:1791 _aioInjectTelegramFeed` | market-news, macro, fxbond, themes, technical, fundamental | 14 | dev 모드가 아니면 비우기만 한다(v59.55) |
| `aio-core.js` 익명 + `kr-integrated-*`, `aio-ui.js` 익명 | home, briefing, market-news, macro | 51 | 한국 통합 블록 |
| `_aioRenderOperatorNote`, `_aioRenderServerDataAge`, `_aioSetLiveText`, `updateQuotaBadge` | home | 17 | 운영 안내, 데이터 나이 |
| 인라인 첫 페인트(`index.html:3874`), `_aioRenderBriefingDateLine` | home, signal, briefing | 11 | 보인다(첫 페인트용, 의도된 동작) |
| `_aioFoldDensePageControls`, `_aioApplyNewsBackstop`, `freeTranslateNews` | market-news | 6 | 보인다 |
| `_aioRRPopulateSelect`, `_updateVaultStatus`, `aio-ui.js:1189 updateBenchmarkChart` | portfolio | 2 + 차트 | 보인다 |

**결론**: "레거시 서술 15개 라우트"의 대부분은 이제 dev 모드에서만 보이는 판정 헤더 하나다. 사용자에게 보이는 레거시 서술은 home 운영 안내, 뉴스 번역·백스톱, 한국 통합 블록, 포트폴리오 세 곳뿐이다.

---

## 2. 작업 단위

각 단위에 touches(고칠 파일), 기대 감소량, 옛 코드에서 실패할 게이트, 위험을 적는다. 게이트는 지금 코드에서 실패하고 고친 코드에서 통과해야 한다. 이름 앞에 '신규'가 붙은 게이트는 새로 만들고, 붙지 않은 것은 기존 게이트를 넓힌다.

### 0단계: 측정을 사실대로 (다른 단계의 전제)

**P0. 부팅 측정을 배포 번들로 바꾼다**
- touches: `scripts/ci-boot-interaction-check.mjs`(임시 디렉터리에 `build-pages-bundle` 스테이징 후 측정, `performance.setResourceTimingBufferSize(2000)`, 측정 창을 6.5초로 명시), `scripts/lib/pages-bundle-config.mjs`(스테이징 함수 공유), `architecture/boot-budget.json`(`classicBootBudget` raw/gzip, `postBootLazyBudget` 추가), `scripts/ci-boot-bundle-budget-check.mjs`(클래식 7개 minify 크기 합과 지연 청크 합).
- 감소량: 0. 숫자가 바뀐다(3.85 → 4.02 MB). TARGET_MISS가 실제 배포를 가리키게 된다.
- 옛 코드에서 실패: 신규 `classicBootBudget`. 예산은 1,000 KB로 시작해 지금 1,236 KB면 실패한다. 2단계가 끝날 때까지는 ratchet으로 둔다.
- 위험: 낮음. CI 시간이 번들 1회(약 10초)만큼 는다.

### 1단계: 바로 줄일 수 있는 것

**P1. AI 코드를 패널을 쓸 때 받는다**
- touches: `src/app/bootstrap.js:708-720`(deferredStartupSyncs의 `ensureResearchCorpus` 제거), `src/app/chat-loader.js`(idle 로드 대신 패널 열기, 또는 AI 버튼 hover·focus 때), `src/domain/research/corpus-loader.js`.
- 감소량: 약 **−886 KB** [측정 합산: corpus 573 + aio-chat 226 + chat-globals 35 + request-pipeline 28 + ai-profile 17 + 잔여 7]. 3.85 → 약 2.97 MB.
- 옛 코드에서 실패: 신규 `ci-boot-interaction-check`의 "AI 패널을 열기 전에는 supplied-materials·aio-chat 요청 0건".
- 위험: 첫 질문의 지연이 corpus 로드(gzip 약 150 KB [추정])만큼 는다. 디스패치는 이미 corpus를 기다린다(`bootstrap.js:330`). 소유자 결정 D1.

**L1. 숨은 판정 헤더를 사용자에게는 만들지 않는다**
- touches: `js/aio-core.js:3935-4020, 5150-5240`(`_aioRenderPageDecisionHeader` 호출부를 `aio-dev-mode`일 때만 실행. dev 화면도 필요 없으면 삭제), `index.html:856, 2654-2664, 2833-2842, 3072`(관련 CSS). `has-aio-decision-header`가 `page-conclusion-bar`를 숨기는 규칙이 사라졌을 때 conclusion bar가 다시 보이는지 확인해야 한다.
- 감소량: 쓰기 −364, DOM −269 [측정], 함수 약 19K 문자, minify 뒤 약 11 KB [추정]. 6개 "full native" 라우트에서는 레거시 writer가 0이 된다.
- 옛 코드에서 실패: 신규 `ci-legacy-writer-probe`(아래 L0). `route-owners.fullNativeOwner` 라우트에서 레거시 writer가 0이어야 하는데, 지금은 18건이다.
- 위험: `aio-core.js:4015`가 같은 판정을 AI 질문 버튼(`_aioAskAiFromPageDecision`)에 쓴다. 이 버튼도 헤더 안에 있어 보이지 않으므로 함께 지운다. dev 모드를 쓰는 소유자 점검 흐름이 이 헤더를 보는지 확인한다(D2).

**L0. writer 프로브를 게이트로 만든다 (L1과 같은 묶음)**
- touches: 신규 `scripts/ci-legacy-writer-probe.mjs`(이번 `writer-probe.mjs`를 정리), `architecture/route-owners.json`(narrativeOwner를 프로브 결과로 다시 분류하고, 허용된 레거시 writer 목록을 라우트별로 둔다), `architecture/qa-pipeline.json`.
- 감소량: 0. 대신 "legacy 15개" 같은 낡은 분류가 사라진다.
- 옛 코드에서 실패: 위 L1 조건. 목록에 없는 레거시 writer가 생기면 실패한다.
- 위험: 스택 귀속은 Chromium 전용이다. 브라우저 그룹에서만 돌린다.

**DOM1. 닫힌 접기 안은 처음 열 때 그린다**
- touches: `src/ui/components/section-frame.js`·`deep-dive.js`(공용 `lazyFold(details, render)`: `toggle` 이벤트에서 한 번 그림), 먼저 signal·themes·macro·market-news 렌더러(`src/ui/pages/analysis.js`, `themes.js`, `market.js`, `news.js`의 fold 생성부).
- 감소량: 닫힌 details 안 노드가 signal 4,243 · themes 4,420 · macro 2,133 · news 3,391개였다(중첩은 중복 집계)[측정]. 활성 DOM을 모두 2,500 아래로 내리는 것이 목표다 [추정].
- 옛 코드에서 실패: `ci-boot-interaction-check`의 domNodesMax를 보고용에서 차단용으로 올린다(라우트 19개 전부).
- 위험: 접기 안 내용을 읽는 게이트·AI 문맥(DOM에서 텍스트를 읽는 경우)이 빈 값을 보게 된다. 접기 안 문자열을 DOM에서 읽는 소비자를 먼저 찾아야 한다. **ui-states 브랜치의 `<details>` 트랜지션과 같은 요소를 건드린다.** 반드시 1차 통합 뒤에 한다.

### 2단계: 클래식 스크립트 줄이기

**P2. aio-core의 QA·감사 함수를 aio-qa-audits.js로 옮긴다** (R673 선례: v57.78)
- touches: `js/aio-core.js`(62개 함수), `js/aio-data.js`(6개), `js/aio-qa-audits.js`, `architecture/decomposition-hotspots.json`(ratchet 낮춤), `scripts/ci-structural-check.mjs`.
- 감소량: 132.5K + 11.1K 문자 → minify 뒤 약 **−85 KB** [추정: 이번 번들의 min/src 비율 0.58].
- 옛 코드에서 실패: 신규 `ci-qa-surface-boundary` — 부팅 스크립트에 `/Audit$|^assert|Inventory$/` 이름의 `window.AIO.*` 정의가 0이어야 한다. 지금은 62개다.
- 위험: 운영자 자가진단 위젯과 `?qa=1`이 이미 `loadQaAudits()`를 쓰므로 호출부는 async여야 한다. 동기 호출부가 있는지 확인한다.

**P3. 라우트 전용 클래식 스크립트를 지연 로드한다**
- touches: `index.html:6081-6137`(script 태그), `scripts/lib/pages-bundle-config.mjs`(GLOBAL_SCRIPTS를 boot와 lazy로 나눔), `architecture/runtime-script-order.json`, 신규 `src/app/classic-loader.js`(chat-loader 패턴). 대상은 셋이다.
  - `aio-workspace.js`(68 KB min, 68% 차가움): 포트폴리오 Vault·입력. 같은 파일의 `aio-confirm-modal`과 AI 패널 입력 바인딩은 aio-ui로 옮긴 뒤에 뺀다.
  - `aio-kr-data.js`(56 KB): 한국 블록이 처음 보일 때 받는다.
  - `aio-glossary.js`(108 KB): 용어 표시(term-marks)가 처음 hover되거나 용어집을 열 때 받는다. term-marks가 부팅 때 사전을 읽는다면, 용어 이름만 담은 작은 색인을 따로 만든다.
- 감소량: 약 **−232 KB** [측정 합산]. 2단계 끝에서 클래식 부팅은 약 920 KB다.
- 옛 코드에서 실패: P0의 `classicBootBudget` 1,000 KB.
- 위험: 높음. R622/P1135(스크립트 순서가 바뀌어 ReferenceError가 나면 파일 전체가 죽음)의 재발 위험이 있다. 옮기기 전에 그 파일이 정의하는 전역을 다른 부팅 스크립트가 부팅 때 부르는지 정적·런타임 두 가지로 확인한다. global-ownership 게이트와 runtime-script-order를 갱신한다.

### 3단계: 화면 2차 개편 (묶음 C~F, 병렬 가능)

아래 원칙을 공통으로 적용한다. 섹션마다 시각 자료 하나와 해석 2~3줄을 둔다. 태그라인과 '읽는 법'·'먼저 보세요' 같은 안내 문장은 없앤다. 보조 라벨은 hover(title)로 옮긴다. 깊은 분석은 접기에 둔다(소유자 10/31). 미국을 먼저, 한국은 '한국'으로 뒤에 둔다.

**S12. 스크리너: 조작부를 줄 하나로, `screener.js`는 다섯 파일로**

현재 조작부 [확인, index.html:5397-5759]
- 탭 3개(순위·맞춤 조건·사후 검증).
- 필터 서랍: 섹터·시장·시총·셋업·랭크≥·RSI 최소/최대·모멘텀·워치리스트만·실행 통과만.
- 컬럼 프리셋 + 컬럼 선택, 행 필터, 메뉴 접기.
- 맞춤 조건 작업대: 접기 2단, JSON 정의 불러오기·저장 서랍 포함.
- 가중치 프로필 5개(접기), 데이터 기준 접기.

설계
1. 맨 위 한 줄: `[표에서 찾기] [시장 ▾] [섹터 ▾] [+ 조건]` 다음에 적용된 조건이 칩으로 붙는다(Linear 필터 방식). RSI·모멘텀·랭크·셋업·워치리스트는 '+ 조건' 메뉴의 항목이 되고, 고르면 칩이 된다. 맞춤 조건 작업대는 같은 칩 흐름으로 흡수한다. '맞춤 조건' 탭이 없어져 탭은 순위·사후 검증 두 개다.
2. 정렬: 열 머리를 누르면 정렬된다(지금 방식 유지). 컬럼 프리셋과 가중치 프로필은 '보기' 하나로 합친다. '보기 ▾ 균형·모멘텀·스윙·가치·저리스크'가 가중치와 보이는 열을 함께 바꾼다.
3. 없애는 것: '행 필터' 버튼(칩과 같은 일), '메뉴 접기'(셸 단축키로 대체), 사용자 화면의 JSON 정의 서랍(dev 모드로 옮김. AX: 조건 정의는 AI 패널이 같은 JSON으로 만들어 칩에 적용하는 경로 하나만 둔다), `title` 설명문 4개.
4. 섹션 틀: 순위 표(시각) + 한 줄 요약("조건 통과 N · 자료 부족 N")을 둔다. 사후 검증은 IC 막대 하나 + 2줄이다. P1449 규칙에 따라 검증 패널은 접지 않는다.

파일 분할(DX) — 현재 4,000줄, `createScreenerPage` 혼자 1,467줄(2534-4000)이다 [측정]. `src/ui/pages/screener/` 아래로 나눈다.

| 새 파일 | 옮길 함수 |
|---|---|
| `table.js` | createColumnContent 294줄, createTableRow, renderTableHeader, renderTableStatus, render |
| `filters.js` | filterRows, syncScreenerControlAvailability, 칩 모델 |
| `views.js` | 가중치·컬럼 '보기' |
| `validation-tab.js` | renderFactorTab, renderBacktest, renderConditionalEvidence |
| `page.js` | 수명주기와 이벤트 배선만, ≤400줄 |

`screener-custom.js`는 filters.js로 합친다.

- touches: `src/ui/pages/screener.js`(→ 디렉터리), `src/ui/components/screener-custom.js`, `screener-read.js`, `index.html:5397-5759`, `src/ui/styles/v2-screener.css`·`screener-quality.css`, `architecture/decomposition-hotspots.json`, `.claude/skills/verify-aio/features/screener.md`.
- 감소량: 마크업 id 114개 → 약 60개 [추정], screener 청크 176 KB → 약 150 KB [추정]. 조작 요소 약 30개 → 약 8개 [확인-집계].
- 옛 코드에서 실패
  - 신규 `ci-screener-controls-contract`: 페이지의 상위 조작 요소 ≤10개, `#scr-developer-drawer`는 dev 모드에서만 둔다.
  - `ci-decomp-hotspot-check`: 페이지 파일 하나 ≤1,200줄.
- 위험: 저장된 화면(screener-runs, localStorage 조건)의 형식 호환. 칩 모델이 기존 `scr-custom-conditions` JSON을 그대로 읽어야 한다. URL deep link 파라미터도 유지한다.

**S13·S15. 종목 개요와 재무 공시: 섹션 셋, 서술은 숫자가 말하게**

설계

| 화면 | 섹션 | 시각 | 해석·접기 |
|---|---|---|---|
| 개요 | ① 가격 | 가격 차트 | 한 줄 "왜 움직였나"(market-day·why-moved) |
| 개요 | ② 동종 비교 | 순위 막대 하나 | 강점 1줄 · 약점 1줄. `stock-lens-cards.js:217`의 '읽는 법' 카드는 지운다 |
| 개요 | ③ 회사 이야기 | — | 접기 |
| 재무 | ① 매출·영업이익률 추세 | 추세 차트 | 3줄 |
| 재무 | ② 현금흐름·발생액 | 차트 | 접기 안 DuPont·역 DCF와 같은 지연 청크 |
| 재무 | ③ SEC 연간 요약 | — | 접기 |

`fiscal-read.js:178`의 '금융사 읽는 법'은 '금융사 기준' 같은 짧은 상태 라벨로 바꾼다.

- 레거시 경계: ticker의 남은 레거시는 검색 배선(`compatibility-globals.js:366,410`)과 `aio-core.js showTicker` 호환 writer다. 프로브에서 ticker의 레거시 쓰기는 판정 헤더 말고 없었다 [측정]. 검색 배선은 S23과 함께 바꾼다.
- touches: `src/ui/pages/entity.js`, `src/ui/components/stock-read.js`, `stock-lens-cards.js`, `company-story.js`, `fiscal-read.js`(ui), `src/domain/fundamental/fiscal-read.js`, `fundamental-analysis-cards.js`, `index.html:5199-5275, 4435-4492`.
- 감소량: 바이트는 작다. 화면 문장 수와 섹션 수는 줄어든다 [추정].
- 옛 코드에서 실패
  - `ci-instruction-text-ratchet-check` 확장: 보이는 제목·카드 라벨에서 `/읽는 법|보는 법|먼저 .*(보|확인)하세요/` 0건. 지금 5건이다(stock-lens-cards:217, fiscal-read:178, masters:288, atlas:464, macro-crossroads:208) [확인].
  - 신규 `ci-section-visual-contract`: 종목 두 탭의 각 섹션에 svg·canvas·차트 컴포넌트가 1개 이상.
- 위험: AI 문맥이 렌즈 카드 문구를 인용한다(`src/ai/context/choosing-blocks.js:64` "화면 '이 기업을 보는 법'과 같은 값"). 라벨이 바뀌면 AI 문맥도 같이 바꿔야 한다.

**S16. 포트폴리오: 차트를 native로, 접기 8개를 3개로**

- 현재 [확인]
  - 벤치마크 차트는 `js/aio-ui.js:1189 updateBenchmarkChart`가 맡는다. 클라이언트에서 Yahoo를 보유 종목마다 최대 10개 병렬로 부르고 '새로고침'을 눌러야 그린다.
  - 위험·목표가 계산(`rr-*`)은 aio-ui, Vault·입력은 aio-core 17개·aio-workspace 34개 id가 맡는다.
  - 접기는 보안·선택 입력·내 기록·도구·과거 성과·내 계획 점검·관심종목 위험·고급 설정 안 입출금·환율로 8개가 넘는다.
- 설계
  1. 첫 화면은 섹션 셋이다. ① 평가액과 S&P 500 대비: native 추세 차트. 보유 종목 종가는 history·quote 층에서 읽고, 눌러야 그리는 방식을 없앤다. ② 보유 종목 표. ③ 노출: 섹터·단일 종목 막대 하나.
  2. 접기는 셋만 둔다. '기록'(매매일지·논지·입출금·환율), '점검'(손절·목표·위험 계산·과거 성과), '설정'(보안·통화·이자).
  3. Vault 암호 코드는 그대로 둔다. 다만 P3에서 aio-workspace를 포트폴리오 라우트 진입 때 받게 한다.
- touches: `src/ui/pages/portfolio.js`, `src/ui/components/portfolio-*.js`, `src/ui/panels/portfolio-*.js`, `js/aio-ui.js:1185-1260`(삭제), `index.html:4691-5199`, `src/ui/styles/portfolio-page.css`, `architecture/route-owners.json`(portfolio chartOwner → native).
- 감소량: 활성 DOM 466 → 약 300 [추정], 클라이언트 Yahoo 호출 최대 11회 → 0, aio-ui −약 4 KB.
- 옛 코드에서 실패
  - `ci-architecture-contract-check`: `counts.chartNative` 20/20(not-applicable 제외 전부)이어야 하는데 지금 14다.
  - 신규 프로브 조건: portfolio에 `aio-ui.js` writer 0건.
- 위험: 보안 경로를 함께 건드리지 않게 한다. Vault·백업 파일(`src/storage/financial-security.js`, `vault-crypto.js`)은 이 작업의 touches에서 뺀다.

**S17~S19. 리서치 산문을 콘텐츠 산출물로 뺀다**

- 현재 [확인 + 측정]
  - 페이지 코드 안의 긴 한글 리터럴: atlas.js 128개, principles 41개, masters 21개.
  - `src/domain/knowledge/*.js` 약 620 KB(learning-core 104, concept-stories 77, foundation-stories 59, industry-node-stories 1~3 약 144, integrated pack 54, concept-core 52).
  - 그 결과 atlas 라우트 전용 JS가 525 KB다.
  - `public-data/{principles,atlas,knowledge}`에는 이미 JSON 산출물(lesson-library, chapters, foundation-lessons, ai-retrieval-index 등)이 있다. 같은 내용이 JS 모듈과 JSON 두 곳에 있다는 뜻이다.
- 설계
  1. 원본을 `content/research/<kind>/*.json`(사람이 쓰는 원본, 짧은 필드 구조) 하나로 둔다. 신규 `scripts/build-research-content.mjs`가 `public-data/{principles,atlas,masters}/*.json`과 AI 검색 색인(`knowledge/ai-retrieval-index.json`)을 함께 만든다. AX: AI와 화면이 같은 원본을 읽는다.
  2. 페이지는 `loadJsonArtifact`로 그 장만 받는다. 페이지 JS에는 렌더러만 남긴다.
  3. 화면 문구 규칙: 장 머리에 시각 하나(관계 그래프·병목 흐름도는 이미 있는 것), 요약 2~3줄을 두고 본문은 접기에 둔다. 'AI 산업 지도 읽는 법'(atlas.js:464) 같은 안내 장은 지우거나 도움말로 옮긴다. masters.js:288의 교과서 문단도 지운다.
  4. `knowledge-search.js:4`가 learning-core를 정적으로 import한다. 그래서 용어집 검색이 620 KB 쪽에 묶여 있다. 검색은 생성된 색인 JSON만 읽게 바꾼다(S23과 맞물림).
- touches: `src/ui/pages/{atlas,principles,masters}.js`, `src/ui/knowledge/*`, `src/domain/knowledge/*`, `src/domain/masters/style-frames.js`, 신규 `content/research/`, `scripts/build-research-content.mjs`, `scripts/ci-principles-contract-check.mjs`, `ci-masters-contract-check.mjs`, `.github/workflows/knowledge-build-candidate.yml`(생성 단계 연결), `.claude/skills/knowledge-lint`.
- 감소량: atlas 라우트 전용 525 → 약 200 KB, principles 326 → 약 150 KB [추정, 데이터는 JSON gzip으로 받음]. 저장소 안 내용 중복도 사라진다.
- 옛 코드에서 실패
  - 신규 `ci-research-content-source`: `src/ui/pages/{atlas,principles,masters}.js`의 40자 이상 한글 리터럴 ≤5개. 지금은 128·41·21개다.
  - 신규 `ci-research-content-source`: `content/research`와 public-data 산출물이 재생성 결과와 같아야 한다.
- 위험: 지식 상태가 `REFERENCE_PROGRESS_ONLY`이고 소유자 검토 전이다. 내용을 옮기는 것과 고치는 것을 섞지 않는다. 옮긴 뒤 화면 문자 수가 같은지 비교하는 게이트를 단계 안에 둔다. 1차 배치의 ui-states가 atlas.js 한 줄을 고쳤으므로 통합 뒤에 시작한다.

**S23. 검색창 넷을 명령 검색 하나로**

- 현재 [확인]: 종목(`#ticker-direct-search`), 스크리너(`#scr-text-search`), 도움말(`#guide-search-input`), 용어집(`#glossary-search`) 네 개가 있다. Ctrl+K는 지금 화면의 검색창이나 용어집을 연다(`screen-shortcuts.js:77-88`, 소유자 2026-10-25 "화면에 있는 검색창만 포커스").
- 설계
  1. Ctrl+K와 셸의 검색 아이콘 하나가 명령 검색을 연다. 결과는 세 묶음이다.
     - 종목: `us-listings.js` + 스크리너 유니버스 + 한국 6자리 코드.
     - 화면: `ROUTE_HUBS`.
     - 용어·리서치: 생성된 지식 색인(S17~S19의 4).
  2. 종목 검색창, 도움말 검색, 용어집 검색은 이 하나로 바뀐다. 용어집 모달은 '용어' 범위로 열린 명령 검색이 된다. 종목 화면과 허브의 '종목 고르기'(`route-hubs.js:37-46`)도 이 검색을 연다.
  3. 스크리너의 '표에서 찾기'는 표 필터라서 남긴다(S12의 칩 줄 첫 칸). 이렇게 하면 네 개가 실제로는 '검색 하나 + 표 필터 하나'가 된다.
  4. AX: AI 패널도 같은 검색 함수(종목 해석)를 쓴다. 티커 추정 금지 원칙에 맞게, 목록에 없는 기호는 '목록에 없음'으로 돌려준다.
- touches: 신규 `src/ui/navigation/command-search.js`, `screen-shortcuts.js`, `route-hubs.js`, `src/app/compatibility-globals.js:360-420`, `src/ui/knowledge/glossary-modal.js`·`glossary-bridge.js`·`research-shell.js:292`, `src/ui/pages/guide.js:133`, `src/ui/components/term-marks.js:231`, `index.html:5252, 5796-5804, 6124`, `src/ui/styles/shell-overlays.css`.
- 감소량: 입력창 4 → 1(+ 표 필터 1). 검색 코드 경로 4 → 1.
- 옛 코드에서 실패
  - 신규 `ci-search-surface-contract`: index.html의 `type=search|text` 전역 검색 입력이 1개 + 표 필터 1개여야 한다. 지금은 4개다.
  - verify-aio shell feature에 'Ctrl+K → NVDA → 종목 개요', '시장 폭 → 화면 이동', '하이일드 → 용어' 세 흐름을 넣는다.
- 위험: 소유자 10/25 결정(Ctrl+K = 화면 검색창 포커스)과 정면으로 다르다(D4). 한국어 IME 조합 중 Enter 처리가 필요하다(ui-states의 iOS 입력 수정 선례).

### 4단계: 큰 이전

**P4. `bootstrap.js` 708 KB를 라우트 단위로 쪼갠다**
- touches: `src/app/bootstrap.js`(1,200줄대), `src/app/boot-sequence.js`, `vertical-slices.js`, `src/app/routes.js`, `architecture/boot-budget.json`.
- 방법
  - 먼저 esbuild metafile로 bootstrap 출력에 정적으로 들어간 입력을 나열한다(이번에는 `node_modules` 소실로 못 했다).
  - `syncNews`·`syncThemes`·`syncPortfolio`·`syncEntityForConsumers`·스크리너 동기화처럼 첫 페인트 뒤에 도는 것(`bootstrap.js:708-715`)의 도메인 모듈을 동적 import로 바꾼다.
  - 첫 페인트 판정(home·signal)이 쓰는 모듈만 정적으로 남긴다.
- 감소량: ESM 부팅 1,550 → 약 900 KB(−650) [추정. 근거는 bootstrap이 공통 부팅의 46%라는 측정뿐이고, 입력별 크기는 미측정].
- 옛 코드에서 실패: `boot-budget.json` rawBytes를 900 KB로 낮춘다.
- 위험: 높음. 첫 페인트 판정 게이트(v58.80 F01), history session model check, market-narrative lifecycle model check가 import 순서에 민감하다. model-check 스킬의 게이트를 전부 다시 돌린다.

**L2~L6. 보이는 레거시 서술을 native로 옮긴다 (부분 이전)**

전면 재작성은 금지이므로, writer 하나씩 native 컴포넌트로 옮기고 프로브 허용 목록에서 지운다.

| 단계 | 옮길 것 | 대상 native | 바이트 −(min, 추정) | DOM · 쓰기 − (측정 기준) |
|---|---|---|---:|---|
| L2 | 텔레그램 피드 주입(`aio-data.js:1791`, `_aioRenderTelegramFeedHtml` 5.8K) — 사용자 모드에서는 비우기만 하므로 호출째 dev 모드로 | `channel-data.js`가 이미 사실 추출을 표시 | −5 KB | 쓰기 −14, 6개 라우트 |
| L3 | home 운영 안내·데이터 나이·quota 배지(`_aioRenderOperatorNote`, `_aioRenderServerDataAge`, `_aioSetLiveText`, `updateQuotaBadge`) | `data-status-surface.js` + actions-reliability의 `freshness-badge` | −8 KB | 쓰기 −17 |
| L4 | 뉴스 접기·백스톱·번역(`_aioFoldDensePageControls` 3K, `_aioApplyNewsBackstop`, `freeTranslateNews`/`autoTranslateNews`/`_gtBatchTranslate` 22.6K) | `news.js` + Worker 번역 경로(Workers AI 번역 존재: 메모리 v57.59-65) | −17 KB | 쓰기 −6 |
| L5 | 한국 통합 블록(`kr-integrated-macro/technical/themes`, aio-core·aio-ui 익명 writer, aio-kr-data) | `korea-participation`·`kr-index-trend` 계열, 또는 미국 중심 원칙에 따라 퇴역(D5) | −40~56 KB | 쓰기 −51, 4개 라우트 |
| L6 | 포트폴리오 RR select·Vault 배지·벤치마크 차트 | S16 | −6 KB | 쓰기 −2 + 차트 |
| L7 | aio-core 차가운 문자 중 호출자 0인 함수 삭제 | — (P2 뒤 남은 차가운 273K 문자 중 정적 호출자 0건만) | −50~100 KB [추정] | — |

- 옛 코드에서 실패: 단계마다 `ci-legacy-writer-probe` 허용 목록에서 해당 writer를 빼면 지금 코드가 실패한다. 최종 상태는 레거시 writer 0개, 예외는 인라인 첫 페인트 2개뿐이다.
- 위험: L4의 번역은 외부 무료 번역 엔드포인트를 클라이언트에서 부르는 경로일 수 있다 [추정]. Worker 경로로 옮길지는 AI 비용 상한과 함께 판단한다(D6). L5는 데이터 감사의 한국 null 칸(aio-core.js:13017-13022)과 같은 영역이다.

---

## 3. 단계 순서

| 단계 | 단위 | 누적 JS(6.5초, 배포본) [추정] | 활성 DOM 최대 |
|---|---|---:|---:|
| 0 | P0 | 4.02 MB (측정값이 바로잡힘) | 4,198 |
| 1 | P1, L0+L1, DOM1 | 약 3.1 MB | ≤2,500 |
| 2 | P2, P3 | 약 2.8 MB | ≤2,500 |
| 3 | S12, S13·S15, S16(+L6), S17~S19, S23 | 약 2.7 MB(atlas·principles 라우트는 더 줄어듦) | ≤2,500 |
| 4 | P4, L2~L5, L7 | **약 1.5~1.9 MB** | ≤2,500 |

4단계 끝에서 SLO 1.5 MB에 닿으려면 P4가 추정대로 −650 KB이고, L7이 −100 KB를 내야 한다. 모자라면 SLO를 2.0 MB로 바꿀지 소유자가 결정한다(D7).

---

## 4. 병렬 세션 묶음 (파일이 겹치지 않게)

1차 배치 네 브랜치를 통합한 뒤 시작한다. `index.html`은 여러 묶음이 쓰므로 **영역 소유를 줄 번호가 아니라 블록 id로** 나눈다. 같은 묶음 안에서도 index.html 수정은 자기 블록에서만 한다.

| 묶음 | 단위 | 소유 파일 | index.html 블록 |
|---|---|---|---|
| **A 부팅·측정** | P0, P1, P4 | `src/app/bootstrap.js`, `boot-sequence.js`, `chat-loader.js`, `vertical-slices.js`, `src/domain/research/corpus-loader.js`, `scripts/ci-boot-*.mjs`, `scripts/lib/pages-bundle-config.mjs`, `architecture/boot-budget.json`, `operations-slo.json` | 없음 |
| **B 레거시 코어** | L0, L1, P2, P3, L2~L5, L7 | `js/aio-core.js`, `aio-data.js`, `aio-qa-audits.js`, `aio-kr-data.js`, `aio-workspace.js`, `aio-glossary.js`, `aio-pages.js`, 신규 `src/app/classic-loader.js`, `scripts/ci-legacy-writer-probe.mjs`, `scripts/ci-structural-check.mjs`, `architecture/{route-owners,runtime-script-order,decomposition-hotspots,global-ownership-baseline}.json` | `<script src>` 줄(6081-6137), 판정 헤더 CSS(856·2654-2664·2833-2842·3072) |
| **C 스크리너** | S12 | `src/ui/pages/screener*`, `src/ui/components/screener-*.js`, `v2-screener.css`, `screener-quality.css`, verify-aio screener | `#page-screener` |
| **D 종목·포트폴리오** | S13·S15, S16 | `src/ui/pages/entity.js`, `portfolio.js`, `src/ui/components/{stock-*,company-*,fiscal-read,fundamental-*,portfolio-*}.js`, `src/ui/panels/portfolio-*.js`, `src/domain/fundamental/*`, `js/aio-ui.js`(updateBenchmarkChart·rr-* 구간만), `portfolio-page.css`, `v2-stock.css` | `#page-ticker`, `#page-fundamental`, `#page-portfolio` |
| **E 리서치 콘텐츠** | S17~S19 | `src/ui/pages/{atlas,principles,masters}.js`, `src/ui/knowledge/*` (glossary-modal·glossary-bridge 제외), `src/domain/knowledge/*`, `src/domain/masters/*`, `content/research/`, `scripts/build-research-content.mjs`, `scripts/ci-{principles,masters}-contract-check.mjs`, `public-data/{principles,atlas}` | `#page-principles`·`#page-atlas`·`#page-masters`(셋 다 2개 id뿐) |
| **F 검색·셸** | S23 | 신규 `src/ui/navigation/command-search.js`, `screen-shortcuts.js`, `route-hubs.js`, `src/app/compatibility-globals.js`, `src/ui/knowledge/glossary-modal.js`·`glossary-bridge.js`, `src/ui/pages/guide.js`, `term-marks.js`, `shell-overlays.css` | 검색 입력 3곳(5252 · 5796-5804 · 6124), 셸 헤더 |

겹침 규칙과 남은 접점
- **A ↔ B**: P1(chat-loader)과 B의 aio-chat은 겹치지 않는다. B는 aio-chat을 건드리지 않는다(AI 패널 결함 S20은 이 설계 밖). P3의 `classic-loader.js`는 B가 소유하고, A는 그것을 import하지 않는다. 두 묶음 모두 `pages-bundle-config.mjs`가 필요하므로, P3의 GLOBAL_SCRIPTS 분리는 **B가 A에게 요청하고 A가 고친다**(소유자 한 명).
- **D ↔ B**: `js/aio-ui.js`는 D가 updateBenchmarkChart와 rr-* 구간만 고친다. B는 aio-ui를 건드리지 않는다. L6은 D가 한다.
- **E ↔ F**: `knowledge-search.js`는 E가 소유한다(색인 JSON 전환). F는 그 export만 쓴다. E가 먼저 시그니처를 고정해야 한다.
- **C ↔ F**: 스크리너 '표에서 찾기'는 C가 소유한다. F의 Ctrl+K 규칙은 스크리너 화면에서도 명령 검색을 연다. 표 필터 포커스는 `/` 키로 둔다(D4와 함께 결정).
- **DOM1(lazy fold)**: 공용 컴포넌트(`section-frame.js`, `deep-dive.js`)는 A·B·C·D·E 밖이다. B의 1단계에 넣되, 각 페이지 렌더러의 fold 생성부는 페이지 묶음(C·D·E)이 3단계에서 적용한다. 1단계에서는 analysis.js·themes.js·market.js·news.js만 B가 고친다. 이 네 파일은 C~F에 없다.
- 공용 기록: 모든 묶음은 `_artifacts/pending-records/<묶음>/`에 기록하고 같은 릴리스 번호를 인용한다. `CURRENT-STATE.md`·`CODE-MAP.md`는 통합 때 한 번 재생성한다.

---

## 5. 소유자 결정 항목

| # | 질문 | 권고 | 근거 |
|---|---|---|---|
| D1 | AI 연구 corpus와 aio-chat을 부팅 뒤 idle로 미리 받을까(지금), 패널을 처음 열 때(또는 AI 버튼에 마우스·포커스가 갈 때) 받을까 | hover·focus 때 받기 | −886 KB로 단일 항목 중 가장 크다. 첫 답변 지연은 대략 gzip 150 KB 다운로드만큼 [추정] |
| D2 | dev 모드 판정 헤더('데이터: 실시간 · 기준 시각 · 시점 일치')를 dev 화면에도 남길까 | 지우기(운영 점검은 operations-status·신선도 배지가 대신함) | 사용자에게는 안 보이고, 19개 라우트에서 쓰기 364번·DOM 269개를 만든다 |
| D3 | 스크리너 JSON 정의 불러오기·저장을 사용자 화면에서 뺄까 | dev 모드로만 남기기. AI 패널이 조건을 만드는 경로를 하나로 둔다 | 조작 요소 약 30 → 8. Linear 수준 단순함 |
| D4 | Ctrl+K를 '화면 검색창 포커스'(2026-10-25 결정)에서 '명령 검색 열기'로 바꿀까 | 바꾸기. 표 필터는 `/` 키 | 검색창 4개를 하나로 합치려면 이전 결정을 대체해야 한다 |
| D5 | 한국 통합 블록(kr-integrated-*)을 native로 옮길까, 퇴역할까 | 시장 상태 한국 보드 하나로 모으고 나머지는 퇴역 | 미국 중심. aio-kr-data 56 KB, 쓰기 51건 |
| D6 | 뉴스 자동 번역을 Worker(Workers AI) 경로로 옮길까 | 옮기기(월 상한 안) | 클라이언트 번역 코드 22.6K 문자가 레거시에 있다 [측정]. 외부 엔드포인트 확인이 필요하다 [추정] |
| D7 | 4단계 뒤에도 1.5 MB에 못 미치면 SLO를 2.0 MB로 고칠까 | 4단계 측정 뒤 결정 | P4 감소량이 미측정 추정이다 |
| D8 | 리서치 본문의 원본을 `content/research/*.json`으로 옮기는 데 동의하나(지식 검토 전 상태 유지, 내용 변경 없음) | 동의 | 같은 내용이 JS 모듈과 public-data JSON 두 곳에 있다 |

---

## 6. 확인하지 못한 것

- `bootstrap.js` 708 KB의 입력별 구성. `node_modules`(esbuild)가 사라진 뒤라 metafile을 뽑지 못했다. P4 감소량은 추정이다.
- 실제 배포(Pages, brotli)와 휴대폰 회선에서의 시간 지표. 이번 측정은 로컬 서버, 데스크톱, 외부 요청 차단 상태다. 바이트와 DOM 수는 환경과 무관하지만, long task와 FCP는 환경에 따라 다르다.
- 커버리지의 '차가움'은 부팅부터 6초까지만 본 것이다. 클릭 경로는 돌리지 않았다. L7의 삭제 후보는 정적 호출자 검사를 따로 해야 한다.
- 닫힌 접기 안의 DOM 수는 중첩 details를 중복으로 센 값이다. 활성 DOM이 실제로 얼마나 줄지는 DOM1 구현 뒤 다시 잰다.
- L4의 번역 함수가 부르는 외부 주소는 읽지 않았다.
