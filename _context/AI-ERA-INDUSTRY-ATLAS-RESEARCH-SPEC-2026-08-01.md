# AI ERA INDUSTRY ATLAS — 산업 범위·리서치·콘텐츠 생산 명세
> 상태: **DESIGN_ONLY — 구현·원고 작성 미착수**  
> 작성일: 2026-08-01  
> 상위 문서: `MARKET-PRINCIPLES-PAGE-DESIGN-HANDOFF-2026-08-01.md`  
> 과학·모델·칩 기초: `AI-ERA-FOUNDATIONS-CURRICULUM-2026-08-01.md`  
> 탐색 UX: `MARKET-PRINCIPLES-KNOWLEDGE-GRAPH-UX-SPEC-2026-08-01.md`  
> 목적: 현재 AI 시대와 주식시장을 이해하는 데 필요한 산업·기술·경제·정책 지식을 빠짐없이 조사하고, 검증 가능한 콘텐츠로 만드는 범위와 절차를 고정한다.

---

## 0. 먼저 분명히 할 것

이 문서는 완성 원고가 아니라 **조사 대상의 전체 지도와 작업 계약**이다. 구현 에이전트가 검색 결과를 즉석에서 요약해 `index.html`에 붙여 넣는 방식은 금지한다.

콘텐츠는 다음 5단계를 거쳐야 한다.

```text
개념 inventory
  → source packet
  → claim 단위 원고
  → 기술·재무·편집 검수
  → 구조화 데이터 승격
```

따라서 실제 작업은 “개념 하나씩 검색”을 포함하지만, 단순 수작업 복사 과정은 아니다. 먼저 ontology와 질문을 고정하고, 여러 개념을 하나의 가치사슬 단위로 조사한다.

### 기존 설계의 실제 범위와 보강 필요 영역

| 영역 | 기존 상태 | 이번 명세의 처리 |
|---|---|---|
| Transformer·World Model·Agent | 상세 커리큘럼 존재 | 유지·산업 응용 연결 강화 |
| GPU·ASIC·HBM·AIDC | 상세 커리큘럼 존재 | 세대별 현재값은 별도 research card로 분리 |
| 파운드리·패키징·전력 | 중상 수준 | 세부 가치사슬·경제성·지표 확장 |
| 메모리 반도체 | 기초/HBM 중심 | DRAM·NAND·HBM·CXL·enterprise SSD와 주기까지 확장 |
| 빅테크 Cloud | 부분 포함 | 사업모델·서비스 stack·AI 수익화·CAPEX/ROIC 독립 domain 신설 |
| 네오클라우드 | 사실상 누락 | 사업 구조·부채·임대·고객집중·GPU 담보 경제성 신설 |
| 광/포토닉스 | 광통신 언급 수준 | optics chain·silicon photonics·CPO 독립 domain 신설 |
| 유리기판 | 누락 | 첨단 패키징 substrate branch 신설 |
| 온디바이스 AI | 미래 항목 수준 | NPU·edge inference·privacy·battery·hybrid AI 독립 domain 신설 |
| 피지컬 AI | World Model 응용 수준 | robotics·digital twin·sensor/actuator stack 독립 domain 신설 |
| 드론·방산 | 산업 개요 수준 | kill chain·C2/ISR/EW·자율성·조달 경제성 확장 |
| 우주·항공 | 산업 개요 수준 | 로켓 물리·재사용·위성경제·Artemis architecture 확장 |
| AI CAPEX·ROIC | CAPEX 개념 중심 | 현금흐름·감가상각·수익화·과잉투자 판별 framework 신설 |

---

## 1. 전체 지식 지도의 상위 구조

```text
AI 수요/사용자
  → 모델·소프트웨어·데이터
  → Cloud·Neocloud·Edge
  → GPU·ASIC·CPU·NPU·Memory
  → Foundry·Equipment·Materials·Packaging
  → Network·Photonics·Storage
  → AIDC·Cooling·Power·Water·Land
  → 산업 응용: 로봇·자동차·드론·방산·우주·의료·제조
  → 경제 결과: 생산성·매출·CAPEX·ROIC·현금흐름·고용
  → 정책 결과: 에너지·안보·수출통제·산업정책·규제
  → 자본시장: 이익 풀·병목·밸류에이션·사이클·위험
```

각 화살표는 다음 중 하나로 라벨링한다.

- `CAUSES`: 원인이 된다.
- `REQUIRES`: 필요로 한다.
- `CONSTRAINS`: 병목 또는 제약을 만든다.
- `SUPPLIES`: 재화·서비스를 공급한다.
- `MONETIZES`: 사용량을 매출로 바꾼다.
- `FINANCES`: 자본을 제공한다.
- `SUBSTITUTES`: 일부 기능을 대체한다.
- `COMPLEMENTS`: 함께 사용할 때 가치가 커진다.
- `REGULATES`: 법·정책·허가가 영향을 준다.
- `MEASURES`: 특정 지표가 상태를 나타낸다.

