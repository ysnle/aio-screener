# Telegram 4채널 구조적 통합 원장 — 2026-08-09

## 1. 감사 범위와 판정 경계

이번 통합은 사용자가 지정한 네 개의 Telegram 공개 웹 미러를 브라우저로 읽어, 스크리너에 재사용할 수 있는 **프레임·관찰·검증 질문·검색어·후보 티커 연결**을 추출한 것이다.

| 채널 | 관찰 역할 | 브라우저에서 확인한 범위 | 기본 신뢰 상태 |
|---|---|---|---|
| [Aether Japan Research](https://t.me/s/aetherjapanresearch) | 일본·미국 반도체/AI 인프라·수급 | 라이브 공개 화면에서 2026-08-07 관측 | `REFERENCE / secondary` |
| [Insider Tracking](https://t.me/s/insidertracking) | 미국 속보·기업·매크로·이벤트 캘린더 | 라이브 공개 화면에서 2026-08-03 관측 | `REFERENCE / secondary` |
| [BornLupin](https://t.me/s/bornlupin) | 한국 반도체·브로커 리포트·소재/ESS | 라이브 공개 화면에서 2026-08-05 관측 | `REFERENCE / secondary` |
| [HANA China](https://t.me/s/HANAchina) | 중국·대만·신흥국 공급망/배터리/AI | 라이브 공개 화면에서 2026-08-09 / Today 관측 | `REFERENCE / secondary` |

공개 채널의 구독자 수·게시물 노출량·전달 속도는 신뢰도나 수요의 증거가 아니다. 전달된 Bloomberg/FT/Reuters/증권사 자료가 보이더라도 Telegram 게시물 자체는 재전달 계층으로 기록하고, 원문·공시·기업 IR·거래소·전력/ISO 자료를 독립 확인해야 한다. 원문 전문은 재배포하지 않고 아래에는 구조와 짧은 패러프레이즈만 남긴다.

자동 수집기는 실행 시 외부 `fetch`가 실패하여 기존 digest를 보존하고 `collectionStatus=failed`로 남겼다. 이번 브라우저 감사는 별도의 reference ledger이며, 자동 digest가 최신 상태라고 가장하지 않는다. 다음 수집에서도 네 채널이 모두 registry와 failure-cache에 나타나야 한다.

## 2. 채널별 추출 결과

### Aether — 아시아 반도체·AI 인프라·수급

- SK Hynix의 중국 충칭 후공정 자산 전략 검토설은 자산 매각·공급망 재배치·대중국 노출의 후보 신호다. 회사 발표, 자산 장부/손상, 생산능력 및 고객 배분으로 확인한다.
- Citi의 AI build-to-monetize 프레임은 hyperscaler capex, GPU 임대료, 메모리/인터커넥트, 텍사스 전력·인허가·물·노동 병목, token/cache 사용량을 하나의 수익화 사슬로 묶는다. capex 금액 하나가 아니라 `수요 → 가동률/가격 → OCF → 전력 인도 → 감가상각/조달비용`을 따로 관찰한다.
- Citi의 broadening/한국 포지셔닝 및 BNP의 레버리지 청산 관찰은 기술주 이탈과 시장 참여 확대를 구분하는 흐름 프레임이다. KOSPI positioning 수치는 보고서 원문과 기준일을 대조한다.
- Bloomberg의 해저 케이블 및 SK Hynix 노조·텍사스 물 부족 게시물은 지정학·물리 인프라·노동 리스크를 공급망 모델에 추가하는 발견 입력이다.

연결 티커: `000660.KS`, `005930.KS`, `TSM`, `NVDA`, `AMD`, `AVGO`, `AMZN`, `GOOG`, `ORCL`, `GEV`, `PWR`, `NVT`, `MU`, `WDC`, `STX`.

### Insider Tracking — 빠른 미국 이벤트·기업 뉴스

- DXY·미 국채 10년물·유가·호르무즈 등 pre-market 요약은 매크로 이벤트 컨텍스트로만 사용하고, 최신 값과 실제 시장 반응은 live macro artifact에서 가져온다.
- BMY 관련 M&A, Kioxia PCIe 6.0/UFS 5.0 NAND, TSMC 3nm와 Nvidia·AMD·Broadcom 수요, SpaceX 실적, Qwen·TPU·Microsoft 데이터센터·Palantir/NHS 등은 기업/제품/공급망 discovery로 분리한다.
- Goldman의 high-beta/momentum turning-point 프레임은 상대강도·변동성·포지셔닝의 보조 질문이지 매도 신호가 아니다.

연결 티커: `BMY`, `6600.T`, `TSM`, `NVDA`, `AMD`, `AVGO`, `GOOG`, `AMZN`, `MSFT`, `PLTR`, `ORCL`, `TSLA`, `WDC`, `STX`, `MU`.

### BornLupin — 한국 종목·브로커 노트·소재/ESS

- 삼성 폴더블 사전예약, 한국 반도체 클러스터의 6.3GW 추가 전력·산업용수, SK Hynix HBM4 장비 및 메모리 LTA는 수요와 생산 병목을 연결하는 후보 프레임이다. 제품 예약·정부 회의·공식 투자·장비 발주·물량/가격을 각각 확인한다.
- APR의 북미/유럽 성장률, InBody·Sanil Electric 실적, 정부 R&D 지원, ESS attachment rate, VC 전해액 첨가제 가격, HBM ASP 등은 서로 다른 출처층이다. 증권사 노트·전달 리서치·채널 관찰을 회사 공시와 같은 증거로 합치지 않는다.
- Optimus/휴머노이드, 일본 Akita 데이터센터, UAE 투자, AI inference 비중 같은 큰 전망은 장기 테마 후보로만 저장하고 현재 매출·생산·수익성으로 승격하지 않는다.

연결 티커: `005930.KS`, `000660.KS`, `042660.KS`, `039030.KQ`, `247540.KQ`, `003670.KQ`, `278470.KQ`, `ALB`, `TSLA`, `GEV`, `PWR`.

### HANA China — 중국·대만·신흥국 공급망

- 대만 지수·TSMC·MediaTek의 상반기 상승, 중국 AI/STAR50/광학/휴머노이드/EV, Cambricon, CATL/BYD/나트륨이온·ESS, AI copper foil·고체전지 등은 중국/대만 공급망 지도와 theme discovery를 보강한다.
- SK Hynix P&T7 HBM4 장비, Sandisk LTA 3~5년, Xiaomi/Oppo/Vivo 부품 부족, OpenAI 비용 최적화, Burry 포지션 등은 시점·원문·법적 공시가 빠진 전달 주장이다. 현재 스크리너 신호나 가격 목표로 사용하지 않는다.
- HANA의 라이브 브라우저 화면은 2026-08-09 / Today 게시물이 관측되었으므로 이번 감사에서는 `REFERENCE / secondary`로 표시한다. 게시물의 최신성은 내용의 사실성·현재 펀더멘털·시장 신호를 보증하지 않는다.

발견용 연결 티커: `TSM`, `MTK`, `6600.T`, `WDC`, `MU`, `005930.KS`, `000660.KS`, `ALB`, `247540.KQ`, `003670.KQ`. 현재 유니버스/공급자에 없는 중국 기업은 후보 discovery에만 기록하고 종목 행·현재 데이터는 생성하지 않는다.

## 3. 공통 분석 프레임워크 Q1~Q5

| 질문 | 스크리너/채팅에서의 실행 규칙 |
|---|---|
| Q1. 무엇이 직접 관찰됐나? | 원문 출처, 발표일, 관찰일, 수치 정의, 표본/기간을 분리한다. 게시물의 해석을 사실 필드에 직접 쓰지 않는다. |
| Q2. 어떤 종목/테마에 노출되나? | security master/SCREENER_DB의 canonical ticker만 연결한다. 유니버스 밖 종목은 discovery 후보로만 유지한다. |
| Q3. 독립 확인이 있는가? | 기업 공시/IR·거래소·정부·ISO/utility·원 데이터·실적·계약 중 최소 두 개의 독립 lineage를 요구한다. 같은 내용을 재전달한 채널은 두 개의 확인으로 세지 않는다. |
| Q4. 촉매가 가격에 수용됐나? | 이벤트 날짜·예상/실제·surprise·거래량·상대강도·breadth·credit/금리 반응을 함께 본다. headline만으로 signal을 만들지 않는다. |
| Q5. 무엇이 틀리면 무효인가? | OCF/가동률/임대료/메모리 가격·배분/전력 인도/자금조달이 반대로 움직이거나, 발표·공시가 부인되거나, 지지/retake가 실패하면 `invalidation`으로 남긴다. 오래된 채널은 freshness 만료를 자체 무효 조건으로 둔다. |

### 데이터 품질 규칙

1. `CURRENT/LIVE`는 현재 provider·공시·공식 release만 사용한다. Telegram은 기본 `REFERENCE`다.
2. 채널 관찰 시각과 원문 발표 시각을 분리한다. 전달 지연과 재게시를 중복 카운트하지 않는다.
3. 목표가·수익률·생산량·전력 GW·물 사용량·LTA 기간은 텍스트에 숫자가 있어도 원문 대조 전 null/가설로 둔다.
4. 텍스트가 없는 미디어 게시물, 번역·전달·스크린샷은 아이디어 발견용이며 자동 랭킹의 확정 근거가 아니다.
5. 관찰창이 오래된 채널은 `STALE_REFERENCE`로 낮추고, 현재 게시물이 보이는 채널도 `REFERENCE / secondary`를 유지한다. 게시물 부재·구독자 수·최근 화면의 정적 상태에서 시장 결론을 추론하지 않는다.
6. 스크리너 메모는 `what was observed / why it matters / confirm / invalidate / next window` 구조를 유지하고, 실행 주문·비중·BUY/SELL로 변환하지 않는다.

## 4. 구현 반영 맵

| 표면 | 반영 내용 |
|---|---|
| `scripts/fetch-telegram-digest.mjs` | 4채널 `CHANNEL_CATALOG`, public mirror, HANA 포함 page map, 확장 ticker extraction, 실패 시 기존 데이터 보존 + 네 채널 오류 상태 보존 |
| `public-data/telegram-digest.json` | 자동 수집 실패를 `collectionStatus=failed`로 표시하고 기존 성공 시각을 보존. 현재 파일에는 네 채널 source catalog와 HANA 실패 row가 존재 |
| `js/aio-data.js` | HANA source registry/출처 역할, 4채널 pipeline audit, MACRO_KW/TECH_KW, 관련 종목 reference memo 및 검증 경계 |
| `js/aio-chat.js` | Telegram channel roles, evidence quality, promotion/invalidation gate, source links, AI infrastructure context relevance |
| `public-data/user-research-digest.json` | 브라우저 감사의 요약 원장·Q1~Q5·채널별 source audit를 reference item으로 보존 |
| `_context/KNOWLEDGE-BASE.md` | 채널 역할·주요 프레임·자동화 경계와 다음 검증 루프를 지식 환류 |
| QA/CI | source catalog, required channels, page coverage, fail-closed digest, stale boundary를 구조 계약으로 검사 |

## 4A. Live browser re-audit (2026-08-09)

The Chrome public-page audit directly read the active Telegram panes without login or posting. The visible active windows were Aether 2026-08-07, Insider Tracking 2026-08-03, BornLupin 2026-08-05, and HANA China 2026-08-09 / Today. This supersedes the earlier HANA stale-corpus note for this live observation only; the automated digest remains `collectionStatus=failed` and is not overwritten or marked fresh.

The live reading confirmed transformed research branches rather than URL-only ingestion: memory/HBM/LTA/SSD/TPU/advanced packaging; data-center power/interconnection/onsite power/ESS; macro/geopolitics/FX/China CPI and AI/robotics/EV supply chain; and corporate disclosures with attributed links. These are discovery/reference observations. Forwarded numbers, price targets, rumors, and copied messages remain `REFERENCE` until an independent filing, company IR, exchange, government, ISO/utility, raw provider, or attributable primary source confirms them.

HANA China is therefore `REFERENCE / secondary` in the live audit, not currently `STALE_REFERENCE`; its visible current posts still do not become current fundamentals, signals, or decisions. The active pane is a window, not a complete archive, and a future audit may change the window.

## 5. 다음 관찰창

- 다음 기업 실적: OCF, capex, depreciation, lease/funding cost, GPU/메모리 가격과 실제 매출 인식의 동시성.
- 다음 전력/인프라 공시: interconnection 승인·대기열, 변압기/전력품질 계측, 데이터센터 물·전력 인도, 장비 backlog.
- 다음 메모리/패키징 창: HBM4 qualification/yield, NAND contract/spot/inventory, LTA allocation·가격.
- 다음 한국/중국 수급 창: 외국인/기관 positioning, earnings revision, 대만·중국 공급망의 공식 발표와 수출통제.
- 다음 Telegram 자동 수집: 네 채널 모두 성공/부분/실패 상태를 기록하고, 성공하지 않은 데이터는 현재값으로 승격하지 않는다.
