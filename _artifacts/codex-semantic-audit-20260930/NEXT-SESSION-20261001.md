# Claude 인계 — 2026-10-01 / v56.87 / 작업 중간 상태

사용자는 기존 구조·재구축·보강을 실제 코드와 브라우저로 검증하고, 설계 의도도 무조건 옳다고 가정하지 말며 최신 시장 데이터 기반으로 기능을 운영하도록 요청했다. 마지막 요청은 **문서 동기화 및 Claude가 이어갈 전체 중간 상황·이력 기록**이다. 이 문서는 이전 `NEXT-SESSION-20260930.md`의 현재 작업 상태를 대체하며 과거 이력은 보존한다.

## 먼저 읽을 것

1. `AGENTS.md`와 `_context/CURRENT-STATE.md`를 한 번 읽는다. 관련 위치·규칙은 검색해서 필요한 범위만 읽는다.
2. 이 문서와 [이번 보고서](./REPORT.md), 필요하면 [v56.86 구조 감사](../codex-audit-20260930/REPORT.md)를 읽는다.
3. `git status --short`, `version.json`, `git log -5`, 실제 diff로 경계를 확인하고 **새 session-start content-hash 기준선**을 잡는다. 기존 세션은 증거 보관용이지 새 변경의 기준선이 아니다.

```text
node scripts/qa-runner.mjs session-start --session claude-continuation-20261001
```

## 작업 트리 경계

- cwd `C:\Projects\AIO`, branch `main`, 로컬 version `v56.87`.
- HEAD `6441a2c6595bed848c0d7b58d3f407e698daaee3`는 v56.85 이력이다. v56.86~87은 **미커밋 로컬 변경**이다. HEAD와 파일 버전을 혼동하지 않는다.
- staged `.gitattributes`는 원래 사용자 변경이며 유지했다. 처음부터 있던 dirty 문서·버전·인계 파일과 이번 root 통합 변경이 함께 있다. reset/clean/checkout으로 정리하지 않는다.
- 이전 관측에서 로컬 main은 원격보다 16커밋 앞이었다. bot 원격은 이후 전진하므로 현재 ahead/behind는 새로 확인해야 한다. 읽기 전용 수신은 merge/pull/checkout이 아니다.
- **커밋·push·배포·workflow dispatch 없음.** “마무리/계속”은 이 작업들의 승인이 아니다.
- 기록 baseline `codex-semantic-audit-20260930`과 `.cache/aio-qa/runs`를 보존했다. 캐시·QA 결과에는 source fingerprint가 있으므로 과거 PASS를 새로운 코드의 인증으로 바꾸지 않는다.

## 바꾸지 말아야 할 제품 결정

가족·지인 약 5명, 2~4명 동시 사용, 1인 무료 중심 운영, desktop only, retired options alias, 한국 테마 유지, 정확한 기업명 registry match. 관찰 점수의 기준은 직전 완료 미국 정규장 종가이며 매매 권고·예측 확률이 아니다. 결측은 추정하지 않는다.

목표 총 $10/월·상한 $20/월, AI 최대 $10·데이터 최대 $10. 데이터 유료 도입은 실제 품질·커버리지 부족 입증 후 판단한다. 공개 검색 가능성과 자동 재사용 권리는 다르다. Worker 예약은 개인 키·Actions 청구를 포함하지 않는다.

시장 생산기는 **Actions에서만 실행**한다. 로컬에서는 artifact·순수 mock gate를 사용한다. `bump-version`, `record-fix`, workspace/profile/skill 공식 생성기는 예외적으로 필요한 로컬 동기화 도구다.

## 구현·통합 이력

이전 v56.86의 P1345~1348(native 종가 입력·MA·브리핑 6축·record-fix·내비게이션)을 보존하고, 이번 v56.87 P1349~1362를 통합했다. P1361~1362는 최종 실제 브라우저 검사에서 발견한 뉴스 링크/비동기 키 설정 버튼 접근성 수정이다. 상세 원인·해결은 REPORT 및 `_context/BUG-POSTMORTEM.md` 해당 P번호 검색을 사용한다.

