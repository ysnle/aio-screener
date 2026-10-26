#!/usr/bin/env node
// scripts/ci-csp-meta-check.mjs — v58.82 (owner 2026-10-26 "구조적 보안")
//
// GitHub Pages ignores _headers, so the Content-Security-Policy the site actually gets is the <meta> in index.html.
// Its script-src has no 'unsafe-inline': each inline <script> block is allowed by its sha256, and external scripts only
// from the exact CDN package paths index.html loads. An injected <img onerror> or a script dropped into rendered text
// then does not run, even if an escape is missed. _headers carries the same policy (plus frame-ancestors, which a meta
// cannot set) for a host that does read it.
//
// Usage:
//   node scripts/ci-csp-meta-check.mjs           # verify
//   node scripts/ci-csp-meta-check.mjs --write   # after editing an inline <script>: refresh the hashes

import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// The exact package paths index.html loads (Chart.js has a cdnjs fallback; the stock chart uses lightweight-charts).
const SCRIPT_HOSTS = [
  'https://cdn.jsdelivr.net/npm/dompurify@3.4.16/', 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.0/', 'https://unpkg.com/lightweight-charts@4.2.0/',
];
const FONT_HOST = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/';
const NON_EXECUTABLE = /\btype\s*=\s*["']?(?:text\/plain|application\/(?:ld\+)?json|importmap)/i;

export function inlineScriptHashes(html) {
  const hashes = [];
  for (const match of String(html).matchAll(/<script(\s[^>]*)?>([\s\S]*?)<\/script\s*>/gi)) {
    const attrs = match[1] || '';
    if (/\ssrc\s*=/.test(attrs) || NON_EXECUTABLE.test(attrs)) continue;
    hashes.push(`'sha256-${createHash('sha256').update(match[2], 'utf8').digest('base64')}'`);
  }
  return [...new Set(hashes)];
}

export function buildPolicy(hashes) {
  return [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')} ${SCRIPT_HOSTS.join(' ')}`,
    `style-src 'self' 'unsafe-inline' ${FONT_HOST}`,
    "img-src 'self' data: blob: https:",
    `font-src 'self' data: ${FONT_HOST}`,
    "connect-src 'self' https: http://localhost:* http://127.0.0.1:*",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
  ].join('; ');
}

const META_RE = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/;
const HEADER_RE = /^(\s*Content-Security-Policy:).*$/m;

function run() {
  const write = process.argv.includes('--write');
  const indexPath = join(root, 'index.html'), headersPath = join(root, '_headers');
  let html = readFileSync(indexPath, 'utf8'), headers = readFileSync(headersPath, 'utf8');
  const policy = buildPolicy(inlineScriptHashes(html));
  const headerPolicy = `${policy}; frame-ancestors 'none'`;
  if (write) {
    const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
    html = META_RE.test(html) ? html.replace(META_RE, meta) : html.replace('<meta charset="UTF-8">', `<meta charset="UTF-8">\n  ${meta}`);
    headers = headers.replace(HEADER_RE, `$1 ${headerPolicy}`);
    writeFileSync(indexPath, html); writeFileSync(headersPath, headers);
  }
  const failures = [];
  const found = html.match(META_RE);
  if (!found) failures.push('index.html has no Content-Security-Policy <meta>');
  else {
    if (found[1] !== policy) failures.push('index.html CSP <meta> is out of date (an inline <script> changed?)');
    if (html.indexOf(found[0]) > html.search(/<script\b/i)) failures.push('the CSP <meta> must come before the first <script>');
  }
  if (/'unsafe-(?:inline|eval)'/.test(policy.split('; ')[1])) failures.push("script-src must not allow 'unsafe-inline' or 'unsafe-eval'");
  // Any script URL the page names — in a src attribute or in a loader's string — must be one the policy allows.
  for (const [url] of html.matchAll(/https?:\/\/[^'"\s<>()]+\.js(?=["'?#])/g)) {
    if (!SCRIPT_HOSTS.some((host) => url.startsWith(host))) failures.push(`external script ${url} is not in the CSP script sources`);
  }
  if (!headers.includes(`Content-Security-Policy: ${headerPolicy}`)) failures.push('_headers CSP differs from the index.html policy');
  if (failures.length) {
    console.error(`CSP meta check failed:\n - ${failures.join('\n - ')}\nRun: node scripts/ci-csp-meta-check.mjs --write`);
    process.exit(1);
  }
  console.log(`CSP meta check OK: ${inlineScriptHashes(html).length} inline scripts by hash, no 'unsafe-inline' in script-src.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) run();
