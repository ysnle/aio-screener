# AIO Cloudflare Workers

This directory holds both Worker deployments. Only the fast quote plane is described
below; the `aio-proxy` Worker (source: `../cloudflare-worker-proxy.js`, config:
`wrangler.proxy.toml`) serves the CORS data proxy, the shared `/openai`
server-key route, and the `/relay` server-side key relay. AI generation uses
`gpt-6-luna` and the operator's `OPENAI_API_KEY` Worker secret. Browser chat,
translation and Actions analysis share one atomic UTC-month reservation budget
of at most $10. Paid AI search is disabled. The provider key never enters the
browser or Actions; Actions authenticates with a separate `AIO_AUTOMATION_TOKEN`.
See [_context/OPERATOR-RUNBOOK.md](../_context/OPERATOR-RUNBOOK.md) for provisioning.

## `/relay` — fixed-provider relay (P1151/P1422)

`GET /relay?provider=<fred|bok|kosis>&<params>` fetches a browser-blocked source.
BOK/KOSIS use operator secrets. FRED uses the querying user's own key in
`X-AIO-Provider-Key`, only after explicit browser opt-in; the operator key is never
substituted. Reading the scheduled operator artifact does not require a personal key.

Design boundaries (all enforced by `node scripts/ci-worker-relay-check.mjs`):

- Upstream host and path are **hardcoded per provider**. The client cannot name a
  destination, so the route cannot be used as an SSRF relay.
- BOK/KOSIS keys come only from `env.BOK_API_KEY` / `env.KOSIS_API_KEY`.
  FRED's personal header is validated, never stored/logged, and redacted from bodies.
  FRED upstream/response caching is disabled and redirects are refused.
  `/health` lists `personalKeyRequired` separately from operator key presence.
- Parameters pass a per-provider regex whitelist; anything else is a 400.
- Origin allowlist, optional `AIO_APP_TOKEN`, and a 60/min per-IP limit apply before
  the upstream call. A per-provider daily cap (`RELAY_DAILY_CAP`, default 2000) is
  reserved atomically through `AIO_QUOTA_DO`.
- Missing BOK/KOSIS secrets or quota bindings fail closed (503). A missing personal
  FRED key returns 400. There is no cross-user credential substitution.

Deployment: `deploy-ai-proxy.yml` publishes the relay secrets with
`wrangler secret put` (BOK/KOSIS optional), checks a keyless FRED rejection, and may
smoke-test the operator's own FRED key in a request header. No workflow was run locally.

### What these gates are, and are not (v56, P1156)

Browser requests on this Worker — the `?url=` data proxy, `/openai`, `/relay` — refuse an
Origin outside the allowlist. Only `/openai` also accepts origin-less Actions requests
authenticated with a private automation token. The browser Origin check is a *minimum* barrier, not
authentication: `Origin` is a request header that any non-browser client can set freely, and
`AIO_APP_TOKEN` (checked only when configured, and exported as a constant by the public
client bundle) is a speed bump against naive scraping. The per-IP rate limiter lives in
isolate-local `Map`s, so its real ceiling is `limit × distinct IPs × live isolates`.

The bounds that are *not* per-isolate:

- the **Workers Rate Limiting bindings** declared in `wrangler.proxy.toml`
  (`RATE_LIMIT_PROXY` 300/min, `RATE_LIMIT_OPENAI` 20/min, `RATE_LIMIT_RELAY` 60/min,
  `period = 60`). These share counters across every isolate **within one Cloudflare location**,
  which is why they replaced the old advice to create a WAF rate limiting rule: `workers.dev`
  has no zone, so that rule was never available to this deployment. They are not global and are
  eventually consistent by design, and they are invisible in the dashboard — observe them as 429s
  in Workers Logs. A missing or throwing binding falls back to the in-isolate `Map`.
- the atomic Durable Object daily cap (`AI_DAILY_CAP`, `RELAY_DAILY_CAP`) — **volume,
  not identity**, and only on `/openai` and `/relay`; the generic `?url=` proxy has none.

Because `/relay` spends the operator's FRED/BOK/KOSIS quota, treat a forged-Origin client as
a quota-exhaustion risk up to the daily cap rather than as a blocked attacker.

The read surface of the fast plane is `GET`/`HEAD` only — a `POST /quotes` used to bypass the
CDN cache and perform a KV read per request. `/admin/run` keeps its own `POST` +
`X-AIO-Cron-Token` gate and is dispatched before that method guard.

## AIO fast quote plane

`data-plane.js` is the AR-07 Batch 1 Cloudflare Worker. Its scheduled handler
fetches the bounded Tier 0 allowlist every five minutes, validates the shared
`src/data/contracts/market-snapshot.js` contract, and writes `quotes:current`
only after QG-01 reaches 100% and the semantic revision changes. An unchanged
snapshot is a successful observation but a KV no-op; the heartbeat is throttled
to one liveness write per 15 minutes (or an immediate status change). The
normal upper bound is 432 successful KV writes/day (384 quote/heartbeat + 48 scheduler receipts) and the status-flapping
worst case is 624/day, below the 1,000/day free-tier limit; normal writes stay below its 500/day
warning target. Heartbeats distinguish `checkedAt` (the run observation),
`publishedAt` (a changed `quotes:current` snapshot), and `writtenAt` (the last
heartbeat KV write), so liveness cannot masquerade as a snapshot publication.
Failed runs write a heartbeat and retain the last-known-good KV object. This
deployment is intentionally KV-only; R2 is not required or configured.

