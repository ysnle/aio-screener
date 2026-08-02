# AI ERA FOUNDATIONS CURRICULUM — AI 시대의 원리·과학·산업 지도

> 상태: **DESIGN_ONLY — 구현 미착수**  
> 작성일: 2026-08-01  
> 상위 문서: `MARKET-PRINCIPLES-PAGE-DESIGN-HANDOFF-2026-08-01.md`  
> 탐색/시각화: `MARKET-PRINCIPLES-KNOWLEDGE-GRAPH-UX-SPEC-2026-08-01.md`  
> 역할: 신규 `시장 원리/자본의 지도` 페이지 안의 **AI 시대** 대분류에 들어갈 상세 커리큘럼과 쉬운 설명 원고 기준  
> 주의: Transformer, World Model, Agent, ASIC은 같은 분류 단계의 경쟁 개념이 아니다. 아키텍처·학습목표·시스템·하드웨어를 구분한다.

---

## 0. 목표와 핵심 관점

이 영역은 “요즘 AI가 뜬다”를 설명하는 뉴스 모음이 아니다. 사용자가 다음 전체 사슬을 이해하도록 만든다.

```text
인간의 문제와 데이터
    ↓
수학적 표현과 학습 알고리즘
    ↓
Transformer·World Model 등 모델 구조/목표
    ↓
학습·추론 소프트웨어
    ↓
GPU·ASIC·메모리·네트워크
    ↓
반도체 설계·제조·패키징
    ↓
서버·AIDC·냉각·전력망
    ↓
비용·생산성·노동·산업·자본시장
```

사용자가 마지막에 답할 수 있어야 할 질문:

- AI는 정확히 무엇이며 기존 프로그램과 무엇이 다른가?
- AI가 “배운다”, “생각한다”, “추론한다”는 말은 실제로 무슨 뜻인가?
- Transformer와 World Model은 무엇이 다르고 어떻게 함께 쓰일 수 있는가?
- LLM은 왜 그럴듯한 오답을 만들 수 있는가?
- 학습과 추론은 무엇이 다르며 필요한 칩과 데이터센터도 왜 다른가?
- 행렬곱, 메모리 대역폭, 통신, 전력, 열이 왜 AI 성능을 좌우하는가?
- GPU가 AI에 적합했던 이유는 무엇인가?
- ASIC은 왜 등장했고 언제 GPU보다 유리하거나 불리한가?
- AI 칩은 어떤 물리·화학 공정으로 만들어지는가?
- 왜 AI 데이터센터(AIDC)가 필요하며 일반 데이터센터와 무엇이 다른가?
- AI 수요가 HBM·패키징·광통신·냉각·변압기·발전으로 어떻게 번지는가?
- AI를 개인과 기업이 실제로 어떻게 안전하고 효과적으로 사용할 수 있는가?
- AI 투자 열풍에서 기술적 가능성과 경제적 수익성을 어떻게 구분하는가?

---

## 1. 분류 체계 — 섞으면 안 되는 6개 층

### 1-1. 문제/능력

- 분류
- 예측
- 생성
- 검색
- 계획
- 제어
- 의사결정
- 지각

### 1-2. 학습 방식

- 지도학습
- 비지도/자기지도학습
- 강화학습
- 모방학습
- 인간/AI 피드백 기반 후속학습

### 1-3. 모델 아키텍처

- 선형모델
- 신경망
- CNN
- RNN/LSTM
- Transformer
- Diffusion
- Graph Neural Network
- Mixture of Experts

### 1-4. 학습 목표/내부 표현

- 다음 토큰 예측
- 마스킹 복원
- 대조학습
- 이미지/노이즈 복원
- 보상 최대화
- 환경의 상태와 동역학 예측
- World Model / predictive representation

### 1-5. 완성된 시스템

- LLM
- 멀티모달 모델
- 검색증강생성(RAG)
- AI Agent
- 추천시스템
- 자율주행/로봇 제어 시스템
- 과학·신약·설계 시스템

### 1-6. 실행 하드웨어

- CPU
- GPU
- FPGA
- ASIC/TPU/NPU
- 메모리/HBM
- 네트워크/광통신
- 서버·데이터센터·전력

### 가장 중요한 구분

> **Transformer는 정보를 처리하는 모델 아키텍처이고, World Model은 환경이 어떻게 변하는지를 내부적으로 학습·예측하려는 모델 역할/목표다.** World Model 내부에 Transformer가 사용될 수도 있으므로 둘은 반드시 양자택일 관계가 아니다.

> **Agent는 단일 모델명이 아니다.** 모델에 목표, 반복 루프, 도구, 기억, 상태, 권한, 검증을 결합한 시스템이다.

> **ASIC은 AI 모델이 아니다.** 특정 계산을 더 빠르고 효율적으로 실행하도록 만든 전용 반도체다.

---

## 2. AI를 이해하기 위한 원초 학문

AI 설명을 수식 강의로 만들 필요는 없지만, 아래 원리를 건너뛰면 칩·데이터센터·전력 연결을 이해하기 어렵다.

### P. 물리학

#### P1. 에너지와 전력
- 에너지는 일을 할 수 있는 능력, 전력은 에너지를 쓰는 속도
- kWh와 kW의 차이
- AI 칩의 전력소모가 계산량·데이터 이동·누설전류와 연결되는 방식
- 같은 계산을 더 적은 에너지로 하는 것이 성능/와트의 의미
- peak power와 평균 power

쉬운 설명:

> 물탱크에 담긴 물의 양이 에너지라면, 수도관에서 초당 쏟아지는 물의 양은 전력이다. 데이터센터는 물탱크 크기뿐 아니라 아주 굵은 수도관이 필요하다.

#### P2. 전기와 전자
- 전압·전류·저항
- 직류/교류
- 전력손실과 열
- 전원 변환
- 칩 내부의 작은 전압과 전력망의 고전압이 여러 변환 단계를 거치는 이유

#### P3. 전자기학
- 전자 신호
- 배선의 저항·정전용량
- 신호 지연과 간섭
- 칩이 빨라질수록 배선과 패키징이 중요해지는 이유
- 구리선과 광통신의 역할 차이

#### P4. 열역학
- 사용한 전기에너지가 열로 바뀌는 과정
- 열저항과 열전달
- 전도·대류·복사
- 공랭에서 수랭으로 전환되는 이유
- 열이 수명·성능·오류율을 제한하는 방식

쉬운 설명:

> AI 칩은 전기를 계산으로 바꾸지만 계산이 끝난 뒤 대부분의 에너지는 열로 남는다. 열을 내보내지 못하면 더 빠른 칩도 제 속도로 달릴 수 없다.

