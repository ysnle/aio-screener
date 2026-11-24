// The owner's differentiator (decision-frame audit 2026-11-15): the app does not recommend trades; wherever it gives a
// judgement it shows how to weigh it in odds. One frame for every scenario-like card (매크로 branches on 시장 상태, theme
// stages on 테마, the story cards) and for the AI context:
//   likelihood  past frequency beside its base rate and sample size (pastEvidence: the shared BASE_RATE_SE test and the
//               evidence-strength floors — under 10 cases counts only, 10–29 참고)
//   payoff      how large the good quarter of outcomes was against the bad quarter, beside an ordinary day's — two
//               magnitudes, never one ratio, never an expected value (the records carry no mean), never 손익비 (R724:
//               that word stays where the reader's own plan supplies entry, stop and target)
//   opportunity what cash earned over the same sessions (today's short rate, and the case months' policy rate when the
//               record carries it) and what simply holding the index did on an ordinary day
//   wrong       the invalidation conditions and what being wrong cost before: the share of cases that fell 5% or more
//               inside the window, against an ordinary day
//   favoured    the rule table's side with the kind of ground it stands on: 'cost-hypothesis' (always, for a rule-table
//               favourite) unless the record itself is distinct from its base at 30+ cases on the same side ('past-record')
// A missing input leaves its leg null; the text says 비교 자료 없음 for it. Nothing is estimated. Pure and browser-safe; loads
// with the screens that draw scenario cards and with the AI context builder, never at boot.
import { pastEvidence, beyondBaseRate, THEME_OUTCOME_HORIZON } from './analogs.js';
import { DRAWDOWN_PCT } from './outcome-history.js';
import { EVIDENCE_FULL } from '../shared/evidence-strength.js';
import { CHOICE_WORDS, GROUND_LABELS } from '../content/choice-words.js';
import { CHOICES, favoredLean, pastConflict } from '../market/regime/macro-crossroads.js';
import { signedText, finiteNumber as finite } from '../shared/number.js';

export const DECISION_FRAME_VERSION = 'decision-frame.v1';
const SESSIONS_PER_YEAR = 252;
// The window a macro branch is scored on when its item carries no record: analogScan's horizon, which the producer
// (build-scenario-outcomes.mjs) and pastConflict's fallback both use. Today's cash over that window needs no past case.
const BRANCH_HORIZON = 20;
const NO_DATA = '비교 자료 없음';
export const GROUND_NOTES = Object.freeze({
  'cost-hypothesis': '비용 가설 — 시나리오가 맞는다고 놓고 선택마다 치를 비용을 비교한 규칙입니다. 과거 성과로 확인한 우위가 아닙니다.',
  'past-record': `과거 기록 — 겹치지 않는 사례 ${EVIDENCE_FULL}개 이상에서 평소와 구별된 빈도가 같은 쪽을 가리킵니다.`,
  none: ''
});

const has = (value) => finite(value) != null;
const pct = (value, unit = '%') => signedText(value, 1, unit);
const choiceName = (key) => String(CHOICES[key] || key).split(' (')[0];

/**
 * @param {object} input
 * @param {object|null} input.record   a published outcome record (analogs.js summarise shape) or null
 * @param {string[]} [input.favored]   the rule table's choice keys
 * @param {string} [input.why]         the rule table's reason
 * @param {object|null} [input.conflict] pastConflict() of the caller (branches); computed here when undefined
 * @param {string[]} [input.invalidation] what would show the reading is wrong
 * @param {{value:number,date?:string,label?:string}|null} [input.cash] today's short rate, annual %
 * @param {number|null} [input.horizon] the scenario's own window (sessions), used when the record carries none
 */
