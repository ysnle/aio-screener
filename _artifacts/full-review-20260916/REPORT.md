# AIO Screener — 로컬·GitHub 동시 심층 리뷰 리포트

| 항목 | 값 |
|---|---|
| 검토 ID | `full-review-20260916` |
| 검토 기준 SHA | `9fccf5ff3af4d038c356fe408dd5a7756fc91d44` (main, v54.97) |
| 검토 일시 | 2026-09-16 (KST) |
| 검토 범위 | 아키텍처 / 알고리즘·분석 로직 / 데이터 소스·파이프라인 / 자동화·CI·배포 / UI·UX·라우트 / 지식 경계·거버넌스 |
| 증거 등급 | 정적(static) + 로컬 런타임(headless 로컬 재현) + GitHub API(원격 CI/배포 사실) |
| 배포 여부 | **없음** (commit/push/deploy 미수행) |
| 코드 변경 | **없음** (본 리포트 파일 추가만) |

## 0. 요약

- 로컬 `main`과 `origin/main`은 **동일 SHA, ahead/behind 0/0, diff 없음**. 리뷰 대상 코드는 로컬 = GitHub이다.
- 그런데 **GitHub 쪽 CI는 최근 28회 연속 실패**했고, 그 결과 **GitHub Pages 라이브 사이트가 v54.89(2026-09-11)에 5일간 정지**해 있다. 리포지토리는 v54.97이다.
- 정지 원인은 **게이트 3개의 결함**이며, 셋 다 **제품 회귀가 아니라 게이트/픽스처 결함**으로 판정했다. 로컬(Windows)에서도 동일하게 재현되어 플랫폼 무관하게 결정적이다.
- 로컬에서는 별도의 **`masters-contract` 실패**(CRLF/`core.autocrlf` 문제)가 phase 1을 막아 **브라우저 게이트 23개가 전부 SKIP**된다. 즉 개발자가 CI를 로컬에서 재현할 수 없는 상태다.
- 그 외 6개 영역 심층 리뷰에서 **BLOCKER는 없음**. HIGH 다수, MEDIUM 다수. 대부분 계약·게이트·문서의 드리프트이며, 라이브에서 확정 오작동하는 로직은 발견하지 못했다.
- 운영 알림 이슈 3건(CI / Pages skipped / watchdog)이 열려 있으나 미해결이다. 알림은 정상 작동하지만 아무도 닫지 않았다.

### 최우선 조치 (P0)
1. `scripts/ci-chat-ui-state-browser-check.mjs`의 죽은 셀렉터 `#chat-home-stop` → `#chat-home-btn-stop` 수정.
2. `scripts/ci-architecture-browser-check.mjs:543`의 `chartKinds` 허용목록에 `T3_PUBLIC_DELAYED` 추가(또는 `data-source-kind` 어휘 단일화).
3. `scripts/ci-screener-auto-refresh-browser-check.mjs`의 `_liveData` 픽스처에 quote 권위 필드(`sourceKind`/`allowedUse`/`rightsId`/`quality`) 추가.
4. `.gitattributes` 신설로 `public-data/objects/**` 개행 변환 차단(로컬 QA 재현성 복구).

---

## 1. 최우선 인시던트: 5일간의 배포 정지

### 1.1 타임라인 (측정값)

| 시각 (UTC) | 사건 | 증거 |
|---|---|---|
| 2026-09-11 03:06:36 | 게이트 `ci-chat-ui-state-browser-check.mjs` 최초 도입 커밋 `487d181c` | `git log --diff-filter=A` |
| 2026-09-11 03:55:19 | **마지막 성공 Pages 배포** (v54.89, SHA `68bb0713`) | `gh run view 34560256326` |
| 2026-09-11 21:06:23 | **마지막 성공 CI run** (`34647687029`) | `gh run list --workflow=ci.yml` |
| 2026-09-11 21:21 ~ 09-16 00:44 | **CI 연속 실패 28회** | 同上 |
| 2026-09-16 00:28 | 데이터 refresh 사이클 정상 발행 | `public-data/data.json` `meta.generatedAt` |
| 2026-09-16 00:30 | `Data freshness watchdog` 실패 → 이슈 #4 | `gh run view 35040296255` |
| 2026-09-16 00:44 | 최신 push(`9fccf5ff`) CI 실패 | run `35041284404` |

### 1.2 근본원인 체인

```
게이트 셀렉터/픽스처 결함 3건 (browser-runtime shard)
   → CI job fail
      → attest job 미실행 → release attestation artifact 없음
         → pages-deploy.yml if: workflow_run.conclusion == 'success' 불충족
            → Deploy GitHub Pages = skipped (fail-closed, 설계대로 동작)
               → 라이브 사이트가 v54.89에서 정지
                  → watchdog external-pipeline 이 배포 SHA 불일치로 FAIL
                     → operations-alert 이슈 3건 생성·미해결
```

배포 차단 자체는 **의도된 fail-closed**다. 문제는 차단을 유발한 3개 게이트가 **제품 결함이 아니라 게이트 결함**이라는 점, 그리고 5일간 그것이 감지·수정되지 않았다는 점이다.

### 1.3 실패 게이트 3건 — 재현 및 원인

CI 로그: `Browser / browser-runtime` shard, `fail=3 skip=0` (run `35041284404`).
로컬 재현: 아래 셋 다 Windows 로컬에서 **동일하게 실패**했다(플랫폼 무관).

#### (a) `browser-chat-ui-state` — 죽은 셀렉터 (게이트 결함 확정)

- 실패 지점: `scripts/ci-chat-ui-state-browser-check.mjs:47` `AssertionError: false == true`
- 검증: `git log -S chat-home-stop -- js/aio-chat.js index.html js/aio-core.js js/aio-ui.js` → **출력 없음**. 즉 앱은 `#chat-home-stop` 을 **한 번도 만든 적이 없다.** 이 문자열은 `487d181c`에서 게이트 파일에만 추가됐다.
- 실제 DOM: `js/aio-chat.js:1612` `stopButton.id = options.stopButtonId || (buttonId + '-stop')`, `buttonId = 'chat-' + ctxId + '-btn'`(`:1576`) → 홈 챗의 정지 버튼 id는 **`chat-home-btn-stop`**. (AI 패널은 `index.html:27820`에서 `stopButtonId: 'ai-panel-stop'`로 오버라이드.)
- 로컬 A/B 실측:
  - 원본: `status=1` (line 47 실패)
  - 셀렉터만 `#chat-home-btn-stop` 으로 교정한 사본: `status=0`, `PATCHED GATE: ALL ASSERTIONS PASS`
  - 교정본의 격리 프로브 결과: `{"isolated":true,"leftoverStop":0,"streaming":false,"oldAborted":true}`
- **판정: 제품 로직(취소 턴 격리, 정지 버튼 정리, streaming 누수 없음)은 정상. 게이트 셀렉터만 stale.**
- 게이트의 다른 셀렉터 사용처(`:38`, `:53`)는 "개수 0" 기대라 죽은 셀렉터로도 우연히 통과했다. `:51`의 "개수 1" 기대에서만 드러난다.

#### (b) `browser-architecture` — `data-source-kind` 어휘 불일치 (게이트/계약 드리프트)

