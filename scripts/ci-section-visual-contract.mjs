#!/usr/bin/env node
// scripts/ci-section-visual-contract.mjs — v59.70 (PLAN S13/S15, perf-legacy-plan-20261104)
//
// The 종목 개요 and 재무 공시 tabs are three sections each, and every section that carries a reading carries its visual:
//   개요 — ① 가격 (the price chart and one why-moved line), ② 동종 비교 (one rank chart, one strength and one weakness
//          line, the rest folded), ③ 회사 이야기 (a fold, no visual of its own);
//   재무 — ① 매출과 이익률 추세 (revenue/income chart), ② 현금흐름과 발생액 (accruals chart, the reverse DCF and DuPont
//          folded), ③ SEC 연간 요약 (a fold).
// The renderers are mounted on scripts/lib/fake-dom.mjs with a fixture company, so a section that loses its chart, gains a
// fourth sibling, or puts the summary on the face fails here. On the old code the sections did not exist.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createFakeDocument } from './lib/fake-dom.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(join(root, file), 'utf8');
const failures = [];
const check = (label, ok, detail = '') => { if (!ok) failures.push(`${label}${detail ? ` — ${detail}` : ''}`); };
const walk = (node, fn) => { if (!node) return; fn(node); for (const child of node?.children || []) walk(child, fn); };
const find = (node, test) => { let hit = null; walk(node, (item) => { if (!hit && test(item)) hit = item; }); return hit; };
const all = (node, test) => { const out = []; walk(node, (item) => { if (test(item)) out.push(item); }); return out; };
const tag = (item) => String(item?.tagName || '').toLowerCase();
const visualIn = (node) => !!find(node, (item) => ['svg', 'canvas'].includes(tag(item)) || item?.dataset?.sectionVisual);

// ── 재무 공시: mount renderFiscalRead on a fixture issuer ─────────────────────────────────────────────────────────────
{
  const { renderFiscalRead } = await import(pathToFileURL(join(root, 'src/ui/components/fiscal-read.js')).href);
  const doc = createFakeDocument();
  const host = doc.getElementById('fund-flow');
  doc.getElementById('fund-native-sec-report');
  const years = ['2021-01-31:16675:4332:5000:5822:1128:5964:2469', '2022-01-30:26914:9752:26612:9108:976:10946:2504', '2023-01-29:26974:4368:22101:5641:1833:9703:2466',
    '2024-01-28:60922:29760:42978:28090:1069:8459:2464', '2025-01-26:130497:72880:79327:64089:3236:8463:24400', '2026-01-25:215938:120067:118000:102000:5500:8470:24300'];
  const quarters = '2025-04-27:44062:18775:r:11333:22132;2025-07-27:46743:26422:r:14962:23065;2025-10-26:57006:31910:r:19784:33391;2026-01-25:68127:43000:d:21400:38500';
  const fakeRoot = { _aioSecFiscalHistory: { NVDA: years.join(';') }, _aioSecFiscalHistoryAt: Date.now(), _aioSecQuarterHistory: { NVDA: quarters },
    _aioGetCanonicalScreenerRows: () => [], fetch: undefined, addEventListener() {} };
  let error = null;
  try { renderFiscalRead({ documentRef: doc, root: fakeRoot, state: { id: 'NVDA', fundamentals: { symbol: 'NVDA', form: '10-K' } }, close: null }); } catch (caught) { error = caught; }
  // The analysis cards load as a deferred chunk and repaint once it arrives; read the page after that repaint.
  await new Promise((done) => setTimeout(done, 300));
  check('v59.70 S15 재무 공시 renders on the fixture issuer', !error, error?.stack?.split('\n').slice(0, 3).join(' | '));
  const sections = all(host, (item) => item?.dataset?.entitySection);
  check('v59.70 S15 재무 공시 is three sections: trend, cash, sec', sections.map((item) => item.dataset.entitySection).join(',') === 'trend,cash,sec', sections.map((item) => item.dataset.entitySection).join(','));
  const [trend, cash, sec] = ['trend', 'cash', 'sec'].map((id) => sections.find((item) => item.dataset.entitySection === id));
  check('v59.70 S15 ① 매출과 이익률 추세 carries the revenue/income chart', !!trend && visualIn(trend));
  check('v59.70 S15 ② 현금흐름과 발생액 carries the accruals chart', !!cash && visualIn(cash));
  check('v59.70 #8 ② draws quarter-end inventory and receivables when they are collected', !!find(cash, (item) => item?.dataset?.sectionVisual === 'working-capital'));
  const secFold = sec && find(sec, (item) => tag(item) === 'details');
  check('v59.70 S15 ③ SEC 연간 요약 is a fold (nothing on its face but the title)', !!secFold && [...(sec?.children || [])].every((child) => ['h3', 'details'].includes(tag(child)) || child.id === 'fund-native-sec-report'));
  check('v59.70 S15 the raw SEC report fold sits in ③', !!find(sec, (item) => item.id === 'fund-native-sec-report'));
  check('v59.70 S15 no 재무 card outside the three sections', [...host.children].every((child) => tag(child) === 'h2' || child?.dataset?.entitySection));
}

