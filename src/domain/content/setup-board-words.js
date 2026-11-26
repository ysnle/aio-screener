// The setup board's fixed words (technical/setup-board.js): the ladder's state words, the short reasons a row falls
// short, the 200-day bands and one caption per visual. Conditional wording only — a state names where a chart stands,
// never an order.
export const SETUP_STATE_WORDS = Object.freeze({
  ready: '돌파 대기',
  base: '베이스 완성',
  template: '템플릿 통과'
});

// One short reason per unmet check or setup condition, in the order the ladder reads them.
export const SETUP_REASON_WORDS = Object.freeze({
  aboveLongLines: '150·200일선 아래',
  line150Over200: '150일선 < 200일선',
  line200Rising: '200일선 하락',
  line50OverLong: '50일선 약함',
  above50: '50일선 아래',
  offLow: '52주 저점 근처',
  nearHigh: '52주 고점과 멂',
  relativeStrength: '지수보다 약함',
  noBase: '베이스 없음',
  abovePivot: '피벗 위',
  farFromPivot: '피벗까지 멂',
  stopWide: '마지막 눌림 깊음',
  volumeNotDry: '거래량 안 마름'
});

export const SETUP_BAND_WORDS = Object.freeze({
  template: '템플릿 통과',
  near: '200일선 -10% 이내',
  mid: '200일선 -30% 이내',
  far: '200일선 -30% 밖'
});

export const SETUP_BOARD_WORDS = Object.freeze({
  templateLabel: '추세 템플릿(변형)',
  tiles: Object.freeze({ template: '템플릿 통과', base: '템플릿+베이스', ready: '돌파 대기' }),
  tileNotes: Object.freeze({ template: '8개 조건 모두', base: '베이스 완성', ready: '피벗 5% 이내, 손절폭 8% 이하' }),
  sectorTitle: '업종별 템플릿 통과',
  sectorCaption: '막대 전체 = 템플릿 통과, 진한 부분 = 그중 베이스 완성',
  defensive: '방어',
  themeTitle: '200일선 대비 위치',
  themeCaption: '강한 순, 테두리 색 = 200일선 거리 구간',
  candidatesTitle: '돌파 대기 후보',
  candidatesCaption: '시장이 돌아설 때 먼저 볼 후보',
  pivot: '피벗까지',
  stop: '손절폭',
  contractions: '수축',
  volume: '거래량',
  earnings: '실적',
  waiting: '템플릿 판정 자료 수집 중'
});
