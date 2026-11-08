// v59.55 (owner 11/1, "PCE 분석 및 설명은 아예 없고, 유가 분석 없고, 최근 금/은 급락에 대해서도 설명은 없고, 고용/노동 분석
// 없고, 향후 … CPI 발표 체크해야된다라는 내용도 없고"): 매크로's six chapters. Each answers one question with one small
// picture, the latest numbers, what they mean for stocks, the next dated release and the condition that would change the
// read. Every number comes from macro-history.json (FRED) or history.json; every sentence is chosen by a rule here.
import { oneSessionDay } from '../market-day/one-session.js';
import { readNumber, signedText } from '../shared/number.js';
import { dayLabel } from '../market/market-story.js';
import { buildCloseSeries, closeBasis } from '../market/close-series.js';
import { MARKET_WINDOWS, closeChange } from '../market/market-windows.js';
import { rateDifferential, sessionPointBack, wonMoveSentence } from './rates-fx.js';
import { RULES } from '../rules/thresholds.js';
import { withTopicParticle } from '../content/korean-particle.js';
import { oasDelta20Bp } from '../briefing/market-read.js';
import { creditJudgement, creditReading, creditFlip } from '../briefing/credit-reading.js';
import { dollarRiseBurden } from '../briefing/market-read.js';
import { claimsTrend, coreInflationRead, monthChangeAt, monthIndex, monthOverMonth, sahmGap, yoySeries } from './macro-read.js';
import { BRENT_WTI_SPREAD_HOLD_USD, MACRO_SIGNAL_RULES, oilDivergence, policyCycle } from './macro-signals.js';
import { formatKstWhen, releaseAtMs } from '../briefing/schedule.js';
import { volatilityChapter } from './volatility.js';

