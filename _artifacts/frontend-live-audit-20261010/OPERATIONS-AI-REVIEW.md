# 운영·리뷰·자동화·AI 점검 — 2026-10-10 21:52 KST

## 요청과 범위

사용자의 최신 질문: “최근 커밋/배포 성공한건가? 그리고 코드 리뷰와 자동 컴토 활성화해놨는데 이거 작동하는거야? 자동화 관련해서 문제 없는거야? AI 채팅이랑 API 모두 잘 작동하는거야?”

이전 요청의 스킬 사용/코드 작업 금지와 중간 기록 원칙을 유지했다. 로컬 소스·설정 읽기, GitHub 원격 API/작업 로그 조회, 운영 공개 API GET, 운영 채팅 최소 질문 1회를 수행했다. 앱 코드·설정·자격증명·워크플로 변경, producer 실행, commit/push/deploy/PR 생성/리뷰 요청 댓글은 하지 않았다. 이번 채팅 점검은 공유 Worker의 AI 요청 1회이며 과거 “AI 호출 없음” 기록 이후의 새 관찰이다. 개인 키 입력·실제 투자 정보 전송 없이 공개 홈의 빈 관심/보유 상태에서 연결 질문만 보냈다. 정확한 호출 요금/월 잔액은 조회하지 않았다.

## 판정표

