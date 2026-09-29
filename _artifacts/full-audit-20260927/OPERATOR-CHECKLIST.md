# AIO Screener 운영자 점검표 — 로컬 · GitHub · Cloudflare · 라이브 · 규제

> 작성: Claude Opus 5.5 · 2026-09-27 (KST) · 저장소 `C:\projects\AIO`
> 위치: `_artifacts/full-audit-20260927/OPERATOR-CHECKLIST.md` · 짝 문서: `HANDOFF.md` (F-xx 발견 ID, D-xx 결정 ID 참조)
> 원칙: **내가 직접 조회해 확인한 값만 상태로 기록한다.** §3 GitHub 설정표는 2026-09-27 최초 감사 시점의 스냅샷이다. 이후 A1/A2는 같은 날 적용·API readback 완료로 별도 기록됐지만, 2026-09-28 현재 설정은 재확인할 수 없어 미검증이다. Cloudflare 대시보드, Anthropic 콘솔 등 접근할 수 없는 곳은 ❓로 남긴다.
> 법·규제 항목은 **공개 자료 기반의 점검 포인트이지 법률 자문이 아니다.** 공개 확대·수익화 전에는 전문가 검토를 받을 것.

> **21:28 KST 실행 갱신:** v56.75 로컬에는 운영 알림의 공개 원천 수집기와 보호된 AI-usage read adapter가 연결됐고(19 offline assertions), P1310 지식 빌드 후보 경로는 QA `knowledge` 21/21 및 parity/Principles 계약을 통과했다. 이 검증은 로컬 증거뿐이며 GitHub scheduled run, artifact, 비공개 알림 전달은 확인하지 않았다. 공개 Pages/API와 Actions 최신 실행은 현재 실행 환경의 네트워크 EACCES로 재확인하지 못했다. 따라서 정상 scheduled refresh + reconciliation/strict lineage + exact-SHA/live acceptance라는 D0 긍정 증거가 확보되지 않았고 조건부 commit/deploy를 실행하지 않았다. `main`은 `origin/main`보다 5커밋 뒤이며 worktree에는 기존 사용자 dirty 변경이 섞여 있다. 작업과 게이트 상세는 [`EXECUTION-STATUS.md`](./EXECUTION-STATUS.md)를 따른다.

> **21:48 KST 코드 보안 보강:** v56.76/P1314/R660/QA-DATA-54에서 지식 candidate builder가 symlink를 따라 isolated copy 바깥으로 쓰는 경로를 차단하고 두 builder helper의 affected-QA parity 매핑을 추가했다. 로컬 knowledge group 21/21, generated parity(17 builder/655 outputs), pipeline/trace/ledger/version gates는 PASS했다. clean checkout이 아니어서 exact-SHA candidate artifact는 만들지 않았고 GitHub workflow 실행은 미검증이다. 최신 Pages/Actions도 네트워크 EACCES로 확인 불가해 D0 release 조건을 입증하지 못했다. 기존 mixed dirty 변경을 보존하며 commit/deploy는 실행하지 않았다.

> **2026-09-28 실행 상태 갱신:** 아래 계정 관측은 2026-09-27 기록이며 현재값 재확인이 필요한 항목은 미검증으로 남긴다. A1/A2는 당시 GitHub REST API readback으로 완료됐다고 기록됐으나, security settings endpoint는 connector allowlist에서 거부되고 branch-protection read는 403이었다. **02:04 KST 라이브 Pages 확인:** `deployment.json`은 v56.33 / source SHA `fc75c775467001af6c1781cfc150c286b5a14806` / `2026-09-26T01:41:02.613Z`를 반환했고, remote main `79b71b9`은 당시 배포 SHA보다 9 commits 앞섰다. 라이브 HTML에 CSP meta가 없었고 응답 CSP header는 미확인이다. **02:18 KST Actions 재확인:** `Refresh market data` run #36335191147은 새 market snapshot 승격 전 reconciliation/promotion에서 실패했다. 별도 screener/SEC 예약 run #36336244802는 성공해 main을 `fbafa4b6`으로 갱신했지만, 그 SHA의 exact-SHA CI #36336339927은 `data-lineage`에서 실패했고 release attestation은 skip됐다. 공개 원격 `data.json`·`market-snapshot.json`은 여전히 9/26 snapshot, reconciliation은 PARTIAL이다. 따라서 이는 D0 배포 조건을 충족하지 않는다. GitHub account security, Cloudflare dashboard, Anthropic console, 현재 Pages 배포 SHA/header는 미확인이다. D0은 strict freshness와 정상 market-data scheduled refresh/reconciliation 이후 배포, D4는 기존 P/R/QA 원장에 회귀 추적 추가로 확정됐다. 자세한 증거는 [`EXECUTION-STATUS.md`](./EXECUTION-STATUS.md)에 있다.
> **현재 P0 종합 판정 (2026-09-28, 근거는 10:52 KST / 01:52:16Z까지): OPEN.** P1300/R649의 artifact `generatedAt` 회귀 방지 코드는 로컬 수정됐고 해당 fixture·pipeline·trace·ledger 검사는 통과했지만, stale-data 사고는 종료되지 않았다. 최신 실행 #36366846725 / workflow #1465 (01:40Z, SHA `6917fa3992b5cec36694fca6316b28f33dc8f15a`)는 78/78 quote 수집과 Tier-0 16/16 구조 검사를 통과했지만 새 durable snapshot revision을 만들지 못했다. A1 snapshot은 `2026-09-26T06:38:56.910Z`(12h SLA 초과, `attempt=failed`)에 머물렀고 reconciliation·fail-closed candidate gate가 실패했다. data commit/exact-SHA CI는 skip, artifact는 없으며 convergence는 `UNATTESTED_REVISION`이다. 01:47Z 정상 슬롯은 01:52:16Z까지 새 run이 관찰되지 않았다(실패로 분류하지 않음). 로그에 upstream Tier-0 거부 원인이 없어 QA-DATA-32 OPEN이다. 최신 전체 영향 QA(`2026-09-28T00:52:50.498Z`)는 89 PASS / 15 CACHED / 3 FAIL / 31 SKIP이며 stale reconciliation·A1·strict lineage FAIL과 차단된 browser phase를 포함한다. strict D0은 OPEN이고 수동 dispatch/producer/stage/commit/push/deploy는 하지 않았다. 상세 근거는 [`EXECUTION-STATUS.md`](./EXECUTION-STATUS.md)에 있다.

> **03:30 KST Actions 재확인:** 18:30:02Z까지 17:47Z·18:17Z `Refresh market data` 예약 슬롯의 실행이 관찰되지 않았다(실패로 추정하지 않음). 최신 run #36335191147 failure, remote main `fbafa4b6`이며 새 market artifact·exact-SHA CI·Pages deploy는 없다. 다음 cron 18:47Z를 기다린다. 병렬 Luna Max 리뷰도 strict gate를 완화하지 않는 안전한 P0 코드 수정은 확인하지 못했다. 계정 보안 및 Cloudflare·Anthropic 설정은 계속 운영자 확인/미검증 상태다.

> **03:31 KST watchdog 결과:** #36340890782는 `watchdog-web-research`(AAII 자동 수집이 12h 초과)와 `external-pipeline` 실패로 종료했다. operations SLO는 `NOT_CERTIFIED`, 7일·30일 FAIL이며 market·screener·watchdog 모두 DEGRADED다. 이는 market-data 정상 갱신이나 snapshot 승격이 아니다. 자세한 내용은 [`EXECUTION-STATUS.md`](./EXECUTION-STATUS.md)에 있다.

> **04:00 KST market-data 확인:** 18:47Z 예약 실행은 19:00:13Z까지 관찰되지 않았다(실패로 단정하지 않음). 최신 market-data run #36335191147은 failure이며 새 artifact·commit·exact-SHA CI·Pages deploy는 없다. 다음 cron 19:17Z를 추적한다.

> **04:30 KST market-data 확인:** 19:17Z 예약 실행은 19:30:19Z까지 관찰되지 않았다(실패로 단정하지 않음). 최신 run #36335191147이며 새 market artifact·CI·배포는 없다. 다음 cron 19:47Z를 기다린다.

> **04:47 KST Actions:** Pages run #36345550694은 SHA `fbafa4b6`에서 `deploy` job이 skip되어 성공 배포가 아니다. 19:17 슬롯은 미관찰, 19:47 market-data slot은 19:47:58Z 현재 미관찰이며 20:00Z까지 지연 여부를 확인한다. 자세한 사항은 [`EXECUTION-STATUS.md`](./EXECUTION-STATUS.md)에 있다.

