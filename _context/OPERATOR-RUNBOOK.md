---
title: Operator runbook — provisioning and manual boundaries
last_verified: 2026-09-17
auto_refresh: false
---

# Operator runbook

이 문서는 **자동화가 스스로 채울 수 없는 것**의 정본이다. 어떤 시크릿·변수가 있어야 어느 레인이 도는지, 무엇이 의도적으로 수동인지, 그리고 수동 경계가 무너졌는지 어떻게 확인하는지를 기록한다.

`scripts/ci-operator-secrets-contract-check.mjs`가 이 문서를 기계적으로 검사한다. 워크플로가 참조하는 `secrets.*`/`vars.*`가 여기에 없으면 CI가 실패한다.

## 1. 저장소 Secrets

Settings → Secrets and variables → Actions → **Secrets**에 등록한다.

| 이름 | 사용하는 워크플로 | 없을 때 결과 |
|---|---|---|
| `FRED_API_KEY` | `refresh-data.yml` | 매크로 지표가 LKG로 고정되고 `fredOk=false`로 표시된다. 시세·뉴스는 계속 발행된다. |
| `ANTHROPIC_API_KEY` | `refresh-data.yml`, `deploy-ai-proxy.yml` | `data.json.meta.marketAnalysisOk=false`가 되고 서술은 결정론적 템플릿으로 폴백한다(라이브 경고로 노출). Worker 배포는 fail-closed로 중단된다. |
| `TWELVE_DATA_API_KEY` | `refresh-data.yml` | Yahoo 실패 시 2차 시세 폴백이 사라져 `CORE_QUOTE_COVERAGE_FAILED` 위험이 커진다. |
| `FINNHUB_API_KEY` | `refresh-screener.yml` | 실적/IPO 캘린더가 이전 파일을 유지한 채 갱신되지 않는다. |
| `CLOUDFLARE_API_TOKEN` | `deploy-ai-proxy.yml`, `deploy-data-plane.yml` | 두 Worker 배포가 `operator_required`로 즉시 실패한다. |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy-ai-proxy.yml`, `deploy-data-plane.yml` | 위와 동일. |
| `AIO_QUOTES_KV_ID` | `deploy-data-plane.yml` | 패스트 플레인 배포가 중단된다. |

## 2. 저장소 Variables

같은 화면의 **Variables** 탭에 등록한다. Secrets와 달리 값이 로그에 노출되지 않아야 하는 항목이 아니다.

| 이름 | 사용하는 워크플로 | 없을 때 결과 |
|---|---|---|
| `SEC_USER_AGENT` | `refresh-data.yml`, `refresh-screener.yml` | SEC fair-access 정책상 필수다. 없으면 SEC 레인이 `operator_configuration_required`를 쓰고 **아무것도 수집하지 않은 채 통과**한다 — 조용한 결손이므로 가장 먼저 확인할 항목이다. |
| `AIO_PROXY_URL` | `deploy-ai-proxy.yml` | 기본값(`https://aio-proxy.zmfhd007.workers.dev`)으로 검증한다. 커스텀 도메인이면 반드시 설정한다. |
| `AIO_FAST_QUOTES_URL` | `deploy-data-plane.yml` | 기본 Worker URL로 스모크 검사한다. |

## 3. Cloudflare 대시보드 전용 설정 (저장소에 없다)

다음 항목은 코드로 표현되지 않으며 운영자가 대시보드에서 직접 만들어야 한다.

- **WAF 레이트리밋 규칙** — `cloudflare-worker-proxy.js`의 isolate 로컬 Map은 Worker 간 공유가 불가능한 best-effort 방어다. 실효 제한은 대시보드 규칙이 담당하며, 이 규칙이 없으면 데이터 프록시와 `/anthropic` 경로 모두 실질 상한이 약해진다.
- **KV 네임스페이스** `aio-quotes-prod` — 바인딩 id를 `AIO_QUOTES_KV_ID`로 저장소에 전달한다.
- **Durable Object** `AIOQuotaDurableObject` (`AIO_QUOTA_DO` 바인딩) — 없으면 `/anthropic`이 503 fail-closed로 거부한다.
- **Worker secrets** `AIO_CRON_SECRET`, 선택 `AIO_APP_TOKEN`, 선택 `AIO_DEV_ORIGINS`.