- 실패 지점: `scripts/ci-architecture-browser-check.mjs:543`
- 소스: `:212` `chartKinds: ['fxbond-tnx-trend','fxbond-jpy-trend','koreaCurveChart'].map(id => document.getElementById(id)?.getAttribute('data-source-kind') || null)`
- 허용목록: `['unavailable','server-history','live','public-information-service']`
- 실측 관측값(로컬 재현): `chartKinds: ["T3_PUBLIC_DELAYED","unavailable","unavailable"]`
- `T3_PUBLIC_DELAYED` 는 저장소 전역에서 쓰이는 **소스 티어 토큰**(`js/aio-data.js:12898,13434,12898` 등, `architecture/fixtures/factor-ranks-golden.json`)이며, 게이트의 허용목록은 다른 어휘이다.
- 그 외 필드는 문제 없음(`curveRenderer/renderer/nativeChartMarkers` 전부 `native`, 텍스트 비어있지 않음) → **결정적 실패 조건은 이 어휘 하나**.
- **판정: 런타임과 게이트가 같은 DOM 속성에 서로 다른 어휘를 가정한다. 어느 쪽이 정본인지 결정하고 한쪽으로 통일해야 한다.**

#### (c) `browser-screener-refresh` — 픽스처가 quote 증거 계약보다 낡음 (게이트 결함)

- 실패 지점: `scripts/ci-screener-auto-refresh-browser-check.mjs:90` — `visible prices not rendered: ["미수신" ×12]`
- 중요: 바로 위 `:89` 의 **quote 수요 등록 검사는 통과**(12/12). 즉 12개 종목 모두 `_aioQuoteRequestSymbols`에 등록됐는데도 가격이 렌더되지 않았다.
- 렌더 경로: `src/ui/pages/screener.js:323-327` → `finite(live.price) == null ? '미수신' : ...`
- 값 공급: `src/ui/pages/screener.js:142-150 liveRow()` — `row.fieldReadiness`가 **없으면** `readLiveData()?.[row.sym]`(= `window._liveData`)를 읽는다. `public-data/screener.json`에 `fieldReadiness`는 **0건**이므로 `_liveData` 경로가 맞다.
- 그런데 `_liveData` 소비는 게이트된다: `src/data/runtime-readers.js:48-59 quoteObservation()`
  ```js
  const row = root?._liveData?.[symbol] || {};
  const hasEnvelope = !!(row.quoteEnvelope && typeof row.quoteEnvelope === 'object');
  const envelope = hasEnvelope ? row.quoteEnvelope : row;
  // 주석: "A raw row may be accepted as a legacy envelope only when it carries
  //        the same explicit fields; source labels never fill them."
  const sourceKind = canonicalSourceTier(envelope.sourceKind);
  ```
  실패 시 반환 형태: `{ value: null, source: 'unavailable', ..., blockedReasons: ['evidence_missing'] }`(`:462`).
- 게이트 픽스처(`:59-71`)가 넣는 필드: `price, pct, marketCap, observedAt, fetchedAt, source, revision, changeBasis`.
  **빠진 필드: `sourceKind`, `allowedUse`, `rightsId`, `quality`/`qualityStatus`** — 실데이터 행(`js/aio-data.js:12898`)은 이들을 모두 보유한다.
- **판정: 런타임이 "증거 없는 시세"를 fail-closed로 거부한 것이고(설계대로), 게이트 픽스처가 그 계약 이전 형태다.** 제품은 정상, 픽스처가 stale.
- 미확정 경계: 교정 픽스처로 PASS를 직접 확인하지는 않았다(수정 단계에서 확인 필요). 위 결론은 코드 경로 + 재현 실패에 근거한 판정이다.

### 1.3.1 브라우저 게이트 전수 스윕 (23/23) — 5 실패, 그중 3건이 CI 차단

로컬에서 게이트 23개를 **개별 직접 실행**해 phase 차단을 우회하고 전수 스윕했다(`_artifacts/full-review-20260916/tools/sweep-browser-gates.mjs` → `browser-gate-sweep.json`).

| 결과 | 게이트 | 로컬 | CI |
|---|---|---|---|
| pass | 18개 | PASS | success |
| fail | `browser-chat-ui-state` | FAIL | **failure** |
| fail | `browser-architecture` | FAIL | **failure** |
| fail | `browser-screener-refresh` | FAIL | **failure** |
| fail | `browser-masters` | FAIL | success |
| fail | `artifact-budget` | FAIL | success |

**CI와 로컬의 차이가 원인 규명에 결정적이었다.** CI run `35041284404`의 job별 결론은 다음과 같다.

```text
success | Preflight / Contracts(core,data,knowledge,workspace,cloudflare)
failure | Browser / browser-runtime        ← 유일한 실패 shard
success | Browser / browser-knowledge      ← browser-masters·artifact-budget이 여기서 PASS
success | Browser / browser-unit / surface / viewport / resilience
skipped | Attest exact tested release       ← 의존성 실패로 attest 미실행
```

즉 **CI는 `browser-runtime` 3건 때문에만 red**이고, `browser-knowledge`는 Linux에서 통과한다. 추가로 실패한 로컬 2건은 CRLF 결함의 파급임이 확인되었다 — 두 게이트 모두 `dataset.aioMastersSelectedShard === 'connected'`를 기다리는데(`ci-masters-browser-check.mjs:80`, `ci-three-page-artifact-budget-check.mjs:87`), 이 상태는 `src/ui/pages/masters.js:1151`의 **클라이언트 sha256 검증**이 성공해야 도달한다. CRLF 체크아웃에서는 영원히 도달하지 않아 30초 타임아웃된다.

**결론: §2.3의 CRLF 결함은 "로컬 불편"이 아니라 ①브라우저 게이트 2개를 추가로 깨뜨리고 ②Masters 페이지 자체를 CRLF 체크아웃에서 기능 불능으로 만든다.** 동시에 "로컬은 실패, CI는 성공"이라는 관측이 오히려 원인을 확정해 준다.

### 1.4 영향

- **사용자**: 라이브 사이트가 5일 전 버전(v54.89)으로 서비스 중. 그 사이 v54.90~v54.97의 수정·데이터 개선이 배포되지 않음. `public-data`는 리포지토리에서 계속 갱신되지만 Pages에는 반영되지 않음.
- **운영**: watchdog이 상시 FAIL이라 알림이 무의미해지고(알림 피로), 이슈 3건이 열린 채 방치된다.
- **개발**: 로컬에서도 브라우저 게이트를 돌릴 수 없어(§2.3) 재현 경로가 없다.

---

## 2. 로컬 vs GitHub 상태

### 2.1 소스 동기화
- `git rev-list --left-right --count origin/main...main` → `0 0`. `git diff --stat origin/main` → 비어 있음. **로컬 = 원격.**
- 워킹 트리: 추적 파일 변경 0. untracked는 `.commandcode/`(로컬 taste 저장소)뿐.
- `version.json` = `v54.97`, `built 2026-09-15T10:49:00+09:00`.

