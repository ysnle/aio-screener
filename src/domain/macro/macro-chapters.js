// v59.55 (owner 11/1, "PCE 분석 및 설명은 아예 없고, 유가 분석 없고, 최근 금/은 급락에 대해서도 설명은 없고, 고용/노동 분석
// 없고, 향후 … CPI 발표 체크해야된다라는 내용도 없고"): 매크로's six chapters. Each answers one question with one small
// picture, the latest numbers, what they mean for stocks, the next dated release and the condition that would change the
// read. Every number comes from macro-history.json (FRED) or history.json; every sentence is chosen by a rule here.
import { readNumber, signedText } from '../shared/number.js';
import { dayLabel } from '../market/market-story.js';
import { buildCloseSeries } from '../market/close-series.js';
import { MARKET_WINDOWS, closeChange } from '../market/market-windows.js';
import { sessionPointBack } from './rates-fx.js';

// v59.56: the shared signedText, so a 20-session +0.04% prints 0.0%, never '+0.0%'.
const signed = (value, digits = 2, unit = '%') => signedText(value, digits, unit);
const bp = (value) => `${value > 0 ? '+' : ''}${Math.round(value)}bp`;

function series(macroHistory, id) {
  return (macroHistory?.series?.[id]?.observations || []).filter(([day, value]) => day && readNumber(value) !== null).map(([day, value]) => ({ date: day, value: Number(value) }));
}
function monthOverMonth(rows) {
  return rows.slice(1).map((row, index) => ({ date: row.date, value: (row.value / rows[index].value - 1) * 100 }));
}
const monthName = (date) => `${Number(String(date).slice(5, 7))}월`;
const nextOf = (events, ids) => (events || []).find((event) => ids.includes(event.id)) || null;
const whenOf = (event) => (event ? `${dayLabel(event.date)} ${event.name}` : '');
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
  const pce = series(macroHistory, 'corePceIndex');
  if (pce.length < 14) return null;
  const mom = monthOverMonth(pce.slice(-7));
  const last = mom.at(-1);
  const three = ((pce.at(-1).value / pce.at(-4).value) ** 4 - 1) * 100;
  const yoy = (pce.at(-1).value / pce.at(-13).value - 1) * 100;
  const cpiMom = monthOverMonth(series(macroHistory, 'coreCpiIndex').slice(-2)).at(-1);
  const shelter = monthOverMonth(series(macroHistory, 'shelterCpiIndex').slice(-2)).at(-1);
  const supercore = monthOverMonth(series(macroHistory, 'supercoreCpiIndex').slice(-2)).at(-1);
  const recent = (mom.at(-1).value + mom.at(-2).value) / 2;
  const before = (mom.at(-3).value + mom.at(-4).value) / 2;
  const turn = recent - before >= 0.08 ? '다시 빨라졌습니다' : before - recent >= 0.08 ? '느려지고 있습니다' : '비슷한 속도입니다';
  // v59.56 (screen review): after a hike the question is whether the Fed goes further, not whether it can cut. The last
  // move of the target upper bound in the past 180 days decides which question this card asks.
  const target = series(macroHistory, 'fedTargetUpper');
  const cutoff = target.length ? new Date(Date.parse(`${target.at(-1).date}T00:00:00Z`) - 180 * 86400000).toISOString().slice(0, 10) : '';
  let lastMove = 0;
  for (let i = target.length - 1; i > 0 && target[i].date >= cutoff; i -= 1) { if (target[i].value !== target[i - 1].value) { lastMove = target[i].value - target[i - 1].value; break; } }
  const hiking = lastMove > 0;
  const hot = hiking
    ? (three >= 3 ? '연준 목표 2%보다 한참 빠른 속도라 추가 인상 압력이 남아 있습니다' : three >= 2.5 ? '목표보다 조금 빨라 동결이 길어질 쪽입니다' : '목표 근처라 추가 인상 근거는 약합니다')
    : three >= 3 ? '연준 목표 2%보다 한참 빠른 속도라 금리 인하 여지가 좁습니다' : three >= 2.5 ? '목표보다 조금 빨라 인하는 천천히 갈 쪽입니다' : '목표 근처라 연준이 금리를 내릴 여지가 있습니다';
  const service = shelter && supercore && shelter.value >= 0.3 && supercore.value >= 0.3 ? ' 주거비와 주거 뺀 서비스가 함께 올라 서비스 물가가 다시 붙었습니다.' : '';
  const next = nextOf(events, ['us-cpi', 'us-pce']);
  return {
    id: 'inflation', title: '물가 — PCE · CPI', question: hiking ? '연준이 더 올릴까, 멈출까' : '연준이 금리를 내릴 수 있나',
    viz: { caption: '근원 PCE 전월비 (%)', unit: '%', points: mom.map((row, index) => ({ x: monthName(row.date), value: row.value, hot: index === mom.length - 1 })) },
    now: `${monthName(last.date)} 근원 PCE ${signed(last.value)} · 3개월 연율 ${three.toFixed(1)}% · 전년비 ${yoy.toFixed(1)}%`,
    mean: `최근 두 달 물가 속도가 그 전 두 달보다 ${turn}. ${hot}.${service}`,
    next: whenOf(next) || '발표 일정을 확인하지 못했습니다',
    flip: hiking ? '근원 PCE 월 +0.2% 이하가 두 달 이어지면 동결 쪽으로, +0.3% 이상이 이어지면 추가 인상 쪽으로 기웁니다.' : '근원 PCE 월 +0.2% 이하가 두 달 이어지면 완화 쪽으로, +0.3% 이상이 이어지면 인하 기대가 더 줄어듭니다.',
    detail: [['근원 CPI 전월비', cpiMom ? signed(cpiMom.value) : '—'], ['주거비 CPI', shelter ? signed(shelter.value) : '—'], ['주거 뺀 서비스(슈퍼코어)', supercore ? signed(supercore.value) : '—'], ['근원 PCE 3개월 연율', `${three.toFixed(1)}%`]]
  };
}

