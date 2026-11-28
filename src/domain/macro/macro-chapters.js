// v59.55 (owner 11/1, "PCE 분석 및 설명은 아예 없고, 유가 분석 없고, 최근 금/은 급락에 대해서도 설명은 없고, 고용/노동 분석
// 없고, 향후 … CPI 발표 체크해야된다라는 내용도 없고"): 매크로's six chapters. Each answers one question with one small
// picture, the latest numbers, what they mean for stocks, the next dated release and the condition that would change the
// read. Every number comes from macro-history.json (FRED) or history.json; every sentence is chosen by a rule here.
import { oneSessionDay } from '../market/day/one-session.js';
import { readNumber, signedText } from '../shared/number.js';
import { dayLabel, ratesLegsOffset } from '../market/story/market-story.js';
import { buildCloseSeries, closeBasis } from '../market/session/close-series.js';
import { MARKET_WINDOWS, closeChange } from '../market/session/market-windows.js';
import { rateDifferential, sessionPointBack, wonMoveSentence } from './rates-fx.js';
import { RULES } from '../rules/thresholds.js';
import { withTopicParticle } from '../content/korean-particle.js';
import { oasDelta20Bp, oilCheckOf } from '../briefing/market-read.js';
import { creditJudgement, creditReading, creditFlip, cccTailLine, creditContagion } from '../briefing/credit-reading.js';
import { dollarRiseBurden } from '../briefing/market-read.js';
import { coreInflationRead, monthChangeAt, monthIndex, monthOverMonth, policyLean, yoySeries } from './macro-read.js';
import { changeOverDays, MACRO_SIGNAL_RULES } from './macro-signals.js';
import { NET_LIQUIDITY_FLAT_BN, netLiquiditySeries } from './liquidity-growth.js';
import { PLUMBING_RULES, plumbingRead } from './funding-plumbing.js';
import { laborLadder, unemploymentSplit } from './labor-ladder.js';
import { ANCHOR_RULES, expectationsAnchor } from './expectations-anchor.js';
import { policyCycle } from './macro-signals.js';
import { fedTargetRange } from './fed-target-range.js';
import { crossAssetVerdicts } from './cross-asset-relations.js';
import { formatKstWhen, releaseAtMs } from '../briefing/schedule.js';
import { volatilityChapter } from './volatility.js';
import { closeMoveGrade } from '../market/session/move-size.js';
import { AXIS_LABELS } from '../market/interpretation/concepts.js';
import { shortDate } from '../content/date-labels.js';

// The shared signedText, so a 20-session +0.04% prints 0.0%, never '+0.0%'.
const signed = (value, digits = 2, unit = '%') => signedText(value, digits, unit);
const bp = (value) => signedText(value, 0, 'bp');

function series(macroHistory, id) {
  return (macroHistory?.series?.[id]?.observations || []).filter(([day, value]) => day && readNumber(value) !== null).map(([day, value]) => ({ date: day, value: Number(value) }));
}
// month-over-month only between calendar-adjacent months. Array neighbours across a skipped release
// (October 2025, the shutdown month) printed a two-month change as '전월비'.
const lastMoM = (rows) => { const tail = rows.slice(-2); return tail.length === 2 ? monthOverMonth(tail).at(-1) || null : null; };
const monthName = (date) => `${Number(String(date).slice(5, 7))}월`;
const nextOf = (events, ids) => (events || []).find((event) => ids.includes(event.id)) || null;
// v59.74 (macro review): the release in Korean time, as the page subtitle and the policy-rate card say it — an FOMC decision
// at 14:00 ET is 12/10(목) 04:00 KST, and the chapter read '12/9(수) FOMC 회의' beside it.
const whenOf = (event) => {
  if (!event) return '';
  const at = releaseAtMs(event.id, event.date);
  return Number.isFinite(at) ? `${formatKstWhen(at).label} KST ${event.name}` : `${dayLabel(event.date)} ${event.name}`;
};
// Every chapter change is the shared 20-session window ('20거래일'), counted in exchange sessions.
// Rows (history.json carries weekend copies) and 21 calendar days gave WTI +12.7% / 달러 -0.3% here beside the six-factor
// table's 20거래일 +14.3% / 0.0% on the same screen.
const WINDOW = MARKET_WINDOWS.rule;
const shortDay = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
function historySpan(history, field) {
  const change = closeChange(history, field, WINDOW);
  // grade: the move against the series' own volatility (move-size.js), the one source of every size word below.
  return change ? { from: change.from.value, to: change.to.value, pct: change.pct, grade: closeMoveGrade(history, field, change.pct, { sessions: WINDOW, through: change.to.date }) } : null;
}
// FRED daily observations; `through` cuts every leg of a decomposition at one common date.
function macroChange(macroHistory, id, through = null) {
  const rows = series(macroHistory, id).filter((row) => !through || row.date <= through);
  if (rows.length < 2) return null;
  const end = rows.at(-1);
  const start = sessionPointBack(rows, WINDOW);
  return start ? { from: start.value, to: end.value, bp: (end.value - start.value) * 100, date: end.date, fromDate: start.date } : null;
}