#### P5. 유체역학
- 공기와 냉각수의 흐름
- 압력·유량·펌프
- hot spot
- rack 내부 airflow
- 물 사용과 폐열 회수

#### P6. 광학
- photolithography
- EUV 빛으로 미세 패턴을 전사하는 개념
- 광섬유와 광트랜시버
- 전기 신호가 먼 거리/높은 대역폭에서 광신호로 바뀌는 이유

#### P7. 양자·고체물리의 최소 개념
- 원자의 전자 상태
- 에너지 밴드
- 도체·부도체·반도체
- band gap
- 도핑으로 전기적 성질을 조절하는 이유
- 양자터널링이 미세화의 한계 중 하나가 되는 이유

### M. 수학

#### M1. 벡터와 행렬
- 숫자 목록으로 단어·이미지·상태를 표현
- 행렬은 많은 입력을 한 번에 변환하는 규칙
- 신경망에서 행렬곱이 반복되는 이유
- GPU/ASIC이 행렬곱에 최적화되는 이유

쉬운 설명:

> 벡터는 어떤 대상을 여러 숫자로 표현한 좌표표이고, 행렬은 그 좌표표를 다른 관점으로 바꾸는 대형 변환표다.

#### M2. 확률과 통계
- 확률분포
- 조건부확률
- 기대값
- 불확실성
- 모델 출력이 사실 판정이 아니라 가능한 답의 분포일 수 있다는 점

#### M3. 미분과 경사
- 출력 오차가 각 weight에 얼마나 영향을 받았는지
- gradient
- 작은 방향 수정의 반복
- 최적화가 정답 공식이 아니라 더 나은 지점을 찾는 탐색이라는 점

#### M4. 최적화
- loss function
- local/global optimum
- learning rate
- batch
- regularization
- 학습 안정성과 비용의 관계

#### M5. 정보이론
- bit
- entropy
- 압축
- 예측이 잘 될수록 정보를 더 짧게 표현할 수 있다는 직관
- cross-entropy loss가 다음 토큰 학습에 쓰이는 이유
- 데이터·모델·통신을 하나로 연결하는 개념

### C. 컴퓨터과학

#### C1. bit에서 프로그램까지
- 0/1
- logic gate
- transistor
- register
- instruction
- program

#### C2. 저장과 계산의 분리
- register/cache/SRAM/DRAM/HBM/storage
- 가까운 메모리는 빠르고 작고 비쌈
- 먼 저장장치는 느리고 크고 저렴
- memory hierarchy

#### C3. 병렬처리
- 직렬 계산과 병렬 계산
- SIMD/SIMT 직관
- 같은 연산을 많은 데이터에 동시에 적용
- GPU가 그래픽에서 AI로 확장된 이유

#### C4. 분산시스템
- 한 칩에 담기지 않는 모델
- 여러 accelerator를 연결
- partitioning
- synchronization
- 통신 병목
- 장애 허용

#### C5. 네트워크
- latency와 bandwidth
- packet
- switch
- topology
- scale-up과 scale-out
- GPU가 놀지 않도록 데이터를 제시간에 보내는 문제

#### C6. 소프트웨어 추상화
- framework
- compiler
- kernel
- driver
- runtime
- hardware가 좋아도 software ecosystem이 없으면 쓰기 어려운 이유

### H. 화학·재료과학

#### H1. 실리콘 결정과 도핑
- 고순도 실리콘
- 단결정 ingot과 wafer
- 불순물을 정확히 넣어 n형/p형 영역 생성
- 원자 수준 오염이 수율에 영향을 주는 이유

#### H2. 박막과 증착
- 원자/분자 층을 얇고 균일하게 쌓는 과정
- CVD/PVD/ALD의 개념 수준 차이
- 미세 구조에서 균일성이 중요한 이유

#### H3. 포토레지스트와 노광
- 빛에 반응하는 화학물질
- mask 패턴을 wafer에 전사
- 현상과 patterning
- 파장·광학·화학이 함께 필요한 이유

#### H4. 식각과 세정
- 필요한 부분을 선택적으로 제거
- dry/wet etch
- 선택비와 손상
- 잔류물·입자 제어

#### H5. 절연체·도체·배선
- silicon dioxide/high-k
- copper/cobalt 등 배선 재료
- 접촉저항
- 층간 절연

#### H6. 패키징 재료
- substrate
- solder bump
- underfill
- thermal interface material
- 열팽창 계수 차이가 신뢰성에 미치는 영향

### E. 경제학

#### E1. 고정비와 한계비용
- 모델 학습/칩 설계/fab/data center는 큰 선행비용
- 추가 추론 1회의 한계비용
- 소프트웨어와 물리 인프라가 결합된 비용 구조

#### E2. 규모의 경제
- 큰 데이터센터·fab·model training이 규모에서 유리한 이유
- 규모가 커질수록 조직·통신·전력 병목도 커지는 이유

#### E3. 학습곡선
- 누적 생산/운영 경험이 비용과 수율을 개선
- 초기 생산과 mature process의 차이
- 하드웨어·소프트웨어 공동최적화

#### E4. 희소성과 병목 지대
- 공급을 빨리 늘릴 수 없는 장비·메모리·패키징·전력
- 병목을 가진 기업이 초과이익을 얻을 수 있는 구조
- 공급 정상화 후 초과이익이 사라질 수 있는 위험

#### E5. 네트워크 효과와 생태계
- 개발자·도구·라이브러리·모델이 플랫폼을 강화
- switching cost
- 개방형 표준과 독점 생태계

#### E6. CAPEX와 감가상각
- AI 서버/데이터센터의 선행 투자
- 자산 수명과 기술 진부화
- utilization이 수익성을 좌우
- 빠른 기술교체가 회계이익과 현금흐름에 주는 차이

#### E7. Jevons/rebound effect
- 계산 단가가 낮아지면 총사용량이 오히려 증가할 수 있음
- 효율 향상=총전력 감소로 단순 연결하면 안 되는 이유

#### E8. 외부효과와 규제
- 전력망·물·토지·탄소·소음
- 개인정보·저작권·안전
- 사회적 비용과 기업 비용의 차이

---

## 3. AI는 무엇인가

### A1. 규칙 기반 프로그램과 학습 시스템

규칙 기반:

```text
사람이 규칙을 작성 → 입력 → 규칙 실행 → 출력
```

학습 기반:

```text
사람이 목표·데이터·모델 구조를 정함
    ↓
모델이 많은 예시에서 내부 weight를 조정
    ↓
새 입력에 대한 출력 생성
```

쉬운 설명:

> 기존 프로그램은 요리사가 모든 조리 순서를 적어 놓은 레시피에 가깝고, 머신러닝은 수많은 완성 요리와 평가를 보면서 좋은 조리 패턴을 스스로 맞춰가는 과정에 가깝다. 다만 목표와 재료, 평가 방식은 여전히 사람이 정한다.

### A2. 모델·파라미터·학습

- model: 입력을 출력으로 바꾸는 수학적 함수
- parameter/weight: 그 함수의 행동을 결정하는 조절값
- training: loss가 줄도록 weight를 수정
- inference: 학습된 weight를 고정하고 새 입력 처리
- checkpoint: 특정 학습 시점의 weight 묶음

### A3. 데이터

- training/validation/test
- label
- 데이터 품질·중복·편향
- 데이터 누출
- 합성 데이터
- 데이터 provenance와 권리
- 더 많은 데이터가 항상 더 좋은 것은 아닌 이유

### A4. 학습의 종류

- 지도학습: 정답 예시
- 자기지도학습: 데이터 자체에서 예측 문제 생성
- 강화학습: 행동과 보상
- 모방학습: 전문가 행동 따라하기
- transfer learning/fine-tuning

### A5. 신경망

- 입력층·은닉층·출력층
- neuron은 생물학적 뇌의 정확한 복제물이 아님
- linear transformation+nonlinearity 반복
- 깊이가 복잡한 표현을 만드는 방식

### A6. forward/backpropagation

```text
입력 → 예측(forward) → 정답과 비교(loss)
     → 어느 weight가 오차에 기여했는지 계산(backprop)
     → weight를 조금 수정(optimizer)
     → 반복
```

### A7. 일반화와 암기

- training 성능과 test 성능
- overfitting
- distribution shift
- 비슷한 패턴을 재조합하는 능력
- 모델이 데이터베이스처럼 문장을 그대로 저장한다고만 보면 틀리는 이유

### A8. AI가 “생각한다”는 말

권장 설명:

> 현재의 생성형 AI는 입력을 숫자 표현으로 바꾸고, 학습된 수많은 weight를 통과시키며 다음에 올 정보의 분포를 계산한다. 이 과정에서 비교·분해·계획 같은 유용한 계산 패턴이 나타날 수 있지만, 인간과 같은 의식이나 의도를 가졌다고 자동으로 결론 내릴 수는 없다.

구분:

- 계산: 내부 수학 연산
- 추론 성능: 문제 해결 결과
- 설명문: 모델이 생성한 언어
- 의식/이해: 별도의 철학·인지과학 문제
- chain-of-thought 텍스트가 실제 내부 계산의 완전한 기록이라고 가정 금지

### A9. 환각

- next-token objective는 사실검증기가 아님
- 부족한/모순된 context
- training knowledge의 불완전성
- 질문의 잘못된 전제
- retrieval/tool failure
- 불확실성을 자연스러운 문장으로 숨길 수 있음

해결 계층:

```text
좋은 질문 → 신뢰할 출처 검색 → 도구 계산 → claim 검증 → 사람 승인
```

---

## 4. Transformer 기반 모델

### T1. 왜 Transformer가 등장했나

- RNN의 순차 처리와 긴 거리 의존 문제
- attention으로 입력 요소 간 관련성을 직접 계산
- 학습 시 병렬화에 유리
- 2017년 `Attention Is All You Need`에서 제안된 구조를 역사적 출발점으로 설명

### T2. tokenization

- 문장을 모델이 처리할 작은 단위로 나눔
- 단어/부분단어/문자/코드 조각
- token 수와 context/cost 관계
- 한국어와 영어의 token 효율이 다를 수 있음

### T3. embedding

- token을 고차원 숫자 좌표로 변환
- 의미가 완전히 한 좌표에 저장되는 것이 아니라 분산 표현
- 유사성·관계가 공간 구조에 나타날 수 있음

### T4. position

- attention만으로는 순서를 자동으로 알기 어려움
- positional encoding/embedding
- 문장 순서와 시간 순서

### T5. self-attention

쉬운 비유:

> 문장의 각 단어가 다른 모든 단어를 훑으며 “내 의미를 정하려면 누구의 말을 얼마나 참고해야 하지?”를 계산하는 회의다.

Q/K/V 비유:

- Query: 내가 지금 찾는 정보
- Key: 내가 어떤 정보를 갖고 있는지 나타내는 꼬리표
- Value: 실제 전달할 내용
- attention score: Query와 Key가 얼마나 맞는지

주의:

- 비유는 실제 수학을 단순화한 것
- attention weight를 곧바로 인간식 설명/원인으로 해석하지 않음

### T6. multi-head attention

- 여러 관점에서 관계를 동시에 계산
- 문법·지시대상·주제·형식 등 서로 다른 관계를 포착할 가능성
- 각 head의 의미가 항상 사람이 읽을 수 있게 고정되는 것은 아님

### T7. feed-forward network

- attention 후 각 위치의 표현을 비선형 변환
- Transformer를 attention만으로 설명하면 불완전
- residual connection과 normalization

### T8. layer와 parameter

- 같은 종류의 블록을 여러 층 쌓음
- parameter 수는 저장된 weight 수
- parameter가 많다고 항상 더 좋지 않음
- 데이터·학습량·구조·후속학습·평가가 함께 중요

### T9. decoder-only autoregressive generation

```text
입력 token들
  → 다음 token 확률
  → 하나 선택
  → 선택된 token을 입력에 추가
  → 다시 다음 token 확률
  → 반복
```

- temperature/top-p
- deterministic하지 않을 수 있음
- 한 token씩 생성되어 latency가 누적

### T10. context window

- 한 번에 참고할 수 있는 token 범위
- context가 길다고 모든 내용을 동일하게 기억/사용하는 것은 아님
- retrieval·요약·memory가 필요한 이유
- 긴 context의 attention/메모리 비용

### T11. KV cache

- 이전 token의 key/value 계산을 재사용
- 생성 속도를 높이지만 메모리를 사용
- 긴 대화·동시사용자·batch에서 memory pressure
- 추론에서 HBM 용량/대역폭이 중요한 이유

### T12. Transformer의 강점과 한계

강점:
- 범용 sequence 처리
- 병렬 학습
- scale과 transfer
- multimodal 확장

한계:
- 긴 context 비용
- 사실성 보장 없음
- physical causality/continuous control에 별도 구조와 데이터 필요
- 데이터·연산·에너지 비용

---

## 5. LLM이 만들어지는 과정

### L1. 데이터 수집과 정제
- 웹·책·코드·문서 등 데이터 유형
- 중복 제거
- 품질 필터
- 개인정보/저작권/라이선스
- train/test contamination

