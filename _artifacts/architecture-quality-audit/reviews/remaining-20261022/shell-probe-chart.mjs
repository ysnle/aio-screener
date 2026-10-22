// Read-only isolated check of the real shell inline script. No network or product writes.
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
const ref = '7e2411432f6ca0e5f02528b209b013bf5f7ff2dc';
const fixed = execFileSync('git', ['show', `${ref}:index.html`], { maxBuffer: 4e6 });
const current = fs.readFileSync('index.html');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function scripts(html) {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(m => m[2].trim() && !/type="(?:module|text\/plain)"/.test(m[1]));
}
function run(html, data, failBoth = true) {
  const code = scripts(html).find(m => m[2].includes('function coordinateChartDependency'))[2];
  const requested = [], timers = [], points = [], text = [];
  const placeholder = { getAttribute(k) { return k === 'data-aio-src' ? 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js' : 'test-pin'; }, dispatchEvent() {} };
  const canvas = { width: 320, height: 160, clientWidth: 320, clientHeight: 160, isConnected: true };
  const ctx = { canvas, clearRect() {}, beginPath() {}, stroke() {}, moveTo(x,y) { points.push(['M',x,y]); }, lineTo(x,y) { points.push(['L',x,y]); }, fillText(s) { text.push(s); } };
  canvas.getContext = () => ctx;
  const root = { document: { body: {}, head: { appendChild(s) { requested.push(s); } }, getElementById() { return placeholder; }, addEventListener() {}, createElement() { const listeners = {}; return { addEventListener(n, f) { listeners[n] = f; }, fire(n) { listeners[n]?.(); } }; } }, location: { hash: '' }, console: { warn() {} }, Event: class {}, getComputedStyle() { return { getPropertyValue() { return '#211d16'; } }; }, setTimeout(fn,ms) { const t = {fn,ms}; timers.push(t); return t; }, clearTimeout(t) { t.cleared = true; } };
  root.window = root;
  vm.runInNewContext(code, root);
  const instance = new root.Chart(canvas, { type: 'line', data: { labels: ['a','b','c'], datasets: [{data}] } });
  if (failBoth) { requested[0].fire('error'); requested[1].fire('error'); }
  else { timers.find(t => t.ms === 5000).fn(); }
  return { points, text, requests: requested.map(s => s.src), timerDelays: timers.filter(t => !t.cleared).map(t => t.ms), fallback: !!root.Chart.__aioFallback, instanceReal: !!instance._real };
}
const result = { ref, fixedBlob: execFileSync('git',['rev-parse',`${ref}:index.html`],{encoding:'utf8'}).trim(), fixedSha256: sha(fixed), currentSha256: sha(current), evidence: 'pure VM; DOM, canvas, timers and external script requests stubbed; no browser or real CDN claim', versions: [] };
for (const [name,b] of [['fixed',fixed],['current',current]]) {
  const html=b.toString('utf8'), parsed=scripts(html);
  parsed.forEach((s,i)=>new vm.Script(s[2],{filename:`${name}-inline-${i}`}));
  const missing=run(html,[10,null,20]), zero=run(html,[10,0,20]), valid=run(html,[10,15,20]), hanging=run(html,[10,15,20],false);
  result.versions.push({ name, classicInlineParsed: parsed.length, missing, zero, valid, missingEqualsZero: JSON.stringify(missing.points)===JSON.stringify(zero.points), hanging });
}
fs.writeFileSync(new URL('./shell-probe-chart-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
