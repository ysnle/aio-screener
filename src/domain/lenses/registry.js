// v59.70 (owner 2026-11-07, "어떤 데이터로 어떤 생각을 바탕으로 어떤 관점을 주는지"): the market lenses the screens read
// through, in one place. Each lens names the question it answers, the reading it encodes, the data behind it, what it
// cannot tell (the limits the X-bookmark review set — _artifacts/x-bookmarks-20261105/CLAUDE-RESPONSE-20261107.md), and
// the screen where its evidence lives. `measure` reads the loaded artifacts and returns the basis date and the coverage
// actually behind the reading today (N of M, a stale input, a missing market), so a screen states its own reach instead
// of implying a complete market. Pure: the browser adapter (src/ui/components/page-sources.js) gathers the inputs.
import { readNumber } from '../shared/number.js';
import { readRowNumber } from '../../data/contracts/screener.js';

const DAY = 86400000;
const md = (iso) => { const m = /^\d{4}-(\d\d)-(\d\d)/.exec(String(iso || '')); return m ? `${Number(m[1])}/${Number(m[2])}` : null; };

/** The last session a history field was observed on (a carried row names the earlier session in fieldMeta). */
export function historyFieldLast(history, field) {
  const rows = Array.isArray(history) ? history : [];
  for (let i = rows.length - 1; i >= 0; i -= 1) {
    const row = rows[i];
    if (readNumber(row?.[field]) === null) continue;
    return { date: String(row.fieldMeta?.[field]?.sessionDate || row.date || '').slice(0, 10), count: rows.filter((r) => readNumber(r?.[field]) !== null).length };
  }
  return null;
}
const macroLast = (macroHistory, id) => {
  const obs = macroHistory?.series?.[id]?.observations || [];
  const last = obs.at(-1);
  return last ? { date: String(last[0]).slice(0, 10), count: obs.length } : null;
};
const sessionsBehind = (date, nowMs) => (date ? Math.floor((nowMs - Date.parse(`${date}T21:00:00Z`)) / DAY) : null);
const share = (rows, test) => ({ covered: rows.filter(test).length, total: rows.length });
const usRows = (rows) => (rows || []).filter((row) => row?.market === 'US');
const krRows = (rows) => (rows || []).filter((row) => row?.market === 'KR');

// A daily input more than STALE_DAYS calendar days behind the newest close is named as late on the lens.
const STALE_DAYS = 5;

