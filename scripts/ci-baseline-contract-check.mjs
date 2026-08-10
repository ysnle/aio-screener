import { readFile } from 'node:fs/promises';
const owners = JSON.parse(await readFile(new URL('../architecture/route-owners.json', import.meta.url), 'utf8'));
const baseline = JSON.parse(await readFile(new URL('../architecture/baseline.json', import.meta.url), 'utf8'));
const graph = JSON.parse(await readFile(new URL('../architecture/dependency-graph.json', import.meta.url), 'utf8'));
const errors = [];
const routes = Object.keys(owners.routes || {});
if (routes.length !== baseline.routeGraph?.supportedRoutesCount && baseline.routeGraph?.supportedRoutesCount != null) errors.push('baseline route count drift');
if (!owners.ownerEnums?.includes('native') || !owners.ownerEnums?.includes('legacy') || !owners.ownerEnums?.includes('not-applicable')) errors.push('owner enum contract missing');
if (!['local', 'release', 'live'].every(lane => graph.revisionLanes.includes(lane) && baseline.revisionLanes?.[lane])) errors.push('revision lanes are not separated');
if (!Object.values(graph.dependencies || {}).every(dep => dep.kind === 'external-gate' || dep.source)) errors.push('dependency graph contains an undeclared dependency');
if (errors.length) { errors.forEach(error => console.error(' - ' + error)); process.exit(1); }
console.log(`Baseline contract check OK: ${routes.length} supported routes, graph dependencies and local/release/live lanes are explicit.`);
