// The hand-researched reference artifact (public-data/research-reference.json): its schema, its per-row ageing and its
// boundary. Researched rows explain the automated data beside them and never feed a score, a rank or a chart series, so
// the gate also fails when a module outside the research lane's readers imports the read model.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RESEARCH_DROP_DAYS, RESEARCH_GROUP_IDS, RESEARCH_REFERENCE_SCHEMA, RESEARCH_STALE_DAYS, RESEARCH_UNITS,
  researchFactLines, researchReference, researchReferenceProblems
} from '../src/domain/research/reference.js';
import { MANUAL_ARTIFACTS, ARTIFACT_FRESHNESS } from '../src/data/contracts/artifact-freshness.js';
import { ARTIFACTS, RESEARCH_REFERENCE } from '../src/data/artifact-registry.js';
import { shortDate } from '../src/domain/content/date-labels.js';
import { RESEARCH_WORDS } from '../src/domain/research/words.js';
import { researchReferenceBlock } from '../src/ui/components/research-reference.js';
import { claim, figureRangeText, say } from '../src/domain/shared/claim.js';
import { unclaimedFigures } from './lib/claim-validate.mjs';
import { aiFundingChain, FUNDING_CHAIN_LINK_IDS, FUNDING_CHAIN_RESEARCH_GROUPS, fundingChainFactLines, marketReadingFundingLines } from '../src/domain/themes/ai-funding-chain.js';
import { FUNDING_CHAIN_WORDS } from '../src/domain/content/funding-chain-words.js';
import { fundingChainBlock, fundingChainPointer } from '../src/ui/components/ai-funding-chain.js';
import { buildBigtechCashflow } from './fetch-bigtech-cashflow.mjs';
import { BIGTECH_ISSUERS, HYPERSCALERS } from '../src/domain/fundamental/quarterly-cashflow.js';
import { buildMacroChapters, creditYields } from '../src/domain/macro/macro-chapters.js';
import { createFakeDocument } from './lib/fake-dom.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const errors = [];
const check = (label, condition, detail = '') => { if (!condition) errors.push(label + (detail ? `: ${detail}` : '')); };

// ── The committed file ──────────────────────────────────────────────────────
const committed = JSON.parse(read('public-data/research-reference.json'));
const problems = researchReferenceProblems(committed);
check('v60.59 research-reference.json passes its schema (asOf, https sourceUrl, one numeric value or range, known unit, nothing dated after today)', !problems.length, problems.join('; '));
check('v60.59 research-reference.json carries every group id', RESEARCH_GROUP_IDS.every((id) => committed.groups?.some((group) => group.id === id)), JSON.stringify(committed.groups?.map((group) => group.id)));

