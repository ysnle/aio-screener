#!/usr/bin/env node
// Boot-budget gate: bundles src/ exactly as the Pages deploy does (scripts/lib/pages-bundle-config.mjs) and fails when
// the boot module set grows past architecture/boot-budget.json or when a lazy-only input (a reference corpus) is
// reachable from bootstrap.js through static imports. The deploy step only reports sizes; this gate keeps them.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';
import { esmBundleOptions, bootOutputs } from './lib/pages-bundle-config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const budget = JSON.parse(fs.readFileSync(path.join(root, 'architecture/boot-budget.json'), 'utf8'));
const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'aio-boot-budget-'));
const failures = [];
try {
  const build = await esbuild.build(esmBundleOptions({ absWorkingDir: root, outdir }));
  const boot = bootOutputs(build.metafile);
  let raw = 0;
  let gzip = 0;
  const inputs = new Set();
  for (const file of boot) {
    const buffer = fs.readFileSync(path.resolve(root, file));
    raw += buffer.length;
    gzip += zlib.gzipSync(buffer, { level: 9 }).length;
    for (const input of Object.keys(build.metafile.outputs[file].inputs)) inputs.add(input);
  }
  const globToRegExp = (glob) => new RegExp(`^${glob.split('*').map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`);
  for (const glob of budget.lazyOnlyInputs) {
    const pattern = globToRegExp(glob);
    for (const input of inputs) if (pattern.test(input)) failures.push(`${input} is statically reachable from the boot entry (lazy-only: ${glob})`);
  }
  const { rawBytes, gzipBytes } = budget.bootModuleBudget;
  if (raw > rawBytes) failures.push(`boot module set is ${raw} raw bytes, budget ${rawBytes}`);
  if (gzip > gzipBytes) failures.push(`boot module set is ${gzip} gzip bytes, budget ${gzipBytes}`);
  const summary = { ok: failures.length === 0, bootFiles: boot.length, rawBytes: raw, gzipBytes: gzip, budget: { rawBytes, gzipBytes }, failures };
  console.log(JSON.stringify(summary, null, 2));
} finally {
  fs.rmSync(outdir, { recursive: true, force: true });
}
if (failures.length) process.exit(1);
