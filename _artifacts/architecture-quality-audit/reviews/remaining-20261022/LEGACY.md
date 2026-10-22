# 남은 legacy 3파일 전문 감사

MODE: review | VERDICT: FAIL (기존 결함 재현) | REF: `7e2411432f6ca0e5f02528b209b013bf5f7ff2dc`

검증된 원인 묶음 3건: 과거 BND-01 재검증 1건, 이번에 구체 반례를 보강한 한국 필터·위험 계산 응답 수명주기 2건. 모두 REF 이전부터 존재하는 코드다. A04/A05/A20은 신규 수에 더하지 않는다. 제품 변경 요청이나 전체 제품·배포 인증이 아니다.

## 범위와 읽기

`js/aio-workspace.js` 2,462행, `js/aio-pages.js` 1,803행, `js/aio-kr-data.js` 1,941행을 고정 blob에서 전문으로 읽었다(끝의 빈 행 포함 6,206행). 출력이 잘린 workspace 267–549와 pages 1574–1601은 작은 범위로 다시 읽었다. 전체 상태는 [legacy-reading.tsv](./legacy-reading.tsv)에 기록했다. 3파일은 현재 작업 트리의 SHA-256과 모두 같고 `git diff REF -- <3파일>`도 비어 있다. 현재 HEAD는 검사 당시 `659ffbad252f9eeacfa49a6ad1b895df87f66597`이며 전체 작업 트리는 dirty다. 이 동일성은 이 3파일만의 사실이다.

재현 명령: `node _artifacts/architecture-quality-audit/reviews/remaining-20261022/legacy-probe-runtime.mjs` → exit 0. [JSON](./legacy-probe-runtime.json), [로그](./legacy-probe-runtime.log), [실행 코드](./legacy-probe-runtime.mjs)를 함께 보존한다. exit 0은 반례와 양성·음성 대조가 기대한 대로 재현됐다는 뜻이다. 제품 정상 PASS가 아니다. 기본 Playwright 번들 실행 파일이 없어 첫 시도는 실패했고, 설치된 Chrome의 새 임시 프로필로 실행했다. 브라우저의 모든 네트워크 요청은 차단했다.

## LEGACY-01 / BND-01 — [ACT ON][P2][PRE-EXISTING] 관심목록 A의 지연 추가가 활성 B를 수정하고 B 초안을 지움

- 근거: `js/aio-workspace.js:1853–1879`. 1854에서 읽은 `activeId`를 1863의 비동기 확인 콜백이 보존하지 않고 `addToWatchlist(..., true)`를 재호출한다. 재호출은 현재 활성 목록을 다시 읽고 그 목록에 쓰며 입력 필드도 비운다.
- 현행 caller: `index.html`의 `#wl-select` → `switchWatchlist`(1845–1850), `#wl-add-ticker` Enter/추가 버튼 → `addToWatchlist`. `src/app/compatibility-globals.js:176–178,208–215`의 unknown symbol은 `checkListed` → `src/data/us-listings.js:60–78`의 artifact load를 기다린다. 요청 중 목록 전환을 막는 UI·코드가 없다. 고정 artifact의 UFPT는 listing index 11517, UFP Technologies, Inc.이며 core screener-universe에는 없다. 세션에 이미 알려졌거나 listing이 캐시된 경우 대기 창은 짧아진다.
- 격리 반례: 실제 workspace 전문을 VM에 평가하고 `_aioAcceptSymbol`의 응답만 Promise로 지연했다. A에서 UFPT/A note 요청 → `switchWatchlist`로 B → B 입력에 MSFT/B draft → 확인 성공. A는 빈 상태, B에 UFPT/A note 저장, B의 두 입력은 빈 문자열이다. 요청 중 A를 삭제해도 B에 저장된다.
- 대조: A 유지 시 A에 저장, 심볼 거절 시 A/B 모두 미변경이며 B 초안 유지. 실제 사용자 localStorage를 사용하지 않았다. 새 브라우저에서 실제 listing 네트워크 지연까지 재현한 증거는 아니다.
- 최소 대안: 최초 목록 ID와 입력값을 요청에 묶고, 응답 시 그 목록이 여전히 존재하는지 검사한다. 폼이 다른 목록/다른 입력으로 바뀌면 그 폼을 비우지 않는다. 목적 목록이 사라졌으면 명시적으로 취소한다.

