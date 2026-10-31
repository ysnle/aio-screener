// v58.75 (persona review, teach-and-check A-3~6): what an expert checks before calling a theme strong, how this theme
// meets each check, the data-confirmed reasons behind its move, and the roles of its members (주도·후발·이탈). Pure
// functions over the playbook row, published screener rows, the consensus and earnings-calendar artifacts, the market
// regime and the crossroads registry. The result is a count of criteria met with the values behind it — never a
// probability, grade or instruction; a check whose data is missing stays null ('미확인').
import { finiteNumber as finite, signedText } from '../shared/number.js';
import { windFor, WIND_LABELS, EXPOSURE_TAGS } from './exposures.js';
import { ABOVE50_FLOOR } from './theme-playbook.js';
import { withDirectionParticle } from '../content/korean-particle.js';
import { isIsoDay, hasLeadingIsoDay } from '../shared/session-date.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { scenarioLead } from '../market/scenario-lead.js';

// v59.46 boundary contract: member numbers are read through the screener readiness contract, not row[key].
const value = (row, key) => readRowNumber(row, key, 'calculation');
const shown = (row, key) => readRowNumber(row, key, 'display');

export const THEME_CRITERIA_RULES = Object.freeze({
  extensionAtr: 5, // 50일선 거리 ÷ 하루 평균 변동폭(중앙값) — 이 배수 이상이면 과열
  weekSurgePct: 10, // 구성 종목 1주 수익률 중앙값 — 이 값 이상이면 단기 급등
  minMembers: 3, // 중앙값·전망 수를 세는 최소 종목 수
  nearHighPct: -15, // 주도주: 52주 고점에서 이 범위 안
  thinUsd: 20e6, // 30일 평균 거래대금(달러 환산)이 이보다 적으면 유동성 낮음
  macroMoves: Object.freeze({ tnx: 0.2, wti: 8, dxy: 2 }), // 20거래일 변화: 10년물 0.2%p, 유가 8%, 달러지수 2%
  macroSessions: 20
});
const R = THEME_CRITERIA_RULES;

