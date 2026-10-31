# PASS14 — 변경된 배포 workflow 직접 재판독

2026-10-28 v59.42. 에이전트 없이 소스 검토만 수행했다. Actions dispatch/외부 조회/배포 없음. 이전 drift 목록의 배포 workflow3개를 현재 본문으로 다시 읽었다. 수정 전후 모든 줄 diff를 재현했다는 뜻이 아니라 현재 계약 재판독이다.

## 전체 판독 파일5개

- .github/workflows/deploy-ai-proxy.yml
- .github/workflows/deploy-data-plane.yml
- .github/workflows/pages-deploy.yml
- scripts/worker-deploy-impact.mjs
- scripts/resolve-worker-rollback-version.mjs

묶음 출력이 잘려 AI workflow219 이후와 data workflow1–150/151 이후를 다시 읽었다. Pages 본문은 묶음 출력에서 전체 확인했다. 이전 reader 보고와 구분하여 직접 증거를 남긴다.

## 현재 계약과 의미

Worker 두 경로는 성공 main push CI의 repository/branch/event/SHA를 검증하고 release attestation의 schema/testedSha/runId/repository를 대조한다. 해당 SHA를 checkout한다. main이 이후 data-only로 진행한 경우에도 ancestry 및 plane 입력 변화가 없을 때만 배포 가능하며, 변이 직전에 다시 main을 확인한다. recipe 파일 변화는 양쪽 plane의 변화로 취급한다. 수동 dispatch도 최신 Worker 입력을 옛 SHA로 되돌리는 자동 허가가 아니다.

Pages는 main CI push 또는 dispatch를 허용하고 같은 attestation을 요구한다. 소스를 임시 배포 디렉터리로 복사하고 bulk SEC/13F 원장을 제외한 뒤 bundle을 생성한다. 서비스워커 hash는 배포될 코드로 계산한다. 첫 deploy와 retry 직전에 main SHA 일치를 다시 확인한다. stale skip은 실제 배포/외부검증 없이 workflow success가 될 수 있으므로 운영 감시 소비자는 success와 deployed를 구별해야 한다. 이 점은 최초 OPS-01의 기존 이슈와 연결되며 새 별도 결함으로 중복 계수하지 않는다.

Worker rollback baseline은 최신 created_on의 유일한 deployment, 단일 version 100%만 허용한다. 동률/날짜 없음/split/version ID 오류는 배포 전에 거부한다. deploy 성공 뒤 smoke 실패일 때 rollback하며 복구한 health의 sourceSha/HTTP status를 기존 baseline과 대조한다. data-plane은 legacy sourceSha 없음도 명시 상태로 기록한다. AI 쪽은 유효 SHA를 요구한다.

data-plane의 optional dispatch token 저장 실패가 smoke를 건너뛰지 않도록 !cancelled 조건이 있다. AI smoke도 always 조건으로 실행한다. ‘secret 저장 실패지만 smoke 정상’은 job 실패로 남되 rollback 조건이 아니다. 코드 rollback과 운영 secret 복구는 같은 동작이 아니므로 이 차이를 운영 인수 문서에서 유지해야 한다.

AI smoke는 연속3회 신규 source readiness, CORS, 잘못된 origin 차단, 유료 upstream, automation 인증, 퇴역 FRED relay/미등록 provider 차단을 검사한다. 사용자 보호 quota의 일부429는 운영 차단으로 분류해 rollback하지 않는다. 현재 $20은 목표라는 owner 정책이므로 여기 남은 monthly-budget 문자열만 보고 예산 정책 위반으로 판단하지 않았다. 실제 Worker admission/ledger 재판독은 아직 남아 있다.

## 제한과 보강안

- workflow 성공/skip/deployed/smoke 운영차단/rollback을 분리한 배포 결과 artifact를 운영 감시에서 읽도록 하는 방향을 권고한다. 기존 OPS-01의 수정 범위와 합쳐야 한다.
- data-plane smoke는 첫 KV snapshot 미생성(heartbeat=null, revision=null)을 bootstrap 성공으로 허용한다. 배포 코드 도달과 quote 서비스 준비 완료를 서로 다른 상태로 인수해야 한다. bootstrap 허용 자체를 신규 결함으로 단정하지 않는다.
- Worker 영향도 수집은 정적 상대 import graph를 기준으로 한다. dynamic import/런타임 자산을 새로 도입하면 manifest 계약을 넓혀야 한다. 현재 누락된 활성 dynamic dependency를 확인한 것은 아니다.
- 네트워크 curl에 개별 max-time이 없어 job timeout이 상한이다. 요청 지연으로 rollback 단계까지 도달 못하는 구체적 운영 사례는 이번에 재현하지 않았다. 배포 후 smoke/rollback에 남길 시간 예산을 구분하는 보강 검토가 필요하다.
- CI producer의 attestation 생성, staging bundle/public artifact manifest 전체, operations-alert 소비자와 live 상태는 이번5파일 읽기만으로 인증되지 않는다.

이번 pass의 신규 확정 결함은0건이다. 정상 계약과 미검증 후보를 분리했으며, 이전19개 drift 대상 중3개를 직접 재판독 상태로 갱신했다. 나머지16개 및 그 외 전체 코드베이스 검토는 진행 중이다.

## 직전 감사 배치 QA

PASS12/13 재현6경로는 모두 exit0. audit 소유11경로 affected 결과 run 2026-10-28T12-35-36-244Z-40516-g3omvt: pass3/cached9/fail0. fixture syntax와 audit git diff --check 통과. 이 결과는 제품·브라우저·배포 전체 PASS가 아니다.

PASS14 감사 문서/대장 변경 후 affected: run 2026-10-28T12-38-14-794Z-22968-qlswwf, pass3/cached9/fail0. workflow-yaml/product-charter/operations-contract 직접 실행, 나머지9개 캐시. audit diff 공백 검사 통과.
