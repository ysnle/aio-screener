# GitHub 알림과 개인 API 연결 확인

확인일: 2026-10-11 KST. 원격 저장소 ysnle/aio-screener 및 공개 서비스의 읽기 전용 확인. 로컬 v57.34 변경과 원격 배포 상태는 별개다.

## GitHub 확인 결과

| 항목 | 확인 결과 | 의미와 후속 작업 |
|---|---|---|
| 열린 이슈 | 2개 | #16 종목 유니버스, #17 공식 거시 일정의 월간 검토 요청. 자동 생성된 운영 검토이며 장애 보고가 아니다. 후보 날짜·편입 종목은 공식 출처 확인 후 적용해야 한다. |
| 열린 PR | 3개 | 모두 Dependabot. 충돌 없이 병합 가능하지만 검사 실패가 있으므로 병합 준비 완료 상태는 아니다. |
| Dependabot | 2개 | 개발·CI 의존성 js-yaml 5.2.1의 CPU 소진 취약점. High 1개, Medium 1개. 업데이트 필요. |
| Code scanning | 64개 | Critical 1, High 60, Medium 3. 경고 목록 전체를 수집했고 대표 5건의 소스를 검토했다. 64건 전체의 악용 가능성 검증은 미완료. |
| Secret scanning | 열린 경고 0개 | 조회 시점에 탐지된 열린 경고가 없다는 뜻이며, 모든 과거 키 노출이 불가능하다는 보장은 아니다. |
| 저장소 보안 권고 | 0개 | 저장소의 security-advisories 조회 결과. Dependabot 경고와는 별도다. |
| 최근 Actions | 최근 35개 모두 성공 | 최신 main CI·CodeQL·Pages·데이터 수집 성공. CI 통과와 기존 보안 경고 해소는 별개다. |
| 저장소 알림 기록 | 1,619개, 미읽음 1,617개 | CheckSuite 1,618개, PullRequest 1개. 과거 실패 알림이 누적된 기록이며 현재 장애 1,619건을 의미하지 않는다. 읽음 표시나 삭제는 하지 않았다. |

전체 64개 경고의 번호·종류·위치·SHA·링크와 저장소 알림 메타데이터는 [github-alert-inventory.json](./github-alert-inventory.json)에 있다. API 키·탐지된 비밀 값은 기록하지 않았다.

### 열린 PR의 실제 변경과 실패 원인

