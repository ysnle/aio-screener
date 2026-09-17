---
title: AIO Screener 자동화·지속 운영 감사
audit_date: 2026-09-17
audit_revision: v54.98
local_head: da4d711a
remote_main_head: cb18382a
scope: 내부·외부(GitHub/Cloudflare) 자동화 전 영역의 무인 지속 운영 가능성
evidence_levels: static (repo) + runtime (local gate 재현) + live (Pages/Worker/GitHub API 관측)
---

# AIO Screener 자동화 · 지속 운영 감사 보고서

이 문서는 저장소 자동화 전 영역을 감사한 결과다. 구조 주장은 파일·행 인용으로, 운영 주장은 GitHub Actions 실행 ID와 라이브 HTTP 관측으로 뒷받침한다. **커밋·푸시·배포는 수행하지 않았다.**

---

## 0. 감사 방법과 증거 등급

| 등급 | 사용한 방법 |
|---|---|
| static | `.github/workflows/*`, `scripts/**`, `architecture/*.json`, `.claude`·`.codex`·`.commandcode` 직접 정독 |
| runtime (로컬) | `node scripts/ci-external-pipeline-check.mjs --mode watchdog` 직접 실행 재현 |
| live | GitHub API(`gh run list`, `gh api .../runs`), 라이브 Pages `deployment.json`·`data.json`, Worker `/health` 관측 |

측정 시각: 2026-09-17T13:58Z (관측 당시).

---

## 1. 결론 (판정)

> **데이터를 만들어 커밋하는 부분은 자동이다. 그 데이터가 라이브 사이트에 도달하는 부분은 자동이 아니다.**

- 데이터 수집 → 검증 → 봇 커밋 → CI 실행·검증·attestation 생성까지는 **무인으로 실제 작동 중**이다(오늘만 커밋 5건, 전부 CI green).
- 그러나 **attestation을 소비해 Pages에 배포하는 단계가 끊겨 있다.** 라이브 사이트는 **5커밋 / 13.4시간** 뒤처져 있고, 이 상태가 오늘 하루 종일 지속됐다.
- 따라서 "스스로 지속 운영 가능"은 현재 **성립하지 않는다.** 다만 고장 지점이 **단 하나의 경계(attestation → deploy)** 로 좁혀지며, 그 경계는 워치독이 **정확히 탐지하고 있다**(탐지는 되지만 아무도 처리하지 않음).

영역별 자립도를 요약하면:

| 영역 | 무인 지속 가능? | 근거 요약 |
|---|---|---|
| 데이터 수집/생산 | 예 | cron + LKG 폴백 + 원자적 쓰기 + fail-closed 게이트 |
| 데이터 → 라이브 반영 | **아니오 (현재 고장)** | `workflow_run` 미발화로 Pages 배포 정지 |
| CI 검증 | 예 | preflight→contracts→browser→attest, SHA 고정, blocking |
| 라이브 감시/탐지 | 예 (탐지까지) | 시간별 워치독 + 이슈 자동 생성 |
| 라이브 복구 | **아니오** | 자동 복구·재배포 없음, 이슈 4번이 열린 채 방치 |
| Cloudflare Worker(AI 프록시/패스트 플레인) | **아니오** | `workflow_dispatch` 전용 = 수동 배포, 19일 뒤처짐 |
| 엣지 보안 헤더/CSP | **아니오** | GitHub Pages가 `_headers` 무시, 정책상 WARN만 |
| 버전 범프 | 아니오 | 수동 실행 전용, 워크플로에서 호출 안 함 |
| 지식/서술 아티팩트 재생성 | 아니오 | 16개 빌더 수동 실행(패리티만 CI 검사) |
| AI 에이전트 자체 검증 | 부분 | 정적 계약만 검증, 행동 품질은 미측정 |
| 원장/핸드오프 기록 | 아니오 | 전부 수기 작성, 생성기 없음 |

---

## 2. 치명 결함 (즉시 조치 대상)

### A1. attestation → Pages 배포 체인 단절 — 라이브가 13.4시간 뒤처짐

**관측 사실 (live):**

- 원격 `main` HEAD = `cb18382a` (2026-09-17T12:36:04Z)
- 라이브 `https://ysnle.github.io/aio-screener/deployment.json` → `sourceSha = da4d711a` (2026-09-17T01:43:53Z 커밋)
- 라이브 `public-data/data.json` → `generatedAt = 2026-09-17T00:33:24Z` (**805분 경과**)
- 마지막 `Deploy GitHub Pages` 실행 = `35171985488` @ 2026-09-17T01:48:45Z
- `created=>2026-09-17T02:00:00Z` 저장소 전체 실행 조회 결과 **19건 중 `Deploy GitHub Pages` 0건**

즉 02:00Z 이후 main에 5건이 푸시됐다:

| 시각 | 커밋 | 워크플로 |
|---|---|---|
| 05:03 | `b159e14e` | Refresh screener → CI dispatch (success, attest 포함) |
| 05:27 | `50c6cb9d` | Refresh market data → CI dispatch |
| 10:27 | `8a8d6061` | Refresh market data → CI dispatch |
| 11:55 | `9fd6b88e` | Refresh screener → CI dispatch |
| 12:36 | `cb18382a` | Refresh market data → CI dispatch |

CI는 매번 성공했고(`35222057355`의 job 목록에 `Attest exact tested release ✓` 포함) attestation 아티팩트까지 생성됐다. **그 attestation을 소비하는 실행이 생성되지 않았다.**

**근본 원인 (증거로 확정):**

`.github/workflows/pages-deploy.yml:6-9`은 `workflow_run: workflows: ['CI']`로만 트리거된다. 그리고 `operations-alert.yml:6-8`도 `workflow_run` 목록에 `'CI'`를 포함한다. 두 워크플로 모두 `workflow_run` 의존이다.

실행 시각을 대조하면:

| `Operations failure escalation` 실행 | 직전에 완료된 워크플로 |
|---|---|
| 05:04:02 | Refresh screener (05:02:05 + 1m46s = 05:03:51) |
| 05:27:47 | Refresh market data (05:26:39 + 1m6s = 05:27:45) |
| 10:27:40 | Refresh market data (10:26:26 + 1m13s = 10:27:39) |
| 11:55:26 | Refresh screener (11:53:38 + 1m46s = 11:55:24) |
| 12:36:22 | Refresh market data (12:33:46 + 2m34s = 12:36:20) |

→ 에스컬레이션은 **항상 refresh 계열 완료 직후(1~11초)** 발생하고, CI 완료 시점(각 시작 +4분 → 05:08·05:32·10:31·11:59·12:40)에는 **단 한 건도 없다.**

