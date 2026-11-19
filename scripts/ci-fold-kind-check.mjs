#!/usr/bin/env node
// scripts/ci-fold-kind-check.mjs — v60.31 (owner 2026-11-19, 시장 상태 안 A "본문 풀이": "접힘인 것과 아닌 것을 확실히 분리")
//
// On a screen that has moved to the 안 A face, only three kinds of thing may fold: the raw table behind the rows
// (raw-table), the method (method) and the data sources (sources). Everything else — the verdict, the counter line, the
// AI reading, each indicator row with its two lines, the charts — is on the face. This static gate reads every renderer a
// moved screen owns, and its section of index.html, and fails on a fold that does not carry one of the three kinds:
//   - index.html: a <details> without data-fold-kind="raw-table|method|sources";
//   - a module: a details element (el(doc, 'details' …), createElement('details'), node('details' …)) whose statement or the
//     next two lines do not mark it (markFold(…, kind), dataset.foldKind = kind, data-fold-kind), a kindFold/markFold call
//     with a kind outside the three, or a call to another fold maker (noteFold) that marks nothing.
// A screen joins by one entry in SCREENS (its page id and the modules whose every fold shows on it). Modules shared with a
// screen that has not moved (session-lean.js paints 오늘's session fold too; market-story/-narratives, macro-crossroads and
// market-guide also render on 오늘, 매크로 and 뉴스) stay out until that screen moves; their folds are counted in the browser
// by .claude/skills/verify-aio/scripts/features/market.mjs (fold census).
// On the old code (v60.30) this fails: the 시장 상태 axis rows, the hero 판정 근거 and every combination were <details>.
// 시장 폭 and 투자 심리 failed before they moved: per-card 기준 notes (noteFold), the 나머지 지표 보기 and 종목 보기 folds, the
// 원리 folds (deepDiveFold), the synthesis's 이어서 읽기 and the price temperature's detail and method folds were unmarked.
// 매크로 and 금리와 환율 failed too: the six factor rows, each indicator group, the always-open shells (data-view-open), the
// 수익률 곡선 guide, every card's 지표 정의 (noteFold), the factors' 원리 (deepDiveFold) and the 자산배분 원리 fold.
//
//   node scripts/ci-fold-kind-check.mjs          verify (with its self-test)
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FOLD_KINDS = Object.freeze(['raw-table', 'method', 'sources']);
export const SCREENS = Object.freeze({
  signal: {
    page: 'page-signal',
    modules: [
      'src/ui/components/market-regime.js', 'src/ui/components/indicator-face.js', 'src/ui/components/stress-outcomes.js',
      'src/ui/components/distribution-strip.js', 'src/ui/components/correction-base-rate.js', 'src/ui/components/korea-participation.js',
      'src/ui/components/regime-radar.js', 'src/ui/components/screen-reading.js', 'src/ui/components/page-sources.js'
    ]
  },
  breadth: {
    page: 'page-breadth',
    modules: ['src/ui/components/breadth-board.js', 'src/ui/components/indicator-face.js', 'src/ui/components/screen-reading.js', 'src/ui/components/page-sources.js']
  },
  sentiment: {
    page: 'page-sentiment',
    modules: [
      'src/ui/components/sentiment-board.js', 'src/ui/components/market-temperature.js', 'src/ui/components/indicator-face.js', 'src/ui/components/gauge-bar.js',
      'src/ui/components/figures.js', 'src/ui/components/screen-reading.js', 'src/ui/components/page-sources.js'
    ]
  },
  // 매크로 and 금리와 환율 share macro-board.js. event-briefs.js (최근 공식 발표 cards, no fold on 매크로) stays out: its
  // folds are 뉴스's.
  macro: {
    page: 'page-macro',
    modules: [
      'src/ui/components/macro-board.js', 'src/ui/components/indicator-face.js', 'src/ui/components/index-earnings.js', 'src/ui/components/macro-chapters.js',
      'src/ui/components/release-zone-bar.js', 'src/ui/components/gauge-bar.js', 'src/ui/components/screen-reading.js', 'src/ui/components/page-sources.js'
    ]
  },
  fxbond: {
    page: 'page-fxbond',
    modules: ['src/ui/components/macro-board.js', 'src/ui/components/krw-read.js', 'src/ui/components/indicator-face.js', 'src/ui/components/page-sources.js']
  },
  // 기술적 분석 (owner 2026-11-19): the 시장 지수 cards, the 대표 종목 table and the one analysis slot with its coach,
  // strategy, layer, drawing and comparison parts.
  charts: {
    page: 'page-charts',
    modules: [
      'src/ui/pages/charts.js', 'src/ui/components/market-candles.js', 'src/ui/components/trend-chart.js', 'src/ui/components/stock-chart.js',
      'src/ui/components/stock-chart-coach.js', 'src/ui/components/stock-chart-strategies.js', 'src/ui/components/stock-chart-layers.js',
      'src/ui/components/stock-chart-mtf.js', 'src/ui/components/stock-chart-drawings.js', 'src/ui/components/stock-chart-compare.js',
      'src/ui/components/indicator-face.js', 'src/ui/components/page-sources.js'
    ]
  },
  // 산업 지도 › AI 지도 (owner 2026-11-19): the one view of #page-atlas on the 안 A face. The rest of the atlas (domain
  // analysis, deep branches, basis folds in atlas.js and industry-view.js) has not moved, so only the view's own modules
  // are read and the page's index.html section is not (html: false).
  'atlas-ai-map': {
    page: 'page-atlas',
    html: false,
    modules: ['src/ui/knowledge/ai-map-view.js', 'src/ui/components/node-graph.js', 'src/ui/components/indicator-face.js']
  },
  // 종목 (owner 2026-11-19): the company overview (사업 · 밸류체인 안의 자리 · 재무 한눈에) and the reader's notes, opened
  // as a section there (research-snapshots.js open: true; its briefing panel stays a fold of 브리핑).
  ticker: {
    page: 'page-ticker',
    modules: ['src/ui/pages/entity.js', 'src/ui/components/company-overview.js', 'src/ui/components/company-analysis.js', 'src/ui/components/ticker-start.js',
      'src/ui/components/stock-lens-cards.js', 'src/ui/components/indicator-face.js', 'src/ui/components/page-sources.js']
  },
  // 재무 공시: the filings read (fiscal-read.js), its lazy analysis cards and the latest earnings release (bodyOnly). The
  // event-briefs.js folds of 뉴스 (row folds, 그 밖의 실적) stay out until 뉴스 moves.
  fundamental: {
    page: 'page-fundamental',
    modules: ['src/ui/components/fiscal-read.js', 'src/ui/components/fundamental-analysis-cards.js', 'src/ui/components/stock-lens-cards.js', 'src/ui/components/indicator-face.js', 'src/ui/components/page-sources.js']
  }
});

