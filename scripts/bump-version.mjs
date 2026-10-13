#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/bump-version.mjs — R1 버전 동기화 자동화 (v51.64)
//
// 사용법:
//   node scripts/bump-version.mjs <새버전>
//   node scripts/bump-version.mjs v51.65
//
// R1 버전 표면과 생성형 현재 상태를 한 번에 패치:
//   1. index.html  — <title>, badge span, ?v= 캐시버스터 4곳
//   2. js/aio-core.js — APP_VERSION 상수
//   3. sw.js       — SW_VERSION + SW_BUILD
//   4. version.json
//   5. CLAUDE.md (루트)   — "현재 버전" 줄 (있을 때만; 없으면 건너뜀)
//   6. _context/CLAUDE.md — "현재 버전" 줄 (있을 때만; 없으면 건너뜀)
//   7. 런타임/배포 메타데이터 — public-config.json, architecture/*.json appRevision·workerRevision,
//      worker/wrangler.proxy.toml AIO_APP_REVISION, public-data/operations-status.json
//   8. CHANGELOG.md — 새 버전 섹션 헤더 삽입
//   9. _context/CURRENT-STATE.md + CONTEXT-CATALOG.json 재생성
//
// 설계 원칙 (R1):
//   - 이 스크립트가 유일한 버전 패치 경로. 직접 파일 편집은 금지.
//   - CI ci-version-check.mjs가 결과를 검증.
//   - CHANGELOG.md에 새 섹션 헤더를 자동 삽입하지만 내용은 직접 채워야 함.
//   - v57.54: 날짜가 박힌 과거 핸드오프 문서(MARKET-PRINCIPLES-ATLAS-*-2026-08-10.*,
//     SCREENER-OPEN-SOURCE-BENCHMARK-AND-REBUILD-HANDOFF-2026-08-12.md)와 RULES.md frontmatter
//     target_version은 더 이상 다시 쓰지 않는다. 그 문서들은 마지막 값(v57.54)에 동결된 이력이며,
//     매 범프마다 "현재 버전"으로 재라벨링하면 이력을 위조하고 diff만 늘린다. 앱·배포가 실제로
//     읽는 표면(1~4, 7)만 패치한다.
// ─────────────────────────────────────────────────────────────────────────────

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execFileSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { alignGeneratedVersion, GENERATED_VERSION_FILES } from './lib/align-generated-version.mjs';

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
  if (!pattern.test(content)) {
    if (resumeFrom && targetPattern(pattern).test(content)) return content;
    throw new Error(`패턴 미발견 (${label}): ${pattern}`);
  }
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
// Recover a partially written bump without rolling back user edits or advancing
// the version again. Usage: bump-version.mjs v54.68 --resume-from v54.67
const resumeIndex = process.argv.indexOf('--resume-from');
const resumeFrom = resumeIndex >= 0 ? canonicalizeVersion(process.argv[resumeIndex + 1] || '') : null;
if (resumeIndex >= 0 && !resumeFrom) {
  console.error('Invalid --resume-from version');
  process.exit(1);
}
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
  if (resumeFrom) {
    if (prevVer !== newVer && prevVer !== resumeFrom) throw new Error('Resume requires the source or target version in version.json');
    prevVer = resumeFrom;
  }
} catch (e) {
  console.error('version.json 파싱 실패:', e.message);
  process.exit(1);
}

