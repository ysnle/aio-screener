# AIO Screener 전체 실사 & 재설계 핸드오프 — 2026-09-27

> 작성: Claude Opus 5.5 (설계·통합·직접 검증) + 하위 에이전트 7개(Sonnet, 영역별 읽기 전용 감사)
> 대상 저장소: `C:\projects\AIO` (※ 옛 경로 `C:\Users\zmfhd\OneDrive\문서\Claude\Projects\AIO`는 **빈 폴더**다. 2026-07-02 이전됨)
> 성격: **진단·설계·계획 문서.** 원 작성 세션(2026-09-27)은 저장소 코드·설정·git 상태를 바꾸지 않은 읽기 전용 감사였다. 이후 실행 변경과 현재 상태는 아래 2026-09-28 기록 및 [`EXECUTION-STATUS.md`](./EXECUTION-STATUS.md)에 추가됐다. 위치: `_artifacts/full-audit-20260927/` (2026-09-27 사용자 요청으로 저장소에 반입, 커밋 여부는 운영자 결정).
> 짝 문서: `OPERATOR-CHECKLIST.md` (운영자 점검표)
> 추가 설계 자료: [`FOUNDATION-DESIGN.md`](./FOUNDATION-DESIGN.md)는 후속 route·architecture·algorithm·data-lineage·UI/UX 부록을 종합한 v2 설계 제안이다. 새 저장소·프레임워크·호스팅 등 표의 D/R 항목은 제안이며 별도 운영자 승인 전에는 확정 결정으로 실행하지 않는다. 현재 사이트의 D0/D4 선택은 아래 실행 부록이 우선한다.
> 부록 `appendix/`: `01`–`12` 원 감사 보고서, `13`–`16` route별 추가 감사, `15b` themes/fundamental/ticker 추가, `17` as-is architecture, `18` algorithm catalog, `19` data lineage와 `19b`–`19d` 세부 경로, `20` UI/UX design system. 부록의 관측 결론은 당시 기준으로 읽고, 현재 실행 판정은 HANDOFF의 사용자 결정과 [`EXECUTION-STATUS.md`](./EXECUTION-STATUS.md)를 따른다.

> **2026-09-28 실행 결정 부록:** 이 handoff의 날짜·수치는 2026-09-27 감사 시점 기준선이다. 후속 결론은 [`EXECUTION-STATUS.md`](./EXECUTION-STATUS.md)를 기준으로 한다. 운영자는 P0에서 strict `data.json`/`market-snapshot.json` freshness를 유지하고 정상 scheduled refresh와 reconciliation 통과 뒤에만 release를 진행하라고 결정했다. 시장 데이터에 weekend/session grace를 주는 제안은 채택하지 않았다. 정적 macro/universe expiry severity는 미결정이며 현재 hard severity를 유지한다. D4는 기존 P/R/QA 원장을 유지하고 새 회귀 추적 항목을 추가한다. commit/deploy는 조건부 승인: 정상 refresh·reconciliation 및 exact-SHA CI가 통과한 뒤, 해당 작업 소유 파일만 분리한다. 기존 dirty 변경을 포함한 `git add -A`는 허용되지 않는다.

---

## 0. 이 문서를 읽는 법 (다음 에이전트용)

1. **§1 요약 → §2 현재 사고(P0) → §9 결정 필요 사항**까지만 읽어도 다음 행동을 정할 수 있다.
2. 모든 발견은 `F-xx` ID를 가진다. 증거 수준을 섞지 않는다:
   - **[실측]** 이 세션에서 명령/라이브 요청으로 직접 확인
   - **[에이전트]** 하위 에이전트가 확인, Opus가 재검증하지 않음
   - **[추론]** 증거에서 도출한 판단 / **[미검증]** 확인 못 함
3. 하위 에이전트 결론이 서로 충돌하거나 틀린 곳은 **§6에서 판정**했다. 부록 보고서를 인용할 때 §6을 먼저 볼 것.
4. 이 문서는 "기존 코드를 유지해야 한다"는 전제를 두지 않았다. 대신 **유지할 가치가 실측된 것**은 §5.9에 명시했다.

---

## 0.5 원래 설계 의도에 맞춘 재조정 (운영자 확인 2026-09-27) — **§7–§9와 충돌하면 이 절이 우선**

### 0.5.1 운영자가 밝힌 원래 의도

1. **소수의 지인·가족끼리만** 공유한다.
2. 각 사용자가 **실제 주식 매매·트레이딩에 활용**한다.
3. 경제·금융·주식 등 여러 분야의 **배경지식과 개념을 학습하고 적용**한다.
4. **최대한 무료**로 구축·배포한다.
5. **혼자 구축**하고, 이후에는 **어느 정도 알아서(자동으로) 계속 운영**되게 한다 — 이 부분이 현재 가장 어렵다.

### 0.5.2 이 의도에 비춰 본 현재 시스템의 판정

| 의도 | 현재 실태 | 판정 |
|---|---|---|
| 가족 전용 | 저장소·사이트·데이터 JSON·AI 릴레이가 **전부 인터넷 전체에 공개**. 검색 노출 허용. 인증 없음 | **불일치** — 공개 서비스용 부담(헌장·승격 게이트·SLO·권리·규제·남용 방어)을 떠안았지만 얻는 것이 없음 |
| 실매매 활용 | 대표 지표(매매점수)가 **음의 IC**(F-09), 스크리너 가격은 **실시간 반영 경로가 한 번도 작동하지 않음**(F-40: 파이프라인 가격 고정 — 실측 확인), 주말엔 데이터·배포 정지 | **위험** — 가족이 실제 돈을 거는 화면에서 신뢰도 표시가 가장 중요 |
| 학습·적용 | Principles·Atlas·Guide·지식 455단위(검토 상태를 사용자에게 정직하게 표시 — 10 보고서) | **정합(강점)** — 다만 학습 콘텐츠가 매일 도는 데이터 파이프라인·게이트에 묶여 있을 필요는 없음 |
| 무료 | GitHub(public이라 Actions 무료) + Pages + Workers Free. **실측 Actions 사용량 ~1,650분/주(≈7,000분/월)** — 저장소를 private으로 돌리면 무료 한도(월 2,000분)를 **3.5배 초과** | 현재는 무료 유지 중. 단 "공개"를 대가로 치르는 중 |
| 혼자·자동 운영 | 사람이 해야 하는 주기 작업: 매크로 발표일 레지스트리 **거의 매주 코드 수정**(안 하면 배포 정지, F-33), 유니버스 월간(10/14 하드 만료, F-34), 휴장일 연간(2027 절벽), 지식 빌더 수동, Worker 수동 배포, 버전 범프 수동, Dependabot 수동, 원장 기록(P/R/QA). 알림 채널 적색률 79% | **핵심 실패 지점** — "자동 운영"을 목표로 만든 게이트가 오히려 **사람이 없으면 멈추는** 시스템을 만들었다 |

**근본 원인 한 줄**: 가족용 도구를 **공개 SaaS의 운영 형식**으로 지으면서, 자동화 대신 **"사람이 제때 고치지 않으면 멈추는(fail-closed) 게이트"**를 쌓았다. fail-closed는 데이터 표시에는 옳지만, **배포와 운영 흐름에 적용하면 1인 운영에서는 곧 정지**를 뜻한다.

### 0.5.3 재조정된 설계 원칙 ("Family Autopilot")

1. **운영자 개입 0이 기본값(목표 제안)** — 모든 주기 작업은 (a) 권위 있는 소스에서 자동 갱신하거나 (b) 비차단 경고 + 운영자에게 리마인더로 바꾸는 것을 제안한다. 데이터 freshness를 완화하는 정책은 2026-09-27 D0 선택으로 채택되지 않았다. 정적 macro/universe 만료 severity도 별도 결정 전까지 현행 hard severity를 유지한다.
2. **데이터 문제는 화면에서 정직하게 보이고, 사이트와 배포는 멈추지 않는다**(fail-closed는 "그 값을 결정용으로 쓰지 않는다"로 한정).
3. **가족만 들어온다** — Cloudflare Access(Zero Trust 무료 50명, 이메일 OTP 로그인)로 사이트·데이터·AI 릴레이를 한 번에 잠근다. 이것 하나로 F-08(AI 키 남용), F-22/F-35(공개 재배포), F-30(헤더 — Cloudflare에서 서빙하면 해결), 검색 노출, 규제 노출이 동시에 크게 줄어든다.
4. **매매에 쓰는 숫자는 검증된 것만 "신호"로 부른다** — 나머지는 "학습·참고". 가격에는 항상 기준시각을 크게 보여주고, 실행 직전 시세는 증권사 앱에서 확인하도록 안내한다(실시간 시세 권리는 무료로 확보 불가).
5. **학습 콘텐츠는 정적 콘텐츠**로 — 원고 수정 시에만 빌드. 매일 도는 파이프라인과 분리.
6. **무료 한도 설계**: 코드 저장소는 public 유지(Actions 무료) + **데이터·비밀은 저장소 밖**(R2/Worker secrets). CI는 월 수백 분 수준으로 축소.
7. **알림은 3개만**: 사이트/배포 24시간 이상 정지, 핵심 데이터 2거래세션 이상 미갱신, LLM 일일 캡 80% — 운영자 한 명에게(이메일 또는 텔레그램 봇).
8. **거버넌스는 혼자 기억할 수 있는 크기** — 규칙 10개 이하, 나머지는 테스트·권한으로 강제.

### 0.5.4 무료 스택 (목표) — 모두 무료 등급

| 역할 | 선택 | 무료 한도(공개 자료) | 비고 |
|---|---|---|---|
| 코드 저장소·CI·느린 수집(SEC/13F/지식) | GitHub public repo + Actions | public은 표준 러너 무료 | 데이터·키 없음 → 공개해도 무방. LICENSE 명시 |
| 웹 호스팅 | Cloudflare Workers Static Assets(또는 Pages) | Free | `_headers`/CSP 실제 적용 |
| 접근 제어 | **Cloudflare Access** (Zero Trust Free) | **50명**, 로그 24시간 | 가족 이메일 허용목록, OTP 로그인 |
| 데이터 저장 | R2 | 10GB, Class A 100만/월 | git 비대화·Pages 한도 해소 |
| 빠른 시세 | 기존 data-plane Cron Worker + KV | KV 쓰기 1,000/일(이미 설계로 회피) | 이미 작동 중 — 승격만 |
| AI | Anthropic API(유료, 유일한 비용) via Worker | — | Access 이메일별 일일 캡 → 사용자별 예산 |
| 알림 | GitHub 이메일 알림 또는 텔레그램 봇 | 무료 | 3종만 |
| 도메인(선택) | 없이도 가능(workers.dev/pages.dev) | — | Access를 붙이는 방식은 도입 시 확인(U13) |

### 0.5.5 "사람이 하던 일" → 자동화 치환표

| 현재 수동 작업 | 멈추는 이유 | 자동화 방식 | 실패 시 |
|---|---|---|---|
| 매크로 발표일(`nextRelease`) 매주 코드 수정 | 지난 날짜가 CI hard FAIL | 미국: FRED `release/dates` API로 다음 발표일 자동 산출, FOMC·금통위: 연 1회 공식 일정 파일 | 경고 + 화면에 "일정 미확인" 표시(배포 무관) |
| 스크리너 유니버스 월간 검토 | 90일 하드 만료(10/14) | 파이프라인이 월 1회 후보 갱신 PR/이슈 자동 생성, 만료는 경고로 강등 | 기존 유니버스 계속 사용 + 배지 |
| 휴장일·반일장 연간 등록 | 2027 절벽(fail-closed) | 11월에 다음 해 캘린더 생성·검증 워크플로 + 리마인더 이슈, 미지 연도는 "평일=개장 추정 + 경고"로 fail-soft | 경고 |
| 지식·원칙 빌더 수동 실행 | parity 게이트 FAIL | 원고 변경 시 CI가 빌드해 산출물 커밋(또는 빌드 산출물만 배포) | — |
| Worker 수동 배포 | 소스·라이브 괴리 | `worker/` 변경이 main에 들어오면 자동 배포 + 스모크 | 자동 롤백 |
| 버전 범프(7지점) | 수동 | 배포 태그에서 자동 주입 | — |
| Dependabot PR | 방치 | 패치 업데이트는 CI 통과 시 자동 병합 | — |
| 13F 매일 전체 재커밋 | 저장소 폭증(객체 37개/일 무의미 증가 — 10 보고서) | 제출 마감 전후 주 1회 + **새 제출이 있을 때만** 발행(해시에서 `generatedAt` 제외) | — |
| 원장 기록(P/R/QA) | 세션 비용·혼란 | 동결 → LESSONS·테스트·Issues | — |
| 주말 refresh 실패 | 벽시계 SLA | 거래 세션 기반 SLA + 레인별 발행 | — |

### 0.5.6 재조정된 로드맵 (이전 Phase 0–5를 대체)