// ── 종목 개요: ② 동종 비교 (renderStockStrengths) and the static section markers ─────────────────────────────────────────
{
  const { renderStockStrengths } = await import(pathToFileURL(join(root, 'src/ui/components/stock-lens-cards.js')).href);
  const doc = createFakeDocument();
  const host = doc.getElementById('ticker-strength');
  const fact = (id, label, rank, side, vsMedian) => ({ id, label, rank, n: 9, side, vsMedian, tied: false, text: `${label} 텍스트 ${rank}위` });
  const facts = [fact('roe', 'ROE', 1, 0, 1), fact('growth', '매출 성장', 2, 0.125, 1), fact('margin', '순이익률', 8, 0.875, -1), fact('fwdPe', 'Forward PER', 7, 0.75, -1)];
  const ctx = { sym: 'NVDA', peers: { themeName: '반도체', rows: [{ sym: 'NVDA' }, { sym: 'AMD' }, { sym: 'AVGO' }] },
    strengths: { strengths: facts.slice(0, 2), weaknesses: facts.slice(2), facts, peers: 8 }, watch: [{ label: '다음 실적', now: '11/17', why: '가이던스' }] };
  renderStockStrengths(doc, host, ctx);
  check('v59.70 S13 ② 동종 비교 draws one rank chart (svg)', all(host, (item) => tag(item) === 'svg').length === 1);
  const lines = all(host, (item) => String(item.className || '').includes('v2-peer-line'));
  check('v59.70 S13 ② one strength line and one weakness line on the face', lines.length === 2 && /강한 점/.test(lines[0].textContent) && /약한 점/.test(lines[1].textContent), String(lines.length));
  const fold = find(host, (item) => tag(item) === 'details');
  check('v59.70 S13 ② the other facts, 계속 볼 것 and the basis fold', !!fold && /계속 볼 것 1가지/.test(fold.textContent) && /순이익률|Forward PER/.test(fold.textContent));
  check('v59.70 S13 ② no 읽는 법 card', !/읽는 법|보는 법/.test(host.textContent));
  // ① and ③ markers and the why-moved line, through the page's own exports.
  const { markTickerSections, renderWhyMoved } = await import(pathToFileURL(join(root, 'src/ui/pages/entity.js')).href);
  const page = createFakeDocument();
  for (const id of ['ticker-price-panel', 'ticker-strength', 'ticker-business-profile']) page.getElementById(id);
  markTickerSections(page);
  check('v59.70 S13 the overview marks its three sections: price, peers, story', ['ticker-price-panel', 'ticker-strength', 'ticker-business-profile'].map((id) => page.getElementById(id).dataset.entitySection).join(',') === 'price,peers,story');
  const day = { facts: [{ id: 'stock:AAA:2026-11-03', kind: 'stock-move', subjects: ['AAA'], label: 'Alpha', date: '2026-11-03', change: -6.1, rank: 'major', materiality: 50 }], links: [] };
  const why = page.getElementById('ticker-why-moved');
  renderWhyMoved(page, { _aioMarketDay: day, _currentTickerId: 'AAA' }, { id: 'AAA' });
  check('v59.70 S13 ① the price section carries the why-moved line', why.hidden === false && /^11\/3 -6\.1% — /.test(why.textContent), why.textContent);
  renderWhyMoved(page, { _aioMarketDay: day, _currentTickerId: 'ZZZ' }, { id: 'ZZZ' });
  check('v59.70 S13 ① a move the ledger did not count has no line', why.hidden === true && why.textContent === '');
  // ③ the story face is the one line; the money-flow visual opens inside the fold.
  const { renderCompanyStory } = await import(pathToFileURL(join(root, 'src/ui/components/company-story.js')).href);
  const profile = JSON.parse(readFileSync(join(root, 'public-data/company-profiles/005930.KS.json'), 'utf8'));
  const storyDoc = createFakeDocument();
  const story = storyDoc.getElementById('ticker-business-profile');
  renderCompanyStory(storyDoc, story, { profile });
  const face = [...story.children];
  check('v59.70 S13 ③ 회사 이야기 face is the one line and the fold', face.length >= 2 && tag(face.at(-1)) === 'details' && face.slice(0, -1).every((node) => tag(node) === 'p'), face.map(tag).join(','));
  check('v59.70 S13 ③ the money flow opens inside the fold', !profile.moneyFlow?.steps?.length || !!find(face.at(-1), (item) => String(item.className || '').includes('company-story-flow')));
}

// ── why-moved: the line comes from the shared day account ───────────────────────────────────────────────────────────
{
  const { whyMovedLine } = await import(pathToFileURL(join(root, 'src/domain/entity/why-moved.js')).href);
  const day = { facts: [
    { id: 'stock:AAA:2026-11-03', kind: 'stock-move', subjects: ['AAA'], label: 'Alpha', date: '2026-11-03', change: 4.2, rank: 'major', materiality: 60, explainedBy: ['subject'] },
    { id: 'headline:1', kind: 'headline', title: 'Alpha jumps', titleKo: '알파 급등, 신제품 발표', subjects: ['AAA'], rank: 'major', materiality: 40, date: '2026-11-03' },
    { id: 'stock:BBB:2026-11-03', kind: 'stock-move', subjects: ['BBB'], label: 'Beta', date: '2026-11-03', change: -6.1, rank: 'minor', materiality: 30 }],
  links: [{ from: 'headline:1', to: 'stock:AAA:2026-11-03', basis: 'subject' }] };
  const a = whyMovedLine(day, 'AAA'); const b = whyMovedLine(day, 'BBB');
  check('v59.70 S13 ① why-moved: a move with a same-day report names it', /^11\/3 \+4\.2% — /.test(a?.text || '') && /알파 급등, 신제품 발표/.test(a.text), a?.text);
  check('v59.70 S13 ① why-moved: a counted move without a report says so; an uncounted one has no line', /^11\/3 -6\.1% — 같은 날 이름이 나온 보도가 없습니다\.$/.test(b?.text || '') && whyMovedLine(day, 'CCC') === null, b?.text);
}

if (failures.length) {
  console.error(`Section visual contract FAIL (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Section visual contract OK: 개요 가격 · 동종 비교 · 회사 이야기, 재무 추세 · 현금흐름 · SEC 요약.');