> **05:01 KST 최종 확인:** 19:47Z market-data 예약 슬롯은 20:00Z까지 관찰되지 않아 미관찰로 유지한다(실패로 단정하지 않음). Pages run #36346118499도 SHA `fbafa4b6`에서 `deploy` job이 skip됐다. 새 market artifact·exact-SHA CI·attestation·성공 배포가 없어 strict D0 조건은 미충족이다. 다음 정상 scheduled refresh를 기다린다. 자세한 증거는 [`EXECUTION-STATUS.md`](./EXECUTION-STATUS.md)에 있다.

> **05:10 KST market-data run:** scheduled run #36346938010은 quotes 78/78·macro 130을 fetch했지만 마지막 A1 snapshot이 `2026-09-26T06:38:56.910Z`(age 1.56d, 12h SLA)여서 22-category reconciliation과 fail-closed promotion에 실패했다. commit·exact-SHA CI·attestation·deploy는 없었다. 실패 escalation #36347026169가 기존 GitHub issue #5를 갱신했으나 새 comment·email·chat·webhook은 없고, subscriber 알림 전달 여부는 미검증이다. strict D0 gate를 유지한다.

> **05:52 KST 예약 슬롯:** trigger SHA의 raw workflow cron은 `17,47 * * * *`, `13 7 * * *`다. 20:17Z 슬롯(20:35:16Z까지)과 20:47Z 슬롯(20:52:08Z까지) 모두 새 실행 미관찰이다. 유일한 신규 run #36346938010은 20:08Z 조기 시작 후 stale snapshot으로 실패했다. 다음 cron은 21:17Z이며 strict D0 gate를 유지한다.

> **06:22 KST 예약 슬롯:** 읽기 전용 Actions 모니터링에서 21:17Z scheduled market-data run은 21:22:01Z까지 관찰되지 않았다. 이를 workflow failure로 단정하지 않는다. 다음 cron은 21:47Z다. fresh market snapshot·strict reconciliation·exact-SHA CI가 없으므로 D0 배포 조건은 여전히 미충족이다.

> **06:24 KST 코드·로컬 게이트:** P1299/QA-DATA-42의 대용량 Git blob 회귀와 진단 artifact 워크플로 검사는 통과했다. 생성 상태 및 knowledge/skill/workspace 계약도 통과했다. 다만 로컬 A1 market snapshot은 1.83일 경과해 12h strict SLA를 넘고 `D1-structural=no`이므로, 실제 refresh·reconciliation·배포 인수 전까지 D0은 미완료다. 원격 실패 artifact는 아직 읽지 못했다.

> **06:26 KST 영향 QA:** `affected --session audit-full-20260927`는 90 PASS / 14 CACHED / 3 FAIL / 31 SKIP. 세 FAIL은 24h를 넘긴 reconciliation, 43.84h stale A1 snapshot, 43.85h live-core lineage(`data.json`, `market-snapshot.json`)다. 코드 계약·trace·ledger 검사는 통과했다. 31 SKIP에 browser phase가 이 세 gate 때문에 blocked된 항목이 있어 UI/Tier 13 PASS로 주장하지 않는다. 새 입력이 없으므로 실패 batch를 반복 실행하지 않는다.

> **06:52 KST 예약 슬롯:** 21:47Z `Refresh market data` run은 21:52:13Z까지 관찰되지 않았다(실패로 분류하지 않음). 새 data artifact·reconciliation·exact-SHA CI가 없어 D0 strict gate는 미통과다. 다음 cron은 22:17Z다.

> **07:22 KST 예약 슬롯:** 22:17Z scheduled `refresh-data.yml` run은 22:22:34Z까지 관찰되지 않았다. 새 run/artifact가 없어 workflow failure로 단정하지 않는다. 다음 cron은 22:47Z이며, fresh snapshot·strict reconciliation·exact-SHA CI가 없어 D0은 계속 미충족이다.

> **07:26 KST 원격 로그 재확인:** run #36346938010의 fetch-market 78/78 및 source-to-consumer 통과, 22-category reconciliation/candidate gate 실패, commit/CI dispatch skip을 확인했다. A1 snapshot은 `2026-09-26T06:38:56.910Z`(1.56d, `attempt=failed`). exact-SHA CI #36336339927 job #108667964834는 `data-lineage`에서 실패했지만 로그에 정확한 live-core FAIL 행은 남지 않았고 artifact도 없다. U1/QA-DATA-32는 미완료다.

> **07:39 KST Luna Max 병렬 교차검증:** P1299/QA-DATA-42 독립 코드 리뷰에서 재현 가능한 결함은 발견되지 않았다. `ci-data-refresh-audit` 진단 계약, QA/data pipeline 계약, candidate `--self-test`(1 MiB 초과 staged/committed blob 포함), assertion trace 및 ledger integrity 검사가 통과했다. 별도 read-only GitHub 확인에서는 refresh #36346938010과 exact-SHA CI #36336339927 모두 artifact API가 빈 목록을 반환했고, exact-SHA 로그의 정확한 live-core FAIL 행도 확인되지 않았다. U1/QA-DATA-32와 P0 strict freshness gate는 계속 미완료다. 브라우저 인수는 수행하지 않았으며 파일·계정·워크플로를 변경하거나 commit/push/deploy하지 않았다.

> **07:51 KST 릴리스 경계 감사:** QA 기준선 당시 tracked dirty 73개가 이미 사용자 변경이었고, 그중 53개는 이후 task 변경이 겹쳐 파일 단위로 분리할 수 없다. P1299의 tracked 변경 6개와 생성 상태 overlay는 통째로 staging하지 않는다. 조건부 task-owned 후보는 `_artifacts/full-audit-20260927/` 문서 트리이며, 기준선에 있던 기존 사용자 untracked 문서 2개는 제외한다. P0 미통과 상태라 현재 stage/commit/push/deploy는 없다.

> **07:53 KST 22:47Z 예약 슬롯:** read-only GitHub Actions run-list에서 22:53:14Z까지 새 `refresh-data.yml` 실행을 관찰하지 못했다. 이를 실패로 분류하지 않는다. 새 run/artifact가 없어 P0 strict refresh·reconciliation·lineage 조건은 계속 미충족이며, 다음 cron은 23:17Z다.

> **08:00 KST 라이브·GitHub 재확인:** live `deployment.json`은 v56.33 / SHA `fc75c775467001af6c1781cfc150c286b5a14806`이고 GitHub main SHA는 `6917fa3992b5cec36694fca6316b28f33dc8f15a`라 서로 다르다. 라이브 `data.json`·`market-snapshot.json`은 45h25m 경과로 12h strict SLA를 초과하며 reconciliation은 `PARTIAL`/`closure.complete=false`다. rulesets는 빈 목록, Actions permissions API는 connector allowlist 차단으로 재검증 불가다. A1/A3/A4/A5/A6 계정 설정은 현재값 미검증으로 유지한다. `#36352227033` 성공 run의 exact-SHA CI·attestation·Pages 결과는 추가 확인 중이며, 정상 refresh·P0 종료 조건은 충족되지 않았다.

> **08:04 KST exact-SHA CI 확인:** scheduled `Refresh screener` #36352227033은 SHA `6917fa3992b5cec36694fca6316b28f33dc8f15a`를 생성했다. 그 SHA의 exact-CI #36352319347은 preflight/core PASS, `Contracts/data` FAIL, attestation SKIP이며 converge는 `UNATTESTED_REVISION`으로 배포를 거부했다. SHA `6917fa…`의 Pages 배포는 없고 live는 구 SHA다. 상세 FAIL 행/artifact 인수 확인이 남아 있어 U1/QA-DATA-32는 계속 미완료다.

> **08:06 KST U1 / artifact 증거:** #36352319347 failed job #108713403428 전체 로그에서 정확한 `[qa] FAIL data-lineage (1072ms)`를 확인해 HANDOFF §11의 U1은 완료 처리했다. 상세 `live-core` FAIL 행은 없으며 artifact API는 빈 목록이다. QA-DATA-32는 OPEN이고 원인을 WARN으로 추정하지 않는다.

