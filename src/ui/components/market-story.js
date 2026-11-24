// 시장 상태 › 시나리오와 전망's last card — 무슨 일이 있었나. One picture (one week of moves on the shared two-sided bar, STORY_SESSIONS),
// one reading (domain/market/story/market-story.js), the week-ahead list on the face, and one raw-table fold with the
// asset-by-asset confirmation and the earnings reactions. The week-ahead list owns the next release on this page; the 다음에 확인할 것
// card below keeps the two price checks.
import { buildMarketStory, buildMarketOpening, fallStandings } from '../../domain/market/story/market-story.js';
import { LONGRUN_DEFINITION } from '../../domain/market/indices/long-run.js';
import { fallBars } from './fall-bars.js';
import { RULES } from '../../domain/rules/thresholds.js';
import { refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { signedFill, signedScale, signedTrack } from './signed-bar.js';
import { frameHead, frameReading, markFrame } from './section-frame.js';
import { openRouteSection } from './page-flow.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { FOLLOW_THROUGH_WORDS } from '../../domain/content/rebound-words.js';
import { el } from './dom.js';
import { askRow } from './ask-row.js';
import { foldSummary, markFold } from './indicator-face.js';
import { signedText, directionOf } from '../../domain/shared/number.js';
import { EARNINGS_CALENDAR, EVENT_BRIEFS, MARKET_DAY, INDEX_LONGRUN } from '../../data/artifact-registry.js';

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
      el(doc, 'span', signedText(row.pct, 1, '%'), 'briefing-move-value'));
    wrap.append(line);
  }
  return wrap;
}

function weekList(doc, root, story) {
  if (!story.week.length) return null;
  const box = el(doc, 'div', null, 'mk-story__week');
  box.append(el(doc, 'h3', '다음 주 판단을 바꿀 일정', 'mk-story__sub'));
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
function questionRow(doc, story) {
  const fell = story.moves.ndx.pct < 0;
  const events = story.week.filter((item) => item.kind !== 'daily').map((item) => item.names || item.title).slice(0, 4).join(', ');
  const questions = [
    [fell ? '하락 원인' : '상승 원인', `최근 ${story.sessions}거래일 대형 기술주가 왜 ${fell ? '빠졌는지' : '올랐는지'} 실적 발표와 뉴스를 근거로 설명해줘`],
    ['AI 투자 흐름', '빅테크 설비투자 전망과 AI 투자 대비 수익 논쟁이 지금 어디까지 왔는지 정리해줘'],
    events ? ['다음 주 시나리오', `다음 주 ${events}의 결과별로 시장이 어떻게 반응할 수 있는지 정리해줘`] : null
  ].filter(Boolean);
  return askRow(doc, questions, 'mk-story__ask');
}

function detailFold(doc, story) {
  //  the rows behind the reading — the levels' reading itself is on the face (renderMarketStory).
  const fold = markFold(el(doc, 'details', null, 'mk-story__more'), 'raw-table');
  fold.append(foldSummary(doc, 'raw-table', `${story.levels ? '차트 위치, ' : ''}금리·신용·유가·금·한국 확인과 실적 반응`));
  if (story.levels) {
    fold.append(el(doc, 'h3', '차트 위 지수의 위치', 'mk-story__sub'));
    const list = el(doc, 'dl', null, 'mk-story__checks');
    for (const row of story.levels.rows) {
      const item = el(doc, 'div', null, 'mk-story__check');
      item.dataset.level = row.id;
      item.append(el(doc, 'dt', row.label), el(doc, 'dd', row.value, 'mk-story__value'));
      list.append(item);
    }
    fold.append(list);
  }
  if (story.checks.length) {
    fold.append(el(doc, 'h3', '다른 자산의 확인', 'mk-story__sub'));
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
      const direction = directionOf(row.pct, 1);
      const move = el(doc, 'td', signedText(row.pct, 1, '%'), direction === 'up' ? 'is-up' : direction === 'down' ? 'is-down' : '');
      tr.append(el(doc, 'td', `${row.name} ${shortDate(row.date)}`), move, el(doc, 'td', row.reason || '보도된 이유 없음'), el(doc, 'td', row.capex || '—'));
      body.append(tr);
    }
    table.append(body);
    const scroll = el(doc, 'div', null, 'mk-story__table');
    scroll.append(table);
    fold.append(scroll);
  }
  return fold;
}

