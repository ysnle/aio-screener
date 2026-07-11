---
verified_by: Codex
last_verified: 2026-07-11
confidence: high for repository/static and local real-Chromium PC/laptop evidence; medium for external-source parity; blocked for human screen-reader and authenticated/external-success flows
auto_refresh: true
target_version: v52.58
implementation_status: implemented-locally; external-success and manual-screen-reader evidence pending
source_documents:
  - _context/CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md
  - _context/FABLE-UIUX-DEEP-AUDIT-2026-07-08.md
  - _context/FABLE-EFFICACY-AUDIT-2026-07-10.md
  - _context/FRONTEND-UX-AUDIT-2026-06-05.md
  - _context/PAGE-UX-AUDIT-2026-06-13.md
---

# AIO Screener 2차 인수인계 — 외부 공개 보강 기획·설계

## 0. 이 문서의 역할

이 문서는 2026-07-10의 1차 종합 진단과 후속 22페이지 프론트엔드 추가 진단을 하나의 실행 계획으로 통합한 **2차 인수인계 원장**이다. Luna, Sonnet, Codex 등 후속 모델은 이 문서를 작업 진입점으로 사용하되, 여기에 적힌 과거 상태를 현재 사실로 가정하지 말고 반드시 §2의 기준선 고정부터 다시 수행한다.

이 문서 작성 범위는 기획·설계·수용 기준이다. 작성 시점에 애플리케이션 코드, 설정, 데이터, 배포 상태는 변경하지 않았다.

### 0.1 심각도 해석

현재 상태를 “심각”으로 판정하는 이유는 사이트 전체가 작동하지 않아서가 아니다.

- 핵심 시세·뉴스·스크리너 데이터는 감사 시점에 대체로 수신됐다.
- 로컬 headless 테스트는 `958/958 PASS`였다.
- 정적 구조·데이터·런타임 계약 게이트도 강한 편이다.

문제는 **외부 사용자가 신뢰해야 하는 마지막 계층**이다.

1. 로컬 수정과 라이브 배포가 분리돼 있다.
2. 22개 페이지의 실제 클릭·실패·기기·스크린리더 검증이 닫히지 않았다.
3. 테스트 통과가 의미·사용성·콘텐츠 진실성을 모두 보장하지 않는다.
4. 투자 판단 문구와 알고리즘 실증 수준 사이에 간극이 있다.
5. 개인정보·데이터 저장·제3자 전송·공개 파일 경계가 외부 서비스 기준으로 정리되지 않았다.

따라서 현재 권고 상태는 다음과 같다.

| 배포 수준 | 판정 | 조건 |
|---|---|---|
| 개인 개발/내부 사용 | 가능 | 현재 위험을 이해하는 운영자 사용 |
| 제한적 지인 베타 | 조건부 | §11 Gate BETA 전부 통과, 알려진 제한 고지 |
| 일반 외부 공개 | 보류 | §11 Gate PUBLIC 전부 통과 |
| 투자 성과를 암시하는 프로덕션 | 불가 | WO2/WO3 연구 검증과 표현 강도 재설계까지 필요 |

---

## 1. 증거 등급과 상태 표기

### 1.1 증거 등급

| 등급 | 의미 | 허용되는 표현 |
|---|---|---|
| E3 | 현재 라이브/실브라우저/실API에서 재현 | `LIVE_VERIFIED` |
| E2 | 현재 로컬 full-init/headless/동작 테스트에서 재현 | `LOCAL_VERIFIED` |
| E1 | 소스·정적 계약·DOM 인벤토리로 확인 | `SOURCE_VERIFIED` |
| E0 | 과거 문서·추론·미재현 | `REVERIFY` 또는 `UNVERIFIED` |

정적 코드에 함수가 존재하는 것, 감사 API가 객체를 반환하는 것, 테스트가 shape를 확인하는 것은 E1이다. 사용자가 실제로 클릭했을 때 정상인지는 E2 또는 E3 증거가 필요하다.

### 1.2 작업 상태

| 상태 | 의미 |
|---|---|
| `OPEN` | 구현 또는 재검증이 시작되지 않음 |
| `LOCAL_COMPLETE` | 로컬 구현과 로컬 게이트 완료, 라이브 미반영 또는 미검증 |
| `DEPLOY_PENDING` | 저장소는 준비됐으나 Pages/Worker/운영 설정 반영 필요 |
| `LIVE_VERIFIED` | 배포 후 라이브 동작·콘솔·증거까지 확인 |
| `CLOSED_BY_DECISION` | 사용자가 잔여 위험을 이해하고 의도적으로 범위 제외 |
| `BLOCKED` | 권한·데이터·도구·외부 서비스로 진행 불가 |

`LOCAL_COMPLETE`를 `DONE` 또는 외부 공개 완료로 번역하면 안 된다.

---

## 2. 후속 모델의 필수 기준선 고정

작성 시점 기준:

- 로컬: `main`, HEAD `45fc7fb`, `v52.48`
- git: `origin/main` 대비 `ahead 6, behind 1`
- 워크트리: clean
- 조사 당시 라이브: `v52.43`
- 로컬 headless: `958/958 PASS`
- 로컬 FULL_INIT viewport: 22 routes × 4 viewports 중 기술 분석 4조합 FAIL
- 브라우저 플러그인 추가 실사: Codex 앱 반복 종료로 중단

후속 모델은 작업 전에 반드시 다음을 다시 실행한다.

```powershell
git status -sb
git rev-parse --short HEAD
git log -5 --oneline
Get-Content version.json
```

그 다음 아래 네 상태를 분리해서 기록한다.

```text
LOCAL_HEAD=
LOCAL_VERSION=
ORIGIN_HEAD=
LIVE_VERSION=
LIVE_WORKER_REVISION_OR_CONTRACT=
```

### 2.1 금지사항

- 사용자의 명시적 `배포해줘` 없이 커밋·푸시·Pages 배포·Worker 재배포 금지
- 현재 dirty 파일을 후속 작업의 산출물로 간주 금지
- 전체 `index.html` 재작성 금지
- 2개 이상의 작업 패킷을 한 버전에서 묶어 처리 금지
- 과거 진단의 line number만 믿고 수정 금지; 함수명·DOM ID·CODE-MAP으로 재탐색
- `958/958 PASS`, `issueCount:0`, `coverage:100%`만으로 의미·UX 완료 선언 금지
- `LOCAL_COMPLETE` 항목을 라이브에서 재검증하기 전 삭제·종결 처리 금지

---

## 3. 1차 종합 진단 작업 패킷 재분류

| 기존 패킷 | 현재 상태 | 2차 판정 | 남은 종료 조건 |
|---|---|---|---|
| WO-0 Watchdog 복구 | `LOCAL_COMPLETE` | 라이브 종료 아님 | push 이후 실제 Data Watchdog run 생성·PASS, R290 live invariant 실행 확인 |
| WO-1A 포트폴리오 보안 | `LOCAL_COMPLETE` | 라이브 종료 아님 | 라이브 버전 반영, cross-reload 잠금·오PIN·legacy migration·암호문 저장 재실측 |
| WO-1B Anthropic 비용 경계 | `LOCAL_COMPLETE` + `DEPLOY_PENDING` | Worker 운영 반영 필요 | 실제 Worker 재배포, KV·secret·kill switch·Origin·quota 라이브 확인 |
| WO-2 Trading Score 검증 | `OPEN` | 연구 작업 | PIT/OOS/비용/레짐/캘리브레이션 산출물 |
| WO-3 Factor 검증 | `OPEN` | 연구 작업 | 7-factor parity, PIT universe, 비용·turnover·capacity, walk-forward |
| WO-4 full-init QA | `OPEN/PARTIAL` | 현재 실패 확인 | 22×4 full-init PASS, console/pageerror 0, click/device evidence |
| WO-5 변경 통제 | `LOCAL_COMPLETE` + 일부 `CLOSED_BY_DECISION` | 원래 완료 조건보다 낮은 보호 수준 | force/delete 차단은 적용; required checks/PR 요구는 사용자 결정으로 제외됨을 계속 명시 |
| WO-6 provenance 통합 | `OPEN` | 선행 핵심 | typed provenance와 stale confidence/action degradation |
| WO-7 엔진 구조 격리 | `OPEN` | 후순위 | WO-6과 UX/QA 계약 고정 후 strangler 방식 |
| WO-8 문서 압축 | `OPEN` | 후순위 | active summary/archive 분리와 knowledge lint |

### 3.1 1차 진단에서 유지해야 할 핵심 발견

1. 제품 범위는 강하지만 전역 상태·대형 모듈·직접 DOM 조작의 변경 위험이 크다.
2. live/delayed/manual/seed/fallback provenance가 UI·알고리즘·테스트에서 단일 타입으로 강제되지 않는다.
3. Trading Score는 설명 가능한 휴리스틱이지 통계적으로 보정된 수익률 예측 모델이 아니다.
4. live 7-factor와 저장된 backtest의 factor/표본/parity가 다르다.
5. 정적 게이트는 강하지만 실제 초기화·외부 장애·브라우저 콘솔을 충분히 실패로 만들지 않는다.
6. 문서·규칙·QA는 강점이지만 append-only 운영 부채가 커졌다.
7. 전면 재작성 대신 adapter와 순수 함수 경계를 한 개씩 도입해야 한다.

---

## 4. 2차 프론트엔드 전수 진단 요약

### 4.1 실제 페이지 구조

- 사이드바 직접 진입 페이지: 19개
- 파생 사용자 흐름: `ticker`, `theme-detail`
- 내비게이션에서 제거된 shell: `options`
- DOM route 총수: 22개
- 비-route overlay: glossary 등

따라서 “22개 DOM route”는 맞지만 “22개 독립 완성 기능 페이지”는 아니다. `options` shell을 페이지 수 유지용으로 보존하는 테스트가 존재하며 `theme-detail`은 `themes` 인라인 상세로 canonical redirect된다.

