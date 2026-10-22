> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 격리 재현된 계약 문제

2026-10-18, 로컬 v57.98. 실제 소스 모듈을 사용하되 합성 입력/최소 DOM/메모리 mutation을 주입했다. 네트워크·producer·유료 AI·실브라우저·배포 실행은 없다. 아래는 현재 입력의 실제 발생 빈도나 전체 릴리스 실패 인증이 아니다.

| ID | 반례와 영향 | 최소 변경 및 회귀 확인 |
|---|---|---|
| C01 | 검색 input/reset을 지운 뒤 대기 응답이 도착하면 이전 후보가 다시 붙음 | clear도 generation을 갱신. clear→resolve/정상 조회/새 query 비교 |
| C02 | `knowledge-repository`의 검사 대상 repository.js bytes를 바꿔도 QA cache fingerprint 동일. gate script 변경 대조군은 달라짐 | 실행 코드의 local import closure를 입력에 결속하거나 누락 inputs를 추가하고 closure 누락 게이트. 다른 20개는 정적 누락 후보 |
| C03 | NOT(price.close≥50)에서 가격40→60으로 passed→rejected, resultHash 변경인데 calculationInputId 동일 | AST 공통 walker가 not.child도 순회. 참조 가격 변화만 identity에 반영하는 대조군 유지 |
| C04 | 30행의 두 상수 팩터가 rho0·독립 신호2로 표시. 같은 방향으로 변하는 두 팩터 대조군은 rho1·신호1 | 분산0은 계산 불가로 남기거나 활성 정보 집합에서 제외. 결측을 독립성으로 치환하지 않음 |
| C05 | 2일 minHold, 매일 강한 동일 입력 6번에도 NEUTRAL 유지. 3일 간격 대조군은 RISK_ON | observedAt과 enteredAt/lastTransitionAt 분리. 변화 없는 관측으로 진입시각을 갱신하지 않음. 현재 제품 caller 미확인, 잠복 모델 결함 |
| C06 | _valuationPrice100·forward EPS5이면 PER20이지만 normalize 후 가격 필드 유실로 view null | 가격의 canonical whitelist 보존. 적자 trailing/pePrice 부재의 실제 소비 경계 확인 |
| C07 | AI 재무 시각화의 빈 순이익 문자열 4개가 실제0과 똑같이 순이익률0% 4개로 렌더됨 | 기존 null-aware 분기 parser 재사용. missing/0/negative 세 대조군 |
| C08 | 상대 수익률 두 선의 날짜가 7/1~20과7/2~21이어도 동일 x index에 배치, caption은 첫 선 기간만 표시 | 완료일 교집합으로 정렬·같은 기준일 rebasing. 부족하면 보류/기간 명시 |
| C09 | SW activate가 another-app-v4 캐시도 삭제. 현행 두 AIO 캐시는 보존 | AIO 소유 prefix/scope의 과거 캐시만 정리. 실제 타 앱 동시 존재 여부는 미확인 |
| C10 | verify-aio expectText는 hidden 텍스트를 통과시키고 관측값은 빈 문자열로 반환 | 표시 조건과 실제 text 조건을 같은 predicate에서 확인. hidden/visible/placeholder 대조군 |
| C11 | 실질금리5일 -20bp·기대인플레 -1bp에서도 ‘실질금리 상승 부담 지속’ 설명 | 지배 성분과 변화 부호를 분리해 상승/하락/상쇄 분기를 검증. 하락을 무조건 주가 상승으로 단정하지 않음 |
| C12 | 상승하던 TNX를 끝6세션만 missing으로 두면 buildMarketRegime에서 null.yearPosition 예외. 동일60세션 금리 완비 대조군은 정상 | stale/missing 축은 unknown을 반환하고 현재 유효 tnx가 있을 때만 held 설명 계산. 이전 latch 기록과 현재 입력 적격성을 분리 |
| C13 | CDN 실패 차트 fallback에서 [10,null,20]이 [10,0,20]과 완전히 같은 세 점으로 그려짐 | null/0 구분·날짜 간극 보존. 차트 종류·축·단위를 보존할 수 없으면 명시적 표시 불가 상태와 기존 수치 근거 제공 |
| C14 | CSP sink ratchet은 js./src. prefix를 찾아 JS391개를 전부 누락. 실제 gate는 index만 읽고 innerHTML0/450 PASS | directory collector를 올바른 경로로 제한하고 수집 파일 집합 자체를 검증. sink 수는 공격 가능성이나 취약점 수가 아님 |

소스 위치: C01 compatibility-globals.js 246/272~280; C02 qa-runner.mjs 436~455와 qa-pipeline.json의 해당 gate inputs; C03 screen-engine.js 155~185; C04 factor-overlap.js 73~86; C05 regime.js 29~49; C06 normalize/screener.js 115와 consensus-read.js 27; C07/C08 ai-answer-visuals.js 122~124/164~179.

- C01: [실행 코드](./reproduce-search-race.mjs), [관측 JSON](./search-race-result.json)
- C02: [실행 코드](./reproduce-cache-identity.mjs), [관측 JSON](./cache-identity-result.json), [21개 입력 누락](./cache-input-review.json)
- C03~C06: [실행 코드](./reproduce-domain-contracts.mjs), [관측 JSON](./domain-contract-result.json)
- C07~C08: [실행 코드](./reproduce-answer-visuals.mjs), [관측 JSON](./answer-visual-result.json)
- C09: [실행 코드](./reproduce-sw-activation.mjs), [관측 JSON](./sw-activation-result.json). sw.js220~229. 캐시 이름 map은 SW route scope 자체로 격리되지 않는다. 같은 storage 환경에 다른 앱 캐시가 있을 때의 영향이며 실제 공존 상태는 미확인이다. [W3C Service Workers](https://www.w3.org/TR/service-workers/#cachestorage-interface).
- C10: [실행 코드](./reproduce-verification-helper.mjs), [관측 JSON](./verification-helper-result.json). canonical verify-aio lib/drive.mjs 28~41.
- C11~C12: [실행 코드](./reproduce-market-reading.mjs), [관측 JSON](./market-reading-result.json). market-read.js571~576/1104~1121. C12는 공유 model 예외로 수정 우선순위가 높다. UI renderHomeRegime/renderRegimePage가 이 함수를 직접 부르고, AI context는 예외를 삼켜 관련 문맥을 누락할 수 있다. 실제 배포에서 발생했다는 증거는 없다.
- C13: [실행 코드](./reproduce-chart-fallback.mjs), [관측 JSON](./chart-fallback-result.json). index.html6801~6810의 실제 inline coordinator를 실행했고, CDN·canvas는 mock이다. 같은 파일의 실행 가능한 inline script3개도 syntax parse했다. HTML/CSS 전체 검증은 아니다.
- C14: [실행 코드](./reproduce-csp-coverage.mjs), [관측 JSON](./csp-coverage-result.json). ci-csp-ratchet-check.mjs14의 실제 collector를 읽기 전용으로 실행하고 원래 게이트도 실행했다. `join('', '') === '.'`여서 경로 js/…·src/…와 일치하지 않는다. 추가210개 innerHTML assignment가 집계에서 빠지지만 그것들이 XSS 취약점210개라는 뜻은 아니다.

C02는 runner의 fingerprint 함수 원문만 추출하여 새 VM context에서 실행했다. repository 원본·캐시·게이트 실행 결과를 실제로 변조하지 않았다. C07/C08의 mock DOM은 생성 문자열을 검증하며 레이아웃·접근성·포커스 동작을 검증하지 않는다.