---

## 2. Domain A — 빅테크 Cloud와 AI 플랫폼

### 필수 개념 노드

- IaaS·PaaS·SaaS·serverless·managed service
- public/private/hybrid/multi-cloud·sovereign cloud
- region·availability zone·edge location
- virtual machine·container·Kubernetes·orchestration
- object/block/file storage·database·data warehouse·data lake
- CPU/GPU/TPU instance·reserved capacity·spot instance
- training platform·model hosting·inference endpoint·AI API
- model garden·marketplace·agent platform·vector database
- identity·security·observability·billing·egress
- cloud migration·vendor lock-in·switching cost·ecosystem

### 빅테크 Cloud를 설명할 때 반드시 답할 질문

1. AWS·Azure·Google Cloud는 단순 서버 임대와 무엇이 다른가?
2. compute·storage·network·database·AI platform은 어떻게 결합되는가?
3. AI는 Cloud 사용량을 어떻게 늘리고 기존 workload를 어떻게 잠식하는가?
4. 자체 ASIC·GPU 조달·네트워크·소프트웨어 stack이 원가와 차별화에 어떤 영향을 주는가?
5. backlog·remaining performance obligation·계약 기간은 무엇을 보여주는가?
6. 매출 성장과 CAPEX 증가 사이에는 어느 정도 시차가 있는가?
7. 감가상각 내용연수 변경은 마진과 현금흐름 해석에 어떤 영향을 주는가?
8. AI API·개발 플랫폼·업무용 앱에서 각각 어떻게 수익화하는가?

### 연결 노드

`Cloud → AIDC → accelerator → foundry/HBM/package → 전력`  
`Cloud → enterprise software → agent → inference usage → recurring revenue`  
`Cloud CAPEX → depreciation → operating margin/FCF → ROIC`

---

## 3. Domain B — Neocloud·GPU Cloud·AI 인프라 금융

### 정의와 구분

- hyperscaler: 범용 Cloud와 방대한 서비스 묶음을 가진 대형 사업자
- neocloud/GPU cloud: AI/HPC workload와 accelerator cluster에 집중한 사업자
- colocation: 고객 장비를 수용할 전력·냉각·공간·연결성을 제공
- wholesale data center: 대규모 전력 용량과 시설을 장기 임대
- managed AI infrastructure: 하드웨어뿐 아니라 scheduler·storage·network·운영을 제공

### 필수 개념 노드

- bare metal GPU·virtualized GPU·cluster-as-a-service
- Slurm·Kubernetes·scheduler·orchestration·observability
- reserved cluster·on-demand·take-or-pay·minimum commitment
- GPU purchase·lease·finance lease·sale-leaseback
- data-center lease·power reservation·contracted MW/GW
- customer concentration·supplier concentration
- backlog·contract tenor·renewal·counterparty risk
- utilization·revenue per GPU·cost per GPU-hour
- hardware obsolescence·residual value·refresh cycle
- debt covenant·interest expense·collateral·liquidity

### 투자자가 반드시 구분할 것

- 매출 성장과 양질의 현금흐름은 같은 말이 아니다.
- 계약 backlog와 확정 매출은 같은 말이 아니다.
- GPU를 보유한 것과 높은 utilization을 유지하는 것은 다르다.
- 장기 고객계약과 단기 장비·전력 조달의 만기 불일치를 본다.
- neocloud는 Cloud 기술기업이면서 자본집약적 인프라·금융기업의 성격을 동시에 가질 수 있다.

---

## 4. Domain C — AI Compute·Custom Silicon

### 필수 개념 노드

- CPU·GPU·FPGA·ASIC·TPU·NPU·DPU/SmartNIC
- training vs prefill vs decode vs embedding vs recommendation workload
- FLOPS/TOPS보다 실제 utilization이 중요한 이유
- precision: FP32·TF32·BF16·FP16·FP8·INT8·INT4
- tensor core·systolic array·SIMD/SIMT·dataflow
- quantization·sparsity·speculative decoding·mixture-of-experts
- memory-bound vs compute-bound vs communication-bound
- performance per watt·performance per dollar·TCO
- CUDA/ROCm/compiler/runtime/kernel library·software moat
- merchant accelerator vs captive ASIC vs custom ASIC service

### 추가 연결

`모델 구조 → 연산 패턴 → accelerator architecture`  
`사용량 안정화 → ASIC 설계비 회수 가능성`  
`ASIC 확대 → foundry/package/HBM 수요는 유지될 수 있으나 이익 배분은 변화`

