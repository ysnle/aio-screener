// v30.15: typed tickers in a question — $AAPL, a capitalised 2–5 letter symbol that is not a common word, finance
// acronym or (without a company question after it) a role/industry word, and a 6-digit Korean code (.KS); at most 5.
// Moved unchanged from js/aio-chat.js (roadmap item 11, layer 1 채팅); window._extractTickers keeps the legacy name.
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
  var skipWords = {'AI':1,'OR':1,'AM':1,'AT':1,'BE':1,'BY':1,'DO':1,'GO':1,'IF':1,'IN':1,'IS':1,'IT':1,'MY':1,'NO':1,'OF':1,'ON':1,'SO':1,'TO':1,'UP':1,'US':1,'WE':1,
    'ALL':1,'AND':1,'ARE':1,'BUT':1,'CAN':1,'DID':1,'FOR':1,'GET':1,'GOT':1,'HAS':1,'HAD':1,'HER':1,'HIM':1,'HIS':1,'HOW':1,'ITS':1,'LET':1,'MAY':1,'NEW':1,'NOT':1,'NOW':1,'OLD':1,'ONE':1,'OUR':1,'OUT':1,'OWN':1,'RUN':1,'SAY':1,'SET':1,'SHE':1,'THE':1,'TOO':1,'TRY':1,'TWO':1,'USE':1,'WAY':1,'WHO':1,'WHY':1,'WIN':1,'WON':1,'YES':1,'YET':1,'YOU':1,
    'ALSO':1,'BEEN':1,'BEST':1,'BOTH':1,'BULL':1,'BEAR':1,'CALL':1,'COME':1,'EACH':1,'FROM':1,'GOOD':1,'HAVE':1,'HERE':1,'HIGH':1,'JUST':1,'KNOW':1,'LAST':1,'LIKE':1,'LONG':1,'LOOK':1,'MADE':1,'MAKE':1,'MORE':1,'MOST':1,'MUCH':1,'MUST':1,'NEED':1,'NEXT':1,'ONLY':1,'OVER':1,'SELL':1,'SOME':1,'SUCH':1,'TAKE':1,'TELL':1,'THAN':1,'THAT':1,'THEM':1,'THEN':1,'THEY':1,'THIS':1,'TIME':1,'VERY':1,'WANT':1,'WEEK':1,'WELL':1,'WENT':1,'WERE':1,'WHAT':1,'WHEN':1,'WILL':1,'WITH':1,'WORK':1,'YOUR':1,
    'ABOUT':1,'AFTER':1,'COULD':1,'EVERY':1,'FIRST':1,'GREAT':1,'OTHER':1,'SHORT':1,'SINCE':1,'STILL':1,'THEIR':1,'THERE':1,'THESE':1,'THINK':1,'THOSE':1,'THREE':1,'TODAY':1,'UNDER':1,'WHERE':1,'WHICH':1,'WHILE':1,'WOULD':1,
    'ETF':1,'IPO':1,'RSI':1,'MACD':1,'VIX':1,'ATR':1,'EMA':1,'SMA':1,'VCP':1,'SEPA':1,'VWAP':1,'FOMC':1,'GDP':1,'CPI':1,'PPI':1,'NFP':1,'PCE':1,'PMI':1,'ISM':1,'YOY':1,'MOM':1,'QOQ':1,'EPS':1,'PER':1,'PBR':1,'ROE':1,'ROA':1,'FCF':1,'DCF':1,'DDM':1,'NAV':1,'PEG':1,'FFR':1,'QE':1,'QT':1};
  // P1550: finance acronyms and currency codes are not tickers (USD is a listed ETF symbol, SEC/CEO/FED/WTI are plain terms). X22/P1680: role/industry words ("멀티에셋 PM", "서버/HW") are tickers only when a company question follows ("PM 실적", "IR 주가"; PM/IR/HR/UI are listed); $PM always resolves.
  var nonTickerAcronyms = {'SEC':1,'CEO':1,'CFO':1,'COO':1,'CTO':1,'USD':1,'KRW':1,'EUR':1,'JPY':1,'CNY':1,'GBP':1,'FED':1,'WTI':1,'ECB':1,'BOJ':1,'IMF':1,'OPEC':1,'NYSE':1,'FDA':1,'DOJ':1,'FTC':1,'KOSPI':1,'KRX':1}, roleOrIndustryWords = {'PM':1,'HW':1,'SW':1,'IB':1,'PE':1,'VC':1,'HY':1,'IG':1,'IR':1,'HR':1,'PR':1,'QA':1,'UI':1,'UX':1,'OS':1,'CIO':1,'AUM':1,'CFA':1,'LP':1,'GP':1,'EM':1,'DM':1,'ESG':1,'OEM':1,'ODM':1,'SAAS':1,'API':1,'GPU':1,'CPU':1,'HBM':1,'DRAM':1,'NAND':1,'EUV':1,'LLM':1,'IDC':1,'EV':1,'ESS':1,'TAM':1,'KPI':1,'CAGR':1,'EBIT':1,'ROIC':1,'WACC':1,'OAS':1,'BEI':1,'TIPS':1,'ACM':1,'CCC':1,'RRG':1,'ADR':1,'OHLC':1,'IC':1,'VAR':1,'CAPEX':1,'OPEX':1};
  // A class form whose base is a plain word or acronym ("IT-A", "US-B") stays out, as its base did before.
  tickers = tickers.filter(function(t) { var b = classBase[t]; return !b || !(skipWords[b] || nonTickerAcronyms[b] || roleOrIndustryWords[b]); });
  if (m2) m2.forEach(function(t) { if (!seen[t] && !skipWords[t] && !nonTickerAcronyms[t] && (!roleOrIndustryWords[t] || new RegExp('\\b' + t + '\\b\\s*(?:의\\s*)?(?:주가|실적|매출|종목|주식|티커|배당|차트|목표가|어때|전망|stock|shares|earnings)', 'i').test(text))) { seen[t]=1; tickers.push(t); } });
  // 한국 종목코드 (6자리 숫자)
  var m3 = text.match(/\b(\d{6})\b/g);
  if (m3) m3.forEach(function(c) { var s = c + '.KS'; if (!seen[s]) { seen[s]=1; tickers.push(s); } });
  return tickers.slice(0, 5); // v34.4: 최대 5개 (기본 데이터), 심층 비교는 chatSend에서 3개로 재제한
}
