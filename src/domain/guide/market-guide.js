// Owner 2026-10-19 ("시나리오·대응 가이드와 학습"): ONE model every surface reads to explain the market — the screens, the AI
// chat, the server narrative and the scenario-state producer. It composes the existing engines; it adds no condition of
// its own:
//   situation — the six-axis verdict, the present structure (scenario-outlook), the macro driver (macro-crossroads) and
//               the next official release, in plain words
//   paths     — the live branches (core condition met) and the watch branches (some conditions, core not met), each
//               with the three evidence lines the crossroads already carries (count · market pricing · past frequency)
//   direction — across the live branches, how many favour each of the four shared choices and how many name it costly;
//               the choice favoured somewhere and costly nowhere is the one that costs least if the reading is wrong.
//               A count of branch texts, never a probability (R697), and never an instruction about the reader's own
//               holdings (R698).
//   stance    — what to lean toward and what to avoid, derived from the direction, the lead's exposures and the traps
//   lessons   — the concept layer (lessons.js) entries today's data touches, each linked to the principles library
import { pastEvidence } from '../scenarios/analogs.js';
import { CHOICES } from '../market/macro-crossroads.js';
import { selectLessons, LESSON_KINDS } from './lessons.js';
import { hasFinalConsonant } from '../content/korean-particle.js';

export const MARKET_GUIDE_VERSION = 'market-guide.v1';
export const CHOICE_KEYS = Object.freeze(Object.keys(CHOICES));
export const choiceName = (key) => String(CHOICES[key] || key).split(' (')[0];
const short = (title) => String(title || '').split(' — ')[0];
const subject = (word) => `${word}${hasFinalConsonant(word) ? '이' : '가'}`;
const md = (date) => { const [, m, d] = String(date || '').split('-').map(Number); return m && d ? `${m}/${d}` : ''; };

// What each six-axis overall label means for a reader, in plain words.
const OVERALL_MEANING = Object.freeze({
  '부담 우세': '여러 지표가 동시에 나빠, 작은 악재에도 크게 흔들리기 쉬운 환경입니다.',
  '다소 부담': '나쁜 쪽 지표가 더 많아, 좋은 소식보다 나쁜 소식에 더 민감한 환경입니다.',
  혼조: '좋은 지표와 나쁜 지표가 섞여, 한 방향으로 단정하기 어려운 환경입니다.',
  '다소 양호': '좋은 쪽 지표가 더 많아, 악재를 견딜 여력이 있는 환경입니다.',
  '양호 우세': '대부분 지표가 좋아 시장의 체력이 튼튼한 환경입니다. 다만 좋은 소식이 가격에 많이 들어가 있을 수 있습니다.',
  '판정 보류': '판정에 필요한 관측이 부족해 전체 판단을 보류합니다.'
});

const isLive = (item) => item?.gate?.met === true && item.known >= 2 && item.met > 0;
const isWatch = (item) => !isLive(item) && item?.known >= 2 && item.met > 0;
const ratio = (item) => (item.total ? item.met / item.total : 0);

function evidenceOf(item) {
  const pricing = item.pricingInConditions && item.pricing?.tone === 'same' ? null
    : { same: '시장 가격도 이쪽', against: '시장 가격은 반대쪽', neutral: '시장 가격은 중립' }[item.pricing?.tone] || null;
  // Owner 2026-10-19: one reading of the past frequency (analogs.js pastEvidence) — a share only where it differs from the base.
  const e = pastEvidence(item.past);
  const past = e.informative ? `과거 비슷한 때 ${e.n}번 중 ${e.sharePct}% 상승, 전체 기준선 ${e.baseUpPct}%${e.small ? ' (표본이 작음)' : ''}`
    : e.informative === false ? `과거 비슷한 때 ${e.n}번 — 전체 기준선(${e.baseUpPct}%)과 구별되지 않음`
      : e.n ? `과거 비슷한 때 ${e.n}번 — 표본이 작아 비율로 말하지 않음` : null;
  return { fit: item.fit, pricing, past };
}

function pathOf(item) {
  return {
    id: item.id, title: item.title, short: short(item.title), shape: item.shape || null, axes: item.axes || [], fit: item.fit, met: item.met, total: item.total,
    chain: item.chain || [], evidence: evidenceOf(item), favored: item.favored || [], costly: item.costly || [], favoredWhy: item.favoredWhy || '',
    choices: item.choices || {}, firmer: item.impact?.firmer || '', weaker: item.impact?.weaker || '',
    triggers: item.triggers || [], invalidation: item.invalidation || [], pastConflict: item.pastConflict || null
  };
}