### 4.2 페이지별 사용자 접점 인벤토리

아래 수치는 정적 source/DOM 검토 후보 수다. placeholder나 작은 글자 후보가 초기화 후 전부 실제 노출된다는 뜻은 아니다.

| 페이지 | 주요 규모 | 판정 | 핵심 보강 방향 |
|---|---:|---|---|
| home | 21 cards, 8 controls | 조건부 | 첫 화면 결론·근거·행동 3단 우선순위, 초기화 상태 정직화 |
| signal | 26 sections, 4.9k chars, placeholder 125 | 위험 | 기본 경로 5~7개 핵심 섹션으로 축소, 고급 근거 접기 |
| breadth | 19 sections, 5 charts | 조건부 | 동일 지표 색·라벨 통일, 판단 우선순위 강화 |
| sentiment | 12 sections, 8 charts | 조건부 | 대표 심리 결론과 보조 지표 시각 위계 분리 |
| briefing | 8 sections, placeholder 21 | 공개 차단 | AI 403/키 없음/timeout의 완결된 실패 경험 |
| technical | 31 sections | 공개 차단 | `_pricePosition()` SVG 라벨 중첩 수정, 섹션 축소 |
| macro | 33 sections, 22 widgets | 위험 | 현재 영향→핵심 지표→참고자료 계층화 |
| fxbond | 30 sections, placeholder 82 | 위험 | live/snapshot/manual 상태 분리와 기본 화면 축소 |
| fundamental | 8 charts, 13 controls | 조건부 | API/key/failure/empty 상태와 검색 흐름 실증 |
| themes | 27 sections | 위험 | 목록→선택→인라인 상세의 canonical flow 명확화 |
| theme-detail | derived route | 고위험 미검증 | 실제 active panel 기준 검사, route alias 별도 성공 판정 |
| portfolio | 44 controls, 20 actions | 공개 차단 | 라이브 암호화·잠금 검증, 상호작용 단계별 단순화 |
| ticker | 17 controls, 8 actions | 조건부 | 진입·검색·실패·뒤로가기·차트 로드 실증 |
| market-news | dynamic-heavy | 위험 | 번역 실패, 중복, 출처·신선도, 빈 상태 정리 |
| options | orphan shell | 제품 페이지 아님 | 유지/제거/참고 페이지 중 하나로 명시적 결정 |
| screener | 25 controls, tiny-text 43 | 위험 | 필터 그룹화, select accessible name, 결과→상세 흐름 |
| kr-home | 25 sections/cards | 위험 | 오래된 수동 snapshot을 현재 장세와 시각적으로 격리 |
| kr-supply | 7 tables | 조건부 | live/fallback/failed 상태와 표 읽기 흐름 검증 |
| kr-themes | 12 controls | 조건부 | 필터·정렬·상세 진입 클릭 전수 |
| kr-macro | 28 sections, 5 tables | 위험 | 수동 데이터와 현재 판단 분리, 작은 글자 축소 |
| kr-technical | 17 controls, 3 charts | 조건부 | 콜드로드·검색·실패·재시도·차트 실렌더 검증 |
| guide | 10.7k chars, 30 sections | 위험 | 목차·검색·단계별 입문 흐름, 폐기 기능 안내 제거 |

### 4.3 현재 확인된 프론트엔드 확정 결함

#### F-01. 기술 분석 SVG 텍스트 중첩

`js/aio-ui.js`의 `_pricePosition()`이 MA/ATH 라벨과 금액을 각각 `slY+21`, `slY+31`에 모두 10px로 배치한다. FULL_INIT viewport 검사에서 모든 지원 폭(390/768/1024/1440)의 `technical` route가 다음 3쌍 중첩으로 실패했다.

- `200MA` / `$669`
- `50MA` / `$725`
- `ATH` / `$759`

단순 SVG 높이 증가보다 라벨 배치 알고리즘을 고쳐야 한다. 값이 가까울 때 수평 또는 수직 lane을 분리하고, 충돌 검사를 fixture로 고정한다.

#### F-02. viewport gate의 사각지대

`scripts/ci-viewport-matrix-check.mjs` 현재 계약:

- `theme-detail`을 실제 상세 panel이 아니라 `themes` root로 치환
- `zeroCanvases` 배열을 선언만 하고 채우지 않음
- 기본 `FULL_INIT=false`
- 외부 요청을 모두 abort
- `showPage()` 후 route별 async settle 조건 없음
- viewport job은 `continue-on-error: true`
- route matrix 자체에는 `pageerror`/`console.error` 실패 수집 없음

따라서 default 88/88 PASS는 실제 페이지 초기화 E2E 통과가 아니다.

#### F-03. 감사 API와 테스트 의미의 과대해석 위험

- `AIO.getPageUXAudit()`은 페이지 존재, 특정 stale 문자열, 일부 overflow만 확인한다.
- `AIO.getFullSurfaceAudit()`은 DOM 개수와 registry/loading 위주다.
- `AIO.getDeepReviewAudit()`의 stale 정규식은 2026-05 같은 현재형 오래된 날짜를 포착하지 못한다.
- T314 data-action audit는 `missingActions===0`을 요구하지 않고 shape만 확인한다.
- T211 duplicate audit도 중복 0을 요구하지 않고 배열 존재만 확인한다.
- color contrast audit는 고정 토큰 8쌍을 계산할 뿐 실제 DOM 전체의 computed color를 검사하지 않는다.

후속 작업은 기존 테스트 수를 늘리는 것보다 **shape test를 semantic assertion으로 승격**해야 한다.

#### F-04. 사용자 안내와 제품 기능 불일치

가이드는 사이드바 하단 `Feedback` 버튼과 보드 사용을 안내하지만 관련 버튼·DOM은 제거됐고 T805가 제거 상태를 강제한다. 가이드 문구, CSS, dead function이 서로 다른 시대를 가리킨다.

#### F-05. 외부 공개 신뢰 표면 미완

- 개인정보처리방침·이용약관·데이터 저장/제3자 전송 설명 없음
- 투자 면책은 가이드 깊은 위치에 집중
- `og:image`, `twitter:image`, canonical 없음
- `robots.txt`, `sitemap.xml` 없음
- Pages staging은 공개 파일 allowlist가 아니라 dot/underscore만 제외한 root 복사
- 조사 당시 `AGENTS.md`, `CLAUDE.md`, `package.json`, CI/Worker source 등 불필요한 root 파일이 라이브 200 응답

#### F-06. 접근성·가독성

개선 확인:

- 정적 `<canvas>` 37개 모두 accessible name 보유
- `aria-live` 2개로 정리

남은 위험:

- screener 기본 `<select>` 4개는 프로그램적으로 연결된 label/accessible name 없음
- 7~10px 인라인 텍스트가 여러 페이지에 집중
- FULL_INIT matrix에서 tiny-text observation 232건
- tap target, 키보드 전체 경로, focus order, NVDA 실사 미완

#### F-07. Tier 13 미완

이번 추가 실사에서 브라우저 플러그인을 사용하려 했으나 Codex 앱이 반복 종료돼 중단했다. 이는 사이트 결함이 아니라 도구 차단이다. 따라서 현재 버전 22개 route의 픽셀 스크린샷·전체 클릭·실기기 검증은 `UNVERIFIED`다.

---

## 5. 목표 UX·콘텐츠·디자인 계약

### 5.1 모든 페이지의 3층 구조

모든 사용자 페이지는 다음 순서를 기본으로 한다.

```text
1. 결론: 이 페이지가 지금 무엇을 말하는가
2. 근거: 결론을 만든 핵심 3~5개 데이터
3. 참고: 상세 표·고급 산식·교육·과거 자료
```

기본 화면에서 세 층을 동일한 카드 무게로 펼치지 않는다.

### 5.2 첫 화면 예산

| 항목 | 목표 계약 |
|---|---|
| 핵심 결론 | 1개 |
| 사용자가 취할 행동 | 1~3개 |
| 핵심 근거 | 3~5개 |
| 기본 visible major section | 권장 5~7개 이하 |
| 고급/교육/산식 | default-collapsed details 또는 guide로 이동 |
| 동일 지표 반복 | 요약 1회 + 상세 1회 이하 |

섹션 수를 기계적으로 삭제하는 것이 목적은 아니다. **기본 경로의 인지 부하**를 줄이고 전문 자료는 두 번째 층 이후에 보존한다.

### 5.3 타이포그래피

| 용도 | 최소 목표 |
|---|---:|
| 본문/설명 | 12px 권장 |
| 데이터 보조 라벨 | 11px 이상 |
| 법적·출처·상태 라벨 | 10px 이상, 대비 충족 |
| 9px 이하 | 금지 |
| 클릭/tap target | 최소 24×24px, 핵심 조작은 36px 이상 권장 |

정보 밀도를 작은 글자로 해결하지 않는다. 공간이 부족하면 접기, 툴팁, column 축소, priority hiding을 사용한다.

### 5.4 상태 계약

모든 값·표·차트·AI 패널은 다음 상태 중 하나를 명시적으로 가진다.

```text
value      실제 사용할 수 있는 값
pending    요청/계산 진행 중
failed     실패 사유와 재시도 제공
na         해당 없음 또는 현재 제공 불가
reference  오래된/수동/교육용 참고값
```

표시 요구:

- `—` 하나로 `pending/failed/na/reference`를 합치지 않는다.
- `failed`에는 실패 이유, 마지막 성공 시각, 재시도 행동을 제공한다.
- `reference` 위에서 방향성·확신도·Risk-On/정상 같은 판정문을 만들지 않는다.
- snapshot 전체 시각과 필드 개별 시각을 분리한다.

### 5.5 데이터 provenance 표준

화면과 알고리즘이 공유할 최소 객체:

```javascript
{
  value,
  sourceKind,      // live | delayed | manual | seed | fallback
  sourceName,
  observedAt,
  publishedAt,
  fetchedAt,
  freshnessClass, // fresh | aging | stale | expired | unknown
  fallbackReason,
  quality,
  evidenceId
}
```

