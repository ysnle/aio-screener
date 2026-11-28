// Four read-outs that sit under the paired readings of 시장 상태: a breadth thrust, credit against equity, the stock–bond
// correlation sign and the variance risk premium. Each is a number with a state word, from history.json and
// macro-history.json only. None of them enters a score or an axis state. Pure; loaded with the route.
import { readNumber, signedText } from '../../shared/number.js';
import { RULES } from '../../rules/thresholds.js';
import { sessionCloses } from '../indices/index-levels.js';
import { bp, buildCloseSeries, closeBasis, commonDateSplit, hyDelta20Bp, recordPercentile, recordSide, sessionChanges } from '../../briefing/market-read.js';
import { volatilityState } from '../sentiment/volatility-state.js';

export const DEPTH_RULES = Object.freeze({
  // Zweig: the 10-day EMA of the advancing share from ≤ 0.40 to ≥ 0.615 inside 10 sessions. AIO counts S&P 500 members
  // (or its US universe), not NYSE issues, so the read-out names the population and stays a reference.
  thrust: Object.freeze({ ema: 10, low: 0.40, high: 0.615, sessions: 10, recentSessions: 20 }),
  // A correlation inside correlationSe standard errors of zero (1/√n each; 0.26 at n = 60) has no sign to read — a 0.1
  // band called 0.10~0.25 "bonds give no cushion" on 58 of 250 sessions.
  correlationSessions: 60, correlationSe: 2,
  realisedSessions: 21, tradingDays: 252,
  // Record ranks at or beyond these percentiles get a state word; between them the number stands alone.
  rankLow: 20, rankHigh: 80
});

const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };
const finiteRows = (history, field) => sessionCloses(history, field).map((row) => ({ date: row.date, value: readNumber(row.value) })).filter((row) => row.value !== null);

/** Zweig breadth thrust on the advancing share. `armed` = the low line was touched inside the window and not yet answered. */
export function breadthThrust(history, rule = DEPTH_RULES.thrust) {
  const rows = finiteRows(history, 'advanceRatio');
  if (rows.length < rule.ema * 3) return null;
  const k = 2 / (rule.ema + 1);
  // Seeded with the simple average of the first window; three windows of warm-up before a value is read.
  let ema = rows.slice(0, rule.ema).reduce((sum, row) => sum + row.value, 0) / rule.ema;
  const series = [];
  for (let i = rule.ema; i < rows.length; i += 1) { ema = rows[i].value * k + ema * (1 - k); series.push({ date: rows[i].date, value: ema }); }
  const read = series.slice(rule.ema * 2);
  if (!read.length) return null;
  let fired = null;
  for (let i = 0; i < read.length; i += 1) {
    if (read[i].value < rule.high) continue;
    const low = read.slice(Math.max(0, i - rule.sessions), i).filter((row) => row.value <= rule.low).at(-1);
    if (low) fired = { date: read[i].date, from: low.value, fromDate: low.date, to: read[i].value, ago: read.length - 1 - i };
  }
  const last = read.at(-1);
  // The low counts from the session it is touched (today included); `remaining` is the sessions left in that span.
  const span = read.slice(-rule.sessions);
  const lowAt = span.findLastIndex((row) => row.value <= rule.low);
  const recent = fired && fired.ago <= rule.recentSessions ? fired : null;
  return { asOf: last.date, value: last.value, fired: recent, armed: !recent && lowAt >= 0 ? { ...span[lowAt], remaining: rule.sessions - (span.length - 1 - lowAt) } : null };
}

/** S&P 500 near its one-year high while the HY spread widened over 20 sessions. */
export function creditEquityDivergence(history, macroHistory) {
  const spx = finiteRows(history, 'spx');
  if (spx.length < RULES.technical.fullYearSessions || !macroHistory) return null;
  const last = spx.at(-1);
  const high = Math.max(...spx.slice(-RULES.technical.rangeSessions).map((row) => row.value));
  const fromHigh = (last.value / high - 1) * 100;
  const hy20 = hyDelta20Bp(macroHistory, last.date)?.value ?? null;
  if (hy20 === null) return null;
  return { asOf: last.date, fromHigh, hy20, diverging: fromHigh > -RULES.technical.nearHighPct && hy20 >= RULES.credit.widen20dBp };
}

