// The words of the opening's earnings line (domain/market/story/earnings-read.js): which way analysts moved the S&P 500's
// next-year estimates over four weeks, set beside what the index's price did. The pair answers the question a fall
// raises first — did the earnings outlook break, or did the price put on the same earnings come down.
export const EARNINGS_TILT_WORDS = Object.freeze({ up: '이익 전망 상향 우세', down: '이익 전망 하향 우세', even: '이익 전망 팽팽' });

// Keyed by the price side (fall: a diagnosed fall from the high · hold: none) and the revision tilt.
export const EARNINGS_READ_WORDS = Object.freeze({
  'fall:up': '이익 전망이 꺾여서 내린 하락이 아니라, 같은 이익에 매기는 값이 내려간 하락입니다. 수정이 하향 우세로 돌면 하락의 성격이 달라집니다.',
  'fall:down': '주가와 이익 전망이 함께 내려가는 중이라, 내린 주가를 싸졌다고 보기 어렵습니다.',
  'fall:even': '이익 전망은 한쪽으로 기울지 않아, 하락의 이유를 이익에서 찾기는 어렵습니다.',
  'hold:up': '이익 전망이 주가를 받치는 쪽입니다.',
  'hold:down': '주가는 버티는데 이익 전망은 내려가는 중이라, 같은 주가의 값 부담이 커지는 쪽입니다.',
  'hold:even': ''
});