---

## 5. Domain D — 메모리·저장장치·데이터 이동

### 메모리 계층

- register·cache·SRAM·DRAM·HBM·NAND·SSD·HDD
- latency·bandwidth·capacity·power·cost의 상충관계
- DDR·LPDDR·GDDR·HBM의 용도 차이
- HBM stack·TSV·base die·known-good-die·yield
- memory controller·PHY·ECC
- CXL·memory pooling·memory expansion
- enterprise SSD·QLC NAND·storage tiering
- checkpoint·dataset pipeline·vector storage·KV cache

### 산업과 사이클

- commodity memory와 differentiated memory
- contract vs spot pricing
- inventory·bit growth·wafer input·utilization·CAPEX discipline
- migration·node shrink·layer count·yield
- 공급 증설 시차와 장비·cleanroom·packaging 제약
- HBM 수율과 일반 DRAM opportunity cost

---

## 6. Domain E — 반도체 설계·파운드리·장비·소재

### 설계 생태계

- architecture·RTL·verification·physical design·tape-out
- EDA·semiconductor IP·design service·fabless·IDM
- chiplet·die-to-die interface·UCIe 계열 개념
- mask·reticle·shuttle·NRE·yield learning

### 제조 공정

- silicon ingot·wafer·epitaxy
- oxidation·deposition·lithography·etch·implant·clean·CMP·metrology
- EUV/DUV·photoresist·mask blank·pellicle
- front-end vs back-end-of-line
- logic·DRAM·NAND·analog·power semiconductor 공정 차이
- mature node와 leading edge의 역할 차이

### 파운드리 경제성

- process node·transistor density·performance/power/area
- wafer start·utilization·wafer price·yield·cycle time
- leading-edge CAPEX·customer prepayment·geographic diversification
- foundry와 고객의 공동 설계 최적화
- 수율 개선이 gross margin과 공급량을 동시에 바꾸는 방식

### 장비·소재 가치사슬

- lithography·deposition·etch·clean·implant·CMP·inspection·test
- silicon wafer·photoresist·specialty gas·wet chemical·slurry·target
- quartz·ceramic·vacuum component·laser·pump·valve
- service revenue·installed base·consumable·replacement cycle

---

## 7. Domain F — 첨단 패키징·기판·유리기판

### 필수 개념 노드

- wire bond·flip chip·fan-out·2.5D·3D stacking
- interposer·silicon bridge·TSV·hybrid bonding
- chiplet·multi-chip module·system-in-package
- organic substrate·ABF 계열 build-up film·silicon interposer
- glass core substrate·through-glass via
- CoWoS류·Foveros류 등은 고유명사와 일반 원리를 분리
- bump·micro-bump·RDL·underfill·TIM·lid
- warpage·CTE mismatch·signal integrity·power integrity·thermal path
- assembly·OSAT·test·burn-in·known-good-die

### 유리기판을 별도 노드로 다루는 이유

- 대형 package에서 평탄도와 치수 안정성이 중요한 이유
- 미세 배선·via density·전기적 특성의 가능성
- 취성·가공·수율·생태계·대량생산 전환의 어려움
- organic substrate·silicon interposer를 즉시 대체한다고 단정하지 않기
- 상용화 시점과 기업 발표는 `THESIS/CURRENT`로 날짜를 붙여 관리

---

## 8. Domain G — 네트워크·광통신·Photonics

### 네트워크 기초

- scale-up·scale-out·scale-across
- latency·bandwidth·throughput·packet loss·jitter
- Ethernet·InfiniBand·RoCE·RDMA
- switch ASIC·NIC·DPU·SerDes·retimer·DSP
- topology: fat-tree·Clos·rail-optimized 등 일반 원리
- collective communication·all-reduce·congestion control

### 광 가치사슬

- copper cable과 optical link의 거리·전력·대역폭 상충
- laser·modulator·photodetector·waveguide·fiber
- EML·VCSEL·silicon photonics·indium phosphide
- optical transceiver·DSP·connector·fiber cable
- pluggable optics·linear pluggable optics·co-packaged optics
- optical engine·PIC·EIC·laser source·packaging·test
- datacom vs telecom·intra-DC vs inter-DC·subsea cable

### CPO/실리콘 포토닉스 투자 해석

- 전기 I/O와 열·전력·거리의 한계가 무엇인지 먼저 설명
- 광학 엔진을 switch ASIC 가까이에 둘 때의 이점과 유지보수 위험
- laser·PIC·packaging·fiber 각 층의 이익 풀을 분리
- 발표된 성능과 실제 양산·배치 시점을 구분
- copper·pluggable·CPO를 단순 승패가 아니라 적용 구간별 공존으로 설명

