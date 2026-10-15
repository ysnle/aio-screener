#!/usr/bin/env node
// P1734: contract + fixture gate for the automated official-reference lane.
// Real lane functions run against an injected fetch that serves a fake Worker answer and fake official
// page bodies, so nothing here calls AI or an official site. Proves: the search request stays inside the
// Worker budget contract, only page-confirmed values are published, failures keep the last verified value
// as stale, scheduling/caps stop calls, and the workflow stages the artifact the lane writes.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  OFFICIAL_REFERENCES_SCHEMA, LANE_POLICY, refreshOfficialReferences, validateOfficialReferences, dueDecision,
  numberRegExps, dateRegExps, pageText, CUSTOMS_PRESS_BOARD, customsReleaseLinks,
} from './lib/web-reference-verify.mjs';
import { buildSharedWebSearchBody, requestSharedAnalysis } from './lib/ai-shared-analysis.mjs';
import { prepareOpenAiBudget } from '../worker/openai-budget.mjs';
import { load as loadYaml } from 'js-yaml';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (path) => readFileSync(`${root}${path}`, 'utf8');
const failures = [];
const check = (label, passed, detail = '') => { if (!passed) failures.push(`${label}${detail ? ` :: ${detail}` : ''}`); };

const TOKEN = 'fixture-automation-token-0123456789abcdef';
const ENV = { AIO_AUTOMATION_TOKEN: TOKEN, AI_PROXY_URL: 'https://worker.example' };
const WORKER = 'https://worker.example/openai';
const URLS = {
  bokRate: 'https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643',
  bokSchedule: 'https://www.bok.or.kr/portal/singl/crncyPolicyDrcMtg/listYear.do?mtgSe=A&menuNo=200755',
  cpi: 'https://kostat.go.kr/board.es?mid=a10301010000&bid=245&act=view&list_no=443953',
  exports: 'https://www.customs.go.kr/kcs/na/ntt/selectNttInfo.do?bbsId=1362&mi=2891&nttSn=10200001',
  naaim: 'https://naaim.org/programs/naaim-exposure-index/',
};
// Fake page bodies shaped like the real pages (table rows, spaced Korean board text, delayed NAAIM iframe).
const PAGES = {
  [URLS.bokRate]: '<nav>통화정책 3.00 메뉴</nav><table><caption>한국은행 기준금리 추이</caption><tr><th>변경일자</th><th>기준금리</th></tr>'
    + '<tr><td>2026</td><td>08월 27일</td><td>3.00</td></tr><tr><td>2026</td><td>07월 16일</td><td>2.75</td></tr>'
    + '<tr><td>2025</td><td>05월 29일</td><td>2.50</td></tr><tr><td>2024</td><td>11월 28일</td><td>3.00</td></tr></table>',
  [URLS.bokSchedule]: '<h3>2026년 통화정책방향 결정회의 일정</h3><ul><li>08월 27일(목)</li><li>10월 22일(목)</li><li>11월 26일(목)</li></ul>',
  [URLS.cpi]: '<h2>2026년 9월 소비자물가동향</h2><span>등록일 2026-10-02</span><p>2026년 9월 소비자물가지수는 118.40으로 전월대비 0.3% 상승, 전년동월대비 2.1% 상승하였다. 생활물가지수는 전년동월대비 2.6% 상승.</p>',
  [URLS.exports]: '<title>관세청-2026년 10월 1일 ~ 10월 10일 수출입 현황 [잠정치]</title><td>등록일 2026.10.13</td><p>◇ 관세청은 13 일 , 10 월 1 일 ~10 일 기간의 수출입 현황 잠정치를 발표 했다 . '
    + '◇ 동기간 수출은 312 억 달러 로 전년동기대비 21.4% 증가 , 수입은 240 억 달러 로 3.2% 증가 (10.1. ∼ 10.10.)</p>',
  [URLS.naaim]: '<p>NAAIM Exposure Index data displayed on this page is provided with a three-month delay.</p><iframe src="https://index.naaim.org/embeddable/number"></iframe>',
};
const GOOD = {
  bokBaseRate: { found: true, value: 3, date: '2026-08-27', sourceUrl: URLS.bokRate, quote: '2026 08월 27일 3.00', nextMeeting: '2026-10-22', nextMeetingSourceUrl: URLS.bokSchedule },
  krCpi: { found: true, value: 2.1, date: '2026-10-02', period: '2026-09', sourceUrl: URLS.cpi, quote: '전년동월대비 2.1% 상승' },
  krExports: { found: true, value: 21.4, exportsBillionUsd: 31.2, date: '2026-10-13', periodStart: '2026-10-01', periodEnd: '2026-10-10', sourceUrl: URLS.exports, quote: '수출은 312억 달러' },
  naaim: { found: true, value: 82.95, date: '2026-10-08', sourceUrl: URLS.naaim, quote: 'model summary only' },
};

