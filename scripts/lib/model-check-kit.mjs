// v58.72 (owner 2026-10-23, pstack create/maintain-formal-verification): shared pieces of the exhaustive model checks
// (scripts/ci-history-session-model-check.mjs, scripts/ci-narrative-lifecycle-model-check.mjs).
//   coverage  — each check records the functions it drives and a fingerprint of their code (comments, whitespace and
//               string contents removed). When covered code changes, the check fails until someone re-reads the model
//               against the new code and runs it with --sync; a pass on a stale model is the case to rule out.
//   variants  — a check proves it can fail by importing a deliberately broken copy of a covered module (written to the
//               OS temp folder with absolute imports) and requiring the expected invariant to break.
//   statechart — the reached states drawn as Mermaid for the owner: gray works, red broken in a variant (a past
//               defect or a removed guard), green the current code's transition from the same state.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const COVERAGE_PATH = join(REPO_ROOT, 'architecture', 'model-check-coverage.json');

/** Code shape of a function: comments dropped, string and template text emptied (template expressions kept), whitespace collapsed. */
export function normalizeSource(text) {
  const src = String(text);
  let out = '';
  const templates = []; // brace depth at which each open template expression resumes its template
  let depth = 0;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    const next = src[i + 1];
    if (ch === '/' && next === '/') { while (i < src.length && src[i] !== '\n') i++; out += ' '; continue; }
    if (ch === '/' && next === '*') { i = src.indexOf('*/', i + 2); if (i < 0) break; i++; out += ' '; continue; }
    if (ch === '\'' || ch === '"') {
      i++;
      while (i < src.length && src[i] !== ch) { if (src[i] === '\\') i++; i++; }
      out += ch + ch;
      continue;
    }
    if (ch === '`' || (ch === '}' && templates.length && templates[templates.length - 1] === depth)) {
      if (ch === '}') templates.pop();
      else out += '`';
      i++;
      while (i < src.length && src[i] !== '`' && !(src[i] === '$' && src[i + 1] === '{')) { if (src[i] === '\\') i++; i++; }
      if (src[i] === '$') { templates.push(depth); i++; out += '${'; } else out += '`';
      continue;
    }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    out += ch;
  }
  return out.replace(/\s+/g, ' ').trim();
}

export const fingerprint = (fn) => createHash('sha1').update(normalizeSource(Function.prototype.toString.call(fn))).digest('hex').slice(0, 16);

/**
 * `entries` is [{ module, name, fn }]. Returns the list of drift messages (empty when in sync). With `sync`, records the
 * current fingerprints and HEAD instead.
 */
export function verifyCoverage(gateId, entries, { sync = false } = {}) {
  const file = existsSync(COVERAGE_PATH) ? JSON.parse(readFileSync(COVERAGE_PATH, 'utf8')) : { schemaVersion: 'aio-model-check-coverage.v1', gates: {} };
  const current = entries.map(({ module, name, fn }) => ({ module, name, fingerprint: fingerprint(fn) }));
  if (sync) {
    let head = null;
    try { head = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim(); } catch (_) { head = null; }
    file.gates[gateId] = { syncedAt: head, covers: current };
    writeFileSync(COVERAGE_PATH, `${JSON.stringify(file, null, 2)}\n`);
    return [];
  }
  const recorded = file.gates?.[gateId];
  if (!recorded) return [`${gateId}: no coverage record in architecture/model-check-coverage.json`];
  const drift = [];
  for (const entry of current) {
    const prior = recorded.covers.find((row) => row.module === entry.module && row.name === entry.name);
    if (!prior) drift.push(`${entry.module} ${entry.name}: not in the coverage record`);
    else if (prior.fingerprint !== entry.fingerprint) drift.push(`${entry.module} ${entry.name}: code changed since ${recorded.syncedAt || 'the last sync'}`);
  }
  for (const prior of recorded.covers) {
    if (!current.some((row) => row.module === prior.module && row.name === prior.name)) drift.push(`${prior.module} ${prior.name}: recorded but no longer driven by the check`);
  }
  return drift;
}

