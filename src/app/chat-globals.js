// v59.48 (boot budget): the chat-only window.AIO helpers that src/ui/chat/panel.js reads — the question-selected market facts
// (market-content.js, with the chart-scenario, company-analysis and custom-condition readers it pulls in), the answer
// shape (answer-modes.js) and the answer principles (answer-principles.js). No boot caller reads them, so they left
// compatibility-globals.js: the panel module imports this file and installs it before it defines anything, and
// src/app/chat-loader.js replays queued panel calls (and resolves AIO.loadChat, which the T-tests wait on) after that.
// The screener query engine joins them; it reads the page's rows and quotes itself (screenerInput), the factor
// date through AIO.screenerFactorAsOf in compatibility-globals.js beside the screener state.
import { buildMarketContentContext, buildQuestionDomainContext } from '../ai/context/market-content.js';
import { buildScreenerAiContext, runScreen, screenerInput } from '../ai/context/screener-query.js';
import { chooseAnswerMode, answerModeGuide } from '../ai/response/answer-modes.js';
import { buildAnswerPrinciples, describeAnswerVisuals, promptWithoutWebSearch } from '../ai/response/answer-principles.js';
import { CHAT_REFERENCE_BUDGET } from '../ai/context/reference-budget.js'; // 2026-11-02 chat context budget
import { buildChatMacroLines, kstStamp } from '../ai/context/chat-macro-lines.js';
import * as macroReleaseEvidence from '../ai/context/macro-release-evidence.js';
import { AI_WORKER_CONTRACT } from '../domain/ai/worker-contract.js'; // S5: model id, body limit, header names
import { recordAnswerQuality, summariseAnswerQuality } from '../ai/telemetry/answer-quality-log.js';
import { answerReferenceText } from '../ai/response/publication.js';
import { earlierTurnsPromptBlock, relatedEarlierTurns, turnEntities } from '../ai/session/earlier-turns.js';
import { addNotes, loadNotes, notesPromptBlock } from '../ai/session/reader-notes.js';
import { chatToolKit } from '../ai/tools/loop.js';
import { toolsPromptWithoutSearch } from '../ai/tools/registry.js';
import { createChatRunKit } from '../ui/components/chat-run-status.js';
import { personalGate, personalTurn, PERSONAL_CONSENT_CARD } from '../ai/context/personal-turn.js';
import { readWatchlistSymbols } from '../data/watchlist-store.js';
import { showConsentChoices } from '../ui/components/chat-consent-choices.js';
import { companyMatcher } from '../domain/briefing/news-picks.js';
import { decideQuoteBasis, quoteBasisLine } from '../ai/time/quote-basis.js'; // close vs intraday price basis
import { composeLeanPrompt } from '../ai/prompt/lean-prompt.js'; // the system prompt of a turn that offers the tools
import { buildMarketOpening, openingFactLines } from '../domain/market/story/market-story.js';
import { EVENT_BRIEFS, INDEX_LONGRUN, MARKET_DAY } from '../data/artifact-registry.js';
import { latestMarketInterpretation } from '../data/selectors/interpretation.js';
import { investigationContext } from '../ai/context/investigation-context.js';

/** The opening read as context lines (market-story.js), from the closes, FRED history and long-run tables the page holds. */
function marketOpeningContext(root) {
  try {
    // The last interpretation the page built gives the cross-market rows their axis states and the release calendar.
    const shared = latestMarketInterpretation(root);
    const lines = openingFactLines(buildMarketOpening({ history: root._aioHistory || [], macroHistory: root._aioMacroHistory || null, longrun: root[INDEX_LONGRUN.key] || null,
      day: root[MARKET_DAY.key] || null, briefs: root[EVENT_BRIEFS.key] || null, afterHours: root._aioAfterHours || null, regime: shared?.regime || null, events: shared?.events || [], earnings: shared?.indexEarnings || null }));
    return lines.length ? `시장 이야기 (화면 머리말과 같은 사실 — 진단 상태어는 바꾸지 말 것):\n${lines.map((line) => `- ${line}`).join('\n')}` : '';
  } catch (_) { return ''; }
}

