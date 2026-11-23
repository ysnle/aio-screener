// The fall bars' frame, shared by every screen that draws falls from a closing high on the opening's scale —
// indexes (오늘, 시장 상태), past episodes (기술적 분석), stocks (시장 폭), theme members (테마와 섹터). Kept apart from
// market-story.js so a screen that needs only the frame does not load the whole story.
import { RULES } from '../../rules/thresholds.js';

/** The stage word on the printed (one-decimal) fall, so the word and the number a reader sees always agree. */
export function stageOf(fall) {
  const S = RULES.story;
  const shown = Number(Number(fall).toFixed(1));
  if (shown <= -S.bearPct) return { word: 'bear', threshold: -S.bearPct, relation: 'atMost' };
  if (shown <= -S.bearPct + S.bearEdgePp) return { word: 'bear-edge', threshold: -S.bearPct, relation: 'above' };
  if (shown <= -S.correctionPct) return { word: 'correction', threshold: -S.correctionPct, relation: 'atMost' };
  return null;
}

/**
 * bars: [{ id, label, part, value (the fall, negative %), valueText, stage }] → one scale in 5% steps that always shows the
 * 약세장 line, and the 조정 and 약세장 lines.
 */
export function fallFrame(bars) {
  const S = RULES.story;
  const deepest = Math.max(S.bearPct + 5, ...bars.map((bar) => -bar.value));
  return { bars, scale: Math.ceil(deepest / 5) * 5, marks: [{ at: S.correctionPct, word: '조정' }, { at: S.bearPct, word: '약세장' }] };
}
