#!/usr/bin/env node
// v60.51 (stock-producer-leftovers, audit 2026-11-23 _artifacts/whole-audit-20261123/FINDINGS.md A5, A7, B8, B25, A1):
// the five findings left after v60.50, each held on fixture rows written out below (copied from the published rows where
// the defect showed), through the code that owns the fix. Reads no public-data; exits 1 on any failure.
//   A5  frozen company-story text never renders as "현재" beside a number and dates its revision counts (render + producer warning)
//   A7  consensus EPS published on a pre-split basis is put on the split-adjusted close's basis, a mismatch is flagged
//   B8  a held weekend copy carries its session's recorded close, and session math never reads the weekend row
//   B25 a decision frame with no sourced leg is not drawn; the stage condition count lists every condition it counts
//   A1  a US index quote's change is taken against the history close before its own session
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const load = (rel) => import(pathToFileURL(path.join(ROOT, rel)).href);
const failures = [];
const check = (ok, label, detail) => { if (!ok) failures.push(`${label}${detail === undefined ? '' : ` — ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`}`); };
const { createFakeDocument } = await load('scripts/lib/fake-dom.mjs');

// ── A5: MU's story (researchedAt 2026-10-28) beside the 11/22 consensus table ──
{
  const { datedResearchText, datedStory, storyResearchWarnings } = await load('src/domain/fundamental/research-text.js');
  const { renderCompanyReport, renderCompanyOverview } = await load('src/ui/components/company-overview.js');
  const story = {
    symbol: 'MU', name: 'Micron Technology', researchedAt: '2026-10-28',
    sources: [{ publisher: 'Micron IR', date: '2026-09-23', title: '현재 상향 1건 (source title stays as written)', url: 'https://investors.micron.com/' }],
    estimates: { text: '2026-10-27 기준 컨센서스(조정 EPS, Zacks via Nasdaq) 향후 4개 분기 합계 176.51달러(범위 165.11~191.64), 직전 4개 분기 74.77달러. 최근 4주 상향 32건·하향 0건으로 강한 상향 방향.' },
    debate: { question: 'DRAM 가격 상승이 이어지는가', bull: { text: 'Q1 FY2027 가이던스는 매출 615억 달러, GAAP 총마진 약 86%이고 컨센서스는 최근 4주 상향 32건·하향 0건이다.' }, bear: { text: '세 회사의 증설이 2027~2028년에 한꺼번에 열리면 지금의 부족이 과잉으로 바뀔 수 있다.' } },
    make: { text: '지금은 클린룸 공간이 업계 전체의 병목이어서, 아이다호 신규 팹 첫 웨이퍼는 2027년 중반에 나온다.' },
    moneyFlow: { text: 'SMTC는 광 연결 매출을 지금의 10배 이상으로 키울 수 있다고 본다.' },
    trading: { conditions: ['HBM 출하 비중', '컨센서스 EPS 상향·하향 건수 추이 (현재 상향 32건)'] },
    watch: { keyNumbers: [{ name: 'DRAM 가격', why: '이익은 가격×물량이며 지금은 가격이 주도' }] }
  };
  check(datedResearchText(story.trading.conditions[1], story.researchedAt) === '컨센서스 EPS 상향·하향 건수 추이 (10/28 조사 당시 상향 32건)', 'v60.51 A5 "현재 상향 32건" renders as the research day', datedResearchText(story.trading.conditions[1], story.researchedAt));
  check(datedResearchText(story.debate.bull.text, story.researchedAt).endsWith('컨센서스는 10/28 조사 당시 최근 4주 상향 32건·하향 0건이다.'), 'v60.51 A5 an undated revision count names the research day', datedResearchText(story.debate.bull.text, story.researchedAt));
  check(datedResearchText(story.estimates.text, story.researchedAt) === story.estimates.text, 'v60.51 A5 a text that dates its own figures ("2026-10-27 기준") is left as written');
  check(datedResearchText(story.make.text, story.researchedAt) === story.make.text && datedResearchText(story.debate.bear.text, story.researchedAt) === story.debate.bear.text, 'v60.51 A5 "지금" not beside a quantity (a year, a word) is prose and stays');
  check(datedResearchText(story.moneyFlow.text, story.researchedAt) === 'SMTC는 광 연결 매출을 10/28 조사 당시의 10배 이상으로 키울 수 있다고 본다.', 'v60.51 A5 "지금의 10배" keeps its particle', datedResearchText(story.moneyFlow.text, story.researchedAt));
  const dated = datedStory(story);
  check(dated.sources[0].title === story.sources[0].title && dated.researchedAt === story.researchedAt && story.trading.conditions[1].includes('현재'), 'v60.51 A5 sources and dates are not prose, and the stored story is not changed');
  const warnings = storyResearchWarnings(story).map((w) => `${w.path}:${w.kind}`);
  check(['debate.bull.text:undated-revision-count', 'trading.conditions.1:now-beside-number'].every((w) => warnings.includes(w)) && !warnings.some((w) => /^(make|estimates|sources)/.test(w)), 'v60.51 A5 the producer warning names the two frozen "now" figures and nothing else', warnings);
  const doc = createFakeDocument();
  const report = doc.createElement('div');
  renderCompanyReport(doc, report, { story, today: '2026-11-22' });
  const reportText = report.textContent;
  check(/10\/28 조사 당시 상향 32건/.test(reportText) && !/현재 상향/.test(reportText), 'v60.51 A5 재무 공시 실적 때 함께 확인하는 것 reads the research day, not 현재', reportText.slice(0, 300));
  const host = doc.createElement('div'); const outlookHost = doc.createElement('section');
  renderCompanyOverview(doc, host, { symbol: 'MU', story, profile: { name: 'Micron' }, place: { inMap: false, rivals: [], partners: [], customers: [], suppliers: [], capital: [] }, money: { rows: [] }, outlookHost });
  check(/컨센서스는 10\/28 조사 당시 최근 4주 상향 32건/.test(outlookHost.textContent), 'v60.51 A5 쟁점과 전망 강세 읽기 dates its revision count', outlookHost.textContent.slice(0, 300));
}

