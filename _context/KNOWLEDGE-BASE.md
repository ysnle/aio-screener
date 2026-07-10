---
verified_by: human
last_verified: 2026-05-31
confidence: high
---

# AIO Screener -- 기술 지식 베이스 (Knowledge Base)

> **목적**: 대화/작업 중 발견한 기술적 인사이트를 축적하여, 새 대화에서 같은 것을 재발견하는 비효율을 제거.
> BUG-POSTMORTEM이 "무엇이 고장났나"를 기록한다면, 이 파일은 "어떻게 동작하는가"를 기록한다.
>
> **환류 규칙 (R26)**: 새 인사이트 발견 시 이 파일에 추가. 반복 패턴이면 RULES.md 규칙 승격 검토.
> **카테고리**: API, 브라우저, Chart.js, DOM/CSS, JS 패턴, 데이터

---

## v51.80 Portfolio UX: 기록을 분석으로 바꾸는 루프 (2026-07-01)

### PF-UX-I. 포트폴리오 페이지의 핵심 가치는 "보유 현황"보다 "의사결정 개선"이다
- 사용자는 티커/수량/평단을 입력한 직후 자기 포트폴리오를 분석하고 싶어 한다. 따라서 AI 진입점은 글로벌 채팅에만 있으면 부족하고, 포트폴리오 페이지 내부에 있어야 한다.
- 좋은 포트폴리오 UX는 `입력 -> 현재 상태 -> AI 분석 -> 매매 복기 -> 다음 규칙/학습 과제` 흐름을 한 화면에서 닫는다.
- 복기 노트는 live market data가 아니라 user-supplied context다. AI 답변은 노트를 근거로 삼되, 현재 가격/뉴스/지표처럼 취급하면 안 된다.

### PF-UX-II. AI 답변은 P&L 평가보다 의사결정 품질 평가가 먼저다
- 손익이 좋았는지보다 ①진입 근거가 명확했는지 ②손절/무효화 기준이 있었는지 ③포지션 크기가 적절했는지 ④감정과 사실을 분리했는지 ⑤다음에 반복할 규칙이 생겼는지가 더 중요하다.
- 사용자가 "내 보유 종목 분석"을 누르면 전체 포트폴리오, 선택 종목, 최근 복기 노트, 백테스트 결과가 서로 다른 evidence layer로 들어가야 한다.
- UX regression gate는 DOM 존재만 보지 말고, AI 패널 context forcing, prompt injection, local journal storage, reflection prompt contract를 함께 확인해야 한다.

## v51.79 Portfolio Visualizer식 백테스트 결과 계약 (2026-07-01)
> 출처: Portfolio Visualizer Backtest Portfolio 페이지 직접 점검, AIO portfolio 페이지 비교

### BT-I. 백테스트는 "현재 보유 상태"가 아니라 "가정 기반 시간 경로"다
- 입력 계약은 초기 금액, 기간, 현금흐름, 인플레이션/인출, 리밸런싱, 레버리지, 배당 재투자, 벤치마크, 자산별 배분을 명시한다.
- AIO는 현재 단계에서 현금흐름/세금/수수료/레버리지까지 구현하지 않고, 월말 가격 기반 장기 경로와 리밸런싱 규칙을 명시한 `Portfolio Backtest Lab`으로 분리한다.
- 사용자에게는 live holdings/P&L과 historical simulation을 같은 판단 근거로 섞지 말고, 서로 다른 evidence layer로 보여줘야 한다.

### BT-II. 결과 표는 성과 요약 하나로 끝나면 안 된다
- 핵심 결과 묶음: performance summary(CAGR, stdev, best/worst year, MDD, Sharpe, Sortino), active risk(active return, tracking error, information ratio, benchmark correlation), risk metrics(beta/alpha, VaR/CVaR, capture), growth path, annual/monthly returns, drawdowns, stress/rolling context, attribution.
- AIO v51.79의 최소 계약은 `monthlyRows`, `annualRows`, `drawdowns`, `components`, `performance`이며 visible table은 `Performance Summary`, `Annual Returns`, `Worst Drawdowns`, `Return / Risk Attribution`을 같은 모델에서 렌더링한다.
- 드로다운은 단순 MDD 숫자가 아니라 Start, trough/end, recovery by, recovery months, underwater period를 보여줘야 실제 운용 리스크가 해석된다.

### BT-III. 회귀 방지 포인트
- factor ranking, ticker snapshot, 현재 손익률, 스크리너 점수는 portfolio backtest가 아니다. construction, holding path, rebalance, benchmark, assumptions가 있어야 백테스트로 부른다.
- AI 포트폴리오 컨텍스트는 마지막 성공 모델만 요약하고, 엔진 미실행/실패 상태를 추정으로 채우지 않는다.
- Runtime CI는 UI ID, 엔진 모델명, 월간/연간/드로다운/active risk 필드, deterministic test, AI context linkage를 동시에 확인해야 한다.

## 🧠 v51.09 브리핑 통합 3개 패러다임 (2026-06-22)
> **출처**: 2026-06-22 미국 장 전 브리핑 8포인트 + BROS Minervini VCP 차트

### PT-I. 이중 안전망 동시 해소 = 구조적 리스크온 [Q2 패러다임 전환]
- **기존 틀**: US-이란 긴장 vs BOJ 금리인상 = 투자자가 처리해야 할 2개의 독립 꼬리위험.
- **새 틀**: 두 위험이 같은 주에 동시 해소(이란 60일 로드맵 확정 + BOJ 비둘기) → 단순 합산이 아닌 "이중 안전망" = 글로벌 레버리지 해제 위험 구조적 제거.
- **인접 파급**: 엔캐리 청산 2024.08 시나리오 재현 확률 대폭 하락 → 신흥국 외환·한국 수급 안정에 간접 기여. WTI $75 이하 = 추가 인플레 완화 보너스.
- **핵심 논쟁**: BOJ 스탠스 재전환(2026 하반기 인상 재개) 시 즉각 역전 가능 → 정기 재확인 필수.

### PT-II. 메모리 리더십 = 사이클주 → 성장주 리레이팅 [Q2 패러다임 전환]
- **기존 틀**: SK하이닉스 = 메모리 사이클주 밸류에이션(PBR 1~2x 등락).
- **새 틀**: HBM AI메모리 리더십 프리미엄 → SK하이닉스 시총이 삼성전자를 역전. 메모리 = AI 인프라 핵심 부품 공급자 = 구조적 성장주 재분류.
- **인접 파급**: HBM 공급망(AMAT/LRCX 장비, 소재주)도 사이클주→성장주 재평가 대상. LRCX/AMAT를 사이클 밸류에이션으로만 보면 저평가.
- **핵심 논쟁**: HBM 공급 과잉(MU 후발 추격 성공) 시 프리미엄 수렴 역전.

### PT-III. 정치 헤드라인 ≠ 실제 리스크: ASML EUV 사례 [Q4 구조적 논리]
- **구조적 논리**: 루턱 상무장관의 EUV 비난 = 정치적 포지셔닝. 실제 규제(ASML EUV 미반출 공식 확인)와 분리해서 읽어야 함.
- **일반화 원칙**: 수출통제 헤드라인이 나올 때마다 ①실제 제품 반출 여부 ②기존 라이선스 변경 여부 ③기업 공식 확인을 3단계로 확인. 헤드라인 노이즈로 오버프라이싱된 리스크 = 역매수 기회.
- **핵심 논쟁**: 향후 ASML 신규 라이선스 차단 조치 시 실제 리스크로 전환 가능.

---

## 🧠 v51.13 브리핑 통합 3개 패러다임 (2026-06-23)
> **출처**: 2026-06-23 미국 증시 브리핑 (insidertracking) + Market Summary

### PT-IV. 섹터 리더십 이전 — 순환매 패러다임 [Q2 패러다임 전환]
- **기존 틀**: S&P 강세 = 메가캡 기술주(M7) 주도. 대형성장주 비중이 클수록 유리.
- **새 틀**: 은행주·소형주 ATH(러셀2000 3,000선 시도) + 대형기술주 상대 약세. GS 경기침체 확률 15%로 하향이 촉매. 경기민감·금융·소재로 자금 이동.
- **분기점**: JPM 분기말 $1,650억 매도 + HF 레버리지 5년래 최고 = 단기 조정 가능. 순환매가 지속 또는 일시 되돌림 여부가 핵심 변수.
- **인접 파급**: KBW 은행주 ETF·IWM(러셀2000)이 선행 지표. M7 상대 성과 하락 지속 시 인덱스 리밸런싱 수요도 촉매.
- **발견 버전**: v51.13 | 2026-06-23

### PT-V. AI 투자 계층 이동 — GPU 독점 → 인프라 계층 확산 [Q4 구조적 논리]
- **구조적 논리**: 1차 AI 투자 사이클(GPU·데이터센터)이 성숙 단계 진입 → 2차 인프라 계층(광통신·메모리·안전·물리AI) 수혜 가속.
- **실증 사례**: ①CRDO Evercore PT$325·Stifel PT$350(광통신 AI 연결) ②Micron+Anthropic AI 메모리 아키텍처 공동개발(메모리) ③NVIDIA HALOS(물리AI 안전) ④유럽 35개 AI 팩토리 90%+ NVDA 인프라(소버린AI 생태계).
- **인접 파급**: ALAB·MRVL(광통신 스위칭), COHR·LITE(광학 부품), MU·SK하이닉스(AI 메모리), VRT·EATON(DC 전력). GPU에서 2-3단 아래 공급망이 재평가 대상.
- **핵심 논쟁**: 하이퍼스케일러 Capex 삭감 시 2차 계층 동반 하락 가능.
- **발견 버전**: v51.13 | 2026-06-23

### PT-VI. 이란 리스크 재프라이싱 — 지정학 프리미엄 → 공급 과잉 우려 [Q3 핵심 논쟁]
- **기존 틀**: 중동 긴장 = 유가 상방 압력. 이란/호르무즈 위기 프리미엄 = $5-15/bbl.
- **새 틀**: 미 재무부 60일 일반면허 발급(이란산 원유 판매 허용) → 전쟁 프리미엄 대부분 제거. WTI $74.82(-2.32%). 시장이 "공급 부족 우려" → "공급 과잉 가능성"으로 관심 이동. SPR 1983년 이후 최저(추가 방출 여력 제한은 유가 하방 완충).
- **Bull**: 이란 협상 지속 + 유가 안정 = 인플레 완화 + 소비 여력 + 위험선호.
- **Bear**: 협상 불발(이란 핵 프로그램 신규 약속 없다 반박) + SPR 저점 + OPEC 생산 변수.
- **발견 버전**: v51.13 | 2026-06-23

---

## 🧠 v50.15 텔레그램 통합 4개 패러다임 (2026-06-08)
> **출처**: @insidertracking · @aetherjapanresearch · @bornlupin (2026-06-01~08 일주일치, 공개 t.me/s 프리뷰)

### PT-I. NVIDIA 한국 소버린 AI 인프라 동맹 — 메모리 넘어 "AI 팩토리 운영자"로
**통찰**: 젠슨 황 6/8 방한으로 한국 AI 밸류체인 전 계층 동맹 동시 발표 — SK하이닉스(차세대 메모리 다년 공동개발+Vera CPU 탑재), 삼성전자(HBM4/SOCAMM+HBM4E·파운드리·Groq 4-8nm), **네이버(1GW AI 팩토리: 55MW 2027 상반기→200MW 2027-28, $50-60B capex, 소버린 AI B2B 전환·5년 매출 20조 목표)**, SKT(DSX), 현대차(AV). 핵심은 네이버가 "자산경량 플랫폼→자본집약 AI 인프라 운영자"로 전환 = 비미국 소버린 AI 수요를 NVIDIA 스택으로 흡수.
**파급**: 한국 메모리 3사는 단순 부품공급사가 아닌 NVIDIA 로드맵 공동설계 파트너로 격상. 네이버는 구글 경쟁압을 NVIDIA 동맹으로 방어, 2030 매출 40-50조 전망. 소버린 AI = 신규 TAM 레이어(에너지→칩→인프라→모델→앱 5계층).
**관련**: PT-J(메모리 제약), SCREENER_DB 005930.KS/000660.KS/035420.KS/005380.KS
**발견 버전**: v50.15 | 2026-06-08

### PT-J. 메모리 = AI 인프라 확장의 1차 제약 (컴퓨트 아님) — CLSA/NH 리레이팅
**통찰**: CLSA "컴퓨트가 아니라 메모리가 AI 스케일링의 1차 제약" → 삼성 40만→54만/SK하이닉스 252만→370만/마이크론 $970→$1,320 목표 상향. 서버 DRAM +45%/+55%(26/27), DRAM 재고 역사적 저점 2-3주, HBM 블렌디드 ASP +30%. Meritz NVL72: SOCAMM2 192→96GB 축소에도 총 DRAM 주문 +10-20%(96GB 6배·Vera Rubin 우선) = 모듈 용량 축소가 곧 수요 감소가 아님.
**파급**: 메모리는 "사이클 산업"에서 "AI 인프라 구조적 병목"으로 재분류. ASP 상방이 공급사 마진 레버리지화. v49.99 PT-G(ASP 초급등) 연장선이나 이번엔 "용량 mix 변화 ≠ 수요 둔화" 오독 주의 프레임 추가.
**관련**: PT-G(ASP 사이클), PT-I, SCREENER_DB MU/SK하이닉스/삼성
**발견 버전**: v50.15 | 2026-06-08