---

## 9. Domain H — 서버·AIDC·냉각

### 시설과 시스템

- accelerator tray·rack·row·hall·campus
- motherboard·power shelf·busbar·UPS·PDU·backup generation
- storage fabric·management network·security
- air cooling·direct-to-chip liquid·rear-door exchanger·immersion
- CDU·chiller·cooling tower·dry cooler·heat reuse
- PUE·WUE·rack density·availability·uptime·MFU
- commissioning·maintenance·failure domain·redundancy
- land·water·fiber·power·permitting·community impact

### 현재 데이터와 영구 개념의 분리

- 전력밀도·GPU 세대·rack 구성은 기준일을 붙이는 current data
- 열역학·전력 변환·redundancy는 evergreen concept
- 사업자별 contracted power·active power·pipeline은 filing 기반 company data

---

## 10. Domain I — 전력·에너지·Grid

### 원리

- energy vs power·W/Wh·MW/GW·capacity factor
- AC/DC·voltage·current·power factor·harmonic
- generation→transmission→substation→distribution→load
- baseload·dispatchable·intermittent·firm power·reserve margin
- peak demand·load factor·demand response·curtailment

### 시장과 규제

- regulated utility·competitive wholesale market
- energy market·capacity market·ancillary service
- PPA·tariff·interconnection agreement·behind-the-meter
- grid interconnection queue·transmission congestion·basis
- rate base·allowed return·utility CAPEX·customer bill

### 발전·저장·연료

- natural gas·combined cycle·gas turbine·pipeline
- coal·nuclear·SMR·uranium/fuel cycle
- solar·wind·hydro·geothermal
- battery·long-duration storage·hydrogen의 역할과 한계
- onsite generation·microgrid·fuel cell·backup generator

### 장비 가치사슬

- transformer·switchgear·breaker·cable·busbar
- inverter·rectifier·power semiconductor·SiC/GaN
- turbine·generator·heat exchanger·pump
- lead time·order backlog·manufacturing capacity·raw material

### AI와 전력의 양방향 연결

- AI가 전력 수요를 늘리는 경로
- AI가 grid forecasting·maintenance·dispatch를 개선할 가능성
- 효율 개선과 총소비 감소를 동일시하지 않기
- 지역별 발전 mix·전력가격·허가가 데이터센터 입지를 바꾸는 방식

---

## 11. Domain J — AI CAPEX·ROIC·기업재무

### 회계와 현금흐름

- CAPEX vs OPEX
- purchase vs operating lease vs finance lease
- depreciation·useful life·impairment·asset retirement
- EBITDA·operating income·free cash flow의 차이
- working capital·supplier prepayment·customer deposit
- committed purchase obligation·lease obligation·backlog

### 투자수익률

- ROIC = 세후 영업이익과 투하자본의 관계
- ROCE·ROA·incremental ROIC·cash-on-cash return
- WACC·hurdle rate·payback period·NPV
- asset turnover·utilization·gross margin·contribution margin
- cost per token/query·revenue per token/query
- training CAPEX와 inference revenue의 회수 경로

### AI CAPEX cycle을 읽는 순서

```text
수요 기대
 → 장기 계약/선구매
 → GPU·서버·부지·전력 확보
 → 건설중자산
 → 가동
 → 감가상각 증가
 → 사용량·매출
 → 영업이익·FCF
 → ROIC 검증
```

### 과잉투자·거품 위험 체크

- 수요가 공급보다 빠른가, 공급이 수요보다 빠른가?
- 매출 성장이 자체 수요인지 고객의 재판매·재조달인지?
- hyperscaler→neocloud→AI lab 사이의 순환 계약·자금 흐름이 있는가?
- 사용률과 단가가 하락해도 투자수익률을 지킬 수 있는가?
- 장비 수명이 감가상각 내용연수보다 짧아질 위험이 있는가?
- 추론 효율 개선이 수요 확대로 상쇄되는가?
- CAPEX 증가가 장기 경쟁우위인지 일시적 방어비용인지?

---

## 12. Domain K — On-device AI·Edge AI

### 필수 개념 노드

- cloud inference vs edge inference vs hybrid inference
- smartphone·AI PC·wearable·camera·industrial edge·vehicle
- mobile SoC·CPU·GPU·NPU·ISP·DSP·sensor hub
- model compression·distillation·quantization·pruning
- memory footprint·battery·thermal envelope·latency
- offline operation·privacy·data residency·personalization
- federated learning·secure enclave·model update
- edge RAG·small language model·multimodal assistant

### 투자 연결

- handset/PC 교체 주기와 실제 killer application 구분
- NPU TOPS보다 software support와 sustained performance 확인
- memory content·sensor·power management·connectivity 수요 연결
- Cloud를 완전히 대체하기보다 workload 분할 가능성이 큼