// v59.56: the shared signedText, so a 20-session +0.04% prints 0.0%, never '+0.0%'.
const signed = (value, digits = 2, unit = '%') => signedText(value, digits, unit);
const bp = (value) => `${value > 0 ? '+' : ''}${Math.round(value)}bp`;

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
// v59.56 (screen review): every chapter change is the shared 20-session window ('20거래일'), counted in exchange sessions.
// Rows (history.json carries weekend copies) and 21 calendar days gave WTI +12.7% / 달러 -0.3% here beside the six-factor
// table's 20거래일 +14.3% / 0.0% on the same screen.
const WINDOW = MARKET_WINDOWS.rule;
const shortDay = (date) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
function historySpan(history, field) {
  const change = closeChange(history, field, WINDOW);
  return change ? { from: change.from.value, to: change.to.value, pct: change.pct } : null;
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
  const service = shelter && supercore && shelter.value >= 0.3 && supercore.value >= 0.3 ? ' 주거비와 주거 뺀 서비스가 함께 올라 서비스 물가가 다시 붙었습니다.' : '';
  const next = nextOf(events, ['us-cpi', 'us-pce']);
  return {
    id: 'inflation', title: '물가 — PCE · CPI', question: hiking ? '연준의 추가 인상과 동결 사이' : '연준의 금리 인하 여지',
    viz: { caption: '근원 PCE 전월비 (%)', unit: '%', points: mom.map((row, index) => ({ x: monthName(row.date), value: row.value, hot: index === mom.length - 1 })) },
    now: `${monthName(last.date)} 근원 PCE ${signed(last.value)} · 3개월 연율 ${three.toFixed(1)}% · 전년비 ${yoy.toFixed(1)}%`,
    mean: `${turn}. ${hot}.${service}`,
    next: whenOf(next) || '발표 일정을 확인하지 못했습니다',
    flip: `근원 PCE·CPI의 3개월 연율이 함께 1년치보다 ${I.reaccelPp}%p 이상 빨라지면 재가속, 함께 그만큼 느려지면 둔화로 정해집니다 — 월 +0.2% 이하가 이어지면 3개월 연율은 약 2.4% 아래로 내려옵니다.`,
    detail: [['근원 CPI 전월비', cpiMom ? `${signed(cpiMom.value)} (${monthName(cpiMom.date)})` : '—'], ['주거비 CPI', shelter ? signed(shelter.value) : '—'], ['주거 뺀 서비스(슈퍼코어)', supercore ? signed(supercore.value) : '—'], ['근원 CPI 3개월 연율', core.coreCpiPace ? `${core.coreCpiPace.value.toFixed(1)}% (1년치 ${core.coreCpiYoy ? core.coreCpiYoy.value.toFixed(1) : '—'}%)` : '—'], ['물가 방향 (PCE·CPI)', d.label || '—']]
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
  // the growth axis's own Sahm reading (3-month average against the low of the prior 12 months'
  // 3-month averages) and its claims trend (4-week average against its 1-year low). The chapter compared one month with a
  // 13-row minimum and one week of claims with a fixed 250k — a 4.6% print would have read '경기 침체 경보' beside
  // 'Sahm 0.17%p · 양호' on the same screen.
  const G = RULES.growth;
  const sahm = sahmGap(unemployment);
  const claims = claimsTrend(series(macroHistory, 'initialClaims'));
  const natural = series(macroHistory, 'naturalUnemployment').at(-1);
  const wageYoy = yoySeries(series(macroHistory, 'hourlyEarnings')).at(-1)?.value ?? null;
  const recession = sahm && sahm.value >= G.sahmRecessionAt;
  const layoffs = claims && claims.aboveLow >= G.claimsRiseAbovePct;
  const watch = (sahm && sahm.value >= G.sahmWatchAt) || (claims && claims.aboveLow >= G.claimsWatchAbovePct);
  const shape = recession ? `실업률 3개월 평균이 1년 저점보다 ${sahm.value.toFixed(2)}%p 높아 Sahm 경기침체 신호(${G.sahmRecessionAt}%p)를 넘었습니다`
    : layoffs ? `실업수당 청구(4주 평균)가 1년 저점보다 ${Math.round(claims.aboveLow)}% 늘어 해고가 늘고 있습니다. 둔화가 침체 쪽으로 옮겨 가는지 봐야 합니다`
      : watch ? `실업률이나 실업수당 청구가 1년 저점에서 올라오기 시작해 주의 구간입니다(Sahm ${sahm ? sahm.value.toFixed(2) : '—'}%p, 침체 신호 ${G.sahmRecessionAt}%p 전)`
        : avg3 < G.payrollSolidK ? '채용은 크게 줄었지만 해고는 늘지 않았습니다. "덜 뽑는 둔화"이지 "자르는 침체"는 아직 아닙니다' : '고용이 꾸준히 늘어 경기 걱정은 크지 않습니다';
  // below the natural-rate estimate the market is still tight — the reason strong jobs keep rates high, not only growth.
  const tight = natural && rate.value < natural.value && !recession && !layoffs ? ` 실업률(${rate.value.toFixed(1)}%)이 자연실업률 추정(${natural.value.toFixed(1)}%)보다 낮아 노동시장은 아직 빠듯한 쪽입니다.` : '';
  const next = nextOf(events, ['us-nfp']);
  const sahmLine = sahm ? (sahm.low + G.sahmRecessionAt).toFixed(2) : null;
  const claimsLine = claims ? claims.low * (1 + G.claimsRiseAbovePct / 100) : null;
  return {
    id: 'labor', title: '고용 — 냉각과 꺾임의 구분', question: '경기 침체 위험',
    viz: { caption: '비농업 고용 증감 (천 명)', unit: '', points: changes.map((row, index) => ({ x: monthName(row.date), value: row.value, hot: index === changes.length - 1 })) },
    now: `${monthName(changes.at(-1).date)} ${changes.at(-1).value >= 0 ? '+' : ''}${(changes.at(-1).value / 10).toFixed(1)}만 · 3개월 평균 ${avg3 >= 0 ? '+' : ''}${(avg3 / 10).toFixed(1)}만 · 실업률 ${rate.value.toFixed(1)}%${claims ? ` · 실업수당 청구 4주 평균 ${(claims.avg4 / 10000).toFixed(1)}만` : ''}`,
    mean: `${shape}.${tight}${wageYoy !== null ? ` 임금은 1년 전보다 ${wageYoy.toFixed(1)}% 올라 ${wageYoy >= 4 ? '물가를 다시 밀어 올릴 수 있는 속도입니다' : '물가를 밀어 올릴 정도는 아닙니다'}.` : ''}`,
    next: whenOf(next) || '발표 일정을 확인하지 못했습니다',
    flip: `${sahmLine ? `실업률 3개월 평균이 ${sahmLine}% 이상(Sahm ${G.sahmRecessionAt}%p)` : `Sahm 지표 ${G.sahmRecessionAt}%p 이상`}이 되거나 실업수당 청구 4주 평균이 1년 저점보다 ${G.claimsRiseAbovePct}% 이상${claimsLine ? `(${(claimsLine / 10000).toFixed(1)}만 건)` : ''} 늘면 침체 쪽으로 읽습니다.`,
    detail: [['Sahm 지표', sahm ? `${sahm.value.toFixed(2)}%p (3개월 평균 ${sahm.avg3.toFixed(2)}%, 1년 저점 ${sahm.low.toFixed(2)}%)` : '—'], ['실업수당 청구 4주 평균', claims ? `${(claims.avg4 / 10000).toFixed(1)}만 (1년 저점 대비 ${signed(claims.aboveLow, 0)})` : '—'], ['자연실업률 추정', natural ? `${natural.value.toFixed(2)}%` : '—'], ['임금 상승률(전년비)', wageYoy !== null ? `${wageYoy.toFixed(1)}%` : '—'], ['3개월 평균 고용', `${(avg3 / 10).toFixed(1)}만`]]
  };
}

// 10년 = 실질 + 기대인플레 holds only on one date: the legs are cut at the latest date all three have (FRED posts the
// real yield a day after the others). v59.74: the oil and metals chapters read the same cut, so one screen does not print a
// 20-session breakeven of -11bp (rates) beside -10bp (oil).
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
  const share = ten.bp ? real.bp / ten.bp : 0;
  const kind = Math.abs(ten.bp) < 10 ? 'flat' : share >= 0.6 ? (ten.bp < 0 ? 'growth' : 'tight') : be.bp / ten.bp >= 0.6 ? (ten.bp < 0 ? 'relief' : 'fear') : 'mixed';
  // a real-yield-led fall is a growth scare only when stocks fell with it (the 금리 axis's
  // growthScareSpx20dPct); with stocks up it is the opposite — a retreat of tightening expectations.
  const spx = closeChange(history, 'spx', WINDOW, { through: closeBasis(history) });
  const growthRead = spx && spx.pct <= RULES.rates.growthScareSpx20dPct
    ? `하락이 거의 실질금리에서 나왔고 같은 기간 S&P 500이 ${signed(spx.pct, 1)} 빠졌습니다. 물가 기대가 내려서가 아니라 성장 걱정으로 주식에서 채권으로 옮긴 움직임입니다.`
    : spx && spx.pct >= RULES.crossAsset.stock20dPct
      ? `하락이 거의 실질금리에서 나왔고 S&P 500은 ${signed(spx.pct, 1)} 올랐습니다. 긴축 기대가 물러나 할인율 부담이 줄어든 쪽입니다.`
      : '하락이 거의 실질금리에서 나왔습니다. 주가가 크게 움직이지 않아 성장 걱정인지 긴축 기대 후퇴인지는 아직 가르지 않습니다.';
  const read = { flat: '20거래일 동안 큰 변화가 없습니다.', growth: growthRead,
    tight: '상승이 실질금리에서 나왔습니다. 긴축 부담이 커져 성장주 할인율이 올라갑니다.', relief: '하락이 기대인플레에서 나와 물가 안도 쪽입니다.',
    fear: '상승이 기대인플레에서 나와 물가 걱정 쪽입니다.', mixed: '실질금리와 기대인플레가 함께 움직여 한쪽으로 읽기 어렵습니다.' }[kind];
  const next = nextOf(events, ['us-fed-rate']);
  // the term premium (Kim-Wright, about a week behind) keeps its own span on the bar label and in the numbers.
  const termLabel = term ? `기간 프리미엄(${shortDay(term.date)}까지)` : null;
  const points = [['10년', market ? market.bp : ten.bp], ['실질', real.bp], ['기대인플레', be.bp], term ? [termLabel, term.bp] : null, two ? ['2년', two.bp] : null].filter(Boolean);
  return {
    id: 'rates', title: '연준 · 금리 — 움직인 이유', question: '금리 변화의 원인, 물가와 성장 걱정',
    viz: { caption: '20거래일 변화 (bp)', unit: 'bp', points: points.map(([x, value], index) => ({ x, value, hot: index === 1 })) },
    // v59.70 (screen review 6): the 10-year itself is the market close reading every screen shares (closeChange on history tnx); the
    // FRED legs, cut on their own common date, split the move and keep their own span beside them.
    now: market ? `10년 ${market.from.toFixed(2)} → ${market.to.toFixed(2)}% (${shortDay(market.fromDate)}→${shortDay(market.date)}, ${bp(market.bp)}) · 실질 ${bp(real.bp)} · 기대인플레 ${bp(be.bp)} (${shortDay(ten.fromDate)}→${shortDay(ten.date)})`
      : `10년 ${ten.from.toFixed(2)} → ${ten.to.toFixed(2)}% (${shortDay(ten.fromDate)}→${shortDay(ten.date)}, ${bp(ten.bp)}) = 실질 ${bp(real.bp)} + 기대인플레 ${bp(be.bp)}`,
    mean: read,
    next: whenOf(next) || '발표 일정을 확인하지 못했습니다',
    flip: '기대인플레가 같이 움직이기 시작하면 해석이 물가 쪽으로 바뀝니다.',
    // each FRED leg names its own date — '2년 4.46%' (FRED, 11/5) sat undated beside the policy
    // card's 4.51% (Treasury, 11/6).
    detail: [['10년 실질금리', `${real.to.toFixed(2)}% (${shortDay(real.date)})`], ['10년 기대인플레', `${be.to.toFixed(2)}% (${shortDay(be.date)})`], ['기간 프리미엄', term ? `${term.to.toFixed(2)}% (${shortDay(term.date)}, 20거래일 ${bp(term.bp)})` : '—'], ['2년 (FRED)', two ? `${two.to.toFixed(2)}% (${shortDay(two.date)})` : '—']]
  };
}

