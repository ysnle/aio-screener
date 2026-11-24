// v60.50 (stock-reading-defects, audit 2026-11-23 _artifacts/whole-audit-20261123/FINDINGS.md): the stock screens' reading
// defects found on the live MU and SNDK pages, each held on the rows where the defect showed (frozen since v60.51).
// Reads only; exits 1 on any failure.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFiscalRead, parseFiscalHistory } from '../src/domain/fundamental/fiscal-read.js';
import { parseQuarterHistory, buildQuarterRead } from '../src/domain/fundamental/quarter-read.js';
import { expandSecRecords } from '../src/data/contracts/sec-projection.js';
import { consensusView, buildConsensusPoint, peakEarningsCaution } from '../src/domain/fundamental/consensus-read.js';
import { buildThesisFrame, buildLensRead, buildPeerStrengths, lensIdFor } from '../src/domain/fundamental/stock-lens.js';
import { buildTrailingYearRead } from '../src/domain/fundamental/analysis-read.js';
import { buildPricedInRead, CYCLICAL_PER_TERM } from '../src/domain/fundamental/priced-in.js';
import { TERM_MARKS } from '../src/ui/components/term-marks.js';
import { shortDateAgainst } from '../src/domain/content/date-labels.js';
import { classifyTrend, recentDrop } from '../src/domain/technical/bands.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'));
const failures = [];
const check = (ok, label) => { if (!ok) failures.push(label); };

// v60.51 (check-fixtures): every assertion here is about a rule, so it reads rows frozen from the 2026-11-24 artifacts
// (scripts/fixtures/reading-defects/stock-rows.json: the screener rows as normalizeScreener returns them, the consensus
// rows, the SEC fiscal history and summary records). v60.50 read the live files and broke within hours as consensus
// numbers and the 11/23 rows refreshed; a later refresh cannot move these.
const FROZEN = readJson('scripts/fixtures/reading-defects/stock-rows.json');
const fiscalHistory = FROZEN.fiscalHistory;
const secTable = expandSecRecords(FROZEN.secSummary);
const consensus = FROZEN.consensus;
const now = Date.parse(consensus.generatedAt);
const rows = new Map(Object.entries(FROZEN.screenerRows));
const quartersOf = (sym) => parseQuarterHistory(fiscalHistory.quarters?.[sym] || '');
const fiscalOf = (sym) => buildFiscalRead({ symbol: sym, fundamentals: { ...(secTable[sym] || {}), fiscalHistory: parseFiscalHistory(fiscalHistory.data[sym]) }, row: rows.get(sym) || null, quarters: quartersOf(sym) });
const pointOf = (read, id) => read.points.find((point) => point.id === id)?.text || '';

// 1. B26: a negative implied growth reads as a shrink the price still explains (MU -1.8%).
{
  const frame = buildThesisFrame({ implied: { state: 'ready', growth: -0.018 }, trailing: { revenueYoy: 256.3 } });
  const all = [frame.priced, ...frame.conditions, ...frame.breaks].join(' | ');
  check(!/-1\.8%/.test(all), `v60.50 B26: negative implied growth prints "-1.8%" in a growth sentence (${all})`);
  check(frame.priced.includes('해마다 1.8%씩 줄어도 설명됩니다'), `v60.50 B26: priced line does not say the price holds while FCF shrinks (${frame.priced})`);
  check(frame.conditions[0].includes('1.8% 감소보다 빠르게 줄지 않는다'), `v60.50 B26: thesis condition is not "does not shrink faster" (${frame.conditions[0]})`);
  check(frame.breaks[0].includes('1.8%보다 빠르게 줄어드는'), `v60.50 B26: break signal is not "shrinks faster" (${frame.breaks[0]})`);
  const up = buildThesisFrame({ implied: { state: 'ready', growth: 0.052 } });
  check(up.priced.includes('연 5.2% 늘어나야 설명됩니다') && up.conditions[0].includes('5.2% 이상으로 이어진다'), `v60.50 B26: positive implied growth wording changed (${up.priced})`);
}