---

## 13. Domain L — Physical AI·Robotics·Autonomy

### AI stack

- perception→localization→mapping→prediction→planning→control
- sensor fusion·camera·radar·lidar·IMU·force/tactile sensor
- world model·vision-language-action model·policy model
- imitation learning·reinforcement learning·sim-to-real
- synthetic data·digital twin·physics simulator
- edge inference·real-time system·functional safety

### 물리 stack

- motor·servo·actuator·reducer·bearing·encoder
- battery·power electronics·BMS·charging
- robot arm·AMR·cobot·humanoid·autonomous vehicle
- end effector·gripper·dexterous hand
- controller·industrial network·PLC

### 경제성

- task success rate·cycle time·uptime·payload·range
- hardware BOM·maintenance·teleoperation·insurance
- labor substitution vs labor complement
- robots-as-a-service·purchase·lease 모델
- deployment environment를 제한할수록 상용화가 쉬워지는 이유

---

## 14. Domain M — 드론·방산·자율무기 체계

### 방산의 기초 구조

- threat→doctrine→requirement→budget→procurement→production→sustainment
- prime contractor·subsystem·component·software·service
- development contract·production contract·IDIQ·backlog
- cost-plus vs fixed-price·export approval·security clearance

### 드론·자율체계

- UAV/UAS·USV·UUV·UGV
- ISR·targeting·communications relay·strike·logistics
- flight controller·navigation·GNSS-denied operation
- datalink·mesh network·satcom·electronic warfare
- autonomy level·human-in/on/out-of-the-loop
- swarm·collaborative autonomy·attritable system
- counter-UAS: detection·jamming·kinetic·directed energy

### 현대 전장의 연결

`sensor → data fusion → C2 → effector` kill chain  
`저가 drone 대량화 → 방공 비용 비대칭 → counter-UAS 수요`  
`AI/edge compute → 제한된 통신에서도 탐지·항법·협업`

### 반드시 포함할 위험

- 기술 발표와 실제 전장 신뢰성 차이
- 조달 발표와 revenue recognition 시차
- 탄약·모터·배터리·sensor·RF component 공급망
- 국제법·오인식·escalation·cyber/EW 취약성

---

## 15. Domain N — 우주·항공·Artemis

### 로켓과 재사용

- rocket equation·specific impulse·thrust-to-weight·staging
- solid vs liquid propulsion·cryogenic fuel·engine cycle
- payload mass·orbit·inclination·launch window
- expendable vs partially/fully reusable architecture
- landing burn·thermal protection·refurbishment·turnaround
- cadence·fleet utilization·reliability·insurance
- cost per launch와 price per launch 구분
- 재사용이 항상 더 싸다는 단정 금지: 개발비·회수율·정비·발사빈도 필요

### 위성 경제

- satellite bus·payload·solar array·propulsion
- communications·Earth observation·navigation·weather·defense
- GEO/MEO/LEO·constellation·latency·coverage
- ground station·antenna·terminal·spectrum·launch service
- manufacturing cadence·replacement cycle·orbital debris
- space data→Cloud/AI 분석의 연결

### Artemis architecture

- SLS·Orion·ground systems
- lunar lander·Gateway·spacesuit·surface mobility
- rendezvous·docking·life support·deep-space communications
- lunar science·ISRU·surface power·logistics
- NASA·international partner·commercial provider의 역할 분리
- mission schedule은 항상 `CURRENT`와 기준일을 표시

### 항공

- commercial aircraft cycle·engine·avionics·MRO
- autonomy·AI-assisted design·predictive maintenance
- eVTOL·battery energy density·certification·air traffic management
- defense aerospace와 commercial aerospace의 수요·마진·계약 차이

---

## 16. Domain O — AI 응용 산업

각 응용 산업은 “AI가 쓰인다”가 아니라 **데이터→모델→workflow→지불자→ROI**를 설명한다.

### 필수 응용 branch

- enterprise software: copilot·agent·workflow automation
- advertising/search/commerce: recommendation·auction·conversion
- media/content/game: generation·personalization·IP
- cybersecurity: detection·response·adversarial AI
- finance: fraud·risk·research·trading·customer service
- healthcare: imaging·clinical support·drug discovery·regulation
- biotech/material science: protein·molecule·simulation·lab automation
- manufacturing: vision inspection·predictive maintenance·digital twin
- logistics: routing·warehouse robotics·demand forecast
- automotive: ADAS·autonomy·in-cabin AI·software-defined vehicle
- energy: exploration·forecasting·grid optimization
- agriculture: precision farming·robotics·weather
- education: tutoring·assessment·content production
- government/legal: sovereign data·procurement·accountability

