# AI ERA DEEP TAXONOMY — 세부 섹터·기업·제품 재귀 분류 명세
> 상태: **DESIGN_ONLY — 원고·코드·데이터 구현 미착수**  
> 작성일: 2026-08-01  
> 상위 범위: `AI-ERA-INDUSTRY-ATLAS-RESEARCH-SPEC-2026-08-01.md`  
> 탐색 UX: `MARKET-PRINCIPLES-KNOWLEDGE-GRAPH-UX-SPEC-2026-08-01.md`  
> 목적: “반도체”, “광통신”, “전력”처럼 큰 이름만 나열하지 않고, 모든 영역을 기술·공정·제품·기업·지표까지 재귀적으로 분해하는 공통 계약을 정의한다.

---

## 0. 핵심 결정 — 모든 산업은 최소 6단계로 내려간다

```text
L0 시대/문제
  L1 산업 Domain
    L2 Sector
      L3 Subsector/공정/기술
        L4 제품군/사업모델
          L5 기업/기관/Player 역할
            L6 제품·공장·프로그램·현재 데이터
```

예시:

```text
AI 시대
└─ 반도체
   └─ 파운드리
      └─ 선단 공정
         ├─ 3nm 계열
         ├─ 2nm 계열
         └─ 18A/A16 계열
            ├─ GAA/nanosheet
            ├─ backside power delivery
            ├─ SRAM·standard cell·interconnect
            ├─ yield·defect density·cycle time
            ├─ TSMC·Samsung·Intel·Rapidus 등 역할
            └─ 공정 family·고객 응용·양산 상태
```

### 깊이 종료 조건

아래 질문 중 하나라도 답하지 못하면 더 내려가야 한다.

- 실제로 무엇을 만드는가?
- 어떤 물리·기술 원리로 작동하는가?
- 이전 기술과 무엇이 다른가?
- 누가 공급하고 누가 구매하는가?
- 대표 제품군은 무엇인가?
- 병목·수율·원가·lead time은 무엇이 결정하는가?
- 기업 실적에서 어떤 지표로 나타나는가?
- 현재 상용화인지 연구·발표 단계인지?

---

## 1. 공통 Node 계약

모든 세부 node는 다음 14개 항목을 갖는다.

1. 쉬운 한 문장
2. 정확한 정의
3. 탄생 배경/해결하려는 문제
4. prerequisite
5. 입력→변환→출력
6. 물리·수학·화학 원리
7. 대체재·보완재
8. upstream→node→downstream
9. player별 역할
10. 대표 product family
11. 수익모델·원가·CAPEX
12. 핵심 KPI와 선행지표
13. 실패 조건·반대 시나리오
14. source·as-of·knowledge class

### 기업 Player schema

```yaml
playerId: asml
name: ASML
roleIds: [lithography-system, installed-base-service]
domains: [duv, euv, high-na-euv]
productFamilies: []
upstreamDependencies: []
downstreamCustomers: []
revenueModel: equipment + service
moatQuestions: []
riskQuestions: []
kpis: []
geographies: []
publicPrivate: PUBLIC
sourceIds: []
asOf: null
```

### Product schema

```yaml
productId: lithography.euv.low-na.system-family
playerId: asml
category: euv-scanner
problemSolved: leading-edge patterning
inputs: [mask, resist-coated-wafer, euv-light]
outputs: [exposed-pattern]
technicalMetrics: [wavelength, numericalAperture, overlay, throughput]
economicMetrics: [systemASP, serviceRevenue, utilization]
productionStatus: RESEARCH | QUALIFICATION | RAMP | HVM | MATURE | RETIRED
asOf: null
sourceIds: []
```

고유 제품명과 성능 수치는 `CURRENT` data다. 일반 원리 원고와 분리한다.

---

## 2. 반도체 전체 재귀 Tree

```text
반도체
├─ 용도
│  ├─ Logic: CPU·GPU·ASIC·MCU
│  ├─ Memory: DRAM·NAND·HBM·SRAM
│  ├─ Analog/Mixed Signal
│  ├─ RF·Connectivity
│  ├─ Power: IGBT·SiC·GaN
│  ├─ Sensor: image·MEMS·radar/lidar
│  └─ Optoelectronics/Photonics
├─ 사업모델
│  ├─ IDM
│  ├─ Fabless
│  ├─ Foundry
│  ├─ OSAT
│  ├─ EDA/IP/Design Service
│  └─ Equipment/Material/Component
├─ 공정
│  ├─ Design
│  ├─ Mask
│  ├─ Front-end wafer fabrication
│  ├─ Interconnect/BEOL
│  ├─ Packaging/Assembly
│  └─ Test/Qualification
└─ System
   ├─ Board/Module
   ├─ Server/Rack
   ├─ Network/Storage
   └─ Software/Compiler
```

