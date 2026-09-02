import fs from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
const dir = '_artifacts/exhaustive-audit-20260831';
const report = JSON.parse(fs.readFileSync(`${dir}/static-audit.json`, 'utf8'));
const box = { exports: {} }; box.module = { exports: box.exports };
vm.runInNewContext(process.binding('natives')['internal/deps/acorn/acorn/dist/acorn'], box);
const browser = await chromium.launch();
const page = await browser.newPage();
await page.route('**/*', route => route.abort());
const results = [];
try {
  for (const item of report.history.filter(item => item.status === 'parse-failed')) {
    const source = execFileSync('git', ['cat-file', 'blob', item.blob], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
    if (!item.path.endsWith('.html')) { results.push({ ...item, disposition: 'source-parser-failure', semanticReview: 'pending' }); continue; }
    // Detached DOMParser creates an inert document: no historical app code runs.
    const scripts = await page.evaluate(source => [...new DOMParser().parseFromString(source, 'text/html').scripts]
      .filter(node => !node.src && (!node.type || ['text/javascript', 'application/javascript', 'module'].includes(node.type)))
      .map(node => ({ source: node.textContent, type: node.type })), source);
    const failures = [];
    for (const script of scripts) {
      try { box.exports.parse(script.source, { ecmaVersion: 'latest', sourceType: script.type === 'module' ? 'module' : 'script', locations: true }); }
      catch (error) {
        const baseLine = source.slice(0, source.indexOf(script.source)).split('\n').length;
        failures.push({ message: error.message, line: baseLine + error.loc.line - 1,
          excerpt: script.source.split('\n').slice(Math.max(0, error.loc.line - 3), error.loc.line + 2).join('\n') });
      }
    }
    results.push({ path: item.path, blob: item.blob, exampleCommit: item.exampleCommit,
      disposition: failures.length ? 'inert-html-parse-confirmed' : 'lexical-extraction-false-positive', failures });
  }
} finally { await browser.close(); }
fs.writeFileSync(`${dir}/history-failure-triage.json`, JSON.stringify({ generatedAt: new Date().toISOString(), method: 'inert HTML parser + nonexecuting JS parser; not historical runtime validation', results }, null, 2) + '\n');
console.log(JSON.stringify({ candidates: results.length, confirmedHtml: results.filter(item => item.disposition === 'inert-html-parse-confirmed').length,
  falsePositive: results.filter(item => item.disposition === 'lexical-extraction-false-positive').length, other: results.filter(item => item.disposition === 'source-parser-failure').length }));