// The story with the artifacts it reads, and the key that changes when any of them does. 오늘's next-event line reads the
// same story (home-ahead.js), so the two screens name the same week ahead.
export function readMarketStory(root, interpretation, rerender) {
  const briefs = ensure(root, EVENT_BRIEFS, rerender);
  const calendar = ensure(root, EARNINGS_CALENDAR, rerender);
  // The market-day stories' movers — a report one of them is about joins the week list whatever its weight.
  const day = ensure(root, MARKET_DAY, rerender);
  const storySymbols = new Map();
  for (const item of Array.isArray(day?.narratives?.stories) ? day.narratives.stories : []) {
    for (const mover of Array.isArray(item?.movers) ? item.movers : []) if (mover?.sym && !storySymbols.has(mover.sym)) storySymbols.set(mover.sym, item.label);
  }
  const events = Array.isArray(interpretation?.crossroads?.events) ? interpretation.crossroads.events : [];
  const macroHistory = root?._aioMacroHistory || null;
  const history = interpretation?.inputs?.history || root?._aioHistory || [];
  const key = [history.at?.(-1)?.date, briefs?.generatedAt, calendar?.generatedAt, macroHistory?.generatedAt || (macroHistory ? 'loaded' : ''), interpretation?.crossroads?.nextEvent?.id, events.map((e) => `${e.id}:${e.date}`).join(','), day?.generatedAt || ''].join('|');
  // Built on demand: a render whose key has not changed keeps its card and skips the build.
  const build = () => buildMarketStory({ history, macroHistory, briefs, calendar, nextEvent: interpretation?.crossroads?.nextEvent || null, decidingEvent: interpretation?.crossroads?.decidingEvent || null, events, storySymbols });
  return { key, build };
}

// ---- v60.50: the opening read on the faces of 오늘 and 시장 상태 ----------------------------------------
// The domain (buildMarketOpening) owns every sentence; this paints its lines. The long-run tables (index-longrun.json,
// weekly) join when published; without them the sentences fall back to the record history.json holds.
let openingMemo = null;
export function readMarketOpening(root, interpretation, rerender) {
  const longrun = ensure(root, INDEX_LONGRUN, rerender);
  const history = interpretation?.inputs?.history || root?._aioHistory || [];
  const macroHistory = interpretation?.inputs?.macroHistory || root?._aioMacroHistory || null;
  const key = [history.at?.(-1)?.date, history.length, macroHistory?.generatedAt || (macroHistory ? 'loaded' : ''), longrun?.generatedAt || ''].join('|');
  if (openingMemo?.key !== key || openingMemo.history !== history) openingMemo = { key, history, opening: buildMarketOpening({ history, macroHistory, longrun }) };
  return openingMemo.opening;
}

/** One face line: the lede, the diagnosis (its state word first) or the small record line. */
function openingLine(doc, line) {
  const p = el(doc, 'p', null, 'opening-line');
  p.dataset.part = line.id;
  if (line.label) p.append(el(doc, 'b', line.label, 'opening-line__label'), doc.createTextNode(' — '));
  p.append(doc.createTextNode(line.said.text));
  return p;
}

/** The face into `host`: the lede, the bars, the diagnosis line, the rebound's paragraph and the small record line. */
// With `tail` (시장 상태, where the verdict follows the diagnosis) the lines after the diagnosis go there instead.
export function paintOpening(doc, host, opening, tail = null) {
  if (!host || !opening?.available || !opening.lines?.length) return false;
  const [lede, ...rest] = opening.lines;
  const after = tail ? rest.filter((line) => line.id !== 'diagnosis') : [];
  host.replaceChildren(openingLine(doc, lede), fallBars(doc, opening.bars, `종가 고점 대비 하락, ${shortDate(opening.asOf)} 기준`),
    ...rest.filter((line) => !after.includes(line)).map((line) => openingLine(doc, line)));
  host.dataset.asOf = opening.asOf;
  host.hidden = false;
  if (tail) { tail.replaceChildren(...after.map((line) => openingLine(doc, line))); tail.hidden = false; }
  return true;
}

/** 오늘: the opening leads the hero. Until the closes load, the shell's #home-hero-first shows the produced record's lines;
 * a painted #home-hero-desc hides it (v2-today.css). */
export function renderHomeOpening({ documentRef: doc, root, interpretation, regime }) {
  const host = doc?.getElementById('home-hero-desc');
  if (!host || !regime?.available) return;
  const opening = readMarketOpening(root, interpretation, () => renderHomeOpening({ documentRef: doc, root, interpretation, regime }));
  if (!paintOpening(doc, host, opening)) host.textContent = regime.heroLine || '';
}

