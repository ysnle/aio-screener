import { MOVER_BY_SYMBOL } from '../../briefing/market-movers.js';
import { readNumber, signedText } from '../../shared/number.js';
import { RULES } from '../../rules/thresholds.js';
import { earningsFilterMs, releaseAtMs } from '../../briefing/schedule.js';
import { policyCycle } from '../../macro/macro-signals.js';
import { seriesOf, sahmGap, claimsTrend } from '../../macro/macro-read.js';
import { claim, say, sayJoin, NOTHING } from '../../shared/claim.js';
import { readIndexLongrun, risesInFalls, LONGRUN_DEFINITION } from '../indices/long-run.js';
import { fallFrame, stageOf } from './fall-frame.js';
import { episodeOf, reboundOf, reboundStanceSaid } from './rebound.js';
import { rallyAttemptRead } from '../regime/rally-attempt.js';
import { sessionPointBack } from '../session/close-series.js';
import { sessionStep } from '../session/move-size.js';
import { shortDate, shortDateAgainst } from '../../content/date-labels.js';
import { SCHEDULED_EVENTS as REGISTRY } from '../../briefing/scheduled-events.js';
import { indexLevels, levelValue, levelsRead } from '../indices/index-levels.js';
import { historyFieldMeta } from '../indices/history-meta.js';
import { buildCloseSeries, closeSessionMarket, alignInput, isUsable } from '../session/close-series.js';
import { MARKET_WINDOWS, closeChange } from '../session/market-windows.js';
import { countOpenSessionsBetween } from '../session/market-calendar.js';
import { oasDelta20Bp } from '../../briefing/market-read.js';
import { creditJudgement, creditReading, cccTailLine } from '../../briefing/credit-reading.js';
import { vixBand } from '../sentiment/narrative.js';

export const STORY_SESSIONS = MARKET_WINDOWS.week;
export const STORY_RULE = Object.freeze({
  flatPct: 1, leaderMovePct: 2, leaderGapPct: 2, // concentration: |move| under flatPct is flat; NDX ±leaderMovePct with RSP leaderGapPct apart is narrow
  oilPct: 5, goldPct: 3, koreaSemisPct: 3
});
// A quiet ten-year can hide two legs that cancel (real +12bp, breakeven -11bp): an offset when the legs point opposite
// ways and either passed the rate line on its own. One rule for the week here and the 20 sessions of the 매크로 chapter.
export const ratesLegsOffset = (real, be) => real.bp * be.bp < 0 && Math.max(Math.abs(real.bp), Math.abs(be.bp)) >= RULES.crossAsset.rate20dBp;

export const SCHEDULED_EVENTS = Object.freeze(REGISTRY.filter((event) => event.marketDate && event.storyWhy)
  .map((event) => Object.freeze({ date: event.marketDate, title: event.storyTitle || event.label, why: event.storyWhy })));

const NON_AI_LAYERS = new Set(['ai-adopter', 'ai-exposed', 'limited']);
const REPORT_WEIGHT_MIN = 1; // % of the S&P 500 — a smaller report outside the mover list does not change the week's read
const REPORT_WEIGHT_FALLBACK = 0.3;
const BIG_DAY_PCT = 2;
const BROAD_SELL_ADVANCE = 0.25;
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const SESSION_WORDS = Object.freeze({ bmo: '장 전', amc: '장 마감 후', dmh: '장중' });

const weekday = (date) => { const day = new Date(`${date}T12:00:00Z`).getUTCDay(); return day >= 1 && day <= 5; };
export function dayLabel(date) {
  const [, m, d] = String(date || '').split('-').map(Number);
  return m && d ? `${m}/${d}(${DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]})` : '';
}
const pctText = (value, digits = 1) => signedText(value, digits, '%');
const bpText = (value) => signedText(value, 0, 'bp');

function usSessions(history) {
  return (Array.isArray(history) ? history : []).filter((row) => row?.date && weekday(row.date) && readNumber(row.spx) !== null
    && (!historyFieldMeta(row, 'spx')?.sessionDate || historyFieldMeta(row, 'spx').sessionDate === row.date));
}

function span(history, field, from, to) {
  let start = null; let end = null;
  for (const point of buildCloseSeries(history, field, { market: closeSessionMarket(field) || 'US' })) {
    if (readNumber(point.value) === null) continue;
    if (point.date <= from) start = { date: point.date, value: Number(point.value) };
    if (point.date <= to) end = { date: point.date, value: Number(point.value) };
  }
  if (!start || !end || start.date === end.date || !start.value) return null;
  return { from: start.value, to: end.value, fromDate: start.date, toDate: end.date, pct: (end.value / start.value - 1) * 100 };
}

function macroAt(series, date) {
  let hit = null;
  for (const [day, value] of series?.observations || []) if (day <= date && readNumber(value) !== null) hit = { date: day, value: Number(value) };
  return hit;
}
function macroSpan(macroHistory, id, from, to) {
  const series = macroHistory?.series?.[id];
  const start = macroAt(series, from); const end = macroAt(series, to);
  if (!start || !end || start.date === end.date) return null;
  return { from: start.value, to: end.value, fromDate: start.date, toDate: end.date, bp: (end.value - start.value) * 100 };
}

const MOVE_ROWS = Object.freeze([
  ['ndx', '나스닥 100', 'equity'], ['spx', 'S&P 500', 'equity'], ['rsp', '동일가중 S&P 500', 'equity'], ['soxx', '반도체 SOXX', 'equity'],
  ['kospi', '코스피', 'equity'], ['kosdaq', '코스닥', 'equity'], ['tlt', '미국 장기 국채', 'other'], ['wti', 'WTI 유가', 'other'],
  ['gold', '금', 'other'], ['btc', '비트코인', 'other']
]);

// Where the move sat: a cap-weighted index far from its equal-weight twin is a move carried by the largest names.
function concentrationOf(m) {
  const ndx = m.ndx?.pct; const rsp = m.rsp?.pct; const spx = m.spx?.pct;
  if (![ndx, rsp, spx].every(Number.isFinite)) return { kind: 'unknown' };
  const { flatPct, leaderMovePct, leaderGapPct } = STORY_RULE;
  if (Math.max(Math.abs(ndx), Math.abs(spx), Math.abs(rsp)) < flatPct) return { kind: 'flat' };
  if (ndx <= -leaderMovePct && rsp - ndx >= leaderGapPct) return { kind: 'narrow-down' };
  if (ndx >= leaderMovePct && ndx - rsp >= leaderGapPct) return { kind: 'narrow-up' };
  return { kind: spx < 0 ? 'broad-down' : 'broad-up' };
}

function tenYearSpan(history, sessions, to) {
  const change = closeChange(history, 'tnx', sessions, { through: to });
  if (!change || !isUsable(alignInput(change.to.date, to))) return null;
  return { from: change.from.value, to: change.to.value, fromDate: change.from.date, toDate: change.to.date, pct: change.pct };
}

function ratesOf(macroHistory, history, from, to, sessions) {
  const market = tenYearSpan(history, sessions, to);
  if (market) { from = market.fromDate; to = market.toDate; }
  const fred = macroSpan(macroHistory, 'dgs10', from, to);
  const ten = market ? { ...market, bp: (market.to - market.from) * 100 } : fred;
  const real = macroSpan(macroHistory, 'realYield10', from, to);
  const be = macroSpan(macroHistory, 'breakeven10', from, to);
  if (!ten || !fred || !real || !be) return null;
  // Flat vs moved and the direction follow the printed ten-year span; the real/breakeven shares split the FRED total,
  // so they are read only when that total moved as far and the same way as the printed span.
  const moved = ten.bp; const d = fred.bp;
  let kind = ratesLegsOffset(real, be) ? 'offset' : 'flat';
  if (Math.abs(moved) >= 10) {
    if (Math.abs(d) < 10 || Math.sign(d) !== Math.sign(moved)) kind = 'undivided';
    else {
      const realShare = real.bp / d; const beShare = be.bp / d;
      if (moved < 0) kind = realShare >= 0.6 ? 'growth-fear' : beShare >= 0.6 ? 'inflation-relief' : 'mixed';
      else kind = realShare >= 0.6 ? 'real-up' : beShare >= 0.6 ? 'inflation-fear' : 'mixed';
    }
  }
  return { ten, real, be, kind };
}

function oasWeek(macroHistory, id, from, to, sessions) {
  const read = sessions === 5 ? oasDelta20Bp(macroHistory, id, to) : null;
  if (!read || read.d5 == null) return macroSpan(macroHistory, id, from, to);
  return { from: read.level - read.d5 / 100, to: read.level, toDate: read.date, bp: read.d5 };
}