export const LENSES = Object.freeze([
  {
    id: 'trend', label: '추세', home: 'charts',
    question: '지수가 중기 평균선 위에서 움직이나',
    reading: 'S&P 500·나스닥 100의 50일선·200일선 위치와 거리. 판정은 직전 미국 정규장 종가 기준이다.',
    data: ['S&P 500·나스닥 100 일별 종가'],
    limits: ['평균선 위치는 방향을 말하지 속도나 끝을 말하지 않는다.'],
    measure: ({ history }) => { const spx = historyFieldLast(history, 'spx'); return spx ? { asOf: spx.date, scope: `S&P 500 종가 ${spx.count}거래일` } : null; }
  },
  {
    id: 'breadth', label: '시장 폭', home: 'breadth',
    question: '지수 상승에 참여한 종목이 넓은가',
    reading: '지수가 올라도 평균선 위 종목이 적으면 소수 대형주가 끈 움직임이다. 동일가중 지수와의 차이를 함께 본다.',
    data: ['스크리너 유니버스 미국 종목의 수정 종가(종목마다 같은 무게)', '동일가중 S&P 500(RSP) 종가'],
    limits: ['거래소 전체 집계가 아니라 유니버스 기준이다.', '평균선 위 비율과 평균선이 오르면서 그 위에 있는 비율(10거래일 전보다 높은 50일선)은 다른 값이다. 내리는 선 위의 종목은 하락 추세 속 반등일 수 있다.'],
    measure: ({ history, screenerRows }) => {
      const last = historyFieldLast(history, 'breadth50');
      const us = share(usRows(screenerRows), (row) => readRowNumber(row, 'pctSma50') !== null);
      const rising = historyFieldLast(history, 'breadth50Rising');
      return last ? { asOf: last.date, scope: [us.total ? `미국 ${us.total}종목 중 ${us.covered}종목` : null, rising ? null : '오르는 50일선 위 비율은 첫 계산 전'].filter(Boolean).join(', ') || null } : null;
    }
  },
  {
    id: 'volatility', label: '변동성', home: 'sentiment',
    question: '지수가 흔들리는 크기가 평소보다 큰가',
    reading: 'VIX 수준과 VIX·VIX3M 구조. 근월이 더 높으면 단기 불안이 크다.',
    data: ['Cboe VIX·VIX3M 일별 종가'],
    limits: ['변동성이 높다는 것은 흔들림이 크다는 뜻이지 하락 방향을 말하지 않는다.'],
    measure: ({ history }) => { const vix = historyFieldLast(history, 'vix'); return vix ? { asOf: vix.date, scope: `VIX 종가 ${vix.count}거래일` } : null; }
  },
  {
    id: 'sentiment', label: '투자 심리', home: 'sentiment',
    question: '참여자들이 겁을 내는가, 과열인가',
    // v59.71: the put/call ratio is retired (owner 11/04, Cboe terms); the lens reads the survey against VIX only.
    reading: '공포·탐욕 지수를 VIX와 겹쳐, 겁만 난 상태와 투매를 나눈다.',
    data: ['CNN 공포·탐욕 지수', 'Cboe VIX 일별 종가'],
    limits: ['공포·탐욕 지수는 여러 지표를 묶은 합성값이라, 어느 구성 요소가 움직였는지는 따로 확인해야 한다.'],
    measure: ({ history }) => {
      const fg = historyFieldLast(history, 'fg');
      const vix = historyFieldLast(history, 'vix');
      const fgLate = fg && vix && sessionsBehind(fg.date, Date.parse(`${vix.date}T21:00:00Z`)) > STALE_DAYS;
      return fg ? { asOf: fg.date, scope: `공포·탐욕 ${fg.count}거래일`, late: fgLate ? `공포·탐욕 지수는 ${md(fg.date)}에 멈춤` : null } : null;
    }
  },
  {
    id: 'rates', label: '금리', home: 'fxbond',
    question: '금리가 주가의 할인율을 누르고 있나',
    reading: '10년 명목금리를 실질금리와 기대인플레이션으로 나눠, 금리 하락이 성장 걱정인지 물가 안정인지 본다.',
    data: ['미 국채 10년·2년 수익률', '10년 실질금리(DFII10)·기대인플레이션(T10YIE)'],
    limits: ['10년 금리 한 줄로 AI 투자 수요 같은 개별 원인을 잴 수 없다.'],
    measure: ({ macroHistory }) => { const ten = macroLast(macroHistory, 'dgs10'); return ten ? { asOf: ten.date, scope: `10년 금리 ${ten.count}개 관측` } : null; }
  },
  {
    id: 'credit', label: '신용', home: 'sentiment',
    question: '회사채 시장이 위험을 더 비싸게 받나',
    reading: '하이일드·CCC 스프레드가 넓어지면 주가 조정이 신용 경계로 바뀌는지 본다.',
    data: ['ICE BofA 하이일드·CCC·투자등급 OAS'],
    limits: ['공개 회사채 시장의 금리차이며 사모 신용이나 개별 기업 CDS가 아니다.'],
    measure: ({ macroHistory }) => { const hy = macroLast(macroHistory, 'hyOas'); return hy ? { asOf: hy.date, scope: `하이일드 ${hy.count}개 관측` } : null; }
  },
  {
    id: 'earnings', label: '실적 반응', home: 'briefing',
    question: '실적이 예상과 어땠고, 주가는 어떻게 받았나',
    reading: '예상 | 발표 | 다음 전망 | 주가 반응을 나란히 두고, 같은 날 시장·업종 움직임과 비교한다.',
    data: ['기업 보도자료·공시(SEC 8-K, DART)', '실적 달력 컨센서스(조정 EPS·분기 매출)'],
    limits: ['예상치의 취득 시각을 저장하지 않아 발표 직전 값인지 확인하지 못한다.', 'GAAP과 조정 기준, 연간과 분기는 서로 비교하지 않는다.'],
    measure: ({ eventBriefs, nowMs }) => {
      const briefs = (eventBriefs?.briefs || []).filter((brief) => brief?.kind === 'earnings');
      if (!briefs.length) return null;
      const recent = briefs.filter((brief) => Date.parse(`${brief.eventDate}T12:00:00Z`) >= nowMs - 7 * DAY);
      const compared = briefs.filter((brief) => (brief.figures || []).some((figure) => figure?.estimate)).length;
      return { asOf: String(eventBriefs.generatedAt || '').slice(0, 10), scope: `요약 ${briefs.length}건 중 예상치 비교 ${compared}건, 최근 7일 ${recent.length}건` };
    }
  },
  {
    id: 'expectations', label: '이익 전망', home: 'macro',
    question: '시장이 앞으로의 이익을 높이고 있나 낮추고 있나',
    reading: '컨센서스 EPS와 최근 4주 상향·하향 수로 전망의 방향을 본다.',
    data: ['Nasdaq 공개 실적 전망(Zacks 컨센서스, 조정 EPS)'],
    limits: ['추정치의 수정 이력 전체가 아니라 최근 4주 상향·하향 수다.'],
    measure: ({ consensus }) => {
      const cov = consensus?.coverage;
      return consensus ? { asOf: String(consensus.generatedAt || '').slice(0, 10), scope: Number.isFinite(cov?.universeUs) ? `미국 ${cov.universeUs}종목 중 ${cov.covered}종목` : null } : null;
    }
  },
  {
    id: 'valuation', label: '밸류에이션', home: 'screener',
    question: '가격이 이익·자본에 비해 비싼가',
    reading: '직전 종가 × SEC 공시 주식 수로 PER·PBR을 계산한다. 분할 뒤 다음 공시 전에는 주식 수를 분할 비율로 보정한다.',
    data: ['SEC EDGAR XBRL(연간·분기)', '수정 종가'],
    limits: ['PER 2 미만·PBR 0.1 미만은 주식 단위 불일치로 보고 표시하지 않는다.', '한국 종목은 재무 자료가 아직 없다.'],
    measure: ({ screenerRows }) => {
      const us = share(usRows(screenerRows), (row) => readRowNumber(row, 'pe') !== null);
      const kr = share(krRows(screenerRows), (row) => readRowNumber(row, 'pe') !== null || readRowNumber(row, 'pb') !== null);
      return us.total ? { scope: `PER 미국 ${us.total}종목 중 ${us.covered}종목${kr.total ? `, 한국 ${kr.total}종목 중 ${kr.covered}종목` : ''}`, late: kr.total && !kr.covered ? '한국 재무 없음' : null } : null;
    }
  },
  {
    id: 'rotation', label: '테마 회전', home: 'themes',
    question: '어느 업종·테마로 강세가 옮겨 가나',
    reading: '세부 테마의 기간별 상대강도와 순위 변화, 단계(주도·조정·반등·약세)를 같은 기준일로 본다.',
    data: ['테마 구성 종목·ETF 수정 종가(상대강도 자체 계산)'],
    limits: ['함께 움직였다는 것만으로 같은 원인이라고 하지 않는다.', '상대강도 순위는 추천 순서가 아니다.'],
    measure: ({ scenarioState }) => {
      const themes = Array.isArray(scenarioState?.themes) ? scenarioState.themes.length : Object.keys(scenarioState?.themes || {}).length;
      return scenarioState ? { asOf: String(scenarioState.basis?.themeAsOf || scenarioState.generatedAt || '').slice(0, 10), scope: themes ? `테마 ${themes}개` : null } : null;
    }
  },
  {
    id: 'macro', label: '경기·물가', home: 'macro',
    question: '성장과 물가가 어느 쪽으로 가나',
    reading: '고용·물가·소비 발표를 이전 추세와 견주어 성장 × 물가 사분면의 위치를 본다.',
    data: ['FRED·BLS·BEA 공식 발표'],
    limits: ['월간 발표는 늦게 나오고 수정된다. 발표 전 값을 뒤에 나온 값으로 바꾸지 않는다.'],
    measure: ({ macroHistory }) => { const cpi = macroLast(macroHistory, 'cpi') || macroLast(macroHistory, 'coreCpi'); return macroHistory ? { asOf: String(macroHistory.generatedAt || '').slice(0, 10), scope: cpi ? `물가 ${cpi.count}개월` : null } : null; }
  },
  {
    id: 'korea', label: '한국 시장', home: 'signal',
    question: '한국 증시가 미국과 같은 방향인가, 원화가 같이 움직이나',
    reading: '코스피·코스닥 마감과 원/달러를 함께 놓고, 원화 약세가 동반된 하락인지 본다.',
    data: ['코스피·코스닥 일별 종가', '원/달러 종가'],
    limits: ['투자자별 매매(외국인·기관) 자료는 아직 수집 전이다.', '한국 종목 재무 자료가 없어 한국 밸류에이션은 계산하지 않는다.'],
    measure: ({ history }) => { const kospi = historyFieldLast(history, 'kospi'); return kospi ? { asOf: kospi.date, scope: `코스피 종가 ${kospi.count}거래일` } : null; }
  }
]);

