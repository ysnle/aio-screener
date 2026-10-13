// v57.51 screener data audit records (P1704-P1716). Writes one entry file per fix for scripts/record-fix.mjs.
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const note = 'v57.51 스크리너 데이터 품질·원천·커버리지 전수 점검(F01–F23·V01–V24·N01–N24) 반영(P1704~P1716).';
const base = { version: 'v57.51', date: '2026-10-13', r: null, status: null, note, qa_section: '검증 스킬' };
const entries = [
  { id: 1704, title: '한국 종가가 거래소 종가와 달랐고(마감 동시호가 미반영) 공급자 결측 세션(10/12) 때문에 한국 179행 전체가 한 세션 뒤처짐',
    symptom: '005930 10/08 종가 262,000(거래소 263,000), 000660 1,681,000(1,686,000) 등 최근 한 달에 1~2% 차이가 몰림. Yahoo KRX 10/12 봉이 close null이라 산출 시각 기준 마지막 완료 세션 10/12 대신 전 행이 10-08에 머묾. 06:41Z 크론은 한국 마감 판정(06:45Z) 직전이라 당일 봉을 항상 버림.',
    root_cause: 'fetch-data는 Yahoo KRX 일봉 종가를 그대로 종가로 썼고 null 종가 봉은 건너뛰기만 했다. 교차 원천이 없었다.',
    fix: '한국 행의 1년 일봉 종가를 거래소 종가 재배포 원천(공개 참고용 2차 원천, 공식 KRX 아님)으로 교정하고 결측 세션을 채운다. 조정 종가는 Yahoo 조정/원시 비율을 교정 종가에 곱해 낸다. 기준 불일치(분할 의심)는 거부, 원천 실패 시 연속 8회 차단기 뒤 기존 값과 providerMissingSessions를 남긴다. 행 closeReconciliation·산출물 krCloseReconciliation·로그 한 줄 기록. refresh-screener 크론 :41→:53.',
    violated_rule: '종가 기준 — 공급자 종가를 거래소 종가와 대조 없이 사용', prevention: 'P1704: ci-data-pipeline-contract-check(parseKrDailySeries·reconcileKrExchangeCloses fixture)·ci-operations-slo(크론 분)', verification: '캡처한 Yahoo 응답+단발 거래소 종가 조회로 005930 10/08 263,000 교정, 10/12 251,000 채움, 배당 비율 유지, 2:1 불일치 거부 확인.' },
  { id: 1705, title: '도쿄·대만 상장 4종목이 USD·뉴욕 시간으로 기록돼 통화·세션·거래대금이 틀리고 미국 시장 폭·순위 모집단에 섞임',
    symptom: '8035.T ema8 12,235 "USD", 285A.T 30일 거래대금 1.27조 "USD", 8035.T 10/09 봉이 세션 10-08로 표기돼 ret1d가 하루 밀림(2.09 대 -2.48). breadth us 구간 813 = 미국 809 + 4.',
    root_cause: '생산자는 .KS/.KQ가 아니면 USD·America/New_York으로 보았고 시장 구분이 US/KR 두 갈래뿐이었다.',
    fix: '접미사로 INTL 상장시장·현지 시간대·통화(JPY/TWD)를 판정하고 현지 마감(도쿄 15:45, 대만 13:45)으로 세션 완결을 판단한다. 시장 폭 us 구간·이력에서 제외(all만 유지), 팩터 순위 모집단에서 제외(목록 표시는 유지), 신선도는 현지 시간대 기준.',
    violated_rule: '종가 기준 — 통화·세션 기준을 행마다 선언', prevention: 'P1705: ci-market-session-contract-check·ci-data-pipeline(INTL 세션)·ci-screener-market-fixture', verification: 'node 재현: JPY/TWD, 도쿄 봉 10/13, 미국 세션 날짜 불변, 07:00Z 완료/06:00Z 미완.' },
  { id: 1706, title: '섹터 ETF 11개와 IWM·DIA가 주식으로 집계되고, ETF·원자재 신탁에 SEC 재무가 붙음',
    symptom: 'XLB~XLY(index ETF, sector 업종명)와 IWM·DIA(sector Financials)가 시장 폭·섹터 집계에 주식으로 포함. USO margin 115, SLV 매출 음수.',
    root_cause: 'assetType 판정이 sector===\'ETF\'만 보았고 SEC 병합에 ETF 제외가 없었다.',
    fix: 'screenerAssetType이 index·sector·이름 패턴(SPDR/ETF/Trust)과 명시 목록을 함께 본다(57개 ETF). SEC 수집·저장 레코드·병합에서 ETF 제외. IWM·DIA sector를 ETF로 정정.',
    violated_rule: '원천 없는 값 금지 — ETF에는 발행사 재무가 없음', prevention: 'P1706: ci-data-pipeline(assetType 판정)·ci-sec-runtime-projection-check(ETF 정리)', verification: '57개 ETF 판정, NTRS·NFLX 주식 유지, 병합 fixture에서 USO·SLV 0건.' },
  { id: 1707, title: 'SEC 발행주식 수가 2009년 값이거나 1000배인 종목이 PER·참고 시가총액·밸류 순위를 왜곡',
    symptom: 'V는 2009-11 주식수로 PER 9.13·참고 시총 $183B, MA PER 4.39, CMCSA 2.13 등 약 20종목이 밸류 점수 포화. PKG PER 26,255·PBR 4,420(10-K 표지 주식수 1000배). GOOGL·META는 주식수 null. 참고 시총은 순이익>0일 때만 생겨 미국 41% 결측.',
    root_cause: 'closestEnd(...)||shares[0]에 나이 제한이 없었고, 저장 레코드 494건에 sharesCheck가 없어 병합 시 재검사가 없었다.',
    fix: '주식수 후보를 표지(회계연도 말 ±400일)→같은 연도 가중 희석→CommonStockSharesOutstanding 순으로 고르고 없으면 stale-period 보류. 병합은 sharesCheck consistent 또는 30일 거래대금 회전율 0.05~20% 통과만 사용. 이전 정규화 레코드는 재수집 대상. 참고 시총은 검증된 주식수×종가(valuationPrice)로 손실 기업까지 산출.',
    violated_rule: '근거 없는 값 금지 — 기간이 다른 주식수와 현재 가격 혼합', prevention: 'P1707: ci-sec-runtime-projection-check(heal 멱등)·ci-entity-summary-fixture·ci-domain-parity-check', verification: 'MA 가중 희석 9.06억 주(SEC 원천 확인) → PER 33.9, V 보류, PKG fixture PER 26.45, GOOGL 122.3억·META 25.74억 주.' },
  { id: 1708, title: '리츠·금융의 매출 계정을 소계로 잡아 순이익률 7,491%·성장률 부호 반전, 극단 비율이 표시 없이 노출',
    symptom: 'ESS 매출 938만(SEC Revenues 18.87억) → 순이익률 7,491%, 성장률 -8.6%(실제 +6.4%). 순이익>매출 41건(AMT, AVB, CPT, EXR, UDR, SBAC, CCI, HIG, MET 등). XOM·VLO 재무 공백. LSCC PER 5,448, CL ROE 3,948%, JOBY 성장률 39,183%가 그대로 표시. 품질 라벨 624행 전부 CURRENT.',
    root_cause: 'ASC606 고객계약 매출 계정이 Revenues보다 우선했고 IncludingAssessedTax 계정이 없었다. 극단값 플래그·보고서 나이 판정이 없었다.',
    fix: '같은 기간에 더 큰 Revenues가 있으면 그것을 쓰고(생산자·heal·projection 공용 bestRevenueRowsByPeriod), 순이익률 100% 초과는 보류. IncludingAssessedTax 추가(개념 세트 v3). PER>1000·|ROE|>200%·성장률>1000%에 \'의미 낮음/일회성 가능\' 플래그(순위는 기존 윈저화). 품질 상태는 회계연도 말 나이 456일로 판정하고 화면에 \'연간(FY) 기준\' 표기.',
    violated_rule: '근거 없는 등급 금지', prevention: 'P1708: ci-sec-runtime-projection-check·ci-entity-summary-fixture·ci-esm-core-unit-check', verification: 'ESS 18.87억·순이익률 37.2%, AMT 106억, VLO 1,226.87억(SEC 원천 일치), 저장 레코드 매출 60건 교정·순이익률 5건 보류.' },
  { id: 1709, title: '종목 뉴스 메모의 약 20%가 다른 회사 기사였고 90종목 고정 수집이라 나머지는 늘 비어 있었으며, 미검증 메모가 AI와 검색에 들어감',
    symptom: '180건 중 36건 오매칭: MA←MA Financial, DE←Edel SE, LOW←"12-Year Low", BROS←Warner Bros, NOW←"Microsoft Now Has". 989종목 중 90종목(한국 0)만 메모. 날짜 UTC, 제목에 출처 중복, MarketBeat 템플릿 기사·같은 사건 중복. 근거 셀은 비대상 899종목도 \'근거 미수신\'.',
    root_cause: '"<SYM> stock when:3d" 쿼리 최신 2건을 발행 주체 확인 없이 채택했고, 대상이 .slice(0,90) 고정이었다.',
    fix: '쿼리를 회사명 기반으로 바꾸고 제목에 회사명·(SYM)·:SYM·$SYM이 있는 기사만 채택(없으면 비움). 상위 10 고정+80 순환(6시간 슬롯), 검증 메모만 3일 유지. 저품질·비기사·중복 필터, KST 날짜, 제목/출처 분리. AI 프롬프트는 검증 메모만, 검색 haystack에서 제외, 근거 셀은 순환 대기/수신 실패/확인된 기사 없음/수집 대상 아님 구분. 레지스트리 LOW 별칭 \'low\' 제거.',
    violated_rule: '티커 추정 금지 — 발행 주체 미확인 기사를 종목 근거로 사용', prevention: 'P1709: ci-data-pipeline-contract-check(N01·N04·N05·N09·N10·N21 블록)', verification: '오매칭 7건 배제, DE·V·NOW 단발 조회에서 본인 기사 채택, 768종목 fixture 10회 내 전수 순환.' },
  { id: 1710, title: '시장 뉴스 40칸이 같은 주제 의역 기사와 CFD 브로커 마케팅 글로 채워지고 출처에 URL이 그대로 표기',
    symptom: '사우디·유가 7~8건, 40건 중 30건 tier3, TMGM·VT Markets·Invezz 등 브로커 글, "How Fortunes Are Made" 낚시 제목, source에 https://… 원문.',
    root_cause: '주제별 상한·브로커 도메인 목록·낚시 패턴·출처 정규화가 없었다.',
    fix: '핵심 개체 쌍 2건·단일 개체 4건(지수 마감 3건) 상한, CFD 브로커·템플릿 사이트를 저품질 목록에 추가, 낚시 정규식 확장, URL 출처는 호스트명만.',
    violated_rule: '뉴스는 큐레이션 — 원천 확대가 아니라 선별 품질', prevention: 'P1710: ci-data-pipeline-contract-check(N11·N12·N13)', verification: '현재 40건 재처리: 사우디·유가 7→2건, 브로커 7곳 tier4, 출처 호스트명화, 게시 하한 10건 유지(최악 14건).' },
  { id: 1711, title: '뉴스·텔레그램 발행 주체 판정이 일반 단어 회사명·분석 주체 은행·목록형 게시물·제품명 추론으로 오탐',
    symptom: 'block→XYZ, snap, Progressive, grab, 비자 발급→V, "Goldman raises oil forecast"→GS. 한국 약칭(하이닉스) 누락. 티커 6개 이상 목록 게시물이 TSM 110·NVDA 90 카운트를 부풀림. TPU→AVGO 같은 제품 추론이 발행 주체로 집계. 보관 요약 32건에 &#036; 잔존.',
    root_cause: 'stories.js는 한 단어 이름을 대소문자 무시로 매칭했고 증권사 발언 패턴 제외가 없었다. 텔레그램 집계는 게시물 유형을 구분하지 않았다.',
    fix: '일반 단어 이름 약 40개는 기업 단서(Inc/Corp/stock/shares/(SYM)) 필수, 한 단어 이름은 대문자 시작만. "<증권사>) ", "at <bank>", "<bank> raises/cuts/says"는 분석 주체로 제외. 한글 alt 2글자 초과 허용(엘지엔솔 추가). 6개 이상 목록 게시물은 listTickers로 분리, 제품 추론은 relatedTickers로 분리. 숫자 엔티티 재디코딩.',
    violated_rule: '티커 추정 금지', prevention: 'P1711: ci-reference-adoption-contract-check(N06·N07·N08)·ci-data-pipeline(N15·N16·P1544)', verification: '실데이터 381건 중 19건 교정, 은행 오탐 9건 제거, 목록 게시물 19건 분리(TSM 110→93), &#036; 34→0.' },
  { id: 1712, title: '실적 일정이 주말 UTC 실행에서 지난주를 조회하고 ASML·TSM 같은 대형주 누락을 알리지 않음',
    symptom: '토·일 실행이 지난주 창을 받음. 일정 119건 중 ASML·TSM 없음, 누락 여부 표시 없음.',
    root_cause: 'fetch-earnings-calendar가 UTC 요일로 이번 주 월요일을 계산했고 대형주 커버리지 대조가 없었다.',
    fix: '주말이면 다음 월요일, 평일이면 이번 주 월요일부터 +7일. S&P 500 비중 상위 30+ADR 중 목록에 없는 종목을 largeCapCoverage.unconfirmed로 발행하고 실적 달력 상태에 \'대형주 일정 미확인 N개\'(hover 목록)로 표시. 날짜는 추정하지 않음.',
    violated_rule: '원천 없는 값 금지 — 누락을 "발표 없음"으로 읽히게 두지 않음', prevention: 'P1712: ci-data-pipeline-contract-check(earningsCalendarWindow fixture)', verification: '토·일·월·금 fixture 모두 10-12~10-19, 현재 일정에서 ASML·TSM 포함 33개 미확인.' },
  { id: 1713, title: '유니버스 정합성: 상장폐지·티커 변경 종목 잔존, 코드-이름 불일치, GICS와 다른 섹터, 노후 지수 태그, 주식 클래스 이중 계산',
    symptom: 'WBD(10/6 인수 완료)·EA(8/4 비공개 전환)·012510.KQ(상장폐지) 잔존, PSKY→SKYD 미반영. 131970.KQ가 \'테크윙\'(실제 두산테스나), 950130.KQ \'엑시큐어\'(실제 엑세스바이오), 315640.KQ 뉴로메카(실제 딥노이드). GEV·WM·BE Utilities, DHR·STE Industrials 등 GICS와 다른 섹터 21건. NASDAQ100 태그 중 NDX 비구성 32행. GOOG/GOOGL·FOX/FOXA·NWS/NWSA 이중 계산.',
    root_cause: 'SCREENER_DB는 수기 큐레이션이고 공식 구성 목록과의 대조 절차가 없었다.',
    fix: 'IVV·NDX·IJH·IWM·KODEX PDF·KIND 목록 기준으로 삭제·교체·이름 정정, S&P 500 구성 종목 섹터를 GICS로 교정, 지수 태그 재계산(SP500 503·SP400·RUSSELL2000·NASDAQ100·ETF), 보조 클래스 shareClassOf 표시 후 시장 폭에서 한 번만 집계. 섹터 키 정규화 normalizeSectorKey 정본화. 이름 레지스트리·세부 테마·시세 구독·KR 매핑 감사 동기화.',
    violated_rule: '티커 추정 금지 — 공식 구성 목록 근거', prevention: 'P1713: ci-data-pipeline(미러 drift)·ci-runtime-contract-check(P1588·P1622 갱신)·ci-structural-check·ci-architecture-contract-check(1200행 성능)', verification: 'SP500 태그 = IVV 503, GICS 불일치 0, 테마 유니버스 밖 티커 0, sync-screener-universe 1143건.' },
  { id: 1714, title: '유니버스 커버리지 공백: 코스닥150 비중 50%·미국 중형주 91% 누락, 3종목 미만 하위 테마가 순위에서 제외',
    symptom: 'KOSDAQ150 39/149(비중 49.68% 누락), KOSPI200 113/199, S&P 400 37/408, Nasdaq-100 최대 종목 SPCX 누락, S&P 500 신규 TWLO·VYLR·SKYD 누락. 테스트·패키징·업무 자동화·의료 로봇 하위 테마가 1~2종목.',
    root_cause: '정적 유니버스에 편입 동기화가 없었다.',
    fix: 'KQ150 비중 상위 40·K200 상위 20·IJH 섹터별 상위 86·SPCX·TWLO·VYLR·SKYD·COHU·KLIC·APPN·PRCT 추가(993→1,143행). 테마: 테스트·패키징 +FORM·COHU·KLIC, 업무 자동화 +APPN·PEGA(PATH는 소프트웨어로 일원화), 의료 로봇 +PRCT·GMED, 휴머노이드는 산업 자동화로 병합. Russell 2000 표본 150은 대표성이 없어 보류.',
    violated_rule: '커버리지 — 대표 지수 대비 공백 명시', prevention: 'P1714: ci-runtime-contract-check(P1588 테마 규칙)·ci-architecture-contract-check(1200행 dispatch p95)', verification: '원자료 대조 스크립트 diff 0, 테마 규칙 위반 0. 수신 여부는 다음 refresh-screener에서 확인(QA-VERIFY-18).' },
  { id: 1715, title: '시장 폭이 관찰 목록 편향을 드러내지 않았고, 거래대금 정의·한국 거래대금·상대 거래량이 비어 있거나 틀림',
    symptom: 'us 구간 813행 중 IVV·IWM 밖 210행(ADR·투기 기술주)인데 S&P 500 기준 비교가 없음. 화면 문구는 \'주식과 ETF 혼합\'(실제는 ETF 제외). dollarVolume30d는 최근 종가×30일 평균 거래량. 한국 30일 거래대금 100% null. rvol20은 계약·\'돌파 관찰\' 프리셋에 있으나 생산자 없음(100% 결측). evEbitda도 생산자 없이 계약·커버리지 분모에 남음.',
    root_cause: '시장 폭 구간이 유니버스 하나뿐이었고, 거래대금 정의가 백테스트와 달랐으며, KRW 행은 환산 없이 버려졌다.',
    fix: 'sp500-weights 구성 종목만의 sp500 구간을 발행하고 시장 폭 화면 기준 문장에 같은 날짜일 때 \'S&P 500 구성 종목만 보면\' 한 줄 추가, 문구를 \'ETF 제외 개별 주식\'으로 정정. 거래대금은 일별 종가×거래량 30일 평균, 한국은 원화 tradedValue30d와 같은 날 usdkrw 환산 dollarVolume30d. rvol20 생산(직전 20세션 평균 대비, 차트 _calcRVOL 정의). evEbitda 계약·커버리지 분모에서 제거.',
    violated_rule: '원천 없는 필드 퇴역 / 분모 명시', prevention: 'P1715: ci-data-pipeline-contract-check(computeScreenerBreadth sp500·dailyNotionalAverage)·ci-screener-workbench-contract(price.rvol20)', verification: 'fixture: sp500 indexMembers 503, 교대 거래량 600(구 정의 1100), 환율 2배 fixture 정확히 절반.' },
  { id: 1716, title: '종목 화면에 최근 공시(8-K·10-Q·10-K) 경로가 없었음',
    symptom: '종목 소식은 뉴스 메모뿐이었고 SEC submissions를 이미 받으면서도 최근 공시를 쓰지 않았다.',
    root_cause: 'fetch-sec-fundamentals가 submissions를 재무 기준일에만 썼다.',
    fix: '수집 시점 30일 이내 8-K·10-Q·10-K 최대 5건(접수번호 형식 검증)을 압축 문자열로 발행하고, 종목 요약에 오늘 기준 30일 이내 것만 \'최근 공시\' 한 줄(8-K Item 한국어 이름표)과 원문 링크로 표시. 없으면 문장을 쓰지 않음.',
    violated_rule: '원천 근거 연결', prevention: 'P1716: ci-sec-runtime-projection-check·ci-entity-summary-fixture', verification: 'fixture에서 "10/9 8-K 실적 발표 · 10/1 10-Q 분기 보고서" 형식 확인. 실데이터는 다음 SEC 수집 뒤.' }
];
const qa = [{
  id: 'QA-VERIFY-18',
  text: 'P1704~P1716: refresh-screener 다음 실행 뒤 screener.json에서 krCloseReconciliation이 reconciled 위주이고 005930 factorSessionDate가 최신 한국 세션, 8035.T currency JPY, breadth.segments.sp500 표본 약 500, 신규 종목(SPCX·SKYD·VYLR) 수신, newsStatus·newsMemoVerified 존재, margin>100 행 0, rvol20 채움을 확인한다.',
  verify_by: 'push 뒤 refresh-screener 1회 실행 후 산출물 검사(로그 KR exchange close 한 줄 포함)',
  done: false
}];
entries.forEach((p, index) => {
  const changelog = [`**스크리너 데이터 점검 수정 (P${p.id}):** ${p.title}.`];
  const record = { ...base, p, qa: index === entries.length - 1 ? qa : [], changelog };
  writeFileSync(join(here, `record-p${p.id}.json`), `${JSON.stringify(record, null, 2)}\n`);
});
console.log(`wrote ${entries.length} records`);