UI 배지와 score/action confidence는 동일 객체를 소비해야 한다.

### 5.6 route/정보구조 계약

권장 분류:

```text
NAV_ROUTE      사이드바에서 직접 진입하는 완성 페이지
DERIVED_VIEW   ticker, theme detail처럼 상위 흐름에서 진입
REFERENCE      폐기 기능 안내 또는 교육용 참고 페이지
REMOVED        route/nav/test/문서에서 완전 제거
OVERLAY        glossary/modal/drawer
```

각 route는 하나의 분류만 갖는다. DOM page count를 제품 기능 수로 사용하지 않는다.

### 5.7 외부 공개 신뢰 계약

사용자에게 최소한 다음을 알려야 한다.

- 투자 권유가 아니며 원금 손실 가능성이 있음
- 데이터의 실시간/지연/스냅샷 성격
- 포트폴리오/API 키가 어디에 어떤 형태로 저장되는지
- 어떤 외부 제공자에게 무엇이 전송되는지
- 로그·쿠키·localStorage·IndexedDB 사용 범위
- 문의/오류 신고 경로
- 서비스 가용성과 데이터 정확성 한계

법률 자문을 가장하지 말고 실제 동작과 일치하는 운영 설명을 먼저 작성한다. 최종 법적 문안은 필요 시 전문가 검토 대상으로 표시한다.

---

## 6. 2차 작업 패킷 — Release Safety

### H2-00. 기준선·범위·증거 동결

- 우선순위: P0
- 상태: `OPEN`
- 의존성: 없음

목적: 다른 에이전트의 순차 작업과 origin/live drift 속에서 잘못된 기준으로 수정하지 않게 한다.

작업:

1. §2 기준선을 재측정한다.
2. 기존 dirty 파일과 이번 작업 파일을 분리한다.
3. 선택한 단일 H2 패킷의 영향 파일만 선언한다.
4. 수정 전 실패를 재현하거나 `REVERIFY`로 낮춘다.

완료 조건:

- local/origin/live/Worker 4개 진실 원천 기록
- 수정 전 실패 증거 1개 이상
- 변경 파일 allowlist 작성
- 사용자 권한이 필요한 배포/Worker/GitHub 설정은 별도 표시

### H2-01. 로컬 완료 항목의 라이브 운영 폐쇄

- 우선순위: P0
- 상태: `DEPLOY_PENDING`
- 대상: 기존 WO-0, WO-1A, WO-1B

설계:

1. Pages 배포와 Worker 배포를 별도 release unit으로 취급한다.
2. source commit/version만 맞아도 Worker revision이 다르면 실패다.
3. 배포 직후와 1시간 후 standing invariant를 각각 확인한다.

완료 조건:

- 라이브 app/version/SW/cachebuster 일치
- GitHub Data Watchdog 실제 run PASS, job 0이 아님
- Worker `/anthropic`의 Origin/token/KV fail-closed/body/rate-limit 라이브 확인
- 라이브 포트폴리오 cross-reload lock, 오PIN 거부, 암호문 저장 확인
- 라이브 콘솔의 신규 error 0

필수 증거:

- GitHub run URL/ID
- live version과 asset cachebuster
- Worker 응답 status matrix
- 포트폴리오 저장값은 민감 원문을 노출하지 않고 prefix/암호문 여부만 기록

### H2-02. viewport/headless QA를 실제 초기화 게이트로 승격

- 우선순위: P0
- 상태: `OPEN`
- 대상: `scripts/ci-viewport-matrix-check.mjs`, `scripts/ci-headless-tests.mjs`, `.github/workflows/ci.yml`

구현 설계:

1. CI 기본을 `FULL_INIT=true`로 전환한다.
2. route마다 `showPage()` 후 route-specific settle predicate를 기다린다.
3. `pageerror`, `console.error`, unhandled rejection을 route 결과에 귀속한다.
4. `zeroCanvases`를 실제 visible canvas bounding box/pixel 또는 Chart registry 상태로 채운다.
5. `theme-detail`은 `themes` page 존재가 아니라 canonical detail panel visible + selected theme content로 판정한다.
6. 외부 정상/실패/timeout/partial-data fixture를 분리한다.
7. viewport job을 blocking으로 바꾸되 known baseline skip-list를 새로 만들지 않는다.
8. 작은 글자는 observation이 아니라 정책 위반으로 분류한다.

완료 조건:

- 22×4 full-init PASS
- route별 settle timeout 0
- pageerror/console.error/unhandled rejection 0
- visible zero-size/blank canvas 0
- theme-detail alias→canonical panel 검증 PASS
- tiny text 정책 위반 0
- CI `continue-on-error` 제거 후 deploy dependency 연결

금지:

- 에러 문자열을 allowlist에 무제한 추가
- `body{overflow-x:hidden}`으로 component overflow 은폐
- 네트워크를 전부 abort한 결과를 live-init PASS로 표기

### H2-03. 기술 분석 가격 포지셔닝 시각 충돌 수정

- 우선순위: P0
- 상태: `OPEN`
- 대상 anchor: `js/aio-ui.js` `_pricePosition()`

설계 선택:

1. MA/ATH marker의 x-distance를 측정한다.
2. 충돌 시 alternating lane 또는 edge-aware anchor를 적용한다.
3. label과 value를 하나의 group으로 취급한다.
4. price marker와 MA/ATH group 간 충돌도 함께 검사한다.
5. SVG viewBox/height를 고정값으로 늘리는 것만으로 닫지 않는다.

fixture:

- 모든 값이 멀리 떨어진 정상 사례
- 50MA/200MA 근접
- ATH/현재가 근접
- 세 marker 모두 근접
- 0/NaN/null/음수 방어
- 긴 심볼과 4~6자리 금액

완료 조건:

- 390/768/1024/1440에서 SVG text overlap 0
- SVG text <10px 0
- 기존 색·의미·값 보존
- `_pricePosition()` fixture regression gate 추가

### H2-04. AI 브리핑·번역·채팅 실패 경험 통합

- 우선순위: P0/P1
- 상태: `OPEN`
- 대상: briefing, market-news, unified chat, Worker route

사용자 상태:

```text
사용 가능
개인 키 필요
운영자 서버 경로 사용 가능
지역 라우팅 재시도 중
일일 한도 초과
일시 장애
설정 오류/KV 미바인딩
완전 비활성
```

구현 설계:

- 동일 Worker root cause를 채팅/번역/브리핑 3곳에서 같은 상태 코드로 정규화
- 실패 후 무한 `분석 중`/`번역 대기` 금지
- 재시도 횟수와 최종 실패를 UI에 구분
- fallback 텍스트가 투자 결론처럼 보이지 않게 reference 표시
- API 키 입력 전에 저장 위치·전송 대상·보호 한계 설명

완료 조건:

- 성공·403 regional·403 auth/origin·429 quota·503 KV·timeout fixture 전부 UI 상태 검증
- 실패 상태에 이유/마지막 성공/재시도 제공
- 콘솔만 보고 사용자가 무반응을 겪는 경로 0
- 모든 AI 호출부가 같은 normalized error contract 소비

### H2-05. 포트폴리오 외부 사용자 안전 검증

- 우선순위: P0
- 상태: `DEPLOY_PENDING`
- 전제: 기존 WO-1A 코드를 새로 재설계하지 말고 실제 라이브 배선부터 검증

핵심 시나리오:

1. 신규 사용자 무PIN
2. PIN 설정과 실제 암호화 저장
3. 새 탭/재로드 후 잠금
4. 오PIN 거부
5. 정PIN 복구
6. 레거시 평문/PIN migration
7. 보호 해제와 API key Vault 비손상
8. export/import/backup/restore
9. 저장공간 차단/손상 JSON
10. XSS/악성 확장에 대한 정직한 한계 문구

완료 조건:

- 위 시나리오 라이브 또는 배포 후보 E2E PASS
- UI 보안 문구와 실제 storage 계약 일치
- 데이터 삭제·초기화 전 명확한 결과 안내
- 암호화가 XSS/악성 확장까지 막는다고 과장하지 않음

### H2-06. 외부 공개 표면과 배포 artifact allowlist

- 우선순위: P0/P1
- 상태: `OPEN`

설계:

1. Pages staging을 공개 파일 allowlist 방식으로 전환한다.
2. 공개가 필요한 root asset만 명시한다.
3. 내부 문서·개발 설정·CI source·package metadata 공개 필요성을 개별 판단한다.
4. privacy/data-handling/terms/disclaimer/contact 문서를 사용자 UI에서 도달 가능하게 한다.
5. canonical, OG/Twitter image, robots, sitemap 정책을 확정한다.

완료 조건:

- 공개 artifact manifest 존재
- `AGENTS.md`, 내부 `CLAUDE.md`, QA/CI helper, 불필요한 source 파일이 live 404 또는 의도적 공개 목록에 명시
- 개인정보·저장·제3자 전송·투자 위험·문의 경로가 2클릭 이내
- `og:image`, `twitter:image`, canonical 일치
- robots/sitemap의 포함/제외 정책 테스트

주의: source 공개 자체가 보안 취약점이라는 뜻은 아니다. 문제는 **의도와 검토 없이 전체 root가 공개되는 배포 계약**이다.

### H2-07. 사용자 콘텐츠 진실성 전수 정리

- 우선순위: P1
- 상태: `OPEN`

우선 확정 항목:

- guide의 제거된 Feedback/board 안내 삭제 또는 실제 문의 경로로 교체
- 잔존 Feedback CSS/dead functions의 사용 여부 결정
- KR 화면의 오래된 `2026-05-16` 데이터는 live 대체, reference 격리, 또는 제거
- `실시간`, `오늘`, `현재`, `최신`, `정상`, `권장` 표현을 evidence/source 상태와 대조
- 투자 면책과 데이터 한계를 기본 사용자 경로에 배치

완료 조건:

