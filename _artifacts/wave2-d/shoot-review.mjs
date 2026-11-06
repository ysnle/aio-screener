// wave2-d: after-shots for the screen-review items (5–10, 12, 17, 20, 22, 31, 33), one shoot.mjs run per block.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const runs = [
  ['review-signal-story', 'signal', '.mk-story__week'],
  ['review-signal-cross', 'signal', '#regime-cross'],
  ['review-macro-rates', 'macro', '.mx-ch[data-chapter="rates"]'],
  ['review-home-day', 'home', '#home-day'],
  ['review-portfolio-empty', 'portfolio', '#page-portfolio .page-head'],
  ['review-ticker-start', 'ticker', '#ticker-start']
];
for (const [prefix, route, selector] of runs) {
  const result = spawnSync(process.execPath, [join(here, 'shoot.mjs'), process.argv[2] || '8767', prefix, route, selector], { encoding: 'utf8' });
  console.log(prefix, result.status, (result.stderr || '').split('\n').filter(Boolean).slice(-2).join(' | '));
}