### L2. 사전학습
- 자기지도 next-token prediction
- 대규모 batch
- distributed training
- checkpoint
- scaling law는 경험적 관계이지 영원한 자연법칙이 아님

### L3. compute-optimal 학습
- parameter만 키우는 것과 token을 더 학습하는 것의 균형
- 고정 compute budget에서 모델 크기와 데이터량을 함께 최적화
- Chinchilla류 결과를 역사적 근거로 사용하되 특정 비율을 불변법칙처럼 고정하지 않음

### L4. 후속학습
- supervised fine-tuning
- preference data
- reward model
- RLHF/RLAIF
- DPO류 직접 선호 최적화
- 더 큰 base model이 곧 더 유용한 assistant는 아닌 이유

### L5. 평가
- benchmark
- human evaluation
- contamination
- 평균 점수와 실제 사용자 업무의 차이
- 정확성·안전·latency·cost를 함께 측정

### L6. 배포
- model serving
- batching
- autoscaling
- load balancing
- cache
- monitoring
- rollback

---

## 6. RAG·도구·Agent

### R1. parameter memory와 external memory

- 모델 weight 안의 학습된 패턴/지식
- 문서 검색 인덱스
- 데이터베이스
- API
- 계산기

### R2. RAG

```text
질문 → 검색 query → 관련 문서 검색 → context에 삽입
     → 모델 답변 → 출처/claim 검증
```

- 최신성·출처·업데이트 용이성 장점
- 잘못된 검색 결과, prompt injection, 인용 불일치 위험
- RAG가 환각을 자동 제거하지 않음

### R3. tool use

- 검색
- 코드 실행
- 계산기
- 데이터베이스
- 브라우저
- 업무 API
- 모델이 말로 추정하기보다 도구로 확인하도록 만드는 구조

### R4. Agent

```text
목표 설정
  → 상태 파악
  → 계획
  → 도구 선택/실행
  → 결과 관찰
  → 검증/수정
  → 종료
```

- autonomy와 permission 분리
- memory와 state
- idempotency
- 비용/무한루프
- 사람 승인 지점
- 단일 prompt와 agent workflow의 차이

### R5. 실제 사용법

좋은 사용 순서:

1. 문제와 성공 기준 정의
2. 필요한 맥락·자료 제공
3. 제약과 금지사항 명시
4. 원하는 출력 형식 지정
5. 검색/계산/코드 등 검증 도구 사용
6. 중요한 claim과 숫자를 원문 대조
7. 초안→비판→수정의 반복

AI에 적합:
- 초안·요약·분류·아이디어 확장
- 반복 작업
- 문서/코드 탐색
- 데이터 변환
- 비교 프레임 생성

AI 단독 사용에 부적합:
- 최신 사실을 검색 없이 확정
- 고위험 의료/법률/금융 결정
- 권한 있는 외부 행동을 검토 없이 실행
- 감정/윤리/조직 책임을 모델에 전가

---

## 7. World Model

### W1. 정의

World Model은 관찰을 그대로 외우는 것이 아니라, 환경의 상태가 행동과 시간에 따라 어떻게 변하는지를 내부적으로 예측하려는 모델이다.

쉬운 비유:

> 체스판을 직접 움직이기 전에 머릿속으로 몇 수 뒤를 그려보는 내부 시뮬레이터와 비슷하다.

### W2. 기본 요소

- observation: 센서/이미지/텍스트 등 관찰
- latent state: 중요한 정보를 압축한 내부 상태
- action: 에이전트의 행동
- dynamics: 상태가 어떻게 변하는지
- reward/cost: 목표와 비용
- policy/planner: 어떤 행동을 고를지

### W3. 왜 필요한가

- 실제 세계에서 모든 행동을 시험하는 것은 비싸고 위험
- 내부에서 미래 시나리오를 상상하며 학습/계획 가능
- 로봇·자율주행·게임·과학 시뮬레이션
- sparse reward와 장기계획

### W4. 학습 방식

- 다음 frame/state 예측
- latent dynamics
- masked/predictive representation
- video generation
- model-based reinforcement learning
- imagination rollout

### W5. Transformer와의 관계

- Transformer가 관찰 sequence와 action sequence를 처리할 수 있음
- video/world model에 diffusion, Transformer, CNN 등이 함께 사용 가능
- World Model은 `무엇을 배우려는가`, Transformer는 `어떻게 계산하는가`에 가까운 구분

### W6. Language Model과 World Model

- LLM도 언어 속 세계 패턴을 어느 정도 학습할 수 있음
- 그러나 텍스트의 다음 token 예측만으로 물리적 세계의 정확한 동역학·인과·지속 상태가 자동 보장되지는 않음
- sensorimotor data, action feedback, persistent state가 필요한 이유

### W7. 대표 연구 흐름

- 2018 `World Models`: 압축된 공간·시간 표현과 내부 시뮬레이션
- Dreamer 계열: 환경 모델 안에서 미래를 상상하며 policy 개선
- predictive representation/JEPA 계열
- video generation과 embodied agent의 결합

특정 접근이 “최종 승자”라고 단정하지 않는다.

### W8. 한계

- 모델 오류 누적
- 현실과 simulation gap
- rare event
- uncertainty calibration
- 안전한 exploration
- 보상함수 오설계
- 실제 세계의 복잡성/부분관측

### W9. 투자/산업 연결

- 더 많은 sensor data
- robotics/vehicle compute
- simulation infrastructure
- edge inference
- 데이터센터 학습
- 실제 actuator/센서/전력반도체 수요
- 단, 기술 데모와 경제적 배치 규모를 구분

---

## 8. 이미지·음성·영상·멀티모달

### MM1. 이미지 모델
- pixel을 숫자로 표현
- CNN/vision Transformer
- feature hierarchy
- classification/detection/segmentation

### MM2. 생성 이미지와 diffusion
- 노이즈에서 점진적으로 구조 복원
- text conditioning
- latent diffusion
- inference step과 계산비용

### MM3. 음성
- waveform/spectrogram
- speech-to-text
- text-to-speech
- streaming latency

### MM4. 영상
- 공간+시간
- frame consistency
- 막대한 데이터/compute/storage
- world model과의 접점

### MM5. 멀티모달 모델
- 텍스트·이미지·음성·영상 token/embedding
- modality encoder/decoder
- grounding
- 서로 다른 데이터의 시간/공간 정렬

---

## 9. AI 계산은 왜 특별한 칩을 요구하는가

### CH1. AI workload의 특징

- 대규모 행렬곱
- 같은 연산의 반복
- 낮은 정밀도 활용 가능
- 많은 parameter와 activation 이동
- 높은 병렬성
- training의 forward+backward+optimizer
- inference의 token-by-token latency