refresh 워크플로는 `schedule`로 시작되므로 `workflow_run`이 정상 발화한다. 반면 CI는 `.github/workflows/refresh-data.yml:203`의 `gh workflow run ci.yml`로, 즉 **기본 `GITHUB_TOKEN`으로 디스패치**된다. GitHub는 GITHUB_TOKEN이 유발한 이벤트의 연쇄를 억제하며, `workflow_dispatch`는 실행 생성 자체는 예외로 허용되지만 **그 실행이 완료될 때 발생하는 `workflow_run`은 다시 억제된다.** 따라서:

- `schedule` → refresh → (성공/실패) → 에스컬레이션 ✅ 발화
- `GITHUB_TOKEN` → CI dispatch → CI 완료 → `workflow_run` ❌ **미발화** → Pages 배포·CI 실패 에스컬레이션 **둘 다 불가**

과거의 `skipped` 상태 `Deploy GitHub Pages` 실행들(`9fccf5ff`, `5525edd5`, `c925e080`, `7371e28b`, `ac98ec1f`)은 head 브랜치가 `main`이 아닌 CI(PR 계열)가 만든 것으로, 이와는 별개의 경로다.

**의미:**

- `refresh-data.yml:196-204`의 "Dispatch exact produced commit to CI" 단계는 **검증 목적으로만 유효**하고 배포에는 아무 효과가 없다.
- 라이브 데이터는 **사람이 커밋을 푸시할 때만** 갱신된다. 01:43의 사람 커밋(`da4d711a`)이 01:48 배포를 만들었고, 그 뒤로는 배포가 없다.
- 이는 `refresh-data.yml:173-178`에 기록된 **P572/R263 실패 클래스의 재발**이다(당시 기록도 "data.json 13h+ stale"). 당시 `[skip ci]` 제거로 CI는 살렸지만, **배포 경계는 살아나지 않았다.** `CHANGELOG.md`가 "별도 CI dispatch 경계가 남아 있다"고 적어둔 위험이 실제로 현실화된 상태다.

### A2. 워치독이 매 실행 실패 — 20회 연속, 이슈 #4 열린 채 방치

**관측 (live):** `data-watchdog.yml`은 2026-09-13T22:28Z 이후 **관측된 전 실행이 failure**(09-13 22:28, 09-14 01:14·06:27·14:14·19:29·23:12, 09-15 01:34·07:52·13:40·18:17·21:30, 09-16 00:30·06:09·11:48·17:08·20:14·23:02, 09-17 01:31·07:48·13:35). GitHub 이슈 **#4 `[Operations] Data freshness watchdog is failure` OPEN**.

**로컬 재현 결과** (`node scripts/ci-external-pipeline-check.mjs --mode watchdog`, exit 1):

```
status: FAIL
[x] pages-data-freshness        age=805m  max=360m
[x] pages-telegram-freshness    age=804m  max=360m
[x] pages-source-matches-attested-ci
        deployment=da4d711a… attestationRun=35171691927 observed=missing conclusion=missing
[o] pages-deployment-identity / pages-version-config / pages-repository-revision
[o] pages-data-quality symbols=78 news=40 / pages-screener-freshness age=985m ok=849/873
[o] proxy-health revision=v54.37 ready=true authority=us
[o] fast-plane-health revision=fast-quotes:e85c1b1b coverage=16/16
[o] github-*-latest-completed (CI/pages/refreshMarket/refreshScreener/deployProxy/deployFast)
warnings: ["live LLM market analysis is unavailable; typed fallback is active"]
```

세 실패는 **모두 A1의 결과**다. 워치독은 정상 작동 중이며, **A1을 정확히 탐지한 것이다.**

### A3. 워치독 실패 요약 스텝 자체가 고장 — 진단 정보가 사라짐

`data-watchdog.yml`의 "Summarize failed watchdog gates" 스텝은 JS 템플릿 리터럴(`${failed.map(...)}`)을 `node -e "..."`로 넘기는데, 그 문자열이 **bash에 먼저 확장**된다. 실행 로그에서 확인:

```
line 1: ${failed.map((entry)=>entry.id).join(', ') || 'unavailable'}: bad substitution
line 1: ${failed.map((entry)=>entry.id+': '+(entry.error||...)...}: bad substitution
line 1: ${skipped.map((entry)=>entry.id).join(', ') || 'none'}: bad substitution
line 1: -: command not found
```

결과적으로 **GitHub Step Summary가 빈 채로 발행**된다("## Watchdog failure detail" 뒤에 아무 내용 없음). 실패 게이트의 정체는 `qa-runner`의 200KB stdout 마지막 30줄로만 알 수 있는데 그마저 잘려서, 운영자가 원인을 즉시 파악할 수 없다. A2가 방치된 실질적 이유 중 하나다.

### A4. AI 프록시 Worker가 소스보다 19일/61버전 뒤처짐

```
proxy-health: revision=v54.37  sourceSha=6ef2561d…  (배포 2026-08-29T06:44:18Z)
저장소 현재:  v54.98  (2026-09-16)
최근 Deploy AI proxy 실행: 33239168575 @ 2026-08-29
```

`deploy-ai-proxy.yml:3-4`와 `deploy-data-plane.yml:3-4`는 `on: workflow_dispatch: {}` — **소스가 바뀌어도 자동 재배포가 없다.** `ci-cloudflare-deployment-contract-check.mjs:19`가 이 "수동 전용"을 **계약으로 강제**하고 있어, 자동화를 붙이면 게이트부터 고쳐야 한다. 라이브 `cloudflare-worker-proxy.js`는 현재 소스와 다른 코드(=19일 전 코드)를 서비스 중이며, `/health`의 `sourceSha`가 저장소 HEAD와 일치하지 않는다. `architecture/deployment-convergence.json`의 `aiProxy.releaseCoupling = "INDEPENDENT_MANUAL_DEPLOYMENT"`가 이 상태를 정책으로 선언해 두었다.

패스트 플레인도 동일: 라이브 `sourceSha=ac98ec1f`(2026-09-15T02:01) — 수동 배포.

---

## 3. 무엇이 자동인가 — 전수 인벤토리

### 3.1 GitHub (`/github/workspaces` = 9개 워크플로)

| 워크플로 | 트리거 | 자동화 내용 | 저장소 쓰기 | 판정 |
|---|---|---|---|---|
| `ci.yml` | push(main), PR, dispatch | preflight→contracts(5 shard)→browser(6 shard)→attest | 아니오 | 자동 |
| `pages-deploy.yml` | `workflow_run[CI]` | attested SHA만 체크아웃→Pages 배포→ post-deploy 검증 | 아니오 | **트리거 미발화 (A1)** |
| `refresh-data.yml` | cron `17,47 * * * *`, `13 7 * * *`, dispatch | 시세·뉴스·매크로 수집→fail-closed 게이트→봇 커밋·푸시→CI dispatch | **예** | 데이터까지 자동 |
| `refresh-screener.yml` | cron `23 */6 * * *`, dispatch | SEC fundamentals·earnings·screener 갱신→커밋 | **예** | 데이터까지 자동 |
| `data-watchdog.yml` | cron `23 * * * *` | watchdog-local+external 관측, 90일 SLO 아티팩트 | 아니오 | 탐지 자동 (A2·A3) |
| `operations-alert.yml` | `workflow_run[8개]` | 워크플로별 중복제거 이슈 생성/자동 종료 | 이슈만 | 알림 자동, 복구 없음 |
| `knowledge-lint.yml` | cron `13 4 * * 1` | 지식/워크스페이스/스킬 정적 lint | 아니오 | 자동 |
| `deploy-ai-proxy.yml` | **dispatch 전용** | Worker 배포 + secret + 스모크 | 아니오 | **수동 (A4)** |
| `deploy-data-plane.yml` | **dispatch 전용** | 패스트 플레인 배포 + 스모크 | 아니오 | **수동 (A4)** |