const median = (values) => {
  const list = values.filter((value) => finite(value) != null).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
};
const pct = (value, digits = 1) => (finite(value) == null ? '—' : `${signedText(value, digits)}%`);
const md = (iso) => (hasLeadingIsoDay(String(iso || '')) ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}` : '');
const shortTitle = (title) => String(title || '').split(' — ')[0];

/** Members: [{ sym, label?, row }] with published screener rows. Medians the criteria and roles share. */
export function themeMemberStats(members = []) {
  const rows = members.map((member) => member?.row).filter(Boolean);
  const ext = rows.map((row) => { const p50 = value(row, 'pctSma50'); return p50 != null && finite(row.adrPct) > 0 ? p50 / row.adrPct : null; });
  return {
    count: rows.length,
    ret1m: median(rows.map((row) => value(row, 'ret1m'))), ret3m: median(rows.map((row) => value(row, 'ret3m'))), ret5d: median(rows.map((row) => row.ret5d)),
    // v59.45 (P8-THEME-01): how many members each median actually stands on (a row without the return is not a sample).
    ret1mCount: rows.filter((row) => value(row, 'ret1m') != null).length, ret3mCount: rows.filter((row) => value(row, 'ret3m') != null).length,
    ret5dCount: rows.filter((row) => finite(row.ret5d) != null).length,
    extension: median(ext), extensionCount: ext.filter((value) => value != null).length
  };
}

/** Upcoming earnings of the members inside the published calendar week, after `after` (the close date). null = no calendar. */
export function upcomingEarnings(calendar, symbols = [], { after = null } = {}) {
  if (!Array.isArray(calendar?.earnings)) return null;
  const wanted = new Set(symbols.map((symbol) => String(symbol).toUpperCase()));
  return calendar.earnings.filter((row) => wanted.has(String(row?.symbol || '').toUpperCase()) && isIsoDay(String(row?.date || '')) && (!after || row.date > after))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.symbol).localeCompare(String(b.symbol)));
}

/** Four-week estimate revisions summed over the members with a consensus row. null below minMembers. */
export function revisionCounts(consensus, symbols = []) {
  const rows = symbols.map((symbol) => consensus?.rows?.[String(symbol).toUpperCase()]?.fwd).filter((fwd) => fwd && finite(fwd.up4w) != null && finite(fwd.down4w) != null);
  if (rows.length < R.minMembers) return null;
  return { up: rows.reduce((sum, fwd) => sum + fwd.up4w, 0), down: rows.reduce((sum, fwd) => sum + fwd.down4w, 0), covered: rows.length, total: symbols.length };
}

const HOUR = { bmo: '장전', amc: '장후', dmh: '장중' };

/**
 * The six theme criteria. Returns { headline, items: [{ id, label, met, value, principle }], met, known, total, unmet, countText }.
 * `benchmark` is the market's marketWindowReturns() result (ret1m/ret3m/ret6m, name); `regime` readMarketRegime(); `lead` the
 * crossroads lead item ({ title }).
 */
export function themeCriteria({ row = null, members = [], benchmark = null, consensus = null, calendar = null, regime = null, lead = null, after = null } = {}) {
  if (!row) return null;
  const stats = themeMemberStats(members);
  const symbols = members.map((member) => member.sym);
  const items = [];
  // 1. 다기간 상대강도
  const gaps = ['ret1m', 'ret3m', 'ret6m'].map((key) => (finite(row[key]) != null && finite(benchmark?.[key]) != null ? row[key] - benchmark[key] : null));
  const known = gaps.filter((gap) => gap != null);
  items.push({ id: 'relative', label: '다기간 상대강도 같은 방향', principle: '1·3·6개월이 모두 시장보다 앞서야 강세가 한 기간의 반짝 반등이 아니라 이어지는 흐름입니다.',
    met: known.length < 3 ? null : known.every((gap) => gap > 0),
    value: known.length ? `${['1개월', '3개월', '6개월'].map((label, index) => `${label} ${gaps[index] == null ? '—' : `${signedText(gaps[index], 1)}%p`}`).join(', ')}(${benchmark?.name || '시장'} 대비)` : '미확인' });
  // 2. 참여 폭
  const above = finite(row.above50);
  items.push({ id: 'breadth', label: '참여 폭', principle: `구성 종목 ${ABOVE50_FLOOR}% 이상이 50일선 위에 있어야 소수 대형주가 아니라 테마 전체가 움직이는 것입니다.`,
    met: above == null ? null : above >= ABOVE50_FLOOR, value: above == null ? '미확인' : `50일선 위 ${above}%` });
  // 3. 이익 전망 방향
  const rev = revisionCounts(consensus, symbols);
  items.push({ id: 'revisions', label: '이익 전망 방향', principle: '가격이 오를 때 애널리스트 이익 전망도 올라가야 강세에 실적 근거가 붙습니다.',
    met: rev ? rev.up > rev.down : null, value: rev ? `최근 4주 상향 ${rev.up}건, 하향 ${rev.down}건(${rev.covered}/${rev.total}종목)` : consensus ? `전망이 있는 종목 ${R.minMembers}개 미만` : '미확인' });
  // 4. 촉매
  const due = upcomingEarnings(calendar, symbols, { after });
  const span = calendar?.weekStart && calendar?.weekEnd ? `${md(calendar.weekStart)}~${md(calendar.weekEnd)}` : '달력 주간';
  items.push({ id: 'catalyst', label: '촉매(다가오는 실적·일정)', principle: '실적 같은 일정이 가까이 있어야 흐름이 확인되거나 꺾입니다. 결과가 어느 쪽일지는 미리 알 수 없습니다.',
    met: due == null ? null : due.length > 0, value: due == null ? '미확인' : due.length ? `${span} 실적 ${due.length}건(${due.slice(0, 3).map((item) => `${item.symbol} ${md(item.date)}${HOUR[item.hour] ? ` ${HOUR[item.hour]}` : ''}`).join(', ')}${due.length > 3 ? ' 외' : ''})` : `${span} 실적 예정 없음` });
  // 5. 과열 아님
  const heatKnown = stats.extensionCount >= R.minMembers && stats.ret5dCount >= R.minMembers && stats.ret5d != null;
  items.push({ id: 'heat', label: '과열 아님', principle: `50일선에서 하루 평균 변동폭의 ${R.extensionAtr}배 넘게 멀어지거나 1주 ${R.weekSurgePct}% 넘게 오르면 되돌림이 잦습니다.`,
    met: heatKnown ? stats.extension < R.extensionAtr && stats.ret5d < R.weekSurgePct : null,
    value: heatKnown ? `50일선 거리 = 하루 변동폭의 ${signedText(stats.extension, 1)}배, 1주 ${pct(stats.ret5d)}(구성 종목 중앙값)` : '미확인' });
  // 6. 시황·선두 시나리오 적합
  const wind = row.wind?.lead || null;
  const state = regime?.overall && regime.overall !== '판정 보류' ? `시장 상태 '${regime.overall}'` : null;
  items.push({ id: 'fit', label: '시황·선두 시나리오 적합', principle: '선두 거시 시나리오가 이 테마의 성격에 부담이면 강세가 거시 바람을 거슬러 가는 것이라 더 쉽게 꺾입니다.',
    met: wind ? wind === 'tail' || wind === 'none' : null,
    value: wind ? `선두 시나리오${lead?.title ? ` '${shortTitle(lead.title)}'` : ''}에서 ${WIND_LABELS[wind] || wind}${state ? `, ${state}` : ''}` : '미확인' });
  const metCount = items.filter((item) => item.met === true).length;
  const knownCount = items.filter((item) => item.met != null).length;
  const unmet = items.filter((item) => item.met === false).map((item) => item.label);
  const countText = `6개 중 ${metCount}개 충족(가능성 아님)${knownCount < items.length ? `, 확인 가능 ${knownCount}개` : ''}`;
  return { headline: `${countText}${unmet.length ? ` — 미충족: ${unmet.join(', ')}` : ''}`, items, met: metCount, known: knownCount, total: items.length, unmet, countText };
}

export const MEMBER_ROLES = Object.freeze({
  leader: Object.freeze({ label: '주도', name: '주도주', rule: `1개월·3개월 모두 테마 중앙값 이상, 50일선 위, 52주 고점에서 ${-R.nearHighPct}% 안`,
    pro: '시장이 이미 인정한 강세라 테마가 이어지면 가장 먼저 반영됩니다.', con: '많이 오른 만큼 테마가 식을 때 되돌림 폭이 클 수 있습니다.' }),
  laggard: Object.freeze({ label: '후발', name: '후발주', rule: '3개월은 테마 중앙값보다 뒤지지만 50일선 위를 지킴',
    pro: '추세는 살아 있고 덜 올라 따라잡을 여지가 있습니다.', con: '뒤처진 데는 실적·사업 구성 같은 이유가 있을 수 있어 끝내 따라오지 않기도 합니다.' }),
  dropout: Object.freeze({ label: '이탈', name: '이탈주', rule: '50일선 아래이고 1개월·3개월 모두 테마 중앙값 미만',
    pro: '가격이 많이 내려 반등 폭이 클 수 있습니다.', con: '테마 안에서 힘이 빠지는 쪽이라 50일선 아래 하락 추세가 이어지기 쉽습니다.' })
});

/** Roles per member: Map sym -> { role, upRevision, thin, earnings }. Roles need minMembers measured members. */
export function memberRoles(members = [], { consensus = null, calendar = null, after = null } = {}) {
  const stats = themeMemberStats(members);
  const due = upcomingEarnings(calendar, members.map((member) => member.sym), { after }) || [];
  const dueOf = new Map(due.map((item) => [String(item.symbol).toUpperCase(), item]));
  const out = new Map();
  const measured = stats.ret1mCount >= R.minMembers && stats.ret3mCount >= R.minMembers && stats.ret1m != null && stats.ret3m != null;
  for (const member of members) {
    const row = member.row;
    const r1 = value(row, 'ret1m'), r3 = value(row, 'ret3m'), p50 = value(row, 'pctSma50'), high = finite(row?.pctFrom52wHigh);
    let role = null;
    if (measured && r1 != null && r3 != null && p50 != null) {
      if (r1 >= stats.ret1m && r3 >= stats.ret3m && p50 > 0 && high != null && high >= R.nearHighPct) role = 'leader';
      else if (p50 < 0 && r1 < stats.ret1m && r3 < stats.ret3m) role = 'dropout';
      else if (p50 >= 0 && r3 < stats.ret3m) role = 'laggard';
    }
    const fwd = consensus?.rows?.[member.sym]?.fwd;
    const dollar = value(row, 'dollarVolume30d');
    const earning = dueOf.get(member.sym) || null;
    out.set(member.sym, { role, upRevision: fwd && finite(fwd.up4w) != null && finite(fwd.down4w) != null ? fwd.up4w > fwd.down4w : null,
      thin: dollar != null && dollar < R.thinUsd, dollar, earnings: earning ? `${md(earning.date)}${HOUR[earning.hour] ? ` ${HOUR[earning.hour]}` : ''}` : null });
  }
  return { roles: out, stats, measured };
}

/** One example line per role: up to three members with their 3개월 and 50일선 values, flags for liquidity and earnings. */
export function roleExamples(members = [], roles) {
  const lines = {};
  for (const key of Object.keys(MEMBER_ROLES)) {
    const picked = members.filter((member) => roles.get(member.sym)?.role === key).sort((a, b) => (key === 'dropout' ? value(a.row, 'ret3m') - value(b.row, 'ret3m') : value(b.row, 'ret3m') - value(a.row, 'ret3m'))).slice(0, 3);
    lines[key] = picked.map((member) => {
      const info = roles.get(member.sym);
      const flags = [info.upRevision ? '전망 상향 우위' : null, info.thin ? '거래대금 적음' : null, info.earnings ? `실적 ${info.earnings}` : null].filter(Boolean);
      return `${member.label || member.sym}(3개월 ${pct(shown(member.row, 'ret3m'))}, 50일선 ${pct(shown(member.row, 'pctSma50'))}${flags.length ? `, ${flags.join(', ')}` : ''})`;
    });
  }
  return lines;
}

/** Macro axes that moved over the last `macroSessions` sessions, with the registry branch each move belongs to. */
export function macroMoves(history = [], regime = null) {
  const rows = Array.isArray(history) ? history : [];
  const moves = [];
  const series = (key) => rows.filter((row) => finite(row?.[key]) != null);
  const spec = [['tnx', '10년물 금리', (a, b) => b - a, (d) => `${signedText(d, 2)}%p`, ['reheat', 'softland']], ['wti', '유가(WTI)', (a, b) => (b / a - 1) * 100, (d) => pct(d), ['oilshock', null]], ['dxy', '달러지수', (a, b) => (b / a - 1) * 100, (d) => pct(d), ['dollarsurge', null]]];
  for (const [key, label, diff, text, [upBranch, downBranch]] of spec) {
    const list = series(key);
    if (list.length <= R.macroSessions) continue;
    const change = diff(list[list.length - 1 - R.macroSessions][key], list[list.length - 1][key]);
    if (Math.abs(change) < R.macroMoves[key]) continue;
    moves.push({ axis: key, label, change, text: `${label} ${text(change)}`, branch: change > 0 ? upBranch : downBranch, asOf: list[list.length - 1].date || null });
  }
  const credit = (regime?.axes || []).find((axis) => axis.id === 'credit');
  if (credit?.state === 'burden') moves.push({ axis: 'credit', label: '신용과 위험선호', change: null, text: `신용과 위험선호 '${credit.stateLabel || '부담'}'`, branch: 'creditstress', asOf: null });
  return moves;
}

/**
 * '이 흐름의 이유' — only causes the data confirms: macro axes that moved × the theme's exposure tags (registry hypothesis),
 * estimate revisions, the ETF's RRG quadrant move, the lead scenario's wind, and same-day headlines naming members.
 * Returns [{ id, text }].
 */
export function themeReasons({ row = null, tags = [], moves = [], crossroads = null, revisions = null, rrgMove = null, headlines = [] } = {}) {
  const lines = [];
  const items = Array.isArray(crossroads?.items) ? crossroads.items : [];
  const linked = moves.map((move) => {
    const branch = move.branch ? items.find((item) => item.id === move.branch) : null;
    const wind = branch ? windFor(tags, branch) : 'none';
    return wind === 'tail' || wind === 'head' ? `${move.text}(${shortTitle(branch.title)} 쪽 움직임, 이 테마에 ${WIND_LABELS[wind]})` : null;
  }).filter(Boolean);
  if (linked.length) lines.push({ id: 'macro', text: `최근 ${R.macroSessions}거래일 거시 축: ${linked.join(', ')}. 성격(${tags.map((tag) => EXPOSURE_TAGS[tag]).filter(Boolean).join(', ')})과 시나리오를 잇는 사전 기준이며, 인과를 측정한 값은 아닙니다.` });
  if (revisions) lines.push({ id: 'revisions', text: `이익 전망: 최근 4주 구성 종목 상향 ${revisions.up}건, 하향 ${revisions.down}건(${revisions.covered}/${revisions.total}종목)${revisions.up > revisions.down ? ' — 가격 움직임에 전망 상향이 같이 있습니다' : revisions.down > revisions.up ? ' — 전망은 하향이 더 많습니다' : ''}.` });
  if (rrgMove) lines.push({ id: 'rrg', text: rrgMove.from === rrgMove.to ? `섹터 회전: 대표 ETF ${rrgMove.etf}가 ${rrgMove.sessions}거래일 전과 같은 '${rrgMove.toWord}' 자리(SPY 대비).` : `섹터 회전: 대표 ETF ${rrgMove.etf}가 ${rrgMove.sessions}거래일 전 '${rrgMove.fromWord}'에서 지금 ${withDirectionParticle(`'${rrgMove.toWord}'`)} 옮겼습니다(SPY 대비).` });
  // A tie has no single lead to read this theme against.
  const leadRead = scenarioLead(crossroads);
  const lead = leadRead.state === 'lead' ? leadRead.items[0] : null;
  if (lead && row?.wind?.lead) lines.push({ id: 'scenario', text: `선두 시나리오 '${shortTitle(lead.title)}'(${lead.fit || `조건 ${lead.met}/${lead.total}`})에서 이 테마는 ${WIND_LABELS[row.wind.lead] || row.wind.lead}입니다.` });
  if (headlines.length) lines.push({ id: 'news', text: `같은 날 보도: ${headlines.map((item) => `${item.sym} ${signedText(item.ret1d, 1)}% — ${item.title}`).join(' / ')}` });
  return lines;
}

/** Which crossroads branches favour or burden this theme (the conditional scenarios), titles shortened. */
export function themeScenarioSplit(tags = [], crossroads = null) {
  const items = Array.isArray(crossroads?.items) ? crossroads.items : [];
  const pick = (kind) => items.filter((item) => windFor(tags, item) === kind).map((item) => shortTitle(item.title));
  return { favorable: pick('tail'), unfavorable: pick('head') };
}