| 분야 | 핵심 파일/통합 상태 |
|---|---|
| 날짜·종가·MA | `src/domain/market/{session-time,moving-average}.js`, `src/domain/signal/{close-basis,trading-score}.js`, `src/ai/time/market-session.js` |
| 실제 금융 보안 | `src/storage/financial-security.js`, portfolio backup/declarations, `js/aio-core.js`, chat redaction 및 `ci-portfolio-vault-e2e.mjs` |
| 배포 제한 보강 | 3개 deploy workflow, `scripts/deployment-provenance.mjs`, convergence/external/cloudflare gates, rollback resolver. **확장 제안 미적용** |
| AI 월 비용 | `cloudflare-worker-proxy.js`, Worker config, `src/ai/policies/*`, native/provider 정책 및 Worker mock gate |
| 화면 의미 | 시장환경 nav·pulse·공통 헤더·테마 분포/경기 문구·학습 copy, strict formatter |
| 최신 관측 | `src/domain/market/reference-observation.js`, `src/domain/briefing/decision-summary.js`, `src/ui/components/briefing-summary.js`, `src/domain/signal/page-decision.js` |
| 상태 연결 | `src/app/bootstrap.js`, analysis normalizer/slice, `src/data/runtime-readers.js`. header/pulse를 native 변경에 연결하고 sentiment는 canonical current inputs 직접 계산 |
| durable RRG | `scripts/lib/rotation-history.mjs`, 기존 `scripts/fetch-data.mjs`, `src/domain/themes/produced-rotation.js`, themes provider, server metadata bridge. **코드는 통합, 실제 생산 미확인** |
| 뉴스 | `src/data/normalize/news.js`, `src/ui/pages/news.js`: 원문/번역 한 번 해석, literal markup 보존 |
| SEC 범위 | `src/data/runtime-readers.js`의 watchlist/referenceScope, `src/data/contracts/page-timeline.js` 1행, `scripts/ci-fundamental-watchlist-timeline-check.mjs` |
| 공식 버전 정렬 | `scripts/lib/align-generated-version.mjs`, `bump-version.mjs --align-generated`로 release metadata 3개 필드만 정렬 |

새 회귀 게이트 page-decision-reference / rotation-history / fundamental-watchlist-timeline은 `architecture/qa-pipeline.json`에 등록됐다. R677~680과 P1349~1362는 공식 기록됐다. QA-SEMANTIC-CURRENT-01은 실제 브리핑·VM·unit 증거로 완료 표시했고 **QA-SEMANTIC-ROTATION-01은 실제 생산/화면 미확인으로 열어 둔다.**

## 실제 데이터 수신과 생산 경계

성공한 원격 생산 run **36796745469**, commit **9896adec45cc5de78fba2af481554602f3e89c6d**의 artifact를 정확한 blob으로 수신했다. snapshot revision은 `market-snapshot:2026-10-01T00:34:01.108Z:e00476d3`다. 12개 파일을 수신했고 사용자 로컬 `public-config.json`은 제외했다. screener transitive source도 같은 commit에서 수신했다.

증거: `producer-receipt/receipt.json`, `producer-receipt/{original,received}`, [원격 생산 확인](../codex-audit-20260930/REMOTE-PRODUCER-RECEIPT.md). 받은 release metadata의 버전만 현재 앱과 정렬했고 generatedAt/dataRevision/sourceSha/live health version은 조작하지 않았다. collection timestamp가 모든 개별 지표의 최신성 증거는 아니다.

**재실행 금지:** 이 폴더의 `receive-producer.mjs`, `receive-screener.mjs`, `record-batch.mjs`, 이미 적용한 `fix-*.json` 및 `integrate-header.mjs`는 일회성 이력이다. 다시 실행하면 백업·현재 통합 변경을 덮거나 기록 중복이 생길 수 있다.

## QA와 실제 화면

- full run `2026-10-01T01-12-46-724Z-6324-vztis5`: 126 신규 PASS + 11 캐시, headless T895 1개 FAIL, SKIP 0.
- T895는 inline 구현 대신 실제 `_AioVault.unlock`와 production helper 인증 위임을 검증하도록 수정했다. 실패 배치 G087 재실행 `2026-10-01T01-23-38-314Z-15344-zj4kmi` PASS.
- canonical sentiment/P1360을 포함한 affected `2026-10-01T01-24-08-317Z-30936-xhxrp5`: 122 신규 PASS+16 캐시/1 a11y FAIL/8 external watchdog SKIP. P1361 후 또 드러난 비동기 설정 span까지 P1362로 수정했다. 최종 a11y `2026-10-01T01-33-43-612Z-35132-j5ofbh` 19개 라우트 PASS. 8개 SKIP은 미검증으로 남는다. 최종 트리 full/배포 인증으로 합쳐 보고하지 않는다.
- 격리 Chromium portfolio production 인증 55개 PASS. 실제 사용자 포지션·비밀키 데이터를 검수했다고 말하지 않는다.
- v56.86에서는 실제 로컬/운영 19개 라우트를 비교했고 v56.87은 테마·브리핑·펀더멘털을 직접 확인했다. 자동 browser PASS와 모든 내용의 인간 의미 검수는 별개다.
- 최종 브리핑은 점수 58*, DXY 101.49, WTI 90.4, KOSPI 6813.15와 각 관측 시각을 표시했다. JPY/NVDA/SMH는 여전히 보류다. source 독립 시세 대조가 아닌 artifact→화면 연결 증거다.
- 새 RRG와 SEC 기본 화면 개선이 실제로 완료되었다고 주장하지 않는다. SEC 생산 catalog 회귀는 8개 기록으로 PASS지만 화면은 미수신 안내와 준비 판단 보류를 보였다.
- 로컬 서버는 127.0.0.1:8765를 사용했다. 종료됐으면 기존 안전한 정적 서버를 다시 실행하고 정상 로드부터 확인한다. QA는 자체 격리 서버를 사용한다.