export function installChatGlobals(root = globalThis) {
  root.AIO = root.AIO || {};
  Object.assign(root.AIO, { buildMarketContentContext, buildQuestionDomainContext, chooseAnswerMode, answerModeGuide, buildAnswerPrinciples, describeAnswerVisuals, promptWithoutWebSearch, chatReferenceBudget: CHAT_REFERENCE_BUDGET, buildChatMacroLines, macroReleaseEvidence, aiWorkerContract: AI_WORKER_CONTRACT });
  // The answer-quality log: the response pipeline records each finished answer; the operator reads the summary from the console.
  const storage = () => { try { return root.localStorage || null; } catch (_) { return null; } };
  root.AIO.recordAnswerQuality = (entry) => recordAnswerQuality(storage(), entry);
  root.AIO.answerQualitySummary = (options) => summariseAnswerQuality(storage(), options);
  root.AIO.answerReferenceText = answerReferenceText; // the injected data an answer's figures are checked against
  // The chat's quote evidence (js/aio-core.js buildAIQuoteEvidenceRow) reads its price basis here; without it a
  // quote is never usable, so the evidence fails closed before the chat loads.
  root.AIO.decideQuoteBasis = decideQuoteBasis;
  root.AIO.quoteBasisLine = quoteBasisLine;
  // Holdings and watchlist questions (personal-turn.js); the watchlist is read here, the consent buttons are drawn by the UI.
  const watchlist = () => { try { return readWatchlistSymbols(root.localStorage); } catch (_) { return []; } };
  Object.assign(root.AIO, { personalGate, personalTurn: (turn) => personalTurn({ ...turn, watchlist: watchlist() }), personalConsentCard: PERSONAL_CONSENT_CARD,
    showHoldingsConsentChoices: () => showConsentChoices(root.document, PERSONAL_CONSENT_CARD, '_aioHoldingsConsentAnswer') });
  // The opening read the 오늘 and 시장 상태 faces lead with, and the day's investigation 오늘 shows, join the screen basis,
  // so the chat tells the same story.
  root.AIO.composeLeanPrompt = (turn) => composeLeanPrompt({ ...turn, root, screenBasis: [turn?.screenBasis, marketOpeningContext(root), investigationContext(root)].filter(Boolean).join('\n') });
  root.AIO.chatTools = chatToolKit(root); // the data tools the model may call (src/ai/tools/), run by callSharedAi
  root.AIO.promptWithoutWebSearch = (prompt) => toolsPromptWithoutSearch(promptWithoutWebSearch(prompt)); // a retry runs without search
  // The waiting line of a running answer; its question is kept in this tab's sessionStorage until the answer arrives, so
  // a reload during the wait offers it again once the panel loads.
  root.AIO.chatRun = createChatRunKit(root, root.document, { storage: () => { try { return root.sessionStorage || null; } catch (_) { return null; } } });
  try { root.AIO.chatRun.showPendingCard(); } catch (_) { /* the panel works without the card */ }
  // Reader memory on this device: the ids a question is about, and earlier saved conversations about the same ids. The
  // saved conversations come from the panel's session api (src/ui/components/chat-sessions.js), which returns none
  // without the conversation-saving consent; the open conversation is already in the model context.
  root.AIO.chatTurnEntities = ({ tickers = [], themeId = null } = {}) => turnEntities([...(Array.isArray(tickers) ? tickers : []), ...(themeId ? [`THEME:${themeId}`] : [])]);
  root.AIO.relatedEarlierTurnsBlock = ({ entities = [], now = Date.now() } = {}) => {
    const sessions = root.__aioChatSessions;
    return sessions?.saved ? earlierTurnsPromptBlock(relatedEarlierTurns(sessions.saved(), { entities, excludeSessionId: sessions.sessionId || null, now })) : '';
  };
  // What the reader told the assistant (an answer plan's `remember`), under the same consent. The returned line is shown
  // once under the answer, so nothing is remembered silently.
  const consented = () => root.__aioChatSessions?.consented?.() === true;
  root.AIO.readerNotesBlock = () => (consented() ? notesPromptBlock(loadNotes(storage())) : '');
  root.AIO.rememberReaderNotes = (notes, { now = Date.now() } = {}) => {
    const added = addNotes(storage(), notes, { consented: consented(), now });
    return Array.isArray(added) && added.length ? `기억해 둡니다: ${added.map((text) => `"${text}"`).join(', ')}. 답변 맞춤에서 보거나 지울 수 있습니다.` : '';
  };
  root._aioCompanyMatcher = (symbol, name, aliases) => companyMatcher(symbol, name, { aliases }); // the chat's stock-news filter reads headlines by the news issuer rule
  root._aioKstStamp = kstStamp; // the chat's and the workspace prompt's assembly time, in KST on any device
  // One screener engine (src/ai/context/screener-query.js) for the screen tool, the broad comparison sample and the
  // T-tests (_aioRunScreen takes the tool's structured spec).
  root._aioRunScreen = (spec) => runScreen(spec, screenerInput(root));
  root._aioBuildScreenerAiContext = (query, messages, logger) => buildScreenerAiContext(query, messages, { ...screenerInput(root), logger });
  return root.AIO;
}
