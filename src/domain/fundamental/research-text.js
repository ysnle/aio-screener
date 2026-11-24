// A company story is researched once and frozen (public-data/company-profiles/<SYM>.json,
// `researchedAt`), while the consensus table beside it is collected every week. MU's story said "현재 상향 32건" and
// "최근 4주 상향 32건·하향 0건" on 11/22, when the live table read "최근 4주 변경 없음". Researched text carries its
// research day: "현재/지금" beside a number never renders, and a figure that moves between reports (estimate revision
// counts) names the day it was counted. The producer side (scripts/sync-company-profiles.mjs) warns on the same words.

const ISO_DAY = /^\d{4}-\d{2}-\d{2}/;
// "현재" or "지금(은/는/의)" with a quantity (a figure and its unit, not a year) within ten characters of the same clause.
const NOW_BESIDE_NUMBER = /(현재|지금)(은|는|의)?\s+(?=[^,.;·\n]{0,10}?\d[\d,.]*\s*(?:%|건|배|달러|억|조|원|명|개|bp))/g;
// Analyst estimate revision counts: the figure the weekly consensus table owns.
const REVISION_COUNT = /(?:최근\s*4주\s*)?(?:상향|하향)\s*\d+\s*건/;
// A clause already dated ("2026-10-27 기준", "10/28", "조사 당시") keeps its own date.
const DATED = /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}|조사 당시/;

export const researchDayLabel = (researchedAt) => {
  const m = String(researchedAt || '').match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${Number(m[1])}/${Number(m[2])} 조사 당시` : '조사 당시';
};

/** Every "현재/지금" beside a number and every undated revision count in one researched text (warn-only findings). */
export function researchTextWarnings(text) {
  const value = String(text || '');
  const out = [];
  for (const match of value.matchAll(NOW_BESIDE_NUMBER)) out.push({ kind: 'now-beside-number', word: match[1], excerpt: value.slice(match.index, match.index + 24) });
  const hit = value.match(REVISION_COUNT);
  if (hit && !DATED.test(value)) out.push({ kind: 'undated-revision-count', word: hit[0], excerpt: value.slice(Math.max(0, hit.index - 8), hit.index + hit[0].length) });
  return out;
}

/**
 * One researched text as it renders: "현재/지금" beside a number becomes the research day, and a text that counts
 * estimate revisions without any date of its own gets the research day before its first count.
 */
export function datedResearchText(text, researchedAt) {
  if (typeof text !== 'string' || !text) return text;
  const tag = researchDayLabel(researchedAt);
  // "지금의 10배" keeps its particle ("조사 당시의 10배"); "지금은/현재" is replaced whole.
  const noNow = text.replace(NOW_BESIDE_NUMBER, (_, __, particle) => `${tag}${particle === '의' ? '의' : ''} `);
  const hit = noNow.match(REVISION_COUNT);
  return hit && !DATED.test(noNow) ? `${noNow.slice(0, hit.index)}${tag} ${noNow.slice(hit.index)}` : noNow;
}

// Fields that are not researched prose: dates, names, links and the source list.
const NOT_PROSE = new Set(['symbol', 'name', 'researchedAt', 'fiscalYearEnd', 'sources', 'url', 'date', 'when', 'givenOn', 'period', 'unit']);

/** Every warning in a story's prose, with the field path (the producer's warn-only validation). */
export function storyResearchWarnings(story) {
  const out = [];
  const walk = (value, path, key) => {
    if (NOT_PROSE.has(key)) return;
    if (typeof value === 'string') { for (const finding of researchTextWarnings(value)) out.push({ path, ...finding }); return; }
    if (value && typeof value === 'object') for (const [k, v] of Object.entries(value)) walk(v, path ? `${path}.${k}` : k, Array.isArray(value) ? null : k);
  };
  walk(story, '', null);
  return out;
}

/** The story with every prose string dated by its research day (a copy; the stored story is not changed). */
export function datedStory(story) {
  if (!story || typeof story !== 'object') return story;
  const day = ISO_DAY.test(String(story.researchedAt || '')) ? story.researchedAt : null;
  const walk = (value, key) => {
    if (NOT_PROSE.has(key)) return value;
    if (typeof value === 'string') return datedResearchText(value, day);
    if (Array.isArray(value)) return value.map((item) => walk(item, null));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, walk(v, k)]));
    return value;
  };
  return walk(story, null);
}
