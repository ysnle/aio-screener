// v59.55 (owner 11/1, "결과만 보여주고 있어"): 시장 상태's opening read — what moved over the last week of US sessions, which
// reports moved it, whether rates, credit, oil, gold and Korea confirm the same story, and what in the coming week would
// change it. Every sentence is chosen by a rule over the closes (history.json), FRED (macro-history.json), the earnings
// briefs (event-briefs.json) and the earnings calendar; nothing here names a date, a company or a level by hand except
// SCHEDULED_EVENTS.
import { MOVER_BY_SYMBOL } from '../briefing/market-movers.js';
import { readNumber } from '../shared/number.js';
import { RULES } from '../rules/thresholds.js';
import { SCHEDULED_EVENTS as REGISTRY } from '../briefing/scheduled-events.js';
import { indexLevels, levelValue, levelsRead } from './index-levels.js';
import { historyFieldMeta } from './history-meta.js';
import { buildCloseSeries, closeSessionMarket } from './close-series.js';
import { MARKET_WINDOWS } from './market-windows.js';
import { oasDelta20Bp } from '../briefing/market-read.js';

// v59.70 (owner 11/4): one week, the same window as the verdict table's 5거래일 전 / 5일 변화 columns. The bars, the lead
// sentence and every badge below read STORY_SESSIONS; the move thresholds are sized to that window (they were set for 15).
export const STORY_SESSIONS = MARKET_WINDOWS.week;
export const STORY_RULE = Object.freeze({
  flatPct: 1, leaderMovePct: 2, leaderGapPct: 2, // concentration: |move| under flatPct is flat; NDX ±leaderMovePct with RSP leaderGapPct apart is narrow
  cccTailBp: 25, oilPct: 5, goldPct: 3, koreaSemisPct: 3 // weak CCC tail, oil and gold moves, KOSPI tracking SOXX (the leadership proxy, v59.70)
});

// Dated events no collected calendar carries. v59.62: read from the one registry (briefing/scheduled-events.js); this
// file kept its own copy of the midterm, so a moved or added date had to be written twice.
export const SCHEDULED_EVENTS = Object.freeze(REGISTRY.filter((event) => event.marketDate && event.storyWhy)
  .map((event) => Object.freeze({ date: event.marketDate, title: event.storyTitle || event.label, why: event.storyWhy })));

const NON_AI_LAYERS = new Set(['ai-adopter', 'ai-exposed', 'limited']);
const REPORT_WEIGHT_MIN = 1; // % of the S&P 500 — a smaller report outside the mover list does not change the week's read
// v59.74 (weekly outlook review 11/7): a week with no report at 1% left the list empty while CSCO 0.64% and AMAT 0.46%
// reported; the two heaviest at this floor fill an empty week (Moderna 0.1% stays out, v59.70).
const REPORT_WEIGHT_FALLBACK = 0.3;
// v59.74: the biggest single session of the window is named when the S&P 500 moved at least this much (11/5 -4.4% was
// missing from a lead that read only the five-session totals), and a session with this small a share of advancing
// members is named as a broad sell-off even when the week's equal-weight total stayed small.
const BIG_DAY_PCT = 2;
const BROAD_SELL_ADVANCE = 0.25;
const DAYS = ['일', '월', '화', '수', '목', '금', '토'];
const SESSION_WORDS = Object.freeze({ bmo: '장 전', amc: '장 마감 후', dmh: '장중' });

const weekday = (date) => { const day = new Date(`${date}T12:00:00Z`).getUTCDay(); return day >= 1 && day <= 5; };
export function dayLabel(date) {
  const [, m, d] = String(date || '').split('-').map(Number);
  return m && d ? `${m}/${d}(${DAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]})` : '';
}
const pctText = (value, digits = 1) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
const bpText = (value) => `${value > 0 ? '+' : ''}${Math.round(value)}bp`;

