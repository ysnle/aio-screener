// A price, size or timing order (same rule as the story contract).
const ORDER = /(매수하세요|매도하세요|사세요|파세요|진입가|손절가|손절\s*라인|목표\s*주가|목표가\s*[:：]?\s*\$?\d|비중을?\s*(늘리|줄이)세요|buy at|sell at|stop[- ]loss at|price target of)/i;
const text = (value) => typeof value === 'string' && value.trim() !== '';
function endsAsQuestion(value) {
  const t = String(value).trim().replace(/[.\s]+$/, '');
  if (/[?？]$/.test(t)) return true;
  const last = t.at(-1), code = t.length > 1 ? t.charCodeAt(t.length - 2) - 0xac00 : -1;
  if (code < 0 || code >= 11172) return false;
  return (last === '가' && code % 28 === 4) || (last === '까' && code % 28 === 8);
}

/**
 * Shape problems of a story's (or a draft's) debate and underTheHood, as short strings. Both fields are optional; a
 * present field must be complete and cite only the story's own source ids.
 * @param {{debate?: object, underTheHood?: Array}} story
 * @param {Set<string>} sourceIds
 */
export function debateIssues(story, sourceIds) {
  const issues = [];
  const cites = (src, where) => {
    if (!Array.isArray(src) || !src.length) { issues.push(`${where} has no src`); return; }
    for (const id of src) if (!sourceIds.has(id)) issues.push(`${where} cites unknown source ${id}`);
  };
  const d = story?.debate;
  if (d != null) {
    if (!text(d.question)) issues.push('debate.question missing');
    else if (endsAsQuestion(d.question)) issues.push('debate.question ends as a question; write the issue as a noun clause (…는지)');
    for (const side of ['bull', 'bear']) {
      if (!text(d[side]?.text)) issues.push(`debate.${side}.text missing`);
      cites(d[side]?.src, `debate.${side}`);
    }
    if (text(d.bull?.text) && d.bull.text === d.bear?.text) issues.push('debate bull and bear are the same text');
    const decides = Array.isArray(d.decides) ? d.decides : [];
    if (decides.length < 1 || decides.length > 3) issues.push(`debate.decides has ${decides.length} items (1-3)`);
    decides.forEach((item, i) => { if (!text(item?.when) || !text(item?.what)) issues.push(`debate.decides[${i}] needs when and what`); cites(item?.src, `debate.decides[${i}]`); });
  }
  const hood = story?.underTheHood;
  if (hood != null) {
    if (!Array.isArray(hood) || hood.length < 2 || hood.length > 4) issues.push(`underTheHood has ${Array.isArray(hood) ? hood.length : 0} items (2-4)`);
    (Array.isArray(hood) ? hood : []).forEach((item, i) => {
      if (!text(item?.title) || !text(item?.text)) issues.push(`underTheHood[${i}] needs title and text`);
      else if (item.title.length > 24) issues.push(`underTheHood[${i}].title longer than 24 characters`);
      cites(item?.src, `underTheHood[${i}]`);
    });
  }
  const order = JSON.stringify({ d, hood }).match(ORDER);
  if (order) issues.push(`trade wording "${order[0]}"`);
  if (/전문가가 보는/.test(JSON.stringify({ d, hood }))) issues.push('labels "전문가가 보는"');
  return issues;
}

/** The debate as AI context lines (src/domain/entity/company-story.js companyStoryContext). */
export function debateContextLines(story) {
  const d = story?.debate, hood = Array.isArray(story?.underTheHood) ? story.underTheHood : [];
  const lines = [];
  if (text(d?.question)) {
    lines.push(`핵심 쟁점: ${d.question}`);
    if (text(d.bull?.text)) lines.push(`유지된다는 읽기: ${d.bull.text}`);
    if (text(d.bear?.text)) lines.push(`깨진다는 읽기: ${d.bear.text}`);
    if (Array.isArray(d.decides) && d.decides.length) lines.push(`판가름할 것: ${d.decides.map((x) => `${x.when} ${x.what}`).join(' / ')}`);
  }
  if (hood.length) lines.push(`잘 안 보이는 구조: ${hood.map((x) => `${x.title} — ${x.text}`).join(' / ')}`);
  return lines;
}
