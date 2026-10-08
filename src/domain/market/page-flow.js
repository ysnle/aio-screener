// P1431 (owner direction 2026-10-04): a page must read as one argument, not a stack of independent
// cards — every section says what it adds to the page's conclusion, and the page ends with where the
// same reading continues. These sentences are computed from the same series and rules the cards use;
// a section with missing inputs says what it cannot add instead of inventing a reading.
import { RULES } from '../rules/thresholds.js';

const last = (series) => (Array.isArray(series) && series.length ? series[series.length - 1] : null);
const back = (series, n) => (Array.isArray(series) && series.length > n ? series[series.length - 1 - n] : null);
const round = (value, digits = 0) => Number(value).toFixed(digits);
const signed = (value, digits = 1, unit = '') => `${value >= 0 ? '+' : ''}${Number(value).toFixed(digits)}${unit}`;

function cardOf(cards, id) {
  return (cards || []).find((card) => card.id === id) || null;
}

function delta(series, n) {
  const now = last(series);
  const then = back(series, n);
  return now && then && Number.isFinite(now.value) && Number.isFinite(then.value) ? now.value - then.value : null;
}

function pctDelta(series, n) {
  const now = last(series);
  const then = back(series, n);
  return now && then && then.value ? (now.value / then.value - 1) * 100 : null;
}

// 시장 폭: participation → leadership → index confirmation, each tied to the verdict above it.
export function breadthFlow({ cards = [], regime = null } = {}) {
  const B = RULES.breadth;
  const b50 = last(cardOf(cards, 'b50')?.series)?.value ?? null;
  const b200 = last(cardOf(cards, 'b200')?.series)?.value ?? null;
  const b20 = last(cardOf(cards, 'b20')?.series)?.value ?? null;
  const b50d20 = delta(cardOf(cards, 'b50')?.series, 20);
  const b50d5 = delta(cardOf(cards, 'b50')?.series, 5);
  const spxSeries = cardOf(cards, 'spx')?.series || [];
  const spx20 = pctDelta(spxSeries, 20);
  const hl = last(cardOf(cards, 'hl')?.series)?.value ?? null;
  const mv = last(cardOf(cards, 'mv')?.series)?.value ?? null;
  const dd = last(cardOf(cards, 'dd')?.series)?.value ?? null;

  let participation = '50일선·200일선 위 종목 비율 기록이 없어 참여도를 읽지 못했습니다.';
  if (b50 != null && b200 != null) {
    const both = b50 < B.weakBelow && b200 < B.weakBelow ? `둘 다 ${B.weakBelow}% 아래라 중기·장기 참여가 모두 위축된 상태입니다`
      : b50 >= B.broadAtLeast && b200 >= B.broadAtLeast ? `둘 다 ${B.broadAtLeast}% 이상이라 상승이 넓게 퍼져 있습니다`
        // Codex browser audit H08: the 20-day verdict hid a 5-day recovery; both windows are named.
        : b50 < B.weakBelow ? `장기 추세 위 종목(${round(b200)}%)은 남아 있지만 중기 참여가 ${B.weakBelow}% 아래로 줄었습니다${b50d5 != null && b50d5 >= 3 ? ` — 다만 최근 5거래일은 ${signed(b50d5, 1, '%p')} 회복해 중기 약화 속 단기 반등이 진행 중입니다` : ' — 조정이 종목 전반으로 번지는 단계입니다'}`
          : `중기와 장기 참여가 ${B.weakBelow}~${B.broadAtLeast}% 사이에서 엇갈립니다`;
    const shortTerm = b20 == null ? '' : b20 < b50 - 5 ? ` 20일선 위 비율(${round(b20)}%)이 더 낮아 단기 이탈이 아직 이어지는 중입니다.`
      : b20 > b50 + 5 ? ` 20일선 위 비율(${round(b20)}%)이 먼저 올라 단기 반등이 시작됐는지 확인할 구간입니다.` : ' 단기(20일선)와 중기 참여가 같은 흐름입니다.';
    participation = `50일선 위 ${round(b50)}% · 200일선 위 ${round(b200)}% — ${both}.${shortTerm}`;
  }

  const leadership = hl == null && mv == null
    ? '신고가·신저가와 4% 급등락 기록이 아직 쌓이는 중이라 이 묶음은 판정 근거로 쓰지 않습니다 — 위 참여도가 주 근거입니다.'
    : [hl == null ? null : hl > 0 ? `신고가가 신저가보다 ${round(hl)}개 많아 주도주가 넓어지는 쪽입니다` : hl < 0 ? `신저가가 신고가보다 ${round(-hl)}개 많아 주도주가 좁아지는 쪽입니다` : '신고가와 신저가가 같은 수입니다',
      mv == null ? null : mv > 0 ? `최근 5일 4% 급등 종목이 급락보다 ${round(mv)}개 많아 매수세가 살아 있습니다` : mv < 0 ? `최근 5일 4% 급락 종목이 급등보다 ${round(-mv)}개 많아 투매 쪽입니다` : '최근 5일 급등·급락 종목 수가 같습니다'
    ].filter(Boolean).join('. ') + '.';

  let index = 'S&P 500과 참여도를 같은 기간으로 비교할 기록이 부족합니다.';
  if (spx20 != null && b50d20 != null) {
    const gap = spx20 > -2 && b50d20 <= -10 ? '지수보다 참여가 훨씬 빨리 줄어 괴리가 커졌습니다. 지수가 버티는 동안 소수 종목 의존이 깊어진 상태입니다'
      : spx20 < 0 && b50d20 < 0 ? '지수와 참여가 함께 약해지는 중입니다'
        : spx20 > 0 && b50d20 > 0 ? '지수와 참여가 함께 넓어지는 건강한 흐름입니다'
          : spx20 <= 0 && b50d20 > 0 ? '지수는 쉬지만 참여는 오히려 넓어져 바닥 다지기 쪽입니다' : '지수와 참여의 방향이 뚜렷하게 갈리지 않습니다';
    index = `S&P 500은 20일 ${signed(spx20, 1, '%')}, 50일선 위 종목 비율은 20일 ${signed(b50d20, 1, '%p')} — ${gap}.${dd == null ? '' : ` 최근 25거래일 분배일은 ${round(dd)}회${dd >= 5 ? '로 경고 구간(5회 이상)입니다' : '입니다'}.`}`;
  }

  const axis = regime?.axes?.find((row) => row.id === 'breadth');
  const trend = regime?.axes?.find((row) => row.id === 'trend');
  const next = [];
  if (axis?.state === 'burden') {
    next.push({ route: 'themes', label: '테마 · 섹터', why: '좁은 장세에서 지수를 떠받치는 섹터가 어디인지' });
    next.push({ route: 'screener', label: '스크리너', why: '참여가 줄어드는 동안에도 50일선 위를 지키는 종목' });
  } else if (axis?.state === 'favorable') {
    next.push({ route: 'themes', label: '테마 · 섹터', why: '넓어진 상승을 어느 섹터가 이끄는지' });
    next.push({ route: 'screener', label: '스크리너', why: '확산 국면에서 상대 강도가 높은 종목' });
  }
  if (trend) next.push({ route: 'signal', label: '시장 상태', why: `시장 폭(${axis?.stateLabel || '판정 대기'})이 추세(${trend.stateLabel})·금리·신용과 합쳐진 전체 판정` });
  next.push({ route: 'sentiment', label: '투자 심리', why: '참여 위축이 공포·신용 스트레스로 번졌는지' });
  return { leads: { participation, leadership, index }, next };
}