### 응용 산업 공통 질문

1. 누가 비용을 지불하는가?
2. 어떤 기존 비용 또는 시간을 줄이는가?
3. 오류가 발생했을 때 비용과 책임은 누구에게 있는가?
4. proprietary data와 distribution을 가진 사업자는 누구인가?
5. AI 공급자와 기존 소프트웨어 기업 중 누가 이익을 가져가는가?
6. 사용량이 늘수록 gross margin이 개선되는가 악화되는가?

---

## 17. Domain P — 자원·소재·산업재

- copper·aluminum·electrical steel·silver
- silicon·quartz·polysilicon
- rare earth magnet·lithium·nickel·cobalt·graphite
- uranium·natural gas·industrial gas
- gallium·germanium·indium·arsenic
- SiC·GaN·InP 등 compound semiconductor
- specialty chemical·fluorochemical·photoresist
- optical fiber·glass·ceramic·advanced polymer
- water·land·construction material·skilled labor

각 자원은 다음을 연결한다.

`최종수요 → 사용량 intensity → 공급지역 → 증설기간 → 대체 가능성 → 재활용 → 가격 전가력`

---

## 18. Domain Q — 지정학·산업정책·보안

- semiconductor export control·entity restriction·license
- domestic fab subsidy·tax credit·local content
- Taiwan Strait·Korea/Japan materials·Europe equipment 등 지리적 집중
- sovereign AI·data localization·national compute
- defense industrial base·dual-use technology
- spectrum·satellite regulation·launch approval
- grid permitting·environmental review·community acceptance
- cybersecurity·model theft·supply-chain attack
- AI safety·privacy·copyright·liability

정책은 자주 바뀌므로 원리 설명과 현재 규정 데이터를 분리한다.

---

## 19. Domain R — 자본시장 해석과 기업 지도

### 기업을 단순 종목 목록으로 만들지 않는다

각 기업은 다음 역할 tag를 갖는다.

- demand creator
- platform owner
- model provider
- infrastructure operator
- chip designer
- manufacturer
- equipment/material supplier
- network/optics supplier
- power/cooling supplier
- physical AI integrator
- financier/lessor

### 산업별 공통 투자 지표

- revenue growth·backlog·book-to-bill
- gross/operating margin·incremental margin
- CAPEX·depreciation·FCF·net debt
- ROIC·asset turnover·utilization
- inventory·lead time·capacity·yield
- customer/supplier concentration
- recurring vs project revenue
- pricing·mix·content per system
- valuation과 기대 성장률의 관계

### 신호를 4종으로 분리

- `LEADING`: 주문·계약·CAPEX 계획·interconnection request
- `COINCIDENT`: 출하·가동률·사용량·전력 소비
- `LAGGING`: 매출·감가상각·ROIC·현금흐름
- `MARKET`: 주가·밸류에이션·positioning·estimate revision

---

## 20. Domain S — 인접 미래 기술

핵심 지도와 연결하되, 현재 매출과 먼 영역은 `FRONTIER/THESIS`로 표시한다.

- quantum computing·quantum networking/sensing
- fusion·advanced fission·space nuclear power
- brain-computer interface·neurotechnology
- spatial computing·AR/VR·digital human
- synthetic biology·AI laboratory
- autonomous science·materials discovery
- 6G·non-terrestrial network
- in-space manufacturing·servicing·resource utilization
- photonic/analog/neuromorphic computing

---

## 21. 콘텐츠 카드 표준

모든 node는 같은 schema로 조사한다.

```yaml
id: optics.cpo
title: Co-Packaged Optics
domain: network-photonics
status: DRAFT
priority: P0
knowledgeClass: PRINCIPLE | HISTORICAL | CURRENT | THESIS
asOf: 2026-08-01
difficulty: BASIC | INTERMEDIATE | ADVANCED
prerequisites:
  - network.serdes
  - physics.optics
oneLine: "스위치 칩 가까이에 광학 엔진을 배치해 전기 연결의 거리·전력 한계를 줄이려는 방식"
questions:
  - 왜 필요한가?
  - 기존 pluggable optics와 무엇이 다른가?
  - 무엇이 병목이며 누가 돈을 버는가?
claims:
  - id: c1
    text: "..."
    evidenceIds: [e1, e2]
    confidence: HIGH
edges:
  - to: network.switch-asic
    type: COMPLEMENTS
  - to: aidc.power
    type: REDUCES_REQUIREMENT
metrics:
  - bandwidth
  - energyPerBit
  - shipmentStatus
updatedAt: 2026-08-01
reviewAfter: 2027-02-01
```

### 카드당 최소 구성

