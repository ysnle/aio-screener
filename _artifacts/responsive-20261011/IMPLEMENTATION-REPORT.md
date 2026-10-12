# v57.38 반응형·화면 정체성 통합 보고

## 결과

로컬 구현 및 실제 Chrome 화면 검증 완료. 새 커밋·푸시·배포는 실행하지 않았다. 기존 다른 Harness의 v57.37 배포와 원격 데이터 갱신은 보존했다. 최종 affected QA 결과는 아래에 기록한다.

## 통합 경계

- 시작 HEAD `42d3988f`, 작업 트리 clean. `integration-responsive-20261011` 세션 baseline을 캡처했다.
- 배포 SHA `115b924d4b2386ab789235209d52e554d8849646`는 코드 변경 없이 데이터 자동 갱신 1개 커밋이었다. `git fetch origin main` 및 `git merge --ff-only origin/main`으로 충돌 없이 가져왔다.
- 기존 [Pages 배포](https://github.com/ysnle/aio-screener/actions/runs/38136625010)와 [AI Worker 배포](https://github.com/ysnle/aio-screener/actions/runs/38136388436)의 success를 읽기 전용 확인했다. 공개 `/health`의 `configured`, `authorityReady`, `ready`, `paidWebSearchEnabled`가 true였다. 유료 모델 답변 품질이나 API 청구액 검증은 아니다.
- 이번 로컬 버전은 `bump-version.mjs v57.38`로 모든 버전 표면을 동기화했다.

## 수정한 표면

- `src/ui/styles/responsive.css`: 1100px 이하 메뉴 drawer, 700px 이하 한 열 콘텐츠, tablet 카드 두 열, 본문·차트·표의 로컬 폭 관리, 모바일 상단 상태/버전/도움말/AI 배치.
- `src/ui/components/responsive-shell.js`: 메뉴와 compact AI dialog의 배경 inert, Tab 순환, Escape, 닫기/화면 전환 후 포커스 복원, VisualViewport 입력 공간, observer/listener/RAF cleanup.
- `bootstrap.js`, `index.html`, Pages allowlist 및 asset manifest: 실제 수명주기와 CSS 배포 연결. 같은 19 legacy 라우트/8 메뉴 허브와 사용자 데이터 계약을 사용한다.
- version badge를 hidden 홈 제목에서 상단으로 옮기고 상단 VIX badge를 제거했다. VIX 자체는 시장 카드에 유지된다. 제품 AI 이름과 동적 legacy 재생성을 `AI 도우미`로 통일하고 BETA badge를 제거했다. 연구 근거·시각·행동 경계는 유지했다.
- NQ 현물 줄과 완료 종가 fallback/trend는 `^NDX/ndx`를 읽는다. 기존 시장 상태의 나스닥 종합지수 `^IXIC/nasdaq`는 유지했다. NDX를 browser quote demand와 Actions producer/history 선언에 추가했다. producer는 로컬 실행하지 않았다.
- ES/NQ/YM 선물 심볼에 현물 지수 숫자를 대신 반환하던 snapshot fallback을 제거했다.
- 공통 `[hidden]` 의미를 author flex 스타일보다 우선시했다. 선물 fallback 이중 숫자뿐 아니라 종목 기간 버튼·돌아가기 버튼의 같은 위험도 보호한다. `hidden=until-found`는 예외로 보존한다.
- 기존 P1608/P1609 후속: 양쪽 chat 호출부에 내부 참고자료 coverage를 전달하고 bootstrap에서 저장된 검색 OFF preference reader를 주입했다. 기존 자료가 충분하면 추가 검색을 피하고 부족하면 보강한다. 사용자별 검색 quota를 추가하지 않았다.

## 검증

| 증거 | 결과 | 범위 |
|---|---|---|
| 정적/오프라인 계약 | PASS | producer field-time, NDX 부재/존재 및 NQ 도착 후 fallback 전환, 실제 두 chat caller/Responses adapter, Worker 예산, syntax/architecture/workspace/ledger/trace |
| 통합 Chromium 반응형 | PASS | 19 라우트 × 390×844·768×1024·1024×768 = 57개 조합, 외부 요청 차단, 실제 main hook 사용(`isolatedInjection:false`) |
| 반응형 상호작용 | PASS | drawer·배경 inert·Escape·Tab, 테마, AI 패널/입력 폭·짧아진 viewport, 닫기 및 desktop 전환 포커스 |
| 기존 desktop matrix | PASS | 전체 QA의 1280/1440/1920 viewport, 접근성, 라우트 순회와 주요 업무 흐름 |
| 실제 사용자 Chrome | PASS | 모바일 한 열/태블릿 두 열·메뉴·라이트/다크·전체 폭 AI·닫기 포커스·OFF 재로드 보존 및 ON 변경. 검증 후 테마와 viewport 복원 |
| 독립 코드 검토 | PASS | 발견한 AI 닫기/desktop 전환 포커스 순서 결함 수정 후 격리 Chromium 재현. 남은 scoped P1/P2 없음 |

첫 전체 실행은 150 PASS, 1 FAIL, 0 SKIP였다. 실패는 T935가 이전 `AI 베타` 문구를 요구한 것이며, disclosure 기준시각/Evidence/원문 재확인 검증은 유지하면서 새 제품 이름으로 수정했다. `rerun-failed`에서 G094 통과했다. 그 뒤 최종 수정 파일을 명시해 affected QA를 실행했다.

정확한 명령:

```text
node scripts/qa-runner.mjs session-start --session integration-responsive-20261011
node scripts/bump-version.mjs v57.38
node scripts/record-fix.mjs _artifacts/responsive-20261011/record-responsive.json
node scripts/record-fix.mjs _artifacts/responsive-20261011/record-identity.json
node scripts/generate-workspace-state.mjs --write
node scripts/qa-runner.mjs full --no-cache
node scripts/qa-runner.mjs rerun-failed
$integrationTaskFiles = @(git diff --name-only | Where-Object { $_ -notlike '_artifacts/*' }) + @(git ls-files --others --exclude-standard -- src scripts)
node scripts/qa-runner.mjs affected --files ($integrationTaskFiles -join ',')
node scripts/generate-workspace-state.mjs --check
node scripts/ci-workspace-contract-check.mjs
node scripts/ci-knowledge-lint-check.mjs
node scripts/ci-skill-contract-check.mjs
node scripts/ci-skill-eval-fixture-check.mjs
node scripts/ci-ledger-integrity-check.mjs
node scripts/ci-assertion-trace-check.mjs
node scripts/sync-agent-profiles.mjs --check
node scripts/sync-agent-skills.mjs --check
git diff --check
```

전체 최초 보고: `.cache/aio-qa/runs/2026-10-11T11-51-08-243Z-33020-x0ogsi.json`.
실패 재검증 보고: `.cache/aio-qa/runs/2026-10-11T11-59-39-476Z-28944-f5wjp2.json`.
반응형 보고/캡처: `_artifacts/responsive-browser/report.json` 및 이 폴더의 `chrome-phone-light.png`, `chrome-phone-dark.png`, `chrome-phone-ai.png`, `chrome-tablet-light.png`.

## 미검증·제한

- 실제 iPhone/iPad Safari·소프트 키보드·VoiceOver는 미검증이다. 로컬 Chromium의 크기와 짧아진 viewport 테스트를 실물 장치 PASS로 승격하지 않았다.
- 시세 31,108.75와 증권앱 31,123.25는 14.50포인트 차이지만 같은 월물·관측 시각인지 알 수 없다. 무료 시세 경로는 선물 월물을 보존하지 않아 최신/동일 계약 가격으로 확정할 수 없다. [CME 공식 규격](https://www.cmegroup.com/markets/equities/nasdaq/e-mini-nasdaq-100.html)은 NQ의 Nasdaq-100 기초자산과 0.25 tick만 확인한다.
- NDX 자료가 없으면 IXIC로 대체하지 않는다. NDX history는 다음 승인된 배포 후 Actions 갱신으로 생성되며, 이번에 로컬 데이터를 만들어 채우지 않았다.
- 실제 유료 AI/검색 호출, 모델 답변 품질·청구액, 변경된 v57.38의 외부 배포 검증은 미실행이다.
- 지식 lint의 역사 문서 인코딩 2건과 오래된 연구 문서 1건은 기존 WARN으로 남아 있다.

## 최종 QA

최종 affected는 148 PASS / 12 CACHED / 0 FAIL / 0 SKIP (426초)이다. 결과: `.cache/aio-qa/runs/2026-10-11T12-00-28-036Z-11188-9b6b02.json`. Headless 1147/1147, 실제 훅을 사용한 반응형 57개 조합이 통과했다. 현재 배포 사이트는 v57.37이며 이번 변경은 로컬 작업본이다. 후속 Finviz 비교·용어사전·AI 자료 연결 작업은 별도 보고서로 기록한다.
