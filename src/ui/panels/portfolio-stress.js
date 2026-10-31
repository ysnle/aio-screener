// Expertise review 2026-10-19 (redesign): the stress panel's HTML. Every figure comes from the book's own weekly
// regression (src/domain/portfolio/stress-sensitivity.js) or, for the KOSPI rows, from the index's recorded worst moves
// (kr-stress.js). The legacy shell (js/aio-workspace.js _aioRenderPortfolioStress) only places the string.
import { estimateBookSensitivities, scenarioImpact, krwTranslationPct, bookWeights, STRESS_MIN_WEEKS } from '../../domain/portfolio/stress-sensitivity.js';
import { krIndexStressRows } from '../../domain/portfolio/kr-stress.js';
import { signedText } from '../../domain/shared/number.js';

const esc = (text) => String(text).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const signed = (value, digits = 1) => signedText(value, digits, '%');
const md = (date) => (date ? `${date.slice(0, 4)}.${Number(date.slice(5, 7))}.${Number(date.slice(8, 10))}` : '');
const toneOf = (value) => (value < -15 ? 'is-severe' : value < 0 ? 'is-down' : 'is-up');

function line(name, impact, note = '') {
  const band = `95% 범위 ${signed(impact.low)} ~ ${signed(impact.high)}${impact.distinct ? '' : ', 0과 구분 안 됨'}`;
  return `<div class="pf-stress-row"><span class="pf-stress-name">${esc(name)}</span>`
    + `<span class="pf-stress-value ${toneOf(impact.mid)}">${signed(impact.mid)} <span class="pf-stress-band">(${esc(band)}${note})</span></span></div>`;
}

/**
 * @param {{ base: {rows: Array<{sym:string,value:number}>, currency?: string|null}, historyMap: object, commonDates: string[], history: object[], now?: number }} input
 */
export function portfolioStressHtml({ base, historyMap = {}, commonDates = [], history = [], now = Date.now() } = {}) {
  const rows = Array.isArray(base?.rows) ? base.rows : [];
  const total = rows.reduce((sum, row) => sum + (row.value || 0), 0);
  if (!(total > 0)) return '';
  // v59.45 (PASS23): lots of one ticker summed (the last lot used to overwrite the rest); the head says the history is
  // today's holdings replayed over past weeks, not the account's own record.
  const weights = Object.fromEntries(bookWeights(rows).map((item) => [item.symbol, item.w]));
  const head = '<div class="pf-stress-head">스트레스 시나리오 <span class="pf-stress-sub">— 주식 부분, 지금 보유 비중을 과거 주간 가격에 적용해 추정</span></div>';
  const est = estimateBookSensitivities({ historyMap, commonDates, weights, history });
  const parts = [head];
  if (!est.available) {
    parts.push(`<div class="pf-stress-note">${est.reason === 'weeks-insufficient'
      ? `보유 종목의 가격 기록이 함께 겹치는 주가 ${est.weeks}주라 민감도를 추정하지 않습니다(${STRESS_MIN_WEEKS}주 이상 필요).`
      : '가격 기록이 있는 종목이 계좌의 80%에 못 미쳐 민감도를 추정하지 않습니다.'}</div>`);
  } else {
    const f = est.fits;
    const scenarios = [
      ['보유 시장 지수 -20%', f.equity, -20],
      ['2008 금융위기 수준 (지수 -50%)', f.equity, -50],
      ['미 10년물 금리 +100bp', f.rate, 100],
      ['WTI 유가 +30%', f.oil, 30]
    ];
    for (const [name, fit, shock] of scenarios) {
      const impact = scenarioImpact(fit, shock);
      if (impact) parts.push(line(name, impact));
    }
    const krw = scenarioImpact(f.krw, 10);
    if (krw) {
      const translation = krwTranslationPct({ weights, baseCurrency: base?.currency, shockPct: 10 });
      const shifted = translation == null ? krw : { ...krw, mid: krw.mid + translation, low: krw.low + translation, high: krw.high + translation, distinct: krw.low + translation > 0 || krw.high + translation < 0 };
      parts.push(line('원/달러 +10% (원화 약세)', shifted, translation ? `, 환산 효과 ${signed(translation)} 포함` : ''));
    }
    const r2 = (fit) => (fit?.r2 == null ? '—' : fit.r2.toFixed(2));
    parts.push(`<div class="pf-stress-note pf-stress-method">${md(est.from)}~${md(est.to)} ${est.weeks}주의 주간 수익률을 요인 하나씩에 회귀한 기울기(지수 베타 ${f.equity ? f.equity.beta.toFixed(2) : '—'}, 설명력 R² 지수 ${r2(f.equity)}, 금리 ${r2(f.rate)}, 유가 ${r2(f.oil)}, 환율 ${r2(f.krw)})를 충격 크기만큼 키운 값입니다. 다른 요인이 함께 움직인 효과가 섞여 있고, 큰 충격은 과거 주간 관계를 넘어서는 외삽이라 예측이 아닙니다. 보유 시장 지수는 미국 종목 S&amp;P 500, 한국 종목 코스피를 비중대로 섞었습니다.</div>`);
  }
  const kr = rows.some((row) => /\.(KS|KQ)$/i.test(row.sym)) ? krIndexStressRows(history, { now }) : [];
  if (kr.length) {
    const krShare = rows.filter((row) => /\.(KS|KQ)$/i.test(row.sym)).reduce((sum, row) => sum + row.value, 0) / total;
    for (const row of kr) {
      const value = row.shock * krShare * 100;
      parts.push(`<div class="pf-stress-row"><span class="pf-stress-name">${esc(row.name)}</span><span class="pf-stress-value ${toneOf(value)}">${signed(value)}</span></div>`);
    }
    parts.push(`<div class="pf-stress-note">코스피 행: ${esc(kr[0].basis)} — 한국 보유분(${(krShare * 100).toFixed(0)}%)에만 적용.</div>`);
  }
  return parts.join('');
}