### PT-K. "포지셔닝 청산 vs 구조적 전환" 진단 프레임 (6/5 셀오프)
**통찰**: 6/5 S&P -2.6%·나스닥 -4.2%·SOX -10% 급락은 5월 NFP 172K(예상 85K 상회)→2Y +12bp 4.17% 금리 쇼크가 트리거. JPM 진단: "AI 트레이드 + 이란 매크로 트레이드가 동시 청산된 **포지셔닝 언와인드**이지 구조적 금리 변곡 아님". 골드만은 2026 인하 전망 철회. 급락 시 "구조 훼손 vs 과열 포지션 정리"를 구분하는 게 핵심.
**파급**: 셀오프 대응은 (1)펀더멘털 훼손인지 (2)레버리지/포지션 청산인지 진단 후 분기 — 후자면 선별 매수(JPM: SPE/리더/중국AI/클라우드). 강한 고용=인하 후퇴=듀레이션·고밸류 성장주 단기 압박이나 AI capex 사이클 자체는 불변.
**관련**: AIO_SCENARIO_REGISTRY, NARRATIVE_ENGINE 레짐 분류
**발견 버전**: v50.15 | 2026-06-08

### PT-L. AI 에너지 수요 곡선 — 에이전트가 추론 전력을 50배로 (JPM)
**통찰**: DC 전력 485TWh(2025)→950TWh(2030) 2배. 동인은 단순 검색이 아니라 에이전트 워크플로/영상생성/상시 AI(추론수요 75-85%). 쿼리당 전력: 텍스트 0.24Wh→추론 1Wh→**에이전트 50Wh**. 2026-30 capex $3.9조 중 ~20%($780B) 에너지. 병목: 메모리·전력망 연계(4-5년)·가스터빈(2030+)·변압기.
**파급**: AI 효율 30-40%/년 개선에도 워크로드 복잡도 상승이 총수요를 끌어올림(efficiency paradox). 수혜 EMEA: Legrand/Schneider/Siemens Energy/Prysmian/ASML/Infineon. 전력=AI 다음 병목(실리콘 아님) 테제 강화 — KR power-grid 테마 직접 연결.
**관련**: KR_THEME_CATALYSTS power-grid, v48.87 PT(AIDC ESS)
**발견 버전**: v50.15 | 2026-06-08

### PT-M. ASIC 쓰나미 + 수요-공급 갭 = 구조적 메모리 부족 (Mizuho 프레임)
**통찰**: Mizuho — Google TPU 8-10배(2028), 출하 4.3M(26)→35M(28). 핵심 프레임은 **수요 증가율 >> 웨이퍼 투입 증가율**: DRAM 수요 +27%/+24%(26/27) vs 웨이퍼 +10%/+6%, NAND 수요 +18% vs 웨이퍼 -5%→+3%. 이 갭이 "사이클성 부족"이 아닌 **구조적 부족**을 만든다. AVGO TPU/인프라 TAM $600B+(28), HBM 시장 $246B(28). WSTS도 메모리 +250% $800B+(26) 동조. Musk "미국 대형 메모리 팹 부재(마이크론 아이다호 ~28·NY 29-30)=수요 못 따라감"이 공급측 제약 보강.
**파급**: 메모리 강세론의 정량 근거 = 수요·공급 증가율 격차. ASIC(AVGO)가 GPU 대비 생산성 우위로 TPU 물량 폭증 → HBM/DRAM 수요 이중화. 추천군 AVGO/MU/SNDK/STX/WDC. PT-J(메모리 1차 제약)의 정량 백본.
**관련**: PT-J, PT-I, SCREENER_DB AVGO/MU/SNDK
**발견 버전**: v50.15 | 2026-06-08

### PT-N. "노이즈 셀오프 vs 펀더멘털" 진단 — SOCAMM 오독 사례 + AVGO "beat but fell"
**통찰**: 6/4-5 반도체 급락(SOX -10%)의 트리거는 "NVIDIA가 SOCAMM2 용량 192→96GB 축소" 내러티브였으나, **SemiAnalysis 창업자 Dylan Patel이 직접 "TMT Breakout이 사적 메모를 오독했다"고 정정**. 실제(Meritz/한투/Daeshin): 96GB 모듈 6배 확대로 총 LPDDR 수요 +10-20%, 공급 180→290B Gb 불변, 설계/기판 불변 = 수요둔화 아닌 mix 변화. 동시에 **AVGO는 Q3 매출 $221.87B(+47.9%)·Q4 가이드 $294B로 컨센 상회했으나 "높아진 기대치 하회"로 -12.6% 하락**(Morgan Stanley는 오히려 TP $485→$502 상향, FY27 AI >$100B). 두 사례 모두 "펀더멘털 훼손 ≠ 주가 하락".
**파급**: 급락 진단 체크리스트 — (1)1차 소스 확인(오독·왜곡 여부) (2)펀더멘털 vs 기대치 괴리 (3)포지셔닝 청산(JPM: 콜옵션 정점·레버리지 70%ile)인지. 셋 다 "구조 훼손 아님"이면 노이즈 셀오프=선별 매수. PT-K(포지셔닝 청산)의 종목 단위 적용판.
**관련**: PT-K, 뉴스 surface 검증 정책(AIO_NEWS_SURFACE_CONTRACTS), SCREENER_DB AVGO/삼성/SK하이닉스
**발견 버전**: v50.15 | 2026-06-08

---

## 🧠 v49.99 5개 패러다임 전환 (2026-05-31 텔레그램 채널 통합)
> **출처**: @aetherjapanresearch · @insidertracking · @bornlupin (2026-05-24~31 일주일치)

### PT-G. 메모리 ASP 초급등 사이클 — 공급 제한이 아닌 구조적 수요 부족
**통찰**: Q2 DRAM ASP QoQ +50~60%, NAND ASP QoQ +75~100% (Susquehanna). SK하이닉스 고객 수요 충족률 50% — 이는 단순 공급 부족이 아닌 "HBM 팹 전용 전환으로 범용 DRAM 생산 의도적 축소" 결과. LTA 선지급(MS→삼성 $10B+)이 공급 희소성을 구조화.
**파급**: MU 목표가 $1,750 (Susquehanna, 기존 $600), SNDK $3,250 (기존 $2,000), DELL $700 (기존 $138). KB증권 SKH 목표가 380만원 (기존 300만원). 메모리 = 가격 결정권 전환 완료 신호.
**관련**: PT-B(메모리 LTA), PT-D(역SaaS), SCREENER_DB MU/SNDK/SKH/삼성
**발견 버전**: v49.99 | 2026-05-31

### PT-H. AI 서버 수요 = 메모리 희소 자원화 (Dell 실적 실증)
**통찰**: Dell FY1Q27 AI 서버 매출 $16.1B, 총매출 $43.8B (+88% YoY). CEO가 명시한 공급 제약 우선순위: ①NAND ②DRAM ③CPU ④HDD. GPU(NVDA)보다 메모리·스토리지가 오히려 더 강한 병목. "AI 가속기 수요 ≠ 메모리 수요"라는 분리 프레임 확인.
**파급**: AI 서버 사이클에서 NVDA·AMD보다 MU·SNDK·SKH가 상대적 희소성 우위. HDD(WDC·STX)도 4위 제약으로 재부각. CPU(INTC·AMD) 서버 수요 구조적 유지.
**관련**: PT-C(에이전틱 AI = CPU 필수재), PT-E(BootDrive), SCREENER_DB DELL/MU/WDC
**발견 버전**: v49.99 | 2026-05-31

### PT-I. 메모리 TAM 재산정 — 에이전틱 AI가 구조적 수요 트리거
**통찰**: TrendForce 2026E 메모리 TAM $889.3B (기존 추정 $551.6B에서 상향). 2027E $1.28T+. JP모건 독자 추산 2028E $1.7T. 에이전틱 AI 오케스트레이션이 "대기 상태 메모리" 수요를 폭발적으로 증가시키는 구조. 키옥시아 UBS 매수 개시, 목표 79,000엔 — "NAND 가격 6분기 상승 후 2027Q3 정점" 전망.
**파급**: 메모리 사이클 정점이 2027Q3로 밀림 → 현재는 초입 국면. 에이전트 AI 도입 가속 = 중국 점유율(DRAM 6→8~11%, NAND 12→16%) 확대에도 TAM 자체가 커져 공존 가능.
**관련**: PT-A(추론 칩), PT-C(에이전틱 AI), SCREENER_DB Kioxia/MU/SNDK
**발견 버전**: v49.99 | 2026-05-31

### PT-J. NVDA 베라 루빈 2H26 출하 + Windows PC 진출 — 수요 사이클 연장
**통찰**: 폭스콘 CEO 베라 루빈 2H26 출하 낙관. Computex GTC 타이페이에서 젠슨 황 기조연설 + Windows PC 진출 공식 발표 예정(MS 서피스·DELL 협력). 콴타 "AI 시장 계단식 성장, 2030년까지". 젠슨 황 2026년 매출 성장률 ~100%, 2027년도 동등 규모 전망. MLCC 가격 급등 — 전자부품 가격 인상 도미노 시작.
**파급**: 린스에쿼티 단기 $250 근접 전망. Computex 촉매로 PC OEM(DELL·HPQ)·부품(MLCC 공급사)·패키징(폭스콘·콴타) 동반 상승 가능. Vera Rubin = Blackwell 교체 사이클 → CoWoS·HBM3E 수요 2차 급증.
**관련**: PT-F(CapEx 1조), SCREENER_DB NVDA/DELL/폭스콘
**발견 버전**: v49.99 | 2026-05-31

### PT-K. 중동 지정학 리스크 재부상 — 호르무즈 + 에너지 공급 위협 복합
**통찰**: Trump-Iran MOU 불승인(NYT) + 이란 미사일 보트 "27 Rajab" 공개(700km 크루즈 미사일) + 오만 해안 이란 기뢰 300kg 발견 + 이스라엘-레바논 공습. EU가 러시아 원유 가격 상한 일시 동결 검토. 이란-미국 합의 서명 임박과 모순적으로 공존하는 군사 활동 = 협상 레버리지 극대화 전술.
**파급**: 호르무즈 봉쇄 리스크 = WTI 즉각 급등 트리거. 에너지 인프라(XOM·CVX·MRO) + 방산(LMT·RTX·NOC) 헤지 포지션. EU 러시아 제재 완화 검토 = 유럽 가스 가격 안정화 변수. 테헤란 증시 은행주 강세 = 합의 가능성 내재 신호.
**관련**: MACRO_KW '호르무즈', '이란 핵합의', SCREENER_DB XOM/CVX/LMT
**발견 버전**: v49.99 | 2026-05-31

---

## 🧠 v48.71 3개 패러다임 전환 (2026-05-02 /integrate)

### PT-D. 스토리지/메모리 "역SaaS" 재분류 (Melius/DA Davidson 수렴)
**통찰**: SaaS가 구독 모델로 PE 배수 10→25배 달성 → 메모리/스토리지 SCA(구독형 공급계약) 구조 도입 시 동일한 밸류에이션 방법론 적용 가능. "역SaaS"는 하드웨어가 소프트웨어 밸류에이션 방법론을 역으로 적용하는 현상.
**파급**: SNDK RPO $42B+ = 잠금 수익. WDC/STX HAMR = 마진 성장주 수준. DA Davidson MU FY30 $393B 경로 = 5년 SCA 복리 성장. G1-G4 계층별 가격 차별화 = 수익성 제고.
**관련**: PT-B(메모리 LTA), §74, §80, §83, SCREENER_DB MU/SNDK/WDC/STX
**발견 버전**: v48.71

### PT-E. BootDrive — AI 서버 OS 드라이브가 독립 성장 카테고리로 분리 (JPM/SIMO)
**통찰**: AI DC 서버에서 NVMe OS 드라이브(BootDrive)가 eSSD와 별개의 독립 성장 슬롯으로 분리. NVIDIA BlueField-4 NIC에 내장 의무화 → 서버당 신규 소켓 + ASP 2배+. SIMO = 팹리스 구조로 운영 레버리지 극대화.
**파급**: SIMO $30M → 2026E $160M/2027E $375M. DC SSD 비중 12%→19% 구조 전환 확인. "HDD vs SSD 제로섬" 프레임 폐기 — NL HDD(+16%YoY)와 eSSD(+134%YoY) 공존.
**관련**: §79, SCREENER_DB SIMO, TECH_KW 'BootDrive', 'BlueField-4'
**발견 버전**: v48.71

### PT-F. CapEx 1조 = 메모리 가격 인상이 CapEx 상향을 유발하는 역학 (BofA/MSFT)
**통찰**: CY27 $1조 CapEx의 일부는 순수 AI 수요 증가가 아닌 "메모리/스토리지 가격 상승에 따른 동일 용량 구매 비용 증가". MSFT $250억 명시. 메모리 회사 실적 상향 → CapEx 수치 상향 → 메모리 회사 재확인의 순환.
**파급**: CapEx 1조 수혜: (1)메모리(MU/SNDK) (2)전력인프라(GEV/VRT) (3)네트워킹(ANET) (4)네오클라우드(CRWV). META OW→N 하향 = "CapEx 정점 기업"과 "CapEx 수혜 기업" 분리 판단 필요 신호.
**관련**: §81, §82, SCREENER_DB META/AMZN/MSFT/GOOGL/CRWV
**발견 버전**: v48.71

---

## 🧠 v48.67 3개 패러다임 전환 (2026-04-26 /integrate)

### PT-A. 추론 칩 ≠ 학습 칩 파생
**통찰**: TPU 8i(추론) HBM 288GB > TPU 8t(학습) 216GB → 추론 워크로드가 독자 최적화 곡선 보유.
기존 "추론=학습 GPU 비용 최적화 버전" 프레임 폐기.
**파급**: HBM 수요 = "학습 수요" 단일구조 → "학습+추론 ASIC" 이중구조. NVDA 이외 HBM 수요처 다각화.
AVGO가 TPU 8t+8i 모두 파트너 → 추론 아키텍처 복잡성 증가할수록 AVGO 구조적 수혜.

### PT-B. 메모리 LTA = 사이클주 → 성장주 재분류
**통찰**: 3~5년 LTA(물량+가격+선불) = 수익 가시성 구조화 → 성장주 배수 적용 논쟁 점화.
역학: HBM 팹 용량 3~4x 소진으로 공급 희소성 확정 → 고객이 먼저 LTA 요청.
MU 선두 발표 → SKH·삼성 2Q26 발표 예상. LTA = 하락 사이클 하한선 형성 효과.