export const LENS_BY_ID = Object.freeze(Object.fromEntries(LENSES.map((lens) => [lens.id, lens])));

// Which lenses each screen reads through, in the order its sections use them.
export const PAGE_LENSES = Object.freeze({
  home: ['trend', 'breadth', 'earnings', 'korea'],
  briefing: ['earnings', 'rates', 'credit', 'macro'],
  signal: ['trend', 'breadth', 'volatility', 'sentiment', 'rates', 'credit', 'korea'],
  breadth: ['breadth', 'trend'],
  sentiment: ['sentiment', 'volatility', 'credit'],
  macro: ['macro', 'rates', 'credit'],
  fxbond: ['rates', 'credit'],
  charts: ['trend', 'breadth'],
  technical: ['trend'],
  themes: ['rotation', 'breadth', 'expectations'],
  screener: ['trend', 'valuation', 'expectations'],
  ticker: ['trend', 'valuation', 'expectations', 'earnings'],
  fundamental: ['valuation', 'expectations', 'earnings'],
  portfolio: ['trend', 'rotation']
});

/** The lenses of a screen with today's basis and coverage; a lens whose input is not loaded keeps its definition. */
export function pageLensReads(routeId, inputs = {}) {
  const nowMs = Number.isFinite(inputs.nowMs) ? inputs.nowMs : Date.now();
  return (PAGE_LENSES[routeId] || []).map((id) => {
    const lens = LENS_BY_ID[id];
    let measured = null;
    try { measured = lens.measure({ ...inputs, nowMs }); } catch (_) { measured = null; }
    return { id, label: lens.label, question: lens.question, reading: lens.reading, data: lens.data, limits: lens.limits, home: lens.home,
      asOf: measured?.asOf ? md(measured.asOf) : null, scope: measured?.scope || null, late: measured?.late || null };
  });
}