function openingFolds(doc, opening) {
  const raw = markFold(el(doc, 'details', null, 'mk-opening__more'), 'raw-table');
  raw.append(foldSummary(doc, 'raw-table', '지수별 하루·2거래일·5거래일 등락과 고점 대비'));
  const list = el(doc, 'ul', null, 'mk-opening__table');
  for (const row of opening.table) list.append(el(doc, 'li', row.said.text));
  raw.append(list);
  const S = RULES.story, C = RULES.credit, G = RULES.growth;
  const method = markFold(el(doc, 'details', null, 'mk-opening__method'), 'method');
  method.append(foldSummary(doc, 'method', '단계·진단·반등을 정하는 규칙'),
    el(doc, 'p', `단계: 종가 고점 대비 -${S.correctionPct}% 이하 조정, -${S.bearPct}% 이하 약세장, -${S.bearPct}%까지 ${S.bearEdgePp}%p 안이면 약세장 문턱, -${S.correctionPct}%보다 얕으면 조정 전. 첫 문장의 '시장 전체'는 S&P 500의 단계입니다. 막대는 같은 눈금이고 점선이 -${S.correctionPct}%와 -${S.bearPct}%입니다. 반도체는 필라델피아 반도체 지수(SOX), 고점은 ${opening.longrun ? '장기 기록의 종가 고점' : '이 화면 기록(2025-09-30 이후)의 종가 고점'}입니다.`, 'mk-story__read'),
    el(doc, 'p', `진단: 하이일드 스프레드 ${C.stressAtBp}bp 이상이면 금융 불안형. 실업률 3개월 평균이 1년 저점보다 ${G.sahmRecessionAt}%p 이상 높거나 실업수당 청구가 1년 저점보다 ${G.claimsRiseAbovePct}% 이상 많고, 나스닥 100과 동일가중의 고점 대비 낙폭 차이가 ${S.unwindGapPp}%p 미만이거나 50일선 위 종목이 ${S.broadBelowPct}% 미만이면 침체형. 나스닥 100이 동일가중보다 ${S.unwindGapPp}%p 이상 더 내렸으면 쏠림 되돌림, 그 밖에는 판단 보류. 신용 스프레드(하이일드)가 5거래일 +${C.widen5dBp}bp 이상 벌어지면 '빠르게 확대 중'을 덧붙입니다. 나스닥 100이나 동일가중이 고점 뒤 -${S.correctionPct}%에 닿은 적이 없으면 진단하지 않습니다.`, 'mk-story__read'),
    el(doc, 'p', `반등: 나스닥 100이 고점 뒤 -${S.correctionPct}%에 닿은 하락 안에서, 가장 낮은 종가보다 ${S.reboundPct}% 이상 높게 마감하면 반등 시도이고 그 저점이 지켜지는 동안 이어집니다. 그 뒤 S&P 500과 나스닥 100이 함께 50일선과 200일선 위로 마감하면 추세 회복이며, 둘 다 200일선 위에 있는 동안 이어집니다. 반등이 시작된 저점 아래로 마감한 날은 반등 실패입니다. ${FOLLOW_THROUGH_WORDS.name}는 다른 지수인 나스닥 종합의 종가와 거래량으로 셉니다(저점 뒤 ${RULES.rallyAttempt.minDay}일째부터 하루 ${RULES.rallyAttempt.gainPct}% 이상 오르며 거래량이 전날보다 많은 날). 50일선·200일선은 최근 50·200거래일 종가의 평균입니다.`, 'mk-story__read'),
    el(doc, 'p', '이 기준들은 시장에서 흔히 쓰는 관행이며, 과거 자료로 검증한 예측 규칙이 아닙니다.', 'mk-story__read'));
  return [raw, method];
}

/**
 * 시장 상태: the opening under the page head (지금 view), its table and rules folded; 한국 gets the KOSPI line. The face
 * says the rebound (conditions and stance) as on 오늘; `onWatch` hands the rebound to market-regime.js, whose 다음에 확인할
 * 가격 조건 list leads with its rows (with their distances) and whose guide takes its stance.
 */
export function renderSignalOpening({ documentRef: doc, root, interpretation, onWatch = null }) {
  const host = doc?.getElementById('regime-opening');
  if (!host) return;
  const opening = readMarketOpening(root, interpretation, () => renderSignalOpening({ documentRef: doc, root, interpretation, onWatch }));
  onWatch?.(opening?.available ? opening.rebound || null : null);
  let tail = doc.getElementById('regime-opening-more');
  const verdictEnd = doc.getElementById('regime-previous');
  if (!tail && verdictEnd) { tail = el(doc, 'div', null, 'mk-opening'); tail.id = 'regime-opening-more'; tail.hidden = true; verdictEnd.after(tail); }
  const painted = paintOpening(doc, host, opening, tail);
  if (!painted && tail) tail.hidden = true;
  host.closest?.('.mk-hero')?.classList.toggle('has-opening', painted);
  if (painted) {
    const wasOpen = [...host.parentElement.querySelectorAll(':scope > .mk-opening__more, :scope > .mk-opening__method')].map((fold) => fold.open);
    host.parentElement.querySelectorAll(':scope > .mk-opening__more, :scope > .mk-opening__method').forEach((fold) => fold.remove());
    const folds = openingFolds(doc, opening);
    folds.forEach((fold, i) => { if (wasOpen[i]) fold.open = true; });
    (tail || host).after(...folds);
  }
  const board = doc.getElementById('regime-board-kr');
  if (board && opening?.korea?.text) {
    let line = doc.getElementById('regime-opening-kr');
    if (!line) { line = el(doc, 'p', null, 'opening-line mk-opening-kr'); line.id = 'regime-opening-kr'; board.before(line); }
    line.replaceChildren(el(doc, 'b', '한국', 'opening-line__label'), doc.createTextNode(` ${opening.korea.text}`));
  }
}

