// scripts/ci-doc-currency-check.mjs — WO-8 (P669): _context/CODE-MAP.md currency check.
//
// 왜: CODE-MAP.md는 "작업 전 이 파일에서 담당 파일과 범위를 찾고..."라는 자기 목적을 갖는
// 탐색 지도인데, 자기 frontmatter의 target_version(v51.90)과 파일 크기 표가 실제 코드
// 대비 계속 낡아가도(이번 조사 실측: 32,025→32,220, 24,117→24,482, 17,535→17,894,
// 6,877→6,955, 7,312→7,796줄 드리프트) 이를 감지하는 자동 장치가 전혀 없었다(WO-8/F-08
// 성격 — "운영 사실과 문서 drift를 CI가 검출"). 이 스크립트는 CODE-MAP.md의 파일 크기
// 표를 실제 `wc -l`과 대조해 드리프트를 정량화한다. 하드 실패(exit 1)는 걸지 않는다 —
// 줄 수는 정상적인 개발 중에도 계속 변하므로, 매 커밋마다 CODE-MAP을 갱신하라고 강제하면
// 오히려 CI를 무시하게 만드는 역효과(R280류 "게이트가 시끄러우면 무시당한다" 패턴)가
// 난다. 대신 이 프로젝트가 이미 스스로 정한 임계값(CLAUDE.md R: "리팩토링 ±500줄 이상
// 변경 시 CODE-MAP 갱신")을 넘는 드리프트만 경고로 표시한다.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const actualLines = (p) => read(p).split('\n').length - (read(p).endsWith('\n') ? 1 : 0);

const DRIFT_WARN_THRESHOLD = 500; // R1 인접 규칙과 동일 임계값(CLAUDE.md: ±500줄 이상 변경 시 CODE-MAP 갱신)

const codeMap = read('_context/CODE-MAP.md');
const version = JSON.parse(read('version.json')).version;

const warnings = [];
const info = [];
const gitHead = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const workingTreeClean = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim() === '';

// SA-05: current preflight is generated state; historical session cards must not
// be mistaken for the current checkout/version/deployment status.
for (const docPath of ['_context/ARCHITECTURE-REMEDIATION-HANDOFF-2026-07-19.md', '_context/ARCHITECTURE-REBUILD-EXECUTION-PLAN-2026-07-19.md']) {
  const doc = read(docPath);
  const blockMatch = doc.match(/## Current generated preflight \(P\d+, \d{4}-\d{2}-\d{2}\)[\s\S]*?(?=\n## |\n# |$)/);
  if (!blockMatch) {
    warnings.push(`${docPath} is missing the generated current preflight block`);
    continue;
  }
  const block = blockMatch[0];
  if (!block.includes('GENERATED-CURRENT-PREFLIGHT: scripts/ci-doc-currency-check.mjs')) warnings.push(`${docPath} current preflight is not marked generated`);
  if (!workingTreeClean && !block.includes(`git_head: \`${gitHead}\``)) warnings.push(`${docPath} current preflight git_head is stale (expected ${gitHead})`);
  if (!block.includes(`application_version: \`${version}\``)) warnings.push(`${docPath} current preflight application_version is stale (expected ${version})`);
  if (!block.includes(workingTreeClean ? 'working_tree: `clean / committed local changes`' : 'working_tree: `dirty / uncommitted local changes`')) warnings.push(`${docPath} current preflight must state the current working-tree status`);
  if (!block.includes('historical_cards: `HEAD/version/deployment values below are historical evidence')) warnings.push(`${docPath} current preflight does not label historical cards`);
  if (/\n\s*Checkout\/HEAD\/version\/liveRevision:/.test(doc) || /\n\s*Working tree:/.test(doc)) warnings.push(`${docPath} contains an unlabeled historical checkout/deployment claim`);
  info.push(`${docPath}: generated current preflight matches ${gitHead}/${version}`);
}

// frontmatter의 target_version과 현재 버전 비교
const targetVersionMatch = codeMap.match(/target_version:\s*(v[\d.]+)/);
if (targetVersionMatch) {
  info.push(`CODE-MAP.md target_version: ${targetVersionMatch[1]} (current: ${version})`);
  if (targetVersionMatch[1] !== version) {
    // 버전 문자열만으로 몇 버전 뒤인지 정확히 계산하긴 어려우니(2자리 patch 등) 문자열 비교만 — 다를 때 정보성 안내만.
    info.push(`  (버전 문자열이 다름 — 자연스러운 드리프트일 수 있음, 아래 줄 수 드리프트가 실제 판단 기준)`);
  }
}

// 파일 크기 표 행 파싱: | `파일명` | 숫자(옵션 텍스트) | ...
const FILES = ['index.html', 'js/aio-core.js', 'js/aio-data.js', 'js/aio-ui.js', 'js/aio-chat.js', 'js/aio-tests.js', 'js/aio-glossary.js'];
for (const file of FILES) {
  const escaped = file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const rowMatch = codeMap.match(new RegExp('\\|\\s*`' + escaped + '`\\s*\\|\\s*([\\d,]+)'));
  if (!rowMatch) { warnings.push(`CODE-MAP.md에서 ${file}의 파일 크기 표 행을 찾을 수 없음 — 표 형식이 바뀌었을 수 있음`); continue; }
  const claimed = Number(rowMatch[1].replace(/,/g, ''));
  const actual = actualLines(file);
  const drift = actual - claimed;
  info.push(`${file}: CODE-MAP claims ${claimed}, actual ${actual} (drift ${drift >= 0 ? '+' : ''}${drift})`);
  if (Math.abs(drift) >= DRIFT_WARN_THRESHOLD) {
    warnings.push(`${file} drift is ${drift >= 0 ? '+' : ''}${drift} lines (>= ${DRIFT_WARN_THRESHOLD} threshold) — CODE-MAP.md's file-size table and target_version are due for a rescan per this repo's own "±500줄 이상 변경 시 CODE-MAP 갱신" rule`);
  }
}

console.log('[ci-doc-currency-check] ' + info.join('\n[ci-doc-currency-check] '));
if (warnings.length) {
  console.warn(`\n[ci-doc-currency-check] ⚠ ${warnings.length} currency warning(s) (non-blocking):`);
  warnings.forEach((w) => console.warn(' - ' + w));
} else {
  console.log('\n[ci-doc-currency-check] ✅ no file drifted past the ±500-line threshold since CODE-MAP.md was last verified');
}
// 의도적으로 항상 exit 0 — 위 주석 참조(하드 실패는 게이트 회피를 유발). 드리프트 가시화가 목적.
process.exit(0);
