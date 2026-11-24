// v59.44 (owner 2026-10-30, "요즘 주식 시장은 반도체 OF 반도체야"): how the AI supply chain moved, group by group, for the
// user whose holdings sit there. The groups are the 테마 screen's own sub-themes (root.THEME_MAP) of the semiconductor,
// AI-infrastructure and photonics themes; each is the median of its US members' returns from the screener rows (the
// same closes the screener ranks). Observed returns only — no label of what the move means.
import { median as sharedMedian } from '../themes/theme-medians.js';
import { selectProducedRotation } from '../themes/produced-rotation.js';
import { readNumber as finite, signedText } from '../shared/number.js';
import { readRowNumber } from '../../data/contracts/screener.js';
import { claim, say } from '../shared/claim.js';
import { NEAR_HIGH_MIN_MEASURED } from '../themes/near-high.js';
import { fallFrame } from '../market/story/fall-frame.js';

// The market's leaders (주도 영역, AI·반도체) as themes. Not the AI capex chain of market-flow.js
// (AI_CAPEX_CHAIN_THEMES: power and utilities too) — a different question, a different set.
export const LEADER_THEMES = Object.freeze(['semiconductor', 'ai_infra', 'photonics']);
export const AI_CHAIN_MIN_MEMBERS = 3;
/** v60.50: the leaders' listings — every ticker in a sub-theme of LEADER_THEMES (the groups aiChainFlow reads). */
export function leaderMembers(themes = []) {
  return new Set((Array.isArray(themes) ? themes : []).filter((theme) => LEADER_THEMES.includes(theme?.id))
    .flatMap((theme) => (theme.subThemes || []).flatMap((sub) => sub?.tickers || [])).map((sym) => String(sym).toUpperCase()));
}

/**
 * v60.50 (owner 2026-11-23, audit FINDINGS 테마와 섹터 "주도 테마의 고점 대비 평균 — 소유"): the leaders' US members
 * (leaderMembers) against every other theme's US members — the simple mean of each side's fall from the 52-week closing
 * high on `session` — as one plain line, its figures claims, and the two bars on the opening's frame. Null without the
 * session or with fewer than NEAR_HIGH_MIN_MEASURED measured members on either side (the theme screen's own floor for a
 * group's share from its members: one or two members must not set it).
 */
export function leaderFalls({ themes = [], rows = [], session = null } = {}) {
  if (!session) return null;
  const lead = leaderMembers(themes);
  const others = new Set((Array.isArray(themes) ? themes : []).filter((theme) => theme?.id && !LEADER_THEMES.includes(theme.id))
    .flatMap((theme) => (theme.subThemes || []).flatMap((sub) => sub?.tickers || [])).map((sym) => String(sym).toUpperCase()).filter((sym) => !lead.has(sym)));
  const bySymbol = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  const side = (set) => {
    const listed = [...set].filter((sym) => !/\.K[SQ]$/.test(sym));
    const values = listed.map((sym) => bySymbol.get(sym)).filter((row) => row?.factorSessionDate === session)
      .map((row) => readRowNumber(row, 'pctFromCloseHigh52w', 'calculation')).filter((value) => finite(value) != null);
    return { listed: listed.length, measured: values.length, mean: values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null };
  };
  const leaders = side(lead), rest = side(others);
  if (leaders.measured < NEAR_HIGH_MIN_MEASURED || rest.measured < NEAR_HIGH_MIN_MEASURED) return null;
  const depth = (subject, part, label) => claim({ subject, measure: 'meanFromHigh52w', asOf: session, figures: [{ value: -part.mean, unit: 'share', basis: 'meanFromHigh52w', label }] });
  const said = say('주도 테마(AI·반도체) 종목은 1년 고점에서 평균 {a} 내렸고, 나머지 테마 종목은 평균 {b}입니다.', { a: depth('leader-themes', leaders, '주도 테마'), b: depth('other-themes', rest, '나머지 테마') });
  const bar = (id, label, part) => ({ id, label, part: id === 'leader-themes' ? 'leaders' : 'broad', value: part.mean, stage: null,
    valueText: say('{v}', { v: claim({ subject: id, measure: 'meanFromHigh52w', asOf: session, figures: [{ value: part.mean, unit: 'pct', basis: 'meanFromHigh52w', label }] }) }).text });
  return { asOf: session, leaders, rest, said, bars: fallFrame([bar('leader-themes', '주도 테마(AI·반도체)', leaders), bar('other-themes', '나머지 테마', rest)]) };
}