// 투자 심리: the synthesis is tied back to the 시장 상태 axes that use the same numbers.
export function sentimentFlow({ model = null, regime = null } = {}) {
  const byId = Object.fromEntries((regime?.axes || []).map((row) => [row.id, row]));
  const cards = Object.fromEntries((model?.cards || []).map((card) => [card.id, card]));
  const links = [];
  if (cards.hy?.value && cards.hy.value !== '—' && byId.credit) links.push(`HY 스프레드 ${cards.hy.value}는 시장 상태 '신용 · 위험선호' 축(${byId.credit.stateLabel})의 근거`);
  if (cards.term?.value && cards.term.value !== '—' && byId.volatility) links.push(`VIX 기간 구조 ${cards.term.value}는 '변동성' 축(${byId.volatility.stateLabel})의 근거`);
  const bridge = links.length ? `${links.join(', ')}입니다. 공포·탐욕과 AAII는 6개 축에 넣지 않는 참고 지표라, 가격에서 나온 심리가 자금 시장(신용·변동성)까지 번졌는지를 이 두 축으로 확인합니다.` : '';
  const next = [];
  const hyState = cards.hy?.state?.tone;
  if (hyState === 'burden') next.push({ route: 'fxbond', label: '금리 · 환율', why: '신용 스프레드 확대가 실질금리·달러와 같은 방향인지' });
  if (byId.breadth?.state === 'burden') next.push({ route: 'breadth', label: '시장 폭', why: `심리 위축이 참여 종목 감소(시장 폭 ${byId.breadth.stateLabel})와 겹치는지` });
  next.push({ route: 'signal', label: '시장 상태', why: '심리를 뺀 6개 축의 전체 판정' });
  return { bridge, next };
}