let variantSeq = 0;
/**
 * Import a copy of `module` (repo-relative) with each [find, replace] applied once. A find that is missing or appears
 * more than once throws: the variant no longer describes the code and must be rewritten with the model.
 */
export async function importVariant(module, replacements, label) {
  const path = join(REPO_ROOT, module);
  let source = readFileSync(path, 'utf8');
  for (const [find, replace] of replacements) {
    const at = source.indexOf(find);
    if (at < 0 || source.indexOf(find, at + 1) >= 0) throw new Error(`[model-check] variant "${label}" anchor ${at < 0 ? 'missing' : 'ambiguous'} in ${module}: ${find.slice(0, 120)}`);
    source = source.slice(0, at) + replace + source.slice(at + find.length);
  }
  source = source.replace(/(\bfrom\s+|\bimport\s*\(\s*)(['"])(\.{1,2}\/[^'"]+)\2/g, (_, lead, quote, spec) => `${lead}${quote}${pathToFileURL(resolve(dirname(path), spec)).href}${quote}`);
  const tmp = join(tmpdir(), `aio-model-variant-${process.pid}-${++variantSeq}.mjs`);
  writeFileSync(tmp, source);
  try { return await import(pathToFileURL(tmp).href); } finally { try { unlinkSync(tmp); } catch (_) { /* already gone */ } }
}

/**
 * Collects (from, edge label, to) transitions and renders a Mermaid flowchart. `kind` of a node: 'start' | 'works' |
 * 'bug'. `caseId` names the concrete input; a variant edge is drawn (red) only where the current code took another edge
 * on the same input, and that current edge is green. Every other current edge is gray.
 */
export function createStatechart({ title, nodes }) {
  const edges = new Map(); // key -> { from, to, label, current: Set<caseId>, broken: Map<caseId, variant> }
  const currentByCase = new Map();
  return {
    add(from, to, label, variant = null, caseId = null) {
      const key = `${from}|${to}|${label}`;
      const edge = edges.get(key) || { from, to, label, current: new Set(), broken: new Map() };
      if (variant) edge.broken.set(caseId, variant);
      else { edge.current.add(caseId); currentByCase.set(caseId, key); }
      edges.set(key, edge);
    },
    mermaid() {
      const lines = ['---', `title: ${title}`, '---', 'flowchart TD'];
      const fixedKeys = new Set();
      const drawn = [];
      for (const [key, edge] of edges) {
        // A broken variant looping inside its own bug state adds nothing to the picture.
        const divergent = edge.from === edge.to ? [] : [...edge.broken].filter(([caseId]) => currentByCase.has(caseId) && currentByCase.get(caseId) !== key);
        for (const [caseId] of divergent) fixedKeys.add(currentByCase.get(caseId));
        if (edge.current.size) drawn.push({ ...edge, key, isCurrent: true });
        else if (divergent.length) drawn.push({ ...edge, key, isCurrent: false, variants: [...new Set(divergent.map(([, variant]) => variant))] });
      }
      const used = new Set(drawn.flatMap((edge) => [edge.from, edge.to]));
      for (const [id, node] of Object.entries(nodes)) if (used.has(id)) lines.push(`  ${id}${node.kind === 'start' ? `((${JSON.stringify(node.label)}))` : `[${JSON.stringify(node.label)}]`}:::${node.kind}`);
      // One arrow per (from, to, color); its labels are stacked, so the owner reads a few arrows rather than dozens.
      const merged = new Map();
      for (const edge of drawn) {
        const color = !edge.isCurrent ? 'red' : fixedKeys.has(edge.key) ? 'green' : 'gray';
        const note = color === 'red' ? ` (${edge.variants.join(', ')})` : color === 'green' ? ' (수정 후)' : '';
        const key = `${edge.from}|${edge.to}|${color}`;
        const group = merged.get(key) || { from: edge.from, to: edge.to, color, labels: [] };
        group.labels.push(edge.label + note);
        merged.set(key, group);
      }
      const order = { red: 0, green: 1, gray: 2 };
      const styles = [];
      [...merged.values()].sort((a, b) => order[a.color] - order[b.color] || a.from.localeCompare(b.from) || a.to.localeCompare(b.to)).forEach((edge, index) => {
        const label = edge.labels.sort().map((text) => text.replace(/"/g, "'")).join('<br/>');
        lines.push(`  ${edge.from} -->|"${label}"| ${edge.to}`);
        if (edge.color === 'red') styles.push(`  linkStyle ${index} stroke:#c0392b,stroke-width:2px,color:#c0392b`);
        else if (edge.color === 'green') styles.push(`  linkStyle ${index} stroke:#1e8449,stroke-width:2px,color:#1e8449`);
      });
      lines.push(...styles);
      lines.push('  classDef start fill:#333,stroke:#333,color:#fff', '  classDef works fill:#f2f2f2,stroke:#888,color:#222', '  classDef bug fill:#fdecea,stroke:#c0392b,color:#c0392b');
      return `${lines.join('\n')}\n`;
    },
    edgeCount: () => edges.size,
  };
}

const escapeHtml = (text) => String(text).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
/** Writes `<name>.mmd` and a self-contained `<name>.html` (the chart, a short reading, how to regenerate). */
export function writeChart(dir, name, chart, { title, reading = [], command }) {
  const mermaidSource = chart.mermaid();
  writeFileSync(join(dir, `${name}.mmd`), mermaidSource);
  const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
:root { --bg: #faf7f0; --ink: #222; --muted: #666; --card: #fff; --line: #ddd; --red: #c0392b; --green: #1e8449; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg: #1b1b1b; --ink: #eee; --muted: #aaa; --card: #fff; --line: #444; } }
:root[data-theme="dark"] { --bg: #1b1b1b; --ink: #eee; --muted: #aaa; --card: #fff; --line: #444; }
body { margin: 0; background: var(--bg); color: var(--ink); font: 15px/1.6 system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif; }
main { max-width: 1100px; margin: 0 auto; padding: 24px 16px 48px; }
h1 { font-size: 20px; margin: 0 0 12px; }
.legend { display: flex; flex-wrap: wrap; gap: 16px; margin: 8px 0 16px; color: var(--muted); font-size: 14px; }
.legend b.red { color: var(--red); } .legend b.green { color: var(--green); }
.chart { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 12px; overflow-x: auto; }
p { margin: 12px 0; max-width: 820px; }
details { margin-top: 16px; color: var(--muted); font-size: 13px; } pre { white-space: pre-wrap; }
</style></head><body><main>
<h1>${escapeHtml(title)}</h1>
<div class="legend"><span>회색 선: 지금 코드의 정상 전이</span><span><b class="red">빨간 선</b>: 과거 결함 코드(괄호 안 이름)로 재현한 잘못된 전이</span><span><b class="green">초록 선</b>: 같은 입력에서 지금 코드가 가는 전이</span></div>
<div class="chart"><pre class="mermaid">${escapeHtml(mermaidSource.replace(/^---\n[\s\S]*?\n---\n/, ''))}</pre></div>
${reading.map((line) => `<p>${escapeHtml(line)}</p>`).join('\n')}
<details><summary>다시 만들기</summary><pre>${escapeHtml(command)}</pre></details>
</main>
<script src="https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js"></script>
<script>mermaid.initialize({ startOnLoad: true, theme: 'neutral', themeVariables: { fontSize: '15px' }, flowchart: { useMaxWidth: false, nodeSpacing: 50, rankSpacing: 70 } });</script>
</body></html>
`;
  writeFileSync(join(dir, `${name}.html`), html);
}

/** `--chart <dir>` from argv, or null. */
export const chartDir = (argv = process.argv) => { const at = argv.indexOf('--chart'); return at >= 0 && argv[at + 1] ? resolve(argv[at + 1]) : null; };