function inflation(macroHistory, events) {
  // the pace, the year and the direction come from coreInflationRead — the reading the 물가 axis and the
  // quadrant use (calendar months, PCE·CPI agreement). The chapter's own 'last two months vs the two before' (0.08pp) said
  // '다시 빨라졌습니다' while the axis and the quadrant said 방향 보류 on the same screen.
  const core = coreInflationRead({ mh: macroHistory });
  const pce = core.corePceIndex;
  if (pce.length < 14 || !core.pace) return null;
  const mom = monthOverMonth(pce.slice(-7));
  if (mom.length < 4) return null;
  const last = mom.at(-1);
  const three = core.pace.value;
  const yoy = core.pceYoyForPace ?? yoySeries(pce).at(-1)?.value ?? null;
  if (yoy == null) return null;
  const cpiMom = lastMoM(series(macroHistory, 'coreCpiIndex'));
  const shelter = lastMoM(series(macroHistory, 'shelterCpiIndex'));
  const supercore = lastMoM(series(macroHistory, 'supercoreCpiIndex'));
  const recent = (mom.at(-1).value + mom.at(-2).value) / 2;
  const before = (mom.at(-3).value + mom.at(-4).value) / 2;
  const monthly = recent - before >= 0.08 ? '최근 두 달이 그 전 두 달보다 빨랐지만' : before - recent >= 0.08 ? '최근 두 달이 그 전 두 달보다 느렸지만' : '최근 넉 달 비슷했고';
  const d = core.direction;
  const pace = `근원 PCE 3개월 연율 ${three.toFixed(1)}%, 1년치 ${yoy.toFixed(1)}%`;
  // A direction from one published measure names that measure only (inflationDirection single): the other is not evidence.
  const only = d.single ? [d.pce, d.cpi].find(Boolean) : null;
  const turn = (d.state === 'up' || d.state === 'down') && only
    ? `${only.name}의 3개월 연율 ${only.pace.toFixed(1)}%가 1년치(${only.yoy.toFixed(1)}%)보다 ${d.state === 'up' ? '빨라 물가가 다시 빨라지는 쪽' : '느려 물가가 내려오는 쪽'}입니다 — 다른 지표는 아직 확인되지 않았습니다`
    : d.state === 'up' ? `근원 PCE·CPI의 3개월 속도가 모두 1년치보다 빨라 물가가 다시 빨라지고 있습니다`
    : d.state === 'down' ? `근원 PCE·CPI의 3개월 속도가 모두 1년치보다 느려 물가가 내려오는 중입니다`
      : d.state === 'mixed' ? `월간 속도는 ${monthly} 두 지표의 3개월 속도가 엇갈려(${d.text}) 재가속으로 보지 않습니다`
        // One measure past its step while the other is flat: name the one that moved — it is what the next release settles.
        : (() => {
          const moved = [d.pce, d.cpi].find((row) => row && row.dir !== 'flat');
          const still = [d.pce, d.cpi].find((row) => row && row.dir === 'flat');
          if (moved && still) return `${moved.name}는 3개월 연율 ${moved.pace.toFixed(1)}%로 1년치(${moved.yoy.toFixed(1)}%)보다 ${moved.dir === 'up' ? '빨라 재가속 신호' : '느려 둔화 신호'}지만, ${still.name}(${still.pace.toFixed(1)}%, 1년치 ${still.yoy.toFixed(1)}%)가 따라오지 않아 물가 방향은 보류입니다`;
          return `월간 속도는 ${monthly} ${pace} — 1년치와 큰 차이가 없어 방향은 보류입니다`;
        })();
  // after a hike the question is whether the Fed goes further, not whether it can cut. the
  // shared policyCycle (the 물가 axis and the release bands read the same one).
  const hiking = policyCycle(series(macroHistory, 'fedTargetUpper')).hiking;
  const I = RULES.inflation;
  const hot = hiking
    ? (three >= I.missPct ? '연준 목표 2%보다 한참 빠른 속도라 추가 인상 압력이 남아 있습니다' : three >= I.nearTargetPct ? '목표보다 조금 빨라 높은 금리가 오래 갈 쪽입니다' : '목표 근처라 추가 인상 근거는 약합니다')
    : three >= I.missPct ? '연준 목표 2%보다 한참 빠른 속도라 금리 인하 여지가 좁습니다' : three >= I.nearTargetPct ? '목표보다 조금 빨라 인하는 천천히 갈 쪽입니다' : '목표 근처라 연준이 금리를 내릴 여지가 있습니다';
  const service = shelter && supercore && shelter.value >= 0.3 && supercore.value >= 0.3 ? ' 주거비와 주거비 제외 서비스가 함께 올라 서비스 물가가 다시 붙었습니다.' : '';
  const next = nextOf(events, ['us-cpi', 'us-pce']);
  // Expectations: a market leg (5y5y, 10-year breakeven) and the survey leg (Michigan 5-10 years) — expectations-anchor.js.
  const anchor = expectationsAnchor(macroHistory);
  const preYears = `${ANCHOR_RULES.prePandemicFrom.slice(0, 4)}~${ANCHOR_RULES.prePandemicTo.slice(0, 4)}`;
  const marketRow = (leg, name) => [name, `${leg.level.toFixed(2)}% (${shortDay(leg.date)}, 20거래일 ${bp(leg.bp)})`];
  const expectRows = [...anchor.markets.map((leg) => marketRow(leg, leg.id === 'fiveYearForward' ? '5년 뒤 5년 기대인플레 (5y5y)' : '10년 기대인플레 (BEI)')),
    ['미시간 5~10년 기대인플레', anchor.survey ? `${anchor.survey.level.toFixed(1)}% (${monthName(anchor.survey.date)}, 전월비 ${signed(anchor.survey.change, 1, '%p')}${anchor.survey.top == null ? '' : `, ${preYears} 최고 ${anchor.survey.top.toFixed(1)}%`})` : '자료 없음'],
    ...(anchor.oneYear ? [['미시간 1년 기대인플레', `${anchor.oneYear.value.toFixed(1)}% (${monthName(anchor.oneYear.date)})`]] : [])];
  return {
    id: 'inflation', title: `${AXIS_LABELS.inflation} — PCE · CPI`, question: hiking ? '연준의 추가 인상과 동결 사이' : '연준의 금리 인하 여지',
    verdicts: [{ id: 'expectations', name: '기대인플레', label: anchor.label, tone: anchor.state === 'watch' ? 'warn' : anchor.state === 'anchored' ? 'good' : 'neutral' }],
    viz: { caption: '근원 PCE 전월비 (%)', unit: '%', points: mom.map((row, index) => ({ x: monthName(row.date), value: row.value, hot: index === mom.length - 1 })) },
    now: `${monthName(last.date)} 근원 PCE ${signed(last.value)} · 3개월 연율 ${three.toFixed(1)}% · 전년비 ${yoy.toFixed(1)}%`,
    mean: `${turn}. ${hot}.${service}`,
    next: whenOf(next) || '발표 일정을 확인하지 못했습니다',
    flip: `근원 PCE·CPI의 3개월 연율이 함께 1년치보다 ${I.reaccelPp}%p 이상 빨라지면 재가속, 함께 그만큼 느려지면 둔화로 정해집니다 — 월 +0.2% 이하가 이어지면 3개월 연율은 약 2.4% 아래로 내려옵니다. 5y5y나 10년 기대인플레가 20거래일 +${RULES.crossAsset.rate20dBp}bp 이상 오르고 미시간 5~10년 기대가 전월보다 올라 ${preYears} 최고치를 넘으면 탈앵커링 감시입니다.`,
    detail: [['근원 CPI 전월비', cpiMom ? `${signed(cpiMom.value)} (${monthName(cpiMom.date)})` : '—'], ['주거비 CPI', shelter ? signed(shelter.value) : '—'], ['주거비 제외 서비스', supercore ? signed(supercore.value) : '—'], ['근원 CPI 3개월 연율', core.coreCpiPace ? `${core.coreCpiPace.value.toFixed(1)}% (${monthName(core.coreCpiPace.date)}${core.coreCpiYoy ? `, ${core.coreCpiYoy.derived ? core.coreCpiYoy.label : '1년치'} ${core.coreCpiYoy.value.toFixed(1)}%${core.coreCpiYoy.note}` : ', 같은 달 1년치 없음'})` : '—'], [core.directionLabel || '물가 방향 (PCE·CPI)', d.label || '—'], ...expectRows]
  };
}

function labor(macroHistory, events) {
  const payrolls = series(macroHistory, 'payrolls');
  const unemployment = series(macroHistory, 'unemployment');
  if (payrolls.length < 7 || unemployment.length < 13) return null;
  const changes = payrolls.slice(-7).slice(1).map((row, index) => ({ date: row.date, value: row.value - payrolls.slice(-7)[index].value }))
    .filter((row, index) => monthIndex(row.date) - monthIndex(payrolls.slice(-7)[index].date) === 1);
  if (changes.length < 3) return null;
  const avg3 = changes.slice(-3).reduce((sum, row) => sum + row.value, 0) / 3;
  const rate = unemployment.at(-1);
  // The slowdown ladder (labor-ladder.js) decides the stage; the growth axis's Sahm reading and claims trend are its last
  // rung (해고 급증), so the chapter and the axis read one rule.
  const G = RULES.growth;
  const ladder = laborLadder(macroHistory);
  const split = unemploymentSplit(macroHistory);
  const { sahm, claims } = ladder;
  const natural = series(macroHistory, 'naturalUnemployment').at(-1);
  const next = nextOf(events, ['us-nfp']);
  const sahmLine = sahm ? (sahm.low + G.sahmRecessionAt).toFixed(2) : null;
  const claimsLine = claims ? claims.low * (1 + G.claimsRiseAbovePct / 100) : null;
  const pp = (value) => signed(value, 2, '%p');
  const tenK = (value) => `${(value / 10).toFixed(0)}만`; // thousands → 만
  const yearText = (t, fmt) => (t ? `${fmt(t.now)} (1년 전 ${fmt(t.then)}, ${monthName(t.date)}까지 3개월 평균)` : '자료 없음');
  const rungText = (rung) => {
    const met = rung.met === true ? '해당' : rung.met === false ? '아님' : '자료 없음';
    const f = rung.facts;
    const facts = rung.id === 'openings' ? [`구인 ${yearText(f.openings, tenK)}`, f.hours ? `주당 근로시간 ${yearText(f.hours, (v) => `${v.toFixed(1)}시간`)}` : null]
      : rung.id === 'hiring' ? [`채용 ${yearText(f.hires, tenK)}`, `해고 ${yearText(f.layoffs, tenK)}`]
        : rung.id === 'wages' ? [f.wageNow && f.wageThen ? `전년비 ${f.wageNow.value.toFixed(1)}% (1년 전 ${f.wageThen.value.toFixed(1)}%, ${monthName(f.wageNow.date)})` : '자료 없음']
          : rung.id === 'reentry' ? [`재진입 실업자 ${yearText(f.reentry, tenK)}`]
            : [f.layoffs ? `JOLTS 해고 ${f.layoffs.dir === 'up' ? '증가' : '증가 아님'}` : null, f.claims ? `실업수당 청구 4주 평균 1년 저점 대비 ${signed(f.claims.aboveLow, 0)}` : null, f.sahm ? `Sahm ${f.sahm.value.toFixed(2)}%p` : null];
    return `${met} — ${facts.filter(Boolean).join(' · ')}`;
  };
  const stageTone = ladder.stage >= 5 ? 'warn' : ladder.stage === 0 && ladder.known ? 'good' : 'neutral';
  return {
    id: 'labor', title: '고용 — 둔화 단계', question: '노동 둔화가 어느 단계에 와 있는지',
    verdicts: [{ id: 'labor-stage', name: '노동', label: ladder.label, tone: stageTone },
      split ? { id: 'unemployment-split', name: `${monthName(split.date)} 실업률`, label: split.label, tone: ['loss', 'exit'].includes(split.kind) ? 'warn' : 'neutral' } : null].filter(Boolean),
    ladder: { stage: ladder.stage, rungs: ladder.rungs.map(({ id, short, label, met }) => ({ id, short, label, met })) },
    // The split of the latest unemployment-rate change when both legs are published; the payroll months otherwise.
    viz: split
      ? { caption: `${monthName(split.from)}→${monthName(split.date)} 실업률 변화 나누기 (%p)`, unit: '%p', points: [{ x: '실업자', value: split.numeratorPp, hot: true }, { x: '경제활동인구', value: split.denominatorPp }, { x: '합', value: split.changePp }] }
      : { caption: '비농업 고용 증감 (천 명)', unit: '', points: changes.map((row, index) => ({ x: monthName(row.date), value: row.value, hot: index === changes.length - 1 })) },
    now: `${monthName(changes.at(-1).date)} 고용 ${signedText(changes.at(-1).value / 10, 1)}만 · 3개월 평균 ${signedText(avg3 / 10, 1)}만 · 실업률 ${rate.value.toFixed(1)}% (${monthName(rate.date)})${claims ? ` · 실업수당 청구 4주 평균 ${(claims.avg4 / 10000).toFixed(1)}만 (${shortDay(claims.date)})` : ''}`,
    next: whenOf(next) || '발표 일정을 확인하지 못했습니다',
    flip: `JOLTS 해고가 1년 전보다 늘거나, 실업수당 청구 4주 평균이 1년 저점보다 ${G.claimsRiseAbovePct}% 이상${claimsLine ? `(${(claimsLine / 10000).toFixed(1)}만 건)` : ''} 늘거나, ${sahmLine ? `실업률 3개월 평균이 ${sahmLine}% 이상(Sahm ${G.sahmRecessionAt}%p)` : `Sahm 지표 ${G.sahmRecessionAt}%p 이상`}이 되면 5단계(해고 급증)입니다.`,
    detail: [...ladder.rungs.map((rung, index) => [`${index + 1}. ${rung.label}`, rungText(rung)]),
      ...(split ? [[`실업률 변화 나누기 (${monthName(split.from)}→${monthName(split.date)})`, `실업자 ${pp(split.numeratorPp)} + 경제활동인구 ${pp(split.denominatorPp)} = ${pp(split.changePp)}${split.publishedPp == null ? '' : ` (공표 ${signed(split.publishedPp, 1, '%p')})`}${split.u6Pp == null ? '' : ` · U-6 ${signed(split.u6Pp, 1, '%p')}`}`]] : []),
      ['자연실업률 추정', natural ? `${natural.value.toFixed(2)}%` : '—'], ['3개월 평균 고용', `${(avg3 / 10).toFixed(1)}만`]]
  };
}

