import { execFileSync } from 'node:child_process';
import { SourceTextModule } from 'node:vm';
import { posix } from 'node:path';
import { writeFileSync } from 'node:fs';
const ref = 'd36bb256ddf60468d6c7a134628053c5796be6be';
const get = (path) => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const modules = new Map();
function moduleFor(path) {
  if (!modules.has(path)) modules.set(path, new SourceTextModule(get(path), { identifier: path }));
  return modules.get(path);
}
async function load(path) {
  const mod = moduleFor(path);
  if (mod.status === 'unlinked') await mod.link((s, m) => {
    if (!s.startsWith('.')) throw new Error(`External dependency forbidden: ${s}`);
    return moduleFor(posix.normalize(posix.join(posix.dirname(m.identifier), s)));
  });
  if (mod.status !== 'evaluated') await mod.evaluate();
  return mod.namespace;
}
const { BRANCHES, pastConflict } = await load('src/domain/market/macro-crossroads.js');
const { buildDirection, buildMarketGuide, renderMarketGuideContext } = await load('src/domain/guide/market-guide.js');
const path = (id, alias = id) => { const b = BRANCHES.find((b) => b.id === id); return { ...b, id: alias, short: b.title.split(' — ')[0] + (alias === id ? '' : ` (${alias})`) }; };
const shape = (d) => ({ robust: d.robust, split: d.split, tally: d.tally.map((t) => ({ key: t.key, favored: t.favoredIn.length, costly: t.costlyIn.length, score: t.score })), text: d.text });
const before = buildDirection([path('softland'), path('oilshock')], []);
const after = buildDirection([path('softland'), path('oilshock'), path('oilshock', 'oil-copy-2'), path('oilshock', 'oil-copy-3')], []);
const branch = BRANCHES.find((b) => b.id === 'aibust');
const past = { n: 100, up: 90, baseUpPct: 50, horizon: 20 };
const item = { ...branch, gate: { met: true }, known: 4, met: 3, total: 4, fit: '조건 충족 3/4', pricing: { tone: 'against' }, triggers: [],
  impact: { firmer: '경기 방어', weaker: 'AI' }, invalidation: ['이익 회복'], past, pastConflict: pastConflict(branch, past), pastBridge: '과거 표본과 어긋남 — 비용 가설은 검증된 성과 우위가 아님' };
const regime = { available: true, asOf: '2026-10-20', overall: '부담 우세', counts: { favorable: 0, neutral: 2, burden: 4 },
  axes: [{ id: 'trend', state: 'burden' }, { id: 'breadth', state: 'burden' }, { id: 'credit', state: 'burden' }], leadership: { break: true, summary: '주도 영역 약화' } };
const outlook = { available: true, leadId: 'weakness', items: [{ id: 'weakness', title: '동반 약세', fit: '조건 충족 3/3', posture: '동반 약세입니다.' }] };
const guide = buildMarketGuide({ regime, outlook, crossroads: { available: true, items: [item], leadId: 'aibust', events: [] } });
const context = renderMarketGuideContext(guide);
const out = { ref, cases: [
  { id: 'duplicate-editorial-branches', source: '실제 BRANCHES.softland/oilshock의 favored/costly 그대로 사용; oilshock의 서술만 두 번 복제', before: shape(before), after: shape(after) },
  { id: 'past-conflict-lost-from-guide', inputConflict: item.pastConflict, modelConflict: guide.direction.live[0].pastConflict, headline: guide.headline, lessonIds: guide.lessons.map((l) => l.id), context, conflictPrinted: context.includes('과거 표본과 어긋남') || context.includes('90%') },
  { id: 'no-live-evidence', direction: shape(buildDirection([], [])) }
] };
writeFileSync(new URL('./interpretation-probe-result.json', import.meta.url), JSON.stringify(out, null, 2) + '\n');
console.log(JSON.stringify(out, null, 2));