| 단계 | 기간(1인 기준) | 목표 | 종료 기준 |
|---|---|---|---|
| **P0 출혈 멈춤 + 시한폭탄 해체** | 1–3일 | 원래 감사 제안: 정적 expiry를 경고로 낮추고 주말 grace. **현재 미채택** — D0은 strict live-core freshness와 정상 scheduled refresh/reconciliation 통과 후 배포로 확정됐다. 정적 macro/universe severity는 미결정이므로 hard 상태를 유지한다. | 정상 data refresh + reconciliation + strict lineage PASS; 이후 exact-SHA 배포 인수 |
| **P1 오토파일럿** | 1–2주 | §0.5.5 치환표 전부, 알림 3종, 게이트 심각도(block/warn), CI 필수 계층 ≤10분 | 4주 연속 운영자 손 수정 0회로 운영 |
| **P2 가족 게이트 + 데이터 분리** | 2–3주 | Cloudflare 호스팅 + Access, R2 데이터, git에서 데이터 커밋 중단, AI 릴레이 Access 인증·사용자별 캡 | 비로그인 접근 0, 저장소 증가 <5MB/주 |
| **P3 매매용 신뢰도** | 2–4주 | 매매점수 히어로 제외·재설계 트랙, 가격 기준시각 강조, "실시간/LIVE" 배지를 실제 신선도로(F-56), 고정 날짜 제거(F-55), 개발 문자열 제거+린트(F-54), 명칭 정정(RRG·Stage·Minervini, F-57), 모델 카드, 스크리너 가격 경로 수리(F-40), 휴장일 인지 세션(F-53), 포트폴리오 **전체 백업/복원**(F-51) | 매매 관련 화면 전부 "기준시각·검증 상태" 표시, 내부 ID 노출 0 |
| **P4 단순화** | 지속 | 20라우트 → 5개 목적지(오늘·분석·스크리너·포트폴리오·학습), 거버넌스 리셋, 레거시 퇴역(라우트당 1 PR) | 필독 문서 ≤50KB, `js/` 감소 추세 |
| P5 프론트 빌드(선택) | 여유 시 | Vite+TS, 부팅 다이어트 | 가족 규모에선 우선순위 낮음 — 단 모바일 12MB는 P4와 함께 줄일 것 |

### 0.5.7 가족 전용 기준으로 다시 본 규제·권리 (법률 자문 아님)

- **유사투자자문업**: "대가 + 불특정 다수"가 요건 → 무료·가족 한정이면 해당 가능성 낮음. **유료화·후원·지인 외 확대를 하지 않는 것**을 운영 원칙으로 명문화(D13).
- **인공지능 기본법**: 적용 대상인 "인공지능사업자"에 가족용 비영리 도구가 해당하는지 불명확 → 표시 비용이 거의 0이므로 AI 답변·번역·요약에 "AI 생성" 표시(F-37).
- **Anthropic 고위험 사용 사례**: 소비자 대상 금융 조언이면 AI 사용 고지·사람 검토 요건 → 채팅 시작 시 고지 + "개인화 매매 지시 거부" 유지.
- **데이터 약관**: 대부분 "개인 사용"은 허용·"재배포"는 금지 → **공개 JSON을 없애고 Access 뒤로** 옮기는 것만으로 위험이 크게 준다(ICE HY OAS 포함). 완전한 적법성은 제공자별 약관 확인 필요.

---

## 1. 요약 (Executive Summary)

### 1.1 한 문단 판정

AIO Screener는 **제품 코어(데이터 파이프라인·도메인 계산·fail-closed 증거 정책)의 설계 의식은 개인 프로젝트 수준을 훨씬 넘지만, 그 위에 쌓인 운영·거버넌스 구조가 제품을 앞질러 스스로를 멈추게 하는 단계**에 와 있다. 오늘 이 순간에도 라이브 사이트는 v56.33에 멈춰 있고(원격 v56.52, 로컬 v56.55), 데이터는 30시간 넘게 갱신되지 않았다. 원인은 코드 버그가 아니라 **"주말/휴장을 모르는 신선도 SLA → 전부-아니면-전무 refresh → 140개 전부 hard-blocking인 게이트 → 단일 배포 경로"**라는 구조적 결합이다. 같은 패턴이 9/12–13, 9/19–20, 9/26–27 **세 주말 연속** 재현됐다. 동시에 저장소는 데이터를 git에 커밋하는 구조 때문에 로컬 `.git` 1.7GB·이력 blob 18.8GB로 하루 11–14MB씩 불어나고, 거버넌스 원장은 하루 50개 P항목이 생성될 만큼 "사건 기록"이 아니라 "작업 부산물"이 되었다. **재설계의 핵심은 코드를 다시 쓰는 것이 아니라, (1) 코드 배포와 데이터 발행을 분리하고, (2) 게이트를 제품 행동 중심의 소수 계층으로 줄이며, (3) 데이터를 git 밖으로 빼고, (4) 레거시 퇴역을 "추가"가 아닌 "삭제"로 측정하는 것**이다.

### 1.2 핵심 수치 (대부분 [실측])

| 영역 | 수치 |
|---|---|
| 버전 | 라이브 **v56.33** (sourceSha `fc75c775`, 09-26 01:41Z 배포) · origin **v56.52** (`904cebd0`) · 로컬 **v56.55** (dirty 66파일, +1,676/−796, 미추적 2) |
| 운영 상태 | refresh-data·CI·watchdog **연속 실패 중**, 운영 이슈 #2/#4/#5 open. Worker 라이브 revision v56.33 |
| 신뢰도(14–30일) | CI 실패율 **68%**, watchdog **79%**, refresh-data 27%(주말 집중), refresh-screener 8% |
| cron 실제 주기 | refresh-data 선언 30분 → **실측 중앙값 182분** |
| 커밋 | 2,083개 / 178일. 봇 1,852(89%), 인간(ysnle) 227 — **인간 커밋은 06-30이 마지막** |
| 저장소 크기 | 로컬 `.git` ~1.7GB(loose 1.0GB + pack 578MB/42개 + garbage 72MB), GitHub 보고 458MB, 추적 작업트리 ~675MB, 이력 blob 합계 **18.77GB** |
| 공개 데이터 | `public-data/` 추적 596MB (masters 314MB, objects 235MB, sec-fundamentals 31MB). Pages 발행분 ~253MB |
| 코드 | `index.html` 13,357줄/996KB · `js/` 82.7K줄(aio-core 28,169줄/1.7MB) · `src/` 193파일 34.3K줄 |
| 부팅 | 첫 방문 **202 요청 / ~12MB decoded**, 스크립트 138(그중 src 모듈 130), JSON 5.69MB, 3rd-party 호출 ~55 |
| 전역 | `window.*` 고유 **753개**, 할당 1,026곳, innerHTML sink 372 |
| Strangler | `fullNativeOwner` **5/20** 라우트 (chartNative 8/20, narrativeNative 2/20) |
| 거버넌스 | RULES R1–R632(571 헤딩, 412KB) · BUG-POSTMORTEM P1–P1282(1.19MB) · QA ID 731개/95개 명명체계(open 200) · CHANGELOG 539KB · `_context` 74문서 · `ci-*.mjs` 129개 · QA 게이트 슬롯 140개(전부 hard-blocking) |
| 도메인 | 홈 매매점수 21일 선행수익 상관 **−0.28 (n=287)**, 5일 −0.147 (n=303) |
| 보안 설정 | 라이브 응답 헤더는 HSTS뿐(CSP·XFO·nosniff 없음), secret scanning/push protection/Dependabot 보안 **전부 disabled**, main 필수 체크 없음 |

### 1.3 Top 13 (우선순위 순)

| # | ID | 심각도 | 한 줄 |
|---|---|---|---|
| 1 | F-01 | **P0 진행중** | 주말 refresh 실패 → 데이터 stale → CI data-lineage FAIL → attestation 없음 → 배포 정지 (3주 연속 재현) |
| 2 | F-02 | Critical | 데이터를 git에 커밋: 이력 18.8GB, 하루 11–14MB 증가, Pages 1GB 한도 궤도 |
| 3 | F-03 | Critical | 140개 게이트 전부 hard-blocking + 문서 문자열 결합 → CI 68% 적색이 "정상 상태" |
| 4 | F-04 | Critical | 거버넌스 원장 폭증(9/25 하루 P 50개), 계획 문서 난립·상호 모순, 진척 인플레이션 재발 |
| 5 | F-05 | Critical | 모든 라우트 부팅에 12MB·202요청·3rd-party ~55회, 콘솔 401/403/422 상시 |
| 6 | F-12 | High | 거래 캘린더 비인지 신선도 + **2027-01-01 캘린더 절벽**(native US 세션 fail-closed) |
| 7 | F-06 | High | Strangler 미수렴: 레거시가 줄지 않음(aio-core 상한 오히려 상향), facade가 재구현 |
| 8 | F-08 | High | AI 릴레이 실인증 부재(Origin+공개 토큰) — 비용 상한은 DO 일일 캡뿐 |
| 9 | F-09 | High | 홈 대표 지표(매매점수)가 **음의 IC** — 방향이 반대로 측정됨 |
| 10 | F-11 | High | 커밋 단위·귀속 붕괴: 50-P 배치 커밋, 단일 봇 신원, 태그 1개, PR 사실상 0 |
| 11 | F-19/F-20 | High | 관측성 공백(클라이언트 오류 미수집, CI 로그가 FAIL 줄을 숨김) + 에이전트 권한이 산문 규칙에만 의존 |
| 12 | F-30/31/32 | High/Medium | `_headers`의 CSP 등 보안 헤더가 라이브에 **실제로 없음**(GitHub Pages 미지원), secret scanning·push protection·Dependabot 보안 전부 off, main에 필수 체크 없음 |
| 13 | F-22 | Medium(잠재 High) | 공개 저장소·라이선스 없음·제공자 데이터 재배포·UA 위장·규제(유사투자자문/AI기본법) 미검토 |

### 1.4 추가 발견 (2차 실사, Opus 실측) — 날짜가 정해진 배포 정지

| ID | 심각도 | 내용 | 근거 |
|---|---|---|---|
| **F-33** | **P0 예고** | `AIO_MACRO_CALENDAR`의 `nextRelease`가 과거가 되면 `ci-static-db-expiry-check.mjs`가 hard FAIL(CI `data` 그룹). **2026-09-30(us-pce)부터** 10/1·10/2·10/5·10/14·10/15·10/22·10/28(2)·11/30 — 발표마다 `js/aio-core.js` 손 수정이 없으면 배포 정지. 캘린더 데이터가 **코드 안에** 있고 **만료가 배포 게이트**인 설계 결함 | `scripts/ci-static-db-expiry-check.mjs:46–52`, `qa-pipeline.json` groups.data.gates[18] |
| **F-34** | **P0 예고** | `screener-universe.json` `lastBulkUpdate 2026-07-16` + `replaceAfterDays 90` → **2026-10-14 하드 만료 → 배포 정지** | 같은 스크립트 :31–39, 런북 §6 |
| **F-35** | High(권리) | ICE BofA HY OAS 원값이 공개 `public-data/data.json`에 게시(15필드) — ICE는 제3자 게시에 사전 서면 승인 요구 | `data.json` `hyOAS`, FRED 시리즈 고지 |
| **F-36** | Medium | 파괴 명령 훅 빈틈(`push -f`/`--force-with-lease`/`+refspec`/`checkout -- .`/`restore .`/`clean -fdx`/`gh workflow run` 통과), Codex·Command Code에는 훅 미적용, Command Code는 `Shell(git:*)`·`Shell(gh:*)` 전체 허용, GitHub 기본 워크플로 권한 `write`, SHA 고정 강제 off | `scripts/agent-hook.mjs:51–56`, `.commandcode/settings.json`, `gh api …/actions/permissions/workflow` |
| **F-37** | Medium(규제) | AI 생성물 표시 문구 라이브 0건(「인공지능 기본법」 표시 의무, Anthropic 고위험 사용 사례의 AI 고지 요건) | 라이브 HTML 키워드 실측 |

운영자 관점의 전체 점검은 짝 문서 **`OPERATOR-CHECKLIST.md`** 참조.

### 1.5 감사 범위 (정직한 커버리지 표)

| 시스템 | 1차(7개 감사) | 2차(보완 감사 5개 + Opus) | 깊이 |
|---|---|---|---|
| Git 이력·저장소 | 전수 통계 | — | 깊음 |
| CI/CD·데이터 파이프라인 | 워크플로 전수, 게이트 표본 15–20 | 정적 DB 만료 게이트 추적(F-33/34) | 깊음 |
| Cloudflare Workers | 소스 전수 + 라이브 12회 | — | 깊음 |
| 프론트엔드 런타임 | 홈 라우트 실측 + 정적 분석 | 20라우트 라이브 순회(12) | 중간→깊음 |
| 보안·프라이버시 | 헤더·설정·이력 표본 | GitHub 설정 전수(Opus) | 중간 |
| 정량 지표·점수 | 공식 검증 + 백테스트 산출물 | — | 깊음 |
| 거버넌스·QA | 원장·게이트 표본 20 | — | 중간 |
| AI 채팅·오케스트레이션(src/ai, aio-chat.js) | 미감사 | 보완 감사(08) 완료 | 중간–깊음 (답변 품질은 LLM 호출 없이 평가 불가) |
| 스크리너 엔진·데이터 계층·SEC 재무 | 가중치·PIT만 | 보완 감사(09) + Opus 검증(F-40) | 깊음 |
| 지식·아틀라스·원칙·13F Masters | 용량만 | 보완 감사(10) 완료 | 중간–깊음 |
| 포트폴리오·KR·뉴스·매크로·옵션 | 공식 일부 | 보완 감사(11) + Opus 검증(F-51) | 중간 (KR 3.2K줄은 grep 수준) |
| 20개 라우트 화면·문구·접근성 | 미감사 | 라이브 순회(12) + Opus 검증(F-55) | 중간 (키보드 포커스 전수 미실시) |
| 운영자 관점(계정·약관·규제·일정) | 일부 | Opus 직접(점검표) | 깊음 |
| index.html 인라인 CSS/JS 13K줄 전수, aio-core.js 28K줄 전수 | **표본** | 표본 | 얕음 — 전수 라인 리뷰는 하지 않았다 |

---

## 2. 현재 진행 중 사고 (P0) — F-01 배포 정지 캐스케이드

### 2.1 사실 [실측]

- 라이브 `deployment.json`: `appRevision v56.33`, `sourceSha fc75c775…`, `deployedAt 2026-09-26T01:41:02Z`.
- `gh run list` (09-26 16:43Z 이후): `Refresh market data` failure 연속, `CI` failure(workflow_dispatch) 연속, `Data freshness watchdog` failure 연속. screener/SEC refresh만 success.
- refresh-data 일별 결과 [실측]:

| 날짜 | 결과 | 요일(KST) |
|---|---|---|
| 09-12 / 09-13 | 실패 7 / 실패 8 (성공 2/0) | 토/일 |
| 09-19 / 09-20 | 실패 6 / 실패 6 (성공 2/6) | 토/일 |
| 09-26 / 09-27 | 실패 5 / 실패 2 (성공 2/0) | 토/일 (+추석 9/24–26) |
| 평일 | 대부분 실패 0–1 | — |

- 최신 refresh 실패 run `36298287184`: freshness 표에서 `A1 DATA_SNAPSHOT / durable market artifact … STALE … attempt=failed; SLA=12h` → `D1-structural | no` → `exit code 1`.
- CI 실패 run `36297988434` (job `108560418144`, "Contracts / data"): `[qa] FAIL data-lineage`, 요약 `pass=23 fail=1`. **로그에 보이는 개별 줄은 전부 WARN**(screener-universe 73d>30d, structural-data-research 878h>336h, telegram-digest 23h>12h 등). `qa-runner`가 게이트 출력의 **꼬리만** 남겨 실제 FAIL 줄(알파벳 앞쪽 산출물)이 로그에서 잘려 있다.
- 오늘 로컬에서 다른 에이전트가 쓴 미추적 문서 `_artifacts/structural-handoff-20260919/36-LIVE-REMOTE-RECONCILIATION-20260927.md`는 로컬 재현에서 `data-lineage` FAIL이 **`data.json`·`market-snapshot.json`의 9/26 01:35Z 컷이 각각 12h·24h 한도를 넘어서** 발생했다고 기록한다.

### 2.2 인과 사슬 [추론, 증거 강함]

```
remote scheduled refresh
  └─> build-market-snapshot: attempt=failed when Tier-0 coverage is incomplete or a required row quality is non-publishable
       └─> failed status records producer errors and retains the last-known-good published snapshot
            └─> refresh audit A1 checks the published artifact's generatedAt against its separate strict 12h age limit
                 └─> stale LKG → A1 CRITICAL / D1-structural=no → fail-closed candidate gate blocks the data commit
                      └─> an independently committed screener/SEC revision can still reach Contracts/data, where stale live lineage may fail
                           └─> exact-SHA attestation/deploy remains blocked
```

- **하위 에이전트(02) 결론 정정**: "screener-universe 73일 stale이 근본원인"은 **틀렸다**. 해당 줄은 로그상 `WARN`이다. 다만 "수동 큐레이션 참조 데이터가 hard 게이트에 묶여 있다"는 구조 지적 자체는 유효하다(§6 참조).
- **U1 최신 상태 (2026-09-28 KST):** 위 감사 당시에는 `qa-runner` 로그가 꼬리만 남아 정확한 FAIL 줄이 미검증이었으나, 이후 exact-SHA CI #36352319347의 전체 failed-job 로그에서 `[qa] FAIL data-lineage (1072ms)`를 확인해 U1은 완료됐다. 이것은 게이트 실패를 확인하는 증거이며 `live-core` 파일별 원인까지 특정하지 않는다. 실제 진단 artifact가 없어 QA-DATA-32는 계속 미완료다.
- **U2 코드 경로 추적 (2026-09-28 KST):** `attempt=failed`는 12h A1 freshness 비교에서가 아니라 Tier-0 coverage 16/16 및 row quality publishability에서 정해진다. 3일 `CLOSED_VENUE_MAX_AGE_MS`는 개별 venue/session quote 분류이고 artifact freshness를 늘리지 않는다. A1은 별도로 published `generatedAt`에 strict 12h를 적용한다(P1290/R640·QA-DATA-33; lineage P1287/R637·QA-DATA-29). 원격 run #36357397342의 구체적 blocked row는 artifact가 없어 QA-DATA-32에서 확인해야 한다.
- **P0 artifact timestamp regression guard (2026-09-28 KST):** local review found a missing-`market-snapshot.generatedAt` path where the audit borrowed a recent status-side `lastSuccessfulAt`, potentially certifying freshness despite no artifact publication clock. P1300/R649 removes that fallback; QA-DATA-43 now covers a complete PUBLISHED cycle, registry-derived full Tier-0 coverage (currently 16/16), and a fresh status timestamp paired with a missing artifact timestamp. The fixed fixture, data pipeline contract, assertion trace, and ledger integrity checks pass. This closes the local code guard only; live strict refresh/reconciliation remains blocked, and the historical run's Tier-0 row is still unknown (QA-DATA-32).

### 2.3 즉시 조치 옵션 (결정 필요 — §9 D0)

| 옵션 | 내용 | 효과 | 위험 |
|---|---|---|---|
| A. 최소 복구 | 평일 장 개장 후 refresh가 자연 회복되길 기다림 | 코드 변경 0 | 매주 반복. 월요일 KST 오전까지 정지 지속 |
| B. 정책 핫픽스 | 감사 당시 제안: 시장 스냅샷·data.json 신선도에 거래 세션 기반 grace를 적용하고 reference 산출물은 WARN으로 완화 | 주말 정지 제거를 기대 | **미채택.** 운영자는 strict live-core freshness를 유지하기로 결정했다. |
| C. 레인 분리 | refresh를 레인별 발행(시세/뉴스/텔레그램/매크로)로 쪼개 한 레인 실패가 다른 레인 커밋을 막지 않게 | 부분 신선도 유지 | 워크플로 구조 변경 |
| D. 배포-데이터 분리(근본) | 데이터 신선도는 **UI 상태(degraded 배지)**로만 표현하고 코드 배포 게이트에서 제거 | 코드 배포가 데이터 사고와 무관해짐 | Phase 2 범위 |

**현재 실행 결정**: 정상 scheduled refresh/reconciliation을 기다리고 strict freshness를 유지한다. 이 핸드오프의 B(grace)와 정적 expiry severity 완화는 채택되지 않았다. P0가 닫히기 전 P1–P5 구조 개편은 미진행이다. dirty tree와 원격 SHA는 마지막 관측 기록을 [`EXECUTION-STATUS.md`](./EXECUTION-STATUS.md)에서 확인한다.

---

## 3. 제품 의도·방향성·정합성 평가

### 3.1 선언된 의도 [실측: `architecture/product-charter.json`]

- 정체성: "한국어 자기주도 투자자를 위한 **증거 기반 리서치·의사결정 보조**", `executionCapability: NONE`, 단계 `RESEARCH_BETA_CONDITIONAL`.
- 경험 원칙: evidence-before-opinion, missing-is-never-zero, degraded/stale 상태 가시화, **one-primary-workflow-before-feature-breadth**.
- 비목표: 주문 실행, 적합성 없는 개인화 매수·매도 지시, 실시간 주장, 범용 챗봇, 풀 백테스트/포트폴리오 회계 플랫폼.

### 3.2 실제로 만들어진 것

20개 라우트: home, briefing, market-news, signal, breadth, sentiment, technical, macro, fxbond, themes, theme-detail, screener, fundamental, ticker, options, portfolio, principles(지식), masters(13F), atlas(산업 지도), guide + AI 채팅 + 포트폴리오 vault.

### 3.3 정합성 판정

| 항목 | 판정 | 근거 |
|---|---|---|
| "증거 우선·결측≠0·fail-closed" | **정합 (강점)** | 도메인 모듈이 `predictiveValidation`, `allowedUse`, `BLOCKED` 상태를 실제로 강제 (06 보고서) |
| "하나의 주 워크플로 먼저" | **불일치** | 20라우트 + 지식 아틀라스 + 13F + 커리큘럼 스펙까지 폭이 먼저 자람. 사용 측정 없음(F-10b) |
| "실시간 주장 금지" | 대체로 정합 | 단, 메모리/문서에 남은 "30분 갱신" 서사는 실측 3시간(F-10) |
| 비목표 "풀 백테스트/포트폴리오 회계" | 경계 위 | 포트폴리오 vault·백테스트·IRR·TWR 계약이 이미 상당 규모 |
| 운영 헌장(7 trust planes, SLO, promotion gates) | **과잉 형식** | 5명 사용자·1인 운영에 엔터프라이즈급 형식. 형식은 정확하나 유지비가 제품 진척을 잠식 |
| 헌장 원칙 "release evidence bound to immutable SHA" | 정합 | attestation→pages-deploy 단일 경로는 잘 설계됨 (F-01의 "막힘"도 이 설계가 정직하게 작동한 결과) |

**결론**: 방향(증거 기반 리서치 보조)은 옳고 차별점도 명확하다. 문제는 **방향이 아니라 범위와 운영 형식**이다. 재설계는 "무엇을 더 만들지"보다 "무엇을 코어로 남기고 나머지를 어떻게 저비용으로 운영할지"가 중심이어야 한다.

---

## 4. 설계 의도 vs 실제 궤적 — 역사 분석 요약 (01 보고서 기반, 일부 [실측])

| 시기 | 커밋 | 성격 | 의도 | 실제 결과 |
|---|---|---|---|---|
| 2026-04 | 110 | 단일 HTML 모놀리스, 인간 직접 작업 | 빠른 기능 추가 | 기능 폭 급증 |
| 2026-05 | 122 | js/ 모듈 분리, 규칙(R) 체계 등장 | 유지보수성 | index.html 여전히 최다 churn |
| 2026-06 | 340 | Actions 데이터 백엔드(v50.23), 봇 등장, 인간 커밋 종료(06-30) | 자율 운영 | 데이터-코드 동일 브랜치 결합 시작 |
| 2026-07 | 662 | OneDrive→C:\projects 이전, src/ ESM strangler(07-18), architecture/ 계약 | 구조 재건 | 레거시 삭제보다 병렬 계층 추가 |
| 2026-08 | 523 | 13F Masters, Atlas, 지식 파이프라인 | 기능 확장 | **저장소 폭증 시작**(masters 샤드 전체 파일 커밋) |
| 2026-09 | 326(27일) | 거버넌스·QA 기계 폭증, 대형 배치 커밋 | 품질 보증 | 원장 폭증, 배포 반복 정지 |

