> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# Legacy core 전체 의미 감사 — v58.59

MODE: review | REF: 7e2411432f6ca0e5f02528b209b013bf5f7ff2dc | js/aio-core.js

고정 Git 원문 SHA256 `01fafc2a104ca8af0151f0dc2e5425bbd565900c337eaee60cf9a9ec505b50bc`, UTF16 1,042,074자. 최신 파일 전 범위 읽기를 완료했다. 기존 d36bb256 v58.52 원장의 [0,544000) 연속 읽기를 재사용했다. 이전→최신 전체 diff를 읽었고, `probe-legacy-core.mjs`는 모든 unchanged diff run의 실제 본문 동등성을 확인했다(`unchangedDiffRunsVerified: true`). 최신 [540000,1042074)를 겹쳐 연속 읽었다. 566000~610000 출력의 중간 축약은 [582000,590000), [589000,598000) 재독으로 메웠다. 이전 scattered read 범위는 재사용하지 않았다.

## 확인된 기존 결함 유지

[PRE-EXISTING][medium] `js/aio-core.js:8449` HWM CIK가 HPE `0001645590`으로 연결된다. `fetchSECBusinessDescription`은 `raw.tickers`/`raw.cik`와 요청 티커의 일치를 확인하지 않아 HWM 요청에 HPE filing을 `available:true`로 돌려준다. `js/aio-chat.js:2975`의 실제 SEC consumer 블록은 `available`만 검사하고 기업명·URL 및 '이 출처를 인용하여 답변' 지시를 AI 입력에 붙인다. 최신 고정 원문으로 `reproduce-legacy-core-hwm.mjs`를 다시 실행하여 `wrongIssuerAccepted:true`를 확인했다. 외부 API 없이 실제 함수와 정확한 consumer를 VM에서 실행하고 HPE fixture를 주입했다. 브라우저/배포 증거는 아니다. 이전 감사에서 확정된 건이므로 신규 발견으로 세지 않는다.

## CIK_MAP 전수 정적 대조

180개 매핑을 같은 REF `public-data/sec-fundamentals-summary.json.data`의 CIK와 숫자로 정규화하여 대조했다. 168개 일치, 11개 불일치, BRK.A 1개 정본 미포함이다. 전체 180개 대조 결과는 `legacy-core-probe.json.comparisons`에 저장했다.

| 티커 | legacy CIK | SEC summary CIK | 정본 기업명 |
| --- | --- | --- | --- |
| XOM | 34088 | 2115436 | ExxonMobil Holdings Corp |
| BWXT | 1581809 | 1486957 | BWX Technologies, Inc. |
| DUK | 17797 | 1326160 | Duke Energy CORP |
| LUNR | 1844507 | 1844452 | Intuitive Machines, Inc. |
| PL | 1801169 | 1836833 | Planet Labs PBC |
| AFRM | 1820302 | 1820953 | Affirm Holdings, Inc. |
| AAOI | 1070235 | 1158114 | APPLIED OPTOELECTRONICS, INC. |
| IREN | 1878685 | 1878848 | IREN Ltd |
| NXT | 1948544 | 1852131 | Nextpower Inc. |
| APP | 1823144 | 1751008 | AppLovin Corp |
| HWM | 1645590 | 4281 | Howmet Aerospace Inc. |

이것은 저장소 정본과의 불일치를 측정한 결과다. 기업 재편·CIK 변경 가능성을 구분하는 공식 제출물 대조 없이 나머지 10개를 모두 wrong-issuer 신규 결함으로 확정하지 않는다. 특히 XOM/NXT의 기업 재편 여부를 확인해야 한다. HWM은 기존 확정 증거가 있다. 최소 개선 방향은 복제 CIK 표를 공통 entity registry로 합치고 받은 submissions의 issuer identity를 검증하는 것이다.

## 추가 검토와 제외

현재성/quality/evidence, timer/page bus, Vault, stores, chart helpers, technical computations, reference expiry, snapshot projection, native write fences, operational contract, evidence inventory, routing/history/ticker를 검토했다. native fence 아래 legacy 함수의 가상 입력만으로 사용자 결함을 만들지 않았다. `_isFuturesOpen`의 주말 경계, `DATE_ENGINE.krxStatus`의 장 종료 경계, RSI flat-series 등은 의심점이 있으나 현재 소비 경로·사용자 영향까지 증명하지 않아 actionable에 넣지 않았다. futuresOpen은 `_liveSnap` 반환 외 직접 소비를 찾지 못했고 krxStatus도 실제 caller를 찾지 못했다.

이전 prefix 원장의 typed-claim 자기 evidence 신뢰 후보는 실제 pipeline/source registry 대조가 끝나지 않은 상태다. 소스 전 범위 읽기 완료는 모든 시나리오 실행 증명을 뜻하지 않는다. 이 담당이 새로 확정한 actionable은 0개이며 기존 HWM 1건은 최신에도 유지된다. 정본 불일치 10건은 별도 공식 검증 후보로 남긴다.

## 실행 증거와 범위

- `node _artifacts/architecture-quality-audit-20261021-v5859/probe-legacy-core.mjs` → unchanged runs true, CIK 180개 대조 결과 저장.
- `node _artifacts/architecture-quality-audit-20261021-v5859/reproduce-legacy-core-hwm.mjs` → 실제 core 함수 + chat consumer, wrongIssuerAccepted true.
- 제품/데이터/Git mutation, producer, 외부 API, 유료 AI, 브라우저 실행 없음. 감사 폴더의 설명/원장/격리 probe만 작성했다.
- independence: limited — 동일 모델 담당자 1명. 전체 감사의 다른 담당 결과는 root가 통합한다.