/** Pearson correlation of daily S&P 500 and TLT returns on their common sessions. */
export function stockBondCorrelation(history, sessions = DEPTH_RULES.correlationSessions) {
  const tlt = new Map(finiteRows(history, 'tlt').map((row) => [row.date, row.value]));
  const both = finiteRows(history, 'spx').filter((row) => tlt.has(row.date)).map((row) => ({ date: row.date, spx: row.value, tlt: tlt.get(row.date) }));
  if (both.length <= sessions) return null;
  const tail = both.slice(-sessions - 1);
  const xs = [], ys = [];
  for (let i = 1; i < tail.length; i += 1) { xs.push(tail[i].spx / tail[i - 1].spx - 1); ys.push(tail[i].tlt / tail[i - 1].tlt - 1); }
  const mean = (list) => list.reduce((sum, value) => sum + value, 0) / list.length;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < xs.length; i += 1) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  if (!(sxx > 0 && syy > 0)) return null;
  return { asOf: tail.at(-1).date, sessions, value: sxy / Math.sqrt(sxx * syy), flat: correlationFlatBand(sessions) };
}

/**
 * The one word for a stock–bond correlation, read by both 금리와 환율 > 자산군 and 시장 상태 so the two cannot disagree on
 * the word or the sample-error band.
 */
export const correlationFlatBand = (sessions = DEPTH_RULES.correlationSessions) => DEPTH_RULES.correlationSe / Math.sqrt(sessions);
export function stockBondCorrelationWord(value, sessions = DEPTH_RULES.correlationSessions) {
  const flat = correlationFlatBand(sessions);
  return Math.abs(value) < flat ? `뚜렷한 관계 없음(±${flat.toFixed(2)} 안은 표본 오차)`
    : value > 0 ? '같은 방향, 채권 완충 없음' : '반대 방향, 채권 완충';
}

/** VIX² less the annualised realised variance of the S&P 500 over 21 sessions, in variance points and as the two vols. */
export function varianceRiskPremium(history, sessions = DEPTH_RULES.realisedSessions) {
  const spx = finiteRows(history, 'spx');
  return premiumAt(spx, new Map(finiteRows(history, 'vix').map((row) => [row.date, row.value])), spx.length, sessions);
}
// The premium on the session ending at spx[end - 1]; null without a VIX close of that session.
function premiumAt(spx, vixOn, end, sessions) {
  const last = spx[end - 1];
  const vix = last ? vixOn.get(last.date) : null;
  if (end <= sessions || vix == null) return null;
  let sum = 0;
  // Zero-mean realised variance (the usual convention over a month of daily returns).
  for (let i = end - sessions; i < end; i += 1) sum += Math.log(spx[i].value / spx[i - 1].value) ** 2;
  const realisedVariance = sum / sessions * DEPTH_RULES.tradingDays * 10000;
  return { asOf: last.date, vix, realised: Math.sqrt(realisedVariance), premium: vix ** 2 - realisedVariance };
}

const observations = (macroHistory, id, through = null) => (macroHistory?.series?.[id]?.observations || [])
  .map((row) => ({ date: String(row[0]).slice(0, 10), value: readNumber(row[1]) })).filter((row) => row.value !== null && (!through || row.date <= through));
const lastChange = (rows, n) => rows.length > n ? { date: rows.at(-1).date, value: rows.at(-1).value - rows.at(-1 - n).value } : null;
// A state word only when the value sits at either end of its own one-year record.
const rankOf = recordPercentile;
const rankWord = (rec, high, low) => rec?.pct == null ? '' : rec.pct >= DEPTH_RULES.rankHigh ? high : rec.pct <= DEPTH_RULES.rankLow ? low : '';

/** The five-session 10-year change in its own record (the rates axis's speed leg), split into real yield, breakeven and term premium. */
export function rateShock(history, macroHistory) {
  const changes = sessionChanges(buildCloseSeries(history, 'tnx', { through: closeBasis(history) }), 5, bp);
  const last = changes.at(-1);
  if (!last) return null;
  const split = commonDateSplit(macroHistory, last.date);
  const term = lastChange(observations(macroHistory, 'termPremium10', last.date), 5);
  return { asOf: last.date, d5: last.value, rank: rankOf(changes, last.value), real5: split ? split.real5 * 100 : null, breakeven5: split ? split.breakeven5 * 100 : null,
    splitDate: split?.date || null, term5: term ? term.value * 100 : null, termDate: term?.date || null };
}

