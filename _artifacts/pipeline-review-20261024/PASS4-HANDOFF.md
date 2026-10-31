# 전체 파이프라인 감사 — 추가 판독 2026-10-25

MODE: review. 기준 v58.79, 다른 세션의 변경이 존재하는 작업 트리. 제품 수정 없이 감사 자료만 추가한다. 전체 완료 선언이 아니다. 이전 발견은 HANDOFF.md, PASS2-HANDOFF.md, ALL-PIPELINES-HANDOFF.md의 당시 snapshot 기준이다.

## P4-DATA-09 — 누락 분기 순이익을 0으로 읽는 shadow model [ACT ON, medium]

경로: `build-sec-runtime-projection.mjs:17–18,40–58` → `sec-fiscal-history.json` → `lib/candidate-archive.mjs:84–100` → `rankPublishedScreener:57` → `factor-ranks.js:102–109` → shadow archive.

생산자는 매출만 있는 분기도 남기며 미보고 순이익을 빈 칸으로 직렬화한다. 소비자는 마지막 네 분기 순이익에 Number(part[2])를 적용해 빈 칸을 0으로 만든다. 연간 equity에는 빈 칸 방어가 있지만 분기 순이익에는 없다.

실제 함수 재현: 순이익 [-1,-1,-1,''], 주가10·주식수100만 fixture에서 yield=-0.3; 네 분기 모두 빈 칸이면 0. 기대 계약은 미보고 입력의 합산 보류(null)다. reproduce-pass4.mjs 및 pass4-reproductions.json에 저장했다. 현재 발행 fiscal artifact에서도 마지막 네 분기에 빈 순이익 칸이 있는 13개 종목을 확인했다. 이 숫자는 데이터 조건 건수이며 실제 shadow 순위가 바뀐 종목 수가 아니다. outputWithFixtureValuation은 합성 valuation으로, 실제 시장 수익률로 인용하면 안 된다.

영향은 기본 공개 모델이 아니라 향후 모델 교체 판단에 사용할 shadow 기록의 입력·순위 오염 가능성이다. 실제 순위/성과 변화는 미산출이다. 보강안: 빈 칸·누락·진짜0 구분, 네 개 연속 분기와 동일 회계 기준 확인, 보류 사유 기록. 기존 게이트의 적자·stale fixture 외에 부분/전체 누락·실제0·분기 gap 검사를 추가한다. 과거 기록은 오염 범위를 표시하거나 새 identity로 시작하며 조용히 덮어쓰지 않는다.

## P4-DATA-10 — stale 고용 수치를 freshness 통과로 기록 [ACT ON, medium]

실패 생산 경로 `scripts/lib/macro-sources.mjs:811–855`는 previous.series를 유지하고 status='stale'을 반환한다. `scripts/build-reconciliation-status.mjs:276–280`은 고용 3개 value가 유한수이고 observedAt이 존재하는지만 본다. 상태·발표주기·날짜 검사가 없다. buildCategory:96–148은 3/3이면 MATCH, OBSERVED와 'All executable source, freshness, and scope checks passed.'를 만든다.

실제 buildReconciliationStatus에 status='stale', 세 값1, observedAt='2000-01-01', now='2026-10-25'를 넣어 위 출력을 재현했다. promotable=false는 유지되므로 승인/매매용 승격 결함으로 확대하지 않는다. src/data/server-data.js:168–185는 data.json과 대조 artifact를 읽어 상태에 연결한다. 보고서 의미 결함은 확인했지만 실제 화면 오표시는 DOM 미검증이다.

보강안: BLS 발표 예정일 기준 currentness를 producer/보고서에서 공유하고 수집 성공과 관측 최신성을 분리한다. stale LKG·다음 발표 전 캐시·발표 이후 미갱신·부분 series 누락 fixture를 둔다. 날짜 문자열 존재를 최신성으로 인정하지 않는다.

## P4-QA-03 — 고정 13F 분기/accession이 정상 갱신을 차단 [ACT ON, high]

scripts/ci-masters-contract-check.mjs:274는 latestAvailablePeriod='2026-06-30', :292는 Berkshire accession='0001193125-26-352200', 분기2026-06-30, filedAt2026-08-14를 강제한다. refresh-data.yml:207–233은 신규 HR/HR-A를 발견하면 discovery→reference→history→aggregates→runtime→ticker index 후 이 gate를 실행하고, :236–243은 실패한 Masters 파일을 HEAD로 복원한다.

다음 정상 분기나 Berkshire 정정 신고가 고정값을 바꾸면 성공한 수집도 실패·복원 대상이 된다. 같은 lane의 13D/G 갱신도 복원될 수 있다. 시장 전체 갱신은 continue-on-error 경계로 계속되므로 사이트 전체 배포 중단으로 표현하지 않는다. 증거는 조건문과 실패 경로의 독립 판독 E1이며 미래 실제 Actions 실행을 관측한 것은 아니다.

보강안: 과거 신고를 보존하는 회귀 fixture와 최신 artifact 계약을 분리한다. 최신 계약은 discovery 연결, 분기 단조성, 인접 직전 분기, 정정 체인·원문 출처 정합성을 검사한다. 새 분기/정정 정상 fixture를 통과시키면서 손상 입력은 거부하도록 한다. 13D/G의 독립 실패·복원 단위를 검토한다.