// ── A7: SNDK 8-for-1 (2026-11-20), consensus row as Nasdaq published it on 11/23 ──
{
  const { alignConsensusSplit, consensusBasisMismatch } = await load('src/domain/fundamental/consensus-basis.js');
  const { applyShareBasis } = await load('scripts/fetch-consensus-estimates.mjs');
  const { buildConsensusPoint } = await load('src/domain/fundamental/consensus-read.js');
  const sndk = { asOf: '2026-11-23T07:34:53.730Z', fwd: { from: '2026-12', to: '2027-09', eps: 245.29, hi: 260.78, lo: 231.02, minEstimates: 4, up4w: 15, down4w: 0 },
    trailing: { from: '2025-12', to: '2026-09', eps: 116.79, lastReportedAt: '10/29/2026' }, hist: '2026-09:48.92:46.19;2026-06:38.82:33.28;2026-03:23.22:14.17;2025-12:5.83:3.31' };
  const listing = { sym: 'SNDK', valuationSplitRatio: 8, valuationSplitDate: '2026-11-20', valuationPrice: 87.71, pe: 5.14, factorSessionDate: '2026-11-23' };
  const aligned = alignConsensusSplit(sndk, listing);
  check(aligned.basis === 'adjusted' && aligned.row.fwd.eps === 30.661 && aligned.row.trailing.eps === 14.599 && aligned.row.hist.startsWith('2026-09:6.115:5.774') && aligned.row.shareBasis?.publishedFwdEps === 245.29, 'v60.51 A7 pre-split EPS is divided by the 8:1 split the screener row carries', aligned);
  check(alignConsensusSplit(aligned.row, listing).basis === 'already-adjusted', 'v60.51 A7 an adjusted row is never adjusted twice (kept rows carry shareBasis)');
  const point = buildConsensusPoint(listing, { sym: 'SNDK', ...aligned.row }, { now: Date.parse('2026-11-24T00:00:00Z') });
  check(/^Forward PER 약 2\.9배/.test(point?.text || ''), 'v60.51 A7 the stock page reads Forward PER 2.9x, not 0.4x', point?.text?.slice(0, 80));
  const providerAdjusted = { ...sndk, fwd: { ...sndk.fwd, eps: 30.66 }, trailing: { ...sndk.trailing, eps: 14.6 } };
  check(alignConsensusSplit(providerAdjusted, listing).basis === 'as-published', 'v60.51 A7 a provider that already split-adjusted is left as published (its trailing multiple matches the SEC P/E)');
  check(alignConsensusSplit(sndk, { ...listing, pe: null }).basis === 'adjusted', 'v60.51 A7 without an SEC P/E the plausibility floor decides');
  const scco = { asOf: '2026-11-23T07:34:33.775Z', fwd: { from: '2026-12', to: '2027-09', eps: 8.22, minEstimates: 1 }, trailing: { from: '2025-12', to: '2026-09', eps: 7.64 } };
  check(alignConsensusSplit(scco, { valuationSplitRatio: 1.01, valuationSplitDate: '2026-11-03', valuationPrice: 143.32, pe: 19.23 }).basis === 'no-split', 'v60.51 A7 a 1.01 stock dividend is not a share basis');
  check(alignConsensusSplit({ ...sndk, trailing: { ...sndk.trailing, to: '2026-09' } }, { ...listing, valuationSplitDate: '2026-05-08' }).basis === 'no-split', 'v60.51 A7 a split before the last reported quarter is already in the provider\'s figures');
  const rows = { SNDK: structuredClone(sndk), HELD: structuredClone(sndk) };
  const result = applyShareBasis(rows, { SNDK: listing, HELD: { valuationPrice: 94.39 } });
  check(result.adjusted.join() === 'SNDK' && rows.SNDK.fwd.eps === 30.661 && !rows.SNDK.basisCheck, 'v60.51 A7 the producer applies the basis before publication', result);
  check(result.mismatched.map((row) => row.sym).join() === 'HELD' && rows.HELD.basisCheck === 'eps-reaches-price' && consensusBasisMismatch(sndk, { valuationPrice: 94.39 })?.eps === 245.29, 'v60.51 A7 EPS 245.29 against a 94.39 close with no known split is flagged before publication', result.mismatched);
}