양호한 부분:
- 권한 최소화(workflow별 `permissions:` 명시), 액션 SHA 고정, `concurrency` 그룹 운영.
- refresh 계열은 커밋 전 fail-closed 게이트 통과 필수(`continue-on-error` 없음 — `ci-qa-pipeline-contract-check.mjs:216`이 계약으로 강제).
- 푸시 경합 대응 rebase 재시도 5회(`refresh-data.yml:180-192`).
- 워크플로가 참조하는 스크립트 경로는 전부 실재(60여 개 전수 확인).

결함/구멍:
- **`timeout-minutes`가 어느 워크플로에도 없다.** 행 걸린 job이 기본 360분을 점유하고, `refresh-*`는 같은 `concurrency.group: refresh-data`(`cancel-in-progress: false`)를 공유하므로 **다음 스케줄 주기가 그 뒤에 직렬로 막힌다.**
- **Dependabot / CODEOWNERS / ISSUE_TEMPLATE / PR 템플릿 전부 없음** → 액션 SHA 고정은 유지보수 주체가 없어 서서히 낡는다.
- `deploy-ai-proxy`(Node 24, wrangler 4.120.0)와 `deploy-data-plane`(Node 20, wrangler 4.44.0)의 **툴체인 불일치**.
- 데이터 시크릿(`FRED_API_KEY`, `TWELVE_DATA_API_KEY`, `FINNHUB_API_KEY`, `ANTHROPIC_API_KEY`, `SEC_USER_AGENT`)을 한곳에 문서화한 정본 문서가 없다.
- 자동 복구(롤백·재배포·재시도)가 **전혀 없다** — `operations-alert.yml`은 스스로 "자동 소스 변경·커밋·디스패치·배포를 승인하지 않는다"고 선언한다.
- cron은 best-effort다(별도 문서에 실측 1~3시간 간격 기록).

### 3.2 엣지 / Cloudflare

| 컴포넌트 | 자동화 주체 | 배포 |
|---|---|---|
| `cloudflare-worker-proxy.js` (`aio-proxy`) | `deploy-ai-proxy.yml` | **수동만** |
| `worker/data-plane.js` + `wrangler.example.toml` cron `*/5 * * * *` | Cloudflare 자체 cron | **수동만** |
| GitHub Pages 사이트 | `pages-deploy.yml` | 반자동 (A1) |
| `public-data/*.json` | refresh 워크플로 | 자동 |
| `public-config.json` | `build-operations-status.mjs` (refresh에서 호출) | 자동 |
| `_headers`, `robots.txt`, `sitemap.xml`, `public-artifact-manifest.json` | **없음 (수기 편집)** | — |

- Worker는 업스트림 재시도 루프가 없고(10s/60s 단발 fetch), 레이트리밋은 **isolate 로컬 Map뿐**이다. 실효 제한은 Cloudflare 대시보드의 WAF 규칙인데 **저장소에 버전 관리되지 않는다**(`cloudflare-worker-proxy.js:156-165`가 스스로 한계를 명시).
- `_headers`는 Pages 배포 아티팩트에 복사되지만 **GitHub Pages가 이를 소비하지 않는다.** `ci-live-invariant-check.mjs:107-111`이 이를 인정하고 `operator-required` 정책으로 **WARN만 발생**시킨다 → CSP·`X-Frame-Options`·`Permissions-Policy`가 라이브에 없다.
- `sw.js`: 셸·데이터 모두 network-first + 캐시 폴백. **TTL은 쓰기 시점(`purgeExpiredData`)에만 강제되고 읽기 시점에는 나이를 검사하지 않아**(`sw.js:340, 377`), 오프라인이거나 네트워크 실패가 반복되면 **임의로 오래된 시세를 무기한 서빙**할 수 있다.
- `worker/data-plane.js`의 `/quotes`는 **앱이 소비하지 않는다.** 오직 모니터링/배포 스크립트만 참조하고, `public-config.json.marketData.workerUrl`은 `aio-proxy`를 가리킨다. 5분 cron이 KV 무료 티어(≈384~576/1000 쓰기)를 소모하면서 실사용되지 않는다.
- 워커·CORS·CSP·모니터링 BASE가 전부 `https://ysnle.github.io`에 origin 결합 → 도메인 변경 시 전면 수정 필요.
- 키 노출은 없음(개인 키는 브라우저 로컬 저장 + provider 직접 호출, Anthropic 키는 Worker secret 서버측 전용).

### 3.3 데이터 파이프라인

- **단일 오케스트레이터가 없다.** 스케줄이 3개로 분산: `refresh-data`(30분)·`refresh-screener`(6시간)·`data-watchdog`(1시간). + Cloudflare cron(5분, 저장소 밖).
- 실패 처리는 대체로 fail-soft + LKG: FRED 계열별 `_failedSeries`/`fredLkgUsed`, Fear&Greed `stale-reference`, BLS `stale`, BEA `last-known-good`, Telegram은 이전 digest 보존, `build-market-snapshot.mjs`는 tier-0 불충족 시 이전 스냅샷을 **덮어쓰지 않고** `attemptStatus:'failed'`만 기록.
- 신선도 계약: `ci-data-refresh-audit.mjs` 22개 카테고리 cadence별 임계(daily 2일/weekly 8일/monthly 35일/그 외 120일), `marketCycleFreshnessSlaHours: 12`, 워치독 `AIO_LIVE_MAX_AGE_MIN=360`.
- 무료 티어 예산: Finnhub 회당 2콜, SEC `SEC_USER_AGENT` 필수 + 150ms 간격 + 배치 24, KV 일 1000 쓰기 하한 준수. **키 로테이션은 없음**(provider당 단일 시크릿).
- **결함:** `<50% quotes` 시 `CORE_QUOTE_COVERAGE_FAILED`가 런 전체를 throw(`fetch-data.mjs:3601-3604`) → 이후 단계(Telegram·13F/masters·매니페스트 동기화·커밋)가 `if: always()` 없이 **전부 스킵**된다. 시세 장애 하나가 사이클 전체를 날린다.
- **결함:** `refresh-web-research.mjs`(AAII/NAAIM/KR-export)는 **어느 워크플로에도 없다.** `CHECKED_AT = '2026-08-21T15:00:00Z'`가 27일째 고정 — 라이브 `data.json`의 `marketSurveysCheckedAt`도 동일.