function creditOf(macroHistory, from, to, sessions) {
  const hy = oasWeek(macroHistory, 'hyOas', from, to, sessions);
  if (!hy) return null;
  const ccc = oasWeek(macroHistory, 'cccOas', from, to, sessions);
  const C = RULES.credit;
  const judgement = creditJudgement(macroHistory, hy.toDate || to || null);
  // The weak tail is CCC's own record (cccTailLine), floored at the axis's five-session widening line.
  const cccTail = !!(ccc && ccc.bp >= cccTailLine(macroHistory, sessions, C.widen5dBp, hy.toDate || to || null));
  const kind = judgement?.state === 'burden' ? 'stress'
    // lowerRated (CCC ahead of HY over 60 sessions) keeps the axis off 양호, so the story does not call it calm either.
    : (judgement?.hy20 != null && judgement.hy20 >= C.widen20dBp) || hy.bp >= C.widenWatch5dBp ? 'widening' : cccTail || judgement?.lowerRated ? 'weak-tail' : 'calm';
  return { hy, ccc, kind, judgement, cccTail };
}
const RATE_READ = Object.freeze({
  'growth-fear': '대부분 실질금리 하락이라 물가 안도보다 성장 걱정에 안전자산인 국채로 돈이 옮겨 간 쪽입니다',
  'inflation-relief': '대부분 기대인플레 하락이라 물가 안도 쪽입니다',
  flight: '기대인플레 하락이 컸지만 하이일드 스프레드가 함께 벌어져, 물가 안도보다 경기·신용 걱정 속 국채로 피한 쪽으로 읽습니다',
  'real-up': '대부분 실질금리 상승이라 긴축 부담 쪽입니다',
  'inflation-fear': '대부분 기대인플레 상승이라 물가 걱정 쪽입니다',
  mixed: '실질금리와 기대인플레가 함께 움직여 한쪽으로 읽기 어렵습니다',
  undivided: '실질금리·기대인플레로 나눠 읽을 수 없습니다',
  flat:'큰 변화가 없습니다'
});
const rateRead = (rates) => (rates.kind === 'offset'
  ? `실질금리 ${bpText(rates.real.bp)}를 기대인플레 ${bpText(rates.be.bp)}가 상쇄한 결과로, ${rates.real.bp > 0 ? '할인율 부담은 커진 쪽입니다' : '물가 기대는 오른 쪽입니다'}`
  : RATE_READ[rates.kind]);

/** One brief per reported company in the window: its first-session reaction, the reported reason and a capex line. */
export function earningsMovers(briefs, { from, to } = {}) {
  const rows = [];
  for (const brief of Array.isArray(briefs?.briefs) ? briefs.briefs : []) {
    const first = brief?.reaction?.firstDate; const pct = Number(brief?.reaction?.firstPct);
    if (brief?.kind !== 'earnings' || !first || first <= from || first > to || !Number.isFinite(pct)) continue;
    const reason = (brief.reasons?.points || []).map((point) => String(point?.text || '').trim()).find((text) => text && !/(찾지 못|확인하지 못|확인되지 않|알 수 없|근거가 없)/.test(text)) || null;
    const capex = (brief.guidance || []).find((item) => /(자본\s?지출|설비\s?투자|capex|capital expenditure)/i.test(`${item?.label || ''} ${item?.quote || ''}`));
    rows.push({ symbol: brief.symbol, name: brief.nameKo || MOVER_BY_SYMBOL[brief.symbol]?.nameKo || brief.symbol, date: first, pct,
      core: brief.tier === 1 || MOVER_BY_SYMBOL[brief.symbol]?.tier === 1, ai: !!brief.layer && !NON_AI_LAYERS.has(brief.layer), korea: /\.K[SQ]$/.test(String(brief.symbol)),
      reason, capex: capex ? `${capex.label} ${String(capex.value || '').replace(/approximately\s*/i, '약 ').replace(/\s*billion/gi, 'B')}`.trim() : null });
  }
  const seen = new Set();
  return rows.sort((a, b) => Number(b.core) - Number(a.core) || Math.abs(b.pct) - Math.abs(a.pct))
    .filter((row) => (seen.has(row.symbol) ? false : seen.add(row.symbol)));
}

export function biggestDay(history, { from, to, events = SCHEDULED_EVENTS } = {}) {
  const spx = buildCloseSeries(history, 'spx', { market: 'US' }).filter((p) => readNumber(p.value) !== null);
  const ndx = new Map(buildCloseSeries(history, 'ndx', { market: 'US' }).filter((p) => readNumber(p.value) !== null).map((p) => [p.date, Number(p.value)]));
  const ndxDates = [...ndx.keys()].sort();
  let best = null;
  for (let i = 1; i < spx.length; i++) {
    const day = spx[i]; const prev = spx[i - 1];
    if (day.date <= from || day.date > to) continue;
    // A missing close (collection gap, no backfill) leaves neighbours several sessions apart; that span is not a day.
    if (countOpenSessionsBetween(prev.date, day.date, 'US') !== 1) continue;
    const pct = (Number(day.value) / Number(prev.value) - 1) * 100;
    if (!best || Math.abs(pct) > Math.abs(best.pct)) best = { date: day.date, prevDate: prev.date, pct };
  }
  if (!best || Math.abs(best.pct) < BIG_DAY_PCT) return null;
  // The Nasdaq-100 move only over the same two sessions; a held (carried) close on the day before is not compared.
  const nIdx = ndxDates.indexOf(best.date);
  const ndxPct = nIdx > 0 && ndxDates[nIdx - 1] === best.prevDate ? (ndx.get(best.date) / ndx.get(best.prevDate) - 1) * 100 : null;
  const dayRow = (Array.isArray(history) ? history : []).find((candidate) => candidate?.date === best.date);
  const advance = readNumber(dayRow?.advanceRatio);
  const before = events.filter((event) => event.date > from && event.date < best.date).at(-1) || null;
  return { ...best, ndxPct, advance, before };
}

function bigDayText(day) {
  if (!day) return '';
  const lead = day.before ? `${dayLabel(day.before.date).split('(')[0]} ${day.before.title} 뒤 ` : '';
  const parts = [`S&P 500 ${pctText(day.pct)}`];
  if (Number.isFinite(day.ndxPct)) parts.push(`나스닥 100 ${pctText(day.ndxPct)}`);
  const breadth = day.advance === null ? '' : day.pct < 0 && day.advance <= BROAD_SELL_ADVANCE
    ? `, 오른 종목 ${Math.round(day.advance * 100)}%뿐인 전면 매도였습니다` : day.pct > 0 && day.advance >= 1 - BROAD_SELL_ADVANCE
      ? `, 구성 종목 ${Math.round(day.advance * 100)}%가 오른 전면 반등이었습니다` : `, 오른 종목 ${Math.round(day.advance * 100)}%였습니다`;
  return `가장 큰 하루는 ${lead}${dayLabel(day.date)} ${parts.join(', ')}${breadth || '였습니다'}.`;
}

function lead({ drivers, rates, asOf = null, bigDay = null }) {
  const parts = [];
  if (bigDay) parts.push(bigDayText(bigDay));
  // Same direction as the index on the session after its report; the index contribution is not measured here, so the
  // sentence does not say the name led the move.
  if (drivers.length) parts.push(`실적 다음 날 ${drivers.map((row) => `${row.name} ${pctText(row.pct)}`).join(', ')}로 지수와 같은 방향이었습니다.`);
  const tail = [];
  const tenSpan = rates && asOf && rates.ten.toDate < asOf ? `(${dayLabel(rates.ten.toDate).split('(')[0]}까지) ` : '';
  if (rates && rates.kind !== 'flat') tail.push(`10년 금리 ${tenSpan}${bpText(rates.ten.bp)}는 ${rateRead(rates)}`);
  if (tail.length) parts.push(`${tail.join('. ')}.`);
  return parts.join(' ');
}