- 가시 문구가 존재하지 않는 기능을 안내하는 사례 0
- fixed date/current claim audit 0
- reference data 위 assertive verdict 0
- 문의/오류 신고 실제 도달 경로 1개 이상
- guide 목차에서 초보자 핵심 루틴까지 2단계 이내

---

## 7. 2차 작업 패킷 — Page UX And Accessibility

### H2-08. route·정보구조 단일 진실 원천

- 우선순위: P1
- 상태: `OPEN`
- 의존성: H2-02

작업:

- 22 DOM route를 `NAV_ROUTE|DERIVED_VIEW|REFERENCE|REMOVED|OVERLAY`로 분류
- sidebar, showPage, history/hash, tests, page contracts, guide가 같은 registry를 소비
- `options`의 제품 결정을 사용자에게 요청: 실제 reference page 유지 vs 완전 제거
- `theme-detail`은 derived canonical panel로 검사
- `ticker`는 previous page/back behavior 계약 포함

완료 조건:

- route 수, nav 수, 제품 페이지 수를 서로 다른 지표로 보고
- orphan route 0 또는 의도적 REFERENCE 표시
- browser back/forward와 deep link 테스트
- “22개 기능 페이지” 과대표현 0

### H2-09. 페이지별 기본 경로 declutter와 시각 위계

- 우선순위: P1
- 상태: `OPEN`
- 의존성: H2-08

우선 대상 순서:

```text
signal → macro → technical → fxbond → guide → kr-macro → themes → portfolio → screener → kr-home
```

페이지별 작업 방식:

1. 사용자의 첫 질문을 한 문장으로 정의한다.
2. 첫 화면 결론·행동·핵심 근거를 표시한다.
3. 중복/교육/산식/과거 자료를 두 번째 층으로 이동한다.
4. 기능을 삭제하지 않고 기본 노출 우선순위를 낮춘다.
5. before/after screenshot과 section inventory를 남긴다.

완료 조건:

- 각 페이지 first-screen intent 문장 1개
- 기본 visible major section 권장 5~7개 또는 초과 사유 문서화
- 동일 지표 반복 요약/상세 2회 이하
- 390px 첫 화면에서 결론·행동이 핵심 데이터보다 아래로 밀리지 않음
- 사용자 시나리오 1개 이상 실클릭

### H2-10. 타이포그래피·접근성·컨트롤 계약

- 우선순위: P1
- 상태: `OPEN`
- 의존성: H2-09와 병행 가능하나 같은 파일 동시 수정 금지

작업:

- 7/8/9px 전수 제거, 10px 사용처 역할 검토
- screener select 4개에 label/aria-labelledby 연결
- icon-only 버튼 accessible name 전수
- 24×24 미만 target 분류와 예외 제거
- visible focus, skip link, modal focus trap/Esc, table caption/header 검증
- 상태·등락을 색상만으로 전달하지 않음

완료 조건:

- computed font <10px 0
- nameless interactive control 0
- 필터/검색/표/차트 accessible name 100%
- keyboard 핵심 경로 PASS
- NVDA 핵심 경로: nav→page title→결론→필터→결과→상세

### H2-11. Tier 13 실제 사용자 검증 원장

- 우선순위: P1, 외부 공개 전 필수
- 상태: `BLOCKED`였음; 새 세션에서 도구 재확인
- 의존성: H2-02~10

지원 매트릭스 최소:

| 환경 | 폭/기기 | 필수 |
|---|---|---|
| Chromium | 390, 768, 1024, 1440 | 예 |
| Firefox | desktop + mobile emulation | 예 |
| Safari/WebKit | desktop + iPhone class | 예 |
| 실제 Chrome 또는 in-app browser | 핵심 10 route | 예 |
| NVDA | Windows 핵심 흐름 | 예 |

route별 공통 시나리오:

- 진입과 뒤로가기
- 첫 데이터 settle
- 기본 컨트롤 1개 이상
- empty/failure/timeout
- 차트 paint와 resize
- 2회 재진입 시 timer/listener 중복 없음
- keyboard focus
- screenshot과 console

완료 조건:

- 22 route × 4 primary viewport 증거
- 상호작용 많은 portfolio/screener/ticker/kr-technical은 별도 click matrix
- Safari/Firefox 차이 목록 0 또는 명시적 known limitation
- screen-reader 핵심 흐름 증거
- 브라우저 도구가 막히면 PASS가 아니라 `BLOCKED` 유지

---

## 8. 2차 작업 패킷 — Data And Algorithms

### H2-12. typed provenance와 사용자 행동 강도 연결

- 우선순위: P1
- 상태: `OPEN`
- 기존 WO-6의 구체화

단계:

1. 표시용 핵심 10개 지표부터 provenance 객체로 감싼다.
2. adapter에서 legacy raw value를 새 객체로 변환한다.
3. UI와 score가 같은 객체를 소비한다.
4. stale/manual/seed 비율에 따라 confidence와 행동 문구를 자동 약화한다.
5. 전체 데이터 한 번에 변환하지 않는다.

완료 조건:

- 한 값의 화면 숫자·배지·판정·AI 컨텍스트가 같은 evidenceId 공유
- missing과 neutral 분리
- future/asOf leakage fixture
- stale/manual/seed 위 assertive action 0
- lineage export 가능

### H2-13. Trading Score 연구 검증

- 우선순위: P1/P2
- 상태: `OPEN`
- 의존성: H2-12
- 기존 WO-2의 실행 명세

산출물:

- PIT 입력 snapshot dataset
- live/backtest parity test
- 1/5/21/63일 forward return·MDD
- bull/bear/sideways 및 vol regime 분해
- factor correlation·ablation
- naive/200MA/buy-and-hold baseline
- walk-forward with embargo
- fallback 비율별 성능
- 비용 전/후 결과
- 행동 라벨 calibration table

완료 조건:

- train/tune/test 기간 선고정
- 표본 수·신뢰구간·최대 낙폭 공개
- 부정적 결과도 삭제하지 않고 artifact 유지
- 유의미하지 않으면 UI 표현을 위험 온도계 수준으로 낮춤
- `confidence %`가 실제 calibration이 아니면 확률형 표기 제거

### H2-14. Factor Engine 연구→프로덕션 검증

- 우선순위: P1/P2
- 상태: `OPEN`
- 의존성: H2-12
- 기존 WO-3의 실행 명세

필수:

- live 7-factor와 backtest feature parity
- PIT universe, delisted 종목, corporate actions
- PIT fundamentals 또는 명시적 가격-only 제한
- sector/size/vol exposure report
- turnover, spread, slippage, tax, capacity
- rolling walk-forward/OOS
- IC/ICIR/t-stat/decay/monotonicity
- regime·sector·size subperiod
- adaptive weight 별도 검증

완료 조건:

- 6개 rebalance 같은 소표본을 hit rate로 홍보하지 않음
- survivorship/look-ahead audit PASS
- 비용 후 baseline 대비 증분 가치와 실패 구간 공개
- 불충분하면 screener를 연구형 ranking으로 정직하게 표시

---

## 9. 2차 작업 패킷 — Architecture And Governance

### H2-15. 점진적 엔진 경계 격리

- 우선순위: P2
- 상태: `OPEN`
- 의존성: H2-02, H2-12
- 기존 WO-7의 구체화

순서:

1. 전역 read/write inventory
2. storage adapter
3. market snapshot/provenance adapter
4. page lifecycle owner
5. 순수 계산 함수 추출
6. renderer 입력 contract

한 번에 하나의 vertical slice만 이전한다. 후보 순서:

```text
portfolio storage → technical SVG renderer → page lifecycle → market snapshot → score engine
```

완료 조건:

- 추출 전후 동작 parity
- 전역 write 수·innerHTML 위험 surface·listener/timer ownership 변화 수치 기록
- 새 adapter가 기존 경로와 영구 병렬로 남지 않음
- ±500 lines 이상 이동 시 CODE-MAP 갱신

### H2-16. 문서·QA·규칙 압축

- 우선순위: P2
- 상태: `OPEN`
- 기존 WO-8의 구체화

작업:

- CHANGELOG/BUG/RULES/QA를 active summary와 archive로 분리
- superseded rule과 historical baseline을 현재 계약에서 격리
- INDEX/CLAUDE 문서 수·버전·role 자동 검증
- 2차 인수인계의 각 발견을 하나의 executable gate 또는 명시적 human gate에 연결

완료 조건:

- 후속 모델이 현재 규칙을 한 문서에서 찾을 수 있음
- 오래된 21-page/old-version 표현이 active baseline에 없음
- knowledge lint/workflow compaction PASS
- 문서 추가가 다시 append-only duplication을 만들지 않음

---

## 10. 권장 실행 순서

```text
H2-00 기준선 동결
  ├─ H2-01 라이브 운영 폐쇄
  ├─ H2-02 full-init QA 승격
  │    └─ H2-03 technical SVG 수정
  ├─ H2-04 AI 실패 경험
  ├─ H2-05 portfolio 라이브 검증
  ├─ H2-06 공개 표면/allowlist
  └─ H2-07 콘텐츠 진실성

H2-08 route/IA
  └─ H2-09 page declutter
       └─ H2-10 accessibility/type
            └─ H2-11 Tier 13

H2-12 provenance
  ├─ H2-13 Trading Score 연구
  ├─ H2-14 Factor 연구
  └─ H2-15 architecture isolation

마지막: H2-16 문서 압축 + 전체 재감사
```

동일 파일을 건드리는 작업은 순차 처리한다. 서로 독립된 연구 작업이라도 결과를 같은 버전·커밋에 묶지 않는다.

---

## 11. 외부 공개 게이트

### Gate BETA

다음이 모두 Yes일 때만 제한적 베타를 권고한다.