// 2. B27: "돌아섰습니다" only when the adjacent prior year had the other sign.
{
  const mu = pointOf(fiscalOf('MU'), 'margin');
  check(mu && !mu.includes('돌아섰습니다'), `v60.50 B27: MU margin says turnaround although FY2024–25 were profitable (${mu})`);
  check(mu.includes('흑자는 2024 회계연도부터'), `v60.50 B27: MU margin does not name the first profitable year (${mu})`);
  const sndk = pointOf(fiscalOf('SNDK'), 'margin');
  check(sndk.includes('적자에서 흑자로 돌아섰습니다'), `v60.50 B27: SNDK (FY2025 loss → FY2026 profit) lost its turnaround sentence (${sndk})`);
}

// 3. B29: the latest quarter far above the trailing four quarters reads 빨라짐 (MU +379.3% vs +256.3%).
{
  const history = parseFiscalHistory(fiscalHistory.data.MU);
  const quarters = quartersOf('MU');
  const lens = buildLensRead({ lens: lensIdFor({ sic: 3674 }), history, trailing: buildTrailingYearRead(quarters), quarterRead: buildQuarterRead(quarters, { symbol: 'MU' }) });
  const growth = lens.rows.find((row) => row.id === 'revenueGrowth');
  check(/직전 분기 전년비 \+379\.3%/.test(growth?.value || ''), `v60.50 B29: MU revenue growth row is not on the published quarters (${growth?.value})`);
  check(growth?.trend === '빨라짐', `v60.50 B29: MU revenue growth reads "${growth?.trend}" with quarter +379.3% over four quarters +256.3%`);
}

// 4. B28: the valuation path carries the consensus peak-earnings caution instead of "다시 매겨질 여지".
{
  const view = consensusView(rows.get('MU'), consensus.rows.MU, { now });
  check(view?.fwdPe != null && view.fwdPe > 2 && view.fwdPe < 6, `v60.50 B28: MU forward PER off the published rows (${view?.fwdPe})`);
  check(peakEarningsCaution(view), `v60.50 B28: MU expected growth ${view?.growth} does not raise the peak-earnings caution`);
  const point = buildConsensusPoint(rows.get('MU'), consensus.rows.MU, { now });
  check(!point.text.includes('정점 근처에서'), `v60.50 B28: MU consensus line still repeats the caution the priced-in condition carries (${point.text})`);
  check(buildPricedInRead(rows.get('MU'), consensus.rows.MU, { now })?.text.includes('경기순환 업종이면 호황이 꺾이는지가 갈림입니다'), 'v60.50 B28: MU lost its peak-earnings caution');
  const peak = buildThesisFrame({ peerPe: { value: view.fwdPe, median: 10.5 }, peakEarnings: peakEarningsCaution(view) }).paths.find((p) => p.id === 'multiple').holds;
  check(!peak.includes('다시 매겨질 여지가 있습니다') && peak.includes('정점'), `v60.50 B28: MU valuation path contradicts the consensus caution (${peak})`);
  const calm = buildThesisFrame({ peerPe: { value: 12, median: 20 }, peakEarnings: false }).paths.find((p) => p.id === 'multiple').holds;
  check(calm.includes('다시 매겨질 여지가 있습니다'), `v60.50 B28: without the caution the re-rating path is gone (${calm})`);
}

// 5. A6: a chart extreme from an earlier year prints its year.
{
  check(shortDateAgainst('2025-11-20', '2026-11-20') === '2025/11/20', `v60.50 A6: a 2025 low beside a 2026 session reads "${shortDateAgainst('2025-11-20', '2026-11-20')}"`);
  check(shortDateAgainst('2026-06-25', '2026-11-20') === '6/25', `v60.50 A6: a same-year high gained a year ("${shortDateAgainst('2026-06-25', '2026-11-20')}")`);
}

