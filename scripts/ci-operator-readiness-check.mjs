import fs from 'node:fs';

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = (message) => { throw new Error(`[operator-readiness] ${message}`); };
const operations = read('public-data/operations-status.json');
const reconciliation = read('public-data/reconciliation-status.json');
const readiness = read('architecture/public-readiness.json');
const headers = fs.readFileSync('_headers', 'utf8');

if (!['CURRENT', 'OPERATOR_REQUIRED'].includes(operations.planes?.durable?.status)) fail('durable plane status is not explicit');
if (operations.planes?.fast?.status !== 'OPERATOR_REQUIRED') fail('fast plane must remain operator-required until endpoint and soak evidence exist');
if (!/^https:\/\/aio-screener-data-plane\.[^/]+\.workers\.dev$/.test(String(operations.planes?.fast?.endpoint || ''))) fail('fast plane endpoint must identify the deployed data-plane base URL without a path suffix');
if (operations.planes.fast.health?.status === 'CURRENT' && operations.planes.fast.health?.statusCode !== 200) fail('fast plane current health evidence must be HTTP 200');
for (const blocker of ['fast_plane_cloudflare_credentials_and_soak_required', 'provider_rights_review_required']) {
  if (!operations.blockers?.includes(blocker)) fail(`missing blocker ${blocker}`);
}
if (reconciliation.overall === 'MATCH' || reconciliation.closure?.complete === true) fail('reconciliation cannot report complete while unresolved categories exist');
const unresolved = reconciliation.categories.filter((category) => category.status !== 'MATCH').map((category) => category.categoryId).sort();
if (JSON.stringify(unresolved) !== JSON.stringify([...(reconciliation.closure?.unresolvedCategories || [])].sort())) fail('reconciliation closure drift');
const operatorCriteria = readiness.criteria?.filter((criterion) => ['live-revision', 'edge-security-headers', 'thirty-day-slo', 'provider-rights'].includes(criterion.id)) || [];
if (operatorCriteria.length !== 4 || operatorCriteria.some((criterion) => !['OPERATOR_REQUIRED', 'REVIEW_REQUIRED', 'PASS'].includes(criterion.status))) fail('public readiness operator criteria are not explicit');
for (const marker of ['X-Content-Type-Options', 'X-Frame-Options', 'Permissions-Policy', 'Content-Security-Policy']) {
  if (!headers.toLowerCase().includes(marker.toLowerCase())) fail(`_headers missing ${marker}`);
}
if (readiness.publicBetaDecision !== 'BLOCKED_UNTIL_OPERATOR_CRITERIA_CLOSE') fail('public beta must remain blocked until operator criteria close');
console.log(JSON.stringify({ ok: true, durable: operations.planes.durable.status, fast: operations.planes.fast.status, unresolvedCategories: unresolved.length, publicBetaDecision: readiness.publicBetaDecision }));