### 3.4 AI 에이전트 구조

- 캐노니컬은 `.claude/`, Codex 미러는 `.agents/`(바이트 동일 복사), 프로파일은 `architecture/agent-profiles.json`에서 `.claude/agents/*.md`·`.codex/agents/*.toml`로 **생성**.
- 스킬 6개 + 커맨드 래퍼 9개 + 프로파일 4개. 계약 검사가 라우터 분량(≤90행/≤12KB), 참조 실재, 래퍼↔스킬 매칭, 미러 패리티를 **기계적으로** 강제.
- 훅은 `scripts/agent-hook.mjs` 단일 구현(`guard-command`, `guard-edit`, `session-start`, `post-edit`). 파괴적 명령 deny, `_backup/`·`_archive/` 편집 차단, 세션 시작 프리플라이트 주입. **커밋/푸시/배포 훅은 없고 계약이 그 부재를 강제**(`ci-workspace-contract-check.mjs:42-49,125-129`).
- 검증 루프: `generate-workspace-state --check`(preflight CI), `sync-agent-skills/profiles --check`(workspace 그룹 + 주 1회 lint), `ci-skill-contract-check`, `ci-skill-eval-fixture-check`, `ci-knowledge-lint-check`, `ci-workspace-contract-check`, `ci-qa-pipeline-contract-check`.

**실제 결함 2건 (신규 발견):**

1. **`guard-edit`·`post-edit` 훅이 Claude Code에서 작동하지 않는다.** `scripts/agent-hook.mjs:30`이 `toolInput.command`만 읽는데, Claude Code의 `Edit`/`Write`는 `{file_path, old_string, new_string}`를 넘기고 `command` 키가 없다. 따라서 `_backup/`·`_archive/` 편집 차단(53-58행)과 편집 후 QA 리마인더(79-83행)는 **정규식이 빈 문자열에 대해 평가되어 사실상 무력**하다. Codex `apply_patch`에서만 동작한다. 그런데 `ci-workspace-contract-check.mjs:64-81`의 훅 픽스처는 **Codex 페이로드 형태만** 테스트하므로 이 결함은 **영원히 green으로 남는다.**
2. **`.claude/settings.json`에 `SessionStart` 훅이 없다.** Codex(`.codex/hooks.json`)만 세션 시작 시 `CURRENT-STATE` 프리플라이트를 받는다. 두 클라이언트 간 비대칭.

부수적으로 빠른 정정: `.commandcode/taste/taste.md`의 `See [taste/taste.md](taste/taste.md)` 링크는 **유효**하다(`.commandcode/taste/taste/taste.md`가 실제로 존재). 깨진 링크라는 분석은 오판이었다.

### 3.5 텍스트 / 차트 / 지표

- **차트는 100% 런타임 생성**이다. 커밋되는 차트 이미지/SVG 자산은 `og-image.svg`(소셜 프리뷰)뿐. Chart.js 4.4.0(+2차 CDN 폴백+오프라인 메시지 스텁)과 lightweight-charts 4.2.0, 그리고 RRG 캔버스·breadth 스파크라인·SVG 스파크라인·PNG 리포트 등 수제 렌더러.
- 지표 계산의 단일 원천은 `src/domain/**`(예: `src/domain/signal/trading-score.js`). 다만 레거시 수식이 `js/aio-core.js`(SMA/EMA/ATR/RSI/MACD/BB)와 `index.html`에 **중복 잔존**한다. breadth 일부는 서버에서 `history.json`으로 **선계산**된다(`fetch-data.mjs:3203-3245`).
- 서술 생성은 3계층: 서버 LLM(`genMarketAnalysis`, haiku→VIX≥25 시 sonnet) → 결정론적 클라이언트 템플릿(`synthesizeMarketAnalysis`) → 수기 지식 원문을 빌더로 조립. **라이브는 현재 `marketAnalysisOk=false`로 폴백 템플릿 상태**(워치독 warning에도 잡힘).
- 지식 아티팩트(16개 빌더, lessons/articles/learning graph 등)는 **CI가 패리티만 검사**하고 실행은 수동이다. 원문을 고치고 빌더를 안 돌리면 CI가 깨진다(의도된 가드).
- 렌더 검증: 브라우저 유닛 352개 차트/렌더 단언 + Playwright 헤드리스(**외부 네트워크 전면 차단** → 오프라인 상태만 측정) + 뷰포트 매트릭스. **시각 회귀는 픽셀 비교가 없고 스크린샷 저장뿐**이라 차트 라벨 회귀는 green으로 통과한다.

### 3.6 버전 / 릴리스 / QA 파이프라인

- `architecture/qa-pipeline.json`: **4 phase / 14 group / 134 gate**. kind는 static 6그룹 101게이트, browser 6그룹 23게이트, external 2그룹 10게이트. 게이트별 `timeoutMs` 기본 120초(뷰포트만 600초).
- `qa-runner.mjs` 모드: `session-start`, `affected`(기본), `rerun-failed`, `full`, `watchdog`, `external`. 콘텐츠 해시 기반 성공 캐시(`gateFingerprint` = 스크립트 바이트 + 입력 파일 sha256 + 플랫폼/노드 major), **CI 환경에서는 캐시 강제 해제**. phase 장벽은 **교차 phase에서만 fail-fast**(같은 phase 형제는 전부 실행).
- attestation: `aio-release-attestation.v1`(테스트된 SHA) → Pages가 그 SHA만 체크아웃. 구조는 정확하다. **문제는 소비자가 호출되지 않는다는 것(A1).**
- `bump-version.mjs`는 실제로 **20개 이상 표면**을 패치한다(index.html title/badge/캐시버스터, `APP_VERSION`, `SW_VERSION`/`SW_BUILD`, `version.json`, CLAUDE.md 2개, principles 핸드오프 계열 다수, `public-config.json`, architecture 5~6개, `operations-status.json`, RULES, 그리고 `generate-workspace-state --write`까지). 전면 preflight 후 원자적으로 쓰는 구조로 개선되어 있다. 단 **어느 워크플로도 이를 호출하지 않는다** — 수동 전용이고, CHANGELOG 본문은 사람이 채워야 한다.
- `ci-version-check.mjs`는 7곳 일치를 검증하지만 **라이브 배포 아티팩트와는 대조하지 않는다**(그건 live gate의 몫).
- 게이트 수는 많지만 조용히 무시될 수 있는 경로가 존재한다 → §5.

---

## 4. 자동화되지 않는 것 — 수동/운영자 의존 전수 목록