// 6. C: no PEG at extreme growth (MU +895%), the PER kept; a healthy ROE is not a 약한 점.
{
  const earnings = pointOf(fiscalOf('MU'), 'earnings');
  check(!/PEG (약 )?0\.\d/.test(earnings), `v60.50 C: MU prints a PEG near zero at +895% growth (${earnings})`);
  check(earnings.includes('PEG는 적지 않습니다') && /PER \d/.test(earnings), `v60.50 C: MU earnings line does not keep the PER and say why the PEG is withheld (${earnings})`);
  const peers = [{ self: true, roe: 88.3 }, { roe: 120 }, { roe: 110 }, { roe: 100 }, { roe: 95 }, { roe: 30 }, { roe: 20 }, { roe: 10 }];
  const read = buildPeerStrengths(peers);
  check(!read.weaknesses.some((fact) => fact.id === 'roe'), `v60.50 C: ROE 88.3% listed as 약한 점 for trailing richer peers (${read.weaknesses.map((f) => f.text).join(' | ')})`);
  const low = buildPeerStrengths([{ self: true, roe: 8 }, { roe: 30 }, { roe: 25 }, { roe: 22 }, { roe: 18 }]);
  check(low.weaknesses.some((fact) => fact.id === 'roe'), 'v60.50 C: ROE 8% below every peer is no longer a 약한 점');
}

// 7. B23: the five-session drop label names the past week.
{
  const trend = classifyTrend({ s50: 3, s200: 12, adr: 1.5, drop: recentDrop({ ret5d: -6, adrPct: 1.5 }) });
  check(trend?.id === 'up-shaken' && trend.label.includes('최근 한 주') && !trend.label.includes('단기 급락'), `v60.50 B23: up-shaken label does not name the past week (${trend?.label})`);
}

// 8. A7: SNDK's close (post 8:1 split, adjusted) against pre-split consensus EPS — no multiple, the reason instead.
{
  const view = consensusView(rows.get('SNDK'), consensus.rows.SNDK, { now });
  check(view && view.fwdPe == null && view.trailingPe == null && view.priceBasisHeld, `v60.50 A7: SNDK still gets a multiple from implausible inputs (fwd ${view?.fwdPe}, trailing ${view?.trailingPe})`);
  const point = buildConsensusPoint(rows.get('SNDK'), consensus.rows.SNDK, { now });
  check(point && point.text.startsWith('Forward PER 보류') && !/0\.\d배/.test(point.text) && point.text.includes('같은 주식 기준'), `v60.50 A7: SNDK consensus line does not withhold the PER with its reason (${point?.text})`);
}