| ID | Yes 조건 |
|---|---|
| B1 | local/live version·SW·cachebuster parity |
| B2 | Watchdog 실제 run PASS |
| B3 | portfolio 라이브 암호화/잠금 E2E PASS |
| B4 | Worker live 비용·권한 경계 PASS 또는 server-key 기능 비활성 |
| B5 | 22×4 FULL_INIT matrix PASS |
| B6 | technical SVG overlap 0 |
| B7 | AI 실패 시 무한 대기·무반응 0 |
| B8 | 존재하지 않는 기능 안내 0 |
| B9 | privacy/data-handling/투자 위험/문의 경로 노출 |
| B10 | 알려진 제한 목록을 베타 사용자에게 고지 |

### Gate PUBLIC

Gate BETA에 더해 다음이 모두 Yes여야 한다.

| ID | Yes 조건 |
|---|---|
| P1 | Tier 13 22-route 증거 완료 |
| P2 | Chrome/Firefox/Safari·mobile 핵심 흐름 PASS |
| P3 | keyboard/NVDA 핵심 흐름 PASS |
| P4 | 공개 artifact allowlist와 live 404 검증 |
| P5 | computed font/accessible name/tap target 정책 PASS |
| P6 | 모든 failed/reference 상태가 사용자에게 구분됨 |
| P7 | live console critical error/warning 0 또는 승인된 좁은 목록 |
| P8 | page별 first-screen intent/결론/행동 계약 PASS |
| P9 | 데이터 provenance가 판단 문구 강도를 제한 |
| P10 | CI가 FULL_INIT/headless/structural/runtime를 실제 deploy blocker로 사용 |

### Gate CLAIMS

다음이 완료되기 전에는 수익률 예측·확률·기관급 검증을 암시하지 않는다.

| ID | Yes 조건 |
|---|---|
| C1 | Trading Score OOS/walk-forward/cost/calibration |
| C2 | Factor live/backtest parity + PIT/survivorship control |
| C3 | 표본 수·신뢰구간·실패 regime 공개 |
| C4 | 부정적 결과에 따른 UI 문구 자동 강등 |

---

## 12. 모든 H2 패킷의 공통 검증 명령

변경 범위에 맞게 선택하되, UI/공유 런타임 변경은 아래를 기본으로 한다.

```powershell
node --check js/aio-core.js
node --check js/aio-data.js
node --check js/aio-ui.js
node --check js/aio-chat.js
node --check js/aio-tests.js
node scripts/ci-version-check.mjs
node scripts/ci-structural-check.mjs
node scripts/ci-runtime-contract-check.mjs
node scripts/ci-ux-default-path-check.mjs
node scripts/ci-data-pipeline-contract-check.mjs
node scripts/ci-semantic-review-check.mjs
node scripts/ci-headless-tests.mjs
$env:AIO_VIEWPORT_FULL_INIT='1'; node scripts/ci-viewport-matrix-check.mjs
git diff --check
```

문서·QA·workflow를 수정하면 추가:

```powershell
node scripts/ci-workflow-compaction-check.mjs
node scripts/ci-knowledge-lint-check.mjs
node scripts/ci-control-char-check.mjs
```

Worker 변경 시:

```powershell
node scripts/ci-worker-anthropic-check.mjs
```

네트워크 권한이 있을 때만:

```powershell
node scripts/ci-live-invariant-check.mjs
```

### 12.1 QA 결과 표준

```text
PASS      실행했고 기대 조건을 만족
FAIL      실행했고 조건을 위반
BLOCKED   권한/도구/외부 상태 때문에 실행 불가
UNVERIFIED 실행하지 않았거나 과거 증거만 존재
```

`BLOCKED`와 `UNVERIFIED`를 `PASS`에 합산하지 않는다.

---

## 13. Luna/후속 모델용 작업 프롬프트 템플릿

```text
대상 저장소: C:\Projects\AIO
작업 패킷: H2-XX 하나만
권위 문서: _context/CODEX-SECOND-PASS-HANDOFF-2026-07-10.md

1. AGENTS.md, WORKFLOW-GOVERNANCE.md, INDEX.md, 관련 skill을 먼저 읽어라.
2. H2-00 방식으로 local/origin/live/Worker 기준선을 다시 고정하라.
3. 이 문서의 과거 발견을 그대로 믿지 말고 수정 전 실패를 재현하라.
4. 선택한 H2-XX 범위 밖 코드는 수정하지 마라.
5. index.html은 CODE-MAP으로 필요한 구간만 읽어라.
6. 변경 전에 실패하는 binary test 또는 fixture를 먼저 정의하라.
7. 구현 후 수용 기준을 항목별 Yes/No로 보고하라.
8. static/headless/browser/live 증거를 구분하라.
9. 버그 수정이면 BUG-POSTMORTEM/QA/RULES와 R1 버전 계약을 지켜라.
10. 커밋·푸시·배포는 사용자가 명시할 때만 수행하라.

최종 보고 형식:
- 기준선
- 재현한 실패
- 변경 파일
- 구현 요약
- 수용 기준 Yes/No
- 실행 게이트와 결과
- Tier 13 실행 여부
- live 검증 여부
- 남은 위험
- 커밋/배포 여부
```

---

## 14. 최종 인수인계 판정

이 프로젝트에 필요한 것은 기능 추가가 아니라 다음 세 가지다.

1. **로컬 진실을 라이브 진실로 폐쇄하는 운영 게이트**
2. **22페이지의 실제 사용자 경험을 실패 조건으로 만드는 QA**
3. **데이터 품질과 연구 신뢰도에 맞춰 UI 주장 강도를 낮추는 계약**

H2-01~H2-11이 닫히면 외부 사용자 베타/공개 품질을 판단할 수 있다. H2-12~H2-14가 닫히기 전에는 제품을 유용한 투자 정보 터미널로 표현할 수는 있어도, 검증된 수익 예측 또는 기관급 의사결정 엔진으로 표현해서는 안 된다.

이 문서는 작업 완료 선언이 아니라 **작업이 완료됐는지를 후속 모델과 사용자가 같은 기준으로 판정하기 위한 설계**다.
## 16. 2026-07-11 PC/노트북 실브라우저 3차 보강 진단

### 16.1 이번 보강의 범위와 증거

사용자 요청에 따라 모바일·태블릿을 우선순위에서 제외하고 다음 두 실제 Chromium viewport만 조사했다.

- 노트북: `1024×768`
- PC: `1440×900`
- route: 22개 전부
- 조합: 44개
- 방식: 로컬 서버에서 각 route에 실제 `showPage()` 실행, 400ms settle 후 DOM/화면/콘솔/요청/차트/표/컨트롤/텍스트 수집 및 viewport 스크린샷
- 원본 증거: `_artifacts/desktop-browser-audit/report.json`, `_artifacts/desktop-browser-audit/*.png`
- 진단 전용 수집기: `_artifacts/desktop-browser-audit.mjs` (제품 코드가 아님)

Codex 인앱 Browser는 `about:blank` 빈 탭 WebContents 생성만으로 앱이 종료되는 데스크톱 앱 결함이 재현됐다. 캐시 재생성·Windows 앱 복구 뒤에도 동일했다. 따라서 본 조사는 저장소의 Playwright가 실제 Chromium을 별도 프로세스로 구동하는 방식으로 수행했다. 이 방식은 DOM 에뮬레이션이 아니라 실제 브라우저 렌더링이지만, 사람의 눈·키보드·스크린리더 실사는 아니다.

### 16.2 44조합 기계 수집 결과

| 항목 | 결과 | 판정 |
|---|---:|---|
| route/viewport 조합 | 44/44 진입 | PASS |
| fatal/missing page | 0 | PASS |
| document 전체 가로 overflow | 0 | PASS |
| zero-size visible canvas | 0 | PASS |
| console/page error | 5 | FAIL |
| 노트북 clipped 요소 | 4 | FAIL |
| 화면 캡처 실패 | 2 | HARNESS WARN |

확정 오류·잘림:

1. `briefing` 노트북·PC: `[AIO:api] fred: warn → error {errCount: 3}`.
2. `fundamental` 노트북: Telegram Insider Tracking/BornLupin 각 6개 proxy 전부 실패.
3. `kr-supply` 데스크톱: Telegram WalterBloomberg 6개 proxy 전부 실패.
4. `sentiment` 노트북: Investors Intelligence canvas와 Put/Call canvas가 오른쪽 viewport 밖으로 잘림.
5. `macro` 노트북: FRED FEDFUNDS 12개월 canvas가 오른쪽 viewport 밖으로 잘림.
6. `screener` 노트북: 결과 table 우측이 viewport 밖으로 잘림.
7. screenshot 실패 0건(이번 실행에서는 font-ready timeout 재현 안 됨).

### 16.3 고빈도 Critical-10 정의

코드의 고정 계약과 사용자의 “종합 5 + 분석 5”는 다음과 같다.

| 그룹 | route |
|---|---|
| 종합 5 | `home`, `signal`, `breadth`, `sentiment`, `briefing` |
| 분석 5 | `technical`, `macro`, `fxbond`, `fundamental`, `themes` |

근거: `AIO.CRITICAL_PAGE_GROUPS`, `AIO_CRITICAL_10_PAGE_IDS`, `CRITICAL_5`, `ANALYSIS_5`, R187~R199. 이후 작업자는 이 10페이지를 나머지 12페이지보다 높은 release gate로 다뤄야 한다.

### 16.4 Critical-10 현재 시장 적합성 심층 판정

#### 공통 P0 — 서로 다른 시간축을 하나의 “오늘 판단” 카드에 혼합

Critical-10 상단 판정 카드들은 2026-07-11 화면에서 `2026-06-17` FOMC 해설과 `24일 경과`를 표시하면서 동시에 `데이터: 스냅샷`, 신뢰도 66~76%, 현재 시세, 당일 뉴스, AI 분석 버튼을 한 카드에 배치한다. 날짜는 보이지만 시각적 위계상 오늘의 결론으로 읽힌다. 6/17 FOMC 사실 자체는 현재 정책 기준을 설명하는 데 유효하며 FRED의 2026-06 월평균 EFFR 3.63과도 모순되지 않는다. 문제는 **사실의 오류가 아니라 오래된 이벤트 해설을 현재 매매 결론의 핵심 근거처럼 재사용하는 시간축 설계**다.