// 10년 = 실질 + 기대인플레 holds only on one date: the legs are cut at the latest date all three have (FRED posts the
// real yield a day after the others). v59.74: the oil and metals chapters read the same cut, so one screen does not print a
// 20-session breakeven of -11bp (rates) beside -10bp (oil).
// real retail sales within ±0.2% of flat month over month read as 버티는 정도 (the print's own rounding band is ±0.1%p).
const REAL_RETAIL_FLAT_PCT = 0.2;
const splitThrough = (macroHistory) => ['dgs10', 'realYield10', 'breakeven10'].map((id) => series(macroHistory, id).at(-1)?.date || '').sort()[0] || null;

function rates(macroHistory, events, history = []) {
  // The line names the FRED legs' span, so 4.98% (10/29) beside the market 4.93% (10/30) reads.
  const through = splitThrough(macroHistory);
  const ten = macroChange(macroHistory, 'dgs10', through); const real = macroChange(macroHistory, 'realYield10', through);
  const be = macroChange(macroHistory, 'breakeven10', through); const term = macroChange(macroHistory, 'termPremium10');
  const two = macroChange(macroHistory, 'dgs2', through);
  if (!ten || !real || !be) return null;
  const tnx = closeChange(history, 'tnx', WINDOW, { through: closeBasis(history) });
  const market = tnx ? { from: tnx.from.value, to: tnx.to.value, fromDate: tnx.from.date, date: tnx.to.date, bp: (tnx.to.value - tnx.from.value) * 100 } : null;
  // Flat vs moved and the direction follow the 10-year printed in the bar (market span when present); the real/breakeven
  // shares split the FRED total, so they are read only when that total moved as far and the same way.
  const moved = market ? market.bp : ten.bp;
  const share = ten.bp ? real.bp / ten.bp : 0;
  // A quiet 10-year can hide two legs that cancel (real +12bp, breakeven -11bp): the story's rule (ratesLegsOffset).
  const kind = Math.abs(moved) < 10 ? (ratesLegsOffset(real, be) ? 'offset' : 'flat')
    : Math.abs(ten.bp) < 10 || Math.sign(ten.bp) !== Math.sign(moved) ? 'undivided'
      : share >= 0.6 ? (moved < 0 ? 'growth' : 'tight') : be.bp / ten.bp >= 0.6 ? (moved < 0 ? 'relief' : 'fear') : 'mixed';
  // Which kind of real-yield-led fall (피난·성장 우려·완화) is the one cross-asset verdict, cut on the rate split's date.
  const spxThrough = [ten.date, closeBasis(history)].filter(Boolean).sort()[0] || null;
  const fall = crossAssetVerdicts(history, macroHistory, { through: spxThrough }).rateFall;
  const growthRead = fall.state && fall.state !== 'mixed' ? `하락이 거의 실질금리에서 나왔습니다 · ${fall.label}`
    : '하락이 거의 실질금리에서 나왔습니다. 성장 걱정인지 긴축 기대 후퇴인지는 아직 가르지 않습니다.';
  const offsetRead = `10년 금리는 거의 그대로지만 속은 움직였습니다 — 실질금리 ${bp(real.bp)}를 기대인플레 ${bp(be.bp)}가 상쇄했습니다. ${real.bp > 0
    ? '물가 기대는 내렸는데 실질금리가 올라, 성장주 할인율 부담은 커진 쪽입니다.' : '할인율 부담은 줄었지만 물가 기대가 올라, 물가 발표에 더 민감해지는 조합입니다.'}`;
  const read = { flat: '20거래일 동안 큰 변화가 없습니다.', offset: offsetRead, growth: growthRead,
    tight: '상승이 실질금리에서 나왔습니다. 긴축 부담이 커져 성장주 할인율이 올라갑니다.', relief: '하락이 기대인플레에서 나와 물가 안도 쪽입니다.',
    fear: '상승이 기대인플레에서 나와 물가 걱정 쪽입니다.', mixed: '실질금리와 기대인플레가 함께 움직여 한쪽으로 읽기 어렵습니다.',
    undivided: '10년 금리가 움직였지만 실질금리·기대인플레로 나눠 읽을 수 없습니다.' }[kind];
  const next = nextOf(events, ['us-fed-rate']);
  // the term premium (Kim-Wright, about a week behind) keeps its own span on the bar label and in the numbers.
  const termLabel = term ? `기간 프리미엄(${shortDay(term.date)}까지)` : null;
  // Fold read-outs. The path the short end implies: bills and the 2-year against the target midpoint (they carry a small
  // term premium, so a direction, not a count of priced moves); the word follows the 2-year on the policy axis's line.
  const latest = (id) => series(macroHistory, id).at(-1) || null;
  const upper = latest('fedTargetUpper'); const lower = latest('fedTargetLower');
  const mid = fedTargetRange(lower?.value, upper?.value, lower?.date, upper?.date)?.mid ?? null; // both bounds of one date
  const legs = mid == null ? [] : [['6개월', latest('dgs6mo')], ['1년', latest('dgs1')], ['2년', latest('dgs2')]].filter(([, row]) => row).map(([name, row]) => [name, (row.value - mid) * 100]);
  const gap2 = legs.find(([name]) => name === '2년')?.[1] ?? null;
  const lean = policyLean(gap2 == null ? null : gap2 / 100);
  const path = legs.length < 2 || gap2 == null ? null
    : `${legs.map(([name, gap]) => `${name} ${bp(gap)}`).join(' · ')} — ${lean === 'hike' ? '추가 인상을 반영한 쪽' : lean === 'cut' ? '인하를 반영한 쪽' : '동결 부근'}`;
  // How much of the 10-year move was term premium: both cut on the term premium's own (older) dates.
  const tenTerm = term ? macroChange(macroHistory, 'dgs10', term.date) : null;
  const termSplit = tenTerm && tenTerm.date === term.date && tenTerm.fromDate === term.fromDate
    ? `${shortDay(term.fromDate)}→${shortDay(term.date)} 10년 ${bp(tenTerm.bp)} = 기간 프리미엄 ${bp(term.bp)} + 금리 경로 기대 ${bp(tenTerm.bp - term.bp)}` : null;
  const points = [['10년', market ? market.bp : ten.bp], ['실질', real.bp], ['기대인플레', be.bp], term ? [termLabel, term.bp] : null, two ? ['2년', two.bp] : null].filter(Boolean);
  return {
    id: 'rates', title: `${AXIS_LABELS.rates} — 움직인 이유`, question: '금리 변화의 원인, 물가와 성장 걱정',
    viz: { caption: '20거래일 변화 (bp)', unit: 'bp', points: points.map(([x, value], index) => ({ x, value, hot: index === 1 })) },
    // The 10-year itself is the market close reading every screen shares (closeChange on history tnx); the
    // FRED legs, cut on their own common date, split the move and keep their own span beside them.
    now: market ? `10년 ${market.from.toFixed(2)} → ${market.to.toFixed(2)}% (${shortDay(market.fromDate)}→${shortDay(market.date)}, ${bp(market.bp)}) · 실질 ${bp(real.bp)} · 기대인플레 ${bp(be.bp)} (${shortDay(ten.fromDate)}→${shortDay(ten.date)})`
      : `10년 ${ten.from.toFixed(2)} → ${ten.to.toFixed(2)}% (${shortDay(ten.fromDate)}→${shortDay(ten.date)}, ${bp(ten.bp)}) = 실질 ${bp(real.bp)} + 기대인플레 ${bp(be.bp)}`,
    mean: read,
    next: whenOf(next) || '발표 일정을 확인하지 못했습니다',
    flip: '기대인플레가 같이 움직이기 시작하면 해석이 물가 쪽으로 바뀝니다.',
    // each FRED leg names its own date — '2년 4.46%' (FRED, 11/5) sat undated beside the policy
    // card's 4.51% (Treasury, 11/6).
    detail: [['10년 실질금리', `${real.to.toFixed(2)}% (${shortDay(real.date)})`], ['10년 기대인플레', `${be.to.toFixed(2)}% (${shortDay(be.date)})`], ['기간 프리미엄', term ? `${term.to.toFixed(2)}% (${shortDay(term.date)}, 20거래일 ${bp(term.bp)})` : '—'], ['2년 (FRED)', two ? `${two.to.toFixed(2)}% (${shortDay(two.date)})` : '—'],
      ...(path ? [[`정책금리 ${mid.toFixed(2)}% 대비 단기 금리`, path]] : []), ...(termSplit ? [['10년 변화 나누기', termSplit]] : [])]
  };
}