### 2.2 원격 상태 (측정)
- 리포지토리: `ysnle/aio-screener`, public, default branch `main`, `pushed_at 2026-09-16T00:44:56Z`.
- Pages: `status built`, `build_type workflow`, `html_url https://ysnle.github.io/aio-screener/`, `https_enforced true`.
- **라이브 버전 실측**: `version.json` → `v54.89` / `deployment.json` → `sourceSha 68bb0713…`, `deployedAt 2026-09-11T03:55:53.217Z`. → **9개 리비전 지연**.
- 열린 운영 이슈 3건: #2 `[Operations] CI is failure`, #3 `[Operations] Deploy GitHub Pages is skipped`, #4 `[Operations] Data freshness watchdog is failure`.
- **stale 브랜치**: `origin/codex/v54.37-ai-reliability` — `origin/main` 기준 **424 behind / 0 ahead**, `git branch -r --merged origin/main`에 포함(완전 병합). 미병합 작업 유실 위험은 없으나 원격에 잔존.

### 2.3 로컬 재현성 결함 (HIGH, 별건)

`node scripts/qa-runner.mjs full --no-cache` 로컬 결과: **pass=99, fail=1, skip=23**.

- 실패: `masters-contract` — `[masters-contract] bounded projection digest/bytes drift for blackrock-inc` (`scripts/ci-masters-contract-check.mjs:137`). **CI(Linux)에서는 PASS**한다.
- 원인 실측:
  - `git config core.autocrlf` → **`true`**, `.gitattributes` **없음**(`git ls-files .gitattributes` 빈 결과).
  - 37개 매니저 bounded projection 객체 전부 디스크에서 CRLF로 체크아웃됨(객체당 **10,477개 CRLF, 단독 LF 0**).
  - 디스크 sha256 `ccf1fb0fe708`(370,039 B) vs 선언 `ee8a67440674`(359,562 B) → **불일치**.
  - **CRLF→LF 정규화 시 선언값과 정확히 일치**(`ee8a67440674`, 359,562 B). → 원인은 개행 변환 단독.
- 파급: phase 1 실패 → **브라우저 게이트 23개 전부 `blockedBy: ["masters-contract"]` 로 SKIP**. 즉 §1.3의 CI 실패 3건을 로컬에서 재현할 수 없게 만든 직접 원인이다.
- 추가 위험(런타임): `src/ui/pages/masters.js:1151`이 브라우저에서 `integrity: descriptor.sha256`으로 **클라이언트 검증**하고 실패 시 `manager shard integrity mismatch`를 던진다. 즉 CRLF 체크아웃 상태에서는 Masters 페이지가 행을 렌더할 수 없다(로컬 개발 환경에서 실사용 장애).
- **프로덕션은 건강**: 라이브 `public-data/objects/masters/7594e4c6….json` 실측 — `status 200`, **CRLF 0개**, sha256·bytes 모두 선언값과 일치. ⇒ 결함은 체크아웃 한정이나, `.gitattributes` 부재로 계약이 개행 변환에 무방비다.
- 수정: `.gitattributes`에 `public-data/objects/** -text`(내용주소 객체는 변환 금지) + `* text=auto eol=lf` 추가. 아울러 `scripts/build-masters-runtime-artifacts.mjs:105-110`은 해시·바이트를 `projectionText`로 계산하면서 파일은 **객체**를 넘겨 쓰므로(`writeAtomic(projectionFile, projection)`), 직렬화가 두 곳에 존재한다 — 단일 직렬화로 통일할 것.

### 2.3.1 게이트 실행이 남긴 부수 관측 (기록 후 원상 복구)

브라우저 게이트 23개를 실제로 실행하면서 **추적 대상인 게이트 산출물 6개가 재생성**되었다(세션 시작 시에는 clean). 원본 대비 변경은 `observedAt`/`appRevision`/`gitHead`가 v54.87 → v54.97, `2f5a8cbb` → `9fccf5ff`로 갱신된 것이었다.

- 대상: `_artifacts/accessibility-matrix-audit.json`, `boot-interaction-report.json`, `critical10-human-surface-audit.json`, `route-soak-report.json`, `structural-quality-20260906/browser.json`, `structural-quality-20260906/guide.png`
- 조치: **원상 복구했다**(`git checkout --`). 리뷰가 사용자 트리에 부수 변경을 남기지 않도록 하기 위함이며, 원시 diff는 `_artifacts/full-review-20260916/gate-output-refresh.diff`에 보존했다.
- **[관측, 미검증]** `accessibility-matrix-audit.json`은 재실행 시 **약 978줄 감소**했다(다른 파일은 수십 줄 규모). 접근성 감사가 기록하는 항목이 이전보다 크게 줄었다는 뜻이며, 감사 범위 축소인지 직렬화 변화인지는 확인하지 않았다. 별도 확인 가치가 있는 신호로 남긴다.
- **[보강]** 이 과정에서 git이 `LF will be replaced by CRLF` 경고를 6개 파일에 대해 출력했다 — §2.3의 `.gitattributes` 부재 결함을 독립적으로 재확인해 준다.

### 2.4 백그라운드 로그 캡처 (도구 한계, 기록용)
이 환경에서 백그라운드/리다이렉트 stdout 캡처가 빈 파일로 나오는 현상이 있었다(리포지토리 문제 아님). 그래서 게이트 증거는 자식 프로세스가 직접 결과 JSON을 쓰는 하네스로 수집했다(`_artifacts/full-review-20260916/evidence.json` 참조).

---

## 3. 영역별 심층 리뷰

심각도 정의: BLOCKER(서비스 불가) / HIGH(계약 위반·운영 차단) / MEDIUM(드리프트·잠복 결함) / LOW / INFO.

### 3.1 아키텍처

`hybrid-static-shell-native-esm` 선언은 **여전히 정확**하다. 셸(`index.html:13112-13114,15729,24352` defer) + ESM(`index.html:28560` → `src/app/bootstrap.js` → `src/app/router.js`)이 공존하며 라우트 renderer를 소유한다. 다만 실체는 "하나의 셸 + 하나의 ESM"이 아니라 **동시에 살아있는 두 개의 구현**이다(명시적 window 쓰기 872회, `window._*` 읽기 약 2,536회).

