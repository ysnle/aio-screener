// Instance lifecycle for verify-aio: launch, doctor, cleanup. Only ever touches the pid this harness started.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');
export const evidenceRoot = join(root, '_artifacts', 'verify-aio');
export const repoVersion = () => JSON.parse(readFileSync(join(root, 'version.json'), 'utf8')).version;

export function instance(port) {
  const baseUrl = `http://127.0.0.1:${port}`;
  const stateDir = join(tmpdir(), 'aio-verify', String(port));
  const statePath = join(stateDir, 'state.json');
  const readState = () => (existsSync(statePath) ? JSON.parse(readFileSync(statePath, 'utf8')) : null);
  const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

  function portOwners() {
    try {
      if (process.platform === 'win32') {
        return [...new Set(execFileSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8' })
          .split(/\r?\n/).filter((l) => /LISTENING/.test(l) && new RegExp(`[:.]${port}\\s`).test(l))
          .map((l) => Number(l.trim().split(/\s+/).pop())))];
      }
      return execFileSync('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' }).trim().split(/\s+/).filter(Boolean).map(Number);
    } catch { return []; }
  }

  async function fetchText(path) {
    const res = await fetch(baseUrl + path, { cache: 'no-store' });
    return { status: res.status, text: await res.text() };
  }

  async function doctor({ quiet = false } = {}) {
    const checks = [];
    const add = (name, ok, detail) => checks.push({ name, ok: !!ok, detail });
    const state = readState();
    add('state file written by this harness', state, state ? statePath : `missing ${statePath}; run launch`);
    add('server process alive', state && pidAlive(state.pid), state ? `pid ${state.pid}` : 'no pid');
    const owners = portOwners();
    add('port owned by our pid', state && owners.includes(state.pid), `port ${port} listeners: ${owners.join(',') || 'none'}`);
    let servedVersion = null;
    try { servedVersion = JSON.parse((await fetchText('/version.json')).text).version; } catch (e) { servedVersion = `fetch failed: ${e.message}`; }
    add('served version equals checkout version.json', servedVersion === repoVersion(), `served ${servedVersion} / checkout ${repoVersion()}`);
    let shellOk = false;
    try {
      const r = await fetchText('/index.html');
      shellOk = r.status === 200 && r.text.includes(`<title>AIO Screener ${repoVersion()}`) && r.text.includes('aria-label="메인 네비게이션"');
    } catch {}
    add('index.html shell is this checkout (title version + main navigation)', shellOk, '/index.html');
    const ok = checks.every((c) => c.ok);
    if (!quiet) {
      checks.forEach((c) => console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name} — ${c.detail}`));
      console.log(ok ? `DOCTOR OK ${baseUrl}` : 'DOCTOR FAIL — do not drive this instance');
    }
    return ok;
  }

  async function launch() {
    const existing = readState();
    if (existing && pidAlive(existing.pid)) {
      console.log(`Instance already running (pid ${existing.pid}); running doctor.`);
      return doctor();
    }
    const foreign = portOwners();
    if (foreign.length) {
      console.error(`Port ${port} is held by pid ${foreign.join(',')} which this harness did not start. Pick another --port; never kill it.`);
      return false;
    }
    mkdirSync(stateDir, { recursive: true });
    const logPath = join(stateDir, 'server.log');
    const out = openSync(logPath, 'a');
    const child = spawn(process.execPath, [join(root, 'scripts', 'start-local-node.mjs'), String(port)], {
      cwd: root, detached: true, stdio: ['ignore', out, out], windowsHide: true
    });
    child.unref();
    writeFileSync(statePath, JSON.stringify({ pid: child.pid, port, startedAt: new Date().toISOString(), version: repoVersion(), logPath }, null, 2));
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      if (existsSync(logPath) && readFileSync(logPath, 'utf8').includes('AIO local server')) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    console.log(`Launched pid ${child.pid} on ${baseUrl}/ (log ${logPath})`);
    return doctor();
  }

  function cleanup() {
    const state = readState();
    if (!state) { console.log(`Nothing to clean on port ${port} (no state file).`); return true; }
    if (pidAlive(state.pid)) {
      try {
        if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(state.pid), '/T', '/F'], { stdio: 'ignore' });
        else process.kill(state.pid, 'SIGTERM');
      } catch (e) { console.error(`kill ${state.pid} failed: ${e.message}`); }
    }
    rmSync(stateDir, { recursive: true, force: true });
    const left = portOwners();
    console.log(`Stopped pid ${state.pid}; port ${port} listeners now: ${left.join(',') || 'none'}. Evidence kept under ${evidenceRoot}.`);
    return !left.includes(state.pid);
  }

  return { port, baseUrl, doctor, launch, cleanup };
}