1. **Cloudflare Worker 재배포 2종** (`deploy-ai-proxy`, `deploy-data-plane`) — 소스 변경 시에도 수동. (A4)
2. **Cloudflare 대시보드 수동 설정** — WAF 레이트리밋 규칙, KV 네임스페이스 `aio-quotes-prod`, Durable Object 바인딩 `AIO_QUOTA_DO`, Worker secret `AIO_CRON_SECRET`, `AIO_DEV_ORIGINS`, `AIO_APP_TOKEN`.
3. **저장소 시크릿/변수 프로비저닝** — `FRED_API_KEY`, `TWELVE_DATA_API_KEY`, `FINNHUB_API_KEY`, `ANTHROPIC_API_KEY`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `AIO_QUOTES_KV_ID`, `AIO_PROXY_URL`, `AIO_FAST_QUOTES_URL`, 그리고 **변수 `SEC_USER_AGENT`(연락 이메일 포함)**. 단일 정본 문서 부재.
4. **버전 범프** — `node scripts/bump-version.mjs <ver>` 수동. 워크플로 호출 없음.
5. **엣지 보안 헤더 적용 확인** — `LIVE_HEADER_POLICY=enforce` 전환은 운영자 판단. 그 전까지 CSP 미적용은 WARN.
6. **손 큐레이션 정적 DB(S1~S6)** — `public-data/screener-universe.json`은 **90일 하드 만료**(`ci-static-db-expiry-check.mjs`), `AIO_MACRO_CALENDAR.lastRelease` 승격, `AIO_MANUAL_REFERENCE`, KR_STOCK_DB/KR_THEME_MAP 등. 만료 시 빌드가 red가 되지만 **자동 복구는 없다.**
7. **웹 리서치 스냅샷 재생성** — `refresh-web-research.mjs` 무스케줄, `CHECKED_AT` 2026-08-21 고정.
8. **지식 아티팩트 재생성** — 16개 `build-knowledge-*`/`build-principles-*` 빌더 수동 실행.
9. **워크스페이스 상태/에이전트 표면 재생성** — `generate-workspace-state --write`, `sync-agent-profiles`, `sync-agent-skills`.
10. **원장 기록 전부** — `RULES.md`, `BUG-POSTMORTEM.md`, `QA-CHECKLIST.md`, `KNOWLEDGE-BASE.md`, `CHANGELOG.md` 본문, `_artifacts/*/HANDOFF.md`, `_context/INDEX.md`의 "Current and live state" 포인터. **생성기가 하나도 없다**(grep 결과 0건). `bump-version.mjs`는 CHANGELOG **섹션 헤더만** 삽입한다.
11. **`operator-note.json`** — GitHub UI로 사람이 편집.
12. **운영 이슈 트리아지/복구** — 이슈 #4가 열린 채 방치된 것이 실증.
13. **provider 권리/라이선스 검토** — `operations-status.json` blockers: `fast_plane_soak_and_rights_review_required`, `provider_rights_review_required`; `overall: OPERATOR_REQUIRED`, `publicBetaDecision: BLOCKED_UNTIL_OPERATOR_CRITERIA_CLOSE`.
14. **30일 SLO 인증 / 7일 소크** — `public-readiness.json`의 `thirty-day-slo`, `accessibility-manual`, `live-revision`, `edge-security-headers`가 전부 `OPERATOR_REQUIRED`.
15. **커밋/푸시/배포** — 설계상 금지(에이전트 계약).

---

## 5. 조용히 무시될 수 있는 실패 경로

| # | 경로 | 기전 | 근거 |
|---|---|---|---|
| 1 | `doc-currency` 게이트 | 의도적으로 항상 `exit 0`, ±500행 드리프트도 통과 | `ci-doc-currency-check.mjs:76-77` |
| 2 | 헤드리스 스킵 리스트 | 목록에 있는 실패는 비차단 | `ci-headless-tests.mjs:273,288-291` + `_context/gate-baseline-skip-list.json`(현재 빈 배열) |
| 3 | 브라우저 오류 허용목록 | 허용된 런타임 오류 비차단 | `ci-headless-tests.mjs:284,297-300` + `architecture/browser-error-allowlist.json`(현재 빈 배열) |
| 4 | `affected` 프로파일의 `external` 제외 | live 게이트는 watchdog 프로파일에서만 실행 | `qa-runner.mjs:159-160,166` |
| 5 | `full` 프로파일이 `external`·`watchdog-local` 제외 | 전체 검증이라도 live는 안 돌음 | `qa-pipeline.json:7` |
| 6 | `rerun-failed`가 `SKIP`을 무시 | phase 장벽에 막힌 게이트는 재실행 안 됨 | `qa-runner.mjs:170` |
| 7 | `timeoutMs` 미지정 게이트 | 조용히 120초 기본 적용 | `qa-runner.mjs:298` |
| 8 | `continue-on-error` 2곳 | 워치독은 후속 스텝이 재실패 처리, 배포는 재시도 후 실패 처리 → 현재는 봉합됨 | `data-watchdog.yml:41,70-72`, `pages-deploy.yml:96,102-111` |
| 9 | **`workflow_run` 미발화** | CI 결과가 에스컬레이션에도 전달되지 않음 → CI red가 조용히 지나갈 수 있음 | §2 A1 |
| 10 | 워치독 요약 스텝 고장 | 실패 상세가 Step Summary에 안 남음 | §2 A3 |

시각 회귀 무검출(픽셀 베이스라인 없음), 스킬 행동 품질 미측정(픽스처 존재만 검사), 의미 검토 커버리지 6.89%·`releaseCertified=false`는 별도의 "자동화 불가" 경계로 남아 있다.

---

## 6. 지속가능성 판정 — 사람이 멈추면 무엇이 먼저 죽는가

시간 순 예상:

1. **즉시 (이미 발생)** — A1로 라이브 데이터가 멈춘다. 사람이 푸시할 때만 갱신된다. 워치독이 red로 남고 이슈 #4가 열린다.
2. **1~2주** — `screener-universe.json` 90일 만료가 다가오면 `ci-static-db-expiry-check`가 **preflight/contracts를 red로** 만들고 → `attest` 스킵 → **배포가 완전히 정지**한다(R603이 경고한 경로).
3. **45일** — `CURRENT-STATE.md` 등 `last_verified` 경고가 누적되고, `INDEX.md`가 가리키는 핸드오프가 죽은 포인터가 된다(R598 위반 재발).
4. **그 이후** — 원장이 갱신을 멈추지만 `ci-knowledge-lint-check`는 중복 검사만 하므로 **게이트는 green인 채로 원장만 썩는다**. AI 프록시는 소스와 계속 벌어진다(A4).

정리: 이 시스템은 **기계적으로 검증 가능한 사실에 대해서는 닫힌 루프**이고, **의미·서술·운영 판단에 대해서는 열린 루프**다. 열린 루프 쪽의 마지막 연결(attestation→deploy)이 현재 끊겨 있다.

---

## 7. 우선순위 조치 제안 (실행은 명시 요청 시)