function pageResponse(html, { url, type = 'text/html; charset=UTF-8', status = 200, location = null, contentLength = null, onRead = null } = {}) {
  const bytes = new TextEncoder().encode(html);
  const headers = new Headers({ 'content-type': type });
  if (location) headers.set('location', location);
  if (contentLength != null) headers.set('content-length', String(contentLength));
  return { ok: status >= 200 && status < 300, status, url, headers, arrayBuffer: async () => { onRead?.(); return bytes.buffer.slice(0); } };
}
function modelResponse(candidate) {
  const payload = { status: 'completed', model: 'gpt-6-luna', output: [{ type: 'web_search_call', status: 'completed' },
    { type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(candidate) }] }] };
  return { ok: true, status: 200, json: async () => payload };
}
function harness(candidates, { pages = PAGES, redirects = {}, oversized = {} } = {}) {
  const log = [];
  const reads = [];
  const fetchImpl = async (url, init = {}) => {
    const href = String(url);
    const body = init.body ? JSON.parse(init.body) : null;
    log.push({ href, init, body });
    if (href === WORKER) {
      const id = String(body?.text?.format?.name || '').replace('aio_official_', '');
      return modelResponse(candidates[id] ?? { found: false, value: null, date: null, sourceUrl: null, quote: null });
    }
    if (href in redirects) return pageResponse('', { url: href, status: 302, location: redirects[href] });
    if (href in pages) return pageResponse(pages[href], { url: href, contentLength: oversized[href] ?? null, onRead: () => reads.push(href) });
    return pageResponse('not found', { url: href, status: 404 });
  };
  return { log, reads, fetchImpl, workerCalls: () => log.filter((row) => row.href === WORKER) };
}
const NOW = Date.parse('2026-10-13T03:00:00Z'); // 12:00 KST
const DAY = 86400000;