---

## 3. Foundry 심화 Tree

### 3-1. 먼저 node 이름의 오해를 해소한다

- `3nm·2nm·18A`는 한 개 물리 치수를 그대로 뜻하는 자 이름이 아니다.
- foundry별 명칭과 transistor·interconnect·library·설계 규칙이 다르다.
- 숫자가 작다고 모든 PPA·원가·수율에서 자동으로 우월하지 않다.
- 같은 이름의 공정도 mobile/HPC·고성능/저전력 library에 따라 결과가 달라진다.
- `Intel 18A`를 다른 회사의 “1.8nm”와 단순 등호로 놓지 않는다.

### 3-2. 세대별 branch

#### Mature/legacy node

- 180/130/90/65/40/28nm 등
- MCU·analog·display driver·connectivity·자동차
- fully depreciated fab·낮은 wafer cost·긴 인증기간
- 지정학적 자립과 공급 과잉 위험

#### 7/5/4nm 계열

- FinFET 성숙과 EUV 도입 범위
- smartphone AP·GPU·CPU·network ASIC
- design cost·mask cost·wafer price 상승
- N7/N6/N5/N4 같은 family 내 호환성과 migration

#### 3nm 계열

- foundry별 FinFET/GAA 채택 차이
- N3 family 내부 base/enhanced/performance/cost variant
- gate 구조만이 아니라 density·SRAM·interconnect·library 비교
- mobile과 HPC ramp의 차이
- wafer revenue mix·HVM·yield learning

#### 2nm 계열

- nanosheet/GAA 구조
- FinFET→GAA 전환 이유: electrostatic control·leakage·Vmin
- sheet width와 threshold option
- backside power 도입 여부와 시점
- N2/N2P/A16, SF2 family 등은 foundry별 별도 node
- process design kit·IP·EDA certification·customer tape-out

#### Intel 18A 계열

- RibbonFET GAA
- PowerVia backside power
- signal/power routing 분리와 IR drop
- 18A·18A-P·18A-PT 같은 family 차이
- 내부 제품 ramp와 external foundry customer를 분리
- 18A 수치를 문자 그대로 1.8nm gate 길이로 해석하지 않기

#### 차세대

- A16·A14·14A 등 각 회사 roadmap 이름
- second-generation nanosheet
- backside power refinement
- high-NA EUV 적용 가능 구간
- CFET·forksheet·2D material은 `FRONTIER/THESIS`

### 3-3. 공정 비교 축

- transistor architecture: planar→FinFET→GAA/nanosheet
- power delivery: frontside→backside
- density: logic·SRAM·analog를 분리
- performance at iso-power
- power at iso-performance
- voltage scaling·Vmin·leakage
- interconnect resistance/capacitance
- reticle limit·die size·chiplet 선택
- design rule·library·IP readiness
- mask count·EUV layer count·cycle time
- wafer price·die cost·package cost
- qualification·reliability

### 3-4. Yield를 독립 대분류로 만든다

```text
Yield
├─ defect-limited yield
│  ├─ defect density D0
│  ├─ die area
│  └─ defect distribution model
├─ parametric yield
│  ├─ frequency
│  ├─ power/leakage
│  └─ voltage margin
├─ functional yield
├─ redundancy/repair yield
├─ packaging yield
├─ test escape/reliability
└─ learning curve
```

필수 개념:

- good die per wafer
- die 크기가 커질수록 defect를 만날 확률이 커지는 이유
- defect density와 단순 수율 퍼센트의 차이
- edge die loss·wafer diameter·scribe lane
- SRAM·logic·I/O가 서로 다른 수율 특성을 갖는 이유
- redundancy·fuse repair·binning
- parametric yield와 판매 가능한 speed bin
- process window·overlay·critical dimension
- excursion·tool matching·contamination
- yield ramp·learning rate·cycle time
- wafer yield와 package/system yield 구분

#### 수율 데이터 규칙

