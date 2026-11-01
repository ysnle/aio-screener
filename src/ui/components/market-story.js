// v59.55 (owner 11/1): 시장 상태's first card — 무슨 일이 있었나. One picture (15-session moves on the shared two-sided bar),
// one reading (domain/market/market-story.js), the week-ahead list on the face, and one fold with the asset-by-asset
// confirmation and the earnings reactions. The week-ahead list owns the next release on this page; the 다음에 확인할 것
// card below keeps the two price checks.
import { buildMarketStory } from '../../domain/market/market-story.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { EVENT_BRIEFS, EARNINGS_CALENDAR } from '../../data/event-artifacts.js';
import { signedFill, signedScale, signedTrack } from './signed-bar.js';
import { frameHead, frameReading, markFrame } from './section-frame.js';
import { openRouteSection } from './page-flow.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { el } from './dom.js';

function ensure(root, artifact, rerender) {
  refreshSharedArtifact(root, artifact).then(({ changed } = {}) => { if (changed) rerender(); }).catch(() => {});
  return root?.[artifact.key] || null;
}

function bars(doc, story) {
  const wrap = el(doc, 'div', null, 'mk-story__bars');
  wrap.append(el(doc, 'div', `등락(%), ${shortDate(story.start)} 종가 → ${shortDate(story.asOf)} 종가`, 'briefing-move-head'));
  const max = signedScale(story.bars.map((row) => row.pct), 5);
  for (const row of story.bars) {
    const line = el(doc, 'div', null, 'briefing-move-row');
    line.dataset.group = row.group;
    line.append(el(doc, 'span', row.label, 'briefing-move-label'),
      signedTrack(doc, [signedFill(doc, row.pct, max, { className: row.group === 'other' ? 'is-other' : '' })], 'briefing-move-track'),
      el(doc, 'span', `${row.pct > 0 ? '+' : ''}${row.pct.toFixed(1)}%`, 'briefing-move-value'));
    wrap.append(line);
  }
  return wrap;
}

function weekList(doc, root, story) {
  if (!story.week.length) return null;
  const box = el(doc, 'div', null, 'mk-story__week');
  box.append(el(doc, 'h3', '다음 주 판단을 바꿀 것', 'mk-story__sub'));
  const list = el(doc, 'ol', null, 'mk-watch__list');
  story.week.forEach((row, index) => {
    const item = el(doc, 'li', null, 'mk-watch__item');
    item.dataset.kind = row.kind;
    const text = el(doc, 'span', null, 'mk-watch__text');
    text.append(el(doc, 'b', `${row.when} ${row.title}`), el(doc, 'span', row.why, 'mk-story__if'));
    item.append(el(doc, 'span', String(index + 1), 'mk-watch__num'), text);
    list.append(item);
  });
  const link = el(doc, 'button', '날짜별 전체 일정과 결과별 시나리오 → 브리핑', 'flow-next-link');
  link.type = 'button';
  link.addEventListener('click', () => openRouteSection(doc, root, 'briefing', 'briefing-checks'));
  box.append(list, link);
  return box;
}

// Three questions that start from this card's own story (the shared _aioAskInPanel chips, as on the theme pages).
function askRow(doc, story) {
  const row = el(doc, 'div', null, 'aio-ask-row mk-story__ask');
  row.append(el(doc, 'span', 'AI에게 묻기', 'sh-muted-text'));
  const fell = story.moves.ndx.pct < 0;
  const events = story.week.filter((item) => item.kind !== 'daily').map((item) => item.title.replace(/\s*\(S&P 500 비중[^)]*\)/, '')).slice(0, 4).join(', ');
  const questions = [
    [fell ? '왜 빠졌나' : '왜 올랐나', `최근 ${story.sessions}거래일 대형 기술주가 왜 ${fell ? '빠졌는지' : '올랐는지'} 실적 발표와 뉴스를 근거로 설명해줘`],
    ['AI 투자 흐름', '빅테크 설비투자 전망과 AI 투자 대비 수익 논쟁이 지금 어디까지 왔는지 정리해줘'],
    events ? ['다음 주 시나리오', `다음 주 ${events}의 결과별로 시장이 어떻게 반응할 수 있는지 정리해줘`] : null
  ].filter(Boolean);
  for (const [label, question] of questions) {
    const chip = el(doc, 'button', label, 'q-chip');
    chip.type = 'button';
    chip.dataset.action = '_aioAskInPanel';
    chip.dataset.arg = question;
    row.append(chip);
  }
  return row;
}

