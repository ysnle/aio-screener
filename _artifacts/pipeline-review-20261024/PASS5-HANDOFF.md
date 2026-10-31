# 추가 파이프라인 의미 감사 — 2026-10-26

후속: [PASS6-HANDOFF.md](PASS6-HANDOFF.md)에 추가 본문 판독과 조건부 통계·재계산 순위의 격리 재현을 기록했다. 전체 감사는 계속 진행 중이다.

MODE review / v58.80 작업 트리 / independence limited. 제품 변경 없이 감사 자료만 작성한다. 전체 파일·파이프라인 완료가 아니다. 세 독립 reader의 범위표는 PASS5-COVERAGE.md에 통합하며, 주 담당자 판독과 reader 판독을 구분한다. 재현은 reproduce-pass5.mjs → pass5-reproductions.json.

## P5-SEC-01 — 은행 매출의 정규화·재무제표 소비 경로 불일치 [ACT ON, medium, E2]

src/domain/fundamental/sec-normalize.js:38–52,92–95는 같은 accession·기간·form의 순이자수익과 비이자수익을 합성한다. sec-statements.js:67–68은 concept 목록만 공유하고 원본 companyfacts 필드만 읽으므로 내부 derived concept을 생성하지 않는다. js/aio-chat.js:4803–4809는 이 결과를 collected.secFin에 넣는다.

실제 두 함수에 2025 FY 은행 fixture(순이자80+비이자20, 순이익10)를 넣으면 normalizer revenue=100, margin=10이지만 statements revenue=[]다. 부모가 독립 실행해 확인했다. 원문 은행 데이터나 실제 화면에서의 발생 빈도는 미확인이다. 기본 정규화에는 값이 있어도 상세 분석의 매출 추이·근거가 빠질 수 있다. IFRS 은행 fee 제외 정책도 같은 selector를 사용하지 않으나 해당 별도 사례는 재현하지 않았다.

보강: concept 이름 목록뿐 아니라 합성·배제·동일 기간 선택 규칙을 공유하는 순수 관측 선택기를 둔다. 원본 총매출 기업, 은행 합성만 있는 기업, 한 operand 누락, 다른 accession, IFRS fee-only를 계약 fixture로 분리한다. 원자료에 없는 매출을 추정하는 대안은 금지한다.

## P5-DATA-11 — Nasdaq 정상 복귀 후 이전 재무 경고 유지 [ACT ON, medium, E2]

scripts/lib/extended-universe.mjs:85는 Financial Status=N을 null로 정규화하고 :224는 listed.financialStatus || listed.nasdaqFinancialStatus || prior.nasdaqFinancialStatus로 병합한다. 실제 파서와 buildExtendedUniverse에 현재 N·이전 D를 주면 source=CURRENT인데 결과 D다. producer/screener-extended.mjs:102가 shard identity에 전달한다.

영향은 발행 artifact의 잘못된 경고 상태로 한정한다. provider/normalizer→UI 전달과 순위 영향은 확인되지 않았다. 보강: 정상이라는 명시적 값과 미수집을 구분하고 CURRENT에서는 새 상태를 권위로 사용한다. D→N은 제거, D→E는 갱신, 실패→RETAINED는 D와 날짜 유지라는 세 fixture를 둔다. 불리한 값을 무조건 보존하는 것이 데이터 정직성은 아니다.

## P5-SEC-02 — 추가형 13F 정정에서 행별 근거 문서·제출일 손실 [ACT ON, medium, E2]

lib/13f-compose.mjs는 ORIGINAL A와 NEW HOLDINGS B를 합치면서 rowProvenance에 각각의 accession을 보존한다. collect-13f-reference.mjs:222–228,265–280은 합성 rows를 읽지만 모든 fullRows의 filedAt/sourceUrl을 manager.latestFiling으로 지정한다. build-13f-reference-ticker-index.mjs:21–59가 이를 전달하고 src/ui/pages/masters.js:260–264가 SEC 원문 링크로 표시한다. top/comparison rows에도 같은 최신 URL 정책이 있다.

실제 compose 함수와 collector의 fullRows 매핑 본문을 수정 없이 추출해 VM에서 실행했다. 원본 A의 provenance=original인데 URL은 added, filedAt도 추가 신고일로 바뀐다. VM의 comparisonKey/normalizeCusip은 unrelated identity helper stub이며 외부 요청·collector 전체 실행은 아니다. 금액 합성 오류가 아니라 근거 연결 오류다. reader가 확인한 현재 다중 amendment는 RESTATEMENT 두 사례여서 현재 화면 발생 증거로 쓰지 않는다.

