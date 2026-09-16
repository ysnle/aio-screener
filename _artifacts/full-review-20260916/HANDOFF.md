# Agent Handoff — AIO Screener

에이전트(Codex/Claude/Command Code)가 **교대 근무**할 때 읽는 파일이다. 작업 로그가 아니라 **현재 상태·열린 항목·다음 행동·반복 금지**를 담는다. 버전별 변경 이력은 `CHANGELOG.md`, 버그 계보는 `_context/BUG-POSTMORTEM.md`, 규칙은 `_context/RULES.md`가 정본이다.

| 항목 | 값 |
|---|---|
| 최종 작업 | 2026-09-16 (v54.98) |
| 최종 커밋 | `9fccf5ff` (수정 전). **v54.98 변경분은 아직 커밋되지 않았다** |
| 라이브 상태 | v54.89 / SHA `68bb0713` / 2026-09-11 배포 — 5일 정지 |
| 커밋·push·배포 | **하지 않음** (명시적 요청 필요) |

## 1. 이번 작업(2026-09-16)에서 한 것

배포 정지를 푼 근본원인 4건 + P0 의미 결함 5건. 상세는 `FIX-REPORT.md`, 근거는 `evidence.json`.

1. `public-data/objects/**`가 `core.autocrlf=true` 체크아웃에서 CRLF로 변환돼 내용주소 sha256 계약이 깨지던 문제 → `.gitattributes`(`-text`) 신설 후 555개 객체 LF·digest 일치 확인. 이 결함이 로컬에서 `masters-contract`를 깨뜨려 **브라우저 게이트 23개를 전부 SKIP**시키고 있었다(로컬 재현 불가의 원인).
2. `ci-chat-ui-state-browser-check.mjs`가 앱에 존재한 적 없는 `#chat-home-stop`을 단언 → 실제 `chat-home-btn-stop`.
3. `ci-architecture-browser-check.mjs`의 `chartKinds` 손 목록 → 정본 계약 `src/data/contracts/source-kind.js` 참조.
4. 스크리너 가격 컬럼에 live quote 투영 소유자가 없어 **모든 행이 영구히 `미수신`**이던 문제 → `liveRow`가 field-readiness 경로에서도 overlay(관측시각·출처 동반). 게이트의 "quote tick은 새 snapshotId 생성" 단언은 overlay 이전 설계라 불변성 단언으로 교체.
5. NFP 델타 이중 단위 환산(`/1000`) 제거 / 관측 Equity·Index P/C 보존 + `estimated` 정정 / 엔캐리 라벨을 실제 입력에 일치 / AI research degrade 경로의 `blocked` 강제 해제 fail-open 제거 / 뉴스 staleness 배너 공개 노출 + 헤더 주장 하향 + false all-clear 제거.
6. **후속 세션(같은 v54.98)**: `currentSensitive` 가드 축 수정(P1075/R599) — 한글 종목명·지표 질문(`"삼성전자 실적 어때?"`, `"AAPL PER 얼마야?"`, `"AAPL 밸류에이션 분석해줘"`)에서 수치·현재성 가드 5개가 전부 꺼지던 문제. 계측 어휘(`hit.ENTITY_FACT`)를 스위치로 쓰고 EDUCATION-primary 개념 질문은 제외. `tools/probe-taxonomy.mjs` 13/13.
7. **핸드오프 인프라**: R598 규칙 + `_context/INDEX.md` "Current and live state"에 이 디렉터리 포인터 + `CLAUDE.md` 표에 "작업 이어받기" 행. 이전에는 산출물이 `_artifacts/`에만 있어 다음 에이전트가 발견할 수 없었다.
8. **감사 무결성**: 계약 감사가 자기 부작용을 검증하던 문제를 수정(P1076/R600). 파생 항목을 생성 시점에 기록하고 `authoredCoverage`로 보고(deep-audit 15/20, sequential 16/20). 배포 게이트가 파생 라우트를 경고로 노출. **주의: `js/aio-core.js`가 27,984/28,000줄이라 이 파일은 더 늘릴 수 없다** — 추가 수정은 감축 또는 분해가 필요하다.

결과: CI를 막던 `browser-runtime` **8/8**, `browser-knowledge` **6/6**, `masters-contract` PASS, `qa-runner affected` **91 PASS + 3 CACHED / 0 FAIL**.

## 2. 열린 항목 (우선순위 순)

