// scripts/ci-control-char-check.mjs — WO-0 (CODEX-COMPREHENSIVE-DIAGNOSIS-2026-07-10.md, P0)
//
// 왜: data-watchdog.yml에 U+0080 C1 제어문자 5개가 mojibake로 유입돼 PyYAML이
// "unacceptable character #x0080"로 파싱 자체를 거부했고, GitHub Data Watchdog 워크플로가
// job 생성 전에 즉시 실패했다(run 29059996134). 이 클래스의 재발을 막는 게이트가 전혀 없었다.
//
// 1) .github/workflows/*.yml: 제어문자 0건 + js-yaml 구조 파싱 PASS를 하드 게이트(예외 없음) —
//    워크플로 파일은 작고 사람이 자주 편집하지 않으므로 즉시 완전히 깨끗해야 한다.
// 2) 저장소 전체(문서/코드, public-data 생성물 제외): 같은 세션에서 발견한 대규모 기존 손상
//    (CHANGELOG.md, BUG-POSTMORTEM.md 등)은 git 히스토리 대조로 가능한 만큼 즉시 복구했지만
//    (P659 참조), 히스토리에 깨끗한 선행 버전이 없는("애초에 손상된 채로 추가된") 잔여분은
//    문자 단위 무결성 없이는 안전하게 재구성할 수 없다 — baseline으로 기록해 회귀만 차단한다.
//    baseline보다 늘어나면 실패(새 손상 유입 차단), 줄어들면 baseline을 갱신해 개선을 인정한다.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { loadAll } from 'js-yaml';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const BASELINE_PATH = '_context/control-char-baseline.json';

const errors = [];
const warnings = [];

// C0 (tab/lf/cr 제외) + C1 제어문자 범위 — mojibake의 실제 시그니처(U+0080 등)를 잡는다.
const CONTROL_CODE_RANGES = [
  [0x00, 0x08],
  [0x0b, 0x0c],
  [0x0e, 0x1f],
  [0x7f, 0x9f],
];

function isControlCode(code) {
  for (const [lo, hi] of CONTROL_CODE_RANGES) {
    if (code >= lo && code <= hi) return true;
  }
  return false;
}

function countControlChars(text) {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    if (isControlCode(text.charCodeAt(i))) n++;
  }
  return n;
}

// ── 1) 워크플로 YAML: 하드 게이트 (baseline 없음, 0건 필수) ─────────────────────
const workflowFiles = execSync('git ls-files .github/workflows', { cwd: root, encoding: 'utf8' })
  .split('\n')
  .map((s) => s.trim())
  .filter((s) => s.endsWith('.yml') || s.endsWith('.yaml'));

for (const wf of workflowFiles) {
  const text = read(wf);
  const n = countControlChars(text);
  if (n > 0) errors.push(`${wf}: 제어문자 ${n}건 발견 (workflow YAML은 0건 필수)`);
  try {
    loadAll(text);
  } catch (e) {
    errors.push(`${wf}: YAML 파싱 실패 — ${e.message.split('\n')[0]}`);
  }
}
if (workflowFiles.length === 0) errors.push('워크플로 파일을 찾지 못함 — glob 경로 확인 필요');

// ── 2) 저장소 전체: baseline 대비 회귀만 차단 ────────────────────────────────
const allTracked = execSync('git ls-files', { cwd: root, encoding: 'utf8' }).split('\n').map((s) => s.trim());
const scanTargets = allTracked.filter(
  (f) =>
    /\.(md|yml|yaml|js|mjs|json|html)$/.test(f) &&
    !f.startsWith('public-data/') && // 30분마다 자동 갱신되는 생성물 — 사람이 편집하지 않고 stale corruption이 누적되지 않음
    !f.startsWith('node_modules/')
);

const currentCounts = {};
for (const f of scanTargets) {
  let text;
  try {
    text = read(f);
  } catch (e) {
    continue; // 바이너리 등 read 실패는 스캔 대상 아님
  }
  const n = countControlChars(text);
  if (n > 0) currentCounts[f] = n;
}

let baseline = {};
if (existsSync(join(root, BASELINE_PATH))) {
  try {
    baseline = JSON.parse(read(BASELINE_PATH)).counts || {};
  } catch (e) {
    errors.push(`${BASELINE_PATH} 파싱 실패: ${e.message}`);
  }
} else {
  errors.push(`${BASELINE_PATH} 없음 — node scripts/ci-control-char-check.mjs --write-baseline 로 최초 생성 필요`);
}

for (const [f, n] of Object.entries(currentCounts)) {
  const base = baseline[f] || 0;
  if (n > base) {
    errors.push(`${f}: 제어문자 ${n}건 (baseline ${base}건보다 증가 — 새 mojibake 유입 의심)`);
  } else if (n < base) {
    warnings.push(`${f}: 제어문자 ${n}건 (baseline ${base}건보다 감소 — baseline 갱신 권장: --write-baseline)`);
  }
}
for (const f of Object.keys(baseline)) {
  if (!(f in currentCounts) && baseline[f] > 0) {
    warnings.push(`${f}: baseline엔 ${baseline[f]}건 있었으나 현재 0건(완전 해소) — baseline 갱신 권장`);
  }
}

// ── --write-baseline: 현재 상태를 새 baseline으로 기록 (감소/해소 인정용, CI에서는 사용 안 함) ──
if (process.argv.includes('--write-baseline')) {
  writeFileSync(
    join(root, BASELINE_PATH),
    JSON.stringify(
      {
        note:
          'WO-0/P659: control character (mojibake) baseline. 새 파일에 제어문자가 생기거나 기존 건수가 늘면 ' +
          'ci-control-char-check.mjs가 실패한다. 이 파일에 없는 잔여분은 git 히스토리에 깨끗한 선행 버전이 없어 ' +
          '(애초에 손상된 채로 커밋됨) 문자 단위 재구성이 불가능하다고 판단한 항목이다.',
        updated: new Date().toISOString().slice(0, 10),
        counts: currentCounts,
      },
      null,
      2
    ) + '\n'
  );
  console.log(`baseline 기록 완료: ${Object.keys(currentCounts).length}개 파일, 총 ${Object.values(currentCounts).reduce((a, b) => a + b, 0)}건`);
  process.exit(0);
}

if (errors.length) {
  console.error('Control character check failed:');
  errors.forEach((e) => console.error(' - ' + e));
  if (warnings.length) {
    console.error('Warnings:');
    warnings.forEach((w) => console.error(' - ' + w));
  }
  process.exit(1);
}

console.log(
  `Control character check OK: ${workflowFiles.length} workflow YAML(s) clean+parseable, ` +
    `${Object.keys(currentCounts).length} file(s) with baseline-tracked pre-existing control chars, 0 regressions.`
);
if (warnings.length) warnings.forEach((w) => console.warn('WARN: ' + w));
