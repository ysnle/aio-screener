#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildContextCatalog, buildWorkspaceState, renderCurrentState, serializeJson } from './workspace-state-lib.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const statePath = join(root, '_context', 'CURRENT-STATE.md');
const catalogPath = join(root, '_context', 'CONTEXT-CATALOG.json');
const state = buildWorkspaceState(root);
const expectedState = renderCurrentState(state);
const expectedCatalog = serializeJson(buildContextCatalog(root));
const checkOnly = process.argv.includes('--check');
const stdout = process.argv.includes('--stdout');

if (stdout) {
  process.stdout.write(expectedState);
  process.exit(0);
}

if (checkOnly) {
  const errors = [];
  const actualState = readFileSync(statePath, 'utf8');
  const actualCatalog = readFileSync(catalogPath, 'utf8');
  if (actualState !== expectedState) errors.push('_context/CURRENT-STATE.md is stale');
  if (actualCatalog !== expectedCatalog) errors.push('_context/CONTEXT-CATALOG.json is stale');
  if (errors.length) {
    console.error('Workspace state generation check failed:');
    errors.forEach((error) => console.error(` - ${error}`));
    console.error('Run: node scripts/generate-workspace-state.mjs --write');
    process.exit(1);
  }
  console.log(`Workspace state OK: ${state.application.version}, ${state.application.activeRoutes} routes, ${state.workspace.contextDocuments} context documents.`);
  process.exit(0);
}

if (!process.argv.includes('--write')) {
  console.error('Usage: node scripts/generate-workspace-state.mjs --write|--check|--stdout');
  process.exit(1);
}

writeFileSync(statePath, expectedState, 'utf8');
writeFileSync(catalogPath, expectedCatalog, 'utf8');
console.log(`Workspace state generated: ${state.application.version}, ${state.application.activeRoutes} routes, ${state.workspace.contextDocuments} context documents.`);
