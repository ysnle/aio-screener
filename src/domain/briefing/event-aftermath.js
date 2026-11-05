// v59.70 (X bookmarks #6, #11): two readings under 주요 발표 요약.
//   eventAftermath — after a market-wide release (FOMC, a core mover's report), where money went over the next two or
//     three completed sessions: technology (Nasdaq 100) vs defensives (staples, utilities, health care) vs the broad
//     market (equal-weight S&P 500 and the Russell 2000), each against the S&P 500. Three outcomes: 기술로 복귀,
//     방어 지속, 전체 확산 — or no clear direction.
//   beatButFell — among recent reports that beat the EPS estimate, how many closed lower on the first session that could
//     trade on them, beside the same share for all reports ('호재 무반응').
// Both are context lines; neither feeds a verdict or a score.
import { buildCloseSeries, closeBasis } from '../market/close-series.js';
import { releaseSession } from './event-briefs.js';

export const AFTERMATH_RULE = Object.freeze({ sessions: 3, minSessions: 2, leadPp: 1 });
const GROUPS = Object.freeze([
  { id: 'tech', label: '기술', fields: ['ndx'] },
  { id: 'defensive', label: '방어 업종', fields: ['xlp', 'xlu', 'xlv'] },
  { id: 'broad', label: '동일가중·소형', fields: ['rsp', 'rut'] },
]);

const round1 = (value) => Math.round(value * 10) / 10;

/** Pure: the three relative flows after a release. `release` is { publishedAt, dateOnly, label }. */
export function eventAftermath(history = [], release = {}, rule = AFTERMATH_RULE) {
  const session = releaseSession(release.publishedAt, { dateOnly: !!release.dateOnly });
  if (!session) return null;
  const through = closeBasis(history);
  const spx = buildCloseSeries(history, 'spx', { through });
  // The base close is the last one before the market could trade on the release.
  const baseIndex = spx.findLastIndex((point) => (session.afterClose ? point.date <= session.releaseDate : point.date < session.releaseDate));
  if (baseIndex < 0) return null;
  const after = spx.slice(baseIndex + 1, baseIndex + 1 + rule.sessions);
  if (after.length < rule.minSessions) return null;
  const base = spx[baseIndex]; const end = after.at(-1);
  const move = (field) => {
    const series = buildCloseSeries(history, field, { through });
    const from = series.find((point) => point.date === base.date); const to = series.find((point) => point.date === end.date);
    return from && to ? (to.value / from.value - 1) * 100 : null;
  };
  const spxMove = (end.value / base.value - 1) * 100;
  const groups = GROUPS.map((group) => {
    const moves = group.fields.map(move).filter(Number.isFinite);
    if (moves.length !== group.fields.length) return null;
    const mean = moves.reduce((sum, value) => sum + value, 0) / moves.length;
    return { id: group.id, label: group.label, pct: round1(mean), relPp: round1(mean - spxMove) };
  });
  if (groups.some((group) => !group)) return null;
  const [tech, defensive, broad] = groups;
  const lead = [...groups].sort((a, b) => b.relPp - a.relPp)[0];
  // The broad market leading a falling S&P 500 is money leaving the large caps, not a broadening rally.
  const outcome = lead.relPp < rule.leadPp ? null : lead.id === 'tech' ? '기술로 복귀' : lead.id === 'defensive' ? '방어 지속' : broad.pct > 0 ? '전체 확산' : '대형주 밖으로 이동';
  const signed = (value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%p`;
  return {
    from: base.date, to: end.date, sessions: after.length, spx: round1(spxMove), groups, outcome,
    text: `${release.label ? `${release.label} 뒤` : '발표 뒤'} ${after.length}거래일, S&P 500 대비 기술 ${signed(tech.relPp)}, 방어 업종 ${signed(defensive.relPp)}, 동일가중·소형 ${signed(broad.relPp)} — ${outcome || '한쪽으로 쏠리지 않음'}.`,
  };
}

/** Pure: the share of EPS beats that closed lower on the first session after the report, beside the share for all reports. */
export function beatButFell(briefs = [], { minBeats = 8 } = {}) {
  const rows = (briefs || []).filter((brief) => brief?.kind !== 'fomc' && brief?.kind !== 'macro').map((brief) => {
    const figure = (brief.figures || []).find((item) => item?.metric === 'eps_diluted' && Number.isFinite(item?.estimate?.surprisePct));
    // The first full session that traded on the report — an after-hours print (basis 'latest-trade') is not a close.
    const reaction = brief?.reaction?.basis === 'latest-trade' ? null : brief?.reaction?.firstPct;
    return figure && Number.isFinite(reaction) ? { beat: figure.estimate.surprisePct > 0, fell: reaction < 0 } : null;
  }).filter(Boolean);
  const beats = rows.filter((row) => row.beat);
  if (beats.length < minBeats) return null;
  const fell = beats.filter((row) => row.fell).length;
  const allFell = rows.filter((row) => row.fell).length;
  const share = Math.round(fell / beats.length * 100); const base = Math.round(allFell / rows.length * 100);
  return {
    beats: beats.length, fell, share, reports: rows.length, allFell, base,
    text: `추정치를 넘긴 실적 ${beats.length}건 중 ${fell}건(${share}%)이 다음 거래일 하락, 전체 ${rows.length}건 중 ${allFell}건(${base}%).`,
  };
}
