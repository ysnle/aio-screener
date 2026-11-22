// Owner-approved: the one reader of the published VIX-band record (stress-outcomes.json) for today's band — the
// 시장 상태 risk line beside the six-axis state block, the AI scenario_record tool's `vix` id and the stress card read
// it here, under the artifact's live definition stamp. It returns figures only where the shared sample rule
// (evidence-strength.js) allows them, always beside the base rate and the case count; it never turns them into a
// direction or an instruction. A follow-up decision frame (likelihood / payoff / opportunity cost) can take `risk` as is.
import { RISK_RULE, stressBandOf } from './stress-outcomes.js';
import { currentStressOutcomes } from '../../scenarios/outcome-fingerprints.js';
import { evidenceStrength } from '../../shared/evidence-strength.js';
import { readNumber } from '../../shared/number.js';

const month = (block) => block?.horizons?.['21'] || block?.horizons?.[21] || block?.['21'] || block?.[21] || null;
const riskOf = (risk) => (risk && Number.isFinite(risk.cases) && risk.cases > 0 ? { ...risk, strength: evidenceStrength(risk.cases) } : null);

/**
 * @param {object|null} published stress-outcomes.json
 * @param {number|null} vix today's completed VIX close
 * @returns {{ state: 'current'|'missing'|'no-vix', band, vix, horizon, drawdownAtPct, month, base, risk, baseRisk }}
 *   state 'missing': no record under today's definition, or one without the drawdown fields (until the weekly lane
 *   rebuilds it); `risk`/`baseRisk` carry { drawdownShare, drawdownCases, upShare, upCases, cases, median, p05, strength } when published.
 */
export function vixBandRecord(published, vix) {
  const band = stressBandOf(vix);
  const empty = { band, vix: readNumber(vix), horizon: RISK_RULE.horizon, drawdownAtPct: RISK_RULE.drawdownAtPct, month: null, base: null, risk: null, baseRisk: null };
  if (!band) return { ...empty, state: 'no-vix' };
  const stress = currentStressOutcomes(published);
  const row = stress?.bands?.find((item) => item.id === band.id) || null;
  if (!row) return { ...empty, state: 'missing' };
  const m = month(row);
  const all = month(stress.all);
  const risk = riskOf(row.risk), baseRisk = riskOf(stress.allRisk);
  return { ...empty, state: risk && baseRisk ? 'current' : 'missing', label: row.label, from: stress.from || null, to: stress.to || null,
    month: m ? { ...m, strength: evidenceStrength(Number.isFinite(m.nEff) ? m.nEff : Number(m.n) / RISK_RULE.horizon, { approx: true }) } : null,
    base: all ? { hitRate: all.hitRate ?? null, median: all.median ?? null } : null, risk, baseRisk };
}

const pct = (value) => `${Math.round(Number(value))}%`;
const fromYear = (record) => (record.from ? `${String(record.from).slice(0, 4)}년 이후 ` : '');

/** The one-line risk read beside the six-axis block: share of −5% drawdowns within 21 sessions vs base, with counts. */
export function vixBandRiskLine(record) {
  if (!record || record.state === 'no-vix') return null;
  const head = `VIX ${record.vix.toFixed(1)}(${record.label || record.band.label} 구간)`;
  if (record.state !== 'current') return { state: 'missing', text: `${head} 뒤 한 달 낙폭 기록: 없음 — 주간 갱신 때 다시 계산합니다.` };
  const { risk, baseRisk } = record;
  const at = `${record.drawdownAtPct}%`;
  if (!risk.strength.figures) return { state: 'thin', text: `${head}: ${fromYear(record)}이 구간은 ${risk.strength.note}` };
  const tag = risk.strength.reference ? ' · 참고' : '';
  // The share and the count are one sample — the non-overlapping cases (stressRiskSummary), base included.
  return { state: risk.strength.reference ? 'small' : 'enough',
    text: `${head}: ${fromYear(record)}이런 날 뒤 ${record.horizon}거래일 안에 ${at} 이상 빠진 경우 ${pct(risk.drawdownShare)} (겹치지 않는 사례 ${risk.cases}개 중 ${risk.drawdownCases}개${tag}, 평소 ${pct(baseRisk.drawdownShare)})` };
}
