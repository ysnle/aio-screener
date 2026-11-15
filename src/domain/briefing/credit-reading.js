// The credit judgement, its sentence and what would flip it, for the surfaces that speak about the HY spread outside
// the 시장 상태 axis (매크로 신용 장, 시장 이야기). Both load with their routes, so this stays out of the boot set.
import { RULES } from '../rules/thresholds.js';
import { readNumber, signedText } from '../shared/number.js';
import { hyObservation, hyWidening20Record, creditState, creditCause, creditReleaseText, creditDispersion, RECORD_FULL_YEAR } from './market-read.js';

/**
 * The credit judgement from the published OAS history alone — the same
 * inputs the 시장 상태 axis aligns (20-session change, 5-session change, the 20-session record test). Every surface that
 * speaks about the HY spread (매크로 신용 장, 시장 이야기) reads this and creditReading below; none re-derives it.
 */
export function creditJudgement(macroHistory, through = null) {
  const obs = hyObservation({ macroHistory, through });
  if (!obs) return null;
  const record = hyWidening20Record(macroHistory, through);
  const hyBp = obs.level, hy5 = obs.change5, hy20Bp = obs.change20;
  const hy20Stress = record ? !!record.stress : (hy20Bp != null && hy20Bp >= RULES.credit.widen20dBp && hy20Bp >= RULES.credit.stress20dMultiple * RULES.credit.widen20dBp);
  const lowerRated = creditDispersion(macroHistory, through)?.lowerRated === true;
  const state = creditState({ hyBp, hy5, hy20: hy20Bp, hy20Stress, lowerRated });
  return { state, lowerRated, cause: creditCause({ hyBp, hy5, hy20Record: hy20Stress ? { stress: true } : null }), hyBp, hy5, hy20: hy20Bp, record, date: obs.asOf };
}

/**
 * The change (bp) CCC must reach to be widening faster than usual for CCC: the stress20dPct-th percentile of its own
 * `window`-observation changes over the last year, never under `floor` (the floor alone while the record is short).
 * A flat +50bp over 20 observations was 28% of CCC's last year.
 */
export function cccTailLine(macroHistory, window, floor, through = null) {
  const C = RULES.credit;
  const rows = (macroHistory?.series?.cccOas?.observations || []).filter(([day, value]) => day && readNumber(value) !== null && (!through || String(day).slice(0, 10) <= through));
  const changes = rows.slice(window).map((row, index) => (Number(row[1]) - Number(rows[index][1])) * 100).slice(-RECORD_FULL_YEAR).sort((a, b) => a - b);
  return Math.max(floor, changes.length >= C.recordMin ? changes[Math.floor((C.stress20dPct / 100) * (changes.length - 1))] : 0);
}

/**
 * The one sentence for a credit judgement. A 부담 names its cause (수준, 5거래일 속도, 20거래일 기록), so a 348bp level under
 * the 450bp line is never "크게 벌어진 폭".
 */
export function creditReading(j, { cccTail = false, ccc20 = null, ig20 = null } = {}) {
  if (!j || j.state === 'unknown') return '신용 지표 판정 보류 — 스프레드 기록을 기다립니다.';
  const C = RULES.credit;
  const pct = (bpValue) => `${(bpValue / 100).toFixed(2)}%`;
  const move = (value) => signedText(value, 0, 'bp');
  const levelNote = `수준 ${pct(j.hyBp)}는 부담 기준 ${C.stressAtBp / 100}% 아래입니다.`;
  const tail = cccTail ? ` 가장 약한 CCC 등급이 ${ccc20 != null ? `${move(ccc20)}로 ` : ''}더 빠르게 벌어져, 약한 기업부터 조달 비용이 오르는 모습입니다.` : '';
  // investment grade standing still while HY/CCC widen says the pressure sits in the weaker borrowers.
  const igCalm = ig20 != null && ig20 < C.widen20dBp / 2 && (cccTail || (j.hy20 != null && j.hy20 >= C.widen20dBp)) ? ` 투자등급은 ${move(ig20)}로 조용해, 압력은 낮은 등급에 몰려 있습니다.` : '';
  if (j.state === 'burden') {
    if (j.cause.level) return `하이일드가 ${pct(j.hyBp)}로 부담 기준 ${C.stressAtBp / 100}% 위입니다. 주가 조정이 신용 문제로 번질 수 있는 수준입니다.${tail}${igCalm}`;
    if (j.cause.fast5) return `하이일드가 5거래일 ${move(j.hy5)} 빠르게 벌어졌습니다. ${levelNote}${tail}${igCalm}`;
    // under the record's entry line the 부담 is the latch holding — say so and since when, instead of calling
    // a 88th-percentile month '자체 기록에서 빠른 확대'.
    const rec = j.record;
    if (rec && j.hy20 != null && rec.enterBp != null && j.hy20 < rec.enterBp) {
      return `하이일드 20거래일 확대(${move(j.hy20)})는 진입선(+${Math.round(rec.enterBp)}bp) 아래로 내려왔지만, ${rec.since ? `${Number(rec.since.slice(5, 7))}/${Number(rec.since.slice(8, 10))}에 시작된 ` : ''}확대 부담 판정이 이어지고 있습니다(5거래일 ${move(j.hy5)}). ${levelNote}${tail}${igCalm}`;
    }
    return `하이일드가 20거래일 ${move(j.hy20)} 벌어져 자체 기록에서 빠른 확대입니다. ${levelNote}${tail}${igCalm}`;
  }
  if (j.hy20 != null && j.hy20 >= C.widen20dBp) return `하이일드가 20거래일 ${move(j.hy20)} 벌어져 경계 쪽으로 움직이고 있습니다.${tail}`;
  if (cccTail) return '전체 하이일드는 조용하지만 가장 약한 CCC 등급이 먼저 벌어지고 있습니다. 이 확대가 하이일드 전체로 번지는지가 다음 관찰점입니다.';
  // lowerRated is a 60-observation gap: beside a five-session CCC figure the sentence has to name its own span.
  if (j.lowerRated) return '전체 하이일드는 조용하지만, 석 달(60관측) 기준으로는 가장 약한 CCC 등급이 하이일드 전체보다 더 벌어져 있습니다. 이 차이가 하이일드 전체로 번지는지가 다음 관찰점입니다.';
  return j.state === 'favorable' ? '주가가 움직여도 스프레드가 넓어지지 않아 신용 문제는 아닙니다.' : '스프레드 수준·방향이 경계선입니다.';
}

/** What would change the credit judgement — only the conditions that are not already met. */
export function creditFlip(j) {
  if (!j || j.state === 'unknown') return null;
  const C = RULES.credit;
  // The release legs are the axis's own (creditReleaseText): every leg still open, with the latch's +15bp five-session
  // leg only while the 20-session latch holds.
  if (j.state === 'burden') return `${creditReleaseText({ hyBp: j.hyBp, hy5: j.hy5, hy20: j.hy20, latched: !!j.cause?.wide20 }).replace(/ 중립$/, '')} 부담을 풉니다.`;
  return `${j.lowerRated && j.state === 'neutral' ? `CCC와 하이일드의 60관측 확대 차이가 ${C.cccGap60dBp}bp 미만으로 줄면 양호로, ` : ''}하이일드 ${C.stressAtBp / 100}% 이상, 5거래일 +${C.widen5dBp}bp, 20거래일 확대가 자체 기록 상위 ${100 - C.stress20dPct}% 중 하나면 부담으로 바꿉니다.`;
}