const KIND = `(?:${FOLD_KINDS.map((kind) => kind.replace('-', '\\-')).join('|')})`;
const CREATES = /\bel\(\s*\w+\s*,\s*'details'|createElement\(\s*'details'\s*\)|\bnode\(\s*'details'/;
const MARKED = new RegExp(`markFold\\([^;]*,\\s*'${KIND}'\\s*\\)|dataset\\.foldKind\\s*=\\s*'${KIND}'|data-fold-kind="${KIND}"`);
const KIND_CALLS = [/\b(kindFold)\(\s*\w+\s*,\s*'([a-z-]+)'/g, /\b(markFold)\(.*,\s*'([a-z-]+)'\s*\)/g];
const OTHER_MAKERS = /\b(noteFold)\(/;

/** Problems in one module's source text (file is only for the messages). */
export function moduleProblems(file, text) {
  const problems = [];
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (/^\s*(\/\/|\*)/.test(line)) return;
    const where = `${file}:${index + 1}`;
    if (CREATES.test(line) && !/^\s*export function (kindFold|markFold)\b/.test(line)) {
      const window = lines.slice(index, index + 3).join('\n');
      // indicator-face.js builds the fold inside kindFold and marks it on the same line.
      if (!MARKED.test(window) && !(file.endsWith('indicator-face.js') && /markFold\(el\(doc, 'details'/.test(line))) problems.push(`${where}: a <details> without a fold kind (${FOLD_KINDS.join(' | ')})`);
    }
    for (const pattern of KIND_CALLS) for (const match of line.matchAll(pattern)) {
      if (!FOLD_KINDS.includes(match[2])) problems.push(`${where}: ${match[1]} kind '${match[2]}' is not one of ${FOLD_KINDS.join(', ')}`);
    }
    if (OTHER_MAKERS.test(line) && !/^\s*import /.test(line) && !/^\s*export function/.test(line)) problems.push(`${where}: ${line.match(OTHER_MAKERS)[1]} makes a fold without a kind`);
  });
  return problems;
}

/** Problems in a page's section of index.html. */
export function htmlProblems(pageId, html) {
  const start = html.indexOf(`id="${pageId}"`);
  const end = html.indexOf(`<!-- fix: ${pageId.replace(/^page-/, 'page-')} outer close -->`, start);
  if (start < 0 || end < 0) return [`index.html: the ${pageId} section (from id="${pageId}" to its outer-close comment) was not found`];
  const section = html.slice(start, end);
  const problems = [];
  for (const match of section.matchAll(/<details\b[^>]*>/g)) if (!new RegExp(`data-fold-kind="${KIND}"`).test(match[0])) problems.push(`index.html #${pageId}: ${match[0]} has no data-fold-kind (${FOLD_KINDS.join(' | ')})`);
  return problems;
}

// Self-test: the scanner must catch an unmarked fold, a wrong kind and a foreign fold maker, and pass the marked forms.
const selfTest = [
  ['unmarked el()', moduleProblems('t.js', "  const fold = el(doc, 'details', null, 'x');\n  fold.append(summary);").length === 1],
  ['unmarked createElement', moduleProblems('t.js', "  const fold = doc.createElement('details');").length === 1],
  ['wrong kind', moduleProblems('t.js', "  const f = kindFold(doc, 'detail', 'x', []);").length === 1],
  ['foreign maker', moduleProblems('t.js', "  box.append(noteFold(doc, text));").length === 1],
  ['marked by markFold', moduleProblems('t.js', "  const f = markFold(el(doc, 'details', null, 'x'), 'raw-table');").length === 0],
  ['marked on the next line', moduleProblems('t.js', "  const f = el(doc, 'details', null, 'x');\n  f.dataset.foldKind = 'method';").length === 0],
  ['kindFold method', moduleProblems('t.js', "  const f = kindFold(doc, 'method', 'x', () => []);").length === 0],
  ['html unmarked', htmlProblems('page-x', '<div id="page-x"><details class="a"><summary>a</summary></details><!-- fix: page-x outer close -->').length === 1],
  ['html marked', htmlProblems('page-x', '<div id="page-x"><details data-fold-kind="sources"></details><!-- fix: page-x outer close -->').length === 0]
];
const failures = selfTest.filter(([, ok]) => !ok).map(([name]) => `self-test: ${name}`);

const html = readFileSync(join(root, 'index.html'), 'utf8');
const counts = {};
for (const [screen, spec] of Object.entries(SCREENS)) {
  if (spec.html !== false) failures.push(...htmlProblems(spec.page, html));
  for (const file of spec.modules) failures.push(...moduleProblems(file, readFileSync(join(root, file), 'utf8')));
  counts[screen] = `${spec.modules.length} modules${spec.html === false ? '' : ' + index.html section'}`;
}

if (failures.length) {
  console.error(`[fold-kind] FAIL ${failures.length}:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`[fold-kind] PASS: ${Object.entries(counts).map(([screen, n]) => `${screen} (${n})`).join(', ')} fold only as ${FOLD_KINDS.join(' / ')}; self-test ${selfTest.length} cases (v60.31).`);