function labor(macroHistory, events) {
  const payrolls = series(macroHistory, 'payrolls');
  const unemployment = series(macroHistory, 'unemployment');
  if (payrolls.length < 7 || unemployment.length < 13) return null;
  const changes = payrolls.slice(-7).slice(1).map((row, index) => ({ date: row.date, value: row.value - payrolls.slice(-7)[index].value }));
  const avg3 = changes.slice(-3).reduce((sum, row) => sum + row.value, 0) / 3;
  const rate = unemployment.at(-1);
  const low12 = Math.min(...unemployment.slice(-13).map((row) => row.value));
  const claims = series(macroHistory, 'initialClaims').at(-1);
  const natural = series(macroHistory, 'naturalUnemployment').at(-1);
  const wages = series(macroHistory, 'hourlyEarnings');
  const wageYoy = wages.length >= 13 ? (wages.at(-1).value / wages.at(-13).value - 1) * 100 : null;
  const layoffs = claims && claims.value >= 250000;
  const sahm = rate.value - low12 >= 0.5;
  const shape = sahm ? '실업률이 1년 저점보다 0.5%p 넘게 올라 경기 침체 경보 구간입니다' : layoffs ? '해고(실업수당 청구)가 늘어 둔화가 침체 쪽으로 옮겨 가는지 봐야 합니다'
    : avg3 < 100 ? '채용은 크게 줄었지만 해고는 늘지 않았습니다. "덜 뽑는 둔화"이지 "자르는 침체"는 아직 아닙니다' : '고용이 꾸준히 늘어 경기 걱정은 크지 않습니다';
  const next = nextOf(events, ['us-nfp']);
  return {
    id: 'labor', title: '고용 — 식는가, 꺾이는가', question: '경기가 침체로 가나',
    viz: { caption: '비농업 고용 증감 (천 명)', unit: '', points: changes.map((row, index) => ({ x: monthName(row.date), value: row.value, hot: index === changes.length - 1 })) },
    now: `${monthName(changes.at(-1).date)} ${changes.at(-1).value >= 0 ? '+' : ''}${(changes.at(-1).value / 10).toFixed(1)}만 · 3개월 평균 ${avg3 >= 0 ? '+' : ''}${(avg3 / 10).toFixed(1)}만 · 실업률 ${rate.value.toFixed(1)}%${claims ? ` · 실업수당 청구 ${(claims.value / 10000).toFixed(1)}만` : ''}`,
    mean: `${shape}.${wageYoy !== null ? ` 임금은 1년 전보다 ${wageYoy.toFixed(1)}% 올라 ${wageYoy >= 4 ? '물가를 다시 밀어 올릴 수 있는 속도입니다' : '물가를 밀어 올릴 정도는 아닙니다'}.` : ''}`,
    next: whenOf(next) || '발표 일정을 확인하지 못했습니다',
    flip: `실업률 ${(low12 + 0.5).toFixed(1)}% 이상(1년 저점 +0.5%p)이나 실업수당 청구 25만 이상이면 침체 쪽으로 읽습니다.`,
    detail: [['실업률 1년 저점', `${low12.toFixed(1)}%`], ['자연실업률 추정', natural ? `${natural.value.toFixed(2)}%` : '—'], ['임금 상승률(전년비)', wageYoy !== null ? `${wageYoy.toFixed(1)}%` : '—'], ['3개월 평균 고용', `${(avg3 / 10).toFixed(1)}만`]]
  };
}

