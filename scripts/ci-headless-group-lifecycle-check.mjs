import { readFileSync } from 'node:fs';

const read = (file) => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const tests = read('js/aio-tests.js');
const headless = read('scripts/ci-headless-tests.mjs');
const runner = read('scripts/qa-runner.mjs');
const fail = (message) => { throw new Error(`[headless-group-lifecycle] ${message}`); };
const ids = [...tests.matchAll(/\{ id:'(G\d{3})', name:/g)].map((match) => match[1]);

if (ids.length < 100 || new Set(ids).size !== ids.length) fail(`group registry is missing or duplicated: total=${ids.length}, unique=${new Set(ids).size}`);
if (!tests.includes("entry = { label: label, ok: ok, detail: detail || '', groupId: _activeTestGroupId }") || !tests.includes('function _selectTestGroups(options)') || !tests.includes('UNKNOWN_TEST_GROUPS:') || !tests.includes('getTestGroupRegistry')) fail('browser assertions are not attributable to an exact selectable group');
if (!headless.includes("value.startsWith('--groups=')") || !headless.includes('AIO_FAILED_GROUPS=') || !headless.includes('result?.selection?.mode')) fail('headless runner lacks exact group selection/failure output');
if (!runner.includes("profile === 'rerun-failed'") || !runner.includes('AIO_FAILED_GROUPS=') || !runner.includes('`--groups=${failedGroups}`')) fail('QA rerun-failed does not narrow a failed headless gate to its exact groups');
console.log(JSON.stringify({ ok: true, registryGroups: ids.length, first: ids[0], last: ids.at(-1), lifecycle: 'fresh-browser-per-invocation+exact-failed-group-rerun' }));
