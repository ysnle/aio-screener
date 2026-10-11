# REA·SaveTicker 참조 적용 — v57.33 로컬 구현·QA

기록일: 2026-10-11 KST. 로컬 `main`, 시작 HEAD `9b07bee8d52ad2f7c60bc27c0d293250e6f7e843`. 세션 `rea-st-implementation-20261011`의 content-hash 기준선을 사용했다. 시작 시 기존 변경은 참조 핸드오프 1개였으며 그대로 보존했다.

## 판정과 범위

**로컬 구현·QA PASS / 운영·전수 의미 검수 WARN(미검증).** 최신 사용자 요청은 코드 구현이며, 첨부 문서에 인용된 과거의 “코드 작업 금지”는 당시 조사 범위로 읽었다. 이번 작업은 기존 8화면 안에서 데이터→사건→회사→원문과 저장 근거의 구조·읽기 품질을 개선한다. REA 설치·외부 소스 코드 복사·SaveTicker 콘텐츠/이미지 복제는 하지 않았다.

8화면 사이드바·하위 탭은 기존 구조를 유지한다. 모든 legacy route의 소유권 통합·삭제가 끝났다고 주장하지 않는다. 이 참조 인계가 제안한 구조 계약과 기존 구현의 개선을 적용한 작업이다. commit/push/deploy는 실행하지 않았다.

## 참조 항목별 적용

| ID | 적용과 근거 | 제한 |
|---|---|---|
| ST-01 | native `stories.js`가 원본 식별·출처/issuer별 사건·정정/철회 이력을 담당. producer, 초기 NewsStore, consumer가 정확 반복 키를 공유. 제목 유사도 삭제와 URL query 제거를 폐기 | 소스가 사건/정정 관계를 주지 않으면 다른 보도를 억지로 묶지 않음. 현재 수집 범위 밖 역사 복원 없음 |
| ST-02 | 카드의 발행·관찰·수집 시각과 유형·원문/변경 이력을 펼쳐 확인 | 관찰 시각·유형 미제공은 추정하지 않음. 기존 artifact는 다음 Actions 수집 전 새 메타데이터가 없을 수 있음 |
| ST-03 | exact registry 회사명/명시 ticker 확인, 직접 당사자와 관련 회사 chip 구분. COO 직책·price target→TGT 오탐 차단. 짧은 canonical 회사명·한국어 조사 회귀 포함 | source가 직접 당사자를 표시하지 않으면 관련 회사로만 표시. 모호한 약어/일반명사는 보수적으로 보류 |
| ST-04 | 중요 사건 기본 5건·topic 다양성, 정정은 수 제한으로 숨기지 않음. 기존 브리핑의 결론·차트·근거·다음 확인 흐름 유지 | 모든 한국어 번역/자동 해석의 의미 정확성 인증 아님 |
| ST-05 | 기존 SEC 기간/단위/연간·분기 구조 유지, 유효 CIK/accession으로 SEC 원문 링크 추가. 실제 NVDA 화면에서 form·제출일·회계연도 말과 링크 확인 | SEC 원문 내용 전체와 원 수치 전수 검증은 미실행 |
| ST-06 | 날짜/issuer/발표 세션 event ID, EPS 실제 우선 중복 처리. KST/미국 현지 세션, CPI/PCE YoY·소매 MoM, EPS 예상 출처·통화·회계기간 표시 | 예상 공급자가 없으면 예상치 숨김. 공급자가 제공하지 않은 개정 이력·정확 발표 시각을 제조하지 않음 |
| ST-07 | 기존 SEC 연간/분기·전년 동기 비교와 브리핑 %/bp 분리 유지. 비교할 기간·단위가 다른 값은 같은 추세로 읽지 않음 | 모든 기업·지표 비교의 금융 의미 전수 검수 아님 |
| ST-08 | 기존 0 중심 양/음 막대와 universe/종가 기준 유지. 실제 브리핑 %와 금리 bp 분리 확인 | 공급자 시장 지도·게이지 미도입 |
| ST-09 | 뉴스 근거·메모·보관을 기본 접힘으로 배치. 테마 상세 닫기 시 rerender된 현재 trigger로 포커스 복귀 | 기존 모든 보조 패널의 수동 전수 검사 아님 |
| ST-10 | 첫 수신은 바로 표시, 이후 새 기사/변경은 명시 적용. 비동기 실적 callback도 같은 경계. 읽던 포커스·위치 보존, 0건 조건/초기화와 live status | 오래 켜둔 실제 외부 공급자 스트림 장시간 시험은 미실행 |
| ST-11 | 명시 저장한 미국장 기준일별 브리핑 보관. 값·출처·관측 provenance를 같은 도메인 선택에서 고정 | 저장 전 과거 브리핑 자동 재작성·서버 역사 저장 없음 |
| ST-12 | 종목별 초안·근거 메모·당시 가격 불변. 저장 시각/build clock은 hash 밖. 오류 저장본 보존·quota 실패 알림·60개 제한·명시 삭제 확인/세션 내 되돌리기 | 이 브라우저 저장이며 기기 동기화 없음. 공유 증거에는 계정·실보유값 미포함 |
| ST-13 | 보류 유지 | 전문·유료 공급자·옵션·목표가 권리/비용/방법론 검증 미실행 |
| ST-14/15 | 제외 유지 | 커뮤니티/SaaS/반응 등급·PDF 반복 디자인 미도입 |
| REA-02/03/04/07 | 대상 SHA/버전/내용 digest(공개 데이터 포함), 환경·행동·준비 조건·DOM/screenshot·8hub 커버리지와 미관찰 이유를 기록. QA runner가 evidence artifact 검증 | hash는 주장 진실을 인증하지 않음 |
| REA-05/06/09 | 고유 step ID 전후 비교. 환경·provider·행동·준비·capture 불일치/누락은 unknown. fixed clock+fixture hash, masking 없음 | 자동 semantic/미감 PASS 금지 |
| REA-01/08 | 현재 브라우저/QA 도구 안에서 최소 증거 연결, raw header/token/cookie/account/holdings 필드·선언 비밀·URL userinfo·위험 경로 차단 | 모든 인코딩/미선언 비밀 탐지 보증 없음. 외부 Worker/backend 내부 복원 미실행 |

