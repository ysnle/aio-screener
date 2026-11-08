// The credit judgement, its sentence and what would flip it, for the surfaces that speak about the HY spread outside
// the 시장 상태 axis (매크로 신용 장, 시장 이야기). Both load with their routes, so this stays out of the boot set.
import { RULES } from '../rules/thresholds.js';
import { oasDelta20Bp, hyWidening20Record, creditState, creditCause } from './market-read.js';

/**
 * The credit judgement from the published OAS history alone — the same
 * inputs the 시장 상태 axis aligns (20-session change, 5-session change, the 20-session record test). Every surface that
 * speaks about the HY spread (매크로 신용 장, 시장 이야기) reads this and creditReading below; none re-derives it.
 */
export function creditJudgement(macroHistory, through = null) {
  const hy20 = oasDelta20Bp(macroHistory, 'hyOas', through);
  if (!hy20) return null;
  const record = hyWidening20Record(macroHistory, through);
  const hyBp = hy20.level * 100, hy5 = hy20.d5, hy20Bp = hy20.value;
  const hy20Stress = hy20Bp != null && hy20Bp >= RULES.credit.widen20dBp && (record ? !!record.stress : hy20Bp >= RULES.credit.stress20dMultiple * RULES.credit.widen20dBp);
  const state = creditState({ hyBp, hy5, hy20: hy20Bp, hy20Stress });
  return { state, cause: creditCause({ hyBp, hy5, hy20Record: hy20Stress ? { stress: true } : null }), hyBp, hy5, hy20: hy20Bp, record, date: hy20.date };
}

/**
 * The one sentence for a credit judgement. A 부담 names its cause (수준, 5거래일 속도, 20거래일 기록), so a 348bp level under
 * the 450bp line is never "크게 벌어진 폭".
 */
export function creditReading(j, { cccTail = false } = {}) {
  if (!j || j.state === 'unknown') return '신용 지표 판정 보류 — 스프레드 기록을 기다립니다.';
  const C = RULES.credit;
  const pct = (bpValue) => `${(bpValue / 100).toFixed(2)}%`;
  const move = (value) => `${value > 0 ? '+' : ''}${Math.round(value)}bp`;
  const levelNote = `수준 ${pct(j.hyBp)}는 부담 기준 ${C.stressAtBp / 100}% 아래입니다.`;
  const tail = cccTail ? ' 가장 약한 CCC 등급이 더 빠르게 벌어져, 약한 기업부터 조달 비용이 오르는 모습입니다.' : '';
  if (j.state === 'burden') {
    if (j.cause.level) return `하이일드가 ${pct(j.hyBp)}로 부담 기준 ${C.stressAtBp / 100}% 위입니다. 주가 조정이 신용 문제로 번질 수 있는 수준입니다.${tail}`;
    if (j.cause.fast5) return `하이일드가 5거래일 ${move(j.hy5)} 빠르게 벌어졌습니다. ${levelNote}${tail}`;
    return `하이일드가 20거래일 ${move(j.hy20)} 벌어져 자체 기록에서 빠른 확대입니다. ${levelNote}${tail}`;
  }
  if (j.hy20 != null && j.hy20 >= C.widen20dBp) return `하이일드가 20거래일 ${move(j.hy20)} 벌어져 경계 쪽으로 움직이고 있습니다.${tail}`;
  if (cccTail) return '전체 하이일드는 조용하지만 가장 약한 CCC 등급이 먼저 벌어지고 있습니다. 이 확대가 하이일드 전체로 번지는지가 다음 관찰점입니다.';
  return j.state === 'favorable' ? '주가가 움직여도 스프레드가 넓어지지 않아 신용 문제는 아닙니다.' : '스프레드 수준·방향이 경계선입니다.';
}

/** What would change the credit judgement — only the conditions that are not already met. */
export function creditFlip(j) {
  if (!j || j.state === 'unknown') return null;
  const C = RULES.credit;
  if (j.state === 'burden') {
    const parts = [j.cause.level ? `하이일드가 ${C.stressAtBp / 100}% 아래로 내려오고` : null,
      j.cause.fast5 ? `5거래일 확대가 +${C.widen5dBp}bp 아래로 줄고` : null,
      j.cause.wide20 ? `20거래일 확대가 +${C.widen20dBp}bp 아래로 줄고` : null].filter(Boolean);
    return `${parts.join(' ').replace(/고$/, '면')} 부담을 풉니다.`;
  }
  return `하이일드 ${C.stressAtBp / 100}% 이상, 5거래일 +${C.widen5dBp}bp, 20거래일 확대가 자체 기록 상위 ${100 - C.stress20dPct}% 중 하나면 부담으로 바꿉니다.`;
}
