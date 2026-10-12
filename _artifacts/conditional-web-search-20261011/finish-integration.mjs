import { readFileSync, writeFileSync } from 'node:fs';
for (const file of ['index.html', 'js/aio-chat.js', 'scripts/ci-runtime-contract-check.mjs', 'scripts/ci-chat-response-layout-browser-check.mjs']) {
  const source = readFileSync(file, 'utf8').replaceAll('AI 베타', 'AI 도우미');
  writeFileSync(file, source.replace(/\r\n/g, '\n'));
}
const file = 'AGENTS.md';
writeFileSync(file, readFileSync(file, 'utf8').replace('- Desktop only. Mobile layouts and code were removed on purpose; do not add breakpoints or mobile handling back.', '- Responsive scope reopened by owner (2026-10-11): desktop, mobile and iPad share the same routes and data. Layout adapts automatically to viewport size; preserve desktop density and test compact navigation, tables, charts, theme and AI input.').replace(/\r\n/g, '\n'));
const rules = '_context/RULES.md';
writeFileSync(rules, readFileSync(rules, 'utf8').replace('`AI 베타 · 교육/리서치 보조`', '`AI 도우미 · 교육/리서치 보조`').replace(/\r\n/g, '\n'));
