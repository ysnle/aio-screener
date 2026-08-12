---
status: IMPLEMENTED_LOCAL
verified_by: pending final local verification batch
last_verified: 2026-08-12
confidence: medium
target_version: v54.12
---

# SCR-OS-00 Baseline and Dependency Ledger

이 문서는 `SCREENER-OPEN-SOURCE-BENCHMARK-AND-REBUILD-HANDOFF-2026-08-12.md`의 첫 실행 패킷이다. 설계 문서를 구현 대상으로 승격하되, 로컬 검증·라이브 브라우저·외부 공급자·PIT 예측 승격을 서로 혼동하지 않는다.

## 현재 기준선

| 항목 | 기준선 | 의미 | owner |
|---|---:|---|---|
| Screener universe | 873 | 현재 공개 유니버스 식별자 수 | `public-data/screener.json` |
| Observed/usable rows | 848 | 현재 artifact의 quote 관측 성공 수 | `public-data/screener.json` |
| Fundamental coverage | 74.2% | 728개 분모 기준 SEC/FMP 결합 coverage | `scripts/validate-screener-artifact.mjs` |
| Model validation | BLOCKED | PIT·비생존편향·비용·유동성·live/backtest parity 미확립 | `public-data/model-validation-status.json` |
| Validation gate | BLOCKED | 자동 가중치/예측 모델 승격 금지 | `public-data/screener-validation-gate.json` |

## producer → contract → consumer

- Producer: `src/data/providers/screener.js`가 artifact/universe를 읽고 `InstrumentRef`, `ObservationEnvelope`, field readiness와 provenance를 만든다.
- Normalizer: `src/data/normalize/screener.js`가 snapshot identity와 row-level observations를 보존한다.
- Domain: `src/domain/screener/screen-engine.js`가 AST를 해석하고 `ScreenRun`·`RankExplanation`을 생성한다.
- State/UI: `src/state/slices/screener.js`, `src/app/bootstrap.js`, `src/ui/pages/screener.js`가 legacy table을 유지하면서 Workbench adapter를 점진적으로 노출한다.
- Gates: `scripts/ci-screener-workbench-contract.mjs`가 SCR-OS-00~09 계약과 baseline을 실행한다. `scripts/benchmark-screener-workbench.mjs`가 SCR-OS-10 synthetic scale decision을 기록한다.

## packet status

| packet | local implementation | remaining boundary |
|---|---|---|
| SCR-OS-00 | complete in repository | final test evidence |
| SCR-OS-01~04 | contract/domain/UI adapter present | final test evidence and browser/live review |
| SCR-OS-05~08 | outcome, refresh, capability, regime modules present | provider/rights and replay evidence remain local fixtures |
| SCR-OS-09 | persistent gate is BLOCKED | PIT/cost/liquidity/parity evidence not available |
| SCR-OS-10 | benchmark script present | run benchmark and choose projection vs Parquet candidate |
| SCR-OS-11 | adapter panel present; legacy writer retained | live browser certification and rollback rehearsal |

## explicit non-claims

This ledger does not claim predictive validity, point-in-time survivorship-free history, licensed data rights, live provider availability, or deployed parity. Those require separate evidence and cannot be inferred from local contract tests.