// v58.64 (architecture audit I02): the tally counted branches, so writing one cause as two branches (the same axes)
// moved the pick without any new market fact. Branches that share a 거시 axis are one cluster of evidence: a choice
// scores by the clusters that favour it minus the clusters that call it costly. The tally is a count of written cost
// comparisons — not an expected or worst-case cost — and the sentences say only that.
export function axisClusters(paths) {
  const parent = new Map();
  const find = (key) => { while (parent.get(key) !== key) key = parent.get(key); return key; };
  const unite = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const path of paths) {
    const keys = path.axes?.length ? path.axes.map((axis) => `axis:${axis}`) : [`path:${path.id}`];
    for (const key of keys) if (!parent.has(key)) parent.set(key, key);
    keys.slice(1).forEach((key) => unite(keys[0], key));
  }
  return new Set(paths.map((path) => find(path.axes?.length ? `axis:${path.axes[0]}` : `path:${path.id}`))).size;
}

/** The choice tally across live branches (favoured minus costly clusters), and the opportunity cost if a watch branch takes over. */
export function buildDirection(live, watch) {
  const tally = CHOICE_KEYS.map((key) => {
    const favoredPaths = live.filter((path) => path.favored.includes(key));
    const costlyPaths = live.filter((path) => path.costly.includes(key));
    return { key, name: choiceName(key), label: CHOICES[key], favoredIn: favoredPaths.map((path) => path.short), costlyIn: costlyPaths.map((path) => path.short),
      favoredClusters: axisClusters(favoredPaths), costlyClusters: axisClusters(costlyPaths) };
  }).map((row) => ({ ...row, score: row.favoredClusters - row.costlyClusters }));
  if (!live.length) return { live, watch, tally, robust: null, split: false, costIfWrong: [], text: '핵심 조건을 갖춘 시나리오가 없어 어느 선택지가 유리한지 세지 않습니다. 이럴 때는 한 방향에 걸지 않고(나눠서, 조건을 붙여서) 다음 확인 신호를 기다리는 쪽을 기본으로 둡니다.' };
  const best = Math.max(...tally.map((row) => row.score));
  const top = tally.filter((row) => row.score === best && row.favoredIn.length > 0);
  const robust = top.find((row) => !row.costlyIn.length)?.key || top[0]?.key || null;
  const split = top.length > 1;
  const row = tally.find((item) => item.key === robust);
  // Opportunity cost: a watch branch (conditions building, core not met yet) that names the robust choice costly.
  const costIfWrong = robust ? watch.filter((path) => path.costly.includes(robust)).slice(0, 2).map((path) => ({
    id: path.id, short: path.short, fit: path.fit, text: path.choices[robust] || '', trigger: path.triggers[0] ? `${path.triggers[0].when} — ${path.triggers[0].text}` : null
  })) : [];
  const n = live.length;
  // The nearest watch branch (most conditions, core not met yet) either agrees with the tally or names what changes.
  const nearest = watch[0] || null;
  const nearText = !nearest || !robust ? '' : nearest.favored.includes(robust) ? ` 핵심 조건만 빠진 시나리오 중 가장 가까운 '${nearest.short}'(${nearest.fit})도 '${choiceName(robust)}'${hasFinalConsonant(choiceName(robust)) ? '을' : '를'} 유리하게 적습니다.`
    : nearest.costly.includes(robust) ? ` 다만 가장 가까운 '${nearest.short}'(${nearest.fit})로 넘어가면 이 선택의 비용이 커집니다.` : '';
  const text = !robust ? '살아 있는 시나리오들이 유리한 선택지를 서로 다르게 적어, 한쪽으로 세지 않습니다.'
    : `핵심 조건을 갖춘 시나리오 ${n}개 중 ${row.favoredIn.length}개에서 ${subject(`'${row.name}'`)} 상대적으로 유리하다고 적혀 있고${row.favoredClusters < row.favoredIn.length ? `(같은 거시 축을 공유하는 것을 하나로 묶으면 ${row.favoredClusters}묶음)` : ''}, 비용이 크다고 적힌 곳은 ${row.costlyIn.length ? `${row.costlyIn.length}개('${row.costlyIn.join("'·'")}')` : '없습니다'}${split ? ` — '${top.filter((item) => item.key !== robust).map((item) => item.name).join("'·'")}'도 같은 수라 함께 봅니다` : ''}.${nearText}`;
  return { live, watch: watch.slice(0, 3), tally, robust, split, costIfWrong, text };
}

