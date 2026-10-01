import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const records = [
  {
    p: { id: 1349, title: 'Observation-session identity and independent KRX briefing evidence',
      symptom: 'SPX history collection buckets counted the same close repeatedly; the briefing used a missing SOX symbol and a US session for KRX observations.',
      root_cause: 'Collection dates, observation dates and market session identity were conflated, and candidates were selected before their complete evidence contract was validated.',
      fix: 'Deduplicate MA inputs by actual observed session, hold conflicting recent observations, reject invalid calendar dates and unsupported close provenance; validate all KRX candidates against its own completed calendar; explicitly use the available SMH semiconductor ETF; disclose optional missing score inputs.',
      violated_rule: 'R670 and R294; new {R} observation identity contract.',
      prevention: 'QA-SEMANTIC-DATA-01; ci-esm-core-unit-check and ci-native-decision-evidence-check.',
      verification: 'Deterministic positive/negative unit and native decision evidence gates pass. Current history independently yields MA50 7645.16 and MA200 7213.34 on 2026-09-29. Deployed state is separate.' },
    r: { id: 677, title: 'Observation identity precedes collection chronology', rule: 'Price history windows count distinct eligible market observation sessions, never collection buckets. Conflicting recent observations hold the derived result. Each market owns its completed-session calendar. Validate every candidate before selecting one; missing metadata cannot manufacture completed-close eligibility.', validation: 'P1349; ci-esm-core-unit-check and ci-native-decision-evidence-check.' },
    qa: [{ id: 'QA-SEMANTIC-DATA-01', text: 'MA uses eligible distinct observed sessions and recent conflicts hold; KRX uses its own completed close and valid later candidates; missing optional inputs remain visible.', verify_by: 'P1349/R677 ci-esm-core-unit-check + ci-native-decision-evidence-check', done: true }],
    changelog: ['**시장 근거 (P1349/R677):** 관측 세션 기준 이동평균, KRX 독립 종가, SMH 명시, 보조 결측 안내.']
  },
  {
    p: { id: 1350, title: 'Authenticated financial Vault and evidence-safe AI portfolio context',
      symptom: 'Wrong PIN could appear unlocked; ledger/FX were outside encryption and reload restoration; provider backups included portfolio data; current watchlist objects lost metadata; missing AI prices became fabricated ratios.',
      root_cause: 'Key derivation was mistaken for authentication; sensitive storage had parallel ownership and hard-coded localStorage; coercion and buy-cost fallbacks were promoted to current market valuation; asynchronous continuations lacked lock invalidation.',
      fix: 'Authenticate ciphertext/sentinel, encrypt and restore all three financial sections, separate credential backups, preserve watchlist objects, respect public-PC storage, propagate persist acknowledgements, invalidate pending operations on lock, and hold AI allocation/return without coherent currency/time/price evidence. Journal notes require their disclosed consent.',
      violated_rule: 'R294 and R670; new {R} financial boundary contract.',
      prevention: 'QA-SEMANTIC-VAULT-01; ci-portfolio-vault-e2e and ci-esm-core-unit-check.',
      verification: 'Initial production-bridge isolated Chromium checks passed 44/44. Expanded lock-race/public-PC cases and integrated main certification are recorded separately in the semantic audit report; real user storage is untouched.' },
    r: { id: 678, title: 'Financial security follows purpose and asynchronous lifetime', rule: 'Positions, ledger and FX declarations share authentication, encryption, storage selection, lock invalidation and reload restoration. Provider credential backups exclude financial records. Lock or storage-mode changes invalidate asynchronous continuations. Failed persistence is never success; AI valuation requires coherent price, currency and observation evidence.', validation: 'P1350; ci-portfolio-vault-e2e, ci-esm-core-unit-check and headless fixtures.' },
    qa: [{ id: 'QA-SEMANTIC-VAULT-01', text: 'Production Vault authenticates PIN, protects/restores all financial declarations, separates credential backups, preserves watchlists and prevents missing valuation evidence from becoming AI percentages.', verify_by: 'P1350/R678 ci-portfolio-vault-e2e + ci-esm-core-unit-check + headless T960', done: true }],
    changelog: ['**금융 보호 (P1350/R678):** 실제 PIN 인증·금융 3개 섹션 보호·공용PC 격리·비동기 잠금 취소·백업 복원·AI 결측 보류.']
  },
  {
    p: { id: 1351, title: 'Exact deployment provenance and stale-release guards',
      symptom: 'Rollback selected missing/tied timestamps, observer lists omitted exact runs, and Pages/Worker paths could verify or mutate a stale main revision.',
      root_cause: 'Deployment identity relied on partial lists/SHA alone and latest-main checks did not cover mutation/retry boundaries.',
      fix: 'Require valid unique latest rollback dates, exact-run fallback with repository/main/workflow/SHA/status checks, bind attestations to run ID and repository, and guard deploy/retry against stale main. The separately proposed dispatch-driven automatic convergence expansion remains unapplied pending specific approval.',
      violated_rule: 'R674 and exact release-attestation boundaries.',
      prevention: 'QA-SEMANTIC-DEPLOY-01; ci-cloudflare-deployment-contract-check and ci-deployment-convergence-check.',
      verification: 'Deployment contract and convergence unit gates, actual YAML parser, syntax and diff checks pass. No dispatch, deployment or rollback occurred; live convergence is not certified.' },
    qa: [{ id: 'QA-SEMANTIC-DEPLOY-01', text: 'Rollback ambiguity, stale main mutation and repository/run/SHA attestation substitution fail closed.', verify_by: 'P1351 ci-cloudflare-deployment-contract-check + ci-deployment-convergence-check', done: true }, { id: 'QA-SEMANTIC-DEPLOY-02', text: 'Bot-advanced main converges Pages and both Workers using specifically approved dispatch CI consumption; proposal is pending and not applied.', verify_by: 'P1351 approved DEPLOYMENT-PROPOSAL.md implementation + isolated driver regression + CI-attested live probe', done: false }],
    changelog: ['**배포 근거 (P1351):** exact run/repository/SHA 검증·최신 main 보호·모호한 rollback 차단. 자동 수렴 확대 제안은 보류.']
  },
  {
    p: { id: 1352, title: 'Descriptive market UI without default scores or economic-cycle overclaims',
      symptom: 'Held signal scores became 50 in the pulse; legacy headings implied buy permission; RRG counts claimed growth/defensive leadership and market indicators claimed economic expansion/recession; translated news entities leaked into text.',
      root_cause: 'Sibling UI writers applied neutral defaults and copied stronger meaning than their measured inputs could support.',
      fix: 'Propagate held scores, preserve true zero, unify market-environment labels, describe RRG counts as relative strength, label the cycle map as educational and the heuristic as a market-input combination, preserve missing yields and decode translated news display values.',
      violated_rule: 'R670 and R671; new {R} presentation meaning contract.',
      prevention: 'QA-SEMANTIC-UI-01; ci-esm-core-unit-check, headless T213/T819 and architecture-browser pulse regression.',
      verification: 'Unit market-model checks pass; actual in-app browser confirms revised theme/signal text. Integrated browser and full QA certification are tracked in the report without substituting static evidence for visual review.' },
    r: { id: 679, title: 'Presentation cannot strengthen evidence meaning', rule: 'A descriptive score never grants buying permission. A held score stays held in sibling summaries; zero is not missing. Relative-strength quadrant counts do not establish sector identity or an economic-cycle phase. Model input coverage is not predictive accuracy. UI copy must name the measured object and preserve its limits.', validation: 'P1352; ci-esm-core-unit-check, ci-architecture-browser-check and headless model fixtures.' },
    qa: [{ id: 'QA-SEMANTIC-UI-01', text: 'Signal/pulse preserve null and zero, market models do not claim economic phases, and RRG labels describe their actual measured distribution.', verify_by: 'P1352/R679 ci-esm-core-unit-check + ci-architecture-browser-check + headless T213/T819 + manual browser screenshot', done: true }],
    changelog: ['**화면 의미 (P1352/R679):** 점수 보류 일관성·시장 환경 명칭·경기 국면 단정 제거·RRG 분포 표현·뉴스 문자 디코딩.']
  },
  {
    p: { id: 1353, title: 'Atomic monthly AI reservation and truthful operating budget scope',
      symptom: 'Daily request counts did not enforce the operator monthly AI budget; UI assumed $50 for five users and offered paid shared search with unknown cost bounds.',
      root_cause: 'Request volume, conservative cost reservations and provider invoiced spend were conflated; prices and execution routes did not share an atomic monthly ledger.',
      fix: 'Reserve conservative priced text/cache/output cost in the same US Durable Object, default at most $10 per UTC month, preserve reservations once upstream starts, handle restart/concurrency/idempotency/month rollover and legacy unknown spend, explicitly reject unpriced/unsupported paid modes and isolate paid-search policy in native ESM. Document total operating target $10 and ceiling $20, with free-source-first procurement.',
      violated_rule: 'Owner budget decision and new {R} cost-dimension contract.',
      prevention: 'QA-SEMANTIC-BUDGET-01; ci-worker-anthropic-check, ci-worker-relay-check and native policy unit checks.',
      verification: 'Mock Worker-to-DO-to-upstream budget and relay gates pass, including public health non-disclosure. No paid request. Reservations are not invoices; personal keys and Actions direct calls bypass this ledger, and provider workspace spending caps are not configured or certified.' },
    r: { id: 680, title: 'Budget scope, reservation and invoice remain distinct', rule: 'The project targets $10/month and at most $20/month; AI allocation is at most $10 and paid data requires a demonstrated gap within its $10 allocation. Daily counts are not money. Shared-Worker monthly reservations are atomic and conservative, never labelled actual invoiced usage or full-account protection. Unsupported/unpriced paid modes fail explicitly; direct-key/Actions paths and provider-native cap requirements stay visible.', validation: 'P1353; ci-worker-anthropic-check, ci-worker-relay-check and ci-esm-core-unit-check.' },
    qa: [{ id: 'QA-SEMANTIC-BUDGET-01', text: 'Monthly reservations are atomic across concurrency/restart/UTC rollover, do not refund uncertain upstream charges, reject unknown prices/tools and expose operator accounting only privately.', verify_by: 'P1353/R680 ci-worker-anthropic-check + ci-worker-relay-check + ci-esm-core-unit-check', done: true }],
    changelog: ['**운영 예산 (P1353/R680):** 무료 원천 우선·전체 월 $10 목표/$20 상한·공유 AI 월 $10 보수 예약·지원하지 않는 유료 검색 명시 차단. 직접 호출/실청구 상한은 별도.']
  }
];
for (const record of records) {
  const path = fileURLToPath(new URL(`fix-${record.p.id}.json`, import.meta.url));
  writeFileSync(path, JSON.stringify({ version: 'v56.87', date: '2026-09-30', ...record, qa_section: 'Semantic, financial and operating-budget audit', note: 'v56.87 — P1349 observation sessions; P1350 financial security; P1351 provenance; P1352 UI meaning; P1353 monthly reservation.' }, null, 2) + '\n');
  execFileSync(process.execPath, ['scripts/record-fix.mjs', path], { stdio: 'inherit' });
}