## 주 담당자 직접 판독 범위

| 파일 | 범위 | 내용·한계 |
|---|---|---|
| scripts/fetch-sec-fundamentals.mjs | 이전 첫110행 + 이번111행~끝, 전체 누적 | 복원 의무, core/extended, retry, 신규 filing 우선순위, SIC, successor, LKG, pruning, receipt. 외부 요청/normalizer 전수 검증 아님 |
| scripts/build-sec-runtime-projection.mjs | 직전 전체; 이번1–65 재확인 | USD/quarter/fiscal projection·누락 직렬화. 최상위 쓰기 있어 import 실행 안 함 |
| scripts/lib/candidate-archive.mjs | 전체 | default/shadow, forward21 자체 세션, coverage80%, retention60일, identity/최대400 |
| src/domain/screener/candidate-record.js | 전체 | 최신 identity, 비중복 window, IC n12. shadow는 별도 독립 표본 통계 미반환; 실제 결정 경로 추가 검토 |
| src/domain/fundamental/sec-earnings.js | 전체 | concept anchor, Q4 차감, 연속4분기, common earnings 우선, 평균자본 ROE, 이전 P/E 재조정. 90% FY와 같은 Q4 제거 heuristic의 순이익 일회성 효과는 미검증 후보이며 finding 아님 |
| src/domain/screener/factor-ranks.js | signed yield 구간 | 실제 소비 확인; 전체 순위 재실행 안 함 |
| scripts/build-reconciliation-status.mjs | helpers/category·고용/거시 일부·발행 tail | 고용 재현. 22개 전체 최신판 재검토 아님 |
| scripts/lib/macro-sources.mjs | fetchBlsSeries811–895 인근 | 실패 stale 계약. 전체 공급자 이번 재검토 아님 |
| scripts/ci-masters-contract-check.mjs | 261–302 | 고정 분기/accession; gate 전체 인증 아님 |
| .github/workflows/refresh-data.yml | 196–251 | 수집→gate→복원; 전체는 별도 reader |

## 자료와 코드 불일치

- 기존 P3-DOC-01: aio_api_setup_guide.py v56 및 PDF v49.57의 Claude 개인 키/구형 proxy/FRED relay 안내가 현재 /openai 공유 Worker, /anthropic 410, Actions-only FRED와 다르다. PDF는 현재 Pages allowlist에 없으므로 공개 배포 파일로 단정하지 않는다.
- candidate-archive의 'a missing input stays missing' 주석과 빈 칸→0 동작이 다르다(P4-DATA-09).
- reconciliation의 freshness 통과 문구와 고용 검사 내용이 다르다(P4-DATA-10).
- 자동 최신화 제품 정책과 과거 분기를 강제하는 Masters gate가 충돌한다(P4-QA-03). 제품 정책을 과거 fixture에 맞추는 방식은 제안하지 않는다.

## 검증·한계

reproduce-pass4.mjs exit0: 실제 순수 함수 두 개 및 읽기 전용 발행 데이터 검사. producer·외부 API·브라우저·Actions 미실행. 제품 코드·데이터·workflow 수정, commit/push/배포 없음. 미검증 파일이 남아 있으므로 모든 파일을 직접 판독했다고 보고하지 않는다. 독립 검토는 동일 계열 에이전트이며 independence: limited.

affected QA: run 2026-10-25T13-22-24-082Z-11656-am4mcq, 실행3 PASS·cache11·실패0. 이 결과는 감사 파일 변경에 대한 선택 게이트 결과이며 제품 전체 의미 검수 인증이 아니다. 추가 감사 스크립트 두 개 node --check 및 감사 폴더 git diff --check 통과.

## 전수 검토 대장과 남은 범위

FILE-REVIEW-LEDGER.json은 tracked+nonignored untracked 경로 전체를 열거하고, 이번에 명확히 대조한 파일에만 판독 수준과 내용 hash를 붙인다. NOT_RECONCILED_IN_FILE_LEDGER는 이전 보고서를 아직 파일별로 대조하지 않았다는 뜻이며 모두 미열람이라는 뜻도, 모두 완료라는 뜻도 아니다. 전체 인벤토리 개수는 다른 작업과 감사 산출물 추가로 변한다. ignored/private 파일은 기존 별도 경로 목록 수준이며 본문을 복사하지 않는다.

13F reader가 전달한 current/reference의 NEW_HOLDINGS_ADD 정정 원문 provenance 후보는 아직 독립 확인·재현 전이므로 미확정이다. 현재 restatement 사례를 추가형 정정 오류로 오인하지 않는다. 운영 reader의 13개 workflow 전체 판독 보고도 상세 파일표를 받지 못했으므로 주 담당자 직접 판독으로 세지 않는다. 두 reader는 사용량 제한으로 중단됐다. 재시도 응답이 없었던 구간, 전체 UI/classic js, SEC normalizer, 바이너리 시각 자료, 실제 API/Actions/browser는 여전히 남아 있다.