// One line per asset: what it did and whether it agrees with the equity story.
function confirmations({ moves, rates, credit, macroHistory, history, asOf, start }) {
  const rows = [];
  if (rates) rows.push({ id: 'rates', label: '금리', value: `10년 ${rates.ten.from.toFixed(2)} → ${rates.ten.to.toFixed(2)}% (${bpText(rates.ten.bp)}) · 실질 ${bpText(rates.real.bp)} · 기대인플레 ${bpText(rates.be.bp)}`,
    read: `${rateRead(rates)}.${moves.tlt ? ` 장기 국채는 ${pctText(moves.tlt.pct)}입니다.` : ''}` });
  if (credit) {
    const tail = credit.ccc ? ` · CCC ${bpText(credit.ccc.bp)}` : '';
    const read = credit.judgement ? creditReading(credit.judgement, { cccTail: credit.cccTail })
      : credit.kind === 'widening' ? '스프레드가 경계 쪽으로 벌어지고 있습니다.' : '주가가 움직여도 스프레드가 넓어지지 않아 신용 문제는 아닙니다.';
    rows.push({ id: 'credit', label: '신용', value: `하이일드 ${credit.hy.from.toFixed(2)} → ${credit.hy.to.toFixed(2)}% (${bpText(credit.hy.bp)})${tail}`, read });
  }
  if (moves.wti) {
    const p = moves.wti.pct;
    rows.push({ id: 'oil', label: '유가', value: `WTI $${moves.wti.from.toFixed(1)} → $${moves.wti.to.toFixed(1)} (${pctText(p)})`,
      read: p >= STORY_RULE.oilPct ? '물가 경로에 부담입니다. 다음 달 헤드라인 물가에 먼저 들어옵니다.' : p <= -STORY_RULE.oilPct ? '물가 부담은 줄지만 수요 둔화 신호일 수 있습니다.' : '물가 경로를 바꿀 만큼 움직이지 않았습니다.' });
  }
  if (moves.gold) {
    const peak = history.filter((row) => row?.date && row.date <= asOf && readNumber(row.gold) !== null).slice(-90).reduce((best, row) => (Number(row.gold) > (best?.value ?? -Infinity) ? { date: row.date, value: Number(row.gold) } : best), null);
    const fromPeak = peak ? (moves.gold.to / peak.value - 1) * 100 : null;
    const dollar = span(history, 'dxy', start, asOf);
    const p = moves.gold.pct;
    const realDown = rates && rates.real.bp < -5;
    let read = '실질금리·달러와 크게 어긋나지 않았습니다.';
    const G = STORY_RULE.goldPct;
    if (p <= -G && realDown && dollar && Math.abs(dollar.pct) < 1.5) read = '실질금리가 내렸고 달러도 그대로인데 빠져 금리·달러로는 설명되지 않습니다. 많이 오른 자산부터 파는 포지션 정리일 수 있습니다(추정).';
    else if (p <= -G && rates && rates.real.bp > 5) read = '실질금리 상승과 같은 방향의 하락입니다.';
    else if (p >= G) read = '주식과 반대로 오르면 안전자산 수요, 같이 오르면 달러 약세 쪽입니다.';
    rows.push({ id: 'gold', label: '금', value: `$${Math.round(moves.gold.to).toLocaleString('en-US')} (${pctText(p)}${Number.isFinite(fromPeak) && fromPeak <= -5 ? `, ${dayLabel(peak.date).split('(')[0]} 고점 대비 ${pctText(fromPeak)}` : ''})`, read });
  }
  if (moves.kospi) {
    const krw = span(history, 'usdkrw', start, asOf);
    const soxx = moves.soxx?.pct;
    const parts = [`코스피 ${pctText(moves.kospi.pct)}`, moves.kosdaq ? `코스닥 ${pctText(moves.kosdaq.pct)}` : null, krw ? `원/달러 ${pctText(krw.pct)}` : null].filter(Boolean);
    let read = '미국과 다른 길을 갔습니다. 한국 쪽 요인을 따로 봐야 합니다.';
    if (Number.isFinite(soxx) && Math.abs(moves.kospi.pct - soxx) < STORY_RULE.koreaSemisPct && Math.abs(soxx) >= STORY_RULE.koreaSemisPct) read = `미국 반도체(SOXX ${pctText(soxx)})와 같은 크기라 한국 고유 요인보다 반도체 업황이 옮겨 온 모양입니다.`;
    else if (Math.sign(moves.kospi.pct) === Math.sign(moves.spx?.pct || 0)) read = '미국과 같은 방향으로 움직였습니다.';
    if (krw && Math.abs(krw.pct) < 1.5) read += ' 원화는 안정적입니다.';
    else if (krw && krw.pct >= 1.5) read += ' 원화 약세가 함께 와 외국인 이탈 여부를 봐야 합니다.';
    rows.push({ id: 'korea', label: '한국', value: parts.join(' · '), read });
  }
  const vix = span(history, 'vix', start, asOf); const fg = span(history, 'fg', start, asOf);
  if (vix) rows.push({ id: 'mood', label: '심리', value: [`VIX ${vix.from.toFixed(1)} → ${vix.to.toFixed(1)}`, fg ? `공포·탐욕 ${Math.round(fg.from)} → ${Math.round(fg.to)}` : null].filter(Boolean).join(' · '),
    read: vix.to >= RULES.volatility.calmBelow ? `VIX ${vix.to.toFixed(1)}는 ${vixBand(vix.to).label}입니다.` : vix.to - vix.from >= 3 ? `VIX가 ${(vix.to - vix.from).toFixed(1)} 올랐지만 ${vixBand(vix.to).label}입니다.` : '조용한 편입니다.' });
  return rows;
}

// What in the coming week would change the read: the collected next release, the heaviest reports and fixed events.
// The rate-path words follow the policy cycle (macro-signals policyCycle), as the release bands do: in a hiking cycle a hot
// print answers how high and how long, not how soon a cut comes.
const releaseWhy = (event, story, hiking = false) => (event.id === 'us-nfp'
  ? (story.rates?.kind === 'growth-fear' ? '실업률이 오르면 금리 하락이 성장 걱정으로 굳고, 버티면 이번 하락은 업종 조정에 그칩니다.'
    : hiking ? '고용이 식으면 추가 인상 압력이 줄고, 강하면 높은 금리가 더 오래 갑니다.' : '고용이 식으면 금리 인하 기대가 커지고, 강하면 금리 부담이 다시 커집니다.')
  : /\b(?:cpi|pce)\b/.test(String(event.id)) ? (hiking ? '근원 물가가 다시 오르면 추가 인상 압력이 커지고, 식으면 인상이 멈출 근거가 됩니다.' : '근원 물가가 다시 오르면 금리 인하 기대가 줄어듭니다.')
    : event.id === 'us-fed-rate' ? '금리 결정과 함께 앞으로의 경로 발언을 봅니다.'
      : event.id === 'us-retail' ? '소비가 버티는지, 성장 걱정이 소비로 번지는지 봅니다.' : '결과에 따라 지금 시나리오가 바뀔 수 있습니다.');

function weekAhead({ calendar, nextEvent, decidingEvent = null, events = [], storySymbols = null, story, nowMs, macroHistory = null, days = 8 }) {
  const out = [];
  const hiking = policyCycle(seriesOf(macroHistory, 'fedTargetUpper')).hiking;
  const horizon = nowMs + days * 86400000;
  const kstToday = new Date(nowMs + 9 * 3600000).toISOString().slice(0, 10);
  const inside = (date) => { const ms = Date.parse(`${date}T23:59:00Z`); return Number.isFinite(ms) && String(date) >= kstToday && ms <= horizon; };
  // A US release or report carries an ET date; with a known clock it is 'next' until that moment, not until KST midnight
  // (an FOMC at 14:00 ET is 04:00 KST the next day; a CPI at 22:30 KST is over before the KST day ends).
  const ahead = (atMs, date) => (Number.isFinite(atMs) ? atMs > nowMs && atMs <= horizon : inside(date));
  // A report leaves the list at the same moment the briefing schedule drops it (one clock table, an unknown hour included).
  const reportAt = (row) => earningsFilterMs(row);
  for (const event of SCHEDULED_EVENTS) if (inside(event.date)) out.push({ kind: 'event', date: event.date, when: dayLabel(event.date), title: event.title, why: event.why });
  const releases = [...(Array.isArray(events) ? events : []), ...[nextEvent, decidingEvent].filter(Boolean)];
  const seenRelease = new Set();
  for (const event of releases) {
    if (!event?.date || !event.id || !ahead(Number.isFinite(event.atMs) ? event.atMs : releaseAtMs(event.id, event.date), event.date) || seenRelease.has(`${event.id}|${event.date}`)) continue;
    seenRelease.add(`${event.id}|${event.date}`);
    const decides = decidingEvent && decidingEvent.id === event.id && decidingEvent.date === event.date;
    out.push({ kind: 'macro', date: event.date, when: event.when || dayLabel(event.date), title: event.name,
      why: `${releaseWhy(event, story, hiking)}${decides ? ' 지금 맞서는 시나리오를 가르는 발표입니다.' : ''}` });
  }
  const aiStory = story.concentration.kind === 'narrow-down' || story.concentration.kind === 'narrow-up';
  const pending = (Array.isArray(calendar?.earnings) ? calendar.earnings : [])
    .filter((row) => row?.symbol && row.date && readNumber(row.epsActual) === null && ahead(reportAt(row), row.date));
  const byWeight = (a, b) => (Number(b.indexWeight) || 0) - (Number(a.indexWeight) || 0);
  let reports = pending.filter((row) => Number(row.indexWeight) >= REPORT_WEIGHT_MIN || (MOVER_BY_SYMBOL[row.symbol] && Number(row.indexWeight) > 0)).sort(byWeight).slice(0, 3);
  if (!reports.length) reports = pending.filter((row) => Number(row.indexWeight) >= REPORT_WEIGHT_FALLBACK).sort(byWeight).slice(0, 2);
  const storyOf = (row) => (storySymbols instanceof Map ? storySymbols.get(row.symbol) : null);
  const storyReports = pending.filter((row) => storyOf(row) && !reports.includes(row)).slice(0, 2);
  // Reports in the same session are one line: "AAPL · PLTR 실적 (S&P 500 비중 AAPL 7.7% · PLTR 0.7%)" — each weight inside its label.
  const sessionsOf = new Map();
  for (const row of reports) {
    const key = `${row.date}|${row.hour || ''}`;
    if (!sessionsOf.has(key)) sessionsOf.set(key, []);
    sessionsOf.get(key).push(row);
  }
  const slotOf = (row) => ({ bmo: 0, dmh: 1, amc: 2 })[row.hour] ?? 1;
  const fallbackWeek = !reports.some((row) => Number(row.indexWeight) >= REPORT_WEIGHT_MIN || MOVER_BY_SYMBOL[row.symbol]);
  // only the session with the largest
  // summed weight is the largest; the next says it is the next-largest of the period. The sessions are ranked by that sum.
  const sessionWeight = (rows) => rows.reduce((sum, row) => sum + (Number(row.indexWeight) || 0), 0);
  const byLoad = [...sessionsOf.values()].sort((a, b) => sessionWeight(b) - sessionWeight(a));
  const fallbackWhy = (rows) => (byLoad.indexOf(rows) === 0 ? '이 기간 S&P 500 실적 가운데 비중이 가장 커, 같은 업종의 가이던스 판단에 바로 쓰입니다.'
    : `이 기간 S&P 500 실적 가운데 ${byLoad.indexOf(rows) + 1}번째로 비중이 큰(${sessionWeight(rows).toFixed(1)}%) 발표입니다. 같은 업종의 가이던스를 함께 확인합니다.`);
  for (const rows of [...sessionsOf.values()].sort((a, b) => a[0].date.localeCompare(b[0].date) || slotOf(a[0]) - slotOf(b[0]))) {
    const { date, hour } = rows[0];
    const allKo = rows.every((row) => MOVER_BY_SYMBOL[row.symbol]?.nameKo);
    const nameOf = (row) => (allKo ? MOVER_BY_SYMBOL[row.symbol].nameKo : row.symbol);
    out.push({ kind: 'earnings', date, slot: slotOf(rows[0]), when: `${dayLabel(date)}${SESSION_WORDS[hour] ? ` ${SESSION_WORDS[hour]}` : ''}`,
      names: rows.map(nameOf).join(' · '),
      title: `${rows.map(nameOf).join(' · ')} 실적 (S&P 500 비중 ${rows.length === 1 ? `${Number(rows[0].indexWeight).toFixed(1)}%`
        : rows.map((row) => `${nameOf(row)} ${Number(row.indexWeight).toFixed(1)}%`).join(' · ')})`,
      why: !(aiStory && rows.some((row) => MOVER_BY_SYMBOL[row.symbol]))
        ? (fallbackWeek ? fallbackWhy(rows)
          : rows.reduce((sum, row) => sum + Number(row.indexWeight), 0) >= REPORT_WEIGHT_MIN ? '지수 비중이 커서 결과가 지수 방향에 바로 들어옵니다.' : '주도주 목록에 든 회사라 같은 업종 판단에 바로 쓰입니다.')
        : out.some((item) => item.kind === 'earnings' && item.ai) ? '앞 실적에서 나온 AI 투자 대비 수익 판단이 이어지는지, 다른 회사 가이던스로 한 번 더 확인합니다.'
          : '대형 기술주 쏠림이 이어질지 가르는 실적입니다. 가이던스가 AI 투자 대비 수익에 대한 의문을 키우는지 줄이는지 봅니다.',
      ai: aiStory && rows.some((row) => MOVER_BY_SYMBOL[row.symbol]) });
  }
  for (const row of storyReports) {
    out.push({ kind: 'earnings', date: row.date, slot: slotOf(row), when: `${dayLabel(row.date)}${SESSION_WORDS[row.hour] ? ` ${SESSION_WORDS[row.hour]}` : ''}`,
      names: row.symbol, title: `${row.symbol} 실적`, story: storyOf(row),
      why: `지금 많이 오가는 '${storyOf(row)}' 이야기의 당사자입니다. 그 이야기가 숫자로 맞는지 이 실적에서 확인합니다.` });
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || (a.slot ?? 1) - (b.slot ?? 1));
  if (story.credit?.kind !== 'calm' && story.credit) out.push({ kind: 'daily', date: '', when: '매일', title: `${story.credit.ccc ? 'CCC · ' : ''}하이일드 스프레드 (${dayLabel(story.credit.hy.toDate).split('(')[0]} 관측)`, asOf: story.credit.hy.toDate, why: '약한 등급부터 계속 벌어지면 주가 조정이 신용 경계로 바뀝니다.' });
  if (story.moves.wti && story.moves.wti.pct >= STORY_RULE.oilPct) out.push({ kind: 'daily', date: '', when: '매일', title: `유가 (${dayLabel(story.moves.wti.toDate).split('(')[0]} 종가)`, asOf: story.moves.wti.toDate, why: '더 오르면 물가 경로와 금리 인하 기대가 함께 바뀝니다.' });
  return out.slice(0, 6);
}

