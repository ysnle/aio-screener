// The words of the 한국 tab's link (domain/market/korea/korea-session-link.js): the US semiconductor session, the KOSPI
// session after it, and foreign investors' net purchases on KOSPI. Fixed text; every figure is a claim slot.
export const KOREA_LINK_WORDS = Object.freeze({
  pending: '{usDay} 미국 반도체(SOX) {m}는 아직 한국 장에 반영되지 않았습니다.',
  pair: Object.freeze({
    same: '{usDay} 미국 반도체(SOX) {m} 뒤 {krDay} 코스피는 {k}로 같은 방향이었습니다.',
    opposite: '{usDay} 미국 반도체(SOX) {m} 뒤 {krDay} 코스피는 {k}로 반대로 움직였습니다.',
    flat: '{usDay} 미국 반도체(SOX) {m} 뒤 {krDay} 코스피는 {k}로 거의 움직이지 않았습니다.'
  }),
  flows: '외국인은 코스피에서 {parts}입니다.',
  flowDay: '{day} {v}',
  sum5: '5거래일 합 {s}',
  sum20: '20거래일 합 {s}',
  meaning: Object.freeze({
    'buy-early': '하루 순매수로는 20거래일 이어진 매도 흐름이 바뀌었다고 보기 이릅니다. 5거래일 합이 순매수로 돌아서는지가 확인 지점입니다.',
    'buy-turning': '5거래일 합이 순매수로 돌아서, 20거래일 이어진 매도가 멈추는지 확인되는 중입니다.',
    'sell-up': '코스피는 올랐지만 외국인이 받친 상승은 아닙니다.',
    'sell-down': '외국인 매도가 지수 하락과 같은 방향으로 이어지는 중입니다.',
    'buy-ongoing': '외국인 매수가 이어지며 지수를 받치는 쪽입니다.',
    'sell-holding': '하루 순매도이고, 20거래일 합은 아직 순매수입니다.'
  }),
  label: Object.freeze({ session: '미국장과 한국장', flows: '외국인 수급' }),
  // A large KOSPI session's one sentence beside the index line (koreaBigMoveSaid): what the data has around it, each
  // piece absent without its figure.
  bigMove: Object.freeze({
    semis: '앞선 {usDay} 반도체(SOX) {m}',
    flows: '{day} 순매수 {parts}',
    flowPart: '{who} {v}',
    won: '원/달러 {w}',
    said: '{parts}.'
  })
});