// v59.64 (owner 2026-11-03: "금&은/유가/금리/신용 스프레드 등등 … 각각 분석해서 시장 상황들이랑 연결"): oil, metals and the
// dollar are chapters of their own (oil and gold shared one card, and silver had no reading at all).
// Oil and the 10-year rising together (2094855932027023670): core inflation re-accelerating or the 10-year breakeven moving
// up past the 20-session rate line is 물가 확산; neither, with the labour ladder showing a slowdown, is 공급 충격 (a tax on
// incomes that hits growth first); neither and no slowdown is not split. Null when the two do not rise together.
export const OIL_SHOCK_WORDS = Object.freeze({ supply: '공급 충격', spread: '물가 확산', undecided: '가르지 않음' });
export function oilShockKind({ oil20 = null, ten20Bp = null, be20Bp = null, coreUp = false, laborStage = 0 } = {}) {
  const C = RULES.crossAsset;
  if (oil20 == null || ten20Bp == null || oil20 < C.oil20dPct || ten20Bp < C.rate20dBp) return null;
  if (coreUp || (be20Bp != null && be20Bp >= C.rate20dBp)) return 'spread';
  return be20Bp != null && laborStage >= 1 ? 'supply' : 'undecided';
}

function oil(history, macroHistory) {
  const wti = historySpan(history, 'wti');
  if (!wti) return null;
  // Brent is read against WTI on their last common close (oilCheckOf, the same check the 시장 and 거시 oil reads use): a
  // missing Brent close must not pair one day's WTI with an older Brent.
  const check = buildCloseSeries(history, 'brent').length ? oilCheckOf(history, closeBasis(history)) : null;
  const brent = check && check.brent20 != null && check.wti20 != null ? { pct: check.brent20, wtiPct: check.wti20, to: check.brent, spread: check.spread, date: check.date } : null;
  const wtiDate = buildCloseSeries(history, 'wti', { through: closeBasis(history) }).at(-1)?.date || null;
  const be = macroChange(macroHistory, 'breakeven10', splitThrough(macroHistory));
  const C = RULES.crossAsset;
  // The shared Brent/WTI rule decides which benchmark speaks (Brent -6.1% beside WTI -1.1% is Brent's move).
  const div = brent ? { held: !!check.held, kind: check.kind, text: check.text } : { held: false, kind: null, text: null };
  const lead = !div.held ? { name: 'WTI', pct: wti.pct, grade: wti.grade } : ['brent-led', 'brent-rise'].includes(div.kind)
    ? { name: '브렌트', pct: brent.pct, grade: closeMoveGrade(history, 'brent', brent.pct, { sessions: WINDOW, through: brent.date }) } : null;
  // Oil and the 10-year rising together: a supply shock or spreading inflation (oilShockKind).
  const tnx = closeChange(history, 'tnx', WINDOW, { through: closeBasis(history) });
  const shock = oilShockKind({ oil20: lead?.pct ?? null, ten20Bp: tnx ? (tnx.to.value - tnx.from.value) * 100 : null, be20Bp: be?.bp ?? null,
    coreUp: coreInflationRead({ mh: macroHistory }).direction?.state === 'up', laborStage: laborLadder(macroHistory).stage });
  // Brent carries the seaborne/Middle East premium WTI does not; the two drifting apart says which supply story moved.
  // Both legs on the common close; when that is older than WTI's own last close, the comparison says which day it is.
  const gap = brent ? brent.pct - brent.wtiPct : null;
  const asOf = brent && wtiDate && brent.date !== wtiDate ? `${Number(brent.date.slice(5, 7))}/${Number(brent.date.slice(8, 10))} 종가 기준 ` : '';
  const spread = !lead || gap == null || Math.abs(gap) < C.oil20dPct ? ''
    : gap < 0 ? ` ${asOf}브렌트(${signed(brent.pct, 1)})가 WTI(${signed(brent.wtiPct, 1)})보다 더 내려, 중동·해상 운송 같은 해외 공급 위험의 값이 빠졌습니다.`
      : ` ${asOf}브렌트(${signed(brent.pct, 1)})가 WTI(${signed(brent.wtiPct, 1)})보다 더 올라, 중동·해상 운송 같은 해외 공급 위험의 값이 붙었습니다.`;
  return {
    id: 'oil', title: '유가 — 물가와 경기 사이', question: '유가가 보내는 물가 신호와 경기 신호',
    verdicts: shock ? [{ id: 'oil-shock', name: '유가·금리 동반 상승', label: OIL_SHOCK_WORDS[shock], tone: shock === 'spread' ? 'warn' : 'neutral' }] : [],
    viz: { caption: '20거래일 등락 (%)', unit: '%', points: [{ x: 'WTI', value: wti.pct, hot: !lead || lead.name === 'WTI' }, brent ? { x: '브렌트', value: brent.pct, hot: lead?.name === '브렌트' } : null].filter(Boolean) },
    now: `WTI $${wti.to.toFixed(1)} (${signed(wti.pct, 1)})${brent ? ` · 브렌트 $${brent.to.toFixed(1)} (${signed(brent.pct, 1)}${asOf ? `, ${asOf.trim()}` : ''})` : ''}`,
    mean: spread.trim(),
    next: '매일 · 산유국 회의, 중동 정세, 미국 원유 재고(매주 수요일)',
    flip: `유가(20거래일 +${C.oil20dPct}% 이상)와 10년 금리(+${C.rate20dBp}bp 이상)가 함께 오를 때 근원 물가가 다시 빨라지거나 10년 기대인플레가 +${C.rate20dBp}bp 이상 오르면 물가 확산, 둘 다 아니고 고용 둔화 단계가 1단계 이상이면 공급 충격입니다.`,
    detail: [['WTI 20거래일 전', `$${wti.from.toFixed(1)}`], ['브렌트', brent ? `$${brent.to.toFixed(1)}` : '—'], ['브렌트 − WTI (같은 날)', brent ? `$${brent.spread.toFixed(1)}${asOf ? ` (${asOf.replace(' 종가 기준 ', '')})` : ''}` : '—'], ['10년 기대인플레', be ? `${be.to.toFixed(2)}% (${shortDay(be.date)}, 20거래일 ${bp(be.bp)})` : '—'],
      ['10년 금리 20거래일', tnx ? `${bp((tnx.to.value - tnx.from.value) * 100)} (${shortDay(tnx.from.date)}→${shortDay(tnx.to.date)})` : '—']]
  };
}

