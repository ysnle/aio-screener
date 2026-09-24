# 종목 식별과 관측 시각의 의미 계약

최초 기준: 2026-09-21 · v56.01 / HEAD 2bf963a76c6f2fb1079166ce806beaaa820b1c6a. 현재성 재검토: v56.15 (2026-09-23), 제품 코드는 수정하지 않았다. 실제 공급자 요청과 과거 수익률 재계산은 수행하지 않았다.

## D04 — 종가 팩터가 장 시작 시각으로 발행됨

`scripts/fetch-data.mjs`의 `fetchHistory`(1451,1479)가 Yahoo timestamp를 observedAt에 넣고 `_enrichPriceFactors`(2636–2699)가 마지막 바의 시각을 팩터에 복사한다. breadth와 enrichScreener가 전역 factorObservedAt으로 발행한다. 같은 파일의 quote 처리 주석은 일봉 timestamp가 바 시작이라는 차이를 이미 인식한다.

현재 아티팩트에서 NVDA는 2026-09-18T13:30Z, 삼성전자는 2026-09-18T00:00Z로, 장 시작에 해당한다. 이 시각이 `src/ui/pages/screener.js:871`에서 팩터 관측시각으로 표시된다. 종가로 계산한 결과를 그날 개장 시점에 알 수 있었다는 의미가 된다. 실제 백테스트가 이 시각을 소비해 look-ahead를 일으켰다는 증거는 없다. 확인한 backtestFactors는 날짜 키를 사용한다.

설계: `barStart`, `barEnd`, `sessionDate`, `availableAt`, `fetchedAt`, `computedAt`을 분리한다. 거래소 calendar와 공급자의 timestamp 정의로 barEnd를 산출하며 데이터 가용시각은 마감시각과도 무조건 같다고 가정하지 않는다. 진행 중 일봉을 완료 종가와 구분한다. 혼합 시장의 전역 max 시각은 개별 종목의 최신성을 대표하지 못하므로 행별 시각과 시장별 범위를 보존한다.

사용자 표시는 “미국 9/18 정규장 종가 기반 · 수집 9/20”처럼 관측과 수집을 구분하고, 상세에서 거래소 시간대와 진행 중 여부를 보여준다. 날짜만 제공하는 공급자를 가짜 정밀 timestamp로 승격하지 않는다. 인수: 미국 DST, 한국 휴일, 조기 폐장, 진행 중 봉, 마감 후 지연 발행, 혼합 시장. PIT 소비자는 availableAt 이전의 결과를 사용할 수 없어야 한다.

### R24-03 / D04 현재 상태 — producer 보강은 끝단 시각 계약 완료가 아니다

P1167은 표시가 bar-start timestamp를 관측시각으로 말하는 문제를 바로잡았고, P1170은 `factorBarStart`, `factorSessionDate`, `factorSessionTimezone`, `factorTimeBasis`, `factorComputedAt`과 시장별 범위 일부를 producer에 추가했다. 이 조치는 유효하지만 end-to-end 완료는 아니다. v56.15 독립 추적에서 screener provider/normalizer는 이 필드들을 대부분 전달하지 않고, runtime reader는 bar-start `factorObservedAt`을 일반 `observedAt`으로 다시 노출한다. `factorQuality`는 시각이 있다는 사실만으로 `CURRENT`가 될 수 있다. P1170의 잔여 위험과 R24-03은 아직 열려 있다.

### W15-D04-C — producer부터 각 행·UI·PIT 소비까지 가용시각을 보존

팩터 provenance는 적어도 다음 축을 서로 다른 의미로 보존한다.