| 영역 | 판정 | 근거와 한계 |
| --- | --- | --- |
| 최신 커밋/원격 반영 | 확인 | 로컬 HEAD와 GitHub main 모두 de0079c07823b97c3e22e183508985fb75338b03. 커밋 시각 10/10 21:16:49 KST. 다른 Harness의 커밋이며 이 감사가 수행한 것이 아니다. |
| 최신 CI | 성공 | [CI 38051712949](https://github.com/ysnle/aio-screener/actions/runs/38051712949), 종료 21:27:22 KST. preflight, contract, browser 6영역, release attestation 성공. 현재 dirty 변경 인증으로 확대하지 않는다. |
| GitHub Pages | 배포 및 운영 SHA 확인 | [Pages 38052016464](https://github.com/ysnle/aio-screener/actions/runs/38052016464) 성공. 운영 deployment.json의 sourceSha가 main과 일치, v57.31, deployedAt=2026-10-10T12:27:47.105Z(21:27:47 KST), CI/배포 run ID 일치. 실제 배포와 external/invariant 검사 단계 모두 실행·성공, 건너뛰어진 성공이 아니다. |
| AI Worker | 배포·준비·기본 응답 성공 | [AI 배포 38052016508](https://github.com/ysnle/aio-screener/actions/runs/38052016508) 성공. canonical deploy와 smoke 실제 성공. health의 revision/SHA 일치, configured/quotaConfigured/authorityReady/configurationValid/ready/automationConfigured=true, jurisdiction=us, killSwitch=false, openai/gpt-6-luna. |
| 데이터 Worker | 배포 및 대표 API 성공 | [데이터 배포 38052016453](https://github.com/ysnle/aio-screener/actions/runs/38052016453) 실제 deploy/smoke 성공. health SHA 일치, heartbeat published, coverage 16/16, consecutiveMisses=0. /quotes HTTP200, market-snapshot-v2, 16개. |
| 운영 AI 채팅 | 기본 연결 성공 | 운영 #home의 AI ON과 활성 입력 확인 후 질문 “연결 점검입니다. 투자 판단 없이 한국어로 \"연결 정상\"이라고만 답해주세요.” → “연결 정상”, GPT-6 Luna 표시. [화면 증거](./production-ai-chat-operations.jpg). 장문 분석 정확도·뉴스 인용·취소·회복·여러 사용자 동시 실행 전체 인증은 아니다. |
| 시세/차트 프록시 | 대표 경로 성공 | 허용 Origin으로 공개 NVDA Yahoo 5일 일봉 GET: HTTP200, symbol NVDA, regularMarketPrice 229.28, timestamp 5개, chart.error=null. 관측 시점의 응답 연결 검사이며 가격의 독립 원천 대조는 아니다. |
| 자동 시장 분석 | 차단됨 / 후속 원인 분석 필요 | 운영 public-data/data.json: generatedAt=09:02:53.372Z, marketAnalysisOk=false, marketAnalysisSemanticOk=false, status=blocked, model=none. semanticIssues: language-not-korean 및 market.vix/us10y/dxy/wti/gold metric-value-mismatch. 원 응답을 저장한 증거는 확보하지 못했다. 실제 AI 환각인지 파서/검증기 매칭 문제인지 단정할 수 없다. |
| Codex auto_review | 설정 활성·이번 승인 경로 실행 확인 | 사용자 config.toml에 approvals_reviewer=\"auto_review\", 현재 세션에서도 auto_review. 공개 운영 GET의 require_escalated 실행이 승인되어 성공했다. 명령/작업 승인 검토 기능이며 앱 코드 자동 리뷰·자동 배포와 다르다. |
| Code Review 플러그인 | 활성 및 연결 읽기 성공 | config의 code-review@openai-bundled enabled=true. 플러그인의 PR #15 checks 조회가 headRevision 76f18c538d799bdf7961ff1d173f47cc4e275a8f와 CI 결과를 반환했다. 검토 도구 연결 확인이지 새로운 코드 리뷰가 자동 생성됐다는 증거는 아니다. |
| Codex GitHub 자동 PR 리뷰 | 미검증 | 최신 릴리스는 main 직접 push. 마지막 개발 PR #15(9/30 생성, 10/1 merge)의 reviews=[]/대화 comments=[]. 최신 main 체크에는 Codex 리뷰 없이 GitHub Actions/CodeQL만 확인됐다. cloud repository 설정/개인 review trigger는 읽지 못했다. 활성/고장 어느 쪽도 단정하지 않는다. |
| CodeQL | 실제 실행 성공 | [Push on main 38051712930](https://github.com/ysnle/aio-screener/actions/runs/38051712930)에서 actions/javascript-typescript/python 분석 3개가 실제 성공. [Scheduled 37991154082](https://github.com/ysnle/aio-screener/actions/runs/37991154082)도 성공. Codex 코드 리뷰나 UX 의미 검수와 구분한다. |
| Actions 자동화 | 활성·최신 실행 성공, 안정성 문제 잔존 | 원격 16개 workflow 상태 active. 시장/스크리너/감시/주간 지식 검사/월간 검토 최신 실행 성공. 주기 준수와 장기 안정성을 함께 PASS하지 않는다. |

## 자동화에서 발견한 사항

### 1. 보완 스케줄러가 실제로 구성되지 않음

운영 data-plane health의 schedulerDispatch.configured=false, workflow=refresh-data.yml, slotMinutes=[20,50]. refresh-data.yml 주석은 P1377에서 GitHub schedule이 4~6시간 간격으로만 실행되어 Worker가 30분마다 dispatch하도록 보완했다고 명시한다. 지금 그 경로는 활성 구성되지 않았다. Cloudflare의 5분 시세 관측 cron과 GitHub 시장/뉴스 refresh dispatch는 다른 기능이다. Worker heartbeat가 최신이라는 이유로 뉴스/시장 AI 산출물 갱신도 30분마다 된다고 말할 수 없다.

원격 실행 목록에서 시장 갱신 생성 시각 10/10 02:24:05Z → 09:02:35Z 간격은 약 6시간38분이다. YAML 의도는 UTC 매시 :17/:47이다. watchdog은 01:00:32Z → 07:17:06Z 약 6시간17분이며 의도는 매시 :23이다. 최근100건 목록에서 관측한 간격으로, 지연/미실행의 GitHub 내부 원인이나 전체 장기 빈도를 인증한 것은 아니다. cadence 복원은 후속 Harness가 토큰 binding/provisioning과 실제 dispatch 기록을 확인해야 한다. 이번 감사에서는 secrets를 읽거나 넣지 않았다.

### 2. 최신 성공과 장기 운영 SLO의 차이

시장 최신 [38039987647](https://github.com/ysnle/aio-screener/actions/runs/38039987647) 성공(18:08:41 KST), 스크리너 [38030601679](https://github.com/ysnle/aio-screener/actions/runs/38030601679) 성공(15:27:07 KST), watchdog [38033897726](https://github.com/ysnle/aio-screener/actions/runs/38033897726) 성공(16:17:34 KST). 최신 watchdog 로그는 pass11/cached0/fail0/skip0지만 operations-slo-window는 status=NOT_CERTIFIED, windows 7d=FAIL/30d=FAIL, market/screener/watchdog=DEGRADED다. 현재 연결 복구와 지속 안정성은 서로 다른 판정이다.

최근 실패 [시장 38003576662](https://github.com/ysnle/aio-screener/actions/runs/38003576662)는 10/10 08:17 KST, reconciliation에서 KRW=X/DX-Y.NYB/CL=F/GC=F의 STALE_UNEXPECTED로 차단했다. 뒤 promotion candidate gate도 recorded candidate 없음으로 실패, commit/CI dispatch는 건너뛰었다. 잘못된 후보 공개를 막는 fail-closed 동작이 확인된다. [watchdog 38011443581](https://github.com/ysnle/aio-screener/actions/runs/38011443581)는 10:01 KST에 external-pipeline 실패(로컬10+live-invariants 통과). 최신 후속 성공은 확인했지만 당시 상세 external 원인까지 확정하지 않았다. 알림 workflow 성공은 원본 workflow 성공을 의미하지 않는다.

### 3. 자동 시장 분석은 전체 workflow 성공 뒤에도 WARN으로 남음

최신 시장 run의 요약은 LLM Analysis=WARN이고 생성된 분석은 차단된 관측치 요약으로 대체됐다. credentials/budget/provider 고장이라는 일반 요약만 보고 원인을 정하면 안 된다. 현재 저장된 구체적 이유는 언어와 5지표 숫자 검증 실패다. requestSharedAnalysis → validateMarketAnalysisText → fallback 흐름을 읽었으나 구현 수정이나 생성 재실행은 하지 않았다. 다음 Harness는 원 응답·프롬프트·수치 단위·매칭 검증기를 함께 재현해야 한다. 검증을 약화해 정상 표시하는 방식은 권하지 않는다.

### 4. 장주기 작업과 수동 검토 잔여

주간 Knowledge base lint 37302957149(10/5) 성공, Knowledge build candidate 36872916690(10/1) 성공, 주간 macro-calendar 37361699271(10/5) 성공, 월간 universe 36893593113(10/1) 성공. annual exchange-calendar reminder는 마지막 run 조회가 빈 배열이라 실제 실행 미검증이며, 연간 스케줄 시점 전이라면 정상일 수 있다. 즉시 실패로 분류하지 않는다.

열린 [공식 거시 일정 검토 #17](https://github.com/ysnle/aio-screener/issues/17)은 candidate differences=9, omitted runtime calendars=1이고 사람이 검토해야 한다. [월간 universe #16](https://github.com/ysnle/aio-screener/issues/16)과 Dependabot #7/#8/#13도 열려 있다. 실행 성공이 사람 검토·의존성 업데이트 완료를 뜻하지 않는다. 이 감사에서 merge/close하지 않았다.

### 5. 데이터/API 가용성 경계

public-config marketData.fastQuotes.enabled=false, certification soakObservedDays=0/rightsReviewed=false/certifiedAt=null. fast plane의 API 성공만으로 이 경로가 브라우저에 정식 채택되거나 권리·7일 soak 인증됐다고 말하지 않는다.

AI health relay providers fred/bok/kosis의 configured는 false다. FRED는 personalKeyRequired 목록에 있으며 배포 smoke는 개인 키 없는 요청을 차단하도록 검사한다. false 자체를 모두 서비스 고장으로 분류하지 않는다. 이번엔 개인 키를 넣지 않아 FRED/BOK/KOSIS 원천 API의 인증 호출 전체는 미검증이다. AI 배포 smoke는 browser AI/자동화 token AI/CORS/허용되지 않은 origin 차단을 실제 통과했으며 optional FRED_API_KEY 조건부 분기가 실제 실행됐는지 별도 확증은 확보하지 않았다.

## 환경과 증거 등급

초기 sandbox 안 gh auth status는 invalid, DNS 요청은 실패했고 IAB의 Worker 직접 navigation도 ERR_BLOCKED_BY_CLIENT였다. 승인된 읽기 전용 네트워크 호출에서는 gh auth가 keyring 로그인 정상, health/quotes/chart HTTP200으로 바뀌었다. 초기 오류는 운영 장애나 실제 계정 토큰 만료로 확정하지 않는다. 인증 정보 값은 보존하지 않았다.

운영 Pages 브라우저에서 렌더링, AI ON/입력/전송/응답을 직접 확인했다. Worker GET은 터미널 공개 API의 live 증거다. 배포 smoke의 AI 자동화 호출은 GitHub job 실행 증거이며 이 감사가 automation token을 사용한 직접 호출은 아니다. 장기 SLO는 해당 run의 산출 로그 판정이다.

현재 local dirty 앱 파일은 다른 진행 작업이다. 최신 remote/운영 SHA의 CI 성공을 그 변경의 인증으로 취급하지 않는다. 모든 API, 모든 종목, 모든 분석 질의, 실패·429·월 예산 도달·개인키 연동·동시사용 전체가 정상이라는 보장은 하지 않는다.

## 공식 기능 설명

- [Code Review 플러그인 설명](https://help.openai.com/en/articles/20001552-review-pull-requests-with-codex)
- [Codex GitHub PR 리뷰 및 자동 trigger](https://developers.openai.com/codex/integrations/github)
- [Codex auto_review 승인 동작](https://openai.com/index/running-codex-safely/)

플러그인 설치, 자동 PR 리뷰 repository/개인 trigger, 실행 권한 auto_review, CodeQL, CI, 서비스 AI는 각각 따로 판정해야 한다. main 직접 push 중심인 현 운영을 자동 PR 리뷰가 매 릴리스 커버한다고 가정하면 검토 공백이 생긴다. PR 도입은 고정 운영 결정 변경이므로 이번 점검에서 진행하지 않았다.


문서 closeout: 정확한 감사 문서4개 affected 검사는 pass8/cached4/fail2이며 CURRENT-STATE stale과 workspace-contract가 기존처럼 남았다. [로컬 검사 보고](../../.cache/aio-qa/runs/2026-10-10T12-54-46-608Z-43656-3tntef.json). 문서 UTF-8/LF와100건 JSON 파싱 및 scoped diff whitespace는 통과했다. 원격 CI 성공을 현재 미커밋 작업본 QA 성공으로 바꾸어 보고하지 않는다.