// 1. Request contract: the body the lane sends is admitted by the Worker budget code and nothing wider.
{
  const h = harness(GOOD);
  const { artifact } = await refreshOfficialReferences({ previous: null, now: NOW, env: ENV, fetchImpl: h.fetchImpl });
  const calls = h.workerCalls();
  check('P1734 one Worker search per due item on the first run (retired NAAIM never called)', calls.length === 3
    && !calls.some((call) => call.body?.text?.format?.name === 'aio_official_naaim'), String(calls.length));
  for (const call of calls) {
    const { body, init } = call;
    const tool = body.tools?.[0];
    let budget = null;
    try { budget = prepareOpenAiBudget(body, { AI_WEB_SEARCH_ENABLED: 'true' }); } catch (error) { budget = { error: error.message }; }
    check(`P1734 ${body.text?.format?.name} passes the Worker web_search admission contract`, budget && !budget.error, budget?.error);
    check(`P1734 ${body.text?.format?.name} uses one low/default web_search with official allowed_domains`, body.tools.length === 1 && tool.type === 'web_search'
      && tool.search_context_size === 'low' && tool.return_token_budget === 'default' && Array.isArray(tool.filters?.allowed_domains)
      && tool.filters.allowed_domains.every((domain) => ['bok.or.kr', 'mods.go.kr', 'kostat.go.kr', 'korea.kr', 'customs.go.kr', 'motir.go.kr', 'motie.go.kr', 'naaim.org'].includes(domain)));
    check(`P1734 ${body.text?.format?.name} asks for strict json_schema output with bounded tool calls`, body.text?.format?.type === 'json_schema' && body.text.format.strict === true
      && body.max_tool_calls >= 1 && body.max_tool_calls <= 2 && body.store === false && body.stream === false);
    check(`P1734 ${body.text?.format?.name} authenticates as automation without a provider key`, init.headers['X-AIO-Automation-Token'] === TOKEN && !('Authorization' in init.headers)
      && /^official-ref-[A-Za-z]+-local-fixture-1-/.test(init.headers['X-AIO-Idempotency-Key']) && init.redirect === 'error');
    if (budget && !budget.error) console.log(`[P1734] ${body.text.format.name}: max_tool_calls=${body.max_tool_calls} reservation=$${(budget.reservationMicroUsd / 1e6).toFixed(4)} per call`);
  }
  let disabled = null;
  try { prepareOpenAiBudget(calls[0].body, { AI_WEB_SEARCH_ENABLED: 'false' }); } catch (error) { disabled = error.message; }
  check('P1734 the Worker still refuses hosted search when AI_WEB_SEARCH_ENABLED is off', !!disabled);
  let wide = null;
  try { buildSharedWebSearchBody('x', { allowedDomains: ['bok.or.kr'], schemaName: 'x', schema: {}, maxToolCalls: 3 }); } catch (error) { wide = error.message; }
  check('P1734 the search builder refuses more than two tool calls', !!wide);

  // 2. Happy path: page-confirmed values only.
  const { bokBaseRate: bok, krCpi: cpi, krExports: exp, naaim } = artifact.items;
  check('P1734 BOK base rate verified from the table row with the verified next meeting', bok.status === 'verified' && bok.value === 3 && bok.unit === '%'
    && bok.effectiveDate === '2026-08-27' && bok.nextMeeting === '2026-10-22' && bok.nextMeetingStatus === 'verified'
    && bok.nextExpectedAt === '2026-10-22T02:00:00.000Z' && bok.sourceUrl === URLS.bokRate, JSON.stringify(bok));
  check('P1734 KR CPI verified with period and publish date; next release scheduled', cpi.status === 'verified' && cpi.yoy === 2.1 && cpi.period === '2026-09'
    && cpi.publishedAt === '2026-10-02' && cpi.nextExpectedAt === '2026-11-02T00:00:00.000Z', JSON.stringify(cpi));
  check('P1734 KR exports verified from spaced board text (312 억 달러 = 31.2B)', exp.status === 'verified' && exp.exportsYoyPct === 21.4 && exp.exportsBillionUsd === 31.2
    && exp.period === '2026-10-01..2026-10-10' && exp.periodLabel === '2026-10-01~10' && exp.publishedAt === '2026-10-13'
    && exp.nextExpectedAt === '2026-10-21T00:00:00.000Z', JSON.stringify(exp));
  check('P1734 retired NAAIM is fixed unavailable/retired-unverifiable with no value and no call', naaim.status === 'unavailable' && naaim.exposure === null
    && naaim.reason === 'retired-unverifiable' && naaim.sourceUrl === null && naaim.checkedAt === null, JSON.stringify(naaim));
  const forged = { ...artifact, items: { ...artifact.items, naaim: { ...naaim, status: 'verified' } } };
  check('P1734 the contract refuses a published retired item', validateOfficialReferences(forged, { now: NOW }).includes('naaim:retired-item-published'));
  check('P1734 the CPI search admits the renamed agency domain', calls.some((call) => call.body?.text?.format?.name === 'aio_official_krCpi'
    && call.body.tools[0].filters.allowed_domains.includes('mods.go.kr')));
  check('P1734 a model value the page did not confirm is never published', !JSON.stringify(artifact).includes('82.95') && !JSON.stringify(artifact).includes('model summary only'));
  check('P1734 verifiedQuote is page text (<=200 chars), not the model quote', [bok, cpi, exp].every((item) => typeof item.verifiedQuote === 'string'
    && item.verifiedQuote.length > 0 && item.verifiedQuote.length <= 200) && bok.verifiedQuote.includes('3.00') && exp.verifiedQuote.includes('21.4'));
  check('P1734 artifact satisfies the shared contract', artifact.schemaVersion === OFFICIAL_REFERENCES_SCHEMA && validateOfficialReferences(artifact, { now: NOW }).length === 0,
    validateOfficialReferences(artifact, { now: NOW }).join(','));
  check('P1734 lane ledger counts calls against the monthly cap', artifact.lane.callsThisMonth === 3 && artifact.lane.monthlyCallCap === LANE_POLICY.monthlyCallCap && artifact.lane.aiConfigured === true);

  // 3. Same KST day: nothing is due, nothing is written.
  const again = harness(GOOD);
  const second = await refreshOfficialReferences({ previous: artifact, now: NOW + 3 * 3600000, env: ENV, fetchImpl: again.fetchImpl });
  check('P1734 at most one call per item per KST day', again.log.length === 0 && second.write === false && Object.entries(second.decisions).every(([id, reason]) => reason === (id === 'naaim' ? 'retired-unverifiable' : 'checked-today')),
    JSON.stringify(second.decisions));

  // 4. Release due but the model's new value is not on the page: previous verified value kept as stale.
  const later = Date.parse('2026-10-22T03:00:00Z');
  const wrong = harness({ ...GOOD, krExports: { ...GOOD.krExports, value: 25.7, exportsBillionUsd: 40.1, periodEnd: '2026-10-20', date: '2026-10-21' } });
  const third = await refreshOfficialReferences({ previous: artifact, now: later, env: ENV, fetchImpl: wrong.fetchImpl });
  const staleExp = third.artifact.items.krExports;
  check('P1734 an unconfirmed release keeps the last verified value as stale with the cause', staleExp.status === 'stale' && staleExp.exportsYoyPct === 21.4
    && staleExp.verifiedAt === exp.verifiedAt && staleExp.lastAttemptOk === false && /not-on-page/.test(staleExp.reason || '')
    && !JSON.stringify(staleExp).includes('25.7'), JSON.stringify(staleExp));
  check('P1734 a stale artifact still satisfies the contract', validateOfficialReferences(third.artifact, { now: later }).length === 0, validateOfficialReferences(third.artifact, { now: later }).join(','));
}