/**
 * @param {object} input
 * @param {object[]} input.history history.json rows
 * @param {object} [input.macroHistory] macro-history.json
 * @param {object} [input.briefs] event-briefs.json
 * @param {object} [input.calendar] earnings-calendar.json
 * @param {object} [input.nextEvent] the crossroads' next release ({ id, name, date, when })
 * @param {object} [input.decidingEvent] v59.74: the later release that settles the branches in play, when it differs
 * @param {object[]} [input.events] v59.74: every collected release (crossroads.events)
 * @param {Map} [input.storySymbols] v59.74: symbol → market-day story label
 */
export function buildMarketStory({ history = [], macroHistory = null, briefs = null, calendar = null, nextEvent = null, decidingEvent = null, events = [], storySymbols = null, nowMs = Date.now(), sessions = STORY_SESSIONS } = {}) {
  const rows = usSessions(history);
  if (rows.length <= sessions) return { available: false };
  const asOf = rows.at(-1).date; const start = rows.at(-1 - sessions).date;
  const moves = {};
  for (const [id] of MOVE_ROWS) { const s = span(history, id, start, asOf); if (s) moves[id] = s; }
  if (!moves.spx || !moves.ndx) return { available: false };
  const concentration = concentrationOf(moves);
  const rates = ratesOf(macroHistory, history, start, asOf, sessions);
  const credit = creditOf(macroHistory, start, asOf, sessions);
  if (rates?.kind === 'inflation-relief' && credit && credit.kind !== 'calm') rates.kind = 'flight';
  const reported = earningsMovers(briefs, { from: start, to: asOf });
  const direction = Math.sign(moves.ndx.pct);
  const drivers = reported.filter((row) => row.core && !row.korea && Math.abs(row.pct) >= 3 && Math.sign(row.pct) === direction).slice(0, 3);
  const story = { available: true, asOf, start, sessions, concentration, rates, credit, moves };
  story.bars = MOVE_ROWS.filter(([id]) => moves[id]).map(([id, label, group]) => ({ id, label, group, pct: moves[id].pct, asOf: moves[id].toDate }));
  story.bigDay = biggestDay(history, { from: start, to: asOf });
  story.lead = lead({ drivers, rates, asOf, bigDay: story.bigDay });
  story.checks = confirmations({ moves, rates, credit, macroHistory, history, asOf, start });
  // The table: every index-moving core name, then the four largest other moves of 8% or more.
  story.earnings = [...reported.filter((row) => row.core).slice(0, 8),
    ...reported.filter((row) => !row.core && Math.abs(row.pct) >= 8).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 4)];
  story.week = weekAhead({ calendar, nextEvent, decidingEvent, events, storySymbols, story, nowMs, macroHistory });
  const levels = indexLevels(history);
  story.levels = levels.length ? { rows: levels.map((level) => ({ id: level.field, label: level.label, value: levelValue(level).replace(`${level.label} `, '') })), read: levelsRead(levels) } : null;
  return story;
}

export const OPENING_INDEXES = Object.freeze([
  // `bar`: the bar's name, so the index (SOX) reads apart from the fund on 기술적 분석's index card (반도체(SOXX)).
  Object.freeze({ id: 'sox', label: '반도체', bar: '반도체(SOX)', full: '필라델피아 반도체 지수(SOX)', topic: '는', part: 'leaders', longrun: 'sox' }),
  Object.freeze({ id: 'ndx', label: '나스닥 100', topic: '은', part: 'leaders', longrun: 'ndx' }),
  Object.freeze({ id: 'spx', label: 'S&P 500', topic: '은', part: 'broad', longrun: 'spx' }),
  Object.freeze({ id: 'dow', label: '다우', topic: '는', part: 'broad', longrun: null }),
  Object.freeze({ id: 'rsp', label: '동일가중', topic: '은', part: 'broad', longrun: null }),
  Object.freeze({ id: 'kospi', label: '코스피', topic: '는', part: 'korea', longrun: 'kospi' })
]);
export const DIAGNOSIS_WORDS = Object.freeze({ unwind: '쏠림 되돌림', recession: '침체형', stress: '금융 불안형', hold: '판단 보류' });
const OPENING_MOVES = Object.freeze([1, 2, 5]);
const yearOf = (date) => String(date || '').slice(0, 4);
const yearMonth = (date) => `${yearOf(date)}년 ${Number(String(date).slice(5, 7))}월`;

// The largest n-session move of the record so far on its side (a fall or a rise): every earlier window is smaller.
function recordLargest(series, n, value) {
  if (!value || series.length <= n + 1) return false;
  const side = Math.sign(value);
  for (let i = n; i < series.length - 1; i += 1) if ((series[i].value / series[i - n].value - 1) * 100 * side >= value * side) return false;
  return true;
}
const sideWord = (value) => (value < 0 ? '하락' : '상승');

function longrunRead(longrun, index, horizon, series, date) {
  if (!longrun || !index) return null;
  const read = readIndexLongrun(longrun, { index, horizon, recent: series.map((point) => [point.date, point.value]) });
  // A table newer than the session read (a replay of an earlier day) is not that day's standing.
  return read && read.liveThrough === date ? read : null;
}

