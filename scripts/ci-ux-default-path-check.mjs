import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
const core = readFileSync(join(root, 'js/aio-core.js'), 'utf8');
const data = readFileSync(join(root, 'js/aio-data.js'), 'utf8');
const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
const qa = readFileSync(join(root, '_context/QA-CHECKLIST.md'), 'utf8');
const rules = readFileSync(join(root, '_context/RULES.md'), 'utf8');

const failures = [];
const check = (label, condition) => {
  if (!condition) failures.push(label);
};

const forbiddenVisiblePatterns = [
  ['analysis flow details must stay out of default routes', /<summary>분석 흐름 보기<\/summary>/],
  ['score-flow details must stay out of home default route', /점수 계산 흐름 보기/],
  ['GxL framework row must stay out of home default route', /id="home-gxl-frame"|G×L 성장×유동성 프레임/],
  ['signal duplicate header gauge must stay removed', /id="vis-signal"/],
  ['sentiment duplicate header gauge must stay removed', /id="vis-sentiment"/],
  ['F&G subcomponent rail must stay removed from sentiment default route', /id="fg-components-widget"/],
  ['crypto tempo rail must stay removed from sentiment default route', /id="crypto-tempo-widget"/],
  ['finite card grids must not use auto-fill', /auto-fill/],
];

for (const [label, pattern] of forbiddenVisiblePatterns) {
  check(label, !pattern.test(html));
}

check(
  'signal lockout legacy sink must remain hidden if runtime still references it',
  /id="signal-lockout-control"[^>]*style="display:none;"[^>]*aria-hidden="true"/.test(html)
);
check(
  'signal lockout hidden sink must not be revived by page folding',
  !/pageId === ['"]signal['"]\)\s*selectors\s*=\s*\[['"]#signal-lockout-control['"]\]/.test(core)
);
check(
  'rally-quality legacy sink must remain hidden if runtime still references it',
  /id="rally-quality-verdict"[^>]*style="display:none;"[^>]*aria-hidden="true"/.test(html)
);
const operatorNoteIndex = html.indexOf('id="home-operator-note"');
const staleWarningIndex = html.indexOf('id="snapshot-stale-warning"');
check('home operator note placeholder must exist exactly once', (html.match(/id="home-operator-note"/g) || []).length === 1);
check('home operator note must be before the home header/status flow', operatorNoteIndex >= 0 && staleWarningIndex >= 0 && operatorNoteIndex < staleWarningIndex);
check('home operator note must use prominent first-screen styling', /aio-operator-note-title[\s\S]*font-size:18px/.test(html) && /aio-operator-note-body[\s\S]*font-size:14px/.test(html));
check('operator note renderer must filter sample tags', /_isPlaceholderTag/.test(data) && /aio-operator-note-tag/.test(data));
check('visual hierarchy refresh must move away from one-note terminal styling', /v51\.43: visual hierarchy refresh/.test(html) && /--data-amber:[\s\S]*--data-red:[\s\S]*--data-purple:/.test(html));
check(
  'mobile topbar actions must be allowed to shrink and wrap within 390px viewports',
  /@media \(max-width: 480px\)[\s\S]*\.topbar-actions-right\s*\{[\s\S]*flex:\s*1 1 100% !important[\s\S]*max-width:\s*100% !important[\s\S]*min-width:\s*0 !important[\s\S]*justify-content:\s*flex-start !important/.test(html) &&
    /#live-quote-ts\s*\{[\s\S]*text-overflow:\s*ellipsis/.test(html) &&
    /#topbar-ai-btn,\s*#topbar-refresh-btn\s*\{[\s\S]*max-width:\s*96px !important[\s\S]*text-overflow:\s*ellipsis/.test(html)
);
check(
  'mobile page-specific overflow fixes must cover sentiment, fxbond, portfolio, and ticker',
  /#page-sentiment \.aio-section,[\s\S]*#page-sentiment \.aio-widget,[\s\S]*min-width:\s*0/.test(html) &&
    /#page-fxbond table[\s\S]*table-layout:\s*fixed/.test(html) &&
    /#pf-ai-workbench > div[\s\S]*grid-template-columns:\s*1fr !important/.test(html) &&
    /#page-ticker #ticker-direct-search[\s\S]*flex:\s*1 1 180px !important/.test(html) &&
    /#page-ticker \.q-chip[\s\S]*overflow-wrap:\s*anywhere/.test(html)
);
check('operator note must expose a short first-screen lead with expandable full memo', /aio-operator-note-lead/.test(html) && /leadText/.test(data) && /전체 메모 보기/.test(data));
check('KR technical default path must hide legacy intro above decision flow', /#page-kr-technical > \.insight-box:first-child[\s\S]*display:\s*none !important/.test(html));
check('fundamental example card grid must be intrinsic and overflow-safe', /#fund-cards-grid[\s\S]*repeat\(auto-fit,\s*minmax\(170px,\s*1fr\)\)/.test(html) && /#fund-cards-grid > \*[\s\S]*overflow-wrap:\s*anywhere/.test(html));
check('home decision header must render below operator note when present', /operatorNote[\s\S]{0,240}insertAdjacentHTML\('afterend', html\)/.test(core));
check('guide must preserve compact methodology reference', /id="guide-methodology"/.test(html));
check('methodology reference must preserve core decision concepts', /SIGNAL 점수 산식/.test(html) && /시장폭·랠리 품질/.test(html) && /종목 발굴\/검증 루프/.test(html));

const divOpen = (html.match(/<div\b/g) || []).length;
const divClose = (html.match(/<\/div>/g) || []).length;
check('index.html div tags must remain balanced after UX pruning', divOpen === divClose);

check('P529 QA checklist must mention the default-path UX gate', /P529/.test(qa) && /ci-ux-default-path-check\.mjs/.test(qa));
check('P532 QA checklist must mention operator-note priority and Signal fold gate', /P532/.test(qa) && /operator note/i.test(qa) && /Signal/i.test(qa));
check('P534 QA checklist must mention visual hierarchy refresh', /P534/.test(qa) && /visual hierarchy/i.test(qa));
check('default-path UX gate must be wired into CI', /ci-ux-default-path-check\.mjs/.test(ci));
check('R228 must document default-route UX constraints', /R228/.test(rules) && /auto-fill/.test(rules) && /default route/.test(rules));
check('R231 must document visual hierarchy and non-Bloomberg lock-in', /R231/.test(rules) && /Bloomberg/.test(rules) && /visual hierarchy/i.test(rules));

if (failures.length) {
  console.error('Default-path UX check failed:');
  failures.forEach((failure) => console.error(' - ' + failure));
  process.exit(1);
}

console.log(`Default-path UX check OK: no visible flow noise, no auto-fill grids, div balance ${divOpen}/${divClose}.`);