// ── B8: history rows 11/20–11/23 as published on 11/23 (won; yen moves the same way) ──
{
  const { alignHeldCopies } = await load('scripts/producer/history.mjs');
  const { buildCloseSeries } = await load('src/domain/market/session/close-series.js');
  const settled = { observedAt: '2026-11-20T22:36:29.000Z', valueBasis: 'latest-completed-close', observationRelation: 'latest-completed-close', observedAtSource: 'provider-current', sessionDate: '2026-11-20', allowedUse: 'completed-market-series' };
  const held = (extra) => ({ allowedUse: 'reference-only', observationRelation: 'carried-forward', heldReason: 'session-already-recorded', carriedFrom: '2026-11-20', sessionDate: '2026-11-20', ...extra });
  const rows = [
    { date: '2026-11-19', usdkrw: 1334.36, fieldMeta: { usdkrw: { observedAt: '2026-11-19T23:00:00.000Z', valueBasis: 'previous-completed-close', observationRelation: 'previous-completed-close', sessionDate: '2026-11-19' } } },
    { date: '2026-11-20', usdkrw: 1346.13, fieldMeta: { usdkrw: settled } },
    { date: '2026-11-21', usdkrw: 1346.13, fieldMeta: { usdkrw: held({ ...settled, heldRelation: 'latest-completed-close', observationRelation: 'carried-forward', allowedUse: 'reference-only' }) } },
    { date: '2026-11-22', usdkrw: 1334.79, fieldMeta: { usdkrw: held({ observedAt: '2026-11-20T00:00:00.000Z', valueBasis: 'previous-completed-close', observedAtSource: 'provider-previous-close', heldRelation: 'previous-completed-close' }) } },
    { date: '2026-11-23', usdkrw: 1339.5, fieldMeta: { usdkrw: held({ observedAt: '2026-11-20T00:00:00.000Z', valueBasis: 'previous-completed-close', heldRelation: 'previous-completed-close' }) } }
  ];
  const sessionsBefore = JSON.stringify(buildCloseSeries(rows, 'usdkrw'));
  const changed = typeof alignHeldCopies === 'function' ? alignHeldCopies(rows, { fields: ['usdkrw'] }) : [];
  const sunday = rows.find((row) => row.date === '2026-11-22');
  check(sunday.usdkrw === 1346.13 && sunday.fieldMeta.usdkrw.observedAt === settled.observedAt && sunday.fieldMeta.usdkrw.heldRead?.value === 1334.79 && sunday.fieldMeta.usdkrw.observationRelation === 'carried-forward', 'v60.51 B8 the Sunday copy of the 11/20 session carries 1,346.13 and keeps the 1,334.79 read in heldRead', sunday);
  check(changed.length === 1 && rows.at(-1).usdkrw === 1339.5, 'v60.51 B8 the latest row stays as read (held to the market snapshot\'s previous value) until a newer row exists', { changed, latest: rows.at(-1).usdkrw });
  check(typeof alignHeldCopies === 'function' && alignHeldCopies(rows, { fields: ['usdkrw'] }).length === 0,'v60.51 B8 aligning is idempotent');
  check(JSON.stringify(buildCloseSeries(rows, 'usdkrw')) === sessionsBefore && !buildCloseSeries(rows, 'usdkrw').some((point) => ['2026-11-21', '2026-11-22'].includes(point.date)) && buildCloseSeries(rows, 'usdkrw').find((point) => point.date === '2026-11-20')?.value === 1346.13, 'v60.51 B8 session math (buildCloseSeries) reads no weekend row and the 11/20 close once, before and after', buildCloseSeries(rows, 'usdkrw'));
}

