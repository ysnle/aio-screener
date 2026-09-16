import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const port = Number(process.env.AIO_CONTRACT_AUDIT_PORT || 8917);

function startServer() {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let ready = false;
    child.stdout.on('data', (data) => { if (!ready && String(data).includes('AIO local server')) { ready = true; resolveServer(child); } });
    child.on('error', reject);
    child.on('exit', (code) => { if (!ready) reject(new Error(`server exited early (${code})`)); });
    setTimeout(() => { if (!ready) { ready = true; resolveServer(child); } }, 2000);
  });
}

const server = await startServer();
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.route('**/*', (route) => route.request().url().startsWith(`http://127.0.0.1:${port}/`) ? route.continue() : route.abort());
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.AIO_ARCH?.getScreenerState?.()?.rows?.length >= 800, { timeout: 30000 });

  const result = await page.evaluate(() => {
    const audit = window.AIO.getPageContractAudit();
    const all = window.AIO.runAllPageDeepAudits({ symbolLimit: 999 });
    const deployment = window.AIO.runEvidenceDeploymentGate({ includeItems: false });
    return {
      contractAudit: {
        status: audit.status,
        routePageCount: audit.routePageCount,
        expectedRoutePageCount: audit.expectedRoutePageCount,
        authoredCoverage: audit.authoredCoverage,
        derivedDeepAudit: audit.derivedDeepAudit,
        derivedSequentialRegistry: audit.derivedSequentialRegistry,
        missingDeepAudit: audit.missingDeepAudit,
        missingSequentialRegistry: audit.missingSequentialRegistry
      },
      deepAuditRoutesChecked: all.pagesChecked,
      deepAuditProblemPages: (all.problemPages || []).map((p) => p.pageId),
      deployment: { status: deployment.status, deployable: deployment.deployable, derivedWarnings: (deployment.warnings || []).filter((w) => /derived/.test(w)) }
    };
  });
  console.log(JSON.stringify(result, null, 1));
} finally {
  await browser.close();
  server.kill();
}