function rates(macroHistory, events) {
  // 10년 = 실질 + 기대인플레 holds only on one date: the legs are cut at the latest date all three have (FRED posts the
  // real yield a day after the others), and the line names that span, so 4.98% (10/29) beside the market 4.93% (10/30) reads.
  const through = ['dgs10', 'realYield10', 'breakeven10'].map((id) => series(macroHistory, id).at(-1)?.date || '').sort()[0] || null;
  const ten = macroChange(macroHistory, 'dgs10', through); const real = macroChange(macroHistory, 'realYield10', through);
  const be = macroChange(macroHistory, 'breakeven10', through); const term = macroChange(macroHistory, 'termPremium10');
  const two = macroChange(macroHistory, 'dgs2', through);
  if (!ten || !real || !be) return null;
  const share = ten.bp ? real.bp / ten.bp : 0;
  const kind = Math.abs(ten.bp) < 10 ? 'flat' : share >= 0.6 ? (ten.bp < 0 ? 'growth' : 'tight') : be.bp / ten.bp >= 0.6 ? (ten.bp < 0 ? 'relief' : 'fear') : 'mixed';
  const read = { flat: '20거래일 동안 큰 변화가 없습니다.', growth: '하락이 거의 실질금리에서 나왔습니다. 물가 기대가 내려서가 아니라 성장 걱정으로 주식에서 채권으로 옮긴 움직임으로 보입니다.',
    tight: '상승이 실질금리에서 나왔습니다. 긴축 부담이 커져 성장주 할인율이 올라갑니다.', relief: '하락이 기대인플레에서 나와 물가 안도 쪽입니다.',
    fear: '상승이 기대인플레에서 나와 물가 걱정 쪽입니다.', mixed: '실질금리와 기대인플레가 함께 움직여 한쪽으로 읽기 어렵습니다.' }[kind];
  const next = nextOf(events, ['us-fed-rate']);
  const points = [['10년', ten.bp], ['실질', real.bp], ['기대인플레', be.bp], term ? ['기간 프리미엄', term.bp] : null, two ? ['2년', two.bp] : null].filter(Boolean);
  return {
    id: 'rates', title: '연준 · 금리 — 왜 움직였나', question: '금리 변화는 물가 때문인가, 성장 걱정 때문인가',
    viz: { caption: '20거래일 변화 (bp)', unit: 'bp', points: points.map(([x, value], index) => ({ x, value, hot: index === 1 })) },
    now: `10년 ${ten.from.toFixed(2)} → ${ten.to.toFixed(2)}% (${shortDay(ten.fromDate)}→${shortDay(ten.date)}, ${bp(ten.bp)}) = 실질 ${bp(real.bp)} + 기대인플레 ${bp(be.bp)}`,
    mean: read,
    next: whenOf(next) || '발표 일정을 확인하지 못했습니다',
    flip: '기대인플레가 같이 움직이기 시작하면 해석이 물가 쪽으로 바뀝니다.',
    detail: [['10년 실질금리', `${real.to.toFixed(2)}%`], ['10년 기대인플레', `${be.to.toFixed(2)}%`], ['기간 프리미엄', term ? `${term.to.toFixed(2)}%` : '—'], ['2년', two ? `${two.to.toFixed(2)}%` : '—']]
  };
}

