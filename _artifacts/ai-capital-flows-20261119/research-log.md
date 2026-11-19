# AI 자본순환 원자료 조사 기록 (2026-11-19)

산출물: `public-data/atlas/capital-flows.json` (노드 25, 엔트리 43). 모든 엔트리는 이번 작업에서 연 페이지로 확인했다. SEC 문서는 EDGAR 원문(일반 클라이언트 User-Agent)을 내려받아 해당 문단을 직접 읽었다. 기억으로 쓴 숫자는 없다.

## 규칙

- `sourceKind: filing` = SEC 공시 본문(8-K/6-K/10-Q/10-K/S-1/A)에서 금액을 확인. `company` = 회사 보도자료·공식 블로그. `report` = 언론 보도만 있음.
- `announced`는 날짜 종류가 엔트리마다 달라 `dateBasis`(추가 필드)에 적었다. S-1/A에서만 확인된 계약은 계약 월만 알 수 있어 `announced`를 이번에 연 공시일(2026-11-17)로 두고 계약 월은 `what`/`dateBasis`에 적었다.
- 보증 엔트리는 `from`=보증인, `to`=임대인(보증을 받는 쪽), `onBehalfOf`(추가 필드)=의무를 지는 임차인.
- 비상장사는 `@이름`. `@OpenAI`·`@Anthropic`은 `PRIVATE_NODES` 관례 그대로. 상장사 티커는 `public-data/us-listings.json`(asOf 2026-11-18)에서 이름까지 대조: SPCX=Space Exploration Technologies Corp., CBRS=Cerebras Systems Inc., CIFR=Cipher Digital Inc.(옛 Cipher Mining), OWL=Blue Owl Capital Inc. `MGX` 티커는 Metagenomi라서 아부다비 MGX에 쓰지 않는다. 앤트로픽 상장 예정 티커 ANT는 레지스트리에 아직 없다.

## 엔트리별 확인

| id | 확인한 출처 | 메모 |
|---|---|---|
| nvda-openai-equity-2026 | OpenAI 글(StorageNewsletter 재게재 본문), Built In | openai.com은 403. 재게재 본문이 OpenAI 1인칭 원문. 집행 여부는 미확인이라 status=발표 |
| nvda-sbenergy-ohio-guarantee | NVDA 10-Q(2026-07-26 분기) 본문, Q3 FY27 CFO 코멘터리(8-K 2026-11-17), NVIDIA 보도자료 | 추가 선택권은 10-Q "약 3.8GW", 보도자료 "3.75 IT-GW". 2026-10-25 기준 보증 지급 0 |
| nvda-sbenergy-equity | NVIDIA 보도자료 | 15억 달러 |
| amzn-openai-equity | AMZN 10-Q(2026-09-30) Note 2, Amazon 발표 | 150+137+213=500억 달러 전액 집행 |
| openai-aws-38bn | Amazon 발표(2025-11-03) | 7년 |
| openai-aws-100bn-expansion | AMZN 10-Q Note 1, Amazon 발표 | Axios 등 일부 보도는 "1,380억 달러 칩·하드웨어"로 합산 표기 |
| softbank-openai-followon | SoftBank 보도자료 2026-02-27, 2026-10-01 | 누적 646억 달러, 약 13% |
| msft-openai-equity | MSFT 10-Q(2026-09-30), MS 블로그 2025-10-28 | 지분 27%(2025-10) → 약 24%(2026-09). 약정 130억 중 120억 집행 |
| openai-azure-250bn | MS 블로그 | |
| openai-oracle-cloud | The Decoder(WSJ 인용) | 오라클 10-K(FY26)·10-Q(2026-08-31)·투자자의 날 8-K 모두 OpenAI를 이름으로 밝히지 않음(RPO 6,380억→6,640억 달러만). 회사 확인 없음 → report |
| openai-amd-6gw / amd-openai-warrant | AMD 뉴스룸, AMD 10-Q(2026-09-26) | 10-Q는 OpenAI 워런트가 여전히 발행 상태임만 언급. 첫 1GW 가동·워런트 확정 여부는 미확인 |
| openai-avgo-10gw | 브로드컴 보도자료(MarketScreener 재게재) | 브로드컴 IR 사이트 403. 텀시트 단계, 본계약·8-K 확인 못함 |
| openai-crwv-22bn | CoreWeave 보도자료 | 누적 상한 |
| openai-cbrs-750mw / openai-cbrs-loan | CBRS 10-Q(2026-06-30) | 발표일 2026-01-14는 세레브라스 블로그·Bloomberg 검색 결과로 확인, 기본계약은 10-Q상 2025-12. 보도된 "100억 달러 이상"은 회사 미확인이라 싣지 않고 GW로 기록 |
| nvda-crwv-capacity-backstop | CRWV 8-K(2025-09-09) | 잔여 용량 매입 의무 |
| nvda-crwv-equity | CRWV 8-K(2026-01-23) | |
| meta-crwv-14bn | CRWV 8-K(2025-09-25) | |
| meta-crwv-21bn | CoreWeave 보도자료 | 8-K는 찾지 않음. 페이지 구조화 데이터 날짜(2026-09-22)는 본문 날짜(2026-04-09)와 다름 |
| msft-nbis-17bn | NBIS 6-K | |
| meta-nbis-3bn / meta-nbis-27bn | NBIS 6-K 2건 | 270억 중 확정 120억, 나머지는 미판매분 매입 의무 |
| msft-iren-9bn | IREN 8-K, 10-K(FY26) | |
| nvda-intc-equity | INTC 8-K 2건 | 계약 2025-09-15, 완료 2025-12-26 |
| googl-wulf-fluidstack-backstop | WULF 8-K + Ex.99.1(2025-08-18) | 최초 보증 18억 → 32억 달러 |
| googl-cifr-fluidstack-backstop | CIFR 8-K + Ex.99.1 | |
| googl-hut-fluidstack-backstop | HUT 8-K + Ex.99.1 | 보증 한도 수치 없음, 대상 임대 총액만 공시 |
| googl-wulf-anthropic-backstop | WULF 8-K + Ex.99.1(2026-11-04) | 보증 한도 수치 없음 |
| owl-meta-hyperion-jv | Meta 보도자료, META 10-Q | 10-Q는 블루아울을 이름으로 밝히지 않음. 10-Q상 두 JV(루이지애나·텍사스) 합산 최대 잔존가치보증 414.9억 달러, 텍사스 JV(140억 달러, 2026-07) 상대방은 미확인이라 엔트리로 넣지 않음 |
| anthropic-* (googl/amzn/msft/spcx/avgo/amd/nscale/lambda), avgo-anthropic-notes, googl/nvda-anthropic-equity | Anthropic S-1/A 3차(2026-11-17) 본문 | S-1 초판(2026-10-26)은 대조하지 않음. MSFT 약정은 2025-11 발표 300억 → 공시 472억~492억 달러 |
| amzn-anthropic-equity | AMZN 10-Q, Anthropic 발표 2026-04-20 | 80+50+50=180억 집행, 잔여 한도 150억 |
| msft-anthropic-equity | MS 블로그, Anthropic 시리즈 G 발표 | 집행액 미공시 |

