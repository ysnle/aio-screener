// v57.81: decides whether the extended screener job refreshes this cycle (refresh-screener.yml). It reads only the
// committed artifacts: the shard is due when the core's US factor session advanced past the shard's, when the shard is
// missing or invalid, or when it is older than the age backstop. Prints due=true|false (and to GITHUB_OUTPUT).
import { appendFileSync, readFileSync } from 'node:fs';
import { extendedRefreshDue } from './fetch-data.mjs';

const read = (path) => { try { return JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')); } catch { return null; } };
const result = extendedRefreshDue({
  previousShard: read('public-data/screener-extended.json'),
  coreScreener: read('public-data/screener.json'),
  force: process.env.SCREENER_EXTENDED_FORCE === '1'
});
console.log(`[screener-extended-due] due=${result.due} reason=${result.reason}`);
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `due=${result.due}\nreason=${result.reason}\n`);
