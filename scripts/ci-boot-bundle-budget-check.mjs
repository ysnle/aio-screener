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
import { esmBundleOptions, bootOutputs, CLASSIC_BOOT_SCRIPTS, GLOBAL_SCRIPTS, GLOBAL_TARGET, PAGES_ROOT_FILES, PAGES_DATA_EXCLUDES } from './lib/pages-bundle-config.mjs';

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
  // v59.81 (hosting review 2026-11-08): the budget above was raised in 1 KB steps more than ten times in 14 days, so it
  // never stopped growth. The ceiling is the owner's number: the budget may not exceed it, and boot bytes a feature needs
  // come from moving another boot module behind its route (lazy), not from raising the ceiling.
  const ceiling = budget.bootModuleCeiling || {};
  if (!(ceiling.rawBytes > 0 && ceiling.gzipBytes > 0)) failures.push('architecture/boot-budget.json has no bootModuleCeiling rawBytes/gzipBytes');
  else if (rawBytes > ceiling.rawBytes || gzipBytes > ceiling.gzipBytes) failures.push(`boot module budget ${rawBytes}/${gzipBytes} is above the owner ceiling ${ceiling.rawBytes}/${ceiling.gzipBytes}; make a boot module lazy instead`);
  // v59.70 (2nd batch A, P0): the classic boot scripts, minified one by one as the deploy ships them, had no byte budget.
  const classic = { rawBytes: 0, gzipBytes: 0, files: {} };
  for (const file of CLASSIC_BOOT_SCRIPTS) {
    const { code } = await esbuild.transform(fs.readFileSync(path.join(root, file), 'utf8'), { loader: 'js', minify: true, charset: 'utf8', legalComments: 'none', target: GLOBAL_TARGET, logLevel: 'error' });
    const bytes = Buffer.from(code);
    const size = { rawBytes: bytes.length, gzipBytes: zlib.gzipSync(bytes, { level: 9 }).length };
    classic.files[file] = size;
    classic.rawBytes += size.rawBytes;
    classic.gzipBytes += size.gzipBytes;
  }
  const classicBudget = budget.classicBootBudget || {};
  if (!(classicBudget.rawBytes > 0 && classicBudget.gzipBytes > 0)) failures.push('architecture/boot-budget.json has no classicBootBudget rawBytes/gzipBytes');
  else {
    if (classic.rawBytes > classicBudget.rawBytes) failures.push(`classic boot scripts are ${classic.rawBytes} raw bytes minified, budget ${classicBudget.rawBytes}`);
    if (classic.gzipBytes > classicBudget.gzipBytes) failures.push(`classic boot scripts are ${classic.gzipBytes} gzip bytes minified, budget ${classicBudget.gzipBytes}`);
  }
  // The measured layout is the deploy's only while the workflow copies what pages-bundle-config.mjs lists.
  const deploy = fs.readFileSync(path.join(root, '.github/workflows/pages-deploy.yml'), 'utf8');
  const rootCopy = /^\s*cp ((?:[\w.-]+ )+)"\$RUNNER_TEMP\/pages-dist\/"$/m.exec(deploy)?.[1].trim().split(/\s+/) || [];
  const jsCopy = /^\s*cp ((?:js\/[\w.-]+ )+)"\$RUNNER_TEMP\/pages-dist\/js\/"$/m.exec(deploy)?.[1].trim().split(/\s+/) || [];
  const excludes = [...deploy.matchAll(/--exclude '([^']+)'/g)].map((match) => match[1]);
  const same = (left, right) => left.length === right.length && [...left].sort().join('|') === [...right].sort().join('|');
  if (!same(rootCopy, PAGES_ROOT_FILES)) failures.push(`pages-deploy.yml root files [${rootCopy.join(', ')}] differ from PAGES_ROOT_FILES`);
  if (!same(jsCopy, GLOBAL_SCRIPTS)) failures.push(`pages-deploy.yml classic scripts [${jsCopy.join(', ')}] differ from GLOBAL_SCRIPTS`);
  if (!same(excludes, PAGES_DATA_EXCLUDES)) failures.push(`pages-deploy.yml public-data excludes [${excludes.join(', ')}] differ from PAGES_DATA_EXCLUDES`);
  // `--inputs N` lists the N source modules that put the most bytes into the boot set (what to move behind import()).
  const inputsArg = process.argv.indexOf('--inputs');
  if (inputsArg >= 0) {
    const rows = boot.flatMap((file) => Object.entries(build.metafile.outputs[file].inputs).map(([input, info]) => [info.bytesInOutput, input]));
    console.error(rows.sort((a, b) => b[0] - a[0]).slice(0, Number(process.argv[inputsArg + 1]) || 40).map(([bytes, input]) => `${String(bytes).padStart(8)}  ${input}`).join('\n'));
  }
  const summary = { ok: failures.length === 0, bootFiles: boot.length, rawBytes: raw, gzipBytes: gzip, budget: { rawBytes, gzipBytes }, classicBoot: { ...classic, budget: classicBudget }, failures };
  console.log(JSON.stringify(summary, null, 2));
} finally {
  fs.rmSync(outdir, { recursive: true, force: true });
}
if (failures.length) process.exit(1);