| 순위 | 조치 | 대상 |
|---|---|---|
| P0 | 배포 트리거를 `workflow_run` 의존에서 벗어나게 한다 — refresh 워크플로가 **attested SHA를 직접 배포**하도록(`workflow_call` 재사용 워크플로 또는 refresh 내 배포 job) 연결한다. 또는 CI dispatch에 PAT/App 토큰을 사용해 `workflow_run`이 발화하게 한다. | `pages-deploy.yml:6-9`, `refresh-data.yml:196-204`, `refresh-screener.yml` |
| P0 | 워치독 요약 스텝의 bash 치환 버그를 제거한다(`node -e`에 스크립트 인자를 here-doc/파일로 전달). | `data-watchdog.yml` |
| P1 | 이슈 #4를 소유·종결하고, 배포 경계가 복구된 뒤 `pages-*` 신선도 임계와 정책을 재검토한다. | 운영 |
| P1 | Cloudflare Worker 배포를 소스 변경 시 자동화하거나(계약 게이트 동시 수정), 최소한 **소스↔라이브 SHA 불일치를 red로** 승격한다. | `deploy-*.yml`, `ci-cloudflare-deployment-contract-check.mjs` |
| P1 | 모든 워크플로에 `timeout-minutes`를 부여한다(특히 공유 concurrency 그룹). | `.github/workflows/*` |
| P2 | `guard-edit`/`post-edit` 훅이 `file_path`도 읽도록 고치고, **Claude 페이로드 픽스처를 추가**한다. `.claude/settings.json`에 `SessionStart`를 추가한다. | `scripts/agent-hook.mjs`, `ci-workspace-contract-check.mjs` |
| P2 | 50% 시세 게이트가 사이클 전체를 죽이지 않도록 후속 단계를 `if: always()`로 분리한다. | `fetch-data.yml`, `fetch-data.mjs:3601` |
| P2 | Dependabot·CODEOWNERS·시크릿 정본 문서를 추가한다. | `.github/` |
| P3 | `refresh-web-research.mjs`를 스케줄에 편입하거나 명시적 BLOCKED로 고정한다. | 워크플로 |
| P3 | `sw.js` 읽기 경로에 최대 나이 가드를 넣는다. | `sw.js:340,377` |
| P3 | 미사용 패스트 플레인 `/quotes`를 제품에 연결하거나 KV 소모를 중단한다. | `worker/data-plane.js`, `public-config.json` |

---

## 8. 검증 경계 (이 보고서가 주장하지 않는 것)

- 이 감사는 **커밋·푸시·배포를 수행하지 않았다.** 로컬 작업 트리는 `.commandcode/`(untracked)와 본 보고서 외 변경이 없다.
- A1의 **정확한 GitHub 내부 기전**(GITHUB_TOKEN 연쇄 억제)은 관측 패턴에서 도출한 최선의 설명이며, 관측 자체(배포 런 부재·escalation 타이밍)는 위조 불가능한 API 데이터다.
- 브라우저/실사용자 관점 검증, 의미(semantic) 검토, provider 권리 검토는 이 감사 범위 밖이며 미검증으로 남는다.
- 라이브 수치는 2026-09-17T13:58Z 관측값이며 이후 변동될 수 있다.

---

## 9. 구현 결과 (v54.99, 2026-09-17)

§7 조치안 중 로컬에서 닫을 수 있는 항목을 구현하고 각각을 실행 가능한 계약으로 고정했다. **커밋·푸시·배포는 하지 않았다.**

| 조치 | P/R | 구현 | 회귀 게이트 |
|---|---|---|---|
| P0 배포 경계 복구 | P1087 / R606 | `pages-deploy.yml`에 attested `workflow_dispatch` 경로(런 결론·브랜치·SHA 재검증 + 아티팩트 검증 유지), `scripts/ensure-live-convergence.mjs` 신설(멱등 수렴·자기치유), refresh 2종에 `--await-sha` 수렴 스텝 | `ci-qa-pipeline-contract-check.mjs` hand-over 단언 4건 |
| P0 워치독 진단 | P1083 / R610 | 인라인 `node -e` 템플릿 리터럴 제거, `scripts/report-qa-failures.mjs`로 분리 | 인라인 템플릿 리터럴 금지 + 상세 라벨 단언 |
| P1 실행 상한 | P1088 / R607 | 9개 워크플로 10개 job에 `timeout-minutes` | 전 워크플로 파싱 후 job별 정수 요구 |
| P2 훅 정합성 | P1084 / R611 | `agent-hook.mjs`가 `file_path`/`notebook_path`/`path`/`command`를 함께 판정, `.claude/settings.json`에 `SessionStart` 추가 | Claude 페이로드 픽스처 6건 + 클라이언트 대칭 단언 |
| P2 사이클 견고성 | P1085 / R609 | 레인 `!cancelled()` 격리 + 발행 조건 명시 fail-closed | 격리·발행 경계 동시 고정 단언 |
| P3 SW 나이 가드 | P1086 / R608 | `cachedWithinMaxAge`/`staleResponse`, `_stale` 구분 표시 | SW 캐시 정책 게이트 단언 6건 |
| P2 레포 위생 | — | `.github/dependabot.yml`(actions SHA 핀 유지) | — |
| P2 시크릿 정본 | P1089 / R612 | `_context/OPERATOR-RUNBOOK.md` + `ci-operator-secrets-contract-check.mjs` | 워크플로 참조 → 런북 문서화, 수동 전용 배포 고정 |

### 실행한 검증 (로컬, `--no-cache`)

| 그룹/게이트 | 결과 |
|---|---|
| `preflight` | 13/13 PASS |
| `workspace` | 10/10 PASS (신규 `operator-provisioning` 포함) |
| `core` | 34/34 PASS |
| `data` | 21/22 — **1 FAIL: `data-lineage`** (아래 참조) |
| `knowledge` | 20/20 PASS |
| `cloudflare` | 3/3 PASS |
| `browser-unit` (headless) | PASS (109/109 그룹) |
| `browser-runtime` | 8/8 PASS |
| `ci-version-check.mjs` | PASS (v54.99, 9 cachebusters) |
| 워크플로 YAML 파싱 | 9/9 OK, job별 timeout 확인 |
| `ci-operator-secrets-contract-check.mjs` 음성 대조 | 미문서 `secrets.UNDOCUMENTED_KEY` 실제 검출 (exit 1) |
| `ensure-live-convergence.mjs --dry-run` | 목표 `cb18382a` / attested 런 `35222057355` / 라이브 `da4d711a` 식별 → `DISPATCHED_DEPLOY` |
| `report-qa-failures.mjs` 픽스처 | 정상 리포트·리포트 부재 양 경로 exit 0 |

### 남은 차단/미검증

