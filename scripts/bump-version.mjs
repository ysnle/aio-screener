#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/bump-version.mjs — R1 버전 동기화 자동화 (v51.64)
//
// 사용법:
//   node scripts/bump-version.mjs <새버전>
//   node scripts/bump-version.mjs v51.65
//
// R1 7개 위치를 한 번에 패치:
//   1. index.html  — <title>, badge span, ?v= 캐시버스터 4곳
//   2. js/aio-core.js — APP_VERSION 상수
//   3. sw.js       — SW_VERSION + SW_BUILD
//   4. version.json
//   5. CLAUDE.md (루트)   — 현재 버전 줄
//   6. _context/CLAUDE.md — 현재 버전 줄
//   7. CHANGELOG.md — 새 버전 섹션 헤더 삽입
//
// 설계 원칙 (R1):
//   - 이 스크립트가 유일한 버전 패치 경로. 직접 파일 편집은 금지.
//   - CI ci-version-check.mjs가 결과를 검증 (7곳 일치 필수).
//   - CHANGELOG.md에 새 섹션 헤더를 자동 삽입하지만 내용은 직접 채워야 함.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ── 헬퍼 ────────────────────────────────────────────────────────────────────

function read(rel) {
  const p = resolve(ROOT, rel);
  if (!existsSync(p)) throw new Error(`파일 없음: ${rel}`);
  return readFileSync(p, 'utf8');
}

function write(rel, content) {
  writeFileSync(resolve(ROOT, rel), content, 'utf8');
}

function replaceOnce(content, pattern, replacement, label) {
  if (!pattern.test(content)) throw new Error(`패턴 미발견 (${label}): ${pattern}`);
  const result = content.replace(pattern, replacement);
  if (result === content) throw new Error(`치환 무변화 (${label}): 이미 이 버전인가?`);
  return result;
}

function replaceAll(content, pattern, replacement) {
  return content.split(pattern).join(replacement);
}

// ── 메인 ────────────────────────────────────────────────────────────────────

const VERSION_INPUT_RE = /^v(\d{1,3})(?:\.(\d{1,2}))?$/;

function parseVersion(raw) {
  const match = VERSION_INPUT_RE.exec(raw);
  if (!match) return null;
  return { major: Number(match[1]), patch: match[2] == null ? 0 : Number(match[2]) };
}

function canonicalizeVersion(raw) {
  const parsed = parseVersion(raw);
  if (!parsed) return null;
  return parsed.patch === 0
    ? `v${parsed.major}`
    : `v${parsed.major}.${String(parsed.patch).padStart(2, '0')}`;
}

const newVerInput = process.argv[2];
const parsedNewVersion = newVerInput ? parseVersion(newVerInput) : null;
const newVer = parsedNewVersion ? canonicalizeVersion(newVerInput) : null;
if (!newVerInput) {
  console.error('사용법: node scripts/bump-version.mjs <버전>  (예: v51.65)');
  process.exit(1);
}
if (!parsedNewVersion) {
  console.error(`버전 형식 오류: "${newVer}" — v{숫자}.{숫자} 형식이어야 합니다`);
  process.exit(1);
}

const shortVer = newVer.slice(1); // "51.64" (v 제거)
const buildTs = new Date().toISOString().replace(/\.\d+Z$/, '+09:00').replace('T', 'T').slice(0, 16) + ':00+09:00';
// 실제 KST 변환은 환경 의존이므로 UTC+9 오프셋 표기로 근사
const utcNow = new Date();
const kstMs = utcNow.getTime() + 9 * 3600 * 1000;
const kst = new Date(kstMs);
const pad = n => String(n).padStart(2, '0');
const kstStr = `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth()+1)}-${pad(kst.getUTCDate())}T${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}:00+09:00`;

const todayDate = `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth()+1)}-${pad(kst.getUTCDate())}`;

// 이전 버전 자동 감지 (version.json에서 읽기)
let prevVer;
try {
  const vj = JSON.parse(read('version.json'));
  prevVer = vj.version; // "v51.64"
} catch (e) {
  console.error('version.json 파싱 실패:', e.message);
  process.exit(1);
}