// v59.64 (owner 2026-11-03: "금&은/유가/금리/신용 스프레드 등등 … 각각 분석해서 시장 상황들이랑 연결"): oil, metals and the
// dollar are chapters of their own (oil and gold shared one card, and silver had no reading at all).
function oil(history, macroHistory) {
  const wti = historySpan(history, 'wti');
  if (!wti) return null;
  const brent = historySpan(history, 'brent');
  const be = macroChange(macroHistory, 'breakeven10', splitThrough(macroHistory));
  const C = RULES.crossAsset; const O = RULES.oil;
  // one set of lines for one move — the 시장 상태 axis's (+10% / -5%) for a move that changes the
  // read, the cross-asset 5% for 'moved at all' — and the shared Brent/WTI rule decides which benchmark speaks. The chapter
  // used ±10% for the headline and 5% for 'moved', so WTI -7.3% read '움직이지 않았습니다' and '유가를 물가에 반영' together,
  // and Brent -6.1% beside WTI -1.1% was ignored.
  const div = brent ? oilDivergence({ basis: 'futures', brent20: brent.pct, wti20: wti.pct, abnormal: Math.abs(brent.to - wti.to) > BRENT_WTI_SPREAD_HOLD_USD,
    diverges: brent.pct >= O.rise20dPct && wti.pct < brent.pct * MACRO_SIGNAL_RULES.oilConfirmShare }) : { held: false, kind: null, text: null };
  const lead = !div.held ? { name: 'WTI', pct: wti.pct } : ['brent-led', 'brent-rise'].includes(div.kind) ? { name: '브렌트', pct: brent.pct } : null;
  const read = !lead ? `두 유가가 엇갈려 한쪽으로 읽지 않습니다 — ${String(div.text || '').replace(/^20거래일 /, '').replace(/\.$/, '')}`
    : lead.pct >= O.rise20dPct ? `유가(${lead.name} ${signed(lead.pct, 1)})가 크게 올라 다음 달 헤드라인 물가를 밀어 올리고 소비 여력은 줄입니다`
      : lead.pct <= O.fall20dPct ? `유가(${lead.name} ${signed(lead.pct, 1)})가 내려 물가 부담은 줄지만, 공급이 아니라 수요가 줄어서라면 경기 둔화 신호입니다`
        : lead.pct >= C.oil20dPct ? `유가(${lead.name} ${signed(lead.pct, 1)})가 올랐지만 물가 경로를 바꿀 폭(+${O.rise20dPct}%)에는 못 미칩니다`
          : '유가는 물가 경로를 바꿀 만큼 움직이지 않았습니다';
  const oilMoved = !!lead && Math.abs(lead.pct) >= C.oil20dPct;
  // A 20-session breakeven move is judged on the 20-session cross-asset rate line (10bp), not the chain's 5-session 5bp.
  const beMoved = be && Math.abs(be.bp) >= C.rate20dBp;
  const sameWay = be && lead && Math.sign(be.bp) === Math.sign(lead.pct);
  const inflation = !be || !lead ? ''
    : !oilMoved ? (beMoved ? ` 기대인플레는 ${bp(be.bp)} 움직였지만 유가 때문은 아닙니다 — 물가 발표나 성장 걱정 쪽에서 원인을 찾습니다.` : '')
      : !beMoved ? ' 기대인플레는 크게 움직이지 않아 채권시장은 유가를 일시적으로 봅니다.'
        : sameWay ? ` 기대인플레도 ${bp(be.bp)} 같은 쪽으로 움직여 채권시장이 유가를 물가에 반영하고 있습니다.`
          : ` 기대인플레는 반대로 ${bp(be.bp)} 움직여, 채권시장은 유가보다 다른 요인(성장 걱정 등)을 더 크게 봅니다.`;
  // Brent carries the seaborne/Middle East premium WTI does not; the two drifting apart says which supply story moved.
  const gap = brent ? brent.pct - wti.pct : null;
  const spread = !lead || gap == null || Math.abs(gap) < C.oil20dPct ? ''
    : gap < 0 ? ` 브렌트(${signed(brent.pct, 1)})가 WTI(${signed(wti.pct, 1)})보다 크게 내려, 중동·해상 운송 같은 해외 공급 위험의 값이 빠졌습니다.`
      : ` 브렌트(${signed(brent.pct, 1)})가 WTI(${signed(wti.pct, 1)})보다 크게 올라, 중동·해상 운송 같은 해외 공급 위험의 값이 붙었습니다.`;
  return {
    id: 'oil', title: '유가 — 물가와 경기 사이', question: '유가가 보내는 물가 신호와 경기 신호',
    viz: { caption: '20거래일 등락 (%)', unit: '%', points: [{ x: 'WTI', value: wti.pct, hot: !lead || lead.name === 'WTI' }, brent ? { x: '브렌트', value: brent.pct, hot: lead?.name === '브렌트' } : null].filter(Boolean) },
    now: `WTI $${wti.to.toFixed(1)} (${signed(wti.pct, 1)})${brent ? ` · 브렌트 $${brent.to.toFixed(1)} (${signed(brent.pct, 1)})` : ''}`,
    mean: `${read}.${inflation}${spread} 에너지 기업 이익은 유가를 따라가서, 유가가 크게 움직인 날은 에너지 업종이 같이 움직입니다.`,
    next: '매일 · 산유국 회의, 중동 정세, 미국 원유 재고(매주 수요일)',
    flip: `유가가 20거래일 +${O.rise20dPct}% 넘게 오르면서 기대인플레가 같이 오르면 물가 시나리오가, ${O.fall20dPct}% 넘게 내리면서 금리도 같이 내리면 경기 둔화 시나리오가 힘을 얻습니다.`,
    detail: [['WTI 20거래일 전', `$${wti.from.toFixed(1)}`], ['브렌트', brent ? `$${brent.to.toFixed(1)}` : '—'], ['브렌트 − WTI', brent ? `$${(brent.to - wti.to).toFixed(1)}` : '—'], ['10년 기대인플레', be ? `${be.to.toFixed(2)}% (${bp(be.bp)})` : '—']]
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
  // v59.74: silver is gold with an industrial (and higher-beta) leg. Silver lagging a falling gold is not a haven move — the
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
export function goldRead(gold, real, dollar) {
  const C = RULES.crossAsset;
  const g = gold.pct; const r = real ? real.bp : null; const d = dollar ? dollar.pct : null;
  if (Math.abs(g) < C.gold20dPct) return `금은 20거래일 ${signed(g, 1)}로 크게 움직이지 않았습니다.`;
  const up = g > 0;
  const rateMoved = r != null && Math.abs(r) >= C.rate20dBp;
  const dollarMoved = d != null && Math.abs(d) >= C.dollar20dPct;
  const rateFits = rateMoved && Math.sign(r) !== Math.sign(g);
  const dollarFits = dollarMoved && Math.sign(d) !== Math.sign(g);
  if (rateFits) return `금 ${up ? '상승' : '하락'}은 실질금리 ${bp(r)}와 맞는 평소 관계입니다 — 이자가 없는 금을 들고 있는 비용이 ${up ? '줄었' : '커졌'}습니다${dollarFits ? `. 달러(${signed(d, 1)})도 같은 쪽으로 거들었습니다` : ''}.`;
  if (dollarFits) return `금 ${up ? '상승' : '하락'}은 달러 ${signed(d, 1)}와 맞는 평소 관계입니다${rateMoved ? ` — 실질금리(${bp(r)})는 오히려 반대 쪽이라 달러 쪽 설명이 큽니다` : ''}.`;
  if (rateMoved) {
    return up
      ? `실질금리가 ${bp(r)} 올랐는데도 금이 ${signed(g, 1)} 올랐습니다 — 금리로 설명되지 않는 안전자산·중앙은행 매수 쪽 수요입니다.`
      : `실질금리가 ${bp(r)} 내렸는데도 금은 ${signed(g, 1)} 빠졌습니다 — 금리·달러로는 설명되지 않아, 많이 오른 자산부터 줄이는 포지션 정리 쪽으로 읽습니다(추정).`;
  }
  return up ? `실질금리·달러가 크게 움직이지 않았는데 금이 ${signed(g, 1)} 올라 안전자산이나 중앙은행 매수 쪽입니다.`
    : `실질금리·달러가 크게 움직이지 않았는데 금이 ${signed(g, 1)} 빠져 포지션 정리 쪽입니다(추정).`;
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
    : dxy.pct >= D.rise20dPct ? `달러가 ${signed(dxy.pct, 1)} 올랐지만 1년 범위 중간이라 부담 기준(+${D.rise20dPct + D.bufferPct}%)에는 못 미칩니다`
      : dxy.pct <= D.fall20dPct ? '달러가 약해져 미국 밖 자산과 원자재에 우호적인 쪽입니다' : '달러는 크게 움직이지 않았습니다';
  const carry = jpy && jpy.pct <= -3 ? ' 엔화가 빠르게 강해져(엔/달러 하락) 낮은 엔화 금리로 빌린 돈이 되돌아가는지(캐리 청산) 봐야 합니다.' : '';
  const won = krw ? wonMoveSentence(krw.pct, { dxy20: dxy.pct }) : ''; // v59.76: one reading with the 성장·한국 chapter
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

// v59.64: each chapter's "오늘" line from the market-day ledger (src/domain/market-day/facts.js) — the chapter's own
// gauge that moved most against its usual day, what moved with it (driver links: oil → energy names), and the most
// material report on the same topic. Nothing is said when the ledger is missing or every gauge moved as usual.
const CHAPTER_ASSETS = Object.freeze({ inflation: ['breakeven10'], labor: [], rates: ['tnx', 'dgs2', 'realYield10'], oil: ['wti', 'brent'],
  metals: ['gold', 'silver'], dollar: ['dxy', 'usdjpy', 'usdkrw'], credit: ['hyOas', 'igOas', 'cccOas'], volatility: ['vix'], growth: ['kospi', 'kosdaq'] });
const CHAPTER_TOPICS = Object.freeze({ inflation: ['inflation'], labor: ['jobs'], rates: ['rates'], oil: ['energy'], metals: ['metals'], dollar: ['fx'], credit: ['credit'], volatility: ['volatility'], growth: ['korea'] });
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
  // The report must be about the chapter by its own words (wordTopics), not only by the feed it came from.
  const report = facts.filter((fact) => fact.kind === 'headline' && fact.rank !== 'context' && (fact.wordTopics || fact.topics)?.some((topic) => topics.includes(topic)))
    .sort((a, b) => b.materiality - a.materiality)[0] || null;
  if (!lead && !report) return null;
  const size = (fact) => ((fact.changeUnit || fact.unit) === 'bp' ? bp(fact.change) : signed(fact.change, 1));
  const parts = [];
  if (lead) parts.push(`${lead.label} ${size(lead)}, 평소 하루 변동의 ${Math.abs(lead.z).toFixed(1)}배${lead.rank === 'lead' ? '로 오늘 가장 큰 변화 중 하나입니다' : '입니다'}`);
  if (moved.length) parts.push(`같이 움직인 업종은 ${moved.slice(0, 2).map((group) => `${group.label}(${signed(group.change, 1)})`).join(', ')}입니다`);
  return { text: `${parts.join('. ')}${parts.length ? '.' : ''}`, report: report ? { title: report.title, date: report.date } : null, rank: lead?.rank || report?.rank || 'minor' };
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
  const tail = !!(ccc && ccc.bp >= C.stress20dMultiple * C.widen20dBp); // CCC +50bp in 20 sessions, the axis's 2 × widen20dBp
  const mean = creditReading(judgement, { cccTail: tail, ccc20: ccc?.bp ?? null, ig20: ig?.bp ?? null });
  const flip = creditFlip(judgement);
  return {
    id: 'credit', title: '신용 · 유동성 — 위기 신호 점검', question: '주가 조정이 신용 위기로 번질 위험', state,
    viz: { caption: '스프레드 20거래일 변화 (bp)', unit: 'bp', points: [ig ? { x: '투자등급', value: ig.bp } : null, { x: '하이일드', value: hy.bp }, bb20 ? { x: 'BB', value: bb20.value } : null, b20 ? { x: 'B', value: b20.value } : null, ccc ? { x: 'CCC', value: ccc.bp, hot: true } : null].filter(Boolean) },
    now: `하이일드 ${hy.from.toFixed(2)} → ${hy.to.toFixed(2)}% (${bp(hy.bp)})${ccc ? ` · CCC ${bp(ccc.bp)}` : ''}`,
    mean: `${mean}${fci ? ` 금융여건 지수는 ${fci.value.toFixed(2)}${'013678'.includes(fci.value.toFixed(2).slice(-1)) ? '으로' : '로'} ${fci.value < 0 ? '아직 완화 쪽' : '긴축 쪽'}입니다.` : ''}`,
    next: '매일',
    flip,
    ranges: creditRanges(macroHistory),
    detail: [['하이일드', `${hy.to.toFixed(2)}%`], ...(bb20 ? [['BB', `${bb20.level.toFixed(2)}%`]] : []), ...(b20 ? [['B', `${b20.level.toFixed(2)}%`]] : []), ['CCC', ccc ? `${ccc.to.toFixed(2)}%` : '—'], ['투자등급', ig ? `${ig.to.toFixed(2)}%` : '—'], ['금융여건 지수', fci ? fci.value.toFixed(2) : '—']]
  };
}

function growthKorea(macroHistory, history, events) {
  const kospi = historySpan(history, 'kospi');
  // v59.70 (owner 11/4): US semiconductors are SOXX, as on 무슨 일이 있었나.
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
  const won = krw ? wonMoveSentence(krw.pct, { dxy20: historySpan(history, 'dxy')?.pct ?? null }) : '';
  const next = nextOf(events, ['us-retail']);
  const spending = !retail ? ''
    : realRetail != null && retail.value >= 0 && realRetail < retail.value - 0.3 ? `소매판매는 명목 ${signed(retail.value, 1)}지만 같은 달 소비자물가(${signed(cpiSame.value, 2)})를 빼면 실질 약 ${signed(realRetail, 1)}로, 소비는 늘었다기보다 ${realRetail >= 0 ? '버티는 정도입니다' : '물가에 밀려 줄었습니다'}. `
      : retail.value >= 0 ? '소비 지출은 아직 꺾이지 않았습니다. ' : '소비 지출이 줄었습니다. ';
  return {
    id: 'growth', title: '성장 · 소비 · 한국', question: '경기의 지속력과 한국 시장이 묶인 고리',
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

/** The chapters (v59.64: eight; v59.74: nine with 변동성); a chapter whose series are missing is left out. `day` is market-day.json, when loaded. */
export function buildMacroChapters({ macroHistory = null, history = [], events = [], day = null } = {}) {
  const chapters = [inflation(macroHistory, events), labor(macroHistory, events), rates(macroHistory, events, history), credit(macroHistory), oil(history, macroHistory),
    metals(history, macroHistory), dollarChapter(history, macroHistory), volatilityChapter(history, events), growthKorea(macroHistory, history, events)].filter(Boolean)
    .map((chapter) => ({ ...chapter, today: chapterToday(oneSessionDay(day, history), chapter.id) }));
  return { available: chapters.length > 0, chapters };
}
