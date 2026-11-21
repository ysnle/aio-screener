#!/usr/bin/env node
// scripts/ci-section-visual-contract.mjs — v59.70 (PLAN S13/S15, perf-legacy-plan-20261104)
//
// The 종목 개요 and 재무 공시 tabs are three sections each, and every section that carries a reading carries its visual:
//   개요 (2026-11-19) — ① 사업 (segment revenue bars), ② 밸류체인 안의 자리 (layer, customers, suppliers, capital flows),
//          ③ 재무 한눈에 (figure rows with a state word); only 원자료 표 · 계산 방법 · 데이터 출처 fold;
//   재무 — ① 매출과 이익률 추세 (revenue/income chart), ② 현금흐름과 발생액 (accruals chart, the reverse DCF and DuPont),
//          ③ 공시가 말하는 것 (the findings as rows, with the raw SEC report as its 원자료 표).
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
  // 2026-11-19: ③ is on the face — one row per finding of the filing — and folds only 원자료 표 · 계산 방법.
  check('v60.31 ③ 공시가 말하는 것 shows the findings as rows on the face', !!sec && all(sec, (item) => String(item.className || '').includes('stock-read-point ')).length >= 2);
  check('v59.70 S15 the raw SEC report fold sits in ③', !!find(sec, (item) => item.id === 'fund-native-sec-report'));
  const fiscalFolds = all(host, (item) => tag(item) === 'details');
  check('v60.31 재무 공시 folds only 원자료 표 · 계산 방법 · 데이터 출처', fiscalFolds.every((fold) => ['raw-table', 'method', 'sources'].includes(fold.dataset?.foldKind)), fiscalFolds.map((fold) => fold.dataset?.foldKind || fold.className).join(','));
  check('v59.70 S15 no 재무 card outside the three sections', [...host.children].every((child) => tag(child) === 'h2' || child?.dataset?.entitySection));
  // The stock lens readings sit on the face: the business lens leads ①, the thesis conditions follow the reverse DCF in ②.
  const onFace = (node, id) => { const card = find(node, (item) => item?.dataset?.analysis === id); let up = card?.parentElement; while (up && up !== host) { if (tag(up) === 'details') return false; up = up.parentElement; } return !!card; };
  check('v60.31 ① 매출과 이익률 추세 leads with the business lens on the face', onFace(trend, 'lens'));
  check('v60.31 ② 현금흐름과 발생액 carries the thesis conditions on the face', onFace(cash, 'thesis') && /맞으려면/.test(find(cash, (item) => item?.dataset?.analysis === 'thesis')?.textContent || ''));
}

// ── 종목 개요: 사업 · 밸류체인 안의 자리 · 재무 한눈에, and the 쟁점과 전망 view (renderCompanyOverview on NVDA's story) ──
{
  const { renderCompanyOverview, renderCompanyReport } = await import(pathToFileURL(join(root, 'src/ui/components/company-overview.js')).href);
  const { companyPlace, moneyGlance } = await import(pathToFileURL(join(root, 'src/domain/entity/company-overview.js')).href);
  const json = (file) => JSON.parse(read(file));
  const story = json('public-data/company-profiles/NVDA.json');
  const place = companyPlace({ symbol: 'NVDA', story, graph: json('public-data/company-profiles/graph.json'), capital: json('public-data/atlas/capital-flows.json'), today: '2026-11-19' });
  const money = moneyGlance({ symbol: 'NVDA', story });
  const doc = createFakeDocument();
  const host = doc.getElementById('ticker-company');
  const peer = { theme: '반도체', count: 9, strength: '순이익률 55.6%로 이 회사 포함 9곳 중 1위', weakness: 'Forward PER 38.0배로 이 회사 포함 9곳 중 7위' };
  const outlookHost = doc.createElement('section');
  renderCompanyOverview(doc, host, { symbol: 'NVDA', story, profile: { name: 'NVIDIA' }, place, money, peer, outlookHost, openTicker() {}, openMap() {}, openFundamental() {}, openOutlook() {} });
  const sections = all(host, (item) => item?.dataset?.companySection);
  check('v60.38 종목 개요 is three sections: business, place, money', sections.map((item) => item.dataset.companySection).join(',') === 'business,place,money', sections.map((item) => item.dataset.companySection).join(','));
  const [business, where, figures] = sections;
  // v60.38 (owner 2026-11-21): 쟁점과 전망 is the next view, painted with 개요; 개요 ends on one line to it naming the issue.
  const outlook = find(outlookHost, (item) => item?.dataset?.companySection === 'outlook');
  const next = find(host, (item) => item?.dataset?.companyNext === 'outlook');
  check('v60.38 쟁점과 전망 is its own view and 개요 ends on a link to it named by the issue', !!outlook && !!next && next.textContent.includes(story.debate.question)
    && [...host.children].filter((child) => child?.dataset?.companySection).at(-1) === figures, next?.textContent);
  // The company analysis the story carries sits on the face of its section (folds hold only tables, methods, sources).
  const unfolded = (item, node) => { let up = item.parentElement; while (up && up !== node) { if (tag(up) === 'details') return false; up = up.parentElement; } return true; };
  const faceText = (node) => all(node, (item) => ['h3', 'h4'].includes(tag(item)) && unfolded(item, node)).map((item) => item.textContent).join('|');
  check('v60.31 사업 carries 경쟁 and AI on the face', /경쟁/.test(faceText(business)) && /지금 이기는 이유/.test(faceText(business)) && /AI가 실적에 닿는 길/.test(faceText(business)), faceText(business));
  check('v60.34 쟁점과 전망 leads with 핵심 쟁점 and carries the outlook and the signals', ['핵심 쟁점', '판가름할 것', '잘 안 보이는 구조', '회사가 밝힌 전망과 계획', '맞아가고 있다는 신호'].every((title) => faceText(outlook).includes(title)) && faceText(outlook).indexOf('핵심 쟁점') < faceText(outlook).indexOf('회사가 밝힌 전망과 계획'), faceText(outlook));
  // 실적과 현금 belongs to 재무 공시: the same story, drawn there with its cash bars, and absent from the overview.
  const reportHost = doc.createElement('div');
  renderCompanyReport(doc, reportHost, { story, today: '2026-11-19' });
  check('v60.34 재무 공시 carries 실적과 현금 (현금을 쓴 곳 bars, 시장 예상, 분기마다 볼 숫자, 경영·지배구조) and the overview does not', ['현금을 쓴 곳', '시장 예상', '분기마다 볼 숫자', '경영·지배구조'].every((title) => faceText(reportHost).includes(title)) && !!find(reportHost, (item) => String(item.getAttribute?.('aria-label') || '').startsWith('현금을 쓴 곳')) && !/현금을 쓴 곳|시장 예상/.test(faceText(figures) + faceText(outlook)), faceText(reportHost));
  check('v60.31 밸류체인 안의 자리 names the partners beside buyers, suppliers and rivals', /함께 일하는 곳/.test(faceText(where)), faceText(where));
  check('v60.31 사업 carries the segment revenue bars (a figure, role img)', !!find(business, (item) => item.getAttribute?.('role') === 'img'));
  check('v60.31 밸류체인 안의 자리 names the map layer and the companies on each side', /\d층 /.test(where?.textContent || '') && /사 주는 곳|공급하는 곳/.test(where?.textContent || ''), where?.textContent?.slice(0, 200));
  check('v60.31 재무 한눈에 is figure rows with a state word', all(figures, (item) => tag(item) === 'article').length >= 2);
  const standing = find(figures, (item) => item?.dataset?.companyPeer != null);
  check('v60.31 재무 한눈에 names the standing among theme peers in a strength and a weakness line', !!standing && /강한 점/.test(standing.textContent) && /약한 점/.test(standing.textContent), standing?.textContent);
  const folds = all(host, (item) => tag(item) === 'details');
  check('v60.31 the overview folds only 원자료 표 · 계산 방법 · 데이터 출처', folds.length > 0 && folds.every((fold) => ['raw-table', 'method', 'sources'].includes(fold.dataset?.foldKind)), folds.map((fold) => fold.dataset?.foldKind).join(','));
  check('v60.31 no 읽는 법 card', !/읽는 법|보는 법/.test(host.textContent));
}