const parsedPrevVersion = parseVersion(prevVer);
if (!parsedPrevVersion) {
  console.error(`version.json의 현재 버전 형식이 잘못되었습니다: ${prevVer}`);
  process.exit(1);
}
if (newVerInput !== newVer) console.log(`버전 정규화: ${newVerInput} → ${newVer}`);
if (parsedNewVersion.major < parsedPrevVersion.major || (parsedNewVersion.major === parsedPrevVersion.major && parsedNewVersion.patch <= parsedPrevVersion.patch)) {
  console.error(`버전은 단조 증가해야 합니다: ${prevVer} → ${newVer}`);
  process.exit(1);
}
if (prevVer === newVer) {
  console.error(`이미 ${newVer}입니다. 버전 증가 없음.`);
  process.exit(1);
}

// Preflight every replacement target before writing anything. The old
// step-by-step writer could update the first R1 surfaces and only then fail on
// a later handoff regex, leaving a half-bumped worktree that broke commit and
// deploy checks.
const requirePreflight = (rel, pattern, label) => {
  if (!pattern.test(read(rel))) throw new Error(`${rel}: preflight target missing (${label})`);
};
try {
  requirePreflight('index.html', new RegExp(`AIO Screener ${escRe(prevVer)}`), 'title');
  requirePreflight('index.html', new RegExp(`id="app-version-badge">${escRe(prevVer)}</span>`), 'badge');
  requirePreflight('js/aio-core.js', new RegExp(`const APP_VERSION = '${escRe(prevVer)}'`), 'APP_VERSION');
  requirePreflight('sw.js', new RegExp(`SW_VERSION = '${escRe(prevVer)}'`), 'SW_VERSION');
  requirePreflight('CLAUDE.md', new RegExp(escRe(prevVer)), 'root guide version');
  requirePreflight('_context/CLAUDE.md', new RegExp(escRe(prevVer)), 'context guide version');
  requirePreflight('_context/MARKET-PRINCIPLES-ATLAS-AUDIT-CONTRACT-2026-08-10.json', new RegExp(`(\"targetVersion\"\\s*:\\s*\")${escRe(prevVer)}(\")`), 'audit targetVersion');
  requirePreflight('_context/MARKET-PRINCIPLES-ATLAS-HANDOFF-FILE-MANIFEST-2026-08-10.json', new RegExp(`AIO-Knowledge-System-Structural-Handoff-${escRe(prevVer)}`), 'handoff packageName');
  requirePreflight('_context/MARKET-PRINCIPLES-ATLAS-HANDOFF-FILE-MANIFEST-2026-08-10.json', new RegExp(`(\"applicationVersion\"\\s*:\\s*\")${escRe(prevVer)}(\")`), 'handoff applicationVersion');
  requirePreflight('_context/MARKET-PRINCIPLES-ATLAS-STRUCTURAL-AUDIT-HANDOFF-2026-08-10.md', new RegExp(`target_version:\\s*${escRe(prevVer)}`), 'handoff target_version');
  requirePreflight('_context/MARKET-PRINCIPLES-ATLAS-STRUCTURAL-AUDIT-HANDOFF-2026-08-10.md', new RegExp(`local_revision:\\s*${escRe(prevVer)}`), 'handoff local_revision');
  for (const artifactPath of [
    'public-config.json',
    'architecture/asset-manifest.json',
    'architecture/release-manifest.json',
    'architecture/operations-slo.json',
    'architecture/visual-state-matrix.json',
    'architecture/public-readiness.json',
  ]) {
    requirePreflight(artifactPath, new RegExp(`(\"appRevision\"\\s*:\\s*\")${escRe(prevVer)}(\")`), `${artifactPath} appRevision`);
    const artifact = read(artifactPath);
    if (/\"workerRevision\"\s*:\s*\"/.test(artifact)) {
      requirePreflight(artifactPath, new RegExp(`(\"workerRevision\"\\s*:\\s*\"sw:)${escRe(prevVer)}(\")`), `${artifactPath} workerRevision`);
    }
  }
  requirePreflight('public-data/operations-status.json', new RegExp(`(\"appRevision\"\\s*:\\s*\")${escRe(prevVer)}(\")`), 'operations appRevision');
  requirePreflight('public-data/operations-status.json', new RegExp(`(\"browser\"[\\s\\S]*?\"revision\"\\s*:\\s*\")${escRe(prevVer)}(\")`), 'operations browser revision');
  requirePreflight('_context/SCREENER-OPEN-SOURCE-BENCHMARK-AND-REBUILD-HANDOFF-2026-08-12.md', new RegExp(`repository_version:\\s*${escRe(prevVer)}`), 'screener handoff repository_version');
  requirePreflight('_context/RULES.md', new RegExp(`target_version:\\s*${escRe(prevVer)}`), 'RULES target_version');
} catch (error) {
  console.error(`버전 범프 사전 검증 실패: ${error.message}`);
  process.exit(1);
}