## 사용자 관점과 실제 화면

실제 Codex 앱 브라우저의 localhost 작업본을 1440×900으로 검사했다. 테스트 후 임시 뷰포트를 복원한다. 자동 Playwright와 수동 브라우저 관찰을 분리한다. 가족·초보·반복 사용자 관점은 아래 설계 판단이며 실제 참여자 사용자 조사는 아니다.

| 관점 | 판단·반영 | 확인 수준 |
|---|---|---|
| 처음 보는 가족 사용자 | 먼저 제목/시각/회사, 근거는 접힘. 지난 수집본을 오늘 뉴스로 오인하지 않도록 구체 날짜. 새로고침이 무조건 최신 뉴스를 보장한다는 문구 수정 | 실제 뉴스 화면/문구 관찰 |
| 원문을 확인하는 사용자 | 정정이 저점수라 사라지지 않으며 원문 각각 접근. 발행과 수집 시각을 분리. SEC는 같은 NVDA의 공식 archive index | 뉴스 펼침·실제 NVDA SEC 링크 관찰, 정정 fixture 검증 |
| 읽는 중 새 소식을 받는 사용자 | 자동 교체로 포커스/읽던 카드가 사라지지 않음. 초기 빈 화면에는 첫 수신을 즉시 표시 | fixture focus/arrival, 실제 첫 로딩 관찰 |
| 매일 다시 보는 사용자 | 기준일별 브리핑과 종목별 메모, 저장 당시 가격/출처 고정. 60개 제한에서 사용자가 정리 가능 | component fixture·도메인 gate. 실제 개인 메모 생성/삭제는 하지 않음 |
| 키보드/보조기기 사용자 | disclosure native details, live count, 빈 상태 초기화, 테마 닫기 focus 반환 | DOM/fixture. 실제 screen reader 전수 사용은 미검증 |

수동 관찰: 최종 뉴스 집계는 중요 사건 5건 · 전체 목록 34건 중 12건(원 기사 39건). 10/10 08:00 수집 기간 제목 일치, 일반 price target 기사에 TGT chip 없음, 출처 펼침에 관찰 미제공 표시. 한국 필터 0건과 초기화 후 목록 복구 확인. 브리핑의 0 중심 % 막대/금리 bp 분리·CPI YoY/소매 MoM·맨 아래 접힌 보관 패널 확인. NVDA 요약의 접힌 메모와 재무 공시의 동일 회사·SEC 원문 링크 확인. 임시 뷰포트 복원 완료. 수치는 렌더 관찰 대상이며 이번 작업에서 투자 데이터 진실을 새로 인증하지 않았다.

## 변경 구조와 고친 실패

- 원본·사건 계약은 `src/domain/news/stories.js`, 로컬 저장 접근은 `src/data/research-snapshots.js`, UI는 렌더·상호작용만 담당한다. UI 직접 저장소 접근은 architecture gate의 실패를 따라 data layer로 옮겼다.
- 저장된 브리핑 값과 다른 미래/현재 row의 provenance가 섞이는 실패는 `buildCloseSeries`의 동일 관측 선택에서 값·출처를 함께 반환하여 해결했다. F&G history가 현재 snapshot 날짜를 빌리지 않는다.
- earnings callback의 direct render를 제거했다. 읽던 카드의 pending 정책을 통과한다. 첫 빈 화면은 예외적으로 첫 데이터 바로 표시한다.
- 구형 날짜 gate가 고정 “오늘 08:00”을 요구한 실패는 실제 완료 수집 기간을 읽는 계약으로 고쳤다.
- fresh-context 읽기 전용 리뷰에서 미사용 bootstrap dedupe facade만 제거했다. 기존 ledger/기능 삭제 없음. legacy `js/aio-data.js`는 19줄 줄어 decomposition ratchet을 강화했다.
- P1601·P1602·P1603, R702와 QA 행을 `record-fix.mjs`로 기록하고 generated state를 공식 generator로 갱신했다.