- 회사가 공개하지 않은 정확한 수율을 단정하지 않는다.
- `analyst estimate`, `supplier check`, `company disclosed`, `inferred from ramp`를 구분한다.
- Telegram·언론의 수율 숫자는 `DISCOVERY`이며 1차 확인 전 본문에 쓰지 않는다.
- 수율이 좋아졌다는 말은 defect·parametric·package 중 무엇인지 명시한다.

### 3-5. Foundry player map

#### 선단 logic

- TSMC: pure-play foundry·process family·advanced packaging 연계
- Samsung Foundry: IDM 내부/외부 고객·GAA·package 연계
- Intel Foundry: internal product와 external foundry·18A·advanced packaging
- Rapidus: 일본 선단 공정 생태계·pilot→HVM 검증 필요

#### 중국

- SMIC와 기타 foundry의 mature/advanced-node 역할
- 장비·소재 국산화율과 생산성
- DUV multi-patterning의 비용·cycle time·yield trade-off
- 제재·장비 service·spare part·EDA/IP 접근
- 발표 node와 지속 가능한 HVM을 분리

#### mature/specialty

- GlobalFoundries·UMC·Tower·PSMC·Hua Hong 등
- RF SOI·BCD·analog·power·automotive·display driver
- leading edge가 아니어도 높은 인증·전환비용을 가질 수 있는 이유

### 3-6. Foundry KPI

- wafer shipment·wafer start capacity
- advanced-node revenue mix
- utilization·ASP·gross margin
- CAPEX·depreciation·construction in progress
- customer concentration·prepayment
- process qualification·tape-out·HVM timing
- yield/defect disclosure
- package capacity와 결합 병목

---

## 4. 노광 장비 — DUV·EUV·High-NA EUV

### 4-1. 광학 기초

- wavelength·numerical aperture·resolution·depth of focus
- Rayleigh 계열 관계를 직관적으로 설명
- photoresist·dose·focus·stochastic defect
- lens와 mirror가 필요한 이유
- alignment·overlay·critical dimension uniformity

### 4-2. DUV Tree

```text
DUV
├─ KrF 248nm
├─ ArF dry 193nm
├─ ArF immersion 193nm
├─ scanner
│  ├─ light source
│  ├─ projection lens
│  ├─ wafer stage
│  └─ alignment/metrology
└─ pattern multiplication
   ├─ LELE/LELELE
   ├─ SADP
   ├─ SAQP
   └─ cut/block masks
```

필수 설명:

- 물을 사용해 유효 NA를 높이는 immersion 원리
- 하나의 layer를 여러 번 노광·식각하는 이유
- multi-patterning이 mask·overlay·cycle time·원가·수율을 악화시키는 방식
- DUV는 EUV 등장 후에도 mature node와 일부 layer에서 계속 필요한 이유
- scanner만으로 공정이 완성되지 않고 resist·mask·track·etch·metrology가 결합되는 구조

### 4-3. EUV Tree

```text
EUV 13.5nm
├─ laser-produced plasma source
├─ collector/mirror optics
├─ vacuum system
├─ reflective mask
├─ pellicle
├─ resist/underlayer
├─ wafer stage
├─ actinic inspection
└─ computational lithography
```

필수 설명:

- 공기에 흡수되므로 vacuum과 mirror가 필요한 이유
- 광원 출력·mirror 반사 손실·throughput의 관계
- mask defect·pellicle·resist stochastic 문제
- EUV가 mask 수를 줄일 수 있지만 장비·공정 난도가 높은 이유
- low-NA EUV와 high-NA EUV의 차이
- high-NA의 해상도 이점과 field size·anamorphic optics·새 mask/설계 과제

### 4-4. DUV와 EUV의 관계

- `DUV vs EUV 승자독식`으로 설명하지 않는다.
- chip 한 개가 DUV와 EUV layer를 함께 사용할 수 있다.
- EUV 접근이 제한되면 DUV multi-patterning으로 일부 pattern을 만들 수 있지만 비용·복잡도·yield가 달라진다.
- 공정 node 이름만 보고 EUV layer 수를 추정하지 않는다.

### 4-5. 중국 DUV research packet

Telegram에서 발견된 “중국 immersion DUV 양산” 주장은 다음 상태로 관리한다.

```yaml
knowledgeClass: CURRENT
sourceKind: DISCOVERY_SECONDARY
publicationStatus: NEEDS_PRIMARY_VERIFICATION
```

검증 질문:

1. 개발사와 정확한 장비 model은 무엇인가?
2. dry/immersion, wavelength와 NA는 무엇인가?
3. prototype·customer evaluation·shipment·HVM 중 어느 단계인가?
4. overlay·resolution·throughput·uptime·service 지표가 공개됐는가?
5. 광원·렌즈·stage·control·metrology의 국산 공급망은 무엇인가?
6. 실제 wafer fab의 어느 layer와 node에 적용되는가?
7. 반복 출하와 수율 개선이 확인되는가?

The Information·Telegram 요약만으로 `양산 성공`을 확정하지 않는다.

### 4-6. 노광 Player 역할

- ASML: DUV·EUV·High-NA system, service와 computational ecosystem
- Nikon·Canon: DUV와 nanoimprint 등 제품군은 역할별로 구분
- 중국 system/부품사: scanner·light source·optics·stage·track·metrology를 분리
- Carl Zeiss SMT 계열: EUV optics 역할
- Cymer/광원 ecosystem
- resist·mask·pellicle·inspection 공급자

제품 model명·출하·고객·성능은 공식 자료 기준 `CURRENT` card로 관리한다.

---

## 5. 전공정·중간공정·후공정

### 5-1. 전공정 세부 Tree

```text
Wafer fabrication
├─ wafer preparation/epitaxy
├─ oxidation
├─ lithography
│  ├─ coat/develop track
│  ├─ exposure
│  └─ inspection/metrology
├─ deposition
│  ├─ CVD
│  ├─ PVD
│  ├─ ALD
│  └─ epitaxy
├─ etch
│  ├─ conductor
│  ├─ dielectric
│  └─ high-aspect-ratio
├─ ion implantation/anneal
├─ clean
├─ CMP
├─ FEOL transistor
├─ MOL contact
└─ BEOL interconnect
```

### 5-2. 장비 기업 역할 예시

- ASML: lithography scanner
- Applied Materials: deposition·materials engineering·implant/CMP 등 다영역
- Lam Research: etch·deposition·clean
- Tokyo Electron: coat/develop·etch·deposition·clean
- KLA: inspection·metrology·process control
- ASM International: epitaxy·ALD 계열
- Axcelis: ion implantation
- SCREEN: cleaning·track/후공정 일부
- Advantest·Teradyne: semiconductor test
- Disco: dicing·grinding
- BESI·ASMPT·Hanmi 계열: assembly/advanced packaging 장비

이는 고정 종목 목록이 아니라 역할 예시다. 제품군·시장점유율·고객은 최신 annual report와 product catalog로 조사한다.

### 5-3. 후공정 세부 Tree

```text
Assembly/Packaging/Test
├─ wafer sort
├─ thinning/grinding
├─ dicing
├─ die attach
├─ wire bond/flip chip
├─ RDL/fan-out
├─ 2.5D interposer/bridge
├─ 3D stacking/hybrid bonding
├─ substrate
│  ├─ leadframe
│  ├─ organic/BT
│  ├─ ABF build-up
│  ├─ silicon interposer
│  └─ glass core
├─ thermal interface/lid
├─ package test/burn-in
└─ system-level test
```

### 5-4. 후공정 Player 유형

- integrated foundry packaging
- OSAT
- substrate maker
- bonding/assembly equipment
- test equipment·probe card·socket
- thermal material·underfill·molding compound
- inspection/metrology

각 player는 `무엇을 조립하는가`, `어떤 package generation에 노출되는가`, `capacity와 yield 병목은 무엇인가`로 분류한다.

---

## 6. 광통신·Photonics 전체 Tree

```text
Photonics
├─ 물리
│  ├─ photon·wavelength·frequency
│  ├─ reflection/refraction
│  ├─ total internal reflection
│  ├─ interference
│  └─ loss/dispersion
├─ 광원
│  ├─ VCSEL
│  ├─ DFB laser
│  ├─ EML
│  ├─ CW laser
│  └─ external laser source
├─ 광소자
│  ├─ modulator
│  ├─ photodetector
│  ├─ waveguide
│  ├─ mux/demux
│  └─ optical amplifier
├─ 재료/Platform
│  ├─ silicon photonics
│  ├─ indium phosphide
│  ├─ silicon nitride
│  └─ lithium niobate/기타 frontier
├─ Module
│  ├─ optical engine
│  ├─ transceiver
│  ├─ DSP
│  ├─ driver/TIA
│  ├─ connector
│  └─ fiber cable
├─ Architecture
│  ├─ direct detect/coherent
│  ├─ pluggable optics
│  ├─ LPO
│  ├─ CPO
│  └─ optical I/O
└─ Network location
   ├─ chip-to-chip
   ├─ rack scale-up
   ├─ data-center scale-out
   ├─ data-center interconnect
   ├─ telecom metro/long haul
   └─ subsea
```

