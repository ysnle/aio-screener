> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 기반 계층 46개 의미 검토

대상은 src/app 19개, src/state 17개, src/platform 3개, src/legacy 2개, src/storage 5개다. 독립 독자가 전문을 읽고 시작/종료 개별 SHA256을 인벤토리와 대조했다. 전문 읽기는 실행 PASS와 다르다. 제품 변경은 없다.

## 유지할 설계

라우터의 재진입 취소와 늦은 mount 정리, 역순 resource bag 해제, store listener 격리, 얇은 commands/selectors, 플랫폼 HTTP의 body deadline 및 외부 abort 연결은 역할이 분명하다. 이를 새 프레임워크나 전역 DI 체계로 치환할 근거는 없다. 포트폴리오의 미선언 통화·환율·결측 상태, 스크리너의 부분 갱신과 명시적 선택 해제도 보존해야 한다.

## F01 — 검색 초기화가 이전 비동기 후보를 무효화하지 않음

`src/app/compatibility-globals.js:246`의 clear는 DOM만 비운다. 272~280의 대기 중 listings query는 이전 generation이 계속 유효하므로 뒤늦게 후보를 붙인다. 주 담당자가 실제 installer를 import하고 deferred fetch·최소 DOM을 주입했다. input clear와 document reset 각각 후보 0개에서 이전 ACME 후보 1개로 되살아났다. 정상 조회 대조군도 확인했다. [실험](./reproduce-search-race.mjs), [결과](./search-race-result.json). 실제 브라우저 발생 빈도는 미검증이다.

최소 변경은 clear 시 query generation과 현재 query를 무효화하는 것이다. clear→resolve, query A→B, 정상 resolve를 함께 검사하면 된다.

## F02 — native 화면 소유자와 원본 데이터 writer는 다름

bootstrap 180~183/340~353/362에서 provider를 설치하지만 runtime-readers 602~682는 여전히 legacy mutable globals와 DATA_SNAPSHOT을 읽는다. 화면이 native라는 사실은 입력 생산 경계가 이전됐다는 뜻이 아니다. 이 strangler 설계는 유효하다. 다만 소유권 보고는 원본 writer·정규화·상태 게시·화면 renderer를 구분해야 한다. 한 데이터 흐름씩 입력 writer까지 이전하고 이전 writer를 제거하는 편이 통째 재작성보다 검증 가능하다.

## F03 — compatibility facade와 runtime reader의 중복 projection

`src/legacy/compat-facade.js:34~242,255~261,342~347`에도 market/sentiment/themes/entity/screener read projection이 있다. 현재 src provider는 runtime-readers를 사용한다. 포트폴리오처럼 한 read 경계에 위임하는 방향이 단순하다. Node 게이트·외부 global caller까지 조사하기 전에는 facade를 삭제하면 안 된다. 중복 파일의 크기가 아니라 동일 입력에서 기준일·null·권한 판정이 달라질 여지가 개선 이유다.

## F04 — app lifetime와 start/stop lifetime를 명시

bootstrap 94~99는 start 전 import 시 globals/panel contexts/background alerts/chat sessions를 설치한다. background-alerts 21~39의 timer와 익명 visibility listener에는 disposer가 없다. 단일 문서 부팅에서는 합리적인 app lifetime일 수 있다. stop/start를 재사용 가능한 공개 계약으로 볼 것인지 먼저 명시하고, 재설치를 지원할 자원만 app scope가 install/dispose하도록 한다. 모든 이벤트를 새 manager로 추상화할 필요는 없다.

## F05 — 비동기 event callback의 오류 경계

compatibility-events는 async 오류를 격리하지만 compat-facade의 직접 EventTarget 구독과 bootstrap의 일부 async sync callback은 반환 Promise를 소비하지 않는다. 현행 동기/오류-as-value 경로가 많아 실제 unhandled rejection은 확인하지 않았다. 동일한 async error wrapper를 해당 경계에만 적용하고 오류를 관측 가능하게 하는 것이 최소 개선이다.

## F06 — 실사용 Vault와 미연결 일반 repository 구분

storage의 일반 repository/migrations/vault는 현재 production bootstrap 연결이 확인되지 않는다. 실제 경로는 `_AioVault`와 financial-security다. 일반 helper의 테스트를 실제 암호화·잠금·계좌 저장 경로 인증으로 해석하면 안 된다. 실사용 경계를 검증하고, 미연결 모듈은 실험/계약용 여부를 명시한다. caller 조사 없는 일괄 삭제나 두 번째 Vault 재작성은 권하지 않는다.

구체적인 전문 대상과 SHA는 [통합 읽기 원장](./reading-ledger.tsv)에 기록한다. artifact-cache의 함수명 기반 cache owner와 entity provider의 공유 요청 취소는 별도 책임 문제로 보며, 공유 provider 요청을 routeSignal로 무조건 취소하도록 바꾸지 않는다.