## 4. 의도적으로 수동인 배포 (자동 재배포 없음)

| 워크플로 | 트리거 | 이유 |
|---|---|---|
| `.github/workflows/deploy-ai-proxy.yml` | `workflow_dispatch` 전용 | Worker 소스 변경이 검토 없이 프로덕션 프록시·시크릿을 갈아치우지 않도록 의도적으로 분리했다. `ci-cloudflare-deployment-contract-check.mjs`가 이 수동 전용 상태를 계약으로 강제한다. |
| `.github/workflows/deploy-data-plane.yml` | `workflow_dispatch` 전용 | 위와 동일. |

두 워크플로를 자동화하려면 계약 게이트를 함께 수정해야 한다. 자동화하지 않는다면 **소스와 라이브 Worker 리비전이 벌어진다**(관측: 저장소 v54.98 대비 라이브 프록시 v54.37). 이 격차는 `ci-external-pipeline-check.mjs`의 `proxy-source-revision` 검사가 감시한다.

## 5. 운영자 주기의 수동 데이터 작업

| 항목 | 주기 | 근거 |
|---|---|---|
| 손 큐레이션 정적 DB(S1~S6) | 월 단위 검토 | `ci-static-db-expiry-check.mjs`가 `screener-universe.json`에 대해 90일 하드 만료를 건다. 만료되면 preflight가 red가 되어 **배포가 정지**한다. |
| 공식 웹 리서치 스냅샷(`public-data/structural-data-research.json`) | 180일 계약 | `ci-web-research-contract-check.mjs`의 `MAX_AGE_DAYS=180`. AAII 수치는 `fetch-data.mjs`가 자동 갱신하지만, NAAIM·KR 수출입 등 운영자 캡처 값은 `node scripts/refresh-web-research.mjs`를 직접 실행해야 갱신된다. |
| `public-data/operator-note.json` | 필요 시 | 사람이 GitHub UI에서 편집한다. |
| 지식 아티팩트 재생성 | 원문 수정 시 | 16개 `build-knowledge-*`/`build-principles-*` 빌더는 자동 실행되지 않는다. 실행을 빠뜨리면 `ci-knowledge-generated-parity-check.mjs`가 실패한다. |
| 버전 범프 | 릴리스 시 | `node scripts/bump-version.mjs <v>` — 유일한 버전 패치 경로이며 워크플로가 호출하지 않는다. |

## 6. 자동화된 것 (운영자가 개입하지 말아야 하는 것)

- 데이터 수집·검증·봇 커밋·CI 검증·attestation 생성은 스케줄로 자동이다.
- **라이브 수렴도 자동이다.** `scripts/ensure-live-convergence.mjs`가 매 refresh 주기마다 origin/main 리비전과 라이브 `deployment.json`의 `sourceSha`를 비교하고, 다르면 attestation을 가진 CI 실행 id를 `pages-deploy.yml`에 넘긴다. 배포는 그 워크플로만 수행하며 attestation 검증을 우회하지 않는다.
- 워치독이 red이면 먼저 `pages-data-freshness` / `pages-telegram-freshness` / `pages-source-matches-attested-ci` 중 무엇인지 확인한다. 앞의 둘은 위 수렴 경로가 막혔다는 뜻이다.

## 7. 경계

- 커밋·푸시·배포는 명시적 요청이 있을 때만 수행한다. 자동화도 이 경계를 지킨다.
- 이 문서는 검증 가능한 사실만 담는다. 시크릿 값·토큰·계정 식별자는 절대 기록하지 않는다.