// 시장 상태: each burden or neutral axis points to the screen that explains it.
const AXIS_ROUTES = Object.freeze({
  trend: { route: 'technical', action: 'aioOpenMarketChart', arg: 'SPY', label: 'S&P 500 차트', why: (axis) => `추세 ${axis.stateLabel} — 일봉과 50·200일선 위치` },
  breadth: { route: 'breadth', label: '시장 폭', why: (axis) => `시장 폭 ${axis.stateLabel} — 참여 종목의 6개월 추이와 빠지거나 들어온 종목` },
  volatility: { route: 'sentiment', label: '투자 심리', why: (axis) => `변동성 ${axis.stateLabel} — 옵션 헤지 수요·심리와 같은 쪽인지` },
  rates: { route: 'fxbond', label: '금리 · 환율', why: (axis) => `금리 ${axis.stateLabel} — 실질금리와 수익률 곡선 중 어디에서 오는지` },
  credit: { route: 'sentiment', label: '투자 심리', why: (axis) => `신용 ${axis.stateLabel} — 공포 심리와 함께 움직이는지` },
  commodities: { route: 'macro', label: '거시 경제', why: (axis) => `유가·달러 ${axis.stateLabel} — 물가와 금리 경로에 주는 압력` }
});

export function regimeFlow({ regime = null } = {}) {
  if (!regime?.available) return { next: [] };
  const order = { burden: 0, neutral: 1, favorable: 2, unknown: 3 };
  const seen = new Set();
  const next = [];
  for (const axis of [...regime.axes].filter((row) => AXIS_ROUTES[row.id]).sort((a, b) => order[a.state] - order[b.state])) {
    const target = AXIS_ROUTES[axis.id];
    if (axis.state === 'favorable' || axis.state === 'unknown' || seen.has(target.route)) continue;
    seen.add(target.route);
    next.push({ route: target.route, action: target.action, arg: target.arg, label: target.label, why: target.why(axis), tone: axis.state });
  }
  return { next };
}

// 테마 · 섹터: what the RRG quadrants say together, tied to the 시장 상태 breadth axis.
const DEFENSIVE = new Set(['XLU', 'XLP', 'XLV', 'XLRE']);
const QUADRANT_WORDS = Object.freeze({ Leading: '선도', Improving: '개선', Weakening: '약화', Lagging: '후행' });

export function rotationFlow({ groups = {}, regime = null } = {}) {
  const names = (key) => (groups[key] || []).map((item) => item.label || item.symbol);
  const total = Object.keys(QUADRANT_WORDS).reduce((sum, key) => sum + (groups[key] || []).length, 0);
  if (!total) return { read: '상대강도·모멘텀 기록이 없어 섹터 회전을 읽지 못했습니다.', next: [] };
  const lead = groups.Leading || [];
  const improving = groups.Improving || [];
  const lagging = groups.Lagging || [];
  const parts = Object.entries(QUADRANT_WORDS).map(([key, word]) => (names(key).length ? `${word} ${names(key).join('·')}` : null)).filter(Boolean);
  const ahead = [...lead, ...improving];
  const defensiveAhead = ahead.filter((item) => DEFENSIVE.has(String(item.symbol || '').toUpperCase())).length;
  const style = !ahead.length ? '시장보다 강해지는 섹터가 없습니다'
    : defensiveAhead && defensiveAhead === ahead.length ? '앞서는 섹터가 모두 방어 업종(유틸리티·필수소비·헬스케어·부동산)이라 위험 회피 쪽 회전입니다'
      : defensiveAhead ? '경기 민감 업종과 방어 업종이 함께 앞서 방향이 섞여 있습니다'
        : '앞서는 섹터가 경기 민감 업종이라 위험 선호 쪽 회전입니다';
  const concentration = lead.length <= 2 && lagging.length >= Math.ceil(total / 2)
    ? ` ${total}개 중 선도는 ${lead.length}개뿐이고 후행이 ${lagging.length}개 — 상승이 소수 섹터에 몰린 구조입니다.` : '';
  const breadth = regime?.axes?.find((row) => row.id === 'breadth');
  const tie = concentration && breadth?.state === 'burden' ? ' 시장 상태의 시장 폭 부담(참여 종목 감소)과 같은 그림입니다.'
    : concentration && breadth?.state === 'favorable' ? ' 다만 시장 폭은 우호라 종목 참여는 아직 넓습니다.' : '';
  const read = `${parts.join(' · ')}. ${style}.${concentration}${tie}`;
  const next = [];
  if (improving.length) next.push({ route: 'screener', label: '스크리너', why: `개선 사분면(${names('Improving').join('·')})에서 상대강도가 먼저 오르는 종목` });
  if (breadth) next.push({ route: 'breadth', label: '시장 폭', why: `섹터 쏠림이 참여 종목 수(시장 폭 ${breadth.stateLabel})에도 나타나는지` });
  next.push({ route: 'macro', label: '거시 경제', why: '금리·유가·달러가 어느 업종에 유리한 국면인지' });
  return { read, next };
}