function stanceOf({ direction, leadPath, lessons }) {
  const pursue = [];
  const avoid = [];
  const robust = direction.robust;
  // The lead's own sentence for the robust choice only when the lead favours it; otherwise the tally sentence speaks.
  if (robust && leadPath?.favored?.includes(robust) && leadPath.choices?.[robust]) pursue.push(`${choiceName(robust)}: ${leadPath.choices[robust]}`);
  else if (robust) pursue.push(`${choiceName(robust)}: 핵심 조건을 갖춘 시나리오 ${direction.live.length}개에 적힌 비용 비교를 셀 때 유리하다는 표시가 가장 많은 쪽입니다(확률이나 최소 비용의 증명은 아님).`);
  else if (!robust) pursue.push('한 방향에 걸지 않기 — 나눠서, 다음 확인 조건을 붙여서 판단합니다.');
  if (leadPath?.firmer && !/없음/.test(leadPath.firmer)) pursue.push(`'${leadPath.short}'에서 강해지는 쪽(${leadPath.firmer})이 실제로 버티는지 테마·섹터에서 확인`);
  if (leadPath?.triggers?.[0]) pursue.push(`다음 확인 신호를 미리 적어 두기: ${leadPath.triggers[0].when} — ${leadPath.triggers[0].text}`);
  const costly = direction.tally.filter((row) => row.costlyIn.length && row.key !== robust);
  for (const row of costly.slice(0, 2)) avoid.push(`${row.key === 'stage' ? '서두른 ' : ''}'${row.name}' — ${row.costlyIn.map((name) => `'${name}'`).join('·')}에서 비용이 크게 적혀 있습니다`);
  if (leadPath?.weaker && leadPath.weaker !== '—') avoid.push(`'${leadPath.short}'에서 약해지는 쪽(${leadPath.weaker})에 한 번에 몰기`);
  for (const lesson of lessons.filter((row) => row.kind === 'trap' && row.reason).slice(0, 2)) avoid.push(`${lesson.title}에 속기`);
  return { pursue: pursue.slice(0, 3), avoid: avoid.slice(0, 4) };
}

/**
 * @param {object} input
 * @param {object} input.regime     buildMarketRegime()
 * @param {object} [input.outlook]  buildScenarioOutlook()
 * @param {object} [input.crossroads] buildMacroCrossroads()
 * @param {object} [input.curve]   curveDynamics() — the 2s10s move, for the lessons
 * @param {object} [input.indexEarnings] buildIndexEarnings() — revision breadth, for the lessons
 * @param {number} [input.nowMs]
 */
