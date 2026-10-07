// P1505 (owner 2026-10-06): source names and URLs left the face of the screens. Each screen keeps one folded
// "데이터 출처" note at its end so a reader who needs to check a number — an institutional user in particular —
// can still find the provider and series. Dates stay on the numbers themselves; only the provider moves here.

const QUOTES = '지수·환율·원자재 시세: Yahoo Finance (지연 시세, 판정은 직전 미국장 종가)';
const NEWS = '뉴스: Google News가 모은 매체별 기사 (제목과 매체명만 표시, 본문은 원문 링크)';
const TELEGRAM = '텔레그램: 공개 채널 4곳의 요약 (각 글은 원문 링크)';
const FRED = '미국 금리·물가·고용: FRED(세인트루이스 연준), BLS, BEA, 미 재무부 공식 고시';
const SEC = '기업 재무: SEC EDGAR XBRL 공시 (연간 10-K, 분기 10-Q)';

export const PAGE_SOURCES = Object.freeze({
  home: [QUOTES, '시장 판정·어제와 달라진 점: 종가 기록으로 자체 계산', '일정: BLS·BEA·연준 공식 일정과 거래소 규칙(만기·휴장)', NEWS],
  briefing: [QUOTES, FRED, '하이일드 스프레드: ICE BofA OAS (FRED)', '일정: BLS·BEA·연준 공식 일정과 거래소 규칙(만기·휴장)'],
  'market-news': [NEWS, TELEGRAM],
  signal: ['추세·시장 폭: S&P 500·나스닥 종가와 스크리너 유니버스 수정 종가로 자체 계산', '변동성: VIX·VIX3M (Cboe)', '금리: 미 재무부 국채 수익률 (FRED DGS2·DGS10)', '신용: ICE BofA 하이일드 OAS (FRED) · CNN Fear & Greed', '달러·원자재·환율: Yahoo Finance', '기관 포지셔닝: CFTC Traders in Financial Futures (선물, 주간)'],
  macro: [FRED, 'ISM 제조업·서비스업 지수: ISM', '정책금리·회의 일정: 연방준비제도 FOMC'],
  fxbond: ['국채 수익률 곡선: 미 재무부 일별 par curve', '금리차·실질금리·기대인플레이션·기간 프리미엄: FRED (T10Y3M, DFII10, T10YIE, THREEFYTP10)', '하이일드 스프레드: ICE BofA OAS (FRED)', '환율·달러 인덱스: Yahoo Finance'],
  themes: ['섹터·테마 ETF와 종목 일봉: Yahoo Finance (상대강도는 자체 계산)'],
  ticker: ['가격·차트: Yahoo Finance 일봉', SEC, '팩터 점수: 스크리너와 같은 자체 계산'],
  fundamental: [SEC],
  screener: ['가격 팩터(수익률·추세·변동성): Yahoo Finance 수정 종가로 자체 계산', SEC, '종목별 원시 가격은 공개 데이터에 싣지 않습니다'],
  portfolio: ['보유 내역: 이 브라우저에 저장된 사용자 입력', QUOTES],
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
