# 공용 연결·Worker 구조 개선 및 작은 화면 평가 — 2026-10-11

## 결과: WARN / 전체 QA 미통과

로컬 main v57.35에 구현했다. 기존 dirty 작업을 보존했으며 commit/push/deploy, GitHub 알림 해제·PR 병합, 토큰 등록은 하지 않았다. 작업 경계는 `worker-structure-20261011` content-hash 세션이다.

전체 로컬 QA 최초 실행은 120 PASS / 4 FAIL / 25 SKIP. 코드 원인인 decomposition·chat-resilience는 수정 후 동일 실패 배치 재검사에서 PASS. 기존 데이터의 data-refresh·data-lineage는 FAIL을 유지한다. 따라서 배포 가능 또는 전체 기능 정상으로 인증하지 않는다. 이후 변경한 연결/공시 소비 검사는 PASS, syntax PASS, generated-state/workspace-contract 재검사 PASS다.

## 구현·수정한 영역

- `src/data/providers/entity.js`, bootstrap, AI: 화면과 AI가 같은 공용 SEC 캐시를 읽는다. FMP 키가 없어도 지원되는 종목의 연간 공시 자료를 전달한다. FY와 TTM을 구분하고, 누락·손상·미래 가용 시각은 보류한다. 보고된 0은 유지하고 금액 단위는 USD로 전달한다.
- `src/data/providers/earnings.js`: 공용 일정은 실제 날짜 범위 안에서만 재사용한다. 수집 시각과 관측 시각을 구분한다. 현재 아티팩트는 10/05~09이므로 오늘부터 60일의 다음 실적일 제공을 보장하지 않는다. 해당 구간은 개인 Finnhub 또는 자료 없음으로 남는다.
- AI: 근거 없는 필수 17개 분석 관점·해자 등급·다년 추세 지시를 줄였다. 실제 자료와 기간·출처에 따라 분석하고 없는 수치를 만들지 않도록 정리했다. 근거 없는 FMP 필수 레지스트리도 바로잡았다.
- 검색: Google 요청에 계획의 정확한 기간과 허용 도메인을 전달하고, HTTPS 및 실제 호스트를 검증한다. Google CSE를 신규 가입 권장 기능에서 기존 계정용 연결로 바로잡았다.
- Worker/설정: 서버 준비 상태와 호출자 토큰 수락을 분리했다. 새 native 연결 패널이 공용 AI·공용 자료 상태와 확인 버튼의 DOM/이벤트/해제를 소유한다. PIN은 저장된 개인 키 보호이며 공용 AI 이용 조건이 아님을 안내한다.
- 운영 계약: 필수·선택 토큰 및 FRED 개인 조회 정책을 수정하고, 비밀값을 읽지 않는 `check-worker-setup.mjs`를 추가했다. js-yaml을 5.4.2로 갱신했고 npm audit은 0 vulnerabilities다.
- 리뷰: 새 SEC 포맷터의 날짜 fail-open과 통화 단위 누락을 재현하고 수정했다. 회귀 검사는 P1607에 연결했다. 신규 패널 마크업을 native 모듈로 옮겨 shell 증가를 피했고 감소한 legacy 파일의 decomposition 기준을 생성기로 강화했다.

## 검증 및 증거 수준

| 수준 | 실제 결과 |
|---|---|
| 정적 / Tier 1 | full의 버전·구조·workspace/knowledge/skill/ledger/assertion/릴레이/배포 계약 PASS. 코드 실패 2개 수정 후 PASS. 생성 상태 갱신 후 관련 2개 gate PASS |
| Runtime / offline | connection-access PASS: 실제 무키 AI 소비·동일 캐시·FY/0·가용 날짜·통화·caller 거절·검색 호스트/기간·캘린더 범위. Worker 88 assertions PASS, relay PASS, research-flow 66 assertions PASS |
| 실제 Chrome / Tier 13 | 로컬 v57.35 홈, 연결 패널과 확인 버튼, 설정 펼침, PIN/CSE 문구 확인. 다크 전환→새로고침 후 body.dark-theme 유지→라이트 복귀 확인. 비밀키 입력·유료 AI 요청 없음 |
| Live 공개 Worker | 공용 AI ready=true, 배포 revision v57.32. 빠른 시세 16/16 및 cron 관측, schedulerDispatch token-not-configured. 공개 fastQuotes enabled=false 유지 |
| 미검증 | Cloudflare 계정 내부 Secret/Binding 실제 값·권한·만료, AI 남은 예산·답변 품질, 실제 iOS Safari·터치·가상 키보드, 전체 라우트의 작은 화면 사용성 |

