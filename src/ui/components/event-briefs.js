// v59.42 (owner audit 2026-10-28): the event briefs (public-data/event-briefs.json, .github/workflows/event-briefs.yml) on
// 오늘 — a short '주요 발표 요약' block of the last three days — and on the 종목 page under the company summary. The face shows
// the headline and the reported figures (with the provider estimate where one exists); the fold holds segments,
// guidance, the call or press-conference points with their basis, what to watch next, and the source.
import { el } from './dom.js';
import { frameHead, markFrame } from './section-frame.js';
import { recentBriefs, latestBriefFor, BRIEF_BASIS_WORDS } from '../../domain/briefing/event-briefs.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { EVENT_BRIEFS } from '../../data/event-artifacts.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
function whenText(brief) {
  const ms = Date.parse(brief.publishedAt || '');
  if (!Number.isFinite(ms)) return brief.eventDate || '';
  const d = new Date(ms + 9 * 3600000);
  const day = `${d.getUTCMonth() + 1}/${d.getUTCDate()}(${WEEKDAYS[d.getUTCDay()]})`;
  return brief.publishedDateOnly ? `${day} 공시` : `${day} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} KST`;
}

const signed = (value) => `${value > 0 ? '+' : ''}${value}%`;
function figureText(figure) {
  const parts = [`${figure.label} ${figure.value}`.trim()];
  if (figure.text) parts.push(figure.text);
  if (figure.estimate?.surprisePct != null) parts.push(`예상 대비 ${signed(figure.estimate.surprisePct)}`);
  return parts.join(' · ');
}

function list(doc, items, className = 'event-brief__list') {
  const ul = el(doc, 'ul', null, className);
  for (const text of items) ul.append(el(doc, 'li', text));
  return ul;
}

function basisWord(points) {
  if (points.basis === 'transcript') return points.preliminary ? '녹취록(예비) 기준' : BRIEF_BASIS_WORDS.transcript;
  return BRIEF_BASIS_WORDS[points.basis] || BRIEF_BASIS_WORDS['news-report'];
}

export function briefNode(doc, brief, { showName = true } = {}) {
  const box = el(doc, 'article', null, 'event-brief');
  box.dataset.kind = brief.kind;
  const head = el(doc, 'p', null, 'event-brief__head');
  if (showName) head.append(el(doc, 'strong', brief.kind === 'fomc' ? 'FOMC 금리 결정' : `${brief.nameKo}${brief.symbol && !/\.K[SQ]$/.test(brief.symbol) ? ` (${brief.symbol})` : ''} 실적`, 'event-brief__name'), doc.createTextNode(' '));
  head.append(el(doc, 'span', whenText(brief), 'event-brief__when'));
  box.append(head);
  if (brief.headline) box.append(el(doc, 'p', brief.headline, 'event-brief__headline'));
  const figures = (brief.figures || []).slice(0, 3);
  if (figures.length) {
    const ul = list(doc, figures.map(figureText), 'event-brief__figures');
    // Sources stay off the face (owner 2026-10-06): the estimate's provider is on the row's hover.
    figures.forEach((figure, i) => { if (figure.estimate) ul.children[i].title = `예상치: ${figure.estimate.source || '제공처'} 컨센서스(참고)`; else if (figure.derived) ul.children[i].title = `공시 원문 ${figure.derived}`; });
    box.append(ul);
  }
  const more = el(doc, 'details', null, 'event-brief__more');
  more.append(el(doc, 'summary', brief.kind === 'fomc' ? '바뀐 문구·기자회견·다음에 볼 것' : '부문·가이던스·콜 핵심·다음에 볼 것'));
  const section = (title, items) => { if (items.length) more.append(el(doc, 'p', title, 'event-brief__sub'), list(doc, items)); };
  section(brief.detailTitle || '세부', (brief.details || []).map((item) => [item.label, item.value, item.text].filter(Boolean).join(' · ')));
  section('반대 의견', (brief.dissents || []).map((item) => item.text || item.label));
  section('가이던스', (brief.guidance || []).map((item) => [item.label, item.value, item.text].filter(Boolean).join(' · ')));
  const points = brief.callPoints;
  if (points?.points?.length) section(`${points.title} (${basisWord(points)}${points.speaker ? `, ${points.speaker}` : ''})`, points.points.map((point) => point.text));
  else if (brief.kind !== 'fomc' || brief.status !== 'complete') more.append(el(doc, 'p', `${brief.kind === 'fomc' ? '기자회견' : '컨퍼런스콜'} 요약은 아직 정리 전입니다.`, 'event-brief__note'));
  section('다음에 볼 것', brief.watch || []);
  const source = el(doc, 'p', null, 'event-brief__source');
  source.append(doc.createTextNode('데이터 출처: '));
  if (brief.source?.url) {
    const link = el(doc, 'a', brief.source.title || '원문', null);
    link.href = brief.source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    source.append(link);
  } else source.append(doc.createTextNode(brief.source?.title || '원문'));
  if (points?.transcriptUrl && points.basis !== 'transcript') {
    const link = el(doc, 'a', '연준 녹취록', null);
    link.href = points.transcriptUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
    source.append(doc.createTextNode(' · '), link);
  }
  const dropped = (brief.dropped || []).length + (points?.dropped || []).length;
  // A DART brief's table is read from the filing without AI; only its call points (when present) are AI-written.
  const aiWritten = (brief.ai || []).length > 0 || !!points?.points?.length;
  source.append(doc.createTextNode(`. 숫자는 원문에서 확인된 것만 싣습니다${dropped ? `(확인되지 않은 항목 ${dropped}건 제외)` : ''}. ${aiWritten ? '요약은 공용 AI가 썼고' : '표는 공시 원문에서 그대로 읽었고'} 매매 판단이 아닙니다.`));
  more.append(source);
  box.append(more);
  return box;
}

