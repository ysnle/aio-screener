# X 북마크 추가분 반영 (2026-10-18)

10/16 원장(`_artifacts/x-bookmarks-20261016/ledger.json`, 834건) 이후 소유자가 추가한 북마크 111건을 같은 방식으로 읽었다. 본문, 작성자 스레드, Article 전문, 첨부 차트·표 이미지를 모두 확인했다. 투자 관련 96건을 기존 노트와 대조했다. 코드 반영은 `src/domain/research/packet-20261018-x-bookmarks.js`에 있다.

## 새 분석 노트 12개

| 노트 | 경로 | 주된 출처 |
|---|---|---|
| 강제 매도의 사슬 | 통화·신용 | jonborica, bubbleboi(보유 비중×낙폭 산점도), sshleo84, laylaperfume(가격×미결제약정) |
| AI 인프라 신용 사다리 | 통화·신용 | NURadu_(CDS·fallen angel), DrNHJ(OpCo/PropCo·회수 기간), fulllleverage(PPI↑에도 금리↓) |
| 변동성과 기저율 | 금융수학 | CKCapitalxx(VIX÷√252), fednmad(VIX 급등 뒤 반등 백테스트), JPM 가이드, olnlkim(조건 누적) |
| 지수 속 순환 | 가격·기대 | NickSchmidt(주도주 베이스 돌파), NURadu_, fourseasonfan, 801010athlete |
| 과매도 되돌림 대 추세 바닥 | 차트 | SRxTrades ×2, tmmrwseoul(포물선 하락 반전), Trader_Jesse_, TheProfInvestor(반론) |
| 이야기를 장부로 확인 | 기업 수익 | gmpnavi, quietnurse_(폐기 조건·병목 대체 가능성), Kaizen_Investor(점수 제외), ilpyung98 ×2 |
| 파운드리 학습 | 산업 | damnang2 ×2(D0·수율, 웨이퍼급 칩 수리·시험 원가) |
| 메모리 순환 선행 | 산업 | sshleo84(1995~97 D램), JPM 반도체 데스크, Future__Walker(전달 경로 시험) |
| AI 생산성 시차 | 미시경제 | Rocketesla_KR(다이너모), anishmoonka, sean_________(DC 임대 GW) |
| 헤드라인 출처 | 금융수학 | yeoulabba(AGI 헤드라인), investingluc(F&G 재구성), Trader_Jesse_(브리핑 틀) |
| 지정학 충격 경로 | 금리·환율 | dons_korea ×3(제한/구조 충격, OECD 재고 운영 최소치, 시간표), Rocketesla_KR(레드라인) |
| 성장·물가 노출 | 금리·환율 | RayDalio(올웨더 — 진단만), JunDo1050(달러 부족), MS 금융 여건 z점수 이미지 |

## 기존 노트에 맡긴 것

이 항목들은 반복하지 않았다.

- 사모신용 환매·PIK·이중 담보 → `private-credit-redemption`
- PPI 유통 마진 → `labor-inflation-split`
- 유가 프리미엄과 물량 손실 → `oil-shock-split`
- 추론 칩 메모리 대역폭·KV 캐시 → 추론 효율 노트
- 경쟁사 발표 단계 → `tech-claim-stages`
- 다중 검정 → `backtest-rejection`
- 지수-종목 괴리와 투매 → `crowding-breadth-extreme`
- 주식·금·채권 동반 하락 → `four-asset-joint`

## 화면 반영

- 스크리너 사용자 조건 `하방 과확장`을 추가했다. 50일선 아래로 ADR의 n배 이상 떨어진 종목을 고르며 기본값은 4배다. 관찰 조건일 뿐 바닥 신호가 아니다. 문장 입력으로는 "하방 과확장"을 쓴다.
- 조건을 3개 이상 겹치면 안내 문장이 나온다. 조건마다 남는 종목이 줄고, 그 조합은 과거 성과로 검증한 규칙이 아니라는 내용이다.
- 투자 심리 화면의 단기 불안 비율 카드에 `VIX → S&P 500 하루 약 ±x%`를 표시한다. VIX÷√252로 구한 1표준편차이며 정규분포를 가정한 값이다.

## 소유자 결정이 필요한 후보 (넣지 않음)

- **흡수일 조건:** N일 저점에서 거래량이 평소의 k배이고 종가가 당일 범위 상단에 있는 날을 고른다. 생산자 필드(당일 범위 위치)가 필요하다. 10/16 제안 #360과 같은 생산자 작업이다.
- **VIX 비확인 주석:** SPY는 신저가인데 VIX 고점은 낮아지는 경우다. 표본이 작아 문장 주석으로만 가능하다.
- **한국 선물 가격 × 미결제약정 2×2 표시:** 미결제약정 원천이 없다.
- **연중 최대 낙폭 기저율 표:** AIO 자체 지수 기록으로 재계산할 수 있는지 먼저 확인해야 한다.

## 읽었지만 반영하지 않은 것

- 정치 서사
- 양자컴퓨터와 비트코인
- 일정표·뉴스레터 형식 이미지
- AI 도구 사용 팁
- 본문이 수집되지 않은 단일 기업 연구
- 칼만 필터: 스크리너가 페어 거래를 하지 않는다.
- CAT 본드 → RWA: 스크리너와 무관하다.
