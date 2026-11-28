// 시장 폭's opening: how many S&P 500 members are in the fall and how deep. The population is the S&P 500 members (the
// published index holdings, screener metadata.indexWeights) with a screener close on the session the page reads — the same
// population as the tab's breadth lines. From each member's fall from its 52-week closing high: the share at or past
// -10 / -20 / -30 / -50% (nested, so each share is at most the one before), the median, the same shares by sector, and the
// S&P 500 and equal weight on the same 52-week basis (history.json closes). One rule state: 지수 속 약세장 — the index
// within 1% of its high while 80% or more of the members are 10% or more under theirs (2110778022131306528,
// 2109817302199722402). The opening line's figures are claims; the bars reuse the opening's frame.
import { RULES } from '../../rules/thresholds.js';
import { readRowNumber } from '../../../data/contracts/screener.js';
import { median } from '../../themes/theme-medians.js';
import { claim, say, sayJoin, NOTHING } from '../../shared/claim.js';
import { EVIDENCE_FULL } from '../../shared/evidence-strength.js';
import { buildCloseSeries } from '../session/close-series.js';
import { fallFrame, stageOf } from '../story/fall-frame.js';

export const FALL_DEPTHS = Object.freeze([10, 20, 30, 50]);
export const STOCK_FALL_RULES = Object.freeze({ maskedIndexWithinPct: 1, maskedMemberShare: 80 });
export const STOCK_FALL_WORDS = Object.freeze({ masked: '지수 속 약세장' });

// "n 중 하나" words for a share (the nearest whole n, 2 to 10); a share outside that range prints as a number.
const ONE_IN = Object.freeze({ 2: '절반', 3: '셋 중 하나꼴', 4: '넷 중 하나꼴', 5: '다섯 중 하나꼴', 6: '여섯 중 하나꼴', 7: '일곱 중 하나꼴', 8: '여덟 중 하나꼴', 9: '아홉 중 하나꼴', 10: '열 중 하나꼴' });
export const oneInWord = (share) => (share > 0 ? ONE_IN[Math.round(100 / share)] || null : null);

/** The convention of the line, for the screen's method fold. */
export const STOCK_FALLS_METHOD = `첫 막대: S&P 500 구성 종목(공개된 지수 보유 종목) 가운데 같은 종가가 있는 종목의 52주 종가 고점 대비 하락입니다. 구간 비율의 분모는 그 종목 수이고 -${FALL_DEPTHS.join('% / -')}% 이하 비율은 서로 포함 관계입니다. '절반이 N% 넘게'는 중앙값(소수점 아래 버림), '반 토막'은 -${RULES.story.halfOffPct}% 이하, 'n 중 하나꼴'은 그 비율에 가장 가까운 1/n(2~10, 그 밖은 비율 그대로)입니다. '지수'는 S&P 500의 같은 52주 종가 고점 대비 하락이고, 조정(-${RULES.story.correctionPct}%)·약세장(-${RULES.story.bearPct}%) 낱말은 시장 해석과 같은 관례입니다. 지수가 고점 ${STOCK_FALL_RULES.maskedIndexWithinPct}% 안인데 구성 종목 ${STOCK_FALL_RULES.maskedMemberShare}% 이상이 -10% 이하이면 '${STOCK_FALL_WORDS.masked}'입니다. 잰 종목이 ${EVIDENCE_FULL}개 미만이면 쓰지 않습니다.`;

/** The members of a screener metadata.indexWeights block as [{ sym, sector }] (dots in a ticker read as dashes). */
export function indexMembers(indexWeights) {
  const columns = Array.isArray(indexWeights?.columns) ? indexWeights.columns : [];
  const at = (name) => columns.indexOf(name);
  return (Array.isArray(indexWeights?.rows) ? indexWeights.rows : []).map((row) => (Array.isArray(row) ? { sym: row[at('sym')], sector: row[at('sector')] ?? null } : { sym: row?.sym, sector: row?.sector ?? null }))
    .filter((row) => row.sym).map((row) => ({ sym: String(row.sym).replace('.', '-'), sector: row.sector || null }));
}

/** An index's fall from its 52-week closing high (RULES.technical.rangeSessions closes through `through`), the screener's basis. */
function yearFall(history, field, through) {
  const series = buildCloseSeries(history, field, { through }).filter((point) => Number(point.value) > 0);
  const last = series.at(-1);
  if (!last || last.date !== through || series.length < RULES.technical.fullYearSessions) return null;
  const high = Math.max(...series.slice(-RULES.technical.rangeSessions).map((point) => Number(point.value)));
  return (Number(last.value) / high - 1) * 100;
}

const depthShares = (values) => FALL_DEPTHS.map((at) => { const count = values.filter((value) => value <= -at).length; return { at, count, share: count / values.length * 100 }; });