## 다음 작업 우선순위와 안전한 실행

1. **참고 내용과 판정 범위 정합성:** fundamental 기본 화면이 실제 SEC watchlist를 보여 주는지 provider→state→presenter→header를 직접 추적한다. 상단의 12/13 시장 스코어 부족으로 기업 연간 참고값까지 보류하는 범위 혼합을 분리한다. 종목 검색 실패를 목록으로 대신 채우지는 않는다.
2. **RRG 실제 생산:** 현재 artifact에 rotationHistory가 없다. 코드 배포가 승인·진행된 뒤 Actions 생산과 실제 테마 화면을 확인한다. producer를 로컬 실행하거나 임의 dispatch하지 않는다. 좌표와 선택 수익률 결측의 결합도 fixture로 검토한다.
3. **브리핑 소비자 차이:** narrative F&G —와 pulse 31, JPY/NVDA/SMH/반도체 현재 원천 경로를 정리한다. snapshot 16개 범위를 전체 종목 서비스로 설명하지 않는다.
4. **운영 출처·수렴:** 이전 live v56.83/sourceSha null은 과거 관측이다. 실제 배포 검증이 필요할 때만 external live gates로 측정한다. 배포 확장 제안은 자동 승인 검토 차단 상태를 유지한다.
5. **가격·권리·범위:** Worker의 공유 $10 예약과 개인 키/Actions 통합 청구 상한은 다르다. 공급자 console cap은 미검증이다. Yahoo/일부 심리 source는 REVIEW_REQUIRED, 정식 license input은 별도다. universe의 monthly 갱신 지연을 생산 주기와 대조한다.
6. **자가 품질 문구·학습:** 개발자 `기관급 90/100` 등 미보정 점수와 retired route 경고, principles/masters/atlas/guide의 내용·공시 원문·과밀 UI를 실제 의미로 점검한다. 구조적 coverage를 의미 품질 인증으로 바꾸지 않는다.

변경을 한 묶음으로 구현한 뒤 affected gate를 돌리고, 실패는 전체 배치 해결 후 rerun-failed를 쓴다. 새 버전이 필요한 새 변경은 `bump-version` → `record-fix` → workspace generator. 최소 문서·계약 검사와 `git diff --check`를 포함한다. 전체 dirty를 task-owned로 자동 간주하지 않는다.

```text
node scripts/qa-runner.mjs affected --session claude-continuation-20261001
node scripts/qa-runner.mjs rerun-failed --session claude-continuation-20261001
```

사용자가 나중에 commit/push를 명시적으로 요청하면 main flow를 적용한다. push 전 `git pull --no-rebase origin main`, 생성물 충돌은 `resolve-generated-conflicts.mjs`와 해당 release gates로 해결한다. 현재 요청만으로 commit/push/deploy를 진행하지 않는다.

## 병렬 작업 트리 이력

`.cache/worktrees/semantic-operations`, `semantic-cost`, `semantic-vault` 등에 중간 변경이 남아 있다. 필요한 최종 구현은 main에 통합했다. semantic-operations의 runtime reader는 root의 새 canonical sentiment 등과 다르므로 **파일 전체 재복사 금지**. 작업 트리는 백업 성격으로 보존했으며 자동 삭제하지 않았다. 에이전트 결과는 현재 main diff와 실제 QA로 통합 검증해야 한다.

## 승인 검토 차단

자동 승인 검토가 dispatch CI 소비 경로, convergence_only와 Pages 일치 후 Worker 별도 handoff라는 **자동 배포 정책 확장**을 거부했다. 해당 정책 변경에 대한 명시적 승인 부족이 사유다. [DEPLOYMENT-PROPOSAL.md](./DEPLOYMENT-PROPOSAL.md)의 정확한 diff만 검토용으로 보존했다. 일반적인 “계속”을 이 정책의 승인으로 바꾸거나 다른 도구로 우회하지 않는다.

## 인계 종료 상태

문서·버전·미러·기록 동기화 결과는 `qa/documents-closeout.json`, QA run 사본은 `qa/`, 실제 화면은 `screenshots/`에 있다. 과거 7월 문서 2개의 encoding 손상 경고는 미복구로 기록했다. 최종 보고서와 이전 인계 포인터·INDEX·실행 상태까지 연결했다. 이 인계는 전체 제품 완료 선언이 아니라 검증한 부분과 구현/실생산/의미 검수가 남은 부분을 이어가기 위한 기록이다.
