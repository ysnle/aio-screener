---
title: Operator runbook — provisioning and manual boundaries
last_verified: 2026-09-20
auto_refresh: false
---

# Operator runbook

이 문서는 **자동화가 스스로 채울 수 없는 것**의 정본이다. 어떤 시크릿·변수가 있어야 어느 레인이 도는지, 무엇이 의도적으로 수동인지, 그리고 수동 경계가 무너졌는지 어떻게 확인하는지를 기록한다.

`scripts/ci-operator-secrets-contract-check.mjs`가 이 문서를 기계적으로 검사한다. 워크플로가 참조하는 `secrets.*`/`vars.*`가 여기에 없으면 CI가 실패한다.

## 1. 저장소 Secrets

Settings → Secrets and variables → Actions → **Secrets**에 등록한다.

| 이름 | 사용하는 워크플로 | 없을 때 결과 |
|---|---|---|
| `FRED_API_KEY` | `refresh-data.yml`, `deploy-ai-proxy.yml` | `refresh-data`에서는 매크로 지표가 LKG로 고정되고 `fredOk=false`로 표시된다(시세·뉴스는 계속 발행). `deploy-ai-proxy`에서는 필수 가드에 걸려 배포가 중단된다 — 공유 Worker의 `/relay` fred 제공자가 이 키로만 동작하기 때문이다. |
| `ANTHROPIC_API_KEY` | `refresh-data.yml`, `deploy-ai-proxy.yml` | `data.json.meta.marketAnalysisOk=false`가 되고 서술은 결정론적 템플릿으로 폴백한다(라이브 경고로 노출). Worker 배포는 fail-closed로 중단된다. |
| `TWELVE_DATA_API_KEY` | `refresh-data.yml` | Yahoo 실패 시 2차 시세 폴백이 사라져 `CORE_QUOTE_COVERAGE_FAILED` 위험이 커진다. |
| `FINNHUB_API_KEY` | `refresh-screener.yml` | 실적/IPO 캘린더가 이전 파일을 유지한 채 갱신되지 않는다. |
| `BOK_API_KEY` | `deploy-ai-proxy.yml` | **선택.** `/relay`의 `bok` 제공자만 503 fail-closed로 남고 배포는 계속된다(경고로 표시). 브라우저는 이 소스에 직접 도달할 수 없으므로 키가 없으면 한국은행 지표는 서버 스냅샷에만 의존한다. |
| `KOSIS_API_KEY` | `deploy-ai-proxy.yml` | **선택.** 위와 동일하게 `kosis` 제공자만 fail-closed. |
| `CLOUDFLARE_API_TOKEN` | `deploy-ai-proxy.yml`, `deploy-data-plane.yml` | 두 Worker 배포가 `operator_required`로 즉시 실패한다. |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy-ai-proxy.yml`, `deploy-data-plane.yml` | 위와 동일. |
| `AIO_QUOTES_KV_ID` | `deploy-data-plane.yml` | 패스트 플레인 배포가 중단된다. |
| `FMP_API_KEY` | (없음 — 폐기) | **retired.** 어떤 워크플로도 참조하지 않으며 `ci-data-pipeline-contract-check.mjs`가 `refresh-data.yml`/`refresh-screener.yml`로의 유입을 금지한다. 무료 SEC companyfacts로 대체되어 `data.json`의 fundamentals는 이 키 없이 채워진다. 저장소 시크릿 목록에 남아 있다면 삭제해도 무해하다. |

## 2. 저장소 Variables

같은 화면의 **Variables** 탭에 등록한다. Secrets와 달리 값이 로그에 노출되지 않아야 하는 항목이 아니다.

| 이름 | 사용하는 워크플로 | 없을 때 결과 |
|---|---|---|
| `SEC_USER_AGENT` | `refresh-data.yml`, `refresh-screener.yml` | SEC fair-access 정책상 필수다. 없으면 SEC 레인이 `operator_configuration_required`를 쓰고 **아무것도 수집하지 않은 채 통과**한다 — 조용한 결손이므로 가장 먼저 확인할 항목이다. |
| `AIO_PROXY_URL` | `deploy-ai-proxy.yml` | 기본값(`https://aio-proxy.zmfhd007.workers.dev`)으로 검증한다. 커스텀 도메인이면 반드시 설정한다. |
| `AIO_FAST_QUOTES_URL` | `deploy-data-plane.yml` | 기본 Worker URL로 스모크 검사한다. |

## 3. 공유 자격증명과 사용자 자격증명의 경계

이 앱에는 두 종류의 자격증명이 있고, 둘은 서로 다른 경로를 탄다. 경계를 흐리면 "설정했는데 동작하지 않는다"가 조용히 생긴다(P1151).

**공유(운영자 소유)** — 저장소/Worker 시크릿으로 두고 사용자는 아무것도 입력하지 않는다.