/** One index's facts at `through`: 1/2/5-session moves, the fall from its closing high, and its standing. */
function openingRow(history, spec, through, longrun) {
  const market = closeSessionMarket(spec.id) || 'US';
  const series = buildCloseSeries(history, spec.id, { through, market }).filter((point) => readNumber(point.value) !== null && Number(point.value) > 0)
    .map((point) => ({ date: point.date, value: Number(point.value) }));
  if (series.length < 6) return null;
  const last = series.at(-1);
  const moves = {};
  for (const n of OPENING_MOVES) { const back = sessionPointBack(series, n, market); if (back) moves[n] = sessionStep('pct', back.value, last.value); }
  const high = series.reduce((best, point) => (point.value >= best.value ? point : best), series[0]);
  const day = longrunRead(longrun, spec.longrun, 1, series, last.date);
  const week = longrunRead(longrun, spec.longrun, 5, series, last.date);
  const deep = day?.drawdown || null;
  // With the long-run table the high is the running closing high of decades; without it, the record's (history.json).
  // `trough`: the deepest close since that high — a fall that reached a stage stays in it until a new high (no flicker
  // across the line from one session to the next).
  const low = series.filter((point) => point.date >= high.date).reduce((min, point) => Math.min(min, point.value), high.value);
  const fall = deep ? { value: deep.depth, trough: deep.trough.depth, high: deep.high.date, basis: 'fromLongrunHigh' }
    : { value: (last.value / high.value - 1) * 100, trough: (low / high.value - 1) * 100, high: high.date, basis: 'fromRecordHigh' };
  const at = (n) => claim({ subject: spec.id, measure: `change${n}d`, asOf: last.date, figures: [{ value: moves[n], unit: 'pct', basis: `change${n}d`, label: spec.label }] });
  const stage = stageOf(fall.value);
  return {
    ...spec, asOf: last.date, from: series[0].date, prevDate: sessionPointBack(series, 1, market)?.date || null, moves, fall, stage, day, week, deep, episode: episodeOf(series, fall.high),
    record: { day: recordLargest(series, 1, moves[1]), week: recordLargest(series, 5, moves[5]) },
    claims: {
      ...Object.fromEntries(OPENING_MOVES.filter((n) => Number.isFinite(moves[n])).map((n) => [n, at(n)])),
      fall: claim({ subject: spec.id, measure: fall.basis, word: stage?.word || null, asOf: last.date,
        compare: stage ? { threshold: stage.threshold, relation: stage.relation, digits: 0 } : null,
        figures: [{ value: fall.value, unit: 'pct', basis: fall.basis, label: spec.label }] })
    }
  };
}

const fallSaid = (row, asOf) => say('고점({hd}) 대비 {fall}', { hd: shortDateAgainst(row.fall.high, asOf), fall: row.claims.fall });

/**
 * The one standing sentence an index earns, if any — computed, never written by hand. With the long-run table: the fall
 * from the high against past falls as deep (drawdown.since), a one-session fall among the ten largest since the table
 * starts, or a five-session fall larger than any in over a year. Without it: the largest one- or five-session fall of the
 * record (history.json, named with its first date).
 */
function standingSaid(row, { prefer = 'fall', skipDeep = false } = {}) {
  if (!row) return NOTHING;
  const lab = row.label;
  const yearAgo = `${Number(yearOf(row.asOf)) - 1}${row.asOf.slice(4)}`;
  const deepSince = !skipDeep && row.deep?.inRange && row.fall.value < 0
    ? (row.deep.since
      ? say('{lab} 고점 대비 하락은 {when} 저점({then}) 이후 가장 깊습니다.', { lab, when: yearMonth(row.deep.since.trough),
        then: claim({ subject: row.id, measure: 'longrunEpisode', asOf: row.asOf, figures: [{ value: row.deep.since.depth, unit: 'pct', basis: 'episodeDepth', label: lab }] }) })
      : say('{lab} 고점 대비 하락은 {from}년 이후 가장 깊습니다.', { lab, from: yearOf(row.day?.from) }))
    : NOTHING;
  // A one- or five-session rise is placed as a fall is (the 11/23 rebound: 기록 중 가장 큰 하루 상승).
  const weekMove = row.week?.move;
  const weekSince = weekMove?.inTail && (!weekMove.since || weekMove.since.date < yearAgo)
    ? say('{lab} 5거래일 {d5}는 {when} 이후 가장 큰 주간 {w}입니다.', { lab, d5: row.claims[5], w: sideWord(weekMove.pct), when: weekMove.since ? yearMonth(weekMove.since.date) : `${yearOf(row.week.from)}년` })
    : NOTHING;
  const dayMove = row.day?.move;
  const dayRank = dayMove?.inTail && dayMove.rank <= 10
    ? say(dayMove.rank === 1 ? '{lab} 하루 {d1}는 {from}년 이후 가장 큰 하루 {w}입니다.' : '{lab} 하루 {d1}는 {from}년 이후 {rank}번째로 큰 하루 {w}입니다.',
      { lab, d1: row.claims[1], w: sideWord(dayMove.pct), from: yearOf(row.day.from), rank: String(dayMove.rank) })
    : NOTHING;
  const recordDay = !row.day && row.record.day ? say('{lab} 하루 {d1}는 기록({from} 이후) 중 가장 큰 하루 {w}입니다.', { lab, d1: row.claims[1], w: sideWord(row.moves[1]), from: row.from }) : NOTHING;
  const recordWeek = !row.week && row.record.week ? say('{lab} 5거래일 {d5}는 기록({from} 이후) 중 가장 큰 주간 {w}입니다.', { lab, d5: row.claims[5], w: sideWord(row.moves[5]), from: row.from }) : NOTHING;
  const order = prefer === 'week' ? [weekSince, deepSince, dayRank, recordWeek, recordDay] : [deepSince, dayRank, weekSince, recordDay, recordWeek];
  return order.find((piece) => piece.text) || NOTHING;
}

function indexSentence(row, { date = true } = {}) {
  const day = Number.isFinite(row.moves[1]) ? say(date ? '{d} 하루 {m}, ' : '하루 {m}, ', { d: shortDate(row.asOf), m: row.claims[1] }) : NOTHING;
  const slots = { lab: row.label, topic: row.topic, day, fall: fallSaid(row, row.asOf), st: row.claims.fall };
  return row.stage ? say('{lab}{topic} {day}{fall}로 {st.word}입니다.', slots) : say('{lab}{topic} {day}{fall}입니다.', slots);
}

/** The growth lines the 매크로 screen reads (RULES.growth): the Sahm gap and initial claims over their one-year low. */
function growthAt(macroHistory, asOf) {
  const upTo = (id) => seriesOf(macroHistory, id).filter((row) => row.date <= asOf);
  const sahm = sahmGap(upTo('unemployment'));
  const claimsRead = claimsTrend(upTo('initialClaims'));
  const G = RULES.growth;
  return { sahm, claims: claimsRead, weak: (sahm?.value ?? -Infinity) >= G.sahmRecessionAt || (claimsRead?.aboveLow ?? -Infinity) >= G.claimsRiseAbovePct };
}

/**
 * The diagnosis — one rule, in this order: 금융 불안형 when the high-yield spread is at or over the credit axis's stress line;
 * 침체형 when the growth lines turned (Sahm, claims) and the fall is broad (the Nasdaq-100 / equal-weight gap under
 * unwindGapPp, or under broadBelowPct of members over their 50-day line); 쏠림 되돌림 when the Nasdaq-100 fell at least
 * unwindGapPp more than the equal weight; 판단 보류 otherwise. Nothing is diagnosed ('none') until one of the two has closed
 * correctionPct below its high since that high (the fall stays diagnosed until a new high). `fast`: the spread widened the credit axis's five-session line (the "아직은" caveat).
 */
export function diagnoseFall({ ndx, rsp, credit = null, growth = null, breadth50 = null }) {
  const S = RULES.story, C = RULES.credit;
  if (!ndx || !rsp) return null;
  const gap = rsp.fall.value - ndx.fall.value;
  const base = { gap, credit, growth, breadth50, fast: !!credit && Number.isFinite(credit.hy5) && credit.hy5 >= C.widen5dBp };
  if (Math.min(ndx.fall.trough ?? ndx.fall.value, rsp.fall.trough ?? rsp.fall.value) > -S.correctionPct) return { ...base, state: 'none' };
  const broad = gap < S.unwindGapPp || (Number.isFinite(breadth50) && breadth50 < S.broadBelowPct);
  const state = credit && credit.hyBp >= C.stressAtBp ? 'stress' : growth?.weak && broad ? 'recession' : gap >= S.unwindGapPp ? 'unwind' : 'hold';
  return { ...base, state, word: DIAGNOSIS_WORDS[state] };
}

// The spread level against the credit axis's stress line; `speed` adds its five-session change (printed only then).
function hyClaim(j, { speed = false } = {}) {
  const C = RULES.credit;
  return claim({ subject: 'hy', measure: 'level', asOf: j.date, compare: { threshold: C.stressAtBp, relation: j.hyBp >= C.stressAtBp ? 'atLeast' : 'below' },
    figures: [{ value: j.hyBp, unit: 'spread', basis: 'level', label: '신용 스프레드' }, ...(speed && Number.isFinite(j.hy5) ? [{ value: j.hy5, unit: 'bp', basis: 'change5d', label: '5거래일' }] : [])] });
}

