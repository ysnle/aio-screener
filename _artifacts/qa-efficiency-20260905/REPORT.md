# 전체 코드 및 QA 효율화 — 2026-09-05

상태: 적용 완료, v54.79. 기존 사용자 변경은 보존했다. 커밋·push·배포는 하지 않았다.

## 검토 범위

앞선 전체 저장소 구조 검토(1,820 tracked files, 174 native modules, 180 scripts, 9 workflows)를 이어서 현재 QA manifest의 123개 gate, 115개 고유 스크립트, 단계/캐시/영향 선택 및 브라우저 실행을 조사했다. 모든 파일의 모든 줄·데이터·과거 연구 문서를 의미적으로 인증했다는 뜻은 아니다. 앞선 미사용 모듈 10개와 legacy audit 제거는 ../first-principles-20260905/REPORT.md에 별도 기록했다.

## 삭제와 단순화

- 실행 즉시 성공 종료하던 ci-knowledge-quantitative-example.mjs와 현행 session baseline으로 대체된 ci-second-pass-baseline.mjs를 삭제했다(합계 96 non-trailing lines, 약 5.7KB). 활성 문서/manifest 참조도 정리했다.
- 동일 라우트로 다시 navigate하는 no-op 재진입 assertion을 삭제했다. 실제 이탈/재진입의 lifecycle 검사는 route-soak에 유지한다.
- runner의 캐시/동시성 구현 문자열을 찾는 검사 6개를 삭제했다. 실패 집계·단계 차단·실패만 재검사·내용 변경 무효화·동시성·exclusive 경계는 실행 fixture로 검증한다.
- runner의 gate 정규화 중복을 없앴다. 중복 입력 집합과 파일 내용 해시는 호출 안에서 재사용한다.
- CPU profile에서 드러난 runtime-readers의 관측 객체 복사/중간 배열을 제거했다. count/min/max 집계와 호출 내 동일 timestamp 파싱 재사용으로 바꿨다. 장기 전역 캐시나 새 자동화는 추가하지 않았다.

## 이제 검증하는 방식

- 일반 작업: 수정 전 session-start, 마감 시 affected --session. 등록된 ci-* 검사만 바뀌면 해당 검사와 명시된 의존 검사, preflight 및 pipeline contract를 선택한다.
- generator·공유 helper·제품 코드의 변경은 넓은 영향 선택을 유지한다. local affected가 watchdog/live variant까지 호출하지 않도록 경계를 보존했다.
- 로컬 브라우저는 서로 다른 포트와 프로세스에서 기본 2개 실행한다. boot/SA04/artifact-budget은 단독 실행한다. CI matrix shard는 기존처럼 1개; --browser-jobs 1로 직렬 재현 가능하다.
- 무거운 preflight 10개에 실제 입력 범위를 선언했다. 보고서만 바뀌어도 syntax와 runner fixture를 다시 돌리던 캐시 무효화를 줄였다.
- 기존 브라우저 입력에서 빠졌던 AI/platform/storage/legacy/helper 영향과 version metadata를 보완했다. 전체 release 프로필, 실패 기준, timeout을 완화하지 않았다.
- CI·release는 --no-cache, live는 별도 external이다. 실패 batch는 rerun-failed로 재검사한다.

## 실제 측정

| 실행 | 결과 | 시간 |
|---|---|---|
| 기존 v54.78 | 86 PASS, 캐시 0 | 580.685초 (9분 41초) |
| QA 구조 변경만, 정확히 동일한 86개, 캐시 0 | 85 PASS / boot FCP 1 FAIL | 368.690초 |
| 최종 v54.79, 런타임 병목 수정 및 더 넓은 작업 범위 | 105 PASS / 3 cached / 0 FAIL / 0 SKIP, 총 108개 | 222.522초 (3분 43초) |

최종 관찰 시간은 기존보다 61.7% 짧다. 최종 실행은 동일한 gate 집합의 통제 실험이 아니다: 22개 검사가 더 선택됐고, 변경되지 않은 Cloudflare 계약 3개만 재사용했다. 15개 브라우저 검사는 모두 실제 실행했다. 같은 컴퓨터의 단일 실행 비교이므로 일정한 속도 향상을 보장하는 수치가 아니다. 첫 비교의 실패와 22.4초 단독 재실행 실패도 benchmark-results.json / retry-results.json에 보존했다.

부팅 FCP 실패는 병렬 실행 중단 후 단독 재실행에서도 재현됐다(3916ms, 2884ms). CPU profile의 가장 큰 비용은 runtime-readers였다. 수정 후 FCP 1908ms, route 330ms로 boot gate가 통과했다. 더 엄격한 long-task 목표(max 200ms, total 1000ms)는 여전히 미달이므로 전체 성능 목표 달성으로 해석하면 안 된다.

관측 집계는 200개 결정적 차등 사례에서 기존 결과와 일치했다. 5,000행 × 14필드 단일 함수 측정은 59.5ms → 13.4ms였다(coverage-parity.json). 기존 함수를 대입하면 새 반복 파싱 작업량 검사에서 실패했다. 109개 headless 그룹과 20개 라우트 검증을 유지했다.

## 보존한 것

실제 사용자 동작·데이터 계약을 확인하는 architecture, viewport, accessibility, route-soak 검사는 서로 다른 실패를 잡으므로 유지했다. 수동 fast-plane /quotes 진단도 health 검사와 계약이 달라 유지했다. 활성 producer, 공개 데이터, refresh/deploy/watchdog workflow를 단순히 호출이 비슷하다는 이유로 삭제하지 않았다.

## 증거 및 한계

- final-results.json / final.log: 최종 runtime·static·local browser 결과.
- benchmark-results.json / benchmark.log: 동일한 86개 초기 비교와 실패 원본.
- closeout-results.json: QA 구조 변경 직후 94 PASS 검증.
- coverage-parity.json, metrics.json: 집계 결과 동등성 및 측정 수치.
- 마지막 문서 검증과 보고서-only 캐시 실행은 docs-results.json / warm-results.json에 별도로 기록한다.
- 차단된 작업 없음. live/provider/deployment 상태와 사람의 시각·의미 검토는 이번 로컬 자동 검증으로 인증하지 않았다. long-task SLO 목표는 남아 있다.

보고서-only 최종 확인: 1.910초, {"CACHED":10,"PASS":3}. syntax 및 runner behavior fixture는 CACHED였고 무거운 브라우저 검사는 선택되지 않았다. 문서 마감 검증은 16 PASS / 6 cached / 0 FAIL, git diff --check도 PASS.