// 5. Rejections before and after the page fetch.
async function single(id, candidate, options = {}) {
  const h = harness({ [id]: candidate }, options);
  const { artifact } = await refreshOfficialReferences({ previous: null, now: NOW, env: ENV, fetchImpl: h.fetchImpl });
  return { item: artifact.items[id], log: h.log };
}
{
  const offDomain = await single('bokBaseRate', { ...GOOD.bokBaseRate, sourceUrl: 'https://news.example.com/bok-rate' });
  check('P1734 a non-official source URL is rejected without fetching it', offDomain.item.reason === 'source-url-not-official' && offDomain.item.value === null
    && !offDomain.log.some((row) => row.href.includes('news.example.com')));
  const plainHttp = await single('bokBaseRate', { ...GOOD.bokBaseRate, sourceUrl: URLS.bokRate.replace('https:', 'http:') });
  check('P1734 a non-https official URL is rejected', plainHttp.item.reason === 'source-url-not-official');
  const redirected = await single('bokBaseRate', GOOD.bokBaseRate, { redirects: { [URLS.bokRate]: 'https://mirror.example/rate' } });
  check('P1734 a redirect hop off the official domain is refused before it is requested', redirected.item.reason === 'source-redirect-not-official'
    && redirected.item.value === null && !redirected.log.some((row) => row.href.includes('mirror.example')));
  check('P1734 official pages are fetched with redirect:manual', redirected.log.filter((row) => row.href !== WORKER).every((row) => row.init.redirect === 'manual'));
  const hopTarget = 'https://www.bok.or.kr/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643&r=1';
  const officialHop = await single('bokBaseRate', GOOD.bokBaseRate, { redirects: { [URLS.bokRate]: '/portal/singl/baseRate/list.do?dataSeCd=01&menuNo=200643&r=1' },
    pages: { ...PAGES, [hopTarget]: PAGES[URLS.bokRate] } });
  check('P1734 a relative redirect inside the official domain is followed and recorded as the source', officialHop.item.status === 'verified' && officialHop.item.sourceUrl === hopTarget);
  const chain = Object.fromEntries([0, 1, 2, 3].map((i) => [i ? `https://www.bok.or.kr/hop${i}` : URLS.bokRate, `https://www.bok.or.kr/hop${i + 1}`]));
  const looping = await single('bokBaseRate', GOOD.bokBaseRate, { redirects: chain });
  check('P1734 more than three redirect hops are refused', looping.item.reason === 'source-too-many-redirects' && !looping.log.some((row) => row.href.endsWith('/hop4')));
  const huge = harness({ bokBaseRate: GOOD.bokBaseRate }, { oversized: { [URLS.bokRate]: 50 * 1024 * 1024 } });
  const hugeRun = await refreshOfficialReferences({ previous: null, now: NOW, env: ENV, fetchImpl: huge.fetchImpl });
  check('P1734 a declared oversized page is refused before its body is read', hugeRun.artifact.items.bokBaseRate.reason === 'source-too-large' && !huge.reads.includes(URLS.bokRate));
  const declineUrl = 'https://www.customs.go.kr/kcs/na/ntt/selectNttInfo.do?bbsId=1362&mi=2891&nttSn=10200002';
  const declinePages = { ...PAGES, [declineUrl]: '<title>관세청-2026년 10월 1일 ~ 10월 10일 수출입 현황 [잠정치]</title><td>등록일 2026.10.13</td>'
    + '<p>◇ 관세청은 13 일 , 10 월 1 일 ~10 일 기간의 수출입 현황 잠정치를 발표 했다 . ◇ 동기간 수출은 250 억 달러 로 전년동기대비 5.2% 감소 (10.1. ∼ 10.10.)</p>' };
  const declineCandidate = { ...GOOD.krExports, exportsBillionUsd: 25, sourceUrl: declineUrl };
  const positiveDecline = await single('krExports', { ...declineCandidate, value: 5.2 }, { pages: declinePages });
  check('P1734 "5.2% 감소" never confirms +5.2', positiveDecline.item.reason === 'value-not-on-page' && positiveDecline.item.exportsYoyPct === null, positiveDecline.item.reason);
  const negativeDecline = await single('krExports', { ...declineCandidate, value: -5.2 }, { pages: declinePages });
  check('P1734 "5.2% 감소" confirms -5.2', negativeDecline.item.status === 'verified' && negativeDecline.item.exportsYoyPct === -5.2, negativeDecline.item.reason);
  const trendUrl = 'https://kostat.go.kr/board.es?mid=a10301010000&bid=245&act=view&list_no=443954';
  const trendPages = { ...PAGES, [trendUrl]: '<h2>2026년 9월 소비자물가동향</h2><span>등록일 2026-10-02</span><table>'
    + '<tr><th>2026.8</th><td>소비자물가 전년동월대비</td><td>2.1</td></tr><tr><th>2026.9</th><td>소비자물가 전년동월대비</td><td>2.9</td></tr></table>' };
  const otherMonth = await single('krCpi', { ...GOOD.krCpi, value: 2.1, sourceUrl: trendUrl }, { pages: trendPages });
  check('P1734 a trend-table value under another month is not the target month', otherMonth.item.reason === 'value-period-mismatch' && otherMonth.item.yoy === null, otherMonth.item.reason);
  const ownMonth = await single('krCpi', { ...GOOD.krCpi, value: 2.9, sourceUrl: trendUrl }, { pages: trendPages });
  check('P1734 the value under the target month column is accepted', ownMonth.item.status === 'verified' && ownMonth.item.yoy === 2.9, ownMonth.item.reason);
  const withPrevColumn = { ...PAGES, [URLS.exports]: PAGES[URLS.exports].replace('(10.1. ∼ 10.10.)</p>',
    '(10.1. ∼ 10.10.)</p><table><tr><th>전월(9.1.-10.)</th><td>수출 전년동기대비 (85.6)</td></tr></table>') };
  const prevMonthExports = await single('krExports', GOOD.krExports, { pages: withPrevColumn });
  check('P1734 exports: the summary value bound to the target month still verifies beside a previous-month column', prevMonthExports.item.status === 'verified', prevMonthExports.item.reason);
  const prevMonthValue = await single('krExports', { ...GOOD.krExports, value: 85.6 }, { pages: withPrevColumn });
  check('P1734 exports: a previous-month column value is refused for the target period', prevMonthValue.item.reason === 'value-period-mismatch', prevMonthValue.item.reason);
  const oldRow = await single('bokBaseRate', { ...GOOD.bokBaseRate, date: '2024-11-28' });
  check('P1734 an older table row is not accepted as the current base rate', oldRow.item.reason === 'newer-observation-on-page' && oldRow.item.status === 'unverified');
  const neighbourRow = await single('bokBaseRate', { ...GOOD.bokBaseRate, value: 2.75 });
  check('P1734 a rate from the neighbouring table row is not bound to the asked date', neighbourRow.item.reason === 'value-not-in-date-row' && neighbourRow.item.value === null);
  const imports = await single('krExports', { ...GOOD.krExports, value: 3.2 });
  check('P1734 import growth offered as export growth is refused by its label', imports.item.reason === 'value-label-mismatch' && imports.item.exportsYoyPct === null);
  const importAmount = await single('krExports', { ...GOOD.krExports, exportsBillionUsd: 24 });
  check('P1734 the import amount offered as the export amount is refused', importAmount.item.reason === 'amount-value-label-mismatch');
  for (const swapped of [0.3, 2.6]) {
    const cpiSwap = await single('krCpi', { ...GOOD.krCpi, value: swapped });
    check(`P1734 CPI ${swapped} (month-on-month or another index) is refused by its label`, cpiSwap.item.reason === 'value-label-mismatch' && cpiSwap.item.yoy === null, cpiSwap.item.reason);
  }
  const wrongDate = await single('krCpi', { ...GOOD.krCpi, date: '2026-10-05' });
  check('P1734 a date missing from the page is rejected', wrongDate.item.reason === 'date-not-on-page');
  const wrongPeriod = await single('krCpi', { ...GOOD.krCpi, period: '2026-08' });
  check('P1734 a period missing from the page is rejected', wrongPeriod.item.reason === 'period-not-on-page');
  const future = await single('krCpi', { ...GOOD.krCpi, date: '2026-10-30' });
  check('P1734 a future publish date is rejected', future.item.reason === 'date-in-future');
  const notFound = await single('krCpi', { found: false, value: null, date: null, period: null, sourceUrl: null, quote: null });
  check('P1734 model not-found leaves the item unavailable', notFound.item.status === 'unavailable' && notFound.item.reason === 'model-not-found');
  const badMeeting = await single('bokBaseRate', { ...GOOD.bokBaseRate, nextMeeting: '2026-10-29' });
  check('P1734 an unconfirmed next meeting is withheld while the rate stays verified', badMeeting.item.status === 'verified' && badMeeting.item.nextMeeting === null
    && badMeeting.item.nextMeetingStatus === 'unverified' && badMeeting.item.nextExpectedAt === null);
}

