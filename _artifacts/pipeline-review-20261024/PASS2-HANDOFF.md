# 전체 파이프라인 감사 — 2차 추적 기록

## 상태와 기준

**전수 완료 아님.** 1차 HANDOFF의 파일 인벤토리는 읽기 완료 목록이 아니다. 이 문서는 경로별 직접 판독, 격리 재현, 미검증을 분리한 후속 기록이다. 원래 HANDOFF의 12개 finding은 당시 소스 기준이며, 현재 버전에 모두 그대로 존재한다고 재인증하지 않았다.

재개 시 HEAD `4fc85379e02ab6756c00a5ad6a6128e3ce088e4c`, v58.75, 작업 트리 clean. 앞선 v58.74 조사 중의 dirty 상태와 다르다. 이 감사가 git commit/push/deploy를 실행한 것은 아니다. 기준선: `pipeline-review-pass2-resume-20261024`(4,333개 파일). 생산 코드, workflow, public-data는 변경하지 않는다.

시장 / 펀더멘털 / 지식·운영 병렬 reader가 사용량 제한으로 종료되어 완결된 근거표를 반환하지 못했다. 중간 메시지는 조사 후보로만 취급했다. 아래 3개는 주 담당자가 현재 소스를 직접 읽고 별도 재현했다. 나머지 담당 범위를 읽기 완료로 계산하지 않는다.

## 추가 발견과 후속 설계

### P2-DATA-06 / 높음: Cboe 보존값을 이번 수집 성공으로 보고

- 진입·전파: `scripts/producer/source-planes.mjs:70` → `planeFresh`(23행) → `scripts/producer/receipts.mjs:36,92` → `domain-receipt.mjs` → `build-operations-status.mjs:241,582`.
- 실패 응답에 기존 totalPutCall/asOf가 있으면 예전 객체를 펼치고 `status: stale-reference`, attemptedAt, failureReason을 추가한다. 예전 fetchedAt은 유지하고 error는 새로 넣지 않는다. 하지만 planeFresh는 status를 보지 않고 `!error && fetchedAt`만 판단한다.
- 실제 소스의 보존식을 VM에서 실행하고 실제 buildDomainReceipts에 전달했다. 10/22 관측·10/23 수집값을 10/24 실패 후 보존한 fixture에서 `updated=1`, `retained=0`, `transientFailed=0`, `publication=SUCCESS`, `lastSuccessfulObservation=10/24`가 나왔다.
- 영향: 수집 실패가 운영 성공 기록으로 변한다. 값 자체의 status는 stale-reference이므로 모든 화면이 최신으로 표시된다는 주장은 하지 않는다. 운영 진단과 마지막 성공 시각은 잘못된다.
- 개편안: plane별 성공·보존·실패 판정을 단일 함수에서 반환하고 receipt가 그 판정을 그대로 사용하게 한다. 관측일, 마지막 실제 수집일, 이번 시도일은 독립 필드로 유지한다. 보존값 유효성과 이번 수집 성공을 별개로 판단한다.
- 회귀 기준: 성공→실패→연속 실패→회복을 fixture로 연결하여 보존 중 updated=0/retained=1, 성공시각 불변, 회복 시에만 전진을 검사한다. null을 Number(null)=0으로 유효값 판정하지 않도록 보존 eligibility도 별도 점검한다.
- 근거 수준: 실제 함수/소스 격리 재현. Cboe live 호출 없음.

### P2-DATA-07 / 중간: FMP 성장률 URL의 두 번째 물음표

