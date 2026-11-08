// v59.43 (owner 2026-10-28): the researched company story for the ~100 most traded listings — technology and moat →
// design → who makes it → who buys it → how the money flows in → earnings → use of cash → AI value chain → competition
// → roadmap → what to watch. Curated static JSON under public-data/company-profiles/ (schema in
// _artifacts/company-profile-pilot-20261028/SCHEMA-v2.md); this module only reads it. Every number carries a dated
// source in the file; nothing here estimates a missing value.
import { readNumber as finite } from '../shared/number.js';
import { isIsoDay, hasLeadingIsoDay } from '../shared/session-date.js';
import { debateContextLines } from './company-debate.js';

export const AI_LAYERS = Object.freeze([
  ['power-energy', '전력·에너지'], ['cooling-electrical', '냉각·전기 설비'], ['data-center-real-estate', '데이터센터 부동산'],
  ['semicap-foundry', '장비·파운드리'], ['memory', '메모리'], ['chips-compute', '연산 칩'], ['networking', '네트워크'],
  ['cloud-infrastructure', '클라우드'], ['models-platforms', '모델·플랫폼'], ['software-applications', '소프트웨어·앱'],
  ['devices', '기기'], ['ai-adopter', 'AI를 쓰는 기업'], ['ai-exposed', 'AI 영향권'], ['limited', 'AI 관련 적음']
]);
const LAYER_NAME = Object.freeze(Object.fromEntries(AI_LAYERS));
export const layerLabel = (layer) => LAYER_NAME[layer] || null;

export const POSITION_LABEL = Object.freeze({ leader: '선두', challenger: '도전자', niche: '틈새', follower: '추격' });
export const CASH_USE_LABEL = Object.freeze({ 'R&D': '연구개발', capex: '설비 투자', acquisitions: '인수', buybacks: '자사주 매입', dividends: '배당', 'debt repayment': '부채 상환', 'customer financing': '고객 금융·투자', other: '기타' });

const trimZero = (text) => text.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');

// Currencies the stories report in. A code not listed stays as written rather than being read as dollars.
const CURRENCY_WORD = Object.freeze({ USD: '달러', EUR: '유로', TWD: '대만달러', JPY: '엔', CNY: '위안', GBP: '파운드' });
export const STORY_UNITS = Object.freeze(['KRW tn', 'KRW bn', ...Object.keys(CURRENCY_WORD).flatMap((code) => [`${code} bn`, `${code} mn`])]);

// 1억 = 10,000만; a figure that rounds to 0만 keeps no minus sign.
const manText = (sign, eok, word) => { const man = Math.round(eok * 10000); return `${man ? sign : ''}${man.toLocaleString('ko-KR')}만 ${word}`; };

/** A reported amount in the reader's units: USD bn/mn → 억·조 달러 (EUR·TWD… likewise), KRW tn/bn → 조·억 원. Unknown units stay as written. */
export function moneyText(value, unit) {
  const v = finite(value);
  if (v == null) return null;
  const u = String(unit || '');
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (/KRW/i.test(u)) {
    const eok = /tn/i.test(u) ? a * 10000 : /bn/i.test(u) ? a * 10 : null; // 1조 = 10,000억, 1 bn KRW = 10억
    if (eok == null) return `${v.toLocaleString('ko-KR')} ${u}`;
    if (eok > 0 && eok < 1) return manText(sign, eok, '원');
    return eok >= 10000 ? `${sign}${trimZero((eok / 10000).toFixed(2))}조 원` : `${sign}${Math.round(eok).toLocaleString('ko-KR')}억 원`;
  }
  const word = CURRENCY_WORD[(u.match(/^[A-Z]{3}/i)?.[0] || '').toUpperCase()];
  const bn = /bn/i.test(u) ? a : /mn/i.test(u) ? a / 1000 : null;
  if (bn == null || !word) return `${v.toLocaleString('ko-KR')} ${u}`.trim();
  const eok = bn * 10; // 1 bn = 10억 of the same currency
  // v59.45 (pipeline review P25-STORY-03): under 1억 the 억 figure rounded to "0억 달러" (1 USD mn is 100만 달러).
  if (eok > 0 && eok < 1) return manText(sign, eok, word);
  return eok >= 10000 ? `${sign}${trimZero((eok / 10000).toFixed(2))}조 ${word}`
    : eok >= 100 ? `${sign}${Math.round(eok).toLocaleString('ko-KR')}억 ${word}` : `${sign}${trimZero(eok.toFixed(1))}억 ${word}`;
}