Required operator setup:

1. Create a dedicated KV namespace for this Worker, for example
   `aio-quotes-prod`. Do not reuse the old `aio-quota-prod` namespace:
   the `aio-proxy` Worker no longer reads a KV `AIO_QUOTA` binding — its daily
   quota counters run on the `AIO_QUOTA_DO` Durable Object
   (`AIOQuotaDurableObject`, SQLite-backed; legacy KV is unsupported and
   fail-closed, per `architecture/worker-endpoints.json`).
2. Configure repository secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
   and `AIO_QUOTES_KV_ID`.
3. Configure Worker secret `AIO_CRON_SECRET`; verify provider terms/rights and
   set the public `AIO_FAST_QUOTES_URL` repository variable to
   `https://aio-screener-data-plane.zmfhd007.workers.dev` (the currently observed
   deployed data-plane endpoint). Do not point it at the existing
   `https://aio-proxy.zmfhd007.workers.dev` data/shared-AI proxy; the value must
   serve this Worker's `/health` and `/quotes` routes and must not include either
   path suffix.
4. Run the manual `Deploy fast data plane` workflow, then run its smoke check.
5. Keep the watchdog green for seven days. The soak evidence must show at least
   99% scheduled runs, no silent LKG overwrite, and freshness within the Tier 0
   session budget before AR-07 can be marked `VERIFIED_LIVE`.

The repository intentionally contains no Cloudflare credentials, cron secret, or
KV resource ID. Runtime evidence currently confirms the data-plane endpoint's
`/health` and `/quotes` responses with 16/16 Tier-0 coverage, but the release
posture remains `OPERATOR_REQUIRED` until the GitHub variable/secret bindings and
seven-day watchdog soak are evidenced. The endpoint/proxy roles and this evidence
are recorded in `architecture/worker-endpoints.json`.

For a read-only live contract check against the currently configured endpoint,
run `node scripts/ci-fast-plane-live-check.mjs`. It validates only `/health` and
`/quotes`; it cannot manufacture GitHub secret configuration, provider rights, or
the seven-day soak requirement.

## refresh-data 예약 실행 보강 (P1377)

GitHub 예약 실행은 30분 간격으로 설정돼 있어도 실제로는 4~6시간 간격으로 실행되는 경우가 많습니다. 데이터 플레인 Worker는 이미 5분마다 실행되므로, 매시 20분·50분(UTC)에 `refresh-data.yml`을 `trigger=scheduler`로 실행 요청합니다. 이 요청으로 시작된 실행은 13F 전체 수집을 건너뜁니다.

설정은 한 번만 하면 됩니다.

1. GitHub → Settings → Developer settings → Fine-grained tokens에서 새 토큰을 만듭니다.
   - Repository access: `ysnle/aio-screener`만
   - Permissions: Actions → Read and write (그 외 권한은 주지 않음)
   - 만료일은 1년 이내로 정하고, 만료 전에 같은 방법으로 교체합니다.
2. GitHub 저장소 Secret `AIO_REFRESH_DISPATCH_TOKEN`에 저장합니다. 다음 승인된 데이터 플레인 배포가 Worker Secret `GITHUB_DISPATCH_TOKEN`으로 전달합니다. Cloudflare에 직접 설정할 경우에도 같은 이름의 Secret을 사용하며, 기존 개인용 광범위 토큰을 재사용하지 않습니다.

토큰이 없으면 Worker는 요청을 보내지 않습니다(`token-not-configured`). 이때는 기존 GitHub 예약 실행만 동작합니다.

P1595: 각 보완 슬롯에서 최근 main 실행을 먼저 읽습니다. 대기/실행 중인 작업 또는 25분 이내 성공이 있으면 중복 요청을 생략합니다. 읽기 실패·권한 오류에는 무조건 실행 요청을 보내지 않으며, 헤더와 응답 본문 대기를 모두 제한합니다. 슬롯별 결과는 KV `scheduler:dispatch`에 최대 하루 48회 저장하고 `/health.schedulerDispatch.lastObservation`에서 확인합니다. `accepted`는 GitHub의 204 접수이며 실제 성공은 Actions 완료 기록으로 별도 확인합니다. KV 기반 동일 슬롯 억제는 eventual consistency 범위의 최선 노력이며 전 세계 원자적 중복 방지를 보장하지 않습니다.

P1596/P1597: watchdog의 blocking gate PASS와 전체 운영 상태 PASS는 구분합니다. AI/선택 소스·스케줄 관측이 저하되면 전체 상태는 DEGRADED이며 Step Summary와 별도 health artifact에 이유를 보존합니다. 7/30일 SLO는 schedule 이벤트만 측정합니다. Worker가 dispatch한 실행은 도착 관측에는 포함하지만 SLO schedule 성공률을 대신 채우지 않습니다. 30일 자료는 main 실행 최대 3,000개를 조회하며 누락된 조회 증거·부족한 관측 일수·미래 실행·중복 실행 ID로 인증하지 않습니다. 수집 상한을 넘으면 인증은 계속 보류합니다.
