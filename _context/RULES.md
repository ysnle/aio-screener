---
verified_by: Codex local source review + affected QA (workspace/deployment regression); full semantic audit remains open
last_verified: 2026-09-24
confidence: medium
target_version: v56.49
# 2026-07-18 통합/압축: 상시 참조 룰(R290+ 및 핵심 keep-list 89건)은 전문 유지, 나머지 244건은 헤더 한 줄로 축약.
# 헤더-only 룰의 본문 전문은 git 히스토리(2026-07-18 이전 리비전) 참조. R번호는 전량 보존(재발 추적/게이트 grep 호환).
---

## R632. 선언 입력에는 writer가 있어야 하고, 저장 경로는 durable ack를 버리지 않는다 (v56.19, P1187)

**Rule**: 필드가 reader·normalizer·surface에 있다는 사실은 그 필드가 **입력될 수 있음**을 뜻하지 않는다. (1) 선언 필드(통화 등)는 사용자가 그 값을 넣는 **writer 경로**(폼·import·API)가 실제로 있어야 한다 — writer 없이 reader만 있으면 downstream은 영원히 '미선언'만 발화하고, 선언은 import 같은 우회로로만 들어온다(P1181의 통화 전달 끊김과 P1187의 writer 부재는 같은 결함의 양 끝이다). (2) **수정 경로는 폼이 소유한 필드만 덮어쓴다** — 객체 통째 교체는 다른 출처가 넣은 필드(sector·targetWeight·통화)를 조용히 지운다. (3) 영구 저장의 성공/실패를 구분하는 반환은 **그 경로가 실제로 소비한다** — 반환을 버리는 경로(import·전체삭제)는 persist가 거부돼도 완료를 말한다(P1181이 add 경로 하나를 고쳤지만 나머지는 같은 클래스로 남았다). 새 저장 경로를 추가할 때마다 **모든 호출자**가 ack를 await·게이트하는지 확인한다. (4) 형식이 틀린 선언은 조용히 버리지 않고 거부한다(R628 — 부재와 무효를 구분).

**Validation**: `scripts/ci-esm-core-unit-check.mjs`(P1187 소스 계약 — 폼 선언 입력 존재, add 경로가 선언을 저장, 수정 경로가 `...existing`으로 비폼 필드 보존, import·전체삭제가 `await savePortfolioData(...)` 뒤에만 완료 문구), `scripts/ci-portfolio-vault-e2e.mjs`(`PFE2-12` 통화 선언 왕복·빈 선언 null·무효 `US` 비저장, `PFE2-13`/`PFE2-14` persist 거부 시 import·전체삭제 모두 성공 문구 미노출).

## R631. 성과·위험 결과는 측정 경로·분모·현금·RF·표본을 선언하지 않으면 인증하지 않는다 (v56.17, P1182)

**Rule**: 선언 없는 지표 표는 그 숫자가 어떤 계좌의 어떤 범위·기간·정책으로 계산됐는지를 말하지 않는다. 22 PFR02~05/PFR09/PFR10에서 같은 결함이 한 경로에서 여러 형태로 나왔다: 주식만으로 만든 수익률이 계좌 위험처럼 렌더됐고(분모 미선언), RF 상수 4.3%가 라벨 뒤에 숨었으며(입력 미선언), 13개 수익률·꼬리 1개 VaR/CVaR가 인증 가능한 지표처럼 표시됐고(표본 미선언), 현금이 분모에서 조용히 빠졌으며, 기간 종점 가격이 시작 배분을 만들었다(시점 미선언). (1) 결과 객체가 `exposureHistoryMode`·`weightBasis`·`cashTreatment`·`rebalancePolicy`·RF 상태·표본 n/tail n·구성 snapshot ID를 **결과와 함께 발행**하고, 화면 제목이 분모를 담는다 — 같은 수치를 계좌 전체/주식 부분 두 제목으로 쓰지 않는다. (2) 선언할 수 없는 입력(현금 통화·현금 수익률·RF·보유 이력·꼬리 표본·원장)은 **해당 범위를 보류**한다 — 값을 만들지 않고 범위를 줄여 게시하며, 계좌 성과(TWR/MWR)의 정답은 원장 부재 시 보류다. (3) 식별자(`estimateId`·`compositionSnapshotId`)는 실제 의존 입력에서 파생해 같은 입력 재현과 입력 변경 분리를 동시에 고정한다(R630과 같은 원리 — ID가 아예 없던 상태도 위반이다). (4) 보편 규칙 문구('Sharpe 1 이상 양호'·'MDD 20% 권장'·'drift 5%p')는 출처(교육 예시·기관 지침·사용자 설정)를 명시하고 실제 실행과 분리할 때만 쓴다. (5) 미래 정보(종점 가격)가 과거 결정(시작 배분)의 입력이 되는 폴백은 정책 라벨과 함께 제거한다 — 라벨은 항상 실제 실행된 정책을 말해야 한다.

**Validation**: `scripts/ci-esm-core-unit-check.mjs` (P1182 fixture 15종 — 종점 가격 불변 시작 배분, 13수익률·꼬리1 `varCertification.held`, cash 50/equity −10 → 계좌 −5%·주식 −10% 두 scope 동시 발행, 현금 미선언 → 계좌 보류·sleeve만 게시, `actual_account_history` 무이력 차단, 스냅샷 replay 동일·가격 이동 분리·가격 없음 차단, 원장 없음 TWR/MWR 보류, workspace RF 상수 부재·선언 라벨 소스 계약 + P1181 legacy 라벨 fixture 1종 갱신), `js/aio-tests.js` T845 (start-date basis).

## R630. 식별자·정체성 해시는 그 대상의 입력에서 파생한다 — 표시·overlay 파생값을 넣지 않는다 (v56.15, P1177)

**Rule**: `snapshotId`처럼 "무엇을 관측했는가"를 식별하는 값은 **그 관측 집합의 입력**(artifact·universe의 revision과 그 필드)에서만 파생돼야 한다. 표시·진단·overlay 목적으로 행에 추가된 파생값이 같은 해시에 들어가면 **그 값을 만드는 배경 현상이 정체성을 바꾼다** — 여기서는 시세 tick 한 번에 새 ranked snapshot이 발급되어 보관한 실행이 조용히 대체됐고(P1074 위반), 원인은 "해시 대상이 rows 전체"라는 한 줄에 숨어 있었다. (1) 정체성 입력은 **명시적 투영**으로 계산한다 — 제외 목록을 코드로 두고 그 목록을 계약으로 취급한다. (2) 한 계약을 확장할 때 **그 필드가 다른 계약의 입력인지** 확인한다: P1174는 거부된 quote를 진단으로 남기려고 행에 넣었고 그 진단이 정체성 해시 입력이 됐는데, 두 계약을 함께 검사하는 단언이 없어 6개 버전 동안 드러나지 않았다(그 게이트가 그동안 실행되지 않은 것도 원인이다). (3) 불변성은 **두 입력으로 같은 대상을 읽히는 게이트**로 고정한다 — 다른 overlay로는 식별자가 같고, 다른 관측으로는 달라야 한다(후자는 전면 동결을 막는 양성 대조). (4) 참조 구현 단언(최적화 해셔 == 참조 해셔)은 **투영까지 포함해** 갱신한다 — 투영을 빼고 옛 공식을 그대로 두면 그 단언은 통과하면서 아무것도 지키지 않는다.

**Validation**: `scripts/ci-screener-workbench-contract.mjs`(P1177 `G-SCR-SNAPSHOT` 3종 — 다른 quote로 같은 artifact는 동일 `snapshotId`, 진단은 101/102로 각각 보존, artifact 변경은 새 정체성 + `G-SCR-HASH` 투영 기준 참조 해시), `scripts/ci-screener-auto-refresh-browser-check.mjs`(`frozenRunSurvivesQuoteRefresh: true`).

## R629. 미설정 입력을 0으로 직렬화하지 않는다 — 0이 값을 뜻하는 필드와 미설정 필드를 타입으로 구분한다 (v56.14, P1176)

**Rule**: `parseFloat(x) || 0`·`Number(x) || 0`은 **"빈 입력"과 "0"을 같은 값으로 만든다**. 한 번 저장되면 하류는 그 0이 사용자가 넣은 실측값인지 빈 칸인지 구분할 수 없고, R628의 `Number(null)===0`이 그 위에서 다시 작동한다 — 여기서는 미설정 목표가가 `$0.00`과 `-100% 잠재수익`으로 표시됐다. (1) 입력 경계에서 **빈 칸·NaN·무효 문자열은 null로 보존**하고 유효한 값만 숫자로 저장한다(`v.trim() === '' ? NaN : parseFloat(v)` 뒤 finite·범위 검사). (2) **같은 이름의 다른 타입을 구분**한다 — 가격 목표의 0은 미설정이고 비중의 0%는 실제 값이다. 타입마다 정규화 함수를 따로 둔다. (3) 숫자 강제 변환은 `Number(null) === 0`이므로 경계마다 확인한다(`typeof value === 'number'` 검사를 먼저 두거나 null을 먼저 걸러낸다) — `finite(Number(x))`는 null을 0으로 부활시킨다. (4) **같은 라벨의 정의가 두 곳에 있으면 하나로 만든다**: "목표가 미설정"을 native는 `finite(target) != null`, legacy는 `target > 0`으로 판정하고 있었다. (5) 수정 경로가 `target || 기존값`이면 사용자가 그 값을 **지울 수 없다** — 폼이 미리 채워지는 편집 경로에서는 빈 칸을 "지움"으로 해석한다.

**Validation**: `scripts/ci-esm-core-unit-check.mjs`(P1176 정규화·reader·노출 fixture 단언), `scripts/ci-portfolio-vault-e2e.mjs`(`PFR-01` — 실브라우저에서 빈 목표가 저장값 null·셀 `미설정`·`$0.00`/`-100` 부재, 실제 목표가 150은 `$150` 렌더로 판별력 유지).

## R628. 결측은 조건도 구간도 관측값도 만족시키지 않는다 — 경계에서 `Number(null)===0`을 먼저 막는다 (v56.02, P1164)

**Rule**: 결측을 '관측된 0'으로 바꾸는 경로는 한 곳이 아니라 **클래스**였다. `Number(null)===0`(그리고 `Number('')===0`)이 `isNaN()` 검사를 통과해, (a) `null < 73`이 true가 되어 위기 조건을 만족시킨 뒤 `.toFixed`가 TypeError를 던지고, (b) 임계값 구간 판정이 **첫 구간**을 골라 미수신 F&G가 '극단 공포(buy-opportunity)', 미수신 VIX가 '저변동/포지션 100%', 미수신 AAII가 '중립'으로 표시됐다. (1) 경계·라벨·비교의 첫 줄은 `v == null || v === '' || !isFinite(Number(v))`로 걸러라 — `isNaN(Number(v))`만으로는 부족하다. (2) 표시 sentinel은 `NaN`(→'—'), 도메인 sentinel은 `null`로 통일하고 서로 바꾸지 않는다. (3) 미수신 입력에서 구간·포지션·위기·행동 문장을 **만들어내지 않는다**. (4) 값 부재를 '0%' 같은 실측 표기로 바꾸지 않되, 실제 0은 0으로 남긴다. (5) 한 렌더러의 예외가 같은 핸들러의 다음 렌더(차트 로드 등)를 취소하지 않도록 호출 경계를 둔다. (6) 게이트가 그 오표시 덕분에 통과하고 있었다면 픽스처가 아니라 **단언을 고친다**(R625의 같은 계열).

**Validation**: `scripts/ci-headless-tests.mjs` G111 `_testV5601MissingInputSemantics`(P1164 — THRESHOLD_REGISTRY/ACTION_RULES 결측 판정, 창 밖 뉴스 건수, `updatePatternSignals` 무예외), `scripts/ci-screener-workbench-contract.mjs`.

## R627. 선언된 자격증명·기능은 도달 가능한 경로가 증명되기 전까지 제공된 것으로 취급하지 않는다 (v56, P1151~P1155)

**Rule**: 목록에 있다는 사실은 동작의 증거가 아니다. (1) 사용자에게 보이는 자격증명 입력란·설정 토글은 **그 값을 실제로 읽어 쓰는 런타임 경로**와 짝을 이뤄야 하고, 경로가 브라우저에서 도달 불가(CORS·허용목록·필터 미통과)하면 입력란을 두지 않거나 경로를 만든다. (2) 코드가 읽는 자격증명은 **사용자가 넣을 수 있는 자격증명**과 집합이 같아야 한다 — 한쪽에만 있으면 그 기능은 없는 것과 같다(P1153). (3) 같은 라우트의 사용 가능 여부를 **등록 시점과 전송 시점이 서로 다른 소스로 판정하지 않는다**(P1151의 `_cfWorkerUrl()` 대 개인 키 불일치). (4) 게시만 되고 소비자가 없는 생산자(P1152)는 기능이 아니라 비용이며, 승격은 증거로 **파생**하고 손으로 켜지 않는다. (5) 폐기된 기능은 코드·주석·사용자 문서에서 함께 사라져야 한다(P1155).

**Validation**: `scripts/ci-worker-relay-check.mjs`(env 전용 키·하드코딩 목적지·fail-closed), `scripts/ci-fast-plane-consumer-gate.mjs`(게시된 승격을 증거로 재파생), `scripts/ci-operator-secrets-contract-check.mjs`, `scripts/ci-data-pipeline-contract-check.mjs`.

## R626. 생성 산출물의 병합은 필드 소유권으로 결정한다 (v55.21, P1141)

**Rule**: 같은 생성 문서를 **두 생산자가 서로 다른 필드로** 갱신하면 충돌은 의미 충돌이 아니라 **필드 소유권 충돌**이다. 여기서는 스케줄된 데이터 봇이 `dataRevision`/`generatedAt`/데이터 사이클 id를 쓰고 사람의 코드 커밋이 `appRevision`/`workerRevision`을 쓴다 — 같은 파일, 다른 필드다. 따라서 (1) 해소는 **한쪽 선택이 아니라 필드 단위 합집합**이다(`git checkout --ours`로 통째로 고르면 리비전 동기화가 깨진다). (2) 이 규칙은 **한 번 코드로 적어 둔다** — 매 세션이 손으로 재발견하면 매번 수십 분이 든다(`scripts/resolve-data-manifest-merge.mjs`). (3) 리베이스 중 `--ours`는 **업스트림**이고 `--theirs`가 재생 중인 커밋이므로, 이름에 의존하지 말고 **충돌 마커를 직접 읽는다**. (4) 분류되지 않은 새 필드가 충돌 블록에 나타나면 **추측하지 않고 중단**한다 — 새 필드는 소유자를 의도적으로 정해야 한다. (5) 봇이 계속 앞서 나가는 것은 정상이므로 fetch→rebase→검증→push를 **루프로** 감싸고, push 거부를 실패가 아니라 재시도 신호로 다룬다.

**Validation**: `scripts/resolve-data-manifest-merge.mjs`(미분류 필드에서 exit 3), 리베이스 후 `ci-version-check` + `ci-release-manifest-contract` + `node scripts/qa-runner.mjs affected` 통과.

## R625. 픽스처가 검출기의 언어를 대신 맞춰주면 그 검사는 아무것도 검사하지 않는다 (v55.20, P1139)

**Rule**: 탐지기(정규식·어휘 목록)를 검사하는 픽스처는 **제품이 실제로 쓰는 입력**을 그대로 넣어야 한다. 픽스처가 탐지기의 어휘를 보정해 주면(예: 한국어 본문에 영어 인과 표현을 괄호로 덧붙임) 검사는 **통과하지만 탐지기의 실제 공백은 보이지 않는다** — 그 테스트는 "탐지기가 동작한다"가 아니라 "픽스처가 탐지기의 사전을 알고 있다"를 증명할 뿐이다. 따라서 (1) 다국어 제품에서 탐지 어휘는 **제품의 주 언어를 포함**해야 한다(여기서는 한국어 — `validateMarketAnalysisText`의 인과 판정이 영어 단어 목록뿐이어서 한국어 인과 문장이 전혀 검출되지 않았고, 그 결함이 **게이트 안에 주석으로 문서화된 채** 남아 있었다), (2) 픽스처에는 **음성 통제(control)**를 함께 넣어 "아무 텍스트나 통과"하는 상태를 배제한다(설명문 한국어 문장은 인과로 분류되지 않아야 한다), (3) 언어별 정규식은 **분리**한다 — `\b`는 ASCII 기준이라 `\b(?:…한국어…)\b` 형태로 합치면 한국어 분기가 조용히 비활성화된다.

**Validation**: `scripts/ci-data-pipeline-contract-check.mjs`(영어 토큰 없는 한국어 인과 픽스처 + 설명문 통제 + 영어 회귀 케이스), `scripts/fetch-data.mjs`의 인과 판정 두 분기.

## R624. 전역은 하나의 구현만 가진다 — 그리고 로드 순서는 계약이다 (v55.19, P1138)

**Rule**: 클래식 스크립트에서 최상위 `function X`와 `window.X =`는 **같은 전역을 두 번 정의**한다. 어느 쪽이 이기는지는 **로드 순서**로만 결정되므로, (1) 함수값 전역이 두 파일에서 정의되면 그 중 하나는 **조용히 죽은 코드**이고 순서가 바뀌는 순간 **살아난다**(P1132: 죽어 있던 위임 래퍼가 승자가 되어 자기 기본 인자를 모든 호출자에게 적용했다). 따라서 함수값 전역은 **하나의 소유자**만 가진다 — 의도적 이중 소유는 이유를 적고 허용목록에 올린다(예: `getApiKey`/`setApiKey`는 core 주석이 "두 실행 순서를 모두 안전하게 지원한다"고 명시한 계약). (2) 상태 전역(런타임에 여러 파일이 쓰는 공유 가변 상태)은 위험 등급이 다르므로 **동결 기준선**으로 두고 **새 이중 소유자만 실패**시킨다 — 기존 것을 한꺼번에 고치려 하면 검증 없이 동작을 바꾸게 된다. (3) `window.X = window.X || …`(네임스페이스 확장)와 `var X = window.X`(명시적 import)는 **읽기**이지 두 번째 정의가 아니므로 제외한다 — 포함하면 신호가 네임스페이스 잡음에 묻힌다(실측 295개). (4) **로드 순서 자체를 선언**한다: `index.html`의 스크립트 순서를 `architecture/runtime-script-order.json`에 이유와 함께 적고 게이트가 정확히 일치하는지 검사한다 — 순서는 "추출한 코드가 원래 실행되던 위치"를 보존하는 계약이며(R622), 선언이 없으면 다음 세션이 같은 회귀를 다시 낸다. (5) 게이트는 **자기가 막으려는 회귀를 실제로 잡는지 음성 테스트로 증명**한다.

**Validation**: `scripts/ci-structural-check.mjs`(로드 순서 정확 일치 + 측정 파일 전원 포함, 함수값 전역 이중 소유 0 또는 문서화된 허용목록, 상태 전역 신규 이중 소유 0, 동결 목록 축소 강제), `architecture/runtime-script-order.json`, `architecture/global-ownership-baseline.json`.

## R623. 같은 집합을 여러 곳에 손으로 적지 않는다 — 순서까지 파생시킨다 (v55.18, P1137)

**Rule**: 같은 식별자 집합이 여러 표면에 등장하면 **한 곳만 손으로 적고 나머지는 파생**시킨다. 개수만 세는 게이트로는 **재정렬을 볼 수 없다** — 그래서 20개 라우트가 다섯 곳(`js/aio-core.js ROUTE_PAGE_IDS`, `src/app/routes.js ROUTE_IDS`, `architecture/route-owners.json counts.*`, `architecture/golden-routes.json routes`, `AIO_ROUTE_REGISTRY.classes`)에 **다섯 가지 순서로** 존재했고, "이 둘이 같은 라우트 집합인가"라는 질문의 답이 어느 목록을 읽느냐에 따라 달라졌다. 따라서 (1) 정본은 **한 곳**에 둔다(여기서는 core의 `ROUTE_PAGE_IDS` — 운영 그룹 순서를 담은 유일한 손 목록). (2) 같은 파일 안의 파생물은 **런타임에 계산**한다(그룹은 `slice`, `NAV_ROUTE`는 정본에서 derived/reference를 뺀 것). (3) 다른 파일의 파생물은 **생성기로 생성**하고 `--check` 모드를 CI 게이트로 등록한다(R1의 버전 7표면과 같은 방식). (4) 게이트가 파생물의 **순서에서 기대값을 계산**한다면 그 순서 자체가 계약이므로 생성기가 그 순서도 소유해야 한다 — 아니면 게이트가 "재정렬"을 "드리프트"로 잘못 보고한다. (5) 파일 줄 수 상한 때문에 파생 코드를 늘리기 어려운 표면은 파생을 최소화하고 **게이트로 고정**하며 그 이유를 기록한다. (6) 왜 다른 순서를 유지해야 하는 집합(예: `EDUCATION`은 라우트 순서가 아니라 overlay `glossary`를 포함한 분류 집합)은 합치지 않고 **왜 다른지 기록**한다(R619(1)).

**Validation**: `scripts/generate-route-registry.mjs --check`(정본 목록·그룹 파생·레지스트리 분할·breadcrumb 커버리지·golden 집합·생성 표면 동기), `scripts/ci-architecture-contract-check.mjs`(counts 배열 순서), `scripts/ci-structural-check.mjs`(정본 목록 판독), `scripts/ci-esm-core-unit-check.mjs` + `scripts/ci-architecture-browser-check.mjs`(ESM 소비자 20라우트 왕복).

## R622. 인라인 코드의 추출은 실행 "위치"를 보존한다 (v55.16, P1135)

**Rule**: `index.html`의 인라인 `<script>`는 **파싱 시점에** 실행되므로 `defer` 스크립트(core·data·ui·chat·glossary)보다 **항상 먼저** 돈다. 추출한 코드를 기존 `defer` 태그 **뒤에** 붙이면 실행 순서가 뒤집히고, 그 코드를 **모듈 평가 시점에 호출하는** 다른 파일이 있으면 `ReferenceError`로 그 파일 전체가 죽는다(그 파일의 함수 선언·window 대입이 전부 미정의가 된다). 따라서 (1) 추출 파일의 태그는 **원래 블록의 상대 순서대로 `defer` 그룹의 맨 앞**(core 앞)에 놓는다 — 그래야 "core·ui보다 먼저"라는 원래 성질이 유지된다. (2) 순서를 바꿀 때는 **전역 이름별로 "누가 평가 시점에 누구를 호출하는지"를 먼저 확인**한다. (3) 이 회귀는 정적 게이트가 아니라 **실브라우저 검증**이 잡는다 — headless 1,133건이 전부 통과해도 페이지가 죽을 수 있으므로, 순서 변경 시 `ci-architecture-browser-check`를 반드시 돌린다.

**Validation**: `scripts/ci-architecture-browser-check.mjs`(실브라우저 20 라우트, `browserErrors`), `scripts/ci-headless-tests.mjs`, `scripts/ci-structural-check.mjs`(R280 중복 전역 0), `index.html`의 런타임 스크립트 순서.

## R621. 프리캐시는 부트 필수분만, 나머지는 요청 기반 런타임 캐시다 (v55.15, P1134)

**Rule**: 서비스 워커가 `cache.addAll`로 **원자적으로** 설치하는 목록은 모든 라우트가 부팅에 실제로 필요로 하는 파일로 한정한다. 분해로 새 런타임 모듈이 나올 때마다 프리캐시에 추가하면 (1) `cache.addAll`은 **하나라도 실패하면 설치 전체가 실패**하므로 실패 확률이 항목 수에 비례해 커지고, (2) 초기 라우트가 절대 필요로 하지 않는 파일까지 설치를 막을 수 있으며, (3) 목록 상한이 있으면 금방 포화되어 **다음 추출은 상한을 올리거나 항목을 빼는 임의 결정**이 된다. 추출된 모듈은 요청 기반 런타임 캐시(`RUNTIME_SHELL_PATH_RE`/`isRuntimeShell`)가 첫 요청에서 채우고, `index.html`은 매 로드마다 모든 런타임 스크립트를 요청하므로 첫 방문 뒤에는 동일하게 오프라인 가용하다. 이 규칙은 `sw.js`의 `CRITICAL_SHELL_ASSETS`와 그 상한(1..12) 게이트가 함께 강제한다.

**Validation**: `scripts/ci-service-worker-cache-policy-check.mjs`(목록 1..12, 필수 4종 존재, 외부 CDN 금지, 원자 설치, 요청 기반 런타임 캐시 존재), `scripts/ci-release-revision-check.mjs`(5개 셸 런타임은 프리캐시·Pages·allowlist 3자 일치).

## R620. 분해 압력은 벽이 아니라 래칫이다 (v55.08, P1127)

**Rule**: 크기 상한은 **여유가 있을 때만** 작동한다. 파일이 상한에 닿는 순간 그 장치는 성장을 막는 가드가 아니라 **변경을 금지하는 벽**이 되고, 통과 방법은 두 가지뿐이다 — 주석을 압축해 지표를 게임하거나, 상수를 수정해 조용히 재기준하는 것. 둘 다 실제 분해를 하지 않으면서 위반만 숨긴다. (1) **래칫으로 건다**: 각 파일이 자기 **기록된 값**을 넘지 못하게 하고, 감소하면 기록을 자동으로 조인다. 성장은 `--allow-growth`로만 가능하며 그 자체가 커밋에 남는 **명시적 결정**이 된다 — 고정 상한이 제공하는 것처럼 보였던 가시성을 실제로 제공한다. (2) **선언과 집행은 같은 파일을 읽는다**: 설정 파일에 선언한 수치를 스크립트에 하드코딩하면 둘이 조용히 어긋난다(v53.96 상한이 실제로 그랬다). (3) **커버리지를 빠뜨리면 압력은 옆으로 샌다**: 7개 런타임 파일 중 3개만 재면 나머지 4개로 이동할 뿐이며, 추출로 새 파일을 만들면 그 파일이 곧 새 무제한 구역이 된다. (4) **측정 대상은 문서에 먼저 등록한다**: 게이트가 재는 파일은 `CODE-MAP`이 담당 구간을 알고 있어야 한다. (5) **게이트는 자기 한계를 기록한다**: 왜 이 형태인지(이전 형태가 무엇을 막았는지)를 설정 파일과 스크립트 헤더에 남긴다 — 그러지 않으면 다음 세션이 같은 벽을 다시 세운다.

**Validation**: `scripts/ci-decomp-hotspot-check.mjs`(7개 파일 래칫 + `ceiling` 3개, 성장 시 실패·`--write` 무단 상향 거부, 음성 테스트 확인), `architecture/decomposition-hotspots.json`(단일 선언 원천), `_context/CODE-MAP.md`(측정 대상 전부 커버).

## R619. 같은 의미의 구현은 하나만 둔다 (v55.07, P1126)

**Rule**: 같은 일을 하는 순수 함수가 두 벌 있으면 **반드시 한쪽이 썩는다**. 둘 다 "동작하는" 동안에는 차이가 드러나지 않으므로, 갈라진 사실은 실제 사용자 피해(값이 틀리거나 이스케이프가 빠짐)로 나타난 뒤에야 발견된다. (1) **수렴 대상은 의미가 같은 것에 한정한다**: 문자 집합·경계값·반올림이 동일한 재구현만 합친다. 미묘하게 다른 것은 합치는 것이 아니라 **왜 다른지 이름에 적는다**(예: 3-char와 4-char 이스케이프는 다른 함수다). (2) **수렴은 "정본 하나 + 위임"이다**: 재구현을 남기고 이름만 바꾸거나, 폴백 사본을 "혹시 모르니" 유지하는 것은 수렴이 아니다 — 폴백은 정본이 없을 때 **조용히 다른 결과**를 내는 두 번째 구현이다. (3) **라인 상한이 있는 파일에서는 수렴이 라인을 늘리면 안 된다**: 정본을 여유가 있는 파일에 두거나, 같은 변경에서 폴백 사본을 함께 제거해 순증 0 이하로 만든다. (4) **동작 변화는 동작 변화로 취급한다**: 합치는 두 구현의 출력이 다르면 무위험 정리가 아니라 동작 변경이므로, 통합 전후 출력 차이를 확인하고 헤드리스 단언으로 고정한다. (5) **수렴 대상을 세어 두고 남은 것을 항목으로 남긴다**: "이스케이프 5개 → 1개"처럼 개수를 기록하지 않으면 다음 세션이 같은 조사를 처음부터 다시 한다.

**Validation**: `js/aio-tests.js`(109개 그룹 1,129개 단언 전부 PASS, `ci-headless-tests.mjs`), `scripts/ci-runtime-contract-check.mjs`, `scripts/ci-decomp-hotspot-check.mjs`(상한 파일 라인 순증 0 이하), `scripts/ci-structural-check.mjs`.

## R618. 원장 루프는 서술이 아니라 기계로 닫는다 (v55.06, P1123~P1125)

**Rule**: 기록은 다음 세션이 **참조할 수 있을 때만** 자가 개선이 된다. 참조할 수 있게 만드는 것은 문서 규율이 아니라 실행되는 검사다. (1) **단언은 근거를 인용한다**: 게이트·테스트의 각 단언은 그것이 재발을 막는 P/R/QA 항목을 이름으로 가리킨다. 인용 없는 단언은 "왜 있는지 아무도 모르는 검사"이며 리팩터 저항만 남긴다. 새 단언은 인용을 요구하고, 기존 부채는 동결 베이스라인으로 유예하되 **증가를 금지**한다. (2) **원장의 구멍은 명시한다**: 번호 결번·미분류 항목은 "없음"과 구분되지 않으면 사고로 읽힌다. 결번 집합을 매니페스트로 동결해 규칙이 조용히 사라지지 못하게 한다. (3) **OPEN은 재검증 트리거를 갖는다**: `verify_by:` 없는 미해결 항목은 다음 세션이 **다시 판단**하게 만든다 — P1117(프로듀서 버그를 "다음 refresh 대기"로 오분류해 영구 면제를 만든 사례)의 구조적 원인이다. (4) **신선도는 주장한 문서 전체에 적용한다**: `last_verified`를 선언한 문서는 검증 대상이며, 임계를 `autoRefresh`나 특정 kind로 좁히면 나머지가 조용히 부패한다. (5) **스킬은 트리거 체인이 아니다**: 스킬 발동 여부가 작업 범위를 정하면 발동 시 그 절차에 작업을 끼워 맞추고(과잉), 미발동 시 있는 지식을 버린다(과소). 라우팅의 단일 트리거는 `INDEX.md`의 task routing 표이고, 강제는 게이트 실행과 보고 형식에만 둔다. (6) **베이스라인은 부채를 고정하지 갚지 않는다**: 동결은 증가를 막는 장치이고 감소는 별도 작업 항목이다. 베이스라인을 늘리는 유일한 정당한 사유는 승인된 일괄 변경이다.

**Validation**: `scripts/ci-assertion-trace-check.mjs`(단언 라벨의 ledger-id 인용, `_context/assertion-trace-baseline.json`), `scripts/ci-ledger-integrity-check.mjs`(R 결번 동결 + OPEN `verify_by:`, `_context/rule-gap-manifest.json`·`_context/open-item-baseline.json`), `scripts/ci-knowledge-lint-check.mjs`(45일 초과 문서 집합 동결, `_context/doc-freshness-baseline.json`).

## R617. 사설 도구의 경계는 결과를 막지 않고 밝힌다 (v55.05, P1120~P1122)

**Rule**: 차단(block)은 **반증 가능한 오류**에만 쓴다. 그 밖의 경계는 결과를 유지한 채 이름을 붙인다(disclosure). (1) **달성 불가능한 조건은 게이트가 아니다**: 입력이 항상 `null`/`false`로 들어오는 조건을 차단 사유로 두면 그것은 검사가 아니라 상시 차단이다 — 그런 조건은 `limitations`로 내려야 한다. (2) **차단은 틀릴 수 있는 것에만**: 값·단위·배율처럼 사실과 다를 수 있는 주장은 차단하고, 근거의 종류·출처 등급·적합성 정보의 부재는 공시한다. "정확한 근거가 없음"과 "틀린 값"은 다른 사건이다. (3) **부분 실패는 부분만 버린다**: 정합 항등식이 답변 전체 단위면 복구 가능한 문장까지 함께 사라진다. 위반한 주장만 탈락시키고 탈락 범위를 명시한다. (4) **프롬프트가 첫 번째 게이트다**: 모델이 스스로 "확인 필요"로 축약하면 파이프라인 게이트를 풀어도 답은 나아지지 않는다. 무엇을 하지 말라뿐 아니라 **무엇을 하라**(일반 원리·조건·시나리오·확인 방법으로 끝까지 답하기)와 **최종 판단의 귀속**(사용자에게 넘긴다)을 함께 규정한다. (5) **자기 정책과 모순되는 게이트는 게이트가 아니다**: 저장소가 이미 "답변 전체를 안전 모드로 바꾸지 말라"고 선언했다면, 상시 차단은 정책 위반으로 취급한다. (6) **조악한 휴리스틱은 정밀 검사를 대체하지 않는다**: 근접·존재 여부 같은 근사 규칙을 차단에 쓰면 정상 문장을 막는다. 정밀 검사가 따로 있다면 근사 규칙은 경고로 내린다. (7) **권리 경계와 결과 제공은 분리한다**: 어떤 자료를 보존하지 않기로 한 결정이 그 자료와 무관한 서술까지 막아서는 안 된다 — 보존하지 않는 대신 **귀속(attribution)** 과 공시로 대체한다.

**Validation**: `js/aio-tests.js` T949/T964/T965(차단→limitation·disclosure), `scripts/ci-ai-intelligence-contract-check.mjs`(오케스트레이터 `actionLimitations` 디스패치, `blocked-action-permission` 부재, 조건부 분석 허용), `scripts/ci-runtime-contract-check.mjs`(금지 행위 차단 유지 + 개인화 limitation), `scripts/ci-data-pipeline-contract-check.mjs`(`causal-evidence-missing`·`metric-identity-proximity`는 warning, `metric-value-mismatch`·`nfp-scale-mismatch`는 issue, `headline-attributed-with-disclosure` 정책), `scripts/ci-headless-tests.mjs`(골든 코퍼스 g09 기대값 = 공시).

## R616. 정합은 화면이 실제로 읽는 경로에서 성립한다 (v55.04, P1116~P1119)

**Rule**: 산출물이 스스로 정합적이라는 것만으로는 부족하다. 그 산출물이 **어느 경로로 소비자에게 도달하는지**가 정합의 일부다. (1) **화면 정합은 렌더 경로에서 검사한다**: UI가 A에서 렌더하고 정합 게이트가 B에서 검증하면, B가 맞아도 화면은 설명되지 않는다. UI가 읽는 객체(예: `presentation`)가 검증 대상 항목을 실제로 나르는지 같은 경로에서 단언한다. (2) **근거 인용은 발행 정책에서 파생한다**: 소비자가 하드코딩한 evidence id는 발행 정책이 바뀌는 순간 거짓이 된다. 발행본이 그 데이터를 담는지 프로듀서의 발행 플래그에서 파생하고, 하드코딩 형태의 부재를 게이트로 고정한다. (3) **프로듀서가 계산한 provenance는 모든 발행 레인에서 발행한다**: 어떤 레인이 값을 계산한 뒤 투영에서 버리면, 그 값을 찾는 산출물 게이트는 **영구 면제**가 된다 — P1099가 금지한 "영구 공허 통과"의 가장 조용한 형태다. fieldMeta·meta를 쓰는 레인을 열거하고 **각 레인마다** 키 존재를 단언한다(한 레인만 고치고 끝나지 않도록). (4) **상시 상수는 의도라면 선언한다**: 항상 0건·0행인 값이 결함이 아니라 권리·제품 경계의 결과라면, 그 경계를 정책 상수로 발행하고 정책↔구현 불일치를 게이트가 검출해야 한다. 침묵하는 미채움 필드는 다음 독자가 결함으로 오해한다. (5) **라벨 없는 어휘를 렌더하지 않는다**: 새 키가 추가되면 표시 라벨이 없는 한 원시 키가 노출된다 — 어휘 소유자를 명시한다.

**Validation**: `scripts/ci-artifact-semantics-check.mjs`(presentation↔scoreBreakdown 파리티), `scripts/ci-runtime-contract-check.mjs`(파생 인용·렌더러 sink), `scripts/ci-history-field-time-contract-check.mjs`(3개 fieldMeta 레인의 provenance 발행), `scripts/ci-data-pipeline-contract-check.mjs`(뉴스 콘텐츠 정책↔구현), `scripts/ci-architecture-browser-check.mjs`(signal 보정 sink의 native 렌더).

## R615. 참조·측정면·퇴역은 발행 시점에 함께 닫는다 (v55.03, P1109~P1114)

**Rule**: 발행물은 값이 맞는 것만으로 충분하지 않다. 그것이 가리키는 대상·그것을 세는 범위·그것을 만든 범위가 함께 닫혀야 한다. (1) **참조는 해소되어야 한다**: 발행 산출물이 id로 다른 산출물을 가리키면 그 id는 선언된 식별자 집합(taxonomy node·concept·branch·lesson·route 등) 안에서 해소되어야 한다. 미해소 참조는 조용히 사라지지 않는다 — 소비자는 라벨 폴백으로 렌더해 사용자에게 무의미한 항목을 보여준다. (2) **측정면은 전 대상을 덮는다**: 신선도·계보 감사는 평평한 디렉터리를 가정하지 않는다. 중첩 계열을 새로 측정할 때는 **WARN으로 시작**하고, 소유자가 SLA를 확정한 뒤에만 FAIL로 승격한다. 측정면을 넓히는 변경은 기존 판정을 완화해서는 안 된다. (3) **퇴역은 산출물까지 닫는다**: 프로듀서가 범위 밖을 선언하면 그 산출물은 발행되지 않아야 하며, 죽은 생성기 코드를 남겨 살아있는 프로듀서처럼 보이게 해서는 안 된다. (4) **소비자 없는 설정은 보장으로 읽힌다**: 캐시 라우팅·자산 등록부처럼 "무엇을 보장하는가"로 읽히는 표는 실제 소비자와 대조한다. 대조는 이름이 아니라 **경로**로 한다 — 이름은 스키마 문자열 등 우연한 일치로 거짓 통과한다. (5) **요약 시각은 개별 관측을 대체하지 않는다**: 산출물 수준의 정규화 버킷은 개별 행·증거의 관측 시각 폴백이 될 수 없다(모르면 null). (6) **소비 경로에는 항상 발행하는 발행자가 있어야 한다**: 클라이언트가 fetch하는 경로는 존재하지 않는 파일을 가리켜서는 안 된다 — 404는 조용한 실패가 아니라 콘솔 오류로 브라우저 게이트를 깨뜨린다. "발행하지 않음"이 정상 상태인 경우에도 파일 부재로 표현하지 말고 **명시적 미가용 상태**로 발행한다. 문서화된 발행 동작은 구현되어야 하며, 헤더 주석과 코드가 다르면 그 차이가 곧 결함이다.

**Validation**: `scripts/ci-artifact-semantics-check.mjs`(참조 해소·퇴역 재발행·미가용 스냅샷 발행, 음성 대조 완료), `scripts/ci-data-lineage-audit.mjs`(`report.nested` 측정면), `scripts/ci-service-worker-cache-policy-check.mjs`(라우팅 표↔소비자 경로, 등록부 부재), `scripts/ci-runtime-contract-check.mjs`(스크리너 행 관측 폴백 부재, FRED yoy 단위), `scripts/qa-runner.mjs --group browser-resilience`(404 회귀).

## R614. 발행 산출물의 의미 계약은 소비자·계보·만료까지 닫는다 (v55.02, P1096~P1108)

**Rule**: 값·단위·시각·어휘의 자기 정합(R613)만으로는 부족하다. 산출물이 발행되는 순간부터 소비자와 계보가 함께 닫혀야 하고, 전환 면제는 시한을 가져야 한다. (1) **전환 면제는 만료된다**: 프로듀서 수정이 다음 refresh에야 발행물에 반영되므로 한 사이클 면제가 필요하지만, 면제는 시한을 갖고 만료 후 단언이 무조건 실행되어야 하며, 면제 중에도 남은 부채를 수치로 보고해야 한다. 면제 분기가 단언을 감싸 영구 공허 통과가 되어서는 안 된다. (2) **비율은 자기 분모를 넘을 수 없다**: 분자와 분모는 같은 모집단이어야 하고, 넘으면 이름이 틀렸거나 분자가 틀렸다. (3) **자기보고 카운트는 payload와 일치해야 한다**: 발행물이 스스로 보고하는 개수는 같은 발행물의 배열·집합과 대조되며, 의미가 다른 두 수를 한 이름으로 발행하지 않는다. (4) **시계열은 조인 가능해야 한다**: 달력 단위 시계열은 단위 기간당 1포인트여야 하고, 값의 출처 메타는 그 값의 출처이며, 행의 열 집합은 균질하고 "미관측"은 `null` + 메타 부재로만 표현한다(키 삭제 금지). (5) **선언 없는 축을 발행하지 않는다**: 상태·권리·정합성 축은 각각 다른 이름의 어휘를 발행하고, 값은 그 어휘로 해석 가능해야 한다. 권리·검증 축은 관측 완전성(체크리스트 통과)으로 승격하지 않는다 — 승격은 기록된 운영자 검증만 인정한다. (6) **프로듀서는 소비자·계보 정책과 함께 온다**: 어떤 산출물도 소비자 경로와 계보 정책 없이 발행되어서는 안 되며, 그 3자 일치를 게이트로 고정한다. (7) **중간 계층은 소비자가 읽는 메타데이터를 버리지 않는다**: 한쪽이 선언한 provenance를 다른 쪽이 조용히 탈락시키면 폴백 리터럴이 사실을 대체한다.

**Validation**: `scripts/ci-artifact-semantics-check.mjs`(data 그룹 `artifact-semantics`, `inTransition` 만료 헬퍼), `scripts/ci-history-field-time-contract-check.mjs`(행 정규화·BEA 문단 픽스처), `scripts/ci-runtime-contract-check.mjs`(FRED 선언·시계열 메타 연결), `scripts/ci-data-pipeline-contract-check.mjs`(프로듀서-소비자-계보 3자), `scripts/ci-data-lineage-audit.mjs`(주간 캘린더 창), `src/data/contracts/operations.js`·`reconciliation.js`의 어휘 발행·검증.

## R613. 발행 산출물은 값·단위·시각·어휘가 스스로 정합해야 한다 (v55.01, P1090~P1095)

**Rule**: 발행되는 아티팩트는 스키마와 신선도만 맞으면 되는 것이 아니다. 같은 산출물 안에서 값과 라벨이 서로 모순되어서는 안 되며, 다음을 실행 가능한 게이트로 고정한다. (1) 출처가 살아있는 1차 출처인데 신선도 플래그가 stale이면 실패한다 — 플래그는 설정만 하지 말고 복구 시 해제한다. (2) 어떤 값의 관측 시각은 그 값의 관측 시각이어야 한다: 이전 세션 종가를 현재 관측 시각으로 스탬프하지 말고, 모르면 null로 fail-closed하며 `observationRelation`·`observedAtSource`로 관계를 드러낸다. (3) 서술·주장의 `evidenceIds`는 발행 산출물 안에서 해소되어야 하고, 단위와 metricId는 중복 정의하지 않고 정본 스냅샷에서 가져온다. (4) 화면이 명시한 계산식(가중치 등)은 표시값으로 재구성 가능해야 한다 — 총점을 사후에 바꾸는 조정(보정·클램프)은 반드시 항목으로 노출한다. (5) 어휘를 선언하는 필드는 그 이름이 가리키는 축의 값 전부를 포함해야 하며, 서로 다른 축(status/statusCode)은 다른 이름으로 선언한다. (6) 빌드 시점에 계산해 동결되는 판정에는 `evaluatedAt`을 남겨 점시점 판정임을 드러낸다.

**Validation**: `scripts/ci-artifact-semantics-check.mjs`(data 그룹 `artifact-semantics`), `src/data/contracts/operations.js`의 어휘 순회 검증, `scripts/ci-domain-parity-check.mjs`(총점 파리티 유지).

## R612. 운영자 프로비저닝 경계는 문서-계약으로 검사한다 (v54.99, P1089)

**Rule**: 워크플로가 참조하는 모든 `secrets.*`/`vars.*`는 운영자 런북(`_context/OPERATOR-RUNBOOK.md`)에 이름·용도·결손 시 결과가 문서화되어야 하고, 그 일치를 CI가 검사한다. 수동 전용 배포 워크플로는 워크플로와 문서가 함께 움직여야 하며 한쪽만 바뀌면 실패한다. 런북에는 시크릿 값을 기록하지 않는다 — 이름과 결과만 기록하므로 실제 프로비저닝 상태는 라이브 게이트로만 판정한다.

**Validation**: `_context/OPERATOR-RUNBOOK.md`, `scripts/ci-operator-secrets-contract-check.mjs`(workspace 그룹 `operator-provisioning`), `scripts/workspace-state-lib.mjs`의 `TARGETED_CONTEXT`.

## R611. 클라이언트별 훅 페이로드는 각각 픽스처로 고정한다 (v54.99, P1084)

**Rule**: 하나의 훅 구현을 여러 에이전트 클라이언트가 공유하면 페이로드 스키마가 클라이언트마다 다르다는 전제를 명시적으로 다룬다. 편집 대상 경로는 Codex `apply_patch`의 `tool_input.command`뿐 아니라 Claude `Edit`/`Write`의 `file_path`·`notebook_path`에서도 읽어야 한다. 각 클라이언트 형태를 각각 픽스처로 고정하며, 한 형태만 검사하는 픽스처는 다른 클라이언트에서 훅이 무력해도 영원히 green이다. 모든 클라이언트가 동일한 가드 모드를 배선했는지도 함께 검사한다.

**Validation**: `scripts/agent-hook.mjs`, `scripts/ci-workspace-contract-check.mjs`의 Claude `file_path` 픽스처 6건과 가드 모드 대칭 단언, `.claude/settings.json`.

## R610. 진단·요약 스텝은 셸 확장을 거치지 않는 파일에서 실행한다 (v54.99, P1083)

**Rule**: 워크플로 스텝에서 JS 템플릿 리터럴(`${...}`)을 `node -e "..."`로 넘기지 않는다. bash가 `node` 실행 전에 확장을 시도해 스텝이 죽고, 그 결과 실패 상세가 Step Summary에 남지 않아 운영자가 원인을 파악할 수 없다. 요약·리포트 로직은 스크립트 파일로 분리하고, 입력 리포트가 없거나 깨져도 안전하게 종료하며 그 사실 자체를 출력에 남긴다. 실패 결론은 이후 스텝이 담당하게 한다.

**Validation**: `scripts/report-qa-failures.mjs`, `scripts/ci-qa-pipeline-contract-check.mjs`의 인라인 템플릿 리터럴 금지 단언, `data-watchdog.yml`.

## R609. 레인 격리는 진단을 위한 것이고, 발행 경계는 fail-closed로 유지한다 (v54.99, P1085)

**Rule**: 하나의 프로듀서 레인 실패가 다른 레인의 실행·게이트·요약·수렴을 스킵시키지 않도록 각 레인과 후속 검증을 `!cancelled()`로 실행한다. 그러나 발행(커밋·푸시)은 모든 프로듀서 레인이 성공했거나 정당하게 스킵됐을 때만 수행한다. 격리는 실패의 귀속과 진단을 바꾸는 것이며 발행 조건을 완화하는 것이 아니다 — 두 성질은 같은 게이트에서 함께 고정한다.

**Validation**: `.github/workflows/refresh-data.yml`의 레인 id와 step outcome 발행 조건, `scripts/ci-qa-pipeline-contract-check.mjs`의 `refresh-data isolates producer lanes without loosening the publish boundary`.

## R608. 캐시 폴백은 읽기 시점에 스스로 나이를 판정한다 (v54.99, P1086)

**Rule**: 캐시 TTL을 쓰기 시점 정리로만 강제하지 않는다. 폴백 읽기 경로는 캐시 항목의 나이를 판정해 상한을 넘긴 항목을 "현재 값"으로 반환하지 않고, 오래된 응답임을 응답 본문에서 구분 가능하게 표시한다. 오프라인·네트워크 실패가 반복되는 클라이언트가 임의로 오래된 시세를 현재가로 보는 상태를 허용하지 않는다. 나이를 알 수 없는 항목만 예외로 통과시킨다.

**Validation**: `sw.js`의 `cachedWithinMaxAge`·`staleResponse`·`STALE_MAX_AGE_MULTIPLIER`·`REFERENCE_MAX_AGE_MS`, `scripts/ci-service-worker-cache-policy-check.mjs`.

## R607. 모든 워크플로 job은 실행 상한을 선언한다 (v54.99, P1088)

**Rule**: GitHub Actions job에 `timeout-minutes`를 선언한다. 기본 상한 360분은 행 걸린 fetch·install이 러너를 점유하게 두고, 같은 `concurrency` 그룹을 공유하는 스케줄 워크플로에서는 이후 주기를 직렬로 막아 데이터가 조용히 멈추는 경로가 된다. 상한은 해당 job의 실측 소요에 여유를 둔 값으로 정하고, 값의 적정성은 사람이 판단한다.

**Validation**: `scripts/ci-qa-pipeline-contract-check.mjs`의 `every workflow job declares timeout-minutes`(전 워크플로 파싱, 누락 job 나열).

## R606. 봇이 유발한 이벤트는 워크플로 체인을 잇지 못한다 — 수렴을 명시적으로 구동한다 (v54.99, P1087)

**Rule**: 기본 `GITHUB_TOKEN`으로 만든 `workflow_dispatch` 실행은 `workflow_run` 이벤트를 발생시키지 않는다. 따라서 "봇 커밋 → CI 검증 → attestation → Pages 배포"는 봇 경로에서 자동으로 성립하지 않는다. 프로듀서가 방금 만든 CI 실행 id를 확인해 배포 워크플로에 명시적으로 넘기고, 매 주기마다 origin/main 리비전과 라이브 `deployment.json`의 `sourceSha`를 멱등하게 비교해 수렴시킨다. 명시 경로는 우회로가 되어서는 안 된다: 배포 워크플로는 그 경로에서도 attestation 아티팩트와 SHA 일치, 그리고 런의 결론·브랜치·SHA를 다시 검증한다. 실패만 있는 리비전에는 배포를 요청하지 않는다.

**Validation**: `scripts/ensure-live-convergence.mjs`, `.github/workflows/pages-deploy.yml`의 `workflow_dispatch` 입력과 재검증 스텝, `refresh-data.yml`·`refresh-screener.yml`의 수렴 스텝, `scripts/ci-qa-pipeline-contract-check.mjs`의 hand-over 단언 4건.

## R605. 정적 DB는 data-refresh 주기에 맞춰 갱신하거나 명시적으로 보류한다 (v54.98, P1081)

**Rule**: `SCREENER_DB`·`KR_STOCK_DB`·`KR_THEME_MAP`·`AIO_MACRO_CALENDAR`·`AIO_MANUAL_REFERENCE`·채널 allowlist는 관측값이 아니라 구성이다. 스스로 최신화되지 않으므로 data-refresh 실행이 주기마다 점검한다: 유니버스 멤버십(월간, `staleAfterDays:30`·`replaceAfterDays:90`), 테마 구성(월간, 시점 박힌 수치 제거), 발표 일정(매 릴리스 후 공식 캘린더 대조, 만료된 `nextRelease`는 `lastRelease`로 승격), 정책 참조(매 결정·CPI 발표 후). 갱신하지 않으면 BLOCKED/DEFERRED 사유를 기록하고, `replaceAfterDays`를 넘긴 유니버스는 하드 FAIL이다. 정적 DB 목록의 정본은 data-refresh 스킬의 `references/inventory.md`다.

## R604. 정적 DB는 구성만 보관하고 시점 박힌 수치를 남기지 않는다 (v54.98, P1080)

**Rule**: `KR_THEME_MAP`·`SCREENER_DB`·`KR_STOCK_DB` 같은 정적 DB는 구성(코드·테마 소속·심볼·이름·섹터)만 보관한다. 시총·주도주 서술·가중치·가격 같은 시점 박힌 값은 주석을 포함해 남기지 않고 런타임 산출물로만 채운다. 주석의 수치도 현재값으로 오해되므로 제거 대상이다. `ci-static-data-contract-check.mjs`가 재도입을 금지 패턴으로 막는다.

## R603. 생성물은 고빈도 데이터 refresh가 바꾸는 휘발값을 고정하지 않는다 (v54.98, P1079)

**Rule**: 생성된 현재 상태 문서(`_context/CURRENT-STATE.md`)는 매 리비전 byte-current여야 한다는 preflight와, generated workspace state를 고빈도 data promotion commit에 결합하지 않는다는 R595가 **같은 값 위에서 충돌해서는 안 된다**. 따라서 생성물은 데이터 refresh가 갱신하는 휘발값(가공 시각, 데이터 리비전, 관측 시각, age)을 렌더하지 않고, refresh와 무관하게 안정한 분류·상태만 렌더한다. 휘발값을 고정하면 데이터 push마다 `generated-state`·`workspace-contract`가 FAIL하고, 그 결과 preflight 실패 → Contracts/Browser/Attest SKIP → attestation 부재 → Pages 배포가 조용히 정지한다. 휘발값이 필요하면 생성물에 복사하지 말고 생성 시점에 원본에서 읽는다.

## R602. 같은 라벨이 두 정의를 가리키면 정의나 라벨을 하나로 만든다 (v54.98, P1078)

**Rule**: 한 화면 안에서 같은 이름(등급, 시장 폭 시그널, MACD, 시장 참여도)이 서로 다른 기준·단위·기저로 계산되면 사용자는 어느 쪽이 참인지 판단할 수 없다. 등급 경계·필터 라벨·차트 시그널·지표 기저는 단일 함수나 단일 상수에서 파생하고, 서로 다른 writer가 같은 DOM 요소를 갱신하는 경우에는 **같은 기저**를 쓰도록 맞춘다. 기저를 맞출 수 없으면 값의 title·부제에 실제 기저를 명시해 두 정의가 한 이름으로 보이지 않게 한다. 내부 enum 토큰(영문 상태값)은 한국어 라벨로 매핑한 뒤 표시한다.

## R601. 사용자 출력 계약은 렌더된 결과로 단언한다 (v54.98, P1077)

**Rule**: "그 화면/브리지가 X를 보여준다"는 계약은 렌더된 노드·상태를 단언해야 하며, 소스 파일에 특정 문자열이 존재하는지를 출력 증거로 쓰지 않는다. 그 문자열이 호출되지 않는 함수 안에 있으면 게이트는 아무것도 증명하지 못한 채 통과한다. 표시가 의도적으로 없는 설계라면 그 부재를 음성 단언으로 고정해 되살아나지 않게 한다. 같은 파일에 대해 "숨김/미표시"와 "렌더한다"를 동시에 요구하는 모순된 계약을 남기지 않는다.

## R600. 감사는 자기 부작용을 검증하지 않는다 (v54.98, P1076)

**Rule**: 감사·게이트가 검사하는 레지스트리를 다른 단계가 자동으로 채우는 구조라면, 감사는 채워진 뒤의 상태를 검사해서는 안 된다. 파생/자동 생성 여부는 **생성 시점에 기록**하고(합성한 주체가 id를 남긴다), 감사는 "작성된 계약"과 "관례로 채워진 계약"을 구분해 보고한다. 파생만 있는 항목은 실패가 아니라 경고로 노출하되 조용히 완전으로 통과시키지 않는다. 감사 진입 시점의 스냅샷으로 파생 여부를 추론하는 방식은 부팅이 먼저 채우는 실제 환경에서 무효이므로 쓰지 않는다.

## R599. 가드의 스위치는 guard 대상 콘텐츠에서 파생한다 (v54.98, P1075)

**Rule**: 답변의 수치·현재성·권리 가드를 켜고 끄는 조건은 그 가드가 실제로 검사하는 콘텐츠(응답에 근거가 결속되지 않은 수치가 있는가)에서 파생해야 하며, 질문 문면의 대리 변수(라틴 티커 존재, 특정 인용 패턴)에만 의존하지 않는다. 질문 분류는 가드를 좁히는 보조 신호로 쓸 수 있지만, 분류가 놓치는 정상 질문 형태(한글 종목명, 지표명 질문)에서 가드가 통째로 꺼지면 그 분류가 결함이다.

## R598. 완료한 작업은 표준 진입점에서 발견 가능한 핸드오프 기록을 남긴다 (v54.98, P1074)

**Rule**: 여러 에이전트가 교대하는 저장소에서 CHANGELOG·BUG-POSTMORTEM·RULES·QA-CHECKLIST 갱신만으로는 충분하지 않다. 작업 완료 시 마지막 작업·열린 항목·다음 행동·반복 금지를 담은 핸드오프 기록을 남기고 `_context/INDEX.md`의 "Current and live state"가 그것을 가리키게 한다. 산출물이 `_artifacts/`에만 있으면 다음 에이전트는 그 존재를 알 수 없고, 진입점에서 도달 가능할 때만 작업이 실제로 이어진다.

## R597. 값의 표시 소유자는 하나여야 하고, 소유권 이전은 승계 확인을 요구한다 (v54.98, P1074)

**Rule**: 어떤 값을 화면에 쓰는 책임을 legacy 경로에서 native 경로로 옮길 때는, 옮긴 쪽이 그 값을 실제로 생성·투영하는지 gate나 fixture로 확인한다. legacy가 "native가 소유한다"는 주석과 함께 특정 필드만 남기고 좁혀지면, native가 그 필드를 승계했는지 확인하기 전에는 그 값을 제거하지 않는다. 표시 값은 그 값의 기준(관측시각·출처·단위)을 함께 싣지 못하면 표시하지 않는다.

## R596. 바이트 계약·정본 어휘·단위 환산은 손 목록과 체크아웃 설정에 의존하지 않는다 (v54.98, P1074)

**Rule**: 내용 주소로 이름 붙는 아티팩트처럼 바이트 자체가 계약인 파일은 `.gitattributes`로 개행·인코딩 변환을 금지하고, 그 digest는 프로듀서가 실제로 기록한 바이트로 계산한다. 런타임이 방출하는 어휘(tier, source kind, chart kind)를 검증하는 gate는 손으로 관리하는 허용목록 대신 그 어휘의 정본 계약 모듈(`src/data/contracts/source-kind.js` 등)을 참조하며, 정본에 값이 추가될 때 gate가 자동으로 따라간다. 표시 단위를 가진 값의 단위 환산은 한 곳에서만 일어나고, 관측값과 합성 추정값은 같은 sink 안에서 구분 가능해야 한다.

## R595. Refresh producer는 push 전 fail-closed gate와 exact-SHA attestation을 함께 요구한다 (v54.96, P1073)

**Rule**: data/screener producer workflow는 commit/push 전에 해당 artifact·continuity·ownership 계약을 `continue-on-error` 없이 통과시켜야 한다. generated workspace state는 고빈도 data promotion commit에 결합하지 않는다. push 뒤 dispatch하는 CI는 반드시 `release_sha`로 같은 commit을 검사하고 Pages는 그 attestation을 기다린다. 이 경계는 staging promotion의 대체가 아니며 main에 미검증 revision이 잠시 존재할 수 있다는 잔여 위험을 숨기지 않는다.

## R594. 자동 PASS와 line-by-line semantic coverage는 서로 다른 증거다 (v54.96, P1072)

**Rule**: AST·문자열·fixture·browser gate의 PASS는 실행 계약의 증거일 뿐이며 현재 코드와 역사 전환의 사람 검토를 완료로 승격하지 않는다. exact-hash coverage ledger의 reviewed/total과 `releaseCertified`를 함께 보고하고, `releaseCertified=false`인 동안 semantic review 상태는 OPEN으로 표시한다.

## R593. 운영 실패 알림은 signature·failed gate·notification budget을 보존한다 (v54.96, P1071)

**Rule**: 동일 workflow와 동일 failure signature의 연속 실패는 durable issue body를 갱신하되 매번 댓글·알림을 만들지 않는다. 최초 escalation, 재오픈, signature 변경에서만 댓글을 허용하고, Actions API가 제공하는 failed job/step 또는 명시적 unavailable 상태를 body에 남긴다.

## R592. fast data plane은 no-op publish와 liveness write를 분리하고 KV budget을 계약화한다 (v54.96, P1069)

**Rule**: 같은 snapshot revision은 `quotes:current`를 다시 쓰지 않는다. heartbeat는 `checkedAt`(관찰), `publishedAt`(snapshot 발행), `writtenAt`(heartbeat KV 기록)을 분리하며 status change 또는 15분 liveness에서만 기록한다. 5분 cadence 기준 정상 상한은 384 writes/day(<500 warning target), status flapping 최악 상한은 576/day(<1000 free-tier limit)로 fixture가 검증한다.

## R591. company-primary 출처는 registry 검증된 issuer identity 없이는 승격하지 않는다 (v54.96, P1068)

**Rule**: SEC registrant/issuer IR identity만 company-primary의 primary floor를 채울 수 있다. `investors.com`, `nasdaq.com`과 단순 `ir.`/`investor.` substring은 secondary context일 뿐이며, registry의 검증 상태·verification method·owned IR domain이 명시되지 않으면 primary로 사용할 수 없다.

## R590. AI decision premise는 common evidence contract의 명시적 사용·권리·revision·freshness를 요구한다 (v54.96, P1068)

**Rule**: `status=verified/current`나 sourceKind만으로 전제를 VERIFIED로 승격하지 않는다. `allowedUse=decision`, `allowedUseCeiling=decision`, current-claim use, rightsId, revisionId, quality status, 관측시각과 명시적 freshness SLA를 공통 `evaluateEvidence(... purpose:'decision')`로 통과시켜야 하며 하나라도 없으면 UNVERIFIED다.

## R589. QA gate의 실제 읽기·쓰기 범위는 manifest 입력·영향 규칙·격리 경로와 일치해야 한다 (v54.95, P1067)

**Rule**: cacheable gate가 읽는 파일은 gate-level `inputs` 또는 정확한 그룹 입력에 포함하고, 그 파일의 변경은 해당 gate가 속한 그룹을 선택해야 한다. 생성 parity는 producer가 쓰는 모든 tracked 산출물을 비교하며 검사 과정의 임시 파일은 workspace가 아닌 `AIO_QA_CACHE_DIR` 또는 OS 임시 경로에 격리한다. 정적 문자열 검사는 실제 builder 실행의 대체물이 아니다.

## R588. 레거시 이벤트와 파생 route는 native 경계에서 한 번만 정규화한다 (v54.95, P1066)

**Rule**: window/document로 분열된 동일 논리 이벤트는 공통 호환 adapter가 양쪽을 수신하고 반대 타깃의 mirror만 bounded dedupe한다. 소비자마다 별도 이중 listener를 만들지 않는다. `theme-detail`처럼 독립 renderer가 없는 파생 route는 초기 진입에서도 canonical owner로 전환하고 선택 identity를 잃지 않는다.

## R587. 출처 등급·관측시각·수집시각·revision은 서로 대신할 수 없다 (v54.95, P1064/P1065)

**Rule**: provider별 `sourceKind`는 중앙 정규화 계약으로 T1~T4 authority tier를 판정하며 알 수 없는 값은 null/invalid로 fail closed한다. 더 늦게 도착하거나 더 최근에 fetch됐다는 이유로 오래된 관측, 낮은 권한 출처, 권리 철회 상태를 덮지 않는다. 뉴스 currentness는 기사 publication/observed 시각으로만 판정하고 fetch 시각은 별도 보존한다.

## R586. 결측 팩터는 중립값이 아니며 순위 분모를 희석하지 않는다 (v54.95, P1063)

**Rule**: 개별 행의 결측·stale·비유한 factor는 z=0 또는 score=50으로 대치하지 않는다. 관측된 양의 가중치만 합산해 그 가중치로 재정규화하고, 유효 가중치가 0인 행은 `composite/rank/quantSignal=null`로 유지해 percentile·turnover 분모에서 제외한다. coverage/confidence는 미래 수익 확률이 아니다.

## R585. 저장소 불변성과 구독 알림은 바깥 객체 상태나 한 구독자 실패에 의존하지 않는다 (v54.95, P1062)

**Rule**: 개발 모드의 deep-freeze는 바깥 객체가 이미 frozen이어도 모든 own data-property 자식을 순환해 동결한다. dispatch는 reducer 결과를 먼저 커밋하고 dispatch 시작 시점의 구독자 스냅샷 전체를 통지한다. 한 구독자 예외는 다른 구독자를 굶기지 않으며, 통지 완료 후 `STORE_LISTENER_FAILED` AggregateError로 호출자에게 보고한다. 동일 회귀 블록을 복제해 검사 수를 부풀리지 않는다.

## R584. 사용자 표면은 결측·선택·통화·렌더러 소유권을 producer 계약 그대로 보존한다 (v54.76 working tree, P1033)

**Rule**: `null`/blank를 0으로 바꾸거나 이전 needle·선택·상세를 남기지 않는다. 검색은 원래 step/index를 재번호화하지 않고 필터 밖 entity를 상세에 유지하지 않는다. 가격과 손익은 provider currency를 소비자까지 보존하며 통화가 없으면 `$`를 추정하지 않는다. native renderer marker는 실제 registry-owned draw 또는 명시적 blocked state와 같은 함수에서 기록한다. 한 action과 한 state 변경에는 한 click owner와 한 store-driven render owner만 둔다. byte-equivalent renderer 사본은 제거한다.

**Validation**: `src/ui/pages/market.js`, `sentiment.js`, `principles.js`, `masters.js`, `themes.js`, `entity.js`와 runtime/provider/normalizer currency chain. 이번 working tree는 syntax/diff만 확인했으며 browser/route/canvas verification은 QA-EXHAUST-23이 닫힐 때까지 미검증이다.

## R583. 브라우저 QA는 canonical route·제품 viewport·settled paint를 검사하고 실행 자원을 분리한다 (v54.76 working tree, P1032)

**Rule**: all-route gate는 `ROUTE_IDS`를 직접 소비하고 desktop 제품 범위는 공유 viewport config를 사용한다. geometry/canvas/overflow는 route lifecycle과 paint settle 뒤에 측정한다. 브라우저 concurrency와 CPU/VM concurrency를 분리하고 각 browser gate의 port를 충돌 없이 소유한다. static/headless/browser/live 증거를 서로 승격하지 않는다.

**Validation**: `scripts/qa-runner.mjs`, `ci-viewport-matrix-check.mjs`, all-route gates, `ci-desktop-scope-check.mjs`, `ci-qa-pipeline-contract-check.mjs`. 전체 browser matrix는 별도 실행 결과가 있어야만 완료로 표시한다.

## R582. 비동기 fallback·delegated action·route scheduler는 하나의 epoch와 owner를 사용한다 (v54.76 working tree, P1031)

**Rule**: primary/secondary CDN은 한 coordinator가 error/timeout 전환을 결정하고 늦은 응답이 확정된 runtime을 덮지 못하게 한다. 중첩 `data-action`은 ancestor open-url보다 우선한다. pageShown detail은 string/object를 한 canonical parser로 해석한다. 초기 timer와 async completion도 scheduler epoch에 속하며 route hide/dispose 뒤 재예약하지 않는다.

**Validation**: runtime contract, G108 headless fixtures, delayed-primary Chart browser fixture. 성능 예산과 전체 route browser certification은 별도다.

## R581. 발행 상태는 완전한 cycle tuple과 유효한 관측시각에서만 current가 된다 (v54.76 working tree, P1030)

**Rule**: 미래 관측은 현재 age 0으로 보정하지 않고 quarantine한다. snapshot `published`, operations freshness와 weekend grace는 Tier-0 full coverage, QG pass, row별 품질/session, news/history cycle 결과를 함께 요구한다. value/change basis와 source tier를 보존하고 실패한 cycle이 last-success를 덮지 않는다.

**Validation**: `build-market-snapshot.mjs`, `build-operations-status.mjs`, `fetch-data.mjs`, data-lineage 및 targeted contract gates. stale artifact 실패는 timestamp 변경으로 통과시키지 않는다.

## R580. 검색·필터는 렌더러와 동일한 canonical 관계 필드를 사용한다 (v54.76, P1029)

**Rule**: 동일 artifact의 관계 필드를 검색용으로 별도 이름 추정하지 않는다. 화면 카드가 `taxonomyNodeIds`를 통해 player/product를 연결하면 검색 haystack도 같은 필드를 사용하고, 존재하지 않는 `nodeIds` 같은 shadow alias를 만들지 않는다. 구조 결과 수뿐 아니라 실제 사용자 어휘로 검색해 기대 도메인과 엔티티 카드가 함께 나타나고 초기 집합으로 복원되는 경로를 브라우저에서 검증한다.

**Validation**: `public-data/atlas/player-product-registry.json`, `ci-atlas-contract-check.mjs`, `ci-atlas-browser-check.mjs`의 Samsung Electronics → memory-storage → memory-dram-hbm → player card 경로. 검색 도달성은 레지스트리 연결 무결성 증거이며 기업 사실의 현재성·정확성·투자 판단을 인증하지 않는다.

## R579. producer 상태 vocabulary와 사용자 문구를 같은 실제 렌더에서 검증한다 (v54.76, P1028)

**Rule**: producer가 발행하는 enum을 UI가 임의의 동의어로 다시 해석하지 않는다. `ok | partial | failed`처럼 운영 상태가 있는 경우 요약·배지·상세 문구가 모두 같은 canonical 값을 소비해야 한다. 같은 화면에 올바른 문구 하나가 있다는 사실이나 DOM 요소 존재는 다른 상태 문구의 의미 정확성을 대신하지 않는다. 브라우저 gate는 양성 상태의 기대 문구와 모순되는 음성 문구의 부재를 함께 검사한다.

**Validation**: `public-data/telegram-digest.json`, `scripts/fetch-telegram-digest.mjs`, `ci-atlas-contract-check.mjs`, `ci-atlas-browser-check.mjs`. 정상 수집 표시는 채널 관측 성공 증거일 뿐 Telegram 내용을 현재 사실·공식 근거·투자 판단으로 승격하지 않는다.

## R578. private index 전환은 모든 consumer를 resolver 또는 read-only adapter로 함께 이관한다 (v54.76, P1027)

**Rule**: mutable `Map`/`Set`을 public contract에서 제거할 때 producer만 바꾸지 않는다. 모든 runtime consumer가 canonical `resolve()`나 mutation API가 없는 read-only `get` adapter를 사용하도록 같은 변경에서 이관한다. source registry·claim 정적 검증과 실제 화면 링크 해석은 별도 gate로 둔다. 브라우저 검사는 단순 존재/timeout이 아니라 열린 상태, resolved/unresolved 수, canonical source count와 실패 진단값을 검증한다.

**Validation**: `ci-knowledge-core-semantic-check.mjs`, `ci-atlas-contract-check.mjs`, `ci-atlas-browser-check.mjs`. resolved link 수는 연결 무결성 증거이며 원문 최신성·사실성·권리·투자 적합성 증거가 아니다.

## R577. AI의 분석·검색·응답은 입력 모양이 아니라 추적 가능한 사용 계약으로 승격한다 (v54.76, P1026)

**Rule**: `null`, blank, boolean, 비유한 값은 금융 숫자가 아니다. 인과 주 사건·대안·교차자산은 같은 관측 시간창과 sourceKind/evidenceId를 가져야 하며 reference/untrusted/unknown은 causal support가 아니다. 행 수만으로 ready가 되지 않고 source·asOf·evidence를 함께 확인한다. KR/US 혼합 질문을 한 시장의 verified session으로 표시하지 않는다. prohibited 실행 요청은 ‘교육’ 단어가 섞여도 허용하지 않는다. research minimum source floor와 query budget은 유효한 nonnegative integer가 아니면 fail closed한다. UI에 노출되는 runner/parser/retriever 오류는 bounded code를 사용하고 claim/context/audit collection은 nested row까지 외부 변경에서 격리한다. 근거 coverage는 정확도나 수익 확률이 아니다.

**Validation**: `ci-ai-intelligence-contract-check.mjs`, `ci-inference-contract-check.mjs`, `ci-ai-chat-reliability-contract-check.mjs`, `ci-research-model-contract-check.mjs`, `ci-research-flow-contract-check.mjs`, `ci-knowledge-repository-contract.mjs`. Offline corpus/contract PASS는 live provider, 원문 사실성, 답변 정확도나 최신 시장값 인증이 아니다.

## R576. 앱·지식·금융 계산의 경계는 종료·관계 의미·결측·비용 의미를 보존한다 (v54.76, P1023~P1025)

**Rule**: app stop은 queued timer/microtask와 late snapshot publication을 취소하며 disposed router는 다시 transition하지 않는다. 지식 navigation edge는 causal edge와 다른 relation을 사용하고 명시되지 않은 relation을 generator가 추정하지 않는다. persisted learning/route context는 malformed collection, reserved key, cycle과 과대 payload를 제한한다. 모든 도메인 계산은 값의 물리적/금융적 범위를 검증하고 결측을 중립/0/라벨로 합성하지 않는다. portfolio weight의 분모·분자는 같은 valuation을 사용한다. 성과 원장은 gross return과 cost-adjusted net return을 다른 필드로 저장하고 schema migration으로 과거 의미를 보존한다. reference-only 위험 한도는 사용자 매매 명령으로 렌더링하지 않는다.

**Validation**: `ci-esm-core-unit-check.mjs`, `ci-domain-parity-check.mjs`, `ci-screener-workbench-contract.mjs`, `ci-knowledge-core-semantic-check.mjs`, `ci-knowledge-learning-state-contract.mjs`, `ci-knowledge-route-bridge-contract.mjs`, `ci-principles-contract-check.mjs`, `ci-runtime-contract-check.mjs`. 구조/fixture PASS는 production PIT/outcome, 실제 인과, 경제적 threshold 유효성이나 배포 인증이 아니다.

## R575. 금액·관측·근거 계약은 추정으로 빈칸을 채우지 않고 실제 소비 경계를 밝힌다 (v54.75, P1018~P1022)

**Rule**: 통화·단위·instrument·field·observedAt가 호환된 관측만 같은 값으로 reconcile한다. 원통화 금액은 환율과 변환 관측시각 없이 USD 계산·필터·팩터로 승격하지 않는다. null/blank 금융 입력은 0이 아니다. fallback은 value와 출처·시각·권한을 포함한 관측 객체 전체를 선택한다. state update는 omitted와 explicit null을 구분한다. MATCH lineage와 revision은 식별자뿐 아니라 필수 시각을 가져야 한다. timeout/abort/compute 실패 뒤의 늦은 결과는 cache나 상태에 publish하지 않는다. `Object.freeze`를 불변 계약으로 내세우는 registry는 mutable Map/Set을 외부에 노출하지 않는다. CI·미래 기반으로만 import되는 AI/knowledge 모듈은 현재 사용자 runtime 기능이나 최신성 증거로 설명하지 않는다. 도달 불가능한 UI와 의도적으로 제외된 capability의 selector는 보존 이유가 없으면 제거한다.

**Validation**: `ci-screener-workbench-contract.mjs`, `ci-native-decision-evidence-check.mjs`, `ci-esm-core-unit-check.mjs`, `ci-ai-intelligence-contract-check.mjs`, `ci-knowledge-core-semantic-check.mjs`, `ci-architecture-contract-check.mjs`, `ci-retirement-contract.mjs`, `_artifacts/exhaustive-audit-20260831/open-issue-probes.mjs`. 통과는 offline 반례 계약이며 실제 provider 최신성·권리·시장 정확도·배포 상태를 대신하지 않는다.

## R574. 집합 충족률·개별 유효성·표시·보관 재현을 서로 대신하지 않는다 (v54.74, P1013~P1016)

**Rule**: coverage는 입력 충족률이며 정확도·수익확률이 아니다. stale 참고값은 관측일과 함께 표시할 수 있지만 개별 계산 사용은 별도 판단한다. 집합 기준을 통과해도 부적합 행은 peer 통계를 바꾸지 못한다. native null을 legacy 값으로 덮지 않는다. 사용자 고정 실행은 입력·정의·모델·메타데이터 보관 후 실제 reload replay로 검증하며 자동 sync와 분리한다. 새 native 기능은 서비스 주입으로 연결하고 전역 facade를 늘리지 않는다. 취소된 요청의 cleanup은 후속 요청을 건드리지 않는다.

**Validation**: `ci-esm-core-unit-check.mjs`, `ci-screener-workbench-contract.mjs`, `ci-screener-auto-refresh-browser-check.mjs`, `ci-research-model-contract-check.mjs`, `ci-artifact-cache-check.mjs`, `ci-storage-migration-check.mjs`. 전체 파싱과 코드/이력 의미 검토의 진행률을 분리한다.

**P1017 추가**: 화면 조건 chip은 실제 control에서 파생한다. 조건 교체·삭제·반복 실행은 같은 정의를 누적하지 않고 원래 preset을 보존해야 한다. selector와 preset은 같은 전환 경로를 사용하고 이전 비동기 실행을 무효화한다. `ci-desktop-continuity-check.mjs`의 AST idempotence와 실제 screener browser 조작으로 검증한다.

## R573. 계산 계약은 경계값·시점·상태 전이를 실제 실행으로 검증한다 (v54.73, P1011/P1012)

**Rule**: 같은 증거의 순위는 입력 순서에 따라 달라지지 않는다. 해시가 있는 정의는 내부 변경으로 의미가 바뀌지 않는다. 결측 설정/기준값/지연은 0이나 관측 증거가 아니다. PIT는 availableAt과 모든 관측 시각을 asOf에 비교하며, 거래일·가격 경로가 없으면 exit 일정·MDD를 합성하지 않는다. in-flight/terminal 작업은 재선택하지 않는다. 테스트 전용 모듈 존재를 사용자 기능 완료로 집계하지 않는다.

**Validation**: `ci-screener-workbench-contract.mjs`, `ci-research-model-contract-check.mjs`, `ci-native-decision-evidence-check.mjs`, `ci-market-snapshot-contract-check.mjs`; T1041은 single probe, T160은 관련/무관 memory를 실행 검증한다. 정적 배선 검증과 실제 브라우저/provider 증거를 분리한다.

## R572. 표시·정렬·비교·복귀는 같은 관측과 실제 사용자 문맥을 사용한다 (v54.70, P1010)

**Rule**: 총점과 기여도는 단일 모델에서 파생하며 결측을 0이나 중립점수로 채우지 않는다. 숨긴 점수로 정렬하지 않고 결측은 양방향 정렬 모두 뒤로 보낸다. 비교는 같은 정의의 필드와 기준을 표시한다. 엔티티 이동은 실제 origin·필터·스크롤·포커스를 보존하고 접근성 이름도 갱신한다. 미연결 표는 중복 placeholder를 유지하지 말고 기존 관측 보고서에 연결한다. VXX/spot 수익률 차이를 선물 곡선이나 롤손익으로 대체하지 않는다. DOM 존재·native owner 표시는 전 사용자 흐름 또는 의미 검증 완료가 아니다.

**Validation**: `ci-desktop-continuity-check.mjs`, `ci-runtime-contract-check.mjs`, T875/T876, changed-route desktop browser interactions.

## R571. 요청·캐시·수집 시도·실제 관측의 수명주기를 분리한다 (v54.69, P1006~P1009)

**Rule**: 캐시는 전체 request identity와 source 시각을 보존한다. stale fallback은 명시적으로 요청하고 live로 승격하지 않는다. circuit은 upstream별 단일 회복 probe를 갖는다. 관측 결측은 0이나 다른 기간의 값으로 합성하지 않는다. 부분 수집은 유효한 값을 유지하지만 aggregate last-success를 갱신하지 않는다. 채팅의 완료·취소·clear는 재시도/이전 callback을 무효화한다. 파일 존재·정적 gate 통과를 최신 데이터·사용성·live 공급자 인증으로 주장하지 않는다.

**Validation**: `ci-proxy-continuity-check.mjs`, `ci-data-continuity-check.mjs`, `ci-chat-resilience-check.mjs`, `ci-desktop-continuity-check.mjs`.

## R570. 관측의 종목·주기·출처와 사용 범위를 소비자까지 보존한다 (v54.68, P1004)

**Rule**: 종목 선택 변경은 기존 결과를 초기화하고 모든 비동기 결과를 선택 epoch로 검증한다. 월/주/일봉 fallback은 실제 요청 주기를 유지하고 빈 배열을 성공으로 취급하지 않는다. 관측값 없는 지표를 시총·현재가 상수로 만들지 않는다. 공개 지연 팩터의 연구용 사용 가능성과 재배포 사용권 검토를 분리하되 미수신·stale·출처 불명 값을 검증 완료로 승격하지 않는다.

**Validation**: `ci-research-flow-contract-check.mjs`, `ci-screener-workbench-contract.mjs` and changed-route desktop browser checks.

## R569. 독립 hydration 경로는 각자의 완성 조건을 기다린다 (v54.65, P1003)

**Rule**: reconciliation, screener, history, knowledge처럼 독립적으로 hydrate되는 producer를 통합 브라우저 검사할 때 한 producer의 ready 신호를 전체 준비 완료로 간주하지 않는다. consumer가 요구하는 각 native slice의 최소 행 수·revision·derived snapshot 정합성을 명시적으로 기다린 뒤 판정한다.

**Validation**: `ci-page-market-epoch-browser-check.mjs` screener hydration barrier and browser-runtime exact-SHA shard.

## R568. 출처 세부표시와 공식 발표 일정은 의미를 보존하며 함께 전진한다 (v54.65, P1002)

**Rule**: 날짜가 붙은 reference memo는 provenance kind 뒤의 제한된 단일행 출처명을 허용하되 날짜·kind·닫힘 문법을 강제한다. 공식 정책 발표가 끝나면 값·관측일·lastRelease·nextRelease·공식 schedule을 동일 변경에서 갱신하고, 이미 지난 회의를 다음 일정으로 표시하지 않는다.

**Validation**: headless T849/T884, BOK official-primary reference and macro calendar registry.

## R567. 자동 refresh는 producer가 바꾼 모든 readiness와 generated evidence를 같은 커밋에 수렴시킨다 (v54.64, P1001)

**Rule**: core/screener 자동 refresh가 operations status나 public data를 갱신하면 `architecture/public-readiness.json`을 포함해 producer가 쓴 파생물을 stage하고, 모든 데이터·manifest 생성 뒤 `generate-workspace-state --write`를 실행해 CURRENT-STATE와 CONTEXT-CATALOG를 같은 커밋에 포함한다. 데이터만 최신이고 exact-SHA 계약이 실패하는 커밋을 게시하지 않는다.

**Validation**: 두 refresh workflow, data-pipeline contract, generated-state/workspace/operations preflight와 exact-SHA CI.

## R566. AI 안전·검색·지식 결손은 답변 전체가 아니라 실제 위험·주장 범위에서만 강등한다 (v54.64, P1000)

**Rule**: 매수·매도·손절·비중 같은 어휘 자체를 개인화 행동으로 판정하지 않는다. 교육·조건부 시나리오·시장/규제 영향·법률/세무 분석은 전제·관할·기준일·근거 상태를 표시해 답하며, pre-provider 차단은 개인화 실행·실제 주문/계정 변경·불법 실행법으로 제한한다. Web Research 실패나 opt-out은 current/causal claim만 보류하고 reference 설명을 지우지 않는다. 시장 원리와 AI 시대 지식은 bounded lazy retrieval, `sourceKind=REFERENCE`, `currentClaimsAllowed=false`, authoring/directness 상태, route/source provenance를 보존하며 live/snapshot evidence로 승격하지 않는다.

**Validation**: `src/ai/{intent/taxonomy,research/decision,retrieval/knowledge}.js`, `js/aio-chat.js`, both chat surfaces, `public-data/knowledge/ai-retrieval-index.json`, `scripts/ci-ai-intelligence-contract-check.mjs`, `scripts/ci-ai-chat-reliability-contract-check.mjs`, and `scripts/ci-knowledge-generated-parity-check.mjs`.

## R565. 텍스트 projection manifest의 digest·bytes는 checkout 줄바꿈에 독립적이어야 한다 (v54.63, P999)

**Rule**: GitHub Pages에 배포되는 JSON 텍스트의 manifest digest와 bytes는 CRLF/LF checkout 파일을 직접 해시하지 않고 LF 정규화된 UTF-8 직렬화를 기준으로 계산한다. builder와 verifier는 같은 canonicalization 함수를 사용하고 동일성 fixture를 통과해야 한다.

**Validation**: SEC runtime projection digest/byte CRLF-LF fixture, Windows data group, LF archive data group, exact-SHA GitHub CI.

## R564. 생성 상태의 텍스트 크기는 checkout 줄바꿈과 무관해야 한다 (v54.63, P998)

**Rule**: `CURRENT-STATE`·`CONTEXT-CATALOG`의 텍스트 바이트 집계는 CRLF/LF 물리 표현을 직접 세지 않고 LF 정규화된 UTF-8 크기를 사용한다. 로컬 작업 폴더 PASS만으로 deterministic generation을 단언하지 않으며 clean checkout에서도 같은 생성물을 요구한다.

**Validation**: workspace contract의 CRLF/LF 동일성 회귀 검사, Windows Node 20 preflight, LF clean checkout Node 20 preflight, exact-SHA GitHub CI.

## R563. 자동 데이터 merge의 마지막 생성물은 current workspace state다 (v54.63, P997)

**Rule**: 원격 refresh bot의 artifact를 병합하고 bounded projection·reconciliation·operations·release manifest를 재생성한 뒤에는 `generate-workspace-state --write`를 마지막에 실행한다. 병합 전 생성된 CURRENT-STATE를 재사용하거나 Windows 최신 런타임 PASS만으로 푸시하지 않으며, CI와 동일한 최소 Node 버전 preflight를 확인한다.

**Validation**: `node scripts/generate-workspace-state.mjs --check`, Node 20 `qa-runner --group preflight --no-cache`, exact-SHA CI attestation.

## R562. producer 자동화 상태와 lineage 회귀 계약은 같은 변경에서 이동한다 (v54.63, P996)

**Rule**: 데이터 카테고리를 manual에서 scheduled/server-auto로 승격하거나 그 반대로 강등할 때 producer·source registry·runtime inventory만 수정하고 과거 상태를 고정한 headless/CI 기대값을 남겨두지 않는다. 회귀 테스트는 현재 선언된 producer 연결을 구체적으로 검증하며, 알 수 없는 상태를 `connected`로 묵인하지 않는다.

**Validation**: `getDataLineageAudit()` staticMacro/breadth inventory, headless G079/T677, exact failed-group rerun and uncached full QA.

## R561. 공개 주기 데이터는 수동 숫자가 아니라 release-aware producer와 실패 가시성으로 닫는다 (v54.63, P995)

**Rule**: 무료 공개 최신치가 있는 항목은 operator-captured 숫자를 정기 pipeline의 truth로 보존하지 않는다. direct official adapter를 우선하고 필요한 relay는 명시적 provenance·bounded timeout·reference-only로 제한한다. 다중 tenor 파생값은 같은 공식 관측 행에서만 계산하며, producer 실패는 LKG의 원 관측일과 실패 상태를 운영 요약/감사에 노출한다. AI는 결측 사실을 생성하거나 현재치로 추정하지 않는다.

**Validation**: AAII direct/reader parser fixture, Treasury monthly XML same-date fixture, refresh workflow summary, data-refresh/reconciliation/lineage gates.

## R560. 병렬 검사에 노출된 generated JSON은 완성본 단위로 원자 교체한다 (v54.63, P994)

**Rule**: 다른 gate/runtime이 동시에 읽을 수 있는 생성 JSON은 최종 경로를 직접 truncate-write하지 않는다. 동일 파일시스템·동일 디렉터리의 고유 임시 파일에 완성본을 기록하고 atomic rename으로 교체하며, 실패한 임시 파일은 정리한다. Windows의 일시적 reader lock만 bounded backoff로 재시도하고 그 밖의 오류는 즉시 실패시킨다.

**Validation**: knowledge article/learning-graph builder regeneration, principles contract and generated-parity concurrency in uncached full QA.

## R559. 새 화면 지표는 sink·source alias·발표 일정까지 같은 변경으로 닫는다 (v54.63, P993)

**Rule**: data-snap 지표를 추가할 때 producer/runtime 값만 연결하고 끝내지 않는다. 정적 seed/alias audit와 보이는 정의를 함께 등록한다. 공식 발표가 수신되면 해당 날짜를 lastRelease로 승격하고 다음 공식 일정이 미래인지 검증한다.

**Validation**: headless G079/G080/G091/G092 cell-lineage and macro-calendar assertions.

## R558. 주간 데이터 freshness는 다음 공식 발표 가능 시각 전까지 release-aware로 계산한다 (v54.63, P992)

**Rule**: 주간 설문을 단순 UTC 7일/8일 경계로 stale 처리하지 않는다. 공식 집계 종료·발표 timezone을 반영한 bounded grace를 사용하되, 완전한 공식 값과 관측일이 없으면 적용하지 않고 다음 공개 관측을 추정하거나 날짜를 바꾸지 않는다.

**Validation**: AAII official page comparison and `ci-data-refresh-audit.mjs` policy-state fixture.

## R557. 공개 AI 경로와 bootstrap payload는 동일한 readiness·byte evidence에서 생성한다 (v54.63, P991)

**Rule**: 실패·stale·비 HTTPS Worker를 정적 설정만으로 공개하지 않는다. 공개 route는 관측된 health에서 생성하고 불확실하면 null/disabled/personal-key-only로 단조 강등한다. 대형 canonical 데이터는 초기 shell에서 제외하고 의미를 보존한 bounded projection이 선언 byte budget을 통과해야 한다.

**Validation**: operations/public-route/AI browser/release contracts and Masters initial-artifact budget.

## R556. 팩터 순위의 confidence는 입력 근거 진단이며 수익확률·매매신호가 아니다 (v54.63, P990)

**Rule**: 관측시점·identity·최소 coverage를 통과하지 못한 팩터는 종합점수에서 제외한다. 섹터 중립·극단치 완화·결측·turnover/regime 안정성을 기록하고 confidence의 의미를 UI에 표시한다. PIT·생존편향·비용·유동성·live parity가 없으면 decisionEligible/tradingSignal/자동 weight promotion은 항상 false다.

**Validation**: factor-ranks v2 negative controls, domain parity, screener workbench diagnostics.

## R555. 같은 지표명의 계절조정·비계절조정과 field별 권한을 합치지 않는다 (v54.63, P989)

**Rule**: CPI 공식 보도 canonical은 BLS CPI-U NSA headline/core이고 SA 전년비는 분석 companion으로 별도 전달한다. Treasury maturity/spread는 같은 관측일·출처를 유지한다. 하나의 행에 공식 공시와 지연 가격이 공존할 때 readiness/rights/sourceKind는 field별로 계산한다.

**Validation**: data pipeline/history-time/screener rights contracts plus refreshed BLS/Treasury artifacts.

## R554. 헤드라인은 발견 근거이지 기사 수준 분석·인과 근거가 아니다 (v54.63, P988)

**Rule**: 본문 또는 의미 있는 요약이 없는 뉴스는 headline-only로 분류하고 AI evidence, 감성 집계, causal market analysis에서 제외한다. 목록 노출은 허용하되 사용 제한과 분석 보류를 사용자에게 표시한다.

**Validation**: news normalization/headless fixture, market-analysis evidence gate and visible news boundary.

## R553. 기본 route와 정적 카드는 숨은 provider 호출·시점 없는 투자 숫자를 만들지 않는다 (v54.63, P987)

**Rule**: 페이지 진입이나 reference card 선택만으로 유료/외부 provider 검색을 실행하지 않는다. 재무 숫자는 공식 bounded artifact의 source/observed/filed/fetched 시각과 허용 용도를 함께 전달하고, 공시·현재 시세·추정치를 동일 시계로 섞지 않는다. 선택 상태는 native orchestrator가 소유한다.

**Validation**: entity provider/UI/event contracts, static-data and architecture retirement gates.

## R552. lazy mount 전 headless 상태 보존과 mount 후 브라우저 가시성을 분리한다 (v54.62, P986)

**Rule**: lazy native renderer가 아직 mount되지 않은 동기 headless 구간은 선택·pending state 보존을 검증하고, renderer marker 이후에는 실제 native panel 가시성을 검증한다. mount 전 legacy DOM을 다시 쓰게 하거나 headless 결과를 실제 브라우저 표시 증거로 승격하지 않는다.

**Validation**: `js/aio-tests.js` T641/T860 selection contract plus Chromium architecture and route-soak gates.

## R551. 보이는 투자 숫자는 기준일·출처·허용 용도를 같은 표면에 둔다 (v54.62, P985)

**Rule**: 투자 화면의 수치가 DOM data attribute에만 provenance를 가질 수 없다. 사용자가 값과 함께 observedAt/source/reference·decision 경계를 읽을 수 있어야 한다. 편집 taxonomy와 수동 추정치는 공식 현재 분류로 보이지 않게 기준일·성격을 표시하고, 출처 URL과 관측일이 없는 TAM/성장률 숫자는 공개하지 않는다.

**Validation**: `src/ui/pages/entity.js`, `src/ui/pages/themes.js`, `js/aio-core.js`, architecture/AI contracts and browser evidence.

## R550. derived route의 선택 state는 owning lazy renderer가 소비할 때까지 보존한다 (v54.62, P984)

**Rule**: 다른 route에서 inline/derived surface를 열 때 숨은 DOM 존재를 mount 증거로 사용하지 않는다. owning page active 상태와 native renderer marker를 확인하고, 선택 ID는 listener/mount 완료 뒤 정확히 한 번 소비·삭제한다. capture handler는 global delegate 존재 여부와 무관하게 자기 route action의 소유권을 명시한다.

**Validation**: `index.html` showThemeDetail, `js/aio-core.js` showPage, `src/ui/pages/themes.js`, `src/ui/pages/entity.js`, Chromium cross-route regression.

## R549. 실패 결과는 성공 TTL cache가 아니며 모든 안전 제약은 cache identity다 (v54.62, P983)

**Rule**: aborted/non-2xx/malformed/empty-invalid fetch 결과를 정상 artifact로 장기 캐시하지 않는다. integrity, byte budget 등 결과 수용 여부를 바꾸는 제약은 cache key에 포함하고, 더 느슨한 요청의 성공이 더 엄격한 요청을 우회할 수 없어야 한다.

**Validation**: `src/data/providers/entity.js`, `src/data/artifact-cache.js`, ESM core and artifact-cache fixtures.

## R548. freshness·LKG·readiness는 producer에서 UI까지 단조롭게 강등된다 (v54.62, P982)

**Rule**: 생성·publish·coverage 성공만으로 current를 선언하지 않고 artifact cadence SLA와 market-session grace를 함께 확인한다. 이전 관측을 유지할 때 source/asOf를 보존하되 current fetch 성공처럼 라벨링하지 않는다. readiness criterion은 같은 canonical artifact에서 생성하고 모든 tracked public artifact는 lineage policy를 가져야 한다.

**Validation**: fetch/data lineage/operations/runtime readers, `ci-data-lineage-audit.mjs`, `ci-operations-contract-check.mjs`, actual official refresh.

## R547. AI 행동 권한은 모든 provider·quota·retrieval보다 앞선 단일 오케스트레이터 경계다 (v54.62, P981)

**Rule**: QuestionPlan의 action permission이 denied이면 provider runner를 절대 호출하지 않는다. UI는 안전한 교육·비교 대안만 표시할 수 있으며, 각 chat adapter의 추가 gate는 단일 경계를 보강할 뿐 대체하지 않는다. required research가 미확인인 partial stream에는 최신 수치·원인 단정을 노출하지 않는다.

**Validation**: answer orchestrator executable fixture, both chat surfaces, `ci-ai-intelligence-contract-check.mjs`.

## R546. 운영 알림 임계값·dedupe·복구 증거는 같은 workflow identity로 수렴한다 (v54.61, P980)

**Rule**: SLO에 선언한 연속 실패 임계값과 실제 이슈 생성 시점은 같아야 한다. workflow별 marker는 정확히 하나의 durable issue를 소유하고 반복 실패는 갱신, 성공은 종료한다. rolling SLO는 Actions run뿐 아니라 issue marker 중복과 복구 상태를 읽되 기간 미경과를 PASS로 승격하지 않는다.

**Validation**: `.github/workflows/operations-alert.yml`, `scripts/build-operations-slo-window.mjs`, `scripts/ci-operations-slo-window-check.mjs`, `scripts/ci-workspace-contract-check.mjs`.

## R545. 관측 생략·실패·유효기간 내 LKG를 서로 다른 운영 상태로 보존한다 (v54.61, P979)

**Rule**: 로컬 생성이 live 관측을 요청하지 않았다는 이유로 마지막 유효 증거를 삭제하지 않는다. 명시적 관측 실패는 이전 성공으로 숨기지 않고, 재사용 증거는 원래 observedAt/source/revision/sourceSha를 유지하며 TTL 이후 `STALE`로 강등한다. source-only PASS는 exact-SHA live convergence가 아니다.

**Validation**: `scripts/build-operations-status.mjs`, `scripts/ci-operations-status-check.mjs`, `scripts/ci-deployment-convergence-check.mjs`, live Worker health.

## R544. 최초 browser lifecycle과 실패 group 재검사는 서로 다른 실행 단위다 (v54.61, P978)

**Rule**: 최초 release headless는 shared boot 비용을 한 번만 지불하는 ordered lifecycle로 실행한다. 실패 수정 뒤에는 stable group ID와 그 dependency만 exact selector로 재검사하고 성공 group 전체를 반복하지 않는다. unknown selector, stale failure output, group 밖 assertion은 fail closed한다.

**Validation**: `js/aio-tests.js`, `scripts/ci-headless-tests.mjs`, `scripts/qa-runner.mjs`, `scripts/ci-headless-group-lifecycle-check.mjs`, `scripts/ci-qa-runner-behavior-check.mjs`.

## R543. native ownership, lazy delivery, bulk retention은 독립적으로 증명한다 (v54.61, P977)

**Rule**: route가 lifecycle/renderer native라는 사실만으로 lazy chunk나 legacy 완전 퇴역을 선언하지 않는다. 모든 route page renderer는 route-scope dynamic import와 retry/late-write 폐기 계약을 가져야 하며, interactive payload는 bounded projection만 사용한다. append-only/canonical bulk는 digest-bound object 또는 운영자 bulk store에 두고 Pages shell과 분리한다.

**Validation**: `architecture/route-owners.json`, `src/app/router.js`, `src/app/bootstrap.js`, SEC/Masters projection builders and contracts, `architecture/retirement-manifest.json`.

## R542. 버전 범프는 revision-bound 실행 증거를 자동 승격하지 않고 무효화한다 (v54.60, P976)

**Rule**: R1 source revision 변경은 과거 boot·route soak·live parity를 새 revision의 PASS로 치환하지 않는다. 재측정되지 않은 실행 증거는 `REMEASURE_REQUIRED`/`PENDING_LOCAL_GATE`로 강등하고 이전 결과는 revision이 표시된 역사 증거로만 보존한다. 긴 실행 gate는 매 편집 후가 아니라 release/shared-shell 인증 경계에서 한 번 실행한다.

**Validation**: `scripts/bump-version.mjs`, `architecture/operations-slo.json`, `architecture/public-readiness.json`, `scripts/ci-operations-contract-check.mjs`.

## R541. 런타임 상태 요약과 릴리스 전수 감사는 실행 경계와 비용 예산을 공유하지 않는다 (v54.60, P975)

**Rule**: UI/runtime readiness는 bounded sample과 필수 계약만 계산한다. release deep audit는 explicit `mode:full`에서만 실행하고 같은 run의 consumer는 immutable 결과를 주입·공유한다. 단위 테스트는 pure contract를 우선하며 전체 renderer·route·provider 통합은 해당 browser/live gate가 한 번만 소유한다. 실패 수정 뒤에는 exact `rerun-failed`를 사용하고 release `full --no-cache`는 shared-shell 또는 배포 인증 경계에서 한 번만 실행한다. 테스트 group은 독립 setup/teardown이 증명되기 전에는 병렬 shard로 선언하지 않는다.

**Validation**: `js/aio-core.js` AutoOps/runtime/full modes and injected deployment/share audits, `js/aio-tests.js` shared full audit/pure breadth regression, `scripts/ci-headless-tests.mjs` lifecycle cleanup, `architecture/qa-pipeline.json` ordered headless gate.

## R540. 비ASCII 민감정보 단위는 ASCII `\b` 경계에 의존하지 않는다 (v54.59, P974)

**Rule**: 한국어 수량·화폐·식별자 등 비ASCII 토큰을 redaction할 때 JavaScript `\b`를 토큰 끝 경계로 가정하지 않는다. 언어별 실제 입력 fixture에서 원문이 사라지고 정책 marker만 남는지 검증하며, 테스트를 통과시키기 위해 민감정보 기대값을 완화하지 않는다.

**Validation**: `js/aio-core.js` `_aioRedactChatHistoryText`, `js/aio-tests.js` T962, full headless gate.

## R539. Compatibility facade의 현재 표면과 목표 표면을 구분하고 확장을 ratchet한다 (v54.59, P972)

**Rule**: `architecture/retirement-manifest.json.currentFacadeApi`는 `AIO_ARCH`의 실제 노출 전체와 정확히 일치해야 하며 `approvedFacadeApi`는 migration 이후 목표로만 해석한다. 현재 개수는 budget을 넘을 수 없고 `getState` 등 조회 API는 deep-frozen snapshot을 반환한다. lifecycle/renderer native만으로 facade 축소·migration 완료를 선언하지 않으며 모든 applicable owner와 legacy writer 퇴역을 확인한다.

**Validation**: `scripts/ci-retirement-contract.mjs`, `src/legacy/compatibility-facade.js`, `architecture/route-owners.json`.

## R538. Service worker 설치는 작은 핵심 셸만 원자적으로 precache한다 (v54.59, P972)

**Rule**: service worker install은 bounded same-origin critical shell만 `cache.addAll`로 설치한다. route/ESM module은 실제 요청 뒤 runtime cache하며 외부 CDN·대형 데이터·전체 module registry가 install을 막거나 `allSettled`로 partial install을 성공 처리할 수 없다.

**Validation**: `scripts/ci-service-worker-cache-policy-check.mjs`, `sw.js`, `scripts/ci-architecture-contract-check.mjs`.

## R537. 자동 접근성 PASS는 수동 접근성 인증을 대신하지 않는다 (v54.59, P972)

**Rule**: 자동 route matrix는 이름·키보드 구조·canvas·font·target·dialog·skip-link 위반만 인증한다. 24px 미만 target은 WCAG inline-text 예외와 실제 위반을 구분한다. screen reader, computed contrast, 200% zoom/reflow, 모든 dialog focus trap/return은 구조화된 `UNVERIFIED` 경계로 남기며 public promotion에서 operator evidence를 요구한다.

**Validation**: `scripts/ci-accessibility-matrix-check.mjs`, `_artifacts/accessibility-matrix-audit.json`, `architecture/public-readiness.json`.

## R536. Pages는 CI가 발행한 불변 SHA attestation만 배포한다 (v54.59, P973)

**Rule**: Pages workflow는 mutable `head_branch`나 동일 버전 비교로 checkout 대상을 정하지 않는다. 앱 push와 data bot commit 모두 정확한 SHA에서 CI를 실행하고, 모든 선택 gate가 통과한 뒤 업로드된 `aio-release-attestation.v1`의 SHA를 검증해 그 commit만 배포한다. refresh의 기본 `GITHUB_TOKEN` push는 후속 push workflow를 만들지 않으므로 실제 push SHA를 workflow_dispatch 입력으로 명시한다.

**Validation**: `.github/workflows/ci.yml`, `.github/workflows/pages-deploy.yml`, 두 refresh workflow, `scripts/ci-qa-pipeline-contract-check.mjs`.

## R535. 제품 범위·non-goal·trust plane은 구현보다 먼저 계약한다 (v54.59, P972)

**Rule**: AIO의 제품 정체성은 자기주도 투자 연구·의사결정 보조이며 주문 실행, 무조건적 개인화 행동 지시, 라이선스 전문 실시간 단말 parity, 공개 best-effort 자료의 real-time 주장은 non-goal이다. 아키텍처 변경은 `architecture/product-charter.json`의 evidence policy·trust plane·deployment boundary를 만족하거나 먼저 헌장을 명시적으로 변경해야 한다.

**Validation**: `scripts/ci-product-charter-contract-check.mjs`, `_context/AIO-CURRENT-PRODUCT-ARCHITECTURE-CHARTER.md`.

## R534. QA 영향 범위는 task baseline 또는 명시적 파일 목록으로 결정한다 (v54.59, P971)

**Rule**: 기존 dirty tree에서 작업할 때 수정 전 `session-start --session <task-id>`를 실행한다. 기준선이 없으면 이번 작업이 소유한 정확한 `--files` 목록을 사용한다. `rerun-failed`는 이전 실패 gate와 선언된 dependency만 실행하며 무관한 manifest/runner 변경은 모든 PASS cache를 무효화하지 않는다.

**Validation**: `scripts/ci-qa-runner-behavior-check.mjs`, `scripts/qa-runner.mjs`, post-edit-qa skill.

## R533. 성능·운영 측정은 revision·commit·환경·명령·artifact에 묶는다 (v54.59, P970)

**Rule**: 측정값의 상단 appRevision 문자열을 기계적으로 올려 현재 증거로 만들 수 없다. boot/soak/SLO 증거는 observed revision, git head, timestamp, browser/environment, command, artifact와 gate/target 상태를 보존하며 local evidence는 live/30-day evidence를 대신하지 않는다.

**Validation**: `scripts/ci-boot-interaction-check.mjs`, `scripts/ci-route-soak-check.mjs`, `scripts/ci-operations-contract-check.mjs`, `architecture/operations-slo.json`.

## R532. AI quota reservation과 upstream 실행은 하나의 idempotency 경계를 가진다 (v54.59, P969)

**Rule**: 동일한 명시 idempotency key는 최대 한 번만 upstream을 호출하고 중복은 호출 전에 거부한다. key가 없는 별도 요청은 body가 같아도 각각 quota를 소비한다. quota reservation은 bounded retention으로 정리하며 CORS는 지원 key header를 명시한다.

**Validation**: `scripts/ci-worker-anthropic-check.mjs`, `cloudflare-worker-proxy.js`.

## R531. 민감 로컬 보존은 기본 OFF·최소화·암호화 정확성을 요구한다 (v54.59, P968)

**Rule**: chat history는 opt-in 전 저장하지 않고 저장 전 민감정보를 redaction하며 비활성화 시 기존 row를 삭제한다. 동의 wrapper나 versioned JSON repository를 Vault라 부르지 않는다. `encryptedAtRest` capability가 없는 저장소는 privacy vault read/write를 모두 거부하고 개인 portfolio는 검증된 AES-GCM 경로만 소비한다.

**Validation**: `js/aio-tests.js` T962, `scripts/ci-storage-migration-check.mjs`, `scripts/ci-portfolio-vault-e2e.mjs`, `src/storage/vault.js`.

## R530. Evidence allowedUse는 생성 이후 오직 더 제한적으로만 바뀐다 (v54.59, P967)

**Rule**: `none < reference < decision` 순서에서 source rights ceiling, explicit use, freshness/status의 교집합만 허용한다. freshness 평가나 consumer가 reference/snapshot 값을 decision으로 승격할 수 없다. 공개 Fear & Greed best-effort 호출은 현재 값이어도 reference-only다.

**Validation**: `src/data/contracts/evidence.js`, `src/data/quality/freshness.js`, `scripts/ci-source-registry-contract-check.mjs`, ESM/runtime fixtures.

## R529. 모든 CI script는 실행 경로 또는 명시적 퇴역 원장을 가져야 한다 (v54.59, P966)

**Rule**: `scripts/ci-*.mjs`는 `architecture/qa-pipeline.json` group/profile/workflow contract에서 도달 가능하거나 replacement·reason을 가진 `retiredGateScripts`에 있어야 한다. domain gate가 workflow YAML을 문자열 검색해 자기 도달성을 증명할 수 없고, refresh/watchdog이 요구하는 source/data gate는 manifest contract가 직접 검증한다.

**Validation**: `scripts/ci-qa-pipeline-contract-check.mjs`, `architecture/qa-pipeline.json`.

## R525. QA는 영향 기반 manifest와 단계별 전수 실패 수집을 사용한다 (v54.58, P965)

**Rule**: `architecture/qa-pipeline.json`이 로컬·CI gate, input scope, phase, timeout, cache policy의 단일 원본이다. 값싼 preflight 안에는 browser/server 시작을 넣지 않으며 한 phase의 gate는 첫 실패에서 중단하지 않고 모두 보고한다. 정상 작업은 `affected`, 수정 후에는 `rerun-failed`, release/shared-shell 인증은 마지막 한 번의 `full --no-cache`를 사용한다. CI는 preflight → static matrix → browser matrix 순서를 지키고 matrix는 `fail-fast: false`다.

**Validation**: `scripts/ci-qa-runner-behavior-check.mjs`, `scripts/ci-qa-pipeline-contract-check.mjs`, `.github/workflows/ci.yml`, `.cache/aio-qa/last-run.json`.

## R526. 앱 릴리스와 데이터-only 릴리스는 검증·checkout 경계를 공유하지 않는다 (v54.58, P965)

**Superseded by R536/P973 (v54.59)**: version-equality + mutable branch 방식은 같은 버전의 다른 내용을 증명하지 못하므로 폐기됐다. 앱과 data refresh 모두 정확한 commit SHA를 CI에 전달하고 CI attestation을 거쳐 Pages가 같은 SHA만 배포한다. Data refresh는 origin별 관련 shard만 실행해 범위를 줄이되 direct Pages 우회 경로를 갖지 않는다.

**Validation**: R536의 attestation workflow와 `scripts/ci-qa-pipeline-contract-check.mjs`.

## R527. Endpoint 구성과 현재 운영 증거는 같은 파일에 저장하지 않는다 (v54.58, P965)

**Rule**: `architecture/worker-endpoints.json`에는 endpoint·role·secret 요구사항만 둔다. timestamp가 있는 health/revision/coverage는 refresh/watchdog/release 시 다시 관찰해 운영 artifact 또는 ignored QA report에 기록한다. 오래된 관측값으로 `configured-healthy`를 영구 선언하지 않으며 local, live Pages, proxy, fast plane, GitHub workflow 상태를 별도 evidence level로 보고한다.

**Validation**: `scripts/build-operations-status.mjs`, `scripts/ci-external-pipeline-check.mjs`, `public-data/operations-status.json`, `.github/workflows/data-watchdog.yml`.

## R528. Cloudflare 배포는 수동 권한·직렬 ownership·관측·smoke를 함께 가진다 (v54.58, P965)

**Rule**: AI proxy와 fast data plane 배포는 `workflow_dispatch`만 허용하고 같은 plane의 배포를 cancel하지 않고 직렬화한다. 고정 Wrangler, source contract, Workers Logs sampling, post-deploy health를 필수로 하며 AI proxy는 CORS/origin fail-closed와 실제 provider smoke까지 통과해야 성공이다. Pages 또는 local QA 성공은 Worker 배포 권한이 아니다.

**Validation**: `.github/workflows/deploy-ai-proxy.yml`, `.github/workflows/deploy-data-plane.yml`, `worker/wrangler.proxy.toml`, `worker/wrangler.example.toml`, `scripts/ci-cloudflare-deployment-contract-check.mjs`.

## R520. Current workspace facts are generated once and historical ledgers are search-only (v54.57, P964)

**Rule**: version, route count, code size, context inventory, skill/agent/workflow counts and knowledge readiness must be derived from repository registries into `_context/CURRENT-STATE.md` and `_context/CONTEXT-CATALOG.json`. AGENTS/CLAUDE/INDEX/agent prompts may link to those outputs but may not copy changing counts. RULES, BUG, QA and KNOWLEDGE remain durable ledgers and are queried by matching term/ID rather than loaded in full by default. Dated handoffs are not current state unless the catalog marks them targeted.

**Validation**: `scripts/generate-workspace-state.mjs --check`, `scripts/ci-workspace-contract-check.mjs`, `scripts/ci-knowledge-lint-check.mjs`, and the 64KiB preflight budget in `scripts/ci-workflow-compaction-check.mjs`.

## R521. Agent hooks are portable guardrails and never mutate repository authority state (v54.57, P964)

**Rule**: project hooks must consume one JSON object from stdin, resolve scripts from the Git root, support Windows commands and emit only documented event output. They may deny destructive commands or provide advisory context, but automatic commit/push/deploy, staging, working-content deletion or pressure to request deployment is forbidden. Stop/SessionEnd cannot broaden user authority.

**Validation**: `.codex/hooks.json`, `.claude/settings.json`, `scripts/agent-hook.mjs`, hook positive/negative fixtures in `ci-workspace-contract-check.mjs`, and absence of tracked legacy shell hooks.

## R522. Skills and agent profiles require generated parity plus observable eval inputs (v54.57, P964)

**Rule**: `.claude/skills` is the canonical skill tree and tracked `.agents/skills` is its generated byte mirror and portable Codex discovery surface. A clean checkout missing that mirror must fail, never skip, the parity gate. `architecture/agent-profiles.json` is the canonical source for `.claude/agents` and `.codex/agents`. Every skill has at least three stable task prompts with observable must-include evidence and a negative-control claim. Deterministic topology/fixture PASS must never be reported as independent behavioral-model PASS.

**Validation**: `scripts/ci-skill-contract-check.mjs`, `scripts/ci-skill-eval-fixture-check.mjs`, `scripts/sync-agent-skills.mjs --check`, and `scripts/sync-agent-profiles.mjs --check`.

## R523. Workspace and knowledge drift are push gates with deduplicated operational escalation (v54.57, P964)

**Rule**: workspace contract and knowledge lint run on every push/PR that can deploy and on the scheduled knowledge workflow. A failing CI, data watchdog or knowledge lint must update one workflow-specific operational issue instead of producing unlimited duplicates or relying only on transient Actions email. The issue closes only after the same workflow reports success. This escalation reports failure; it does not auto-edit, auto-commit or auto-deploy.

**Validation**: `.github/workflows/ci.yml`, `.github/workflows/knowledge-lint.yml`, `.github/workflows/operations-alert.yml`, and `scripts/ci-workspace-contract-check.mjs`.

## R524. Structural knowledge completeness and semantic certification are separate state machines (v54.57, P964)

**Rule**: catalog parity, ontology connectivity, article counts and source-ledger shape may prove structural readiness only. They may not set human review, source-directness, publication readiness or investment correctness to complete. Current observations, durable principles and historical integration records must keep separate provenance/currentness boundaries and independent promotion gates.

**Validation**: `_context/CURRENT-STATE.md`, `public-data/knowledge/status-summary.json`, `scripts/ci-knowledge-lint-check.mjs`, knowledge contract family and explicit human/live QA items.

## R509. Learning pages require narrative order, destination consumption and filing-semantic labels (v54.43, P953)

**Rule**: a knowledge page must open on the authored causal story, keep each category explanation readable as a bounded passage, and place detailed maps/evidence behind the learner's next question. A cross-page CTA is complete only when the destination consumes the exact concept, metric and timeframe, shows the arrival context, preserves a return path and restores after reload. Plain page navigation must clear page-specific knowledge query keys so one page's tab or manager cannot select another page's mode. Regulatory UI and artifact fields must describe the filing evidence: reported-share deltas are not trades, 13D/G is not a 13F position, and a primary HTML/text document may not be labeled XML.

**Validation**: `scripts/ci-three-page-learning-flow-check.mjs`, the Principles/Atlas/Masters focused contract and browser gates, `scripts/ci-three-page-artifact-budget-check.mjs`, `scripts/reconcile-atlas-taxonomy.mjs`, and `scripts/ci-masters-contract-check.mjs`.

## R510. User-supplied market commentary stays reference-only until a producer reconciles it (v54.44, P954)

**Rule**: X posts, screenshots, interviews, estimates, rumors and role-level deal maps may seed durable hypotheses, keywords, chat context and monitoring lenses, but they may not become current quotes, valuation, event results, option positioning, trade instructions or live ranking without a dated official/provider evidence row. Every consumer must expose `REFERENCE`/`UNVERIFIED` and preserve the source/as-of boundary.

**Validation**: `_context/RESEARCH-INTEGRATION-AI-INFRA-MARKET-RISK-2026-08-22.md`, `src/domain/ai/inference-efficiency.js`, `src/domain/macro/transmission.js`, `QA-REF-AI-01~02`, and the existing typed AI evidence/runtime audits.

## R511. Missing macro transmission variables are blocked, not inferred from proxies (v54.44, P955)

**Rule**: a causal macro lens may consume connected 2Y/10Y/30Y, FRED HY OAS, VIX, breadth and cross-asset quotes, but term premium, Treasury/corporate issuance, dealer gamma/options positioning and China credit/investment remain distinct inputs. A 10Y level, VIX level, HYG price or narrative headline cannot silently substitute for a missing producer; the UI must name the blocked field and its next connection gate.

**Validation**: `src/domain/macro/transmission.js`, `src/ui/pages/market.js`, `QA-REF-MACRO-01`, and the provider/data-refresh contracts when a producer is added.

## R512. Missing numeric observations, news topic suppression and chart observers fail closed together (v54.45, P956)

**Rule**: `null`, empty and non-finite numeric inputs must remain unavailable; a finite zero is a valid observation and must not be discarded. Shared news surfaces must use one topic-suppression vocabulary so credit and FX/bond stories cannot acquire misleading ticker decorations. Any chart or observer created by a route-scoped surface must be registered and disposed before the surface is re-entered or removed. New ESM domain imports must also be present in the service-worker shell asset registry.

**Validation**: `scripts/ci-architecture-contract-check.mjs`, `src/domain/ai/inference-efficiency.js`, `src/ui/pages/market.js`, `js/aio-data.js`, `js/aio-core.js`, `index.html`, and the full route/accessibility/soak browser gates.

## R514. Cancellation, focus return and coverage denominators are one boundary (v54.48, P958)

**Rule**: a caller-provided `AbortSignal` must be composed with every internal timeout controller and must be distinguishable from a timeout. A scheduler must not clear `_inFlight` while its underlying task is pending; route/page refreshes must abort or scope work before the next route can consume it. Every dialog/menu close path must restore its opener when it remains in the document. Screener mixed fundamental coverage, SEC-only coverage and factor observation/generated timestamps are separate metrics and must not share a denominator or model label. A source badge may say `LIVE` only after a source-confirmed observation; otherwise it stays `SNAPSHOT`, unavailable or pending.

**Validation**: `src/platform/http.js`, `js/aio-data.js`, modal/menu surfaces in `index.html`/`js/aio-core.js`, `src/data/providers/screener.js`, `src/ui/pages/screener.js`, `scripts/sync-screener-universe.mjs`, `ci-esm-core-unit-check.mjs`, headless/accessibility/viewport/route-soak gates and the data-lineage refresh audit.

## R515. Page hydration must follow route ownership (v54.49, P959)

**Rule**: a `pageShown` listener that can read a provider, normalize a large artifact or start network-backed hydration must declare its owning route set. It may queue work only while that route remains active and its route scope remains current; unrelated routes must not trigger the read. Global refresh and shared-artifact publication events remain separate from page-entry hydration.

**Validation**: `src/app/bootstrap.js`, `src/data/orchestrators/entity.js`, `src/data/orchestrators/screener.js`, the architecture/runtime contracts, vertical-slice browser and 20-route route-soak gates.

## R516. Direct entity routes must start from neutral, accessible empty state (v54.50, P960)

**Rule**: a direct ticker/entity route may not seed a concrete symbol, portfolio relationship or stale breadcrumb before the user selects an entity or a provider returns one. Waiting, unavailable and blocked panels must explain their state, and every symbol/code input must have a programmatic accessible name independent of placeholder text.

**Validation**: `src/ui/pages/entity.js`, `js/aio-core.js`, `index.html`, the accessibility matrix, route-by-viewport visual audit and entity direct-entry browser checks.

## R517. Freshness, source precedence and missingness must remain visible across compatibility boundaries (v54.50, P961)

**Rule**: a runtime observation must not be overwritten by a reference snapshot; a stale identity universe or expired news cycle may not be labeled current; and missing numeric coverage must remain `null`/`미확인`, never a synthetic zero. Shared news renderers must suppress inferred security tickers when the primary topic is macro, geopolitical, policy, rates or FX/bond. Hidden action surfaces must not gain focusable semantics until they are visible.

**Validation**: `src/data/orchestrators/sentiment.js`, `src/data/orchestrators/news.js`, `src/data/providers/screener.js`, `src/ui/pages/screener.js`, `src/ui/pages/news.js`, `js/aio-data.js`, `js/aio-core.js`, sentiment/provider fixtures, data-refresh/lineage audits and headless/accessibility/viewport gates.

## R519. Browser network assertions must correlate to the initiating user action (v54.55, P963)

**Rule**: In a page with asynchronous background work, a browser gate must not assert against a mutable “last request” slot. Capture the request set and correlate the assertion to a unique prompt, request ID, or endpoint contract owned by the test action. Performance budgets are interpreted from isolated runs when concurrent Chromium jobs can contend for CPU.

**Validation**: `scripts/ci-ai-chat-public-route-browser-check.mjs` selects the request containing the unique public-route test payload and reports the observed request count; `scripts/ci-boot-interaction-check.mjs` is rerun in isolation for FCP/route/long-task release evidence.

## R518. Portfolio financial values and cross-route detail controls fail closed (v54.54, P962)

**Rule**: prices and valuations in the portfolio domain must be strictly positive; a stored/runtime zero or negative placeholder may not override a valid quote, and P&L/totals/exposure remain unavailable until their required inputs are present. Any visible theme/detail CTA must have a native or compatibility handler that reaches the owning detail surface, while direct entity context must not imply portfolio ownership. Retired route names and BUY/SELL/VIX educational copy must preserve the integrated-route and non-advice boundaries.

**Validation**: `src/data/providers/portfolio.js`, `src/domain/portfolio/surface.js`, `src/ui/pages/portfolio.js`, `src/ui/pages/entity.js`, `src/ui/pages/themes.js`, `index.html`, `js/aio-glossary.js`, the in-app Browser interaction matrix, portfolio negative-control fixtures and the full route/accessibility/headless gates.

## R513. Currentness, cancellation, source semantics and stale disclosure share one negative-control gate (v54.47, P957)

**Rule**: visible data must remain `REFERENCE`/unavailable until its source and observation basis are known; initial labels may not claim `LIVE` or `SOURCE 확인` before a successful observation. Route-scoped observers and mutation scans must operate on added/visible roots, not repeatedly rescan hidden pages. Any timeout that can outlive the UI response must expose a cancellation hook and propagate `AbortSignal` to the underlying fetch. Macro labels must preserve metric semantics such as EFFR versus FOMC target range and BLS SA-derived YoY versus NSA release headline. A stale operator or user note must show elapsed age and an explicit reference-only boundary.

**Validation**: `scripts/ci-architecture-contract-check.mjs`, `scripts/ci-static-data-contract-check.mjs`, `scripts/ci-runtime-contract-check.mjs`, the accessibility/viewport/route-soak/headless gates, and the dynamic lookup/chat cancellation fixtures.

## R508. Rendering, coverage, persistence and publication readiness are separate contracts (v54.42, P952)

**Rule**: a page may report data as complete only when its declared universe, current-period rows and required artifact groups are complete; otherwise it must expose an explicit partial/fallback state and category counts. Opening a library lesson or primer must bind bookmark, note and share URL state to that exact item and survive reload/back/forward. Professional route bridges must use the app's parsed route grammar and expose their metric/timeframe context after direct load. Structured knowledge may not imply human review or publication readiness, and object-valued glossary content must be rendered as readable product text rather than serialized JSON.

**Validation**: `scripts/ci-masters-contract-check.mjs`, `scripts/ci-masters-browser-check.mjs`, `scripts/ci-principles-browser-check.mjs`, `scripts/ci-atlas-browser-check.mjs`, `scripts/ci-knowledge-route-bridge-contract.mjs`, and `scripts/ci-three-page-artifact-budget-check.mjs`.

## R507. Refresh audits distinguish observed, policy-blocked and runtime-derived categories (v54.41, P951)

**Rule**: a public current publisher observation must be audited from its dated artifact and may not be labeled `SKIPPED` merely because it is reference-only. Subscriber/current-access restrictions are `BLOCKED` with the last permissible reference kept separately. A model computed from runtime OHLCV is `DYNAMIC`, not an unavailable external feed. Local environment absence must never be used as proof that a GitHub Actions repository variable is absent; configuration and execution evidence are reported separately.

**Validation**: `scripts/refresh-web-research.mjs`, `scripts/ci-web-research-contract-check.mjs`, `scripts/ci-data-refresh-audit.mjs`, and the SEC workflow/configuration evidence ledger.

## R506. Detail artifacts belong to the narrowest interaction and retain honest failure state (v54.40, P950)

**Rule**: route entry and profile selection may consume summaries but must not fetch full manager rows or long-form detail artifacts. Compact Top rows must never populate full-row state or be labeled as a complete filing. Full holdings, sector mapping, comparison detail and long-form articles load only after the matching explicit interaction, expose loading/failure/retry state, and preserve other summary/source surfaces after failure. A shared resolved-artifact cache must have an enforced LRU/size bound so long sessions cannot retain every visited shard indefinitely.

**Validation**: `scripts/ci-artifact-cache-check.mjs`, `scripts/ci-masters-browser-check.mjs`, `scripts/ci-principles-browser-check.mjs`, `scripts/ci-atlas-browser-check.mjs`, and `scripts/ci-three-page-artifact-budget-check.mjs`.

## R505. Summary-only surfaces consume compact projections, not completion corpora (v54.39, P949)

**Rule**: a page that renders only counts or progress must consume a deterministic compact status projection and may not download article, coverage, claim or dossier monoliths. The projection must retain the canonical incomplete/human-review boundary and must never be used as evidence for unit-level publication or completion.

**Validation**: `scripts/build-knowledge-runtime-index.mjs`, `public-data/knowledge/status-summary.json`, `scripts/ci-three-page-artifact-budget-check.mjs`, and the Atlas focused Chromium gate.

## R504. Browser runtime data uses bounded shards and shared request coalescing (v54.39, P949)

**Rule**: canonical full-resolution holdings, history, aggregates and long-form corpora remain rebuild/research artifacts; browser routes consume a compact index and fetch only the selected manager, period or article shard. Identical URL requests from concurrent capabilities or route re-entry must share one in-flight/result cache. One consumer's AbortSignal may stop its own wait but must not cancel data required by another live consumer. Every affected route has an explicit cold-byte budget and a zero-repeat re-entry assertion.

**Validation**: `src/data/artifact-cache.js`, `scripts/build-masters-runtime-artifacts.mjs`, `scripts/ci-artifact-cache-check.mjs`, `scripts/ci-masters-contract-check.mjs`, and `scripts/ci-three-page-artifact-budget-check.mjs`.

## R502. Every golden route belongs to shared viewport and accessibility coverage (v54.38, P948)

**Rule**: a route promoted to the primary navigation must be present in the shared desktop viewport, accessibility and lifecycle route inventories. User-visible copy must use product language, never raw internal artifact/service identifiers, and every persistent input must have an accessible name.

**Validation**: `scripts/ci-viewport-matrix-check.mjs`, the accessibility browser gate and the 20-route lifecycle/soak gates must include `principles`, `masters` and `atlas`.

## R501. Structured knowledge depth is not human certification (v54.38, P948)

**Rule**: Principles and Atlas may publish structured long-form reference drafts only with an explicit review boundary. Each connected learner target must expose durable bookmark/note state and an exact professional route bridge containing route, metric, timeframe and return context. Automated length, schema and browser checks cannot be described as independent semantic, source-directness or recruited-user certification.

**Validation**: the knowledge depth audit reports `completionReady:false`; route-bridge, Principles and Atlas browser contracts cover all primary targets and persisted learner state.

## R500. Knowledge routes load by route-owned capability and preserve interaction state (v54.38, P948)

**Rule**: heavy knowledge artifacts load only when their tab, search or selected module needs them. Requests belong to the active route scope through `AbortSignal`/liveness guards, independent capabilities settle without collapsing the whole page, and rerenders preserve the user's search value and focus.

**Validation**: `src/data/knowledge/load-capabilities.js`, `src/ui/pages/principles.js`, `src/ui/pages/atlas.js`, and their focused Chromium gates.

## R499. Regulatory universes require discovery, fair access, amendment composition and last-known-good preservation (v54.38, P948)

**Rule**: a 13F/13D/G universe cannot be called current from a hand-maintained subset. One scheduled producer must discover every configured filer, use a monitored SEC contact and serialized/retried request queue, separate submission recency from holdings periods, compose `13F-HR/A` according to its amendment type, preserve per-manager last-known-good rows on partial failure, and publish an explicit `BLOCKED` state when fair-access identity is unavailable. Schedule 13D/G events remain a separate beneficial-ownership layer and must never be merged into 13F positions or described as current trades.

**Validation**: `scripts/collect-13f-discovery.mjs`, `scripts/collect-13f-reference.mjs`, `scripts/lib/sec-edgar.mjs`, `scripts/ci-13f-currentness-check.mjs`, and the daily SEC job in `.github/workflows/refresh-data.yml`.

## R498. Screener factor rows cannot be created by fundamentals alone (v54.37, P945)

**Rule**: `public-data/screener.json.data` contains only symbols with a successfully derived price-factor row. FMP or SEC enrichment may add fields to an existing factor row but must never create a filing-only row. Publication gates derive their expected row and fundamental-coverage counts from the artifact contract instead of pinning an obsolete historical snapshot, while retaining the 80% minimum factor-coverage floor. Filing-only coverage remains in the dedicated SEC artifact.

**Validation**: `scripts/validate-screener-artifact.mjs`, `scripts/ci-screener-workbench-contract.mjs`, and `scripts/ci-data-pipeline-contract-check.mjs` must pass after a forced screener producer run.

## R497. Public AI chat is certified as a fresh-browser consumer outcome (v54.37, P944)

**Rule**: A public AI fallback is usable only when one canonical route contract connects `public-config.json`, boot defaults, readiness, deep health, the request target, Worker-advertised token limits, stream completion, and a non-empty user-visible answer in a browser with no stored key or override. Personal keys remain preferred when present. AnswerPlan validation must remove only unsupported claims or current numeric sentences; it must not erase independently safe qualitative content. Partial structured streams must conceal control JSON, and truncated structured output must recover safe prose with an explicit limitation instead of producing a blank response.

**Validation**: `scripts/ci-ai-chat-public-route-browser-check.mjs`, `scripts/ci-ai-chat-reliability-contract-check.mjs`, `scripts/ci-runtime-contract-check.mjs`, and `js/aio-tests.js` T990d~T990g must pass. `scripts/ci-live-invariant-check.mjs` must verify the deployed public config and Worker health contract before live certification.

## R496. Dated observations must be scoped to the selected knowledge node (v54.33)

**Rule**: Shared current-observation artifacts may target multiple pages, but a Principles, Atlas foundation, or Atlas relationship consumer must pass its selected node/related-node scope. Do not display unrelated market or company values as if they directly support every concept; when no direct observation exists, render an explicit reference-only empty state.

**Validation**: `src/ui/knowledge/current-observations.js`, `ci-knowledge-current-observations-check.mjs`, `ci-principles-browser-check.mjs`, and `ci-atlas-browser-check.mjs`.

## R495. Learner-first knowledge surfaces use declarative exploration, not quiz prompts (v54.33)

**Rule**: Principles, Atlas, and Masters may retain question-shaped fields in source artifacts for lineage and search, but user-facing pages must not render verification questions, quizzes, simulations, or forced answer prompts. Replace them with declarative reading order, connection paths, evidence scope, limits, and specialist-route guidance that lets users explore at their own pace.

**Validation**: `ci-principles-contract-check.mjs`, `ci-atlas-contract-check.mjs`, `ci-principles-browser-check.mjs`, `ci-atlas-browser-check.mjs`, and `ci-masters-browser-check.mjs`.

## R492. Official static release calendars must be date-advanced and source-verified (v54.23)

**Rule**: A desktop macro release registry may retain scheduled dates as reference data, but every `nextRelease` must be checked against the publisher's current official calendar before release. When a scheduled date passes, update `lastRelease`, advance `nextRelease`, and extend the official schedule list in the same change. Do not infer a release from elapsed time or synthesize dates from a generic cadence.

**Validation**: `ci-static-data-contract-check.mjs` and `ci-data-refresh-audit.mjs` must pass with no past `nextRelease`; the refresh record must cite the official BLS, BEA, ISM, Census, Federal Reserve, and Bank of Korea calendar sources used for the current registry.

## R493. SEC fallback concepts must be unioned before newest-observation selection (v54.24)

**Rule**: When a SEC fact field has multiple configured US-GAAP concepts, collect rows from every concept before deduplicating by period, filing date, accession, and form. Never let an older first concept shadow a newer fallback concept. Preserve explicit unavailable status when no comparable fact exists.

**Validation**: `fetch-sec-fundamentals.mjs` must pass a fixture containing an old first concept and a newer second concept; `ci-data-pipeline-contract-check.mjs` and the SEC artifact checks must verify newest-observation selection, filing lineage, coverage, and failure counts before screener publication.

## R491. Browser goldens and renderers are certified from the same committed tree (v54.22)

**Rule**: A browser golden must describe the implementation and generated inputs present in the release commit, not a newer unstaged overlay. If any direct renderer or artifact input is dirty, the focused gate must run in a detached clean checkout before push. The release may correct the golden to preserve committed behavior, or intentionally stage the implementation, but it may not mix the two states.

**Validation**: `ci-atlas-browser-check.mjs` requires the one educational question rendered by the committed F3 module; the unrelated local Atlas question-removal work remains unstaged, and the focused gate passes in a detached release checkout plus GitHub CI.

## R490. Asynchronous artifact tests wait on runtime-owned settled state (v54.22)

**Rule**: A browser test that asserts data loaded through an asynchronous boot pipeline must wait for that pipeline's explicit runtime state to leave `pending` before running semantic assertions. Fixed delays and unrelated synchronous API readiness are not evidence that the artifact loaded. Settled failure states remain testable failures; the barrier must not turn unavailable data into a pass.

**Validation**: `ci-headless-tests.mjs` requires both `_aioTelegramDigestMeta.status` and a non-pending `_serverDataMeta.artifacts.telegramDigest` before `AIO.runTests()`; T830 remains blocking and unskipped.

## R489. Playwright workflow steps inherit an explicit browser-install prerequisite (v54.22)

**Rule**: Every CI step that launches Playwright must run in a job that installs the matching browser executable first. Focused browser gates should reuse an existing blocking browser job when possible, and moving them must preserve their path into the deploy `needs` graph.

**Validation**: The market-epoch and quant auto-refresh Playwright gates run in `headless-tests` after `npx playwright install --with-deps chromium`; Pages deploy continues to require `headless-tests` success.

## R488. Scope gates validate their direct inputs from the committed tree (v54.22)

**Rule**: A product-scope declaration such as desktop-only is not complete while any committed gate dependency still requires a retired mobile fallback, persona, viewport, or acceptance path. When broader files contain unrelated work, stage only the exact scope correction, but include every direct input read by the blocking scope gate. A working-tree pass cannot substitute for a clean-commit pass.

**Validation**: `ci-desktop-scope-check.mjs` must pass in GitHub `validate`; the committed Principles contract must not require `principles-graph-mobile-list`, and the committed depth audit must not register `mobile-keyboard-screenreader`.

## R487. Selective releases validate R1 surfaces from the staged tree (v54.22)

**Rule**: When an R1/version surface contains unrelated unstaged work, a local working-tree pass is insufficient. The release must stage only the intended version hunk, then verify the index/commit representation of every required title, badge, APP_VERSION, version file, service worker, cachebuster, active audit contract, and active handoff manifest. Unrelated content must remain unstaged; omitting the required version hunk is equally invalid.

**Validation**: Inspect required version fields with `git show :path` (or a clean committed-tree checkout), run `ci-version-check.mjs` in the clean tree, and require the GitHub `validate` job to pass before deploy.

## R486. Initial paint and synthetic route latency require a browser presentation boundary (v54.22)

**Rule**: A boot performance gate that reports both first contentful paint and a synthetic page transition must allow the parsed application shell to reach an actual presentation frame before triggering the route. It must not charge route initialization to FCP or hide route cost inside a combined boot value. FCP, route latency, and maximum long-task thresholds remain independent blocking budgets; introducing the boundary cannot relax any threshold.

**Validation**: `ci-boot-interaction-check.mjs` uses a double-`requestAnimationFrame` boundary after DOMContentLoaded and before `showPage('signal')`, then enforces FCP <=2.5s, route <=2s, max long task <=2.5s, the expected active route, and boot-status release in real Chromium.

## R485. Keyless official downloads close critical single-series gaps without relabeling access (v54.22)

**Rule**: When a critical public indicator has an official, keyless, machine-readable download, the scheduled producer should use it as a bounded adapter instead of freezing the field solely because a broader API key is absent. The adapter must preserve the official series ID, exact unit, observation time, fetch/attempt time, URL, authority, allowed use, cache budget, and LKG failure state. It may override an older keyed/LKG observation only when its dated official observation is equal or newer.

**Validation**: `parseFredHyOasCsv` and `fetchFredHyOasPublic` are covered by invalid/missing/latest-row fixtures in `ci-data-pipeline-contract-check.mjs`; `ci-source-registry-contract-check.mjs` requires the public-download origin; `ci-data-refresh-audit.mjs` verifies the resulting HY OAS observation and publication-lag state.

## R484. Factor fixtures carry the same field-family observation epochs as production rows (v54.22)

**Rule**: A synthetic quant fixture that claims current market-cap or fundamental coverage must include the corresponding row-level `_mcapObservedAt` or `_fundamentalObservedAt`. Artifact coverage flags and API success flags cannot substitute for per-row observation epochs. Negative fixtures must express missing or stale epochs explicitly, and golden expectations must preserve the 4-day market-cap and 180-day fundamental eligibility boundaries.

**Validation**: `dump-factor-ranks-fixtures.mjs` emits explicit field-family epochs, while `ci-domain-parity-check.mjs`, `ci-esm-core-unit-check.mjs`, `ci-screener-workbench-contract.mjs`, and `ci-page-data-timeline-contract-check.mjs` verify active/inactive factors and fail-closed coverage.

## R483. Versioned domain-contract changes update every independent golden gate atomically (v54.22)

**Rule**: When a domain model version or response shape changes, all independent unit, pipeline, browser, and consumer golden assertions that intentionally pin that contract must be updated in the same change. The new assertion must verify the added semantics, not merely replace the version string. SEC report v3 therefore proves point-in-time status, observation counts, acceptance counts, and accepted filing metadata independently of the historical selector fixture.

**Validation**: `ci-esm-core-unit-check.mjs` asserts the report-level v3 contract; `ci-data-pipeline-contract-check.mjs` separately covers acceptance-time joins, amendments, as-of selection, and no current-price backfill.

## R482. Runtime-imported modules must enter the service-worker shell in the same change (v54.22)

**Rule**: Any JavaScript module imported by the deployed static application must be added to `sw.js` `SHELL_ASSETS` in the same change. A successful online import is not sufficient evidence because an old service-worker shell or offline transition can otherwise cache the importer without its new dependency. The shell entry must use the exact deployed relative path and remain covered by the architecture dependency scan.

**Validation**: `ci-architecture-contract-check.mjs` derives the required runtime module set and fails when any dependency, including `src/data/contracts/source-registry.js`, is absent from `SHELL_ASSETS`; version and release-revision gates keep the service-worker cache epoch synchronized.

## R481. Professional data capabilities are promoted only by artifact-backed partial scopes (v54.22)

**Rule**: A critical data gap may move from `BLOCKED` to `PARTIAL` only when its implemented scope, remaining limitation, allowed use, and executable validation gate are all declared. SEC point-in-time fundamentals must select only observations whose filing acceptance or filing date is on or before the requested cut; later amendments must not leak backward, and price ratios require a contemporaneous price supplied by the caller. Existing filing values may be migrated into a PIT envelope without changing the value, but absent acceptance timestamps remain `filed-date-only`. Implemented 13F and portfolio risk surfaces remain partial while insider forms, complete security mapping, survivorship-free histories, institutional factors, liquidity and capacity are absent.

**Validation**: `ci-professional-data-gap-check.mjs` verifies the eight-item ledger, five external `BLOCKED` boundaries, SEC PIT artifact coverage, amendment exclusion, verified 13F depth, and portfolio risk markers. `ci-data-pipeline-contract-check.mjs` independently exercises the SEC normalizer and as-of selector. CI, core refresh, screener refresh, and watchdog run the professional gap gate.

## R480. Every changing or hardcoded data category has a daily-audited source and limitation contract (v54.21)

**Rule**: Every one of the 22 reconciliation categories must declare its cadence, refresh mode, producer, generated artifacts, consuming desktop pages, exact origin URL, authority, source kind, access condition, and structural limitation/remediation in the machine-readable source registry. Static or hardcoded market-sensitive values do not escape this rule: they are audited daily and must either be refreshed from dated evidence or remain explicitly unavailable. Derived AIO-universe data must retain universe and coverage lineage and must not be relabeled as official exchange data. Null/missing observations never become numeric zero, and sparse calendar/session buckets cannot become current evidence. Professional capability gaps such as point-in-time fundamentals, historical membership/corporate actions, independent quote reconciliation, exchange breadth, estimates, options/short data, filings, and risk attribution remain in the critical-gap ledger until their production gates pass.

**Validation**: `ci-source-registry-contract-check.mjs` requires 22/22 registry/audit coverage, complete origin contracts, P0 fail-closed status, workflow enforcement, and breadth-history scope/coverage. Core, screener, and hourly watchdog workflows run that gate together with static-data and data-refresh audits. Reconciliation remains evidence-derived; `fetch-data.mjs` produces exact CNN F&G history, VIX3M, FRED five-point Treasury/T10Y2Y observations, CoinGecko crypto comparison, and date-aligned AIO breadth history while preserving source-specific observation time.

## R479. Quant rows and rankings preserve separate source epochs and rendered-symbol refresh demand (v54.20)

**Rule**: A quant row must not project one generic timestamp across live price, market cap, EOD technical/factor data, filing-derived fundamentals, identity, breadth/regime, and news. Every family retains its own observation/fetch/source/revision lineage. Ranking factors activate only when their actual per-row observation-age coverage reaches the declared threshold; artifact-level coverage or a successful fetch flag is insufficient. The visible desktop result batch must register bounded symbol demand with the central quote scheduler, and ranking input revision, screen snapshot, and displayed timeline must agree. Missing or stale required evidence fails closed; optional low-coverage fundamentals/news remain explicitly partial.

**Validation**: `validate-screener-artifact.mjs` enforces 2-day artifact and 4-day factor freshness plus 80% current factor coverage. `ci-screener-workbench-contract.mjs` verifies separate live/fundamental epochs. `ci-page-data-timeline-contract-check.mjs` requires six quant checks: snapshot, factor coverage, ranking epoch, visible quotes, fundamentals, and news. `ci-screener-auto-refresh-browser-check.mjs` proves 12/12 rendered-symbol quote demand, display binding, ranking revision parity, and stale-fundamental factor exclusion. `.github/workflows/refresh-screener.yml` runs the producer-safe pure gates after each six-hour build. Mobile remains excluded by R474.

## R478. Market-sensitive fields retain one machine-checkable timeline and direction basis (v54.19)

**Rule**: Every decision-relevant page field must preserve its value, source, `observedAt`, `fetchedAt`, revision, and change basis from producer through provider, normalizer, state, and renderer. A direction may be compared only when its basis is explicit and compatible. Required missing/basis-incompatible/mixed-revision fields fail closed; stale required fields cap the page at partial. Runtime execution time must never replace observation time. Long-lived visible tabs must periodically reevaluate active-page freshness and reuse the page refresh profile without refreshing hidden tabs.

**Validation**: `ci-page-data-timeline-contract-check.mjs` covers all 16 desktop market routes and 44 field requirements with stale, missing-direction, mixed-revision, and numeric-zero fixtures. `ci-page-market-epoch-browser-check.mjs` verifies runtime audit coverage and page DOM/API timeline parity. Mobile remains outside the product acceptance scope per R474.

## R477. Market-sensitive routes consume one evidence-derived market epoch (v54.18)

**Rule**: Reconciliation status must be computed from current source artifacts and executable category checks, never assigned from a static status table. Every market-sensitive route must consume the same market snapshot revision and completed market cut. A required `PARTIAL` category caps the route at delayed evidence, while a required runtime `BLOCKED` category makes the route unavailable. Licensed or operator-only categories remain separately policy-blocked and must not be synthesized.

**Validation**: `ci-reconciliation-contract-check.mjs` proves source-truth rebuild, empty-source degradation, null-is-missing behavior, and policy/runtime separation. `ci-data-pipeline-contract-check.mjs` enforces atomic workflow publication and browser polling/revision rejection. `ci-page-market-epoch-browser-check.mjs` traverses all market-sensitive desktop routes and rejects mixed revisions, mixed cuts, missing headers, or unexpected runtime errors.

## R474. AIO product QA and future UI work are desktop-only (v54.17)

**Rule**: Mobile and tablet implementation, visual polish, viewport coverage, personas, and acceptance criteria are out of scope because the product has no mobile users. Existing responsive/mobile DOM and CSS may remain as compatibility code, but new work must use `scripts/desktop-qa-config.mjs` and must not add mobile/tablet requirements unless the user explicitly reopens the scope.

**Validation**: `scripts/ci-desktop-scope-check.mjs` is a blocking CI gate. Supported QA viewports are 1280×900, 1440×1000, and 1920×1080. `ci-knowledge-route-bridge-contract.mjs` also rejects mobile/tablet/touch personas so generated learning-route scenarios cannot silently reintroduce mobile acceptance scope.

## R476. Retired mobile touch-target checks do not block desktop-only releases (v54.17)

**Rule**: The accessibility matrix continues to record small-target observations for audit visibility, but the former mobile 24px touch-target criterion is not a required release gate while the product scope is desktop-only. Desktop semantic names, keyboard reachability, focus paths, canvas naming, font floor, and console-error checks remain blocking.

**Validation**: `ci-accessibility-matrix-check.mjs` must report `smallTargetCount` without using it as the desktop release-failure predicate; `ci-desktop-scope-check.mjs` prevents mobile/tablet acceptance from returning.

## R475. Release versions use canonical major or two-digit patch notation (v54.17)

**Rule**: Version identifiers use `v<major>` for a major rollover and `v<major>.<patch>` with exactly two patch digits thereafter. `v53.99 → v54 → v54.01` is valid; `v54.1` is non-canonical and must normalize to `v54.01`. A bump must be strictly greater than the canonical version in `version.json`.

**Validation**: `node scripts/bump-version.mjs <version>` performs normalization and monotonic validation; `ci-version-check.mjs`, `ci-release-revision-check.mjs`, and `ci-operations-contract-check.mjs` reject non-canonical dotted versions and stale active metadata.

## R472. Browser lifecycle gates must stabilize known boot-delayed timers before leak comparison (v54.12)

**Rule**: A route resource-leak gate must wait for every known boot-delayed named timer that can register during its measurement window before taking the first lap snapshot. It must still fail on growth between two post-stabilization laps.

**Validation**: `ci-architecture-browser-check.mjs` must pass the two-lap route traversal with browser errors 0, stable canvas count and no timer registry growth.

## R473. New public-data artifacts require same-change lineage policy registration (v54.13)

**Rule**: Adding a tracked `public-data/*.json` artifact requires adding its explicit policy and timestamp selector to `ci-data-lineage-audit.mjs` in the same change. The artifact must retain source/producer/observed-time boundaries and must not borrow freshness from a sibling artifact.

**Validation**: `node scripts/ci-data-lineage-audit.mjs --json` must enumerate the artifact without `policy: unregistered`; missing registry entries remain a blocking failure.

## R471. Screener Workbench contracts must be the single lifecycle boundary (v54.12)

**Rule**: Screener identity, observations, field readiness, AST definitions, ScreenRun explanations, refresh demands, provider capabilities, regime states and outcomes must cross one versioned contract boundary. Unknown, stale, conflicting, unsupported or rights-blocked values remain non-promotable; research-relative ranking must not silently become predictive validity or automatic weight promotion.

**Validation**: `ci-screener-workbench-contract.mjs`, `validate-screener-artifact.mjs`, `ci-data-pipeline-contract-check.mjs`, `ci-runtime-contract-check.mjs` and the final live/browser gates must pass. `public-data/model-validation-status.json` and `public-data/screener-validation-gate.json` remain `BLOCKED` until PIT, turnover, cost, liquidity and live/backtest parity evidence exists.

## R470. Knowledge research artifacts must preserve completion and currentness boundaries (v54.7)

**Rule**: Coverage inventories, research dossiers, structural domain dossiers and quantitative labs may expose structure and educational calculation only. They must retain per-unit research status, source directness, `REFERENCE_ONLY`/`asOf` boundaries, confirmation/invalidation fields and user-validation state. Seed sources or generated drafts must not be promoted to researched articles, current market facts, live certification or recruited-user evidence.

**Validation**: `ci-knowledge-full-corpus-coverage.mjs`, `ci-knowledge-web-research-dossier.mjs`, `ci-knowledge-article-uniqueness.mjs`, `ci-knowledge-sector-domain-depth.mjs`, `ci-reference-curriculum-contract-check.mjs`, `ci-knowledge-market-transmission.mjs`, and `ci-knowledge-currentness-separation.mjs` must pass with `completionReady: false` until the human/source/browser/live gates are actually closed.

## R464. Knowledge concepts require one canonical namespace and explicit overlap equivalence (v54.6)

**Rule**: Principles and Atlas concepts must be published through the canonical knowledge manifest. Legacy IDs may resolve only through explicit aliases; cross-surface overlap is an equivalence group, never an accidental duplicate.

**Validation**: `ci-knowledge-ontology-contract.mjs` must pass with the generated manifest and zero registry errors.

## R465. Knowledge graph edge metadata must be explicit before runtime consumption (v54.6)

**Rule**: A knowledge edge may not silently acquire type, direction, condition, or source metadata from a generic default. Runtime graph inspection must report zero inferred edges for the release surface.

**Validation**: `ci-knowledge-core-semantic-check.mjs` and the generated edge-semantics contract must pass.

## R466. Evidence directness is a claim-level boundary (v54.6)

**Rule**: CONTEXT, DISCOVERY, STRUCTURAL, and REVIEW_REQUIRED evidence cannot be treated as DIRECT support. Every claim source reference must resolve, and source conflicts must fail the registry build.

**Validation**: `build-knowledge-evidence-registry.mjs` plus `ci-knowledge-core-semantic-check.mjs` must report zero unresolved references and conflicts.

## R467. Structured article drafts cannot be published as completed learning content (v54.6)

**Rule**: Generated article scaffolds must remain `STRUCTURED_REFERENCE_DRAFT` and `EDUCATIONAL_REFERENCE_ONLY` until semantic review, primary-source directness review, retrieval testing, and user validation are recorded.

**Validation**: `ci-knowledge-article-contract.mjs` enforces the draft boundary and required semantic fields.

## R468. Knowledge route state and partial capability loading must fail soft (v54.6)

**Rule**: Shareable route state must round-trip without destructive navigation, local learning state must be namespaced and recoverable, and a missing knowledge capability must degrade to fallback without erasing connected capabilities.

**Validation**: route-state, learning-state, route-bridge, repository, and renderer contract scripts must pass together.

## R469. 주식·경제·금융·기술 백과사전은 전체 corpus와 Web Research를 별도 인증한다 (v54.6, P910)

**Rule**: ontology·schema·structured draft·renderer가 존재해도 백과사전 콘텐츠 완료로 판정하지 않는다. 기존 KA-00~10을 순차 완료한 뒤 KA-11~16에서 111 Principles lessons, 48 Atlas foundations, 60 concept guides, 95 taxonomy nodes, 50 deep branches, 19 domains와 모든 세부 sector/domain/category를 전수 coverage한다. 각 content unit은 독립 Web Research dossier와 profile별 공식·학술·표준·공시 근거, 고유한 설명·예제·반례, 실물경제→산업/기술→기업/제품→재무→밸류에이션→시장/주가→트레이딩 관찰·무효화 경로를 가지거나, 그 정보를 잃지 않는 명시적 canonical 합성 경로를 가져야 한다. 검색 snippet·discovery-only·broad source 반복·template 문장·글자 수만으로 통과시키지 않는다.

**Validation**: `_context/MARKET-PRINCIPLES-ATLAS-STRUCTURAL-AUDIT-HANDOFF-2026-08-10.md` §14~16, `_context/MARKET-PRINCIPLES-ATLAS-AUDIT-CONTRACT-2026-08-10.json`의 KA-11~16·fullCorpusCoverage·webResearchContract, 후속 `full-corpus-coverage`, `web-research-dossier`, `source-profile`, `article-uniqueness`, `quantitative-example`, `market-transmission`, `sector-domain-depth`, `currentness-separation` gates.

## R419. 릴리스 아키텍처 매니페스트는 R1 버전과 함께 동기화해야 한다 (v53.64, P864)

**Rule**: `version.json`, `sw.js`, `architecture/asset-manifest.json`, `architecture/release-manifest.json`, `architecture/visual-state-matrix.json`, `architecture/operations-slo.json`, and `architecture/public-readiness.json` must advertise one application revision; worker revision fields must match `sw.js`. A version bump is not stageable while any release SSOT still points to the prior revision.

**Validation**: `ci-architecture-contract.mjs`, `ci-operations-contract-check.mjs`, and `ci-release-manifest-contract.mjs` must all pass after every bump.

## R420. 공식 일정의 완료 이벤트는 nextRelease로 남기지 않는다 (v53.64, P865)

**Rule**: A calendar registry must promote the next official future release after an event boundary, retaining the completed date only as `lastRelease`. Fixed dates may be used only when backed by the official schedule; no inferred cadence may replace a missing official date.

**Validation**: Headless T759 checks valid non-past NFP/CPI/FOMC/PCE dates, and the calendar registry's official schedule arrays provide the rollover source.

## R421. 데이터 refresh 이후 릴리스 SSOT를 같은 revision tuple로 승격한다 (v53.64, P866)

**Rule**: A public-data refresh that changes `market-snapshot.revision` must also update the asset/release manifest `dataRevision` before the next deploy. App, data, evidence, and worker revisions are one tuple; a mixed tuple is not releasable.

**Validation**: `ci-operations-contract-check.mjs` must pass against the current `public-data/market-snapshot.json`, operations status, asset manifest, and release manifest.

## R422. LKG 값은 개인 공급자 재시도나 최신 성공시각으로 간주하지 않는다 (v53.65, P867)

**Rule**: 서버 아티팩트의 last-known-good 매크로 값은 원 관측일과 원 출처를 유지해야 하며, 현재 FRED 수신 성공으로 카운트하거나 `macro_fred`의 현재시각을 찍어서는 안 된다. 서버 FRED가 실패했고 브라우저에 개인 키가 저장돼 있으면 LKG 값의 존재와 무관하게 개인 경로를 시도한다. 저장 상태, 인증 상태, 연결 상태는 서로 다른 필드로 표시한다.

**Validation**: `ci-data-pipeline-contract-check.mjs`는 서버 공통컷 메타데이터 보존, `!fredFetchOk` 개인 브리지, FRED 인증/연결 상태와 콜드 로딩의 제한 재적용 경로를 검사한다. 매크로 UI는 관측일과 수집시각을 별도로 유지한다.

## R423. 일별 시계열에는 완료된 시장 세션 값만 저장한다 (v53.65, P868)

**Rule**: 같은 날짜 행에 미국 전일 종가와 한국/원자재/가상자산 장중값을 섞어 일별 종가처럼 저장하지 않는다. `CURRENT_SESSION` 또는 `DELAYED_IN_SESSION` 값은 라이브 스냅샷에서만 사용하고, 일별 차트 행에는 해당 시장의 직전 완료 종가와 원 관측일, 원 세션, 값 기준을 기록한다.

**Validation**: `ci-history-field-time-contract-check.mjs`는 381일 전 구간의 날짜 단조성·값 범위·필드 증거를 검사하고, 최신 13개 시계열 필드를 시장 스냅샷의 완료값과 직접 대조한다. Yahoo 일봉 timestamp는 봉 시작시각이므로 직전 완료 종가의 관측 경계는 현재 봉 시작시각으로 기록한다.

## R424. 모든 라우트의 현재시장 문맥은 하나의 서버 24시간 컷을 사용한다 (v53.65, P869)

**Rule**: 페이지별 브라우저 시계로 독립적인 “오늘/최근” 구간을 만들지 않는다. 17개 라우트는 `_serverDataMeta.newsCycleStart/newsCycleEnd/marketSnapshotRevision`을 공통 시장 문맥으로 사용하고, 라이브 오버레이는 세션·지연 라벨을 유지한다. 공식 발표가 완료되면 일정만 넘기지 말고 공식 1차 소스의 최신 관측값도 별도 어댑터로 갱신한다.

**Validation**: 모든 decision header가 동일한 `data-market-cut-*`을 노출하고, 페이지 계약은 `independent-page-cycle`과 `in-session-value-as-daily-close`를 금지한다. BEA PCE 파서 fixture와 22개 데이터 감사가 최신 발표·관측·다음 일정을 확인한다.

## R356. Yahoo chart proxy는 공통 health registry를 통해서만 실행해야 한다 (v53.19, P784)

**Rule**: Yahoo chart proxy attempts must use `_PROXY_REGISTRY` through `fetchViaProxy`; direct proxy arrays in chart-specific callers are prohibited. Invalid chart payloads count as proxy failures, three consecutive failures open cooldown, and a later valid response clears the proxy health state. This packet does not change price-validation bands or add a new public proxy.

**Validation**: `ci-runtime-contract-check.mjs` blocks direct chart proxy fanout and missing invalid-payload accounting. Headless `T1041` proves three-failure cooldown, scheduled recovery, and later success score restoration; the SA-02 outage fixture proves snapshot-backed degraded operation remains reference-only.

## R357. Native bounded technical surfaces must have one pure model and an explicit legacy writer fence (v53.20, P785)

**Rule**: A technical route may transfer a primary health surface only when its formula is owned by one pure domain model, normalized state carries that model output, the native renderer owns the declared sinks, and every compatibility initializer that can reach those sinks explicitly skips them while the native marker is active. Secondary chart/indicator/stage/narrative surfaces must remain separately declared until their own writer packet is complete.

**Validation**: `ci-esm-core-unit-check.mjs` covers missing-input fail-closed and bullish/defensive threshold fixtures; `ci-architecture-contract-check.mjs` requires `market-health.v1`, native technical renderer markers, and both compatibility fences; `ci-architecture-browser-check.mjs` requires technical primary sink `11/11`, native marker parity, and the `NATIVE-FENCE` last-writer regression assertion.

## R358. Signal primary text must derive from one Trading Score model and fence the legacy dashboard writer (v53.21, P786)

**Rule**: The signal score/decision hero may be transferred only when its user-facing wording is an explicit presentation model layered on the canonical `trading-score.v1` result, with machine action (`WATCH`/`WAIT`/`REDUCE`) kept separate. A native signal renderer must own the declared score/decision sinks and `refreshSignalDashboard()` must skip them behind the native marker; canvas, factor bars, execution-window, risk-monitor, timestamp, narrative, and home summary remain separate boundaries until independently cut over.

**Validation**: `ci-esm-core-unit-check.mjs` covers full/partial/missing score presentation; `ci-architecture-contract-check.mjs` requires `signal-presentation.v1`, native signal markers, and the legacy fence; `ci-architecture-browser-check.mjs` requires signal primary sink `3/3` and direct `NATIVE-FENCE` protection.

## R359. Home aggregate primary text must reuse signal presentation and fence legacy summary writers (v53.22, P787)

**Rule**: The home aggregate may transfer only the declared score/decision summary sinks. It must consume `signal-presentation.v1` from normalized analysis state rather than recomputing score thresholds or wording. Quality meter, Fear & Greed, regime, factor detail, chart, and narrative remain separate legacy boundaries until independently reconciled. Every legacy home summary writer must skip the four native sinks while `data-aio-home-renderer="native"` is active.

**Validation**: `ci-architecture-contract-check.mjs` requires the home renderer/fence markers and the derived route-owner count; `ci-architecture-browser-check.mjs` requires home native sink `4/4`, route marker parity, and direct `NATIVE-FENCE` protection.

## R360. Derived theme-detail summary must use an explicit event/child boundary (v53.23, P788)

**Rule**: A derived inline panel may add a native summary only when the selection enters through an explicit `aio:themeDetailShown` boundary, the native module owns a dedicated child surface, and the legacy body writes to a separate child container. Do not classify the full `theme-detail` panel as native until composition, chart/data, and narrative writers are independently reconciled.

**Validation**: `ci-architecture-contract-check.mjs` must keep native/legacy writer intersections empty; `ci-architecture-browser-check.mjs` requires `#theme-detail-native-summary` visible with `#theme-detail-legacy-content` populated and the full 17-route resource round trip stable.

## R361. Theme-detail composition/breadth must use normalized quote evidence and a fenced legacy writer (v53.24, P789)

**Rule**: A derived theme-detail composition packet may move subtheme composition, constituent chips, and breadth only into a dedicated native child fed by the explicit selection event and normalized quote evidence. Missing price coverage must remain `시세 대기`; the legacy writer must stop emitting the transferred subtheme/breadth DOM before the native boundary is recorded. Detailed leader cards and deep-analysis narrative remain separate legacy boundaries until independently reconciled.

**Validation**: `ci-architecture-contract-check.mjs` requires `renderThemeDetailComposition`, the native composition child, normalized quote/breadth fixtures, and the legacy composition fence; `ci-architecture-browser-check.mjs` requires the native summary/composition children visible with the legacy body populated and the 17-route resource round trip stable.

## R362. Theme-detail leader cards must have one native writer and fail-closed quote display (v53.25, P790)

**Rule**: Detailed theme leaders may move to native ownership only through a dedicated child fed by the normalized selection quote payload. Price and change must remain explicitly unavailable when evidence is missing; the legacy leader-card DOM writer must be fenced before the boundary is recorded. Deep-analysis narrative and chart/data surfaces remain separate until their own ownership packets are complete.

**Validation**: `ci-architecture-contract-check.mjs` requires `renderThemeDetailLeaders`, the native leader child, and the P790 legacy fence; `ci-architecture-browser-check.mjs` requires at least one native leader card alongside visible summary/composition children, populated legacy body, and stable 17-route resource counts.

## R363. Theme-detail temperature narrative must derive from canonical performance and fence the legacy section (v53.26, P791)

**Rule**: The theme-temperature diagnosis may move to native only when it derives directly from the normalized selected-theme performance, uses an explicit child, and displays `시세 대기` when performance is unavailable. The corresponding legacy deep-analysis section must be removed/fenced; spread, breadth-health, benchmark, and other narrative sections remain separate boundaries.

**Validation**: `ci-architecture-contract-check.mjs` requires `renderThemeDetailTemperature`, the native temperature child, and the P791 legacy fence; `ci-architecture-browser-check.mjs` requires visible summary/composition/leaders/temperature children, populated legacy body, fail-closed temperature text, and stable 17-route resources.

## R364. Theme-detail performance spread must rank only observed quote changes (v53.27, P792)

**Rule**: The leader performance-spread narrative may move to native only when it uses the normalized quote payload, requires at least two observed constituent changes, and keeps missing values fail-closed. The legacy spread section must be fenced; breadth-health, subtheme gap, benchmark, and remaining narrative remain separate boundaries.

**Validation**: `ci-architecture-contract-check.mjs` requires `renderThemeDetailSpread`, the native spread child, and the P792 legacy fence; `ci-architecture-browser-check.mjs` requires visible summary/composition/leaders/temperature/spread children, explicit insufficient-quote text, populated legacy body, and stable 17-route resources.

## R365. Theme-detail breadth-health narrative must use normalized breadth and fence the legacy section (v53.28, P793)

**Rule**: The theme-detail breadth-health narrative must be rendered by the native child `#theme-detail-native-breadth-health` from normalized `detail.breadth`. Missing quote coverage must fail closed to `시세 대기`; the legacy breadth-health section must be fenced, while subtheme gap, benchmark comparison, and remaining deep narrative stay separately bounded.

**Validation**: `ci-architecture-contract-check.mjs` requires `renderThemeDetailBreadthHealth`, the native breadth-health child, and the P793 legacy fence; `ci-architecture-browser-check.mjs` requires visible summary/composition/leaders/temperature/spread/breadth-health children, explicit insufficient-quote text, populated legacy body, and stable 17-route resources.

## R366. Theme-detail subtheme-gap narrative must use normalized subtheme quote evidence and fence the legacy section (v53.29, P794)

**Rule**: The theme-detail subtheme-gap narrative must be rendered by the native child `#theme-detail-native-subtheme-gap` from normalized `detail.subThemes` and quote evidence. Fewer than two observed subtheme performances must fail closed to `시세 대기`; the legacy subtheme-gap section must be fenced, while benchmark comparison and remaining deep narrative stay separately bounded.

**Validation**: `ci-architecture-contract-check.mjs` requires `renderThemeDetailSubthemeGap`, the native subtheme-gap child, and the P794 legacy fence; `ci-architecture-browser-check.mjs` requires visible summary/composition/leaders/temperature/spread/breadth-health/subtheme-gap children, explicit insufficient-quote text, populated legacy body, and stable 17-route resources.

## R368. Home Quality must not reuse Trading Score and must fail closed without canonical inputs (v53.34, P821)

**Rule**: If the five-input Quality model is not present in canonical state, do not fill the Quality card with an inferred or reused score. Native analysis owns the complete card and displays `— / 판정 보류`; the legacy Trading Score-as-Quality writer stays removed.

**Validation**: `ci-architecture-contract-check.mjs` blocks the legacy quality writer and `ci-architecture-browser-check.mjs` requires the native marker plus a non-empty fail-closed state.

## R369. Technical candle text and legacy canvas lifecycle must remain separate (v53.34, P822)

**Rule**: Technical candle title/meta text comes only from normalized analysis input and stays waiting when OHLCV is absent. Legacy chart code retains canvas/indicator lifecycle but must not write the same text sinks.

**Validation**: the architecture contract checks legacy writer deletion and native markers; Chromium checks native title/meta state and the stable 17-route resource round trip.

## R370. Theme-detail comparison formatters must reject non-finite quote percentages (v53.35, P823)

**Rule**: Any legacy or native theme-detail comparison that ranks or formats constituent quote percentages must first normalize and filter finite numeric values. Sentinel extrema must not reach `toFixed()` or user-visible output.

**Validation**: `ci-runtime-contract-check.mjs` requires the finite percentage guard, explicit finite extrema, and safe formatting for the theme-detail deep-analysis comparison.

## R371. Shared currentness sanitizers must not rewrite native renderer-owned narrative sinks (v53.36, P824)

**Rule**: Cross-cutting stale/loading text normalization may annotate legacy or unowned narrative sinks, but must leave elements marked with a native renderer ownership marker untouched. Native route renderers remain the sole writer of their owned text.

**Validation**: `ci-headless-tests.mjs`, `ci-architecture-browser-check.mjs`, and route ownership contracts must preserve native fail-closed text after currentness normalization.

## R372. Dynamic detail panels must keep aria-live announcements intentionally scarce (v53.37, P825)

**Rule**: A multi-panel native detail surface must expose at most one coordinated `aria-live` summary unless each additional region represents an independent user action. Sibling panels rendered in one update must not create screen-reader announcement storms.

**Validation**: `ci-ux-default-path-check.mjs` enforces the global live-region ceiling; `ci-accessibility-matrix-check.mjs` verifies all 17 routes with zero console errors.

## R373. Derived routes must replay through their canonical mount in compatibility navigation (v53.38, P826)

**Rule**: When a legacy navigation call canonicalizes a derived view such as `theme-detail` to an inline owner page such as `themes`, the architecture compatibility facade must replay the canonical route. Replaying the raw derived route after the legacy call can dispose the native owner mount and hide the derived surface.

**Validation**: `ci-viewport-matrix-check.mjs` with `AIO_VIEWPORT_FULL_INIT=1` must settle `theme-detail` with its canonical `themes` panel visible across all viewports; architecture browser coverage must retain the native theme-detail surfaces and zero browser errors.

## R374. Portfolio summary cutovers must transfer the pure model and fence every legacy writer (v53.40, P831)

**Rule**: A portfolio summary/allocation/exposure surface may move to native ownership only when one finite-safe domain model derives its values from normalized Vault state plus explicitly labelled quote evidence. Missing value, change, cash, VIX, or sector evidence must remain unavailable rather than become zero. Every inline summary or sector writer that can reach a transferred id must consult the native surface marker; risk cards, history charts, AI workbench, and narrative remain separate boundaries until their own input and writer packets are complete.

**Validation**: `ci-architecture-contract-check.mjs` requires `portfolio-surface.v1`, native summary markers, and legacy fences; `ci-architecture-browser-check.mjs` requires the portfolio surface/model markers and native count/sector/exposure markers; unit fixtures must cover empty, cash-only, missing-quote, and finite live-quote cases.

## R375. Official SEC report surfaces must use one finite-safe projection and keep mixed-source sections separate (v53.41, P832)

**Rule**: A fundamental route may present an official SEC report only through one pure projection that preserves filing identity, period/submission dates, coverage, source kind, and finite observed values. Missing facts remain unavailable; they must not be inferred from FMP/Yahoo/news data. Peer comparison, external news, charts, and AI narrative remain separately labelled boundaries until their own evidence and writers are reconciled.

**Validation**: `ci-architecture-contract-check.mjs` requires `sec-report.v2` and native report markers; `ci-architecture-browser-check.mjs` requires the native report/model/metadata markers and zero browser errors; fixtures cover empty, partial, complete, and stale SEC records.

## R367. Theme-detail benchmark narrative must use normalized theme/benchmark evidence and fence the legacy section (v53.30, P795)

**Rule**: The theme-detail benchmark narrative must be rendered by the native child `#theme-detail-native-benchmark` from normalized theme performance and the selected ETF/composite-base quote evidence. Missing either side must fail closed to `시세 대기`; the legacy benchmark section must be fenced, while theme insights, chart, and data ownership stay separately bounded.

**Validation**: `ci-architecture-contract-check.mjs` requires `renderThemeDetailBenchmark`, the native benchmark child, and the P795 legacy fence; `ci-architecture-browser-check.mjs` requires visible summary/composition/leaders/temperature/spread/breadth-health/subtheme-gap/benchmark children, explicit insufficient-quote text, populated legacy body, and stable 17-route resources.

## R355. Durable snapshot은 reference readiness이며 client live enrichment의 outage gate다 (v53.18, P783)

**Rule**: published same-origin market snapshot은 부팅 시 먼저 적용하고 `sourceKind=REFERENCE`, 관측시각, `fb-static`을 유지한다. `_liveData`에 투영돼도 `live:` provenance가 아니면 실시간 개수·현재 시각 배지로 세지 않는다. snapshot이 가용한 상태에서 public proxy가 연속 실패하면 동일 transport의 Stooq/Yahoo rescue fanout을 중단하고, 재시도는 중앙 refresh scheduler 하나만 소유한다. 서버 FRED/HY artifact가 freshness/성공 gate를 통과하면 브라우저 fallback을 중복 호출하지 않는다.

**Validation**: runtime contract는 snapshot event metadata, reference topbar, proxy circuit, 내부 self-retry 부재, architecture-ready 대기, 서버 macro/HY 중복 억제를 blocking한다. 브라우저 QA는 외부망 차단 상태에서 기준 시세 표시와 `fb-static`을 확인한다.

## R354. 서비스워커 버전 표시는 현재 controller 전환을 따라야 한다 (v53.18, P782)

**Rule**: SW 설치/대기 버전을 활성 controller로 오인하지 않는다. `controllerchange`마다 `GET_VERSION`을 다시 실행하고 mismatch 진단을 재평가한다. SW 등록은 script cache를 우회해 update를 확인하되 자동 reload loop를 만들지 않는다.

**Validation**: runtime contract는 `controllerchange`, active-version requery, `updateViaCache:'none'`, explicit update check를 요구한다.

## R353. route ownership 요약은 route별 선언에서 재계산한다 (v53.18, P781)

**Rule**: `architecture/route-owners.json`의 counts/native/legacy/full-native 요약을 독립 사실로 수동 관리하지 않는다. route 17개의 5차원 owner 선언에서 재계산한 값·순서와 하나라도 다르면 migration 진척을 인정하지 않는다.

**Validation**: `ci-architecture-contract-check.mjs`가 lifecycle/renderer/data/chart/narrative와 full-native 목록의 누락·추가·순서 드리프트를 blocking한다.

## R352. Architecture migration must transfer an executable owner and monotonically retire legacy coupling (v53.15, P736)

**Rule**: 새 `src/` 모듈·CI 스크립트·manifest를 추가한 것만으로 route 재구축을 완료 처리하지 않는다. 각 migration batch는 lifecycle·renderer·data·chart·narrative 소유권을 분리해 기록하고, 수정 전 `DELETE-LEDGER`에 declaration/caller/global/DOM/event/storage/test를 적은 뒤 최소 한 개의 대응 legacy wrapper/hook/writer를 같은 변경에서 제거해야 한다. Store가 dispatch한 route command는 reducer가 실제 소비해야 하며, release manifest의 app revision은 `version.json`과 정확히 같아야 한다.

**Validation**: `ci-architecture-contract-check.mjs`는 선언된 burn-down 상한과 퇴역 패턴 부재, release revision parity, 전체 실행 원장의 계층·route·세션 카드·최종 인수 구조를 blocking한다. `ci-architecture-browser-check.mjs`는 router와 store의 route가 모두 `sentiment`인지, ESM owner가 fail-closed 배지를 렌더하는지 검증한다. `operations-status.json`은 native lifecycle owner와 native renderer owner를 별도로 공개하며 renderer 전환 전에는 native route로 계산하지 않는다.

**P738 reinforcement**: Runtime contract checks must accept the current native ESM owner and its compatibility boundary when a route is cut over; retired legacy declaration/call-site markers must not remain deploy blockers. The same gate must still assert the native fail-closed state and source-specific freshness behavior.

**P739 reinforcement**: Native route cutovers must keep hidden compatibility sinks synchronized, allow explicit live/provider patches to override snapshot evidence, register the native route in shared narrative refresh boundaries, and make every derived-route redirect consume its semantic pending selection before the route-settle gate runs.

**P759 reinforcement**: Domain extraction must remove the executable legacy formula in the same batch; a pure module plus a parity fixture is not enough. The compatibility wrapper may retain only explicit input resolution and legacy projection, and the new domain module must be registered in bootstrap, facade, and service-worker assets before the batch is marked `VERIFIED_LOCAL`.

**P760 reinforcement**: A native route cutover is incomplete while a legacy DOM writer or retired action helper remains in the aggregate. Transfer renderer/state ownership, delete the competing writer/call sites, update route ownership and retirement ledgers, then rerun browser and headless gates. Compatibility storage/data projections may remain only when their non-route consumers are documented.

**P763/P764 reinforcement**: Compatibility wrappers may resolve storage, profile, identity, and memo inputs, but deterministic model math must live in one pure domain owner. Non-route consumers must read canonical native state through an explicit boundary; legacy projections may remain only as documented enrichment or pipeline SSOT until their consumers are migrated.

**P765 reinforcement**: Native renderer counts must be re-derived from route ownership before accepting a cutover. Once a route is counted native, AG-DOM-WRITER must include deferred compatibility callbacks and their call sites; removing a visible table/action writer is insufficient if a legacy readiness/status writer still targets the same node.

**P768 reinforcement**: When a native provider/orchestrator becomes the runtime owner of an artifact, legacy loaders must not fetch the same artifact or bulk-project its rows into a compatibility DB. Keep only an explicit metadata/breadth bridge plus documented identity/memo overlays, and enforce the single-fetch boundary with a source-level contract and browser/headless verification.

**P769 reinforcement**: A route renderer cutover must remove every legacy writer for its primary container, including loading/error/count/progressive paths. Filter and translation handlers may remain only as explicit input or invalidation compatibility boundaries, and the native marker must be asserted by the browser gate before the next route cutover begins.

**P770 reinforcement**: A complex content route may retain secondary narrative/AI compatibility producers only when the primary feed container, count, timestamp, loading/error, and reveal controls have one native owner. Legacy AI generation may dispatch invalidation or publish an adapter result, but it must not write the primary container directly.

**P771 reinforcement**: A bounded native metric surface must fence every legacy global writer that can reach the same native route subtree. For macro, the native module owns primary live quote and FRED snapshot sinks; legacy quote/snapshot/FRED/BOK/KOSIS passes may continue serving secondary compatibility surfaces only when they explicitly skip `#page-macro[data-aio-architecture-renderer="native"]`. Curve/chart/event-freshness/narrative ids must remain listed as legacy secondary boundaries until their own writer packet is complete.

**P772 reinforcement**: The same bounded-surface rule applies when a shared market module owns a second route. For fxbond, `market.js` owns every primary `[data-live-price]`, `[data-live-chg]`, and `[data-snap="move"]` sink; legacy global quote/snapshot passes must skip `#page-fxbond[data-aio-architecture-renderer="native"]`. Risk pills, spread/carry narrative, and trend/yield-curve charts remain secondary legacy boundaries until their own writer packet is complete.

**P773 reinforcement**: For breadth, `market.js` owns the current timestamped screener-artifact 5/20/50SMA cards, their bar/freshness readouts, and the canonical advance-ratio sink. Prefer `AIO_ARCH.getScreenerState().metadata.breadth.segments.us`; use `AIO.getCurrentBreadthEvidence()` only as a compatibility fallback. Legacy snapshot/init/bar/advance writers must skip `#page-breadth[data-aio-architecture-renderer="native"]` primary elements. Do not promote absent multi-day breadth history, McClellan/RSP-SPY narrative, or historical charts into the native primary owner without a separate evidence and writer packet.

**P774 reinforcement**: Completing a native content cutover also requires retiring declaration-only legacy functions and only-dependent helpers left after caller/writer removal. Update structural and browser/headless contracts in the same packet so a retired native owner is asserted as absent rather than preserved as a false compatibility requirement.

**P775 reinforcement**: A bounded themes cutover may claim only the RRG quadrant cards and rotation-read surface backed by normalized theme state. Keep the RRG chart/canvas status and `theme-detail` as explicit secondary legacy boundaries until their own writer/data packets are complete; never promote static seed values or unavailable relative-strength data into the native primary owner.

**P776 reinforcement**: A canonical redirect or derived inline view must be measured at runtime before assigning it a route owner. Retire an unreachable declaration only after a repository-wide caller search, and record the live inline writer as the remaining boundary; add a dedicated retirement assertion so the dead declaration cannot return.

**P777 reinforcement**: Stable DOM IDs are part of a native route contract. Shared accessibility or normalization passes must preserve explicit IDs used by native primary sinks and generate fallback label IDs only when no explicit ID exists; browser/AG-DOM-WRITER checks must cover the resulting sink identity and values.

**P778 reinforcement**: A bounded native replacement-metric surface must declare its source/provenance fields in the normalized state and fence every shared quote/snapshot/PCR writer that can reach the same subtree. A page explicitly lacking an options-chain provider may transfer only current VIX/PCR/SKEW reference metrics; no legacy chain/chart/narrative scaffolding may be implied by the native marker.

**P779 reinforcement**: A fundamental route may transfer only an independently owned SEC availability/source badge when the normalized artifact has explicit coverage/provenance. The full report must remain legacy-owned while SEC coverage and SEC/FMP/Yahoo/Finnhub asynchronous writers are unresolved; the native marker must not imply that the report, charts, or AI narrative have been cut over.

**P780 reinforcement**: A portfolio route may transfer an independently owned readiness/status sink from the native slice without claiming Vault/CRUD/table/risk/chart ownership. Contested holdings and totals writers must remain legacy until consent, mutation, and storage boundaries are reconciled; the status sink must fail closed and expose its operational-use lineage.

## R351. History bucket dates must not replace field-level observation provenance (v53.14, P735)

**Rule**: `history.json`의 행 `date`는 기존 차트 호환용 calendar bucket일 뿐, 각 값의 관측시각이 아니다. 숫자 입력은 `fieldMeta[field]`에 `observedAt`, `fetchedAt`, `lastSuccessfulAt`, `source`, `sourceKind`, `allowedUse`를 보유해야 하며 휴장일 carry-forward는 이전 관측값·`reference-only`·관계 상태를 명시한다. FRED/AI/HY OAS 공급 실패는 LKG 값 삭제·새 관측 승격·raw AI 발행으로 이어지면 안 된다.

**Validation**: `ci-history-field-time-contract-check.mjs`는 모든 numeric history field의 field-level evidence와 NFP 10배 fixture를 검증한다. `fetch-data.mjs`의 FRED LKG merge, `js/aio-data.js`의 durable HY OAS projection, `marketAnalysisSemanticOk` fail-closed 상태를 함께 확인한다.

## R350. Protected portfolio reloads and RSS backstops must fail closed at the visible boundary (v53.13, P734)

**Rule**: An encrypted portfolio must render its lock screen after a hard reload before any sensitive data surface is shown. News RSS retries may broaden only the provider query window; every item must still pass the canonical completed 08:00 KST cycle filter, and stale headlines must not be promoted as current.

**Validation**: `ci-portfolio-vault-e2e.mjs` must pass `reload_requires_unlock`; `ci-data-pipeline-contract-check.mjs` must assert RSS retry/backstop wiring and canonical cycle filtering.

## R349. Workflow module heredocs require an ESM runtime-import contract (v53.12, P733)

**Rule**: A workflow heredoc run with `node --input-type=module -` must use ESM imports throughout; do not leave `require()` in module-mode code.

**Validation**: `ci-data-pipeline-contract-check.mjs` rejects `require()` in module heredocs and checks the refresh summary's `node:fs` import.

## R348. Workflow heredocs must declare the same Node module mode that their source syntax requires (v53.11, P732)

**Rule**: A workflow heredoc containing `import` or top-level `await` is an ESM program. The command must use `node --input-type=module -`, and the CI syntax checker must parse it with the same mode. A CommonJS `new Function` check is not sufficient evidence for an ESM heredoc.

**Validation**: `ci-data-pipeline-contract-check.mjs` and `ci-control-char-check.mjs` must parse refresh/watchdog workflow heredocs.

## R347. Durable and fast data planes must expose independent revisions and fail closed until operator SLO evidence exists (v53.11, AR-07)

**Rule**: A GitHub Actions durable artifact is not proof that an independent fast plane, provider rights, or a 7-day freshness SLO exists. Canonical snapshots must retain the last known good revision on failed attempts, while Worker/Cron/KV/R2 health, provider rights, coverage, reconciliation, and soak status remain explicit `CURRENT`, `PARTIAL`, `BLOCKED`, or `OPERATOR_REQUIRED` states.

**Required**: Keep `market-snapshot.json`, `market-snapshot-status.json`, `operations-status.json`, and `reconciliation-status.json` revisioned and validated. Never overwrite a last-known-good snapshot with an incomplete publish, never promote a WebSearch inference to an exact current numeric value, and never report `VERIFIED_LIVE` without external scheduler/resource and soak evidence.

**Validation**: `ci-market-snapshot-contract-check.mjs`, `ci-data-plane-contract-check.mjs`, `ci-operations-status-check.mjs`, `ci-reconciliation-contract-check.mjs`, `ci-inference-contract-check.mjs`, and the live data-watchdog checks.

## R346. Legacy event adapters must normalize the actual EventTarget and payload shape at the boundary (v53.9, P729)

**Rule**: A compatibility observer must subscribe to the same `EventTarget` that emits the legacy event and normalize its real `CustomEvent.detail` shape before routing or state projection. Do not assume that a browser event dispatched on `document` bubbles to `window`, or that a legacy string payload is an object envelope.

**Required**: The adapter owns target selection and string/object detail normalization. The route lifecycle gate must exercise one legacy event, a mount, a dispose, and a route round-trip in Chromium. A failed observer must leave the legacy shell as the rollback owner.

**Validation**: `scripts/ci-architecture-browser-check.mjs` verifies `document`-targeted `aio:pageShown` string detail, sentiment mount/dispose, offline blocked state, and sentiment→home→sentiment round-trip with zero unexpected browser errors.

## R345. 고빈도 데이터 batch는 Store 기록과 DOM 반영을 분리하고 전역 scan·rewrite를 batch당 한 번만 수행한다 (v53.9, P728)

**Rule**: quote처럼 여러 레코드를 한 묶음으로 적용하는 경로에서 각 `Store.set()`이 전체 문서를 스캔하지 않는다. 레코드별 단계는 검증·저장·특수 파생값만 처리하고, 공통 `data-live-*` DOM 반영과 lineage annotation은 batch 마지막 canonical binder가 한 번 소유한다. 단건 스트림 갱신은 symbol-target selector만 사용한다.

**Required**: 동일 이벤트 안에서 `[data-live-price]`/`[data-live-chg]` 전체 rewrite가 둘 이상 존재하지 않게 한다. 퇴역 UI 소비자를 위한 네트워크 fanout은 sink 삭제와 함께 scheduler에서 제거하고, runtime audit은 삭제된 DOM 존재 여부가 아니라 현재 canonical evidence의 값·시각·실패 상태를 검사한다.

**Validation**: `ci-runtime-contract-check.mjs`가 `PriceStore.set(..., { deferDomAnnotation:true })`, 중복 bulk rewrite 부재, target annotation의 `data-live-field` 포함, `fetchKrDynamicData()`의 `fetchKrInvestorTop10` 미호출, KR evidence audit 계약을 이진 검증한다. headless T383/T863과 critical routes에서 console/page error 0을 확인한다.

## R344. 퇴역 UI의 렌더 경로와 주기 작업은 canonical owner 하나만 남기고 실행 가능한 게이트로 고정한다 (v53.8, P727)

**Rule**: HTML에서 제거된 DOM sink를 조회하는 renderer·wrapper·event hook은 조용한 no-op이라도 남기지 않는다. 현재 UI에 남은 일부 상태 갱신은 별도 legacy wrapper가 아니라 해당 페이지의 canonical updater에 합친다. 반복 작업은 이름 있는 `_aioTimerRegistry` 경로만 사용하며, registry가 없을 때 raw `setInterval`로 우회하지 않는다.

**Required**: UI 리디자인 시 구 DOM ID뿐 아니라 `getElementById`/`querySelector` sink, 함수 선언, 모든 호출부, wrapper, 이벤트 등록을 저장소 전체에서 함께 제거한다. 남겨야 하는 출력은 현재 DOM ID와 canonical updater 사이의 직접 경로로 옮긴다. 주기 작업은 `_aioRegisterTimer(name, fn, ms)`를 통해 중복 등록 시 이전 timer가 정리되도록 한다.

**Validation**: `ci-runtime-contract-check.mjs`가 `updateFxDynamicComments`/`generateFxBondCommentary` 선언과 `fx-dc-*`/`bond-dc-*` DOM 조회 0건, `updateFxBondPage()`의 현재 상태 배지·Cross-Asset Matrix 직접 갱신, `aio-chat.js`의 raw `setInterval` 0건을 이진 검증한다. 변경 후 fxbond route와 headless 전체 테스트에서 console/page error 0을 확인한다.

## R343. 신용 판정은 HYG 등 듀레이션 오염 가격이 아니라 FRED HY OAS(bp) 실측만 사용하고, 결측 시 null 사전 차단으로 0을 방지한다 (v53.7, P726)

**Rule**: HYG(또는 임의 회사채 ETF) 달러 가격을 고정 임계값(예: `hyg > 88`, `hyg < 78`)으로 비교해 신용 스프레드 수준을 판정하지 않는다. HYG 가격은 금리(듀레이션) 노출이 섞여 있어 레짐이 바뀌면 같은 가격이 다른 신용 상태를 의미하게 된다. 신용 레벨 판정·점수·바 그래프·라벨·AI 컨텍스트는 전부 `window._hySpreadBp`(FRED BAMLH0A0HYM2, bp 단위)를 단일 소스로 사용하고 350/450/550bp를 표준 경계로 정렬한다(안정/주의/위기). HYG 가격 자체는 상대적 방향(당일 등락, 자기 자신 대비 상대 손절 트리거)에만 쓸 수 있다.

**Required**: (1) 신용 판정 함수 신설·수정 시 `grep -nE "hyg\s*[<>]=?\s*[0-9]{2}\b" index.html js/*.js`로 전수 확인 — OAS 아닌 결과가 0건이어야 한다. (2) `Number.isFinite(Number(v))`는 `v`가 `null`/`undefined`/`''`일 때 `Number(v)=0`으로 통과하는 함정(P715 클래스)이 있으므로, 결측 가능한 값에는 반드시 `v != null && Number.isFinite(Number(v))` 또는 `typeof v === 'number' && isFinite(v)` 형태로 null을 먼저 차단한다. (3) 신용/시장값 처방형 문구("피신 권고", "회피" 등)는 관측형으로 전환한다(R25/P714 원칙과 동일).

**Validation**: `grep -nE "hyg\s*[<>]=?\s*[0-9]{2}\b" index.html js/*.js | grep -vi "oas\|bp\b"` → 0건. `grep -n "Number.isFinite(Number(" index.html js/*.js`로 나온 각 사이트에 인접 `!= null`/`== null` 존재 확인. 결측·정상 양쪽 상태를 실브라우저(Playwright 등)로 직접 렌더링해 DOM 텍스트와 콘솔 에러 0을 확인한다 — 코드 리딩만으로 "어느 표면이 라이브에서 이기는가"를 판단하지 않는다(같은 사건에서 대상 DOM 자체가 존재하지 않는 고아 코드를 코드 리딩만으로는 놓쳤다).

## R342. 변동 데이터와 현재형 서술은 런타임 증거만 사용하고 결측을 정적 시드로 메우지 않는다 (v53.4, P717)

**Rule**: 시세·심리·거시·시장폭·수급·차트·시나리오 확률·이벤트 결과·현재 narrative·공급자 가격은 코드나 HTML의 고정 수치/문장으로 현재 상태를 만들지 않는다. 공식 일정·정책처럼 수동 검증이 필요한 값만 출처 URL, 기준일, 용도(`reference-only`/`calendar-only`)를 갖춘 단일 레지스트리에 둘 수 있다.

**Required**: 변동 필드는 explicit null로 초기화하고 생산자 미수신 시 `—`/`미수신`/판단 보류를 표시한다. SCREENER_DB는 식별자만 정적으로 보관하며 signal/memo/mcap/rsi는 provenance가 있는 런타임 산출물만 병합한다. 합성 차트, quote/FRED 시계열, RRG seed, 고정 시나리오 확률, 현재형 이벤트·뉴스·테마 문장, LLM 가격·환율 fallback을 금지한다. 과거 사례를 남길 때는 archive/reference 표지와 비운영 용도를 명시한다.

**Validation**: `node scripts/ci-static-data-contract-check.mjs` 22/22, `ci-runtime-contract-check.mjs`, DOM `data-live-*`/`data-snap` numeric seed 검사, `AIO_STATIC_DATA_POLICY`, `AIO.getStaticSeedFallbackAudit()` orphan 0, Chromium headless 전수 테스트.

**Provider retirement addendum (P718)**: 변동 데이터 생산자·레지스트리를 퇴역할 때는 관련 선언, 호출, DOM sink, formatter, 테스트를 하나의 수직 경로로 제거한다. `provider-required` 출력은 검증된 응답 전까지 숫자·확률·중립 기본값을 렌더하지 않는다. 정적 검사만으로 완료 처리하지 않고, 외부 요청이 실패한 실제 Chromium route에서 console error 0을 확인한다.

## R341. 퇴역 기능은 inert stub로 보존하지 않고 수직 경로와 공개 artifact에서 완전히 제거한다 (v53.3, P716)

**Rule**: 사용하지 않는 기능을 unconditional `return`, 빈 함수, 숨김 DOM/CSS, legacy wrapper로 남기지 않는다. 실제 활성 대체 경로와 외부 참조가 없음을 증명한 뒤 DOM·스타일·상태·함수·호출·테스트·배포 항목을 하나의 수직 경로로 제거한다.

**Required**: runtime named function은 선언 외 참조가 최소 1개 있어야 한다. 퇴역 기능 테스트는 “inert”가 아니라 심볼·DOM·배포 자산의 부재를 검증한다. Pages는 runtime script를 파일명으로 명시하고 `js/*.js` wildcard를 사용하지 않으며, CI 전용 `aio-tests.js`는 HTML·Pages artifact·service worker cache에 포함하지 않는다.

**Validation**: `scripts/ci-structural-check.mjs` declaration-only scan, `scripts/ci-release-revision-check.mjs` manifest/CI/SW 정합 검사, `rg` 수직 참조 스윕, Chromium headless 전체 회귀.

## R340. 파생 시장 결론은 필수 관측 입력의 의미·기준일·coverage가 충족될 때만 표시한다 (v52.99, P712)

**Rule**: 금리 스프레드, 기술지표, Stage, RRG, 시장폭, McClellan, HY OAS, 테마·시장 건강도처럼 여러 값을 결합하는 결론은 각 필수 입력의 instrument/maturity/unit/source/asOf/coverage를 검증해야 한다. 다른 만기·다른 지표·정적 시드·중립 상수·난수 시계열을 결측 대용으로 사용해 현재값이나 현재 판정처럼 표시하지 않는다.

**Required**: 2s10s는 명시적 2Y·10Y 관측치만, RSI/MACD/Stage·시장 레짐·지지저항은 기준시각이 확인된 충분한 OHLCV만, RRG는 상대가격 히스토리만, McClellan은 실제 상승·하락 종목수 시계열만, HY OAS는 공식 OAS 관측치만 사용한다. 엔캐리·크로스에셋 프록시는 모든 필수 현재 입력이 있어도 포지션·옵션·당국조치·방향 예측으로 승격하지 않으며, 하나라도 없으면 점수도 보류한다. 비정규화 가격비율은 시장폭·집중도 결론에 쓰지 않는다. 한국 테마·시장건강도는 최소 coverage와 현재 수급/VKOSPI를 충족해야 한다. 하나라도 충족하지 않으면 값·등급·행동 문구를 함께 `판정 보류`로 닫고 누락 입력을 표시한다.

**Validation**: T874, T1024~T1027, T1037~T1039, `scripts/ci-runtime-contract-check.mjs`, 22-route semantic inventory, synthetic-series/RRG-seed/HYG-to-OAS/past-calendar source scans.

## R339. 증분 정성 피드는 전체 관측 lineage와 capped 소비 payload를 분리하고 현재 narrative를 재생성한다 (v52.97, P711)

**Rule**: Telegram 같은 증분 정성 피드의 `count`는 이번 fetch 수나 capped 본문 배열 길이로 가장하지 않는다. rolling window 전체의 경량 ID/channel/time/score/tags/tickers lineage와 UI/chat용 capped full text를 분리하고, `freshCount`, text eligibility, high/broad signal, selected payload coverage를 각각 노출한다. 동적 artifact가 로드되면 정적 과거 themes/catalysts/categories/pageMap을 유지하지 않고 현재 원문에서 재생성한다.

**Required**: producer와 runtime fallback은 동일한 22-page 의미 map을 만들고, guide처럼 뉴스가 불필요한 route는 명시적 비적용으로 남긴다. 분류 taxonomy와 ticker alias는 현재 채널 주제를 수용하고 SCREENER_DB universe를 활용한다. 전 채널 실패는 이전 성공 digest의 본문·`generatedAt`을 보존하고 `attemptedAt`/failure만 갱신한다. Telegram 내용은 계속 secondary/reference이며 가격·금리·매매 판단값으로 직접 승격하지 않는다.

**Validation**: `AIO.getTelegramPageCoverageAudit()`, `AIO.getTelegramPipelineAudit().digest.coverage`, T830~T831, `ci-data-pipeline-contract-check.mjs`, `ci-runtime-contract-check.mjs`, `_artifacts/telegram-5d-coverage-audit-2026-07-15.md`.

## R338. 데이터 artifact lineage는 정책별 timestamp와 반영 commit을 함께 검증하고, 다른 시각을 승격하지 않는다 (v52.96, P710)

**Rule**: live-core quote, incremental official reference, daily history, research horizon, editorial note, and universe reference have different freshness semantics. A tracked JSON file must have an explicit policy and timestamp selector; `generatedAt`, `asOf`, `observedAt`, `fetchedAt`, `releaseAt`, `lastSuccessfulAt`, and row dates must not be silently substituted for one another. A current-looking file without producer/source and last-commit evidence is not a complete lineage record.

**Required**: `scripts/ci-data-lineage-audit.mjs` must enumerate every tracked `public-data/*.json`, report timestamp/age/source/producer failures/last commit, fail on missing or invalid core lineage, warn on reference/research staleness, and preserve explicit decision-use gates such as SEC coverage below 80%. Its report is local/CI evidence only and never upgrades provider rights, factual truth, live deployment, or human/legal approval.

**Validation**: `node scripts/ci-data-lineage-audit.mjs --json` with the 12-artifact local report and CI invocation.

## R335. BLS 공식 macro evidence는 FRED 대체값이 아니라 typed primary producer로 보존한다 (v52.94)

**Rule**: BLS keyless API 값은 FRED 값과 별도의 sourceKind/evidence/series metadata로 보존한다. `releaseAt`은 API가 제공하지 않으면 null이어야 하며, fetch time을 release time으로 승격하지 않는다. M13·연간 평균·불충분한 history·실패 응답은 정상 관측값이나 결정용 값으로 혼합하지 않는다.

**Required**: allowlist와 bounded POST를 유지하고 12시간 성공 캐시, last-known-good, `attemptedAt/failureReason`, unit/frequency/seasonalAdjustment, derived input observation periods를 artifact와 runtime contract fixture로 검증한다.

## R336. 모든 route의 page completeness는 producer failure와 reference fallback을 종결 상태로 노출한다 (v52.94)

**Rule**: `loading`을 최종 상태로 남기지 말고 `loaded | partial | empty | blocked | stale-reference` 중 하나로 종료한다. `missing/zero`, 공급자 장애, stale/reference를 서로 다른 상태로 유지하며 required producer가 충족되지 않으면 해당 route의 금지 claim과 allowed use를 함께 노출한다.

**Required**: `AIO_PAGE_CONTRACTS.pages[id]`의 required/optional/coverage/age/failure/forbidden fields와 `AIO.getPageDataCompleteness()`/`auditPageDataCompleteness({allRoutes:true})`를 단일 실행 경로로 사용한다. 22-route fixture, runtime contract, headless/accessibility/viewport matrix를 큰 변경 단위마다 통과시킨다.

## R337. Runtime fixture override와 reference fallback drift의 의미를 테스트 계약에 고정한다 (v52.94, P709)

**Rule**: 명시적인 `_aioScreenerLoadState.status` fixture/operator 상태는 실제 artifact metadata보다 우선하여 producer 장애를 재현해야 한다. 반대로 날짜가 있는 `_fallback` mirror의 값 차이는 `referenceOnly/fallbackAsOf/snapshotAsOf/parityRequired`로 공개하고, reference-only 상태를 live parity 실패로 승격하지 않는다.

**Required**: T686은 zero drift 또는 명시적인 dated reference-only evidence만 허용하고, T1022는 실제 artifact가 존재하는 환경에서도 disconnected producer를 검증한다. `AIO.getSnapshotFallbackConsistencyAudit()`와 page completeness API를 함께 유지한다.

## R313. AI reference retrieval must be intent-aware, top-k bounded, source-separated, and deterministically compacted (v52.78, P693)

**Rule**: Imported research is `REFERENCE` material, not current market evidence. AI context assembly must classify the question, declare required evidence fields, rank route-relevant research with a stable top-k/tie order, and compact over-budget reference text deterministically within the declared 2K–6K token budget.

**Required**: Reuse `AIO.classifyAIQueryIntent`, `AIO.retrieveImportedResearch`, `AIO.buildAIRetrievalContext`, and `AIO.compactAIContext`; preserve `sourceKind`/`asOf` and the explicit live/SNAPSHOT/verified-data rule. Do not trim separately injected current evidence or create a parallel AI truth store. Record P95 input-token samples using the shared chars/4 estimator with the stated ±10% target.

**Validation**: T950~T957, WP-AI3 runtime-contract checks, `AIO.getAIRetrievalAudit`, `AIO.recordAIContextBudget`, and Chromium headless `1018/1018 PASS` locally. Live model/retrieval quality certification remains separate.

## R314. External AI inputs must be explicitly untrusted and portfolio data must be allowlisted (v52.79, P694)

**Rule**: News, Telegram, web-search, and translation-source text are data, not instructions. Normalize hidden/control characters, audit injection signatures, and wrap the block before model submission. Portfolio AI may send only the declared field allowlist after a session-only consent preview; chat history must expose bounded retention and off mode.

**Required**: Reuse `AIO.sanitizeAIUntrustedText`, `AIO.buildAIUntrustedBlock`, `AIO.redactPortfolioForAI`, `AIO.getPortfolioAIPrivacyPreview`, and `AIO.getChatHistoryPolicy`. Do not pass account/user identifiers, exact position quantities/costs, targets, or raw journal fields by default.

**Validation**: T958~T962, WP-AI4 runtime-contract checks, and Chromium headless `1027/1027 PASS` locally.

## R315. Personalized financial action permission must be evaluated once at the shared response boundary (v52.79, P694)

**Rule**: Prohibited conduct is denied; personalized trade instructions require suitability, current/live evidence, sourceKind/asOf, and explicit assumptions/invalidation context. Stale, missing, or `REFERENCE`-only evidence cannot authorize a personalized action. Probability claims require evidence or calibration metadata.

**Required**: Use `AIO.evaluateAIActionPermission` inside `_aioRunAIResponsePipeline`; retain `conductAudit` in the response envelope and do not create a per-page parallel gate.

**Validation**: T963~T966 and WP-AI5 runtime-contract checks; live model/red-team and jurisdiction-specific legal review remain separate.

## R316. Automated content must pass a publish audit and retain a deterministic fallback/source label (v52.80, P695)

**Rule**: Translation, briefing, and market-analysis output are publish surfaces, not merely chat responses. Structured claim corruption or a missing required envelope must fail closed without breaking the page; expose a deterministic evidence-summary/template fallback and distinguish it from AI-generated text.

**Required**: Reuse `AIO.validateAIAutomatedPublish`, `AIO.buildDeterministicEvidenceSummary`, and `AIO.getAIOutputSourceLabel` through the shared response pipeline. Preserve the existing `AIO.synthesizeMarketAnalysis` fallback for unverified server prose.

**Validation**: T967~T968, WP-AI6 runtime-contract checks, and Chromium headless `1032/1032 PASS` locally.

## R317. AI page context contracts must be projected from the existing page registry (v52.80, P695)

**Rule**: Every route must declare required/optional/forbidden AI data, beginner/expert answer modes, decision policy, and explicit disabled-state behavior. The source of truth remains `AIO_PAGE_CONTRACTS`; aliases such as `kr-technical`/`kr-tech` are audited explicitly.

**Required**: Reuse `AIO.getPageAIContract` and `AIO.auditPageAIContracts`; do not create a parallel route registry or silently omit a page context.

**Validation**: T969~T971, WP-AI7 runtime-contract checks, and 22-route audit with `silentDisabled=0`.

## R326. Tool capabilities are read-only by default and mutation/unknown operations are denied (v52.86, P701)

**Rule**: AI may inspect explicitly registered read-only data only. Unknown capabilities, writes, orders, account changes, external sends, file/network mutations, and operation mismatches are denied at the shared response boundary.

**Required**: Reuse `AIO.getAIToolCapabilityRegistry`, `AIO.evaluateAIToolPermission`, and `AIO.auditAIToolCapabilities`; do not infer write permission from user prose or create an entrypoint-specific mutation path.

**Validation**: T1007~T1009 and T1013, WP-AI19 runtime-contract checks, and Chromium headless `1075/1075 PASS` locally. Live tool/operator certification remains separate.

## R327. Provider/data/output rights, retention, training, redistribution, and region require explicit registry approval (v52.86, P701)

**Rule**: Availability of a provider or data source is not rights approval. Missing or unverified rights metadata remains review-required; notices must state the scope and no training/redistribution/region permission may be inferred.

**Required**: Reuse `AIO.getAIRightsRegistry`, `AIO.evaluateAIDataRights`, and `AIO.auditAIRightsRegistry`; keep local-reference approval separate from live provider/legal/operator verification.

**Validation**: T1010~T1014, WP-AI20 runtime-contract checks, and Chromium headless `1075/1075 PASS` locally. Live rights/legal/operator certification remains separate.

## R324. Coverage and exposure audits must neutralize missingness before recommendations (v52.85, P700)

**Rule**: Region/sector/cap/liquidity/source coverage and exposure must be reported explicitly. Missing or unknown fields are neutral, never a positive/negative score or eligible recommendation; any promotion of missingness fails the gate.

**Required**: Reuse `AIO.buildAICoverageExposureReport` and `AIO.evaluateAICoverageBias`; retain per-dimension missingness, exposure counts, unknown rows, and promoted IDs. Keep population/model bias certification separate from local structural coverage.

**Validation**: T999~T1001, WP-AI17 runtime-contract checks, and Chromium headless `1067/1067 PASS` locally. Live universe/model bias remains separate.

## R325. Human chat claims require signed cross-mode evidence and explicit incomplete states (v52.85, P700)

**Rule**: Chat usability/accessibility claims require screen-reader, keyboard, mobile, novice, expert, and task-completion evidence with evidence ID, signer, and signed timestamp. Missing dimensions or signatures are blocked, not silently promoted to pass.

**Required**: Reuse `AIO.getHumanChatCertificationMatrix`, `AIO.createHumanChatCertification`, and `AIO.evaluateHumanChatCertification`; preserve surface/route/viewport/assistive-tech context and keep live human certification separate from local fixtures.

**Validation**: T1002~T1006, WP-AI18 runtime-contract checks, and Chromium headless `1067/1067 PASS` locally. Live SR/mobile/user certification remains separate.

## R322. Model releases require replay provenance, approval, canary, and rollback evidence (v52.84, P699)

**Rule**: A model response is replayable only when request/app/data/Worker revision, model, prompt, retriever, validator, evidence snapshot, sampling, and output hash are retained. Release approval requires named owner/reviewer, replay pass, canary pass, and no rollback trigger.

**Required**: Reuse `AIO.createAIReplayManifest`, `AIO.recordAIReplayManifest`, `AIO.replayAIResponseSample`, and `AIO.evaluateAIModelRelease`; keep model prose separate from Evidence and fail closed on metadata/output drift.

**Validation**: T991~T994, WP-AI15 runtime-contract checks, and Chromium headless `1059/1059 PASS` locally. Live provider/model replay and canary certification remain separate.

## R323. AI cache identity, idempotency, and stream completion must be tenant-safe and auditable (v52.84, P699)

**Rule**: Response/context identity must include tenant/session/route/entity/evidence/model/prompt/retriever scope without raw identifier leakage. Duplicate in-flight requests are denied, completed requests are replay-only, and partial/aborted streams cannot be silently promoted to complete.

**Required**: Reuse `AIO.buildAIIsolationCacheKey`, `AIO.beginAIIdempotentRequest`, `AIO.finalizeAIIdempotentRequest`, `AIO.abortAIIdempotentRequest`, and `AIO.finalizeAIStream`; keep current request ownership and stream state at the shared pipeline boundary.

**Validation**: T995~T998, WP-AI16 runtime-contract checks, and Chromium headless `1059/1059 PASS` locally. Live multi-user race/isolation certification remains separate.

## R320. Retrieval documents require lifecycle metadata and poisoning quarantine before AI use (v52.83, P698)

**Rule**: Imported research is untrusted reference material. Every indexed document must retain document/chunk/version/time/source-tier metadata; injection/encoded/hidden content, retracted, superseded, or manually quarantined rows cannot enter active top-k or current-action evidence.

**Required**: Reuse `AIO.indexAIRetrievalDocuments`, `AIO.evaluateAIRetrievalQuality`, `AIO.quarantineAIRetrievalDocument`, and `AIO.retrieveImportedResearch`. Record recall/precision/source-tier/temporal metrics and fail closed when a quarantined document is used by a current action path.

**Validation**: T983~T987, WP-AI13 runtime-contract checks, and Chromium headless `1051/1051 PASS` locally. Live retrieval/model certification remains separate.

## R321. Financial conduct classification must preserve P0, legal-review, and educational states (v52.83, P698)

**Rule**: Conduct policy must classify all matched categories, block executable prohibited conduct at P0, route actionable jurisdictional/legal/tax/regulatory advice to legal review, and preserve non-actionable educational explanations. The shared response boundary is the enforcement point.

**Required**: Reuse `AIO.getFinancialConductPolicy`, `AIO.classifyFinancialConduct`, and `AIO.evaluateAIActionPermission`; do not create per-entrypoint conduct exceptions or silently convert legal-review-required content into advice.

**Validation**: T988~T990, WP-AI14 runtime-contract checks, and Chromium headless `1051/1051 PASS` locally. Live red-team/legal certification remains separate.

## R318. AI operations and release claims require measured SLO, deterministic benchmark, and manifest-linked feedback (v52.81, P696)

**Rule**: Provider usage, latency, token/cost, quota, model A/B, and user feedback must be observable through bounded local contracts. A candidate is not releasable when it regresses groundedness/currentness/action safety, exceeds the latency/cost tolerance, or has any P0 error.

**Required**: Reuse `AIO.recordAISLOSample`, `AIO.getAISLOReport`, `AIO.tryAcquireAIQuota`, `AIO.runAIGoldenBenchmark`, `AIO.evaluateAIGoldenABGate`, and `AIO.createAIFeedbackSample`. Keep live-provider/model certification separate from deterministic local fixtures.

**Validation**: T972~T976, WP-AI8/9/10 runtime-contract checks, and Chromium headless `1037/1037 PASS` locally.

## R319. Conversation state and finance arithmetic must be deterministic, scoped, and auditable (v52.82, P697)

**Rule**: A response may render only for its current session/turn/route/entity. Route/entity changes, cancel, retry, timeout, and trim must invalidate stale ownership. Financial arithmetic must come from an approved deterministic calculator and a validated `CalculationEvidence` object; model-generated numbers cannot become decision inputs.

**Required**: Reuse `AIO.createAIConversationState`, `AIO.transitionAIConversationState`, `AIO.isCurrentAIResponse`, `AIO.runApprovedCalculation`, `AIO.validateCalculationEvidence`, and `AIO.checkCalculationInvariant`.

**Validation**: T977~T982, WP-AI11/12 runtime-contract checks, and Chromium headless `1043/1043 PASS` locally.

## R312. Structured current-sensitive AI claims must preserve typed Evidence identity and fail closed on mismatch (v52.77, P692)

**Rule**: A model-generated current-sensitive claim is not publishable merely because it contains a number. It must carry metric, value, unit, scale, direction, as-of, source/sourceKind, and exactly one evidenceId that resolves to the same metric/unit/scale/value/direction evidence row. Unstructured prose remains subject to the existing public action/freshness gates; structured claim envelopes additionally pass the shared WP-AI2 claim audit.

**Required**: Reuse the common `_aioRunAIResponsePipeline`; do not create a parallel AI-only validator or evidence store. Block missing/duplicate evidence, future or missing as-of/source, F&G↔VIX confusion, NFP scale errors, bp↔percent errors, sign reversal, and FX quote inversion. Keep counterexample fixtures in T941~T949 and keep the prompt schema versioned.

**Validation**: `AIO.createTypedClaim`, `AIO.validateTypedClaim`, `AIO.validateAIResponseClaims`, `claimAudit`, WP-AI2 runtime contract, and Chromium headless T941~T949 (`1010/1010 PASS` locally). Live model-output certification is separate.

## R311. 공개 AI의 모든 진입점은 동일 요청 envelope·응답 pipeline·validator/block-policy 버전을 기록하고 retry는 같은 completion contract를 재사용한다 (v52.76, P691)

- per-page/unified/retry/translation/briefing/server-analysis는 `_aioCreateAIRequestObject`와 `_aioRunAIResponsePipeline`을 공유한다. 새 parallel validator를 만들지 말고 기존 action gate를 공통 pipeline에 흡수한다.
- request object에는 entrypoint·requestId·attempt·pipelineVersion·validatorVersion·blockPolicyVersion을 기록하고, retry는 새 request를 만들지 않는다. 최종 manifest에는 raw model text를 저장하지 않는다.
- 자동 콘텐츠가 pipeline 부재 또는 공개 action 정책 차단을 만나면 local/deterministic fallback으로 닫혀야 하며, undefined `CHAT_CONTEXTS`로 조용히 실패하면 안 된다. T937–T940과 runtime contract를 함께 유지한다.

## R310. 공개 AI는 렌더 경계까지 베타·교육/리서치 보조 정책을 강제하고, 검증되지 않은 자동 문장을 공개하지 않는다 (v52.75, P690)

- 공개 AI 표면은 `AI 베타 · 교육/리서치 보조`로 식별해야 하며, 독립 투자자문·검증 시스템·실시간 주문 도구처럼 보이는 문구를 사용하지 않는다.
- 구체적인 매수·매도·진입·청산·비중·수량·손절·목표가 지시는 typed evidence/suitability/action gate가 구현·통과되기 전까지 차단한다. 이 게이트는 streaming, 완료, retry, 양쪽 채팅 진입점, assistant history와 후속 chips에 동일하게 적용한다.
- current-sensitive 답변은 기준시각·Evidence 상태·원천/원문 재확인 안내를 표시하고, `marketAnalysisOk` 생성 성공만으로 자동 LLM 문장을 공개하지 않는다. 의미 검증 `marketAnalysisSemanticOk=true` 또는 명시적 `status: verified`가 필요하다.
- 검증은 T932–T936와 `ci-runtime-contract-check.mjs`로 concrete/강한 방향성 action 차단·교육성 답변·disclosure 메타·unverified marketAnalysis 폴백을 모두 고정한다. 현재 로컬 Chromium 기준선은 `997/997 PASS`이며, 실제 Pages/Worker와 모델 문답은 별도 live gate다.

## R301. 일반 사용자 부팅 경로에서는 배포·공유·전수 Evidence 감사를 실행하지 않는다 (v52.74)

- 부팅 및 페이지 이동 이벤트가 호출하는 함수는 활성 페이지와 이미 수집된 런타임 상태만 읽어야 한다. `getShareReadinessAudit`, `getDeploymentGateAudit`, `getAutoOpsReadiness`, full-surface DOM/text 감사는 CI·명시적 개발자 모드에서만 허용한다.
- 초기 상태 UI는 `pointer-events:none`인 비차단 표시여야 하며 3초 이내 강제 해제한다. 상태 표시의 존재를 성능 개선으로 간주하지 않는다.
- CI는 실제 Chromium에서 FCP ≤2.5초, 최초 페이지 전환 ≤2초, 최대 long task ≤2.5초, 목적 라우트 활성화와 상태 표시 해제를 검증한다.

## R300. When turning on new error/warning signal collection inside a test harness that deliberately blocks network access, expect the app's own legitimate failure-detection code to surface through that same channel — trace it to source before allowlisting or failing on it (v52.52)

- Adding `page.on('pageerror')`/`page.on('console')` collection to `scripts/ci-viewport-matrix-check.mjs` (which had never collected either before — a route could throw on every single visit and still report a clean PASS) immediately surfaced 8 new "failures" the moment it was turned on, all sharing one message shape: `[AIO:api] {source}: warn → error {errCount: 3}`. Tracing this to its source (`js/aio-core.js` `_reportApiError()`) showed it was the app's own intentional API-health monitor correctly detecting that a data source failed 3 consecutive times and escalating its tracked status from `warn` to `error` — entirely expected, since this exact harness aborts every external network request by design (for deterministic, offline testing). Not a bug; the app behaving exactly as designed under conditions the test itself created.
- The fix is not to disable the new error collection (that would throw away the real signal it's meant to provide) and not to blanket-suppress all `console.error` (same problem). Extend the allowlist to match the *specific, verified* expected-noise pattern only, the same way this repo already handles `net::ERR_FAILED`/`Failed to load resource` in `ci-headless-tests.mjs` (documented there as "the expected side-effect of the route.abort() below, not a real regression"). A narrow, source-traced allowlist entry preserves the ability to catch a genuinely new unexpected error later; a broad one (e.g. matching on `[AIO:api]` alone, or any `console.error` containing "error") would silently swallow real regressions in the same logging subsystem.
- General pattern: any time a QA harness deliberately creates an abnormal environment (blocked network, mocked time, stubbed randomness, forced error injection) and you add a *new* signal-collection mechanism to that harness, budget time to first triage what fires under normal/expected conditions before treating the first run's failure list as a queue of real bugs to fix. Some of it usually is real (see the F-01 SVG-overlap bug this same effort found and fixed, P667) — but conflating "test-environment-induced expected noise" with "genuine defect" either wastes effort chasing non-bugs or, worse, trains the next person to distrust and ignore the new gate.
- See P667/BUG-POSTMORTEM.md.

## R299. A factor backtest's universe composition and lookback window can flip the sign of a well-known factor — don't compare against academic-literature factor performance without matching sample characteristics (v52.51)

- A 10-year (2016-2026), 120-large-cap-ticker, monthly-rebalanced backtest of the live factor ranking model's `lowvol` sub-factor (`-annualizedVol`, computed over a trailing 60-day window) found a *statistically significant negative* Spearman IC with 5/21/63-day forward returns (e.g. 21-day: ICIR=-0.191, t-stat=-2.04, 95% CI [-0.093,-0.002], strengthening in the more recent walk-forward holdout period to ICIR=-0.491/t=-2.95) — the opposite sign from the "low-volatility anomaly" the factor's inclusion presumably assumed. The blended composite (momentum+trend+lowvol+kalman at live NEUTRAL weights) showed no statistically distinguishable-from-zero signal at any of 1/5/21/63-day horizons over the same sample.
- Two candidate explanations, both plausible and neither proven: the academic low-vol anomaly is usually measured on a full-market universe over multi-decade, multi-regime windows using risk-adjusted (often beta-relative) volatility — a top-120-by-market-cap, single-decade, raw-60-day-volatility measurement is a materially different construct, not a replication attempt of the same claim. Separately, this specific decade's sample happens to be dominated by large-cap tech/AI-theme names where the historically-quieter (lower realized vol) names underperformed the historically-more-volatile high-growth names — a sample-composition effect, not necessarily a universal property of "low volatility" as a concept.
- Before citing an academic factor-investing result (low-vol anomaly, momentum premium, quality premium, etc.) as justification for a scoring/ranking rule, or before treating a backtest's finding as evidence the underlying factor concept itself is wrong, check whether the backtest's universe (breadth, cap-weighting, sector composition), lookback window (which regimes it does/doesn't span), and exact factor definition (raw vs risk-adjusted, lookback length) actually match the literature's — a narrow, sample-specific result can validly point in the opposite direction from the general finding without either being "wrong."
- Same underlying caution as R298 (fixed absolute thresholds vs. regime shift) applied to a different failure mode: there, a *rule's own threshold* didn't survive a regime-spanning window; here, a *factor's own sign* doesn't necessarily generalize from a narrow sample back to the broad-universe literature claim that motivated including it.
- This finding does **not** by itself justify silently changing `_aioComputeFactorRanks()`'s live factor weights or the `lowvol` factor's direction/inclusion — same principle as R298's closing point: report it, don't act on it unilaterally on a partial-coverage (4-of-7-factor, subset-not-full-universe, survivorship-bias-unresolved) validation result.
- See P666/BUG-POSTMORTEM.md, `public-data/factor-backtest-longrun.json`.

## R298. A hand-tuned score using fixed absolute-level thresholds on a macro indicator must be re-validated against realized outcomes across a regime-shifting window before trusting its sign, not just its shape (v52.49)

- `computeTradingScore()`'s `macroScore`/`volScore` components compare live values against fixed absolute numbers (`dxy > 107`, `tnx > 4.5`, `vix < 15` for top volScore tier) that were presumably reasonable at whatever moment they were chosen. A 10-year backtest (2016-07 to 2026-07, `scripts/backtest-trading-score-longrun.mjs` → `public-data/score-backtest-longrun.json`) found the reconstructed vol+trend+macro sub-formula (55% of the score's weight) has a *statistically significant negative* Spearman correlation with both 21-day (rho=-0.165, 95% CI [-0.203,-0.127], n=2492) and 63-day (rho=-0.255, CI [-0.291,-0.217], n=2450) forward SPX returns — stable in sign across a chronological reference/holdout split, not a one-period fluke.
- The leading hypothesis (not proven, but consistent with the data): `tnx`/`dxy`'s fixed absolute thresholds don't adapt to the fact that this 10-year window itself spans a structural regime shift (near-zero rates through ~2021, then a multi-year rate-hiking regime from 2022) — "high TNX" by 2016 standards and "high TNX" by 2023 standards are different regime positions, but the score treats them identically. `volScore`'s "low VIX = high score" logic independently shows the strongest single-factor negative correlation of the three (rho=-0.171 at 21d) — consistent with the broader, independently-documented observation that unusually low realized/implied volatility often precedes complacency-driven mean-reversion rather than continued calm.
- Before adding a new absolute-level threshold to a scoring/decision function (or trusting an existing one), check whether that threshold's "high/low" classification would mean the same thing across the full multi-year range the function is expected to operate over — if the underlying indicator has a known multi-year secular trend or regime dependency (rates, dollar strength, credit spreads), prefer a rolling-percentile or regime-relative comparison over a hardcoded absolute cutoff, or explicitly document why the absolute cutoff is expected to remain valid.
- A negative/inverted backtest result is itself required output, not a failure to hide: per [[TM-VIII]] (`_context/KNOWLEDGE-BASE.md`) and P665 (`BUG-POSTMORTEM.md`), the finding was written up and the artifact kept exactly as computed — an unfavorable result doesn't get silently discarded or excluded from the next validation pass.
- **This finding does NOT by itself justify silently changing `computeTradingScore()`'s live logic, thresholds, or `getScoreAdvice()` text.** The backtest covers only ~55% of the score's weight (vol+trend+macro; momScore/breadthScore/PCR/AAII held at neutral constants throughout since no free multi-year PIT source exists for them) — treat "should the live score/label change in response" as a separate, explicit product decision requiring its own confirmation, not an automatic consequence of a partial-coverage validation result.
- See P665/BUG-POSTMORTEM.md, TM-VIII/KNOWLEDGE-BASE.md.

## R297. A score's evidence/provenance registry must list every input the score function actually reads — not just the subset registered when the registry was first built (v52.49)

- `computeTradingScore()` reads ~13 distinct inputs (spx/spy/vix/tnx/hyg/dxy/oil plus vvix/fg/breadth200/pcr/aaiiBear/hyBp), but `TRADING_DECISION_CRITICAL_INPUTS` (the registry `getTradingDecisionInputEvidence()` walks to compute `evidenceStatus`/`evidenceAudit`) only listed the first 7 for a long time — the other 6 could be silently missing or hours-stale with zero effect on the reported evidence status, because they were never in the list being checked. The registry and the score function are two separate pieces of code with no compiler-enforced link between them; nothing fails if they drift apart.
- Before adding a new input to a scoring/decision function, check whether that function's output already has an evidence/provenance registry consuming it, and if so, add the new input there in the same change — not as a follow-up. Conversely, when auditing an existing evidence registry's completeness, don't just check that it runs without error; read the scored function's own source and diff its actual input list against the registry's `id`/`symbol` list by hand.
- Not every input needs the same registry shape: inputs read via `window._liveData[symbol].price` (quote-based) and inputs read via a bespoke `window` global (`_lastFG`, `_breadth200`, `_putCallRatio`, `_hySpreadBp`, `_aaiiBearish` — each with its own fallback chain already written inline in the scoring function) need different evidence-lookup code, since the latter have no symbol to key a live-quote lookup on and instead need the same `_markFetch(apiName)` central freshness registry (v48.36) other API fetches already use. A registry entry for a global-var input is useless if that global is never `_markFetch`-registered anywhere — add the `_markFetch` call at the same time as the registry entry, not after.
- Not every input is trading-grade even when present: an input that is *always* snapshot/reference tier by its nature (e.g. AAII bearish %, a weekly manually-refreshed survey number with no live-fetch path at all) should be tagged `decisionUse:'reference'` rather than `'trading'`, so it is honestly excluded from a "critical inputs missing" gate instead of permanently tripping it (or, worse, being silently dropped from the registry entirely to avoid that false trip — which is how it went missing in the first place).
- A regression test asserting the registry's `total` input count (a specific number, e.g. 13) is a deliberate, narrow exception to R279 ("don't hardcode a literal a test happens to observe") — here the literal *is* the structural property under test: it trips on purpose the next time a 14th input is added to the score function without a matching registry entry, forcing a human to update both together rather than let them silently diverge again.
- See P664/BUG-POSTMORTEM.md (WO-6): `_aioDefaultDecision()`, the shared cross-page decision-header builder, had an entirely separate problem in the same area — it already computed a `sourceKind`/confidence badge from 5 raw macro metrics, but discarded `computeTradingScore()`'s own `evidenceAudit` (reading only `.total`), so the screen's provenance badge and the score's own evidence-completeness could show two disconnected pictures. Fixed by merging `evidenceAudit.criticalMissing.length` into the page's `sourceKind` computation, bounded (0→no change, 1-2→mild DELAYED, 3+→SNAPSHOT) so routine single-input staleness doesn't flip every page to a permanently degraded badge — an unbounded merge would trade one honesty bug (stale shown as live) for its mirror image (routinely-fresh shown as permanently stale).

## R280. A global function declared in more than one non-module `<script>` (inline or external) silently loses all but the last-loaded definition — with no error, no warning (v52.8, mechanically gated v52.19)

- Classic (non-module) `<script>` tags share one global scope. If the same function name is declared with `function`/`async function` syntax in two different `<script>` blocks — inline, external, or a mix — the *last one to execute* wins completely; every earlier declaration (and everything only it called) becomes silently unreachable. No console error, no lint signal from either file read in isolation.
- `<script defer>` external files always execute after all inline `<script>` blocks that precede them in document order — so a duplicate between an inline block and a deferred external file always resolves to the external file's version, regardless of which looks more "current."
- Before adding a new top-level `function name(){}` to any non-IIFE-wrapped `js/*.js` file or an inline `<script>` block in index.html, grep the *entire* codebase for that exact name first. If a match exists, rename one, make one explicitly call the other, or delete the obsolete one — never let two same-named declarations coexist unremarked.
- **v52.19: this is no longer a human-grep-only rule.** `scripts/ci-structural-check.mjs` extracts every column-0 (true top-level) `function`/`async function` declaration from index.html and all 5 runtime `js/*.js` modules and fails the build if any name appears in more than one file (a small allowlist exists only for a confirmed-tracked, not-yet-resolved shadow — currently empty). A future accidental reintroduction of this class is now caught at CI time, not discovered live.
- Complements R260 (same file/scope duplicate — single-file check) and R275 (shared global *objects* must merge, not overwrite) — R280 covers the same last-write-wins hazard applied to *functions* declared across *separate files*.
- See P605/P626, BUG-POSTMORTEM.md.

## R279. A regression test must assert the structural property a value is supposed to satisfy, not the specific value/date/count observed when the test was written — that literal will itself go stale (v52.7, broadened v52.20)

- Originally (v52.7): a frequency string embedding a required weekday (e.g. `monthly-first-friday`) must snap to that weekday after every mechanical date-advance, not just shift by a calendar month/day count. A mechanical "advance this stale date to the next cycle" loop that steps by `+1 month` preserves the *day-of-month*, not the *day-of-week* — for a weekday-anchored release (e.g. US NFP: always the first Friday), this can silently produce a date the event can never fall on. Check for the weekday-anchor pattern *before* a generic "contains 'monthly'" branch, and compute the actual target weekday rather than reusing the previous cycle's day-of-month.
- **v52.20 (P627): this generalizes well beyond calendar dates.** A test that hardcodes an exact number, count, keyword, or date literal observed at write-time — rather than the *range*, *shape*, or *invariant* that value was actually meant to demonstrate — is guaranteed to fail again the moment that value legitimately changes (a periodically-refreshed market seed, a rolling-window digest's content, a version string, a macro indicator reading). Six-plus instances of this same root cause were found and fixed in one pass: exact-equality checks on legitimately-refreshed data seeds (assert a sanity range instead), one-off print values elevated to permanent thresholds inside an otherwise-correct sanity band (assert the real economic/structural threshold, e.g. PMI's 50-point expansion boundary, not the specific month's print), pinned calendar dates on any auto-advancing schedule (assert validity + not-in-the-past + weekday-anchor, not the literal date), and pinned content/counts from a deliberately rolling-window data source (assert shape and cross-field consistency, not what a specific week's content happened to say).
- A regression test for this class of bug must assert the structural property generically across whatever the current value is — not a specific literal, which will itself go stale and either need constant upkeep or get quietly skip-listed as "drift" and stop actually checking anything. If a hardcoded literal is truly unavoidable (e.g. a genuinely fixed structural constant), that's a signal the literal itself, not the test, deserves a comment explaining why it won't drift.
- Narrower sibling of R267 ("current"-labeled rolling aggregations must anchor windows to the newest observation) — both are about mechanical date/window/value math silently producing a plausible-looking but wrong result (or a plausible-looking but wrong *test*) when a hidden anchoring requirement isn't carried through.
- See P604 (original NFP case), P627 (eight-test generalization: breadth SMA seeds, KR/US macro sanity bands, FOMC/NFP/CPI/PCE calendar, semver format, Telegram digest content/dates/page-map).
- See P604/BUG-POSTMORTEM.md.

## R278. A `workflow_run`-triggered job that needs the commit its trigger produced must checkout `head_branch`, not `head_sha` (v52.5)

> **Superseded for release workflows by R536/P973.** `head_branch` repaired the one-cycle lag but introduced a mutable-branch race. Current refresh jobs dispatch the exact produced SHA to CI, and Pages consumes the CI attestation. The text below is retained as the historical failure explanation, not current deployment guidance.

- `github.event.workflow_run.head_sha` is fixed to the head of the triggering workflow's branch **at the moment that workflow started** — not any commit it committed/pushed during its own run. A downstream job that does `actions/checkout@v4` with `ref: ${{ github.event.workflow_run.head_sha }}` in order to validate or deploy "what the triggering run just produced" will instead always get the commit that existed *before* that run's own work — one full cycle behind, indefinitely, on every single firing.
- If the triggering workflow's own job is a commit-and-push job (a bot/data-refresh workflow) and a downstream `workflow_run` job needs that pushed commit, checkout `ref: ${{ github.event.workflow_run.head_branch }}` instead (the branch name, e.g. `main`) — this resolves to the actual current head of that branch at checkout time, which by the time the `workflow_run` event has fired already includes the push. Guard it so `push`/`pull_request`/`workflow_dispatch` paths (which have no `workflow_run` payload) keep their existing behavior: `${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_branch || github.sha }}`.
- A validate/deploy job silently running on the wrong tree is worse than it failing loudly: the run goes green, any redeployed artifact's `Last-Modified` timestamp updates, and nothing in the job's own log looks wrong unless someone specifically diffs the checked-out SHA against the commit the triggering run actually pushed.
- See P602/BUG-POSTMORTEM.md and `_context/FABLE-LIVE-AUDIT-2026-07-04.md` P0: this exact pattern in `ci.yml`'s three jobs (validate/headless-tests/deploy) meant every bot data-refresh cycle had its CI validate and its live deploy carry the *previous* cycle's tree — live `data.json` got a fresh deploy timestamp with stale content on every cycle since R272/P591 wired up the `workflow_run` chain.

## R277. An external deploy/publish action known to fail transiently must retry once in the same job, not rely on the next scheduled cycle to self-heal (v52.4)
## R276. New code needing current market/risk/regime/breadth/cycle condition must consume `window.AIO.marketState`, not re-derive it independently (v52.3)

- `window.AIO.computeMarketState()` (js/aio-core.js:2728-2823) is the single synthesis point for derived market condition — it composes `_aioRegimeNow()` + `getCycleFromMacro()` + `diagnoseBreadthConsensus()` + `AIO_ACTION_RULES.getActionPlan()` + news sentiment (`_aioComputeNewsSignal()`) into one `window.AIO.marketState` object and dispatches `aio:marketStateUpdated`, throttled to once per 2s, whenever any input could have changed (`aio:liveQuotes`/`aio:pageShown`/`aio:serverDataLoaded`/`aio:newsUpdated` all trigger a recompute).
- New code that needs any of `spx`/`vix`/`fg`/`vixBand(Label)`/`fgZone(Label)`/`cyclePhase`/`cycleScore`/`cycleFull`/`breadthConsensus`/`breadthScore`/`breadthConsensusFull`/`riskLevel`/`riskScore`/`dominantTopic`/`newsSignal`/`actionPlan`/`driftFromSnapshot` must read it from `window.AIO.marketState`, via one of the two patterns already established in the codebase — not by calling `_aioRegimeNow`/`getCycleFromMacro`/`diagnoseBreadthConsensus`/`AIO_ACTION_RULES` directly, and not by reading `window._liveData`/`DATA_SNAPSHOT`/`window._breadth*` raw globals to recompute an equivalent value:
  - **Subscribe** (re-render-on-change surfaces): `window.addEventListener('aio:marketStateUpdated', function(){ /* read window.AIO.marketState */ })` — see js/aio-ui.js:3849, js/aio-core.js:3057-3064 (fans out to 6 renderers: drift markers, action plan, breadth consensus, themes cycle, briefing action, options rec).
  - **Pull with fallback compute** (one-off reads inside another function): `window.AIO.marketState || (window.AIO.computeMarketState && window.AIO.computeMarketState())` — see js/aio-core.js:2843 (`synthesizeMarketAnalysis`).
- If a genuinely new derived market signal is needed that `computeMarketState` doesn't yet produce, extend `computeMarketState` itself to add the field — do not add a parallel independent computation for it elsewhere.
- Non-goal: this does not require migrating the codebase's existing ~4,688 `window.*` references (re-measured 2026-07-04; up from Fable's 2026-07-02 baseline of ~3,371, consistent with Phase 3 [A3] relocating a globals-dense 273-line block into aio-core.js). That migration is out of one-session scope and tracked as chronic/long-term in `_context/FABLE-SYSTEM-DIAGNOSIS-2026-07-02.md` §A4 — this rule is a forward-looking guard for new code only.
- Out of scope: purely local/one-off UI state unrelated to shared market conditions (e.g. a dropdown's open/closed flag) is not what this rule targets.
- Complements R244 (an already-displayed value must not be independently recomputed per surface — a display-consistency rule): R276 is the more general source-discipline rule — don't create a new independent computation path in the first place, regardless of whether the value is already displayed elsewhere.
- See P600/BUG-POSTMORTEM.md.
- **Additional precedent (P606/v52.9)**: themes page's top-right cycle chip computed its own independent `defCount`/`cycCount` sector-leadership heuristic while the same page's body (`_aioRenderThemesCycle`) already read the correct source (`marketState.cycleFull`/`getCycleFromMacro`) — the two silently disagreed on-screen. Fixed by pointing the chip at the same source instead of a parallel heuristic. Pre-dated this rule's own introduction (v52.3), which is exactly the kind of older UI code this rule exists to catch when next touched.

## R275. A shared global object populated by multiple files must always be merged, never plainly overwritten — even if today's load order happens to make it safe (v51.99)
## R274. A live-fetch binding introduced for an existing labeled/thresholded field must fetch the exact same named indicator the label represents — not a same-topic substitute (v51.97)
## R273. A value that's supposed to mirror or track another value must be verified equal by evaluating both, not by eyeballing the diff — and duplicate/mirror fields must be named to be found (v51.96)
## R272. A bot/Action-authored push using the default `GITHUB_TOKEN` never triggers other `on: push` workflows — chain via `workflow_run` instead, not `[skip ci]` removal alone (v51.95)
## R271. After editing `SCREENER_DB` (js/aio-data.js), always re-run `scripts/sync-screener-universe.mjs` before committing (v51.94)
## R270. A third-party data source's availability and symbol convention must be live-verified, never assumed from a report or general knowledge — and an integration must be scoped down to only the asset classes actually confirmed (v51.92)
## R269. A CI job that whitelists known-failing tests must classify each entry by cause, and adding to the whitelist is only valid right after a fresh, real measurement (v51.91)
## R268. Combining sub-signals of different natural scale into one factor requires normalizing each first (v51.89)
## R267. "Current"-labeled rolling aggregations must anchor windows to the newest observation (v51.88)
## R266. When a measured value and a proxy heuristic coexist, consumers must prefer the measurement — and fetchers must store measurements consumably (v51.88)
## R265. Code that claims parity with a named external tool/methodology must match that source's exact definition, verified by recomputation (v51.86)
## R264. An API key in a URL must never be routed through a third-party proxy; a "sensitive URL" guard must block the egress, not just caching (v51.85)
## R263. Every producer of deployable artifacts must actually trigger the deploy path, and the watchdog must verify the DEPLOYED surface, not just the repo (v51.84)
## R262. Scheduled scrapers/fetchers hitting external feeds must self-throttle with a persisted cursor, not stateless full re-scans (v51.83)

- Any scheduled fetch script that walks a paginated external feed (especially an unofficial one, like Telegram's public web mirror) must persist a cursor (last-seen id/timestamp) between runs and use it to stop early once caught up, rather than re-walking the entire window from scratch every cycle.
- If the output artifact only persists a capped/filtered summary (not the full raw item list), carry forward and merge that summary with freshly-fetched items before recomputing derived fields — an early-stopped fetch must not silently shrink what the app actually consumes.
- `fetch-telegram-digest.mjs`'s `lastPostId` cursor + `topItems`/`broadItems` merge pool is the concrete precedent.
- See P571/BUG-POSTMORTEM.md for the incident (48 full-window re-scans/day of an unofficial scraping surface with zero throttle).

## R261. A "single responsibility" canonical updater must include every DOM sink for its metric (v51.83)

- When a function is documented as the single canonical place that updates all DOM sinks for a metric, any new sibling element added later to display that same metric must be added to that function's sink list in the same change. A forgotten sink silently freezes at its static HTML placeholder forever while the rest of the metric's displays update live.
- `_applyFearGreedScore()`'s sink list (`big`, `val`, `homeFG`, `rat` — js/aio-data.js) is the concrete precedent.
- See P570/BUG-POSTMORTEM.md for the incident (two different F&G numbers on the same sentiment-page card).
- **Additional precedent (P607/v52.10)**: briefing's and signal's own F&G pills didn't even read the wrong-but-existing sink — they read `window._fearGreedValue`, a global never assigned anywhere in the codebase (permanently `undefined`, copy-pasted into two separate pages), instead of the real live-maintained `window._lastFG`. A variant of "forgotten sink": here the sink element existed and was wired to *a* variable, just not the correct one — same failure mode (frozen at placeholder forever) via a different mistake (wrong identifier instead of no call at all).

## R259. Re-registerable event listeners must guard against duplicate registration consistently across sibling elements (v51.83)
## R260. A function must never be redefined more than once at the same scope in the same file (v51.83)
## R258. A hardening measure added to one surface must be checked against equivalent surfaces (v51.83)
## R257. Persisted-and-later-rendered free text needs both input-boundary validation and escaped render (v51.83)
## R256. Every external data source in the fetch pipeline must track per-unit failures, not just an aggregate ok flag (v51.83)
## R255. Automated workflows pushing to a shared branch must rebase/retry on rejection, never push-once-and-drop (v51.83)
## R254. External classification tags are not ground truth without independent keyword support, and AI prompts must verify tag-content consistency (v51.83)
## R253. Multiple DOM bindings for the same metric must share one resolver, not independently-ordered fallback chains (v51.83)
## R252. A static/curated list overlaid with live per-item data must flag contradictions, not silently keep them (v51.83)
## R251. XBRL/multi-source financial data must resolve to the freshest tag and validated period, and refresh handlers must have a real data source (v51.83)
## R250. A shared cross-page renderer must resolve each page's own parameters, not one hardcoded default (v51.83)
## R249. Externally-sourced text must be escaped at the pipeline entry point, not at each render call site (v51.83)
## R248. Deployment must be wired to the CI gate, not merely run alongside it (v51.82)

- If a CI workflow exists specifically to catch bad states before they reach users, the deployment mechanism must actually depend on it (e.g. a `deploy` job with `needs: validate`), not run through an independent, unaware path (e.g. legacy branch-based GitHub Pages, which deploys on push regardless of workflow outcome).
- If a report-only test job becomes fully green and its skip-list is emptied, promote it to a real deploy gate in the same release: remove `continue-on-error` and add it to `deploy.needs`. Leaving a 922/922 suite as report-only is the same failure mode as an unwired gate, just one step less obvious.
- Verify this after any deployment/CI config change: push a commit, confirm the deploy job only runs after validate succeeds, and confirm `gh api repos/{owner}/{repo}/pages` reports `build_type: "workflow"` (not `"legacy"`).
- When migrating from legacy branch-deploy to an Actions-based `deploy-pages` job, the artifact staging step must reproduce whatever exclusions the legacy path silently applied (Jekyll's default dot/underscore exclusion here) — `actions/upload-pages-artifact` performs no such filtering itself, so a naive `path: '.'` would newly publish previously-hidden internal directories.
- See P557/BUG-POSTMORTEM.md for the incident (Pages deployed live regardless of the 33%-failing CI gate).

## R247. CDN/script load-failure detection must not race against `defer` (v51.82)
## R246. Version-bump commits must land atomically; never leave main in a partially-synced state (v51.82)
## R245. Prioritized/boosted content selection must guarantee its picks already ran through required enrichment (v51.82)

- If a display surface reorders or filters a list by an importance/boost score, it must not assume the enrichment (translation, scoring, tagging) a normal reader would need was already applied — enrichment pipelines that process "the first N items in fetch order" or "items visible via a specific DOM marker" do not automatically cover an independently-selected top-N-by-importance subset.
- Any such surface must check whether its selected items already carry the required enrichment and, if not, trigger it directly for exactly those items rather than relying on a generic/lazy mechanism that may never reach them.
- `renderHomeFeed()`'s "핵심 뉴스" catch-up translation call (js/aio-data.js, guarded by `_tcHas`/`_translationInProgress`) is the concrete precedent.
- See P554/BUG-POSTMORTEM.md for the incident (home page's boosted Tier-1/geopolitical headlines were exactly the ones permanently stuck on "[번역 대기]").
- v52.6/P603 update: this rule was only ever applied to `renderHomeFeed` — nine other independently-selected news surfaces built afterward (`_aioRenderPageNewsStrip`, shared by 8 pages' topic-filtered strips; `renderBriefingFeed`'s own score/window selection; `_aioRenderBriefingDigest`'s Top3) each had the exact same gap and sat permanently on "[번역 대기]" until fixed. When adding or reviewing ANY surface that independently selects/filters/sorts a subset of `newsCache` for display (not just "boosted" ones — topic-tag filters count too), check it against this rule, not just against whatever the most recent fixed example was.

## R244. A live-state value shown in multiple UI surfaces must not be computed independently per surface (v51.82)
## R243. Portfolio UX must close input -> AI analysis -> journal reflection -> learning loop (v51.80)
## R242. Portfolio backtests must expose assumptions, monthly construction, drawdown recovery, and active risk (v51.79)
## R241. Public readiness must expose page-level source/asOf, not only aggregate status (v51.78)
## R240. User-supplied trader frameworks must be centralized as REFERENCE, not live levels (v51.77)
## R239. External-share readiness must be visible on the default home path (v51.76, P551)
## R238. Page currentness must be source-capped before visible decisions (v51.74, P549)
## R237. Skills must use one canonical router-plus-reference tree; assistant-specific roots are generated mirrors, never independent instructions (v53.96, P894)
## R236. Skills, command wrappers, references, encoding sentinels, and any materialized local mirror must be contract-gated (v53.96, P894)
## R235. calcTechnicalSnapshot fields must close producer-consumer-artifact-gate together (v51.71, P548)
## R234. 신규 UI 블록은 검증 전까지 기본값 hidden (v51.64, P545 예방)
## R233. Ticker technical analysis must prioritize Minervini price/MA/volume/supply logic (v51.45, P536)
## R232. Cross-asset trading factors must use comparable scales (v51.44, P535)

- Screener, rank, and backtest factors that compare stocks across currencies, nominal price levels, or split histories must use returns, log prices, ratios, z-scores, or explicitly versioned normalized units. Raw price-unit velocity is not acceptable for cross-sectional ranking.
- Public-data enrichment must carry a scale/version marker for derived factors whose meaning can change, such as `kalmanScale: "log_pct_day"`. Runtime consumers must merge those fields only when the expected marker is present.
- Trading score copy must distinguish "market is favorable" from "buy aggressively now". `75+` can mean buy-friendly conditions, but visible/chat guidance must still mention position sizing, staged entry, invalidation price, or event risk.
- Backtest summaries must be described as factor sanity/IC checks unless they include walk-forward portfolio construction, transaction costs, slippage, survivorship controls, and execution constraints.
- `scripts/ci-data-pipeline-contract-check.mjs` and `scripts/ci-runtime-contract-check.mjs` are the regression gates for this rule.

## R231. Visual hierarchy must not be locked to the old Bloomberg-terminal premise (v51.43, P534)

- A page is not clean just because the runtime works and the default-route noise is hidden. The first viewport must make the primary decision, next action, data confidence, and most important note visually distinct from ordinary widgets.
- Do not preserve Bloomberg-terminal styling as a constraint when it weakens readability. Dense market data is acceptable, but repeated cyan accents, identical dark cards, negative letter spacing, and long first-screen prose must be reduced when they flatten priority.
- Operator-facing session notes are priority context, but long notes must render as a scan-ready title/lead with the full memo available behind an intentional expansion control.
- KR and secondary pages must follow the same decision-first hierarchy as US/global pages. Legacy intro boxes, status chip bars, and educational prose must not appear above the page decision card unless they are the current primary action.
- Visual hierarchy changes must be closed by a gate or checklist that checks the actual structural markers, not only screenshots or subjective notes.

## R226. Server news backstop must rank by market impact, not arrival order (v50.98)
## R228. Default-route UX must remove collapsed noise and avoid empty grid tracks (v51.30, P529)

- Collapsed `<details>` is not a sufficient cleanup for explanation-only or advanced-framework content on a default route. If a block is not directly actionable in the current session, remove it from the visible path or keep only a hidden legacy sink when runtime/tests still reference an ID.
- Removing content from a default route does not mean deleting the investment logic. Core formulas, decision flows, and framework explanations must be compressed into the guide/methodology reference or another deliberate secondary surface.
- Finite user-facing card groups such as 3 decision cards or 6 snapshot cards must not use CSS `auto-fill`; use `auto-fit` or explicit responsive columns so empty tracks collapse instead of creating large right-side blank space.
- A page should not put long secondary rails such as subcomponent lists, crypto widgets, or framework explanations beside a short primary chart if it creates a tall left column and blank right column. Promote the content to a balanced full-width section or remove it from the default path.
- Operator-facing session notes are priority context, not secondary decoration: if visible, the home operator note must appear before the decision/header flow with readable first-viewport typography.
- Hidden legacy sinks retained for runtime/test compatibility must not be wrapped by default-route folding helpers or reintroduced as visible collapsed rows.
- QA for UI/UX changes must inspect actual user screenshots or viewport captures for visual value density, not only `scrollWidth/clientWidth`.
- `scripts/ci-ux-default-path-check.mjs` must stay wired into CI and must fail if default routes regain visible analysis-flow summaries, duplicate diagnostic widgets, `auto-fill` finite card grids, or lose the guide methodology reference.

## R229. Scheduled workflow embedded scripts must be syntax-gated (v51.30, P530)
## R230. Default-path numeric renderers must be partial-data safe (v51.42, P533)

- Live/default-path renderers must not call `.toFixed()` directly on nested live, scenario, chart, or event-context fields. Normalize through `Number(...)` plus `Number.isFinite(...)`, or use `window._aioSafeFixed()`.
- Treat `_liveData`, public-data JSON, scenario registry outputs, Chart.js tooltip payloads, and event-context objects as partial until proven otherwise.
- `scripts/ci-runtime-contract-check.mjs` must fail if unsafe direct patterns such as `live.price.toFixed`, `sumCheck.sum.toFixed`, or `ctx.parsed.y.toFixed` return.

## R225. News surfaces must provide Korean market rewrite, not translation-only headlines (v50.97)
## R224. Currentness and fallback data must be visible at the consumer surface (v50.96)
## R223. News translation must degrade to Korean insight, not raw English-only context (v50.95)
## R222. Public-data pipelines require an Actions-to-consumer contract gate (v50.94)

- Market/news auto-refresh is complete only when the path is contract-tested end to end: GitHub Actions schedule -> fetch script -> committed `public-data/*.json` artifact -> runtime loader -> runtime audit -> visible/chat/memo consumer.
- `data-watchdog.yml` must fail on stale or too-thin core artifacts, not only malformed JSON. Minimum floors: `symbolsOk >= 70`, `newsCount >= 10`, Telegram digest `count >= 100` and at least 2 channels.
- Optional services that depend on secrets (FRED, LLM market analysis, FMP fundamentals) may degrade without failing the site, but their status must be visible in `AIO.getDataPipelineAudit().layers.sources.publicData`.
- `scripts/ci-data-pipeline-contract-check.mjs` is the static gate for this rule and must be run by CI.

## R221. Telegram/news auto-refresh must close the ticker memo consumer path (v50.93)
## R165. AIO_TICKER_NAME_REGISTRY 의미적 정확성 + 한글 별명 일관성 의무 (v49.80 Codex)
## R166. AIO_THEME_SEMANTIC_EXCLUSION_RULES 의미적 misfit 배제 의무 (v49.80 Codex)
## R159. ticker / options context는 _currentTickerId null + _liveData 미수신 양쪽 가드 의무 (v49.79)
## R160. kr-macro 정적 데이터 / 시점 토큰 진입부 staleness 경고 의무 (v49.79)
## R161. localStorage QuotaExceededError 강화 처리 + 사용자 toast 의무 (v49.79)
## R162. 외부 fetch 결과 schema 검증 + graceful degrade 의무 (v49.79)
## R163. 멀티탭 localStorage storage 이벤트 리스너 의무 (v49.79)
## R164. Claude API 호출 토큰 사용량 누적 추적 + 비용 가시화 의무 (v49.79)
## R156. 외부 fetch 폴백 chain은 sequential 금지, Promise.race 병렬 의무 (v49.78 코드 단위 진단)
## R157. innerHTML 호출 전 _aioSafeMD fallback chain 의무 (v49.78)
## R158. chatSend atomic streaming lock — 입력 검증 통과 직후 즉시 (v49.78)
## R153. chatSend silent return 모든 경로 사용자 피드백 의무 (v49.77)
## R154. callClaude 최종 실패 시 friendly 안내 + 자가 진단 가이드 (v49.77)
## R155. 데이터 ✗ / 환각 검출 시 답변 위 액션 버튼 배너 의무 (v49.77)
## R151. 시세 데이터 ✗ 시 답변에 가격 수치 절대 금지 — HARD STOP (v49.76)
## R152. 모바일 채팅 레이아웃 100vw 비율 의무 (v49.76)
## R147. CHAT_CONTEXTS 등록은 DOM 패널과 항상 쌍 (Pattern A 일반화) (v49.75)
## R148. ABSOLUTE RULES는 system prompt 정의 + 답변 후처리 양쪽 의무 (Pattern B 일반화) (v49.75)
## R149. 외부 fetch 실패는 사용자 ❌ 라벨로 surfacing 의무 (Pattern C 일반화) (v49.75)
## R150. AI 답변에 등장한 날짜 토큰은 세션 시각 대비 stale 자동 검출 (Pattern D 일반화) (v49.75)
## R145. AI 답변에 학습 데이터 자기 인용 + 시점 환각 절대 금지 (v49.74 hotfix)
## R146. home 페이지 인라인 채팅 패널 의무 (v49.74 hotfix)
## R143. AI 답변 품질 audit는 11 페이지 평가 의무 (KR 4 페이지 포함) (v49.74)
## R144. AI 채팅 멀티턴 윈도잉 + 요약 prepend 의무 (v49.74)
## R140. AI 답변에서 정성 표현 사용 시 정량 근거 1개 이상 괄호 동반 의무 (v49.73)
## R141. AI 답변 표준 4 구조 강제 (결론/정량/시나리오/액션) (v49.73)
## R142. 모든 정량 인용 시 (출처 · 기준일) 괄호 필수 (v49.73)
## R138. fundamental 종목 검색 시 7 차트 자동 렌더 의무 (v49.72)
## R139. AI 채팅 답변에 종목 detect 시 "📊 차트 보기" 버튼 자동 삽입 의무 (v49.72)
## R135. 4/5차는 감사 함수만으로 완료 금지
## 📋 작업 전 필수 체크

### 1. 이 폴더 구조 확인 (v48.79+ 모듈화 후)
```
_context/                              ← 지식 베이스 (유일한 진실의 원천)
├── RULES.md                           ← 지금 이 파일 (마스터 룰, 가장 먼저 읽기)
├── BUG-POSTMORTEM.md                  ← 버그 사후 분석 누적 로그 (매 수정 후 기록)
├── QA-CHECKLIST.md                    ← 실행 가능한 QA 체크리스트 v3.3
├── KNOWLEDGE-BASE.md                  ← 기술 인사이트 축적 (R26)
├── CODE-MAP.md                        ← index.html + js 모듈 line 범위 맵 (부분 읽기 가이드)
├── WORKTREE-AUDIT.md                  ← GitHub/live/worktree 라우팅 + 미배포 작업 인벤토리
├── INDEX.md                           ← 지식 베이스 자동 인덱스 (R24)
└── CLAUDE.md                          ← _context/ 컨텍스트 + 파일 구조

루트/
├── CLAUDE.md                          ← 프로젝트 가이드
├── CHANGELOG.md                       ← 버전별 변경 이력
├── index.html + version.json          ← HTML shell + 버전 메타
└── js/                                ← aio-core/data/ui/chat/glossary 모듈
```

### 2. 작업 유형별 반드시 읽을 파일

| 작업 유형 | 읽을 파일 |
|-----------|-----------|
| **index.html 수정** | **CODE-MAP.md → 해당 line 범위만 Read** |
| 버그 수정 | RULES.md → BUG-POSTMORTEM.md → CODE-MAP.md → QA-CHECKLIST.md |
| 새 기능 추가 | RULES.md → CODE-MAP.md → WORKTREE-AUDIT.md(배포/워크트리 영향 시) |
| QA/점검 요청 | RULES.md → BUG-POSTMORTEM.md → QA-CHECKLIST.md |
| 리팩토링/개편 | RULES.md → BUG-POSTMORTEM.md → CODE-MAP.md |
| 버전 릴리스 | RULES.md(R1~R2) → CHANGELOG.md → WORKTREE-AUDIT.md(배포 상태 기록) |
| 지식 린팅 | RULES.md(R19~R20) → `/knowledge-lint` |

---

## 🔴 절대 규칙 (위반 시 무조건 재작업)

### R1. 버전 동기화 (7곳 필수)
버전 변경 시 반드시 **7곳 모두** 동일한 버전 문자열인지 확인:
1. `<title>` 태그 — `AIO Screener v{버전} — 올인원 투자 터미널`
2. `#app-version-badge` — HTML 내 인라인 텍스트
3. `version.json` → `version` 필드
4. `_context/CLAUDE.md` → `현재 버전:` 행
5. `CHANGELOG.md` → 최상단 항목의 버전 번호
6. **`const APP_VERSION`** — JS 상수 (`js/aio-core.js`). 이 값이 title과 badge를 JS에서 덮어씀. 놓치면 HTML은 v38.4인데 화면에 v38.3 표시
7. **`SW_VERSION`** — Service Worker 캐시 네임스페이스 (`sw.js`). 놓치면 새 배포 후에도 구버전 shell/data cache가 남을 수 있음.
8. **JS cachebusters** — `index.html`의 `./js/aio-*.js?v=` 값은 `version.json.version`의 숫자 부분과 반드시 일치해야 한다. CI는 5개 cachebuster를 모두 검사한다.

> ⚠️ **v48.80 사고**: SW_VERSION이 v48.66에 머물러 stale cache 회전이 지연될 수 있었음. APP_VERSION과 SW_VERSION은 함께 동기화할 것.

확인 명령:
```bash
grep '<title>' index.html | head -1
grep 'app-version-badge' index.html | grep -o '>v[^<]*<'
grep 'APP_VERSION' js/aio-core.js | head -1
grep 'SW_VERSION' sw.js | head -1
cat version.json | grep version
grep '현재 버전' _context/CLAUDE.md
head -20 CHANGELOG.md | grep '## v'
grep -o '\?v=[0-9.]*' index.html | sort -u
```

### R1-A. GitHub 배포 후 브라우저 버전 확인 (필수)
코드를 GitHub에 업로드한 뒤, **반드시 라이브 사이트에서 브라우저 캐시 무시 새로고침** 후 확인:
1. 브라우저 탭 제목(`<title>`)에 올바른 버전이 표시되는가
2. 페이지 상단 `#app-version-badge`에 올바른 버전이 표시되는가
3. `version.json` 직접 접속(`/version.json`)으로 올바른 버전이 반환되는가

> **파일 버전 ≠ 브라우저 버전** 불일치의 흔한 원인:
> - GitHub Pages 캐시 (배포 후 1~5분 지연)
> - 브라우저 캐시 (Ctrl+Shift+R 또는 DevTools > Network > Disable cache)
> - 업로드 누락 (index.html만 올리고 version.json 미업로드, 또는 그 반대)
> - JS에서 `updateQuotaBadge()` 등이 badge 텍스트를 런타임에 덮어쓰는 경우

### R2. 버전 체계
- 현재 체계는 `v{major}.{patch}` 숫자 단조 증가: v48.77 → v48.78 → v48.79
- patch는 한 자리/두 자리 모두 허용한다. 숫자 비교로만 최신 여부를 판단하고, 문자열 사전순 비교는 금지한다.

### R3. 버그 수정 시 사후 분석 필수
모든 버그 수정 후 `BUG-POSTMORTEM.md`에 아래 형식으로 추가:
```
## [날짜] v{버전} — {버그 제목}
- **증상**: 사용자가 본 문제
- **근본 원인**: 왜 발생했나
- **놓친 이유**: 왜 기존 점검에서 못 잡았나
- **수정 내용**: 무엇을 바꿨나
- **예방 규칙**: 다음에 같은 유형 방지하려면
- **QA 체크리스트 추가 항목**: (있으면)
```

### R4. 동적 DOM 삽입 주의
### R5. CSS overflow 3중 방어
### R6. LLM 응답 렌더링 안전장치
### R7. 한국어 텍스트 레이아웃 검증 (v31.9 추가)
### R8. 차트 카드 텍스트 폴백 필수 (v31.9 추가)
### R10. 종목코드 입력 시 3중 검증 필수 (v35.6 추가)
신규 종목 추가 시 반드시 아래 3단계 모두 통과해야 DB에 코드 입력 가능:
1. **Yahoo Finance quote 페이지에서 공식 회사명 확인** — DB 등록명과 일치해야 함 (269620="Syswork" ≠ "레인보우로보틱스" 사례)
2. **가격/시총 범위 합리성 확인** — 해당 기업 규모와 가격대가 맞는지 (코스맥스 ODM 1위인데 9,520원 소형주 → 자회사 오매핑)
3. **비상장 여부 확인** — 네이버증권/KRX에서 "비상장"/"장외" 표기 시 코드 할당 금지 (두나무=비상장 사례)

### R11. 비상장 기업 코드 할당 금지 (v35.6 추가)
Yahoo Finance가 가격을 반환해도 해당 기업이 실제 상장사인지 확인해야 함. 비상장 기업의 이름을 상장 코드에 매핑하면 **전혀 다른 회사의 데이터**가 해당 이름으로 표시됨 (P18 Ghost Stock).

### R12. 유사 이름 모자회사 구분 (v35.6 추가)
검색 시 동일/유사 이름이 복수 나오면(예: 코스맥스/코스맥스BTI), 각각의 정식 종목명·코드·시총·사업내용을 대조하여 본사/자회사 구분 후 올바른 코드 선택 (P19 Parent-Sub Confusion).

### R13. CHAT_CONTEXTS 이원화 필수 (v37.5 추가)
### R14. 뉴스 키워드 현행화 (v37.6 추가)
### R9. Dead Page 방지 — 페이지 3종 세트 + init 가드 리셋 필수 (v31.10 추가, v42.1 강화)
- 새 페이지(`page-xxx`) 추가 시 반드시 **3종 세트** 구현:
  1. **init 함수** (`initXxxPage()`) — 데이터 로드 + DOM 업데이트
  2. **`aio:pageShown` 리스너** — 페이지 진입 시 init 호출
  3. **`aio:liveQuotes` 리스너** — 실시간 데이터 갱신 시 활성 페이지면 업데이트
- HTML만 있고 JS init이 없으면 하드코딩 데이터가 영구적으로 표시되는 Dead Page가 됨
- 정적 페이지(guide)는 예외이나, 동적 데이터가 하나라도 있으면 반드시 적용
- **[3회 위반 강화]** init 가드(`if (xxxInitialized) return;`) 사용 시 `destroyPageCharts()`에 반드시 `xxxInitialized = false` 리셋 추가. 누락 시 페이지 재진입 불가 (P28)
- **[3회 위반 강화]** `setInterval` 추가 시 반드시 `destroyPageCharts()`에 대응 `clearInterval` 추가 (P27). 타이머 미해제 = 좀비 프로세스
- **[v48.69 4차 강화]** 전역 연속 타이머(모듈 최상위 레벨)도 반드시 ID를 전역 변수에 저장할 것:
  ```javascript
  // 금지
  setInterval(fn, 15*60*1000);
  // 올바른 패턴
  if (window._myTimer) clearInterval(window._myTimer);
  window._myTimer = setInterval(fn, 15*60*1000);
  ```
- 검증: `grep -n 'setInterval(' js/*.js | grep -v 'clearInterval\|_.*=\s*setInterval\|window\._.*=\s*setInterval'` → 0건 기대

### R15. 데이터 미수신 vs 진짜 0% 구분 필수 (v38.3 추가, P25, v42.1 강화)
- `d.pct || 0` 패턴은 **데이터 없음**과 **진짜 0% 변동**을 구분할 수 없으므로 금지
- 반드시 `d && d.price != null && d.pct != null` 명시적 null 체크 후, 미수신 시 "—" 표시
- **[3회 위반 강화]** 코드 수정 후 `grep '|| 0' index.html | grep -i 'pct\|change\|percent'` 실행하여 잔존 패턴 스캔 필수
- **[3회 위반 강화]** `|| 숫자` 폴백은 0이 유효값인 모든 필드(pct, change, breadth %)에서 사용 금지. `!= null ? val : fallback` 패턴 사용
- 새 UI 섹션(카드, 그리드, 테이블) 추가 시 반드시 점검:
  1. 클릭/인터랙션 핸들러 구현 여부
  2. `aio:liveQuotes` 자동 갱신 연결 여부
  3. 상세 패널(detail panel)이 열려있을 때 자동 갱신 포함 여부

### R16. 뉴스 티커 표시 규칙 (v39.0 추가, P30)
- 매크로/지정학/정책/금리/무역 토픽(`macro`,`geopolitics`,`policy`,`fed`,`rates`,`trade`) 뉴스에는 **티커 숨김**
- 기업/실적/섹터/일반 토픽 뉴스에만 관련 종목 티커 표시
- `isCompanyNews()`를 티커 표시 판단에 쓰지 말 것 (토픽 분류가 부정확할 수 있음 — general로 분류된 매크로 뉴스에 ETF 티커 붙는 문제)
- 홈 핵심뉴스, 시장 뉴스(renderFeed), 데일리 브리핑(renderBriefingFeed) 3곳 모두 동일 기준 적용

### R17. 뉴스 키워드 추가 시 길이 제한 (v39.0 추가, P28, v42.1 강화, v42.5 재정의)
- **영어 키워드**: 3글자 미만 단독 키워드 추가 금지 (오탐 원인 — `'S'` 한 글자로 모든 텍스트 매칭 사고 발생)
- **한국어 키워드**: 2글자 도메인 특화 용어(`'금리'`, `'물가'`, `'고용'` 등)는 허용 — 한국어 금융 도메인에서 오탐 위험보다 누락 위험이 큼. 단, **1글자 한국어 단독 키워드는 금지** (예: `'팹'`)
- 티커 매칭은 `extractTickers()`에서 word boundary(`\b`)로 처리해야 함
- 키워드 추가 후 반드시 비금융 텍스트("약물 운전 STOP" 등)로 오탐 테스트
- **[4회 위반 강화]** 약어(QE, AI, EV 등)는 full form이 이미 존재하면 추가 금지. 약어가 반드시 필요한 경우 복합 패턴으로 구체화
- **[v42.5 교훈]** 키워드 제거는 누락 위험이 큼 — 선별 로직 강화가 우선, 키워드 제거는 최후 수단

### R18. 텔레그램 채널 관리 (v39.0 추가, P29)
### R19. _context/ 지식 정합성 린팅 (v40.4 추가)
### R20. 에이전트 산출물 검증 상태 관리 (v40.4 추가)
### R21. 하드코딩 차트 데이터 경과일 관리 (v40.4 추가, P31)
- 차트 데이터(VIX/NAAIM/AAII/브레드쓰 등)는 `DATA_SNAPSHOT._updated`와 함께 관리
- 3일+ 경과 시 `renderStaleWarning()` 경고 배지 자동 표시
- 동적 전환 가능한 데이터(VIX/HYG/SPY/QQQ)는 Yahoo Finance API로 자동 교체, 하드코딩은 폴백으로만

### R22. 뉴스 3곳 계층적 선별 체계 (v40.4 추가, P32)
- **홈 핵심**: 정적 큐레이션 (`HOME_WEEKLY_NEWS`), 시장 전체 핵심 2~3건
- **브리핑**: score 45+, 5~20건, 20건 초과 시 score 우선 선별 → 시간순 재정렬
- **시장 뉴스**: score 30+, 150건 상한, 48h, 시간순 (광범위)
- scoreItem()에 5대 토픽 부스트(매크로/지정학/주식/외환/채권) + 비시장 정치 감점(-25) 필수

### R23. 외국 기업(ADR) 재무 파싱 (v40.4 추가, P33)
### R24. _context/ 인덱스 자동 관리 (v41.6 추가)
- `_context/INDEX.md`는 지식 베이스 전체 문서의 역할, 상태, 연결 관계를 기록하는 자동 인덱스
- `/knowledge-lint` 실행 시 L6 단계에서 자동 갱신 (신규 파일 추가, 삭제된 파일 제거, 갱신일/신뢰도 동기화)
- 현재 버전 대비 10+ 버전 차이 문서는 "정리 대상 후보"로 자동 식별

### R25. 버그 역참조 체계 (v41.6 추가)
- BUG-POSTMORTEM.md 각 버그 항목에 `violated_rule: R{N}` 태그 필수 기록
- 신규 규칙 위반이면 `violated_rule: 신규 ({카테고리})` 형식
- `/knowledge-lint` L7 단계에서 규칙별 위반 빈도 자동 집계 -- 3회 이상 위반 시 "규칙 강화 필요" 플래그
- 태그 누락 항목도 린팅에서 경고 보고

### R26. 기술 인사이트 환류 (v41.6 추가)
- 대화/작업 중 발견한 기술적 인사이트(API 동작, 브라우저 quirks, 라이브러리 패턴)는 `_context/KNOWLEDGE-BASE.md`에 축적
- BUG-POSTMORTEM이 "무엇이 고장났나"를 기록한다면, KNOWLEDGE-BASE는 "어떻게 동작하는가"를 기록
- 동일 인사이트 3회 이상 재발견 시 RULES.md 규칙 승격 검토
- 카테고리: API, 브라우저, Chart.js, DOM/CSS, JS 패턴, 데이터

### R27. Commands ↔ Skills 동기화 (v46.2 추가, P69 교훈)
- 새 스킬(`skills/xxx/SKILL.md`) 추가 시 **반드시** `commands/xxx.md` wrapper도 동시 생성
- wrapper 없으면 `/xxx` 자동완성에 안 나옴 → 사용자가 스킬 존재 자체를 모름 (silent omission)
- CHAT_CONTEXTS에 새 페이지 컨텍스트 추가 시 **반드시** `_aiCtxMap` + `_aiDefaultChips`에도 동시 매핑
- 매핑 없으면 통합 AI 패널에서 해당 페이지 진입 시 컨텍스트 자동 전환 안 됨 → silent failure
- 검증: `ls .claude/commands/*.md | wc -l` == skills 폴더 수 + 인라인 commands 수

### R28. 실제 클릭 테스트 필수 (v46.5 추가, P82 교훈)
### R29. AI 채팅 데이터 검증 태그 (v46.5 추가)
### R30. 지표 라벨/임계값 전역 통일 (v46.8 추가, P83~P104 교훈)
### R31. innerHTML XSS 전수 점검 (v46.8 추가, P100 교훈)
### R33. 데이터 Freshness 추적 의무화 — DATE_ENGINE + _markFetch + _aioFeedHealth (v48.39 추가, P133 교훈)
### R52. 외부 CDN 스크립트 SRI 의무 (v48.69 추가, P140 교훈, 구 R34 → R52 재번호)
### R53. 독립 병렬 fetch는 단일 실패 격리 (v48.69 추가, P143 교훈, 구 R35 → R53 재번호)
### R32. Event Delegation 의무화 — onclick 인라인 핸들러 금지 (v48.35 추가, P132 교훈)
## 🟡 점검 시 주의사항 (과거 실수에서 배운 것)

### CSS/레이아웃 패턴
1. **grid 내부에 동적 요소 삽입** → 레이아웃 파괴 (v31.2 시그널 배너 사건)
2. **overflow:hidden on parent** → 자식 콘텐츠 잘림 (v31.1 채팅 가로 텍스트)
3. **max-height 컨테이너** → 하단 여백 없으면 콘텐츠가 입력창에 가려짐
4. **white-space:nowrap 전파** → 부모의 nowrap이 자식까지 영향

### JS/데이터 패턴
5. **_ldSafe 미사용** → null/undefined에서 .toFixed() 등 호출 시 크래시
5b. **getElementById → stale DOM 참조** → HTML에 없는 ID를 JS에서 참조하면 항상 null → 기능 무동작 (P43). DOM ID 참조 추가 시 `grep 'id="해당ID"' index.html` 필수
6. **async 에러 미처리** → try-catch 누락 시 무한 로딩 상태
7. **타이머 중복** → setInterval 중복 등록 시 메모리 누수 + 성능 저하
8. **popstate 핸들러 누락** → 뒤로가기 시 차트/데이터 미갱신

### LLM/AI 패턴
9. **시스템 프롬프트 규칙 무시** → Claude가 테이블 생성 → 렌더링 깨짐
10. **스트리밍 중 DOM 조작** → innerHTML 반복 교체 시 깜빡임/메모리 누수

### 레이아웃/텍스트 패턴 (v31.9 추가)
11. **고정폭 grid 컬럼 + 한국어 텍스트** → 라틴 기준 설계된 셀에서 한국어 텍스트 오버플로우 (P7)
12. **CDN 지연 시 차트 미렌더링** → 텍스트 폴백 없으면 빈 카드 표시 (P8)
13. **반응형 미대응** → 768px/480px에서 grid 컬럼 축소 없으면 텍스트 겹침/잘림
14. **Dead Page** → HTML만 있고 init 함수/이벤트 리스너 없음 → 하드코딩 데이터 영구 표시 (P9)

### 기술 분석 엔진 패턴 (v32 추가)
15. **analyzeTickerDeep/analyzeKrTickerDeep DOM target** → 결과를 렌더할 target element ID가 실제 HTML div ID와 일치해야 함 (US: `#ticker-analysis-result`, KR: `#kr-ticker-analysis-result`)
16. **CF Worker 프록시 의존** → Yahoo Finance 차트 데이터는 CF Worker(aio-yahoo-proxy)를 통해 fetch. rate limit(기본 100 req/min) 초과 시 429 에러. 동시 분석 요청 수 제한 필요.
17. **지수 분석 자동 트리거** → `initKoreaTechnical()`은 pageShown 시 KOSPI/KOSDAQ 동시 fetch → 2개 동시 API 호출. 이미 분석 결과가 있으면 재호출 방지 (innerHTML 체크).

### 종목 데이터 무결성 패턴 (v35.6 추가)
18. **Phantom Ticker (P17)** → 종목코드 미검증 입력 시 Yahoo Finance가 **다른 회사의 정상 가격**을 반환 → 에러 없이 잘못된 데이터 유입 (269620 사례)
19. **Ghost Stock (P18)** → 비상장 기업 이름을 상장 코드에 매핑 → 전혀 다른 회사의 데이터가 해당 이름으로 표시 (294870 두나무 사례)
20. **Parent-Sub Confusion (P19)** → 유사 이름 모자회사 혼동 → 자회사 코드에 본사 이름 매핑 (044820 코스맥스BTI 사례)

---

## 📌 QA 요청 시 워크플로우

```
1. RULES.md 읽기
2. BUG-POSTMORTEM.md 읽기 (기존 패턴 파악)
3. QA-CHECKLIST.md 기반으로 점검 수행
4. 발견된 문제 수정
5. 수정한 문제마다 BUG-POSTMORTEM.md에 사후 분석 추가
6. 필요 시 QA-CHECKLIST.md에 새 항목 추가
7. 버전 동기화 확인 (R1)
```

---

## 세션 2026-04-04 신규 규칙 (P31~P38)

### P31. 데이터-UI 단일 진실 원천 (Single Source of Truth)
데이터(JS)와 UI(HTML)가 2곳에서 관리되면 반드시 한쪽을 제거. JS에서 동적 생성하여 불일치 근본 방지.

### P32. 종목 추가 시 상장 여부 확인 필수
KOSPI(.KS) / KOSDAQ(.KQ) 상장 확인. 비상장·장외 주식 추가 금지. 두나무(업비트) 같은 비상장 실수 반복 방지.

### P33. 테마 간 동일 종목 중복 배치 금지
자회사는 모회사 테마에서 커버. 예: 보스턴다이내믹스(현대차 자회사) → auto에서 커버, robot에 현대차 별도 배치 금지.

### P34. 테마 종목 비중 체계적 설정
(1) 시총 비례 (2) 독과점 구조 반영 (3) 대장주 비중 상향 (4) ETF 구성 크로스체크. 임의 감 배분 금지.

### P35. 데모/모의 데이터 라벨링 또는 제거
정적 모의 데이터는 `[DEMO]` 라벨 필수. 실제 데이터 연결 완료 시 즉시 제거. 사용자 오인 방지.

### P36. UI 텍스트 핵심/상세 분리
접힌 상태에서 핵심 한 줄 완전히 읽혀야 함. 상세 설명은 토글/AI 채팅으로 분리.

### P37. 인라인 font-size 11px 미만 사용 금지
CSS override가 자동 보정(7-8→11px)하지만, 신규 코드에서 극소 글자 사용 자체를 금지.

### P38. 전역 기능은 글로벌 컴포넌트로
AI 채팅, 알림 등 전역적 기능은 페이지별 복제가 아닌 글로벌 컴포넌트(사이드바 등)로 구현.

### P56. init 함수 내 cleanup 루프 중복 금지
차트/DOM 생성 후 즉시 destroy하는 "생성 → destroy" 패턴은 코드 리뷰에서 반드시 검출. 하나의 init 함수에 cleanup 루프가 두 개 이상 존재하면 두 번째 루프가 방금 만든 객체를 날릴 위험.

### P57. 고정 repeat(N,1fr) 그리드 모바일 검증 필수
`repeat(N,1fr)` (N≥5)은 모바일 375px에서 N×최소셀너비 > 컨테이너 width 여부 확인 필수. 6열 이상 그리드는 `repeat(auto-fit,minmax(Xpx,1fr))`으로 교체 검토.

### P58. applyDataSnapshot map과 HTML data-snap 속성 동기화 필수
`applyDataSnapshot()` map에 키를 추가/제거할 때 반드시 HTML `data-snap="key"` 속성 존재 여부를 grep으로 확인. 키가 있는데 HTML 없으면 dead code, HTML에 있는데 map에 없으면 hardcoded 고정값 버그.

### P59. _lastFG 초기값은 DATA_SNAPSHOT.fg에서 가져올 것
`fetchFearGreed()` 비동기 응답 전에 `_lastFG`가 필요한 컨텍스트(AI 채팅 스냅, 트레이딩 스코어 등)에서 기본값 18로 폴백되는 문제. `applyDataSnapshot()` 직후 `window._lastFG = DATA_SNAPSHOT.fg || 18`로 초기화할 것.

### P60. signal 페이지 브레드쓰 바는 liveQuotes + pageShown 양쪽에서 갱신
`updateBreadthBars()`가 breadth 페이지 init에서만 호출되면 signal 페이지 브레드쓰 섹션은 breadth 페이지를 방문하기 전까지 하드코딩 고정값. signal 페이지의 `aio:liveQuotes` 리스너에서도 `updateBreadthBars()` 호출 필수.

---

## 🟡 재발 방지 규칙 (v48.54 신설 — 레이어/파이프라인/함수 단위)

### R34. CSS 색상 토큰 우선 — rgba 하드코딩 금지 (v48.54 추가)
**원칙**: 투명 화이트 오버레이 `rgba(255,255,255,0.0X)` 패턴은 CSS 변수(`--surface-1~5`)로만 사용.

**금지 패턴**:
```html
<!-- BAD -->
<div style="background:rgba(255,255,255,0.02)">
```

**권장 패턴**:
```html
<!-- GOOD -->
<div style="background:var(--surface-1)">
```

**표준 매핑** (v48.48 정의):
| 값 | 변수 |
|-----|------|
| `rgba(255,255,255,0.02)` | `var(--surface-1)` |
| `rgba(255,255,255,0.03)` | `var(--surface-2)` |
| `rgba(255,255,255,0.04)` | `var(--surface-3)` |
| `rgba(255,255,255,0.05)` | `var(--surface-4)` |
| `rgba(255,255,255,0.08)` | `var(--surface-5)` |

**⚠ Canvas ctx 예외**: HTML5 Canvas의 `ctx.strokeStyle` / `ctx.fillStyle` / `ctx.font`는 CSS var를 **해석 못함**. Canvas 렌더러 내부에서는 직접 hex/rgba 값 사용:
```js
// BAD
ctx.strokeStyle = 'var(--surface-5)';  // 작동 안 함
// GOOD
ctx.strokeStyle = 'rgba(255,255,255,0.08)';  // 또는 '#8888884A'
```

> SVG `fill="var(...)"` 및 HTML `style="..."` 속성은 OK (CSS 해석).

### R35. 신규 페이지 → CHAT_CONTEXTS 동시 생성 (v48.54 추가, P106 교훈)
### R36. Themes 페이지 종목 추가 → LIVE_SYMBOLS 동시 등록 (v48.54 추가)
### R37. data-snap 신규 추가 → 자동 렌더러 참여 (v48.54 추가, P108 교훈)
### R38. `on*` 인라인 이벤트 핸들러 금지 — 전체 확장 (R32 확장, v48.54 추가)
### R39. extractTickers → UI 노출 경로 필수 페어링 (v48.55 추가, P116/P121/P122/P125 교훈)
### R40. CHAT_CONTEXTS system() = persona + 메서드론만 (v48.55 추가)
### R41. 기업 분석 맥락 ctx 전원 FMP 심층 활성 (v48.55 추가)
### R42. Agent 결과 실측 교차검증 의무 (v48.59 추가, Agent 오판 5회 누적)
### R43. Canvas context는 CSS var 미해석 (R34 예외, v48.59 추가)
### R44. setTimeout 무한 재귀 종료 카운터 필수 (v48.59 추가, renderAllEtfGrid 교훈)
### R45. 페이지 전환 active 설정은 `dataset.arg` 기반 (v48.59 추가, v48.32 onclick 0건 후 잔존 버그)
### R46. HTML 외 JS 파일까지 sed 치환 범위 확대 (v48.61 추가)
### R47. CSS 변수 자기순환 참조 금지 (v48.61 추가, surface-1~5 교훈)
### R49. 새 페이지 추가 시 결론 바 의무 (v48.62 추가)
### R50. fb-estimated 배지 사용 기준 (v48.62 추가)
### R51. 콘텐츠 카드 본문 폰트 최소 12px (v48.62 추가)
### R48. Canvas 렌더러 전역 변수 참조 시 실제 설정 위치 확인 (v48.61 추가, _pcRatio vs _putCallRatio 교훈)
## 🔧 Hook 자동화 (v48.61 대폭 확장 — Layer 2~9 실제 구현)

### validate-edit.sh Hook 9 Layer
1. **Layer 1**: div 균형 (기존 v31+)
2. **Layer 2**: `rgba(255,255,255,0.0[2-8])` 신규 추가 경고 — R34 위반 감지
3. **Layer 3**: `on(mouseover|mouseout|blur|focus|click|change|input|keydown|keyup|submit)=` 신규 추가 경고 — R38 위반
4. **Layer 4**: `ctx\.(stroke|fill)Style\s*=\s*['"]var\(--` 감지 — R43 Canvas 에러
5. **Layer 5**: CHAT_CONTEXTS system 함수 내 `SUB_THEMES|themeMap\.(slice|map|forEach)` 6회+ 경고 — R40
6. **Layer 6**: `extractTickers`/`getDisplayTickers` 호출 횟수 vs `tickerStr`/`tickerTag`/`mentionedTickers` 사용 불일치 경고 — R39 (P125 탐지)
7. **Layer 7**: `setTimeout\([^,]+,\s*\d+\)` 재귀 3회+ vs `_xxxRetries > N` 가드 부재 경고 — R44
8. **Layer 8**: `getAttribute\(['"]onclick['"]\)` 신규 추가 경고 — R45 위반
9. **Layer 9**: TODO/FIXME/XXX 10건+ 증가 시 기술부채 경고 — R42 원칙

## R54. `data-aio-archive` 마킹 원칙 (v49.21 추가)
## R55. 동일 지표 multi-sink 단일화 (v49.24 추가, P216/P218 근본)
## R56. 임계값·라벨 단일 출처 — THRESHOLD_REGISTRY (v49.24 추가, P219 근본)
## R57. 정적 테이블 stale 감지 의무 (v49.24 추가, P217 근본)
## R58. DOM 인라인 vs DATA_SNAPSHOT 3-way 정합 (v49.24 추가, P213 근본)
## R59. 점수 스케일 단일 정의 — SCORE_SCALES (v49.25 추가, L1 근본)
## R60. 매매 전략 권장값 단일 출처 — ATR_PRESETS (v49.25 추가, L4 근본)
## R61. 다중 신호 합의 알고리즘 — diagnoseBreadthConsensus (v49.25 추가, L3 근본)
## R62. 정량 지표 자동 채점 — PIOTROSKI_CHECKLIST (v49.25 추가, L7 근본)
## R63. 라벨 인라인 사용 자동 audit — getThresholdLabelAudit (v49.25 추가, R56 자동화)
## R64. 점수 가중치 단일 정의 — WEIGHT_REGISTRY (v49.26 추가, I2 근본)
## R65. 시각 위계 단일 정의 — CARD_HIERARCHY (v49.26 추가, I3 근본)
## R66. 중복 콘텐츠 자동 감사 — getDuplicateContentAudit (v49.26 추가, I4 근본)
## R67. 동적 판정 함수 단일화 — getCycleFromMacro (v49.26 추가, I7 근본)
## R68. 페이지 placeholder 표준 — 동적 검색 가이드 (v49.26 추가, I5/I6 근본)
## R69. Action Item 단일 출처 — ACTION_RULES (v49.27 추가, E1/E2 근본)
## R70. 페이지 목적 단일 정의 — PAGE_PURPOSE_REGISTRY (v49.27 추가, E3/E4 근본)
## R71. 이론 vs 실행 비율 audit — getPagePurposeRatioAudit (v49.27 추가, E5 근본)
## R72. 시나리오 확률 시간 의존 — SCENARIO_REGISTRY (v49.27 추가, L6 근본)
## R73. 인프라 추가 시 페이지 적용 동반 의무 (v49.28 추가, P239 메타 근본)

**원칙**: 신규 `*_REGISTRY` 객체나 `AIO.get*Audit()`/`AIO.applyXxxToElement()` 함수를 추가할 때 **반드시 같은 버전에서 해당 인프라를 실제 페이지에 적용**해야 한다. 인프라 등록 PR과 페이지 적용 PR을 분리하면 인프라가 "사용 가능"하지만 "사용 안 됨" 상태로 영구 잔존.

**근거 (P239)**: v49.24~v49.27이 18개 근본 인프라(THRESHOLD/SCORE_SCALES/ATR/PIOTROSKI/WEIGHT/CARD_HIERARCHY/applyLabel/getCycle/ACTION/PAGE_PURPOSE/SCENARIO 등)를 추가했으나 실제 페이지 DOM에 적용 안 함. 사용자가 보는 화면은 그대로 stale. v49.28에서 시정.

**적용 체크리스트**:
1. 인프라 객체/함수 등록 (`aio-core.js`)
2. 최소 1개 페이지에 적용 (DOM 마커 + JS 호출)
3. `_aioPageBus.register()` 또는 `applyDataSnapshot` 통합 (페이지 진입 시 자동 호출)
4. 회귀 테스트 추가 — 페이지에 인프라 호출 결과 표시 확인 (단순 인프라 함수 존재 여부 X, 실제 DOM 결과 검증)

**위반 시**: 새 인프라가 "코드는 있는데 화면에 없음" 패턴으로 누적 → 디버깅 어려움, 사용자 신뢰 훼손
**자동 감사**: `AIO.getThresholdLabelAudit()` + `AIO.getSnapshotConsistencyAudit()` 호출 결과 + getDuplicateContentAudit를 정기 점검하여 적용률 추적

---

## R74. DOM 인라인 폴백 vs DATA_SNAPSHOT 동시 갱신 의무 (v49.30 추가, P252/M1 근본)
## R75. 정적 콘텐츠 lifecycle 메타 필수 (v49.30 추가, P253/M2 근본)
## R76. 정치/관료 이름 NAMED_ENTITY_REGISTRY 경유 의무 (v49.30 추가, P254/M3 근본)
## R77. 거시지표 MACRO_CALENDAR 등록 + 자동 stale (v49.30 추가, P254/M4 근본)
## R78. KR 거시 KR_MACRO_RELEASE 등록 + 발표 캘린더 의무 (v49.30 추가, P255/M5 근본)
## R79. 지정학 시나리오 단일 출처 — GEOPOLITICAL_CONTEXT_REGISTRY (v49.31 추가, H3 근본)
## R80. 정적 데이터베이스 메타 의무 — SCREENER_DB_META (v49.31 추가, H1 근본)
## R81. 정기 발표 데이터 사용자 가시 마커 (v49.31 추가, H4 근본)
## R82. AI 채팅 가격 fetch 실패 시 Hard Guard 의무 (v49.32 추가, P263 근본)
## R83. 채팅 응답 post-hoc 가격 검증 의무 (v49.32 추가, P264 근본)
## R84. System 프롬프트 정량 수치 화이트리스트 (v49.32 추가, P262 근본)
## R85. 종목명-티커 단일 출처 — TICKER_NAME_REGISTRY (v49.32 추가, P266 근본)
## R86. 환각 패턴 자동 탐지 + 의심 점수 (v49.32 추가, P264 보강)
## R87. 종목별 데이터 무결성 통합 검증 (v49.32 확장, 사용자 추가 요청)
## R88. Fundamental 15 분석 기준 데이터 출처 매핑 (v49.32 확장)
## R89. AI 채팅 응답 자동 검증 통합 의무 (v49.33 추가, P269 근본)
## R90. 종목 정성 분석 출처 의무 — ANALYSIS_FRAMEWORK_REGISTRY (v49.34 추가, 사용자 지적)
## R91. 페이지 표시 분석 기준 registry 등록 + 가용성 가시화 의무 (v49.35 추가, P275 근본)
## R92. 페이지 표시 분석 기준 100% 커버 의무 (v49.36 추가, P278 근본)
## R93. 페이지 sequential audit 의무 (v49.37 추가, P282 메타 근본)
## R94. 페이지 인라인 임계값 표 REGISTRY 정합 의무 (v49.38 추가, P286 근본)
## R95. 페이지 간 동일 ticker 정합 의무 (v49.39 추가, P290 근본)
## R96. data-action 핸들러 등록 검증 (v49.39 추가, P291 근본)
## R98. JS 함수 내 var X + const/let X 충돌 자동 탐지 (v49.44 추가, P311 근본)
## R134. AI 채팅 데이터 다운로드 + 금액/% 시뮬레이션 의무 (v49.70 추가, P373~P374 근본)
## R133. AI 채팅 알람/임계값 트리거 의무 (v49.70 추가, P372 근본)
## R132. AI 채팅 사용자 투자 프로필 메모리 의무 (v49.70 추가, P371 근본)
## R131. AI 채팅 거시 시나리오 동적 시뮬레이션 + 약어/별명 fuzzy 매칭 의무 (v49.69 추가, P368~P369 근본)
## R130. AI 채팅 자동 페이지 이동 + 포트폴리오 동적 시뮬레이션 의무 (v49.69 추가, P366~P367 근본)
## R129. AI 채팅 후속 질문 자동 제안 의무 (v49.69 추가, P365 근본)
## R128. AI 채팅 시각 단서 표준 + 데이터 소스 우선순위 + 출처 타임스탬프 (v49.68 추가, P361~P363 근본)
## R127. AI 채팅 Bull/Base/Bear 3 시나리오 분기 강제 (v49.68 추가, P361 근본)
## R126. AI 채팅 기관급 분석 프레임워크 8개 인용 의무 (v49.68 추가, P360 근본)
## R123. 사이드바 Audit row 의미 분리 표시 의무 (v49.67 추가, P357 근본)
## R122. AI 채팅 사용자 체감 품질 의무 (v49.67 추가, P352~P356 근본)
## R121. AI 채팅 시스템 정의-호출 정합 의무 (v49.66 추가, P348~P351 근본)
## R119. 3대 본질 정렬 감사 의무 (v49.65 추가, P346 근본)
## R120. 초보자 초기 상태 문구는 보이는 DOM 기준으로만 감사 (v49.65 추가, P347 근본)
## R118. REGISTRY coveragePct와 실등록 카운트 분리 감사 의무 (v49.65 추가, P339 근본)
## R117. dataConfidence:low 분야 환각 차단 알림 의무 (v49.65 추가, P340 근본)
## R116. 새 분석 관점 추가 시 4축 동시 갱신 의무 (v49.65 추가, P340 근본)
## R115. 사용자 가시 placeholder 텍스트 표준 의무 (v49.64 추가, P334 근본)
## R114. 외부 워크트리 통합 시 함수 존재 vs 페이지 실행 검증 분리 의무 (v49.63 추가, P331 근본)
## R112. 모든 CHAT_CONTEXTS는 _getChatRules() 호출 의무 (v49.59 추가, P327 근본)
## R110. signal/breadth/sentiment context는 라이브 수치 자동 주입 의무 (v49.59 추가, P324 근본)
## R109. fxbond 한국 금리 스냅샷 시점 명시 의무 (v49.59 추가, P326 근본)
## R108. Audit 함수 추가 시 사이드바 위젯에도 노출 의무 (v49.58 추가, P322 근본)
## R107. 채팅 fetch는 반드시 Promise.allSettled + 개별 timeout 의무 (v49.58 추가, P321 근본)
## R106. 새 페이지 CHAT_CONTEXTS 신규 시 window._currentXxxId 자동 주입 의무 (v49.58 추가, P319 근본)
## R105. 테마 페이지 진입 시 채팅 컨텍스트에 활성 테마 ticker 라이브 가격 주입 의무 (v49.57 추가, P316/P317 근본)
## R104. _fetchTickerDataForChat 신규 fetch 추가 시 ABSOLUTE RULES 동기 확장 의무 (v49.57 추가, P317 근본)
## R103. SCR_KEYWORD_ALIASES 신규 테마 추가 시 AIO_TICKER_NAME_REGISTRY 등록 의무 (v49.57 추가, P316 근본)
## R102. 페이지 cell-level audit 의무 (v49.48 추가, P318 근본)
## R101. DOM ticker vs LIVE_SYMBOLS coverage 의무 (v49.48 추가, P317 근본)
## R75 보강 (v49.48, P316 근본 — Jensen hardcoded → 일반화)

**기존 R75 (v49.30)**: 정적 콘텐츠 lifecycle 메타 부착 의무 (`createdAt` + `archiveAfterDays` + `replaceAfterDays`).

**v49.48 보강**: lifecycle 콘텐츠는 페이지에 `data-lifecycle-id="ID"` 마커 부착 + `[id$="-stale-days"]` 또는 `.lifecycle-stale-days` span 신설. `_aioStaticContentLifecycleHook()`이 모든 페이지 진입 시 자동 갱신.

**근거 (P316)**: v49.42 P304 시정 후 Jensen 인터뷰 `#jensen-interview-stale-days` span을 채우는 hook이 페이지 진입 시 호출되지 않아 v49.47 P314까지 영구 "경과 계산중" 표시. v49.47에서 Jensen 전용 hardcoded hook 추가했으나 `briefing-week-may-4-10` / `kr-export-2026-02` 같은 다른 LIFECYCLE 항목은 여전히 갱신 안 됨.

**시정**: v49.48 P316 — `_aioStaticContentLifecycleHook()` 일반화 + `_aioPageBus 'aio:pageShown'` 모든 페이지 자동 호출.

**위반 시**: STATIC_CONTENT_LIFECYCLE 등록 콘텐츠가 페이지에 표시되지만 동적 갱신 안 됨 (영구 stale label).

---

## R100. API 키 저장 2중화 + 백업/복원 UX 의무 (v49.45 추가, P312 근본)
## R99. SW SHELL_ASSETS 자산 무결성 자동 검증 (v49.44 추가, P310 근본)
## R97. data-snap 키 vs DATA_SNAPSHOT 시드 정합 (v49.41 추가, P301 근본)
## R125. Second/third-pass text, function, and data meaning audit required (v49.67 added, P359 root prevention)
## R124. DOM-first full surface audit required (v49.67 added, P358 root prevention)
## R167. innerHTML 삽입 시 모든 사용자/외부 변수에 escHtml() 의무 + 정규식 메타문자 이스케이프 (v49.81 added, P433~P435 root prevention)
## R168. vendor-prefix CSS 속성은 표준 속성과 동시 선언 + inline hover: 금지 (v49.81 added, P436~P437 root prevention)
## R169. 동일 함수 내 var/const/let 이름 충돌 금지 + 신규 코드 let/const 우선 (v49.81 added, P438 root prevention, P311 패턴 재발 방지)
## R170. 외부 작업본 통합 시 KR/외국 ticker 매핑 다중 위치 cross-check 의무 (v49.82 added, P439~P441 root prevention)
## R172~R178. v49.83 — 기관급 + 직관성 7 규칙 (사용자 백로그 9건 응답)

**R172 — MACRO_CALENDAR auto-advance 의무**: 발표 캘린더 entry는 일자 경과 시 자동 next event compute. `AIO._aioRecomputeMacroCalendar({ dryRun: true })` 사이드바 18축 노출 의무.

**R173 — cross-asset correlation matrix 의무**: 자산 간 30일 rolling Pearson correlation + regime classification 자동 산출. `AIO.computeCrossAssetCorrelation()` `_priceHistory` 활용. 사이드바 16축.

**R174 — AI 답변 정량 비율 측정 의무**: 채팅 답변에서 정량 토큰 비율 7%+ 권장. `AIO.assertQuantitativeRatioAudit()` 자동 측정 + 사이드바 17축. <4% 시 'fail' (정성 과다 환각 위험).

**R175 — earnings call transcript 통합 의무**: 종목 분석 시 FMP /earning_call_transcript 자동 fetch + 시스템 프롬프트 [Earnings Call (Qx YYYY)] 라벨 주입. AlphaSense/Sentieo 대체 무료 옵션.

**R176 — AI 답변 시각 자료 의무**: 답변 종목 detect 시 30일 mini sparkline SVG 자동 인라인 삽입. `_aioBuildSparklineSvg` 활용. 양수 green / 음수 red. 최대 3 종목.

**R177 — 사이드바 audit 일반/개발자 mode 토글 의무**: 18+ audit row metric은 일반 사용자에게 부담. `localStorage.aio_audit_mode = 'simple' | 'detailed'` 토글 의무.

**R178 — audit failure status sticky top + pulse 의무**: ✗ failure rows는 자동 top sort + 빨간 border + 2s pulse animation. ⚠ warn = amber. 위기 시그널 즉각 가시.

**Pattern 일반화 (R170 확장)**: 신규 audit 함수 추가 시 (1) fn 정의 (2) 사이드바 data-audit-key row 노출 (3) 회귀 T 테스트 3종 셋트 (`fn 정의 / status 반환 / 사이드바 DOM`) 동시 작성 의무.

---

## R179. 클라이언트 접속 시 자동운영 모델 — 부팅 로더 명시 + 서버 cron 금지 (v49.88 added, P447 root)
## R180. 데이터 lineage 5단계 연결 의무 + 자동 audit (v49.89 added, P450 root)
## R181. 데이터 검증은 카테고리 + cell-level(개별 sink→source) 둘 다 (v49.90 added, P451 root)
## R182. cell-level은 연결 + 값 정확성 둘 다 / 텍스트 수치는 동적 참조 (v49.91 added, P452 root)
## R183. WebSearch 수치는 지표별 정상 band 검증 후 수용 (v49.92 added, P453 root)
## R184. 동일 지표가 2개 저장소(DATA_SNAPSHOT 본체 + _fallback 미러)에 존재 시 정합 의무 (v49.96 added, P459 root)
## R185. 재발방지 audit은 pull이 아닌 push — 지속 운영 중 자동 surfacing 의무 (v49.96 added, P461 root)
## R186. 첫 접속/새로고침 시 진행률 로더 + 정적 콘텐츠 만료 시 동적 폴스루 의무 (v49.97 added, P462 root)
## R200. v50 페이지 계약/데이터 증거/AI 답변/배포 게이트 4원칙 (v50.0 added, P476 root)
## R187. 매매 핵심 페이지(종합 5)는 진입 시 stale하면 즉시 재fetch 의무 (v49.98 added, P463 root)
## R188. 전체 데이터 최신화 진행률은 중앙 refresh state를 단일 진실 원천으로 표시한다 (v49.101 added, P464 root)
## R189. 5개 종합 페이지 개별 데이터는 page profile 심볼/태스크 union으로 최신화한다 (v49.102 added, P465 root)
## R190. 보이는 차트/지표/시세/수치/수식/텍스트 표면은 최신화 감사에 자동 편입한다 (v49.103 added, P466 root)
## R191. AI 채팅의 종목 답변은 strict preflight 후 최신 시세/기업 데이터 블록만 인용한다 (v49.104 added, P467 root)
## R192. `forceFresh` for AI stock answers must bypass every local freshness shortcut (v49.105 added, P468 root)
## R193. AI chat must vary answer structure by intent and use only injected current data for current claims (v49.106 added, P469 root)
## R194. Critical-10 refresh success must be followed by DOM binding verification (v49.107 added, P470 root)
## R195. Trading-use market data must pass DataTruthGate before decision use (v49.108 added, P471 root)
## R196. Trading-use quotes require independent cross-source validation when available (v49.109 added, P472 root)
## R197. Critical-10 freshness must audit visible market surface, not only refresh schedules (v49.110 added, P473 root)
## R198. Critical-10 page content must be compared with current market reference/regime before being trusted (v49.111 added, P474 root)
## R199. Critical-10 content checks must use a full evidence matrix, not representative samples (v49.112 added, P475 root)
## R201. Trading decision logic must pass current evidence gate (v50.1 added, P477 root)
## R202. Runtime version uses one or two decimal digits only (v50.1 added)
## R203. News surfaces must use the shared evidence-style surface contract (v50.2 added, P478 root)
## R204. User-facing market text must pass the text surface contract (v50.3 added, P479 root)
## R205. Static market calendars must separate official releases from source-dependent topics (v50.4 added, P480 root)
## R206. 사용자 가시 텍스트에 개발자/버전 마커 금지 (v50.14 added, v50.13 UX audit root)
## R207. 접근성 WCAG AA 유지 — 접근 이름·최소 폰트·tap target (v50.14 added)
## R208. 분석 UI 상태·수량·정밀 주장·향후 일정은 증거 원천에서 파생 (v50.55 added, P500 root)
## R209. 계약 수·시간대·복합 가격 카드는 단일 진실 원천에서 파생 (v50.56 added, P501 root)
## R210. 런타임 scope·sink 소유권·증거 게이트 의미를 함께 검증 (v50.56 added, P502 root)
## R211. 넓은 AI 종목 추천은 분산 후보군을 먼저 만들고 반복 앵커를 감점 (v50.57 added, P503 root)
## R212. AI 채팅 정확성 가드는 사용자 의도별로 적용하고 답변력을 억제하지 않는다 (v50.58 added, P504 root)
## R213. AI 채팅 데이터 기능은 자연어 라우팅과 출처 레지스트리까지 연결해야 한다 (v50.59 added, P505 root)
## R214. AI 채팅은 AIO 전용 통합 답변 계약까지 주입해야 한다 (v50.60 added, P506 root)
## R215. Telegram/외부 정성 소스는 digest -> 화면 -> 스크리너 -> 채팅 -> 테스트까지 환류해야 한다 (v50.61 added, P507 root)
## R216. Data/news refresh must separate collection freshness from consumption coverage (v50.62 added, P508 root)
## R217. Scheduled data sources must close the collect -> artifact -> consume -> audit loop (v50.63 added, P509 root)
## R218. Runtime contract / share readiness gate is mandatory (v50.79)
## R219. Audit/gate is not semantic review (v50.89, P513 root)

**Rule**: A task is not complete just because an audit function exists, an object has the expected shape, a coverage percentage is high, or a sidebar row/DOM marker is present. For any request touching pages, AI chat, data/source pipelines, trading logic, technical analysis, ticker analysis, portfolio logic, market text, or public-sharing UX, the review must close the real semantic path:

- user request/intent -> affected function(s) and criteria
- affected function(s) -> downstream consumer(s)
- downstream consumer(s) -> visible page/chat/report output
- visible output -> market/domain meaning, currentness, source confidence, and user action risk

**Required**:
- Every new audit/readiness/coverage test must have either a direct semantic companion check or a documented semantic backlog item.
- Trading and market-decision edits must include at least one direct function contract and one user-visible wording/action check.
- AI chat edits must verify the route from user prompt intent to data/source block to answer policy/output, not only callable existence.
- UI/page redesign edits must inspect the first-screen visible hierarchy and at least one real user scenario for the touched route.
- Data/source edits must verify collect -> artifact/source -> loader -> normalized model -> page/chat consumer -> stale/source label.
- `node scripts/ci-semantic-review-check.mjs` must pass whenever `ci-runtime-contract-check.mjs`, AI/data/trading audits, or page redesign gates are touched.

**Validation**: `scripts/ci-semantic-review-check.mjs` inventories audit-only risk, verifies R219/P513 governance hooks, and asserts that high-risk trading/currentness gates remain semantic rather than shape-only.

## R227. Recommendation verification must exercise the no-ticker screener path (v51.30, P526 root)
## R220. Workflow memory must be compacted before it is extended (v50.89, P514 root)

**Rule**: `_context`, `CLAUDE.md`, QA checklists, postmortems, and `.claude/skills/*/SKILL.md` are operating surfaces, not infinite append-only logs. When a repeated problem appears, prefer one of these actions in order: remove stale guidance, merge duplicate rules, compress history into an indexable summary, split large skill details into `references/`, then add a new rule/check only if none of the above closes the loop.

**Required**:
- Do not add a long SKILL.md section when the material can live in a referenced file or deterministic script.
- A skill over 300 lines or 15KB must be treated as a compaction candidate unless it has a clear progressive-disclosure structure.
- `_context/BUG-POSTMORTEM.md` remains an archive, but latest failure patterns must be summarized into active RULES/QA/CI gates rather than re-read wholesale.
- `_context/RULES.md` additions must retire or merge superseded rules when a newer rule covers the same surface.
- `CLAUDE.md` must point to current operating contracts, not duplicate every historical caution.
- Any task that updates workflow docs or skills must run `node scripts/ci-workflow-compaction-check.mjs`.

**Validation**: `scripts/ci-workflow-compaction-check.mjs` reports oversized context/skill surfaces and fails if R220/P514 governance hooks are missing.

## R230. Dynamic news refresh must prove source quality and visible freshness (v51.30, P531 root)

**Rule**: News automation is not complete when RSS items are merely fetched or `public-data/data.json.newsCount` is nonzero. The visible home/briefing news surfaces must prioritize current, market-moving, credible-source items and must expose stale/empty states instead of filling the page with weak or old headlines.

**Required**:
- Server news scoring must distinguish Google News feed priority from actual article source tier; a high-priority query must not upgrade weak/re-syndicated sources.
- Low-quality/re-syndicated sources must receive an explicit penalty and must not dominate home core news.
- Query coverage must include the active market-mover themes that drive the current session, including Korea/AI semiconductor pressure and rebound when relevant.
- Home, briefing, market-news, and analysis-page news strips should use the same completed 08:00 KST to 08:00 KST 24h decision cycle unless the item is explicitly marked as a reference/static fallback.
- CI must assert source-tier scoring, low-quality penalties, current market-mover query coverage, and the home freshness contract.

**Validation**: `scripts/ci-data-pipeline-contract-check.mjs` checks source-tier scoring, low-quality source penalties, Korea AI/semi market-mover query coverage, dedicated credit/funding news backstop coverage, server `newsCycle*` metadata, and the shared completed 08:00 KST 24h news surface contract.

## R281. Live/browser QA must cover rendered route surfaces, not only prior static findings (v52.23, P633 root)
## R282. Assertive market-verdict/interpretation text must gate on live-sourced inputs — fallback/snapshot/blocked data may show numbers, but must not assert a directional or confidence-implying verdict (v52.24, P634/P635 root)
## R283. Interactive detail surfaces must be canonical, all registry entries must render, and same-screen metrics must share the same source (v52.27, P642 root)
## R284. Proxy responses, visible value slots, and browser QA matrices must be typed and executable (v52.28, P643 root)
## R285. Operational health labels and feed quality gates must distinguish sources and use accumulated evidence (v52.29, P644 root)
## R286. AI chat key gates must test the effective Claude route, not only the personal-key field (v52.30, P645 root)
## R287. Market breadth color, label, and gauge bars must share the canonical breadth regime (v52.31, P646 root)
## R288. Route x viewport audits must include topbar clipping and SVG text geometry, not only page overflow (v52.32, P647 root)
## R289. Live quote bridges must keep DATA_SNAPSHOT and `_fallback` mirrors synchronized (v52.33, P648 root)
## R290. Live-deployed invariants must be re-verified on a schedule independent of new commits (v52.38, P653 root)

**Rule**: A postmortem whose root cause was only reproducible against the deployed site — not by re-running local source gates against the checked-out repository — must add a standing predicate to `scripts/ci-live-invariant-check.mjs` in addition to any source-level contract in `ci-runtime-contract-check.mjs`/`ci-structural-check.mjs`. Source gates prove correctness at commit time; they cannot prove the live site is still serving that same correct state days or weeks later with no new commit in between to trigger them.

**Why this matters**: P638/C1 (a deployed Cloudflare Worker route older than the repo's `/anthropic` route) and P572/R263 (data commits landing while `[skip ci]` silently stopped the Pages deploy from publishing them) both had a fully correct repository while the live site diverged. No source gate could have caught either — nothing in the files those gates read had changed. `ci-structural-check.mjs`'s R280 shadow-declaration scan is a proven example of a check that only protects the repository, not what GitHub Pages/CDN actually serves.

**Required**:
- `scripts/ci-live-invariant-check.mjs` fetches the deployed site (`https://ysnle.github.io/aio-screener/`) and checks a small set of standing invariants against the live bytes: cachebuster/version coherency across all live script tags, and a live re-run of the R280 cross-file function-shadow scan.
- `.github/workflows/data-watchdog.yml` runs this script on its existing hourly schedule so a live-only regression surfaces without waiting for the next commit.
- Grow the predicate list only for root causes a local gate structurally cannot see (deploy/CDN/cache/operator-config drift). Do not duplicate a check `ci-runtime-contract-check.mjs`/`ci-structural-check.mjs` already enforces at commit time — two lists asserting the same fact will drift apart from each other.

**Validation**: `node scripts/ci-live-invariant-check.mjs` (network-dependent; also runs in `data-watchdog.yml`).

## R291. Static page-education content must state invariant mechanisms only, never a current level/date/verdict, and must inherit the existing declutter/accessibility gates (v52.39, P654 root)

**Rule**: A page-level "fundamentals"/education surface (e.g. `AIO_PAGE_FUNDAMENTALS`) is static prose written once and shipped to every visitor regardless of when they load the page — it is not a live render function, so it cannot re-check freshness on each view the way R282's live-verdict functions can. It must therefore never contain a claim that is only true on the day it was written: no current price/level, no current date, no directional/regime verdict. Only invariant mechanisms and relationships ("금리가 오르면 밸류에이션이 눌린다" style) are allowed — the fact side of R282's live/fallback distinction, applied unconditionally, since this content has no live/fallback state to check at all; it is always "unsourced" by construction and must read that way forever.

**Why this matters**: found during the v52.39 22-page education-layer audit (`_context/FABLE-EDU-OVERHAUL-DESIGN-2026-07-09.md` §1) — E1 (concept)/E2 (mechanism)/E5 (action guidance) were missing on 20 of 22 route pages, and the obvious failure mode when filling that gap is exactly R282's stale-narrative pattern (a hardcoded "지금 DXY 98은 위험 구간" sentence that reads as current fact forever). R282 gates *render functions* that can check a live/fallback flag at render time; this content has no such flag to check, so the constraint has to be enforced at content-authoring time instead.

**Required**:
- Content arrays for this component class may state relationships/thresholds/mechanisms but never a specific current price, index level, or date, and never a present-tense market verdict. This is not a ban on the words "지금"/"현재" themselves — a sentence that only frames an invariant question (e.g. "지금 얼마나 공격적이어도 되나") or quotes an actual UI section's literal label (e.g. a "경기 사이클 — 지금 어디?" card name) stays allowed; the boundary is asserting a specific market state as current fact, not the presence of either word.
- The DOM wrapper must reuse the existing `.aio-page-advanced-toggle` default-collapsed contract (no `open` attribute) rather than inventing a new always-expanded block, and must not use the `.aio-page-brief` class the v50.29 declutter contract already flags via `pageBriefNotDecluttered`.
- The component must not add new `aria-live` regions — static reference content does not need one, and `ci-ux-default-path-check.mjs` caps the whole document at 10.
- Interactive affordances stay out of scope for this content class; term cross-references are plain-text pointers ("사용 설명서 → 용어사전에서 X 검색"), not new `data-action`/onclick surfaces.

**Validation**: `js/aio-tests.js` T869 (registry completeness + render/idempotency smoke across all covered pages) and `scripts/ci-runtime-contract-check.mjs` (registry size, renderer/hook wiring, `.aio-page-brief` absence, `aria-live` absence within the component's own code block).

## R292. A client-side call routed through a region-unpinned shared edge proxy must auto-retry on the provider's own regional-block error signature, not just report it (v52.44, B8/P659 root)

**Rule**: When a browser-side fetch goes through a free-tier/shared edge proxy that cannot pin its execution region (e.g. Cloudflare Workers' free plan, which anycast-routes each inbound request independently), a request that happens to land on a datacenter the upstream provider blocks by policy fails with the upstream's own error body — not the proxy's own error shape. That failure is transient in the sense that a *new* request is independently re-routed and has a good chance of landing on a working datacenter; it is not transient in the sense that retrying the *same* connection or simply waiting would help. The retry must therefore: (a) issue a genuinely new request rather than reuse/retry the same connection, (b) gate on the caller actually being routed through the shared proxy — a direct call to the provider's own API from the user's own network never hits this failure mode, and (c) distinguish the provider's own error signature from the proxy's own unrelated error shapes at the same status code — retrying a proxy-side auth/quota/timeout failure wastes an attempt and can mask a real, non-transient problem.

**Why this matters**: found on B8 (`_context/DEFERRED-BLOCKS.md`) — curl reproduced the exact mechanism 3 times: identical requests through Cloudflare's free-plan Worker landed on `CF-RAY:...-NRT` (Tokyo, 200 OK) or `CF-RAY:...-HKG` (Hong Kong, 403) depending on which edge anycast happened to select, and the 403 body was Anthropic's own `{error:{type:'forbidden',message:'Request not allowed'}}` — not the Worker's own `errorResponse()` shape (`{error,status}`) — proving Anthropic itself, not the repo's Worker code, rejected the Hong-Kong-routed request by regional policy. The repo, secrets, and deploy were all otherwise correct; there was nothing to fix upstream, only a client-side mitigation to add. A prior, unrelated 403 investigation on the same route (B5) had guessed "Anthropic rate/concurrency limiting" — that guess was wrong (corrected once this mechanism was actually reproduced), which is itself a caution against assuming a cause for a recurring status code without reproducing the actual error body.

**Required**:
- Detect the specific upstream error shape (not just the HTTP status code) before retrying — a matching status code from the proxy's own error path is a different, non-retriable problem.
- Gate the retry on the call actually being server-key/proxy-routed; a direct-to-provider call under the user's own key/network never exercises this failure mode and must not retry on it.
- Cap retries low (1-2) and retry immediately with a fresh request — this is a routing-luck problem, not a load/backoff problem, so exponential backoff or added delay only costs latency without helping.
- Apply the same helper to every call site that shares the affected route, not only the one surface where the symptom was first noticed — a shared root cause left half-patched (e.g. chat fixed but briefing/translation left on raw `fetch`) reproduces the same user-visible failure on the unpatched surfaces.

**Validation**: `js/aio-tests.js` T887 (helper structure: status gate, server-key gate, provider-error-shape check, retry-fetch presence) + T888-T890 (all call sites wired, not just the first one found) and `scripts/ci-runtime-contract-check.mjs`'s matching B8 checks.

## R294. A security/encryption UI claim and a lock gate are two separate things to verify — a settings screen existing is not proof its protection is wired into the actual read path (v52.46, WO-1A/P661 root)

**Rule**: When a feature claims a security property in its UI copy (e.g. "PIN 설정 후 저장 시 AES-256 암호화"), verify two independent things, not one: (a) does the storage/read path actually implement that property, and (b) does the *gate* that's supposed to enforce it (a lock screen, a PIN prompt) actually get invoked on the path a user takes to reach the data. A function that looks like the gate (checks a stored PIN, decides whether to show a lock screen) is not evidence the gate fires — grep for its actual call sites. A gate that exists but is never called is indistinguishable, to someone reading the code casually, from one that works; it only differs when someone actually traces the caller graph or drives the UI.

**Why this matters**: found on P661 — the portfolio's `checkPortfolioPin()` was a complete orphan (zero call sites repo-wide); the page's `pf-main` container defaulted to visible, so a user who *had* set a PIN never saw a lock screen on normal page entry — the gate silently never engaged, independent of and prior to the separate finding that the underlying data was never actually encrypted (Codex P0-2). Two distinct bugs, easy to conflate as one, each requiring its own fix and its own verification.

**Required**:
- Grep the entire codebase for a security gate function's name before trusting it's load-bearing; a zero-call-site result means it does nothing regardless of how correct its internal logic looks.
- Verify the claimed protection (encryption, hashing, etc.) with an actual round-trip test against the real storage key, not just a code read — wrong-credential rejection specifically (the failure mode most likely to be silently absent) needs its own explicit test.
- When retrofitting real protection onto a previously-fake claim, cover migration for existing users who already have data under the old (unprotected) scheme — an upgrade path, not just a fresh-install path.
- Prefer wiring the gate into the single shared render/entry function all callers already funnel through, rather than trying to add the check at every individual call site — a per-call-site approach is exactly how a gate becomes reachable from some paths and not others.

**Validation**: `js/aio-tests.js` T891-T895 (`_testV5246PortfolioVault`) — static source-contract checks that the sensitive-key set, the shared vault sync-cache, the lock gate's actual wiring into the render function, and the null-decrypt wrong-PIN check are all present — plus a same-session Playwright E2E pass (17/17 across fresh-install, encrypt-at-rest, cross-reload lock, wrong-PIN rejection, correct-PIN recovery, legacy-PIN migration, and opt-out-without-touching-the-shared-vault scenarios) backing the behavioral claim that static contracts alone can't prove.

## R295. A special-purpose route added to a shared edge proxy must pass through the same defenses as every other route on that proxy — a new route is a new perimeter, not an exception to the old one (v52.47, WO-1B/P662 root)

**Rule**: When a new route is added to an existing edge/CORS proxy (e.g. a `POST /anthropic` handler bolted onto a Worker that was originally "just" a GET data-proxy), it does not automatically inherit that proxy's existing defenses (bot-UA filtering, rate limiting, domain allowlisting) unless it is explicitly routed through them — and if the new route is branched off *before* those checks in the request-dispatch order, it silently bypasses all of them. A route that is more expensive per-call than the rest of the proxy (an LLM relay vs. a JSON GET) needs its own, stricter version of each defense, not a shared one sized for cheap calls. Separately: CORS headers are a browser-side reading restriction, not a server-side access control — `Access-Control-Allow-Origin` never stops a `curl`/script/server call from reaching the handler and consuming its resources; an actual `Origin` check inside the handler (reject if missing or not allowlisted) is a different, additional control that CORS header generation does not provide for free.

**Why this matters**: found on WO-1B (`cloudflare-worker-proxy.js`) — the `/anthropic` server-key route was dispatched before the general proxy's bot-UA check, `checkRateLimit`, and domain allowlist, and never checked `Origin` itself (it only echoed one into the CORS response header). A daily-cap KV counter's read-then-write was also a non-atomic race (acceptable for a soft cap, but combined with "no cap enforced at all if the KV binding is simply missing" turned an intended cost ceiling into silent unlimited exposure on the single most common misconfiguration — forgetting to bind a namespace).

**Required**:
- When adding a new route to a shared proxy, explicitly re-apply (or deliberately, visibly skip with a comment explaining why) every defense the proxy's other routes already have — origin, rate limit, size limits — rather than assuming routing order makes this automatic.
- Give an expensive route its own, separate rate-limit bucket/threshold; do not let it share a limit sized for the proxy's cheapest call.
- A resource cap gated on an optional binding (KV, a queue, a secret) must decide explicitly whether missing-binding means fail-open (available but uncapped) or fail-closed (unavailable but never uncapped) — silence defaults to fail-open, which is rarely the intended answer for a *cost* cap specifically (availability caps may reasonably differ).
- Document the honest ceiling of client-side-only auth for a static site with no backend: a shared token embedded in public JS raises the bar against automated/naive abuse but is transparent to anyone who reads the page's own source — state this limitation next to the mitigation, not as a silent gap discovered later.

**Validation**: `scripts/ci-worker-anthropic-check.mjs` — imports and directly invokes the real Worker `fetch` handler (Node 18+'s native `Request`/`Response`/`URL` make this possible without a Cloudflare deployment or a browser), asserting kill-switch, Origin rejection, optional app-token rejection, the dedicated `/anthropic` rate limit, KV-unbound fail-closed, and the body-size cap all produce the correct status codes — a real behavioral test, not only a source-text contract, since this logic doesn't have the async-in-a-synchronous-test-runner constraint that gated B8/WO-1A to static checks. Plus `ci-runtime-contract-check.mjs` static checks for the client-side header wiring.

## R296. A session-scoped automation hook must not hardcode an absolute environment fact, and must scope its side effects to what changed during its own session, not whatever it finds lying around (v52.47, WO-5/P663 root)

**Rule**: A hook config that hardcodes an absolute filesystem path (a user profile directory, a cloud-sync folder) breaks the instant that path changes — a repo move, a re-clone, a sync-provider migration — and it breaks *silently*: the hook invocation just fails to resolve and the tool moves on, with no visible error surfaced to the person relying on it. Prefer paths relative to the repo root (resolved at hook-invocation time, since these tools already run with the project root as cwd) over anything user- or machine-specific. Separately: a `Stop`/session-end hook that does `git add -A` to auto-save "this session's work" is making an assumption — that everything currently dirty in the working tree belongs to this session — which is only true if the tree started clean. It routinely isn't: a previous session's uncommitted scratch state, or (concretely, in a repo two different agent tools operate on) a *different* tool's uncommitted output, sits there from before this session began. `git add -A` cannot distinguish "dirty because of me" from "was already dirty" — it stages both, and the resulting commit silently bundles unrelated work under this session's label.

**Why this matters**: found on WO-5 — `.codex/hooks.json` hardcoded every hook command to an absolute OneDrive path that no longer existed (the project had moved to a plain local directory), so every Codex-side hook (file-overwrite protection, dangerous-command blocking, version-sync checking) had been silently doing nothing. Separately, this exact session's own Stop-hook auto-commit (`git add -A`) was directly observed sweeping in a diagnosis document and an index file that predated the session and had nothing to do with its work — not a hypothetical, a commit (`1b3f39a`) that actually happened mid-session.

**Required**:
- Hook commands in `settings.json`/`hooks.json` must be relative paths from the repo root, never an absolute path baked in for one machine's current directory layout.
- A regex meant to capture a numeric field with a variable digit count must not hardcode a fixed digit count for any segment (`\.[0-9]` only ever captures one digit) — verify against a current real value with more digits than the pattern's author was probably picturing when they wrote it.
- A session-end auto-commit hook should snapshot repo state at session *start* (a `SessionStart` hook writing `git status --porcelain` to a scratch file) and diff against it at session end, staging only paths that are new since the snapshot — not stage everything currently dirty. This is a path-membership diff (ignore the exact status code, compare only which paths appear), so a file already dirty before the session correctly stays untouched by this session's commit even if it's still dirty at the end.
- When two tools' hook configs are meant to mirror each other (here, `.claude/` and `.codex/`), diverging line endings alone can make `diff` report every line as changed and obscure whether the actual logic has drifted — normalize (or diff with whitespace/CRLF stripped) before concluding they disagree.
- A repo-governance change with real teeth (enabling branch protection where none existed) needs the actual current push pattern checked first (do bots/hooks push directly to the default branch with no PR?) — a protection ruleset sized for a PR-based workflow (required reviews, required status checks before merge) would immediately break a direct-push-based one; scope the ruleset to what's actually compatible with the observed workflow (e.g. force-push/deletion protection only) rather than a generic "best practice" default.

**Validation**: manual pipe-tests of each hook script's new logic against synthetic and real repo state (comm-based diff verified empty when nothing changed and correctly identified a newly-created path after a snapshot; version-regex re-verified against the actual current multi-digit version string) before wiring into `settings.local.json`/`hooks.json`, per the `update-config` skill's construct-then-verify workflow. Branch protection settings verified by re-querying `GET /repos/.../branches/main/protection` after the change and confirming the exact fields set (`allow_force_pushes`/`allow_deletions` false, `required_pull_request_reviews` absent).

## R293. Every workflow YAML must be hard-gated for control-character corruption and parseability; other bot-written text gets a baseline-tracked regression gate (v52.45, WO-0/P660 root)

**Rule**: An automated "WIP auto-save" commit bot that writes Korean (or any non-ASCII) text into files can silently mojibake-corrupt that text — inserting genuine C0/C1 control characters (e.g. U+0080) into otherwise-valid UTF-8. For `.github/workflows/*.yml` specifically this is not merely cosmetic: PyYAML (and GitHub's own workflow parser) rejects C1 control characters outright, so a single corrupted byte anywhere in the file makes the *entire workflow* fail to parse — the job never even gets created, and — critically — a workflow like a freshness watchdog fails *silently from the monitoring system's own perspective*, since the thing meant to catch failures is itself the thing that broke. Workflow YAML must therefore be a zero-tolerance gate (any control character or YAML-parse failure fails CI), not a warn-and-continue.
For the rest of the repo (docs, scripts, source `.md`/`.js`/`.json`), the same corruption can and does accumulate silently over many commits with no equivalent hard consequence (nothing "fails" when a changelog paragraph is garbled) — a from-scratch zero-tolerance gate would immediately fail on pre-existing historical debt that isn't safely fixable in one pass (see below). Use a baseline file recording the current known-corrupt count per file; fail only if a file's count *increases* (new corruption), and treat a decrease as an improvement to re-baseline, never as a failure.

**Why this matters**: found via `_context/CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md` WO-0 — commit `40dbef8`'s auto-save mojibake'd 5 characters in `data-watchdog.yml` into the exact C1 codepoint YAML forbids, and the corrupted commit only reached `origin/main` via a later merge, at which point every subsequent scheduled watchdog run started failing with "workflow file issue" and zero job output — a repo-wide `git ls-files`+charcode scan while building the fix's CI gate then surfaced the *same* corruption pattern already baked into `CHANGELOG.md` (6,386 instances) and `_context/BUG-POSTMORTEM.md` (3,208 instances) from many earlier bot commits, accumulated silently for weeks with no gate to catch it.

**Required**:
- `.github/workflows/*.yml`: 0 control characters and a successful YAML parse (e.g. via `js-yaml`), enforced on every push/PR — no baseline, no exceptions.
- Everything else the bot writes to: a baseline-tracked scan (count control characters per file, compare to a recorded baseline, fail only on increase) so new corruption is caught going forward without requiring an immediate, risky mass-rewrite of existing history to turn the gate on.
- When a literal control-character regex/escape sequence needs to live in the *checking script itself*, prefer numeric char-code range comparisons over regex character-class escapes (`\x7f-\x9f` etc.) — those exact escapes proved unreliable to author/transcribe correctly through this session's own tooling, ironically for a script whose entire job is detecting that class of corruption.

**Validation**: `scripts/ci-control-char-check.mjs` (hard workflow gate + baseline regression gate) wired into `ci.yml`'s `validate` job; `_context/control-char-baseline.json` tracks the known pre-existing count per file.

## R301. A current market metric must have one canonical selector and an explicit provenance state; a snapshot may render as reference but must never silently drive a decision (v52.55, H3-A/P671 root)

**Rule**: A metric shown in multiple pages (especially Fear & Greed) must be selected through one canonical currentness envelope containing value, source, as-of/fetched-at, freshness, status, and decision-use permission. Truthy fallback chains (`live || snapshot || default`) are prohibited for current claims because they erase valid zeroes and can promote an old snapshot into a trading input. A stale or reference value may remain visible only with its reference state; score/entry logic must neutralize or block it until current evidence is available.

**Required**: Producers must write provenance metadata at the same time as the value; consumers (page summaries, dashboards, decision headers, AI evidence) must read the selector rather than `_lastFG`/`DATA_SNAPSHOT` directly. CI and headless tests must cover live-over-snapshot precedence, zero preservation, snapshot non-decision use, and stale blocking.

**Validation**: `window.AIO.getCanonicalMetric('fg')`, `js/aio-tests.js` T901–T904, and `scripts/ci-runtime-contract-check.mjs` H3-A checks.

## R302. Historical event context must expire before it can influence a current action; derived regimes need a missing-input quorum gate (v52.55, H3-B/C/P672 root)

## R303. PC geometry and external-source failures must be explicit, bounded, and user-visible (v52.56, H3-D/E/P673 root)

## R304. Third-party libraries are progressive enhancements and must never block the local route boot queue (v52.57, H3-F/P674 root)

**Rule**: A CDN-only library may improve charts, sanitization, or visualization, but it must not sit ahead of local application modules in a blocking ordered load queue. The core route router, page state, and safe fallback must boot even if every third-party CDN is unavailable.

**Required**: Load external enhancement libraries asynchronously or through an explicit bounded loader; keep local application modules in their deterministic order; retain a no-library fallback for every route that depends on an enhancement.

**Validation**: T912, runtime H3-F check, and the PC Chromium reload journey.

**Rule**: A canvas must never keep an intrinsic width larger than its actual desktop grid parent; an intentionally wide table must be contained by an explicit, keyboard-accessible horizontal-scroll region. External success, partial, timeout, malformed, and unavailable responses must resolve through one state contract with an explicit `allowedUse` policy. Console warnings alone or blank feed slots are not a valid failure state.

**Required**: Use the shared canvas width contract and `.aio-table-scroll` region semantics; use `AIO.normalizeExternalSourceState()`/`AIO_EXTERNAL_STATES` for API/RSS transitions; render a localized status and retry/reference policy where an external feed has no usable result.

**Validation**: T907–T911, runtime-contract H3-D/E checks, and the real PC/laptop Chromium artifact matrix.

**Rule**: Event/result narratives are reusable context, not perpetual current signals. Every event claim needs an explicit age window and must become historical/reference-only after expiry. A derived score or regime may retain a numeric diagnostic output for transparency, but when critical current inputs are missing/stale beyond the quorum threshold it must block an execution conclusion and expose the reason.

**Required**: Use `AIO_EVENT_FRESHNESS_REGISTRY` through `AIO.getEventClaimState()`; do not read event status/date directly to form current action copy. Preserve the diagnostic score, but block action/decision and prevent later overlays from restoring a strong conclusion.

**Validation**: T905/T906, `_aioDefaultDecision().decisionBlocked`, `_aioApplyEventFreshnessGate()` claim-state attributes, and runtime H3-B/C checks.

## R305. Partial third-party chart stubs must be treated as unavailable before registry access (v52.58, P675 root)

**Rule**: A truthy global library symbol is not proof that the required API surface loaded. Progressive-enhancement chart initialization must guard every API it calls, including `registry`, `plugins`, and `register`, before touching a partial local fallback stub.

**Required**: Keep the `initBreadthPage()` partial-Chart guard, preserve the local non-chart fallback path, and retain T918 plus the real Chromium H3-H/H3-I gate so CDN-loss route errors remain visible.

## R306. Typed provenance must separate evidence state from action strength (v52.59, P676 root)

**Rule**: Missing, neutral, future-dated, stale, delayed, snapshot, manual, seed, fallback, and proxy evidence are not interchangeable. A typed evidence envelope must preserve the source kind, as-of time, status, operational use, action strength, confidence, and one stable evidence ID.

**Required**: Reuse the same evidence ID across decision UI, score metadata, and AI context; missing remains distinct from neutral; future or missing evidence blocks action, while stale/reference evidence is reference-only and cautious-only. Validate through T930, the typed-provenance runtime contract, and `data-evidence-id`/`data-operational-use` attributes.

## R307. Full-route accessibility is a blocking local gate; assistive technology remains separate (v52.59, P676 root)

**Rule**: Every registered route must be checked at the mobile viewport for computed font sizes, control naming, select/canvas naming, positive tabindex, skip-link behavior, and modal semantics. A local route matrix cannot substitute for Firefox/WebKit or NVDA/manual evidence.

**Required**: Keep `ci-accessibility-matrix-check.mjs` in the blocking workflow and require zero computed fonts under 10px, nameless controls, unnamed selects/canvases, and positive tabindex values. Keep small-target observations and external/human Tier-13 evidence explicitly separate.

**Validation**: T918, `ci-runtime-contract-check.mjs`, and `ci-critical10-human-surface-check.mjs` with external requests blocked.

## R308. Fallback/reference freshness must not be forced into live parity (v52.60, P677 root)

**Rule**: A static `DATA_SNAPSHOT` marked `_isFallback=true` is reference-only and may lag a dynamically refreshed digest or source artifact. Its freshness contract is explicit degraded-state labeling and chronological ordering, not identical timestamps with a live-ish source.

**Required**: Regression tests must distinguish fallback from promoted snapshot state. For fallback data, require valid dates and `marketDate <= digestDate`; for promoted data, require the configured cross-source parity window. Never advance a fallback date without updating the values and provenance it describes.

## R309. Bulk text-replacement scripts must not run blindly across JS string literals — check for characters doing double duty as logic markers before a global find-replace (v52.62, P678 root)

**Rule**: Any script that mechanically strips or remaps literal characters/colors across an entire source file (not just HTML display text) can hit JS string literals where that character is not decorative but the *only* distinguishing content between two branches of a ternary or template string (e.g. `cond ? '✓' : '✗'`) that downstream code parses via `.indexOf()`/`.charAt()`/equality. Collapsing both branches to the same value silently makes the condition permanently true — this is worse than a visual regression because it looks like working code, still runs, and can pass a full test suite if that exact logic path isn't asserted.

**Required**: After any bulk find/replace across a full HTML+JS file (emoji strips, color sweeps, label renames), grep specifically for the signature of this failure class before trusting the change: both-branches-identical ternaries (`? '...' : '...'` where both sides are now equal) and `.indexOf('')`/`.indexOf(<now-empty-or-collapsed-string>)` patterns. A passing headless suite is necessary but not sufficient — confirm the specific corrupted-looking lines by reading them, not just by re-running tests. See P678/BUG-POSTMORTEM.md.

## R328. 승인된 화면 시안은 장식층이 아니라 기본 정보구조이며, 접힌 레거시는 통합으로 간주하지 않는다 (v52.87, P702 root)

**Rule**: 시안에 없는 기존 섹션을 `<details>`로 접거나 시안 앞뒤에 그대로 붙이는 방식은 이식 완료가 아니다. 기본 사용자 경로는 시안의 순서·밀도·텍스트 계층을 우선하고, 중복 설명·교육·운영 진단은 삭제하거나 전용 도움말/개발자 모드로 이관해야 한다.

**Required**: 13개 시안 화면에는 conclusion → evidence → action 순서에 직접 기여하는 콘텐츠만 기본 노출한다. `.aio-fund`, Public Status, 파이프라인 감사, 시안 밖 고급 도구는 기본 경로에 렌더하지 않는다. R291의 페이지별 교육 블록 의무는 본 규칙으로 대체하며, 교육은 전용 사용 설명서에서 제공한다.

**Validation**: T869, runtime-contract의 inert fundamentals/no-navigation-hook, 13면 advanced developer-only, 포트폴리오 순서/CTA, 스크리너 9열 게이트.

## R329. 시안 기본 경로 계약은 초기 HTML이 아니라 런타임 주입이 끝난 최종 화면에 적용한다 (v52.88, P703 root)

**Rule**: 승인 시안의 순서·밀도·중복 제거 계약은 페이지 진입 이벤트, 비동기 데이터 렌더, 공통 헤더/뉴스 삽입, 기존 재배치 함수가 모두 실행된 뒤에도 유지되어야 한다. 자동 생성된 패널이라는 이유로 시안 밖 콘텐츠를 일반 사용자 화면에 되살리지 않는다.

**Required**: 13면의 자동 판단 헤더·관련 뉴스·중복 피드·운영 진단은 개발자 경로로 격리한다. 결과 수가 변하는 뉴스와 스크리너는 첫 화면 상한과 명시적 점진 공개를 사용하고, 긴 브리핑 피드는 사용자가 확장하기 전까지 높이를 제한한다. 시안에서 정의한 핵심 순서를 런타임 DOM 이동으로 뒤집지 않는다.

**Validation**: T869 `redesign_default_path_v5288`, runtime-contract [G], 로컬 Chromium 13면 데스크톱·모바일 캡처, viewport/accessibility matrix.

## R330. 사용자 표면 수와 내부 QA 라우트 수를 분리하고, 시안 정보 위계를 모든 사용자 표면에 적용한다 (v52.89, P704 root)

**Rule**: 제품 페이지 수는 메뉴에서 직접 접근하는 19개 페이지와 용어사전 오버레이 1개를 합한 20개 사용자 표면으로 설명한다. `ticker`, `theme-detail`은 파생 뷰이며 `options`는 폐기 호환 reference shell이므로 22개 QA 라우트를 22개 사용자 페이지라고 부르지 않는다.

**Required**: 핵심 13면의 타이포그래피·여백·정보 우선순위를 사용설명서·용어사전·한국 5면에도 확장한다. 교육 콘텐츠는 검색 가능한 장별 공개, 대규모 테마 목록은 점진 공개, 중복 뉴스와 페이지 내 반복 용어 설명은 공용 뉴스/가이드 표면으로 통합한다. 기존 데이터·액션 함수는 재사용하고 별도 정적 데모를 만들지 않는다.

**Validation**: T869 `redesign_default_path_v5289`, runtime-contract [G], `AIO_ROUTE_REGISTRY.classes`, 남은 7면 데스크톱·모바일 실렌더링.

## R331. 시안의 최종 렌더 계약은 loaded/empty/degraded/closed 상태 전환과 종료 시간까지 포함한다 (v52.90, P705 root)

**Rule**: 섹션의 존재·순서·기본 노출만 맞아도 사용자 여정이 완료된 것으로 보지 않는다. 비동기 공급자 무응답, 캐시 폴백, 결과 0건, 접힌 상세, 닫힌 오프스크린 패널에서도 화면은 유한 시간 안에 읽을 수 있는 한 상태로 수렴해야 하며 같은 정보의 본문·요약·상태 소유자가 분리돼서는 안 된다.

**Required**: 외부 다중 요청은 총 예산과 부분 성공 경로를 가진다. 뉴스 피드와 헤더는 한 상태 갱신 함수를 사용한다. 점진 공개 컨트롤은 자신이 공개할 콘텐츠와 같은 페이지/컨테이너에 둔다. 닫힌 패널은 `inert`와 ARIA/포커스 상태를 함께 전환한다. 데이터가 없으면 계산 불가능한 카드를 숨기고 다음 행동을 우선한다. 대량 브라우저 요청은 명시적 상한·회로·단일 실패 설명을 가진다.

**Validation**: T1015~T1020, runtime-contract [G2], 20개 사용자 표면 데스크톱/모바일 렌더와 기업 분석 timeout·뉴스 cache/load-more·AI open/close·KR failure·portfolio empty 실제 Chromium 여정.

## R332. 데이터 파일 갱신시각·외부 관측시각·마지막 수집 성공시각을 분리하고 missing을 판단값으로 승격하지 않는다 (v52.91, P706 root)

**Rule**: `generatedAt`은 파일 생성 또는 실제 성공 중 문서화된 한 의미만 가져야 하며, 가격의 거래소 관측시각과 공급자 요청시각을 대신하지 않는다. 값이 없거나 원천이 실패한 상태를 `0`, 중립, 현재값, 또는 새 성공시각으로 변환하지 않는다. 지표가 그대로라는 이유만으로 정책금리를 stale 처리하지 않고 지표 주기에 맞는 freshness budget을 사용한다.

**Required**: 모든 의사결정 입력은 source, `observedAt`, `fetchedAt` 또는 `attemptedAt`, `lastSuccessfulAt`, freshness, `allowedUse`를 구분한다. 시세 producer는 거래 관측 메타데이터를 보존한다. 시장폭·심리·수급처럼 최신성이 끊긴 값은 점수/레짐/행동 문구에서 차단하며 화면에는 원천 미수신·참고값을 명시한다. 비밀키 실값은 masked input DOM에 복원하지 않는다. 통계적 예측 검증을 통과하지 않은 점수는 환경 설명으로만 명명한다.

**Validation**: runtime contract LIVE3-01~10, data-pipeline contract, 22개 범주 currentness 평가표, 실브라우저 20개 사용자 표면, 당일 공식/1차 소스 시장 대조.

## R333. 핵심 수집 실패는 마지막 정상 산출물을 덮어쓰지 않으며 공급자 가용성과 구현 완료를 분리한다 (v52.92, P707 root)

**Rule**: producer는 핵심 커버리지·스키마·관측시각 게이트를 통과하기 전에 공개 artifact를 쓰지 않는다. 독립 갱신 가능한 데이터군은 전체 파이프라인과 분리한다. 대체 API가 존재한다는 사실을 현재 연결·권리 승인·운영 준비 완료로 표시하지 않는다.

**Required**: 각 외부 의존은 current provider, target adapter, alternative, implementation state, rights, cadence를 기록한다. 실패 시 마지막 정상 artifact와 `lastSuccessfulAt`을 유지하고 새 `attemptedAt`/실패 상태만 기록한다. missing·라이선스 차단 입력은 중립값이나 현재값으로 변환하지 않는다.

**Validation**: data-pipeline contract의 `CORE_QUOTE_COVERAGE_FAILED` 선행 순서와 `SCREENER_ONLY`, runtime contract LIVE3-11~12, `AIO.getExternalDependencyAudit()`.

## R334. 데이터 대체 계획은 독립 실행·행 단위 lineage·publish 전 의미 검사로 닫는다 (v52.93, P708 root)

**Rule**: CLI 진입점이나 후보 API 문서만 존재하는 상태를 자동화 완료로 표시하지 않는다. 반복 artifact는 각 행의 관측시각·출처·허용 용도를 보존하고, publish 전에 커버리지·현재성·사용범위를 실행 가능한 validator로 검사한다.

**Required**: 무료 공식 원천을 우선하고 무료 동등 경로가 없으면 reference/education으로 제한한다. 운영자 이메일·무료 키·승인이 필요한 원천은 `operator_configuration_required`로 fail-closed 처리한다. 공용 CORS proxy/CDN 실패가 더 최신인 공식 서버 artifact를 snapshot으로 되돌리지 못하게 한다.

**Validation**: `refresh-screener.yml`, `validate-screener-artifact.mjs`, SEC companyfacts 정규화 fixture, Cboe 공식 페이지 parser fixture/live probe, 종목별 `observedAt/sourceKind/allowedUse`, runtime/data-pipeline contract.
## R376. Cloudflare fast quote plane의 R2는 승인된 optional durability layer이며 KV-only 배포에서는 R2 binding/secret을 요구하지 않는다 (v53.42, P833)

**Rule**: 운영자가 카드 등록 없이 fast quote plane을 사용하기로 선택한 경우 Worker는 KV의 `quotes:current`와 `quotes:heartbeat`만으로 동작해야 한다. 배포 preflight는 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `AIO_QUOTES_KV_ID`만 요구하며 `AIO_QUOTES_R2_BUCKET`, R2 binding, R2 write/fallback을 암묵적으로 재도입하지 않는다. R2 durability는 별도 승인된 작업에서만 추가한다.

**Validation**: `scripts/ci-data-plane-contract-check.mjs`, workflow YAML/control-character check, Worker syntax check, `/health` Tier0 16/16 smoke check.

## R377. 사용자 제공 시장자료는 하나의 REFERENCE 프레임으로 통합하되 현재성 수치와 분리한다 (v53.43, P834)

**Rule**: `/integrate`가 시장 텍스트, 외부 링크, 차트 이미지, 티커 프레임을 반영할 때는 `sourceKind=REFERENCE`, `asOf`, 원문/이미지 식별자, Q1~Q5 추출, 시계열 상태를 보존한다. capex·backlog·가격·차트 레벨·외부 endpoint 상태는 `DATA_SNAPSHOT` 또는 live decision input으로 승격하지 않는다. `CHAT_CONTEXTS`에는 재사용 가능한 판정 프레임만 주입하고 현재 수치는 LIVE/SNAPSHOT/official evidence에서만 재계산한다.

**Required**: ticker memo에는 날짜 헤더를 포함하고, memory P/ASP/multiple과 neocloud Q/spread/capital을 분리하며, breadth·금리·신용·유가의 교차확인을 요구한다. 차트는 구조·리테스트·거래량·무효화 조건으로 추출하고 OCR이 불확실한 숫자는 폐기한다.

**Validation**: `public-data/user-research-digest.json`, `AIO_AI_INFRA_CYCLE_REFERENCE`, `_aioAIInfraCycleContext`, `ci-runtime-contract-check.mjs`, `ci-knowledge-lint-check.mjs`, memo freshness tests, and full static/runtime/browser QA.

## R378. Reference market material must expose reusable chart, behavior, and communication protocols (v53.44, P835)

**Rule**: A source-labelled market-material integration is incomplete if it stores only thesis prose and raw observations. It must also define a chart-reading sequence, non-automated response states, and an answer contract that separates observed evidence, reference evidence, inference, confirmation, invalidation, and missing data.

**Required**: Keep chart levels and supplied figures as `REFERENCE`; use `wait`/`probe`/`hold`/`protect` as conditional behavior states; leave execution and sizing user-controlled; close analysis with the next observation window.

**Validation**: `AIO_AI_INFRA_CYCLE_REFERENCE.chartReadingProtocol`, `.behaviorPlaybook`, `.communicationContract`, the research digest framework, and the Knowledge Base section must remain synchronized.

## R379. SEC refresh queues must rotate untried candidates before retrying known failures (v53.45, P836)

**Rule**: An SEC fundamentals refresh must not let repeatedly unavailable symbols starve eligible symbols that have never been attempted. Failed attempts must retain timestamps, be cooled down by default, and remain explicitly unavailable until an official source succeeds.

**Required**: Prioritize never-failed candidates, use a bounded retry cooldown, expose an explicit operator override for deliberate retries, and never synthesize missing filing facts. Rebuild dependent screener coverage after the SEC artifact changes.

**Validation**: `scripts/fetch-sec-fundamentals.mjs`, `public-data/sec-fundamentals.json`, `public-data/screener.json`, and `public-data/operations-status.json` must expose source-labelled counts and freshness.

## R380. Fast-plane deploy smoke must distinguish bootstrap from failure (v53.46, P837)

**Rule**: A newly deployed KV-only Worker may have no `quotes:current` snapshot until its first scheduled run. Deployment smoke must retry transient endpoint propagation, accept only the explicit empty-KV bootstrap shape as `operator_required`, and continue blocking malformed, partial, unreachable, or non-bootstrap failed states.

**Validation**: `.github/workflows/deploy-data-plane.yml` must keep the `/health` retry, complete-coverage gate, and bootstrap-shape gate synchronized with `worker/data-plane.js`.

## R381. Decision models must consume normalized decision evidence (v53.47, P838)

**Rule**: Values marked `reference` or `none` must never contribute to a trading, health, ranking, or other decision score, even when a numeric value is present in a legacy payload.

**Required**: Normalize historical boolean/descriptive aliases to `decision` / `reference` / `none`; use a purpose-specific decision selector requiring fresh/live status and finite numeric values; keep reference values available to display and research paths; fail closed when required decision coverage is below the model threshold.

**Validation**: `src/data/contracts/evidence.js`, `src/data/selectors/evidence.js`, `src/domain/signal/trading-score.js`, `src/legacy/compatibility-facade.js`, `js/aio-core.js`, and `scripts/ci-esm-core-unit-check.mjs` must retain the reference-only blocking fixture and selector contract.

## R382. Route resources and sensitive-key persistence must be scope-owned (v53.48, P839)

**Rule**: A route/entity mount must invalidate its previous async and chart resources on transition, and API keys must not be automatically mirrored in plaintext IndexedDB.

**Required**: Pass an abortable route scope into route modules and async providers; guard late results with `isCurrent`; register Chart.js instances in a replaceable/disposable registry with a bounded canvas surface; retire legacy plaintext IDB open/read/write/recovery paths and leave only explicit user export/import or encrypted Vault storage.

**Validation**: `src/app/router.js`, `src/app/lifecycle.js`, `src/data/orchestrators/{entity,screener}.js`, `src/data/providers/{entity,screener}.js`, `src/ui/pages/{market,sentiment}.js`, `js/aio-core.js`, `index.html`, and `scripts/ci-runtime-contract-check.mjs` must retain the scope/chart/IDB contracts.

## R383. Ticker action narratives require entity evidence (v53.49, P840)

**Rule**: The ticker route must not emit `WATCH`, entry, or other action language when the selected entity, its finite quote, or market-health evidence is missing. Market-level score context may remain descriptive, but it cannot substitute for entity evidence.

**Validation**: `_aioDefaultDecision('ticker')` must apply an explicit entity/quote/health gate, set `decisionBlocked`, and return a fail-closed action; the runtime contract must retain the missing-evidence fixture markers.

## R384. Vault ciphertext must be versioned and migrate legacy KDF values (v53.49, P840)

**Rule**: Every new Vault ciphertext must carry an explicit envelope version and use the current KDF parameters. Legacy ciphertext must remain decryptable during migration, then be re-encrypted through the current `safeLS` path; no plaintext key copy is permitted.

**Validation**: `_AioVault` must expose v2 envelope/KDF markers, retain the v1 KDF for decrypt only, and `safeLSGet` must re-encrypt legacy values. `ci-portfolio-vault-e2e.mjs` PFE2-09 must prove legacy decrypt plus v2 re-encryption.

## R385. Vertical slices must be executable route contracts (v53.50, P841)

**Rule**: The ten Wave 3 slices must cover every route exactly once, bind lifecycle scope to the canonical page completeness contract, and expose direct-entry, blocked-network, mobile-control, and leave/re-entry evidence. A renderer marker alone is not slice completion.

**Validation**: `src/app/vertical-slices.js`, router slice markers, `ci-vertical-slice-contract-check.mjs`, and `ci-vertical-slice-browser-check.mjs` must remain synchronized; the browser gate must pass all ten slices before the Wave 3 packet is closed.

## R386. Route/resource stability must be proven by a repeated blocking soak (v53.51, P843)

**Rule**: A route can be considered operationally stable only after repeated traversal proves one visible route surface, bounded chart/canvas resources, zero unexpected browser errors, and entity A→B→A re-entry without stale scope writes.

**Validation**: `scripts/ci-route-soak-check.mjs` must run the 17-route order for three laps, emit `_artifacts/route-soak-report.json`, and remain a blocking step in `.github/workflows/ci.yml`; expected offline provider warnings may be filtered only by explicit pattern.

## R387. Operational and public-readiness claims must remain revisioned and operator-explicit (v53.51, P843)

**Rule**: Repository evidence, live certification, and operator review are separate states. A local pass must not imply live revision, edge-header enforcement, provider rights, or a 30-day SLO; public-beta readiness stays blocked until those criteria are observed and closed.

**Validation**: `architecture/visual-state-matrix.json`, `architecture/operations-slo.json`, `architecture/public-readiness.json`, `public-data/operations-status.json`, `_headers`, and `scripts/ci-operations-contract-check.mjs` must share the current revision and explicit operator-required posture.

## R388. Capability claims must be manifest-backed and fail closed (v53.51, P842)

**Rule**: Guide, metadata, and education copy must not imply current/live/automatic/AI-backed behavior or direct action beyond the declared capability status, evidence, and wording constraints.

**Validation**: `src/domain/content/capability-manifest.js`, Guide claim markers/audit, `scripts/ci-capability-claim-contract-check.mjs`, and the architecture/browser Guide assertions must reject forbidden-claim fixtures and report a passing manifest audit.

## R389. Credential persistence must be registry-backed and readback-proven (v53.52, P844)

**Rule**: Provider credentials must use one registry and one save/remove path that returns an explicit result, validates format, performs write/readback verification, and never falls back to an unverified plaintext write or optimistic “saved” UI.

**Validation**: `_AIO_PROVIDER_REGISTRY`, `_aioSaveCredential`, `safeLS`, provider restore/export paths, and `scripts/ci-ai-chat-reliability-contract-check.mjs` must remain synchronized; storage state must stay separate from authentication and connection state.

## R390. AI route readiness must be explicit and fail closed (v53.52, P844)

**Rule**: Chat, briefing, translation, and market-analysis entrypoints must resolve through the shared route contract and distinguish personal-key, no-route, Vault-locked, Worker-not-ready, rate-limit, authentication, and timeout states. A scheduled server analysis success must never imply public chat readiness.

**Validation**: `public-config.json`, `_aioEnsureClaudeRoute`, Worker `/health`, the response contract, and the AI reliability CI contract must reject an unconfigured or unhealthy shared route without inventing an operator/server-key capability.

## R391. AI/data operations must expose five readiness dimensions (v53.52, P844)

**Rule**: Operations status must separately report secret configured, workflow wired, last call succeeded, data current, and licensed for use; durable scheduled analysis and browser/public chat are separate capabilities.

**Validation**: `scripts/build-operations-status.mjs`, `public-data/operations-status.json`, `architecture/operations-slo.json`, and `scripts/ci-ai-chat-reliability-contract-check.mjs` must preserve the separate fields and explicit operator-required states.

## R392. Compatibility entrypoints must be safe during initialization races (v53.53, P845)

**Rule**: Legacy route entrypoints callable by the native compatibility facade must not directly read or write top-level lexical state that may still be in its temporal dead zone during classic-script initialization.

**Validation**: `showPage()`/`showTicker()` must use the initialized `AIO.state` or window shim for early navigation, and the Critical-10, Portfolio Vault, and accessibility browser contracts must remain green.

## R393. Compatibility exports must preserve global call contracts (v53.54, P846)

**Rule**: A classic/deferred script must not shadow an existing global entrypoint with a different arity or return contract. When a legacy name is shared, its overload must preserve the no-argument/one-argument Claude path and the explicit provider-key path, including an explicit async persistence result.

**Validation**: `window.getApiKey`/`window.setApiKey`, `_aioSaveCredential`, the sidebar save flow, and `scripts/ci-ai-chat-reliability-contract-check.mjs` must cover both call shapes; a Chromium smoke must prove storage/readback, masking, and personal-route selection after the final deferred script executes.

## R394. Current-sensitive server prose requires typed metric and source evidence (v53.54, P847)

**Rule**: Automated market analysis must not become public verified prose from status metadata alone. Each current-sensitive numeric/causal analysis must carry typed metric identity, value, unit, observation time, source, and supporting news/source lineage; VIX and Fear&Greed remain separate metrics. Screener revisions and fundamentals must expose their observation/source/model lineage.

**Validation**: `buildMarketAnalysisEvidence`/`validateMarketAnalysisText`, `js/aio-data.js` metric-evidence publish gate, news lineage fields, `scripts/validate-screener-artifact.mjs`, and the data-pipeline contract must fail closed when evidence is missing or inconsistent.

## R395. AI questions must enter through one typed QuestionPlan/Orchestrator (v53.55, P848)

**Rule**: Per-page and unified chat may retain legacy UI/provider code only as guarded compatibility adapters. Intent, entity, timeframe, current-sensitivity, required evidence, capability selection, and dispatch ownership must start in the single ESM AI orchestrator.

**Validation**: `src/ai/orchestrator/{question-planner,capability-planner,answer-orchestrator}.js`, `src/ai/intent/taxonomy.js`, both chat entrypoints, `AIO_ARCH.getAIOrchestrator`, and `scripts/ci-ai-intelligence-contract-check.mjs` must retain the seven representative routing cases and guarded adapter marker.

## R396. Current-sensitive AI answers require MarketSessionEvidence and strict AnswerPlan/ClaimLedger (v53.55, P848)

**Rule**: A current-sensitive numeric answer cannot be displayed from free-form model text. It requires a typed session evidence record and a valid `answer-plan.v1`/`claim-ledger.v1` with value, unit, asOf, source, and evidence IDs for numeric claims; unknown session state must remain explicit.

**Validation**: `src/ai/time/market-session.js`, `src/ai/response/claim-ledger.js`, `js/aio-chat.js`, the shared response pipeline, and the AI intelligence contract must fail closed for missing session/structured claims and pass typed open/unknown fixtures.

## R397. Research-relative rankings must not become confirmed recommendations (v53.55, P848)

**Rule**: Screener rank thresholds are research-relative evidence only. They must preserve `allowedUse: research-relative-ranking-only`, producer `observedAt`, and an explicit blocked operational-use state; `CONFIRMED` is not a valid verdict.

**Validation**: `_aioMakerCheckerVerify`, `_formatScreenerResultPrompt`, the maker-checker renderer, and `scripts/ci-ai-intelligence-contract-check.mjs` must reject `CONFIRMED` and avoid browser-generation timestamps.

## R398. AI post-processing must inherit the response policy (v53.55, P848)

**Rule**: If the shared AI response gate blocks or cannot validate a response, recommendation, chart, scenario, and other generated cards must not reintroduce actionable meaning from the original query.

**Validation**: both chat `onDone` paths must check the shared action gate before post-processing; the AI intelligence contract and runtime/headless tests must retain the blocked-response card fence.

## R399. Domain analysis engines must be deterministic and evidence-bounded (v53.55, P849)

**Rule**: Sector, company, technical, macro, and FX analysis may calculate only from supplied typed inputs. Missing or partial evidence must remain `insufficient`/`partial`; engines must not invent current values, causal certainty, or probability claims.

**Validation**: `src/ai/analysis/{sector,company,technical,macro-fx,registry}.js` and the AI intelligence contract must cover ready, partial, and insufficient fixtures.

## R400. Model benchmark and operations status must not be overstated (v53.55, P849)

**Rule**: A routing corpus score is not live model quality. Reproducible benchmark status requires pinned snapshot/model/prompt/retriever/validator revisions, and production canary/feedback/drift/rollback status remains operator-required until external runtime evidence exists.

**Validation**: `src/ai/eval/benchmark.js`, `src/ai/operations/control-plane.js`, and the AI intelligence contract must preserve the explicit operator gate.

## R401. Research requirement and research capability must remain separate (v53.56, P850)

**Rule**: A question's `ResearchDecision` must be determined from the question and evidence policy, independently of provider keys, quota, Worker health, or user opt-out. Runtime `ResearchCapability` must separately report route, auth, tool, quota, origin, citation, and content-depth readiness; required research must fail closed when those conditions are not met.

**Validation**: `src/ai/research/{decision,plan,evidence,capability}.js`, the chat Research Plan adapter, `getWebSearchAudit`, `scripts/ci-ai-intelligence-contract-check.mjs`, and `scripts/ci-data-refresh-audit.mjs` must preserve typed source floors, explicit unavailable states, and zero published `UNKNOWN` market sessions.

## R402. Chat quote evidence must cross the typed-claim boundary without lossy field mapping (v53.57, P851)

**Rule**: Per-page and unified chat may keep broad educational/framework answers available, but any current numeric quote claim must receive one normalized evidence row with metric, value, unit, scale, asOf, source, sourceKind, status, and evidenceId. Adapter field names such as `price` must not be passed directly to the typed validator.

**Validation**: `normalizeAIChatEvidenceRow`, `getChatAnswerFreshnessAudit`, `getChatEvidenceContext`, the shared typed evidence registry prompt, and T950-T952 in `js/aio-tests.js` must prove valid quote claims pass, the model sees the exact evidence id, and blocked/stale evidence remains fail-closed.

## R403. ResearchDecision/ResearchPlan must be the same evidence gate for every chat surface (v53.58, P852)

**Rule**: Per-page and unified chat may use different UI/provider adapters, but REQUIRED current/causal questions must execute the same ResearchPlan and pass the same primary/independent/snippet-free evidence floor before output is publishable. Citation count or a provider route alone is never sufficient.

**Validation**: the AI intelligence contract checks both surfaces for `_aioEvaluateAIResearchGate`, ResearchPlan dispatch, and fail-closed floor wiring; browser gates must not expose current/causal output while the gate is unresolved.

## R404. Question plans and observation provenance are request-bound (v53.58, P852)

**Rule**: An asynchronous chat request must carry its immutable QuestionPlan in its own request envelope; mutable global plan state is forbidden as a source of truth. Quote/snapshot storage must preserve producer observation/fetch/session/venue/previous-close fields, and missing observation time must remain missing rather than being stamped with ingestion/current time.

**Validation**: static AI/runtime contracts reject `_aioActiveQuestionPlan` reads, require explicit request plans and provenance fields, and verify the sentiment orchestrator does not fall back to `raw.now` for non-`now` fields.

## R405. Partial research results retain their original sub-query identity (v53.58, P852)

**Rule**: `Promise.allSettled` result normalization must retain each fulfilled row's original index before joining `queryId`, purpose, source tier, and content depth. Official host classification must include the canonical FRED `.org` host, and snippet depth must be per document.

**Validation**: AI intelligence CI checks the index-preserving normalization and FRED/snippet provenance markers; research output remains `PARTIAL_RESULTS` when any sub-query fails.

## R406. Accessibility target warnings are blocking (v53.58, P852)

**Rule**: Any audited mobile interactive target below 24px is a release failure unless it is removed or given a measured hit-area exception recorded in the audit. WARN-only target findings are not acceptable.

**Validation**: `ci-accessibility-matrix-check.mjs` fails when `smallTargetCount > 0` and the mobile stylesheet enforces the minimum target size for route controls.

## R407. Quote price/change/previous-close fields must share one producer revision (v53.59, P853)

A quote is an atomic envelope. Do not apply a price, percentage, delta, previous close, observation time, or source field independently from a cumulative multi-producer array. Select one normalized producer revision per symbol before writing PriceStore, DATA_SNAPSHOT, _liveData, or DOM. KRX index percentages require the same envelope's previous close; otherwise render unavailable.

## R408. AI quota must not imply route capability (v53.59, P855)

The AI quota/capacity UI may show available calls only when a personal credential or a healthy shared Worker route is present. `NO_ROUTE`, `WORKER_NOT_READY`, and `WORKER_NOT_CHECKED` are unavailable/readiness states, not quota states.

## R409. Release data revisions must match the published snapshot (v53.59, P856)

`architecture/asset-manifest.json`, `architecture/release-manifest.json`, and `public-data/operations-status.json` must all equal `public-data/market-snapshot.json.revision`. Presence-only revision checks are insufficient for rollback and release traceability.

## R410. Public readiness must mirror measured boot-performance status (v53.60, P857)

When `architecture/operations-slo.json.latestMeasuredBoot.status` is not `TARGET_COMPLIANT`, `architecture/public-readiness.json` must expose `boot-performance: BLOCKED` and `ci-operations-contract-check.mjs` must fail the release gate. Do not relax the measurement window or SLO target merely to convert a non-compliant result into a pass.

## R411. Secondary producers must declare a post-boot phase boundary (v53.62, P858)

**Rule**: Translation, news enrichment, compatibility diagrams, market-state narrative synthesis, pixel-level fallbacks, and other non-critical producers must not execute synchronously inside the first 2s interactive boot or native route transition. They must render a local/unavailable state first and release work through the central phase scheduler or an explicit post-boot queue. Native route ownership must fence duplicate legacy writers before deferred work is scheduled.

**Validation**: `ci-boot-interaction-check.mjs` measures the explicit 2s observation window and enforces request/long-task budgets; `ci-operations-contract-check.mjs` rejects a release unless the recorded boot is `TARGET_COMPLIANT`; architecture/browser and route-soak gates verify the deferred surfaces still settle after navigation.

## R412. Native data readers are the only route-provider boundary (v53.63, P833)

**Rule**: Route providers must read through `src/data/runtime-readers.js` or an explicit
native provider, never through `legacy.read*` projections. Runtime readers preserve
observation/source metadata and fail closed for missing values; compatibility facades
remain limited to navigation/actions and legacy fallback writers.

**Validation**: `ci-architecture-contract-check.mjs`, `ci-architecture-browser-check.mjs`,
and `ci-operator-readiness-check.mjs` must report 17/17 native data owners and no
provider wiring that directly invokes `legacy.read*`.

## R413. Native chart ownership requires a registry, marker, and legacy fence (v53.63, P834-P835)

**Rule**: A route chart can be promoted only when the native module owns its Chart.js
instance through a disposable registry, renders an explicit unavailable state when
history/evidence is absent, marks the canvas and route, and fences every legacy chart
entrypoint that can reach the same canvas. Synthetic history is forbidden.

**Validation**: architecture contracts and Chromium route checks cover native ticker and
portfolio chart markers, bounded canvas resources, and the fenced legacy loaders; route
ownership counts must be recomputed from the manifest rather than edited independently.

## R414. Current decision scores require a typed decision-use grant (v53.64, P860)

**Rule**: A numeric value is not decision evidence merely because it is finite. Native
Trading Score inputs must carry `allowedUse: decision` and a current status; snapshot,
reference, stale, or unavailable rows must remain blocked and must not be replaced by raw
fallback values when a typed evidence row exists.

**Validation**: `src/data/runtime-readers.js`, `src/domain/signal/trading-score.js`, and
`scripts/ci-native-decision-evidence-check.mjs` prove reference/snapshot blocking and
verified-current score production.

## R415. Freshness-scoped news models require observable event time (v53.64, P861)

**Rule**: News sentiment and cycle-risk models may include an item only when its publication
timestamp is finite, not in the future, and inside the requested freshness window. Missing
dates are insufficient evidence, never an implicit current timestamp.

**Validation**: `src/domain/news/scoring.js` and the domain golden fixtures reject undated,
invalid, and future-dated items from current scores.

## R416. Partial portfolio aggregates must remain partial (v53.64, P862)

**Rule**: When any holding lacks the value/cost/current-change evidence required by an
aggregate, the derived total remains unavailable unless an explicit canonical total exists.
Unknown holdings must not be reduced as zero and must not silently enter sector allocation.

**Validation**: `src/domain/portfolio/surface.js` and `scripts/ci-esm-core-unit-check.mjs`
cover partial holdings with null aggregate outputs and no fabricated sector percentages.

## R417. Native secondary theme performance surfaces need one scoped writer (v53.64, P859)

**Rule**: A native themes performance surface must read normalized current/weekly evidence,
render an explicit pending state when the selected period is unavailable, and fence the
legacy writer before a native marker is mounted. Period/view/cache invalidation must use a
route-scoped event rather than mutating the DOM from a second producer.

**Validation**: `src/data/providers/themes.js`, `src/ui/pages/themes.js`, the native marker
fence in `index.html`, and architecture/Chromium contracts cover daily/weekly mode changes
and bounded legacy compatibility.

## R418. Worker reachability, capability, and soak are separate operations states (v53.64, P863)

**Rule**: A deployed Worker URL and one successful health response prove reachability only.
They do not prove GitHub secret/variable wiring, provider rights, AI route readiness, or the
seven-day scheduled soak. Public operations status must expose endpoint, observed health,
capability, and soak independently, and must never promote a proxy or fast plane to CURRENT
solely because Cloudflare shows a deployed script.

**Validation**: `architecture/worker-endpoints.json`, `scripts/ci-fast-plane-live-check.mjs`,
`scripts/build-operations-status.mjs`, and the data-plane workflow/watchdog preserve the
endpoint identity while retaining explicit operator blockers.

## R425. Current news and research lanes are separate (v53.66, P870)

**Rule**: Telegram/news artifacts must publish a rolling `research-14d` window and a separate `kst-0800-completed-24h` lane. Current-facing pages, headers, and summary counters may consume only the completed 24-hour lane and a shared cycle manifest that passes the 12-hour freshness SLA; the rolling window is limited to research memo/chat context. Page requirements must derive from `architecture/route-owners.json`.

**Validation**: `ci-data-pipeline-contract-check.mjs` checks `current24hItems/current24hWindow`, `windowKind`, route SSOT, native news summary, and cycle-manifest fields; the runtime Telegram feed must render only `AIO_TELEGRAM_CURRENT_ITEMS`.

## R426. Decision headers must be explicit mounted route elements (v53.67, P871)

**Rule**: `_aioRenderPageDecisionHeader()` must emit a balanced, discoverable `.aio-decision-header` wrapper for every route, carrying `data-aio-decision-page`, `data-source-kind`, `data-as-of`, and shared market-cut boundaries. Initial route headers must mount immediately when the document is already ready; delayed refresh may reconcile later data but cannot be the only mount path.

**Validation**: headless T915, critical-10 human-surface, architecture-browser, and route-soak checks must pass with zero missing decision headers and zero browser errors.

## R427. Provider session hints must be reconciled with venue schedules (v53.68, P872)

**Rule**: A provider `REGULAR`/`CLOSED` hint cannot override the instrument venue calendar. US/Korea indexes and rates must classify after-close/weekend observations as `MARKET_CLOSED` or `PREVIOUS_CLOSE_EXPECTED` within the completed-close SLA; crypto remains 24/7 and continuous markets retain their own weekend boundary. A completed close may be reference-only, but it must not be discarded as unexpected stale solely because a provider retained `REGULAR`.

**Validation**: `ci-market-snapshot-contract-check.mjs` includes after-close, weekend, provider-regular, Korea, FX, and crypto fixtures; published Tier-0 rows must contain a typed session and quality.

## R428. Data refresh and release manifests must publish one atomic revision tuple (v53.68, P873)

**Rule**: Any refresh that changes `public-data/market-snapshot.json.revision` must promote that revision, cycle ID, and data timestamp into both `architecture/asset-manifest.json` and `architecture/release-manifest.json` before commit. A refresh that silently degrades a previously successful FRED or quote-coverage artifact is not commit-eligible without an explicit LKG marker.

**Validation**: `scripts/sync-data-release-manifests.mjs` and `scripts/ci-refresh-artifact-integrity-check.mjs` run in `refresh-data.yml` and `ci.yml`; `ci-operations-contract-check.mjs` remains the final tuple gate.

## R429. Operations status must derive from the capability it claims (v53.68, P874)

**Rule**: Scheduled AI readiness and last-call status must be derived from `data.meta.marketAnalysisOk`, not from durable market-snapshot publication. Durable data success, semantic analysis success, public chat readiness, and provider rights remain separate dimensions.

**Validation**: `ci-operations-status-check.mjs` compares both scheduled-analysis fields with the current data artifact and fails on false `CURRENT` claims.

## R430. Reference learning surfaces must expose real state and freshness (v53.78, P875)

**Rule**: A reference page must not render a control as functional unless it changes the selected view or explicitly explains why the view is unavailable. Latest/prior filing periods, collection time, and stale-reference status must remain visible in the artifact boundary. Research IDs/statuses may remain in data attributes and evidence ledgers, but the default UI must translate them into user-facing language. Graph depth, evidence links, and learning detail must be measurable in browser/accessibility gates.

**Validation**: `ci-masters-contract-check.mjs`, `ci-masters-browser-check.mjs`, `ci-principles-browser-check.mjs`, `ci-atlas-browser-check.mjs`, and `ci-accessibility-matrix-check.mjs` cover full-row counts, freshness ordering, non-noop views, hop counts, user-facing explanation markers, and zero small targets.

## R431. Source-document coverage must be measured per content unit (v53.79, P876)

**Rule**: Connecting a route, schema, or aggregate artifact is not equivalent to completing the source document. Every published reference node/module must expose its definition, mechanism or chain, user-facing role, observable KPI, limitation/failure condition, and source/review boundary. Remaining domains, player/product records, authored visualizations, or normalization gaps must be listed as open scope rather than hidden behind a generic card.

**Validation**: `scripts/ci-six-doc-coverage-check.mjs` reports document-to-runtime coverage and remaining scope; `ci-atlas-contract-check.mjs` checks all 95 taxonomy nodes and 48 Foundations modules for guide coverage; `ci-principles-contract-check.mjs` and `ci-principles-browser-check.mjs` check the economic spine, 41 nodes, 29 lessons, and 8 paths.

## R432. Domain expansion must preserve publication and normalization boundaries (v53.80, P877)

**Rule**: Adding P1/P2 taxonomy domains or research lessons must extend the user-facing explanation contract and browser count gate without silently promoting current company, production, yield, revenue, or trading claims. SEC 13F sector/weight views must remain unavailable until a verified security master resolves CUSIP, share class, corporate actions, issuer, ticker, and sector; raw row counts alone are not a sector mapping.

**Validation**: `ci-atlas-contract-check.mjs`/`ci-atlas-browser-check.mjs` require 19 domains/95 nodes and 48 module question/visualization frames; `ci-masters-contract-check.mjs` requires `PENDING_VERIFIED_SECURITY_MASTER`, 1,102 raw unique CUSIPs, 1,122 issuer strings, and zero mapped rows until the mapping artifact is verified.

## R433. Educational player/product references require resolved evidence edges (v53.81, P881)

**Rule**: An Atlas player or product record is educational reference data, not a current company claim. Every record must resolve its source IDs to a first-party player/research source, its taxonomy IDs to the canonical node set, and every product to a known player. `asOf` and `productionStatus` must remain null until independently verified publication data exists; shipment, yield, valuation, and live trading language must not be inferred from a role/product record.

**Validation**: `ci-atlas-contract-check.mjs` enforces the registry count, source and taxonomy edge resolution, player/product referential integrity, `EDUCATIONAL_REFERENCE_ONLY` publication status, and null currentness fields; `ci-atlas-browser-check.mjs` verifies the source-linked route renders without browser errors.

## R434. Authored reference artifacts require renderer and coverage gates (v53.83, P884-P887)

**Rule**: Adding explanatory content is complete only when the artifact is connected to the route renderer, every required content unit resolves its related node/source IDs, and the browser gate observes the published count. Short-form educational reference copy must remain distinct from independent long-form authorship, verified current company data, and investment recommendations.

**Validation**: The Atlas, Principles, Masters, and six-document contracts require 48 authored Foundation lessons, 19 Atlas domain guides, 15 Principles chapters/39 lessons covering 60 nodes, and a fail-closed Masters security-master artifact; their Chromium checks verify visible rendering and route behavior.

## R435. Reference currentness overlays must remain educational and status-labeled (v53.84, P888)

**Rule**: A source page check or structural player/product mapping cannot be rendered as verified production state, shipment, yield, revenue, or current investment fact. Any reference overlay must expose its review date and educational basis in user-facing language; unknown values remain unknown.

**Validation**: Atlas contract/browser checks validate currentness status and `statusBasis`; the renderer must not expose raw internal enums as the only user-facing explanation. Masters reference mappings remain separate from the fail-closed verified security master.

## R436. 시장 휴장일 freshness 유예는 완전한 Tier-0 snapshot에만 허용한다 (v53.86, P889)

**Rule**: `data.json`/`market-snapshot.json`의 live-core freshness SLA는 평일과 provider failure에서 반드시 fail-closed로 동작해야 한다. 토·일 유예는 `market-snapshot.json`의 `QG-01_PASS`, Tier-0 required/observed 일치, `errors=[]`가 동시에 확인될 때만 허용하며, 유예는 새 값을 생성하거나 timestamp를 갱신하는 근거가 아니다.

**Validation**: `ci-data-lineage-audit.mjs`의 market-closed predicate와 `ci-refresh-artifact-integrity-check.mjs`를 함께 실행한다.

## R437. 최신 13F 없음과 지연 상태를 구분하는 SEC availability evidence를 기록한다 (v53.87, P890)

**Rule**: `STALE_REFERENCE` 13F는 공시 원문이 오래된 것인지 SEC에 더 최신 분기가 없는 것인지 독립적으로 확인해야 한다. SEC submissions feed의 최신 제출 시점·검증일·source URL·결과를 연결하고, 그 결과를 최신 보유 데이터로 승격하지 않는다. 확인 결과는 사용자에게 표시해 `current`로 오인되지 않게 한다.

**Validation**: `ci-masters-contract-check.mjs`가 Scion의 `NO_LATER_13F_HR_REPORTED` 결과와 SEC submissions JSON URL을 검증하고, `ci-masters-browser-check.mjs`가 Masters 상세 availability note를 검증한다.

## R438. 학습 지도는 의미 단위별 원고와 기본 공개 흐름을 함께 검증한다 (v53.88, P891)

**Rule**: 교육용 지식 그래프는 카드 수나 구조 계약만으로 완료된 것으로 간주하지 않는다. 기본 화면은 대분류→하위 묶음→개념의 학습 순서를 먼저 보여야 하며, 선택한 개념에는 정의·중요성·작동 원리·확인할 지표·앞뒤 연결·실패 조건의 개별 원고가 있어야 한다. 전체 원고·source ID·검토 상태는 기본 지도와 분리된 자료실 또는 접힌 근거 영역에 둔다. 레슨 라이브러리의 정의·작동·사례·반례·검증 질문·도식은 제목별로 고유해야 한다.

**Validation**: `ci-principles-contract-check.mjs`는 60개 node guide와 111개 레슨의 필수 필드·필드별 고유성을 검사하고, `ci-principles-browser-check.mjs`는 기본 7개 Tree 분류·하위 그룹·자료실 분리·개념 상세·관계 라벨·실제 1/2-hop·데스크톱/모바일 흐름을 검사한다. `ci-atlas-browser-check.mjs`는 AI Atlas의 기본 학습 지도와 접힌 근거 영역을 검사한다.

## R439. 분기 비교는 실제 인접 공시와 유한한 사용자 표면을 함께 검증한다 (v53.89, P892)

**Rule**: 13F의 이전 보고분기는 단순히 최신 분기보다 과거이기만 해서는 안 되며, 연결된 filing history에서 확인되는 실제 직전 보고분기여야 한다. resolver는 결과를 stdout에만 남기지 않고 canonical filing artifact에 원자적으로 반영해야 한다. 표 renderer는 row index를 포함한 builder 계약을 보존하고, 버튼 안에 링크를 중첩하거나 입력 rerender로 검색 포커스를 잃게 해서는 안 된다.

**Validation**: `ci-masters-contract-check.mjs`가 7개 신고주체의 인접 분기를 history index에서 재계산하고 index/holdings 비교 건수를 대사한다. `ci-masters-browser-check.mjs`는 변화 원장 `NaN=0`, manager button 내부 link=0, Berkshire 2025-12-31 비교, 다문자 검색 포커스 유지와 데스크톱 overflow 0을 검사한다.

## R440. 참고 자료의 셋업·전력·자료품질 프레임은 관찰용으로만 승격한다 (v53.91)

**Rule**: 사용자 제공 자료에서 추출한 상대강도 눌림, 클라이막스 탑, AI 데이터센터 전력 품질, GPU 재가격, 메모리 LTA 주장은 `REFERENCE` 관찰·검증 질문으로만 연결한다. RVOL·benchmark-relative-strength·충분한 OHLCV·시설별 계측·공식 계약/공시가 없으면 `unavailable` 또는 `추가 셋업 근거 필요`로 fail-closed하며, 현재 수치·확정 신호·매매 권고·가정용 피해를 합성하지 않는다. SCREENER_DB memo와 CHAT_CONTEXTS는 반드시 출처/기준일/검증 경계를 보존한다.

**Validation**: `scripts/ci-esm-core-unit-check.mjs`가 setup-profile 후보·클라이막스·빈 데이터 경계를 검사하고, `scripts/fetch-data.mjs`의 TradingView winner evidence는 ADR·52주·달러 유동성·EMA nullable 필드와 `winnerFilter`로 결측을 fail-closed한다. native screener provider/normalizer/orchestrator와 `AIO_AI_INFRA_CYCLE_REFERENCE`는 source audit·evidence hierarchy·전력품질 측정지표·반증 조건을 reference-only로 연결한다. `ci-version-check.mjs`, `ci-runtime-contract-check.mjs`, `ci-structural-check.mjs`와 `git diff --check`를 함께 통과해야 한다.

## R441. Telegram 다채널 discovery는 source catalog·신선도·실패 상태를 함께 보존한다 (v53.92)

**Rule**: Telegram 채널은 뉴스/자료의 원문이 아닌 secondary discovery 계층이다. required channel catalog에는 채널별 역할·지역·public mirror·evidence tier가 있어야 하며, source가 추가되면 page-topic map·runtime audit·reference ledger·SCREENER_DB/keyword 연결을 함께 갱신한다. 자동 수집 실패 시 기존 성공 artifact와 성공 시각은 보존하되 `collectionStatus=failed`, 시도 시각, 네 채널별 오류 row를 노출해야 하며 실패 결과를 최신 데이터로 승격하지 않는다. 오래된 공개 corpus는 `STALE_REFERENCE`로 표시하고 구독자 수·전달량·동일 내용의 재전달·목표가를 독립 확인으로 세지 않는다.

**Validation**: `scripts/fetch-telegram-digest.mjs`의 `CHANNEL_CATALOG`/`sourceCatalog`/failure-cache, `js/aio-data.js`의 required-channel audit, `_context/RESEARCH-INTEGRATION-2026-08-09-TELEGRAM.md`의 Q1~Q5와 `public-data/user-research-digest.json` reference item을 확인한다. `ci-data-pipeline-contract-check.mjs`, `ci-runtime-contract-check.mjs`, JSON parse, `ci-knowledge-lint-check.mjs`, `ci-version-check.mjs`, `git diff --check`를 함께 통과해야 한다.

## R442. 브라우저 테스트 그룹은 registry·예외·planned/completed invariant를 하나의 release gate로 기록한다 (v53.96, P895)

**Rule**: 모든 그룹은 고유 ID registry를 통해 실행하며, 예외는 synthetic assertion failure로 승격하고 registry count invariant가 깨지면 CI를 중단한다.

**Validation**: `js/aio-tests.js`의 `_TEST_GROUPS`/`runGroupContractSelfTest`, `scripts/ci-headless-tests.mjs`.
## R443. 예상 외 브라우저 runtime 오류와 차단된 외부 네트워크는 서로 다른 상태로 분류한다 (v53.96, P895)

**Rule**: broad `net::ERR_FAILED` ignore는 금지한다. 외부 차단 요청은 request URL과 함께 expected-blocked-network로만 기록하고, pageerror·local requestfailed·예상 밖 console.error는 release-blocking runtime error다. allowlist는 id/scope/pattern/reason/owner/expiresAt와 사용 여부를 가져야 한다.

**Validation**: `scripts/ci-headless-tests.mjs`, `architecture/browser-error-allowlist.json`.

## R444. AI 시장 분석은 claim마다 canonical evidence ID를 가지며 provider 실패도 동일 schema fallback을 낸다 (v53.96, P895)

**Rule**: first-N 뉴스 제목이나 검증되지 않은 oneLine을 게시하지 않는다. metric/news evidence에는 value/unit/observedAt/collectedAt/source/sourceKind/evidenceId/allowedUse/status를 보존하고, `market-analysis.v2` claims/regime/drivers/risks/watch를 evidence-bound로 만든다. provider/key/semantic 실패는 `status=blocked`, `marketAnalysisOk=false`인 동일 envelope로 남긴다.

**Validation**: `scripts/fetch-data.mjs`, `js/aio-data.js`, `scripts/ci-data-pipeline-contract-check.mjs`.

## R445. Worker quota는 atomic reserve/release와 idempotency를 제공해야 하며 legacy KV는 fail-closed다 (v53.96, P895)

**Rule**: KV get→put counter를 production quota authority로 사용하지 않는다. `AIO_QUOTA_DO` 단일 authority가 concurrent cap을 원자적으로 예약하고, idempotency key 또는 body digest로 retry를 dedupe하며, exact HTTPS production origin과 명시된 localhost port만 허용한다.

**Validation**: `cloudflare-worker-proxy.js`, `architecture/worker-endpoints.json`, `scripts/ci-worker-anthropic-check.mjs`.

## R446. route ownership은 native/legacy/not-applicable를 구분하고 revision lanes를 혼합하지 않는다 (v53.96, P895)

**Rule**: static reference route의 chart/narrative 부재를 legacy owner로 표시하지 않는다. supported routes/dependencies는 one manifest에서 파생하고 local/release/live revision·observedAt/source를 별도 보존한다.

**Validation**: `architecture/route-owners.json`, `architecture/dependency-graph.json`, `architecture/baseline.json`, `scripts/ci-baseline-contract-check.mjs`.

## R447. 시장 시간은 event/observed/collected/published와 exchange calendar를 분리하며 calendar 누락은 UNKNOWN이다 (v53.96, P895)

**Rule**: NYSE/KRX timezone/DST adapter와 holiday/half-day/weekend fixture 없이 session을 추론하지 않는다. calendar가 없으면 current/open/closed claim을 만들지 않는다.

**Validation**: `src/ai/time/market-session.js`, `scripts/ci-market-session-contract-check.mjs`.

## R448. SEC fundamental anomaly는 quarantine하고 current/missing/not-applicable classification을 공개한다 (v53.96, P895)

**Rule**: filing metadata와 observed freshness가 없는 값을 decision evidence로 승격하지 않는다. 음수/비정상 metric 및 producer anomaly는 quarantined metrics로 격리하고 `decisionEligible=false`를 유지한다.

**Validation**: `src/domain/fundamental/sec-report.js`.

## R449. 연구 모델은 PIT/walk-forward/holdout/cost/liquidity/parity 상태를 함께 공개하고 검증 전 research-only다 (v53.96, P895)

**Rule**: present-day universe backtest를 live predictive proof로 부르지 않는다. IC/ICIR/hit-rate/decile/drawdown/CI가 있어도 point-in-time universe, turnover/cost/liquidity, live parity가 없으면 `BLOCKED`/`research-relative-ranking-only`다.

**Validation**: `public-data/model-validation-status.json`, `scripts/ci-research-model-contract-check.mjs`.

## R450. CSP·decomposition·operations gates는 local PASS와 live certification을 분리한다 (v53.96, P895)

**Rule**: dynamic sink baseline은 ratchet-only로 관리하고 `_headers` 파일 존재만으로 edge 적용을 주장하지 않는다. hotspot score/owner/code-map rescan과 7/30-day failure/recovery/dedupe SLO artifact를 machine-check하며 local fixture는 live/rights/CSP/SLO를 promote하지 않는다.

**Validation**: `architecture/security-sink-baseline.json`, `architecture/decomposition-hotspots.json`, `public-data/operations-slo-window.json`, corresponding CI scripts and operator readiness gate.

## R451. 학습 필드 존재와 백과사전급 깊이를 분리해 인증한다 (v53.98, P896)

**Rule**: 짧은 definition/mechanism/example 필드가 모두 존재한다는 이유만으로 long-form 또는 백과사전 원고로 판정하지 않는다. 요약과 심층 article을 분리하고, core article은 분량 하한과 함께 직관·형식 모델 또는 해당 없음 근거·구조화된 worked example 또는 비정량 근거·반례·claim 직접성·실물경제→기업→재무제표→밸류에이션→시장→트레이딩 적용·무효화·용어·회상 질문을 통과해야 한다. persona 시나리오 QA는 실제 참여자 연구와 별도 상태로 기록한다.

**Validation**: `scripts/audit-knowledge-encyclopedia-depth.mjs`, `_artifacts/knowledge-encyclopedia-depth-audit.json`, `scripts/ci-atlas-contract-check.mjs`, `scripts/ci-atlas-browser-check.mjs`, `_context/MARKET-PRINCIPLES-ATLAS-AUDIT-CONTRACT-2026-08-10.json`.

## R452. 지식 그래프·출처·artifact 상태는 실제 consumer와 같은 해석기로 인증한다 (v53.99, P897)

**Rule**: node/edge/source 개수와 필드 존재만으로 지식 페이지의 구조 연결을 인증하지 않는다. 실제 export와 JSON을 읽어 endpoint·duplicate·component·orphan·typed metadata를 계산하고, renderer가 사용하는 전역 evidence resolver에서 모든 참조 ID와 URL을 확인한다. entity capability와 개별 product의 taxonomy 연결을 분리하며 대표 오연결은 negative control로 고정한다. 다중 artifact는 capability별 성공/실패 상태를 보존하고 한 실패를 전체 fallback으로 확대하지 않는다. 기준 구현이 생겨도 심층 본문·claim directness·학습 상태·실사용자 연구 완료로 승격하지 않는다.

**Validation**: `src/domain/knowledge/graph.js`, `src/domain/knowledge/evidence.js`, `src/data/knowledge/load-capabilities.js`, `scripts/ci-knowledge-core-semantic-check.mjs`, `scripts/ci-principles-contract-check.mjs`, `scripts/ci-atlas-contract-check.mjs`, `scripts/ci-atlas-browser-check.mjs`, `_context/MARKET-PRINCIPLES-ATLAS-AUDIT-CONTRACT-2026-08-10.json`.

## R453. AI Research는 하나의 실행 결과 계약과 관측된 capability 증거로만 공개한다 (v54.0, P898)

**Rule**: 외부 검색 adapter, Claude native search, unified chat, per-page chat이 서로 다른 evidence shape·준비 경로·판정 로직을 가져서는 안 된다. canonical 결과는 `researchEvidence.evidenceDocuments`를 SSOT로 사용하고 모든 공개 표면은 동일한 실행형 evidence floor를 통과해야 한다. 대화 route나 Worker health만으로 검색 도구·인용·quota 준비를 `READY`로 표시하지 않으며 실제 인용 성공 전에는 미검증 상태를 유지한다. 공급자/하위 쿼리 실패 원인은 진단용으로 보존하되 사용자에게 raw 오류를 노출하지 않는다. 공식 출처는 정확한 hostname 경계로 판정하고 snippet-only·위장 도메인·출처 수 미달은 현재성 주장을 차단한다.

**Validation**: `src/ai/research/evidence.js`, `js/aio-chat.js`, `js/aio-core.js`, `scripts/ci-ai-intelligence-contract-check.mjs`, `scripts/ci-ai-chat-reliability-contract-check.mjs`, `js/aio-tests.js` G109/T1042~T1047, `scripts/ci-headless-tests.mjs`.

## R454. Service-worker takeover fixture는 1회 reload 전후 상태를 보존해 검증한다 (v54.0, P899)

**Rule**: `controllerchange` fixture는 현재 runtime이 요구하는 guarded reload를 navigation failure로 취급하거나 navigation마다 가짜 controller를 구버전으로 초기화해서는 안 된다. controller version·query/change counters를 reload 경계에 보존하고, main-frame navigation이 정확히 한 번 증가하며 재탐색된 SW가 현재 앱 버전과 일치하고 mismatch/reload guard가 정리되는지 검증한다.

**Validation**: `scripts/ci-sa-03-sw-controller-fixture.mjs`를 연속 두 번 실행한다.

## R455. 변동 데이터 게이트는 실제 관측과 완전한 unavailable 튜플을 모두 실행 검증한다 (v54.1, P900)

**Rule**: 뉴스처럼 외부 공급자 실패가 정상적으로 발생할 수 있는 카테고리는 비어 있다는 사실만으로 통과시키지 않는다. 실제 관측 배열이 존재하거나, producer가 정의한 성공 플래그·건수·배열이 모두 명시적 unavailable 튜플로 일치할 때만 통과한다. 서로 참조하는 요약 인덱스와 원본 artifact는 동일 retained count와 collection status를 가져야 하며, 불일치 시 최신 원본을 기준으로 재생성한다. 실패를 과거 데이터·placeholder·합성 항목으로 덮지 않는다.

**Validation**: `scripts/ci-static-data-contract-check.mjs`, `scripts/ci-atlas-contract-check.mjs`, `scripts/ci-six-doc-coverage-check.mjs`, `scripts/ci-knowledge-core-semantic-check.mjs`.

## R456. AI 채팅은 단일 QuestionPlan→Evidence→AnswerPlan 계약으로 종단간 검증한다 (v54.2, P901)

**Rule**: 모든 AI 표면은 같은 `QuestionPlan`의 의도·엔티티·현재성·필수 근거로 소스 fan-out과 Research를 결정하고, 모델은 하나의 `AI_ANSWER_PLAN` 계약을 생산한다. 각 current claim은 실제 주입 근거의 ID뿐 아니라 metric/entity/value/unit/scale/asOf/source가 일치해야 한다. 동일 ID의 상충 관측을 first-wins로 숨기거나 모델 라벨로 다른 지표처럼 표시하지 않는다. 검색 후보·문서 링크는 현재 숫자를 증명하지 않는다. 안전 분류는 사용자 query의 행위 요청과 모델 response의 실제 지시를 분리하여 검사하고, 일반적 위험·규제 설명을 법률·세무 자문으로 오인하지 않는다. 무관한 fan-out, 히스토리 중복, 재시도 옵션 소실, 실제 수신과 다른 출처 배지, 보정 없는 확률을 금지한다. 조건부 가격·비중 분석과 실제 실행 경계는 후속 R460/R461을 따른다.

**Validation**: `scripts/ci-ai-intelligence-contract-check.mjs` 30-case routing/AnswerPlan fixtures, `scripts/ci-ai-chat-reliability-contract-check.mjs`, `js/aio-tests.js` T934a/T934b/T937a/T990a, `scripts/ci-headless-tests.mjs`, and both chat surfaces' source/follow-up/history assertions.

## R457. 변동 원본 artifact와 파생 인덱스는 producer가 원자적으로 발행하고 실제 Git index에서 검증한다 (v54.2, P902, v56.33 P1204)

**Rule**: 자동 갱신 producer가 retained count·revision·collection status를 바꾸면 그 값을 참조하는 요약·인덱스 artifact를 같은 실행에서 재생성하고 같은 커밋에 stage해야 한다. producer 직후 worktree gate는 **실제 commit blob**의 증거가 아니므로, commit 전에는 `git show :path` 또는 동등한 Git-index reader로 canonical artifact 묶음을 다시 검증한다. staging은 `|| true`나 존재 확인과 결합된 단락 성공으로 삼키지 않고, guard가 있는 `stage_if_exists`는 존재할 때의 `git add` 실패를 그대로 전파한다. 배포 직전 수동 숫자 수정은 producer 수정을 대신하지 못한다. CI는 현재 값 일치뿐 아니라 producer assignment·workflow staging 배선·staged-content 계약을 함께 검증한다.

**Validation**: `scripts/fetch-telegram-digest.mjs`, `.github/workflows/refresh-data.yml`, `scripts/ci-data-continuity-check.mjs`, `scripts/ci-masters-contract-check.mjs --staged`, `scripts/ci-data-pipeline-contract-check.mjs`, `scripts/ci-atlas-contract-check.mjs`, `architecture/qa-pipeline.json`.

## R458. AI edge Worker는 소스·배포·readiness를 하나의 릴리스 계약으로 닫는다 (v54.3, P903)

**Rule**: `cloudflare-worker-proxy.js`의 로컬 테스트나 Pages 배포만으로 공유 AI 채팅을 완료로 판정하지 않는다. production Worker는 단 하나의 `/anthropic` 핸들러와 원자적 Durable Object quota authority를 사용하고, pinned Wrangler workflow가 Cloudflare/Anthropic 시크릿을 요구하여 같은 canonical source를 배포해야 한다. 배포 후 `/health`가 configured·quotaConfigured와 실제 authority readiness를 보고하고, production CORS preflight·비허용 Origin 403·한국 경로를 포함한 최소 upstream 200을 통과해야 public chat을 `CURRENT`로 승격한다.

**Validation**: `worker/wrangler.proxy.toml`, `.github/workflows/deploy-ai-proxy.yml`, `scripts/ci-worker-anthropic-check.mjs`, `scripts/ci-operations-contract-check.mjs`, live Worker smoke, `public-data/operations-status.json`.

## R459. Provider 허용 지역은 location hint가 아니라 관할권 실행 증거로 고정한다 (v54.4, P904)

**Rule**: Durable Object locationHint나 Worker placement는 best-effort/ingress 설정이므로 provider outbound 지역 보장으로 인증하지 않는다. 지역 제한 provider의 공유 경로는 jurisdiction-restricted subnamespace와 versioned object identity를 사용하고, 객체 내부에서 자신의 jurisdiction을 검증해 불일치 시 upstream 전에 fail-closed해야 한다. public health는 binding 존재가 아니라 해당 authority를 실제 호출해 jurisdiction·secret readiness를 확인하고, 배포 smoke는 provider 200과 authority 응답 헤더를 함께 검사한다.

**Validation**: `cloudflare-worker-proxy.js`, `scripts/ci-worker-anthropic-check.mjs` US positive/non-US negative controls, `scripts/ci-operations-contract-check.mjs`, `.github/workflows/deploy-ai-proxy.yml`, live `/health`와 한국-origin `/anthropic`.

## R460. 소수 사용자용 금융 안전 경계는 답변 범위와 실제 실행 위험을 분리한다 (v54.4, P905)

**Rule**: 옵션, 세법, 규제, 개인화, 어떻게 같은 단일 키워드나 그 조합으로 금융 질문 전체를 차단하지 않는다. 단일 ESM conduct policy가 request mode를 QuestionPlan과 최종 response gate에 함께 제공한다. 일반 개념·상품 구조·시장 영향·조건부 투자·개인화 법률/세무 분석은 전제·관할·기준일·근거·계산·불확실성을 표시해 답변한다. 차단 범위는 불법 행위의 구체적 실행법, 주문·계정 변경 같은 외부 상태변경, 동의 없는 포트폴리오 데이터 사용으로 제한한다. 적합성 맥락·현재 근거·확률 보정이 부족하면 답변 전체를 안전 모드로 교체하지 말고 limitation으로 전달하며 typed claim/evidence gate가 해당 주장만 통제한다.

**Validation**: `src/ai/policy/conduct.js`, `src/ai/orchestrator/question-planner.js`, `scripts/ci-ai-intelligence-contract-check.mjs` conduct corpus, `js/aio-tests.js` T988~T990b, 두 UI 공통 response pipeline.

## R461. 공급자·근거 장애는 답변 전체가 아니라 영향받는 주장 범위만 저하시킨다 (v54.4, P906)

**Rule**: Web Research, 시장 세션, current claim 구조화가 실패해도 불법 실행·mutation·typed claim 불일치가 아니라면 모델의 일반 원리, 기존 검증 근거, 정성 및 조건부 분석을 삭제하지 않는다. 공통 response pipeline이 `blocked:false`, `degraded:true`, 명시적 limitation을 만들고 모든 UI는 이를 그대로 렌더한다. UI별 후행 오류 문구로 모델 답변을 다시 덮어쓰지 않는다. 최신 사실·수치·원인 단정만 확인 보류하며, 검증된 claim 불일치나 출처 권리 위반은 기존 claim/evidence gate가 별도로 차단한다.

**Validation**: `js/aio-chat.js`, `index.html`, `js/aio-tests.js` T990c/T990d, `scripts/ci-ai-intelligence-contract-check.mjs`, `scripts/ci-runtime-contract-check.mjs`.

## R462. 다중 공급자 coverage 계약은 partial 상태를 성공·실패 lineage와 함께 보존한다 (v54.4, P907)

**Rule**: 요청된 공급자/채널 topology와 이번 실행의 성공률을 분리한다. 모든 요청 행과 source catalog가 존재하고 실패 행에 원인이 있으면 `partial`을 구조적으로 유효한 저하 상태로 인정하되 `ok`로 승격하지 않는다. `successfulCount`와 오류 행 수가 전체 수에 합산되지 않거나 요청 행이 사라지면 차단한다. 전체 실패 fallback을 허용하면서 부분 성공을 거부하는 비단조 계약을 만들지 않는다.

**Validation**: `scripts/ci-six-doc-coverage-check.mjs`, `scripts/ci-atlas-contract-check.mjs`, `public-data/telegram-digest.json`, `scripts/fetch-telegram-digest.mjs`.

## R463. AI readiness는 저장된 credential이 아니라 실제 선택된 endpoint를 검증한다 (v54.5, P908)

**Rule**: 개인 키와 Worker URL이 동시에 존재해도 route resolver가 선택한 endpoint의 인증·health만 readiness 근거로 사용한다. Worker target을 개인 키 존재로 통과시키거나 UI가 다른 route를 표시하면 안 된다. Deep health의 동시 호출은 URL별로 합치고, 일시 실패 TTL은 성공 TTL보다 짧아야 한다. 비공개 지인 공유의 explicit Worker URL을 공개 설정에 자동 게시하지 않는다.

**Validation**: `scripts/ci-ai-chat-reliability-contract-check.mjs`, `_aioClaudeTarget`, `_aioEnsureClaudeRoute`, `getLLMRouteReadiness`, `public-config.json`.

## R494. 관측 불가능한 경제변수와 기업 목표는 관계 지도에서도 시점·추정·반증 경계를 보존한다 (v54.25, P937)

**Rule**: 중립금리(r*)처럼 직접 관측할 수 없는 변수는 모델·기대값·오차 범위·데이터 vintage 없이 현재 단일값으로 용어집이나 판단층에 고정하지 않는다. 기업 Investor Day의 장기 계약·기술 로드맵·non-GAAP 목표는 `DATED_COMPANY_REFERENCE`로만 보존하고 현재 실적·매출·현금·valuation으로 승격하지 않는다. 관계 지도는 모든 노드에 정의·중요성·작동 원리·확인 지표·반증 조건을, 모든 edge에 방향·의미·criticality를 가지며 source→artifact→Atlas/Principles/Screener consumer와 접근 가능한 텍스트 대안을 함께 검증한다. 제3자 시각화의 자체 기업·관계 수는 복제하지 않고 정보 구조만 참고한다.

**Validation**: `scripts/ci-atlas-contract-check.mjs`, `scripts/ci-knowledge-currentness-separation.mjs`, `scripts/ci-knowledge-article-contract.mjs`, `public-data/knowledge/relationship-guides.json`, Atlas Chromium browser check.

## R503. reference-depth·currentness·provider-review는 서로 다른 승격 단계로 보존한다 (v54.36, P943)

**Rule**: 1,200자 이상 원문, semantic field, worked example, dated fact 연결, current-evidence ledger, raw 13F CUSIP 집계는 각각 해당 구조와 출처 연결만 인증한다. 이를 human semantic review, independent directness review, current operational/financial/production claim, verified ticker·sector·corporate-action mapping, 또는 recruited-user validation으로 승격하지 않는다. 외부 provider 권한·갱신 실패·stale artifact는 기존 LKG를 보존하면서 `STALE`/`RESEARCH_REQUIRED`/`REVIEW_REQUIRED`/`BLOCKED` 상태와 원인을 남긴다.

**Validation**: `scripts/audit-knowledge-encyclopedia-depth.mjs`, `scripts/ci-knowledge-web-research-dossier.mjs`, `scripts/build-atlas-current-evidence-ledger.mjs`, `scripts/build-13f-issuer-aggregates.mjs`, `scripts/ci-data-refresh-audit.mjs`, `_context/QA-CHECKLIST.md`.
