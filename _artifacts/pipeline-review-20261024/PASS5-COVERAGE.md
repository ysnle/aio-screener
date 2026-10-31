# PASS5 판독 범위·파이프라인 계약표

2026-10-26. 전체 판독은 파일 본문을 끝까지 읽었다는 뜻이며 전체 의미/실행 검증 완료와 다르다. reader 결과는 주 담당자의 직접 읽기와 별도로 기록한다. 파일 hash는 대장 생성 시점 관측이며 reader가 읽은 바이트와의 동일성을 자동 보증하지 않는다. 제품 v58.80 동시 변경 중이다.

## Workflow — ops_audit 전체 판독 13개

모두 .github/workflows/ 아래. YAML 내 shell/JS까지 읽었지만 호출된 모든 도구 내부·실제 Actions는 미검증이다.

| 파일 | 입력→검사→산출 | 실패·권한 |
|---|---|---|
| ci.yml | main/PR/dispatch→preflight→contract/browser shards→기저 full CI→exact SHA attestation | read; PR attestation 제외; fail-fast=false; Chromium 3회 제한 |
| pages-deploy.yml | CI 완료/run ID→repo/main/event/SHA/attestation→allowlist/bundle/SW→main 재확인→Pages→live checks | pages/id-token write; 실패1회 재시도 전 main 재확인; skip 복구 해석 기존 OPS-01 |
| deploy-ai-proxy.yml | CI/manual→attestation→live SHA/import graph→QA→rollback baseline→main guard→deploy→smoke | manual secret sync; binding 권한 실패시 제거 재시도; smoke 실패 rollback·source 확인 |
| deploy-data-plane.yml | CI/manual→attestation→live identity→QA→baseline/main guard→deploy→source/coverage smoke | secret publish; 실패 rollback; 초기 snapshot 없는 bootstrap 허용은 수집 완료가 아님 |
| refresh-data.yml | cadence→market/Telegram/13F/outcomes/temperature/reference/scenario→manifest/quarantine/QA→candidate→push→CI→convergence | lane별 보존; core lock 공유; push5회·collision retry; 실제 cycle 후 marker |
| refresh-screener.yml | SEC restore→SEC/KR/earnings/consensus/listings→projection/core→gate/candidate→ledger/main→CI; extended 별도 | core lock 공유; extended 독립, 기존 rebase 검증 결속 DATA-05 |
| data-watchdog.yml | hourly/workflow/manual→watchdog→rolling SLO; expiry→issue | 실패 뒤 artifact 업로드 후 실패 복원; expiry만 issues write |
| operations-alert.yml | 8개 workflow completion→repo/main/latest 검증→연속실패2 issue→success close | issues write; signature dedupe; market만 no-work 확인(기존 OPS-01) |
| knowledge-build-candidate.yml | PR paths/manual→event SHA→격리 parity candidate→review artifact | read; canonical publish 없음; helper trigger 범위 기존 QA-01 |
| knowledge-lint.yml | 주간/manual→state/profile/skill/currency/ledger/coverage/knowledge gates | read; source 의미 검수 인증 아님 |
| exchange-calendar-review.yml | 연간/manual year→review report→연도 issue | report read/issue write 분리; closed 유지; 자동 source 변경 없음 |
| macro-calendar-review.yml | 주간/manual→FRED candidates→preview/digest→artifact→review issue | 새 digest만 신규 issue; 자동 calendar 승격 없음 |
| universe-review.yml | 월간/manual→mirror check→report→월별 issue | read/issues write; 자동 universe 변경 없음 |

## 13F/13D/G — sec_audit 전체 판독 파일

| 파일 | 의미·계약 |
|---|---|
| scripts/collect-13f-discovery.mjs | submissions→13D/G 최신10건/새HR triggers, latest notice와 holdings 구분, 실패 BLOCKED/LKG |
| scripts/lib/13f-discovery.mjs | 발견/날짜/연결 판정 공유 |
| scripts/lib/sec-edgar.mjs | SEC transport·XML/directory 공통 처리 |
| scripts/collect-13f-reference.mjs | current/prior 합성→CUSIP+putCall+shareType 비교→raw shards, cover 검산·manager 실패 보존 |
| scripts/lib/13f-compose.mjs | ORIGINAL/reset, RESTATEMENT/replace, NEW HOLDINGS/add, 미분류 거부·provenance |
| scripts/collect-13f-history-index.mjs | recent→7 managers/12분기 원본+정정 index |
| scripts/collect-13f-history-rows.mjs | shared composition→accession/role rows, checkpoint·미분류 REVIEW_REQUIRED |
| scripts/build-13f-issuer-aggregates.mjs | current/prior/history→증권유형별 CUSIP 시계열; ticker/sector 추정 없음 |
| scripts/collect-13f-figi-tickers.mjs | CUSIP→정확한 US common 한 ticker만, 모호성 보류·실패 cache 유지 |
| scripts/build-masters-runtime-artifacts.mjs | raw→summary/content hash/manager200행/512KiB·history preview |
| scripts/build-13f-reference-ticker-index.mjs | embedded current rows→reference ticker 역조회, URL 전달 |
| scripts/lib/13f-semantic-hash.mjs | clock-only 변경 제외한 내용 identity |
| scripts/lib/masters-manager-store.mjs | bounded store split/reassemble·hash 검산 |
| scripts/lib/masters-raw-rows.mjs | raw row 비교 판단 제거, 집계 비교와 분리 |
| scripts/daily-lane-age.mjs | 일일 lane due/marker 계약 |
| src/domain/masters/value-scale.js | 단위 의심 보류 |
| src/domain/masters/ticker-exact.js | exact symbol/reference 연결 |
| scripts/ci-13f-currentness-check.mjs | 최신 filing 연결/currentness 계약 |
| scripts/ci-masters-browser-check.mjs | 브라우저 검증 정의 판독; 실행 아님 |
| scripts/ci-13f-figi-ticker-fixture.mjs | exact mapping fixture 정의 판독; 실행 아님 |