## LEGACY-02 — [ACT ON][P2][PRE-EXISTING] 한국 테마의 시세 갱신이 선택 필터와 포커스를 초기화

- 근거: `js/aio-kr-data.js:15–25,82–93`은 카드의 inline display만 변경한다. 선택한 heat/sector를 상태로 보존하지 않는다. `html-kr-live`(120–126) → `initKoreaThemes`(132–140) → `renderKrThemeCardsFromMap`의 `container.innerHTML = html`(331)이 모든 카드를 교체한다. 필터 버튼의 active/aria-pressed는 컨테이너 밖이라 그대로 남는다.
- 현행 도달성: `index.html`의 `#kr-integrated-themes`는 `data-user-fold`이며 내부 실시간 테마 fold를 일반 사용자가 열 수 있다. dev-only인 한국 macro/technical과 구별한다. `#kr-theme-container`의 펼침은 core `_aioEnsureKrThemeProgressive`/더 보기 버튼(현재 core 18510–18524)으로 가능하다. 고정 shell에도 같은 한국 필터 버튼이 있다.
- 격리 Chromium DOM 반례: 실제 kr 파일 전문, 실제 등록된 `aio:liveQuotes` listener, 실제 `initKoreaThemes`/renderer를 실행했다. 외부 데이터 대신 모든 한국 구성 종목에 유한 시세를 넣고 defense 구성만 +4%로 설정했다. 실제 progressive CSS를 적용하고 더 보기를 펼친 조건이다. hot 선택 후 보이는 카드 2개 → liveQuotes 한 번 뒤 28개, hot의 aria-pressed는 true. tech 선택 5개 → 같은 갱신 뒤 28개, tech aria-pressed도 true다. 모든 필터를 전체로 돌린 뒤 헤더에 focus → liveQuotes → activeElement BODY도 관측했다.
- 같은 원인의 추가 반례: hot를 누른 뒤 tech를 누르면 hot는 선택된 채 tech 5개 전체가 보인다. 두 필터는 교집합을 만들지 않고 마지막 필터가 앞 필터의 display를 덮는다. 별도 결함 수로 늘리지 않았다.
- 경계: 전체 앱·실데이터·휴대폰·태블릿 통합 브라우저는 이번에 실행하지 않았다. 2→28은 펼친 isolated DOM에서의 결과다. 기본 접힘 상태의 수나 실제 시세 갱신 간격을 이 수치로 인증하지 않는다.
- 최소 대안: heat/sector 두 선택 상태를 보존하고 하나의 predicate로 렌더 뒤 재적용한다. 현재 선택된 카드·헤더를 유지하거나 교체 후 같은 themeId의 포커스를 복원한다. 필터 상태를 지우는 설계라면 버튼의 선택 표시도 함께 바꿔야 한다.

## LEGACY-03 — [ACT ON][P2][PRE-EXISTING] 늦게 끝난 위험 계산이 새 구성의 보류를 덮음

- 근거: `js/aio-workspace.js:1009–1046`은 최초 positions와 DOM el을 잡고 Yahoo 이력을 기다린다. 이후 1048–1159의 보류/게시와 `_lastPortfolioRiskEstimate`에 요청 epoch·현재 구성 일치 검사가 없다. `refreshPortfolioTechnicalRisk`의 비슷한 패턴은 읽었지만 이 finding의 실행 증거로 합산하지 않았다.
- 현행 caller: portfolio 진입 hook(2031–2042)의 500ms 지연 자동 계산과 `index.html`의 `data-action="refreshPortfolioRisk"` 계산 버튼. 구성 추가·삭제는 대기 중에도 가능하고 `savePortfolioData`는 `aio:portfolioChanged`를 발행한다. 위험 요청을 취소·무효화하는 listener는 해당 함수에 없다. 계산 설정 변경도 182/272에서 재계산을 시작한다.
- 격리 VM 반례: 실제 workspace 전문과 실제 `refreshPortfolioRisk`/`_renderRiskMetrics`를 평가했다. A 구성 계산의 chart Promise를 보류 → fixture 구성을 B로 바꾸고 두 번째 계산 → B 이력 미수신 안내 표시 → 첫 A 응답을 완료. 최종 구성은 B인데 화면은 A 계산 결과의 지표·표본으로 교체되고 `_lastPortfolioRiskEstimate.snapshot.ticker`는 A, 렌더의 계산 식별자는 `book:A`였다.
- 경계: 이력 전송과 위험 입력 조립기만 fixture로 대체했으며 solver 정확도·특정 VaR 수치·실제 사용자 계좌 손실을 입증한 것은 아니다. 실제 함수의 응답 순서와 게시 대상을 검증했다. 거래·계좌·실제 보유 내역을 수정하지 않았다.
- 최소 대안: 요청 번호와 구성 fingerprint를 시작 시 캡처하고, await 이후 모든 성공/보류 게시 전에 최신 요청·현재 구성과 대조한다. 더 최근 요청이나 구성 변경 후의 응답은 DOM과 공유 결과에 쓰지 않는다.