// ── Registration ────────────────────────────────────────────────────────────
check('v60.59 research-reference.json is a manual artifact with a named expiry gate', MANUAL_ARTIFACTS['research-reference.json']?.refresh === 'manual' && /ci-research-reference-check/.test(MANUAL_ARTIFACTS['research-reference.json']?.expiryGate || ''));
check('v60.59 research-reference.json has no producer row (nothing collects it)', !ARTIFACT_FRESHNESS['research-reference.json']);
check('v60.59 the lineage audit dates research-reference.json by checkedAt', /'research-reference\.json': \{ kind: 'research-reference', timestamp: \['checkedAt'\]/.test(read('scripts/ci-data-lineage-audit.mjs')));
check('v60.59 the browser reads it through the shared descriptor', ARTIFACTS['research-reference.json'] === RESEARCH_REFERENCE && RESEARCH_REFERENCE.schemas.includes(RESEARCH_REFERENCE_SCHEMA));

// ── Fixtures ────────────────────────────────────────────────────────────────
const NOW = Date.parse('2026-11-26T03:00:00Z'); // 2026-11-26 KST
const dayBefore = (days) => new Date(Date.parse('2026-11-26T00:00:00Z') - days * 86400000).toISOString().slice(0, 10);
const item = (fields = {}) => ({ id: 'x', label: '오라클 5년 CDS', entity: 'ORCL', value: 120, unit: 'bp', asOf: dayBefore(2), prior: { value: 100, asOf: dayBefore(9) },
  record: null, note: '조달 부담', sourceName: '공개 자료', sourceUrl: 'https://example.com/a', ...fields });
const artifact = (items, groupId = 'credit-single-name') => ({ schemaVersion: RESEARCH_REFERENCE_SCHEMA, checkedAt: dayBefore(1), method: 'm',
  groups: RESEARCH_GROUP_IDS.map((id) => ({ id, title: id, items: id === groupId ? items : [] })) });
const problemsOf = (fields) => researchReferenceProblems(artifact([item(fields)]), { nowMs: NOW });

const empty = artifact([]);
check('v60.59 an artifact with empty groups has no schema problem and reads as empty', !researchReferenceProblems(empty, { nowMs: NOW }).length && researchReference(empty, { nowMs: NOW }).state === 'empty');
check('v60.59 empty groups give no AI fact line', researchFactLines(empty, { nowMs: NOW }).length === 0 && researchFactLines(null).length === 0);
check('v60.59 a missing file reads as loading, a failed one as unavailable', researchReference(null).state === 'loading' && researchReference(null, { loadState: 'failed' }).state === 'unavailable');
check('v60.59 a well-formed row has no problem', !problemsOf({}).length, problemsOf({}).join('; '));
check('v60.59 a row without asOf fails', problemsOf({ asOf: null }).some((p) => /asOf/.test(p)));
check('v60.59 a row dated after today fails', problemsOf({ asOf: '2026-11-27' }).some((p) => /after today/.test(p)));
check('v60.59 a row without an https sourceUrl fails', problemsOf({ sourceUrl: 'http://example.com' }).some((p) => /sourceUrl/.test(p)) && problemsOf({ sourceUrl: '' }).some((p) => /sourceUrl/.test(p)));
check('v60.59 a non-numeric value fails', problemsOf({ value: '120' }).some((p) => /value/.test(p)));
check('v60.59 an unknown unit fails', problemsOf({ unit: 'usdMn' }).some((p) => /unknown unit/.test(p)));
check('v60.59 value and range together fail (exactly one)', problemsOf({ range: [1, 2] }).some((p) => /exactly one/.test(p)));
check('v60.59 neither value nor range fails', problemsOf({ value: null }).some((p) => /exactly one/.test(p)));
check('v60.59 a range alone passes, a reversed range fails', !problemsOf({ value: undefined, range: [8, 13], unit: 'qoqPct', prior: { range: [15, 20], asOf: dayBefore(30) } }).length
  && problemsOf({ value: undefined, range: [13, 8], unit: 'qoqPct' }).some((p) => /exactly one/.test(p)));
check('v60.59 every lead-requested unit is known', ['pct', 'bp', 'usdBn', 'price', 'qoqPct'].every((unit) => RESEARCH_UNITS.includes(unit)));
check('v60.59 an unknown kind fails, forecast passes', problemsOf({ kind: 'guess' }).some((p) => /kind/.test(p)) && !problemsOf({ kind: 'forecast', period: '2026-Q4' }).length);
check('v60.59 an unknown group id fails', researchReferenceProblems({ ...empty, groups: [{ id: 'oil', title: 'x', items: [] }] }, { nowMs: NOW }).some((p) => /unknown group/.test(p)));

// Ageing per row, from the row's own asOf.
const aged = researchReference(artifact([item({ id: 'fresh' }), item({ id: 'old', asOf: dayBefore(RESEARCH_STALE_DAYS + 1), prior: null }),
  item({ id: 'gone', asOf: dayBefore(RESEARCH_DROP_DAYS + 1), prior: null }), item({ id: 'future', asOf: '2026-11-28' })]), { nowMs: NOW });
const byId = Object.fromEntries(aged.rows.map((row) => [row.id, row]));
check(`v60.59 a row under ${RESEARCH_STALE_DAYS} days is current`, byId.fresh && !byId.fresh.stale);
check(`v60.59 a row past ${RESEARCH_STALE_DAYS} days keeps its date with 갱신 전`, byId.old?.stale === true && byId.old.date.text === shortDate(dayBefore(RESEARCH_STALE_DAYS + 1)));
check(`v60.59 a row past ${RESEARCH_DROP_DAYS} days leaves the face, a future-dated row never shows`, !byId.gone && !byId.future);
// A period figure names its own window: inside it the row stays without the tag, past it the row leaves.
const windowed = researchReference(artifact([item({ id: 'total', asOf: dayBefore(40), prior: null, validDays: 60 }), item({ id: 'lapsed', asOf: dayBefore(61), prior: null, validDays: 60 })]), { nowMs: NOW });
check('v60.59 a row with validDays stays untagged inside its window and leaves after it', windowed.rows.length === 1 && windowed.rows[0].id === 'total' && windowed.rows[0].stale === false);
check('v60.59 validDays outside 22..120 fails', problemsOf({ validDays: 21 }).some((p) => /validDays/.test(p)) && problemsOf({ validDays: 121 }).some((p) => /validDays/.test(p)) && !problemsOf({ validDays: 60 }).length);

// Printed values and changes come from claims.
check('v60.59 a bp level prints its change against the prior in bp', byId.fresh.value.text === '120bp' && /대비 \+20bp$/.test(byId.fresh.change.text), `${byId.fresh.value.text} / ${byId.fresh.change.text}`);
const yieldRow = researchReference(artifact([item({ value: 6.42, unit: 'pct', prior: { value: 6.1, asOf: dayBefore(9) } })]), { nowMs: NOW }).rows[0];
check('v60.59 a yield in % moves in bp', yieldRow.value.text === '6.42%' && /\+32bp$/.test(yieldRow.change.text), `${yieldRow.value.text} / ${yieldRow.change.text}`);
const rangeRow = researchReference(artifact([item({ value: undefined, range: [8, 13], unit: 'qoqPct', kind: 'forecast', period: '2026-Q4', prior: { range: [15, 20], asOf: dayBefore(30) } })], 'memory-price'), { groups: ['memory-price'], nowMs: NOW }).rows[0];
check('v60.59 a forecast range prints one sign and unit for the pair (+8~13%) with its prior range and the 전망 tag', rangeRow.value.text === '+8~13%' && /^이전 \+15~20%/.test(rangeRow.change.text) && rangeRow.forecast && rangeRow.period === '2026-Q4', `${rangeRow.value.text} / ${rangeRow.change.text}`);
check('v60.59 every printed figure is carried by a claim', [byId.fresh, yieldRow, rangeRow].every((row) => row.claims.length >= 2));
const entityView = researchReference(artifact([item({ id: 'a' }), item({ id: 'b', entity: null })]), { entity: 'orcl', nowMs: NOW });
check('v60.59 the stock page keeps only its own ticker\'s rows', entityView.rows.length === 1 && entityView.rows[0].id === 'a');
const lines = researchFactLines(artifact([item({})]), { nowMs: NOW });
check('v60.59 an AI fact line is dated, names its basis and says it is outside the scores', lines.length === 1 && lines[0].includes(`기준일 ${dayBefore(2)}`) && /점수에 넣지 않음/.test(lines[0]) && /오라클 5년 CDS 120bp/.test(lines[0]), lines[0]);

// ── Rendering: labelled, dated, sources folded, nothing for no row ─────────
{
  const doc = createFakeDocument();
  const view = researchReference(artifact([item({ asOf: dayBefore(RESEARCH_STALE_DAYS + 2) })]), { nowMs: NOW });
  const block = researchReferenceBlock(doc, view);
  const text = block?.textContent || '';
  check('v60.59 the block says the rows are researched with their own dates', text.startsWith(RESEARCH_WORDS.kicker), text);
  check('v60.59 a row shows value, change, date and the quiet 갱신 전 tag', /120bp · .*대비 \+20bp · \d+\/\d+ 갱신 전 — 조달 부담/.test(text), text);
  const fold = block?.querySelector?.('details');
  check('v60.59 sources sit in a 데이터 출처 fold, not on the face', fold?.dataset?.foldKind === 'sources' && /공개 자료/.test(fold.textContent) && !/공개 자료/.test(text.slice(0, text.indexOf('데이터 출처'))));
  check('v60.59 no current row renders nothing (no empty frame)', researchReferenceBlock(doc, researchReference(empty, { nowMs: NOW })) === null);
}

// ── Formats through the claim layer: ranges and signed flows ───────────────
{
  const range = (unit, lo, hi, digits) => figureRangeText({ unit, value: lo, digits }, { unit, value: hi, digits });
  check('v60.59 a range prints one sign and one unit: +8~13%, -0~5%, -2~+3%, 7.00~8.65%', range('pct', 8, 13, 0) === '+8~13%' && range('pct', -5, 0, 0) === '-0~5%'
    && range('pct', -2, 3, 0) === '-2~+3%' && range('rate', 7, 8.65, 2) === '7.00~8.65%', [range('pct', 8, 13, 0), range('pct', -5, 0, 0), range('pct', -2, 3, 0), range('rate', 7, 8.65, 2)].join(' '));
  const ranged = say('{v.range}', { v: claim({ subject: 's', measure: 'm', figures: [{ unit: 'pct', value: 8, digits: 0, label: 'lo' }, { unit: 'pct', value: 13, digits: 0, label: 'hi' }] }) });
  check('v60.59 the claim checker counts a printed range as carried by its claim', ranged.text === '+8~13%' && unclaimedFigures(ranged).length === 0, JSON.stringify(unclaimedFigures(ranged)));
  const rows = researchReference(artifact([item({ id: 'in', unit: 'usdBn', value: 59.23, prior: null }), item({ id: 'out', unit: 'usdBn', value: -2.78, prior: null }), item({ id: 'deal', unit: 'amountUsdBn', value: 10, prior: null })], 'fund-flows'), { groups: ['fund-flows'], nowMs: NOW }).rows;
  const text = Object.fromEntries(rows.map((row) => [row.id, row.value.text]));
  check('v60.59 a fund flow is signed (+592억 달러 in, -27.8억 달러 out); a deal amount is not', text.in === '+592억 달러' && text.out === '-27.8억 달러' && text.deal === '100억 달러', JSON.stringify(text));
}

// ── The AI funding chain ────────────────────────────────────────────────────
{
  // A spread series that widens 2bp a session (40bp over 20 sessions: past the credit axis's line).
  const weekdays = [];
  for (let ms = Date.parse('2026-09-14T00:00:00Z'); weekdays.length < 30; ms += 86400000) { const d = new Date(ms); if (d.getUTCDay() % 6) weekdays.push(d.toISOString().slice(0, 10)); }
  const seriesOf = (start, step) => ({ frequency: 'daily', observations: weekdays.map((date, i) => [date, Number((start + step * i).toFixed(4))]) });
  const macroHistory = { series: { hyOas: seriesOf(3, 0.02), dgs10: seriesOf(4.5, 0) } };
  // Eight reported quarters per issuer; the neocloud spends more than it earns.
  const starts = ['2024-10-01', '2025-01-01', '2025-04-01', '2025-07-01', '2025-10-01', '2026-01-01', '2026-04-01', '2026-07-01'];
  const endOf = (start) => { const d = new Date(`${start}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 3); d.setUTCDate(0); return d.toISOString().slice(0, 10); };
  const tagged = (value) => ({ units: { USD: starts.map((start) => ({ start, end: endOf(start), val: value, form: '10-Q', filed: '2026-10-30' })) } });
  const facts = (ocf, capex) => ({ facts: { 'us-gaap': { NetCashProvidedByUsedInOperatingActivities: tagged(ocf), PaymentsToAcquirePropertyPlantAndEquipment: tagged(capex) } } });
  const cashflow = buildBigtechCashflow({ factsBySymbol: Object.fromEntries(BIGTECH_ISSUERS.map(({ symbol }) => [symbol, symbol === 'CRWV' ? facts(1e9, 5e9) : facts(10e9, 6e9)])), nowMs: NOW });
  check('v60.59 CoreWeave is a neocloud issuer, outside the hyperscaler total', BIGTECH_ISSUERS.find((row) => row.symbol === 'CRWV')?.group === 'neocloud' && !HYPERSCALERS.includes('CRWV')
    && !cashflow.hyperscalers.members.includes('CRWV') && cashflow.hyperscalers.ocf === 5 * 4 * 10e9, JSON.stringify(cashflow.hyperscalers.members));
  const research = artifact([], 'credit-single-name');
  research.groups.find((group) => group.id === 'credit-single-name').items.push(item({ id: 'cds' }));
  research.groups.find((group) => group.id === 'ai-financing').items.push(item({ id: 'deal', label: '회사채 발행', unit: 'amountUsdBn', value: 10, prior: null }));
  research.groups.find((group) => group.id === 'compute-price').items.push(item({ id: 'gpu', label: 'GPU 임대료', entity: null, unit: 'usd', value: 4.12, prior: null }));
  const chain = aiFundingChain({ cashflow, macroHistory, research, nowMs: NOW });
  const link = Object.fromEntries(chain.links.map((entry) => [entry.id, entry]));
  check('v60.59 the chain runs 투자 → 현금 → 조달 → 신용 가격 → 대출 여건 → 장비 가격 → 금리·유동성', chain.links.map((entry) => entry.id).join() === FUNDING_CHAIN_LINK_IDS.join()
    && FUNDING_CHAIN_LINK_IDS.join() === 'capex,cash,funding,credit,lending,hardware,rates' && chain.links.every((entry, i) => entry.n === i + 1 && entry.title === FUNDING_CHAIN_WORDS.links[entry.id]));
  check('v60.59 a link with only researched rows has no state word (조달, 장비 가격)', link.funding.rows.length === 1 && link.funding.state === null && link.funding.stateWord === null
    && link.hardware.rows.length === 1 && link.hardware.state === null);
  check('v60.59 the credit link\'s state comes from the automated spread (40bp in 20 sessions), not its researched CDS row', link.credit.state === 'tighter' && link.credit.rows[0].kind === 'auto' && link.credit.rows.some((row) => row.kind === 'researched'));
  const researchedOnly = aiFundingChain({ research, nowMs: NOW });
  check('v60.59 without automated rows no link has a state and the chain says no count', researchedOnly.links.every((entry) => entry.state === null) && researchedOnly.said.text === '');
  check('v60.59 a link with nothing confirmed is empty (대출 여건)', link.lending.empty && link.lending.rows.length === 0);
  check('v60.59 each link faces at most three rows, automated first', chain.links.every((entry) => entry.face.length <= 3 && entry.face.every((row, i, all) => i === 0 || !(row.kind === 'auto' && all[i - 1].kind === 'researched'))));
  check('v60.59 the neocloud reads beside the hyperscalers in the cash link, its free cash flow negative', /코어위브 잉여현금흐름\(최근 4분기\) -160억 달러/.test(link.cash.rows.map((row) => row.said.text).join(' | ')), link.cash.rows.map((row) => row.said.text).join(' | '));
  check('v60.59 flat capex and a flat capex ÷ OCF read 변화 없음; the chain counts its automated links', link.capex.state === 'flat' && link.cash.state === 'flat' && link.rates.state === 'flat'
    && chain.said.text === '자동 집계 고리 4개 중 1개 부담 커짐', chain.said.text);
  const lines = fundingChainFactLines({ cashflow, macroHistory, research, nowMs: NOW });
  check('v60.59 the AI fact lines carry each row\'s link, kind and date; researched rows say they are outside every score', lines[0].includes('자동 집계 고리 4개 중 1개 부담 커짐')
    && lines.some((line) => /3\.조달\(조사 자료, .*점수에 넣지 않음; 기준일 \d{4}-\d{2}-\d{2}\): 회사채 발행 100억 달러/.test(line)) && lines.some((line) => /4\.신용 가격\(자동 집계, 고리 상태 부담 커짐; 기준일/.test(line)), lines.join('\n'));
  research.groups.find((group) => group.id === 'fund-flows').items.push(item({ id: 'flow', label: '주식형 펀드 자금', entity: null, unit: 'usdBn', value: 5, prior: null }));
  const reading = marketReadingFundingLines({ cashflow, macroHistory, research, nowMs: NOW });
  check('v60.59 the market reading gets the chain plus the groups it does not carry, no researched row twice', reading.filter((line) => line.includes('오라클 5년 CDS')).length === 1
    && reading.filter((line) => line.includes('주식형 펀드 자금')).length === 1 && !FUNDING_CHAIN_RESEARCH_GROUPS.includes('fund-flows'), reading.join('\n'));
  // Rendering: seven numbered links, the empty one says so, the researched rows carry the quiet mark.
  const doc = createFakeDocument();
  const block = fundingChainBlock(doc, chain, { id: 'fc' });
  const links = block?.querySelectorAll?.('.funding-chain__link') || [];
  check('v60.59 the block draws seven numbered links in order', links.length === 7 && [...links].map((li) => li.dataset.link).join() === FUNDING_CHAIN_LINK_IDS.join());
  check('v60.59 the empty link prints 확인된 자료 없음 and no state tag', /확인된 자료 없음/.test([...links][4]?.textContent || '') && !([...links][4]?.querySelector?.('.funding-chain__state')));
  check('v60.59 a researched row carries the 조사 mark, an automated one does not', [...block.querySelectorAll('.funding-chain__row')].every((row) => (row.dataset.kind === 'researched') === !!row.querySelector('.funding-chain__mark')));
  check('v60.59 the folds are a raw table, the method and the sources', [...block.querySelectorAll('details')].map((fold) => fold.dataset.foldKind).join() === 'raw-table,method,sources');
  check('v60.59 nothing loaded draws no block and no pointer', fundingChainBlock(doc, aiFundingChain({ nowMs: NOW })) === null && fundingChainPointer(doc, aiFundingChain({ nowMs: NOW })) === null);
  check('v60.59 the pointer on other screens is one line with the chain\'s count and a way to 테마와 섹터', /^AI 자금 조달 사슬: 자동 집계 고리 4개 중 1개 부담 커짐/.test(fundingChainPointer(doc, chain)?.textContent || '')
    && fundingChainPointer(doc, chain)?.querySelector?.('button')?.dataset?.arg === 'themes');
  // 매크로's credit chapter: the yields slot is empty-safe until the producer publishes the effective yields.
  check('v60.59 the credit chapter\'s yields slot is empty without the series and filled with them', creditYields(null).length === 0 && creditYields(macroHistory).length === 0
    && creditYields({ series: { ...macroHistory.series, hyYield: seriesOf(8, 0.01) } })[0]?.value === '8.29% (20거래일 +20bp)', JSON.stringify(creditYields({ series: { ...macroHistory.series, hyYield: seriesOf(8, 0.01) } })));
  const credit = buildMacroChapters({ macroHistory }).chapters?.find((chapter) => chapter.id === 'credit');
  check('v60.59 the credit chapter builds with an empty yields slot', !credit || (Array.isArray(credit.yields) && credit.yields.length === 0));
}

// ── Boundary: who reads the read model ─────────────────────────────────────
// The funding chain reads the rows to show them and to keep them out of its state words (asserted above).
const READERS = new Set(['src/domain/research/reference.js', 'src/domain/themes/ai-funding-chain.js', 'src/data/research-reference.js', 'src/ui/components/research-reference.js', 'scripts/ci-research-reference-check.mjs']);
const walk = (dir) => readdirSync(join(root, dir)).flatMap((name) => {
  const path = `${dir}/${name}`;
  return statSync(join(root, path)).isDirectory() ? walk(path) : /\.(m?js)$/.test(name) ? [path] : [];
});
const importers = [...walk('src'), ...walk('scripts')].filter((path) => /domain\/research\/reference\.js['"]/.test(read(path)) && !READERS.has(relative(root, join(root, path)).replace(/\\/g, '/')));
// The AI market-reading producer may import researchFactLines; nothing that scores, ranks or charts may.
const allowed = (path) => /^scripts\/(producer\/market-narrative\.mjs|lib\/[^/]*narrative[^/]*\.mjs)$/.test(path);
check('v60.59 only the research lane (and the AI reading input) reads the researched rows — never a score, rank or chart module', importers.every(allowed), importers.filter((path) => !allowed(path)).join(', '));

if (errors.length) {
  console.error('Research reference check failed:');
  errors.forEach((error) => console.error(` - ${error}`));
  process.exit(1);
}
console.log(`[research-reference] ok: ${committed.groups.reduce((n, group) => n + group.items.length, 0)} researched rows, ${problems.length} problems.`);
