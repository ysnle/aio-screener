// The curated nicknames a question may use for a company or a market. One table replaces the
// entity resolver's fallback names (src/ai/entity/resolver.js) and the chat's fuzzy map (js/aio-chat.js
// _resolveTickerFromFuzzy, v49.69 P369), which listed different companies: "암드" resolved in the chat only after
// nothing else had, so "암드 vs 엔비디아" lost AMD, and "LG화학" never matched because the map was read in lower case.
// A nickname is an exact word, never a substring ("금일" is not gold, "마크롱" not
// Microsoft). The page ticker registry (AIO_TICKER_NAME_REGISTRY) still wins over this table where both name a symbol.

export const COMPANY_NICKNAMES = Object.freeze({
  엔비디아: 'NVDA', 엔비: 'NVDA', nvidia: 'NVDA', 애플: 'AAPL', apple: 'AAPL', 마이크로소프트: 'MSFT', 마소: 'MSFT', microsoft: 'MSFT',
  테슬라: 'TSLA', tesla: 'TSLA', 아마존: 'AMZN', amazon: 'AMZN', 구글: 'GOOGL', 알파벳: 'GOOGL', alphabet: 'GOOGL',
  메타: 'META', 페북: 'META', 페이스북: 'META', 퀄컴: 'QCOM', 인텔: 'INTC', 브로드컴: 'AVGO', broadcom: 'AVGO', 암드: 'AMD',
  팔란티어: 'PLTR', 팔란: 'PLTR', palantir: 'PLTR', 슈퍼마이크로: 'SMCI', 넷플: 'NFLX', 넷플릭스: 'NFLX', 디즈니: 'DIS',
  삼성전자: '005930.KS', 삼전: '005930.KS', sk하이닉스: '000660.KS', 하이닉스: '000660.KS', 에코프로: '086520.KQ',
  에코프로비엠: '247540.KQ', 카카오: '035720.KS', 네이버: '035420.KS', lg화학: '051910.KS', 현대차: '005380.KS'
});

// Indices, currencies, commodities and coins. The unified AI panel reads only companies and answers these from its
// market blocks (chat-tickers.js companiesOnly).
export const MARKET_NICKNAMES = Object.freeze({
  코스피: '^KS11', kospi: '^KS11', 코스닥: '^KQ11', kosdaq: '^KQ11', 나스닥: '^IXIC', nasdaq: '^IXIC', 's&p': '^GSPC', 에스앤피: '^GSPC',
  다우: '^DJI', 다우존스: '^DJI', 러셀: '^RUT', 러셀2000: '^RUT',
  엔화: 'JPY=X', jpy: 'JPY=X', 원화: 'KRW=X', 원달러: 'KRW=X', 위안: 'CNY=X', 위안화: 'CNY=X',
  비트코인: 'BTC-USD', 코인: 'BTC-USD', 이더리움: 'ETH-USD',
  금: 'GC=F', gold: 'GC=F', 은: 'SI=F', silver: 'SI=F', 유가: 'CL=F', wti: 'CL=F', 원유: 'CL=F'
});

const own = (table, key) => (Object.prototype.hasOwnProperty.call(table, key) ? table[key] : null);

/** The symbol a whole word names, or null. `companiesOnly` leaves the market table out. */
export function nicknameSymbol(word, { companiesOnly = false } = {}) {
  if (!word || typeof word !== 'string') return null;
  const key = word.trim().toLowerCase();
  return own(COMPANY_NICKNAMES, key) || (companiesOnly ? null : own(MARKET_NICKNAMES, key));
}
