> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# DATA / AI / Worker 의미 검토

107파일·13,241줄·865,953바이트 전문 읽기 완료. source-inventory.json과 개별 SHA256 차이 0개.

시작 및 종료 bundle SHA256: `3718a7f30c9b9f75a3ad3a31c6443e249727239b27a582d91b48d96ead730b57`.
방식: path 오름차순, UTF8(path) + NUL + rawbytes를 연속 SHA256.

증거는 정적 소스·호출경로 확인이다. 파일 수정·Git·QA·producer·네트워크·유료 AI 호출 없이 읽었다. 테스트 파일 존재를 실행 PASS로 해석하지 않았다. `적정`은 전문 읽기에서 개별 구조 결함을 발견하지 않았다는 뜻이다. 전문 미독·차단 파일은 없다.

## 실제 코드 결함

### D1 · P2 — 정규화가 `_valuationPrice`를 버림

위치: src/data/providers/screener.js:579, src/data/normalize/screener.js:115.
provider가 일반 valuation close를 `_valuationPrice`에 담지만 whitelist에는 `_valuationPePrice`만 있다. src/domain/fundamental/consensus-read.js:27은 `_valuationPrice → valuationPrice → _valuationPePrice → pePrice`로 가격을 찾는다. trailing PER용 pePrice가 없는 종목은 유효한 일반 종가와 컨센서스가 있어도 Forward PER을 잃는다. src/ui/pages/entity.js:88의 마지막 발행 종가 fallback도 같은 손실을 받는다.
반론: pePrice가 있는 흑자기업 대부분은 fallback으로 살아남고 다른 차트 데이터가 있으면 hero도 보완된다. 전 종목 장애가 아니다.
최소 수정: whitelist에 `_valuationPrice`를 보존한다.
검증법: valuationPrice만 있고 pePrice가 없는 provider row를 normalize한 뒤 consensusView와 lastPublishedClose까지 확인한다.
증거: 필드 생성·삭제·소비 연결의 정적 확인. 실행 미검증.

### D2 · P2 — 종가 기준 테마 상세에 실시간 등락 혼합

위치: src/data/providers/themes.js:152,166,188.
live coverage가 60% 미만이면 completed-close 모드를 선택하지만 해당 세션 종가가 없는 종목을 liveQuotes로 보충한다. breadth는 혼합 집합으로 계산된다. detail.pct도 close-mode 결정 전에 live 우선 경로로 계산되어 같은 detail 안에서 기준이 갈린다. src/ui/pages/themes.js:727–730은 breadth 전체를 해당 날짜 종가 기준으로 표시한다.
반론: 모든 종목의 종가가 있거나 live coverage가 충분하면 혼합하지 않는다.
최소 수정: close-mode에서는 해당 세션 close rows만 채택하고 부족분은 missing으로 둔다. hero pct와 breadth도 선택된 집합에서 계산한다.
검증법: 일부 live-only·일부 close-only 테마에서 모든 계산 입력의 session·basis 일치를 검사한다.
증거: provider 분기와 실제 화면 라벨 연결의 정적 확인. 실행 미검증.

### D3 · P2 — 유니버스 밖 종목 성공 결과의 영구 세션 캐시

위치: src/data/on-demand-symbol.js:203.
ready와 in-universe는 저장시각·거래일·현재 유니버스와 무관하게 계속 반환된다. 실패에만 60초 retry가 적용된다. src/app/compatibility-globals.js:143–166은 reader를 한 번 생성해 재사용하고 invalidate/refresh가 없다. 다음 종가·공시·유니버스 갱신 뒤에도 오래된 row·SEC record·placement가 남는다. placement는 이전 peer 집합 계산을 현재 유니버스와 함께 보여줄 수 있다.
반론: session cache 의도가 주석에 명확하고 짧은 방문은 영향이 없다. 계산시각도 보존된다.
최소 수정: 기준 거래일·유니버스 revision 변경 시 다시 읽고 차트/SEC 재조회와 peer 재배치를 필요한 만큼 구분한다.
검증법: 주입 clock·universeRows를 바꿔 두 번째 load가 새 session/revision을 반영하는지 확인한다.
증거: 캐시 분기·싱글턴 설치·소비자 연결의 정적 확인. 실행 미검증.

### D4 · P2 — relay의 불확실한 upstream 실패를 release

위치: cloudflare-worker-proxy.js:1364.
공급자 호출 뒤 timeout·본문 5MB 초과·redirect 제한 예외도 일일 reservation을 release한다. 공급자가 이미 요청을 받았을 수 있으므로 반복 호출이 RELAY_DAILY_CAP에서 사라진다. HTTP 오류·HTML block은 유지하는 수정과도 의미가 어긋난다.
반론: BOK/KOSIS 호출한도이며 OpenAI $20 원장과 분리된다. 분당 limiter도 남는다.
최소 수정: dispatch 시작 여부를 기록하고 시작 이후 불확실한 실패는 reservation을 유지한다.
검증법: upstream이 요청을 받은 뒤 body stall/oversize를 내는 fixture에서 count 유지 확인.
증거: reserve→fetch→catch→release의 정적 확인. 실행 미검증.