- Claude 서버 키: `ANTHROPIC_API_KEY` → `aio-proxy`의 `POST /anthropic`. 개인 키가 없을 때의 기본 채팅 경로다.
- 시장 데이터 릴레이: `FRED_API_KEY`/`BOK_API_KEY`/`KOSIS_API_KEY` → `aio-proxy`의 `GET /relay`. 이 세 소스는 브라우저에서 도달 불가(FRED는 CORS, BOK/KOSIS는 CORS 헤더 부재)이므로 **공유 경로가 유일한 실시간 경로**다. 업스트림 host는 Worker 코드에 하드코딩되어 클라이언트가 목적지를 지정할 수 없다.

**사용자별** — 각 사용자가 사이드바에서 발급·입력하고 브라우저 localStorage(선택 시 Vault 암호화)에만 저장된다. 서버로 전송되지 않는다: Alpha Vantage, Finnhub, FMP, Twelve Data, NewsData, RSS2JSON, Perplexity, Google CSE(key+cx), CF Worker URL(선택적 자체 프록시).

**규칙**: 개인 키가 URL에 실리는 요청(예: 사용자 FRED 키 직접 호출)은 **사용자가 직접 소유한 Worker**로만 중계할 수 있고, 공유 Worker는 개인 키를 받지 않는다. 그래서 이 경로들은 실패 시 `PRIVATE_ROUTE_REQUIRED`로 표시되며, 서버 스냅샷으로 폴백한다. 운영자 키로 대신 조회할 수 있는 소스는 위 `/relay` 세 개뿐이다.

## 4. Cloudflare 대시보드 전용 설정 (저장소에 없다)

다음 항목은 코드로 표현되지 않으며 운영자가 대시보드에서 직접 만들어야 한다.

- **레이트리밋 (v56부터 코드에 포함, 대시보드 작업 불필요)** — `worker/wrangler.proxy.toml`이 Workers **Rate Limiting binding** 3개를 선언한다: `RATE_LIMIT_PROXY`(300/분), `RATE_LIMIT_ANTHROPIC`(20/분), `RATE_LIMIT_RELAY`(60/분). 모두 `period = 60`이다.
  - **존 단위 WAF 규칙은 이 배포에 쓸 수 없다.** 워커가 `aio-proxy.zmfhd007.workers.dev`(Cloudflare 공유 존)에만 있고 커스텀 도메인이 없어 규칙을 붙일 존이 없다. v56 이전의 "WAF 규칙이 실효 상한" 안내는 그 전제가 성립하지 않는 잘못된 안내였다(P1157).
  - **남는 한계는 정직하게 둘**: 바인딩은 Cloudflare **로케이션별**이라 전역 상한이 아니고, 설계상 eventually consistent다. 전역 권위는 여전히 DO 일일 캡이다(`ANTHROPIC_DAILY_CAP`, `RELAY_DAILY_CAP`). 일반 `?url=` 프록시에는 일일 캡이 없다.
  - **바인딩은 대시보드에 보이지 않는다.** 429는 Workers Logs / Observability에서 확인한다(계정 화면의 Observability 지표).
  - 세 경로 모두 **호출자를 인증하지 않는다** — Origin 허용목록은 비브라우저 클라이언트가 헤더를 위조하면 통과하고, `AIO_APP_TOKEN`은 공개 클라이언트 JS에 상수가 있으며 미설정이면 검사 자체가 없다(`/health`의 `relay.appTokenRequired`로 확인). `/relay`는 **운영자 FRED/BOK/KOSIS 쿼터를 소모**하므로, 위조 클라이언트는 일일 캡까지 소진시킬 수 있는 것으로 취급한다.
  - 커스텀 도메인을 워커에 붙이면 그때는 존 WAF rate limiting rule을 **추가** 방어층으로 쓸 수 있다(예: `http.request.uri.path eq "/relay"` → 60/분 → Block). 필수는 아니다.
  - 배포가 `[[ratelimits]]` 바인딩에서 실패하면(계정 미지원) 그 3블록을 제거하면 된다 — 코드는 바인딩이 없으면 isolate 로컬 Map으로 폴백한다.