// 5b. v57.81: the customs board is not in any search index (robots.txt + JS POST links), so the lane resolves the
// newest preliminary post from the board list itself and hands the exact detail URL to the model.
{
  const detail = 'https://www.customs.go.kr/kcs/na/ntt/selectNttInfo.do?mi=2891&bbsId=1362&nttSn=10179143&nttSnUrl=2fbd97b6ed3711c34f4810ce485a72ce';
  const board = '<table><tr><td><a href="javascript:" data-id="10179200" data-url="aaaabbbbccccddddeeeeffff00001111" class="nttInfoBtn" title="2026년 9월 월간 수출입 현황 [확정치]">확정치</a></td></tr>'
    + '<tr><td><a href="javascript:" data-id="10179143" data-url="2fbd97b6ed3711c34f4810ce485a72ce" class="nttInfoBtn" title="2026년 10월 1일 ~ 10월 10일 수출입 현황 [잠정치]">10일</a></td></tr>'
    + '<tr><td><a href="javascript:" data-id="10178304" data-url="9714bd0f6916ae89827b90b1f37f4b19" class="nttInfoBtn" title="2026년 9월 수출입 현황 [잠정치]">9월</a></td></tr></table>';
  const pages = { ...PAGES, [CUSTOMS_PRESS_BOARD]: board, [detail]: PAGES[URLS.exports] };
  const links = customsReleaseLinks(board);
  check('v57.81 the newest [잠정치] post resolves to its GET detail URL (확정치 is skipped)', links.length === 2 && links[0].url === detail, JSON.stringify(links));
  const resolved = await single('krExports', { ...GOOD.krExports, sourceUrl: detail }, { pages });
  const exportsCall = resolved.log.find((row) => row.href === WORKER && row.body?.text?.format?.name === 'aio_official_krExports');
  const prompt = exportsCall?.body?.input?.[0]?.content || '';
  check('v57.81 the krExports prompt carries the resolved detail URL and its release title', prompt.includes(detail) && prompt.includes('10월 1일 ~ 10월 10일 수출입 현황 [잠정치]'), prompt.slice(0, 200));
  check('v57.81 krExports may search then open (2 tool calls) inside customs/MOTIE domains only', exportsCall?.body?.max_tool_calls === 2
    && JSON.stringify(exportsCall.body.tools[0].filters.allowed_domains) === JSON.stringify(['customs.go.kr', 'motir.go.kr', 'motie.go.kr']), JSON.stringify(exportsCall?.body?.tools));
  check('v57.81 the page check still decides: the resolved release verifies only from its own page text', resolved.item.status === 'verified' && resolved.item.sourceUrl === detail, resolved.item.reason);
  const noBoard = await single('krExports', GOOD.krExports);
  const plainPrompt = noBoard.log.find((row) => row.href === WORKER && row.body?.text?.format?.name === 'aio_official_krExports')?.body?.input?.[0]?.content || '';
  check('v57.81 an unreachable board falls back to the static hints without a resolved URL', !plainPrompt.includes('nttSnUrl=') && noBoard.item.status === 'verified', noBoard.item.reason);
}

