# Architecture 품질 감사 — 통합 핸드오프

통합·재검토: **2026-10-22 KST**. 이 파일이 단일 최신 진입점이다. 날짜별5개 폴더의 원본482파일을 이 폴더 안으로 모았다. **자료 통합은 완료하되 전체 코드·콘텐츠 감사는 IN_PROGRESS**다. 제품 결함을 수정하거나 프로젝트 commit/push/deploy하지 않았다.

## 먼저 읽을 판단

전면 재작성보다 법인 일치, 결측·날짜·통화·기간 보존, 응답 지시 경계, 실제 실패를 잡는 QA가 우선이다. 우선 보완 후보는 HWM 공시 오연결(A01), 원가손익을 가짜30일 추이로 표시(A20), 매매 지시 필터 누락(A15), 과거 성공 cache로 실패 retry 해소(A25)다. [정책·구조 판단](./evidence/20261021-v5859/DECISION-QUALITY.md)에 유지할 설계와 작은 대안을 함께 적었다. 기능 폐지나 대규모 개편을 시행한 것은 아니다.

## 범위와 상태

주 원장은v58.59 `7e2411432f6ca0e5f02528b209b013bf5f7ff2dc`의 실행·설정 소스850개다. 10/22 후속 전문 읽기28개를 대조해 순증24개를 반영했다. **전문 근거429개(직접99 / 기준전문+전체diff22 / 동일SHA 계승308), 생성 mirror13개, 부분·변경분·미검토408개**다. 자료 통합 자체로 늘린 수가 아니라 실제 후속 읽기다. 지식 본문·데이터셋의 전수 의미 검토는 별도 범위다. [coverage](./coverage.json), [파일별 원장](./reading-ledger.tsv), [후속 영수증](./reviews/remaining-20261022/continuation.json)을 따른다.

이전 보완 기록은v58.60 `659ffbad252f9eeacfa49a6ad1b895df87f66597`의 제한된 delta와 당시 미커밋v58.62 선택4파일에 한정했다. 10/22 후속 범위는 아래에 따로 기록한다. 현재 작업 트리 전체나 배포 SHA를 인증하지 않는다. A01–A27은 주 기준에서 추적하는27묶음이며 이전 발견 전체가 아니다. [과거 발견 연결표](./FINDINGS-HISTORY.md)의 별도 잔여를 삭제·해결로 간주하지 않는다.

10/22 후속에서는 셸 전문+현행 전체diff(버전14줄), 보안7개, legacy3개, 스크리너14개 및 셸 caller3개를 읽었다. 셸 이외27개의 검토 파일은 당시 현행 SHA도 고정본과 같았다. 실브라우저는 배포 footer **v58.60**에서 맞춤 조건 OR/엄격 비교 입력2건을 추가 확인했다. 현행 dirty v58.62와 배포는 다른 범위다.

## 10/22 이어서 확인·보강한 항목

MODE: review · VERDICT: **FAIL(범위 내 보완 필요), 전체 감사 IN_PROGRESS** · independence: limited(동일 모델·분리 문맥).

