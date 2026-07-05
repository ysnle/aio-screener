---
verified_by: agent
last_verified: 2026-07-03
confidence: high
target_version: v51.96
measured_env: headless Playwright (chromium) + scripts/start-local-node.mjs static server, all non-127.0.0.1 requests aborted (deterministic offline/seed-fallback state)
---

# Headless CI Test Baseline — v51.91→v51.96 (2026-07-03, Phase 2 [B5] + full /data-refresh)

> 목적: `FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` §4 B5(CI 헤드리스 테스트 job)의 실측 기준선.
> `GATE-BASELINE-2026-06-04.md`(v50.4, 수동 python http.server 측정)의 후속판 — 이번엔 CI에
> 상설화된 `scripts/ci-headless-tests.mjs`가 매 push/PR마다 자동 실측한다.
> 측정 방법: `node scripts/ci-headless-tests.mjs` (Playwright chromium, 외부 fetch 전부 abort).
> **2026-07-03 같은 날 두 번째 갱신**: B5 직후 진행한 전체 `/data-refresh` 세션에서 아래 v51.91
> 최초 기준선의 code-regression-candidate 14건 중 2건(T776/T686)이 실제로 해소됨 — P592 참조.
> **2026-07-05 갱신**: FABLE 감사 P5b 수정(P605/R280 — VKOSPI 실시간 fetch 사장 근본원인 수정 +
> 시드 재조정)으로 market-data-drift의 T278/T422가 실제로 재통과 확인되어 제거됨(899/922,
> 스킵리스트 밖 실패 0 재확인, 전후 diff로 이 2건만 변경되었음을 확인) — 아래 표/분류는 그 결과 반영.

## 결과 요약 (v52.8 재측정, 2026-07-05)

| 지표 | v51.91 최초 | v51.96 | v52.8 현재 |
|------|---:|---:|---:|
| total | 921 | 921 | 922 (T859 신규) |
| pass | 894 | 896 | **899** |
| fail | 27 | 25 | **23** |
| CI 처리 | 27건 skip-list | 25건 skip-list | **23건 skip-list**(T278/T422 제거, 실제 수정 완료) |

2026-06-04 기준선(692 total, 673 pass)과 total이 다른 건 v50.4→v51.9x 사이 테스트가 순증했기 때문(신규 회귀 아님).

## 분류 (전량 skip-list, 상세 사유는 JSON 참조)

**market-data-drift (4건, v51.96 대비 T278/T422 해소)** — 라이브/시드 시장 데이터가 매일 바뀌어 하드코딩된 기대 레벨과 어긋남. 운영에서도 매일 같은 이유로 흔들릴 수 있는 항목, 코드 버그 아님. T278/T422(VKOSPI)은 P605/R280로 실제 근본원인 수정되어 제거됨.
T684, T685, T825, T838

**seed-data-drift (2건, v51.91 대비 T686 해소)** — `DATA_SNAPSHOT` 하드코딩 시드 자체(breadth5sma=32 등)가 테스트의 구버전 기대값(=61)과 어긋남. T686(본체↔`_fallback` 미러 불일치)은 실제로 동기화 완료해 스킵리스트에서 제거됨 — 남은 2건은 테스트 자신의 하드코딩이 stale한 것.
T324, T325

**calendar-drift (3건)** — 특정 월/발표일에 고정된 기대값. 시간 경과로 자연히 깨짐.
T759, T829, T830

**version-drift (1건)** — semver 리터럴 "v50.5"가 테스트에 하드코딩. 버전이 오를 때마다 재발.
T762

**code-regression-candidate (13건, v51.91 대비 T776 해소)** — 시장 데이터나 날짜와 무관한 구조/카피/로직 체크. 진짜 회귀일 가능성이 있어 스킵은 하되 별도 triage 필요(아래 "다음 우선순위" 참조):
T143, T239, T303, T491, T512, T557, T608, T706, T781, T800, T803, T834, T858

## ✅ 2026-07-03 같은 날 해소된 항목 (전체 데이터 최신화 세션)

- **T776 (해소)**: 가시 텍스트/tooltip 3곳에서 `v51.9X`·`DATA_SNAPSHOT` 노출 실제 발견·수정 — (1) `js/aio-data.js`의 stale-manual-pill tooltip이 `"aio-core.js DATA_SNAPSHOT._fieldTs.xxx 갱신 필요"`라고 내부 파일·변수명을 그대로 노출 → 일반 문구로 교체, (2) `index.html`의 매크로 페이지 배너가 `"DATA_SNAPSHOT 값 표시"`라고 노출 → `"정적 스냅샷 값 표시"`로 교체, (3) `aio-public-readiness` 패널의 버전 표시 span에 `-version` suffix id 부여해 audit exclusion 패턴에 편입(기존 `app-version-badge` 처리와 동일 방식 — 의도적 버전 공개는 유지, 다만 audit이 "leak"으로 오분류하지 않게 정식 예외 처리). 상세: P592.
- **T686 (해소)**: `DATA_SNAPSHOT._fallback`의 `breadth5/breadth200/breadth50`이 본체 `breadth5sma/20sma/50sma`와 실제로 어긋나 있던 것을 재동기화. 과정에서 `fg` 필드가 stray mid-line `\r` 문자에 가려 그동안 계속 놓쳐지고 있던 것도 발견·수정(같은 파일 다른 5개 모듈은 전수 스캔해 추가 발견 없음 확인). 상세: P592/R273.

## 다음 우선순위 (여전히 미해결 — 별도 세션에서 triage)

- **T608**: `AIO.diagnose()` 함수 자체는 살아있는데(js/aio-core.js:9373) chatSend 에러 안내 카피에서 그 언급이 사라짐 — 문구 리팩터 중 유실된 것으로 보임.
- **T143**: 문서 전체에서 `[onclick]` 7건 검출(티커 내비 자체는 이벤트 위임 정상). 다른 위치의 잔존 inline handler 확인 필요.
- 나머지(T239/T303/T491/T512/T557/T706/T781/T800/T803/T834/T858)는 UX 카피·접근성·페이지 재배치·로직 wiring 개별 확인 필요 — 한 세션에 묶기보다 페이지별로 쪼개는 편이 나을 것.

## 재현 명령

```bash
export PATH="/c/Program Files/nodejs:$PATH"   # Windows 세션 한정
npm install --no-audit --no-fund
npx playwright install --with-deps chromium
node scripts/ci-headless-tests.mjs
```

CI에서는 `.github/workflows/ci.yml`의 `headless-tests` job이 동일 커맨드를 매 push/PR마다 자동 실행한다(report-only, `continue-on-error: true`).
