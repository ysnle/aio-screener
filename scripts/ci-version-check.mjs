// ─────────────────────────────────────────────────────────────────────────
// AIO Screener — 버전 동기화 검증 (CI 게이트, R1 자동화)
//
// 왜: R1은 버전을 7곳 + 캐시버스터 6곳에 동기화하라고 요구하지만, 지금까지 사람이
//     손으로 맞춰왔다(누락 시 SW 캐시 stale·배지 불일치). 이 스크립트가 version.json을
//     기준(canonical)으로 나머지 위치를 자동 대조해 불일치 시 비0 종료 → CI가 빨갛게 알림.
//
// 실행: node scripts/ci-version-check.mjs   (Node 20+)
// ─────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const errors = [];
const ok = [];
function check(label, cond, detail) { (cond ? ok : errors).push(label + (cond ? '' : ' — ' + detail)); }

// 기준: version.json
let ver;
try { ver = JSON.parse(read('version.json')).version; }
catch (e) { console.error('❌ version.json 읽기 실패: ' + e.message); process.exit(1); }
if (!/^v\d{1,3}\.\d{1,2}$/.test(ver)) { console.error('❌ version.json version 형식 이상: ' + ver); process.exit(1); }

const verRe = esc(ver);
const verNum = ver.replace(/^v/, '');

const html = read('index.html');
check('1. <title>',            html.includes('<title>AIO Screener ' + ver + ' '), 'title에 ' + ver + ' 없음');
check('2. app-version-badge',  new RegExp('id="app-version-badge">' + verRe + '<').test(html), 'badge ' + ver + ' 없음');

const core = read('js/aio-core.js');
check('3. APP_VERSION',        core.includes("APP_VERSION = '" + ver + "'"), 'aio-core.js APP_VERSION ' + ver + ' 없음');

check('4. version.json',       true, ''); // 기준 자신

const sw = read('sw.js');
check('5. sw.js SW_VERSION',   sw.includes("SW_VERSION = '" + ver + "'"), 'sw.js SW_VERSION ' + ver + ' 없음');

const claudeMd = read('CLAUDE.md');
check('6. CLAUDE.md',          claudeMd.includes('현재 버전: **' + ver + '**'), 'CLAUDE.md 현재 버전 ' + ver + ' 없음');

const changelog = read('CHANGELOG.md');
check('7. CHANGELOG.md',       new RegExp('^## ' + verRe + ' ', 'm').test(changelog), 'CHANGELOG 최상단 ' + ver + ' 항목 없음');

// 캐시버스터: index.html의 ?v=NUM 6곳이 모두 verNum 이어야 함
const busters = [...html.matchAll(/\?v=([\d.]+)"/g)].map((m) => m[1]);
const wrong = busters.filter((b) => b !== verNum);
check('8. 캐시버스터(6곳)', busters.length >= 6 && wrong.length === 0,
  busters.length + '개 발견, 불일치 ' + wrong.length + '개(' + [...new Set(wrong)].join(',') + ') — 기대 ' + verNum);

if (errors.length) {
  console.error('❌ 버전 동기화 실패 (기준 version.json = ' + ver + '):');
  errors.forEach((e) => console.error('   ✗ ' + e));
  console.error('   → R1: title·badge·APP_VERSION·version.json·sw.js·CLAUDE.md·CHANGELOG + 캐시버스터 6곳');
  process.exit(1);
}
console.log('✅ 버전 동기화 OK: ' + ver + ' (' + ok.length + '곳 + 캐시버스터 ' + busters.length + '개)');