### CH2. CPU

- 범용·복잡한 제어
- 적은 수의 강한 core
- 운영체제·전처리·control plane
- AI 전체 시스템에서 여전히 필수

### CH3. GPU

- 그래픽의 많은 pixel/vertex 병렬 처리에서 출발
- 많은 작은 연산을 동시에 수행
- programmable
- CUDA/프레임워크/라이브러리 생태계
- 새로운 모델이 나와도 software로 대응하기 쉬움

쉬운 비유:

> CPU는 어려운 일을 순서대로 해결하는 소수의 숙련자 팀, GPU는 비슷한 계산을 동시에 처리하는 수천 명의 작업자에 가깝다.

### CH4. FPGA

- 제조 후 회로를 재구성
- ASIC보다 유연, GPU보다 특정 pipeline에 최적화 가능
- 개발 난이도와 규모의 경제

### CH5. ASIC

- Application-Specific Integrated Circuit
- 특정 workload에 맞춰 dataflow, memory, precision, interconnect를 설계
- 불필요한 범용 회로를 줄여 performance/watt와 latency 개선 가능
- 높은 설계비·긴 개발기간·workload 변화 위험

쉬운 비유:

> GPU가 다양한 요리를 빠르게 할 수 있는 대형 주방이라면, ASIC은 한 메뉴를 엄청난 양으로 가장 싸고 빠르게 만드는 전용 공장이다.

### CH6. ASIC이 생겨난 이유

1. AI 사용량 증가로 전력/비용이 핵심 제약이 됨
2. 반복되는 핵심 연산이 비교적 명확해짐
3. hyperscaler는 큰 물량을 확보해 높은 초기 설계비를 회수 가능
4. 자체 workload와 compiler를 함께 최적화 가능
5. 외부 GPU 공급·가격·로드맵 의존을 줄이려는 전략

역사 사례로 Google TPU의 datacenter inference ASIC을 사용하되, 특정 세대 성능 수치를 영구 문장으로 고정하지 않는다.

### CH7. GPU vs ASIC 경제성

| 항목 | GPU | ASIC |
|---|---|---|
| 유연성 | 높음 | 낮음~중간 |
| 개발비 | 구매 중심 | 높은 NRE |
| 출시속도 | 빠름 | 느림 |
| 성능/와트 | 범용 trade-off | 특정 workload에서 유리 가능 |
| 생태계 | 성숙 가능 | 자체 compiler/runtime 필요 |
| 물량 | 소량~대량 | 대량일수록 유리 |
| 모델 변화 | 대응 쉬움 | 설계 노후화 위험 |

### CH8. NPU/TPU/AI accelerator

- 대부분 AI ASIC 또는 특화 accelerator 범주
- 회사별 명칭을 동일 성능 범주로 단순 비교하지 않음
- training/inference/edge/datacenter 목표 구분

### CH9. tensor core와 낮은 정밀도

- FP32/BF16/FP16/FP8/INT8/INT4 개념
- 낮은 bit는 메모리·전력·처리량 개선
- 정확도·안정성 trade-off
- training과 inference의 요구 차이

### CH10. memory wall

- 연산기는 빠르지만 parameter/data를 가져오는 시간이 병목
- compute-bound vs memory-bound
- arithmetic intensity
- HBM 대역폭·용량
- KV cache
- 데이터 이동이 연산보다 많은 에너지를 쓸 수 있는 이유

쉬운 비유:

> 요리사가 아무리 빨라도 재료 창고에서 재료가 늦게 오면 주방 전체가 멈춘다. AI 칩의 요리사가 연산기라면 HBM과 interconnect는 재료 운반망이다.

### CH11. HBM

- 여러 DRAM die 적층
- 넓은 interface
- 높은 대역폭
- TSV/패키징
- 수율·열·공급 병목
- GPU와 가까이 배치하는 이유

### CH12. interconnect

- chip-to-chip
- scale-up fabric
- server-to-server network
- latency/bandwidth/topology
- all-reduce 등 분산학습 통신
- accelerator 수를 늘려도 성능이 선형 증가하지 않는 이유

---

## 10. AI 칩은 어떻게 만들어지는가

### FAB1. 요구사항
- workload
- 목표 성능/전력/면적/비용
- memory/interconnect
- software compatibility

### FAB2. architecture와 microarchitecture
- 연산 unit
- cache/SRAM
- dataflow
- control
- I/O
- redundancy

### FAB3. RTL과 검증
- 논리 회로를 코드로 표현
- simulation/formal verification
- bug가 tape-out 후 매우 비싼 이유

### FAB4. EDA와 physical design
- synthesis
- floorplan
- place and route
- timing closure
- power integrity
- design rule check

### FAB5. tape-out와 mask
- 설계 데이터 확정
- photomask 제작
- 높은 NRE
- 수정 비용

### FAB6. wafer fabrication

```text
실리콘 wafer
 → 박막 증착
 → photoresist 도포
 → 노광
 → 현상
 → 식각/이온주입
 → 세정/평탄화
 → 계측·검사
 → 수십~수백 단계 반복
```

### FAB7. 수율
- wafer 위 좋은 die 비율
- defect density
- die size
- 공정 성숙도
- 수율이 원가와 공급량을 좌우

### FAB8. dicing/packaging
- wafer를 die로 절단
- substrate/interposer
- HBM 연결
- 2.5D/3D/chiplet
- 전력·신호·열 설계

### FAB9. test
- wafer sort
- package test
- burn-in
- binning
- 고가 accelerator의 field failure 비용

### FAB10. board/server/system
- accelerator board
- CPU·memory·NIC
- power delivery
- cooling
- rack integration
- firmware/driver/runtime

### FAB11. software enablement
- compiler
- kernel library
- framework integration
- profiler
- model optimization
- 칩이 출하되어도 software가 준비되지 않으면 사용률이 낮다는 점

---

## 11. 왜 AIDC가 필요한가

### DC1. 탄생 배경

```text
개별 서버
 → 기업 전산실
 → 대규모 인터넷 데이터센터
 → cloud/hyperscale
 → HPC cluster
 → AI accelerator cluster
 → AIDC
```

- 웹/클라우드 workload는 많은 독립 요청 처리에 최적화
- 대규모 AI 학습은 수천 accelerator가 하나의 작업처럼 동기화
- 추론은 짧은 latency와 대규모 동시사용자를 함께 처리
- 전력밀도·HBM·네트워크·냉각 요구가 급격히 상승

### DC2. AIDC의 정의

AI 전용 또는 AI 비중이 높은 data center로서 다음을 통합 최적화한다.

