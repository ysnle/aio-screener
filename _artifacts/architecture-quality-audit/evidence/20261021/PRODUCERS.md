> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# Producer 분할 의미 검토

MODE: review | VERDICT: PASS+NOTES | REF: d36bb256ddf60468d6c7a134628053c5796be6be (v58.52)

FINDINGS: 이 추가 범위에서 새로 입증한 actionable 결함 0개. producer 실수집·외부 API·유료 AI·public-data 쓰기·Git mutation은 실행하지 않았다.

## 읽기 범위

scripts/producer에는 고정 REF 기준 15모듈이 있다. scripts/fetch-data.mjs 진입점을 더해 요청한 16파일을 모두 전문 의미 검토했다. history는 1–165, 166–355, 356–530, quotes는 1–205와 206–394, screener는 1–185/186–375/376–560/561–694, narrative는 1–150/151–270/271–380, breadth는 1–125/126–245로 연속 구간을 읽었다. 나머지도 전문을 읽었으며 미독 구간은 없다. 원장은 `producer-reading.tsv`에 고정 REF 원문 SHA-256과 FULL로 남겼다.

기준 df6f0b33의 fetch-data.mjs와 함수 이전/변경을 정적 비교했다. 함수 선언 보조 인덱스에서 51개 본문이 export 키워드 외 완전히 같고, 12개가 변경되었으며, 15개가 새 함수이다. 이 숫자는 정규식 기반 탐색 보조 정보이며 AST 동등성이나 전체 동작 인증을 뜻하지 않는다. 변경된 12개는 전후 원문을 `producer-base-<함수>.txt` / `producer-current-<함수>.txt`로 저장하고 전체 diff를 읽었다. main은 전후 전체 diff와 새 전문을 대조했다. 상수·import·export도 각 파일 전문에서 검토했다.

## 계약별 판단

| 계약 | 확인한 내용 | 증거의 한계 |
|---|---|---|
| 날짜·세션 | quotes의 KRX 이전 종가·FX 23:00Z cut, history의 완료 세션·fieldMeta·반복 세션 보류·420행 cap은 기존 함수 본문과 같다. core/extended는 공유 price-factors의 완료 봉으로 계산한다. | 실제 공급자 응답/휴장일 동작은 실행하지 않았다. |
| 파일 경로 | 기존 scripts/../public-data와 새 scripts/producer/../../public-data는 같은 저장소를 가리킨다. screener universe·SP500 weights·candidate archive도 REPO_ROOT로 옮겼다. Windows와 POSIX 경로 normalize fixture PASS. | 실제 Actions checkout filesystem을 열지 않았다. |
| 부분 실패 | sourcePlanes가 12소스별 run/fallback을 선언하며 Promise.allSettled가 개별 throw/null을 기존 fallback으로 바꾼다. quotes 최소 50% 가드는 data.json 쓰기 전에 유지된다. quote 재시도 및 TwelveData ETF 한정 fallback도 기존 흐름이다. | 실수집 실패를 유도하지 않았다. |
| LKG·캐시 | previous planes에서 BLS/BEA/Treasury/HY/AAII/DEXKOUS의 기존 payload를 전달한다. 같은 news cycle carry가 새로 추가되며 fetchNews는 이를 현재 규칙으로 재채점한다. FRED cycle의 complete/partial 구분은 동일 deriveFredCycle이다. | provider 캐시 실제 응답과 갱신 cadence를 새로 인증하지 않았다. |
| AI 비용 | createAiUsage는 기존 shared Worker request만 감싼다. 번역은 Workers AI→공유모델 fallback, 분석은 최대 1회+validator 재시도 1회다. 새 slot summary도 aiUsage.shared를 통해 같은 Worker로 간다. 개인 키/다른 공급자 호출이 추가되지 않았다. | Worker의 실제 월 예산 reservation/settlement는 이 소유 범위 밖이며 실행하지 않았다. wrapper 요청 수는 물리적 Workers AI chunk HTTP 수와 다를 수 있어 비용 청구서로 읽으면 안 된다. |
| 원자 게시 | data.json 두 번 쓰기 모두 atomicWriteFile 및 toPublicPayload를 거치고 마지막 실제 파일 readback이 quotes=[]/quotesPublished=false를 확인한다. screener/core/extended/history/macro 파일도 같은 atomicWriteFile을 유지한다. atomic helper는 임시 파일 후 rename 방식이다. | 원자성은 파일 단위다. macro/history/snapshot/sidecar 전체가 한 트랜잭션이라는 보장은 기존에도 없었다. |
| API 호환 | 원래 fetch-data.mjs가 export한 115개 이름은 현재 진입점에 모두 유지된다. | 이름 보존을 검증했으며 전 API 실행 parity를 인증하지 않았다. |