### 6-1. AI 데이터센터에서 보는 순서

1. GPU/ASIC cluster의 collective communication
2. switch ASIC·NIC/DPU·SerDes
3. copper reach와 energy/bit 한계
4. optical transceiver speed transition
5. 400G·800G·1.6T 등의 lane/port/module 개념
6. DSP·laser·PIC·connector·fiber supply chain
7. pluggable→LPO/CPO 전환 조건
8. yield·test·thermal·repairability

### 6-2. Player role map

- switch/NIC silicon: Broadcom·NVIDIA·Marvell·Cisco 계열 등
- optical component/laser: Coherent·Lumentum 등
- module 제조: 글로벌/중국 transceiver 업체와 contract manufacturer
- silicon photonics platform/foundry: Intel·TSMC ecosystem 등
- network system: NVIDIA·Arista·Cisco 등
- fiber/connector/test: 별도 subdomain

기업명만 나열하지 말고 다음 role을 표시한다.

```text
laser → PIC → driver/TIA/DSP → optical engine/module
→ switch/system → AI cluster operator
```

### 6-3. 대표 제품 Portfolio 카드

기업별로 다음을 조사한다.

- switch silicon family
- Ethernet/InfiniBand system
- optical DSP/PHY/SerDes
- transceiver speed/form factor
- laser/component portfolio
- CPO/LPO production status
- customer/end-market mix
- internal manufacturing vs outsourced assembly
- datacom vs telecom 매출
- gross margin·inventory·capacity·bookings

### 6-4. Photonics 과장 방지

- prototype·conference demo·sampling·qualification·volume shipment를 구분한다.
- `CPO가 모든 pluggable을 대체한다`고 쓰지 않는다.
- bandwidth 증가가 곧 공급자 매출 증가율과 같다고 단정하지 않는다.
- module ASP 하락과 content 증가를 함께 본다.
- 중국 공급자와 북미 공급자의 고객·규제·원가 구조를 분리한다.

---

## 7. Open Source AI·Open Weight Model 심화 Tree

### 7-1. 용어부터 분리

```text
Openness
├─ open source software
├─ open model architecture
├─ open weights
├─ open training code
├─ open dataset
├─ open evaluation
├─ open inference runtime
└─ open agent harness/tooling
```

- weight를 내려받을 수 있다고 OSI 의미의 완전한 open source인 것은 아니다.
- license가 연구·상업 사용·재배포·파생모델을 어떻게 허용하는지 확인한다.
- training data·training code·recipe·checkpoint 공개 범위가 다르다.
- `open model`이라는 마케팅 표현을 그대로 taxonomy로 쓰지 않는다.

### 7-2. Model family 분류

#### 중국계 discovery inventory

- Qwen 계열
- DeepSeek 계열
- GLM 계열
- Kimi 계열
- MiniMax 계열
- Yi·Baichuan 등

각 family에서 확인할 항목:

- base/instruct/reasoning/coding/multimodal/agent model
- dense vs MoE
- parameter/active parameter
- context·tool use·multilingual
- license·weight availability
- training/inference hardware compatibility
- local/on-prem deployment
- benchmark reproducibility
- API price와 self-hosting TCO

#### 미국·글로벌 inventory

- Llama·Gemma·OLMo·Mistral 계열
- NVIDIA Nemotron/Cosmos 등 domain model
- enterprise/security 특화 open model
- open inference runtime: vLLM·llama.cpp·SGLang 등
- model hub·evaluation·fine-tuning ecosystem

제품군은 빠르게 바뀌므로 family와 current release를 분리한다.

### 7-3. 중국이 open model을 밀어붙이는 이유 — 단일 이유로 설명하지 않는다

가능한 인과 가설:

1. 개발자 채택과 global distribution을 빠르게 확보
2. API 가격보다 ecosystem standard와 mindshare를 선점
3. Cloud·단말·로봇·제조 등 보완재 수요 확대
4. 기업·정부가 on-premise/sovereign deployment를 선택하게 함
5. 제한된 compute에서 효율·distillation·inference 최적화를 확산
6. 중소기업의 AI 도입비용을 낮춰 `AI Plus` 산업 적용 확대
7. Global South와 다국어 시장 접근
8. 미국 closed frontier model 의존도 축소
9. hardware/software 공동 최적화와 국내 accelerator 생태계 지원
10. open ecosystem을 국제 표준·거버넌스 영향력으로 연결