| 후속 항목 | 판정·사용자 영향 | 근거와 최소 대안 |
|---|---|---|
| SCR04 문장 조건 | 새 구체 반례. OR가 AND, 미만/초과가 이하/이상으로 해석됨. 배포 UI도 확인. | [스크리너](./reviews/remaining-20261022/SCREENER.md). 미지원 논리는 적용을 멈추고 명확히 알리며 경계 연산을 보존. |
| SEC02 AI fallback | 새 구체 반례. 근거 없는 현재 사건이 정상 plan에서는 제거되나 비구조 fallback에는 남음. | [보안](./reviews/remaining-20261022/SECURITY.md). 두 경로의 정직성 경계를 같게 적용. 실제 모델 생성·서비스 재현은 아님. |
| LEGACY02 한국 필터 | 선택은 그대로인데 시세 재렌더 뒤 카드 필터와 포커스가 소실됨. | [legacy](./reviews/remaining-20261022/LEGACY.md). 두 필터 상태 보존·재적용. 격리 DOM fixture이며 live 수치 아님. |
| LEGACY03 위험 계산 | 이전 구성 A의 늦은 응답이 새 구성 B의 보류 표시를 덮음. | [legacy](./reviews/remaining-20261022/LEGACY.md). 요청 번호·구성 identity를 게시 전에 대조. VM fixture, 위험 수치 정확도 인증 아님. |
| C03 / SCR01 | 기존 지속 재현. NOT 가격 입력이 계산 identity에서 누락. | [스크리너](./reviews/remaining-20261022/SCREENER.md). AST child 순회 보완. |
| C04 / SCR02 | 기존 지속 재현. 상수 두 팩터를 독립 신호2개로 설명. | 같은 보고서. 0분산 제외/보류, 유효 차원과 통계적 독립의 설명 구별. |
| C06 / SCR03 | 기존 지속 재현. Forward PER20이 정규화 뒤 표시 불가. | 같은 보고서. canonical 가격 보존. |
| D4 / SEC01 | 기존 지속 재현. relay 일일 cap1에서 본문 실패3회 후 공급자 호출3·원장0. | [보안](./reviews/remaining-20261022/SECURITY.md). dispatch 후 불확실 실패는 카운트 유지. OpenAI $20 우회 증거와 구별. |
| BND01 / LEGACY01 | 기존 지속 재현. 목록A의 지연 추가가 전환한B에 저장되고B의 초안도 지워짐. | [legacy](./reviews/remaining-20261022/LEGACY.md). 최초 목록과 입력에 요청을 묶음. |
| C13 차트 fallback | 기존 순수VM 반례 지속. null을0과 같은 점으로 그림. 현재 일반 사용자 null 입력 도달은 미인증. | [셸](./reviews/remaining-20261022/SHELL.md). 결측 간극 보존 또는 차트 보류. 신규 일반 화면 결함 수로 더하지 않음. |
| SCR05 조건 통계 | 잠복 계약·CONSIDER. 같은 과거1행을30번 넣으면 READY·100%. live caller는 확인되지 않음. | [스크리너](./reviews/remaining-20261022/SCREENER.md). 연결 전 표본 단위·비중첩·같은 history 기준 빈도 정의. |

새 구체 반례4묶음과 기존6항목 재확인, 잠복 계약1항목을 구별했다. 누적 확정 결함 수나 모든 항목 해결로 합산하지 않는다. 기본158개 OpenAI 계약 assertions는 네트워크 차단 fixture에서 통과했지만 실청구 상한·실서비스 보안·투자 성과를 인증하지 않는다. 감사 도구 자체의 원장/보존 검사도 독립 재검토해 보강했다. [후속 검증·잔여 우선순위](./reviews/remaining-20261022/CLOSEOUT.md)를 따른다.

## 주 기준의 발견27묶음