## main 호출 순서

previous data·이전 macro calendar 읽기 → rotation/macro-history/macro-calendar 독립 작업 시작 → sourcePlanes 전부 수집 → macro/survey merge·quote 검증 → receipts/meta 조립 → quote coverage guard → snapshot 게시 또는 retained snapshot 읽기 → history 갱신 → timeline seal → 합친 headline 번역 → 시장 해석 및 검증/보류 → slot summary → snapshot cycle metadata → rotation 결과 합류 → stripped data.json 1차 원자 쓰기 → macro 작업 합류 → FX cross-check·cycle 완료 판정 → score backtest → 기존 screener 상태 읽기 → reconciliation/operations sidecar → stripped data.json 2차 원자 쓰기 → readback.

핵심 guard/retained snapshot 전달/history-before-analysis/strip-readback 순서는 이전과 같다. timeline·AI usage는 추가된 단계다. macro task는 처음부터 독립 시작되므로 core quote guard 실패가 모든 보조 파일 쓰기를 취소한다는 가정은 성립하지 않으며, 이는 이전 main에서도 같은 구조다.

## 의도 있는 의미 변경

- KR portal의 KRX+Nextrade 병합 가격을 기존 완료 KRX 봉 위에 덮지 않는다. 2026-09-13까지의 provider 누락 세션만 채우며, 최근 gap은 그대로 보고한다. 기존 범위·조정비율·재조정 거부가 유지되고 요약은 divergence 개수를 새로 담는다.
- price factor history가 1y에서 2y가 되었고 실패 심볼은 2개 동시성으로 한 번 재시도한다. 20개 이상 실패 시 45초 대기한다. 기존 FX/지수 보조회수와 trailing factor API는 유지된다. 실제 시간/공급자 할당량은 미측정이다.
- macro history에 permits/shelter/supercore 3시리즈가 추가됐다. 같은 FRED 정규화·부분실패 LKG·atomic publish 경로다.
- CPI BLS promotion에 기존 FRED 관측월보다 오래되면 건너뛰는 검사가 추가됐다. HY 관측일 비교는 유지됐다. Treasury/BEA 우선순위 동작은 기준 main과 같다.
- AAII의 current-reference가 fresh status에 포함되어 실제 수집 성공을 실패로 기록하던 상태 불일치를 해소한다. news receipt 단위가 기사 수에서 feed 수로 맞춰졌고 feedHealth를 메타에 보존한다.
- analysis regime는 interpretationFromArtifacts로 옮겨 동일 pipeline을 소비한다. 새 adapter 입력 shape와 렌더 호출을 읽었다. narrative 참고 문맥 및 faithful 번역 검증, 새 KST 하루 문장 갱신 판정이 추가됐다. 실제 생성 결과의 의미 품질은 실행/인증하지 않았다.

## 후보 판단

분할로 `__dir`가 새 디렉터리를 가리켜 다른 public-data에 쓸 것이라는 후보는 DISMISSED: paths.mjs의 두 단계 상위 REPO_ROOT와 이전 경로의 정규화 결과가 같다. import만으로 producer가 실행될 것이라는 후보도 코드상 DISMISSED: fetch-data main/스크리너 실행은 direct-run guard 안에 있고 신규 모듈 top level은 선언·상수 조립이다. 이 판단을 확인하려고 producer를 import하지 않았다.

`options-put-call` receipt의 Number(null)→0으로 stored=1이 될 수 있는 조건은 기준 main에도 동일하게 존재한다. 이번 분할이 도입한 결함으로 세지 않았으며, 이 추가범위에서 실소비 영향까지 입증하지 않아 별도 actionable finding으로 승격하지 않았다.

## 실행 증거

- `node _artifacts/architecture-quality-audit-20261021/producer-static-audit.mjs`: 고정 REF 16파일 hash 원장 및 함수 비교 인덱스 생성. producer 코드 실행 없음.
- `node _artifacts/architecture-quality-audit-20261021/producer-isolated-check.mjs`: pinned source 16개 stdin `node --check` PASS, 기존 export 115개 보존 PASS, Windows/POSIX 경로근 동등 PASS, 실제 collectSourcePlanes 함수만 VM 격리하여 정상/throw/null fixture fallback PASS. injected fixture 외 collection 함수는 부르지 않았다.

SAFETY FACT: 파일 이동 후 경로와 기존 public export 이름이 유지됨은 격리검사 단계 4로 확인했다. 수집 품질·AI 문구·실배포·Worker 청구·전 producer 종단간 parity는 UNPROVEN이다. 독립성은 동일 모델의 별도 correctness 담당자이므로 limited다. 제품 변경·커밋·푸시·배포 없음.