function metals(history, macroHistory) {
  const gold = historySpan(history, 'gold');
  if (!gold) return null;
  const silver = historySpan(history, 'silver');
  const real = macroChange(macroHistory, 'realYield10', splitThrough(macroHistory)); const dollar = historySpan(history, 'dxy');
  const peak = buildCloseSeries(history, 'gold').slice(-MARKET_WINDOWS.half).reduce((best, row) => (row.value > best.value ? row : best), { date: '', value: -Infinity });
  const fromPeak = (gold.to / peak.value - 1) * 100;
  const read = goldRead(gold, real, dollar);
  const ratio = silver ? gold.to / silver.to : null;
  // Silver is gold with an industrial (and higher-beta) leg. Silver lagging a falling gold is not a haven move — the
  // gold/silver ratio rises when growth worry or de-risking hits the more volatile metal first.
  const silverRead = !silver ? '' : silver.pct - gold.pct >= 3 ? ' 은이 금보다 강해 산업 수요(경기) 기대가 섞여 있습니다.'
    : gold.pct - silver.pct >= 3 ? (silver.pct < 0 && gold.pct <= 0 ? ' 은이 금보다 더 빠져(금/은 비율 상승), 산업 수요 걱정이나 변동성 큰 자산부터 줄이는 움직임이 겹쳤습니다.' : ' 은이 금보다 약해 경기보다 안전자산 쪽 수요입니다.')
      : ' 은은 금과 비슷하게 움직였습니다.';
  return {
    id: 'metals', title: '금 · 은 — 안전자산 수요와 포지션', question: '금·은 움직임의 원인, 금리와 자금 쏠림',
    viz: { caption: '20거래일 등락 (%)', unit: '%', points: [{ x: '금', value: gold.pct, hot: true }, silver ? { x: '은', value: silver.pct } : null, dollar ? { x: '달러', value: dollar.pct } : null].filter(Boolean) },
    now: `금 $${Math.round(gold.to).toLocaleString('en-US')} (${signed(gold.pct, 1)}${fromPeak <= -5 ? `, 고점 대비 ${signed(fromPeak, 1)}` : ''})${silver ? ` · 은 $${silver.to.toFixed(2)} (${signed(silver.pct, 1)})` : ''}`,
    mean: `${read}${silverRead}`,
    next: '매일 · 실질금리와 달러, 중앙은행 매수 소식',
    flip: '금이 실질금리와 다시 반대로 움직이면 금리로 설명되는 국면, 금리와 상관없이 크게 빠지면 포지션 정리 국면입니다.',
    detail: [['금 6개월 고점', `$${Math.round(peak.value).toLocaleString('en-US')} (${dayLabel(peak.date).split('(')[0]})`], ['금/은 비율', ratio ? ratio.toFixed(1) : '—'], ['10년 실질금리 20거래일', real ? bp(real.bp) : '—'], ['달러 지수 20거래일', dollar ? signed(dollar.pct, 1) : '—']]
  };
}

// Gold has no yield: a falling real yield or a weaker dollar lowers what holding it costs, so gold usually moves against
// both. v59.74 (macro review): each leg counts only past the cross-asset lines (gold 2%, real yield 10bp, dollar 1%) and the
// read names the leg that explains the move — gold -3.4% while the real yield fell 27bp and the dollar sat still read
// '실질금리·달러와 크게 어긋나지 않았습니다', the opposite of what 금리와 환율 said about the same 20 sessions.
const GOLD_EXCESS = 2;
export function goldRead(gold, real, dollar) {
  const C = RULES.crossAsset;
  const g = gold.pct; const r = real ? real.bp : null; const d = dollar ? dollar.pct : null;
  // The cross-asset lines are attribution lines (which leg counts), not a size word: the sentence names the line.
  if (Math.abs(g) < C.gold20dPct) return `금은 20거래일 ${signed(g, 1)}로 금리·달러와 견주는 기준(±${C.gold20dPct}%) 안입니다.`;
  const up = g > 0;
  const rateMoved = r != null && Math.abs(r) >= C.rate20dBp;
  const dollarMoved = d != null && Math.abs(d) >= C.dollar20dPct;
  const rateFits = rateMoved && Math.sign(r) !== Math.sign(g);
  const dollarFits = dollarMoved && Math.sign(d) !== Math.sign(g);
  // The direction fitting is not the size fitting: gold more than GOLD_EXCESS times the fitting leg, each counted in its
  // own line (over 4% of gold per 1% of dollar or per 10bp of real yield), is only partly explained by that leg.
  const legSize = Math.max(rateFits ? Math.abs(r) / C.rate20dBp : 0, dollarFits ? Math.abs(d) / C.dollar20dPct : 0);
  const excess = legSize > 0 && Math.abs(g) / C.gold20dPct >= GOLD_EXCESS * legSize
    ? ` 다만 금의 폭(${signed(g, 1)})은 그 움직임만으로 설명되는 크기를 넘어, ${up ? '안전자산·중앙은행 매수 수요' : '많이 오른 자산부터 줄이는 포지션 정리'}가 겹쳤을 가능성이 있습니다(추정).` : '';
  if (rateFits) return `금 ${up ? '상승' : '하락'}은 실질금리 ${bp(r)}와 맞는 평소 관계입니다 — 이자가 없는 금을 들고 있는 비용이 ${up ? '줄었' : '커졌'}습니다${dollarFits ? `. 달러(${signed(d, 1)})도 같은 쪽으로 거들었습니다` : ''}.${excess}`;
  if (dollarFits) return `금 ${up ? '상승' : '하락'}은 달러 ${signed(d, 1)}와 맞는 평소 관계입니다${rateMoved ? ` — 실질금리(${bp(r)})는 오히려 반대 쪽이라 달러 쪽 설명이 큽니다` : ''}.${excess}`;
  if (rateMoved) {
    return up
      ? `실질금리가 ${bp(r)} 올랐는데도 금이 ${signed(g, 1)} 올랐습니다 — 금리로 설명되지 않는 안전자산·중앙은행 매수 쪽 수요입니다.`
      : `실질금리가 ${bp(r)} 내렸는데도 금은 ${signed(g, 1)} 빠졌습니다 — 금리·달러로는 설명되지 않아, 많이 오른 자산부터 줄이는 포지션 정리 쪽으로 읽습니다(추정).`;
  }
  return up ? `실질금리·달러가 기준(${C.rate20dBp}bp, ${C.dollar20dPct}%) 안에서 움직였는데 금이 ${signed(g, 1)} 올라 안전자산이나 중앙은행 매수 쪽입니다.`
    : `실질금리·달러가 기준(${C.rate20dBp}bp, ${C.dollar20dPct}%) 안에서 움직였는데 금이 ${signed(g, 1)} 빠져 포지션 정리 쪽입니다(추정).`;
}

function dollarChapter(history, macroHistory = null) {
  const dxy = historySpan(history, 'dxy');
  if (!dxy) return null;
  const jpy = historySpan(history, 'usdjpy'); const krw = historySpan(history, 'usdkrw');
  // A stronger dollar tightens money outside the US (dollar debt costs more) and weighs on commodities and emerging
  // markets; a sharp yen rebound (USD/JPY down) is the classic sign of carry trades being closed.
  // the 시장 상태 dollar rule (dollarRiseBurden: +2.5%, or +2% in the top 20% of the 1-year range) —
  // a flat +2% here read 부담 where the axis said 중립 at mid-range.
  const D = RULES.dollar;
  const year = buildCloseSeries(history, 'dxy', { through: closeBasis(history) }).slice(-252).map((row) => row.value);
  const position = year.length > 20 && Math.max(...year) > Math.min(...year) ? (dxy.to - Math.min(...year)) / (Math.max(...year) - Math.min(...year)) : null;
  const strong = dollarRiseBurden(dxy.pct, position) === true;
  const read = strong ? '달러가 강해져 미국 밖의 돈줄이 조여지고, 원자재와 신흥국(한국 포함) 주식에 부담입니다'
    // Only what was computed: the 1-year position when it exists, otherwise that the range could not be read.
    : dxy.pct >= D.rise20dPct ? `달러가 ${signed(dxy.pct, 1)} 올랐지만 ${position == null ? '1년 범위를 확인하지 못해 범위 조건은 보지 않았고' : `1년 범위의 ${Math.round(position * 100)}% 위치로 상위 ${Math.round((1 - D.rangeHighAt) * 100)}%가 아니라`} 부담 기준(+${D.rise20dPct + D.bufferPct}%)에는 못 미칩니다`
      : dxy.pct <= D.fall20dPct ? '달러가 약해져 미국 밖 자산과 원자재에 우호적인 쪽입니다' : `달러는 20거래일 ${signed(dxy.pct, 1)}로 부담 기준(+${D.rise20dPct}%) 안쪽입니다`;
  // The 환율 axis's yen-rally line (RULES.fx.yenRally20dPct) decides when the carry check is worth naming; the size word
  // comes from the yen's own volatility.
  const carry = jpy && jpy.pct <= -RULES.fx.yenRally20dPct ? ` 엔화가 ${jpy.grade === 'large' ? '빠르게 ' : ''}강해져(엔/달러 ${signed(jpy.pct, 1)}) 낮은 엔화 금리로 빌린 돈이 되돌아가는지(캐리 청산) 봐야 합니다.` : '';
  const won = krw ? wonMoveSentence(krw.pct, { dxy20: dxy.pct, grade: krw.grade }) : ''; // One reading with the 성장·한국 chapter
  return {
    id: 'dollar', title: '달러 · 환율 — 세계 돈줄의 방향', question: '달러가 세계 유동성을 조이는지 푸는지',
    viz: { caption: '20거래일 등락 (%)', unit: '%', points: [{ x: '달러지수', value: dxy.pct, hot: true }, jpy ? { x: '엔/달러', value: jpy.pct } : null, krw ? { x: '원/달러', value: krw.pct } : null].filter(Boolean) },
    now: `달러지수 ${dxy.to.toFixed(2)} (${signed(dxy.pct, 1)})${jpy ? ` · 엔/달러 ${jpy.to.toFixed(1)}` : ''}${krw ? ` · 원/달러 ${Math.round(krw.to).toLocaleString('en-US')}` : ''}`,
    mean: `${read}.${carry}${won}`,
    next: '매일 · 미국 금리 발표와 일본은행 회의',
    flip: '달러가 오르면서 미국 금리도 오르면 긴축 쪽, 달러가 오르는데 금리가 내리면 위험 회피(안전자산 달러) 쪽입니다.',
    // v59.75 (macro audit 11/7): the rate-differential driver, the same OECD monthly read as the 금리와 환율 FX cards.
    detail: [['달러지수 20거래일 전', dxy.from.toFixed(2)], ['엔/달러 20거래일', jpy ? signed(jpy.pct, 1) : '—'], ['원/달러 20거래일', krw ? signed(krw.pct, 1) : '—'],
      ...[rateDifferential(macroHistory, history, 'usdjpy'), rateDifferential(macroHistory, history, 'usdkrw')].filter(Boolean)
        .map((row) => [`${row.name} 10년 금리차`, `${row.value.toFixed(2)}%p (${Number(row.month.slice(5))}월${row.change == null ? '' : `, 6개월 ${signed(row.change, 2, '%p')}`})`])]
  };
}