function ensureArtifact(root, rerender) {
  refreshSharedArtifact(root, EVENT_BRIEFS).then(({ changed }) => { if (changed && typeof rerender === 'function') rerender(); }).catch(() => {});
  return root?.[EVENT_BRIEFS.key] || null;
}

/** 오늘: the last three days of briefs, after the overnight block. */
export function paintHomeBriefs(doc, root, loop, rerender) {
  if (!doc || !loop) return [];
  const briefs = recentBriefs(ensureArtifact(root, rerender), { nowMs: Date.now(), days: 3, limit: 4 });
  let host = doc.getElementById('home-event-briefs');
  if (!briefs.length) { if (host) host.hidden = true; return briefs; }
  if (!host) {
    host = el(doc, 'section', null, 'daily-block event-briefs');
    host.id = 'home-event-briefs';
    host.setAttribute('aria-labelledby', 'home-event-briefs-title');
    const overnight = doc.getElementById('home-overnight');
    if (overnight?.parentElement === loop) overnight.insertAdjacentElement('afterend', host); else loop.prepend(host);
  }
  const head = frameHead(doc, { title: '주요 발표 요약', titleId: 'home-event-briefs-title', titleClass: 'briefing-h2' });
  head.classList.add('daily-card-head');
  head.title = 'FOMC 결정과 시장을 움직이는 기업의 실적을 원문 공시에서 정리했습니다. 시각은 한국 시간';
  markFrame(host, 'home.event-briefs');
  host.replaceChildren(head, ...briefs.map((brief) => briefNode(doc, brief)));
  host.hidden = false;
  return briefs;
}

/** 종목: the latest brief of this symbol (about one quarter), under the company summary. */
export function paintTickerBrief(doc, root, symbol, anchor, rerender) {
  if (!doc || !anchor) return null;
  const brief = latestBriefFor(ensureArtifact(root, rerender), symbol, { nowMs: Date.now() });
  let host = doc.getElementById('ticker-event-brief');
  if (!brief) { if (host) host.hidden = true; return null; }
  if (!host) { host = el(doc, 'section', null, 'event-briefs event-briefs--ticker'); host.id = 'ticker-event-brief'; anchor.insertAdjacentElement('afterend', host); }
  if (host.dataset.signature === `${brief.id}|${root?.[EVENT_BRIEFS.key]?.generatedAt || ''}` && host.childElementCount) { host.hidden = false; return brief; }
  host.dataset.signature = `${brief.id}|${root?.[EVENT_BRIEFS.key]?.generatedAt || ''}`;
  host.replaceChildren(el(doc, 'h2', '최근 실적 발표 요약', 'briefing-h2'), briefNode(doc, brief, { showName: false }));
  host.hidden = false;
  return brief;
}
