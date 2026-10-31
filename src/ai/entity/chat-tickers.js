// P1740: the unified panel read only capitalised symbols, so "엔비디아 실적 어때?" reached the model with no quote,
// trend or filing data while the QuestionPlan had already resolved NVDA. One resolver now feeds both chat surfaces:
// typed symbols + names the plan resolved through the ticker registry + the curated nickname table with a Korean
// particle ("엔비디아는"). A demonstrative follow-up ("이 종목", "그 회사") reuses the previous turn's companies;
// nothing else is inferred (P1339: no ticker guessing). companiesOnly drops index/FX/commodity nicknames, which the
// unified panel answers from its market and domain blocks instead.
import { companyEntitySymbols } from '../orchestrator/question-planner.js';

const PARTICLES = ['에서는', '에서', '으로', '까지', '보다', '처럼', '이랑', '하고', '은', '는', '이', '가', '을', '를', '의', '와', '과', '도', '에', '로', '랑', '만'];
const isMarketProxy = (sym) => /^\^|=X$|=F$|-USD$/.test(String(sym));
// v58.75 (persona review): a question with no company of its own on 종목·재무·차트 reads the company the screen shows
// (screenTicker). That symbol is observed screen state the reader selected, not a guess from the question, so P1339
// (never turn typed text into another issuer) is untouched. A market/sector question keeps no ticker. The result's
// `source` says where the tickers came from: 'query', 'followup' (previous turn) or 'screen'.
const MARKET_WIDE = /시장|지수|코스피|코스닥|나스닥|s&p|다우|러셀|섹터|업종|테마|금리|환율|달러|유가|거시|경기|kospi|kosdaq|nasdaq/i;
const SCREEN_SYMBOL = /^[A-Z0-9^][A-Z0-9.=^-]{0,14}$/;
// 차트 reads the symbol the chart drew (stock-chart.js root._aioChartSubject); 종목·재무 the analysed ticker, then the hub subject.
export function screenSubjectTicker(root, ctxId) {
  const value = ctxId === 'technical' ? root?._aioChartSubject : /^(ticker|fundamental)$/.test(ctxId) ? root?._currentTickerId || root?._aioLastOpenedSymbol : '';
  return String(value || '').trim().toUpperCase();
}

export function resolveChatTickers({ query = '', questionPlan = null, state = null, companiesOnly = false, extract = () => [], fuzzy = null, screenTicker = '', root = null, ctxId = '' } = {}) {
  const text = String(query || '');
  let tickers = [...(extract(text) || [])];
  let named = [];
  try { named = questionPlan ? companyEntitySymbols(questionPlan) : []; } catch { named = []; }
  // v59.45 (P11-ENTITY-01): the registry's spelling of a class share (BRK.B or BRK-B) replaces the typed one instead of
  // standing beside it as a second subject.
  const classKey = (sym) => String(sym).toUpperCase().replace(/[./]/g, '-');
  tickers = tickers.filter((t) => !named.some((n) => n !== t && classKey(n) === classKey(t)));
  for (const sym of named) if (!tickers.includes(sym)) tickers.push(sym);
  // A six-digit code is read as KOSPI by the legacy extractor; the registry's KOSDAQ listing wins.
  tickers = tickers.filter((t) => { const m = /^(\d{6})\.KS$/.exec(t); return !(m && tickers.includes(`${m[1]}.KQ`)); });
  if (!tickers.length && typeof fuzzy === 'function') {
    for (const tok of text.split(/[\s,;.!?·…()[\]]+/)) {
      if (!tok || tok.length < 2) continue;
      let hit = fuzzy(tok);
      for (const p of PARTICLES) {
        if (hit) break;
        if (tok.length - p.length >= 2 && tok.endsWith(p)) hit = fuzzy(tok.slice(0, -p.length));
      }
      if (hit && !tickers.includes(hit)) tickers.push(hit);
    }
  }
  if (companiesOnly) tickers = tickers.filter((t) => !isMarketProxy(t));
  let source = tickers.length ? 'query' : '';
  const screen = String(screenTicker || (root ? screenSubjectTicker(root, ctxId) : '')).trim().toUpperCase();
  const screenValid = SCREEN_SYMBOL.test(screen) && !(companiesOnly && isMarketProxy(screen));
  const screenOk = screenValid && !MARKET_WIDE.test(text);
  // "이 종목" on a screen that shows a company is that company; "그/방금 말한 종목" is the previous turn's.
  if (!tickers.length && screenValid && /(?:^|[^가-힣])이\s*(?:종목|회사|기업|주식)/.test(text)) { tickers = [screen]; source = 'screen'; }
  if (!tickers.length && Array.isArray(state?._lastChatTickers) && state._lastChatTickers.length
      && /(?:이|그|해당|위|앞의|방금\s*말한)\s*(?:종목|회사|기업|주식)/.test(text)) { tickers = state._lastChatTickers.slice(); source = 'followup'; }
  if (!tickers.length && screenOk) { tickers = [screen]; source = 'screen'; }
  if (tickers.length && state) state._lastChatTickers = tickers.slice(0, 3);
  // An index chart (^GSPC) is not a company: it is handed back as screenProxy for the chart-indicator block only.
  const screenProxy = !tickers.length && companiesOnly && SCREEN_SYMBOL.test(screen) && isMarketProxy(screen) && !MARKET_WIDE.test(text) ? screen : '';
  return Object.assign(tickers.slice(0, 5), { source, screenProxy });
}