// Each chapter's "오늘" line from the market-day ledger (src/domain/market/day/facts.js) — the chapter's own
// gauge that moved most against its usual day, what moved with it (driver links: oil → energy names), and the most
// material report on the same topic. Nothing is said when the ledger is missing or every gauge moved as usual.
const CHAPTER_ASSETS = Object.freeze({ inflation: ['breakeven10'], labor: [], rates: ['tnx', 'dgs2', 'realYield10'], oil: ['wti', 'brent'],
  metals: ['gold', 'silver'], dollar: ['dxy', 'usdjpy', 'usdkrw'], credit: ['hyOas', 'igOas', 'cccOas'], volatility: ['vix'], growth: ['kospi', 'kosdaq'] });
const CHAPTER_TOPICS = Object.freeze({ inflation: ['inflation'], labor: ['jobs'], rates: ['rates'], oil: ['energy'], metals: ['metals'], dollar: ['fx'], credit: ['credit'], volatility: ['volatility'], growth: ['korea'] });
// Word topics of the market-day ledger (src/domain/market/day/facts.js WORD_TOPICS) that name a subject outside the macro fields.
const OFF_FIELD_TOPICS = new Set(['crypto', 'ai-semis', 'deal', 'earnings']);
const koreanTitle = (fact) => [fact?.titleKo, fact?.title].find((title) => /[가-힣]{2}/.test(String(title || ''))) || null;
export function chapterToday(day, chapterId) {
  const facts = Array.isArray(day?.facts) ? day.facts : [];
  if (!facts.length) return null;
  const byId = new Map(facts.map((fact) => [fact.id, fact]));
  const gauges = facts.filter((fact) => fact.kind === 'price' && (CHAPTER_ASSETS[chapterId] || []).includes(fact.asset)).sort((a, b) => Math.abs(b.z ?? 0) - Math.abs(a.z ?? 0));
  const lead = gauges[0] && Math.abs(gauges[0].z ?? 0) >= 1.5 ? gauges[0] : null;
  const unusual = new Set(gauges.filter((fact) => Math.abs(fact.z ?? 0) >= 1.5).map((fact) => fact.id));
  const moved = [...new Map((day.links || []).filter((link) => unusual.has(link.from) && link.basis === 'driver').map((link) => byId.get(link.to))
    .filter((fact) => fact?.kind === 'group-move').map((fact) => [fact.label, fact])).values()]
    // The app's own themes (Korean names) before the sector of the same members.
    .sort((a, b) => Number(b.group.startsWith('theme:')) - Number(a.group.startsWith('theme:'))).filter((fact, index, list) => fact.group.startsWith('theme:') || !list.some((other) => other.group.startsWith('theme:')));
  const topics = CHAPTER_TOPICS[chapterId] || [];
  // The report must be about the chapter by its own words (wordTopics), not only by the feed it came from, and about the
  // field itself: a headline whose words also name a company, a coin, chips or a deal is about that subject reacting to
  // the field ("Crypto market loses $330B as inflation fears mount" is a crypto story). It is shown in Korean or not at all.
  const report = facts.filter((fact) => fact.kind === 'headline' && fact.rank !== 'context' && koreanTitle(fact)
    && !(fact.subjects || []).length && (fact.wordTopics || []).some((topic) => topics.includes(topic))
    && !(fact.wordTopics || []).some((topic) => OFF_FIELD_TOPICS.has(topic)))
    .sort((a, b) => b.materiality - a.materiality)[0] || null;
  if (!lead && !report) return null;
  const size = (fact) => ((fact.changeUnit || fact.unit) === 'bp' ? bp(fact.change) : signed(fact.change, 1));
  const parts = [];
  // The gauge's move is its session's (11/20 Friday), read on Monday night as "오늘"; the line is
  // labelled with that session's date (`label`), and "가장 큰 변화" is that session's.
  if (lead) parts.push(`${lead.label} ${size(lead)}, 평소 하루 변동의 ${Math.abs(lead.z).toFixed(1)}배${lead.rank === 'lead' ? '로 이날 가장 큰 변화 중 하나입니다' : '입니다'}`);
  if (moved.length) parts.push(`같이 움직인 업종은 ${moved.slice(0, 2).map((group) => `${group.label}(${signed(group.change, 1)})`).join(', ')}입니다`);
  return { text: `${parts.join('. ')}${parts.length ? '.' : ''}`, label: shortDate(lead?.date || report?.date) || '최근 거래일', report: report ? { title: koreanTitle(report), date: report.date } : null, rank: lead?.rank || report?.rank || 'minor' };
}

// v59.70 (X bookmarks #4): each spread tier's level inside its own recorded range — the 10/50/90th percentiles of every
// FRED observation kept (ICE BofA: about three years) and where today sits. A quantile band, never a fixed '150bp' line:
// the index definitions differ from the ones such lines are quoted from.
// v59.75 (macro audit 11/7): BB and B join the ladder between 하이일드 and CCC. A tier enters only when its record starts
// with the others' (within a month): BB/B held one year until the producer kept three, and a one-year percentile beside
// three-year ones would read as the same yardstick.
const TIERS = Object.freeze([['igOas', '투자등급'], ['hyOas', '하이일드'], ['bbOas', 'BB'], ['bOas', 'B'], ['cccOas', 'CCC']]);
const SAME_RECORD_DAYS = 31;
function spreadRange(macroHistory, id, label) {
  const rows = series(macroHistory, id);
  if (rows.length < 120) return null;
  const sorted = rows.map((row) => row.value).sort((a, b) => a - b);
  const at = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * (sorted.length - 1)))];
  const now = rows.at(-1).value;
  // Mid-rank, so a flat stretch (ties at today's level) reads 50%, not the top of the record.
  const pct = Math.round((sorted.filter((value) => value < now).length + sorted.filter((value) => value === now).length / 2) / sorted.length * 100);
  return { id, label, now, p10: at(0.1), p50: at(0.5), p90: at(0.9), min: sorted[0], max: sorted.at(-1), pct, from: rows[0].date, to: rows.at(-1).date, n: rows.length };
}
export function creditRanges(macroHistory) {
  const all = TIERS.map(([id, label]) => spreadRange(macroHistory, id, label)).filter(Boolean);
  const first = all.map((range) => range.from).sort()[0];
  const ranges = all.filter((range) => (Date.parse(range.from) - Date.parse(first)) / 86400000 <= SAME_RECORD_DAYS);
  if (!ranges.length) return null;
  const out = ranges.filter((range) => range.pct >= 90 || range.pct <= 10);
  const lead = (out.length ? out : ranges).sort((a, b) => Math.abs(b.pct - 50) - Math.abs(a.pct - 50))[0];
  const rest = ranges.filter((range) => range !== lead).map((range) => range.label).join('·');
  const place = (range) => range.pct >= 90 ? '기록 상위 10% 안' : range.pct <= 10 ? '기록 하위 10% 안' : '범위 안';
  const others = ranges.filter((range) => range !== lead);
  const restText = others.every((range) => place(range) === '범위 안') ? `${withTopicParticle(rest)} 범위 안` : others.map((range) => `${range.label} ${place(range)}`).join(', ');
  const since = `${lead.from.slice(0, 4)}년 ${Number(lead.from.slice(5, 7))}월 이후`;
  return { ranges, since, line: `${lead.label} ${lead.now.toFixed(2)}%, ${since} 기록의 ${lead.pct}% 위치${others.length ? ` — ${restText}` : ''}.` };
}