// ---- the lede ------------------------------------------------------------------------------------------------------------
const SEVERITY = Object.freeze({ 'pre-correction': 0, correction: 1, 'bear-edge': 2, bear: 3 });
const severity = (row) => SEVERITY[row.stage?.word || 'pre-correction'];
// The diagnosis in everyday words (the lede); the state word itself is the diagnosis line's.
const DIAGNOSIS_PLAIN = Object.freeze({ unwind: '쏠림이 되돌려지는 하락입니다', recession: '경기 침체 우려가 반영되는 하락입니다',
  stress: '신용 시장이 흔들리는 하락입니다', hold: '어떤 하락인지는 판단을 미룹니다' });

/** The stage claim an index's fall earns, 조정 전 included, under the name the lede prints ('시장 전체' is the S&P 500). */
function stageClaim(row, label = row.label) {
  const stage = row.stage || { word: 'pre-correction', threshold: -RULES.story.correctionPct, relation: 'above' };
  return claim({ subject: row.id, measure: row.fall.basis, word: stage.word, asOf: row.asOf, compare: { threshold: stage.threshold, relation: stage.relation, digits: 0 },
    figures: [{ value: row.fall.value, unit: 'pct', basis: row.fall.basis, label }] });
}

// The lede's one number: the deepest staged leader's fall as a size ("고점에서 43% 내린"), or — when the long-run table
// places that fall — the since instead ("2022년 10월 이후 가장 깊은 하락으로"). Never both.
const depthClaim = (row) => { const basis = `${row.fall.basis}Depth`; return claim({ subject: row.id, measure: basis, asOf: row.asOf, figures: [{ value: -row.fall.value, unit: 'share', basis, label: row.label }] }); };
function carrierSaid(row) {
  if (row.deep?.inRange && row.fall.value < 0) return say('{when} 이후 가장 깊은 하락으로 ', { when: row.deep.since ? yearMonth(row.deep.since.trough) : `${yearOf(row.day?.from)}년` });
  return say('고점에서 {depth} 내린 ', { depth: depthClaim(row) });
}

/**
 * "반도체는 고점에서 43% 내린 약세장이고 나스닥 100은 약세장 문턱입니다. 시장 전체는 조정에 그쳐, 쏠림이 되돌려지는 하락입니다."
 * Leaders' stages, then the S&P 500's stage against theirs (그쳐: less; 도: the same; 가: deeper), then the diagnosis in
 * everyday words; with no diagnosis the stages alone.
 */
function ledeSaid(leaders, spx, d) {
  const staged = leaders.filter((row) => row.stage);
  const carrier = staged.length ? staged.reduce((a, b) => (b.fall.value < a.fall.value ? b : a)) : null;
  const stagePiece = (row) => say('{lead}{st.word}', { lead: row === carrier ? carrierSaid(row) : row.stage ? '' : '아직 ', st: stageClaim(row) });
  const [a, b] = leaders;
  const first = b
    ? say('{a}{ta} {pa}이고 {b}{tb} {pb}입니다.', { a: a.label, ta: a.topic, pa: stagePiece(a), b: b.label, tb: severity(a) === severity(b) ? '도' : b.topic, pb: stagePiece(b) })
    : say('{a}{ta} {pa}입니다.', { a: a.label, ta: a.topic, pa: stagePiece(a) });
  if (!spx) return first;
  const top = Math.max(...leaders.map(severity));
  const slots = { st: stageClaim(spx, '시장 전체'), p: severity(spx) < top ? '는' : severity(spx) === top ? '도' : '가', yet: spx.stage ? '' : '아직 ' };
  if (!d || d.state === 'none') return sayJoin([first, say('시장 전체{p} {yet}{st.word}입니다.', slots)], ' ');
  const plain = DIAGNOSIS_PLAIN[d.state];
  const second = severity(spx) < top
    ? say(spx.stage ? '시장 전체는 {st.word}에 그쳐, {plain}.' : '시장 전체는 {st.word}에 머물러, {plain}.', { ...slots, plain })
    : say('시장 전체{p} {st.word}이고, {plain}.', { ...slots, plain });
  return sayJoin([first, second], ' ');
}

// ---- the rebound (rebound.js decides the state; these say it) ------------------------------------------------------------
const levelClaim = (row, measure, value) => claim({ subject: row.id, measure, asOf: row.asOf, figures: [{ value, unit: 'level', digits: 0, basis: measure, label: row.label }] });
// A line's distance from the close, signed: "종가 대비 +1.6%" is a line 1.6% over the close.
const gapClaim = (row, measure, line) => claim({ subject: row.id, measure, asOf: row.asOf, figures: [{ value: (line / row.episode.close - 1) * 100, unit: 'pct', basis: measure, label: row.label }] });
const hasLines = (...rows) => rows.every((row) => row?.episode?.ma50 != null && row.episode.ma200 != null);

/**
 * 반등 시도: "반도체는 하루 14% 반등했지만 고점 대비로는 아직 34% 아래, 약세장입니다. S&P 500과 나스닥 100이 모두 200일선
 * 아래라 추세 전환은 아직 확인 전입니다." — the deepest staged leader's bounce off its own low (하루 when that low is the
 * session before) and its fall, then the two centre indexes against their 200-day lines. 추세 회복: one sentence.
 */
function reboundLedeSaid(leaders, { spx, ndx }, rebound) {
  // The deepest staged leader that rebounded as far as the rule's own line, else the Nasdaq-100 (the index the rule reads).
  const staged = leaders.filter((row) => row.stage && row.episode?.bounce >= RULES.story.reboundPct);
  const carrier = staged.length ? staged.reduce((a, b) => (b.fall.value < a.fall.value ? b : a)) : ndx;
  const e = carrier.episode;
  // The bounce day itself says 하루; every later session counts from the dated low ("저점(11/20)에서 15% 올라왔지만").
  const slots = { lab: carrier.label, topic: carrier.topic, d: shortDate(e.low.date), depth: depthClaim(carrier),
    up: claim({ subject: carrier.id, measure: 'fromEpisodeLow', asOf: carrier.asOf, figures: [{ value: e.bounce, unit: 'share', basis: 'fromEpisodeLow', label: carrier.label }] }),
    st: carrier.stage ? say(', {s.word}', { s: stageClaim(carrier) }) : NOTHING };
  if (rebound.state === 'recovered') {
    const both = [spx, ndx].every((row) => row.episode.close > row.episode.ma50);
    return say(both ? '{lab}{topic} 저점({d})에서 {up} 올라 고점 대비 {depth} 아래까지 왔고, S&P 500과 나스닥 100은 50일선과 200일선을 모두 되찾았습니다.'
      : '{lab}{topic} 저점({d})에서 {up} 올라 고점 대비 {depth} 아래까지 왔고, S&P 500과 나스닥 100은 200일선 위를 지키고 있습니다.', slots);
  }
  const first = say(e.low.date === carrier.prevDate ? '{lab}{topic} 하루 {up} 반등했지만 고점 대비로는 아직 {depth} 아래{st}입니다.'
    : '{lab}{topic} 저점({d})에서 {up} 올라왔지만 고점 대비로는 아직 {depth} 아래{st}입니다.', slots);
  if (!hasLines(spx, ndx)) return first;
  const under = [spx, ndx].filter((row) => row.episode.close <= row.episode.ma200);
  const second = under.length === 2 ? say('S&P 500과 나스닥 100이 모두 200일선 아래라 추세 전환은 아직 확인 전입니다.')
    : under.length === 1 ? say('{a}{ta} 200일선 위지만 {b}{tb} 아래라 추세 전환은 아직 확인 전입니다.', { a: (under[0] === spx ? ndx : spx).label, ta: (under[0] === spx ? ndx : spx).topic, b: under[0].label, tb: under[0].topic })
      : say('S&P 500과 나스닥 100이 200일선 위지만 50일선 아래라 추세 전환은 아직 확인 전입니다.');
  return sayJoin([first, second], ' ');
}

/**
 * The follow-through day once it has happened after the low ("11/27 바닥 확인일이 나왔습니다."), as the rally-attempt read
 * counts it (rally-attempt.js, on the Composite's closes and volume as the screener producer stores them; history.json has
 * no index volume, so it is not counted on the Nasdaq-100). Not a condition row: a fact of the state.
 */
function followThroughSaid(rebound, history, asOf) {
  const rally = rebound.state === 'failed' ? null : rallyAttemptRead(history, { through: asOf });
  return rally?.phase === 'confirmed' && rally.ftdDate >= rebound.low.date ? say('{d} 바닥 확인일이 나왔습니다.', { d: shortDate(rally.ftdDate) }) : NOTHING;
}

/**
 * The face's rebound paragraph (its label the state word), on 오늘 and 시장 상태 alike: the conditions — the low that
 * withdraws the read and the 200-day levels (their distances are 시장 상태's row) — then the stance. A failed rebound
 * says the stance alone: it already names the broken low.
 */
