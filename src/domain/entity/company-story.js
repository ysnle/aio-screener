// v59.43 (owner 2026-10-28): the researched company story for the ~100 most traded listings — technology and moat →
// design → who makes it → who buys it → how the money flows in → earnings → use of cash → AI value chain → competition
// → roadmap → what to watch. Curated static JSON under public-data/company-profiles/ (schema in
// _artifacts/company-profile-pilot-20261028/SCHEMA-v2.md); this module only reads it. Every number carries a dated
// source in the file; nothing here estimates a missing value.

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

const finite = (value) => (value != null && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null);
const trimZero = (text) => text.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');

// Currencies the stories report in. A code not listed stays as written rather than being read as dollars.
const CURRENCY_WORD = Object.freeze({ USD: '달러', EUR: '유로', TWD: '대만달러', JPY: '엔', CNY: '위안', GBP: '파운드' });
export const STORY_UNITS = Object.freeze(['KRW tn', 'KRW bn', ...Object.keys(CURRENCY_WORD).flatMap((code) => [`${code} bn`, `${code} mn`])]);

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
    return eok >= 10000 ? `${sign}${trimZero((eok / 10000).toFixed(2))}조 원` : `${sign}${Math.round(eok).toLocaleString('ko-KR')}억 원`;
  }
  const word = CURRENCY_WORD[(u.match(/^[A-Z]{3}/i)?.[0] || '').toUpperCase()];
  const bn = /bn/i.test(u) ? a : /mn/i.test(u) ? a / 1000 : null;
  if (bn == null || !word) return `${v.toLocaleString('ko-KR')} ${u}`.trim();
  const eok = bn * 10; // 1 bn = 10억 of the same currency
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

/**
 * Whether the story still describes the latest report. A profile is researched on one date; once the company has
 * reported again after that date, the story is the older quarter's (cadence-relative freshness, AGENTS Freshness).
 * @returns {{ state: 'current'|'stale', researchedAt: string|null, newReport: string|null }}
 */
export function storyFreshness(profile, earnings = [], today = new Date().toISOString().slice(0, 10)) {
  const researchedAt = /^\d{4}-\d{2}-\d{2}$/.test(profile?.researchedAt || '') ? profile.researchedAt : null;
  const symbol = String(profile?.symbol || '').toUpperCase();
  const newer = (Array.isArray(earnings) ? earnings : [])
    .filter((row) => String(row?.symbol || '').toUpperCase() === symbol && /^\d{4}-\d{2}-\d{2}/.test(row?.date || ''))
    // Already reported: the calendar carries the actual figures, or the report day is over. A row dated today with no
    // actuals has not been released yet (AMZN 2026-10-29 after the close).
    .filter((row) => row.epsActual != null || row.revenueActual != null || String(row.date).slice(0, 10) < today)
    .map((row) => String(row.date).slice(0, 10))
    // On or after the research day. The calendar gives the US report date and stories are researched in KST, so a
    // report dated on the research day (MSFT/GOOGL 2026-10-28, after the close) is not in it.
    .filter((date) => researchedAt && date >= researchedAt && date <= today)
    .sort()
    .at(-1) || null;
  return { state: newer ? 'stale' : 'current', researchedAt, newReport: newer };
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
    '이 조사 이후 새 실적이 나왔으면 그 내용이 우선한다. 매매 지시 없이 조건으로 답할 것.'
  ];
  return lines.filter(Boolean).join('\n');
}