### PT-C. 에이전틱 AI = CPU 필수재
**통찰**: AI 컴퓨팅 = GPU 독점이라는 컨센서스와 달리, 에이전틱 AI 오케스트레이션·제어·추론 관리에서 CPU 필수.
GPU:CPU 비율 1:8 → 1:4 → 대등 방향(INTC 경영진 가이던스). 서버 DRAM(SOCAMM2) TAM 확대.
INTC DCAI 2026E +22% YoY, 서버 두 자릿수 성장 2027 지속 전망.

---

## 🧠 v48.61 5개 패러다임 전환 (2026-04-21 통합)

### 1. Apple 리더십 패러다임: 영업→하드웨어 회귀
**통찰**: Tim Cook(2011~) = 공급망/영업 중심. John Ternus(2026-09-01~) = 하드웨어/R&D 중심.
- Cook 재임 기간: 시총 $3000억 → $4조(13배), 서비스 매출 폭증, 규모 경제 극한 활용.
- Ternus 선택 배경: **"스마트폰 이후"(AI 글래스/로봇/XR) 폼팩터 경쟁 임박** → 하드웨어 CEO로 회귀는 **제품 혁신 가속 신호**.
- Cook은 Executive Chairman 잔류(정책/관세 관계). Johny Srouji(A4 설계자) Chief Hardware Officer = Apple Silicon 독립성 보강.
- **투자 시사**: AAPL 하드웨어 Capex 사이클 재가속 + AI 매개체(Siri 개인화 WWDC) 전략 전환. 현재 PE 조정에도 장기 재평가 가능성.

### 2. LLM 무기화 = 사이버 예산 패러다임 전환
**통찰**: Mythos(Anthropic)는 모델 무기화의 임계점. **"취약점 발견/악용 → 인간 개입 없이 자동화"**.
- Opus 4.7(의도적 축소) vs Mythos(제한 Project Glasswing 배포): Anthropic의 위험 관리 전략 = 제한적 엘리트 배포.
- OpenAI 대조: GPT-5.4-Cyber + TAC 14파트너 = "대중의 지혜" 접근.
- **구조 변화**: 탐지 중심 → **런타임 통제 중심**. CTEM(Continuous Threat Exposure Management) 지출 확대.
- **수혜 구조**: (a) 복수 인라인 제어포인트(CRWD/PANW/Cisco) (b) DDoS/WAF/API 보안(AKAM/NET) (c) 정부 표준화 경로(CAISI/AISI) = 예산 촉매 3중.
- **역설**: Mythos $25/$125 가격이 방어자도 제한 → 컴퓨팅 비용이 사이버 격차 심화.

### 3. 컴퓨팅 제약은 실리콘이 아닌 전력이다
**통찰**: AI 서밋 125개사 공통 메시지 = 2028년까지 용량 부족 지속. **병목은 GPU가 아닌 MW**.
- Lightning AI: 단일 기업 백만 에이전트 배포 시 추론 100배+, 컴퓨팅 1000배+.
- CoreWeave: 850MW → 3GW 계약 확보 필수.
- LTA 레버리지 역전: 과거 "LTA=정점" → 현재 "고객 선제안=공급사 레버리지"(AVGO 고객에 "연중반 HBM+CoWoS 주문 없으면 매진" 통지).
- **인접 수혜**: (a) 온사이트 발전(GEV/BE/CEG) (b) DC REIT(EQIX/DLR) (c) XPU 플랫폼(AVGO Broadcom 180억→500억→1000억 경로) (d) 피지컬 AI(로봇/자율차).

### 4. AV = 기존시장 잠식이 아닌 총량 확대
**통찰**: Goldman 보고서 핵심 프레임 — **로보택시는 UBER를 대체하지 않고 UBER 총예약을 키움**.
- 웨이모가 UBER 앱에 배치된 시장 = 차량당 일일 운행(TpVD) +30%.
- 2030년 AV 차량 62,750대로 UCAN 연 65억 건 수요 충족 불가 → 하이브리드 네트워크 필수.
- **수혜 구조**: (a) GOOGL(Waymo 2035 $200억+), (b) UBER/LYFT(2030 AV 라이드셰어 30%+ 중개), (c) AMZN(Zoox), (d) 부품(TEL/Hesai/APTV), (e) 중국 EV(XPEV).
- **중립/피해**: TSLA(FSD v14 중요 개입 2천마일 vs 웨이모 10만), AUR/RIVN/MBLY(실행 리스크), 전통 OEM(Ford/Daimler/Traton 밸류체인 위협).
- **극단 시나리오**: 모든 주행 공유 AV로 전환 시 SAAR 300-600만대 감소(자동차 판매).

### 5. 광통신 변곡점 = 구리 거리 한계 2028말~2029초
**통찰**: Lumentum CEO Michael Hurlston(Citi AI서밋) = **"3.2T 노드에서 구리 유효거리 1.5-2m로 급락 → 광학이 주 백플레인"**.
- 기존: 구리 인터커넥트 > 광학(비용 우위).
- 2028말: 대역폭 요구가 구리 물리 한계 초과 → **광학 유일 대안**.
- **공급 부족 2028-2029 지속**: InP(인듐 인화물) 공급이 수요 미따름 → Lumentum 7년 Sumitomo 약정.
- **산업 역사적 사건**: 광학 업계 사상 처음 공급자 가격 인상 + 원가 전가 구조.
- **수혜 구조**: (a) 광모듈(Innolight/Eoptolink/TFC) 1.6T→3.2T 업그레이드 사이클, (b) EML/CW 레이저(LITE InP), (c) CPO 장비(RoboTechnik), (d) OCS(광회로 스위치), (e) PCB 미드플레인(Victory Giant/WUS/EMC/Shengyi), (f) HCF(중공 광섬유) 적용 확대.
- **Broadcom 역설**: PA 레이저 용량 4배 확장 해도 판도 영향 미미 = LITE 경쟁 위치 확고.

---

---

## API 동작

### Yahoo Finance API
- `meta` 객체에 `regularMarketChangePercent` 필드 **없음** -- `regularMarketPrice`와 `chartPreviousClose`에서 수동 계산 필요: `(price - prevClose) / prevClose * 100`
- `meta.regularMarketTime`은 Unix timestamp (초 단위). 장 마감 후에도 마지막 거래 시각 유지.
- pre/post market 데이터: `meta.preMarketPrice`/`meta.postMarketPrice` -- 장외 시간에만 존재, 정규 장 중에는 undefined.
- 쿼리 `range=1d&interval=5m` 시 미국 장 시간 기준 데이터 반환. 비미국 시장(KS, KQ)은 range=1d로도 전일 데이터가 올 수 있음.
- 한 번에 5개 이상 심볼 요청 시 일부 심볼 누락 가능 -- 배치 크기 조절 필요.
- ADR(20-F 기업)의 `financialData`에 IFRS 항목명이 올 수 있음 -- `us-gaap` 없으면 `ifrs-full` 폴백 필수 (R23).

### CoinGecko API
- 무료 티어 rate limit: 10-30 req/min. 초과 시 429 응답.
- `price_change_percentage_24h`가 null인 신규 상장 코인 존재 -- `|| 0` 패턴 사용 금지 (R15).

### SEC EDGAR (XBRL)
- CORS 차단됨 -- 직접 fetch 불가, Cloudflare Worker 프록시 필수.
- `companyfacts.json` 크기가 수 MB -- 무거운 종목(AAPL 등)은 파싱 지연 발생.
- 10-K(미국 기업) vs 20-F(외국 발행인) vs 20-F/A(수정본) -- formType 필터 시 셋 다 포함 필수 (R23).

### rss2json
- 무료 티어: 10,000 req/day, 단일 피드 10건 제한.
- 일부 RSS 피드의 `content` 필드에 HTML 태그 포함 -- `escHtml()` 또는 `textContent` 추출 필수.

---

## 브라우저 / DOM / CSS

### SPA 페이지 전환 패턴
- `showPage()` 호출 시 반드시 `destroyPageCharts()` 먼저 -- Chart.js 캔버스 해제 안 하면 메모리 누수.
- init 가드 변수(`_xxxInitDone`)는 destroy 시 반드시 `false`로 리셋 -- 안 하면 재진입 시 Dead Page (R9).
- `popstate` 핸들러는 `showPage()`와 **동일한 초기화 경로**를 타야 함 -- `aio:pageShown` 이벤트 발송 누락 시 12개 페이지 빈 화면.

### setInterval 관리
- 페이지에 `setInterval` 등록 시 반드시 `destroyPageCharts`에 대응 `clearInterval` 추가.
- `window._refreshSignalInterval` 같은 전역 타이머도 페이지 이탈 시 해제 필수.
- 타이머 ID는 변수에 저장, destroy 시 null 리셋.

### CSS 유의사항
- `* { scrollbar-width: thin }` -- 37,000+ 요소에 적용, `html` 셀렉터로 축소.
- `overflow: hidden` on parent -- 자식 콘텐츠 잘림 주의. 3중 방어: `overflow-x:hidden; overflow-y:auto; word-break:break-word` (R5).
- flex column에서 `overflow:auto` 사용 시 반드시 `min-height: 0` 추가 -- 없으면 전체 페이지 스크롤 불가.
- 인라인 `font-size: 11px` 미만 금지 -- CSS override가 자동 보정하지만 의도와 다른 크기 표시.
- 한국어 텍스트는 라틴 기준 grid 컬럼에서 오버플로우 -- `word-break: keep-all` + 최소 너비 확보 (R7).

### innerHTML 보안
- 사용자/외부 데이터를 `innerHTML`에 삽입 시 반드시 `escHtml()` 래핑 -- XSS 벡터.
- `textContent`는 안전하지만 HTML 구조가 필요하면 `escHtml()` + `innerHTML` 조합.
- `el.children.length > 0`이면 `textContent` 직접 설정 금지 -- 자식 DOM 파괴됨 (P24).

---

## Chart.js 패턴

### 데이터 방어
- `chartDataGate()` 통과 후에만 차트 생성 -- NaN, null, undefined, Infinity 방어.
- `_sanitizeChartData()` -- 배열 데이터 정제, NaN을 null로 변환 (Chart.js는 null을 gap으로 표시).
- `spanGaps: true` 설정 시 null 구간도 선으로 연결 -- 의도치 않으면 false 유지.

### 인스턴스 관리
- `destroyPageCharts(pageId)`로 페이지별 차트 인스턴스 정리 -- `chart.destroy()` 호출 후 변수 null 리셋.
- 캔버스 ID가 실제 해당 페이지 DOM과 일치하는지 확인 -- 불일치 시 다른 페이지 캔버스에 그림.
- CDN 로딩 지연 시 Chart.js 미로드 상태에서 차트 생성 시도 -- 텍스트 폴백 필수 (R8).

---

## JS 패턴

### 데이터 수집
- `_pct || 0` 패턴 **절대 금지** -- null(미수신)과 0%(보합)을 구분 불가 (R15).
- 올바른 패턴: `_pct != null ? _pct : null` (미수신 시 null 유지) 또는 `_pct != null ? _pct : 0` (폴백 명시).
- `_ldSafe(ticker, field)` -- `_liveData` 안전 접근 + `_SNAP_FALLBACK` 자동 폴백. raw `ld['XXX']` 직접 접근 금지.

### 키워드 필터링
- TECH_KW/MACRO_KW에 3글자 미만 단독 키워드 금지 (R17) -- `'S'`, `'QE'` 같은 단일/이중 문자가 모든 텍스트에서 오탐.
- 영어 일반 단어와 겹치는 티커(ARM, CAN, CASH 등)는 `_TICKER_WORD_OVERLAP`에 등록.
- `extractTickers()` 내 RegExp는 함수 밖에서 캐시 -- 반복문 내부 `new RegExp()` 금지 (P36).

### 에러 처리
- `const` 변수는 반드시 첫 사용 전에 선언 -- TDZ(Temporal Dead Zone) ReferenceError 방지.
- `fetch` 타임아웃: `{timeout: N}` 옵션은 **비표준** -- 반드시 `AbortController` 또는 `withTimeout()` 사용.
- `native confirm()` / `alert()` 사용 금지 -- `showConfirmModal()` 사용 (비동기 + 커스텀 UI).

---

## 데이터 정합성

### 하드코딩 vs 동적 데이터
- 하드코딩 차트 데이터(VIX/NAAIM/AAII/브레드쓰)는 `DATA_SNAPSHOT._updated`와 함께 관리.
- 3일+ 경과 시 `renderStaleWarning()` 경고 배지 자동 표시 (R21).
- 동적 전환 가능한 데이터(VIX/HYG/SPY/QQQ)는 Yahoo Finance API로 자동 교체, 하드코딩은 폴백.
- 동일 데이터가 여러 곳(home sidebar vs 전용 페이지)에 표시 시 **단일 원천** 원칙 -- grep으로 모든 표시 지점 확인.

### NARRATIVE_ENGINE 패턴 (v47.6 신설)
- **문제**: DATA_SNAPSHOT 숫자만 갱신하면 분석 서술 텍스트(§71·§72 채팅 AI 프롬프트, DOM rm-* 꼬리위험 보드)가 자동 반영되지 않음 — 정적 문자열이기 때문. v47.4 P61 반복 위반의 근본 원인.
- **해결 패턴**: `NARRATIVE_ENGINE` 헬퍼 모듈을 `_snap` 아래 삽입. 3개 계층으로 구성:
  1. **레짐 분류기** (`getXxxRegime(v)`): 값 → `{level, label, color, bar%}` 객체 반환. 텍스트·DOM 색상·바 폭 모두 같은 레짐에서 파생.
  2. **동적 텍스트 생성기** (`getXxxText()`): DATA_SNAPSHOT 필드 + 레짐 분류기 조합으로 완성된 문단 생성. 템플릿 리터럴 + `_snap.fixed()` 포맷터.
  3. **DOM 렌더러** (`renderXxx()`): 분류기 결과를 DOM에 바인딩. DOMContentLoaded 훅에서 자동 실행.