const prevShort = prevVer.slice(1); // "51.63"
console.log(`\n▶ 버전 범프: ${prevVer} → ${newVer}\n`);

const errors = [];

// ── 1. index.html ────────────────────────────────────────────────────────────
console.log('1. index.html 패치...');
try {
  let html = read('index.html');

  // <title>
  html = replaceOnce(html,
    new RegExp(`AIO Screener ${escRe(prevVer)} —`),
    `AIO Screener ${newVer} —`,
    'title'
  );

  // badge
  html = replaceOnce(html,
    new RegExp(`id="app-version-badge">${escRe(prevVer)}</span>`),
    `id="app-version-badge">${newVer}</span>`,
    'badge'
  );

  // ?v= 캐시버스터 (모든 인스턴스)
  const prevCb = prevShort.replace('.', '\\.');
  const cbCount = (html.match(new RegExp(`\\?v=${prevCb}`, 'g')) || []).length;
  if (cbCount === 0) throw new Error(`캐시버스터 ?v=${prevShort} 없음`);
  html = replaceAll(html, `?v=${prevShort}`, `?v=${shortVer}`);
  console.log(`   캐시버스터 ${cbCount}개 치환`);

  write('index.html', html);
  console.log('   ✓ index.html');
} catch (e) {
  errors.push(`index.html: ${e.message}`);
}

// ── 2. js/aio-core.js ────────────────────────────────────────────────────────
console.log('2. js/aio-core.js 패치...');
try {
  let core = read('js/aio-core.js');
  core = replaceOnce(core,
    new RegExp(`const APP_VERSION = '${escRe(prevVer)}'`),
    `const APP_VERSION = '${newVer}'`,
    'APP_VERSION'
  );
  write('js/aio-core.js', core);
  console.log('   ✓ js/aio-core.js APP_VERSION');
} catch (e) {
  errors.push(`aio-core.js: ${e.message}`);
}

// ── 3. sw.js ─────────────────────────────────────────────────────────────────
console.log('3. sw.js 패치...');
try {
  let sw = read('sw.js');
  sw = replaceOnce(sw,
    new RegExp(`SW_VERSION = '${escRe(prevVer)}'`),
    `SW_VERSION = '${newVer}'`,
    'SW_VERSION'
  );
  sw = sw.replace(
    /SW_BUILD = '[^']+'/,
    `SW_BUILD = '${kstStr}'`
  );
  write('sw.js', sw);
  console.log('   ✓ sw.js SW_VERSION + SW_BUILD');
} catch (e) {
  errors.push(`sw.js: ${e.message}`);
}

// ── 4. version.json ───────────────────────────────────────────────────────────
console.log('4. version.json 패치...');
try {
  write('version.json', JSON.stringify({
    version: newVer,
    built: kstStr,
    note: `${newVer} — bump-version.mjs 자동 패치 (수동 note 업데이트 필요)`
  }, null, 0) + '\n');
  console.log('   ✓ version.json');
} catch (e) {
  errors.push(`version.json: ${e.message}`);
}

// ── 5. 루트 CLAUDE.md ────────────────────────────────────────────────────────
console.log('5. CLAUDE.md (루트) 패치...');
try {
  let md = read('CLAUDE.md');
  // 패턴: "현재 버전: **v51.XX**"
  const rootPattern = new RegExp(`현재 버전:\\s*\\*\\*${escRe(prevVer)}\\*\\*`);
  if (rootPattern.test(md)) {
    md = md.replace(rootPattern, `현재 버전: **${newVer}**`);
    write('CLAUDE.md', md);
    console.log('   ✓ CLAUDE.md 루트');
  } else {
    // 대체 패턴: "현재 버전 → v51.XX" 등 찾기
    const altPattern = new RegExp(escRe(prevVer), 'g');
    const matches = (md.match(altPattern) || []).length;
    if (matches > 0) {
      console.log(`   ⚠ 표준 패턴 미발견. ${matches}개 단순 문자열 치환 시도 중...`);
      md = replaceAll(md, prevVer, newVer);
      write('CLAUDE.md', md);
      console.log('   ✓ CLAUDE.md 루트 (단순 치환)');
    } else {
      errors.push('CLAUDE.md (루트): 버전 패턴 미발견 — 수동 확인 필요');
    }
  }
} catch (e) {
  errors.push(`CLAUDE.md (루트): ${e.message}`);
}

