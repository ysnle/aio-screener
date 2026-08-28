import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const mode = args[args.indexOf('--mode') + 1] || 'pass';
if (mode === 'marker') {
  const path = args[args.indexOf('--path') + 1];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, 'unexpected expensive phase execution\n');
}
if (mode.startsWith('fail')) {
  console.error(`intentional ${mode}`);
  process.exit(1);
}
console.log(`fixture ${mode} PASS`);
