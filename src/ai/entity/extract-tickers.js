// v30.15: typed tickers in a question — $AAPL, a capitalised 2–5 letter symbol that is not a common word, finance
// acronym or (without a company question after it) a role/industry word, and a 6-digit Korean code (.KS); at most 5.
// Moved unchanged from js/aio-chat.js (roadmap item 11, layer 1 채팅); window._extractTickers keeps the legacy name.
// This is the typed-symbol stage of src/ai/entity/chat-tickers.js, the one question resolver.
import { ENGLISH_STOP_WORDS, NON_TICKER_ACRONYMS, ROLE_OR_INDUSTRY_WORDS, isNonTickerWord } from '../../domain/instruments/question-words.js';

export function extractTickers(text) {
  // 1. 명시적 US 티커 패턴: 대문자 1~5글자 (단독 또는 $ 접두사)
  var tickers = [];
  var seen = {};
  // v59.45 (pipeline review P11-ENTITY-01): a class share ("BRK.B", "BRK-B", "$BF.B") is one symbol. The word match below
  // read its base "BRK" as a ticker of its own, so "BRK.B 실적" asked for BRK and BRK-B. The class form (A–E, as in
  // domain/portfolio/fx.js) is kept with a dash, the universe's spelling (ticker-symbol.js), and its base is not read again.
  var classRe = /\$?\b([A-Z]{2,5})[.-]([A-E])\b(?![.-]?[A-Za-z0-9])/g;
  var classBase = {};
  var cm;
  var plain = text;
  while ((cm = classRe.exec(text))) {
    var cs = cm[1] + '-' + cm[2];
    if (!seen[cs]) { seen[cs]=1; classBase[cs]=cm[1]; tickers.push(cs); }
    plain = plain.slice(0, cm.index) + ' '.repeat(cm[0].length) + plain.slice(cm.index + cm[0].length);
  }
  // $AAPL 형식
  var m1 = plain.match(/\$([A-Z]{1,5})\b/g);
  if (m1) m1.forEach(function(t) { var s = t.slice(1); if (!seen[s]) { seen[s]=1; tickers.push(s); } });
  // 대문자 티커 (2~5글자, 문장 내에서 독립적으로 등장)
  var m2 = plain.match(/\b([A-Z]{2,5})\b/g);
  // The word lists are src/domain/instruments/question-words.js, shared with the entity resolver.
  // A class form whose base is a plain word or acronym ("IT-A", "US-B") stays out, as its base did before.
  tickers = tickers.filter(function(t) { var b = classBase[t]; return !b || !(ENGLISH_STOP_WORDS.has(b) || NON_TICKER_ACRONYMS.has(b) || ROLE_OR_INDUSTRY_WORDS.has(b)); });
  if (m2) m2.forEach(function(t) { if (!seen[t] && !ENGLISH_STOP_WORDS.has(t) && !isNonTickerWord(t, text)) { seen[t]=1; tickers.push(t); } });
  // 한국 종목코드 (6자리 숫자)
  var m3 = text.match(/\b(\d{6})\b/g);
  if (m3) m3.forEach(function(c) { var s = c + '.KS'; if (!seen[s]) { seen[s]=1; tickers.push(s); } });
  return tickers.slice(0, 5); // v34.4: 최대 5개 (기본 데이터), 심층 비교는 chatSend에서 3개로 재제한
}
