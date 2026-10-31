// v59.42 (owner audit 2026-10-28): the event briefs (public-data/event-briefs.json, .github/workflows/event-briefs.yml) on
// 오늘 — a short '주요 발표 요약' block of the last three days — and on the 종목 page under the company summary. The face shows
// the headline and the reported figures (with the provider estimate where one exists); the fold holds segments,
// guidance, the call or press-conference points with their basis, what to watch next, and the source.
// v59.44 (owner 2026-10-29, news by weight): 오늘 leads with the releases that move the whole market — a monthly macro
// release of the last two days, the FOMC, the core movers — as full cards; other notable reports are one line each
// (name, the price after the report, headline) under '그 밖의 실적'; everything else of the last 30 days sits in a fold.
import { el } from './dom.js';
import { directionOf } from '../../domain/shared/number.js';
import { frameHead, markFrame } from './section-frame.js';
import { homeBriefTiers, latestBriefFor, reactionText, BRIEF_BASIS_WORDS, CALL_SEARCH_MAX_ATTEMPTS, epsComparisonBasis, koreanReleaseText, surprisePct } from '../../domain/briefing/event-briefs.js';
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
// v59.48: an EPS line is compared on the basis epsComparisonBasis names (the adjusted line, or the adjusted amount its
// note gives, or the reported basis for GAAP-only issuers) — re-read here so a brief published before the rule reads it.
function comparison(figure, figures, provisional) {
  const estimate = figure.estimate;
  if (estimate?.surprisePct == null) return null;
  if (provisional || figure.metric !== 'eps_diluted' || (estimate.basis && estimate.basis !== 'provider-consensus-reference')) return { pct: estimate.surprisePct, note: '' };
  const basis = epsComparisonBasis(figure, figures);
  const pct = basis ? surprisePct(basis.actual, Number(estimate.value)) : null;
  if (pct == null) return null;
  return { pct, note: basis.basis === 'adjusted-in-note' ? `(조정 ${basis.amount} 기준)` : basis.basis === 'reported' ? '(보고 기준)' : '' };
}
function figureText(figure, figures = [], provisional = false) {
  const parts = [koreanReleaseText(`${figure.label} ${figure.value}`.trim())];
  const head = parts[0].slice(String(figure.label || '').length).trim();
  const text = figure.text ? koreanReleaseText(figure.text) : '';
  // A note that only restates the value ("표결 10대 2 · 성명은 10대 2 표결로 승인됐다") adds nothing; one with another number stays.
  if (text && !(head && text.includes(head) && !/\d/.test(text.replace(head, '')))) parts.push(text);
  const compared = comparison(figure, figures, provisional);
  if (compared) parts.push(`예상 대비 ${signed(compared.pct)}${compared.note ? ` ${compared.note}` : ''}`);
  // A sentence-final period inside a joined line read "증가. · 예상 대비"; only the line's own end keeps one.
  return parts.map((part, i) => (i < parts.length - 1 ? part.replace(/[.。]\s*$/, '') : part)).join(' · ');
}
const releaseLine = (item) => koreanReleaseText([item.label, item.value, item.text].filter(Boolean).join(' · '));

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
  if (brief.status === 'provisional') head.append(doc.createTextNode(' '), el(doc, 'span', BRIEF_BASIS_WORDS.provider, 'event-brief__basis'));
  box.append(head);
  if (brief.headline) box.append(el(doc, 'p', koreanReleaseText(brief.headline), 'event-brief__headline'));
  const reaction = reactionText(brief.reaction);
  if (reaction) {
    const line = el(doc, 'p', reaction, 'event-brief__reaction');
    line.dataset.direction = directionOf(brief.reaction.extendedPct ?? brief.reaction.latestPct, 1) || 'flat'; // v59.45 (R1-05): 0.0% is flat
    line.title = brief.reaction.basis === 'latest-trade' ? '발표 직전 정규장 종가 대비 가장 최근 체결가(시간외 또는 마감 전 정규장)' : `발표 직전 종가(${brief.reaction.baseDate}) 대비 종가`;
    box.append(line);
  }
  const reasons = brief.reasons?.points || [];
  if (reasons.length) {
    box.append(el(doc, 'p', '왜 움직였나(보도 기준)', 'event-brief__sub'), list(doc, reasons.slice(0, 3).map((point) => point.text), 'event-brief__reasons'));
  }
  // v59.44: three headline figures, then capex and cash flow when the release gave them (the market priced cash).
  const cashFigure = (figure) => ['capex', 'free_cash_flow', 'operating_cash_flow'].includes(figure?.metric);
  const figures = [...(brief.figures || []).filter((figure) => !cashFigure(figure)).slice(0, 3), ...(brief.figures || []).filter(cashFigure).slice(0, 2)];
  if (figures.length) {
    const ul = list(doc, figures.map((figure) => figureText(figure, brief.figures || [], brief.status === 'provisional')), 'event-brief__figures');
    // Sources stay off the face (owner 2026-10-06): the estimate's provider is on the row's hover.
    figures.forEach((figure, i) => { if (figure.estimate) ul.children[i].title = `예상치: ${figure.estimate.source || '제공처'} 컨센서스(참고)`; else if (figure.derived) ul.children[i].title = `공시 원문 ${figure.derived}`; });
    box.append(ul);
  }
  const more = el(doc, 'details', null, 'event-brief__more');
  more.append(el(doc, 'summary', brief.kind === 'fomc' ? '바뀐 문구·기자회견·다음에 볼 것' : '부문·가이던스·콜 핵심·다음에 볼 것'));
  const section = (title, items) => { if (items.length) more.append(el(doc, 'p', title, 'event-brief__sub'), list(doc, items)); };
  section(brief.detailTitle || '세부', (brief.details || []).map(releaseLine));
  section('반대 의견', (brief.dissents || []).map((item) => item.text || item.label));
  section('가이던스', (brief.guidance || []).map(releaseLine));
  const points = brief.callPoints;
  if (points?.points?.length) section(`${points.title} (${basisWord(points)}${points.speaker ? `, ${points.speaker}` : ''})`, points.points.map((point) => point.text));
  else if (brief.status === 'provisional') { /* the source line says the figures await the filing */ }
  else if (brief.scope === 'release') more.append(el(doc, 'p', '실적 보도자료 기준 요약입니다. 컨퍼런스콜은 따로 정리하지 않습니다.', 'event-brief__note'));
  // v59.45 (pipeline review P21-LIFECYCLE-01): after the last search a missing summary is "not found", not "not yet".
  else if (!points?.done && (points?.attempts || 0) >= CALL_SEARCH_MAX_ATTEMPTS) more.append(el(doc, 'p', `${brief.kind === 'fomc' ? '기자회견' : '컨퍼런스콜'} 요약은 보도에서 찾지 못했습니다.`, 'event-brief__note'));
  else if (brief.kind !== 'fomc' || brief.status !== 'complete') more.append(el(doc, 'p', `${brief.kind === 'fomc' ? '기자회견' : '컨퍼런스콜'} 요약은 아직 정리 전입니다.`, 'event-brief__note'));
  section('다음에 볼 것', brief.watch || []);
  const source = el(doc, 'p', null, 'event-brief__source');
  source.append(doc.createTextNode('데이터 출처: '));
  if (brief.source?.url) {
    const link = el(doc, 'a', brief.source.title || '원문', null);
    link.href = brief.source.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    source.append(link);
  } else source.append(doc.createTextNode(brief.source?.title || '원문'));
  reasons.forEach((point, i) => {
    if (!/^https:\/\//.test(point.url || '')) return;
    const link = el(doc, 'a', `반응 이유 기사 ${i + 1}`, null);
    link.href = point.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
    source.append(doc.createTextNode(' · '), link);
  });
  // v59.45 (pipeline review P21-EVIDENCE-01): a report-based call summary links its articles too, like the reasons.
  if (points?.basis === 'news-report' && points.points?.length) {
    [...new Set(points.points.map((point) => point.url).filter((url) => /^https:\/\//.test(url || '')))].forEach((url, i) => {
      const link = el(doc, 'a', `${brief.kind === 'fomc' ? '기자회견' : '콜'} 보도 기사 ${i + 1}`, null);
      link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer';
      source.append(doc.createTextNode(' · '), link);
    });
  }
  if (points?.transcriptUrl && points.basis !== 'transcript') {
    const link = el(doc, 'a', '연준 녹취록', null);
    link.href = points.transcriptUrl; link.target = '_blank'; link.rel = 'noopener noreferrer';
    source.append(doc.createTextNode(' · '), link);
  }
  const dropped = (brief.dropped || []).length + (points?.dropped || []).length;
  // A DART brief's table is read from the filing without AI; only its call points (when present) are AI-written.
  const aiWritten = (brief.ai || []).length > 0 || !!points?.points?.length || reasons.length > 0;
  // A provisional brief's figures are the provider's, never checked against a filing (reviewer, v59.44).
  if (brief.status === 'provisional') source.append(doc.createTextNode(`. 수치는 제공처 집계로 공시 원문과 아직 대조하지 않았고, 원문이 나오면 원문 요약으로 바뀝니다. ${reasons.length ? '주가가 움직인 이유는 공용 AI가 보도에서 찾았고' : '이 내용은'} 매매 판단이 아닙니다.`));
  // P21-NUMBER-01: the check is that the same figure (with its unit and direction) stands in the quoted source sentence.
  else source.append(doc.createTextNode(`. 숫자는 원문 문장에 같은 숫자가 있는 것만 싣습니다${dropped ? `(확인되지 않은 항목 ${dropped}건 제외)` : ''}. ${aiWritten ? '요약은 공용 AI가 썼고' : '표는 공시 원문에서 그대로 읽었고'} 매매 판단이 아닙니다.`));
  more.append(source);
  box.append(more);
  return box;
}

function ensureArtifact(root, rerender) {
  refreshSharedArtifact(root, EVENT_BRIEFS).then(({ changed }) => { if (changed && typeof rerender === 'function') rerender(); }).catch(() => {});
  return root?.[EVENT_BRIEFS.key] || null;
}

const shortDay = (iso) => { const [, m, d] = String(iso || '').slice(0, 10).split('-').map(Number); return m && d ? `${m}/${d}` : ''; };

/** A monthly release as a card: what came out, for which month, and when the next one is. */
export function macroNode(doc, release) {
  const box = el(doc, 'article', null, 'event-brief');
  box.dataset.kind = 'macro';
  const head = el(doc, 'p', null, 'event-brief__head');
  head.append(el(doc, 'strong', `${release.title}${release.period ? ` ${Number(release.period.slice(5, 7))}월분` : ''}`, 'event-brief__name'), doc.createTextNode(' '),
    el(doc, 'span', `${shortDay(release.date)} 발표`, 'event-brief__when'));
  if (release.pending) {
    box.append(head, el(doc, 'p', '발표됐습니다. 공식 수치는 다음 데이터 갱신(약 30분 간격) 때 들어옵니다.', 'event-brief__headline'));
    return box;
  }
  box.append(head, list(doc, release.items.map((item) => [`${item.label.replace(/ \(.*\)$/, '')} ${item.valueText}`, item.deltaText, item.targetText].filter(Boolean).join(' · ')), 'event-brief__figures'));
  if (release.next) box.append(el(doc, 'p', `다음 발표 ${shortDay(release.next)}`, 'event-brief__when'));
  return box;
}

/** One line: name (opens 종목), day, the price after the report, headline. */
function briefRow(doc, root, brief) {
  const li = el(doc, 'li', null, 'event-brief-row');
  const name = brief.kind === 'fomc' ? 'FOMC 금리 결정' : `${brief.nameKo}${brief.symbol && !/\.K[SQ]$/.test(brief.symbol) ? ` (${brief.symbol})` : ''}`;
  if (brief.symbol && typeof root?.showTicker === 'function') {
    const button = el(doc, 'button', name, 'event-brief-row__name');
    button.type = 'button';
    button.addEventListener('click', () => root.showTicker(brief.symbol));
    li.append(button);
  } else li.append(el(doc, 'strong', name, 'event-brief-row__name'));
  li.append(el(doc, 'span', shortDay(brief.eventDate || brief.publishedAt), 'event-brief__when'));
  const reaction = reactionText(brief.reaction);
  if (reaction) {
    const move = el(doc, 'span', reaction, 'event-brief-row__move');
    move.dataset.direction = directionOf(brief.reaction.extendedPct ?? brief.reaction.latestPct, 1) || 'flat'; // v59.45 (R1-05): 0.0% is flat
    li.append(move);
  }
  if (brief.headline) li.append(el(doc, 'span', koreanReleaseText(brief.headline), 'event-brief-row__headline'));
  const reason = brief.reasons?.points?.[0]?.text;
  if (reason) li.append(el(doc, 'span', `이유: ${reason}`, 'event-brief-row__reason'));
  // The line is quieter, not thinner: the full summary (figures, guidance, reasons, source) opens in place.
  if (brief.kind === 'earnings') {
    const fold = el(doc, 'details', null, 'event-brief-row__fold');
    fold.append(el(doc, 'summary', '실적 요약 펼치기'), briefNode(doc, brief, { showName: false }));
    li.append(fold);
  }
  return li;
}

function rowList(doc, root, briefs) {
  const ul = el(doc, 'ul', null, 'event-brief-rows');
  ul.append(...briefs.map((brief) => briefRow(doc, root, brief)));
  return ul;
}

/** 오늘: macro releases and core briefs in full, other reports one line each, the rest folded. */
export function paintHomeBriefs(doc, root, loop, rerender, macro = []) {
  if (!doc || !loop) return [];
  return paintBriefs(doc, root, { rerender, macro, id: 'home-event-briefs', frame: 'home.event-briefs', className: 'daily-block event-briefs', place: (host) => {
    host.id = 'home-event-briefs';
    // v59.44 (owner 2026-10-30): straight after 밤사이 핵심, ahead of the schedule and the AI-chain block.
    const overnight = doc.getElementById('home-overnight');
    if (overnight?.parentElement === loop) overnight.insertAdjacentElement('afterend', host); else loop.prepend(host);
  } });
}

/** 뉴스: the same tiers open the page, above 중요 뉴스, with a longer line list (owner 2026-10-30, each screen carries it). */
export function paintNewsBriefs(doc, root, rerender, macro = []) {
  const anchor = doc?.getElementById('news-important');
  if (!anchor) return [];
  return paintBriefs(doc, root, { rerender, macro, id: 'news-event-briefs', frame: 'market-news.event-briefs', className: 'briefing-block event-briefs', limits: { notableLimit: 16 }, place: (host) => {
    host.id = 'news-event-briefs';
    anchor.insertAdjacentElement('beforebegin', host);
  } });
}

function paintBriefs(doc, root, { rerender, macro, id, frame, className, limits = {}, place }) {
  const nowMs = Date.now();
  const tiers = homeBriefTiers(ensureArtifact(root, rerender), { nowMs, ...limits });
  const briefs = [...tiers.core, ...tiers.notable];
  let host = doc.getElementById(id);
  if (!briefs.length && !macro.length && !tiers.rest.length) { if (host) host.hidden = true; return briefs; }
  if (!host) {
    host = el(doc, 'section', null, className);
    host.setAttribute('aria-labelledby', `${id}-title`);
    place(host);
  }
  const head = frameHead(doc, { title: '주요 발표 요약', titleId: `${id}-title`, titleClass: 'briefing-h2' });
  head.classList.add('daily-card-head');
  head.title = '시장 전체를 움직이는 발표(물가·고용 지표, FOMC, 대형주 실적)는 크게, 그 밖의 실적은 한 줄로 보여 줍니다. 원문 공시 기준, 시각은 한국 시간';
  markFrame(host, frame);
  const parts = [head, ...macro.map((release) => macroNode(doc, release)), ...tiers.core.map((brief) => briefNode(doc, brief))];
  if (tiers.notable.length) parts.push(el(doc, 'h3', '그 밖의 실적', 'event-briefs__tier2'), rowList(doc, root, tiers.notable));
  if (tiers.restTotal) {
    const fold = el(doc, 'details', null, 'event-briefs__all');
    fold.append(el(doc, 'summary', `지난 30일 발표 요약 ${tiers.restTotal}건 더 보기`), rowList(doc, root, tiers.rest));
    if (tiers.restTotal > tiers.rest.length) fold.append(el(doc, 'p', `최근 ${tiers.rest.length}건만 적었습니다. 다른 종목은 종목 화면에서 최근 실적 요약을 볼 수 있습니다.`, 'event-brief__note'));
    parts.push(fold);
  }
  host.replaceChildren(...parts);
  host.hidden = false;
  return briefs;
}

/** 거시: the latest official release of each monthly indicator (about a month), as cards under the page head. */
export function paintMacroReleaseCards(doc, page, releases = []) {
  let host = doc?.getElementById('macro-recent-releases');
  if (!releases.length) { if (host) host.hidden = true; return releases; }
  if (!host) {
    host = el(doc, 'section', null, 'briefing-block macro-section event-briefs');
    host.id = 'macro-recent-releases';
    host.setAttribute('aria-labelledby', 'macro-recent-releases-title');
    const head = page?.querySelector(':scope > .page-head');
    if (head) head.insertAdjacentElement('afterend', host); else page?.prepend(host);
  }
  const head = frameHead(doc, { title: '최근 공식 발표', titleId: 'macro-recent-releases-title', titleClass: 'briefing-h2' });
  head.title = '물가·고용·소비 월간 지표의 가장 최근 발표값과 다음 발표일입니다. 아래 경제 지표판과 같은 공식 수치';
  markFrame(host, 'macro.recent-releases');
  host.replaceChildren(head, ...releases.map((release) => macroNode(doc, release)));
  host.hidden = false;
  return releases;
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
