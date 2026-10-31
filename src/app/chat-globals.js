// v59.48 (boot budget): the chat-only window.AIO helpers that js/aio-chat.js reads — the question-selected market facts
// (market-content.js, with the chart-scenario, company-analysis and custom-condition readers it pulls in), the answer
// shape (answer-modes.js) and the answer principles (answer-principles.js). No boot caller reads them, so they left
// compatibility-globals.js: src/app/chat-loader.js imports this module beside the classic chat script and replays queued
// panel calls (and resolves AIO.loadChat, which the T-tests wait on) only after it is installed.
// v59.49: the screener query engine joins them; its inputs (AIO.screenerQueryInput/screenerFactorAsOf) stay in
// compatibility-globals.js beside the screener state.
import { buildMarketContentContext, buildQuestionDomainContext } from '../ai/context/market-content.js';
import { buildScreenerAiContext, detectSectorQuery, formatScreenerResultPrompt, runScreenerQuery } from '../ai/context/screener-query.js';
import { chooseAnswerMode, answerModeGuide } from '../ai/response/answer-modes.js';
import { buildAnswerPrinciples, describeAnswerVisuals, promptWithoutWebSearch } from '../ai/response/answer-principles.js';

export function installChatGlobals(root = globalThis) {
  root.AIO = root.AIO || {};
  Object.assign(root.AIO, { buildMarketContentContext, buildQuestionDomainContext, chooseAnswerMode, answerModeGuide, buildAnswerPrinciples, describeAnswerVisuals, promptWithoutWebSearch });
  const input = () => (typeof root.AIO.screenerQueryInput === 'function' ? root.AIO.screenerQueryInput() : null) || { rows: [] };
  const rankAsOf = () => (typeof root.AIO.screenerFactorAsOf === 'function' ? root.AIO.screenerFactorAsOf() : null);
  root._aioRunScreenerQuery = (query, opts) => runScreenerQuery(query, { ...input(), recentTickers: opts?.recentTickers || [] });
  root._formatScreenerResultPrompt = (result) => formatScreenerResultPrompt(result, { rankAsOf: rankAsOf() });
  root._aioBuildScreenerAiContext = (query, messages, logger) => buildScreenerAiContext(query, messages, { ...input(), logger });
  root._detectSectorQuery = (text) => detectSectorQuery(text, { rows: input().rows });
  return root.AIO;
}
