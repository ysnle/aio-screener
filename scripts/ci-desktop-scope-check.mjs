// Product QA scope gate: AIO is desktop-only (R474/R476/R669). No mobile/tablet code
// ships (P1324), and acceptance criteria must not reintroduce mobile or tablet
// viewports/personas as required work.
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const failures = [];
const check = (label, condition) => { if (!condition) failures.push(label); };

const config = read('scripts/desktop-qa-config.mjs');
check('shared desktop QA config declares desktop-only scope', /DESKTOP_QA_SCOPE\s*=\s*['"]desktop-only['"]/.test(config));
check('shared desktop QA config declares the supported desktop matrix', ['desktop1280', 'desktop1440', 'desktop1920'].every((name) => config.includes(name)));

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

// P1324/R669: desktop-only means no mobile/tablet code ships at all (not merely "not gated").
const shellHtml = read('index.html');
const uiJs = read('js/aio-ui.js');
const mobileMedia = [...shellHtml.matchAll(/@media[^{]*max-width:\s*(\d+)px/g)].filter((m) => Number(m[1]) < 1100);
check('index.html has no @media max-width below 1100px (P1324/R669)', mobileMedia.length === 0);
check('index.html has no pointer: coarse / hover: none media (P1324/R669)', !/pointer:\s*coarse|hover:\s*none/.test(shellHtml));
check('index.html has no mobile-overlay / mobile-hamburger / mobile-open (P1324/R669)', !/mobile-overlay|mobile-hamburger|mobile-open|mobile-menu-trigger/.test(shellHtml));
check('js/aio-ui.js has no toggleMobileMenu / closeMobileMenu (P1324/R669)', !/toggleMobileMenu|closeMobileMenu/.test(uiJs));

const handoff = read('_context/SCREENER-OPEN-SOURCE-BENCHMARK-AND-REBUILD-HANDOFF-2026-08-12.md');
check('screener handoff declares desktop-only QA scope', /desktop-only/.test(handoff) && /1280x900|1280×900/.test(handoff));

if (failures.length) {
  console.error(`Desktop QA scope check failed (${failures.length})`);
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log('Desktop QA scope check OK: desktop-only acceptance matrix is enforced.');