// The US sessions: weekday rows with an S&P 500 close (weekend rows carry Friday forward). Feature audit 2026-11-02: a
// weekday row written before that day's close carries the prior close (fieldMeta.spx.sessionDate is the earlier day),
// so it is not a session — counting it made "10/12 → 11/2, 15거래일" out of the 14 sessions 10/12 → 10/30.
function usSessions(history) {
  return (Array.isArray(history) ? history : []).filter((row) => row?.date && weekday(row.date) && readNumber(row.spx) !== null
    && (!historyFieldMeta(row, 'spx')?.sessionDate || historyFieldMeta(row, 'spx').sessionDate === row.date));
}

// A field's close on `from` (else the nearest earlier close) and its latest close on or before `to`.
// v59.70: read from the session-keyed close series (buildCloseSeries), as the verdict table's 5일 변화 is. The row dates
// carry a prior close forward (the 11/2 row held the 10/30 Nasdaq-100 and WTI), so a row-date read printed NDX -3.0% and
// WTI +0.8% for the week the table measured at -4.4% and -6.6%.
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

// The ten-year move split into the real yield and breakeven inflation (FRED DFII10 + T10YIE ≈ DGS10).
// v59.70 (screen review 6): the 10-year line is the market close series every other screen reads (history tnx, the
// 5거래일 column of the verdict table); the FRED legs only split it into real yield and inflation expectations.
function ratesOf(macroHistory, history, from, to) {
  const fred = macroSpan(macroHistory, 'dgs10', from, to);
  const market = span(history, 'tnx', from, to);
  const ten = market ? { ...market, bp: (market.to - market.from) * 100 } : fred;
  const real = macroSpan(macroHistory, 'realYield10', from, to);
  const be = macroSpan(macroHistory, 'breakeven10', from, to);
  if (!ten || !fred || !real || !be) return null;
  const d = fred.bp;
  let kind = 'flat';
  if (Math.abs(d) >= 10) {
    const realShare = real.bp / d; const beShare = be.bp / d;
    if (d < 0) kind = realShare >= 0.6 ? 'growth-fear' : beShare >= 0.6 ? 'inflation-relief' : 'mixed';
    else kind = realShare >= 0.6 ? 'real-up' : beShare >= 0.6 ? 'inflation-fear' : 'mixed';
  }
  return { ten, real, be, kind };
}

// v59.70 (screen review 5): the week's spread change is the five-session OAS reading of oasDelta20Bp — the same
// observations, dates and session filter as the verdict table and 매크로 — not a calendar span cut at the stock dates.
function oasWeek(macroHistory, id, from, to, sessions) {
  const read = sessions === 5 ? oasDelta20Bp(macroHistory, id, to) : null;
  if (!read || read.d5 == null) return macroSpan(macroHistory, id, from, to);
  return { from: read.level - read.d5 / 100, to: read.level, toDate: read.date, bp: read.d5 };
}

function creditOf(macroHistory, from, to, sessions) {
  const hy = oasWeek(macroHistory, 'hyOas', from, to, sessions);
  if (!hy) return null;
  const ccc = oasWeek(macroHistory, 'cccOas', from, to, sessions);
  // v59.66: one widening line for every screen — +33bp read as '신용 불안은 아닙니다' here while 매크로 called it 경계 쪽.
  // v59.70: the five-session lines of the credit axis (RULES.credit.widen5dBp / widenWatch5dBp), matching the week of the table.
  const C = RULES.credit;
  const kind = hy.bp >= C.widen5dBp || hy.to * 100 >= C.stressAtBp ? 'stress' : hy.bp >= C.widenWatch5dBp ? 'widening' : ccc && ccc.bp >= STORY_RULE.cccTailBp ? 'weak-tail' : 'calm';
  return { hy, ccc, kind };
}

