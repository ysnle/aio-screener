import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

const GENERATED_CONTEXT = new Set(['CURRENT-STATE.md', 'CONTEXT-CATALOG.json']);
const PREFLIGHT_CONTEXT = new Set(['CURRENT-STATE.md', 'WORKFLOW-GOVERNANCE.md', 'INDEX.md']);
const LEDGER_CONTEXT = new Set(['RULES.md', 'BUG-POSTMORTEM.md', 'QA-CHECKLIST.md', 'KNOWLEDGE-BASE.md']);
const TARGETED_CONTEXT = new Set(['CLAUDE.md', 'CODE-MAP.md', 'QA-PIPELINE-ARCHITECTURE.md']);

export const readUtf8 = (root, path) => readFileSync(join(root, path), 'utf8');
const lineCount = (text) => text.split(/\r?\n/).length - (text.endsWith('\n') ? 1 : 0);
const json = (root, path) => JSON.parse(readUtf8(root, path));

function extractFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) return null;
  const result = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) result[field[1]] = field[2].trim();
  }
  return result;
}

function extractTitle(text, fallback) {
  const title = text.match(/^#\s+(.+)$/m)?.[1]?.trim() || '';
  return title && !title.includes('\uFFFD') ? title : fallback;
}

function contextKind(file) {
  if (GENERATED_CONTEXT.has(file)) return 'generated';
  if (PREFLIGHT_CONTEXT.has(file)) return 'preflight';
  if (LEDGER_CONTEXT.has(file)) return 'ledger';
  if (TARGETED_CONTEXT.has(file)) return 'targeted-map';
  if (file.endsWith('.json')) return 'machine-contract';
  if (/^RESEARCH-INTEGRATION-/.test(file)) return 'research-record';
  if (/^(AIO-CURRENT|SCREENER-|MARKET-PRINCIPLES-ATLAS)/.test(file)) return 'current-handoff';
  return 'historical-snapshot';
}

function readPolicy(kind) {
  if (kind === 'preflight') return 'required';
  if (['ledger', 'targeted-map', 'machine-contract', 'research-record', 'current-handoff'].includes(kind)) return 'targeted';
  if (kind === 'generated') return 'generated';
  return 'explicit-only';
}

function contextFiles(root) {
  return readdirSync(join(root, '_context'), { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(?:md|json)$/.test(entry.name))
    .map((entry) => entry.name)
    .filter((name) => !['working-rules.md', 'voice-and-style.md'].includes(name))
    .sort();
}

export function buildContextCatalog(root) {
  const files = contextFiles(root);
  const documents = files.map((file) => {
    const kind = contextKind(file);
    if (GENERATED_CONTEXT.has(file)) {
      return { path: `_context/${file}`, title: file.replace(/\.[^.]+$/, ''), kind, readPolicy: readPolicy(kind), generated: true };
    }
    const path = join(root, '_context', file);
    const text = readFileSync(path, 'utf8');
    const frontmatter = file.endsWith('.md') ? extractFrontmatter(text) : null;
    return {
      path: `_context/${file}`,
      title: file.endsWith('.md') ? extractTitle(text, file) : file,
      kind,
      readPolicy: readPolicy(kind),
      bytes: statSync(path).size,
      lines: lineCount(text),
      lastVerified: frontmatter?.last_verified || null,
      autoRefresh: frontmatter?.auto_refresh === 'true'
    };
  });
  return {
    schemaVersion: 'aio-context-catalog.v1',
    generatedBy: 'scripts/generate-workspace-state.mjs',
    selfExcludedFromSizeAccounting: true,
    classificationPolicy: {
      required: 'Read on every task: current facts, governance, and routing only.',
      targeted: 'Search or read only when the task touches the named domain.',
      explicitOnly: 'Point-in-time evidence; never load by default or treat as current state.'
    },
    documentCount: documents.length,
    documents
  };
}

function maxHeading(text, prefix) {
  const values = [...text.matchAll(new RegExp(`^##\\s+${prefix}(\\d+)\\b`, 'gm'))].map((match) => Number(match[1]));
  return values.length ? Math.max(...values) : null;
}

function qaSummary(text) {
  const open = [...text.matchAll(/^- \[ \]\s+([^:\n]+):?\s*(.*)$/gm)].map((match) => ({
    id: match[1].trim(),
    text: match[2].trim()
  }));
  const unique = new Map();
  for (const item of open) if (!unique.has(item.id)) unique.set(item.id, item);
  const superseded = [...unique.values()].filter((item) => /대체|supersed|replaced/i.test(item.text));
  return { openItems: open.length, uniqueOpenIds: unique.size, supersededOpenIds: superseded.length };
}

function countDirs(root, path) {
  const full = join(root, path);
  if (!existsSync(full)) return 0;
  return readdirSync(full, { withFileTypes: true }).filter((entry) => entry.isDirectory() && entry.name !== '_shared').length;
}

function countFiles(root, path, predicate = () => true) {
  const full = join(root, path);
  if (!existsSync(full)) return 0;
  return readdirSync(full, { withFileTypes: true }).filter((entry) => entry.isFile() && predicate(entry.name)).length;
}

export function buildWorkspaceState(root) {
  const version = json(root, 'version.json');
  const routes = json(root, 'architecture/route-owners.json');
  const knowledge = json(root, 'public-data/knowledge/status-summary.json');
  const readiness = json(root, 'architecture/public-readiness.json');
  const operations = json(root, 'public-data/operations-status.json');
  const rules = readUtf8(root, '_context/RULES.md');
  const postmortem = readUtf8(root, '_context/BUG-POSTMORTEM.md');
  const qa = readUtf8(root, '_context/QA-CHECKLIST.md');
  const html = readUtf8(root, 'index.html');
  const catalog = buildContextCatalog(root);
  const kinds = {};
  for (const doc of catalog.documents) kinds[doc.kind] = (kinds[doc.kind] || 0) + 1;
  const codeMapFiles = ['index.html', 'js/aio-core.js', 'js/aio-data.js', 'js/aio-ui.js', 'js/aio-chat.js', 'js/aio-tests.js', 'js/aio-glossary.js'];
  const codeFootprint = Object.fromEntries(codeMapFiles.map((path) => {
    const text = readUtf8(root, path);
    return [path, { lines: lineCount(text), bytes: Buffer.byteLength(text, 'utf8') }];
  }));

  return {
    schemaVersion: 'aio-workspace-state.v1',
    generatedBy: 'scripts/generate-workspace-state.mjs',
    generatedFromBuild: version.built,
    application: {
      version: version.version,
      architecture: 'hybrid-static-shell-native-esm',
      activeRoutes: routes.counts?.totalRoutes ?? Object.keys(routes.routes || {}).length,
      routeRegistry: 'architecture/route-owners.json',
      appShell: { lines: lineCount(html), bytes: Buffer.byteLength(html, 'utf8') },
      codeFootprint
    },
    workspace: {
      contextDocuments: catalog.documentCount,
      contextByKind: kinds,
      skills: countDirs(root, '.claude/skills'),
      commandWrappers: countFiles(root, '.claude/commands', (name) => name.endsWith('.md')),
      agentProfiles: countFiles(root, '.codex/agents', (name) => name.endsWith('.toml')),
      workflows: countFiles(root, '.github/workflows', (name) => /\.ya?ml$/.test(name)),
      ciScripts: countFiles(root, 'scripts', (name) => /^ci-.*\.mjs$/.test(name)),
      latestRule: maxHeading(rules, 'R'),
      latestPostmortem: maxHeading(postmortem, 'P'),
      qa: qaSummary(qa),
      canonicalSkills: '.claude/skills',
      codexSkillMirror: '.agents/skills',
      currentState: '_context/CURRENT-STATE.md',
      contextCatalog: '_context/CONTEXT-CATALOG.json'
    },
    knowledge: {
      status: knowledge.status,
      units: knowledge.coverage?.units,
      researched: knowledge.research?.researched,
      inProgress: knowledge.research?.inProgress,
      researchRequired: knowledge.research?.required,
      articles: knowledge.articles?.total,
      humanReviewComplete: knowledge.humanReviewComplete,
      publicationReady: knowledge.publicationReady,
      source: 'public-data/knowledge/status-summary.json'
    },
    operations: {
      repositoryArtifactGeneratedAt: operations.generatedAt || null,
      overall: operations.overall || null,
      publicStage: readiness.currentStage,
      publicBetaDecision: readiness.publicBetaDecision,
      liveStatePolicy: 'Live/deployed state is measured at runtime and is never copied into durable current-state prose.',
      sources: ['public-data/operations-status.json', 'architecture/public-readiness.json']
    }
  };
}

export function renderCurrentState(state) {
  const q = state.workspace.qa;
  const k = state.knowledge;
  const codeRows = Object.entries(state.application.codeFootprint)
    .map(([path, value]) => `| \`${path}\` | ${value.lines.toLocaleString('en-US')} | ${value.bytes.toLocaleString('en-US')} |`)
    .join('\n');
  return `---
generated_by: scripts/generate-workspace-state.mjs
generated_from_build: ${state.generatedFromBuild}
auto_refresh: true
last_verified: ${String(state.generatedFromBuild).slice(0, 10)}
---

# AIO Current State

이 문서는 저장소에서 생성되는 현재 작업 기준선이다. 직접 편집하지 말고 \`node scripts/generate-workspace-state.mjs --write\`를 실행한다. Git HEAD·dirty 상태·live 배포 상태는 세션마다 달라지므로 이 파일에 고정하지 않는다.

## Application

- Version: \`${state.application.version}\`
- Architecture: \`${state.application.architecture}\`
- Active routes: ${state.application.activeRoutes} (source: \`${state.application.routeRegistry}\`)
- App shell: ${state.application.appShell.lines.toLocaleString('en-US')} lines / ${state.application.appShell.bytes.toLocaleString('en-US')} bytes

| Source | Lines | Bytes |
|---|---:|---:|
${codeRows}

## Workspace

- Context documents: ${state.workspace.contextDocuments}; preflight loads only this file, \`WORKFLOW-GOVERNANCE.md\`, and \`INDEX.md\`.
- Skills: ${state.workspace.skills}; command wrappers: ${state.workspace.commandWrappers}; agent profiles: ${state.workspace.agentProfiles}.
- Workflows: ${state.workspace.workflows}; CI scripts: ${state.workspace.ciScripts}.
- Ledgers: latest rule R${state.workspace.latestRule}; latest postmortem P${state.workspace.latestPostmortem}; open QA ${q.uniqueOpenIds} unique IDs (${q.openItems} rows, ${q.supersededOpenIds} explicitly superseded).
- Canonical skills: \`${state.workspace.canonicalSkills}\`; Codex mirror: \`${state.workspace.codexSkillMirror}\`.

## Knowledge Boundary

- Runtime status: \`${k.status}\`.
- ${k.units} units: ${k.researched} researched, ${k.inProgress} in progress, ${k.researchRequired} research required; ${k.articles} articles.
- Human review complete: \`${k.humanReviewComplete}\`; publication ready: \`${k.publicationReady}\`.
- These counts are structural/runtime evidence, not semantic or investment certification.

## Operations Boundary

- Repository operations artifact: \`${state.operations.overall}\` at \`${state.operations.repositoryArtifactGeneratedAt}\`.
- Public stage: \`${state.operations.publicStage}\`; promotion decision: \`${state.operations.publicBetaDecision}\`.
- Live deployment, provider health, and edge headers must be measured by live gates. Never infer them from this file.

## Read Policy

1. Read this file, \`WORKFLOW-GOVERNANCE.md\`, and \`INDEX.md\` for every task.
2. Search \`RULES.md\`, \`BUG-POSTMORTEM.md\`, \`QA-CHECKLIST.md\`, and \`KNOWLEDGE-BASE.md\` for matching IDs/terms; do not load the full ledgers by default.
3. Use \`CONTEXT-CATALOG.json\` to locate current handoffs and historical snapshots.
4. Re-run \`node scripts/ci-workspace-contract-check.mjs\` whenever docs, skills, agents, hooks, or workflows change.
`;
}

export const serializeJson = (value) => JSON.stringify(value, null, 2) + '\n';
