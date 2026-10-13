// P1740: the unified panel read only capitalised symbols, so "엔비디아 실적 어때?" reached the model with no quote,
// trend or filing data while the QuestionPlan had already resolved NVDA. One resolver now feeds both chat surfaces:
// typed symbols + names the plan resolved through the ticker registry + the curated nickname table with a Korean
// particle ("엔비디아는"). A demonstrative follow-up ("이 종목", "그 회사") reuses the previous turn's companies;
// nothing else is inferred (P1339: no ticker guessing). companiesOnly drops index/FX/commodity nicknames, which the
// unified panel answers from its market and domain blocks instead.
import { companyEntitySymbols } from '../orchestrator/question-planner.js';

const PARTICLES = ['에서는', '에서', '으로', '까지', '보다', '처럼', '이랑', '하고', '은', '는', '이', '가', '을', '를', '의', '와', '과', '도', '에', '로', '랑', '만'];
const isMarketProxy = (sym) => /^\^|=X$|=F$|-USD$/.test(String(sym));

export function resolveChatTickers({ query = '', questionPlan = null, state = null, companiesOnly = false, extract = () => [], fuzzy = null } = {}) {
  const text = String(query || '');
  let tickers = [...(extract(text) || [])];
  let named = [];
  try { named = questionPlan ? companyEntitySymbols(questionPlan) : []; } catch { named = []; }
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
  if (!tickers.length && Array.isArray(state?._lastChatTickers) && state._lastChatTickers.length
      && /(?:이|그|해당|위|앞의|방금\s*말한)\s*(?:종목|회사|기업|주식)/.test(text)) tickers = state._lastChatTickers.slice();
  if (tickers.length && state) state._lastChatTickers = tickers.slice(0, 3);
  return tickers.slice(0, 5);
}