function commodities(history, macroHistory) {
  const oil = historySpan(history, 'wti'); const gold = historySpan(history, 'gold');
  if (!oil || !gold) return null;
  const real = macroChange(macroHistory, 'realYield10'); const dollar = historySpan(history, 'dxy');
  const peak = buildCloseSeries(history, 'gold').slice(-MARKET_WINDOWS.half).reduce((best, row) => (row.value > best.value ? row : best), { date: '', value: -Infinity });
  const fromPeak = (gold.to / peak.value - 1) * 100;
  const oilRead = oil.pct >= 10 ? '유가가 크게 올라 다음 달 헤드라인 물가는 밀어 올리고 소비 여력은 줄입니다' : oil.pct <= -10 ? '유가가 크게 내려 물가 부담은 줄지만 수요 둔화 신호일 수 있습니다' : '유가는 물가 경로를 바꿀 만큼 움직이지 않았습니다';
  let goldRead = '금은 실질금리·달러와 크게 어긋나지 않았습니다.';
  if (gold.pct <= -4 && real && real.bp < -5 && dollar && Math.abs(dollar.pct) < 1.5) goldRead = '금은 실질금리가 내렸고 달러도 그대로인데 빠져, 금리·달러로는 설명되지 않습니다. 많이 오른 자산부터 파는 포지션 정리일 수 있습니다(추정).';
  else if (gold.pct <= -4 && real && real.bp > 5) goldRead = '금 하락은 실질금리 상승과 같은 방향입니다.';
  else if (gold.pct >= 4) goldRead = '금 상승은 안전자산 수요나 달러 약세 쪽입니다.';
  return {
    id: 'commodities', title: '원자재 — 유가 · 금', question: '물가와 위험 회피가 어디로 가나',
    viz: { caption: '20거래일 등락 (%)', unit: '%', points: [{ x: 'WTI', value: oil.pct, hot: true }, { x: '금', value: gold.pct }, dollar ? { x: '달러', value: dollar.pct } : null].filter(Boolean) },
    now: `WTI $${oil.to.toFixed(1)} (${signed(oil.pct, 1)}) · 금 $${Math.round(gold.to).toLocaleString('en-US')} (${signed(gold.pct, 1)}${fromPeak <= -5 ? `, 고점 대비 ${signed(fromPeak, 1)}` : ''})`,
    mean: `${oilRead}. ${goldRead}`,
    next: '매일 · 산유국 회의와 전쟁 관련 뉴스',
    flip: 'WTI가 더 오르면 물가 시나리오가 올라가고, 금이 실질금리와 다시 같이 움직이면 포지션 정리 국면이 끝난 것입니다.',
    detail: [['WTI 20거래일 전', `$${oil.from.toFixed(1)}`], ['금 6개월 고점', `$${Math.round(peak.value).toLocaleString('en-US')} (${dayLabel(peak.date).split('(')[0]})`], ['달러 지수 20거래일', dollar ? signed(dollar.pct, 1) : '—'], ['은', '시세만 받고 이력은 아직 쌓지 않습니다']]
  };
}

function credit(macroHistory) {
  const hy = macroChange(macroHistory, 'hyOas');
  if (!hy) return null;
  const ccc = macroChange(macroHistory, 'cccOas'); const ig = macroChange(macroHistory, 'igOas');
  const fci = series(macroHistory, 'financialConditions').at(-1);
  const stress = hy.bp >= 40 || hy.to >= 4.5;
  const tail = ccc && ccc.bp >= 50;
  const mean = stress ? '스프레드가 크게 벌어졌습니다. 주가 조정이 신용 문제로 번지는지 확인해야 합니다.'
    : tail ? '전체 하이일드는 조용하지만 가장 약한 CCC 등급이 먼저 벌어지고 있습니다. 위기 신호가 오면 여기서 시작됩니다.'
      : '주가가 움직여도 스프레드가 넓어지지 않아 신용 문제는 아닙니다.';
  return {
    id: 'credit', title: '신용 · 유동성 — 위기인가', question: '주가 조정이 신용 위기로 번지나',
    viz: { caption: '스프레드 20거래일 변화 (bp)', unit: 'bp', points: [ig ? { x: '투자등급', value: ig.bp } : null, { x: '하이일드', value: hy.bp }, ccc ? { x: 'CCC', value: ccc.bp, hot: true } : null].filter(Boolean) },
    now: `하이일드 ${hy.from.toFixed(2)} → ${hy.to.toFixed(2)}% (${bp(hy.bp)})${ccc ? ` · CCC ${bp(ccc.bp)}` : ''}`,
    mean: `${mean}${fci ? ` 금융여건 지수는 ${fci.value.toFixed(2)}로 ${fci.value < 0 ? '아직 완화 쪽' : '긴축 쪽'}입니다.` : ''}`,
    next: '매일',
    flip: '하이일드 3.5% 돌파나 CCC의 빠른 확대가 이어지면 경계 단계로 바꿉니다.',
    detail: [['하이일드', `${hy.to.toFixed(2)}%`], ['CCC', ccc ? `${ccc.to.toFixed(2)}%` : '—'], ['투자등급', ig ? `${ig.to.toFixed(2)}%` : '—'], ['금융여건 지수', fci ? fci.value.toFixed(2) : '—']]
  };
}