function detailFold(doc, story) {
  const fold = el(doc, 'details', null, 'sx-disclosure aio-frame-more mk-story__more');
  fold.append(el(doc, 'summary', '자세히 — 금리·신용·유가·금·한국 확인과 실적 반응'));
  if (story.checks.length) {
    fold.append(el(doc, 'h3', '다른 자산도 같은 이야기를 하나', 'mk-story__sub'));
    const list = el(doc, 'dl', null, 'mk-story__checks');
    for (const row of story.checks) {
      const item = el(doc, 'div', null, 'mk-story__check');
      item.dataset.check = row.id;
      item.append(el(doc, 'dt', row.label), el(doc, 'dd', row.value, 'mk-story__value'), el(doc, 'dd', row.read, 'mk-story__read'));
      list.append(item);
    }
    fold.append(list);
  }
  if (story.earnings.length) {
    fold.append(el(doc, 'h3', '실적 발표 다음 날 주가와 보도된 이유', 'mk-story__sub'));
    const table = el(doc, 'table', null, 'mk-story__earnings');
    const head = el(doc, 'tr');
    for (const label of ['종목', '다음 날', '보도된 이유', '설비투자']) head.append(el(doc, 'th', label));
    table.append(el(doc, 'thead'));
    table.tHead.append(head);
    const body = el(doc, 'tbody');
    for (const row of story.earnings) {
      const tr = el(doc, 'tr');
      tr.dataset.symbol = row.symbol;
      const move = el(doc, 'td', `${row.pct > 0 ? '+' : ''}${row.pct.toFixed(1)}%`, row.pct > 0 ? 'is-up' : row.pct < 0 ? 'is-down' : '');
      tr.append(el(doc, 'td', `${row.name} ${shortDate(row.date)}`), move, el(doc, 'td', row.reason || '보도 근거를 찾지 못했습니다'), el(doc, 'td', row.capex || '—'));
      body.append(tr);
    }
    table.append(body);
    const scroll = el(doc, 'div', null, 'mk-story__table');
    scroll.append(table);
    fold.append(scroll);
  }
  return fold;
}

export function renderMarketStory({ documentRef: doc, root, interpretation }) {
  // The card is built here (not in the shell) and placed before the six-axis table: the story first, the scoring after it.
  let section = doc?.getElementById('regime-story');
  if (!section) {
    const axes = doc?.querySelector?.('#page-signal .mk-axes');
    if (!axes) return null;
    section = el(doc, 'section', null, 'sx-card mk-story');
    section.id = 'regime-story';
    section.setAttribute('aria-labelledby', 'regime-story-title');
    section.hidden = true;
    axes.before(section);
  }
  const again = () => renderMarketStory({ documentRef: doc, root, interpretation });
  const briefs = ensure(root, EVENT_BRIEFS, again);
  const calendar = ensure(root, EARNINGS_CALENDAR, again);
  const macroHistory = root?._aioMacroHistory || null;
  const history = interpretation?.inputs?.history || root?._aioHistory || [];
  const key = [history.at?.(-1)?.date, briefs?.generatedAt, calendar?.generatedAt, macroHistory?.generatedAt || (macroHistory ? 'loaded' : ''), interpretation?.crossroads?.nextEvent?.id].join('|');
  if (section.dataset.signature === key && section.childElementCount) return section;
  const story = buildMarketStory({ history, macroHistory, briefs, calendar, nextEvent: interpretation?.crossroads?.nextEvent || null });
  section.hidden = !story.available;
  if (!story.available) { section.replaceChildren(); return section; }
  const wasOpen = section.querySelector('.mk-story__more')?.open;
  const grid = el(doc, 'div', null, 'mk-story__grid');
  const reading = el(doc, 'div', null, 'mk-story__reading');
  reading.append(frameReading(doc, story.lead));
  grid.append(bars(doc, story), reading);
  const fold = detailFold(doc, story);
  if (wasOpen) fold.open = true;
  section.replaceChildren(frameHead(doc, { title: '무슨 일이 있었나', titleId: 'regime-story-title', asOf: `최근 ${story.sessions}거래일`, asOfDetail: `${story.start} 종가부터 ${story.asOf} 종가까지, 미국 정규장 기준` }),
    grid, weekList(doc, root, story) || '', askRow(doc, story), fold);
  markFrame(section, 'signal.story');
  doc.querySelector('#regime-watch .is-release')?.remove(); // the week list above carries the release now
  section.dataset.signature = key;
  return section;
}