- 진입: `fetch-data.mjs:293` SCREENER_ONLY → `producer/screener.mjs:545,591` → enrichFundamentals.
- `screener.mjs:153–158`: 공통 fetch는 endpoint 뒤에 `?apikey=`를 붙이는데 financial-growth endpoint에는 이미 `?period=annual&limit=1`이 있다.
- 실제 enrichFundamentals 함수 본문을 추출하여 가짜 fetchJSON으로 실행했다. 요청은 `financial-growth/AAPL?period=annual&limit=1?apikey=fixture-key`; 표준 URL 파서의 apikey는 null, limit은 `1?apikey=fixture-key`였다. 비밀키를 사용하지 않았다.
- 영향: FMP_API_KEY를 설정한 선택적 성장률 경로의 인증 파라미터가 잘못된다. ratios와 earnings는 독립 요청이어서 부분 성공이 가능하고, ok는 전체 rec가 하나라도 있을 때 증가하므로 성장률 누락이 전체 성공에 가려질 수 있다. 뒤의 SEC 보강 경로가 있으므로 전체 성장률/스크리너가 반드시 비어 있다는 주장은 하지 않는다. 현재 secret 존재 및 공급자의 실제 응답은 확인하지 않았다.
- 개편안: URL/URLSearchParams로 query를 합성하고, 공급자 성공률을 심볼 단위뿐 아니라 필드/endpoint 단위로 남긴다. 값의 단위(소수 비율→%)와 모델(annual vs TTM)은 계속 구분한다.
- 회귀 기준: query 없는/있는 endpoint의 키·period·limit을 파싱하여 검증하고, ratios 성공 + growth 실패에서 성장률 실패만 독립적으로 표시하는지 확인한다.
- 근거 수준: 실제 함수 격리 실행. FMP live/API 플랜 검증 아님.

### P2-KNOW-02 / 중간: 지식 dossier의 부분 문자열 근거 오연결

- 입력: coverage-matrix, sources, claims, research-source-seeds, research-facts, articles → `build-knowledge-research-dossiers.mjs` → 개별 dossier + bundle.
- `83행`은 appliesTo token을 includes로 찾는다. articles builder의 `49–52행`은 같은 결함 부류를 막기 위해 whole-token 규칙으로 바뀌었지만 dossier builder에는 남아 있다.
- 현재 실제 artifact `public-data/knowledge/research-dossiers/atlas-foundation_evaluation.json:129`에 AI Evaluation의 근거로 `fact:sec:financial-statements`, `fact:sec:10k-reading`이 연결된다. evaluation에 valuation이 포함되기 때문이다.
- builder 전체 변환을 VM에서 실행하되 모든 출력은 메모리로 받았다. 현재 입력 455개 dossier를 재생성한 결과도 같다. 부분문자열과 whole-token이 다른 후보 연결은 177건이지만 **177건 모두 오류라는 뜻은 아니다**. 약어·하이픈·복합어 중 유효한 연결도 포함하므로 개별 의미 검수가 필요하다.
- 영향: 근거 탐색 자료에 무관한 재무제표 fact가 들어간다. 이 사례에는 별도의 NIST fact도 있어 RESEARCHED 상태 자체가 오연결만으로 만들어졌다고 단정하지 않는다. 일반적으로 87–88행은 날짜 있는 fact 하나로 상태를 승격하므로 오연결만 있는 사례는 추가 대조 대상이다. semanticReview REQUIRED 표시는 유지되어 있다.
- 개편안: 명시적 unit→fact 연결을 우선하고, 추론 매칭은 후보로 남긴다. article/dossier가 공유하는 매칭 계약을 두되 단순 문자열 동일화보다 각 근거의 scope를 검증한다. RESEARCHED와 의미 검수 완료를 계속 분리한다.
- 회귀 기준: evaluation/valuation, capacity-and-yield/채권 yield, generalization-and-memory/HBM 등 부정 사례와 정당한 CPI·HBM 약어 연결을 함께 시험한다. 모든 후보를 일괄 삭제하지 않는다.
- 근거 수준: 현재 artifact 직접 확인 + 실제 builder의 격리 변환. 외부 원문 전수 대조 아님.

## 경로별 판독 원장

아래 '판독'은 소스 읽기 수준이다. 브라우저/운영 실행 인증을 뜻하지 않는다. 재개 전 v58.74에서 읽은 행은 현재 v58.75의 전체 재판독으로 승격하지 않는다.