- accelerator compute
- high-bandwidth memory
- scale-up/scale-out networking
- high-throughput storage
- orchestration/scheduler
- 전력공급
- 고밀도 냉각
- 보안·운영·장애복구

단순히 GPU가 있는 건물만으로 정의하지 않는다.

### DC3. training cluster

- 긴 시간 하나의 대규모 job
- 대량 데이터 ingest
- distributed parallelism
- checkpoint
- 장애 시 많은 계산 손실
- 네트워크와 scheduler 효율

### DC4. inference cluster

- 동시 사용자
- time-to-first-token
- tokens per second
- batch와 latency trade-off
- KV cache
- model routing
- uptime

### DC5. rack

- server와 accelerator tray
- top-of-rack switch
- power shelf
- liquid cooling manifold
- rack density
- 무게·바닥·소방·정비 공간

### DC6. network topology

- accelerator 내부/서버 내부/서버 간/데이터센터 간
- fat-tree/mesh/torus 등 개념
- oversubscription
- collective communication
- 광통신 확대

### DC7. storage/data pipeline

- raw dataset
- object storage
- parallel file system
- cache
- checkpoint
- data preprocessing
- storage가 compute를 굶기지 않게 하는 문제

### DC8. power chain

```text
발전원/전력망
 → 변전소
 → 데이터센터 수전
 → UPS/배터리
 → PDU
 → rack power shelf
 → board voltage regulator
 → chip
```

- 각 변환 단계의 손실
- redundancy
- backup generation
- grid connection lead time
- power quality

### DC9. cooling chain

```text
chip
 → thermal interface
 → cold plate/heat sink
 → coolant/air loop
 → CDU/chiller
 → 외부 열 방출
```

- 공랭·direct-to-chip liquid·immersion
- 열밀도
- 물·냉매·펌프
- 폐열 활용

### DC10. PUE와 지표

- PUE = total facility energy / IT equipment energy
- 낮을수록 overhead가 적음
- PUE만으로 데이터센터 효율 전체를 판단할 수 없음
- accelerator utilization, tokens/joule, useful work가 함께 필요

### DC11. reliability

- N+1/2N
- UPS
- generator
- network redundancy
- checkpoint/restart
- hardware failure
- software failure

### DC12. 입지

- 전력 공급
- 전력 가격
- 토지
- 물/기후
- 네트워크
- 고객 latency
- 세제·규제
- 인력
- grid interconnection queue

### DC13. AIDC 경제성

- land/building
- electrical/mechanical infrastructure
- accelerator/server
- network/storage
- depreciation
- power
- maintenance
- utilization
- model revenue/cost savings

### DC14. 왜 AIDC가 산업 전체를 움직이는가

```text
AI 서비스 수요
 → model training/inference
 → accelerator/HBM/network
 → server/rack
 → cooling/power equipment
 → transformer/substation/grid/generation
 → copper/uranium/gas/renewables/construction
```

### DC15. 한계와 반대 시나리오

- 모델 효율 개선
- 수요 과대추정
- utilization 부족
- 전력/허가 지연
- chip 세대교체와 조기 감가
- custom ASIC으로 공급구조 변화
- edge/on-device 분산
- 비용 대비 수익화 부족

---

## 12. AI 공급망과 이익 풀

### S1. 전체 stack

```text
사용자/기업 문제
 → AI application
 → model/API/platform
 → cloud/AIDC operator
 → server/network/storage/cooling
 → GPU/ASIC/HBM
 → IP/EDA
 → foundry/memory/packaging/test
 → semiconductor equipment/materials
 → electricity/grid/raw materials
```

### S2. 각 층의 수익모델

- app: subscription/usage/transaction/license
- model/API: token/seat/license
- cloud: compute/storage/network usage
- chip: unit sale/system sale/license
- memory: cycle/contract price
- equipment: system+service
- foundry: wafer price
- packaging/test: capacity/service
- data center: lease/compute service
- utility/power equipment: regulated return/equipment/project

### S3. 가격 결정력 질문

- 대체 공급자가 몇 곳인가?
- 고객 전환비용은 큰가?
- 공급 증설기간은 긴가?
- 제품이 고객 총비용에서 차지하는 비중은 작은가?
- 실패 비용이 큰가?
- 표준/생태계가 잠금효과를 만드는가?
- 기술세대가 바뀌면 지위가 유지되는가?

### S4. 병목 지도

- 선단 foundry capacity
- lithography/critical tools
- HBM
- advanced packaging
- high-speed interconnect
- power delivery
- transformer/switchgear
- grid connection
- skilled labor
- software stack

병목은 고정되지 않으며 `구조적 병목`과 `일시적 공급 부족`을 분리한다.

---

## 13. AI 경제학과 사회

### ECO1. 생산성
- 같은 노동·자본으로 더 많은 산출
- 측정 시차
- 업무 재설계가 없으면 도구 도입만으로 생산성이 제한될 수 있음
- 기업 수준 생산성과 거시 통계의 차이

### ECO2. 대체와 보완
- task가 사라지는 것과 직업 전체가 사라지는 것의 차이
- AI가 노동을 대체/보완하는 조건
- skill premium
- 업무 분해

### ECO3. 노동시장
- 반복인지업무
- 창의/대인/현장업무
- 새 직무
- 임금·교육·지역 격차
- 단정적 고용예측 금지

### ECO4. 수익화
- 비용절감
- 매출증가
- 신제품
- price willingness
- inference cost
- gross margin
- 사용량과 유료전환

### ECO5. 시장구조
- scale economies
- data/network effects
- cloud/chip/model concentration
- open source
- switching cost
- vertical integration

### ECO6. 자본지출 사이클
- 기대→CAPEX→공급망 수주→설치→가동→매출
- 중복투자와 과잉공급
- depreciation
- financing cost
- ROI 확인 시차

### ECO7. 에너지와 환경
- 전력·물·토지
- 탄소배출은 발전 mix에 따라 다름
- 효율 향상과 총사용량 증가
- 지역사회와 grid investment

### ECO8. 지정학
- 첨단칩·장비·소재의 집중
- 수출통제
- 산업보조금
- sovereign AI
- 공급망 회복탄력성

### ECO9. 규제·권리
- 개인정보
- 저작권
- 책임
- 차별/편향
- 안전성
- 모델/데이터 투명성
- 법·규정은 별도 최신 검증 대상

### ECO10. 자본시장 해석

구분해야 할 5개 층:

1. 기술이 가능한가
2. 사용자가 원하는가
3. 기업이 돈을 벌 수 있는가
4. 공급망의 누가 이익을 가져가는가
5. 현재 주가가 이미 얼마나 반영했는가