Chrome 로컬 origin에서 Worker 연결 확인은 실패 상태를 정확히 표시했다. 운영 Pages origin을 기준으로 한 공개 health 준비 상태와 별개의 결과다. 콘솔에는 기존 snapshot/proxy 경고가 있어 브라우저 전체 무경고 PASS로 보고하지 않는다.

## 남은 FAIL과 차단

- data-refresh: 기존 `data.json`/시장 스냅샷이 12h SLA를 넘었고 일부 시장 지표도 freshness 기준을 넘었다.
- data-lineage: 기존 data.json live-core 최신성 실패. 날짜만 수정해 최신으로 만들지 않았다.
- 이 실패 때문에 full의 상위 browser shard 25개는 SKIP이었다. 전체 브라우저 인증으로 바꾸지 않는다. 생산자는 GitHub Actions에서만 실행한다는 저장소 경계를 유지했다.
- 공용 일정만으로 오늘 이후 모든 실적 날짜를 제공하는 것은 미완료다. FMP 세그먼트·추정치 등 공용 자료의 실제 공백도 남는다.
- GitHub 원격 Dependabot/CodeQL 알림은 로컬 수정으로 자동 해제되지 않는다. 이전 알림 분류는 `../github-api-review-20261011/REVIEW.md`를 따른다.

## Worker 토큰: 무엇을 누가 입력하는가

일반 사용자는 공용 AI를 위해 OpenAI/Cloudflare/GitHub 운영 토큰을 입력하지 않는다. GitHub Secret **이름** 점검상 CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, AIO_QUOTES_KV_ID, OPENAI_API_KEY, AIO_AUTOMATION_TOKEN이 존재한다. 존재 여부만 확인했으며 값·권한·만료를 인증한 것은 아니다. FRED/FINNHUB/TWELVE_DATA Actions 키도 존재하며 개인 브라우저 키와 다른 경로다.

미설정은 `AIO_REFRESH_DISPATCH_TOKEN`이다. Worker가 GitHub 수집 워크플로를 호출하는 보조 자동 갱신 경로용이며 기본 AI 토큰은 아니다.

1. GitHub 개인 Settings → Developer settings → Personal access tokens → Fine-grained tokens.
2. Repository access에서 `ysnle/aio-screener`만 선택. Repository permissions의 **Actions: Read and write**와 만료일 설정.
3. 저장소 Settings → Secrets and variables → Actions → New repository secret에 이름 `AIO_REFRESH_DISPATCH_TOKEN`으로 저장.
4. 이후 명시적으로 승인된 data-plane 배포가 Worker `GITHUB_DISPATCH_TOKEN`으로 연결한다. 이번 작업은 등록·배포하지 않았다.

토큰은 채팅이나 사이트의 개인 데이터 키 입력란에 넣지 않는다. `AIO_CRON_SECRET`은 수동 관리 호출용 선택 설정, `AIO_DEV_ORIGINS`는 로컬 개발 origin 허용용 선택 설정이다. `AIO_APP_TOKEN`은 공개 앱 식별 표식이며 개인 로그인 비밀키가 아니다. 운영 예산 조회용 `AIO_OPERATOR_TOKEN`은 선택 비공개 자격증명이다.

권한 근거: [GitHub workflow dispatch 문서](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event).

## API의 중요성과 선택 조건

Finnhub/Twelve Data/FMP는 중요한 제공자다. 다만 AIO의 공용 수집 경로와 지원 범위의 SEC/공개 자료를 먼저 이용하므로 모든 이용자가 키를 입력하는 것은 아니다. 공용 자료가 제공하지 않는 기능은 해당 개인 제공자 키와 계정 권한이 실제로 필요할 수 있다. “선택”은 추가 기능까지 항상 무키로 작동한다는 의미가 아니다.