보강: 원문 accession→filing metadata map을 통해 각 raw row의 출처·제출일을 유지한다. 집계 row는 여러 filing 출처를 가질 수 있으므로 원문 목록을 보존한다. ORIGINAL+NEW HOLDINGS·RESTATEMENT·미분류 정정의 collector→역조회 전달 fixture를 추가한다. history가 provenance를 보존한다는 검사만으로 current/reference의 정합성을 인증하지 않는다.

## 추가 조사 후보·기각 사항

- CONSIDER: ci-masters-contract-check.mjs:196–202의 rawUniqueCusips/rawUniqueIssuerNames 계약에 대응하는 현행 full chain writer를 reader가 찾지 못했다. 고유 보유 수 변화 시 기존 P4-QA-03의 날짜 pin을 해제해도 발행이 막힐 가능성. 수동 생성 경로까지 부정하지 않으며 아직 재현 전이다.
- NOTED: resolve-13f-prior-filings.mjs는 recent에서 직전 분기 한 신고를 선택해 priorFiling만 갱신한다. priorPeriodSubmissions 합성체와의 일치 및 운영 호출 지점은 추가 확인해야 한다. 일상 full discovery와 같은 완전한 복구 도구로 가정하지 않는다.
- NOTED: recover-masters-holdings-from-shards.mjs는 37 managers/366 top rows를 고정한다. 특정 snapshot 복구 도구로서는 설명 가능한 제한이지만 미래 범용 복구 가능성을 인증하지 않는다. 부분 파일 보존·hash·동일 filing·금액 검산을 거친 후 빈 target에만 쓰는 경계는 확인했다.
- DISMISSED: Worker AI 응답의 상태 header가 CORS에 노출되지 않는다는 후보는 handleOpenAi:1285의 Access-Control-Expose-Headers와 기존 fixture를 확인해 기각했다.

## Worker 추가 판독 결과

worker/data-plane.js 전체: 5분 cron→Yahoo 16개→coverage/schema→revision 바뀔 때 KV snapshot→상태 변경/15분 heartbeat. 실패 시 current 보존, health는 dispatch acceptance와 execution NOT_OBSERVED를 분리한다. 공개 읽기는 30초 KV cache, 쓰기 admin은 secret 비교. scheduler는 활성 workflow/최근 성공을 보고 반시간 market 및 하루2회 screener dispatch를 보조한다. 동시 cron/KV eventual consistency 실환경은 미검증이다.

cloudflare-worker-proxy.js는 이전 731–1316 및 이번 1–730,1321–끝 판독을 합쳤다(1317–1320 경계는 후속 확인). 일반 proxy는 host/redirect allowlist, 5MiB streaming cap, timeout, HTML 차단; relay는 고정 BOK/KOSIS params·일일 원자 quota·dispatch 이후 실패 예약 유지·key redaction. Workers AI는 automation token·kill switch·rate·20제목/32KiB·model fallback·array 개수 검사. 공개 health는 비밀 대신 설정·예산 상태만, operator usage는 별도 token으로 보호한다. 실제 비용·secret·외부 endpoint·배포를 인증하지 않는다.

현재 public-config.fastQuotes.enabled=false다. dormant 경로의 잠재 문제를 현재 UI 장애로 승격하지 않는다. source의 기본 per-client cap150과 운영 설정/정책200의 차이는 설정 override와 함께 봐야 하며 기본 상수만으로 운영 결함이라고 단정하지 않는다.

## 실행 증거

- reproduce-pass5.mjs exit0: 위 3개 조건 재현.
- ci-masters-manager-store-check.mjs exit0: 임시 fixture split/reassemble/clock-only rewrite/shrink/tamper, 현재 manager 파일41개 크기 계약 통과. 모든 원문 사실성 검사가 아니다.
- ci-data-plane-contract-check.mjs exit0: cron/dispatch/health 등 mock fixture 및 소스 계약. 로그의 accepted204는 실제 GitHub 호출이 아니다.
- ci-fast-plane-consumer-gate.mjs exit0: enabled=false, soak0/7, rightsReviewed=false, coverage16/16. 활성화·실배포 인증이 아니다.

운영·13F reader의 추가 조사 재개는 사용량 제한으로 중단됐다. 받아 둔 완결표와 주 담당자 재현만 반영했다. producer 실실행·제품 수정·commit/push/deploy는 없다.
