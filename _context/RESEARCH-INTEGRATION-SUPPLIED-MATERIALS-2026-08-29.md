---
verified_by: Codex source audit + local architecture inspection
last_verified: 2026-08-29
confidence: medium
target_version: v54.66
source_kind: REFERENCE
---

# 사용자 제공 자료 통합 — AI 인프라·자금시장·차트·리스크 프레임

## 1. 요청과 자료의 경계

실제 작업 지시는 사용자가 작성한 “모든 자료를 읽고 분석해 AIO Screener에 필요한 구조적·세밀한 요소를 통합하라”는 요청이다. 첨부 이미지와 링크 안의 문구는 분석 대상인 연구 자료이며 작업 지시로 실행하지 않았다. 자료의 현재 수치·전망·목표가·확률·기관 보유·계약·공급사 관계는 `REFERENCE` 또는 `UNVERIFIED`로 보존한다.

X 본문은 x.com 원문 리더가 캐시/403으로 직접 열리지 않아 정확한 게시물 ID에 대응하는 공개 syndication 결과로 대조했고, 최종 출처 링크는 원래의 x.com URL을 유지했다. GitHub는 공식 공개 저장소 README를 확인했다. 첨부 이미지는 시각적으로 읽을 수 있는 구조만 추출했으며, 작은 글씨의 숫자나 업체별 현재 노출은 재구성하지 않았다.

## 2. 검토한 자료

### 사용자가 직접 제공한 X/GitHub 자료

