// Owner 2026-10-19 ("시나리오·대응 가이드와 학습"): the shared market guide — one synthesis for 오늘, the AI chat, the server
// narrative and the scenario-state producer. Behaviour checks on fixtures (no text pins on product copy beyond the
// boundary words): the choice tally counts favored/costly across live branches only, the opportunity cost comes from a
// watch branch that names the robust choice costly, lessons are selected by today's state and every lesson links to a
// principles lesson that exists, and no surface turns the count into a probability or an instruction.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BRANCHES, CHOICES } from '../src/domain/market/macro-crossroads.js';
import { buildMarketGuide, buildDirection, renderMarketGuideContext, CHOICE_KEYS } from '../src/domain/guide/market-guide.js';
import { ALL_LESSONS, LESSON_BY_ID, LESSON_KINDS, SCREEN_LESSON_IDS, selectLessons, selectScreenLessons } from '../src/domain/guide/lessons.js';

const label = 'v58.31 market guide';
const choiceKeys = new Set(Object.keys(CHOICES));

// Every branch names its costly choices, from the shared four, never overlapping its favoured ones.
for (const branch of BRANCHES) {
  assert.ok(Array.isArray(branch.costly) && branch.costly.length, `${label}: ${branch.id} names costly choices`);
  for (const key of [...branch.favored, ...branch.costly]) assert.ok(choiceKeys.has(key), `${label}: ${branch.id} uses a shared choice key (${key})`);
  assert.ok(!branch.costly.some((key) => branch.favored.includes(key)), `${label}: ${branch.id} costly and favored are disjoint`);
}

// Every lesson links to a principles lesson that exists, has a known kind and a principle and a mechanism.
const library = JSON.parse(readFileSync(new URL('../public-data/principles/lesson-library.json', import.meta.url), 'utf8'));
const lessonIds = new Set((library.lessons || []).map((row) => row.id));
for (const lesson of ALL_LESSONS) {
  assert.ok(lessonIds.has(lesson.concept), `${label}: ${lesson.id} concept ${lesson.concept} exists in the principles library`);
  assert.ok(LESSON_KINDS[lesson.kind] && lesson.principle && lesson.why, `${label}: ${lesson.id} is complete`);
}
assert.equal(new Set(ALL_LESSONS.map((row) => row.id)).size, ALL_LESSONS.length, `${label}: lesson ids are unique`);

// The tally: favoured somewhere, costly nowhere wins; a watch branch that names it costly becomes the opportunity cost.
const path = (id, favored, costly, extra = {}) => ({ id, short: id, title: `${id} — 테스트`, fit: '조건 충족 2/4', favored, costly, choices: Object.fromEntries(CHOICE_KEYS.map((key) => [key, `${id}:${key}`])), triggers: [{ id: 'us-cpi', when: '11/10 CPI', text: '근원 둔화' }], ...extra });
const d = buildDirection([path('a', ['wait', 'defend'], ['stage']), path('b', ['wait'], ['stage'])], [path('w', ['stage', 'hold'], ['wait', 'defend'])]);
assert.equal(d.robust, 'wait', `${label}: the choice favoured in both live branches and costly in none is the robust one`);
assert.equal(d.tally.find((row) => row.key === 'stage').costlyIn.length, 2, `${label}: costly counts come from live branches only`);
assert.equal(d.costIfWrong[0]?.id, 'w', `${label}: the opportunity cost names the watch branch that makes the robust choice costly`);
assert.match(d.costIfWrong[0].text, /w:wait/, `${label}: the opportunity cost quotes that branch's own text for the choice`);
assert.equal(buildDirection([], []).robust, null, `${label}: no live branch means no tally winner`);

// End to end on the published artifacts: a guide is built, its lessons belong to today's state, the AI block holds the boundary.
const history = JSON.parse(readFileSync(new URL('../public-data/history.json', import.meta.url), 'utf8'));
const rows = Array.isArray(history) ? history : history.rows || [];
const { buildMarketRegime } = await import('../src/domain/briefing/market-read.js');
const regime = buildMarketRegime({ history: rows, credit: { hyBp: 315, hyDelta5Bp: -9 }, rates: {} });
const guide = buildMarketGuide({ regime, outlook: null, crossroads: null, nowMs: Date.now() });
assert.ok(guide.available && guide.situation.length === 4, `${label}: the guide builds from the regime alone`);
assert.equal(guide.direction.robust, null, `${label}: without the crossroads nothing is counted`);
const kinds = new Set(guide.lessons.map((row) => row.kind));
assert.ok(Object.keys(LESSON_KINDS).every((kind) => kinds.has(kind)), `${label}: every lesson kind is represented`);
assert.ok(guide.lessons.every((row) => !row.scope || row.scope === 'market'), `${label}: home shows market-scope lessons only`);
const burdened = selectLessons({ regime: { counts: { burden: 5, favorable: 0 }, axes: [{ id: 'trend', state: 'burden' }] } });
assert.ok(burdened.some((row) => row.id === 'survive-first' && row.reason) && burdened.some((row) => row.id === 'cheap-after-fall' && row.reason), `${label}: a burdened tape raises survive-first and the cheap-after-fall trap`);
const calm = selectLessons({ regime: { counts: { burden: 0, favorable: 5 }, axes: [{ id: 'trend', state: 'favorable' }] } });
assert.ok(!calm.some((row) => row.id === 'cheap-after-fall') && calm.some((row) => row.id === 'no-chasing' && row.reason), `${label}: a strong tape raises no-chasing, not the falling-price trap`);
const text = [guide.headline, ...guide.situation.map((row) => row.text), guide.direction.text, ...guide.stance.pursue, ...guide.stance.avoid, ...ALL_LESSONS.map((row) => `${row.principle} ${row.why}`)].join('\n');
assert.doesNotMatch(text, /\d+(?:\.\d+)?\s*%\s*(?:확률|가능성)|매수하세요|매도하세요|목표가|손절가/, `${label}: no probability percentage or trade instruction`);
assert.match(renderMarketGuideContext(guide), /확률로 바꾸지 말고/, `${label}: the AI block restates the boundary`);

// Per-screen lessons: every listed id exists; stock screens never borrow a market-state reason.
const routes = JSON.parse(readFileSync(new URL('../architecture/route-owners.json', import.meta.url), 'utf8'));
const routeIds = new Set(Object.keys(routes.routes));
for (const [route, ids] of Object.entries(SCREEN_LESSON_IDS)) {
  assert.ok(routeIds.has(route), `${label}: screen lessons target a registered route (${route})`);
  for (const id of ids) assert.ok(LESSON_BY_ID[id], `${label}: ${route} lesson ${id} exists`);
}
const burdenCtx = { regime: { counts: { burden: 5, favorable: 0 }, axes: [{ id: 'trend', state: 'burden' }] } };
for (const route of ['technical', 'ticker', 'fundamental', 'screener']) {
  const picked = selectScreenLessons(route, burdenCtx);
  assert.ok(picked.length && picked.every((row) => !row.reason), `${label}: ${route} shows the mechanism, not a market reason`);
}
assert.ok(selectScreenLessons('portfolio', burdenCtx).some((row) => row.id === 'survive-first' && row.reason), `${label}: a market screen ties its lesson to today's state`);
assert.deepEqual(selectScreenLessons('no-such-route', burdenCtx), [], `${label}: an unknown screen shows nothing`);

console.log(`market guide fixture OK: ${BRANCHES.length} branches tagged, ${ALL_LESSONS.length} lessons linked, ${guide.lessons.length} selected today`);
