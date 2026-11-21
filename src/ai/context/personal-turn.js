// One decision for a question about the reader's own holdings or watchlist.
//
// Before: holdings were attached only on the 포트폴리오 screen, a holdings question asked anywhere else got a general
// answer, and the conduct check then replaced that finished answer with "AI 안전 모드 … 동의 후에만" (29 seconds and a
// model call later, with no way to consent from the chat). Now the question is recognised before any model call:
// a reader with holdings who has not consented is asked in the chat, once, with both ways forward; a consented reader's
// rows go with the question from any screen; a reader with nothing entered is told so in the answer.
const PERSONAL = /내\s*(?:포트폴리오|종목|보유|계좌|관심|주식|것)|(?:보유|관심)\s*(?:종목|주식)|포트폴리오|리밸런싱|복기/;

/** True when the question is about the reader's own holdings or watchlist (always on the 포트폴리오 screen). */
export const personalQuestion = (query, ctxId = '') => ctxId === 'portfolio' || PERSONAL.test(String(query || ''));

function holdingsCount(root) {
  try { return (typeof root.getPortfolioData === 'function' ? root.getPortfolioData() || [] : []).filter((row) => row && row.ticker).length; } catch (_) { return 0; }
}

/**
 * What the chat does with a personal question before the model is called.
 * `ask` — holdings exist, no consent yet, and the reader has not chosen "without holdings" for this question.
 */
export function personalGate({ root = globalThis, query = '', ctxId = '', withoutHoldings = false } = {}) {
  if (!personalQuestion(query, ctxId)) return { personal: false, ask: false };
  const holdings = holdingsCount(root);
  const consented = root.AIO?.hasPortfolioAIConsent?.() === true;
  return { personal: true, holdings, consented, ask: holdings > 0 && !consented && !withoutHoldings };
}

/** The chat card shown instead of a model call when `personalGate().ask` is true. */
export const PERSONAL_CONSENT_CARD = Object.freeze({
  text: '보유 종목을 AI에 보내서 답할까요? 종목·섹터·비중·수익률만 보냅니다. 수량·매수가·목표가·메모·계좌 정보는 보내지 않습니다. 이 기기에서 한 번 동의하면 다음부터 묻지 않습니다.',
  yes: '동의하고 답하기',
  no: '보유 종목 없이 답하기'
});

/**
 * The personal part of the prompt. `pending` is the prompt the 포트폴리오 workbench built from the same rows.
 * Holdings and the watchlist (`watchlist`, the reader's saved symbols, read by the caller) go to the model only with consent.
 */
export function personalTurn({ root = globalThis, query = '', ctxId = '', pending = null, watchlist = [], wrap = (kind, text) => text } = {}) {
  if (pending && String(pending).trim() === query) return { data: true, prompt: '' };
  const gate = personalGate({ root, query, ctxId, withoutHoldings: true });
  if (!gate.personal) return { data: false, prompt: '' };
  if (gate.consented) {
    const line = gate.holdings && typeof root.AIO?.portfolioRowsLine === 'function' ? root.AIO.portfolioRowsLine(root) : '';
    const watch = (Array.isArray(watchlist) ? watchlist : []).slice(0, 40);
    const parts = [
      line ? `사용자 보유 종목(비식별, 종목·섹터·비중·수익률만): ${line}` : '사용자가 앱에 입력한 보유 종목이 없다.',
      watch.length ? `사용자 관심 종목: ${watch.join(', ')}` : '사용자가 등록한 관심 종목이 없다.',
      '보유·관심 종목 각각에 대해 도구로 종가·추세·실적 일정을 확인해 답하고, 목록에 없는 종목을 사용자의 것처럼 말하지 않는다. 입력된 것이 없으면 포트폴리오 화면에서 보유 종목이나 관심 종목을 넣으면 그 기준으로 답할 수 있다고 한 줄로 알린다.'
    ];
    return { data: !!line || watch.length > 0, prompt: wrap('PORTFOLIO_ROWS', parts.join('\n'), { maxChars: 4000 }) };
  }
  return { data: false,
    prompt: `\n\n[포트폴리오]\n이번 질문에는 사용자의 보유·관심 종목이 전송되지 않았다(${gate.holdings ? '사용자가 보유 종목 없이 답을 받기로 함' : '입력된 보유 종목 없음, 전송 동의 전'}). 보유 종목·비중·수익률을 추정하지 말고, 지금 시장 상태에서 보유·관심 종목을 점검하는 기준과 순서를 답한다. 맨 끝에 한 줄로, 포트폴리오 화면에 종목을 넣고 전송에 동의하면 그 종목 기준으로 답한다고 알린다.\n` };
}