> **08:07 KST 23:03Z scheduled market refresh:** run #36357397342 / SHA `6917fa…`는 failure로 완료됐다. 78/78 quotes는 받았으나 A1 durable snapshot은 `2026-09-26T06:38:56.910Z`(12h SLA 초과, `attempt=failed`)이고 reconciliation/candidate gate가 실패했다. 데이터 commit과 exact-CI dispatch는 skip, workflow artifact는 없다. 미관찰이 아니라 실제 실패이며 P0 strict 조건은 미통과다.

> **08:22 KST 23:17Z 예약 슬롯:** 23:22:38Z까지 새 scheduled `refresh-data.yml` run이 관찰되지 않았다. 이를 실패로 분류하지 않는다. 직전 실제 run #36357397342는 stale A1로 실패했으며 fresh snapshot·strict reconciliation이 없어 다음 cron 23:47Z를 기다린다.

> **08:31 KST U2 code-path 확인:** `attempt=failed`는 Tier-0 coverage/row quality에서 정해지고, A1의 12h freshness와는 별도다. 3일 weekend/closed-venue grace는 개별 quote에만 적용된다. code-path trace는 완료해 HANDOFF U2에서 제거했으나, #36357397342에서 막힌 실제 row는 artifact 부재로 미확정이며 QA-DATA-32를 기다린다. 원인 fixture 없이 producer를 수정하지 않았다.

> **08:34 KST 전체 로그 재확인:** #36357397342 job #108727737064의 41,124행 로그에도 `attempt=failed`의 Tier-0 거부 원인은 출력되지 않았다. 22-category reconciliation은 PARTIAL(14/6/2)이고 B2/B3의 구독 접근 BLOCKED, A3/D2의 MARKET_CLOSED, quotes 78/78 성공은 각각 확인했지만 producer 실패에 연결되는 막힌 symbol/row는 없다. QA-DATA-32 OPEN이며 WARN/BLOCKED로 원인을 추정하지 않는다. 다음 23:47Z 예약 슬롯을 read-only로 관찰한다.

> **08:53 KST P0 코드 회귀 수정:** P1300/R649에서 refresh audit가 snapshot 자체의 `generatedAt`만 freshness·promotion 근거로 사용하도록 했다. status `lastSuccessfulAt`만 최신이어도 artifact 시간이 없으면 freshness `MISSING`, promotion 차단, diagnostic capture다. QA-DATA-43 fixture는 registry-derived full Tier-0 coverage(현재 16/16)를 유지하며, data-pipeline contract·assertion trace·ledger integrity PASS. live A1 strict freshness와 QA-DATA-32 원격 artifact 인수는 별도 OPEN이다.

> **08:53 KST 23:47Z 예약 슬롯:** 23:53:08Z까지 새 scheduled `refresh-data.yml` run은 관찰되지 않았다. 이번 슬롯의 run/artifact/reconciliation/CI 결과는 없으며 이를 실패로 분류하지 않는다. 다음 cron은 00:17Z다. P0 strict refresh·reconciliation 조건은 미통과 상태다.

> **08:55 KST 영향 QA:** 지정한 P0 소스·원장·문서 파일만 대상으로 preflight/data/workspace 20 PASS·6 CACHED·1 FAIL·0 SKIP. 유일한 FAIL은 기존 stale local A1 snapshot(2026-09-26T01:35:13.162Z, age 1.93d, `CRITICAL`; `D1-structural=no`)이다. P1300 회귀 fixture와 pipeline/workspace/ledger/assertion gates는 PASS했다. 입력 변경이 없으므로 stale gate 재시도는 보류하고 strict freshness를 유지한다. 상세 보고서는 [`EXECUTION-STATUS.md`](./EXECUTION-STATUS.md)에 있다.

> **08:59 KST local strict-gate 확인:** data-lineage는 24개 산출물 중 13 PASS/9 WARN/2 FAIL이며, hard FAIL은 `data.json` 46.4h > 12h와 `market-snapshot.json` 46.4h > 24h다. reconciliation contract도 `reconciliation-status.json` 38.65h > 24h로 FAIL. 이는 현재 로컬 artifact 판정이며 fresh scheduled output이나 live 배포 증거가 아니다. strict D0 gate를 유지한다.

> **09:22 KST (00:17Z) 예약 슬롯:** read-only run-list에서 00:22:20Z까지 새 scheduled run/artifact를 관찰하지 못했다. 이를 실패로 분류하지 않는다. 다음 슬롯은 00:47Z다. 이 슬롯에서 새 데이터·reconciliation·CI 증거가 생기지 않아 P0 strict freshness gate는 계속 OPEN이다.

판정 기호: ✅ 양호 · ⚠️ 주의(개선 권장) · ❌ 조치 필요 · ❓ 운영자만 확인 가능

---

## 0. 운영 전제 (기준선 확인 2026-09-27) — 이 점검표의 기준선

- 사용자: **가족·지인 소수**(현재 약 5명). 공개 서비스가 아니다.
- 용도: 각자 **실제 매매 판단에 참고** + 경제·금융·주식 **개념 학습**.
- 비용: **무료 등급 안에서**(유일한 유료 항목은 Anthropic API 사용량).
- 운영: **운영자 1인, 자동 운영이 목표**.

이 전제에서 가장 중요한 운영자 원칙 5가지:
1. **무료·지인 한정·유료화 안 함**을 명문화하고 지킨다 — 금융 규제 노출의 핵심 경계.
2. 가족이 실제 돈을 걸므로 **"숫자의 기준시각과 검증 상태"**를 가장 먼저 챙긴다. 지금 스크리너 가격은 실시간이 아니라 마지막 파이프라인 값이고(최대 수 시간, 주말 정지), 홈 매매점수는 과거 성과가 반대로 측정됐다 — 가족에게 이 두 가지를 먼저 알려 둘 것.
3. 사람이 제때 고치지 않으면 멈추는 구조(날짜 만료 게이트)를 없애는 것이 자동 운영의 1순위다.
4. 사이트는 가족만 들어오게 잠근다(Cloudflare Access, 50명까지 무료).
5. 코드 저장소는 public 유지(Actions 무료 — 실측 ~7,000분/월로 private 무료 한도 2,000분 초과), 데이터·키는 저장소 밖으로.

---

## 0.5 누가 하나 — 이 점검표의 모든 항목을 운영자가 직접 할 필요는 없다

아래 §1–§10의 항목은 세 종류다. **운영자가 직접 해야 하는 것은 A뿐**이고, B는 에이전트에게 "해줘"라고 승인하면 되며, C는 개편(핸드오프 P0–P1)이 끝나면 사라진다.

### A. 운영자만 할 수 있는 것 (계정 권한·결정·사람) — 약 1–2시간, 대부분 1회성