/** The amount in one comparable scale (bn of the stated currency) for bar and share widths. */
export function amountScale(value, unit) {
  const v = finite(value);
  if (v == null) return null;
  const u = String(unit || '');
  return /tn/i.test(u) ? v * 1000 : /mn/i.test(u) ? v / 1000 : v;
}

export const pctText = (value) => { const v = finite(value); return v == null ? null : `${trimZero(v.toFixed(1))}%`; };

/** The last day of the period the story's `earnings` describe: the explicit `periodEnd`, else the end day in the
 * period text ('FY2026 (ended 2026-01-25)'). Null when neither says it ('Q3 2026 (2026-07~09, 3개월)'). */
export function storyPeriodEnd(profile) {
  const e = profile?.earnings || {};
  if (isIsoDay(String(e.periodEnd || ''))) return e.periodEnd;
  // The day after 'ended' or a range's '~' is the period's end; a later date in the text is a filing or report day
  // ('FY2026 (ended 2026-06-30; 10-K filed 2026-08-31)').
  const text = String(e.period || '');
  return text.match(/(?:\bended\b|~)\s*(20\d\d-\d\d-\d\d)/i)?.[1] || text.match(/20\d\d-\d\d-\d\d/)?.[0] || null;
}

const DAY_MS = 86400000;
/**
 * Whether the story still describes the latest report. A profile is researched on one date; once the company has
 * reported again after that date, the story is the older quarter's (cadence-relative freshness, AGENTS Freshness).
 * v59.45 (pipeline review P25-STORY-01): no report found is not proof of current — without a research date or with no
 * calendar rows at all (not loaded / failed) the state is 'unknown', so a consumer cannot read it as checked.
 * The earnings calendar holds the coming week only, so it cannot see a report one to three weeks after the research day.
 * Three records count, each a fact that
 * a report is out: a calendar row with actuals or a past date, an earnings brief read from the company's own filing
 * (event-briefs, about a quarter), and an SEC quarter that ends after the story's own period (`quarters`, the
 * sec-fiscal-history string for this symbol) — the last one also catches a story whose numbers were already a fiscal
 * year old when it was written.
 * @returns {{ state: 'current'|'stale'|'unknown', researchedAt: string|null, newReport: string|null, newQuarterEnd: string|null }}
 */
export function storyFreshness(profile, earnings = [], today = new Date().toISOString().slice(0, 10), { briefs = [], quarters = '' } = {}) {
  const researchedAt = isIsoDay(profile?.researchedAt || '') ? profile.researchedAt : null;
  const symbol = String(profile?.symbol || '').toUpperCase();
  const calendar = Array.isArray(earnings) ? earnings : [];
  const filed = (Array.isArray(briefs) ? briefs : []).filter((b) => b?.kind === 'earnings' && String(b?.symbol || '').toUpperCase() === symbol && hasLeadingIsoDay(b?.eventDate || ''));
  const periodEnd = storyPeriodEnd(profile);
  // A quarter whose end is more than two weeks past the story's period (fiscal calendars end a few days apart).
  const newQuarterEnd = periodEnd ? String(quarters || '').split(';').map((part) => part.split(':')[0]).filter((end) => isIsoDay(end)
    && Date.parse(end) - Date.parse(periodEnd) > 15 * DAY_MS && end <= today).sort().at(-1) || null : null;
  if (!researchedAt || (!calendar.length && !filed.length && !(periodEnd && String(quarters || '').trim()))) return { state: 'unknown', researchedAt, newReport: null, newQuarterEnd: null };
  const dates = [
    ...calendar.filter((row) => String(row?.symbol || '').toUpperCase() === symbol && hasLeadingIsoDay(row?.date || ''))
      // Already reported: the calendar carries the actual figures, or the report day is over. A row dated today with no
      // actuals has not been released yet (AMZN 2026-10-29 after the close).
      .filter((row) => row.epsActual != null || row.revenueActual != null || String(row.date).slice(0, 10) < today)
      .map((row) => String(row.date).slice(0, 10)),
    ...filed.map((b) => String(b.eventDate).slice(0, 10))
  ];
  const newer = dates
    // On or after the research day. The calendar gives the US report date and stories are researched in KST, so a
    // report dated on the research day (MSFT/GOOGL 2026-10-28, after the close) is not in it.
    .filter((date) => researchedAt && date >= researchedAt && date <= today)
    .sort()
    .at(-1) || null;
  return { state: newer || newQuarterEnd ? 'stale' : 'current', researchedAt, newReport: newer, newQuarterEnd };
}

