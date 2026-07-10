---
verified_by: agent
last_verified: 2026-07-10
confidence: high
---

# WO-7 점진적 구조 격리 — Packet 1: 전역 read/write 인벤토리 (2026-07-10)

> CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md WO-7의 "금지: 전체 재작성, 한 번에 프레임워크 전환, 대규모 전역 제거"를 존중해, 이 문서는 **측정과 계획**만 담는다. 코드 변경은 이번 패킷에서 검증된 위험 없는 것 하나(P668 참조)만 실행했고, 나머지는 전부 다음 패킷을 위한 baseline이다. 완료 게이트 "패킷마다 전역 write 수·innerHTML 수·누수 대리 지표가 감소 또는 증가 근거 명시"를 만족하려면 이 baseline이 먼저 있어야 한다.

## 1. 실측 baseline (2026-07-10, index.html 32,220줄 + js/*.js 62,875줄 = 총 95,389줄)

| 지표 | 수치 | 비고 |
|---|---:|---|
| `innerHTML =` 대입 | 395 | index.html 164 · aio-core.js 88 · aio-data.js 55 · aio-ui.js 49 · aio-chat.js 35 · aio-tests.js 4 |
| `window.X =` 명시적 전역 쓰기 | 1,318 | 함수 선언 포함(비-module script라 `function`/최상위 `var`도 암묵적으로 window에 붙음 — R280 참조) |
| `escHtml(`/`DOMPurify.`/`_esc(` 이스케이프 호출 | 282 | index.html 93 · aio-data.js 86 · aio-chat.js 46 · aio-ui.js 42 · aio-core.js 15 |
| `setInterval(` 직접 호출 | 2 | 1건은 `_aioRegisterTimer` 자체 구현(정상), 1건은 미경유 raw 호출 — **이번 패킷에서 수정(P668)** |
| `setTimeout(` 호출 | 207 | 레지스트리 없음 — 대부분 1회성 지연 실행이라 setInterval과 동일한 누적 위험은 아니지만 표 밖 |
| `addEventListener(` 호출 | 109 | 이 중 페이지 전환 시 자동 해제되는 것은 `_aioPageBus.register()` 경유분만(아래 §2) |
| `localStorage.setItem/getItem` 직접 호출 | 146 | vs `safeLS()` 경유 8건 — **~95%가 기존 암호화/안전 래퍼 우회** |

## 2. 이미 존재하는 어댑터/레지스트리(WO-7이 "도입하라"고 한 것 중 일부는 이미 있음 — 처음부터 새로 만들 필요 없음)

Codex 원문은 "snapshot adapter, storage adapter, page lifecycle adapter부터 도입"이라고 썼지만, 코드 확인 결과 이 중 **2개는 이미 존재**한다 — WO-7의 실제 갭은 "어댑터 부재"가 아니라 "어댑터는 있는데 전면 채택이 안 됨"에 가깝다(이번 세션 WO-6/WO-2/WO-3에서 반복 발견된 "인프라는 있는데 안 쓰임" 패턴과 동일 계열).

| 어댑터 | 상태 | 위치 | 채택률 |
|---|---|---|---|
| Timer 레지스트리 | **이미 존재** | `js/aio-core.js:492` `window._aioTimerRegistry` + `_aioRegisterTimer(name,fn,ms)`/`_aioClearTimer(name)` — 이름 기준 dedup(재등록 시 기존 clearInterval 자동) | setInterval 2건 중 1건 미경유(수정 완료, P668) |
| Chart 레지스트리 | **이미 존재** | `js/aio-core.js:301` `window._aioChartRegistry` — `register(id,chart)`/`destroyIfExists(id)` | 미측정(다음 패킷: Chart.js 인스턴스 생성부 전수 대조 필요) |
| Page lifecycle bus | **이미 존재** | `js/aio-core.js:526` `window._aioPageBus` — `register(pageId,eventName,fn)`/`unregister(pageId)`, 페이지별 리스너 격리(P175, BUG-POSTMORTEM 기존 항목) | 109 `addEventListener` 중 몇 건이 이 경유인지 미측정(다음 패킷) |
| Snapshot adapter | **미존재** | — | `DATA_SNAPSHOT`(638회 참조)에 대한 단일 read/write 경유 지점 없음 — 각 소비처가 전역을 직접 읽음 |
| Storage adapter | **부분 존재** | `safeLS()`(WO-1A, `_AIO_SENSITIVE_KEYS` 암호화 게이트) | 146 direct vs 8 wrapped — **가장 큰 갭**. WO-1A가 민감 키 암호화는 해결했지만 "모든 localStorage 접근이 한 경유 지점을 통과"하는 진짜 storage adapter는 아직 아님 |