/**
 * 기술적 분석 › 시장 지수: under the index cards, where this fall stands among each index's past falls of 10% or more
 * (domain fallStandings over the long-run tables). The Nasdaq-100 (the centre index) leads with its line and its episode
 * strip; the other indexes' lines follow, their strips in the raw-table fold. Hidden without the long-run tables.
 */
export function renderIndexStandings({ documentRef: doc, root, host }) {
  if (!host) return;
  const opening = readMarketOpening(root, null, () => renderIndexStandings({ documentRef: doc, root, host }));
  const standings = fallStandings(opening);
  host.hidden = !standings.length;
  if (!standings.length) { host.replaceChildren(); return; }
  const [lead, ...rest] = standings;
  const strip = (row) => fallBars(doc, row.bars, `${row.label} 고점 대비 하락과 고점→저점 거래일, ${shortDate(row.asOf)} 종가 기준`);
  const wasOpen = host.querySelector('.charts-standings__more')?.open;
  const fold = markFold(el(doc, 'details', null, 'charts-standings__more'), 'raw-table');
  fold.append(foldSummary(doc, 'raw-table', '지수별 과거 하락 구간'), ...rest.map(strip));
  if (wasOpen) fold.open = true;
  const method = markFold(el(doc, 'details', null, 'charts-standings__method'), 'method');
  method.append(foldSummary(doc, 'method', '하락 구간을 세는 방법'),
    el(doc, 'p', `하락 구간: 종가 기준 사상 최고치에서 다시 그 값을 회복하기 전까지의 가장 낮은 종가가 ${LONGRUN_DEFINITION.drawdownMinPct}% 이상 아래였던 구간입니다. 순위는 이번 고점 대비 하락(마지막 종가)을 과거 구간의 가장 깊은 하락과 비교합니다. 막대 옆 거래일은 고점에서 저점까지입니다. 지수 가격만 쓰고 배당은 넣지 않습니다.`, 'mk-story__read'));
  const [first, ...lines] = standings.map((row) => { const p = el(doc, 'p', row.said.text, 'opening-line'); p.dataset.index = row.id; return p; });
  host.replaceChildren(el(doc, 'h3', '지난 하락과 비교', 'charts-group-title'), first, strip(lead), ...lines, fold, method);
}

export function renderMarketStory({ documentRef: doc, root, interpretation }) {
  // The card is built here (not in the shell) and closes the 시나리오와 전망 view: the scenarios, the guide and the stories
  // come first, the recap of what moved after them.
  let section = doc?.getElementById('regime-story');
  if (!section) {
    const depth = doc?.querySelector?.('#page-signal > .mk-depth');
    if (!depth) return null;
    section = el(doc, 'section', null, 'sx-card mk-story');
    section.id = 'regime-story';
    section.setAttribute('aria-labelledby', 'regime-story-title');
    section.hidden = true;
    depth.after(section);
  }
  const { key, build } = readMarketStory(root, interpretation, () => renderMarketStory({ documentRef: doc, root, interpretation }));
  if (section.dataset.signature === key && section.childElementCount) return section;
  const story = build();
  section.hidden = !story.available;
  if (!story.available) { section.replaceChildren(); return section; }
  const wasOpen = section.querySelector('.mk-story__more')?.open;
  const grid = el(doc, 'div', null, 'mk-story__grid');
  const reading = el(doc, 'div', null, 'mk-story__reading');
  reading.append(frameReading(doc, story.lead));
  if (story.levels?.read) reading.append(el(doc, 'p', story.levels.read, 'mk-story__read'));
  grid.append(bars(doc, story), reading);
  const fold = detailFold(doc, story);
  if (wasOpen) fold.open = true;
  section.replaceChildren(frameHead(doc, { title: '무슨 일이 있었나', titleId: 'regime-story-title', asOf: `최근 ${story.sessions}거래일`, asOfDetail: `${story.start} 종가부터 ${story.asOf} 종가까지, 미국 정규장 기준` }),
    grid, weekList(doc, root, story) || '', questionRow(doc, story), fold);
  markFrame(section, 'signal.story');
  section.dataset.signature = key;
  return section;
}
