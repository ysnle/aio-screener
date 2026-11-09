// Which capitalised words in a question are not tickers. The typed-symbol scan
// (src/ai/entity/extract-tickers.js) and the entity resolver (src/ai/entity/resolver.js) kept two lists that disagreed:
// "WTI 전망" was a plain word to one and an unverified symbol to the other, "멀티에셋 PM의 관점" a role to one and a
// ticker to the other. Both read these sets now.

// Finance acronyms, currency codes and agencies are terms, never symbols (USD is a listed ETF, SEC/CEO/FED/WTI words).
export const NON_TICKER_ACRONYMS = new Set(['AI', 'API', 'SEC', 'FOMC', 'FED', 'PER', 'PBR', 'PSR', 'PEG', 'ROE', 'ROA', 'IT', 'IPO',
  'CEO', 'CFO', 'COO', 'CTO', 'RSI', 'MACD', 'CPI', 'PCE', 'PPI', 'NFP', 'GDP', 'PMI', 'ISM', 'VIX', 'ETF', 'FX', 'USD', 'KRW', 'JPY',
  'EUR', 'CNY', 'GBP', 'US', 'KR', 'UK', 'EU', 'DCF', 'DDM', 'NAV', 'FCF', 'EPS', 'EBITDA', 'IV', 'GEX', 'ATM', 'OTM', 'OK', 'ATR', 'EMA',
  'SMA', 'VCP', 'SEPA', 'VWAP', 'YOY', 'MOM', 'QOQ', 'FFR', 'QE', 'QT', 'WTI', 'ECB', 'BOJ', 'IMF', 'OPEC', 'NYSE', 'FDA', 'DOJ', 'FTC',
  'KOSPI', 'KRX']);

// Role and industry words ("멀티에셋 PM", "서버/HW") are symbols only when a company question follows them
// ("PM 실적", "IR 주가"; PM/IR/HR/UI are listed). $PM always resolves.
export const ROLE_OR_INDUSTRY_WORDS = new Set(['PM', 'HW', 'SW', 'IB', 'PE', 'VC', 'HY', 'IG', 'IR', 'HR', 'PR', 'QA', 'UI', 'UX', 'OS',
  'CIO', 'AUM', 'CFA', 'LP', 'GP', 'EM', 'DM', 'ESG', 'OEM', 'ODM', 'SAAS', 'GPU', 'CPU', 'HBM', 'DRAM', 'NAND', 'EUV', 'LLM', 'IDC', 'EV',
  'ESS', 'TAM', 'KPI', 'CAGR', 'EBIT', 'ROIC', 'WACC', 'OAS', 'BEI', 'TIPS', 'ACM', 'CCC', 'RRG', 'ADR', 'OHLC', 'IC', 'VAR', 'CAPEX', 'OPEX']);

// English words typed in capitals. Only the registry-free scan needs them: the resolver confirms a capital word against the
// ticker registry, so "NOW 실적" still reaches ServiceNow there.
export const ENGLISH_STOP_WORDS = new Set(('OR AM AT BE BY DO GO IF IN IS MY NO OF ON SO TO UP WE ALL AND ARE BUT CAN DID FOR GET GOT HAS HAD '
  + 'HER HIM HIS HOW ITS LET MAY NEW NOT NOW OLD ONE OUR OUT OWN RUN SAY SET SHE THE TOO TRY TWO USE WAY WHO WHY WIN WON YES YET YOU ALSO '
  + 'BEEN BEST BOTH BULL BEAR CALL COME EACH FROM GOOD HAVE HERE HIGH JUST KNOW LAST LIKE LONG LOOK MADE MAKE MORE MOST MUCH MUST NEED NEXT '
  + 'ONLY OVER SELL SOME SUCH TAKE TELL THAN THAT THEM THEN THEY THIS TIME VERY WANT WEEK WELL WENT WERE WHAT WHEN WILL WITH WORK YOUR ABOUT '
  + 'AFTER COULD EVERY FIRST GREAT OTHER SHORT SINCE STILL THEIR THERE THESE THINK THOSE THREE TODAY UNDER WHERE WHICH WHILE WOULD').split(' '));

const COMPANY_QUESTION_AFTER = '\\s*(?:의\\s*)?(?:주가|실적|매출|종목|주식|티커|배당|차트|목표가|어때|전망|stock|shares|earnings)';

/** True when `word` (upper case) in `text` is a term, not a symbol: an acronym, or a role word with no company question after it. */
export function isNonTickerWord(word, text) {
  if (NON_TICKER_ACRONYMS.has(word)) return true;
  return ROLE_OR_INDUSTRY_WORDS.has(word) && !new RegExp(`\\b${word}\\b${COMPANY_QUESTION_AFTER}`, 'i').test(String(text || ''));
}
