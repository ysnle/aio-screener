#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/ci-operator-secrets-contract-check.mjs
//
// 운영자 프로비저닝 경계를 기계적으로 검사한다.
//
// 계기: 저장소 시크릿(`FRED_API_KEY`, `FINNHUB_API_KEY`, `SEC_USER_AGENT` 등)이
// 어느 정본 문서에도 모여 있지 않았다. 그래서 "왜 어떤 레인이 조용히 비었는가"를
// 사람이 매번 스크립트와 핸드오프 노트를 뒤져 추론해야 했다. 특히
// `SEC_USER_AGENT`는 없을 때 수집을 건너뛰고도 통과하므로 조용한 결손이 된다.
//
// 이 게이트는:
//   1. 모든 워크플로가 참조하는 secrets.*/vars.* 가 운영자 런북에 문서화되어 있는지,
//   2. 수동 전용 배포 워크플로가 여전히 수동이며 런북에 그렇게 기록되어 있는지,
//   3. 런북이 카탈로그에서 targeted-map으로 분류되는지
// 를 확인한다.
// ─────────────────────────────────────────────────────────────────────────────

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const WORKFLOW_DIR = '.github/workflows';
const RUNBOOK = '_context/OPERATOR-RUNBOOK.md';
const CATALOG = '_context/CONTEXT-CATALOG.json';
const MANUAL_ONLY_WORKFLOWS = ['deploy-ai-proxy.yml', 'deploy-data-plane.yml'];

const failures = [];
const check = (label, ok) => { if (!ok) failures.push(label); };
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

if (!existsSync(RUNBOOK)) {
  console.error(`Operator provisioning contract failed:\n - ${RUNBOOK} is missing`);
  process.exit(1);
}
const runbook = readFileSync(RUNBOOK, 'utf8');
const workflows = existsSync(WORKFLOW_DIR)
  ? readdirSync(WORKFLOW_DIR).filter((name) => /\.ya?ml$/.test(name)).sort()
  : [];

const referenced = new Map();
for (const file of workflows) {
  const source = readFileSync(join(WORKFLOW_DIR, file), 'utf8');
  for (const match of source.matchAll(/\$\{\{\s*(secrets|vars)\.([A-Z0-9_]+)/g)) {
    const [, kind, name] = match;
    if (!referenced.has(name)) referenced.set(name, { kind, workflows: new Set() });
    referenced.get(name).workflows.add(file);
  }
}

// P1158: `dependabot.yml` has always CLAIMED that every Action is pinned to a full commit SHA,
// but nothing verified it — an unpinned `uses: actions/checkout@v5` would have drifted silently
// for as long as it took someone to read the file. A mutable tag is a supply-chain hole: whatever
// that tag points at runs with this repository's token.
for (const file of workflows) {
  const source = readFileSync(join(WORKFLOW_DIR, file), 'utf8');
  for (const match of source.matchAll(/^\s*-?\s*uses:\s*([^#\s]+)/gm)) {
    const spec = match[1];
    if (spec.startsWith('./')) continue; // local composite action, not a remote supply chain
    const [action, ref] = spec.split('@');
    check(`P1158 ${file}: ${action} is pinned to a full commit SHA (found ${spec})`, /^[0-9a-f]{40}$/.test(String(ref || '')));
  }
}

check('at least one workflow secret is declared', referenced.size > 0);
for (const [name, info] of [...referenced].sort(([left], [right]) => left.localeCompare(right))) {
  const owners = [...info.workflows].sort().join(', ');
  check(`${name} (${info.kind}, used by ${owners}) must be documented in ${RUNBOOK}`,
    new RegExp('`' + escapeRegExp(name) + '`').test(runbook));
}

// The manual-only Cloudflare deploys are the operator boundary most likely to be
// "helpfully" automated without updating the contract. Fail loudly if either the
// workflow or its documentation changes on only one side.
for (const file of MANUAL_ONLY_WORKFLOWS) {
  const path = join(WORKFLOW_DIR, file);
  check(`${file} exists`, existsSync(path));
  if (!existsSync(path)) continue;
  check(`${file} stays manual-only until its contract is updated deliberately`, /workflow_dispatch:\s*\{\}/.test(readFileSync(path, 'utf8')));
  check(`${file} is documented as operator-run in ${RUNBOOK}`, new RegExp(escapeRegExp(file)).test(runbook));
}

if (existsSync(CATALOG)) {
  const catalog = JSON.parse(readFileSync(CATALOG, 'utf8'));
  const entry = (catalog.documents || []).find((doc) => doc.path === RUNBOOK);
  check(`${RUNBOOK} is cataloged as a targeted reference`, entry?.kind === 'targeted-map' && entry?.readPolicy === 'targeted');
}

if (failures.length) {
  console.error('Operator provisioning contract failed:');
  failures.forEach((failure) => console.error(` - ${failure}`));
  process.exit(1);
}
console.log(`Operator provisioning contract OK: ${referenced.size} documented secret/variable references, ${MANUAL_ONLY_WORKFLOWS.length} manual-only deploys declared.`);