- **`/relay` 키 교체 후 캐시** — `/relay` 응답은 `Cache-Control: public, max-age=3600`이므로 키를 바꿔도 엣지·브라우저 캐시가 최대 1시간 옛 페이로드를 계속 준다. 즉시 반영이 필요하면 `RELAY_DAILY_CAP`이나 파라미터를 바꾸기보다 배포 직후 `Cache-Control` 만료를 기다리거나 별도 확인용 시리즈로 검증한다.
- **KV 네임스페이스** `aio-quotes-prod` — 바인딩 id를 `AIO_QUOTES_KV_ID`로 저장소에 전달한다.
- **Durable Object** `AIOQuotaDurableObject` (`AIO_QUOTA_DO` 바인딩) — 없으면 `/anthropic`이 503 fail-closed로 거부한다. `/relay`의 일일 캡도 같은 바인딩을 쓰므로, 없으면 릴레이도 503이다.
- **Worker secrets** `AIO_CRON_SECRET`, 선택 `AIO_APP_TOKEN`, 선택 `AIO_DEV_ORIGINS`. `deploy-ai-proxy.yml`이 `ANTHROPIC_API_KEY`·`FRED_API_KEY`·`BOK_API_KEY`·`KOSIS_API_KEY`를 배포 시 `wrangler secret put`으로 게시하므로 대시보드에서 손으로 넣지 않아도 된다.
- **릴레이 일일 캡** — `worker/wrangler.proxy.toml`의 `RELAY_DAILY_CAP`(기본 2000, 제공자별). 배포 전에 이 값을 조정하려면 toml을 수정한다.
- **패스트 플레인 승격 플래그** — `architecture/worker-endpoints.json`의 `fastQuotes.rightsReviewed`(권리 검토 완료 시 `true`)와 `soakRequiredDays`. 7일 soak와 권리 검토가 끝나기 전에는 `public-config.json`의 `marketData.fastQuotes.enabled`가 `false`로 유지되며 브라우저는 패스트 플레인을 읽지 않는다. 이 승격은 손으로 켜지지 않는다 — `scripts/ci-fast-plane-consumer-gate.mjs`가 게시된 증거로 재파생해 검사한다.

## 5. 의도적으로 수동인 배포 (자동 재배포 없음)

| 워크플로 | 트리거 | 이유 |
|---|---|---|
| `.github/workflows/deploy-ai-proxy.yml` | `workflow_dispatch` 전용 | Worker 소스 변경이 검토 없이 프로덕션 프록시·시크릿을 갈아치우지 않도록 의도적으로 분리했다. `ci-cloudflare-deployment-contract-check.mjs`가 이 수동 전용 상태를 계약으로 강제한다. |
| `.github/workflows/deploy-data-plane.yml` | `workflow_dispatch` 전용 | 위와 동일. |

두 워크플로를 자동화하려면 계약 게이트를 함께 수정해야 한다. 자동화하지 않는다면 **소스와 라이브 Worker 리비전이 벌어진다**. 저장소 측은 이제 고정할 수 있다 — `worker/wrangler.proxy.toml`의 `AIO_APP_REVISION`이 `version.json`을 따라가며 `ci-version-check.mjs`와 `bump-version.mjs`가 동기화를 강제한다(v56 이전에는 v54.37에 멈춰 있었다). **라이브** 리비전이 소스와 일치하는지는 `ci-external-pipeline-check.mjs`의 `proxy-source-revision` 검사가 감시하지만, 배포 후 대시보드에서 한 번 확인하는 것이 가장 확실하다.

## 6. 운영자 주기의 수동 데이터 작업

| 항목 | 주기 | 근거 |
|---|---|---|
| 손 큐레이션 정적 DB(S1~S6) | 월 단위 검토 | `ci-static-db-expiry-check.mjs`가 `screener-universe.json`에 대해 90일 하드 만료를 건다. 만료되면 preflight가 red가 되어 **배포가 정지**한다. |
| 공식 웹 리서치 스냅샷(`public-data/structural-data-research.json`) | 180일 계약 | `ci-web-research-contract-check.mjs`의 `MAX_AGE_DAYS=180`. AAII 수치는 `fetch-data.mjs`가 자동 갱신하지만, NAAIM·KR 수출입 등 운영자 캡처 값은 `node scripts/refresh-web-research.mjs`를 직접 실행해야 갱신된다. |
| `public-data/operator-note.json` | 필요 시 | 사람이 GitHub UI에서 편집한다. |
| 지식 아티팩트 재생성 | 원문 수정 시 | 16개 `build-knowledge-*`/`build-principles-*` 빌더는 자동 실행되지 않는다. 실행을 빠뜨리면 `ci-knowledge-generated-parity-check.mjs`가 실패한다. |
| 버전 범프 | 릴리스 시 | `node scripts/bump-version.mjs <v>` — 유일한 버전 패치 경로이며 워크플로가 호출하지 않는다. |

## 7. 자동화된 것 (운영자가 개입하지 말아야 하는 것)

- 데이터 수집·검증·봇 커밋·CI 검증·attestation 생성은 스케줄로 자동이다.
- **라이브 수렴도 자동이다.** `scripts/ensure-live-convergence.mjs`가 매 refresh 주기마다 origin/main 리비전과 라이브 `deployment.json`의 `sourceSha`를 비교하고, 다르면 attestation을 가진 CI 실행 id를 `pages-deploy.yml`에 넘긴다. 배포는 그 워크플로만 수행하며 attestation 검증을 우회하지 않는다.
- 워치독이 red이면 먼저 `pages-data-freshness` / `pages-telegram-freshness` / `pages-source-matches-attested-ci` 중 무엇인지 확인한다. 앞의 둘은 위 수렴 경로가 막혔다는 뜻이다.

## 8. 경계

- 커밋·푸시·배포는 명시적 요청이 있을 때만 수행한다. 자동화도 이 경계를 지킨다.
- 이 문서는 검증 가능한 사실만 담는다. 시크릿 값·토큰·계정 식별자는 절대 기록하지 않는다.
