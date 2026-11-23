import { median, themeMedians } from './theme-medians.js';
import { screenerMarket } from '../screener/market-scope.js';
import { latestCompletedSession } from '../market/session/market-calendar.js';
import { recentMove, weeklyNoiseFromVol } from './recent-check.js';
import { signedText, readNumber as finite } from '../shared/number.js';
import { latestSessionRows } from '../shared/session-date.js';
import { readRowNumber } from '../../data/contracts/screener.js';

const value = (row, key) => readRowNumber(row, key);

export const GROUP_STRENGTH_MODEL_VERSION = 'theme-group-strength.v1';
export const GROUP_WINDOWS = Object.freeze({ ret1d: '1일', ret5d: '1주', ret10d: '2주', ret1m: '1개월', ret3m: '3개월', ret6m: '6개월' });
export const STRENGTH_TABS = Object.freeze(['ret1d', 'ret5d', 'ret1m', 'ret3m']);
export const MIN_GROUP_MEMBERS = 3;
export const HEADLINE_MIN_MEMBERS = 4;

export { median };
const GROUP_FIELDS = Object.freeze(['ret1m', 'ret3m', 'ret6m', 'ret1d', 'ret5d', 'ret10d', 'vol']);

export const HEAVYWEIGHT_COUNT = 3;
export function heavyweightsOf(members) {
  const sized = members.filter((row) => value(row, 'dollarVolume30d') != null && value(row, 'ret1m') != null);
  // Six or more members: with fewer, three names are most of the group and say nothing apart from its median.
  if (members.length < HEAVYWEIGHT_COUNT * 2 || sized.length !== members.length) return null;
  return [...sized].sort((a, b) => finite(b.dollarVolume30d) - finite(a.dollarVolume30d)).slice(0, HEAVYWEIGHT_COUNT)
    .map((row) => ({ sym: String(row.sym).toUpperCase(), name: row.name || '', ret1m: value(row, 'ret1m') }));
}

/** One line when the largest-traded members moved apart from the group median (5%p or more over 1 month); else ''. */
export function heavyweightLine(group, nameOf = (member) => member.name || member.sym) {
  const heavy = group?.heavyweights;
  if (!heavy?.length || group.ret1m == null) return '';
  const middle = median(heavy.map((member) => member.ret1m));
  if (middle == null || Math.abs(middle - group.ret1m) < 5) return '';
  const pct = (value) => `${signedText(value, 1)}%`;
  const opposite = Math.sign(middle) !== Math.sign(group.ret1m);
  return `거래대금 상위 ${heavy.length}종목의 1개월 수익률 중앙값은 ${pct(middle)}(${heavy.map((member) => `${nameOf(member)} ${pct(member.ret1m)}`).join(', ')})로, 동일가중 테마 중앙값 ${pct(group.ret1m)}${opposite ? '와 방향이 반대입니다' : `보다 훨씬 ${middle < group.ret1m ? '약합니다' : '강합니다'}`} — 거래대금이 큰 종목의 움직임이 중앙값에 가려져 있습니다.`;
}

function rankBy(groups, key) {
  // E07: only groups on the market's latest completed session compete; an older group stays as a dated reference.
  const ranked = groups.filter((group) => group[key] != null && group.current !== false && !group.smallSample).sort((a, b) => b[key] - a[key]);
  const ranks = new Map();
  ranked.forEach((group, index) => ranks.set(group.id, index + 1));
  return ranks;
}

/**
 * @param {{ themes: Array, rows: Array<{sym:string,name?:string,ret1m?:number,ret3m?:number,ret6m?:number,pctSma50?:number}>, sortKey?: 'ret1m'|'ret3m'|'ret6m', benchmark?: {ret1m?:number,ret3m?:number,ret6m?:number} }} input
 */
