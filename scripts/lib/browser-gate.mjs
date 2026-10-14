// v57.60: shared lifecycle for browser gates that own a local static server.
// startLocalServer resolves only on the start-local-node ready line (no "assume ready"
// fallback) and rejects on early exit or timeout; closeAll always closes the browser and
// kills the server, even when chromium.launch() threw before a browser existed.
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const READY_LINE = 'AIO local server';

export function startLocalServer(port, { timeoutMs = 15000, label = 'local-server', root = repoRoot, windowsHide = true } = {}) {
  return new Promise((resolveServer, reject) => {
    const child = spawn(process.execPath, ['scripts/start-local-node.mjs', String(port)], { cwd: root, windowsHide, stdio: ['ignore', 'pipe', 'pipe'] });
    let settled = false;
    let stdoutTail = '';
    const settle = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) {
        if (child.exitCode === null && child.signalCode === null) child.kill();
        reject(error);
      } else {
        resolveServer(child);
      }
    };
    const timer = setTimeout(() => settle(new Error(`[${label}] local server on port ${port} not ready within ${timeoutMs}ms`)), timeoutMs);
    child.stdout.on('data', (data) => {
      // Keep a short tail so a ready line split across chunks is still recognised.
      stdoutTail = (stdoutTail + String(data)).slice(-512);
      if (stdoutTail.includes(READY_LINE)) settle();
    });
    child.stderr.on('data', (data) => process.stderr.write(`[${label}] ${data}`));
    child.on('error', (error) => settle(error));
    child.on('exit', (code, signal) => settle(new Error(`[${label}] local server on port ${port} exited before ready (code=${code}, signal=${signal})`)));
  });
}

export async function closeAll({ browser, server } = {}) {
  if (browser) {
    try { await browser.close(); } catch { /* browser already gone */ }
  }
  if (server && server.exitCode === null && server.signalCode === null) {
    try { server.kill(); } catch { /* process already gone */ }
  }
}

// Runs fn({ server, browser }) with a launched browser and guaranteed cleanup.
export async function withBrowserGate({ port, launch, label, timeoutMs } = {}, fn) {
  const server = await startLocalServer(port, { label, timeoutMs });
  let browser;
  try {
    browser = await launch();
    return await fn({ server, browser });
  } finally {
    await closeAll({ browser, server });
  }
}
