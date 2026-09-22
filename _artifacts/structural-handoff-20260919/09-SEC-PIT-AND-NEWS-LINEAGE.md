# 09 — 재무 시점·단위와 뉴스 근거 보존

> 역사 근거 주의: F01/F02의 오래된 FY와 늦은 operand 합성 반증은 [v56 재검증](RECHECK-V56.md)에서 차단됐다. 다른 재무 정의·뉴스 lineage·실제 과거 정보집합의 전체 검증은 남아 있다. 아래를 현재 미수정 목록으로 그대로 사용하지 않는다.

Astra 설계 · Luna MAX 조사 + Astra 합성 검증 · 2026-09-20 / v55.22 / `54428470`.

## F01 / W09-A — 수집 시각과 회계자료 현재성을 분리

`scripts/fetch-sec-fundamentals.mjs`의 annualDurationRows는 FY/기간길이/form을 필터하나 최신 period의 최대 나이는 판단하지 않는다. normalizeSecCompanyFacts는 과거 period여도 accession의 acceptedAt이 있으면 quality CURRENT/stale=false와 현재 fetchedAt을 부여한다. `scripts/fetch-data.mjs:2453–2500`의 enrichSecFundamentals도 fetchedAt 45일과 availability 존재를 사용한다.

저장소 9/19 산출물에서 AEM periodEnd2009-12-31과 CURRENT 라벨이 공존함을 Luna가 확인했다. 최신 조회·실제 거래일 증거가 아니라 해당 저장 산출물의 사실이다. downstream factor/field freshness가 오래된 availability를 막을 수 있으므로 AEM이 실제 순위에 편입됐다고 단정하지 않는다.

설계: fetchedAt, fiscalStart/end, filedAt, acceptedAt, availableAt, calculationAt을 분리한다. transport freshness, report recency, operand coherence, calculation eligibility도 독립 상태다. 공시가 지금 도착했다는 사실만으로 오래된 FY를 최신 재무로 표시하지 않는다. FY/TTM/quarter의 최신성 정책은 공시 주기·발행사 capability별로 정의하고 미지원 IFRS/통화를 결측0으로 바꾸지 않는다.

coverage는 CIK 매칭/수집 저장/비교 가능한 기간/필수 값/현재 사용 가능을 따로 센다. SEC562/655와 mixed560/728은 서로 다른 분모이며 수치 차이 자체는 버그가 아니다. mixed coverage는 FMP TTM과 SEC FY 중 하나라도 값이 있는 비율이므로 동일기간 full financial coverage라는 이름으로 쓰지 않는다.

인수: 최근 수집+오래된 FY, 최신 FY+accepted시각없음, 정정공시, 다른 결산월, 비USD/IFRS 미지원, FY/TTM 혼합. 유효0과 missing 구별을 유지한다.

## F02 / W09-B — 파생 재무지표의 가용시각은 모든 피연산자를 따른다

normalizeSecCompanyFacts는 매출·순익·자본·주식수를 따로 선택하지만 최상위 availableAt/accession은 매출 filing에서만 가져온다. root 합성 반증: revenue는2024-02-01 공개, 같은 FY의 수정 income/equity/shares는2024-06-01 공개. 반환 margin20/ROE40/P-E5의 record availableAt은 여전히2024-02-01이고 quality CURRENT였다. [실행 증거](sec-availability.json).

이는 파생값이 2월 당시 재현 가능했다는 잘못된 provenance다. 실제 과거 포트폴리오 실행에서 사용됐는지까지 입증한 것은 아니다. 기존 buildPointInTimeFacts가 개별 accession/acceptedAt을 보존하는 기반을 활용한다.

설계: fact는 concept/taxonomy/unit/periodStart/end/value/accession/availableAt를 가진다. derived metric은 operandIds, formulaVersion, periodBasis, unit, effectiveAvailableAt을 가진다. 해당 시점 T의 PIT 계산은 먼저 availableAt≤T인 fact만 선택하고 정정 이력을 반영한다. 선택된 operand의 가장 늦은 availability 이전에 파생값이 사용되지 못하게 한다. filing 날짜만 있는 경우 intraday 정밀도를 발명하지 않고 보수적 availability 정책을 기록한다.

ROE의 기말자본/평균자본, PE의 FY/TTM 순익, 기본/희석·가중평균/발행주식수, 지배/비지배지분 정의를 명시한다. 이 선택들은 동일한 이름 아래 섞을 수 없다. 현재 기말 equity 기반 ROE가 수학적 오류라는 뜻은 아니며, 명칭·비교집단·정의가 맞아야 한다. 은행/보험 등 산업별 비교 가능성 검토는 후속이다.

현재 가격×오래된 shares와 과거 income을 연결하는 경우 가격 시각·share corporate action 기준·통화를 함께 검증한다. adjusted total-return 가격을 시장가치 계산용 원시 가격으로 임의 대체하지 않는다. 현재 수집 경로의 구체적 기업행동별 왜곡 크기는 아직 계산하지 않았다.

인수: 수정공시 전/후 replay, 다른 accession의 같은 period, shares의 다른 period fallback, 여러 unit의 같은 concept, 음수 earnings/equity, dividend/split fixture. 미래 operand가 하나라도 들어가면 과거 계산은 fail-closed 한다. 수정 이후의 정상 새 결과는 별도 revision으로 재현 가능해야 한다.

## F03 / W09-C — 뉴스 제목에서 원문으로 추적 가능하게

시장뉴스는 title/link/publisher/pubDate와 headline-only 경계를 보존한다. 반면 ticker `_fmtTickerNewsMemo`/`_enrichTickerNews`는 최신2건을 문자열로 합쳐 개별 링크·정확한 시각을 잃는다. screener는 이를70자로 자른다. 두 경로의 provenance가 다르다.

설계: ticker news도 items[]에 id/title/url/publisher/publishedAt/collectedAt/contentDepth를 보존하고 memo는 표시 전용 파생값으로 만든다. screener 짧은 문구에서 전체 제목·원문·절대시각으로 연결한다. headline-only로 본문 원인/사실을 확인했다고 표시하지 않는다. 출판 시각을 실제 사건 발생 시각으로 무조건 동일시하지 않는다.

추가 표시 결함: `src/ui/pages/news.js:105`는 getAbsoluteTime을 호출하지만 Luna 검색에서 구현을 찾지 못했고 fallback은 빈 문자열이다. 상대시간과 함께 절대시각·timezone을 표시하는 한 formatting owner로 정리한다. 여러 브라우저 locale/timezone에서 출력 및 원문 링크를 인수한다. 실제 UI 재현과 timezone 검증은 아직 하지 않았다.

## 외부 비교 기준

[SEC EDGAR API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces)는 company facts의 concept별 unit 구조와 filings 갱신 경로를 설명한다. 이를 기준으로 unit/accession/availability 보존을 검토했다. 이 문서는 SEC 원자료 자체가 AIO 파생식의 적절성을 보증한다는 주장을 하지 않는다.
