// v58.68 (owner 2026-10-23): "the screens show the surface". On 10/22 the S&P 500 fell 1.2% while 336 of 502 members
// rose: the loss sat in the largest AI and technology names, and staples (+3.3%, every member up), utilities and health
// care rose with Treasuries (10-year −17bp) as fear reached 20. The money-flow line names where the session's money went —
// the sector ETFs that rose and fell most, the 10-year yield and fear on the same session — and which of four shapes it
// had. Sector rows are the produced rotation artifact (current session only); the 10-year change is used only when the
// macro snapshot is dated the same session. Growth here is XLK·XLC·SMH, defensive is concepts.js DEFENSIVE_SECTORS.
import { RULES } from '../rules/thresholds.js';
import { selectProducedRotation } from '../themes/produced-rotation.js';
import { DEFENSIVE_SECTORS, SECTOR_ETF_LABELS } from '../interpretation/concepts.js';
import { fearGreedBand } from '../sentiment/metrics.js';
import { MIN_GROUP_MEMBERS } from '../themes/group-strength.js';

const signed = (value, digits = 1) => value == null || !Number.isFinite(value) ? null : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(digits)}%`;
const GROWTH_FLOW = Object.freeze(['XLK', 'XLC', 'SMH']);
const FLOW_LABELS = Object.freeze({ ...SECTOR_ETF_LABELS, SMH: '반도체' });
export const MARKET_FLOW_KINDS = Object.freeze({ defensive: '방어 업종으로 이동', growth: '성장 업종으로 쏠림', broadDown: '업종 전반 하락', broadUp: '업종 전반 상승', mixed: '업종별로 엇갈림' });

export function buildMarketFlow({ rotationHistory = null, macro = null, history = [], themes = null, rows: screenerRows = null, nowMs = Date.now() } = {}) {
  const rows = Object.keys(FLOW_LABELS).map((symbol) => {
    const row = selectProducedRotation(rotationHistory, symbol, nowMs);
    return row && typeof row.dailyPct === 'number' && Number.isFinite(row.dailyPct) ? { symbol, label: FLOW_LABELS[symbol], daily: row.dailyPct, session: row.sessionDate } : null;
  }).filter(Boolean);
  const sectors = rows.filter((row) => SECTOR_ETF_LABELS[row.symbol]);
  if (sectors.length < 8) return { available: false };
  const session = sectors[0].session;
  const rule = RULES.leadership;
  const mean = (list) => list.length ? list.reduce((sum, row) => sum + row.daily, 0) / list.length : null;
  const defensive = mean(rows.filter((row) => DEFENSIVE_SECTORS.has(row.symbol)));
  const growth = mean(rows.filter((row) => GROWTH_FLOW.includes(row.symbol)));
  const up = sectors.filter((row) => row.daily > 0).length, down = sectors.filter((row) => row.daily < 0).length;
  const gap = defensive != null && growth != null ? defensive - growth : null;
  const kind = down >= rule.broadSectorCount ? 'broadDown' : up >= rule.broadSectorCount ? 'broadUp'
    : gap != null && gap >= rule.rotationGapPp && defensive > 0 ? 'defensive'
      : gap != null && -gap >= rule.rotationGapPp && growth > 0 ? 'growth' : 'mixed';
  const sorted = [...rows].sort((a, b) => b.daily - a.daily);
  const item = (row) => `${row.label} ${signed(row.daily)}`;
  const rose = sorted.filter((row) => row.daily > 0).slice(0, 3), fell = sorted.filter((row) => row.daily < 0).reverse().slice(0, 3);
  const tenYearBp = String(macro?._asOf_dgs10 || '').slice(0, 10) === session && Number.isFinite(Number(macro?.dgs10Delta)) ? Math.round(Number(macro.dgs10Delta) * 100) : null;
  const fgRow = (Array.isArray(history) ? history : []).find((row) => row?.date === session);
  const fear = fgRow && fgRow.fg != null ? fearGreedBand(fgRow.fg) : null;
  const evidence = [
    rose.length ? `오른 업종 ${rose.map(item).join(', ')}` : null,
    fell.length ? `내린 업종 ${fell.map(item).join(', ')}` : null,
    `11개 업종 중 ${up}개 상승`,
    tenYearBp != null ? `미국 10년물 ${tenYearBp > 0 ? '+' : tenYearBp < 0 ? '−' : ''}${Math.abs(tenYearBp)}bp` : null,
    fear && !fear.blocked ? `공포·탐욕 ${Math.round(fear.score)}(${fear.label})` : null
  ].filter(Boolean);
  const bonds = tenYearBp != null && tenYearBp <= -5 ? '과 채권' : '';
  const read = kind === 'defensive' ? (growth < 0 ? `하락은 기술·AI 쪽에 몰렸고, 돈은 방어 업종${bonds}으로 옮겨갔습니다.${up >= 6 ? ' 시장 전체가 무너졌다기보다 주도주에서 빠져나온 날입니다.' : ''}` : `방어 업종${bonds}이 성장 업종보다 강했습니다.`)
    : kind === 'growth' ? '성장 업종으로 돈이 몰렸고 방어 업종은 뒤처졌습니다.'
      : kind === 'broadDown' ? `대부분 업종이 함께 내렸습니다. 특정 업종이 아니라 시장 전반에서 돈이 빠졌습니다.`
        : kind === 'broadUp' ? '대부분 업종이 함께 올랐습니다.'
          : '업종별 방향이 엇갈려 한쪽으로 쏠린 이동은 보이지 않습니다.';
  const themeFlow = Array.isArray(themes) && Array.isArray(screenerRows) ? buildThemeFlow({ themes, rows: screenerRows, session }) : { available: false };
  return { available: true, session, kind, label: MARKET_FLOW_KINDS[kind], read, evidence, line: evidence.join(', '), defensive, growth, up, down, tenYearBp, fear: fear?.blocked ? null : fear?.score ?? null, themes: themeFlow };
}

// Owner 2026-10-23 (follow-up: "전력주/유틸리티, 금융주, 부동산/리츠 — 잘 버티는 테마와 떨어지는 테마"): a sector ETF averages
// members that moved apart. On 10/22 regulated utilities rose 2.6% while nuclear and independent power fell 5.4%, retail
// and health-care REITs rose 3.1% while data-center REITs fell 3.5%, and alternative managers rose 3.6% while investment
// banks fell 1.5% — the AI-linked part of each sector fell with the leaders. The theme layer reads the AIO theme map
// (THEME_MAP sub-themes, median one-session return of members measured on the flow's session): the strongest and weakest
// sub-themes, and the sectors whose sub-themes split (one up at least splitSidePct, one down at least splitSidePct, gap at
// least themeSplitPp). Duplicate member sets (the same five chips listed under two themes) count once.
const median = (values) => { const list = values.filter(Number.isFinite).sort((a, b) => a - b); if (!list.length) return null; const mid = Math.floor(list.length / 2); return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2; };
export function buildThemeFlow({ themes = [], rows = [], session = null } = {}) {
  const rule = RULES.leadership;
  const bySym = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  const groups = [];
  const seen = new Set();
  for (const theme of Array.isArray(themes) ? themes : []) {
    for (const sub of Array.isArray(theme?.subThemes) ? theme.subThemes : []) {
      const members = (sub.tickers || []).map((sym) => bySym.get(String(sym).toUpperCase()))
        .filter((row) => row && row.ret1d != null && Number.isFinite(Number(row.ret1d)) && (!session || row.factorSessionDate === session));
      if (members.length < MIN_GROUP_MEMBERS) continue;
      const key = members.map((row) => String(row.sym).toUpperCase()).sort().join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      groups.push({ themeId: theme.id, theme: theme.nameKr || theme.id, name: sub.name, members: members.length, d1: median(members.map((row) => Number(row.ret1d))) });
    }
  }
  if (groups.length < 10) return { available: false };
  const sorted = [...groups].sort((a, b) => b.d1 - a.d1);
  const label = (group) => `${group.theme}·${group.name} ${signed(group.d1)}`;
  const strong = sorted.filter((group) => group.d1 > 0).slice(0, 3);
  const weak = sorted.filter((group) => group.d1 < 0).reverse().slice(0, 3);
  const byTheme = new Map();
  for (const group of groups) byTheme.set(group.themeId, [...(byTheme.get(group.themeId) || []), group]);
  const splits = [...byTheme.values()].map((list) => {
    const best = list.reduce((a, b) => (b.d1 > a.d1 ? b : a)), worst = list.reduce((a, b) => (b.d1 < a.d1 ? b : a));
    return best.d1 >= rule.splitSidePct && worst.d1 <= -rule.splitSidePct && best.d1 - worst.d1 >= rule.themeSplitPp ? { theme: best.theme, up: best, down: worst, gap: best.d1 - worst.d1 } : null;
  }).filter(Boolean).sort((a, b) => b.gap - a.gap);
  const splitText = (split) => `${split.theme}: ${split.up.name} ${signed(split.up.d1)}, ${split.down.name} ${signed(split.down.d1)}`;
  return {
    available: true, groups: groups.length, strong, weak, splits,
    strongLine: strong.length ? `강한 테마 ${strong.map(label).join(', ')}` : null,
    weakLine: weak.length ? `약한 테마 ${weak.map(label).join(', ')}` : null,
    splitLines: splits.map(splitText)
  };
}
