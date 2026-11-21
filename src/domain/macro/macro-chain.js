// The 매크로 transmission chain (oil → inflation expectations → policy path → long rates → valuations, plus the dollar and
// credit branches). Only the 매크로 screen draws it, so it loads with that route (macro-board) instead of sitting in the boot
// set beside buildMacroRead, which the home interpretation needs. It reads the same inputs as buildMacroRead and the same
// shared pieces (the 시장 상태 axes, ratesEvidence, policyPricing, creditObservation), so the chain and the factor rows above
// it never disagree.
import { creditCause, creditDispersion, creditNeutralCause, creditReleaseText, creditState, hyWidening20Record } from '../briefing/market-read.js';
import { RULES } from '../rules/thresholds.js';
import { brentWtiCheck } from './liquidity-growth.js';
import { oilDivergence } from './macro-signals.js';
import { readNumber as finite } from '../shared/number.js';
import { withTopicParticle } from '../content/korean-particle.js';
import { STATE_LABELS } from '../market/interpretation/concepts.js';
import { closeChanges, creditObservation, monthDay, policyPricing, ratesEvidence, signed } from './macro-read.js';

const P = RULES.policy;

/** Each node shows its move; a link is drawn as active only when both ends moved the same way past the stated thresholds. */
export function buildMacroChain({ macro = null, macroHistory = null, regime = null, rateFx = null, history = null } = {}) {
  if (!rateFx && Array.isArray(history)) rateFx = closeChanges(history);
  const m = macro && typeof macro === 'object' ? macro : {};
  const mh = macroHistory?.schemaVersion === 'macro-history.v1' ? macroHistory : null;
  const oil = brentWtiCheck(macroHistory, Array.isArray(history) ? history : []);
  const axisById = Object.fromEntries((regime?.axes || []).map((row) => [row.id, row]));
  const fx = rateFx || {};
  const wti20 = fx.wti20 ?? null;
  // Expert review M06: WTI alone read as easing oil while Brent rose sharply; such a node is held, not coloured favourable.
  // A same-day Brent-WTI gap far outside its usual range (abnormal) holds the node as well — neither the
  // Brent reading nor "WTI 하락 = 물가 완화" is drawn from a pair that may not be comparable.
  // The one shared Brent/WTI rule (macro-signals oilDivergence) — the rate hub, the scenario conditions and
  // this node no longer disagree (WTI -7.2% drawn ▼ beside "두 유가의 방향이 달라 하락으로 보지 않습니다").
  const oilHeld = oilDivergence(oil).held;
  // A 5-session move against the 20-session direction is named beside it (direction unchanged).
  const wti5 = fx.wti5 ?? null;
  const oilShort = wti20 != null && wti5 != null && Math.abs(wti5) >= RULES.oil.turn5dPct && Math.sign(wti5) !== Math.sign(wti20) ? `(최근 5일 ${signed(wti5, 1, '%')} ${wti5 > 0 ? '반등' : '반락'})` : '';
  // A real yield and a breakeven observed on different days are not comparable. The briefing already
  // holds them apart (market-read splitHeld); the chain must not draw or compare their 5-day moves either.
  const asOfDay = (value) => String(value || '').slice(0, 10);
  const splitReal = !!(m._asOf_realYield10 && m._asOf_breakeven10 && asOfDay(m._asOf_realYield10) !== asOfDay(m._asOf_breakeven10));
  // The breakeven node shows the breakeven's own 5-session move, which needs no real yield. Withholding
  // it ('기준일이 달라 보류') whenever the real yield posted a day later blanked the node while 주제별로 보기 printed the same
  // breakeven move; only the real-versus-breakeven comparison below needs one date.
  const bei5 = finite(m.breakeven10Delta5);
  // Macro audit 2026-10-17: the same midpoint as the 통화정책 axis — upper − 0.125 assumed a 25bp-wide range.
  const pricing = policyPricing(m).pricing;
  // The rates node, its sentence and its legend line read the leg the verdict reported.
  const ratesRead = ratesEvidence(axisById.rates?.decidedBy || null, fx.tnx20 ?? null);
  const real5 = splitReal ? null : finite(m.realYield10Delta5);
  const dxy20 = fx.dxy20 ?? null;
  // The credit branch reads the one HY observation the 시장 상태 credit axis read (level and changes on one date).
  const hyObs = creditObservation({ regime, macro: m, macroHistory: mh });
  const hyBpNow = hyObs?.level ?? null;
  const hy5 = hyObs?.change5 ?? null;
  // "안정" is said only when creditState() is favorable — the same verdict as the 시장 상태 credit
  // axis. A small 5-day move alone is not calm (the level or a 20-session widening can still hold the axis at 중립/부담).
  const creditVerdict = axisById.credit?.state || creditState({ hyBp: hyBpNow, hy5, hy20: hyObs?.change20 ?? null });
  // Codex audit F06: a 부담 names the input that decided it (level / 5-session / 20-session record), never a fixed "수준".
  const record20 = mh ? hyWidening20Record(mh) : null;
  const cause = creditCause({ hyBp: hyBpNow, hy5, hy20Record: record20 });
  const burdenText = cause.level ? `스프레드 수준(${Math.round(hyBpNow)}bp)이 부담 구간(${RULES.credit.stressAtBp}bp 이상)입니다`
    // '88백분위라 부담입니다' gave a reason under the 90th-percentile entry line — the state was held by
    // the latch. A held reading says it is held, since when, and what releases it (creditReleaseText, the axis's own words).
    : cause.wide20 ? (record20.value >= record20.enterBp
      ? `수준(${Math.round(hyBpNow)}bp)은 부담 구간이 아니지만 20거래일 ${signed(record20.value, 0, 'bp')} 확대가 ${record20.highest ? '지난 1년 중 가장 큰 폭' : `지난 1년 변화의 상위 ${Math.max(1, 100 - record20.pct)}%`}이라 부담입니다 — 수준보다 확대 속도가 먼저 경고합니다`
      : `수준(${Math.round(hyBpNow)}bp)은 부담 구간이 아니지만 ${record20.since ? `${monthDay(record20.since)}에 시작된 ` : ''}확대 부담 판정이 이어지는 중입니다(20거래일 ${signed(record20.value, 0, 'bp')}) — ${creditReleaseText({ hyBp: hyBpNow, hy5, hy20: record20.value, latched: true })}으로 바뀝니다`)
      : '신용 지표가 부담입니다 — 수준과 5·20거래일 변화를 함께 확인합니다';
  // A 중립 names the 양호 conditions it misses, with their values; a narrowing 5-session move is stated as its figure.
  const neutralText = () => {
    const spread = mh ? creditDispersion(mh, hyObs?.asOf || null) : null;
    const misses = creditNeutralCause({ hyBp: hyBpNow, hy5, hy20: hyObs?.change20 ?? null, lowerRated: spread?.lowerRated === true,
      cccGapBp: spread?.cccBp != null ? spread.cccBp - spread.hyBp : null });
    const lead = hy5 != null && hy5 <= RULES.credit.calm5dBp ? `5거래일 ${signed(hy5, 0, 'bp')}에도 ` : '';
    return misses.length ? `${lead}신용 지표는 중립입니다 — 양호 조건 중 ${misses.join(', ')}에 걸립니다`
      : `신용 지표는 중립입니다 — 수준 ${hyBpNow == null ? '—' : `${Math.round(hyBpNow)}bp`}, 5거래일 ${hy5 == null ? '—' : signed(hy5, 0, 'bp')}`;
  };
  const creditCalm = creditVerdict === 'favorable' ? '신용 시장은 안정적입니다'
    : creditVerdict === 'burden' ? burdenText
      : creditVerdict === 'neutral' ? neutralText()
        : `신용 지표 ${STATE_LABELS.unknown} — 스프레드 기록을 기다립니다`;
  const dir = (value, up, down) => value == null ? 'unknown' : value >= up ? 'up' : value <= down ? 'down' : 'flat';
  const nodes = [
    { id: 'oil', label: '유가 (WTI)', held: oilHeld, value: wti20 == null ? '—' : `20거래일 ${signed(wti20, 1, '%')}${oilShort}${oilHeld ? (oil?.abnormal ? ', 브렌트 비교 보류' : `, 브렌트 ${signed(oil.brent20, 1, '%')}`) : ''}`, dir: fx.wtiHigh && wti20 != null && wti20 > RULES.oil.fall20dPct ? 'up' : dir(wti20, RULES.oil.rise20dPct, RULES.oil.fall20dPct) },
    { id: 'breakeven', label: '기대인플레이션', value: bei5 == null ? '—' : `5거래일 ${signed(bei5 * 100, 0, 'bp')}`, dir: dir(bei5 == null ? null : bei5 * 100, RULES.breakeven.move5dBp, -RULES.breakeven.move5dBp) },
    { id: 'policy', label: '연준 경로 (2년물)', value: pricing == null ? '—' : pricing >= P.pricedMovePp ? `기준금리 대비 ${signed(pricing, 2, '%p')}` : pricing <= -P.pricedMovePp ? `기준금리 대비 ${signed(pricing, 2, '%p')}` : '동결 근접', dir: dir(pricing, P.pricedMovePp, -P.pricedMovePp) },
    { id: 'rates', label: '장기금리 (10년물)', value: ratesRead.node, dir: ratesRead.dir },
    { id: 'valuation', label: '주식 밸류에이션 압력(해석)', inferred: true, value: axisById.rates ? `관측 아님, 금리 지표 ${axisById.rates.stateLabel}에서 추론` : '—', dir: axisById.rates?.state === 'burden' ? 'down' : axisById.rates?.state === 'favorable' ? 'up' : 'flat' }
  ];
  const links = [];
  // The full Brent–WTI paragraph is shown once, under the WTI chart (macro-board); the chain and the axis point there.
  if (oilHeld) links.push('유가 고리는 브렌트와 WTI가 엇갈려 판단을 보류합니다 — 두 유가의 같은 날 비교는 WTI 원유 차트 설명에 있습니다.');
  if (!oilHeld && nodes[0].dir !== 'unknown' && nodes[0].dir !== 'flat' && nodes[0].dir === nodes[1].dir) links.push(`유가(20일)와 기대인플레이션(5거래일)이 함께 ${nodes[0].dir === 'up' ? '오르고' : '내리고'} 있습니다 — 유가가 물가 예상으로 옮겨 가는 경로와 같은 방향이지만, 관측 기간이 달라 인과를 확인한 것은 아닙니다.`);
  // 2년물은 프리미엄을 분리하지 못한 대용 지표 — 링크 문장도 해석 단정 대신 관측을 말한다.
  if (nodes[2].dir === 'up') links.push('2년물이 기준금리 중간값보다 높습니다. 기간 프리미엄이 섞여 있어 추가 인상 예상으로 단정하지 않습니다.');
  if (nodes[2].dir === 'down') links.push('2년물이 기준금리 중간값보다 낮습니다. 기간 프리미엄이 섞여 있어 인하 예상으로 단정하지 않습니다.');
  // With no breakeven move (node 'unknown') the line no longer reads it as '번지지 않음'.
  if (!oilHeld && nodes[0].dir === 'up' && nodes[1].dir !== 'up') links.push(fx.wtiHigh ? '유가가 1년 범위 상단에 있어 물가 부담 요인입니다.' : nodes[1].dir === 'unknown' ? `유가가 20일 동안 ${signed(wti20, 1, '%')} 올랐습니다 — 기대인플레이션으로 번지는지는 같은 날 값이 없어 보류합니다.` : `유가가 20일 동안 ${signed(wti20, 1, '%')} 올랐습니다 — 아직 기대인플레이션으로 크게 번지지는 않았습니다.`);
  if (ratesRead.rise) links.push(`${ratesRead.rise}${real5 != null && bei5 != null && real5 > bei5 && real5 > 0 ? ' — 실질금리 우위는 5거래일 관측 기준이며(20일 전체 분해는 자료가 없음), 그 관측은 성장주 밸류에이션 부담 쪽과 같은 방향입니다' : ''}.`);
  // A fall with stocks falling is the axis's growth-scare 중립, not a lighter discount rate.
  // the rates axis carries no sentence; a non-favorable fall states its figures and the axis state.
  const growthScare = axisById.rates?.growthScare;
  if (nodes[3].dir === 'down') links.push(axisById.rates && axisById.rates.state !== 'favorable'
    ? `10년물 20거래일 ${signed(axisById.rates.decidedBy?.d20 ?? fx.tnx20, 0, 'bp')}${growthScare ? `, S&P 500 20거래일 ${signed(growthScare.spx20, 1, '%')}` : ''} — 금리 지표 ${axisById.rates.stateLabel}.`
    : `10년물이 20일 동안 ${signed(axisById.rates?.decidedBy?.d20 ?? fx.tnx20, 0, 'bp')} 내려 할인율 부담이 줄고 있습니다.`);
  // Codex browser audit H15: when two neighbours on the textbook path moved in opposite directions, the arrow is
  // not working right now — say so as a question to check, instead of letting the drawn arrow imply it does.
  for (const [a, b] of [[0, 1], [1, 3]]) { // the policy node is a level against the target, not a move
    const from = nodes[a];
    const to = nodes[b];
    if (from.held) continue;
    if (!['up', 'down'].includes(from.dir) || !['up', 'down'].includes(to.dir) || from.dir === to.dir) continue;
    links.push(`${withTopicParticle(from.label)} ${from.dir === 'up' ? '올랐는데' : '내렸는데'} ${withTopicParticle(to.label)} ${to.dir === 'up' ? '올라' : '내려'} 반대로 움직였습니다. 다른 요인이 더 큰지, 관측 기간이 달라서인지 확인할 지점입니다.`);
  }
  const branches = [
    { id: 'dollar', label: '달러', value: dxy20 == null ? '—' : `20일 ${signed(dxy20, 1, '%')}`, dir: dir(dxy20, RULES.dollar.rise20dPct, RULES.dollar.fall20dPct), effect: dxy20 == null ? null : dxy20 >= RULES.dollar.rise20dPct ? '달러 강세 → 미국 다국적 기업의 해외 매출 환산 감소, 신흥국·원화 약세(외국인 순매도 압력)' : dxy20 <= RULES.dollar.fall20dPct ? '달러 약세 → 해외 매출 환산 증가, 신흥국·원화에 우호적' : '달러는 큰 방향 없이 움직이고 있습니다' },
    { id: 'credit', label: '하이일드 스프레드', value: hy5 == null ? '—' : `5거래일 ${signed(hy5, 0, 'bp')}${cause.wide20 && finite(record20?.value) != null ? `, 20거래일 ${signed(record20.value, 0, 'bp')}` : ''}`, dir: dir(hy5, RULES.credit.widen5dBp, -RULES.credit.widen5dBp), effect: hy5 == null ? null : hy5 >= RULES.credit.widen5dBp ? '스프레드 확대 → 기업 자금 조달 비용 상승, 주식 위험 프리미엄 상승' : hy5 <= -RULES.credit.widen5dBp ? '스프레드 축소 → 자금 조달 여건 개선' : creditCalm }
  ];
  // Colour by effect on stocks: every node rising is a headwind except valuation, where a fall is.
  // A node whose fact has a 시장 상태 axis takes that axis's state (rates, credit), so the chain
  // never colours ▼유리 what the factor row above calls 중립; the arrow still shows the observed direction.
  const AXIS_OF = { rates: 'rates', credit: 'credit' };
  const fromAxis = (node) => { const state = axisById[AXIS_OF[node.id]]?.state; return state === 'burden' || state === 'favorable' ? state : state === 'neutral' ? 'flat' : null; };
  const impact = (node) => fromAxis(node) || (node.dir === 'unknown' || node.dir === 'flat' ? node.dir : (node.id === 'valuation' ? node.dir === 'down' : node.dir === 'up') ? 'burden' : 'favorable');
  // The 'not causation' caveat is stated once, in the section lead above the chain; the legend keeps the thresholds.
  const legend = `▲▼ 기준(시장 상태와 같음): 유가 20일 +${RULES.oil.rise20dPct}% 이상 또는 1년 범위 ${RULES.oil.rangeHighAt * 100}% 이상 / ${RULES.oil.fall20dPct}% 이하, 기대인플레이션 5거래일 ±${RULES.breakeven.move5dBp}bp, 2년물 − 기준금리 ±${P.pricedMovePp}%p, ${ratesRead.legend}, 달러 20일 ±${RULES.dollar.rise20dPct}%, 하이일드 스프레드 5거래일 ±${RULES.credit.widen5dBp}bp. 주황 테두리는 주식에 부담, 초록은 양호.`;
  return { nodes: nodes.map((node) => ({ ...node, impact: node.held ? 'unknown' : impact(node) })), links, branches: branches.map((node) => ({ ...node, impact: impact(node) })), legend };
}