- **효과**: DATA_SNAPSHOT.skew 141.86 → 150으로 바꾸면 SKEW 레짐이 자동으로 "꼬리위험 고점" → "극단 꼬리헤지 비쌈"으로 바뀌고, §72 트레이딩 규칙 문단의 모든 관련 수치·판정·모니터링 트리거가 동시에 갱신됨. P61 근본 해결.
- **CHAT_CONTEXTS 통합 포인트**: `NARRATIVE_ENGINE.getDistributionDiagnosisText(DATE_ENGINE.today())` — 14줄 정적 문자열이 2줄 함수 호출로 축약.
- **적용 범위**: 현재 F&G 내부 구조 + 분배 진단 + rm-* 보드. 확장 가능: CP3 매크로 카드, MACRO_KW 키워드 자동 생성, Wall Street IB 인용.
- **주의**: NARRATIVE_ENGINE은 DATA_SNAPSHOT 정의 이후 실행되어야 함. IIFE + `try { NARRATIVE_ENGINE.init() } catch(e)` 이중 안전장치로 순서 의존성 완화.

### KR_STOCK_DB 품질
- 비상장 종목 혼입 금지 -- 종목 추가 시 KOSPI(.KS)/KOSDAQ(.KQ) 상장 여부 확인 필수.
- `themes: []` 고아 엔트리 금지 -- 최소 1개 테마 배정.
- SUB_THEMES에 새 종목 추가 시 반드시 KNOWN_TICKERS에도 포함 (P37).

---

## 뉴스 파이프라인

### 선별 계층
- **홈 핵심**: 정적 큐레이션 (`HOME_WEEKLY_NEWS`), 2-3건 (R22).
- **브리핑**: score 45+, 5-20건, score 우선 선별 후 시간순 재정렬.
- **시장 뉴스**: score 30+, 150건 상한, 48h, 시간순.
- `scoreItem()`에 5대 토픽 부스트 + 비시장 정치 감점(-25) 필수.

### 텔레그램 소스
- rsshub 403 차단 채널: `_TG_DIRECT_ONLY`에 등록, CF Worker 직접 스크래핑.
- 공개 미리보기 비활성 채널: `_TG_UNAVAILABLE`에 등록, 즉시 스킵.
- `isFetching` 안전장치: 80개 소스 기준 180초 (60초는 부족).
- 광범위 키워드(`market`, `space`)만 1개 매칭 시 불통과 -- `_TG_BROAD_KW` 체크.

---

## 스킬 최적화 패턴 (Autoresearch)

### Karpathy Autoresearch 방법론
- 출처: Andrej Karpathy의 자율 실험 루프 → Claude Code 스킬 적용 버전
- 핵심: 스킬을 반복 실행 + 바이너리 yes/no eval + 변수 1개씩 변경 + 점수 하락 시 롤백
- 스킬 설치 위치: `.claude/skills/autoresearch/SKILL.md`
- 발견 버전: v43.5

### 바이너리 Eval 원칙 (eval-guide.md 핵심 요약)
- **척도 금지**: "1~7점" 대신 yes/no만. 척도는 가변성을 증폭시켜 신뢰 불가.
- **3~6개 최적**: 6개 초과 시 스킬이 eval만 앵무새처럼 반복하기 시작 (게임 현상).
- **측정 가능성**: "유용한가?" 금지. "수치 ≥3개 포함인가?" 처럼 관찰 가능한 신호로 변환.
- **독립성**: eval 간 중복 금지. 각 eval은 다른 차원을 측정.
- **게임 내성**: 스킬이 내용 개선 없이 eval만 통과할 수 없어야 함.

### AIO 스킬 자기평가 적용 현황
| 스킬 | Eval 추가 여부 | 주요 체크 항목 |
|------|---------------|---------------|
| `/integrate` | **완료** (v43.5) | TECH_KW ≥3, SCREENER_DB ≥1, CHAT_CONTEXTS, CHANGELOG, R17 |
| `/data-refresh` | 후보 (autoresearch SKILL.md에 eval 정의됨) | 22카테고리 스캔, CRITICAL 0 미처리, 배열 길이, 버전 범프 |
| `/qa` | 후보 (autoresearch SKILL.md에 eval 정의됨) | div 균형, 버전 6곳, Dead Page 없음, 스코어링 |

### 단일 변수 변경 원칙
- 좋은 변경: 가장 빈번한 실패를 다루는 지시사항 하나 추가/수정/이동/예시 추가
- 나쁜 변경: 동시에 여러 규칙 추가, 스킬 전체 재작성, "더 잘해" 같은 모호한 지시
- 점수 동일도 폐기: 복잡성만 추가하고 이득 없음

### /integrate 자기평가 5단계 (v43.5 적용)
통합 완료 전 5개 yes/no 체크 강제:
1. TECH_KW/MACRO_KW 신규 키워드 ≥3개
2. 원문 핵심 티커 SCREENER_DB 갱신 ≥1개
3. CHAT_CONTEXTS 해당 섹션 업데이트
4. CHANGELOG.md 항목 추가
5. 모든 신규 키워드 ≥3글자 (R17)

---

## 매크로 프레임워크 인사이트

### FOMC "수량 표현" 해석 계층 (2026.04 의사록 기준)
- "Vast majority" > "Most" > "Many" > "Several" > "Some" > "A few" > "A couple of"
- "Vast majority"가 고용 하방 + 인플레 상방 동시 경고 = 듀얼 리스크 인식 (일방향 해석 금지)
- "Some"이 양방향 금리 시그널(인상 포함) 언급 = 시장의 인하 일변도 기대와 괴리
- 발견 버전: v46.3

### 재무부-연준 힘겨루기 메커니즘 (2023년 증거)
- 연준 긴축(5% + QT $950억/월)에도 옐런 TGA 방출 + T-bill 발행으로 역레포→시장 유동성 이전 → S&P +24%
- TGA 변동 ≠ 시장 유동성 변동 (T-bill→MMF→역레포 인출 경로로 은행 준비금 거의 미감소)
- 정치적 인센티브(선거 전) = 재무부 유동성 공급 의지의 충분조건
- 2026년 베센트(소로스 출신) = 발행 전략 조절 도구 보유, BUT 2023식 강제 TGA 방출 메커니즘(부채한도)은 없음
- 관련 규칙: 매크로 분석 시 연준 단독 해석 금지, 재무부 발행 전략 동시 고려
- 발견 버전: v46.3

### CSS overflow-x:hidden의 overflow-y 자동 변환 (P74)
- CSS 명세: `overflow-x: hidden`만 설정 → 브라우저가 `overflow-y`를 자동으로 `auto`로 변환
- 결과: 의도하지 않게 스크롤 컨테이너가 됨 → 부모의 스크롤과 충돌
- `.content(overflow-y:auto)` > `.page(overflow-x:hidden → overflow-y:auto 자동)` = 이중 스크롤 충돌
- 해결: `.page`에서 overflow-x:hidden 제거 (`.content`가 이미 처리)
- 발견 버전: v46.4

### 폴백값 구조화 원칙 (P72)
- 폴백값은 각 함수에 하드코딩 금지 → `DATA_SNAPSHOT._fallback` 단일 진실 원천
- /data-refresh 시 DATA_SNAPSHOT과 _fallback 동시 갱신 → 자동 동기화
- 발견: 3월 전쟁 피크 폴백값(F&G=18, breadth=27.1)이 4월 휴전 후에도 잔존 → 극단 공포 표시
- 발견 버전: v46.4

### 데이터 검증 3단계 원칙
- L1 입력: PriceStore.set() (symbol 유효성 + 가격 범위 + 급변 감지)
- L2 가공: _clamp(v, lo, hi) (VIX 5~150, DXY 80~130 등 합리 범위)
- L3 출력: escHtml() (XSS 방어) + isFinite() (NaN 노출 방지)
- FMP 전용: _validateFMPData() 7개 검증 (ticker 매칭, 가격 괴리, PE 범위, 이익의 질, 희석)
- 발견 버전: v46.4

---

## 인사이트 추가 규칙

### AI 인프라 패러다임 전환 (Cantor 2026.04)
- 기존 틀: AI DC = "서버가 들어간 부동산", 병목 = GPU 공급
- 새 틀: AI DC = "부동산이 딸린 전력 인프라 프로젝트", 병목 = "GPU를 꽂을 전력이 있는 부지" (time-to-power > time-to-build)
- NVDA 5년 39GW 추산 vs 미국 DC 21GW = 20GW 갭 → 네오클라우드(CRWV/CORZ/WULF/IREN) 구조적 기회
- 하이퍼스케일러가 내재화 못하는 이유: 자본이 아닌 전력조달+자본배분 경직성+리스크 이전 필요
- 크레딧 래퍼 구조: GOOGL 백스톱 → SOFR+600bp→250bp (WULF→CIFR→HUT 순차 확산)
- 관련: themes L0/L1.5 밸류체인, SCREENER_DB CRWV/CORZ/IREN
- 발견 버전: v46.5

### 소프트웨어 $100B AI Shock (Citi 2026.04)
- 기존 틀: AI 예산 = 기존 SW 예산에 추가 (additive)
- 새 틀: AI 비상장 기업 매출 $1,000억+가 전통 앱 SW 신규 ACV $500-600억 압도 → 역전 발생 (2026년 중)
- 에이전틱 AI → 좁은 워크플로우 앱 우회 → 좌석 기반 앱 구조적 위험
- 방어적: 시스템 오브 레코드, 데이터 플랫폼, 미션 크리티컬 인프라 (데이터 중력+컴플라이언스)
- 취약: 좌석 기반 앱(차별화 제한 시), 수직형 SW(의외의 위험 — 프리미엄 밸류에이션+AI 수직화 모델 출시)
- 상대적 안전: SMB 지향 SW (SHOP/KVYO/HUBS — AI 생산성 향상이 신규 사업 형성 촉진)
- 관련: themes L3 밸류체인, Citi 톱픽 MDB/MSFT/SNOW/PLTR/SHOP
- 발견 버전: v46.5

### 군사적 승리 ≠ 전략적 승리 — 호르무즈 역학 (돈스/JPM Kavanagh 2026.04)
- 기존 틀: 군사 우위 = 협상 레버리지. 전쟁 승리 → 조건부 항복.
- 새 틀: 이란 해군/공군 파괴됐으나 IRGC가 호르무즈 통제 유지 = 생존 자체가 승리. 기뢰는 군대가 패배해도 바다에 남음.
- 물리적 현실: 14M bbl/d 공급 갭, 해협 11% 가동, 기뢰 제거 수개월, 미국 도착 42일. 헤드라인(시작됨)과 규모(얼마나 부족한지)의 괴리.
- 시간 = 이란 편: 이란이 협상 안 하는 건 미국이 더 절박해지길 기다리는 전술 (중간선거 7개월, 디젤 $8).
- 투자 함의: 유가 정상화 기대 시 "물리적 타임라인(분기 단위)" vs "헤드라인 타임라인(일 단위)" 구분 필수.
- 관련: macro §70, CP1/CP6, 유가 에스컬레이션 래더
- 발견 버전: v46.6

### 실질금리 마이너스 전환 리스크 — 2차 파급효과 (돈스/부산아재 2026.04)
- 기존 틀: 전쟁 종료 → 유가 안정 → 인플레 하락 → 금리 인하.
- 새 틀: 근원물가 3M 연율 4.4%(전쟁 전부터 가속). 전쟁은 불에 기름을 부은 것이지 불을 지른 게 아님. Warsh 5월 취임 시 인상 회피 → 실질금리 마이너스 → 1974-78 재현 리스크.
- 전이 경로: 에너지→연료비→항공료(서비스 물가) + WGT 상승 + 미시간대 장기 기대인플레 3.2→3.4% = 2차 파급 초기 신호.
- Inverse-L 필립스 함의: V/U<1(실업 민감) 구간에서도 기대인플레 반응함수는 여전히 작동 — 노동시장 약세가 기대인플레 방어를 보장하지 않음.
- 미국 순원유수입국(220만bbl/d), 셰일 반응 4-6개월, 퍼블릭 비중 75% = 자본규율 우선.
- 관련: macro §70, Fed 정책 경로, 금리 에스컬레이션 래더
- 발견 버전: v46.6

---

새 인사이트 추가 시 아래 형식 준수:
```
### {주제}
- {핵심 동작/제약/주의사항}
- 관련 규칙: R{N} / P{N} (있으면)
- 발견 버전: v{X.Y}
```

### NAND SCA 패러다임 — 사이클주→구조적 AI수혜주 전환 (Citi+Evercore 수렴, 2026.04)
- 기존 틀: NAND = 사이클주. 가격 정점→하락→마진 압축→재고소진→반등 반복.
- 새 틀: SCA(전략적 계약합의) = 가격 하한선 + 선급현금 보장. AI 수요 + 공급 절제 = 2028년까지 공급 제약 지속. 사이클 변동성 구조적 완화.
- TurboQuant 역설: 시장 "압축기술=메모리 수요↓" vs 경영진 "효율↑→AI 채택 가속→추론↑→스토리지 총수요↑" = DeepSeek 역설의 스토리지 버전.
- HDD도 멀티플 재평가 18x→21x: HAMR 44TB→140TB 로드맵 + 장기 GM50%+.
- 투자 함의: 메모리/스토리지 섹터를 사이클주 밸류에이션이 아닌 구조적 성장주로 재분류 필요. SNDK/MU/WDC/STX 공통.
- 관련: themes L1 밸류체인, fundamental §74
- 발견 버전: v46.8

