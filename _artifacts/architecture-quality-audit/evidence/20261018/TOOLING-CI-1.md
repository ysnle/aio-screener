> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# CI tooling first60 — 진행 중

범위: scripts/ci-*.mjs 경로정렬 첫60에서 root 전문 검토 완료인 ci-decomp-hotspot-check.mjs를 제외하고 다음 ci-headless-tests.mjs를 포함한 60개. 원본 1,652,692바이트. 제품 소스 수정·producer·네트워크·commit·게이트 실행 없음.

현재 직접 전문 의미 읽기 완료 25개, 나머지 35개는 NOT_READ. SHA256·문자/줄 범위는 tooling-ci-1.tsv 참조. 적정은 실행 PASS가 아니다. 107개 DATA-AI 감사와 별도 집계한다.

## C5 — architecture browser source-label 검사의 은퇴 DOM 참조

ci-architecture-browser-check.mjs는 앞에서 macro-2y-value가 retired라 없음을 확인한다. 이후 QA-CRED-05는 같은 id와 macro-2y-source를 읽고 twoYearValue.trim()이 참일 때만 FRED/DGS2 출처표시를 요구한다. 정상적으로 은퇴 DOM이 없는 현행 화면에서는 source-label 검사가 항상 건너뛰어진다. PRIVATE_ROUTE_REQUIRED 검사는 여전히 실행되므로 전체 credential gate가 무효는 아니다. 최소 대안: 현행 macro-board 지표·출처를 선택하고 fixture 값 표시부터 positive precondition으로 assert. 검증법: 출처표시를 없앤 격리 fixture에서 실패 확인. 정적 확인, 브라우저 미실행.

## C6 — generated parity gate가 실패한 작업트리를 변경

ci-generated-release-parity-check.mjs는 실제 sync-data-release-manifests.mjs를 현재 cwd에서 실행한 뒤 hash 차이가 있으면 exit1한다. before bytes도 보관하지 않아 mismatch·partial failure 변경이 남는다. 반론: disposable CI에서는 복구 필요가 작고 재생성 차이를 잡는 목적은 타당하다. local affected/full에서는 검증이 dirty generated 파일까지 바꿀 수 있다. 최소 대안: generator --check 또는 tmp 출력 비교. 검증법: outdated manifest인 격리 copy에서 실패 전후 원본 bytes 동일 확인. 이번 agent는 generator 실행하지 않았다.

## C7 — fast-plane live gate가 불완전 quotes를 complete로 PASS 가능

ci-fast-plane-live-check.mjs의 quotes 검사는 status=published·revision과 declared tier0Observed<tier0Required만 본다. coverage field가 없으면 undefined<undefined는 false라 통과한다. health도 required=observed=0을 허용한다. quotes 배열·실측16종 identity·attemptedAt·관측시각·health/quotes revision을 대조하지 않는다. 반론: worker는 별도 validation을 하며 endpoint smoke 목적도 있다. 하지만 complete published snapshot과 live coverage 인증에는 부족하다. 최소 대안: 기존 validateMarketSnapshot 재사용과 health revision 대조. 검증법: published+revision만 있는 JSON, 선언16/16+빈quotes, 구revision 부정fixture. 정적 확인, 네트워크 미실행.

## C8 — CSP ratchet가 js/src 파일을 수집하지 않음 (실행 재현은 root)

ci-csp-ratchet-check.mjs collect 조건의 join('', '')는 '.'이므로 js./src. 접두사를 찾는다. 실제 js/foo.js 또는 js\\foo.js는 모두 탈락해 files에는 index.html만 남는다. production js/src의 innerHTML·eval/new Function 증가가 집계되지 않는다.

반론: index.html과 _headers 검사는 살아 있고 별도 architecture ratchet도 일부 legacy sink를 세지만 전체 js/src 범위를 대신하지 못한다. 최소 대안: collect가 js/src만 재귀하므로 endsWith('.js')만으로 충분하다. 검증법: 양 디렉터리 sink fixture의 count 증가와 scannedFiles를 확인.

이 agent의 증거는 collector 원문 정적 확인. 이후 root가 read-only gate와 원문 collector를 실행해 files=index.html 1개, 실제 js/src JS391개·innerHTML210개 누락 및 gate=0/450 PASS를 재현했다고 전달했다. 실행증거는 별도 csp-coverage-result.json을 참조한다. 이 agent의 전문 읽기·정적 증거와 root 실행 증거를 구분한다.

## C3 — architecture gate가 실행과 무관한 fence 주석을 강제

ci-architecture-contract-check.mjs는 P789/P790/P797/P798/P799/P831/P859의 영문 fence 주석 원문을 includes로 요구한다. 주석만 삭제/정리해도 native DOM동작·fence·route가 동일한 채 release gate는 실패한다. 이전 P791–796 주석 pin은 같은 파일의 설명대로 이미 무의미해 제거했는데 같은 종류의 잔존 pin은 남는다. 코드의 실제 barrier 조건과 브라우저 ownership 검사는 이미 별도로 존재한다.

반론: 은퇴 symbol/DOM의 부재 pin은 재도입 차단이라는 의미가 있으므로 일괄 제거 대상이 아니다. 이 finding은 실행되지 않는 fence 설명 주석의 존재 pin에 한정한다.