이 중 1~5는 기업전략 inference, 6~10은 정책·지정학과 연결된다. 중국 정부의 open-source ecosystem 추진 문서와 기업의 실제 license/배포 자료를 각각 근거로 삼는다.

### 7-4. Open model economics

- API revenue vs Cloud compute consumption
- model margin vs application/security/orchestration margin
- intelligence per dollar·tokens per task
- fine-tuning·RAG·agent workflow 비용
- self-hosting utilization·operations cost
- commoditize the complement 전략
- distribution·developer ecosystem·data flywheel
- open model이 accelerator·memory·storage 수요를 확대하는 경로

### 7-5. 미국의 open ecosystem 연합을 서로 구분

#### AI Alliance

- IBM·Meta 주도의 open innovation/community 성격
- AMD·Intel·연구기관·tooling ecosystem 참여
- model·tool·evaluation·governance의 넓은 범위

#### Open Secure AI Alliance

- 2026년 NVIDIA와 파트너들이 발표한 AI safety/security 협력
- open model뿐 아니라 agent harness·identity·permissions·logging·evaluation·security tool을 포함
- Microsoft·IBM·Hugging Face·Linux Foundation·security/cloud/semiconductor ecosystem의 역할
- 모든 frontier model 기업이 참여한다고 잘못 쓰지 않는다.

#### 인접 open infrastructure alliance

- Linux Foundation project
- Open Compute Project
- UALink/Ultra Ethernet 등 interconnect 표준
- UCIe chiplet 표준
- PyTorch·vLLM 등 software foundation/community

`open model coalition`, `open security tooling`, `open hardware/interconnect standard`는 서로 다른 목적이다.

### 7-6. Open vs closed를 승패로 설명하지 않는다

- frontier capability
- control/privacy
- customization
- security transparency
- misuse/weight leakage
- support/SLA
- distribution
- total cost
- regulatory exposure

사용 사례별로 hybrid portfolio가 될 수 있음을 설명한다.

---

## 8. 메모리 세부 확장

```text
Memory
├─ Volatile
│  ├─ SRAM
│  ├─ DDR DRAM
│  ├─ LPDDR
│  ├─ GDDR
│  └─ HBM
├─ Non-volatile
│  ├─ NAND
│  ├─ enterprise SSD
│  ├─ client/mobile storage
│  └─ emerging memory
├─ Interface/Module
│  ├─ DIMM/RDIMM/MRDIMM
│  ├─ SO-DIMM/CAMM 계열
│  ├─ HBM stack
│  ├─ SSD controller
│  └─ CXL memory
└─ Economics
   ├─ bit growth
   ├─ ASP/contract/spot
   ├─ inventory
   ├─ wafer input/utilization
   ├─ node migration/layer count
   ├─ yield
   ├─ CAPEX
   └─ LTA/prepayment
```

### Telegram에서 추가로 발견된 research question

- AI training뿐 아니라 inference가 enterprise SSD와 NAND demand를 얼마나 바꾸는가?
- HBM·LPDDR·server DRAM 사이 capacity allocation은 어떻게 이뤄지는가?
- HBM 비중 확대가 wafer productivity·bit supply에 미치는 영향은 무엇인가?
- LTA는 단순 물량 계약인가, price floor/cap·prepayment·technology collaboration을 포함하는가?
- MLCC·FC-BGA·전원부까지 장기계약이 확장되는가?
- China CXMT·YMTC 계열의 capacity·technology·pricing이 global cycle을 어떻게 바꾸는가?

이는 발견 질문이며 게시물 숫자나 전망은 official filing·company call·trade data로 재검증한다.

---

## 9. 전력·AIDC 세부 확장

```text
AIDC Power
├─ Demand
│  ├─ accelerator IT load
│  ├─ rack density
│  ├─ cooling load
│  └─ load profile/oscillation
├─ Grid connection
│  ├─ interconnection study
│  ├─ transmission/substation
│  ├─ transformer/switchgear
│  └─ tariff/capacity charge
├─ Supply
│  ├─ grid mix
│  ├─ natural gas/turbine
│  ├─ nuclear/SMR
│  ├─ renewable/storage
│  ├─ geothermal
│  ├─ fuel cell
│  └─ onsite microgrid
├─ Contract
│  ├─ PPA
│  ├─ utility service agreement
│  ├─ behind-the-meter
│  └─ demand response
└─ Constraint
   ├─ permit
   ├─ water
   ├─ emissions
   ├─ gas pipeline
   ├─ community
   └─ equipment lead time
```