반복 발견 3회 이상이면 RULES.md 규칙 승격 대상으로 `/knowledge-lint`에서 자동 플래그.

### PPI 수요파괴 3중 확인 — 마진 붕괴가 전달하는 신호 (2026.04 3월 PPI)
- 기존 틀: PPI 하락 = 인플레 완화 긍정. 헤드라인 MoM -0.4% = 호재.
- 새 틀: 헤드라인 하락의 원인이 수요파괴. 3중 확인: ① 무역 마진 MoM -1.4%(기업이 관세분 자체 흡수=마진 붕괴), ② 중간재 수요 MoM -0.4%(생산 투입 위축), ③ 원자재 MoM -1.9%(최종 수요 감소 역류).
- 투자 함의: PPI→PCE 전달 경로 분석 시 "수요파괴형 하락"과 "공급 개선형 하락"을 구분해야 함. 전자는 마진 압축→실적 하향→주가 하방, 후자는 비용 절감→마진 확대→주가 상방. 같은 PPI -0.4%도 원인에 따라 정반대 투자 결론.
- 관련: macro §71, MACRO_KW(margin compression, trade margin squeeze)
- 발견 버전: v47.1

### Michigan 기대인플레 탈앵커링 — 모델 무효화 리스크 (2026.04)
- 기존 틀: Michigan 서베이 = 소비자 심리 참고지표. 1Y 기대인플레가 높아도 5-10Y가 앵커되면 Fed 정책 여유.
- 새 틀: 1Y 기대인플레 4.8%(1993년 이후 최고) + 5-10Y 3.4%(2011년 이후 최고) = 장단기 동시 상승 = 앵커링 모델 자체가 무효화 위험. Fed가 의지하는 "장기 기대 안정" 논거 붕괴 시 매파 전환 강제.
- Bessent 재무장관 변화: 4월 초 "Recession OK"→4월 15일 "Big Beautiful Bill = biggest stimulus ever" = 성장 우선 선회. 재정 확대+인플레 기대 탈앵커링 동시 발생 = 1970년대 정책 실수 재현 리스크.
- 관련: macro §71, 실질금리 마이너스 전환 리스크(기존 인사이트), MACRO_KW(inflation expectation de-anchoring)
- 발견 버전: v47.1

### "Mission Accomplished" 자산괴리 — 주식 vs 모든 것 (2026.04 Week 3)
- 기존 틀: 자산시장은 하나의 내러티브로 수렴. 주식↑=리스크온=채권↓금↓달러↓.
- 새 틀: 주식만 "모든 위험 해소" 프라이싱, 채권·금·유가·VIX는 "위험 잔존" 프라이싱. F&G 68(탐욕) vs 금 $3,200+·10Y 4.3%+·유가 $60대(수요파괴 반영). 이런 괴리는 2000년 1월, 2007년 10월에도 관찰됨 — "주식이 맞거나, 나머지가 맞거나."
- CTA 매커니즘: Goldman $43.5B CTA 기계적 매수(가격 모멘텀 추종) vs 펀더멘탈 투자자 매도 = 수급 괴리가 가격 괴리를 만듦. 감마 만기(4/17) 후 CTA 지지 소멸 시 조정 리스크.
- SW vs Semi 로테이션: 소프트웨어가 반도체 대비 아웃퍼폼 = 시장이 "매출 가시성(구독)>Capex 사이클(반도체)"을 선호하는 방어적 성장 내 로테이션.
- 관련: macro §71, F&G 데이터 갱신(32→68)
- 발견 버전: v47.1

### TD Cowen DC 채널체크 — 9.4GW 역대 최대 + 리싱 구조 전환 (2026.04)
- 기존 틀: DC 수요 = 하이퍼스케일러 직접 건설 중심. 리싱은 보조적.
- 새 틀: 1Q26 하이퍼스케일러 DC 리싱 9.4GW = 역대 최대(전분기 대비 +40%+). Powered shell(전력 확보된 빈 건물) + Triple-net pricing(모든 비용 임차인 부담) 구조 확산 = 자본 경직성 회피 수단으로 리싱 가속.
- 투자 함의: Cantor AI DC 패러다임("부동산이 딸린 전력 인프라")과 수렴. 리싱 가속 = DLR/EQIX/AMT 같은 DC REIT 재평가 + 네오클라우드(CRWV/CORZ/WULF) 구조적 수혜 재확인.
- 관련: AI 인프라 패러다임 전환(기존 인사이트), TECH_KW(DC leasing, powered shell, triple-net pricing)
- 발견 버전: v47.1

### QCOM 추론시장 리레이팅 — 모바일SoC에서 EdgeAI 플랫폼으로 (2026.04)
- 기존 틀: QCOM = 모바일SoC + 로열티. 밸류에이션 12-18x (성숙 반도체).
- 새 틀: 클라우드AI→디바이스AI 전환 구간에서 QCOM 재평가. Snapdragon X Elite/Plus = Windows on ARM + Copilot+ PC = AI PC 시장 게이트키퍼. 온디바이스 추론 = 레이턴시 0 + 프라이버시 + 오프라인 = 클라우드 추론 대비 구조적 우위 영역 존재. 모바일SoC(12-18x)→AI PC+EdgeAI+온디바이스추론 플랫폼(20-30x) 멀티플 재평가 가능.
- 리스크: Intel Lunar Lake/Arrow Lake, Apple M-series, MediaTek Dimensity = AI PC 경쟁 심화. ARM 라이선스 분쟁 잔존.
- 관련: SCREENER_DB QCOM 메모 갱신, TECH_KW(Snapdragon X Elite, on-device inference)
- 발견 버전: v47.1

### 실제 클릭 테스트의 중요성 (P82 교훈, v46.5)
- `typeof fn === 'function'` = true여도 내부에서 TypeError 발생 가능
- KNOWN_TICKERS가 Set인데 .indexOf() 호출 → 코드 레벨 검증으로는 발견 불가
- **수정 후 반드시 실제 브라우저에서 버튼 클릭 + 입력 + 결과 확인**
- placeholder(화면에 보이는 숫자) ≠ value(실제 입력값) — 폼 테스트 시 주의
- 관련 규칙: R28
- 발견 버전: v46.5

### AI 채팅 할루시네이션 방지 패턴 (v46.5)
- systemPrompt에 데이터 검증 태그 주입: ✓(수집됨) / ✗(미수집) / ⚠(경과)
- ✗ 표시된 소스에 대해 "확인되지 않음"이라고 밝히도록 강제
- 응답 하단에 데이터 소스 배지(📊재무/📰뉴스/🔍웹검색) 자동 표시
- 피드백 버튼(👍/👎) → localStorage에 100건 저장
- messages 60K자 초과 시 자동 trim → 토큰 폭발 방지
- API 실패 시 모델 폴백(sonnet→haiku) + 자동 재시도 2회
- 관련 규칙: R29
- 발견 버전: v46.5

### ZBT 부재 = 강세 검증 실패 진단 (v47.2, 2026.04.16)
- **정의**: Zweig Breadth Thrust = NYSE 10일 이평 상승종목/(상승+하락) 비율이 0.40→0.615로 10영업일 내 급등. 1945년 이후 14회 발생, 전부 강한 강세 사이클 시작점.
- **현재(2026.04.15)**: 비율 0.576, 트리거 0.615 미달. 마지막 트리거는 2025.04.25, 그 이후 1년간 부재.
- **의미**: 지수 신고가 + 모멘텀 지표 과열(CNN 모멘텀 80.6, UW 프리미엄 트렌드 100)에도 **브레드쓰가 확장되지 않음** = 상위 소수 종목이 지수를 떠받치는 **"Lock-out Rally" 가장(假裝) 상태**.
- **역사 회귀**: 2000.01, 2007.10, 2021.11 분배 단계도 ZBT 부재 + 신고가 + 내부 괴리 동반. 셋 다 대폭락 선행.
- **검증 근거**: DATA_SNAPSHOT.zbt.current=0.5756, status='no_trigger', breadth_0313=0.37→breadth_0330=0.44 (회복 진행 중이지만 임계 미달).
- **반영 위치**: §72 macro, technical CHAT_CONTEXT, sentiment CHAT_CONTEXT, CP3 카드
- **관련 규칙**: R13 (dual sourcing), R26 (환류)
- **발견 버전**: v47.2

### 분배 단계 3/3 체크리스트 (v47.2, 2026.04.16)
- **정의**: 시장 분배(Distribution, 매수→매도 전환) 단계의 3대 구조적 특징. 1950년 이후 주요 천정(2000.01, 2007.10, 2021.11) 모두 3/3 부합.
- **체크리스트**:
  1. **내부 괴리**: 지수 신고가 vs 브레드쓰/신고저가 비율 악화. 현재 CNN 모멘텀 80.6 vs 주가 강도 24.8 = 54점 괴리. F&G 68(탐욕)이나 구성 요소의 절반이 중립/공포권.
  2. **꼬리위험 역설**: 채권 변동성(MOVE 68)은 역사적 저점이나 주식 꼬리위험(SKEW 139) 고점. 자산군 간 리스크 인식 불일치 = 보호 매수가 주식에만 집중.
  3. **브레드쓰 부실 돌파**: ZBT 트리거 부재. Mag7 조정 중 SPX 신고가 = 지수 Top-Heavy, 섹터 순환 기능 마비.
- **현재(2026.04.15)**: 3/3 모두 부합 → **분배 단계 경보**.
- **반례 주의**: 3/3 부합해도 시점은 1주~3개월 편차. 트리거(크레딧 스프레드 확대, 정책 실수, 블랙스완)까지 지연 랠리 가능 = "Pain Trade" 구간.
- **시그널 조합**: 분배 단계 + 숏 항복 완결 + VIX 커브 콘탱고 극대화 = 고점 임박.
- **반영 위치**: §72 macro, CP3 카드, KNOWLEDGE-BASE
- **관련 규칙**: R26 (환류)
- **발견 버전**: v47.2

### Pain Trade 완결 = 시장 고점 메커니즘 (v47.2, 2026.04.16)
- **정의**: 최대 다수(특히 헤지펀드 숏)가 고통받는 방향으로 시장이 움직이는 기간. 숏 커버 → 순매수 전환 → "숏충이(bears) 항복"이 완결되면 마지막 지지층(FOMO 매수자) 소진.
- **메커니즘 4단계**:
  1. **초기 랠리**: 긍정 촉매(실적, 정책, 지정학 완화) → 숏 압박 시작 (F&G 50→65).
  2. **숏 커버 가속**: Net-Short 포지션 급감, Goldman 프라임북 "롱온리 +24%", CTA 기계적 매수 진입 (F&G 65→75).
  3. **FOMO 폭발**: 리테일 감마 스퀴즈, 0DTE 콜 과매수. 주가 강도↓인데 모멘텀↑ = 상위 5종목만 상승 (F&G 75→80, UW 프리미엄 트렌드 100).
  4. **항복 완결**: 숏 포지션 제로, 대기매수 소진, 내부자 매수 0.1% (Insider Sentiment 제로). **신규 매수자 부재 → 작은 충격에도 급락**.
- **현재(2026.04.15)**: 3단계 진입 중. UW 프리미엄 트렌드 100 + Insider Sentiment 0.1 = 4단계 근접.
- **역사 선례**: 2000.03 닷컴 고점(롱온리 +28%, 리테일 FOMO), 2007.10 CDO 고점(숏 플립 후 -55%), 2021.11 밈스톡 고점(리테일 FOMO + 숏 소진).
- **카운터 시그널**: 숏 비율 재증가, VIX 콘탱고 붕괴, 크레딧 스프레드 >75bps 확대 시 고점 확인.
- **반영 위치**: §72 macro, sentiment CHAT_CONTEXT
- **관련 규칙**: R26 (환류)
- **발견 버전**: v47.2

### ASML 가이던스 체계 전환 — 조기 상향 패턴 (v48.16, 2026.04.18)
- **정의**: 오더 비공시 체제 전환 이후 ASML이 "연초 보수적 가이던스 제시 → 연중 상향 조정" 방식으로 가이던스 철학을 변경. 과거는 반기 실적 발표 시점(7월)에 상향하는 패턴.
- **관찰**: 2026년 1분기 실적에서 FY26 매출 가이던스를 €340-390억 → €360-400억(중간값 €380억, +€15억) **조기 상향**. JPM/Citi 모두 이를 "수요 강도에 대한 자신감 신호"로 해석.
- **신호 메커니즘**: 1) 오더 공시 폐지 → 투자자들이 수요 강도를 직접 관찰 불가 → 2) 가이던스 상향 자체가 대체 신호 → 3) **조기 상향 = 강한 수요 + 회사 자신감**. 반대로 연중 상향 지연 = 수요 약화 경고.
- **동종업계 파급**: TSMC도 유사 패턴(2026 매출 가이던스 "30% 근접" → "30% 초과"로 상향). WFE 장비 전반 긍정 신호 — 한 공급사의 가이던스 상향이 전체 생태계 수요 검증.
- **반영 위치**: §70 macro/fxbond, CHAT_CONTEXT fundamental, CP2 CP 카드
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.16

### HBM+HBF 3계층 메모리 패러다임 (v48.16, 2026.04.18)
- **정의**: AI 메모리 아키텍처가 기존 2계층(HBM 고속 + SSD 대용량)에서 3계층(HBM 훈련 + HBF 추론 + SSD 아카이브)으로 재편. HBF = "고대역폭 플래시", TSV 적층 16레이어 NAND 기반.
- **스펙**: 스택당 512GB, HBM 대비 **동일 비용으로 8-16배 용량**. DRAM HBM과 용량 최적 SSD 사이 중간 계층.
- **트리거**: AI 워크로드 훈련 → 추론 전환. 추론은 용량 최적화가 핵심이고, HBM은 용량 대비 비용이 높아 추론에 부적합. SanDisk가 2025.08 기술 공개, 2026.04 파일럿 일정 6개월 앞당김(26H2 파일럿, 27초 양산).
- **구조적 영향**: 
  1. NAND 공급사 재평가 — SanDisk(선점), WDC, 키옥시아 JV.
  2. HBM 전용 플레이(SK하이닉스 HBM 점유 프리미엄) 부분 잠식 리스크.
  3. TSV 적층 장비 수요(LRCX/AMAT) 추가 확장.
  4. AI 추론 디바이스 메모리 아키텍처 표준 변화 → 기존 SSD 전환만으로 대응 불가.
