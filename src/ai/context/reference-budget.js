// Chat context budget. The news block the news tool returns (src/ui/chat/panel.js _buildNewsContext) has its own
// explicit size: up to 8 items, titles 160 and summaries 300 characters, 6,000 characters in total. Reference material
// (imported research, the knowledge base, the frameworks) is read through the reference tool, capped by the tool runner.
export const CHAT_REFERENCE_BUDGET = Object.freeze({
  news: 6000,
  newsItems: 8,
  newsTitleChars: 160,
  newsSummaryChars: 300
});
