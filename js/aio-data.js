// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  P3-1 PHASE 2 ▸ MODULE 2: DATA START (실제 분할 적용 v48.26)              ║
// ║  책임: SCREENER_DB + Fetch Pipeline + Score + Classify + Translate + Ticker║
// ║  의존성: MODULE 1 (stores/engines/DATA_SNAPSHOT/utils — 모두 전역 var/const)║
// ║  안전 근거: MODULE 1 const는 톱-레벨 선언으로 전역 lexical 환경 등록됨      ║
// ║  분할 후 다음 블록에서 const PriceStore 등 접근 가능 (TDZ는 동일 블록에만 적용)║
// ╚═══════════════════════════════════════════════════════════════════════════╝
// ═══════════════ SCREENER DATABASE & FUNCTIONS ═══════════════
var SCREENER_DB = [
  // ══════════════════════════════════════════════════════════════
  // S&P 500 — 메가캡 & 대형주 (2026-03 Yahoo Finance 기준)
  // ══════════════════════════════════════════════════════════════
  { sym:'NVDA', name:'NVIDIA', sector:'Technology', signal:'BUY', memo:'[Citi 04/17] Blackwell Ultra 양산 · CoWoS 2026 650K/2027 840K · Rubin 로드맵 논쟁 — CX9 NIC(포트당 800G→1.6Tb/s) 개발 과제로 일부 2026 출하 2027 이월 가능(TrendForce) · Citi 2026 Rubin 비중 31% 예상(TrendForce 수정치 22% 대비 강세) · VR서버=AI 팩토리 동서 트래픽 40x · Groq LPU 차세대(TSMC 3/2nm 이관 유력, C.C.Wei 시사) · Feynman EMIB 검토=CoWoS 다변화 · AI DC 수요 구조적 · PE 35x', mcap:4197, rsi:48, index:'SP500' },
  { sym:'AAPL', name:'Apple', sector:'Technology', signal:'HOLD', memo:'MacBook Neo 성공 딜레마 · A18 Pro 빈닝칩 재고 소진 위기(팀쿡 "맥 역사상 첫구매 최고 첫주") · TSMC N3E 풀가동 · 추가생산 시 마진↓ · 생태계 유입 전략 vs 단기 수익성 트레이드오프 · 서비스 매출 성장 지속', mcap:3645, rsi:52, index:'SP500' },
  { sym:'GOOGL', name:'Alphabet', sector:'Technology', signal:'BUY', memo:'[Citi PT$405↑ BofA PT$370 TDCowen PT$375] 1Q26 실적 4/29 · Citi 90일 상승 촉매워치 추가 · 검색 +16.5%YoY(컨센상회), YouTube +11.5%, Cloud +57.5%YoY · Cloud Next 4/22-24(GCP 자신감 예상, Anthropic $10B+/연 2027E), I/O 5/19-20, GML 5/20, Brandcast 5/13 · Gemini Ask Maps/Personal Intelligence/Search Live 통합 확장 · TPU Marvell 설계 협력(MediaTek급) 논의 · Wiz 통합(3/11 종결) · 2026 Capex 하반기 집중 · 클라우드 2025$59B→2027$116B(BofA), 가치기여 $1.2T(시총 30%)', mcap:3641, rsi:50, index:'SP500' },
  { sym:'MSFT', name:'Microsoft', sector:'Technology', signal:'BUY', memo:'[Mizuho PT$515 (620→515)] 3QFY Azure 37~38%cc(가이던스 소폭상회), PBP +15%, MPC -6% · Copilot 3% 유료화(Anthropic Claude 경쟁 뒤쳐짐) · E7 $99/월 출시(Copilot+Entra+Agent 365+Cowork/Anthropic 협력) · Fairwater 대형 DC 외부할당 가능성 Azure 40%+ 반등 촉매 · FY27 Capex 바이사이드 $180B+(YoY+30%) · PER 10년 저점 근접 · TAC 프로그램 OpenAI 파트너(GPT-5.4 Cyber) · YTD GOOGL/AMZN 대비 -21p/-25p', mcap:2838, rsi:48, index:'SP500' },
  { sym:'AMZN', name:'Amazon', sector:'Technology', signal:'BUY', memo:'[Citi PT$285 Jefferies PT$300 WF PT$305] 1Q26 매출 $178.8B(+14.8%YoY), AWS $37.5B(+28%YoY, 컨센상회 $36.5B), OI $21.4B(마진12.0%, 가이던스 상단) · AWS 칩 런레이트 $20B+/연 · Bedrock/토큰사용 증가 · Rufus/Alexa+ 전환율↑ · Globalstar 인수(AMZN LEO D2D, 2028+ 배포, Apple 위성통신 인프라 인계) · 2026 Capex $200B 유지 · Prime Day 6월 이동 가능성+연료비 2Q 마진영향 관찰 · 11x NTM EV/EBITDA 10년 저점', mcap:2205, rsi:46, index:'SP500' },
  { sym:'META', name:'Meta Platforms', sector:'Technology', signal:'BUY', memo:'[번스타인 PT$900] 2026 순광고 $243B로 GOOGL 초과(사상 첫 역전) · AI추천→릴스 시청 YoY+30% · AI비디오생성 ARR $10B · 릴스 12M 매출 $50B 전망 · GOOGL 검색점유율 48.5%(10년만에 50%↓) · Muse Spark · 31억 사용자 배포기반 · CoreWeave $350억(2032)', mcap:1502, rsi:50, index:'SP500' },
  { sym:'TSM', name:'TSMC', sector:'Technology', signal:'BUY', memo:'[Citi PT NT$2875 JPM PT NT$2500] 1Q26 매출 NT$1,134B(+35%YoY, +8%QoQ), GM 66.2%, OPM 58.1%, EPS NT$22.08(컨센 전면상회) · 2Q26 가이던스 +10%QoQ · 2026 매출 가이던스 "30%→30%+" 상향(JPM 35%+, 바이사이드 36% 예상) · 2026-2028 3년 Capex $190~200B(역대급, 2023-2025 대비 2배) · 선단공정 캐파 2027까지 타이트, N5이하 CAGR 25% · N3 2027H1 타이난 램프, AZ P2 27H2, JP P2 28 · N2 4Q25 양산진입(수율 양호), 2028 150k wfpm · 2027 가격 +4-5% like-for-like 인상 논의(2Q26 콘콜) · C.C.Wei "차세대 LPU 고객과 긴밀 협력"=삼성 Groq 수주 위협 · 44% 점유율, 파운드리 독점 모트', mcap:1708, rsi:52, index:'SP500' },
  { sym:'AVGO', name:'Broadcom', sector:'Technology', signal:'BUY', memo:'[Citi PT$475 Bernstein PT$525] META MTIA 멀티GW 다년 파트너십(초기 1GW+, 2029년까지 학습+추론+네트워킹, Hock Tan 메타이사회 퇴임→어드바이저) · GOOG LTA 2031 TPU+네트워킹 · Anthropic 3.5GW TPU 2027 · 2027 AI매출 $100B→$130B+ 상향 컨빅션(Citi) · $100B당 EPS +$1 · 커스텀 실리콘 지연 우려 불식 · TPU 430만/690만유닛(26/27E) · XDSiP 3.5D(CoWoS-L+SoIC) · Mediatek Humu Fish 2028 TPU ~50% 위협(LTA로 방어) · 공급 가시성 확대 = 장기 수요 백스톱', mcap:1472, rsi:45, index:'SP500' },
  { sym:'TSLA', name:'Tesla', sector:'Consumer', signal:'WATCH', memo:'Cybercab 4월 양산 개시(목표 2~4M대/년, $25K~30K) · Austin 로보택시 FSD 무인 서비스 시작(1/22) · Q1 358K대 인도(컨센 372K 미달, 2분기 연속) · Optimus 휴머노이드 · 에너지 저장(Megapack) · PE 323x 극단 밸류에이션 · HSBC PT $119 vs Bull $600', mcap:1381, rsi:42, index:'SP500' },
  { sym:'BRK.B', name:'Berkshire Hathaway', sector:'Financials', signal:'HOLD', memo:'워런 버핏 → Greg Abel 후계자 · 현금 $373B 역사적 고점 = 투자 대기 신호(bear trap vs bull trap) · 보험(GEICO)+철도(BNSF)+에너지+Apple 대량 보유 · 배당 없음 · PBR 1.5x', mcap:1072, rsi:55, index:'SP500' },
  { sym:'LLY', name:'Eli Lilly', sector:'Healthcare', signal:'BUY', memo:'GLP-1 비만치료제 1위 · Mounjaro $7.4B(+110%)/Zepbound $4.3B(+123%) · 미국 비만·당뇨약 시장 점유 60.5% · 2026 매출 가이던스 $80~83B(컨센 $77.6B 상회) · GLP-1 경구용(2Q26 출시 예정) · 매출의 60%+ GLP-1 집중 리스크 · PT 평균 $1,201', mcap:812, rsi:45, index:'SP500' },
  { sym:'WMT', name:'Walmart', sector:'Consumer Defensive', signal:'HOLD', memo:'e-commerce 성장 · 인플레 방어 · 안정 배당', mcap:949, rsi:55, index:'SP500' },
  { sym:'JPM', name:'JPMorgan Chase', sector:'Financials', signal:'HOLD', memo:'미국 최대 은행 · 4/14 어닝발표 — "전술적 강세" 전환 · 금리 H4L 환경 NII 방어 · 호르무즈 재개통=필요조건이지 충분조건 아님(카네바)', mcap:773, rsi:53, index:'DOW30' },
  { sym:'V', name:'Visa', sector:'Financials', signal:'HOLD', memo:'글로벌 결제 인프라 · 국제거래 성장', mcap:582, rsi:56, index:'SP500' },
  { sym:'XOM', name:'Exxon Mobil', sector:'Energy', signal:'BUY', memo:'유가 안정 · 탄소 포집 · 배당 매력', mcap:665, rsi:58, index:'SP500' },
  { sym:'MA', name:'Mastercard', sector:'Financials', signal:'HOLD', memo:'글로벌 결제 네트워크 듀오폴리(V와) · 국제거래 비중 확대 = 달러 약세 수혜 · AI 사기탐지 기술 · 소비자 지출 둔화 리스크 · PER 35x', mcap:480, rsi:55, index:'SP500' },
  { sym:'UNH', name:'UnitedHealth', sector:'Healthcare', signal:'HOLD', memo:'헬스케어 최대 기업 · 안정적 수익 · 규제 리스크', mcap:520, rsi:38, index:'DOW30' },
  { sym:'JNJ', name:'Johnson & Johnson', sector:'Healthcare', signal:'HOLD', memo:'제약+메디컬 디바이스 · 안정 배당 · 소송 리스크', mcap:395, rsi:50, index:'DOW30' },
  { sym:'COST', name:'Costco', sector:'Consumer Defensive', signal:'HOLD', memo:'회원제 리테일 · 안정적 성장 · 프리미엄 밸류에이션', mcap:432, rsi:55, index:'SP500' },
  { sym:'HD', name:'Home Depot', sector:'Consumer', signal:'HOLD', memo:'주택 리모델링 수요 · 프로 고객 확대 · 금리 민감', mcap:380, rsi:48, index:'DOW30' },
  { sym:'PG', name:'Procter & Gamble', sector:'Consumer Defensive', signal:'HOLD', memo:'글로벌 소비재 1위 · 안정 배당 · 프리미엄 밸류에이션', mcap:395, rsi:54, index:'DOW30' },
  { sym:'ABBV', name:'AbbVie', sector:'Healthcare', signal:'HOLD', memo:'Humira 후속 · Skyrizi/Rinvoq 성장 · 고배당', mcap:350, rsi:52, index:'SP500' },
  { sym:'MRK', name:'Merck', sector:'Healthcare', signal:'HOLD', memo:'Keytruda 2028 특허만료(매출50%+) · 피하주사형 전환으로 30~40% 환자 유지 목표 · Cidara($9.2B)+Verona($10B) M&A로 파이프라인 확장 · Winrevair/Capvaxive/Ohtuvayre 차세대 · FW PER 12x(섹터 37~46% 할인) · IRA Januvia 79% 가격인하 영향 · 2025 매출 $65B', mcap:300, rsi:45, index:'DOW30' },
  { sym:'CRM', name:'Salesforce', sector:'Technology', signal:'BUY', memo:'AI Agent (Agentforce) · 엔터프라이즈 CRM 1위', mcap:290, rsi:48, index:'DOW30' },
  { sym:'CVX', name:'Chevron', sector:'Energy', signal:'HOLD', memo:'배당 매력 · Hess 인수 완료 · MS 텍사스 DC 전력 파트너십', mcap:403, rsi:57, index:'DOW30' },
  { sym:'AMD', name:'Advanced Micro Devices', sector:'Technology', signal:'BUY', memo:'WF OW PT $345(2Q26 Tactical) · Citi CW · EPYC 서버CPU +40%+ y/y · Turin(Zen 6) 출시=Diamond Rapids(Intel) 대비 경쟁력 유지 · 서버CPU TAM $100B by 2030(AMD 현 $26B→$100B 로드) · DC GPU $13.5B(2026E)→$32.3B(2027E)→$40B+ 업사이드 · MI455X/Helios 랙스케일 2H26 · 재고+선약 $20.1B(+88% y/y) · EPS 2026E $6.25 · CoWoS 77K(26E, JPM 하향 — MI450 2nm 재테이프아웃+HBM4) · 베니스CPU 2027 ASE외주 · N2공정=N3P 캐파 경쟁 회피 · WF 시나리오: Base $345/Up $430/Down $180', mcap:328, rsi:44, index:'SP500' },
  { sym:'NFLX', name:'Netflix', sector:'Communication Services', signal:'BUY', memo:'구독자 3억 돌파 · 광고 티어 성장 · 게임 진출', mcap:350, rsi:55, index:'SP500' },
  { sym:'PEP', name:'PepsiCo', sector:'Consumer Defensive', signal:'HOLD', memo:'음료+스낵 · 안정 배당 · 방어적 포트폴리오', mcap:225, rsi:50, index:'SP500' },
  { sym:'KO', name:'Coca-Cola', sector:'Consumer Defensive', signal:'HOLD', memo:'글로벌 음료 1위 · 안정 배당 63년 · 방어주', mcap:260, rsi:52, index:'DOW30' },
  { sym:'MCD', name:'McDonald\'s', sector:'Consumer', signal:'HOLD', memo:'글로벌 외식 1위 · 프랜차이즈 수익 · 배당', mcap:210, rsi:50, index:'DOW30' },
  { sym:'TMO', name:'Thermo Fisher', sector:'Healthcare', signal:'HOLD', memo:'생명과학 장비/시약 · 바이오 CDMO 수혜', mcap:195, rsi:48, index:'SP500' },
  { sym:'ADBE', name:'Adobe', sector:'Technology', signal:'HOLD', memo:'AI 기반 크리에이티브 도구 · Firefly · SaaS 성장', mcap:192, rsi:45, index:'SP500' },
  { sym:'ORCL', name:'Oracle', sector:'Technology', signal:'BUY', memo:'[Citi PT$320, 미즈호 PT$400] OCI RoCE 네트워킹 해자(하이퍼스케일러 복제 불가) · 오프박스 가상화 · 통합 DB(관계형+JSON+벡터+그래프) · Fusion Agentic Apps 전제품군 · Agent Hub · 바이브 코딩 채택↑ · 멀티클라우드 전략(Azure) · 풀스택=인프라+DB+앱', mcap:280, rsi:52, index:'SP500' },
  { sym:'BAC', name:'Bank of America', sector:'Financials', signal:'HOLD', memo:'소비자 뱅킹 · NII 회복 · 금리 수혜', mcap:310, rsi:50, index:'SP500' },
  { sym:'CSCO', name:'Cisco Systems', sector:'Technology', signal:'HOLD', memo:'네트워킹 장비 · AI 인프라 스위칭 수요', mcap:230, rsi:52, index:'DOW30' },
  { sym:'DIS', name:'Walt Disney', sector:'Communication Services', signal:'HOLD', memo:'스트리밍 흑자 전환 · 테마파크 · ESPN 재편', mcap:195, rsi:45, index:'DOW30' },
  { sym:'PLTR', name:'Palantir', sector:'Technology', signal:'BUY', memo:'[Mizuho PT$185 (195→185, Outperform)] 1Q26E 매출 $1.58B(+79%YoY, 가이던스 $1.532-1.536B 상회), 커머셜 $768M(+94%), 정부 $810M(+66%), OpM 56.9%, FCF마진 53% · 골든돔 $1,850억 소프트웨어 레이어 핵심(록히드/노스롭/RTX가 하청) · Maven 공식 전력화 프로그램 지정 · ShipOS 확장, GE 에어로스페이스 다년 파트너십 · 베인/에어버스/스텔란티스 상용 확대 · NVIDIA 소버린 AI OS 레퍼런스(블랙웰 울트라) · FY26 가이던스 매출 +61% $7.18-7.20B, OpM ~57.5%, FCF마진 56% · "Rule of 120+" · 리스크: NHS FDP 규제 · EV/매출 26/27E 65x/47x', mcap:360, rsi:55, index:'SP500' },
  { sym:'MU', name:'Micron Technology', sector:'Technology', signal:'BUY', memo:'[미즈호 PT $545] HBM+HBF 동시 수혜 · KVCache 16TB/GPU · NAND 2026E -6% 공급 타이트 · 2Q-3Q26E 계약가 +81%/+20% · HBM3E/4E 전량 매진 · LTA 가격하한선+선급금 → 하방보호 · 메모리 슈퍼사이클 1H27E까지', mcap:477, rsi:42, index:'SP500' },
  { sym:'CAT', name:'Caterpillar', sector:'Industrials', signal:'BUY', memo:'[Citi 04/09] DC백업 발전기 MW당$100만(엔진$50만) · 리드타임 디젤12~18월/왕복36월 · 추론DC전환→스탠바이MW↑(100IT→175백업) · 발전부문 매출 상향여지', mcap:319, rsi:58, index:'DOW30' },
  { sym:'RTX', name:'Raytheon Tech', sector:'Industrials', signal:'BUY', memo:'F-35/패트리엇 · 글로벌 방위비 증가 수혜', mcap:267, rsi:59, index:'SP500' },
  { sym:'GS', name:'Goldman Sachs', sector:'Financials', signal:'HOLD', memo:'M&A/IPO 수수료 회복 · 자산관리 확대 · 4/13 어닝발표 — 바이백 블랙아웃 해제 후 첫 실적 · 롱온리 +24% 매수우위(데스크플로우) · 금리 H4L 환경 NII 안정', mcap:244, rsi:52, index:'DOW30' },
  { sym:'GE', name:'GE Aerospace', sector:'Industrials', signal:'BUY', memo:'항공 엔진 독점 듀오폴리(RR과) · LEAP+GE9X 수주잔고 $150B+ · MRO 서비스 매출 성장 · GE Vernova 분사 완료(전력+풍력) · 항공 여행 구조적 회복 · 국방 예산 확대 수혜 · PER 38x', mcap:220, rsi:58, index:'DOW30' },
  { sym:'INTC', name:'Intel', sector:'Technology', signal:'BUY', memo:'KeyBanc OW $70 · 18A 수율65%(팬서레이크 양산) · 애플14A 맥북/아이패드 수주 · 구글 HumuFish EMIB-T(TPUv9, 2028양산 가능 — 대형패키지+다수브릿지 과제, JPM) · Trainium4→Alchip 유력(INTC EMIB-T 채택) · EMIB-T: 120x180mm/38+브릿지/25μm bump · 3.5D(EMIB+Foveros Direct) · Clearwater Forest(18A+Foveros) · Maia 300 1Q27 지연 → INTC 패키징 점유↑ · 패키징 매출 예상 대폭 초과 · 구글과 맞춤형 IPU 공동개발(Xeon6+IPU 이질적AI시스템) · 파운드리 2.0 상방', mcap:100, rsi:55, index:'DOW30' },
  { sym:'LMT', name:'Lockheed Martin', sector:'Industrials', signal:'BUY', memo:'트럼프 FY2027 $1.5T 국방예산(WWII후 최대증액) · F-35 조달 포함 · Golden Dome $185B · 인도태평양 억제력 강화 · 무기재고 재건', mcap:145, rsi:61, index:'SP500' },
  { sym:'ARM', name:'ARM Holdings', sector:'Technology', signal:'BUY', memo:'AI 에지 칩 설계 · 모바일+서버 CPU 아키텍처 독점 · 자체 CPU 칩 발표(2026.03) · Agentic AI CPU 병목→ARM 4배 코어밀도 수혜 · Raymond James $166', mcap:141, rsi:48, index:'SP500' },
  { sym:'QCOM', name:'Qualcomm', sector:'Technology', signal:'HOLD', memo:'[JPM 04/17: OW→N 하향 + Negative Catalyst Watch] PT$140(기존$185↓) · ARM의 AGI CPU 직접 판매 + Nvidia Groq LPX 등 DC CPU/NPU 경쟁 심화 · 스마트폰/IoT 시장 부진 → QTL/QCT 컨센서스 하향 위험 · 메모리 원가 상승 역풍(Apple 대비 조달 우위 없음) · 스냅드래곤 X Elite · KeyBanc: 중국 수요 약세 2026 빌드 -20% avg · SWKS > QCOM (Apple 공급망 재편) · 추론 시장 리레이팅 테시스는 유효하나 단기 모멘텀 부재', mcap:139, rsi:48, index:'SP500' },
  { sym:'PANW', name:'Palo Alto Networks', sector:'Technology', signal:'BUY', memo:'[JPM 04/09] Project Glasswing 창립파트너(CRWD와 공동) · AI에 AI로 맞서는 방어 파트너십 · 섀도AI 확산→보안예산 확장 수혜 · 플랫폼 통합 전략 지속', mcap:133, rsi:52, index:'SP500' },
  { sym:'NOW', name:'ServiceNow', sector:'Technology', signal:'WATCH', memo:'[UBS 04/09] Neutral 하향 — AI 예산이 비AI SW 크라우딩아웃 · PT $100(from $170, 13x 2027E EV/FCF) · 1Q 가이던스 부진 리스크 · SW→Semi 로테이션 역풍 · 장기 CRPO 성장 16%→추정치 하향', mcap:116, rsi:48, index:'SP500' },
  { sym:'CRWD', name:'CrowdStrike', sector:'Technology', signal:'BUY', memo:'[WF 04/18] **양쪽 독점 파트너**: Anthropic Glasswing 창립파트너(CRWD+PANW) + OpenAI TAC(Trust Access for Cyber) 14개 초기 파트너(순수 사이버 유일 조기접근, GPT-5.4 Cyber 포함) · ZS는 TAC에만 포함 · 미국 CAISI/영국 AISI 연방기관 접근 제공 — 정부 개입 표준화 경로 · "AI 보안 ≠ 프론티어 모델 단독 해결" 예산 촉매 · 섀도AI 1,800+앱 · 오버워치 6.5조/일 텔레메트리 우위 · RSA 3/23-26 신원/엔드포인트 AI 시대 부각', mcap:104, rsi:52, index:'SP500' },
  { sym:'CEG', name:'Constellation Energy', sector:'Utilities', signal:'BUY', memo:'원전 PPA 장기계약 · AI 데이터센터 전력 계약 · 가동률 85~90% 목표 · Rate Base 확대', mcap:102, rsi:45, index:'SP500' },
  { sym:'BE', name:'Bloom Energy', sector:'Utilities', signal:'BUY', memo:'[04/14] Oracle 2.8GW 마스터 계약(초기 1.2GW 배치 중) · 55일 만에 가동(예상 90일) = time-to-power 우위 · 800V DC AI 워크로드 최적화 · 모듈형 연료전지 온사이트 발전 패러다임 · AI DC 고밀도+급변부하 대응 · 신주인수권 발행', mcap:8, rsi:55, index:'NYSE' },
  { sym:'HON', name:'Honeywell', sector:'Industrials', signal:'HOLD', memo:'산업자동화 · 항공우주 · 분사 계획', mcap:140, rsi:48, index:'DOW30' },
  { sym:'AMGN', name:'Amgen', sector:'Healthcare', signal:'HOLD', memo:'바이오 대형주 · 비만치료제 MariTide 임상 · 배당', mcap:170, rsi:44, index:'DOW30' },
  { sym:'IBM', name:'IBM', sector:'Technology', signal:'HOLD', memo:'Red Hat · AI watsonx · 하이브리드 클라우드 전환', mcap:210, rsi:55, index:'DOW30' },
  { sym:'BA', name:'Boeing', sector:'Industrials', signal:'WATCH', memo:'737 MAX 생산 정상화 · 품질 리스크 · 방산 수주', mcap:120, rsi:42, index:'DOW30' },
  { sym:'NKE', name:'Nike', sector:'Consumer', signal:'WATCH', memo:'중국 매출 회복 · DTC 전략 재편 · 경쟁 심화', mcap:110, rsi:38, index:'DOW30' },
  { sym:'PFE', name:'Pfizer', sector:'Healthcare', signal:'WATCH', memo:'코로나 이후 매출 급감 · 비용 절감 · 신약 파이프라인', mcap:145, rsi:35, index:'DOW30' },
  { sym:'AXP', name:'American Express', sector:'Financials', signal:'HOLD', memo:'프리미엄 카드 · 소비 지출 성장 · 고소득 고객', mcap:190, rsi:55, index:'DOW30' },
  { sym:'MMM', name:'3M', sector:'Industrials', signal:'HOLD', memo:'헬스케어 분사 완료 · 구조조정 · 소송 해결', mcap:70, rsi:48, index:'DOW30' },
  { sym:'VZ', name:'Verizon', sector:'Communication Services', signal:'HOLD', memo:'5G 인프라 · 고배당 · 가입자 안정화', mcap:170, rsi:50, index:'DOW30' },
  { sym:'TRV', name:'Travelers', sector:'Financials', signal:'HOLD', memo:'보험 · 프리미엄 인상 사이클 · 안정 배당', mcap:55, rsi:52, index:'DOW30' },
  { sym:'DOW', name:'Dow Inc', sector:'Materials', signal:'HOLD', memo:'화학·소재 · 원자재 가격 민감 · 배당', mcap:32, rsi:45, index:'DOW30' },
  // ══════════════════════════════════════════════════════════════
  // S&P 500 — 추가 대형주
  // ══════════════════════════════════════════════════════════════
  { sym:'ASML', name:'ASML Holdings', sector:'Technology', signal:'BUY', memo:'[Citi PT €1600 JPM OW AFL] 1Q26 매출 €87.7억(컨센상회 €86.9, 가이던스 €82-89 상단), GM 53.0%(상단), EPS €7.15(+10.5% JPM) · 2026 매출 가이던스 €360-400억(중간값 €380억, 기존 €365억 대비 상향) · 2027 Low NA EUV 최소 80대 공약(VA 컨센 72 대비 상승여력) · 삼성 P5 EUV 20대 오더 · "고객 단기·중기 수요 상향" = 매우 강한 수주 · 3800F 처리량 증가=2027 ASP 긍정 · 新가이던스 체계: 보수 제시→연중 상향 전환 · 2Q26 가이던스 €84-90억(컨센 하회 €90.7) 보수적 의도', mcap:290, rsi:48, index:'SP500' },
  { sym:'LIN', name:'Linde', sector:'Materials', signal:'HOLD', memo:'산업가스 세계 1위 · 반도체+에너지 수혜', mcap:220, rsi:52, index:'SP500' },
  { sym:'INTU', name:'Intuit', sector:'Technology', signal:'HOLD', memo:'TurboTax+QuickBooks · AI 기반 금융 SW', mcap:170, rsi:48, index:'SP500' },
  { sym:'BLK', name:'BlackRock', sector:'Financials', signal:'HOLD', memo:'세계 최대 자산운용사 · ETF · iShares', mcap:150, rsi:52, index:'SP500' },
  { sym:'ISRG', name:'Intuitive Surgical', sector:'Healthcare', signal:'BUY', memo:'다빈치5 수술 로봇 독점(시장점유 80%+) · 시술 건수 YoY +17% 성장 · 설치 기반 확대(9,000대+) → 소모품 반복 매출 · 중국 FDA 승인으로 아시아 진출 가속 · PER 70x 프리미엄', mcap:180, rsi:55, index:'SP500' },
  { sym:'UBER', name:'Uber Technologies', sector:'Technology', signal:'BUY', memo:'라이드 쉐어+배달 흑자 안정 · 자율주행 파트너십', mcap:145, rsi:50, index:'SP500' },
  { sym:'AMAT', name:'Applied Materials', sector:'Technology', signal:'BUY', memo:'Evercore 탑픽 — WFE $140B/$180B(2026/2027) 상향 수혜 · HBM4 고용량화+첨단패키징 장비 수요 · Agentic AI DRAM/NAND 집약화→설비투자 직접 수혜 · HBM 3~4x 용량 확장=AMAT 장비 수요 배수 확대', mcap:140, rsi:45, index:'SP500' },
  { sym:'SLB', name:'Schlumberger', sector:'Energy', signal:'HOLD', memo:'유전서비스 수요 · 디지털 전환 · 중동 확장', mcap:70, rsi:52, index:'SP500' },
  { sym:'T', name:'AT&T', sector:'Communication Services', signal:'HOLD', memo:'5G·광통신 · 부채 축소 · 고배당', mcap:145, rsi:50, index:'SP500' },
  { sym:'NEE', name:'NextEra Energy', sector:'Utilities', signal:'BUY', memo:'[Citi 04/09] 가스터빈+에어로+왕복엔진+이동식발전기 올오브더어보브 독보적 · DC전력 원스톱 솔루션 · 학습→추론 전환 양면수혜 · BTM수요 포함 단기~중기 최선호', mcap:155, rsi:48, index:'SP500' },
  { sym:'LOW', name:'Lowe\'s', sector:'Consumer', signal:'HOLD', memo:'주택 리모델링 · Home Depot 경쟁 · 주주환원', mcap:125, rsi:46, index:'SP500' },
  { sym:'SPGI', name:'S&P Global', sector:'Financials', signal:'HOLD', memo:'신용평가+데이터 · 금융 인프라 독점', mcap:150, rsi:52, index:'SP500' },
  { sym:'DE', name:'Deere & Co', sector:'Industrials', signal:'HOLD', memo:'정밀 농업 자동화 · AI 기반 농기계', mcap:151, rsi:50, index:'SP500' },
  { sym:'NOC', name:'Northrop Grumman', sector:'Industrials', signal:'BUY', memo:'B-21 폭격기 · 우주방위 · ICBM 현대화', mcap:75, rsi:58, index:'SP500' },
  { sym:'GD', name:'General Dynamics', sector:'Industrials', signal:'BUY', memo:'버지니아급 잠수함 건조 · FY2027 $1.5T 국방예산 수혜 · Gulfstream · 방산 수혜', mcap:80, rsi:57, index:'SP500' },
  { sym:'HII', name:'Huntington Ingalls', sector:'Industrials', signal:'BUY', memo:'미 해군 함정 독점 건조 · 버지니아급 잠수함 · FY2027 $1.5T 국방예산 최대수혜 · 핵잠수함', mcap:12, rsi:55, index:'SP500' },
  { sym:'WFC', name:'Wells Fargo', sector:'Financials', signal:'HOLD', memo:'소매 뱅킹 회복 중 · $1.95T 자산상한 해제 기대(2026 하반기?) → 성장 가속 촉매 · 순이자마진(NIM) 금리 민감 · 비용 절감 + 디지털 전환 · PER 11x 은행 섹터 평균 수준', mcap:195, rsi:50, index:'SP500' },
  { sym:'MS', name:'Morgan Stanley', sector:'Financials', signal:'HOLD', memo:'자산관리 AUM $7T+(부유층 고객 중심) · IB+M&A 회복 사이클 수혜 · ETrade 통합 완료 · 실적 안정성 높음 · 배당 수익률 3%+ · IPO 시장 재개 시 촉매 · PER 14x', mcap:175, rsi:50, index:'SP500' },
  { sym:'COIN', name:'Coinbase', sector:'Financials', signal:'WATCH', memo:'BTC 강세 수혜 · 규제 명확화 · Base L2', mcap:53, rsi:48, index:'SP500' },
  { sym:'VST', name:'Vistra', sector:'Utilities', signal:'BUY', memo:'천연가스+원전 · AI 데이터센터 PPA · 가스 가동률 레버리지(60%→85%) · Rate Base 성장주 리레이팅', mcap:49, rsi:42, index:'SP500' },
  { sym:'MRNA', name:'Moderna', sector:'Healthcare', signal:'SELL', memo:'mRNA 파이프라인 불확실 · 현금 소진 · 매출 급감', mcap:20, rsi:32, index:'SP500' },
  { sym:'SQ', name:'Block Inc', sector:'Financials', signal:'HOLD', memo:'Cash App 성장 · 비트코인 전략 · Square 결제', mcap:36, rsi:45, index:'SP500' },
  { sym:'COP', name:'ConocoPhillips', sector:'Energy', signal:'HOLD', memo:'E&P 대형주 · Marathon 인수 · 생산 확대', mcap:125, rsi:52, index:'SP500' },
  { sym:'SBUX', name:'Starbucks', sector:'Consumer', signal:'HOLD', memo:'중국 회복 · 미국 가격 전략 · 글로벌 확장', mcap:105, rsi:45, index:'SP500' },
  { sym:'GILD', name:'Gilead Sciences', sector:'Healthcare', signal:'HOLD', memo:'HIV+간염 치료 · 항암 파이프라인 · 고배당', mcap:110, rsi:50, index:'SP500' },
  // ══════════════════════════════════════════════════════════════
  // NASDAQ-100 전용 (S&P500 미포함 또는 나스닥 특성 강조)
  // ══════════════════════════════════════════════════════════════
  { sym:'MRVL', name:'Marvell Technology', sector:'Technology', signal:'BUY', memo:'[2026.04] **GOOG TPU 신규 설계 벤더 승격(초기 단계)** — MediaTek급 설계서비스 역할, 고속 인터커넥트 강점 활용, Google 벤더 다변화+비용/성능 최적화 의도 · Google LPU(Groq 대응 LLM 전용 추론 가속기) 신규 아키텍처 논의 범위 포함 · Barclays OW PT$150 · 광학부문 ~90% 성장 가능 · NVDA $2B 투자 · NVLink Fusion: 커스텀 XPU의 NVDA 생태계 IP블록 제공(Trainium4 호환) · 하이퍼스케일러 XPU 독립성+NVDA GPU 혼합 = MRVL이 이진선택을 스펙트럼으로 전환하는 퍼실리테이터 · 실리콘 포토닉스(CelestialAI EAM) → AMZN 활성화 · AI-RAN 5G/6G · MS $103 / Evercore $120 / UBS $120 · FY26 DC $6.1B / FY28 $15B', mcap:62, rsi:44, index:'NASDAQ100' },
  { sym:'SNPS', name:'Synopsys', sector:'Technology', signal:'BUY', memo:'반도체 설계 EDA 도구 · AI 칩 설계 필수', mcap:80, rsi:48, index:'NASDAQ100' },
  { sym:'CDNS', name:'Cadence Design', sector:'Technology', signal:'BUY', memo:'EDA + 시스템 설계 · AI 칩 설계 인프라', mcap:75, rsi:50, index:'NASDAQ100' },
  { sym:'LRCX', name:'Lam Research', sector:'Technology', signal:'BUY', memo:'MS OW PT $260(from $254) · Beat & Raise — JunQ $6.2bn 가이던스(Street $6.0bn 상회) · 5분기 연속 Street 추정치 9% 평균 초과 · DRAM 매출 분기 최고치 경신 · NAND 집약적 WFE 최대 수혜주(Evercore 탑픽) · 10% QoQ 성장 JunQ · Foundry/Logic +31% y/y', mcap:95, rsi:45, index:'NASDAQ100' },
  { sym:'KLAC', name:'KLA Corporation', sector:'Technology', signal:'BUY', memo:'반도체 검사/계측 장비 · 수율 관리 필수', mcap:85, rsi:48, index:'NASDAQ100' },
  { sym:'REGN', name:'Regeneron', sector:'Healthcare', signal:'HOLD', memo:'Eylea 안과 · Dupixent 면역 · 바이오 대형주', mcap:95, rsi:50, index:'NASDAQ100' },
  { sym:'VRTX', name:'Vertex Pharma', sector:'Healthcare', signal:'BUY', memo:'낭포성 섬유증 독점 · 유전자 치료 · 통증', mcap:115, rsi:52, index:'NASDAQ100' },
  { sym:'FTNT', name:'Fortinet', sector:'Technology', signal:'BUY', memo:'네트워크 보안 · SASE · AI 위협탐지', mcap:65, rsi:52, index:'NASDAQ100' },
  { sym:'MELI', name:'MercadoLibre', sector:'Technology', signal:'BUY', memo:'라틴아메리카 이커머스+핀테크 1위', mcap:100, rsi:55, index:'NASDAQ100' },
  { sym:'DDOG', name:'Datadog', sector:'Technology', signal:'BUY', memo:'클라우드 모니터링+옵저버빌리티 · AI 워크로드 추적', mcap:42, rsi:48, index:'NASDAQ100' },
  { sym:'SNOW', name:'Snowflake', sector:'Technology', signal:'WATCH', memo:'AI 투자 ROI 견조 — 문제해결 수일→10~15분 · AI 판매데모/고객지원/시스템 신뢰성 수익 확보 · 클라우드 데이터 웨어하우스', mcap:52, rsi:42, index:'NASDAQ100' },
  { sym:'ZS', name:'Zscaler', sector:'Technology', signal:'BUY', memo:'[WF 04/18] **OpenAI TAC 14개 초기 파트너 진입** — Glasswing(Anthropic)엔 제외됐으나 TAC 신규 포지션 확보 = AI 보안 대열 합류 재확인 · 제로트러스트+SASE+클라우드 보안 · 포스트양자 암호화 SASE 확장 가능 · AI 크롤/에이전트 트래픽 신규 가시성 · 14개 중 절반 금융기관(CSCO/CRWD/NVDA/ORCL/ZS)', mcap:30, rsi:45, index:'NASDAQ100' },
  { sym:'TTD', name:'The Trade Desk', sector:'Technology', signal:'HOLD', memo:'프로그래매틱 광고 · CTV · 리테일 미디어', mcap:40, rsi:40, index:'NASDAQ100' },
  { sym:'SMCI', name:'Super Micro Computer', sector:'Technology', signal:'WATCH', memo:'AI 서버 하드웨어 · 고성장 vs 회계 리스크', mcap:22, rsi:38, index:'NASDAQ100' },
  { sym:'IONQ', name:'IonQ', sector:'Technology', signal:'WATCH', memo:'양자컴퓨팅 상용화 · Forte Enterprise · 정부 계약', mcap:11, rsi:48, index:'NASDAQ100' },
  { sym:'RKLB', name:'Rocket Lab USA', sector:'Industrials', signal:'BUY', memo:'Neutron 중형 로켓 · 소형위성 발사 1위', mcap:38, rsi:55, index:'NASDAQ100' },
  { sym:'ASTS', name:'AST SpaceMobile', sector:'Technology', signal:'WATCH', memo:'위성직접통신(D2D) 상용화 · BlueBird 위성', mcap:34, rsi:58, index:'NASDAQ100' },
  // ══════════════════════════════════════════════════════════════
  // Russell 2000 — 주요 소형주
  // ══════════════════════════════════════════════════════════════
  { sym:'RGTI', name:'Rigetti Computing', sector:'Technology', signal:'WATCH', memo:'양자컴퓨팅 · 초전도 큐빗 · 초기 단계', mcap:4, rsi:55, index:'RUSSELL2000' },
  { sym:'XNDU', name:'Xanadu Quantum', sector:'Technology', signal:'WATCH', memo:'[PhotonCap 04/12] 광자(photonic) 양자컴퓨팅 순수플레이 — Nature 3편(Borealis/Aurora/GKP) · SPAC 상장 EV $31B · 매출 $4.6M(초기) · 핵심 과제: optical loss 1/40 개선 필요(현재 56%→목표 <1%) · PennyLane 오픈소스 양자 SDK · CAD$390M 정부 지원 협상 중', mcap:28, rsi:50, index:'NASDAQ' },
  { sym:'AMKR', name:'Amkor Technology', sector:'Technology', signal:'WATCH', memo:'[Perplexity 04/09 #2] OSAT 선두 · $54.97 · PE 36.6x · EV/EBITDA 8.4x · FCF Yield 1.96% · Q4 EPS $0.69 vs est $0.43(+60% beat) · 첨단패키징(HDFO) 매출 2026 3배↑ · CapEx $2.5-3.0B 3배 증가=실행 리스크 · CHIPS Act $2.85B · Arizona 메가팹 · Vietnam 손익분기 달성 · PT $51.57(Buy) 현재가 상회 · D/E 0.33', mcap:14, rsi:42, index:'NASDAQ' },
  { sym:'PLAB', name:'Photronics', sector:'Technology', signal:'WATCH', memo:'[Perplexity 04/09 #1 최저밸류] 포토마스크 전문 · $44.09 · PE 18.8x(그룹 최저) · EV/EBITDA 4.2x · FCF Yield 4.33%(최고) · 부채 제로 · 현금비율 4.57 · 영업마진 22-26% 안정 · AI 패키징/High-NA EUV 마스크 수요↑ · ⚠CEO 내부자 매도 55K주(6개월) · 중국 샤먼 JV ~50% 지정학 리스크 · PT $43.50(Str Buy) 애널리스트 2명', mcap:3, rsi:48, index:'NASDAQ' },
  { sym:'ASX', name:'ASE Technology', sector:'Technology', signal:'WATCH', memo:'[Perplexity 04/09 #6] 세계 최대 OSAT · $24.28 · PE 44.2x(+147% 프리미엄) · EV/EBITDA 10.8x · FCF Yield -2.0% · D/E 0.75(그룹 최고) · 마진 압축 ~340bps · 미국 애널리스트 커버리지 없음 · 대만 지정학 리스크 · 고위험-고보상 첨단패키징 플레이', mcap:53, rsi:45, index:'NYSE' },
  { sym:'LUNR', name:'Intuitive Machines', sector:'Industrials', signal:'WATCH', memo:'달 착륙선 · NASA 계약 · 우주 인프라', mcap:5, rsi:60, index:'RUSSELL2000' },
  { sym:'SMR', name:'NuScale Power', sector:'Utilities', signal:'WATCH', memo:'소형모듈원전(SMR) · 최초 NRC 인증 · 상업화 준비', mcap:5, rsi:52, index:'RUSSELL2000' },
  { sym:'CLS', name:'Celestica', sector:'Technology', signal:'WATCH', memo:'[Perplexity 04/09 #4] AI서버/HW EMS · $319 · PE 44.5x(+181% 프리미엄) · EV/EBITDA 28.1x · FCF Yield 1.35% · 매출 YoY +30% · 애널리스트 업사이드 +15.9%(그룹 최고) · PT $369.89(Buy) · D/E 0.34 · Q2-Q3 마진 변동성 주의', mcap:37, rsi:55, index:'NYSE' },
  { sym:'FN', name:'Fabrinet', sector:'Technology', signal:'WATCH', memo:'[JPM 04/17: OW→N 하향 + Negative Catalyst Watch] PT$700(기존$530↑) · 단기 고객 램프업 불안정 + 신규 고객 가시성 제한 · 광학모듈/정밀제조 · PE 59.6x · FCF Yield -1.9% · Rowe Price +163% 포지션 · 광학 섹터 밸류에이션 쏠림(AI 프리미엄 +83%) · 2028년 이익 전제 필요', mcap:22, rsi:50, index:'NYSE' },
  { sym:'ONTO', name:'Onto Innovation', sector:'Technology', signal:'WATCH', memo:'[Perplexity 04/09 #5] 반도체 검사/계측 · $246 · GAAP PE 88.2x(Semilab 인수 왜곡, Non-GAAP ~35-40x) · FCF Yield 3.64% · 부채 제로 · 현금비율 5.79 · 백로그 $330M 역대 최고 · 중국 노출 최소 · PT $242.50(Str Buy) · High-NA EUV 검사 수요', mcap:12, rsi:48, index:'NASDAQ' },
  { sym:'AFRM', name:'Affirm Holdings', sector:'Financials', signal:'WATCH', memo:'BNPL(후불결제) · 소비자 대출 · 성장+리스크', mcap:15, rsi:45, index:'RUSSELL2000' },
  { sym:'SOFI', name:'SoFi Technologies', sector:'Financials', signal:'HOLD', memo:'포브스 2026 세계최고은행 미국 1위 · 디지털 뱅킹 · 대출+투자 · 가입자 성장', mcap:15, rsi:48, index:'RUSSELL2000' },
  { sym:'UPST', name:'Upstart Holdings', sector:'Financials', signal:'WATCH', memo:'AI 신용평가 · 대출 플랫폼 · 금리 민감', mcap:5, rsi:42, index:'RUSSELL2000' },
  { sym:'RIOT', name:'Riot Platforms', sector:'Financials', signal:'WATCH', memo:'비트코인 채굴 · BTC 가격 연동 · 에너지 집약', mcap:4, rsi:50, index:'RUSSELL2000' },
  { sym:'MARA', name:'Marathon Digital', sector:'Financials', signal:'WATCH', memo:'비트코인 채굴 대형주 · BTC 보유 전략', mcap:6, rsi:48, index:'RUSSELL2000' },
  { sym:'RDW', name:'Redwire', sector:'Industrials', signal:'WATCH', memo:'우주 인프라·위성 부품 · 3D 프린팅 우주', mcap:2, rsi:55, index:'RUSSELL2000' },
  { sym:'JOBY', name:'Joby Aviation', sector:'Industrials', signal:'WATCH', memo:'eVTOL 도심항공모빌리티 · FAA 인증 진행', mcap:6, rsi:48, index:'RUSSELL2000' },
  { sym:'DNA', name:'Ginkgo Bioworks', sector:'Healthcare', signal:'SELL', memo:'합성생물학 플랫폼 · 매출 부진 · 현금 소진', mcap:1, rsi:30, index:'RUSSELL2000' },
  { sym:'QUBT', name:'Quantum Computing', sector:'Technology', signal:'WATCH', memo:'양자컴퓨팅 · 광자 기반 · 초기 매출', mcap:2, rsi:55, index:'RUSSELL2000' },
  { sym:'CAVA', name:'CAVA Group', sector:'Consumer', signal:'BUY', memo:'지중해 패스트캐주얼 · 고성장 외식 체인 · 미국 확장', mcap:15, rsi:58, index:'RUSSELL2000' },
  { sym:'SOUN', name:'SoundHound AI', sector:'Technology', signal:'WATCH', memo:'음성 AI 플랫폼 · 자동차+레스토랑 · 고평가', mcap:5, rsi:50, index:'RUSSELL2000' },
  { sym:'CRWV', name:'CoreWeave', sector:'Technology', signal:'BUY', memo:'[DA Davidson PT$175↑ Mizuho PT$105 BofA PT$120] 프론티어 랩 독점 네오클라우드 — Meta $21B(신규 2032 Vera Rubin)+Meta $14B(기존)+OpenAI $22B+Anthropic 수십억 = 합산 $58B+ · NVIDIA 긴밀관계(공급+고객+투자자)=비NVDA 호스팅 차단 · 1Q26E 매출 $19.5B(+99%YoY), 경영진 가이던스 $19-20B · 2026 매출 $120-130B 가이던스 · 2025말 가격 +20% 인상 보고(WSJ) · DDTL 4.0 $85억 투자등급 SOFR+2.25% · 선순위채 $42.5억(9.75%) · Perplexity/Cline/HGX B300 GA · Flex Reservations+Spot 가격모델 · 1Q 활성전력 1,025MW(+150MW QoQ)', mcap:23, rsi:50, index:'NASDAQ100' },
  { sym:'NBIS', name:'Nebius Group', sector:'Technology', signal:'BUY', memo:'[GS PT $205↑, BofA PT $175↑] Meta $270억+MSFT 장기계약+NVDA $20억 전략투자 · 핀란드+앨라배마 DC 확장 · BofA 2027E EV/Sales 5.0x(피어 하단) · 글로벌 AI 인프라 핵심 공급자 입지', mcap:6, rsi:48, index:'NASDAQ100' },
  { sym:'IREN', name:'IREN Limited', sector:'Technology', signal:'BUY', memo:'[Cantor OW] MSFT 5년 $97억 Take-or-pay(76K GB300, 200MW) · Childress 750MW+Sweetwater 2GW+Oklahoma 1.6GW 전력 · BTC마이너→AI DC 전환 선도', mcap:4, rsi:48, index:'RUSSELL2000' },
  { sym:'CORZ', name:'Core Scientific', sector:'Technology', signal:'BUY', memo:'[Cantor Top Pick PT$29] AI DC 전환 선도 · CRWV 최초 딜 파트너(2024.06) · 딜 가치 기준 가장 큰 할인 거래 · DC 사상 최고 딜+선점 효과 · BTC마이너→AI 인프라', mcap:5, rsi:45, index:'NASDAQ' },
  { sym:'BIRD', name:'Allbirds', sector:'Consumer', signal:'SELL', memo:'친환경 신발 · 매출 감소 · 구조조정', mcap:0.1, rsi:28, index:'RUSSELL2000' },
  { sym:'DM', name:'Desktop Metal', sector:'Technology', signal:'WATCH', memo:'산업용 3D 프린팅 · 양산화 도전', mcap:0.5, rsi:35, index:'RUSSELL2000' },
  // ══════════════════════════════════════════════════════════════
  // HOT / 트렌딩 / 주도주 — 시가총액 무관, 시장 관심도 높은 종목
  // ══════════════════════════════════════════════════════════════
  // ── AI / 광학 / 데이터센터 인프라 ──
  { sym:'AAOI', name:'Applied Optoelectronics', sector:'Technology', signal:'WATCH', memo:'[시트론 공매도 04/11] 선행PER 112x(NVDA 버블정점40x의 3배) · GM 31%(NVDA 75%대비) · 앵커 ORCL(재무취약) vs LITE 앵커 NVDA · 범용HW마진에 독점배수 · 이노라이트 가격인하 리스크 · 2주전 $85→$140 급등', mcap:2.5, rsi:62, index:'RUSSELL2000' },
  { sym:'COHR', name:'Coherent Corp', sector:'Technology', signal:'BUY', memo:'L1 scale-out 핵심 · NVIDIA $2B 투자(2026.03) · SiPh+레이저 양대산맥 · 6인치 InP 기판 자체생산(CHIPS Act $33M) · 800G/1.6T CPO 모듈 · InP 수직통합 → supply chain 병목 해소 · OFC2026 CPO TAM $21B', mcap:15, rsi:55, index:'SP500' },
  { sym:'LITE', name:'Lumentum', sector:'Technology', signal:'BUY', memo:'InP EML/CW 레이저 왕 · 2028년까지 AI 주문 장부 가득(블룸버그 4/10) · 주가 1500%+ 상승에도 수요>공급 · NVDA 지원 · CPO 변곡점 2H26 · OCS 수주잔고 $400M+ · Scale-up CPO Rosa-Feynman 2028 · 스미토모 InP 7년 약정 · 미즈호 PT $930', mcap:6, rsi:48, index:'NASDAQ100' },
  { sym:'CRDO', name:'Credo Technology', sector:'Technology', signal:'BUY', memo:'[BofA PT$210↑(160→210)] DustPhotonics 인수 후속 — FY27 광학 run-rate $5억+(기존 $1억+ 대비 대폭상향), FY27 총매출 $2.3B(+75%YoY) 전망(컨센 $2B 대비 +$3억) · ZR광 트랜시버+광DSP+SiPho 수직통합 · GM 63-65%/OpM 50% 유지(일반 광학 25-30% 대비 큰 상승여력) · EPS 창출력 $10-11 (AI TAM $96B 5% 점유) · CRDO CY27E PE 23배 vs 광학동종 40-50배 · AEC 800G(FY26-27) 1.6T(FY27-28) · AMZN/MSFT/xAI/META 지속 · 2029E AEC TAM $10B+', mcap:10, rsi:45, index:'NASDAQ100' },
  { sym:'POET', name:'POET Technologies', sector:'Technology', signal:'WATCH', memo:'광인터포저(Teralight) · 포토닉스 반도체화 · EML 4개(업계 8~16) · Luxshare/FIT/LITEON 파트너 · 1.6T 프로토 2026말 · Celestial AI(MRVL 인수) Photonic Fabric 핵심부품 공급 가능성 · NVIDIA 광학 supply chain 빈칸 후보 · 프리레버뉴 · 현금 $450M(시총57%)', mcap:0.8, rsi:44, index:'OTC' },
  { sym:'CIEN', name:'Ciena', sector:'Technology', signal:'BUY', memo:'광네트워킹 장비 · AI 트래픽 증가 수혜', mcap:9, rsi:52, index:'SP500' },
  { sym:'GLW', name:'Corning', sector:'Technology', signal:'WATCH', memo:'[JPM 04/17: OW→N 하향] PT$175(기존$115↑ but 밸류에이션 우려) · NTM PE 50배+, 2027E 40배+ = 펀더멘털보다 앞서감 · AI 광학 섹터 프리미엄 과거 평균 대비 +83% · 광섬유 · AI DC 광케이블 수요 폭증 · Gorilla Glass · 펀더멘털 강세 유지되나 2028년 이익 봐야 밸류에이션 정당화', mcap:40, rsi:55, index:'SP500' },
  { sym:'VRT', name:'Vertiv Holdings', sector:'Industrials', signal:'BUY', memo:'DC 냉각/전력 인프라 · AI 전력 수요 수혜 · GPU TDP H100=700W→Vera Rubin=2300W · 랙 120kW→600kW→1MW · 800V DC 전환 수혜', mcap:42, rsi:48, index:'SP500' },
  { sym:'DELL', name:'Dell Technologies', sector:'Technology', signal:'BUY', memo:'[JPM 04/17] PT$205(기존$165↑) · FY27 EPS 가이던스 +25% 대비 +27% 성장 전망 · AI 서버 상방 + 메모리 비용 전가 실행력 · EMS/IT HW 섹터 중 최선호 · 엔터프라이즈 AI 인프라 · AI 서버 판매 급증', mcap:80, rsi:45, index:'SP500' },
  { sym:'HPE', name:'Hewlett Packard Enterprise', sector:'Technology', signal:'HOLD', memo:'AI 서버/네트워킹 · Juniper 인수 · 하이브리드 클라우드', mcap:28, rsi:48, index:'SP500' },
  // ── 헬스케어 / 비만치료 / 텔레헬스 ──
  { sym:'HIMS', name:'Hims & Hers Health', sector:'Healthcare', signal:'BUY', memo:'텔레헬스 · GLP-1 비만치료 · D2C 헬스케어 급성장', mcap:8, rsi:65, index:'RUSSELL2000' },
  { sym:'AEHR', name:'Aehr Test Systems', sector:'Technology', signal:'WATCH', memo:'SiC 반도체 테스트 장비 · EV/전력 수요', mcap:1, rsi:38, index:'RUSSELL2000' },
  { sym:'VIAV', name:'Viavi Solutions', sector:'Technology', signal:'HOLD', memo:'네트워크 테스트/측정 · 광통신 · 5G 인프라', mcap:2.5, rsi:42, index:'RUSSELL2000' },
  // ── 소셜미디어 / 플랫폼 / 미디어 ──
  { sym:'RDDT', name:'Reddit', sector:'Communication Services', signal:'BUY', memo:'소셜미디어 IPO · AI 데이터 라이선싱 · 광고 성장', mcap:25, rsi:58, index:'SP500' },
  { sym:'PINS', name:'Pinterest', sector:'Communication Services', signal:'HOLD', memo:'비주얼 검색 · 쇼핑 통합 · 광고 수익 성장', mcap:20, rsi:48, index:'SP500' },
  { sym:'SNAP', name:'Snap Inc', sector:'Communication Services', signal:'WATCH', memo:'Snapchat · AR 글래스 · 젊은 사용자층', mcap:18, rsi:42, index:'SP500' },
  { sym:'RBLX', name:'Roblox', sector:'Communication Services', signal:'HOLD', memo:'메타버스 게임 플랫폼 · 10대 사용자 · 수익화 진행', mcap:32, rsi:50, index:'SP500' },
  { sym:'SPOT', name:'Spotify', sector:'Communication Services', signal:'BUY', memo:'음악 스트리밍 1위 · 구독자 6억+ · 마진 개선', mcap:85, rsi:55, index:'SP500' },
  // ── AI 인프라 / 소프트웨어 ──
  { sym:'TEM', name:'Tempus AI', sector:'Healthcare', signal:'BUY', memo:'AI 기반 정밀의료 · 유전체 분석 · 데이터 플랫폼', mcap:10, rsi:60, index:'NASDAQ100' },
  { sym:'AI', name:'C3.ai', sector:'Technology', signal:'WATCH', memo:'엔터프라이즈 AI 플랫폼 · 정부/국방 계약 · 수익성 의문', mcap:4, rsi:45, index:'NASDAQ100' },
  { sym:'PATH', name:'UiPath', sector:'Technology', signal:'HOLD', memo:'RPA(로봇 프로세스 자동화) · AI Agent 통합', mcap:8, rsi:42, index:'SP500' },
  { sym:'CFLT', name:'Confluent', sector:'Technology', signal:'HOLD', memo:'데이터 스트리밍 · Apache Kafka · 실시간 AI 파이프라인', mcap:8, rsi:45, index:'NASDAQ100' },
  { sym:'CRSP', name:'CRISPR Therapeutics', sector:'Healthcare', signal:'WATCH', memo:'유전자 가위 치료 · Casgevy FDA 승인 · 겸상적혈구', mcap:4, rsi:40, index:'NASDAQ100' },
  { sym:'NET', name:'Cloudflare', sector:'Technology', signal:'BUY', memo:'[Mizuho PT$235 (255→235↓)] 4Q 매출 +33.5%YoY(컨센 29%대비 +3.9%pt 초과달성) · 채널매출 비중 22%→29% · 1Q26E 매출 $621M(+29.5%YoY), OpM 11.4% · 2026 가이던스 $27.85-27.95B(+28~29%YoY) · 1Q 트래픽 +73%YoY · 마스터카드/센티넬원 통합/x402(코인베이스 Base 9,700만건+Stripe) · 포스트양자 SASE 최초 · Anthropic Claude 매니지드 에이전트 출시 후 -13% IGV언더 but Workers AI 직접경쟁 제한적 · EV/매출 26/27E 31x/24x · Dynamic Workers 오픈베타', mcap:38, rsi:52, index:'SP500' },
  { sym:'MDB', name:'MongoDB', sector:'Technology', signal:'HOLD', memo:'NoSQL 데이터베이스 · AI 워크로드 · 클라우드 전환', mcap:18, rsi:40, index:'NASDAQ100' },
  { sym:'GTLB', name:'GitLab', sector:'Technology', signal:'HOLD', memo:'DevSecOps 플랫폼 · AI 코드 어시스턴트 · 코딩 자동화', mcap:8, rsi:45, index:'NASDAQ100' },
  { sym:'ESTC', name:'Elastic', sector:'Technology', signal:'HOLD', memo:'검색/옵저버빌리티 · AI 기반 보안분석 · Elasticsearch', mcap:10, rsi:48, index:'SP500' },
  // ── 핀테크 / 결제 / 크립토 ──
  { sym:'HOOD', name:'Robinhood', sector:'Financials', signal:'BUY', memo:'무수수료 트레이딩 · 크립토 · 골드카드 · 젊은 투자자', mcap:35, rsi:58, index:'NASDAQ100' },
  { sym:'SQ', name:'Block Inc (SQ)', sector:'Financials', signal:'HOLD', memo:'Square 결제 · Cash App · 비트코인 전략', mcap:36, rsi:45, index:'SP500' },
  { sym:'MSTR', name:'MicroStrategy', sector:'Technology', signal:'WATCH', memo:'[Bernstein 04/10] PT $450 — BTC 최대 보유 상장사 · 양자컴퓨팅 리스크: Google CRQC 논문(큐빗 1K+게이트 20M=2017년 대비 5000배↓) · P2PK 취약주소 690만개(사토시 포함) · 공격 성공률 41%(9분 vs 블록 10분) · 포스트-양자 암호 업그레이드 속도가 핵심 변수', mcap:65, rsi:55, index:'NASDAQ100' },
  // ── 전력 / 에너지 / 원전 ──
  { sym:'NRG', name:'NRG Energy', sector:'Utilities', signal:'BUY', memo:'AI 데이터센터 PPA 직접계약 · 천연가스+재생에너지 · Rate Base 확대', mcap:22, rsi:52, index:'SP500' },
  { sym:'CCJ', name:'Cameco', sector:'Energy', signal:'BUY', memo:'우라늄 생산 세계 2위 · 원전 르네상스 수혜', mcap:25, rsi:55, index:'SP500' },
  { sym:'OKLO', name:'Oklo Inc', sector:'Utilities', signal:'WATCH', memo:'소형원전(SMR) · Sam Altman 투자 · AI 전력', mcap:4, rsi:58, index:'RUSSELL2000' },
  { sym:'TLN', name:'Talen Energy', sector:'Utilities', signal:'BUY', memo:'원전+천연가스 · AI 데이터센터 PPA · Rate Base 확대 · 리스트럭처링', mcap:12, rsi:52, index:'SP500' },
  // ── 자동차 / 모빌리티 ──
  { sym:'RIVN', name:'Rivian Automotive', sector:'Consumer', signal:'WATCH', memo:'EV 픽업/SUV · 아마존 배송 밴 · 현금 소진 우려', mcap:15, rsi:38, index:'NASDAQ100' },
  { sym:'LCID', name:'Lucid Group', sector:'Consumer', signal:'WATCH', memo:'럭셔리 EV · 사우디 투자 · 생산 램프업 느림', mcap:7, rsi:35, index:'NASDAQ100' },
  { sym:'GM', name:'General Motors', sector:'Consumer', signal:'HOLD', memo:'EV 전환 + ICE 수익 · Cruise 자율주행 · 밸류에이션 매력', mcap:48, rsi:45, index:'SP500' },
  { sym:'F', name:'Ford Motor', sector:'Consumer', signal:'HOLD', memo:'F-150 Lightning · EV 투자 + 트럭 수익 · 고배당', mcap:42, rsi:42, index:'SP500' },
  // ── 우주 / 방산 확장 ──
  { sym:'PL', name:'Planet Labs', sector:'Technology', signal:'WATCH', memo:'위성 이미지 · 지구 관측 · AI 분석', mcap:2, rsi:45, index:'RUSSELL2000' },
  // SPCE removed — Virgin Galactic defunct, replaced by LUNR/RDW (already in DB above)
  // ── 게임 / 엔터테인먼트 ──
  { sym:'EA', name:'Electronic Arts', sector:'Communication Services', signal:'HOLD', memo:'FIFA/EA Sports · 모바일 게임 · 라이브 서비스', mcap:38, rsi:48, index:'SP500' },
  { sym:'TTWO', name:'Take-Two Interactive', sector:'Communication Services', signal:'HOLD', memo:'GTA 6 2025 출시 · Rockstar · NBA 2K', mcap:28, rsi:50, index:'SP500' },
  // ── 소비재 / 리테일 / 라이프스타일 ──
  { sym:'LULU', name:'Lululemon', sector:'Consumer', signal:'HOLD', memo:'애슬레저 · 프리미엄 브랜드 · 국제 확장', mcap:35, rsi:42, index:'SP500' },
  { sym:'DECK', name:'Deckers Outdoor', sector:'Consumer', signal:'BUY', memo:'HOKA 러닝화 · UGG · 초고성장 브랜드', mcap:25, rsi:58, index:'SP500' },
  { sym:'CELH', name:'Celsius Holdings', sector:'Consumer Defensive', signal:'BUY', memo:'기능성 에너지 음료 · 몬스터 대항마 · 고성장', mcap:8, rsi:48, index:'NASDAQ100' },
  { sym:'ONON', name:'On Holding', sector:'Consumer', signal:'BUY', memo:'스위스 러닝화 브랜드 · 로저 페더러 · 고성장', mcap:15, rsi:55, index:'SP500' },
  // ── 방어적 배당 / 인프라 ──
  { sym:'TRGP', name:'Targa Resources', sector:'Energy', signal:'HOLD', memo:'천연가스 수집/처리 · 배당 성장 · 인프라', mcap:35, rsi:55, index:'SP500' },
  { sym:'WMB', name:'Williams Companies', sector:'Energy', signal:'BUY', memo:'[Citi 04/09] BTM 배후미터 2GW·$70억+ 승인 · Socrates 10년계약 · 추가6GW 장비확보($200억+ capex잠재력) · capex/EBITDA 5배(10년계약기준) · 2026 EBITDA 50%+ 잠재 증분', mcap:55, rsi:52, index:'SP500' },
  { sym:'SEI', name:'Solaris Energy Infrastructure', sector:'Energy', signal:'BUY', memo:'[Citi 04/09] 현장 발전 테마 BUY 유지 · IG등급 기술기업과 10년+5년옵션 계약 체결 · 오프그리드 DC 천연가스 현장발전 전문 · 2030년 업계 20GW 목표 수혜', mcap:600, rsi:55, index:'SP500' },
  { sym:'LBRT', name:'Liberty Energy', sector:'Energy', signal:'BUY', memo:'[Citi 04/09] 현장 발전 테마 BUY 유지 · AI Capex 경쟁 지속→현장발전 수요↑ · 아일랜드모드 운영으로 가정용 전기요금 상승 압력 완화 매력 · 장기 계약 구조 확대', mcap:2.8, rsi:52, index:'SP500' },
  { sym:'KMI', name:'Kinder Morgan', sector:'Energy', signal:'HOLD', memo:'천연가스 인프라 · 배당 3.5%+ · 파이프라인', mcap:50, rsi:50, index:'SP500' },
  // ── 산업재 / 건설 / 광업 ──
  { sym:'URI', name:'United Rentals', sector:'Industrials', signal:'BUY', memo:'장비 렌탈 1위 · 인프라 투자 수혜 · 데이터센터 건설', mcap:55, rsi:52, index:'SP500' },
  { sym:'FCX', name:'Freeport-McMoRan', sector:'Materials', signal:'BUY', memo:'구리 생산 세계 최대 · AI/EV 구리 수요 폭증', mcap:60, rsi:50, index:'SP500' },
  { sym:'NUE', name:'Nucor', sector:'Materials', signal:'HOLD', memo:'미국 최대 철강사 · 인프라 수혜 · 주주환원', mcap:35, rsi:48, index:'SP500' },
  // ── 기타 주목 종목 ──
  { sym:'SHOP', name:'Shopify', sector:'Technology', signal:'BUY', memo:'이커머스 플랫폼 · AI 도구 · SMB 성장 엔진', mcap:110, rsi:52, index:'SP500' },
  { sym:'ABNB', name:'Airbnb', sector:'Consumer', signal:'HOLD', memo:'숙박 플랫폼 · 체험 확대 · 여행 수요 안정', mcap:80, rsi:48, index:'SP500' },
  { sym:'DASH', name:'DoorDash', sector:'Technology', signal:'HOLD', memo:'음식 배달 1위 · 식료품/리테일 확장 · 흑자 전환', mcap:62, rsi:50, index:'SP500' },
  { sym:'ROKU', name:'Roku', sector:'Communication Services', signal:'WATCH', memo:'CTV 스트리밍 OS · 광고 수익 · 경쟁 심화', mcap:10, rsi:42, index:'NASDAQ100' },
  { sym:'DUOL', name:'Duolingo', sector:'Technology', signal:'BUY', memo:'AI 기반 언어 학습 · 구독자 급증 · Ed-tech 리더', mcap:12, rsi:55, index:'NASDAQ100' },
  { sym:'APP', name:'AppLovin', sector:'Technology', signal:'BUY', memo:'모바일 광고/앱 플랫폼 · AI 기반 광고 최적화 · 고성장', mcap:95, rsi:58, index:'SP500' },
  { sym:'AXON', name:'Axon Enterprise', sector:'Industrials', signal:'BUY', memo:'테이저/바디캠 · AI 기반 공공안전 플랫폼 · 정부 계약', mcap:45, rsi:60, index:'SP500' },
  { sym:'WDAY', name:'Workday', sector:'Technology', signal:'HOLD', memo:'클라우드 HCM/재무 · AI 코파일럿 · 엔터프라이즈', mcap:62, rsi:42, index:'SP500' },
  { sym:'MNDY', name:'Monday.com', sector:'Technology', signal:'BUY', memo:'업무 관리 SaaS · AI 어시스턴트 · 기업 확장', mcap:12, rsi:52, index:'NASDAQ100' },
  { sym:'BKNG', name:'Booking Holdings', sector:'Consumer', signal:'HOLD', memo:'온라인 여행 예약 글로벌 1위 · 총예약액(GBV) $160B+ · AI 기반 여행 에이전트 구축 · 유럽 비중 높아 EUR 강세 수혜 · 커넥티드 트립 전략 · 매출 성장 +12% YoY · PER 28x', mcap:155, rsi:52, index:'SP500' },
  { sym:'TOST', name:'Toast', sector:'Technology', signal:'BUY', memo:'레스토랑 POS/결제 · SaaS · 외식업 디지털화', mcap:18, rsi:55, index:'SP500' },
  { sym:'GRAB', name:'Grab Holdings', sector:'Technology', signal:'WATCH', memo:'동남아 슈퍼앱 · 라이드/배달/핀테크 · 흑자 전환', mcap:15, rsi:45, index:'NASDAQ100' },
  { sym:'SE', name:'Sea Limited', sector:'Technology', signal:'HOLD', memo:'동남아 이커머스(Shopee) · 게임(Garena) · 핀테크', mcap:35, rsi:48, index:'SP500' },
  { sym:'NU', name:'Nu Holdings', sector:'Financials', signal:'BUY', memo:'브라질 디지털 뱅킹 · 1억+ 고객 · 라틴아메리카 핀테크', mcap:55, rsi:55, index:'SP500' },
  { sym:'PYPL', name:'PayPal', sector:'Financials', signal:'HOLD', memo:'온라인 결제 · Venmo · 가치주 전환 · AI 체크아웃', mcap:68, rsi:45, index:'SP500' },
  { sym:'GME', name:'GameStop', sector:'Consumer', signal:'WATCH', memo:'밈주식 · 게임 리테일 · BTC 투자 · 소셜 트레이딩', mcap:12, rsi:48, index:'RUSSELL2000' },
  { sym:'AMC', name:'AMC Entertainment', sector:'Communication Services', signal:'WATCH', memo:'극장 체인 · 밈주식 · 부채 리스크', mcap:2, rsi:35, index:'RUSSELL2000' },
  { sym:'PLBY', name:'PLBY Group', sector:'Consumer', signal:'SELL', memo:'라이프스타일 브랜드 · 구조조정 · 매출 감소', mcap:0.1, rsi:25, index:'RUSSELL2000' },
  { sym:'IWM', name:'iShares Russell 2000 ETF', sector:'Financials', signal:'HOLD', memo:'Russell 2000 추종 ETF · 소형주 벤치마크', mcap:60, rsi:45, index:'RUSSELL2000' },
  { sym:'DIA', name:'SPDR Dow Jones ETF', sector:'Financials', signal:'HOLD', memo:'다우존스 30 추종 ETF · 대형 가치주 벤치마크', mcap:35, rsi:50, index:'DOW30' },
  { sym:'BRK-B', name:'Berkshire Hathaway B', sector:'Financials', signal:'HOLD', memo:'BRK.B와 동일(B주) · 워런 버핏 → Greg Abel 후계 · 현금 $373B · 상세 분석은 BRK.B 참조', mcap:1072, rsi:55, index:'SP500' },
  { sym:'ABT', name:'Abbott Laboratories', sector:'Healthcare', signal:'HOLD', memo:'의약품+진단기기 · 신흥국 성장 · 배당', mcap:280, rsi:52, index:'SP500' },
  { sym:'PM', name:'Philip Morris', sector:'Consumer Defensive', signal:'HOLD', memo:'가열식 담배(IQOS) 전환 가속 · ZYN 니코틴 파우치 미국 시장 폭발적 성장 · Swedish Match 인수 시너지 · 전통 담배 감소→RRP 성장으로 상쇄 · 배당 5%+ · 방어주 매력 · PER 20x', mcap:165, rsi:56, index:'SP500' },
  { sym:'PGR', name:'Progressive Corp', sector:'Financials', signal:'BUY', memo:'자동차 보험 · 수익성 개선 · AI 손해사정', mcap:175, rsi:57, index:'SP500' },
  { sym:'UNP', name:'Union Pacific', sector:'Industrials', signal:'HOLD', memo:'미국 서부 철도 독점(듀오폴리 CSX와) · 인터모달+벌크 운송 · 정밀 스케줄링(PSR) 효율화 · 리쇼어링+제조업 회복 수혜 · 배당 2%+ · 경기 민감주 · PER 24x', mcap:195, rsi:55, index:'SP500' },
  { sym:'TJX', name:'TJX Companies', sector:'Consumer', signal:'HOLD', memo:'T.J. Maxx · 이월 상품 · 인플레 방어', mcap:115, rsi:52, index:'SP500' },
  { sym:'C', name:'Citigroup', sector:'Financials', signal:'HOLD', memo:'글로벌 IB · Jane Fraser CEO 구조조정 3년차 · 비핵심 사업 매각(멕시코 Banamex) · 비용효율화 목표 · 글로벌 트레이딩+크로스보더 강점 · PER 9x(섹터 최저 수준)', mcap:165, rsi:48, index:'SP500' },
  { sym:'SCHW', name:'Charles Schwab', sector:'Financials', signal:'HOLD', memo:'증권 플랫폼 · 자산 운용 · 금리 민감', mcap:195, rsi:52, index:'SP500' },
  { sym:'ADP', name:'Automatic Data Processing', sector:'Technology', signal:'HOLD', memo:'급여관리 SaaS · HCM 플랫폼 · 안정 성장', mcap:278, rsi:54, index:'SP500' },
  { sym:'BMY', name:'Bristol Myers Squibb', sector:'Healthcare', signal:'HOLD', memo:'제약회사 · 면역 질환 · 앞으로 배당', mcap:115, rsi:48, index:'SP500' },
  { sym:'PLD', name:'Prologis', sector:'Real Estate', signal:'HOLD', memo:'물류 부동산 REIT · e-commerce 수혜 · 배당', mcap:95, rsi:50, index:'SP500' },
  { sym:'BSX', name:'Boston Scientific', sector:'Healthcare', signal:'HOLD', memo:'의료 기기 · 심장 스텐트 · 신흥국 성장', mcap:95, rsi:52, index:'SP500' },
  { sym:'ADI', name:'Analog Devices', sector:'Technology', signal:'BUY', memo:'Citi CW · 아날로그 칩 · 산업용 IoT · AI 센서 · 아날로그 가격 +10~15% 상승사이클 진입(수급 타이트)', mcap:155, rsi:50, index:'SP500' },
  { sym:'MDLZ', name:'Mondelez', sector:'Consumer Defensive', signal:'HOLD', memo:'과자 · Oreo · 글로벌 소비재 · 배당', mcap:145, rsi:54, index:'SP500' },
  { sym:'CI', name:'Cigna Group', sector:'Healthcare', signal:'HOLD', memo:'헬스케어 보험 · Express Scripts · 규제', mcap:105, rsi:45, index:'SP500' },
  { sym:'SYK', name:'Stryker Corp', sector:'Healthcare', signal:'BUY', memo:'의료 기기 글로벌 1위급 · 정형외과(무릎/고관절)+수술 내비게이션 Mako 로봇 · 인구 고령화 구조적 수혜 · M&A 성장 전략 · 매출 +10% 안정 성장 · PER 35x', mcap:155, rsi:55, index:'SP500' },
  { sym:'WM', name:'Waste Management', sector:'Utilities', signal:'HOLD', memo:'폐기물 관리 · 재활용 · 배당', mcap:90, rsi:52, index:'SP500' },
  { sym:'DUK', name:'Duke Energy', sector:'Utilities', signal:'HOLD', memo:'전력회사 · 원전 · 배당 · 인상', mcap:85, rsi:50, index:'SP500' },
  { sym:'CME', name:'CME Group', sector:'Financials', signal:'BUY', memo:'선물 거래소 · 암호화폐 선물 · 글로벌 시장', mcap:78, rsi:55, index:'SP500' },
  { sym:'EOG', name:'EOG Resources', sector:'Energy', signal:'BUY', memo:'석유/가스 · 셰일 오일 · 배당 매력', mcap:95, rsi:58, index:'SP500' },
  { sym:'AON', name:'Aon', sector:'Financials', signal:'HOLD', memo:'보험 브로커 · 위험관리 · 인수합병', mcap:82, rsi:52, index:'SP500' },
  { sym:'CL', name:'Colgate-Palmolive', sector:'Consumer Defensive', signal:'HOLD', memo:'치약 · 구강관리 · 글로벌 배당', mcap:85, rsi:54, index:'SP500' },
  { sym:'ICE', name:'Intercontinental Exchange', sector:'Financials', signal:'BUY', memo:'거래소 · NYSE · 암호 선물 성장', mcap:85, rsi:54, index:'SP500' },
  { sym:'MSI', name:'Motorola Solutions', sector:'Technology', signal:'BUY', memo:'무선통신 · 공공안전 · AI 기반 분석', mcap:65, rsi:56, index:'SP500' },
  { sym:'APH', name:'Amphenol', sector:'Technology', signal:'BUY', memo:'[JPM 04/17 AFL 2위] PT$190(기존$185↑) · 커버리지 내 커넥터/인터커넥트 최선호 · DC 및 비DC 호조 + Nvidia VeraRubin 수주잔고 견조 · 구리 인터커넥트 = 광(Optical)과 공존(대체 아님) · 광↔구리 로테이션 논란 속 구리 측 최대 수혜 · 견조한 1Q 상방 서프라이즈 예상', mcap:120, rsi:55, index:'NASDAQ100' },
  { sym:'NSC', name:'Norfolk Southern', sector:'Industrials', signal:'HOLD', memo:'철도 운송 · 인프라 수혜 · 배당', mcap:58, rsi:52, index:'SP500' },
  { sym:'CTAS', name:'Cintas', sector:'Industrials', signal:'BUY', memo:'제복 임차 · 위생용품 · 높은 성장', mcap:75, rsi:58, index:'SP500' },
  { sym:'ORLY', name:'O\'Reilly Automotive', sector:'Consumer', signal:'HOLD', memo:'자동차 부품 · 애프터마켓 · 배당', mcap:70, rsi:50, index:'SP500' },
  { sym:'AZO', name:'AutoZone', sector:'Consumer', signal:'HOLD', memo:'자동차 부품 · 독립점 지원 · 높은 배당', mcap:68, rsi:48, index:'SP500' },
  { sym:'MCK', name:'McKesson', sector:'Healthcare', signal:'HOLD', memo:'의약품 배급 · 헬스케어 공급망', mcap:95, rsi:54, index:'SP500' },
  { sym:'MCO', name:'Moody\'s', sector:'Financials', signal:'HOLD', memo:'신용등급 기관 · 채권 평가 · 높은 마진', mcap:75, rsi:55, index:'SP500' },
  { sym:'MAR', name:'Marriott International', sector:'Consumer', signal:'HOLD', memo:'호텔 체인 · 여행 수요 · 배당 재개', mcap:75, rsi:52, index:'SP500' },
  { sym:'MMC', name:'Marsh McLennan', sector:'Financials', signal:'HOLD', memo:'보험 브로커 · 위험관리 · M&A 성장', mcap:85, rsi:54, index:'SP500' },
  { sym:'AIG', name:'American International Group', sector:'Financials', signal:'HOLD', memo:'보험 · 손해보험 · 수익성 개선', mcap:78, rsi:50, index:'SP500' },
  { sym:'SHW', name:'Sherwin-Williams', sector:'Materials', signal:'HOLD', memo:'도료 · 건설 경기 민감 · 주택 수요', mcap:65, rsi:48, index:'SP500' },
  { sym:'FI', name:'Fastenal', sector:'Industrials', signal:'HOLD', memo:'산업용 물품 · 배급 네트워크 · 배당', mcap:35, rsi:52, index:'SP500' },
  { sym:'SPG', name:'Simon Property Group', sector:'Real Estate', signal:'HOLD', memo:'쇼핑몰 REIT · 구조 조정 · 배당', mcap:45, rsi:48, index:'SP500' },
  { sym:'WELL', name:'Welltower', sector:'Real Estate', signal:'HOLD', memo:'의료 부동산 REIT · 고령화 수혜 · 배당', mcap:65, rsi:52, index:'SP500' },
  { sym:'AFL', name:'Aflac', sector:'Financials', signal:'HOLD', memo:'보충 보험 · 일본/미국 · 배당', mcap:45, rsi:54, index:'SP500' },
  { sym:'ECL', name:'Ecolab', sector:'Industrials', signal:'HOLD', memo:'산업용 화학 · 위생/급식 · 배당 성장', mcap:72, rsi:50, index:'SP500' },
  { sym:'MET', name:'MetLife', sector:'Financials', signal:'HOLD', memo:'생명보험 · 연금 · 구조조정 진행', mcap:95, rsi:50, index:'SP500' },
  { sym:'PRU', name:'Prudential Financial', sector:'Financials', signal:'HOLD', memo:'생명/일반 보험 · 연금 · 배당', mcap:70, rsi:48, index:'SP500' },
  { sym:'TROW', name:'T. Rowe Price', sector:'Financials', signal:'HOLD', memo:'자산운용 · 뮤추얼펀드 · 배당', mcap:45, rsi:52, index:'SP500' },
  { sym:'TGT', name:'Target', sector:'Consumer', signal:'HOLD', memo:'백화점 · e-commerce 성장 · 배당', mcap:65, rsi:48, index:'SP500' },
  { sym:'EBAY', name:'eBay', sector:'Consumer', signal:'HOLD', memo:'온라인 경매 · 헬스케어 확장 · 배당', mcap:48, rsi:50, index:'SP500' },
  { sym:'PCAR', name:'PACCAR Inc', sector:'Industrials', signal:'BUY', memo:'트럭 제조 · Peterbilt · 배당', mcap:55, rsi:56, index:'SP500' },
  { sym:'DD', name:'DuPont de Nemours', sector:'Materials', signal:'HOLD', memo:'화학 · 반도체 소재 · 배당', mcap:72, rsi:50, index:'SP500' },
  { sym:'HCA', name:'HCA Healthcare', sector:'Healthcare', signal:'HOLD', memo:'병원 체인 · 높은 마진 · 구매 자산', mcap:72, rsi:52, index:'SP500' },
  { sym:'ROP', name:'Roper Technologies', sector:'Industrials', signal:'BUY', memo:'산업용 소프트웨어 · 높은 배당 · M&A 전략', mcap:75, rsi:56, index:'SP500' },
  { sym:'DHR', name:'Danaher', sector:'Industrials', signal:'BUY', memo:'과학 장비 · Life Sciences · 배당', mcap:195, rsi:54, index:'SP500' },
  { sym:'A', name:'Avantor', sector:'Healthcare', signal:'HOLD', memo:'생명과학 장비·시약·소모품 · 연구용 화학제품', mcap:18, rsi:45, index:'SP500' },
  { sym:'CMG', name:'Chipotle Mexican Grill', sector:'Consumer', signal:'HOLD', memo:'멕시코 음식 · 위생 기준 · 성장 정체', mcap:75, rsi:50, index:'SP500' },
  { sym:'CARR', name:'Carrier Global', sector:'Industrials', signal:'HOLD', memo:'냉난방 · 건설 수혜 · 배당', mcap:62, rsi:54, index:'SP500' },
  { sym:'MNST', name:'Monster Beverage', sector:'Consumer Defensive', signal:'BUY', memo:'에너지 음료 · 고성장 · 해외 확장', mcap:52, rsi:52, index:'SP500' },
  { sym:'PSA', name:'Public Storage', sector:'Real Estate', signal:'HOLD', memo:'보관 창고 REIT · 소비자 저축 · 배당', mcap:62, rsi:50, index:'SP500' },
  { sym:'KHC', name:'Kraft Heinz', sector:'Consumer Defensive', signal:'HOLD', memo:'식품 · 저가 일용소비재 · 구조조정', mcap:48, rsi:48, index:'SP500' },
  { sym:'AEP', name:'American Electric Power', sector:'Utilities', signal:'HOLD', memo:'전력회사 · 재생에너지 · 배당 성장', mcap:82, rsi:50, index:'SP500' },
  { sym:'O', name:'Realty Income', sector:'Real Estate', signal:'HOLD', memo:'상업용 REIT · 월배당 · 안정 수익', mcap:68, rsi:52, index:'SP500' },
  { sym:'SRE', name:'Sempra Energy', sector:'Utilities', signal:'HOLD', memo:'전력·가스 · 캘리포니아 · 배당 성장', mcap:65, rsi:50, index:'SP500' },
  { sym:'EXC', name:'Exelon', sector:'Utilities', signal:'HOLD', memo:'전력회사 · 원전 · 배당', mcap:68, rsi:48, index:'SP500' },
  { sym:'WEC', name:'WEC Energy Group', sector:'Utilities', signal:'HOLD', memo:'전력·가스 · 위스콘신 · 배당 성장', mcap:45, rsi:50, index:'SP500' },
  { sym:'SYY', name:'Sysco', sector:'Consumer Defensive', signal:'HOLD', memo:'식품 배급 · 외식업 · 배당 · Jetro Restaurant Depot $290억 인수 발표(2026.03) 후 -6%', mcap:55, rsi:52, index:'SP500' },
  { sym:'YUM', name:'YUM! Brands', sector:'Consumer', signal:'HOLD', memo:'KFC/Taco Bell · 프랜차이즈 · 배당', mcap:95, rsi:54, index:'SP500' },
  { sym:'HUM', name:'Humana', sector:'Healthcare', signal:'HOLD', memo:'의료보험 · Medicare Advantage · 규제', mcap:52, rsi:45, index:'SP500' },
  { sym:'IDXX', name:'IDEXX Laboratories', sector:'Healthcare', signal:'BUY', memo:'동물 의료 · 진단기기 · 높은 성장', mcap:65, rsi:56, index:'SP500' },
  { sym:'PAYX', name:'Paychex', sector:'Technology', signal:'HOLD', memo:'급여관리 · HCM 플랫폼 · 배당 성장', mcap:65, rsi:54, index:'SP500' },
  { sym:'IQV', name:'IQVIA Holdings', sector:'Healthcare', signal:'HOLD', memo:'임상시험 · 의료 정보 · 배당', mcap:65, rsi:50, index:'SP500' },
  { sym:'BK', name:'The Bank of New York Mellon', sector:'Financials', signal:'HOLD', memo:'자산 보관 · 신탁 · 배당', mcap:55, rsi:52, index:'SP500' },
  { sym:'STZ', name:'Constellation Brands', sector:'Consumer Defensive', signal:'HOLD', memo:'맥주 · 와인 · Corona · 배당', mcap:52, rsi:48, index:'SP500' },
  { sym:'CNC', name:'Centene', sector:'Healthcare', signal:'HOLD', memo:'의료보험 · Medicaid · 규제', mcap:68, rsi:45, index:'SP500' },
  { sym:'NXPI', name:'NXP Semiconductors', sector:'Technology', signal:'BUY', memo:'반도체 · 자동차 칩 · 배당', mcap:95, rsi:54, index:'SP500' },
  { sym:'GPN', name:'Global Payments', sector:'Technology', signal:'HOLD', memo:'결제 처리 · 멀티채널 · 배당', mcap:75, rsi:50, index:'SP500' },
  { sym:'CTSH', name:'Cognizant', sector:'Technology', signal:'HOLD', memo:'IT 서비스 · BPO · 배당', mcap:68, rsi:45, index:'SP500' },
  { sym:'MSCI', name:'MSCI Inc', sector:'Financials', signal:'HOLD', memo:'인덱스 데이터 · 사모펀드 · 배당', mcap:65, rsi:52, index:'SP500' },
  { sym:'OTIS', name:'Otis Worldwide', sector:'Industrials', signal:'HOLD', memo:'엘리베이터 · 유지보수 · 배당', mcap:65, rsi:54, index:'SP500' },
  { sym:'KEYS', name:'Keysight Technologies', sector:'Technology', signal:'BUY', memo:'전자 측정 · 반도체 테스트 · 배당', mcap:75, rsi:54, index:'SP500' },
  { sym:'TDG', name:'Transdigm Group', sector:'Industrials', signal:'BUY', memo:'항공 부품 · 차별화 · 높은 마진', mcap:95, rsi:58, index:'SP500' },
  { sym:'STE', name:'Steris plc', sector:'Industrials', signal:'BUY', memo:'의료 멸균 · 생명과학 장비 · 배당', mcap:42, rsi:54, index:'SP500' },
  { sym:'COF', name:'Capital One', sector:'Financials', signal:'HOLD', memo:'신용카드 · 자동차 대출 · 배당', mcap:62, rsi:50, index:'SP500' },
  { sym:'RMD', name:'ResMed', sector:'Healthcare', signal:'HOLD', memo:'호흡기 장비 · 수면 무호흡 · 배당', mcap:48, rsi:48, index:'SP500' },
  { sym:'VRSK', name:'Verisk Analytics', sector:'Financials', signal:'BUY', memo:'보험 데이터 · AI 분석 · 배당', mcap:55, rsi:54, index:'SP500' },
  { sym:'EFX', name:'Equifax', sector:'Financials', signal:'HOLD', memo:'신용조회 · 빅데이터 · 배당', mcap:62, rsi:50, index:'SP500' },
  { sym:'HUBB', name:'Hubbell Inc', sector:'Industrials', signal:'HOLD', memo:'전기 제품 · 인프라 수혜 · 배당', mcap:55, rsi:54, index:'SP500' },

  // ═══ v33.1: 시총 $10B+ 전종목 + 핵심 ETF + 유명 소형주 (368개) ═══
  { sym:'GOOG', name:'Alphabet Class C', sector:'Technology', signal:'BUY', memo:'GOOGL과 동일 사업(의결권 없는 C주) · 검색 90%+클라우드+Gemini+TPU+YouTube · 상세 분석은 GOOGL 참조', mcap:3630, rsi:50, index:'SP500' },
  { sym:'GEV', name:'GE Vernova', sector:'Utilities', signal:'BUY', memo:'Behind-the-Meter 자체발전 수혜(SemiAnalysis) · DC 전력망 3년+ 대기 → 터빈/스위치 수요 폭증 · 가스터빈 $2,500→$3,000/kW 가격 상승 · 전력장비 · AI DC 전력', mcap:220, rsi:55, index:'SP500' },
  { sym:'TMUS', name:'T-Mobile US', sector:'Communication Services', signal:'HOLD', memo:'미국 3대 통신 · 5G 선도 · 가입자 성장', mcap:239, rsi:52, index:'SP500' },
  { sym:'TXN', name:'Texas Instruments', sector:'Technology', signal:'BUY', memo:'Citi 탑픽 · 아날로그 반도체 · 자동차/산업 · 배당 · 아날로그 가격 +10~15% 상승사이클 진입', mcap:200, rsi:48, index:'SP500' },
  { sym:'ANET', name:'Arista Networks', sector:'Technology', signal:'BUY', memo:'[JPM 04/17 AFL 1위] PT$200(기존$190↑) · 네트워킹/스위치 커버리지 내 최선호 · 2026/2027 35%+ 매출 성장 가능, 2027 EPS $5 · 40%+ CAGR 맞는 멀티플 적용 시 강세 시나리오 주가 $200+ · Meta/Oracle 이어 Microsoft/OpenAI/Anthropic 등 NeoCloud 고객군 확장 · AI DC 네트워킹 핵심', mcap:170, rsi:52, index:'SP500' },
  { sym:'ETN', name:'Eaton Corp', sector:'Industrials', signal:'BUY', memo:'[Citi 04/09] 전기복잡성증가·하이브리드전력아키텍처·가변부하관리 핵심수혜 · 학습→추론DC전환 양면 수혜 · VRT/NVT/GEV와 함께 수혜군', mcap:150, rsi:52, index:'SP500' },
  { sym:'NVT', name:'nVent Electric', sector:'Industrials', signal:'BUY', memo:'[Citi 04/09] 전기복잡성증가·하이브리드전력아키텍처 수혜군 · DC 전기 보호·연결 솔루션 · ETN/VRT/GEV와 함께 학습→추론 전환 수혜', mcap:10, rsi:50, index:'SP500' },
  { sym:'CB', name:'Chubb Ltd', sector:'Financials', signal:'HOLD', memo:'글로벌 손해보험 · 재보험', mcap:128, rsi:50, index:'SP500' },
  { sym:'ACN', name:'Accenture', sector:'Technology', signal:'HOLD', memo:'IT 컨설팅 글로벌 1위 · AI/클라우드 전환', mcap:140, rsi:50, index:'SP500' },
  { sym:'PH', name:'Parker-Hannifin', sector:'Industrials', signal:'HOLD', memo:'모션&컨트롤 · 항공우주 · 산업', mcap:126, rsi:50, index:'SP500' },
  { sym:'MDT', name:'Medtronic', sector:'Healthcare', signal:'HOLD', memo:'의료기기 글로벌 1위 · 심장/당뇨/척추', mcap:130, rsi:48, index:'SP500' },
  { sym:'MO', name:'Altria Group', sector:'Consumer Defensive', signal:'HOLD', memo:'미국 담배 · 고배당 7%+ · 방어주', mcap:108, rsi:52, index:'SP500' },
  { sym:'NEM', name:'Newmont Corp', sector:'Materials', signal:'HOLD', memo:'세계 최대 금광 · 금값 상관', mcap:107, rsi:55, index:'SP500' },
  { sym:'SO', name:'Southern Company', sector:'Utilities', signal:'HOLD', memo:'미국 최대 유틸리티 · 원전/태양광', mcap:103, rsi:52, index:'SP500' },
  { sym:'CMCSA', name:'Comcast', sector:'Communication Services', signal:'HOLD', memo:'NBC유니버셜 · Xfinity · Peacock', mcap:108, rsi:46, index:'SP500' },
  { sym:'SNDK', name:'SanDisk', sector:'Technology', signal:'BUY', memo:'[Citi PT$980↑+Evercore OP PT$1200 Bull $2600] NAND ASP QQ +70-75%(TrendForce) · HBF(고대역폭플래시) 일정 6개월 앞당김 — 26H2 파일럿 라인, 27초 AI추론 디바이스(스택당 512GB 16레이어, HBM 대비 동일비용 8-16배 용량) = HBM+HBF+SSD 3계층 신패러다임 · SCA=가격하한+선급현금 · Nanya $10억 DRAM(eSSD CY26H2) · TurboQuant=AI채택↑→스토리지↑(DeepSeek역설) · 키옥시아 JV 2034 · FY27E $130+ EPS 경로', mcap:102, rsi:48, index:'SP500' },
  { sym:'WDC', name:'Western Digital', sector:'Technology', signal:'BUY', memo:'[JPM 04/17] PT$400(기존$320↑) · JPM Overweight 순위 5위 · HAMR 전환 가속 수혜 · 100→140TB 로드맵 · 2nd HAMR 퀄 진행 · HDD 섹터 최우선 긍정(STX 이어 2위) · 장기 GM50%+/OM40%+/FCF30%+/EPS$20+ · 부채 감축 · HDD 멀티플 18→21x 재평가', mcap:94, rsi:46, index:'SP500' },
  { sym:'HWM', name:'Howmet Aerospace', sector:'Industrials', signal:'BUY', memo:'항공우주 부품 · 엔진 · 방산', mcap:96, rsi:55, index:'SP500' },
  { sym:'EQIX', name:'Equinix', sector:'Real Estate', signal:'BUY', memo:'[Citi 04/09] 전력공급 제약→DC 가격·개발수익 우호 환경 · 그리드 15~20년 제약 지속→DC 가격결정력 강화 · 전력망 연결 선호하나 브리지 수요 durable', mcap:93, rsi:50, index:'SP500' },
  { sym:'TT', name:'Trane Technologies', sector:'Industrials', signal:'HOLD', memo:'냉난방(HVAC) · 데이터센터 냉각', mcap:95, rsi:50, index:'SP500' },
  { sym:'CVS', name:'CVS Health', sector:'Healthcare', signal:'HOLD', memo:'약국체인 + Aetna 보험 + 헬스허브', mcap:90, rsi:46, index:'SP500' },
  { sym:'STX', name:'Seagate Tech', sector:'Technology', signal:'BUY', memo:'[JPM 04/17 Positive Catalyst Watch] PT$600(기존$525↑) · Citi PT$595 · HAMR 전환 주도 → F3Q26/F4Q26 GPM 긍정 서프라이즈 여지 · 완만한 가격 인상 = 매출/EB 상방 + HAMR 전환 가속 = COGS/EB 하락 동시 진행 · Mozaic4+(44TB) 2개 하이퍼스케일러 양산 · HDD 멀티플 21x 재평가 · FY26E $117억(+29%) EPS $13.39 · JPM 하드웨어 섹터 중 가장 압도적 긍정', mcap:88, rsi:48, index:'SP500' },
  { sym:'FDX', name:'FedEx', sector:'Industrials', signal:'HOLD', memo:'글로벌 물류 · 이커머스 수혜', mcap:86, rsi:46, index:'SP500' },
  { sym:'PWR', name:'Quanta Services', sector:'Industrials', signal:'BUY', memo:'송전망 건설 최대 수혜 · 전력망 병목 구조적 Capex · 재생에너지 · AI 인프라', mcap:78, rsi:52, index:'SP500' },
  { sym:'MTZ', name:'MasTec', sector:'Industrials', signal:'BUY', memo:'[Citi 04/09] 전력 인프라 EPC 핵심 수혜 · PWR과 함께 DC전력인프라 구조적 Capex 수혜 · 추론DC 입지 이동(남동부·중부대서양 연안)→신규 송전인프라 건설 수요', mcap:7, rsi:50, index:'SP500' },
  { sym:'MRSH', name:'Marsh McLennan', sector:'Financials', signal:'HOLD', memo:'보험 브로커 · 리스크 컨설팅', mcap:85, rsi:50, index:'SP500' },
  { sym:'UPS', name:'UPS', sector:'Industrials', signal:'HOLD', memo:'미국 최대 택배 · 배당', mcap:84, rsi:44, index:'SP500' },
  { sym:'PNC', name:'PNC Financial', sector:'Financials', signal:'HOLD', memo:'미국 6위 은행', mcap:83, rsi:48, index:'SP500' },
  { sym:'BX', name:'Blackstone', sector:'Financials', signal:'HOLD', memo:'세계 최대 대체투자 · PE/부동산', mcap:82, rsi:50, index:'SP500' },
  { sym:'AMT', name:'American Tower', sector:'Real Estate', signal:'HOLD', memo:'통신 타워 REIT · 글로벌', mcap:82, rsi:46, index:'SP500' },
  { sym:'JCI', name:'Johnson Controls', sector:'Industrials', signal:'HOLD', memo:'빌딩 자동화 · HVAC · 화재안전', mcap:82, rsi:50, index:'SP500' },
  { sym:'KKR', name:'KKR & Co', sector:'Financials', signal:'HOLD', memo:'대체투자 · PE/인프라 · AI 투자', mcap:82, rsi:50, index:'SP500' },
  { sym:'USB', name:'US Bancorp', sector:'Financials', signal:'HOLD', memo:'미국 5위 은행 · 배당', mcap:80, rsi:48, index:'SP500' },
  { sym:'ITW', name:'Illinois Tool Works', sector:'Industrials', signal:'HOLD', memo:'산업 장비 · 다각화 · 배당왕', mcap:76, rsi:50, index:'SP500' },
  { sym:'CMI', name:'Cummins', sector:'Industrials', signal:'HOLD', memo:'[Citi 04/09] 디젤백업 업계표준 유지(대규모 저장 용이) · 천연가스왕복엔진 학습DC 가변부하 강점 · 추론DC전환→스탠바이MW↑ · 발전부문 상향여지', mcap:76, rsi:48, index:'SP500' },
  { sym:'KEX', name:'Kirby Corp', sector:'Industrials', signal:'BUY', memo:'[Citi 04/09] DC발전기 패키징·공급망 · OEM엔진 리드타임18월(CAT/RR-MTU/Kawasaki)+패키징30~40일 · 천연가스왕복(HSD마진) vs 디젤백업(MSD마진) 믹스개선 · 발전매출22%+ 상향여지 · 2Q~3Q 엔진수령 증가', mcap:6.5, rsi:54, index:'SP500' },
  { sym:'RCL', name:'Royal Caribbean', sector:'Consumer', signal:'HOLD', memo:'크루즈 · 프리미엄', mcap:75, rsi:48, index:'SP500' },
  { sym:'EMR', name:'Emerson Electric', sector:'Industrials', signal:'HOLD', memo:'산업 자동화 · 소프트웨어 전환', mcap:74, rsi:50, index:'SP500' },
  { sym:'CSX', name:'CSX Corp', sector:'Industrials', signal:'HOLD', memo:'미국 철도 · 화물 운송', mcap:73, rsi:48, index:'SP500' },
  { sym:'PSX', name:'Phillips 66', sector:'Energy', signal:'HOLD', memo:'미국 정유 · 화학 · 미드스트림', mcap:71, rsi:48, index:'SP500' },
  { sym:'VLO', name:'Valero Energy', sector:'Energy', signal:'HOLD', memo:'미국 최대 독립 정유 · 배당', mcap:71, rsi:48, index:'SP500' },
  { sym:'CRH', name:'CRH plc', sector:'Materials', signal:'HOLD', memo:'건축자재 · 인프라 · 아일랜드 기반', mcap:70, rsi:50, index:'SP500' },
  { sym:'HLT', name:'Hilton', sector:'Consumer', signal:'HOLD', memo:'글로벌 호텔 · 럭셔리/비즈니스', mcap:70, rsi:50, index:'SP500' },
  { sym:'ROST', name:'Ross Stores', sector:'Consumer', signal:'HOLD', memo:'오프프라이스 리테일', mcap:70, rsi:50, index:'SP500' },
  { sym:'MPC', name:'Marathon Petroleum', sector:'Energy', signal:'HOLD', memo:'미국 정유 · 자사주매입', mcap:69, rsi:48, index:'SP500' },
  { sym:'WBD', name:'Warner Bros Discovery', sector:'Communication Services', signal:'WATCH', memo:'HBO · CNN · DC · 부채 리스크', mcap:68, rsi:42, index:'SP500' },
  { sym:'RSG', name:'Republic Services', sector:'Industrials', signal:'HOLD', memo:'폐기물 처리 2위 · ESG', mcap:67, rsi:52, index:'SP500' },
  { sym:'LHX', name:'L3Harris Tech', sector:'Industrials', signal:'BUY', memo:'방산 전자 · 통신 · 우주', mcap:66, rsi:52, index:'SP500' },
  { sym:'APO', name:'Apollo Global', sector:'Financials', signal:'WATCH', memo:'대체투자 · 크레딧 · 보험 · $151억 사모대출펀드 Q1 환매 11.2% · 사모신용 디폴트율 5.8%(수년래 최고) · YTD -23%', mcap:65, rsi:42, index:'SP500' },
  { sym:'ELV', name:'Elevance Health', sector:'Healthcare', signal:'HOLD', memo:'헬스케어 보험 · Anthem', mcap:64, rsi:42, index:'SP500' },
  { sym:'COR', name:'Cencora', sector:'Healthcare', signal:'HOLD', memo:'의약품 유통 · AmerisourceBergen', mcap:63, rsi:52, index:'SP500' },
  { sym:'APD', name:'Air Products', sector:'Materials', signal:'HOLD', memo:'산업가스 · 수소 · 클린에너지', mcap:62, rsi:46, index:'SP500' },
  { sym:'BKR', name:'Baker Hughes', sector:'Energy', signal:'HOLD', memo:'유전 서비스 · 에너지 전환', mcap:62, rsi:48, index:'SP500' },
  { sym:'DLR', name:'Digital Realty', sector:'Real Estate', signal:'BUY', memo:'데이터센터 REIT · AI 수혜', mcap:61, rsi:50, index:'SP500' },
  { sym:'OXY', name:'Occidental Petroleum', sector:'Energy', signal:'HOLD', memo:'E&P · 탄소포집 · 버핏 투자', mcap:60, rsi:46, index:'SP500' },
  { sym:'TEL', name:'TE Connectivity', sector:'Technology', signal:'HOLD', memo:'커넥터 · 센서 · 자동차/산업/항공', mcap:59, rsi:50, index:'SP500' },
  { sym:'OKE', name:'ONEOK', sector:'Energy', signal:'HOLD', memo:'천연가스 가공 · MLP 대안', mcap:57, rsi:52, index:'SP500' },
  { sym:'TFC', name:'Truist Financial', sector:'Financials', signal:'HOLD', memo:'미국 지역 은행', mcap:56, rsi:46, index:'SP500' },
  { sym:'AJG', name:'Arthur J Gallagher', sector:'Financials', signal:'HOLD', memo:'보험 브로커 · M&A 성장', mcap:56, rsi:52, index:'SP500' },
  { sym:'FANG', name:'Diamondback Energy', sector:'Energy', signal:'HOLD', memo:'퍼미안 분지 E&P · 배당', mcap:54, rsi:48, index:'SP500' },
  { sym:'ALL', name:'Allstate', sector:'Financials', signal:'HOLD', memo:'미국 손해보험 · 자동차보험', mcap:54, rsi:50, index:'SP500' },
  { sym:'MPWR', name:'Monolithic Power', sector:'Technology', signal:'BUY', memo:'Citi 탑픽 · KeyBanc OW PT $1500 · Vera Rubin Stage 2 전원 60~70% 점유(IFX/Renesas 경쟁) · GB300 vs VR ASP +30%↑ · Analog 채널재고 의미 있는 개선 · TXN/ON과 함께 DC 전력밀도 확대 최대 수혜 · 아날로그 가격인상 사이클', mcap:53, rsi:48, index:'SP500' },
  { sym:'CTVA', name:'Corteva', sector:'Materials', signal:'HOLD', memo:'농업 화학 · 종자/작물보호', mcap:53, rsi:48, index:'SP500' },
  { sym:'ADSK', name:'Autodesk', sector:'Technology', signal:'HOLD', memo:'CAD/BIM 설계 소프트웨어', mcap:53, rsi:48, index:'SP500' },
  { sym:'D', name:'Dominion Energy', sector:'Utilities', signal:'HOLD', memo:'유틸리티 · 배당 · 재생에너지', mcap:53, rsi:48, index:'SP500' },
  { sym:'FAST', name:'Fastenal', sector:'Industrials', signal:'HOLD', memo:'산업 유통 · 자동화 · 배당', mcap:52, rsi:48, index:'SP500' },
  { sym:'GWW', name:'W.W. Grainger', sector:'Industrials', signal:'HOLD', memo:'산업 유통 · MRO', mcap:50, rsi:50, index:'SP500' },
  { sym:'FIX', name:'Comfort Systems USA', sector:'Industrials', signal:'BUY', memo:'데이터센터 MEP 시공 · AI 인프라', mcap:50, rsi:55, index:'SP500' },
  { sym:'NDAQ', name:'Nasdaq Inc', sector:'Financials', signal:'HOLD', memo:'거래소 · 데이터 · 핀테크', mcap:49, rsi:50, index:'SP500' },
  { sym:'AME', name:'AMETEK', sector:'Industrials', signal:'HOLD', memo:'전자 장비 · 항공우주', mcap:49, rsi:50, index:'SP500' },
  { sym:'ZTS', name:'Zoetis', sector:'Healthcare', signal:'HOLD', memo:'동물 의약품 글로벌 1위', mcap:49, rsi:46, index:'SP500' },
  { sym:'CAH', name:'Cardinal Health', sector:'Healthcare', signal:'HOLD', memo:'의약품 유통 · 배당', mcap:49, rsi:52, index:'SP500' },
  { sym:'XEL', name:'Xcel Energy', sector:'Utilities', signal:'HOLD', memo:'재생에너지 유틸리티', mcap:48, rsi:50, index:'SP500' },
  { sym:'TER', name:'Teradyne', sector:'Technology', signal:'BUY', memo:'UBS: CPO Teach-in 재조명 · Rubin Ultra 2-die 전환(4-die 취소)→288랙=2x 테스트 수량→TER 수혜 · CoPoS 2026 앞당김 고밀도 패키징 테스트 · SSD 수요 폭발(141EB → NAND 전체의 13%)', mcap:48, rsi:50, index:'SP500' },
  { sym:'EW', name:'Edwards Lifesciences', sector:'Healthcare', signal:'HOLD', memo:'심장 판막 · 구조적 심장질환', mcap:48, rsi:48, index:'SP500' },
  { sym:'ETR', name:'Entergy', sector:'Utilities', signal:'HOLD', memo:'유틸리티 · 원전 · 데이터센터 전력', mcap:46, rsi:50, index:'SP500' },
  { sym:'GRMN', name:'Garmin', sector:'Technology', signal:'HOLD', memo:'GPS/웨어러블 · 항공 · 피트니스', mcap:46, rsi:52, index:'SP500' },
  { sym:'BDX', name:'BD (Becton Dickinson)', sector:'Healthcare', signal:'HOLD', memo:'의료기기 · 진단 · 주사기', mcap:45, rsi:48, index:'SP500' },
  { sym:'KR', name:'Kroger', sector:'Consumer Defensive', signal:'HOLD', memo:'미국 대형 마트 · 배당', mcap:44, rsi:50, index:'SP500' },
  { sym:'HSY', name:'Hershey', sector:'Consumer Defensive', signal:'HOLD', memo:'초콜릿/스낵 · 코코아 가격 영향', mcap:44, rsi:44, index:'SP500' },
  { sym:'CVNA', name:'Carvana', sector:'Consumer', signal:'WATCH', memo:'온라인 중고차 · 턴어라운드', mcap:43, rsi:52, index:'SP500' },
  { sym:'DAL', name:'Delta Air Lines', sector:'Industrials', signal:'HOLD', memo:'휴전 후 항공/여행 강세 수혜 · 강한 수요+매출 증가 확인(4/9) · 미국 프리미엄 항공 · Amazon Leo 위성통신 탑재 예정', mcap:43, rsi:46, index:'SP500' },
  { sym:'WAB', name:'Wabtec', sector:'Industrials', signal:'HOLD', memo:'철도 장비 · 기관차 · 디지털', mcap:41, rsi:50, index:'SP500' },
  { sym:'FITB', name:'Fifth Third Bancorp', sector:'Financials', signal:'HOLD', memo:'미국 중서부 지역 은행', mcap:41, rsi:48, index:'SP500' },
  { sym:'EQT', name:'EQT Corporation', sector:'Energy', signal:'HOLD', memo:'미국 최대 천연가스 · 앱팔래치아', mcap:41, rsi:48, index:'SP500' },
  { sym:'AMP', name:'Ameriprise Financial', sector:'Financials', signal:'HOLD', memo:'자산운용 · 재무설계', mcap:41, rsi:48, index:'SP500' },
  { sym:'CBRE', name:'CBRE Group', sector:'Real Estate', signal:'HOLD', memo:'글로벌 상업용 부동산 서비스', mcap:41, rsi:48, index:'SP500' },
  { sym:'ROK', name:'Rockwell Automation', sector:'Industrials', signal:'HOLD', memo:'산업 자동화 · 스마트 팩토리', mcap:41, rsi:46, index:'SP500' },
  { sym:'DHI', name:'DR Horton', sector:'Consumer', signal:'HOLD', memo:'미국 최대 주택건설 · 금리 민감', mcap:40, rsi:44, index:'SP500' },
  { sym:'PEG', name:'PSEG', sector:'Utilities', signal:'HOLD', memo:'뉴저지 유틸리티 · 원전 · 데이터센터', mcap:40, rsi:50, index:'SP500' },
  { sym:'ED', name:'Consolidated Edison', sector:'Utilities', signal:'HOLD', memo:'뉴욕 유틸리티 · 배당귀족', mcap:38, rsi:50, index:'SP500' },
  { sym:'FICO', name:'Fair Isaac Corp', sector:'Technology', signal:'HOLD', memo:'FICO 신용점수 · 데이터 독점', mcap:42, rsi:50, index:'SP500' },
  { sym:'GIS', name:'General Mills', sector:'Consumer Defensive', signal:'HOLD', memo:'시리얼/스낵 · 방어주 · 배당', mcap:35, rsi:50, index:'SP500' },
  { sym:'DOV', name:'Dover Corp', sector:'Industrials', signal:'HOLD', memo:'산업 장비 · 펌프/에너지', mcap:22, rsi:50, index:'SP500' },
  { sym:'ANSS', name:'ANSYS', sector:'Technology', signal:'HOLD', memo:'시뮬레이션 소프트웨어', mcap:30, rsi:50, index:'SP500' },
  { sym:'HIG', name:'Hartford Financial', sector:'Financials', signal:'HOLD', memo:'보험 · 손해/생명/뮤추얼', mcap:32, rsi:52, index:'SP500' },
  { sym:'ACGL', name:'Arch Capital', sector:'Financials', signal:'HOLD', memo:'재보험 · 인수심사 우수', mcap:38, rsi:54, index:'SP500' },
  { sym:'IFF', name:'Intl Flavors & Fragrances', sector:'Materials', signal:'HOLD', memo:'향료/향수/식품첨가물', mcap:22, rsi:44, index:'SP500' },
  { sym:'STT', name:'State Street', sector:'Financials', signal:'HOLD', memo:'자산관리 · SPDR ETF', mcap:28, rsi:50, index:'SP500' },
  { sym:'KVUE', name:'Kenvue', sector:'Consumer Defensive', signal:'HOLD', memo:'JNJ 소비자헬스 분사 · 타이레놀/리스테린', mcap:40, rsi:48, index:'SP500' },
  { sym:'PPG', name:'PPG Industries', sector:'Materials', signal:'HOLD', memo:'페인트/코팅 · 자동차/건축', mcap:28, rsi:48, index:'SP500' },
  { sym:'VLTO', name:'Veralto', sector:'Technology', signal:'HOLD', memo:'수질/제품식별 · Danaher 분사', mcap:28, rsi:50, index:'SP500' },
  { sym:'GEHC', name:'GE HealthCare', sector:'Healthcare', signal:'HOLD', memo:'의료영상/진단 · AI · GE 분사', mcap:38, rsi:48, index:'SP500' },
  { sym:'HPQ', name:'HP Inc', sector:'Technology', signal:'HOLD', memo:'PC/프린터 · AI PC 기대', mcap:30, rsi:46, index:'SP500' },
  { sym:'MTB', name:'M&T Bank', sector:'Financials', signal:'HOLD', memo:'미국 동부 지역 은행', mcap:28, rsi:48, index:'SP500' },
  { sym:'LDOS', name:'Leidos Holdings', sector:'Industrials', signal:'HOLD', memo:'방산 IT · 정부 계약', mcap:22, rsi:50, index:'SP500' },
  { sym:'IT', name:'Gartner', sector:'Technology', signal:'HOLD', memo:'IT 리서치/컨설팅', mcap:35, rsi:48, index:'SP500' },
  { sym:'K', name:'Kellanova', sector:'Consumer Defensive', signal:'HOLD', memo:'시리얼/스낵 · Mars 인수', mcap:28, rsi:48, index:'SP500' },
  { sym:'CPAY', name:'Corpay', sector:'Technology', signal:'HOLD', memo:'기업 결제 · 플릿카드', mcap:25, rsi:50, index:'SP500' },
  { sym:'WST', name:'West Pharma', sector:'Healthcare', signal:'HOLD', memo:'의약품 포장 · 바이알/주사기', mcap:22, rsi:44, index:'SP500' },
  { sym:'PHM', name:'PulteGroup', sector:'Consumer', signal:'HOLD', memo:'주택건설 · 다양한 가격대', mcap:22, rsi:46, index:'SP500' },
  { sym:'SBAC', name:'SBA Communications', sector:'Real Estate', signal:'HOLD', memo:'통신 타워 REIT', mcap:25, rsi:46, index:'SP500' },
  { sym:'RF', name:'Regions Financial', sector:'Financials', signal:'HOLD', memo:'남부 지역 은행', mcap:22, rsi:48, index:'SP500' },
  { sym:'WRB', name:'Berkley Corp', sector:'Financials', signal:'HOLD', memo:'특수보험', mcap:22, rsi:52, index:'SP500' },
  { sym:'NTAP', name:'NetApp', sector:'Technology', signal:'HOLD', memo:'[JPM 04/17: OW→N 하향] PT$110(기존$125↓) · AFF A/C 시리즈 점유율 확대 사이클 소진(최근 2분기 YoY 점유율 하락세) · AFX 신제품은 온프렘 엔터프라이즈 AI 지출 변곡 의존 · NAND 계약가 C4Q25 +36% → C1Q26 +88% → C2Q26 +73% 전례 없는 원가 상승 → FY27 GPM 약 -200bps YoY · 12배 NTM PE 싸 보이나 COVID 8배/FY23 10.5배 전례 → 추가 멀티플 하락 여지 · 메모리 원가 전가 지연 구조', mcap:25, rsi:50, index:'SP500' },
  { sym:'MTD', name:'Mettler-Toledo', sector:'Technology', signal:'HOLD', memo:'정밀측정 장비', mcap:25, rsi:48, index:'SP500' },
  { sym:'AWK', name:'American Water Works', sector:'Utilities', signal:'HOLD', memo:'미국 최대 수도회사', mcap:28, rsi:50, index:'SP500' },
  { sym:'ATO', name:'Atmos Energy', sector:'Utilities', signal:'HOLD', memo:'천연가스 유통', mcap:22, rsi:52, index:'SP500' },
  { sym:'PPL', name:'PPL Corp', sector:'Utilities', signal:'HOLD', memo:'유틸리티 · 배당', mcap:24, rsi:50, index:'SP500' },
  { sym:'ESS', name:'Essex Property', sector:'Real Estate', signal:'HOLD', memo:'서부 아파트 REIT', mcap:18, rsi:48, index:'SP500' },
  { sym:'EIX', name:'Edison Intl', sector:'Utilities', signal:'HOLD', memo:'캘리포니아 유틸리티', mcap:28, rsi:48, index:'SP500' },
  { sym:'DG', name:'Dollar General', sector:'Consumer', signal:'HOLD', memo:'달러스토어 · 저소득층', mcap:20, rsi:42, index:'SP500' },
  { sym:'EXR', name:'Extra Space Storage', sector:'Real Estate', signal:'HOLD', memo:'셀프스토리지 REIT', mcap:30, rsi:48, index:'SP500' },
  { sym:'CDW', name:'CDW Corp', sector:'Technology', signal:'BUY', memo:'[JPM 04/17 Positive Catalyst Watch] 연말 대비 풀이어 가이던스(mid-단자릿수 EPS성장) 상회하는 +8% EPS 성장 제시 예상 · 투자자 장기보유 기준 +10% EPS 성장 로드맵 제시 가능성 상방 재료 · IT 디스트리뷰터 중 최선호', mcap:25, rsi:48, index:'SP500' },
  { sym:'IRM', name:'Iron Mountain', sector:'Real Estate', signal:'HOLD', memo:'데이터센터 REIT · AI 수혜', mcap:30, rsi:52, index:'SP500' },
  { sym:'CLX', name:'Clorox', sector:'Consumer Defensive', signal:'HOLD', memo:'소독/청소용품 · 배당', mcap:20, rsi:46, index:'SP500' },
  { sym:'AVB', name:'AvalonBay', sector:'Real Estate', signal:'HOLD', memo:'프리미엄 아파트 REIT', mcap:30, rsi:48, index:'SP500' },
  { sym:'MAA', name:'Mid-America Apartment', sector:'Real Estate', signal:'HOLD', memo:'선벨트 아파트 REIT', mcap:18, rsi:48, index:'SP500' },
  { sym:'GDDY', name:'GoDaddy', sector:'Technology', signal:'HOLD', memo:'도메인/웹호스팅 · SMB', mcap:25, rsi:52, index:'SP500' },
  { sym:'TSCO', name:'Tractor Supply', sector:'Consumer', signal:'HOLD', memo:'농촌 리테일 · 라이프스타일', mcap:28, rsi:50, index:'SP500' },
  { sym:'VTR', name:'Ventas', sector:'Real Estate', signal:'HOLD', memo:'시니어 주거/의료 REIT', mcap:22, rsi:48, index:'SP500' },
  { sym:'LII', name:'Lennox Intl', sector:'Industrials', signal:'HOLD', memo:'HVAC · 냉난방 장비', mcap:22, rsi:52, index:'SP500' },
  { sym:'ZBRA', name:'Zebra Technologies', sector:'Technology', signal:'HOLD', memo:'바코드/RFID 스캐너', mcap:18, rsi:46, index:'SP500' },
  { sym:'CHD', name:'Church & Dwight', sector:'Consumer Defensive', signal:'HOLD', memo:'가정용품 · OxiClean', mcap:25, rsi:50, index:'SP500' },
  { sym:'VRSN', name:'VeriSign', sector:'Technology', signal:'HOLD', memo:'.com/.net 도메인 독점', mcap:22, rsi:50, index:'SP500' },
  { sym:'PKG', name:'Packaging Corp', sector:'Materials', signal:'HOLD', memo:'골판지 포장 · 이커머스', mcap:18, rsi:50, index:'SP500' },
  { sym:'MKTX', name:'MarketAxess', sector:'Financials', signal:'HOLD', memo:'채권 전자거래 플랫폼', mcap:10, rsi:44, index:'SP500' },
  { sym:'LYV', name:'Live Nation', sector:'Consumer', signal:'HOLD', memo:'콘서트/티켓마스터 · 라이브 엔터', mcap:25, rsi:48, index:'SP500' },
  { sym:'TYL', name:'Tyler Technologies', sector:'Technology', signal:'HOLD', memo:'공공부문 소프트웨어', mcap:22, rsi:50, index:'SP500' },
  { sym:'CBOE', name:'Cboe Global Markets', sector:'Financials', signal:'HOLD', memo:'옵션 거래소 · VIX', mcap:22, rsi:50, index:'SP500' },
  { sym:'BR', name:'Broadridge Financial', sector:'Technology', signal:'HOLD', memo:'금융 기술 인프라', mcap:25, rsi:50, index:'SP500' },
  { sym:'STLD', name:'Steel Dynamics', sector:'Materials', signal:'HOLD', memo:'미니밀 철강 · 건설/자동차', mcap:20, rsi:48, index:'SP500' },
  { sym:'FE', name:'FirstEnergy', sector:'Utilities', signal:'HOLD', memo:'오하이오 유틸리티', mcap:25, rsi:48, index:'SP500' },
  { sym:'J', name:'Jacobs Solutions', sector:'Industrials', signal:'HOLD', memo:'엔지니어링/건설 · 인프라', mcap:18, rsi:48, index:'SP500' },
  { sym:'LUV', name:'Southwest Airlines', sector:'Industrials', signal:'HOLD', memo:'미국 저가항공', mcap:18, rsi:44, index:'SP500' },
  { sym:'CAG', name:'Conagra Brands', sector:'Consumer Defensive', signal:'HOLD', memo:'냉동식품 · 방어주', mcap:15, rsi:44, index:'SP500' },
  { sym:'NI', name:'NiSource', sector:'Utilities', signal:'HOLD', memo:'가스 유틸리티', mcap:18, rsi:50, index:'SP500' },
  { sym:'KDP', name:'Keurig Dr Pepper', sector:'Consumer Defensive', signal:'HOLD', memo:'음료/커피 · 배당', mcap:40, rsi:50, index:'SP500' },
  { sym:'HOLX', name:'Hologic', sector:'Healthcare', signal:'HOLD', memo:'여성건강 진단장비', mcap:20, rsi:48, index:'SP500' },
  { sym:'EG', name:'Everest Group', sector:'Financials', signal:'HOLD', memo:'재보험', mcap:18, rsi:50, index:'SP500' },
  { sym:'HAL', name:'Halliburton', sector:'Energy', signal:'HOLD', memo:'유전 서비스 · 시추/완결', mcap:22, rsi:46, index:'SP500' },
  { sym:'CFG', name:'Citizens Financial', sector:'Financials', signal:'HOLD', memo:'동부 지역 은행', mcap:20, rsi:46, index:'SP500' },
  { sym:'WTW', name:'Willis Towers Watson', sector:'Financials', signal:'HOLD', memo:'보험 브로커 · 컨설팅', mcap:30, rsi:48, index:'SP500' },
  { sym:'KEY', name:'KeyCorp', sector:'Financials', signal:'HOLD', memo:'지역 은행 · 배당', mcap:18, rsi:44, index:'SP500' },
  { sym:'BRO', name:'Brown & Brown', sector:'Financials', signal:'HOLD', memo:'보험 브로커 · M&A', mcap:28, rsi:52, index:'SP500' },
  { sym:'MOH', name:'Molina Healthcare', sector:'Healthcare', signal:'HOLD', memo:'Medicaid 관리의료', mcap:20, rsi:46, index:'SP500' },
  { sym:'PFG', name:'Principal Financial', sector:'Financials', signal:'HOLD', memo:'자산운용/보험 · 은퇴', mcap:18, rsi:50, index:'SP500' },
  { sym:'COO', name:'CooperCompanies', sector:'Healthcare', signal:'HOLD', memo:'콘택트렌즈 · 여성건강', mcap:20, rsi:48, index:'SP500' },
  { sym:'TXT', name:'Textron', sector:'Industrials', signal:'HOLD', memo:'Bell 헬리콥터 · Cessna', mcap:15, rsi:48, index:'SP500' },
  { sym:'DGX', name:'Quest Diagnostics', sector:'Healthcare', signal:'HOLD', memo:'임상검사 · 진단', mcap:20, rsi:50, index:'SP500' },
  { sym:'SNA', name:'Snap-on', sector:'Industrials', signal:'HOLD', memo:'전문 공구 · 자동차 정비', mcap:18, rsi:52, index:'SP500' },
  { sym:'MAS', name:'Masco Corp', sector:'Industrials', signal:'HOLD', memo:'주택 개보수 · 배관/페인트', mcap:15, rsi:46, index:'SP500' },
  { sym:'DPZ', name:'Dominos Pizza', sector:'Consumer', signal:'HOLD', memo:'피자 프랜차이즈 · 디지털', mcap:18, rsi:50, index:'SP500' },
  { sym:'FDS', name:'FactSet Research', sector:'Financials', signal:'HOLD', memo:'금융 데이터/분석', mcap:18, rsi:48, index:'SP500' },
  { sym:'BG', name:'Bunge Global', sector:'Consumer Defensive', signal:'HOLD', memo:'곡물/농산물 트레이딩', mcap:15, rsi:48, index:'SP500' },
  { sym:'ARE', name:'Alexandria RE', sector:'Real Estate', signal:'HOLD', memo:'생명과학 오피스 REIT', mcap:18, rsi:42, index:'SP500' },
  { sym:'WSO', name:'Watsco', sector:'Industrials', signal:'HOLD', memo:'HVAC 유통 · 에어컨', mcap:20, rsi:52, index:'SP500' },
  { sym:'BAX', name:'Baxter Intl', sector:'Healthcare', signal:'HOLD', memo:'의료기기 · 신장관리', mcap:18, rsi:42, index:'SP500' },
  { sym:'CPB', name:'Campbell Soup', sector:'Consumer Defensive', signal:'HOLD', memo:'식품 · 스낵 · 배당', mcap:12, rsi:46, index:'SP500' },
  { sym:'DVA', name:'DaVita', sector:'Healthcare', signal:'HOLD', memo:'투석 센터 · 신장치료', mcap:12, rsi:50, index:'SP500' },
  { sym:'PODD', name:'Insulet', sector:'Healthcare', signal:'HOLD', memo:'인슐린 펌프 Omnipod', mcap:18, rsi:48, index:'SP500' },
  { sym:'WAT', name:'Waters Corp', sector:'Healthcare', signal:'HOLD', memo:'분석기기 · HPLC · 질량분석', mcap:18, rsi:46, index:'SP500' },
  { sym:'EXPD', name:'Expeditors Intl', sector:'Industrials', signal:'HOLD', memo:'물류/포워딩 · 글로벌 운송', mcap:15, rsi:48, index:'SP500' },
  { sym:'WBA', name:'Walgreens', sector:'Healthcare', signal:'WATCH', memo:'약국체인 · 턴어라운드 · 리스크', mcap:10, rsi:38, index:'SP500' },
  { sym:'CINF', name:'Cincinnati Financial', sector:'Financials', signal:'HOLD', memo:'손해보험 · 배당왕', mcap:20, rsi:52, index:'SP500' },
  { sym:'POOL', name:'Pool Corp', sector:'Consumer', signal:'HOLD', memo:'수영장 장비/유통', mcap:15, rsi:46, index:'SP500' },
  { sym:'EMN', name:'Eastman Chemical', sector:'Materials', signal:'HOLD', memo:'특수화학 · 첨가제/섬유', mcap:12, rsi:44, index:'SP500' },
  { sym:'NVR', name:'NVR Inc', sector:'Consumer', signal:'HOLD', memo:'주택건설 · 토지매입 안 함', mcap:28, rsi:52, index:'SP500' },
  { sym:'BLDR', name:'Builders FirstSource', sector:'Consumer', signal:'HOLD', memo:'건축자재 유통 · 주택시장', mcap:20, rsi:46, index:'SP500' },
  { sym:'NTRS', name:'Northern Trust', sector:'Financials', signal:'HOLD', memo:'자산관리/커스터디', mcap:20, rsi:48, index:'SP500' },
  { sym:'IPG', name:'Interpublic Group', sector:'Communication Services', signal:'HOLD', memo:'광고 · Omnicom 합병 추진', mcap:12, rsi:44, index:'SP500' },
  { sym:'LKQ', name:'LKQ Corp', sector:'Consumer', signal:'HOLD', memo:'자동차 부품 애프터마켓', mcap:10, rsi:44, index:'SP500' },
  { sym:'FSLR', name:'First Solar', sector:'Technology', signal:'HOLD', memo:'태양광 패널 · 미국 제조 · IRA', mcap:18, rsi:42, index:'SP500' },
  { sym:'ENPH', name:'Enphase Energy', sector:'Technology', signal:'WATCH', memo:'태양광 인버터 · 가정용 에너지', mcap:10, rsi:38, index:'SP500' },
  { sym:'ON', name:'ON Semiconductor', sector:'Technology', signal:'BUY', memo:'KeyBanc raised · 전력/센서 반도체 · EV · 산업 · 아날로그 전력반도체 가격인상 사이클 수혜', mcap:25, rsi:44, index:'SP500' },
  { sym:'SWKS', name:'Skyworks Solutions', sector:'Technology', signal:'BUY', memo:'Citi 우선선택(vs QCOM) · KeyBanc mixed: iPhone 18 출시 지연→2H26 near-est 상방 but 중국 수요 악화·ARM 아키텍처 마이그레이션으로 royalty↑ · RF 반도체 · Apple 공급망 · CSS→ARM9 이전 시 royalty 비용 증가 우려', mcap:14, rsi:42, index:'SP500' },
  { sym:'JBHT', name:'JB Hunt Transport', sector:'Industrials', signal:'HOLD', memo:'트럭/물류 · 인터모달', mcap:18, rsi:46, index:'SP500' },
  { sym:'JBL', name:'Jabil Inc', sector:'Technology', signal:'BUY', memo:'[JPM 04/17 OW top10] EMS 제조 + AI 서버 조립 · 하이퍼스케일러 수주 · CLS/FLEX와 함께 광학 프리미엄 완화 수혜 그룹', mcap:20, rsi:52, index:'SP500' },
  { sym:'RL', name:'Ralph Lauren', sector:'Consumer', signal:'HOLD', memo:'럭셔리 패션 · 브랜드', mcap:14, rsi:50, index:'SP500' },
  { sym:'KIM', name:'Kimco Realty', sector:'Real Estate', signal:'HOLD', memo:'리테일 REIT', mcap:15, rsi:48, index:'SP500' },
  { sym:'TFX', name:'Teleflex', sector:'Healthcare', signal:'HOLD', memo:'의료기기 · 카테터', mcap:10, rsi:44, index:'SP500' },
  { sym:'ILMN', name:'Illumina', sector:'Healthcare', signal:'WATCH', memo:'유전체 시퀀싱 · 정밀의료', mcap:15, rsi:42, index:'SP500' },
  { sym:'PTC', name:'PTC Inc', sector:'Technology', signal:'HOLD', memo:'CAD/PLM/IoT 소프트웨어', mcap:20, rsi:48, index:'SP500' },
  { sym:'ALB', name:'Albemarle', sector:'Materials', signal:'WATCH', memo:'리튬 · 2차전지 소재 · 변동성', mcap:10, rsi:38, index:'SP500' },
  { sym:'ALGN', name:'Align Technology', sector:'Healthcare', signal:'HOLD', memo:'인비절라인 투명교정', mcap:14, rsi:44, index:'SP500' },
  { sym:'NCLH', name:'Norwegian Cruise', sector:'Consumer', signal:'HOLD', memo:'크루즈 · 여행 수요', mcap:10, rsi:42, index:'SP500' },
  { sym:'BBWI', name:'Bath & Body Works', sector:'Consumer', signal:'HOLD', memo:'홈/바디 프래그런스', mcap:10, rsi:42, index:'SP500' },
  { sym:'MGM', name:'MGM Resorts', sector:'Consumer', signal:'HOLD', memo:'카지노 · 라스베가스', mcap:12, rsi:44, index:'SP500' },
  { sym:'APTV', name:'Aptiv', sector:'Consumer', signal:'HOLD', memo:'자동차 전장 · ADAS · 커넥터', mcap:14, rsi:42, index:'SP500' },
  { sym:'GEN', name:'Gen Digital', sector:'Technology', signal:'HOLD', memo:'Norton/Avast 사이버보안', mcap:18, rsi:50, index:'SP500' },
  { sym:'CZR', name:'Caesars Entertainment', sector:'Consumer', signal:'HOLD', memo:'카지노/호텔 · 부채 리스크', mcap:10, rsi:40, index:'SP500' },
  { sym:'CE', name:'Celanese', sector:'Materials', signal:'HOLD', memo:'아세틸/폴리머', mcap:10, rsi:38, index:'SP500' },
  { sym:'GL', name:'Globe Life', sector:'Financials', signal:'HOLD', memo:'생명보험 · 배당', mcap:12, rsi:46, index:'SP500' },
  { sym:'HRL', name:'Hormel Foods', sector:'Consumer Defensive', signal:'HOLD', memo:'육가공 · 배당왕', mcap:17, rsi:42, index:'SP500' },
  { sym:'AES', name:'AES Corp', sector:'Utilities', signal:'HOLD', memo:'재생에너지/LNG · 글로벌', mcap:12, rsi:42, index:'SP500' },
  { sym:'CMS', name:'CMS Energy', sector:'Utilities', signal:'HOLD', memo:'미시간 유틸리티', mcap:20, rsi:50, index:'SP500' },
  { sym:'AKAM', name:'Akamai', sector:'Technology', signal:'HOLD', memo:'CDN/엣지컴퓨팅', mcap:15, rsi:46, index:'SP500' },
  { sym:'WRK', name:'WestRock', sector:'Materials', signal:'HOLD', memo:'포장 · 골판지', mcap:12, rsi:44, index:'SP500' },
  { sym:'JNPR', name:'Juniper Networks', sector:'Technology', signal:'HOLD', memo:'네트워크 장비 · HPE 인수', mcap:14, rsi:48, index:'SP500' },
  { sym:'UDR', name:'UDR Inc', sector:'Real Estate', signal:'HOLD', memo:'아파트 REIT', mcap:15, rsi:48, index:'SP500' },
  { sym:'BXP', name:'Boston Properties', sector:'Real Estate', signal:'HOLD', memo:'오피스 REIT', mcap:12, rsi:42, index:'SP500' },
  { sym:'ALLE', name:'Allegion', sector:'Industrials', signal:'HOLD', memo:'보안/잠금장치 · Schlage', mcap:12, rsi:48, index:'SP500' },
  { sym:'AIZ', name:'Assurant', sector:'Financials', signal:'HOLD', memo:'특수보험 · 보증', mcap:10, rsi:48, index:'SP500' },
  { sym:'MHK', name:'Mohawk Industries', sector:'Consumer', signal:'HOLD', memo:'바닥재/타일 · 주택리모델링', mcap:10, rsi:42, index:'SP500' },
  { sym:'MTCH', name:'Match Group', sector:'Communication Services', signal:'HOLD', memo:'Tinder/Hinge 데이팅 앱', mcap:10, rsi:40, index:'SP500' },
  { sym:'GNRC', name:'Generac', sector:'Technology', signal:'HOLD', memo:'발전기 · 에너지 저장', mcap:10, rsi:44, index:'SP500' },
  { sym:'RHI', name:'Robert Half', sector:'Industrials', signal:'HOLD', memo:'인력 채용 · 컨설팅', mcap:10, rsi:42, index:'SP500' },
  { sym:'DAY', name:'Dayforce', sector:'Industrials', signal:'HOLD', memo:'HR 클라우드 · Ceridian 후속', mcap:10, rsi:46, index:'SP500' },
  { sym:'CHRW', name:'CH Robinson', sector:'Industrials', signal:'HOLD', memo:'물류 브로커 · 3PL', mcap:12, rsi:48, index:'SP500' },
  { sym:'HSIC', name:'Henry Schein', sector:'Healthcare', signal:'HOLD', memo:'치과/의료 유통', mcap:10, rsi:44, index:'SP500' },
  { sym:'DVN', name:'Devon Energy', sector:'Energy', signal:'HOLD', memo:'셰일 E&P · 변동배당', mcap:22, rsi:46, index:'SP500' },
  { sym:'LNT', name:'Alliant Energy', sector:'Utilities', signal:'HOLD', memo:'아이오와 유틸리티', mcap:15, rsi:50, index:'SP500' },
  { sym:'EVRG', name:'Evergy', sector:'Utilities', signal:'HOLD', memo:'캔자스 유틸리티', mcap:15, rsi:50, index:'SP500' },
  { sym:'FRT', name:'Federal Realty', sector:'Real Estate', signal:'HOLD', memo:'리테일 REIT · 배당왕', mcap:10, rsi:46, index:'SP500' },
  { sym:'TECH', name:'Bio-Techne', sector:'Healthcare', signal:'HOLD', memo:'단백질/항체 · 생명과학 도구', mcap:10, rsi:46, index:'SP500' },
  { sym:'REG', name:'Regency Centers', sector:'Real Estate', signal:'HOLD', memo:'쇼핑센터 REIT', mcap:12, rsi:48, index:'SP500' },
  { sym:'FFIV', name:'F5 Networks', sector:'Technology', signal:'HOLD', memo:'네트워크 보안/로드밸런싱', mcap:15, rsi:50, index:'SP500' },
  { sym:'IEX', name:'IDEX Corp', sector:'Industrials', signal:'HOLD', memo:'유체처리 · 방산', mcap:15, rsi:48, index:'SP500' },
  { sym:'CPT', name:'Camden Property', sector:'Real Estate', signal:'HOLD', memo:'선벨트 아파트 REIT', mcap:12, rsi:48, index:'SP500' },
  { sym:'INCY', name:'Incyte', sector:'Healthcare', signal:'HOLD', memo:'항암/면역 바이오 · Jakafi', mcap:15, rsi:46, index:'SP500' },
  { sym:'BIO', name:'Bio-Rad Labs', sector:'Healthcare', signal:'HOLD', memo:'생명과학 기기 · 진단', mcap:10, rsi:46, index:'SP500' },
  { sym:'VTRS', name:'Viatris', sector:'Healthcare', signal:'HOLD', memo:'제네릭 의약품 · 배당', mcap:12, rsi:46, index:'SP500' },
  { sym:'CRL', name:'Charles River Labs', sector:'Healthcare', signal:'HOLD', memo:'CRO · 전임상 서비스', mcap:10, rsi:42, index:'SP500' },
  { sym:'TPR', name:'Tapestry', sector:'Consumer', signal:'HOLD', memo:'Coach/Kate Spade · 럭셔리', mcap:14, rsi:48, index:'SP500' },
  { sym:'SWK', name:'Stanley Black & Decker', sector:'Industrials', signal:'HOLD', memo:'전동공구 · DeWalt', mcap:12, rsi:42, index:'SP500' },
  { sym:'PAYC', name:'Paycom', sector:'Technology', signal:'HOLD', memo:'HR/급여 클라우드 SaaS', mcap:12, rsi:46, index:'SP500' },
  { sym:'EPAM', name:'EPAM Systems', sector:'Technology', signal:'HOLD', memo:'IT 아웃소싱 · 동유럽 기반', mcap:12, rsi:44, index:'SP500' },
  { sym:'RVTY', name:'Revvity', sector:'Healthcare', signal:'HOLD', memo:'생명과학 진단 · PerkinElmer', mcap:12, rsi:46, index:'SP500' },
  { sym:'SOLV', name:'Solventum', sector:'Healthcare', signal:'HOLD', memo:'3M 헬스케어 분사 · 의료용품', mcap:10, rsi:42, index:'SP500' },
  { sym:'BWA', name:'BorgWarner', sector:'Industrials', signal:'HOLD', memo:'자동차 파워트레인 · EV 전환', mcap:10, rsi:42, index:'SP500' },
  { sym:'PSKY', name:'Paramount Skydance', sector:'Communication Services', signal:'WATCH', memo:'CBS · Paramount+ · Skydance 합병 완료 (2025.8) · Warner Bros Discovery 인수 추진', mcap:10, rsi:38, index:'' },
  { sym:'WYNN', name:'Wynn Resorts', sector:'Consumer', signal:'HOLD', memo:'카지노 · 마카오/라스베가스', mcap:10, rsi:44, index:'SP500' },
  { sym:'CHTR', name:'Charter Communications', sector:'Communication Services', signal:'HOLD', memo:'미국 2위 케이블TV · Spectrum', mcap:50, rsi:46, index:'SP500' },
  { sym:'CPRT', name:'Copart', sector:'Industrials', signal:'HOLD', memo:'온라인 자동차 경매 · 보험 폐차', mcap:55, rsi:52, index:'SP500' },
  { sym:'DLTR', name:'Dollar Tree', sector:'Consumer', signal:'HOLD', memo:'달러스토어 · Family Dollar', mcap:15, rsi:42, index:'SP500' },
  { sym:'DXCM', name:'DexCom', sector:'Healthcare', signal:'HOLD', memo:'연속 혈당 모니터(CGM) · 당뇨관리', mcap:30, rsi:42, index:'SP500' },
  { sym:'GFS', name:'GlobalFoundries', sector:'Technology', signal:'HOLD', memo:'반도체 파운드리 · 비첨단 공정 특화', mcap:25, rsi:44, index:'SP500' },
  { sym:'MCHP', name:'Microchip Technology', sector:'Technology', signal:'HOLD', memo:'마이크로컨트롤러 · 아날로그 · 자동차', mcap:30, rsi:42, index:'SP500' },
  { sym:'ODFL', name:'Old Dominion Freight', sector:'Industrials', signal:'HOLD', memo:'LTL 화물 · 미국 최고 효율', mcap:40, rsi:48, index:'SP500' },
  { sym:'FOXA', name:'Fox Corp A', sector:'Communication Services', signal:'HOLD', memo:'Fox News · 스포츠', mcap:20, rsi:48, index:'SP500' },
  { sym:'FOX', name:'Fox Corp B', sector:'Communication Services', signal:'HOLD', memo:'Fox News · 스포츠 · B주', mcap:20, rsi:48, index:'SP500' },
  { sym:'NWSA', name:'News Corp A', sector:'Communication Services', signal:'HOLD', memo:'WSJ · 출판/미디어', mcap:18, rsi:48, index:'SP500' },
  { sym:'NWS', name:'News Corp B', sector:'Communication Services', signal:'HOLD', memo:'WSJ · 출판/미디어 · B주', mcap:18, rsi:48, index:'SP500' },
  { sym:'BABA', name:'Alibaba', sector:'Technology', signal:'WATCH', memo:'중국 최대 이커머스 · 클라우드 · ADR', mcap:351, rsi:55, index:'NYSE' },
  { sym:'SAP', name:'SAP SE', sector:'Technology', signal:'HOLD', memo:'ERP 글로벌 1위 · 클라우드 전환 · ADR', mcap:234, rsi:50, index:'NYSE' },
  { sym:'NVO', name:'Novo Nordisk', sector:'Healthcare', signal:'BUY', memo:'비만/당뇨 Ozempic · GLP-1 · ADR', mcap:216, rsi:42, index:'NYSE' },
  { sym:'NVS', name:'Novartis', sector:'Healthcare', signal:'HOLD', memo:'글로벌 제약 · 항암/면역 · ADR', mcap:307, rsi:52, index:'NYSE' },
  { sym:'AZN', name:'AstraZeneca', sector:'Healthcare', signal:'HOLD', memo:'항암제 · 면역치료 · ADR', mcap:315, rsi:48, index:'NYSE' },
  { sym:'HSBC', name:'HSBC Holdings', sector:'Financials', signal:'HOLD', memo:'글로벌 은행 · 아시아 강세 · ADR', mcap:296, rsi:54, index:'NYSE' },
  { sym:'TM', name:'Toyota Motor', sector:'Consumer', signal:'HOLD', memo:'세계 최대 자동차 · 하이브리드 · ADR', mcap:323, rsi:50, index:'NYSE' },
  { sym:'SHEL', name:'Shell plc', sector:'Energy', signal:'HOLD', memo:'글로벌 에너지 메이저 · LNG · ADR', mcap:223, rsi:50, index:'NYSE' },
  { sym:'RIO', name:'Rio Tinto', sector:'Materials', signal:'HOLD', memo:'글로벌 광업 · 철광석/구리 · ADR', mcap:168, rsi:48, index:'NYSE' },
  { sym:'BHP', name:'BHP Group', sector:'Materials', signal:'HOLD', memo:'세계 최대 광업 · 철광석/구리 · ADR', mcap:184, rsi:46, index:'NYSE' },
  { sym:'MUFG', name:'MUFG Financial', sector:'Financials', signal:'HOLD', memo:'일본 최대 은행 · ADR', mcap:223, rsi:52, index:'NYSE' },
  { sym:'SMFG', name:'Sumitomo Mitsui FG', sector:'Financials', signal:'HOLD', memo:'일본 3대 은행 · ADR', mcap:152, rsi:52, index:'NYSE' },
  { sym:'MFG', name:'Mizuho Financial', sector:'Financials', signal:'HOLD', memo:'일본 메가뱅크 · ADR', mcap:124, rsi:50, index:'NYSE' },
  { sym:'UBS', name:'UBS Group', sector:'Financials', signal:'HOLD', memo:'스위스 투자은행 · Credit Suisse 합병 · ADR', mcap:129, rsi:50, index:'NYSE' },
  { sym:'PDD', name:'PDD Holdings', sector:'Technology', signal:'WATCH', memo:'Temu/핀둬둬 · 중국 이커머스 · ADR', mcap:142, rsi:50, index:'NASDAQ100' },
  { sym:'SONY', name:'Sony Group', sector:'Technology', signal:'HOLD', memo:'게임/엔터/반도체 · PS5 · ADR', mcap:139, rsi:48, index:'NYSE' },
  { sym:'SCCO', name:'Southern Copper', sector:'Materials', signal:'HOLD', memo:'구리 생산 · 전기화 수혜 · ADR', mcap:160, rsi:50, index:'NYSE' },
  { sym:'SAN', name:'Banco Santander', sector:'Financials', signal:'HOLD', memo:'스페인 최대 은행 · ADR', mcap:178, rsi:55, index:'NYSE' },
  { sym:'BBVA', name:'BBVA', sector:'Financials', signal:'HOLD', memo:'스페인 2위 은행 · 라틴 · ADR', mcap:133, rsi:55, index:'NYSE' },
  { sym:'BTI', name:'British American Tobacco', sector:'Consumer Defensive', signal:'HOLD', memo:'담배 · 고배당 · ADR', mcap:130, rsi:50, index:'NYSE' },
  { sym:'UL', name:'Unilever', sector:'Consumer Defensive', signal:'HOLD', memo:'글로벌 소비재 · 식품/뷰티 · ADR', mcap:162, rsi:50, index:'NYSE' },
  { sym:'BUD', name:'Anheuser-Busch InBev', sector:'Consumer Defensive', signal:'HOLD', memo:'세계 최대 맥주 · ADR', mcap:159, rsi:48, index:'NYSE' },
  { sym:'TTE', name:'TotalEnergies', sector:'Energy', signal:'HOLD', memo:'프랑스 에너지 메이저 · ADR', mcap:163, rsi:50, index:'NYSE' },
  { sym:'BP', name:'BP plc', sector:'Energy', signal:'HOLD', memo:'영국 에너지 메이저 · ADR', mcap:96, rsi:48, index:'NYSE' },
  { sym:'HDB', name:'HDFC Bank', sector:'Financials', signal:'HOLD', memo:'인도 최대 민영은행 · ADR', mcap:154, rsi:50, index:'NYSE' },
  { sym:'IBN', name:'ICICI Bank', sector:'Financials', signal:'HOLD', memo:'인도 2위 민영은행 · ADR', mcap:113, rsi:48, index:'NYSE' },
  { sym:'BCS', name:'Barclays', sector:'Financials', signal:'HOLD', memo:'영국 투자은행 · ADR', mcap:87, rsi:52, index:'NYSE' },
  { sym:'DB', name:'Deutsche Bank', sector:'Financials', signal:'HOLD', memo:'독일 최대 은행 · ADR', mcap:70, rsi:50, index:'NYSE' },
  { sym:'ING', name:'ING Groep', sector:'Financials', signal:'HOLD', memo:'네덜란드 은행 · ADR', mcap:84, rsi:50, index:'NYSE' },
  { sym:'TD', name:'Toronto-Dominion', sector:'Financials', signal:'HOLD', memo:'캐나다 최대 은행 · ADR', mcap:160, rsi:48, index:'NYSE' },
  { sym:'RY', name:'Royal Bank of Canada', sector:'Financials', signal:'HOLD', memo:'캐나다 2위 은행 · ADR', mcap:237, rsi:52, index:'NYSE' },
  { sym:'BMO', name:'Bank of Montreal', sector:'Financials', signal:'HOLD', memo:'캐나다 은행 · ADR', mcap:100, rsi:48, index:'NYSE' },
  { sym:'BNS', name:'Bank of Nova Scotia', sector:'Financials', signal:'HOLD', memo:'캐나다 은행 · ADR', mcap:94, rsi:48, index:'NYSE' },
  { sym:'CM', name:'CIBC', sector:'Financials', signal:'HOLD', memo:'캐나다 은행 · ADR', mcap:88, rsi:48, index:'NYSE' },
  { sym:'SNY', name:'Sanofi', sector:'Healthcare', signal:'HOLD', memo:'프랑스 제약 · 면역/희귀질환 · ADR', mcap:113, rsi:48, index:'NYSE' },
  { sym:'GSK', name:'GSK plc', sector:'Healthcare', signal:'HOLD', memo:'영국 제약 · 백신/면역 · ADR', mcap:117, rsi:48, index:'NYSE' },
  { sym:'TAK', name:'Takeda Pharma', sector:'Healthcare', signal:'HOLD', memo:'일본 최대 제약 · ADR', mcap:58, rsi:48, index:'NYSE' },
  { sym:'ENB', name:'Enbridge', sector:'Energy', signal:'HOLD', memo:'캐나다 파이프라인 · 고배당 · ADR', mcap:113, rsi:50, index:'NYSE' },
  { sym:'EPD', name:'Enterprise Products', sector:'Energy', signal:'HOLD', memo:'미국 최대 MLP · 배당 · 파이프라인', mcap:78, rsi:52, index:'NYSE' },
  { sym:'ET', name:'Energy Transfer', sector:'Energy', signal:'HOLD', memo:'MLP · 천연가스 · 고배당', mcap:63, rsi:52, index:'NYSE' },
  { sym:'SU', name:'Suncor Energy', sector:'Energy', signal:'HOLD', memo:'캐나다 오일샌드 · ADR', mcap:65, rsi:50, index:'NYSE' },
  { sym:'CNQ', name:'Canadian Natural Res', sector:'Energy', signal:'HOLD', memo:'캐나다 최대 석유 생산 · ADR', mcap:83, rsi:50, index:'NYSE' },
  { sym:'EQNR', name:'Equinor', sector:'Energy', signal:'HOLD', memo:'노르웨이 국영 에너지 · ADR', mcap:70, rsi:48, index:'NYSE' },
  { sym:'VALE', name:'Vale SA', sector:'Materials', signal:'HOLD', memo:'브라질 철광석 · 니켈 · ADR', mcap:73, rsi:44, index:'NYSE' },
  { sym:'PBR', name:'Petrobras', sector:'Energy', signal:'HOLD', memo:'브라질 국영 에너지 · 고배당 · ADR', mcap:96, rsi:48, index:'NYSE' },
  { sym:'ITUB', name:'Itau Unibanco', sector:'Financials', signal:'HOLD', memo:'브라질 최대 은행 · ADR', mcap:99, rsi:48, index:'NYSE' },
  { sym:'INFY', name:'Infosys', sector:'Technology', signal:'HOLD', memo:'인도 IT 아웃소싱 · ADR', mcap:62, rsi:46, index:'NYSE' },
  { sym:'NTES', name:'NetEase', sector:'Technology', signal:'HOLD', memo:'중국 게임/음악 · ADR', mcap:88, rsi:50, index:'NASDAQ100' },
  { sym:'JD', name:'JD.com', sector:'Technology', signal:'WATCH', memo:'중국 이커머스 · 물류 · ADR', mcap:41, rsi:48, index:'NASDAQ100' },
  { sym:'BIDU', name:'Baidu', sector:'Technology', signal:'WATCH', memo:'중국 검색/AI · 자율주행 · ADR', mcap:43, rsi:46, index:'NASDAQ100' },
  { sym:'TCOM', name:'Trip.com', sector:'Consumer', signal:'HOLD', memo:'중국 최대 온라인여행 · ADR', mcap:47, rsi:50, index:'NASDAQ100' },
  { sym:'CPNG', name:'Coupang', sector:'Technology', signal:'HOLD', memo:'한국 이커머스 · ADR', mcap:45, rsi:48, index:'NYSE' },
  { sym:'AMX', name:'America Movil', sector:'Communication Services', signal:'HOLD', memo:'라틴아메리카 통신 · ADR', mcap:72, rsi:48, index:'NYSE' },
  { sym:'LYG', name:'Lloyds Banking', sector:'Financials', signal:'HOLD', memo:'영국 최대 리테일 은행 · ADR', mcap:81, rsi:50, index:'NYSE' },
  { sym:'NWG', name:'NatWest Group', sector:'Financials', signal:'HOLD', memo:'영국 은행 · ADR', mcap:65, rsi:50, index:'NYSE' },
  { sym:'NGG', name:'National Grid', sector:'Utilities', signal:'HOLD', memo:'영/미 전력망 · ADR', mcap:92, rsi:50, index:'NYSE' },
  { sym:'RELX', name:'RELX plc', sector:'Industrials', signal:'HOLD', memo:'데이터/분석/출판 · ADR', mcap:51, rsi:50, index:'NYSE' },
  { sym:'DEO', name:'Diageo', sector:'Consumer Defensive', signal:'HOLD', memo:'주류 글로벌 1위 · 기네스/조니워커 · ADR', mcap:56, rsi:44, index:'NYSE' },
  { sym:'HLN', name:'Haleon', sector:'Healthcare', signal:'HOLD', memo:'소비자 헬스케어 · GSK 분사 · ADR', mcap:45, rsi:48, index:'NYSE' },
  { sym:'RACE', name:'Ferrari', sector:'Consumer', signal:'HOLD', memo:'럭셔리 자동차 · 프리미엄 밸류에이션', mcap:69, rsi:50, index:'NYSE' },
  { sym:'MFC', name:'Manulife Financial', sector:'Financials', signal:'HOLD', memo:'캐나다 보험 · 아시아 · ADR', mcap:60, rsi:50, index:'NYSE' },
  { sym:'B', name:'Barrick Mining', sector:'Materials', signal:'HOLD', memo:'세계 2위 금광 · ADR', mcap:76, rsi:55, index:'NYSE' },
  { sym:'AU', name:'AngloGold Ashanti', sector:'Materials', signal:'HOLD', memo:'금광 · 아프리카/호주 · ADR', mcap:55, rsi:55, index:'NYSE' },
  { sym:'AEM', name:'Agnico Eagle Mines', sector:'Materials', signal:'HOLD', memo:'금광 · 안정적 생산 · ADR', mcap:108, rsi:55, index:'NYSE' },
  { sym:'WPM', name:'Wheaton Precious Metals', sector:'Materials', signal:'HOLD', memo:'금/은 스트리밍 · 로열티 · ADR', mcap:63, rsi:55, index:'NYSE' },
  { sym:'FNV', name:'Franco-Nevada', sector:'Materials', signal:'HOLD', memo:'금/은 로열티 스트리밍 · ADR', mcap:42, rsi:52, index:'NYSE' },
  { sym:'GFI', name:'Gold Fields', sector:'Materials', signal:'HOLD', memo:'남아공 금광 · ADR', mcap:40, rsi:55, index:'NYSE' },
  { sym:'TRP', name:'TC Energy', sector:'Energy', signal:'HOLD', memo:'캐나다 파이프라인 · 배당 · ADR', mcap:61, rsi:50, index:'NYSE' },
  { sym:'CP', name:'Canadian Pacific KC', sector:'Industrials', signal:'HOLD', memo:'캐나다~멕시코 철도 · ADR', mcap:75, rsi:48, index:'NYSE' },
  { sym:'CNI', name:'Canadian National Railway', sector:'Industrials', signal:'HOLD', memo:'캐나다 철도 · 물류 · ADR', mcap:65, rsi:48, index:'NYSE' },
  { sym:'IMO', name:'Imperial Oil', sector:'Energy', signal:'HOLD', memo:'캐나다 석유 · Exxon 자회사 · ADR', mcap:56, rsi:50, index:'NYSE' },
  { sym:'E', name:'Eni SpA', sector:'Energy', signal:'HOLD', memo:'이탈리아 에너지 메이저 · ADR', mcap:65, rsi:48, index:'NYSE' },
  { sym:'ARES', name:'Ares Management', sector:'Financials', signal:'HOLD', memo:'대체투자 · 크레딧 전문', mcap:55, rsi:50, index:'SP500' },
  { sym:'BAM', name:'Brookfield Asset Mgmt', sector:'Financials', signal:'HOLD', memo:'인프라/재생에너지 투자 · ADR', mcap:86, rsi:50, index:'NYSE' },
  { sym:'BN', name:'Brookfield Corp', sector:'Financials', signal:'HOLD', memo:'글로벌 대체투자 · 인프라 · ADR', mcap:107, rsi:50, index:'NYSE' },
  { sym:'WY', name:'Weyerhaeuser', sector:'Real Estate', signal:'HOLD', memo:'목재/부동산 REIT · 주택시장', mcap:25, rsi:46, index:'SP500' },
  { sym:'MPLX', name:'MPLX LP', sector:'Energy', signal:'HOLD', memo:'MLP · 미드스트림 · 고배당', mcap:57, rsi:52, index:'NYSE' },
  { sym:'LNG', name:'Cheniere Energy', sector:'Energy', signal:'HOLD', memo:'미국 최대 LNG 수출 · 에너지 안보', mcap:41, rsi:50, index:'SP500' },
  { sym:'CCEP', name:'Coca-Cola Europacific', sector:'Consumer Defensive', signal:'HOLD', memo:'코카콜라 유럽/태평양 보틀러', mcap:41, rsi:50, index:'NYSE' },
  { sym:'CCL', name:'Carnival Corp', sector:'Consumer', signal:'HOLD', memo:'크루즈 · 여행 수요 회복', mcap:40, rsi:44, index:'SP500' },
  { sym:'ALNY', name:'Alnylam Pharma', sector:'Healthcare', signal:'HOLD', memo:'RNAi 치료제 · 희귀질환', mcap:53, rsi:48, index:'SP500' },
  { sym:'ARGX', name:'argenx SE', sector:'Healthcare', signal:'HOLD', memo:'자가면역 항체치료 · Vyvgart · ADR', mcap:51, rsi:48, index:'NASDAQ100' },
  { sym:'TKO', name:'TKO Group', sector:'Communication Services', signal:'HOLD', memo:'WWE+UFC 합병 · 스포츠 엔터', mcap:42, rsi:50, index:'NYSE' },
  { sym:'FERG', name:'Ferguson Enterprises', sector:'Industrials', signal:'HOLD', memo:'배관/HVAC 유통 · 인프라', mcap:51, rsi:48, index:'SP500' },
  { sym:'TRI', name:'Thomson Reuters', sector:'Industrials', signal:'HOLD', memo:'법률/세무/뉴스 데이터 · ADR', mcap:59, rsi:50, index:'NYSE' },
  { sym:'MDLN', name:'Medline Inc', sector:'Healthcare', signal:'HOLD', memo:'의료용품 유통 · 최근 IPO', mcap:57, rsi:48, index:'NYSE' },
  { sym:'WCN', name:'Waste Connections', sector:'Industrials', signal:'HOLD', memo:'폐기물 처리 · 안정 성장 · ADR', mcap:46, rsi:52, index:'NYSE' },
  { sym:'HEI', name:'HEICO Corp', sector:'Industrials', signal:'HOLD', memo:'항공기 부품 · 방산', mcap:46, rsi:50, index:'SP500' },
  { sym:'FER', name:'Ferrovial', sector:'Industrials', signal:'HOLD', memo:'인프라 · 톨도로/공항 · ADR', mcap:53, rsi:48, index:'NYSE' },
  { sym:'TEAM', name:'Atlassian', sector:'Technology', signal:'HOLD', memo:'Jira/Confluence · 개발도구 · ADR', mcap:43, rsi:46, index:'NASDAQ100' },
  { sym:'RKT', name:'Rocket Companies', sector:'Financials', signal:'HOLD', memo:'온라인 모기지 · 핀테크', mcap:54, rsi:50, index:'NYSE' },
  { sym:'SPY', name:'SPDR S&P 500 ETF', sector:'ETF', signal:'HOLD', memo:'S&P 500 · 세계 최대 ETF', mcap:580, rsi:50, index:'SP500' },
  { sym:'QQQ', name:'Invesco QQQ Trust', sector:'ETF', signal:'HOLD', memo:'나스닥 100 · 기술주 중심', mcap:280, rsi:48, index:'NASDAQ100' },
  { sym:'VTI', name:'Vanguard Total Market', sector:'ETF', signal:'HOLD', memo:'미국 전체 시장 4,000+', mcap:420, rsi:50, index:'SP500' },
  { sym:'VOO', name:'Vanguard S&P 500', sector:'ETF', signal:'HOLD', memo:'S&P 500 · 저비용 0.03%', mcap:530, rsi:50, index:'SP500' },
  { sym:'IVV', name:'iShares Core S&P 500', sector:'ETF', signal:'HOLD', memo:'S&P 500 · iShares', mcap:510, rsi:50, index:'SP500' },
  { sym:'SOXX', name:'iShares Semiconductor', sector:'ETF', signal:'HOLD', memo:'반도체 ETF', mcap:15, rsi:48, index:'NASDAQ100' },
  { sym:'ARKK', name:'ARK Innovation', sector:'ETF', signal:'WATCH', memo:'캐시 우드 · 파괴적 혁신', mcap:6, rsi:42, index:'NYSE' },
  { sym:'ARKG', name:'ARK Genomic', sector:'ETF', signal:'WATCH', memo:'유전체/바이오 혁신', mcap:2, rsi:40, index:'NYSE' },
  { sym:'ARKF', name:'ARK Fintech', sector:'ETF', signal:'WATCH', memo:'핀테크 혁신 · 크립토', mcap:1, rsi:42, index:'NYSE' },
  { sym:'GLD', name:'SPDR Gold', sector:'ETF', signal:'HOLD', memo:'금 현물 · 인플레 헤지', mcap:80, rsi:55, index:'NYSE' },
  { sym:'SLV', name:'iShares Silver', sector:'ETF', signal:'HOLD', memo:'은 현물', mcap:14, rsi:52, index:'NYSE' },
  { sym:'USO', name:'US Oil Fund', sector:'ETF', signal:'HOLD', memo:'WTI 원유 선물', mcap:3, rsi:48, index:'NYSE' },
  { sym:'TLT', name:'iShares 20+ Treasury', sector:'ETF', signal:'HOLD', memo:'장기국채 · 금리 역상관 · 헤지', mcap:50, rsi:44, index:'NASDAQ100' },
  { sym:'TIP', name:'iShares TIPS', sector:'ETF', signal:'HOLD', memo:'물가연동 국채', mcap:20, rsi:48, index:'NYSE' },
  { sym:'HYG', name:'iShares High Yield', sector:'ETF', signal:'HOLD', memo:'하이일드 회사채 · 크레딧', mcap:15, rsi:48, index:'NYSE' },
  { sym:'LQD', name:'iShares Inv Grade', sector:'ETF', signal:'HOLD', memo:'투자등급 회사채', mcap:30, rsi:48, index:'NYSE' },
  { sym:'SHY', name:'iShares 1-3Y Treasury', sector:'ETF', signal:'HOLD', memo:'단기국채 · 현금 대안', mcap:25, rsi:52, index:'NYSE' },
  { sym:'BND', name:'Vanguard Total Bond', sector:'ETF', signal:'HOLD', memo:'종합 채권', mcap:100, rsi:48, index:'NYSE' },
  { sym:'AGG', name:'iShares US Aggregate', sector:'ETF', signal:'HOLD', memo:'종합 채권', mcap:110, rsi:48, index:'NYSE' },
  { sym:'EEM', name:'iShares Emerging', sector:'ETF', signal:'HOLD', memo:'신흥국 · 중국/인도/한국', mcap:20, rsi:46, index:'NYSE' },
  { sym:'EFA', name:'iShares EAFE', sector:'ETF', signal:'HOLD', memo:'선진국(미국제외) · 유럽/일본', mcap:50, rsi:48, index:'NYSE' },
  { sym:'FXI', name:'iShares China', sector:'ETF', signal:'WATCH', memo:'중국 대형주', mcap:8, rsi:50, index:'NYSE' },
  { sym:'EWJ', name:'iShares Japan', sector:'ETF', signal:'HOLD', memo:'일본 주식', mcap:15, rsi:48, index:'NYSE' },
  { sym:'EWY', name:'iShares Korea', sector:'ETF', signal:'HOLD', memo:'한국 주식 · 삼성/SK', mcap:5, rsi:46, index:'NYSE' },
  { sym:'VWO', name:'Vanguard Emerging', sector:'ETF', signal:'HOLD', memo:'신흥국 · 저비용', mcap:70, rsi:46, index:'NYSE' },
  { sym:'INDA', name:'iShares India', sector:'ETF', signal:'HOLD', memo:'인도 주식', mcap:10, rsi:48, index:'NYSE' },
  { sym:'VXX', name:'iPath VIX', sector:'ETF', signal:'WATCH', memo:'VIX 선물 · 단기 헤지', mcap:1, rsi:45, index:'NYSE' },
  { sym:'UVXY', name:'ProShares Ultra VIX', sector:'ETF', signal:'WATCH', memo:'VIX 1.5X · 초단기 헤지', mcap:1, rsi:45, index:'NYSE' },


  // ── 섹터/테마 ETF 보강 ──
  { sym:'XLK', name:'Technology Select Sector SPDR', sector:'ETF', signal:'HOLD', memo:'기술 섹터 ETF · AAPL MSFT NVDA 등', mcap:0, rsi:50, index:'ETF' },
  { sym:'AMLP', name:'Alerian MLP ETF', sector:'ETF', signal:'HOLD', memo:'MLP 미드스트림 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'BOTZ', name:'Global X Robotics & AI ETF', sector:'ETF', signal:'HOLD', memo:'로봇/AI ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'GDX', name:'VanEck Gold Miners ETF', sector:'ETF', signal:'HOLD', memo:'금광 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'HACK', name:'ETFMG Prime Cyber Security ETF', sector:'ETF', signal:'HOLD', memo:'사이버보안 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'ICLN', name:'iShares Global Clean Energy ETF', sector:'ETF', signal:'HOLD', memo:'클린에너지 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'IGV', name:'iShares Expanded Tech-Software ETF', sector:'ETF', signal:'HOLD', memo:'소프트웨어 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'ITA', name:'iShares US Aerospace & Defense ETF', sector:'ETF', signal:'HOLD', memo:'방위산업 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'LIT', name:'Global X Lithium & Battery ETF', sector:'ETF', signal:'HOLD', memo:'리튬/배터리 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'OIH', name:'VanEck Oil Services ETF', sector:'ETF', signal:'HOLD', memo:'유전서비스 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'SMH', name:'VanEck Semiconductor ETF', sector:'ETF', signal:'HOLD', memo:'반도체 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'URA', name:'Global X Uranium ETF', sector:'ETF', signal:'HOLD', memo:'우라늄 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'XBI', name:'SPDR S&P Biotech ETF', sector:'ETF', signal:'HOLD', memo:'바이오테크 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'XLB', name:'Materials Select Sector SPDR', sector:'Materials', signal:'HOLD', memo:'소재 섹터 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'XLC', name:'Communication Services Select SPDR', sector:'Communication Services', signal:'HOLD', memo:'커뮤니케이션 섹터 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'XLE', name:'Energy Select Sector SPDR', sector:'Energy', signal:'HOLD', memo:'에너지 섹터 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'XLF', name:'Financial Select Sector SPDR', sector:'Financials', signal:'HOLD', memo:'금융 섹터 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'XLI', name:'Industrial Select Sector SPDR', sector:'Industrials', signal:'HOLD', memo:'산업재 섹터 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'XLP', name:'Consumer Staples Select SPDR', sector:'Consumer Defensive', signal:'HOLD', memo:'필수소비재 섹터 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'XLRE', name:'Real Estate Select SPDR', sector:'Real Estate', signal:'HOLD', memo:'부동산 섹터 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'XLU', name:'Utilities Select Sector SPDR', sector:'Utilities', signal:'HOLD', memo:'유틸리티 섹터 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'XLV', name:'Health Care Select Sector SPDR', sector:'Healthcare', signal:'HOLD', memo:'헬스케어 섹터 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'XLY', name:'Consumer Discretionary Select SPDR', sector:'Consumer', signal:'HOLD', memo:'임의소비재 섹터 ETF', mcap:0, rsi:50, index:'ETF' },
  { sym:'XOP', name:'SPDR S&P Oil & Gas Exploration ETF', sector:'ETF', signal:'HOLD', memo:'석유가스 탐사 ETF', mcap:0, rsi:50, index:'ETF' },
  // ── 테마 누락분 보강 ──
  { sym:'ABB', name:'ABB Ltd', sector:'Industrials', signal:'HOLD', memo:'산업자동화 · 로봇 · 전력장비 글로벌 리더', mcap:96, rsi:52, index:'ADR' },
  { sym:'ADM', name:'Archer-Daniels-Midland', sector:'Consumer Defensive', signal:'HOLD', memo:'곡물 트레이딩 · 식품 가공 메이저', mcap:22, rsi:44, index:'SP500' },
  { sym:'ES', name:'Eversource Energy', sector:'Utilities', signal:'HOLD', memo:'뉴잉글랜드 유틸리티 · 전력/가스 배전', mcap:22, rsi:50, index:'SP500' },
  { sym:'FANUY', name:'Fanuc Corp', sector:'Industrials', signal:'HOLD', memo:'일본 산업용 로봇·CNC 세계 1위', mcap:30, rsi:48, index:'ADR' },
  // IIVI removed — merged into COHR (Coherent Corp)
  { sym:'JETS', name:'US Global Jets ETF', sector:'ETF', signal:'HOLD', memo:'항공산업 ETF · 미국 항공사 집중', mcap:0, rsi:50, index:'ETF' },
  { sym:'NDSN', name:'Nordson Corp', sector:'Industrials', signal:'HOLD', memo:'정밀 분사·접착 장비 · 니치 산업 리더', mcap:13, rsi:48, index:'SP500' },
  { sym:'PNW', name:'Pinnacle West Capital', sector:'Utilities', signal:'HOLD', memo:'애리조나 전력 유틸리티 · APS 자회사', mcap:11, rsi:52, index:'SP500' },
  { sym:'TPL', name:'Texas Pacific Land', sector:'Energy', signal:'HOLD', memo:'텍사스 로열티/수자원 · 퍼미안 분지 광대한 토지', mcap:35, rsi:55, index:'SP500' },
  // ── THEME↔SCREENER 불일치 보강 (v34.7 감사) ──
  { sym:'AA', name:'Alcoa Corp', sector:'Basic Materials', signal:'HOLD', memo:'알루미늄 정련/제련 글로벌 리더 · 원자재 사이클', mcap:8, rsi:45, index:'SP500' },
  { sym:'BIIB', name:'Biogen', sector:'Healthcare', signal:'HOLD', memo:'알츠하이머 Leqembi · 바이오시밀러 · 신경과학 선두', mcap:23, rsi:42, index:'SP500' },
  { sym:'CLSK', name:'CleanSpark', sector:'Technology', signal:'WATCH', memo:'BTC 채굴 · 미국 내 친환경 마이닝 · 해시레이트 급성장', mcap:3, rsi:55, index:'NASDAQ' },
  { sym:'ETSY', name:'Etsy', sector:'Consumer Cyclical', signal:'HOLD', memo:'핸드메이드/빈티지 이커머스 · 크리에이터 경제', mcap:7, rsi:40, index:'SP500' },
  { sym:'LAC', name:'Lithium Americas', sector:'Basic Materials', signal:'WATCH', memo:'Thacker Pass 리튬 광산 · 미국 내 최대 리튬 프로젝트', mcap:3, rsi:38, index:'NYSE' },
  { sym:'MASI', name:'Masimo Corp', sector:'Healthcare', signal:'HOLD', memo:'맥박산소측정기 · 비침습 모니터링 · 의료기기 혁신', mcap:8, rsi:44, index:'NASDAQ' },
  { sym:'MP', name:'MP Materials', sector:'Basic Materials', signal:'WATCH', memo:'희토류 채굴/가공 · 미국 유일 통합 생산 · EV 자석', mcap:4, rsi:42, index:'NYSE' },
  { sym:'RUN', name:'Sunrun', sector:'Utilities', signal:'WATCH', memo:'미국 최대 가정용 태양광 설치 · 리스 모델', mcap:4, rsi:48, index:'NASDAQ' },
  { sym:'SEDG', name:'SolarEdge Technologies', sector:'Technology', signal:'WATCH', memo:'태양광 인버터/옵티마이저 · 유럽 시장 강세', mcap:2, rsi:35, index:'NASDAQ' },
  { sym:'STAG', name:'STAG Industrial', sector:'Real Estate', signal:'HOLD', memo:'물류/산업용 리츠 · 단일 테넌트 · 매월 배당', mcap:7, rsi:50, index:'SP500' },
  { sym:'IBIT', name:'iShares Bitcoin Trust ETF', sector:'ETF', signal:'HOLD', memo:'BlackRock 비트코인 현물 ETF · AUM 최대', mcap:0, rsi:52, index:'ETF' },
  { sym:'BITO', name:'ProShares Bitcoin Strategy ETF', sector:'ETF', signal:'HOLD', memo:'비트코인 선물 ETF · 최초 승인', mcap:0, rsi:50, index:'ETF' },
  { sym:'QBTS', name:'D-Wave Quantum', sector:'Technology', signal:'WATCH', memo:'양자컴퓨터 상용화 선두 · 어닐링 방식', mcap:2, rsi:58, index:'NYSE' },
  { sym:'UMC', name:'United Microelectronics', sector:'Technology', signal:'HOLD', memo:'대만 파운드리 · 성숙 공정 특화 · TSMC 대안', mcap:18, rsi:45, index:'ADR' },

  // ═══ v35.6: 한국 KOSPI/KOSDAQ 종합 종목 데이터베이스 (150+종목) ═══
  // 시총 상위 대형주 (KOSPI 시총 TOP)
  { sym:'005930.KS', name:'삼성전자', sector:'Technology', signal:'BUY', memo:'[GS 04/15 Buy 유지] 미국 투자자 선호 SEC>HXSCL — 일반메모리 비중↑=이익 레버리지 + HBM4 따라잡기 + 주주환원 임박 · 1Q26 OP만으로 역대 최강 2017-2018 사이클 연간평균 상회 = ROE/P/B 구조 전환 · HBM4 고핀속도(11Gbps+) 램프업 문제 미보고 → SEC가 HBM4 시장점유 확대 수혜 · LTA 레버리지 역전: 고객 선제안 = 공급사 협상력 확보 · DRAM/NAND ASP +75-85% QoQ · 수급 타이트 2028H1 · 2027 LTA 가시성=멀티플 정상화 · 약세 리스크: 26H2 가격 둔화, 27초 가격 하락, 중국 공급 위협', mcap:350, rsi:45, index:'KOSPI' },
  { sym:'000660.KS', name:'SK하이닉스', sector:'Technology', signal:'BUY', memo:'[GS 04/15 Buy 유지] 높은 베타 + P/B 대비 높은 ROE = 매력적 밸류에이션 + 잠재 ADR 상장 = 밸류에이션 상승 여지 · HBM3E 12H 수율 안정화 · AI CAPEX 사이클 지속 · HBM 점유 프리미엄 유지(HBM4 가격협상에 일반DRAM 가격 레퍼런스 상승 유리) · LTA 논의 대상 · 약세 리스크: HBM4 램프업 문제 언론 보도 → HBM 점유 하방 리스크, SEC에 HBM 점유 일부 이동 가능', mcap:120, rsi:52, index:'KOSPI' },
  { sym:'373220.KS', name:'LG에너지솔루션', sector:'Technology', signal:'WATCH', memo:'글로벌 배터리 2위 · EV 둔화 우려 · 46시리즈 양산', mcap:80, rsi:40, index:'KOSPI' },
  { sym:'207940.KS', name:'삼성바이오로직스', sector:'Healthcare', signal:'HOLD', memo:'CDMO 글로벌 1위 · 4공장 가동 · 수주 잔고 역대', mcap:55, rsi:50, index:'KOSPI' },
  { sym:'005380.KS', name:'현대차', sector:'Consumer', signal:'HOLD', memo:'EV 라인업 확대 · SDV 전환 · 보스턴다이내믹스 로봇', mcap:45, rsi:48, index:'KOSPI' },
  { sym:'012450.KS', name:'한화에어로스페이스', sector:'Industrials', signal:'BUY', memo:'수주 잔고 100조+ · NATO 추가 수주 · 글로벌 방산 대장', mcap:45, rsi:60, index:'KOSPI' },
  { sym:'000270.KS', name:'기아', sector:'Consumer', signal:'HOLD', memo:'EV3 유럽 호조 · PBR 밸류업 · 배당 확대', mcap:35, rsi:50, index:'KOSPI' },
  { sym:'035420.KS', name:'NAVER', sector:'Communication Services', signal:'HOLD', memo:'HyperCLOVA X Agent · 검색 AI 전환 · 커머스 성장', mcap:35, rsi:48, index:'KOSPI' },
  { sym:'068270.KS', name:'셀트리온', sector:'Healthcare', signal:'BUY', memo:'바이오시밀러 1위 · 미국 점유율 확대 · 짐펜트라 성장', mcap:30, rsi:52, index:'KOSPI' },
  { sym:'105560.KS', name:'KB금융', sector:'Financials', signal:'BUY', memo:'밸류업 대표주 · 배당 확대 · PBR 저평가', mcap:28, rsi:55, index:'KOSPI' },
  { sym:'006400.KS', name:'삼성SDI', sector:'Technology', signal:'WATCH', memo:'전고체 전환기 · 각형 배터리 · 수익성 개선 필요', mcap:25, rsi:38, index:'KOSPI' },
  { sym:'055550.KS', name:'신한지주', sector:'Financials', signal:'BUY', memo:'밸류업 프로그램 · 자사주 소각 · 배당 성장', mcap:22, rsi:53, index:'KOSPI' },
  { sym:'051910.KS', name:'LG화학', sector:'Materials', signal:'HOLD', memo:'석유화학 + 배터리 소재 · 구조조정 중 · 분할 이후', mcap:20, rsi:42, index:'KOSPI' },
  { sym:'259960.KS', name:'크래프톤', sector:'Communication Services', signal:'BUY', memo:'배그 인디아 MAU 폭발 · 인조이 신작 · 게임 대장주', mcap:18, rsi:55, index:'KOSPI' },
  { sym:'035720.KS', name:'카카오', sector:'Communication Services', signal:'WATCH', memo:'플랫폼 규제 · 경영 리스크 · Klaytn 블록체인', mcap:15, rsi:40, index:'KOSPI' },
  { sym:'138040.KS', name:'메리츠금융지주', sector:'Financials', signal:'BUY', memo:'ROE 업계 1위 · 보험+증권 시너지 · 주주환원', mcap:15, rsi:58, index:'KOSPI' },
  { sym:'015760.KS', name:'한국전력', sector:'Utilities', signal:'WATCH', memo:'전력 인프라 대장 · 적자 축소 중 · 요금 인상 기대', mcap:15, rsi:42, index:'KOSPI' },
  { sym:'042660.KS', name:'한화오션', sector:'Industrials', signal:'BUY', memo:'LNG선 고부가 수주 · 선가 상승 사이클 · 수주 잔고 역대', mcap:15, rsi:55, index:'KOSPI' },

  //  반도체 (semi) — 소재·장비 포함
  { sym:'042700.KQ', name:'한미반도체', sector:'Technology', signal:'BUY', memo:'HBM TC 본더 독점 · AI 반도체 후공정 수혜', mcap:8, rsi:55, index:'KOSDAQ' },
  { sym:'009150.KS', name:'삼성전기', sector:'Technology', signal:'HOLD', memo:'MLCC · AI 서버용 고용량 전환 · 전장 비중 확대', mcap:10, rsi:48, index:'KOSPI' },
  { sym:'402340.KS', name:'SK스퀘어', sector:'Technology', signal:'HOLD', memo:'SK하이닉스 지분 보유 · AI 투자 밸류체인', mcap:10, rsi:50, index:'KOSPI' },
  { sym:'039030.KQ', name:'이오테크닉스', sector:'Technology', signal:'BUY', memo:'레이저 장비 · 반도체 후공정 · HBM 수혜', mcap:4, rsi:52, index:'KOSDAQ' },
  { sym:'403870.KQ', name:'HPSP', sector:'Technology', signal:'BUY', memo:'고압 수소 어닐링 · 삼성 파운드리 필수 장비', mcap:3, rsi:50, index:'KOSDAQ' },
  { sym:'058470.KQ', name:'리노공업', sector:'Technology', signal:'HOLD', memo:'반도체 테스트 소켓 · AI칩 검증 수요 증가', mcap:5, rsi:48, index:'KOSDAQ' },
  { sym:'240810.KQ', name:'원익IPS', sector:'Technology', signal:'HOLD', memo:'CVD 장비 · 삼성전자 주요 협력사', mcap:2, rsi:45, index:'KOSDAQ' },
  { sym:'000990.KS', name:'DB하이텍', sector:'Technology', signal:'HOLD', memo:'8인치 파운드리 · 아날로그 반도체 · 전장', mcap:2, rsi:42, index:'KOSPI' },
  { sym:'036930.KQ', name:'주성엔지니어링', sector:'Technology', signal:'BUY', memo:'ALD 장비 수주 급증 · AI 반도체 미세공정 필수', mcap:3, rsi:55, index:'KOSDAQ' },
  { sym:'131970.KQ', name:'테크윙', sector:'Technology', signal:'HOLD', memo:'반도체 핸들러 · HBM 테스트 수혜', mcap:2, rsi:48, index:'KOSDAQ' },
  { sym:'005290.KS', name:'동진쎄미켐', sector:'Materials', signal:'HOLD', memo:'포토레지스트 · EUV 소재 국산화', mcap:2, rsi:45, index:'KOSPI' },
  { sym:'357780.KQ', name:'솔브레인', sector:'Materials', signal:'HOLD', memo:'반도체 식각액 · 고순도 화학소재', mcap:3, rsi:47, index:'KOSDAQ' },
  { sym:'025560.KS', name:'미래산업', sector:'Technology', signal:'WATCH', memo:'반도체 장비 부품 · 소형주', mcap:1, rsi:40, index:'KOSPI' },

  //  K-방산 (defense)
  { sym:'047810.KS', name:'한국항공우주(KAI)', sector:'Industrials', signal:'BUY', memo:'경공격기 FA-50 수출 · KF-21 양산 · 방산 수출 확대', mcap:12, rsi:55, index:'KOSPI' },
  { sym:'079550.KS', name:'LIG넥스원', sector:'Industrials', signal:'BUY', memo:'미사일/유도무기 · 중동 수출 급증 · 국방비 증가 수혜', mcap:8, rsi:52, index:'KOSPI' },
  { sym:'064350.KS', name:'현대로템', sector:'Industrials', signal:'BUY', memo:'K2 전차 · 폴란드 수출 · 철도·방산 이중 수혜', mcap:6, rsi:50, index:'KOSPI' },
  { sym:'272210.KS', name:'한화시스템', sector:'Industrials', signal:'BUY', memo:'위성통신 · 방산전자 · 한화 그룹 시너지', mcap:5, rsi:50, index:'KOSPI' },
  { sym:'000880.KS', name:'한화', sector:'Industrials', signal:'HOLD', memo:'방산 지주 · 한화에어로/오션/시스템 모회사', mcap:8, rsi:48, index:'KOSPI' },
  { sym:'103140.KS', name:'풍산', sector:'Industrials', signal:'BUY', memo:'탄약 수출 수혜 · 동(구리) 가격 상승 · 방산+소재', mcap:3, rsi:52, index:'KOSPI' },

  //  조선 (shipbuilding)
  { sym:'329180.KS', name:'HD현대중공업', sector:'Industrials', signal:'BUY', memo:'LNG/암모니아 선박 수주 · 세계 1위 조선사', mcap:12, rsi:53, index:'KOSPI' },
  { sym:'009540.KS', name:'HD한국조선해양', sector:'Industrials', signal:'HOLD', memo:'조선 지주사 · HD현대중공업+HD현대삼호 · 그룹 시너지', mcap:10, rsi:50, index:'KOSPI' },
  { sym:'010140.KS', name:'삼성중공업', sector:'Industrials', signal:'HOLD', memo:'해양플랜트 · LNG-FPSO · 수주 회복 중', mcap:8, rsi:48, index:'KOSPI' },
  { sym:'010620.KS', name:'HD현대미포', sector:'Industrials', signal:'HOLD', memo:'중형 선박 전문 · 석유화학 탱커 수주', mcap:4, rsi:48, index:'KOSPI' },
  { sym:'267250.KS', name:'HD현대', sector:'Industrials', signal:'HOLD', memo:'조선·중공업 지주 · 오일뱅크 · 그룹 밸류업', mcap:6, rsi:47, index:'KOSPI' },
  { sym:'082740.KS', name:'한화엔진', sector:'Industrials', signal:'HOLD', memo:'선박 엔진 · 친환경 LNG 이중연료', mcap:2, rsi:46, index:'KOSPI' },
  { sym:'011200.KS', name:'HJ중공업', sector:'Industrials', signal:'HOLD', memo:'선박 엔진 · 발전설비', mcap:1, rsi:45, index:'KOSPI' },

  // 전력기기 (power-grid)
  { sym:'298040.KS', name:'효성중공업', sector:'Industrials', signal:'BUY', memo:'변압기/차단기 · 미국·중동 수출 호조 · 그리드 교체 수요', mcap:8, rsi:55, index:'KOSPI' },
  { sym:'267260.KS', name:'HD현대일렉트릭', sector:'Industrials', signal:'BUY', memo:'초고압 변압기 · 미국 그리드 노후화 · AI 데이터센터 전력', mcap:12, rsi:58, index:'KOSPI' },
  { sym:'010120.KS', name:'LS일렉트릭', sector:'Industrials', signal:'BUY', memo:'전력인프라 · 배전·변전 · 북미 시장 진출 가속', mcap:6, rsi:52, index:'KOSPI' },
  { sym:'103590.KS', name:'일진전기', sector:'Industrials', signal:'BUY', memo:'변압기 · 전력케이블 · 해외 수출 급증', mcap:3, rsi:54, index:'KOSPI' },
  { sym:'006260.KS', name:'LS', sector:'Industrials', signal:'HOLD', memo:'LS그룹 지주 · 전선·전력·동 · 그룹 시너지', mcap:4, rsi:48, index:'KOSPI' },
  { sym:'229640.KQ', name:'LS에코에너지', sector:'Industrials', signal:'BUY', memo:'전력 케이블 · 에너지 인프라 · 해상풍력', mcap:3, rsi:53, index:'KOSDAQ' },
  { sym:'000500.KS', name:'가온전선', sector:'Industrials', signal:'HOLD', memo:'전력 케이블 · LS그룹 · 인프라 수혜', mcap:1, rsi:47, index:'KOSPI' },
  { sym:'033100.KQ', name:'제룡전기', sector:'Industrials', signal:'BUY', memo:'수배전반 · 전력기기 · 해외 수출 성장', mcap:2, rsi:55, index:'KOSDAQ' },

  //  원전 (nuclear)
  { sym:'034020.KS', name:'두산에너빌리티', sector:'Industrials', signal:'BUY', memo:'체코 원전 수주 · SMR 전용 공장 · 원전 르네상스', mcap:12, rsi:55, index:'KOSPI' },
  { sym:'000720.KS', name:'현대건설', sector:'Industrials', signal:'HOLD', memo:'원전 건설 · 체코 원전 참여 · 플랜트 EPC', mcap:5, rsi:45, index:'KOSPI' },
  { sym:'052690.KS', name:'한전기술', sector:'Industrials', signal:'HOLD', memo:'원전 설계 전문 · 체코 후속 수주 기대', mcap:3, rsi:48, index:'KOSPI' },
  { sym:'051600.KS', name:'한전KPS', sector:'Industrials', signal:'HOLD', memo:'원전/발전 정비 · 안정적 수익', mcap:2, rsi:46, index:'KOSPI' },
  { sym:'092200.KQ', name:'디아이씨', sector:'Industrials', signal:'WATCH', memo:'원전 계장 · SMR 부품', mcap:1, rsi:50, index:'KOSDAQ' },

  //  2차전지 (battery)
  { sym:'005490.KS', name:'POSCO홀딩스', sector:'Materials', signal:'HOLD', memo:'철강 대장 · 리튬 사업 · 포스코퓨처엠 모회사', mcap:18, rsi:42, index:'KOSPI' },
  { sym:'096770.KS', name:'SK이노베이션', sector:'Energy', signal:'WATCH', memo:'SK온 배터리 · 석유·화학 · 수익성 개선 필요', mcap:10, rsi:38, index:'KOSPI' },
  { sym:'247540.KQ', name:'에코프로비엠', sector:'Materials', signal:'WATCH', memo:'양극재 · 하이니켈 · 2차전지 소재 대장주', mcap:8, rsi:35, index:'KOSDAQ' },
  { sym:'086520.KQ', name:'에코프로', sector:'Materials', signal:'WATCH', memo:'에코프로비엠 모회사 · 2차전지 지주', mcap:5, rsi:33, index:'KOSDAQ' },
  { sym:'003670.KQ', name:'포스코퓨처엠', sector:'Materials', signal:'WATCH', memo:'양극재/음극재 · POSCO그룹 배터리 소재', mcap:6, rsi:35, index:'KOSDAQ' },
  { sym:'066970.KQ', name:'엘앤에프', sector:'Materials', signal:'WATCH', memo:'하이니켈 양극재 · LG엔솔 주요 공급사', mcap:3, rsi:32, index:'KOSDAQ' },

  //  바이오 (bio)
  { sym:'196170.KQ', name:'알테오젠', sector:'Healthcare', signal:'BUY', memo:'SC 플랫폼 기술 수출 · 글로벌 빅파마 라이선스 계약', mcap:20, rsi:58, index:'KOSDAQ' },
  { sym:'128940.KS', name:'한미약품', sector:'Healthcare', signal:'HOLD', memo:'GLP-1 비만 치료제 · 기술 수출 기대 · 파이프라인', mcap:5, rsi:48, index:'KOSPI' },
  { sym:'028300.KQ', name:'HLB', sector:'Healthcare', signal:'WATCH', memo:'항암제 · 리보세라닙 · FDA 승인 기대', mcap:4, rsi:42, index:'KOSDAQ' },
  { sym:'000100.KS', name:'유한양행', sector:'Healthcare', signal:'HOLD', memo:'제약 대장주 · 레이저티닙 · 글로벌 기술수출', mcap:5, rsi:48, index:'KOSPI' },
  { sym:'326030.KS', name:'SK바이오팜', sector:'Healthcare', signal:'HOLD', memo:'세노바메이트(엑코프리) · 뇌질환 신약 · 글로벌 매출', mcap:4, rsi:47, index:'KOSPI' },
  { sym:'145020.KQ', name:'휴젤', sector:'Healthcare', signal:'HOLD', memo:'보톡스 · 미용 의료기기 · K-바이오 수출', mcap:3, rsi:50, index:'KOSDAQ' },
  { sym:'302440.KQ', name:'SK바이오사이언스', sector:'Healthcare', signal:'WATCH', memo:'백신 CDMO · mRNA 플랫폼', mcap:2, rsi:40, index:'KOSDAQ' },
  { sym:'141080.KQ', name:'리가켐바이오', sector:'Healthcare', signal:'BUY', memo:'ADC 항체약물결합 · 글로벌 빅딜 · 기술수출', mcap:5, rsi:55, index:'KOSDAQ' },

  //  K-뷰티 (kbeauty)
  { sym:'090430.KS', name:'아모레퍼시픽', sector:'Consumer', signal:'HOLD', memo:'글로벌 K-뷰티 대장 · 미국·일본 리브랜딩', mcap:10, rsi:45, index:'KOSPI' },
  { sym:'051900.KS', name:'LG생활건강', sector:'Consumer', signal:'HOLD', memo:'화장품+생활용품 · 후/숨 브랜드 · 중국 매출 회복', mcap:8, rsi:42, index:'KOSPI' },
  { sym:'044820.KQ', name:'코스맥스BTI', sector:'Consumer', signal:'BUY', memo:'ODM 글로벌 1위 · 수주 역대 최고 · 인도 공장', mcap:5, rsi:55, index:'KOSDAQ' },
  { sym:'192820.KQ', name:'코스맥스', sector:'Consumer', signal:'BUY', memo:'ODM 글로벌 1위 · K뷰티 수혜', mcap:22, rsi:55, index:'KOSDAQ' },
  { sym:'161890.KS', name:'한국콜마', sector:'Consumer', signal:'HOLD', memo:'화장품 ODM · K-뷰티 서플라이 체인', mcap:3, rsi:48, index:'KOSPI' },
  { sym:'278470.KQ', name:'에이피알(APR)', sector:'Consumer', signal:'BUY', memo:'메디큐브 북미 고성장 · D2C 뷰티 플랫폼 · 2024.02 KOSDAQ 상장', mcap:4, rsi:58, index:'KOSDAQ' },
  { sym:'257720.KQ', name:'실리콘투', sector:'Consumer', signal:'BUY', memo:'K-뷰티 글로벌 유통 · 스타일코리안 · 수출 폭증', mcap:3, rsi:55, index:'KOSDAQ' },
  { sym:'237880.KQ', name:'클리오', sector:'Consumer', signal:'HOLD', memo:'색조 화장품 · 세포라 입점 · 글로벌 확장', mcap:2, rsi:50, index:'KOSDAQ' },
  { sym:'950130.KQ', name:'엘앤피코스메틱', sector:'Consumer', signal:'HOLD', memo:'메디힐 마스크팩 · K-뷰티 글로벌', mcap:1, rsi:47, index:'KOSDAQ' },

  //  K-콘텐츠 (kcontent)
  { sym:'352820.KS', name:'하이브', sector:'Communication Services', signal:'WATCH', memo:'BTS 개별활동 · 내부 리스크 · 앨범 둔화 우려', mcap:8, rsi:42, index:'KOSPI' },
  { sym:'041510.KS', name:'SM엔터테인먼트', sector:'Communication Services', signal:'HOLD', memo:'에스파 · K-POP 대표 · 카카오 자회사', mcap:4, rsi:45, index:'KOSPI' },
  { sym:'035900.KQ', name:'JYP엔터테인먼트', sector:'Communication Services', signal:'HOLD', memo:'스트레이키즈 · NiziU · K-POP 해외 수익', mcap:3, rsi:48, index:'KOSDAQ' },
  { sym:'122870.KQ', name:'YG엔터테인먼트', sector:'Communication Services', signal:'WATCH', memo:'블랙핑크 · 트레저 · IP 중심 전환', mcap:2, rsi:40, index:'KOSDAQ' },
  { sym:'253450.KS', name:'스튜디오드래곤', sector:'Communication Services', signal:'HOLD', memo:'K-드라마 제작 · 넷플릭스 파트너 · CJ ENM 자회사', mcap:2, rsi:45, index:'KOSPI' },
  { sym:'035760.KS', name:'CJ ENM', sector:'Communication Services', signal:'WATCH', memo:'미디어+커머스 · tvN · K-드라마 글로벌', mcap:3, rsi:38, index:'KOSPI' },
  { sym:'251270.KS', name:'넷마블', sector:'Communication Services', signal:'WATCH', memo:'모바일 게임 · 나혼렙 IP · 실적 부진', mcap:3, rsi:35, index:'KOSPI' },
  { sym:'112040.KQ', name:'위메이드', sector:'Communication Services', signal:'WATCH', memo:'미르4 글로벌 · 위믹스 블록체인 게임', mcap:1, rsi:38, index:'KOSDAQ' },
  { sym:'263750.KQ', name:'펄어비스', sector:'Communication Services', signal:'WATCH', memo:'검은사막 IP · 붉은사막 신작 기대', mcap:2, rsi:42, index:'KOSDAQ' },

  //  자동차 (auto)
  { sym:'012330.KS', name:'현대모비스', sector:'Consumer', signal:'HOLD', memo:'자동차 부품 1위 · ADAS · 전동화 부품', mcap:15, rsi:46, index:'KOSPI' },
  { sym:'086280.KS', name:'현대글로비스', sector:'Industrials', signal:'HOLD', memo:'자동차 물류 · 완성차 운반 · 현대차 그룹', mcap:8, rsi:48, index:'KOSPI' },
  { sym:'011210.KS', name:'현대위아', sector:'Industrials', signal:'HOLD', memo:'자동차 부품 · 공작기계 · 방산', mcap:2, rsi:44, index:'KOSPI' },
  { sym:'204320.KS', name:'HL만도', sector:'Consumer', signal:'HOLD', memo:'ADAS L3 수주 · 자동차 전장부품', mcap:3, rsi:45, index:'KOSPI' },
  { sym:'018880.KS', name:'한온시스템', sector:'Consumer', signal:'WATCH', memo:'자동차 공조 · 열관리 · EV 수혜', mcap:2, rsi:38, index:'KOSPI' },
  { sym:'316140.KS', name:'우리금융지주', sector:'Financials', signal:'BUY', memo:'은행 · 밸류업 · 배당 확대 · PBR 저평가', mcap:10, rsi:52, index:'KOSPI' },

  // 로봇 (robot)
  { sym:'454910.KQ', name:'두산로보틱스', sector:'Technology', signal:'WATCH', memo:'협동로봇 · IPO 후 급등 · 밸류에이션 부담', mcap:5, rsi:55, index:'KOSDAQ' },
  { sym:'277810.KQ', name:'레인보우로보틱스', sector:'Technology', signal:'WATCH', memo:'양팔로봇 · 현대차 지분 투자 · 휴머노이드', mcap:11, rsi:50, index:'KOSDAQ' },
  { sym:'315640.KQ', name:'뉴로메카', sector:'Technology', signal:'WATCH', memo:'협동로봇 · 산업용 자동화', mcap:1, rsi:48, index:'KOSDAQ' },
  { sym:'178320.KQ', name:'로보스타', sector:'Technology', signal:'WATCH', memo:'산업용 로봇 · 반도체 장비 운반', mcap:1, rsi:45, index:'KOSDAQ' },

  //  금융 (finance)
  { sym:'086790.KS', name:'하나금융지주', sector:'Financials', signal:'BUY', memo:'은행 · 밸류업 · 자사주 소각 · PBR 저평가', mcap:12, rsi:53, index:'KOSPI' },
  { sym:'032830.KS', name:'삼성생명', sector:'Financials', signal:'HOLD', memo:'생명보험 1위 · 삼성전자 지분 · 배당', mcap:15, rsi:48, index:'KOSPI' },
  { sym:'000810.KS', name:'삼성화재', sector:'Financials', signal:'HOLD', memo:'손해보험 1위 · 안정적 배당 · 밸류업', mcap:12, rsi:50, index:'KOSPI' },
  { sym:'323410.KQ', name:'카카오뱅크', sector:'Financials', signal:'HOLD', memo:'인터넷전문은행 · 핀테크 대장 · 카카오 자회사', mcap:10, rsi:45, index:'KOSDAQ' },
  { sym:'024110.KS', name:'기업은행', sector:'Financials', signal:'HOLD', memo:'중소기업 특화 은행 · 배당 매력 · PBR 0.3배', mcap:8, rsi:48, index:'KOSPI' },
  { sym:'003550.KS', name:'LG', sector:'Industrials', signal:'HOLD', memo:'LG그룹 지주 · LG전자/화학/에너지 · 밸류업', mcap:10, rsi:46, index:'KOSPI' },
  { sym:'066570.KS', name:'LG전자', sector:'Consumer', signal:'HOLD', memo:'가전 글로벌 1위 · 전장(VS사업부) · webOS', mcap:12, rsi:45, index:'KOSPI' },

  //  K-푸드 (kfood)
  { sym:'003230.KS', name:'삼양식품', sector:'Consumer Defensive', signal:'BUY', memo:'불닭 글로벌 폭증 · K-푸드 수출 역대 · 미국·동남아 확장', mcap:8, rsi:60, index:'KOSPI' },
  { sym:'097950.KS', name:'CJ제일제당', sector:'Consumer Defensive', signal:'HOLD', memo:'비비고 미국 확장 · K-푸드 대장 · 바이오 사업부', mcap:6, rsi:48, index:'KOSPI' },
  { sym:'271560.KS', name:'오리온', sector:'Consumer Defensive', signal:'HOLD', memo:'초코파이 · 중국/베트남 성장 · 해외 매출 비중 높음', mcap:5, rsi:50, index:'KOSPI' },
  { sym:'004370.KS', name:'농심', sector:'Consumer Defensive', signal:'HOLD', memo:'신라면 · 미국 공장 증설 · K-라면 글로벌', mcap:3, rsi:48, index:'KOSPI' },
  { sym:'280360.KS', name:'롯데웰푸드', sector:'Consumer Defensive', signal:'HOLD', memo:'제과/빙과 · 인도 시장 성장', mcap:2, rsi:46, index:'KOSPI' },
  { sym:'005180.KS', name:'빙그레', sector:'Consumer Defensive', signal:'HOLD', memo:'바나나맛우유 · 해외 수출 성장', mcap:1, rsi:48, index:'KOSPI' },
  { sym:'000080.KS', name:'하이트진로', sector:'Consumer Defensive', signal:'HOLD', memo:'소주/맥주 1위 · 참이슬 글로벌 · K-소주 수출', mcap:2, rsi:45, index:'KOSPI' },

  // 통신 (telecom)
  { sym:'017670.KS', name:'SK텔레콤', sector:'Communication Services', signal:'HOLD', memo:'AI 데이터센터 확장 · 6G 표준화 · 배당주', mcap:12, rsi:50, index:'KOSPI' },
  { sym:'030200.KS', name:'KT', sector:'Communication Services', signal:'HOLD', memo:'클라우드/AI 분사 · AICT 전환 · 배당 매력', mcap:8, rsi:48, index:'KOSPI' },
  { sym:'032640.KS', name:'LG유플러스', sector:'Communication Services', signal:'HOLD', memo:'통신 3위 · IPTV · 배당주', mcap:4, rsi:45, index:'KOSPI' },
  { sym:'018260.KS', name:'삼성SDS', sector:'Technology', signal:'HOLD', memo:'IT 서비스 · AI 플랫폼 Brity · 클라우드', mcap:10, rsi:48, index:'KOSPI' },

  //  크립토 (crypto)
  { sym:'294870.KS', name:'HDC현대산업개발', sector:'Industrials', signal:'WATCH', memo:'주택건설 · 재건축/재개발 · 아이파크 브랜드', mcap:2, rsi:50, index:'KOSPI' },
  { sym:'094480.KQ', name:'갤럭시아머니트리', sector:'Financials', signal:'WATCH', memo:'핀테크 · 블록체인 · 가상자산', mcap:1, rsi:42, index:'KOSDAQ' },

  // 유통/소비재 (retail)
  { sym:'004170.KS', name:'신세계', sector:'Consumer', signal:'HOLD', memo:'백화점 · 면세점 · SSG 이커머스', mcap:3, rsi:42, index:'KOSPI' },
  { sym:'023530.KS', name:'롯데쇼핑', sector:'Consumer', signal:'WATCH', memo:'백화점/마트/이커머스 · 구조조정 중', mcap:2, rsi:38, index:'KOSPI' },
  { sym:'069960.KQ', name:'현대백화점', sector:'Consumer', signal:'HOLD', memo:'백화점 · 프리미엄 소비 · 면세점', mcap:2, rsi:44, index:'KOSDAQ' },

  //  건설/인프라
  { sym:'000720.KS', name:'현대건설', sector:'Industrials', signal:'HOLD', memo:'원전 건설 · 해외 플랜트 · 주택 건설', mcap:5, rsi:45, index:'KOSPI' },
  { sym:'047040.KS', name:'대우건설', sector:'Industrials', signal:'HOLD', memo:'건설 · 해외 플랜트 · 푸르지오', mcap:2, rsi:42, index:'KOSPI' },

  //  에너지/화학
  { sym:'010950.KS', name:'S-Oil', sector:'Energy', signal:'HOLD', memo:'정유 · 아람코 합작 · 샤힌프로젝트', mcap:8, rsi:45, index:'KOSPI' },
  { sym:'078930.KS', name:'GS', sector:'Energy', signal:'HOLD', memo:'GS에너지/리테일 지주 · 정유·발전', mcap:5, rsi:44, index:'KOSPI' },
  { sym:'011170.KS', name:'롯데케미칼', sector:'Materials', signal:'WATCH', memo:'석유화학 · 실적 부진 · 구조조정', mcap:3, rsi:35, index:'KOSPI' },
  { sym:'006800.KS', name:'미래에셋증권', sector:'Financials', signal:'HOLD', memo:'증권 대장주 · 해외투자 · 자산관리', mcap:5, rsi:48, index:'KOSPI' },
  { sym:'016360.KS', name:'삼성증권', sector:'Financials', signal:'HOLD', memo:'증권 · WM 강자 · 배당', mcap:4, rsi:50, index:'KOSPI' },

  //  기타 대형주/우량주
  { sym:'028260.KS', name:'삼성물산', sector:'Industrials', signal:'HOLD', memo:'삼성그룹 지주 · 건설·상사·패션·리조트', mcap:20, rsi:46, index:'KOSPI' },
  { sym:'034730.KS', name:'SK', sector:'Industrials', signal:'HOLD', memo:'SK그룹 지주 · SK하이닉스/이노베이션 · 밸류업', mcap:12, rsi:44, index:'KOSPI' },
  { sym:'036570.KS', name:'엔씨소프트', sector:'Communication Services', signal:'WATCH', memo:'리니지 IP · 신작 부진 · 턴어라운드 필요', mcap:5, rsi:35, index:'KOSPI' },
  { sym:'030000.KS', name:'제일기획', sector:'Communication Services', signal:'HOLD', memo:'광고 대행 · 삼성 계열 · 글로벌 네트워크', mcap:3, rsi:48, index:'KOSPI' },
  { sym:'004020.KS', name:'현대제철', sector:'Materials', signal:'HOLD', memo:'철강 2위 · 자동차 강판 · 현대차 그룹', mcap:4, rsi:42, index:'KOSPI' },
  { sym:'011780.KS', name:'금호석유', sector:'Materials', signal:'HOLD', memo:'합성고무 · 페놀 · 석유화학', mcap:3, rsi:44, index:'KOSPI' },
  { sym:'009830.KS', name:'한화솔루션', sector:'Technology', signal:'WATCH', memo:'태양광 · 케미칼 · 갤러리아 · 실적 부진', mcap:3, rsi:35, index:'KOSPI' },
  { sym:'012510.KS', name:'더존비즈온', sector:'Technology', signal:'HOLD', memo:'AI ERP · 기업용 소프트웨어 · SaaS 전환', mcap:5, rsi:48, index:'KOSPI' },
  { sym:'030520.KQ', name:'한글과컴퓨터', sector:'Technology', signal:'HOLD', memo:'한컴오피스 · 공공부문 · AI 문서 · 클라우드', mcap:2, rsi:45, index:'KOSDAQ' },
  { sym:'041020.KQ', name:'폴라리스오피스', sector:'Technology', signal:'HOLD', memo:'오피스 SW · 글로벌 SaaS · AI 문서 편집', mcap:1, rsi:48, index:'KOSDAQ' },
  { sym:'304100.KQ', name:'솔트룩스', sector:'Technology', signal:'WATCH', memo:'한국형 AI · 대화형 AI · 정부 과제', mcap:1, rsi:42, index:'KOSDAQ' },
  { sym:'005940.KS', name:'NH투자증권', sector:'Financials', signal:'HOLD', memo:'증권 · IB 강자 · 농협 계열', mcap:4, rsi:48, index:'KOSPI' },
  { sym:'039490.KS', name:'키움증권', sector:'Financials', signal:'HOLD', memo:'온라인 증권 1위 · MTS · 개인투자자 대표', mcap:4, rsi:50, index:'KOSPI' },
  { sym:'003490.KS', name:'대한항공', sector:'Industrials', signal:'HOLD', memo:'항공 대장주 · 아시아나 인수 · 화물 호조', mcap:8, rsi:48, index:'KOSPI' },
  { sym:'020560.KS', name:'아시아나항공', sector:'Industrials', signal:'WATCH', memo:'대한항공 합병 진행 · 저가 항공 경쟁', mcap:2, rsi:40, index:'KOSPI' },
  { sym:'180640.KS', name:'한진칼', sector:'Industrials', signal:'HOLD', memo:'대한항공 모회사 · 항공 지주', mcap:3, rsi:46, index:'KOSPI' },
  { sym:'326030.KS', name:'SK바이오팜', sector:'Healthcare', signal:'HOLD', memo:'세노바메이트(엑코프리) · 뇌질환 신약 · 글로벌 매출', mcap:4, rsi:47, index:'KOSPI' },
];


// ── ADR% 추정 함수 (Jeff Sun CFTe 프레임워크 기반) ──
// mcap 티어 + 섹터 변동성 보정으로 ADR% 추정
// ADR%(Average Daily Range) = 하루 평균 변동폭 비율. 높을수록 변동성 큼.
function getAdrEstimate(r) {
  var base;
  if (r.mcap >= 1000) base = 1.5;      // MEGA (1T+)
  else if (r.mcap >= 100) base = 2.0;  // LARGE (100B-1T)
  else if (r.mcap >= 10) base = 3.0;   // MID-LARGE (10-100B)
  else if (r.mcap >= 2) base = 4.5;    // MID (2-10B)
  else base = 6.0;                     // SMALL (<2B)
  var sectorMult = {
    'Technology': 1.2, 'Healthcare': 1.3, 'Energy': 1.1,
    'Communication Services': 1.1, 'Financials': 0.9,
    'Industrials': 0.9, 'Materials': 1.0, 'Consumer': 1.0,
    'Consumer Defensive': 0.7, 'Utilities': 0.6, 'Real Estate': 0.8
  };
  var mult = sectorMult[r.sector] || 1.0;
  return +(base * mult).toFixed(1);
}

var _scrSortCol = 'mcap';
var _scrSortAsc = false;

// ── 자연어 검색 키워드 앨리어스 (한국어 ↔ 영어 매핑) ──
var SCR_KEYWORD_ALIASES = {
  // AI / 인공지능
  'ai': ['NVDA','GOOGL','MSFT','META','AMZN','PLTR','AMD','ARM','AVGO','NOW','CRWD','PANW','INTC','TSM','AAPL','ORCL','CRM','SNOW','DDOG','MRVL','SOUN'],
  '인공지능': ['NVDA','GOOGL','MSFT','META','AMZN','PLTR','AMD','ARM','AVGO','NOW','CRWD','PANW','INTC','TSM','AAPL','ORCL','CRM','SNOW','DDOG','MRVL','SOUN'],
  'llm': ['GOOGL','META','MSFT','NVDA','PLTR'],
  '챗봇': ['GOOGL','META','MSFT'],
  // 반도체
  '반도체': ['NVDA','AMD','INTC','TSM','AVGO','ARM','QCOM','MU','ASML','AMAT','LRCX','KLAC','SNPS','CDNS','MRVL'],
  'semiconductor': ['NVDA','AMD','INTC','TSM','AVGO','ARM','QCOM','MU','ASML','AMAT','LRCX','KLAC','SNPS','CDNS','MRVL'],
  '칩': ['NVDA','AMD','INTC','TSM','AVGO','ARM','QCOM','MU'],
  'gpu': ['NVDA','AMD'],
  'cpu': ['AMD','INTC','ARM','QCOM'],
  '파운드리': ['TSM','INTC'],
  '메모리': ['MU'],
  'hbm': ['MU','NVDA'],
  // 클라우드
  '클라우드': ['AMZN','MSFT','GOOGL','NOW','SNOW','DDOG','MDB','GTLB','ESTC','CFLT','NET'],
  'cloud': ['AMZN','MSFT','GOOGL','NOW','SNOW','DDOG','MDB','GTLB','ESTC','CFLT','NET'],
  'aws': ['AMZN'],
  'azure': ['MSFT'],
  'saas': ['NOW','CRWD','PANW','PLTR','WDAY','MNDY','DDOG','SNOW','GTLB','ESTC','PATH'],
  // 전기차 / 자동차
  '전기차': ['TSLA','RIVN','GM','F'],
  'ev': ['TSLA','RIVN','GM','F'],
  '자율주행': ['TSLA','GOOGL','MBLY','APTV'],
  'autonomous': ['TSLA','GOOGL','MBLY','APTV'],
  '로보택시': ['TSLA'],
  '테슬라': ['TSLA'],
  '자동차': ['TSLA','GM','F','RIVN'],
  'auto': ['TSLA','GM','F','RIVN'],
  // 방산 / 국방
  '방산': ['RTX','LMT','NOC','GD','HII','BA','GE','HON','HWM','LHX'],
  '국방': ['RTX','LMT'],
  'defense': ['RTX','LMT'],
  '무기': ['RTX','LMT'],
  '미사일': ['RTX','LMT'],
  '패트리어트': ['RTX'],
  // 에너지
  '에너지': ['XOM','CVX','SLB','COP','EOG','OXY','SHEL','TTE','BP','HAL','BKR','DVN'],
  '석유': ['XOM','CVX','SLB','COP','SHEL','TTE','BP'],
  '오일': ['XOM','CVX','SLB','COP','SHEL','TTE','BP'],
  '유전': ['SLB','HAL','BKR'],
  // 배당
  '배당': ['XOM','CVX','WMT','COST','JPM','V','GS','DE','KO','PEP','PG','JNJ','ABBV','MRK','VZ','T','MCD','HD'],
  'dividend': ['XOM','CVX','WMT','COST','JPM','V','GS','DE'],
  // 바이오 / 헬스케어
  '바이오': ['LLY','MRNA','UNH','AMGN','REGN','VRTX','GILD','ISRG','TMO','PFE','JNJ','ABBV','MRK'],
  'bio': ['LLY','MRNA','UNH'],
  '제약': ['LLY','MRNA'],
  'pharma': ['LLY','MRNA'],
  '비만': ['LLY','NVO','AMGN','VKTX'],
  'obesity': ['LLY','NVO','AMGN','VKTX'],
  'glp-1': ['LLY','NVO','AMGN','VKTX'],
  'glp': ['LLY','NVO','AMGN','VKTX'],
  'mrna': ['MRNA'],
  '헬스케어': ['LLY','MRNA','UNH'],
  // 핀테크 / 금융
  '핀테크': ['V','MA','XYZ','COIN','JPM','GS','SOFI','AFRM','UPST','AXP','BLK','SPGI'],
  'fintech': ['V','XYZ','COIN','JPM','GS'],
  '은행': ['JPM','GS','BAC','WFC','MS','C','USB','PNC','SCHW','BK'],
  '결제': ['V','XYZ'],
  '암호화폐': ['COIN'],
  '비트코인': ['COIN','XYZ'],
  'crypto': ['COIN','XYZ'],
  // 우주 / 로켓
  '우주': ['RKLB','ASTS','LUNR','PL','RDW'],
  '로켓': ['RKLB'],
  '위성': ['ASTS','RKLB','PL'],
  'space': ['RKLB','ASTS','LUNR','PL','RDW'],
  // 원전 / 전력
  '원전': ['CEG','VST','CCJ','NRG','OKLO','TLN','SMR'],
  '원자력': ['CEG','VST','CCJ','NRG','OKLO','TLN','SMR'],
  'nuclear': ['CEG','VST','CCJ','NRG','OKLO','TLN','SMR'],
  '전력': ['CEG','VST','NRG','TLN','NEE','DUK'],
  '데이터센터전력': ['CEG','VST','NRG','TLN'],
  '우라늄': ['CCJ','SMR','OKLO'],
  'uranium': ['CCJ','SMR','OKLO'],
  // 사이버보안
  '사이버보안': ['CRWD','PANW','ZS','FTNT','NET'],
  '보안': ['CRWD','PANW','ZS','FTNT','NET'],
  'security': ['CRWD','PANW','ZS','FTNT','NET'],
  'cybersecurity': ['CRWD','PANW','ZS','FTNT','NET'],
  // 양자컴퓨팅
  '양자컴퓨팅': ['IONQ','RGTI','QUBT'],
  '양자': ['IONQ','RGTI','QUBT'],
  'quantum': ['IONQ','RGTI','QUBT'],
  // 산업재 / 인프라
  '인프라': ['CAT','DE'],
  '농업': ['DE'],
  '건설': ['CAT'],
  // 리테일 / 소비
  '리테일': ['WMT','COST','AMZN'],
  '소매': ['WMT','COST','AMZN'],
  '이커머스': ['AMZN','WMT'],
  // 소프트웨어
  '소프트웨어': ['MSFT','NOW','PLTR','CRWD','PANW'],
  'software': ['MSFT','NOW','PLTR','CRWD','PANW'],
  // 성장주
  '성장주': ['NVDA','PLTR','RKLB','ASTS','IONQ','ARM','CRWD','PANW','NOW'],
  'growth': ['NVDA','PLTR','RKLB','ASTS','IONQ','ARM','CRWD','PANW','NOW'],
  // 가치주
  '가치주': ['JPM','GS','XOM','CVX','WMT','COST','V','DE','CAT'],
  'value': ['JPM','GS','XOM','CVX','WMT','COST','V','DE','CAT'],
  // 매수/매도 신호
  '매수': 'BUY',
  'buy': 'BUY',
  '매도': 'SELL',
  'sell': 'SELL',
  '관망': 'WATCH',
  'watch': 'WATCH',
  '보유': 'HOLD',
  'hold': 'HOLD',
  // 추가 키워드 (확장)
  '다우': ['AAPL','MSFT','JPM','V','UNH','GS','HD','CAT','AMGN','MCD','CRM','HON','BA','IBM','DIS','NKE','KO','PG','MRK','JNJ','CVX','XOM','INTC','CSCO','WMT','MMM','VZ','DOW','TRV','AXP'],
  'dow': ['AAPL','MSFT','JPM','V','UNH','GS','HD','CAT','AMGN','MCD','CRM','HON','BA','IBM','DIS','NKE','KO','PG','MRK','JNJ','CVX','XOM','INTC','CSCO','WMT','MMM','VZ','DOW','TRV','AXP'],
  'dow30': ['AAPL','MSFT','JPM','V','UNH','GS','HD','CAT','AMGN','MCD','CRM','HON','BA','IBM','DIS','NKE','KO','PG','MRK','JNJ','CVX','XOM','INTC','CSCO','WMT','MMM','VZ','DOW','TRV','AXP'],
  '나스닥': ['AAPL','MSFT','NVDA','AMZN','META','GOOGL','TSLA','AVGO','AMD','MU','ARM','QCOM','PANW','CRWD','NOW','PLTR','MRVL','SNPS','CDNS','DDOG','SNOW','ZS','FTNT','TTD','NFLX','ADBE','INTU','MELI','SMCI','IONQ'],
  'nasdaq': ['AAPL','MSFT','NVDA','AMZN','META','GOOGL','TSLA','AVGO','AMD','MU','ARM','QCOM','PANW','CRWD','NOW','PLTR','MRVL','SNPS','CDNS','DDOG','SNOW','ZS','FTNT','TTD','NFLX','ADBE','INTU','MELI','SMCI','IONQ'],
  '러셀': ['SOFI','AFRM','UPST','RIOT','MARA','RGTI','LUNR','SMR','JOBY','CAVA','SOUN','IREN','RDW','QUBT','DNA','DM'],
  'russell': ['SOFI','AFRM','UPST','RIOT','MARA','RGTI','LUNR','SMR','JOBY','CAVA','SOUN','IREN','RDW','QUBT','DNA','DM'],
  '소형주': ['SOFI','AFRM','UPST','RIOT','MARA','RGTI','LUNR','SMR','JOBY','CAVA','SOUN','IREN','RDW','QUBT','DNA','DM'],
  'smallcap': ['SOFI','AFRM','UPST','RIOT','MARA','RGTI','LUNR','SMR','JOBY','CAVA','SOUN','IREN','RDW','QUBT','DNA','DM'],
  '대형주': ['AAPL','MSFT','NVDA','GOOGL','AMZN','META','AVGO','TSM','BRK.B','LLY','JPM','V','UNH','XOM','MA'],
  'megacap': ['AAPL','MSFT','NVDA','GOOGL','AMZN','META','AVGO','TSM','BRK.B','LLY','JPM','V','UNH','XOM','MA'],
  '로봇': ['ISRG','ROK','ABB','PATH','HON','DE','JOBY','FANUY'],
  'robot': ['ISRG','ROK','ABB','PATH','HON','DE','JOBY','FANUY'],
  '로보틱스': ['ISRG','ROK','ABB','PATH','FANUY'],
  'robotics': ['ISRG','ROK','ABB','PATH','FANUY'],
  'eda': ['SNPS','CDNS'],
  '장비': ['ASML','AMAT','LRCX','KLAC'],
  '보험': ['UNH','TRV','BRK.B','CB','ALL','PGR','HIG','ACGL','AFL','MET'],
  '음식': ['MCD','SBUX','KO','PEP','COST','WMT','CAVA'],
  '식음료': ['MCD','SBUX','KO','PEP','COST','WMT','CAVA'],
  '항공': ['BA','GE','RTX','LMT'],
  '통신': ['T','VZ','CSCO'],
  'telecom': ['T','VZ','CSCO'],
  '부동산': ['PLD','O','SPG','VTR','EQIX','DLR','AMT','PSA','IRM','SBAC','WELL'],
  'reit': ['PLD','O','SPG','VTR','EQIX','DLR','AMT','PSA','IRM','SBAC','WELL'],
  '유틸리티': ['NEE','CEG','VST','DUK','AEP','SO','D','NRG','EXC','XEL','AWK'],
  '클린에너지': ['NEE','ICLN','TAN'],
  '스트리밍': ['NFLX','DIS','SPOT','ROKU'],
  '소셜미디어': ['META','GOOGL','RDDT','PINS','SNAP','RBLX'],
  'social': ['META','GOOGL','RDDT','PINS','SNAP','RBLX'],
  '자산운용': ['BLK','BRK.B','GS','MS','SPGI'],
  'etf': ['SPY','QQQ','IWM','DIA','VOO','VTI','GLD','TLT','HYG','EEM','EFA','AGG','BND','SOXX','ARKK'],
  '지수': ['SPY','QQQ','IWM','DIA'],
  // 새 카테고리
  '광모듈': ['AAOI','COHR','LITE','CIEN','GLW','VIAV','MRVL'],
  '광통신': ['AAOI','COHR','LITE','CIEN','GLW','VIAV','MRVL'],
  'photonics': ['AAOI','COHR','LITE','CIEN','GLW','VIAV','MRVL'],
  'optical': ['AAOI','COHR','LITE','CIEN','GLW','VIAV','MRVL'],
  'ai-optical': ['COHR','LITE','MRVL','AAOI','GLW','CIEN'],
  'AI광학': ['COHR','LITE','MRVL','AAOI','GLW','CIEN'],
  '데이터센터': ['VRT','DELL','HPE','EQIX','DLR','ANET'],
  'datacenter': ['VRT','DELL','HPE','EQIX','DLR','ANET'],
  '밈주식': ['GME','AMC'],
  'meme': ['GME','AMC'],
  '텔레헬스': ['HIMS'],
  'telehealth': ['HIMS'],
  '게임': ['EA','TTWO','RBLX'],
  'gaming': ['EA','TTWO','RBLX'],
  '이커머스': ['AMZN','SHOP','ABNB','DASH','GRAB','SE','TOST'],
  'ecommerce': ['AMZN','SHOP','ABNB','DASH','GRAB','SE','TOST'],
  '배달': ['DASH','GRAB','TOST'],
  'delivery': ['DASH','GRAB','TOST'],
  '여행': ['ABNB','BKNG','UBER'],
  'travel': ['ABNB','BKNG','UBER'],
  '교육': ['DUOL'],
  'edtech': ['DUOL'],
  '광고': ['APP','TTD','GOOGL','META'],
  'adtech': ['APP','TTD','GOOGL','META'],
  '정밀의료': ['CRSP','TEM'],
  '유전자': ['CRSP','DNA'],
  'genomics': ['CRSP','DNA'],
  '인프라장비': ['URI','CAT','DE'],
  '철강': ['NUE','CLF','FCX'],
  'steel': ['NUE','CLF'],
  '핀테크앱': ['SOFI','AFRM','SQ','HOOD','PYPL','NU'],
  '결제앱': ['SQ','PYPL','HOOD'],
  'evtol': ['JOBY'],
  '에어택시': ['JOBY'],
  '소비재': ['LULU','DECK','CELH','ONON','NKE'],
  'consumer': ['LULU','DECK','CELH','ONON','NKE'],
  '애슬레저': ['LULU','ONON','DECK','NKE'],
  '음료': ['CELH','KO','PEP','MNST'],
  'hr': ['WDAY','MNDY'],
  '데이터분석': ['DDOG','SNOW','CFLT','ESTC','MDB','PLTR'],
  'analytics': ['DDOG','SNOW','CFLT','ESTC','MDB','PLTR'],
  '모빌리티': ['UBER','GRAB','RIVN'],
  // v34.7 감사 추가
  '드론': ['KTOS','AVAV','RKLB'],
  'drone': ['KTOS','AVAV','RKLB'],
  '리튬': ['LAC','ALB','SQM','LIT'],
  'lithium': ['LAC','ALB','SQM','LIT'],
  '메타버스': ['META','RBLX','U'],
  'metaverse': ['META','RBLX','U'],
  'sq': ['XYZ'],
  // ═══ v33.1: 확장 유니버스 앨리어스 ═══
  'adr': ['BABA','TSM','NVO','ASML','SHOP','SE','MELI','PDD','SONY','CPNG','BIDU','JD','TCOM','HSBC','TM','SHEL','RIO','BHP','VALE','PBR','INFY','NVS','AZN','UBS','SAP','UL','BTI','BUD','TTE','BP','NEM','AMX','NU','ITUB'],
  '해외주식': ['BABA','TSM','NVO','ASML','SHOP','SE','MELI','PDD','SONY','CPNG','BIDU','JD','TCOM','HSBC','TM','SHEL','RIO','BHP','VALE','PBR','INFY','NVS','AZN'],
  '중국주식': ['BABA','PDD','BIDU','JD','TCOM','NTES'],
  '일본주식': ['TM','SONY','MUFG','SMFG','MFG','TAK'],
  '인도주식': ['HDB','IBN','INFY'],
  '유럽주식': ['ASML','SAP','NVS','AZN','SHEL','TTE','BP','UBS','UL','BUD','BTI','HSBC','NVO','GSK','SNY','RIO','BHP','DEO'],
  '캐나다주식': ['SHOP','TD','RY','BMO','BNS','CM','ENB','CNQ','SU','TRP','CP','CNI'],
  '라틴아메리카': ['MELI','NU','PBR','VALE','ITUB','AMX','CPNG'],
  '대체투자': ['BX','KKR','APO','ARES','BAM','BN'],
  'pe': ['BX','KKR','APO','ARES'],
  '에너지메이저': ['XOM','CVX','SHEL','TTE','BP','COP','EOG','OXY'],
  '정유': ['PSX','VLO','MPC'],
  '미드스트림': ['WMB','KMI','OKE','ENB','EPD','ET','MPLX','TRGP'],
  '천연가스': ['LNG','EQT','ET','WMB'],
  '유전서비스': ['SLB','HAL','BKR'],
  '대형은행': ['JPM','BAC','WFC','GS','MS','C','USB','PNC','TFC','SCHW','BK'],
  '지역은행': ['USB','PNC','TFC','MTB','RF','CFG','KEY','FITB'],
  '투자은행': ['GS','MS','JPM','BAC','C'],
  '보험확장': ['UNH','BRK.B','CB','ALL','PGR','HIG','ACGL','AFL','MET','PRU','MFC','AIG'],
  '신용평가': ['SPGI','MCO','MSCI'],
  '거래소': ['CME','ICE','CBOE','NDAQ','COIN'],
  '제약확장': ['LLY','NVO','JNJ','PFE','ABBV','MRK','NVS','AZN','BMY','GILD','AMGN','REGN','VRTX','GSK','SNY','TAK'],
  '의료기기': ['ISRG','MDT','BSX','SYK','BDX','EW','ABT','ALGN','PODD','DXCM'],
  '의료유통': ['MCK','CAH','COR','WBA','HSIC'],
  '관리의료': ['UNH','ELV','CI','CVS','MOH','HCA'],
  '항공우주': ['BA','RTX','LMT','NOC','GD','HII','LHX','HWM','TXT','TDG','HEI'],
  '물류확장': ['FDX','UPS','CSX','NSC','JBHT','EXPD','CHRW','CP','CNI','ODFL'],
  '철도': ['CSX','NSC','UNP','CP','CNI'],
  '산업자동화': ['EMR','ROK','ETN','PH','ITW','DOV','AME'],
  '전력장비': ['ETN','PH','HUBB','GEV','VRT','PWR'],
  'hvac': ['TT','CARR','LII','JCI','WSO'],
  '유틸리티확장': ['NEE','SO','DUK','D','AEP','EXC','XEL','WEC','PPL','EIX','ETR','FE','AES','CMS','NI','ED','AWK','PEG','NRG'],
  '리츠': ['PLD','AMT','EQIX','DLR','SPG','PSA','O','WELL','IRM','SBAC','EXR','AVB','ESS','MAA','VTR','KIM','ARE','WY'],
  '데이터센터리츠': ['EQIX','DLR','IRM','AMT'],
  '크루즈': ['CCL','RCL','NCLH'],
  '카지노': ['LVS','MGM','CZR','WYNN'],
  '호텔': ['HLT','MAR','BKNG','ABNB'],
  '주택건설': ['DHI','PHM','NVR','BLDR'],
  '필수소비': ['PG','KO','PEP','WMT','COST','CL','CHD','CLX','GIS','KDP','KR','KVUE','MO','PM','BTI','DEO','BUD','STZ'],
  '금광': ['NEM','AEM','B','AU','GFI','WPM','FNV'],
  '구리': ['FCX','SCCO','BHP','RIO'],
  '화학': ['DD','PPG','IFF','EMN','CE','DOW','ALB','CTVA'],
  '산업가스': ['LIN','APD'],
  'it컨설팅': ['ACN','INFY','CTSH','EPAM','IT'],
  '게임확장': ['EA','TTWO','RBLX','NTES','SONY','MTCH'],
  // 새 키워드 (Task 2 추가)
  'saaspocalypse': ['NOW','CRWD','PANW','PLTR','WDAY','MNDY','DDOG','SNOW','GTLB','ESTC','PATH'],
  '사스포칼립스': ['NOW','CRWD','PANW','PLTR','WDAY','MNDY','DDOG','SNOW','GTLB','ESTC','PATH'],
  'turboquant': ['MU','SNDK','WDC','STX','005930.KS','000660.KS'],
  'kv캐시': ['MU','SNDK','WDC','STX','005930.KS','000660.KS'],
  'kv cache': ['MU','SNDK','WDC','STX','005930.KS','000660.KS'],
  'basis trade': ['TLT','IEF','LQD','HYG','SHV','BRK.B','JPM'],
  'basistrade': ['TLT','IEF','LQD','HYG','SHV','BRK.B','JPM'],
  'agentic': ['AMD','INTC','NVDA','AVGO','ARM'],
  'arm agi': ['ARM','AVGO'],
  '레포': ['JPM','BLK','GS','MS','SLV','GLD'],
  '마진콜': ['JPM','BLK','GS','MS','BAC','WFC'],
  'ftd': ['TLT','IEF','BND','AGG','UST'],
  'openclaw': ['AAPL','DELL','HPQ','NVDA','AMD','INTC'],
  'nemoclaw': ['NVDA','AAPL','DELL','HPQ'],
  '800v': ['VRT','ETN','EATON','ECL'],
  '800v dc': ['VRT','ETN','EATON','ECL'],
  '버티브': ['VRT'],
  'vertiv': ['VRT'],
  'cpu병목': ['ARM','AMD','INTC','NVDA','AVGO'],
  'graviton': ['AMZN','ARM'],
  'cobalt': ['MSFT','ARM'],
  'axion': ['GOOGL','ARM'],
  '액체냉각': ['VRT','ETN','ECL'],
  'liquid cooling': ['VRT','ETN','ECL'],
  // ═══ v35.6: 한국 종목 검색 앨리어스 ═══
  '한국주식': ['005930.KS','000660.KS','373220.KS','207940.KS','005380.KS','012450.KS','000270.KS','035420.KS','068270.KS','105560.KS'],
  '코스피': ['005930.KS','000660.KS','373220.KS','207940.KS','005380.KS','012450.KS','000270.KS','035420.KS','068270.KS','105560.KS'],
  '코스닥': ['042700.KQ','196170.KQ','247540.KQ','044820.KQ','192820.KQ','454910.KQ','277810.KQ','278470.KQ','323410.KQ','033100.KQ'],
  'kospi': ['005930.KS','000660.KS','373220.KS','207940.KS','005380.KS','012450.KS','000270.KS','035420.KS','068270.KS','105560.KS'],
  'kosdaq': ['042700.KQ','196170.KQ','247540.KQ','044820.KQ','192820.KQ','454910.KQ','277810.KQ','278470.KQ','323410.KQ','033100.KQ'],
  'k반도체': ['005930.KS','000660.KS','042700.KQ','009150.KS','402340.KS','039030.KQ','403870.KQ','058470.KQ'],
  'k방산': ['012450.KS','047810.KS','079550.KS','064350.KS','272210.KS','000880.KS','103140.KS'],
  'k조선': ['042660.KS','329180.KS','009540.KS','010140.KS','010620.KS','267250.KS'],
  'k전력': ['298040.KS','267260.KS','010120.KS','015760.KS','103590.KS','006260.KS'],
  'k원전': ['034020.KS','000720.KS','052690.KS','051600.KS'],
  'k배터리': ['373220.KS','006400.KS','247540.KQ','051910.KS','005490.KS','096770.KS','086520.KQ','003670.KQ','066970.KQ'],
  'k바이오': ['068270.KS','207940.KS','196170.KQ','128940.KS','028300.KQ','000100.KS','326030.KS','141080.KQ'],
  'k뷰티': ['090430.KS','051900.KS','044820.KQ','192820.KQ','161890.KS','278470.KQ','257720.KQ','237880.KQ'],
  'k콘텐츠': ['259960.KS','352820.KS','041510.KS','035900.KQ','122870.KQ','253450.KS','035760.KS'],
  'k푸드': ['003230.KS','097950.KS','271560.KS','004370.KS','280360.KS','005180.KS','000080.KS'],
  'k금융': ['105560.KS','055550.KS','086790.KS','316140.KS','138040.KS','032830.KS','000810.KS','323410.KQ'],
  'k로봇': ['454910.KQ','277810.KQ','315640.KQ','178320.KQ','005380.KS'],
  'k자동차': ['005380.KS','000270.KS','012330.KS','086280.KS','204320.KS'],
  '밸류업': ['105560.KS','055550.KS','086790.KS','316140.KS','138040.KS','005380.KS','000270.KS'],
  '삼성': ['005930.KS','207940.KS','006400.KS','009150.KS','032830.KS','000810.KS','018260.KS','028260.KS','016360.KS'],
  '현대': ['005380.KS','000270.KS','012330.KS','086280.KS','267260.KS','329180.KS','009540.KS','000720.KS','064350.KS'],
  'sk': ['000660.KS','402340.KS','096770.KS','017670.KS','034730.KS','326030.KS'],
  '한화': ['012450.KS','042660.KS','272210.KS','000880.KS','082740.KS','009830.KS'],
  'lg': ['373220.KS','051910.KS','051900.KS','003550.KS','066570.KS','032640.KS'],
};


function renderScreenerResults() {
  var market = document.getElementById('scr-market').value;
  var sector = document.getElementById('scr-sector').value;
  var signal = document.getElementById('scr-signal').value;
  var cap = document.getElementById('scr-cap').value;
  var adrFilter = (document.getElementById('scr-adr') ? document.getElementById('scr-adr').value : '');
  var textQ = (document.getElementById('scr-text-search') ? document.getElementById('scr-text-search').value : '').trim().toLowerCase();
  var ld = window._liveData || {};

  // 텍스트 검색어에서 키워드 앨리어스 매칭
  var aliasMatched = null; // array of matched syms or signal string
  var signalFromText = null;
  if (textQ) {
    var matchedSyms = {};
    var words = textQ.split(/[\s,;·+&]+/).filter(function(w) { return w.length > 0; });
    words.forEach(function(w) {
      var alias = SCR_KEYWORD_ALIASES[w];
      if (alias) {
        if (typeof alias === 'string') {
          signalFromText = alias; // 'BUY', 'SELL' etc.
        } else {
          alias.forEach(function(s) { matchedSyms[s] = true; });
        }
      }
    });
    if (Object.keys(matchedSyms).length > 0) aliasMatched = matchedSyms;
  }

  var filtered = SCREENER_DB.filter(function(r) {
    if (market && r.index !== market) return false;
    if (sector && r.sector !== sector) return false;
    if (signal && r.signal !== signal) return false;
    if (cap === 'MEGA' && r.mcap < 1000) return false;
    if (cap === 'LARGE' && (r.mcap < 10 || r.mcap >= 1000)) return false;
    if (cap === 'MID' && (r.mcap < 2 || r.mcap > 10)) return false; // v46.9: mcap=10 dead zone 수정 (>=10→>10)
    if (cap === 'SMALL' && r.mcap >= 2) return false;
    if (adrFilter) {
      var adrVal = getAdrEstimate(r);
      if (adrFilter === 'HIGH' && adrVal < 4) return false;
      if (adrFilter === 'MED' && (adrVal < 2 || adrVal >= 4)) return false;
      if (adrFilter === 'LOW' && adrVal >= 2) return false;
    }
    // 텍스트 검색 필터
    if (textQ) {
      if (signalFromText && r.signal !== signalFromText) return false;
      if (aliasMatched) {
        if (aliasMatched[r.sym]) return true;
      }
      // 직접 텍스트 매칭 (sym, name, memo, sector)
      var haystack = (r.sym + ' ' + r.name + ' ' + r.memo + ' ' + r.sector).toLowerCase();
      if (haystack.indexOf(textQ) !== -1) return true;
      // 개별 단어 매칭
      var allMatch = true;
      var words = textQ.split(/[\s,;·+&]+/).filter(function(w) { return w.length > 0; });
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (SCR_KEYWORD_ALIASES[w]) continue; // 이미 앨리어스로 처리됨
        if (haystack.indexOf(w) === -1) { allMatch = false; break; }
      }
      if (!allMatch && !aliasMatched) return false;
      if (!allMatch && aliasMatched && !aliasMatched[r.sym]) return false;
    }
    return true;
  });

  filtered.sort(function(a, b) {
    var av, bv;
    if (_scrSortCol === 'chgPct') {
      var ld2 = window._liveData || {};
      av = ld2[a.sym] ? ld2[a.sym].pct : 0;
      bv = ld2[b.sym] ? ld2[b.sym].pct : 0;
    } else if (_scrSortCol === 'price') {
      var ld2 = window._liveData || {};
      av = ld2[a.sym] ? ld2[a.sym].price : 0;
      bv = ld2[b.sym] ? ld2[b.sym].price : 0;
    } else if (_scrSortCol === 'adr') {
      av = getAdrEstimate(a);
      bv = getAdrEstimate(b);
    } else {
      av = a[_scrSortCol]; bv = b[_scrSortCol];
    }
    if (typeof av === 'string') { av = av.toUpperCase(); bv = bv.toUpperCase(); }
    var c = av > bv ? 1 : (av < bv ? -1 : 0);
    return _scrSortAsc ? c : -c;
  });

  var html = '';
  filtered.forEach(function(r) {
    var sc = r.signal === 'BUY' ? '#00e5a0' : r.signal === 'SELL' ? '#ff5b50' : r.signal === 'WATCH' ? '#ffa31a' : '#7b8599';
    var sb = r.signal === 'BUY' ? 'rgba(0,229,160,0.15)' : r.signal === 'SELL' ? 'rgba(255,91,80,0.15)' : r.signal === 'WATCH' ? 'rgba(255,163,26,0.15)' : 'rgba(148,163,184,0.15)';
    var d = ld[r.sym];
    var chg = d && d.pct != null ? d.pct : null;
    var cc = chg !== null ? (chg >= 0 ? '#00e5a0' : '#ff5b50') : '#7b8599';
    var chgDisplay = chg !== null ? ((chg >= 0 ? '+' : '') + chg.toFixed(2) + '%') : '—';
    var mcapStr = r.mcap >= 1000 ? '$' + (r.mcap/1000).toFixed(1) + 'T' : '$' + r.mcap + 'B';
    html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.05);cursor:pointer;" data-action="_aioScreenerTicker" data-arg="' + escHtml(r.sym) + '" onmouseover="this.style.background=\'rgba(255,255,255,0.03)\'" onmouseout="this.style.background=\'none\'">' +
      '<td style="padding:8px;"><div style="font-weight:800;font-family:var(--font-mono);font-size:12px;">' + escHtml(r.sym) + '</div><div style="font-size:9px;color:var(--text-muted);">' + escHtml(r.name) + '</div></td>' +
      '<td style="text-align:right;padding:8px;font-family:var(--font-mono);font-weight:700;" data-live-price="' + escHtml(r.sym) + '">—</td>' +
      '<td style="text-align:right;padding:8px;font-family:var(--font-mono);color:' + cc + ';" data-live-chg="' + escHtml(r.sym) + '">' + chgDisplay + '</td>' +
      '<td style="text-align:center;padding:6px 4px;"><canvas class="sparkline-mini" data-spark-ticker="' + escHtml(r.sym) + '" width="64" height="22" role="img" aria-label="' + escHtml(r.sym) + ' 스파크라인 차트" style="display:inline-block;vertical-align:middle;"></canvas></td>' +
      '<td style="text-align:center;padding:8px;"><span style="background:' + sb + ';color:' + sc + ';padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;">' + escHtml(r.signal) + '</span></td>' +
      '<td style="text-align:right;padding:8px;font-family:var(--font-mono);">' + r.rsi + '</td>' +
      '<td style="text-align:right;padding:8px;font-family:var(--font-mono);font-size:10px;color:' + (getAdrEstimate(r) >= 4 ? '#ffa31a' : getAdrEstimate(r) >= 2 ? '#7b8599' : '#00e5a0') + ';">' + getAdrEstimate(r) + '%</td>' +
      '<td style="text-align:right;padding:8px;font-family:var(--font-mono);font-size:10px;">' + mcapStr + '</td>' +
      '<td style="padding:8px;color:var(--text-muted);font-size:10px;">' + escHtml(r.memo) + '</td>' +
      '<td style="text-align:center;padding:4px;"><button data-action="addToWatchlistFromScreener" data-arg="' + escHtml(r.sym) + '" data-stop="1" style="background:none;border:none;cursor:pointer;font-size:12px;opacity:0.5;transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.5" title="관심 종목에 추가"></button></td></tr>';
  });

  document.getElementById('screener-results-body').innerHTML = html || '<tr><td colspan="10" style="text-align:center;padding:20px;color:var(--text-muted);">조건에 맞는 종목이 없습니다</td></tr>';
  // 스파크라인 미니차트 렌더링
  requestAnimationFrame(function() { renderSparklines(filtered); });
  document.getElementById('screener-result-count').textContent = filtered.length;
  // v37.8: 동적 스크리너 분석
  if (typeof _generateScreenerAnalysis === 'function') _generateScreenerAnalysis(filtered, ld);

  // v38.3: 스크리너 결과에 실시간 가격 즉시 반영 — tbody 스코프 한정 (O(n) 단일 패스)
  var ld2 = window._liveData || {};
  var tbody = document.getElementById('screener-results-body');
  if (tbody) {
    tbody.querySelectorAll('[data-live-price]').forEach(function(el) {
      var sym = el.getAttribute('data-live-price');
      var d = ld2[sym];
      if (!d) return;
      var fmt = d.price.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2});
      if (el.children.length > 0) { var _pp = el.querySelector('.pill-price'); if (_pp) _pp.textContent = fmt; }
      else { el.textContent = fmt; }
      el.style.color = 'var(--text-primary)';
      el.style.fontWeight = '700';
    });
    tbody.querySelectorAll('[data-live-chg]').forEach(function(el) {
      var sym = el.getAttribute('data-live-chg');
      var d = ld2[sym];
      if (!d) return;
      if (d.pct == null) { el.textContent = '—'; el.style.color = '#7b8599'; return; }
      var pct = d.pct;
      el.textContent = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
      el.style.color = pct >= 0 ? '#00e5a0' : '#ff5b50';
      el.style.fontWeight = '700';
    });
  }
}

// ═══ 스파크라인 미니차트 시스템 ═══════════════════════════════════════
var _sparkCache = {}; // { ticker: { data: [numbers], ts: timestamp } }
var _sparkCacheTTL = 5 * 60 * 1000; // 5분 캐시

function renderSparklines(filtered) {
  var canvases = document.querySelectorAll('.sparkline-mini[data-spark-ticker]');
  canvases.forEach(function(canvas) {
    var ticker = canvas.getAttribute('data-spark-ticker');
    var cached = _sparkCache[ticker];
    if (cached && (Date.now() - cached.ts < _sparkCacheTTL)) {
      drawSparkline(canvas, cached.data, ticker);
    } else {
      fetchSparkData(ticker).then(function(data) {
        if (data && data.length > 1) {
          _sparkCache[ticker] = { data: data, ts: Date.now() };
          drawSparkline(canvas, data, ticker);
        } else {
          drawSparkPlaceholder(canvas);
        }
      }).catch(function() { drawSparkPlaceholder(canvas); });
    }
  });
}

function fetchSparkData(ticker) {
  var url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) +
    '?range=5d&interval=1d&includePrePost=true';
  return fetch(url).then(function(r) { return r.json(); }).then(function(json) {
    try {
      var closes = json.chart.result[0].indicators.quote[0].close;
      return closes.filter(function(v) { return v !== null && isFinite(v); });
    } catch(e) { return null; }
  }).catch(function() { return null; });
}

function drawSparkline(canvas, data, ticker) {
  var ctx = canvas.getContext('2d');
  if (!ctx || data.length < 2) return;
  var w = canvas.width, h = canvas.height;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.scale(dpr, dpr);

  var min = Math.min.apply(null, data);
  var max = Math.max.apply(null, data);
  var range = max - min;
  var isFlat = range < 0.0001; // v46.9: 플랫라인 감지
  range = range || 1;
  var pad = 2;
  var xStep = (w - pad*2) / (data.length - 1);
  var yScale = isFlat ? 1 : (h - pad*2) / range;

  // 트렌드 색상 결정: 첫 값 vs 마지막 값
  var isUp = data[data.length - 1] >= data[0];
  var color = isUp ? '#00e5a0' : '#ff5b50';

  // 영역 채우기 (gradient)
  ctx.beginPath();
  data.forEach(function(v, i) {
    var x = pad + i * xStep;
    var y = isFlat ? h / 2 : h - pad - (v - min) * yScale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.lineTo(pad + (data.length - 1) * xStep, h);
  ctx.lineTo(pad, h);
  ctx.closePath();
  var grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, isUp ? 'rgba(0,229,160,0.18)' : 'rgba(255,91,80,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fill();

  // 라인
  ctx.beginPath();
  data.forEach(function(v, i) {
    var x = pad + i * xStep;
    var y = h - pad - (v - min) * yScale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 마지막 점 (현재가)
  var lastX = pad + (data.length - 1) * xStep;
  var lastY = h - pad - (data[data.length - 1] - min) * yScale;
  ctx.beginPath();
  ctx.arc(lastX, lastY, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
}

function drawSparkPlaceholder(canvas) {
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(148,163,184,0.3)';
  ctx.font = '8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('—', w/2, h/2 + 3);
}

// v39.2: screener 제거됨
function switchTab(tabId, el) {
  // Handle both switchTab(el, tabId) and switchTab(tabId) forms
  if (el && typeof el === 'string') { var tmp = tabId; tabId = el; el = tmp; }
  const page = (el && el.closest) ? (el.closest('.page') || document.getElementById('page-ticker')) : document.getElementById('page-ticker');
  if (page) page.querySelectorAll('.tab').forEach(function(t){ t.classList.remove('active'); });
  if (el && el.classList) el.classList.add('active');
  ['tab-overview','tab-chart','tab-financials','tab-technical','tab-fundamental','tab-monalert'].forEach(function(id){
    const el2 = document.getElementById(id);
    if(el2) el2.style.display = (id === tabId) ? '' : 'none';
  });
  // v27.1: Chart 탭 선택 시 자동으로 차트 로드
  if (tabId === 'tab-chart' && typeof loadTickerChart === 'function') {
    setTimeout(function(){ loadTickerChart('3m', null); }, 100);
  }
}
function switchThemeMode(mode) {
  const etfView = document.getElementById('etf-view');
  const subView = document.getElementById('subtheme-view');
  const etfBtn = document.getElementById('etf-btn');
  const subBtn = document.getElementById('sub-btn');
  const desc = document.getElementById('theme-mode-desc');
  if(mode === 'etf') {
    etfView.style.display = '';
    subView.style.display = 'none';
    etfBtn.style.background = 'var(--accent-dim)'; etfBtn.style.color = 'var(--accent)'; etfBtn.style.fontWeight = '600';
    subBtn.style.background = 'transparent'; subBtn.style.color = 'var(--text-secondary)'; subBtn.style.fontWeight = 'normal';
    desc.textContent = '대표 ETF 기준 · 누구나 바로 매매 가능한 상품';
  } else {
    etfView.style.display = 'none';
    subView.style.display = '';
    subBtn.style.background = 'var(--accent-dim)'; subBtn.style.color = 'var(--accent)'; subBtn.style.fontWeight = '600';
    etfBtn.style.background = 'transparent'; etfBtn.style.color = 'var(--text-secondary)'; etfBtn.style.fontWeight = 'normal';
    desc.textContent = '개별 종목 equal-weighted % 평균 · 고수 전용 세분화 지수';
  }
}
// ═══════════════════════════════════════════════════════════════
// AIO LIVE DATA ENGINE v1.0
// 나라별 우선순위 기반 멀티소스 실시간 뉴스 + 시세 데이터
// ═══════════════════════════════════════════════════════════════

// ── 소스 정의 ─────────────────────────────────────────────────

// ── Country flag mapping ────────────────────────────────────────
const COUNTRY_FLAG = {
  us: '🇺🇸', kr: '', asia: '', eu: '🇪🇺',
  jp: '🇯🇵', cn: '🇨🇳', tw: '🇹🇼', sg: '🇸🇬',
  gb: '🇬🇧', de: '🇩🇪', fr: '🇫🇷', au: '🇦🇺',
};
function getCountryFlag(country) {
  return COUNTRY_FLAG[country] || COUNTRY_FLAG[(country||'').toLowerCase()] || '';
}

/* ═══════════════════════════════════════════════════════════════
   v20 DATA ENGINE — 실시간 & 지연 데이터 통합 모듈
   Budget: $50 total / 5 users ($10/user/mo) · GitHub Pages static hosting
   ═══════════════════════════════════════════════════════════════ */

// ── API Endpoints (모두 무료 또는 CORS 허용) ──────────────────
const DATA_APIS = {
  // 1. Alpha Vantage (무료 25회/일, 키 필수 — 기술적 지표)
  alphaVantage: {
    base: 'https://www.alphavantage.co/query',
    key: () => (typeof safeLSGetSync === 'function' ? safeLSGetSync('aio_av_key') : _getApiKey('aio_av_key')) || 'demo',
    limit: '25/day free · $50/mo for 75/min'
  },
  // 2. Twelve Data (무료 800회/일 — 시세, 차트, 기술지표)
  twelveData: {
    base: 'https://api.twelvedata.com',
    key: () => (typeof safeLSGetSync === 'function' ? safeLSGetSync('aio_td_key') : _getApiKey('aio_td_key')) || '',
    limit: '800/day free · 8 symbols/request'
  },
  // 3. Financial Modeling Prep (무료 250회/일 — 재무제표, 밸류에이션)
  fmp: {
    base: 'https://financialmodelingprep.com/stable',
    key: () => (typeof safeLSGetSync === 'function' ? safeLSGetSync('aio_fmp_key') : _getApiKey('aio_fmp_key')) || 'demo',
    limit: '250/day free · 5 years history'
  },
  // 4. FRED (무료, 키 필수 — 매크로 경제지표)
  fred: {
    base: 'https://api.stlouisfed.org/fred/series/observations',
    key: () => (typeof safeLSGetSync === 'function' ? safeLSGetSync('aio_fred_key') : _getApiKey('aio_fred_key')) || '',
    limit: 'Unlimited free · CORS friendly'
  },
  // 5. Finnhub (무료 60회/분 — 실시간 시세, 뉴스, 기업정보)
  finnhub: {
    base: 'https://finnhub.io/api/v1',
    key: () => (typeof safeLSGetSync === 'function' ? safeLSGetSync('aio_finnhub_key') : _getApiKey('aio_finnhub_key')) || '',
    limit: '60/min free · real-time US quotes'
  },
  // 6. CoinGecko (기존 유지 — 암호화폐)
  coingecko: { base: 'https://api.coingecko.com/api/v3', key: () => '', limit: '30/min free' },
  // v47.10: exchangeRate / altFearGreed 제거 — 선언만 있고 호출 0건 (dead code P112)
};

// ── API 키 관리 UI 확장 ──────────────────────────────────────
const API_KEY_CONFIG = [
  { id: 'aio_av_key',      label: 'Alpha Vantage',  placeholder: 'alphavantage.co 무료 키', url: 'https://www.alphavantage.co/support/#api-key' },
  { id: 'aio_td_key',      label: 'Twelve Data',    placeholder: 'twelvedata.com 무료 키',  url: 'https://twelvedata.com/account/api-keys' },
  { id: 'aio_fmp_key',     label: 'FMP',            placeholder: 'financialmodelingprep.com', url: 'https://site.financialmodelingprep.com/developer' },
  { id: 'aio_fred_key',    label: 'FRED',           placeholder: 'fred.stlouisfed.org API키', url: 'https://fred.stlouisfed.org/docs/api/api_key.html' },
  { id: 'aio_finnhub_key', label: 'Finnhub',        placeholder: 'finnhub.io 무료 키',       url: 'https://finnhub.io/register' },
];

// ── 유틸리티: 타임아웃 fetch ──────────────────────────────────
function fetchWithTimeout(url, opts = {}, ms = 8000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── v30.11 Task 11: CORS 프록시 레지스트리 (단일 진실 원천) ──────────────────
const _cfWorkerUrl = () => _getApiKey('aio_cf_worker_url') || '';

const _PROXY_REGISTRY = {
  list: [],
  init: function() {
    var cf = _cfWorkerUrl();
    this.list = [];
    // Tier 0: 자체 CF Worker (최우선)
    if (cf) this.list.push({ id:'cf-worker', label:'CF Worker', mkUrl: function(u){ return cf+'?url='+encodeURIComponent(u); }, fails:0, lastOk:0, disabled:false });
    // Tier 1: 검증된 공개 프록시
    this.list.push({ id:'corsproxy', label:'corsproxy.io', mkUrl: function(u){ return 'https://corsproxy.io/?'+encodeURIComponent(u); }, fails:0, lastOk:0, disabled:false });
    // Tier 2: 보조 프록시
    this.list.push({ id:'allorigins-raw', label:'allorigins/raw', mkUrl: function(u){ return 'https://api.allorigins.win/raw?url='+encodeURIComponent(u); }, fails:0, lastOk:0, disabled:false });
    this.list.push({ id:'allorigins-get', label:'allorigins/get', mkUrl: function(u){ return 'https://api.allorigins.win/get?url='+encodeURIComponent(u); }, fails:0, lastOk:0, disabled:false });
    this.list.push({ id:'codetabs', label:'codetabs.com', mkUrl: function(u){ return 'https://api.codetabs.com/v1/proxy?quest='+encodeURIComponent(u); }, fails:0, lastOk:0, disabled:false });
  },
  markOk: function(id) {
    var p = this.list.find(function(x){ return x.id === id; });
    if (p) { p.fails = 0; p.lastOk = Date.now(); p.disabled = false; p.cooldownLevel = 0; } // v48.14: backoff 리셋
    if (typeof _reportApiOk === 'function') _reportApiOk('proxy-primary', id + ' 성공');
  },
  markFail: function(id) {
    var p = this.list.find(function(x){ return x.id === id; });
    if (p) {
      p.fails++;
      if (p.fails >= 5) {
        p.disabled = true;
        // v48.14 (W13): exponential backoff + jitter — 60s → 120s → 240s → 480s → max 1800s
        p.cooldownLevel = (p.cooldownLevel || 0) + 1;
        var baseDelay = T.COOLDOWN * Math.pow(2, Math.min(p.cooldownLevel - 1, 5)); // 최대 32x
        var jitter = Math.random() * 0.3 * baseDelay; // ±30% jitter (thundering herd 방지)
        var actualDelay = Math.min(baseDelay + jitter, 1800000); // 30분 상한
        if (typeof _aioLog === 'function') {
          _aioLog('warn', 'proxy', 'proxy ' + id + ' disabled (level ' + p.cooldownLevel + ', cooldown ' + Math.round(actualDelay/1000) + 's)', { fails: p.fails });
        }
        setTimeout(function() {
          p.disabled = false;
          p.fails = 2;
          if (typeof _aioLog === 'function') _aioLog('info', 'proxy', 'proxy ' + id + ' re-enabled', { cooldownLevel: p.cooldownLevel });
        }, actualDelay);
      }
    }
  },
  getActive: function() {
    return this.list.filter(function(p){ return !p.disabled; }).sort(function(a,b){ return (b.lastOk||0) - (a.lastOk||0); });
  },
  // 하위 호환: mkUrl 함수 배열 반환 (기존 PROXY_LIST 형태)
  getMkUrls: function() { return this.getActive().map(function(p){ return p.mkUrl; }); },
  // v35.7 CF Worker 부하 분산: 라운드로빈 카운터
  _rrIndex: 0,
  getRotated: function() {
    var active = this.getActive();
    if (active.length <= 1) return active;
    var idx = this._rrIndex % active.length;
    this._rrIndex++;
    return active.slice(idx).concat(active.slice(0, idx));
  }
};
_PROXY_REGISTRY.init();

// 하위 호환: 기존 코드에서 PROXY_LIST 참조하는 곳 대응
const PROXY_LIST = _PROXY_REGISTRY.getMkUrls();

async function fetchViaProxy(url, timeout) {
  timeout = timeout || 8000;
  // v35.7: 라운드로빈으로 CF Worker 부하 분산
  var active = _PROXY_REGISTRY.getRotated();
  // v48.14 (Agent W7/P2-7): stale-cache degradation — 성공 응답을 localStorage에 저장
  var cacheKey = 'aio_proxy_cache_' + btoa(url.slice(0, 150)).replace(/[^A-Za-z0-9]/g, '').substring(0, 64);
  for (var i = 0; i < active.length; i++) {
    var proxy = active[i];
    try {
      var r = await fetchWithTimeout(proxy.mkUrl(url), {}, timeout);
      if (r.ok) {
        _PROXY_REGISTRY.markOk(proxy.id);
        // 성공 응답 캐시 (stale 폴백용, clone body)
        try {
          var rClone = r.clone();
          rClone.text().then(function(t) {
            try { localStorage.setItem(cacheKey, JSON.stringify({ body: t, ts: Date.now() })); } catch(e) {}
          }).catch(function() {});
        } catch(e) {}
        return r;
      }
      _PROXY_REGISTRY.markFail(proxy.id);
    } catch(e) { _PROXY_REGISTRY.markFail(proxy.id); }
  }
  if (typeof _reportApiError === 'function') _reportApiError('proxy-primary', '전체 프록시 실패');
  // v48.14: stale-cache 폴백 — 전체 프록시 실패 시 localStorage last-good 응답 반환
  try {
    var cached = localStorage.getItem(cacheKey);
    if (cached) {
      var parsed = JSON.parse(cached);
      var ageH = (Date.now() - parsed.ts) / 3600000;
      if (ageH < 6 && parsed.body) { // 6시간 이내 캐시만 허용
        if (typeof _aioLog === 'function') _aioLog('warn', 'proxy', 'stale-cache 폴백 (' + Math.round(ageH*60) + '분 전) for ' + url.substring(0, 80));
        return new Response(parsed.body, { status: 200, statusText: 'OK (stale-cache)', headers: { 'X-AIO-Stale': Math.round(ageH*60) + 'min' } });
      }
    }
  } catch(cacheErr) {}
  throw new Error('All proxies failed for: ' + url);
}

// ═══ 1. Finnhub 실시간 시세 (WebSocket with Enhanced Reconnection) ═════════════════════════
let _finnhubWS = null;
let _finnhubPrices = {};
let _finnhubReconnectAttempts = 0;
let _finnhubReconnectTimer = null;
let _finnhubErrorLogged = false; // Track if error already logged for this connection
const _finnhubMaxDelay = 60; // Max 60 seconds between retries (fast phase)
const _finnhubSlowDelay = 300; // 5 minutes between retries (slow phase, after 10 fast attempts)

function initFinnhubWebSocket() {
  const key = DATA_APIS.finnhub.key();
  if (!key) { console.log('[AIO] Finnhub key not set — skipping WebSocket'); return; }

  // v48.14 (Agent W15): 서킷 브레이커 — 1시간 20회 fail 누적 시 24시간 완전 disable
  window._finnhubCircuit = window._finnhubCircuit || { failsInWindow: 0, windowStart: Date.now(), disabledUntil: 0 };
  var circuit = window._finnhubCircuit;
  var now = Date.now();
  // 1시간 window 리셋
  if (now - circuit.windowStart > 3600000) { circuit.failsInWindow = 0; circuit.windowStart = now; }
  // 서킷 disable 상태 체크
  if (circuit.disabledUntil > now) {
    var hrsLeft = Math.ceil((circuit.disabledUntil - now) / 3600000);
    if (typeof _aioLog === 'function') _aioLog('warn', 'finnhub', 'circuit breaker open — skip for ' + hrsLeft + 'h');
    const badge = document.querySelector('.freshness-badge.fb-live');
    if (badge) badge.innerHTML = '서킷 차단 (' + hrsLeft + 'h)';
    return;
  }
  // fail 누적 확인
  if (circuit.failsInWindow >= 20) {
    circuit.disabledUntil = now + 24 * 3600000; // 24시간 완전 disable
    if (typeof _aioLog === 'function') _aioLog('error', 'finnhub', '서킷 브레이커 OPEN — 24시간 비활성화 (1h 20회 fail)');
    const badge = document.querySelector('.freshness-badge.fb-live');
    if (badge) badge.innerHTML = '서킷 차단 (24h)';
    return;
  }

  // v38.3: 10회 빠른 재연결 실패 후 → 5분 간격 슬로우 모드 (영구 포기 안 함)
  if (_finnhubReconnectAttempts >= 10 && _finnhubReconnectAttempts % 5 !== 0) {
    // 슬로우 모드: 5회마다 1회만 시도 (실질 25분 간격)
    _finnhubReconnectAttempts++;
    if (_finnhubReconnectTimer) clearTimeout(_finnhubReconnectTimer);
    _finnhubReconnectTimer = setTimeout(initFinnhubWebSocket, _finnhubSlowDelay * 1000);
    return;
  }
  if (_finnhubReconnectAttempts === 10) {
    _aioLog('warn', 'fetch', 'Finnhub WS: 빠른 재연결 10회 실패 → 슬로우 모드 전환 (5분 간격)');
    if (typeof _aioLog === 'function') _aioLog('warn', 'finnhub', '빠른 재연결 10회 실패 → 슬로우 모드');
    const badge = document.querySelector('.freshness-badge.fb-live');
    if (badge) badge.innerHTML = '재연결 대기';
  }

  try {
    _finnhubErrorLogged = false; // Reset error logging flag for new connection attempt
    _finnhubWS = new WebSocket('wss://ws.finnhub.io?token=' + key);

    _finnhubWS.onopen = () => {
      console.log('[AIO v20] Finnhub WebSocket connected — real-time mode');
      _finnhubReconnectAttempts = 0; // Reset on successful connection
      _finnhubErrorLogged = false;
      // Subscribe to key symbols (all symbols that appear on active page)
      const wsSymbols = [
        'AAPL','NVDA','TSLA','MSFT','AMZN','GOOGL','META','AMD','AVGO','MU','ARM',
        'SPY','QQQ','IWM','EEM','GLD','TLT','HYG', 'LQD' // Include ETFs & indices where available
      ];
      wsSymbols.forEach(s => _finnhubWS.send(JSON.stringify({ type: 'subscribe', symbol: s })));
      const badge = document.querySelector('.freshness-badge.fb-live');
      if (badge) badge.innerHTML = '● FINNHUB 실시간';
    };

    _finnhubWS.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'trade' && msg.data) {
          msg.data.forEach(trade => {
            const sym = trade.s;
            const price = trade.p;
            if (typeof price === 'number' && !isNaN(price) && price > 0) {
              _finnhubPrices[sym] = price;
              // Route through PriceStore for validation & global sync
              if (window.PriceStore) {
                PriceStore.set(sym, price, 0, 'live:finnhub');
              } else {
                window._liveData = window._liveData || {};
                if (window._liveData[sym]) { window._liveData[sym].price = price; }
                else { window._liveData[sym] = { price, pct: 0 }; }
                window._quoteTimestamps = window._quoteTimestamps || {};
                window._quoteTimestamps[sym] = Date.now();
              }
              // Update DOM elements
              document.querySelectorAll(`[data-live-price="${sym}"]`).forEach(el => {
                // v38.3: P24 일반 보호 — children 있는 복합 요소는 전용 업데이트에 위임
                if (el.children.length > 0) {
                  var _pp = el.querySelector('.pill-price') || el.querySelector('.kr-etf-price');
                  if (_pp) _pp.textContent = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                } else { el.textContent = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
                el.style.borderBottom = ''; // Clear stale indicator
              });
            }
          });
        }
      } catch(e) { _aioLog('warn', 'fetch', 'Finnhub parse error: ' + (e && e.message || e)); }
    };

    _finnhubWS.onerror = (e) => {
      // Only log error once per connection attempt to avoid console spam
      if (!_finnhubErrorLogged) {
        _aioLog('warn', 'fetch', 'Finnhub WS error: ' + (e.message || 'connection error'));
        _finnhubErrorLogged = true;
        // v48.14 (W15): 서킷 브레이커 fail 카운트 증가
        if (window._finnhubCircuit) window._finnhubCircuit.failsInWindow++;
        if (typeof _aioLog === 'function') _aioLog('warn', 'finnhub', 'WS error (circuit fails: ' + (window._finnhubCircuit ? window._finnhubCircuit.failsInWindow : '?') + '/20)');
      }
    };

    _finnhubWS.onclose = () => {
      console.log('[AIO] Finnhub WS closed');
      _finnhubReconnectAttempts++;
      // 10회까지: 지수 백오프 (3s→6s→12s→...→60s), 이후: 슬로우 모드 (initFinnhub 내부 처리)
      const delay = _finnhubReconnectAttempts <= 10
        ? Math.min(_finnhubMaxDelay, 3 * Math.pow(2, _finnhubReconnectAttempts - 1))
        : _finnhubSlowDelay;
      console.log(`[AIO] Finnhub reconnecting in ${delay}s (attempt ${_finnhubReconnectAttempts})`);
      if (_finnhubReconnectTimer) clearTimeout(_finnhubReconnectTimer);
      _finnhubReconnectTimer = setTimeout(initFinnhubWebSocket, delay * 1000);
    };
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub WS init failed: ' + (e && e.message || e)); }
}

// ═══ 2. Twelve Data — 기술적 지표 & 차트 데이터 ═══════════════
// v47.11: 6 sequential → 1 POST /complex_data 일괄 요청으로 교체
// 기존: 15분마다 6회 × 24h = 576/day (무료 800/day 72% 소모)
// 변경: 15분마다 1회 × 24h = 96/day (83% 쿼터 확보, 레이턴시 6배 단축)
// 폴백: complex_data 응답 파싱 실패 시 개별 순차 호출로 복귀 (계정 플랜 미지원 대비)
async function fetchTechnicalIndicators(symbol = 'SPY') {
  const key = DATA_APIS.twelveData.key();
  if (!key) return null;
  // v48.9: 공유 키 쿼터 사전 체크 (800/day 도달 시 스킵)
  if (typeof _isQuotaExceeded === 'function' && _isQuotaExceeded('twelveData')) return null;
  const indicators = ['rsi','macd','stoch','adx','bbands','ema'];
  // v47.11 주 경로: POST /complex_data
  try {
    const body = {
      symbols: [symbol],
      intervals: ['1day'],
      methods: indicators.map(function(n){ return { name: n }; })
    };
    const url = `${DATA_APIS.twelveData.base}/complex_data?apikey=${key}`;
    const r = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }, 10000);
    if (r.ok) {
      if (typeof _bumpApiCounter === 'function') _bumpApiCounter('twelveData');
      const json = await r.json();
      if (json && Array.isArray(json.data) && json.data.length > 0) {
        const entry = json.data[0];
        const results = {};
        let matched = 0;
        indicators.forEach(function(ind) {
          if (entry[ind]) { results[ind] = entry[ind]; matched++; }
        });
        if (matched > 0) return results;
      }
    }
  } catch(e) { _aioLog('warn', 'fetch', 'Twelve Data complex_data error: ' + e.message); }
  // v47.11 폴백: 개별 순차 호출 (complex_data 미지원 시)
  try {
    const results = {};
    for (const ind of indicators) {
      const url2 = `${DATA_APIS.twelveData.base}/${ind}?symbol=${symbol}&interval=1day&apikey=${key}`;
      const r2 = await fetchWithTimeout(url2, {}, 6000);
      if (r2.ok) results[ind] = await r2.json();
      await new Promise(ok => setTimeout(ok, 200));
    }
    return results;
  } catch(e) { _aioLog('warn', 'fetch', 'Twelve Data sequential fallback error: ' + (e && e.message || e)); return null; }
}

// v47.10: fetchChartData / fetchBreadthFromAV / fetchFundamentals 제거 — 정의만 있고 호출 0건 (dead code P112)

// ═══ 4-1. Naver — US 주식 재무/컨센서스/기업개요 (무료, 프록시 필요) ═══

// NYSE 상장 종목 세트 (Reuters .N 코드) — 나머지는 NASDAQ(.O) 기본
var _NAVER_NYSE = 'JPM V XOM MA UNH JNJ HD PG ABBV MRK CVX BAC DIS WMT KO PEP MCD TMO LLY GS MS BMY RTX HON CAT DE UPS IBM GE NKE VZ T PM AXP C WFC PFE ABT DHR LOW SYK BDX ZTS CME ICE APD SHW ECL EMR ETN ITW NSC UNP LMT NOC GD BA F GM SO NEE DUK SPGI MCO BLK MMC AON CL WMB KMI MPC VLO PSX SLB HAL FCX NUE URI DD HCA SYY YUM WM PLD SPG PSA O AEP EXC SRE WEC DOW COP OXY EOG BKR COF BK MET PRU AIG AFL TRV CB RSG TFC PNC USB HUBB GPN OTIS STE VRSK EFX NRG PCAR KHC MCK MAR IQV STZ CNC CI MDLZ BSX TJX GEV VRT DELL HPE GLW CCJ PGR TDG RMD TRGP ROP CARR WELL TSM BABA NVO NVS AZN HSBC TM SHEL RIO BHP UBS UL BUD TTE BP TD RY SONY HUM A'.split(' ').reduce(function(s,t){s[t]=1;return s;},{});

var _naverUSCache = {};

// Yahoo 티커 → Naver Reuters 코드 변환
function _toNaverReuters(sym) {
  if (!sym || /\.\w{1,2}$/.test(sym)) return null; // 한국 종목(.KS/.KQ) 제외
  if (sym === 'BRK-B' || sym === 'BRK.B') return 'BRKb.N';
  return sym + (_NAVER_NYSE[sym] ? '.N' : '.O');
}

// Naver US 주식 통합 조회: basic + integration + finance(옵션)
async function fetchNaverUSData(sym, includeFinance) {
  var ck = sym + (includeFinance ? '_f' : '');
  if (_naverUSCache[ck] && (Date.now() - _naverUSCache[ck]._ts < 600000)) return _naverUSCache[ck];
  var code = _toNaverReuters(sym);
  if (!code) return null;
  var base = 'https://api.stock.naver.com/stock/' + code;
  try {
    var ps = [
      fetchViaProxy(base + '/basic', 5000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}),
      fetchViaProxy(base + '/integration', 5000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;})
    ];
    if (includeFinance) ps.push(fetchViaProxy(base + '/finance/annual', 5000).then(function(r){return r.ok?r.json():null;}).catch(function(){return null;}));
    var res = await Promise.all(ps);
    var basic = res[0], integ = res[1], fin = res[2] || null;
    if (!basic && !integ) return null;

    var result = { _ts: Date.now(), _code: code };

    // Basic: 한국어명, 로고, 업종, 거래소
    if (basic) {
      result.nameKr = basic.stockName || null;
      result.logoUrl = basic.itemLogoPngUrl || null;
      result.industryKr = basic.industryCodeType ? basic.industryCodeType.industryGroupKor : null;
      result.exchange = basic.stockExchangeName || null;
    }

    // Integration → 컨센서스 (목표가, 추천등급)
    if (integ && integ.consensusInfo && integ.consensusInfo.priceTargetMean) {
      var ci = integ.consensusInfo;
      result.consensus = {
        recommMean: parseFloat(ci.recommMean) || null,
        targetMean: parseFloat(ci.priceTargetMean) || null,
        targetHigh: parseFloat(ci.priceTargetHigh) || null,
        targetLow: parseFloat(ci.priceTargetLow) || null,
        date: ci.createDate || null
      };
    }

    // Integration → 기업개요 (한국어)
    if (integ && integ.corporateOverview) result.overview = integ.corporateOverview;

    // Integration → 경영진/직원
    if (integ && integ.summaries) {
      result.ceo = integ.summaries.representativeName || null;
      result.employees = integ.summaries.employees || null;
    }

    // Integration → 동종업계 비교
    if (integ && integ.industryCompareInfo) {
      var gl = integ.industryCompareInfo.globalStocks || [];
      result.peers = gl.slice(0, 6).map(function(s) {
        return { sym: s.symbolCode, name: s.stockName, price: s.closePrice, chg: s.fluctuationsRatio, mcap: s.marketValueHangeul };
      });
    }

    // Finance → 연간 재무제표
    if (fin && fin.rowList) {
      var fd = {};
      fin.rowList.forEach(function(row) {
        var cols = row.columns || {};
        var keys = Object.keys(cols);
        if (keys.length > 0) { var v = cols[keys[keys.length - 1]]; fd[row.title] = v ? v.value : null; }
      });
      result.financials = fd;
      result.finUnit = fin.unit || null;
    }

    _naverUSCache[ck] = result;
    return result;
  } catch(e) {
    _aioLog('warn', 'fetch', 'Naver US error: ' + sym + ' ' + (e.message || e));
    return null;
  }
}

// ═══ 5. FRED — 매크로 경제 지표 실시간 ═══════════════════════
async function fetchFredSeries(seriesId, limit = 30) {
  const key = DATA_APIS.fred.key();
  if (!key) return null;
  const url = `${DATA_APIS.fred.base}?series_id=${seriesId}&api_key=${key}&file_type=json&sort_order=desc&limit=${limit}`;

  // v31.5: JSON 응답에서 observations 추출 (allorigins 래핑 자동 해제)
  function _extractObs(data) {
    if (data.contents && typeof data.contents === 'string') {
      try { data = JSON.parse(data.contents); } catch(e) {}
    }
    return data.observations || [];
  }

  // 1차: CF Worker 우선 (CORS 문제 없음, 가장 빠름)
  const cfWorker = _getApiKey('aio_cf_worker_url');
  if (cfWorker) {
    try {
      const r = await fetchWithTimeout(cfWorker + '?url=' + encodeURIComponent(url), {}, 8000);
      if (r.ok) { return _extractObs(await r.json()); }
    } catch(e) { /* CF Worker failed — try direct */ }
  }
  // 2차: 직접 호출 시도
  try {
    const r = await fetchWithTimeout(url, {}, 6000);
    if (r.ok) { return _extractObs(await r.json()); }
    if (r.status === 429) { _aioLog('warn', 'fetch', 'FRED rate limit hit — 60s 대기'); await new Promise(ok => setTimeout(ok, T.COOLDOWN)); return null; }
    if (r.status === 403 || r.status === 400) { showDataError('FRED', 'API 키가 유효하지 않거나 한도 초과', 'error'); return null; }
  } catch(e) { /* CORS blocked — fallback to proxy */ }
  // 3차: CORS 프록시 경유 (corsproxy, allorigins 등)
  try {
    const r = await fetchViaProxy(url, 8000);
    if (r.ok) { return _extractObs(await r.json()); }
  } catch(e) { _aioLog('warn', 'fetch', 'FRED proxy error: ' + seriesId + ' ' + (e.message || e)); }
  return null;
}

// v47.11: 5개 시리즈 추가 — DFEDTARU(기존 참조 L12997 있으나 등록 누락된 dead branch 해결)
//   + PAYEMS(비농업고용), M2SL(M2 통화량), DCOILWTICO(WTI 유가), MORTGAGE30US(30년 모기지)
//   → macro 페이지 + 브리핑 AI 프롬프트에서 활용 가능
const FRED_SERIES = {
  'BAMLH0A0HYM2': { name: 'HY Spread', el: 'hy-live-val', unit: 'bp' }, // multiplier 제거 (사문화 필드)
  'T10Y2Y':       { name: '10Y-2Y Spread', el: null, unit: '%' },
  'T10Y3M':       { name: '10Y-3M Spread', el: null, unit: '%' },
  'DGS2':         { name: '2Y Treasury', el: null, unit: '%' },
  'DGS10':        { name: '10Y Treasury', el: null, unit: '%' },
  'DGS30':        { name: '30Y Treasury', el: null, unit: '%' },
  'DTWEXBGS':     { name: 'Trade Weighted USD', el: null, unit: '' },
  'VIXCLS':       { name: 'VIX Close', el: null, unit: '' },
  'ICSA':         { name: 'Initial Claims', el: null, unit: 'K', multiplier: 0.001 },
  'UNRATE':       { name: 'Unemployment Rate', el: null, unit: '%' },
  'CPIAUCSL':     { name: 'CPI', el: null, unit: '' },
  'FEDFUNDS':     { name: 'Fed Funds Rate', el: null, unit: '%' },
  // v47.11 신규
  'DFEDTARU':     { name: 'Fed Funds Target Upper', el: null, unit: '%' },
  'PAYEMS':       { name: 'Nonfarm Payrolls', el: null, unit: 'K' },
  'M2SL':         { name: 'M2 Money Supply', el: null, unit: 'B USD' },
  'DCOILWTICO':   { name: 'WTI Crude Oil', el: null, unit: 'USD/bbl' },
  'MORTGAGE30US': { name: '30Y Mortgage Rate', el: null, unit: '%' },
  // v48.59: 추가 data-snap 자동화 대상 FRED 시리즈
  'FEDFUNDS':     { name: 'Fed Funds Rate', el: null, unit: '%' },         // fed-rate (월평균)
  'UNRATE':       { name: 'Unemployment Rate', el: null, unit: '%' },      // 실업률
  'HOUST':        { name: 'Housing Starts', el: null, unit: 'K units' },   // housing
  'RSAFS':        { name: 'Retail Sales', el: null, unit: 'M USD' },       // retail-sales
  'UMCSENT':      { name: 'Michigan Sentiment', el: null, unit: '' },      // cons-conf
  'CES0500000003':{ name: 'Avg Hourly Earnings', el: null, unit: 'USD' },  // wage-growth
  'PAYEMS':       { name: 'Non-farm Payrolls', el: null, unit: 'K' }       // 고용 (NFP)
};

// v48.59: BOK ECOS API fetcher — 한국은행 기준금리/환율/수출 (무료, 회원가입)
// 통계 코드: 722Y001=기준금리, 036Y002=CPI, 901Y014=GDP, 403Y001=수출, 403Y003=수입
async function fetchBokEcos(statCode, cycle, startDate, endDate, itemCode1) {
  const key = _getApiKey('aio_bok_key') || '';
  if (!key) return null;
  try {
    var base = 'https://ecos.bok.or.kr/api/StatisticSearch';
    var url = base + '/' + key + '/json/kr/1/10/' + statCode + '/' + cycle + '/' + startDate + '/' + endDate + (itemCode1 ? ('/' + itemCode1) : '');
    const r = await fetchWithTimeout(url, {}, 8000);
    if (!r.ok) return null;
    const d = await r.json();
    if (d && d.StatisticSearch && d.StatisticSearch.row) return d.StatisticSearch.row;
    return null;
  } catch(e) { _aioLog('warn', 'fetch', 'BOK ECOS error: ' + e.message); return null; }
}

// v48.59: 한국 거시 지표 일괄 수집 → data-snap 바인딩
async function fetchAllBokData() {
  const key = _getApiKey('aio_bok_key') || '';
  if (!key) { console.log('[AIO] BOK ECOS key not set'); return null; }
  try {
    // 최근 12개월 범위
    const now = new Date();
    const endMonth = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0');
    const startMonth = String(now.getFullYear() - 1) + String(now.getMonth() + 1).padStart(2, '0');
    // 기준금리 (722Y001) — 월 단위
    const rateData = await fetchBokEcos('722Y001', 'M', startMonth, endMonth, '0101000');
    const results = { };
    if (rateData && rateData.length > 0) {
      const latest = rateData[rateData.length - 1];
      const prev = rateData.length > 1 ? rateData[rateData.length - 2] : null;
      results.bokRate = { value: parseFloat(latest.DATA_VALUE), date: latest.TIME, prev: prev ? parseFloat(prev.DATA_VALUE) : null };
    }
    // data-snap 업데이트
    if (results.bokRate) {
      document.querySelectorAll('[data-snap="bok-rate"]').forEach(function(el){
        el.textContent = results.bokRate.value.toFixed(2) + '%';
      });
      const prev = results.bokRate.prev;
      if (prev != null) {
        const delta = results.bokRate.value - prev;
        const status = Math.abs(delta) < 0.01 ? '동결' : (delta > 0 ? '인상' : '인하');
        document.querySelectorAll('[data-snap="bok-status"]').forEach(function(el){
          el.textContent = status;
        });
      }
    }
    window._bokData = results;
    console.log('[AIO v48.59] BOK ECOS loaded:', Object.keys(results).length, 'series');
    return results;
  } catch(e) { _aioLog('warn', 'fetch', 'BOK ECOS batch error: ' + e.message); return null; }
}

// v48.59: KOSIS 통계청 API fetcher — CPI/수출입/실업률 (무료, 회원가입)
async function fetchKosisStat(orgId, tblId, itmId, prdSe) {
  const key = _getApiKey('aio_kosis_key') || '';
  if (!key) return null;
  try {
    // prdSe: M(월)/Q(분기)/A(년)
    const url = 'https://kosis.kr/openapi/Param/statisticsParameterData.do' +
      '?method=getList&apiKey=' + key +
      '&itmId=' + itmId + '&objL1=ALL&format=json' +
      '&jsonVD=Y&prdSe=' + prdSe + '&newEstPrdCnt=3' +
      '&orgId=' + orgId + '&tblId=' + tblId;
    const r = await fetchWithTimeout(url, {}, 8000);
    if (!r.ok) return null;
    return await r.json();
  } catch(e) { _aioLog('warn', 'fetch', 'KOSIS error: ' + e.message); return null; }
}

// v48.59: 한국 통계청 주요 지표 일괄 (CPI · 실업률 · 수출입)
async function fetchAllKosisData() {
  const key = _getApiKey('aio_kosis_key') || '';
  if (!key) { console.log('[AIO] KOSIS key not set'); return null; }
  try {
    // CPI — 통계청 인플레이션 (DT_1J17001, 소비자물가지수)
    const cpiData = await fetchKosisStat('101', 'DT_1J17001', 'T10', 'M');
    const results = {};
    if (cpiData && Array.isArray(cpiData) && cpiData.length > 0) {
      // 최신값 찾기 (PRD_DE 기준 정렬)
      cpiData.sort(function(a, b){ return (a.PRD_DE || '') < (b.PRD_DE || '') ? 1 : -1; });
      const latest = cpiData[0];
      results.krCpi = { value: parseFloat(latest.DT), date: latest.PRD_DE };
      document.querySelectorAll('[data-snap="kr-cpi"]').forEach(function(el){
        el.textContent = results.krCpi.value.toFixed(1);
      });
    }
    window._kosisData = results;
    console.log('[AIO v48.59] KOSIS loaded:', Object.keys(results).length, 'series');
    return results;
  } catch(e) { _aioLog('warn', 'fetch', 'KOSIS batch error: ' + e.message); return null; }
}

async function fetchAllFredData() {
  const key = DATA_APIS.fred.key();
  if (!key) { console.log('[AIO] FRED key not set — using fallback data'); return; }

  const results = {};
  const seriesIds = Object.keys(FRED_SERIES);

  // Fetch in batches of 3 to be nice to FRED
  for (let i = 0; i < seriesIds.length; i += 3) {
    const batch = seriesIds.slice(i, i + 3);
    const promises = batch.map(id => fetchFredSeries(id, 5).then(obs => ({ id, obs })));
    const batchResults = await Promise.allSettled(promises);
    batchResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value.obs && r.value.obs.length > 0) {
        const { id, obs } = r.value;
        const latest = obs[0];
        const prev = obs.length > 1 ? obs[1] : null;
        // v31.8: MacroStore 검증 레이어 경유 (결측치/범위 체크)
        const accepted = MacroStore.set(id, latest.value, prev ? prev.value : null, latest.date);
        if (accepted) {
          results[id] = { value: MacroStore._data[id].value, prevValue: MacroStore._data[id].prevValue, date: latest.date };
        }
      }
    });
    if (i + 3 < seriesIds.length) await new Promise(ok => setTimeout(ok, 300)); // rate limit
  }

  window._fredData = results;
  try { applyFredToUI(results); } catch(e) { _aioLog('warn', 'render', 'applyFredToUI error: ' + e.message); }
  console.log('[AIO v20] FRED data loaded:', Object.keys(results).length, 'series (MacroStore 검증)');
  return results;
}

function applyFredToUI(data) {
  // v31.9: 소스 표시 헬퍼 — FRED 원본 vs Yahoo 실시간 구분
  function _fredSourceLabel(entry) {
    if (!entry) return '';
    if (entry._source && entry._source.startsWith('yahoo-')) {
      return '실시간 (' + new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) + ')';
    }
    return 'FRED ' + (entry.date || '');
  }

  // HY Spread
  if (data['BAMLH0A0HYM2']) {
    const spread = data['BAMLH0A0HYM2'].value;
    const bp = Math.round(spread * 100);
    const el = document.getElementById('hy-live-val');
    if (el) {
      el.textContent = '+' + bp + 'bp';
      el.style.color = bp < 300 ? '#00e5a0' : bp < 450 ? '#ffa31a' : '#ff5b50';
    }
    const sub = document.getElementById('hy-live-date');
    if (sub) sub.textContent = _fredSourceLabel(data['BAMLH0A0HYM2']);
  }

  // v48.59: FRED → data-snap 전수 자동 바인딩 (Phase 16)
  function _updSnap(key, formatter) {
    const nodes = document.querySelectorAll('[data-snap="' + key + '"]');
    if (!nodes.length) return;
    nodes.forEach(function(el) {
      try { el.textContent = formatter(); } catch(_){}
    });
  }
  if (data['FEDFUNDS']) {
    const r = data['FEDFUNDS'].value;
    _updSnap('fed-rate', function(){ return r.toFixed(2) + '%'; });
  }
  if (data['CPIAUCSL']) {
    // 전년 대비 % (CPIAUCSL은 index 값이라 YoY 계산 별도 필요하지만, 간단화: 최신값 표시)
    const cpi = data['CPIAUCSL'];
    if (cpi.prevValue && cpi.prevValue > 0) {
      // 간단 근사: 12개월 YoY는 별도 observation 필요 — 여기선 MoM만
      const mom = ((cpi.value - cpi.prevValue) / cpi.prevValue * 100);
      _updSnap('cpi', function(){ return mom.toFixed(2) + '% MoM'; });
    }
  }
  if (data['UNRATE']) {
    _updSnap('unemploy', function(){ return data['UNRATE'].value.toFixed(1) + '%'; });
  }
  if (data['HOUST']) {
    _updSnap('housing', function(){ return Math.round(data['HOUST'].value) + 'K'; });
  }
  if (data['RSAFS']) {
    const rs = data['RSAFS'];
    if (rs.prevValue && rs.prevValue > 0) {
      const mom = ((rs.value - rs.prevValue) / rs.prevValue * 100);
      _updSnap('retail-sales', function(){ return (mom >= 0 ? '+' : '') + mom.toFixed(2) + '% MoM'; });
    }
  }
  if (data['UMCSENT']) {
    _updSnap('cons-conf', function(){ return data['UMCSENT'].value.toFixed(1); });
  }
  if (data['CES0500000003']) {
    const wg = data['CES0500000003'];
    if (wg.prevValue && wg.prevValue > 0) {
      const mom = ((wg.value - wg.prevValue) / wg.prevValue * 100);
      _updSnap('wage-growth', function(){ return '$' + wg.value.toFixed(2) + ' (' + (mom >= 0 ? '+' : '') + mom.toFixed(2) + '%)'; });
    }
  }

  // 2Y Rate — fix hardcoded value in FX/Bond page
  if (data['DGS2']) {
    const rate2y = data['DGS2'].value;
    window._live2Y = rate2y;
    // Update yield curve if visible
    if (typeof updateFxBondPage === 'function') updateFxBondPage();
  }

  // v31.9: DGS10 Yahoo 실시간 → _live10Y 동기화 (yield curve 계산용)
  if (data['DGS10']) {
    window._live10Y = data['DGS10'].value;
  }
  if (data['DGS30']) {
    window._live30Y = data['DGS30'].value;
  }
  // v31.9: VIXCLS Yahoo 실시간 → 센티먼트 히스토리에 최신값 주입
  if (data['VIXCLS'] && data['VIXCLS']._source && data['VIXCLS']._source.startsWith('yahoo-')) {
    window._liveVIXCLS = data['VIXCLS'].value;
  }

  // 10Y-2Y Spread
  var _spreadEl = document.getElementById('spread-2s10s-val');
  if (data['T10Y2Y']) {
    const spread = data['T10Y2Y'].value;
    if (_spreadEl) {
      _spreadEl.textContent = (spread >= 0 ? '+' : '') + spread.toFixed(2) + '%';
      _spreadEl.style.color = spread < 0 ? '#ff5b50' : '#00e5a0';
      // v31.9: 소스 표시
      const spreadSub = document.getElementById('spread-2s10s-src');
      if (spreadSub) spreadSub.textContent = _fredSourceLabel(data['T10Y2Y']);
    }
  } else if (_spreadEl && _spreadEl.textContent === '—') {
    // v30.13d: FRED 실패 시 Yahoo 수익률 데이터로 폴백 계산
    var _tnxFb = _ldSafe('^TNX','price');
    var _y2Fb = window._live2Y || 4.28;
    if (_tnxFb > 0) {
      var _s2s10 = _tnxFb - _y2Fb;
      _spreadEl.textContent = (_s2s10 >= 0 ? '+' : '') + _s2s10.toFixed(2) + '%';
      _spreadEl.style.color = _s2s10 < 0 ? '#ff5b50' : '#00e5a0';
    }
  }

  // Unemployment, CPI, Fed Funds for macro page
  if (data['FEDFUNDS']) {
    document.querySelectorAll('[data-fred="FEDFUNDS"]').forEach(el => {
      el.textContent = data['FEDFUNDS'].value.toFixed(2) + '%';
    });
  }

  // v35.8: Fed Funds Rate 동적 연결
  if (data['DFEDTARU']) {
    var upper = parseFloat(data['DFEDTARU'].value);
    var lower = upper - 0.25;
    var rateStr = lower.toFixed(2) + '–' + upper.toFixed(2) + '%';
    document.querySelectorAll('[data-snap="fed-rate"]').forEach(function(el) {
      el.textContent = rateStr;
    });
  }

  // v35.8: 2Y 금리 → yc-2y, yc-2y-track 동적 연결
  if (data['DGS2']) {
    var rate2yVal = data['DGS2'].value;
    var yc2yEl = document.getElementById('yc-2y');
    if (yc2yEl) { yc2yEl.textContent = rate2yVal.toFixed(2) + '%'; yc2yEl.style.color = rate2yVal > 4.5 ? '#ff5b50' : rate2yVal > 4.0 ? '#ffa31a' : '#00e5a0'; }
    var yc2yTrack = document.getElementById('yc-2y-track');
    if (yc2yTrack) { yc2yTrack.textContent = rate2yVal.toFixed(2) + '%'; yc2yTrack.style.color = rate2yVal > 4.5 ? '#ff5b50' : rate2yVal > 4.0 ? '#ffa31a' : '#00e5a0'; }
  }

  // v35.8: DXY 1개월 변화율 동적 연결 (Yahoo DX-Y.NYB에서 계산)
  var dxyLive = _ldSafe('DX-Y.NYB', 'price');
  var dxyPrev = _ldSafe('DX-Y.NYB', 'prevClose');
  if (dxyLive > 0) {
    var dxy1mEl = document.getElementById('dxy-1m');
    if (dxy1mEl) {
      // 1개월 변화율은 정확한 30일 전 데이터가 필요하지만, 당일 변화율로 대체 표시
      var dxyDayPct = dxyPrev > 0 ? ((dxyLive - dxyPrev) / dxyPrev * 100) : 0;
      dxy1mEl.textContent = (dxyDayPct >= 0 ? '+' : '') + dxyDayPct.toFixed(1) + '%';
      dxy1mEl.style.color = dxyDayPct > 0.5 ? '#ff5b50' : dxyDayPct < -0.5 ? '#00e5a0' : '#ffa31a';
    }
  }

  // v35.8: Put/Call Ratio → regime-pcr 동적 연결
  if (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT.pcr) {
    var pcrEl = document.getElementById('regime-pcr');
    if (pcrEl) {
      pcrEl.textContent = DATA_SNAPSHOT.pcr.toFixed(2);
      pcrEl.style.color = DATA_SNAPSHOT.pcr > 1.2 ? '#ff5b50' : DATA_SNAPSHOT.pcr > 0.9 ? '#ffa31a' : '#00e5a0';
    }
  }

  // v31.9: FRED 데이터 신선도 요약 콘솔 로그
  const fredSummary = Object.entries(data).map(([id, d]) => {
    const src = d._source ? (d._source.startsWith('yahoo') ? 'Yahoo' : 'FRED') : 'FRED';
    return `  ${id}: ${typeof d.value === 'number' ? d.value.toFixed(2) : d.value} (${src} ${d.date})`;
  }).join('\n');
  if (Object.keys(data).length > 0) {
    console.log('[AIO v31.9] FRED/Yahoo 통합 데이터 현황:\n' + fredSummary);
  }
}

// v46.6: FRED 경제지표 시계열 차트 (실업률/CPI/기준금리)
var _fredChartInstances = {};
async function _renderFredCharts() {
  var statusEl = document.getElementById('fred-chart-status');
  var fredKey = (typeof DATA_APIS !== 'undefined' && DATA_APIS.fred) ? DATA_APIS.fred.key() : '';
  if (!fredKey) {
    if (statusEl) statusEl.textContent = 'FRED API 키 미설정';
    var grid = document.getElementById('fred-charts-grid');
    if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-muted);font-size:10px;">설정에서 FRED API 키를 등록하면 12개월 경제지표 시계열 차트를 표시합니다.<br><span style="font-size:8px;color:var(--accent);">fred.stlouisfed.org → My Account → API Keys (무료)</span></div>';
    return;
  }
  if (statusEl) statusEl.textContent = '데이터 수집 중...';
  var series = [
    { id: 'UNRATE', canvas: 'fred-unrate-chart', color: '#ff5b50', label: '실업률 (%)' },
    { id: 'CPIAUCSL', canvas: 'fred-cpi-chart', color: '#ffa31a', label: 'CPI (지수)', transform: 'yoy' },
    { id: 'FEDFUNDS', canvas: 'fred-fedfunds-chart', color: '#00d4ff', label: '기준금리 (%)' }
  ];
  for (var si = 0; si < series.length; si++) {
    var s = series[si];
    try {
      var obs = await fetchFredSeries(s.id, 13);
      if (!obs || obs.length < 3) continue;
      obs = obs.reverse(); // 오래된 순
      var labels = obs.map(function(o) { return o.date.slice(5); }); // MM-DD
      var isoDates = obs.map(function(o) { return o.date; }); // YYYY-MM-DD (LWC time)
      var values = obs.map(function(o) { return parseFloat(o.value) || 0; });
      // CPI는 YoY% 변환 (전년 동월 대비)
      if (s.transform === 'yoy' && values.length >= 13) {
        var yoyVals = [];
        for (var yi = 12; yi < values.length; yi++) {
          yoyVals.push(values[yi - 12] > 0 ? ((values[yi] - values[yi - 12]) / values[yi - 12] * 100) : 0);
        }
        values = yoyVals;
        labels = labels.slice(12);
        isoDates = isoDates.slice(12);
      }
      var canvas = document.getElementById(s.canvas);
      if (!canvas) continue;
      if (_fredChartInstances[s.id]) { try { _fredChartInstances[s.id].destroy(); } catch(_){} }

      // v48.25 (P3-5 Phase 3): lightweight-charts 경로 시도
      var _lwcOk = false;
      if (window.AIO && window.AIO.charts && window.AIO.charts.shouldUseLWC()) {
        try {
          var container = window.AIO.charts.wrapCanvas(canvas, 120);
          if (container) {
            var lwcData = isoDates.map(function(d, i) { return { time: d, value: values[i] }; });
            var precision = (s.id === 'CPIAUCSL') ? 2 : 2;
            var minMove = 0.01;
            var lwcResult = window.AIO.charts.createLineChart(container, lwcData, {
              color: s.color,
              lineWidth: 2,
              height: 120,
              priceFormat: { type: 'price', precision: precision, minMove: minMove }
            });
            if (lwcResult && lwcResult.series) {
              _fredChartInstances[s.id] = window.AIO.charts.createCompatWrapper(lwcResult, canvas, container);
              if (typeof _aioLog === 'function') _aioLog('info', 'chart', 'FRED ' + s.id + ' chart: lightweight-charts 경로 사용');
              _lwcOk = true;
            }
          }
        } catch(e2) {
          if (typeof _aioLog === 'function') _aioLog('warn', 'chart', 'LWC FRED ' + s.id + ' 전환 실패, Chart.js 폴백: ' + (e2 && e2.message || e2));
        }
      }

      // Chart.js 경로 (폴백 or LWC 미지원)
      if (!_lwcOk) {
        if (typeof Chart === 'undefined') continue;
        _fredChartInstances[s.id] = new Chart(canvas, {
          type: 'line',
          data: {
            labels: labels,
            datasets: [{ label: s.label, data: values, borderColor: s.color, backgroundColor: s.color + '18', borderWidth: 2, pointRadius: 2, fill: true, tension: 0.3 }]
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0b4c8', font: { size: 11 } } }, x: { grid: { display: false }, ticks: { color: '#a0b4c8', font: { size: 11 }, maxTicksLimit: 6 } } },
            plugins: { legend: { display: false } }
          }
        });
      }
    } catch(e) { _aioLog('warn', 'chart', 'FRED chart error: ' + s.id + ' ' + e.message); }
  }
  if (statusEl) statusEl.textContent = '갱신: ' + new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
}

// ═══ 6. Finnhub — 실시간 뉴스 & 기업 뉴스 ═══════════════════
async function fetchFinnhubNews(category = 'general') {
  const key = DATA_APIS.finnhub.key();
  if (!key) return [];
  try {
    const url = `${DATA_APIS.finnhub.base}/news?category=${category}&token=${key}`;
    const r = await fetchWithTimeout(url, {}, 6000);
    if (r.ok) {
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    }
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub news error: ' + (e.message || String(e))); }
  return [];
}

// v47.10: fetchFinnhubCompanyNews 제거 — 정의만 있고 호출 0건 (dead code P112)
// v48.13: 재도입 — 기업 분석 페이지에서 '최근 기업 뉴스' 섹션에 활용 (Finnhub 무료 60/min)
//         headline/datetime/source/url 수집 → _renderFundNews UI + AI 프롬프트 근거
async function fetchFinnhubCompanyNews(symbol, daysBack) {
  var key = DATA_APIS.finnhub.key();
  if (!key) return [];
  daysBack = daysBack || 14;
  try {
    var to = new Date().toISOString().slice(0,10);
    var from = new Date(Date.now() - daysBack * 86400000).toISOString().slice(0,10);
    var url = DATA_APIS.finnhub.base + '/company-news?symbol=' + encodeURIComponent(symbol) + '&from=' + from + '&to=' + to + '&token=' + key;
    var r = await fetchWithTimeout(url, {}, 6000);
    if (!r.ok) return [];
    var d = await r.json();
    if (!Array.isArray(d)) return [];
    // 최신순 정렬 + 중복 제거(headline 기준) + 상위 15건
    var seen = {};
    var items = d.filter(function(n){ if (!n || !n.headline || seen[n.headline]) return false; seen[n.headline] = 1; return true; });
    items.sort(function(a,b){ return (b.datetime||0) - (a.datetime||0); });
    return items.slice(0, 15).map(function(n){
      return {
        headline: n.headline || '',
        summary: (n.summary || '').replace(/\s+/g,' ').trim(),
        url: n.url || '',
        source: n.source || 'Finnhub',
        datetime: n.datetime || 0,
        date: n.datetime ? new Date(n.datetime * 1000).toISOString().slice(0,10) : '',
        image: n.image || null
      };
    });
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub company-news error: ' + e.message); return []; }
}

// v48.0: Finnhub 무료 티어 확장 활용 — /stock/metric (PE/PB/ROE/52W 통합), /stock/recommendation (애널리스트), /calendar/earnings
// FMP 유료 키 없는 사용자에게도 유사 품질의 밸류에이션 제공. 무료 60/min.
async function fetchFinnhubMetrics(symbol) {
  const key = DATA_APIS.finnhub.key();
  if (!key) return null;
  try {
    const url = `${DATA_APIS.finnhub.base}/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${key}`;
    const r = await fetchWithTimeout(url, {}, 6000);
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.metric ? d.metric : null;  // {peBasicExclExtraTTM, pb, beta, 52WeekHigh, 52WeekLow, epsTTM, roeTTM, ...}
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub metric error: ' + e.message); return null; }
}
async function fetchFinnhubRecommendation(symbol) {
  const key = DATA_APIS.finnhub.key();
  if (!key) return null;
  try {
    const url = `${DATA_APIS.finnhub.base}/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${key}`;
    const r = await fetchWithTimeout(url, {}, 6000);
    if (!r.ok) return null;
    const arr = await r.json();
    return Array.isArray(arr) && arr.length > 0 ? arr[0] : null;  // {buy, hold, sell, strongBuy, strongSell, period}
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub recommendation error: ' + e.message); return null; }
}
async function fetchFinnhubEarningsCalendar(fromDate, toDate, symbol) {
  const key = DATA_APIS.finnhub.key();
  if (!key) return [];
  try {
    let url = `${DATA_APIS.finnhub.base}/calendar/earnings?from=${fromDate}&to=${toDate}&token=${key}`;
    if (symbol) url += `&symbol=${encodeURIComponent(symbol)}`;
    const r = await fetchWithTimeout(url, {}, 6000);
    if (!r.ok) return [];
    const d = await r.json();
    return d && Array.isArray(d.earningsCalendar) ? d.earningsCalendar : [];
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub earnings calendar error: ' + e.message); return []; }
}

// v48.56: Finnhub IPO 캘린더 — 무료 tier 60 req/min
async function fetchFinnhubIpoCalendar(fromDate, toDate) {
  const key = DATA_APIS.finnhub.key();
  if (!key) return [];
  try {
    const url = `${DATA_APIS.finnhub.base}/calendar/ipo?from=${fromDate}&to=${toDate}&token=${key}`;
    const r = await fetchWithTimeout(url, {}, 6000);
    if (!r.ok) return [];
    const d = await r.json();
    return d && Array.isArray(d.ipoCalendar) ? d.ipoCalendar : [];
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub IPO calendar error: ' + e.message); return []; }
}

// v48.56: Finnhub 경제 이벤트 캘린더 — 리스크 레이더 데이터 소스 (FOMC/CPI/GDP/PMI 등)
async function fetchFinnhubEconomicCalendar(fromDate, toDate) {
  const key = DATA_APIS.finnhub.key();
  if (!key) return [];
  try {
    const url = `${DATA_APIS.finnhub.base}/calendar/economic?from=${fromDate}&to=${toDate}&token=${key}`;
    const r = await fetchWithTimeout(url, {}, 7000);
    if (!r.ok) return [];
    const d = await r.json();
    return d && Array.isArray(d.economicCalendar) ? d.economicCalendar : [];
  } catch(e) { _aioLog('warn', 'fetch', 'Finnhub economic calendar error: ' + e.message); return []; }
}


// ═══ 6b. NewsData.io — CORS 지원 뉴스 API (무료 200건/일) ═══════
async function fetchNewsDataIO(category = 'business') {
  const key = _getApiKey('aio_newsdata_key') || '';
  if (!key) return [];
  // v48.9: 공유 키 쿼터 사전 체크 (200/day 도달 시 스킵)
  if (typeof _isQuotaExceeded === 'function' && _isQuotaExceeded('newsdata')) return [];
  try {
    const url = `https://newsdata.io/api/1/latest?apikey=${key}&category=${category}&language=en&size=10`;
    const r = await fetchWithTimeout(url, {}, 8000);
    if (!r.ok) return [];
    if (typeof _bumpApiCounter === 'function') _bumpApiCounter('newsdata');
    const data = await r.json();
    if (data.status === 'success' && Array.isArray(data.results)) {
      return data.results.map(item => ({
        title: (item.title || '').trim(),
        desc: (item.description || '').trim().slice(0, 280),
        link: item.link || '#',
        pubDate: item.pubDate || '',
        source: item.source_name || 'NewsData.io',
        country: item.country?.[0] || 'us',
        tier: 1,
        flag: '',
        topics: ['macro', 'equity'],
        _api: 'newsdata'
      })).filter(i => i.title.length > 10);
    }
  } catch(e) { _aioLog('warn', 'fetch', 'NewsData.io error: ' + (e.message || String(e))); }
  return [];
}

// ═══ 6c. Finnhub News → 통합 뉴스 포맷 변환 ═══════════════════
async function fetchFinnhubNewsFormatted() {
  const items = await fetchFinnhubNews('general');
  if (!items || !items.length) return [];
  return items.slice(0, 20).map(item => ({
    title: (item.headline || '').trim(),
    desc: (item.summary || '').trim().slice(0, 280),
    link: item.url || '#',
    pubDate: item.datetime ? new Date(item.datetime * 1000).toISOString() : '',
    source: item.source || 'Finnhub',
    country: 'us',
    tier: 1,
    flag: '',
    topics: ['macro', 'equity'],
    _api: 'finnhub'
  })).filter(i => i.title.length > 10);
}

// ═══ 7. 시장 폭 (Breadth) — Yahoo Finance 기반 동적 계산 ═══════
async function fetchBreadthData() {
  // Use SPY component ETFs to approximate breadth
  const breadthSymbols = [
    { sym: 'RSP', name: 'Equal Weight S&P' },    // RSP vs SPY ratio = breadth proxy
    { sym: 'MMFI', name: '50D% Index' },          // % above 50MA
    { sym: 'MMTW', name: '20D% Index' },          // % above 20MA
    { sym: 'MMFD', name: '200D% Index' },         // % above 200MA
  ];

  // Also fetch advance/decline via ETFs
  try {
    // Method 1: Try Alpha Vantage market movers for breadth approximation
    const avKey = DATA_APIS.alphaVantage.key();
    // v48.9: AV 무료 25/day 쿼터 사전 체크
    if (avKey && avKey !== 'demo' && !(typeof _isQuotaExceeded === 'function' && _isQuotaExceeded('alphaVantage'))) {
      const url = `${DATA_APIS.alphaVantage.base}?function=TOP_GAINERS_LOSERS&apikey=${avKey}`;
      const r = await fetchWithTimeout(url, {}, 8000);
      if (r.ok) {
        if (typeof _bumpApiCounter === 'function') _bumpApiCounter('alphaVantage');
        const data = await r.json();
        if (data.top_gainers && data.top_losers) {
          const gainers = data.top_gainers.length;
          const losers = data.top_losers.length;
          const advDecline = gainers / (gainers + losers);
          // Update breadth display
          updateBreadthUI({ advanceRatio: advDecline, gainers, losers, source: 'Alpha Vantage' });
          return;
        }
      }
    }

    // Method 2: Fetch RSP/SPY ratio as breadth proxy
    const rspData = window._liveData?.['RSP'];
    const spyData = window._liveData?.['SPY'];
    if (rspData && spyData) {
      const ratio = rspData.price / spyData.price;
      const rspChg = rspData.pct;
      const spyChg = spyData.pct;
      const breadthSignal = rspChg - spyChg; // positive = broad rally, negative = narrow
      updateBreadthUI({
        rspSpyRatio: ratio,
        breadthSignal,
        spyChg, rspChg,
        source: 'RSP/SPY Ratio'
      });
    }
  } catch(e) {
    _aioLog('warn', 'breadth', 'Breadth data error: ' + (e && e.message || e));
    showDataError('시장폭', '시장 폭 데이터 로딩 실패 — 정적 데이터 사용 중', 'warn');
  }
}

function updateBreadthUI(data) {
  // Update breadth KPI cards
  if (data.advanceRatio !== undefined) {
    const pct = (data.advanceRatio * 100).toFixed(1);
    const el = document.getElementById('breadth-advance-ratio');
    if (el) {
      el.textContent = pct + '%';
      el.style.color = data.advanceRatio > 0.5 ? '#00e5a0' : data.advanceRatio > 0.3 ? '#ffa31a' : '#ff5b50';
    }
  }
  if (data.breadthSignal !== undefined) {
    const el = document.getElementById('breadth-signal-val');
    if (el) {
      const txt = data.breadthSignal > 0.5 ? 'BROAD RALLY' : data.breadthSignal > -0.5 ? 'NEUTRAL' : 'NARROW MARKET';
      el.textContent = txt;
      el.style.color = data.breadthSignal > 0.5 ? '#00e5a0' : data.breadthSignal > -0.5 ? '#ffa31a' : '#ff5b50';
    }
  }
  // Update source badge
  const srcEl = document.getElementById('breadth-source');
  if (srcEl) srcEl.textContent = data.source || 'Live Data';
  console.log('[AIO v20] Breadth updated:', data);
}

// ═══ 8. 센티먼트 차트 실시간 업데이트 ═══════════════════════
async function fetchSentimentHistory() {
  // VIX History from Yahoo Finance
  try {
    const vixUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?interval=1d&range=3mo';
    const r = await fetchViaProxy(vixUrl, 8000);
    let raw;
    try { raw = await r.text(); } catch(e) { raw = ''; }
    // v30.11: HTML 에러페이지 탐지 (유령 차트 방지)
    if (raw.trimStart().startsWith('<!DOCTYPE') || raw.trimStart().startsWith('<html')) {
      _aioLog('warn', 'chart', 'VIX chart: Yahoo returned HTML error page');
      showDataError('VIX차트', 'Yahoo Finance HTML 에러 — 프록시 전환 대기', 'warn');
      return;
    }
    let data;
    try { data = JSON.parse(raw); } catch(e) { data = {}; }
    // Handle allorigins wrapper
    if (data.contents) {
      try { data = JSON.parse(data.contents); } catch(e) {}
      // v30.11: 이중 래핑된 경우도 HTML 체크
      if (typeof data === 'string' && data.trimStart().startsWith('<')) {
        _aioLog('warn', 'chart', 'VIX chart: allorigins returned HTML inside JSON wrapper');
        return;
      }
    }

    // v30.11: 공통 파서 사용
    var parsed = _parseYFChartResponse(data);
    if (parsed && parsed.closes.length >= 3) {
      // v30.11: UTC 기반 날짜 라벨 사용 (타임존 밀림 방지)
      var vixHistory = parsed.labels.map(function(lbl, i) {
        return { date: lbl, value: parsed.closes[i] };
      }).slice(-30); // last 30 days

      window._vixHistory = vixHistory;
      updateSentimentChart('vix', vixHistory);
      console.log('[AIO v20] VIX history loaded:', vixHistory.length, 'days');
    } else {
      _aioLog('warn', 'chart', 'VIX chart: insufficient data points');
      showDataError('VIX차트', '데이터 포인트 부족 — 정적 차트 유지', 'warn');
    }
  } catch(e) {
    _aioLog('warn', 'fetch', 'VIX history fetch failed: ' + e.message);
    showDataError('VIX', 'VIX 히스토리 로딩 실패 — 정적 차트 데이터 사용 중', 'warn');
  }
}

function updateSentimentChart(type, data) {
  if (!window.sentPageCharts) return;
  const chart = window.sentPageCharts[type];
  if (!chart) return;
  try {
    var labels = data.map(d => d.date);
    var values = data.map(d => d.value);
    // v30.11: 차트 업데이트 전 게이트 검증
    var canvasId = type + '-chart'; // 'vix-chart', 'naaim-chart' etc.
    var gated = chartDataGate(canvasId, labels, [values], { chartName: type.toUpperCase(), minPoints: 3 });
    if (!gated) return; // 폴백 UI 표시됨
    chart.data.labels = gated.labels;
    chart.data.datasets[0].data = gated.datasets[0];
    chart.update('none');
  } catch(e) { _aioLog('warn', 'chart', 'Chart update error: ' + (e && e.message || e)); }
}

// ═══ 9. 데이터 갱신 스케줄러 (중앙 관리) ═══════════════════════
// v21: 5명 동시 접속 기준 rate limit 안전 간격
// ────────────────────────────────────────────────────
// API별 한도 분석 (5명 기준):
//   rss2json    : 10,000/일 → 소스50 × 갱신횟수 × 5명 → 45분 간격이면 ~5,300/일 (안전)
//   Finnhub     : 60/분     → 시세 1콜 × 5명 = 5/분 (여유)
//   NewsData.io : 200/일    → 갱신당 1콜 × 5명 → 45분이면 ~160/일 (안전)
//   Twelve Data : 8/분      → 1콜 × 5명 = 5/분 (여유, 단 동시 호출 피해야)
//   FRED        : 120/일    → 2시간 간격 × 5명 = ~60/일 (안전)
//   Claude(번역) : 유료      → 45분 간격이면 일 ~80콜 × 5명 = 비용 감소
//   Yahoo(프록시): 무제한    → 프록시 부하만 주의
//   CoinGecko   : 10~30/분  → 60초 간격 × 5명 = 5/분 (안전)
// ────────────────────────────────────────────────────
const REFRESH_SCHEDULE = {
  quotes:     { fn: null, interval: 180000,     label: '시세 (3분)',       timer: null },
  news:       { fn: null, interval: 2700000,    label: '뉴스 (45분)',      timer: null },
  sentiment:  { fn: null, interval: 600000,     label: '센티먼트 (10분)',   timer: null },
  breadth:    { fn: null, interval: 600000,     label: '시장 폭 (10분)',    timer: null },
  fred:       { fn: null, interval: 7200000,    label: 'FRED (2시간)',     timer: null },
  technicals: { fn: null, interval: 900000,     label: '기술 지표 (15분)',  timer: null },
  vixHistory: { fn: null, interval: 1800000,    label: 'VIX 히스토리 (30분)', timer: null },
  hySpread:   { fn: null, interval: 21600000,   label: 'HY 스프레드 (6시간)', timer: null },
  maUpdate:   { fn: null, interval: 21600000,   label: 'MA 갱신 (6시간)',    timer: null },
  krSupply:   { fn: null, interval: 600000,     label: 'KR 수급 (10분)',     timer: null },
  krDynamic:  { fn: null, interval: 1800000,    label: 'KR 동적 (30분)',     timer: null },
};

// v30.11: Page Visibility API — 백그라운드 탭 타이머 절약
let _schedulerPaused = false;
let _lastVisibleTime = Date.now();

function startDataScheduler() {
  console.log('[AIO v21] ═══ Data Scheduler Starting (5명 동시접속 최적화) ═══');

  // v21: 랜덤 지터 함수 — 각 유저가 약간 다른 시간에 호출하도록
  // interval의 ±15% 범위 내에서 랜덤화
  function jitteredInterval(baseMs) {
    const jitter = baseMs * 0.15; // ±15%
    return baseMs + Math.floor(Math.random() * jitter * 2 - jitter);
  }

  // Assign functions
  REFRESH_SCHEDULE.quotes.fn     = () => { if (typeof fetchLiveQuotes === 'function') fetchLiveQuotes(); };
  REFRESH_SCHEDULE.news.fn       = () => { if (typeof fetchAllNews === 'function') fetchAllNews(false); };
  REFRESH_SCHEDULE.sentiment.fn  = () => {
    if (typeof fetchFearGreed === 'function') fetchFearGreed();
    if (typeof fetchPutCall === 'function') fetchPutCall();
  };
  REFRESH_SCHEDULE.breadth.fn    = fetchBreadthData;
  REFRESH_SCHEDULE.fred.fn       = fetchAllFredData;
  REFRESH_SCHEDULE.technicals.fn = () => fetchTechnicalIndicators('SPY').then(d => { if (d) applyTechIndicators(d); });
  REFRESH_SCHEDULE.vixHistory.fn = fetchSentimentHistory;
  // v30.11: 중앙 스케줄러 편입 (T3, T7 독립 타이머 → 여기로 통합)
  REFRESH_SCHEDULE.hySpread.fn   = () => { if (typeof fetchHYSpread === 'function') fetchHYSpread(); };
  REFRESH_SCHEDULE.maUpdate.fn   = () => { if (typeof autoUpdateMA === 'function') autoUpdateMA(); };
  REFRESH_SCHEDULE.krSupply.fn   = () => { if (typeof fetchKrSupplyData === 'function') fetchKrSupplyData(); };
  REFRESH_SCHEDULE.krDynamic.fn  = () => { if (typeof fetchKrDynamicData === 'function') fetchKrDynamicData(); };

  // v21: 지터가 적용된 타이머 시작 (5명이 동시 호출하는 것 방지)
  Object.entries(REFRESH_SCHEDULE).forEach(([key, cfg]) => {
    if (cfg.fn && cfg.interval > 0) {
      // 첫 실행도 랜덤 딜레이 후 시작 (0~30초)
      const initialDelay = Math.floor(Math.random() * 30000);
      setTimeout(() => {
        // setInterval 대신 재귀 setTimeout으로 매번 지터 적용
        function scheduleNext() {
          const nextInterval = jitteredInterval(cfg.interval);
          cfg.timer = setTimeout(async () => {
            try { await cfg.fn(); }
            catch(e) { showDataError(cfg.label, '자동 갱신 실패 — 다음 주기에 재시도', 'warn'); }
            scheduleNext();
          }, nextInterval);
        }
        scheduleNext();
      }, initialDelay);
      console.log(`  ✓ ${cfg.label} — ~${Math.round(cfg.interval / 1000)}s (±15% jitter, 시작 +${Math.round(initialDelay/1000)}s)`);
    }
  });

  // Update status display
  updateDataStatus();
  if (window._dataStatusInterval) clearInterval(window._dataStatusInterval);
  window._dataStatusInterval = setInterval(updateDataStatus, T.COOLDOWN);

  console.log('[AIO v20] ═══ All schedulers active ═══');
}

// v30.11: 스케줄러 재시작 함수 (Page Visibility 복귀용)
function restartScheduler() {
  Object.entries(REFRESH_SCHEDULE).forEach(([key, cfg]) => {
    if (cfg.fn && cfg.interval > 0 && !cfg.timer) {
      function jit(base) { var j = base * 0.15; return base + Math.floor(Math.random() * j * 2 - j); }
      function scheduleNext() {
        cfg.timer = setTimeout(async () => {
          if (_schedulerPaused) return;
          try { await cfg.fn(); } catch(e) {}
          scheduleNext();
        }, jit(cfg.interval));
      }
      scheduleNext();
    }
  });
}

// v30.11: Page Visibility API — 백그라운드 탭에서 스케줄러 일시정지
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    _schedulerPaused = true;
    _lastVisibleTime = Date.now(); // v46.9: 숨김 시점 기록 → 복귀 시 정확한 elapsed 계산 (P92)
    Object.values(REFRESH_SCHEDULE).forEach(cfg => {
      if (cfg.timer) { clearTimeout(cfg.timer); cfg.timer = null; }
    });
    if (window._dataStatusInterval) { clearInterval(window._dataStatusInterval); window._dataStatusInterval = null; }
    console.log('[AIO] Tab hidden — scheduler paused');
  } else {
    _schedulerPaused = false;
    const elapsed = Date.now() - _lastVisibleTime;
    // stale 데이터만 즉시 갱신
    Object.entries(REFRESH_SCHEDULE).forEach(([key, cfg]) => {
      if (cfg.fn && elapsed >= cfg.interval) {
        try { cfg.fn(); } catch(e) {}
      }
    });
    restartScheduler();
    if (!window._dataStatusInterval) window._dataStatusInterval = setInterval(updateDataStatus, T.COOLDOWN);
    _lastVisibleTime = Date.now();
    console.log('[AIO] Tab visible — scheduler resumed (elapsed ' + Math.round(elapsed/1000) + 's)');
  }
});

function updateDataStatusError(status, msg) {
  var panel = document.getElementById('data-status-panel');
  if (!panel) return;
  var colors = {ok:'#00e5a0', warn:'#ffa31a', error:'#ef4444'};
  panel.style.color = colors[status] || '#a5b0c2';
  panel.innerHTML = (status === 'ok' ? '<span class="sd sd-g"></span>' : status === 'warn' ? '<span class="sd sd-y"></span>' : '<span class="sd sd-r"></span>') + ' ' + escHtml(msg);
}

function updateDataStatus() {
  const el = document.getElementById('data-status-panel');
  if (!el) return;
  const now = Date.now();
  // v38.3: stale 감지 — 마지막 시세 갱신이 10분 이상 경과하면 경고
  const lastQuoteTs = window._quoteTimestamps ? Math.max(0, ...Object.values(window._quoteTimestamps)) : 0;
  const staleMin = lastQuoteTs > 0 ? Math.floor((now - lastQuoteTs) / 60000) : -1;
  if (staleMin > 10) {
    el.innerHTML = `<span style="font-size:11px;color:#fbbf24;font-weight:700;">시세 ${staleMin}분 전 갱신</span>`;
    el.title = `마지막 시세 갱신: ${new Date(lastQuoteTs).toLocaleTimeString('ko-KR')} — ${staleMin}분 경과`;
  } else if (staleMin >= 0) {
    const t = new Date(lastQuoteTs).toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
    el.innerHTML = `<span style="font-size:11px;color:var(--text-muted);">시세 ${t} 갱신</span>`;
    el.title = '정상 갱신 중';
  } else {
    el.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">데이터 갱신 중...</span>';
  }
}

// Apply technical indicators to UI
function applyTechIndicators(data) {
  if (!data) return;
  try {
    // RSI
    if (data.rsi?.values?.[0]) {
      const rsi = parseFloat(data.rsi.values[0].rsi);
      const el = document.getElementById('tech-rsi-val');
      if (el) {
        el.textContent = rsi.toFixed(1);
        el.style.color = rsi > 70 ? '#ff5b50' : rsi < 30 ? '#00e5a0' : 'var(--text-primary)';
      }
    }
    // MACD
    if (data.macd?.values?.[0]) {
      const macd = parseFloat(data.macd.values[0].macd);
      const el = document.getElementById('tech-macd-val');
      if (el) {
        el.textContent = macd.toFixed(2);
        el.style.color = macd > 0 ? '#00e5a0' : '#ff5b50';
      }
    }
    // Stochastic
    if (data.stoch?.values?.[0]) {
      const k = parseFloat(data.stoch.values[0].slow_k);
      const el = document.getElementById('tech-stoch-val');
      if (el) {
        el.textContent = k.toFixed(1);
        el.style.color = k > 80 ? '#ff5b50' : k < 20 ? '#00e5a0' : 'var(--text-primary)';
      }
    }
    // ADX
    if (data.adx?.values?.[0]) {
      const adx = parseFloat(data.adx.values[0].adx);
      const el = document.getElementById('tech-adx-val');
      if (el) {
        el.textContent = adx.toFixed(1);
        el.style.color = adx > 25 ? '#00e5a0' : '#ffa31a';
      }
    }
    console.log('[AIO v20] Technical indicators applied');
  } catch(e) { _aioLog('warn', 'render', 'Tech indicator apply error: ' + (e && e.message || e)); }
}

// ═══ 10. 초기화 (마스터 부팅 시퀀스) ═══════════════════════════
async function initV20DataEngine() {
  console.log('[AIO v20] ═══════════════════════════════════════');
  console.log('[AIO v20] Data Engine v20 초기화 시작');
  console.log('[AIO v20] ═══════════════════════════════════════');

  // Phase 1: Immediate (0-2s) — Show cached/fallback data
  if (typeof applyStaticFallbacks === 'function') applyStaticFallbacks();

  // Phase 2: Fast APIs (2-5s) — CoinGecko, Exchange Rate
  setTimeout(async () => {
    try { if (typeof fetchLiveQuotes === 'function') await fetchLiveQuotes(); }
    catch(e) { showDataError('시세', '실시간 시세 로딩 실패 — 정적 데이터 사용 중', 'warn'); if(typeof _reportApiError==='function') _reportApiError('yahoo-quote','Phase2 실패'); }
  }, 500);

  // Phase 3: Sentiment APIs (3-8s)
  setTimeout(async () => {
    try {
      if (typeof fetchFearGreed === 'function') await fetchFearGreed();
      if (typeof fetchPutCall === 'function') await fetchPutCall();
      if(typeof _reportApiOk==='function') _reportApiOk('fear-greed','Phase3 성공');
      if(typeof window._markFetch==='function') { window._markFetch('sentiment'); window._markFetch('fearGreed'); window._markFetch('putCall'); }
    } catch(e) { showDataError('심리지표', '공포탐욕/풋콜 로딩 실패 — 정적 데이터 사용 중', 'warn'); if(typeof _reportApiError==='function') _reportApiError('fear-greed','Phase3 실패'); }
  }, 3000);

  // Phase 4: Heavy APIs (5-15s) — FRED, Breadth, News
  setTimeout(async () => {
    try { await fetchAllFredData(); if(typeof _reportApiOk==='function') _reportApiOk('fred','FRED 로딩 성공'); if(typeof window._markFetch==='function') window._markFetch('fred'); }
    catch(e) { showDataError('FRED', 'FRED 매크로 데이터 로딩 실패', 'warn'); if(typeof _reportApiError==='function') _reportApiError('fred','FRED 실패'); }
    try { await fetchBreadthData(); if(typeof window._markFetch==='function') window._markFetch('breadth'); }
    catch(e) { showDataError('시장폭', 'Breadth 데이터 로딩 실패', 'warn'); }
    try { await fetchSentimentHistory(); if(typeof _reportApiOk==='function') _reportApiOk('yahoo-chart','VIX 차트 성공'); if(typeof window._markFetch==='function') window._markFetch('vixHistory'); }
    catch(e) { showDataError('VIX', 'VIX 히스토리 로딩 실패', 'warn'); if(typeof _reportApiError==='function') _reportApiError('yahoo-chart','VIX 차트 실패'); }
  }, 5000);

  // Phase 5: News & Content (8-20s)
  setTimeout(async () => {
    try { if (typeof fetchAllNews === 'function') await fetchAllNews(false); if(typeof _reportApiOk==='function') _reportApiOk('rss-news','뉴스 로딩 성공'); if(typeof window._markFetch==='function') window._markFetch('news'); }
    catch(e) { showDataError('뉴스', '뉴스 피드 로딩 실패', 'warn'); if(typeof _reportApiError==='function') _reportApiError('rss-news','뉴스 실패'); }
  }, 8000);

  // Phase 6: WebSocket (if key available)
  setTimeout(() => { initFinnhubWebSocket(); }, 2000);

  // Phase 7: Start recurring scheduler
  setTimeout(() => { startDataScheduler(); }, 15000);

  // Phase 8: Data Health report (after all phases settle)
  setTimeout(() => {
    if (window.DataHealth) {
      console.log('[AIO] ═══ Data Pipeline Health Report ═══');
      DataHealth.log();
    }
  }, 20000);

  // Log API key status
  const keyStatus = API_KEY_CONFIG.map(k => {
    const val = localStorage.getItem(k.id);
    return `  ${k.label}: ${val ? '✓ 설정됨' : ' 미설정'}`;
  }).join('\n');
  console.log('[AIO v20] API Key Status:\n' + keyStatus);
}

const AIO_NEWS_SOURCES = [
  // ═══════════════════════════════════════════════════════════════════
  // v31.8: 미국 시장 중점 — 주요 외신 대폭 확장 (US 40+ 소스)
  // ═══════════════════════════════════════════════════════════════════

  // ═══ TIER 1: 🇺🇸 미국 주요 외신 (탑티어 — 최우선 노출) ═══
  {name:'Reuters Markets',     url:'https://feeds.reuters.com/reuters/businessNews',              country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'CNBC Top News',       url:'https://search.cnbc.com/rs/search/combinedcombined?partnerId=wrss&id=100003114', country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'CNBC Investing',      url:'https://search.cnbc.com/rs/search/combinedcombined?partnerId=wrss&id=15839069', country:'us', tier:1, flag:'US', topics:['equity','earnings']},
  {name:'CNBC Economy',        url:'https://search.cnbc.com/rs/search/combinedcombined?partnerId=wrss&id=20910258', country:'us', tier:1, flag:'US', topics:['macro']},
  {name:'WSJ Markets',         url:'https://feeds.a.dj.com/rss/RSSMarketsMain.xml',              country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'WSJ World',           url:'https://feeds.a.dj.com/rss/RSSWorldNews.xml',                country:'us', tier:1, flag:'US', topics:['geo','macro']},
  {name:'Bloomberg',           url:'https://feeds.bloomberg.com/markets/news.rss',                country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'MarketWatch',         url:'https://feeds.content.dowjones.io/public/rss/mw_realtimeheadlines', country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'Barrons',             url:'https://www.barrons.com/feeds/articles/techtopstories.rss',   country:'us', tier:1, flag:'US', topics:['equity']},
  {name:'Yahoo Finance',       url:'https://finance.yahoo.com/news/rssindex',                    country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'Seeking Alpha',       url:'https://seekingalpha.com/market_currents.xml',                country:'us', tier:1, flag:'--', topics:['equity','earnings']},
  {name:'Investing.com',       url:'https://www.investing.com/rss/news.rss',                     country:'us', tier:1, flag:'--', topics:['macro','equity']},
  {name:'Benzinga Markets',    url:'https://www.benzinga.com/feed',                              country:'us', tier:1, flag:'US', topics:['equity','earnings']},
  {name:'S&P Global',          url:'https://www.spglobal.com/marketintelligence/en/rss-feed/all', country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'Nasdaq News',         url:'https://www.nasdaq.com/feed/rssoutbound?category=Markets',   country:'us', tier:1, flag:'US', topics:['equity','earnings']},
  {name:'Nasdaq Analyst',      url:'https://www.nasdaq.com/feed/rssoutbound?category=Analyst+Activity', country:'us', tier:1, flag:'US', topics:['analyst','equity']},
  {name:'CNN Business',        url:'https://rss.cnn.com/rss/money_latest.rss',                    country:'us', tier:1, flag:'US', topics:['macro','equity']},
  {name:'NYT Business',        url:'https://rss.nytimes.com/services/xml/rss/nyt/Business.xml',   country:'us', tier:1, flag:'US', topics:['macro']},
  {name:'FT Markets',          url:'https://www.ft.com/markets?format=rss',                      country:'eu', tier:1, flag:'UK', topics:['macro','equity']},
  {name:'BBC Business',        url:'https://feeds.bbci.co.uk/news/business/rss.xml',              country:'eu', tier:1, flag:'UK', topics:['macro']},
  {name:'The Economist Finance',url:'https://www.economist.com/finance-and-economics/rss.xml',    country:'eu', tier:1, flag:'UK', topics:['macro']},
  {name:'Google News Finance',  url:'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtVnVHZ0pWVXlnQVAB?hl=en-US&gl=US&ceid=US:en', country:'us', tier:1, flag:'US', topics:['macro','equity']},
  // v42.9: Axios 추가 — 미국 정치·외교·정책 속보에 강한 주류 매체 (소식통 인용 비중 높아 isUnverifiedClaim 배지 자동 적용)
  {name:'Axios',               url:'https://api.axios.com/feed/',                                  country:'us', tier:1, flag:'US', topics:['macro','geo','policy']},
  // v48.16 (integrate 2026-04-18): Washington Post — 미국 주·연방 정책(DC 규제, 에너지 정책) 보강
  {name:'Washington Post Politics', url:'https://feeds.washingtonpost.com/rss/politics',             country:'us', tier:1, flag:'US', topics:['macro','policy','geo']},
  {name:'Washington Post Business', url:'https://feeds.washingtonpost.com/rss/business',             country:'us', tier:1, flag:'US', topics:['macro','equity']},

  // ═══ TIER 1: 텔레그램 큐레이션 채널 ═══
  {name:'TG Insider Tracking',       url:'https://rsshub.app/telegram/channel/insidertracking',       country:'us', tier:1, flag:'TG', topics:['macro','equity','semi','earnings'], type:'telegram', tgSlug:'insidertracking'},
  {name:'TG BornLupin',              url:'https://rsshub.app/telegram/channel/bornlupin',             country:'us', tier:1, flag:'TG', topics:['macro','equity','semi','earnings'], type:'telegram', tgSlug:'bornlupin'},
  {name:'TG WalterBloomberg',       url:'https://rsshub.app/telegram/channel/walterbloomberg',       country:'us', tier:1, flag:'TG', topics:['macro','equity','earnings'],        type:'telegram', tgSlug:'walterbloomberg'},
  {name:'TG Aether Japan Research',  url:'https://rsshub.app/telegram/channel/aetherjapanresearch',   country:'jp', tier:1, flag:'TG', topics:['macro','equity','semi','geo'],      type:'telegram', tgSlug:'aetherjapanresearch'},
  // v37.2: 속보·지정학·매크로 텔레그램 채널 추가 (v39.0: FirstSquawk/FinancialJuice 공개 미리보기 비활성 — 코드에서 자동 스킵)
  {name:'TG FirstSquawk',           url:'https://rsshub.app/telegram/channel/firstsquawk',           country:'us', tier:1, flag:'TG', topics:['macro','geo','energy','defense'],  type:'telegram', tgSlug:'firstsquawk'},
  {name:'TG FinancialJuice',        url:'https://rsshub.app/telegram/channel/financialjuicechannel', country:'us', tier:1, flag:'TG', topics:['macro','geo','energy'],            type:'telegram', tgSlug:'financialjuicechannel'},

  // ═══ TIER 2: 🇺🇸 미국 투자/분석 전문 ═══
  {name:'Forbes Business',     url:'https://www.forbes.com/business/feed/',                       country:'us', tier:2, flag:'US', topics:['equity','macro']},
  {name:'Business Insider',    url:'https://markets.businessinsider.com/rss/news',                country:'us', tier:2, flag:'US', topics:['equity','macro']},
  {name:'Morningstar',         url:'https://www.morningstar.com/feeds/rss',                       country:'us', tier:2, flag:'US', topics:['equity','earnings']},
  {name:'Zero Hedge',          url:'https://feeds.feedburner.com/zerohedge/feed',                 country:'us', tier:2, flag:'US', topics:['macro']},

  // ═══ TIER 2: 테크·AI 전문 매체 (v37.3 추가) ═══
  {name:'TechCrunch',          url:'https://techcrunch.com/feed/',                                country:'us', tier:2, flag:'', topics:['semi','equity','earnings']},
  {name:'The Verge',           url:'https://www.theverge.com/rss/index.xml',                     country:'us', tier:2, flag:'', topics:['semi','equity']},
  {name:'Ars Technica',        url:'https://feeds.arstechnica.com/arstechnica/index',             country:'us', tier:2, flag:'', topics:['semi']},
  {name:'Wired Business',      url:'https://www.wired.com/feed/category/business/latest/rss',    country:'us', tier:2, flag:'', topics:['semi','equity']},
  {name:'VentureBeat',         url:'https://venturebeat.com/feed/',                               country:'us', tier:2, flag:'', topics:['semi','equity']},
  {name:'The Information',     url:'https://www.theinformation.com/feed',                         country:'us', tier:2, flag:'', topics:['semi','equity']},

  // ═══ TIER 2: 반도체·AI ═══
  {name:'TrendForce',          url:'https://www.trendforce.com/feed/',                            country:'us', tier:2, flag:'', topics:['semi','equity']},
  {name:'Digitimes',           url:'https://www.digitimes.com/rss/rss.xml',                      country:'us', tier:2, flag:'', topics:['semi','equity']},
  {name:'SemiAnalysis',        url:'https://www.semianalysis.com/feed',                           country:'us', tier:2, flag:'', topics:['semi']},
  {name:'Tom\'s Hardware',     url:'https://www.tomshardware.com/feeds/all',                     country:'us', tier:2, flag:'', topics:['semi']},
  {name:'EE Times',            url:'https://www.eetimes.com/feed/',                               country:'us', tier:2, flag:'', topics:['semi']},

  // ═══ TIER 2: 테크/기업 뉴스 전문 (v38.4: 기업 딜/파트너십 커버리지 강화) ═══
  {name:'HPCwire',             url:'https://www.hpcwire.com/feed/',                               country:'us', tier:2, flag:'', topics:['semi','equity']},
  {name:'GeekWire',            url:'https://www.geekwire.com/feed/',                              country:'us', tier:2, flag:'', topics:['equity','semi']},
  {name:'SimpleFlying',        url:'https://simpleflying.com/feed/',                              country:'us', tier:2, flag:'', topics:['equity']},
  {name:'SpaceNews',           url:'https://spacenews.com/feed/',                                 country:'us', tier:2, flag:'--', topics:['equity','defense']},
  {name:'Seeking Alpha News',  url:'https://seekingalpha.com/feed.xml',                           country:'us', tier:2, flag:'--', topics:['equity','earnings','macro']},
  // v38.5: 기업 보도자료·파트너십 뉴스 커버리지 강화
  {name:'PR Newswire Tech',    url:'https://www.prnewswire.com/rss/technology-latest-news/technology-latest-news-list.rss', country:'us', tier:2, flag:'', topics:['semi','equity','earnings']},
  {name:'GlobeNewswire',       url:'https://www.globenewswire.com/RssFeed/subjectcode/42-Partnerships/feedTitle/GlobeNewswire%20-%20Partnerships', country:'us', tier:2, flag:'', topics:['equity','semi']},
  {name:'Semiconductor Eng',   url:'https://semiengineering.com/feed/',                           country:'us', tier:2, flag:'', topics:['semi']},

  // ═══ TIER 2: 에너지·원자재 ═══
  {name:'OilPrice.com',        url:'https://oilprice.com/rss/main',                              country:'us', tier:2, flag:'', topics:['energy']},
  {name:'Rigzone',             url:'https://www.rigzone.com/news/rss/rigzone_latest.aspx',       country:'us', tier:2, flag:'', topics:['energy']},
  {name:'Platts/Commodities',  url:'https://www.spglobal.com/commodityinsights/en/rss-feed/all',  country:'us', tier:2, flag:'', topics:['energy']},
  {name:'Kitco Gold',          url:'https://www.kitco.com/feed/',                                 country:'us', tier:2, flag:'', topics:['energy','macro']},

  // ═══ TIER 2: 크립토 ═══
  {name:'CoinDesk',            url:'https://www.coindesk.com/arc/outboundfeeds/rss/',             country:'us', tier:2, flag:'', topics:['crypto']},
  {name:'The Block',           url:'https://www.theblock.co/rss.xml',                             country:'us', tier:2, flag:'', topics:['crypto']},
  {name:'DL News',             url:'https://www.dlnews.com/rss/',                                 country:'us', tier:2, flag:'', topics:['crypto']},

  // ═══ TIER 2: 지정학·방산 ═══
  {name:'Reuters World',       url:'https://feeds.reuters.com/Reuters/worldNews',                 country:'us', tier:2, flag:'', topics:['geo']},
  {name:'AP Business',         url:'https://rsshub.app/apnews/topics/business',                  country:'us', tier:2, flag:'US', topics:['macro']},
  {name:'Defense One',         url:'https://www.defenseone.com/rss/all/',                         country:'us', tier:2, flag:'', topics:['geo','defense']},
  // v37.2: 중동·지정학 커버리지 보강
  {name:'Al Jazeera English',  url:'https://www.aljazeera.com/xml/rss/all.xml',                  country:'qa', tier:2, flag:'', topics:['geo','macro','energy']},
  {name:'Middle East Eye',     url:'https://www.middleeasteye.net/rss',                          country:'uk', tier:2, flag:'', topics:['geo','energy']},

  // ═══ TIER 2: 아시아 외신 ═══
  {name:'Nikkei Asia',         url:'https://asia.nikkei.com/rss/feed/nar',                        country:'jp', tier:2, flag:'JP', topics:['macro','equity']},
  {name:'SCMP',                url:'https://www.scmp.com/rss/1/feed',                             country:'cn', tier:2, flag:'CN', topics:['macro','geo']},
  {name:'Channel News Asia',   url:'https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml&category=6511', country:'sg', tier:2, flag:'🇸🇬', topics:['macro']},

  // ═══ TIER 1:  한국어 핵심 뉴스 (v34.6: tier 1로 승격 — 한국 시장 강화) ═══
  {name:'연합뉴스 경제',         url:'https://www.yna.co.kr/rss/economy.xml',                      country:'kr', tier:1, flag:'KR', topics:['macro','equity']},
  {name:'한국경제',              url:'https://www.hankyung.com/feed/finance',                       country:'kr', tier:1, flag:'KR', topics:['macro','equity']},
  {name:'매일경제',              url:'https://www.mk.co.kr/rss/40300001/',                         country:'kr', tier:1, flag:'KR', topics:['macro','equity']},

  // ═══ TIER 2:  한국어 뉴스 (보조 — 경제 전문지) ═══
  {name:'구글뉴스 금융',         url:'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx1YlY4U0FtdHZHZ0pMVWlnQVAB?hl=ko&gl=KR&ceid=KR:ko', country:'kr', tier:2, flag:'KR', topics:['macro','equity']},
  {name:'연합인포맥스',           url:'https://news.einfomax.co.kr/rss/S1N35.xml',                  country:'kr', tier:2, flag:'KR', topics:['macro','equity']},
  {name:'조선비즈',              url:'https://biz.chosun.com/rss/finance/',                        country:'kr', tier:2, flag:'KR', topics:['macro','equity']},
  {name:'머니투데이',            url:'https://news.mt.co.kr/rss/finance.xml',                      country:'kr', tier:2, flag:'KR', topics:['macro','equity']},

  // ═══ TIER 3: 유럽 ═══
  {name:'Reuters EU',          url:'https://feeds.reuters.com/reuters/UKBusinessNews/',            country:'eu', tier:3, flag:'EU', topics:['macro','energy']},
  {name:'ECB Press',           url:'https://www.ecb.europa.eu/rss/press.html',                    country:'eu', tier:3, flag:'EU', topics:['macro']},
  {name:'Euronews Business',   url:'https://www.euronews.com/rss?level=tag&name=business',        country:'eu', tier:3, flag:'EU', topics:['macro']},

  // ═══ TIER 3: 매크로·중앙은행 ═══
  {name:'Fed Reserve',         url:'https://www.federalreserve.gov/feeds/press_all.xml',          country:'us', tier:3, flag:'', topics:['macro']},
  {name:'IMF Blog',            url:'https://www.imf.org/en/News/rss?language=eng',                country:'us', tier:3, flag:'', topics:['macro']},
  {name:'World Bank',          url:'https://blogs.worldbank.org/feed',                            country:'us', tier:3, flag:'', topics:['macro']},
  {name:'BIS Speeches',        url:'https://www.bis.org/doclist/cbspeeches.rss',                  country:'eu', tier:3, flag:'', topics:['macro']},

  // ═══ TIER 3: 한국어 보조 ═══
  {name:'서울경제',              url:'https://www.sedaily.com/RSS/Economy',                         country:'kr', tier:3, flag:'KR', topics:['macro']},
  // v38.3: 이데일리·아시아경제 제거 — RSS 피드 전부 사망 확인 (2026-03-29 브라우저 실테스트 완료)
  // 이데일리: edaily_news/stock/economy.xml 전부 홈페이지 리다이렉트
  // 아시아경제: all.xml(연예·스포츠 혼입), economy/stock/finance.xml 전부 404
];

// ── Global HTML escape ─────────────────────────────────────────
function escHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
// ── URL sanitizer (XSS: javascript:/data: protocol block) ─────
function escUrl(url) {
  if (!url || typeof url !== 'string') return '';
  var trimmed = url.trim().toLowerCase();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:') || trimmed.startsWith('vbscript:')) return '';
  return url.replace(/'/g, '%27').replace(/"/g, '%22').replace(/</g, '%3C').replace(/>/g, '%3E');
}
// ── 중요도 키워드 & 티커 ────────────────────────────────────────
// ── 뉴스 스코어링 키워드 ────────────────────────────────────────
// MACRO_KW: 시장 전체에 영향 → 홈 페이지 우선 노출 (+25점)
// v34.9: 지정학적 시나리오 분석 — 특정 국가 참조는 분석 시점의 실제 리스크를 반영합니다. 주기적으로 현행화 필요.
const MACRO_KW = [
  'FOMC','FOMC minutes','Federal Reserve','Fed','rate hike','rate cut','interest rate','pivot',
  'short covering','short squeeze','hedge fund short','prime book leverage',
  'AI Capex','IT budget','CIO survey','seat-based SaaS','AI cannibalization',
  'CPI','PCE','GDP','GDPNow','inflation','deflation','recession','stagflation',
  'tariff','trade war','sanction','export ban','supply chain',
  // ── v37.5: 관세/무역전쟁 키워드 보강 (2025-2026 핵심 이슈)
  'Section 301','reciprocal tariff','retaliatory tariff','countervailing duty',
  'anti-dumping','de minimis','USMCA','trade deficit','trade surplus','customs duty',
  'trade negotiation','trade deal','trade agreement','trade representative','USTR',
  'import duty','export restriction','entity list','blacklist','commerce department',
  '상호관세','보복관세','반덤핑','상계관세','무역적자','무역협상','관세율','수입관세','수출제한',
  '엔티티리스트','무역대표부','통상압력','무역분쟁','무역협정',
  // ── 지정학·전쟁 (2026 지정학적 리스크 모니터링) — v37.2 보강
  'war','attack','missile','invasion','nuclear','conflict','geopolitical',
  'Iran','Hormuz','strait','airstrike','ceasefire','escalation','Middle East',
  'Israel','Lebanon','Hezbollah','CENTCOM','drone','drone strike','blockade',
  'IRGC','proxy war','oil tanker','tanker seizure','shipping lane',
  'Brent','crude oil','oil embargo','energy shock','oil supply',
  'crash','crisis','collapse','default','systemic','contagion',
  'treasury','yield curve','bond market','credit spread','VIX spike',
  'dollar','DXY','yen','yuan','currency','devaluation',
  'earnings season','S&P','Nasdaq','Dow','market breadth','correction',
  'oil price','OPEC','energy crisis','gold','commodities',
  'bank failure','liquidity','margin call','short squeeze',
  // ── 한국어 추가 (이란전쟁·스태그) — v37.2 보강
  '금리','전쟁','경기침체','인플레','관세','수출규제','부양책','긴축',
  '달러','원화','환율','채권','국채','기준금리',
  '이란','호르무즈','원유 급등','스태그플레이션','에너지 위기','유가 충격',
  '이스라엘','레바논','헤즈볼라','봉쇄','공습','드론','유조선','해상봉쇄','해운항로',
  // ── 전쟁/유가 추가 키워드
  'hormuz','호르무즈','demand destruction','수요파괴','refinery','정유','brent','wti-brent','spread',
  '카타르','qatar','lng','force majeure','불가항력','netanyahu','네타냐후','capitulation','항복매도',
  // v39.0: JP모건/SemiAnalysis 프레임워크 키워드
  'fortress iran','supply gap','oil premium','geopolitical premium','barbell strategy',
  'oil supply gap','oil disruption','Bab el-Mandeb','바브엘만데브',
  'net leverage','positioning','tactical positioning','forced buy',
  '요새 이란','공급 공백','유가 프리미엄','바벨 전략','순레버리지','포지셔닝',
  'server price','AI server price','서버 가격','BOM cost',
  // v48.16 (integrate 2026-04-18): Citi 자산배분 + Fed + 데이터센터 규제
  'escalate to de-escalate','고조 후 완화','quality rotation','퀄리티 로테이션',
  'earnings broadening','이익 확산','defensive tilt','디펜시브 전환',
  'bear market checklist','tactical overweight','전술적 비중확대',
  'DC moratorium','data center ban','DC 금지법안','전력망 영향',
  'Maine DC','hyperscale grid','power grid strain','grid connection',
  'Wartsila','34SG engine','onsite power','온사이트 발전',
  'data dependence','데이터 디펜던스','forward guidance 실패',
  '평균물가목표','2% 물가목표','중물가',
  // v39.2: JP모건 유가 시나리오 + 트럼프 국방예산 (2026.04)
  'demand destruction threshold','oil price scenario','gasoline price','K-shaped recovery',
  'quality growth','low volatility','selective re-entry','bear flattener',
  'energy exporter','energy importer','AUD carry','NOK carry',
  'cross-asset correlation','inflation expectations anchored','net energy exporter',
  '수요파괴 임계점','유가 시나리오','가솔린 가격','K자형 경제',
  '퀄리티 성장주','저변동성','선택적 재진입','에너지 수출국',
  'Golden Dome','defense budget','national defense','FY2027 defense',
  'Virginia-class submarine','F-35 procurement','defense spending',
  'weapons production','Indo-Pacific','무기 재고 재건','국방예산','골든 돔',
  // v42.8: Power & Utilities Supercycle 키워드
  'power supercycle','AI power demand','Rate Base','power PPA','transmission grid',
  'onsite power','gas turbine','fuel cell','onsite generation','power purchase agreement',
  '전력 슈퍼사이클','가스터빈','연료전지','송전 병목','전력 PPA','유틸리티 성장',
  '전력 직접계약','Rate Base 확대','전력 인프라','AI 전력',
  // v38.6: 민간신용·소비심리·시장미시구조 (퍼펙트스톰 분석)
  'private credit','사모신용','사모펀드','사모대출','redemption','환매','redemption wave','환매 위기',
  'private credit default','default rate','디폴트율','Apollo','Blackstone credit',
  'consumer sentiment','소비자심리','Michigan sentiment','미시간 소비심리',
  'recession model','recession probability','침체확률','침체 모델',
  'ETF volume','top of book','top-of-book depth','market microstructure','시장미시구조',
  'pension rebalancing','연기금 리밸런싱','hedge unwind','헤지 해소','숏감마 해소',
  'Trump Reversal Index','reversal index','capitulation signal','항복 신호',
  'short gamma','숏감마','dealer gamma','딜러감마',
  // ── v31.8: 채권·금리·통화정책 심화
  'quantitative easing','quantitative tightening','reverse repo','RRP',
  'term premium','real yield','TIPS','breakeven inflation','fed funds',
  'dot plot','jackson hole','minutes','beige book','bank term funding',
  'sovereign debt','fiscal deficit','debt ceiling','government shutdown',
  'investment grade','high yield','junk bond','credit default swap','CDS',
  'BBB downgrade','fallen angel','covenant','leverage loan','CLO',
  // ── v31.8: 외환·글로벌 중앙은행
  'ECB','BOJ','BOE','PBOC','BOK','RBA','SNB','Riksbank',
  'carry trade','currency intervention','forex reserve','capital outflow',
  'dollar index','euro','sterling','swiss franc','emerging market currency',
  'bilateral swap','dedollarization','BRICS currency','petrodollar',
  'won','ringgit','rupee','baht','peso','lira','rand','real',
  // ── v31.8: 경제지표 심화
  'ISM','PMI','services PMI','manufacturing PMI','consumer confidence',
  'retail sales','industrial production','housing starts','building permits',
  'durable goods','factory orders','trade balance','current account',
  'leading indicators','LEI','initial claims','continuing claims','JOLTS',
  'ADP employment','nonfarm payroll','NFP','unemployment rate',
  'capacity utilization','business inventories','wholesale inventories',
  'Michigan sentiment','Conference Board','Philly Fed','Empire State',
  'Chicago PMI','Dallas Fed','Richmond Fed','Kansas City Fed',
  // ── v31.8: 시스템 리스크·금융안정
  'systemic risk','financial stability','bank run','deposit flight',
  'FDIC','bailout','bail-in','too big to fail','stress test',
  'counterparty risk','rehypothecation','shadow banking','money market',
  'commercial real estate','CRE','office vacancy','CMBS',
  'pension fund','sovereign wealth fund','central bank buying',
  // ── v31.8: 지정학 심화
  'Taiwan Strait','South China Sea','AUKUS','NATO expansion',
  'Ukraine','Russia','North Korea','ICBM','hypersonic',
  'Red Sea','Houthi','shipping disruption','Suez','Panama Canal',
  'rare earth','critical minerals','chip war','tech decoupling',
  'friendshoring','nearshoring','reshoring','onshoring',
  'SWIFT','financial sanctions','asset freeze','embargo',
  // ── v31.8: 한국어 매크로 심화
  '통화정책','양적완화','양적긴축','테이퍼링','피봇','금통위',
  '물가','소비자물가','생산자물가','근원물가','기대인플레',
  '고용','실업률','신규고용','비농업고용','고용지표',
  '경상수지','무역수지','수출','수입','무역흑자','무역적자',
  '재정적자','국가부채','부채한도','예산안',
  '한국은행','금융통화위원회','기준금리 인하','기준금리 인상','기준금리 동결',
  '외국인 매도','외국인 매수','외국인 순매수','외국인 순매도',
  '기관 매수','기관 매도','수급','프로그램매매',
  '공매도','대차잔고','신용잔고','반대매매',
  '시스템 리스크','금융안정','예금 인출','뱅크런',
  '대만해협','남중국해','홍해','후티','수에즈','공급망',
  '탈달러화','페트로달러','위안화 결제',
  '희토류','핵심광물','기술패권','디커플링',
  // v40.4: Citi 매크로 싱크탱크 + 미래에셋 쓰리백 (2026.04)
  'GPU rental','GPU rental price','compute rental','GPU shortage','compute shortage',
  'GPU 렌탈','GPU 가격','컴퓨트 부족','컴퓨팅 병목',
  'labor participation','participation rate','경활률','경제활동참가율',
  'AUDUSD','AUD short','belly trade','TIPS long',
  'sector rotation','sector overweight','sector underweight','섹터 로테이션',
  'Hormuz vulnerability','호르무즈 취약','energy import','에너지 수입',
  'neutral downgrade','주식 중립','overweight to neutral',
  // v42.1: GS KOSPI + JPM GDW + 추경 + 나프타 + 반도체 포지셔닝 (2026.04)
  'KOSPI 7000','KOSPI target','KOSPI forward PE','코스피 선행PER','코스피 목표가',
  'ERLI','이익수정선행지표','earnings revision leading',
  '추가경정예산','supplementary budget Korea','Korean fiscal stimulus',
  '나프타 수출 금지','나프타 가격','naphtha export ban','naphtha price surge','naphtha ban',
  '석유화학 불가항력','petrochemical force majeure','석유화학 감산',
  'Tankan','단칸 조사','BOJ April hike','BOJ rate hike April',
  '한국 수출 역대 최대','Korea export record','반도체 수출 급등',
  'Long-only positioning','hedge fund semiconductor','롱온리 반도체',
  'helium supply','헬륨 공급','helium EUV','helium shortage',
  // ── v37.7: AI 투자·전력수요·정책 키워드
  'AI CapEx','hyperscaler CapEx','data center CapEx','cloud CapEx','AI spending',
  'power demand','electricity demand','grid capacity','grid bottleneck','grid congestion',
  'nuclear revival','nuclear renaissance','energy permitting','permitting reform',
  'industrial policy','CHIPS Act','IRA','Inflation Reduction Act','IIJA',
  'AI regulation','AI executive order','EU AI Act','AI governance',
  'Medicare GLP-1','drug pricing','IRA drug negotiation',
  // 한국어
  'AI투자','빅테크설비투자','데이터센터투자','전력수요','전력난','송전망','계통',
  '원전르네상스','에너지허가','산업정책','반도체특별법','K칩스법',
  'AI규제','AI거버넌스',
  // v43.4: AI 기업 성장 마일스톤 — 시장 임팩트 높음 (TECH_KW 중복→+40점 합산)
  'Anthropic','OpenAI','xAI','AI run-rate','run-rate revenue','ARR milestone',
  'enterprise AI adoption','AI enterprise deal','AI contract',
  'GW-scale compute','gigawatt compute','AI compute demand',
  'GPT-6','GPT 6','Sam Altman','Dario Amodei',
  // v44.5: 4개 글 통합 — TFP/생산성/H4L/자본조달/SPY200MA (2026.04.08)
  'total factor productivity','TFP growth','productivity gap','AI productivity gap',
  'unit labor cost','labor productivity growth','productivity expectation',
  'higher for longer','H4L policy','Fed H4L','sticky inflation',
  'Treasury refunding','T-bills maturity','debt refunding','debt rollover 2026',
  'long-term inflation expectation','inflation expectations unanchored',
  'energy cost pass-through','jet fuel inflation','diesel pass-through',
  '생산성 향상','전요소생산성','TFP','단위노동비용','생산성 격차',
  '기대인플레이션 상승','끈적한 물가','고금리 장기화','H4L',
  'capital allocation','cost of capital','equity financing','debt financing',
  'SPY 200-day','SPY 200MA','200-day moving average resistance','S&P 200DMA',
  '이란 휴전 재충전','ceasefire two-week','2주 휴전 리스크',
  // v44.8: DC전력믹스·BTM·AI보안 (2026.04.09)
  'BTM natural gas','BTM generation','behind-meter generation','grid constraint decade',
  'training inference mix','datacenter workload shift','backup power leadtime',
  'diesel genset cost','standby power capacity','prime power bridge',
  'AI vulnerability','zero-day AI','AI security arms race','shadow AI risk',
  '추론DC 입지','DC워크로드 전환','BTM 천연가스','스탠바이전력','AI 취약점',
  // v44.9: Citi 스태그플레이션 플레이북 (2026.04.09)
  'stagflation playbook','stagflation scenario 2026','stagflation equity',
  'net short positioning','short extension phase','de-risking phase',
  'sector dispersion EPS','energy EPS offset','headline EPS intact',
  'commodity exporter hedge','EM commodity hedge','regional equity allocation',
  'Eurostoxx50 positioning','DM xUS positioning','Korea net long risk',
  '스태그플레이션 플레이북','지정학 헤지','순공매도','에너지 EPS 상쇄','섹터 편차',
  '포지셔닝 해소','비중확대 영국','비중축소 일본','라틴아메리카 헤지',
  // v45.0: 시장 브레드쓰 구조 분석 (2026.04.09)
  'bull trap','breadth divergence','market internals','above 50-day','above 200-day',
  '불트랩','이평정배열','브레드쓰 괴리','갭업 돌파','50일선 탈환','브레드쓰 확인',
  // v46.3: FOMC 듀얼리스크 + TGA 메커니즘 + 4월 이벤트 (2026.04.10)
  'FOMC dual risk','dual mandate tension','bidirectional rate signal','rate hike signal',
  'non-housing services sticky','non-shelter services','core services ex-housing',
  'low hiring trap','low hiring vulnerability','hiring pause AI',
  'Kevin Warsh','Warsh confirmation','Fed chair nomination','Warsh hearing',
  'Tillis opposition','Fed chair uncertainty','Fed succession',
  'TGA drawdown','TGA mechanism','Treasury General Account','TGA replenishment',
  'T-bill issuance','reverse repo drain','RRP drain','MMF T-bill',
  'Yellen TGA','Bessent liquidity','Treasury issuance strategy',
  'OBBBA tax cut','withholding tax reduction','fiscal stimulus 2026',
  'buyback blackout','buyback window','corporate buyback resume',
  'tax filing deadline','tax season liquidity','April tax drain',
  'political liquidity','midterm election market','Treasury vs Fed',
  'earnings season April','GS earnings','JPM earnings','TSM earnings',
  'ASML earnings','NFLX earnings','April OPEX',
  'productivity gap inflation','Debt-to-GDP risk','fiscal deficit inflation',
  '워시 청문회','워시 인준','연준 의장 인준','틸리스 반대',
  '비주거 서비스','끈적한 서비스 물가','듀얼 리스크','양방향 금리',
  'TGA 메커니즘','재무부 유동성','역레포 인출','T-bill 발행 전략',
  '바이백 재개','바이백 블랙아웃','세금 시즌 유동성','정치적 유동성',
  '중간선거 시장','재무부 vs 연준','베센트','감세 환류',
  // v46.4: 걸프 인프라 피해 + 이창용 한은 (2026.04.10)
  'Gulf energy infrastructure','Ras Laffan damage','Sitra refinery','East-West pipeline',
  'refinery outage','pipeline attack','energy infrastructure repair','supply shock measurable',
  'Saudi Aramco attack','Khurais attack','Manifa attack','pumping station attack',
  'BOK Lee Chang-yong','supply shock temporary','WGBI inflow','supplementary budget Korea',
  'exchange rate DXY relative','걸프 인프라 피해','라스 라판','시트라 정유소',
  '동서 파이프라인','정유 가동중단','공급 충격 정량화','이창용 총재','WGBI 유입',
  '추경 초과세수','환율 DXY 상대비교',
  // v46.6: 2026 매크로 키워드 확장
  // 일본 금리 정규화
  'BOJ rate hike','BOJ normalization','Ueda','Japanese bond','JGB','30Y JGB',
  'yen carry unwind','Japan rate path','Tankan','BoJ April',
  '일본 금리','우에다','JGB','엔 캐리 청산','일본 국채','일본 금리 정규화',
  // 크립토 규제/제도화
  'spot bitcoin ETF','crypto regulation','SEC crypto framework','MiCA','stablecoin regulation',
  'crypto custody','digital asset','CBDC','digital dollar','digital euro',
  '비트코인 ETF','크립토 규제','스테이블코인 규제','디지털 자산','CBDC',
  // 중간선거/정치 불확실성 (금융 영향)
  'midterm election','midterm market','election uncertainty','political risk premium',
  'government shutdown','debt ceiling','continuing resolution','fiscal cliff',
  '중간선거 시장','정치 불확실성','정부 셧다운','부채 한도','재정절벽',
  // ESG/기후 금융
  'carbon pricing','carbon border','CBAM','climate risk','green bond','transition finance',
  'net zero','carbon credit market','emissions trading',
  '탄소가격','탄소국경조정','녹색채권','기후리스크','탄소배출권',
  // 생산성/AI 경제 영향
  'AI productivity','TFP','total factor productivity','AI GDP impact','automation displacement',
  'AI 생산성','총요소생산성','AI GDP 영향',
  // v46.6: JP모건 뷰 휴전 베타 + 뉴스 브리핑 + Citi SW Shock
  'ceasefire beta','휴전 베타','retracement','되돌림률','안도 랠리','relief rally',
  'Novorossiysk','노보로시스크','Black Sea oil','흑해 원유','oil loading halt',
  'GCC energy infrastructure','걸프 에너지 인프라','통행료 제도','Hormuz toll',
  'manufacturing GDP','제조업 GDP','reshoring','리쇼어링',
  'Hungary election','헝가리 선거','Fidesz','Magyar','HUF','HGB',
  'Kraken Fed account','크라켄 연준 계정','crypto payment','크립토 결제',
  // v46.6: 이란 협상 결렬 + 실질금리 + 사모신용 + SW-Semi 로테이션 (10건 통합)
  'naval blockade','해군 봉쇄','mine clearing','기뢰 제거','Hormuz mine','호르무즈 기뢰',
  'IRGC toll','물동량 정상화','physical supply gap','공급 갭 14M bbl',
  'Iran negotiation failure','이란 협상 결렬','Islamabad talks','이슬라마바드 협상',
  'negative real rate','실질금리 마이너스','real rate zero','실질금리 제로',
  '2nd-round effect','2차 파급효과','wage-price spiral','임금-물가 스파이럴',
  'CDX Financials','private credit CDS','사모신용 CDS','BCRED redemption',
  'BDC stress','사모신용 꼬리 리스크','private credit tail risk',
  'SW Semi rotation','소프트웨어 반도체 로테이션','IGV underperform','IGV 부진',
  'AI budget crowding','AI 예산 크라우딩','non-AI software pressure',
  'Michigan sentiment record','소비자심리 역대최저','S&P consumer divergence',
  'forward PE compression','선행PER 압축','Mag7 underperform','top-10 concentration',
  'Beveridge curve','베버리지 곡선','Inverse-L Phillips','필립스 곡선',
  'wage growth tracker','WGT','임금추적지수','unit labor cost rise',
  // v47.1: PPI 수요파괴 + 기대인플레 탈앵커링 + Mission Accomplished 괴리 + CTA (2026.04.16)
  'margin compression','마진 압축','trade margin squeeze','도매 마진 축소',
  'PPI-to-PCE','PCE pass-through','PCE 패스스루','PPI PCE 전이',
  'intermediate demand','중간재 수요','stage 2 demand','파이프라인 물가',
  'producer margin','생산자 마진','cost absorption','비용 흡수',
  'CTA mechanical buying','CTA 기계적 매수','CTA positioning',
  'positive gamma grip','양의 감마 그립','gamma expiration','감마 만기',
  'inflation expectation de-anchoring','기대인플레 탈앵커링',
  'Michigan 1Y expectation','미시간 1년 기대인플레',
  'headline vs core divergence','헤드라인 근원 괴리',
  'asset class divergence','자산군 괴리','stock-oil-bond divergence',
  'Mission Accomplished','미션 어컴플리시드',
  'energy cost structural','에너지 비용 구조적','post-war energy premium',
  'IEA Birol','비롤','energy security threat',
  'short squeeze software','소프트웨어 숏스퀴즈','software semi rotation',
  // v47.2: 분배 단계 진단 + UW 확장 F&G + RiskBot + ZBT + Pain Trade (2026.04.16)
  'distribution phase','분배 단계','distribution top','topping process','topping pattern',
  'narrow rally','협소 랠리','top-heavy rally','top-decile leadership','상위 5% 주도',
  'breadth failure','브레드쓰 부실','breadth divergence','internal divergence','내부 괴리',
  'Zweig Breadth Thrust','ZBT','ZBT trigger','ZBT absence','ZBT 부재','ZBT 미작동',
  'breadth thrust','NYSE advance decline','AD line ratio','상승하락 비율',
  'lock-out rally','Lockout rally','락아웃 랠리','FOMO buying','FOMO 매수',
  'pain trade','페인 트레이드','short capitulation','숏 항복','short cover capitulation',
  'bear trap resolved','곰덫 해소','short liquidation','숏 청산 완결','net-short flip',
  'Fear Greed 68','F&G 68','UW F&G 68','CNN Fear Greed','Unusual Whales Fear Greed','UW F&G','CNN F&G 47','F&G 47 Neutral','CNN Neutral 47',
  'Premium Trend','Premium Ratio','premium trend 100','call premium dominant','콜 프리미엄 과집중',
  'Insider Sentiment','insider sentiment 0','내부자 매수 전멸','insider buying drought',
  'Safe Haven Demand','safe haven 99','안전자산 수요 최저','stocks vs bonds',
  'Junk Bond Demand','junk bond 45','정크본드 수요','HY spread compression',
  'Fifty Two Week Sentiment','52주 센티먼트','52-week position','52주 위치',
  'Stock Price Strength','Stock Price Breadth','주가 강도','주가 확장성',
  'Put Call ratio 70','put call extreme','옵션 과매수 구간',
  'RiskBot','위험봇','RiskBot STABLE','STABLE regime','안정 레짐',
  'RiskBot WARNING','WARNING regime','경고 레짐','RiskBot DANGER','위험 레짐',
  'SKEW index 139','SKEW index 141','SKEW 141.86','SKEW 고점','tail risk hedge','꼬리위험 헤지','crash protection bid',
  'VVIX 98','VVIX 90','VVIX 90.10','VVIX VIX convexity','VIX of VIX','변동성의 변동성',
  'MOVE index 68','MOVE index 62','MOVE 62.36','MOVE rates volatility','채권 변동성 저점','rates vol floor',
  'VIX9D','9-day VIX','단기 VIX','VIX term structure','VIX 커브','vix slope',
  'VIX contango','VIX backwardation','콘탱고','백워데이션','term structure inversion',
  'SKEW MOVE paradox','SKEW-MOVE divergence','채권 주식 꼬리위험 역설',
  'bond complacency equity protection','채권 안심 주식 보험',
  'market regime diagnosis','시장 레짐 진단','regime signature',
  '2000.01 topping','2007.10 topping','2021.11 topping','분배 단계 3/3','distribution 3/3',
  'Mag7 pullback distribution','Mag7 조정 분배','SPX new high Mag7 lag','지수 신고 Mag7 이탈',
  'retail FOMO capitulation','리테일 FOMO','retail peak sentiment',
  'CAPE 35','CAPE ratio','Shiller CAPE','쉴러 PER','forward PE 21','선행 PER 21',
  'earnings yield bond yield','주식 채권 기대수익 격차',
  'market internals deterioration','시장 내부 악화','internals gap widening',
  'Anna Karenina market','안나 카레니나 시장','unique distribution signature',
];
// TECH_KW: 기술/AI 주요 이벤트 → 섹터 관련 (+15점)
const TECH_KW = [
  'AI chip','H100','H200','Blackwell','Rubin','Rubin Ultra','Feynman','HBM','HBM4','CoWoS',
  'CoPoS','CoWoP','SoIC','COUPE','panel level packaging',
  'TSMC','Samsung foundry','SK Hynix','ASML','EUV',
  'Ironwood','Sunfish','Pumafish','Humufish','Zebrafish','Trainium',
  'Muse Spark','MSL','Meta Superintelligence','Anthropic ARR','agentic commerce',
  'DeepSeek','Gemini','GPT','Llama','Claude','AI model',
  'semiconductor shortage','chip ban','export control',
  // ── 메모리·Micron (2026 MU 어닝 화두)
  'Micron','memory','DRAM','NAND','HBM demand','memory shortage','memory boom',
  'MU earnings','AI memory','data center memory',
  '반도체','파운드리','HBM','AI 가속기','메모리','D램','낸드',
  // ── v31.8: AI/반도체 밸류체인 심화
  'GPU','TPU','NPU','AI accelerator','inference chip','training chip',
  'advanced packaging','chiplet','2nm','3nm','1.4nm','GAA','gate-all-around',
  'wafer','silicon','fab','foundry capacity','utilization rate',
  'NVIDIA','AMD','Intel','Broadcom','Marvell','Qualcomm',
  'high bandwidth memory','DDR5','LPDDR5','CXL','UCIe',
  'AI server','AI infrastructure','data center','hyperscaler',
  'CapEx','AI spending','cloud spending','AI adoption',
  'autonomous driving','robotics','humanoid robot','embodied AI',
  'AI agent','AI assistant','enterprise AI','edge AI',
  'transformer','large language model','LLM','foundation model',
  'AI regulation','AI safety','AI governance',
  // ── v37.6: 2026 핵심 기술 키워드 대폭 확장
  // 반도체 첨단패키징·인터커넥트
  'CPO','co-packaged optics','silicon photonics','optical interconnect',
  // v38.6: 광인터커넥트 심화 (레이저 병목, 변조기, 폼팩터)
  'VCSEL','EML','EML laser','DFB','DFB laser','CW laser',
  'WDM','wavelength division multiplexing','ELSFP','Kyber','Kyber rack',
  'Teralight','POET','optical interposer','InP','InP substrate','indium phosphide',
  'GaAs','gallium arsenide','EAM','MZM','MRM','TFLN','thin film lithium niobate',
  'NVIDIA COUPE','OFC 2026','optical standard','multimode fiber','MMF','single mode fiber','SMF',
  // v39.0f: NVIDIA 광학 제국 + AI 경쟁 구도 (2026.04)
  'Photonic Fabric','Celestial AI','NVLink Fusion','optical scale-up',
  'Ayar Labs','TeraPHY','Lightmatter','Passage','photonic interposer',
  'Scintil Photonics','OCS','optical circuit switch','R300 OCS',
  'MAI-Transcribe','MAI-Voice','MAI-Image','Microsoft AI','Mustafa Suleyman',
  'Maia chip','custom XPU','Structera',
  // v48.16 (integrate 2026-04-18): 신규 프레임워크 키워드
  'MTIA','Meta MTIA','MTIA v450','Arke',                        // Meta 커스텀 실리콘 — AVGO 다년간 파트너십 2029년까지
  'HBF','high bandwidth flash','HBM+HBF','inference memory',     // SanDisk AI 추론 메모리 신 카테고리
  'Glasswing','Project Glasswing','OpenAI TAC','Trust Access',   // Anthropic/OpenAI 보안 파트너 프로그램
  '테라팹','Terafab','머스크 테라팹',                              // Tesla/SpaceX JV 반도체 팹 계획
  'DustPhotonics','ZR optical','x402','Dynamic Workers',         // Credo 광학 수직통합, Cloudflare AI 에이전트 결제
  'Vera Rubin','Rubin CPX','CX9','NVLink Fusion',                // Nvidia 차세대 로드맵 추가 확장
  '네오클라우드','neocloud','frontier lab','Trainium chip',        // CoreWeave/Nebius 프론티어 연구소 인프라
  'LTA','long-term agreement','메모리 LTA',                       // 메모리 장기공급계약 레버리지 역전
  'Cloud Next','Google I/O','Marketing Live','Brandcast',        // Google 2026년 이벤트 캘린더
  'Ask Maps','Personal Intelligence','Search Live',              // Gemini 통합 확장
  // v38.6: DC 전력 심화 (HVDC, 전력 스택, parasitic loss)
  'HVDC','high voltage DC','parasitic energy','parasitic loss',
  'skin effect','thyristor','IGBT','power semiconductor','VRM',
  'rack power','TDP 2300W','Vera Rubin TDP','NVL72','NVL144','600kW rack','1MW rack',
  'PJM','grid interconnection','underground HVDC','Three Mile Island',
  'glass substrate','glass core','glass interposer',
  'CoWoS','CoWoS-L','CoWoS-S','InFO','EMIB','Foveros',
  'BSPDN','backside power delivery','backside power',
  'interposer','RDL','redistribution layer',
  'HBM4','HBM3E','HBM4E','12-Hi','16-Hi',
  // v39.0: GPU 렌탈/네오클라우드/메모리 가격 (SemiAnalysis/Jefferies/메리츠)
  'GPU rental','GPU shortage','compute rental','GPU rental index',
  'neocloud','CoreWeave','Nebius','GPU subletting',
  'DRAM price','NAND price','memory price','fixed price','contract price',
  'long-term agreement','floor price','prepayment','memory supercycle',
  'GPU 렌탈','GPU 부족','컴퓨트 렌탈','네오클라우드',
  '고정가','렌탈 가격','선지급','최소가격','메모리 슈퍼사이클',
  // AI 신패러다임
  'agentic AI','AI agent framework','multi-agent','agent orchestration',
  'reasoning model','chain of thought','test-time compute',
  'on-device AI','AI PC','AI phone','AI at the edge',
  'sovereign AI','national AI','AI sovereignty',
  'world model','video generation','text-to-video','image generation',
  // 컴퓨팅·네트워크
  'custom silicon','custom ASIC','Trainium','Inferentia','MTIA',
  'RISC-V','ARM architecture','Arm Holdings',
  'InfiniBand','NVLink','NVLink 6.0','Ultra Ethernet','UALink','NVLink Fusion',
  'DPU','SmartNIC','network switch','Tomahawk','Jericho',
  // 데이터센터·전력·냉각
  'liquid cooling','immersion cooling','direct-to-chip cooling',
  'data center power','power density','rack density',
  'nuclear data center','SMR data center','AI power demand',
  'UPS','power distribution','busbar','transformer shortage',
  // v40.4: SemiAnalysis 공급망 병목 + 미래에셋 쓰리백 (2026.04)
  'PCB bottleneck','CCL','copper clad laminate','drill bit shortage','multilayer PCB',
  'always-on agent','KAIROS','multi-agent workflow','token consumption','컴퓨팅 과점',
  'GPU spot price','B200 spot','compute oligopoly','infrastructure poverty','인프라 빈곤',
  'test equipment bottleneck','Teradyne','Advantest','테스트 장비',
  'modular data center','behind-the-meter','behind the meter power','EPC contractor',
  'Argan','AGX','Compass Systems','field labor shortage',
  'N3 sold out','TSMC N3','wafer allocation','cleanroom',
  'LSA prepayment','memory floor price','LSA선불금','모듈형 데이터센터',
  // v42.1: NVDA NTC + BofA 메모리슈퍼사이클 + Anthropic (2026.04)
  'neural texture compression','NTC compression','VRAM compression','texture compression',
  'Rubin Ultra','HBM Rubin','memory supercycle 2027','memory supercycle 2028',
  'ERLI','earnings revision leading indicator','이익수정선행지표',
  'helium supply chain','helium semiconductor','헬륨 공급망',
  // v43.1: WSTS 2026년 2월 + Intel 18A + MU LTA 구조개선 (2026.04, JP모건/KeyBanc)
  'WSTS','semiconductor revenue','monthly semiconductor',
  '18A','Panther Lake','Intel 14A','Humu Fish',
  'server CPU','server CPU demand','server CPU price',
  'LTA structure','pricing floor contract','Intel foundry customer',
  'DRAM pricing','NAND pricing','memory contract price',
  // v43.4: Citi 1Q26 + KeyBanc Asia Tour (HBM4/CoWoS/파운드리) + Anthropic/GPT 6.0 (2026.04)
  'EMIB-T','HBM4 qualification','HBM4 yield','HBM4 supply',
  'Lunar Lake','Lunar Lake sales','Lunar Lake revival',
  'analog price hike','analog pricing','analog semiconductor pricing',
  'GPT 6.0','GPT6','GPT-6','GPT6.0',
  'CoWoS supply','CoWoS capacity','CoWoS expansion',
  'Vera CPU','NVIDIA Vera','Vera Rubin CPU',
  'Taiwan ODM AI','Foxconn AI server','Quanta AI','Wistron AI server',
  'agentic AI CPU','agent CPU demand','agentic inference compute',
  'Anthropic ARR','Claude enterprise','Anthropic enterprise','Anthropic revenue',
  'GW-scale TPU','gigawatt TPU','GW TPU','TPU 2027 deployment',
  'Samsung HBM4','SK Hynix HBM4','Micron HBM4',
  // v43.4: TSMC 병목 + EMIB vs CoWoS 패키징 경쟁 + 3.5D 아키텍처 (2026.04, Damnang/JPM GTM)
  'SoIC','SoIC-T','SoIC-W','system on integrated chips',
  'Foveros Direct','hybrid bonding','copper-to-copper bonding','direct bonding',
  'XDSiP','Broadcom XDSiP','3.5D packaging','3.5D architecture',
  'Clearwater Forest','Intel 3.5D',
  'DTCO','design technology co-optimization','design-technology co-optimization',
  'PDK','process design kit','PDK migration','foundry switching cost',
  'tapeout cost','mask set cost','GDSII',
  'bump pitch','25um bump','35um bump','micro bump pitch',
  'OIP','Open Innovation Platform','TSMC OIP',
  'CoPoS','CoWoS-R','CoWoS-S','InFO packaging',
  'EMIB-M','MIM capacitor','power delivery network',
  'TSMC bottleneck','foundry bottleneck','wafer allocation',
  'AI hyperscalers','hyperscaler capex','hyperscaler weight',
  // v43.9: WF AMD Tactical + MS/JPM/Evercore/UBS MRVL-NVDA Partnership (2026.04.01)
  'Turin CPU','Zen 6','EPYC Turin','Diamond Rapids','EPYC share gain',
  'EPYC server CPU','AMD server CPU','server CPU TAM',
  'NVLink Fusion IP','XPU NVLink','NVLink scale-up',
  'CelestialAI EAM','EAM-based photonics','silicon photonics MRVL',
  'Scorpio X','ALAB Scorpio','NVLink switch',
  'AI-RAN 5G','AI-RAN 6G','Cavium baseband',
  'NVSwitch alternative','rack scale-up','heterogeneous compute',
  // v43.9: MS LRCX + Evercore WFE + Memory super-cycle + UBS Rubin Ultra (2026.04.06)
  'WFE forecast','wafer fab equipment','WFE 2026','WFE 2027',
  'memory super-cycle','DRAM super cycle','NAND super cycle',
  'Rubin Ultra 2-die','Rubin 288 rack','CoPoS 2026',
  'DRAM contract price','NAND contract price','memory contract',
  'KV cache memory','KV cache DRAM','agentic DRAM','agentic NAND',
  'MLPerf v6','MLPerf benchmark','CPO teach-in',
  'HBM bit growth','NAND bit growth','memory bit growth',
  'SABRE 3D','SABRE Syndion','etch equipment',
  // v43.9: KeyBanc Asia Tour — DC/서버/패키징 심화 (2026.04.05-06)
  'Zebra Fish','Humu Fish','Mediatek TPU','MTK TPU',
  'Trainium 3A','Trainium 3B','Trainium 4','AWS custom chip',
  'MTIA Arke','MTIA Iris','MTIA Apollo','MTIA Olympia',
  'Maia 300','Microsoft Maia','Maia delay',
  'FOCoS','Fan-Out CoS','fan-out chip on substrate',
  'VPD','vertical power delivery','lateral power delivery',
  'TLVR','transient lateral voltage','Dual Loop VR',
  'Aspeed power','power sequencing IP','BMC chip',
  'Alchip','Alchip ASIC','Google LTA','Google TPU LTA',
  'Rubin rack','VR rack','Vera Rubin rack',
  // 로봇·자율주행
  'humanoid','Figure','Boston Dynamics','Agility Robotics','1X Technologies',
  'Optimus Gen','Tesla Bot','warehouse robot','industrial robot',
  'L4 autonomy','L5 autonomy','lidar','perception','sensor fusion',
  // EV·배터리
  '800V architecture','800V platform','silicon carbide','SiC','GaN',
  'ultra-fast charging','solid state battery','sodium-ion battery',
  'LFP','NMC','dry electrode','4680 cell',
  // ── v37.7: 양자컴퓨팅
  'quantum computing','quantum computer','qubit','quantum advantage','quantum supremacy',
  'quantum error correction','topological qubit','quantum processor','quantum algorithm',
  'IONQ','IonQ','Rigetti','D-Wave','IBM Quantum','Google Willow','Quantinuum',
  'quantum networking','quantum cryptography','post-quantum','PQC',
  // v46.6: 광자 양자컴퓨팅 + 양자-암호 위협 (PhotonCap Xanadu + 돈스 Google/BTC)
  'photonic quantum','photonic QC','Xanadu','XNDU','Borealis','Aurora quantum','GKP qubit',
  'optical loss','squeezed light','silicon nitride PIC','PsiQuantum','photonic processor',
  'CRQC','cryptographically relevant quantum','quantum threat bitcoin','P2PK vulnerability',
  'fault tolerant quantum','OSAT','photomask','Amkor','Photronics','ASE Technology',
  // v46.6b: Citi CRWD Glasswing + JPM ASML + 대만 AI 3대장
  'Project Glasswing','Anthropic partnership','CRWD skill','agentic patching','fuzzing attack',
  'cyber fuzzing','KEV catalog','Overwatch telemetry','AI cyber arms race',
  'sovereign AI Japan','Japan AI Foundation Model','physical AI','NEDO trillion yen',
  'Samsung P5 fab','EUV order','ASML order disclosure','install base upgrade',
  'rack-level L11','GB300','Rubin transition','ODM AI server','ASIC multiplier growth',
  // v46.6c: Credo-DustPhotonics + Bloom-Oracle + SNDK SCA + 네오클라우드 수렴
  'DustPhotonics','SiPho PIC','silicon photonics vertical','Credo optical','ZeroFlap optics',
  'Bloom Energy','onsite generation','fuel cell datacenter','time-to-power','800V DC fuel cell',
  'SanDisk SCA','strategic contractual agreement','NAND structural tight','eSSD enterprise',
  'neocloud convergence','frontier lab neocloud','Meta CoreWeave','Anthropic CoreWeave','Vera Rubin architecture',
  // v46.9b: NAND SCA + HDD 재평가 + 광고 패권 + 기업 AI 3파전
  'NAND SCA','strategic contractual agreement NAND','NAND price floor','TurboQuant','TurboQuant storage',
  'Mozaic 4+','HAMR 44TB','100TB drive','140TB drive','HDD rerating',
  'Nanya DRAM investment','eSSD qualification','eSSD ramp','NAND ASP acceleration',
  'OpenClaw','GUI agent','computer use agent','Copilot GUI agent','digital agent automation',
  'OpenAI Bedrock','enterprise AI three-way','Claude mania','Anthropic ARR 300','OpenAI Amazon alliance',
  'META ad revenue overtake','Reels AI recommendation','AI video generation tool','Google search share decline',
  'Amazon LEO antenna','LEO gigabit aviation',
  'Western Digital','Seagate Technology','SanDisk earnings','WDC target','STX target',
  // ── v37.7: 우주경제·위성·LEO
  'space economy','LEO','low earth orbit','satellite constellation','Starlink',
  'AST SpaceMobile','Kuiper constellation','OneWeb','Iridium','Globalstar',
  'Planet Labs','Rocket Lab','Blue Origin','space station','orbital',
  'space data center','satellite internet','direct-to-cell','D2C satellite',
  // ── v37.7: 사이버보안 심화
  'zero trust','ZTNA','SASE','XDR','EDR','MDR','SOAR','SIEM',
  'ransomware','phishing','threat detection','identity security','IAM','PAM',
  'Fortinet','FTNT','SentinelOne','Okta','OKTA','Varonis','Rubrik',
  'cloud security','container security','DevSecOps','CNAPP','CSPM',
  'post-quantum cryptography','AI security','deepfake detection',
  // ── v37.7: 핵에너지 르네상스·전력인프라
  'nuclear renaissance','Constellation Energy','CEG','Vistra','VST','Talen Energy',
  'Three Mile Island','power purchase agreement','PPA','grid modernization',
  'NuScale','NuScale Power','OKLO','Kairos Power','TerraPower','X-energy',
  'transformer','grid transformer','power transformer','substation',
  'Quanta Services','EATON','Vertiv','Schneider Electric',
  // ── v37.7: AI 인프라 소프트웨어·MLOps
  'MLOps','AI inference','AI training','model serving','vector database',
  'RAG','retrieval augmented generation','fine-tuning','RLHF','DPO',
  'synthetic data','data labeling','Scale AI','Weights & Biases','Databricks',
  'Hugging Face','vLLM','TensorRT','ONNX','model optimization',
  // ── v37.3: 메가캡 테크 기업 · AI 기업 · 핵심 이벤트
  'Apple','AAPL','iPhone','iPad','Mac','Vision Pro','WWDC','App Store','Apple Intelligence',
  'Microsoft','MSFT','Windows','Azure','Copilot','Build','Activision',
  'Google','GOOGL','Alphabet','Search','YouTube','Waymo','Google I/O','Google Cloud',
  'Amazon','AMZN','AWS','Prime','Alexa','re:Invent','Kuiper','Amazon Robotics',
  'Meta','META','Facebook','Instagram','WhatsApp','Reality Labs','Llama','Threads',
  'Tesla','TSLA','FSD','Full Self-Driving','Robotaxi','Cybertruck','Optimus','Megapack','Terafab','Supercharger','Gigafactory',
  // ── 빅테크/AI CEO 키워드 (v42.1)
  'Jensen Huang','Lisa Su','Dario Amodei','Satya Nadella','Sundar Pichai',
  'Mark Zuckerberg','Andy Jassy','Tim Cook','Sanjay Mehrotra','Elon Musk',
  'Greg Brockman','Ilya Sutskever','Demis Hassabis',
  'NVIDIA','NVDA','GTC','Blackwell','Rubin','CUDA','DGX','Grace',
  // ── v37.3: AI 스타트업 · 플랫폼 기업
  'OpenAI','ChatGPT','GPT-5','Sora','Sam Altman','AGI',
  'Anthropic','Claude','constitutional AI',
  'xAI','Grok','Elon Musk AI',
  'Mistral','Cohere','Perplexity','AI21','Inflection',
  'Hugging Face','Stability AI','Midjourney','Runway',
  // ── v37.3: 클라우드 · SaaS · 사이버보안
  'Salesforce','CRM','ServiceNow','NOW','Snowflake','SNOW','Palantir','PLTR',
  'CrowdStrike','CRWD','Palo Alto','PANW','Datadog','DDOG','Zscaler',
  'Shopify','SHOP','Block Inc','PayPal','PYPL','Stripe',
  'Oracle','ORCL','Oracle Cloud','SAP','Workday','WDAY',
  // ── v37.3: 테크 이벤트 · 컨퍼런스
  'CES','MWC','GTC','WWDC','Google I/O','Build','re:Invent','re:MARS',
  'product launch','developer conference','keynote','developer day',
  // ── v37.3: 한국어 테크 기업
  '엔비디아','테슬라','애플','마이크로소프트','구글','아마존','메타',
  '오픈AI','앤트로픽','일론 머스크','젠슨 황','팀 쿡',
  '자율주행','로보택시','로봇','휴머노이드','비전프로',
  'FSD','완전자율주행','기가팩토리','테라팹','슈퍼차저',
  // ── v31.8: 한국 반도체 심화
  '삼성전자','SK하이닉스','삼성파운드리','HBM3E','HBM4',
  '선단공정','첨단패키징','반도체 수출','반도체 장비','반도체 소재',
  'AI 서버','데이터센터','클라우드','하이퍼스케일러',
  '웨이퍼','실리콘','팹','가동률','수율',
  'GPU 수요','AI 투자','AI 인프라','전력 수요',
  // ── v37.6: 한국어 핵심 기술 키워드 대폭 확장
  'CPO','광패키징','광인터커넥트','실리콘 포토닉스',
  // v38.6: 광인터커넥트+전력 한국어
  '광트랜시버','EML레이저','VCSEL','DFB레이저','파장분할다중화','인듐인화물','InP기판',
  '광인터포저','테라라이트','포엣','HVDC','고압직류','전력손실','스킨이펙트',
  '전력반도체','랙전력','기생에너지','PJM','계통연계','지중HVDC',
  '유리기판','글래스기판','글래스코어','글래스인터포저',
  '에이전틱AI','AI에이전트','멀티에이전트','에이전트',
  '온디바이스AI','AI PC','AI폰','소버린AI',
  '추론모델','체인오브쏘트','테스트타임컴퓨트',
  '맞춤형실리콘','커스텀칩','ASIC','트레이니움','인퍼런시아',
  '인피니밴드','NVLink','초고속네트워크',
  '액침냉각','수냉','직접냉각','데이터센터전력',
  '전력반도체','SiC','탄화규소','GaN','질화갈륨',
  '800V','초고속충전','전고체배터리','나트륨이온배터리',
  '휴머노이드로봇','피규어','보스턴다이나믹스','테슬라봇',
  'L4자율주행','라이다','센서퓨전',
  '리스크파이브','RISC-V','ARM아키텍처',
  '후면전력전달','BSPDN','재배선층',
  // ── v37.7: 한국어 양자·우주·사이버·원전 키워드
  '양자컴퓨팅','양자컴퓨터','큐비트','양자우위','양자암호',
  '우주경제','저궤도위성','위성인터넷','스타링크','우주데이터센터',
  '제로트러스트','사이버보안','랜섬웨어','클라우드보안','AI보안',
  '원전르네상스','소형모듈원전','뉴스케일','전력망','변압기','송전','배전',
  'MLOps','AI추론','AI학습','벡터DB','RAG','파인튜닝','합성데이터',
  // ── v38.5: 신규 키워드
  'NVLink Fusion','AI-RAN','XPU','semi-custom AI',
  'Enterprise SSD','LTA','long-term agreement',
  'Foundry 2.0','파운드리 2.0',
  // v39.2: 6개 자료 통합 (2026.04.03)
  // 샘 알트먼 AGI/Sora
  'automated researcher','automated company','OpenClaw','super agent',
  'AGI timeline','cognitive horsepower','AI resilience','compute crunch',
  'Sora shutdown','Sora cancelled','video generation shutdown',
  '자동화된 연구원','자동화된 회사','슈퍼에이전트','인지능력','AI 회복탄력성',
  // AMD HBM/메모리
  'HBM sold out','HBM shortage','HBM4E','custom HBM','co-designed memory',
  'VVP pricing','NVDA VVP','memory BOM','에이전틱 토큰','KV cache',
  'Helios','MI455X','12-stack HBM','16-stack HBM',
  // SemiAnalysis 메모리 CapEx
  'memory CapEx','memory inflation','DRAM repricing','LPDDR5 price',
  'B200 server price','server price increase','memory supercycle 2027',
  'hyperscaler memory spend','메모리 CapEx','메모리 인플레이션',
  // MS 일본 DC
  'data sovereignty','데이터 주권','Japan data center','Takaichi AI strategy',
  // v44.5: Capex 효율화 사이클 + 네오클라우드 + 자본조달 (2026.04.08)
  'Capex efficiency cycle','AI ROI cycle','GPU utilization maximize','inference optimization cycle',
  'CoreWeave CRWV','Nebius NBIS','neocloud GPU rental','neocloud overhang',
  'IREN neocloud','NBIS upside','neocloud sector rotation',
  'AI fabric bottleneck','network fabric performance','AI performance bottleneck',
  // v44.2: MSFT/AVGO/Samsung/LITE/CRDO 6개 리포트 통합 (2026.04.07, GS/Citi/JPM/미즈호)
  // CRDO AEC/ZFO/ALC
  'AEC cable','active electrical cable','AEC 800G','AEC 1.6T','Credo AEC',
  'ZeroFlap optics','ZFO transceiver','ZFO optics','zero flap optics',
  'active linear cable','ALC cable','ALC optics','ALC transceiver',
  // MSFT Azure 공급제약
  'Azure Fairwater','Fairwater data center','Azure supply constraint',
  'Microsoft E7','M365 E7','E7 license','Copilot E7','M365 SOTP',
  'Copilot monetization','Azure Fairwater ramp',
  // LITE CPO/OCS scale-up
  'OCS scale-up','scale-up CPO','Rosa Feynman CPO','Feynman CPO',
  'UHP laser','ultra-high-power laser','UHP CW laser','UHP EML laser',
  'OCS backlog','OCS contract backlog','Lumentum OCS',
  // Samsung memory 지속가능성
  'Samsung 1Q26','memory fill rate','memory supply fulfillment',
  'memory earnings sustainability','memory cycle sustainability',
  // Serdes 기술
  'Credo Serdes','CRDO Serdes','Serdes DSP','DSP-based AEC',
  // v44.8: DC전력+AI보안+맥북 통합 (2026.04.09)
  'MacBook Neo','chip binning','binned chip supply','A18 Pro binned',
  'Project Glasswing','Claude Mythos','shadow AI','shadow IT AI',
  'aeroderivative turbine','prime power generation','load following power',
  'demand response datacenter','inference datacenter proximity','BTM gas power',
  '맥북 네오','칩 빈닝','빈닝 칩','클로드 미토스','섀도 AI',
  // v46.4: NAND HBF + AI사이버 임계점 + 걸프 인프라 + TPU 로열티 (2026.04.10)
  'KVCache eSSD','KV cache SSD','high bandwidth flash','HBF NAND','16-layer SLC',
  'QLC eSSD','NAND wafer capacity','NAND supply tight','375L NAND','459L NAND',
  'SanDisk HBF','SNDK earnings','WDC earnings','STX earnings',
  'GPT-5.3-Codex','Codex cyber','gated release','trusted access cyber','cyber trust',
  'Anthropic custom chip','Anthropic chip design','AI lab chip',
  'Lumentum orders','LITE backlog','InP laser capacity','CPO backlog 2028',
  'TPU royalty','TPU asset-light','GCP marginal OI','cloud OI contribution',
  'KVCache','고대역폭 플래시','NAND 공급 타이트','제한적 공개','사이버 신뢰',
  '앤트로픽 자체칩','TPU 로열티','클라우드 한계이익률',
  // v46.6: 2026 신규 AI/반도체 키워드 확장
  // 추론 모델 (O1/O3/O4)
  'o1','o3','o4-mini','test-time compute','inference scaling','reasoning model','chain of thought',
  'GPT-5','GPT-o1','o1-mini','o3-mini',
  // Stargate / 대규모 AI 인프라
  'Project Stargate','Stargate','$500B','hyperscaler investment','AI infrastructure fund',
  'magnitude of compute','sovereign AI fund','AI sovereign',
  // 신규 AI칩 기업
  'Cerebras','wafer scale engine','Cerebras IPO','Graphcore','IPU',
  'Groq','LPU','inference optimization','Groq IPO',
  'SambaNova','Tenstorrent','Habana','Gaudi3',
  // 소형 모델 / 효율화
  'distillation','knowledge distillation','PEFT','LoRA','QLoRA','quantization',
  'edge inference','on-device inference','parameter efficient',
  // 패키징 혁신
  'glass substrate','direct bonding','hybrid bonding','chiplet standard','UCIe',
  'fan-out wafer','FOWLP','panel level packaging','2.5D packaging',
  // 전력 반도체 / 차세대
  'GaN power','SiC MOSFET','wide bandgap','전력반도체','GaN','SiC',
  // 한국어 추가
  '추론 모델','추론 스케일링','테스트타임 컴퓨트','스타게이트',
  '세레브라스','그록','지식 증류','엣지 추론','유리기판','하이브리드 본딩','칩렛 표준',
  // v46.6: Cantor AI 인프라 + 번스타인 Muse + Citi SW Shock + 미즈호/Citi 오라클
  'neocloud','neo-cloud','네오클라우드','AI factory','AI 팩토리',
  'credit wrapper','credit backstop','크레딧 래퍼','크레딧 백스톱',
  'BYOG','bring your own generation','자체 발전',
  'time-to-power','time to power','colocation rent','코로케이션 렌트',
  'GPU time','GPU 시간단가','MW per rack','랙당 전력밀도',
  'Mission Control','오케스트레이션 스택','GPU orchestration',
  'Muse Spark','Contemplating mode','Vals Index',
  'Fusion Agentic','Agent Hub','AI Agent Studio','에이전틱 앱',
  'vibe coding','바이브 코딩','RoCE fabric','off-box virtualization',
  'seat-based','좌석 기반','AI shock','terminal value risk',
  // v47.1: TD Cowen DC채널체크 + QCOM 추론시장 + DC리싱 구조 (2026.04.16)
  'DC leasing','data center leasing','GW-scale leasing','DC leasing record',
  'powered shell','triple-net pricing','powered shell deal','turn-key DC',
  'Snapdragon X Elite','Snapdragon X Plus','Windows on ARM','Copilot+ PC',
  'AI PC rerating','on-device inference platform','edge AI PC','AI PC NPU',
  'QCOM rerating','inference market','device AI','디바이스 AI','추론 시장',
  '스냅드래곤 X 엘리트','윈도우 온 ARM','AI PC 리레이팅','DC 리싱',
  '파워드 쉘','트리플넷','데이터센터 리싱',
];
// MED_KW: 일반 기업/시장 이슈 → 보통 중요도 (+6점)
const MED_KW = [
  'earnings','quarterly results','revenue beat','revenue miss',
  'guidance raise','guidance cut','outlook','beat estimates','miss estimates',
  'acquisition','merger','IPO','buyback','dividend','spin-off',
  'partnership','strategic partnership','strategic alliance','joint venture','collaboration',
  // v38.6: 광통신·전력 기업이슈
  'optical transceiver','광트랜시버','EML laser','VCSEL','DFB laser',
  'laser bottleneck','레이저 부족','레이저 병목','InP shortage','인듐인화물 부족',
  'HVDC','power delivery','전력전달','AC DC','전력 변환',
  'Kyber rack','ELSFP','optical interposer','광인터포저',
  'photonics semiconductor','포토닉스 반도체','Luxshare','FIT','LITEON','Lessengers',
  'strategic investment','power plant','data center power','satellite','LEO satellite',
  '파트너십','전략적 제휴','합작','위성통신','발전소','데이터센터 전력',
  'chip','battery','electric vehicle','cloud','SaaS','cybersecurity','blockchain',
  'bitcoin','crypto','ETF','recall','lawsuit','regulatory',
  // ── v31.8: 기업 이벤트 심화
  'stock split','secondary offering','share repurchase','tender offer',
  'activist investor','proxy fight','board shake-up','CEO change','CFO',
  'insider buying','insider selling','Form 4','13F filing','SEC filing',
  'index inclusion','index exclusion','S&P 500 addition','rebalancing',
  'lockup expiry','lockup expiration','pipe deal','shelf registration',
  'credit rating','Moody','Fitch','S&P rating','rating downgrade','rating upgrade',
  'profit warning','revenue shortfall','cost cutting','restructuring','layoff',
  'capex','capital expenditure','R&D spending','operating margin','gross margin',
  'free cash flow','FCF','EBITDA','operating income','net income',
  'same-store sales','comparable sales','backlog','order book','bookings',
  'ASP','average selling price','unit shipments','market share',
  'patent','intellectual property','trade secret','antitrust','monopoly',
  'supply shortage','inventory build','channel check','demand trend',
  'defense','defence','military','weapon','missile defense','arms deal',
  // ── v37.6: 방산·에너지·EV 키워드 보강
  'Golden Dome','Iron Dome','missile shield','hypersonic defense','space defense',
  'drone defense','counter-drone','directed energy','laser weapon',
  'nuclear power','SMR','uranium','renewable energy','solar','wind',
  'EV battery','lithium','cobalt','nickel','cathode','anode','solid state battery',
  '800V','SiC inverter','fast charging','battery swap','V2G','vehicle-to-grid',
  // ── v37.7: GLP-1·비만치료제 세부 확장
  'Wegovy','Ozempic','Mounjaro','Zepbound','tirzepatide','semaglutide','liraglutide',
  'oral GLP-1','GLP-1 agonist','incretin','weight loss drug','obesity drug','anti-obesity',
  'Medicare obesity','Medicare GLP-1','Novo Nordisk','NVO','Eli Lilly','LLY','Amgen obesity',
  // ── v37.7: 바이오·제약 심화
  'bispecific antibody','ADC','antibody drug conjugate','CAR-T','cell therapy','gene therapy',
  'mRNA','RNA therapeutics','CRISPR','gene editing','BBB shuttle','brain-blood barrier',
  'Phase 1','Phase 2','Phase 3','NDA','BLA','PDUFA','EMA approval',
  'orphan drug','rare disease','oncology','immunotherapy','checkpoint inhibitor','PD-1','PD-L1',
  'biosimilar','generic drug','patent cliff','loss of exclusivity','LOE',
  // ── v37.7: ESS·에너지저장
  'ESS','energy storage','BESS','grid-scale battery','grid storage','battery storage',
  'stationary storage','utility-scale','peak shaving','frequency regulation',
  // ── v37.7: 조선·해운·해양
  'shipbuilding','shipyard','newbuild','order book','vessel','tanker','bulk carrier',
  'container ship','LNG carrier','warship','naval vessel','frigate','destroyer',
  'HD Hyundai','Hanwha Ocean','Samsung Heavy','Daewoo Shipbuilding',
  // ── v37.7: 우주·위성 기업
  'SpaceX','Rocket Lab','RKLB','Blue Origin','satellite','Starlink','AST SpaceMobile','ASTS',
  'Iridium','IRDM','Globalstar','GSAT','Planet Labs','L3Harris','LHX',
  // ── v37.7: 사이버보안 기업 이벤트
  'ransomware attack','data breach','cyber attack','zero-day','vulnerability',
  'Fortinet','FTNT','SentinelOne','Okta','Rubrik','IPO',
  'biotech','FDA approval','clinical trial','Phase 3','drug pipeline',
  'SPAC','de-SPAC','direct listing','Dutch auction',
  // ── v37.3: 기업 이벤트 · 제품 · 규제 보강
  'product launch','product reveal','product announcement','new product',
  'developer conference','keynote','investor day','analyst day','capital markets day',
  'CEO','CTO','CFO resignation','management change','succession',
  'antitrust ruling','DOJ','FTC','EU fine','consent decree','breakup',
  'data breach','security incident','outage','service disruption',
  'content moderation','platform ban','TikTok ban','Section 230',
  'streaming','subscriber','subscriber growth','churn','ARPU',
  'Netflix','NFLX','Disney','DIS','Spotify','SPOT',
  'Uber','UBER','Airbnb','ABNB','DoorDash','DASH','Instacart',
  'Visa','Mastercard','Amex','AXP',
  'JPMorgan','Goldman Sachs','Morgan Stanley','Bank of America','Citigroup',
  'Berkshire','Buffett','Munger',
  // ── v37.3: 한국어 기업 이벤트 보강
  '제품 출시','신제품','개발자 컨퍼런스','키노트','투자자의 날',
  '독점금지','반독점','벌금','규제','플랫폼 규제',
  '데이터 유출','서비스 장애','해킹',
  '넷플릭스','디즈니','스포티파이','우버','에어비앤비',
  '버크셔','버핏','JP모건','골드만삭스','모건스탠리',
  // ── v31.8: 한국어 기업 이벤트
  '실적','매출','영업이익','순이익','가이던스','전망','컨센서스',
  '자사주','자사주 매입','자사주 소각','배당','증자','감자',
  '인수합병','M&A','공개매수','경영권','지배구조',
  '공매도 잔고','신용잔고','대차잔고','기관 순매수','외국인 순매수',
  '상장폐지','거래정지','관리종목','불성실공시',
  '방산','방위산업','무기','군수','원전','원자력','우라늄',
  // ── v37.6: 한국 방산·에너지·EV·바이오 키워드 보강
  '골든돔','아이언돔','미사일방어','극초음속','우주방위','드론방어','레이저무기',
  'SMR','소형모듈원전','원전수출','한수원','두산에너빌리티',
  '2차전지','리튬','배터리','전기차','수소','태양광','풍력',
  '800V','초고속충전','전고체배터리','나트륨이온','LFP','하이니켈',
  'SiC 인버터','배터리스왑','V2G',
  '바이오','신약','임상','FDA','식약처',
  'GLP-1','비만치료제','바이오시밀러','ADC','항체약물접합체',
  '조선','LNG선','컨테이너선','벌크선','해운',
  // ── v37.7: 한국 바이오·ESS·조선·우주 키워드 보강
  '위고비','오젬픽','마운자로','제패운드','세마글루타이드','티르제파타이드',
  '경구GLP-1','비만약','체중감량','항비만','노보노디스크','일라이릴리',
  '이중항체','CAR-T','세포치료','유전자치료','mRNA','크리스퍼','유전자편집',
  '알테오젠','에이비엘바이오','삼성바이오로직스','셀트리온','SK바이오사이언스',
  'ESS','에너지저장','BESS','그리드','계통안정화','피크셰이빙',
  'HD현대중공업','한화오션','삼성중공업','HD현대미포','군함','호위함','구축함',
  '한화에어로스페이스','현대로템','LIG넥스원','풍산',
  '우주항공','위성','발사체','누리호','스타링크','저궤도',
  '사이버공격','랜섬웨어','해킹','보안사고','제로데이',
];
// ANALYST_KW: 개별 종목 analyst rating → 홈 노출 페널티 (-20점)
const ANALYST_KW = [
  'price target','target price','upgrades to','downgrades to',
  'initiates coverage','reiterates','overweight','underweight',
  'outperform','underperform','buy rating','sell rating','hold rating',
  'analyst raises','analyst cuts','analyst initiates',
  'raises target','cuts target','raises pt','cuts pt',
  'initiates at buy','initiates at overweight','initiates at outperform',
  'sets target','sets pt','reiterate buy','reiterate overweight',
  'Jefferies','JPMorgan','Goldman Sachs','Morgan Stanley','Citigroup','Bank of America',
  'KeyBanc','Piper Sandler','Barclays','UBS','Deutsche Bank','RBC Capital',
  'Mizuho','Needham','Wedbush','Canaccord','Truist','Oppenheimer','Stifel',
  '목표주가','투자의견','매수의견','매도의견','중립의견',
  '목표주가 상향','목표주가 하향','투자의견 상향','투자의견 하향',
  '비중확대','비중축소','시장수익률','매수 유지','중립 유지',
];
// 하위 호환: HIGH_KW = MACRO_KW + TECH_KW
const HIGH_KW = [...MACRO_KW, ...TECH_KW];
const KNOWN_TICKERS = new Set([
  'AAOI','AAPL','ABBV','ABNB','ABT','ACGL','ACLS','ACN','ADA','ADBE','ADI','ADP',
  'ADSK','AEHR','AEM','AEP','AES','AFL','AFRM','AGG','AI','AIG','AIZ','AJG',
  'AKAM','ALB','ALGN','ALL','ALLE','ALNY','AMAT','AMC','AMD','AME','AMGN','AMP',
  'AMT','AMX','AMZN','ANET','ANSS','AON','APD','APH','APO','APP','APTV','ARE',
  'ARES','ARGX','ARKF','ARKG','ARKK','ARM','ASML','ASTS','ATO','AU','AVAX','AVB',
  'AVGO','AWK','AXON','AXP','AZN','AZO','B','BA','BABA','BAC','BAM','BAX',
  'BBBY','BBVA','BBWI','BCS','BDX','BG','BHP','BIDU','BIIB','BILL','BIO','BIRD',
  'BITF','BK','BKNG','BKR','BLDR','BLK','BMO','BMY','BN','BNB','BND','BNS',
  'BP','BR','BRK-B','BRK.A','BRK.B','BRO','BRZE','BSX','BTC','BTI','BUD','BWA','BX',
  'BXP','BZ=F','C','CAG','CAH','CARR','CAT','CAVA','CB','CBOE','CBRE','CCEP',
  'CCJ','CCL','CDNS','CDW','CE','CEG','CELH','CFG','CFLT','CHD','CHRW','CHTR',
  'CI','CIEN','CIFR','CINF','CL','CL=F','CLSK','CLX','CM','CMCSA','CME','CMG',
  'CMI','CMS','CNC','CNI','CNQ','COF','COHR','COIN','COO','COP','COR','COST',
  'CORZ','CP','CPAY','CPB','CPNG','CPRT','CPT','CRDO','CRH','CRL','CRM','CRSP','CRWD',
  'CRWV','CSCO','CSX','CTAS','CTSH','CTVA','CVNA','CVS','CVX','CZR','D','DAL',
  'DASH','DAY','DB','DD','DDOG','DE','DECK','DELL','DEO','DG','DGX','DHI',
  'DHR','DIA','DIS','DJI','DLR','DLTR','DM','DNA','DOCN','DOGE','DOT','DOV',
  'DOW','DPZ','DUK','DUOL','DVA','DVN','DWAC','DXCM','E','EA','EBAY','ECL',
  'ED','EEM','EFA','EFX','EG','EIX','ELV','EMB','EMN','EMR','ENB','ENPH',
  'EOG','EPAM','EPD','EQIX','EQNR','EQT','ESS','ESTC','ET','ETH','ETN','ETR',
  'EVRG','EW','EWJ','EWY','EXAS','EXC','EXPD','EXR','F','FANG','FAST','FCX',
  'FDS','FDX','FE','FER','FERG','FFIV','FI','FICO','FIS','FISV','FITB','FIX',
  'FN','FNV','FOX','FOXA','FRT','FSLR','FTNT','FXI','GC=F','GD','GDDY','GDX',
  'GE','GEHC','GEN','GEV','GFI','GFS','GILD','GIS','GL','GLD','GLW','GM',
  'GME','GNRC','GOLD','GOOG','GOOGL','GPN','GRAB','GRMN','GS','GSK','GTLB','GWW',
  'HACK','HAL','HCA','HD','HDB','HEI','HG=F','HIG','HII','HIMS','HLN','HLT',
  'HMC','HOLX','HON','HOOD','HPE','HPQ','HRL','HSBC','HSIC','HSY','HUBB','HUBS',
  'HUM','HUT','HWM','HYG','IBB','IBM','IBN','ICE','ICLN','IDXX','IEF','IEX',
  'IFF','IGV','ILMN','IMO','INCY','INDA','INFY','ING','INTC','INTU','IONQ','IPG',
  'IQV','IREN','IRM','ISRG','IT','ITA','ITUB','ITW','IVV','IWM','J','JBHT',
  'JCI','JD','JNJ','JNPR','JOBY','JPM','K','KARS','KDP','KEX','KEY','KEYS','KHC',
  'KIM','KKR','KLAC','KMI','KO','KR','KTOS','KVUE','KVYO','LBRT','LCID','LDOS','LHX','LI',
  'LII','LIN','LINK','LITE','LKQ','LLY','LMT','LNG','LNT','LOW','LQD','LRCX',
  'LULU','LUNR','LUV','LYFT','LYG','LYV','MA','MAA','MAR','MARA','MAS','MATIC',
  'MCD','MCHP','MCK','MCO','MDB','MDLN','MDLZ','MDT','MELI','MET','META','MFC',
  'MFG','MGM','MHK','MKTX','MMC','MMM','MNDY','MNST','MO','MOH','MP','MPC',
  'MPLX','MPWR','MRK','MRNA','MRSH','MRVL','MS','MSCI','MSFT','MSI','MSTR','MTB',
  'MTCH','MTD','MTSI','MTZ','MU','MUFG','NBIS','NCLH','NDAQ','NDX','NEE','NEM','NET',
  'NFLX','NG=F','NGG','NI','NIO','NKE','NOC','NOW','NRG','NSC','NTAP','NTES',
  'NTRS','NU','NUE','NVDA','NVO','NVR','NVS','NVT','NWG','NWS','NWSA','NXPI','O',
  'ODFL','OIH','OKE','OKLO','OKTA','ON','ONON','ORCL','ORLY','OTIS','OXY','PANW',
  'PSKY','PATH','PAYC','PAYX','PBR','PCAR','PDD','PEG','PEP','PFE','PFG','PG',
  'PGR','PH','PHM','PINS','PKG','PL','PLBY','PLD','PLTR','PM','PNC','PODD',
  'POET','POOL','PPG','PPL','PRU','PSA','PSX','PTC','PWR','PYPL','QBTS','QCOM',
  'QQQ','QUBT','RACE','RBLX','RCL','RDDT','RDW','REG','REGN','RELX','RF','RGTI',
  'RHI','RIO','RIOT','RIVN','RKLB','RKT','RL','RMD','ROK','ROKU','ROP','ROST',
  'RSG','RSP','RTX','RUT','RVTY','RY','SAN','SAP','SBAC','SBUX','SCCO','SCHW',
  'SE','SEI','SGEN','SHEL','SHOP','SHW','SHY','SI=F','SLB','SLV','SMCI','SMFG','SMH',
  'SMMT','SMR','SNA','SNAP','SNDK','SNOW','SNPS','SNY','SO','SOFI','SOL','SOLV',
  'SONY','SOUN','SOXX','SPG','SPGI','SPOT','SPX','SPY','SQ','SRE','STE',
  'STLD','STT','STX','STZ','SU','SWK','SWKS','SYK','SYY','T','TAK','TCOM',
  'TD','TDG','TEAM','TECH','TECK','TEL','TEM','TER','TFC','TFX','TGT','TIP',
  'TJX','TKO','TLN','TLT','TM','TMO','TMUS','TOST','TPR','TRGP','TRI','TROW',
  'TRP','TRV','TSCO','TSLA','TSM','TT','TTD','TTE','TTWO','TWLO','TXN','TXT',
  'TYL','U','UBER','UBS','UDR','UL','UNG','UNH','UNI','UNP','UPS','UPST',
  'URI','USB','USO','UVXY','V','VALE','VEEV','VIAV','VLO','VLTO','VOO','VRSK',
  'VRSN','VRT','VRTX','VST','VTI','VTR','VTRS','VWO','VXX','VZ','WAB','WAT',
  'WBA','WBD','WCN','WDAY','WDC','WEC','WELL','WFC','WM','WMB','WMT','WOLF',
  'WPM','WRB','WRK','WSO','WST','WTW','WULF','WY','WYNN','XBI','XEL','XLB',
  'XLC','XLE','XLF','XLI','XLK','XLP','XLRE','XLU','XLV','XLY','XOM','XPEV',
  'XRP','XYZ','YUM','ZBRA','ZS','ZTS'
,'AA','ABB','ADM','AMLP','ALAB','AMKR','ASX','BE','BITO','BOTZ','BWXT','CCI','CLS','CYBR','DKNG','EME','ENTG','ES','ETSY','FANUY','FCEL','FLNC','FLR','FTI','IBIT','JETS','KGC','LAC','LEU','LIT','MASI','NDSN','NOV','NTDOY','ONTO','PLAB','PLUG','PNW','RUN','S','SEDG','STAG','TPL','UAL','UCTT','UMC','URA','VKTX','WHD','XNDU','XOP','000001.SS','BTC-USD','CIBR','DX-Y.NYB','ETH-USD','MMFD','MMFI','MMTW','^DJI','^FCHI','^FTSE','^GDAXI','^GSPC','^HSI','^IXIC','^KS11','^N225','^RUT','^TNX','^VIX']);

// v27.4: 한국어 기업명/영문 소문자 → 티커 매핑 (대폭 확장)
const KR_TICKER_MAP = {
  // ═══ 미국 대형주 / 주도주 ═══
  '엔비디아': 'NVDA', 'nvidia': 'NVDA', '젠슨황': 'NVDA', 'jensen huang': 'NVDA',
  '애플': 'AAPL', 'apple': 'AAPL', '팀쿡': 'AAPL',
  '테슬라': 'TSLA', 'tesla': 'TSLA', '일론머스크': 'TSLA', 'elon musk': 'TSLA',
  '마이크로소프트': 'MSFT', 'microsoft': 'MSFT',
  '아마존': 'AMZN', 'amazon': 'AMZN', 'aws': 'AMZN',
  '구글': 'GOOGL', '알파벳': 'GOOGL', 'google': 'GOOGL', 'alphabet': 'GOOGL',
  '메타': 'META', 'facebook': 'META', '페이스북': 'META', '저커버그': 'META',
  '넷플릭스': 'NFLX', 'netflix': 'NFLX',
  '디즈니': 'DIS', 'disney': 'DIS',
  '오라클': 'ORCL', 'oracle': 'ORCL',
  '세일즈포스': 'CRM', 'salesforce': 'CRM',
  '어도비': 'ADBE', 'adobe': 'ADBE',
  '스노우플레이크': 'SNOW', 'snowflake': 'SNOW',
  '팰런티어': 'PLTR', '팔란티어': 'PLTR', 'palantir': 'PLTR',
  '쇼피파이': 'SHOP', 'shopify': 'SHOP',
  '우버': 'UBER', 'uber': 'UBER',
  '에어비앤비': 'ABNB', 'airbnb': 'ABNB',
  '도어대시': 'DASH', 'doordash': 'DASH',
  '쿠팡': 'CPNG', 'coupang': 'CPNG',
  // ── 반도체 / AI ──
  'amd': 'AMD', '에이엠디': 'AMD',
  '브로드컴': 'AVGO', 'broadcom': 'AVGO',
  '대만반도체': 'TSM', 'tsmc': 'TSM', '티에스엠씨': 'TSM',
  '마이크론': 'MU', 'micron': 'MU',
  '인텔': 'INTC', 'intel': 'INTC',
  '퀄컴': 'QCOM', 'qualcomm': 'QCOM',
  '마벨': 'MRVL', 'marvell': 'MRVL', '마벨테크놀로지': 'MRVL',
  '델타항공': 'DAL', 'delta air': 'DAL', '델타에어라인': 'DAL',
  '마이크론': 'MU', 'micron': 'MU',
  // v38.6: 광통신·전력 기업 매핑
  '코히런트': 'COHR', 'coherent': 'COHR', '코히어런트': 'COHR',
  '루멘텀': 'LITE', 'lumentum': 'LITE',
  '포엣': 'POET', 'poet technologies': 'POET', '포엣테크놀로지': 'POET',
  '시스코푸드': 'SYY', 'sysco': 'SYY',
  '럭스쉐어': 'LUXSHARE', 'luxshare': 'LUXSHARE',
  '아폴로': 'APO', 'apollo': 'APO',
  '아리스타': 'ANET', 'arista': 'ANET',
  'asml': 'ASML', '에이에스엠엘': 'ASML',
  '램리서치': 'LRCX', 'lam research': 'LRCX',
  '어플라이드': 'AMAT', 'applied materials': 'AMAT',
  'arm holdings': 'ARM', '에이알엠': 'ARM',
  '슈퍼마이크로': 'SMCI', 'supermicro': 'SMCI', 'super micro': 'SMCI',
  '시놉시스': 'SNPS', 'synopsys': 'SNPS',
  '케이던스': 'CDNS', 'cadence': 'CDNS',
  // v48.19 (integrate): /integrate 35건 리서치 주요 기업 매핑 확장
  // NAND/HDD 메모리
  '샌디스크': 'SNDK', 'sandisk': 'SNDK',
  '시게이트': 'STX', 'seagate': 'STX',
  '웨스턴디지털': 'WDC', 'western digital': 'WDC',
  '넷앱': 'NTAP', 'netapp': 'NTAP',
  // 광학·인터커넥트·EMS·네트워킹
  '코닝': 'GLW', 'corning': 'GLW',
  '파브리넷': 'FN', 'fabrinet': 'FN',
  '앰페놀': 'APH', 'amphenol': 'APH',
  '크레도': 'CRDO', 'credo technology': 'CRDO', 'credo tech': 'CRDO',
  '셀레스티카': 'CLS', 'celestica': 'CLS',
  '재빌': 'JBL', 'jabil': 'JBL',
  '플렉스': 'FLEX', 'flex ltd': 'FLEX',
  '시에나': 'CIEN', 'ciena': 'CIEN',
  // 테스트·계측·IT
  '테라다인': 'TER', 'teradyne': 'TER',
  '키사이트': 'KEYS', 'keysight': 'KEYS',
  '델': 'DELL', 'dell technologies': 'DELL',
  // AI 인프라 / 네오클라우드
  '코어위브': 'CRWV', 'coreweave': 'CRWV',
  '네비우스': 'NBIS', 'nebius': 'NBIS',
  // 위성통신 (Globalstar/AMZN LEO 테마)
  '글로벌스타': 'GSAT', 'globalstar': 'GSAT',
  // v48.19: AVGO-Meta MTIA, 테라팹, Wartsila 맥락 주요 키워드
  'mtia': 'META', 'meta mtia': 'META',
  '바르실라': 'WRT1V.HE', 'wartsila': 'WRT1V.HE', // 핀란드 상장(미국 티커 없음) — 매핑은 맥락 표시용
  // ── 클라우드 / 사이버보안 ──
  '크라우드스트라이크': 'CRWD', 'crowdstrike': 'CRWD',
  '팔로알토': 'PANW', 'palo alto': 'PANW',
  '지스케일러': 'ZS', 'zscaler': 'ZS',
  '포티넷': 'FTNT', 'fortinet': 'FTNT',
  '데이터독': 'DDOG', 'datadog': 'DDOG',
  '몽고디비': 'MDB', 'mongodb': 'MDB',
  '클라우드플레어': 'NET', 'cloudflare': 'NET',
  // ── 금융 ──
  '골드만삭스': 'GS', 'goldman sachs': 'GS', 'goldman': 'GS',
  'JP모건': 'JPM', '제이피모건': 'JPM', 'jpmorgan': 'JPM', 'jp morgan': 'JPM',
  '모건스탠리': 'MS', 'morgan stanley': 'MS',
  '블랙록': 'BLK', 'blackrock': 'BLK',
  '버크셔': 'BRK.B', '워런버핏': 'BRK.B', 'berkshire': 'BRK.B', 'warren buffett': 'BRK.B',
  '뱅크오브아메리카': 'BAC', 'bank of america': 'BAC',
  '시티': 'C', 'citigroup': 'C',
  '웰스파고': 'WFC', 'wells fargo': 'WFC',
  '비자': 'V', 'visa': 'V',
  '마스터카드': 'MA', 'mastercard': 'MA',
  '페이팔': 'PYPL', 'paypal': 'PYPL',
  '코인베이스': 'COIN', 'coinbase': 'COIN',
  // ── 방산 ──
  '록히드마틴': 'LMT', 'lockheed martin': 'LMT', 'lockheed': 'LMT',
  '레이시온': 'RTX', 'raytheon': 'RTX',
  '노스롭': 'NOC', 'northrop': 'NOC', 'northrop grumman': 'NOC',
  '보잉': 'BA', 'boeing': 'BA',
  '제너럴다이내믹스': 'GD', 'general dynamics': 'GD',
  '헌팅턴잉걸스': 'HII', 'huntington ingalls': 'HII',
  '엘쓰리해리스': 'LHX', 'l3harris': 'LHX',
  '로켓랩': 'RKLB', 'rocket lab': 'RKLB',
  // ── 에너지 ──
  '엑슨모빌': 'XOM', 'exxon': 'XOM', 'exxonmobil': 'XOM',
  '셰브론': 'CVX', 'chevron': 'CVX',
  '코노코필립스': 'COP', 'conocophillips': 'COP',
  '옥시덴탈': 'OXY', 'occidental': 'OXY',
  '슐럼버거': 'SLB', 'schlumberger': 'SLB',
  // ── 바이오 / 헬스케어 ──
  '일라이릴리': 'LLY', 'eli lilly': 'LLY', '릴리': 'LLY',
  '노보노디스크': 'NVO', 'novo nordisk': 'NVO', '오젬픽': 'NVO', 'ozempic': 'NVO', 'wegovy': 'NVO',
  '모더나': 'MRNA', 'moderna': 'MRNA',
  '리제네론': 'REGN', 'regeneron': 'REGN',
  '화이자': 'PFE', 'pfizer': 'PFE',
  '머크': 'MRK', 'merck': 'MRK',
  '애브비': 'ABBV', 'abbvie': 'ABBV',
  // ── 자동차 / EV ──
  '리비안': 'RIVN', 'rivian': 'RIVN',
  '루시드': 'LCID', 'lucid': 'LCID',
  '니오': 'NIO', 'nio': 'NIO',
  '샤오펑': 'XPEV', 'xpeng': 'XPEV',
  '리오토': 'LI', 'li auto': 'LI',
  '토요타': 'TM', 'toyota': 'TM',
  // ── 암호화폐 ──
  '비트코인': 'BTC', 'bitcoin': 'BTC',
  '이더리움': 'ETH', 'ethereum': 'ETH',
  '솔라나': 'SOL', 'solana': 'SOL',
  '리플': 'XRP', 'ripple': 'XRP',
  '도지코인': 'DOGE', 'dogecoin': 'DOGE',
  // ═══  한국 주요 종목 ═══
  '삼성전자': '$삼성전자', '삼성': '$삼성전자',
  'SK하이닉스': '$SK하이닉스', '하이닉스': '$SK하이닉스',
  '네이버': '$네이버', 'naver': '$네이버',
  '카카오': '$카카오', 'kakao': '$카카오',
  '현대차': '$현대차', '현대자동차': '$현대차',
  '기아': '$기아',
  'LG에너지솔루션': '$LG엔솔', 'LG엔솔': '$LG엔솔',
  '포스코홀딩스': '$포스코', '포스코': '$포스코',
  '삼성바이오로직스': '$삼성바이오', '삼성바이오': '$삼성바이오',
  'LG화학': '$LG화학',
  '셀트리온': '$셀트리온',
  'KB금융': '$KB금융',
  '신한지주': '$신한지주',
  '하나금융': '$하나금융',
  '현대모비스': '$현대모비스',
  'SK텔레콤': '$SKT',
  'KT': '$KT',
  '한국전력': '$한전', '한전': '$한전',
  '두산에너빌리티': '$두산에너빌리티',
  '에코프로': '$에코프로',
  '에코프로비엠': '$에코프로BM',
  '한화에어로스페이스': '$한화에어로', '한화에어로': '$한화에어로',
  'HD현대': '$HD현대',
  // ── 지수 / ETF ──
  '코스피': 'KOSPI', '코스닥': 'KOSDAQ',
  '나스닥': 'QQQ', 'nasdaq': 'QQQ',
  '다우': 'DIA', 'dow jones': 'DIA', 'dow': 'DIA',
  'S&P': 'SPY', 's&p 500': 'SPY', 's&p500': 'SPY',
  '러셀': 'IWM', 'russell': 'IWM',
  '필라델피아반도체': 'SOXX', 'sox': 'SOXX',
};

// v27.4: 비주식 뉴스 블랙리스트 — 부동산, 연예, 스포츠, 생활, 날씨 등 제거
const NEWS_BLACKLIST_KW = [
  // ═══ 한국어 블랙리스트 ═══
  // 부동산
  '아파트','부동산','전셋값','월셋값','분양','재건축','재개발','매매가','전세가','임대차',
  '청약','입주','공시지가','토지','주택담보','주택가격','오피스텔','상가','건물주',
  '집값','전월세','보증금','주거',
  // 연예/스포츠/생활
  '연예','아이돌','드라마','영화 개봉','예능','스포츠','축구','야구','프로야구','올림픽',
  '맛집','레시피','여행지','관광','다이어트','헬스','뷰티','패션','웨딩','육아',
  '날씨','기온','폭우','폭설','미세먼지','자외선',
  // 사건사고/범죄 (금융 무관)
  '교통사고','화재','실종','살인','폭행','성범죄','음주운전',
  '강도','절도','납치','사기범','마약','도박','검거','체포','피의자','구속',
  '호신','가스총','흉기','칼부림','테러','방화','자살','사망사고','익사',
  // 연예인/방송 (금융 무관)
  '출연','방송인','배우','가수','걸그룹','보이그룹','팬미팅','콘서트','뮤직비디오',
  '시청률','리얼리티','토크쇼','종영','첫방','복귀','열애','파경','이혼설',
  // ═══ 영문 블랙리스트 (비금융 콘텐츠 근본 차단) ═══
  // 부동산
  'housing price','real estate','mortgage','apartment','home sales','housing market','rent prices',
  // 연예/셀럽
  'celebrity','kardashian','dating','boyfriend','girlfriend','married','divorce','engagement',
  'red carpet','oscars','grammy','emmy','golden globe','mtv','billboard music',
  'hollywood','movie review','box office','film festival','netflix series','tv show',
  'k-pop','k-drama','idol','boyband','girl group','reality show','talk show',
  'instagram','tiktok viral','influencer','paparazzi','scandal','affair',
  // 스포츠
  'nfl','nba','mlb','nhl','premier league','champions league','world cup','super bowl',
  'touchdown','home run','goalkeeper','playoff','draft pick','free agent signing',
  'transfer window','match result','game recap','sports betting','fantasy football',
  // 가전/가젯/앱 리뷰 (The Verge, TechCrunch 등에서 유입)
  'phone review','laptop review','tablet review','gadget review','smartwatch review',
  'best phones','best laptops','best tablets','best headphones','best earbuds',
  'how to fix','troubleshooting guide','tips and tricks','life hack',
  'app of the week','app review','game review','video game','gaming console',
  'playstation','xbox','nintendo','steam deck','fortnite','call of duty',
  'recipe','cooking','restaurant review','travel guide','vacation','hotel review',
  // 건강/생활
  'weight loss','fitness','workout','yoga','meditation','skincare','beauty',
  'horoscope','zodiac','astrology','weather forecast','pollen count',
  // 범죄/사건 (금융 무관)
  'murder','homicide','kidnapping','robbery','assault','shooting suspect',
  'car crash','traffic accident','wildfire','flood damage','tornado',
  'missing person','fugitive','manhunt','drug bust','drug trafficking',
  // v39.0: 한국어 셀럽/비금융 보강
  '카다시안','유명 모델','약물 운전','음주 단속','전용기','사생활','열애설',
  // 크립토 스팸 (Price Prediction 기사 완전 차단)
  'price prediction','price forecast 2025','price forecast 2026','price forecast 2027',
  'price prediction 2025','price prediction 2026','price prediction 2027','price prediction 2030',
  'could reach $','can reach $','will reach $','might reach $',
  // v48.20 (integrate): 2026년 AI 클릭베이트 패턴 보강
  'ai stock to buy now','next ai winner','ai stock of the decade','ai stock of the year',
  '100x ai stock','ai millionaire','quantum stock to buy','ai picks under $',
  'ai 황제주','ai 대박주','ai 차세대 황제','양자 대장주','암호화폐 무료',
  'should you buy','is it a good investment','worth buying',
  'meme coin','memecoin','shiba','dogecoin','pepe coin','floki',
  'airdrop','free tokens','crypto giveaway','pump and dump',
  // v30.12 P3: 정치/선거 (금융 무관) — 경제정책은 MACRO_KW에서 별도 처리
  '대선','총선','보궐선거','국회의원','지방선거','후보자','공천','당대표','정당','여당','야당',
  '탄핵','국정감사','청문회','의원','국회','개헌','선거법',
  'presidential election','midterm election','campaign rally','political party','senator','congressman',
  'primary election','ballot','voting results','gubernatorial',
  // v30.12: 종교/문화/교육 (금융 무관)
  '교회','사찰','성당','목사','스님','종교','예배','미사','법회',
  '수능','입시','대학교','학교','교사','교수','학원','과외',
  '축제','전시회','공연','뮤지컬','오페라','클래식',
  'church','mosque','temple','pastor','sermon','worship',
  'school shooting','campus','graduation','university ranking','homework',
  // v30.12: 스포츠 보강 (기존 누락)
  'mls','pga','ufc','wwe','formula 1','f1 race','grand prix','wimbledon','us open tennis',
  'world series','stanley cup','champions trophy','cricket','rugby','golf tournament',
  '월드컵','프리미어리그','챔피언스리그','메시','호날두','손흥민','EPL','KBO','K리그',
  // ── v31.8: 블랙리스트 대폭 강화 — 비금융 콘텐츠 근본 차단
  // 건강/의료 (금융 무관 — 바이오 기업 뉴스는 MED_KW에서 처리)
  'diet plan','weight management','home remedy','natural cure','herbal supplement',
  'mental health tips','stress relief','sleep tips','wellness routine','self care',
  '건강법','민간요법','다이어트 식단','운동법','스트레칭','명상법',
  // 라이프스타일/쇼핑
  'best deals','coupon code','discount code','flash sale','black friday deals',
  'product unboxing','haul video','outfit of the day','home decor','interior design',
  'pet care','dog training','cat breeds','gardening tips','diy project',
  '쿠폰','할인코드','언박싱','인테리어','반려동물','펫케어','원예',
  // 소셜미디어/인터넷 문화
  'viral video','meme','trending topic','social media drama','twitter drama',
  'youtuber','streamer','content creator','subscriber count','views milestone',
  '바이럴','밈','트렌딩','유튜버','스트리머','구독자',
  // 자동차 리뷰 (EV/자동차 산업 뉴스는 MED_KW에서 처리)
  'car review','test drive review','suv review','sedan review','mpg rating',
  'best cars 2025','best cars 2026','car buying guide','used car',
  '차량 리뷰','시승기','연비 비교','중고차 시세',
  // 음식/요리 (산업 뉴스는 별도)
  'recipe','cooking tips','meal prep','food review','restaurant review',
  'best restaurants','michelin star','food trend','baking',
  '레시피','요리법','맛집 추천','밀프렙','베이킹',
  // 여행 (산업 뉴스는 별도)
  'travel tips','packing tips','flight deals','hotel deals','travel itinerary',
  'backpacking','solo travel','road trip','tourist attraction',
  '여행 팁','항공권 할인','호텔 추천','배낭여행','관광지',
  // 교육/학술 (금융 무관)
  'study tips','exam preparation','scholarship','online course','tutorial',
  'how to learn','language learning','coding tutorial','beginner guide',
  '공부법','시험 준비','장학금','온라인 강좌','학습법',
  // 날씨/자연재해 (시장 영향 없는 일반 보도)
  'weather update','weather alert','storm warning','hurricane watch',
  'earthquake','volcanic eruption','tsunami warning','climate change opinion',
  '일기예보','기상특보','태풍 경로','지진 속보',
  // 정치 인물/선거 캠페인 (경제정책은 MACRO_KW에서 처리)
  'campaign speech','political rally','endorsement','primary debate',
  'voter turnout','swing state','battleground','midterm results',
  '유세','지지율 조사','당내 경선','정치 스캔들',
  // ── v34.1: 지역/지방 뉴스 근본 차단 — 투자와 무관한 한국 지역 뉴스 완전 제거
  // 지방자치/행정 (금융 무관)
  '시장이','군수','구청장','도지사','면장','읍장','동장','이장',
  '시의회','군의회','구의회','도의회','지방의회','지방자치',
  '시청','군청','구청','도청','주민센터','행정복지센터',
  '조례','행정처분','민원','주민설명회','공청회',
  // 지역 개발/인프라 (금융 무관)
  '새만금','혁신도시','세종시','행정수도','지역균형',
  '도시재생','마을만들기','주민참여예산','지역화폐','지역상품권',
  '상공인','소상공인','자영업자','전통시장','골목상권',
  '지역축제','마을축제','문화행사','주민행사',
  // 지방 생활/복지 (금융 무관)
  '어르신','노인정','경로당','노인복지','노인일자리',
  '보건소','건강센터','치매센터','장애인복지','사회복지',
  '어린이집','유치원','돌봄센터','방과후','학교급식',
  '종량제','분리수거','쓰레기','폐기물','환경미화','하수처리',
  '청소년센터','도서관','문화센터','체육시설','공원조성',
  '신중년','일자리센터','고용센터','직업훈련',
  '의료 소외','보건의료','응급의료','의료취약',
  // 지역 교통/도로 (금융 무관)
  '시내버스','마을버스','노선변경','정류장','도로확장','교차로',
  '주차장','신호등','횡단보도','보행자','자전거도로',
  // 영양/식품 안전 (금융 무관)
  '영양정보','식품안전','급식','식약처','위생점검',
  '식중독','불량식품','유통기한','원산지표시',
  // 지역 사건/인물 프로필 (금융 무관)
  '청암히어로','모범시민','자원봉사','봉사활동','나눔','기부금',
  '현충원','참배','추도식','기념식','기공식','준공식','개관식',
  '장학재단','포스코청암','시상식','공로상','표창',
  // 선거구/지역 정치 (금융 무관)
  '지역구','출마','예비후보','공천','당협위원장',
  // ── v34.1b: 한국 지방정부/행정 기사 근본 차단 (수출·기업·에너지 등 광범위 키워드 오탐 방지)
  // 광역·기초 자치단체 + 행정 행위 (금융 무관)
  '강원도,','전남도,','경남도,','충남도,','충북도,','경북도,','전북도,','제주도,',
  '강원도 ','전남도 ','경남도 ','충남도 ','충북도 ','경북도 ','전북도 ','제주도 ',
  '울주군','울산시','울릉군','양양군','횡성군','평창군','정선군','영월군','태백시',
  '합천군','산청군','하동군','남해군','거창군','함양군','의령군','창녕군',
  '영광군','장성군','담양군','곡성군','구례군','보성군','고흥군','장흥군','강진군',
  '해남군','완도군','진도군','무안군','신안군','함평군','영암군','나주시',
  '업무협약','양해각서','MOU 체결','MOU체결','협력 체결','협약식','체결식',
  '어촌뉴딜','농촌뉴딜','도시뉴딜','지역뉴딜',
  '일자리 창출','고용 창출','일자리사업','공공근로','희망근로',
  '선착순 모집','참가자 모집','수강생 모집','교육생 모집',
  '비즈니스 매칭','상담회','수출상담','비즈매칭',
  '건강음료','배달사업','돌봄사업','돌봄서비스',
  '행정 지원','행정지원','세무 지원','세무지원','지방세 감면','지방세 지원',
  // 지역 인사/임명/기관 (금융 무관)
  '[인사]','인사이동','보직변경','전보발령','승진자 명단',
  '3연임','연임 성공','취임식','이취임식','퇴임식',
  // 지방정부 예산/계획 (매크로 재정정책과 구분 — 지역 단위)
  '세부계획 공시','시행계획','지역계획','추진계획 발표',
  '지역경제 활성화','지역 활성화','상권 활성화','마을 활성화',
  // 한국 순수 국내 사회/생활 (금융 문맥 공존 불가)
  // 주의: 정치 키워드(대통령, 장관, 국회 등)는 제거함 — 금융 정책 뉴스와 공존 가능하므로
  // → STEP 2 금융 관련성 게이트에서 컨텍스트로 판단
  '학부모','교육감','교육청',
  // 영문 순수 사회 이슈 (금융 문맥 공존 불가)
  'gun control','abortion rights','lgbtq rights',
  'school shooting','mass shooting',
  // ── v38.3 B4: 비금융 한국 뉴스 추가 차단 (보험/카드/CSR/인사/부동산 등)
  // 보험/카드 상품 (금융 산업 뉴스와 구분 — 개인 상품 광고성)
  '보험료 인상','보험료 인하','보험 가입','보험금 청구','보험 상품','보험설계사',
  '카드 혜택','신용카드 추천','카드 포인트','카드 할인','연회비',
  // CSR/ESG 보도자료 (투자 판단 무관)
  '사회공헌','봉사단','나눔활동','기부금 전달','장학금 수여','사랑나눔',
  // 기업 인사/임명 (시장 영향 없는 중간관리직)
  '부장 승진','차장 승진','과장 승진','대리 승진','인사발령','보직 이동',
  '신입사원','공채','채용설명회','인턴 모집',
  // 법원/소송 (금융 무관 민사)
  '이혼 소송','양육권','상속 분쟁','임대차 분쟁','층간소음',
  // 군사/안보 (방산주 뉴스는 별도 처리)
  '훈련 실시','군사 훈련','합동 훈련',
  // 생활 경제 팁 (투자 무관)
  '절약법','가계부','용돈','저축 습관','짠테크',
  // ── v39.2: 투자 스팸/클릭베이트/광고성 기사 근본 차단
  // 한국어 투자 스팸 (주식 추천 사이트/네이버 카페/블로그 광고)
  '10배','100배','1000배','대박주','급등주','텐배거',
  '이 주식만','이 종목만','반드시 사야','무조건 사야','지금 안 사면',
  '놓치면 후회','지금이 마지막','마지막 기회','급등 임박','폭등 예고',
  '찐 추천','오늘의 추천주','무료 추천','종목 추천','리딩방','시크릿 종목',
  '수익률 보장','수익 보장','원금 보장','확실한 수익','100% 수익',
  '비밀 종목','숨겨진 종목','아무도 모르는','전문가만 아는',
  '단타 종목','스캘핑 종목','오늘의 급등','내일 급등',
  '주식 부자','주식으로 퇴사','주식으로 은퇴','파이어족 종목',
  '삼성 잡는','애플 잡는','엔비디아 잡는',
  '테마주 추천','급등 테마','대장주 추천','황제주','슈퍼개미',
  // 영문 투자 스팸/클릭베이트
  'best stock to buy now','best stocks to buy','stocks to buy now',
  'buy this stock','buy before it','next 10x','next 100x','next tesla','next nvidia',
  'millionaire maker','make you rich','retire early with','get rich',
  'this stock will','hidden gem stock','secret stock','under the radar',
  'penny stock','penny stocks to buy','small cap gem',
  'must buy stock','guaranteed return','risk free','easy money',
  'wall street bets','yolo stock','diamond hands','to the moon',
  'stock alert','stock pick','stock tip','free stock pick',
  '10x potential','100x potential','massive upside','explosive growth potential',
  'you won\'t believe','don\'t miss this','last chance to buy',
  'insiders are buying','smart money is','hedge funds are',
];

// 토픽 키워드 분류
const TOPIC_KEYWORDS = {
  macro:    ['Fed','FOMC','rate','CPI','PCE','GDP','inflation','deflation','recession','treasury','bond','yield curve',
              'dollar','DXY','yen','euro','yuan','tariff','trade war','sanction','export ban','reciprocal tariff','Section 301','de minimis','USMCA','customs duty','상호관세','보복관세','관세율','무역분쟁',
              '금리','인플레','경기침체','환율','채권',
              'monetary policy','fiscal','stimulus','quantitative easing','quantitative tightening','central bank','beige book','dot plot','jackson hole',
              'PMI','ISM','consumer confidence','retail sales','industrial production','nonfarm','payroll','employment','unemployment',
              '통화정책','재정','소비자물가','생산자물가','고용','실업률','경상수지','무역수지','한국은행','금통위',
              'ECB','BOJ','BOE','PBOC','BOK','RBA',
              // v39.2: JP모건 유가/크로스에셋
              'oil shock','demand destruction','gasoline price','K-shaped','stagflation',
              'quality growth','cross-asset','energy exporter','energy importer','relief rally',
              'bear flattener','term structure','유가 충격','수요 파괴','스태그플레이션','K자형',
              // v48.16 (integrate 2026-04-18): 데이터센터 규제·주 정책 + 통화정책 체계 전환
              'data center ban','DC moratorium','data center regulation','grid connection delay',
              'Maine DC','Virginia DC','Ohio DC','state moratorium','DC siting',
              'data dependence','forward guidance failure','2% inflation target','mid-inflation',
              '데이터센터 금지','DC 규제','전력망 부하','주 정책','모라토리엄',
              '중물가','2% 물가목표','평균물가목표','데이터 디펜던스'],
  geo:      ['war','attack','sanction','geopolitical','conflict','military','missile','iran','russia','ukraine','china',
              'taiwan','north korea','nato','전쟁','지정학','분쟁','미중','한반도',
              'Red Sea','Houthi','Suez','Panama Canal','shipping disruption','embargo','SWIFT',
              'Taiwan Strait','South China Sea','AUKUS','nuclear','ICBM','hypersonic',
              'rare earth','critical minerals','chip war','tech decoupling','friendshoring','nearshoring',
              '홍해','후티','수에즈','대만해협','남중국해','기술패권','디커플링','핵심광물','희토류',
              'ceasefire','escalation','airstrike','invasion','defense spending',
              // v37.2: 중동 전쟁·지정학 키워드 보강
              'israel','lebanon','hezbollah','hormuz','strait','blockade','CENTCOM','drone','drone strike',
              'IRGC','proxy','oil tanker','tanker seizure','shipping lane','oil embargo',
              '이란','이스라엘','레바논','헤즈볼라','호르무즈','봉쇄','공습','드론','유조선','해상봉쇄'],
  semi:     ['semiconductor','chip','AI','GPU','HBM','TSMC','NVDA','AMD','AVGO','SMCI','memory','foundry',
              'Blackwell','H100','H200','CoWoS','EUV','ASML','반도체','파운드리','HBM',
              'wafer','fab','advanced packaging','chiplet','2nm','3nm','1.4nm','GAA',
              'DRAM','NAND','DDR5','CXL','AI server','data center','hyperscaler',
              'AI accelerator','inference','training','AI infrastructure','AI spending',
              'Micron','Intel','Qualcomm','Broadcom','Marvell','ARM','Samsung foundry','SK Hynix',
              '삼성전자','SK하이닉스','AI 서버','데이터센터','웨이퍼','선단공정','메모리',
              // v37.6: 첨단패키징·인터커넥트·AI신패러다임
              'CPO','co-packaged optics','silicon photonics','glass substrate','유리기판','광패키징',
              'BSPDN','backside power','interposer','HBM4','HBM3E',
              'agentic AI','에이전틱AI','multi-agent','reasoning model','on-device AI','AI PC',
              'sovereign AI','소버린AI','custom silicon','ASIC','Trainium','Inferentia',
              'liquid cooling','immersion cooling','액침냉각','수냉',
              'InfiniBand','NVLink','Ultra Ethernet',
              // v39.2: 메모리 CapEx/HBM/AGI (SemiAnalysis/AMD/Altman)
              'HBM sold out','HBM shortage','HBM4E','custom HBM','memory CapEx',
              'DRAM price','LPDDR5','memory inflation','memory supercycle',
              'VVP pricing','server price increase','B200 server',
              'AGI timeline','automated researcher','compute crunch','Sora',
              'data sovereignty','데이터 주권',
              'HBM 매진','메모리 인플레이션','메모리 CapEx','서버 가격 인상',
              '휴머노이드','humanoid','Figure','Optimus',
              // v37.3: 메가캡 테크 · AI 기업 · 주요 이벤트
              'NVIDIA','Apple','AAPL','Microsoft','MSFT','Google','GOOGL','Alphabet','Amazon','AMZN',
              'Meta','META','Tesla','TSLA','GTC','WWDC','Google I/O','Build','re:Invent','CES',
              'OpenAI','ChatGPT','GPT','Anthropic','Claude','xAI','Grok','Mistral','Perplexity',
              'FSD','Robotaxi','Optimus','Terafab','Vision Pro','Copilot','AWS','Azure',
              'LLM','large language model','foundation model','AGI',
              '엔비디아','테슬라','애플','마이크로소프트','구글','아마존','메타',
              '오픈AI','앤트로픽','자율주행','로보택시','비전프로',
              // v48.16 (integrate 2026-04-18): 커스텀 실리콘 + 광학 + 신규 AI 이벤트
              'MTIA','Meta MTIA','Rubin CPX','Vera Rubin','NVLink Fusion','CX9',
              'HBF','high bandwidth flash','DustPhotonics','ZR optical','x402',
              'Google Cloud Next','Google I/O','Marketing Live','Brandcast','Ask Maps',
              'Search Live','Personal Intelligence','OpenAI TAC','Project Glasswing','Trust Access',
              // 위성통신·D2D·LEO (Globalstar/AMZN LEO 보강)
              'satellite','D2D','Direct-to-Device','LEO','low earth orbit','SpaceX Starlink',
              'Globalstar','Amazon LEO','Project Kuiper','spectrum allocation',
              '위성통신','위성 인프라','저궤도','스페이스X'],
  earnings: ['earnings','EPS','revenue','guidance','quarterly','beat','miss','Q1','Q2','Q3','Q4','실적','가이던스',
              'profit','net income','operating income','margin','outlook','forecast','consensus','estimate',
              'revenue growth','earnings surprise','earnings call','conference call','10-K','10-Q',
              '매출','영업이익','순이익','컨센서스','전망','실적 발표','어닝'],
  energy:   ['oil','brent','WTI','OPEC','LNG','gas','crude','energy','원유','천연가스','에너지',
              'refinery','pipeline','drilling','shale','offshore','upstream','downstream','midstream',
              'oil supply','oil demand','oil inventory','SPR','strategic petroleum','OPEC+',
              'natural gas','Henry Hub','TTF','coal','carbon','emission','carbon credit',
              'nuclear','uranium','SMR','solar','wind','renewable','clean energy','hydrogen',
              // v37.6: 데이터센터 전력·EV 800V·배터리
              'data center power','AI power demand','nuclear data center','grid infrastructure',
              '800V','SiC','solid state battery','LFP','sodium-ion','EV battery',
              'liquid cooling','immersion cooling','power density',
              '정유','시추','셰일','원전','우라늄','태양광','풍력','수소','재생에너지',
              '데이터센터전력','800V','전고체배터리','액침냉각','전력반도체'],
  crypto:   ['bitcoin','BTC','ETH','crypto','blockchain','defi','NFT','코인','비트코인',
              'stablecoin','USDT','USDC','mining','hashrate','halving','on-chain',
              'crypto ETF','spot ETF','futures ETF','Coinbase','Binance',
              'DeFi','DEX','TVL','staking','validator','layer 2','rollup',
              'SEC crypto','crypto regulation','MiCA',
              '이더리움','솔라나','스테이블코인','채굴','온체인','디파이','크립토 ETF'],
  analyst:  ['price target','target price','upgrades to','downgrades to','initiates coverage','overweight','underweight',
              'buy rating','sell rating','목표주가','투자의견'],
  // ── v31.8: 신규 토픽 추가
  bond:     ['bond','treasury','yield','credit spread','investment grade','high yield','junk bond',
              'corporate bond','sovereign bond','municipal bond','TIPS','TLT','HYG','LQD',
              'duration','convexity','coupon','maturity','issuance','auction',
              '채권','국채','회사채','하이일드','크레딧','스프레드','듀레이션','국고채','금리'],
  fx:       ['forex','FX','currency','exchange rate','dollar index','DXY',
              'USD/JPY','EUR/USD','GBP/USD','USD/KRW','USD/CNY',
              'carry trade','intervention','capital flow','hot money',
              'devaluation','revaluation','peg','float',
              '환율','원달러','엔달러','유로달러','위안','캐리트레이드','외환','외환보유고'],
  defense:  ['defense','defence','military','weapon','arms','missile','fighter jet',
              'Lockheed','Raytheon','Northrop','General Dynamics','BAE','Boeing defense',
              'NATO','defense budget','defense spending','arms deal','procurement',
              'space','satellite','rocket','launch','SpaceX','Rocket Lab',
              // v37.6: 골든돔·드론방어·우주방위
              'Golden Dome','Iron Dome','missile defense','missile shield','hypersonic defense',
              'drone defense','counter-drone','directed energy','laser weapon','space defense',
              'DARPA','AUKUS','Palantir defense','Anduril','Shield AI',
              // v39.2: 트럼프 FY2027 국방예산 $1.5T
              'FY2027','defense budget','national defense','defense wish list',
              'Virginia-class','submarine','F-35 procurement','weapons production',
              'Indo-Pacific','munitions','stockpile','무기 재고','국방예산','버지니아급',
              '골든돔','아이언돔','미사일방어','극초음속방어','드론방어','레이저무기','우주방위',
              '방산','방위산업','무기','군수','한화에어로','한국항공우주','LIG넥스원',
              '우주','위성','발사체','로켓'],
  equity:   ['stock','share','equity','index','rally','sell-off','correction','bull market','bear market',
              'market cap','IPO','buyback','dividend','split','listing',
              'S&P 500','Nasdaq','Dow','Russell','KOSPI','KOSDAQ',
              '주식','주가','시장','상승','하락','급등','급락','시가총액','상장',
              '코스피','코스닥','나스닥','다우',
              // v37.3: 기업 이벤트 · 금융 기업 보강
              'acquisition','merger','M&A','antitrust','DOJ','FTC',
              'product launch','keynote','investor day','analyst day',
              'CEO','management change','restructuring','layoff','cost cutting',
              'JPMorgan','Goldman Sachs','Morgan Stanley','Bank of America','Citigroup',
              'Berkshire','Buffett','Netflix','NFLX','Disney','DIS','Uber','UBER','Airbnb','ABNB',
              'Visa','Mastercard','Salesforce','CrowdStrike','Palantir','Snowflake',
              '인수합병','경영권','구조조정','해고','인원감축',
              'JP모건','골드만삭스','버크셔','버핏','넷플릭스','디즈니'],
  // ── v37.7: 헬스케어/바이오 토픽 신설
  healthcare:['GLP-1','Wegovy','Ozempic','Mounjaro','Zepbound','semaglutide','tirzepatide',
              'obesity drug','weight loss drug','anti-obesity','oral GLP-1',
              'Novo Nordisk','NVO','Eli Lilly','LLY','Amgen',
              'ADC','antibody drug conjugate','bispecific','CAR-T','cell therapy','gene therapy',
              'mRNA','CRISPR','gene editing','RNA therapeutics','biosimilar',
              'FDA','FDA approval','clinical trial','Phase 3','PDUFA','NDA','BLA',
              'oncology','immunotherapy','PD-1','checkpoint inhibitor','orphan drug',
              'drug pricing','patent cliff','loss of exclusivity',
              'biotech','pharmaceutical','pharma M&A',
              '비만치료제','GLP-1','위고비','오젬픽','마운자로',
              '바이오','신약','임상','FDA','식약처','바이오시밀러',
              '항체약물접합체','ADC','이중항체','CAR-T','세포치료','유전자치료',
              '알테오젠','에이비엘바이오','삼성바이오로직스','셀트리온'],
  // ── v37.7: 조선·해운 토픽 신설
  shipbuilding:['shipbuilding','shipyard','newbuild','vessel','order book',
              'LNG carrier','tanker','container ship','bulk carrier',
              'warship','naval vessel','frigate','destroyer','submarine',
              'HD Hyundai','Hanwha Ocean','Samsung Heavy',
              'shipping','freight rate','BDI','Baltic Dry','SCFI','container rate',
              'IMO','decarbonization','LNG bunkering','methanol fuel','ammonia fuel',
              '조선','LNG선','컨테이너선','벌크선','해운','군함','수주',
              'HD현대중공업','한화오션','삼성중공업','HD현대미포',
              '해운운임','BDI','친환경선박','메탄올추진','암모니아추진'],
  // ── v37.7: 우주·위성 토픽 신설
  space:    ['space','satellite','LEO','low earth orbit','Starlink','SpaceX',
              'Rocket Lab','RKLB','Blue Origin','AST SpaceMobile','ASTS',
              'Iridium','Globalstar','Planet Labs','L3Harris','Northrop Grumman',
              'launch','rocket','orbit','space station','space economy',
              'direct-to-cell','satellite internet','satellite constellation',
              'space debris','space defense','DARPA','Space Force',
              '우주','위성','발사체','저궤도','스타링크','우주경제',
              '누리호','우주항공청','우주방위'],
  // ── v37.7: 양자컴퓨팅 토픽 신설
  quantum:  ['quantum computing','quantum computer','qubit','quantum advantage',
              'quantum supremacy','quantum error correction','topological qubit',
              'IONQ','IonQ','Rigetti','D-Wave','IBM Quantum','Google Willow','Quantinuum',
              'quantum networking','quantum cryptography','post-quantum','PQC',
              '양자컴퓨팅','양자컴퓨터','큐비트','양자우위','양자암호'],
};

// v29.1: 금융 관련성 화이트리스트 키워드 — 비금융 소스에서 이 중 하나라도 있어야 통과
const _FINANCE_RELEVANCE_KW = [
  // 시장/경제
  'stock','market','share','equity','index','dow','s&p','nasdaq','russell',
  'bull','bear','rally','selloff','sell-off','correction','crash','surge','plunge',
  'investor','portfolio','fund','etf','hedge fund','mutual fund',
  'ipo','m&a','merger','acquisition','buyback','dividend','split',
  'earnings','revenue','profit','loss','guidance','forecast','outlook','quarter',
  'valuation','p/e','market cap','billion','million','trillion',
  // 금융/은행/채권
  'bank','bond','treasury','yield','credit','debt','loan','lending','default',
  'fed','rate','interest rate','monetary','fiscal','stimulus','qe','qt',
  'inflation','deflation','cpi','pce','gdp','employment','payroll','unemployment',
  // 섹터
  'semiconductor','chip','foundry','wafer','fab','hbm','dram','nand','memory',
  'oil','crude','brent','opec','lng','natural gas','commodity','gold','copper',
  'bitcoin','crypto','blockchain','defi','mining',
  'ev ','electric vehicle','battery','solar','renewable',
  'pharma','biotech','fda','drug approval','clinical trial',
  // 기업/분석
  'ceo','cfo','board','shareholder','analyst','upgrade','downgrade','price target',
  'revenue growth','profit margin','operating income','free cash flow',
  'supply chain','trade war','tariff','sanction','export ban','regulation',
  // ── v31.8: 채권·금리·통화 심화
  'yield curve','credit spread','investment grade','high yield','junk bond',
  'corporate bond','sovereign','municipal bond','duration','convexity',
  'coupon','maturity','issuance','auction','repo','reverse repo',
  'money market','commercial paper','certificate of deposit',
  'central bank','monetary policy','rate cut','rate hike','pivot',
  'quantitative','tightening','easing','tapering','balance sheet',
  'currency','forex','fx','exchange rate','dollar index','dxy',
  'carry trade','intervention','capital flow','devaluation',
  // ── v31.8: 기업 이벤트 심화
  'insider buying','insider selling','13f','sec filing','proxy','activist',
  'spin-off','spinoff','divestiture','restructuring','bankruptcy','chapter 11',
  'share repurchase','tender offer','secondary offering','shelf registration',
  'lockup','pipe deal','warrant','convertible','preferred',
  'credit rating','moody','fitch','s&p rating','rating change',
  'capex','r&d','opex','sgna','gross margin','operating margin','net margin',
  'ebitda','fcf','roic','roe','roa','roce',
  'backlog','order book','bookings','pipeline','contract win','contract award',
  'index inclusion','rebalancing','reconstitution',
  // ── v31.8: 방산/우주/에너지전환
  'defense','defence','military','weapon','arms deal','defense budget',
  'space','satellite','rocket','launch vehicle',
  'nuclear','uranium','smr','solar panel','wind turbine','hydrogen',
  'ev battery','lithium','cobalt','nickel','cathode','solid state',
  'carbon credit','emission','esg','sustainability',
  // ── v31.8: 지정학 → 시장 영향
  'geopolitical','war','conflict','escalation','ceasefire','sanction',
  'embargo','blockade','strait','shipping disruption','supply disruption',
  'rare earth','critical mineral','export control','chip ban',
  'friendshoring','nearshoring','reshoring','decoupling',
  // ── v31.8: 시장 구조
  'short interest','short squeeze','gamma squeeze','options expiration','opex',
  'dark pool','market maker','dealer','liquidity','bid-ask spread',
  'volatility','vix','implied volatility','realized volatility',
  'futures','options','derivatives','swap','forward','hedging',
  'margin','leverage','deleveraging','risk-off','risk-on',
  'passive','active','flow','inflow','outflow','rotation',
  'breadth','advance-decline','new high','new low','oversold','overbought',
  // 한국어 — 대폭 확장
  '주식','시장','주가','코스피','코스닥','투자','펀드','매출','이익','수익',
  '금리','채권','은행','대출','금융','경제','산업','수출','수입','무역',
  '반도체','배터리','전기차','바이오','제약','원유','에너지',
  // ── v31.8: 한국어 심화
  '환율','원달러','달러인덱스','엔화','위안화',
  '국채','회사채','하이일드','크레딧','스프레드','듀레이션',
  '한국은행','금통위','기준금리','통화정책',
  '실적','영업이익','순이익','가이던스','컨센서스','어닝',
  '자사주','배당','증자','감자','공개매수','인수합병',
  '공매도','대차잔고','신용잔고','외국인','기관','수급',
  '방산','군수','조선','원전','우라늄','수소','태양광','풍력',
  '2차전지','리튬','양극재','음극재','분리막','전해질',
  'AI','인공지능','데이터센터','클라우드','서버','GPU',
  '금','은','구리','철광석','원자재','선물','옵션',
  '펀더멘털','밸류에이션','PER','PBR','ROE','시가총액',
  '상장','IPO','스팩','SPAC','상장폐지',
  '지정학','전쟁','제재','수출규제','공급망',
  '경기','침체','호황','회복','둔화','성장',
  '물가','인플레','디플레','스태그플레이션',
];

// ── 시간창(Time Window) 설정 ─────────────────────────────────────
// 섹션별 뉴스 노출 기간 (단위: 시간)
// v30.12 P5: 시간창 조정 — 홈 7일→48시간, 시장 3일→48시간 (stale 뉴스 제거)
const TW_HOME_H     = 48;    // 대시보드 상단: 48시간 (기존 168→48)
const TW_MARKET_H   = 48;    // v40.4: 시장 소식: 48시간 — 과부하 방지 + 브리핑(24h)보다 넓은 커버리지
const TW_BRIEFING_H = 24;    // 데일리 브리핑: 24시간 이내 (유지)

// pubDate 기반 나이 필터 (pubDate 없으면 최신으로 간주)
function filterByAge(items, maxHours) {
  if (!maxHours || !items) return items || [];
  const cutoff = Date.now() - maxHours * 3600000;
  return items.filter(i => {
    if (!i.pubDate) return true;
    const t = new Date(i.pubDate).getTime();
    return isNaN(t) ? true : t >= cutoff;
  });
}

// ═══════════════════════════════════════════════════════════════
// v20: 기관급 뉴스 선별 엔진 (scoreItem + classifyTopic + render)
// ═══════════════════════════════════════════════════════════════

/* ── scoreItem(): 뉴스 중요도 스코어링 (0~100+) ────────────────
   기관 리서치 데스크 기준:
   1) 키워드 매칭 (매크로 > 테크 > 실적 > 분석)
   2) 소스 신뢰도 (Tier 가중치)
   3) 신선도 (시간 감쇄)
   4) 티커 언급 부스트
   5) 중복/스팸 패널티
   ─────────────────────────────────────────────────────────── */
function scoreItem(item) {
  let score = 0;
  const text = ((item.title || '') + ' ' + (item.desc || '')).toLowerCase();

  // ── 1. 키워드 매칭 점수 (v42.5: 제목 가중치 + 키워드 길이 가중치) ──────
  let macroHits = 0, techHits = 0, medHits = 0, analystHits = 0;
  const _titleLow = (item.title || '').toLowerCase();
  const _descLow  = (item.desc  || '').toLowerCase();

  // v46.6: 키워드 길이 가중치 — CJK 2글자 상향 (한국어 '금리'='interest rate' 동등)
  // 영문: 1글자=0.3, 2글자=0.6, 3-4글자=1.0, 5글자+=1.3
  // CJK: 1글자=0.5, 2글자=0.9, 3글자+=1.0 (정보밀도 보정)
  function _kwLen(kw) {
    var l = kw.length;
    var isCJK = /[\uAC00-\uD7AF\u4E00-\u9FFF\u3040-\u30FF]/.test(kw);
    if (isCJK) return l <= 1 ? 0.5 : l <= 2 ? 0.9 : 1.0;
    return l <= 1 ? 0.3 : l <= 2 ? 0.6 : l <= 4 ? 1.0 : 1.3;
  }
  // 제목 발견 시 1.5배 가중 — 제목 키워드가 본문보다 핵심 토픽임
  function _kwHit(kw, tl, dl) {
    var kwl = kw.toLowerCase(), w = _kwLen(kw);
    if (tl.includes(kwl)) return w * 1.5; // 제목 히트
    if (dl.includes(kwl)) return w;        // 본문 히트
    return 0;
  }

  MACRO_KW.forEach(kw   => { macroHits   += _kwHit(kw, _titleLow, _descLow); });
  TECH_KW.forEach(kw    => { techHits    += _kwHit(kw, _titleLow, _descLow); });
  MED_KW.forEach(kw     => { medHits     += _kwHit(kw, _titleLow, _descLow); });
  ANALYST_KW.forEach(kw => { analystHits += _kwHit(kw, _titleLow, _descLow); });

  // v30.12 P2: 로그 스케일 + 밀도 기반 점수 (키워드 나열 역전 방지)
  // 첫 1~2개 키워드에서 대부분의 점수, 이후 체감 증가
  score += Math.min(Math.round(Math.log2(macroHits + 1) * 16), 40);   // 1→16, 2→25, 4→32, 8→40
  score += Math.min(Math.round(Math.log2(techHits + 1) * 12), 30);    // 1→12, 2→19, 4→24
  score += Math.min(Math.round(Math.log2(medHits + 1) * 6), 15);      // 1→6, 2→10, 4→12
  // v43.4: 애널리스트 패널티 제거 → 소폭 보너스 (목표주가/등급 변경은 투자 정보)
  // 대형주 추가 부스트는 티커 검출 후 처리 (아래 섹션)
  score += Math.min(analystHits, 1) * 3;  // 최대 +3 (작게 유지 — 소형주 노이즈 방지)

  // v30.12: 키워드 밀도 보너스 — 짧은 텍스트에 핵심 키워드 집중 = 높은 점수
  var totalHits = macroHits + techHits + medHits;
  var wordCount = text.split(/\s+/).length;
  if (wordCount > 0 && totalHits > 0) {
    var density = totalHits / wordCount;
    if (density > 0.15) score += 5;       // 매우 집중적 (예: "Fed rate cut CPI inflation")
    else if (density > 0.05) score += 2;  // 적당한 밀도
    // 낮은 밀도(< 0.05)는 보너스 없음 — 키워드 나열 기사 불이익
  }

  // ── 2. 소스 신뢰도 가중치 ──────────────────────────────
  const tierBonus = { 1: 15, 2: 8, 3: 3 };
  score += tierBonus[item.tier] || 0;

  // 프리미엄 소스 추가 부스트
  const premiumSources = ['Reuters','Bloomberg','WSJ','CNBC','MarketWatch','FT Markets','S&P Global','Barrons',
    'CNN','NYT','BBC','Seeking Alpha','Yahoo Finance','Investing.com','Benzinga','The Block','Defense One',
    'Nikkei Asia','SCMP','AP Business','Nasdaq','Forbes','Business Insider','Morningstar','The Economist',
    'Kitco','DL News','CoinDesk','SemiAnalysis','TrendForce','Digitimes','EE Times'];
  if (premiumSources.some(s => (item.source || '').includes(s))) score += 5;

  // v34.1c: 미국 주식 시장 중심 스크리너 — 소스 계층 부스트
  // US Tier1 외신 최우선, 한국은 콘텐츠 품질로만 판단
  if (item.country === 'us' && item.tier === 1) score += 12;
  else if (item.country !== 'kr' && item.tier === 1) score += 8;
  else if (item.country !== 'kr' && item.tier === 2) score += 4;
  // v46.6: 한국 Tier 2 소스 소폭 부스트 (기존: 0) — US 편향 완화
  // 한국 Tier 1 (연합, 한경, 매경)은 이미 tierBonus=15로 충분
  if (item.country === 'kr' && item.tier === 2) score += 3;
  // v38.3 B3: 한국 Tier 3 소스 감점 — 비금융 기사 유입 가능성 높은 소스
  if (item.country === 'kr' && item.tier === 3) score -= 5;

  // v34.1c: 대형주/대장주/주도주 티커 부스트 시스템
  // 시장을 주도하는 핵심 종목에 대한 뉴스를 우선 노출
  const _MEGA_TICKERS = new Set([
    // US Mega Cap (시총 $500B+)
    'AAPL','MSFT','NVDA','GOOGL','GOOG','AMZN','META','TSLA','BRK.B','AVGO',
    'LLY','JPM','V','UNH','MA','XOM','COST','HD','PG','JNJ',
    // US 주도주/테마 대장주
    'AMD','SMCI','ARM','PLTR','MRVL','MU','QCOM','INTC','TSM','ASML',
    'COIN','MSTR','SQ','CRWD','SNOW','NET','DDOG','ZS','PANW',
    'LMT','RTX','NOC','GD','BA','HII','LHX',
    // 핵심 ETF/지수
    'SPY','QQQ','DIA','IWM','SOXX','SMH','XLE','XLF','XLK','GLD','TLT','VIX',
    // 한국 대장주
    '삼성전자','SK하이닉스','현대차','LG에너지솔루션','삼성바이오로직스','POSCO홀딩스',
    'NAVER','카카오','셀트리온','기아','한화에어로스페이스',
  ]);
  const _LARGE_TICKERS = new Set([
    'ORCL','CRM','ADBE','NOW','UBER','ABNB','SHOP','SQ','RBLX',
    'NKE','DIS','NFLX','PYPL','BABA','PDD','JD','SE','GRAB',
    'CVX','COP','SLB','OXY','DVN','HAL','MPC','VLO','PSX',
    'GS','MS','C','BAC','WFC','AXP','BLK','SCHW','ICE',
    'PFE','MRK','ABBV','TMO','ABT','ISRG','REGN','MRNA','VRTX',
    'CAT','DE','GE','HON','MMM','UNP','UPS','FDX',
    'WMT','TGT','LOW','MCD','SBUX','CMG','YUM',
    'DELL','HPE','WDC','STX','ON','MCHP','TXN','ADI','KLAC','LRCX','AMAT',
  ]);
  // v29.1: 구글뉴스 소스 부스트
  if ((item.source || '').includes('구글뉴스')) score += 4;

  // ── 3. 신선도 감쇄 (시간이 지나면 점수 감소) ────────────
  if (item.pubDate) {
    const ageH = (Date.now() - new Date(item.pubDate).getTime()) / 3600000;
    if (ageH <= 1) score += 20;           // 1시간 이내: +20
    else if (ageH <= 6) score += 12;      // 6시간 이내: +12
    else if (ageH <= 24) score += 5;      // 24시간 이내: +5
    else if (ageH <= 72) score += 0;      // 3일 이내: 보너스 없음
    else score -= Math.min((ageH - 72) / 24, 15); // 3일 이후: 하루당 -1, 최대 -15
  }

  // ── 4. 티커 언급 부스트 (v30.12: 오탐 방지 — extractTickers 재사용) ──
  const foundTickers = extractTickers(item);
  let tickerMentions = foundTickers.length;
  const titleText = (item.title || '');
  foundTickers.forEach(ticker => {
    const re = new RegExp('\\b' + ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
    if (re.test(titleText)) {
      score += 4; // 제목에서 티커 발견: +4
    } else {
      score += 2; // 본문에서 티커 발견: +2
    }
  });
  item._tickerMentions = tickerMentions;

  // 금융 관련성 총합 (정치 감점 판단에 필요하므로 여기서 선언)
  const finRelevance = macroHits + techHits + medHits + tickerMentions;

  // v34.1c: 대형주/대장주/주도주 티커 부스트 시스템
  if (foundTickers.length > 0) {
    const hasMega = foundTickers.some(t => _MEGA_TICKERS.has(t));
    const hasLarge = foundTickers.some(t => _LARGE_TICKERS.has(t));
    if (hasMega) score += 8;        // 메가캡/대장주 뉴스: +8
    else if (hasLarge) score += 4;  // 대형주 뉴스: +4
    // v43.4: 대형주 애널리스트 목표주가·등급 변경 — 시장 임팩트 있음 → 추가 부스트
    if (analystHits > 0) {
      if (hasMega) score += 10;      // 메가캡 등급변경: +10 (총점 충분히 확보)
      else if (hasLarge) score += 5; // 대형주 등급변경: +5
    }
  }

  // ── 5. 감정 강도 부스트 (극단적 표현) ────────────────────
  const urgentKW = ['crash','surge','plunge','soar','spike','collapse','record high','record low',
                    '급등','급락','폭락','폭등','사상최고','사상최저','긴급','속보','breaking'];
  urgentKW.forEach(kw => { if (text.includes(kw.toLowerCase())) score += 3; });

  // ── 5b. v39.0: 핵심 인물 발언/인터뷰 부스트 ────────────────
  // 시장 영향력 있는 인물의 발언·인터뷰·연설은 높은 중요도
  const _KEY_FIGURES = ['powell','yellen','lagarde','jensen huang','tim cook','elon musk',
    'satya nadella','lisa su','altman','sam altman','dario amodei','greg brockman','demis hassabis','ilya sutskever',
    'buffett','dimon','dalio','ackman','druckenmiller',
    'trump','biden','xi jinping','putin',
    'mark zuckerberg','sundar pichai','andy jassy','pat gelsinger','sanjay mehrotra',
    'lloyd austin','austin','jake sullivan',
    '파월','옐런','젠슨 황','일론 머스크','올트먼','샘 올트먼','다리오 아모데이','버핏','트럼프','시진핑','푸틴',
    '사티아 나델라','리사 수','마크 저커버그','순다르 피차이','팻 겔싱어','앤디 재시','산제이 메흐로트라'];
  const _SPEECH_KW = ['says','said','interview','speech','remarks','testimony','hearing',
    'conference','keynote','told','warns','expects','sees','calls for','announces',
    '발언','인터뷰','연설','기자회견','증언','청문','담화','언급','경고','전망','선언'];
  const hasKeyFigure = _KEY_FIGURES.some(kw => text.includes(kw));
  if (hasKeyFigure) {
    score += 8; // 핵심 인물 언급 자체 +8
    const hasSpeechContext = _SPEECH_KW.some(kw => text.includes(kw));
    if (hasSpeechContext) score += 7; // 발언/인터뷰 맥락이면 추가 +7 (총 +15)
  }

  // ── 5c. v40.4: 5대 우선 토픽 부스트 (매크로/지정학/주식/외환/채권) ──
  // 이 5개 토픽이 시장에 직접 영향. 나머지 시사/정치는 시장 연관 시에만 통과.
  const _PRIORITY_KW = [
    // 매크로/경제
    'gdp','cpi','ppi','pce','employment','unemployment','payroll','fomc','fed fund','rate cut','rate hike',
    'inflation','deflation','recession','soft landing','hard landing','stagflation',
    '경제성장','물가','고용','실업','금리','인플레이션','디플레이션','경기침체','스태그플레이션',
    // 지정학
    'tariff','sanction','embargo','trade war','export control','chip ban','liberation day',
    'iran','ukraine','taiwan strait','south china sea','nato','missile','nuclear',
    '관세','제재','무역전쟁','수출규제','전쟁','미사일','핵',
    // 주식/시장
    'earnings','revenue','eps','guidance','buyback','dividend','ipo','spac','m&a','acquisition',
    'bull market','bear market','correction','crash','rally','breakout','all-time high',
    '실적','매출','순이익','자사주','배당','상장','인수','합병','폭락','폭등','사상최고',
    // 외환
    'dollar','yen','euro','yuan','won','currency','forex','exchange rate','dxy',
    '달러','엔화','유로','위안','원화','환율',
    // 채권/금리
    'treasury','yield','bond','credit spread','yield curve','inversion',
    '국채','수익률','채권','크레딧 스프레드','수익률 곡선',
    // v48.18 (integrate 2026-04-18): 35건 자료 핵심 토픽 우선 노출
    // AI 인프라 공급 가시성
    'mtia','meta mtia','tpu roadmap','lta','long-term agreement','custom silicon',
    'vera rubin','rubin cpx','nvlink fusion','cx9','blackwell ultra',
    // 메모리 패러다임
    'hbf','high bandwidth flash','hbm+hbf','inference memory','3계층 메모리',
    '메모리 lta','메모리 슈퍼사이클','hbm 점유',
    // DC 규제 + 전력
    'data center ban','dc moratorium','maine dc','grid connection delay','data center regulation',
    '데이터센터 금지','전력망 부하','온사이트 발전','wartsila','34sg engine',
    // 머스크 테라팹 + 장비주
    'terafab','테라팹','applied materials','tokyo electron','lam research',
    // Google 2026 이벤트
    'google cloud next','google i/o','marketing live','brandcast','ask maps','gemini 3.5',
    // AI 보안 표준화
    'glasswing','project glasswing','openai tac','trust access for cyber','gpt-5.4 cyber',
    // 위성 통신
    'globalstar','amazon leo','project kuiper','d2d','direct-to-device','low earth orbit',
    // 자산배분/로테이션
    'data dependence','forward guidance failure','2% inflation target','mid-inflation',
    '중물가','데이터 디펜던스','이익 확산','quality rotation',
  ];
  var priorityHits = 0;
  _PRIORITY_KW.forEach(kw => { if (text.includes(kw)) priorityHits++; });
  if (priorityHits >= 3) score += 15;      // 핵심 토픽 집중: +15
  else if (priorityHits >= 1) score += 5;  // 핵심 토픽 언급: +5

  // ── 5d. v40.4: 비시장 정치/시사 뉴스 강력 감점 ──
  // 정치/시사 키워드가 있지만 시장 연관 키워드가 없으면 대폭 감점
  const _POLITICS_ONLY_KW = ['election','vote','poll','campaign','congress','senate','legislation','bill passed',
    '선거','투표','여론조사','국회','국정감사','법안','탄핵','청문회','대통령실','비서실',
    'supreme court','abortion','immigration','gun control','death penalty',
    '이민','총기','사형','낙태','인권','시위','집회','데모'];
  var politicsHits = 0;
  _POLITICS_ONLY_KW.forEach(kw => { if (text.includes(kw)) politicsHits++; });
  // v46.6: finRelevance 임계값 1→1.5 상향 + 정책/규제 키워드 예외 추가
  // "대통령 AI 보조금 발표", "반도체 규제 완화" 같은 금융영향 정책 뉴스 오탐 방지
  var _hasPolicyKW = ['보조금','규제','정책','세금','감세','증세','관세','수출규제','수출통제',
    'subsidy','regulation','policy','tax','tariff','export control','sanction','stimulus',
    'antitrust','legislation','executive order','행정명령','법안'].some(function(kw) { return text.includes(kw); });
  if (politicsHits > 0 && priorityHits === 0 && finRelevance <= 1.5 && !_hasPolicyKW) {
    score -= 25; // 정치/시사만 있고 시장 연관 없음 → 대폭 감점
  }

  // ── 6. 중복/스팸 패널티 ────────────────────────────────
  const spamKW = ['sponsored','advertisement','promoted','partner content','editorial','opinion piece'];
  spamKW.forEach(kw => { if (text.includes(kw)) score -= 20; });

  // v39.2: 클릭베이트/투자 스팸 감지 — 소거법 (패턴 매칭 즉시 차단)
  const _CLICKBAIT_RE = /(\d+배|\d+x\b|텐배거|대박주|급등주|폭등 예고|급등 임박|10x|100x|next tesla|next nvidia|must buy|guaranteed return|millionaire|get rich|won't believe|don't miss|last chance|놓치면 후회|지금이 마지막|마지막 기회|수익률 보장|원금 보장|100% 수익|이 주식만|이 종목만|반드시 사야|무조건 사야|리딩방|시크릿|비밀 종목|숨겨진 종목|아무도 모르는|전문가만 아는|삼성 잡는|애플 잡는|엔비디아 잡는|best stock.?to buy|stocks? to buy now|hidden gem|secret stock|penny stock|easy money|yolo stock|to the moon|explosive growth potential)/i;
  if (_CLICKBAIT_RE.test(text)) {
    item._blacklisted = true;
    return 0;
  }

  // ── v34.1c: 3단계 뉴스 선별 시스템 (컨텍스트 기반) ──────────────
  // 원칙: "주식/금융 관련 키워드가 함께 있으면 → 통과 (정치 기사여도)"
  //       "주식/금융 관련 키워드가 전혀 없으면 → 차단 (어떤 소스여도)"
  //
  // 예시: "대통령이 코스피 부양 정책 발표" → '코스피'(MACRO_KW) 매칭 → 통과 
  //       "대통령이 교육 예산 확대"           → 금융KW 0개 → 차단 
  //       "울주군 복지단체 건강음료 배달사업"   → 금융KW 0개 → 차단 

  const isExempt = item._tgChannel ||
    ['Reuters','Bloomberg','WSJ','CNBC','MarketWatch','FT Markets','S&P Global',
     'Seeking Alpha','Investing.com','CoinDesk','OilPrice.com','Benzinga','Barrons',
     'Fed Reserve','ECB Press','IMF Blog','World Bank','BIS Speeches',
     'The Block','Decrypt','CoinTelegraph','DL News',
     'Defense One','Nikkei Asia','SCMP','AP Business','Yahoo Finance',
     'CNN Business','NYT Business','BBC Business','Zero Hedge',
     'TrendForce','Digitimes','SemiAnalysis','EE Times','Rigzone','Platts',
     'Nasdaq News','Forbes','Business Insider','Morningstar','The Economist',
     'Kitco Gold','Google News Finance','Channel News Asia'].includes(item.source);

  // ── STEP 1: 하드 블랙리스트 (금융 문맥에서 절대 안 나오는 키워드) ──
  // 연예/스포츠/부동산/범죄/날씨 등 = 금융 키워드와 공존할 가능성 0%
  if (NEWS_BLACKLIST_KW.some(kw => text.includes(kw.toLowerCase()))) {
    // 예외: 금융 관련성이 충분히 높으면 (finRelevance >= 3) 블랙리스트를 override
    // → "아파트 REIT 투자" 같은 기사가 '아파트'에 걸려도 구조 가능
    if (finRelevance >= 3) {
      score -= 10; // 패널티만 부과하고 통과
    } else {
      item._blacklisted = true;
      return 0;
    }
  }

  // ── STEP 2: 금융 관련성 게이트 (컨텍스트 기반) ──
  // v42.5: 가중치 기반 히트값 사용 → < 0.5 (짧은 키워드 1개 단독 히트 = 차단)
  if (finRelevance < 0.5) {
    const finKwMatches = _FINANCE_RELEVANCE_KW.filter(kw => text.includes(kw));
    if (finKwMatches.length === 0) {
      // 금융 관련 키워드가 단 하나도 없음 → 차단
      item._blacklisted = true;
      return 0;
    }
    // 광범위 한국어 키워드('기업','수출','에너지' 등)만으로 통과한 경우
    const _KR_BROAD_KW = ['기업','수출','수입','에너지','산업','경제','금융','은행','시장','무역'];
    const allBroad = finKwMatches.every(kw => _KR_BROAD_KW.includes(kw));
    if (allBroad && finKwMatches.length <= 3) {  // v38.3 B2: 임계값 2→3 상향 (광범위 KW 3개까지도 차단)
      // 지방정부 보도자료 패턴 → 차단
      item._blacklisted = true;
      return 0;
    }
    // 약한 관련성 → 감산
    score -= (allBroad ? 20 : 10);
  }

  // ── v31.8: 비금융 콘텐츠 추가 패턴 필터 ────────────────────
  // 제목에 금융과 전혀 무관한 패턴이 있으면 추가 감점
  const titleLower = (item.title || '').toLowerCase();
  const _nonFinPatterns = [
    /how to (?:cook|bake|clean|fix|decorate|style|dress)/,
    /best (?:phones|laptops|tablets|headphones|cameras|shows|movies|songs|books|games|apps|gifts|deals)/,
    /top \d+ (?:tips|tricks|ways|things|reasons|places|destinations|recipes)/,
    /review[:\s]|unboxing|hands[- ]on|first look/,
    /(?:wedding|birthday|anniversary|holiday|christmas|halloween|valentine)/,
    // v34.1b: 한국 지방정부 기사 패턴 (제목에서 지자체가 주어)
    /^(?:울주군|울산시|강원도|전남도|경남도|충남도|충북도|경북도|전북도|제주도|합천군|산청군|나주시|정선군|영월군|태백시|양양군|횡성군|평창군)/,
    /(?:군|시|도),\s*(?:올해|내년|금년|이번|신규|지역|도내|관내)/,
    // 한국 업무협약/행사/모집 패턴
    /업무협약|양해각서|mou\s*체결|협약식|체결식/,
    /선착순\s*모집|참가자\s*모집|수강생\s*모집/,
    /일자리\s*(?:창출|사업|대책|계획)|공공근로/,
    // 한국 인사/임명 패턴
    /\[인사\]|인사이동|보직변경|전보발령/,
    /(?:사장|원장|이사장|회장)\s*(?:\d+연임|취임|퇴임|이취임)/,
    // 영문 순수 비금융 패턴 (정치 제거 — 무역/관세/금융정책과 공존 가능하므로)
    /(?:governor|mayor)\s+(?:signs|vetoes|declares)\s+(?!.*(?:tax|budget|tariff|trade))/,
    // v38.3 B5: 한국어 비금융 패턴 추가
    /오늘의?\s*날씨|기상\s*(?:청|특보)|(?:폭우|폭설|한파|폭염)\s*(?:주의보|경보)/,
    /(?:축구|야구|농구|배구|골프)\s*(?:결과|경기|시즌|감독)/,
    /건강\s*(?:관리|검진|보험|증진)|의료\s*(?:봉사|지원|서비스)/,
    /입학\s*(?:식|설명회)|졸업\s*(?:식|축하)|학교\s*(?:폭력|급식|운영)/,
    /교통\s*(?:사고|정체|통제|우회)|도로\s*(?:공사|정비|개통)/,
    /(?:실종|수색|구조|신원)\s*(?:아동|노인|신고|확인)/,
    /(?:보이스피싱|전화사기|스미싱|피싱)\s*(?:피해|주의|예방)/,
    /(?:동물원|수족관|놀이공원|워터파크)\s*(?:개장|입장|이벤트)/,
    /(?:결혼|돌잔치|장례|제사|명절)\s*(?:준비|비용|선물)/,
    /(?:미용|피부|성형|다이어트|헬스)\s*(?:클리닉|시술|관리)/,
  ];
  if (_nonFinPatterns.some(pat => pat.test(titleLower))) {
    item._blacklisted = true;
    return 0;
  }

  // 너무 짧은 제목 (스팸 가능성)
  if ((item.title || '').length < 15) score -= 10;

  // ── 7. 최소 0점 보장 ────────────────────────────────────
  return Math.max(0, Math.round(score));
}

/* ── classifyTopic(): 뉴스 토픽 분류 ───────────────────────── */
function classifyTopic(item) {
  const text = ((item.title || '') + ' ' + (item.desc || '')).toLowerCase();
  let bestTopic = 'general';
  let bestScore = 0;

  Object.entries(TOPIC_KEYWORDS).forEach(([topic, keywords]) => {
    let hits = 0;
    keywords.forEach(kw => {
      if (text.includes(kw.toLowerCase())) hits++;
    });
    if (hits > bestScore) {
      bestScore = hits;
      bestTopic = topic;
    }
  });

  // 소스의 topics 태그도 고려
  if (bestScore === 0 && item.topics && item.topics.length > 0) {
    bestTopic = item.topics[0];
  }

  return bestTopic;
}

/* ── getSentimentFromText(): 뉴스 감성 분석 (bull/bear/neutral) ── */
function getSentimentFromText(text) {
  const t = (text || '').toLowerCase();
  // v46.9: 'war'→'trade war'/'military' + 'boom'→'market boom' 한정 (오분류 방지)
  const bullKW = ['surge','rally','beat','outperform','upgrade','record high','soar','market boom','bull','recovery',
                  '급등','상승','호재','상향','돌파','신고가','반등','회복'];
  const bearKW = ['crash','plunge','miss','downgrade','sell-off','collapse','fear','crisis','trade war','default',
                  'military','conflict','sanctions','급락','하락','악재','하향','폭락','위기','전쟁','부도'];

  let bullScore = 0, bearScore = 0;
  bullKW.forEach(kw => { if (t.includes(kw)) bullScore++; });
  bearKW.forEach(kw => { if (t.includes(kw)) bearScore++; });

  if (bullScore > bearScore + 1) return 'bull';
  if (bearScore > bullScore + 1) return 'bear';
  if (bearScore > bullScore) return 'warn';
  return 'neut';
}

/* ── getTopicBadge(): 토픽별 뱃지 HTML ─────────────────────── */
function getTopicBadge(topic) {
  const map = {
    macro:    { cls:'nit-warn', icon:'', label:'매크로' },
    geo:      { cls:'nit-bear', icon:'', label:'지정학' },
    semi:     { cls:'nit-neut', icon:'', label:'반도체' },
    earnings: { cls:'nit-bull', icon:'', label:'실적' },
    energy:   { cls:'nit-bear', icon:'', label:'에너지' },
    crypto:   { cls:'nit-neut', icon:'',  label:'크립토' },
    analyst:  { cls:'nit-neut', icon:'', label:'분석' },
    equity:   { cls:'nit-bull', icon:'', label:'주식' },
    bond:     { cls:'nit-warn', icon:'', label:'채권' },
    fx:       { cls:'nit-warn', icon:'', label:'외환' },
    defense:  { cls:'nit-bear', icon:'', label:'방산' },
    healthcare:{ cls:'nit-bull', icon:'', label:'바이오' },
    shipbuilding:{ cls:'nit-neut', icon:'', label:'조선' },
    space:    { cls:'nit-neut', icon:'', label:'우주' },
    quantum:  { cls:'nit-neut', icon:'', label:'양자' },
    general:  { cls:'nit-neut', icon:'', label:'일반' },
  };
  const m = map[topic] || map.general;
  return `<span class="news-item-tag ${m.cls}">${m.icon} ${m.label}</span>`;
}

/* ── v42.9: 미확인 소식통 감지 — 익명 소식통·교차검증 없는 기사 탐지 ── */
function isUnverifiedClaim(item) {
  var text = ((item.title || '') + ' ' + (item.desc || '') + ' ' + (item.translated || '')).toLowerCase();
  var patterns = [
    'sources say', 'sources said', 'sources told', 'source told',
    'people familiar', 'sources familiar', 'officials familiar',
    'according to people', 'people with knowledge', 'sources close to',
    'who asked not to be', 'who declined to be', 'speaking anonymously', 'speaking on condition',
    'unconfirmed report', 'unconfirmed claim',
    '소식통에 따르면', '소식통에 의하면', '익명의 관계자', '복수의 관계자',
    '복수의 소식통', '사정에 정통한', '알려진 바에 따르면'
  ];
  return patterns.some(function(p) { return text.indexOf(p) !== -1; });
}

/* ── v21: 정렬 모드 ──────────────────────────────────────────── */
let _newsSortMode = 'time'; // 'time' (최신순) or 'score' (중요도순)

function setNewsSortMode(mode, el) {
  _newsSortMode = mode;
  const timeBtn = document.getElementById('sort-time-btn');
  const scoreBtn = document.getElementById('sort-score-btn');
  if (timeBtn) timeBtn.classList.toggle('active', mode === 'time');
  if (scoreBtn) scoreBtn.classList.toggle('active', mode === 'score');
  if (newsCache.length > 0) {
    renderFeed(newsCache);
    renderHomeFeed(newsCache);
  }
}

/* ══════════════════════════════════════════════════════════════════
   v21: 자동 한국어 번역 시스템
   - 뉴스 fetch 완료 후 자동으로 영어 뉴스를 한국어로 번역
   - Claude Haiku 4.5 API 사용 (뉴스/번역 배치 전용)
   - 한국어 뉴스는 번역 스킵
   - 번역 결과 캐시하여 중복 번역 방지
   ══════════════════════════════════════════════════════════════════ */
const _translationCache = new Map(); // normalizedKey -> { ko_title, ko_desc, ko_summary, tickers, _failed }
let _translationInProgress = false;

// v27.3: 캐시 키 정규화 — 공백/대소문자/특수문자 차이로 인한 lookup 실패 방지
function _tcKey(title) {
  if (!title) return '';
  return title.trim().replace(/\s+/g, ' ').slice(0, 120).toLowerCase();
}

// v30.12 P4: 캐시 LRU 삽입 + sessionStorage 연동
function _tcPut(title, data) {
  var key = _tcKey(title);
  if (!key) return;
  // LRU: 1000건 초과 시 가장 오래된 항목 제거 (기존 500 → 1000으로 확대)
  if (_translationCache.size >= 1000) {
    var firstKey = _translationCache.keys().next().value;
    _translationCache.delete(firstKey);
  }
  _translationCache.set(key, data);
}

// v30.12 P4: sessionStorage 저장 (탭 살아있는 동안 유지)
function _tcSaveToStorage() {
  try {
    var obj = {};
    var count = 0;
    _translationCache.forEach(function(val, key) {
      if (count < 500 && !val._failed) { // 성공한 번역만 저장
        obj[key] = { t: val.ko_title, d: val.ko_desc, s: val.ko_summary, k: val.tickers };
        count++;
      }
    });
    sessionStorage.setItem('aio_tc', JSON.stringify(obj));
  } catch(e) { /* storage full or unavailable */ }
}

// v30.12 P4: sessionStorage 로딩 (페이지 새로고침 시 복원)
function _tcLoadFromStorage() {
  try {
    var raw = sessionStorage.getItem('aio_tc');
    if (!raw) return 0;
    var obj = JSON.parse(raw);
    var loaded = 0;
    for (var key in obj) {
      if (obj.hasOwnProperty(key) && !_translationCache.has(key)) {
        var v = obj[key];
        _translationCache.set(key, {
          ko_title: v.t, ko_desc: v.d || '', ko_summary: v.s || '',
          tickers: v.k || [], _failed: false
        });
        loaded++;
      }
    }
    return loaded;
  } catch(e) { return 0; }
}

// 한국어 문자열 판별 (한국어면 번역 불필요)
function isKoreanText(text) {
  if (!text) return false;
  var korean = text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g);
  return korean && korean.length > text.length * 0.3; // 30% 이상 한글이면 한국어
}

/* ── v30.12: Google Translate 무료 API (배치 지원 + 재시도 + 품질 검증 강화) ── */
const _GT_SEPARATOR = '\n§§§\n'; // 배치 구분자 — Google이 번역하지 않는 특수 패턴

// v30.12: 단일 텍스트 번역 (하위 호환)
async function googleTranslateFree(text, from='en', to='ko', _retry=0) {
  try {
    var result = await _gtBatchTranslate([text], from, to, _retry);
    return result[0];
  } catch(e) { _aioLog('warn', 'fetch', 'googleTranslateFree error: ' + e.message); return null; }
}

// v30.12: 배치 번역 — 최대 8건을 하나의 API 호출로 처리
// returns: string[] (각 항목의 번역 결과, 실패 시 null)
async function _gtBatchTranslate(texts, from, to, _retry) {
  from = from || 'en'; to = to || 'ko'; _retry = _retry || 0;
  if (!texts || texts.length === 0) return [];
  // 빈/짧은 텍스트 필터링 (위치 보존)
  var validMap = []; // { idx, text }
  for (var i = 0; i < texts.length; i++) {
    if (texts[i] && texts[i].length >= 3) {
      validMap.push({ idx: i, text: texts[i].slice(0, 500) });
    }
  }
  if (validMap.length === 0) return texts.map(function() { return null; });

  // 구분자로 연결
  var combined = validMap.map(function(v) { return v.text; }).join(_GT_SEPARATOR);

  // v46.6: 엔드포인트별 타임아웃 분화 (googleapis CDN=4s 빠름, google.com=10s 느림)
  var endpoints = [
    { url: 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + from + '&tl=' + to + '&dt=t&q=' + encodeURIComponent(combined), timeout: 4000 },
    { url: 'https://translate.google.com/translate_a/single?client=gtx&sl=' + from + '&tl=' + to + '&dt=t&q=' + encodeURIComponent(combined), timeout: 10000 },
  ];

  for (var ei = 0; ei < endpoints.length; ei++) {
    try {
      var r = await fetchWithTimeout(endpoints[ei].url, {}, endpoints[ei].timeout);
      if (!r.ok) continue;
      var d = await r.json();
      if (!Array.isArray(d) || !Array.isArray(d[0])) continue;
      var fullResult = d[0].map(function(s) { return (s && s[0]) || ''; }).join('');
      if (!fullResult || fullResult.length < 3) continue;

      // 구분자로 분리
      var parts = fullResult.split(/\s*§§§\s*/);
      // 분리 결과가 원본 개수와 다르면 → 개별 번역 폴백
      if (parts.length !== validMap.length) {
        if (validMap.length === 1) {
          parts = [fullResult];
        } else {
          // v46.6: 배치 분리자 실패 → 개별 1건씩 재시도 (기존: 전부 null 반환)
          _aioLog('warn', 'translate', '배치 분리자 불일치 (' + parts.length + '/' + validMap.length + ') → 개별 번역 폴백');
          var fallbackResults = new Array(texts.length);
          for (var fi = 0; fi < texts.length; fi++) fallbackResults[fi] = null;
          for (var si = 0; si < validMap.length; si++) {
            try {
              var singleUrl = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + from + '&tl=' + to + '&dt=t&q=' + encodeURIComponent(validMap[si].text.slice(0, 300));
              var sr = await fetchWithTimeout(singleUrl, {}, 5000);
              if (sr.ok) {
                var sd = await sr.json();
                if (Array.isArray(sd) && Array.isArray(sd[0])) {
                  var sText = sd[0].map(function(s2) { return (s2 && s2[0]) || ''; }).join('');
                  if (sText && _isKoreanTranslationValid(sText)) {
                    fallbackResults[validMap[si].idx] = sText;
                  }
                }
              }
            } catch(se) { /* 개별 실패 무시 — 다음 건 진행 */ }
            // 개별 번역 간 300ms 딜레이 (rate limit 방어)
            if (si < validMap.length - 1) await new Promise(function(r2) { setTimeout(r2, 300); });
          }
          return fallbackResults;
        }
      }

      // v30.12: 금융 텍스트 품질 검증 강화
      var results = new Array(texts.length);
      for (var ri = 0; ri < texts.length; ri++) results[ri] = null;
      for (var pi = 0; pi < parts.length; pi++) {
        var part = parts[pi].trim();
        if (!part || part.length < 2) continue;
        if (_isKoreanTranslationValid(part)) {
          results[validMap[pi].idx] = part;
        }
      }
      return results;
    } catch(e) { /* try next endpoint */ }
  }

  // 재시도 1회 (1.2초 후)
  if (_retry < 1) {
    await new Promise(function(resolve) { setTimeout(resolve, T.BATCH_DELAY); });
    return _gtBatchTranslate(texts, from, to, _retry + 1);
  }
  return texts.map(function() { return null; });
}

// v46.6: 금융 텍스트 한국어 번역 품질 검증 강화
// - 방법2 기준 7%→12% 상향 (기술용어 범벅 오탐 방지)
// - CJK 한자 범위 추가 (일본 경제 뉴스 번역 감지)
// - 최소 한글 3자 이상 필수 (2자="양산"만으로 통과 방지)
function _isKoreanTranslationValid(text) {
  if (!text || text.length < 2) return false;
  // 한글 + CJK 한자 (일본 경제 용어 혼용 번역 대응)
  var koreanChars = (text.match(/[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g) || []).length;
  // 순수 텍스트 길이 (티커·숫자·특수문자 제외)
  var pureText = text.replace(/[$%+\-.,0-9A-Z\s]/gi, '');
  // 방법1: 순수 텍스트 중 한국어 비율 50% 이상
  if (pureText.length > 0 && koreanChars >= pureText.length * 0.5) return true;
  // 방법2: 전체 텍스트 대비 한국어 12% + 최소 3자 이상 (v46.6: 7%+2자 → 12%+3자)
  if (koreanChars >= 3 && koreanChars >= text.length * 0.12) return true;
  // 방법3: 짧은 텍스트(30자 이하)는 한글 2자 + 8% OK (제목 번역)
  if (text.length <= 30 && koreanChars >= 2 && koreanChars >= text.length * 0.08) return true;
  return false;
}

/* ── v30.12: Claude 키 없을 때 Google Translate 무료 배치 번역 수행 ── */
async function freeTranslateNews(items) {
  var statusEl = document.getElementById('translate-status');
  if (statusEl) statusEl.innerHTML = '번역 준비 중...';

  var needTrans = items.filter(function(i) {
    return i.title && !isKoreanText(i.title) && !_translationCache.has(_tcKey(i.title));
  });
  // 한국어 뉴스 먼저 처리
  items.filter(function(i) {
    return i.title && isKoreanText(i.title) && !_translationCache.has(_tcKey(i.title));
  }).forEach(function(i) {
    var tickers = extractTickers(i).map(function(t) { return '$' + t; });
    _tcPut(i.title, { ko_title: i.title, ko_desc: i.desc || '', ko_summary: '', tickers: tickers });
  });

  if (needTrans.length === 0) {
    if (statusEl) statusEl.textContent = '✓ 번역 불필요 (한국어 뉴스)';
    return;
  }

  var total = needTrans.length;
  var translated = 0, failed = 0;
  var failedItems = [];

  // v30.12: 8건씩 배치 번역 (기존 1건씩 → 8배 속도 향상)
  var BATCH = 8;
  for (var b = 0; b < needTrans.length; b += BATCH) {
    var batch = needTrans.slice(b, b + BATCH);
    var titles = batch.map(function(item) { return item.title; });

    // 진행률 표시 (P5 수정: 분모·분자 명확 + 예상 시간)
    var done = b + batch.length;
    var pct = Math.round(done / total * 100);
    if (statusEl) statusEl.textContent = '번역 중 ' + Math.min(done, total) + '/' + total + '건 (' + pct + '%)';

    try {
      var koTitles = await _gtBatchTranslate(titles);
      for (var i = 0; i < batch.length; i++) {
        var item = batch[i];
        var koTitle = koTitles[i];
        var tickers = extractTickers(item).map(function(t) { return '$' + t; });
        var koDesc = '';
        if (koTitle) {
          translated++;
          // 설명도 배치에 포함하지 않고 제목만 — 속도 우선
        } else {
          failed++;
          failedItems.push(item);
        }
        _tcPut(item.title, {
          ko_title: koTitle || item.title,
          ko_desc: item.desc || '',
          ko_summary: '',
          tickers: tickers,
          _failed: !koTitle  // P2 수정: 번역 실패 플래그
        });
      }
    } catch(e) {
      // 배치 전체 실패 → 원문 유지
      for (var fi = 0; fi < batch.length; fi++) {
        var fItem = batch[fi];
        var fTickers = extractTickers(fItem).map(function(t) { return '$' + t; });
        _tcPut(fItem.title, {
          ko_title: fItem.title, ko_desc: fItem.desc || '', ko_summary: '',
          tickers: fTickers, _failed: true
        });
        failed++;
        failedItems.push(fItem);
      }
    }

    // 배치 간 800ms 대기 — rate limit 안전 확보
    if (b + BATCH < needTrans.length) await new Promise(function(r) { setTimeout(r, 800); });
    // 매 배치마다 중간 렌더링
    renderFeed(newsCache);
    renderHomeFeed(newsCache);
  }

  // v30.12: 실패 항목 2차 재시도 (3초 후, 개별 번역, 상위 16건)
  if (failedItems.length > 0) {
    if (statusEl) statusEl.textContent = ' ' + failedItems.length + '건 재시도 중...';
    await new Promise(function(r) { setTimeout(r, 3000); });
    var retryBatch = failedItems.slice(0, 16);
    var retryTitles = retryBatch.map(function(item) { return item.title; });
    try {
      // 재시도도 배치로 (8건씩 × 2회)
      for (var rb = 0; rb < retryTitles.length; rb += BATCH) {
        var rSlice = retryBatch.slice(rb, rb + BATCH);
        var rTitles = rSlice.map(function(item) { return item.title; });
        var rResults = await _gtBatchTranslate(rTitles);
        for (var ri = 0; ri < rSlice.length; ri++) {
          if (rResults[ri]) {
            var rItem = rSlice[ri];
            var rTickers = extractTickers(rItem).map(function(t) { return '$' + t; });
            _tcPut(rItem.title, {
              ko_title: rResults[ri], ko_desc: rItem.desc || '', ko_summary: '',
              tickers: rTickers, _failed: false
            });
            translated++;
            failed--;
          }
        }
        if (rb + BATCH < retryTitles.length) await new Promise(function(r) { setTimeout(r, 1000); });
      }
    } catch(e) {}
  }

  // P2 수정: 실패 건수 명확 표시
  var statusMsg = '✓ ' + translated + '건 번역 완료 (무료)';
  if (failed > 0) statusMsg += ' · <span style="color:#f87171;">' + failed + '건 번역 실패</span>';
  statusMsg += ' · ';
  if (statusEl) statusEl.innerHTML = statusMsg + '<span style="cursor:pointer;text-decoration:underline;color:#fbbf24;" data-action="openApiKeyConfig">Claude 키 입력 시 AI 해석 추가</span>';
  // P4 수정: 번역 완료 후 캐시 저장
  _tcSaveToStorage();
  renderFeed(newsCache);
  renderHomeFeed(newsCache);
  renderBriefingFeed(newsCache);
}

/* ── v27.2: 뉴스 fetch 후 자동 번역 + 해석 + 티커 추출 ────────── */
async function autoTranslateNews(items) {
  const apiKey = getApiKey();
  // API 키 없으면 Google Translate 무료 번역 수행
  if (!apiKey) {
    console.log('[AIO v29] Claude API 키 미설정 → Google Translate 무료 번역 실행');
    await freeTranslateNews(items);
    return;
  }
  if (_translationInProgress) return;
  _translationInProgress = true;

  const statusEl = document.getElementById('translate-status');
  if (statusEl) statusEl.textContent = '번역·해석 중...';

  // 번역이 필요한 영어 뉴스만 필터 (이미 번역된 건 제외)
  const needTranslation = items.filter(i =>
    i.title &&
    !_translationCache.has(_tcKey(i.title)) &&
    !isKoreanText(i.title)
  );
  // 이미 한국어인 뉴스도 해석/티커 없으면 로컬 enrichment
  items.filter(i => i.title && isKoreanText(i.title) && !_translationCache.has(_tcKey(i.title))).forEach(i => {
    const tickers = extractTickers(i).map(t => '$' + t);
    _tcPut(i.title, {
      ko_title: i.title,
      ko_desc: i.desc || '',
      ko_summary: '',
      tickers: tickers
    });
  });

  if (needTranslation.length === 0) {
    _translationInProgress = false;
    if (statusEl) statusEl.textContent = `✓ ${_translationCache.size}건 처리됨`;
    renderFeed(newsCache);
    renderHomeFeed(newsCache);
    renderBriefingFeed(newsCache);
    return;
  }

  console.log(`[AIO v27.2] 번역+해석 시작: ${needTranslation.length}건 영어 뉴스`);

  // 6개씩 배치 (해석 추가로 토큰 증가하여 배치 축소)
  const BATCH = 6;
  let translated = 0;
  for (let i = 0; i < Math.min(needTranslation.length, 60); i += BATCH) {
    const batch = needTranslation.slice(i, i + BATCH);
    const prompt = batch.map((item, idx) => {
      const desc = (item.desc || '').slice(0, 200);
      return `[${idx+1}] Title: ${item.title}${desc ? '\nDesc: ' + desc : ''}\nSource: ${item.source || 'unknown'}`;
    }).join('\n\n');

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 4000,
          messages: [{
            role: 'user',
            content: `다음 영어 금융/시장 뉴스를 한국어로 번역하고 해석을 추가하세요.

규칙:
1. title: 한국어 제목 (한국 경제 뉴스 헤드라인 스타일, 간결하게)
2. desc: 핵심 내용 1-2문장 한국어 요약. desc 없으면 제목에서 유추
3. summary: 투자자 관점 해석 1문장 (예: "반도체 업종 전반에 긍정적 시그널", "단기 변동성 확대 주의")
4. tickers: 관련 주식 티커 배열 ($ 포함, 예: ["$NVDA","$TSLA"]). 관련 없으면 빈 배열
   - 직접 언급된 종목 + 영향받을 종목 포함
   - 섹터 ETF도 해당시 포함 (예: $XLK, $SMH, $XLE)

금융 전문용어 정확히 사용 (rate cut→금리 인하, earnings beat→실적 상회, rally→랠리, selloff→매도세)

JSON 배열로만 반환 (다른 텍스트 없이):
[{"idx":1,"title":"한국어 제목","desc":"한국어 요약","summary":"투자자 관점 해석","tickers":["$NVDA"]}]

${prompt}`
          }]
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        const text = data.content?.[0]?.text || '';
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const translations = JSON.parse(jsonMatch[0]);
            translations.forEach(t => {
              const orig = batch[t.idx - 1];
              if (orig && t.title) {
                // 로컬 티커 추출로 보강
                const localTickers = extractTickers(orig).map(tk => '$' + tk);
                const apiTickers = Array.isArray(t.tickers) ? t.tickers.filter(tk => typeof tk === 'string') : [];
                const mergedTickers = [...new Set([...apiTickers, ...localTickers])].slice(0, 6);
                // v30.12: _tcPut으로 LRU 캐시 관리 통합
                _tcPut(orig.title, {
                  ko_title: t.title,
                  ko_desc: t.desc || '',
                  ko_summary: t.summary || '',
                  tickers: mergedTickers
                });
                translated++;
              }
            });
          } catch(e) { _aioLog('warn', 'translate', '번역 JSON 파싱 에러: ' + (e && e.message || e)); }
        }
      } else {
        const errText = await resp.text().catch(() => '');
        _aioLog('warn', 'translate', '번역 API 응답 에러: ' + resp.status + ' ' + errText.slice(0, 200));
        // API 실패시 로컬 enrichment로 폴백
        batch.forEach(orig => {
          if (!_translationCache.has(_tcKey(orig.title))) {
            localEnrichSingle(orig);
          }
        });
      }
    } catch(e) {
      _aioLog('warn', 'translate', '번역 API 호출 에러: ' + (e && e.message || e));
      batch.forEach(orig => {
        if (!_translationCache.has(_tcKey(orig.title))) localEnrichSingle(orig);
      });
    }

    // 배치 간 딜레이 + 중간 렌더링
    if (i + BATCH < needTranslation.length) {
      await new Promise(r => setTimeout(r, 600));
      if (statusEl) statusEl.textContent = `번역·해석 중... (${translated}/${needTranslation.length})`;
      renderFeed(newsCache);
      renderHomeFeed(newsCache);
    }
  }

  _translationInProgress = false;
  console.log(`[AIO v30.12] 번역+해석 완료: ${translated}건`);
  if (statusEl) statusEl.textContent = `✓ ${_translationCache.size}건 번역·해석 완료`;

  // v30.12 P4: 번역 완료 후 캐시 저장
  _tcSaveToStorage();

  // 최종 렌더링 업데이트
  renderFeed(newsCache);
  renderHomeFeed(newsCache);
  renderBriefingFeed(newsCache);
}

/* ── v27.2: 로컬 뉴스 enrichment (API 없이 티커 추출 + 원본 유지) ── */
function localEnrichNews(items) {
  items.forEach(item => localEnrichSingle(item));
}
function localEnrichSingle(item) {
  if (!item || !item.title || _translationCache.has(_tcKey(item.title))) return;
  var tickers = extractTickers(item).map(function(t) { return '$' + t; });
  _tcPut(item.title, {
    ko_title: item.title,
    ko_desc: item.desc || '',
    ko_summary: '',
    tickers: tickers,
    _failed: !isKoreanText(item.title) // 영문 원문 유지 = 번역 실패
  });
}

/* ── v30.12: 뉴스 표시 텍스트 (한국어 우선 + 해석 + 티커 + 실패 표시) ─── */
function getDisplayTitle(item) {
  if (_translationCache.has(_tcKey(item.title))) {
    var cached = _translationCache.get(_tcKey(item.title));
    // P2: 번역 실패 시 원문 앞에 [EN] 태그 표시
    if (cached._failed) return '[EN] ' + cached.ko_title;
    return cached.ko_title;
  }
  // v38.7: 번역 미완료 외신은 [번역 중] 태그 표시 (영문 날것 노출 방지)
  if (item.title && !isKoreanText(item.title) && typeof _translationQueue !== 'undefined') {
    return '[번역 중] ' + (item.title || '').slice(0, 80) + '...';
  }
  return item.title || '';
}
function getDisplayDesc(item) {
  if (_translationCache.has(_tcKey(item.title))) {
    return _translationCache.get(_tcKey(item.title)).ko_desc || '';
  }
  return (item.desc || '').slice(0, 200);
}
/* v27.2: 투자자 관점 해석 반환 — v27.4: 폴백 추가 */
function getDisplaySummary(item) {
  if (_translationCache.has(_tcKey(item.title))) {
    const cached = _translationCache.get(_tcKey(item.title));
    if (cached.ko_summary) return cached.ko_summary;
  }
  // 폴백: 번역 완료 전이라도 빈 문자열 대신 원문 설명 축약 표시
  const desc = item.desc || item.description || '';
  if (desc.length > 0) {
    const clean = desc.replace(/<[^>]*>/g, '').trim();
    return clean.length > 120 ? clean.slice(0, 117) + '…' : clean;
  }
  return '';
}
/* v27.2: 캐시된 티커 ($ 포함) 반환 — v27.4: 빈 배열 캐시 충돌 수정 */
function getDisplayTickers(item) {
  // v27.4 근본 개편: API 결과 + 로컬 추출을 항상 합침 (풀리지 않는 구조)
  const merged = new Set();

  // 1) API 번역 캐시에서 가져온 티커
  if (_translationCache.has(_tcKey(item.title))) {
    const t = _translationCache.get(_tcKey(item.title)).tickers;
    if (Array.isArray(t)) t.forEach(tk => { if (tk) merged.add(tk); });
  }

  // 2) 로컬 추출 — 항상 실행 (캐시 유무와 무관)
  const local = extractTickers(item);
  local.forEach(s => {
    const tk = s.startsWith('$') ? s : '$' + s;
    merged.add(tk);
  });

  // 캐시 업데이트 (로컬 추출로 보강된 결과 반영)
  const result = [...merged].slice(0, 5);
  if (result.length > 0 && _translationCache.has(_tcKey(item.title))) {
    const cached = _translationCache.get(_tcKey(item.title));
    if (!cached.tickers || cached.tickers.length < result.length) {
      cached.tickers = result;
    }
  }
  return result;
}

/* ── v30.12: 뉴스에서 관련 티커 추출 (오탐 방지 강화) ─────────── */
// v30.12 P1: 일반 영단어와 충돌하는 짧은 티커 — 문맥 확인 필수
// v39.2: 영단어와 완전히 겹치는 티커 — $접두사 또는 (TICKER) 형태만 허용, 문맥 검증 불가
const _TICKER_WORD_OVERLAP = new Set([
  'ARM','ON','IT','A','F','V','C','U','X','D','E','K','T',
  'ALL','RUN','LOW','KEY','FAST','REAL','PLAY','FLEX','CAN',
  'GE','HD','DE','BE','HAS',
  // v48.20 (integrate): 신규 오탐 위험 티커 보강
  'KEYS','TEL','TER','APH','CLS','JBL','ON','DELL','IT','AI'  // Keysight/TE Connectivity/Teradyne/Amphenol/Celestica/Jabil — 일반 영단어와 겹침
]);
const _TICKER_AMBIGUOUS = new Set([
  'AI','META','COST',
  'SNOW','NET','PATH','APP','DASH','SHOP','SNAP','HOOD','SOFI','WOLF',
  'COIN','RIOT','HUT','GOLD','VALE','LINK','DOT','MATIC','UNI',
  'MS','BA','MP','PL','NU','NOW',
  // v46.6: 신규 모호 티커 추가
  'BEAM','OPEN','NEXT','SAIL','FIVE','PLUG','RUN','GRAB','BILL','SPOT',
  // v48.20 (integrate): 리서치 자료 언급 신규 모호 티커
  'FLEX','CELL','ARE','HOLD','RARE','REAL','TRUE','LIFE','BEST','SAFE',
]);

// v30.12: $접두사 또는 대문자 전체 단어 + 금융 문맥이면 티커로 인정
function _isTickerContextValid(ticker, text) {
  // $NVDA 형태는 무조건 티커
  if (text.includes('$' + ticker)) return true;
  // (NVDA) 형태는 무조건 티커
  if (text.includes('(' + ticker + ')')) return true;
  // 모호한 티커는 추가 문맥 확인
  if (!_TICKER_AMBIGUOUS.has(ticker)) return true;
  // 모호한 티커: 주변에 주가/시장 관련 단어가 있어야 인정
  var lower = text.toLowerCase();
  var tickerPos = text.indexOf(ticker);
  if (tickerPos < 0) return false;
  // 앞뒤 80자 범위에서 금융 문맥 확인
  var start = Math.max(0, tickerPos - 80);
  var end = Math.min(text.length, tickerPos + ticker.length + 80);
  var context = lower.slice(start, end);
  // v46.6: 금융 문맥 키워드 확장 (기존 23개 → 40개)
  var finWords = ['stock','share price','share','earnings','rally','surge','ipo','m&a','analyst',
    'quarterly','q1 ','q2 ','q3 ','q4 ','revenue','eps','dividend','buyback','market cap',
    // v46.6 추가: 애널리스트/밸류에이션/실적 관련
    'upgrade','downgrade','price target','valuation','pe ratio','p/e',
    'guidance','outlook','margin','revenue growth','beat','miss',
    'overweight','underweight','outperform','buy rating','sell rating',
    '주가','주식','매출','실적','급등','급락','목표가','배당','시가총액',
    '투자의견','상향','하향','매수','매도','비중확대'];
  for (var i = 0; i < finWords.length; i++) {
    if (context.includes(finWords[i])) return true;
  }
  return false;
}

// v39.2: RegExp 캐시 — extractTickers 성능 최적화 (800+ 티커 × 뉴스 80건)
var _tickerRegexCache = {};
function _getTickerRegex(ticker) {
  if (!_tickerRegexCache[ticker]) {
    _tickerRegexCache[ticker] = new RegExp('\\b' + ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');
  }
  return _tickerRegexCache[ticker];
}

function extractTickers(item) {
  var text = (item.title || '') + ' ' + (item.desc || '');
  var found = new Set();

  // 1) $TICKER 패턴 우선 매칭 (가장 확실)
  var dollarMatches = text.match(/\$([A-Z]{1,5})\b/g);
  if (dollarMatches) {
    dollarMatches.forEach(function(m) {
      var t = m.slice(1);
      if (KNOWN_TICKERS.has(t) && found.size < 5) found.add(t);
    });
  }

  // 2) KNOWN_TICKERS 매칭 (문맥 필터 적용)
  if (typeof KNOWN_TICKERS !== 'undefined') {
    KNOWN_TICKERS.forEach(function(ticker) {
      if (found.has(ticker) || found.size >= 5) return;
      // 1~2자 티커(A, F, V, C, U 등)는 $접두사 없으면 건너뜀
      if (ticker.length <= 2 && !text.includes('$' + ticker)) return;
      // v39.2: 영단어와 완전히 겹치는 티커 — $접두사 또는 (TICKER) 형태만 허용
      if (_TICKER_WORD_OVERLAP.has(ticker)) {
        if (!text.includes('$' + ticker) && !text.includes('(' + ticker + ')')) return;
      }
      var re = _getTickerRegex(ticker);
      if (re.test(text) && _isTickerContextValid(ticker, text)) {
        found.add(ticker);
      }
    });
  }

  // 3) 한국어 기업명/키워드 → 티커 매핑
  if (typeof KR_TICKER_MAP !== 'undefined' && found.size < 5) {
    var lowerText = text.toLowerCase();
    for (var krName in KR_TICKER_MAP) {
      if (KR_TICKER_MAP.hasOwnProperty(krName) && lowerText.includes(krName.toLowerCase()) && found.size < 5) {
        found.add(KR_TICKER_MAP[krName]);
      }
    }
  }

  return Array.from(found);
}

/* ── v21: 절대 시간 포맷 (HH:MM) ──────────────────────────────── */
function getAbsoluteTime(pubDate) {
  if (!pubDate) return '';
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
}

/* ── v21: 날짜 그룹 헤더 (오늘/어제/날짜) ──────────────────────── */
function getDateLabel(pubDate) {
  if (!pubDate) return '';
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const itemDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today - itemDay) / 86400000);
  if (diffDays === 0) return '오늘';
  if (diffDays === 1) return '어제';
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }) + ' (' + ['일','월','화','수','목','금','토'][d.getDay()] + ')';
}

// ── v34.9: 뉴스 유형 탭 (전체/시장/기업) ──
var _newsTypeTab = 'all'; // 'all', 'market', 'company'

// 기업 뉴스 판별: 티커가 있고 기업 관련 토픽인 뉴스
// v46.9: healthcare/shipbuilding/space/quantum/crypto 추가 (TOPIC_KEYWORDS 전체 커버)
function isCompanyNews(item) {
  var companyTopics = ['equity','earnings','semi','analyst','defense','healthcare','shipbuilding','space','quantum','crypto'];
  // 시장 전용 토픽 (기업 뉴스에서 제외)
  var marketOnlyTopics = ['macro','geo','bond','fx'];
  var tickers = getDisplayTickers ? getDisplayTickers(item) : (item.tickers || []);
  // 1. 시장 전용 토픽이면 기업 뉴스 아님 (티커 있어도)
  if (marketOnlyTopics.indexOf(item.topic) !== -1) return false;
  // 2. 티커가 있으면서 기업 관련 토픽이면 기업 뉴스
  if (tickers.length > 0 && companyTopics.indexOf(item.topic) !== -1) return true;
  // 3. 티커가 있고 energy 토픽이면 기업 뉴스 (XOM, CVX 등 에너지 기업)
  if (tickers.length > 0 && item.topic === 'energy') return true;
  // 4. 티커가 있고 토픽이 general이면 기업 뉴스로 분류
  if (tickers.length > 0 && item.topic === 'general') return true;
  // 5. 실적(earnings)/애널리스트 토픽은 항상 기업 뉴스
  if (item.topic === 'earnings' || item.topic === 'analyst') return true;
  return false;
}

function setNewsTypeTab(type, el) {
  _newsTypeTab = type;
  document.querySelectorAll('#news-type-tabs .news-type-tab').forEach(function(btn) {
    btn.style.color = 'var(--text-muted)';
    btn.style.borderBottomColor = 'transparent';
    btn.classList.remove('active');
  });
  if (el) {
    el.style.color = 'var(--accent)';
    el.style.borderBottomColor = 'var(--accent)';
    el.classList.add('active');
  }
  // v42: 카테고리별 모드에서는 토픽/국가/정렬 필터 숨김 (자체 그룹핑 사용)
  var isCat = (type === 'category');
  var topicChips = document.getElementById('news-topic-chips');
  var countryChips = document.getElementById('news-country-chips');
  var sortRow = document.getElementById('sort-time-btn') ? document.getElementById('sort-time-btn').parentElement : null;
  if (topicChips) topicChips.style.display = isCat ? 'none' : '';
  if (countryChips) countryChips.style.display = isCat ? 'none' : '';
  if (sortRow) sortRow.style.display = isCat ? 'none' : '';
  if (newsCache.length > 0) renderFeed(newsCache);
}

// 기업 뉴스 간결 불릿 렌더링
function renderCompanyBullet(item) {
  var absTime = typeof getAbsoluteTime === 'function' ? getAbsoluteTime(item.pubDate) : '';
  var tickers = typeof getDisplayTickers === 'function' ? getDisplayTickers(item) : [];
  var tickerStr = tickers.map(function(t){ return '<b style="color:#60a5fa;font-family:var(--font-mono);">' + escHtml(t.replace('$','')) + '</b>'; }).join(' ');
  var displayTitle = escHtml(typeof getDisplayTitle === 'function' ? getDisplayTitle(item) : (item.title || ''));
  var source = escHtml(item.source || '');

  return '<div class="company-news-bullet" data-open-url="' + escHtml(escUrl(item.link)) + '" style="padding:5px 10px;cursor:pointer;border-radius:4px;transition:background 0.15s;" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'transparent\'">' +
    '<span style="color:var(--text-muted);font-size:10px;font-family:var(--font-mono);margin-right:8px;">' + absTime + '</span>' +
    (tickerStr ? '<span style="margin-right:6px;">' + tickerStr + '</span><span style="color:var(--border);margin-right:6px;">|</span>' : '') +
    '<span style="font-size:11px;color:var(--text-primary);">' + displayTitle + '</span>' +
    ' <span style="font-size:9px;color:var(--text-muted);">(' + source + ')</span>' +
    '</div>';
}

/* ── v42.0: 카테고리별 그룹 뷰 렌더링 ─────────────────────────── */
var _TOPIC_GROUP_ORDER = [
  { key:'macro',     label:'매크로·경제',       icon:'' },
  { key:'geo',       label:'국제 정치·지정학',  icon:'' },
  { key:'equity',    label:'주식·시장',         icon:'' },
  { key:'semi',      label:'반도체·AI',         icon:'' },
  { key:'earnings',  label:'실적·기업',         icon:'' },
  { key:'energy',    label:'원자재·에너지',     icon:'' },
  { key:'bond',      label:'채권·금리',         icon:'' },
  { key:'fx',        label:'외환·통화',         icon:'' },
  { key:'crypto',    label:'암호화폐',          icon:'' },
  { key:'defense',   label:'방산·우주',         icon:'' },
  { key:'healthcare',label:'헬스케어·바이오',   icon:'' },
  { key:'shipbuilding',label:'조선·해운',       icon:'' },
  { key:'quantum',   label:'양자컴퓨팅',        icon:'' },
  { key:'analyst',   label:'애널리스트',        icon:'' },
  { key:'space',     label:'우주·위성',         icon:'' },
  { key:'general',   label:'기타 뉴스',         icon:'' }
];

function _renderCategoryGroupView(items, container) {
  // topic별 그룹핑
  var groups = {};
  items.forEach(function(item) {
    var t = item.topic || 'general';
    if (!groups[t]) groups[t] = [];
    groups[t].push(item);
  });
  // 각 그룹 내 score 내림차순 정렬
  Object.keys(groups).forEach(function(k) {
    groups[k].sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
  });

  var html = '';
  _TOPIC_GROUP_ORDER.forEach(function(tg) {
    var arr = groups[tg.key];
    if (!arr || arr.length === 0) return;
    delete groups[tg.key]; // 처리 완료 마킹
    html += _renderTopicSection(tg.icon, tg.label, arr);
  });
  // 정의 안 된 토픽 잔여분
  Object.keys(groups).forEach(function(k) {
    if (groups[k].length === 0) return;
    html += _renderTopicSection('', k, groups[k]);
  });

  container.innerHTML = html || '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:12px;">카테고리 뉴스가 없습니다</div>';
}

function _renderTopicSection(icon, label, items) {
  var maxItems = 15; // 카테고리당 최대 표시
  var out = '<div style="margin-bottom:16px;">';
  out += '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(0,212,255,0.06);border-left:3px solid var(--accent);border-radius:0 6px 6px 0;margin-bottom:6px;">';
  out += '<span style="font-size:14px;">' + icon + '</span>';
  out += '<span style="font-size:12px;font-weight:700;color:var(--text-primary);">' + escHtml(label) + '</span>';
  out += '<span style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);margin-left:auto;">' + items.length + '건</span>';
  out += '</div>';
  items.slice(0, maxItems).forEach(function(item) {
    var absTime = typeof getAbsoluteTime === 'function' ? getAbsoluteTime(item.pubDate) : '';
    var timeAgo = item.pubDate ? getTimeAgo(new Date(item.pubDate)) : '';
    var displayTitle = escHtml(typeof getDisplayTitle === 'function' ? getDisplayTitle(item) : (item.title || ''));
    var displayDesc = typeof getDisplayDesc === 'function' ? getDisplayDesc(item) : (item.desc || '');
    var displaySummary = typeof getDisplaySummary === 'function' ? getDisplaySummary(item) : '';
    var sent = getSentimentFromText(item.title + ' ' + (item.desc || ''));
    var dotColor = sent === 'bull' ? '#00e5a0' : sent === 'bear' ? '#ff5b50' : sent === 'warn' ? '#ffa31a' : '#7b8599';
    var _macroT = ['macro','geo','energy','bond','fx'] // v46.9: TOPIC_KEYWORDS 실존 키만 유지 (geopolitics/policy/fed/rates/trade는 classifyTopic 미반환);
    var tickers = !_macroT.includes(item.topic) ? getDisplayTickers(item) : [];
    // v48.55: 뉴스 티커 배지 → ticker 페이지 이동 액션 추가 (뉴스 → 기업 3-hop 네비게이션)
    var tickerStr = tickers.length > 0 ? tickers.map(function(t) { var _sym = t.replace('$',''); return '<span data-action="_aioNewsTickerClick" data-arg="' + escHtml(_sym) + '" role="button" tabindex="0" style="font-size:8px;font-weight:800;color:#60a5fa;font-family:var(--font-mono);background:rgba(0,212,255,0.1);padding:1px 4px;border-radius:3px;margin-right:2px;cursor:pointer;" title="' + escHtml(_sym) + ' 종목 분석">' + escHtml(t) + '</span>'; }).join('') : '';
    var source = escHtml(item.source || '');
    var scoreStr = item.score > 0 ? '<span style="font-size:9px;color:' + (item.score > 50 ? '#00e5a0' : item.score > 30 ? '#ffa31a' : 'var(--text-muted)') + ';font-family:var(--font-mono);">■' + item.score + '</span>' : '';
    var descHtml = displayDesc ? '<div style="font-size:10px;color:var(--text-secondary);margin-top:2px;line-height:1.4;">' + escHtml(displayDesc) + '</div>' : '';
    var summaryHtml = displaySummary ? '<div style="font-size:9px;color:#a78bfa;margin-top:2px;font-style:italic;line-height:1.3;">' + escHtml(displaySummary) + '</div>' : '';
    out += '<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 12px;cursor:pointer;border-radius:4px;transition:background 0.15s;" data-open-url="' + escHtml(escUrl(item.link)) + '" onmouseover="this.style.background=\'var(--bg-hover)\'" onmouseout="this.style.background=\'transparent\'">';
    out += '<span style="flex-shrink:0;width:4px;height:4px;border-radius:50%;background:' + dotColor + ';margin-top:7px;"></span>';
    out += '<div style="flex:1;min-width:0;">';
    out += '<div style="font-size:11px;color:var(--text-primary);line-height:1.4;font-weight:600;">' + tickerStr + displayTitle + '</div>';
    out += descHtml;
    out += summaryHtml;
    out += '<div style="font-size:8px;color:var(--text-muted);margin-top:2px;">' + (item.flag||'') + ' ' + source + ' · ' + (absTime || timeAgo) + ' ' + scoreStr + '</div>';
    out += '</div></div>';
  });
  if (items.length > maxItems) {
    out += '<div style="text-align:center;padding:4px;font-size:9px;color:var(--text-muted);">외 ' + (items.length - maxItems) + '건</div>';
  }
  out += '</div>';
  return out;
}

/* ── renderFeed(): 뉴스 목록 렌더링 (시장 소식 페이지) ──────── */
function renderFeed(items) {
  if (!items || items.length === 0) return;

  // v29.1: 블랙리스트 2차 필터 (번역 후 한국어 제목 + 설명에도 적용)
  let filtered = items.filter(i => {
    if (i._blacklisted) return false;
    const text = ((i.title||'') + ' ' + (getDisplayTitle(i)||'') + ' ' + (i.desc||'')).toLowerCase();
    return !NEWS_BLACKLIST_KW.some(kw => text.includes(kw.toLowerCase()));
  });

  // v48.19 (bugfix): 국가 필터 그룹 매핑 확장
  // 기존: 'asia' 비교 → jp/cn/hk/tw/sg/qa 매칭 실패(country 값과 불일치). 'eu' 비교 → uk 누락(BBC/FT/Economist).
  // 신규: 'asia' = jp+cn+hk+tw+sg+in+qa 그룹, 'eu' = eu+uk 그룹, 'tg' = 텔레그램 전용
  if (typeof currentCountryFilter !== 'undefined' && currentCountryFilter && currentCountryFilter !== 'all') {
    var cf = currentCountryFilter.toLowerCase();
    if (cf === 'asia') {
      var ASIA_COUNTRIES = ['jp','cn','hk','tw','sg','in','qa'];
      filtered = filtered.filter(i => ASIA_COUNTRIES.indexOf((i.country||'').toLowerCase()) !== -1);
    } else if (cf === 'eu') {
      filtered = filtered.filter(i => ['eu','uk'].indexOf((i.country||'').toLowerCase()) !== -1);
    } else if (cf === 'tg') {
      // 텔레그램 전용: _tgChannel flag OR source prefix 'TG ' OR tgSlug 존재
      filtered = filtered.filter(i => i._tgChannel === true || /^TG\s/i.test(i.source||'') || !!i.tgSlug);
    } else {
      filtered = filtered.filter(i => (i.country || '').toLowerCase() === cf);
    }
  }

  // 토픽 필터
  if (typeof currentTopicFilter !== 'undefined' && currentTopicFilter && currentTopicFilter !== 'all') {
    filtered = filtered.filter(i => i.topic === currentTopicFilter || (i.topics && i.topics.includes(currentTopicFilter)));
  }

  // v34.9: 뉴스 유형 탭 필터
  if (_newsTypeTab === 'company') {
    filtered = filtered.filter(function(i){ return isCompanyNews(i); });
  } else if (_newsTypeTab === 'market') {
    filtered = filtered.filter(function(i){ return !isCompanyNews(i); });
  }

  // 시간 필터 (48h)
  filtered = filterByAge(filtered, TW_MARKET_H);
  // v40.4: 최소 선별도 — score 30+ (브리핑 45+보다 낮지만 쓸모없는 뉴스는 제거)
  filtered = filtered.filter(i => (i.score || 0) >= 30);

  // v21: 정렬 모드 적용
  // v39.0: 시간순에서도 중요도 가중 혼합 정렬 — 30분 버킷 + score 영향력 확대
  if (_newsSortMode === 'time') {
    filtered.sort((a, b) => {
      const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      // v39.0: 30분(1800000ms) 버킷으로 확장 — 같은 시간대 내 중요도 정렬 기회 확대
      const bucketA = Math.floor(ta / 1800000);
      const bucketB = Math.floor(tb / 1800000);
      if (bucketA !== bucketB) return bucketB - bucketA; // 최신 버킷 먼저
      // v39.0: 같은 시간 버킷 내에서 score 우선 정렬 (중요 뉴스 먼저)
      // score 차이가 15점 이상이면 score 우선, 아니면 소스 등급 + score 보조
      const scoreDiff = (b.score || 0) - (a.score || 0);
      if (Math.abs(scoreDiff) >= 15) return scoreDiff;
      // 소스 등급 비교
      const _srcPri = (item) => {
        if (item.tier === 1 && item.country === 'us') return 100;
        if (item.tier === 1 && item.country !== 'kr') return 90;
        if (item._tgChannel) return 80;
        if (item.tier === 2 && item.country !== 'kr') return 65;
        if (item.tier === 1 && item.country === 'kr') return 50;
        if (item.tier === 2 && item.country === 'kr') return 30;
        return 20;
      };
      const priDiff = _srcPri(b) - _srcPri(a);
      if (priDiff !== 0) return priDiff;
      return scoreDiff;
    });
  } else {
    filtered.sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  // 렌더링
  const container = document.getElementById('live-news-feed');
  if (!container) return;

  if (filtered.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted);font-size:12px;">필터 조건에 맞는 뉴스가 없습니다</div>';
    return;
  }

  // v42.0: 카테고리별 그룹 뷰
  if (_newsTypeTab === 'category') {
    _renderCategoryGroupView(filtered, container);
    var countEl2 = document.getElementById('market-news-count');
    if (countEl2) countEl2.textContent = filtered.length + '건';
    return;
  }

  // v21: 날짜 그룹별 렌더링 (시간순일 때)
  let lastDateLabel = '';
  // v34.9: 기업 뉴스 탭이면 간결 불릿 형식으로 렌더링
  var useCompanyBulletFormat = (_newsTypeTab === 'company');

  // v40.4: 건수 상한 150건 (브리핑 20건보다 넓지만 과부하 방지)
  filtered = filtered.slice(0, 150);
  const html = filtered.map((item, idx) => {
    // 기업 뉴스 간결 불릿 형식
    if (useCompanyBulletFormat) {
      // 날짜 그룹 헤더
      let dateHeader = '';
      if (_newsSortMode === 'time' && item.pubDate) {
        const dl = getDateLabel(item.pubDate);
        if (dl && dl !== lastDateLabel) {
          lastDateLabel = dl;
          dateHeader = `<div style="padding:8px 14px 4px;font-size:9px;font-weight:700;color:var(--accent);border-bottom:1px solid rgba(0,212,255,0.15);margin-top:${idx > 0 ? '6px' : '0'};">${dl}</div>`;
        }
      }
      return dateHeader + renderCompanyBullet(item);
    }

    // 기존 카드 형식 (전체/시장 뉴스)
    const sent = getSentimentFromText(item.title + ' ' + (item.desc || ''));
    const sentColor = sent === 'bull' ? '#00e5a0' : sent === 'bear' ? '#ff5b50' : sent === 'warn' ? '#ffa31a' : '#7b8599';
    const topicBadge = getTopicBadge(item.topic || 'general');
    const unverifiedBadge = isUnverifiedClaim(item) ? '<span class="news-unverified-badge">⚠ 미확인</span>' : '';

    // 시간 표시: "14:32" 형태 + 상대시간
    const absTime = getAbsoluteTime(item.pubDate);
    const timeAgo = item.pubDate ? getTimeAgo(new Date(item.pubDate)) : '';
    const timeDisplay = absTime ? absTime : timeAgo;

    // v39.0e: 티커는 매크로/지정학/정책 뉴스에서 숨김 — 기업/실적/섹터 뉴스에만 표시
    const _MACRO_TOPICS = ['macro','geo','energy','bond','fx'] // v46.9: TOPIC_KEYWORDS 실존 키만 유지 (geopolitics/policy/fed/rates/trade는 classifyTopic 미반환);
    const _showTicker = !_MACRO_TOPICS.includes(item.topic);
    const tickers = _showTicker ? getDisplayTickers(item) : [];
    const tickerHtml = tickers.length > 0
      ? `<span class="news-tickers">${tickers.map(t => `<span class="news-ticker-badge" style="color:#60a5fa;font-weight:800;font-size:9px;font-family:var(--font-mono);background:rgba(0,212,255,0.1);padding:1px 4px;border-radius:3px;margin-right:3px;">${escHtml(t)}</span>`).join('')}</span>`
      : '';

    // 번역된 제목/설명/해석
    const displayTitle = escHtml(getDisplayTitle(item));
    const displayDesc = getDisplayDesc(item);
    const displaySummary = getDisplaySummary(item);
    const descHtml = displayDesc ? `<div class="news-item-desc" style="font-size:10px;color:var(--text-secondary);margin-top:2px;line-height:1.4;">${escHtml(displayDesc)}</div>` : '';
    const summaryHtml = displaySummary ? `<div style="font-size:9px;color:#a78bfa;margin-top:2px;font-style:italic;line-height:1.3;">${escHtml(displaySummary)}</div>` : '';

    // 스코어 바
    const scoreBar = item.score > 0 ? `<span style="font-size:9px;color:${item.score > 50 ? '#00e5a0' : item.score > 30 ? '#ffa31a' : 'var(--text-muted)'};font-family:var(--font-mono);">■${item.score}</span>` : '';

    // 날짜 그룹 헤더 (시간순 정렬일 때만)
    let dateHeader = '';
    if (_newsSortMode === 'time' && item.pubDate) {
      const dl = getDateLabel(item.pubDate);
      if (dl && dl !== lastDateLabel) {
        lastDateLabel = dl;
        dateHeader = `<div style="padding:8px 14px 4px;font-size:9px;font-weight:700;color:var(--accent);border-bottom:1px solid rgba(0,212,255,0.15);margin-top:${idx > 0 ? '6px' : '0'};">${dl}</div>`;
      }
    }

    return `${dateHeader}<div class="news-item-card" data-open-url="${escHtml(escUrl(item.link))}" title="${escHtml((item.title||'').slice(0,200))}">
      <div class="news-time-col">
        <span class="news-time-abs">${timeDisplay}</span>
        <span class="news-time-dot" style="background:${sentColor};"></span>
      </div>
      <div class="news-item-body">
        <div class="news-item-headline">${tickerHtml}${displayTitle}</div>
        ${descHtml}
        ${summaryHtml}
        <div class="news-item-meta">${item._tgChannel ? '<span style="background:rgba(139,92,246,0.15);color:#a78bfa;font-size:9px;font-weight:700;padding:1px 4px;border-radius:3px;margin-right:4px;">TG</span>' : ''}${unverifiedBadge}${item.flag||''} ${escHtml(item.source||'')} · ${timeAgo} ${scoreBar}</div>
      </div>
      ${topicBadge}
    </div>`;
  }).join('');

  container.innerHTML = html;

  // 카운트 업데이트
  const countEl = document.getElementById('market-news-count');
  if (countEl) countEl.textContent = filtered.length + '건';
}

/* ── renderHomeFeed(): 홈 "오늘의 시장" 하단에 핵심 뉴스 불릿 (v39.0) ── */
// v40.4: 홈 핵심뉴스 — 시장 전체에 영향을 주는 핵심 뉴스 2~3개 (정적, 새 이벤트 발생 시 수동 교체)
var HOME_WEEKLY_NEWS = [
  { title: 'AVGO-META MTIA 다년간 GW 확장 약정(2029+) — 초기 1GW+, 학습/추론/네트워킹 통합. Hock Tan 메타이사회 퇴임→어드바이저 전환. 메타 커스텀 실리콘 지연 우려 불식. AVGO AI 매출 2027 $100B→$130B+(Citi $100B당 EPS +$1) · Bernstein PT$525/Citi PT$475. GOOG LTA 2031+Anthropic 3.5GW TPU 누적 = 공급 가시성 다층 확대. AI 인프라 공급사 멀티이어 수주잔고 구조적 재평가 국면.', source: 'Citi/Bernstein', date: '2026-04-16', sentiment: 'bull', topic: 'semi' },
  { title: 'TSMC 2026 가이던스 "30%+" 상향 + 2026-2028 3년 Capex $190-200B(역대급, 전 3년 대비 2배) — 1Q26 매출 NT$1.134조(+35%YoY, 컨센 전면상회) GM 66.2%/OPM 58.1%. 선단 캐파 2027까지 타이트, N5 이하 CAGR 25%. 2027 가격 +4-5% like-for-like 인상 논의(2Q 콘콜 예정). C.C.Wei "차세대 LPU 고객과 긴밀 협력" = 삼성 Groq 수주 단기 경계. ASML도 조기 가이던스 상향(€365→€380억 중간값) — 1분기 조기 상향 = 수요 강도 신호.', source: 'TSMC IR/JPM/Citi', date: '2026-04-17', sentiment: 'bull', topic: 'semi' },
  { title: 'Citi 자산배분 전환 — 미국 중립→OW 상향, EM 중립 하향("이익 확산 균열"). 매그7+ 지수 시총 40% + PEG 기준 GFC 후 저점 = 역설적 퀄리티 매수 기회. FactSet: S&P 500 Q1 EPS 서프라이즈 88%(5년 평균 78%) BUT 긍정 주가 반응 -0.2% = "이미 반영" 해석. NVDA 제외 시 매그7 성장률 6.4% < 나머지 493사 10.1% 역전. GS 한국 피드백: 미국 투자자 SEC>HXSCL 선호(HBM4 리더십+주주환원 임박), 메모리 LTA 레버리지 역전 논쟁. 연말 목표 S&P 7,700(+13%), MSCI ACWI 1,380(+12%).', source: 'Citi/FactSet/GS', date: '2026-04-18', sentiment: 'warn', topic: 'market' },
];

function renderHomeFeed(items) {
  const container = document.getElementById('home-news-highlights');
  if (!container) return;

  // v40.4: 정적 주간 큐레이션 우선 표시
  if (HOME_WEEKLY_NEWS && HOME_WEEKLY_NEWS.length > 0) {
    const sentIcons = { bull: '<span class="sd sd-g"></span>', bear: '<span class="sd sd-r"></span>', warn: '<span class="sd sd-y"></span>', neutral: '<span class="sd sd-w"></span>' };
    container.innerHTML = '<div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.05em;margin-bottom:4px;">핵심 뉴스</div>' +
      HOME_WEEKLY_NEWS.map(function(n) {
        // v46.4: 필드 누락 방어
        if (!n) return '';
        n.title = n.title || ''; n.source = n.source || ''; n.date = n.date || ''; n.sentiment = n.sentiment || 'neutral';
        var icon = sentIcons[n.sentiment] || '<span class="sd sd-w"></span>';
        return '<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.03);">' +
          '<span style="flex-shrink:0;font-size:10px;line-height:1.6;">' + icon + '</span>' +
          '<div style="flex:1;min-width:0;">' +
          '<div style="font-size:11px;font-weight:600;color:var(--text-primary);line-height:1.4;">' + escHtml(n.title) + '</div>' +
          '<div style="font-size:8px;color:var(--text-muted);margin-top:1px;">' + escHtml(n.source) + ' · ' + n.date + '</div>' +
          '</div></div>';
      }).join('');
    return;
  }

  // 폴백: 동적 뉴스 (HOME_WEEKLY_NEWS가 비어있을 때만)
  if (!items || items.length === 0) return;

  // v39.0c: 72시간 이내 + score 90+ 진짜 시장 이동 이벤트만
  let filtered = filterByAge(items, 72);
  filtered = filtered.filter(i => !i._blacklisted && i.topic !== 'analyst' && (i.score || 0) >= 90);

  // 중요도 가중: 매크로/지정학/정책 > 실적 > 기업 뉴스
  filtered.forEach(i => {
    i._homeBoost = (i.score || 0);
    // 시장 전체에 영향 주는 이벤트 최우선
    if (['geopolitics','policy','fed','rates'].includes(i.topic)) i._homeBoost += 30;
    else if (i.topic === 'macro') i._homeBoost += 25;
    else if (i.topic === 'earnings') i._homeBoost += 15;
    else if (i.topic === 'trade') i._homeBoost += 20;
    // 프리미엄 소스 부스트
    if (['Reuters','Bloomberg','WSJ','CNBC','FT Markets','NYT Business'].some(s => (i.source||'').includes(s))) i._homeBoost += 10;
  });
  filtered.sort((a, b) => (b._homeBoost || 0) - (a._homeBoost || 0));

  // 제목 유사도 기반 중복 제거 (같은 이벤트에 대한 다른 기사 방지)
  const seenKeys = new Set();
  filtered = filtered.filter(i => {
    const key = (getDisplayTitle(i) || i.title || '').slice(0, 30).toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
  filtered = filtered.slice(0, 3);

  // 미달 시 score 70+로 완화
  if (filtered.length < 2) {
    const existing = new Set(filtered.map(i => i.link));
    const backup = filterByAge(items, 72)
      .filter(i => !existing.has(i.link) && !i._blacklisted && (i.score || 0) >= 70)
      .sort((a, b) => (b.score || 0) - (a.score || 0))
      .slice(0, 3 - filtered.length);
    filtered = filtered.concat(backup);
  }

  if (filtered.length === 0) {
    container.innerHTML = '<div style="font-size:9px;color:var(--text-muted);">현재 핵심 뉴스가 없습니다.</div>';
    return;
  }

  // v39.0c: 간결 불릿 — 한국어 제목, 기업 뉴스에만 티커, 클릭 시 원문
  container.innerHTML = '<div style="font-size:9px;color:var(--text-muted);font-weight:700;letter-spacing:0.05em;margin-bottom:4px;">핵심 뉴스</div>' +
    filtered.map(item => {
    const sent = getSentimentFromText(item.title + ' ' + (item.desc || ''));
    const sentIcon = sent === 'bull' ? '<span class="sd sd-g"></span>' : sent === 'bear' ? '<span class="sd sd-r"></span>' : sent === 'warn' ? '<span class="sd sd-y"></span>' : '<span class="sd sd-w"></span>';
    const timeAgo = item.pubDate ? getTimeAgo(new Date(item.pubDate)) : '';
    const displayTitle = escHtml(getDisplayTitle(item));
    // v39.0e: 티커는 매크로/지정학/정책 뉴스에서 숨김
    const _hMacroTopics = ['macro','geopolitics','policy','fed','rates','trade'];
    const tickers = !_hMacroTopics.includes(item.topic) ? getDisplayTickers(item) : [];
    // v48.55: 홈 피드 티커 클릭 → ticker 페이지 이동
    const tickerStr = tickers.length > 0
      ? tickers.slice(0,2).map(t => { const _s = t.replace('$',''); return `<span data-action="_aioNewsTickerClick" data-arg="${escHtml(_s)}" role="button" tabindex="0" style="font-size:8px;font-weight:800;color:#60a5fa;font-family:var(--font-mono);cursor:pointer;" title="${escHtml(_s)} 분석">${escHtml(t.startsWith('$') ? t : '$'+t)}</span>`; }).join(' ') + ' '
      : '';
    return `<div data-open-url="${escHtml(escUrl(item.link))}" style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;cursor:pointer;border-bottom:1px solid rgba(255,255,255,0.03);" onmouseenter="this.style.background='rgba(0,212,255,0.05)'" onmouseleave="this.style.background='transparent'">
      <span style="flex-shrink:0;font-size:10px;line-height:1.6;">${sentIcon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:11px;font-weight:600;color:var(--text-primary);line-height:1.4;">${tickerStr}${displayTitle}</div>
        <div style="font-size:8px;color:var(--text-muted);margin-top:1px;">${escHtml(item.source||'')} · ${timeAgo}</div>
      </div>
    </div>`;
  }).join('');
}

/* ── renderBriefingFeed(): 브리핑 뉴스 (24시간) ───────────── */
// v42.0: 브리핑 8AM KST 앵커 — 오전 8시 기준 24시간 윈도우
function _getBriefingWindowKST() {
  var now = new Date();
  // 오늘 8AM KST를 UTC로 계산
  var todayAnchor = new Date(now);
  todayAnchor.setUTCHours(8 - 9, 0, 0, 0); // 8AM KST = 23:00 UTC (전날)
  if (todayAnchor.getTime() > now.getTime()) {
    // 아직 오늘 8AM KST 안 됨 → 어제 8AM이 앵커
    todayAnchor.setDate(todayAnchor.getDate() - 1);
  }
  var windowStart = todayAnchor.getTime();
  var windowEnd = windowStart + 24 * 3600000;
  // 다음 갱신 시각
  var nextRefresh = new Date(windowEnd);
  return { start: windowStart, end: windowEnd, nextRefresh: nextRefresh, anchorDate: todayAnchor };
}

// 브리핑 캐시 키: 앵커 날짜 기반
var _briefingCacheKey = null;
var _briefingCachedHtml = null;

function renderBriefingFeed(items) {
  const container = document.getElementById('briefing-live-news-list');
  if (!container) return;
  if (!items || items.length === 0) {
    container.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:11px;">뉴스 로딩 중...</div>';
    return;
  }

  // v42: 8AM KST 기준 24시간 윈도우
  var bw = _getBriefingWindowKST();
  var cacheKey = bw.anchorDate.toISOString().slice(0, 10);

  // 이미 같은 앵커 날짜로 캐시가 있으면 재사용 (다음 8AM까지 고정)
  if (_briefingCacheKey === cacheKey && _briefingCachedHtml) {
    container.innerHTML = _briefingCachedHtml;
    _updateBriefingTimestamp(bw);
    return;
  }

  // 8AM~8AM 윈도우 필터링
  var filtered = items.filter(function(i) {
    if (!i.pubDate) return false;
    var t = new Date(i.pubDate).getTime();
    return t >= bw.start && t < bw.end;
  });
  filtered = filtered.filter(function(i) { return !i._blacklisted && (i.score || 0) >= 45; }); // R22: 브리핑 임계값 45+
  // score 내림차순 → 상위 40건 선별
  filtered.sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
  filtered = filtered.slice(0, 40);

  // 카테고리별 그룹핑
  var groups = {};
  filtered.forEach(function(item) {
    var t = item.topic || 'general';
    if (!groups[t]) groups[t] = [];
    groups[t].push(item);
  });

  // 뉴스 요약 텍스트 생성 (AI 프롬프트용 + 폴백 렌더링용)
  var summaryLines = [];
  var bulletHtml = '';
  _TOPIC_GROUP_ORDER.forEach(function(tg) {
    var arr = groups[tg.key];
    if (!arr || arr.length === 0) return;
    delete groups[tg.key];
    summaryLines.push('\n【' + tg.label + '】');
    var sectionBullets = '';
    arr.slice(0, 5).forEach(function(item) {
      var title = (typeof getDisplayTitle === 'function' ? getDisplayTitle(item) : item.title) || '';
      var desc = (typeof getDisplayDesc === 'function' ? getDisplayDesc(item) : item.desc) || '';
      summaryLines.push('- ' + title + (desc ? ' — ' + desc.substring(0, 100) : ''));
      sectionBullets += _renderBriefingBullet(item);
    });
    bulletHtml += _renderBriefingSection(tg.icon, tg.label, sectionBullets, arr.length);
  });
  // 잔여 토픽
  Object.keys(groups).forEach(function(k) {
    var arr = groups[k];
    if (!arr || arr.length === 0) return;
    summaryLines.push('\n【기타】');
    var sectionBullets = '';
    arr.slice(0, 3).forEach(function(item) {
      var title = (typeof getDisplayTitle === 'function' ? getDisplayTitle(item) : item.title) || '';
      summaryLines.push('- ' + title);
      sectionBullets += _renderBriefingBullet(item);
    });
    bulletHtml += _renderBriefingSection('', k, sectionBullets, arr.length);
  });

  var totalCount = filtered.length;
  var countEl = document.getElementById('briefing-24h-count');
  if (countEl) countEl.textContent = totalCount + '건';
  _updateBriefingTimestamp(bw);

  // 브리핑 헤더 (날짜 범위 표시)
  var periodStart = new Date(bw.start).toLocaleDateString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  var periodEnd = new Date(bw.end).toLocaleDateString('ko-KR', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' });
  var briefingHeader = '<div style="margin-bottom:14px;padding:10px 12px;background:rgba(139,92,246,0.06);border-radius:8px;border:1px solid rgba(139,92,246,0.12);">' +
    '<div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:4px;">오늘의 시장 브리핑</div>' +
    '<div style="font-size:9px;color:var(--text-muted);">' + periodStart + ' ~ ' + periodEnd + ' KST · 총 ' + totalCount + '건 선별</div>' +
    '</div>';

  // AI 브리핑 생성 시도
  var apiKey = typeof getApiKey === 'function' ? getApiKey() : '';
  if (apiKey && summaryLines.length > 2) {
    // 먼저 로딩 UI 표시
    container.innerHTML = '<div style="text-align:center;padding:24px;">' +
      '<div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:8px;">AI 브리핑 생성 중...</div>' +
      '<div style="font-size:10px;color:var(--text-muted);margin-bottom:12px;">' + totalCount + '건의 뉴스를 분석·해석하고 있습니다. 30초~1분 소요될 수 있습니다.</div>' +
      '<div style="width:40px;height:40px;border:3px solid rgba(0,212,255,0.2);border-top-color:var(--accent);border-radius:50%;animation:spin 1s linear infinite;margin:0 auto;"></div>' +
      '</div>';
    _generateAIBriefing(summaryLines.join('\n'), bw, bulletHtml, cacheKey, briefingHeader);
  } else {
    // API 키 없어도 분석 글 형태로 표시
    var noAiNote = apiKey ? '' : '<div style="padding:10px 12px;font-size:10px;color:var(--text-secondary);background:rgba(139,92,246,0.05);border-radius:6px;margin-bottom:12px;line-height:1.5;border:1px dashed rgba(139,92,246,0.2);">' +
      '<strong style="color:#a78bfa;">AI 분석 브리핑을 원하시나요?</strong><br>' +
      '설정에서 Claude API 키를 등록하면 아래 뉴스를 AI가 종합 분석·해석·연결하여 전문 브리핑을 생성합니다.</div>';
    var finalHtml = briefingHeader + noAiNote + bulletHtml;
    _briefingCacheKey = cacheKey;
    _briefingCachedHtml = finalHtml;
    container.innerHTML = finalHtml || '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:11px;">해당 기간 뉴스가 없습니다</div>';
  }
}

// AI 브리핑 생성
async function _generateAIBriefing(newsText, bw, fallbackHtml, cacheKey, briefingHeader) {
  var container = document.getElementById('briefing-live-news-list');
  if (!container) return;
  var apiKey = getApiKey();
  var anchorStr = bw.anchorDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  briefingHeader = briefingHeader || '';

  var prompt = '당신은 전문 금융 애널리스트입니다. 아래는 ' + anchorStr + ' 08:00 KST ~ 24시간 동안 수집된 주요 뉴스입니다.\n\n' +
    newsText + '\n\n' +
    '【현재 매크로 맥락 — 씨티 4/18 재조정 + 2% 물가목표 붕괴 (v48.18)】\n' +
    '• Fed 경로 극적 가격 오류 정상화: 호르무즈 재개통(유조선/상업선박 통행 재개) → Fed 정책금리 가격 재조정. 근원 PCE 끈적 + 안정적 노동시장 → 단기 동결 압박. BUT 근원 인플레 완화 + 노동시장 이완 시 **연말 -75bp 인하 전망(씨티 공식 뷰)**. Warsh 청문회 — 연말 인하 지지 가능성, 단기 관망.\n' +
    '• FOMC 듀얼 리스크 지속: "vast majority" 고용 하방 + 인플레 상방 동시. 비주거 서비스 끈적. "Some" 양방향 금리 시그널.\n' +
    '• 2% 물가목표 구조적 붕괴: 2% 목표 = 90년대 뉴질랜드 임의 출발 → 2010년대 중반 "싸게→착하게" 미덕 전환 = 중물가 시대. Forward Guidance 실패(2021-22) vs Data Dependence 역풍(현재). "2%가 정상" 가정 자체 검토 필요.\n' +
    '• 분절화 리스크 3축: ① 세계화 효율 → 최소 선함(탈세계화) ② 코로나 충격 미회복 ③ 미국 주도 분절화("너희가 비싸도 우리만 싸면 됨"). 호르무즈 봉쇄 통념 붕괴 → 대체 수출경로(홍해 등) 비용 전이.\n' +
    '• 재무부-연준 힘겨루기: 2023년 교훈 — 연준 브레이크(5%+QT) vs 재무부 액셀(TGA방출+T-bill) → 액셀 승리(S&P +24%). 2026년 베센트 유동성 도구 + 감세(OBBBA $1,500~1,600억) + 중간선거 7개월 전 = 정치적 유동성 인센티브.\n\n' +
    '【Citi 자산배분 전환 — 이익 확산 균열 (v48.18)】\n' +
    '• 지역: 미국 중립→OW 상향, EM OW→중립 하향. "이익 확산(broadening)" 논리 균열 확인 — 이익 성장이 다시 AI/테크로 재집중. 매그7+가 지수 시총 40% 점유하면서 **PEG 기준 GFC 후 저점** = 역설적 퀄리티 매수 기회.\n' +
    '• 연말 목표: MSCI ACWI 1,380(+12%), S&P 500 7,700(+13%), 토픽스 4,200(+12%), MSCI EM 1,770(+16%). Stoxx 600 640(+4%), FTSE 100 10,700(+1%).\n' +
    '• 섹터: IT/소재/헬스케어 OW, 커뮤니케이션/필수소비재 UW. 테크 내 반도체 > 소프트웨어.\n' +
    '• 핵심 리스크: 시클리컬 컨센서스 2026 +20% 하향 조정 리스크. Citi 톱다운 +16%(보수적).\n' +
    '• 베어마켓 체크리스트: 글로벌 18개 중 8개 적신호(비싼 밸류에이션 주원인). 미국 9개(다소 거품이나 매수 후 보유 가치 유지), 유럽 4개(양호).\n' +
    '• 포지셔닝: 미국 제외 대다수 지수의 강세 포지션 이란 사태 이후 청산 완료 → 디리스킹→숏 구축 단계. 레브코비치 모델 미국 심리 "유포리아" 재진입.\n' +
    '• 라틴아메리카 = EM 내 핵심 지정학 헤지.\n\n' +
    '【반도체/AI 인프라 — 공급 가시성 확대 + 캐파 타이트 2027까지 (v48.18)】\n' +
    '• AVGO-Meta MTIA 2029년 확장: 초기 1GW+, 학습/추론/네트워킹 통합, Hock Tan 메타이사회 퇴임 → 어드바이저. 커스텀 실리콘 지연 우려 불식. AVGO AI 매출 2027 $100B → $130B+ 상향 컨빅션. GOOG LTA 2031, Anthropic 3.5GW TPU 2027 누적.\n' +
    '• TSMC 선단 캐파 2027까지 타이트: 2026-2028 3년 Capex $190~200B(역대급, 이전 3년 대비 2배). 2027 가격 +4-5% like-for-like 인상 논의(2Q26 콘콜). N5 이하 CAGR 25%. C.C.Wei "차세대 LPU 고객과 긴밀 협력" = 삼성 Groq 수주 단기 경계.\n' +
    '• ASML 가이던스 체계 전환: 오더 비공시 이후 "연초 보수 → 연중 상향" 패턴. 1분기 조기 상향(€340-390→€360-400억 중간값 €380, +€15억) = 수요 강도 신호. 2027 Low NA EUV 최소 80대 공약(VA 컨센 72 상회).\n' +
    '• HBM+HBF 3계층 패러다임: SanDisk HBF 일정 6개월 앞당김(26H2 파일럿, 27초 AI 추론 디바이스). 스택당 512GB 16레이어 = HBM 대비 동일비용 8-16배 용량. AI 훈련→추론 전환 = 용량 최적화 메모리 신카테고리.\n' +
    '• 메모리 LTA 레버리지 역전(GS 한국 피드백): 기존 "LTA=정점 신호" → 신규 "고객 선제안=공급사 레버리지 확보". SEC 1Q OP만으로 역대 최강 2017-2018 연간평균 상회 = ROE/P/B 구조 전환. SEC > HXSCL 선호(미국 투자자), HBM4 고핀속도 11Gbps+ 램프업 문제 미보고 = SEC 점유 확대 수혜.\n' +
    '• CoreWeave 프론티어 랩 독점: Meta $21B 신규(2032 Vera Rubin)+Meta $14B 기존+OpenAI $22B+Anthropic 수십억 = 합산 $58B+. NVIDIA 3중 관계(공급+고객+투자자)가 비NVDA 호스팅 차단. 2025말 가격 +20% 인상 보고(WSJ).\n' +
    '• Nvidia Rubin 로드맵: CX9 NIC(포트당 800G→1.6Tb/s) 개발 과제로 일부 2026→2027 이월 가능(TrendForce). Citi 2026 Rubin 비중 31% 전망(TrendForce 수정치 22% 상회).\n' +
    '• Marvell 역할 확장: Google TPU 신규 설계 벤더 승격(MediaTek급) + Google LPU(Groq 대응 LLM 전용 추론) 신규 아키텍처 논의. NVLink Fusion IP블록 제공으로 XPU 이진선택→스펙트럼 전환.\n\n' +
    '【JPM 하드웨어/네트워킹 1Q26 — AI 밸류에이션 로테이션 (v48.18)】\n' +
    '• 핵심 메시지: 이번 실적 시즌 펀더멘털 < **밸류에이션 드라이버**. AI 관련주 밸류에이션 프리미엄 과거 평균 +83%(직전 +79%). 광/T&M/HDD 프리미엄 쏠림, EMS/네트워킹/IT HW 프리미엄 완화.\n' +
    '• 순위 재편 Top10: 1)ANET PT$200 2)APH PT$190 3)CLS 4)STX PT$600 Positive Catalyst 5)WDC PT$400 6)CRDO 7)CSCO 8)JBL 9)FLEX 10)COHR. HDD/EMS/DELL 상승, 광학주 하락.\n' +
    '• 4건 OW→N 하향: GLW PT$175(NTM PE 50배+), FN PT$700+Negative Catalyst, NTAP PT$110(NAND 계약가 C4Q25 +36%→C2Q26 +73% 전례 없음 → FY27 GPM -200bps), QCOM PT$140+Negative Catalyst(ARM AGI CPU + Nvidia Groq LPX 경쟁).\n' +
    '• HDD 가장 압도적 긍정: 완만한 가격 인상↑ + HAMR 전환 가속 COGS↓ 동시 진행. STX HAMR 주도권 F3Q/F4Q GPM 긍정 서프라이즈 여지.\n' +
    '• 광학 vs 구리 논쟁: 시장의 광 대체 우려 과도. APH(AFL 2위) = 구리 최대 수혜. 광학은 2028년 이익 봐야 밸류에이션 정당화.\n\n' +
    '【FactSet 어닝 인사이트 — NVDA 제외 매그7 역전 (v48.18)】\n' +
    '• Q1 2026 EPS 서프라이즈 88%(5년 평균 78%). 매출 서프라이즈 84%(5년 평균 70%). S&P 500 Q1 혼합 EPS 성장률 13.2%(6분기 연속 두 자릿수).\n' +
    '• **NVDA 제외 시 매그7 성장률 6.4% < 나머지 493개사 10.1%** — 이익 주도권이 NVDA 단독 집중. CY2026 전체로도 NVDA 제외 시 매그7 24.8%→13.2% 하락.\n' +
    '• 긍정적 서프라이즈 주가 반응 -0.2%(5년 평균 +1.0% 대비) = "좋은 실적 이미 가격 반영" 해석.\n' +
    '• 섹터: IT +45.1%(반도체 +95% 주도), 금융 +19.7%, 소재 +21.6% 강세. 에너지 -13.1%(Exxon EPS $1.83→$1.07), 헬스케어 -10.5%(Merck Cidara 일회성). 순이익률 IT 28.9% vs 에너지 6.8%.\n\n' +
    '【DC 규제 전환 + 테라팹 신규 수요 (v48.18)】\n' +
    '• Maine 주 20MW+ 신규 DC 2027 가을까지 모라토리엄 통과(미국 최초 주 단위). 최소 12개 주 유사 검토. 지난해 무산 DC 프로젝트 $1,520억.\n' +
    '• 온사이트 발전 신수요: Wartsila 34SG 엔진 412MW 오하이오 하이퍼스케일 DC(선박 엔진 DC 전력 첫 사례). 전력망 연결 지연 회피 수요. 리드타임 2년.\n' +
    '• 머스크 테라팹(TSLA+SpaceX JV): AMAT/TEL/LRCX에 "빛의 속도" 견적 요청 — 포토마스크/기판/식각/증착/세정/테스트 전방위. 삼성 테일러 팹 대안 요청 거절. 도쿄 일렉트론 +6% 급등, 어드반테스트/스크린HD/디스코 주가 견인.\n\n' +
    '【AI 보안 정부 개입 표준화 (v48.18)】\n' +
    '• OpenAI TAC(Trust Access for Cyber) 14개 초기 파트너: CRWD(양쪽 독점 — Glasswing+TAC 조기접근)+PANW(Glasswing)+ZS(TAC 신규 진입)+NVDA+ORCL+CSCO + 금융 7개 + 스타트업 2개. GPT-5.4 Cyber(원본 코드 없이 클로즈드 SW 취약점 분석).\n' +
    '• 미국 CAISI/영국 AISI 연방기관 접근 제공 = 규제 표준화 경로. "AI 보안 ≠ 프론티어 모델 단독 해결" → 예산 촉매.\n\n' +
    '【지정학(4/14 기준)】\n' +
    '• 4/12 이슬라마바드 21시간 협상 결렬 → 4/13 호르무즈 봉쇄 발효 → 4/18 재개통 진행. 트럼프 "접근 선박 격침" 경고. Brent $103(+8%)→$95, WTI $98→$91. 봉쇄 장기화 시 공급갭 1,400만bbl/d.\n\n' +
    '【주요 예정 이벤트 (v48.18 업데이트)】\n' +
    '• 04/22-24 Google Cloud Next 라스베이거스 — 에이전트/인프라/고객 수주. 1일차 GCP CEO 기조연설(TPU/Rubin GPU/제미나이 3.5 가능성).\n' +
    '• 04/28-29 FOMC — 듀얼 리스크 확인.\n' +
    '• 04/29 GOOGL 1Q26 실적(Citi PT$405 90일 촉매).\n' +
    '• 05/13 CPI + Brandcast.\n' +
    '• 05/19-20 Google I/O — Gemini 3.5 예상.\n' +
    '• 05/20 Google Marketing Live.\n' +
    '• 어닝 시즌 진행 중: GS/JPM/TSM/NFLX/ASML 완료, MSFT/GOOGL/AMZN/META 예정.\n\n' +
    '위 뉴스와 매크로·반도체·스태그 맥락을 교차 분석하여 기관급 모닝 브리핑을 작성하세요.\n\n' +
    '=== 작성 원칙 ===\n' +
    '1. 뉴스를 "나열"하지 마라. 서사(narrative)로 엮어라. 마치 골드만삭스 CIO가 고객에게 보내는 데일리 노트처럼.\n' +
    '2. 모든 팩트에 출처를 붙여라 (예: "Reuters에 따르면", "Bloomberg 보도", "WSJ 단독").\n' +
    '3. "왜 중요한지"를 반드시 수치·선례·인과관계로 설명하라.\n' +
    '4. 인과관계 체인은 → 화살표로 연결 (예: CPI 상회 → 금리인하 기대 후퇴 → 성장주 멀티플 압축 → 나스닥 -2%).\n' +
    '5. 각 섹션 끝에 "주시 포인트"를 넣어 투자자가 바로 행동할 수 있게 하라.\n\n' +
    '=== 형식 규칙 (반드시 준수) ===\n' +
    '- 마크다운 ## 으로 섹션 구분 (시스템이 자동으로 카드 UI로 변환함)\n' +
    '- ####, ---, 수평선 절대 사용 금지\n' +
    '- ### 은 섹션 내 소제목에만 사용\n' +
    '- 한국어 작성, 전문용어는 괄호 안 쉬운 설명\n\n' +
    '=== 섹션 구조 (이 순서대로) ===\n\n' +
    '## 핵심 요약\n' +
    '오늘 시장의 핵심을 3~5문장으로. "투자자가 딱 하나만 읽는다면 이것"이라는 마음으로.\n\n' +
    '## 매크로·통화정책\n' +
    '(해당 뉴스가 있을 때만) 금리, CPI, 고용, Fed 발언 등. 출처 명시. 시장 영향 분석.\n\n' +
    '## 지정학·무역\n' +
    '(해당 뉴스가 있을 때만) 관세, 제재, 분쟁, 외교. 투자 함의 중심.\n\n' +
    '## 반도체·AI\n' +
    '(해당 뉴스가 있을 때만) 실적, 수급, 기술 트렌드. 밸류체인 영향.\n\n' +
    '## 에너지·원자재\n' +
    '(해당 뉴스가 있을 때만) 유가, 금, 원자재. 인플레 연결.\n\n' +
    '## 개별 주식·실적\n' +
    '(해당 뉴스가 있을 때만) 어닝, 가이던스, 투자의견 변경.\n\n' +
    '## 연결고리\n' +
    '서로 다른 섹션의 뉴스가 어떻게 연결되는지. 최소 2개의 인과관계 체인을 → 로 보여줘라.\n\n' +
    '## 리스크 & 기회\n' +
    '구체적 시나리오 + 트리거 + 영향받는 자산을 명시.\n\n' +
    '## 향후 48시간 이벤트\n' +
    '날짜, 시간(KST), 종목/지표를 테이블 형식으로.\n\n' +
    '=== 금지 사항 ===\n' +
    '- #### 사용 금지\n' +
    '- --- 수평선 금지\n' +
    '- "사실:", "해석:", "영향:" 같은 기계적 라벨 금지 — 자연스러운 문장으로 녹여라\n' +
    '- 뉴스 원문 그대로 복붙 금지 — 반드시 분석·해석·연결해서 서사를 만들어라';

  try {
    var resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    if (!resp.ok) throw new Error('API ' + resp.status);
    var data = await resp.json();
    var aiText = data.content && data.content[0] ? data.content[0].text : '';
    if (!aiText) throw new Error('빈 응답');

    // 마크다운 → HTML 변환 (간단)
    var aiHtml = _markdownToHtml(aiText);

    var finalHtml = briefingHeader +
      '<div style="padding:2px 0;">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:12px;padding:10px 12px;background:rgba(139,92,246,0.08);border-radius:8px;border:1px solid rgba(139,92,246,0.15);">' +
      '<span style="font-size:16px;">🤖</span>' +
      '<div style="flex:1;">' +
      '<div style="font-size:12px;font-weight:700;color:#a78bfa;">AI 종합 분석 브리핑</div>' +
      '<div style="font-size:8px;color:var(--text-muted);margin-top:1px;">' + new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'}) + ' 생성 · Claude Haiku</div>' +
      '</div></div>' +
      '<div class="ai-briefing-content" style="font-size:11px;line-height:1.8;color:var(--text-primary);padding:0 4px;">' + aiHtml + '</div>' +
      '</div>' +
      '<div style="border-top:1px solid var(--border);margin-top:18px;padding-top:12px;">' +
      '<div style="display:flex;align-items:center;gap:6px;margin-bottom:10px;">' +
      '<span style="font-size:10px;font-weight:700;color:var(--text-secondary);">원본 뉴스 상세</span>' +
      '<span style="font-size:8px;color:var(--text-muted);">(' + cacheKey + ')</span></div>' +
      fallbackHtml +
      '</div>';

    _briefingCacheKey = cacheKey;
    _briefingCachedHtml = finalHtml;
    container.innerHTML = finalHtml;
  } catch(e) {
    _aioLog('warn', 'fetch', 'AI 브리핑 생성 실패: ' + (e.message || e));
    // 폴백: 카테고리별 분석 글
    var errNote = '<div style="padding:8px 10px;font-size:9px;color:#fbbf24;background:rgba(255,163,26,0.08);border-radius:6px;margin-bottom:10px;">AI 분석 브리핑 생성 실패 (' + escHtml(e.message || '알 수 없는 오류') + ') — 카테고리별 뉴스 상세로 표시합니다.</div>'; // v42.5: XSS 방어
    var finalHtml = briefingHeader + errNote + fallbackHtml;
    _briefingCacheKey = cacheKey;
    _briefingCachedHtml = finalHtml;
    container.innerHTML = finalHtml;
  }
}

// v46.6: 마크다운 → 전문가 레포트 HTML 변환
// ## → 섹션 카드, ### → 서브 라벨, 불릿 → 인사이트 행, 번호 → 스텝 카드
var _SECTION_ICONS = {
  '핵심':'⚡','요약':'⚡','executive':'⚡','summary':'⚡',
  '매크로':'📊','통화':'📊','금리':'📊','fed':'📊','fomc':'📊',
  '지정학':'🌍','무역':'🌍','관세':'🌍','정치':'🌍',
  '반도체':'🔬','ai':'🤖','테크':'💻','기술':'💻',
  '에너지':'⛽','원자재':'⛽','유가':'⛽',
  '주식':'📈','실적':'📈','어닝':'📈','개별':'📈',
  '채권':'💰','환율':'💱','달러':'💱',
  '연결':'🔗','크로스':'🔗','cross':'🔗','link':'🔗',
  '리스크':'⚠️','기회':'🎯','위험':'⚠️',
  '이벤트':'📅','일정':'📅','향후':'📅','내일':'📅'
};
function _mdSectionIcon(title) {
  var t = title.toLowerCase();
  for (var k in _SECTION_ICONS) { if (t.indexOf(k) !== -1) return _SECTION_ICONS[k]; }
  return '▸';
}
function _markdownToHtml(md) {
  var html = md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // 섹션 구분선 (---) → 보이지 않는 간격
  html = html.replace(/^---+$/gm, '<div style="height:6px;"></div>');
  // 헤더 → 섹션 카드 (긴 패턴 먼저)
  html = html.replace(/^#{4,}\s+(.+)$/gm, function(m, t) {
    return '<div style="font-size:10px;font-weight:700;color:#60a5fa;margin:8px 0 4px;padding:3px 8px;background:rgba(0,212,255,0.05);border-radius:4px;display:inline-block;">' + t + '</div>';
  });
  html = html.replace(/^###\s+(.+)$/gm, function(m, t) {
    return '<div style="font-size:10.5px;font-weight:700;color:var(--text-secondary);margin:12px 0 5px;padding-left:10px;border-left:2px solid rgba(255,255,255,0.1);">' + t + '</div>';
  });
  html = html.replace(/^##\s+(.+)$/gm, function(m, t) {
    var icon = _mdSectionIcon(t);
    return '</div><div class="briefing-section" style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin:12px 0;">' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06);">' +
      '<span style="font-size:15px;">' + icon + '</span>' +
      '<span style="font-size:12px;font-weight:800;color:var(--text-primary);letter-spacing:0.3px;">' + t + '</span>' +
      '</div>';
  });
  html = html.replace(/^#\s+(.+)$/gm, function(m, t) {
    return '<div style="font-size:13px;font-weight:800;color:var(--text-primary);margin:14px 0 8px;">' + t + '</div>';
  });
  // 번호 리스트 → 스텝 카드
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, function(m, n, t) {
    return '<div style="display:flex;gap:10px;padding:5px 0;align-items:flex-start;">' +
      '<span style="background:rgba(139,92,246,0.12);color:#a78bfa;font-weight:800;font-size:10px;min-width:20px;height:20px;display:flex;align-items:center;justify-content:center;border-radius:50%;flex-shrink:0;">' + n + '</span>' +
      '<span style="flex:1;line-height:1.6;">' + t + '</span></div>';
  });
  // 굵은체
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary);">$1</strong>');
  // 불릿 → 인사이트 행
  html = html.replace(/^- (.+)$/gm, function(m, t) {
    // 화살표 체인(→) 포함 시 강조
    var hasChain = t.indexOf('→') !== -1;
    var style = hasChain
      ? 'display:flex;gap:8px;padding:4px 8px;margin:2px 0;background:rgba(0,212,255,0.04);border-radius:5px;'
      : 'display:flex;gap:8px;padding:3px 0;';
    return '<div style="' + style + '">' +
      '<span style="color:' + (hasChain ? '#a855f7' : 'var(--accent)') + ';flex-shrink:0;font-size:8px;margin-top:3px;">' + (hasChain ? '⟶' : '●') + '</span>' +
      '<span style="flex:1;line-height:1.6;">' + t + '</span></div>';
  });
  // 단락 간격
  html = html.replace(/\n{2,}/g, '<div style="height:6px;"></div>');
  html = html.replace(/\n/g, '<br>');
  // 첫 번째 빈 </div> 제거 (## 변환에서 생긴 닫는 태그)
  html = html.replace(/^<\/div>/, '');
  // 마지막에 열린 섹션 닫기
  if (html.indexOf('briefing-section') !== -1) html += '</div>';
  return html;
}

// v46.6: 브리핑 섹션 카드 렌더링 — AI 브리핑과 동일한 카드 UI
function _renderBriefingSection(icon, label, bulletsHtml, totalInGroup) {
  var out = '<div class="briefing-section" style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:12px;">';
  out += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(255,255,255,0.06);">';
  out += '<span style="font-size:15px;">' + icon + '</span>';
  out += '<span style="font-size:12px;font-weight:800;color:var(--text-primary);letter-spacing:0.3px;">' + escHtml(label) + '</span>';
  if (totalInGroup) out += '<span style="font-size:9px;color:var(--text-muted);font-family:var(--font-mono);margin-left:auto;background:rgba(255,255,255,0.04);padding:2px 6px;border-radius:3px;">' + totalInGroup + '건</span>';
  out += '</div>';
  out += '<div>' + bulletsHtml + '</div>';
  out += '</div>';
  return out;
}

// v46.6: 브리핑 기사 아이템 렌더링 — 카드형 + 출처/시간 강조 + 점수 뱃지
function _renderBriefingBullet(item) {
  var sent = getSentimentFromText(item.title + ' ' + (item.desc || ''));
  var dotColor = sent === 'bull' ? '#00e5a0' : sent === 'bear' ? '#ff5b50' : sent === 'warn' ? '#ffa31a' : '#7b8599';
  var sentLabel = sent === 'bull' ? '긍정' : sent === 'bear' ? '부정' : sent === 'warn' ? '주의' : '';
  var absTime = typeof getAbsoluteTime === 'function' ? getAbsoluteTime(item.pubDate) : '';
  var timeAgo = item.pubDate ? getTimeAgo(new Date(item.pubDate)) : '';
  var displayTitle = escHtml(typeof getDisplayTitle === 'function' ? getDisplayTitle(item) : (item.title || ''));
  var displayDesc = typeof getDisplayDesc === 'function' ? getDisplayDesc(item) : (item.desc || '');
  var displaySummary = typeof getDisplaySummary === 'function' ? getDisplaySummary(item) : '';
  var _macroT = ['macro','geo','energy','bond','fx'] // v46.9: TOPIC_KEYWORDS 실존 키만 유지 (geopolitics/policy/fed/rates/trade는 classifyTopic 미반환);
  var tickers = !_macroT.includes(item.topic) ? getDisplayTickers(item) : [];
  // v48.55: 브리핑 피드 티커 클릭 → ticker 페이지 이동
  var tickerStr = tickers.length > 0 ? tickers.map(function(t) { var _s = t.replace('$',''); return '<span data-action="_aioNewsTickerClick" data-arg="' + escHtml(_s) + '" role="button" tabindex="0" style="font-size:8px;font-weight:800;color:#60a5fa;font-family:var(--font-mono);background:rgba(0,212,255,0.1);padding:1px 4px;border-radius:3px;margin-right:2px;cursor:pointer;" title="' + escHtml(_s) + ' 분석">' + escHtml(t) + '</span>'; }).join('') : '';
  var sentBadge = sentLabel ? '<span style="font-size:8px;font-weight:700;color:' + dotColor + ';background:' + dotColor + '15;padding:1px 5px;border-radius:3px;">' + sentLabel + '</span>' : '';
  var unverBadge = isUnverifiedClaim(item) ? '<span style="font-size:8px;font-weight:700;background:rgba(255,163,26,0.1);color:#fbbf24;padding:1px 5px;border-radius:3px;border:1px solid rgba(255,163,26,0.25);">미확인</span>' : '';
  var scoreBadge = item.score ? '<span style="font-size:8px;font-weight:700;color:' + (item.score >= 80 ? '#ff5b50' : item.score >= 60 ? '#ffa31a' : '#7b8599') + ';font-family:var(--font-mono);">' + item.score + '</span>' : '';

  var out = '<div class="briefing-news-card" style="padding:10px 12px;margin-bottom:8px;border-radius:8px;background:rgba(255,255,255,0.025);border:1px solid rgba(255,255,255,0.04);cursor:pointer;transition:all 0.15s;" data-open-url="' + escHtml(escUrl(item.link)) + '" onmouseover="this.style.background=\'rgba(255,255,255,0.05)\';this.style.borderColor=\'rgba(0,212,255,0.15)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.025)\';this.style.borderColor=\'rgba(255,255,255,0.04)\'">';
  // 상단: 출처 + 시간 + 점수
  out += '<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap;">';
  out += '<span style="font-size:9px;font-weight:700;color:var(--accent);background:rgba(0,212,255,0.08);padding:1px 6px;border-radius:3px;">' + escHtml(item.source||'') + '</span>';
  out += '<span style="font-size:8px;color:var(--text-muted);font-family:var(--font-mono);">' + (absTime || timeAgo) + '</span>';
  if (sentBadge) out += sentBadge;
  if (unverBadge) out += unverBadge;
  if (scoreBadge) out += '<span style="margin-left:auto;">' + scoreBadge + '</span>';
  out += '</div>';
  // 제목
  out += '<div style="font-size:11px;font-weight:700;color:var(--text-primary);line-height:1.5;">' + tickerStr + displayTitle + '</div>';
  // 설명
  if (displayDesc) {
    out += '<div style="font-size:10px;color:var(--text-secondary);margin-top:4px;line-height:1.5;">' + escHtml(displayDesc) + '</div>';
  }
  // AI 요약
  if (displaySummary) {
    out += '<div style="font-size:9.5px;color:#a78bfa;margin-top:4px;line-height:1.4;padding:4px 8px;background:rgba(139,92,246,0.05);border-radius:4px;">' + escHtml(displaySummary) + '</div>';
  }
  out += '</div>';
  return out;
}

// 브리핑 타임스탬프 업데이트
function _updateBriefingTimestamp(bw) {
  var tsEl = document.getElementById('briefing-24h-ts');
  if (!tsEl) return;
  var anchorStr = bw.anchorDate.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ' 08:00';
  var nextStr = bw.nextRefresh.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) + ' 08:00';
  var now = Date.now();
  var remainH = Math.max(0, Math.floor((bw.end - now) / 3600000));
  var remainM = Math.max(0, Math.floor(((bw.end - now) % 3600000) / 60000));
  tsEl.textContent = anchorStr + ' ~ ' + nextStr + ' | 다음 갱신: ' + remainH + '시간 ' + remainM + '분 후';
}

/* ── 유틸리티: HTML 이스케이프 (use global escHtml) ────────── */
// escHtml defined globally at line ~8130

/* ── 유틸리티: 상대 시간 표시 ─────────────────────────────── */
function getTimeAgo(date) {
  if (!date || isNaN(date.getTime())) return '';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return diffMin + '분 전';
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return diffH + '시간 전';
  const diffD = Math.floor(diffH / 24);
  if (diffD < 7) return diffD + '일 전';
  return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

/* ── 뉴스→시그널 통합: 뉴스 감성 집계 ─────────────────────── */
function computeNewsSentimentScore() {
  if (!newsCache || newsCache.length === 0) return { score: 50, label: 'N/A', bullCount: 0, bearCount: 0, total: 0, bullRatio: 0, bearRatio: 0 };

  const recent = filterByAge(newsCache, 24); // 24시간 이내
  if (recent.length === 0) return { score: 50, label: '데이터 부족', bullCount: 0, bearCount: 0, total: 0, bullRatio: 0, bearRatio: 0 };

  let bullCount = 0, bearCount = 0, total = recent.length;
  recent.forEach(item => {
    const sent = getSentimentFromText(item.title + ' ' + (item.desc || ''));
    if (sent === 'bull') bullCount++;
    else if (sent === 'bear' || sent === 'warn') bearCount++;
  });

  // Bull ratio: 0 (all bear) ~ 100 (all bull)
  const bullRatio = Math.round((bullCount / total) * 100);
  const bearRatio = Math.round((bearCount / total) * 100);
  const sentimentScore = Math.round(50 + (bullCount - bearCount) / total * 50);

  let label;
  if (sentimentScore >= 70) label = '강한 낙관';
  else if (sentimentScore >= 55) label = '약한 낙관';
  else if (sentimentScore >= 45) label = '중립';
  else if (sentimentScore >= 30) label = '약한 비관';
  else label = '강한 비관';

  return {
    score: Math.max(0, Math.min(100, sentimentScore)),
    label,
    bullCount, bearCount, total,
    bullRatio, bearRatio
  };
}

/* ── 뉴스→시그널 통합: 매크로 리스크 집계 ──────────────────── */
function computeNewsRiskSignals() {
  if (!newsCache) return [];

  const recent = filterByAge(newsCache, 48); // 48시간 이내
  const riskSignals = [];

  // 지정학 리스크 카운트
  const geoNews = recent.filter(i => i.topic === 'geo');
  if (geoNews.length >= 5) {
    riskSignals.push({ type: 'geo', level: 'high', label: '지정학 리스크 고조 (' + geoNews.length + '건)', impact: -10 });
  } else if (geoNews.length >= 2) {
    riskSignals.push({ type: 'geo', level: 'mid', label: '지정학 이슈 존재 (' + geoNews.length + '건)', impact: -5 });
  }

  // 에너지 위기 신호
  const energyBear = recent.filter(i => i.topic === 'energy' && getSentimentFromText(i.title) === 'bear');
  if (energyBear.length >= 3) {
    riskSignals.push({ type: 'energy', level: 'high', label: '에너지 위기 신호 (' + energyBear.length + '건)', impact: -8 });
  }

  // 금융 스트레스 신호
  const creditStress = recent.filter(i => {
    const t = (i.title || '').toLowerCase();
    return t.includes('credit') || t.includes('default') || t.includes('spread') || t.includes('부도') || t.includes('신용');
  });
  if (creditStress.length >= 3) {
    riskSignals.push({ type: 'credit', level: 'high', label: '신용 스트레스 신호', impact: -12 });
  }

  // 실적 시즌 서프라이즈 방향
  const earningsBull = recent.filter(i => i.topic === 'earnings' && getSentimentFromText(i.title) === 'bull');
  const earningsBear = recent.filter(i => i.topic === 'earnings' && getSentimentFromText(i.title) === 'bear');
  if (earningsBull.length > earningsBear.length + 3) {
    riskSignals.push({ type: 'earnings', level: 'positive', label: '실적 시즌 긍정적', impact: +8 });
  } else if (earningsBear.length > earningsBull.length + 3) {
    riskSignals.push({ type: 'earnings', level: 'negative', label: '실적 시즌 부진', impact: -8 });
  }

  return riskSignals;
}

// ── 상태 ────────────────────────────────────────────────────────
let newsCache = [];
let lastFetchTime = 0;
let isFetching = false;
let _fetchStartTime = 0; // v29.3: isFetching 잠김 방지용 타임스탬프
let currentCountryFilter = 'all';
let currentTopicFilter = 'all';
let refreshTimer = null;

// ── RSS 파싱 ─────────────────────────────────────────────────────
// v29.4: 죽은 프록시 제거 (corsproxy.app 503)
// v30.11 Task 11: 하위 호환용 — 레거시 코드에서 참조하는 상수 유지 (_PROXY_REGISTRY가 진실 원천)
const CORS_PROXY  = 'https://api.allorigins.win/get?url=';
const CORS_PROXY2 = 'https://corsproxy.io/?';
const CORS_PROXY3 = 'https://api.codetabs.com/v1/proxy?quest=';
const CORS_PROXY5 = 'https://api.allorigins.win/raw?url=';

// CORS 프록시 우선순위 체인 (RSS용) — v29.4: corsproxy.app 제거
const PROXY_CHAIN = [
  u => CORS_PROXY2 + encodeURIComponent(u),
  u => CORS_PROXY  + encodeURIComponent(u),
  u => CORS_PROXY3 + encodeURIComponent(u),
  u => CORS_PROXY5 + encodeURIComponent(u),
];
// Multi-proxy fetch wrapper — v46.9: _PROXY_REGISTRY 통합 (fetchViaProxy 위임)
async function fetchWithProxy(url, ms) {
  ms = ms || 8000;
  try {
    var r = await fetchWithTimeout(url, {headers:{'Accept':'application/json'}}, ms);
    if(r.ok) return {ok:true,data:await r.json(),source:'direct'};
  } catch(e){ _debugWarn('[AIO] Direct fetch failed:', e); }
  // _PROXY_REGISTRY 기반 프록시 체인 활용 (fetchViaProxy와 동일 경로)
  if (typeof fetchViaProxy === 'function') {
    try {
      var resp = await fetchViaProxy(url, {timeout: ms, parseJson: true});
      if (resp) return {ok:true, data:resp, source:'proxyRegistry'};
    } catch(e) { _debugWarn('[AIO] ProxyRegistry fetch failed:', e); }
  }
  return {ok:false};
}


// v29.3: rss2json 연속 실패 시 세션 내 스킵 플래그
let _rss2jsonFailed = 0;

// v30.12 P4: RSS 소스별 실패 추적 — 연속 3회 실패 시 세션 내 건너뜀
const _rssSourceHealth = {}; // { sourceName: { fails: N, lastOk: ts } }
function _rssMarkOk(name) {
  _rssSourceHealth[name] = { fails: 0, lastOk: Date.now() };
}
function _rssMarkFail(name) {
  if (!_rssSourceHealth[name]) _rssSourceHealth[name] = { fails: 0, lastOk: 0 };
  _rssSourceHealth[name].fails++;
}
function _rssIsSkipped(name) {
  var h = _rssSourceHealth[name];
  return h && h.fails >= 3;
}

async function fetchOneFeed(source) {
  // v30.12 P4: 연속 3회 실패한 소스 건너뜀
  if (_rssIsSkipped(source.name)) {
    return [];
  }
  // v31.5: CF Worker가 있으면 CF Worker XML 파싱 우선 → rss2json은 CF Worker 없을 때만 폴백
  // (rss2json 무료 플랜 429 rate limit 방지)
  const _hasCfWorker = !!(_getApiKey('aio_cf_worker_url'));

  // CF Worker 없을 때만 rss2json 시도 (또는 CF Worker 실패 시 폴백)
  // v48.9: 공유 키 쿼터 사전 체크 (10000/day 도달 시 스킵)
  if (!_hasCfWorker && _rss2jsonFailed < 2 && !(typeof _isQuotaExceeded === 'function' && _isQuotaExceeded('rss2json'))) {
    try {
      const apiKey = _getApiKey('aio_rss2json_key') || '';
      const keyParam = apiKey ? '&api_key=' + apiKey : '';
      const r2jUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(source.url) + '&count=12' + keyParam;
      const r = await fetchWithTimeout(r2jUrl, {}, 5000);
      if (r.ok) {
        if (typeof _bumpApiCounter === 'function') _bumpApiCounter('rss2json');
        const d = await r.json();
        if (d.status === 'ok' && Array.isArray(d.items) && d.items.length > 0) {
          _rss2jsonFailed = 0;
          _rssMarkOk(source.name);
          return d.items
            .map(item => ({
              title:   (item.title || '').replace(/<[^>]+>/g,'').trim(),
              desc:    (item.description || item.content || '').replace(/<[^>]+>/g,'').trim().slice(0,280),
              link:    item.link || '#',
              pubDate: item.pubDate || '',
              source:  source.name, country: source.country,
              tier:    source.tier, flag: source.flag,
            }))
            .filter(i => i.title.length > 8);
        }
      }
      _rss2jsonFailed++;
    } catch(e) { _rss2jsonFailed++; }
  }

  // CORS 프록시 폴백 (XML 파싱) — v31.5: CF Worker 우선
  function parseXml(raw) {
    if (!raw || raw.length < 80) return [];
    // v38.3 B6: HTML entity 이중 인코딩 해제 (&amp;amp; → &amp; → &)
    function _decodeEntities(s) {
      if (!s) return s;
      // 최대 3회 반복 디코딩 (삼중 인코딩 방지)
      for (var i = 0; i < 3 && /&amp;|&lt;|&gt;|&quot;|&#\d+;|&#x[\da-f]+;/i.test(s); i++) {
        s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
      }
      return s;
    }
    try {
      const parser = new DOMParser();
      const xml = parser.parseFromString(raw, 'text/xml');
      const items = xml.querySelectorAll('item, entry');
      return Array.from(items).slice(0,12).map(item => {
        const title = _decodeEntities((item.querySelector('title')?.textContent||'').replace(/<!\[CDATA\[|\]\]>/g,'').trim());
        const desc  = _decodeEntities((item.querySelector('description,summary,content')?.textContent||'').replace(/<[^>]+>/g,'').replace(/<!\[CDATA\[|\]\]>/g,'').trim().slice(0,280));
        const link  = item.querySelector('link')?.textContent?.trim() || item.querySelector('link')?.getAttribute('href') || '#';
        const pub   = item.querySelector('pubDate,published,updated')?.textContent || '';
        return { title, desc, link, pubDate:pub, source:source.name, country:source.country, tier:source.tier, flag:source.flag };
      }).filter(i => i.title.length > 8);
    } catch(e) { return []; }
  }

  // v46.6: 프록시 체인 확장 (5→7개) + CF Worker 우선
  const cfWorker = _getApiKey('aio_cf_worker_url') || '';
  const proxies = [
    ...(cfWorker ? [u => cfWorker + '?url=' + encodeURIComponent(u)] : []),
    u => 'https://corsproxy.io/?' + encodeURIComponent(u),
    u => 'https://corsproxy.org/?' + encodeURIComponent(u),
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
    u => 'https://api.allorigins.win/get?url=' + encodeURIComponent(u),
    u => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(u),
    u => 'https://api.cors.lol/?url=' + encodeURIComponent(u),
  ];
  for (const mkProxy of proxies) {
    try {
      const resp = await fetchWithTimeout(mkProxy(source.url), {}, 6000); // v46.6: 9s→6s (빠른 실패 → 빠른 다음 프록시)
      if (!resp.ok) { if (resp.status === 429) await new Promise(r => setTimeout(r, 1500)); continue; }
      let raw = '';
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('json')) {
        const w = await resp.json();
        raw = w.contents ? (typeof w.contents === 'string' ? w.contents : JSON.stringify(w.contents)) : JSON.stringify(w);
      } else {
        raw = await resp.text();
        if (raw.trimStart().startsWith('{')) {
          try { const w = JSON.parse(raw); raw = w.contents || raw; } catch(e2) {} 
        }
      }
      const items = parseXml(raw);
      if (items.length > 0) { _rssMarkOk(source.name); return items; } // v30.12 P4
    } catch(e) {}
  }
  _rssMarkFail(source.name); // v30.12 P4: 모든 프록시 실패
  if (window.NewsStore) NewsStore.reportDeadFeed(source.url, 'all-proxies-failed');
  return [];
}


// ── 텔레그램 메시지에서 원문 출처 자동 추출 ──────────────────────
function extractOriginalSource(text) {
  if (!text) return null;
  // 패턴 1: "출처: XXX", "출처 : XXX", "Source: XXX"
  const srcPatterns = [
    /(?:출처|source|src|via|from)\s*[:：]\s*([^\n\r,()]{2,40})/i,
    /[-–—]\s*([A-Z][A-Za-z\s&.]{2,30}(?:Research|Capital|Securities|Analytics|Intelligence|Partners|Group|Bank|Institute|News|Wire|Press))/,
    /\(([A-Z][A-Za-z\s&.]{2,30})\)\s*$/m,
  ];
  for (const pat of srcPatterns) {
    const m = text.match(pat);
    if (m && m[1]) return m[1].trim();
  }
  // 패턴 2: 알려진 기관/외신사 이름 직접 매칭
  const knownSources = [
    'Reuters','Bloomberg','CNBC','WSJ','Wall Street Journal','Financial Times','FT',
    'Goldman Sachs','Morgan Stanley','JP Morgan','JPMorgan','Barclays','Citi','Citigroup',
    'Bank of America','BofA','Deutsche Bank','UBS','Credit Suisse','Nomura','CLSA',
    'Bernstein','Jefferies','Piper Sandler','Wedbush','KeyBanc','Stifel',
    'Nikkei','NHK','Kyodo','Yomiuri','Mainichi',
    'SCMP','South China Morning Post','Caixin','Xinhua','Global Times',
    'Hana Securities','Samsung Securities','NH투자증권','미래에셋','키움증권',
    'TrendForce','DigiTimes','Counterpoint','IDC','Gartner','Omdia',
    'Fed','Federal Reserve','ECB','BOJ','PBOC','IMF','World Bank','BIS',
    'Seeking Alpha','MarketWatch','Investing.com','Yahoo Finance',
    'AP','Associated Press','AFP','Yonhap','연합뉴스',
    'The Information','Semafor','Axios','Politico','The Economist',
    'Refinitiv','FactSet','S&P Global','Moody\'s','Fitch',
  ];
  const textLower = text.toLowerCase();
  for (const src of knownSources) {
    if (textLower.includes(src.toLowerCase())) return src;
  }
  return null;
}

// ── 텔레그램 메시지 관련성 필터 (주식/매크로/기관 리포트 선별) ────
function isTelegramMsgRelevant(text) {
  if (!text || text.length < 12) return false;  // v33.5: 20→12 (CJK 문자는 정보밀도 높아 18자도 완전한 문장)
  const t = text.toLowerCase();
  // 스팸/광고 필터
  // v33.3: '무료' 단독→복합패턴 구체화, '가입' 단독 제거(ETF 가입 등 정당사용)
  const spamKW = ['광고','sponsored','ad ','join ','subscribe','홍보','이벤트 참여','click here',
    'giveaway','airdrop','free tokens','sign up','telegram bot','promo code','referral',
    '경품','추첨','텔레그램 봇','프로모션','레퍼럴',
    '무료 이벤트','무료 참여','무료 가입','무료 체험','무료 쿠폰','무료 배송'];
  if (spamKW.some(kw => t.includes(kw))) return false;
  // v31.8→v34.1: 비금융 콘텐츠 강화 차단 + NEWS_BLACKLIST_KW 통합
  const tgBlackKW = ['recipe','workout','dating','celebrity','movie review','game review',
    'horoscope','astrology','meme coin','shitcoin','pump signal','buy signal guaranteed',
    '연예','아이돌','드라마','맛집','운동법','별자리','밈코인','펌핑','100배'];
  if (tgBlackKW.some(kw => t.includes(kw))) return false;
  // v34.1: 글로벌 블랙리스트도 적용 (지역 뉴스 등)
  if (NEWS_BLACKLIST_KW.some(kw => t.includes(kw.toLowerCase()))) return false;
  // v39.0: 너무 광범위한 단독 키워드 매칭 방지 — 이 키워드만 1개 매칭되면 불충분
  // "space"만으로 통과 → 우주와 무관한 맥락 가능, "stock"만으로 통과 → 비금융 맥락 가능
  const _TG_BROAD_KW = new Set(['space','market','report','note','stock','share','investment',
    'spending','cost','profit','launch','trade','bond','credit','flow','sector',
    '시장','기업','산업','경제','금융','수출','수입','에너지','투자']);
  // 관련성 키워드 (최소 1개 이상 포함해야 통과)
  const relevantKW = [
    // 영문 매크로/시장
    'fed','fomc','cpi','ppi','gdp','inflation','rate cut','rate hike','treasury','yield',
    'earnings','revenue','guidance','forecast','outlook','estimate','target','upgrade','downgrade',
    'tariff','trade war','sanction','geopolitical','recession','employment','payroll','jobs',
    'bull','bear','rally','sell-off','selloff','correction','volatility','vix',
    // 영문 섹터/산업
    'semiconductor','chip','ai ','artificial intelligence','nvidia','tsmc','samsung','apple','google',
    'amazon','microsoft','meta','tesla','bitcoin','crypto','oil','gold','commodity',
    'ipo','m&a','merger','acquisition','buyback','dividend',
    // 기관/리포트
    'goldman','morgan stanley','jpmorgan','barclays','citi','nomura','ubs','deutsche',
    'raymond james','wedbush','piper sandler','jefferies','bernstein','stifel',
    'report','research','note','analyst','rating','pt ','price target',
    // v33.3: 시장 영향력 핵심 인물 (영문)
    'trump','biden','powell','yellen','lagarde','jensen huang','tim cook','elon musk',
    'altman','buffett','dimon','dalio','ackman','druckenmiller',
    // v31.8: 채권·통화·거시 심화
    'bond','credit','spread','duration','curve','inversion','steepening','flattening',
    'dollar','dxy','yen','euro','yuan','won','currency','forex','fx',
    'central bank','ecb','boj','boe','pboc','bok','monetary','fiscal',
    'pmi','ism','consumer confidence','retail sales','industrial production',
    'housing','permits','durable goods','trade balance','current account',
    // v31.8: 기업 이벤트 심화
    'stock','share','equity','market cap','valuation','multiple','pe ratio',
    'profit','margin','ebitda','fcf','cash flow','balance sheet',
    'capex','investment','spending','cost cut','restructuring','layoff',
    'insider','13f','sec','filing','proxy','activist',
    'defense','military','weapon','arms','nuclear','uranium',
    // v33.3: 우주/항공우주 (영문)
    'spacex','nasa','boeing','lockheed','northrop','raytheon','rocket lab','satellite','orbit',
    'launch','aerospace','space force','starship','falcon','pentagon','darpa','space','rocket',
    'battery','lithium','ev ','electric vehicle','solar','wind','hydrogen',
    'biotech','pharma','fda','clinical','pipeline','drug',
    'shipbuilding','shipping','freight','logistics','container',
    // v31.8: 시장 구조
    'short interest','options','futures','derivatives','hedge','swap',
    'dark pool','market maker','gamma','delta','theta',
    'breadth','advance','decline','new high','new low',
    'flow','inflow','outflow','rotation','sector',
    // 한국어
    '금리','인플레','기준금리','연준','실적','매출','가이던스','전망','목표가','상향','하향',
    '반도체','ai','엔비디아','삼성','애플','테슬라','비트코인','원유','금값',
    '관세','무역','제재','고용','실업','경기','침체','호황',
    '리포트','보고서','애널리스트','증권사','투자의견',
    '급등','급락','폭등','폭락','신고가','신저가','속보',
    // v31.8: 한국어 심화
    '채권','국채','회사채','크레딧','스프레드','금통위','한국은행','통화정책',
    '환율','원달러','엔화','위안화','달러인덱스',
    '주식','주가','시장','코스피','코스닥','나스닥','다우',
    '영업이익','순이익','컨센서스','어닝','배당','자사주',
    '외국인','기관','수급','공매도','대차','신용',
    '방산','군수','조선','원전','2차전지','바이오','신약',
    // v33.3: 우주/항공우주 (한국어)
    '우주','로켓','위성','달 탐사','항공우주','발사체','궤도','스페이스','보잉',
    '록히드','레이시온','노스롭','한화에어로','NASA','펜타곤','방위비','국방부','스타링크',
    // v33.3: 핵심 인물 (한국어)
    '트럼프','바이든','파월','옐런','젠슨 황','일론 머스크','올트먼','버핏','네타냐후','시진핑','푸틴',
    // v33.3: AI/테크 인프라 (한국어)
    '오픈AI','데이터센터','클라우드','서버','GPU','HBM',
    // v33.3: 애널리스트 리포트 (한국어)
    '목표 주가','강력 매수','매수의견','비중확대',
    '수출','수입','무역수지','경상수지','PMI',
    '부양책','긴축','양적완화','테이퍼링','피봇',
    // 일본어 (Aether Japan Research) — v33.3: 9→21개 확장
    '日銀','金利','半導体','決算','為替','円安','円高','株価','市場',
    '利上げ','利下げ','景気','株式','投資','企業','収益','配当','防衛','宇宙','ロケット','衛星','原発','原子力',
  ];
  // v39.0: 매칭된 키워드 수집 — 광범위 키워드만 1개 매칭이면 불통과
  const matchedKW = relevantKW.filter(kw => t.includes(kw));
  if (matchedKW.length === 0) return false;
  // 매칭된 키워드 중 구체적(비광범위) 키워드가 1개 이상이면 통과
  const hasSpecificKW = matchedKW.some(kw => !_TG_BROAD_KW.has(kw));
  if (hasSpecificKW) return true;
  // 광범위 키워드만 매칭된 경우: 2개 이상이어야 통과
  return matchedKW.length >= 2;
}

async function fetchTelegramDirect(channelSlug, sourceName) {
  const tgUrl = `https://t.me/s/${channelSlug}`;
  const cfW = _getApiKey('aio_cf_worker_url') || '';
  // v46.6: 프록시 체인 확장 (5→7개)
  const proxies = [
    ...(cfW ? [u => `${cfW}?url=${encodeURIComponent(u)}`] : []),
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    u => `https://corsproxy.org/?${encodeURIComponent(u)}`,
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://api.allorigins.win/get?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
    u => `https://api.cors.lol/?url=${encodeURIComponent(u)}`,
  ];
  let lastErr = null;
  for (let pi = 0; pi < proxies.length; pi++) {
    const mkP = proxies[pi];
    try {
      const r = await fetchWithTimeout(mkP(tgUrl), {}, 10000);
      if (!r.ok) { // v27.3: r.ok 검증 추가
        _debugWarn(`[AIO TG] ${sourceName} proxy ${pi+1}/${proxies.length}: HTTP ${r.status}`);
        continue;
      }
      const ct = r.headers.get('content-type') || '';
      let raw = '';
      if (ct.includes('json')) {
        const d = await r.json();
        raw = typeof d.contents === 'string' ? d.contents : (typeof d === 'string' ? d : '');
      } else {
        raw = await r.text();
        // allorigins raw 등 JSON 래핑 없이 직접 HTML 반환하는 경우
        if (raw.trimStart().startsWith('{')) {
          try { const w = JSON.parse(raw); raw = w.contents || raw; } catch(e2) {}
        }
      }
      if (!raw || raw.length < 500) {
        _debugWarn(`[AIO TG] ${sourceName} proxy ${pi+1}: 응답 너무 짧음 (${(raw||'').length}자)`);
        continue;
      }
      const parser = new DOMParser();
      const doc = parser.parseFromString(raw, 'text/html');
      const msgs = doc.querySelectorAll('.tgme_widget_message_wrap');
      if (!msgs.length) {
        // Telegram DOM 구조 변경 대비: 대체 셀렉터 시도
        const altMsgs = doc.querySelectorAll('[class*="message_wrap"], [data-post]');
        if (!altMsgs.length) {
          _debugWarn(`[AIO TG] ${sourceName} proxy ${pi+1}: 메시지 DOM 파싱 실패`);
          continue;
        }
      }
      const msgEls = msgs.length ? msgs : doc.querySelectorAll('[class*="message_wrap"], [data-post]');
      const items = [];
      msgEls.forEach(wrap => {
        const textEl = wrap.querySelector('.tgme_widget_message_text, [class*="message_text"]');
        const dateEl = wrap.querySelector('time');
        const linkEl = wrap.querySelector('.tgme_widget_message_date, [class*="message_date"]');
        if (!textEl) return;
        const fullText = (textEl.innerText || textEl.textContent || '').trim();
        if (!fullText) return;
        // 관련성 필터: 주식/매크로/기관 리포트 관련 메시지만 선별
        if (!isTelegramMsgRelevant(fullText)) return;
        const title = fullText.slice(0, 200);
        // 원문 출처 추출 (채널명 대신 실제 외신사/기관명 사용)
        const originalSrc = extractOriginalSource(fullText);
        const displaySource = originalSrc
          ? `${originalSrc} (TG)`
          : `${sourceName}`;
        items.push({
          title,
          desc: fullText.slice(0, 280),
          link: linkEl ? (linkEl.getAttribute('href') || tgUrl) : tgUrl,
          pubDate: dateEl ? dateEl.getAttribute('datetime') : new Date().toISOString(),
          source: displaySource,
          feed: sourceName,
          tier: 1,
          flag: '',
          _tgChannel: channelSlug,
        });
      });
      if (items.length) {
        console.log(`[AIO TG] ${sourceName}: ${items.length}건 수집 (proxy ${pi+1})`);
        return items.reverse(); // 최신 순
      }
    } catch(e) {
      lastErr = e;
      _debugWarn(`[AIO TG] ${sourceName} proxy ${pi+1}/${proxies.length} 실패:`, e.message || e);
    }
  }
  _aioLog('error', 'fetch', sourceName + ': 모든 프록시(' + proxies.length + '개) 실패 ' + (lastErr?.message || ''));
  return [];
}

async function fetchAllNews(forceRefresh = false) {
  // v39.0: isFetching 안전장치 — 180초로 확장 (80소스 x 1.5초 딜레이 + 프록시 타임아웃 고려)
  if (isFetching && _fetchStartTime && Date.now() - _fetchStartTime > 180000) {
    _aioLog('warn', 'fetch', 'fetchAllNews isFetching 180s 초과 — 강제 리셋');
    isFetching = false;
  }
  if (isFetching) return;
  // v21: 캐시 유효 시간 10분 (5명 동시접속 시 불필요한 중복 호출 방지)
  if (!forceRefresh && Date.now() - lastFetchTime < 600000) {
    if (newsCache.length) {
      renderFeed(newsCache);
      renderHomeFeed(newsCache);
      renderBriefingFeed(newsCache);
    }
    return;
  }

  isFetching = true;
  _fetchStartTime = Date.now(); // v29.3: 잠김 방지 타임스탬프
  window._homeNewsEarlyRendered = false; // v34.5: 점진 렌더링 플래그 초기화
  window._briefingEarlyRendered = false; // v46.6: 브리핑 점진 렌더링 플래그
  // v27.3: 새로고침 시 번역 캐시 클리어 (오래된 캐시가 새 뉴스에 잘못 매핑되는 것 방지)
  if (forceRefresh) {
    _translationCache.clear();
    try { sessionStorage.removeItem('aio_tc'); } catch(e) {}
    // v46.6: 소스 헬스 리셋 — 3회 실패로 스킵된 소스에 재시도 기회
    Object.keys(_rssSourceHealth).forEach(function(k) { _rssSourceHealth[k] = { fails: 0, lastOk: 0 }; });
    _rss2jsonFailed = 0;
  }
  const feed = document.getElementById('live-news-feed');
  const dot  = document.getElementById('live-dot');
  const lbl  = document.getElementById('live-btn-label');
  if (dot) { dot.style.background = 'var(--yellow)'; dot.style.boxShadow = '0 0 5px var(--yellow)'; }
  if (lbl) lbl.textContent = '불러오는 중...';
  try { // v27.3: try-finally로 isFetching 영구 잠김 방지

  if (feed) feed.innerHTML = `
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:16px 20px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span style="font-size:20px;">⟳</span>
        <div>
          <div style="font-size:13px;font-weight:700;">실시간 뉴스 로딩 중...</div>
          <div style="font-size:11px;color:var(--text-secondary);">15개 소스 동시 접속 · Reuters · CNBC · Digitimes · TrendForce · 궈밍치 · Nikkei · SCMP 외</div>
        </div>
      </div>
      <div id="load-progress" style="height:4px;background:var(--bg-hover);border-radius:2px;overflow:hidden;">
        <div id="load-bar" style="height:100%;width:0%;background:var(--accent);transition:width 0.4s;border-radius:2px;"></div>
      </div>
      <div id="load-status" style="font-size:10px;color:var(--text-muted);margin-top:6px;"></div>
    </div>`;

  // v48.38: 헬스체크 — disabled 피드 자동 스킵 (dead RSS 자동 회피)
  const activeSources = (window._aioFeedHealth && typeof window._aioFeedHealth.isDisabled === 'function')
    ? AIO_NEWS_SOURCES.filter(function(s) { return !window._aioFeedHealth.isDisabled('rss:' + s.name); })
    : AIO_NEWS_SOURCES;
  const _skippedCount = AIO_NEWS_SOURCES.length - activeSources.length;
  if (_skippedCount > 0) {
    _aioLog('info', 'rss-health', _skippedCount + '개 RSS 소스 헬스체크로 자동 스킵');
  }
  const total = activeSources.length;
  let done = 0;
  const updateBar = (name) => {
    done++;
    const pct = Math.round(done / total * 100);
    const bar = document.getElementById('load-bar');
    const st  = document.getElementById('load-status');
    const progLabel = document.getElementById('news-progress-label');
    // v29.5: 홈 페이지 진행률도 함께 업데이트
    const homeBar = document.getElementById('home-news-progress-bar');
    const homeText = document.getElementById('home-news-progress-text');
    if (bar) bar.style.width = pct + '%';
    if (st)  st.textContent = `(${done}/${total}) ${name} 완료`;
    if (progLabel) progLabel.textContent = `뉴스 수집 중... ${done}/${total}`;
    if (homeBar) homeBar.style.width = pct + '%';
    if (homeText) homeText.textContent = `${done}/${total} 소스 수집 중...`;
  };

  // v21: 배치 분할 (3개씩 순차 배치 → CF Worker 100req/분 rate limit 안전)
  const BATCH_SIZE = 3;
  const results = [];
  for (let i = 0; i < activeSources.length; i += BATCH_SIZE) {
    const batch = activeSources.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(
      batch.map(s => {
        if (s.type === 'telegram') {
          const slug = s.tgSlug || s.url.split('/').pop();
          // v29: RSS 먼저 시도 → 실패 시 텔레그램 직접 파싱 (출처 추출 + 관련성 필터 적용)
          const enrichTgItems = (items) => {
            items.forEach(it => {
              const txt = (it.title || '') + ' ' + (it.desc || '');
              const origSrc = extractOriginalSource(txt);
              if (origSrc) it.source = `${origSrc} (TG)`;
              it.feed = s.name;
              it._tgChannel = slug;
            });
            return items.filter(it => isTelegramMsgRelevant((it.title||'') + ' ' + (it.desc||'')));
          };
          // v29: CF Worker → rss2json → CORS 프록시 → t.me 직접 스크래핑 순서
          // v38.4: rsshub 미러 프록시 배열 (rsshub.app 전면 장애 대비)
          const RSSHUB_MIRRORS = [
            'https://rsshub.rssforever.com',
            'https://rss.fatpandac.com',
            'https://rsshub.pseudoyu.com',
            'https://rsshub.moeyy.xyz',
            'https://rsshub.ktachibana.party',
            'https://rsshub.app',
          ];
          // v39.0: rsshub에서 403 차단된 채널 — 직접 스크래핑 우선
          const _TG_DIRECT_ONLY = ['walterbloomberg'];
          // v39.0: t.me/s/ 공개 미리보기 비활성화된 채널 — 스킵 (시간 낭비 방지)
          const _TG_UNAVAILABLE = ['firstsquawk', 'financialjuicechannel'];
          const tgPath = s.url.replace(/^https?:\/\/rsshub\.app/, '');
          return (async () => {
            // v39.0: 비활성 채널은 즉시 스킵
            if (_TG_UNAVAILABLE.includes(slug)) {
              _debugWarn(`[AIO TG] ${s.name}: 공개 미리보기 비활성 — 스킵`);
              updateBar(s.name);
              return [];
            }
            // v39.0: 직접 스크래핑 전용 채널 — CF Worker 1회 시도 후 빠르게 결과 반환
            if (_TG_DIRECT_ONLY.includes(slug)) {
              const cfW2 = _getApiKey('aio_cf_worker_url') || '';
              if (cfW2) {
                try {
                  const tgUrl2 = `https://t.me/s/${slug}`;
                  const r2 = await fetchWithTimeout(`${cfW2}?url=${encodeURIComponent(tgUrl2)}`, {}, 8000); // v48.27 (P4): 12s → 8s
                  if (r2.ok) {
                    const raw2 = await r2.text();
                    if (raw2 && raw2.length > 500) {
                      const doc2 = new DOMParser().parseFromString(raw2, 'text/html');
                      const msgs2 = doc2.querySelectorAll('.tgme_widget_message_wrap, [class*="message_wrap"], [data-post]');
                      const items2 = [];
                      msgs2.forEach(wrap => {
                        const textEl = wrap.querySelector('.tgme_widget_message_text, [class*="message_text"]');
                        const dateEl = wrap.querySelector('time');
                        const linkEl = wrap.querySelector('.tgme_widget_message_date, [class*="message_date"]');
                        if (!textEl) return;
                        const fullText = (textEl.innerText || textEl.textContent || '').trim();
                        if (!fullText || !isTelegramMsgRelevant(fullText)) return;
                        const originalSrc = extractOriginalSource(fullText);
                        items2.push({
                          title: fullText.slice(0, 200),
                          desc: fullText.slice(0, 280),
                          link: linkEl ? (linkEl.getAttribute('href') || tgUrl2) : tgUrl2,
                          pubDate: dateEl ? dateEl.getAttribute('datetime') : new Date().toISOString(),
                          source: originalSrc ? `${originalSrc} (TG)` : s.name,
                          feed: s.name, tier: 1, flag: '', _tgChannel: slug,
                        });
                      });
                      if (items2.length > 0) {
                        console.log(`[AIO TG] ${s.name}: CF Worker 직접 스크래핑 성공 (${items2.length}건)`);
                        updateBar(s.name);
                        return items2.reverse();
                      }
                    }
                  }
                } catch(e) { _debugWarn(`[AIO TG] ${s.name}: CF Worker 직접 스크래핑 실패`, e.message); }
              }
              // CF Worker 실패 시 기존 fetchTelegramDirect 폴백
              try {
                const items = await fetchTelegramDirect(slug, s.name);
                updateBar(s.name);
                if (items.length > 0) {
                  console.log(`[AIO TG] ${s.name}: 직접 스크래핑 폴백 성공 (${items.length}건)`);
                  return items;
                }
              } catch(e) { _debugWarn(`[AIO TG] ${s.name}: 직접 스크래핑 폴백 실패`, e.message); }
              updateBar(s.name);
              return [];
            }
            // 1) CF Worker로 rsshub 미러 순회 fetch 시도 (CORS 우회 가장 안정적)
            const cfW = _getApiKey('aio_cf_worker_url') || '';
            if (cfW) {
              for (const mirror of RSSHUB_MIRRORS) {
                try {
                const mirrorUrl = mirror + tgPath;
                const cfUrl = cfW + '?url=' + encodeURIComponent(mirrorUrl);
                const cfResp = await fetchWithTimeout(cfUrl, {}, 9000);
                if (cfResp.ok) {
                  const raw = await cfResp.text();
                  if (raw && raw.length > 200) {
                    const parser = new DOMParser();
                    const xml = parser.parseFromString(raw, 'text/xml');
                    const xmlItems = xml.querySelectorAll('item, entry');
                    if (xmlItems.length > 0) {
                      const parsed = Array.from(xmlItems).slice(0,12).map(item => {
                        const title = (item.querySelector('title')?.textContent||'').replace(/<!\[CDATA\[|\]\]>/g,'').trim();
                        const desc  = (item.querySelector('description,summary,content')?.textContent||'').replace(/<[^>]+>/g,'').replace(/<!\[CDATA\[|\]\]>/g,'').trim().slice(0,280);
                        const link  = item.querySelector('link')?.textContent?.trim() || item.querySelector('link')?.getAttribute('href') || '#';
                        const pub   = item.querySelector('pubDate,published,updated')?.textContent || '';
                        return { title, desc, link, pubDate:pub, source:s.name, country:s.country, tier:s.tier, flag:s.flag };
                      }).filter(i => i.title.length > 8);
                      if (parsed.length > 0) {
                        console.log(`[AIO TG] ${s.name}: CF Worker RSS 성공 (${parsed.length}건)`);
                        updateBar(s.name);
                        return enrichTgItems(parsed);
                      }
                    }
                  }
                }
              } catch(e) { _debugWarn(`[AIO TG] ${s.name}: CF Worker RSS 실패 (${mirror})`, e.message); }
              } // end for mirror
            }
            // 2) rss2json 시도 (미러 순회 — rsshub.app 장애 대비)
            for (const mirror of RSSHUB_MIRRORS) {
              try {
                const mirrorSource = Object.assign({}, s, { url: mirror + tgPath });
                const items = await fetchOneFeed(mirrorSource);
                if (items.length > 0) {
                  console.log(`[AIO TG] ${s.name}: rss2json 성공 via ${mirror}`);
                  updateBar(s.name);
                  return enrichTgItems(items);
                }
              } catch(e) { _debugWarn(`[AIO TG] ${s.name}: rss2json 실패 (${mirror})`); }
            }
            // 3) t.me 직접 스크래핑
            try {
              const items = await fetchTelegramDirect(slug, s.name);
              updateBar(s.name);
              return items;
            } catch(e) {
              updateBar(s.name);
              return [];
            }
          })();
        }
        return fetchOneFeed(s).then(items => {
          updateBar(s.name);
          // v48.38: 헬스 리포트 — items.length > 0 이면 ok, 아니면 fail
          if (window._aioFeedHealth) {
            if (items && items.length > 0) window._aioFeedHealth.reportOk('rss:' + s.name);
            else window._aioFeedHealth.reportFail('rss:' + s.name);
          }
          return items;
        }).catch(err => {
          // fetch 자체가 throw 하는 경우도 fail로 기록
          if (window._aioFeedHealth) window._aioFeedHealth.reportFail('rss:' + s.name);
          return [];
        });
      })
    );
    results.push(...batchResults);

    // v46.6: 점진적 브리핑 렌더링 — 15소스(5배치) 이상 완료 시 조기 렌더
    // (홈 뉴스는 전체 완료 후 렌더, 브리핑은 부분 결과라도 표시)
    if (i >= BATCH_SIZE * 4 && !window._briefingEarlyRendered) {
      var _earlyItems = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      if (_earlyItems.length >= 8) {
        window._briefingEarlyRendered = true;
        // 조기 스코어링 + 렌더
        var _earlyScored = _earlyItems
          .map(function(it) { var s = Object.assign({}, it); s.score = scoreItem(s); s.topic = classifyTopic(s); s.flag = s.flag || getCountryFlag(s.country); return s; })
          .filter(function(it) { return !it._blacklisted; })
          .sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
        if (_earlyScored.length >= 5) {
          _briefingCacheKey = null; // 캐시 무효화 (최종 렌더에서 갱신)
          renderBriefingFeed(_earlyScored);
          console.log('[AIO v46.6] 브리핑 조기 렌더: ' + _earlyScored.length + '건 (배치 ' + Math.ceil((i + BATCH_SIZE) / BATCH_SIZE) + '/' + Math.ceil(activeSources.length / BATCH_SIZE) + ')');
        }
      }
    }

    // v46.6: 배치 딜레이 1500→1000ms (프록시 타임아웃 단축과 함께 전체 속도 30%↑)
    if (i + BATCH_SIZE < activeSources.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  let allItems = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);

  // ═══ v20+: 추가 뉴스 API 병합 (Finnhub + NewsData.io) ═══
  try {
    const [finnhubItems, newsDataItems] = await Promise.allSettled([
      fetchFinnhubNewsFormatted(),
      fetchNewsDataIO('business')
    ]);
    if (finnhubItems.status === 'fulfilled' && finnhubItems.value.length) {
      allItems = allItems.concat(finnhubItems.value);
      console.log(`[AIO v20+] Finnhub News: +${finnhubItems.value.length}건`);
    }
    if (newsDataItems.status === 'fulfilled' && newsDataItems.value.length) {
      allItems = allItems.concat(newsDataItems.value);
      console.log(`[AIO v20+] NewsData.io: +${newsDataItems.value.length}건`);
    }
  } catch(e) { _aioLog('warn', 'fetch', 'Extra news API merge error: ' + (e && e.message || e)); }

  // v27.3: 강화된 중복 제거 (제목 유사도 기반 — 동일 뉴스 다중 소스 중복 방지)
  const seen = new Set();
  const seenShort = new Set(); // 핵심 키워드 기반 추가 중복 체크
  allItems = allItems.filter(i => {
    if (!i.title || i.title.length < 10) return false;
    // 1차: 제목 첫 60자 정규화 매칭
    const key = i.title.slice(0, 60).toLowerCase().replace(/[^a-z0-9가-힣]/g, '');
    if (seen.has(key)) return false;
    seen.add(key);
    // 2차: 핵심 단어 추출 기반 유사 뉴스 중복 제거 (같은 종목+이벤트 조합)
    const words = i.title.toLowerCase().replace(/[^a-z0-9가-힣\s]/g, '').split(/\s+/).filter(w => w.length > 2);
    const sorted = words.sort().join('');
    const shortKey = sorted.slice(0, 40);
    if (shortKey.length > 15 && seenShort.has(shortKey)) return false;
    if (shortKey.length > 15) seenShort.add(shortKey);
    return true;
  });

  // 스코어링 + 토픽 분류 (v21: 기본 최신순 정렬)
  allItems = allItems
    .map(i => { const scored = { ...i }; scored.score = scoreItem(scored); scored.topic = classifyTopic(scored); scored.flag = scored.flag || getCountryFlag(scored.country); return scored; })
    .filter(i => !i._blacklisted)  // v27.4: 블랙리스트 뉴스 완전 제거
    .sort((a, b) => {
      // 기본: 최신순 정렬 (renderFeed에서 모드에 따라 재정렬)
      const ta = a.pubDate ? new Date(a.pubDate).getTime() : 0;
      const tb = b.pubDate ? new Date(b.pubDate).getTime() : 0;
      if (tb !== ta) return tb - ta;
      return (b.score || 0) - (a.score || 0);
    })
    .slice(0, 200);  // v40.4: 캐시 상한 120→200 (48h 내 더 많은 뉴스 유지)

  // v31.8: NewsStore 검증 레이어 — 중복 제거 + 품질 필터
  NewsStore.resetDuplicates();
  const filteredItems = NewsStore.filter(allItems);
  const removedCount = allItems.length - filteredItems.length;
  if (removedCount > 0) console.log(`[NewsStore] ${removedCount}건 필터링됨 (중복/품질)`);

  newsCache = filteredItems;
  window._allNewsItems = filteredItems;  // v29: 텔레그램 필터 등에서 참조
  lastFetchTime = Date.now();
  // isFetching = false; // v27.3: finally 블록으로 이동 (중복 방지)

  const progLabel = document.getElementById('news-progress-label');
  if (progLabel) progLabel.textContent = `뉴스 수집 완료 · ${filteredItems.length}건 (${removedCount}건 필터링)`;

  if (dot) { dot.style.background = 'var(--green)'; dot.style.boxShadow = '0 0 5px var(--green)'; }
  if (lbl) lbl.textContent = '새로고침';
  const ftEl = document.getElementById('last-fetch-time');
  if (ftEl) ftEl.textContent = new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});

  // 소스 라벨 업데이트
  const sl = document.getElementById('news-sources-label');
  if (sl) sl.textContent = `${allItems.length}건 수집 · ${AIO_NEWS_SOURCES.length}개 소스 · 최종 갱신 ${new Date().toLocaleTimeString('ko-KR')}`;

  renderFeed(newsCache);
  renderHomeFeed(newsCache);
  // v46.6: 최종 렌더 시 조기 렌더 캐시 무효화 → 완전한 데이터로 갱신
  _briefingCacheKey = null;
  renderBriefingFeed(newsCache);

  // v21: 자동 한국어 번역 (뉴스 수집 완료 후 백그라운드 실행)
  // 먼저 원본으로 빠르게 보여주고, 번역 완료되면 자동으로 한국어로 갱신
  autoTranslateNews(newsCache).catch(e => _aioLog('warn', 'translate', '자동 번역 에러: ' + (e && e.message || e)));

  // v20: 뉴스 감성 바 업데이트
  try {
    const ns = computeNewsSentimentScore();
    const scoreEl = document.getElementById('news-sent-score');
    const labelEl = document.getElementById('news-sent-label');
    if (scoreEl) { scoreEl.textContent = ns.score; scoreEl.style.color = ns.score > 55 ? '#00e5a0' : ns.score < 45 ? '#ff5b50' : '#ffa31a'; }
    if (labelEl) labelEl.textContent = ns.label + ' (' + ns.bullCount + '↑ ' + ns.bearCount + '↓)';

    // v46.6: 뉴스 감성 시계열 히스토리 저장 + 차트 렌더
    if (!window._newsSentimentHistory) window._newsSentimentHistory = [];
    var _nsh = window._newsSentimentHistory;
    var _nsTime = new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'});
    _nsh.push({ time: _nsTime, score: ns.score, bull: ns.bullCount, bear: ns.bearCount });
    if (_nsh.length > 24) _nsh.shift(); // 최대 24포인트
    // 라이브 스코어 표시
    var _nsLiveScore = document.getElementById('news-sent-live-score');
    var _nsLiveLabel = document.getElementById('news-sent-live-label');
    if (_nsLiveScore) { _nsLiveScore.textContent = ns.score; _nsLiveScore.style.color = ns.score > 55 ? '#00e5a0' : ns.score < 45 ? '#ff5b50' : '#ffa31a'; }
    if (_nsLiveLabel) _nsLiveLabel.textContent = ns.label;
    // 차트 렌더
    var _nsCanvas = document.getElementById('news-sentiment-chart');
    if (_nsCanvas && _nsh.length >= 2) {
      if (window._newsSentChart) window._newsSentChart.destroy();
      window._newsSentChart = new Chart(_nsCanvas, {
        type: 'line',
        data: {
          labels: _nsh.map(function(h) { return h.time; }),
          datasets: [{
            label: '감성 점수', data: _nsh.map(function(h) { return h.score; }),
            borderColor: '#ffa31a', backgroundColor: 'rgba(255,163,26,0.1)',
            borderWidth: 2, pointRadius: 3, pointBackgroundColor: _nsh.map(function(h) { return h.score > 55 ? '#00e5a0' : h.score < 45 ? '#ff5b50' : '#ffa31a'; }),
            fill: true, tension: 0.3
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          scales: { y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#a0b4c8', font: { size: 11 } } }, x: { grid: { display: false }, ticks: { color: '#a0b4c8', font: { size: 11 } } } },
          plugins: { legend: { display: false }, annotation: { annotations: { neutralLine: { type: 'line', yMin: 50, yMax: 50, borderColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderDash: [4,4] } } } }
        }
      });
    }

    const countEl = document.getElementById('news-24h-count');
    if (countEl) countEl.textContent = ns.total + '건';
    const srcEl = document.getElementById('news-24h-sources');
    if (srcEl) { const srcSet = new Set(filterByAge(newsCache, 24).map(i => i.source)); srcEl.textContent = srcSet.size + '개 소스'; }

    const risks = computeNewsRiskSignals();
    const riskCntEl = document.getElementById('news-risk-count');
    const riskLblEl = document.getElementById('news-risk-label');
    if (riskCntEl) { riskCntEl.textContent = risks.length; riskCntEl.style.color = risks.length >= 3 ? '#ff5b50' : risks.length >= 1 ? '#ffa31a' : '#00e5a0'; }
    if (riskLblEl) riskLblEl.textContent = risks.length > 0 ? risks.map(r => r.label).join(' · ') : '리스크 없음';
  } catch(e) { _aioLog('warn', 'render', 'News sentiment bar error: ' + (e && e.message || e)); }

  // v21: 45분 + 지터 자동 갱신 타이머 (5명 동시접속 최적화)
  if (refreshTimer) clearTimeout(refreshTimer);
  const newsJitter = Math.floor(Math.random() * 300000); // 0~5분 랜덤
  refreshTimer = setTimeout(() => fetchAllNews(true), 2700000 + newsJitter);

  // v27.2: 뉴스 0건이면 홈 뉴스 섹션에 안내 메시지 표시
  if (allItems.length === 0) {
    const hn = document.getElementById('home-news-highlights');
    if (hn) hn.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:14px;text-align:center;color:var(--text-muted);font-size:10px;grid-column:1/-1;">현재 뉴스를 불러올 수 없습니다. <button data-action="_aioRetryNews" style="background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.2);color:#60a5fa;font-size:9px;padding:2px 8px;border-radius:4px;cursor:pointer;margin-left:6px;">↻ 다시 시도</button></div>';
    const pl = document.getElementById('news-progress-label');
    if (pl) pl.textContent = '뉴스 소스 연결 실패 — 새로고침하거나 잠시 후 다시 시도하세요.';
  }
  } catch(fetchErr) {
    _aioLog('error', 'fetch', 'fetchAllNews 치명적 에러: ' + (fetchErr && fetchErr.message || fetchErr));
    if (dot) { dot.style.background = '#ff5b50'; dot.style.boxShadow = '0 0 5px #f87171'; }
    if (lbl) lbl.textContent = '에러 발생 — 재시도';
    const pl = document.getElementById('news-progress-label');
    if (pl) pl.textContent = '뉴스 수집 중 에러 발생 — 새로고침 버튼을 눌러주세요.';
    // v46.6: 시장 뉴스 페이지 feed 영역에도 에러 안내
    var feedEl = document.getElementById('live-news-feed');
    if (feedEl && !feedEl.querySelector('.news-item-card')) {
      feedEl.innerHTML = '<div style="background:var(--bg-card);border:1px solid rgba(255,91,80,0.2);border-radius:8px;padding:16px;text-align:center;color:var(--text-muted);font-size:10px;">' +
        '<div style="font-size:12px;color:#f87171;margin-bottom:6px;">뉴스 수집 실패</div>' +
        '<div>네트워크 상태를 확인하거나 잠시 후 다시 시도해주세요.</div>' +
        '<button data-action="_aioRetryNews" style="background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.2);color:#60a5fa;font-size:10px;padding:5px 14px;border-radius:5px;cursor:pointer;margin-top:8px;font-weight:600;">↻ 다시 시도</button></div>';
    }
  } finally {
    isFetching = false; // v27.3: 어떤 에러가 나도 반드시 잠금 해제
  }
}

// v34.5: 뉴스 로딩 타임아웃 — 60초로 늘리고, 이미 뉴스가 렌더된 경우 덮어쓰지 않음
setTimeout(function() {
  var hn = document.getElementById('home-news-highlights');
  if (!hn) return;
  // 이미 뉴스 카드가 렌더됐으면(점진 렌더링 성공) 건드리지 않음
  if (hn.querySelector('.news-item-card')) return;
  // 아직 "로딩 중" 상태일 때만 처리
  if (hn.innerHTML.indexOf('뉴스 로딩 중') !== -1 || hn.innerHTML.indexOf('로딩') !== -1) {
    var items = window._allNewsItems || [];
    if (items.length > 0) {
      // 부분 결과 있으면 렌더
      if (typeof renderHomeFeed === 'function') renderHomeFeed(items);
    } else {
      hn.innerHTML = '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:14px;text-align:center;color:var(--text-muted);font-size:10px;">뉴스 로딩 시간 초과 (네트워크 지연). <button data-action="_aioRetryNews" style="background:rgba(0,212,255,0.1);border:1px solid rgba(0,212,255,0.2);color:#60a5fa;font-size:9px;padding:3px 9px;border-radius:4px;cursor:pointer;margin-left:6px;font-weight:600;">↻ 다시 시도</button></div>';
    }
  }
}, 60000);

// ── 필터 함수 ───────────────────────────────────────────────────

// 전체 뉴스 캐시 보관

// v48.19 (bugfix): 기존 src.includes('') 항상 true 버그 수정 → 명시적 텔레그램 판별
// 모든 필터 경로가 renderFeed로 통합되도록 currentCountryFilter='tg' 방식 전환
function filterNewsByTelegramOnly(el) {
  currentCountryFilter = 'tg';
  document.querySelectorAll('#news-country-chips .chip').forEach(c => {
    c.style.background = 'transparent';
    c.style.borderColor = 'rgba(255,255,255,0.08)';
    c.style.color = 'var(--text-secondary)';
  });
  if (el) {
    el.style.background = 'var(--accent-dim)';
    el.style.borderColor = 'var(--accent-border)';
    el.style.color = 'var(--accent)';
  }
  if (newsCache.length > 0) renderFeed(newsCache);
  else fetchAllNews();
}

function filterNewsByCountry(filter, el) {
  currentCountryFilter = filter;
  document.querySelectorAll('#news-country-chips .chip').forEach(c => {
    c.style.background = 'transparent';
    c.style.borderColor = 'rgba(255,255,255,0.08)';
    c.style.color = 'var(--text-secondary)';
  });
  if (el) {
    el.style.background = 'var(--accent-dim)';
    el.style.borderColor = 'var(--accent-border)';
    el.style.color = 'var(--accent)';
  }
  if (newsCache.length > 0) renderFeed(newsCache);
  else fetchAllNews();
}

function filterNewsByTopic(filter, el) {
  currentTopicFilter = filter;
  document.querySelectorAll('#news-topic-chips .chip').forEach(c => {
    c.style.background = 'transparent';
    c.style.borderColor = 'rgba(255,255,255,0.08)';
    c.style.color = 'var(--text-secondary)';
  });
  if (el) {
    el.style.background = 'var(--accent-dim)';
    el.style.borderColor = 'var(--accent-border)';
    el.style.color = 'var(--accent)';
  }
  if (newsCache.length > 0) renderFeed(newsCache);
}

function triggerNewsRefresh() {
  fetchAllNews(true);
}

// ── 라이브 시세 엔진 ─────────────────────────────────────────────
const LIVE_SYMBOLS = [
  // ── 주요 지수 ──────────────────────────────────────────────────
  '^GSPC','^IXIC','^VIX','^VVIX','^RUT','^DJI','^FTSE','^N225','^HSI',
  // ── 한국 지수 ──────────────────────────────────────────────────
  '^KS11','^KQ11',
  // ── 한국 KR_SUB_THEMES 전수 커버 (.KS = KOSPI, .KQ = KOSDAQ 정식 분리) ──
  // 반도체/HBM — KOSPI 2 + KOSDAQ 6 + KOSPI 1
  '005930.KS','000660.KS',                                     // 삼성전자·SK하이닉스 (KOSPI)
  '042700.KQ','403870.KQ','058470.KQ','357780.KQ','240810.KQ','039030.KQ','272290.KQ',  // 반도체 소부장 (KOSDAQ)
  // 로봇/자동화 — 두산로보틱스(KOSPI) + 현대로템(KOSPI) + KOSDAQ 4
  '454910.KS','064350.KS',
  '277810.KQ','090360.KQ','388720.KQ','090710.KQ',
  // AI/SW — KOSPI 4 + KOSDAQ 2
  '035420.KS','018260.KS','012510.KS','035720.KS',
  '030520.KQ','304100.KQ',
  // 의료기기/AI진단 — 전원 KOSDAQ
  '214150.KQ','328130.KQ','068760.KQ','338220.KQ','049950.KQ','145720.KQ',
  // 조선/해양 — 전원 KOSPI
  '009540.KS','010140.KS','329180.KS','042660.KS','010620.KS',
  // 전력기기/변압기 — KOSPI 5 + KOSDAQ 1(제룡전기)
  '298040.KS','267260.KS','010120.KS','062040.KS','103590.KS',
  '033100.KQ',
  // 원전/SMR — KOSPI 2 + KOSDAQ 3
  '034020.KS','052690.KS',
  '006910.KQ','032820.KQ','083650.KQ',
  // K-뷰티 — KOSPI 3 + KOSDAQ 3
  '090430.KS','192820.KS','051900.KS',
  '278470.KQ','257720.KQ','237880.KQ',
  // K-푸드 — 전원 KOSPI
  '003230.KS','097950.KS','271560.KS','004370.KS','004990.KS','280360.KS',
  // 금융/밸류업 — 전원 KOSPI
  '105560.KS','055550.KS','086790.KS','316140.KS','138040.KS','032830.KS','006800.KS',
  // 자동차/SDV — 전원 KOSPI
  '005380.KS','000270.KS','012330.KS','204320.KS','161390.KS',
  // 바이오/제약 — KOSPI 5 + KOSDAQ 2(알테오젠·리가켐)
  '207940.KS','068270.KS','000100.KS','326030.KS','128940.KS',
  '196170.KQ','141080.KQ',
  // 방산/항공우주 — 전원 KOSPI
  '012450.KS','047810.KS','272210.KS','079550.KS','103140.KS',
  // 에너지/정유 — KOSPI 3 + KOSDAQ 1(흥구석유)
  '010950.KS','096770.KS','078930.KS',
  '024060.KQ',
  // 2차전지 — KOSPI 4 + KOSDAQ 3(에코프로비엠·엘앤에프·에코프로)
  '373220.KS','006400.KS','051910.KS','005490.KS','003670.KS',
  '247540.KQ','066970.KQ','086520.KQ',
  // K-엔터/콘텐츠 — KOSPI 1(하이브) + KOSDAQ 5
  '352820.KS',
  '041510.KQ','035900.KQ','122870.KQ','035760.KQ','253450.KQ',
  // 게임 — KOSPI 3 + KOSDAQ 3
  '259960.KS','036570.KS','251270.KS',
  '293490.KQ','263750.KQ','112040.KQ',
  // 드론/UAM — KOSPI 1(퍼스텍, 나머지는 방산 중복)
  '010820.KS',
  // 리츠/부동산 — KOSPI 5 + KOSDAQ 1(에이리츠)
  '293940.KS','357430.KS','365550.KS','330590.KS','448730.KS',
  '140910.KQ',
  // 건설/인프라 — 전원 KOSPI
  '000720.KS','375500.KS','028260.KS','006360.KS','047040.KS',
  // 여행/항공 — 전원 KOSPI (호텔신라·진에어, 아시아나/한온 제거)
  '003490.KS','008770.KS','089590.KS','272450.KS','039130.KS',
  // ── 채권 금리 ──────────────────────────────────────────────────
  '^IRX','^FVX','^TNX','^TYX',
  // v48.58: VIX 기간구조 (sentiment 페이지 요약)
  '^VIX9D','^VIX3M','^VIX6M','^SKEW',
  // ── 외환 ────────────────────────────────────────────────────────
  'KRW=X','JPY=X','EURUSD=X','GBPUSD=X','CNY=X','AUDUSD=X',
  'DX-Y.NYB',
  // ── 원자재 ──────────────────────────────────────────────────────
  'CL=F','BZ=F','GC=F','NG=F','SI=F','HG=F','PL=F','PA=F',
  'ZC=F','ZW=F',
  // ── 크립토 ──────────────────────────────────────────────────────
  'BTC-USD','ETH-USD','SOL-USD','BNB-USD',
  // ── 대형주·AI·반도체 ─────────────────────────────────────────────
  'NVDA','AAPL','TSLA','MSFT','AMZN','GOOGL','META','AMD','AVGO','TSM',
  'MU','ARM','INTC','QCOM','ASML','SMCI','PLTR','CRWD','PANW','CRM',
  'LMT','RTX','NOC','GD','HII',                 // 방산
  'XOM','CVX','COP','OXY','SLB',                // 에너지
  'JPM','GS','MS','BLK','WFC',                   // 금융
  'LLY','JNJ','MRK','PFE','ABBV',               // 헬스케어
  'RKLB','ASTS','HOOD','COIN','MARA',            // 성장·크립토
  // ── 섹터 ETF (GICS 11 + 서브섹터) ──────────────────────────────────
  'XLK','XLF','XLE','XLV','XLI','XLY','XLP','XLRE','XLB','XLU','XLC',
  'ITA','OIH','IGV','SOXX','ARKK','HACK','GDX','SMH','XBI','URA',
  'AMLP','XOP','JETS','IBB','XHB','ITB','CIBR','BOTZ','ICLN','TAN',
  'LIT','KWEB','EWZ','EWJ','EFA','EEM','VNQ',
  // ── 테마 리더 티커 (주도주/대장주) ──────────────────────────────────
  'NET','DDOG','SNOW','ZS','FTNT','NOW','ADBE','ORCL',       // SW/Cloud
  'DELL','HPE','NTAP','STX','WDC',                            // Storage/HW
  'KO','PEP','COST','PG','MCD','CL','MNST',                   // Staples leaders
  'DUK','NEE','CEG','AEP','EXC',                              // Utilities leaders
  'VRTX','REGN','GILD','MRNA','BIIB',                         // Biotech leaders
  'CAT','HON','UNP','FDX','UPS','WAB',                        // Industrials leaders
  'PLD','O','SPG','VTR','EQIX',                               // REIT leaders
  'KMI','WMB','TRGP','DVN','FANG','BKR','HAL',               // Energy leaders
  'HWM','LHX','TXT',                                          // Defense extra
  'LITE','COHR','CIEN','AAOI','GLW',                          // Photonics (no ETF)
  'BRK-B','MA','UNH','HD','PG','ABBV',                  // DOW30 + Large cap
  'NFLX','PEP','KO','MCD','T','NEE',                    // Consumer + Utilities
  'ADBE','ORCL','CSCO','IBM','INTU',                     // Enterprise SW
  'BAC','WFC','MS','BLK','AXP','SPGI',                  // Financials
  'TMO','ISRG','VRTX','REGN','GILD','AMGN',             // Healthcare/Biotech
  'ASML','AMAT','LRCX','KLAC','SNPS','CDNS','MRVL',     // Semis equipment+design
  'LOW','SBUX','DIS','BA','NKE','VZ',                    // Consumer + DOW30
  'NOC','GD','HII','GE','HON','MMM',                     // Industrials + Defense
  'LIN','COP','DOW','TRV',                               // Materials + Insurance
  'UBER','MELI','DDOG','SNOW','ZS','TTD','FTNT','SMCI', // Growth SaaS
  'SOFI','AFRM','UPST','JOBY','CAVA','SOUN',            // Small cap growth
  'RGTI','QUBT','LUNR','RDW','DNA','IREN','DM',         // Russell 2000
  'CCJ','SMR','VST','NRG',                                    // Nuclear/Uranium
  'MSTR','RIOT',                                               // Crypto extra
  // ── HOT/Trending 종목 (소형·중형 성장주) ──────────────────────────
  'HIMS','AEHR','RDDT','PINS','SNAP','RBLX','SPOT',            // Social/Consumer
  'TEM','AI','PATH','CFLT','CRSP',                              // AI SW / Biotech
  'MDB','GTLB','ESTC','WDAY','MNDY',                           // Cloud/SaaS
  'SQ','OKLO','TLN',                                            // Fintech/Nuclear
  'RIVN','LCID','GM','F',                                       // Auto/EV
  'EA','TTWO','DECK','CELH','ONON',                             // Gaming/Consumer
  'URI','NUE',                                                   // Industrial/Mining
  'SHOP','ABNB','DASH','ROKU','DUOL',                           // E-commerce/Streaming
  'APP','AXON','TOST','GRAB','SE',                              // Tech/Platforms
  'GME','AMC','IWM','DIA',                                      // Meme/Index ETF
  // ── 채권·크레딧·안전자산 ETF ──────────────────────────────────────
  'SPY','RSP','QQQ','GLD','SLV','TLT','IEF','SHY','HYG','LQD','EMB',
  // ── 변동성·크레딧 모니터 ─────────────────────────────────────────
  'UVXY','SQQQ','SH',
  // ── Top 200 시총 확장 종목 ──
  'ABT','ADI','ADP','AFL','AIG','AON','APH','AZO','BK','BMY','BSX','CARR','CI','CME','CMG','CNC','COF','CTAS','CTSH','DD','DE','DHR','EBAY','ECL','EFX','EOG','FI','GPN','HCA','HUBB','HUM','ICE','IDXX','IQV','KEYS','KHC','MAR','MCK','MCO','MDLZ','MET','MMC','MSCI','MSI','NXPI','ORLY','OTIS','PAYX','PGR','PRU','PSA','RMD','ROP','SCHW','SHW','SRE','STE','STZ','SYK','TDG','TGT','TJX','TROW','VRSK','WEC','WELL','WM','YUM',
  // ── KR_SUB_THEMES·SUB_THEMES Critical 수정 반영 신규 종목 ──
  'HXSCL','SSNLF',                                            // 한국 메모리 ADR (SK하이닉스/삼성전자)
  'SNDK',                                                      // SanDisk (WDC 분사 재상장)
  'IRDM','NXT','ARRY','SHLS',                                 // 위성/트래커/인버터
  'NNE','LEU','SMR','OKLO','BWXT','CEG','VST',                // 원전/SMR
  'SYM','MOD','NVT',                                           // 물류자동화/냉각/전력부품
  'ALNY','CRSP',                                               // Biotech 유전자편집
  'FBTC','ARKB','BITB','HODL','IBIT','BITO',                  // BTC 현물 ETF
  'FLNC','BE','PLUG','FCEL',                                  // 수소/ESS
  'NU','XYZ','HOOD','SOFI','AFRM','PYPL','MSTR','COIN',       // 핀테크/크립토
  'DRIV','IYZ','ICLN','URA','HACK','BOTZ','SMH','SOXX','XBI',  // ETF
  'FSLR','ENPH','RUN','SEDG',                                 // 태양광
  'TSM','UMC','GFS','INTC',                                    // 파운드리
  'ASML','AMAT','LRCX','KLAC','TER','ONTO','CDNS','SNPS',      // 반도체 장비/EDA
  'VRTX','REGN','AMGN','GILD','MRNA','BIIB',                  // Biotech leaders
  'LITE','COHR','CIEN','AAOI','GLW','VIAV','ANET','POET',      // Photonics
  'ALAB','CRDO','CSCO',                                        // DC Network
  'VRT','ETN','EME','CLS','HPE',                              // DC Infra
  'IREN','CRWV','NBIS','CIFR','WULF','CLSK',                  // Neocloud
  'CRM','NOW','ADBE','INTU','WDAY','DDOG','SNOW','MDB','TTD',  // SaaS/AI Platform
  'NET','S','CYBR',                                            // Cybersec extra
  'XOM','CVX','COP','VLO','MPC','PSX','DVN','FANG','TPL','EOG','OXY',  // Oil major
  'SLB','HAL','BKR','FTI','NOV','WHD',                        // Oil service
  'WMB','TRGP','ET','KMI','EPD','OKE',                        // MLP
  'DUK','AEP','EXC','ETR','ES','FE','EVRG','XEL','EIX','NEE',  // Utilities
  'JPM','GS','MS','BAC','WFC','C',                             // Big bank
  'BX','KKR','APO','BLK',                                      // Asset mgmt
  'BRK-B','PGR','ALL','MET','TRV','CB',                        // Insurance
  'LLY','JNJ','MRK','ABBV','PFE','BMY','AZN','NVO','VKTX',     // Pharma/GLP-1
  'ABT','ISRG','BSX','SYK','MDT','EW','GEHC',                 // Medtech
  'RTX','LMT','GD','GE','NOC','LHX','HWM','HII','LDOS',        // Defense (PLTR 제외됨)
  'RKLB','ASTS','LUNR','PL','RDW','BA',                        // Space
  'CAT','HON','UNP','FDX','UPS','WAB','PH','EMR',              // Industrial
  'ISRG','ROK','TER','EMR','TSLA','FANUY',                     // Robotics
  'IONQ','RGTI','QUBT','QBTS','GOOGL','IBM',                   // Quantum
  'AMZN','SHOP','WMT','COST','SHOP','CPNG','TGT','EBAY',       // Ecommerce
  'PG','KO','PEP','MCD','NKE','SBUX','LULU','MNST','DG',       // Consumer brand
  'TSLA','RIVN','GM','F','LCID','MBLY','APTV','ON',            // EV/Auto
  'BKNG','ABNB','MAR','HLT','DAL','UAL','LUV','CCL','RCL',     // Travel
  'UBER','DASH','LYFT','SE','GRAB','TOST','CPNG',              // Delivery
  'NFLX','DIS','WBD','SPOT','ROKU','PSKY',                     // Streaming
  'META','GOOGL','TTD','APP','SNAP','PINS','RDDT',             // Social ad
  'EA','TTWO','RBLX','NTDOY',                                   // Gaming (DKNG은 sports_betting)
  'DKNG','FLUT','MGM','PENN','CZR','WYNN',                      // Sports Betting/Casino
  'VLO','MPC','PSX','DINO','DK',                                // Oil Refining
  'T','VZ','TMUS',                                              // Telecom
  'EQIX','DLR','AMT','CCI','SBAC',                             // REITs
  'AEM','NEM','GOLD','WPM','FNV','GFI','KGC',                 // Gold mining
  'FCX','LIN','APD','AA','MP','LAC','ALB','CTVA','ADM',        // Materials
  // ── v48.53: Themes/SUB_THEMES 전수 커버리지 누락 13종 보충 ──
  'ROBO','WCLD','BUG','VIG','DGRO','SCHD',                    // 테마 ETF (aio-explain 언급 + renderAllEtfGrid 대상)
  'ACLS','AVAV','CRAK','ENTG','GEV','KTOS','UCTT'             // SUB_THEMES 개별 종목 (반도체 장비/방산/정유/전력)
];

// ── Global fetch helper (레거시 — AbortController 미사용, 새 코드는 fetchWithTimeout 권장) ──
function withTimeout(p, ms) {
  return Promise.race([
    p,
    new Promise(function(_, rej) { setTimeout(function(){ rej(new Error('timeout')); }, ms); })
  ]);
}

// ═══ v36: 네이버 파이낸스 — 한국 시장 1차 데이터 소스 ═══════════════════
// 네이버 API → CORS 프록시 → Yahoo-compatible 포맷 변환
// 지수(KOSPI/KOSDAQ) + 전 종목(KR_STOCK_DB) 일괄 fetch
async function fetchKrNaverQuotes() {
  var results = [];
  var _startTs = Date.now();

  // ── 1. 지수 데이터 (KOSPI, KOSDAQ) ──
  var indexMap = [
    { naver: 'KOSPI', yahoo: '^KS11' },
    { naver: 'KOSDAQ', yahoo: '^KQ11' }
  ];

  await Promise.allSettled(indexMap.map(async function(idx) {
    var url = 'https://m.stock.naver.com/api/index/' + idx.naver + '/basic';
    try {
      var r = await fetchViaProxy(url, 8000);
      if (!r.ok) return;
      var raw = await r.json();
      var data = raw;
      if (raw.contents) try { data = JSON.parse(raw.contents); } catch(e) { return; }

      // m.stock API 응답: closePrice, compareToPreviousClosePrice, fluctuationsRatio
      var price = parseFloat(String(data.closePrice || data.now || '0').replace(/,/g, ''));
      var chgPct = parseFloat(String(data.fluctuationsRatio || data.cr || '0').replace(/,/g, ''));
      var chgVal = parseFloat(String(data.compareToPreviousClosePrice || data.cv || '0').replace(/,/g, ''));

      if (price > 0) {
        results.push({
          symbol: idx.yahoo,
          regularMarketPrice: price,
          regularMarketChangePercent: chgPct,
          regularMarketChange: chgVal,
          _source: 'live:naver'
        });
      }
    } catch(e) { _aioLog('warn', 'fetch', 'KR-Naver 지수 ' + idx.naver + ' 실패: ' + e.message); }
  }));

  // ── 2. 전 종목 가격 (배치 요청) ──
  var allCodes = (typeof KR_STOCK_DB !== 'undefined') ? Object.keys(KR_STOCK_DB) : [];
  var BATCH_SIZE = 20; // polling API 배치 크기

  for (var bi = 0; bi < allCodes.length; bi += BATCH_SIZE) {
    var batch = allCodes.slice(bi, bi + BATCH_SIZE);
    var codeStr = batch.join(',');
    var batchOk = false;

    // polling API (배치 지원) 먼저 시도
    var batchUrl = 'https://polling.finance.naver.com/api/realtime/domestic/stock/' + codeStr;
    try {
      var r = await fetchViaProxy(batchUrl, 10000);
      if (r.ok) {
        var raw = await r.json();
        var data = raw;
        if (raw.contents) try { data = JSON.parse(raw.contents); } catch(e) {}

        // polling API 응답 파싱 (다중 포맷 지원)
        var datas = null;
        if (data.result && data.result.areas && data.result.areas[0]) {
          datas = data.result.areas[0].datas;
        } else if (data.datas) {
          datas = data.datas;
        } else if (Array.isArray(data)) {
          datas = data;
        }

        if (datas && datas.length > 0) {
          datas.forEach(function(d) {
            var code = d.cd || d.symbolCode || '';
            var price = parseFloat(String(d.nv || d.closePrice || '0').replace(/,/g, ''));
            var chgPct = parseFloat(String(d.cr || d.fluctuationsRatio || '0').replace(/,/g, ''));
            var chgVal = parseFloat(String(d.cv || d.compareToPreviousClosePrice || '0').replace(/,/g, ''));

            // v46.4: 가격/등락률 유효성 검증
            if (!isFinite(price)) price = 0;
            if (!isFinite(chgPct) || Math.abs(chgPct) > 30) chgPct = 0; // 한국 상한가 ±30%
            if (!isFinite(chgVal)) chgVal = 0;

            if (code && price > 0) {
              var yahooSym = krTickerToYahoo(code);
              results.push({
                symbol: yahooSym,
                regularMarketPrice: price,
                regularMarketChangePercent: chgPct,
                regularMarketChange: chgVal,
                _source: 'live:naver'
              });
            }
          });
          batchOk = true;
        }
      }
    } catch(e) { /* polling batch 실패 — m.stock 개별 폴백 */ }

    // 배치 실패 시 m.stock 개별 요청 폴백 (v46.3: 5→10개로 확대, 가중치 높은 종목 우선)
    if (!batchOk) {
      var fallbackBatch = batch.slice(0, 10);
      await Promise.allSettled(fallbackBatch.map(async function(code) {
        var url = 'https://m.stock.naver.com/api/stock/' + code + '/basic';
        try {
          var r = await fetchViaProxy(url, 6000);
          if (!r.ok) return;
          var raw = await r.json();
          var data = raw;
          if (raw.contents) try { data = JSON.parse(raw.contents); } catch(e) { return; }

          var price = parseFloat(String(data.closePrice || data.now || '0').replace(/,/g, ''));
          var chgPct = parseFloat(String(data.fluctuationsRatio || data.cr || '0').replace(/,/g, ''));
          var chgVal = parseFloat(String(data.compareToPreviousClosePrice || data.cv || '0').replace(/,/g, ''));

          if (price > 0) {
            results.push({
              symbol: krTickerToYahoo(code),
              regularMarketPrice: price,
              regularMarketChangePercent: chgPct,
              regularMarketChange: chgVal,
              _source: 'live:naver-fb'
            });
            // v35.7: 시가총액 동적 추출
            if (typeof _enrichMarketCap === 'function') _enrichMarketCap(code, data);
          }
        } catch(e) {}
      }));
    }
  }

  // ── 3차/4차 폴백: api.finance.naver.com / fchart.stock.naver.com (v46.3) ──
  // 1차(배치)+2차(개별) 완료 후 아직 데이터 없는 종목에 대해 siseJson 엔드포인트 시도
  var allCodesFlat = [];
  if (typeof KR_STOCK_DB !== 'undefined') {
    KR_STOCK_DB.forEach(function(s) { if (s.code) allCodesFlat.push(s.code); });
  }
  var gotSyms = {};
  results.forEach(function(r) { gotSyms[r.symbol] = true; });
  var missing = allCodesFlat.filter(function(c) { return !gotSyms[krTickerToYahoo(c)]; });

  if (missing.length > 0) {
    var today = new Date();
    var yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 2); // 주말 대비 2일 전
    var fmt = function(d) { return d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0'); };
    var startD = fmt(yesterday), endD = fmt(today);

    var siseEndpoints = [
      {url: 'https://api.finance.naver.com/siseJson.naver', tag: 'live:naver-sise'},
      {url: 'https://fchart.stock.naver.com/siseJson.nhn', tag: 'live:naver-fchart'}
    ];

    // 가중치 상위 20개만 (API 부하 최소화)
    var topMissing = missing.slice(0, 20);

    for (var epIdx = 0; epIdx < siseEndpoints.length; epIdx++) {
      if (topMissing.length === 0) break;
      var ep = siseEndpoints[epIdx];
      var siseResults = [];

      await Promise.allSettled(topMissing.map(async function(code) {
        var sUrl = ep.url + '?symbol=' + code + '&requestType=1&startTime=' + startD + '&endTime=' + endD + '&timeframe=day';
        try {
          // 직접 fetch 시도 (CORS 허용 가능), 실패 시 프록시
          var r;
          try { r = await fetchWithTimeout(sUrl, {}, 5000); } catch(e) { r = await fetchViaProxy(sUrl, 6000); }
          if (!r.ok) return;
          var text = typeof r.text === 'function' ? await r.text() : '';
          if (typeof r.json === 'function' && !text) { var j = await r.json(); text = JSON.stringify(j); }
          // 파싱: ["YYYYMMDD", 시가, 고가, 저가, 종가, 거래량, 외국인소진율]
          var rows = [];
          var rx = /\["(\d{8})",\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\]/g;
          var m;
          while ((m = rx.exec(text)) !== null) {
            rows.push({ date: m[1], open: +m[2], high: +m[3], low: +m[4], close: +m[5], vol: +m[6] });
          }
          if (rows.length === 0) return;
          // v46.4: 파싱 결과 검증 — 가격 유효성 + 범위
          rows = rows.filter(function(r) { return r.close > 0 && isFinite(r.close) && r.open > 0; });
          if (rows.length === 0) return;
          var latest = rows[rows.length - 1];
          var prev = rows.length >= 2 ? rows[rows.length - 2] : null;
          var price = latest.close;
          var pct = prev && prev.close > 0 ? ((price - prev.close) / prev.close * 100) : 0;
          // pct 범위 검증: ±30% 이상은 데이터 오류 가능 (한국 상한가 ±30%)
          if (!isFinite(pct) || Math.abs(pct) > 30) pct = 0;

          if (price > 0 && isFinite(price)) {
            siseResults.push({
              symbol: krTickerToYahoo(code),
              regularMarketPrice: price,
              regularMarketChangePercent: +pct.toFixed(2),
              regularMarketChange: prev ? (price - prev.close) : 0,
              _source: ep.tag
            });
          }
        } catch(e) {}
      }));

      if (siseResults.length > 0) {
        results.push.apply(results, siseResults);
        console.log('[KR-sise] ' + ep.tag + ' 폴백:', siseResults.length + '개 추가');
        // 성공 종목 제거
        var gotNow = {};
        siseResults.forEach(function(r) { gotNow[r.symbol] = true; });
        topMissing = topMissing.filter(function(c) { return !gotNow[krTickerToYahoo(c)]; });
      }
    }
  }

  var elapsed = Date.now() - _startTs;
  console.log('[KR-Naver] 네이버 파이낸스 완료:', results.length + '개 (' + elapsed + 'ms)');
  return results;
}

async function fetchLiveQuotes() {
  // ═══════════════════════════════════════════════════════════
  // v19: 소스별 전용 API 사용 — 단순하고 확실하게 작동
  // ═══════════════════════════════════════════════════════════

  const allQuotes = [];

  // ─── 1. 암호화폐: CoinGecko (완전 무료) → CF Worker 프록시 폴백 ────
  // v48.2: include_market_cap + include_24hr_vol 추가 — 거래량 스파이크 감지 + BTC 도미넌스 판단 가능
  try {
    const cgUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana,binancecoin&vs_currencies=usd&include_24hr_change=true&include_market_cap=true&include_24hr_vol=true&include_last_updated_at=true';
    let d = null;
    // 직접 시도
    try {
      const r = await fetchWithTimeout(cgUrl, {}, 6000);
      if (r.ok) d = await r.json();
    } catch(e1) { /* CoinGecko 직접 접근 실패 — 프록시로 폴백 */ }
    // 실패 시 CF Worker 프록시로 재시도
    if (!d) {
      const cfW = _getApiKey('aio_cf_worker_url') || '';
      if (cfW) {
        try {
          const r2 = await fetchWithTimeout(cfW + '?url=' + encodeURIComponent(cgUrl), {}, 8000);
          if (r2.ok) {
            const text = await r2.text();
            d = JSON.parse(text.trim());
          }
        } catch(e2) { _aioLog('warn', 'fetch', 'CoinGecko CF 프록시도 실패: ' + e2.message); }
      }
    }
    if (d) {
      const cgMap = {bitcoin:'BTC-USD', ethereum:'ETH-USD', solana:'SOL-USD', binancecoin:'BNB-USD'};
      for (const [cgId, sym] of Object.entries(cgMap)) {
        if (d[cgId]) {
          allQuotes.push({
            symbol: sym,
            regularMarketPrice: d[cgId].usd,
            regularMarketChangePercent: d[cgId].usd_24h_change != null ? d[cgId].usd_24h_change : null,
            regularMarketChange: null,
            // v48.2: 확장 필드 — 시총 + 24h 거래량 + 최종 갱신 시각 (거래량 스파이크 감지/도미넌스 계산용)
            marketCap: d[cgId].usd_market_cap != null ? d[cgId].usd_market_cap : null,
            volume24h: d[cgId].usd_24h_vol != null ? d[cgId].usd_24h_vol : null,
            cgLastUpdated: d[cgId].last_updated_at || null,
            _source: 'live:coingecko',
          });
        }
      }
      // v48.2: BTC 도미넌스 근사치 계산 — Top 4 중 BTC 시총 / 합계 (정확한 도미넌스는 /global 필요하나 근사치로 대용)
      try {
        var _mcBTC = d.bitcoin && d.bitcoin.usd_market_cap;
        var _mcTotal4 = (d.bitcoin && d.bitcoin.usd_market_cap || 0) + (d.ethereum && d.ethereum.usd_market_cap || 0) + (d.solana && d.solana.usd_market_cap || 0) + (d.binancecoin && d.binancecoin.usd_market_cap || 0);
        if (_mcBTC && _mcTotal4) window._btcDominanceTop4 = (_mcBTC / _mcTotal4) * 100;
      } catch(e) {}
      console.log('[AIO] CoinGecko 크립토 갱신:', Object.keys(d).length, '개');
    }
  } catch(e) { _aioLog('warn', 'fetch', 'CoinGecko 실패: ' + e.message); }

  // v48.4: CoinGecko /global (정확한 BTC 도미넌스) + /coins/markets (상위 20 코인) — 무료 티어 확장
  // /simple/price가 끝나고 비동기 병렬 호출. 실패해도 기본 4종 시세에 영향 없음.
  try {
    const cfW = _getApiKey('aio_cf_worker_url') || '';
    const _cgDirect = async function(url, ms) {
      try { const r = await fetchWithTimeout(url, {}, ms); if (r.ok) return await r.json(); } catch(e) {}
      if (cfW) {
        try {
          const r2 = await fetchWithTimeout(cfW + '?url=' + encodeURIComponent(url), {}, ms + 2000);
          if (r2.ok) { const t = await r2.text(); return JSON.parse(t.trim()); }
        } catch(e2) {}
      }
      return null;
    };
    const [globalD, marketsD] = await Promise.allSettled([
      _cgDirect('https://api.coingecko.com/api/v3/global', 6000),
      _cgDirect('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false&price_change_percentage=24h,7d', 8000)
    ]);
    // /global — 정확한 BTC/ETH 도미넌스 + 전체 시총/거래량 + 24h 변동
    if (globalD.status === 'fulfilled' && globalD.value && globalD.value.data) {
      const g = globalD.value.data;
      window._cgGlobal = {
        totalMarketCapUSD: (g.total_market_cap && g.total_market_cap.usd) || null,
        totalVolume24hUSD: (g.total_volume && g.total_volume.usd) || null,
        btcDominance: (g.market_cap_percentage && g.market_cap_percentage.btc) || null,
        ethDominance: (g.market_cap_percentage && g.market_cap_percentage.eth) || null,
        activeCryptocurrencies: g.active_cryptocurrencies || null,
        markets: g.markets || null,
        mcapChange24hPct: g.market_cap_change_percentage_24h_usd != null ? g.market_cap_change_percentage_24h_usd : null,
        _updated: Date.now()
      };
      console.log('[AIO] CoinGecko /global: BTC ' + (window._cgGlobal.btcDominance||0).toFixed(1) + '% 도미넌스 · 시총 $' + ((window._cgGlobal.totalMarketCapUSD||0)/1e12).toFixed(2) + 'T');
    }
    // /coins/markets — 상위 20 코인 상세
    if (marketsD.status === 'fulfilled' && Array.isArray(marketsD.value)) {
      window._cgMarkets = marketsD.value.map(function(c) {
        return {
          id: c.id,
          symbol: (c.symbol || '').toUpperCase(),
          name: c.name,
          price: c.current_price,
          mcap: c.market_cap,
          mcapRank: c.market_cap_rank,
          volume24h: c.total_volume,
          high24h: c.high_24h,
          low24h: c.low_24h,
          chg24hPct: c.price_change_percentage_24h,
          chg7dPct: c.price_change_percentage_7d_in_currency != null ? c.price_change_percentage_7d_in_currency : null,
          ath: c.ath,
          athChgPct: c.ath_change_percentage,
          circulatingSupply: c.circulating_supply,
          image: c.image || null
        };
      });
      window._cgMarkets._updated = Date.now();
      console.log('[AIO] CoinGecko /coins/markets: 상위 ' + window._cgMarkets.length + '개 코인 수집');
    }
  } catch(e) { _aioLog('warn', 'fetch', 'CoinGecko /global·/coins/markets 실패: ' + e.message); }

  // ─── 2. 환율: 다중 API 폴백 체인 (v30.11: 전일 대비 변동률 계산) ───
  // v46.9: CAD/CHF → Yahoo 표준 심볼 수정 (CADUSD=X 비표준 → CAD=X)
  const fxMap = {KRW:'KRW=X', JPY:'JPY=X', EUR:'EURUSD=X', GBP:'GBPUSD=X', CNY:'CNY=X', AUD:'AUDUSD=X', CAD:'CAD=X', CHF:'CHF=X'};
  const FX_INVERTED = ['EURUSD=X','GBPUSD=X','AUDUSD=X']; // USD 기준 역수 통화 (CAD=X, CHF=X는 USD/CAD, USD/CHF로 역수 불필요)

  // v30.11: 전일 종가 저장소 — localStorage에 일단위 캐시
  if (!window._fxPrevClose) {
    try {
      const stored = localStorage.getItem('aio_fx_prev_close');
      if (stored) {
        const parsed = JSON.parse(stored);
        // 24h 이내 데이터만 사용
        if (parsed._ts && Date.now() - parsed._ts < 48 * 3600000) {
          window._fxPrevClose = parsed;
        } else {
          window._fxPrevClose = {};
        }
      } else {
        window._fxPrevClose = {};
      }
    } catch(e) { window._fxPrevClose = {}; }
  }

  // v30.11: 환율 변동률 계산 헬퍼
  function _calcFxChange(sym, currentPrice) {
    const prev = window._fxPrevClose[sym];
    if (!prev || prev <= 0 || currentPrice <= 0) return 0;
    return ((currentPrice - prev) / prev) * 100;
  }

  // v30.11: 환율 API 결과를 처리하는 공통 함수
  function _processFxRates(rates, codeMapFn, apiName) {
    const fxQuotes = [];
    for (const [code, sym] of Object.entries(fxMap)) {
      const rawRate = codeMapFn(code);
      if (rawRate == null || rawRate <= 0) continue;
      let price = rawRate;
      if (FX_INVERTED.includes(sym)) price = 1 / price;
      // NaN/극단값 방어
      if (isNaN(price) || price <= 0 || price > 1e6) continue;
      const pct = _calcFxChange(sym, price);
      fxQuotes.push({
        symbol: sym,
        regularMarketPrice: price,
        regularMarketChangePercent: pct,
        regularMarketChange: pct !== 0 ? price * pct / 100 : 0,
        _source: 'fx:' + apiName
      });
    }
    // 전일 종가 갱신: 첫 세션 로드 시 현재값을 전일 종가로 저장 (다음 세션용)
    if (fxQuotes.length > 0 && !window._fxPrevCloseSaved) {
      const toSave = { _ts: Date.now() };
      fxQuotes.forEach(q => { toSave[q.symbol] = q.regularMarketPrice; });
      try { localStorage.setItem('aio_fx_prev_close', JSON.stringify(toSave)); } catch(e) {}
      window._fxPrevCloseSaved = true;
    }
    return fxQuotes;
  }

  let fxLoaded = false;
  // API 1: open.er-api.com
  if (!fxLoaded) try {
    const r = await fetchWithTimeout('https://open.er-api.com/v6/latest/USD', {}, 5000);
    if (r.ok) {
      const d = await r.json();
      if (d.result === 'success' && d.rates) {
        const fxQuotes = _processFxRates(d.rates, code => d.rates[code], 'open.er-api');
        if (fxQuotes.length > 0) {
          allQuotes.push(...fxQuotes);
          fxLoaded = true;
          console.log('[AIO] 환율 갱신 (open.er-api)', fxQuotes.length + '개');
        }
      }
    }
  } catch(e) { _aioLog('warn', 'fetch', 'open.er-api 실패: ' + e.message); }
  // API 2: exchangerate-api.com (폴백)
  if (!fxLoaded) try {
    const r = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD', {}, 5000);
    if (r.ok) {
      const d = await r.json();
      if (d.rates) {
        const fxQuotes = _processFxRates(d.rates, code => d.rates[code], 'exchangerate-api');
        if (fxQuotes.length > 0) {
          allQuotes.push(...fxQuotes);
          fxLoaded = true;
          console.log('[AIO] 환율 갱신 (exchangerate-api 폴백)', fxQuotes.length + '개');
        }
      }
    }
  } catch(e) { _aioLog('warn', 'fetch', 'exchangerate-api 실패: ' + e.message); }
  // API 3: fawazahmed0 currency-api (최종 폴백)
  if (!fxLoaded) try {
    const r = await fetchWithTimeout('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json', {}, 5000);
    if (r.ok) {
      const d = await r.json();
      if (d.usd) {
        const codeMap = {KRW:'krw', JPY:'jpy', EUR:'eur', GBP:'gbp', CNY:'cny', AUD:'aud', CAD:'cad', CHF:'chf'};
        const fxQuotes = _processFxRates(d.usd, code => d.usd[codeMap[code]], 'fawazahmed0');
        if (fxQuotes.length > 0) {
          allQuotes.push(...fxQuotes);
          fxLoaded = true;
          console.log('[AIO] 환율 갱신 (fawazahmed0 최종 폴백)', fxQuotes.length + '개');
        }
      }
    }
  } catch(e) { _aioLog('warn', 'fetch', '모든 환율 API 실패: ' + e.message); }

  // ─── 2.5. 한국 시장: 네이버 파이낸스 1차 소스 (v36) ─────────────────
  // 네이버 성공 시 Yahoo Korean 배치 스킵 → 요청 수 절감 + 데이터 정확도 향상
  let _naverKrLoaded = false;
  try {
    const naverQuotes = await fetchKrNaverQuotes();
    if (naverQuotes.length >= 3) {
      allQuotes.push(...naverQuotes);
      _naverKrLoaded = true;
      console.log('[AIO] 한국 시세 네이버 1차 소스 성공:', naverQuotes.length + '개');
      // 네이버 데이터 즉시 반영 (체감 속도 향상)
      applyLiveQuotes(allQuotes);
    }
  } catch(e) { _aioLog('warn', 'fetch', '네이버 한국 시세 실패 — Yahoo 폴백 사용: ' + e.message); }

  // ─── 3. 주식·지수: Yahoo Finance v8/chart (단일 심볼, corsproxy 경유) ──
  // 핵심 심볼을 5개씩 나눠서 순차 요청 (빠른 것부터)
  const PRIORITY_SYMS = [
    // 먼저 가져올 핵심 심볼 (홈 화면에 표시)
    ['^GSPC', '^IXIC', '^VIX', 'CL=F', 'GC=F'],          // 지수·원자재
    ['DX-Y.NYB', '^TNX', '^TYX', 'HYG', 'SPY'],            // 달러·금리·ETF
    ['BZ=F', 'NG=F', 'SI=F', 'KRW=X', 'HG=F'],             // v38.3: Brent·원자재·원달러 우선 fetch
    ['NVDA', 'AAPL', 'TSLA', 'MSFT', 'AMD'],               // 대형주
    ['XLE', 'XLK', 'XLF', 'GLD', 'TLT'],                   // 섹터 ETF
    ['ES=F', 'NQ=F', 'YM=F', 'RTY=F', 'VXX', 'UVXY'],      // v48.58: RTY=F 추가 (Russell 선물)
    ['^RUT', '^VVIX', '^IRX', '^FVX', 'RSP'],              // 추가 지수
    ['QQQ', 'AMZN', 'META', 'GOOGL', 'MU'],                 // 추가 주식 (v38.4: GOOGL 추가, ARM→후순위)
    // ── v34.6: 테마 세분화 핵심 종목 우선 fetch (SUB_THEMES leaders) ──
    ['COIN', 'HOOD', 'MSTR', 'AVGO', 'CEG'],              // 핀테크/크립토 + AI칩 + 원전
    ['VST', 'NRG', 'CCJ', 'PANW', 'CRWD'],                // 원전/유틸 + 사이버보안
    ['ZS', 'FTNT', 'IREN', 'CRWV', 'NBIS'],               // 사이버보안 + 네오클라우드
    ['CIFR', 'WULF', 'VRT', 'ANET', 'ALAB'],              // 네오클라우드 + DC인프라
    ['CRDO', 'LITE', 'COHR', 'CIEN', 'AAOI'],             // DC인프라 + 광통신
    ['GLW', 'STX', 'WDC', 'RKLB', 'ASTS'],                // 메모리 + 우주
    ['GD', 'NOC', 'ROK', 'TER', 'QBTS'],                  // 방산 + 로보틱스 + 양자
    ['XLV', 'XLI', 'XLY', 'XLP', 'XLRE'],                 // 섹터 ETF 2
    ['XLB', 'XLU', 'XLC', 'SMH', 'IWM'],                  // v38.4: 누락 섹터 ETF + 반도체/소형주
    ['LMT', 'RTX', 'XOM', 'CVX', 'ARM'],                   // 방산·에너지·ARM
    ['LQD', 'DIA', 'SLV', 'USO', 'QCOM'],                 // v38.4: 이전 미수신 ETF + 퀄컴
    ['^DJI', 'BTC-USD', 'ETH-USD', 'SI=F', '000001.SS'],   // GMO 테이블 필수 심볼
    ['^GDAXI', '^FTSE', '^FCHI', '^N225', '^HSI'],          // 글로벌 지수 (EMEA + Asia)
    ['EMB', 'SHY', 'IEF'],                                   // 채권 ETF
    ['IONQ', 'RGTI', 'QUBT', 'LUNR', 'RDW'],              // 양자·우주
    ['AFRM', 'SOFI', 'UPST', 'PL'],                          // 핀테크 (LUNR→16507 중복제거)
    ['IBIT', 'BITO', 'UBER', 'DASH', 'CPNG'],             // BTC ETF + 딜리버리
    ['LLY', 'NVO', 'INTC', 'GFS', 'UMC'],                 // GLP-1 + 파운드리
    // ── 한국 주요 종목 (Yahoo Finance .KS/.KQ) ──
    ['^KS11', '^KQ11', '005930.KS', '000660.KS', '012450.KS'], // KOSPI,KOSDAQ,삼성전자,SK하이닉스,한화에어로
    ['329180.KS', '042660.KS', '035420.KS', '034020.KS', '298040.KS'], // HD현대중공업,한화오션,NAVER,두산에너빌,효성중공업
    ['373220.KS', '005380.KS', '207940.KS', '047810.KS', '010120.KS'], // LG에솔,현대차,삼바,한국항공우주,LS일렉
    ['055550.KS', '068270.KS', '090430.KS', '003230.KS', '277810.KQ'], // 신한지주,셀트리온,아모레,삼양식품,레인보우로보틱스
    // ── v35.7: 한국 시총 TOP20 + 테마 대장주 추가 (기존 누락분) ──
    ['000270.KS', '105560.KS', '402340.KS', '005490.KS', '035720.KS'], // 기아,KB금융,SK스퀘어,POSCO홀딩스,카카오
    ['051910.KS', '006400.KS', '096770.KS', '086790.KS', '316140.KS'], // LG화학,삼성SDI,SK이노베이션,하나금융,우리금융
    ['009150.KS', '034730.KS', '003550.KS', '028260.KS', '271560.KS'], // 삼성전기,SK,LG,삼성물산,오리온
    ['323410.KS', '015760.KS', '009830.KS', '192820.KQ', '000720.KS'], // 카카오뱅크,한국전력,한화솔루션,코스맥스,현대건설
    // ── 한국 방산 테마 ──
    ['064350.KS', '079550.KS', '272210.KS', '000880.KS', '103140.KS'], // 현대로템,LIG넥스원,한화시스템,한화,풍산
    // ── 한국 조선 테마 ──
    ['009540.KS', '010140.KS', '010620.KS', '082740.KS', '267250.KS'], // HD한국조선해양,삼성중공업,HD현대미포,한화엔진,HD현대
    ['011200.KS', '011210.KS'],                                         // HD현대마린엔진,현대위아
    // ── 한국 전력인프라 테마 ──
    ['267260.KS', '103590.KS', '006260.KS', '229640.KS', '000500.KS'], // HD현대일렉트릭,일진전기,LS,LS에코에너지,가온전선
    ['033100.KS', '259960.KS'],                                         // 제룡전기,크래프톤
    // ── 한국 반도체·IT ──
    ['000990.KS', '005290.KS', '018260.KS', '012510.KS', '012330.KS'], // DB하이텍,동진쎄미켐,삼성SDS,더존비즈온,현대모비스
    // ── 한국 바이오·헬스케어 ──
    ['000100.KS', '128940.KS', '326030.KS'],                             // 유한양행,한미약품,SK바이오팜 (207940.KS→16514 중복제거)
    // ── 한국 원전 테마 ──
    ['052690.KS', '051600.KS', '092200.KS', '083650.KS'],               // 한전기술,한전KPS,디아이씨,비에이치아이
    // ── 한국 2차전지·소재 ──
    ['051900.KS', '122870.KS', '138040.KS', '086280.KS'],               // LG이노텍,이녹스첨단소재,메리츠금융,현대글로비스 (005490.KS→16517 중복제거)
    // ── 한국 ETF 섹터 ──
    ['091160.KS', '305720.KS', '091220.KS', '244580.KS'],               // KODEX반도체,KODEX2차전지,KODEX은행,KODEX바이오
    // ── 한국 코스닥 주도주 ──
    ['315640.KQ', '403870.KQ', '454910.KQ', '950130.KQ', '253450.KQ'], // 뉴로메카,HPSP,에이텐랩,엘앤에프,스튜디오드래곤
    ['058470.KQ', '066970.KQ', '036930.KQ', '039030.KQ', '145020.KQ'], // 리노공업,엘앤에프,주성엔지니어링,이오테크닉스,휴젤
    ['131970.KQ', '178320.KQ', '112040.KQ', '240810.KQ', '041020.KQ'], // 테스나,서진시스템,위메이드,엘오티베큠,폴라리스오피스
    ['304100.KQ', '086520.KQ', '094480.KQ', '056080.KQ', '237880.KQ'], // 솔트룩스,에코프로,나라셀라,유진로봇,클리오
    ['196170.KQ', '257720.KQ', '278470.KQ', '044820.KQ', '042700.KQ'], // 알테오젠,세아메카닉스,코웨이,코스맥스비티아이,한미반도체
    ['247540.KQ', '003670.KQ', '028300.KQ', '161890.KQ'],              // 에코프로비엠,포스코퓨처엠,HLB,한국콜마
    // ── 한국 기타 대형주 ──
    ['004370.KS', '000810.KS', '035760.KS', '017670.KS', '018880.KS'], // 농심,삼성화재,CJ ENM,SK텔레콤,한온시스템
    ['030200.KS', '032640.KS', '032830.KS', '041510.KS'],               // KT,LG유플러스,삼성생명,에스엠 (086280.KS→16536 중복제거)
    ['280360.KS', '352820.KS', '097950.KS', '251270.KS', '204320.KS'], // 롯데웰푸드,하이브,CJ제일제당,넷마블,만도
    ['005180.KS', '000080.KS', '004020.KS', '035900.KS', '030520.KQ'], // 빙그레,하이트진로,현대제철,JYP Ent.,한글과컴퓨터
    // ── 추가 대형주 (DOW30 + S&P500) ──
    ['BRK-B', 'MA', 'UNH', 'HD', 'PG'],
    ['ABBV', 'NFLX', 'PEP', 'KO', 'MCD'],
    ['ADBE', 'ORCL', 'CSCO', 'IBM', 'INTU'],
    ['BAC', 'WFC', 'MS', 'BLK', 'AXP'],
    ['TMO', 'ISRG', 'VRTX', 'REGN', 'GILD'],
    ['ASML', 'AMAT', 'LRCX', 'KLAC', 'SNPS'],
    ['MRVL', 'CDNS', 'LOW', 'SBUX', 'DIS'],
    ['BA', 'NKE', 'VZ'],                                      // NOC,GD→16501 중복제거
    ['GE', 'HON', 'LIN', 'COP', 'NEE'],
    ['MELI', 'DDOG', 'SMCI'],                                 // UBER→16509,FTNT→16497 중복제거
    ['CAVA', 'SOUN'],                                         // SOFI,AFRM→16508,RGTI→16507 중복제거
    // ── v35.7: S&P 500 Top 50 누락분 추가 ──
    ['GOOGL', 'JPM', 'V', 'JNJ', 'COST'],
    ['WMT', 'CRM', 'MRK', 'GS', 'C'],
    ['QCOM', 'AMGN', 'NOW', 'PM', 'BKNG'],
    ['TXN', 'ACN', 'SPGI', 'PLTR', 'PYPL'],
    ['SCHW', 'WM', 'BX', 'KKR', 'APO'],
    // ── HOT/Trending 종목 ──
    ['HIMS', 'RDDT', 'PINS', 'SNAP', 'RBLX'],
    ['SPOT', 'TEM', 'AI', 'PATH', 'CFLT'],
    ['MDB', 'GTLB', 'ESTC', 'WDAY', 'MNDY'],
    ['SQ', 'OKLO', 'TLN', 'RIVN', 'LCID'],
    ['GM', 'F', 'EA', 'TTWO', 'DECK'],
    ['CELH', 'ONON', 'URI', 'NUE', 'SHOP'],
    ['ABNB', 'ROKU', 'DUOL', 'APP'],                          // DASH→16509 중복제거
    ['AXON', 'TOST', 'GRAB', 'SE', 'GME'],
    ['AMC', 'AEHR', 'VIAV', 'CRSP', 'IWM'],
    // ── 환율 심볼 (chartPreviousClose 확보용) ──
    ['KRW=X', 'JPY=X', 'EURUSD=X', 'GBPUSD=X', 'CNY=X'],
    ['AUDUSD=X'],
    // ── Top 200 확장 ──
    ['ABT', 'BSX', 'SYK', 'DHR', 'CI'],
    ['CME', 'ICE', 'MSI', 'APH', 'EOG'],
    ['ADP', 'ORLY', 'CTAS', 'SHW', 'CMG'],
    ['PGR', 'TDG', 'MAR', 'IDXX', 'ROP'],
    // ── v35.8: 테마 시세 갭 해소 ──
    ['CAT','UNP','CSX','PCAR','PH'],['WAB','AME','GNRC','JCI','NDSN'],['HII','HWM','LHX','LDOS','TXT'],
    ['DVN','OXY','FANG','TPL','KMI'],['WMB','TRGP','ET','SLB','HAL'],['BKR','VLO','MPC','PSX','DUK'],
    ['AEP','EXC','ETR','ES','FE'],['EVRG','XEL','EIX','LNT','PNW'],['ATO','SMR','LEU','ENPH','FSLR'],
    ['SEDG','RUN','PFE','BMY','MRNA'],['BIIB','AZN','VKTX','MDT','MCK'],['DVA','WAT','A','MASI','KEYS'],
    ['T','TMUS','MO','PM','SYY'],['ADM','CTVA','ECL','IFF','ADI'],['TJX','DG','CHD','CL','CLX'],
    ['MNST','EBAY','ETSY','HLT','PSKY'],['TTD','NET','SNOW','FCX','NEM'],['APD','AA','MP','LAC','ALB'],
    ['NXPI','ON','EMR','DELL','HPE'],['NTAP','EQIX','DLR','AMT','PLD'],['SPG','O','KIM','REG','VTR'],
    ['TSM','NU','MARA','RIOT','CLSK'],['ACLS','ENTG','FLNC'],['UCTT','ONTO','FLR','XYZ','CYBR'],
    ['SMH','IGV','XBI','ITA','OIH'],['AMLP','URA','XOP','HACK','GDX'],['BOTZ','ICLN','LIT','JETS','XLB'],
    ['XLC','XLU','NVO','PLUG','BE'],['JBHT','NSC','ODFL','UPS','S'],['FANUY','STAG','FCEL'],
    ['AEM','ALL','APTV','CB'],['CCI','CCL','DAL','DE','DKNG'],['EPD','FNV','GFI','GOLD'],
    ['KGC','LUV','MET','OKE','RCL'],['SBAC','TGT','TRV','UAL'],['WPM'],
    // ── v35.8: 한국 신규 테마 종목 ──
    ['006360.KS','375500.KS','028050.KS','139480.KS','069960.KS'],
    ['007070.KS','282330.KS','030000.KS','011170.KS','010950.KS'],
    ['000120.KS','003490.KS','180640.KS','023530.KS','078930.KS'],
    ['006800.KS','041190.KS','047080.KQ','004170.KS','047040.KS'],
    ['047820.KQ'],  // v35.8: 삼천당제약 (코스닥 시총 1위)
  ];

  // Yahoo Finance Chart API — crumb 불필요, 단일 심볼
  // corsproxy.io가 가장 안정적 (무료, CORS 없이)
  const CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart/';
  const CHART_PARAMS = '?interval=1d&range=1d&includePrePost=true';

  // v47.12: Yahoo v7/finance/quote 배치 캐시 — CF Worker 활성 시 PRIORITY_SYMS 전체를 1~3회 호출로 압축
  // v7/quote는 직접 호출 시 crumb 요구로 불안정 → CF Worker 미설정 시 스킵하여 기존 v8 개별 경로로 폴백
  // 배치 수신 시 fetchYFChart가 캐시 우선 조회하여 개별 호출 건너뜀 → 500+ 심볼 × 개별 요청 → 3회 배치로 압축 (~99% 감소)
  const _yfBatch = {};
  async function _yfBatchFetch(syms) {
    if (!syms || syms.length === 0) return;
    const cfW = _getApiKey('aio_cf_worker_url') || '';
    if (!cfW) return;
    const chunks = [];
    for (let i = 0; i < syms.length; i += 100) chunks.push(syms.slice(i, i + 100));
    await Promise.allSettled(chunks.map(async function(chunk) {
      const qUrl = 'https://query1.finance.yahoo.com/v7/finance/quote?symbols=' + encodeURIComponent(chunk.join(','));
      try {
        const r = await fetchWithTimeout(cfW + '?url=' + encodeURIComponent(qUrl), {}, 10000);
        if (!r.ok) return;
        const d = await r.json();
        const list = d && d.quoteResponse && Array.isArray(d.quoteResponse.result) ? d.quoteResponse.result : [];
        list.forEach(function(q) {
          if (!q || !q.symbol || !q.regularMarketPrice) return;
          if (!_validatePrice(q.symbol, q.regularMarketPrice)) return;
          var _pct = q.regularMarketChangePercent;
          var _prev = q.regularMarketPreviousClose != null ? q.regularMarketPreviousClose : (q.chartPreviousClose || 0);
          if (_pct == null && _prev > 0) _pct = ((q.regularMarketPrice - _prev) / _prev) * 100;
          var out = {
            symbol: q.symbol,
            regularMarketPrice: q.regularMarketPrice,
            chartPreviousClose: _prev,
            regularMarketChangePercent: _pct != null ? _pct : 0,
            regularMarketChange: q.regularMarketChange != null ? q.regularMarketChange : (_prev > 0 ? q.regularMarketPrice - _prev : 0),
            regularMarketDayHigh: q.regularMarketDayHigh,
            regularMarketDayLow: q.regularMarketDayLow,
            regularMarketVolume: q.regularMarketVolume,
            fiftyTwoWeekHigh: q.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: q.fiftyTwoWeekLow,
            // v48.6: 52W 관련 확장 필드 + 거래량 평균 — 52W 위치 바 + 거래량 스파이크 계산 근거
            fiftyTwoWeekHighChangePercent: q.fiftyTwoWeekHighChangePercent != null ? q.fiftyTwoWeekHighChangePercent : null,
            fiftyTwoWeekLowChangePercent: q.fiftyTwoWeekLowChangePercent != null ? q.fiftyTwoWeekLowChangePercent : null,
            averageDailyVolume3Month: q.averageDailyVolume3Month != null ? q.averageDailyVolume3Month : null,
            averageDailyVolume10Day: q.averageDailyVolume10Day != null ? q.averageDailyVolume10Day : null,
            marketCap: q.marketCap,
            trailingPE: q.trailingPE,
            marketState: q.marketState,
            _source: 'live:yahoo-v7-batch'
          };
          var _ms = (q.marketState || '').toUpperCase();
          if (_ms === 'PRE' && q.preMarketPrice > 0) {
            out.extPrice = q.preMarketPrice;
            out.extPct = q.preMarketChangePercent != null ? q.preMarketChangePercent : null;
            out.extSession = 'pre';
          } else if ((_ms === 'POST' || _ms === 'POSTPOST') && q.postMarketPrice > 0) {
            out.extPrice = q.postMarketPrice;
            out.extPct = q.postMarketChangePercent != null ? q.postMarketChangePercent : null;
            out.extSession = 'post';
          }
          _yfBatch[q.symbol] = out;
        });
      } catch(e) { _aioLog('warn', 'fetch', 'Yahoo v7 batch chunk error: ' + e.message); }
    }));
    if (Object.keys(_yfBatch).length > 0) {
      console.log('[AIO] Yahoo v7 배치: ' + Object.keys(_yfBatch).length + '/' + syms.length + '개 수신 (' + chunks.length + '청크)');
    }
  }
  // PRIORITY_SYMS 전체 평탄화 후 중복 제거 → 1회 배치 호출
  try {
    const _allSymsFlat = Array.from(new Set(PRIORITY_SYMS.flat()));
    await _yfBatchFetch(_allSymsFlat);
  } catch(e) { _aioLog('warn', 'init', 'v7 배치 초기화 실패: ' + e.message); }

  // v30.11 Task 11: _PROXY_REGISTRY에서 프록시 목록 가져옴 (단일 진실 원천)
  // v35.7: 매번 getRotated()에서 mkUrl을 가져와 부하 분산
  const YF_PROXIES = (typeof _PROXY_REGISTRY !== 'undefined') ? _PROXY_REGISTRY.getMkUrls() : [
    u => 'https://corsproxy.io/?' + encodeURIComponent(u),
    u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
  ];

  async function fetchYFChart(symbol) {
    // v47.12: v7/quote 배치 캐시 우선 조회 — 진입부에서 이미 수신된 심볼이면 개별 호출 스킵
    if (_yfBatch[symbol]) return _yfBatch[symbol];
    const url = CHART_BASE + encodeURIComponent(symbol) + CHART_PARAMS;

    // v31.5: CF Worker가 있으면 직접 호출 건너뜀 (Yahoo CORS 503 방지 → 요청 절반 감소)
    const _skipDirect = !!(_getApiKey('aio_cf_worker_url'));
    if (!_skipDirect) {
      // 직접 시도 (CORS 해제 환경일 때만)
      try {
        const r = await fetchWithTimeout(url, {headers:{'Accept':'application/json'}}, 3000);
        if (r.ok) {
          const d = await r.json();
          const meta = d?.chart?.result?.[0]?.meta;
          if (meta?.regularMarketPrice && _validatePrice(symbol, meta.regularMarketPrice)) {
            var _dPrice = meta.regularMarketPrice;
            var _dPrev = meta.chartPreviousClose || meta.previousClose || 0;
            var _dPct = meta.regularMarketChangePercent;
            if (_dPct == null && _dPrev > 0) {  // v38.3 A4: _pct===0 유효값 보존 (변동률 0%도 정상)
              _dPct = ((_dPrice - _dPrev) / _dPrev) * 100;
            }
            // v36.6: 프리/애프터마켓 시세 추출
            var _extHours = {};
            var _mState = (meta.marketState || '').toUpperCase();
            if (_mState === 'PRE' && meta.preMarketPrice > 0) {
              _extHours = { extPrice: meta.preMarketPrice, extPct: meta.preMarketChangePercent || 0, extSession: 'pre' };
            } else if ((_mState === 'POST' || _mState === 'POSTPOST') && meta.postMarketPrice > 0) {
              _extHours = { extPrice: meta.postMarketPrice, extPct: meta.postMarketChangePercent || 0, extSession: 'post' };
            }
            return { symbol, ...meta, ..._extHours, regularMarketChangePercent: _dPct || 0, chartPreviousClose: _dPrev, _source: 'live:yahoo-direct' };
          }
        }
      } catch(e) {}
    }

    // v35.7: 라운드로빈 부하 분산 — 매 호출마다 프록시 순서 회전
    const orderedProxies = (typeof _PROXY_REGISTRY !== 'undefined') ? _PROXY_REGISTRY.getRotated().map(function(p){ return p.mkUrl; }) : YF_PROXIES;

    for (const mkP of orderedProxies) {
      try {
        const r = await fetchWithTimeout(mkP(url), {}, 8000);
        if (!r.ok) continue;
        // allorigins는 JSON 래핑, 나머지는 직접
        let raw;
        const ct = r.headers.get('content-type') || '';
        if (ct.includes('json')) {
          const w = await r.json();
          raw = w.contents ? JSON.parse(w.contents) : w;
        } else {
          const txt = await r.text();
          try { raw = JSON.parse(txt); } catch(e) {
            // allorigins JSON 래핑인데 text/plain인 경우
            try { const w = JSON.parse(txt); raw = w.contents ? JSON.parse(w.contents) : w; } catch(e2) {}
          }
        }
        const meta = raw?.chart?.result?.[0]?.meta;
        if (meta?.regularMarketPrice && _validatePrice(symbol, meta.regularMarketPrice)) {
          // v30.13c: chart API에 regularMarketChangePercent 없을 때 직접 계산
          var _price = meta.regularMarketPrice;
          var _prevClose = meta.chartPreviousClose || meta.previousClose || 0;
          var _pct = meta.regularMarketChangePercent;
          var _chg = meta.regularMarketChange;
          // chart API는 변화율을 안 주는 경우가 많음 → previousClose로 직접 계산
          if (_pct == null && _prevClose > 0) {
            _pct = ((_price - _prevClose) / _prevClose) * 100;
            _chg = _price - _prevClose;
          }
          // v30.14: chartPreviousClose를 반환에 포함 — 환율 _fxPrevClose 보정용
          // v36.6: 프리/애프터마켓 시세 추출 (proxy 경로)
          var _extH = {};
          var _ms = (meta.marketState || '').toUpperCase();
          if (_ms === 'PRE' && meta.preMarketPrice > 0) {
            _extH = { extPrice: meta.preMarketPrice, extPct: meta.preMarketChangePercent != null ? meta.preMarketChangePercent : null, extSession: 'pre' };
          } else if ((_ms === 'POST' || _ms === 'POSTPOST') && meta.postMarketPrice > 0) {
            _extH = { extPrice: meta.postMarketPrice, extPct: meta.postMarketChangePercent != null ? meta.postMarketChangePercent : null, extSession: 'post' };
          }
          return {
            symbol,
            regularMarketPrice: _price,
            regularMarketChangePercent: _pct != null ? _pct : null,
            regularMarketChange: _chg != null ? _chg : null,
            chartPreviousClose: _prevClose != null ? _prevClose : null,
            ..._extH,
            _source: 'live:yahoo-proxy',
          };
        }
      } catch(e) {}
    }
    return null;
  }

  // v30.11: 가격 검증 — 심볼 유형별 분리된 임계값
  // KRX 가한폭 ±30% (상한가/하한가), 미국 개별주 ±25%, 지수/ETF ±15%, 환율 ±10%, VIX 특수
  if (!window._priceWarnShown) window._priceWarnShown = {};

  // v30.11: 심볼 유형별 검증 규칙
  const _PRICE_RULES = {
    // VIX 계열: 극단 변동 허용 (공포 지수)
    '^VIX':  { min: 5,    max: 120,    maxJump: 0.80 },
    '^VVIX': { min: 50,   max: 250,    maxJump: 0.80 },
    // 주요 지수: ±15%
    '^GSPC': { min: 1000, max: 20000,  maxJump: 0.15 },
    '^IXIC': { min: 5000, max: 50000,  maxJump: 0.15 },
    '^DJI':  { min: 10000,max: 80000,  maxJump: 0.15 },
    '^RUT':  { min: 500,  max: 10000,  maxJump: 0.15 },
    // 금리: 절대 범위 (음수 허용하지 않음)
    '^TNX':  { min: 0.01, max: 20,     maxJump: 0.30 },
    '^TYX':  { min: 0.01, max: 20,     maxJump: 0.30 },
    '^FVX':  { min: 0.01, max: 20,     maxJump: 0.30 },
    '^IRX':  { min: 0.01, max: 20,     maxJump: 0.30 },
    // 환율: ±10%
    'KRW=X': { min: 800,  max: 2000,   maxJump: 0.10 },
    'DX-Y.NYB': { min: 70, max: 130,   maxJump: 0.10 },
    // 원자재
    'CL=F':  { min: 10,   max: 250,    maxJump: 0.20 },
    'GC=F':  { min: 500,  max: 10000,  maxJump: 0.15 },
    // 암호화폐: 높은 변동성 허용
    'BTC-USD': { min: 1000, max: 500000, maxJump: 0.30 },
    'ETH-USD': { min: 50,   max: 50000,  maxJump: 0.35 },
  };

  function _getPriceRule(symbol) {
    if (_PRICE_RULES[symbol]) return _PRICE_RULES[symbol];
    // KRX: 상한가/하한가 ±30%
    if (symbol.endsWith('.KS') || symbol.endsWith('.KQ') || symbol === '^KS11' || symbol === '^KQ11') {
      return { min: 0.01, max: 1e7, maxJump: 0.30 };
    }
    // FX 통화쌍
    if (symbol.endsWith('=X')) {
      return { min: 0.001, max: 1e6, maxJump: 0.10 };
    }
    // 일반 미국 주식/ETF: ±25%
    return { min: 0.01, max: 1e6, maxJump: 0.25 };
  }

  function _validatePrice(symbol, price) {
    if (typeof price !== 'number' || isNaN(price) || price <= 0) return false;
    const rule = _getPriceRule(symbol);
    // 절대 범위 체크
    if (price < rule.min || price > rule.max) return false;
    const prev = window._previousPrices?.[symbol];
    if (!prev) return true;
    // 세션 내 실시간 갱신에서만 검증 (첫 로드 시 폴백→실제 괴리 허용)
    if (!window._sessionLivePrices?.[symbol]) {
      window._sessionLivePrices = window._sessionLivePrices || {};
      window._sessionLivePrices[symbol] = price;
      return true; // 첫 실시간 가격은 무조건 수용
    }
    if (Math.abs(price - prev) / prev > rule.maxJump) {
      if (!window._priceWarnShown[symbol]) {
        _aioLog('warn', 'price', 'Price out of range for ' + symbol + ': ' + prev + ' → ' + price + ' (limit: ±' + (rule.maxJump*100) + '%)');
        window._priceWarnShown[symbol] = true;
      }
      return false;
    }
    return true;
  }

  // v30.11: 프록시 건강도 추적 — 연속 실패 시 그룹 스킵으로 전환
  if (!window._proxyHealth) window._proxyHealth = { consecutiveFails: 0, lastSuccess: 0, dead: false };

  // v30.11: 적응형 배치 처리 — 프록시 상태에 따라 동작 조정
  // - 프록시 정상: 그룹(5개) 병렬 + 그룹 간 순차 (기존과 동일)
  // - 프록시 불안정(3연속 실패): 나머지 그룹 스킵, 이미 수집한 데이터만 표시
  // - 중간 갱신: 핵심 그룹(처음 2개) 완료 후 즉시 화면 반영
  let yfCount = 0;
  let groupFailStreak = 0;
  const CRITICAL_GROUPS = 6; // v38.4: 첫 6그룹 핵심 (지수·원자재·달러·금리·대형주·섹터ETF)
  const MAX_GROUP_FAILS = 3; // 연속 3그룹 전부 실패 → 프록시 죽음 판정

  for (let gi = 0; gi < PRIORITY_SYMS.length; gi++) {
    const group = PRIORITY_SYMS[gi];

    // v36: 네이버로 한국 데이터 이미 로드 완료 → Yahoo Korean 배치 스킵 (요청 절감)
    if (_naverKrLoaded) {
      const isKrGroup = group.every(function(s) {
        return s.endsWith('.KS') || s.endsWith('.KQ') || s === '^KS11' || s === '^KQ11';
      });
      if (isKrGroup) {
        console.log('[AIO] 네이버 데이터 사용 — Yahoo Korean 그룹 스킵 (group ' + gi + ')');
        continue;
      }
    }

    // 프록시 죽음 판정 후: 핵심 그룹 이후는 스킵
    if (groupFailStreak >= MAX_GROUP_FAILS && gi >= CRITICAL_GROUPS) {
      _aioLog('warn', 'fetch', '프록시 연속 실패 — 나머지 ' + (PRIORITY_SYMS.length - gi) + '개 그룹 스킵');
      showDataError('시세', '일부 종목 갱신 실패 — 프록시 불안정', 'warn');
      break;
    }

    const results = await Promise.allSettled(group.map(fetchYFChart));
    let groupSuccess = 0;
    results.forEach(r => {
      if (r.status === 'fulfilled' && r.value) {
        allQuotes.push(r.value);
        yfCount++;
        groupSuccess++;
      }
    });

    // 그룹 성공/실패 추적
    if (groupSuccess === 0) {
      groupFailStreak++;
    } else {
      groupFailStreak = 0; // 성공 시 리셋
      window._proxyHealth.consecutiveFails = 0;
      window._proxyHealth.lastSuccess = Date.now();
    }

    // 핵심 그룹 완료 후 즉시 화면 업데이트 (체감 속도 향상)
    if (gi < CRITICAL_GROUPS && allQuotes.length > 0) {
      applyLiveQuotes(allQuotes);
    }
    // v34.6: 테마 그룹(6~12) 완료 후 즉시 업데이트 → 세분화 테마 시세 빠른 반영
    else if (gi >= CRITICAL_GROUPS && gi <= 12 && allQuotes.length > 0) {
      applyLiveQuotes(allQuotes);
    }
    // 이후: 3그룹마다 중간 업데이트 (기존 5 → 3으로 단축)
    else if (gi > 12 && gi % 3 === 0 && allQuotes.length > 0) {
      applyLiveQuotes(allQuotes);
    }
  }
  console.log('[AIO] Yahoo Finance 갱신:', yfCount, '/' + PRIORITY_SYMS.reduce((a,g)=>a+g.length,0) + '개',
    groupFailStreak >= MAX_GROUP_FAILS ? '(프록시 불안정으로 조기 종료)' : '');

  // ─── v46.3: Stooq 폴백 — Yahoo 실패/부분 실패 시 미국 주식/ETF/원자재 보완 ───
  // Stooq: 무료, API키 불필요, 배치 지원 (+ 구분), CSV 응답
  // 지원: 미국 주식(.US), ETF(.US), WTI(CL.F), Gold(GC.F), DXY(DX.F)
  // 미지원: VIX, 채권 금리 (Yahoo 유지)
  var gotSyms = {};
  allQuotes.forEach(function(q) { gotSyms[q.symbol] = true; });
  var usMissing = [];
  var stooqMap = {}; // Yahoo심볼 → Stooq심볼 매핑
  // Stooq 미지원: 지수(^GSPC/^DJI/^IXIC — 가격 체계 다름), VIX, 금리, 암호화폐, 환율
  var _stooqSkip = {'^GSPC':1,'^DJI':1,'^IXIC':1,'^RUT':1,'^VIX':1,'^VVIX':1,'^TNX':1,'^TYX':1,'^IRX':1,'^FVX':1,'BTC-USD':1,'ETH-USD':1};
  PRIORITY_SYMS.forEach(function(group) {
    group.forEach(function(sym) {
      if (gotSyms[sym]) return;
      if (sym.endsWith('.KS') || sym.endsWith('.KQ') || sym === '^KS11' || sym === '^KQ11') return;
      if (_stooqSkip[sym]) return;
      if (sym.includes('=X')) return; // 환율은 별도 API
      var stSym = null;
      // 원자재 선물: 명시 매핑만 (ES=F/NQ=F/YM=F 등 지수 선물은 Stooq 미지원)
      if (sym === 'CL=F') stSym = 'cl.f';
      else if (sym === 'BZ=F') stSym = 'bz.f';
      else if (sym === 'GC=F') stSym = 'gc.f';
      else if (sym === 'SI=F') stSym = 'si.f';
      else if (sym === 'NG=F') stSym = 'ng.f';
      else if (sym === 'HG=F') stSym = 'hg.f';
      else if (sym === 'DX-Y.NYB' || sym === 'DX=F') stSym = 'dx.f';
      else if (sym.includes('=F')) return; // 기타 선물(ES=F/NQ=F/YM=F 등) Stooq 미지원 → 스킵
      else {
        // 일반 미국 주식/ETF: AAPL → aapl.us, XLK → xlk.us
        var clean = sym.replace(/[^A-Z0-9]/gi, '');
        if (clean.length >= 1 && clean.length <= 5) stSym = clean.toLowerCase() + '.us';
      }
      if (stSym) { usMissing.push(sym); stooqMap[sym] = stSym; }
    });
  });

  if (usMissing.length > 0) {
    // 배치: 최대 30개씩 + 구분 쿼리
    var stBatches = [];
    for (var si = 0; si < usMissing.length; si += 30) {
      stBatches.push(usMissing.slice(si, si + 30));
    }
    for (var sbi = 0; sbi < stBatches.length; sbi++) {
      var stBatch = stBatches[sbi];
      var stSymStr = stBatch.map(function(s) { return stooqMap[s]; }).join('+');
      var stUrl = 'https://stooq.com/q/l/?s=' + stSymStr + '&f=sd2t2ohlcv&h&e=csv';
      try {
        var stResp;
        try { stResp = await fetchWithTimeout(stUrl, {}, 6000); } catch(e) { stResp = await fetchViaProxy(stUrl, 8000); }
        if (stResp.ok) {
          var stText = await stResp.text();
          // 프록시 래퍼 처리
          if (stText.startsWith('{')) { try { var stJ = JSON.parse(stText); stText = stJ.contents || stText; } catch(e){} }
          var stLines = stText.trim().split('\n').slice(1); // 헤더 제거
          stLines.forEach(function(line) {
            var cols = line.split(',');
            if (cols.length < 8 || cols[1] === 'N/D') return;
            var stSym = cols[0].trim();
            // 역매핑: Stooq심볼 → Yahoo심볼
            var yahooSym = null;
            for (var ys in stooqMap) { if (stooqMap[ys] === stSym.toLowerCase()) { yahooSym = ys; break; } }
            if (!yahooSym) return;
            // Stooq CSV: Symbol,Date,Time,Open,High,Low,Close,Volume → cols[6]=Close, cols[3]=Open
            var close = parseFloat(cols[6]) || parseFloat(cols[7]); // v46.9: Close 우선
            var open = parseFloat(cols[3]) || parseFloat(cols[4]);   // Open 우선
            // v46.4: CSV 파싱 검증 — NaN/Infinity/음수 방어
            if (!isFinite(close) || close <= 0 || !isFinite(open) || open <= 0) return;
            var prevClose = (window._liveData && window._liveData[yahooSym] && window._liveData[yahooSym].chartPreviousClose > 0)
              ? window._liveData[yahooSym].chartPreviousClose : open;
            var pct = prevClose > 0 ? ((close - prevClose) / prevClose * 100) : 0;
            if (!isFinite(pct) || Math.abs(pct) > 50) pct = 0; // 50%+ 변동 = 데이터 오류 가능
            allQuotes.push({
              symbol: yahooSym,
              regularMarketPrice: close,
              regularMarketChangePercent: +pct.toFixed(2),
              regularMarketChange: +(close - prevClose).toFixed(2),
              _source: 'live:stooq'
            });
          });
          console.log('[AIO-Stooq] 폴백 배치 ' + (sbi+1) + ':', stBatch.length + '개 시도');
        }
      } catch(e) { _aioLog('warn', 'fetch', 'Stooq 폴백 실패: ' + e.message); }
    }
  }

  // ─── 최종 결과 적용 ─────────────────────────────────────────
  if (allQuotes.length > 0) {
    applyLiveQuotes(allQuotes);
    fetchLiveQuotes._failCount = 0;
    // v48.36: 중앙 freshness 추적 — _lastFetch.quote + DATA_SNAPSHOT._isFallback 해제
    if (typeof window._markFetch === 'function') window._markFetch('quote');
    if (typeof DATA_SNAPSHOT !== 'undefined') DATA_SNAPSHOT._isFallback = false;
    updateDataStatusError('ok', 'API 연결 성공 · ' + allQuotes.length + '개 종목');
    if (typeof _reportApiOk === 'function') _reportApiOk('yahoo-quote', allQuotes.length + '개 종목');
    // v34.2: 실시간 데이터 수신 이벤트 발화 → staleness 배너 즉시 해제
    try { window.dispatchEvent(new CustomEvent('aio:liveDataReceived', { detail: { count: allQuotes.length } })); } catch(_e){}
    const lqTs = document.getElementById('live-quote-ts');
    if (lqTs) lqTs.textContent = '시세 ' + new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) + ' 갱신 (' + allQuotes.length + '개)';
  } else {
    fetchLiveQuotes._failCount = (fetchLiveQuotes._failCount||0) + 1;
    // v46.4: 지수적 백오프 (선형 30×N → 지수 15×2^N, 최대 300초)
    const wait = Math.min(300, 15 * Math.pow(2, fetchLiveQuotes._failCount - 1));
    const lqTs = document.getElementById('live-quote-ts');
    if (lqTs) lqTs.textContent = wait + '초 후 재시도...';
    updateDataStatusError('error', 'API 연결 실패 — ' + wait + '초 후 재시도');
    if (typeof _reportApiError === 'function') _reportApiError('yahoo-quote', '연결 실패 (시도 ' + fetchLiveQuotes._failCount + ')');
    setTimeout(fetchLiveQuotes, wait * 1000);
  }
}


// ── Dynamic VIX Percentile ──────────────────────────────────────
// Historical VIX distribution approximation (1990-2026)
function vixToPercentile(vix) {
  // Approximate CDF based on historical VIX distribution
  const breakpoints = [
    [8, 1], [10, 5], [12, 12], [14, 22], [16, 35],
    [18, 48], [20, 58], [22, 67], [25, 77], [28, 84],
    [30, 88], [35, 93], [40, 96], [50, 98], [80, 99.5]
  ];
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const [v0, p0] = breakpoints[i];
    const [v1, p1] = breakpoints[i + 1];
    if (vix <= v1) {
      const t = (vix - v0) / (v1 - v0);
      return Math.round((p0 + t * (p1 - p0)) * 10) / 10;
    }
  }
  return 99.5;
}

function vixRegime(vix) {
  if (vix < 12) return { label: 'Subdued', color: '#00e5a0' };
  if (vix < 16) return { label: 'Low', color: '#00d4ff' };
  if (vix < 20) return { label: 'Normal', color: '#a8b5c8' };
  if (vix < 25) return { label: 'Elevated', color: '#ffa31a' };
  if (vix < 30) return { label: 'Stressed', color: '#ffa31a' };
  if (vix < 40) return { label: 'Crisis', color: '#ff5b50' };
  return { label: 'Extreme', color: '#dc2626' };
}

// ═══════════════════════════════════════════════════════════════════
// v17: 정적 기본값 즉시 로드 — API 성공/실패 무관하게 항상 데이터 표시
// ═══════════════════════════════════════════════════════════════════
// v35.8: Risk Monitor 추가 항목 처리 (FALLBACK과 localStorage 캐시 양쪽에서 재사용)
function _applyRiskMonitorFallbacks() {
  // RSP/SPY Ratio (0.162/0.5562 ≈ 0.291)
  const rmRsp = document.getElementById('rm-rspratio-val');
  if (rmRsp && rmRsp.textContent === '—') {
    rmRsp.textContent = '0.291';
    rmRsp.style.color = '#ffa31a';
  }
  // Fear & Greed (극단적 공포 구간)
  const rmFg = document.getElementById('rm-fg-val');
  if (rmFg && rmFg.textContent === '—') {
    rmFg.textContent = '18';
    rmFg.style.color = '#ff5b50';
  }
  // HY Spread 홈 카드 (FRED 미도착 시)
  const hySpread = document.getElementById('hy-spread-val');
  if (hySpread && hySpread.textContent === '—') {
    hySpread.textContent = '+342bp';
    hySpread.style.color = '#ffa31a';
  }
}

function applyStaticFallbacks() {
  // v35.8: localStorage 캐시 우선 사용 — 하드코딩보다 최신 데이터
  // v48.2: TTL 48h → 24h 축소 + 만료 시 자동 삭제 (stale quote 방어 강화, P117)
  try {
    var cached = localStorage.getItem('aio_cached_quotes');
    if (cached) {
      var parsed = JSON.parse(cached);
      var ageHours = (Date.now() - parsed.ts) / 3600000;
      // v48.2: TTL 만료 자동 삭제 — 주말 연휴 등 24h+ 후에도 쌓인 stale 데이터가 UI에 표출되는 위험 차단
      if (ageHours >= 24) {
        try { localStorage.removeItem('aio_cached_quotes'); } catch(e) {}
        console.log('[AIO v48.2] 캐시 quote TTL(24h) 만료 — 자동 삭제');
      } else if (parsed.data && parsed.data.length > 50) {
        var cachedQuotes = parsed.data.map(function(f) {
          return { symbol: f.symbol, regularMarketPrice: f.regularMarketPrice, regularMarketChangePercent: f.regularMarketChangePercent, regularMarketChange: f.regularMarketPrice * f.regularMarketChangePercent / 100 };
        });
        applyLiveQuotes(cachedQuotes);
        var tsEl = document.getElementById('live-quote-ts');
        var ago = ageHours < 1 ? Math.round(ageHours * 60) + '분' : Math.round(ageHours) + '시간';
        if (tsEl) tsEl.textContent = '캐시 데이터 (' + ago + ' 전) · 실시간 연결 중...';
        console.log('[AIO v35.8] localStorage 캐시 폴백 사용 (' + parsed.data.length + '종목, ' + ago + ' 전)');
        // 하드코딩 폴백 건너뛰기 — 나머지 rm-rspratio 등은 계속 처리
        _applyRiskMonitorFallbacks();
        return;
      }
    }
  } catch(e) { _aioLog('warn', 'init', 'localStorage 캐시 로드 실패: ' + e.message); }

  // ── 하드코딩 폴백 (localStorage 없거나 48시간 초과 시) ──
  // 2026-04-04(금) 종가 기준 폴백 (v40.7 업데이트)
  // 실시간 데이터 도착 시 자동 교체됨 — 최대 10초 내 라이브 데이터로 전환
  const FALLBACK_QUOTES = [
    // ── 미국 주요 지수 (2026-04-15 화 종가 — v47.5: DATA_SNAPSHOT 정합) ──
    { symbol:'^GSPC',   regularMarketPrice:7022.95,     regularMarketChangePercent:+0.80 },   // v47.5: 7000 돌파 ATH
    { symbol:'^IXIC',   regularMarketPrice:24016.02,    regularMarketChangePercent:+1.59 },   // v47.5: 11일 연속 상승 ATH
    { symbol:'^DJI',    regularMarketPrice:48820.00,    regularMarketChangePercent:+1.15 },
    { symbol:'^RUT',    regularMarketPrice:2710.00,     regularMarketChangePercent:+1.30 },
    { symbol:'^VIX',    regularMarketPrice:18.36,       regularMarketChangePercent:-3.97 },
    { symbol:'^VVIX',   regularMarketPrice:90.10,       regularMarketChangePercent:-2.77 },   // v47.5: 4/15 실측 (v47.4 정정치)
    // ── 한국 지수 (4/15 종가) ──
    { symbol:'^KS11',   regularMarketPrice:5960.00,     regularMarketChangePercent:+2.60 },
    { symbol:'^KQ11',   regularMarketPrice:1190.00,     regularMarketChangePercent:+2.00 },
    // ── 원자재 (4/14 종가 — 이란 재협상 기대로 유가 급락) ──
    { symbol:'CL=F',    regularMarketPrice:91.28,       regularMarketChangePercent:-8.00 },
    { symbol:'BZ=F',    regularMarketPrice:94.79,       regularMarketChangePercent:-4.60 },
    { symbol:'GC=F',    regularMarketPrice:4822.00,     regularMarketChangePercent:+1.50 },
    { symbol:'NG=F',    regularMarketPrice:3.00,        regularMarketChangePercent:-0.80 },
    { symbol:'SI=F',    regularMarketPrice:68.00,       regularMarketChangePercent:-1.80 },
    { symbol:'HG=F',    regularMarketPrice:5.20,        regularMarketChangePercent:-2.00 },
    // ── 암호화폐 (4/14) ──
    { symbol:'BTC-USD', regularMarketPrice:74442,       regularMarketChangePercent:+5.00 },
    { symbol:'ETH-USD', regularMarketPrice:2375,        regularMarketChangePercent:+8.10 },
    { symbol:'SOL-USD', regularMarketPrice:82.00,       regularMarketChangePercent:-3.80 },
    { symbol:'BNB-USD', regularMarketPrice:610.00,      regularMarketChangePercent:-2.50 },
    // ── 환율 (4/14) ──
    { symbol:'DX-Y.NYB', regularMarketPrice:98.65,       regularMarketChangePercent:-1.53 },
    { symbol:'KRW=X',   regularMarketPrice:1485.00,     regularMarketChangePercent:-1.70 },
    { symbol:'JPY=X',   regularMarketPrice:160.50,      regularMarketChangePercent:+0.45 },
    { symbol:'EURUSD=X', regularMarketPrice:1.1520,      regularMarketChangePercent:-0.20 },
    { symbol:'GBPUSD=X', regularMarketPrice:1.3280,      regularMarketChangePercent:-0.35 },
    { symbol:'CNY=X',   regularMarketPrice:6.90,        regularMarketChangePercent:-0.10 },
    { symbol:'AUDUSD=X', regularMarketPrice:0.6950,      regularMarketChangePercent:-0.50 },
    // ── 금리 (4/4) ──
    { symbol:'^TNX',    regularMarketPrice:4.313,       regularMarketChangePercent:0 },
    { symbol:'^TYX',    regularMarketPrice:5.02,        regularMarketChangePercent:+0.80 },
    { symbol:'^IRX',    regularMarketPrice:3.58,        regularMarketChangePercent:-0.10 },
    { symbol:'^FVX',    regularMarketPrice:4.08,        regularMarketChangePercent:+0.70 },
    // ── 채권 ETF ──
    { symbol:'HYG',     regularMarketPrice:80.20,       regularMarketChangePercent:+1.62 },
    { symbol:'LQD',     regularMarketPrice:107.85,      regularMarketChangePercent:-1.23 },
    { symbol:'TLT',     regularMarketPrice:85.83,       regularMarketChangePercent:-1.90 },
    { symbol:'IEF',     regularMarketPrice:94.88,       regularMarketChangePercent:-0.90 },
    { symbol:'SHY',     regularMarketPrice:82.31,       regularMarketChangePercent:-0.22 },
    { symbol:'EMB',     regularMarketPrice:93.15,       regularMarketChangePercent:-1.56 },
    // ── 주요 ETF ──
    { symbol:'SPY',     regularMarketPrice:648.57,      regularMarketChangePercent:-1.43 },
    { symbol:'RSP',     regularMarketPrice:190.48,      regularMarketChangePercent:-1.47 },
    { symbol:'QQQ',     regularMarketPrice:582.06,      regularMarketChangePercent:-1.85 },
    { symbol:'GLD',     regularMarketPrice:413.38,      regularMarketChangePercent:-3.06 },
    { symbol:'SLV',     regularMarketPrice:61.52,       regularMarketChangePercent:-6.33 },
    // ── 섹터 ETF ──
    { symbol:'XLK',     regularMarketPrice:135.29,      regularMarketChangePercent:-2.27 },
    { symbol:'XLF',     regularMarketPrice:49.08,       regularMarketChangePercent:+0.18 },
    { symbol:'XLE',     regularMarketPrice:59.31,       regularMarketChangePercent:-0.08 },
    { symbol:'XLV',     regularMarketPrice:145.33,      regularMarketChangePercent:-0.87 },
    { symbol:'XLI',     regularMarketPrice:161.67,      regularMarketChangePercent:-1.46 },
    { symbol:'XLY',     regularMarketPrice:107.74,      regularMarketChangePercent:-1.79 },
    { symbol:'XLP',     regularMarketPrice:81.29,       regularMarketChangePercent:-0.83 },
    { symbol:'XLRE',    regularMarketPrice:40.59,       regularMarketChangePercent:-3.17 },
    { symbol:'XLB',     regularMarketPrice:46.98,       regularMarketChangePercent:-1.59 },
    { symbol:'XLU',     regularMarketPrice:44.65,       regularMarketChangePercent:-4.06 },
    { symbol:'XLC',     regularMarketPrice:112.23,      regularMarketChangePercent:-0.80 },
    { symbol:'ITA',     regularMarketPrice:222.56,      regularMarketChangePercent:-2.09 },
    { symbol:'OIH',     regularMarketPrice:386.97,      regularMarketChangePercent:-1.44 },
    { symbol:'SOXX',    regularMarketPrice:332.51,      regularMarketChangePercent:-2.26 },
    { symbol:'GDX',     regularMarketPrice:80.12,       regularMarketChangePercent:-3.35 },
    // ── 세부 섹터 ETF ──
    { symbol:'SMH',     regularMarketPrice:384.74,      regularMarketChangePercent:-2.58 },
    { symbol:'IGV',     regularMarketPrice:82.99,       regularMarketChangePercent:-1.74 },
    { symbol:'XBI',     regularMarketPrice:120.31,      regularMarketChangePercent:-1.65 },
    { symbol:'AMLP',    regularMarketPrice:52.86,       regularMarketChangePercent:-0.38 },
    { symbol:'URA',     regularMarketPrice:46.44,       regularMarketChangePercent:-3.79 },
    { symbol:'XOP',     regularMarketPrice:177.12,      regularMarketChangePercent:+1.19 },
    { symbol:'HACK',    regularMarketPrice:76.49,       regularMarketChangePercent:-2.42 },
    { symbol:'CIBR',    regularMarketPrice:64.03,       regularMarketChangePercent:-1.84 },
    { symbol:'BOTZ',    regularMarketPrice:33.6,        regularMarketChangePercent:-3.67 },
    { symbol:'ICLN',    regularMarketPrice:18.06,       regularMarketChangePercent:-3.68 },
    { symbol:'LIT',     regularMarketPrice:66.98,       regularMarketChangePercent:-2.56 },
    { symbol:'JETS',    regularMarketPrice:24.09,       regularMarketChangePercent:-2.43 },
    // ── 빅테크·반도체 ──
    { symbol:'NVDA',    regularMarketPrice:172.7,       regularMarketChangePercent:-3.28 },
    { symbol:'AAPL',    regularMarketPrice:247.99,      regularMarketChangePercent:-0.39 },
    { symbol:'TSLA',    regularMarketPrice:367.96,      regularMarketChangePercent:-3.24 },
    { symbol:'MSFT',    regularMarketPrice:381.87,      regularMarketChangePercent:-1.84 },
    { symbol:'AMZN',    regularMarketPrice:205.37,      regularMarketChangePercent:-1.63 },
    { symbol:'GOOGL',   regularMarketPrice:301,         regularMarketChangePercent:-2.00 },
    { symbol:'META',    regularMarketPrice:593.66,      regularMarketChangePercent:-2.15 },
    { symbol:'AMD',     regularMarketPrice:201.33,      regularMarketChangePercent:-1.92 },
    { symbol:'AVGO',    regularMarketPrice:310.51,      regularMarketChangePercent:-2.92 },
    { symbol:'TSM',     regularMarketPrice:329.24,      regularMarketChangePercent:-2.82 },
    { symbol:'MU',      regularMarketPrice:422.9,       regularMarketChangePercent:-4.81 },
    { symbol:'ARM',     regularMarketPrice:132.35,      regularMarketChangePercent:+1.95 },
    { symbol:'INTC',    regularMarketPrice:43.87,       regularMarketChangePercent:-5.00 },
    { symbol:'QCOM',    regularMarketPrice:129.9,       regularMarketChangePercent:-1.05 },
    { symbol:'ASML',    regularMarketPrice:1317.25,     regularMarketChangePercent:-3.60 },
    { symbol:'SMCI',    regularMarketPrice:20.53,       regularMarketChangePercent:-33.32 },
    { symbol:'PLTR',    regularMarketPrice:150.68,      regularMarketChangePercent:-3.21 },
    { symbol:'ADI',     regularMarketPrice:309.43,      regularMarketChangePercent:-0.33 },
    { symbol:'MRVL',    regularMarketPrice:87.91,       regularMarketChangePercent:-1.81 },
    { symbol:'STX',     regularMarketPrice:411.23,      regularMarketChangePercent:-5.38 },
    { symbol:'WDC',     regularMarketPrice:293.1,       regularMarketChangePercent:-7.52 },
    // ── 방산 ──
    { symbol:'LMT',     regularMarketPrice:627.43,      regularMarketChangePercent:-1.58 },
    { symbol:'RTX',     regularMarketPrice:198.16,      regularMarketChangePercent:-1.28 },
    { symbol:'NOC',     regularMarketPrice:706.95,      regularMarketChangePercent:-1.01 },
    { symbol:'GD',      regularMarketPrice:345.78,      regularMarketChangePercent:-1.10 },
    { symbol:'HII',     regularMarketPrice:407.98,      regularMarketChangePercent:-2.50 },
    { symbol:'HWM',     regularMarketPrice:231.21,      regularMarketChangePercent:-0.74 },
    { symbol:'LHX',     regularMarketPrice:352.85,      regularMarketChangePercent:-2.98 },
    { symbol:'GE',      regularMarketPrice:286.79,      regularMarketChangePercent:-1.65 },
    { symbol:'TXT',     regularMarketPrice:88.77,       regularMarketChangePercent:+0.09 },
    // ── 에너지 ──
    { symbol:'XOM',     regularMarketPrice:159.67,      regularMarketChangePercent:+0.95 },
    { symbol:'CVX',     regularMarketPrice:201.73,      regularMarketChangePercent:+0.14 },
    { symbol:'COP',     regularMarketPrice:126.92,      regularMarketChangePercent:+0.71 },
    { symbol:'OXY',     regularMarketPrice:60.71,       regularMarketChangePercent:+1.90 },
    { symbol:'DVN',     regularMarketPrice:48.66,       regularMarketChangePercent:-0.27 },
    { symbol:'FANG',    regularMarketPrice:192.54,      regularMarketChangePercent:+1.17 },
    { symbol:'KMI',     regularMarketPrice:32.84,       regularMarketChangePercent:-1.79 },
    { symbol:'TRGP',    regularMarketPrice:237.41,      regularMarketChangePercent:-0.89 },
    { symbol:'WMB',     regularMarketPrice:72.41,       regularMarketChangePercent:-2.23 },
    { symbol:'TPL',     regularMarketPrice:519.41,      regularMarketChangePercent:-2.46 },
    { symbol:'VLO',     regularMarketPrice:239.86,      regularMarketChangePercent:-0.91 },
    { symbol:'SLB',     regularMarketPrice:46.63,       regularMarketChangePercent:-2.49 },
    { symbol:'HAL',     regularMarketPrice:36.53,       regularMarketChangePercent:-1.08 },
    { symbol:'BKR',     regularMarketPrice:60.35,       regularMarketChangePercent:-0.59 },
    { symbol:'MPC',     regularMarketPrice:232.53,      regularMarketChangePercent:-1.38 },
    { symbol:'PSX',     regularMarketPrice:175.47,      regularMarketChangePercent:-1.61 },
    // ── 금융 ──
    { symbol:'JPM',     regularMarketPrice:286.56,      regularMarketChangePercent:-0.49 },
    { symbol:'GS',      regularMarketPrice:813.53,      regularMarketChangePercent:+0.50 },
    { symbol:'MS',      regularMarketPrice:161.47,      regularMarketChangePercent:+1.84 },
    { symbol:'BAC',     regularMarketPrice:47.16,       regularMarketChangePercent:+0.32 },
    { symbol:'WFC',     regularMarketPrice:77.6,        regularMarketChangePercent:+1.58 },
    { symbol:'C',       regularMarketPrice:109.52,      regularMarketChangePercent:-0.30 },
    { symbol:'V',       regularMarketPrice:301.62,      regularMarketChangePercent:+0.64 },
    { symbol:'MA',      regularMarketPrice:496.32,      regularMarketChangePercent:+1.05 },
    { symbol:'AXP',     regularMarketPrice:295.5,       regularMarketChangePercent:+0.19 },
    { symbol:'BLK',     regularMarketPrice:957.91,      regularMarketChangePercent:-1.21 },
    { symbol:'SCHW',    regularMarketPrice:94.66,       regularMarketChangePercent:+0.71 },
    // ── 핀테크/크립토 ──
    { symbol:'HOOD',    regularMarketPrice:70.89,       regularMarketChangePercent:-4.41 },
    { symbol:'SOFI',    regularMarketPrice:16.9,        regularMarketChangePercent:-1.05 },
    { symbol:'COIN',    regularMarketPrice:197.5,       regularMarketChangePercent:-2.67 },
    { symbol:'XYZ',     regularMarketPrice:59.37,       regularMarketChangePercent:+0.64 },
    { symbol:'PYPL',    regularMarketPrice:44.01,       regularMarketChangePercent:-0.41 },
    { symbol:'MSTR',    regularMarketPrice:135.66,      regularMarketChangePercent:-1.85 },
    { symbol:'MARA',    regularMarketPrice:8.46,        regularMarketChangePercent:-8.24 },
    { symbol:'RIOT',    regularMarketPrice:13.38,       regularMarketChangePercent:-5.37 },
    { symbol:'AFRM',    regularMarketPrice:43.81,       regularMarketChangePercent:-1.40 },
    { symbol:'UPST',    regularMarketPrice:25.98,       regularMarketChangePercent:-2.95 },
    { symbol:'NU',      regularMarketPrice:13.94,       regularMarketChangePercent:-1.55 },
    // ── 사이버보안 ──
    { symbol:'PANW',    regularMarketPrice:162.95,      regularMarketChangePercent:-4.00 },
    { symbol:'CRWD',    regularMarketPrice:409,         regularMarketChangePercent:-4.48 },
    { symbol:'ZS',      regularMarketPrice:151.47,      regularMarketChangePercent:-2.53 },
    { symbol:'FTNT',    regularMarketPrice:81.4,        regularMarketChangePercent:-2.07 },
    { symbol:'NET',     regularMarketPrice:215.42,      regularMarketChangePercent:-2.68 },
    // ── 로보틱스 ──
    { symbol:'ISRG',    regularMarketPrice:477.97,      regularMarketChangePercent:-0.41 },
    { symbol:'ROK',     regularMarketPrice:355.11,      regularMarketChangePercent:-0.17 },
    { symbol:'TER',     regularMarketPrice:290.83,      regularMarketChangePercent:-3.83 },
    { symbol:'EMR',     regularMarketPrice:128.15,      regularMarketChangePercent:-1.35 },
    // ── 네오클라우드/AI호스팅 ──
    { symbol:'IREN',    regularMarketPrice:41.29,       regularMarketChangePercent:-0.89 },
    { symbol:'CRWV',    regularMarketPrice:81.47,       regularMarketChangePercent:+1.00 },
    { symbol:'NBIS',    regularMarketPrice:117.62,      regularMarketChangePercent:-3.21 },
    { symbol:'CIFR',    regularMarketPrice:14.01,       regularMarketChangePercent:-4.30 },
    { symbol:'WULF',    regularMarketPrice:15.1,        regularMarketChangePercent:-4.07 },
    { symbol:'CLSK',    regularMarketPrice:9.4,         regularMarketChangePercent:-4.37 },
    { symbol:'HUT',     regularMarketPrice:47.46,       regularMarketChangePercent:-5.35 },
    { symbol:'APLD',    regularMarketPrice:25.93,       regularMarketChangePercent:-2.88 },
    { symbol:'BTBT',    regularMarketPrice:1.55,        regularMarketChangePercent:-3.73 },
    // ── 데이터센터 인프라 ──
    { symbol:'ALAB',    regularMarketPrice:116.04,      regularMarketChangePercent:-8.02 },
    { symbol:'CRDO',    regularMarketPrice:103.4,       regularMarketChangePercent:-3.45 },
    { symbol:'VRT',     regularMarketPrice:255.88,      regularMarketChangePercent:-4.94 },
    { symbol:'ANET',    regularMarketPrice:131.22,      regularMarketChangePercent:-3.70 },
    { symbol:'DELL',    regularMarketPrice:157.67,      regularMarketChangePercent:+0.58 },
    { symbol:'HPE',     regularMarketPrice:21.69,       regularMarketChangePercent:-1.94 },
    { symbol:'NTAP',    regularMarketPrice:101.11,      regularMarketChangePercent:-1.92 },
    // ── 우주/항공 ──
    { symbol:'RKLB',    regularMarketPrice:67.23,       regularMarketChangePercent:-6.53 },
    { symbol:'ASTS',    regularMarketPrice:89.93,       regularMarketChangePercent:-4.38 },
    { symbol:'LUNR',    regularMarketPrice:17.83,       regularMarketChangePercent:-5.71 },
    { symbol:'PL',      regularMarketPrice:33.83,       regularMarketChangePercent:+25.48 },
    { symbol:'RDW',     regularMarketPrice:9.2,         regularMarketChangePercent:-4.47 },
    { symbol:'FLR',     regularMarketPrice:44.92,       regularMarketChangePercent:-6.16 },
    // ── 양자컴퓨팅 ──
    { symbol:'IONQ',    regularMarketPrice:31.2,        regularMarketChangePercent:-2.19 },
    { symbol:'RGTI',    regularMarketPrice:14.88,       regularMarketChangePercent:-3.44 },
    { symbol:'QUBT',    regularMarketPrice:6.96,        regularMarketChangePercent:-3.20 },
    { symbol:'QBTS',    regularMarketPrice:15.73,       regularMarketChangePercent:-2.30 },
    // ── 광통신/포토닉스 ──
    { symbol:'LITE',    regularMarketPrice:706.35,      regularMarketChangePercent:-8.52 },
    { symbol:'COHR',    regularMarketPrice:253.63,      regularMarketChangePercent:-7.96 },
    { symbol:'CIEN',    regularMarketPrice:383.89,      regularMarketChangePercent:-6.95 },
    { symbol:'AAOI',    regularMarketPrice:87.54,       regularMarketChangePercent:-14.11 },
    { symbol:'GLW',     regularMarketPrice:124.58,      regularMarketChangePercent:-6.39 },
    { symbol:'VIAV',    regularMarketPrice:31.44,       regularMarketChangePercent:-8.20 },
    // ── 반도체 장비 ──
    { symbol:'AMAT',    regularMarketPrice:357.06,      regularMarketChangePercent:-0.04 },
    { symbol:'LRCX',    regularMarketPrice:228.36,      regularMarketChangePercent:-2.41 },
    { symbol:'KLAC',    regularMarketPrice:1498.67,     regularMarketChangePercent:-0.85 },
    { symbol:'ONTO',    regularMarketPrice:200.17,      regularMarketChangePercent:-4.44 },
    { symbol:'ACLS',    regularMarketPrice:84.43,       regularMarketChangePercent:-3.09 },
    { symbol:'ENTG',    regularMarketPrice:114.66,      regularMarketChangePercent:-1.04 },
    { symbol:'UCTT',    regularMarketPrice:57.67,       regularMarketChangePercent:-7.92 },
    // ── 원전/유틸리티 ──
    { symbol:'CEG',     regularMarketPrice:281.99,      regularMarketChangePercent:-10.90 },
    { symbol:'VST',     regularMarketPrice:146.02,      regularMarketChangePercent:-12.64 },
    { symbol:'NRG',     regularMarketPrice:145.8,       regularMarketChangePercent:-9.67 },
    { symbol:'CCJ',     regularMarketPrice:101.55,      regularMarketChangePercent:-4.74 },
    { symbol:'LEU',     regularMarketPrice:186.76,      regularMarketChangePercent:-8.94 },
    { symbol:'SMR',     regularMarketPrice:11.44,       regularMarketChangePercent:-4.59 },
    { symbol:'NEE',     regularMarketPrice:89.5,        regularMarketChangePercent:-3.15 },
    { symbol:'DUK',     regularMarketPrice:126.81,      regularMarketChangePercent:-2.26 },
    { symbol:'EXC',     regularMarketPrice:46.44,       regularMarketChangePercent:-3.27 },
    { symbol:'AEP',     regularMarketPrice:125.66,      regularMarketChangePercent:-2.38 },
    { symbol:'ETR',     regularMarketPrice:99.9,        regularMarketChangePercent:-3.89 },
    { symbol:'ES',      regularMarketPrice:66.67,       regularMarketChangePercent:-4.24 },
    { symbol:'FE',      regularMarketPrice:48.54,       regularMarketChangePercent:-2.31 },
    { symbol:'EVRG',    regularMarketPrice:78.7,        regularMarketChangePercent:-2.91 },
    { symbol:'XEL',     regularMarketPrice:76.77,       regularMarketChangePercent:-3.46 },
    { symbol:'EIX',     regularMarketPrice:69.75,       regularMarketChangePercent:-2.98 },
    { symbol:'LNT',     regularMarketPrice:68.71,       regularMarketChangePercent:-3.66 },
    { symbol:'PNW',     regularMarketPrice:97.27,       regularMarketChangePercent:-2.80 },
    { symbol:'ATO',     regularMarketPrice:180.49,      regularMarketChangePercent:-2.39 },
    // ── 미디어/통신 ──
    { symbol:'NFLX',    regularMarketPrice:91.82,       regularMarketChangePercent:+0.09 },
    { symbol:'DIS',     regularMarketPrice:99.51,       regularMarketChangePercent:+0.31 },
    { symbol:'T',       regularMarketPrice:28.31,       regularMarketChangePercent:+2.05 },
    { symbol:'VZ',      regularMarketPrice:49.98,       regularMarketChangePercent:+1.01 },
    { symbol:'TMUS',    regularMarketPrice:208.47,      regularMarketChangePercent:+0.91 },
    // ── 리테일/소비재 ──
    { symbol:'HD',      regularMarketPrice:320.75,      regularMarketChangePercent:-2.27 },
    { symbol:'NKE',     regularMarketPrice:52.37,       regularMarketChangePercent:-2.00 },
    { symbol:'SBUX',    regularMarketPrice:92.55,       regularMarketChangePercent:-3.42 },
    { symbol:'BKNG',    regularMarketPrice:4324.04,     regularMarketChangePercent:+0.69 },
    { symbol:'ABNB',    regularMarketPrice:128.52,      regularMarketChangePercent:-1.74 },
    { symbol:'WMT',     regularMarketPrice:119.02,      regularMarketChangePercent:-1.71 },
    { symbol:'LULU',    regularMarketPrice:162.82,      regularMarketChangePercent:-1.66 },
    { symbol:'TJX',     regularMarketPrice:154.98,      regularMarketChangePercent:+0.19 },
    // ── 필수소비재 ──
    { symbol:'KO',      regularMarketPrice:74.75,       regularMarketChangePercent:-1.06 },
    { symbol:'PEP',     regularMarketPrice:150.04,      regularMarketChangePercent:-1.77 },
    { symbol:'COST',    regularMarketPrice:972.33,      regularMarketChangePercent:-0.25 },
    { symbol:'PG',      regularMarketPrice:144.28,      regularMarketChangePercent:-0.39 },
    { symbol:'MCD',     regularMarketPrice:308.85,      regularMarketChangePercent:-0.24 },
    { symbol:'MNST',    regularMarketPrice:73.69,       regularMarketChangePercent:-0.07 },
    { symbol:'CL',      regularMarketPrice:85.12,       regularMarketChangePercent:-0.44 },
    { symbol:'CLX',     regularMarketPrice:106.15,      regularMarketChangePercent:-0.44 },
    { symbol:'DG',      regularMarketPrice:124.52,      regularMarketChangePercent:+0.87 },
    { symbol:'CHD',     regularMarketPrice:94.69,       regularMarketChangePercent:+0.12 },
    { symbol:'MO',      regularMarketPrice:64.47,       regularMarketChangePercent:-0.92 },
    { symbol:'PM',      regularMarketPrice:163.11,      regularMarketChangePercent:-0.16 },
    { symbol:'SYY',     regularMarketPrice:81.33,       regularMarketChangePercent:-0.42 },
    // ── 헬스케어 ──
    { symbol:'LLY',     regularMarketPrice:906.7,       regularMarketChangePercent:-1.18 },
    { symbol:'JNJ',     regularMarketPrice:235.37,      regularMarketChangePercent:-0.94 },
    { symbol:'MRK',     regularMarketPrice:114.18,      regularMarketChangePercent:-0.02 },
    { symbol:'ABBV',    regularMarketPrice:205.07,      regularMarketChangePercent:-0.56 },
    { symbol:'VRTX',    regularMarketPrice:454,         regularMarketChangePercent:-0.88 },
    { symbol:'REGN',    regularMarketPrice:732.87,      regularMarketChangePercent:-0.62 },
    { symbol:'AMGN',    regularMarketPrice:347.8,       regularMarketChangePercent:-0.61 },
    { symbol:'GILD',    regularMarketPrice:137.21,      regularMarketChangePercent:-2.76 },
    { symbol:'MRNA',    regularMarketPrice:51.38,       regularMarketChangePercent:-1.89 },
    { symbol:'BMY',     regularMarketPrice:57.48,       regularMarketChangePercent:-1.08 },
    { symbol:'DVA',     regularMarketPrice:149.31,      regularMarketChangePercent:-0.30 },
    { symbol:'MCK',     regularMarketPrice:885.84,      regularMarketChangePercent:-1.46 },
    // ── 산업재 ──
    { symbol:'CAT',     regularMarketPrice:680.88,      regularMarketChangePercent:-1.13 },
    { symbol:'HON',     regularMarketPrice:221.5,       regularMarketChangePercent:-3.29 },
    { symbol:'UNP',     regularMarketPrice:234.92,      regularMarketChangePercent:+0.32 },
    { symbol:'FDX',     regularMarketPrice:358.85,      regularMarketChangePercent:+0.77 },
    { symbol:'UPS',     regularMarketPrice:95.86,       regularMarketChangePercent:-0.72 },
    { symbol:'CSX',     regularMarketPrice:38.17,       regularMarketChangePercent:-0.83 },
    { symbol:'JBHT',    regularMarketPrice:199.93,      regularMarketChangePercent:-0.13 },
    { symbol:'NSC',     regularMarketPrice:281.09,      regularMarketChangePercent:+1.04 },
    { symbol:'ODFL',    regularMarketPrice:183.92,      regularMarketChangePercent:+0.86 },
    { symbol:'PCAR',    regularMarketPrice:111.26,      regularMarketChangePercent:-1.41 },
    { symbol:'PH',      regularMarketPrice:894.41,      regularMarketChangePercent:-0.62 },
    { symbol:'WAB',     regularMarketPrice:236.06,      regularMarketChangePercent:-0.46 },
    { symbol:'AME',     regularMarketPrice:209.37,      regularMarketChangePercent:-1.01 },
    { symbol:'GNRC',    regularMarketPrice:199.31,      regularMarketChangePercent:-0.77 },
    { symbol:'JCI',     regularMarketPrice:129.7,       regularMarketChangePercent:-2.66 },
    { symbol:'NDSN',    regularMarketPrice:262.73,      regularMarketChangePercent:-1.68 },
    // ── 소재 ──
    { symbol:'LIN',     regularMarketPrice:488.15,      regularMarketChangePercent:-0.34 },
    { symbol:'APD',     regularMarketPrice:281.01,      regularMarketChangePercent:-1.11 },
    { symbol:'FCX',     regularMarketPrice:52.09,       regularMarketChangePercent:-2.85 },
    { symbol:'NEM',     regularMarketPrice:95.8,        regularMarketChangePercent:-3.43 },
    { symbol:'CLF',     regularMarketPrice:7.82,        regularMarketChangePercent:-4.40 },
    { symbol:'ECL',     regularMarketPrice:256.48,      regularMarketChangePercent:-0.86 },
    { symbol:'IFF',     regularMarketPrice:66.62,       regularMarketChangePercent:-1.64 },
    { symbol:'CTVA',    regularMarketPrice:77.33,       regularMarketChangePercent:-0.95 },
    { symbol:'ADM',     regularMarketPrice:66.17,       regularMarketChangePercent:-3.60 },
    // ── 리츠/부동산 ──
    { symbol:'EQIX',    regularMarketPrice:959.16,      regularMarketChangePercent:-1.60 },
    { symbol:'PLD',     regularMarketPrice:128.01,      regularMarketChangePercent:-2.35 },
    { symbol:'SPG',     regularMarketPrice:184.52,      regularMarketChangePercent:-3.55 },
    { symbol:'O',       regularMarketPrice:60.95,       regularMarketChangePercent:-2.70 },
    { symbol:'DLR',     regularMarketPrice:173.3,       regularMarketChangePercent:-3.64 },
    { symbol:'VTR',     regularMarketPrice:82.5,        regularMarketChangePercent:-3.57 },
    { symbol:'KIM',     regularMarketPrice:22.34,       regularMarketChangePercent:-3.25 },
    { symbol:'REG',     regularMarketPrice:74.87,       regularMarketChangePercent:-2.37 },
    // ── 소프트웨어/클라우드 ──
    { symbol:'CRM',     regularMarketPrice:195.38,      regularMarketChangePercent:+0.20 },
    { symbol:'NOW',     regularMarketPrice:110.38,      regularMarketChangePercent:-2.55 },
    { symbol:'ADBE',    regularMarketPrice:248.15,      regularMarketChangePercent:+0.88 },
    { symbol:'ORCL',    regularMarketPrice:149.68,      regularMarketChangePercent:-3.76 },
    { symbol:'SNOW',    regularMarketPrice:168.02,      regularMarketChangePercent:-4.21 },
    { symbol:'DDOG',    regularMarketPrice:125.08,      regularMarketChangePercent:-3.74 },
    // ── 변동성·인버스 ──
    { symbol:'UVXY',    regularMarketPrice:54.1,        regularMarketChangePercent:+10.45 },
    { symbol:'SQQQ',    regularMarketPrice:80.25,       regularMarketChangePercent:+5.72 },
    // ── 기타 ──
    { symbol:'BRK-B',   regularMarketPrice:480.94,      regularMarketChangePercent:-0.11 },
    { symbol:'CCL',     regularMarketPrice:24.12,       regularMarketChangePercent:-3.29 },
    { symbol:'DAL',     regularMarketPrice:63.44,       regularMarketChangePercent:-2.42 },
    // ── 한국 주요 종목 (2026-03-27 종가 기준 · 한경/Investing.com 확인) ──
    { symbol:'005930.KS', regularMarketPrice:179700,       regularMarketChangePercent:-0.22 },  // 삼성전자
    { symbol:'000660.KS', regularMarketPrice:922000,      regularMarketChangePercent:+2.33 },  // SK하이닉스
    { symbol:'012450.KS', regularMarketPrice:1335000,      regularMarketChangePercent:+3.88 },  // 한화에어로스페이스
    { symbol:'329180.KS', regularMarketPrice:498500,      regularMarketChangePercent:+1.42 },  // HD현대중공업
    { symbol:'035420.KS', regularMarketPrice:212500,      regularMarketChangePercent:+0.93 },  // NAVER
    { symbol:'035720.KS', regularMarketPrice:48800,       regularMarketChangePercent:+0.47 },  // 카카오
    { symbol:'373220.KS', regularMarketPrice:394500,      regularMarketChangePercent:-1.15 },  // LG에너지솔루션
    { symbol:'005380.KS', regularMarketPrice:495000,      regularMarketChangePercent:+0.24 },  // 현대차
    { symbol:'034020.KS', regularMarketPrice:98100,       regularMarketChangePercent:+2.50 },  // 두산에너빌리티
    { symbol:'055550.KS', regularMarketPrice:93500,       regularMarketChangePercent:+0.88 },  // 신한지주
    { symbol:'207940.KS', regularMarketPrice:1606000,      regularMarketChangePercent:-0.33 },  // 삼성바이오로직스
    { symbol:'068270.KS', regularMarketPrice:206000,      regularMarketChangePercent:-0.75 },  // 셀트리온
    { symbol:'042660.KS', regularMarketPrice:123200,       regularMarketChangePercent:+2.14 },  // 한화오션
    { symbol:'298040.KS', regularMarketPrice:2676000,      regularMarketChangePercent:+1.58 },  // 효성중공업
    { symbol:'010120.KS', regularMarketPrice:801000,      regularMarketChangePercent:+1.28 },  // LS일렉트릭
    { symbol:'047810.KS', regularMarketPrice:186500,       regularMarketChangePercent:+4.32 },  // 한국항공우주
    { symbol:'090430.KS', regularMarketPrice:144400,      regularMarketChangePercent:+1.79 },  // 아모레퍼시픽
    { symbol:'003230.KS', regularMarketPrice:1183000,       regularMarketChangePercent:+3.25 },  // 삼양식품
    { symbol:'271560.KS', regularMarketPrice:134500,      regularMarketChangePercent:+0.46 },  // 오리온
    { symbol:'105560.KS', regularMarketPrice:152200,       regularMarketChangePercent:+0.57 },  // KB금융
    { symbol:'277810.KQ', regularMarketPrice:567000,      regularMarketChangePercent:+1.61 },  // 레인보우로보틱스
    { symbol:'315640.KQ', regularMarketPrice:3570,       regularMarketChangePercent:+4.18 },  // 뉴로메카
    { symbol:'015760.KS', regularMarketPrice:43900,       regularMarketChangePercent:-4.57 },  // 한국전력
    { symbol:'323410.KS', regularMarketPrice:24650,       regularMarketChangePercent:+0.61 },  // 카카오뱅크
    { symbol:'402340.KS', regularMarketPrice:544000,      regularMarketChangePercent:-2.51 },  // SK스퀘어
    { symbol:'034730.KS', regularMarketPrice:334000,      regularMarketChangePercent:-0.74 },  // SK
    { symbol:'003550.KS', regularMarketPrice:89000,       regularMarketChangePercent:+1.71 },  // LG
    { symbol:'028260.KS', regularMarketPrice:269000,      regularMarketChangePercent:-0.37 },  // 삼성물산
    { symbol:'009830.KS', regularMarketPrice:35650,       regularMarketChangePercent:-1.52 },  // 한화솔루션
    { symbol:'192820.KQ', regularMarketPrice:147700,      regularMarketChangePercent:-3.45 },  // 코스맥스
  ];
  const fakeQuotes = FALLBACK_QUOTES.map(f => ({
    ...f,
    regularMarketChange: f.regularMarketPrice * f.regularMarketChangePercent / 100
  }));

  applyLiveQuotes(fakeQuotes);

  // 타임스탬프: 추정값임을 명시 (localStorage 캐시 없을 때만)
  var tsEl2 = document.getElementById('live-quote-ts');
  if (tsEl2) tsEl2.textContent = ' 하드코딩 기본값 (2026-04-04) · 실시간 연결 중...';

  // Risk Monitor 추가 항목 처리
  _applyRiskMonitorFallbacks();

  console.log('[AIO v35.8] 정적 기본값 적용 완료 — API 성공 시 자동 교체됩니다');
}

function applyLiveQuotes(quotes) {
  if (!Array.isArray(quotes)) return;
  window._liveData = window._liveData || {};
  window._quoteTimestamps = window._quoteTimestamps || {};
  window._previousPrices = window._previousPrices || {};
  // v30.11: 데이터 출처 추적 — 'live:yahoo' | 'live:coingecko' | 'fx:open.er-api' | 'snapshot'
  window._dataSource = window._dataSource || {};
  const now = Date.now();

  quotes.forEach(q => {
    const pct   = q.regularMarketChangePercent;
    const price = q.regularMarketPrice;
    if (pct == null || price == null) return;

    // v31.8: PriceStore 검증 레이어 경유 (타입/범위/급변 전부 Store에서 처리)
    const accepted = PriceStore.set(q.symbol, price, pct, q._source || 'live:yahoo');
    if (!accepted) return;
    window._previousPrices[q.symbol] = price;
    // v36.6: 프리/애프터마켓 시세 저장 (미국장 마감 후 방향성 추적)
    if (q.extPrice && q.extSession) {
      window._extHoursData = window._extHoursData || {};
      window._extHoursData[q.symbol] = { price: q.extPrice, pct: q.extPct || 0, session: q.extSession, ts: now };
    }
    // v36.7: chartPreviousClose를 _liveData에 보존 (분석/해석용 종가 기준)
    if (q.chartPreviousClose && q.chartPreviousClose > 0) {
      window._liveData[q.symbol] = window._liveData[q.symbol] || {};
      window._liveData[q.symbol].chartPreviousClose = q.chartPreviousClose;
    }
    // v30.14: 환율 심볼의 chartPreviousClose를 _fxPrevClose에 자동 보정
    // Yahoo chart API에서 가져온 chartPreviousClose로 환율 변화율 즉시 계산 가능하게 함
    if (q.chartPreviousClose && q.chartPreviousClose > 0 && q.symbol.includes('=X')) {
      window._fxPrevClose = window._fxPrevClose || {};
      if (!window._fxPrevClose[q.symbol] || window._fxPrevClose[q.symbol] <= 0) {
        window._fxPrevClose[q.symbol] = q.chartPreviousClose;
      }
    }
    // v30.11: 데이터 출처 기록
    window._dataSource[q.symbol] = { source: q._source || 'live:yahoo', ts: now };
    const pctStr = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
    const cls    = pct >= 0 ? 'pnl pos' : 'pnl neg';
    // Track SPX vs ATH for Market Regime display
    if (q.symbol === '^GSPC') {
      window._spxATH = Math.max(window._spxATH || 6947, q.regularMarketPrice);
      const SPX_ATH = window._spxATH;
      const spxPrice = q.regularMarketPrice;
      const pctFromATH = ((spxPrice - SPX_ATH) / SPX_ATH * 100).toFixed(1);
      const regimeSub = document.getElementById('mkt-regime-sub');
      if (regimeSub) {
        regimeSub.textContent = 'ATH ' + (pctFromATH >= 0 ? '+' : '') + pctFromATH + '% · ' + (pctFromATH < -20 ? 'Bear' : pctFromATH < -10 ? 'Correction' : pctFromATH < -5 ? '조정' : 'Near ATH');
      }
    }
    // price 요소 — 스테일 데이터 지시자 포함
    const isMarketHours = (() => {
      const now = new Date();
      const day = now.getDay();
      if (day === 0 || day === 6) return false; // 주말
      const hours = now.getHours();
      const mins = now.getMinutes();
      const time = hours * 60 + mins;
      return time >= 570 && time < 960; // 9:30am - 4:00pm EST
    })();
    const ageMs = now - (window._quoteTimestamps[q.symbol] || now);
    const isStale = isMarketHours && ageMs > 5 * 60 * 1000; // > 5 min during market hours
    document.querySelectorAll(`[data-live-price="${q.symbol}"]`).forEach(el => {
      // v48.43: 이전 값과 비교 — flash 애니메이션 (상승:녹색/하락:빨강)
      var _prevText = el.textContent;
      var _prevNum = parseFloat(_prevText.replace(/[^\d.-]/g, ''));
      // v38.3: P24 일반 보호 — children 있는 복합 요소는 전용 업데이트에 위임
      if (el.children.length > 0) {
        var _pp = el.querySelector('.pill-price') || el.querySelector('.kr-etf-price');
        if (_pp) _pp.textContent = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      } else { el.textContent = price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
      // v48.43: flash 애니메이션 트리거 (유의미한 변화 시)
      if (isFinite(_prevNum) && _prevNum > 0 && Math.abs(price - _prevNum) / _prevNum > 0.0001) {
        el.classList.remove('aio-flash-up', 'aio-flash-down');
        void el.offsetWidth; // reflow 강제 (애니메이션 재시작)
        el.classList.add(price > _prevNum ? 'aio-flash-up' : 'aio-flash-down');
        setTimeout(function() { el.classList.remove('aio-flash-up', 'aio-flash-down'); }, 950);
      }
      if (isStale) {
        el.style.borderBottom = '2px dashed var(--yellow)';
        el.title = `가격 갱신: ${new Date(window._quoteTimestamps[q.symbol]).toLocaleTimeString('ko-KR')} — 현재: ${new Date().toLocaleTimeString('ko-KR')}`;
      } else {
        el.style.borderBottom = '';
      }
    });
    // change 요소
    document.querySelectorAll(`[data-live-chg="${q.symbol}"]`).forEach(el => {
      el.textContent = pctStr;
      el.className = cls;
    });
    // v36.8: 개별 종목 시간외 표시 — 기업분석(ticker-detail) 화면 전용
    if (q.extPrice && q.extSession) {
      // ticker-hero (기업분석 페이지)의 시간외 표시 전용 영역
      var _extHeroEl = document.getElementById('ticker-hero-ext');
      if (_extHeroEl && _currentTickerSym === q.symbol) {
        var _usS = (typeof _getUsSession === 'function') ? _getUsSession() : 'open';
        var extPctVal = q.extPct || 0;
        var extLabel = q.extSession === 'pre' ? 'Pre' : 'After';
        var extColor = extPctVal >= 0 ? '#00e5a0' : '#ff5b50';
        if (_usS === 'pre' || _usS === 'after') {
          _extHeroEl.innerHTML = '<span style="font-size:9px;color:#94a3b8;">종가 ' +
            price.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) + '</span>' +
            '<span style="font-size:9px;color:#64748b;margin:0 4px;">→</span>' +
            '<span style="font-size:9px;color:#a78bfa;margin-right:3px;">' + extLabel + '</span>' +
            '<span style="font-size:10px;color:' + extColor + ';font-weight:700;font-family:var(--font-mono);">' +
            q.extPrice.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) +
            ' (' + (extPctVal >= 0 ? '+' : '') + extPctVal.toFixed(2) + '%)</span>';
          _extHeroEl.style.display = '';
        } else {
          _extHeroEl.style.display = 'none';
        }
      }
    }
    // v36.8: 시장 지수 — RTH 외 시간에 "종가" 라벨 + 선물 참고 표시
    var _INDEX_FUTURES_MAP = {'^GSPC':'ES=F', '^IXIC':'NQ=F', '^DJI':'YM=F'};
    var _futSym = _INDEX_FUTURES_MAP[q.symbol];
    if (_futSym) {
      var _usS2 = (typeof _getUsSession === 'function') ? _getUsSession() : 'open';
      if (_usS2 !== 'open') {
        // 지수는 종가 그대로 표시 (이미 위에서 regularMarketPrice로 설정됨) + "종가" 라벨
        document.querySelectorAll(`[data-live-price="${q.symbol}"]`).forEach(el => {
          el.title = '종가 기준 — 정규장 마감가';
        });
        // 선물 시세를 참고 정보로 표시 (data-idx-futures 영역)
        var _futD = (window._liveData || {})[_futSym];
        if (_futD && _futD.price) {
          document.querySelectorAll(`[data-idx-futures="${q.symbol}"]`).forEach(el => {
            var fPct = _futD.pct != null ? _futD.pct : 0;
            var fColor = fPct >= 0 ? '#00e5a0' : '#ff5b50';
            var sessLabel = _usS2 === 'pre' ? '프리' : _usS2 === 'after' ? '애프터' : '시간외';
            el.innerHTML = '<span style="font-size:8px;color:#a78bfa;">선물(' + sessLabel + ')</span> ' +
              '<span style="font-size:9px;color:' + fColor + ';font-family:var(--font-mono);">' +
              _futD.price.toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) +
              ' (' + (fPct >= 0 ? '+' : '') + fPct.toFixed(2) + '%)</span>';
            el.style.display = '';
          });
        }
      } else {
        // 정규장 중이면 선물 참고 숨김
        document.querySelectorAll(`[data-idx-futures="${q.symbol}"]`).forEach(el => {
          el.style.display = 'none';
        });
      }
    }
    // HOME 스냅샷 카드 테두리 색 업데이트

    // Dynamic HY spread from HYG price
    if (q.symbol === 'HYG') {
      const hygPrice = q.regularMarketPrice;
      const spreadBp = Math.round(Math.max(150, (82.5 - hygPrice) * 80 + 240));
      const hsVal = document.getElementById('hy-spread-val');
      const hsSub = document.getElementById('hy-spread-sub');
      if (hsVal) {
        const hsCol = spreadBp < 300 ? '#00e5a0' : spreadBp < 450 ? '#ffa31a' : '#ff5b50';
        hsVal.textContent = '+' + spreadBp + 'bp';
        hsVal.style.color = hsCol;
        if (hsSub) hsSub.textContent = spreadBp < 300 ? 'Tight' : spreadBp < 450 ? 'Elevated · 경계' : 'Distressed · 위험';
      }
    }
    const snapMap = { '^GSPC':'snap-gspc', '^IXIC':'snap-ixic', 'CL=F':'snap-oil', 'GC=F':'snap-gold', 'BTC-USD':'snap-btc' };
    const cardId = snapMap[q.symbol];
    if (cardId) {
      const card = document.getElementById(cardId);
      if (card) card.style.borderLeftColor = pct >= 0 ? '#00e5a0' : '#ff5b50';
    }
  });
  // VIX 별도 처리 — v45.6: _liveData/DATA_SNAPSHOT 폴백 추가
  var vixQ = quotes.find(q => q.symbol === '^VIX');
  if (!vixQ) {
    var _vld = (window._liveData || {})['^VIX'];
    if (_vld && _vld.price > 0) vixQ = { symbol: '^VIX', regularMarketPrice: _vld.price };
    else if (DATA_SNAPSHOT && DATA_SNAPSHOT.vix > 0) vixQ = { symbol: '^VIX', regularMarketPrice: DATA_SNAPSHOT.vix };
  }
  if (vixQ) {
    const vp = vixQ.regularMarketPrice;
    const lvl = vp >= 30 ? '패닉 (매우 위험)' : vp >= 25 ? '공포 (경계)' : vp >= 20 ? '불안 (주의)' : vp >= 15 ? '안정' : '과도한 낙관';
    const col = vp >= 30 ? '#dc2626' : vp >= 25 ? '#ffa31a' : vp >= 20 ? '#ffa31a' : '#00e5a0';
    const vixLbl = document.getElementById('snap-vix-lbl');
    const vixVal = document.getElementById('snap-vix-val');
    if (vixLbl) vixLbl.textContent = lvl;
    if (vixVal) { vixVal.textContent = vp.toFixed(2); vixVal.style.color = col; }
    const vixCard = document.getElementById('snap-vix');
    if (vixCard) vixCard.style.borderLeftColor = col;
    // Update home page vol regime card
    const vrVal = document.getElementById('vol-regime-val');
    const vrSub = document.getElementById('vol-regime-sub');
    if (vrVal) { vrVal.textContent = vixRegime(vp).label; vrVal.style.color = col; }
    if (vrSub) vrSub.textContent = 'VIX ' + vp.toFixed(2) + ' · ' + vixToPercentile(vp) + '%ile';
    // Update VIX %ile cell in radar table
    const vixPctCell = document.getElementById('vix-pct-cell');
    if (vixPctCell) {
      const pct = vixToPercentile(vp);
      vixPctCell.textContent = pct + '%ile · ' + vixRegime(vp).label;
      vixPctCell.style.color = col;
    }
    document.querySelectorAll('[data-vix-badge]').forEach(el => el.textContent = 'VIX ' + vp.toFixed(2));
    const vixLabel = document.getElementById('vix-live-label');
    if (vixLabel) { vixLabel.textContent = lvl; vixLabel.style.color = col; }
    const vixLiveVal = document.getElementById('vix-live-val');
    if (vixLiveVal) vixLiveVal.style.color = col;
    // ── Options 페이지 VIX %ile 동적 업데이트 (v14: 하드코딩 90.9%ile 제거) ──
    const optVixPct = vixToPercentile(vp);
    const optVixLbl = vixRegime(vp).label;
    document.querySelectorAll('.options-vix-pct-label').forEach(el => {
      el.textContent = optVixLbl + ' · ' + optVixPct + '%ile';
      el.style.color = col;
    });
    // 추가 하드코딩 셀 업데이트
    const vixPctTableCell = document.getElementById('vix-pct-table-cell');
    if (vixPctTableCell) { vixPctTableCell.textContent = optVixPct + '%ile'; vixPctTableCell.style.color = col; }
  }
  const tsEl = document.getElementById('live-quote-ts');
  if (tsEl) tsEl.textContent = new Date().toLocaleTimeString('ko-KR', { hour:'2-digit', minute:'2-digit', second:'2-digit' });

  // ── Bulk update ALL data-live-price / data-live-chg elements ──
  var _ld = window._liveData || {};
  document.querySelectorAll('[data-live-price]').forEach(function(el) {
    var sym = el.getAttribute('data-live-price');
    var d = _ld[sym];
    if (d && d.price != null && !isNaN(d.price)) {
      var fmt = d.price >= 1000 ? d.price.toLocaleString(undefined, {maximumFractionDigits:0}) :
                d.price >= 10 ? d.price.toFixed(2) : d.price.toFixed(4);
      // v38.3: P24 일반 보호 — children 있는 복합 요소는 전용 업데이트에 위임
      if (el.children.length > 0) {
        var _pp = el.querySelector('.pill-price') || el.querySelector('.kr-etf-price');
        if (_pp) _pp.textContent = fmt;
      } else { el.textContent = fmt; }
    }
  });
  document.querySelectorAll('[data-live-chg]').forEach(function(el) {
    var sym = el.getAttribute('data-live-chg');
    var d = _ld[sym];
    if (d && d.pct != null && !isNaN(d.pct)) {
      var pctStr = (d.pct >= 0 ? '+' : '') + d.pct.toFixed(2) + '%';
      el.textContent = pctStr;
      el.className = d.pct >= 0 ? 'pnl pos' : 'pnl neg';
    }
  });

  // v34: 글로벌 마켓 오버뷰 신선도 타임스탬프 갱신
  window._liveQuoteTimestamp = Date.now();

  // v30.11: 신선도 뱃지 갱신
  _updateFreshnessBadges();

  // v31.9: Yahoo→FRED 실시간 브릿지 — FRED 지연 데이터를 Yahoo 실시간으로 보완
  _syncYahooToFred();

  // v35.8: 실시간 데이터 localStorage 캐시 — 다음 로드 시 폴백으로 활용
  try {
    var cacheData = quotes.map(function(q) {
      return { symbol: q.symbol, regularMarketPrice: q.regularMarketPrice, regularMarketChangePercent: q.regularMarketChangePercent };
    });
    localStorage.setItem('aio_cached_quotes', JSON.stringify({ ts: Date.now(), data: cacheData }));
  } catch(e) { /* localStorage 용량 초과 등 무시 */ }

  // Dispatch event for page-specific refresh
  document.dispatchEvent(new Event('aio:liveQuotes'));

  // v35.8: 스크리너 DB mcap/RSI 라이브 업데이트
  updateScreenerFromLiveData();

  // v35.8: 실시간 브리핑 갱신
  if (typeof generateDynamicBriefing === 'function') generateDynamicBriefing();
}

// ═══ v35.8: 동적 시장 브리핑 생성기 ═══════════════════════════════════
function generateDynamicBriefing() {
  var el = document.getElementById('dynamic-briefing-content');
  if (!el) return;
  var ld = window._liveData || {};
  var snap = (typeof DATA_SNAPSHOT !== 'undefined') ? DATA_SNAPSHOT : {};

  // 데이터 추출
  var spx = ld['^GSPC'] || {};
  var vix = ld['^VIX'] || {};
  var wti = ld['CL=F'] || {};
  var brent = ld['BZ=F'] || {};
  var gold = ld['GC=F'] || {};
  var dxy = ld['DX-Y.NYB'] || {};
  var krw = ld['KRW=X'] || {};
  var btc = ld['BTC-USD'] || {};
  var kospi = ld['^KS11'] || {};
  var tnx = ld['^TNX'] || {};

  // v48.57: _liveData 전면 미수신 + DATA_SNAPSHOT 폴백도 없으면 "로딩 중" 유지 (0/$0 의미 없는 값 금지)
  var spxPrice = spx.price || snap.spx || 0;
  if (!spxPrice || spxPrice <= 0) {
    el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:11px;line-height:1.6;">시세 데이터 수신 대기 중… <br><span style="font-size:10px;">(약 30초 내 자동 갱신)</span></div>';
    return;
  }
  var spxChg = (spx.pct != null ? spx.pct : 0);
  var vixPrice = vix.price || snap.vix || 0;
  var vixChg = (vix.pct != null ? vix.pct : 0);
  var wtiPrice = wti.price || snap.wti || 0;
  var brentPrice = brent.price || snap.brent || 0;
  var goldPrice = gold.price || snap.gold || 0;
  var dxyPrice = dxy.price || 0;
  var krwPrice = krw.price || 0;
  var btcPrice = btc.price || 0;
  var kospiPrice = kospi.price || 0;
  var tnxPrice = tnx.price || 0;

  if (spxPrice === 0) return; // 아직 데이터 없음

  // 시장 상태 판별
  var mktStatus, mktColor;
  if (spxChg <= -2) { mktStatus = '급락'; mktColor = '#ff5b50'; }
  else if (spxChg <= -1) { mktStatus = '하락'; mktColor = '#ff5b50'; }
  else if (spxChg <= -0.3) { mktStatus = '약세'; mktColor = '#ffa31a'; }
  else if (spxChg >= 2) { mktStatus = '급등'; mktColor = '#00e5a0'; }
  else if (spxChg >= 1) { mktStatus = '상승'; mktColor = '#00e5a0'; }
  else if (spxChg >= 0.3) { mktStatus = '강세'; mktColor = '#00e5a0'; }
  else { mktStatus = '보합'; mktColor = 'var(--text-secondary)'; }

  // VIX 해석
  var vixLabel, vixColor;
  if (vixPrice >= 35) { vixLabel = '극단공포'; vixColor = '#ff5b50'; }
  else if (vixPrice >= 25) { vixLabel = '공포'; vixColor = '#ff5b50'; }
  else if (vixPrice >= 20) { vixLabel = '경계'; vixColor = '#ffa31a'; }
  else if (vixPrice >= 15) { vixLabel = '주의'; vixColor = '#ffa31a'; }
  else { vixLabel = '안정'; vixColor = '#00e5a0'; }

  // 유가 상태
  var oilStatus;
  if (wtiPrice >= 100) oilStatus = '유가 $100 돌파 — 인플레 재점화 우려';
  else if (wtiPrice >= 85) oilStatus = '유가 고공행진 — 에너지 비용 부담';
  else if (wtiPrice >= 70) oilStatus = '유가 안정권 — 적정 수준 유지';
  else oilStatus = '유가 약세 — 수요 둔화 우려';

  // DXY/원화 상태
  var dxyStatus;
  if (dxyPrice >= 105) dxyStatus = '달러 강세 (DXY ' + dxyPrice.toFixed(1) + ') — 이머징 압박';
  else if (dxyPrice >= 100) dxyStatus = '달러 보합 (DXY ' + dxyPrice.toFixed(1) + ')';
  else dxyStatus = '달러 약세 (DXY ' + dxyPrice.toFixed(1) + ') — 위험자산 우호적';

  // 금리 해석
  var yieldStatus;
  if (tnxPrice >= 5.0) yieldStatus = '10Y ' + tnxPrice.toFixed(2) + '% — 금리 급등, 주식 밸류에이션 압박';
  else if (tnxPrice >= 4.5) yieldStatus = '10Y ' + tnxPrice.toFixed(2) + '% — 고금리 환경 지속';
  else if (tnxPrice >= 4.0) yieldStatus = '10Y ' + tnxPrice.toFixed(2) + '% — 금리 안정화 구간';
  else yieldStatus = '10Y ' + tnxPrice.toFixed(2) + '% — 금리 하향, 성장주 우호적';

  // F&G
  var fgVal = snap.fg || 0;
  var fgLabel = fgVal <= 25 ? '극단공포' : fgVal <= 45 ? '공포' : fgVal <= 55 ? '중립' : fgVal <= 75 ? '탐욕' : '극단탐욕';
  var fgColor = fgVal <= 25 ? '#ff5b50' : fgVal <= 45 ? '#ffa31a' : fgVal <= 55 ? 'var(--text-secondary)' : fgVal <= 75 ? '#00e5a0' : '#10b981';

  // 날짜
  var now = new Date();
  var dateStr = now.getFullYear() + '.' + String(now.getMonth()+1).padStart(2,'0') + '.' + String(now.getDate()).padStart(2,'0');
  var timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');

  // 포맷 헬퍼
  var fmt = function(v, d) { return v ? (typeof v === 'number' ? v.toFixed(d || 0) : v) : '—'; };
  var fmtPct = function(v) { return v ? (v >= 0 ? '+' : '') + v.toFixed(2) + '%' : '—'; };
  var fmtK = function(v) { return v >= 1e12 ? (v/1e12).toFixed(1) + 'T' : v >= 1e9 ? (v/1e9).toFixed(0) + 'B' : v >= 1e6 ? (v/1e6).toFixed(0) + 'M' : fmt(v); };

  var html = '';

  // ── 핵심 요약 박스 ──
  html += '<div style="background:rgba(0,212,255,0.06);border:1px solid rgba(0,212,255,0.2);border-radius:8px;padding:10px 14px;margin-bottom:12px;">';
  html += '<div style="font-size:10px;font-weight:700;color:#5ba8ff;margin-bottom:6px;">실시간 시장 요약 (' + dateStr + ' ' + timeStr + ' 기준)</div>';
  html += '<div style="font-size:9px;color:var(--text-secondary);line-height:1.8;">';
  html += '<div>① <b style="color:' + mktColor + ';">시장 ' + mktStatus + '</b> — S&P ' + fmt(spxPrice,0) + ' (' + fmtPct(spxChg) + '), VIX ' + fmt(vixPrice,1) + ' | F&G <span style="color:' + fgColor + ';">' + fmt(fgVal) + ' ' + fgLabel + '</span></div>';
  html += '<div>② <b style="color:' + (wtiPrice >= 85 ? '#ff5b50' : '#00e5a0') + ';">에너지</b> — WTI $' + fmt(wtiPrice,1) + ', Brent $' + fmt(brentPrice,1) + ' | ' + oilStatus + '</div>';
  html += '<div>③ <b style="color:' + (tnxPrice >= 4.5 ? '#ffa31a' : '#00e5a0') + ';">금리·달러</b> — ' + yieldStatus + ' | ' + dxyStatus + '</div>';
  html += '<div>④ <b style="color:var(--text-secondary);">자산</b> — 금 $' + fmt(goldPrice,0) + ' | BTC $' + fmt(btcPrice,0) + ' | 원/달러 ' + fmt(krwPrice,0) + '원 | KOSPI ' + fmt(kospiPrice,0) + '</div>';
  html += '</div></div>';

  // ── 3컬럼 핵심 지표 ──
  html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">';
  // S&P
  var spxBorderColor = spxChg < 0 ? 'rgba(255,91,80,0.2)' : 'rgba(0,229,160,0.2)';
  html += '<div style="background:var(--bg-card);border:1px solid ' + spxBorderColor + ';border-radius:8px;padding:12px;text-align:center;">';
  html += '<div style="font-size:8px;color:var(--text-muted);margin-bottom:4px;">S&P 500</div>';
  html += '<div style="font-size:22px;font-weight:900;font-family:var(--font-mono);color:' + mktColor + ';">' + fmt(spxPrice,0) + '</div>';
  html += '<div style="font-size:8px;color:' + mktColor + ';margin-top:3px;">' + fmtPct(spxChg) + ' · ' + mktStatus + '</div></div>';
  // WTI
  var oilColor = wtiPrice >= 85 ? '#ff5b50' : '#00e5a0';
  html += '<div style="background:var(--bg-card);border:1px solid ' + (wtiPrice >= 85 ? 'rgba(255,91,80,0.2)' : 'var(--border)') + ';border-radius:8px;padding:12px;text-align:center;">';
  html += '<div style="font-size:8px;color:var(--text-muted);margin-bottom:4px;">WTI 원유</div>';
  html += '<div style="font-size:22px;font-weight:900;font-family:var(--font-mono);color:' + oilColor + ';">$' + fmt(wtiPrice,1) + '</div>';
  html += '<div style="font-size:8px;color:' + oilColor + ';margin-top:3px;">Brent $' + fmt(brentPrice,1) + '</div></div>';
  // VIX
  html += '<div style="background:var(--bg-card);border:1px solid ' + (vixPrice >= 25 ? 'rgba(255,91,80,0.2)' : 'var(--border)') + ';border-radius:8px;padding:12px;text-align:center;">';
  html += '<div style="font-size:8px;color:var(--text-muted);margin-bottom:4px;">VIX 변동성</div>';
  html += '<div style="font-size:22px;font-weight:900;font-family:var(--font-mono);color:' + vixColor + ';">' + fmt(vixPrice,1) + '</div>';
  html += '<div style="font-size:8px;color:' + vixColor + ';margin-top:3px;">' + fmtPct(vixChg) + ' · ' + vixLabel + '</div></div>';
  html += '</div>';

  // ── v40.4: NASDAQ · Gold · USD/KRW 추가 3컬럼 ──
  var ndx = ld['^IXIC'] || {};
  var ndxPrice = ndx.price || 0;
  var ndxChg = (ndx.pct != null ? ndx.pct : 0);
  var ndxColor = ndxChg < 0 ? '#ff5b50' : '#00e5a0';
  var goldChg = (gold.pct != null ? gold.pct : 0);
  var goldColor2 = goldChg < 0 ? '#ff5b50' : '#ffa31a';
  var krwChg = (krw.pct != null ? krw.pct : 0);
  var krwColor = krwPrice >= 1400 ? '#ff5b50' : krwPrice >= 1350 ? '#ffa31a' : '#00e5a0';
  if (ndxPrice > 0 || goldPrice > 0 || krwPrice > 0) {
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px;">';
    // NASDAQ
    html += '<div style="background:var(--bg-card);border:1px solid ' + (ndxChg<0?'rgba(255,91,80,0.2)':'rgba(0,229,160,0.2)') + ';border-radius:8px;padding:12px;text-align:center;">';
    html += '<div style="font-size:8px;color:var(--text-muted);margin-bottom:4px;">NASDAQ</div>';
    html += '<div style="font-size:22px;font-weight:900;font-family:var(--font-mono);color:' + ndxColor + ';">' + fmt(ndxPrice,0) + '</div>';
    html += '<div style="font-size:8px;color:' + ndxColor + ';margin-top:3px;">' + fmtPct(ndxChg) + '</div></div>';
    // Gold
    html += '<div style="background:var(--bg-card);border:1px solid rgba(255,163,26,0.2);border-radius:8px;padding:12px;text-align:center;">';
    html += '<div style="font-size:8px;color:var(--text-muted);margin-bottom:4px;">Gold</div>';
    html += '<div style="font-size:22px;font-weight:900;font-family:var(--font-mono);color:' + goldColor2 + ';">$' + fmt(goldPrice,0) + '</div>';
    html += '<div style="font-size:8px;color:' + goldColor2 + ';margin-top:3px;">' + fmtPct(goldChg) + '</div></div>';
    // USD/KRW
    html += '<div style="background:var(--bg-card);border:1px solid ' + (krwPrice>=1400?'rgba(255,91,80,0.2)':'var(--border)') + ';border-radius:8px;padding:12px;text-align:center;">';
    html += '<div style="font-size:8px;color:var(--text-muted);margin-bottom:4px;">USD/KRW</div>';
    html += '<div style="font-size:22px;font-weight:900;font-family:var(--font-mono);color:' + krwColor + ';">' + fmt(krwPrice,0) + '</div>';
    html += '<div style="font-size:8px;color:' + krwColor + ';margin-top:3px;">' + fmtPct(krwChg) + '</div></div>';
    html += '</div>';
  }

  // ── v40.4: 트레이딩 스코어 게이지 ──
  var tsScore = 50, tsLabel = '분석중', tsColor = 'var(--text-secondary)';
  try {
    if (typeof computeTradingScore === 'function') {
      var tsResult = computeTradingScore();
      tsScore = tsResult.score || 50;
    }
  } catch(e) {}
  if (tsScore >= 75) { tsLabel = '적극 매수 OK'; tsColor = '#00e5a0'; }
  else if (tsScore >= 55) { tsLabel = '선별적 매수'; tsColor = '#00d4ff'; }
  else if (tsScore >= 35) { tsLabel = '관망'; tsColor = '#ffa31a'; }
  else { tsLabel = '방어 모드'; tsColor = '#ff5b50'; }
  var tsPct = Math.min(100, Math.max(0, tsScore));
  html += '<div style="background:var(--bg-card);border:1px solid rgba(0,212,255,0.15);border-radius:8px;padding:10px 14px;margin-bottom:12px;">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">';
  html += '<span style="font-size:9px;font-weight:700;color:#5ba8ff;">매매 환경 스코어</span>';
  html += '<span style="font-size:12px;font-weight:900;font-family:var(--font-mono);color:' + tsColor + ';">' + tsScore + '/100 · ' + tsLabel + '</span>';
  html += '</div>';
  html += '<div style="height:6px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden;">';
  html += '<div style="height:100%;width:' + tsPct + '%;background:' + tsColor + ';border-radius:3px;transition:width 0.5s;"></div>';
  html += '</div></div>';

  // ── v40.4: 섹터 히트맵 ──
  var sectorETFs = [{s:'XLK',n:'기술'},{s:'XLF',n:'금융'},{s:'XLE',n:'에너지'},{s:'XLV',n:'헬스'},{s:'XLI',n:'산업'},{s:'XLY',n:'소비'},{s:'XLP',n:'필수'},{s:'XLRE',n:'리츠'},{s:'XLB',n:'소재'},{s:'XLU',n:'유틸'},{s:'XLC',n:'통신'}];
  var secHasData = false;
  sectorETFs.forEach(function(e) { if (ld[e.s] && ld[e.s].pct != null) secHasData = true; });
  if (secHasData) {
    html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin-bottom:12px;">';
    html += '<div style="font-size:8px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">섹터 히트맵</div>';
    html += '<div style="display:flex;flex-wrap:wrap;gap:4px;">';
    sectorETFs.forEach(function(e) {
      var d = ld[e.s];
      if (!d || d.pct == null) return;
      var p = d.pct;
      var bg = p > 1.5 ? 'rgba(0,229,160,0.25)' : p > 0 ? 'rgba(0,229,160,0.12)' : p > -1.5 ? 'rgba(255,91,80,0.12)' : 'rgba(255,91,80,0.25)';
      var tc = p >= 0 ? '#00e5a0' : '#ff5b50';
      html += '<div style="background:' + bg + ';border-radius:4px;padding:3px 6px;text-align:center;min-width:44px;">';
      html += '<div style="font-size:9px;color:var(--text-muted);">' + e.n + '</div>';
      html += '<div style="font-size:9px;font-weight:700;font-family:var(--font-mono);color:' + tc + ';">' + (p>=0?'+':'') + p.toFixed(1) + '%</div>';
      html += '</div>';
    });
    html += '</div></div>';
  }

  // ── v40.4: M7 리더십 미니 바 ──
  var m7syms = ['AAPL','MSFT','GOOGL','AMZN','NVDA','META','TSLA'];
  var m7Has = false;
  m7syms.forEach(function(t) { if (ld[t] && ld[t].pct != null) m7Has = true; });
  if (m7Has) {
    var m7UpCnt = 0;
    html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:8px 12px;margin-bottom:12px;">';
    html += '<div style="font-size:8px;font-weight:700;color:var(--text-muted);margin-bottom:6px;">M7 리더십</div>';
    html += '<div style="display:flex;gap:6px;flex-wrap:wrap;">';
    m7syms.forEach(function(t) {
      var d = ld[t];
      if (!d || d.pct == null) return;
      if (d.pct > 0) m7UpCnt++;
      var c2 = d.pct >= 0 ? '#00e5a0' : '#ff5b50';
      html += '<div style="text-align:center;min-width:36px;">';
      html += '<div style="font-size:9px;color:var(--text-muted);">' + t + '</div>';
      html += '<div style="font-size:9px;font-weight:700;font-family:var(--font-mono);color:' + c2 + ';">' + (d.pct>=0?'+':'') + d.pct.toFixed(1) + '%</div>';
      html += '</div>';
    });
    html += '</div>';
    var m7Ratio = m7UpCnt + '/7 상승';
    var m7RColor = m7UpCnt >= 5 ? '#00e5a0' : m7UpCnt >= 3 ? '#ffa31a' : '#ff5b50';
    html += '<div style="font-size:8px;color:' + m7RColor + ';margin-top:4px;font-weight:600;">' + m7Ratio + (m7UpCnt >= 5 ? ' — 리더십 건강' : m7UpCnt >= 3 ? ' — 혼조' : ' — 리더십 약화') + '</div>';
    html += '</div>';
  }

  el.innerHTML = html;
  console.log('[AIO v40.4] 동적 브리핑 생성 완료 (' + dateStr + ' ' + timeStr + ')');
}

// v35.8: 스크리너 DB mcap 라이브 업데이트
function updateScreenerFromLiveData() {
  if (!window._liveData || typeof SCREENER_DB === 'undefined') return;
  SCREENER_DB.forEach(function(item) {
    var ld = window._liveData[item.sym];
    if (!ld) return;
    if (ld.marketCap) item.mcap = Math.round(ld.marketCap / 1e9);
    // RSI는 Yahoo Finance quote에 없으므로 유지
  });
  console.log('[AIO] 스크리너 DB mcap 라이브 업데이트 완료');
}

// ═══ v31.9: Yahoo→FRED 실시간 데이터 브릿지 ═════════════════════════
// FRED 데이터는 1~5일 지연. Yahoo에서 이미 실시간으로 가져오는 동일 데이터가 있으면
// FRED 값을 Yahoo 실시간 값으로 자동 대체하여 모든 하류 계산이 최신 데이터 사용
const _YAHOO_FRED_MAP = {
  // Yahoo심볼 → { fredId, transform(yahooPrice) → fredValue }
  '^TNX':     { fredId: 'DGS10',    transform: v => v,         label: '10Y 국채금리' },
  '^TYX':     { fredId: 'DGS30',    transform: v => v,         label: '30Y 국채금리' },
  '^FVX':     { fredId: 'DGS5',     transform: v => v,         label: '5Y 국채금리' },
  '^IRX':     { fredId: 'DGS3MO',   transform: v => v,         label: '3M 국채금리' },
  '^VIX':     { fredId: 'VIXCLS',   transform: v => v,         label: 'VIX' },
  'DX-Y.NYB': { fredId: 'DTWEXBGS', transform: v => v,         label: '달러인덱스' },
  'HYG':      { fredId: '_HY_PROXY', transform: v => Math.max(1.5, (82.5 - v) * 0.8 + 2.4), label: 'HY스프레드(추정)' },
};

function _syncYahooToFred() {
  const ld = window._liveData || {};
  const fd = window._fredData || {};
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];
  let synced = 0;

  for (const [ySym, cfg] of Object.entries(_YAHOO_FRED_MAP)) {
    const yahoo = ld[ySym];
    if (!yahoo || !yahoo.price || yahoo.price <= 0) continue;

    const yahooVal = cfg.transform(yahoo.price);
    const fredEntry = fd[cfg.fredId];

    // FRED 데이터가 없거나 1영업일 이상 지연된 경우 Yahoo로 대체
    let fredStale = !fredEntry;
    if (fredEntry && fredEntry.date) {
      const fredDate = new Date(fredEntry.date);
      const diffDays = Math.floor((now - fredDate) / 86400000);
      fredStale = diffDays > 1; // 1일 초과면 stale
    }

    if (fredStale) {
      // Yahoo 실시간 값으로 FRED 파이프라인에 주입
      if (!window._fredData) window._fredData = {};
      const prevVal = fredEntry ? fredEntry.value : yahooVal;
      window._fredData[cfg.fredId] = {
        value: yahooVal,
        prevValue: fredEntry ? fredEntry.value : yahooVal,
        date: todayStr,
        _source: 'yahoo-realtime:' + ySym,
        _overrideTs: Date.now()
      };

      // MacroStore에도 동기화 (검증 우회 — Yahoo에서 이미 검증됨)
      if (window.MacroStore && MacroStore._data) {
        MacroStore._data[cfg.fredId] = {
          value: yahooVal,
          prevValue: prevVal,
          date: todayStr,
          source: 'yahoo-bridge'
        };
      }
      synced++;
    }
  }

  // DGS10 실시간 → 10Y-2Y 스프레드 자동 갱신
  const tnx = ld['^TNX'];
  if (tnx && tnx.price > 0) {
    const y10 = tnx.price;
    const y2 = window._live2Y || (fd['DGS2'] ? fd['DGS2'].value : 4.0);
    const spread10y2y = y10 - y2;
    if (!window._fredData) window._fredData = {};
    window._fredData['T10Y2Y'] = {
      value: spread10y2y,
      prevValue: fd['T10Y2Y'] ? fd['T10Y2Y'].value : spread10y2y,
      date: todayStr,
      _source: 'yahoo-calc:^TNX-DGS2'
    };
    // UI 즉시 갱신
    const spreadEl = document.getElementById('spread-2s10s-val');
    if (spreadEl) {
      spreadEl.textContent = (spread10y2y >= 0 ? '+' : '') + spread10y2y.toFixed(2) + '%';
      spreadEl.style.color = spread10y2y < 0 ? '#ff5b50' : '#00e5a0';
    }
  }

  // 10Y-3M 스프레드도 갱신
  const irx = ld['^IRX'];
  if (tnx && tnx.price > 0 && irx && irx.price > 0) {
    const spread10y3m = tnx.price - irx.price;
    if (!window._fredData) window._fredData = {};
    window._fredData['T10Y3M'] = {
      value: spread10y3m,
      prevValue: fd['T10Y3M'] ? fd['T10Y3M'].value : spread10y3m,
      date: todayStr,
      _source: 'yahoo-calc:^TNX-^IRX'
    };
  }

  if (synced > 0) {
    console.log('[AIO v31.9] Yahoo→FRED 실시간 브릿지:', synced + '개 시리즈 대체 (FRED 지연→Yahoo 실시간)');
    // FRED UI 재갱신 (Yahoo 실시간 값으로)
    if (typeof applyFredToUI === 'function') applyFredToUI(window._fredData);
  }
}

// ═══ v30.11: 데이터 신선도 뱃지 시스템 ═══════════════════════════════
// 각 data-live-price 요소 옆에 실시간/정적 구분 표시
function _getDataFreshness(symbol) {
  var src = (window._dataSource || {})[symbol];
  var ts  = (window._quoteTimestamps || {})[symbol];
  if (!src || !ts) {
    // 데이터 출처 없음 → 정적 폴백 사용 중
    return { level: 'snapshot', label: '정적', color: '#7b8599', title: 'DATA_SNAPSHOT 정적 데이터 (API 미연결)' };
  }
  var age = Date.now() - ts;
  var srcLabel = src.source || 'unknown';
  if (age < 120000) {
    return { level: 'live', label: '실시간', color: '#00e5a0', title: srcLabel + ' · ' + Math.round(age/1000) + '초 전' };
  }
  if (age < 600000) {
    var mins = Math.floor(age / 60000);
    return { level: 'recent', label: mins + '분전', color: '#ffa31a', title: srcLabel + ' · ' + mins + '분 전 갱신' };
  }
  var hrs = Math.floor(age / 3600000);
  var minR = Math.floor((age % 3600000) / 60000);
  return { level: 'stale', label: (hrs > 0 ? hrs + '시간' : minR + '분') + '전', color: '#ff5b50', title: srcLabel + ' · 갱신 지연' };
}

function _updateFreshnessBadges() {
  document.querySelectorAll('[data-live-price]').forEach(function(el) {
    var sym = el.getAttribute('data-live-price');
    var info = _getDataFreshness(sym);
    // dot 요소 찾기/생성
    var dot = el.parentElement ? el.parentElement.querySelector('.aio-src-dot[data-for="' + sym + '"]') : null;
    if (!dot && el.parentElement) {
      dot = document.createElement('span');
      dot.className = 'aio-src-dot';
      dot.setAttribute('data-for', sym);
      dot.style.cssText = 'display:inline-block;width:5px;height:5px;border-radius:50%;margin-left:3px;vertical-align:middle;cursor:help;';
      // 가격 요소 바로 뒤에 삽입
      if (el.nextSibling) {
        el.parentElement.insertBefore(dot, el.nextSibling);
      } else {
        el.parentElement.appendChild(dot);
      }
    }
    if (dot) {
      dot.style.background = info.color;
      dot.title = info.title;
    }
  });
}

// (showPage 훅은 showPage 함수 본문에 직접 포함됨)

// ── Trading Signal 페이지 ────────────────────────────────────────
function toggleSignalMode(mode) {
  _signalMode = mode; // Update global state
  const swBtn = document.getElementById('sig-sw-btn');
  const dyBtn = document.getElementById('sig-dy-btn');
  const desc  = document.getElementById('sig-mode-desc');
  if (mode === 'swing') {
    if (swBtn) { swBtn.style.background='var(--accent-dim)'; swBtn.style.color='var(--accent)'; }
    if (dyBtn) { dyBtn.style.background='transparent';       dyBtn.style.color='var(--text-muted)'; }
    if (desc)  desc.textContent = '스윙 트레이딩 모드 · 임계값 60점 · 자동 갱신 45초';
  } else {
    if (dyBtn) { dyBtn.style.background='rgba(255,163,26,0.1)'; dyBtn.style.color='var(--yellow)'; }
    if (swBtn) { swBtn.style.background='transparent';           swBtn.style.color='var(--text-muted)'; }
    if (desc)  desc.textContent = '데이 트레이딩 모드 · 임계값 65점 (더 엄격) · 자동 갱신 45초';
  }
}

let sigRefreshTimer = null;
let sigLastRefresh  = Date.now();

function refreshSignal() {
  sigLastRefresh = Date.now();
  const ts = document.getElementById('sig-ts');
  if (ts) ts.textContent = '갱신: 방금 전';
  // 이후 5초마다 경과 시간 표시 갱신
  if (sigRefreshTimer) clearInterval(sigRefreshTimer);
  sigRefreshTimer = setInterval(() => {
    const sec = Math.round((Date.now() - sigLastRefresh) / 1000);
    const ts2 = document.getElementById('sig-ts');
    if (ts2) {
      if (sec < 60) ts2.textContent = `갱신: ${sec}초 전`;
      else          ts2.textContent = `갱신: ${Math.floor(sec/60)}분 전`;
    }
  }, 5000);
}

// ═══ HOME PAGE DASHBOARD REFRESH ═══════════════════════════════════
function refreshHomeDashboard() {
  const ld = window._liveData || {};
  const spx = ld['^GSPC'] || {};
  const vix = ld['^VIX'] || {};
  const dxy = ld['DX-Y.NYB'] || {};
  const fg = window._lastFG || ((typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._fallback) ? DATA_SNAPSHOT._fallback.fg : 35);
  const ts = new Date();

  // SECTION 0: One-line market summary
  const spxChg = spx.pct != null ? spx.pct.toFixed(2) : '—'; // R15: null vs 0% 구분
  const vixLevel = vix.price?.toFixed(2) || String(DATA_SNAPSHOT.vix);
  const vixStatus = vix.price != null ? (vix.price < 15 ? '안정' : vix.price < 20 ? '주의' : vix.price < 25 ? '경계' : vix.price < 30 ? '공포' : '극단공포') : '—';
  const marketMood = spx.pct != null ? (spx.pct > 0.5 ? '낙관' : spx.pct < -0.5 ? '경계' : '관망') : '—';
  const summarytxt = spxChg !== '—'
    ? `S&P 500 ${parseFloat(spxChg) >= 0 ? '+' : ''}${spxChg}%, VIX ${vixLevel} ${vixStatus} — 시장 분위기: ${marketMood}`
    : `VIX ${vixLevel} ${vixStatus} — 시장 분위기: ${marketMood}`;
  const summaryEl = document.getElementById('home-summary-text');
  if (summaryEl) summaryEl.textContent = summarytxt;
  const summaryTimeEl = document.getElementById('home-summary-time');
  if (summaryTimeEl) summaryTimeEl.textContent = ts.toLocaleTimeString('ko-KR', {hour:'2-digit', minute:'2-digit'});

  // SECTION 1: Trading Decision Dashboard
  let tradingScore;
  if (typeof computeTradingScore === 'function') {
    try {
      const freshScores = computeTradingScore();
      tradingScore = freshScores.total;
      window._tradingScore = tradingScore;
    } catch(e) { tradingScore = window._tradingScore || 50; }
  } else {
    tradingScore = window._tradingScore || 50;
  }
  const signalEl = document.getElementById('home-trading-signal');
  const explanEl = document.getElementById('home-trading-explanation');
  if (signalEl) {
    if (tradingScore > 70) {
      signalEl.textContent = 'YES';
      signalEl.style.color = '#00e5a0';
      if (explanEl) explanEl.textContent = '시장 품질 우수. 매매 신호 강함. 변동성 안정적.' + (tradingScore >= 80 ? ' 참고: 과열 구간. 역사적으로 이 수준에서 차익실현이 유효했던 사례가 있음' : '');
    } else if (tradingScore > 50) {
      signalEl.textContent = 'CAUTION';
      signalEl.style.color = '#ffa31a';
      if (explanEl) explanEl.textContent = '시장 품질 중립. 신호 혼합. 위험 관리 필수.';
    } else {
      signalEl.textContent = 'NO';
      signalEl.style.color = '#ff5b50';
      if (explanEl) explanEl.textContent = '시장 품질 악화. 신호 약함. 포지션 축소 권장.' + (tradingScore <= 25 ? ' 참고: 극단적 약세 구간이나, 역사적으로 분할 매수 시작 시 높은 수익으로 이어진 사례가 있음' : '');
    }
  }

  // Market Quality Meter
  const qualityEl = document.getElementById('home-quality-meter');
  const qualityScoreEl = document.getElementById('home-quality-score');
  const qualityLabelEl = document.getElementById('home-quality-label');
  if (qualityEl && qualityScoreEl) {
    qualityScoreEl.textContent = Math.round(tradingScore);
    qualityScoreEl.style.color = tradingScore > 55 ? '#00e5a0' : tradingScore > 35 ? '#ffa31a' : '#ff5b50';
    const meterBar = qualityEl.querySelector('div');
    if (meterBar) {
      meterBar.style.width = tradingScore + '%';
      const meterColor = tradingScore > 75 ? '#00e5a0' : tradingScore > 55 ? '#4ade80' : tradingScore > 40 ? '#ffa31a' : tradingScore > 25 ? '#ffa31a' : '#ef4444';
      meterBar.style.background = meterColor;
    }
    if (qualityLabelEl) {
      if (tradingScore > 75) { qualityLabelEl.textContent = '우수 (Excellent)'; qualityLabelEl.style.color = '#00e5a0'; }
      else if (tradingScore > 55) { qualityLabelEl.textContent = '양호 (Good)'; qualityLabelEl.style.color = '#4ade80'; }
      else if (tradingScore > 35) { qualityLabelEl.textContent = '중립 (Neutral)'; qualityLabelEl.style.color = '#ffa31a'; }
      else if (tradingScore > 25) { qualityLabelEl.textContent = '악화 (Poor)'; qualityLabelEl.style.color = '#ffa31a'; }
      else { qualityLabelEl.textContent = '위험 (Danger)'; qualityLabelEl.style.color = '#ef4444'; }
    }
  }

  // Market Regime
  const regimeEl = document.getElementById('home-market-regime');
  const regimeExplEl = document.getElementById('home-regime-explanation');
  if (regimeEl) {
    const SPX_ATH = window._spxATH || 6947;  // v34.5: 동적 추적 우선, 폴백 6947 (2026-01-27)
    const spxPrice = spx.price || 6506;
    const pctFromATH = ((spxPrice - SPX_ATH) / SPX_ATH * 100);
    let regime = 'UPTREND', regimeColor = '#00e5a0', regimeDesc = 'ATH 근처';
    if (pctFromATH < -20) { regime = 'DOWNTREND'; regimeColor = '#ff5b50'; regimeDesc = 'ATH ' + pctFromATH.toFixed(1) + '%'; }
    else if (pctFromATH < -10) { regime = 'CORRECTION'; regimeColor = '#ffa31a'; regimeDesc = 'ATH ' + pctFromATH.toFixed(1) + '%'; }
    else if (pctFromATH < -5) { regime = 'PULLBACK'; regimeColor = '#ffa31a'; regimeDesc = 'ATH ' + pctFromATH.toFixed(1) + '%'; }
    regimeEl.textContent = regime;
    regimeEl.style.color = regimeColor;
    // v35.4 B2: 국면별 역사적 참고 한 줄
    var _regimeRef = {
      'UPTREND': '',
      'PULLBACK': ' · 참고: 5~10% 조정은 연평균 3회 발생하는 정상 패턴',
      'CORRECTION': ' · 참고: 10~20% 조정 후 12개월 내 회복한 비율이 역사적으로 높음',
      'DOWNTREND': ' · 참고: 항복 매도(거래량 폭증+VIX 스파이크) 이후 12개월 수익률이 역사적으로 양(+)인 경우가 많음'
    };
    if (regimeExplEl) regimeExplEl.textContent = regimeDesc + (_regimeRef[regime] || '');
    // v34.5: 홈 상단 리스크 뱃지 동적 업데이트
    var riskBadge = document.getElementById('home-risk-regime-badge');
    if (riskBadge) {
      if (regime === 'DOWNTREND') { riskBadge.textContent = ' 하락추세'; riskBadge.className = 'status-pill sp-risk-off'; }
      else if (regime === 'CORRECTION') { riskBadge.textContent = ' 조정 국면'; riskBadge.className = 'status-pill sp-risk-off'; }
      else if (regime === 'PULLBACK') { riskBadge.textContent = ' 눌림 구간'; riskBadge.className = 'status-pill sp-neutral'; }
      else { riskBadge.textContent = ' 상승 추세'; riskBadge.className = 'status-pill sp-risk-on'; }
    }
  }

  // SECTION 2: VIX Status
  const vixValueEl = document.getElementById('home-vix-value');
  const vixStatusEl = document.getElementById('home-vix-status');
  if (vixValueEl) {
    const vp = vix.price || DATA_SNAPSHOT.vix;
    vixValueEl.textContent = vp.toFixed(2);
    const vixLabel = vp >= 30 ? '극단공포' : vp >= 25 ? '공포' : vp >= 20 ? '경계' : vp >= 15 ? '주의' : '안정';
    const vixCol = vp >= 30 ? '#dc2626' : vp >= 25 ? '#ffa31a' : vp >= 20 ? '#ffa31a' : '#00e5a0';
    vixValueEl.style.color = vixCol;
    if (vixStatusEl) vixStatusEl.textContent = vixLabel;
  }

  // Fear & Greed
  const fgScoreEl = document.getElementById('home-fg-score');
  const fgLabelEl = document.getElementById('home-fg-label');
  if (fgScoreEl) {
    fgScoreEl.textContent = Math.round(fg);
    const fgColor = fg <= 25 ? '#dc2626' : fg <= 45 ? '#ffa31a' : fg <= 55 ? '#7b8599' : fg <= 75 ? '#86efac' : '#16a34a';
    fgScoreEl.style.color = fgColor;
    const fgLabel = fg <= 25 ? '극단적 공포' : fg <= 45 ? '공포' : fg <= 55 ? '중립' : fg <= 75 ? '탐욕' : '극단적 탐욕';
    if (fgLabelEl) fgLabelEl.textContent = fgLabel;
  }

  // SECTION 3: Market Briefing — v45.6: 실시간 섹터 데이터 기반 동적 생성
  const briefingEl = document.getElementById('home-briefing-content');
  if (briefingEl) {
    var _sectorETFs = ['XLK','XLF','XLE','XLV','XLY','XLP','XLI','XLB','XLC','XLRE','XLU'];
    var _sNames = {XLK:'기술',XLF:'금융',XLE:'에너지',XLV:'헬스케어',XLY:'경기소비재',XLP:'필수소비재',XLI:'산업재',XLB:'소재',XLC:'커뮤니케이션',XLRE:'부동산',XLU:'유틸리티'};
    var _sPcts = [];
    _sectorETFs.forEach(function(s) {
      var d = _liveData[s];
      if (d && d.pct != null) _sPcts.push({sym: s, name: _sNames[s] || s, pct: d.pct});
    });
    var topSector, bottomSector, breadthComment;
    if (_sPcts.length >= 3) {
      _sPcts.sort(function(a, b) { return b.pct - a.pct; });
      topSector = _sPcts[0].name + ' (' + _sPcts[0].sym + ' ' + (_sPcts[0].pct > 0 ? '+' : '') + _sPcts[0].pct.toFixed(1) + '%)';
      bottomSector = _sPcts[_sPcts.length - 1].name + ' (' + _sPcts[_sPcts.length - 1].sym + ' ' + (_sPcts[_sPcts.length - 1].pct > 0 ? '+' : '') + _sPcts[_sPcts.length - 1].pct.toFixed(1) + '%)';
      var posCount = _sPcts.filter(function(s) { return s.pct > 0; }).length;
      var ratio = posCount / _sPcts.length;
      breadthComment = ratio >= 0.7 ? '넓음 (광범위 상승)' : ratio >= 0.4 ? '보통 (선별적 흐름)' : '좁음 (소수 섹터 집중)';
    } else {
      topSector = '데이터 수집 중…'; bottomSector = '데이터 수집 중…'; breadthComment = '데이터 대기';
    }
    var briefing = `
      <div>• 최강 섹터: ${topSector}</div>
      <div>• 최약 섹터: ${bottomSector}</div>
      <div>• 시장 폭: ${breadthComment}</div>
      <div>• 신호 강도: ${tradingScore > 70 ? '강함' : tradingScore > 50 ? '중립' : '약함'}</div>
    `;
    briefingEl.innerHTML = briefing;
  }

  // v27.2: SECTION 4 — newsCache 기반으로 통합 (renderHomeFeed와 동일 메커니즘)
  // newsCache가 있으면 renderHomeFeed 호출, _newsItems 폴백은 유지
  const newsEl = document.getElementById('home-news-highlights');
  if (newsEl) {
    if (typeof newsCache !== 'undefined' && newsCache.length > 0) {
      renderHomeFeed(newsCache);
    } else if (window._newsItems && window._newsItems.length > 0) {
      const top3 = window._newsItems.slice(0, 3);
      newsEl.innerHTML = top3.map(item => {
        const sent = typeof getSentimentFromText === 'function' ? getSentimentFromText(item.headline || '') : 'neut';
        const sentColor = sent === 'bull' ? '#00e5a0' : sent === 'bear' ? '#ff5b50' : sent === 'warn' ? '#ffa31a' : '#7b8599';
        const tickers = typeof getDisplayTickers === 'function' && item.title ? getDisplayTickers(item) : [];
        const tickerStr = tickers.length > 0 ? `<div style="margin-top:3px;">${tickers.map(t => `<span style="font-size:8px;font-weight:800;color:#60a5fa;font-family:var(--font-mono);background:rgba(0,212,255,0.1);padding:1px 4px;border-radius:3px;margin-right:2px;">${escHtml(t)}</span>`).join('')}</div>` : '';
        return `<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius);padding:10px;border-top:2px solid ${sentColor};">
          <div style="font-size:8px;color:var(--text-muted);margin-bottom:4px;font-weight:700;">${escHtml(item.source || 'NEWS')}</div>
          <div style="font-size:9px;font-weight:600;line-height:1.3;margin-bottom:4px;">${escHtml(item.headline || '뉴스 로딩 중...')}</div>
          ${tickerStr}
          <div style="font-size:8px;color:var(--text-muted);">${item.timeAgo || '방금'}</div>
        </div>`;
      }).join('');
    }
  }
}

// Hook into page activation
const originalShowPage = window.showPage;
window.showPage = function(pageId, ...args) {
  const result = originalShowPage.call(this, pageId, ...args);
  if (pageId === 'home') {
    setTimeout(refreshHomeDashboard, 100);
  }
  // v48.51: Breadth 페이지 진입 시 9-canvas fallback 렌더러 실행
  if (pageId === 'breadth') {
    setTimeout(function(){
      if (typeof window._aioBreadthCanvasRender === 'function') {
        try { window._aioBreadthCanvasRender(); } catch(e) {}
      }
    }, 150);
  }
  // v48.59: FRED/BOK/KOSIS 지연 fetch (페이지 진입 시만)
  if (pageId === 'macro' || pageId === 'fxbond') {
    setTimeout(function(){
      if (typeof fetchAllFredData === 'function' && !window._fredData) {
        try { fetchAllFredData(); } catch(_){}
      }
    }, 500);
  }
  if (pageId === 'kr-macro' || pageId === 'kr-home') {
    setTimeout(function(){
      if (typeof fetchAllBokData === 'function' && !window._bokData) {
        try { fetchAllBokData(); } catch(_){}
      }
      if (typeof fetchAllKosisData === 'function' && !window._kosisData) {
        try { fetchAllKosisData(); } catch(_){}
      }
    }, 500);
  }
  return result;
};

// Update on live quote refresh
document.addEventListener('aio:liveQuotes', () => {
  const activePage = document.querySelector('.page.active');
  if (activePage && activePage.id === 'page-home') {
    refreshHomeDashboard();
  }
});

// Initialize home dashboard on page show
document.addEventListener('aio:pageShown', function(e) {
  if (e.detail === 'home') setTimeout(refreshHomeDashboard, 150);
});


// ── 시장 심리 지표 (Market Sentiment) ────────────────────────────────

// Fear & Greed 게이지 바늘 업데이트 (score 0-100)
function fgUpdateNeedle(score) {
  const rad = (180 - score * 1.8) * Math.PI / 180;
  const x = (120 + 80 * Math.cos(rad)).toFixed(2);
  const y = (120 - 80 * Math.sin(rad)).toFixed(2);
  const needle = document.getElementById('fg-needle');
  if (needle) {
    needle.setAttribute('x1', '120'); needle.setAttribute('y1', '120');
    needle.setAttribute('x2', x); needle.setAttribute('y2', y);
  }
}

// F&G rating → color
function fgColor(score) {
  if (score < 25)  return '#dc2626';
  if (score < 45)  return '#ffa31a';
  if (score < 55)  return '#7b8599';
  if (score < 75)  return '#86efac';
  return '#16a34a';
}

function fgRating(score) {
  if (score < 25)  return '극단적 공포 (Extreme Fear)';
  if (score < 45)  return '공포 (Fear)';
  if (score < 55)  return '중립 (Neutral)';
  if (score < 75)  return '탐욕 (Greed)';
  return '극단적 탐욕 (Extreme Greed)';
}

// CNN Fear & Greed 실시간 Fetch
async function fetchFearGreed() {
  const badge = document.getElementById('fg-live-badge');
  const url   = 'https://production.dataviz.cnn.io/index/fearandgreed/graphdata';
  try {
    const resp = await fetchWithTimeout(url, { headers: { 'Accept': 'application/json' } }, 6000);
    if (!resp.ok) throw new Error('status ' + resp.status);
    const data = await resp.json();
    const fg   = data.fear_and_greed;
    if (!fg) throw new Error('no data');
    const score = Math.round(fg.score);
    const prev  = data.fear_and_greed_historical?.data;
    // Update score
    window._lastFG = score;
    // v48.0: CNN F&G 7개 서브컴포넌트 저장 — "왜 공포인가?" 설명용 + AI 프롬프트 품질 향상
    // CNN API가 제공: market_momentum_sp500, market_momentum_sp125, stock_price_strength,
    //                  stock_price_breadth, put_call_options, market_volatility_vix,
    //                  market_volatility_vix_50, junk_bond_demand, safe_haven_demand
    try {
      var _sub = {};
      ['market_momentum_sp500','market_momentum_sp125','stock_price_strength','stock_price_breadth','put_call_options','market_volatility_vix','market_volatility_vix_50','junk_bond_demand','safe_haven_demand'].forEach(function(k){
        if (data[k] && data[k].score != null) {
          _sub[k] = { score: Math.round(data[k].score), rating: data[k].rating || '', timestamp: data[k].timestamp || null };
        }
      });
      if (Object.keys(_sub).length > 0) {
        window._fgComponents = _sub;
        window._fgComponents._updated = Date.now();
        // v48.1: 서브컴포넌트 카드 UI 즉시 렌더 (sentiment 페이지 활성 시)
        if (typeof _renderFGComponents === 'function') setTimeout(_renderFGComponents, 0);
      }
    } catch(subErr) { /* 서브컴포넌트는 옵셔널 — 실패해도 메인 score 갱신은 성공 */ }
    const big = document.getElementById('fg-score-big');
    const rat = document.getElementById('fg-rating-text');
    const col = fgColor(score);
    if (big) { big.textContent = score; big.style.color = col; }
    if (rat) { rat.textContent = fgRating(score); rat.style.color = col; }
    fgUpdateNeedle(score);
    if (badge) { badge.textContent = '실시간 · CNN API'; badge.style.color = '#00e5a0'; }
    // Historical
    if (prev && prev.length >= 4) {
      const h1 = document.getElementById('fg-h1');
      if (h1) {
        const prevScore = Math.round(prev[prev.length-2]?.y ?? prev[prev.length-2]?.x ?? 0);
        // y = score, x = timestamp — 값이 1000 이상이면 timestamp이므로 무시
        if (prevScore > 0 && prevScore <= 100) {
          h1.textContent = '전일: ' + prevScore + '점';
        } else {
          var _fbScore = window._lastFG || ((typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._fallback) ? DATA_SNAPSHOT._fallback.fg : 35);
          h1.textContent = _fbScore <= 25 ? '극단 공포 구간' : _fbScore <= 45 ? '공포 구간' : _fbScore <= 55 ? '중립 구간' : _fbScore <= 75 ? '탐욕 구간' : '극단 탐욕 구간';
        }
      }
    }
    return true;
  } catch(e) {
    // Try CORS proxy
    try {
      const proxy = CORS_PROXY + encodeURIComponent(url);
      const r2    = await fetchWithTimeout(proxy, {}, 9000);
      const w     = await r2.json();
      var _fgRaw; try { _fgRaw = JSON.parse(w.contents || '{}'); } catch(pe) { _fgRaw = {}; }
      const data2 = _fgRaw;
      const fg2   = data2.fear_and_greed;
      if (fg2) {
        const score2 = Math.round(fg2.score);
        const big2   = document.getElementById('fg-score-big');
        const rat2   = document.getElementById('fg-rating-text');
        const col2   = fgColor(score2);
        if (big2) { big2.textContent = score2; big2.style.color = col2; }
        if (rat2) { rat2.textContent = fgRating(score2); rat2.style.color = col2; }
        // v35.4 B3: 극단 구간 역사적 참고
        var _fgRef = document.getElementById('fg-historical-ref');
        if (_fgRef) {
          if (score2 <= 15) _fgRef.textContent = '참고: 과거 F&G 15↓ 구간에서 6~12개월 후 수익률이 양(+)이었던 사례가 다수';
          else if (score2 >= 85) _fgRef.textContent = '참고: 과거 F&G 85+ 구간에서 3~6개월 후 조정이 발생한 사례가 다수';
          else _fgRef.textContent = '';
        }
        // v42.1: 극단 공포/탐욕 시 시그널 페이지 링크 표시
        var _fgLink = document.getElementById('fg-signal-link');
        if (_fgLink) _fgLink.style.display = (score2 <= 25 || score2 >= 75) ? 'block' : 'none';
        fgUpdateNeedle(score2);
        if (badge) { badge.textContent = '실시간 (프록시)'; badge.style.color = '#ffa31a'; }
      }
      // v37.8: 심리 복합 분석 갱신
      if (typeof _generateSentimentAnalysis === 'function') setTimeout(_generateSentimentAnalysis, 200);
      return true;
    } catch(e2) {
      if (badge) { badge.textContent = '폴백 데이터 (과거 스냅샷)'; badge.style.color = '#7b8599'; }
      fgUpdateNeedle((typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._fallback) ? DATA_SNAPSHOT._fallback.fg : 15);
      if (typeof _generateSentimentAnalysis === 'function') setTimeout(_generateSentimentAnalysis, 200);
      return false;
    }
  }
}

// ═══ AUTO-UPDATE MOVING AVERAGES (50/200 SMA) ═══════════════════════
async function autoUpdateMA() {
  try {
    const url = 'https://query1.finance.yahoo.com/v8/finance/chart/^GSPC?range=1y&interval=1d';
    const r = await fetchViaProxy(url, 8000);
    const json = typeof r.json === 'function' ? await r.json() : JSON.parse(r);
    const closes = (json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || []).filter(Boolean);
    if (closes.length >= 200) {
      const ma200 = closes.slice(-200).reduce((a,b) => a+b, 0) / 200;
      const ma50  = closes.slice(-50).reduce((a,b) => a+b, 0) / 50;
      window._spxMA = {
        200: Math.round(ma200 * 100) / 100,
        50:  Math.round(ma50 * 100) / 100
      };
      console.log('[AIO] MA auto-updated: 50SMA=' + window._spxMA[50] + ', 200SMA=' + window._spxMA[200]);
      if (typeof refreshHomeDashboard === 'function') refreshHomeDashboard();
    }
  } catch(e) {
    _aioLog('warn', 'render', 'MA auto-update failed: ' + (e.message || e));
  }
}
// v30.11: T7 _maAutoInterval 삭제 — REFRESH_SCHEDULE.maUpdate(6h)로 통합. 초기 5s 실행은 유지.
setTimeout(autoUpdateMA, 5000);

// v48.1: CNN F&G 9개 서브컴포넌트 카드 렌더 — "왜 이 수준인가?" 설명
function _renderFGComponents() {
  var widget = document.getElementById('fg-components-widget');
  var grid = document.getElementById('fg-components-grid');
  if (!widget || !grid || !window._fgComponents) return;
  var labels = {
    market_momentum_sp500: 'S&P500 모멘텀',
    market_momentum_sp125: 'S&P500 125일',
    stock_price_strength: '52주 신고가/저가',
    stock_price_breadth: '시장 폭 (McClellan)',
    put_call_options: 'Put/Call 비율',
    market_volatility_vix: 'VIX 50일 대비',
    market_volatility_vix_50: 'VIX 50일선',
    junk_bond_demand: '정크본드 수요',
    safe_haven_demand: '안전자산 수요'
  };
  var descriptions = {
    market_momentum_sp500: '125일 이평선 대비',
    stock_price_strength: '신고가 vs 신저가',
    stock_price_breadth: '상승/하락 거래량 (NYSE)',
    put_call_options: '5일 평균',
    market_volatility_vix: 'VIX 현재 vs 50일 평균',
    market_volatility_vix_50: 'VIX 장기 평균',
    junk_bond_demand: 'HY - IG 스프레드',
    safe_haven_demand: '주식 vs 채권 20일 수익률'
  };
  var html = '';
  var order = ['market_momentum_sp500','stock_price_strength','stock_price_breadth','put_call_options','market_volatility_vix','junk_bond_demand','safe_haven_demand','market_momentum_sp125','market_volatility_vix_50'];
  order.forEach(function(k) {
    var c = window._fgComponents[k];
    if (!c || c.score == null) return;
    var score = c.score;
    var rating = c.rating || '';
    var color = score <= 25 ? '#ef4444' : score <= 45 ? '#ff5b50' : score <= 55 ? '#ffa31a' : score <= 75 ? '#34d399' : '#10b981';
    html += '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:7px 9px;">' +
      '<div style="font-size:9px;color:var(--text-muted);font-weight:600;">' + labels[k] + '</div>' +
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:2px;">' +
      '<span style="font-size:16px;font-weight:800;color:' + color + ';font-family:var(--font-mono);">' + score + '</span>' +
      (rating ? '<span style="font-size:8px;color:' + color + ';font-weight:600;">' + rating + '</span>' : '') +
      '</div>' +
      (descriptions[k] ? '<div style="font-size:8px;color:var(--text-muted);margin-top:2px;">' + descriptions[k] + '</div>' : '') +
      '</div>';
  });
  if (html) {
    grid.innerHTML = html;
    widget.style.display = 'block';
  }
}
// sentiment 페이지 진입 시 재렌더 (이미 _fgComponents 있으면 즉시 표시)
document.addEventListener('aio:pageShown', function(e) {
  if (e && e.detail === 'sentiment' && window._fgComponents) {
    setTimeout(_renderFGComponents, 100);
  }
  // v48.10: sentiment 페이지 진입 시 크립토 온도계도 렌더
  if (e && e.detail === 'sentiment' && window._cgGlobal) {
    setTimeout(_renderCryptoTempo, 100);
  }
});

// v48.10: 크립토 시장 온도계 렌더 — sentiment 페이지 F&G 카드 하단에 표시
//   BTC 도미넌스는 위험자산 선호도의 선행 지표 (도미넌스↑ = 알트에서 BTC로 피신 = 공포)
//   24h 시총 변동 = 크립토 전체 심리 방향
function _renderCryptoTempo() {
  var widget = document.getElementById('crypto-tempo-widget');
  var grid = document.getElementById('crypto-tempo-grid');
  if (!widget || !grid || !window._cgGlobal) return;
  var g = window._cgGlobal;
  var html = '';
  function card(label, value, sub, color) {
    return '<div style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:7px 9px;">' +
      '<div style="font-size:9px;color:var(--text-muted);font-weight:600;">' + label + '</div>' +
      '<div style="font-size:15px;font-weight:800;color:' + (color || 'var(--text-primary)') + ';font-family:var(--font-mono);margin-top:2px;">' + value + '</div>' +
      (sub ? '<div style="font-size:8px;color:var(--text-muted);margin-top:2px;">' + sub + '</div>' : '') +
      '</div>';
  }
  // BTC 도미넌스 (40~50% 중립, 50%+ 알트 약세·공포, 40%- 알트시즌·탐욕)
  if (g.btcDominance != null) {
    var bd = g.btcDominance;
    var bdSub = bd >= 55 ? '알트 약세 · BTC 피신 신호' : bd >= 48 ? '중립 상단' : bd >= 42 ? '중립 하단' : '알트시즌 임박';
    var bdColor = bd >= 55 ? '#ff5b50' : bd >= 48 ? '#ffa31a' : bd >= 42 ? '#00e5a0' : '#00d4ff';
    html += card('BTC 도미넌스', bd.toFixed(1) + '%', bdSub, bdColor);
  }
  // ETH 도미넌스
  if (g.ethDominance != null) {
    html += card('ETH 도미넌스', g.ethDominance.toFixed(1) + '%', 'Ethereum 점유', 'var(--text-primary)');
  }
  // 전체 시총
  if (g.totalMarketCapUSD) {
    var mc = g.totalMarketCapUSD;
    var mcStr = mc >= 1e12 ? '$' + (mc/1e12).toFixed(2) + 'T' : '$' + (mc/1e9).toFixed(0) + 'B';
    html += card('전체 시총', mcStr, '활성 코인 ' + (g.activeCryptocurrencies||'-') + '개');
  }
  // 24h 변동
  if (g.mcapChange24hPct != null) {
    var pc = g.mcapChange24hPct;
    var pcColor = pc >= 3 ? '#10b981' : pc >= 0 ? '#00e5a0' : pc >= -3 ? '#ffa31a' : '#ff5b50';
    html += card('24h 시총 변동', (pc >= 0 ? '+' : '') + pc.toFixed(2) + '%', pc >= 0 ? '상승' : '하락', pcColor);
  }
  // 24h 거래량
  if (g.totalVolume24hUSD) {
    var v = g.totalVolume24hUSD;
    var vStr = v >= 1e12 ? '$' + (v/1e12).toFixed(2) + 'T' : '$' + (v/1e9).toFixed(0) + 'B';
    html += card('24h 거래량', vStr, '시장 ' + (g.markets||'-') + '개');
  }
  if (html) {
    grid.innerHTML = html;
    widget.style.display = 'block';
  }
}
// fetchLiveQuotes 성공 시 _cgGlobal 세팅되면 자동 렌더 훅 (최초 데이터 수신 직후)
document.addEventListener('aio:pageShown', function(e) {
  if (e && e.detail === 'sentiment') setTimeout(_renderCryptoTempo, 300);
});

// CBOE Put/Call Ratio Fetch
async function fetchPutCall() {
  const badge  = document.getElementById('pc-live-badge');
  const cboeUrl = 'https://cdn.cboe.com/api/global/us_options_volume/options_volume.json';
  try {
    const proxy = CORS_PROXY + encodeURIComponent(cboeUrl);
    const resp  = await fetchWithTimeout(proxy, {}, 8000);
    const w     = await resp.json();
    var _pcRaw; try { _pcRaw = JSON.parse(w.contents || '{}'); } catch(pe) { _pcRaw = {}; }
    const data  = _pcRaw;
    // CBOE JSON structure: data.data[last].pcr_vol (equity P/C)
    const rows  = data.data || [];
    if (rows.length > 0) {
      const latest = rows[rows.length - 1];
      const pcr    = latest.pcr_vol || latest.total_pcr || null;
      if (pcr) {
        const big = document.getElementById('pc-score-big');
        if (big) big.textContent = parseFloat(pcr).toFixed(2);
        // v35.8: regime-pcr 동적 연결
        var regPcr = document.getElementById('regime-pcr');
        if (regPcr) { regPcr.textContent = parseFloat(pcr).toFixed(2); regPcr.style.color = parseFloat(pcr) > 1.2 ? '#ff5b50' : parseFloat(pcr) > 0.9 ? '#ffa31a' : '#00e5a0'; }
        if (typeof DATA_SNAPSHOT !== 'undefined') DATA_SNAPSHOT.pcr = parseFloat(pcr);
        window._putCallRatio = parseFloat(pcr); // v46.9: computeTradingScore/computeExecutionWindow 참조용 (P88)
        if (badge) { badge.textContent = '실시간 · CBOE'; badge.style.color = '#00e5a0'; }
        // Update needle position: (pcr - 0.4)/(1.2-0.4)*100
        const pct = Math.min(100, Math.max(0, (parseFloat(pcr) - 0.4) / 0.8 * 100));
        const needle = document.getElementById('pc-needle-pos');
        if (needle) needle.style.left = pct.toFixed(1) + '%';
        return true;
      }
    }
    throw new Error('no pcr data');
  } catch(e) {
    if (badge) { badge.textContent = '폴백 데이터 (과거 스냅샷)'; badge.style.color = '#7b8599'; }
    return false;
  }
}

// ── HY Credit Spread auto-fetch via FRED (free, no API key needed) ───
let hyLastFetch = 0;
async function fetchHYSpread() {
  const CACHE_MS = 6 * 60 * 60 * 1000; // 6-hour cache (FRED updates daily)
  if (Date.now() - hyLastFetch < CACHE_MS) return;

  const fredUrl = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=BAMLH0A0HYM2&vintage_date=' + new Date().toISOString().slice(0,10);
  // v29.4: 죽은 프록시 제거, CF Worker 우선
  const _cfHy = _getApiKey('aio_cf_worker_url') || '';
  const hyProxies = [
    ...(_cfHy ? [`${_cfHy}?url=${encodeURIComponent(fredUrl)}`] : []),
    'https://corsproxy.io/?' + encodeURIComponent(fredUrl),
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(fredUrl),
    'https://api.allorigins.win/get?url=' + encodeURIComponent(fredUrl),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(fredUrl),
  ];

  // withTimeout is global

  // v29: 다중 프록시로 CSV 수신 시도 (JSON + raw 텍스트 둘 다 처리)
  let csv = '';
  for (const pUrl of hyProxies) {
    try {
      const resp = await fetchWithTimeout(pUrl, {}, 9000);
      if (!resp.ok) continue;
      const ct = resp.headers.get('content-type') || '';
      if (ct.includes('json')) {
        const json = await resp.json();
        csv = json.contents || (typeof json === 'string' ? json : '');
      } else {
        csv = await resp.text();
      }
      if (csv && csv.length > 20 && csv.includes(',')) break;
      csv = '';
    } catch(e) { /* 다음 프록시 시도 */ }
  }
  if (!csv) { showDataError('HY', 'HY 스프레드 프록시 전부 실패 — 정적 데이터 사용 중', 'warn'); }

  try {
    if (!csv) throw new Error('all proxies failed');
       // CSV format: "DATE,VALUE" (e.g. 2026-03-19,3.68)
    const lines = csv.trim().split(/\r?\n/).filter(l => l && !l.startsWith('DATE'));
    if (lines.length === 0) throw new Error('empty csv');

    // Get latest value (last non-empty line)
    const lastLine = lines[lines.length - 1];
    const [date, val] = lastLine.split(',');
    const spread = parseFloat(val);
    if (isNaN(spread)) throw new Error('invalid value');

    const spreadBp = Math.round(spread * 100); // FRED stores as %, convert to bps
    hyLastFetch = Date.now();

    // Update display
    const hyVal = document.getElementById('hy-live-val');
    const hyDate = document.getElementById('hy-live-date');
    const hyBadge = document.getElementById('hy-live-badge');
    if (hyVal) hyVal.textContent = spreadBp + 'bp';
    if (hyDate) hyDate.textContent = date;
    if (hyBadge) {
      hyBadge.textContent = 'FRED LIVE';
      hyBadge.style.background = 'rgba(0,229,160,0.15)';
      hyBadge.style.color = '#00e5a0';
    }

    // Update chart data if chart exists
    const hyChart = window.sentPageCharts?.['hy'];
    if (hyChart) {
      const ds = hyChart.data.datasets[0];
      ds.data[ds.data.length - 1] = spreadBp; // update latest point
      hyChart.update('none');
    }

    // Update signal badge based on level
    const signalEl = document.getElementById('hy-signal-badge');
    if (signalEl) {
      const caution = spreadBp > 400;
      signalEl.textContent = caution ? 'SHORT' : spreadBp < 300 ? 'LONG' : 'CAUTION';
      signalEl.style.background = caution ? 'rgba(255,91,80,0.12)' : 'rgba(0,229,160,0.12)';
      signalEl.style.color = caution ? 'var(--red)' : '#00e5a0';
    }

    console.log('[AIO] HY Spread FRED:', spreadBp + 'bp (' + date + ')');
  } catch(e) {
    _aioLog('warn', 'fetch', 'HY Spread fetch 실패: ' + e.message);
    // v48.27 (QA-1): 폴백 복귀 + 배지 갱신 — 사용자가 데이터 신선도 인지 가능
    try {
      var _fbHy = (typeof DATA_SNAPSHOT !== 'undefined' && DATA_SNAPSHOT._fallback && DATA_SNAPSHOT._fallback.hy) || 285;
      var _hyValEl = document.getElementById('hy-live-val');
      var _hyBadgeEl = document.getElementById('hy-live-badge');
      if (_hyValEl) _hyValEl.textContent = _fbHy + 'bp';
      if (_hyBadgeEl) {
        _hyBadgeEl.textContent = '폴백 데이터';
        _hyBadgeEl.style.background = 'rgba(126,138,158,0.15)';
        _hyBadgeEl.style.color = '#7b8599';
      }
    } catch(_){}
  }
}