### D5 · P2, 잠재 경로 — 복제 decision 판정의 권한 거부 누락

위치: src/data/runtime-readers.js:103,443; src/data/providers/screener.js:416.
세 판정은 isValidRightsId를 eligibility로 사용하지만 이 함수는 존재 검사다. DENIED·BLOCKED·REVOKED·REVIEW_REQUIRED도 유효 ID다. 정본 contracts/evidence.js:203은 별도로 거부한다. 완전한 decision envelope에 해당 상태가 들어오면 runtime decisionEligible 또는 screener live overlay가 정본과 달라진다.
반론: 현재 무료 public quote는 T3이므로 앞선 tier gate에서 차단된다. production에서 취소된 licensed envelope가 발생했다고 확인하지 않았다.
최소 수정: ID 존재 검사와 decision 권한 검사를 분리하고 정본 eligibility helper 재사용.
검증법: 나머지 grant가 완전한 T1/T2 envelope의 rightsId만 차단 상태로 바꿔 세 경계의 거부 확인.
증거: 동일 입력에 대한 조건식의 정적 불일치. production 발현 미확인.

### D6 · P2, 잠재 경로 — live quote allowed-use property 불일치

위치: src/data/providers/screener.js:203–204,463–464.
liveEnrichment는 priceAllowedUse·priceAllowedUseCeiling을 반환하지만 baseRow는 live.allowedUse·live.allowedUseCeiling을 읽는다. live price 채택 시 관련 권한은 undefined가 되고 normalize에서 null이 된다.
반론: 현재 T3 무료 quote는 live 채택이 제한되어 production 영향 미확인. fieldReadiness는 별도 규칙을 써 화면 전체가 항상 사라지지는 않는다.
최소 수정: bool eligibility와 원래 enum grant를 구분해 반환하고 올바른 이름으로 전달.
검증법: 정상 T2 quote가 artifact price를 대체한 뒤 canonical row의 allowedUse·ceiling 보존 검사.
증거: 반환 객체와 property 읽기의 정적 불일치. 실행 미검증.

## 유지보수 제안

### M1 — fetch 함수 이름을 cache owner ID로 사용

위치: src/data/artifact-cache.js:6–24.
서로 다른 fetch.bind(root)가 같은 bound fetch 이름이면 같은 URL의 resolved/in-flight를 공유한다. 단일 window에서는 유효한 최적화지만 transport·realm·테스트 root 격리를 함수 이름으로 입증할 수 없다.
반론: 실제 앱 주 사용 경로는 한 root fetch다. 현재 사용자 장애 미확인.
최소 대안: 안정된 root/transport owner를 키로 전달하거나 owner가 bound fetch를 한 번 생성해 재사용. 전체 캐시 재설계 불필요.
검증법: 이름은 같고 응답은 다른 두 transport의 동일 URL 요청이 섞이지 않는지 검사.
증거: 소유권 모델의 정적 취약점. production 발현 미확인.

### M2 — AI context의 UI component 직접 import

위치: src/ai/context/market-content.js:12,14.
AI 수집이 crossroadsForRoot·themePlaybookForRoot를 UI 모듈에서 가져오고 DOM 조건도 조회한다. UI 변경과 AI의 loading graph·root 의존이 결합된다.
반론: 화면과 AI가 같은 모델을 쓰게 한 목적과 중복 제거는 타당하다. 파일 크기 때문에 분리할 사안이 아니다.
최소 대안: 두 root collector만 data/selectors 또는 domain adapter로 옮겨 UI·AI가 함께 import.
검증법: 동일 root fixture에서 값·basis·missing 상태와 생성 context parity 확인.
증거: import·수집 책임의 정적 확인. 성능·순환 import 장애는 측정하지 않았다.

## 통합 판단

canonical evaluator는 엄격하지만 runtime eligibility·screener overlay·AI policy·publication에 유사한 판정이 따로 있다. display/reference/current-claim/decision의 목적 차이는 보존하고 권한 거부·시각 유효성 같은 공통 불변식만 공유하는 것이 최소 개선이다. 원자 월예산·started 이후 예약 유지·검증 usage settlement·US DO·Secrets 경계는 읽은 코드에서 유지된다. search content allowance는 주석대로 정책적 예약량이며 공급자 청구의 수학적 상한이라고 확정하지 않았다.

보조 호출 확인의 제한 읽기(소유 범위 통계 밖): compatibility-globals143–166, consensus-read27 및 관련 함수, themes727–730, entity88 및 hero 주변. 라이브 발현 빈도·브라우저 영향·배포 상태는 미검증. commit·deploy 없음.
