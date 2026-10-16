# 내부 AI·분석 추론의 질

2026-10-16 v57.88. 독립 읽기 검토를 주 담당자가 통합했다. A01~A03은 실제 pure module로 로컬 반례를 재현했다. 나머지는 정적 경로·모형 의미 검토이며 실제 AI 출력·라이브 발생으로 부르지 않는다. [재현 입력·결과](./counterexamples.json), [실행기](./reproduce.mjs).

## A01 · 설명 단어 하나가 실행 의도를 덮음 — 수정의 잔여, 높음

근거: [conduct](C:/Projects/AIO/src/ai/policy/conduct.js:63), [기존 사례](C:/Projects/AIO/scripts/ci-ai-intelligence-contract-check.mjs:232).

교육·피해 예방 질문을 허용하고 감시 회피를 막은 개선은 유지한다. 그러나 `!defensive`가 strong execution보다 먼저 적용된다. 로컬에서 ‘처벌 설명’은 허용, ‘실행 단계’는 차단됐지만 둘을 함께 요청하면 EDUCATIONAL_ALLOWED였다. 모델이 실제 방법을 제공했다는 증거는 아니다.

최소 대안: 요청 절별로 설명과 실행을 구별하고 혼재하면 실행 부분만 거부한다. 순수 예방·처벌 교육이 다시 막히는 오탐을 함께 확인한다. 특정 단어 하나씩 추가해 방어하는 반복보다 의도 범위를 평가해야 한다.

## A02 · ‘기준선’이 현재 숫자를 조건문으로 위장함 — 로컬 재현, 높음

근거: [publication](C:/Projects/AIO/src/ai/response/publication.js:72), [검사 범위](C:/Projects/AIO/scripts/ci-ai-intelligence-contract-check.mjs:672).

근거 없는 ‘VIX는 15.2로 낮다.’는 제거된다. ‘VIX는 15.2로 기준선 아래입니다.’는 조건문으로 분류되어 남는다. 순수 조건 ‘VIX가 20을 넘으면…’를 살리는 의도는 좋지만 조건 관련 명사가 현재 사실을 조건문으로 바꾸지는 않는다.

최소 대안: 실제 가정절 안의 숫자만 예외로 다룬다. 짧은 임계값 설명을 오탐할 비용이 있으므로 일반 규칙/현재 관측/혼합 문장의 대비 사례를 사용한다. 표지 단어를 붙인 현재 관측이 통과해서는 안 된다.

## A03 · 숫자가 없는 현재 사실·인과는 같은 출판 검사를 받지 않음 — 잔여, 높음

근거: [publication의 본문 처리](C:/Projects/AIO/src/ai/response/publication.js:194), [claim 처리](C:/Projects/AIO/src/ai/response/publication.js:161).

수치 tuple의 출처·시간·entity·metric·단위·값 대조와 검증된 값의 재렌더링은 강점이다. 하지만 근거·claim·citation을 모두 비운 answer plan에서도 ‘연준이 금리를 인하했고 신용 스트레스도 해소됐다.’라는 본문은 그대로 남는다. A02 문장도 같은 plan의 summary에 남았다. 이 로컬 함수 경계가 내용의 진실성을 보장하지 않는다는 재현이다. 전체 오케스트레이터가 모든 입력에서 이 결과를 그대로 게시한다는 증거는 아니다.

최소 대안: 현재 사건·방향·인과를 단순 교육 설명과 구별하고 연결된 근거가 없는 해석은 가설로 표현한다. 모든 일반 문장을 막거나 별도의 유료 judge를 의무화하지 않는다. 올바른 수치 옆의 무근거 사실이 함께 검증됐다고 읽히지 않아야 한다.

## A04 · AI 추세는 완료 봉·기간 정의가 별도로 남음 — 부분 해결, 높음

근거: [AI 가격 경로](C:/Projects/AIO/js/aio-chat.js:2385), [답변 원칙](C:/Projects/AIO/src/ai/response/answer-principles.js:10).

기술 지표 단일화는 실제 진전이다. 그러나 이 경로는 Yahoo3mo close에서 날짜를 버리고 결측을 걸러 마지막 값으로 5D/20D를 계산한다. 장중 미완료 봉을 빼는 조건과 거래일 간격 대조가 없다. ±2%/±5% 라벨을 프롬프트가 추세 판단의 기준으로 쓰도록 한다. 실제 장중 오염 발생은 미관측이다.

최소 대안: timestamp·완료 세션·기간을 보존한 공통 입력을 소비한다. 부족하면 보류가 늘 수 있다. 장중 봉 추가·중간 결측·휴장으로 완료 종가 5D/20D 의미가 임의 변경되지 않아야 한다.