필수 구조 개편:

- `marketNow`: 최신 가격·변동성·breadth·심리
- `policyRegime`: 최근 정책 결정과 아직 유효한 체제
- `upcomingCatalysts`: 다음 CPI/FOMC/고용 일정
- `historicalContext`: 과거 이벤트 회고

네 블록을 분리하고 결론 엔진은 각 블록의 `asOf`, TTL, sourceKind, decisionUse를 검사해야 한다. `historicalContext`는 오늘 점수에 직접 가산하지 말고 설명 근거로만 사용한다.

#### C10-01 `home` — 공개 사용자 기본 화면으로 부적합

- 운영자 노트가 `2026-06-30 · 11일 경과` 상태로 첫 화면 최상단을 점유한다.
- PUBLIC STATUS가 `public-data가 6시간 이상 지연`, `확인 필요`, 미수신 항목을 기본 사용자에게 노출한다.
- 한 화면 안에서 “실시간 자동갱신”, 서버 snapshot 지연, 과거 이벤트 해설이 함께 보인다.
- 시장 판단 자체보다 운영 상태·개발 진단이 더 강한 시각적 우선순위를 가진다.

판정: 내부 운영 콘솔로는 유용하지만 외부 사용자의 첫 화면으로는 PUBLIC 차단. 운영자/개발자 상태는 별도 admin/debug surface로 이동하고 기본 화면은 `결론 → 근거 → 위험 → 다음 확인시각`만 남겨야 한다.

#### C10-02 `signal` — 설명 가능성·효능 문제

- 화면은 점수 65, `선별 진입 가능`, `52% 좋은 랠리`, 5개 팩터 가중치를 강한 매매 언어로 노출한다.
- 기존 WO-2 장기 검증에서 부분 재구성 점수는 21일/63일 forward return과 음의 상관을 보였다. 따라서 현재 점수는 성과 예측 신호로 홍보할 수 없다.
- 상단 FOMC 문맥은 24일 전이며, 현재 입력 4/13 확인 필요가 동시에 표시된다.
- 점수의 표시 팩터와 최종 점수 사이 감점·보정 항을 사용자가 완전히 재현하기 어렵다는 과거 live finding도 아직 핵심 위험이다.

판정: “매수 점수”가 아니라 `환경 체크리스트/리스크 허용도`로 격하해야 한다. 기여도 합계, 결측 패널티, 데이터 나이, OOS 효능을 한 화면에서 재현 가능하게 만들기 전 PUBLIC 매매 시그널 금지.

#### C10-03 `breadth` — 현재 국면 지표로 적절하나 추정치·스냅샷 경계 부족

- 5/20/50SMA 참여율, Weinstein Stage, McClellan은 시장 내부 확산을 보는 데 적절한 조합이다.
- 화면에 McClellan `(추정)`이 표시되는 점은 긍정적이나, 추정값과 실제 거래소 breadth 원자료의 차이·기준시각·계산 universe가 즉시 보이지 않는다.
- 상단 결론은 “참여도는 개선”인데 뉴스 비중이 커서 breadth 자체의 시계열·분포·전일 대비 변화가 첫 viewport에서 약하다.

판정: 지표 선택은 적합. 각 지표에 universe/산식/asOf/source/실측·추정 배지를 붙이고 1D·1W 변화와 가격 대비 divergence를 우선 노출해야 매매에 유용하다.

#### C10-04 `sentiment` — 동일 앱 내 F&G 값 충돌(P0)

- 상단 공통 strip·briefing은 F&G `49 중립`을 사용한다.
- sentiment 복합판정은 `Fear & Greed 31 — 공포 우세`를 사용한다.
- 코드에는 snapshot/fallback `fg:31`이 남아 있고 최신 `public-data/history.json` 2026-07-10 값은 `49`다.
- “정적 데이터 · 8일 전 기준 · 실시간 아님” 경고는 있으나, 같은 화면 체계가 최신값과 구값으로 서로 다른 투자 행동(중립 vs 관심종목 준비)을 제시한다.

판정: PUBLIC P0. 모든 F&G 소비자를 단일 EvidenceStore/current selector로 통합하고, historical series의 마지막 점과 headline 값이 다르면 페이지를 차단해야 한다. 결측 시 구값을 현재값처럼 fallback하지 말고 `현재 검증값 없음`으로 표시해야 한다.

#### C10-05 `briefing` — 시간 구조는 좋지만 FRED 실패와 오래된 공통 결론 혼합

- 2026-07-11 08:00 KST, 24h window, 다음 갱신시각, 기사 window가 명시돼 있어 시간 설계는 Critical-10 중 가장 낫다.
- 실제 브라우저에서 FRED가 노트북·PC 모두 error로 승격됐다.
- briefing 본문은 당일 가격/F&G 49를 쓰지만 상단 공통 결론은 6/17 FOMC 문맥을 다시 사용한다.
- FRED 실패 시 briefing이 어느 문장/지표를 제외했는지 사용자에게 명확히 표시되지 않는다.

판정: 조건부. source별 성공/실패/부분완료를 briefing 문장 단위 provenance로 연결하고, 실패한 macro 블록은 결론에서 자동 제외해야 한다.

#### C10-06 `technical` — 지표 선택은 적합, 현재 차트의 의미·외부 의존 분리 필요

- RSI/MACD/이평/가격 위치/Weinstein은 진입·추세 확인에 적합하다.
- SPY `$754`, 50MA `$728`, ATH `$759` 등의 label은 v52.52 수정 뒤 겹침 fatal은 사라졌지만 한 영역에 여전히 밀집돼 읽기 부담이 있다.
- 3M 수익이 `0.0%`로 표시되는 등 계산 불가/미수신이 실제 0으로 보일 위험이 남아 있다.
- TradingView iframe 요청은 외부 차단 시 abort됐다. 자체 차트와 외부 embed의 책임·fallback을 구분해야 한다.

판정: 조건부. `0`과 `missing`을 타입으로 분리하고, 차트 마지막 거래일·가격 원천·조정주가 여부·시장 휴장 상태를 차트 제목 바로 옆에 표시해야 한다.

#### C10-07 `macro` — 현재 국면 프레임은 유용하나 정책 이벤트와 데이터 주기 혼합

- 금리·인플레·달러·유가·고용의 연결은 현재 시장 해석에 적절하다.
- 6/17 FOMC 정책 레짐을 현재 기준으로 참고하는 것은 타당하지만 “이미 가격 반영” 같은 해설은 이후 24일간의 가격·고용·CPI 변화로 재검증되지 않았다.
- 노트북에서 FEDFUNDS chart가 viewport 밖으로 잘린다.
- FRED task는 briefing에서 실제 error를 냈으므로 macro 화면의 SOURCE 확인 배지만으로 성공을 단정할 수 없다.

판정: 조건부. 주기별 release calendar와 최신 observation date를 분리하고, macro narrative는 각 입력의 최신 발표 뒤 자동 재생성돼야 한다.

#### C10-08 `fxbond` — 매크로 선행지표로 적절하나 지연 상태에서 행동 문구가 강함

- DXY, 커브, 국채수익률, credit spread 조합은 주식 위험선호 판단에 적절하다.
- 페이지 자체가 `데이터: 지연`을 표시하면서도 “달러·금리·커브·크레딧 반응만 본다”, “주의: 달러 강세·금리 압박” 같은 현재 행동 문구를 유지한다.
- 지연 데이터가 어느 지표인지, 최신·지연이 섞인 경우 결론이 무엇을 제외했는지 불명확하다.

판정: PUBLIC 조건 미충족. 지연 source가 하나라도 결론 핵심 입력이면 confidence만 낮추는 것이 아니라 해당 주장과 행동 문구를 block/hold로 바꿔야 한다.

#### C10-09 `fundamental` — 첫 화면이 기업 분석이 아니라 뉴스 피드

- “17개 관점과 데이터 가용성부터 확인”은 정직한 방향이다.
- 첫 viewport에는 ticker 입력·기업 핵심 재무·17관점 availability matrix가 보이지 않고 일반 뉴스 피드가 대부분을 차지한다.
- SEC/FMP/Yahoo 배지를 표시하지만 실제 ticker를 선택하지 않은 상태에서 `DATA 확인`이 무엇을 검증했는지 모호하다.
- 외부 API 성공/키 없음/부분 데이터/filing 없음의 실제 사용자 흐름은 이번 로컬 외부차단 run에서 검증되지 않았다.

판정: 구조 개편 필요. 첫 화면은 `검색 → identity → 데이터 가용성 17/17 → 최신 filing/실적 asOf → 분석` 순서여야 하며 뉴스는 기업 선택 이후 하위 블록으로 이동해야 한다.

#### C10-10 `themes` — 경기 사이클 계산의 결측 중립화 의심(P0)

- 섹터 상대강도·breadth·뉴스 촉매를 함께 보는 프레임은 적절하다.
- 화면은 `Mid Cycle (Expansion)` 근거에 `VIX 15.4 · Breadth50 48% · 2s10s 0.00 · SPX up`을 사용한다.
- `2s10s 0.00`은 실제 평탄화일 수도 있으나, 현재 코드/화면 구조에서는 2Y 결측 또는 미갱신이 0으로 중립화됐는지 사용자가 구분할 수 없다.
- 페이지 자체는 `데이터: 지연`인데 강한 cycle label과 종목 전략을 제시한다.

판정: PUBLIC P0 후보. 2Y·10Y 두 leg의 값/asOf/source를 먼저 검증하고 하나라도 missing이면 cycle 분류를 `산정 불가`로 바꿔야 한다. cycle label은 검증된 입력만으로 재계산하고 전략 종목 문구는 delayed 상태에서 숨겨야 한다.

### 16.5 나머지 12페이지 요소 전수 점검 요약