- **반례 주의**: HBM이 16-20레이어로 용량 확장해 HBF 범위 잠식 시나리오 존재. 표준화 지연 리스크.
- **반영 위치**: §71 fundamental/themes, SNDK SCREENER_DB, TECH_KW 'HBF'
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.16

### LTA 레버리지 역전 — 메모리 공급사 협상력 (v48.16, 2026.04.18)
- **정의**: 장기공급계약(Long-Term Agreement)이 전통적으로 "산업 사이클 정점 신호"로 해석됐으나, 2026년 메모리 LTA는 역학이 반전. 공급 부족 극심 + 고객이 선제안 = 공급사 레버리지 확보 구간.
- **과거 패턴**: LTA 논의 시작 → 사이클 정점 → 고객이 합의 파기 → 다운사이클. 투자자들이 이 패턴을 이유로 LTA에 부정적.
- **이번 전환**: 
  1. 공급 부족으로 하이퍼스케일러(고객)가 먼저 LTA 제안.
  2. 공급사들이 선불금/공동투자/최저가 보장 등 구속력 강화 조건 포함 가능.
  3. 메모리 이익 가시성 확대 → 밸류에이션 배수 재평가 논거.
- **구조적 근거**: 2026 DRAM/NAND 공급 부족 극심 + 향후 12-18개월 웨이퍼 생산능력 추가 여지 제한(클린룸 공간 부족) + 삼성전자 1Q26 OP만으로 역대 최강 2017-2018 사이클 연간 평균 상회 = ROE 구조 전환.
- **반례 주의**: 
  1. 과거 사례(아시아 투자자들의 주 우려) — 고객이 계약 파기할 가능성.
  2. 2028 신규 캐파 공급과잉 우려.
  3. 중국 DRAM/NAND 공급 위협.
- **관찰 지표**: LTA 발표 시 공급사 주가 반응(상승 = 시장이 레버리지 역전 인정), 배당/자사주 매입 규모 확대.
- **반영 위치**: §72 fundamental, SEC/HXSCL SCREENER_DB, MACRO_KW 'LTA'
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.16

### CoreWeave 프론티어 랩 독점 메커니즘 (v48.16, 2026.04.18)
- **정의**: 네오클라우드 중 CoreWeave가 프론티어 AI 연구소(OpenAI, Meta, Anthropic, Perplexity) 인프라 수요의 압도적 다수를 차지하는 구조. NVIDIA와의 긴밀 관계(공급업체+고객+투자자 3중)가 핵심 차별점.
- **계약 스택 (2026.04)**: Meta $14B(기존) + Meta $21B(신규 2032) + OpenAI $22B + Anthropic 수십억 = 합산 **$58B+**.
- **메커니즘**:
  1. NVIDIA 3중 관계 → 대용량 GPU 우선 배정 → 프론티어 랩 선호.
  2. Nebius 대비 우위 = 대규모 신용도 높은 고객 집중 가능.
  3. 가격 인상 레버리지 — 2025말 +20% 인상 보고(WSJ), 장기 1-3년 계약 요구.
  4. 비NVDA 칩(TPU/Trainium) 호스팅은 NVIDIA 관계로 인해 사실상 차단.
- **Bear Case**: 
  1. 고객 집중도(OpenAI/Meta/MSFT 중심) 리스크 — IPO 시점 주요 우려.
  2. 금리/자본 조달 비용 상승 시 마진 압박.
  3. Anthropic Trainium/TPU 병행 사용 → NVIDIA 칩 범위 축소.
- **인접 파급**: 프론티어 랩 수요 → NVIDIA Blackwell/Vera Rubin 수요 → TSMC CoWoS 캐파 → AVGO 네트워킹. Nebius는 제2티어 네오클라우드로 차별화 필요.
- **반영 위치**: CRWV SCREENER_DB, TECH_KW '네오클라우드', themes CHAT_CONTEXT
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.16

### NVDA 제외 매그7 역전 — 이익 집중도 위험 (v48.18, 2026-04-18)
- **정의**: S&P 500 Q1 2026 실적 시즌에서 "매그7"을 하나의 덩어리로 보면 22.8% 성장이지만, NVDA를 제외하면 6.4%로 **급락**해 나머지 493개사 10.1%에 **역전**. CY 2026 전체로도 NVDA 제외 시 매그7 24.8%→13.2%로 하락해 493개사 15.9%에 역전.
- **메커니즘**:
  1. NVDA 단독이 S&P 500 이익 성장의 과반을 기여 → 지수 집중도 극단화.
  2. NVDA 다음 기여도 상위: SNDK, MU, LLY, AVGO 순 → AI 반도체 메모리 + GLP-1 헬스케어 쏠림.
  3. "매그7"은 이제 단일 카테고리가 아니라 "NVDA + 나머지 6"으로 분해해서 봐야 함.
- **시장 반응 변화 (핵심 신호)**: 긍정 EPS 서프라이즈 주가 반응 **-0.2%** (5년 평균 +1.0% 대비 크게 부진). "좋은 실적은 이미 가격에 반영" 해석 → 프리미엄 부담.
- **섹터 극단화**: IT 성장률 +45.1%(반도체 +95% 주도), 금융 +19.7%, 소재 +21.6% vs 에너지 -13.1%(Exxon EPS $1.83→$1.07) 헬스케어 -10.5%(Merck Cidara 일회성). 순이익률 IT 28.9% vs 에너지 6.8%(5년 평균 9.7% 하회).
- **반례 주의**: NVDA 실적 or 가이던스 한 번 삐끗하면 지수 전체 충격 전이. 2024년 NVDA 실적 미스 시 S&P 500 -3% 선례.
- **시그널 조합**: 지수 집중도 + 긍정 서프라이즈 주가 약반응 + 밸류에이션 프리미엄(S&P 500 NTM PE 20.9배, 5년 평균 19.9배 상회) = 시클리컬 로테이션 대신 **소수 리더 재집중 국면**.
- **반영 위치**: §75 market CHAT_CONTEXT, _generateAIBriefing 매크로 블록, HOME_WEEKLY_NEWS
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.18

### AI 밸류에이션 로테이션 — 광학→HDD/EMS/DELL (v48.18, 2026-04-18)
- **정의**: JPM 1Q26 하드웨어/네트워킹 프리뷰에서 확인된 구조 — AI 관련주 밸류에이션 프리미엄 과거 평균 **+83%**(직전 +79%)까지 확대. 광학(Corning/Fabrinet)·T&M·HDD로 프리미엄 쏠림, EMS/네트워킹/IT HW 프리미엄 완화.
- **재평가 궤적**:
  1. 광학은 2027년이 아닌 **2028년 이익**을 봐야 밸류에이션 정당화 — GLW NTM PE 50배+, FN PE 59배 등 극단.
  2. HDD는 가장 압도적 긍정 — STX/WDC가 "완만한 가격 인상↑ + HAMR 전환 가속 COGS↓" 동시 진행. 밸류에이션+펀더멘털 교차 정당화.
  3. 구리 인터커넥트(APH/CRDO)는 광학 대체 우려 과도 = 구리 공존 테시스로 재평가.
- **OW→N 하향 4건 (JPM)**: GLW PT$175(광학 과열), FN PT$700+Negative Catalyst(신규 고객 가시성 제한), NTAP PT$110(NAND 계약가 C4Q25 +36%→C2Q26 +73% 전례 없음→FY27 GPM -200bps), QCOM PT$140+Negative Catalyst(ARM AGI CPU+Nvidia Groq LPX 경쟁).
- **Rank Order Top10**: ANET(AFL 1위) → APH(AFL 2위) → CLS → STX → WDC → CRDO → CSCO → JBL → FLEX → COHR. HDD/EMS/DELL 상승, 광학주 하락.
- **구조적 원인**:
  1. AI 지출 증가는 지속 → 네트워킹/스위치(ANET) 지속 수혜.
  2. 메모리 원가 상승(NAND 계약가 CQ 기준 +36%/+88%/+73%)을 사후 반영하는 스토리지(NTAP)는 구조적 마진 압박.
  3. 스마트폰/IoT 시장 부진 + ARM/Nvidia 신규 경쟁 = QCOM 리레이팅 논거 단기 약화.
- **반영 위치**: §74 fundamental CHAT_CONTEXT, 관련 SCREENER_DB 10개 티커 메모
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.18

### DC 규제 전환 + 온사이트 발전 (v48.18, 2026-04-18)
- **정의**: 2026년 4월 Maine 주가 미국 최초 주 단위 대형 DC 금지 법안 통과(2027 가을까지 20MW+ 신규 DC 건설 중단). 최소 12개 주 유사 모라토리엄 검토 → DC 입지 제약 구조적 전환.
- **수요 재편 3요소**:
  1. **지역 집중**: Maine 금지 → Virginia/Ohio/Texas 쏠림 가속 → 전력망 부하 집중.
  2. **온사이트 발전 신수요**: Wartsila 34SG 엔진 412MW 오하이오 DC 공급(선박 엔진 DC 전력 첫 사례, 리드타임 2년). GEV/BE/CEG + Wartsila 수혜.
  3. **프로젝트 손실**: 지난해 반발로 무산된 DC 프로젝트 총 **$1,520억** = 매우 큰 억제된 투자 규모.
- **원인 구조**: 1개 DC = 인구 50만 도시 전력 소비 = 전력·수자원·농지 소비 우려 결집 + 미국 내 초당파적 문제화(재닛 밀스 메인 주지사 서명 대기).
- **인접 파급**:
  1. 하이퍼스케일러 Capex 속도 조절 리스크(2027-2028 DC 성장 둔화 가능).
  2. 전력 인프라주(GEV/VST/CEG/BE) 구조적 수혜.
  3. DC 디벨로퍼 중 온사이트 발전 가능한 사업자 우위.
  4. 반대로 AI Capex 사이클 강세가 전력 인프라 병목에 의해 제약되는 "time-to-power" 테시스 재부각.
- **반영 위치**: §76 macro/energy CHAT_CONTEXT, MACRO_KW 'DC moratorium'/'Wartsila', renderEconCalendar
- **관련 규칙**: R26 (환류)
- **발견 버전**: v48.18

---

## UX 실전성 원칙 (v48.62, 2026-04-22 통합)

### 결론→행동 흐름 우선 원칙
**통찰**: 금융 터미널에서 사용자가 가장 먼저 찾는 건 "지금 상태 + 무엇을 할지"다. 많은 설명보다 오늘 결론 한 줄, 즉시 행동 한 줄, 업데이트 시각이 먼저 보여야 한다.
- 구조 원칙: 결론 → 행동 → 근거 순. 현재 스크리너는 근거(설명)가 먼저 오는 페이지가 多.
- `.page-conclusion-bar` (3열: 결론·행동·업데이트)가 아이콘 고정 패턴.
- **실전 적용**: 각 initXxxPage() 완료 후 `_renderConclusionBar()` 호출, `updateMarketPulse()` 내에서 `_updateAllConclusionBars()` 트리거.
- 발견 버전: v48.62

### 데이터 시점 신뢰 원칙
**통찰**: 금융 도구는 신뢰가 한번 무너지면 활용성이 급감한다. 실시간/스냅샷/추정의 3단계 구분이 필수.
- `fb-live` = API 실시간, `fb-static` = 특정 날짜 종가 기준, `fb-estimated` = 모델 계산·보간값(amber 배지).
- 하드코딩 차트 옆 `fb-estimated` 배지 = "이 값은 추정치"라는 명시적 신호.
- 발견 버전: v48.62

### 정보 밀도 관리 원칙
**통찰**: font-size 10px/11px 대량 사용 자체보다, 콘텐츠 영역의 글자 크기가 핵심 — 메타 UI(배지·라벨)는 11px 허용, 카드 본문은 12px 이상.
- `aio-explain` 패널 기본 접힘 구조는 이미 올바름. 핵심 카드를 먼저 노출하고 설명을 선택적으로 열게 하는 패턴.
- 새 페이지 추가 시: (1) 결론 바 → (2) 핵심 카드 → (3) aio-explain 순 배치 의무.
- 발견 버전: v48.62


---

## 트레이딩 방법론 통합 (v51.55, 2026-06-29)

### TM-I. Qullamaggie 돌파매매 3셋업 [실전 핵심]
> 출처: https://qullamaggie.com/my-3-timeless-setups-that-have-made-me-tens-of-millions/ + @godkoiyo 한국어 번역본 (2026-06-26)

**핵심 철학**: 강한 주식이 더 강해진다. 큰 상승 후 타이트하게 쉬고, 이동평균선 위에서 저점을 높이며, 다음 박스를 돌파하는 순간을 산다. 승률 25~30%에 5~20R 손익비 구조.

**셋업 1 — 돌파(Breakout)**:
- 전제: 1~3개월 내 30~100%+ 선행 상승
- 구조: 10/20MA 서핑하며 Higher Lows + Tight Range 수축
- 진입: 박스 상단 돌파 초기 OR Opening Range High(1m/5m/60m 봉 고점)
- 손절: 진입 당일 저가 (ATR 이내여야 유효. ATR 초과 = 늦은 진입, 패스)
- 청산: 3~5일 후 1/3~1/2 익절 → 손절 본전 이동 → 나머지는 10일선 종가이탈까지 보유

