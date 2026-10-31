# PASS13 — 채팅 맥락·자연어 스크리너·질문 분류

2026-10-28 v59.42, 직접 검토/에이전트 없음. 제품 수정 없이 기존 문제를 기록한다. PASS12에 이어 동일 baseline pipeline-review-pass12-20261028, 감사 소유 파일만 검증한다.

## P13-SCREEN-01 — 한국 종목 가격의 통화 손실

수정 권고, 중요도 높음, Pre-existing. src/ai/context/screener-query.js의 runScreenerQuery와 buildDiversifiedRecommendationRows는 quote.price를 복사하면서 currency와 개별 quote 관측시각을 버린다. formatScreenerResultPrompt는 모든 가격에 `$`를 붙인다.

재현: 005930.KS quote `{price:70000,currency:'KRW',observedAt:'2026-10-27T06:30:00Z'}`와 반도체 canonical row에 `반도체 후보`를 질의하면 prompt가 `가격 $70000.00`을 만든다. result row에 currency는 없다. 이는 환산이 아니라 단위 오표기다. rankAsOf를 전체 생산자 관측시각으로 표시하는 것은 live quote의 관측시각을 보증하지 않는다.

활성 연결: src/app/compatibility-globals.js:138–148은 canonical screener rows와 window._liveData를 이 함수에 넘긴다. js/aio-chat.js:4293–4300은 명시 종목 없는 질문에 결과 prompt를 SCREENER_RESULT로 주입한다. prompt는 ‘가격은 위 값 그대로 인용’하도록 지시하므로 특히 위험하다. 실제 모델 호출은 하지 않았으며 실제 답변 재현으로 표현하지 않는다.

개편안: quote의 instrument/currency/observedAt/status를 묶어서 유지하고 숫자별 통화를 표시한다. 통화를 모르면 USD로 추정하지 말고 가격 인용을 보류하거나 단위 미확인으로 표시한다. 시총의 USD billions 정규화 계약과 가격의 원통화 계약을 분리한다. 회귀: US USD, KR KRW, ADR, currency 없음, 다른 listing currency, 가격 시점과 factor 시점이 다른 경우.

## P13-SCREEN-02 — 시총 미확인을 소형주로 선택

수정 권고, 중요도 중간, Pre-existing. 소형주 필터는 `(s.mcap || 0) < 10`만 검사한다. null/undefined/0이 전부 조건을 만족한다. 추천용 capBucket은 같은 값을 unknown으로 분류하므로 같은 모듈 안에서도 결측 의미가 다르다.

재현: `소형주 후보`에 mcap null,0,2,100인 네 행을 제공하면 null/0/2가 모두 선택된다. producer가 Korean 시총 미제공을 보수적으로 null로 남겨도 이 소비자가 크기를 작은 것으로 바꿀 수 있다. 데이터셋의 실제 해당 행 수는 이번에 집계하지 않았다.

개편안: 숫자·유한·양수 여부와 단위를 먼저 검증하고 그 후 상한/하한을 적용한다. unknown을 별도 집계해서 ‘조건 확인 불가’로 설명한다. 회귀: null,undefined,'',0,음수,NaN,정상 경계10 및100, USD 정규화 여부.

## P13-SCREEN-03 — 엄격 비교 요청을 포함 비교로 변경

수정 권고, 중요도 중간, Pre-existing. RSI 파서가 ‘미만/below’와 ‘이하’를 rsiMax 하나로 합친 뒤 <=를 적용한다. ‘초과/over’와 ‘이상’도 >=로 합친다. 표시 조건 자체도 RSI≤/≥로 바뀐다.

재현: `rsi 30 미만`에 RSI29와30을 제공하면 둘 다 선택된다. 사용자가 정한 문턱을 조용히 바꾸는 의미 오류다. 개편안: bound와 inclusive 플래그를 보존하고 공용 screen-engine의 비교 의미와 정렬한다. 회귀: 미만/이하/초과/이상과 영어 표현, 경계값, 범위 양끝, 결측 값을 비교한다. 같은 파서를 그대로 복제한 테스트 대신 기대 집합을 명시한다.

## 직접 전체 판독 9파일

| 파일(src/ai/ 아래) | 판독 내용 |
|---|---|
| context/policy-lines.js | Fed/BOK·한국 CPI/수출·21일 발표 일정·held 처리 |
| context/portfolio-rows.js | 비식별 보유 행·평가 통화/시점·현금 포함 비중 |
| context/channel-signals.js | ticker별 목표가/실적·거시/서학개미 신호·2차 보도 귀속 |
| context/close-basis-evidence.js | 완료 종가 reference·KR/US 정렬·금리 bp·대체 행·TTL 캐시 |
| context/sec-fundamentals.js | 공시 이용가능 시점·SEC report·연간/TTM 구분 |
| context/screener-query.js | 자연어 조건·분산 후보 점수·필터·prompt·채팅 래퍼 |
| context/panel-contexts.js | masters/guide 기존 panel context 확장 |
| context/choosing-blocks.js | chart/stock/theme 질문 맥락·뉴스 창·동의/보유·근거 badge |
| intent/taxonomy.js | 복수 intent·route 가중·명시 작업·개인화·현재성/과거·깊이 |

choosing-blocks 출력 중간 누락은 119–138 및136 이후를 다시 읽어 보완했다. compatibility-globals와 aio-chat은 위 연결 주변만 읽었으며 전체 판독에 넣지 않는다.

정상 확인: SEC 맥락은 미래/잘못된 availability를 거부하고 annual을 TTM으로 설명하지 않는다. channel 신호는 2차 자료로 귀속한다. 주가 수준 대신 bp 변화가 필요한 금리는 close-basis에서 bp로 생성한다. theme 기준표는 확인 불가와 미충족을 나눈다. portfolio 일반 질문 경로는 consent를 확인한 뒤 redacted rows를 넣는다(대기 prompt 경로의 생성/철회 전체는 후속 검토 필요).

추가 후보: choosing-blocks의 사용자 가격 추출은 숫자 뒤 단위가 선택이고 현재가 대비40–160% 범위만 적용하므로 저가 종목의 ‘3개월’ 같은 숫자를 가격으로 읽을 여지가 있다. theme 구성종목 수익률은 서로 다른 factorSessionDate도 함께 정렬하고 최신 날짜 하나만 표시한다(기존 포트폴리오 날짜 정렬 이슈와 유사한 클래스). currentSensitive 분류의 IV/per 등 영어 부분 문자열 충돌, 화면 route 우선순위가 명시 질문을 덮는 경우는 추가 query corpus 검토가 필요하다. 이들은 확정3건에 넣지 않는다.

## 검증과 전체 잔여

`node reproduce-pass13.mjs` exit0. 합성 입력의 순수 함수 재현3건, 결과 pass13-reproductions.json. 외부 fetch/모델/브라우저 없음. 향후 회귀 구현 및 코드 개선은 이번 요청에 포함되지 않아 수행하지 않았다.

이번까지 src/ai 파일들의 본문은 파일 대장에 직접 판독 근거를 기록했다. 이것은 AI end-to-end나 전체 코드베이스 완료가 아니다. import된 domain/data/calendar/knowledge, legacy 채팅·UI의 전체 경로, 모든 producer/QA/workflow, 자료별 원문 의미 확인과 과거 판독 후 변경 파일 재검토가 남아 있다. 파일 목록 조사만으로 의미 검토 완료 처리하지 않는다. commit/push/deploy 없음.