const RATE_READ = Object.freeze({
  'growth-fear': '대부분 실질금리 하락이라 물가 안도보다 성장 걱정에 안전자산인 국채로 돈이 옮겨 간 쪽입니다',
  'inflation-relief': '대부분 기대인플레 하락이라 물가 안도 쪽입니다',
  'real-up': '대부분 실질금리 상승이라 긴축 부담 쪽입니다',
  'inflation-fear': '대부분 기대인플레 상승이라 물가 걱정 쪽입니다',
  mixed: '실질금리와 기대인플레가 함께 움직여 한쪽으로 읽기 어렵습니다',
  flat: '큰 변화가 없습니다'
});

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

// v59.74: the window's largest S&P 500 session, its Nasdaq-100 move, the share of advancing members and a fixed event
// (SCHEDULED_EVENTS) dated in the window before it. Order in time only — the event is not named as the cause.
export function biggestDay(history, { from, to, events = SCHEDULED_EVENTS } = {}) {
  const spx = buildCloseSeries(history, 'spx', { market: 'US' }).filter((p) => readNumber(p.value) !== null);
  const ndx = new Map(buildCloseSeries(history, 'ndx', { market: 'US' }).filter((p) => readNumber(p.value) !== null).map((p) => [p.date, Number(p.value)]));
  const ndxDates = [...ndx.keys()].sort();
  let best = null;
  for (let i = 1; i < spx.length; i++) {
    const day = spx[i]; const prev = spx[i - 1];
    if (day.date <= from || day.date > to) continue;
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

function lead({ n, moves, concentration, drivers, rates, credit, asOf = null, bigDay = null }) {
  const parts = [];
  const f = (id) => pctText(moves[id].pct);
  // v59.74: "시장 전체가 팔린 것은 아닙니다" stood beside a session where 15% of the members rose; that week the claim is
  // limited to the five-session total.
  const broadDay = bigDay && bigDay.pct < 0 && bigDay.advance !== null && bigDay.advance <= BROAD_SELL_ADVANCE;
  if (concentration.kind === 'narrow-down') parts.push(`최근 ${n}거래일 나스닥 100 ${f('ndx')}, 동일가중 S&P 500 ${f('rsp')}. ${broadDay ? '주간 합계로는 하락이 대형 기술주에 몰렸습니다.' : '하락은 대형 기술주에 몰렸고 시장 전체가 팔린 것은 아닙니다.'}`);
  else if (concentration.kind === 'narrow-up') parts.push(`최근 ${n}거래일 나스닥 100 ${f('ndx')}, 동일가중 S&P 500 ${f('rsp')}. 상승은 대형 기술주에 몰렸습니다.`);
  else if (concentration.kind === 'broad-down') parts.push(`최근 ${n}거래일 S&P 500 ${f('spx')}, 동일가중 ${f('rsp')}로 하락이 시장 전반에 퍼졌습니다.`);
  else if (concentration.kind === 'broad-up') parts.push(`최근 ${n}거래일 S&P 500 ${f('spx')}, 동일가중 ${f('rsp')}로 상승이 고르게 퍼졌습니다.`);
  else if (concentration.kind === 'flat') parts.push(`최근 ${n}거래일 S&P 500 ${f('spx')}, 나스닥 100 ${f('ndx')}로 뚜렷한 방향이 없었습니다.`);
  if (bigDay) parts.push(bigDayText(bigDay));
  if (drivers.length) parts.push(`실적 다음 날 ${drivers.map((row) => `${row.name} ${pctText(row.pct)}`).join(', ')}가 ${drivers[0].pct < 0 ? '하락' : '상승'}을 이끌었습니다.`);
  const tail = [];
  // v59.56 (screen review): the split comes from FRED, a session behind the closes; the span is named when it ends earlier.
  const tenSpan = rates && asOf && rates.ten.toDate < asOf ? `(${dayLabel(rates.ten.toDate).split('(')[0]}까지) ` : '';
  if (rates && rates.kind !== 'flat') tail.push(`10년 금리 ${tenSpan}${bpText(rates.ten.bp)}는 ${RATE_READ[rates.kind]}`);
  // v59.70: the ICE spreads post a business day behind the closes too; the span is named the same way.
  const hySpan = credit && asOf && credit.hy.toDate < asOf ? `(${dayLabel(credit.hy.toDate).split('(')[0]}까지) ` : '';
  if (credit) tail.push(credit.kind === 'stress' ? `하이일드 스프레드가 ${hySpan}${bpText(credit.hy.bp)} 벌어져 신용 쪽 경계가 필요합니다`
    : credit.kind === 'widening' ? `하이일드가 ${hySpan}${bpText(credit.hy.bp)} 벌어져 경계 쪽입니다`
      : credit.kind === 'weak-tail' ? `CCC 등급이 ${hySpan}먼저 벌어지는 중입니다`
        : `하이일드 스프레드는 ${hySpan}${bpText(credit.hy.bp)}로 신용 불안은 아닙니다`);
  if (tail.length) parts.push(`${tail.join('. ')}.`);
  return parts.join(' ');
}

// One line per asset: what it did and whether it agrees with the equity story.
function confirmations({ moves, rates, credit, macroHistory, history, asOf, start }) {
  const rows = [];
  if (rates) rows.push({ id: 'rates', label: '금리', value: `10년 ${rates.ten.from.toFixed(2)} → ${rates.ten.to.toFixed(2)}% (${bpText(rates.ten.bp)}) · 실질 ${bpText(rates.real.bp)} · 기대인플레 ${bpText(rates.be.bp)}`,
    read: `${RATE_READ[rates.kind]}.${moves.tlt ? ` 장기 국채는 ${pctText(moves.tlt.pct)}입니다.` : ''}` });
  if (credit) {
    const tail = credit.ccc ? ` · CCC ${bpText(credit.ccc.bp)}` : '';
    const read = credit.kind === 'stress' ? '스프레드가 크게 벌어졌습니다. 주가 조정이 신용 문제로 번질 수 있는 폭입니다.'
      : credit.kind === 'widening' ? '스프레드가 경계 쪽으로 벌어지고 있습니다. 아직 위기 수준은 아니지만, 더 벌어지면 주가 조정이 신용 문제로 번집니다.'
      : credit.kind === 'weak-tail' ? '전체 하이일드는 조용하지만 가장 약한 CCC 등급이 먼저 벌어지고 있습니다. 위기 신호가 오면 여기서 시작됩니다.'
        : '주가가 움직여도 스프레드가 넓어지지 않아 신용 문제는 아닙니다.';
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
    read: vix.to >= 30 ? '공포 구간입니다. 투매 뒤 되돌림이 자주 나오는 자리입니다.' : vix.to >= 20 ? '경계 구간입니다.' : vix.to - vix.from >= 3 ? '불안이 커졌지만 공포 구간은 아닙니다.' : '조용한 편입니다.' });
  return rows;
}

// What in the coming week would change the read: the collected next release, the heaviest reports and fixed events.
const releaseWhy = (event, story) => (event.id === 'us-nfp'
  ? (story.rates?.kind === 'growth-fear' ? '실업률이 오르면 금리 하락이 성장 걱정으로 굳고, 버티면 이번 하락은 업종 조정에 그칩니다.' : '고용이 식으면 금리 인하 기대가 커지고, 강하면 금리 부담이 다시 커집니다.')
  : /\b(?:cpi|pce)\b/.test(String(event.id)) ? '근원 물가가 다시 오르면 금리 인하 기대가 줄어듭니다.'
    : event.id === 'us-fed-rate' ? '금리 결정과 함께 앞으로의 경로 발언을 봅니다.'
      : event.id === 'us-retail' ? '소비가 버티는지, 성장 걱정이 소비로 번지는지 봅니다.' : '결과에 따라 지금 시나리오가 바뀔 수 있습니다.');

// v59.74 (weekly outlook review 11/7): every collected release in the window is listed (crossroads.events), not only the
// one that decides the tied branches — that rule skipped the 11/10 CPI for the 11/17 retail sales, which fell outside the
// eight days, and the list had no release at all. `storySymbols` (symbol → story label, from the market-day narratives)
// lets a report the stories are about onto the list whatever its index weight (CoreWeave, outside the S&P 500).
function weekAhead({ calendar, nextEvent, decidingEvent = null, events = [], storySymbols = null, story, nowMs, days = 8 }) {
  const out = [];
  const horizon = nowMs + days * 86400000;
  // v59.70 (screen review 9): an item belongs to the week ahead from the reader's own day — the KST date. A US event dated
  // 11/3 (the midterm vote) is over by 11/4 KST; the old 12-hour grace on a UTC day kept it at the top of '다음 주'.
  const kstToday = new Date(nowMs + 9 * 3600000).toISOString().slice(0, 10);
  const inside = (date) => { const ms = Date.parse(`${date}T23:59:00Z`); return Number.isFinite(ms) && String(date) >= kstToday && ms <= horizon; };
  for (const event of SCHEDULED_EVENTS) if (inside(event.date)) out.push({ kind: 'event', date: event.date, when: dayLabel(event.date), title: event.title, why: event.why });
  const releases = [...(Array.isArray(events) ? events : []), ...[nextEvent, decidingEvent].filter(Boolean)];
  const seenRelease = new Set();
  for (const event of releases) {
    if (!event?.date || !event.id || !inside(event.date) || seenRelease.has(`${event.id}|${event.date}`)) continue;
    seenRelease.add(`${event.id}|${event.date}`);
    const decides = decidingEvent && decidingEvent.id === event.id && decidingEvent.date === event.date;
    out.push({ kind: 'macro', date: event.date, when: event.when || dayLabel(event.date), title: event.name,
      why: `${releaseWhy(event, story)}${decides ? ' 지금 맞서는 시나리오를 가르는 발표입니다.' : ''}` });
  }
  const aiStory = story.concentration.kind === 'narrow-down' || story.concentration.kind === 'narrow-up';
  // v59.70 (step 3 screen audit): a quiet week listed Moderna 0.1% as "대형 기술주 쏠림이 이어질지 가르는 실적" — the line's
  // sentence followed the market's story, not the company, and any weight qualified. A report is on the list when its
  // index weight is at least REPORT_WEIGHT_MIN or it is on the market-mover list; the AI sentence needs a mover on the line.
  const pending = (Array.isArray(calendar?.earnings) ? calendar.earnings : [])
    .filter((row) => row?.symbol && row.date && readNumber(row.epsActual) === null && inside(row.date));
  const byWeight = (a, b) => (Number(b.indexWeight) || 0) - (Number(a.indexWeight) || 0);
  let reports = pending.filter((row) => Number(row.indexWeight) >= REPORT_WEIGHT_MIN || (MOVER_BY_SYMBOL[row.symbol] && Number(row.indexWeight) > 0)).sort(byWeight).slice(0, 3);
  if (!reports.length) reports = pending.filter((row) => Number(row.indexWeight) >= REPORT_WEIGHT_FALLBACK).sort(byWeight).slice(0, 2);
  const storyOf = (row) => (storySymbols instanceof Map ? storySymbols.get(row.symbol) : null);
  const storyReports = pending.filter((row) => storyOf(row) && !reports.includes(row)).slice(0, 2);
  // Reports in the same session are one line: "AAPL 7.7% · PLTR 0.7% 실적 (S&P 500 비중)" — each weight beside its name.
  const sessionsOf = new Map();
  for (const row of reports) {
    const key = `${row.date}|${row.hour || ''}`;
    if (!sessionsOf.has(key)) sessionsOf.set(key, []);
    sessionsOf.get(key).push(row);
  }
  const slotOf = (row) => ({ bmo: 0, dmh: 1, amc: 2 })[row.hour] ?? 1;
  const fallbackWeek = !reports.some((row) => Number(row.indexWeight) >= REPORT_WEIGHT_MIN || MOVER_BY_SYMBOL[row.symbol]);
  for (const rows of [...sessionsOf.values()].sort((a, b) => a[0].date.localeCompare(b[0].date) || slotOf(a[0]) - slotOf(b[0]))) {
    const { date, hour } = rows[0];
    // v59.56 (text review): one naming rule per line — Korean names only when every company on it has one, otherwise
    // tickers for all ('애플 · PLTR' mixed the two; no Korean name is guessed for a company outside the mover list).
    const allKo = rows.every((row) => MOVER_BY_SYMBOL[row.symbol]?.nameKo);
    const nameOf = (row) => (allKo ? MOVER_BY_SYMBOL[row.symbol].nameKo : row.symbol);
    out.push({ kind: 'earnings', date, slot: slotOf(rows[0]), when: `${dayLabel(date)}${SESSION_WORDS[hour] ? ` ${SESSION_WORDS[hour]}` : ''}`,
      names: rows.map(nameOf).join(' · '),
      title: `${rows.map((row) => `${nameOf(row)} ${Number(row.indexWeight).toFixed(1)}%`).join(' · ')} 실적 (S&P 500 비중)`,
      // v59.56 (screen review): two report days printed the same sentence; the later one says it continues the question.
      why: !(aiStory && rows.some((row) => MOVER_BY_SYMBOL[row.symbol]))
        ? (fallbackWeek ? '이 기간 S&P 500 실적 가운데 비중이 가장 커, 같은 업종의 가이던스 판단에 바로 쓰입니다.'
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
  // v59.70 (screen review): one day's reports in session order — 장 전 before 장 마감 후 (QCOM after the close was listed first).
  out.sort((a, b) => a.date.localeCompare(b.date) || (a.slot ?? 1) - (b.slot ?? 1));
  // v59.70 (owner 11/4): a daily item names its last observation — FRED's ICE spreads post a business day behind the closes.
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
  const rates = ratesOf(macroHistory, history, start, asOf);
  const credit = creditOf(macroHistory, start, asOf, sessions);
  const reported = earningsMovers(briefs, { from: start, to: asOf });
  const direction = Math.sign(moves.ndx.pct);
  const drivers = reported.filter((row) => row.core && !row.korea && Math.abs(row.pct) >= 3 && Math.sign(row.pct) === direction).slice(0, 3);
  const story = { available: true, asOf, start, sessions, concentration, rates, credit, moves };
  story.bars = MOVE_ROWS.filter(([id]) => moves[id]).map(([id, label, group]) => ({ id, label, group, pct: moves[id].pct, asOf: moves[id].toDate }));
  story.bigDay = biggestDay(history, { from: start, to: asOf });
  story.lead = lead({ n: sessions, moves, concentration, drivers, rates, credit, asOf, bigDay: story.bigDay });
  story.checks = confirmations({ moves, rates, credit, macroHistory, history, asOf, start });
  // The table: every index-moving core name, then the four largest other moves of 8% or more.
  story.earnings = [...reported.filter((row) => row.core).slice(0, 8),
    ...reported.filter((row) => !row.core && Math.abs(row.pct) >= 8).sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct)).slice(0, 4)];
  story.week = weekAhead({ calendar, nextEvent, decidingEvent, events, storySymbols, story, nowMs });
  // v59.62: where the indexes sit on their charts (index-levels.js) — distance from the high, the 50/200-day lines, the
  // support below and a double top at or through its neck. Not a cross-asset check, so it is its own block.
  const levels = indexLevels(history);
  story.levels = levels.length ? { rows: levels.map((level) => ({ id: level.field, label: level.label, value: levelValue(level).replace(`${level.label} `, '') })), read: levelsRead(levels) } : null;
  return story;
}