관찰 [실측·에이전트]:
- `index.html`은 전체 커밋의 22.6%(470)가 건드린 최다 churn 파일. `js/aio-core.js`는 순증 +28K줄. 상위 churn 5개 중 4개가 **버전/문서 부기 파일**(CHANGELOG, version.json, `_context/CLAUDE.md`, root CLAUDE.md).
- `cd4d8ca7` 한 커밋이 P1205~P1265(50개), v56.15→v56.52(37버전), 41파일 +2,477줄. 이런 배치 커밋 20건 이상. **중간 버전들은 한 번도 독립 상태로 존재한 적 없다**(체크아웃·bisect 불가).
- 태그는 `pre-rebase-backup-b707055e` 1개. PR 흐름을 탄 변경은 역사 전체에서 1건(#1, 06-20).
- 7월 이후 모든 코드 커밋이 단일 신원 `aio-screener bot` — **어떤 도구·모델·세션이 무엇을 바꿨는지 git으로 추적 불가**.

---

## 5. 영역별 실사 결과

> 각 영역: 판정 → 발견(F-ID, 심각도, 증거, 근본원인) → 유지할 것. 상세 증거는 부록 참조.

### 5.1 GitHub Actions · 데이터 파이프라인 (02 보고서 + Opus 실측)

**판정**: 단일 배포 경로·SHA 고정 액션·attestation·TOCTOU 방지(`verify-refresh-candidate.mjs`)는 **모범적**. 그러나 스케줄러 선택, 전부-hard 게이트, 데이터-코드 결합이 신뢰도를 구조적으로 깎는다.

- **F-01** (P0) §2 참조.
- **F-10** (High) GitHub cron은 30분 주기를 지키지 못한다: refresh-data 중앙값 182분, watchdog 선언 60분→실측 249.5분. 6시간 주기(refresh-screener)는 ±8%로 준수. → **30분 이하 주기는 GitHub 스케줄러에 두지 않는다**.
- **F-03a** (Critical) 게이트 140슬롯이 전부 hard-blocking. `continue-on-error`는 2곳뿐이며 둘 다 실질 soft 게이트가 아님. 확률적으로 "어떤 게이트 하나는 빨갛다"가 기본 상태가 됨 → CI 68%, watchdog 79% 적색 → **알림 피로가 설계에 내장**.
- **F-19a** (High) [실측] `qa-runner`가 실패 게이트 출력을 꼬리만 남겨 CI 로그에서 FAIL 원인 줄이 보이지 않는다. 사고 대응 시간을 직접 늘림(이번 감사의 에이전트도 원인을 오판).
- **F-23** (Medium) `scripts/fetch-data.mjs` 4,348줄이 시세·매크로·뉴스·LLM 분석 생성까지 한 프로세스. 한 도메인 버그가 전체 수집을 죽임. (SEC/13F/텔레그램은 이미 분리됨 — 분리 역량은 있음)
- **F-18a** (Medium) [실측] 7개 워크플로가 **Node 20**(2026-04-30 EOL) 사용, Cloudflare 배포 2개만 Node 24. 로컬은 Node 24.18. `.nvmrc`/`engines` 없음. Dependabot 보안 알림 비활성(403), Dependabot PR 2건 7–10일 방치, wrangler는 전역 설치로 Dependabot 사각.
- 유지: 단일 배포 경로(`pages-deploy.yml`), 액션 SHA 고정, `verify-refresh-candidate` record/expect 프로토콜, SEC User-Agent fail-closed, `operations-alert`의 서명 해시 중복 억제.

### 5.2 Cloudflare Workers (03 보고서)

**판정**: 흔한 CORS 프록시보다 훨씬 단단하다(원자적 DO 쿼터+멱등키, SSRF/사설IP 차단, 도메인 허용목록, 관할 고정 DO로 HKG→Anthropic 403 우회, SSE 스트림 데드라인 유지, 실제 소스를 import하는 오프라인 계약 테스트). 남은 약점은 코드 주석이 스스로 인정한 것들이다.

- **F-08** (High) `/anthropic`·`/relay`에 **실제 호출자 인증 없음**. Origin 헤더(비브라우저가 위조 가능) + 공개 번들에 들어가는 선택적 `AIO_APP_TOKEN`뿐. 공개 JS를 읽은 스크립트가 공유 Anthropic 키를 DO 일일 캡(기본 300)까지 소진 가능. 라이브 `/health`: `ai.maxTokens 1500`, `relay.dailyCap 2000`, `appTokenRequired false`.
- **F-08b** (High) 레이트리밋은 isolate 로컬 Map + 위치별 native binding → 전역 상한이 아님. 파일 헤더(16–21행)의 "WAF 규칙 권장"은 workers.dev(존 없음)에 **적용 불가** — 런북은 이미 정정했으나 소스 주석은 그대로.
- **F-13** (Medium) 두 Worker 모두 `workflow_dispatch` 전용 배포 → 라이브 v56.33/`46f2f781`. 현재는 버전 문자열만 다르지만, 기능 변경이 무기한 미배포로 남을 수 있는 구조.
- **F-25** (Medium) [실측] 모델 ID 하드코딩 5곳 이상: `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-haiku-4-5-20251001`, `gpt-5.4`. 배포 스모크는 Haiku만 호출 → Sonnet 경로 오류는 사용자에게서 처음 발견됨. 중앙 모델 레지스트리 없음. (현재 세대: `claude-sonnet-5`, `claude-opus-5-5`, `claude-haiku-4-5-20251001` — 교체 여부는 비용 정책과 함께 결정)
- **F-18b** (Medium) wrangler 버전을 두 워크플로에서 따로 전역 설치(과거 버전 불일치 사고 기록 있음).
- Low: `/health`가 배포 SHA·릴레이 구성 여부 공개(설계상 수용), 봇 UA 정규식은 쉽게 우회, Yahoo/Naver/CBOE/Nitter/t.me를 Chrome UA로 서버측 프록시(ToS 미검토, F-22).
- `aio-screener-data-plane`는 **죽은 코드가 아니다**: 5분 cron+KV, 라이브 16/16 커버리지, 7일 soak·권리 검토 전까지 `enabled:false`로 의도적 다크런치.
- 유지: DO 원자 쿼터, 관할 고정, SSRF 차단, 오프라인 계약 테스트, 다크런치 규율.

### 5.3 프론트엔드 런타임 (04 보고서 + Opus 실측)

**판정**: `src/`의 라우터·disposer 수명주기·스토어는 건전하다. 그러나 번들러 없는 ESM, 부팅 시 무조건 로딩, 753개 전역, 미수렴 strangler가 성능과 변경 안전성을 지배한다.

- **F-05** (Critical) [에이전트 실측] 홈 첫 로드 202요청/~12MB decoded. `src/` 모듈 130개 개별 요청(정적 import 81개 → AI 오케스트레이션 20+파일이 모든 페이지에 로딩). `screener.json` 1.6MB·`history.json` 1.7MB·`telegram-digest.json` 1.0MB·`sec-fundamentals-summary.json` 0.9MB가 라우트와 무관하게 부팅에 로드(합계 5.69MB). RSS 8+개가 **최대 4단 CORS 프록시 폴백**(자체 Worker→allorigins raw→allorigins get→codetabs)으로 재시도, 콘솔 401/403/422 상시.
- **F-07** (Critical→High) 고유 전역 753개. `global-ownership-baseline.json`이 이를 **공식 구조로 동결**하고 이중 작성자 10개를 "가시성용"으로 등재. P1132(두 `_fetchYahooChartData` 중 로드 순서가 승자 결정), P1135(추출 파일이 존재하지 않는 전역 참조) — 스크립트 순서가 하중을 받는 구조.
- **F-06** (High) Strangler: lifecycle/renderer/data는 20/20 native지만 **fullNativeOwner 5/20**. `aio-core.js` 줄수 상한을 v56에서 28,000→28,200으로 **상향**. `src/legacy/compatibility-facade.js`의 `readTradingScoreInputs`가 `computeTradingScore` 입력을 **독립 재구성**(동기화 강제 없음).
- **F-16** (Medium) 콘텐츠가 코드 안에: `SCREENER_DB`(~950줄, 날짜 박힌 애널리스트 메모), `DATA_SNAPSHOT`(라이브 콘솔이 kr_cpi **54일 경과** 경고), `CHAT_CONTEXTS`. 세 가지가 각자 다른 규약.
- **F-18c** (Medium) Chart.js/DOMPurify/lightweight-charts의 preload SRI와 script SRI 불일치 → 프리로드 3개 전부 낭비(라이브 경고). `public-data` 캐시버스터 규약 3종 혼재(`?t=`, `?v=`, 없음).
- **F-21** (Medium) [실측] localStorage 참조 250곳, `navigator.storage.persist()` 0곳 → Safari ITP의 스크립트 저장소 7일 축출 대상. 레거시 쪽 스키마 마이그레이션 없음. 포트폴리오 export/import는 존재(`aio-workspace.js`).
- **F-17** (Medium) 테스트 피라미드 역전: 표준 러너 없음. `js/aio-tests.js`(836 테스트, 728KB — **프로덕션 미배포 확인**) + 자작 Node 하네스(`ci-esm-core-unit-check.mjs` 264KB) + ci 스크립트.
- 유지: `createLazyPage`의 "dispose된 스코프는 import 완료 후에도 mount 안 함" 계약, `lifecycle.js` resource bag, network-first SW 전략, hash 라우팅.

### 5.4 보안 · 프라이버시 (05 보고서 + Opus 실측)

아래는 다른 영역·Opus 실측에서 확인된 보안 관련 사실이고, 05 보고서 결과는 §5.4.1.

- [실측] 저장소 **public**, LICENSE 없음. 커밋 32개에 개인 Gmail 주소 노출. Worker 서브도메인이 계정 핸들(`zmfhd007`) 노출.
- [실측] Pages 발행은 **허용목록 방식**(`pages-deploy.yml` 130–141행) — `_context`, 스크립트, 워커 소스, 테스트, PDF/py는 Pages에 안 나감. 단 **GitHub 저장소 자체가 public**이므로 추적 파일은 모두 공개 상태.
- [실측] `_headers`의 CSP는 **GitHub Pages가 무시**한다(파일 자체 주석도 인정). CSP는 `script-src 'unsafe-inline'` + unpkg 허용.
- [실측] 텔레그램 digest는 **본문 미저장**(observedItems 2,205건, 텍스트 0자) — 재배포 위험 낮춤.
- [실측] 앱 내 AI 채팅은 외부 텍스트를 `buildAIUntrustedBlock`으로 격리(프롬프트 인젝션 방어 존재).

#### 5.4.1 보안 에이전트 결과 (05 보고서 + Opus 재검증)

**판정**: 앱 코드 수준의 보안 위생은 양호하다(eval/new Function/document.write 0, DOMPurify 경유 sanitizer가 고위험 innerHTML 경로와 AI 마크다운을 이중 처리, 자작 마크다운은 HTML 이스케이프 후 포맷하며 링크 문법 없음, CDN 스크립트 버전 고정+SRI, 액션 SHA 고정, `pull_request_target` 없음, vault는 PBKDF2 31만회+AES-GCM-256+랜덤 IV·키 비저장, 포트폴리오 데이터 외부 전송 없음, git 이력 표본 검색에서 실 시크릿 미발견). **약점은 코드가 아니라 "선언과 실제의 괴리"와 "꺼져 있는 무료 방어"에 있다.**

- **F-30** (High) [실측] **선언된 보안 헤더가 실제로 서빙되지 않는다.** `_headers`(CSP, X-Frame-Options, Permissions-Policy, nosniff)는 Pages 아티팩트에 복사되지만 GitHub Pages는 이 파일을 해석하지 않는다. 라이브 응답 헤더는 `Strict-Transport-Security`뿐이고, `index.html`에 CSP `<meta>` 폴백도 없다(0건). `ci-csp-ratchet-check.mjs`는 소스 텍스트만 검사하므로 이 괴리를 못 잡는다. `security-sink-baseline.json`의 `operator-observation-required` 상태가 이로써 **"미적용"으로 확정**.
- **F-31** (Medium) [실측] public 저장소인데 secret scanning·push protection·Dependabot 보안 업데이트/알림이 **전부 disabled**(무료 기능).
- **F-32** (Medium) [실측·정정] main 브랜치 보호는 **존재하나 최소한**: force-push·삭제만 금지, **필수 상태 체크·리뷰 없음**(05 보고서의 "보호 없음"은 부정확). `pages-deploy.yml`이 exact-SHA attestation을 재검증하는 보상 통제가 있으나, 검증 안 된 커밋이 main에 들어오는 것은 막지 못한다.
- **Low** [에이전트]: vault PIN 최소 4자(키 유도는 견고하나 엔트로피 부족), UI가 PIN 설정 전 평문 localStorage 상태에서도 "AES-256"을 상시 적용처럼 표현(과거 포트폴리오에서 한 번 고친 클래스 — 재확인 필요), data-plane Worker admin 경로의 비상수시간 비교, 레이트리밋 isolate 로컬(비용 상한은 DO 캡이 담당). `debug.log`는 **현재 미추적이나 과거 3개 커밋에 추적된 이력**이 있고 내용은 무해한 Chromium GPU 로그(05 확인).
- 위협 모델 요약(05 §threat model): 공개 정적 앱 + BYO 키 + 공유 LLM 릴레이에서 가장 현실적인 위협은 (1) 공유 LLM 키 비용 남용(F-08), (2) 외부 수집 텍스트를 통한 XSS/프롬프트 인젝션(앱 측은 방어됨, **개발 에이전트 측은 무방비 — F-20**), (3) 헤더 부재로 인한 클릭재킹·MIME 스니핑 방어 공백(F-30), (4) 브라우저 저장 키의 공유 기기 노출.

### 5.5 정량·도메인 정확성 (06 보고서)

**판정**: 지표 공식은 대체로 교과서적으로 정확하고(Wilder RSI/ATR, 모집단 Bollinger, MACD, Sharpe √252, Sortino 전체표본 분모, 진짜 2-state Kalman, IRR bisection), legacy↔native 골든 픽스처 패리티 검사도 실질적이다. 모델 검증 상태를 스스로 `BLOCKED`로 공개하는 정직성도 드물다. 문제는 **대표 지표의 예측력이 음수이고, 유명 방법론 이름을 빌린 지표가 그 방법론을 구현하지 않는 것**이다.

- **F-09** (High) 매매점수 corr21d **−0.28 (n=287)**, corr5d −0.147 (n=303). 겹치는 창(autocorrelation) 보정은 없지만 부호가 반대라는 사실 자체가 중요. `getScoreAdvice` 코드 주석은 이미 "최근 IC도 음수"를 알고 매수/매도 언어를 피한다. 그러나 **홈 히어로의 대표 숫자**로 남아 있다.
- **F-14** (Medium) 명칭-방법론 불일치: RRG(JdK의 롤링 z-score 정규화가 아닌 자기 평균 대비 비율, 고정 lookback 없음), Weinstein 단계(주봉 30주선이 아닌 일봉 50/100/200 SMA), Minervini 템플릿(8개 조건 중 4개).
- **F-15** (Medium) 고정 873종목 유니버스(현재 기준, `STALE`)로 라이브 스크리닝과 장기 백테스트를 모두 수행 → 생존편향 구조적. `pit-validation.js`는 엄격하지만 **실제 PIT 데이터를 공급하는 호출자가 없음**.
- **F-09b** (Low-Medium) `computeExecutionWindow` 4개 하위점수(LOW/WEAK/NONE/MIXED)는 매매점수와 같은 수작업 임계값인데 동일한 "신호 아님" 문구가 해당 렌더 지점에 있는지 미확인.
- 팩터 가중치 벡터 2종 공존(`factor-ranks.js` DEFAULT_WEIGHTS vs `fetch-data.mjs` COMP_W).
- 유지: `predictiveValidation`/`researchBoundary` 게이팅, PIT 계약 형태, FX 레그 선언-또는-거부, 포트폴리오 이력 모드 계약, 골든 픽스처 패리티.

### 5.6 거버넌스 · QA · 지식 체계 (07 보고서 + 02 교차)

**판정**: **순손실 구간**. 단, 반복 버그 클래스 표, 실제 브라우저 게이트(~24개), 훅 설계는 보존 가치가 실측됨.

- **F-04** (Critical) 원장 생성 가속: 09-25 하루 P 50개. 단위가 "구별되는 결함"에서 "에이전트가 건드린 것"으로 표류. RULES 571개는 AGENTS.md 스스로 "전체 로드 금지"라 할 만큼 내재화 불가. QA ID 731개/95개 명명체계.
- **F-04b** (Critical) 자기참조 메타 게이트가 실제 사고를 냄: P1160(생성 문서에 데이터 파생값을 고정 → 데이터 갱신마다 배포 차단), P740(손으로 쓴 배열을 자기 자신과 비교해 "17/17 native" 통과 — 같은 시기 문서 3개가 17/0, 4/13, 0/17로 **서로 모순**, 인간이 지적할 때까지 게이트 129개 중 아무것도 못 잡음).
- **F-03b** (High) 문서 문자열 결합 게이트: `ci-semantic-review-check.mjs`는 CHANGELOG에 `## v50.89` 헤딩이 **영원히** 있어야 통과, `ci-ux-default-path-check.mjs`는 `/P529/.test(qa)`, `/R228/.test(rules)`. 문서 정리가 CI 위험 작업이 됨(루트 CLAUDE.md가 "삭제 금지"로 우회 중).
- **F-04c** (High) 계획 문서 난립: ARCHITECTURE-REBUILD-HANDOFF/EXECUTION-PLAN/REMEDIATION-HANDOFF/STRUCTURAL-REMEDIATION-MASTERPLAN/CURRENT-CODE-REMEDIATION + FABLE 5종 + CODEX 2종 + structural-handoff 36개 파일… 기계 판독 가능한 `superseded-by`/`closed` 표식 없음.
- **F-11** (High) 버전=진척 카운터. 1버전 범프에 7개 표면 동기화(실제로는 3파일 ~7지점). 37버전이 한 커밋에.
- **F-20a** (Medium) 에이전트 설정 4중(`.claude`, `.agents`(미러), `.codex`, `.commandcode`).
- 유지: 반복 버그 클래스 표(14개 클래스 — 예: 그림자 구현 드리프트 9회, 생산자-소비자 단절 7회, fail-closed 위반 7회, 관측시점 리터럴 부패 6회), Playwright 기반 행동 게이트, `scripts/agent-hook.mjs`(97줄, 파괴 명령 차단·advisory), 생성형 `CURRENT-STATE.md`.

### 5.7 Git 이력 · 저장소 건강 (01 보고서 + Opus 실측)

- **F-02** (Critical) 이력 blob 합계 18.77GB 중 masters 샤드 10.33GB(13개 운용사 JSON을 매번 전체 파일로 ~33회 커밋, BlackRock 62MB), sec-fundamentals 3.95GB(423B→31MB, 259회), telegram-digest 1.28GB, history.json 1.13GB. 작업트리 3.6MB(4월)→675MB(9/26), **하루 11–14MB 증가 → 연 4–6GB 궤도**. [실측] Pages 발행분 ~253MB 중 `public-data/objects` 235MB(1,036파일) — GitHub Pages 사이트 한도 1GB.
- **F-11b** (High) 단일 봇 신원, 태그 1개, PR 1건, 배치 커밋.
- **F-24** (Medium) [실측] `core.autocrlf=true`, `.gitattributes`는 `public-data/objects/** -text`만 → 40+파일 LF→CRLF 경고. P1074(CRLF가 sha256 계약 파괴)가 이미 발생. 로컬 `node`가 PATH에 없음(세션마다 수동 추가).
- Low: 42 pack + 1GB loose + tmp_obj 가비지(로컬 gc 미실행), 중복 브랜치 `codex/v54.37-ai-reliability`(고유 커밋 0), `pre-rebase-backup` 태그, `_artifacts/` 추적 592파일·~46MB(PNG 238개), 루트의 PDF/py 파일(Pages 제외는 됨). **정정**: `debug.log`는 추적되지 않는다(07 보고서 오류, §6).

### 5.8 다른 AI 모델이 흔히 놓치는 영역 — Opus 직접 실사

| ID | 영역 | 발견 | 증거 수준 | 심각도 |
|---|---|---|---|---|
| **F-12** | 시간·캘린더 | (a) 주말/휴장 비인지 SLA가 주 1회 배포 정지 유발(§2). (b) **2027-01-01 절벽**: `src/ai/time/market-session.js`는 2026 US 캘린더만 가지고 "미지의 연도는 fail-closed" → 3개월 뒤 모든 US 세션 판정이 unknown. (c) 레거시 `aio-core.js:22838–22907`은 KR/US 2026–2027만 보유, 그 외 연도는 **조용히 2026 목록으로 폴백**(2028년에 틀린 휴장일). (d) 휴장 목록 2곳 중복(레거시 KR/US, native US). (e) 시간대 계산 4가지 방식 혼재: 수동 오프셋 산술(`aio-core.js:3075,19233,19258`, `aio-chat.js:4835`, `aio-pages.js:37`) vs `Intl`(9곳). `_getUsSession`은 DST 경계를 **사용자 로컬 자정** 기준으로 계산(주말이라 현재는 무해하나 취약). (f) 2026-11-01 미국 DST 종료 — 경계 테스트 필요 | 실측 | High |
| **F-19** | 관측성 | 클라이언트 오류는 브라우저 내부 `_aioLog`로만 가고 서버로 안 옴. `unhandledrejection`에서 `e.preventDefault()`로 콘솔 오류까지 숨김(`aio-core.js:9–20`). RUM/오류 비콘 없음 → **운영자는 사용자가 겪는 장애를 볼 수 없다**. CI 로그는 FAIL 줄을 잘라냄(F-19a). 워치독 79% 적색으로 신호 가치 상실 | 실측 | High |
| **F-20** | 에이전트 운영 보안 | `.claude/settings.local.json`이 `git push:*`, `git commit:*`, `node:*`, `python:*`, `curl:*` 등 90개를 무확인 허용 → "자동 커밋/푸시 금지"는 **산문 규칙일 뿐 권한으로 강제되지 않음**. Command Code taste 파일은 `--yolo` 선호를 기록. 외부 수집 텍스트(텔레그램·웹리서치·공급자료)가 `public-data/knowledge`·`_context`로 흘러들고 이를 **높은 권한의 코딩 에이전트가 읽음** → 앱은 인젝션 격리가 있으나 개발 측은 없음. main 브랜치 보호 없음(08 교차: 07/01 보고서) | 실측 | High |
| **F-21** | 사용자 데이터 내구성 | localStorage 전용, persist 요청 없음, Safari 7일 축출, 레거시 스키마 마이그레이션 없음. 포트폴리오 외 설정/저널/키의 백업 경로 불명 | 실측 | Medium |
| **F-22** | 법·규제·라이선스 | (a) public 저장소 + LICENSE 없음(= 전권 유보이나 열람·포크 가능). (b) Yahoo 등 비공식 시세를 **공개 JSON으로 재배포**(public-data가 GitHub·Pages 양쪽에 공개) — 대부분 제공자 약관은 재배포 금지. (c) Worker가 Chrome UA로 위장해 서버측 수집. (d) 브로커 노트성 텔레그램 채널 메타데이터 수집. (e) 한국 규제: 유사투자자문업(자본시장법 — 불특정 다수 대상 **유료** 조언 시 신고 대상; 현재 무료·5명이면 낮음, 수익화·공개 확대 시 즉시 쟁점), 「인공지능 기본법」(2026-01-22 시행 — 생성형 AI 서비스의 사전 고지·결과물 표시 의무 적용 범위 검토), 개인정보보호법(서버측 개인정보 거의 없음, Cloudflare 로그의 IP 샘플링은 확인 필요). **법률 자문이 아님 — 전문가 검토 권고** | 실측+추론 | Medium (공개 확대 시 High) |
| **F-26** | 비용·플랫폼 한도 | GitHub 권장 저장소 <1GB(로컬 1.7GB, 서버 458MB), Pages 사이트 1GB·월 100GB 대역폭·시간당 10빌드 soft limit, Actions cron best-effort, CF Free: 요청 10만/일·KV 쓰기 1천/일(설계로 회피됨)·DO. LLM 비용 상한은 DO 캡에만 의존 | 실측+공개 한도 | Medium |
| **F-27** | 버스 팩터·계정 소유 | 모든 것이 개인 계정(GitHub `ysnle`, Cloudflare `zmfhd007`)에 귀속. 시크릿 7개(`AIO_QUOTES_KV_ID, ANTHROPIC_API_KEY, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, FINNHUB_API_KEY, FRED_API_KEY, TWELVE_DATA_API_KEY`) — 발급일·만료·교체 기록 없음. 런북은 있으나 "운영자 부재 시" 절차 없음. 배포 승인은 1인에게 집중 | 실측 | Medium |
| **F-28** | 제품 측정 | 사용 분석 전무 → 20개 라우트 중 무엇이 쓰이는지 근거 없음. 기능 투자·퇴역 판단 불가 | 실측 | Medium |
| **F-29** | 콘텐츠 신선도 | DATA_SNAPSHOT kr_cpi 54일, screener-universe 73일(정책 30일), structural-data-research 36일, NAAIM/II 구독 차단, SCREENER_DB 메모에 날짜 박힘. 편집 콘텐츠의 **소유자·주기·만료 알림**이 없음 | 실측 | Medium |
| **F-25** | 모델 수명주기 | §5.2 참조 | 실측 | Medium |
| **F-18** | 공급망 | SRI 불일치, Dependabot 알림 off, PR 방치, wrangler 전역, Node 20 EOL, CSP에 unpkg | 실측 | Medium |
| **F-24** | 개발 환경 | CRLF, PATH, 한글 경로·OneDrive 잔재(옛 경로 빈 폴더) | 실측 | Low-Medium |

### 5.10 2차 보완 감사 결과 (08–12 보고서 + Opus 검증)

**AI 채팅·오케스트레이션 (08)** — 판정: 반환각 설계는 이 저장소에서 가장 강한 부분.
- 강점(보존): 스트리밍 중 원문을 노출하지 않고 `[AI_ANSWER_PLAN]` JSON이 완성·검증될 때까지 "검증 중" 표시, **수치 주장을 주입된 증거 행과 값·단위·종목·지표·기준시각·출처 단위로 대조**(`_aioBuildPublishableAnswerPlan`), 프롬프트 캐싱(정적/동적 분리, `cache_control`) 정상, 채팅 기록 기본 OFF·로컬·마스킹, CI가 `aio-chat.js` 실제 소스를 VM에서 실행. 두 진입점이 단일 게이트(`_aioApplyAIActionGate`)로 수렴.
- **F-41** (High) 헌장 `personalizedDirectActionDefault: BLOCKED`와 달리 적합성 프로필 없는 개인화 매매 요청은 **차단이 아니라 배너만**(P1120 설계). 가족 실매매 맥락에서는 어느 쪽이 맞는지 운영자 결정 필요(D14).
- **F-42** (High) 모든 정책·검증이 **브라우저 JS에만** 있음 — Worker `/anthropic`은 전송 통제만. UI를 우회하면 정책 전부 우회(F-08과 결합). Access 도입 시 위험 대폭 감소, 최소 정책 하한을 Worker로 이동 권장.
- F-43 (High) Haiku/Sonnet/Sonnet-Thinking 승격이 정규식 휴리스틱이며 정확도 측정 없음. `eval/benchmark.js`는 의도 분류만 측정, **답변 품질 평가셋 없음**.
- Medium: `src/ai/context-builder.js`, `retrieval/evidence.js`(`AIO.getAIContext`) 호출처 0(죽은 코드), 인젝션 의심 외부 텍스트는 표시만 하고 제거하지 않음.

**스크리너·데이터 계층·SEC (09)**
- **F-40** (Critical, **Opus 실측 확인**) 스크리너의 실시간 가격 우선 로직이 **구조적으로 영구 비활성**: `applyLiveQuotes`(`js/aio-data.js:14782–14798`)가 `allowedUseCeiling`·`rightsId`를 넘기지만 `PriceStore.set`(`js/aio-core.js:19364–19412`)이 이 두 필드를 `_liveData`에 저장하지 않음 → `providers/screener.js:315–321`의 `liveEvidenceEligible`이 항상 false → **모든 행이 마지막 파이프라인 가격**(실측 주기 ~3시간, 주말 정지). 가족 실매매에 직결.
- F-44 (High) 증거 봉투가 **3+1종** 공존(contracts/evidence.js, contracts/screener.js 관측 봉투, 레거시 임의 lineage, facade의 오리 타이핑) — 변환기 없음.
- F-45 (High) native evidenceStore/빠른 플레인은 **AI 채팅에만** 연결 — 스크리너·시장·심리·포트폴리오는 여전히 레거시 `_liveData`(브라우저 프록시 수집)만 읽음. "CORS 프록시 탈피"는 AI 채팅에서만 실현.
- F-46 (Medium) 고아 모듈 5개(refresh-planner, return-contract, regime(히스테리시스 상태기계 전체 미사용), provider-capability, pit-validation). 실제 레짐은 `factor-weights.js`의 더 단순한 경쟁 구현.
- F-47 (Medium) SEC P/E·P/B가 TTM이 아닌 직전 회계연도 기준, 최대 ~550일 된 값 허용 — JSON 메타에는 공개, 화면 열 이름엔 미표시. 팩터 가중치 벡터는 실제로 **3종**(런타임은 `factor-weights.js NEUTRAL`).
- 보존: `contracts/evidence.js`, `factor-ranks.js`(커버리지·이상치·섹터 중립), `screen-engine.js`(3값 필터·재현 검증), `fetch-sec-fundamentals.mjs`(IFRS 제외, PIT 추적), `artifact-cache.js`.

**지식·아틀라스·13F (10)**
- **F-48** (Critical) `public-data/objects/masters`는 **가지치기 0** + 해시 대상에 매 실행 새 `generatedAt`이 들어가 **내용 주소화가 무력화** → 매일 운용사 수(37)만큼 객체 증가(15일간 333→1,036), 연 ~3GB, 새 정보 0(13F는 분기·45일 지연).
- **F-49** (Critical) 314MB 전체 운용사 샤드를 매일 재커밋하지만 **브라우저는 한 번도 읽지 않음**(요약+≤512KB 투영만 사용) — 빌드용 재료가 저장소·Pages 비용을 차지.
- F-50 (High) 2023년 SEC 13F 금액 단위 변경(천 달러→달러) 가드 없음 — 현재 12분기 깊이라 무해하나 확장 시 1,000배 오류.
- Medium: `build-principles-lessons.mjs` 103KB의 ~95%가 한국어 강의 본문 리터럴(유지보수 문제, 저작권 문제 아님), 분기 데이터를 매일 수집, 브라우저 SHA-256 재검증은 동일 출처 HTTPS에서 실익 적음.
- 검증된 강점: SEC fair-access 준수(UA·125/1100ms 간격·백오프), 13F 정정(RESTATEMENT vs NEW HOLDINGS) 정확, CUSIP→티커 **추정 생성 안 함**, 지식 JSON에 200자 이상 원문 복제 없음, `rosy-license-circumvention`은 **저장 거부된 차단 항목**(좋은 거버넌스), 검토 상태(455단위, 인간 검토 미완)를 사용자에게 배지로 공개.

**포트폴리오·KR·뉴스·매크로·옵션 (11)**
- 포트폴리오는 저장소에서 **가장 방어적으로 설계된 영역**(원가≠시가, 결측→null, FX 삼각환산·암묵 1:1·72h 초과 거부, 선언 원장 없이는 TWR/MWR 거부, VaR/CVaR 표본 인증).
- **F-51** (High, **Opus 실측 확인**) `exportPortfolio()`(`js/aio-workspace.js:1850`)가 **포지션 배열만** 저장 — 계좌 원장, 선언 FX 레그, 기준통화·현금·무위험수익률·리밸런싱 가정 전부 누락, "백업"이 부분임을 알리지 않음. localStorage 축출(F-21)과 결합하면 실데이터 손실.
- **F-52** (High) 로컬 미커밋 `src/domain/news/scoring.js` 변경이 헤드라인만 있는 뉴스를 걸러내는 적격성 게이트를 추가하지만 **최소 표본 수 게이트가 없어** 적격 기사 1건으로 뉴스 점수 100/"강한 낙관" 가능 → 매매점수 합성에 `.score`만 투입(`js/aio-core.js:23680`). 이 diff를 배포하기 전 `total<N → 보류` 필요.
- F-53 (Medium) `_getKrxSession()`/`_getUsSession()`이 요일·시각만 봄 — 휴장일에도 "장중" 표시. KR 시세는 Yahoo `.KS/.KQ` + Naver 비공개 모바일 API(프록시) — 비공식임은 source-registry에 공개돼 있으나 미해결.
- 해결 확인: VKOSPI 정적값 버그 수정됨(3포인트 미만이면 "결측"), "[번역 대기]" 고착 해결, HYG 프록시 → FRED 실제 시리즈 전환. 옵션 페이지는 체인·Greeks·IV Rank 부재를 정직하게 고지.

**라이브 20개 라우트 순회 (12)**
- **F-54** (Critical) 개발 문자열 노출: `#options` 신선도 라벨 "DATA_SNAPSHOT", `#screener` 배너 "mic_missing·asset_type_missing·currency_missing", "SEC FY sec-fy-normalized-v2 562/655", "github-actions:yahoo-1y", "preset-balanced(75f90624)"(모바일에선 첫 화면 전체를 차지), 테마 상세 "레거시 secondary surface", `#atlas` "atlas:compute-gpu" 등 내부 ID.
- **F-55** (Critical, **Opus 실측 확인**) `#briefing` "마지막 갱신: 2026-04-17 (1일 경과)" — 날짜가 **HTML에 고정 문자열**로 박혀 있고 경과일만 동적 → 5개월 전 날짜 옆에 "1일 경과".
- F-56 (High) 헤더 배지는 "실시간/LIVE"인데 실제 스냅샷은 31시간 전 — 정직한 경고는 사이드바 진단 패널에만.
- F-57 (High) `#technical`이 Weinstein "1 바닥 형성"과 "전 시간대 상승 정배열"을 동시에 표시(F-14 명칭 문제의 가시 피해). `#signal` 제목 "지금 거래해야 할까?"(명령형 프레이밍).
- Medium: `#macro` "수익률 곡선 관측값 미수신" 바로 위에 "2s10s +0.36%p", 뉴스 "0건" 표시 아래 8–12건 렌더, 텔레그램 발췌에 `&#036;500` 미해제 엔티티. 모든 라우트에서 로드마다 외부 오류 20+건.
- 강점: 모든 라우트 하단 면책 일관, 가이드의 위험·AI 한계 고지 명확("잃어도 되는 돈만"), breadth·sentiment·ticker의 정직한 빈 상태, masters 면책 규율 최상.
- 없음: 별도 개인정보처리방침·이용약관 페이지, 운영 주체·이메일 연락처, 통합 데이터 출처·라이선스 페이지.
- 정보구조 권고: 20라우트 → 4–5 목적지(오늘 / 시장 분석 / 리서치 도구 / 포트폴리오·학습), home+briefing+market-news 통합(같은 데이터를 다른 신선도 라벨로 중복 서술 — 페이지 간 모순의 근원).

### 5.9 반드시 보존할 것 (재설계 시 버리지 말 것)

1. **증거 정책**: `allowedUse`(none/reference/decision), missing≠0, fail-closed, `predictiveValidation` 게이팅.
2. **단일 배포 경로 + attestation + exact-SHA 수렴 확인**(`pages-deploy.yml`, `deployment.json`).
3. **`verify-refresh-candidate.mjs` record/expect 프로토콜**(TOCTOU 방지).
4. **Worker의 DO 원자 쿼터·관할 고정·SSRF 차단·오프라인 계약 테스트**.
5. **골든 픽스처 패리티**(`ci-domain-parity-check.mjs` + `dump-*-fixtures.mjs`) — 추출 리팩터의 안전망.
6. **반복 버그 클래스 표 14개** — 새 체계의 "교훈 → 실행 가능한 테스트" 원천.
7. **Playwright 기반 행동 게이트 ~24개**, `agent-hook.mjs`.
8. **src/의 lifecycle/라우터/스토어 설계**, `route-owners.json`의 `fullNativeOwner` 지표(백로그로 재사용).
9. **다크런치된 fast data-plane Worker**(이미 작동, 승격 절차만 남음).

---

## 6. 하위 에이전트 결론 간 충돌·오류 판정

| # | 쟁점 | A 주장 | B 주장 | Opus 판정 |
|---|---|---|---|---|
| 1 | 현재 배포 정지의 원인 | 02: screener-universe 73일 stale | 36-RECONCILIATION(로컬 문서): data.json/market-snapshot 신선도 | [실측] screener-universe 줄은 **WARN**. 주말 실패 패턴 + attempt=failed + 로컬 재현 기록 → **주말 비인지 SLA → refresh 전면 실패 → 핫 데이터 stale**이 원인. 당시 exact FAIL 줄은 CI 로그 절단으로 미검증이었으나, 2026-09-28 CI #36352319347의 `[qa] FAIL data-lineage (1072ms)`로 게이트 행은 확인됐다. 파일별 세부 원인은 여전히 직접 미확인 |
| 2 | 데이터를 git에 두는 것 | 03: 5명 규모엔 괜찮음 | 01/02: Critical | **둘 다 부분적으로 맞음.** 작은 핫 투영(data.json 110KB, market-snapshot 14KB, operations-status)은 단기 유지 가능. **대용량(masters 샤드·objects·sec-fundamentals·history·telegram)은 즉시 git 밖으로.** 판단 기준은 사용자 수가 아니라 증가율(11–14MB/일)과 Pages 1GB 한도 |
| 3 | 게이트 품질 | 07: 행동 테스트는 절반 미만 | 02: 표본 73%가 행동/구조 검증 | 분류 기준 차이(02는 소스 정규식 검사도 "행동"으로 셈). 합의 가능한 사실: **실제 브라우저 행동 게이트 24/129(~19%)**, 문서 직접 참조 12–22개. 더 중요한 문제는 비율이 아니라 **140개 전부 hard-blocking이고 배포가 제품과 무관한 조건에 묶인 것** |
| 4 | Worker 분리 | 03: 3개로 쪼개지 말 것 | — | 동의. 공통 CORS/Origin 모듈만 추출. 단 호스팅을 Cloudflare로 통합하면(§7) 라우팅 구조가 바뀌므로 그때 재평가 |
| 5 | debug.log 추적 여부 | 07: 추적됨 | 05: 과거 3커밋에 추적, 현재 미추적 | [실측] **현재 추적 안 됨**(`git ls-files debug.log` = 0), 이력에는 존재(05). 07 오류. 내용 무해 |
| 5b | main 브랜치 보호 | 05: 보호 없음 | — | [실측] 보호 객체 존재(force-push·삭제 금지), **필수 체크·리뷰만 없음**. 05 부정확 |
| 6 | 규칙 수 | 01: R 178개 | 07: R1–R632, 헤딩 571 | [실측] CURRENT-STATE "latest rule R632", 헤딩 571이 정확. 01 오류 |
| 7 | public-data 추적 크기 | Opus 1차 계산: 47MB | 01: 596MB | [실측] Opus 1차 계산은 `xargs` 배치 합계 오류. **596MB가 맞음** |
| 8 | Vite 도입 시점 | 04: 지금 | ADR-0002: 보류 | 04 동의. 단 **Phase 0–1(운영 안정화) 이후**. 지금 도입하면 게이트 140개와 충돌해 또 하나의 정지 원인이 됨 |

---

## 7. "내가 만든다면" — 목표 아키텍처와 비교

### 7.1 설계 원칙 (현재 헌장 원칙을 계승하되 운영 형식을 단순화)

1. **코드와 데이터는 다른 수명주기를 가진다** — 배포 파이프라인을 분리한다. 데이터 사고가 코드 배포를 막지 않고, 코드 게이트가 데이터 신선도를 검사하지 않는다. 데이터 상태는 UI가 정직하게 표시한다(이미 있는 degraded/stale 원칙).
2. **시간은 거래 세션 단위로 잰다** — 모든 신선도 SLA는 "마지막 정규장 이후 N세션/다음 개장 후 N시간"으로 표현하고, 캘린더는 한 모듈·한 데이터 파일에서만 나온다.
3. **게이트는 적고, 행동을 검사하고, 심각도를 가진다** — block/warn/info. 문서 문자열·다른 게이트·원장을 검사하는 게이트는 두지 않는다.
4. **레거시 퇴역은 삭제 줄수로 측정한다** — native 래퍼 추가는 진척이 아니다.
5. **사람이 기억해야 하는 규칙은 10개 이하** — 나머지는 테스트·타입·권한·브랜치 보호로 강제한다.
6. **관측 가능한 것만 운영할 수 있다** — 클라이언트 오류·사용량·파이프라인 SLO가 한 화면에 보여야 한다.

### 7.2 현재 vs 목표 비교표

| 관심사 | 현재 | 목표(권고) | 왜 | 비용/트레이드오프 |
|---|---|---|---|---|
| 호스팅 | GitHub Pages(정적) + workers.dev | **1안(권고, Phase 3)**: Cloudflare Workers Static Assets/Pages로 통합 + 커스텀 도메인. **2안**: GitHub Pages 유지 | `_headers`/CSP가 실제로 적용됨, WAF·Rate limit 규칙 사용 가능, R2 데이터를 같은 출처로 서빙, 배포 1회로 코드+엣지 | 벤더 집중(이미 AI·데이터가 CF 의존). 도메인 비용 소액 |
| 데이터 저장 | `public-data/`를 main에 매 사이클 커밋 | **R2 버킷** 불변 객체 `v/{revision}/…` + 작은 `latest.json` 매니페스트(원자 교체), 보존 정책(최근 N개 + 일별 스냅샷) | git 비대화·병합 충돌·Pages 한도 제거, 롤백 = 매니페스트 포인터 교체 | 새 자격증명, 로더 경로 변경. 무료 한도 10GB·Class A 100만/월 |
| 스케줄러 | GH cron 30분(실측 3h) + 6h + 일간 | **빠른 레인(≤30분)**: Cloudflare Cron Worker(이미 존재하는 data-plane 확장). **느린 레인(6h+, SEC/13F/지식)**: GH Actions 유지 | GH는 6h 주기는 지키고 30분은 못 지킴(실측) | 수집 로직 일부를 Worker 호환으로 이식 |
| 데이터 발행 | 한 워크플로에서 전 레인 all-or-nothing | **레인별 독립 발행**(시세/매크로/뉴스/텔레그램/SEC/13F), 각 레인은 자기 스키마·신선도 계약만 통과하면 발행 | 한 레인 실패가 다른 레인을 굶기지 않음 | 매니페스트에 레인별 revision |
| 신선도 판정 | 벽시계 시간 SLA, 캘린더 2곳 하드코딩 | `packages/core/calendar`: KRX/NYSE 연도별 휴장·반일장 데이터 파일(연 1회 생성·검증) + 세션 기반 SLA 함수. 파이프라인·게이트·클라이언트 공용 | 주말 정지·2027 절벽·DST 문제 동시 해결 | 연 1회 캘린더 갱신 작업(만료 60일 전 경고) |
| 코드 구조 | index.html 1MB + js/ 82.7K + src/ 34.3K, 번들러 없음 | 워크스페이스: `packages/core`(TS 순수 도메인·지표·계약·zod 스키마), `apps/web`(Vite+TS, 라우트 분할), `pipeline`(Node, core 재사용), `edge`(Workers, Hono, wrangler는 devDependency) | 타입이 전역 충돌·로드 순서 문제를 구조적으로 제거, 파이프라인과 클라이언트가 같은 계약 사용 | 빌드 단계 도입. `allowJs`로 점진 전환 |
| 부팅 | 모든 라우트에 5.7MB JSON + AI 서브시스템 + 3rd-party 55회 | 셸 + 현재 라우트 청크 + 라우트가 선언한 데이터만. AI는 채팅 열 때 로딩. 외부 피드는 **파이프라인/Worker가 수집**하고 브라우저는 우리 출처만 호출 | 첫 로드 목표: JS ≤300KB gz, 데이터 ≤300KB, 요청 ≤30 | 라우트별 데이터 의존성 선언 필요 |
| 계산 위치 | 레거시 클라이언트 + native + 파이프라인 일부 | **점수·지표는 파이프라인에서 1회 계산**, 브라우저는 버전 붙은 결과를 렌더(사용자 포트폴리오 등 개인 계산만 클라이언트) | 드리프트가 구조적으로 불가능 | 인터랙티브 파라미터 변경 기능은 core 라이브러리를 클라이언트에서도 import |
| 전역 상태 | 753 window 전역 + aio:* 이벤트 39종 | 모듈 import + 단일 스토어 + 타입 있는 이벤트 계약. `window.AIO`는 디버그 콘솔용 읽기 전용 파사드 1개 | P1132/P1135 클래스 제거 | 라우트별 점진 제거 |
| 테스트 | 자작 하네스 3종 + ci 129개 | **Vitest**(core·data 단위, <2분) → **Playwright Test**(라우트별 스모크 20개, <8분) → 야간 확장(시각·a11y·외부 라이브·골든 벡터). 골든 벡터는 TA-Lib/pandas-ta 산출값 | 빠른 필수 계층 + 느린 비차단 계층 | 기존 행동 게이트를 스펙으로 이식 |
| CI 게이트 | 140 슬롯 전부 hard, 20+45+60+15분 예산 | PR 필수 ≤10분(타입·단위·스모크·보안 래칫), main 머지 후 배포, 나머지는 야간/주간 **warn** + 이슈 자동 생성 | 적색을 "예외 상태"로 되돌림 | 일부 회귀는 늦게 발견 — 야간 결과를 다음 배포 전 확인 |
| 배포 | CI attestation → Pages, Worker는 수동 dispatch | main 머지 = 웹+엣지 동시 배포(버전 태그), `wrangler versions` 점진 배포·원클릭 롤백, 데이터는 독립 | 드리프트 제거 | — |
| 버전 | 수동 bump 7지점, 진척 카운터 | Conventional Commits + 자동 semver 태그(배포마다 1개), CHANGELOG 자동 생성, `version.json`은 빌드가 주입 | 버전 = 배포된 실체 | 기존 v56.x 이후 v57.0.0부터 |
| 변경 단위 | 대형 배치 커밋, 단일 봇 신원, PR 없음 | **작업당 브랜치+PR**(에이전트가 생성, 사용자는 머지만 승인), 커밋 트레일러 `Agent: <tool>/<model>`, main 보호(필수 체크) | bisect·리뷰·귀속 복구, "자동 푸시 금지"를 권한으로 강제 | 사용자 승인 1클릭 |
| 지식/거버넌스 | RULES 571 + P 1,282 + QA 731 + 핸드오프 30+ | `docs/adr/`(~15–20개), `ARCHITECTURE.md`(≤300줄), `LESSONS.md`(~30개, 각 항목이 테스트에 링크), GitHub Issues(열린 작업), `AGENTS.md` ≤150줄(CLAUDE.md는 import만) | 사람과 에이전트가 기억 가능한 크기 | 1회 증류 작업(§8 Phase 1) |
| AI 릴레이 인증 | Origin + 공개 토큰 | Turnstile → Worker가 5분짜리 HMAC 세션 토큰 발급 → DO 쿼터를 세션/사용자 키별로 | curl 남용 차단, 사용자별 예산 | 무료 |
| 관측성 | 브라우저 내부 로그, 워치독 79% 적색 | 클라이언트 오류 비콘 → Worker → Analytics Engine(PII 없음), 파이프라인 SLO를 `status.json`+상태 페이지로, 알림은 **행동 가능한 3종**(배포 정지 >6h, 핫 데이터 >2세션 stale, LLM 캡 80%) | 운영자가 사용자 장애를 봄 | — |
| 사용자 데이터 | localStorage, persist 없음 | IndexedDB + `storage.persist()` + 스키마 버전·마이그레이션 + 전체 백업/복원 JSON + (vault는) 패스프레이즈 파생 키 | 축출·스키마 변경에서 데이터 보존 | — |
| 모델 ID | 5곳 하드코딩 | `edge`의 모델 레지스트리 1곳 + `/health`로 노출 + 배포 스모크가 모든 티어 호출 | 모델 교체 1지점 | 스모크 비용 소액 |
| 분석 정직성 | 음의 IC 지표가 히어로 | 모델 카드(방법론·명칭 차이·검증일·유의성), 음의 IC 지표는 히어로에서 내리거나 재설계, Newey-West/블록 부트스트랩 유의성 | 초보 사용자 오인 방지, 규제 리스크 완화 | 히어로 UX 재설계 |

### 7.3 목표 토폴로지

```
[GitHub]  code repo (main 보호, PR 필수)
   │  PR → CI(≤10분: typecheck·vitest·playwright smoke·security ratchet)
   │  merge → build(Vite) → deploy web+edge (tag vX.Y.Z)   ← 데이터와 무관
   │
   ├─ Actions (느린 레인: 6h/일/주)  SEC · 13F · 지식 빌드 · 유니버스/캘린더 갱신
   │        └─ 검증 통과 레인만 → R2 v/{rev}/lane/*.json → latest.json 원자 교체
   │
[Cloudflare]
   ├─ Cron Worker (빠른 레인: 5–30분) 시세·매크로·뉴스 → KV/R2 → latest.json
   ├─ Edge Worker (Hono): /data/* (R2 서빙, 캐시), /ai (Turnstile+HMAC+DO 쿼터), /relay, /beacon, /health
   ├─ Static Assets (웹 앱)  ← 같은 출처, _headers/CSP 실제 적용
   └─ Analytics Engine: 오류·사용량·SLO
[Browser]  셸 → 라우트 청크 → 라우트 데이터(매니페스트 경유) → 렌더(파이프라인 계산 결과)
```

---

## 8. 개편 로드맵 (단계·진입/종료 기준·롤백)

> **상태: 감사 당시 제안표, 현재 실행 순서로 사용하지 않음 (2026-09-28).** §0.5.6 Family Autopilot 로드맵과 §0의 실행 결정이 이 Phase 0–5 표를 대체한다. 특히 현행 P0는 strict live-core freshness 유지, 정상 scheduled refresh/reconciliation/strict lineage 통과, 그 뒤 exact-SHA release 확인이다. 아래 0-6~0-8 항목은 현재 P0 종료 조건이 아니다: 0-6 설정·정리 작업은 기존 A1/A2 기록과 현재 미검증 상태를 체크리스트에서 따르고, 0-7 캘린더는 P1+ 후속, 0-8 CSP 보강은 P0 배포 뒤 단계가 미분류다. 이를 완료 또는 승인된 작업으로 간주하지 않는다.

> 원칙: 각 단계는 **사이트를 계속 살아 있게** 유지하고, 끝날 때 측정 가능한 종료 기준을 만족해야 다음으로 간다. 모든 코드 변경·커밋·푸시·배포는 사용자 명시 승인 후.

### Phase 0 — 출혈 멈춤 (1–3일)

| # | 작업 | 종료 기준 |
|---|---|---|
| 0-1 | 감사 시점의 로컬 dirty와 origin 차이는 역사적 기준선이다. 현재 변경은 기존 사용자 소유 작업을 보존하고 `EXECUTION-STATUS.md`의 마지막 SHA 관측 및 정확한 작업 소유 파일 목록으로 정리한다. | 정상 refresh/reconciliation 뒤 exact-SHA release 후보만 선별; 사용자 소유 변경은 staging하지 않음 |
| 0-2 | F-01 정밀 진단: 원격 HEAD에서 `ci-data-lineage-audit.mjs` 전체 출력 확보(쓰기 없는지 소스 확인 후), FAIL 줄 확정 | 원인 줄 문서화 |
| 0-3 | 핫픽스 B는 미채택. live-core 12h strict wall-clock freshness, future timestamp reject, stale promotion block을 유지한다. | stale cycle이 A1 CRITICAL/D1 no로 남음 |
| 0-4 | 일반 scheduled producer의 성공을 기다리고 `data.json`·`market-snapshot.json` refresh, reconciliation, strict lineage를 모두 확인한다. 수동 workflow dispatch나 producer 실행은 하지 않는다. | 모두 fresh·published·PASS일 때만 다음 단계 |
| 0-5 | 조건이 충족된 후 task-owned release 파일만 stage하고 exact-SHA CI를 확인한다. conditional user authorization에 따라 commit/push/deploy 뒤 live `deployment.json`의 SHA와 브라우저를 확인한다. | exact SHA CI·Pages 성공, live SHA 수렴 및 외부 QA |
| 0-6 | 위생: secret scanning·push protection·Dependabot 보안 업데이트 활성화(설정 변경 — 사용자가 직접 또는 명시 승인), Dependabot PR 2건 처리, 중복 브랜치·백업 태그 삭제, 로컬 `git gc` | `security_and_analysis` 전부 enabled |
| 0-8 | F-30 임시 조치: `index.html`에 CSP `<meta>` 추가(현 `_headers` 정책 기준, `frame-ancestors`는 meta로 불가하므로 클릭재킹 방어는 Phase 3 호스팅 이전에서 해결). `ci-csp-ratchet`에 **라이브 헤더/메타 검사** 추가 | 라이브 HTML에 CSP 존재, 콘솔 CSP 위반 0 |
| 0-7 | 캘린더 절벽: 2027 US/KR 캘린더를 native·legacy 양쪽에 추가(임시), 만료 60일 전 경고 게이트 | 2027-01-02 고정 now 테스트 통과 |

롤백: 각 핫픽스는 단일 커밋·단일 PR. 게이트 의미를 바꾼 커밋은 되돌리기 쉬운 크기로.

### Phase 1 — 거버넌스 리셋 & CI 계층화 (1–2주)

1. **원장 운영**: 운영자 결정(2026-09-27)에 따라 기존 RULES/BUG-POSTMORTEM/QA-CHECKLIST/CHANGELOG를 계속 사용하고 회귀 추적 항목을 추가한다. 원장 동결/아카이브 전환은 채택되지 않았다.
2. **증류**: 반복 버그 클래스 14개 + 3회 이상 재발 P → `LESSONS.md` ~30개, 각 항목에 (a) 기존 테스트 링크 또는 (b) 작성할 테스트 또는 (c) ADR.
3. **ADR 작성**: 현 R1–R3·R27, 증거 정책, 비목표, 데이터-코드 분리, 캘린더 원칙 등 15–20개.
4. **AGENTS.md 단일화** ≤150줄(CLAUDE.md는 `@AGENTS.md` import), `.agents` 미러·`.codex`·`.commandcode` 정리(사용 도구 결정 후).
5. **게이트 심각도 도입**: `qa-pipeline.json`에 `severity: block|warn|info`. 메타 게이트 6종(`ci-doc-currency`, `ci-ledger-integrity`, `ci-assertion-trace`, `ci-six-doc-coverage`, `ci-workspace-contract`, `ci-knowledge-lint`)과 문서 문자열 결합 단언은 **warn → 주간 워크플로**로 이동 후 삭제.
6. **CI 계층**: PR 필수 ≤10분 / 머지 후 / 야간 비차단.
7. **변경 단위**: 작업 브랜치+PR, 커밋 트레일러, main 브랜치 보호, 배포마다 태그. 에이전트 권한에서 `git push`를 main에 대해 차단(ask).
8. 원장 아카이브: `_context/` 역사 문서 → `docs/archive/2026-q3/`(삭제 아님), `superseded-by` 표식.

종료 기준: CI 필수 계층 p50 ≤10분, 적색률(7일) ≤10%, 에이전트 필독 문서 합계 ≤50KB.

### Phase 2 — 데이터 플레인 분리 (2–4주)

1. R2 버킷·매니페스트 스키마 설계(ADR). 레인별 revision.
2. **파일럿**: 이미 Pages에서 제외된 대용량(`sec-fundamentals.json`, `masters/*` 샤드, `objects/`)을 R2로. 커밋 중단.
3. 핫 데이터(`data.json`, `market-snapshot`, `history`, `screener`, `telegram-digest`)를 매니페스트 경유로 전환, 병행 운용 1주 후 git 커밋 중단.
4. 빠른 레인을 Cloudflare Cron으로(기존 data-plane Worker 확장 — 7일 soak·권리 검토를 이 단계에서 완료).
5. 코드 CI에서 데이터 신선도 게이트 제거 → 데이터 파이프라인 자체 계약 + UI degraded 표시로 대체.
6. 캘린더 모듈 정식화(연간 데이터 파일 + 세션 SLA 함수), 파이프라인·클라이언트·게이트 공용.
7. `fetch-data.mjs`를 레인별 수집기로 분할.

종료 기준: main에 데이터 커밋 0/주, 저장소 증가 <5MB/주, 주말 배포 정지 0, 레인 독립 발행 확인. 이력 재작성(filter-repo)은 **하지 않는다**(별도 결정 사항).

### Phase 3 — 프론트엔드 빌드 & 부팅 다이어트 (4–6주, Phase 2와 부분 병행 가능)

1. Vite를 `src/app/bootstrap.js` 엔트리로 도입(동작 변화 0), 레거시 script 태그는 그대로.
2. AI 서브시스템 청크 분리, 라우트 데이터 지연 로딩(부팅 JSON 5.7MB → ≤300KB).
3. 외부 RSS/시세 호출을 브라우저에서 제거하고 파이프라인/Worker로 이동, 남는 호출은 단일 fetch 헬퍼 + 서킷 브레이커.
4. SRI 불일치 수정, 캐시버스터 규약 통일(매니페스트 revision).
5. 오류 비콘 + 사용량 계측(개인정보 없는 라우트 조회 수).
6. `src/` TS 전환(leaf-first, `allowJs`), Vitest 도입, `ci-esm-core-unit-check` 단언 이식.
7. 사용자 데이터: IndexedDB+persist+백업/복원.
8. (결정 시) 호스팅을 Cloudflare Static Assets로 이전.

종료 기준(모바일 4G 기준): 첫 로드 요청 ≤40, 전송 ≤1MB, 콘솔 오류 0, LCP ≤2.5s.

### Phase 4 — 레거시 퇴역 (지속, 라우트당 1 PR)

- `route-owners.json`의 `fullNativeOwner=false` 15개를 **단순한 것부터** 하나씩: native 완성 → 레거시 렌더러·차트·전역 **같은 PR에서 삭제** → 행동 스모크 통과.
- 진척 지표: `js/` 줄수(주간), 고유 window 전역 수, aio-core 상한은 **하향만** 허용.
- `DATA_SNAPSHOT`/`SCREENER_DB`/`CHAT_CONTEXTS`를 데이터 플레인의 "편집 콘텐츠" 레인으로 이동(소유자·만료일·스키마).
- `js/aio-tests.js`는 대상 레거시가 삭제될 때 함께 퇴역.

종료 기준: fullNativeOwner 20/20, `js/` 0줄, index.html ≤ 500줄 셸.

### Phase 5 — 분석 정직성 & 제품 초점 (Phase 3 이후, 병행 가능)

1. 모델 카드: 매매점수·RRG·Stage·VCP·실행창 — 방법론, 명칭과의 차이, 검증 상태, 유의성.
2. 명칭 정정 또는 구현 보강(RRG z-score 정규화, 주봉 30주선 Stage, Minervini 8조건).
3. 매매점수: 히어로에서 내리거나 재설계(walk-forward, 유효표본 보정). 결정 D6.
4. TA-Lib/pandas-ta 골든 벡터 CI.
5. PIT 유니버스(상장폐지 포함) 데이터 공급 → `pit-validation` 실제 호출.
6. 사용량 데이터 기반 라우트 정리(통합·퇴역), 코어 워크플로 재정의.
7. 법률 검토(데이터 재배포 권리, 유사투자자문, AI 기본법) — 공개 확대·수익화 전 필수.

---

## 9. 사용자 결정이 필요한 사항

| ID | 결정 | 선택지 | Opus 권고 |
|---|---|---|---|
| D0 | 현재 사고 대응 | A 정상 scheduled refresh 대기 / B freshness grace / C 레인 분리 / D 데이터-코드 분리 | **A 선택: strict freshness 유지, 정상 refresh/reconciliation 뒤 배포** |
| D1 | 로컬 dirty 작업 처리 | 분할 커밋 / 보류 / 일부 폐기 | 기존 사용자 소유 변경을 보존. 정상 P0 close 전에 commit하지 않으며 `git add -A` 금지. release 때 task-owned 파일만 선별 |
| D2 | 데이터 저장소 | R2 / orphan `data` 브랜치 / GitHub Releases | **R2**(이미 CF 사용, Pages 한도 회피) |
| D3 | 호스팅 | GitHub Pages 유지 / Cloudflare 통합 | Phase 3에서 **Cloudflare 통합** 권고(CSP·WAF·동일 출처) |
| D4 | 거버넌스 리셋 | 원장 동결+ADR/LESSONS/Issues 전환 / 현행 유지 | **현행 P/R/QA 원장 유지, 신규 회귀 항목 추가 선택** |
| D5 | 빌드 도구 | Vite+TS / 번들러 없음 유지 | **Vite+TS**(Phase 3) |
| D6 | 매매점수 | 재설계 / 히어로에서 제외 후 참고지표로 / 현행 | **히어로 제외 + 재설계 연구 트랙** |
| D7 | 변경 흐름 | 에이전트가 브랜치 커밋+PR 생성, 사용자는 머지만 승인 / 현행(로컬 누적 후 일괄) | **PR 흐름**("자동 푸시 금지"를 권한·브랜치 보호로 강제) |
| D8 | 공개 범위 | 저장소 public 유지+LICENSE 추가 / private 전환(Pages는 유료 플랜 필요, CF 호스팅이면 무관) | CF 호스팅 전환 시 **private 전환** 검토, 유지 시 LICENSE 명시 |
| D9 | 범위 | 20라우트 유지 / 사용 측정 후 통합·퇴역 | **측정 4주 후 결정** |
| D10 | 사용 에이전트 도구 | Claude/Codex/Command Code 병행 / 1–2개로 축소 | 설정 표면 축소(유지할 도구만 AGENTS.md 기준) |
| D11 | 법률 검토 | 지금 / 공개 확대 전 | **공개 확대·수익화 전 필수**, 데이터 재배포는 Phase 2 설계 시 반영 |
| D12 | ICE HY OAS 원값 공개 게시 | 즉시 중단 / Access 뒤로 이동 시 해소 / 유지 | **P2(Access) 전까지 공개 JSON에서 원값 제외 검토** |
| D13 | 운영 범위 원칙 | "무료·가족/지인 한정·유료화 안 함" 명문화 / 미정 | **명문화**(규제 노출의 핵심 경계) |
| D14 | 개인화 매매 요청(AI) | 차단 / 배너 후 응답(현행) | 가족 실매매 맥락 — **적합성 입력(투자기간·위험성향) 없이는 일반론만 답하는 절충** 권고 |
| D15 | 사이트 접근 | Cloudflare Access(가족 이메일) / 공개 유지 | **Access** (무료 50명) |

> **§0.5 반영 후 권고 변경**: D3는 "Phase 3"이 아니라 **P2에서 Cloudflare 호스팅+Access**로 앞당긴다. D5(Vite+TS)는 가족 규모에서 우선순위를 낮춘다(P5 선택). D8은 **코드 저장소 public 유지(Actions 무료) + 데이터·키는 저장소 밖**으로 확정 권고 — private 전환 시 실측 사용량(~7,000분/월)이 무료 한도(2,000분)를 넘는다.

---

## 10. 다음 에이전트 실행 규칙 (이 핸드오프 기준)

1. 작업 경로는 `C:\projects\AIO`. 옛 OneDrive 경로는 빈 폴더다.
2. **기존 dirty 변경은 사용자 소유.** 덮어쓰기·stash·checkout 금지. 시작 전 `git status --short`로 경계 확인.
3. `node`는 PATH에 없을 수 있다: `export PATH="/c/Program Files/nodejs:$PATH"`.
4. **로컬에서 `scripts/fetch-*.mjs`·`build-*.mjs`·`refresh-*`를 실행하지 말 것** — 라이브 API 호출 + `public-data` 덮어쓰기(과거 `screener.json` 0바이트 사고).
5. 커밋·푸시·배포·워크플로 dispatch는 사용자 명시 요청 시에만. "완료/전부 고쳐"는 배포 승인이 아니다.
6. 게이트 의미를 바꾸는 변경은 **고정 시각(주말·휴장·2027-01-02·DST 경계) 테스트**를 동반한다.
7. 증거 수준(정적/헤드리스/브라우저/라이브)을 섞지 말 것. 로컬 PASS ≠ 라이브.
8. D4는 기존 P/R/QA 원장을 유지하고 신규 추적을 추가하기로 결정됐다. 향후 동결·아카이브 전환은 새 사용자 결정 전까지 실행하지 않는다.
9. 이 문서의 Phase 순서를 건너뛰지 말 것. 특히 Phase 0 없이 Phase 3(Vite)을 시작하면 게이트 140개와 충돌한다.
10. 대형 원장은 전체 로드 금지(검색만).

---

## 11. 미검증 목록 (후속 확인 필요)

> **U1 완료 (2026-09-28 KST):** exact-SHA CI #36352319347의 전체 failed-job 로그에 `[qa] FAIL data-lineage (1072ms)`가 있어 요청된 정확한 게이트 FAIL 줄을 확인했다. 이 줄은 실패한 게이트를 특정하지만 `live-core`의 파일별 원인까지 제공하지 않는다. 원격 실패 diagnostic artifact는 계속 없으므로 QA-DATA-32는 별도 미완료로 남는다.

> **U2 코드 경로 확인 (2026-09-28 KST):** producer의 coverage/quality 조건, failed status와 LKG 보존, 개별 venue/session grace와 별도 A1 artifact-age gate를 추적했다. U2의 code-path 확인은 완료지만 과거 run의 실제 blocked row는 여전히 미확인이다.

| # | 항목 | 확인 방법 |
|---|---|---|
| U3 | `claude-sonnet-4-6` 유효성 | Anthropic 모델 목록 확인(과금 없는 방법으로) |
| U4 | 전 녹색 CI의 실제 소요 시간 | 복구 후 1회 측정 |
| U5 | Telegram/Yahoo/CNN/Cboe/AAII 약관상 재배포 가능 여부 | 법률·약관 검토 |
| U6 | 13F 45일 제출 지연의 stale 계산 위치 | masters 파이프라인 `filedAt` 산술 grep |
| U7 | 실행창(`computeExecutionWindow`) 렌더 지점의 면책 문구 | 라이브 DOM 확인 |
| U8 | Cloudflare 로그의 IP 보존·샘플링 설정 | 대시보드 확인 |
| U9 | P740의 모순 수치가 문서에 여전히 남아 있는지 | 해당 3개 문서 해당 구간 확인 |
| U10 | innerHTML 372곳 전수 sanitizer 경유 여부(05는 고위험 경로만 확인) | sink별 호출 경로 전수 추적 |
| U11 | UI의 "AES-256" 문구가 PIN 미설정 상태에서 표시되는지 | 라이브 vault 화면 확인 |
| U12 | CodeQL/code scanning 상태 | `gh api .../code-scanning/alerts` → 분석 없음 확인 |
| U13 | Cloudflare Access를 workers.dev/pages.dev에 직접 붙일 수 있는지, 커스텀 도메인이 필요한지 | Cloudflare 문서·대시보드에서 도입 시 확인 |
| U14 | 뉴스 적격성 게이트(40자 본문)가 실제 RSS에서 몇 건을 남기는지 | 라이브 피드 캡처 |
| U15 | 생산자 COMP_W vs 런타임 NEUTRAL 가중치가 공개 screener.json 표시값에서 실제로 갈리는지 | 산출물 대조 |

---

## 12. 부록 — 증거 색인

- 라이브: `https://ysnle.github.io/aio-screener/version.json`, `/deployment.json`, `https://aio-proxy.zmfhd007.workers.dev/health`
- CI 실패: run `36297988434`(job `108560418144`), refresh 실패: run `36298287184`
- 운영 이슈: #2 CI failure, #4 watchdog failure, #5 refresh failure
- 핵심 파일: `.github/workflows/{ci,pages-deploy,refresh-data,refresh-screener,data-watchdog,operations-alert,deploy-ai-proxy,deploy-data-plane,knowledge-lint}.yml`, `scripts/ci-data-lineage-audit.mjs`, `scripts/qa-runner.mjs`, `architecture/qa-pipeline.json`, `architecture/route-owners.json`, `architecture/product-charter.json`, `cloudflare-worker-proxy.js`, `worker/data-plane.js`, `src/ai/time/market-session.js`, `js/aio-core.js:22828–22907`(휴장), `js/aio-core.js:9–20,121`(오류 핸들러), `public-artifact-manifest.json`, `.claude/settings.local.json`
- 오늘 로컬 미추적 문서(다른 에이전트 작성): `_artifacts/structural-handoff-20260919/35-FINAL-IMPLEMENTATION-CROSSWALK-20260926.md`, `36-LIVE-REMOTE-RECONCILIATION-20260927.md`
- 부록 index: `appendix/01`–`12`는 최초 영역별 감사 보고서, `13`–`16`은 route group 감사, `15b`는 themes/fundamental/ticker 추가 감사다. `17`은 as-is architecture snapshot, `18`은 algorithm/score/signal/threshold catalog, `19`와 `19b`–`19d`는 data-lineage 본문 및 세부 map, `20`은 holistic UI/UX·design-system 검토다. 2026-09-28 보완 감사 `21`–`27`(교육 콘텐츠, 표시 문자열, 상호작용, 모바일·테마·상태·성능, 수치, 한국 투자자 도메인, 로컬↔라이브) 및 교차확인 메모가 포함돼 있다. `appendix/23-interaction-clickthrough.md`와 V2 §10.4의 N24–N33 요약은 존재한다. 부록 23은 라이브 v56.33 상호작용 관측이며, V2 N26은 로컬 소스의 접힌 `details#kr-integrated-themes`를 근거로 한다. 라이브와 로컬 증거 범위를 구분하고, 둘 다 현재 live/local 동작의 인수 증거로 승격하지 않는다.
- [`V2-BLUEPRINT.md`](./V2-BLUEPRINT.md)는 Foundation 설계를 상세화한 검토 제안이다. P0의 M0 종료 기준은 D0와 맞지만, weekend grace·정적 만료 완화, 기존 P1–P5 순서를 건너뛰는 M1 착수, 6개 목적지, 새 저장소·호스팅·프레임워크·원장 이관은 승인된 결정이 아니다. 부록 23의 라이브 관측과 로컬 코드 근거는 버전·범위가 다르므로, 기존 약 24개 행동 게이트 ↔ F1–F5 대응표를 검토하기 전 기존 게이트를 대체하거나 현재 상호작용 인수를 완료로 주장하지 않는다. 현재 순서는 승인된 HANDOFF P0 → P1 → P2 → P3 → P4 → 선택 P5를 따른다.
- 보완 보고서의 증거 한계: `21`은 Atlas 대형 자료 및 13F holdings를 전수 검증하지 않았고, `24`는 라이브 v56.33의 17개 구 내비게이션 route 관측이며 실기기·스크린리더·모든 route 다크모드/성능을 검증하지 않았다. `25`는 v56.33 및 기록된 산출물의 제한된 표본을 재계산했다. `26`의 세금·KRX/NXT 제도 주장은 공식 원천과 시행일 재검증 전 제품 문구로 쓰지 않는다. `27`은 예산 제한 read-only 비교이며 F-52 로컬 수정은 미배포, `CANNOT-TELL` 항목은 미해결·미검증으로 유지한다. 이 부록들은 감사 시점 근거이지 현재 라이브 인수 증거가 아니다.
- 증거 시점: `13`–`16`, `15b`, `20`의 live route 관측은 보고서에 기록된 v56.33 기준이다. 일부 로컬 코드 대조와 `17` architecture snapshot은 최대 v56.58이며, 현재 저장소 v56.61에서 다시 확인하지 않았다. 따라서 `13`–`20`은 날짜가 있는 감사 기록이지 현재 코드·라이브 판정이 아니며, 사용 전 재검증이 필요하다. `18`의 algorithm/backtest 측정도 기록된 데이터 시점 이후 변경 여부를 재확인한다.
- 세부 범위: `19`의 제목 상태 `PARTIAL / IN PROGRESS`는 후속 자료가 추가되기 전 문구로 남아 있다. `19b`는 browser/edge/network map, `19c`는 server pipeline lineage, `19d`는 hardcoded data와 artifact consumer map이다. 이 자료가 존재한다는 사실은 현행 코드 재검증이나 전체 lineage 인증을 뜻하지 않는다.
- 승인 경계: `20`의 UI/UX 제안과 [`FOUNDATION-DESIGN.md`](./FOUNDATION-DESIGN.md)의 목표 architecture는 제안이며 미승인이다. 사용자 선택인 D0 strict freshness와 D4 기존 P/R/QA 원장 유지, 현재 P0 기준은 변경하지 않는다.
