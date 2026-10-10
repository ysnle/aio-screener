---
title: Operator runbook — provisioning and manual boundaries
last_verified: 2026-10-03
auto_refresh: false
---

# Operator runbook

이 문서는 **자동화가 스스로 채울 수 없는 것**의 정본이다. 어떤 시크릿·변수가 있어야 어느 레인이 도는지, 무엇이 의도적으로 수동인지, 그리고 수동 경계가 무너졌는지 어떻게 확인하는지를 기록한다.

`scripts/ci-operator-secrets-contract-check.mjs`가 이 문서를 기계적으로 검사한다. 워크플로가 참조하는 `secrets.*`/`vars.*`가 여기에 없으면 CI가 실패한다.

## 1. 저장소 Secrets

Settings → Secrets and variables → Actions → **Secrets**에 등록한다.

| 이름 | 사용하는 워크플로 | 없을 때 결과 |
|---|---|---|
| `FRED_API_KEY` | `refresh-data.yml`, `macro-calendar-review.yml`, `deploy-ai-proxy.yml`의 운영자 smoke | 정기 수집 실패 시 매크로는 LKG와 실패 상태를 유지한다. 사용자 개인 실시간 조회에는 대신 사용하지 않는다. 배포 후 운영자 자신의 FRED smoke에만 사용한다. |
| `OPENAI_API_KEY` | `deploy-ai-proxy.yml`의 명시적 수동 Secret sync만 | GPT-6 Luna 전용 OpenAI 프로젝트 키. 공유 Worker에만 게시하며 `refresh-data`나 브라우저에 전달하지 않는다. 미설정이면 Worker AI가 503으로 거부한다. |
| `AIO_AUTOMATION_TOKEN` | `refresh-data.yml`, `deploy-ai-proxy.yml` | 32자 이상의 무작위 비밀값. Worker와 Actions에 같은 값을 설정한다. Origin 없는 Actions 요청을 인증하며, 없으면 시장 AI 서술은 검증된 관측치만 표시하는 보류 상태다. 사용자 브라우저에 전달하지 않는다. |
| `TWELVE_DATA_API_KEY` | `refresh-data.yml` | Yahoo 실패 시 2차 시세 폴백이 사라져 `CORE_QUOTE_COVERAGE_FAILED` 위험이 커진다. |
| `FINNHUB_API_KEY` | `refresh-screener.yml` | 실적/IPO 캘린더가 이전 파일을 유지한 채 갱신되지 않는다. |
| `BOK_API_KEY` | `deploy-ai-proxy.yml` | **선택.** `/relay`의 `bok` 제공자만 503 fail-closed로 남고 배포는 계속된다(경고로 표시). 브라우저는 이 소스에 직접 도달할 수 없으므로 키가 없으면 한국은행 지표는 서버 스냅샷에만 의존한다. |
| `KOSIS_API_KEY` | `deploy-ai-proxy.yml` | **선택.** 위와 동일하게 `kosis` 제공자만 fail-closed. |
| `AIO_REFRESH_DISPATCH_TOKEN` | `deploy-data-plane.yml` | **권장(P1578).** 이 저장소만 대상으로 Actions 읽기·쓰기 권한을 준 fine-grained PAT. 데이터 평면 Worker에 `GITHUB_DISPATCH_TOKEN`으로 복사되어 5분 cron이 :20/:50에 `refresh-data`를 디스패치한다. 없으면 GitHub 예약 실행에만 의존한다(실측 슬롯의 약 10%). `/health`의 `schedulerDispatch.configured`와 워치독 경고로 확인한다. |
| `CLOUDFLARE_API_TOKEN` | `deploy-ai-proxy.yml`, `deploy-data-plane.yml` | 두 Worker 배포가 `operator_required`로 즉시 실패한다. |
| `CLOUDFLARE_ACCOUNT_ID` | `deploy-ai-proxy.yml`, `deploy-data-plane.yml` | 위와 동일. |
| `AIO_QUOTES_KV_ID` | `deploy-data-plane.yml` | 패스트 플레인 배포가 중단된다. |
| `FMP_API_KEY` | (없음 — 폐기) | **retired.** 어떤 워크플로도 참조하지 않으며 `ci-data-pipeline-contract-check.mjs`가 `refresh-data.yml`/`refresh-screener.yml`로의 유입을 금지한다. 무료 SEC companyfacts로 대체되어 `data.json`의 fundamentals는 이 키 없이 채워진다. 저장소 시크릿 목록에 남아 있다면 삭제해도 무해하다. |

## 2. 저장소 Variables

같은 화면의 **Variables** 탭에 등록한다. Secrets와 달리 값이 로그에 노출되지 않아야 하는 항목이 아니다.