// ── B25: a theme stage with no proxy-ETF record and the card's two counts ──
{
  const { themeDecisionFrame, buildDecisionFrame } = await load('src/domain/scenarios/decision-frame.js');
  const { decisionFrameBlock, frameHasNoLegs } = await load('src/ui/components/decision-frame.js');
  const { stageConditionText } = await load('src/ui/components/theme-playbook-view.js');
  const doc = createFakeDocument();
  const row = { state: 'pullback', pastRecord: null, favored: ['wait'], favoredWhy: '조정이 멈췄는지 확인하기 전에는 기다리는 쪽의 비용이 작습니다.', breaks: ['50일선 위 비율 하락'],
    met: 2, total: 4, known: 4, basisText: ['긴 추세 앞섬 (6개월 중앙값이 S&P 500 동일가중보다 4%p 넘게 높음) 충족', '조정이 무너지지 않음 (50일선 위 종목 40% 이상) 미충족', '중심 시나리오에서 수혜 또는 중립 (연착륙) 충족', '신용 안정 (신용 지표 양호) 미충족'] };
  const empty = themeDecisionFrame(row, { cash: { value: 3.88, date: '2026-11-21' } });
  check(typeof frameHasNoLegs === 'function' && frameHasNoLegs(empty) && decisionFrameBlock(doc, empty, { method: '' }) === null, 'v60.51 B25 a frame whose four legs are all 없음 is not drawn', empty?.missing);
  const record = { n: 73, up: 41, median: 1.0, p25: -1.2, p75: 2.7, horizon: 20, baseN: 9187, baseUpPct: 64, baseP25: -1.0, baseMedian: 1.3, baseP75: 3.1, dd5: 9, mddMedian: -1.8, baseDd5Pct: 14, baseMddMedian: -1.5, cashMedian: 0.25 };
  const drawn = decisionFrameBlock(doc, buildDecisionFrame({ record, favored: ['wait'], why: 'x', invalidation: ['y'] }), { method: '' });
  check(!!drawn && /^가능성:/.test(drawn.children[0].textContent), 'v60.51 B25 a frame with a sourced leg is still drawn');
  const line = stageConditionText(row);
  check(line === '단계 조건: 2/4 충족 — 긴 추세 앞섬 충족, 조정이 무너지지 않음 미충족, 중심 시나리오에서 수혜 또는 중립 충족, 신용 안정(시장 전체) 미충족', 'v60.51 B25 the stage count lists all four conditions it counts, credit named as the market\'s', line);
  check(!/기준 충족/.test(line), 'v60.51 B25 the stage count is named apart from the 전문가 기준 count');
  check(stageConditionText({ state: null }) === '단계 조건: 단계가 보류돼 조건을 세지 않습니다.' && /판단 보류/.test(stageConditionText({ ...row, known: 1 })), 'v60.51 B25 a held stage or too few known conditions says so');
}