## 검증과 미검증

실행 명령:

```text
node scripts/qa-runner.mjs session-start --session rea-st-implementation-20261011
node scripts/ci-reference-adoption-contract-check.mjs
node scripts/ci-reference-adoption-browser-check.mjs
node scripts/ci-esm-core-unit-check.mjs
node scripts/ci-qa-pipeline-contract-check.mjs
node scripts/ci-decomp-hotspot-check.mjs --write
node scripts/qa-runner.mjs rerun-failed --session rea-st-implementation-20261011
node scripts/qa-runner.mjs full --no-cache --session rea-st-implementation-20261011
node scripts/qa-runner.mjs affected --session rea-st-implementation-20261011 --explain
node scripts/qa-runner.mjs affected --session rea-st-implementation-20261011
git diff --check
```

정적/Node 계약은 PASS. 전체 QA의 초기 architecture와 날짜 assertion 실패는 각각 수정하고 `rerun-failed`에서 PASS했다. 전체 147개 PASS 후 마지막 집계·문구 개선까지 포함한 affected 156개(141 PASS, 15 내용 기준 CACHED), FAIL/SKIP 0으로 마무리했다. 격리 browser fixture 5단계는 pending arrival, 정정 원문 2개와 중요 사건 건수, 종목별 초안/가격 고정, 브리핑 보관 빈 상태, 테마 닫기 포커스다. 자동 semanticReview는 unverified로 유지한다.

실제 로컬 브라우저 검수는 위에 기록한 화면·상태 범위다. Tier 13 UI/UX 실제 브라우저는 로컬 IAB에서 수행했다. 배포 live browser·Chrome 실제 사용자 세션은 미실행이다. 아직 배포하지 않았으므로 배포 변경의 인증 대상 SHA가 없다. Actions producer 실행·Worker secrets·운영 AI 답변·최근 배포 CI·기사 전문/번역 정확성·모든 8화면 의미/미감은 미검증이다. 로컬 producer 실행과 commit/push/deploy는 없음.

| 증거 수준 | 결과 |
|---|---|
| Tier 1 및 source/data/보안/workspace 계약 | 해당 full/affected gates PASS. generated state·ledger·assertion trace·profile/skill mirror 포함 |
| runtime/headless·lifecycle·browser fixture | headless 111 group 및 관련 browser gates PASS. mock/격리 상태 범위 |
| Tier 13 실제 로컬 브라우저 UI/UX | 뉴스·브리핑·NVDA 요약/공시·0건 복구에서 위 범위 관찰. 사용자 관점은 설계 평가이며 참여자 조사 아님 |
| live/external | 배포·실제 공급자·운영 AI 답변 미검증. 로컬 watchdog 9 gates는 파일 계약 검사이며 manifest의 external kind가 실제 외부 관찰을 뜻하지 않음 |

현재 즉시 수정할 FAIL과 실행이 막힌 로컬 gate는 없다. WARN은 운영·전체 의미 검수·실제 사용자 연구의 미검증 범위다.

## 최종 QA 산출물

- 전체 실행: `2026-10-11T02-38-34-243Z-17708-ajisu6` — 147 PASS, 0 CACHED/FAIL/SKIP. [전체 결과](./qa-full.json)
- 최종 영향 실행: `2026-10-11T02-45-52-634Z-33624-viknmu` — 141 PASS, 15 CACHED, 0 FAIL/SKIP. [최종 결과](./qa-affected.json)
- [브라우저 evidence](./browser-evidence.json): 5 observed fixture steps, 8화면 대표 상태는 미관찰 항목을 그대로 unverified로 유지. 현재 source/data digest와 일치 확인: `0dfdebefd6e6332803f6e05adefde8409ae81a0294a53bd53d1d2d7c7b439846`.
- 마지막 전체 PASS 뒤 작은 문구/집계 변경이 있어 출시용 full verified-tree 인증을 최신 코드 인증으로 재사용하지 않는다. 최종 작업 검증은 위 affected 결과다. commit 요청 시 현재 상태의 full --no-cache release 절차가 필요하다.
- 아래는 가상 기사로 정정 이력을 시험한 실제 렌더 화면이다. 실제 투자 뉴스나 수치 검증 증거가 아니다.

![정정 이력 브라우저 fixture](C:/Projects/AIO/_artifacts/rea-saveticker-implementation-20261011/news-correction-fixture.png)