## 기존 발견과 제외한 후보

| 항목 | 이번 상태 | 이유 |
|---|---|---|
| BND-01 | REPRODUCED_AT_FIXED_REF_AND_CURRENT_IDENTICAL_BYTES | 위 LEGACY-01의 전환/삭제/거절 대조로 보강. 신규 수로 중복 계수하지 않음. |
| A04 KST 실적 날짜 | SOURCE_PERSISTENCE_ONLY | pages 299–307,348–363의 local weekday/UTC date 혼합이 그대로 있음. 기존 A04의 08/09시 실행 증거를 참조하며 이번에는 재실행하지 않음. |
| A05 한국 결측 | SOURCE_PERSISTENCE_ONLY | kr 379,405,421,478–481의 미수신→0/진단 분기가 그대로 있음. 이미 검증된 A05이므로 새 finding 아님. |
| A20 가짜 30일 벤치마크 | OUTSIDE_THIS_EXECUTION_SCOPE | 해당 함수는 별도 UI 파일 소유. 이번 3파일 전문으로 해결·재검증을 주장하지 않음. |
| 비용·통화 legacy 도넛/테이블 | DISMISSED_AS_CURRENT_SURFACE_CLAIM | pages 24의 native canvas guard, workspace 735/797의 native table guard를 확인. guard를 강제로 끈 계산을 일반 사용자의 현행 결함으로 올리지 않음. |
| 세분화 테마의 null→0/거래 문구 | DEV_SURFACE_ONLY | pages 1249–1253,1349–1368,1675–1744는 읽었으나 shell의 `themes-subthemes-advanced`는 개발자 전용 fold다. 일반 사용자 결함 수에서 제외. |
| 한국 macro stress/금리차·원인 단정 | DEV_SURFACE_ONLY | kr 111–126의 dev mode 조건과 shell data-dev-only를 확인. 일반 사용자 결함으로 승격하지 않음. |
| SEC Frame cache 반환형 불일치 | NOT_PROMOTED | kr 1338–1340의 cache-hit 배열/1375의 miss 객체는 다르지만 소비자 보고서가 현재 사용자에게 미치는 구체 영향까지 검증하지 않았으므로 확정 수에서 제외. |

## 판단과 한계

구조 이관 자체보다, 각 요청이 어느 목록·어느 구성·어느 필터 선택에 속하는지를 보존하는 최소 보완이 우선이다. native guards와 이미 분리된 ledger/FX/domain 모듈을 유지할 근거는 있으며, 3개 legacy 파일의 전면 재작성 필요성은 입증되지 않았다. 문구·색만으로 상태를 교정하면 위 상태 경합은 남는다.

3개 제품 파일의 고정 blob SHA와 SHA-256은 원장/JSON에 보존했다. caller는 지정 구간만 읽었고 전문 완료로 계산하지 않았다. 증거 단계는 소스 추적 + 격리 VM/Chromium DOM이다. 현재 전체 제품, live 배포, 공식 데이터 현재성, 투자 정확도, 전체 responsive/WCAG 인증은 미검증이다. 독립성은 부모가 통합하는 병렬 감사 중 한 lane으로서 `limited`다. 추가 agent나 외부 모델 호출은 하지 않았다.

산출물 4개(보고서/TSV/실행코드/JSON)와 실행 로그만 작성했다. 제품·사용자 계좌 상태·producer·build/generate·동기화·버전 변경·Git commit/push/deploy·유료 AI·외부 전송은 실행하지 않았다.
