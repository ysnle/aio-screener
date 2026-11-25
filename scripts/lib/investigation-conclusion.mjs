// The market investigation's conclusion as fact lines for the other AI texts that speak about the same session: the market
// narrative (브리핑 AI 해설, scripts/producer/market-narrative.mjs) and the 시장 상태 reading (scripts/lib/screen-reading.mjs).
// The investigation (scripts/lib/market-investigation.mjs) is the one place that searches for why the market moved; the
// other texts carry its verdict instead of finding a second cause of their own, so two texts on one site tell one account.
//
// The lines carry the investigation's structured answer only — each cause's claim with its evidence kind (and, for a
// report, the outlet and date it was found in) and what it could not confirm — never its paragraphs. A missing, blocked,
// quiet or other-session investigation gives no lines, and then the check below has nothing to read: the texts are
// written and checked as before.
//
// The check is the investigation's own two states read against a text: with no reported cause, a sentence on the
// session that states a cause as fact (no report, no inference word) is flagged; with a reported cause and nothing left
// open, a sentence saying the cause was not found is flagged. Both are repairable issues (the retry is told why).
import { createHash } from 'node:crypto';
import { DIAGNOSIS_WORDS } from '../../src/domain/market/story/market-story.js';

export const INVESTIGATION_FACT_HEAD = '조사 결론';
const KIND_WORDS = Object.freeze({ news: '보도', official: '공식 발표' });
const CLAIM_MAX = 220;
const md = (iso) => { const [, m, d] = String(iso || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const clean = (text) => {
  const value = String(text || '').replace(/\s+/g, ' ').trim();
  return value.length > CLAIM_MAX ? `${value.slice(0, CLAIM_MAX - 1)}…` : value;
};

/**
 * The fact lines of a verified investigation of `session` (the US close the text is written on), [] otherwise.
 * Head line: the session and the rule; then one line per cause (확인 with its source, or 추론) and per open question (미확인).
 */
export function investigationFactLines(investigation, { session = null } = {}) {
  const iv = investigation && typeof investigation === 'object' ? investigation : null;
  if (!iv || iv.status !== 'verified' || !session || iv.session?.us !== session) return [];
  const causes = (Array.isArray(iv.causes) ? iv.causes : []).filter((cause) => cause?.claim && cause.kind);
  const unknowns = (Array.isArray(iv.unknowns) ? iv.unknowns : []).map(clean).filter(Boolean);
  if (!causes.length && !unknowns.length) return [];
  const H = INVESTIGATION_FACT_HEAD;
  const lines = [`${H} 기준: ${md(session)} 미국 세션의 AI 원인 조사(이 사이트의 원인 조사 — '확인' 원인만 원인으로 쓰고, '추론'은 해석으로만, '미확인'은 원인으로 단정하지 않는다)`];
  for (const cause of causes) {
    const claim = clean(cause.claim);
    if (cause.kind === 'news' || cause.kind === 'official') lines.push(`${H} 확인(${KIND_WORDS[cause.kind]} ${md(cause.date)} ${clean(cause.outlet) || '출처 미상'}): ${claim}`);
    else if (cause.kind === 'price') lines.push(`${H} 확인(가격 자료): ${claim}`);
    else lines.push(`${H} 추론(보도로 확인 안 됨): ${claim}`);
  }
  for (const text of unknowns) lines.push(`${H} 미확인: ${text}`);
  return lines;
}

/** A short signature of the lines (empty without them), for a producer's reuse key. */
export const investigationSignature = (lines = []) => (lines.length ? `iv:${createHash('sha1').update(lines.join('\n')).digest('hex').slice(0, 12)}` : '');

// ---- the check -------------------------------------------------------------------------------------------------------------
const HEAD_LINE = new RegExp(`^${INVESTIGATION_FACT_HEAD} 기준: (\\d{1,2})\\/(\\d{1,2}) `, 'm');
const REPORTED_LINE = new RegExp(`^${INVESTIGATION_FACT_HEAD} 확인\\((?:보도|공식 발표) `, 'm');
const OPEN_CAUSE_LINE = new RegExp(`^${INVESTIGATION_FACT_HEAD} 미확인: [^\\n]*(?:원인|촉매|이유|배경|재료)`, 'm');
// A cause stated as fact: a causal ending or a verb that makes one thing the trigger of the move.
const CAUSE_ASSERTED = /때문(?:입니다|이었습니다|이다|에)|탓(?:입니다|이다|에|으로)|(?:로|으로)\s?인해|여파(?:로|입니다|였습니다)|촉발(?:했|됐|되었|된|시켰)|(?:하락|급락|상승|급등|반등|매도|매수)을\s?(?:이끌었|불렀|낳았|촉발)|원인(?:은|이)\s?[^.。]{1,40}(?:입니다|였습니다)/;
// The ways a sentence keeps a cause as a report or an inference (the investigation's own words for an open cause).
const HEDGED = /따르면|보도|기사|헤드라인|거론|전해|추정|추론|해석|가능성|보입니다|보인다|로\s?읽|일\s?수|확인되지|단정|미확인|진단|아닌지|인지\s/;
// A sentence saying the session's cause was not found.
const CAUSE_DENIED = /(?:원인|촉매|재료|이유|배경)(?:은|는|이|가|을|를)?\s?(?:아직\s?)?(?:확인되지\s?않|확인하지\s?못|불분명|뚜렷하지\s?않|알\s?수\s?없|찾지\s?못|나오지\s?않)|(?:원인|촉매|재료)\s?(?:없이|없는)\s/;
// In-session, after-hours and futures sentences are about another moment than the investigated close.
const OTHER_MOMENT = /장중|시간외|선물|미수집|잠정/;
const DIAGNOSIS = new RegExp(Object.values(DIAGNOSIS_WORDS).join('|'));
const CONDITIONAL = /(?:하면|이면|되면|라면|으면|경우)\s/;

/**
 * The issues of one text (a market narrative or a screen reading) against the investigation lines in `context`:
 * 'investigation-cause-unconfirmed' and 'investigation-cause-contradicted'; [] when the context carries no investigation.
 */
export function investigationCauseIssues(body, { context = '' } = {}) {
  const text = String(context || '');
  const head = HEAD_LINE.exec(text);
  if (!head) return [];
  const sessionDate = new RegExp(String.raw`(?<![\d/])${head[1]}\/${head[2]}(?!\d)|${head[1]}월\s?${head[2]}일`);
  const reported = REPORTED_LINE.test(text);
  const openCause = OPEN_CAUSE_LINE.test(text);
  const issues = new Set();
  for (const sentence of String(body || '').replace(/\[[^\]\n]*\]/g, ' ').split(/(?<=[.!?。])\s+|\n+/)) {
    if (!sentence.trim() || OTHER_MOMENT.test(sentence)) continue;
    // Nothing reported: a cause stated as fact for the investigated session goes beyond the investigation.
    if (!reported && sessionDate.test(sentence) && CAUSE_ASSERTED.test(sentence) && !HEDGED.test(sentence) && !DIAGNOSIS.test(sentence) && !CONDITIONAL.test(sentence)) {
      issues.add('investigation-cause-unconfirmed');
    }
    // A reported cause and no cause left open: "the cause was not found" contradicts it. A sentence dated another day is
    // about that day.
    const dates = [...sentence.matchAll(/(?<![\d/])\d{1,2}\/\d{1,2}(?!\d)/g)];
    if (reported && !openCause && CAUSE_DENIED.test(sentence) && (!dates.length || sessionDate.test(sentence))) issues.add('investigation-cause-contradicted');
  }
  return [...issues];
}
// The retry guidance: market-analysis-validate.mjs MARKET_ANALYSIS_ISSUE_HELP (narrative) and src/ai/reading/reading-core.js
// ISSUE_TEXT (screen readings).