| 필드 | 의미 | 금지되는 대체 |
|---|---|---|
| `barStart` / 기존 `factorBarStart` | 공급자 timestamp가 나타내는 봉 시작 | 종가 관측시각으로 이름 변경 |
| `barEnd` | exchange calendar와 완결 상태에 따라 산출된 봉 종료; 모르면 `null` | 매일 정규장 종료 시각을 휴일·조기폐장에도 고정 적용 |
| `sessionDate`, `sessionTimezone` | 해당 instrument가 속한 거래소의 세션 날짜와 시간대 | UTC 날짜나 suffix 추정만으로 현지 세션 단정 |
| `availableAt` | 이 정보가 소비자에게 처음 합법적·기술적으로 사용 가능해진 시각 | 현재 다시 받아 온 `fetchedAt`을 과거 가용시각으로 대입 |
| `fetchedAt` | 이 실행이 공급자에서 자료를 가져온 시각 | 관측/공개 시각과 합치기 |
| `computedAt` / 기존 `factorComputedAt` | 팩터 계산이 끝난 시각 | 그 계산 입력이 당시 시장에서 알려져 있었다는 증거로 쓰기 |
| `timeBasis`, `completionState`, `availabilityBasis` | 시작시각/종료시각/날짜 전용, 완결/진행 중, 출처 확인/보수적 추정 여부 | 상태 필드 생략을 `CURRENT`로 해석 |
| `inputObservationIds`, `sourceRevision`, `definitionVersion` | 팩터에 실제 사용한 가격 관측과 계산 정의 | 동일한 날짜면 같은 입력이라고 추정 |

`availableAt`은 출처가 과거 발행시각을 제공할 때 그 증거를 보존한다. 그렇지 않으면 신뢰 가능한 bar end 뒤의 보수적 사용 가능 정책이 명시되어야 하며, 가용시점을 모르면 `null`과 `availabilityBasis: "unknown"`을 유지한다. 사후 수집 시각으로 과거 값을 PIT 적격으로 되돌리지 않는다. 진행 중 봉은 `completionState: "in-progress"`로 분리하고 종가 기반 팩터에 넣지 않는다. 여러 input이 사용된 derived factor의 가용시각은 필요한 입력 가운데 가장 늦게 사용할 수 있게 된 시점보다 빠를 수 없다.

동일한 per-row metadata가 아래 경계를 거쳐 변형·삭제되지 않아야 한다: producer → published artifact/manifest → provider → normalizer → runtime reader/store → domain factor row → view model → table/chart/AI/PIT selector. 시장별 전역 날짜 요약은 요약용일 뿐 각 행의 시각을 대체하지 않는다. `CURRENT`는 `availableAt`/시각 basis 존재만으로 정하지 않는다. instrument별 거래소 세션, 예상 공개 지연, completion state, source quality와 허용 용도를 함께 판정한다. 판단에 필요한 필드가 없으면 `TIME_BASIS_UNKNOWN` 또는 `REFERENCE_ONLY`로 닫는다.

### W15-D04-C 반증 fixture와 인수

| Fixture | 반증할 오류 | 기대 결과 |
|---|---|---|
| NVDA 2026-09-18 bar timestamp `13:30Z`, 해당 날짜 종가로 계산한 factor | 바 시작을 당시 가용 관측으로 표시 | sessionDate는 9/18, barStart는 그대로, 바 종료 전 PIT run에서 제외; 완료 close와 지연 availability를 별도 표시 |
| 삼성전자 `2026-09-18T00:00Z` 날짜 전용/세션 표시 입력 | UTC 자정에 실제 값이 가용했다고 가장함 | 거래일 날짜로만 보존; 출처가 정밀 시각을 보증하지 않으면 fake timestamp 없음 |
| 동일 관측이 producer→provider→normalizer→reader→UI를 통과 | 중간 mapper가 새 필드를 버림 | observation ID와 모든 시간축이 동일하며 basis를 잃는 경계는 gate 실패 |
| `factorObservedAt`만 존재, 품질/거래소/availability 없음 | timestamp 존재만으로 CURRENT | 해당 factor는 stale-reference/unknown-time; ranking/PIT 필수라면 보류 |
| 9/18 close의 사후 fetch가 9/20에 성공 | `fetchedAt`이 과거 `availableAt`으로 둔갑 | fetchedAt=9/20, availableAt은 확인된 원래 공개시각 또는 null; 9/19 기준 replay에 사후 정보 누출 없음 |
| 미완결 intraday bar가 새로 수신 | 최신 수신을 완료 일봉으로 해석 | live/intraday 표시로 격리; 종가 팩터·완료 시계열을 덮지 않음 |