// ── The stock's primary theme and the day account (shared by 오늘 and the AI reader) ──────────────────────────────────
{
  // v60.28 (AVGO 11/16): the market line and the theme link named different themes. The primary theme (primary-theme.js,
  // theme-map order) is one owner.
  {
    const { primaryTheme, stockThemes } = await import(pathToFileURL(join(root, 'src/domain/entity/primary-theme.js')).href);
    const map = [{ id: 'semiconductor', nameKr: '반도체', leaders: ['AVGO', 'NVDA'], subThemes: [{ name: 'AI 칩/커스텀 ASIC', tickers: ['NVDA', 'AVGO'] }] },
      { id: 'photonics', nameKr: '광통신/포토닉스', leaders: ['AVGO', 'LITE'], subThemes: [{ name: '광전자 플랫폼', tickers: ['AVGO'] }] }];
    const theme = primaryTheme(map, 'AVGO');
    check('v60.28 primary theme: one owner orders the stock\'s themes (theme-map order, primary first)', theme?.id === 'semiconductor' && stockThemes(map, 'avgo').map((t) => t.id).join() === 'semiconductor,photonics', JSON.stringify(theme));
  }
  // v59.84 (screen review TODAY-04): a big move on the first session after the company's own report is that report's
  // reaction, not "이유가 확인되지 않은 큰 움직임"; a brief for another session or another name leaves it unexplained.
  {
    const { buildDayAccount } = await import(pathToFileURL(join(root, 'src/domain/briefing/day-account.js')).href);
    const teamDay = { facts: [
      { id: 'stock:TEAM:2026-11-06', kind: 'stock-move', subjects: ['TEAM'], label: 'Atlassian', date: '2026-11-06', change: -16.1, rank: 'major', materiality: 60 },
      { id: 'stock:AXON:2026-11-06', kind: 'stock-move', subjects: ['AXON'], label: 'Axon', date: '2026-11-06', change: -9, rank: 'major', materiality: 50 }] };
    const briefs = { briefs: [
      { kind: 'earnings', symbol: 'TEAM', eventDate: '2026-11-05', headline: '아틀라시안 1분기: 매출 증가', reaction: { firstDate: '2026-11-06', firstPct: -16.2 } },
      { kind: 'earnings', symbol: 'AXON', eventDate: '2026-10-01', headline: '이전 분기', reaction: { firstDate: '2026-10-02' } }] };
    const told = buildDayAccount(teamDay, { briefs });
    check('v59.84 day account: a move after the company report leaves the unexplained list and carries the brief headline',
      told.unexplained.map((row) => row.sym).join() === 'AXON' && told.reported[0]?.sym === 'TEAM' && /아틀라시안/.test(told.reported[0]?.headline || '')
        && buildDayAccount(teamDay).unexplained.length === 2, JSON.stringify({ unexplained: told.unexplained, reported: told.reported }));
  }
}

if (failures.length) {
  console.error(`Section visual contract FAIL (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Section visual contract OK: 개요 사업 · 밸류체인 안의 자리 · 재무 한눈에, 쟁점과 전망, 재무 추세 · 현금흐름 · 공시가 말하는 것 · 시장 환경.');