- **[HIGH] `sw.js` PUBLISHED_RUNTIME_ASSETS 등록부 드리프트** — `sw.js:33-221` 등록부가 실제 디스크와 불일치: **유령 11건**(`src/ai/provider/adapter.js` 등, `487d181c`/`07e59ba9`에서 삭제됨) / **누락 17건**(`src/ai/retrieval/knowledge.js`, `src/domain/portfolio/backtest.js` 등, `bootstrap.js`가 실제 사용). 근본원인: `scripts/ci-architecture-contract-check.mjs:21`의 `srcFiles` 변수가 **선언만 되고 사용되지 않음**. 런타임 소비자도 없음. → 양방향 대조 게이트 신설 또는 등록부 제거.
- **[HIGH] AG-DOM-WRITER 게이트 사각지대** — 추출기(`:470-479`)가 `getElementById`/`text(documentRef,'id')`만 인식하고 native 페이지의 `page.querySelector('#id')` 쓰기를 놓친다. 실측: native가 쓰는 id 35개 중 **13개**를 legacy도 쓴다(`ticker-chart-loading`, `spread-status`, `macro-fed-meaning`, `fxbond-risk-pill`, `yc-inversion-badge`, `carry-risk-level`, `breadth-*` 6종, `pf-donut-legend`). 현재는 `dataset.aioXxxRenderer !== 'native'` fence로 무해하나, fence 하나가 제거되면 게이트가 PASS시킨다. → 추출기를 `querySelector('#x')` 계열로 확장하고 id→owner 단일 표로 전환.
- **[HIGH] `src/legacy/compatibility-facade.js` read 계층은 죽은 표면이며 그 안에 도메인 로직이 3중 구현** — facade `read*`(`:474-482`)의 호출자는 테스트뿐(`ci-esm-core-unit-check.mjs:546-550`). 런타임은 `runtimeReaders.read*` 사용. 게이트가 오히려 facade read 사용을 금지(`ci-architecture-contract-check.mjs:157`). 그 안에 **trading-score 결정증거 입력 매핑(12개 metric id)** 이 3벌(`js/aio-core.js:23442-23531`, `compatibility-facade.js:337-406`, `src/data/runtime-readers.js:409-460`). 수식은 단일하지만 **입력 권한 판정(staleness/allowedUse/rights/quality)이 3벌**이다.
- **[HIGH] `bootstrap.js`가 src 177개 중 114개(844 KB)를 정적 import** — 부트 임계 경로 과대. `architecture/operations-slo.json`의 boot SLO는 `latestMeasuredBoot.status = "STALE_MEASUREMENT"`(v53.62)로 **현 리비전 미측정**.
- **[MEDIUM/HIGH] ESM 평면에 리비전 고정 없음** — 셸은 `?v=54.97`로 고정되지만 `src/app/bootstrap.js` 모듈 트리는 쿼리를 가질 수 없다. `asset-manifest.json`은 `rollback.strategy: "revision-pinned"`를 선언하나 URL 정체성으로 강제되지 않는다. GitHub Pages가 `_headers`를 적용하지 않으므로 엣지 완화도 불가.
- **[MEDIUM] `route-owners.json` counts 과대** — `rendererNative: 20`, `rendererLegacyRoutes: []`인데 `legacyWriterEvidence`가 비어있지 않은 라우트가 **12개**, `chartOwner=legacy` 8개, `narrativeOwner=legacy` 15개, `fullNativeOwner` 4개.
- **[MEDIUM] `dataOwner=native`는 호출경로 주장일 뿐** — `src/data/runtime-readers.js:4-7` 주석이 "legacy shell이 여전히 mutable 전역을 소유"라고 자인. 전역 쓰기 baseline ceiling 1097(`architecture/baseline.json:25`)로 burn-down 정체.
- **[MEDIUM] 로드순서 의존 전역 alias 스냅샷** — `js/aio-chat.js:2379-2381`(`window._aioRunScreenerQuery`), `:7658`(`window._fmtNum`), `:8142-8150`(`_renderFund*`). `defer` 순서가 바뀌면 조용히 `undefined`.
- **[MEDIUM] 롤백 기준선 미생성·미검증** — `asset-manifest.json:15-20`/`release-manifest.json:10-15`의 `lastKnownGood: "v53.17"`이 `appRevision v54.97`과 34리비전 격차. `bump-version.mjs`는 갱신하지 않고 게이트도 검사하지 않는다.
- **[LOW] `immutableRuntime`에서 `js/aio-glossary.js`·`sw.js` 누락**(`asset-manifest.json:7-14`).
- **[LOW] fallback fail-closed 불일치** — `js/aio-data.js:11702-11708`은 합성 중립값 `score:50`을 반환(defense-in-depth 권고), 다른 fallback은 null 기반.
- **[LOW] `pages-deploy.yml:73` `rsync -a src/`가 선언 allowlist(`src/**/*.js`)보다 넓음** — 현재 비-JS 0건이라 무해하나 향후 위험.
- **[INFO] `CODE-MAP.md`의 22 route/v53.x 앵커가 현행(20 route)과 불일치** — 스스로 `historical-snapshot`으로 한정.

### 3.2 알고리즘·분석 로직

BLOCKER 없음. 라이브에서 확정 오작동하는 로직은 없음.

- **[HIGH(가드 커버리지)] `currentSensitive`가 질문 텍스트에서만 파생 → 수치 검증 게이트가 흔한 질문에서 꺼진다** — `src/ai/intent/taxonomy.js:105-109`. 실측 분류: `"AAPL 어때"`/`"테슬라 분석해줘"`/`"엔비디아 실적 어때"` → `ENTITY_ANALYSIS`, **`currentSensitive=false`**; `"AAPL 주가 어때"` → `ENTITY_FACT`, `true`. 이 플래그가 `js/aio-chat.js:322`에서 `_aioStripUnverifiedCurrentNumericSentences`(`:239,302-306`)와 최종 고지(`:436`)의 **유일한 스위치**다. 따라서 티커만 언급한 질문에서는 모델이 문장 산문으로 현재가를 만들어도 구조적 방어가 걸리지 않는다. → 스위치를 질문 성질에서 분리해 "응답에 근거 미결속 숫자 토큰이 있으면 항상 처리"로 전환.
- **[MEDIUM] `deriveTradingScoreComponents`가 합성 점수와 불일치** — `src/domain/signal/trading-score.js:192-203`의 `weightedComponents`가 gate된 `trendScore`가 아니라 `trendCalcScore`를 쓴다. `maCurrent=false`에 MA 값이 전달되면 실측 `trendScore=null, coverage=100, missing=["trend"], total=75` — **커버리지 100%·부분 아님으로 표시되는데 총점에는 trend 20%가 포함**된다. 프로덕션은 `js/aio-core.js:23461-23463`이 null로 넘겨 미도달(잠복). → 한쪽 기준으로 통일.
- **[MEDIUM] `deriveRegimeState` 단위 규약 혼재** — `src/domain/screener/regime.js:11,19-23`에서 `trendScore/creditScore`는 −1..1, `breadthScore/volatilityScore`는 0..100. 실측 `trend=50 → +1`(포화). 현재 호출자(`ci-screener-workbench-contract.mjs:274-277`)는 규약 준수(잠복). → 단위를 이름에 박을 것.
- **[MEDIUM] `_aioEvidenceCanPublish`가 `reference`/`results_found`를 허용하고 source tier를 검사하지 않음** — `js/aio-chat.js:204-215`. 같은 시스템의 `src/ai/analysis/evidence-inputs.js:31`은 `isReferenceEligibleSourceKind`를 요구한다.
- **[MEDIUM] locale 의존 잔존 + 게이트가 동일 호스트에서만 회귀 검출** — `9fccf5ff`는 alias 3곳만 `compareStableText`로 교체. 잔존: `build-knowledge-evidence-registry.mjs:136`, `build-ai-knowledge-retrieval-index.mjs:44,55`, `build-atlas-current-evidence-ledger.mjs:46`, `build-13f-issuer-aggregates.mjs:50`, `build-13f-reference-ticker-index.mjs:71,73,76`, `src/domain/knowledge/graph.js:134`. `ci-knowledge-generated-parity-check.mjs:94-106`가 **같은 머신의 임시 복사본**에서 재생성하므로 호스트 로케일 차이로 인한 drift를 원리적으로 못 잡는다(→ 정적 금지 규칙이 더 강함).
- **[LOW] `ci-knowledge-core-semantic-check.mjs:17,19`가 정의되지 않은 `fail()` 호출** — 파일에 `assert`만 정의(`:14`). 조건이 항상 false라 미발화하지만 회귀 시 `ReferenceError`로 진단 손실.
- **[LOW] `benchmark-screener-workbench.mjs`의 `decision`이 벽시계 p95 의존** → 산출물 재현 불가.
- **[INFO] `backtest-trading-score.mjs:178`이 커밋 산출물에 `new Date().toISOString()`** → 매 실행 diff.
- **잠복(needs test)**: `src/domain/market/health.js:13-16`(`pct` 부재 시 `value` 폴백 → 가격이 등락률 자리에 들어갈 수 있음), `src/domain/macro/treasury-curve.js:16-20`(`clampYield`가 소수 단위 0.043도 통과), `src/ai/time/market-session.js:8-11,24`(2027년 이후 `isLatestUsRegularClose` 무음 false), `cloudflare-worker-proxy.js:555`(일일 캡이 UTC 기준이라 KST 09:00 리셋), `js/aio-core.js:6491-6495`(injection 플래그가 라벨만이고 내용은 그대로 전달).
- **건전 확인**: 순위통계(`scripts/lib/rank-statistics.mjs`) midrank/Pearson/Fisher z 정확; Wilson 구간(`conditional-evidence.js:60-75`) 표본 게이트 일관; 백테스트 look-ahead 없음(`backtest-trading-score.mjs:97-110`, `fetch-data.mjs:1957-2029`의 `closes.slice(0,p+1)`); walk-forward 방향이 주석과 일치(`backtest-factors-longrun.mjs:128-143`); 과중첩 표본 phase 분해(`backtest-trading-score-longrun.mjs:242-264`); adjusted-close 전용 강제 + 생존편향/PIT을 `blockers`로 명시(`fetch-data.mjs:1864-1882`, `src/domain/screener/pit-validation.js:19-35`); trading-score 가중치 합 100 + 0 나눗셈 가드; `predictiveValidation` 미확립 시 `NO_ACTION`; 증거 계약 fail-closed(`src/data/contracts/evidence.js`); 모델 출력 파싱 try/catch 격리(`src/ai/response/claim-ledger.js:84-103`); 마켓 세션 DST/반장/재개 처리; Sortino 분모 정정(`src/domain/portfolio/backtest.js:176-182`); 뉴스 점수 단어경계·`pubDate` 부재 제외; 프록시 Origin 화이트리스트/SSRF 차단/모델 allowlist/일일 캡 원자성.