**셋업 2 — 에피소딕 피벗(Episodic Pivot · EP)**:
- 조건: 예상 못한 호재(어닝 서프라이즈)로 10%+ 갭업 + 첫 15~30분 평균 거래량 소화
- 어닝 조건: YoY 중~세 자릿수 성장 + 컨센 대폭 상회 + 직전 3~6개월 횡보(진짜 서프라이즈)
- 진입: Opening Range High 돌파. 손절: 당일 저가 → 10/20MA 추세 추종

**셋업 3 — 파라볼릭 숏(고급, 초보 금지)**:
- 대형주 수일~수주 내 50~100%+, 소형주 300~1000%+ 급등 후 3~5일+ 연속 상승
- 첫 음봉/VWAP이탈 후 Opening Range Low. 목표: 10/20MA. 손익비 5~10R

**공통 원칙**: 1종목 최대 25% 비중. 야간 30% 한도. 나쁜 장(NASDAQ 10MA < 20MA)에서는 현금이 포지션. 실적 발표 2~3일 전 신규 진입 금지. ADR 5%+ 종목 우선. 스캔: 1M/3M/6M 상위 1~7%, 50종목 이내.

### TM-II. Minervini Triple Barrel 신호 [2026-06-25 LLY 사례]
> 출처: Mark Minervini Private Access (Minervini Markets 360), 2026-06-25 11:57AM EDT

**Triple Barrel = 3개 독립 지표 동시 발화**:
- Minervini Pressure: 추세 압력 최상위
- Buy Risk Colors: 진입 위험도 최저(Green)
- TPR (Timing Price Range): 최상단(B 등급)
- 보강: RPR 87 / ER 90 / SR 96 → 더욱 강력한 복합 신호

**LLY 사례 (2026-06-25)**:
- 진입: ~,208, 손절: ,079(~11% risk), VCP 13.7% 수축 확인
- 현재가: ,208.54, Stage 2 상승 추세 유지

### TM-III. Apple CXMT 메모리 검토 → 단기 노이즈 판단 [2026-06-28]
> 출처: 운영자 분석 (2026-06-28)

**판단**: 반도체 지수 조정 유발 → 과민반응. 구조적으로 애플의 미국 시장 대규모 CXMT 채택 불가.
- 정치·규제 장벽: HBM·첨단 DRAM 국가전략자산 지정, BIS 수출통제
- CXMT 경쟁력: DDR5/LPDDR5X 중국 내수 OK, HBM 2~3세대 격차
- 뉴스 성격: 2026년 2월부터 반복 보도된 내용의 재소환 → 중국 시장용 한정 가능성
- 트럼프 CXMT 승인 로비 = 메모리 가격 협상 레버리지 성격

**구조적 수혜 (이중 공급망 분기)**:
- 중국 생태계: CXMT → 중국 브랜드 공급망
- US+동맹국 생태계: MU(CHIPS Act +, 미국 내 DRAM 40% 목표) / SK하이닉스(HBM 독점) / 삼성
- 5~10년 메가트렌드: 공급망 분기 = MU/LRCX/AMAT 구조적 수혜

### TM-IV. Trader Tactical Framework — Support/Reclaim + Short-Cover + Semi Rotation [2026-06-30 02:36 KST]
> 출처: 사용자 제공 트레이더 Telegram 스크린샷. 구현: `AIO_TACTICAL_TRADER_FRAMEWORK` (`sourceKind: REFERENCE`). 날짜·레벨은 당시 예시이며 현재 레벨로 사용 금지.

**핵심 판단 구조**:
- 방향성이 불명확하면 성급한 진입 금지. 기본값은 “확인 대기”이며, 신규 진입은 지수 리클레임/거래량/섹터 리더십이 같이 맞을 때만 강화.
- 지지·리클레임 구간에서 숏 금지. 종가 이탈, 거래량 동반 하락, failed retest가 확인되기 전까지 단순 약세로 단정하지 않는다.
- 상승의 질을 분리: 거래량 있는 상승 = 실수요 매수세 가능성, 거래량 없는 상승 = 숏 익절/커버 가능성. breadth와 leadership이 뒤따라야 지속성 인정.
- 반도체 약세는 “반도체 사망”이 아니라 분기말/포트 리밸런싱일 수 있음. SMH가 QQQ/SPY 대비 회복하고 IGV에서 SMH로 수급이 이동하면 semi leadership으로 재분류.
- 하단 이탈 후 재진입 + 반도체 리더십 회복은 failed breakdown/bear trap 가능성. 반대로 지지선 하회 + 거래량 매도 + 재돌파 실패면 “단순 눌림”이 아니다.

**스크리너 통합 위치**:
- `calcBreadthRotation()`: `SMH vs QQQ/SPY`, `IGV vs SMH`, `failedBreakdownReclaim`, `shortCoveringOnly` 입력 축 추가.
- `_aioBuildPageDecision()`: signal/technical/ticker/themes/market-news overlays.
- `CHAT_CONTEXTS`: `_aioTacticalTraderFrameworkContext()`로 AI 답변에 주입.
- `MACRO_KW`/`TECH_KW`: failed breakdown, support reclaim, volume-backed rally, software-to-semi rotation 감지.

### TM-V. AI Capex Funding Pulse + Semi Breadth Washout [2026-07-09]
> 출처: 사용자 제공 매크로/반도체/차트 프레임워크 1~6 및 이미지 1~7. 구현: `CHAT_CONTEXTS` macro/fundamental/technical/signal/breadth, `MACRO_KW`, `TECH_KW`, `SCREENER_DB` memo overlay. `sourceKind=REFERENCE`; 이미지 속 수치와 가격 레벨은 당시 예시이며 현재 레벨로 사용 금지.

**1. 경기침체 인식 5축**
- 시장이 침체를 반영하는 경로는 하나가 아니다. ① GDP/성장률 둔화 ② 인플레·유가·메모리 가격 압력으로 인하 기대 후퇴 또는 인상 사이클 위험 ③ 호르무즈·전쟁 등 지정학 리스크 ④ ECB/BOJ 등 글로벌 중앙은행 긴축 ⑤ Hartnett/MAGS ETF 같은 포지셔닝 리스크오프 신호로 분해한다.
- 적용: macro/signal 답변은 "침체인가 아닌가"보다 어떤 축이 시장 가격에 들어오고 있는지를 먼저 분해한다.

**2. AI CAPEX 자금조달 맥박**
- AI 인프라 투자는 수요만으로 지속되지 않고 자본조달 가능성에 의해 속도가 결정된다. 핵심 관찰 지표: 10Y+ 장기금리, LQD YTM, ICE BofA US Corporate OAS/IG OAS, HY OAS, 빅테크 신용등급 변화, WTI/Brent 유가 충격, 달러 유동성.
- 해석: CAPEX가 꺾이는 진짜 위험은 "AI 수요 소멸"보다 금리/스프레드/신용등급 변화로 ROI와 조달비용이 동시에 악화되는 경우다. 유가·sticky inflation·Fed 인상 사이클 위험은 이 맥박을 빠르게 악화시킨다.

**3. AI 밸류체인 long/short 구분**
- Burry-style debate는 AI 전체 부정으로 읽지 않는다. 인프라 판매자(NVDA/MU 등)는 고객 집중도, 선구매·맞춤 공급망 약정, 메모리 사이클, capex funding risk를 따지는 short-thesis 대상이 될 수 있고, 수익화·통행료 레이어(MSFT/Azure/Copilot/OpenAI exposure 등)는 ARR/계약잔고/가격결정력으로 AI 상용화를 증명하는 long-thesis 대상이 될 수 있다.
- 반례: MSFT식 상용화가 실제라면 GPU/HBM/네트워킹 인프라 수요를 다시 강화할 수 있다. 따라서 "인프라 붕괴 vs 플랫폼 번창" 단선 구조가 아니라 자금조달 비용과 ROI가 양쪽을 어떻게 연결하는지 본다.

**4. 20EMA / 50EMA / 100SMA / 200SMA 단계 지도**
- 20EMA: 상승 지속 기대, 단기 추세 탄력 확인.
- 50EMA: 과열 해소와 조정 마무리 후보, reversal-test zone.
- 100SMA: 조정의 최종선, 중기 추세 변곡점.
- 200SMA: 장기 추세 리셋, thesis re-underwriting line.

**5. SMH/XSD 반도체 breadth washout**
- 이미지 5/6은 SMH/XSD의 above-20EMA 0, above-50EMA 32, above-200EMA 84 예시를 보여준다. 이는 sourceKind=REFERENCE 예시이며 라이브 수치가 아니다.
- 알고리즘: above-20EMA가 0 근처까지 씻겼지만 above-200EMA가 높게 남으면 구조 붕괴가 아니라 tactical mean-reversion 후보로 본다. 단, 50EMA breadth가 40% 아래이면 중기 breadth 손상이며, 200EMA breadth까지 꺾이면 구조적 리스크오프로 승격한다.
- 실행: intraday Higher High/Higher Low, daily bullish close, 거래량 확인 전 선진입 금지. Low Volume Node를 지나 High Volume Node/overhead supply로 접근하면 짧은 바운스 플레이 중심으로 관리한다.

**6. Photonics / Meta cloud note**
- 광학·photonics 이미지는 AI 인프라의 병목과 테마 지속성을 확인하는 보조 자료다. Meta/cloud 뉴스 이미지는 "수요 약화" 단독 결론보다 고객·공급망·다이버전스와 반례(AWS leakage, 서버 부족, AI asset scarcity)를 함께 검토해야 한다는 프레임으로 사용한다.

### TM-VI. Agentic Loop 분류 + Standing-Invariant 운영 패턴 [2026-07-09]
> 출처: 사용자 제공 외부 자료 6건(Fable 5 에이전트 운영 가이드, Claude Code 공식 loops 문서, Managed Agents multi-agent API 문서, Karpathy LLM wiki 패턴 gist, 옵시디언 세컨드브레인 구축기 2건, n8n) 검토. 구현: `_context/WORKFLOW-GOVERNANCE.md`(Loop Vocabulary·Standing Invariant Rule), `_context/RULES.md` R290, `scripts/ci-live-invariant-check.mjs`, `scripts/ci-knowledge-lint-check.mjs`, `.github/workflows/knowledge-lint.yml`. P653 참조.

**1. 루프 4분류 (turn/goal/time/proactive)**
- turn-based: 프롬프트 1회, 모델이 완료/막힘을 스스로 판단 — 이 리포의 `/bug-fix`·`/integrate`·`/qa` 대부분.
- goal-based: 명시적 종료조건 + 턴 상한 — Claude Code `/goal` 기능. 예: "헤드리스 테스트 0 fail까지, 5회 제한".
- time-based: 스케줄 트리거, 취소되거나 작업 자체가 끝나야 정지 — `refresh-data.yml`(30분), `data-watchdog.yml`(1시간), 신규 `knowledge-lint.yml`(주간).
- proactive: 사람이 실시간으로 보지 않는 이벤트/스케줄, 개별 실행마다 목표 달성 시 종료하되 스케줄 자체는 계속 — `ci.yml`(push/PR 게이트), R290 라이브 불변식 잡.
- 적용: 새 반복 작업이 필요할 때 무엇을 만들지 정하기 전에 이 표로 먼저 분류한다. time/proactive는 사람이 없어도 돌아가야 하는 일에만 쓰고, 가능하면 기존 3개 GitHub Actions 워크플로 중 하나를 확장하는 쪽을 새 스케줄 발명보다 우선한다(Claude Code 자체의 `/schedule` 클라우드 루틴 같은 새 인프라 계열을 들여오기 전에, 이미 있는 무료·버전관리되는 cron 계열을 먼저 검토).

**2. Standing Invariant (source-gate와의 구분)**
- 소스 게이트(`ci-runtime-contract-check.mjs`, `ci-structural-check.mjs`)는 로컬 체크아웃 파일만 읽어 커밋 시점 정확성을 증명한다. 배포된 사이트가 그 상태를 계속 서빙 중인지는 별개 질문이며, 커밋이 없으면 소스 게이트는 애초에 실행되지 않는다.
- P638/C1(배포된 Worker가 리포보다 구버전)과 P572/R263(데이터 커밋은 쌓이는데 배포가 조용히 멈춤)는 둘 다 리포는 정상, 라이브만 어긋난 사례 — "한 번 통과한 목표는 타임스탬프 붙은 가정일 뿐"이라는 원칙이 실제로 이 리포에서 발생한 실패 계열.
- 판별 기준: 어떤 postmortem의 근본원인이 로컬 게이트 재실행으로는 재현되지 않고 라이브 사이트에서만 재현된다면, 그 회귀는 `scripts/ci-live-invariant-check.mjs`(R290) 후보다. 로컬에서 이미 잡히는 것은 여기 중복 추가하지 않는다 — 두 목록이 같은 사실을 각자 관리하면 서로 어긋나기 시작한다.

**3. 드리프트는 1순위 실패 요인**
- Karpathy LLM wiki 패턴 댓글 사례(약 4천 페이지 규모 운영)가 지목한 위키 유지보수의 #1 실패 요인은 정기 lint 없는 페이지 부실화. 이 리포의 `_context/`도 동일 구조의 위키이며, `/knowledge-lint`가 "주 1회+"라는 산문 권고만 있고 강제 스케줄이 없던 것이 동일한 취약점이었다.
- `scripts/ci-knowledge-lint-check.mjs` + `knowledge-lint.yml`(주간)이 결정적 하위집합(INDEX.md 파일목록 정합성, INDEX.md/`_context/CLAUDE.md` 표 정합성, `auto_refresh: true` 문서의 staleness)을 강제한다. 의미론적 판단(모순 탐지, 소유권 애매성)은 여전히 세션이 `/knowledge-lint` 전체를 수동 실행해야 한다.

