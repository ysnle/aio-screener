> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# v58.60 추가 변경 대조

고정 REF `659ffbad252f9eeacfa49a6ad1b895df87f66597`. 주 감사 기준은 v58.59 `7e241143`이며 이 문서는 후속 차이만 다룬다. 작업 중 다른 주체가 commit한 변경을 이 감사의 구현/commit으로 세지 않는다.

v58.59 이후53경로가 달라졌다. 실행/설정 소스9개 전체 diff를 root가 읽었다: index.html, js/aio-core.js, build-sec-runtime-projection, ci-data-pipeline-contract-check, ci-esm-core-unit-check, market-analysis-validate, entity provider, sw.js, Worker 설정. 나머지는 생성 문서·운영 설정·데이터이며53개 전체 내용을 전문 검토했다는 뜻은 아니다.

core/index/SW/Worker의 해당 변경은 버전 표면 동기화다. CIK_MAP/HWM consumer 로직은 바뀌지 않았다. 현재 보고한 UI·재무·시장 판정 모듈도 이 후속 변경에 포함되지 않아 기존 고정 함수 반례를 무효화하지 않는다. 그러나 브라우저 수치/데이터 상태는 달라질 수 있으므로 이전 관측의 날짜를 유지한다.

## 직접 실행한 결과

`node --experimental-vm-modules .../latest-delta-probe.mjs` exit0. 고정 Git 모듈만 연결하고 외부 import/네트워크/producer/AI를 호출하지 않았다.

- provider가 생략된 availableAt을 acceptedAt으로 복원한다. 서로 다른 availableAt이 이미 있는 양성 대조는 덮어쓰지 않는다.
- 프롬프트 섹션명은 인용 ID로 정규화하거나 제거된다. 섹션명이 새어 나온 이전 verified 본문은 재사용하지 않는다. 해당 fixture를 실제 순수 함수로 확인했다. 임의 AI 출력을 모두 처리함을 인증하지는 않는다.
- 현재 고정 SEC projection은837행, UTF-8 1,046,755 bytes로1MiB보다1,821 bytes 작다. 원본 producer는 실행하지 않았다. raw artifact 크기이며 실제 전송/압축/브라우저 성능 값은 아니다.
- 현재 data.json의 marketAnalysis는 verified/semantic verified, semanticIssues=[]로2026-10-21T13:09Z 생성돼 있다. v58.59의 blocked라는 상태를 최신 상태로 계속 보고하면 안 된다. 저장된 verified 표식은 본문의 모든 경제적 인과관계가 옳다는 독립 인증은 아니다.

## 정책·구조 판단

P1956 기록상 SEC projection 크기 초과가 전체 스크리너 갱신을 막았다. 유한한 응답 크기 제한의 목적은 타당하지만, 필드가 자연스럽게 늘 때마다 중복 날짜를 조금씩 줄이는 방식은 여유가 작다. 필요한 날짜·법인 계약을 보존하면서 분할/캐시/소비 필드와 예산 경고를 함께 설계하는 편이 지속 가능하다. 제한을 임의 해제하거나 숫자/날짜를 버리자는 제안은 아니다. 이 변경 뒤 전체 Actions/Pages/Worker 정상화는 이 감사가 인증하지 않았다.

현재9개 변경은 원장의 workingTreeDrift에 별도로 보존했다. 새 checkout이 있다고 과거 SHA의 전문 읽기 증거를 지우지 않으며, 그 증거를 새 변경의 전문 검토로 자동 승격하지 않는다.
