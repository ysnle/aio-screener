# 지식·리서치·교육 내용과 완료 기준의 질

2026-10-16 v57.88. 독립 검토와 주 담당자의 통합 기록이다. **저장된 근거 연결/완료 메타데이터의 문제와 실제 사용자 노출을 구별한다.** 원문 전편의 외부 사실 검증이나 사람의 학습 효과 인증은 아니다.

## K01 · 단어 일치를 명제의 근거로 연결 — 기존 잔여, 높음

근거: [article 생성기](C:/Projects/AIO/scripts/build-knowledge-articles-and-learning-graph.mjs:44), [일반화·암기 article](C:/Projects/AIO/public-data/knowledge/articles/atlas-foundations/generalization-and-memory.json:48), [A1](C:/Projects/AIO/public-data/knowledge/articles/principles/A1.json:52).

학습의 일반화·암기에 TSMC 패키징·Micron HBM2E·PagedAttention fact가 붙고 희소성에는 OECD 생산성 fact가 붙는다. `memory`의 중의성이나 넓은 분야 관련성을 특정 명제의 지지로 바꾸는 오류다. 공식 출처·dated fact라는 속성은 해당 설명을 직접 지지한다는 뜻이 아니다.

최소 제안: 키워드는 검색 후보까지만 만든다. 어떤 명제를 어떤 원문 구간이 지지하는지 승인된 연결만 직접 근거로 쓴다. 연결 수는 줄어도 권위 전이는 줄어든다. 일반화/암기에 HBM을 직접 증거로 붙이는 음성 사례가 거부되어야 한다.

영향 추적: [UI lesson](C:/Projects/AIO/src/ui/knowledge/concepts-view.js:197)은 별도 lesson.story·sourceIds를, [Atlas](C:/Projects/AIO/src/ui/pages/atlas.js:702)는 별도 원고를 사용한다. A1 article의 [확인된 UI 용도](C:/Projects/AIO/src/ui/pages/principles.js:626)는 초안·검토일 표시다. **위 잘못된 fact가 현재 화면 본문에 노출된다는 경로는 찾지 못했다.**

## K02 · 자료 연결 완료를 연구 완료라고 명명 — 기존 잔여, 높음

근거: [dossier 생성기](C:/Projects/AIO/scripts/build-knowledge-research-dossiers.mjs:82), [A1 dossier](C:/Projects/AIO/public-data/knowledge/research-dossiers/principles-lesson_A1.json:17).

fact와 등록 출처가 연결되면 RESEARCHED·researchComplete:true가 된다. A1에는 동시에 independent direct source required와 semanticReview REQUIRED가 남아 있다. 생성기가 queries·searchedAt·PRIMARY_PAGE_OPENED_SEED를 채웠다는 사실은 각 unit에 실제 검색·대조가 수행됐다는 영수증과 다르다. 구조상 모든 metadata가 거짓이라고 단정하는 것이 아니라, 현재 완료 명칭이 실제 증거보다 강하다.

최소 제안: evidence attached·연구 수행·명제별 검토·사용자 이해를 구별한다. 기계 부착을 연구 완료 수치로 올리지 않는다. 다만 사소한 개념마다 거대한 조사 양식을 강제하지 않고 중요 주장에 필요한 원문 구간만 남긴다.

영향 추적: 확인 범위에서 src/js의 researchComplete 직접 소비자는 없었다. AI [retrieval context](C:/Projects/AIO/src/ai/retrieval/knowledge.js:243)는 요약 필드를 사용한다. A1/일반화·암기의 현재 index에는 sources:[]이며 문제의 fact와 researchComplete는 없다. **이 두 잘못된 fact의 AI 주입·사용자 연구 완료 인증 노출은 확인하지 못했다.** 지금은 생성물·진척 집계·향후 재사용의 품질 문제로 한정한다.

## K03 · 미검증 빈도·경험칙이 설명 본문으로 재진입 — 신규, 높음