export function buildDecisionFrame({ record = null, favored = [], why = '', conflict, invalidation = [], cash = null, horizon: ownHorizon = null } = {}) {
  const evidence = pastEvidence(record);
  const n = evidence.n;
  const horizon = record?.horizon ?? ownHorizon ?? null;
  const relative = record?.outcome === 'excess';
  const figures = !!evidence.strength?.figures;
  const likelihood = n > 0 ? { n, up: record.up ?? null, upShare: evidence.sharePct, baseUpShare: evidence.baseUpPct, horizon, distinct: evidence.informative, strength: evidence.strength, relative } : null;
  const payoff = n > 0 && figures && has(record.p25) && has(record.p75)
    ? { gain: record.p75, loss: record.p25, median: record.median ?? null, baseGain: record.baseP75 ?? null, baseLoss: record.baseP25 ?? null, baseMedian: record.baseMedian ?? null, horizon, relative }
    : null;
  const cashRate = finite(cash?.value);
  const opportunity = {
    cashReturn: cashRate != null && horizon ? Math.round(cashRate * horizon / SESSIONS_PER_YEAR * 100) / 100 : null,
    cashRate, cashDate: cash?.date || null, cashLabel: cash?.label || null, horizon,
    pastCashMedian: n > 0 && figures && has(record.cashMedian) ? record.cashMedian : null,
    indexBaseMedian: relative ? 0 : record?.baseMedian ?? null, relative
  };
  // `distinct`: the drawdown share against its base under the same significance rule as the likelihood.
  const cost = n > 0 && figures && has(record.dd5)
    ? { drawdownShare: Math.round(record.dd5 / n * 100), drawdownCount: record.dd5, medianMaxDrawdown: record.mddMedian ?? null, baseDrawdownShare: record.baseDd5Pct ?? null, baseMedianMaxDrawdown: record.baseMddMedian ?? null, threshold: DRAWDOWN_PCT, n,
      distinct: has(record.baseDd5Pct) ? beyondBaseRate(record.dd5 / n, record.baseDd5Pct / 100, n) : null }
    : null;
  const wrong = { invalidation: (invalidation || []).filter(Boolean), cost };
  const choices = (favored || []).filter(Boolean);
  const clash = conflict === undefined ? pastConflict({ favored: choices }, record) : conflict;
  const lean = favoredLean(choices);
  // The record backs the side only when it is distinct at the full sample and points the same way the side leans.
  const agrees = lean && likelihood?.distinct === true && n >= EVIDENCE_FULL && likelihood.upShare != null && (lean === 'defensive' ? likelihood.upShare < likelihood.baseUpShare : likelihood.upShare > likelihood.baseUpShare);
  const ground = !choices.length ? 'none' : agrees && !clash ? 'past-record' : 'cost-hypothesis';
  // "Better odds, deeper dips": the honest shape of a staged-entry case — a higher up-share and median than usual AND a
  // larger share of interim drawdowns. Stated only with both halves.
  const tradeoff = likelihood?.distinct && likelihood.upShare > likelihood.baseUpShare && payoff && has(payoff.baseMedian) && payoff.median > payoff.baseMedian
    && cost && has(cost.baseDrawdownShare) && cost.drawdownShare > cost.baseDrawdownShare ? 'better-odds-deeper-dips' : null;
  const missing = [!likelihood && 'likelihood', !payoff && 'payoff', opportunity.cashReturn == null && opportunity.pastCashMedian == null && 'opportunity', !cost && 'wrong', ground === 'none' && 'favoured'].filter(Boolean);
  return { version: DECISION_FRAME_VERSION, horizon, likelihood, payoff, opportunity, wrong, tradeoff,
    favoured: { choices, names: choices.map(choiceName), why: why || '', ground, conflict: clash || null }, missing };
}

/** A macro branch item of buildMacroCrossroads → its frame. `cash` is the model's short rate ({ value, date }). */
export function branchDecisionFrame(item, { cash = null } = {}) {
  if (!item) return null;
  return buildDecisionFrame({ record: item.past?.n > 0 ? item.past : null, favored: item.favored, why: item.favoredWhy, conflict: item.pastConflict ?? null,
    invalidation: item.invalidation, cash: cash ? { label: 'SOFR', ...cash } : null, horizon: item.past?.horizon ?? BRANCH_HORIZON });
}

/** A theme row of buildThemePlaybook → its frame (the proxy ETF's record for the same stage, scored against the index). */
export function themeDecisionFrame(row, { cash = null } = {}) {
  if (!row?.state) return null;
  return buildDecisionFrame({ record: row.pastRecord || null, favored: row.favored, why: row.favoredWhy, invalidation: row.breaks, cash: cash ? { label: 'SOFR', ...cash } : null,
    horizon: row.pastRecord?.horizon ?? THEME_OUTCOME_HORIZON });
}

/**
 * The frame as short statements — the one wording every renderer and the AI use. Each leg is a line without its title
 * where the renderer titles it (opportunity, wrong); likelihood and payoff carry their own label. Which lines sit on a
 * card's face and which in its fold is the renderer's call (src/ui/components/decision-frame.js); the AI gets every leg.
 *   likelihood  the verdict first when the record is not distinct from its base ("과거 빈도: 평소와 구별 안 됨 — …")
 *   wrong       { conditions: string[], conditionsLine, cost } — the list for the renderer, the joined line for the AI
 */
