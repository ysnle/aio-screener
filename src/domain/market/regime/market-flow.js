import { RULES } from '../../rules/thresholds.js';
import { selectProducedRotation } from '../../themes/produced-rotation.js';
import { DEFENSIVE_SECTORS, SECTOR_ETF_LABELS } from '../interpretation/concepts.js';
import { fearGreedBand } from '../sentiment/metrics.js';
import { MIN_GROUP_MEMBERS } from '../../themes/group-strength.js';
import { directionOf, signedText } from '../../shared/number.js';
import { sessionMove } from './leadership-verdict.js';
import { tenYearClose } from '../../macro/rates-fx.js';

export const AI_CAPEX_CHAIN_THEMES = new Set(['semiconductor', 'utilities', 'photonics', 'ai_infra']);
export const AI_CAPEX_CHAIN_GROUPS = new Set(['industrials:전력장비/그리드']);

const signed = (value, digits = 1) => value == null || !Number.isFinite(value) ? null : signedText(value, digits, '%');
const GROWTH_FLOW = Object.freeze(['XLK', 'XLC', 'SOXX']);
const FLOW_LABELS = Object.freeze({ ...SECTOR_ETF_LABELS, SOXX: '반도체' });
export const MARKET_FLOW_KINDS = Object.freeze({ defensive: '방어 업종 강세', growth: '성장 업종 강세', broadDown: '업종 전반 하락', broadUp: '업종 전반 상승', mixed: '업종별로 엇갈림' });

export function buildMarketFlow({ rotationHistory = null, history = [], themes = null, rows: screenerRows = null, nowMs = Date.now() } = {}) {
  const sectors = Object.keys(SECTOR_ETF_LABELS).map((symbol) => {
    const row = selectProducedRotation(rotationHistory, symbol, nowMs);
    return row && typeof row.dailyPct === 'number' && Number.isFinite(row.dailyPct) ? { symbol, label: FLOW_LABELS[symbol], daily: row.dailyPct, session: row.sessionDate } : null;
  }).filter(Boolean);
  if (sectors.length < 8) return { available: false };
  const session = sectors[0].session;
  // MERGED #3 (run-6): SMH read -8.4% here (a rotation bar fetched 21 minutes after the close) beside -7.0% on the 주도 영역
  // line. One move has one number: the semiconductor row and the 10-year change are the completed history closes the
  // 주도 영역 line (sessionMove) and 시장 상태 (tenYearClose) print, on this session only.
  const semis = sessionMove(history, 'soxx', session);
  const semisRow = semis?.date === session && semis.change != null ? { symbol: 'SOXX', label: FLOW_LABELS.SOXX, daily: semis.change, session } : null;
  const rows = semisRow ? [...sectors, semisRow] : sectors;
  const rule = RULES.leadership;
  const mean = (list) => list.length ? list.reduce((sum, row) => sum + row.daily, 0) / list.length : null;
  const defensive = mean(rows.filter((row) => DEFENSIVE_SECTORS.has(row.symbol)));
  const growth = mean(rows.filter((row) => GROWTH_FLOW.includes(row.symbol)));
  // Counts and lists follow the printed one-decimal move: a sector printing 0.0% is neither up nor down.
  const up = sectors.filter((row) => directionOf(row.daily, 1) === 'up').length, down = sectors.filter((row) => directionOf(row.daily, 1) === 'down').length;
  const gap = defensive != null && growth != null ? defensive - growth : null;
  const kind = down >= rule.broadSectorCount ? 'broadDown' : up >= rule.broadSectorCount ? 'broadUp'
    : gap != null && gap >= rule.rotationGapPp && defensive > 0 ? 'defensive'
      : gap != null && -gap >= rule.rotationGapPp && growth > 0 ? 'growth' : 'mixed';
  const sorted = [...sectors].sort((a, b) => b.daily - a.daily);
  const item = (row) => `${row.label} ${signed(row.daily)}`;
  const rose = sorted.filter((row) => directionOf(row.daily, 1) === 'up').slice(0, 3), fell = sorted.filter((row) => directionOf(row.daily, 1) === 'down').reverse().slice(0, 3);
  const ten = tenYearClose(history, { through: session });
  const tenYearBp = ten?.date === session && ten.d1Bp != null ? Math.round(ten.d1Bp) : null;
  const fgRow = (Array.isArray(history) ? history : []).find((row) => row?.date === session);
  const fear = fgRow && fgRow.fg != null ? fearGreedBand(fgRow.fg) : null;
  const evidence = [
    rose.length ? `오른 업종 ${rose.map(item).join(', ')}` : null,
    fell.length ? `내린 업종 ${fell.map(item).join(', ')}` : null,
    `${sectors.length}개 업종 중 ${up}개 상승`,
    semisRow ? `반도체(SOXX) ${signed(semisRow.daily)}` : null,
    tenYearBp != null ? `미국 10년물 ${signedText(tenYearBp, 0, 'bp')}` : null,
    fear && !fear.blocked ? `공포·탐욕 ${Math.round(fear.score)}(${fear.label})` : null
  ].filter(Boolean);
  const bonds = tenYearBp != null && tenYearBp <= -5 ? '과 채권' : '';
  const read = kind === 'defensive' ? (growth < 0 ? `하락은 기술·AI 쪽에 몰렸고, 방어 업종${bonds}은 상대적으로 강했습니다.${up >= 6 ? ' 시장 전체가 무너졌다기보다 주도주가 약했던 날입니다.' : ''}` : `방어 업종${bonds}이 성장 업종보다 강했습니다.`)
    : kind === 'growth' ? '성장 업종이 강했고 방어 업종은 뒤처졌습니다.'
      : kind === 'broadDown' ? `대부분 업종이 함께 내렸습니다. 특정 업종이 아니라 시장 전반이 약했습니다.`
        : kind === 'broadUp' ? '대부분 업종이 함께 올랐습니다.'
          : '업종별 방향이 엇갈려 한쪽으로 쏠린 이동은 보이지 않습니다.';
  const list = Array.isArray(history) ? history : [];
  const at = list.findIndex((row) => row?.date === session);
  const prevWti = at > 0 ? [...list.slice(0, at)].reverse().find((row) => Number.isFinite(row?.wti))?.wti : null;
  const wtiPct = at >= 0 && Number.isFinite(list[at]?.wti) && Number.isFinite(prevWti) && prevWti ? (list[at].wti / prevWti - 1) * 100 : null;
  const energy = sectors.find((row) => row.symbol === 'XLE');
  const energyEnd = energy && (energy === sorted[0] || energy === sorted.at(-1));
  const oilNote = energyEnd && wtiPct != null && Math.abs(wtiPct) >= 2 && Math.sign(wtiPct) === Math.sign(energy.daily)
    ? ` 에너지 ${energy.daily > 0 ? '강세' : '약세'}는 같은 날 WTI ${signed(wtiPct)}와 같은 방향입니다.` : '';
  const themeFlow = Array.isArray(themes) && Array.isArray(screenerRows) ? buildThemeFlow({ themes, rows: screenerRows, session }) : { available: false };
  return { available: true, session, kind, label: MARKET_FLOW_KINDS[kind], read: `${read}${oilNote}`, evidence, line: evidence.join(', '), defensive, growth, up, down, tenYearBp, fear: fear?.blocked ? null : fear?.score ?? null, themes: themeFlow };
}