부분: src/ui/pages/masters.js 180–270,419–708,1414–1490; holdings-format.js 주요 format/coverage; ci-masters-contract-check.mjs 핵심 계약(출력 일부 잘림); ci-13f-semantic-hash-check.mjs ownership fixture 검색. 이 파일들을 전체로 세지 않는다.

주 담당자가 추가로 **전체** 읽은 보조 도구: scripts/resolve-13f-prior-filings.mjs, reconcile-13f-prior-from-history.mjs, recover-masters-holdings-from-shards.mjs, split-masters-manager-rows.mjs, ci-masters-manager-store-check.mjs. 앞 둘은 top-level 생산 쓰기이므로 실행 안 함. recovery는 snapshot·filing·금액·count→빈 target만 쓰기, split은 읽기/변환/reassembly 검산. store gate만 임시 fixture로 실행했다. 복구 도구의 실제 workflow 연결·장애 복구 drill은 미완료.

## SEC·screener — screener_audit 전체 판독

| 파일 | 입력→변환→소비 계약 |
|---|---|
| src/domain/fundamental/sec-normalize.js | companyfacts/submissions→taxonomy/currency/FY/Q/shares/PIT, 비USD 금액 보류·비율 유지 |
| src/domain/fundamental/sec-report.js | PIT→revenue/equity/shares/earnings heal; availability as-of; report freshness |
| src/domain/fundamental/sec-row-fields.js | report+종가+거래대금+session→ratios/lineage; 신뢰 shares·FY/TTM·456일 age |
| src/domain/fundamental/sec-statements.js | raw→연간5/분기6 series, same-period FCF/grossMargin, ROE percent→ratio |
| scripts/fetch-earnings-calendar.mjs | Finnhub 주간/day/IPO+6주→calendar, optional key 보존·실패일 표시 |
| scripts/fetch-consensus-estimates.mjs | forecast/surprise→4Q EPS, batch240/350ms/연속실패8 중단·이전row21일 |
| src/domain/fundamental/consensus-read.js | EPS+close→Forward PER, consensus21일/price10일·basis gap 보류 |
| src/data/consensus-estimates.js | shared artifact6h/1MiB→exact symbol |
| scripts/fetch-sp500-weights.mjs | IVV CSV→weights%, floor450/합90–105%, 실패 보존 |
| scripts/build-us-listings.mjs | Nasdaq dirs+SEC CIK→columnar,20h skip/3회30초/floor/LKG |
| scripts/lib/us-listings.mjs | exact normalize/CIK join/coverage floor |
| scripts/fetch-extended-universe.mjs | IWM+Nasdaq→source별 retain→membership |
| scripts/lib/extended-universe.mjs | equity/common parser·floor1800/2500·core 제외·상태 회복 finding |
| scripts/producer/screener-extended.mjs | membership/history/SEC→encoded shard, price coverage60%·26h/new-session; validation BLOCKED |
| scripts/sync-screener-universe.mjs | legacy literal+META→universe·drift check |
| scripts/lib/candidate-archive.mjs | browser rank parity→top/bottom fifth→T+21·80% coverage·60일 retention |
| src/domain/screener/candidate-record.js | latest identity outcomes→비중복 IC evidence n12 |
| src/data/orchestrators/screener.js | provider→normalize→rank→screen→command, generation/dispose guard·chunk400 |

부분: producer/screener.mjs 250–327,522–끝; provider/screener.js 290–300 인접 미확인; normalize/screener.js 출력 절단; lib/factors.mjs1–165. factor-ranks/price-factors/backtest 전체와 UI live는 미검증이다.

## 운영 도구 — ops_audit 전체 판독

scripts/qa-runner.mjs(선택·fingerprint·pool/cache/candidate), verify-refresh-candidate.mjs(changed-set/blob/hash), worker-deploy-impact.mjs(static imports·TOML·ancestry), ensure-live-convergence.mjs(CI/attestation/live/dispatch), deployment-provenance.mjs(exact run identity), sync-data-release-manifests.mjs(data cycle identity), build-reconciliation-status.mjs(22 categories), build-operations-slo-window.mjs(7/30일 실행 SLO·관측 부족 uncertified), generate-workspace-state.mjs 및 workspace-state-lib.mjs(registries→현재상태), sync-agent-profiles.mjs 및 sync-agent-skills.mjs(registry→mirror), agent-hook.mjs(tool payload guard/reminder), bump-version.mjs 및 record-fix.mjs(version/ledger/schema/write).

build-operations-status.mjs는 입력/export/health/public-config/receipt 구간만 읽었으며 추가 조사 사용량 제한으로 미완료. aio_api_setup_guide.py도 일부만 판독했다.

## 주 담당자 Worker 판독

worker/data-plane.js 전체, cloudflare-worker-proxy.js 기존731–1316+이번1–730/1321–끝. 기존 worker/openai-budget.mjs·openai-usage.mjs 전체 판독과 연결. 실제 binding·API·billing·배포는 미검증. 증거 수준은 PASS5-HANDOFF.md 참고.