// 6a. Call ledger: calls from a run whose commit was lost still count (cache-backed ledger, not the artifact).
{
  const order = [];
  const first = harness(GOOD);
  const tracked = async (url, init) => { if (String(url) === WORKER) order.push('call'); return first.fetchImpl(url, init); };
  const persisted = [];
  const run1 = await refreshOfficialReferences({ previous: null, ledger: null, now: NOW, env: ENV, fetchImpl: tracked,
    persistLedger: (value) => { order.push('persist'); persisted.push(JSON.parse(JSON.stringify(value))); } });
  check('P1734 each attempt is written to the ledger before the Worker is called', order.join(',') === 'persist,call,persist,call,persist,call'
    && persisted.at(-1).callsThisMonth === 3 && persisted.at(-1).days[run1.artifact.lane.day] === 3, order.join(','));
  const lost = harness(GOOD);
  const run2 = await refreshOfficialReferences({ previous: null, ledger: run1.ledger, now: NOW + 30 * 60000, env: ENV, fetchImpl: lost.fetchImpl });
  check('P1734 a lost data commit does not trigger a re-call 30 minutes later', lost.workerCalls().length === 0 && run2.artifact.lane.callsThisMonth === 3
    && run2.decisions.krCpi === 'checked-today', JSON.stringify(run2.decisions));
  const busyDay = { schemaVersion: 'official-ref-ledger.v1', month: '2026-10', callsThisMonth: 6, days: { [run1.artifact.lane.day]: LANE_POLICY.dailyCallCap }, items: {} };
  const capped = harness(GOOD);
  const run3 = await refreshOfficialReferences({ previous: null, ledger: busyDay, now: NOW, env: ENV, fetchImpl: capped.fetchImpl });
  check('P1734 the KST daily call cap from the ledger stops further calls', capped.workerCalls().length === 0 && run3.decisions.bokBaseRate === 'daily-call-cap');
  const bigger = { ...busyDay, callsThisMonth: 17, days: {} };
  const run4 = await refreshOfficialReferences({ previous: run1.artifact, ledger: bigger, now: NOW + 3 * 3600000, env: ENV, fetchImpl: harness(GOOD).fetchImpl });
  check('P1734 the larger of ledger and artifact counters wins', run4.artifact.lane.callsThisMonth === 17 && run4.artifact.lane.callsToday === 3);
}

