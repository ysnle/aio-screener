// Audit fixture: injected transport only, no external fetch or product writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { refreshSharedArtifact, sharedArtifactIsStale, sharedArtifactState, SCENARIO_STATE } from '../../src/data/shared-artifacts.js';
import { themeRotationRead, THEME_PLAYBOOK_VERSION } from '../../src/domain/scenarios/theme-playbook.js';
import { themeStagesFor } from '../../src/domain/scenarios/theme-stage.js';
import { thesisRows } from '../../src/ui/components/portfolio-checklist.js';
const old = { schemaVersion: 'scenario-state.v1', status: 'current', generatedAt: '2020-01-01T00:00:00Z',
  playbookVersion: THEME_PLAYBOOK_VERSION, rotation: { text: 'OLD_ROTATION_SENTINEL' },
  themes: [{ market: 'US', id: 'audit', label: 'Audit theme', state: 'weak', basis: '2020-01-01' }] };
let requests = 0;
const root = { THEME_MAP: [{ id: 'audit', leaders: ['AUDIT'] }],
  fetch: async () => { requests++; return new Response(JSON.stringify(old)); } };
await refreshSharedArtifact(root, SCENARIO_STATE);
const freshCache = { state: sharedArtifactState(root, SCENARIO_STATE.key), reloadNeeded: sharedArtifactIsStale(root, SCENARIO_STATE.key, SCENARIO_STATE),
  rotation: themeRotationRead({ artifact: root[SCENARIO_STATE.key] }), stages: themeStagesFor(root, { themeIds: ['audit'] }) };
assert.equal(freshCache.state, 'ready');
assert.equal(freshCache.reloadNeeded, false);
assert.equal(freshCache.rotation.text, 'OLD_ROTATION_SENTINEL');
assert.equal(freshCache.stages.length, 1);
const surface = { rows: [{ symbol: 'AUDIT', value: 100 }] };
const staleThesis = thesisRows({ surface, root });
assert.ok(staleThesis[0].signals.some(text => text.includes('테마 단계 약함')));
const missingThesis = thesisRows({ surface, root: {} });
assert.deepEqual(missingThesis[0].signals, []);
root[SCENARIO_STATE.key] = { ...old, status: 'pending' };
const pending = { canonicalStages: themeStagesFor(root, { themeIds: ['audit'] }), thesis: thesisRows({ surface, root }), rotation: themeRotationRead({ artifact: root[SCENARIO_STATE.key] }) };
assert.equal(pending.canonicalStages.length, 0);
assert.ok(pending.thesis[0].signals.length);
assert.equal(pending.rotation.source, 'artifact');
const report = { at: new Date().toISOString(), requests, freshCache, staleThesis, missingThesis, pending,
  boundary: 'Actual loader/domain/view-model functions with injected Response; renderer wording read from source, no browser or live failure claim.' };
fs.writeFileSync(new URL('./pass10-reproductions.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
