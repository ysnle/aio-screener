> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 검증 도구·운영 경계 검토

## QA 캐시가 실제 실행 의존성을 놓침

qa-runner는 script bytes와 명시 inputs만 fingerprint에 넣는다. parser로 얻은 local static import를 전이 순회하고 실제 runner glob 규칙으로 비교하니 cacheable gate21개에서 누락을 찾았다. 대표 knowledge-repository 게이트는 실제 함수의 격리 실행에서도 repository 모듈 bytes 변경을 감지하지 못했다. gate script 자체를 바꾸는 양성 대조군은 감지했다.

이는 현재 제품의 21개 테스트가 실패했다는 뜻이 아니다. 이전 PASS cache가 남은 상태에서 누락 의존성만 바뀌면 검사를 재실행하지 않을 수 있다는 증거다. full --no-cache와 CI의 no-cache 실행까지 무효라는 결론은 성립하지 않는다. 우선 누락 입력을 보완하고 이후 gate import closure 누락을 검사한다. 자동 closure만으로 동적 fs.readFile·fixture·외부 service 의존성을 전부 해결할 수 없으므로 기존 명시 inputs도 유지한다.

## verify-aio canonical 실행 코드14개 전문 검토

장점: fresh context·자기 서버 PID·served version doctor·화면별 관측·개별 스크린샷·실패 단계 보존·오류/로컬4xx 기록을 분리한다. 포트폴리오는 저장소를 두 번째 관점으로 확인하며, 테마 필터는 active class뿐 아니라 chip set 변화도 확인한다. 이를 새 E2E framework로 바꿀 필요는 없다.

보완점:

| 구분 | 근거와 한계 | 최소 대안 |
|---|---|---|
| 재현 C10 | expectText는 ‘visible’ 주석과 달리 대기 predicate에서 표시 여부를 확인하지 않는다. 반환 visibleText가 빈 문자열이어도 예외가 없다 | 표시와 text를 한 assertion으로 묶고 현재 fixture에 hidden 대조군 추가 |
| 정적 경로 | registry는 active route 대기 실패를 삼킨 뒤 document 전체 selector 존재만 판정. 결과에 activePage를 쓰지만 성공 판정에 사용하지 않는다 | 요청 route 활성/ready를 필수로 검증하고 해당 route root에서 선언 surface 확인 |
| 보고 범위 | step이 {skipped:...}를 반환해도 ok:true와 PASS 단계 수에 포함된다. 더 보기 버튼이 없는 경우 등이 해당 | PASS/FAIL/SKIP 단계별 수를 분리. feature의 조건부 미실행을 완료 인증으로 올리지 않음 |
| 정적 경로 | unexpectedConsoleErrors는 수집·출력하지만 ok를 false로 만들지 않는다 | 어떤 console error가 실패 조건인지 명시하고 실제 report 판정과 맞춤 |
| 잠재 lifecycle | instance.cleanup은 saved PID가 살아 있는지만 보고 종료한다. PID 재사용 때 같은 프로세스라는 증거가 약하다 | 시작 시각/command/root 등 자기 자식 identity를 종료 직전에 확인. 타 프로세스 종료 실험은 하지 않음 |
| 잠재 hang | doctor의 fetchText에는 application deadline이 없고 launch는 기존 log의 readiness 문구를 읽는다 | fetch/body deadline과 이번 실행의 readiness 증거를 사용 |
| 잠재 비용 경계 | AI feature의 nonlocal --send-ai 검사는 입력 Enter 후다. 현행 CLI baseUrl은 localhost이므로 실제 유료 호출 증거는 없음 | 허용 flag·origin 조건을 전송 전에 확인. UI 도달과 유료 답변 완료를 별도 step으로 보고 |

동일 SHA인 generated `.agents`14개는 canonical 검토 재사용이며 독립된 추가 전문 검토로 세지 않는다. browser는 실행하지 않았다. 이 감사의 mock predicate 실행을 Playwright/실브라우저 PASS로 해석하면 안 된다.

## source pin과 의미 검증

ci-decomp-hotspot은 줄 수에 nonwhitespace 상한을 더해 한 줄 압축을 어느 정도 방지한다. 그래도 크기 감소는 책임 분리·계약 정합성·사용자 성능의 대리 지표다. 기존 ratchet은 이력 보호로 유지하되 새로운 리팩토링 목표는 ‘이 중복 판단 제거’, ‘이 stale 분기에서 unknown 반환’, ‘이 bootstrap import 경계 분리’처럼 행동으로 잡는 편이 낫다.

readProducerSource는 분리된 producer의 source 문자열을 이어 붙여 과거 게이트를 유지한다. 이동 후 pin을 유지하는 기술적 목적은 타당하지만, 문자열 존재를 올바른 caller·부호·기간·실행 순서의 증거로 올리면 안 된다. 실제 모듈을 부르는 정상/반대/결측 fixture를 우선하고 기존 source pin은 명시된 wiring 검사로 구분한다. ci 게이트 추가60개 대상 중25개 전문 검토·35개 미독 상태는 [독립 결과](./TOOLING-CI-1.md)와 TSV의 현재 읽기 상태를 따른다.

## 읽은 producer helper

atomic-write의 제한된 rename retry, refresh-continuity의 성공시각 보존, SEC full ledger의 manifest hash 결속·labelled skip, 13F content hash의 poll-clock 제외는 유지할 가치가 있다. 월 예산/권한과 다른 책임이므로 억지로 하나의 generic repository에 합치지 않는다.

추가 검토 필요: domain-receipt는 attempted/updated 수와 failure ledger가 일치한다는 caller 불변식을 전제한다. rank-statistics는 missing percentile을0.5로 둔다. 그 값이 실제 합성 팩터에 들어가는지와 readiness 보류가 일관적인지는 caller까지 확인해야 한다. 두 항목은 아직 사용자 결함으로 확정하지 않았다. 13F amendment compose는 입력 순서가 filedAt 순이라는 caller 전제도 보존해야 한다.
