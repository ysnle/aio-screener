// One definition of the Pages deploy bundle, shared by the deploy step (scripts/build-pages-bundle.mjs) and the
// boot-budget gate (scripts/ci-boot-bundle-budget-check.mjs), so the gate measures exactly what ships.
export const GLOBAL_SCRIPTS = ['aio-workspace', 'aio-kr-data', 'aio-pages', 'aio-core', 'aio-data', 'aio-ui', 'aio-chat', 'aio-glossary'].map((name) => `js/${name}.js`);
export const ESM_ENTRY = 'src/app/bootstrap.js';
// index.html links one stylesheet; it @imports the rest of src/ui/styles. Shipped as is, the browser finds those
// imports only after the first file arrives (a second round trip before the page can paint); the deploy inlines them.
export const STYLE_ENTRY = 'src/ui/styles/responsive.css';
// Classic scripts already require ES2020 (optional chaining); the module graph already requires ES2021 (||=).
// Pinning the targets keeps the minifier from introducing newer syntax than the source ships today.
export const GLOBAL_TARGET = 'es2020';
export const ESM_TARGET = 'es2021';

export function esmBundleOptions({ absWorkingDir, outdir }) {
  return {
    absWorkingDir,
    entryPoints: { 'app/bootstrap': ESM_ENTRY },
    outdir,
    bundle: true,
    splitting: true,
    format: 'esm',
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    target: ESM_TARGET,
    chunkNames: 'chunks/[name]-[hash]',
    metafile: true,
    logLevel: 'error'
  };
}

// Output files the entry reaches through static imports: the set the browser fetches before first paint. Lazy
// page chunks (dynamic import()) load on navigation and are excluded. Paths are metafile output keys.
export function bootOutputs(metafile) {
  const outputs = metafile.outputs;
  const entry = Object.keys(outputs).find((file) => outputs[file].entryPoint === ESM_ENTRY);
  if (!entry) throw new Error(`metafile has no output for ${ESM_ENTRY}`);
  const seen = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.shift();
    if (seen.has(file)) continue;
    seen.add(file);
    for (const item of outputs[file]?.imports || []) if (item.kind === 'import-statement') queue.push(item.path);
  }
  return [...seen];
}

export function styleBundleOptions({ absWorkingDir, outfile }) {
  return {
    absWorkingDir,
    entryPoints: [STYLE_ENTRY],
    outfile,
    bundle: true,
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
    metafile: true,
    logLevel: 'error'
  };
}
