import { screenerMarket } from '../screener/market-scope.js';
import { latestCompletedKrSession, latestCompletedUsSession } from '../market/market-calendar.js';
import { recentMove, weeklyNoiseFromVol } from './recent-check.js';
import { signedText, readNumber as finite } from '../shared/number.js';
import { latestSessionRows } from '../shared/session-date.js';
import { readRowNumber } from '../../data/contracts/screener.js';

// v59.46 boundary contract: member values are read through the screener readiness contract, not row[key].
const value = (row, key) => readRowNumber(row, key);
// P1417 (owner request 2026-10-03, open-source comparison): sub-theme relative strength. The
// reference (xang1234/stock-screener group rankings) averages per-stock 1-99 RS ratings built from
// fixed horizon weights (0.2/0.3/0.2/0.15/0.15). Those weights are a composite rating, which this
// screener does not publish (owner decision: evidence and state, no ungrounded grade). Instead a
// group is described by the MEDIAN return of its members over one chosen window, ranked against the
// other groups, with the S&P 500 return beside it. Direction compares the group's 1-month rank with
// its 3-month rank (the RRG idea of momentum against the longer trend) — no stored history needed.
// Members come from the curated THEME_MAP; a symbol without published returns is not counted.

export const GROUP_STRENGTH_MODEL_VERSION = 'theme-group-strength.v1';
export const GROUP_WINDOWS = Object.freeze({ ret5d: '1주', ret10d: '2주', ret1m: '1개월', ret3m: '3개월', ret6m: '6개월' });
// v58.78 (owner 2026-10-25): the ranking's period tabs are the short windows; 6개월 stays a valid key for other readers.
export const STRENGTH_TABS = Object.freeze(['ret5d', 'ret1m', 'ret3m']);
export const MIN_GROUP_MEMBERS = 3;
// v57.50 D15: a 3-stock median can swing on one name; such a group stays in the table as '표본 n종목 · 참고' but does
// not take a rank, so it never heads the order (1위) or closes it (최하위) in the lead sentence.
export const HEADLINE_MIN_MEMBERS = 4;


export function median(values) {
  const list = values.filter((value) => value != null).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
}

// P1723 (2026-10-13): an equal-weight median hid the two largest Korean semiconductor names falling (-12%, -18% over a
// month) under a +12.6% theme median. The three members with the largest 30-session average traded value (already in
// each row; no market-cap source is assumed) carry their own 1-month returns. Ranked only when every member has a
// traded value, so an unmeasured large name is never silently left out.
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
// v58.74 (audit): the 1-month vs 3-month rank label names the week when the week runs the other way — cybersecurity read
// '최근 식음' on a +11.3% week and 원전/독립발전 '최근 강해짐' on a -7.7% week.
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
      // P1623: period comparisons require one known completed-session basis.
      const dates = [...new Set(members.map((row) => row.factorSessionDate).filter(Boolean))];
      const comparisonAligned = dates.length === 1 && members.every((row) => row.factorSessionDate === dates[0]);
      // X05 (2026-10-13): members held out of the median (stale or unmeasured) stay listed but are not ranked —
      // an old 100% return must not become the group's internal No.1 while the median and leader exclude it.
      const memberSet = new Set(members.map((row) => String(row.sym).toUpperCase()));
      const rankedMembers = tickers.map((sym) => {
        const row = bySymbol.get(sym);
        return { sym, name: row?.name || '', ret5d: value(row, 'ret5d'), ret10d: value(row, 'ret10d'), ret1m: value(row, 'ret1m'), ret3m: value(row, 'ret3m'), ret6m: value(row, 'ret6m'), pctSma50: value(row, 'pctSma50'), basis: row?.factorSessionDate || null, included: memberSet.has(sym) };
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
        ret1m: comparisonAligned ? median(members.map((row) => value(row, 'ret1m'))) : null,
        ret3m: comparisonAligned ? median(members.map((row) => value(row, 'ret3m'))) : null,
        ret6m: comparisonAligned ? median(members.map((row) => value(row, 'ret6m'))) : null,
        // v57.81: the last five sessions and the members' typical volatility, so a 1-month verdict can be checked against
        // the week (src/domain/themes/recent-check.js). Same aligned-session rule as the windows above.
        ret5d: comparisonAligned ? median(members.map((row) => value(row, 'ret5d'))) : null,
        ret10d: comparisonAligned ? median(members.map((row) => value(row, 'ret10d'))) : null,
        vol: comparisonAligned ? median(members.map((row) => value(row, 'vol'))) : null,
        above50Pct: above.length ? Math.round(above.filter((row) => value(row, 'pctSma50') > 0).length / above.length * 100) : null,
        leader: comparisonAligned && leader ? { sym: String(leader.sym).toUpperCase(), name: leader.name || '', value: finite(leader[key]) } : null,
        heavyweights: comparisonAligned ? heavyweightsOf(members) : null,
        // v58.74 (audit): a theme row pools its members instead of taking the median of group medians — a 6-name
        // nuclear group set the whole 39-name utilities theme to 3m -21.4% / 50일선 위 17% (members: -10.6% / 44%).
        memberStats: comparisonAligned ? members.map((row) => ({ sym: String(row.sym).toUpperCase(), ret1m: value(row, 'ret1m'), ret3m: value(row, 'ret3m'), ret6m: value(row, 'ret6m'), ret5d: value(row, 'ret5d'), vol: value(row, 'vol'), pctSma50: value(row, 'pctSma50') })) : null
      });
    }
  }
  const latestBasis = groups.map((group) => group.basis).filter(Boolean).sort().at(-1) || null;
  // X03 (2026-10-13): "current" meant only "the newest basis among the groups". With a clock it also has to be the
  // latest completed session of the market — a 10/9 ranking read on 10/13 is a dated reference, not today's leaders.
  const expectedSession = Number.isFinite(Number(now)) && now != null
    ? (market === 'KR' ? latestCompletedKrSession(Number(now))?.date : latestCompletedUsSession(Number(now), { requirePrevious: false })?.date) || null
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
    const band = Math.max(3, Math.round(total * 0.15));
    const direction = shift == null ? null : shift >= band ? 'improving' : shift <= -band ? 'weakening' : 'steady';
    // v57.81: the week against the group's own typical weekly move (benchmark-relative when the S&P 500 5-session
    // return is on the same close), so "1개월 순위 상승" is not read as "강해지는 중" during a sharp five-session drop.
    const recent = recentMove({ ret5d: group.ret5d, benchRet5d: group.basis && group.basis === benchmark.asOf ? finite(benchmark?.ret5d) : null, noise: weeklyNoiseFromVol(group.vol, { members: group.members }) });
    return { ...group, recent, rank: rankSort.get(group.id) ?? null, rank1m: r1, rank3m: r3, direction, vsBenchmark: group.basis && group.basis === benchmark.asOf && group[key] != null && bench != null ? group[key] - bench : null };
  }).sort((a, b) => (a.rank ?? 1e9) - (b.rank ?? 1e9) || (a.smallSample === b.smallSample ? (b[key] ?? -1e9) - (a[key] ?? -1e9) : a.smallSample ? 1 : -1));
  // Theme level (all sub-theme members once), used where a layer links to a whole theme.
  // Expert review M15: one member on another close (HUBB on 10/9 among 10/12 rows) used to blank the whole theme
  // (energy, industrials). A member that is stale, or on an older session than the theme's newest, is held out —
  // the same "one close" admission the S&P 500 map uses — and the count of held-out members travels with the value.
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