| 묶음 | 문제·사용자 영향 | 근거 / 최소 보완 |
|---|---|---|
| A01 법인 | HWM에 HPE 공시가 AI 인용 근거로 수락된다. AAOI/AFRM 매핑도 공식적으로 다른 법인이다. | 실제 core+chat VM, [공식 대조](./evidence/20261021-v5859/OFFICIAL-CROSSCHECK.md). 공통 issuer 정본과 응답 identity 검증. |
| A02 금리 결측 | 오래된 금리 입력에서 null.yearPosition 예외로 공유 해석을 만들지 못한다. | market-reading-result.json. 일부 입력 없음이 전체 예외로 번지지 않게 보류 상태를 반환. |
| A03 금리 설명 | 실질금리 ±20bp의 원인 설명이 같은 상승 부담으로 나온다. | 실제 반대 부호 fixture. 방향별 근거 문장을 대조. |
| A04 일정 날짜 | KST08시의 월 실적이 화 열에 들어가고 금 실적이 사라진다. | legacy-latest-repro.json의08/09시 대조. 날짜-only/시장 시간대 계약 통일. |
| A05 한국 결측 | 시세 미수신이+0.00%와 ‘하락0개>상승0개’ 진단으로 바뀐다. | 최신 고정 renderer VM, 과거 v58.50 실제 화면은 별도 증거. 결측을0으로 만들지 않음. |
| A06 QA cache | 의존 모듈을 바꿔도 gate fingerprint가 같다. | cache-identity-result.json, 정적20개 등록 후보. import closure/명시 입력의 완전성 검사. |
| A07 DuPont | ROE 하락을 상쇄한 이익률 상승을 하락 원인으로 설명한다. | [domain 반례](./evidence/20261021-v5859/DOMAIN-DELTA.md). 기여/상쇄 부호 구분. |
| A08 회계연도 | LDOS 같은 공시가 FY2025/2026으로 동시에 표시된다. | 최신 실제 화면+SEC, [BROWSER](./evidence/20261021-v5859/BROWSER.md). domain/UI/R&D 축의 직접 substring을 함께 정리. |
| A09 섹터 분모 | 주식500/채권500에서 Technology50%를 ‘주식 평가액의50%’라고 설명한다(실제 주식 부분100%). | [UI 반례](./evidence/20261021-v5859/UI-DELTA.md). 분모 명칭 또는 계산 대상을 일치. |
| A10 계좌 β | 주식100/현금9900 계좌에 보유 부분 β1을 ‘이 계좌 평균1%’라고 설명한다. 동일 현재비중 기준 계좌 β0.01이다. 기준통화 FX 반례도 같은 클래스다. | 실제 surface+stress 함수 실행. 현금/환율 포함 기준으로 계산하거나 현금 제외 보유 부분으로 명명. |
| A11 통계 대상 | IC의 t로 상하위 수익률 차이에 판단 가능/긍정색을 붙인다. | 같은12×100개 수익률에서 IC t61408.78, 차이 t1.12121. 해당 차이 자체의 통계 사용. |
| A12 inspector | 조건 전환 뒤 표 NVDA249위/근거308위가 함께 남는다. 행을 다시 누르면249위로 정상화된다. | 실제 v58.59 Pages. [양성 대조](./evidence/20261021-v5859/browser-inspector-positive-control.json). 현재 결과에서 선택 근거 재도출. |
| A13 검색 접근 | HBM 검색 후 Tab으로 결과에 가면180ms 뒤 숨김/BODY focus가 된다. | 실제 v58.59 Pages. 결과 영역 밖으로 focus가 나가는 경우만 닫음. |
| A14 규칙 보존 | 최고 R719 블록을 지워도 R-gap 검사가 놓친다. | [실제 검사 구간 VM](./evidence/20261021-v5859/tooling-review.md). 이전 defined-ID 집합/최고 기준과 비교. 전체CI 우회 성공이라는 주장은 아님. |
| A15 응답 지시 | 같은 문장의 부정절 때문에 명백한 매수 지시가 그대로 통과한다. 영어 지시도 검출하지 못한다. | [CHAT-1](./evidence/20261021-v5859/REMAINING-CHAT.md). 부정의 적용 대상을 행동별로 판정하고 교육 설명과 대조. 실제 모델의 생성 발생은 미측정. |
| A16 연결 대기 | health 내부12초/외부7.5초라 정상8.5초 응답도 첫 전송은 timeout이 된다. | CHAT-2 실제 route/task·축소 타이머. timeout·성공·취소의 수명 일치. |
| A17 오류 안내 | route 예외 cleanup이 abort한 뒤 안내 조건을 검사해 실패 안내0회가 된다. | CHAT-3 실제 release/예외 분기. cleanup 전에 사용자 취소 여부를 보존. |
| A18 근거 기준일 | pipeline이 반환한 종가 날짜를 disclosure에 넘기지 않아 검증된 종가도 미확인으로 표시한다. | CHAT-4 실제 완료 호출문/소비 함수. 게시 claim의 날짜와 개수 전달. |
| A19 저장 거절 | localStorage 거절이 최상위 예외로 뒤 키보드·검색 action 초기화를 끊는다. | [UI-SHELL-1](./evidence/20261021-v5859/REMAINING-UI.md). 거절/허용 전체 파일 VM 대조. 방문 기록 실패만 격리. |
| A20 기간 창작 | 보유 이력 요청 실패 시 누적 원가 손익을 선형으로 만들어30일 수익률·Alpha로 출력한다. | UI-SHELL-2: 이력0%에서+100%/Alpha100%p. 확보하지 못한 기간은 보류하고 비교 가능 범위를 명명. |
| A21 수집 완료 | main 충돌로 미게시한 SEC poll에도 완료 marker를 저장해 재실행 daily lane을 건너뛴다. | [WF01](./evidence/20261021-v5859/REMAINING-WORKFLOWS.md). 실제 조건과 age48→0 반례. 정상 no-change와 충돌을 구별. |
| A22 조사 커버리지 |455행을 유지하면서 A2단원이 빠지고454개 고유단위가 되어도 해당 gate가 통과한다. | [GV01](./evidence/20261021-v5859/REMAINING-GOVERNANCE.md). unitId/contentUnitId 집합의 일대일 대조. 전체CI 우회 주장은 아님. |
| A23 원고 중복 | seed 충돌1을 계산하고도 해당 uniqueness gate가 통과한다. | GV02. 공유 seed 허용 정책을 정하거나 정확 중복을 실패와 연결. 의미적 독창성 인증과 구별. |
| A24 완료 금지 | 미해결이 있을 때 완료 금지라는 검사가 미해결0 입력도 무조건 거부한다. | GV03. 해당 조건의 VM 반례이며 세부 운영 증거를 인증하지 않음. 증거에 따른 정상 전이를 허용. |
| A25 실패 캐시 | 동일 입력 PASS→no-cache FAIL→rerun-failed가 실행0회/CACHED로 실패 배치를 삭제한다. | [QR01](./evidence/20261021-v5859/REMAINING-QA-RUNNER.md). 실패 시 성공 cache 폐기, 실패 이후 실제 PASS를 요구. |
| A26 빈 재시도 | 실패 gate ID가 manifest에서 사라지면 retry0개/exit0으로 끝난다(실패 배치는 보존). | QR02. 해석하지 못한 ID를 명시하고 nonzero 종료. |
| A27 버전 문법 | bump/CI가 허용하는 canonical v59를 필수 record-fix가 거부한다. | [WTO01](./evidence/20261021-v5859/REMAINING-WORKSPACE-TOOLS.md). 공통 canonical 문법과 major-only 양성 대조. 현재 v58.62 실패라는 주장은 아님. |