- 10초 설명
- 왜 생겼는지
- 작동 원리
- 이전 방식과 비교
- 가치사슬
- 병목과 실패 조건
- 경제성·수익모델
- 기업은 고유명사보다 역할을 먼저 설명
- 투자자가 볼 지표
- 현재 상태와 반대 시나리오
- 전문 페이지 deep link
- claim별 출처

---

## 22. 실제 리서치·원고 생산 절차

### RS-0. Inventory 동결

- 이 문서의 domain/node를 machine-readable inventory로 전환
- 중복어·동의어·상하위 관계 정리
- P0/P1/P2 우선순위와 prerequisite 지정
- node별 evergreen/current 비중 지정

### RS-1. 질문 packet 생성

검색어부터 만들지 말고 node당 확인 질문을 먼저 만든다.

- 정의와 작동 원리는 무엇인가?
- 어떤 문제를 해결하는가?
- 물리적·기술적 제약은 무엇인가?
- 대체재와 보완재는 무엇인가?
- 공급망과 이익 풀은 어디인가?
- 측정 지표는 무엇인가?
- 현재 상용화 단계는 어디인가?
- 실패하거나 과대평가될 시나리오는 무엇인가?

### RS-2. Source packet 수집

출처 우선순위:

1. 법령·규제기관·정부·국제기구·표준기관
2. 논문·학회·대학·국립연구소
3. SEC filing·annual report·earnings material
4. 기술 공급자의 architecture/documentation
5. 신뢰도 높은 산업 조사·전문 매체
6. 일반 기사·블로그는 discovery 용도만 사용

한 공급자의 제품 주장만으로 산업 전체 원리를 확정하지 않는다. 경쟁사·학술/표준·고객 또는 공시 자료로 교차검증한다.

### RS-3. Evidence ledger

각 claim은 다음을 저장한다.

- source URL·publisher·title·publication date·accessed date
- primary/secondary 구분
- source excerpt는 저작권 한도 안에서 최소화
- claim이 source에 직접 의해 지지되는지
- measurement period·unit·currency·as-of
- 추론이면 `INFERENCE`, 전망이면 `THESIS`
- conflicting source와 해소 여부

### RS-4. 원고 작성

- source 문장을 번역·붙여넣지 않는다.
- 사용자 눈높이에 맞춘 비유 뒤에 정확한 원리를 배치한다.
- 제품명은 예시로만 사용하고 일반 개념을 canonical content로 둔다.
- 숫자에는 기준일·단위·기간·출처를 붙인다.
- 현재값이 없어도 원리를 설명할 수 있게 작성한다.

### RS-5. 검수

- 기술 검수: 분류·단위·인과관계·과장 확인
- 재무 검수: GAAP/non-GAAP·CAPEX/lease·기간 비교 확인
- 출처 검수: claim-source 직접성·날짜·링크 확인
- 편집 검수: 초보자 이해도·중복·전문용어 설명
- 투자 검수: 기업 홍보와 객관적 분석 분리

### RS-6. 구조화 데이터 승격

- 검수 전 `DRAFT`
- 1차 출처 1개 이상과 교차검증을 통과하면 `REVIEWED`
- UI에 노출하면 `PUBLISHED`
- source가 폐기되거나 현재값이 stale이면 `NEEDS_REVIEW`

---

## 23. 데이터 갱신 계층

| 종류 | 예시 | 갱신 원칙 |
|---|---|---|
| 원리 | 전력과 에너지, attention, rocket equation | 구조 변경 시만 |
| 산업 구조 | foundry·Cloud·전력시장 가치사슬 | 반기 검토 |
| 기술 상태 | CPO·glass substrate·robotics 상용화 | 분기 또는 주요 발표 시 |
| 기업 구조 | 제품 stack·사업부·수익모델 | 10-K/annual report 이후 |
| 재무 데이터 | CAPEX·depreciation·ROIC·backlog | 분기 갱신 |
| 정책·프로그램 | 수출통제·Artemis schedule·국방 조달 | 사건 발생 시 |
| 시장 데이터 | 가격·valuation·estimate·주도주 | 전문 페이지에서 live 제공 |

시장 원리 페이지에는 current 숫자를 과도하게 복제하지 않는다. node에는 “왜 이 숫자를 봐야 하는지”와 전문 페이지 deep link를 둔다.

---

## 24. 초기 우선순위

### P0 — AI 시대의 핵심 물리·경제 chain

1. 빅테크 Cloud 사업 구조
2. hyperscaler vs neocloud
3. AI CAPEX→감가상각→매출→ROIC
4. GPU·ASIC·HBM·memory wall
5. foundry·장비·소재
6. advanced packaging·substrate·glass substrate
7. AI network·optics·silicon photonics·CPO
8. AIDC·cooling·power chain
9. 전력시장·grid·발전·변압기
10. on-device AI
11. physical AI·robotics·digital twin