Telegram 표본에서 `발전소 부지/기존 송전망 재사용`, `가스관·연료전지 인허가`, `AI CAPEX의 금융 연결`이 반복됐다. 따라서 전력 node에는 발전원만이 아니라 허가·파이프라인·송전 접속·지역사회·financing을 함께 연결한다.

---

## 10. 나머지 Domain의 필수 세부 수준

### Cloud/Neocloud

`service layer → workload → infrastructure → contract → customer → unit economics → financing → KPI`

### Physical AI

`use case → environment → sensor → perception/world model → planning/control → compute → actuator → safety → deployment economics → player/product`

### Drone/Defense

`mission → platform → payload → autonomy → datalink/C2 → EW resilience → effector → procurement → production capacity → sustainment`

### Space/Aerospace

`mission → orbit → launch vehicle → propulsion/stage → payload/satellite → ground segment → customer/contract → launch cadence → unit economics`

### Biotech/Healthcare

`biological problem → data modality → model → lab/clinical workflow → validation → regulator → payer → product economics`

### Cybersecurity

`asset → threat → attack surface → detection → identity/permission → response → audit → product category → buyer/budget`

어떤 Domain도 산업 이름→관련주 목록으로 바로 점프하지 않는다.

---

## 11. Telegram 리서치 채널 통합 계약

### 전달받은 채널

| 채널 | 핸들 | 이번 확인 | 발견 용도 |
|---|---|---|---|
| 에테르의 일본&미국 리서치 | `aetherjapanresearch` | 로그인된 Telegram Web 최근 표본 확인 | 일본/미국 sell-side, 부품·AI·open model |
| 미국 주식 인사이더 | `insidertracking` | 최근 표본 확인 | 빠른 미국 뉴스, Cloud·CAPEX·방산 |
| 루팡 | `bornlupin` | 최근 표본 확인 | 메모리·반도체·기업 Q&A·한국 수출 |
| 양파농장 | `Onionfarmer` | 최근 표본 확인 | AI 투자 논쟁·중국 모델·전력·수급 |
| 도PB의 생존투자 | `survival_DoPB` | 최근 표본 확인 | 메모리·macro·Space·투자 framework |

### 기존 애플리케이션 상태

- 현재 코드/테스트에 정식 Telegram pipeline source로 명시된 핵심 채널은 `aetherjapanresearch`, `insidertracking`, `bornlupin` 3개다.
- `Onionfarmer`, `survival_DoPB`를 runtime source로 추가하는 것은 이번 DESIGN_ONLY 범위가 아니다.
- 향후 추가 시 권리·retention·중복 forwarding·source identity·24h lane·staleness gate를 먼저 검토한다.

### Source 등급

```yaml
sourceKind: REFERENCE
researchRole: DISCOVERY
allowedUse:
  - keyword discovery
  - framework discovery
  - source-link discovery
  - bull/bear question generation
prohibitedUse:
  - unverified current numeric claim
  - yield or shipment fact promotion
  - live trading signal
  - anonymous rumor as company fact
```

### 전체 게시물 사용의 현실적 의미

“모두 참고”는 게시물 원문을 페이지에 모두 복제하는 것이 아니다.

1. 날짜 범위와 채널별 post count를 확정
2. forwarding/중복 제거
3. 링크·주제·기업·제품·기술 keyword 추출
4. 새로운 node/edge/question 후보 생성
5. 공식 원문을 찾아 claim을 재검증
6. 재사용 가능한 원리만 교육 콘텐츠로 승격

전체 archive 전수 수집은 별도 `TG-ATLAS` packet으로 수행하며, 이번에는 로그인 화면에서 최근 표본과 채널 접근성만 확인했다.

---

## 12. Telegram에서 추출한 재사용 Framework

### F1. Bottleneck 이동

AI 수요의 병목은 고정되지 않는다.

```text
GPU → HBM → package → network/optics → power/cooling
→ DRAM/LPDDR/enterprise SSD → permit/financing
```

