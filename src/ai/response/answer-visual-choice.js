// v58.80 (first-users bundle 4): which figures fit a question, split from ai-answer-visuals.js so the AI prompt can
// name them at boot while the figure builders (and the fiscal reader they pull in) load with the first answer.
const CHART_WORDS = /차트|추세|이평|이동\s*평균|지지|저항|돌파|이탈|기술적|셋업|패턴|모멘텀|rsi|macd|chart|trend|support|resistance|breakout/i;
const FUNDAMENTAL_WORDS = /실적|매출|이익|마진|이익률|재무|펀더멘탈|현금\s*흐름|fcf|성장률|분기|어닝|가이던스|밸류에이션|per\b|earnings|revenue|margin|fundamental|quarter/i;
const COMPARE_WORDS = /비교|대비|vs\.?|versus|어느\s*쪽|차이/i;
const THEME_WORDS = /섹터|테마|업종|로테이션|순환|주도|병목|반도체|소프트웨어|광통신|포토닉스|메모리|전력|조선|방산|원전|바이오|2차전지/i;

const isKr = (symbol) => /\.(KS|KQ)$/i.test(String(symbol || ''));

// Which figures fit this question. At most two, so a figure supports the answer instead of replacing it.
export function chooseAnswerVisuals({ query = '', mode = 'analysis', canonical = [], tickers = [] } = {}) {
  const companies = (Array.isArray(tickers) ? tickers : []).filter((symbol) => symbol && !/^\^|=X$|=F$|-USD$/.test(symbol)).slice(0, 3);
  // P1743: a market-level outlook question gets the branch table, and the theme stages when it is about themes/sectors.
  if (!companies.length && mode === 'outlook') return [{ kind: 'crossroads', symbols: [] }, ...(THEME_WORDS.test(query) ? [{ kind: 'themes', symbols: [] }] : [])];
  if (!companies.length && THEME_WORDS.test(query) && mode !== 'quick') return [{ kind: 'themes', symbols: [] }];
  if (!companies.length || mode === 'quick' && !CHART_WORDS.test(query) && !FUNDAMENTAL_WORDS.test(query)) return [];
  const picks = [];
  if (companies.length >= 2 && (mode === 'comparison' || COMPARE_WORDS.test(query))) picks.push({ kind: 'relative', symbols: companies });
  const lead = companies[0];
  const wantsChart = CHART_WORDS.test(query) || canonical.includes('TECHNICAL_ANALYSIS');
  const wantsFundamentals = FUNDAMENTAL_WORDS.test(query);
  if (wantsFundamentals && !isKr(lead)) picks.push({ kind: 'fundamentals', symbols: [lead] });
  if (wantsChart || (!picks.length && (mode === 'decision' || mode === 'analysis'))) picks.push({ kind: 'price', symbols: [lead] });
  return picks.slice(0, 2);
}
