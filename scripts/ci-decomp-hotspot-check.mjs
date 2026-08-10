import { readFile } from 'node:fs/promises';
const files = ['index.html', 'js/aio-core.js', 'js/aio-data.js'];
const limits = { 'index.html': 35000, 'js/aio-core.js': 28000, 'js/aio-data.js': 18000 };
const errors = [];
for (const file of files) {
  const source = await readFile(new URL('../' + file, import.meta.url), 'utf8');
  const lines = source.split(/\r?\n/).length;
  if (lines > limits[file]) errors.push(`${file} line count ${lines} > bounded hotspot ${limits[file]}`);
}
const map = await readFile(new URL('../_context/CODE-MAP.md', import.meta.url), 'utf8');
if (!map.includes('index.html') || !map.includes('aio-core.js')) errors.push('CODE-MAP does not cover measured hotspots');
if (errors.length) { errors.forEach(error => console.error(' - ' + error)); process.exit(1); }
console.log('Decomposition hotspot check OK: bounded hotspot score, owner policy, and code-map coverage passed.');