- **`data-lineage` FAIL은 이번 변경과 무관한 환경 조건이다.** 하드 FAIL 1건은 `public-data/data.json`(age 13.64h > 12h SLA)이며, `git diff --stat -- public-data/data.json`이 비어 있음을 확인했다 — 로컬 체크아웃이 origin/main보다 5커밋 뒤처져 있기 때문이며, 이는 §2 A1과 같은 뿌리(봇 데이터가 로컬/라이브로 전파되지 않음)다. 해소는 수렴 경로가 실제로 배포를 수행한 뒤에 가능하다.
- **라이브 Pages는 여전히 `da4d711a`(v54.98 직후)에 머물러 있다.** 수렴 경로를 실제로 디스패치하지 않았으므로 `deployment.json.sourceSha` 관측은 미실시다.
- **Cloudflare Worker 수동 배포 경계**는 의도적으로 유지했다(계약이 강제). 라이브 프록시 `v54.37` ↔ 저장소 `v54.99` 격차는 남는다.
- **`browser-resilience` / `browser-viewport` / `browser-surface`** 는 로컬에서 실행하지 않았다. CI push/PR 경로가 담당한다.
- 데이터 수집 자체(fetch-data 등)는 로컬에서 실행하지 않았다 — 네트워크·시크릿 경계 밖이다.
- Cloudflare 대시보드 WAF 규칙, provider 권리 검토, 30일 SLO 인증, semantic coverage(`releaseCertified=false`)는 그대로 OPEN이다.

---

## 10. 의미·정합성 검토 (2026-09-17, 직접 계산·대조)

§1~§9는 "구조가 맞물리는가"를 봤다. 이 절은 **값과 라벨이 실제로 그 의미인가**를 로컬 산출물·코드·라이브에서 직접 재계산·대조한 결과다. 모든 수치는 이 세션에서 실제로 계산한 값이다.

### 10.1 확인된 결함

**S1 (중상, 시계열 의미) — `history.json`의 6개 필드가 "이전 종가"를 "현재 관측 시각"으로 기록한다.**

`history.json` 마지막 레코드와 `market-snapshot.json`은 **같은 리비전**(`market-snapshot:2026-09-17T00:33:24.313Z:f1e8ad46`)을 주장한다. 그런데:

| 필드 | history | snapshot.value | snapshot.previousValue | history `valueBasis` | history `observedAt` | snapshot `observedAt` |
|---|---|---|---|---|---|---|
| spx | 7551.81 | 7551.81 | 7585.73 | latest-completed-close | 2026-09-16T20:31:33Z | 동일 |
| vix | 17.71 | 17.71 | 17.20 | latest-completed-close | 2026-09-16T20:15:01Z | 동일 |
| dxy | 99.65 | 100.276 | **99.6500015258789** | previous-completed-close | 2026-09-17T00:23:22Z | 동일 |
| wti | 105.83 | 101.56 | **105.83000183105469** | previous-completed-close | 2026-09-17T00:23:22Z | 동일 |
| gold | 4332.8 | 4323.4 | **4332.7998046875** | previous-completed-close | 2026-09-17T00:23:19Z | 동일 |
| kospi | 6627.26 | 6738.64 | **6627.259765625** | previous-completed-close | 2026-09-17T00:00:00Z | 2026-09-17T00:13:20Z |
| kosdaq | 812.41 | 820.61 | **812.4099731445312** | previous-completed-close | 2026-09-17T00:00:00Z | 2026-09-17T00:13:20Z |
| btc | 75612.51 | 76347.62 | **75612.5078125** | previous-completed-close | 2026-09-17T00:00:00Z | 2026-09-17T00:33:19Z |

- 값 자체는 스냅샷의 `previousValue`와 소수점 7자리까지 일치 → 완료-시계열 규율을 지키려는 **의도된 선택**이고 `valueBasis`도 정직하게 붙어 있다.
- 그러나 **`observedAt`은 그 이전 종가의 관측 시각이 아니라 현재 관측의 시각**이다(dxy/wti/gold는 스냅샷과 동일 값, kospi/kosdaq/btc는 `00:00:00Z`로 정규화되어 소스 시각 `00:13:20Z`/`00:33:19Z`와 불일치).
- 결과: 시간축이 14개 필드 중 6개에서 한 세션 어긋난다. 이전 세션 종가가 현재 세션 시각에 찍히므로, `history.json` 위에서 상관·선행/후행·정렬을 계산하면 **혼합 빈티지 + 잘못된 시각**이 된다.
- **게이트 공백**: 어떤 게이트도 `valueBasis`와 `observedAt`의 정합성을 검사하지 않는다(`ci-data-lineage-audit.mjs`는 리비전·신선도, `ci-data-continuity-check.mjs`는 원자성·연속성을 본다).

**S2 (중, 라벨 의미) — 서술의 단위가 같은 산출물의 단위와 모순된다.**

- `scripts/fetch-data.mjs:2831`의 `MARKET_ANALYSIS_QUOTE_DEFS`는 `^TNX`를 `unit: 'index'`로 하드코딩한다.
- 같은 산출물 `market-snapshot.json`의 동일 지표(`market.rates.us10y`, `^TNX`)는 `unit: "percent"`다.
- 결과: 라이브에 실제 표시되는 문장이 **`10Y=5.006 index`** — 국채 10년물 금리를 지수로 표기한다(`SPX`/`VIX`/`DXY`는 index가 맞지만 10Y는 아니다).
- 부수 문제: metricId도 어긋난다(`market.us10y` vs 스냅샷 `market.rates.us10y`). claim의 `evidenceIds`는 `market-analysis:^TNX:2026-09-16T18:59:54.000Z` 형태인데 스냅샷 evidenceId는 `market.rates.us10y:09ea45e1` 형태여서, **주장↔근거를 id로 역추적할 수 없다.**

**S3 (중, 현재성 의미) — 사용자에게 노출되는 갱신 주기 주장이 실제 메커니즘과 다르다.**

- `index.html:11828`: "주기: **45분** 자동 갱신 (**GitHub Actions**)", `index.html:11780`: "수집 주기 45분".
- 실제: GitHub Actions 뉴스 cron은 `17,47 * * * *` = **30분**. 뉴스 사이클은 `kst-0800-completed-24h`로 `newsNextRefresh = 2026-09-17T23:00:00Z` → **일 1회** 갱신.
- 45분의 출처는 `js/aio-data.js:3686`의 **브라우저 자체 갱신 타이머**(`interval: 2700000`)다. 즉 클라이언트 주기를 GitHub Actions 수집 주기로 잘못 귀속했다.
- 같은 패널의 "필터: 08:00~08:00 KST 완료 24h"(11780/11830)는 정확하다 → 한 패널 안에 맞는 주장과 틀린 주장이 나란히 있다.

**S4 (중, 기계 계약 의미) — `macro._freshness_*` 19개가 전부 `stale-reference`인데 소스는 모두 정식 1차 출처다.**