Positive control은 출처가 완결 세션과 가용시각을 명시하는 정상 종가 factor가 해당 시각 이후 PIT 소비에 사용되고 정상 UI 상태를 얻는 경우다. 화면 인수는 거래일, 가격에 반영된 마지막 completed session, 수집 시각, stale/reference/unknown 표식이 각 행에서 구분되며, 날짜나 색만으로 상태를 알아야 하지 않는지 키보드·스크린리더에서도 확인한다.

소유권: market history producer는 원 timestamp/basis/completion을, market calendar adapter는 exchange 세션과 barEnd 계산을, factor domain은 input observation과 definition lineage를, screener provider/normalizer/runtime reader는 전달 불변성을, UI는 사용자용 시각 요약을 소유한다. 별도의 consumer가 전역 `factorObservedAt`을 authoritative time으로 재해석하지 않는다.

이행은 producer부터 한 시장·완결 일봉 수직 경로에 새 versioned contract를 발행하고 downstream reader를 함께 갱신한다. legacy `factorObservedAt`은 일정 기간 호환 참조 필드로만 읽고, source/basis가 없는 값은 과거 참고 상태로 강등한다. 기존 산출물을 일괄 소급 수정하지 않는다. 배포/갱신 실패 시 last-good artifact는 그 당시의 시각과 revision을 유지하며 `CURRENT`가 아닌 `REFERENCE_ONLY`로 노출한다. 잘못된 bar start를 가용시각으로 되돌리는 rollback은 금지한다. 거래소 조기 폐장·휴장·진행 중 봉·PIT fixture와 끝단 trace가 통과하기 전에는 D04 전체 완료로 표시하지 않는다.

상태: **R24-03 설계 추가, producer 일부 완료(P1170), 끝단 전달·가용시각·quality·PIT/UI 인수 미완료.** 새 단언이 필요하면 해당 의미 결함의 P 항목을 만들고 assertion trace에서 인용한다. 기존 P1167/P1170은 각각 과거 표시 수정과 일부 producer 보강을 뜻하며 끝단 완료의 근거로 확대하지 않는다.

## D05 — 식별 계약의 필수 필드와 producer 불일치

정적 유니버스 producer는 SCREENER_DB의 sym/name/sector/index/memo를 옮기지만 MIC·assetType을 제공하지 않는다. provider는 시장을 suffix/index로 추정하고 MIC/type은 없으면 null을 넘긴다. `validateInstrumentRef`(`src/data/contracts/screener.js:229`)는 둘을 필수로 요구한다. 실제 아티팩트를 읽은 provider 실행에서 SPY, TSM, 005930.KS, NVDA가 mic_missing/asset_type_missing이었다. duplicateSymbols=0이며 실제 alias 충돌이 발견됐다는 뜻은 아니다. 유니버스의 7/16 기준 STALE 경고는 UI에 이미 있다.

설계: canonical instrument와 provider symbol mapping을 분리한다. securityId, listing/MIC, assetType, shareClass/ADR 관계, currency, 유효기간, 근거 출처를 소유한 registry를 producer가 발행한다. suffix 추정은 추정 상태로 남긴다. ETF와 보통주를 같은 재무비율 모델에 넣지 않도록 eligibility를 type별로 결정한다. 필수 metadata 미확인을 가격 조회 성공으로 덮지 않는다.

기존 873행을 한꺼번에 임의 추정으로 채우지 않는다. 소수 대표 유형을 검증하고 registry와 adapter를 도입한 뒤 점진적으로 backfill한다. 수집 유니버스, 분석 적격 유니버스, 최종 비교 집단의 수와 제외 이유를 사용자에게 구분해 보여준다. 인수에는 ADR/원주, 다중 상장, 클래스 주식, ETF, 상장폐지/심볼 변경의 유효기간을 포함한다.

## D06 — 통화 없는 live quote 병합 및 비교 기준

조건부 합성 반증: artifact AAPL=USD에 다른 자격 필드는 완전하지만 currency 없는 live quote 101을 병합하면 price=101/CURRENT, instrument currency=null/MISSING이 된다(`src/data/providers/screener.js:102–149,255–286`). 실제 공급자가 해당 envelope를 보낸 사례는 확인하지 않았다. UI tooltip은 통화 미확인을 표시한다.