### 3.3 데이터 소스·파이프라인

- **[MEDIUM] `reconciliation-status.json`의 `hy-oas/fred-source-identified`가 결정적으로 상시 FAIL** — 프로듀서 `fetch-data.mjs:3374`는 `macro._source_hyOAS='fred-official-public-csv'`(실측 `_asOf_hyOAS=2026-09-14`, `hyOAS=2.71`)를 쓰는데, 게이트 `build-reconciliation-status.mjs:251`은 `'fred-official-primary'`만 인정. `treasury-curve`(`:241`)는 두 값을 모두 인정하는데 hy-oas에만 미적용. 결과: 정상·공식·최신 HY OAS가 영구 PARTIAL(`promotable:false`). 계약 게이트는 동일 빌더 재빌드 비교라 이 드리프트를 못 잡는다.
- **[MEDIUM] 상태 산출물의 비원자적 쓰기 (게이트 미적용)** — `build-operations-status.mjs:220,466`, `build-reconciliation-status.mjs:376`이 `writeFile` 직접 사용. 원자성 게이트(`ci-data-continuity-check.mjs:134-145,157-159`)는 masters/fetch-data/market-snapshot만 검사. torn write 시 브라우저 `_reconciliationState`가 조용히 `unavailable`로 강등.
- **[MEDIUM] weekend grace가 3곳에서 UTC 요일** — `build-operations-status.mjs:170`, `js/aio-data.js:5397`, `ci-data-refresh-audit.mjs:112`. 선언 계약(거래소 시간대+휴장일)과 약 4시간 어긋난다. 정답 구현이 이미 존재: `ci-data-lineage-audit.mjs:29-48`.
- **[MEDIUM(잠재)] `scheduledSession`에 KR 휴장일 캘린더 부재 + 2027+ fail-open** — `build-market-snapshot.mjs:47-71`은 요일+시간창만 검사. US 캘린더는 2026 한정(`market-session.js:8-11`). 현 디스크는 전 row `session` 존재·`UNKNOWN` 0건(정상).
- **[MEDIUM] `structural-data-research.json` rot + 계보 라벨 오귀속** — `checkedAt 2026-08-21`, `entries[aaii] 32.9/22.6/44.4` vs `data.json.marketSurveys.aaii` `observedAt 2026-09-09`, `38/22.7/39.3` → **동일 지표 두 값 상충**. 프로듀서 `refresh-web-research.mjs`는 `source-registry.js:52`에 `weekly`로 선언됐지만 **어떤 워크플로도 실행하지 않는다**. `build-reconciliation-status.mjs:205`가 `sourceArtifact`를 structural 파일로 라벨링하지만 실제로는 `data.json`을 읽는다. 게이트 임계 180일이므로 방치 시 **2027-02-17경 watchdog FAIL 확정**.
- **[MEDIUM] 갭 서술 vs 실측 불일치** — `source-registry.js:148` "Seven manager … twelve-quarter" vs 실측 `reconciledManagers=37`, `totalPeriods=84`. 게이트는 `>=7`만 검사.
- **[LOW/MEDIUM] "SEC coverage"가 76.9%(`data.json.meta.fundamentalCoveragePct`)와 85.8%(`operations-status.json:141`)로 병존.**
- **[LOW] 신선도 배지 임계(60/180분, `aio-data.js:6415-6420`)가 선언 SLA 12h와 불일치**(보수적 방향).
- **[LOW] watchdog `max_age_minutes=360`(6h)이 선언 SLA 12h와 이중 계약** — GitHub cron 스로틀(1.0~4.2h 실측)과 결합해 정상 사이클도 FAIL 유발 가능.
- **[LOW] `EVIDENCE-DEBT.md`(v50.1) 라우트 21개 목록이 현행 20개와 불일치**(kr-* 라우트 부재). `DEFERRED-BLOCKS.md` B2/B4는 이미 해소되었으나 미갱신.
- **건전 확인**: 소스 평면 격리(`fetch-data.mjs:3289-3308 Promise.allSettled`); FRED 완전성(`refresh-continuity.mjs:6-17`); LKG 태깅이 실데이터와 구분(`:668-688`); 견적 50% 미달 시 throw(`:3562-3565`); 스냅샷 실패 시 LKG 유지 + 시도 기록(`build-market-snapshot.mjs:224-246`); P715 read-back 계약(`:3696-3701`); 발행 3중 게이트(`:3631-3644`); 산출물 원자성(`fetch-data.mjs` 6곳, `build-market-snapshot.mjs:240,244`); 현 디스크 전 아티팩트가 단일 사이클(`00:27:56`~`00:28:12Z`)로 정합; quote 계약 필수필드 게이트(`src/data/contracts/market-snapshot.js:106-136`); 레지스트리 HTTPS/tier 검증; 뉴스 40/40 출처·시각; `pages-deploy` exclude가 manifest와 동일.

### 3.4 자동화·CI·배포