// ── 6. _context/CLAUDE.md ────────────────────────────────────────────────────
// P596: this used to be a blanket replaceAll(prevVer, newVer) across the WHOLE file — which also
// silently rewrote any historical reference to the old version elsewhere in the doc (e.g. a table
// row like "GATE-BASELINE-2026-07-03.md | v51.91→v51.96 ...") into a false "→v51.98"-style claim
// on every single bump. Scope this to the "현재 버전" line specifically, exactly like the root
// CLAUDE.md patch above — fall back to a whole-file replace only if that precise line isn't found
// (and warn loudly, since that fallback is exactly what silently corrupted history before).
console.log('6. _context/CLAUDE.md 패치...');
try {
  let ctxMd = read('_context/CLAUDE.md');
  const ctxPattern = new RegExp(`(\\*\\*현재 버전\\*\\*:\\s*)${escRe(prevVer)}\\b`);
  if (ctxPattern.test(ctxMd)) {
    ctxMd = ctxMd.replace(ctxPattern, `$1${newVer}`);
    write('_context/CLAUDE.md', ctxMd);
    console.log('   ✓ _context/CLAUDE.md (현재 버전 줄만 치환)');
  } else {
    const ctxOccurrences = (ctxMd.match(new RegExp(escRe(prevVer), 'g')) || []).length;
    if (ctxOccurrences === 0) {
      errors.push('_context/CLAUDE.md: 버전 문자열 미발견');
    } else {
      console.log(`   ⚠ "현재 버전" 줄 패턴 미발견. ${ctxOccurrences}개 전체 치환 시도 중 (히스토리 텍스트 오염 위험 — 결과 수동 확인 권장)...`);
      ctxMd = replaceAll(ctxMd, prevVer, newVer);
      write('_context/CLAUDE.md', ctxMd);
      console.log(`   ✓ _context/CLAUDE.md (전체 ${ctxOccurrences}개 치환 — 수동 검토 필요)`);
    }
  }
} catch (e) {
  errors.push(`_context/CLAUDE.md: ${e.message}`);
}