/** True when the file is a usable story for this symbol (shape checked by scripts/ci-company-profile-contract-check.mjs). */
export function isCompanyStory(profile, symbol) {
  return !!profile && typeof profile === 'object' && String(profile.symbol || '').toUpperCase() === String(symbol || '').toUpperCase()
    && typeof profile.oneLine === 'string' && profile.oneLine.trim() !== '' && Array.isArray(profile.sources) && profile.sources.length > 0;
}

/** The story as AI context (src/ai/context/market-content.js): the flow in order, with its research date and basis. */
export function companyStoryContext(story) {
  if (!story?.symbol) return '';
  const e = story.earnings || {}, ai = story.aiChain || {}, st = story.strategy || {}, w = story.watch || {};
  const lines = [
    `${story.symbol} 기업 이해(AIO 조사 ${story.researchedAt || '날짜 미상'}, ${e.period || '기간 미상'} 실적 기준, 공시·IR·실적발표 출처):`,
    story.oneLine,
    story.moat?.text ? `기술·해자: ${story.moat.text}` : null,
    (story.moneyFlow?.steps || []).length ? `돈의 흐름: ${story.moneyFlow.steps.map((h) => `${h.from}→${h.to}(${h.what})`).join(' / ')}` : null,
    e.revenue ? `실적: 매출 ${moneyText(e.revenue.value, e.revenue.unit)}${e.revenue.yoy != null ? `(전년 대비 ${e.revenue.yoy}%)` : ''}, 영업이익률 ${pctText(e.operatingMargin) || '미확인'}. 사업부: ${(e.segments || []).map((s) => `${s.name} ${moneyText(s.revenue, s.unit) || '미확인'}`).join(', ')}` : null,
    ai.layer ? `AI 밸류체인: ${layerLabel(ai.layer) || ai.layer}. ${ai.position || ''}` : null,
    (story.competition?.arenas || []).length ? `경쟁: ${story.competition.arenas.map((a) => `${a.arena}(${POSITION_LABEL[a.position] || a.position || '위치 미상'}; ${(a.rivals || []).join(', ')})`).join(' / ')}` : null,
    (st.roadmap || []).length ? `로드맵: ${st.roadmap.map((m) => `${m.when} ${m.what}`).join(' / ')}` : null,
    (story.guidance?.latest || []).length ? `회사 가이던스: ${story.guidance.latest.map((g) => `${g.period} ${g.metric} ${g.value}(${g.givenOn || '날짜 미상'})`).join(' / ')}` : null,
    (w.confirms || []).length ? `맞아가는 신호: ${w.confirms.join(' / ')}` : null,
    (w.breaks || []).length ? `어긋나는 신호: ${w.breaks.join(' / ')}` : null,
    // v59.74: the issue the stock turns on, both readings, and the structures under the numbers.
    ...debateContextLines(story),
    '이 조사 이후 새 실적이 나왔으면 그 내용이 우선한다. 매매 지시 없이 조건으로 답할 것.'
  ];
  return lines.filter(Boolean).join('\n');
}