/** Equal-weight against cap-weight (RSP ÷ S&P 500): the 20- and 60-session change of the ratio in its own record. */
export function concentration(history) {
  const spx = new Map(finiteRows(history, 'spx').map((row) => [row.date, row.value]));
  const ratio = finiteRows(history, 'rsp').filter((row) => spx.get(row.date) > 0).map((row) => ({ date: row.date, value: row.value / spx.get(row.date) }));
  const span = (n) => {
    const changes = sessionChanges(ratio, n, (now, then) => (now / then - 1) * 100);
    const last = changes.at(-1);
    return last && last.date === ratio.at(-1).date ? { value: last.value, rank: rankOf(changes, last.value) } : null;
  };
  const d20 = span(20), d60 = span(60);
  return d20 ? { asOf: ratio.at(-1).date, d20, d60 } : null;
}

/** The credit ladder: CCC ÷ HY and HY − IG, each as a level in its own record. */
export function creditLadder(macroHistory) {
  const hy = observations(macroHistory, 'hyOas');
  const by = (id) => new Map(observations(macroHistory, id).map((row) => [row.date, row.value]));
  const ccc = by('cccOas'), ig = by('igOas');
  const series = (other, value) => hy.filter((row) => other.has(row.date)).map((row) => ({ date: row.date, value: value(row.value, other.get(row.date)) }));
  const ratio = series(ccc, (h, c) => c / h), gap = series(ig, (h, i) => (h - i) * 100);
  if (!ratio.length || !gap.length) return null;
  return { asOf: ratio.at(-1).date, ratio: ratio.at(-1).value, ratioRank: rankOf(ratio), gap: gap.at(-1).value, gapRank: rankOf(gap) };
}

/** Volatility structure: VIX ÷ 3-month VIX (the shared volatility state) and the variance premium (in vol points), each in its own record. */
export function volatilityStructure(history) {
  const state = volatilityState(history);
  const ratio = [...(state?.ratioSeries || [])];
  const spx = finiteRows(history, 'spx');
  const vixOn = new Map(finiteRows(history, 'vix').map((row) => [row.date, row.value]));
  const premium = [];
  for (let end = DEPTH_RULES.realisedSessions + 1; end <= spx.length; end += 1) {
    const at = premiumAt(spx, vixOn, end, DEPTH_RULES.realisedSessions);
    if (at) premium.push({ date: at.asOf, value: at.vix - at.realised });
  }
  // Both read-outs are of the last S&P 500 session; an older ratio or premium is withheld.
  if (ratio.at(-1)?.date !== spx.at(-1)?.date) ratio.length = 0;
  if (premium.at(-1)?.date !== spx.at(-1)?.date) premium.length = 0;
  if (!ratio.length && !premium.length) return null;
  return { asOf: (ratio.at(-1) || premium.at(-1)).date, ratio: ratio.at(-1)?.value ?? null, ratioRank: ratio.length ? rankOf(ratio) : null,
    term: ratio.length ? state.term : null, range: state?.range || null,
    premium: premium.at(-1)?.value ?? null, premiumRank: premium.length ? rankOf(premium) : null };
}

