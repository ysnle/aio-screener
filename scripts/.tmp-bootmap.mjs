import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import * as esbuild from 'esbuild';
import { esmBundleOptions, bootOutputs } from './lib/pages-bundle-config.mjs';
const root = path.resolve('.');
const outdir = fs.mkdtempSync(path.join(os.tmpdir(), 'bo-'));
const build = await esbuild.build(esmBundleOptions({ absWorkingDir: root, outdir }));
const rows = bootOutputs(build.metafile).map((f) => [f.replace(/.*[\/]/,''), Object.keys(build.metafile.outputs[f].inputs)]);
console.log(rows.filter(([, ins]) => ins.length <= 3).map(([f, ins]) => `${f} ${ins.join(' ')}`).join('\n'));