- **[HIGH] 데이터 봇이 독립 CI 검증 **전에** main에 push** — `refresh-data.yml:132-190`(push 후 `gh workflow run ci.yml -f release_sha=…`). 자체 원장이 인정(P1073/R595, `_context/BUG-POSTMORTEM.md:19`, `QA-CHECKLIST.md:14` 미완료 `[ ]`). 즉 CI가 실패해도 검증되지 않은 리비전이 main에 남는다(배포는 attestation으로 차단되지만 리포지토리는 오염).
- **[HIGH] attestation이 테스트 scope를 인코딩하지 않음** — `ci.yml:54,84`가 `origin` 입력에 따라 실행 shard를 축소하는데, `pages-deploy.yml:45`는 `schemaVersion`과 `testedSha`만 검증한다. → `origin=refresh-screener` run이 미실행 shard를 가진 채 full-run attestation과 구별 불가.
- **[MEDIUM] `operations-alert.yml:81-88`의 API blast radius** — `github.paginate(listWorkflowRunsForRepo, {per_page:100})`에 **페이지 상한이 없어** 전체 이력 순회. rate-limit 시 reconcile 스텝이 throw하고, 이 워크플로는 자기 자신을 감시하지 않아 **알림 파이프라인이 조용히 죽을 수 있다**.
- **[MEDIUM] 미검사 버전 표면: Worker `AIO_APP_REVISION`** — `worker/wrangler.proxy.toml:13`이 **`v54.37`**(앱 v54.97과 약 60리비전 격차). `/health.revision`으로 노출되고 operations-status에 라이브 증거로 기록되며, 게이트는 toml↔live 일치만 본다. `bump-version.mjs`가 손대지 않아 릴리스마다 조용히 desync.
- **[MEDIUM] 사장 producer** — `refresh-web-research.mjs`(§3.3) 외 orphan 37개(대부분 수동 진단 도구). 진짜 dead(미언급) 스크립트는 0건.
- **[LOW] "항상 exit 0" 게이트** — `ci-doc-currency-check.mjs:76` `process.exit(0)`(경고만). 등록 id `doc-currency`가 매 run **PASS로 계상**되어 카운트를 부풀린다.
- **[LOW] 벤치마크가 게이트로 등록** — `qa-pipeline.json:123 screener-benchmark`는 실패 경로가 없다(임계 초과 시 `decision` 문자열만 변경).
- **[LOW] 리포팅 전용 게이트** — `ci-semantic-review-check.mjs:43`이 `releaseCertified=false`를 경고로만 출력(P1072/R594 설계 의도)하나 QA 카운트상 PASS.
- **[LOW] 중복 게이트** — `data-plane`(group `data`)과 `worker-data-plane`(group `cloudflare`)이 **동일 스크립트**(`ci-data-plane-contract-check.mjs`)를 `full`/`contracts`에서 두 번 실행.
- **[LOW] wrangler 버전 드리프트** — `deploy-ai-proxy.yml`은 `wrangler@4.120.0`/node 24, `deploy-data-plane.yml`은 `wrangler@4.44.0`/node 20. 게이트는 형식만 검사.
- **[LOW] `ci-workflow-compaction-check.mjs`의 하드코딩 백슬래시** — Linux에서 상대화 실패(표시 전용).
- **[LOW] `deploy-*.yml`이 만드는 `worker/wrangler*.toml`이 `.gitignore`에 없음** → 실수 커밋 여지.
### 3.4.1 R1 버전 계약 (검증)
R1 7표면(실제 열거 8항목) 전부 `v54.97`로 일치 — `<title>`(`index.html:10`), badge(`:6378`), `version.json`, `_context/CLAUDE.md:13`, `CHANGELOG.md:1`, `APP_VERSION`(`js/aio-core.js:2`), `SW_VERSION`(`sw.js:8`, `SW_BUILD`=`version.json built`), cachebuster 9곳(`?v=54.97`). R419 아티팩트(`asset-manifest.json:3,6`, `public-config.json:3`, `operations-status.json:11,82`)도 일치. **건강.** 문서 자기모순: "7곳"이라 쓰고 8개를 열거(`_context/RULES.md:1516` vs `:1518-1525`).

### 3.4.2 QA 러너 무결성 (건강)
`qa-runner.mjs`는 캐시를 CI에서 무력화(`:29` CI=true), spawn/timeout/signal 전부 FAIL 처리(`:303`), 선행 phase 실패 시 후속 SKIP(`:363`), `counts.FAIL → exit 1`(`:392`). **SKIP이 PASS로 세탁되지 않는다.** 게이트 입력 glob 중 매치 0건 없음. 오펀 스크립트 0건. 시크릿 유출 0건. `sync-agent-profiles`/`sync-agent-skills`/`generate-workspace-state`는 **로케일·개행·정렬 모두 고정된 결정적 구현**(`canonicalTextBytes`가 CRLF→LF 정규화까지 단정). Cloudflare 워커 2종은 `workflow_dispatch` 전용.

### 3.5 UI/UX·라우트

