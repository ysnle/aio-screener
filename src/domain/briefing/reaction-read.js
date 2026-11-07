// v59.69 (owner 2026-11-03, "좋은 실적에도 왜 떨어지지?"): why a stock moved the way it did after its report, read as a
// short ladder of checks a reader would run — did the numbers beat, what did guidance say, how far had the price run
// into the report, did the market or its group move the same way, and what the reports name (spending, execution,
// management). Each rung is measured from the brief, the closes or the reported reasons; the conclusion is the first
// rung that explains the move, and a move nothing explains says so instead of guessing.
import { readNumber } from '../shared/number.js';
import { closeMoveBetween } from '../market/close-series.js';
import { figureSurprise } from './event-briefs.js';
import { readRowNumber } from '../../data/contracts/screener.js';

const MOVE_MIN = 3; // % — a smaller one-day reaction is not read as a verdict on the quarter
const RUN_UP_MIN = 25; // % over the three months into the report — expectations already in the price
const WITH_MARKET = 2; // %p — a move within this of its benchmark, and mostly matched by it, is the market's or the group's

const GUIDE_WEAK = /(?:전망|가이던스|guidance|outlook)[^.]{0,40}(?:못 미|밑돌|하회|하향|낮|신중|보수|부진|우려|실망)/i;
// v59.70 step 4: "매출총이익률 전망은 시장 기대보다 낮아" (AAPL) is an outlook below the estimate, not only 신중.
const GUIDE_BELOW = /(?:전망|가이던스|guidance|outlook)[^.]{0,40}(?:못 미|밑돌|하회|(?:기대|예상|컨센서스)(?:보다|에)?\s*(?:낮|못))/i;
const GUIDE_STRONG = /(?:전망|가이던스|guidance|outlook)[^.]{0,40}(?:상향|높|웃돌|상회|올려|올렸)/i;
const REASON_CLASSES = Object.freeze([
  { id: 'spend', label: '투자·비용 부담', re: /(?:설비투자|투자 확대|대규모 투자|지출|비용|현금흐름|마진|총마진|이익률)[^.]{0,30}(?:부담|압박|우려|악화|줄|낮|적자|하락|회수)/ },
  { id: 'execution', label: '실행·공급 차질', re: /(?:생산|공급|정비|가동|출하|지연|차질|중단|제약)[^.]{0,30}(?:차질|지연|중단|줄|감소|제약|우려|부진)|(?:차질|지연|중단)/ },
  { id: 'management', label: '경영진 신뢰', re: /(?:경영진|\bCEO\b|최고경영자|최고재무|\bCFO\b)[^.]{0,40}(?:의문|회의|신뢰|불확실|사임|교체|해명|잠재우지 못|설득)/ },
  { id: 'priced', label: '기대 선반영', re: /(?:높은 기대|기대가 컸|눈높이|선반영|이미 반영|기대치가 높|밸류에이션 부담)/ }
]);

// v59.70: the same comparison the briefing line prints (figureSurprise) — not the stored percentage on its own.
const firstSurprise = (figures, metric, provisional) => {
  for (const figure of figures || []) {
    if (figure?.metric !== metric) continue;
    const read = figureSurprise(figure, figures, { provisional });
    if (Number.isFinite(read?.pct)) return read.pct;
  }
  return null;
};

/** Beat, miss or in line on revenue and EPS, on the basis the briefing line prints. */
export function resultVerdict(figures = [], { provisional = false } = {}) {
  const revenuePct = firstSurprise(figures, 'revenue', provisional);
  const epsPct = firstSurprise(figures, 'eps_diluted', provisional);
  const side = (pct) => (pct == null ? null : pct >= 1 ? 'beat' : pct <= -1 ? 'miss' : 'inline');
  return { revenue: side(revenuePct), eps: side(epsPct), revenuePct, epsPct };
}

/**
 * Raised, weak or none: the release's own guidance rows first, then what the reports said about the outlook. A kept
 * outlook is not weak on its own; `guidanceLabel` names which weak it was — the company cut its own range, the reports
 * set it below the estimate, or they only called it cautious.
 */