A01의 CIK 정본 불일치는11개지만 다른 법인으로 공식 확인한 것은HWM/AAOI/AFRM3개, 실제 consumer 격리 재현은HWM1개다. 나머지8개를 확정 오연결로 세지 않는다. A08의 FY domain/UI/browser 증거, A10의 현금·FX 반례는 각 하나의 원인 묶음이다. A06(의존 입력 누락)과 A25(실패 뒤 과거 성공 재사용)는 다른 결함이다.

## 검증 결과를 읽는 법

실브라우저는 과거v58.50/52와 실제Pages v58.59의 기록이다. v58.59 주 메뉴8개, LDOS DCF, inspector, 키보드 검색, 휴대폰/태블릿 일부 증거는 [BROWSER](./evidence/20261021-v5859/BROWSER.md)에 있다. footer 버전 관측을 배포 전체 bytes 일치로 올리지 않는다. 이번 통합에서 새 live/browser·유료AI·producer는 실행하지 않는다.

이전14개 preflight 통과, helper41개 구문 검사, boot raw1,496,044/gzip544,662 bytes는 각각 당시 범위의 증거다. helper41개가 모두 실행된 것은 아니며 반례 probe 종료0은 제품 정상 PASS가 아니다. v58.60 marketAnalysis는verified여서 과거blocked를 현재 요약으로 쓰지 않는다. verified도 경제적 인과·투자 우위의 인증은 아니다. [과거 검증 기록](./evidence/20261021-v5859/VALIDATION.md), [이번 통합 검증](./VALIDATION.md)을 구별한다.

