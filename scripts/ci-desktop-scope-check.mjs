// P1618 supersedes the desktop-only product choice. Keep desktop gates independent
// while the responsive gate certifies the owner-approved phone/tablet matrix.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const failures = [];
const check = (label, condition) => { if (!condition) failures.push(label); };

const config = read('scripts/desktop-qa-config.mjs');
check('shared desktop QA config declares desktop and responsive scope (P1618)', /DESKTOP_QA_SCOPE\s*=\s*['"]desktop-and-responsive['"]/.test(config));
check('shared desktop QA config declares the supported desktop matrix', ['desktop1280', 'desktop1440', 'desktop1920'].every((name) => config.includes(name)));
check('responsive QA config declares phone and tablet matrix (P1618)', ['phone390', 'tablet768', 'tablet1024'].every((name) => config.includes(name)));
check('responsive acceptance exercises canonical routes (P1618)', /ROUTE_IDS/.test(read('scripts/ci-responsive-browser-check.mjs')));

const matrixGates = [
  'scripts/ci-viewport-matrix-check.mjs',
  'scripts/ci-accessibility-matrix-check.mjs',
  'scripts/ci-vertical-slice-browser-check.mjs',
  'scripts/ci-principles-browser-check.mjs',
  'scripts/ci-three-page-learning-flow-check.mjs',
  'scripts/ci-critical10-human-surface-check.mjs',
  'scripts/ci-route-soak-check.mjs',
  'scripts/ci-architecture-browser-check.mjs',
  'scripts/ci-boot-interaction-check.mjs',
];
for (const file of matrixGates) {
  const source = read(file);
  check(`${file} imports shared desktop QA config`, /desktop-qa-config\.mjs/.test(source));
  check(`${file} has no mobile/tablet viewport identifiers`, !/mobile390|tablet768|laptop1024|390x844|width:\s*390/.test(source));
}

const allRouteGates = [
  'scripts/ci-viewport-matrix-check.mjs',
  'scripts/ci-accessibility-matrix-check.mjs',
  'scripts/ci-route-soak-check.mjs',
  'scripts/ci-architecture-browser-check.mjs',
];
for (const file of allRouteGates) {
  const source = read(file);
  check(`${file} derives the route set from the canonical registry`, /from ['"]\.\.\/src\/app\/routes\.js['"]/.test(source) && /\bROUTE_IDS\b/.test(source));
}

const uxGate = read('scripts/ci-ux-default-path-check.mjs');
check('UX default-path gate has no mobile-only acceptance checks', !/mobile topbar|mobile page-specific|mobile-specific/.test(uxGate));

const sliceRegistry = read('src/app/vertical-slices.js');
check('vertical-slice acceptance has no mobile keyboard dimension', !/mobileKeyboard/.test(sliceRegistry));

const runtimeContract = read('scripts/ci-runtime-contract-check.mjs');
check('runtime contract does not require mobile persona evidence', !/_AIO_AI_HUMAN_CERT_DIMENSIONS\s*=\s*\[[^\]]*mobile/.test(runtimeContract));

const principlesContract = read('scripts/ci-principles-contract-check.mjs');
check('principles contract does not require a mobile fallback mount', !/principles-graph-mobile-list/.test(principlesContract));

const routeBuilder = read('scripts/build-knowledge-route-targets.mjs');
const depthAudit = read('scripts/audit-knowledge-encyclopedia-depth.mjs');
const auditContract = read('_context/MARKET-PRINCIPLES-ATLAS-AUDIT-CONTRACT-2026-08-10.json');
check('knowledge route targets have no mobile persona', !/mobile-keyboard-screenreader/.test(routeBuilder));
check('knowledge depth audit has no mobile persona', !/mobile-keyboard-screenreader/.test(depthAudit));
check('principles audit contract has no mobile persona', !/mobile-keyboard-screenreader/.test(auditContract));

// P1618: one ESM lifecycle and one external stylesheet implement compact screens.
const shellHtml = read('index.html');
const uiJs = read('js/aio-ui.js');
check('shell loads responsive stylesheet (P1618)', /src\/ui\/styles\/responsive\.css/.test(shellHtml));
check('bootstrap installs responsive lifecycle (P1618)', /installResponsiveShell\(root, documentRef\)/.test(read('src/app/bootstrap.js')));
check('responsive CSS covers phone and tablet widths (P1618)', /max-width:\s*700px/.test(read('src/ui/styles/responsive.css')) && /max-width:\s*1100px/.test(read('src/ui/styles/responsive.css')));
check('responsive navigation retains Escape and focus handling (P1618)', /Escape/.test(read('src/ui/components/responsive-shell.js')) && /aria-modal/.test(read('src/ui/components/responsive-shell.js')));
check('legacy mobile handlers do not duplicate responsive owner (P1618)', !/toggleMobileMenu|closeMobileMenu/.test(uiJs));

const handoff = read('_context/SCREENER-OPEN-SOURCE-BENCHMARK-AND-REBUILD-HANDOFF-2026-08-12.md');
check('screener handoff declares desktop-only QA scope', /desktop-only/.test(handoff) && /1280x900|1280×900/.test(handoff));

if (failures.length) {
  console.error(`Desktop QA scope check failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Desktop QA scope check OK: desktop regression and responsive acceptance matrices are separate.');