export function guidanceTone(brief) {
  const own = (brief?.guidance || []).map((row) => `${row.label || ''} ${row.text || ''}`).join(' ');
  if (/하향|낮춰|낮췄|\blowered\b|\bcut\b/i.test(own)) return 'weak';
  const reported = (brief?.reasons?.points || []).map((point) => point.text).join(' ');
  if (GUIDE_WEAK.test(reported)) return 'weak';
  if (/상향|높여|높였|\braised\b/i.test(own) || GUIDE_STRONG.test(reported)) return 'raised';
  return own ? 'given' : null;
}

export function guidanceLabel(brief) {
  const tone = guidanceTone(brief);
  if (tone === 'raised') return '가이던스 상향';
  if (tone !== 'weak') return null;
  const own = (brief?.guidance || []).map((row) => `${row.label || ''} ${row.text || ''}`).join(' ');
  if (/하향|낮춰|낮췄|\blowered\b|\bcut\b/i.test(own)) return '가이던스 하향';
  return GUIDE_BELOW.test((brief?.reasons?.points || []).map((point) => point.text).join(' ')) ? '가이던스 하회' : '전망 신중';
}

/**
 * v59.70 (refactor step 4, 종목 "발표 전 → 발표 → 반응"): the four cells of a report — the consensus it was measured
 * against, what was reported (with the same comparison the briefing line prints), what it said about next, and how
 * the price took it. Each cell is null when the brief has nothing for it; the whole read is null without a comparison
 * or a reaction (an FOMC brief, a filing not yet summarised).
 */
export function earningsCells(brief) {
  if (brief?.kind !== 'earnings') return null;
  const figures = brief.figures || [];
  const provisional = brief.status === 'provisional';
  const pick = (metric) => {
    for (const figure of figures) {
      if (figure?.metric !== metric) continue;
      const read = figureSurprise(figure, figures, { provisional });
      if (read) return { figure, read };
    }
    return null;
  };
  const revenue = pick('revenue');
  const eps = pick('eps_diluted');
  const compared = [revenue && { metric: 'revenue', estimate: Number(revenue.figure.estimate.value), value: revenue.figure.value, pct: revenue.read.pct, note: revenue.read.note },
    eps && { metric: 'eps', estimate: Number(eps.figure.estimate.value), value: eps.figure.value, pct: eps.read.pct, note: eps.read.note }].filter(Boolean);
  const reaction = brief.reaction && Number.isFinite(readNumber(brief.reaction.firstPct))
    ? { firstPct: readNumber(brief.reaction.firstPct), firstDate: brief.reaction.firstDate || null, sessions: brief.reaction.sessions || 1, latestPct: readNumber(brief.reaction.latestPct) }
    : null;
  if (!compared.length && !reaction) return null;
  const outlook = guidanceLabel(brief) || ((brief.guidance || []).length ? '전망 제시' : null);
  return { compared, outlook, reaction };
}

// The group benchmark is the semiconductor ETF only for the chip layers; power, software, real estate and the rest read
// against the S&P 500, since SMH holds none of them.
const SEMI_LAYERS = Object.freeze(['chips-compute', 'semicap-foundry', 'memory']);

/** Close-to-close move of an index field from the report's base close to the first reaction session's own close. */
function benchMove(history, field, from, to) {
  return closeMoveBetween(history, field, from, to, { exactTo: true })?.pct ?? null;
}

/**
 * The reading for one earnings brief. `row` is the stock's screener row (ret3m at its factor session) and `history` the
 * shared close history (spx, smh). Returns null for a move too small to read.
 */
