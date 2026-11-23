// 시장 폭's opening line. The head
// said "중립 · 빠르게 악화"; a reader wants how many stocks are in the fall and how deep. From the screener rows (the
// observed US stocks, funds left out, on the close the page reads): the median fall from the 52-week closing high and the
// share of stocks at or past RULES.story.halfOffPct below it, set against the S&P 500 and equal weight on the same
// 52-week basis (history.json closes). One plain sentence pair, its figures claims; the bars reuse the opening's frame.
import { RULES } from '../../rules/thresholds.js';
import { readRowNumber } from '../../../data/contracts/screener.js';
import { median } from '../../themes/theme-medians.js';
import { claim, say, sayJoin, NOTHING } from '../../shared/claim.js';
import { EVIDENCE_FULL } from '../../shared/evidence-strength.js';
import { buildCloseSeries } from '../session/close-series.js';
import { fallFrame, stageOf } from '../story/fall-frame.js';

const isUsStock = (row) => row?.sym && !/\.K[SQ]$/i.test(String(row.sym)) && (row.market == null || row.market === 'US') && row.sector !== 'ETF';
// "n 중 하나" words for a share (the nearest whole n, 2 to 10); a share outside that range prints as a number.
const ONE_IN = Object.freeze({ 2: '절반', 3: '셋 중 하나꼴', 4: '넷 중 하나꼴', 5: '다섯 중 하나꼴', 6: '여섯 중 하나꼴', 7: '일곱 중 하나꼴', 8: '여덟 중 하나꼴', 9: '아홉 중 하나꼴', 10: '열 중 하나꼴' });
export const oneInWord = (share) => (share > 0 ? ONE_IN[Math.round(100 / share)] || null : null);

/** The convention of the line, for the screen's method fold. */
export const STOCK_FALLS_METHOD = `첫 문장: 스크리너가 보는 미국 종목(펀드 제외) 가운데 같은 종가가 있는 종목의 52주 종가 고점 대비 하락입니다. '절반이 N% 넘게'는 중앙값(소수점 아래 버림), '반 토막'은 -${RULES.story.halfOffPct}% 이하, 'n 중 하나꼴'은 그 비율에 가장 가까운 1/n(2~10, 그 밖은 비율 그대로)입니다. '지수'는 S&P 500의 같은 52주 종가 고점 대비 하락이고, 조정(-${RULES.story.correctionPct}%)·약세장(-${RULES.story.bearPct}%) 낱말은 시장 해석과 같은 관례입니다. 잰 종목이 ${EVIDENCE_FULL}개 미만이면 쓰지 않습니다.`;

/** An index's fall from its 52-week closing high (RULES.technical.rangeSessions closes through `through`), the screener's basis. */
function yearFall(history, field, through) {
  const series = buildCloseSeries(history, field, { through }).filter((point) => Number(point.value) > 0);
  const last = series.at(-1);
  if (!last || last.date !== through || series.length < RULES.technical.fullYearSessions) return null;
  const high = Math.max(...series.slice(-RULES.technical.rangeSessions).map((point) => Number(point.value)));
  return (Number(last.value) / high - 1) * 100;
}

/**
 * @param {{rows?: object[], history?: object[], session?: string|null}} input `session` is the US close the page reads.
 * @returns {null | {asOf, measured, median, halfOff, share, spx, rsp, said, bars}} null under EVIDENCE_FULL measured stocks.
 */
export function stockFalls({ rows = [], history = [], session = null } = {}) {
  if (!session) return null;
  const values = (Array.isArray(rows) ? rows : []).filter((row) => isUsStock(row) && row.factorSessionDate === session)
    .map((row) => readRowNumber(row, 'pctFromCloseHigh52w', 'calculation')).filter(Number.isFinite);
  if (values.length < EVIDENCE_FULL) return null;
  const S = RULES.story;
  const mid = median(values);
  const halfOff = values.filter((value) => value <= -S.halfOffPct).length;
  const share = halfOff / values.length * 100;
  const spx = yearFall(history, 'spx', session), rsp = yearFall(history, 'rsp', session);
  const stocks = (measure, value, unit, label) => claim({ subject: 'us-stocks', measure, asOf: session, figures: [{ value, unit, basis: measure, label }] });
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
  const said = sayJoin([first, say('관찰 중인 미국 종목 절반이 {d.label} {d} 넘게 내렸고, {half}', { d: depth, half })], ' ');
  const bar = (id, label, value, part) => ({ id, label, part, value, valueText: say('{v}', { v: claim({ subject: id, measure: 'fromHigh52w', asOf: session, figures: [{ value, unit: 'pct', basis: 'fromHigh52w', label }] }) }).text,
    stage: stageOf(value) ? say('{w.word}', { w: claim({ subject: id, measure: 'fromHigh52w', word: stageOf(value).word, asOf: session }) }).text : null });
  const bars = fallFrame([Number.isFinite(spx) ? bar('spx', 'S&P 500', spx, 'broad') : null, Number.isFinite(rsp) ? bar('rsp', '동일가중', rsp, 'broad') : null,
    bar('us-stocks', '종목 중앙값', mid, 'leaders')].filter(Boolean));
  return { asOf: session, measured: values.length, median: mid, halfOff, share, spx, rsp, said, bars };
}