// ── 7. CHANGELOG.md — 새 섹션 헤더 삽입 ────────────────────────────────────
console.log('7. CHANGELOG.md 패치...');
try {
  // R1 extension: keep active machine-readable handoff metadata on the same version.
  try {
    let contract = read('_context/MARKET-PRINCIPLES-ATLAS-AUDIT-CONTRACT-2026-08-10.json');
    contract = replaceOnce(contract,
      new RegExp(`("targetVersion"\\s*:\\s*")${escRe(prevVer)}(")`),
      `$1${newVer}$2`,
      'principles audit targetVersion'
    );
    write('_context/MARKET-PRINCIPLES-ATLAS-AUDIT-CONTRACT-2026-08-10.json', contract);

    let manifest = read('_context/MARKET-PRINCIPLES-ATLAS-HANDOFF-FILE-MANIFEST-2026-08-10.json');
    manifest = replaceOnce(manifest,
      new RegExp(`(AIO-Knowledge-System-Structural-Handoff-)${escRe(prevVer)}`),
      `$1${newVer}`,
      'principles handoff packageName'
    );
    manifest = replaceOnce(manifest,
      new RegExp(`("applicationVersion"\\s*:\\s*")${escRe(prevVer)}(")`),
      `$1${newVer}$2`,
      'principles handoff applicationVersion'
    );
    write('_context/MARKET-PRINCIPLES-ATLAS-HANDOFF-FILE-MANIFEST-2026-08-10.json', manifest);

    let handoff = read('_context/MARKET-PRINCIPLES-ATLAS-STRUCTURAL-AUDIT-HANDOFF-2026-08-10.md');
    handoff = replaceOnce(handoff,
      new RegExp(`(target_version:\\s*)${escRe(prevVer)}`),
      `$1${newVer}`,
      'principles handoff target_version'
    );
    handoff = replaceOnce(handoff,
      new RegExp(`(local_revision:\\s*)${escRe(prevVer)}`),
      `$1${newVer}`,
      'principles handoff local_revision'
    );
    write('_context/MARKET-PRINCIPLES-ATLAS-STRUCTURAL-AUDIT-HANDOFF-2026-08-10.md', handoff);

    for (const artifactPath of [
      'public-config.json',
      'architecture/asset-manifest.json',
      'architecture/release-manifest.json',
      'architecture/operations-slo.json',
      'architecture/visual-state-matrix.json',
      'architecture/public-readiness.json',
    ]) {
      let artifact = read(artifactPath);
      artifact = replaceOnce(artifact,
        new RegExp(`("appRevision"\\s*:\\s*")${escRe(prevVer)}(")`),
        `$1${newVer}$2`,
        `${artifactPath} appRevision`
      );
      if (/"workerRevision"\s*:\s*"/.test(artifact)) {
        artifact = replaceOnce(artifact,
          new RegExp(`("workerRevision"\\s*:\\s*"sw:)${escRe(prevVer)}(")`),
          `$1${newVer}$2`,
          `${artifactPath} workerRevision`
        );
      }
      write(artifactPath, artifact);
    }

    let operations = read('public-data/operations-status.json');
    operations = replaceOnce(operations,
      new RegExp(`("appRevision"\\s*:\\s*")${escRe(prevVer)}(")`),
      `$1${newVer}$2`,
      'operations status appRevision'
    );
    operations = replaceOnce(operations,
      new RegExp(`("browser"[\\s\\S]*?"revision"\\s*:\\s*")${escRe(prevVer)}(")`),
      `$1${newVer}$2`,
      'operations status browser revision'
    );
    write('public-data/operations-status.json', operations);

    let screenerHandoff = read('_context/SCREENER-OPEN-SOURCE-BENCHMARK-AND-REBUILD-HANDOFF-2026-08-12.md');
    screenerHandoff = replaceOnce(screenerHandoff,
      new RegExp(`(repository_version:\\s*)${escRe(prevVer)}`),
      `$1${newVer}`,
      'screener handoff repository_version'
    );
    write('_context/SCREENER-OPEN-SOURCE-BENCHMARK-AND-REBUILD-HANDOFF-2026-08-12.md', screenerHandoff);

    let rules = read('_context/RULES.md');
    rules = replaceOnce(rules,
      new RegExp(`(target_version:\\s*)${escRe(prevVer)}`),
      `$1${newVer}`,
      'RULES target_version'
    );
    write('_context/RULES.md', rules);
  } catch (e) {
    errors.push(`active metadata: ${e.message}`);
  }

  let cl = read('CHANGELOG.md');
  const existingHeader = `## ${newVer}`;
  if (cl.includes(existingHeader)) {
    console.log(`   ℹ CHANGELOG.md에 이미 ${newVer} 섹션 있음 — 건너뜀`);
  } else {
    // 가장 상단(첫 번째 ## 줄 앞)에 삽입.
    // 주의: 파일이 개행 없이 곧바로 '## '로 시작하면(현재 CHANGELOG.md 구조)
    // '\n## ' 탐색은 그 첫 헤더를 건너뛰고 *두 번째* 헤더 앞에 삽입해버린다
    // (v51.92 범프 때 실제로 발생 — 신규 섹션이 v51.91 섹션 뒤에 끼어들어감).
    // 정규식으로 파일 시작(index 0) 케이스까지 포함해 첫 헤더를 정확히 찾는다.
    const firstSectionMatch = cl.match(/^## /m);
    const insertPos = firstSectionMatch ? firstSectionMatch.index : 0;
    const newSection = `## ${newVer} (${todayDate})\n- <!-- 변경 내용을 이곳에 기록하세요 -->\n- R1 7곳 ${newVer}\n\n`;
    cl = cl.slice(0, insertPos) + newSection + cl.slice(insertPos);
    write('CHANGELOG.md', cl);
    console.log(`   ✓ CHANGELOG.md — ${newVer} 섹션 헤더 삽입`);
  }
} catch (e) {
  errors.push(`CHANGELOG.md: ${e.message}`);
}

// ── 결과 ─────────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────');
if (errors.length === 0) {
  console.log(`✅ ${prevVer} → ${newVer} 버전 범프 완료 (R1 7개 위치)`);
  console.log(`\n다음 작업:`);
  console.log(`  1. CHANGELOG.md의 ${newVer} 섹션에 변경 내용 기록`);
  console.log(`  2. version.json note 필드 업데이트`);
  console.log(`  3. git add -p && git commit`);
  console.log(`  4. node scripts/ci-version-check.mjs  (R1 검증)`);
} else {
  console.error(`\n❌ ${errors.length}개 오류 발생:`);
  errors.forEach(e => console.error(`  • ${e}`));
  console.error('\n수동으로 위 항목을 확인·패치하세요.');
  process.exit(1);
}

// ── 유틸: 정규식 이스케이프 ───────────────────────────────────────────────────
function escRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