- 유일한 할당 지점은 `scripts/fetch-data.mjs:682`(LKG 병합). 그 함수는 `merged = { ...previous, ...current }` 후 `if (Number.isFinite(currentValue)) continue;`로 **현재 값이 있으면 아무것도 하지 않는다** → 한 번 stale이 되면 값이 정상 복구돼도 플래그가 **지워지지 않는다**(sticky).
- 실제 상태: `_freshness_cpi/coreCpi/pce/…/dgs2…t10y2y` 19개 전부 `stale-reference`인데 `_source_*`는 `bls-official-primary`, `bea-official-primary`, `fred-official-primary`, `us-treasury-official-primary`이고 `_asOf_*`는 최신 관측기다. **플래그가 거짓**이며, 이 필드로는 진짜 LKG와 구분할 수 없다.
- 완화 요소: 앱에서 `_freshness_*`를 읽는 코드가 없다(동반 필드 `_originSource_`만 `js/aio-data.js:5266`에서 사용). 현재 사용자 영향은 없지만, 기계 계약이 거짓 신호를 발행한다.

**S5 (하, 이름 의미) — `operations-status.statusVocabulary`가 실제 `status` 값과 교집합이 0이다.**

선언: `NOT_CONFIGURED, CONFIGURED_HEALTHY, CONFIGURED_BROKEN, STALE, RIGHTS_REVIEW_REQUIRED`.
실제 `status`/`overall` 값: `CURRENT, OPERATOR_REQUIRED, BLOCKED, MATCH, PARTIAL`.
선언된 어휘는 `statusCode`에만 해당한다(`build-operations-status.mjs:376`에서 `status`와 `statusCode`를 별도로 계산). 필드명이 일반적이라 소비자가 오해한다.

**S6 (하, 현재성 의미) — `operations-status.planes.durable.freshness`가 빌드 시점에 동결된다.**

`ageHours: 0.02`, `fresh: true`는 생성 순간의 값이며 발행 후 13.6시간이 지나도 그대로다(`deriveDurableFreshness({..., now})`, `build-operations-status.mjs:344`). 소비자는 `generatedAt`으로 재계산해야 한다.
완화 요소: 앱은 이 파일을 읽지 않는다(`src/data/contracts/operations.js`만 참조). 운영자·게이트용이며, `ci-operations-status-check.mjs`는 함수 단위로만 검증한다.

### 10.2 정합성이 확인된 것 (재계산 일치)

- **breadth 산술 완전 일치**: `all` 283 advance + 557 decline + 10 unchanged = 850 = eligible(=873−23), `advanceRatio 0.3369 = 283/840`(변동 종목 제외 규칙과 정확히 일치), `us` 728 + `kr` 145 = 873 = `all`(세그먼트가 유니버스를 정확히 분할), `coveragePct = eligible/universe`(97.4/97.3/97.9 모두 일치). `decisionScope`에 "공식 거래소 breadth가 아님"을 명시했다.
- **market-snapshot 파생값 일치**: `changePct` 5건 재계산 일치(SPX −0.4472, Nasdaq −0.0121, Dow −1.2117, RUT −0.3999, VIX +2.9651), `delayedByMs = fetchedAt − observedAt` 일치, 단위도 지표별로 적절(`percent`, `USD/barrel`, `USD/oz`, `KRW/USD`, `index`).
- **Treasury 공식 경로 정상**: `macro._treasury.status='ok'`, `sourceKind=T1_OFFICIAL`(미 재무부 공식 XML), dgs2/5/10/20/30 + 파생 `t10y2y = dgs10 − dgs2 = 5.01 − 4.74 = 0.27`이 게시값과 정확히 일치. FRED가 아닌 공식 Treasury를 우선 사용하도록 `fetch-data.mjs:3416-3422`에서 덮어쓰고 있다. 소비 경로 `_aioApplyServerTreasuryEvidence`도 실제 값을 받는다.
- **AAII 일관**: 38 + 22.7 + 39.3 = 100, `spread −1.3 = 38 − 39.3`.
- **뉴스 사이클 정직**: 40/40건이 선언된 사이클(`2026-09-15T23:00Z ~ 2026-09-16T23:00Z`) 안에 있고, `newsCycleLabel`의 KST 변환도 일치. `generatedAt`이 사이클 종료 이후인 것도 "completed 24h" 정책상 정상.
- **의미 가드가 실제로 작동**: `marketAnalysis.status='blocked'`, `reason='metric-identity-mismatch:vix-vs-fear-greed,causal-evidence-missing'` — LLM이 VIX와 Fear&Greed를 혼동한 것을 검증기가 **차단**하고, 차단된 상태를 "대기" 문구로 표시한다(검증된 관측치만 노출).
- **두 커버리지 수치는 모순이 아님**: SEC 76.9%(혼합 펀더멘털 필드, 분모 728) vs 85.8%(SEC 전용 562/655)는 `fundamentalCoverageScope`에 "separate from SEC-only coverage"로 분리 명시되어 있고, `data.meta.fundamentalCoveragePct`는 `fetch-data.mjs:3725`에서 스크리너 값을 그대로 복사한다(두 정의가 아님).
- **리비전 결속**: `history.marketSnapshotRevision` = `market-snapshot.revision` = `data.meta`의 스냅샷 리비전, `history.cycleEnd` = `data.meta.cycleComponents.historyCycleEnd`.

### 10.3 이 절차에서 정정한 것

- **내 1차 판단 오류**: 초기 구조 probe가 출력을 3000자에서 잘라 `macro`에 `_treasury`와 `dgs*`가 없는 것처럼 보였고, "서버 treasury 경로가 죽어 있다"고 판단할 뻔했다. 실제로는 `macro._treasury`와 `macro.dgs2..t10y2y`가 모두 존재한다. 위 §10.2의 Treasury 항목이 그 정정 결과다.
- **내 2차 판단 오류**: `data.meta.fundamentalCoveragePct`와 `screener.fundamentalCoveragePct`의 분모가 731 대 728로 다르다고 역산했으나, 실제로는 data.meta가 스크리너 값을 복사하므로 단일 정의다.

### 10.4 이 절차가 다루지 않은 것 (미검증 유지)

- 브라우저 내부 지표 수식(RSI/MACD/SMA/ATR)의 독립 재계산 — `js/aio-core.js`의 레거시 수식과 `src/domain/**`의 신규 수식이 동일 결과를 내는지는 파리티 픽스처(`dump-*-fixtures.mjs`)에 의존하며 이번에 직접 재계산하지 않았다.
- 실제 LLM 호출로 생성된 서술 텍스트의 의미(현재는 `blocked` 폴백이므로 검증 대상이 아니다).
- 차트의 시각적 정확성(픽셀 비교 기준선이 없음).
- `data.json.meta.quotesPublished=false` + `quotes: {}`인데 `symbolsOk: 78`을 보고하는 조합이 UI에서 어떻게 표현되는지 — 이번 절차에서 UI 소비 경로를 끝까지 추적하지 않았다.