/**
 * @param {{rows?: object[], members?: Array<{sym:string, sector?:string}>, history?: object[], session?: string|null}} input
 *   `members`: indexMembers(screener metadata.indexWeights); `session` is the US close the page reads.
 * @returns {null | {asOf, measured, members, median, depths, bins, sectors, halfOff, share, spx, rsp, state, word, said, bars}}
 *   null without members or under EVIDENCE_FULL measured members.
 */
export function stockFalls({ rows = [], members = [], history = [], session = null } = {}) {
  if (!session || !members.length) return null;
  const sectorOf = new Map(members.map((row) => [row.sym, row.sector]));
  const measured = (Array.isArray(rows) ? rows : []).filter((row) => sectorOf.has(String(row?.sym || '').replace('.', '-')) && row.factorSessionDate === session)
    .map((row) => ({ sector: sectorOf.get(String(row.sym).replace('.', '-')), value: readRowNumber(row, 'pctFromCloseHigh52w', 'calculation') })).filter((row) => Number.isFinite(row.value));
  const values = measured.map((row) => row.value);
  if (values.length < EVIDENCE_FULL) return null;
  const S = RULES.story;
  const mid = median(values);
  const depths = depthShares(values);
  // The exclusive bins between the depths, for the one stacked bar (shallowest first).
  const edges = [0, ...FALL_DEPTHS];
  const bins = edges.map((at, i) => ({ from: at, to: edges[i + 1] ?? null, count: values.filter((value) => (i === 0 || value <= -at) && (edges[i + 1] == null || value > -edges[i + 1])).length }));
  const bySector = new Map();
  for (const row of measured) { if (!row.sector) continue; if (!bySector.has(row.sector)) bySector.set(row.sector, []); bySector.get(row.sector).push(row.value); }
  const sectors = [...bySector].map(([sector, list]) => ({ sector, n: list.length, depths: depthShares(list) })).sort((a, b) => b.depths[1].share - a.depths[1].share || b.n - a.n);
  const halfOff = values.filter((value) => value <= -S.halfOffPct).length;
  const share = halfOff / values.length * 100;
  const spx = yearFall(history, 'spx', session), rsp = yearFall(history, 'rsp', session);
  const R = STOCK_FALL_RULES;
  const state = Number.isFinite(spx) && spx > -R.maskedIndexWithinPct && depths[0].share >= R.maskedMemberShare ? 'masked' : null;
  const stocks = (measure, value, unit, label) => claim({ subject: 'sp500-members', measure, asOf: session, figures: [{ value, unit, basis: measure, label }] });
  // "절반이 21% 넘게": the median's depth floored, so 넘게 holds on the printed number.
  const depth = stocks('medianFromHigh52wFloor', Math.floor(-mid), 'share', '1년 고점에서');
  const word = oneInWord(share);
  const half = !halfOff ? say('반 토막 난 종목은 없습니다.')
    : word ? say('{w}은 반 토막입니다.', { w: word })
      : say('{s}는 반 토막입니다.', { s: stocks('halfOffShare', share, 'share', '반 토막') });
  const stage = Number.isFinite(spx) ? stageOf(spx) : null;
  const index = Number.isFinite(spx) ? claim({ subject: 'spx', measure: 'fromHigh52w', word: stage?.word || 'pre-correction', asOf: session,
    compare: { threshold: stage?.threshold ?? -S.correctionPct, relation: stage?.relation || 'above', digits: 0 }, figures: [{ value: spx, unit: 'pct', basis: 'fromHigh52w', label: 'S&P 500' }] }) : null;
  const first = !index ? NOTHING : mid < spx
    ? say(stage ? '지수는 {i.word}이지만 종목은 더 깊습니다.' : '지수는 아직 {i.word}이지만 종목은 더 깊습니다.', { i: index })
    : say('종목은 지수보다 덜 내렸습니다.');
  const said = sayJoin([first, say('S&P 500 구성 종목 절반이 {d.label} {d} 넘게 내렸고, {half}', { d: depth, half })], ' ');
  const bar = (id, label, value, part) => ({ id, label, part, value, valueText: say('{v}', { v: claim({ subject: id, measure: 'fromHigh52w', asOf: session, figures: [{ value, unit: 'pct', basis: 'fromHigh52w', label }] }) }).text,
    stage: stageOf(value) ? say('{w.word}', { w: claim({ subject: id, measure: 'fromHigh52w', word: stageOf(value).word, asOf: session }) }).text : null });
  const bars = fallFrame([Number.isFinite(spx) ? bar('spx', 'S&P 500', spx, 'broad') : null, Number.isFinite(rsp) ? bar('rsp', '동일가중', rsp, 'broad') : null,
    bar('sp500-members', '구성 종목 중앙값', mid, 'leaders')].filter(Boolean));
  return { asOf: session, measured: values.length, members: members.length, median: mid, depths, bins, sectors, halfOff, share, spx, rsp, state, word: state ? STOCK_FALL_WORDS[state] : null, said, bars };
}