export function decisionFrameText(frame) {
  if (!frame) return null;
  const { likelihood: L, payoff: P, opportunity: O, wrong: W, favoured: F } = frame;
  const h = frame.horizon ? `${frame.horizon}거래일` : '같은 기간';
  const rose = L?.relative ? '지수보다 더 오른' : '오른';
  const moved = L?.relative ? '지수를 앞섬' : '오름';
  const unit = (L?.relative || P?.relative) ? '%p' : '%';
  const ref = L?.strength.reference ? ' · 참고' : '';
  // A share is stated only beside its base; without a base rate the counts alone.
  const likelihood = !L ? '가능성: 과거 기록 없음'
    : !L.strength.figures ? `가능성: 비슷한 때 ${L.n}번 중 ${L.up}번 ${moved}`
      : L.upShare == null || L.baseUpShare == null ? `가능성: ${h} 뒤 ${L.n}번 중 ${L.up ?? 0}번 ${moved}, 평소 비율 없음${ref}`
        : L.distinct === false ? `과거 빈도: 평소와 구별 안 됨 — ${h} 뒤 ${L.n}번 중 ${L.up}번 ${moved}(${L.upShare}%), 평소 ${L.baseUpShare}%${ref}`
          : `가능성: ${h} 뒤 ${rose} 경우 ${L.upShare}%(${L.n}번 중 ${L.up}번), 평소 ${L.baseUpShare}%${ref}`;
  // A thin record shows its counts only; why the share and
  // the spread are withheld is the fold's 표본 line (evidenceStrength note), not a face line.
  const thin = !!L && !L.strength.figures;
  const payoff = thin ? null : !P ? `이익·손실 폭: ${NO_DATA}`
    : `이익·손실 폭: 좋았던 25%는 ${pct(P.gain, unit)} 이상, 나빴던 25%는 ${pct(P.loss, unit)} 이하${has(P.baseGain) && has(P.baseLoss) ? ` (평소 ${pct(P.baseGain, unit)} / ${pct(P.baseLoss, unit)})` : ' (평소 폭 없음)'}`;
  const groundLabel = GROUND_LABELS[F.ground] || '';
  // The side line names the choice and its reason; the ground kind is the fold's 근거 종류 row and the line's title.
  const tag = F.ground === 'none' ? '' : F.names.join(', ');
  const opportunity = [
    O.cashReturn != null ? `같은 ${h} 현금 약 ${signedText(O.cashReturn, 2, '%')}(오늘 ${O.cashLabel || '단기 금리'} ${O.cashRate.toFixed(2)}% 기준${O.cashDate ? `, ${O.cashDate.slice(5).replace('-', '/')}` : ''})` : `현금 ${NO_DATA}`,
    O.pastCashMedian != null ? `과거 같은 사례 때 현금 중앙값 ${signedText(O.pastCashMedian, 2, '%')}(그달 평균 정책금리로 근사)` : null,
    O.relative ? '이 기록은 지수 대비 초과분이라 0이 지수를 그대로 든 경우' : O.indexBaseMedian != null ? `지수만 들고 있던 평소 ${h} 중앙값 ${pct(O.indexBaseMedian)}` : null
  ].filter(Boolean);
  // windowDrawdown measures each later close against the case day's close, not against a peak inside the span.
  const cost = W.cost
    ? `그 사이 -${W.cost.threshold}% 넘게 빠진 경우 ${W.cost.drawdownShare}%(${W.cost.n}번 중 ${W.cost.drawdownCount}번)${has(W.cost.baseDrawdownShare) ? `, 평소 ${W.cost.baseDrawdownShare}%` : ''}${has(W.cost.medianMaxDrawdown) ? ` · 사례일 종가 대비 가장 깊은 하락 중앙값 ${pct(W.cost.medianMaxDrawdown)}` : ''}${L?.relative ? ' (대표 ETF 자체 가격)' : ''}`
    : `과거 하락 폭: ${thin ? '사례가 적어 말하지 않음' : NO_DATA}`;
  const tradeoff = frame.tradeoff === 'better-odds-deeper-dips' ? '오른 경우와 중앙값은 평소보다 컸지만, 그 사이 크게 빠진 경우도 평소보다 많았습니다.' : '';
  const conflict = F.conflict ? `과거 표본과 어긋남 — 비슷한 때 ${F.conflict.sharePct}%, 평소 ${F.conflict.basePct}%(${F.conflict.n}번)` : '';
  const conditions = [...W.invalidation];
  return {
    likelihood, payoff, sample: L?.strength.note || '', tag, groundLabel, reason: F.ground === 'none' ? '' : F.why || '', conflict, tradeoff, opportunity,
    wrong: { conditions, conditionsLine: `빗나가는 조건: ${conditions.length ? conditions.join('; ') : '자료 없음'}`, cost },
    ground: GROUND_NOTES[F.ground] || ''
  };
}

/** One line for the AI context: every leg, each title once, with its ground named. */
export function decisionFrameContext(frame) {
  const text = decisionFrameText(frame);
  if (!text) return '';
  const side = frame.favoured.ground === 'none' ? `${CHOICE_WORDS.favored} 없음` : `${CHOICE_WORDS.favored} ${frame.favoured.names.join(', ')}(근거 종류: ${text.groundLabel}${frame.favoured.ground === 'cost-hypothesis' ? ', 과거 성과로 확인한 우위 아님' : ''}) — ${frame.favoured.why}`;
  return [text.likelihood, text.payoff, text.sample, `기회비용: ${text.opportunity.join(', ')}`, `틀렸을 때 — ${text.wrong.conditionsLine} / ${text.wrong.cost}`, text.tradeoff, side, text.conflict].filter(Boolean).join('. ').replace(/\.\./g, '.');
}
