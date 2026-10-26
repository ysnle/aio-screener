// P1505 (owner 2026-10-06): source names and URLs left the face of the screens. Each screen keeps one folded
// "데이터 출처" note at its end so a reader who needs to check a number — an institutional user in particular —
// can still find the provider and series. Dates stay on the numbers themselves; only the provider moves here.

const QUOTES = '지수·환율·원자재 시세: Yahoo Finance (지연 시세, 판정은 직전 미국장 종가)';
const NEWS = '뉴스: Google News가 모은 매체별 기사 (제목과 매체명만 표시, 본문은 원문 링크)';
const TELEGRAM = '텔레그램: 공개 채널 4곳의 요약 (각 글은 원문 링크)';
const FRED = '미국 금리·물가·고용: FRED(세인트루이스 연준), BLS, BEA, 미 재무부 공식 고시';
const SEC = '기업 재무: SEC EDGAR XBRL 공시 (연간 10-K, 분기 10-Q)';
// v58.80 run-5 (skeptic #8): 재무 공시 also shows consensus EPS, Forward PER and the 4-week revisions; their provider was not listed.
const CONSENSUS = '컨센서스 EPS·Forward PER·최근 4주 추정치 상향·하향: Nasdaq 공개 실적 전망(Zacks 컨센서스, 조정 EPS 기준, 점수에 쓰지 않는 참고값)';

export const PAGE_SOURCES = Object.freeze({
  home: [QUOTES, '시장 판정·지난 마감 이후 변화: 종가 기록으로 자체 계산', '일정: BLS·BEA·연준 공식 일정과 거래소 규칙(만기·휴장)', NEWS],
  briefing: [QUOTES, FRED, '하이일드 스프레드: ICE BofA OAS (FRED)', '일정: BLS·BEA·연준 공식 일정과 거래소 규칙(만기·휴장)'],
  'market-news': [NEWS, TELEGRAM],
  // v57.77: the two screens that kept providers only in card hovers (unreachable on a phone).
  breadth: [
    '시장 폭 지표: 스크리너 유니버스(미국 개별 주식, ETF 제외)의 수정 종가로 자체 계산, 종목마다 같은 무게로 세며 거래소 전체 집계가 아닙니다',
    '정의 관례: 40일선 위 종목 비율은 Worden T2108 계열 지표와 같은 정의, 분배일은 윌리엄 오닐의 관례',
    'S&P 500 지수: Yahoo Finance 일봉'
  ],
  sentiment: [
    '공포·탐욕 지수: CNN Fear & Greed Index',
    '변동성 구조: Cboe VIX·VIX3M 일별 종가 (Yahoo Finance)',
    '풋/콜 비율: Cboe 일별 시장 통계 (전체 옵션)',
    '고위험 회사채 금리차: ICE BofA 하이일드 OAS (FRED)',
    'AAII 개인 설문: 미국 개인투자자협회(AAII) 주간 설문, 장기 평균은 AAII 공표값(1987년 이후)',
    '공포·탐욕 구성 요소 순위: 위 공개 자료로 자체 계산'
  ],
  signal: ['추세·시장 폭: S&P 500·나스닥 종가와 스크리너 유니버스 수정 종가로 자체 계산', '변동성: VIX·VIX3M (Cboe)', '금리: 미 재무부 국채 수익률 (FRED DGS2·DGS10)', '신용: ICE BofA 하이일드 OAS (FRED), CNN Fear & Greed', '달러·원자재·환율: Yahoo Finance'],
  macro: [FRED, 'ISM 제조업·서비스업 지수: ISM', '정책금리·회의 일정: 연방준비제도 FOMC', '한국 기준금리·환율: 한국은행 경제통계시스템(ECOS)', '한국 물가·경기: 국가통계포털(KOSIS)'],
  fxbond: ['국채 수익률 곡선: 미 재무부 일별 par curve', '1개월 전 곡선: FRED H.15 국채 고정만기 금리 (DGS2·DGS5·DGS10·DGS20·DGS30)', '금리차·실질금리·기대인플레이션·기간 프리미엄: FRED (T10Y3M, DFII10, T10YIE, THREEFYTP10)', '하이일드 스프레드: ICE BofA OAS (FRED)', '환율·달러 인덱스: Yahoo Finance'],
  themes: [
    '섹터·테마 ETF와 종목 일봉: Yahoo Finance (상대강도는 자체 계산)',
    'S&P 500 지도 넓이: iShares IVV 일별 보유 비중(지수 비중 근사), 기간 수익률은 기간 시작 비중으로 역산',
    '지수 이익 전망: Nasdaq·Zacks 컨센서스(조정 EPS), iShares IVV 보유 비중, 실질금리 FRED DFII10',
    'AI 설비투자 배분: BNP Paribas 추정(2026-08), a16z State of Markets II(2026-09-30) 인용, 부품 납기: TrendForce(2026-09-14)'
  ],
  // v58.74 (text audit): one fold serves 미국 and 한국 tickers, so each line names the market it applies to.
  ticker: ['가격·차트: Yahoo Finance 일봉', '기업 재무: 미국 종목은 SEC EDGAR XBRL 공시(연간 10-K, 분기 10-Q), 한국 종목은 DART 사업보고서', CONSENSUS, '팩터 점수: 스크리너와 같은 자체 계산', '랭킹 대상 밖 미국 종목: Nasdaq Trader 상장 목록으로 확인, 요청 시 같은 공식으로 계산(공개 순위 미포함)'],
  // v57.81: the 한국 시장 fold is shown to everyone, so the chart screen names its sources too.
  technical: ['종목 차트: Yahoo Finance 일봉', '코스피·코스닥 종가: Yahoo Finance 일봉(마감된 한국 거래일), 50일선·200일선·1년 고저는 자체 계산'],
  fundamental: [SEC, CONSENSUS],
  screener: ['가격 팩터(수익률·추세·변동성): Yahoo Finance 수정 종가로 자체 계산', SEC, '종목별 원시 가격은 공개 데이터에 싣지 않습니다'],
  portfolio: ['보유 내역·통화별 현금: 이 브라우저에 저장된 사용자 입력', QUOTES, '현금 합계 환산: 앱이 게시한 원/달러 직전 종가(Yahoo Finance KRW=X 일봉) 또는 사용자가 선언한 환율'],
  masters: ['13F·13D/13G: SEC EDGAR 공시 원문', '운용 규모: 각 운용사 공식 자료'],
  principles: ['각 노트의 근거와 가정은 본문의 "근거와 가정 보기"에 있습니다'],
  atlas: ['각 분야의 근거는 본문의 "근거와 가정 보기"에 있습니다']
});

export function renderPageSources(doc, routeId) {
  const page = doc?.getElementById?.(`page-${routeId}`);
  const rows = PAGE_SOURCES[routeId];
  if (!page || !rows) return null;
  let fold = page.querySelector(':scope > details.page-sources');
  if (fold) return fold;
  fold = doc.createElement('details');
  fold.className = 'page-sources';
  const summary = doc.createElement('summary');
  summary.textContent = '데이터 출처';
  const list = doc.createElement('ul');
  for (const row of rows) {
    const item = doc.createElement('li');
    item.textContent = row;
    list.append(item);
  }
  fold.append(summary, list);
  page.append(fold);
  return fold;
}