| # | 할 일 | 어디서 | 소요 |
|---|---|---|---|
| A1 | **초기 감사 후 기록상 2026-09-27 적용·API readback 완료:** Secret scanning, Push protection, Dependabot alerts·security updates, Private vulnerability reporting, CodeQL default setup 켜짐. 당시 secret alert 0건, Dependabot `js-yaml` high alert 1건 및 PR #9 미병합 상태. **현재 설정은 미검증.** | 저장소 Settings → Code security | 현재값 재조회 필요 |
| A2 | **초기 감사 후 기록상 2026-09-27 적용·API readback 완료:** repository `GITHUB_TOKEN` 기본 권한 Read, PR 승인 권한 off, full-length SHA pinning 강제 켜짐. **현재 설정은 미검증.** | Settings → Actions → General | 현재값 재조회 필요 |
| A3 | main 브랜치 보호에 필수 상태 체크 추가 (CI 필수 계층이 정리된 뒤 — 지금 켜면 적색 CI가 모든 병합을 막음) | Settings → Branches | P1 이후 5분 |
| A4 | GitHub 계정: 2FA/패스키 확인, "Keep my email addresses private" + "Block command line pushes that expose my email" | github.com/settings | 5분 |
| A5 | Cloudflare 계정: 2FA, `CLOUDFLARE_API_TOKEN` 권한 최소화·만료일, 사용량 알림, `ANTHROPIC_DAILY_CAP` 실제 값, Observability에서 429 추이. 코드 배포 뒤에는 `AIO_OPERATOR_TOKEN`을 비공개 Worker secret으로 설정하고 `GET /_ops/ai-usage`의 인증된 UTC count/cap 응답도 확인 | Cloudflare 대시보드 | 20분 |
| A6 | Anthropic 콘솔: 월 지출 한도·알림, 사용 중인 모델(`claude-sonnet-4-6` 등)의 제공·폐기 예정 확인 | console.anthropic.com | 10분 |
| A7 | 현재 시크릿의 발급일·만료·교체일을 **비공개** 메모로 기록(값은 적지 않음). AI usage observer를 켤 경우 선택 secret `AIO_OPERATOR_TOKEN`도 포함 | 개인 메모 | 10분 |
| A8 | **결정 완료:** D0 strict freshness 유지, 정상 scheduled refresh/reconciliation 통과 뒤 배포. live-core grace 미채택. D1은 기존 dirty 변경을 보존하고 release 때 task-owned 파일만 분리. 정적 일정·유니버스 expiry severity는 미결정·현행 hard 유지. D4는 기존 P/R/QA 원장에 추적 추가. D12–D15는 별도 결정 필요. | 핸드오프 §9 및 EXECUTION-STATUS | 후속 결정만 |
| A9 | 가족에게 공유할 3가지: ① 스크리너 가격은 실시간이 아님(매매 직전엔 증권사 앱 확인) ② 홈 "매매점수"는 과거 성과가 반대로 측정됨 — 매수·매도 근거로 쓰지 말 것 ③ 포트폴리오 "내보내기"는 포지션만 저장됨 | 가족 대화 | 10분 |
| A10 | Cloudflare Access 도입 시 가족 이메일 허용목록 작성·관리 | Cloudflare Zero Trust | P2 때 15분 |
| A11 | 제공자 약관 확인 또는 전문가 문의(ICE HY OAS, Yahoo, Naver, CNN, Telegram) — 가족 전용·비공개로 가면 우선순위 낮아짐 | 각 제공자 약관 | 선택 |
| A12 | **2026-09-28 사용자가 현재 매크로 일정 작업 뒤 checkpoint commit/deploy를 명시 요청함.** 이 요청은 D0를 대체하지 않는다: 정상 scheduled refresh, reconciliation/strict lineage, exact-SHA CI와 live acceptance를 확인한 뒤 task-owned 파일 manifest만 stage한다(`git add -A` 금지). 현재 로컬 fresh-data 조건은 미충족. | 에이전트 대화 · D0/A8 | 정상 refresh 이후 진행 |

> **F-33 code status (2026-09-28):** v56.67 adds weekly main-only macro-calendar review safeguards: full date-set changes are reported and hashed, tentative/partial evidence prompts review, collector/issue secrets are step-scoped, and issue lookup falls back to the exact month title. It uploads 30-day evidence and cannot apply candidates; the static expiry gate remains hard. The workflow has not run from GitHub, so secret configuration, first collection, issue delivery/search and operator review remain unverified. After it is available on `main`, review the linked primary sources and change canonical runtime dates only in a separate reviewed code change. This does not satisfy D0 or authorize release before strict refresh/reconciliation/exact-SHA/live acceptance.

### B. 에이전트가 할 수 있는 것 (운영자가 "해줘"라고 승인하면 됨)

- **P0 실행·구형 Phase 0 표의 처리:** HANDOFF §8의 Phase 0 표는 과거 제안이며 실행 순서는 §0.5.6의 P0→P1→P2→P3→P4→P5가 대체한다. 구형 0-1~0-5는 각각 변경 경계·진단 증거·strict freshness·정상 scheduled refresh/reconciliation/lineage·조건부 exact-SHA release 기록으로만 참조한다. 0-6 운영자 보안·위생 작업은 A1/A2 및 별도 운영자 점검에 둔다. 0-7(2027 캘린더)은 P1+ 후속이고, 0-8(CSP 보강)은 P0 release 뒤 작업이며 P1–P5 중 단계는 아직 미분류다. 두 항목 모두 P0 종료 게이트가 아니며 완료 처리하지 않는다. P0 자체는 P1300 로컬 가드가 추가됐어도 strict fresh data/reconciliation/lineage와 release 인수가 끝날 때까지 OPEN이다.
- **안전 설정**: `.claude/settings.local.json`·`.commandcode`의 push/merge/reset 권한을 "확인 후"로 축소, 파괴 명령 훅 정규식 보강, Node 버전 통일, `.gitattributes` 줄바꿈 정책, 로컬 `git gc`, 불필요 브랜치·태그 삭제, Dependabot PR 검토
- **화면·데이터**: CSP meta, "AI 생성" 표시, 개발 문자열 제거, 고정 날짜(2026-04-17) 제거, "실시간" 배지 정직화, 스크리너 가격 경로 수리, 포트폴리오 전체 백업·복원, ICE 원값 공개 JSON 제외, 13F 수집 주기 조정
- **구조 개편(P1–P4)**: 자동화 치환표, Cloudflare 호스팅·Access·R2 코드 작업, 알림 3종, 거버넌스 축소

### C. 개편 후 자동화되어 운영자 루틴에서 빠지는 것

매크로 발표일 갱신 · 유니버스 월간 검토 · 휴장일 연간 등록 · 지식 빌더 실행 · Worker 배포(구현 완료: strict CI attestation 뒤 변경된 Worker만 자동 배포·스모크·실패 시 이전 버전 롤백, 라이브 첫 인수 미검증) · 버전 범프 · Dependabot 패치 병합 · 주말 정지 복구 → 모두 P1 "오토파일럿"에서 자동화 또는 비차단 경고로 전환된다.

**개편 후 운영자에게 남는 루틴**: 알림이 올 때만 확인(3종) + 월 1회 비용·사용량 5분 + 연 1회(11월) 키 교체·약관·가족 명단 점검.

> §10 "운영 루틴"의 매일·매주 항목은 **개편 전 과도기**에만 필요하다.

---

## 1. 날짜가 정해진 위험 — 달력에 바로 넣을 것