### P1 — AI가 물리 세계와 국가 전략으로 확장되는 chain

1. drone·autonomous defense·counter-UAS
2. aerospace·rocket reuse·satellite economy
3. Artemis·lunar infrastructure
4. cybersecurity·sovereign AI
5. AI application industry map
6. raw materials·industrial bottleneck
7. geopolitics·export control·industrial policy

### P2 — 심화·미래

- quantum·fusion·BCI·synthetic biology
- photonic/analog/neuromorphic compute
- in-space manufacturing·lunar economy
- 세부 기업별 case study

---

## 25. 초기 공식 Source seed

아래는 최종 출처 목록이 아니라 research packet을 시작할 공식 seed다.

- Cloud/AI CAPEX: Microsoft Annual Report, Alphabet investor filings/calls, Amazon annual filings, Meta annual filings
- Neocloud: 해당 회사의 SEC 10-K/S-1·debt/lease note·customer concentration disclosure
- 전력: IEA `Energy and AI`, 미국 DOE/LBNL 데이터센터 전력 보고서, 지역 grid operator 자료
- 반도체: 회사 architecture docs 외에 IEEE·IEDM·ISSCC·SEMI·JEDEC·UCIe 등 표준/학회 자료
- glass substrate: Intel packaging research/press material을 출발점으로 소재·장비·경쟁 방식 교차검증
- photonics/CPO: IEEE/OFC 자료와 switch/optics 공급자의 architecture material 교차검증
- on-device AI: SoC/NPU 공급자의 개발 문서와 실제 모델 memory·power benchmark 교차검증
- physical AI: robotics 논문·simulation framework·산업 안전 자료와 vendor 자료 교차검증
- defense/drone: 미국 DoD·의회 예산·조달 공시, 수출통제·윤리 규정
- Artemis: NASA의 최신 mission architecture와 프로그램 페이지
- public company metrics: SEC filing 원문을 canonical source로 사용

---

## 26. 완료 기준

- 사용자 요청에 언급된 모든 영역이 독립 node 또는 명시적 하위 node를 갖는다.
- P0 node마다 prerequisite·관계 edge·필수 질문·source packet이 있다.
- `PRINCIPLE/HISTORICAL/CURRENT/THESIS`가 혼재하지 않는다.
- 숫자·일정·제품 세대에는 as-of와 source가 있다.
- 기술 공급자의 홍보 주장은 독립 사실처럼 쓰지 않는다.
- 모든 산업이 과학 원리→기술→가치사슬→경제성→투자 지표로 연결된다.
- 순수 개념 페이지가 live 전문 페이지를 복제하지 않는다.
- 초보자는 Tree/Path로 읽을 수 있고, 숙련자는 Graph와 source를 추적할 수 있다.
- “AI 수혜” 같은 결론보다 병목·대체재·반대 시나리오가 함께 제시된다.

---

## 27. 후속 에이전트 작업 패킷

- `ATLAS-00`: ontology·동의어·우선순위 동결
- `ATLAS-01`: P0 source packet 수집과 evidence ledger
- `ATLAS-02`: Cloud·neocloud·CAPEX/ROIC 원고
- `ATLAS-03`: memory·foundry·packaging·glass substrate 원고
- `ATLAS-04`: networking·photonics·CPO 원고
- `ATLAS-05`: AIDC·cooling·power/grid 원고
- `ATLAS-06`: on-device·physical AI·robotics 원고
- `ATLAS-07`: drone·defense·space·Artemis 원고
- `ATLAS-08`: 기업 역할·지표·전문 페이지 deep link
- `ATLAS-09`: 기술/재무/source/편집 QA
- `ATLAS-10`: 구조화 콘텐츠와 graph edge 승격

한 에이전트가 모든 domain을 동시에 작성하지 않는다. domain별 source packet과 원고를 나누되 ontology·schema·citation gate는 공통으로 사용한다.

---

## 28. 세부 섹터·기업·제품 깊이 SSOT

모든 domain을 `산업→sector→subsector/공정→제품군→player 역할→제품/현재 데이터`까지 재귀적으로 분해하는 규칙과 foundry 3nm/2nm/18A·yield, DUV/EUV, 전공정/후공정, photonics/CPO, open model/중국 전략/open alliance의 상세 taxonomy는 `AI-ERA-DEEP-TAXONOMY-PLAYER-PRODUCT-SPEC-2026-08-01.md`를 따른다.

Telegram 채널은 keyword·framework·원출처 링크 discovery에만 사용하며, 수율·출하·CAPEX·제품 성능 같은 현재 claim은 공식 원출처로 교체된 뒤에만 승격한다.