function growthKorea(macroHistory, history, events) {
  const kospi = historySpan(history, 'kospi');
  const smh = historySpan(history, 'smh');
  const krw = historySpan(history, 'usdkrw');
  const sentiment = series(macroHistory, 'consumerSentiment').at(-1);
  const retail = monthOverMonth(series(macroHistory, 'retailSales').slice(-2)).at(-1);
  if (!kospi && !sentiment) return null;
  const korea = kospi && smh && Math.abs(kospi.pct - smh.pct) < 4 && Math.abs(smh.pct) >= 5 ? `코스피(${signed(kospi.pct, 1)})가 미국 반도체(${signed(smh.pct, 1)})와 같은 폭으로 움직여, 한국은 AI 반도체 업황에 묶여 있습니다`
    : kospi ? `코스피는 20거래일 ${signed(kospi.pct, 1)}입니다` : '';
  const won = krw ? (Math.abs(krw.pct) < 1.5 ? ' 원화는 안정적입니다.' : krw.pct > 0 ? ' 원화가 약해져 외국인 이탈을 봐야 합니다.' : ' 원화가 강해졌습니다.') : '';
  const next = nextOf(events, ['us-retail']);
  return {
    id: 'growth', title: '성장 · 소비 · 한국', question: '경기가 버티나, 한국은 어디에 묶여 있나',
    viz: { caption: '20거래일 등락 (%)', unit: '%', points: [kospi ? { x: '코스피', value: kospi.pct, hot: true } : null, smh ? { x: 'SMH', value: smh.pct } : null, krw ? { x: '원/달러', value: krw.pct } : null].filter(Boolean) },
    now: [sentiment ? `소비심리 ${sentiment.value.toFixed(1)}` : null, retail ? `소매판매 ${signed(retail.value, 1)}` : null, kospi ? `코스피 ${signed(kospi.pct, 1)}` : null].filter(Boolean).join(' · '),
    mean: `${sentiment && sentiment.value < 60 ? '소비심리는 낮지만 ' : ''}${retail ? (retail.value >= 0 ? '소비 지출은 아직 꺾이지 않았습니다. ' : '소비 지출이 줄었습니다. ') : ''}${korea}.${won}`,
    next: whenOf(next) || 'ISM 제조업(매월 첫 영업일) · 서비스업(셋째 영업일)',
    flip: '소매판매가 두 달 연속 줄고 ISM 제조·서비스가 함께 50 아래면 경기 둔화로 읽습니다.',
    detail: [['소비심리(미시간)', sentiment ? sentiment.value.toFixed(1) : '—'], ['소매판매 전월비', retail ? signed(retail.value, 1) : '—'], ['원/달러 20거래일', krw ? signed(krw.pct, 1) : '—'], ['외국인 매매', '수집기는 있으나 키가 등록되지 않아 아직 비어 있습니다']]
  };
}

/** The six chapters; a chapter whose series are missing is left out. */
export function buildMacroChapters({ macroHistory = null, history = [], events = [] } = {}) {
  const chapters = [inflation(macroHistory, events), labor(macroHistory, events), rates(macroHistory, events), commodities(history, macroHistory), credit(macroHistory), growthKorea(macroHistory, history, events)].filter(Boolean);
  return { available: chapters.length > 0, chapters };
}
