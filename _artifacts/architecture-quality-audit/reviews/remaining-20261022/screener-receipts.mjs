import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const ref = '7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const meanings = {
  'src/domain/screener/factor-overlap.js': 'ranks/ties, null variance, Jacobi/effective rank, actual sentence; SCR02',
  'src/domain/screener/model-fingerprint.js': 'canonical serialization, validation/ranking/population identity, normalization and rounding',
  'src/domain/screener/factor-weights.js': 'fixed and regime weights, profile validation, promotion gates',
  'src/domain/screener/row-presentation.js': 'rank/market cap/readiness, factor vocabulary, follow-through explanations',
  'src/domain/screener/candidate-record.js': 'identity-specific forward records, independent windows, sample/IC gates and shadow records',
  'src/domain/screener/screener-read.js': 'top cohort, trend denominators, sector tilt/rotation, validation summaries',
  'src/domain/screener/setup-profile.js': 'measured setup conditions, missing data holds, labels and explanations',
  'src/domain/screener/conditional-evidence.js': 'observation normalization, lineage admission, rates/intervals/stability/recency/distribution; SCR05 dormant',
  'src/domain/screener/custom-conditions.js': 'condition registry, threshold normalization, evaluation/coverage, whole sentence parser; SCR04',
  'src/domain/screener/screen-engine.js': 'AST evaluation and traversal, admission/ranking, identities, capture/replay, presets; SCR01',
  'src/data/normalize/screener.js': 'whole whitelist, cache/copies, metadata/identity preservation and price loss; SCR03',
  'src/domain/fundamental/consensus-read.js': 'freshness/close admission, forward/trailing basis, ratios and user-facing text; SCR03',
  'src/domain/screener/evidence-lineage.js': 'whole lineage timestamp/rights/calendar/provisional admission and summary',
  'src/ui/components/screener-custom.js': 'whole DOM panel, session state, parse/apply/filter commit, chip focus/counts and dispose; SCR04'
};
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const rows = Object.entries(meanings).map(([path, reason]) => {
  const fixed = execFileSync('git', ['show', `${ref}:${path}`]);
  if (sha(fixed) !== sha(fs.readFileSync(path))) throw Error('Current file drift requires separate full diff: ' + path);
  return { path, ref, sha256: sha(fixed), status: 'FULL', read_ranges: `1-${fixed.toString('utf8').split('\n').length}`, reason: 'Whole source directly read; ' + reason };
});
fs.writeFileSync(new URL('screener-reading.tsv', import.meta.url), ['path\tref\tsha256\tstatus\tread_ranges\treason', ...rows.map(r => Object.values(r).join('\t'))].join('\n') + '\n');
console.log(JSON.stringify({ fullRead: rows.length, currentDrift: 0 }));
