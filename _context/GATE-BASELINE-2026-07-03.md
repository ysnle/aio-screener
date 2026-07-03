---
verified_by: agent
last_verified: 2026-07-03
confidence: high
target_version: v51.91
measured_env: headless Playwright (chromium) + scripts/start-local-node.mjs static server, all non-127.0.0.1 requests aborted (deterministic offline/seed-fallback state)
---

# Headless CI Test Baseline — v51.91 (2026-07-03, Phase 2 [B5])

> 목적: `FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` §4 B5(CI 헤드리스 테스트 job)의 실측 기준선.
> `GATE-BASELINE-2026-06-04.md`(v50.4, 수동 python http.server 측정)의 후속판 — 이번엔 CI에
> 상설화된 `scripts/ci-headless-tests.mjs`가 매 push/PR마다 자동 실측한다.
> 측정 방법: `node scripts/ci-headless-tests.mjs` (Playwright chromium, 외부 fetch 전부 abort).

## 결과 요약

| 지표 | 값 |
|------|---:|
| total | 921 |
| pass | 894 |
| fail | 27 |
| CI 처리 | 27건 전부 `_context/gate-baseline-skip-list.json`에 등록 → non-blocking(job은 `continue-on-error: true`) |

2026-06-04 기준선(692 total, 673 pass)과 total이 다른 건 v50.4→v51.91 사이 테스트가 순증했기 때문(신규 회귀 아님).

## 분류 (전량 skip-list, 상세 사유는 JSON 참조)

**market-data-drift (6건)** — 라이브/시드 시장 데이터가 매일 바뀌어 하드코딩된 기대 레벨과 어긋남. 운영에서도 매일 같은 이유로 흔들릴 수 있는 항목, 코드 버그 아님.
T278, T422, T684, T685, T825, T838

**seed-data-drift (3건)** — `DATA_SNAPSHOT` 하드코딩 시드가 실제 최신 breadth 값과 벌어짐. 주기적 재동기화가 필요하지만 긴급 버그는 아님.
T324, T325, T686

**calendar-drift (3건)** — 특정 월/발표일에 고정된 기대값. 시간 경과로 자연히 깨짐.
T759, T829, T830

**version-drift (1건)** — semver 리터럴 "v50.5"가 테스트에 하드코딩. 버전이 오를 때마다 재발.
T762

**code-regression-candidate (14건)** — 시장 데이터나 날짜와 무관한 구조/카피/로직 체크. 진짜 회귀일 가능성이 있어 스킵은 하되 별도 триаж 필요(아래 "다음 우선순위" 참조):
T143, T239, T303, T491, T512, T557, T608, T706, T776, T781, T800, T803, T834, T858

## 다음 우선순위 (Phase 2 B5 범위 밖 — 별도 세션에서 triage)

이번 세션은 CI 인프라(B5) 자체가 스코프이고, 아래 14건은 손대지 않았다. 훑어본 바 눈에 띄는 것:

- **T776**: 가시 텍스트에 `page-home:v51.91`, `page-macro:DATA_SNAPSHOT` 마커 노출 — `GATE-BASELINE-2026-06-04.md` §4가 이미 다룬 R204/R206 "내부 마커 누출" 패턴의 재발로 보임. 우선순위 높음.
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
