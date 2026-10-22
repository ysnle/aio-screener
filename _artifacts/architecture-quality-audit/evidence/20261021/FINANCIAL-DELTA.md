> 보존된 날짜·버전별 감사 문서입니다. 단일 최신 진입점은 [통합 핸드오프](../../HANDOFF.md)입니다. 본문의 당시 명령·수치·판정은 해당 REF에 한정하며, 옛 경로는 [이동표](../../path-map.json)로 해석합니다. 원본 바이트는 originals.zip에 보존했습니다.

# 금융·거시 domain 후속 변경 감사

MODE: review | VERDICT: FAIL | REF: d36bb256ddf60468d6c7a134628053c5796be6be (v58.52)

새 ACT ON 1건(medium). 기존 M01/M02/M03은 REF에서도 격리 재현됐다. 이번 판정은 소유 범위에 한정하며 앱 전체·브라우저·배포 인증이 아니다. 검토자 financial_current_delta, correctness / data-contract / partial-input / period-boundary lens, independence: limited(동일 모델 팀).

## 읽기와 원장

- 기준 df6f0b33abd1c15c268d818efcbfc3c5547ed9b0의 20261019 financial/macro-market 원장에서 FULL인 domain 47개와 새 index-earnings / market-timeline / stress-sensitivity 3개, 총 50개를 다뤘다. 20261020 폴더에 완료 증거가 있다고 가정하지 않았다.
- 전체 diff 검토 46개(이 중 변경 없음 32개), 고정 REF 전문 검토 4개(rates-fx, index-earnings, market-timeline, stress-sensitivity). 총 변경 파일 18개다. 변경 없는 32개는 기준 전문 감사와 SHA를 재사용했으며 이번 재독으로 세지 않았다.
- 기준 FULL 47개의 기존 원장 SHA256와 `git show BASE:path` SHA256 불일치 0개. `financial-delta-reading.tsv`의 baseSha256 / sha256은 Git 원문 바이트에서 계산했다. 호출자/producer/소비자 10개는 PARTIAL로 분리했다.
- 모든 제품 소스는 고정 `git show REF:path` 또는 BASE→REF diff로 읽었다. 격리 probe는 Git 원문을 VM 모듈로 연결하고 외부 import를 거부한다. 작업 트리 제품 파일을 import하지 않는다.
- 기존 보고서의 finding 설명은 독립 소스 검토와 신규 후보 재현 뒤에 읽었다. 기존 finding의 후속 확인은 아래처럼 별도 표기한다.

## F-DELTA-01 — [ACT ON][medium] 지수 이익 stage가 개별 종목의 컨센서스·가격 만료 계약을 우회함

- 위치: `src/domain/market/index-earnings.js:47`(fwd 존재만 검사), `:61`(종가 날짜 검사 없이 가격 읽음), `:77`~`:84`(지수 수치 발행).
- Trigger: 컨센서스 갱신이 21일 이상 중단되거나 개별 종목의 completed-close가 10일 이상 갱신되지 않은 상태. shared artifact loader는 수집 시각과 schema를 검사하지만 개별 row.asOf / factorSessionDate는 이 지수 소비자에서 검사하지 않는다. 기존 `consensusView`는 각각 21일/10일 상한으로 보류한다.
- Failure: 과거 행을 현재 coverage에 포함해 ‘최근 4주 상향 우위’, 직전 종가 기반 선행 PER, 성장률과 ERP를 계속 발행한다. 가격 기준일은 지수 모델/화면에도 실리지 않아 오래된 가격을 알아볼 근거가 없다. 정상 종목 화면은 보류하면서 새 지수 화면과 공통 lesson은 같은 입력을 최근 사실로 해석한다.
- 측정 proof: 실제 REF 모듈의 동일 입력 비교. 2020-01-01 컨센서스+2026-10-20 가격에서 `consensusView(...,{now:2026-10-21})=null`, `buildIndexEarnings=available:true,coveragePct:100,breadth:1,forwardPe:20,growth:0.25,erp:3`. 반대로 컨센서스는 2026-10-20이고 가격 날짜만 2020-01-01이어도 동일 수치가 나온다. `financial-delta-probe-result.json`의 stale-consensus / stale-price 사례다.
- Caller chain: `requestConsensusEstimates` → `indexEarningsInputForRoot` 및 canonical rows → `buildMarketInterpretation` indexEarnings stage → `renderIndexEarnings`의 ‘최근 4주’/‘직전 종가’ 문장과 `guide/lessons.js` earnings-revisions.live. 이 경로에는 `consensusView` 또는 동일한 row-level currentness 검사가 없다. producer는 outage/blocked 때 이전 artifact를 유지하므로 함수가 받지 않는 불법 입력만의 문제가 아니다.
- 반론/실측 한계: 고정 artifact의 컨센서스는 모두 10/19~20이고 10/21 기준 21일 초과 행은 0개다. 지금 화면에서 오래된 컨센서스가 발현됐다고 주장하지 않는다. 본 finding은 정상적인 갱신 실패 때 지연을 현재로 해석하는 계약 결함이며 브라우저 발생은 미검증이다.
- 최소 대안: index stage에 nowMs를 전달하고 기존 21일 컨센서스/10일 close 기준을 공유해 만료분을 coverage에서 제외한다. 유효 coverage 80% 미만은 기존 보류 동작으로 남긴다. 참고값을 계속 남길 경우 dated/stale 상태와 해당 수치의 기준일을 모델·소비자 모두에 전달한다. 단순히 화면에 수집 날짜만 붙이는 것은 ‘최근 4주’ 의미를 복구하지 못한다.