// 6. Caps, missing configuration, expiry and scheduling.
{
  const seeded = await refreshOfficialReferences({ previous: null, now: NOW, env: ENV, fetchImpl: harness(GOOD).fetchImpl });
  const capped = harness(GOOD);
  const atCap = { ...seeded.artifact, lane: { ...seeded.artifact.lane, callsThisMonth: LANE_POLICY.monthlyCallCap } };
  const capRun = await refreshOfficialReferences({ previous: atCap, now: NOW + 9 * DAY, env: ENV, fetchImpl: capped.fetchImpl });
  check('P1734 the monthly lane cap stops further Worker calls', capped.workerCalls().length === 0 && Object.values(capRun.decisions).some((reason) => reason === 'monthly-call-cap'),
    JSON.stringify(capRun.decisions));
  const offline = harness(GOOD);
  const noAi = await refreshOfficialReferences({ previous: null, now: NOW, env: {}, fetchImpl: offline.fetchImpl });
  check('P1734 without the automation token nothing is fetched and nothing is invented', offline.log.length === 0
    && Object.values(noAi.artifact.items).every((item) => item.status === 'unavailable') && noAi.artifact.lane.aiConfigured === false);
  const expired = await refreshOfficialReferences({ previous: seeded.artifact, now: Date.parse('2026-10-24T03:00:00Z'), env: {}, fetchImpl: harness(GOOD).fetchImpl });
  check('P1734 a verified value past its next release (plus grace) turns stale without a call', expired.artifact.items.bokBaseRate.status === 'stale'
    && expired.artifact.items.bokBaseRate.reason === 'next-release-not-verified' && expired.artifact.items.bokBaseRate.value === 3 && expired.write === true);
  const verifiedItem = seeded.artifact.items.krCpi;
  check('P1734 schedule: not due before the next release', dueDecision('krCpi', verifiedItem, NOW + 2 * DAY).due === false);
  check('P1734 schedule: due once the release time passes', dueDecision('krCpi', verifiedItem, Date.parse('2026-11-02T05:00:00Z')).reason === 'release-due');
  const failedCpi = { ...seeded.artifact.items.krCpi, verifiedAt: null, lastAttemptOk: false, status: 'unverified' };
  check('P1734 schedule: a failed item backs off for 3 days', dueDecision('krCpi', failedCpi, NOW + 2 * DAY).due === false && dueDecision('krCpi', failedCpi, NOW + 4 * DAY).due === true);
  const monthLater = harness(GOOD);
  await refreshOfficialReferences({ previous: seeded.artifact, now: NOW + 40 * DAY, env: ENV, fetchImpl: monthLater.fetchImpl });
  check('P1734 retired NAAIM stays uncalled on later runs', !monthLater.workerCalls().some((call) => call.body?.text?.format?.name === 'aio_official_naaim'));
}

// 7. Spelling variants the verifier accepts (and the near-misses it must not).
{
  const hit = (regexps, text) => regexps.some((re) => { re.lastIndex = 0; return re.test(text); });
  const compact = (html) => pageText(html).compact;
  check('P1734 number variants: 3 matches 3.00 but not 13.00 or 3.25', hit(numberRegExps(3), compact('기준금리 3.00')) && !hit(numberRegExps(3), compact('13.00 3.25')));
  check('P1734 number variants: 29.8B matches 298 억', hit(numberRegExps(29.8, { scales: [{ factor: 10, suffix: '억' }] }), compact('수출 298 억 달러')));
  check('P1734 number variants: sign is respected', hit(numberRegExps(-1.3), compact('( △ 1.3)')) && !hit(numberRegExps(1.3), compact('( △ 1.3)')));
  check('P1734 date variants: Korean, dotted and English forms', ['2026 08월 27일', '2026.08.27', '2026-8-27', '2026년 8월 27일', 'Aug 27, 2026', '08/27/2026']
    .every((text) => hit(dateRegExps('2026-08-27'), compact(text))) && !hit(dateRegExps('2026-08-27'), compact('2026.08.270')));
}