| route | PC/노트북 실브라우저 판정 | 추가 심층 작업 |
|---|---|---|
| `market-news` | 진입·렌더 성공, 긴 동적 피드 | 중복·번역 실패·source 우선순위·기사시각/시장시각 분리 |
| `screener` | 노트북 결과표 잘림 | 모든 필터·정렬·행 클릭·빈 결과·100개 결측표현을 실제 상호작용으로 재검증 |
| `ticker` | 진입·정적 shell 렌더 | 실제 ticker 검색 성공/오류/부분 데이터/재검색/route roundtrip |
| `portfolio` | 44 controls/20 actions의 고복잡도 | 잠금·PIN·legacy migration·CRUD·재로드·가격 stale·AI 전송 경계 |
| `theme-detail` | `themes` canonical panel로 redirect | 실제 theme click별 panel 내용·뒤로가기·deep-link·빈 theme 검증 |
| `options` | orphan/reference shell 유지 | 외부 공개 내비게이션에서 제거 또는 참고자료로 명확히 고정 |
| `kr-home` | 렌더 성공, snapshot 비중 큼 | 장중/휴장/전일종가·KOSPI/KOSDAQ·환율 시간축 일치 |
| `kr-supply` | Telegram proxy 전체 실패 1건 | Naver/KRX/Telegram 각각 success/timeout/partial/fallback 및 table 기준일 |
| `kr-themes` | 렌더 성공, 결측 표현 다수 | 필터·정렬·상세 진입·종목 pill·실시간/스냅샷 분리 |
| `kr-macro` | 렌더 성공, 긴 snapshot 표 | 발표 주기·기준일·현재 국면 해설 재생성 |
| `kr-technical` | 3 canvas 렌더 | ticker 검색·캔들 마지막 거래일·조정주가·VKOSPI history provenance |
| `guide` | 31 sections, 8.2k visible chars | 현재 기능과 문구 parity, 사용자용 화면에서 로그 다운로드/초기화 제거 |

### 16.6 화면 요소 ↔ 프론트 ↔ 데이터/백엔드 역추적 기준

후속 모델은 각 visible element를 다음 12필드로 inventory해야 한다. DOM 개수만 세는 감사는 불충분하다.

```text
pageId / sectionId / elementId-or-selector / userQuestion / displayValue
sourceKind / sourceFamily / sourceEndpoint-or-file / transformFormula
asOf / freshnessSla / failure-and-fallback / decisionUse
```

주요 계층:

1. 화면/라우팅: `index.html`, `showPage()`, `aio:pageShown`.
2. 렌더/차트/상호작용: `js/aio-ui.js`, `data-action`, `_aioChartRegistry`, `_aioPageBus`.
3. 데이터/계산: `js/aio-data.js`, `DATA_SNAPSHOT`, `PriceStore`, `EvidenceStore`, `DATA_REQUIREMENT_PROFILES`.
4. 중앙 판단/감사/내러티브: `js/aio-core.js`, `AIO_PAGE_CONTRACTS`, Critical-10 audit 계열.
5. AI 설명: `js/aio-chat.js`, `CHAT_CONTEXTS`, freshness preflight.
6. 정적/누적 데이터: `public-data/data.json`, `history.json`, `screener.json`, Telegram/user research/operator note.
7. 수집/백엔드: `scripts/fetch-data.mjs`, GitHub Actions, `cloudflare-worker-proxy.js`, 외부 Yahoo/FRED/Naver/SEC/FMP/Finnhub/Anthropic.
8. 저장/개인정보: localStorage/safeLS, portfolio encryption, Worker server-key route.

### 16.7 구조 개편 및 근본 보강 설계

#### H3-00 단일 Currentness Graph

페이지별로 값과 해설을 따로 최신화하지 말고 다음 그래프를 SSOT로 만든다.

```text
source observation → normalized evidence → derived indicator → regime claim
→ page conclusion → action guidance → AI context
```

각 노드는 `value/asOf/source/status/confidence/dependsOn`을 가진다. upstream 하나가 stale/missing이면 downstream claim은 자동 `degraded` 또는 `blocked`가 된다.

#### H3-01 0/null/missing/delayed 타입 강제

- `0.00`, `0.0%`를 fallback 기본값으로 사용 금지.
- 실제 0은 `VALID_ZERO`, 미수신은 `MISSING`, 오래됨은 `STALE`, 일부만 성공은 `PARTIAL`.
- 점수·cycle·regime 계산기는 `VALID` 입력만 사용하고 minimum quorum 미달 시 산정 불가.

#### H3-02 Narrative Compiler

현재 해설을 인라인 문자열·오래된 이벤트 문장으로 유지하지 않는다. claim template + evidence dependency + expiry rule로 생성한다.

- 숫자 claim: 해당 evidence asOf 표시
- regime claim: 입력 전체 목록과 기준시각 표시
- 이벤트 claim: 발생/현재유효/예정 상태 분리
- action claim: stale/partial이면 자동 완화 또는 숨김

#### H3-03 Critical-10 release gate

다음이 모두 PASS일 때만 외부 공개 가능:

1. 10페이지 PC/노트북 실제 Chromium 진입·상호작용 PASS.
2. 동일 지표 cross-page 값/asOf/source 일치.
3. 모든 차트 마지막 점이 최신 유효 거래일과 일치.
4. chart series와 headline 값 일치.
5. stale/missing 입력이 점수·regime·action에 들어가지 않음.
6. external success/timeout/partial/malformed 4시나리오 PASS.
7. route 왕복 후 timer/listener/fetch/chart 증가 없음.
8. 점수·cycle·regime을 표시 입력으로 재현 가능.

#### H3-04 사용자 여정 기반 재배치

Critical-10 공통 정보 순서를 다음으로 통일한다.

```text
지금 결론 → 기준시각/시장상태 → 핵심 근거 3~5개 → 반대 근거
→ 무엇이 바뀌면 결론이 바뀌는가 → 사용자가 할 수 있는 행동
→ 상세 차트/뉴스/교육 → provenance/debug
```

운영자 상태, 장문 뉴스 피드, 개발 로그, API 진단은 기본 첫 viewport에서 제거한다.

### 16.8 Luna/후속 모델 실행 패킷

| 우선순위 | 패킷 | 범위 | 종료조건 |
|---|---|---|---|
| P0 | H3-A Cross-page truth | F&G, VIX, SPY/QQQ, breadth, 2s10s, Fed rate | Critical-10 동일값/asOf/source; F&G 31/49 충돌 제거; 결측 0 금지 |
| P0 | H3-B Claim expiry | 6/17 FOMC·운영자 노트·시장 해설 | historical/current/upcoming 분리, expired claim이 오늘 action에 기여하지 않음 |
| P0 | H3-C Derived regime safety | signal score, theme cycle, macro regime | 모든 입력 dependency 공개, missing/stale quorum 시 산정 차단 |
| P1 | H3-D Laptop geometry | sentiment/macro/screener | 1024×768 잘림 0, 핵심 차트/표 스크롤·축소 정책 통일 |
| P1 | H3-E External scenario | FRED/Telegram/FMP/SEC/Yahoo/Naver | success/timeout/partial/malformed fixture와 사용자 상태 PASS |
| P1 | H3-F Page journeys | 22 route | 모든 주요 click/filter/search/back/reload/empty/error 증거 |
| P1 | H3-G Backend lineage | 모든 visible numeric/chart/narrative | 12필드 inventory 100%, orphan sink/source 0 |
| P2 | H3-H Content hierarchy | Critical-10 | 첫 viewport가 결론·근거·위험 중심, 운영/debug 분리 |
| P2 | H3-I Human accessibility | Critical-10 | 실제 키보드·NVDA/스크린리더 수동 evidence |

### 16.9 현재 외부 공유 판정

| 단계 | 판정 |
|---|---|
| 내부 개인 사용 | 가능하나 F&G/점수/cycle/stale 문구를 매매 근거로 단독 사용 금지 |
| 제한 베타 | 보류 — P0 truth/claim/derived-regime 패킷 선행 |
| 일반 외부 공개 | 불가 |
| 성과·매매 신호 홍보 | 불가 |

핵심 이유는 페이지가 열리지 않아서가 아니다. 44개 PC/노트북 조합은 모두 열렸다. 문제는 **같은 화면 체계가 서로 다른 기준시각과 값으로 현재 시장을 설명하고, 일부 결측·지연 입력에서도 강한 regime/action 문구를 유지한다는 점**이다. 구조 개편은 UI 정리보다 먼저 currentness graph와 claim dependency를 바로잡아야 한다.

### 16.10 2026-07-11 H3-A 실행 결과 및 다음 순서

H3-A는 코드 덧붙이기식 병렬 경로가 아니라 기존 `AIO_OPERATIONAL_DATA_CONTRACT`/Evidence/decision 흐름 안에서 완료했다.

- `window.AIO.getCanonicalMetric('fg')`를 단일 currentness selector로 추가하고 `getCurrentMarketMetric` 별칭을 제공했다. 결과 envelope는 `value/source/sourceKind/asOf/fetchedAt/ageMs/freshness/status/confidence/allowedUse/reason`을 갖는다.
- F&G 생산자는 `_lastFGMeta`를 함께 기록한다. CNN live/proxy는 fetch 시각, 서버 지연값은 observation 시각, 스냅샷은 reference로 분리한다. 초기 UI가 스냅샷을 `_lastFG`에 복사하던 경로를 제거했다.
- home/signal/sentiment/briefing 및 pulse/risk/AI evidence, `computeTradingScore()`/`computeExecutionWindow()`/regime이 같은 selector를 소비한다. stale/reference 값은 표시 가능하지만 `allowedUse:false`이며 점수 입력은 중립화된다.
- 회귀 계약: T901~T904(실시간 우선·0 보존·스냅샷 매매 차단·stale 차단), runtime contract gate, headless **967/967 PASS**.
- PC/노트북 실 Chromium 재점검: 44/44 조합 진입, fatal 0, horizontal overflow 0, zero-size canvas 0. 기존 외부 FRED/Telegram 실패와 1024px sentiment/macro/screener clipping은 H3-D/E의 미완료 항목으로 유지한다.