/** One row for crossReadings (no map): four short clauses, each withheld when its inputs are missing. */
export function depthReadout({ history = [], macroHistory = null, breadthScope = '' } = {}) {
  const parts = [];
  const dates = [];
  const thrust = breadthThrust(history);
  if (thrust) {
    dates.push(thrust.asOf);
    const now = thrust.value.toFixed(2);
    const T = DEPTH_RULES.thrust;
    parts.push(thrust.fired ? `폭 급반전(Zweig) ${md(thrust.fired.date)} 발생 — 상승 종목 비율 10일 지수이동평균이 ${thrust.fired.from.toFixed(2)}(${md(thrust.fired.fromDate)})에서 ${thrust.fired.to.toFixed(2)}로, 지금 ${now}${breadthScope ? `(${breadthScope})` : ''}.`
      : thrust.armed ? `폭 급반전(Zweig) 대기 — 상승 종목 비율 10일 지수이동평균이 ${md(thrust.armed.date)} ${thrust.armed.value.toFixed(2)}까지 내려갔고 지금 ${now}, 남은 ${thrust.armed.remaining}거래일 안에 ${T.high} 이상이면 발생.`
        : `폭 급반전(Zweig) 없음 — 상승 종목 비율 10일 지수이동평균 ${now}.`);
  }
  const credit = creditEquityDivergence(history, macroHistory);
  if (credit) {
    dates.push(credit.asOf);
    const numbers = `S&P 500 1년 고점 대비 ${signedText(credit.fromHigh, 1, '%')}, 하이일드 20거래일 ${signedText(credit.hy20, 0, 'bp')}`;
    parts.push(`신용·주가 엇갈림${credit.diverging ? '' : ' 없음'} — ${numbers}.`);
  }
  const corr = stockBondCorrelation(history);
  if (corr) {
    dates.push(corr.asOf);
    parts.push(`주식·장기채 ${corr.sessions}일 상관 ${signedText(corr.value, 2, '')} — ${stockBondCorrelationWord(corr.value, corr.sessions)}.`);
  }
  const vrp = varianceRiskPremium(history);
  if (vrp) {
    dates.push(vrp.asOf);
    parts.push(`변동성 프리미엄 ${signedText(vrp.vix - vrp.realised, 1, 'pt')}${vrp.premium < 0 ? ' 실현 > 내재' : ''} — VIX ${vrp.vix.toFixed(1)}, ${DEPTH_RULES.realisedSessions}일 실현 변동성 ${vrp.realised.toFixed(1)}.`);
  }
  if (!parts.length) return null;
  // Four more read-outs, each a number in its own one-year record. Reference only: no axis, label or score reads them.
  const more = [];
  const side = (rec) => recordSide(rec) ? `(1년 기록 ${recordSide(rec)})` : '';
  const shock = rateShock(history, macroHistory);
  if (shock) {
    const split = [shock.real5 != null ? `실질금리 ${signedText(shock.real5, 0, 'bp')}` : '', shock.breakeven5 != null ? `기대인플레 ${signedText(shock.breakeven5, 0, 'bp')}` : '', shock.term5 != null ? `기간 프리미엄 ${signedText(shock.term5, 0, 'bp')}` : ''].filter(Boolean);
    more.push({ id: 'rate-shock', label: '금리 속도', text: `10년물 5거래일 ${signedText(shock.d5, 0, 'bp')}${side(shock.rank)}${split.length ? ` — ${md(shock.splitDate || shock.termDate)}까지 5관측 ${split.join(', ')}` : ''}.` });
  }
  const conc = concentration(history);
  if (conc) {
    const word = rankWord(conc.d20.rank, '상승이 넓게 퍼지는 쪽', '큰 종목에 몰리는 쪽');
    more.push({ id: 'concentration', label: '집중도', text: `동일가중÷시총가중 S&P 500 20거래일 ${signedText(conc.d20.value, 1, '%')}${side(conc.d20.rank)}${conc.d60 ? `, 60거래일 ${signedText(conc.d60.value, 1, '%')}${side(conc.d60.rank)}` : ''}${word ? ` — ${word}` : ''}.` });
  }
  const ladder = creditLadder(macroHistory);
  if (ladder) {
    const word = rankWord(ladder.ratioRank, '낮은 등급이 따로 벌어진 상태', '');
    more.push({ id: 'credit-ladder', label: '신용 사다리', text: `CCC÷하이일드 ${ladder.ratio.toFixed(2)}배${side(ladder.ratioRank)}, 하이일드−투자등급 ${Math.round(ladder.gap)}bp${side(ladder.gapRank)}${word ? ` — ${word}` : ''}.` });
  }
  const structure = volatilityStructure(history);
  if (structure) {
    const bits = [structure.ratio != null ? `VIX÷3개월 VIX ${structure.ratio.toFixed(2)}${side(structure.ratioRank)}${structure.term ? ` ${structure.term.label}` : ''}` : '', structure.premium != null ? `변동성 프리미엄 ${signedText(structure.premium, 1, 'pt')}${side(structure.premiumRank)}` : '',
      structure.range ? `${md(structure.range.date)} S&P 500 ${signedText(structure.range.move, 1, '%')}, ${md(structure.range.priorDate)} VIX 기준 ±${structure.range.sd.toFixed(1)}% ${structure.range.label}` : ''].filter(Boolean);
    if (bits.length) more.push({ id: 'vol-structure', label: '변동성 구조', text: `${bits.join(', ')}.` });
  }
  return { id: 'depth', title: '폭·신용·채권·변동성 추가 확인', axes: [], asOf: dates.sort().at(-1) || null, text: parts.join(' '), map: null, more,
    values: { thrust, credit, correlation: corr, variancePremium: vrp, rateShock: shock, concentration: conc, creditLadder: ladder, volatilityStructure: structure } };
}
