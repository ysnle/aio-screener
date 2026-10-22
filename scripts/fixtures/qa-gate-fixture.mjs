import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
const mode = args[args.indexOf('--mode') + 1] || 'pass';
if (mode === 'marker') {
  const path = args[args.indexOf('--path') + 1];
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, 'unexpected expensive phase execution\n');
}
if (mode === 'timed') {
  const record = args[args.indexOf('--record') + 1];
  const id = args[args.indexOf('--label') + 1];
  appendFileSync(record, JSON.stringify({ id, event: 'start' }) + '\n');
  await new Promise((resolve) => setTimeout(resolve, 150));
  appendFileSync(record, JSON.stringify({ id, event: 'end' }) + '\n');
}
// v58.63 (A25): the outcome comes from a file outside the gate identity, so the same fingerprint can pass then fail.
if (mode === 'toggle') {
  const { readFileSync } = await import('node:fs');
  const path = args[args.indexOf('--path') + 1];
  let state = 'pass';
  try { state = readFileSync(path, 'utf8').trim(); } catch {}
  if (state === 'fail') { console.error('intentional toggle fail'); process.exit(1); }
}
if (mode.startsWith('fail')) {
  console.error(`intentional ${mode}`);
  process.exit(1);
}
console.log(`fixture ${mode} PASS`);