- **[HIGH] `--text-dim` 대비가 WCAG AA 대폭 미달** — 라이트 `#a29a89`(`index.html:83`) → `#fbf9f5` 대비 **2.63:1**, 다크 `#5c5d58`(`:4283`) → `#1b1d20` **2.54:1**. 12~13px 본문에 **143곳** 사용(RRG 상태문구 `:10616`, 기술분석 "시장 건강도" `:8161`, 뉴스 요약 `:11907`, placeholder `:426` 등). 게이트는 대비를 `UNVERIFIED`로 선언(`ci-accessibility-matrix-check.mjs:44`, `RULES.md:340`)하여 못 잡는다.
- **[HIGH] 브리핑 뉴스 목록 820px 잘림 + 펼침 버튼 미노출** — `index.html:5046` `max-height:820px; overflow:hidden`인데 `src/ui/pages/news.js:251` `moreButton.hidden = displayed.length <= 12`. 카드당 70~90px이므로 12건이면 900~1,100px → **스크롤 불가 상태로 마지막 카드가 소실**.
- **[HIGH] 네이티브 ESM 페이지가 토큰 팔레트를 우회한 하드코딩 색 사용** — 라이트 테마에서 텍스트 소실: `src/ui/pages/analysis.js:110,129`(`#86efac`, 대비 1.3:1), `news.js:97`(`#60a5fa` 2.4:1), `sentiment.js:101,150`(`#ffa31a` 1.9:1), `analysis.js:266`, `market.js:319,371`(`#4aa3df` 2.6:1). 규정(`index.html:85-86`)과 토큰(`--chart-1..8`, `:208-218`)이 있는데 미사용.
- **[MEDIUM-HIGH] `options` 라우트 완전 오펀** — 사이드바 `data-action="showPage"` 53개 어디에도 `data-arg="options"`가 없다. `index.html:6091`이 "옵션 페이지 폐기"를 명시하는데도 `route-owners.json`/`golden-routes.json`/`vertical-slices.js:17`이 정식 라우트로 선언 → **선언/실제 불일치**. 라우트 도달성 매트릭스상 유일한 ❌.
- **[MEDIUM] `#page-theme-detail` 데드 셸(127줄) + 동일 컴포넌트 2벌** — `index.html:10953-11079`는 절대 `.active`가 되지 않는다(`aio-core.js:27536-27542`가 `themes`로 리다이렉트). 실제 패널은 `#theme-detail-panel`(`:10842`)에 별도 존재. `QA-CHECKLIST.md:1236`의 "재도입 없음" 선언과 불일치.
- **[MEDIUM] 등록됐지만 도달 불가한 ESM lazy 모듈** — `bootstrap.js:435 modules['theme-detail']`은 `aio:pageShown`이 항상 `themes`로 발화되므로 **한 번도 mount되지 않는다**.
- **[MEDIUM] `.content{overflow-x:hidden}` + document 기준 뷰포트 게이트** — `index.html:1888`, 게이트는 `docEl.scrollWidth - clientWidth`만 측정(`ci-viewport-matrix-check.mjs:164`)하여 요소 단위 잘림을 못 잡는다.
- **[MEDIUM] 200ms `pageShown` dedup이 라우트 전이를 삼킬 수 있음** — `js/aio-core.js:27516-27527`. ESM 라우터가 이 이벤트만으로 전이(`router.js:216-226`)하므로 빠른 A→B→A 시 **DOM은 A인데 네이티브 렌더러는 이전 상태**로 남고 `route/changed` dispatch·신선도 watchdog도 누락.
- **[MEDIUM] `aio-ui.js:941-977`의 중복 popstate 핸들러** — 현재는 스크립트 순서(core 먼저)로 죽은 코드이나, 순서가 바뀌면 데드 셸 활성화·focus/prevPage/summary 갱신 누락.
- **[MEDIUM] `signal` 라우트 3중 이름 불일치** — 사이드바 "시장 환경"(`:6063`), 펄스바 "매매 시그널 상세"(`:6345`), 페이지 타이틀 "지금 거래해야 할까?"(`:6645`)가 `document.title`로 승격(`aio-core.js:27566-27571`) → 탭·스크린리더·히스토리 식별 불가. 같은 코드의 주석(`:27564-27565`)이 스스로 금지한 형태.
- **[MEDIUM] 탭 UI에 탭 시맨틱 부재** — `index.html:11645-11648`, `10335+`(`_aioFundTabSwitch` `aio-ui.js:1407`)에 `role=tab/tablist/tabpanel`·`aria-selected` 없음 → 어느 탭이 선택됐는지 낭독되지 않음.
- **[MEDIUM] 인라인 10/11px 폰트 1,882건** vs 문서화된 12px 하한(`index.html:151 --fs-min`, R51/R207). 게이트는 8px 이하만 실패 처리(`ci-viewport-matrix-check.mjs:95`).
- **[MEDIUM] 표시 포맷팅 로케일 비결정성** — 인자 없는 `toLocaleString()` 다수(`index.html:14280,17031,17190,17667,17668,18072-18083,21022,26352,26353,26661,26742,26752,26774`), `undefined` 전달(`23558,24640,24641`), 옵션 없는 `ko-KR`(`21226,21228,23022,26494,24679`) 혼용. 호스트 로케일에 따라 같은 화면에서 그룹핑이 뒤섞임.
- **[MEDIUM] 라우트 단위 데이터 상태가 사용자에게 미노출** — `router.js:184-202`가 `data-aio-vertical-slice-state`/`failure-state`/`issues`를 세팅하지만 **소비자가 0건**. stale 배너(`#snapshot-stale-warning` `:6374`)·`#server-data-age`(`:6385`)는 홈 전용.
- **[MEDIUM] 런타임 라이브 리전 14개(홈 한 화면)** — 정적 10개(게이트 상한과 정확히 일치, `ci-ux-default-path-check.mjs:61`) + 런타임 4개(`aio-ui.js:1362,1366`).
- **[LOW] 데드 CSS 3건**(`.home-quick-nav`), `AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY`(`aio-core.js:9797+`)의 라인 범위가 현 파일과 불일치.
- **[LOW] 반응형 브레이크포인트 28개/13값 난립**(768px 7회 중복 등).
- **[LOW] glossary 비활성 텍스트 하드코딩 `#8a8271`(`:24386`, 대비 ≈3.0:1)**; 영어 잔존("Price Chart", "Public Status", "LIVE REQUIRED", "Transition"); 44px 터치 타겟이 topbar 버튼들에 미적용.
- **[INFO] 부트 로더가 DOM 준비 시점에 닫힘**(데이터 아님).
- **건전 확인**: 20개 라우트 중 19개 인앱 도달 가능(매트릭스 별첨); 스킵링크→`#main-content`; 라우트 전환 focus 관리(`aio-core.js:27616`)·`aria-current`(`:27578-27585`); `<canvas>` 43개 전부 접근 이름 보유; 모달 포커스 트랩·복원(`_aioModalTrap:1558`, `_aioCloseGlossary:4691-4698`); `data-action` 디스패처의 Enter/Space 키보드 등가(`:2178-2187`) + 주입 노드 `aria-label` 자동 보정(`MutationObserver`); `principles.js`가 a11y 모범(SVG `aria-label`, sr-only 텍스트, `aria-busy`); 라우트 모듈 로딩 실패 시 `role="alert"` 한국어 안내(`router.js:12-28`); AI 오류 상태별 한국어 문구(`aio-chat.js:1979-1986,7360-7401`); 뉴스 empty/unavailable 명시(`news.js:163-169`); `index.html` id 1,052개 중 실측 중복 0건.

### 3.6 지식 경계·거버넌스

- **[MEDIUM] 사람검수 경계가 "측정"이 아니라 생성기 상수** — `build-knowledge-runtime-index.mjs:45-46`이 `humanReviewComplete:false`/`publicationReady:false`를 하드코딩. 정본 `architecture/human-validation.json`(`status NOT_EXECUTED`, `sessions: []`)과 decouple되어, 실제 검수가 완료돼도 자동 갱신되지 않는다.
- **[MEDIUM] "160 articles" 정의 불일치** — `status-summary.json:23-27` 160(principles 112 + atlasFoundations 48) vs `coverage-matrix.json`의 `articleStatus=STRUCTURED_REFERENCE_DRAFT` **188**(+nathan-frameworks 28) vs `CHANGELOG.md:37` "188개". 어떤 게이트도 두 값을 reconcile하지 않는다.
- **[MEDIUM] research breakdown(313/4/138)을 고정하는 게이트 없음** — `ci-knowledge-web-research-dossier.mjs:28-30`은 계산만 하고 assert하지 않음. 455·160만 고정.
- **[MEDIUM] UI "검토 {날짜}" 배지 vs 경계(human review=false)** — `principles.js:343,406`, `atlas.js:1078`, `masters.js:127`의 `REVIEWED_AT`는 지식 산출물 **생성일**(2026-08-18/08-16)이며 사람 검수일이 아니다.
- **[MEDIUM] BUG-POSTMORTEM.md 중복 P ID가 게이트에 안 걸림** — `P833`(:1673 & :2016), `P834`(:1682 & :2006), `P835`(:1691 & :1996). `ci-knowledge-lint-check.mjs:66`이 **heading 전체 문자열 동일**만 검출하므로 ID 충돌을 못 잡는다 → `grep P833`이 두 사건을 반환.
- **[LOW] RULES.md 중복/비표준** — `R301`(:1253 & :2165), `R230`(:1432 & :2045)는 명시 화이트리스트로 통과; `## R75.`(:1875) + `## R75 보강`(:1928)은 regex가 마침표를 요구해 미검출. heading 532개 vs max R595.
- **[LOW/INFO] QA-CHECKLIST.md 중복 QA ID 16개** — `QA-DATA-01`(:146 & :640) 등. 열린 집합 자체는 경계 선언("146 unique IDs / 150 rows / 4 superseded")과 **정확히 일치**.
- **[LOW] BUG-POSTMORTEM frontmatter 모순** — `:6 latest_P_number: P1073` vs `:8 current_total_entries: 781 (P1~P1067)`.
- **[LOW/INFO] ledger stale 수치** — `KNOWLEDGE-BASE.md:57,87,99,101`이 427/298/125/159를 유지(현행 455/313/138/160). 검색 시 표면화될 수 있음.
- **[LOW/INFO] `EVIDENCE-DEBT.md` v50.1**(§3.3와 동일 건).
- **[INFO] 문서 통화성 게이트는 전부 비차단** — `ci-doc-currency-check.mjs`는 항상 exit 0.
- **건전 확인**: 선언된 **455/313/4/138/160/19·95·73이 실제 산출물과 정확히 일치(drift 0)**; `CURRENT-STATE.md`·`CONTEXT-CATALOG.json`이 생성기 출력과 **byte 동일**(손편집 없음); 운영 경계 3값이 정본 JSON과 일치; 160개 article 전부 `STRUCTURED_REFERENCE_DRAFT` + `deepArticle.status=RECONSTRUCTION_REQUIRED` + publication=`EDUCATIONAL_REFERENCE_ONLY`(사람 검수 완료 주장 0건); `capability-manifest.js` 금지 claim과 `index.html:12323` 면책 문구 일치; 최신 R595/P1073 실존하고 **P1071/P1072/P1073의 Postmortem-To-Gate triad(RULES/QA/실행 게이트) 성립**.