## 넣지 않은 건

| 건 | 이유 |
|---|---|
| 엔비디아→오픈AI "최대 1,000억 달러" 의향서(2025-09-22) | 2026-02 300억 달러 지분 투자로 대체됐다는 보도(CNBC, WSJ 인용)만 있고, 의향서 자체의 공식 종료 공시는 확인 못함. 겹치는 금액이라 300억 엔트리만 둔다 |
| 엔비디아→오픈AI "최대 2,500억 달러 백스톱" 협의(2026-07 CNBC) | 협의 보도. 실제 체결은 1,050억 달러 보증으로 정리됨 |
| 엔비디아→xAI 지분(2026-01 시리즈 E) | 보도마다 20억/100억 달러로 다름. 엔비디아 공시에서 금액 확인 못함 |
| 엔비디아→그록 기술 라이선스 | 회사는 금액 미공시(약 200억 달러는 보도). NVDA 10-Q는 지급액만(상반기 29.4억 달러) 나옴. 투자·공급 순환과 직접 연결되지 않아 제외 |
| 코어위브→앤트로픽 계약(2026-04-10) | 금액 미공시 |
| 앤트로픽→플루이드스택 500억 달러(2025-11-12) | 앤트로픽의 "미국 인프라 투자" 총액으로, 플루이드스택에 대한 지급 약정액이 아님. 대신 구글이 보증한 플루이드스택 임대 3건을 넣음 |
| 오라클 대출·데이터센터 개발사 부채(밴티지 등) | 보도 위주, 금액 출처마다 다름 |
| 스타게이트 LLC 지분 구조(오픈AI·소프트뱅크·오라클·MGX) | 출자 금액을 1차 출처로 확인 못함 |
| 브로드컴 "Project North Star" 630억 달러 금융 | 단일 출처, 날짜 불일치 |
| 앤트로픽 상장 동시 사모 중 AMD 25억·브로드컴·마이크론·MS 각 10억·TSMC 5억 | 엔비디아 엔트리 `what`에 함께 적고 별도 엔트리는 만들지 않음(상장 조건부, 노드 과다) |
| 삼성전자·SK하이닉스–오픈AI 메모리 의향서 | 비구속 의향서, 미국 티커 없음 |
| 앤트로픽 데이터센터 직접 임차(미개시 임대 4,512억 달러) | 상대방별 내역 없음 |

## 관찰한 맥락(엔트리 아님)

- 엔비디아 8-K(2026-11-12)는 CEO 교체 발표이고, Q3 FY27 실적 자료는 Colette Kress를 임시 CEO로 표기한다. 이사회 독립위원회 조사도 언급한다. 이번 엔트리 사실관계에는 영향이 없다.
- 엔비디아 Q3 FY27 약정표(2026-10-25): 공급·용량 3,900억, 클라우드 서비스 280억, 미개시 데이터센터 임대 740억, 지분 투자 약정 200억 달러.
- 앤트로픽 상장: 공모가 범위 70~78달러, 11-18 가격 결정 예정이라는 보도가 있음. 확정 공모가는 미확인.
