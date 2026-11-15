// The theme block of the AI context (【테마 시나리오】), off the boot path: only the lazy AI context builder
// (src/ai/context/market-content.js) reads it, so it carries each theme's decision frame (decision-frame.js) directly —
// likelihood beside base and sample, payoff beside an ordinary day, cash, the cost of being wrong and the ground of the
// favoured side — instead of the rule table's side alone.
import { recentMoveText } from '../themes/recent-check.js';
import { signedText } from '../shared/number.js';
import { decisionFrameContext, themeDecisionFrame } from './decision-frame.js';

const pct = (value) => (value == null ? '—' : `${signedText(value, 1)}%`);
const marketWord = (theme) => (theme.market === 'KR' ? '한국' : '미국');

/**
 * Theme block for the AI: rotation, the notable combinations, and the themes a question names (or the most notable).
 * @param {object} model buildThemePlaybook() result
 * @param {object} [options]
 * @param {string} [options.query] the reader's question (names a theme)
 * @param {{value:number,date?:string}|null} [options.cash] today's short rate (the crossroads model's cash)
 */
export function renderThemePlaybookContext(model, { query = '', cash = null } = {}) {
  if (!model?.available) return '';
  const named = model.themes.filter((theme) => theme.label && query.includes(theme.label.split(/[ /·]/)[0]));
  const notable = [...model.highlights.structuralPullbacks.slice(0, 4), ...model.highlights.headwindLeaders.slice(0, 2), ...model.highlights.tailwindLaggards.slice(0, 2), ...model.rotation.gainers.slice(0, 2), ...model.rotation.losers.slice(0, 2)];
  const picked = [...new Map([...named, ...notable].map((theme) => [`${theme.market}:${theme.id}`, theme])).values()].slice(0, 10);
  // Every line names its windows and carries the last five sessions, so the AI cannot call a theme leading from the
  // month while the week broke. A withheld stage has no frame and says so.
  const side = (theme) => { const frame = themeDecisionFrame(theme, { cash }); return frame ? `판단 틀: ${decisionFrameContext(frame)}.` : `단계 보류 — ${theme.favoredWhy || '비교하지 않음'}`; };
  const line = (theme) => `- [${theme.market}] ${theme.label}: ${theme.stateLabel} (5거래일 ${pct(theme.ret5d ?? null)}, 1개월 ${pct(theme.ret1m)}${theme.ret3m != null ? `, 3개월 ${pct(theme.ret3m)}` : ''}${theme.ret6m != null ? `, 6개월 ${pct(theme.ret6m)}` : ''}${theme.above50 != null ? `, 50일선 위 ${theme.above50}%` : ''}). 성격: ${theme.tagLabels.join(', ') || '미분류'}. 매크로: ${theme.windText}. ${theme.fit} [${theme.basisText.join(', ')}]. ${side(theme)}${theme.thesis ? ` 구조 가설: ${theme.thesis}. 가설이 깨지는 신호: ${theme.breaks.join(', ')}.` : ''}`;
  const withWeek = (theme) => `${marketWord(theme)} ${theme.label}(${theme.market === 'KR' ? '3개월' : '6개월'}·1개월 기준, ${recentMoveText(theme.recent, { benchmarkName: theme.relative?.name || '지수' }) || '최근 5거래일 —'})`;
  return [`【테마 시나리오 — 모든 테마를 같은 규칙으로(${model.asOfText || `${model.asOf || '기준일 미확인'} 확정 종가`}), 단계는 6개월(한국 3개월)·1개월 수익률을 같은 기간 지수(미국 S&P 500, 한국 코스피)와 비교하고 최근 5거래일로 점검】`, `가격 기준 강약 이동(자금 유출입 자료 아님): ${model.rotation.text}`,
    model.highlights.structuralPullbacks.length ? `추세 속 조정 + 중심 시나리오에서 역풍 아님: ${model.highlights.structuralPullbacks.slice(0, 6).map((theme) => `${marketWord(theme)} ${theme.label}(${pct(theme.ret1m)})`).join(', ')}` : '',
    model.highlights.headwindLeaders.length ? `매크로 부담에도 주도: ${model.highlights.headwindLeaders.map(withWeek).join(', ')} — 업종 고유 동력(실적·구조 수요) 확인 필요` : '',
    ...picked.map(line),
    '단계가 \'추세 약화 확인 중\'이거나 최근 5거래일이 1개월 판정과 반대인 테마는 \'주도\'라고 쓰지 마라 — 5거래일 움직임을 함께 써라.',
    '레버리지·포지션 쏠림은 직접 자료가 없다 — 주장하려면 웹 출처를 붙이고, 없으면 가격 단서(낙폭·50일선 위 비율)로만 말하라. 세부 종목은 테마 상세·차트·기업·스크리너에서 사용자가 고른다.'].filter(Boolean).join('\n');
}