export const DIRECTION_LABELS = Object.freeze({ improving: '최근 강해짐', steady: '큰 변화 없음', weakening: '최근 식음' });
export function directionLabel(group, { short = false } = {}) {
  if (group?.direction === 'improving' && group.recent?.broken) return short ? '1주 급락' : '순위 올랐지만 1주 급락';
  if (group?.direction === 'weakening' && group.recent?.surged) return short ? '1주 급반등' : '순위 밀렸지만 1주 급반등';
  if (group?.direction === 'weakening' && group.recent?.move > 0) return short ? '1주 반등' : '순위 밀렸지만 1주 반등';
  return DIRECTION_LABELS[group?.direction] || '';
}

export function buildGroupStrength({ themes = [], rows = [], sortKey = 'ret3m', benchmark = {}, market = 'US', now = null } = {}) {
  const key = GROUP_WINDOWS[sortKey] ? sortKey : 'ret3m';
  const bySymbol = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  const groups = [];
  const excluded = [];
  for (const theme of Array.isArray(themes) ? themes : []) {
    for (const sub of Array.isArray(theme?.subThemes) ? theme.subThemes : []) {
      const tickers = [...new Set((sub?.tickers || []).map((sym) => String(sym).toUpperCase()))].filter(sym => screenerMarket(bySymbol.get(sym) || { sym }) === market);
      if (!tickers.length) continue;
      const stale = (row) => row?.factorQuality?.stale === true || String(row?.factorQuality?.status || '').toUpperCase() === 'STALE';
      const members = tickers.map((sym) => bySymbol.get(sym)).filter((row) => row && !stale(row) && value(row, key) != null);
      const id = `${theme.id}:${sub.name}`;
      if (members.length < MIN_GROUP_MEMBERS) { excluded.push({ id, themeName: theme.nameKr, name: sub.name, members: members.length, listed: tickers.length, constituents: tickers }); continue; }
      const above = members.filter((row) => value(row, 'pctSma50') != null);
      const leader = [...members].sort((a, b) => finite(b[key]) - finite(a[key]))[0];
      const dates = [...new Set(members.map((row) => row.factorSessionDate).filter(Boolean))];
      const comparisonAligned = dates.length === 1 && members.every((row) => row.factorSessionDate === dates[0]);
      const memberSet = new Set(members.map((row) => String(row.sym).toUpperCase()));
      const rankedMembers = tickers.map((sym) => {
        const row = bySymbol.get(sym);
        return { sym, name: row?.name || '', ret1d: value(row, 'ret1d'), ret5d: value(row, 'ret5d'), ret10d: value(row, 'ret10d'), ret1m: value(row, 'ret1m'), ret3m: value(row, 'ret3m'), ret6m: value(row, 'ret6m'), pctSma50: value(row, 'pctSma50'), basis: row?.factorSessionDate || null, included: memberSet.has(sym) };
      }).sort((a, b) => (a.included !== b.included ? (a.included ? -1 : 1) : a[key] == null ? (b[key] == null ? 0 : 1) : b[key] == null ? -1 : b[key] - a[key]));
      let rank = null, previousValue = null;
      rankedMembers.forEach((member, index) => {
        if (member.included && member[key] != null) { if (previousValue !== member[key]) rank = index + 1; previousValue = member[key]; }
        member.rank = !member.included || member[key] == null || !comparisonAligned ? null : rank;
        member.vsBenchmark = member.included && member[key] != null && member.basis && member.basis === benchmark.asOf && finite(benchmark?.[key]) != null ? member[key] - finite(benchmark[key]) : null;
      });
      groups.push({
        id, themeId: theme.id, themeName: theme.nameKr, name: sub.name,
        members: members.length, listed: tickers.length, smallSample: members.length < HEADLINE_MIN_MEMBERS,
        constituents: tickers.map((sym) => ({ sym, name: bySymbol.get(sym)?.name || '', included: members.some((row) => String(row.sym).toUpperCase() === sym) })),
        rankedMembers, comparisonAligned, basis: comparisonAligned ? dates[0] : null,
        ...(comparisonAligned ? themeMedians(members, GROUP_FIELDS, { read: value }) : Object.fromEntries(GROUP_FIELDS.map((field) => [field, null]))),
        above50Pct: above.length ? Math.round(above.filter((row) => value(row, 'pctSma50') > 0).length / above.length * 100) : null,
        leader: comparisonAligned && leader ? { sym: String(leader.sym).toUpperCase(), name: leader.name || '', value: finite(leader[key]) } : null,
        heavyweights: comparisonAligned ? heavyweightsOf(members) : null,
        memberStats: comparisonAligned ? members.map((row) => ({ sym: String(row.sym).toUpperCase(), ret1m: value(row, 'ret1m'), ret3m: value(row, 'ret3m'), ret6m: value(row, 'ret6m'), ret5d: value(row, 'ret5d'), vol: value(row, 'vol'), pctSma50: value(row, 'pctSma50') })) : null
      });
    }
  }
  const latestBasis = groups.map((group) => group.basis).filter(Boolean).sort().at(-1) || null;
  const expectedSession = Number.isFinite(Number(now)) && now != null
    ? latestCompletedSession(market, Number(now))?.date || null
    : null;
  for (const group of groups) group.current = !!group.basis && group.basis === latestBasis && (!expectedSession || group.basis === expectedSession);
  const rank1m = rankBy(groups, 'ret1m');
  const rank3m = rankBy(groups, 'ret3m');
  const rankSort = rankBy(groups, key);
  const total = groups.length;
  const bench = finite(benchmark?.[key]);
  const out = groups.map((group) => {
    const r1 = rank1m.get(group.id) ?? null;
    const r3 = rank3m.get(group.id) ?? null;
    // Direction: a 1-month rank clearly better (lower) than the 3-month rank is improving momentum.
    const shift = r1 != null && r3 != null ? r3 - r1 : null;
    const band = Math.max(3, Math.round(Math.min(rank1m.size, rank3m.size) * 0.15));
    const direction = shift == null ? null : shift >= band ? 'improving' : shift <= -band ? 'weakening' : 'steady';
    const recent = recentMove({ ret5d: group.ret5d, benchRet5d: group.basis && group.basis === benchmark.asOf ? finite(benchmark?.ret5d) : null, noise: weeklyNoiseFromVol(group.vol, { members: group.members }) });
    return { ...group, recent, rank: rankSort.get(group.id) ?? null, rank1m: r1, rank3m: r3, direction, vsBenchmark: group.basis && group.basis === benchmark.asOf && group[key] != null && bench != null ? group[key] - bench : null };
  }).sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || (a.smallSample === b.smallSample ? (b[key] ?? -1e9) - (a[key] ?? -1e9) : a.smallSample ? 1 : -1));
  const themeSummary = {};
  const staleRow = (row) => row?.factorQuality?.stale === true || String(row?.factorQuality?.status || '').toUpperCase() === 'STALE';
  for (const theme of Array.isArray(themes) ? themes : []) {
    const tickers = [...new Set((theme?.subThemes || []).flatMap((sub) => sub?.tickers || []).map((sym) => String(sym).toUpperCase()))].filter(sym => screenerMarket(bySymbol.get(sym) || { sym }) === market);
    const measured = tickers.map((sym) => bySymbol.get(sym)).filter((row) => row && value(row, key) != null);
    const { basis, rows: members } = latestSessionRows(measured.filter((row) => !staleRow(row)));
    themeSummary[theme.id] = { id: theme.id, name: theme.nameKr, members: members.length, excluded: measured.length - members.length, basis, value: members.length >= MIN_GROUP_MEMBERS ? median(members.map((row) => value(row, key))) : null };
  }
  return { model: GROUP_STRENGTH_MODEL_VERSION, market, sortKey: key, windowLabel: GROUP_WINDOWS[key], total, benchmark: bench, groups: out, excluded, themes: themeSummary, latestBasis, expectedSession, sessionCurrent: expectedSession ? latestBasis === expectedSession : null };
}