---

## 14. 위험과 한계

### RISK1. 정확성
- hallucination
- stale knowledge
- benchmark overfitting
- unverifiable reasoning

### RISK2. 보안
- prompt injection
- data exfiltration
- insecure tool use
- model supply chain
- generated code vulnerability

### RISK3. 개인정보
- 민감정보 입력
- training/retention policy
- enterprise boundary
- local/on-device 선택

### RISK4. 편향
- 데이터 대표성
- 역사적 편향
- 평가 기준
- feedback loop

### RISK5. 자동화 실패
- 권한 과다
- 무한루프
- 잘못된 외부 행동
- human-in-the-loop
- audit log

### RISK6. 집중과 시스템 리스크
- 소수 cloud/chip/model 의존
- outage
- 공급망 충격
- 동일 모델 사용에 따른 동조

### RISK7. 사회적 위험
- deepfake
- misinformation
- 노동전환
- 감시
- 군사/dual use

### RISK8. 물리적 위험
- 전력망 부담
- 물 사용
- 열/화재
- 건설·장비 공급 부족

---

## 15. 미래 방향 — 반드시 THESIS 라벨

- Agentic AI
- World Model
- embodied AI
- humanoid robotics
- autonomous science
- on-device AI
- edge AI
- custom ASIC 확대
- optical interconnect/compute
- chiplet/3D integration
- synthetic data
- sovereign AI
- small specialized model
- multimodal persistent memory

표현 원칙:

- `확정될 미래`가 아니라 `가능한 경로`
- 기술 성능·비용·규제·수요의 조건을 함께 표시
- 반대 시나리오 제공
- 특정 기업이 승자라고 연결하지 않음

---

## 16. 화면 설계

### 16-1. AI 시대 landing

```text
AI 시대를 이해하는 지도

[AI는 무엇인가] [Transformer] [World Model] [AI 사용법]
[AI 칩] [반도체 제조] [AIDC] [전력·냉각]
[AI 경제학] [노동·사회] [위험] [미래 경로]

인간의 문제 → 모델 → 칩 → 데이터센터 → 전력 → 경제
```

### 16-2. 추천 코스

#### 15분: AI가 무엇인지
1. 규칙 프로그램 vs 학습 모델
2. parameter/training/inference
3. Transformer 30초 설명
4. 환각과 검증
5. 실제 사용법

#### 30분: AI가 물리 세계가 되는 과정
1. 행렬곱
2. GPU/ASIC
3. HBM/memory wall
4. chip manufacturing
5. AIDC
6. 전력·냉각

#### 45분: 투자자가 보는 AI 가치사슬
1. AI stack
2. 수익모델
3. 병목
4. CAPEX/depreciation
5. 수익화
6. 반대 시나리오

### 16-3. 필수 시각화

1. AI 전체 stack 지도
2. 학습 vs 추론 split diagram
3. neural network forward/backprop loop
4. Transformer token→embedding→attention→next token
5. Q/K/V 쉬운 interaction
6. Transformer vs World Model 분류표
7. Agent loop
8. CPU vs GPU vs ASIC 비교
9. memory hierarchy와 memory wall
10. chip design→fab→package→server
11. AIDC rack/system map
12. chip→냉각→전력망 energy chain
13. AI 공급망 money flow
14. 기술 가능성→수요→수익→주가 5단계

### 16-4. 전문 페이지 연결

| AI lesson | 연결 route |
|---|---|
| AI CAPEX/유동성 | macro, signal |
| 미국채/discount rate | fxbond, macro |
| 반도체 가치사슬 | themes, fundamental, ticker |
| AI 테마 현재 강도 | themes |
| AI 기업 재무/수익화 | fundamental |
| 전력·원전·그리드 | themes, macro |
| 개별 AI 종목 차트 | ticker, technical |
| 포트폴리오 집중 | portfolio |
| AI 관련 뉴스 | market-news, briefing |

---

## 17. 쉬운 설명 샘플 원고

### AI는 어떻게 답을 만드는가

> 사용자의 문장은 먼저 작은 token으로 나뉘고 숫자 좌표로 바뀐다. 모델은 각 token이 다른 token과 어떤 관계를 갖는지 여러 층에서 계산한 뒤, 다음에 올 token들의 확률을 만든다. 하나를 선택해 문장 뒤에 붙이고 같은 계산을 반복한다. 그래서 긴 답변도 실제로는 한 번에 완성하는 것이 아니라 작은 조각을 연속해서 생성한다.

### AI는 사람처럼 생각하는가

> AI 내부에서는 실제로 많은 비교와 변환, 선택 계산이 일어난다. 그 결과가 사람의 추론처럼 보일 수 있지만, 자연스러운 설명문이 곧 인간과 같은 의식이나 완전한 이해를 증명하지는 않는다. 중요한 업무에서는 “어떻게 말했는가”보다 “무슨 근거와 도구로 검증했는가”를 봐야 한다.

### Transformer란 무엇인가

> 문장을 읽을 때 앞에서부터 하나씩만 기억하는 대신, 각 단어가 문장 속 다른 단어들을 동시에 살펴보고 자신에게 중요한 정보를 골라 받는 구조다. 이 attention 계산을 여러 층 반복하면서 문맥에 맞는 표현을 만든다.

### World Model이란 무엇인가

> 언어를 이어 쓰는 능력을 넘어, 세상이 지금 어떤 상태이고 내가 행동하면 다음 상태가 어떻게 달라질지를 내부에서 예측하는 모형이다. 로봇이 컵을 잡기 전에 실패할 움직임을 머릿속 simulation에서 먼저 걸러내는 식으로 사용할 수 있다.

### GPU가 왜 필요한가

> AI 학습은 비슷한 곱셈과 덧셈을 엄청난 양의 데이터에 반복한다. GPU는 원래 화면의 수많은 pixel을 동시에 계산하기 위해 발전했기 때문에, 이런 병렬 계산에도 잘 맞았다.

### ASIC이 왜 중요해지는가

> AI 사용량이 작을 때는 다양한 모델을 돌릴 수 있는 GPU의 유연성이 중요하다. 사용량이 매우 커지고 반복되는 계산 형태가 안정되면, 한 작업에 맞춘 ASIC이 전력과 비용을 줄일 가능성이 커진다. 대신 모델 구조가 바뀌거나 물량이 부족하면 높은 개발비를 회수하기 어렵다.

### AIDC가 왜 필요한가