function reboundLineSaid(rebound, { spx, ndx }, ftd, stance) {
  if (rebound.state === 'failed') return stance;
  const slots = { lab: ndx.label, d: shortDate(rebound.low.date), low: levelClaim(ndx, 'episodeLow', rebound.low.value) };
  const lines = hasLines(spx, ndx) ? say('200일선은 S&P 500 {s}, 나스닥 100 {n}입니다.', { s: levelClaim(spx, 'ma200', spx.episode.ma200), n: levelClaim(ndx, 'ma200', ndx.episode.ma200) }) : NOTHING;
  const fail = rebound.state === 'recovered' ? NOTHING : say('{lab}이 {d} 종가({low}) 아래로 마감하면 반등 실패입니다.', slots);
  return sayJoin([ftd, fail, lines, stance], ' ');
}

/**
 * The rebound's rows for 시장 상태's 다음에 확인할 가격 조건, which its owner (market-read.js priceChecks) puts ahead of
 * the axes' checks: the low with its distance, then the 200- and 50-day lines.
 */
function reboundChecks(rebound, { spx, ndx }) {
  const low = levelClaim(ndx, rebound.state === 'failed' ? 'reboundFrom' : 'episodeLow', rebound.low.value);
  const lowGap = gapClaim(ndx, rebound.state === 'failed' ? 'toReboundFrom' : 'toEpisodeLow', rebound.low.value);
  const out = [rebound.state === 'failed'
    ? say('{lab}이 {d} 종가 {low} 위로 되돌아오는지(종가 대비 {g})', { lab: ndx.label, d: shortDate(rebound.low.date), low, g: lowGap })
    : say('{lab}이 {d} 종가 {low} 위를 지키는지(종가 대비 {g}) — 아래로 마감하면 반등 실패', { lab: ndx.label, d: shortDate(rebound.low.date), low, g: lowGap })];
  if (hasLines(spx, ndx)) {
    const slots = { s: levelClaim(spx, 'ma200', spx.episode.ma200), n: levelClaim(ndx, 'ma200', ndx.episode.ma200),
      sg: gapClaim(spx, 'toMa200', spx.episode.ma200), ng: gapClaim(ndx, 'toMa200', ndx.episode.ma200),
      s5: levelClaim(spx, 'ma50', spx.episode.ma50), n5: levelClaim(ndx, 'ma50', ndx.episode.ma50) };
    out.push(rebound.state === 'recovered'
      ? say('S&P 500과 나스닥 100이 200일선({s} · {n}) 위를 지키는지(종가 대비 {sg} · {ng}) — 아래로 마감하면 다시 판단', slots)
      : say('S&P 500과 나스닥 100이 200일선({s} · {n}) 위로 마감하는지(종가 대비 {sg} · {ng}) — 50일선({s5} · {n5})까지 되찾으면 추세 회복', slots));
  }
  return { said: out, texts: out.map((piece) => piece.text) };
}

/**
 * Under the record line on a rebound: how often one-session rises this large came inside a fall, from the long-run tables
 * (long-run.js risesInFalls; nothing without them, or when their tail is cut above the line).
 */
function riseFrequencySaid(longrun, ndx) {
  const read = longrun ? risesInFalls(longrun, ndx.longrun, RULES.story.reboundPct) : null;
  if (!read?.total) return NOTHING;
  const count = (value, basis) => claim({ subject: `longrun:${ndx.id}`, measure: basis, asOf: read.through, figures: [{ value, unit: 'count', basis, label: ndx.label }] });
  return say('{from}년 이후 {lab}이 하루 {min} 이상 오른 날 {n} 가운데 {m}가 고점에서 {dd} 넘게 내린 하락 구간 안이었습니다.', {
    from: read.from.slice(0, 4), lab: ndx.label, n: count(read.total, 'risesOver'), m: count(read.inside, 'risesInFalls'),
    min: claim({ subject: 'story-rule', measure: 'reboundPct', asOf: read.through, figures: [{ value: read.minPct, unit: 'share', basis: 'reboundPct', label: '하루' }] }),
    dd: claim({ subject: 'longrun-rule', measure: 'drawdownMinPct', asOf: read.through, figures: [{ value: LONGRUN_DEFINITION.drawdownMinPct, unit: 'share', basis: 'drawdownMinPct', label: '고점에서' }] }) });
}

// ---- the diagnosis line --------------------------------------------------------------------------------------------------
/**
 * "나스닥 100이 동일가중보다 12.7%p 더 내렸고 신용 스프레드는 352bp(11/19), 5거래일 +32bp로 빠르게 확대 중. 450bp를 넘으면
 * 금융 불안형." — the state word is the line's label; one reason, the spread (its speed only when it widened the credit
 * axis's five-session line), and one flip condition.
 */
function diagnosisLineSaid(d, { ndx, asOf, breadth = null }) {
  if (!d || d.state === 'none') return NOTHING;
  const S = RULES.story;
  const gap = claim({ subject: 'leader-gap', measure: 'gapPp', asOf, compare: { threshold: S.unwindGapPp, relation: d.gap >= S.unwindGapPp ? 'atLeast' : 'below', digits: 0 },
    figures: [{ value: d.gap, unit: 'pp', basis: 'gapPp', label: ndx.label }] });
  const hy = d.credit ? hyClaim(d.credit, { speed: d.fast }) : null;
  const slots = { gap, hy, lab: ndx.label,
    at: hy && d.credit.date !== asOf ? say('({d})', { d: shortDate(d.credit.date) }) : NOTHING,
    fast: hy?.figures[1] ? say(', {hy.1.label} {hy.1}로 빠르게 확대 중', { hy }) : NOTHING };
  const spread = hy ? say('{hy.label}는 {hy}{at}{fast}', slots) : NOTHING;
  if (d.state === 'stress') return say('{hy.label}가 {hy}{at}로 금융 불안 기준({hy.threshold}) 위{fast}. {hy.threshold} 아래로 돌아오면 다시 판단.', slots);
  if (d.state === 'unwind') {
    const why = hy ? say('{lab}이 동일가중보다 {gap} 더 내렸고 {spread}.', { ...slots, spread }) : say('{lab}이 동일가중보다 {gap} 더 내렸습니다.', slots);
    return sayJoin([why, hy ? say('{hy.threshold}를 넘으면 금융 불안형.', slots) : say('격차가 {gap.threshold} 아래로 줄면 다시 판단.', slots)], ' ');
  }
  if (d.state === 'recession') {
    const sahm = d.growth?.sahm && d.growth.sahm.value >= RULES.growth.sahmRecessionAt ? d.growth.sahm : null;
    const job = sahm ? say('실업률 3개월 평균이 1년 저점보다 {s} 높습니다.', { s: claim({ subject: 'unemployment', measure: 'sahm', asOf: sahm.date, figures: [{ value: sahm.value, unit: 'pp', basis: 'sahm', label: '실업률' }] }) })
      : say('실업수당 청구가 1년 저점보다 {c} 많습니다.', { c: claim({ subject: 'initialClaims', measure: 'aboveLow', asOf: d.growth.claims.date, figures: [{ value: d.growth.claims.aboveLow, unit: 'pct', basis: 'aboveLow', label: '실업수당 청구' }] }) });
    const wide = d.gap < S.unwindGapPp || !breadth ? say('동일가중도 {lab}만큼 내렸고(격차 {gap})', slots)
      : say('50일선 위 종목이 {b}{b.word}이고', { b: claim({ subject: 'breadth50', measure: 'above50', asOf, word: 'only-below', compare: { threshold: S.broadBelowPct, relation: 'below' }, figures: [{ value: breadth, unit: 'share', basis: 'above50', label: '50일선 위 종목' }] }) });
    return sayJoin([say('{wide} ', { wide }), job, hy ? say(' {spread}, {hy.threshold}를 넘으면 금융 불안형.', { ...slots, spread }) : NOTHING], '');
  }
  return sayJoin([say('{lab}과 동일가중의 격차가 {gap}로 작고 고용에 침체 신호가 없습니다.', slots),
    hy && d.fast ? say(' {spread}.', { ...slots, spread }) : NOTHING, say(' 격차가 {gap.threshold}를 넘으면 쏠림 되돌림.', slots)], '');
}

/** The bars' model: each index's fall from its closing high on one scale, with the 조정 and 약세장 lines. */
const BAR_INDEXES = Object.freeze(['sox', 'ndx', 'spx', 'dow', 'rsp']);
function barsOf(rows) {
  return fallFrame(BAR_INDEXES.filter((id) => rows[id]).map((id) => {
    const row = rows[id];
    return { id, label: row.bar || row.label, part: row.part, value: row.fall.value, high: row.fall.high, valueText: say('{f}', { f: row.claims.fall }).text,
      stage: row.stage ? say('{f.word}', { f: row.claims.fall }).text : null };
  }));
}

const STANDING_INDEXES = Object.freeze(['ndx', 'spx', 'sox', 'kospi']);
/**
 * "나스닥 100의 이번 하락은 1985년 이후 고점에서 10% 이상 내린 35번 가운데 12번째로 깊습니다. 약세장 기준(-20%)까지 0.2%p
 * 남았습니다." — one line per index whose fall from its running closing high is in the long-run tables' episode range,
 * and its episodes: this one, then the past ones at least as deep (newest first, `limit`). Nothing without the tables.
 */
