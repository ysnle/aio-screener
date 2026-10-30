// v59.44 (owner 2026-10-30, "요즘 주식 시장은 반도체 OF 반도체야"): how the AI supply chain moved, group by group, for the
// user whose holdings sit there. The groups are the 테마 screen's own sub-themes (root.THEME_MAP) of the semiconductor,
// AI-infrastructure and photonics themes; each is the median of its US members' returns from the screener rows (the
// same closes the screener ranks). Observed returns only — no label of what the move means.

import { selectProducedRotation } from '../themes/produced-rotation.js';

export const AI_CHAIN_THEMES = Object.freeze(['semiconductor', 'ai_infra', 'photonics']);
export const AI_CHAIN_MIN_MEMBERS = 3;

const finite = (value) => (value == null || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));
function median(values) {
  const list = values.map(finite).filter((value) => value != null).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return Math.round((list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2) * 10) / 10;
}
const signed = (value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

/** Groups sorted weakest first over one month, and one sentence of counts. */
export function aiChainFlow({ themes = [], rows = [] } = {}) {
  const bySymbol = new Map((Array.isArray(rows) ? rows : []).filter((row) => row?.sym).map((row) => [String(row.sym).toUpperCase(), row]));
  const groups = [];
  for (const theme of Array.isArray(themes) ? themes : []) {
    if (!AI_CHAIN_THEMES.includes(theme?.id)) continue;
    for (const sub of theme.subThemes || []) {
      const members = [...new Set((sub?.tickers || []).map((sym) => String(sym).toUpperCase()))]
        .map((sym) => bySymbol.get(sym)).filter((row) => row && !/\.K[SQ]$/.test(row.sym) && finite(row.ret1d) != null && finite(row.ret1m) != null);
      if (members.length < AI_CHAIN_MIN_MEMBERS) continue;
      groups.push({ id: `${theme.id}:${sub.name}`, name: sub.name, ret1d: median(members.map((row) => row.ret1d)), ret5d: median(members.map((row) => row.ret5d)), ret1m: median(members.map((row) => row.ret1m)),
        members: members.map((row) => ({ sym: row.sym, name: row.name || row.sym, ret1d: finite(row.ret1d), ret1m: finite(row.ret1m) })).sort((a, b) => a.ret1m - b.ret1m) });
    }
  }
  groups.sort((a, b) => a.ret1m - b.ret1m);
  if (!groups.length) return { groups, reading: '' };
  const down1d = groups.filter((group) => group.ret1d < 0).length;
  const down1m = groups.filter((group) => group.ret1m < 0).length;
  const weakest = groups.slice(0, 2).map((group) => `${group.name} ${signed(group.ret1m)}`).join(', ');
  const reading = `AI 공급망 ${groups.length}개 묶음 중 ${down1d}개가 지난 거래일에 내렸고, 한 달로 보면 ${down1m}개가 내렸습니다. 한 달 가장 약한 곳은 ${weakest}입니다.`;
  return { groups, reading, down1d, down1m };
}

// v59.44 (owner 2026-10-30, "지금 잘 버티는 건 헬스케어/리츠/필수소비재"; X bookmarks 10/30 — healthcare up in the US, Korea
// and Japan while semis fell): on a session the AI side fell and two or more defensive sectors rose, one sentence of that
// contrast from the sector ETFs' last completed session (the produced rotation artifact 브리핑's sector bars read).
const AI_SIDE = Object.freeze({ SMH: '반도체', IGV: '소프트웨어' });
const DEFENSIVE = Object.freeze({ XLV: '헬스케어', XLP: '필수소비재', XLRE: '부동산', XLU: '유틸리티' });
const pct = (value) => `${value > 0 ? '+' : ''}${(Math.round(value * 10) / 10 || 0).toFixed(1)}%`;

export function defensiveContrast(rotation, nowMs = Date.now()) {
  const read = (map) => Object.entries(map).map(([symbol, label]) => ({ symbol, label, daily: selectProducedRotation(rotation, symbol, nowMs)?.dailyPct }))
    .filter((row) => Number.isFinite(row.daily));
  const ai = read(AI_SIDE).filter((row) => row.daily <= -0.5);
  const defensive = read(DEFENSIVE).filter((row) => row.daily >= 0.5).sort((a, b) => b.daily - a.daily);
  if (!ai.length || defensive.length < 2) return '';
  const list = (rows) => rows.map((row) => `${row.label} ${pct(row.daily)}`).join(', ');
  return `같은 거래일 ${list(ai)}가 내리는 동안 ${list(defensive.slice(0, 3))}는 올라 방어 업종 쪽이 강했습니다.`;
}
