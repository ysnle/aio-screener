import { RISK_RULE, stressBandOf } from './stress-outcomes.js';
import { currentStressOutcomes } from '../../scenarios/outcome-fingerprints.js';
import { evidenceStrength } from '../../shared/evidence-strength.js';
import { readNumber } from '../../shared/number.js';
import { pastEvidence, BASE_RATE_SE } from '../../scenarios/analogs.js';
import { claim, say, sayJoin, NOTHING } from '../../shared/claim.js';

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

/**
 * 투자 심리's opening line — what days at
 * today's VIX band were followed by, against an ordinary day, in one plain sentence. The Fear & Greed gauge has no long
 * record of its own (history.json starts 2025-09-30), so the line reads the VIX-band record 시장 상태 prints and names
 * VIX. A difference is said only when it is beyond the base rate by the shared rule (analogs.js beyondBaseRate, the
 * one behind "평소와 구별 안 됨", read through pastEvidence on the case counts); under the evidence floor there is no line. Facts only: no instruction.
 */
export function vixBandLedeSaid(record) {
  if (record?.state !== 'current' || !record.risk?.strength?.figures) return NOTHING;
  const { risk, baseRisk } = record;
  const side = (count, share, base) => (pastEvidence({ n: risk.cases, up: count, baseUpPct: base }).informative ? (share > base ? 'more' : 'less') : 'same');
  const dd = side(risk.drawdownCases, risk.drawdownShare, baseRisk.drawdownShare), up = side(risk.upCases, risk.upShare, baseRisk.upShare);
  const band = String(record.label || record.band?.label || '');
  const share = (measure, value, label) => claim({ subject: `vix-band:${record.band.id}`, measure, asOf: record.to || null, figures: [{ value, unit: 'share', basis: measure, label }] });
  const slots = { band: /VIX/.test(band) ? band : `VIX ${band}`, dd: share('drawdownShare', risk.drawdownShare, '크게 더 빠진 경우'), up: share('upShare', risk.upShare, '올라 있던 경우') };
  const head = say('{band}이던 날 뒤에는 ', slots);
  if (dd === 'same' && up === 'same') return say('{band}이던 날 뒤 한 달 흐름은 평소와 구별되지 않았습니다.', slots);
  const ddPart = dd === 'same' ? say('한 달 안에 크게 더 빠진 경우는 평소와 구별되지 않았고') : say(dd === 'more' ? '한 달 안에 크게 더 빠진 경우가 평소보다 잦았{tie}({dd})' : '한 달 안에 크게 더 빠진 경우가 평소보다 드물었{tie}({dd})',
    { ...slots, tie: up === 'same' ? '지만' : '고' });
  const upPart = up === 'same' ? say(' 한 달 뒤 올라 있던 비율은 평소와 구별되지 않았습니다.') : say(up === 'more' ? ' 한 달 뒤 올라 있던 경우는 평소보다 많았습니다({up}).' : ' 한 달 뒤 올라 있던 경우는 평소보다 적었습니다({up}).', slots);
  return sayJoin([head, ddPart, say(','), upPart], '');
}

/** The convention of that line, for the screen's method fold (with the record's own span and counts). */
export function vixBandLedeMethod(record) {
  if (record?.state !== 'current' || !record.risk) return '';
  const { risk, baseRisk } = record;
  return `첫 문장: ${fromYear(record)}VIX 종가가 지금과 같은 구간(${record.label || record.band.label})이던 날 가운데 서로 겹치지 않는 사례 ${risk.cases}개를 골라, ${record.horizon}거래일 안에 ${record.drawdownAtPct}% 이상 빠진 비율(크게 더 빠진 경우, ${pct(risk.drawdownShare)})과 ${record.horizon}거래일 뒤 올라 있던 비율(${pct(risk.upShare)})을 모든 날(${pct(baseRisk.drawdownShare)}, ${pct(baseRisk.upShare)})과 비교합니다. 차이가 표본 오차의 ${BASE_RATE_SE}배를 넘을 때만 잦았다·드물었다고 쓰고, 그 안이면 평소와 구별되지 않는다고 씁니다. 공포·탐욕 지수는 긴 기록이 없어 VIX 기록으로 봅니다. 예측이 아니라 과거 빈도입니다.`;
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
