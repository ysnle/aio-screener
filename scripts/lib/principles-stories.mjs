// Reading text for the 112 principles lessons, merged from the per-chapter authoring files.
// Standard (article column ≈ 50 Korean chars per line): every block reads as 2–5 lines (60–230 chars); a lesson
// is lead + two body paragraphs + twist (380–760 chars, about one screen). `long: true` stories may carry a third
// paragraph for multi-step mechanisms or worked arithmetic (≤ 980 chars).
import { STORIES_A_D } from './principles-stories-a-d.mjs';
import { STORIES_E_H } from './principles-stories-e-h.mjs';
import { STORIES_I_K } from './principles-stories-i-k.mjs';
import { STORIES_L_M } from './principles-stories-l-m.mjs';
import { STORIES_N_O } from './principles-stories-n-o.mjs';

export const PRINCIPLE_STORIES = { ...STORIES_A_D, ...STORIES_E_H, ...STORIES_I_K, ...STORIES_L_M, ...STORIES_N_O };

export const STORY_LIMITS = { block: 230, minBlock: 60, minTotal: 380, total: 760, longTotal: 980 };

export function storyProblems(id, story) {
  const blocks = [story.lead, ...(story.body || []), story.twist];
  const problems = [];
  if (!story.lead || !story.twist || !Array.isArray(story.body) || story.body.length < 2) problems.push(`${id}: needs lead, two body paragraphs and twist`);
  if ((story.body || []).length > (story.long ? 3 : 2)) problems.push(`${id}: too many body paragraphs`);
  blocks.forEach((block, index) => {
    const length = String(block || '').length;
    if (length > STORY_LIMITS.block) problems.push(`${id}: block ${index} is ${length} chars`);
    if (length < STORY_LIMITS.minBlock) problems.push(`${id}: block ${index} is only ${length} chars`);
  });
  const total = blocks.join('').length;
  if (total > (story.long ? STORY_LIMITS.longTotal : STORY_LIMITS.total)) problems.push(`${id}: ${total} chars total`);
  if (total < STORY_LIMITS.minTotal) problems.push(`${id}: only ${total} chars total`);
  if (/[?？]/.test(blocks.slice(1).join(''))) problems.push(`${id}: question outside the lead`);
  return problems;
}