// P1355: align only incoming producer metadata to this already-versioned local app.
if (process.argv.includes('--align-generated')) {
  try {
    if (resumeFrom || prevVer !== newVer) throw new Error('--align-generated requires the existing current version, without --resume-from');
    const documents = Object.fromEntries(GENERATED_VERSION_FILES.map((path) => [path, JSON.parse(read(path))]));
    const aligned = alignGeneratedVersion(documents, { version: newVer, snapshotRevision: JSON.parse(read('public-data/market-snapshot.json')).revision });
    const originals = Object.fromEntries(GENERATED_VERSION_FILES.map((path) => [path, read(path)]));
    try { for (const path of GENERATED_VERSION_FILES) write(path, JSON.stringify(aligned[path], null, 2) + '\n'); }
    catch (error) { for (const path of GENERATED_VERSION_FILES) { try { write(path, originals[path]); } catch (_) {} } throw error; }
    console.log(`Generated version metadata aligned to ${newVer}; producer times and data identity preserved.`);
    process.exit(0);
  } catch (error) { console.error(error.message); process.exit(1); }
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
const targetPattern = (pattern) => new RegExp(pattern.source.replaceAll(escRe(prevVer), escRe(newVer)), pattern.flags);
const requirePreflight = (rel, pattern, label) => {
  const content = read(rel);
  if (!pattern.test(content) && !(resumeFrom && targetPattern(pattern).test(content))) throw new Error(`${rel}: preflight target missing (${label})`);
};
try {
  requirePreflight('index.html', new RegExp(`AIO Screener ${escRe(prevVer)}`), 'title');
  requirePreflight('index.html', new RegExp(`id="app-version-badge">${escRe(prevVer)}</span>`), 'badge');
  requirePreflight('js/aio-core.js', new RegExp(`const APP_VERSION = '${escRe(prevVer)}'`), 'APP_VERSION');
  requirePreflight('sw.js', new RegExp(`SW_VERSION = '${escRe(prevVer)}'`), 'SW_VERSION');
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
  // The deployed Worker reports AIO_APP_REVISION on /health. It sat at v54.37 while the
  // app moved on, so a live probe could not be trusted to identify the revision it served.
  requirePreflight('worker/wrangler.proxy.toml', new RegExp(`AIO_APP_REVISION\\s*=\\s*\"${escRe(prevVer)}\"`), 'proxy worker revision');
  requirePreflight('public-data/operations-status.json', new RegExp(`(\"appRevision\"\\s*:\\s*\")${escRe(prevVer)}(\")`), 'operations appRevision');
  requirePreflight('public-data/operations-status.json', new RegExp(`(\"browser\"[\\s\\S]*?\"revision\"\\s*:\\s*\")${escRe(prevVer)}(\")`), 'operations browser revision');
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
  if (cbCount === 0 && !(resumeFrom && html.includes(`?v=${shortVer}`))) throw new Error(`캐시버스터 ?v=${prevShort} 없음`);
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

// ── 5–6. 에이전트 가이드의 "현재 버전" 줄 ─────────────────────────────────────
// 정본은 version.json과 생성형 _context/CURRENT-STATE.md다. 가이드가 "현재 버전" 줄을 들고 있으면
// 그 한 줄만 바꾸고(P596: 문서 전체 치환은 과거 기록을 위조했다), 줄이 없으면 아무것도 쓰지 않는다.
// 예전에는 줄이 없을 때 파일 전체의 prevVer를 치환하는 대체 경로가 있었는데, 그 경로가 이력 텍스트를
// 오염시키는 원인이었으므로 제거했다. 가이드에서 이 줄을 지우면 범프 대상에서 자연스럽게 빠진다.
for (const [step, rel, pattern] of [
  ['5', 'CLAUDE.md', new RegExp(`(현재 버전:\\s*\\*\\*)${escRe(prevVer)}(\\*\\*)`)],
  ['6', '_context/CLAUDE.md', new RegExp(`(\\*\\*현재 버전\\*\\*:\\s*)${escRe(prevVer)}\\b()`)],
]) {
  console.log(`${step}. ${rel} 패치...`);
  try {
    const md = read(rel);
    if (pattern.test(md)) {
      write(rel, md.replace(pattern, `$1${newVer}$2`));
      console.log(`   ✓ ${rel} (현재 버전 줄만 치환)`);
    } else {
      console.log(`   - ${rel}: "현재 버전" 줄 없음 또는 이미 동기화됨 — 건너뜀`);
    }
  } catch (e) {
    errors.push(`${rel}: ${e.message}`);
  }
}

// ── 7. CHANGELOG.md — 새 섹션 헤더 삽입 ────────────────────────────────────
console.log('7. CHANGELOG.md 패치...');
try {
  // R1 extension: runtime/deploy revision metadata that the app, Worker /health and release gates read.
  // Dated handoff documents and ledger frontmatter are frozen history and are not rewritten (v57.54).
  try {
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

    let proxyToml = read('worker/wrangler.proxy.toml');
    proxyToml = replaceOnce(proxyToml,
      new RegExp(`(AIO_APP_REVISION\\s*=\\s*")${escRe(prevVer)}(")`),
      `$1${newVer}$2`,
      'proxy worker revision'
    );
    write('worker/wrangler.proxy.toml', proxyToml);

    // A version bump invalidates revision-bound browser evidence. Preserve the
    // previous measurement as history, but never relabel it as proof for the
    // new source revision merely because appRevision changed.
    const operationsSlo = JSON.parse(read('architecture/operations-slo.json'));
    const routeSoak = operationsSlo.localBoundary?.routeSoak;
    if (routeSoak) {
      if (routeSoak.status === 'pass') {
        routeSoak.previousEvidence = {
          appRevision: prevVer,
          status: 'pass',
          browserErrors: routeSoak.browserErrors,
          maxCanvases: routeSoak.maxCanvases,
          entityRoundTrip: routeSoak.entityRoundTrip,
          report: routeSoak.report
        };
      }
      routeSoak.status = 'pending';
      routeSoak.evidenceStatus = 'REMEASURE_REQUIRED';
      routeSoak.reason = `Source revision changed from ${prevVer} to ${newVer}; route-soak evidence remains historical until rerun.`;
      delete routeSoak.browserErrors;
      delete routeSoak.maxCanvases;
      delete routeSoak.entityRoundTrip;
    }
    write('architecture/operations-slo.json', `${JSON.stringify(operationsSlo, null, 2)}\n`);

    const publicReadiness = JSON.parse(read('architecture/public-readiness.json'));
    const routeSoakCriterion = publicReadiness.criteria?.find((criterion) => criterion.id === 'route-soak');
    if (routeSoakCriterion) {
      routeSoakCriterion.status = 'PENDING_LOCAL_GATE';
      routeSoakCriterion.evidence = `Previous route-soak evidence predates ${newVer}; run ci-route-soak-check.mjs once at the release boundary.`;
    }
    write('architecture/public-readiness.json', `${JSON.stringify(publicReadiness, null, 2)}\n`);

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

// ── 8. generated current state/catalog ──────────────────────────────────────
if (errors.length === 0) {
  console.log('8. generated current state/catalog 갱신...');
  try {
    execFileSync(process.execPath, [resolve(ROOT, 'scripts/generate-workspace-state.mjs'), '--write'], {
      cwd: ROOT,
      stdio: 'inherit',
    });
    console.log('   ✓ CURRENT-STATE.md + CONTEXT-CATALOG.json');
  } catch (e) {
    errors.push(`generated workspace state: ${e.message}`);
  }
}

// ── 결과 ─────────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────');
if (errors.length === 0) {
  console.log(`✅ ${prevVer} → ${newVer} 버전 범프 완료 (R1 + generated state)`);
  console.log(`\n다음 작업:`);
  console.log(`  1. CHANGELOG.md의 ${newVer} 섹션에 변경 내용 기록`);
  console.log(`  2. version.json note 필드 업데이트`);
  console.log(`  3. node scripts/ci-version-check.mjs  (R1 검증)`);
  console.log(`  4. 커밋·배포는 사용자가 명시적으로 요청한 경우에만 수행`);
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
