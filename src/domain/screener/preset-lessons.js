// v58.75 (teach-and-check D5, owner 2026-10-24): "이 조건을 왜 보나" for each built-in screen — the principle, the market
// environment it tends to work and not work in (the published reasoning, not a backtest of this app), the common failure,
// and which table columns show it. `favours` names the six-axis side the condition has historically leaned on, so the
// screen can say in one line whether today's market state is on that side. No probability, no instruction.
export const PRESET_LESSONS = Object.freeze({
  'preset-balanced': {
    principle: '여러 팩터(모멘텀·추세·저변동·밸류·퀄리티)를 섞어 한 가지 성질에 쏠리지 않게 줄을 세웁니다.',
    works: '어느 한 스타일이 뚜렷하게 이기지 않는 평범한 시장에서 무난합니다.',
    fails: '한 스타일이 강하게 이기는 시장(예: 급등장의 모멘텀)에서는 그 스타일만 고른 목록보다 뒤처집니다.',
    failure: '팩터끼리 상관이 높으면 섞은 효과가 줄어 사실상 한 팩터 순위가 됩니다.',
    columns: ['rank', 'momentum', 'trend', 'lowvol'],
    favours: null
  },
  'preset-momentum': {
    principle: '최근 3~12개월 많이 오른 종목이 한동안 더 오르는 경향(모멘텀, Jegadeesh·Titman 1993)을 이용합니다.',
    works: '추세가 이어지고 시장 참여가 넓은 시장에서 잘 통하는 편입니다.',
    fails: '하락장 뒤 급반등처럼 방향이 갑자기 바뀌는 구간에서는 크게 뒤처지기도 합니다(모멘텀 붕괴, Daniel·Moskowitz 2016).',
    failure: '이미 많이 오른 뒤 들어가 첫 조정에서 크게 밀리는 경우.',
    columns: ['ret3m', 'rs6m', 'rs12m', 'extension'],
    favours: 'favorable'
  },
  'preset-trend': {
    principle: '종가가 50일선과 200일선 위에 있는, 이동평균 기준으로 오르는 추세의 종목을 고릅니다.',
    works: '한 방향으로 길게 움직이는 시장에서 잘 통합니다.',
    fails: '오르내림을 반복하는 박스권 시장에서는 이동평균을 자주 넘나들어 신호가 잦게 뒤집힙니다.',
    failure: '추세 끝물에 이동평균에서 멀리 떨어진 종목을 고르는 것 — 50일선 거리(변동폭 배수)를 같이 봅니다.',
    columns: ['pctSma50', 'extension', 'rs6m', 'trend'],
    favours: 'favorable'
  },
  'preset-lowvol': {
    principle: '덜 흔들리는 종목이 위험 대비 성과가 나쁘지 않았다는 저변동성 이상 현상(Baker·Bradley·Wurgler 2011)을 이용합니다.',
    works: '시장이 흔들리거나 내리는 구간에서 낙폭을 덜 받는 편입니다.',
    fails: '시장이 크게 오르는 구간에서는 덜 오릅니다. 금리가 빠르게 오를 때는 배당·채권 성격 종목이 함께 약해지기도 합니다.',
    failure: '변동성이 낮은 이유가 거래가 적어서인 종목 — 거래대금을 같이 봅니다.',
    columns: ['lowvol', 'adrPct', 'dollarVolume30d'],
    favours: 'burden'
  },
  'preset-quality': {
    principle: '자기자본이익률(ROE)과 이익률이 높은 기업, 즉 이익을 꾸준히 내는 기업을 고릅니다(퀄리티, Asness·Frazzini·Pedersen).',
    works: '경기 둔화나 불안한 시장에서 상대적으로 버티는 편입니다.',
    fails: '부실·저품질 종목이 한꺼번에 반등하는 구간에서는 뒤처집니다.',
    failure: '좋은 기업이지만 이미 비싼 가격 — PER·Forward PER를 같이 봅니다.',
    columns: ['roe', 'margin', 'pe', 'fwdPe'],
    favours: 'burden'
  },
  'preset-pivot-quiet': {
    principle: '변동성이 줄며 피벗(마지막 수축 고점) 가까이에 온 종목 — 거래량이 마를수록 팔 사람이 줄었다는 흔적으로 봅니다(미너비니 VCP).',
    works: '시장 전체가 상승 추세일 때 이런 자리에서 나온 돌파가 이어지기 쉽다고 봅니다(오닐: 종목 다수는 시장 방향을 따른다).',
    fails: '시장이 부담 쪽이면 좋은 자리도 돌파 뒤 되밀리는 일이 잦습니다.',
    failure: '피벗을 넘지 못하고 베이스가 깨지거나, 거래량 없이 넘었다가 다시 피벗 아래로 돌아오는 경우.',
    columns: ['pivotDist', 'rvol20', 'vcpScore', 'rs6m'],
    favours: 'favorable'
  },
  'preset-breakout-volume': {
    principle: '피벗 위 종가와 평소보다 많은 거래량이 같은 날 나온 종목 — 수요가 매물을 이겼다는 흔적으로 봅니다(오닐 피벗 돌파).',
    works: '시장 전체가 상승 추세이고 주도 업종이 분명할 때 잘 이어지는 편입니다.',
    fails: '박스권·약세 시장에서는 돌파 뒤 되돌림이 잦습니다.',
    failure: '돌파 뒤 종가가 피벗 아래로 돌아오는 실패한 돌파, 피벗에서 이미 멀리 오른 뒤(+5% 초과) 들어가는 경우.',
    columns: ['pivotDist', 'rvol20', 'ret5d', 'followThrough'],
    favours: 'favorable'
  }
});

const FAVOURABLE = new Set(['양호 우세', '다소 양호']);
const BURDEN = new Set(['부담 우세', '다소 부담']);

/** One line relating the shared market state (six-axis overall) to the side this condition has leaned on. */
export function presetMarketLine(lesson, regime) {
  if (!regime?.available || !regime.overall || regime.overall === '판정 보류') return '지금 시장 상태는 판정 대기입니다.';
  const state = `지금 시장 상태는 '${regime.overall}'(양호 ${regime.counts?.favorable ?? '—'}, 부담 ${regime.counts?.burden ?? '—'})입니다`;
  if (!lesson?.favours) return `${state} — 이 조건은 특정 환경에 기대지 않습니다.`;
  const side = FAVOURABLE.has(regime.overall) ? 'favorable' : BURDEN.has(regime.overall) ? 'burden' : null;
  if (!side) return `${state} — 지표가 엇갈려 이 조건이 기대는 환경인지 아닌지 한쪽으로 말하기 어렵습니다.`;
  return side === lesson.favours
    ? `${state} — 이 조건이 상대적으로 잘 통해 온 환경과 같은 쪽입니다(보장은 아닙니다).`
    : `${state} — 이 조건이 잘 통해 온 환경과 반대쪽이라 흔한 실패 유형을 더 눈여겨볼 때입니다.`;
}
