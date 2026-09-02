# Desktop remediation · 2026-08-30 — SUPERSEDED AGENT DRAFT

**Not final evidence.** The agent stopped at its usage limit. Main review rejected and removed the repeated global research-flow rail and rewrote its gate to test actual missing/recovery rendering. Statements below about that rail, flow metadata and full route continuity are obsolete. Final scope/evidence: [complete-remediation-20260830.md](./complete-remediation-20260830.md). Current-revision browser/live verification remains unavailable.

## 판정

- 정적/offline 연속성: **PASS** — `architecture/route-owners.json`의 20개 라우트가 모두 native lazy source와 공용 데스크톱 연구 흐름 메타데이터를 갖는다.
- 런타임 paint/live-data: **미검증** — 이 작업에서는 로컬 URL 브라우저 접근이 정책상 거부되어 다른 브라우저·CDP·headless 우회 검증을 수행하지 않았다.
- 기존 dirty 작업 트리: **보존** — 타 작업의 변경을 revert하거나 덮어쓰지 않았다.

## 이번 보정

- `src/ui/desktop-flow.js`: 모든 라우트에 공용 `시장 → 선별 → 비교 → 학습/AI → 포트폴리오` 레일을 제공한다. 현재 위치, 이전/다음 연결, 데이터 상태, 빈/blocked/stale 상태, 데이터 재시도 버튼을 DOM API로 생성한다. 선택된 테마가 없을 때 `theme-detail`로 이동하지 않고 테마 맵/선별로 되돌려 빈 목적지 링크를 피한다.
- `src/app/bootstrap.js`: 초기 진입과 `aio:pageShown` 라우트 재진입에 레일을 마운트하고, 상태 갱신 때 표시를 갱신하며 runtime dispose 시 이벤트와 DOM을 정리한다. 기존 병렬 변경은 보존했다.
- `src/ui/pages/market.js`: live quote와 snapshot 지표가 사라질 때 이전 숫자·변화색·as-of/release 메타를 남기지 않고 `—`, `unavailable/blocked` lineage로 지운다. 매크로 전이 렌즈는 전역 `document` 대신 주입된 `documentRef`를 사용한다.
- `src/ui/pages/themes.js`: RRG 사분면 부가 문구를 매매 지시(`비중 유지`, `진입 후보`, `익절 검토`, `회피`)가 아닌 관찰 언어로 정리했다.
- `src/ui/pages/principles.js`: 그래프의 모바일 전용 목록 클래스를 제거하고, 동일한 노드 텍스트 대안을 공통 screen-reader-only 목록으로 유지했다. 그래프의 접근성 정보는 보존하면서 모바일 전용 런타임 경로는 만들지 않는다.
- `scripts/ci-desktop-continuity-check.mjs`: route registry/owner/flow parity, five-stage order, native lifecycle source, shared empty/retry semantics, bootstrap mount/dispose, stale-value clearing, non-prescriptive quadrant copy, touch/swipe-only path 부재를 정적 검사하고 source coverage JSON을 출력한다.

## 20-route source coverage