후속 모델은 반드시 H3-B → H3-C → H3-D/E → H3-F/G → H3-H/I 순서로 진행한다. H3-A 완료를 이유로 일반 외부 공개 판정을 상향하지 않는다.

### 16.11 H3-B/H3-C P0 실행 결과

### 16.12 H3-D/H3-E P1 실행 결과

### 16.13 H3-F/H3-G P1 실행 결과

- H3-F: CDN Chart.js/DOMPurify/Lightweight Charts를 local app module보다 앞선 `defer` 순차 의존성에서 `async` progressive enhancement로 전환했다. CDN 실패 시에도 local `aio-*` module과 route router가 reload 이후 실행되며 기존 fallback chart path를 유지한다.
- 1024×768 Chromium journey: screener tab/profile/advanced filter/search, KR supply tab, KR themes filter roundtrip, guide search, browser back, `#screener` reload recovery를 실제로 통과했다. 이는 모바일 검증이 아니며 PC/노트북 경로만의 증거다.
- H3-G: `AIO.getPageContractAudit()`는 22/22 DOM/profile/refresh/deep/sequential contract 누락 0을, `AIO.getDataLineageAudit()`는 13 category, broken 0, cell-level orphan sink 0을 보고한다. Breadth gap 1과 static-macro manual 1은 자동화 완료로 위장하지 않고 기존 lineage inventory의 명시적 제한으로 남긴다.
- 회귀: T912(외부 CDN이 local boot queue를 막지 않음), T913(route/lineage/orphan contract), runtime H3-F/G check, Chromium journey artifact `_artifacts/desktop-journey-audit.json`.

- H3-D: sentiment/macro canvas가 Chart.js의 300px intrinsic width를 유지하지 않고 실제 1024px grid parent 폭에 맞도록 제한된다. screener ranking의 의도된 wide table은 `.aio-table-scroll` 안에 유지하고 `role=region`, `tabindex=0`, 한국어 가로 스크롤 label을 제공한다.
- H3-E: `AIO.normalizeExternalSourceState()`가 success/partial/timeout/malformed/unavailable를 동일 policy로 `allowedUse`/`usable`과 함께 정규화한다. API(`api:*`)와 Telegram RSS(`telegram:*`) 상태를 `AIO_EXTERNAL_STATES`에 기록하고, Telegram 슬롯은 정상/부분/외부 실패를 사용자에게 표시한다. 빈 외부 결과를 조용한 blank slot으로 남기지 않는다.
- 회귀: T907–T911, runtime-contract H3-D/E, headless **974/974 PASS**. 실브라우저 44조합은 **fatal 0 / horizontal overflow 0 / accidental clipped 0 / zero-size canvas 0 / screenshot failure 0**으로 종료했다. 남은 2건은 FRED API health가 반복 실패를 `warn→error`로 승격한 예상 가능한 외부 장애 신호이며, 사용자 화면의 상태 계약과 별도로 추적된다.
- 다음 순서: H3-F/G → H3-H/I. 이번 단계는 PC/노트북 범위만 다루며 모바일 개선을 확장하지 않는다.

- `window.AIO.getEventClaimState(eventId, nowTs)`를 기존 `AIO_EVENT_FRESHNESS_REGISTRY`에 연결했다. FOMC/이란·호르무즈/Apple CXMT 항목에 claim window를 부여하고 `CURRENT/AGING/EXPIRED/MISSING` 및 `allowedUse`를 계산한다.
- `_aioDefaultDecision()`과 `_aioApplyEventFreshnessGate()`는 만료된 사건을 `과거 참고`로 표시하고, 현재 action/decision의 근거로 사용하지 않는다. FOMC footer는 기존 30일 숨김 정책과 새 claim state를 함께 소비한다.
- trading-input critical missing이 3개 이상이면 숫자 스코어는 보존하되 모든 page decision을 `판단 보류 · 핵심 입력 부족 (스코어 N/100)`으로 바꾸고 실행 문구를 차단한다. tactical overlay가 이 차단을 덮어쓸 수 없도록 `decisionBlocked`를 반환·재검증한다.
- 회귀 계약 T905/T906, runtime contract H3-B/C, headless **969/969 PASS**. 이는 H3-D/E의 노트북 잘림·외부 success/timeout fixture 작업을 완료했다는 뜻이 아니다.
### 16.14 2026-07-11 H3-G/H3-H/H3-I results

- H3-G element lineage inventory was implemented for the Critical-10 routes. The handoff calls this a 12-field inventory but lists 13 fields; the full listed set is enforced: `pageId`, `sectionId`, `elementIdOrSelector`, `userQuestion`, `displayValue`, `sourceKind`, `sourceFamily`, `sourceEndpointOrFile`, `transformFormula`, `asOf`, `freshnessSla`, `failureAndFallback`, and `decisionUse`. Visible numeric/chart/narrative items report incomplete 0 and orphan sink 0; static copy is explicitly `reference-only`.
- H3-H content hierarchy: real Chromium at 1024×768 passed all 10 Critical-10 routes. Decision header/conclusion/evidence/status/action checks passed, with zero visible developer/debug surfaces. `.stale-badge` is treated as a legitimate status prelude and `data-aio-archive` reference content is not classified as developer surface.
- H3-I automated accessibility: accessible-name, focusability, positive-tabindex, canvas-name, and 36-step Tab traversal checks passed on all 10 routes. NVDA/manual screen-reader evidence and external CDN-success/external-data parity remain unverified.
- The CDN-loss Chromium audit found and fixed P675/R305: `initBreadthPage()` touched `Chart.registry` even when only the local partial Chart stub existed. T918 and the Chromium gate preserve the guard.
- Final gates: `node scripts/ci-runtime-contract-check.mjs` PASS; `node scripts/ci-headless-tests.mjs` **981/981 PASS**; `AIO_VIEWPORT_FULL_INIT=1 node scripts/ci-viewport-matrix-check.mjs` **88/88 PASS, worstOverflow 0px, jsErrors 0**; `node scripts/ci-critical10-human-surface-check.mjs` **10/10 PASS, consoleErrors 0**. Structural, UX-default, data-pipeline, semantic, workflow, skill, control-character, worker-security, version, and knowledge-lint checks also passed; doc-currency remained informational-only with the pre-existing CODE-MAP `aio-core.js` +534-line warning.
- Artifact: `_artifacts/critical10-human-surface-audit.json`; no deploy/commit performed.

### 16.15 2026-07-11 H2 second-pass execution ledger

로컬 기준선 이후 H2 작업을 순차 실행한 현재 판정이다. 이 섹션은 기존 설계 항목을 지우지 않고, 실행 결과와 외부 의존성을 분리해 기록한다.

| 항목 | 현재 판정 | 증거/남은 조건 |
|---|---|---|
| H2-00 | LOCAL_PASS | `scripts/ci-second-pass-baseline.mjs`, local `v52.59`; live/Worker revision은 별도 확인 필요 |
| H2-01 | DEPLOY_PENDING | GitHub Pages/Worker 운영 권한과 실제 배포 revision 확인 필요 |
| H2-02 | LOCAL_PASS | FULL_INIT 22×4 = 88/88, semantic settle, late rejection capture, jsErrors 0 |
| H2-03 | LOCAL_PASS | SVG 양끝 clamp + T921 fixture, viewport 88/88 |
| H2-04 | LOCAL_PASS | 공통 AI error envelope + T919/T920 + Worker `aioAiError` |
| H2-05 | LOCAL_PASS / LIVE_PENDING | Portfolio Vault PFE2-01~08 PASS; 실제 공개 배포 후 cross-reload 확인 필요 |
| H2-06 | LOCAL_PASS / DEPLOY_PENDING | explicit Pages allowlist, `og-image.svg`, `robots.txt`, `sitemap.xml`, manifest |
| H2-07 | LOCAL_PASS | content-truth audit, public GitHub Issues 경로, KR snapshot context T922/T923 |
| H2-08 | LOCAL_PASS | 19 NAV_ROUTE + 2 DERIVED_VIEW + 1 REFERENCE, canonical/history/hash T924/T925 |
| H2-09 | LOCAL_PASS_PARTIAL | 22 route intent/scenario registry와 priority review set; human visual density review는 별도 |
| H2-10 | LOCAL_PASS | 22/22 accessibility matrix, computed font <10px 0, nameless control/select/canvas 0, positive tabindex 0 |
| H2-11 | BLOCKED_EXTERNAL | Chromium evidence만 확보. Firefox/WebKit 바이너리 설치가 사용량 제한으로 거부되어 중단; NVDA는 human gate |
| H2-12 | LOCAL_PASS_PARTIAL | typed evidence envelope/T930 및 decision header `data-evidence-id`; 전체 10개 지표 cross-surface parity는 추가 data/live run 필요 |
| H2-13 | REDUCED_SCOPE_PASS | `score-backtest-longrun.json`의 fixed-rule/holdout/regime 결과 유지; PIT 입력·calibration·cost는 미충족 |
| H2-14 | REDUCED_SCOPE_PASS | factor artifact의 IC/ICIR/t-stat 유지; PIT universe/delisted/cost/adaptive-weight 검증은 미충족 |
| H2-15 | LOCAL_PARTIAL | portfolio/storage/snapshot/lifecycle/timer/chart 경계 audit T931; legacy direct storage/snapshot 전면 이전은 별도 패킷 |
| H2-16 | LOCAL_PASS | CHANGELOG/version note, doc currency, workflow compaction, knowledge lint 실행 |

최종 로컬 게이트: headless **992/992 PASS**, FULL_INIT **88/88 PASS**, accessibility **22/22 PASS**, Portfolio Vault **PFE2-01~08 PASS**, runtime/data/semantic/workflow/knowledge gates PASS. 실제 Pages/Worker 배포, live parity, Firefox/WebKit/NVDA는 이 로컬 결과만으로 완료 처리하지 않는다.