## 기존 finding의 현재 상태

다음은 새 diff 책임으로 세지 않는다. 기존 보고서를 읽은 후 고정 REF의 관련 줄을 다시 읽고 실제 모듈로 재현했다.

- [PRE-EXISTING][medium] M01, `macro-read.js:296`: upper=5만 있으면 lower.toFixed TypeError. 공통 interpretation stage는 예외를 잡아 macroRead=null로 기록하므로 다른 stage까지 전부 죽는다고 확장하지 않는다. 정상 거시 입력까지 읽기 손실은 남는다. 대안은 두 범위 값이 모두 있을 때만 목표 범위를 만드는 것이다.
- [PRE-EXISTING][medium] M02, `macro-crossroads.js:308`: termPremium20=null인데 `!rose`가 true가 돼 reflation met=4, known=4, ‘조건 충족 4/4’, leadId=reflation. 대안은 기간 프리미엄도 필수 관측으로 null을 전파하는 것이다.
- [PRE-EXISTING][medium] M03, `page-flow.js:308`: 두 하위 그룹 모두 smallSample=true인 입력에서 여전히 ‘가장 강한 One(+20.0%), 가장 약한 Two(-5.0%)’를 발행한다. 대안은 표 행은 유지하되 대표 비교 후보를 headline에서만 선택하는 것이다.
- 기존 F-FIN-01의 normalize/provider 수정 여부는 이번 domain delta 소유 범위 밖이다. 원래 finding을 재검증 완료로 승격하지 않는다.

## 승격하지 않은 후보와 한계

- [NOTED][UNPROVEN reachability] `rates-fx.js:79`: 첫 관측부터 역전인 기록은 실제 확인한 음수 구간 길이가 1일이어도 지속20일 검사를 생략한다. 25개 관측 fixture에서 첫날만 음수, 이후 양수여도 uninverted=true와 ‘자료 시작 이전부터 역전’이 나온다. 관측 이전 상태는 알 수 없는데 단정하는 문제는 재현됐다. 현행 producer가 이런 짧은 경계 기록을 발행하는 사용자 경로는 증명하지 않아 ACT ON에 넣지 않았다. 최소 대안은 관측된 run이20일 미만이면 지속역전 여부를 unknown으로 두는 것이다.
- [DISMISSED current producer path] `market-timeline.js:16`은 change=null을 0.00%로 만들지만 `marketSlotMoves` producer가 finite change만 moves에 넣고 null은 제외한다. 합성 null 재현만으로 현재 사용자 결함으로 올리지 않았다.
- [NOTED] sec-earnings의 90% FY 필터는 revenue 사례의 휴리스틱을 net-income/common-income에도 적용한다. 다만 Q1~Q3가 있으면 FY−Q1~Q3로 같은 Q4가 복구되므로 정상 완비 입력에서 오산이라고 주장하지 않는다. 직전 3분기가 불완전한 합법적 filing artifact에서 실제 TTM 손실 사례는 입증하지 않았다.
- stress-sensitivity의 OLS 산술, 표본30주, 요인별 결측 pair 제외, bp 변환, 5-session 표본과 FX translation의 순방향/역방향을 읽었다. weekly 선형 외삽/상관을 인과 예측으로 검증한 것은 아니다. 실제 계좌, 통화 조합, 공시 원문, 외부 공급자와의 수치 대조는 수행하지 않았다.
- backtest 변경의 base-currency drift, held 후 다음 rebalance까지 보류, 진행 중인 월 제외를 전체 diff와 주변 식으로 검토했다. SEC v7의 revenue 없는 income-anchor/negative revenue 차단, debt current 추가와 기존 adjusted EPS 표기 변경도 전체 diff로 검토했다. 전 종목·전 달의 수치 sweep은 하지 않았다.

## 실행과 안전 경계

`node --experimental-vm-modules _artifacts/architecture-quality-audit-20261021/financial-delta-probe.mjs` → exit0, 신규 freshness 반례2개·경계 후보2개·기존 반례3개 JSON 기록. VM ExperimentalWarning은 Node 런타임 안내다. 이는 assertion 통과 인증이 아니라 실제 반환값을 보존한 재현 실행이다.

SAFETY FACT: 검토 및 probe가 고정 REF 원문만 사용함 — PROVED(격리 loader의 Git show + 상대 dependency만 허용, source hashes 원장). 지수 currentness 계약 — DISPROVED(probe), 브라우저·배포 currentness — UNVERIFIED.

작성한 파일은 20261021의 이 보고서, 원장, probe와 결과뿐이다. 제품/데이터 수정, producer 실행, 네트워크, 유료 AI 호출, Git mutation, commit/push/deploy 없음. 다음 조치는 F-DELTA-01의 행별 유효성/coverage 복구다.
