// v59.70 D6 (owner decision): headlines arrive in Korean from the producer (titleKo, or titleKoFailed with the original);
// the browser does not translate. This gate fails when a client-side translation path comes back anywhere the page
// loads: the deleted translation functions (defined or called), the deferred translation queue, or a machine
// translation endpoint. The replacement (titleKo first, a marked failure) is tested by behaviour: T889b in js/aio-tests.js
// and the untranslatedMark unit in scripts/ci-esm-core-unit-check.mjs.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const RETIRED = /\b(?:autoTranslateNews|freeTranslateNews|_gtBatchTranslate|_aioQueueDeferredNewsTranslation|_aioReleaseDeferredNewsTranslation|requestShownTranslations|_translationInProgress|translationReady|_isKoreanTranslationValid|_aioPolishMachineTitle|localEnrichSingle)\b|translate\.googleapis\.com|translate\.google\.com|id="translate-status"/;
const files = ['index.html', 'sw.js'];
const walk = (dir) => {
  for (const name of readdirSync(join(root, dir))) {
    const path = join(dir, name);
    if (statSync(join(root, path)).isDirectory()) walk(path);
    else if (/\.(?:js|mjs|css|html)$/.test(name)) files.push(path);
  }
};
walk('js');
walk('src');
// js/aio-tests.js asserts the retirement by name (typeof window.autoTranslateNews !== 'function').
const ASSERTS_ABSENCE = new Set([join('js', 'aio-tests.js')]);
// The client relay host list mirrors the Worker's ALLOWED_DOMAINS (P1756, proxy-continuity); it names hosts, it does not translate.
const HOST_MIRROR = join('src', 'data', 'providers', 'proxy-transport.js');
const failures = [];
for (const file of files) {
  let text;
  try { text = readFileSync(join(root, file), 'utf8'); } catch { continue; }
  text.split('\n').forEach((line, index) => {
    if (!RETIRED.test(line)) return;
    if (file === HOST_MIRROR && /^\s*'translate\.googleapis\.com', 'translate\.google\.com'\s*$/.test(line)) return;
    if (ASSERTS_ABSENCE.has(file) && /typeof window\.\w+ !== 'function'|browser_translation_retired/.test(line)) return;
    if (/^\s*(?:\/\/|\*|\/\*)/.test(line) && /v59\.70 \(D6\)/.test(line)) return; // the retirement note itself
    failures.push(`${relative(root, join(root, file))}:${index + 1} ${line.trim().slice(0, 140)}`);
  });
}
if (failures.length) {
  console.error(`[browser-translation-retired] FAIL\n - ${failures.join('\n - ')}`);
  process.exit(1);
}
console.log(`[browser-translation-retired] PASS ${files.length} page files carry no browser translation path; the translation lives in the producer`);