---

## 4. 교차 확인된 건강 항목 (요약)

1. 로컬 = 원격 = `9fccf5ff`, 워킹 트리 clean(untracked `.gitignore` 대상 제외).
2. 라이브 프로덕션의 masters 객체 무결성 계약은 **정상 작동**(LF, sha256 일치).
3. 소스 동기화 결정성(locale/개행/정렬)과 QA 러너 fail-closed 의미론은 견고.
4. R1 7표면(8항목) 전부 `v54.97` 일치.
5. 라우트 집합이 **5개 소스에서 동일**(`index.html` DOM 20 = `route-owners.json` 20 = `routes.js` 20 = `aio-core.js PAGES` 20 = `golden-routes.json` 20), 순환 import 0건, 도메인 수식 단일 구현.
6. 데이터 아티팩트가 단일 사이클로 정합, 스테일을 live로 승격하는 경로 없음.
7. 지식 경계 수치 실측 일치 + 생성물 재현성 확보.

---

## 5. 미검증 / 차단 경계

- **브라우저 게이트 23개는 로컬에서 실행되지 않았다**(`masters-contract` 차단). §1.3의 3건은 개별 스크립트 직접 실행으로 재현했으나, 나머지 20개는 **미검증**이다.
- **CI 전량(full profile)은 실패 중**이므로 "CI green" 주장은 성립하지 않는다. 본 리포트의 검증 등급은 **static + local-runtime**까지이며 deployed certification이 아니다.
- 라이브 워커/엣지 헤더/제공자 권리는 로컬에서 인증 불가(`architecture/deployment-convergence.json`의 `localCannotCertifyLive: true`와 일치).
- (c) screener 픽스처 교정 후 PASS 여부는 **미확인**(수정 단계에서 검증 필요).
- 대비(contrast) 수치는 정적 sRGB 계산이며 실제 픽셀 샘플링이 아니다.
- UI/UX·알고리즘 영역의 일부 결함은 코드 경로 기반 **추론**이며 실사용 도달 빈도는 별도 측정이 필요하다.

## 6. 권고 실행 순서

**P0 — 배포 정지 해제 (게이트 3건 + 로컬 재현성 1건)**
1. `ci-chat-ui-state-browser-check.mjs` 셀렉터 교정(`#chat-home-stop` → `#chat-home-btn-stop`).
2. `ci-architecture-browser-check.mjs:543`의 `chartKinds` 어휘를 런타임과 단일화(`T3_PUBLIC_DELAYED` 포함 또는 다른 속성으로 분리).
3. `ci-screener-auto-refresh-browser-check.mjs` 픽스처에 quote 권위 필드 추가.
4. `.gitattributes` 신설(`public-data/objects/** -text`, `* text=auto eol=lf`).
→ 이후 `node scripts/qa-runner.mjs full --no-cache`로 23개 브라우저 게이트를 실제로 돌려 회귀 확인.

**P1 — 계약 드리프트 (운영 신뢰)**
5. `hy-oas` 출처 허용목록에 `fred-official-public-csv` 추가.
6. `build-operations-status.mjs`/`build-reconciliation-status.mjs`를 `atomicWriteFile`로 전환 + 원자성 게이트 범위 확대.
7. `worker/wrangler.proxy.toml`의 `AIO_APP_REVISION`을 버전 표면에 편입(또는 버전 파생으로 전환).
8. `refresh-web-research.mjs`를 스케줄에 편입하거나 `cadence`를 실제와 일치시키고 reconciliation 라벨 정정.
9. grace 판정을 UTC 요일 → 거래소 세션 계약으로 통일(3곳).
10. `--text-dim` 대비 조정, 브리핑 820px 잘림, 네이티브 하드코딩 hex → 토큰.

**P2 — 구조 (부채 상환)**
11. `sw.js` 등록부 ↔ 디스크 양방향 대조 게이트 신설, `ci-architecture-contract-check.mjs:21`의 죽은 `srcFiles` 활용.
12. AG-DOM-WRITER 추출기를 `querySelector` 계열로 확장.
13. `compatibility-facade` read 계층 삭제 + trading-score 입력 매핑 3벌 → 1벌.
14. attestation에 실행 scope 인코딩, 데이터 push를 staging 경유로 전환.
15. `options` 라우트/`#page-theme-detail`/`theme-detail` lazy 등록 정리.
16. locale 잔존 정렬 통일 + "무인자 `localeCompare` 금지" 정적 게이트.
17. 원장 중복 ID(P833/P834/P835, QA 16건) 검출 강화 및 stale 기준선(`EVIDENCE-DEBT.md`, `DEFERRED-BLOCKS.md`, `KNOWLEDGE-BASE.md`) 갱신.
18. CI green 회복 후 stale 브랜치 `codex/v54.37-ai-reliability` 정리.

## 7. 부록 — 재현 명령

```text
git rev-list --left-right --count origin/main...main
gh run list --workflow=ci.yml --limit 40
gh run view 35041284404 --log-failed
gh run view 35040296255 --log
gh api repos/ysnle/aio-screener/pages
curl -s https://ysnle.github.io/aio-screener/deployment.json
node scripts/qa-runner.mjs session-start --session full-review-20260916
node scripts/qa-runner.mjs full --no-cache
node scripts/ci-masters-contract-check.mjs
node scripts/ci-chat-ui-state-browser-check.mjs
node scripts/ci-screener-auto-refresh-browser-check.mjs
node scripts/ci-architecture-browser-check.mjs
git log -S chat-home-stop -- js/aio-chat.js index.html
git config core.autocrlf
```

기계 판독용 원시 증거: `_artifacts/full-review-20260916/evidence.json`.
브라우저 게이트 전수 스윕 원시 결과: `_artifacts/full-review-20260916/browser-gate-sweep.json`.
의미(semantic) 검토 리포트: `_artifacts/full-review-20260916/SEMANTIC-REVIEW.md` — R219 기준, BLOCKER 2건(NFP 단위 · 뉴스 stale 배너 차단) 포함.
