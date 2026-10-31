// v58.79 (owner 2026-10-25): a research note or 산업 지도 domain names the themes it explains, each with the stage the
// theme playbook gives it now (scenario-state.json, the same record the 테마와 섹터 screen reads). A theme opens its detail.
import { SCENARIO_STATE, refreshSharedArtifact } from '../../data/shared-artifacts.js';

// The row's own stage label and 1-month return; no scenario module is imported, so the knowledge builders' import closure
// stays the research corpus (v58.77 QA-01).
const stageWord = (row) => String(row?.stateLabel || '').split(' (')[0] || '판정 보류';
const pctText = (value) => `${value > 0 ? '+' : ''}${Number(value).toFixed(1)}%`;

export function themeStageBlock(doc, root, themeIds, block) {
  const names = new Map((Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : []).map((theme) => [theme.id, theme.nameKr || theme.id]));
  const ids = (themeIds || []).filter((id) => names.has(id));
  if (!ids.length) return null;
  // P10-STATE-01: only a record the producer marked current gives stages ('current' = theme-stage.js
  // SCENARIO_STATE_CURRENT, the rule 테마와 섹터 reads); a pending placeholder reads as not received.
  const rowsNow = () => {
    const scenario = root?.[SCENARIO_STATE.key];
    return new Map((scenario?.status === 'current' && Array.isArray(scenario.themes) ? scenario.themes : []).filter((row) => row?.market === 'US').map((row) => [row.id, row]));
  };
  const factOf = (row) => (row ? [stageWord(row), Number.isFinite(row.ret1m) ? `1개월 ${pctText(row.ret1m)}` : null].filter(Boolean).join(', ') : '단계 수신 대기');
  const rows = rowsNow();
  const box = block('이 내용이 설명하는 테마');
  const facts = new Map();
  for (const id of ids) {
    const row = rows.get(id);
    const link = doc.createElement('button');
    link.type = 'button';
    link.className = 'af-route';
    link.dataset.themeId = id;
    const title = doc.createElement('strong');
    title.textContent = names.get(id);
    const fact = doc.createElement('span');
    fact.textContent = factOf(row);
    facts.set(id, fact);
    if (row?.basis) link.title = `${row.basis} 종가 기준 테마 단계`;
    link.append(title, fact);
    link.addEventListener('click', () => { if (typeof root?.showThemeDetail === 'function') root.showThemeDetail(id); else root?.showPage?.('themes'); });
    box.appendChild(link);
  }
  // A research page opened first has not loaded the stage record yet; fill the facts in place once it arrives.
  // P10-STATE-01: a re-entry with rows already loaded asks too, so a long-open tab follows the record's TTL
  // (refreshSharedArtifact returns the held copy without a request while it is fresh).
  refreshSharedArtifact(root, SCENARIO_STATE).then(({ changed } = {}) => {
    if (!changed && rows.size) return;
    const now = rowsNow();
    for (const [id, fact] of facts) fact.textContent = factOf(now.get(id));
  }).catch(() => {});
  return box;
}