> 하나의 AI 모델은 한 대의 컴퓨터보다 훨씬 많은 계산과 메모리를 요구할 수 있다. 수많은 accelerator가 데이터를 나눠 계산하고 결과를 빠르게 교환해야 하므로, 서버만 사서 연결하는 것으로 끝나지 않는다. 전용 네트워크, 저장장치, 냉각, 고밀도 전력, scheduler를 하나의 공장처럼 설계한 공간이 필요하다.

### AI가 왜 전력시장과 연결되는가

> AI 칩이 쓰는 전기는 최종적으로 열이 된다. 더 많은 칩을 한곳에 모을수록 전력을 안정적으로 받아 작은 전압으로 바꾸고, 발생한 열을 밖으로 내보내야 한다. 그래서 AI 수요는 칩에서 끝나지 않고 변압기·스위치기어·송전망·냉각·발전원까지 이어진다.

---

## 18. 콘텐츠 품질 규칙

### 반드시 지킬 것

- 인간적 표현은 비유임을 분명히 한다.
- Transformer/World Model/Agent/ASIC의 분류 층을 구분한다.
- 학습과 추론을 구분한다.
- 모델 성능과 경제적 수익성을 구분한다.
- GPU와 ASIC을 단순 승패로 설명하지 않는다.
- AIDC를 GPU가 있는 건물로 축소하지 않는다.
- efficiency 개선과 총전력 감소를 동일시하지 않는다.
- 현재 제품 세대·성능·시장점유율은 기준일과 출처가 있을 때만 표시한다.
- 기업명은 기술 역할 예시이며 추천이 아니라고 표시한다.
- 미래 기술은 THESIS 라벨과 반대 시나리오를 포함한다.

### 금지

- `AI는 확률적으로 아무 말이나 한다`
- `LLM은 단순 자동완성일 뿐이다`
- `attention weight가 모델 사고의 이유를 그대로 보여준다`
- `World Model이 Transformer를 대체한다`
- `ASIC이 GPU를 완전히 대체한다`
- `AI 효율이 좋아지면 전력소모가 반드시 감소한다`
- `parameter 수가 크면 무조건 더 똑똑하다`
- `AIDC 투자 증가=관련 기업 주가 상승`

---

## 19. 출처 seed list

후속 원고 에이전트는 아래 1차 연구를 시작점으로 사용하고, 각 lesson 작성 시 해당 분야의 최신 공식 자료를 추가 검증한다.

- Vaswani et al., `Attention Is All You Need` — Transformer 구조
  - https://arxiv.org/abs/1706.03762
- Ha & Schmidhuber, `World Models` — 압축된 상태·동역학·내부 시뮬레이션
  - https://arxiv.org/abs/1803.10122
- Hafner et al., `Mastering Diverse Domains through World Models` — DreamerV3
  - https://arxiv.org/abs/2301.04104
- Lewis et al., `Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks`
  - https://arxiv.org/abs/2005.11401
- Ouyang et al., `Training language models to follow instructions with human feedback`
  - https://arxiv.org/abs/2203.02155
- Hoffmann et al., `Training Compute-Optimal Large Language Models`
  - https://arxiv.org/abs/2203.15556
- Jouppi et al., `In-Datacenter Performance Analysis of a Tensor Processing Unit`
  - https://research.google/pubs/in-datacenter-performance-analysis-of-a-tensor-processing-unit/

최신 하드웨어 성능표·세대명·시장점유율은 이 seed 문서에 고정하지 않는다.

---

## 20. 구현 우선순위

### AI-0. 분류/용어 동결
- §1의 6층 분류
- 용어사전 키
- Transformer/World Model/Agent/ASIC 관계

### AI-1. 15분 기본 코스
- AI 정의
- 학습/추론
- Transformer
- 환각
- 사용법

### AI-2. 물리 인프라 코스
- 행렬곱
- CPU/GPU/ASIC
- memory/HBM/network
- chip fabrication
- AIDC/power/cooling

### AI-3. World Model/Agent
- state/action/dynamics/planning
- Transformer와 관계
- embodied AI
- 도구/권한/검증

### AI-4. 경제/산업
- AI stack
- 수익모델
- CAPEX/utilization/depreciation
- 병목/규모/생태계
- 노동/규제/에너지

### AI-5. 시각화/연결
- §16 필수 시각화
- 전문 route 양방향 link
- mobile text alternative

### AI-6. 검수
- 과도한 의인화
- 기술/경제/주가 혼동
- current claim/date/source
- 접근성
- 초보자 이해도

---

## 21. 사용자 결정

구현 전 추가로 확인하면 좋은 선택은 3개다.

1. **AI 비중**
   - 권장: 시장 원리 전체 콘텐츠의 약 30~35%
   - 너무 높으면 일반 자본/시장 원리 페이지가 AI 전용 페이지처럼 보일 수 있음

2. **수학 깊이**
   - 권장: 기본 화면은 수식 없이 비유+그림, 심화에서 dot product/softmax/loss 정도만 설명
   - 대안: 완전 무수식 또는 공학 수준

3. **기업 예시**
   - 권장: 가치사슬 역할 설명에만 사용하고 current winner/추천은 테마·트렌드로 넘김
   - 미국·한국·대만·일본·유럽 포함 여부는 상위 문서 D5와 동일

답이 없으면 권장값으로 진행 가능하다.

---

## 22. 후속 에이전트 시작 프롬프트

```text
_context/AI-ERA-FOUNDATIONS-CURRICULUM-2026-08-01.md를
시장 원리 페이지의 AI 대분류 curriculum SSOT로 읽어라.
상위 MARKET-PRINCIPLES-PAGE-DESIGN-HANDOFF와 함께 사용하라.
이 문서는 DESIGN_ONLY이며 구현 완료가 아니다.
AI-0 분류 동결 전에는 원고나 코드를 대량 생성하지 마라.
Transformer/World Model/Agent/ASIC을 같은 층의 경쟁 개념으로 설명하지 말고,
학습→모델→칩→AIDC→전력→경제의 연결을 유지하라.

---

## 23. 산업 Atlas 확장 SSOT

빅테크 Cloud·neocloud·AI CAPEX/ROIC·메모리·파운드리·첨단 패키징·유리기판·광통신/실리콘 포토닉스/CPO·전력·on-device AI·physical AI·드론/방산·우주/항공·Artemis·로켓 재사용까지의 전체 조사 범위와 콘텐츠 생산 절차는 `AI-ERA-INDUSTRY-ATLAS-RESEARCH-SPEC-2026-08-01.md`를 따른다.

이 문서는 과학·AI 모델·AI 칩·AIDC의 기초 원리를 소유하고, 산업 Atlas 문서는 확장 산업의 가치사슬·경제성·투자 지표와 source packet 계약을 소유한다. 같은 원고를 두 문서에 중복 작성하지 않는다.
```