## 재검토하며 바로잡은 내용

- 20261018 TOOLING의 ‘CI60개 전문’ 문구는 원래 TSV/독립 보고에 맞춰 **60대상 중25전문·35미독**으로 정정했다. 원본은archive에 보존했다.
- 이전 감사 원장의 잘못된FULL 승격7행은 이미 정정됐다. 이를 미해결로 재등록하지 않는다. 통합 당시405/13/432였으며, 실제10/22 후속 읽기 근거를 반영한 현재 집계는429/13/408이다.
- 과거 C/D/UI/M/LD/I 계열의 별도 잔여를 [연결표](./FINDINGS-HISTORY.md)에 남겼다. domain E01의 통화손익 보류 개선이 다른 UI consumer의 통화 오류 해소를 뜻하지 않는다.
- v57.98 E01–E08 반례 해소, 당시full/external PASS/FAIL, 뒤 버전의 browser/VM 결과는 날짜·SHA·증거 단계별로 보존한다. 합산해 전체PASS를 만들지 않는다.

## 연관된 선행 핸드오프

Architecture 폴더 밖의 관련 자료도 다시 검토했다. [10/15 개편 감사](../codex-reform-audit-20261015/HANDOFF.md), [내부 정책·논리](../internal-quality-review-20261016/HANDOFF.md), [기준·규칙 평가](../policy-criteria-review-20261016/HANDOFF.md), [10/16 전수 감사](../exhaustive-quality-audit-20261016/HANDOFF.md)와 [v57.98 재대조](../exhaustive-quality-audit-20261016/LATEST-STATUS-v57.98.md)를 연결한다. 이 폴더 밖의 다른 프로젝트/과거 모든 핸드오프를 이동하거나 새로 인증한 것은 아니다. 전문 읽기와 재검토 범위는 [재검토 기록](./REVIEW-CORRECTIONS.md)에 있다.

## 보존 위치

| snapshot | 파일 수 | 역할 |
|---|---:|---|
| [20261018](./evidence/20261018/) | 45 | 당시 고정REF의 보고·원시 증거·helper |
| [20261019](./evidence/20261019/) | 52 | 당시 고정REF의 보고·원시 증거·helper |
| [20261020](./evidence/20261020/) | 94 | 당시 고정REF의 보고·원시 증거·helper |
| [20261021](./evidence/20261021/) | 142 | 당시 고정REF의 보고·원시 증거·helper |
| [20261021-v5859](./evidence/20261021-v5859/) | 149 | 당시 고정REF의 보고·원시 증거·helper |

[원본archive](./originals.zip)는482개 파일의 통합 전 바이트를 보존한다. [original-files.json](./original-files.json)은 각 원본 SHA/새 경로/archive entry, [migration.json](./migration.json)은 문서 링크·helper 경로 변경의 예외를 기록한다. raw JSON/로그/TSV는 당시 경로 문자열까지 그대로 둔다. 루트 reading-ledger는 그 원장의 evidence 경로만 옮긴 파생 view다. 원문 재현 스크립트는 현재 입력/producer를 사용할 수 있으므로 경로 정리만으로 전부 재실행·안전 인증하지 않는다.

남은 제품 소스408개와 과거 발견의 미재검증 항목, 지식 본문·데이터셋의 별도 의미 검토는 완료되지 않았다. [후속 검증·잔여 우선순위](./reviews/remaining-20261022/CLOSEOUT.md)에 다음 읽기 범위를 명시했다. 제품 수정·commit/push/deploy는 하지 않았다.