| # | 항목 | 근거 | 상태 |
|---|---|---|---|
| 1 | ~~`currentSensitive` 단일 축~~ → **수정 완료** (v54.98, P1075/R599). 잔여: 섹터 현황 질문(`"반도체 섹터 어때?"`)과 `hasTicker && 주가` 경로의 HISTORICAL 미검사 | `SEMANTIC-REVIEW.md` H2, `src/ai/intent/taxonomy.js` | **v54.98 수정** |
| 2 | ~~`js/aio-core.js`의 `getPageContractAudit` 공허화~~ → **부분 수정** (v54.98, P1076/R600). 감사가 작성/파생 커버리지를 보고한다(deep-audit **15/20**, sequential **16/20**, 파생 라우트 명시). 잔여: 파생 5개 라우트의 고유 계약 작성, `AIO_PAGE_SEQUENTIAL_AUDIT_REGISTRY`의 stale `lineRange`·퇴역 KR 라우트, `runAllPageDeepAudits`가 라우트 20개 대신 키 21개를 순회 | `SEMANTIC-REVIEW.md` §3, `js/aio-core.js` | **v54.98 부분 수정** |
| 3 | ~~공급 리서치 provenance 렌더러 4종이 죽은 코드~~ → **수정·분류 정정 완료** (v54.98, P1077/R601). 숨김은 **설계 의도**(`internal-protocol-only`)였고, 죽은 렌더러 7종(~230줄)을 삭제하고 게이트를 "문자열 존재"→"메타데이터 존재 + 렌더러 부재(음성 단언)"으로 교체 | `SEMANTIC-REVIEW.md` H5(정정됨), `ci-research-flow-contract-check.mjs` | **v54.98 수정** |
| 4 | ~~스크리너 등급/순위 불일치, breadth enum·basis 노출, technical MACD writer 이중화~~ → **수정 완료** (v54.98, P1078/R602). 등급은 `rankGrade(visibleRank(row))` 단일 함수, 필터 라벨 동일 파생, breadth 참여도 한국어화, `시장 폭 시그널` 라벨 교정, `마켓 폭` 라벨 교정, MACD 히스토그램 기저 통일 | `SEMANTIC-REVIEW.md` H6–H11(정정됨), `tools/probe-screener-grade.mjs` | **v54.98 수정** |
| 5 | `sw.js` PUBLISHED_RUNTIME_ASSETS 등록부 드리프트(유령 11 / 누락 17), AG-DOM-WRITER 추출기 사각지대, `compatibility-facade` read 계층 3중 입력 매핑 | `REPORT.md` §3.1 | 미수정 |
| 6 | semantic ledger 신선도 검사 부재(`asOf 2026-09-12`, HEAD 아님) + 삭제된 스크립트 2건 잔존 | `SEMANTIC-REVIEW.md` §0 | 미수정 |
| 7 | `hy-oas` 출처 식별 체크가 `fred-official-public-csv`를 인정하지 않아 상시 FAIL / 상태 산출물 비원자적 쓰기 / 주말 grace가 UTC 요일 / KR 휴장일 캘린더 부재 | `REPORT.md` §3.3 | 미수정 |
| 8 | staging→attestation 승격과 `main` 보호 미구현 → 검증 전 revision이 main에 남을 수 있음 | QA-EXHAUST-36 | 미수정(설계) |

## 3. 반복 금지 / 주의

- **메시지창에 `cmdc --yolo`를 타이핑해도 아무 일도 일어나지 않는다.** bypass는 실행 시점 플래그 전용이며 `/mode`로 전환 불가(의도적). 재시작 시 `cmdc --yolo --continue`.
- **`_artifacts/exhaustive-audit-20260831/coverage-summary.json`을 현재 리비전 값으로 신뢰하지 말 것** — `asOf 2026-09-12`, `scopeHead 6ef2561d`로 HEAD와 다르고 신선도 게이트가 없다. semantic coverage는 **6.89%, `releaseCertified=false`**.
- **`ci-semantic-review-check.mjs`의 PASS는 의미 검토 완료가 아니다.** 커버리지 미달을 실패로 만들지 않는다(설계).
- `_context/`의 대형 원장(RULES/BUG-POSTMORTEM/QA-CHECKLIST/KNOWLEDGE-BASE)은 **통째로 읽지 않는다.** ID·용어로 검색한다.
- `index.html`은 `_context/CODE-MAP.md`로 구간을 찾아 부분 수정.
- 게이트가 grep하는 문구(QA-CHECKLIST §7 마커, RULES 특정 문장, CHANGELOG v50.89 섹션)는 **삭제 금지**.
- 로컬 브라우저 게이트는 `masters-contract` 실패 시 phase 차단으로 전부 SKIP된다. 이제 `.gitattributes`로 해소됐지만, 유사 환경 결함이 다시 생기면 같은 증상이 재현된다.

## 4. 재개 방법

```text
git status --short
node scripts/qa-runner.mjs session-start --session <task-id>
node scripts/qa-runner.mjs affected --session <task-id>
node scripts/qa-runner.mjs --group browser-runtime --no-cache
node scripts/ci-semantic-review-check.mjs
```

산출물: `REPORT.md`(구조·CI·6개 영역), `SEMANTIC-REVIEW.md`(R219 의미 검토), `FIX-REPORT.md`(수정·검증), `evidence.json`(기계 판독), `browser-gate-sweep.json`(게이트 23개 원시 결과), `tools/`(재현 도구).