| 이름 | 사용하는 워크플로 | 없을 때 결과 |
|---|---|---|
| `SEC_USER_AGENT` | `refresh-data.yml`, `refresh-screener.yml` | SEC fair-access 정책상 필수다. 없으면 SEC 레인이 `operator_configuration_required`를 쓰고 **아무것도 수집하지 않은 채 통과**한다 — 조용한 결손이므로 가장 먼저 확인할 항목이다. |
| `AIO_PROXY_URL` | `deploy-ai-proxy.yml`, `refresh-data.yml` | 기본값(`https://aio-proxy.zmfhd007.workers.dev`)으로 검증한다. 커스텀 도메인이면 반드시 설정한다. |
| `AIO_FAST_QUOTES_URL` | `deploy-data-plane.yml` | 기본 Worker URL로 스모크 검사한다. |

## 3. 공유 자격증명과 사용자 자격증명의 경계

이 앱에는 두 종류의 자격증명이 있고, 둘은 서로 다른 경로를 탄다. 경계를 흐리면 "설정했는데 동작하지 않는다"가 조용히 생긴다(P1151).

**공유(운영자 소유)** — 저장소/Worker 시크릿으로 두고 사용자는 아무것도 입력하지 않는다.

- OpenAI 서버 키: `OPENAI_API_KEY` → `aio-proxy`의 `POST /openai` → OpenAI Responses API, 요청 모델은 `gpt-6-luna`만 허용한다. 채팅·번역·Actions 시장 서술은 모두 이 Worker를 경유하며 같은 월 예산 원장을 사용한다. 개인 AI 키나 다른 공급자 직접 호출 폴백은 사용하지 않는다.
- 자동화 인증: Actions는 `X-AIO-Automation-Token`으로 인증한다. 운영자 제공 HTTPS `AI_PROXY_URL`만 호출하고 리다이렉트를 거부한다. 실패·429·미완료 응답에는 제공자 직접 호출 재시도가 없다.
- 시장 데이터 릴레이: BOK/KOSIS는 운영자 Secret을 사용한다. FRED 공식 [API 키 지침](https://fred.stlouisfed.org/docs/api/api_key.html)은 애플리케이션 사용자별 키를 요구한다. 정기 수집 결과를 읽는 것과 개인 실시간 API 조회는 구분한다. 개인 FRED 조회는 본인 키로만 수행하며 공용 Worker 중계는 사용자 opt-in이 있어야 한다. 업스트림 host는 고정이고 키는 응답·로그·캐시에 남기지 않는다.

**사용자별 선택 설정** — Alpha Vantage, Finnhub, FMP, Twelve Data, NewsData, RSS2JSON, FRED, Google CSE(key+cx), CF Worker URL(선택적 자체 프록시)은 개인 설정이다. 필수 가입·입력은 아니며 키가 없으면 해당 기능의 무료·서버 수집·캐시 자료를 사용하거나 기능을 보류한다. 개인 키는 브라우저 localStorage(선택 시 Vault 암호화)에 저장된다. FRED의 명시적 opt-in 중계 외에는 제공자/본인 Worker로만 전송한다. FMP는 신규 무료 계정에 맞춰 `stable`을 사용하지만, 무료 키가 모든 데이터셋 접근권을 뜻하지 않는다. Twelve Data 묶음은 지표별 credit를 소비하고 브라우저 카운터는 계정 전체 소비를 보증하지 않는다. NewsData 무료 뉴스는 12시간 지연된다. Perplexity AI 경로는 비활성화하며 기존 저장키는 자동 삭제하지 않는다.

**규칙**: 개인 키가 URL에 실리는 요청은 제3자 공용 CORS 프록시로 보내지 않는다. FRED의 명시적 opt-in 예외는 `X-AIO-Provider-Key` 헤더로 신뢰된 AIO Worker에만 전달하고 서버 저장·캐시·리다이렉트를 금지한다. opt-in 없는 기존 저장키는 본인 Worker/직접 연결만 사용한다. 공용 수집 자료 열람에는 개인 키가 필요 없다. 시리즈별 재배포 권리는 키 등록이나 무료 제공 여부와 별도로 확인한다.

## 4. Cloudflare 대시보드 전용 설정 (저장소에 없다)

다음 항목은 코드로 표현되지 않으며 운영자가 대시보드에서 직접 만들어야 한다.

- **레이트리밋 (v56부터 코드에 포함, 대시보드 작업 불필요)** — `worker/wrangler.proxy.toml`이 Workers **Rate Limiting binding** 3개를 선언한다: `RATE_LIMIT_PROXY`(300/분), `RATE_LIMIT_OPENAI`(20/분), `RATE_LIMIT_RELAY`(60/분). 모두 `period = 60`이다.
  - **존 단위 WAF 규칙은 이 배포에 쓸 수 없다.** 워커가 `aio-proxy.zmfhd007.workers.dev`(Cloudflare 공유 존)에만 있고 커스텀 도메인이 없어 규칙을 붙일 존이 없다. v56 이전의 "WAF 규칙이 실효 상한" 안내는 그 전제가 성립하지 않는 잘못된 안내였다(P1157).
  - **남는 한계는 정직하게 둘**: 바인딩은 Cloudflare **로케이션별**이라 전역 상한이 아니고, 설계상 eventually consistent다. 전역 권위는 여전히 DO 일일 캡이다(`AI_DAILY_CAP`, `RELAY_DAILY_CAP`). 일반 `?url=` 프록시에는 일일 캡이 없다.
  - **바인딩은 대시보드에 보이지 않는다.** 429는 Workers Logs / Observability에서 확인한다(계정 화면의 Observability 지표).
  - 세 브라우저 경로는 **호출자를 인증하지 않는다** — Origin 허용목록은 비브라우저 클라이언트가 헤더를 위조하면 통과하고, `AIO_APP_TOKEN`은 공개 클라이언트 JS에 상수가 있으며 미설정이면 검사 자체가 없다(`/health`의 `relay.appTokenRequired`로 확인). Origin 없는 Actions AI 요청은 별도로 비밀 `AIO_AUTOMATION_TOKEN`을 요구한다. `/relay`는 **운영자 FRED/BOK/KOSIS 쿼터를 소모**하므로, 위조 클라이언트는 일일 캡까지 소진시킬 수 있는 것으로 취급한다.
  - 커스텀 도메인을 워커에 붙이면 그때는 존 WAF rate limiting rule을 **추가** 방어층으로 쓸 수 있다(예: `http.request.uri.path eq "/relay"` → 60/분 → Block). 필수는 아니다.
  - 배포가 `[[ratelimits]]` 바인딩에서 실패하면(계정 미지원) 그 3블록을 제거하면 된다 — 코드는 바인딩이 없으면 isolate 로컬 Map으로 폴백한다.
- **`/relay` 키 교체 후 캐시** — `/relay` 응답은 `Cache-Control: public, max-age=3600`이므로 키를 바꿔도 엣지·브라우저 캐시가 최대 1시간 옛 페이로드를 계속 준다. 즉시 반영이 필요하면 `RELAY_DAILY_CAP`이나 파라미터를 바꾸기보다 배포 직후 `Cache-Control` 만료를 기다리거나 별도 확인용 시리즈로 검증한다.
- **KV 네임스페이스** `aio-quotes-prod` — 바인딩 id를 `AIO_QUOTES_KV_ID`로 저장소에 전달한다.
- **Durable Object** `AIOQuotaDurableObject` (`AIO_QUOTA_DO` 바인딩) — 없으면 `/openai`가 503 fail-closed로 거부한다. `/relay`의 일일 캡도 같은 바인딩을 쓰므로, 없으면 릴레이도 503이다.
- **Worker secrets** `AIO_CRON_SECRET`, 선택 `AIO_APP_TOKEN`, 선택 `AIO_DEV_ORIGINS`. `deploy-ai-proxy.yml`의 명시적 수동 dispatch가 `OPENAI_API_KEY`·`AIO_AUTOMATION_TOKEN`·`BOK_API_KEY`·`KOSIS_API_KEY`를 게시한다. FRED 운영자 키는 Actions 수집/운영자 자신의 smoke용이며 사용자 대신 Worker에 게시하지 않는다.
- **비공개 AI 사용량 관측(선택)** — `AIO_OPERATOR_TOKEN`을 `aio-proxy` Cloudflare Worker secret으로 설정하면 `GET /_ops/ai-usage`에서 현재 UTC 날짜의 공유 AI Durable Object 요청 수와 `AI_DAILY_CAP`을 확인할 수 있다. 최소 32자 무작위 값으로 발급하고 Cloudflare에 직접 `wrangler secret put AIO_OPERATOR_TOKEN --config worker/wrangler.proxy.toml`로 설정한다. 이 명령은 저장소의 정본 config를 사용하며, `.deploy.toml`은 CI runner 안에서만 생성된다. 저장소·워크플로 로그·공개 이슈에 값이나 응답을 복사하지 않는다. 미설정 또는 인증 실패는 404이며 `/health`에는 사용량·AI cap이 추가되지 않는다. 코드 배포 후 A5에서 secret 설정과 인증된 200 응답을 운영자가 확인해야 한다.
- **월 AI 예산** — `AI_MONTHLY_BUDGET_USD=10`이며 코드에서 $10보다 큰 설정은 허용하지 않는다. 채팅·번역·Actions·배포 smoke가 같은 원장에 호출 최대 비용을 먼저 원자적으로 예약한다. 상한에 도달하면 추가 유료 요청을 차단한다. 유료 웹 검색은 이 정책에서 비활성이다. 다른 앱에서 같은 프로젝트 키를 사용하면 Worker 원장 밖에서 청구되므로 AIO 전용 프로젝트와 키를 사용한다.
- **OpenAI 추가 방어** — 전용 프로젝트의 월 한도를 $10로 두고 `Enforce a hard limit`을 켠다. 알림만 설정하면 차단이 아니다. 공급자 hard limit도 적용 지연으로 소액 초과 가능성이 있어 Worker의 요청 전 원자적 예약이 주 방어다. 공식 안내: [OpenAI spend limits](https://developers.openai.com/api/docs/guides/spend-limits). 세금·환전과 다른 프로젝트 사용은 Worker의 USD API 원장 범위 밖이다.
- **최초 전환 순서** — 운영자는 전용 프로젝트 키와 자동화 토큰을 Secret으로 등록한 후 성공한 main CI run id를 지정해 `deploy-ai-proxy.yml`을 명시적으로 실행한다. 공유 Worker `/health`의 provider/model/automationConfigured와 실제 upstream smoke 통과 후 Actions를 확인한다. 자동 코드 배포는 기존 Cloudflare Secret을 유지한다. 이 문서는 설정 절차이며 현재 Secret 등록·배포 완료를 뜻하지 않는다.
- **릴레이 일일 캡** — `worker/wrangler.proxy.toml`의 `RELAY_DAILY_CAP`(기본 2000, 제공자별). 배포 전에 이 값을 조정하려면 toml을 수정한다.
- **패스트 플레인 승격 플래그** — `architecture/worker-endpoints.json`의 `fastQuotes.rightsReviewed`(권리 검토 완료 시 `true`)와 `soakRequiredDays`. 7일 soak와 권리 검토가 끝나기 전에는 `public-config.json`의 `marketData.fastQuotes.enabled`가 `false`로 유지되며 브라우저는 패스트 플레인을 읽지 않는다. 이 승격은 손으로 켜지지 않는다 — `scripts/ci-fast-plane-consumer-gate.mjs`가 게시된 증거로 재파생해 검사한다.

## 5. 의도적으로 수동인 배포 (자동 재배포 없음)

| 워크플로 | 트리거 | 이유 |
|---|---|---|
| `.github/workflows/deploy-ai-proxy.yml` | 성공한 strict main CI attestation 후 변경/미수렴 시 자동 실행; `workflow_dispatch`는 성공한 main CI run id 필수 | 성공한 main CI run의 exact-SHA attestation에서 배포한다. 자동 경로는 저장소 API 키를 다시 게시하지 않으며, 수동 secret sync는 dispatch에서만 실행한다. 실패 smoke는 캡처한 이전 Worker 버전으로 rollback하고 이전 source SHA/status를 확인한다. |
| `.github/workflows/deploy-data-plane.yml` | 성공한 strict main CI attestation 후 변경/미수렴 시 자동 실행; `workflow_dispatch`는 성공한 main CI run id 필수 | 성공한 main CI run의 exact-SHA attestation에서 배포하고 실패 smoke 시 캡처한 이전 Worker 버전으로 rollback한다. |

자동 배포는 exact successful main CI attestation을 소비하고, 현재 live `/health` source SHA부터 해당 CI SHA까지의 누적 Worker 변경을 비교해 취소되거나 대체된 실행의 변경을 회수한다. attested SHA가 계속 main HEAD이고 live SHA가 그 조상일 때만 자동 복구를 허용하며, 배포 직전에도 main HEAD를 재확인한다. 지연 이벤트나 더 최신·분기된 live Worker를 과거 SHA로 되돌리지 않는다. 데이터 플레인 감지는 정적 로컬 import graph를 포함한다. 변경된 Worker는 smoke 확인을 거치며 실패하면 명시된 이전 버전으로 rollback한다. live SHA를 확인할 수 없으면 자동 결정이 fail-closed된다. 저장소 측 revision은 `worker/wrangler.proxy.toml`의 `AIO_APP_REVISION`이 `version.json`을 따라가며 `ci-version-check.mjs`와 `bump-version.mjs`가 동기화를 강제한다. 첫 GitHub artifact handoff·자동 실행·live rollback은 아직 미검증이므로 외부 운영 증거가 추가될 때까지 운영자가 확인해야 한다.

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