**4. 스킬 지시문 누적은 그 자체로 감사 대상**
- Fable 5 공식 문서: "구모델용으로 쓰인 지시는 신모델 출력을 저하시킬 수 있다 — 기본 성능이 지시 없이 더 낫다면 지시를 삭제하라." 이 리포의 `WORKFLOW-GOVERNANCE.md`가 이미 갖고 있던 "Karpathy Loop For AIO" 안티패턴 목록(지시만 추가하고 eval 없음, 한 번에 열 개 지시 추가)과 같은 계열이지만, 신규 지시를 추가할 때만 점검했지 이미 쌓인 지시문 자체를 재점검하는 패스는 없었다.
- `/knowledge-lint` Pass 8(신규)이 이 재점검을 담당한다: reasoning-echo 요구 문구, eval 없이 누적된 지시, 이진 eval로 대체 가능한 과잉 절차.

### TM-IX. Factor 백테스트 10년/120종목 — composite는 전 구간 무의미, lowvol 서브팩터만 유의미한 음의 상관(부호 반전) [2026-07-10]
> 출처: CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md WO-3("Factor Model 검증") 축소 검증(사용자 확인). `scripts/backtest-factors-longrun.mjs` → `public-data/factor-backtest-longrun.json`. P666/R299 참조.

**1. 발견 (실측, n=114~120 리밸런스 시점, 시총 상위 120종목·2016-2026 10년·월간 리밸런스)**
- 라이브 스크리너 팩터 랭킹(`_aioComputeFactorRanks`)이 실제 쓰는 momentum/trend/lowvol/kalman 4개(size/value/quality는 이미 무료 다년치 소스 부재로 라이브 코드 자체가 제외 중)를 NEUTRAL 고정 가중치로 블렌딩한 composite는 **1/5/21/63일 forward return 전 구간에서 통계적으로 무의미**(모든 신뢰구간이 0을 포함) — 나쁘게 작동하는 것도 아니고 확인 가능한 신호도 없음.
- 개별 팩터 중 **lowvol(트레일링 60일 연율화 변동성의 역수 — 낮을수록 고득점)만 5/21/63일에서 일관되게 통계적으로 유의미한 음의 상관**: 21일 ICIR=-0.191(t=-2.04, CI[-0.093,-0.002]), 63일 ICIR=-0.308(t=-3.27, CI[-0.126,-0.031]). Walk-forward holdout(최근 36개 시점)에서 오히려 강해짐(ICIR=-0.491, t=-2.95) — 특정 구간 우연이 아님. momentum/trend/kalman은 양(+) 방향이나 전 구간 신뢰구간이 0을 포함해 확정 불가.

**2. 유력 가설 두 가지(둘 다 미확정, 상호 배타적이지 않음)**
- 학술 문헌의 "저변동성 이상현상"은 보통 전체 시장 유니버스·수십 년·리스크조정(흔히 베타 기준) 변동성으로 측정한다. 이번 백테스트는 시총 상위 120개·단일 10년·원시(raw) 60일 변동성 — **정의와 표본이 다른 별개의 측정**이라 같은 주장의 재현 시도가 아니다.
- 이 특정 10년(2016-2026)은 대형 기술/AI 테마주 주도 장세였다는 것이 잘 알려진 사실인데, 표본이 시총 상위 120개(대형 기술주 비중 큼)라 "최근 조용했던(저변동성) 대형주"가 "최근 변동성이 컸던(고성장 테마주) 대형주"보다 후행 수익률이 낮은, 이 표본 구성에 고유한 현상일 가능성.

**3. survivorship bias는 이 결과를 설명하지 못함(역설 아님, 방향이 다름)**: survivorship bias는 일반적으로 팩터 성과를 부풀리는(과대평가) 방향으로 작용하는데, lowvol은 오히려 음(-)의 결과가 나왔다 — 즉 survivorship bias "때문에" 이 특정 결과가 나온 것은 아니고, 순수 알고리즘/표본 특성 문제일 가능성이 더 높다는 뜻(하지만 완전히 배제할 근거도 없음 — 확정 아님).

**4. 이 발견을 라이브 코드에 즉시 반영하지 않은 이유**: WO-2(P665)와 동일한 원칙 — 4/7 팩터만 검증, 873종목 중 120개 부분표본, survivorship bias 미해결, RISK_OFF/RISK_ON 적응 가중치 미검증이라는 4중 제약이 있는 부분 검증 결과다. `_aioComputeFactorRanks()`의 가중치·팩터 방향을 코드로 바꾸지 않고 발견만 기록·보고 — "발견↔조치 분리" 원칙(WO-6에서 확립) 재적용.

**5. 일반화 가능한 교훈**: 학술 팩터 투자 문헌의 결과(저변동성 프리미엄, 모멘텀 프리미엄 등)를 인용해 스코어링 규칙을 정당화하거나, 백테스트 결과 하나로 팩터 개념 자체가 틀렸다고 결론짓기 전에, 그 백테스트의 유니버스(폭·시총가중·섹터구성)·lookback 기간(어떤 regime을 포함/제외하는지)·팩터 정의(원시 vs 리스크조정, lookback 길이)가 실제로 문헌과 일치하는지 먼저 확인할 것 — 참조: [[R299]](RULES.md).

### TM-VIII. computeTradingScore 10년 백테스트 — 매크로/변동성/추세 서브포뮬러가 forward return과 유의미한 음의 상관 [2026-07-10]
> 출처: CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md WO-2("Trading Score 검증") 축소 검증(사용자 확인). `scripts/backtest-trading-score-longrun.mjs` → `public-data/score-backtest-longrun.json`. P665 참조.

**1. 발견 (실측, n=2492, 통계적으로 유의미 — CI가 0을 넘지 않음)**
- `computeTradingScore()`의 13개 입력 중 자유 소스로 10년치 PIT 데이터를 구할 수 있는 것(VIX/VVIX/SPX/TNX/DXY/WTI/HYG — volScore 25%+trendScore 20%+macroScore 10%, 합 55%)만 재구성해 2016-07~2026-07 10년(2,513거래일, 저변동성 상승장부터 고변동성 약세장까지 8개 데이터-도출 regime 포함)에 걸쳐 forward return과의 Spearman 상관을 측정한 결과: **21일 forward에서 rho=-0.165(95% CI [-0.203,-0.127]), 63일 forward에서 rho=-0.255(CI [-0.291,-0.217])** — 스코어가 높을수록(변동성 낮음+추세 강함+매크로 우호) 오히려 이후 수익률이 더 낮은, 통계적으로 유의미한 **역방향** 관계.
- Walk-forward(전반부 2016-2023 rho=-0.174, 후반부 2023-2026 rho=-0.184)로 시기를 나눠도 부호·크기가 일관됨 — 특정 구간의 우연이 아니라 10년 전체에 걸친 안정적 패턴.
- Regime별로는 균일하지 않음: 가장 흔한 "low-vol_bull"(전체의 54%, n=1366)에서는 상관이 사실상 0(rho=-0.011, CI가 0을 포함)이고, 음의 상관은 주로 "mid-vol" 구간(n=417+322+105)에서 나타나며, "high-vol_bear"(n=97, 가장 스트레스가 심한 구간)에서는 오히려 rho=+0.178(CI가 0에 걸쳐 있어 유의미하다 확정은 불가)로 부호가 반전되는 경향.

**2. 유력한 원인(가설 — 추가 데이터로 반증 가능, 확정 아님): 절대 임계값 고정 + 10년간의 구조적 레짐 시프트**
- `macroScore`가 쓰는 임계값(`dxy>107`, `tnx>4.5`)은 특정 시점 기준 절대 숫자다. 그런데 이 10년은 TNX가 ~1.5%(2016)에서 4%대 후반(2022 이후 대부분)까지 구조적으로 이동한 기간을 포함한다 — "2016년 기준 높은 금리"와 "2023년 기준 높은 금리"는 전혀 다른 레짐 위치인데 같은 절대 숫자로 판정한다. 이것이 `macro` 서브스코어 자체도 유의미한 음의 상관(21일 rho=-0.116, 63일 rho=-0.09)을 보이는 이유로 가장 그럴듯한 설명.
- `volScore`(VIX 낮을수록 고득점)도 vol 서브스코어 단독으로 가장 강한 음의 상관(21일 rho=-0.171, 63일 rho=-0.265)을 보임 — "VIX가 매우 낮다"는 변동성 문헌에서 이미 알려진 대로 자기만족적 국면(복지부동)의 신호일 수 있어, "낮은 VIX=강세 지속"이라는 암묵적 가정 자체가 여러 문헌에서 이미 도전받는 통념이라는 점과 방향이 일치.

**3. 이 발견을 라이브 스코어/조언 문구에 즉시 반영하지 않은 이유(의도적 범위 제한)**
- 이번 백테스트는 스코어 가중치의 55%(vol+trend+macro)만 검증했다 — momScore(F&G, 25%)·breadthScore(20%)·PCR/AAII 보정은 자유 다년치 소스가 없어 중립 상수로 고정한 채였다. 즉 "라이브 스코어 전체가 반대로 작동한다"가 아니라 "매크로/변동성/추세 서브포뮬러가 이 방식대로 재구성했을 때 그렇다"는, 훨씬 좁은 결론이다.
- Codex의 WO-2 완료 게이트 자체가 "음의 상관 또는 무효 결과일 때 라벨 자동 완화 정책"을 요구하지만, 이는 제품 동작(스코어 라벨/신뢰도 문구)을 바꾸는 결정이라 별도로 사용자 확인이 필요하다고 판단해 코드 변경 없이 발견만 기록·보고했다(WO-6에서 확립한 "발견↔조치 분리" 원칙과 동일).
- 결과가 기대와 달랐다고 삭제하지 않고 `public-data/score-backtest-longrun.json`에 그대로 유지 — Codex 게이트의 "결과가 나쁘더라도 삭제하지 않는 재현 가능한 artifact" 요구사항을 문자 그대로 충족.

**4. 일반화 가능한 교훈**: 손으로 정한 절대 임계값(특정 지표의 "높다/낮다"를 고정 숫자로 판정)에 의존하는 스코어는, 그 지표 자체의 장기 평균/분포가 구조적으로 이동하는 기간(금리 사이클, 인플레 레짐 등)에 걸쳐 백테스트하면 부호가 반전되거나 사라질 수 있다. 새 트레이딩/의사결정 스코어를 설계하거나 기존 스코어에 새 절대-임계값 규칙을 추가할 때는, 그 임계값이 검증 기간 내내 "같은 의미"였는지(상대적 위치/백분위 기준 재검토)를 먼저 확인할 것 — 참조: [[R298]](RULES.md).

### TM-VII. Mojibake 대량 복구 기법: git 히스토리 diff 대조 vs 인코딩 왕복 역산 [2026-07-10]
> 출처: WO-0(`CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md`) 작업 중 CHANGELOG.md(6,386건)·BUG-POSTMORTEM.md(3,208건)·eval-guide.md(44건)에서 발견한 대규모 이중 인코딩 손상을 실제로 복구한 과정. P660 참조.

**1. "복구 불가능해 보이는 대량 손상"을 먼저 두 그룹으로 나눈다**
- 손상된 텍스트가 git 히스토리상 특정 커밋에서 "이전엔 깨끗했다가 그 커밋에서 깨진 것"인지, 아니면 "그 텍스트가 git에 처음 등장한 순간부터 이미 깨져 있었던 것"인지를 먼저 구분한다. 전자는 `git log -p -- <파일>` 전체 이력을 파싱해 `-`(이전)/`+`(이후) 라인을 블록 단위로 짝지으면(같은 길이의 연속 `-`/`+` 블록끼리 위치별로 매칭) 100% 정확한 원본 텍스트를 그대로 복구할 수 있다 — 실제로 CHANGELOG.md 2,941건, BUG-POSTMORTEM.md 1,035건, eval-guide.md 27건(전량)이 이 방식으로 완전 복구됐다.
- 후자("born corrupted", 원문이 git에 존재한 적이 없는 순수 추가분)는 diff 대조로 복구 불가능하다 — CHANGELOG.md 8,057건·BUG-POSTMORTEM.md 492건이 이 경우였다.

**2. "born corrupted" 잔여분에 대한 인코딩 왕복 역산은 시도할 가치는 있지만 성공을 가정하지 않는다**
- 알려진 clean/corrupted 쌍(diff로 이미 확보한 것)을 이용해 `clean_text.encode(A).decode(B)` 형태의 코덱 조합을 체계적으로 탐색하면 이론상 일반 복구 함수를 만들 수 있다. 이번 사례에서는 CP949/EUC-KR/CP1252/Latin-1 등 표준 조합과 2단계 체인을 시도했으나 정확히 일치하는 변환을 찾지 못했다 — 손상 프로파일(ASCII는 완전 보존, 일부 자리엔 유효한 엉뚱한 한글 문자, 일부 자리엔 리터럴 `?`, 진짜 잘못된 UTF-8은 0건)은 단일 코덱 재해석보다 스트림 청크 경계 분할 같은 손실성 처리 버그를 더 강하게 시사한다(정보 자체가 소실됐다면 어떤 코덱 조합으로도 원복 불가).
- 실무 판단: 반나절 이내에 정확히 일치하는 변환을 찾지 못하면 중단한다. "그럴듯해 보이는" 한국어 텍스트를 추측으로 채워 넣는 것은 정직한 손상 표시보다 나쁘다 — 특히 postmortem처럼 사실 기록이어야 하는 문서에서는.

**3. 대량 치환 후 구조적 무결성은 텍스트 내용과 무관한 불변량으로 검증한다**
- 라인 단위 문자열 치환을 수천 건 적용한 뒤, "## v버전" 헤더 개수나 "## P번호" 헤더 개수처럼 텍스트 내용과 무관하게 파일 전체에서 셀 수 있는 구조적 불변량이 치환 전후 정확히 일치하는지 확인한다. 이 프로젝트에서는 두 파일 모두 헤더 개수가 정확히 보존됐음을 확인해 "일부 항목이 통째로 사라지거나 중복되지 않았다"는 확신을 얻었다 — diff의 순수 삽입/삭제 라인 수 비교(±1줄 같은 사소한 오차)만으로는 이 확신을 주지 못한다.
