// The one reading of "which scenario leads" for every screen, the AI and the producer (v59.51, run-6 MERGED #2). A pure
// function of the crossroads model (src/domain/market/macro-crossroads.js buildMacroCrossroads), kept apart from that
// module so a reader of the lead does not import the whole scenario builder.
import { hasFinalConsonant } from '../content/korean-particle.js';

// MERGED #2 (run-6): 종목·재무·포트폴리오 named 'AI 투자 꺾임' and 시장 상태 '유가 충격' for the same 2/4 vs 2/4 — each
// consumer broke the tie its own way. The one reading of "which branch leads": a tie is every tied branch (tiedIds),
// never one of them; leadId/altId stay the stable order the tie-hold and the producer record use.
// Two layers (owner 2026-10-31): `face` is the plain sentence for a beginner; `detail` is the expert fold — each branch's
// count and which conditions it met and missed.
const HELD_LEAD = Object.freeze({ state: 'held', items: [], ids: [], names: [], fit: null, text: null, face: null, detail: [] });
export function scenarioLead(model) {
  if (!model?.available || model.held || !model.leadId) return HELD_LEAD;
  const find = (id) => model.items?.find((item) => item.id === id) || null;
  const tied = (model.tiedIds || []).map(find).filter(Boolean);
  const items = tied.length >= 2 ? tied : [find(model.leadId)].filter(Boolean);
  if (!items.length) return HELD_LEAD;
  const names = items.map((item) => `'${String(item.title || '').split(' — ')[0]}'`);
  const sameFit = items.every((item) => item.fit === items[0].fit);
  const tie = items.length >= 2;
  const conditionList = (item, ok) => (item.conditions || []).filter(([, met]) => met === ok).map(([label]) => String(label).split(' (')[0]);
  return { state: tie ? 'tie' : 'lead', items, ids: items.map((item) => item.id), names, fit: sameFit ? items[0].fit : null,
    text: tie ? `${names.join('·')}(${sameFit ? `${items[0].fit}로 같음` : '조건 충족 비율이 같음'})` : `${names[0]}(${items[0].fit})`,
    face: tie ? `${names.slice(0, -1).join(', ')}${(hasFinalConsonant(names.at(-2)) ? '과' : '와')} ${names.at(-1)} 시나리오가 맞는 조건 수가 같아, 아직 어느 쪽이라고 말할 수 없습니다.`
      : `지금 조건이 가장 많이 맞는 시나리오는 ${names[0]}입니다.`,
    detail: items.map((item) => `${String(item.title || '').split(' — ')[0]}: ${item.status || item.fit}${conditionList(item, true).length ? ` — 충족: ${conditionList(item, true).join(', ')}` : ''}${conditionList(item, false).length ? `; 미충족: ${conditionList(item, false).join(', ')}` : ''}`) };
}
