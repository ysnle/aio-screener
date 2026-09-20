# 06 — 운영과 검증이 실제 경계를 덮는가

Astra 설계 · Luna MAX 조사 · 2026-09-20. 배포/API실행권한을 요청하거나 사용하지 않았다.

## O01 / W06-A — 변경 영향과 gate 입력의 일치

Luna는 v55.22의 qa-pipeline에서 js/aio-kr-data.js가 data-refresh gate의 input인데 affected 선택은 core/browser만 되는 것을 `--files js/aio-kr-data.js --list`로 확인했다. v56의현재규칙은 다시대조해야하므로 미해결확정으로재인용하지않는다.

설계: gate가 의존하는파일과 impactRules에서 그gate를도달시키는규칙을 검사한다. 단순명칭매칭만으로 충분하지 않으며 dynamic imports/생성물/registry 의존도 포함한다. 한 producer변경에 consumer/contract/semanticfixture가 선택되는지 canary file 목록을 둔다. 목록은 현재registry에서파생하고 복제된문서목록을정본으로삼지않는다.

## O02 / W06-B — SLO 관측창 완전성

build-operations-slo-window는 workflow당최대1000run을 읽고 branch scope/truncation을 명시적완전성으로내보내지않는다. 고빈도schedule이면30일자료가더많을수있다. 다른producer의 observedDays와합쳐 일수만충족할가능성은 있지만 실제Actions이력이없는상태에서인증오류가발생했다고단정하지않는다. checked-in template의 NOT_CERTIFIED는유지된다.

설계: 요청기간, first/lastrun, branch/SHA, paginationComplete, observed/expected schedule counts, excludedcancelled/manual runs를저장한다. 일부페이지자료로30일달성이라고인증하지않는다. 시간창과실행수의분모를구분하며시장휴장·provider지연·수집실패를따로분류한다.

## O03 / W06-C — SW와artifact 세대일치

sw.js의주석과cache pattern상 data.json/history/screener/telegram은일반data TTL fallback과동일하게처리되지않는다. 이것만으로오프라인기능결함을확정하지않는다. legacy/IndexedDB fallback과최종화면까지추적해야한다.

설계검증: online→offline, 구버전tab유지중새release, shell성공/data실패, 한artifact만신규revision, cachequota, failedrefresh후last-good. 화면은수신모드/관측일/revision을보존하고 서로다른세대의model/input을완전한한결과로혼합하지않는다. 사용자에게 rawcachekey를보여줄필요는없으며 ‘저장된9/18자료’처럼설명한다.

## 긍정적 연결과 한계

refresh→fail-closed validation→exactSHA CIattestation→Pages exactSHAdeploy/convergence 경로가있다. 이것은배포정합성의좋은기반이다. 로컬gate통과를현재서비스가용성·데이터권리·30일SLO로확장하지않는다. boot/soak stale표시와 NOT_CERTIFIED template도정직한상태로보존한다.

## 이번 QA 실행의 실패 보존

[v56 재검증](RECHECK-V56.md)에 PASS103/FAIL5/SKIP23의확대실행을기록했다. data-plane503은같은테스트의두gate에서발생했고, refresh/lineage는로컬artifact SLA, knowledge-lint는generatedstate불일치였다. 코드수정금지범위라직접고치지않는다. 환경문제/실제코드문제의근본원인과시점별재현을구분해구현작업으로넘긴다.

다음조사: refresh retry/backoff/idempotency, partialpublish원자성, provider일일쿼터·공유토큰·CORS/auth분리, emergencyrollback, 실패알림누락·과다알림. 자동commit/push/deploy는허용되지않는다.