// 9. 이 주가가 반영하는 것: the price against its 52-week closing high and the estimates, the condition
// as arithmetic (cut = 1 − trailing EPS ÷ forward EPS), the peak caution joined in, withheld on unreadable inputs.
{
  const priced = (sym) => buildPricedInRead(rows.get(sym), consensus.rows[sym], { now });
  // State 1 (ahead): MU -51% from its high, estimates not cut, forward EPS above trailing.
  // Fixed rows in the shape of the 11/20 close: the states are rule outcomes, so the inputs are stated here and a later
  // close or estimate revision does not move them.
  const fixed = (sym, price, fromHigh, trailingEps, fwdEps) => buildPricedInRead({ sym, _valuationPrice: price, factorSessionDate: '2026-11-20', pctFromCloseHigh52w: fromHigh },
    { sym, asOf: '2026-11-22T00:00:00Z', fwd: { from: '2026-12', to: '2027-09', eps: fwdEps, up4w: 0, down4w: 0 }, trailing: { eps: trailingEps } }, { now: Date.parse('2026-11-23T00:00:00Z') });
  const mu = fixed('MU', 200, -51, 25, 58.8);
  check(mu?.state === 'ahead' && /^\d+\/\d+ 종가는 52주 종가 고점 대비 -51%인데 이익 추정치는 내려가지 않았습니다/.test(mu.lines[0].text) && mu.lines[0].text.includes('시장이 추정치보다 먼저 이익 감소를 반영하고 있습니다'), `v60.50 priced-in: MU does not read as the market pricing a fall ahead of the estimates (${mu?.state}: ${mu?.lines[0]?.text})`);
  const cut = (1 - 25 / 58.8) * 100;
  check(mu?.lines[1].text.startsWith(`추정치대로면 PER 3.4배로 직전 이익 기준(8.0배)보다 낮은 가격이고, 이익이 추정치보다 ${cut.toFixed(0)}% 넘게 줄면 그렇지 않습니다.`), `v60.50 priced-in: MU condition is not the exact cut ${cut.toFixed(1)}% (${mu?.lines[1]?.text})`);
  check(mu?.text.includes(`(${CYCLICAL_PER_TERM})`) && mu.term === CYCLICAL_PER_TERM && TERM_MARKS.some(([text, term]) => text === CYCLICAL_PER_TERM && term === CYCLICAL_PER_TERM), 'v60.50 priced-in: MU caution does not name the glossary term the screen marks');
  // State 3 (leaning): AAPL near its high at 38.9x on +6% expected growth; no "비싸다" assertion, no "꺾이면" clause.
  const aapl = fixed('AAPL', 233.4, -2, 6, 6.36);
  check(aapl?.state === 'leaning' && aapl.text.includes('PER은 직전 4개 분기 이익으로 38.9배') && aapl.text.includes('이익보다 높은 배수에 기대는 가격') && !/비싸|꺾이면/.test(aapl.text), `v60.50 priced-in: AAPL does not state the dependence on its multiple (${aapl?.state}: ${aapl?.text})`);
  // State 4 (plain): MSFT -13% — the two numbers only.
  const msft = fixed('MSFT', 400, -13, 13, 15);
  check(msft?.state === 'plain' && msft.lines.length === 1 && !/꺾이면|반영하고|기대는/.test(msft.text), `v60.50 priced-in: MSFT says more than its two numbers (${msft?.state}: ${msft?.text})`);
  // State 2 (confirmed): far below the high with down revisions ahead by the net floor.
  const cut2 = buildPricedInRead({ sym: 'CF', _valuationPrice: 50, factorSessionDate: '2026-11-20', pctFromCloseHigh52w: -45 },
    { sym: 'CF', asOf: '2026-11-22T00:00:00Z', fwd: { from: '2026-12', to: '2027-09', eps: 4, up4w: 1, down4w: 6 }, trailing: { eps: 5 } }, { now: Date.parse('2026-11-23T00:00:00Z') });
  check(cut2?.state === 'confirmed' && cut2.lines[1].text === '주가 하락을 추정치 하향이 뒤따르고 있어, PER 12.5배(직전 이익으로 10.0배)는 아직 바닥 근거가 아닙니다.', `v60.50 priced-in: confirmed-fall wording (${cut2?.state}: ${cut2?.lines?.[1]?.text})`);
  check(priced('SNDK') === null, 'v60.50 priced-in: SNDK (pre-split EPS against a post-split close, PE_PLAUSIBLE_MIN) gets a priced-in line');
  check(priced('BA') === null, 'v60.50 priced-in: BA (loss over the last four quarters) gets a priced-in line');
  for (const sym of ['MU', 'NVDA', 'AAPL', 'KO', 'AVGO', 'MSFT']) {
    const text = priced(sym)?.text || '';
    check(!/매수|매도|사라|팔라|비중을/.test(text), `v60.50 priced-in: ${sym} line reads as an order (${text})`);
  }
  // Under the peak caution a low forward PER is not listed as 강한 점 (MU 3.4배 '가격 부담이 가벼운 편' under the condition).
  const pePeers = [{ self: true, fwdPe: 3.4 }, { fwdPe: 14.8 }, { fwdPe: 20 }, { fwdPe: 12 }, { fwdPe: 30 }];
  check(!buildPeerStrengths(pePeers, { peakEarnings: true }).strengths.some((fact) => fact.id === 'fwdPe') && buildPeerStrengths(pePeers, { peakEarnings: true }).facts.some((fact) => fact.id === 'fwdPe'), 'v60.50 priced-in: a peak-flattered forward PER is still a 강한 점 (or left the peer facts the thesis path reads)');
  check(buildPeerStrengths(pePeers).strengths.some((fact) => fact.id === 'fwdPe'), 'v60.50 priced-in: without the caution a low forward PER is no longer a strength');
}

if (failures.length) {
  console.error(`[stock-reading-defects] FAIL (${failures.length})\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('[stock-reading-defects] OK: B26 reverse DCF sign, B27 turnaround year, B29 growth direction, B28 peak caution, A6 chart year, C PEG bound and healthy ROE, B23 week label, A7 SNDK split basis, priced-in condition (v60.50)');