| 경로 | 입력→변환→소비 | 확인한 계약/실패 처리 | 판독과 남은 범위 |
|---|---|---|---|
| 공용 artifact 캐시 | URL/fetcher→TTL·크기·무결성·공유 promise→provider | 15분/64개, 소비자 abort 참조, timeout | artifact-cache.js 전체(v58.74); 본문 전체 읽은 뒤 크기 검사하므로 다운로드 메모리 상한과는 다름. 실브라우저 미검증 |
| 공용 artifact 갱신 | generatedAt/loadedAt→재시도·loadJson→runtime root | 60초 실패 cooldown, source별 TTL/schema | shared-artifacts.js 전체(v58.74); 서버 시각과 로컬 loadedAt 비교 의미 추가 확인 필요 |
| 포트폴리오 store | runtime read→normalize→command→slice→selector | missing 숫자 보류, 통화·FX 선언 유지, clear | provider/orchestrator/normalize/command/slice/selector 전체(v58.74); UI 저장/복원 end-to-end는 미완료 |
| 포트폴리오 backup | JSON 구형/신형→섹션별 정규화→import caller | 버전·빈 backup·심볼 형식 검사 | portfolio-backup.js 전체(v58.74); import 전체 transaction/rollback 미검증, 큰 ts의 Date 예외 후보 미확정 |
| 현금·가정·선언 | storage/legacy→cash balances·assumptions→runtime | 통화별 값, enum 미인식, write-readback 후 migration | assumptions/declarations-store 전체, cash 대부분(v58.74); plain/secure 저장 실패 UI 미검증 |
| 계좌 원장 | 사용자 입출금/평가액→normalize/append→coverage | 6종 입력 선언, 날짜·종류 동일 입출금은 대체 | portfolio-ledger.js 전체(v58.75); 같은 날 복수 입금 입력 의도와 UI 문구 확인 전 결함 확정 금지 |
| 금융 암호화 | PIN→derive→sentinel/기존 ciphertext 검증→migration | generation guard, 실패 rollback, AI 전달 축약 | financial-security.js 전체(v58.74); Vault caller·실제 저장·다중탭 미검증 |
| 매매 일지 | 사용자 거래→normalize→통화/종목 FIFO→통계/리뷰 | 수수료 비례배분, 초과매도 unmatched, 통화별 금액 분리 | domain/portfolio/trade-journal.js 전체(v58.75); UI/저장 연결 미완료. 같은 날 buy 우선 순서·lot 수와 거래 수·소표본 비율 문구 후속 검토 |
| entity 조회 | symbol→fundamentals/onDemand→projection→dispatch | generation/dispose guard, 30분 cache | entity provider/orchestrator 전체(v58.74); 모든 downstream normalizer 미완료 |
| earnings | coverage window→rows→consumer | 범위 선택/120초 cache/실패 reset | provider 전체(v58.74); 실제 발표일 시간대·화면 미검증 |
| news runtime | runtime news/meta→normalize→stale→dispatch | nextrefresh 또는 36시간 기준 | provider/orchestrator 전체(v58.74); feed publish vs bundle time 의미는 producer와 연결 추가 필요 |
| market runtime | runtime quote/metrics→normalize→store | time window 전달 | provider/orchestrator 전체(v58.74); 모든 quote evidence 변환 미완료 |
| sentiment runtime | runtime/snapshot→결측 보완→freshness/allowedUse→store | reference-only 상태에서 snapshot 보완 | provider/orchestrator 전체(v58.74); 화면별 허용용도 해석 미완료 |
| analysis/themes runtime | runtime→normalize→dispatch | themes orchestrator 단순 경로 | analysis provider/orchestrator, themes orchestrator 전체(v58.74); themes provider·normalizer 추가 필요 |
| screener publication set | 3개 artifact→schema/size/revision 비교→compatibility | 다른 cadence 허용, incompatible 차단, unjudged 별도 보존 | publication-set.js 전체(v58.75), screener caller 검색/부분 판독. 같은 수 다른 membership·schema 없는 COHERENT는 설계 검토 후보, 아직 결함 확정 안 함 |
| 개인 transport/quote 계약 | fetch/quote→timeout·형식→consumer | 응답 헤더 후 timeout 해제, 유한 숫자 검사 | 모듈 전체(v58.74); 활성 caller·후속 정규화 확인 전 위험을 실제 결함으로 주장하지 않음 |
| Cboe/plane receipt | provider→보존/성공 판정→receipt→운영상태 | 독립 Promise.allSettled fallback | source-planes/receipts 전체(v58.75), 격리 재현 완료; 나머지 plane 외부 응답 미검증 |
| FMP enrichment | key/symbol→3 endpoint→단위변환→screener→SEC 보완 | endpoint 실패 null, 심볼 rec별 성공 | 해당 함수 전체 및 진입/병합 경로(v58.75), 격리 재현; screener 전체 알고리즘 전수 완료 아님 |
| research dossier | 6 입력 artifact→근거 선택/상태→455 dossier | canonical source 존재/dated fact/semanticReview 경계 | builder 전체(v58.75), 출력 쓰기 없는 재현; 455개 내용의 의미 전수 검수 아님 |