Google CSE는 검색 링크·스니펫 발견용이다. [Google 공식 문서](https://developers.google.com/custom-search/v1/overview)는 신규 고객 폐쇄와 기존 고객의 2027-01-01 전환을 안내한다. 새 키 발급을 요구하지 않는다. [OpenAI 웹검색](https://developers.openai.com/api/docs/guides/tools-web-search)은 별도 도구 설정을 통한 대체 후보지만 기본 AI 키만으로 자동 활성화되지 않는다. [가격](https://developers.openai.com/api/docs/pricing)은 검색 호출 1,000회당 $10에 검색 내용 토큰 비용을 추가한다. 현재 AIO 월예산 정책에 따라 유료 웹검색은 꺼 둔다. 현재 모델·운영 환경에서의 실제 검색 품질/호환성 테스트는 하지 않았다.

## 모바일·아이패드 평가

이는 Chrome viewport 평가이며 실제 iPad/iPhone 기기 검증이 아니다. responsive 코드·제품 지원 범위는 변경하지 않았다.

| 화면 폭 | 현재 관찰 | 복구 판단 |
|---|---|---|
| 1024×768, 메뉴 열림 | 본문 804px. 주요 내용은 읽히지만 일부 KPI 카드가 우측에서 잘림 | 아이패드 가로부터 중간 규모로 접근 가능 |
| 1024×768, 메뉴 닫힘 | 본문 1024px. 홈의 주요 카드 4개를 함께 읽을 수 있음 | 기본 열람은 가능하며 전 화면 검증은 별도 |
| 768×1024, 메뉴 열림 | 본문 548px. 줄바꿈·카드 잘림 증가 | 메뉴와 카드/차트 배치 조정 필요 |
| 390×844, 메뉴 열림 | 본문 170px. 읽기 불편 | 현재 최적화되지 않음 |
| 390×844, 메뉴 닫힘 | 전환 완료 후 본문 390px. 상단 도구와 KPI 잘림, 긴 세로 화면 | 휴대폰 전체 지원은 중간~큰 작업 |

초기 메뉴 접힘 관찰은 전환 애니메이션 중이어서 본문 폭이 그대로로 보였다. 전환 완료 후 390px로 확인했으며 사용자에게 정정했다. 이미지: `ipad-landscape.jpg`(메뉴 닫힘), `phone-menu-closed.jpg`. 임시 viewport를 원래 크기로 복원하고 메뉴·라이트 테마도 처음 상태로 돌렸다.

데이터·API·분석 로직은 재사용할 수 있다. 제거한 옛 모바일 코드를 그대로 복원하기보다는 현재 8개 화면 구조에 메뉴·터치 목표·표/카드·차트·AI 패널·키보드를 맞추는 편이 적절하다. 아이패드 우선 후 휴대폰 순서가 현실적이다. 현재 desktop-only 계약·QA 기준을 작은 화면 지원 결정과 함께 변경해야 한다.

## 실행한 주요 명령과 보고서

- `node scripts/qa-runner.mjs full --no-cache` → `.cache/aio-qa/runs/2026-10-11T06-45-23-476Z-20256-cvvbgs.json`
- `node scripts/qa-runner.mjs rerun-failed --report .cache/aio-qa/runs/2026-10-11T06-45-23-476Z-20256-cvvbgs.json` → 코드 2 PASS / 기존 데이터 2 FAIL, run `2026-10-11T06-51-22-866Z-25128-ysqooa`
- `node scripts/qa-runner.mjs rerun-failed --report .cache/aio-qa/runs/2026-10-11T06-52-28-909Z-26984-cgw9f8.json` → generated-state/workspace-contract 2 PASS, run `2026-10-11T06-53-32-833Z-10464-t2qetm`
- `node scripts/ci-connection-access-check.mjs`, `node scripts/ci-chat-resilience-check.mjs`, `node scripts/ci-assertion-trace-check.mjs`, `node scripts/ci-syntax-check.mjs` → PASS
- `node --test worker/openai-contract.test.mjs` → 88 assertions PASS; `node scripts/ci-worker-relay-check.mjs`, `node scripts/ci-research-flow-contract-check.mjs` → PASS
- `node scripts/ci-decomp-hotspot-check.mjs --write`, `node scripts/generate-workspace-state.mjs --write`, `git diff --check`
- `node scripts/check-worker-setup.mjs --github` → `worker-setup.json`; secret names/public health only

## 완료 경계

공용 연결·개인 키·검색·AI 소비·운영 문서 개선은 로컬 구현 및 위 범위로 검증했다. 전체 QA 인증, 전체 기능·자료 충족, 모바일 최적화, 원격 배포와 토큰 provisioning은 완료로 보고하지 않는다.