근거: [출처 checks](C:/Projects/AIO/src/domain/research/packet-20261016-x-bookmarks.js:50), [베이스 본문](C:/Projects/AIO/src/domain/research/packet-20261016-x-bookmarks.js:195).

3·4번째 베이스 실패율은 UNVERIFIED로 기록하면서 본문에는 약66%/80%를 제시한다. ‘첫 베이스가 가장 유리’, ‘경우가 많다’, ‘가장 건강한 식힘’도 정의·표본·비교 기준이 없는 경험칙이다. reference라는 표시만으로 과잉 정밀도가 사라지지 않는다.

최소 제안: 저자가 그런 가설을 제시했다는 사실과 AIO가 재현한 빈도를 나눈다. 미재현 비율을 실증값처럼 쓰지 않는다. 관찰할 구조와 반증 조건은 유지한다. 빈도가 필요하면 정의·기간·비중복 사례·표본·기저율을 확보하거나 미검증으로 남긴다. 새 유료 자료나 백테스트 사업을 의무화하는 제안은 아니다.

## K04 · 여러 자산의 동행을 하나의 충격 원인으로 식별 — 신규, 높음

근거: [네 자산](C:/Projects/AIO/src/domain/research/packet-20261016-x-bookmarks.js:287), [유가 역산](C:/Projects/AIO/src/domain/research/packet-20261016-x-bookmarks.js:300).

주식↓·금↓·금리↑·달러↑를 물가 우려로 인한 실질금리 충격이라고 확정하거나, 유가 상승분에서 위기 기간을 읽고 발언보다 짧으면 과소반영이라고 결론낸다. 가격의 여러 조합은 다른 원인도 가질 수 있고 유가에는 공급·수요·재고·보험·위험 프리미엄이 함께 작용한다. 반증 문구가 있다는 사실만으로 식별 문제가 해결되지는 않는다.

