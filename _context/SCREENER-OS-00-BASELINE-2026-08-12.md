---
status: IMPLEMENTED_LOCAL
verified_by: Codex local verification
last_verified: 2026-09-28
confidence: high
target_version: v56.61
---

# SCR-OS-00 Baseline and Dependency Ledger

이 문서는 `SCREENER-OPEN-SOURCE-BENCHMARK-AND-REBUILD-HANDOFF-2026-08-12.md`의 첫 실행 패킷이다. 설계 문서를 구현 대상으로 승격하되, 로컬 검증·라이브 브라우저·외부 공급자·PIT 예측 승격을 서로 혼동하지 않는다.

## 현재 로컬 artifact 기준선

아래 값은 2026-09-28에 확인한 저장소 artifact의 snapshot이다. `screener.json`의 `asOf`가 관측 기준이며, 이를 실시간 provider 상태나 배포된 값으로 간주하지 않는다. 이전 기준선은 바로 아래 provenance 표에 날짜와 함께 보존한다.

| 항목 | 2026-09-26 artifact 기준 | 의미 | owner |
|---|---:|---|---|
| Snapshot asOf | `2026-09-26T05:25:47.153Z` | 저장소 `screener.json` 기준 시각 | `public-data/screener.json` |
| Screener universe | 873 | configured universe 수 | `public-data/screener.json` |
| Factor-observed rows (`ok`) | 846 | artifact의 factor 관측 성공 수 | `public-data/screener.json` |
| Fundamental coverage | 560/728 · 76.9% | artifact가 명시한 US screener universe 분모의 mixed-field coverage; SEC-only coverage와 구분 | `public-data/screener.json` |
| Model validation | BLOCKED | PIT·생존편향·비용·유동성·live/backtest parity 증거가 승격 기준을 충족하지 않음 | `public-data/model-validation-status.json` |
| Validation gate | BLOCKED | 로컬 promotion gate가 자동 가중치/예측 승격을 허용하지 않음 | `public-data/screener-validation-gate.json` |

### 이전 기준선 provenance

| 기록일/target | 저장된 수치 | 사용 범위 |
|---|---|---|
| `last_verified=2026-08-15`, `target_version=v54.27`인 이 ledger의 이전 기록 | 873 / 847 / 77.2% | 당시 기준선의 보존용 기록. 현재 artifact 수치로 재사용하지 않는다. 당시 `asOf`는 이 문서에 기록되지 않았다. |

## 로컬 contract 및 SCR-OS 상태 (2026-09-28)

`node scripts/ci-screener-workbench-contract.mjs`는 2026-09-28 00:17Z에 PASS였으며 37 registered fields와 6 presets를 확인했다. SCR-OS-00~11 상태는 `VERIFIED_LOCAL`이다. 아래 상태는 코드·fixture·synthetic benchmark에 대한 로컬 증거만 뜻한다.

| packet | local status/evidence | remaining boundary |
|---|---|---|
| SCR-OS-00 | `VERIFIED_LOCAL`; dated baseline과 기존 기능 중복 대사 계약 로컬 검사 | 현재 artifact snapshot은 provider live freshness 증거가 아님 |
| SCR-OS-01~04 | `VERIFIED_LOCAL`; field contract, definition/preset, explanation의 local contract | Browser/UI 실사용·live certification은 별도 검증 필요 |
| SCR-OS-05~08 | `VERIFIED_LOCAL`; outcome, refresh, capability/reconciliation, regime contract fixtures | 실데이터 outcome·provider 권리/가용성은 미검증; fixture는 운영 evidence가 아님 |
| SCR-OS-09 | promotion gate 구현은 `VERIFIED_LOCAL`; persisted validation status는 `BLOCKED` | 실데이터 PIT universe, survivorship, cost/liquidity, live/backtest parity는 미확립 |
| SCR-OS-10 | `VERIFIED_LOCAL`; `_artifacts/screener-scale-benchmark.json` synthetic 결과(`873/5k/20k`)는 2026-08-13에 생성, JSON+column projection 판정 | synthetic benchmark는 production payload/저사양 browser 실측이나 Parquet 인증이 아님 |
| SCR-OS-11 | `VERIFIED_LOCAL`; Workbench adapter 계약 확인 | 현재 revision browser/live 인증과 rollback rehearsal은 별도 수행 필요 |

## producer → contract → consumer

- Producer: `src/data/providers/screener.js`가 artifact/universe를 읽고 `InstrumentRef`, `ObservationEnvelope`, field readiness와 provenance를 만든다.
- Normalizer: `src/data/normalize/screener.js`가 snapshot identity와 row-level observations를 보존한다.
- Domain: `src/domain/screener/screen-engine.js`가 AST를 해석하고 `ScreenRun`·`RankExplanation`을 생성한다.
- State/UI: `src/state/slices/screener.js`, `src/app/bootstrap.js`, `src/ui/pages/screener.js`가 legacy table을 유지하면서 Workbench adapter를 점진적으로 노출한다.
- Gates: `scripts/ci-screener-workbench-contract.mjs`가 SCR-OS-00~09 계약과 baseline을 실행한다. `scripts/benchmark-screener-workbench.mjs`가 SCR-OS-10 synthetic scale decision을 기록한다.

## explicit non-claims

This ledger does not claim predictive validity, point-in-time survivorship-free history, licensed data rights, live provider availability, or deployed parity. Those require separate evidence and cannot be inferred from local contract tests.