// 테마 · 섹터: what the sub-theme ranking says beyond its order — where short-term momentum is moving
// (1-month rank well ahead of 3-month) and which leaders are cooling.
export function themeStrengthLead(model = null) {
  const groups = Array.isArray(model?.groups) ? model.groups : [];
  if (groups.length < 5) return '';
  const label = (group) => group.name;
  const top = groups.slice(0, 5);
  const improving = groups.filter((group) => group.direction === 'improving').slice(0, 3);
  const cooling = top.filter((group) => group.direction === 'weakening');
  const healthy = top.filter((group) => group.above50Pct != null && group.above50Pct >= 75).length;
  const parts = [`${model.windowLabel || '기간'} 상위는 ${top.slice(0, 3).map(label).join(' · ')}`];
  const topic = (text) => { const code = String(text).charCodeAt(String(text).length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 ? '은' : '는'; };
  const joined = (list) => list.map(label).join(' · ');
  if (cooling.length) parts.push(`그중 ${joined(cooling)}${topic(label(cooling[cooling.length - 1]))} 1개월 순위가 3개월보다 크게 낮아 강세가 식는 중`);
  if (improving.length) parts.push(`반대로 ${joined(improving)}${topic(label(improving[improving.length - 1]))} 1개월 순위가 크게 올라 단기 흐름이 옮겨 가는 곳`);
  parts.push(`상위 5개 중 ${healthy}개는 구성 종목 대부분이 50일선 위`);
  return `${parts.join('. ')}입니다.`;
}

// 테마 상세: inside one theme — which sub-themes carry it, where short-term momentum is moving, and how
// the theme ETF sits in the sector rotation. Groups come from buildGroupStrength (screener artifact medians).
export function themeDetailFlow({ themeId, groups = [], etf = null, rotation = {} } = {}) {
  const mine = (groups || []).filter((group) => group.themeId === themeId);
  if (!mine.length) return { read: '', rows: [] };
  const byThree = [...mine].sort((a, b) => (b.ret3m ?? -1e9) - (a.ret3m ?? -1e9));
  const strongest = byThree[0];
  const weakest = byThree[byThree.length - 1];
  const moving = mine.filter((group) => group.direction === 'improving');
  const cooling = mine.filter((group) => group.direction === 'weakening');
  const quadrant = etf && rotation[etf] ? { Leading: '선도', Improving: '개선', Weakening: '약화', Lagging: '후행' }[rotation[etf].quadrant] : null;
  const pct = (value) => (value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`);
  const parts = [];
  if (quadrant) parts.push(`테마 ETF ${etf}는 섹터 회전에서 ${quadrant}`);
  if (byThree.length >= 2) parts.push(`3개월 기준 가장 강한 곳은 ${strongest.name}(${pct(strongest.ret3m)}), 가장 약한 곳은 ${weakest.name}(${pct(weakest.ret3m)})`);
  if (moving.length && moving.length === mine.length && mine.length >= 2) {
    // P1449/R679: an improving 1-month vs 3-month rank is a RELATIVE PRICE observation. Without a
    // volume/flow input this is not evidence of money inflow (the house wording used by the
    // themes page itself: 테마 페이지의 '자금 유입은 별도 근거가 필요합니다').
    parts.push('하위 테마 전부가 1개월 순위를 크게 끌어올렸습니다 — 특정 종목이 아니라 테마 전체의 상대 강세가 같은 방향입니다(가격 기준 관측이며 자금 유입의 증거는 아닙니다)');
  }
  else if (moving.length) parts.push(`1개월 흐름은 ${moving.map((group) => group.name).join(' · ')} 쪽으로 옮겨 가는 중`);
  const topic = (text) => { const code = String(text).charCodeAt(String(text).length - 1) - 0xac00; return code >= 0 && code <= 11171 && code % 28 ? '은' : '는'; };
  if (cooling.length) parts.push(`${cooling.map((group) => group.name).join(' · ')}${topic(cooling[cooling.length - 1].name)} 최근 1개월 강세가 식는 중`);
  return { read: parts.length ? `${parts.join('. ')}입니다.` : '', rows: byThree };
}