export function fallStandings(opening, { limit = 5 } = {}) {
  if (!opening?.available || !opening.longrun) return [];
  const S = RULES.story;
  return STANDING_INDEXES.map((id) => opening.rows[id]).filter((row) => row?.deep?.inRange && row.day).map((row) => {
    const deep = row.deep;
    const rank = deep.comparable.length + 1, total = deep.past + 1;
    const lab = row.full || row.label;
    const min = claim({ subject: row.id, measure: 'episodeMin', asOf: row.asOf, figures: [{ value: LONGRUN_DEFINITION.drawdownMinPct, unit: 'share', basis: 'episodeMin', label: '고점에서' }] });
    const place = rank === 1 ? say('가장 깊습니다.') : say('{rank}번째로 깊습니다.', { rank: String(rank) });
    const lead = say('{lab}의 이번 하락은 {from}년 이후 {min.label} {min} 이상 내린 {total}번 가운데 {place}',{ lab, from: yearOf(row.day.from), min, total: String(total), place });
    const edge = row.stage?.word === 'bear-edge'
      ? say(' {line.label}({line})까지 {gap} 남았습니다.', {
        line: claim({ subject: 'story-rule', measure: 'bearPct', asOf: row.asOf, figures: [{ value: -S.bearPct, unit: 'pct', digits: 0, basis: 'bearPct', label: '약세장 기준' }] }),
        gap: claim({ subject: row.id, measure: 'toBearPp', asOf: row.asOf, figures: [{ value: row.fall.value + S.bearPct, unit: 'pp', basis: 'toBearPp', label: '약세장 기준' }] }) })
      : NOTHING;
    const episode = (e, current = false) => ({ peak: e.peak, trough: e.trough, depth: e.depth, sessions: e.sessions, regained: e.regained || null, current });
    const episodes = [episode({ peak: deep.high.date, trough: deep.trough.date, depth: deep.depth, sessions: deep.sessions }, true), ...deep.comparable.slice(0, limit).map((e) => episode(e))];
    // The strip: each episode's fall on the opening's bar frame, named by its high's month (this one: 이번), its sessions
    // from the high to the low in the small slot.
    const bars = fallFrame(episodes.map((e) => ({ id: e.current ? 'current' : e.peak, label: e.current ? '이번' : say('{m} 고점', { m: yearMonth(e.peak) }).text, part: e.current ? 'leaders' : 'broad', value: e.depth,
      valueText: say('{d}', { d: claim({ subject: row.id, measure: e.current ? 'fromLongrunHigh' : 'episodeDepth', asOf: row.asOf, figures: [{ value: e.depth, unit: 'pct', basis: 'episodeDepth', label: lab }] }) }).text,
      stage: Number.isFinite(e.sessions) ? say('{n}거래일', { n: String(e.sessions) }).text : null })));
    return { id: row.id, label: lab, asOf: row.asOf, rank, total, said: sayJoin([lead, edge], ''), episodes, bars };
  });
}

/**
 * The opening read at the S&P 500's last session close (or `through`).
 * @param {{history?: object[], macroHistory?: object|null, longrun?: object|null, through?: string|null}} input
 * @returns {{available: boolean, asOf?: string, rows?: object, lines?: Array<{id:'lede'|'diagnosis'|'watch'|'records', label:string, said:{text:string, claims:object[]}}>,
 *   bars?: {bars: object[], scale: number, marks: object[]}, diagnosis?: object|null, rebound?: object|null, korea?: object, table?: object[], standings?: object[], longrun?: boolean}}
 *   `lines`: the face's text — the lede, the diagnosis line (its label the state word), the rebound's conditions line (its
 *   label the rebound word; it ends with the stance), the one small record line. `rebound.checks.texts`: 시장 상태's rows for
 *   다음에 확인할 가격 조건; `rebound.stance`: what each stance costs in this state (the face's paragraph and the guide).
 */
export function buildMarketOpening({ history = [], macroHistory = null, longrun = null, through = null } = {}) {
  const asOf = through || usSessions(history).at(-1)?.date || null;
  if (!asOf) return { available: false };
  const rows = {};
  for (const spec of OPENING_INDEXES) {
    const row = openingRow(history, spec, spec.part === 'korea' ? null : asOf, longrun);
    if (row && (spec.part === 'korea' || row.asOf === asOf)) rows[spec.id] = row;
  }
  if (!rows.ndx || !rows.spx) return { available: false };
  const judged = macroHistory ? creditJudgement(macroHistory, asOf) : null;
  const breadthPoint = buildCloseSeries(history, 'breadth50', { through: asOf }).at(-1);
  const breadth = breadthPoint?.date === asOf ? readNumber(breadthPoint.value) : null;
  const diagnosis = diagnoseFall({ ndx: rows.ndx, rsp: rows.rsp, credit: judged && Number.isFinite(judged.hyBp) ? judged : null,
    growth: macroHistory ? growthAt(macroHistory, asOf) : null, breadth50: breadth });
  const leaders = [rows.sox, rows.ndx].filter(Boolean);
  // Inside a fall the rebound read (rebound.js) leads on a rebound; a failed one keeps the fall's lede.
  const rebound = reboundOf(rows);
  const reboundLede = rebound && rebound.state !== 'failed' ? reboundLedeSaid(leaders, rows, rebound) : NOTHING;
  const lede = reboundLede.text ? reboundLede : ledeSaid(leaders, rows.spx, diagnosis);
  const ledeSince = leaders.find((row) => row.deep?.inRange && lede.text.includes(' 이후 가장 깊은 하락으로'));
  // The small record line: at most one standing per group, never the since the lede already carries.
  const leaderRecord = leaders.map((row) => standingSaid(row, { skipDeep: row === ledeSince })).find((piece) => piece.text) || NOTHING;
  // On a rebound the record line ends with how often rises this large came inside a fall (long-run tables only).
  const frequency = rebound && rebound.state !== 'failed' ? riseFrequencySaid(longrun, rows.ndx) : NOTHING;
  const records = sayJoin([leaderRecord, standingSaid(rows.spx, { prefer: 'week' }), frequency], ' ');
  if (rebound) Object.assign(rebound, { checks: reboundChecks(rebound, rows), stance: reboundStanceSaid(rebound) });
  const lines = [
    { id: 'lede', label: '', said: lede },
    { id: 'diagnosis', label: diagnosis && diagnosis.state !== 'none' ? diagnosis.word : '', said: diagnosisLineSaid(diagnosis, { ndx: rows.ndx, asOf, breadth }) },
    { id: 'watch', label: rebound?.word || '', said: rebound ? reboundLineSaid(rebound, rows, followThroughSaid(rebound, history, asOf), rebound.stance) : NOTHING },
    { id: 'records', label: '', said: records }
  ].filter((line) => line.said.text);
  const korea = rows.kospi ? sayJoin([indexSentence(rows.kospi), standingSaid(rows.kospi)], ' ') : NOTHING;
  // Every standing an index earns (the face shows at most one per group; the AI facts carry all of them).
  const standings = ['sox', 'ndx', 'spx', 'dow', 'rsp'].map((id) => standingSaid(rows[id], { prefer: id === 'spx' ? 'week' : 'fall' })).filter((piece) => piece.text);
  const table = OPENING_INDEXES.filter((spec) => rows[spec.id]).map((spec) => {
    const row = rows[spec.id];
    const cells = OPENING_MOVES.filter((n) => row.claims[n]).map((n) => say(n === 1 ? '하루 {m}' : '{n}거래일 {m}', { n: String(n), m: row.claims[n] }));
    return { id: spec.id, part: spec.part, said: say('{lab}, {d}: {cells}, {fall}', { lab: spec.full || row.label, d: shortDate(row.asOf), cells: sayJoin(cells, ', '), fall: fallSaid(row, row.asOf) }) };
  });
  return { available: true, asOf, rows, lines, bars: barsOf(rows), diagnosis, rebound, korea, table, standings, longrun: !!longrun };
}

/** The opening as typed fact lines for an AI reading or the chat (the text the screens print, and the rule word). */
export function openingFactLines(opening) {
  if (!opening?.available) return [];
  const d = opening.diagnosis;
  const said = (id) => opening.lines.find((line) => line.id === id)?.said.text || '';
  return [
    said('lede') ? `요약: ${said('lede')}` : '',
    said('diagnosis') ? `진단: ${d.word} — ${said('diagnosis')}` : '',
    d && d.state !== 'none' ? `진단 상태어(규칙으로 정함, 바꾸지 말 것): ${d.word}` : '',
    // The rebound state, its line and its conditions (not the follow-through day: it is counted on the Composite).
    said('watch') ? `반등: ${opening.rebound.word} — ${said('watch')}` : '',
    opening.rebound ? `반등 상태어(규칙으로 정함, 바꾸지 말 것): ${opening.rebound.word}` : '',
    ...(opening.rebound?.checks?.said || []).map((piece) => `반등 확인 조건: ${piece.text}`),
    opening.rebound ? `반등 대응(조건부, 지시 아님): ${opening.rebound.stance.text}` : '',
    opening.korea?.text ? `한국: ${opening.korea.text}` : '',
    ...opening.standings.map((piece) => `기록 비교: ${piece.text}`),
    ...opening.table.map((row) => `지수 낙폭: ${row.said.text}`)
  ].filter(Boolean);
}