최소 제안: 가능한 원인과 구분에 필요한 관측을 제시한다. 유가 역산은 모형·기초 가격·공급손실·수요·기간 가정을 공개한 시나리오로 한정한다. [연준의 곡선 모형 자료](https://www.federalreserve.gov/data/yield-curve-models.htm)처럼 명목·실질·기대/프리미엄을 구별할 필요가 있다. 같은 입력을 설명하는 대체 원인과 미식별 상태를 허용하는 것이 수용 기준이다.

## K05 · 사모신용의 계약과 부도 경로를 일반화 — 신규, 높음

근거: [사모신용 프레임](C:/Projects/AIO/src/domain/research/packet-20261016-x-bookmarks.js:257).

환매 미지급분이 자동으로 다음 분기 대기열에 붙는다는 설명은 펀드별 계약 확인이 필요하다. AI의 소프트웨어 대체 속도를 곧 부도 위험으로 잇는 것도 차주 현금흐름·만기·담보·상환능력의 조건을 생략한다. 독립 검토자가 읽은 [SEC의 한 interval fund 공시](https://www.sec.gov/Archives/edgar/data/2032432/000119312524284215/d871783dn2a.htm)는 비례배분 뒤 재신청·무우선권을 명시하는 반례다. **이를 BCRED 자체 조건이라고 확대하지 않는다. BCRED10-K 직접 열람은 실패했다.**

최소 제안: 펀드 유형·환매 계약·기준일을 특정하고 AI→차주 매출/마진→현금→채무상환의 조건을 이어 쓴다. PIK·평가 지연·NAV 할인 점검은 유지하되 할인 자체를 자산손실로 단정하지 않는다.

## K06 · 새 편집 원칙과 제품의 결론 우선 원칙 충돌 — 신규, 중간

근거: [새 프레임](C:/Projects/AIO/src/domain/research/packet-20261016-x-bookmarks.js:374), [AGENTS](C:/Projects/AIO/AGENTS.md:31).

새 원고는 브리핑을 사실→진단→반증→마지막 결론으로 쓰고 결론을 앞에 두면 편향된다고 가르친다. 현재 화면 원칙은 결론 우선이다. 어느 쪽도 모든 상황의 보편적 사실은 아니다.

최소 제안: 조사·판단 과정은 근거를 검토하고, 독자용 요약은 결론+조건+불확실성을 먼저 제시하는 구분을 검토한다. 사용자 승인 없이 고정 편집 결정을 새 자료로 뒤집지 않는다. 독자가 이해하는지 비교해야 하며 저자/운영자/모델 이름이 정답의 근거가 될 수 없다.

## K07 · 길이와 필드 존재를 품질 인증으로 부름 — 이전 S18 잔여, 중간

근거: [depth audit](C:/Projects/AIO/scripts/audit-knowledge-encyclopedia-depth.mjs:78), [story 최소량](C:/Projects/AIO/scripts/lib/principles-stories.mjs:13), [article 보존 계약](C:/Projects/AIO/scripts/ci-knowledge-article-contract.mjs:30).

1200자·필드 존재로 certification을 계산하는 것은 분량/구조 판정이다. 초안 보존과 미완료 고지는 유용하지만 잘못된 긴 설명은 통과하고 짧지만 충분한 설명은 실패할 수 있다. 정본과 같은 요약문이라는 검사도 진실성 검증은 아니다.

최소 제안: 보존·읽기 예산·구조·의미 검토의 이름을 나눈다. 정의·역사·모형·사례에 같은 글자 수/실험/반증 필드를 강제하지 않는다. 개념별 충분성을 독립 검토하되 해당 없음도 허용한다.

## K08 · 역사 경고와 강한 결론이 같은 문서에 공존 — 부분 해결, 중간

근거: [factor 이력](C:/Projects/AIO/_context/KNOWLEDGE-BASE.md:1184), [score 이력](C:/Projects/AIO/_context/KNOWLEDGE-BASE.md:1202).

look-ahead·생존·중첩 경고를 추가한 것은 좋은 수정이다. 그러나 뒤에는 여전히 ‘특정 구간 우연이 아님’, ‘통계적으로 유의미한 역방향’이 남는다. 원문 전체의 경고가 검색·발췌 단위와 떨어지면 당시 계산 결과를 현재 유효한 추론으로 재사용하기 쉽다.

최소 제안: 역사 숫자는 보존하고 강한 결론 문장 자체를 ‘당시 계산·해석 보류’로 한정한다. 인용한 한 문장만 보아도 방법 한계가 전달되게 한다. 과거 결과의 부호를 뒤집거나 현재 팩터를 자동 수정하지 않는다.

## 구조 전수와 의미 표본의 경계

구조 집계는 unit455(112핵심·48기초·60개념·28구조프레임·95분류노드·50심화분기·19도메인·21기업·22제품), article160, claim274, source199, concept212, alias1142다. claim의 directness는 DIRECT0·CONTEXT160·DISCOVERY14·REVIEW_REQUIRED57·STRUCTURAL43이다. **DIRECT0은 모든 원문이 틀리거나 참고 가치가 없다는 뜻이 아니다. 이 claim 집합에서 직접 지지가 인증되지 않았다는 metadata다.** 북마크 원장의1266개 claim과는 다른 집합이다.

의미 표본은 A1/B2/D2/G7/N9, KV cache/일반화·암기의 설명·근거·반증, 메모리/전력 dossier, masters 원칙 프로필2개 및 새 프레임의 고위험 항목이다. 새19개 프레임의 구조는 확인했지만 긴 출력에서 잘린 원고를 완독으로 세지 않았다. 455unit·160article·199외부 원문 전편과 모든 glossary/masters/atlas를 의미 전수 완료로 표시하지 않는다. 실제 UI·AI 노출에 대한 위 추적도 정적 범위이며 브라우저/배포 관측은 아니다.