// 8. Existing shared-analysis request is unchanged (no tools, same output bound).
{
  let sent = null;
  await requestSharedAnalysis('fixture', { env: ENV, fetchImpl: async (url, init) => { sent = JSON.parse(init.body); return modelResponse({ ok: true }); } });
  check('P1734 requestSharedAnalysis keeps its search-free 1500-token body', sent && !('tools' in sent) && sent.max_output_tokens === 1500 && sent.reasoning?.effort === 'none');
}

// 9. Workflow, lineage and producer wiring.
{
  const workflow = read('.github/workflows/refresh-data.yml');
  const laneAt = workflow.indexOf('name: Verify official web references (P1734)');
  const step = laneAt >= 0 ? workflow.slice(laneAt, workflow.indexOf('\n      - name: ', laneAt + 1)) : '';
  check('P1734 refresh-data runs the lane after the market fetch and before release promotion', laneAt > workflow.indexOf('name: Fetch market data')
    && laneAt < workflow.indexOf('name: Promote one data release revision') && laneAt < workflow.indexOf('verify-refresh-candidate.mjs --record'));
  let parsed = null;
  try { parsed = loadYaml(workflow); } catch (error) { parsed = { error: error.message }; }
  const steps = parsed?.jobs?.refresh?.steps || [];
  const byName = (name) => steps.find((entry) => entry.name === name) || {};
  const ledgerKey = byName('Prepare official-reference ledger key (P1734)');
  const restore = byName('Restore official-reference call ledger (P1734)');
  const save = byName('Save official-reference call ledger (P1734)');
  const lane = byName('Verify official web references (P1734)');
  check('P1734 refresh-data.yml parses as YAML', !parsed?.error && steps.length > 0, parsed?.error);
  check('P1734 the lane runs only when the market and Telegram fetches succeeded', /steps\.fetch-market\.outcome == 'success' && steps\.fetch-telegram\.outcome == 'success'/.test(ledgerKey.if || '')
    && /steps\.official-ref-ledger\.outcome == 'success'/.test(lane.if || ''));
  check('P1734 the call ledger is restored and saved through a pinned actions/cache outside public-data', /^actions\/cache\/restore@[0-9a-f]{40}$/.test(restore.uses || '')
    && /^actions\/cache\/save@[0-9a-f]{40}$/.test(save.uses || '') && restore.with?.path === '.cache/official-references' && save.with?.path === '.cache/official-references'
    && /^official-ref-ledger-\$\{\{ steps\.official-ref-ledger\.outputs\.month \}\}-\$\{\{ github\.run_id \}\}/.test(save.with?.key || '')
    && String(restore.with?.['restore-keys'] || '').trim() === 'official-ref-ledger-${{ steps.official-ref-ledger.outputs.month }}-'
    && steps.indexOf(restore) < steps.indexOf(lane) && steps.indexOf(lane) < steps.indexOf(save) && restore['continue-on-error'] === true && save['continue-on-error'] === true);
  check('P1734 the producer keeps its ledger in the gitignored cache, not in a committed artifact', read('scripts/refresh-web-research.mjs').includes("'../.cache/official-references/ledger.json'"));
  check('P1734 the lane step is non-blocking and authenticated by the automation token only', /continue-on-error: true/.test(step) && /AIO_AUTOMATION_TOKEN: \$\{\{ secrets\.AIO_AUTOMATION_TOKEN \}\}/.test(step)
    && /run: node scripts\/refresh-web-research\.mjs/.test(step) && !/OPENAI_API_KEY/.test(step));
  check('P1734 the commit step stages the lane artifact (candidate set == staged set)', workflow.includes('stage_if_exists public-data/official-references.json'));
  check('P1734 lineage audit registers the lane artifact', /'official-references\.json':\s*\{[^}]*timestamp: \['checkedAt'\]/.test(read('scripts/ci-data-lineage-audit.mjs')));
  const producer = read('scripts/refresh-web-research.mjs');
  check('P1734 the producer writes only official-references.json (no frozen data.json snapshot)', producer.includes("'../public-data/official-references.json'")
    && !producer.includes('public-data/data.json') && !/CHECKED_AT\s*=/.test(producer) && producer.includes('validateOfficialReferences'));
}

// 10. The published artifact, when present, satisfies the same contract.
{
  const path = `${root}public-data/official-references.json`;
  if (existsSync(path)) {
    const artifact = JSON.parse(readFileSync(path, 'utf8'));
    const problems = validateOfficialReferences(artifact);
    check('P1734 public-data/official-references.json satisfies the contract', problems.length === 0, problems.join(','));
  } else {
    console.log('[P1734] public-data/official-references.json not produced yet (first refresh-data run writes it).');
  }
}

if (failures.length) {
  console.error(`official references check failed:\n${failures.map((line) => ` - ${line}`).join('\n')}`);
  process.exit(1);
}
console.log('P1734 official references: request contract, page verification, scheduling and workflow wiring passed.');