최소 대안: fence 주석 pin만 제거하고 기존 동작·writer부재·browser ownership 검사를 유지. 검증법: 해당 주석만 제거한 격리 copy에서 동작 fixture는 동일하고 gate가 실패하는지 확인. 이번에는 소스 변경·gate 실행 없이 판정식을 읽었다.

## C4 — assertion trace 수집기가 실제 assertion API 일부를 전혀 수집하지 않음

ci-assertion-trace-check.mjs의 LABEL_RE는 첫 인자가 문자열인 check/_assert만 수집한다. ci-ai-premise-check·ci-company-analysis-fixture·ci-connection-access-check의 node:assert.equal/ok 계열은 전부 수집 밖이고, ci-capability-claim-contract-check의 check(condition,message)도 수집하지 않는다. 그런 형태로 새 회귀검사를 추가하면 trace 근거가 없어도 새 assertion이라는 사실 자체가 보이지 않는다.

반론: 문서 도입부는 기존 check/_assert debt를 대상으로 선언하며, 현재 fixture에는 파일/메시지별 P근거가 이미 있는 것도 많다. 현재 assertion이 모두 미추적이라는 뜻은 아니다. AGENTS의 새 assertion trace 의무를 전체에 강제하는 gate로 해석할 때의 실제 사각지대다.

최소 대안: 사용 중인 assertion 호출형태를 수집하고 메시지 또는 명시된 파일-level P/release근거를 인정. 단순 count를 수집·검사범위와 함께 보고해 0수집 파일이 숨지 않게 한다. 검증법: 새 unlabeled assert.equal 및 condition-first check fixture가 실패하고 근거 추가 후 통과해야 한다. 정적 확인이며 실행하지 않았다.

## C2 — premise SLA negative fixture가 원래 검증을 시험하지 않음

scripts/ci-ai-premise-check.mjs는 row의 freshnessMs=24h를 그대로 둔 채 freshnessMaxAgeMs=1만 추가한다. 실제 premise 구현은 freshnessMs를 우선하므로 1ms SLA는 적용되지 않는다. 동시에 observedAt을 requested period.start로 바꿔 period.end 이전이라는 독립적인 거부 사유를 만든다. freshness grant 검사 자체가 사라져도 이 assertion은 UNVERIFIED로 통과 가능하다.

반론: 다른 fixture가 stale status·future time·period mismatch는 검사하며 제품이 실제 SLA를 무시한다는 뜻은 아니다. 이 특정 회귀검사의 검출력이 부족한 문제다.

최소 대안: valid row의 freshnessMs만 1로 바꾸고 observedAt·period·모든 다른 grant를 유지한다. freshnessMaxAgeMs alias를 검증하려면 우선필드 freshnessMs를 제거한다. 검증법: SLA검사만 제거한 mutation에서 그 assertion이 실패해야 한다. 증거는 fixture와 우선순위 조건 정적 확인; 이번에 mutation/QA를 실행하지 않았다.

## C1 — 접근성 gate의 accessible-name oracle와 잘린 target 판정

scripts/ci-accessibility-matrix-check.mjs의 name 함수는 aria-label/title/textContent/value만 읽는다. label 없는 select는 option text 전체가 이름으로 취급되고 label 없는 checkbox는 기본 value=on으로 PASS 가능하다. 반대로 aria-labelledby 또는 연결 label로 실제 이름이 있는 input은 무명으로 오판할 수 있다. smallTargets를 80개로 자른 뒤 위반을 필터하므로 먼저80개가 예외인 화면은 그 다음 실제 위반을 누락한다.

반론: gate는 certificationStatus=PARTIAL_AUTOMATED와 수동 한계를 명시한다. WCAG 전체 인증을 주장하지는 않는다. 그러나 자동 확인한다고 선언한 named control·24px target 축 자체에서 false PASS/false FAIL이 가능하다.

최소 대안: 연결 label/aria-labelledby를 포함한 실제 accessible-name 검사를 사용하고 위반 판정은 전체에서 수행한 뒤 보고용 표본만 자른다. 검증법: label없는 select/checkbox, aria-labelledby input, 앞80개 예외+81번째 target 위반 fixture. 증거: 판정식 정적 확인; gate·browser 실행하지 않음.

완료: ci-13f-currentness-check, ci-13f-semantic-hash-check, ci-baseline-contract-check, ci-capability-claim-contract-check, ci-company-analysis-fixture.

관찰: 13F currentness의 행동 fixture는 타당하지만 workflow·UI 문구 regex는 실행 currentness 증거가 아니다. Capability gate도 실제 DOM의 표시문구 대신 marker와 금지문구 pin을 감사한다. 이는 해당 게이트의 구조증거 범위이며 아직 실제 false PASS 반례로 주장하지 않는다. 단순한 대안은 기존 행동 fixture를 보존하고 소스 pin은 명시된 wiring check로 보고하며 live/currentness는 별도 artifact·브라우저 증거로 남기는 것이다.

root가 확인한 QA cache static import closure 누락21개 및 fingerprint 동일 반례는 이 agent가 재조사하지 않는다.
