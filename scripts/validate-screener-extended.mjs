// v57.81: validates the extended screener shard before the refresh workflow commits it (freshness included).
import { readFile } from 'node:fs/promises';
import { validateExtendedShard } from './lib/screener-extended-validate.mjs';
import { expandScreenerArtifact } from '../src/data/screener-extended.js'; // v57.93 core row encoding

const path = process.argv[2] || 'public-data/screener-extended.json';
let shard;
try { shard = JSON.parse(await readFile(path, 'utf8')); } catch (error) {
  console.error(`[screener-extended-validator] ${path} unreadable: ${error.message}`);
  process.exit(1);
}
let coreData = null;
try { coreData = expandScreenerArtifact(JSON.parse(await readFile('public-data/screener.json', 'utf8'))).data || null; } catch { coreData = null; }
const result = validateExtendedShard(shard, { coreData, freshness: true });
if (!result.ok) {
  result.errors.forEach((error) => console.error(`[screener-extended-validator] ${error}`));
  process.exit(1);
}
console.log(`[screener-extended-validator] PASS rows=${result.rows}/${result.universe} fundamentals=${shard.fundamentalCount} (${shard.fundamentalCoveragePct}%) membership=${JSON.stringify(shard.membership?.status || {})}`);