페이지는 “현재 병목”을 영구 사실로 쓰지 않고 병목 이동 원리를 설명한다.

### F2. 장기계약이 cycle을 바꾸는가

- LTA·prepayment·capacity reservation
- downside protection·price reset
- customer가 supplier CAPEX를 일부 금융하는 구조
- 안정성 증가 vs 고객집중·계약재협상 위험

### F3. AI의 원가는 token이 아니라 완료된 task로 비교

- token price만 비교하면 모델별 token efficiency를 놓친다.
- cost per correct task·latency·reliability·human review cost를 함께 본다.
- open model의 낮은 API 가격과 실제 self-hosting TCO를 구분한다.

### F4. 모델 성능보다 쩐주의 자금조달

- AI CAPEX 계획
- debt·lease·vendor financing
- compute resale·capacity utilization
- monetization·FCF·ROIC
- 금리·신용조건·전력 허가

### F5. 업황과 주가는 다른 시간축

- 산업 demand/supply
- earnings revision
- valuation/positioning
- forced liquidation/ETF flow
- 기대 대비 surprise

위 framework는 `KNOWLEDGE`로 재사용 가능하지만 게시물의 목표가·미확인 수치·단기 전망은 승격하지 않는다.

---

## 13. 공식 Source seed

- Foundry: TSMC annual report/technology pages, Samsung Foundry technology pages, Intel Foundry process pages, 각사 SEC/annual filing
- Lithography: ASML lithography principles/product/annual report, Nikon/Canon official product pages, 학회·특허·검증 가능한 중국 기관 자료
- Yield: IEEE/VLSI/IEDM 논문, foundry technical disclosure, company filing
- Open model: 공식 GitHub/model card/license, 기업 연구 블로그, benchmark 원자료
- China policy: State Council `AI Plus`, 중국 외교부/산업정보화 관련 open ecosystem 문서
- Open alliances: AI Alliance 공식 페이지, NVIDIA/Open Secure AI Alliance, Linux Foundation
- Telegram: 원문 링크 discovery 전용, 본문 근거는 공식 원출처로 교체

---

## 14. Binary 품질 Gate

| ID | Yes 조건 |
|---|---|
| DT1 | 모든 L1 domain이 최소 L3 subsector까지 분해됨 |
| DT2 | P0 subsector가 기술/공정 또는 사업모델 L4를 가짐 |
| DT3 | P0 L4가 player role과 product family를 가짐 |
| DT4 | 기업명이 역할·제품 없이 나열된 node가 없음 |
| DT5 | CURRENT 제품/수치/수율에 as-of와 primary source가 있음 |
| DT6 | Telegram claim은 REFERENCE/DISCOVERY이며 공식 검증 전 승격되지 않음 |
| DT7 | open source/open weights/open tooling/open hardware가 구분됨 |
| DT8 | DUV/EUV와 3nm/2nm/18A를 단순 숫자 승패로 설명하지 않음 |
| DT9 | 각 node에 bull/bear 또는 실패 조건이 있음 |
| DT10 | 전문 페이지로 넘길 current metric이 중복 하드코딩되지 않음 |

하나라도 `No`면 해당 node는 `PUBLISHED`로 승격하지 않는다.

---

## 15. 후속 작업 Packet

- `DEEP-00`: 전체 L1→L3 taxonomy machine-readable inventory
- `DEEP-01`: foundry 3nm/2nm/18A·yield source packet
- `DEEP-02`: DUV/EUV/High-NA·중국 장비 검증 packet
- `DEEP-03`: 전공정 장비·소재 player/product packet
- `DEEP-04`: advanced packaging·substrate·test packet
- `DEEP-05`: photonics/optics player/product packet
- `DEEP-06`: open model·China strategy·alliance packet
- `DEEP-07`: memory/LTA/enterprise SSD packet
- `DEEP-08`: AIDC/power/permit/finance packet
- `DEEP-09`: physical AI·drone·space recursive expansion
- `TG-ATLAS-00`: 5개 채널 기간·권리·coverage 계획
- `TG-ATLAS-01`: 중복 제거·keyword/entity/URL inventory
- `TG-ATLAS-02`: discovery claim→primary source reconciliation
- `DEEP-QA`: DT1~DT10 전수 평가

후속 에이전트는 UI부터 만들지 않는다. `DEEP-00` inventory와 `DEEP-01~08` source packet이 준비된 뒤, 검수된 node만 Tree/Graph/Path에 노출한다.
