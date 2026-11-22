#!/usr/bin/env node
// Knowledge source liveness report (v60.46). Non-gating by design: a remote site's 404, bot wall or outage is not a
// property of this commit, so CI never runs this. ci-knowledge-corpus-check holds the offline rule (dated source on a
// moving "latest" URL); this script is the network half an editor runs before refreshing source URLs.
//
//   node scripts/report-knowledge-source-liveness.mjs [--json]
//
// dead         404/410 — the page is gone; replace the URL in its source of truth, then rebuild
// inconclusive 401/403/429/5xx/network — usually a bot wall (OECD, BLS, sec.gov without a contact UA); open it in a browser
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { sources } = JSON.parse(fs.readFileSync(path.join(root, 'public-data/knowledge/sources.json'), 'utf8'));
const asJson = process.argv.includes('--json');
const userAgent = 'Mozilla/5.0 (compatible; knowledge-source-liveness-report/1.0)';
const delayMs = 400;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const idsByUrl = new Map();
for (const source of sources) {
  if (!source.url) continue;
  idsByUrl.set(source.url, [...(idsByUrl.get(source.url) || []), source.id]);
}

async function probe(url) {
  for (const method of ['HEAD', 'GET']) {
    try {
      const response = await fetch(url, { method, redirect: 'follow', headers: { 'user-agent': userAgent, accept: 'text/html,application/pdf,*/*' }, signal: AbortSignal.timeout(20000) });
      if (method === 'HEAD' && [403, 405, 501].includes(response.status)) continue; // some servers refuse HEAD only
      return { status: response.status, finalUrl: response.url };
    } catch (error) {
      if (method === 'GET') return { status: 0, error: String(error?.cause?.code || error?.name || error) };
    }
  }
  return { status: 0, error: 'no response' };
}

const classify = (status) => (status >= 200 && status < 400 ? 'ok' : status === 404 || status === 410 ? 'dead' : 'inconclusive');
const rows = [];
for (const [url, ids] of idsByUrl) {
  const result = await probe(url);
  rows.push({ verdict: classify(result.status), ...result, url, sourceIds: ids });
  await sleep(delayMs);
}

const summary = Object.fromEntries(['ok', 'dead', 'inconclusive'].map((verdict) => [verdict, rows.filter((row) => row.verdict === verdict).length]));
if (asJson) {
  console.log(JSON.stringify({ checkedUrls: rows.length, summary, rows: rows.filter((row) => row.verdict !== 'ok') }, null, 2));
} else {
  console.log(`knowledge source liveness: ${rows.length} URLs · ok ${summary.ok} · dead ${summary.dead} · inconclusive ${summary.inconclusive}`);
  for (const row of rows.filter((entry) => entry.verdict !== 'ok')) {
    console.log(`${row.verdict.padEnd(12)} ${String(row.status || row.error).padEnd(6)} ${row.url}  [${row.sourceIds.join(', ')}]`);
  }
}