- [#13](https://github.com/ysnle/aio-screener/pull/13): js-yaml 5.2.1 → 5.4.1. 공포·탐욕 대표값 34와 최신 일별값 33.49의 반올림 불일치로 artifact-semantics 실패. 의존성 자체의 호환성 실패라고 단정할 수 없다.
- [#8](https://github.com/ysnle/aio-screener/pull/8): js-yaml 5.4.2 및 Playwright ^1.63.0. 공포·탐욕 대표값 32와 최신 일별값 31.23의 불일치로 같은 검사 실패. #13과 js-yaml 변경이 겹친다. 최신 main에 재기반한 뒤 전체 검사를 확인해야 한다.
- [#7](https://github.com/ysnle/aio-screener/pull/7): GitHub Actions 8개 업데이트. data-refresh 및 qa-pipeline-contract 실패. 검사에 고정된 검토 완료 action SHA와 새 SHA가 달라 발생한 실패다. 새 action의 계약을 실제 검토한 뒤 검사와 함께 갱신해야 하며, 검사를 무조건 완화해서는 안 된다.

js-yaml 권고: [GHSA-pm4m-ph32-ghv5](https://github.com/nodeca/js-yaml/security/advisories/GHSA-pm4m-ph32-ghv5) (High, 수정 5.2.2), [GHSA-r3ph-w7gj-g6xm](https://github.com/nodeca/js-yaml/security/advisories/GHSA-r3ph-w7gj-g6xm) (Medium, 수정 5.4.1). #8의 5.4.2는 두 수정 버전보다 높지만 해당 PR 전체의 실행 검증을 대체하지 않는다.

### Code scanning 소스 검토의 범위

- #1 Pages privileged checkout: checkout 전에 동일 저장소·CI·push/workflow_dispatch·main·성공·정확 SHA 및 attestation 일치를 검사한다. 외부 fork PR을 직접 실행하는 경로가 차단되어 오탐 가능성이 높다. 이후 npm ci와 저장소 코드를 실행하므로 main 및 의존성이 신뢰 경계다. 보호 규칙의 세부 강도·관리자 우회까지 검증하지 않았다.
- #59/#60 research/plan.js: URL 문자열이 아닌 도메인 배열에 Array.includes로 정확 일치 여부를 확인한다. 해당 substring 진단은 오탐 가능성이 매우 높다.
- #20/#21 aio-core.js: 정규식 전처리 뒤 DOMPurify가 적용되고 미로드·실패 시 HTML 문자를 escape한다. 경고 위치만으로 실제 XSS라고 확정할 수 없으며 최종 출력 경로와 공격 입력 검증이 필요하다.
- 전체 경고 유형: sanitizer 19, URL substring 14, 불완전 escape 8, DOM XSS 5, double escaping 5, path injection 5, tag filter 4, prototype assignment 2, identity replacement 1, workflow checkout 1의 총 64개다. 위 대표 검토를 다른 경고에 자동 적용하지 않는다.

Security policy Disabled는 취약점 제보 절차 문서가 없다는 뜻이다. Code/Secret/Dependabot scanning이 꺼져 있다는 뜻이 아니다.

## 개인 API 키가 선택이라는 의미

기본 화면, 공용 수집 자료, 포트폴리오 로컬 저장, 공용 AI·번역은 개인 API 키가 필요하지 않다. 특정 공급자의 직접 추가 조회를 사용할 때는 그 공급자의 개인 키가 필요하다. 키 저장만으로 호출 성공·요금제 권한·최신성이 보장되지 않는다.

| 개인 연결 | 키가 필요한 경우 | 키가 없을 때 |
|---|---|---|
| OpenAI AI·번역 | 사용자 개인 키 입력 없음 | 운영자 Worker의 공용 연결을 사용. 월 예산·서비스 상태에 따라 이용 제한 가능. |
| FRED | 내 브라우저에서 추가 직접 조회 | GitHub Actions가 수집한 공용 지표를 열람. 현재 공개 수집 메타데이터 fredHasKey=true, 23개 시리즈 수집 성공. Worker 실시간 relay에는 별도의 공용 FRED 키가 없고 개인 키 중계를 지원. |
| BOK ECOS·KOSIS | 각 제공자의 추가 직접 조회 | 해당 직접 조회 경로는 이용할 수 없음. 기존 공개 자료의 범위까지 사용. 현재 Worker 공용 relay 키는 둘 다 미설정. |
| Finnhub·Twelve Data·FMP | 해당 제공자의 시세·뉴스·차트·재무 자료 추가 조회 | 공용 자료·공개 출처·대체 연결의 범위까지 사용. 같은 종목·항목·지연·권한을 보장하지 않음. |
| Alpha Vantage | 연결된 시장 폭 추가 조회 | RSP/SPY 비율 등 대체 근거. 거래소 전체 breadth와 같은 지표는 아님. |
| rss2json·NewsData.io | 개인 RSS 변환·뉴스 추가 조회 | 공용 RSS 및 수집 뉴스의 범위까지 사용. |
| Google CSE | 선택 외부 검색 | API 키와 검색엔진 ID(cx)가 함께 필요. 없으면 Google CSE 외부 검색 경로는 사용하지 않음. |

공개 Worker /health 확인: v57.32, OpenAI gpt-6-luna, ai.ready=true, dataProxy.ready=true. relay의 fred/bok/kosis configured=false. 이는 공용 수집 GitHub Actions의 Secrets와 다른 설정이다. Health 준비 상태는 실제 AI 답변 품질 검증이 아니다.

공개 data.json 확인: 2026-10-11 10:54:42 KST 생성. SEC 재무 자료 656개, 메타데이터 기준 커버리지 80.4%, fmpHasKey=false. 기본 자료가 모든 종목·모든 재무 항목을 완전하게 제공한다는 주장은 할 수 없다. 생성 시각은 각각의 데이터 관측 시각과 다르다.

## API 키 암호화 ‘미설정’

API 등록이나 AI 연결 상태가 아니라 이 브라우저의 PIN 보관함 상태다. PIN을 설정하면 저장 키를 AES-256-GCM으로 암호화한다. PIN에서 PBKDF2-SHA256으로 암호화 키를 만든다. 키를 조회에 사용하려면 해제해야 한다. 미설정은 보관함 PIN이 없다는 뜻이며 키를 넣으라는 요구가 아니다. 저장된 개인 키가 있다면 PIN 미설정 상태에서는 암호화 보호를 받지 않는다.

이 암호화는 브라우저 저장 데이터 보호용이다. 조회할 때 키가 제공자 또는 설정한 중계로 전달되는 것을 막지 않으며, 로그인·사용자 분리·서버 AI 키와도 별개다. 포트폴리오는 동일 브라우저 프로필·사이트 저장소에 보관되어 서로 다른 사용자 기기·프로필과 자동 공유되지 않는다. 같은 프로필의 탭끼리는 저장소를 공유한다.

## 작업 경계

확인됨: 알림 목록 전체 수집, 이슈 2개 내용, PR 3개 변경·실패 로그, 공개 Worker·수집 메타데이터, 대표 보안 경고 소스, 개인 키 및 보관함 코드.

미검증: Code scanning 64건 전체의 공격 재현, 모든 개인 공급자의 실제 계정 호출, 전체 사용자 브라우저 기능 및 AI 답변 품질.

제품 코드 수정, 원격 알림 읽음 표시, 이슈 종료, PR 병합, 경고 해제, commit/push/deploy는 수행하지 않았다. 이번 산출물은 로컬 확인 보고서와 비밀 값을 제외한 메타데이터다.

로컬 검증: collector 구문 검사 및 경고 번호 64개 고유성 확인 통과. 세션 기준 affected QA는 preflight 9 PASS + 5 CACHED, 실패 0. 기존 다른 작업의 실패 배치는 이번 검사에 포함되지 않았으며 전체 QA 또는 배포 검증 통과로 승격하지 않는다.