## A05 · 시간 정렬을 인과 지지로 평가하는 잠재 엔진 — 중간

근거: [causal 엔진](C:/Projects/AIO/src/ai/analysis/causal.js:17), [fixture](C:/Projects/AIO/scripts/ci-ai-intelligence-contract-check.mjs:116), [production adapter](C:/Projects/AIO/src/ai/analysis/evidence-inputs.js:88).

시간·출처가 있는 event와 교차자산만으로 supported가 될 수 있다. 값·방향·전파 경로는 충분히 검사하지 않는다. 다만 현행 adapter는 검증된 인과 링크가 없다고 입력을 비운다. 지금 일반 채팅이 이 경로로 원인을 확정 노출한다는 발견이 아니다.

최소 대안: 시간상 후보와 기전/방향까지 일치하는 지지를 구별한다. 동일 시각의 무관·반대 방향 자료가 지지를 강화하지 않도록 한다. 단정 대신 원인 후보라고 표현하는 현재 문구는 유지한다.

## A06 · ‘유리한 대응’은 과거 상승 빈도와 목적이 다름 — 부분 해결, 중간

근거: [favored](C:/Projects/AIO/src/domain/market/macro-crossroads.js:217), [비교 판정](C:/Projects/AIO/src/domain/market/macro-crossroads.js:338), [analogs](C:/Projects/AIO/src/domain/scenarios/analogs.js:29).

기본율 비교·소표본 표시·과거 표본과 어긋남 표시는 개선이다. 그러나 20거래일 뒤 주가 상승 비율은 대기/분할/보유/방어의 비용 우열을 측정하지 않는다. 1표준오차 경계도 승인된 성과 기준은 아니다. favored를 유지하는 결정은 승인된 제품 선택이므로 삭제 대상으로 단정하지 않는다.

최소 대안: 각 이유를 명시된 기간·목적 아래의 비용 가설로 설명하고 측정된 상대 성과와 분리한다. 다른 목적에 따른 대안도 남긴다. 독자가 ‘가설적 유리함’과 ‘실증된 우위’를 구별하면 된다. 모든 답변에 긴 면책을 다시 붙일 필요는 없다.

## A07 · AI 신선도는 여전히 snapshot48/72시간 기준 — 잔여, 중간

근거: [answer principles](C:/Projects/AIO/src/ai/response/answer-principles.js:26), [호출](C:/Projects/AIO/js/aio-chat.js:6028).

오래된 수치를 현재처럼 말하지 않는 원칙은 유지한다. 그러나 snapshot 나이 하나는 다음 발표 전인 월간 통계나 긴 휴일의 유효 종가도 오래됐다고 금지할 수 있다. 새 snapshot 안의 낡은 항목은 반대로 놓친다.

최소 대안: 실제 답변에 필요한 필드의 관측시각·다음 예상 발표·held 상태를 전달한다. 모든 필드를 보내 문맥을 늘리지 않는다. 휴일 종가와 발표 기한이 지난 월간 값을 다르게 처리하는지가 수용 기준이다.

## A08 · 가격 반응 뒤에 원인을 채우도록 유도하는 프롬프트 — 잔여, 중간

근거: [종목 답변 원칙](C:/Projects/AIO/src/ai/response/answer-principles.js:13).

보도 뒤 급락을 재료 소진·후속 악재 신호로 다루도록 한다. 호재와 가격이 엇갈리는지 살피는 목적은 좋다. 하지만 시장 전체 하락·금리·기대 차이를 확인하기 전에 원인을 좁히면 사후 합리화가 된다.

최소 대안: 상대 움직임과 대안 원인을 먼저 비교하고 근거가 없으면 원인 미확정으로 남긴다. 단호함은 줄지만 설명의 정확성은 높아진다. 긍정 뉴스 뒤 시장 전체와 함께 하락한 사례에서 새 악재를 만들어내지 않는지 확인한다. 실제 모델의 편향 발생률은 별도 평가가 필요하다.

## 읽기 범위·한계

conduct/suitability/claim-ledger/publication/orchestrator/planner/policy-lines/answer-principles/company/technical/causal/evidence-inputs/benchmark, analogs 전체와 macro-crossroads 관련 범위, chat 관련 호출부, 대응 fixture를 읽었다. 재무·포트폴리오 통계의 전체 경로, 실제 AI 출력의 오류율·인용 지지율, 사용자 이해·라이브 동작은 이번 분담의 전수 확인이 아니다. 로컬 재현을 실제 provider 성공이나 유출 exploit으로 승격하지 않는다.
