import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const ref = 'd36bb256ddf60468d6c7a134628053c5796be6be';
const read = path => execFileSync('git', ['show', `${ref}:${path}`], { encoding: 'utf8', maxBuffer: 5e6 });
const section = (src, start, end) => { const a = src.indexOf(start), b = src.indexOf(end, a + start.length); assert(a >= 0 && b > a); return src.slice(a, b); };
const escHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
process.env.TZ = 'Asia/Seoul';
const pages = read('js/aio-pages.js');
const calendarCode = section(pages, 'async function loadEarningsCalendar()', '// The SEC watchlist grid');
const RealDate = Date;
const observations = [];
for (const hour of [8, 9]) {
  const now = RealDate.parse(`2026-10-19T${String(hour).padStart(2, '0')}:00:00+09:00`);
  class Clock extends RealDate { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } }
  const body = { innerHTML: '' }, status = {};
  const ctx = { Date: Clock, window: {}, escHtml, document: { getElementById(id) { return id === 'earnings-calendar-body' ? body : status; } }, _aioLog() {}, _fetchEarningsCalendarSnapshot: async () => ({ earnings: [{ date: '2026-10-19', hour: 'bmo', symbol: 'MONDAY_FIXTURE' }, { date: '2026-10-23', hour: 'amc', symbol: 'FRIDAY_FIXTURE' }], ipos: [], unconfirmed: [], weekStart: '2026-10-19', weekEnd: '2026-10-23' }) };
  vm.createContext(ctx); vm.runInContext(calendarCode, ctx); await ctx.loadEarningsCalendar();
  // Column delimiter uses the actual latest class-independent semantic day marker.
  const columns = body.innerHTML.split(/<div class="aio-earn-day[^\"]*">/).slice(1);
  assert.equal(columns.length, 5);
  const headers = columns.map(c => c.match(/class="pgl-ec-dayhd[^\"]*">([^<]+)/)?.[1]);
  const mondayColumn = columns.findIndex(c => c.includes('MONDAY_FIXTURE'));
  const fridayColumn = columns.findIndex(c => c.includes('FRIDAY_FIXTURE'));
  if (hour === 8) { assert.equal(mondayColumn, 1); assert.equal(fridayColumn, -1); assert(headers[0].startsWith('월 19')); assert(headers[1].startsWith('화 20')); }
  else { assert.equal(mondayColumn, 0); assert.equal(fridayColumn, 4); }
  observations.push({ case: 'LD-02', hourKst: hour, headers, mondayColumn, fridayColumn, status: status.textContent });
}
const kr = read('js/aio-kr-data.js');
const detailCode = section(kr, 'function showKrThemeDetail(themeId)', '// v29.4: Naver Finance');
const panel = { style: {}, scrollIntoView() {} }, content = { innerHTML: '' };
const ctx = { window: { _liveData: {}, AIO_KR_THEME_LABELS: { defense: 'K-방산/항공우주' } }, document: { getElementById(id) { return id === 'kr-theme-detail-panel' ? panel : id === 'kr-theme-detail-content' ? content : null; } }, refreshKrThemeRuntimeWeights() {}, KR_THEME_MAP: { defense: [{ code: '012450', w: 100 }] }, KR_STOCK_DB: { '012450': { name: '한화에어로스페이스' } }, krTickerToYahoo: code => code + '.KS', KR_THEME_CATALYSTS: {}, _krCatalystReferenceText: () => '', escHtml };
vm.createContext(ctx); vm.runInContext(detailCode, ctx); ctx.showKrThemeDetail('defense');
assert(content.innerHTML.includes('+0.00%'));
assert(content.innerHTML.includes('하락 종목(0개)이 상승 종목(0개)보다 많습니다'));
assert(content.innerHTML.includes('시세 미수신'));
observations.push({ case: 'LD-01', quotes: 0, zeroReturn: true, noQuotesLabel: true, falseDeclinerClaim: true });
const result = { ref, evidence: 'isolated real-source VM; stub DOM and snapshot; no network/browser', observations };
writeFileSync(fileURLToPath(new URL('./legacy-latest-repro.json', import.meta.url)), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