## 3. 이번 패킷에서 실행한 유일한 코드 변경(P668)

`js/aio-chat.js`의 alert 자동점검(`_aioCheckAlerts`, 60초 간격)이 `_aioRegisterTimer`를 거치지 않는 raw `setInterval`이었음 — 이름 기반 dedup·레지스트리 가시성이 없어 이 코드베이스의 다른 모든 named interval과 다른 패턴이었다. `window._aioRegisterTimer('alerts-check', fn, 60000)` 경유로 전환(`typeof` 가드로 미존재 시 기존 raw 방식 안전 폴백). 유일하게 실행한 이유: 위험이 사실상 0(1줄 패턴 교체, 기존에 검증된 레지스트리 재사용, 동작 변화 없음 — 여전히 60초마다 실행)이면서 "전역 쓰기 감소" 게이트에 바로 기여하는, 이번 패킷 기준 유일한 "즉시 안전한" 항목이었기 때문.

## 4. 다음 패킷 후보(이번 세션에서 실행하지 않음 — 규모·리스크상 별도 패킷 필요)

우선순위 순:

1. **Storage adapter 전면화**: 146건의 direct `localStorage` 호출을 `safeLS`/`safeLSGet` 경유로 전환. 리스크: 호출부마다 동기/비동기 가정이 다를 수 있어(WO-1A에서 겪은 `_keyRuntime` 동기 캐시 이슈 참조) 일괄 치환이 아니라 호출부별 개별 검증 필요 — 가장 큰 단일 패킷.
2. **Snapshot adapter 도입**: `DATA_SNAPSHOT` 직접 참조 638건을 단일 read 경유 지점(`getSnapshotField(key)` 류)으로 서서히 이전 — 전체 치환이 아니라 **신규 코드부터 강제**하고 기존 참조는 손대지 않는 점진적 접근 권장(WO-7 금지 항목 "대규모 전역 제거" 회피).
3. **Chart/PageBus 채택률 실측**: 지금은 등록 함수의 존재만 확인했지 실제 채택률(전체 Chart.js 인스턴스·addEventListener 중 몇 %가 레지스트리 경유인지)을 세지 않았다 — 다음 패킷에서 정밀 계측.
4. **innerHTML 신뢰도 분류**: 395건 전수 분류는 이번 패킷 범위 밖(개별 데이터 흐름 추적 필요, 기계적 grep으로는 "같은 줄에 escHtml 호출"만 봐도 29건뿐이라 helper 함수 경유 이스케이프를 놓침 — 오탐 많은 휴리스틱). 다음 패킷 권장: 외부 데이터(뉴스 헤드라인·AI 응답·사용자 입력 포트폴리오 메모)가 흘러드는 고위험 innerHTML 대상부터 우선 추적.

## 5. 이 패킷의 완료 게이트 자체 평가

- ✅ 전역 write 수·innerHTML 수·누수 대리 지표: 이번 패킷은 baseline만 측정(§1) — 다음 패킷부터 "감소 또는 증가 근거"를 이 숫자 대비로 보고할 수 있음.
- ✅ 기존 963(구 948+15)/88 게이트 유지: 로컬 게이트 7종 + 헤드리스 963/963 + viewport 88/88 전부 이번 패킷 이후 재확인.
- ✅ ±500줄 이상 변경 시 CODE-MAP 갱신: 이번 패킷은 코드 변경이 5줄 미만(P668)이라 해당 없음.