// Boundary contract: the medians take the 1-month return the screener readiness contract allows in a calculation.
const ret1m = (row) => readRowNumber(row, 'ret1m', 'calculation');

// The shared theme median (theme-medians.js), kept at one decimal as this reading prints it.
function median(values) {
  const value = sharedMedian(values);
  return value == null ? null : Math.round(value * 10) / 10;
}
const signed = (value) => signedText(value, 1, '%');

/** Groups sorted weakest first over one month, and one sentence of counts. */
// v59.45 (pipeline review P21-CHAIN-01): with `session` (the screener's US factor session, the date the block prints),
// only rows measured on that session enter a median — a row left on an older session is another period. Each group keeps
// how many of its US listings were measured (`measured` of `listed`).
export function aiChainFlow({ themes = [], rows = [], session = null } = {}) {
  const bySymbol = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  const groups = [];
  for (const theme of Array.isArray(themes) ? themes : []) {
    if (!LEADER_THEMES.includes(theme?.id)) continue;
    for (const sub of theme.subThemes || []) {
      const listed = [...new Set((sub?.tickers || []).map((sym) => String(sym).toUpperCase()))].map((sym) => bySymbol.get(sym)).filter((row) => row && !/\.K[SQ]$/.test(row.sym));
      const members = listed.filter((row) => (!session || row.factorSessionDate === session) && finite(row.ret1d) != null && ret1m(row) != null);
      if (members.length < AI_CHAIN_MIN_MEMBERS) continue;
      groups.push({ id: `${theme.id}:${sub.name}`, name: sub.name, measured: members.length, listed: listed.length, ret1d: median(members.map((row) => row.ret1d)), ret5d: median(members.map((row) => row.ret5d)), ret1m: median(members.map(ret1m)),
        members: members.map((row) => ({ sym: row.sym, name: row.name || row.sym, ret1d: finite(row.ret1d), ret1m: ret1m(row) })).sort((a, b) => a.ret1m - b.ret1m) });
    }
  }
  groups.sort((a, b) => a.ret1m - b.ret1m);
  if (!groups.length) return { groups, reading: '' };
  const down1d = groups.filter((group) => group.ret1d < 0).length;
  const down1m = groups.filter((group) => group.ret1m < 0).length;
  const weakest = groups.slice(0, 2).map((group) => `${group.name} ${signed(group.ret1m)}`).join(', ');
  const reading = down1d === groups.length && down1m === groups.length
    ? `AI 공급망 ${groups.length}개 묶음이 지난 거래일과 한 달 모두 내렸습니다. 한 달 가장 약한 곳은 ${weakest}입니다.`
    : `AI 공급망 ${groups.length}개 묶음 중 ${down1d}개가 지난 거래일에 내렸고, 한 달로 보면 ${down1m}개가 내렸습니다. 한 달 가장 약한 곳은 ${weakest}입니다.`;
  return { groups, reading, down1d, down1m };
}

// v59.44 (owner 2026-10-30, "지금 잘 버티는 건 헬스케어/리츠/필수소비재"; X bookmarks 10/30 — healthcare up in the US, Korea
// and Japan while semis fell): on a session the AI side fell and two or more defensive sectors rose, one sentence of that
// contrast from the sector ETFs' last completed session (the produced rotation artifact 브리핑's sector bars read).
const AI_SIDE = Object.freeze({ SMH: '반도체', IGV: '소프트웨어' });
const DEFENSIVE = Object.freeze({ XLV: '헬스케어', XLP: '필수소비재', XLRE: '부동산', XLU: '유틸리티' });
const pct = (value) => signedText(value, 1, '%');

export function defensiveContrast(rotation, nowMs = Date.now()) {
  const read = (map) => Object.entries(map).map(([symbol, label]) => ({ symbol, label, daily: selectProducedRotation(rotation, symbol, nowMs)?.dailyPct }))
    .filter((row) => Number.isFinite(row.daily));
  const ai = read(AI_SIDE).filter((row) => row.daily <= -0.5);
  const defensive = read(DEFENSIVE).filter((row) => row.daily >= 0.5).sort((a, b) => b.daily - a.daily);
  if (!ai.length || defensive.length < 2) return '';
  const list = (rows) => rows.map((row) => `${row.label} ${pct(row.daily)}`).join(', ');
  return `같은 거래일 ${list(ai)}가 내리는 동안 ${list(defensive.slice(0, 3))}는 올라 방어 업종 쪽이 강했습니다.`;
}