const CREDIT_YIELDS = Object.freeze([['hyYield', '하이일드'], ['cccYield', 'CCC'], ['igYield', '투자등급']]);
/** [{ label, value }] for each effective yield with a 20-session reading; [] while the series are not published. */
export function creditYields(macroHistory) {
  return CREDIT_YIELDS.map(([id, label]) => {
    const read = oasDelta20Bp(macroHistory, id);
    return read ? { label, value: `${read.level.toFixed(2)}% (20거래일 ${bp(read.value)})` } : null;
  }).filter(Boolean);
}

// v59.70 (X bookmarks #3, owner 11/4): the chapter reads the credit axis's own rule (RULES.credit through creditState) and
// its one 20-session reading (oasDelta20Bp) — '+40bp or 4.5%' and a '3.5% 돌파' flip here said 위기 where 시장 상태 said 중립.
function credit(macroHistory) {
  const hy20 = oasDelta20Bp(macroHistory, 'hyOas');
  if (!hy20) return null;
  const ccc20 = oasDelta20Bp(macroHistory, 'cccOas'); const ig20 = oasDelta20Bp(macroHistory, 'igOas');
  const bb20 = oasDelta20Bp(macroHistory, 'bbOas'); const b20 = oasDelta20Bp(macroHistory, 'bOas');
  const hy = { from: hy20.level - hy20.value / 100, to: hy20.level, bp: hy20.value };
  const ccc = ccc20 ? { to: ccc20.level, bp: ccc20.value } : null; const ig = ig20 ? { to: ig20.level, bp: ig20.value } : null;
  const fci = series(macroHistory, 'financialConditions').at(-1);
  const C = RULES.credit;
  // The judgement, its sentence and its flip are market-read's (creditJudgement/creditReading/creditFlip).
  const judgement = creditJudgement(macroHistory);
  const state = judgement?.state || 'unknown';
  // CCC widening faster than usual for CCC (cccTailLine, the HY record's rule), never under the axis's 2 × widen20dBp.
  const tail = !!(ccc && ccc.bp >= cccTailLine(macroHistory, WINDOW, C.stress20dMultiple * C.widen20dBp));
  const mean = creditReading(judgement, { cccTail: tail, ccc20: ccc?.bp ?? null, ig20: ig?.bp ?? null });
  const flip = creditFlip(judgement);
  const reach = creditContagion(macroHistory);
  // The financial-conditions index (moved here from the liquidity cards): its level and its 4-week change (the span the credit-stress condition reads).
  const fciRows = series(macroHistory, 'financialConditions');
  const fci4 = changeOverDays(fciRows, MACRO_SIGNAL_RULES.nfciWindowDays);
  return {
    id: 'credit', title: `${AXIS_LABELS.credit} — 위기 신호 점검`, question: '주가 조정이 신용 위기로 번질 위험', state,
    verdicts: reach ? [{ id: 'credit-reach', name: '등급별 번짐', label: reach.label, tone: reach.state === 'quiet' ? 'good' : reach.state === 'selective' ? 'neutral' : 'warn' }] : [],
    viz: { caption: '스프레드 20거래일 변화 (bp)', unit: 'bp', points: [ig ? { x: '투자등급', value: ig.bp } : null, { x: '하이일드', value: hy.bp }, bb20 ? { x: 'BB', value: bb20.value } : null, b20 ? { x: 'B', value: b20.value } : null, ccc ? { x: 'CCC', value: ccc.bp, hot: true } : null].filter(Boolean) },
    now: `하이일드 ${hy.from.toFixed(2)} → ${hy.to.toFixed(2)}% (${bp(hy.bp)})${ccc ? ` · CCC ${bp(ccc.bp)}` : ''}`,
    mean: `${mean}${fci ? ` 금융여건 지수는 ${fci.value.toFixed(2)}${'013678'.includes(fci.value.toFixed(2).slice(-1)) ? '으로' : '로'} ${fci.value < 0 ? '아직 완화 쪽' : '긴축 쪽'}입니다.` : ''}`,
    next: '매일',
    flip,
    ranges: creditRanges(macroHistory),
    // The automated 금리(수익률) rows (ICE BofA effective yields from the macro-history producer), printed above the
    // researched single-name rows: what a borrower pays, where the spreads above say only the premium. Empty until published.
    yields: creditYields(macroHistory),
    detail: [['하이일드', `${hy.to.toFixed(2)}%`], ...(bb20 ? [['BB', `${bb20.level.toFixed(2)}%`]] : []), ...(b20 ? [['B', `${b20.level.toFixed(2)}%`]] : []), ['CCC', ccc ? `${ccc.to.toFixed(2)}%` : '—'], ['투자등급', ig ? `${ig.to.toFixed(2)}%` : '—'],
      ...(reach ? [[`등급별 20거래일 (${shortDay(reach.from)}→${shortDay(reach.date)})`, `투자등급 ${bp(reach.bp.ig)} · BB ${bp(reach.bp.bb)} · B ${bp(reach.bp.b)} · CCC ${bp(reach.bp.ccc)}`]] : []),
      ['금융여건 지수', fci ? `${fci.value.toFixed(2)} (${shortDay(fci.date)}${fci4 ? `, 4주 ${signed(fci4.last.value - fci4.then.value, 2, '')}` : ''})` : '—']]
  };
}

