// Test fixtures in the answer envelope the model now writes (src/ai/response/answer-envelope.js): markdown text
// first (the lead before the first "### " heading is the summary, each "### 제목" + body is a section), then one trailing
// [AI_ANSWER_META]{claims, citations, followUps, remember}[/AI_ANSWER_META] block. Gates describe a case as the plan fields
// it means and get the text the model would send.
export function answerBodyText({ summary = '', sections = [] } = {}) {
  return [String(summary || '').trim(), ...(sections || []).map((section) => `### ${section.title}\n${section.body}`)].filter(Boolean).join('\n\n');
}

// `meta: false` leaves the trailing block off (a complete answer with no claims); a field left undefined is not written.
export function answerEnvelopeText(plan = {}, { meta = true } = {}) {
  const body = answerBodyText(plan);
  if (!meta) return body;
  const fields = {};
  for (const key of ['claims', 'citations', 'followUps', 'remember']) if (plan[key] !== undefined) fields[key] = plan[key];
  return `${body}\n\n[AI_ANSWER_META]${JSON.stringify(fields)}[/AI_ANSWER_META]`;
}