## 남은 전수 감사 범위와 작업 순서

1. **펀더멘털·시장 생산자**: SEC 단위·FY/Q·amendment·acceptedAt·가격 결합, DART, 13F/13D/G, consensus/earnings, listings/universe, core/extended screener, factor/backtest/archive를 개별 행으로 분해한다. 중단된 reader가 완결 증거표를 반환하지 않아 기존 부분 추적 이상으로 완료 처리하지 않는다.
2. **시장 보조 경로**: source-planes 외 macro/history/KR reconciliation, news/Telegram/translation, calendar/scenario/stress/temperature, webresearch의 생산→보존→배포→소비를 각각 연결한다. 기존 findings의 v58.75 유효성도 이때 확인한다.
3. **지식·운영**: 나머지 knowledge/principles/atlas builders, retrieval, QA selection/cache, workspace/agent generators, record-fix/bump, maintenance, 13 workflows/reconciliation/release 경로를 직접 읽은 범위와 대조한다. workflow 인벤토리는 실행 경로의 의미 전수 검증이 아니다.
4. **runtime·AI·개인 데이터**: 남은 router/lifecycle/onDemand/normalizers, screener/themes, Worker budget/reservation/stream/settlement, vault/import/export/UI caller, 포트폴리오 계산 경로를 연결한다.
5. 각 항목에 입력 단위/시간, producer/consumer, 보존·실패 정책, 증거 파일/행, 실제 재현, 관련 gate, 미검증을 채운 뒤에만 완료로 바꾼다. 최종 전체 목록과 검토 완료 목록의 차집합이 남으면 '전수 완료' 표현을 쓰지 않는다.

## 실행 증거

`reproduce-pass2.mjs` → `pass2-reproductions.json`. 실제 소스 추출 또는 실제 순수 함수를 사용했다. 모든 네트워크는 생략/가짜 함수이고 dossier 출력은 메모리로만 수집했다. 파일 출력은 감사 결과 JSON 하나뿐이다. 소스 변경·생산자 실실행·배포 없음. 재현 성공은 결함 재현 성공이며 제품 QA 통과가 아니다.

문서 범위 affected QA: 최초 13 PASS / 1 FAIL. 실패는 qa-runner-behavior가 sandbox Temp의 last-run.json을 찾지 못한 ENOENT다(`pass2-affected-initial.json`). TEMP/TMP를 저장소 내부 `.cache/pipeline-review-20261024/temp`로 지정한 뒤 실패한 한 gate만 다시 실행하여 1 PASS, failed batch 해소를 확인했다(`pass2-affected-retry.json`). `git diff --check`도 통과했다. full release/browser/live 인증은 수행하지 않았다.