// 자금 배관 (funding-plumbing.js): the SOFR − IORB gauge decides 안정·긴장·스트레스; the reverse repo, the Treasury account
// and reserves are the tanks behind it, each with its own date.
const BN = (value) => (Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(2)}조 달러`
  : `${(value * 10).toLocaleString('en-US', { maximumFractionDigits: Math.abs(value) < 10 ? 1 : 0 })}억 달러`);
const signedBn = (value) => `${value > 0 ? '+' : value < 0 ? '-' : ''}${BN(Math.abs(value))}`;
function plumbing(macroHistory) {
  const read = plumbingRead(macroHistory);
  if (!read) return null;
  const R = PLUMBING_RULES;
  const { spread, rrp, tga, tgaWeek, reserves, source, sofr } = read;
  // The target range on SOFR's own date (both bounds of one date), beside the IORB gauge.
  const upper = sofr ? series(macroHistory, 'fedTargetUpper').filter((row) => row.date <= sofr.date).at(-1) : null;
  const lower = sofr ? series(macroHistory, 'fedTargetLower').filter((row) => row.date <= sofr.date).at(-1) : null;
  const range = fedTargetRange(lower?.value, upper?.value, lower?.date, upper?.date);
  const where = !range || !sofr ? null : sofr.value > range.upper ? `상단 위 ${((sofr.value - range.upper) * 100).toFixed(0)}bp` : sofr.value < range.lower ? `하단 아래 ${((range.lower - sofr.value) * 100).toFixed(0)}bp` : `범위 안, 상단 −${((range.upper - sofr.value) * 100).toFixed(0)}bp`;
  const net = netLiquiditySeries(macroHistory);
  const netEnd = net.at(-1);
  const netStart = netEnd ? net.filter((row) => row.date <= new Date(Date.parse(netEnd.date) - R.sourceDays * 86400000).toISOString().slice(0, 10)).at(-1) : null;
  const tone = { calm: 'good', tension: 'warn', stress: 'warn', unknown: 'neutral' }[read.state];
  return {
    id: 'plumbing', title: '자금 배관 — 단기자금 압력', question: '단기자금 시장이 막히는지',
    verdicts: [{ id: 'plumbing', name: 'SOFR − IORB', label: read.label, tone },
      read.riskWeek ? { id: 'risk-week', name: `${shortDay(tgaWeek.date)} 주`, label: '역레포 고갈 중 TGA 급증', tone: 'warn' } : null,
      source?.label ? { id: 'tga-source', name: `TGA 4주 ${signedBn(source.tgaBn)}`, label: source.label, tone: source.kind === 'absorb' ? 'warn' : 'neutral' } : null].filter(Boolean),
    // The gauge itself when IORB is published (0bp is the line); the four-week Treasury-account split otherwise.
    viz: read.recent.length
      ? { caption: 'SOFR − IORB (bp)', unit: 'bp', points: read.recent.map((row) => ({ x: shortDay(row.date), value: row.bp, hot: row.bp > R.tensionAboveBp })) }
      : { caption: source ? `${shortDay(source.from)}→${shortDay(source.to)} 4주 변화 (억 달러)` : '4주 변화 (억 달러)', unit: '',
        points: source ? [{ x: 'TGA', value: source.tgaBn * 10, hot: true }, source.rrpBn != null ? { x: '역레포', value: source.rrpBn * 10 } : null, source.reservesBn != null ? { x: '준비금', value: source.reservesBn * 10 } : null].filter(Boolean) : [] },
    now: [spread ? `SOFR − IORB ${signedText(spread.bp, 0, 'bp')} (${shortDay(spread.date)})` : sofr ? `SOFR ${sofr.value.toFixed(2)}% (${shortDay(sofr.date)})` : null,
      rrp ? `역레포 ${BN(rrp.value)} (${shortDay(rrp.date)})` : null, tgaWeek ? `TGA 1주 ${signedBn(tgaWeek.changeBn)} (${shortDay(tgaWeek.date)})` : null,
      reserves ? `준비금 ${BN(reserves.value)} (${shortDay(reserves.date)})` : null].filter(Boolean).join(' · '),
    next: '매일 SOFR · 매주 목요일 연준 대차대조표(TGA·준비금)',
    flip: `SOFR − IORB가 ${R.tensionAboveBp}bp를 넘는 날이 ${R.heldObservations}관측 이어지면 긴장, ${R.stressAtBp}bp 이상이 ${R.heldObservations}관측 이어지면 스트레스입니다. 역레포가 ${BN(R.rrpDepletedBn)} 아래인 주에 TGA가 ${BN(R.tgaWeekSurgeBn)} 넘게 늘면 위험이 겹친 주입니다. TGA가 4주 ${BN(NET_LIQUIDITY_FLAT_BN)} 넘게 늘 때 준비금이 역레포보다 더 줄면 흡수, 역레포가 더 줄면 자리바꿈입니다.`,
    detail: [['SOFR', sofr ? `${sofr.value.toFixed(2)}% (${shortDay(sofr.date)})` : '—'], ['IORB', spread ? `${spread.iorb.toFixed(2)}% (${shortDay(spread.date)})` : '자료 없음'],
      ['SOFR − IORB 0bp 초과 연속', spread ? `${read.heldAbove}관측` : '—'],
      ...(where && range ? [[`목표 범위 ${range.lower.toFixed(2)}–${range.upper.toFixed(2)}% 대비 SOFR`, where]] : []),
      ['역레포', rrp ? `${BN(rrp.value)} (${shortDay(rrp.date)})` : '—'], ['TGA', tga ? `${BN(tga.value)} (${shortDay(tga.date)}${tgaWeek ? `, 1주 ${signedBn(tgaWeek.changeBn)}` : ''})` : '—'],
      ['준비금', reserves ? `${BN(reserves.value)} (${shortDay(reserves.date)})` : '자료 없음'],
      ...(source ? [[`TGA 4주 변화 나누기 (${shortDay(source.from)}→${shortDay(source.to)})`, `TGA ${signedBn(source.tgaBn)} · 역레포 ${source.rrpBn == null ? '—' : signedBn(source.rrpBn)} · 준비금 ${source.reservesBn == null ? '자료 없음' : signedBn(source.reservesBn)}${source.otherBn == null ? '' : ` · 그 밖 ${signedBn(source.otherBn)}`}`]] : []),
      ...(netEnd && netStart ? [[`순유동성 (${shortDay(netStart.date)}→${shortDay(netEnd.date)})`, `${BN(netEnd.value)}, 4주 ${signedBn(netEnd.value - netStart.value)}`]] : [])]
  };
}

function growthKorea(macroHistory, history, events) {
  const kospi = historySpan(history, 'kospi');
  // US semiconductors are SOXX, as on 무슨 일이 있었나.
  const semis = historySpan(history, 'soxx');
  const krw = historySpan(history, 'usdkrw');
  const sentiment = series(macroHistory, 'consumerSentiment').at(-1);
  const retail = lastMoM(series(macroHistory, 'retailSales'));
  // v59.75 (macro audit 11/7): output beside spending — industrial production (Fed G.17), month over month.
  const output = lastMoM(series(macroHistory, 'industrialProduction'));
  // retail sales are nominal. With headline CPI +0.65% in the same month a +0.8% print is about +0.1%
  // in real terms — the release band's '과열' and this chapter's '꺾이지 않았습니다' were reading two different things.
  const cpiSameMoM = retail ? monthChangeAt(series(macroHistory, 'cpiIndex'), retail.date) : null;
  const cpiSame = cpiSameMoM == null ? null : { date: retail.date, value: cpiSameMoM };
  const realRetail = cpiSame ? retail.value - cpiSame.value : null;
  if (!kospi && !sentiment) return null;
  const korea = kospi && semis && Math.abs(kospi.pct - semis.pct) < 4 && Math.abs(semis.pct) >= 5 ? `코스피(${signed(kospi.pct, 1)})가 미국 반도체(SOXX ${signed(semis.pct, 1)})와 같은 폭으로 움직여, 한국은 AI 반도체 업황에 묶여 있습니다`
    : kospi ? `코스피는 20거래일 ${signed(kospi.pct, 1)}입니다` : '';
  const won = krw ? wonMoveSentence(krw.pct, { dxy20: historySpan(history, 'dxy')?.pct ?? null, grade: krw.grade }) : '';
  const next = nextOf(events, ['us-retail']);
  const spending = !retail ? ''
    // the wording follows the real change itself: near flat reads 버티는 정도, below it 줄었습니다, clearly above it 늘었다.
    : realRetail != null && retail.value >= 0 && realRetail < retail.value - 0.3 ? `소매판매는 명목 ${signed(retail.value, 1)}지만 같은 달 소비자물가(${signed(cpiSame.value, 2)})를 빼면 실질 약 ${signed(realRetail, 1)}로, ${realRetail >= REAL_RETAIL_FLAT_PCT ? '실질로도 늘었지만 증가분의 상당 부분은 물가 몫입니다' : realRetail > -REAL_RETAIL_FLAT_PCT ? '소비는 늘었다기보다 버티는 정도입니다' : '소비는 물가에 밀려 실질로 줄었습니다'}. `
      : retail.value >= 0 ? '소비 지출은 아직 꺾이지 않았습니다. ' : '소비 지출이 줄었습니다. ';
  return {
    id: 'growth', title: `${AXIS_LABELS.growth} · 소비 · 한국`, question: '경기의 지속력과 한국 시장이 묶인 고리',
    viz: { caption: '20거래일 등락 (%)', unit: '%', points: [kospi ? { x: '코스피', value: kospi.pct, hot: true } : null, semis ? { x: 'SOXX', value: semis.pct } : null, krw ? { x: '원/달러', value: krw.pct } : null].filter(Boolean) },
    // each monthly value carries its month — '소비심리 48.1' (September) sat undated beside today's KOSPI.
    now: [sentiment ? `소비심리 ${sentiment.value.toFixed(1)}(${monthName(sentiment.date)})` : null, retail ? `소매판매 ${signed(retail.value, 1)}(${monthName(retail.date)})` : null, output ? `산업생산 ${signed(output.value, 1)}(${monthName(output.date)})` : null, kospi ? `코스피 ${signed(kospi.pct, 1)}` : null].filter(Boolean).join(' · '),
    mean: `${sentiment && sentiment.value < 60 ? (spending.startsWith('소매판매는 명목') ? '소비심리는 낮고, ' : '소비심리는 낮지만 ') : ''}${spending}${korea}.${won}`,
    // v59.75 (macro audit 11/7): the flip named ISM, which is not collected (licensed, not on FRED); it now reads the two
    // official monthly series the chapter shows. The '외국인 매매 · 아직 제공하지 않음' row (no source) left.
    next: whenOf(next) || '소매판매 · 산업생산 (매월 중순)',
    flip: '소매판매와 산업생산이 두 달 연속 함께 줄면 경기 둔화로 읽습니다.',
    detail: [['소비심리(미시간)', sentiment ? sentiment.value.toFixed(1) : '—'], ['소매판매 전월비 (명목)', retail ? `${signed(retail.value, 1)}${realRetail != null ? `, 실질 약 ${signed(realRetail, 1)}` : ''}` : '—'], ...(output ? [['산업생산 전월비', `${signed(output.value, 1)} (${monthName(output.date)})`]] : []), ['원/달러 20거래일', krw ? signed(krw.pct, 1) : '—']]
  };
}

/** The chapters; a chapter whose series are missing is left out. `day` is market-day.json, when loaded. */
export function buildMacroChapters({ macroHistory = null, history = [], events = [], day = null } = {}) {
  const chapters = [inflation(macroHistory, events), labor(macroHistory, events), rates(macroHistory, events, history), credit(macroHistory), plumbing(macroHistory), oil(history, macroHistory),
    metals(history, macroHistory), dollarChapter(history, macroHistory), volatilityChapter(history, events), growthKorea(macroHistory, history, events)].filter(Boolean)
    .map((chapter) => ({ ...chapter, today: chapterToday(oneSessionDay(day, history), chapter.id) }));
  return { available: chapters.length > 0, chapters };
}