// ── A1: ^VIX on Monday 11/23 13:2xZ (pre-open) with the provider's previous close one session behind ──
{
  const source = fs.readFileSync(path.join(ROOT, 'js/aio-data.js'), 'utf8');
  const block = source.slice(source.indexOf('var _AIO_KR_INDEX_FIELD'), source.indexOf('function applyLiveQuotes(quotes) {'));
  const history = [
    { date: '2026-11-19', vix: 28.44, fieldMeta: { vix: { observedAt: '2026-11-19T23:00:00.000Z', valueBasis: 'previous-completed-close', observationRelation: 'previous-completed-close', sessionDate: '2026-11-19' } } },
    { date: '2026-11-20', vix: 35.89, fieldMeta: { vix: { observedAt: '2026-11-20T21:15:00.000Z', valueBasis: 'latest-completed-close', observationRelation: 'latest-completed-close', sessionDate: '2026-11-20' } } },
    { date: '2026-11-21', vix: 35.89, fieldMeta: { vix: { observedAt: '2026-11-20T21:15:00.000Z', observationRelation: 'carried-forward', sessionDate: '2026-11-20' } } },
    { date: '2026-11-22', vix: 35.89, fieldMeta: { vix: { observedAt: '2026-11-20T21:15:00.000Z', observationRelation: 'carried-forward', sessionDate: '2026-11-20' } } }
  ];
  const win = { _aioHistory: history, addEventListener() {} };
  const ctx = { window: win, document: { addEventListener() {} }, Intl, Date, Number, Math, isFinite, applyLiveQuotes() {} };
  vm.createContext(ctx);
  vm.runInContext(block, ctx);
  const verify = win._aioVerifyUsQuoteChange || (() => undefined);
  const monday = verify({ symbol: '^VIX', _atomicObservedAt: '2026-11-23T13:25:00.000Z', regularMarketPreviousClose: 28.44 }, 30.88, 8.58);
  check(monday?.status === 'corrected' && monday.prevClose === 35.89 && monday.basisDate === '2026-11-20' && Math.abs(monday.pct + 13.96) < 0.01, 'v60.51 A1 30.88 before the 11/23 open reads -13.96% against the 11/20 close, not +8.58% against 11/19', monday);
  const friday = verify({ symbol: '^VIX', _atomicObservedAt: '2026-11-20T21:15:00.000Z', regularMarketPreviousClose: 28.44 }, 35.89, 26.2);
  check(friday?.status === 'agree' && friday.pct === 26.2, 'v60.51 A1 the 11/20 close against the 11/19 close agrees and keeps the provider\'s change', friday);
  const thin = verify({ symbol: '^VIX', _atomicObservedAt: '2026-11-25T14:00:00.000Z', regularMarketPreviousClose: 30 }, 31, 3.3);
  check(thin === null, 'v60.51 A1 a history that has not reached the previous trading day is no basis (the provider pair stays)', thin);
  check(verify({ symbol: 'AAPL', _atomicObservedAt: '2026-11-23T15:00:00.000Z', regularMarketPreviousClose: 200 }, 201, 0.5) === null, 'v60.51 A1 a symbol without a history field is not checked');
  const applied = source.slice(source.indexOf('function applyLiveQuotes(quotes) {'));
  check(/_aioVerifyUsQuoteChange\(q, price, pct\)/.test(applied) && /regularMarketPreviousClose: _usCheck\.prevClose/.test(applied), 'v60.51 A1 applyLiveQuotes republishes the corrected change with its previous close');
}

if (failures.length) { console.error(`[stock-producer-leftovers] ${failures.length} failure(s):\n  ${failures.join('\n  ')}`); process.exit(1); }
console.log('[stock-producer-leftovers] OK — A5 research-day text, A7 split basis, B8 held copies, B25 empty frame and counts, A1 quote change basis');