const median = (values) => { const list = values.filter(Number.isFinite).sort((a, b) => a - b); if (!list.length) return null; const mid = Math.floor(list.length / 2); return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2; };
const SAME_GROUP_SHARE = 0.8; // of the smaller group's members
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
      // Two parent themes can hold nearly the same sub-theme (반도체 'AI 칩/커스텀 ASIC', AI 인프라 'AI 칩/CPU' share four of five
      // names); the first one listed stands for both, so one move is not ranked twice.
      const syms = members.map((row) => String(row.sym).toUpperCase());
      const twin = [...seen].some((other) => syms.filter((sym) => other.has(sym)).length >= Math.min(syms.length, other.size) * SAME_GROUP_SHARE);
      if (twin) continue;
      seen.add(new Set(syms));
      groups.push({ themeId: theme.id, theme: theme.nameKr || theme.id, name: sub.name, members: members.length, d1: median(members.map((row) => Number(row.ret1d))), rows: members });
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
  const memberSplits = groups.map((group) => {
    const list = group.rows.map((row) => ({ sym: String(row.sym).toUpperCase(), d1: Number(row.ret1d) }));
    const best = list.reduce((a, b) => (b.d1 > a.d1 ? b : a)), worst = list.reduce((a, b) => (b.d1 < a.d1 ? b : a));
    return best.d1 >= rule.splitSidePct && worst.d1 <= -rule.splitSidePct && best.d1 - worst.d1 >= rule.themeSplitPp
      ? { name: group.name, up: best, down: worst, upCount: list.filter((row) => directionOf(row.d1, 1) === 'up').length, downCount: list.filter((row) => directionOf(row.d1, 1) === 'down').length, /* v59.45: counts follow the printed one-decimal move */ strength: Math.min(best.d1, -worst.d1),
        aiChain: AI_CAPEX_CHAIN_THEMES.has(group.themeId) || AI_CAPEX_CHAIN_GROUPS.has(`${group.themeId}:${group.name}`) } : null;
  }).filter(Boolean).sort((a, b) => Number(b.aiChain) - Number(a.aiChain) || b.strength - a.strength);
  const memberSplitText = (split) => `${split.name}: ${split.up.sym} ${signed(split.up.d1)}, ${split.down.sym} ${signed(split.down.d1)} (상승 ${split.upCount}, 하락 ${split.downCount})`;
  return {
    available: true, groups: groups.length, strong, weak, splits,
    strongLine: strong.length ? `강한 테마 ${strong.map(label).join(', ')}` : null,
    weakLine: weak.length ? `약한 테마 ${weak.map(label).join(', ')}` : null,
    splitLines: splits.map(splitText),
    memberSplits,
    memberSplitLines: memberSplits.map(memberSplitText)
  };
}
