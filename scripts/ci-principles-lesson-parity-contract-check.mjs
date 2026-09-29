import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const builderPath = 'scripts/build-principles-lessons.mjs';
const canonicalPath = 'public-data/principles/lesson-library.json';
const canonical = JSON.parse(readFileSync(join(root, canonicalPath), 'utf8'));
const canonicalD6 = canonical.lessons?.find((lesson) => lesson.id === 'D6');
const builderSource = readFileSync(join(root, builderPath), 'utf8');
const failures = [];
const checks = [];

function check(label, passed, detail = '') {
  checks.push(label);
  if (!passed) failures.push(`${label}${detail ? `: ${detail}` : ''}`);
}

check('P1303/R560/QA-DATA-47 canonical Principles library contains 112 lessons and D6',
  canonical.lessons?.length === 112 && canonicalD6?.title === '중립금리와 정책 스탠스');
check('P1303/R560/QA-DATA-47 lesson builder publishes through the shared atomic JSON writer',
  /import\s+\{\s*atomicWriteJsonSync\s*\}\s+from\s+['"]\.\/lib\/atomic-write\.mjs['"]/.test(builderSource)
    && /atomicWriteJsonSync\(outputPath,\s*artifact\)/.test(builderSource)
    && !/\bfs\.writeFileSync\s*\(|\bfs\.writeFile\s*\(/.test(builderSource));

const isolatedRoot = mkdtempSync(join(tmpdir(), 'aio-principles-lesson-parity-'));
const inputPaths = [builderPath, 'scripts/lib/atomic-write.mjs', 'public-data/principles/chapters.json'];
try {
  for (const relativePath of inputPaths) {
    const target = join(isolatedRoot, relativePath);
    mkdirSync(dirname(target), { recursive: true });
    copyFileSync(join(root, relativePath), target);
  }

  const outputPath = join(isolatedRoot, canonicalPath);
  const outputs = [];
  const runResults = [];
  for (let runIndex = 0; runIndex < 2; runIndex += 1) {
    const result = spawnSync(process.execPath, [join(isolatedRoot, builderPath)], {
      cwd: isolatedRoot,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    runResults.push(result);
    if (result.status !== 0) break;
    outputs.push(readFileSync(outputPath, 'utf8').replace(/\r\n/g, '\n'));
  }

  const runFailure = runResults.find((result) => result.status !== 0);
  check('P1303/R560/QA-DATA-47 isolated builder runs succeed twice',
    runResults.length === 2 && !runFailure,
    runFailure ? String(runFailure.stderr || runFailure.stdout || `exit ${runFailure.status}`).trim() : 'second run was not reached');

  const generated = outputs.length ? JSON.parse(outputs[0]) : null;
  const generatedD6 = generated?.lessons?.find((lesson) => lesson.id === 'D6');
  check('P1303/R560/QA-DATA-47 builder output retains all 112 canonical lesson entries including D6',
    generated?.lessons?.length === 112 && generatedD6?.title === '중립금리와 정책 스탠스');
  check('P1303/R560/QA-DATA-47 builder preserves D6 content and metadata from the canonical artifact',
    Boolean(generatedD6 && canonicalD6 && isDeepStrictEqual(generatedD6, canonicalD6)));
  check('P1303/R560/QA-DATA-47 repeated isolated builder runs produce identical target bytes',
    outputs.length === 2 && outputs[0] === outputs[1]);
} finally {
  rmSync(isolatedRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

if (failures.length) {
  console.error(`Principles lesson parity contract failed (${failures.length}/${checks.length}):`);
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}

console.log(`Principles lesson parity contract OK: ${checks.length} checks, 112 lessons, D6 metadata preserved, deterministic output.`);
