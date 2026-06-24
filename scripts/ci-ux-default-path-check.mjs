import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');
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
  'rally-quality legacy sink must remain hidden if runtime still references it',
  /id="rally-quality-verdict"[^>]*style="display:none;"[^>]*aria-hidden="true"/.test(html)
);
check('guide must preserve compact methodology reference', /id="guide-methodology"/.test(html));
check('methodology reference must preserve core decision concepts', /SIGNAL 점수 산식/.test(html) && /시장폭·랠리 품질/.test(html) && /종목 발굴\/검증 루프/.test(html));

const divOpen = (html.match(/<div\b/g) || []).length;
const divClose = (html.match(/<\/div>/g) || []).length;
check('index.html div tags must remain balanced after UX pruning', divOpen === divClose);

check('P529 QA checklist must mention the default-path UX gate', /P529/.test(qa) && /ci-ux-default-path-check\.mjs/.test(qa));
check('default-path UX gate must be wired into CI', /ci-ux-default-path-check\.mjs/.test(ci));
check('R228 must document default-route UX constraints', /R228/.test(rules) && /auto-fill/.test(rules) && /default route/.test(rules));

if (failures.length) {
  console.error('Default-path UX check failed:');
  failures.forEach((failure) => console.error(' - ' + failure));
  process.exit(1);
}

console.log(`Default-path UX check OK: no visible flow noise, no auto-fill grids, div balance ${divOpen}/${divClose}.`);