export function buildMarketGuide({ regime = null, outlook = null, crossroads = null, curve = null, indexEarnings = null, nowMs = Date.now() } = {}) {
  if (!regime?.available) return { available: false, version: MARKET_GUIDE_VERSION, reason: '종가 기록을 불러오는 중이라 가이드를 만들지 않았습니다.' };
  const items = crossroads?.available ? crossroads.items || [] : [];
  const live = items.filter(isLive).sort((a, b) => ratio(b) - ratio(a)).map(pathOf);
  const watch = items.filter(isWatch).sort((a, b) => ratio(b) - ratio(a)).map(pathOf);
  const leadPath = live.find((path) => path.id === crossroads?.leadId) || live[0] || null;
  const direction = buildDirection(live, watch);
  const flow = outlook?.available ? outlook.items?.find((item) => item.id === outlook.leadId) || null : null;
  const nextEvent = crossroads?.nextEvent || null;
  const decides = nextEvent ? [...live, ...watch].filter((path) => path.triggers.some((t) => t.id === nextEvent.id)).map((path) => path.short) : [];
  const counts = regime.counts || {};
  const situation = [
    { id: 'health', label: '시장 체력', text: `미국 6개 지표 ${regime.overall} (양호 ${counts.favorable ?? 0}, 중립 ${counts.neutral ?? 0}, 부담 ${counts.burden ?? 0}) — ${OVERALL_MEANING[regime.overall] || ''}`.trim() },
    { id: 'flow', label: '지금 흐름', text: flow ? `'${flow.title}' (${flow.fit}) — ${String(flow.posture || '').split(/(?<=니다\.)\s+/)[0]}` : outlook?.headline || '시장 흐름을 판단할 관측이 부족합니다.' },
    { id: 'driver', label: '움직이는 힘', text: leadPath ? `'${leadPath.short}' 쪽 조건이 가장 많이 맞습니다(${leadPath.fit})${leadPath.title.includes(' — ') ? ` — ${leadPath.title.split(' — ')[1]}입니다` : ''}.` : crossroads?.headline || '거시 시나리오 판단을 보류합니다.' },
    { id: 'next', label: '다음 갈림길', text: nextEvent ? `${md(nextEvent.date)} ${nextEvent.name}${decides.length ? ` — '${decides.slice(0, 3).join("'·'")}' 쪽을 가릅니다` : ''}.` : crossroads?.available && Array.isArray(crossroads.events) ? '45일 안에 예정된 주요 발표가 없습니다.' : '발표 일정을 확인하지 못했습니다.' }
  ];
  // v58.63 (architecture audit I01): a live scenario whose past sample ran against its own conclusion (pastConflict) lost
  // that limit whenever other lessons filled the lesson slots. The conflict is not a lesson; it stays beside the
  // headline on the screen and in the AI block, every time.
  const pastConflicts = live.filter((path) => path.pastConflict).map((path) => {
    const c = path.pastConflict;
    return `'${path.short}' 시나리오는 비슷했던 과거 ${c.n}번 중 ${c.horizon}거래일 뒤 오른 경우가 ${c.sharePct}%(전체 기간 ${c.basePct}%)로, 이 시나리오의 ${c.lean === 'defensive' ? '방어' : '위험 감수'} 쪽 결론과 반대였습니다 — 이 선택은 조건부 비용 비교이며 과거 표본은 반대 근거입니다.`;
  });
  const ctx = { regime, outlook, crossroads, direction, curve, indexEarnings, nowMs };
  const lessons = selectLessons(ctx);
  const stance = stanceOf({ direction, leadPath, lessons });
  const headline = leadPath
    ? `${regime.overall} 환경에서 '${leadPath.short}' 쪽 조건이 가장 많이 맞고, ${direction.robust ? `핵심 조건을 갖춘 시나리오들에 유리하다고 가장 많이 적힌 선택은 '${choiceName(direction.robust)}'입니다` : '시나리오마다 유리한 선택지가 갈립니다'}${nextEvent ? ` — 다음 갈림길 ${md(nextEvent.date)} ${nextEvent.name}` : ''}.`
    : `${regime.overall} 환경이지만 핵심 조건을 갖춘 거시 시나리오가 없어, 한 방향에 걸지 않고 다음 확인 신호를 기다리는 쪽을 기본으로 둡니다${nextEvent ? ` — 다음 갈림길 ${md(nextEvent.date)} ${nextEvent.name}` : ''}.`;
  return { available: true, version: MARKET_GUIDE_VERSION, asOf: regime.asOf, macroAsOf: crossroads?.asOf || null, headline, situation, leadId: leadPath?.id || null, direction, stance, lessons, nextEvent, pastConflicts,
    note: "'유리한 쪽'은 각 시나리오에 적힌 비용 비교를 센 것이며, 확률이나 따라 하라는 지시가 아닙니다." };
}

/** The same model as one AI context block (chat and the server narrative read this, so their answers follow the screens). */
export function renderMarketGuideContext(guide) {
  if (!guide?.available) return '';
  const lines = [`【시장 가이드 — 화면과 같은 종합 (${guide.asOf} 확정 종가 기준)】`, guide.headline];
  for (const conflict of guide.pastConflicts || []) lines.push(`- 과거 표본과 어긋남: ${conflict}`);
  for (const row of guide.situation) lines.push(`- ${row.label}: ${row.text}`);
  const d = guide.direction;
  lines.push(`- 선택지 집계(핵심 조건을 갖춘 시나리오별 '유리'·'비용 큼' 표시를 센 것, 확률 아님): ${d.tally.map((row) => `${row.name} 유리 ${row.favoredIn.length}·비용 큼 ${row.costlyIn.length}`).join(' / ')}. ${d.text}`);
  for (const cost of d.costIfWrong) lines.push(`- 빗나갈 때의 기회비용: '${cost.short}'(${cost.fit}) 쪽으로 가면 — ${cost.text}${cost.trigger ? ` 확인: ${cost.trigger}` : ''}`);
  if (guide.stance.pursue.length) lines.push(`- 지향: ${guide.stance.pursue.join(' / ')}`);
  if (guide.stance.avoid.length) lines.push(`- 지양: ${guide.stance.avoid.join(' / ')}`);
  for (const lesson of guide.lessons) lines.push(`- [${LESSON_KINDS[lesson.kind]}] ${lesson.title}: ${lesson.principle}${lesson.reason ? ` (근거: ${lesson.reason})` : ''}`);
  lines.push('규칙: 이 종합을 따라 설명하되, 선택지 집계를 확률로 바꾸지 말고 독자의 보유 종목에 대한 매매·비중·가격·시점 지시로 바꾸지 마라. 태도·전략·속지 말 것은 위 원칙과 오늘 근거로만 말하라.');
  return lines.join('\n');
}