export function reactionRead(brief, { row = null, history = [] } = {}) {
  const reaction = brief?.reaction;
  const move = readNumber(reaction?.firstPct);
  if (!reaction || move == null || Math.abs(move) < MOVE_MIN) return null;
  const down = move < 0;
  const result = resultVerdict(brief.figures, { provisional: brief.status === 'provisional' });
  const guide = guidanceTone(brief);
  const reasons = (brief.reasons?.points || []).map((point) => point.text).join(' ');
  // The run-up into the report: the 3-month return at the factor session with the reaction since the report taken out.
  const ret3m = row ? readRowNumber(row, 'ret3m') : null, since = readNumber(reaction.latestPct);
  const sameSession = row?.factorSessionDate === reaction.latestDate && reaction.latestDate && ret3m != null && since != null;
  const runUp = sameSession ? ((1 + ret3m / 100) / (1 + since / 100) - 1) * 100 : null;
  const semi = SEMI_LAYERS.includes(brief.layer);
  const benchField = semi ? 'smh' : 'spx';
  const bench = benchMove(history, benchField, reaction.baseDate, reaction.firstDate);
  const benchName = semi ? '반도체(SMH)' : 'S&P 500';

  // Mixed (one beat, one miss) is neither: the conclusion then comes from guidance or the reports, as INTC's +30% EPS
  // beat against a 1.7% revenue miss did (the outlook was what fell short).
  const sides = [result.revenue, result.eps];
  const goodNumbers = sides.includes('beat') && !sides.includes('miss');
  const badNumbers = sides.includes('miss') && !sides.includes('beat');
  const tags = REASON_CLASSES.filter((cls) => cls.re.test(reasons)).map((cls) => cls.id);
  const pctText = (value, digits = 1) => `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`;
  // A surprise beyond ±100% (an estimate near zero) prints as the word, not a four-digit percentage.
  const side = (word, pct) => `${word} ${pct == null || Math.abs(pct) > 100 ? ({ beat: '상회', miss: '하회', inline: '부합' })[result[word === '매출' ? 'revenue' : 'eps']] || '' : pctText(pct)}`.trim();
  // The evidence strip: short facts in the order a reader weighs them; a fact with no data is left out.
  const steps = [
    result.revenue || result.eps ? { id: 'numbers', value: [result.revenue && side('매출', result.revenuePct), result.eps && side('EPS', result.epsPct)].filter(Boolean).join(' · '), hit: down ? badNumbers : goodNumbers } : null,
    guide && guide !== 'given' ? { id: 'guidance', value: guidanceLabel(brief), hit: down ? guide === 'weak' : guide === 'raised' } : null,
    runUp == null ? null : { id: 'run-up', value: `발표 전 3개월 ${pctText(runUp, 0)}`, hit: down && runUp >= RUN_UP_MIN },
    bench == null ? null : { id: 'market', value: `${benchName} ${pctText(bench)}`,
      hit: Math.sign(bench) === Math.sign(move) && Math.abs(move - bench) <= WITH_MARKET && Math.abs(bench) >= 0.6 * Math.abs(move) }
  ].filter(Boolean);

  const pick = (id) => steps.find((step) => step.id === id && step.hit) || (down && tags.includes(id) ? { id } : null);
  // The report's own cause comes first; a market or group move the same size is the reading only when the report
  // explains nothing (and stays in the strip either way).
  let kind;
  if (down) {
    kind = pick('numbers') ? 'missed' : pick('guidance') ? 'guidance'
      : pick('spend') ? 'spend' : pick('execution') ? 'execution' : pick('management') ? 'management'
        : pick('market') ? 'with-market'
          : (pick('run-up') || (goodNumbers && tags.includes('priced'))) ? 'priced-in'
            : goodNumbers ? 'beat-fell' : 'unexplained';
  } else kind = pick('numbers') ? 'as-reported' : pick('guidance') ? 'guidance-up' : pick('market') ? 'with-market' : badNumbers ? 'relief' : 'unexplained';
  // The line is the report's own words when one names the cause, never a sentence written to explain it.
  const said = (brief.reasons?.points || [])[0]?.text || '';
  const line = ['missed', 'guidance', 'spend', 'execution', 'management', 'priced-in', 'as-reported', 'guidance-up', 'relief'].includes(kind) ? said : '';
  return { move, down, kind, title: KIND_TITLE[kind], line, steps, runUp, bench };
}

const KIND_TITLE = Object.freeze({
  missed: '예상 하회', guidance: '가이던스 실망', spend: '비용·투자 부담', execution: '실행 차질', management: '경영진 신뢰 약화',
  'with-market': '시장 동반', 'priced-in': '선반영', 'beat-fell': '호실적에도 하락', unexplained: '이유 불명확',
  'as-reported': '호실적 반영', 'guidance-up': '가이던스 상향 반영', relief: '우려 대비 선방'
});