가격·통화·종목 identity·시각을 원자적 quote 계약으로 검사한다. 알려진 통화를 보존하려면 **동일 instrument/listing이라는 보증**이 먼저 필요하다. 그 보증 없이 artifact 통화를 무조건 상속하지 않는다. 미완전 quote는 진단 상태로 보관하고 마지막 적격 가격을 명시적 참고값으로 유지한다.

확인한 보호 장치: KRW market cap/거래대금은 USD용 계산에 그대로 넣지 않고 원통화 참고값으로 분리한다. 반면 섹터 정규화는 US/KR 현지통화 수익률을 같은 sector 집단에 넣는다. 이는 그 자체로 오류가 아니다. “각 시장 현지통화 가격 모멘텀 비교”인지 “USD 투자자 수익률 비교”인지 목표를 정하고 후자일 때만 일치 시점 FX를 적용한다. UI의 비교 기준 설명과 순위의 모델 정의가 같아야 한다.

## 범위와 다음 조사

### 수익률 비교 계약의 추가 인수

수익률에는 `priceReturn/totalReturn`, 통화 기준, 분할/배당 조정 여부, 시작/끝 valuation 시각, FX 방향과 source를 포함한다. provider의 adjustedClose라는 이름만 보고 조정 범위를 추정하지 않는다. 비교 집단에서 가격수익률과 총수익률을 무표시로 섞지 않는다.

현금흐름 없는 동일 자산의 단순 통화 환산 fixture에서, FX를 **현지통화 1단위당 기준통화 금액**으로 정의하면 `1 + R_base = (1 + R_local) × FX_end / FX_start`다. 역수 호가를 쓰면 먼저 방향을 정규화한다. 이는 일반 통화 환산 산술이며 실거래 비용·세금·배당 재투자 정책은 포함하지 않는다.

- 현지 수익률 +10%, 현지통화의 기준통화 가치 -10%면 기준통화 수익률은 -1%다. 단순 합산 0%가 아니어야 한다.
- 2:1 분할 직전 100, 직후 50이고 수량이 2배인 사례는 경제적 손실 -50%로 만들지 않는다. 분할 조정 계열과 실제 보유 수량 반영을 동시에 적용해 이중 조정하지 않는다.
- 배당 전 100, 배당 후 98, 현금배당 2인 단순 무세금 fixture는 가격수익률 -2%, 현금 포함 보유수익률 0%다. 재투자 총수익률 지수와의 차이는 별도 정책으로 검증한다.
- 서로 다른 시장 마감과 FX 시각에서는 허용 정렬 정책을 명시한다. 미래 시각 FX/가격을 과거 비교에 끼우지 않는다. 해당 날짜 FX가 없으면 임의 선형 보간으로 거래 가능값을 만들지 않는다.

이 사례는 제안 인수 fixture이며 현행 코드에 실행해 통과를 확인한 증거가 아니다. 실제 기업행동/조정가격 전수 추적은 20의 우선 조사 큐에 남긴다.

이번 경로는 universe→history→factor→breadth→artifact→provider→identity/readiness→renderer다. 분할/배당 조정의 전체 연결, revision, 상장폐지 포함 표본, ETF look-through, FX 실측, 세션별 운영 지연은 남아 있다. [09의 PIT](09-SEC-PIT-AND-NEWS-LINEAGE.md), [11의 통화](11-PORTFOLIO-DURABILITY-AND-CURRENCY.md), [13의 공통 의미 계약](13-SEMANTIC-ARCHITECTURE-AND-LEARNING.md)과 연결한다.

R24-03의 현재 상태는 [25 finding crosswalk](25-CURRENT-FINDING-STATUS-CROSSWALK.md), E1의 producer→consumer 인수·담당은 [26 실행·인수 계획](26-EXECUTION-AND-ACCEPTANCE-PLAN.md)을 따른다. 이 보강은 설계이며 끝단 구현, 브라우저, 과거 PIT 적격성 검증을 완료로 선언하지 않는다.