| 날짜 | 무슨 일이 생기나 | 근거(실측) | 운영자 조치 |
|---|---|---|---|
| **매주 토·일** | 시장 데이터 refresh가 실패 → 데이터 stale → CI `data-lineage` FAIL → **배포 정지** (9/12–13, 9/19–20, 9/26–27 3주 연속) | refresh 일별 실패 집계, run `36298287184`, `36297988434` | 월요일 오전 라이브 `deployment.json` 확인. 현재 대응은 §0.5.6 P0 strict freshness 유지 및 정상 scheduled refresh/reconciliation/lineage 확인 |
| **2026-09-30** | `AIO_MACRO_CALENDAR`의 `us-pce` 발표일이 지나면 `ci-static-db-expiry-check.mjs`가 "지난 nextRelease 잔존"으로 **hard FAIL** → CI `data` 그룹 적색 → **배포 정지** | `scripts/ci-static-db-expiry-check.mjs:46–52`, `architecture/qa-pipeline.json` groups.data | 발표 직후 레지스트리 갱신(현재는 `js/aio-core.js` 손 수정) 또는 이 검사를 warn으로 강등 |
| 10-01 · 10-02 · 10-05 · 10-14 · 10-15 · 10-22 · 10-28(2건) · 11-30 | 같은 메커니즘으로 반복: ISM 제조업, NFP, ISM 서비스, CPI, 소매판매, 한은 금통위, FOMC·기준금리, GTC DC | 위 스크립트로 추출한 `nextRelease` 목록 | 위와 동일. **거의 매주 한 번씩 수동 편집이 필요한 구조** |
| **2026-10-14** | `screener-universe.json` 마지막 갱신(7/16)+90일 → `replaceAfterDays` **하드 만료** → CI 적색 → **배포 정지** | `ci-static-db-expiry-check.mjs:31–39`, 런북 §6 | 그 전에 유니버스 월간 검토(`sync-screener-universe.mjs`) 실행 — 이미 30일 기준은 73일 초과 |
| 2026-11-01 | 미국 서머타임 종료 — 수동 오프셋 계산 코드(`_getUsSession` 등)의 경계 동작 확인 필요 | `js/aio-core.js:19250–19262` | 10월 말 DST 경계 테스트 요청 |
| 2026-11-14 전후 | 13F 3분기 제출 마감 → masters 샤드 대량 갱신 → **저장소·Pages 용량 급증** | 샤드당 전체 파일 커밋(BlackRock 62MB), 이력 10.3GB | 직전에 저장소 크기 확인, P2(데이터 분리) 우선순위 판단 |
| **2026-12-31** | KRX 2026 휴장일 누락 오류 보완됨: 공식 17일 목록(5/1·6/3·7/17·12/31 포함)이 native·legacy calendar에 등록됨 | [9/28 local v56.64] P1302/R447, [KRX official calendar](https://open.krx.co.kr/contents/MKD/01/0110/01100305/MKD01100305.jsp); not yet committed/deployed | 배포 뒤 표시 확인. 다음 유지보수에서 신규 연도 공지를 대조해 등록 |
| 2026-12-26 | 이벤트 레지스트리 `fomc`(9/16) 보존창 만료 → 제거 안 하면 CI FAIL | 같은 스크립트 :60–65 | 12월 중순 정리 |
| **2027-01-01** | 2027 KRX·NYSE 연간 캘린더 등록 완료. NYSE 2027-01-01 is closed; unsupported 2028+ years intentionally remain `unknown` (no 2026 fallback) | [9/28 local v56.64] P1302/R447, [NYSE/ICE official calendar](https://ir.theice.com/press/news-details/2025/NYSE-Group-Announces-2026-2027-and-2028-Holiday-and-Early-Closings-Calendar/); not yet committed/deployed | 배포 뒤 현지 날짜/세션 표시 확인. 매년 공식 휴장·조기 폐장 공지를 등록 |
| ~2027-01-22 이후 | 「인공지능 기본법」 과태료 계도기간(최소 1년) 종료 가능 시점 | 법 2026-01-22 시행, 계도 최소 1년 | 그 전에 AI 생성물 표시 정비(§7) |
| 이미 지남 | Node.js 20 EOL(2026-04-30) — 워크플로 7개가 Node 20 | `node-version: '20'` 7곳 | Node 22/24 LTS로 통일 |

---

## 2. 로컬 프로젝트 (PC)

| 항목 | 기준 | 현재 상태 (실측) | 판정 | 운영자 조치 |
|---|---|---|---|---|
| 작업 경로 | 단일 정본 경로 | `C:\projects\AIO` 정상. 옛 OneDrive 경로는 **빈 폴더**인데 Claude 세션이 그 경로로 열림 | ⚠️ | 빈 폴더 삭제, 세션은 `C:\projects\AIO`에서 시작 |
| 작업 트리 | 원격과 동기, 미커밋 최소 | origin보다 **5커밋 뒤**, 수정 66파일(+1,676/−796), 미추적 2 (v56.53–55 작업) | ❌ | D1 결정: 주제별 분할 커밋 → rebase → 푸시 |
| 커밋 신원 | 누가(어느 도구가) 만들었는지 추적 가능 | 로컬 `user.name=aio-screener bot`, `user.email=noreply@local` — **모든 에이전트가 같은 신원** | ⚠️ | 커밋 트레일러(`Agent: claude/codex…`) 규칙 도입 |
| 줄바꿈 | 일관된 EOL 정책 | `core.autocrlf=true`, `.gitattributes`는 `public-data/objects/** -text`만. 40+파일 LF→CRLF 경고 | ⚠️ | `* text=auto eol=lf` 정규화를 별도 커밋으로 |
| 저장소 건강 | `.git` 1GB 미만 권장 | `.git` ~1.7GB, pack 42개, loose 1.0GB, 가비지 72MB | ⚠️ | 로컬 `git gc` (운영자가 직접 실행) |
| Node | CI와 로컬 동일 버전 | 로컬 v24.18(PATH 미등록), CI는 대부분 Node 20 | ❌ | PATH 등록 + `.nvmrc`/`engines`로 고정 |
| Claude 권한 | 푸시·배포는 확인 후 | `.claude/settings.local.json`이 `git push:*`, `git merge:*`, `git checkout:*`, `git pull:*`, `git reset *`, `node:*`, `python:*`, `curl:*` 등 90개를 **무확인 허용** | ❌ | push/merge/reset/checkout은 `ask`로 이동 |
| Codex 권한 | 동일 | `sandbox = "elevated"`, `approvals_reviewer = "auto_review"`, trusted 디렉터리 다수 | ⚠️ | AIO에서는 승인 모드 상향 |
| Command Code 권한 | 동일 | `Shell(git:*)`, `Shell(gh:*)` 전체 허용 (`gh workflow run`, `gh api -X DELETE`까지 가능), taste 파일에 `--yolo` 선호 기록 | ❌ | git/gh 와일드카드 축소 |
| 파괴 명령 훅 | 되돌릴 수 없는 명령 차단 | `agent-hook.mjs`는 `reset --hard`, `push … --force`, 홈/루트 `rm -rf`만 차단. **`push -f`, `--force-with-lease`, `+main`, `checkout -- .`, `restore .`, `clean -fdx`, `stash drop`, `gh workflow run`은 통과**. Codex·Command Code에는 이 훅이 적용되지 않음 | ⚠️ | 정규식 보강 + 다른 도구 설정에도 동등 규칙 |
| gh 토큰 | 최소 권한 | 로컬 `gh` 토큰 scope: `repo, workflow, gist, read:org` — 에이전트가 워크플로 수정·실행 가능 | ⚠️ | 에이전트 세션용으로 권한 축소 토큰 분리 검토 |
| 예약 작업 | 무단 자동 실행 없음 | AIO 관련 Windows 예약 작업 없음 | ✅ | — |

---

## 3. GitHub (저장소 · Actions · Pages) — 2026-09-27 최초 감사 스냅샷

> 아래 설정값은 최초 감사 시점(2026-09-27)의 기록이며 현재값을 뜻하지 않는다. A1/A2는 같은 날 이후 적용 및 API readback 완료로 별도 기록됐지만, 2026-09-28 재확인은 security settings endpoint 접근 차단과 branch-protection 403으로 불가능했다. 따라서 표의 A1/A2 초기값과 후속 적용 기록을 함께 보존하며, 현재 설정은 운영자 재조회 전까지 미검증으로 취급한다.

| 항목 | 기준 | 최초 감사 당시 상태 (실측) | 판정 | 운영자 조치 (Settings 위치) |
|---|---|---|---|---|
| 공개 범위·라이선스 | 의도된 공개 + 권리 명시 | **public**, LICENSE 없음 | ⚠️ | D8: LICENSE 추가 또는 private 전환(호스팅 이전과 함께) |
| Secret scanning / Push protection | 공개 저장소는 필수 | **disabled / disabled** | ❌ | Settings → Code security → 모두 Enable |
| Dependabot 알림·보안 업데이트 | 켜짐 | **disabled** (vulnerability alerts disabled) | ❌ | 같은 화면에서 Enable |
| Private vulnerability reporting | 켜짐 권장 | disabled | ⚠️ | Enable |
| Code scanning (CodeQL) | 권장 | 분석 없음 | ⚠️ | Default setup 켜기 |
| main 브랜치 보호 | 필수 체크 통과 후 병합 | 보호 존재(force-push·삭제 금지 ✅), **필수 상태 체크·리뷰 없음**, 관리자 우회 가능 | ❌ | Branch protection → Require status checks(CI 필수 계층) |
| Rulesets | — | 없음 | ⚠️ | 보호 규칙을 ruleset으로 이전 권장 |
| Actions 허용 범위 | 필요한 것만 | `allowed_actions: all`, **SHA 고정 강제 off**(워크플로는 이미 SHA 고정 ✅) | ⚠️ | "Require actions to be pinned to a full-length commit SHA" 켜기 |
| 기본 워크플로 권한 | read | **`write`** | ❌ | Actions → General → Workflow permissions → Read (워크플로는 명시 선언 중) |
| Pages | HTTPS, 워크플로 배포 | `build_type: workflow`, `https_enforced: true`, 커스텀 도메인 없음 | ✅ | — |
| github-pages 환경 | 배포 브랜치 제한 | custom branch policy ✅, `can_admins_bypass: true` | ⚠️ | 필요 시 우회 해제 |
| Secrets (7) | 필요 최소, 교체 기록 | `AIO_QUOTES_KV_ID, ANTHROPIC_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, FINNHUB_API_KEY, FRED_API_KEY, TWELVE_DATA_API_KEY`. BOK/KOSIS 미등록(선택) | ❓ | 각 키 발급일·만료·마지막 교체일을 비공개 메모로 관리, 연 1회 교체 |
| Variables | 공개돼도 되는 값만 | `SEC_USER_AGENT`에 개인 Gmail 포함(SEC 요구사항상 연락처 필요), `AIO_FAST_QUOTES_URL` | ⚠️ | 전용 연락 메일 사용 검토 |
| 운영 알림 이슈 | 열려 있으면 사고 | #2 CI failure(>24h), #4 watchdog, #5 refresh — **open** | ❌ | P0 strict refresh/reconciliation 복구 후 자동 종료 확인 |
| Dependabot PR | 1주 내 처리 | #7(Actions 8종, 9/17), #8(CI toolchain, 9/20) 방치 | ❌ | 검토·병합 |
| 브랜치·태그 정리 | 불필요 ref 없음 | `codex/v54.37-ai-reliability`(고유 커밋 0), 태그 `pre-rebase-backup-b707055e` | ⚠️ | 삭제 |
| 저장소 크기 | GitHub 권장 <1GB(5GB 초과 시 제한 가능) | 서버 458MB, 로컬 1.7GB, 하루 +11–14MB | ⚠️ | P2 전까지 월 1회 크기 기록 |
| 커밋 이메일 노출 | 개인 메일 비공개 | 개인 Gmail이 커밋 32개에 공개 | ⚠️ | 계정 설정 "Keep my email addresses private" + "Block command line pushes that expose my email" |
| 계정 2FA·세션 | 필수 | — | ❓ | github.com/settings/security 확인, 패스키/2FA 복구 코드 보관 |
| Actions 신뢰도 | SLO 99.5% | CI 실패율 68%, watchdog 79%, refresh 27% | ❌ | P0 strict 운영 복구 후 P1 자동화 |
| Actions 사용량(무료 유지 조건) | public이면 무료 | 실측 약 1,650분/주 ≈ **7,000분/월**(CI 95회×10분, 운영 알림 186회/주 등). private 무료 한도 2,000분/월 | ⚠️ | **private 전환 금지**(전환하려면 CI를 1/4 이하로 먼저 축소). 운영 알림 워크플로 실행 186회/주는 소음 — 축소 대상 |

---

## 4. Cloudflare (Workers · Durable Object · KV)

> 대시보드는 내가 볼 수 없다. 라이브 `/health`와 저장소 설정으로 확인한 값 + 운영자가 볼 위치.

| 항목 | 기준 | 현재 상태 | 판정 | 운영자 조치 |
|---|---|---|---|---|
| Worker 라이브 버전 | 저장소와 일치 | `aio-proxy` revision **v56.33** / `46f2f781` (당시 감사 스냅샷; 배포 자동화 미구현 상태) | ⚠️ | strict CI 성공 후 변경 Worker 자동 배포·스모크·실패 시 이전 버전 롤백. hidden attestation 업로드, import graph, 누적 live-SHA 복구, stale workflow-run/newer-live 거부도 QA 계약으로 고정; 수동 재배포는 main CI run id가 필요. 첫 자동 실행·artifact handoff·live recovery/rollback 미검증 |
| AI 릴레이 인증 | 실제 호출자 인증 | Origin 헤더 + 선택 토큰(`appTokenRequired: false`) — **비브라우저에서 위조 가능** | ⚠️ | 단기: DO 일일 캡 값 확인. 중기: Turnstile(핸드오프 F-08) |
| 비용 상한 | 일일 캡 존재 | `ai.quotaConfigured: true`, `maxTokens 1500`, relay `dailyCap 2000` | ✅ | `ANTHROPIC_DAILY_CAP` 실제 값 확인 ❓ |
| 레이트리밋 | 전역 상한 | 위치별 바인딩(전역 아님), 429는 대시보드 기본 화면에 안 보임 | ⚠️ | Workers → Observability에서 429 추이 주 1회 확인 |
| 계정 보안 | 2FA, 최소 권한 토큰 | — | ❓ | 2FA 확인, `CLOUDFLARE_API_TOKEN` 권한을 해당 계정의 Workers·KV·DO 편집으로만 제한, 만료일 설정 |
| 로그의 개인정보 | IP 최소 보존 | observability 샘플링 0.1 | ❓ | 로그 보존기간·IP 포함 여부 확인 |
| 빠른 시세 플레인 | 승격 전 soak·권리 검토 | 작동 중(16/16), `enabled:false`, soak 0/7일, 권리 미검토 | ⚠️ | 결정 필요(핸드오프 P2) |
| 요금·알림 | 한도 알림 | Free 플랜 추정 | ❓ | 사용량 알림 이메일 설정 |

---

## 5. 외부 계정 · API 키

| 항목 | 기준 | 현재 상태 | 판정 | 운영자 조치 |
|---|---|---|---|---|
| Anthropic 콘솔 | 월 지출 한도·알림 | — | ❓ | Console → Limits에서 월 한도·알림 설정, 이 키 전용 워크스페이스 |
| 사용 모델 | 현행 모델, 한 곳에서 관리 | 코드에 `claude-sonnet-4-6`, `claude-haiku-4-5(-20251001)`, `gpt-5.4` 하드코딩 5곳+, 배포 스모크는 Haiku만 호출 | ⚠️ | 콘솔에서 사용 가능·폐기 예정 여부 확인, 교체는 비용 정책과 함께 결정 |
| SEC EDGAR | 연락 가능한 User-Agent, ≤10 req/s | UA 설정됨, 배치 24건/주기 | ✅ | 메일함 모니터링 |
| FRED | 키 유효 | `fredOk: true` | ✅ | ICE 시계열 재배포 문제는 §6 |
| Finnhub · Twelve Data | 무료 플랜 약관 준수 | 등록됨 | ❓ | 무료 플랜의 비상업·표시 의무 조건 확인 |
| BOK · KOSIS | 선택 | 미등록 → `/relay` bok/kosis 비활성 | ⚠️ | 한국 매크로가 필요하면 등록(공공누리 출처 표시 조건 준수) |
| 사용자 개인 키(BYO) | 브라우저 로컬 보관 | 로컬 저장, PIN 설정 시 AES-GCM. PIN 최소 4자 | ⚠️ | PIN 최소 길이 상향 검토 |
| 가족 포트폴리오 데이터 백업 | 기기 교체·브라우저 정리에도 복구 가능 | 브라우저 저장소만 사용, `storage.persist()` 없음(Safari 7일 축출 대상), **"내보내기"는 포지션 목록만** — 원장·FX·가정 설정 누락 | ❌ | 가족에게 당분간 포지션 외 설정은 별도 기록 안내, P3에서 전체 백업 |
| AI 채팅 정책 | 운영자가 정한 선 | 개인화 매매 요청(적합성 정보 없음)은 **차단 아닌 배너 후 응답**. 정책 검증은 브라우저에서만 | ⚠️ | D14 결정(적합성 입력 없으면 일반론만) |

---

## 6. 데이터 권리 · 제공자 약관 (public-data가 GitHub와 Pages 양쪽에 공개됨)

| 데이터 | 확인한 사실 | 판정 | 운영자 조치 |
|---|---|---|---|
| **ICE BofA HY OAS (FRED 경유)** | `public-data/data.json`에 `hyOAS` 값·관측일 **공개 게시**(git 이력에도 누적). ICE 조건: 내부 사용 한정, 제3자 게시·배포는 ICE 사전 서면 승인 필요. FRED도 2026-04부터 ICE 시계열을 최근 3년으로 제한 | ❌ | 공개 산출물에서 원값 제거(파생 신호만 표시하거나 출처 링크로 대체) 여부 결정 |
| Yahoo Finance (비공식 엔드포인트) | 서버·Worker가 수집해 공개 JSON으로 재배포, Worker는 Chrome UA로 요청 | ⚠️ | 약관 검토. 대안: 라이선스가 명확한 소스 또는 "개인 키로 사용자가 직접 조회" 구조 |
| CNN Fear & Greed | 공식 API 아님 | ⚠️ | 약관 검토, 출처 표기 |
| Cboe 일일 통계 · AAII | 표시 조건 존재 가능 | ❓ | 약관 확인, 출처 표기 |
| NAAIM · Investors Intelligence | 구독 데이터라 BLOCKED 처리 | ✅ | 유지 |
| SEC EDGAR · 13F | 공공 데이터, fair-access 준수 | ✅ | — |
| Telegram 공개 채널 | **본문 미저장**(메타데이터·점수만) 확인, `t.me/s` 스크래핑 | ⚠️ | 채널·텔레그램 약관 확인 |
| 뉴스 RSS · AI 번역 | 헤드라인+링크 위주, 선택적 AI 번역 | ⚠️ | 기사 본문 번역·요약은 2차적 저작물 소지 — 원문 링크 우선 유지 |
| Naver (KR 시세 폴백) | 크롤링 금지 약관 | ⚠️ | 대체 소스 검토 |
| BOK · KOSIS | 공공누리 — 출처 표시 조건 | ✅ | 사용 시 출처 표기 |
| 공급 자료(Substack 등)·지식 코퍼스 | 200자 이상 원문 복제 없음(요약·재서술), 라이선스 우회 소지 자료(`rosy-license-circumvention`)는 **저장 거부 처리됨**, 검토 상태를 사용자에게 배지로 공개 | ✅ | 원문 장문 인용 금지선 유지 |
| 13F 보유 데이터 | 공공 데이터. 기존에는 매일 전체 재생성으로 저장소 증가 위험(F-48/49) | ⚠️ 로컬 v56.71: semantic no-op, 13D/G 일일 poll, 제출 시즌 월요일 및 미연결 새 HR/HR-A에만 13F 행·이력 체인. 첫 예약 실행·artifact 게시 미검증 | main 반영 후 첫 run과 객체 증가량 확인 |

---

## 7. 법·규제 · 플랫폼 정책 (점검 포인트, 법률 자문 아님)

| 규범 | 핵심 요건 (공개 자료) | AIO 현재 상태 | 판정 | 운영자가 지킬 선 |
|---|---|---|---|---|
| **자본시장법 — 유사투자자문업(제101조)** | 투자자문업자가 아닌 자가 **대가를 받고** 간행물·통신물 등으로 불특정 다수에게 **개별성 없는** 투자판단 조언 → 신고 대상. 2024-08-14 개정으로 **SNS·오픈채팅 등 양방향 채널을 통한 유료 회원제 영업은 투자자문업(등록 대상)**으로 규율 | 무료, 사용자 5명, "투자 권유 아님" 면책 있음 → 현재 해당 가능성 낮음 | ✅(현재) / ❌(유료화 시) | **유료화·후원·유료 회원제를 도입하지 않는다.** 특히 AI 채팅은 1:1 양방향이라 유료가 되는 순간 투자자문업 영역에 가까워짐 → 그 전에 반드시 법률 검토 |
| **「인공지능 기본법」**(2026-01-22 시행) | 생성형 AI(또는 이를 이용한 서비스) 결과물이 AI 생성임을 **표시**(사람 인식 또는 기계 판독). 위반 시 시정명령·과태료 최대 3,000만원, **과태료 계도기간 최소 1년** | 가이드에 "AI 답변" 범위 설명은 있으나, 라이브 HTML에 "AI 생성/생성형/인공지능" 표시 문구 **0건** | ⚠️ | 적용 대상(개인·비영리 운영자 포함 여부)이 불명확해도 비용이 작으니 AI 답변·AI 번역·AI 요약마다 "AI 생성" 표시를 선제 도입 |
| **Anthropic Usage Policy — 고위험 사용 사례** | 소비자 대상 **금융 조언**에 Claude를 쓰면: 결과물 배포 전 자격 있는 사람의 검토(human-in-the-loop), **세션 시작 시 AI 사용 고지** | AI 채팅이 사용자에게 직접 시장 분석을 제공. 제품은 "교육·리서치 보조, 매매 지시 없음"으로 설계 | ⚠️ | 채팅 시작 시 AI 고지 문구 확인·추가, 개인화된 매수·매도·비중 조언 거부 정책 유지. 현행 정책 원문을 직접 확인 |
| 개인정보보호법 | 개인정보 수집 시 처리방침·동의 등 | 서버 수집 없음(포트폴리오·키는 브라우저 로컬). 사이트에 개인정보 안내 있음 | ✅ | 오류 비콘·사용량 분석 도입 시 **처리방침 게시 먼저**. Cloudflare 로그 IP ❓ |
| 저작권법 | 타인 저작물 복제·배포·2차적 저작물 | 텔레그램 본문 미저장 ✅, 뉴스는 헤드라인·링크, 지식 코퍼스 검토 중 | ⚠️ | 긴 원문 인용·번역 게시 금지선 유지 |
| 금융소비자보호법 | 금융상품판매업자 대상 | 해당 없음(주문·상품 판매 없음) | ✅ | 증권사 연계·제휴 링크 수익 도입 시 재검토 |
| 웹 접근성(KWCAG 2.2 / WCAG 2.1 AA) | 공공기관 의무, 민간은 권장 | 자동 매트릭스 PASS, **수동 검토는 OPERATOR_REQUIRED** | ⚠️ | 연 1회 수동 점검(키보드·스크린리더) |
| GitHub 약관 | Pages는 상업적 SaaS 주 목적 불가, Actions는 저장소 목적 사용 | 개인·비상업 운영 | ✅ | 수익화 시 호스팅 재검토 |
| Cloudflare 약관 | Workers 일반 사용 | 프록시·릴레이 | ✅ | 제3자 콘텐츠 대량 프록시는 약관 확인 |

---

## 8. 라이브 사이트 (https://ysnle.github.io/aio-screener/)

| 항목 | 기준 | 현재 상태 (실측) | 판정 | 운영자 조치 |
|---|---|---|---|---|
| 배포 버전 | origin HEAD와 일치 | **v56.33** (`fc75c775`, 09-26 01:41Z), origin v56.52 | ❌ | P0 strict release gate 미충족 |
| 데이터 신선도 | 핫 데이터 ≤ 수 시간 | `data.json` 09-26 01:35Z → 30시간+ | ❌ | P0 strict freshness gate 미충족 |
| 보안 헤더 | CSP·X-Frame-Options·nosniff | **HSTS만 존재**. `_headers`는 GitHub Pages가 무시, `index.html` CSP meta 0건 | ❌ | 단기 CSP meta, 중기 Cloudflare 호스팅(D3) |
| 법적 고지 | 개인정보·약관·면책·문의 | "공개 이용 정책 · 개인정보 · 면책 · 문의" 섹션 존재, "투자 권유·수익 보장·매매 지시가 아닙니다" 명시 | ✅ | 유지 |
| AI 생성물 표시 | 결과물 단위 표시 | 명시적 "AI 생성" 표시 문구 0건 | ⚠️ | §7 참조 |
| 데이터 출처·라이선스 고지 | 제공자별 출처·지연·권리 | "출처" 19회, 개별 제공자 권리 고지 부족(ICE 1회) | ⚠️ | 제공자별 출처·지연 여부·권리 한 곳에 정리 |
| 연락 창구 | 비공개 신고 경로 | GitHub Issues(공개) — 키·개인정보 첨부 금지 안내 있음 | ⚠️ | 보안 신고용 비공개 경로(Private vulnerability reporting) 추가 |
| 콘솔 오류 | 0 | 부팅마다 401/403/422 (외부 프록시·API) | ❌ | Phase 3 |
| 성능 (자체 SLO) | 부팅 외부 요청 ≤25, JS decoded ≤1.5MB | 외부 ~55, JS ~1.9MB, 총 12MB/202요청 | ❌ | Phase 3 |
| 검색 노출 | 의도에 맞게 | `robots.txt` 전체 허용 + sitemap | ❓ | 5명용 비공개 성격이면 `noindex` 검토 |
| 접근 통제 | 가족만 | **인증 없음, 전 세계 공개** | ❌ | Cloudflare Access(가족 이메일 허용목록) — 핸드오프 P2 |
| 신선도 표시 정직성 | 배지 = 실제 신선도 | 헤더 배지 "실시간/LIVE"인데 스냅샷은 31시간 전, 경고는 사이드바에만. `#briefing` "마지막 갱신: 2026-04-17 (1일 경과)" — **날짜가 HTML에 고정** | ❌ | 가족에게 "배지보다 기준시각을 보라" 안내, P3에서 수정 |
| 내부 개발 문자열 노출 | 0 | `#options` "DATA_SNAPSHOT", `#screener` "mic_missing·…", "preset-balanced(75f90624)", `#atlas` "atlas:compute-gpu" 등 | ❌ | P3 |
| 화면 간 모순 | 0 | `#technical` Stage "1 바닥 형성" vs "전 시간대 상승 정배열", `#macro` "관측값 미수신" 위에 "2s10s +0.36%p", 뉴스 "0건" 아래 8–12건 | ⚠️ | P3 |
| 스크리너 가격 | 기준시각 명확 | **실시간 반영 경로가 코드 결함으로 영구 비활성** — 항상 파이프라인 가격 | ❌ | 매매 직전 시세는 증권사 앱 확인 원칙 공유, P3 수리 |
| 휴장일 장 상태 | 휴장 = 휴장 | KR/US 세션 판정이 요일·시각만 봄 → 공휴일에도 "장중" | ⚠️ | P3 |
| 법적 고지 페이지 | 가족용이면 간단히 | 하단 요약 고지 ✅, 별도 개인정보·약관·데이터 출처 페이지 없음 | ⚠️ | 가족 전용 전환 시 "이용 안내 1페이지"로 충분 |
| 라우트 구성 | 가족이 헤매지 않게 | 20라우트, home·briefing·market-news가 같은 데이터를 다른 신선도로 중복 서술 | ⚠️ | 4–5개 목적지로 통합(P4) |

---

## 9. 프로젝트 자체 규칙 · 기준 (저장소에 이미 정의된 것 중 운영자 몫)

| 규칙/기준 | 정의 위치 | 현재 상태 | 판정 | 운영자 조치 |
|---|---|---|---|---|
| 자동 커밋·푸시·배포 금지 | `AGENTS.md`, `CLAUDE.md`, 런북 §8 | **문서로만 존재**, 권한 설정은 푸시 허용(§2) | ❌ | 권한·브랜치 보호로 강제 |
| 버전 동기화(R1) | `scripts/bump-version.mjs` | 작동. 단 버전이 진척 카운터가 됨(한 커밋에 37버전) | ⚠️ | D4/P1 |
| 공개 베타 승격 기준 | `architecture/public-readiness.json` | 운영자 필수 5건 미종결: 수동 접근성, 30일 SLO, 라이브 리비전, **엣지 보안 헤더(이번에 미적용 확정)**, 제공자 권리 검토(REVIEW_REQUIRED). route-soak PENDING, 부팅 성능 재측정 필요 | ❌ | 공개 베타를 목표로 하는지 먼저 결정 |
| 운영 SLO | `architecture/operations-slo.json` | 목표: 산출물 성공률 99.5% / 워치독 99.5% / 정시 도착 90% → 실측: refresh 73% / 워치독 21% / cron 지연 6배. 부팅 측정값은 v53.62 기준으로 STALE | ❌ | 목표를 현실(세션 기반)로 재설정하거나 구조 개선 |
| 운영자 주기 작업 | 런북 §6 | 정적 DB S1–S6 월간 검토, 웹 리서치 180일, 지식 빌더 수동 실행, 버전 범프 수동 | ⚠️ | §10 루틴에 편입 |
| 수동 Worker 배포 | 런북 §5 | 소스·라이브 괴리 허용 구조 | ⚠️ | Worker 소스를 바꿀 때마다 배포 |

---

## 10. 운영 루틴 (현 구조 기준 — 개편 후 대부분 자동화 대상)

| 주기 | 할 일 | 소요 |
|---|---|---|
| **매일** | ① 라이브 `/deployment.json`의 `sourceSha` = origin HEAD? ② 운영 알림 이슈 새로 열렸나? ③ 최근 refresh 성공? | 3분 |
| **매주 월요일 오전** | 주말 배포 정지 여부 확인·복구 / 지난주 발표된 매크로 일정 `nextRelease` 갱신(자동화 전까지) / Dependabot PR 처리 / Worker 429 추이 | 20분 |
| **매월 1일** | 스크리너 유니버스 검토(30일 기준) / 정적 DB S1–S6 / Anthropic 사용액 / 저장소 크기 기록 / 시크릿 이상 여부 | 1시간 |
| **분기 (2·5·8·11월 중순)** | 13F 시즌 전 저장소·Pages 용량 확인 / 키 교체 필요 여부 / 제공자 약관 변경 여부 | 1시간 |
| **매년 11월** | 다음 해 KRX·NYSE 휴장일·반일장 등록(두 곳) / 모델 ID 수명 확인 / 법·약관 재검토 / 수동 접근성 점검 | 반나절 |

---

## 11. 배포 정지 시 확인 순서

1. `https://ysnle.github.io/aio-screener/deployment.json`의 `sourceSha`와 `gh api repos/ysnle/aio-screener/commits/main --jq .sha` 비교.
2. `gh run list -R ysnle/aio-screener --limit 15` — 무엇이 빨간가: `Refresh market data`? `CI`? `Pages`?
3. CI가 빨가면 실패 job의 `qa-runner` 요약에서 FAIL 게이트 이름 확인 — **로그가 게이트 출력의 끝부분만 남기므로** 원인 줄이 안 보이면 해당 게이트를 원격 HEAD 기준으로 다시 실행해 전체 출력을 본다.
4. 흔한 원인 3가지: (a) 주말·휴장 데이터 신선도, (b) 지난 매크로 발표일 잔존(`static-db-expiry`), (c) 유니버스 만료.
5. 고친 뒤 라이브 `deployment.json`이 새 SHA로 바뀔 때까지 확인(원격 CI 통과 ≠ 배포 완료).

---

## 12. 운영자 결정 상태 (핸드오프 §9·§0.5.6 반영)

- **D0 — 결정 완료:** live-core strict freshness를 유지하고 정상 scheduled market-data refresh 및 reconciliation/strict lineage PASS 뒤 exact-SHA release를 진행한다. 주말·휴장 grace는 채택하지 않았다. 이 결정은 release 조건을 정의하며, 현재 데이터·CI·라이브 인수가 통과했다는 뜻은 아니다.
- **D1 — 결정 완료:** 기존 dirty 작업은 보존하고, release 때 정확한 task-owned 파일만 분리한다. `git add -A`는 사용하지 않는다.
- **D4 — 결정 완료:** 기존 P/R/QA 원장을 유지하고 새 회귀 추적 항목을 추가한다. 원장 동결·이관은 하지 않는다.
- **현재 P0의 유일한 미결 정책 판단 — 정적 만료 심각도:** macro/universe expiry를 hard gate에서 경고로 낮출지 아직 결정하지 않았다. 별도 운영자 결정 전까지 현행 hard severity를 유지하며 배포를 풀기 위한 완화로 처리하지 않는다.

D2–D3 및 D5–D15는 후속 데이터·호스팅·제품·정책 단계의 별도 선택으로 남아 있지만, 현재 P0 실행에서 새로 정해야 할 사항은 아니다. P0 release는 위 D0 기준의 정상 데이터 갱신, reconciliation, strict lineage, exact-SHA CI와 라이브 인수 증거가 확보될 때까지 대기한다.

## 출처 (무료 한도)

- [Cloudflare Zero Trust 무료 플랜 한도(50명)](https://zerometric.net/research/cloudflare-zero-trust-free-plan-limits-2026/) · [비용 정리](https://costbench.com/software/business-vpn/cloudflare-zero-trust/free-plan/)
- [GitHub Actions 과금 문서](https://docs.github.com/billing/managing-billing-for-github-actions/about-billing-for-github-actions) · [무료 한도 정리](https://cicdcalculator.com/github-actions-free-tier)
- [FRED API release/dates](https://fred.stlouisfed.org/docs/api/fred/release_dates.html)

---

## 출처 (규제·정책)

- [국가법령정보센터 — 인공지능 발전과 신뢰 기반 조성 등에 관한 기본법](https://www.law.go.kr/lsInfoP.do?lsiSeq=268543)
- [법률사무소 번화 — AI 생성물 표기 의무 정리](https://bh-law.kr/ko/news/column/ai-content-labeling-obligation-guide)
- [대륜 — AI 기본법 시행령(과태료 계도기간)](https://www.daeryunlaw.com/newsletter/news/246)
- [국가법령정보센터 — 자본시장법 제101조](https://www.law.go.kr/LSW//lsSideInfoP.do?lsiSeq=283193&joNo=0101&joBrNo=00&docCls=jo&urlMode=lsScJoRltInfoR)
- [금융위원회 보도자료 — 유사투자자문업 불건전영업 규율](https://www.fsc.go.kr/no010101/82887)
- [KCI — 2024년 8월 시행 자본시장법 개정과 유사투자자문업 규제](https://www.kci.go.kr/kciportal/ci/sereArticleSearch/ciSereArtiView.kci?sereArticleSearchBean.artiId=ART003342418)
- [Anthropic — Usage Policy update](https://www.anthropic.com/news/usage-policy-update)
- [FRED — ICE BofA US High Yield OAS (BAMLH0A0HYM2)](https://fred.stlouisfed.org/series/BAMLH0A0HYM2)