| route | stage | native source | lifecycle / empty-retry | next |
|---|---|---|---|---|
| `home` | 시장 | `src/ui/pages/analysis.js` | mount/dispose · shared status + retry | `signal` |
| `signal` | 시장 | `src/ui/pages/analysis.js` | mount/dispose · shared status + retry | `breadth` |
| `breadth` | 시장 | `src/ui/pages/market.js` | mount/dispose · shared status + retry | `sentiment` |
| `sentiment` | 시장 | `src/ui/pages/sentiment.js` | mount/dispose · shared status + retry | `briefing` |
| `briefing` | 시장 | `src/ui/pages/news.js` | mount/dispose · shared status + retry | `market-news` |
| `technical` | 비교 | `src/ui/pages/analysis.js` | mount/dispose · shared status + retry | `ticker` |
| `macro` | 시장 | `src/ui/pages/market.js` | mount/dispose · shared status + retry | `fxbond` |
| `fxbond` | 시장 | `src/ui/pages/market.js` | mount/dispose · shared status + retry | `themes` |
| `themes` | 시장 | `src/ui/pages/themes.js` | mount/dispose · shared status + retry | `screener` |
| `theme-detail` | 비교 | `src/ui/pages/themes.js` | mount/dispose · shared status + retry | `technical` |
| `ticker` | 비교 | `src/ui/pages/entity.js` | mount/dispose · shared status + retry | `fundamental` |
| `fundamental` | 비교 | `src/ui/pages/entity.js` | mount/dispose · shared status + retry | `options` |
| `options` | 비교 | `src/ui/pages/entity.js` | mount/dispose · shared status + retry | `principles` |
| `portfolio` | 포트폴리오 | `src/ui/pages/portfolio.js` | mount/dispose · shared status + retry | `home` |
| `market-news` | 시장 | `src/ui/pages/news.js` | mount/dispose · shared status + retry | `macro` |
| `screener` | 선별 | `src/ui/pages/screener.js` | mount/dispose · shared status + retry | `theme-detail`* |
| `guide` | 학습/AI | `src/ui/pages/guide.js` | mount/dispose · reference status | `portfolio` |
| `principles` | 학습/AI | `src/ui/pages/principles.js` | mount/dispose · reference status | `masters` |
| `masters` | 학습/AI | `src/ui/pages/masters.js` | mount/dispose · reference status | `atlas` |
| `atlas` | 학습/AI | `src/ui/pages/atlas.js` | mount/dispose · reference status | `guide` |

`*` 선택된 테마가 없으면 공용 이동 버튼은 `themes`로 보정한다. 종목 선택 경로는 기존 screener/ticker 연결을 그대로 사용한다. `theme-detail`은 `themes.js`의 별도 native route factory를 사용한다.

## 이전 산출물 대조

`_artifacts/structural-rebuild-20260830.md`의 “20-route continuity 미검증”은 이번 정적 coverage/gate로 보정했다. 이전에 해결된 screener 입력, fundamentals epoch/reset, technical empty, RRG missing-data, AI 접힘 상태는 건드리지 않고 유지했다. 실제 화면 paint, live provider, 모바일/배포 상태는 여전히 이 환경에서 확인하지 않았다.

## 검증

통과:

- `node scripts/ci-desktop-continuity-check.mjs` — 20 routes / 20 flow entries / 20 lifecycle sources.
- `node --check src/ui/desktop-flow.js`
- `node --check src/app/bootstrap.js`
- `node --check src/ui/pages/market.js`
- `node --check src/ui/pages/themes.js`
- `node --check scripts/ci-desktop-continuity-check.mjs`
- `node scripts/ci-desktop-scope-check.mjs`
- `node scripts/ci-ux-default-path-check.mjs`
- fake-DOM mount/update/dispose smoke — PASS.
- `git diff --check` — 공백 오류 없음(기존 Git ignore 권한 경고만 출력).

현재 dirty 작업 트리와 무관하게 재현되는 것으로 보이는 차단:

- `node scripts/ci-research-flow-contract-check.mjs`는 `_fetchYahooChartData` 평가 중 `_aioFetchYahooChartData is not defined`로 중단됐다. 이 작업은 `js/aio-core.js`/`js/aio-data.js`를 수정하지 않았다.
- `node scripts/ci-architecture-contract-check.mjs`는 `directFetch increased from 42 to 43`으로 중단됐다. 이 작업의 소유 범위 밖의 기존 변경이며 원인을 숨기기 위해 기준을 조정하지 않았다.
- 로컬 브라우저 URL은 정책 거부 상태이므로 browser/live/paint 증거를 만들지 않았다.
- 전체 shared QA runner/full/no-cache 및 version gate는 요청 범위 밖이며 실행하지 않았다.

## 부모 작업 요청

새 `scripts/ci-desktop-continuity-check.mjs`를 부모 소유 `architecture/qa-pipeline.json`에 focused desktop-continuity 회귀 gate로 등록하고, 음성 대조 및 P/QA 기록을 부모 closeout에 합산한다. 이 작업에서는 `architecture/qa-pipeline.json`, `index.html`, `js/aio-core.js`, `js/aio-data.js`, 원장, 버전, commit/deploy를 변경하지 않았다.
