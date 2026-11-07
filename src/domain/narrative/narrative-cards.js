// v59.70 (owner 2026-11-07): one story read from start to end — what the market is talking about (attention from the
// research channels and the movers whose own headline names it), how to read it (the analysis note's steps), whether
// the prices and indicators back it yet (the macro-crossroads branch it would feed: met conditions, market pricing,
// past frequency), what would confirm or break it (the branch's next release and invalidation), and what each general
// response costs if it is right (the branch's own choices). Nothing new is scored here: every judgement is the
// crossroads engine's, so 시장 상태's story card, 연결해서 보면 and the scenario fold cannot disagree. A story that is
// relayed a lot while its branch's conditions are mostly unmet says exactly that — attention is not confirmation
// (NARRATIVE-UX-HANDOFF: 관측과 해석 분리, 반대 근거, 다음에 볼 것; no probability, no grade, no personal instruction).
import { NARRATIVE_BY_ID } from './narratives.js';
import { CHOICES } from '../market/macro-crossroads.js';
import { withTopicParticle } from '../content/korean-particle.js';

const TREND_WORDS = Object.freeze({ rising: '늘어남', fading: '줄어듦', steady: '비슷함', new: '새로 등장', few: '건수 적음' });
const choiceName = (key) => String(CHOICES[key] || key).split(' (')[0];
const shortTitle = (title) => String(title || '').split(' — ')[0];
const signedPct = (value) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;

/** How far the indicators back a branch: confirmed (core met and most conditions), partly, or not yet. */
export function branchSupport(branch) {
  if (!branch || !(branch.total > 0)) return 'unknown';
  if (branch.gate?.met && branch.met * 2 > branch.total) return 'backed';
  if (branch.met > 0) return 'partial';
  return 'unbacked';
}
const SUPPORT_WORDS = Object.freeze({ backed: '지표가 뒷받침', partial: '일부만 맞음', unbacked: '지표로는 아직 확인 안 됨', unknown: '판단 보류' });

export function lessonFrame(frames, lessons) {
  const byId = new Map((lessons || []).map((lesson) => [lesson.id, lesson]));
  const frame = (frames || []).map((id) => byId.get(id)).find((lesson) => lesson && Array.isArray(lesson.steps) && lesson.steps.length);
  return frame ? { id: frame.id, title: frame.title, steps: frame.steps.slice(0, 4), counterclaim: frame.counterclaim || null } : null;
}

/**
 * @param {object} input
 * @param {object} input.narratives market-day.json `narratives` ({ stories, at, windowHours })
 * @param {object} input.crossroads the shared interpretation's crossroads model (items, nextEvent)
 * @param {object[]} [input.lessons] learning-core LESSONS, for the reading frame
 * @returns {{ available, at, cards: object[] }}
 */
export function buildNarrativeCards({ narratives = null, crossroads = null, lessons = [] } = {}) {
  const stories = Array.isArray(narratives?.stories) ? narratives.stories : [];
  if (!stories.length) return { available: false, at: narratives?.at || null, cards: [] };
  const items = new Map((crossroads?.items || []).map((item) => [item.id, item]));
  const cards = stories.map((story) => {
    const theme = NARRATIVE_BY_ID[story.id] || {};
    const branches = (theme.branches || []).map((id) => items.get(id)).filter(Boolean)
      .sort((a, b) => (b.gate?.met === true) - (a.gate?.met === true) || b.met / b.total - a.met / a.total);
    const lead = branches[0] || null;
    const support = branchSupport(lead);
    const attention = [`리서치 채널 ${narratives.windowHours || 72}시간 ${story.telegramCount}건`, `24시간 ${story.recentCount}건(${TREND_WORDS[story.trend] || '비슷함'})`,
      story.newsCount ? `뉴스 보도 ${story.newsCount}건` : null,
      story.rumorCount || story.unconfirmedCount ? `루머·익명 소식통 ${story.rumorCount + story.unconfirmedCount}건` : null].filter(Boolean).join(' · ');
    const movers = (story.movers || []).map((row) => `${row.sym} 5거래일 ${signedPct(row.ret5d)}`);
    // The one line. A story does not carry its own direction (a memory story can be a shortage or a glut), so it is never
    // read as "if true, then X": the linked scenarios are competing readings, and the line says which one the indicators
    // fit better and where the other stands (NARRATIVE-UX-HANDOFF 해석 A/B).
    const alt = branches[1] || null;
    const quoted = (item) => `'${shortTitle(item.title)}'`;
    const topic = (item) => `${quoted(item)}${withTopicParticle(shortTitle(item.title)).slice(shortTitle(item.title).length)}`;
    const tail = support === 'backed' ? (lead?.pricing?.tone === 'same' ? ' 시장 가격도 같은 쪽으로 움직였습니다.' : '')
      : support === 'partial' ? ' 이야기가 가격·지표보다 앞서 있을 수 있습니다.' : ' 많이 오가는 것과 맞는 것은 다릅니다.';
    const line = !lead ? '많이 오가는 이야기지만 이어지는 시나리오가 없어 가격·지표로 확인할 고리가 없습니다.'
      : alt ? `이어지는 시나리오 중 지표가 더 맞는 쪽은 ${quoted(lead)}(${lead.status})이고, ${topic(alt)} ${alt.status}입니다.${tail}`
        : `이어지는 ${quoted(lead)} 시나리오는 ${support === 'backed' ? '지표도 뒷받침합니다' : support === 'partial' ? '지표가 일부만 맞습니다' : '지표로 아직 확인되지 않습니다'}(${lead.status}).${tail}`;
    const scenarios = branches.map((item) => ({
      id: item.id, title: shortTitle(item.title), status: item.status, support: branchSupport(item), supportWord: SUPPORT_WORDS[branchSupport(item)],
      chain: (item.chain || []).slice(0, 3), pricing: item.pricing?.text || null,
      confirm: (item.triggers || []).map((trigger) => `${trigger.when} — ${trigger.text}`).slice(0, 2),
      breaks: (item.invalidation || []).slice(0, 2), past: item.past?.text || null,
      favored: (item.favored || []).map(choiceName), favoredWhy: item.favoredWhy || null, costly: (item.costly || []).map(choiceName),
      choices: Object.entries(item.choices || {}).map(([key, text]) => ({ key, name: choiceName(key), text }))
    }));
    return { id: story.id, label: story.label || theme.label, question: theme.question || null, attention, movers, line, support,
      supportWord: SUPPORT_WORDS[support], latestAt: story.latestAt || null, frame: lessonFrame(theme.frames, lessons), scenarios };
  });
  return { available: true, at: narratives.at || null, windowHours: narratives.windowHours || 72, cards };
}
