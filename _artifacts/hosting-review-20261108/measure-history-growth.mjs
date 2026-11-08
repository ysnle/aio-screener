// Packed bytes of objects introduced per week, bucketed by path. Run from repo root.
import { spawnSync } from 'node:child_process';
const git = (args, input) => {
  const r = spawnSync('git', args, { encoding: input === undefined ? 'utf8' : 'buffer', input, maxBuffer: 4 << 30 });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
};
const at = (d) => git(['rev-list', '-1', `--before=${d}`, 'HEAD']).trim();
const now = git(['rev-parse', 'HEAD']).trim();
const w0 = at('14 days ago'), w1 = at('7 days ago');
const PRODUCER_ONLY = ['public-data/sec-fundamentals-extended.json', 'public-data/telegram-observed.json', 'public-data/screener-extended-universe.json',
  'public-data/score-backtest-history.json', 'public-data/score-backtest-longrun.json', 'public-data/operations-slo-window.json',
  'public-data/telegram-reference-window.json', 'public-data/masters/'];
const bucket = (p) => {
  if (!p) return 'commits';
  if (p.startsWith('public-data/')) return PRODUCER_ONLY.some((x) => p.startsWith(x)) ? 'public-data:producer-only' : 'public-data:deployed';
  if (p.startsWith('architecture/') && /(asset|release)-manifest|public-readiness/.test(p) || p === 'public-config.json') return 'generated-manifests';
  if (p.startsWith('_artifacts/')) return '_artifacts';
  if (p.startsWith('_context/') || /^(CHANGELOG|AGENTS|CLAUDE)\.md$/.test(p)) return 'ledgers/docs';
  return 'code/other';
};
const perFile = new Map();
for (const [label, from, to] of [['week-1 (14..7d ago)', w0, w1], ['week-2 (last 7d)', w1, now]]) {
  const lines = git(['rev-list', '--objects', to, '--not', from]).split('\n').filter(Boolean);
  const groups = new Map();
  for (const line of lines) {
    const i = line.indexOf(' '); const oid = i < 0 ? line : line.slice(0, i); const p = i < 0 ? '' : line.slice(i + 1);

    const b = bucket(p);
    if (!groups.has(b)) groups.set(b, []);
    groups.get(b).push(oid);
    if (p.startsWith('public-data/')) perFile.set(p, (perFile.get(p) || 0) + 1);
  }
  const commits = git(['rev-list', '--count', to, '--not', from]).trim();
  console.log(`\n== ${label}: ${commits} commits, ${lines.length} objects`);
  let total = 0;
  for (const [b, oids] of [...groups].sort()) {
    const pack = git(['pack-objects', '--stdout', '--window=50', '--depth=50', '-q'], Buffer.from(oids.join('\n') + '\n'));
    total += pack.length;
    console.log(`${b.padEnd(28)} ${String(oids.length).padStart(7)} obj  ${(pack.length / 1048576).toFixed(1).padStart(8)} MB packed`);
  }
  console.log(`${'TOTAL (bucketed packs)'.padEnd(28)} ${(total / 1048576).toFixed(1).padStart(16)} MB`);
}
const top = [...perFile].sort((a, b) => b[1] - a[1]).slice(0, 25);
console.log('\nversions per public-data file (14d):'); for (const [p, n] of top) console.log(n, p);