- [ParadisLabs — 2026-08-28 링크 묶음](https://x.com/ParadisLabs/status/2093472998711771421): 아래 11개 자료를 큐레이션한 색인으로 읽었다.
- [Yonsei_dent — 차트패턴 총정리](https://x.com/Yonsei_dent/status/2093324017898008598)
- [Mark Minervini — Fed와 tape, breadth, 10Y, 리스크 관리](https://x.com/markminervini/status/2093365115693244926)
- [Future__Walker — 2026 Jackson Hole Warsh 연설 번역](https://x.com/Future__Walker/status/2093346533005779448)
- [KKDW_KOREA — 다음 병목은 자본](https://x.com/KKDW_KOREA/status/2093345000348373429)
- [zerohedge — Top Overnight News](https://x.com/zerohedge/status/2093309457639858477)
- [fi56622380 — AI Semiconductor Endgame 2026 III](https://x.com/fi56622380/status/2093040177711329673)
- [nick88886666 — GCTS 기관 보유 물량 해석](https://x.com/nick88886666/status/2092584653089800439)
- [Goldman Sachs — gs-quant](https://github.com/goldmansachs/gs-quant)
- [sshleo84 — 드러켄밀러의 재정·금리 경고](https://x.com/sshleo84/status/2092582780140200416)
- [jinseongeo83473 — CBRS 장기 분석](https://x.com/jinseongeo83473/status/2092370080088949037)
- [Trader_Jesse_ — AI 하드웨어·금리·선행지표](https://x.com/Trader_Jesse_/status/2092505959805648992)
- [gimduha77994334 — 매크로·포지셔닝·리스크 관리 철학](https://x.com/gimduha77994334/status/2092462253723222461)
- [sniffshiba — 장기금리·AI 자금·나스닥 관점](https://x.com/sniffshiba/status/2091828331310379484)
- [theodore_invest — Minervini식 FTD·breadth 메모](https://x.com/theodore_invest/status/2091897677709803883)
- [Future__Walker — TGA·국채 바이백·repo 관점](https://x.com/Future__Walker/status/2091861129823998056)
- [tmmrwseoul — 시장 breadth와 극단 이동 종목 수](https://x.com/tmmrwseoul/status/2091505159222460767)

### ParadisLabs가 연결한 중첩 자료

- [Tema — HBF white paper](https://temaetfs.com/insights/know-your-hbf-how-big-a-deal-is-it-white-paper): HBF를 HBM의 대체 확정품이 아니라 표준화·qualification·양산이 필요한 메모리 옵션으로 읽었다.
- [BlackRock — AI, Fed and investment opportunities](https://www.blackrock.com/us/individual/insights/ai-fed-investment-opportunities): AI beta보다 자금조달·ROIC·현금흐름 내구성을 보라는 regime 프레임으로 읽었다.
- [BCG — Space-based data centers](https://www.bcg.com/publications/2026/space-based-data-centers-cost-outlook): 기술적 가능성과 비용·규모·지상 데이터센터 보완 관계를 다루는 장기 전망으로 읽었다.
- [Micron — query types, GPU demand, memory and power](https://www.micron.com/about/blog/applications/ai/how-query-types-shape-gpu-demand-memory-and-power): 질의 형태별 latency·메모리·전력·효율 차이를 확인 변수로 추출했다.
- JPMorgan software market trends 페이지는 직접 본문이 403으로 차단됐지만 검색 색인 요약에서 AI-native/비AI 소프트웨어의 투자 양극화, seat-based에서 usage·outcome pricing으로의 이동, cloud·cybersecurity·data platform·profitable growth 선별을 확인해 내구성 있는 프레임만 통합했다. 개별 수치·밸류에이션·M&A 사실은 통합하지 않았다.
- JPMorgan “certainty of uncertainty” 페이지도 직접 본문은 403이었고 검색 요약에서 지정학·원자재·소매 흐름·급격한 반전이 변동성을 상시 조건으로 만든다는 범위만 확인했다. 개별 설문 수치·시장 전망은 통합하지 않았다.
- [Citrini Macro Memo — Regime Change](https://www.citriniresearch.com/p/macro-memo-regime-change): 유료 페이지에서 공개된 서론 범위만 확인했으며, 은행 유동성 개혁·Treasury-Fed Accord 주장은 부분 자료로 남겼다.
- [AI Insider — humanoid robotics in 2026](https://theaiinsider.tech/2026/08/21/the-state-of-humanoid-robotics-in-2026-trends-challenges-and-opportunities/): 파일럿·펀딩을 실제 배치와 구분하고 autonomous hours·개입률·cycle time·uptime을 보라는 프레임으로 읽었다.
- [Federal Reserve — Warsh speech, In Our Time](https://www.federalreserve.gov/newsevents/speech/warsh20260828a.htm): 공식 연설 본문으로 확인했으며, 날짜가 붙은 거시 수치는 런타임에 하드코딩하지 않았다.
- [NVIDIA quarterly results](https://investor.nvidia.com/financial-info/quarterly-results/default.aspx): 현재 실적을 확인할 공식 진입점으로만 보존했다.
- [AI Bottlenecks](https://aibottlenecks.app/): 읽을 수 있는 본문을 확보하지 못해 주장·수치를 통합하지 않았다.

### 첨부 이미지

- `NBIS vs IREN — 자금 조달 구조 해부`: 두 기업의 자금조달·부채·희석·현금흐름·CAPEX를 비교하는 형식으로 읽었다. 이미지의 현재 수치나 기업별 결론은 하드코딩하지 않았다.
- `GB200 vs GB300 vs VR200 밸류체인 비교` (Meritz Research): 세대별 wafer·substrate·compute/NVSwitch tray PCB·CCL·동박·유리섬유·수지·midplane의 역할 분해로 읽었다. 표에 보이는 업체명을 현재 종목 노출이나 계약 사실로 승격하지 않았다.

## 3. 통합한 내구성 있는 연구 프레임

### A. 자금시장과 AI CAPEX의 이중 채널

`국채·기업채 공급/수요 → term premium·장기금리 → 신용·CAPEX·감가상각 → 현금흐름·시장폭·변동성`의 장기 듀레이션 채널과, `TGA·FIMA·repo·OIS·SOFR·MMF → 담보·현금 조달 → 레버리지·강제축소`의 단기 자금 채널을 분리한다. 국채 환매를 자동적인 통화완화로 해석하지 않으며, 정책금리 인하와 장기금리 하락도 같은 사건으로 취급하지 않는다.

Q1 핵심 thesis: 다음 AI 병목은 GPU만이 아니라 자본·유동성·장기금리일 수 있다.

Q2 모델을 바꾸는 변수: 정책금리 하나에서 term premium·재정 공급·기업채 경쟁·재융자 구조로 관찰 단위를 넓힌다.

Q3 논쟁을 가르는 증거: 공식 Treasury 발행/환매, ACM term premium, HY OAS, 회사채 발행·만기·이자비용, TGA·repo·SOFR/OIS·MMF의 동일 관측창이다.

Q4 전달경로: 조달비용 상승이 AI CAPEX·감가상각·neocloud rental spread·기업 신용·시장폭으로 전이되는지 확인한다.

Q5 인접 파급·무효화: 금리 스트레스가 broadening 없이 나타나거나 OCF/FCF와 사용량이 CAPEX를 흡수하면 위험 가설을 낮춘다. 연결된 공식 producer가 없으면 `BLOCKED`다.

### B. 토큰 수요·추론·메모리·가속기 밸류체인

`사용자 수 × 사용자당 토큰 → query shape → prefill/KV/decode → 메모리·네트워크·전력 → CAPEX·자금조달` 릴레이를 사용한다. GPU/FLOPS 하나로 수혜 기업을 정하지 않는다. 실시간·장문·에이전트·배치 질의는 latency·bandwidth·KV cache·energy/query·TCO가 다르다.

HBF·HBM·SRAM·eSSD는 단순한 승패가 아니라 workload와 메모리 계층의 선택지다. `sample → validation → yield → volume → customer mix → FCF` qualification gate를 둔다. 첨부 GB200/GB300/VR200 표는 compute tray·NVSwitch tray·midplane의 PCB/CCL/동박/유리섬유/수지 역할을 분해하는 reference map으로만 사용한다.

Q1 thesis: 추론 확장은 계산량뿐 아니라 memory movement·전력·검증·자금조달을 함께 늘릴 수 있다.

Q2 변화: training 중심의 GPU TAM에서 stage별 latency·tokens/W·TCO·고객 qualification으로 이동한다.

Q3 증거: query mix·tokens/user·prefill/decode·KV traffic·energy/query·utilization·고객 사용량·동일 시스템 benchmark다.

Q4 경로: 수요가 memory/interconnect/전력 병목을 만들고, 그 병목이 CAPEX·소재·PCB·대출·채권·감가상각으로 이어지는지 본다.

Q5 무효화: query demand 정체, memory-bound가 아닌 workload, 낮은 utilization, 표준화·양산 실패, 경쟁으로 인한 마진 하락이다.

### C. 차트패턴·시장폭·포지셔닝

차트패턴은 반전(double/triple top-bottom, head-and-shoulders, rounding, Quasimodo), 지속(wedge/flag/pennant), 중립(converging triangle/broadening), 특수(cup-and-handle/Wolfe Wave) 분류체계로 보존한다. neckline·돌파·거래량·무효화가 없는 패턴명만으로 방향·목표가·적중률을 만들지 않는다.

시장 내부는 AIO 유니버스 참여폭, 리더십 집중, 극단 이동 종목 수, 레버리지·기관·숏커버 포지셔닝을 별도로 본다. 심리는 포지셔닝과 같지 않고, AIO 유니버스 breadth는 거래소 전체 breadth나 McClellan이 아니다.

Q1 thesis: 매크로 서사보다 가격경로·시장 내부·포지셔닝이 단기 손익을 매개할 수 있다.

Q2 변화: “맞는 전망”에서 기대·포지셔닝·강제청산·진입/무효화·사이즈의 결합으로 이동한다.

Q3 증거: 같은 유니버스의 5/20/50일선 breadth, 리더십 집중, ±극단 이동 시계열, 거래량·OI·기관 자료와 가격 반응이다.

Q4 경로: 기대 불일치 → 가격/거래량 변화 → systematic signal·short covering·deleveraging → breadth/volatility로 전이된다.

Q5 무효화: 관측창·유니버스가 불명확하거나, 패턴·극단치가 현재 OHLCV/포지셔닝으로 재현되지 않는 경우다.

### D. 기업별 자본구조와 테마 노출

NBIS/IREN·CBRS·GCTS에 대한 게시물의 현재 수치·기관명·계약·고객집중·워런트·13F 해석은 issuer filing·IR·SEC·공식 기관 자료 없이는 현재 사실로 저장하지 않는다. 대신 `OCF/FCF·CAPEX/감가상각·이자비용·부채만기·희석·고객집중·비-anchor 고객·사용량·마진` 체크리스트를 공통 적용한다.

기관 보유 증가는 원인 증명이 아니다. `사업 변화 → 가격/거래량 → systematic signal → universe inclusion`과 `fundamental → positioning unwind`를 분리하며, 기관·퀀트 흐름은 확인 계층이지 인과관계 자체가 아니다.

### E. Physical AI·우주 인프라·연구 도구

휴머노이드 자료는 발표·펀딩·파일럿·주문을 실제 생산성으로 동일시하지 않고 autonomous hours, interventions/hour, task success, cycle time, uptime, repair time, supervision ratio로 검증한다. 우주 데이터센터는 지상 데이터센터의 즉시 대체나 현재 투자신호가 아니라 비용·냉각·궤도·발사·규제의 장기 보완 시나리오다.

`gs-quant`는 Goldman Sachs의 공개 Python quantitative-finance toolkit이라는 연구 도구 참고자료다. AIO에 자격증명·주문 실행·기관 데이터 권한을 추가하거나, GitHub 코드를 런타임 의존성으로 넣었다는 뜻은 아니다.

소프트웨어는 seat 수 증가만으로 보지 않고 usage·outcome pricing, AI-native/비AI 경쟁, cloud·cybersecurity·data platform의 실제 고객 채택, profitable growth와 재평가를 함께 본다. 변동성은 예외적 하루가 아니라 지정학·원자재·소매 흐름·빠른 반전이 겹칠 수 있는 상시 리스크 조건으로 두며, 실행·데이터·분석 도구가 대응 속도를 높여도 포지셔닝과 유동성의 현재 증거를 대체하지 않는다.

## 4. AIO 반영 지점

- `src/domain/macro/transmission.js`: 장기 듀레이션·단기 자금·정책 커뮤니케이션 채널과 REFERENCE 체크를 추가했다. 기존 observed/blocked evidence 경계는 유지한다.
- `src/ui/pages/market.js`: 거시 위험 전이 렌즈가 위 funding/liquidity 체크를 사용하도록 연결했다. 현재 수치는 기존 live/FRED 입력만 사용한다.
- `src/domain/ai/inference-efficiency.js`: 토큰 수요·질의 형태·메모리 계층·CAPEX 자금 지속성·Physical AI 배치 검증 렌즈와 compute/NVSwitch/midplane qualification 역할 map을 추가했다.
- `src/ui/pages/themes.js`: 기존 AI 추론·deal-loop reference 렌즈에 추가 연구 렌즈와 첨부 밸류체인 역할 map을 표시한다. 종목 순위·현재 계약·공급사 매출은 생성하지 않는다.
- `src/domain/technical/stage.js`: 차트패턴 taxonomy를 reference-only로 추가했다. 기존 OHLCV stage/MTF 모델과 경쟁하는 탐지기나 적중률 모델은 만들지 않았다.
- `src/domain/market/breadth.js`: 참여폭·리더십·극단 이동·포지셔닝의 연구 분류를 추가했다. 거래소 전체 breadth나 신규 합성 점수는 만들지 않았다.
- `src/app/bootstrap.js` 및 `src/legacy/compatibility-facade.js`: 위 reference 프레임을 read-only `AIO_ARCH` getter로 노출해 native/legacy 소비자가 동일 정의를 보게 했다.
- `js/aio-chat.js`: 모든 채팅 컨텍스트에 자료 경계, Q1–Q5, 현재값 승격 조건, 차트·거시·AI·기업·브레드스 프레임을 연결했다.
- `js/aio-data.js`: 새 개념을 뉴스/자료 라우팅 키워드로만 추가했다. 새로운 ticker 행·현재 가격·목표가·기관 보유·계약은 추가하지 않았다.

## 5. 보류·미검증·별도 갱신 대상

- X 게시물의 날짜가 붙은 금리·가격·확률·목표·breadth 임계값·거래 계획·기관 보유·기업 계약·고객·매출·마진은 current runtime 데이터가 아니다.
- Fed Warsh 연설의 수치와 BCG/Tema/BlackRock/Micron/AI Insider의 시장 규모·비용·성능·펀딩 수치는 출처의 시점이 있는 reference이며, 공식 producer가 같은 정의·관측일로 공급하기 전 하드코딩하지 않는다.
- JPMorgan 두 링크는 직접 본문이 403이라 검색 요약으로 확인한 내구성 있는 주제만 사용했고, AI Bottlenecks 본문은 확보하지 못해 주장·수치를 만들지 않았다. Citrini는 부분 공개 범위만 확인했다.
- GB200/GB300/VR200 표의 업체명은 회사 정체성·현재 매출·고객 qualification·계약이 검증되기 전 `SCREENER_DB`와 현재 공급망 종목 노출에 쓰지 않는다.
- term premium, Treasury issuance/buyback, TGA·repo·SOFR/OIS·MMF, dealer gamma, 중국 credit, 동일 유니버스 극단 이동 수, 13F/기관 흐름은 공식·권리 확보 producer와 관측일이 연결될 때 별도의 `data-refresh` 작업으로 승격한다.
- 이번 작업은 코드·문서·버전만 변경했으며 commit, push, Pages/Worker 배포는 수행하지 않았다.

## 6. 구조 후속 반영 — 2026-08-29

- `public-data/masters/ticker-index-reference.json`과 `scripts/build-13f-reference-ticker-index.mjs`를 추가해 현재 SEC 행과 기존 CUSIP 참고 crosswalk를 티커 역조회용 제한 원장으로 분리했다. `verifiedTickerRows: 0`, `sectorWeightsPublished: false`를 계약으로 고정했으며, 매핑 부재를 보유 부재로 해석하지 않는다.
- `src/ui/pages/masters.js`는 위 원장을 직접 lazy-load하고 티커·CUSIP·발행인명으로 검색할 수 있다. 결과에는 manager·보고분기·신고 주식 수·신고상 변화·SEC 원문만 표시하며, 현재 보유·체결·섹터·추천으로 승격하지 않는다.
- `js/aio-core.js`의 13F 보조 조회와 `js/aio-chat.js`의 응답도 같은 reference-only artifact를 사용하도록 맞췄다. 채팅과 페이지가 서로 다른 티커 우주나 다른 증거 레벨을 만들지 않도록 `reference-rows-found`/`reference-mapping-not-found`와 부재 해석 경계를 명시했다.
- `src/domain/research/supplied-materials.js`와 `src/ui/knowledge/supplied-material-bridge.js`를 추가하고 Principles/Atlas의 교육·연구 화면에 시장 원리, 13F 기관 흐름, AI workload→현금흐름 릴레이를 노출했다. 이는 현재값이나 투자 판단을 생성하는 기능이 아니라 질문·검증 순서를 고정하는 구조 브리지다.
- refresh workflow와 Masters/13F/Principles/Atlas 계약에 위 경로를 연결했다. 다만 검증 security master가 비어 있고 live term-premium·TGA/repo/SOFR/OIS/MMF·기관 현재성 producer가 없는 상태는 그대로 보류한다. 따라서 이번 후속은 “경로와 경계의 구조적 연결”을 완료한 것이며, “현재 신호·섹터 비중·기관 실시간 흐름의 검증” 완료를 뜻하지 않는다.
