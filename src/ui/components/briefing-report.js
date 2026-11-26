// 브리핑 as one report, top to bottom: the kicker line, the hero figure, the headline with its marked word, the three short
// lines, the five-session sequence, the basis week and the fine print. The values come from the domain
// (domain/briefing/briefing-report.js over the opening read); this file only lays them out in the static slots of
// #page-briefing. A slot whose value is missing hides, or prints the missing mark — never a 0.
import { el } from './dom.js';
import { signedBar } from './signed-bar.js';
import { readMarketOpening } from './market-story.js';
import { reportHero, reportHeadline, reportLines, sessionSequence, weekRows, finePrint, dayName } from '../../domain/briefing/briefing-report.js';
import { marketClock } from '../../domain/market/session/session-bridge.js';
import { sessionNotices, sessionNoticeText } from '../../domain/market/session/session-notice.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { signedText } from '../../domain/shared/number.js';
import { BRIEFING_REPORT_WORDS as W } from '../../domain/content/briefing-report-words.js';
import { buildDayAccount } from '../../domain/briefing/day-account.js';
import { oneSessionDay } from '../../domain/market/day/one-session.js';
import { EVENT_BRIEFS, MARKET_DAY, INDEX_LONGRUN } from '../../data/artifact-registry.js';

const SVG = 'http://www.w3.org/2000/svg';

const show = (node, on) => { if (node) node.hidden = !on; return node; };
const level = (value) => value.toLocaleString('en-US', { maximumFractionDigits: 0 });

/** The kicker after the page's date line: the US session state now, then the exchange notice when there is one. */
export function kickerNote(nowMs = Date.now()) {
  const parts = [marketClock(nowMs).us?.label, sessionNoticeText(sessionNotices(nowMs))].filter(Boolean);
  return parts.length ? ` · ${parts.join(' · ')}` : '';
}

function paintHero(doc, hero) {
  const host = doc.getElementById('briefing-hero');
  if (!show(host, !!hero)) return;
  const figure = el(doc, 'p', null, 'br-hero__figure');
  figure.append(el(doc, 'span', `${hero.label}, ${shortDate(hero.asOf)}`, 'br-hero__label'), el(doc, 'span', hero.text, 'br-hero__number'));
  const side = el(doc, 'div', null, 'br-hero__side');
  side.append(el(doc, 'p', hero.word || '', `br-hero__state is-${hero.direction}`));
  if (hero.subs.length) {
    const subs = el(doc, 'p', null, 'br-hero__subs');
    hero.subs.forEach((sub, index) => {
      if (index) subs.append(doc.createTextNode(' · '));
      subs.append(doc.createTextNode(`${sub.label} `), el(doc, 'b', sub.text));
    });
    side.append(subs);
  }
  host.replaceChildren(figure, side);
}

function paintHeadline(doc, headline) {
  const host = doc.getElementById('briefing-headline');
  if (!show(host, !!headline)) return;
  if (!headline.accent) { host.textContent = headline.text; return; }
  const [start, end] = headline.accent;
  host.replaceChildren(doc.createTextNode(headline.text.slice(0, start)), el(doc, 'em', headline.text.slice(start, end), 'br-accent'), doc.createTextNode(headline.text.slice(end)));
}

function paintLines(doc, lines) {
  const host = doc.getElementById('briefing-lines');
  if (!show(host, lines.length > 0)) return;
  host.replaceChildren(...lines.map((line) => {
    const li = el(doc, 'li', null, `br-line${line.tint ? ' is-tint' : ''}`);
    li.dataset.line = line.id;
    li.append(el(doc, 'b', line.key, 'br-line__key'), el(doc, 'span', line.text, 'br-line__text'));
    return li;
  }));
}

// The sessions on an ordinal axis — one equal step per session, so each point sits over its column of the row beneath
// (trend-chart.js places points by calendar date, and a weekend opened a gap). The line is SVG at the plot's own size;
// the dots and value labels are HTML at the same percentages, so their text keeps its size at any width.
function sequencePlot(doc, points) {
  const values = points.map((point) => point.value);
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
  const x = (index) => ((index + 0.5) / points.length) * 100;
  const y = (value) => 22 + (1 - (value - lo) / span) * 56;
  const plot = el(doc, 'div', null, 'br-seq__plot');
  plot.setAttribute('role', 'img');
  plot.setAttribute('aria-label', `S&P 500 종가, ${points.map((point) => `${dayName(point.date)} ${level(point.value)}`).join(', ')}`);
  const svg = doc.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('class', 'br-seq__svg');
  svg.setAttribute('aria-hidden', 'true');
  const path = doc.createElementNS(SVG, 'path');
  path.setAttribute('d', points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(2)},${y(point.value).toFixed(2)}`).join(' '));
  path.setAttribute('class', 'br-seq__line');
  path.setAttribute('vector-effect', 'non-scaling-stroke');
  svg.append(path);
  plot.append(svg);
  points.forEach((point, index) => {
    const at = (node) => { node.style.left = `${x(index).toFixed(2)}%`; node.style.top = `${y(point.value).toFixed(2)}%`; return node; };
    // A close below the one before carries its label under the point.
    const below = index > 0 && point.value < points[index - 1].value;
    plot.append(at(el(doc, 'span', null, 'br-seq__dot')), at(el(doc, 'span', level(point.value), `br-seq__label${below ? ' is-below' : ''}`)));
  });
  return plot;
}

function paintSequence(doc, sequence) {
  const section = doc.getElementById('briefing-sequence');
  if (!show(section, !!sequence)) return;
  doc.getElementById('briefing-sequence-note').textContent = `${shortDate(sequence.from)}~${shortDate(sequence.asOf)} 종가`;
  const points = sequence.points;
  const row = el(doc, 'ol', null, 'br-seq__row');
  row.setAttribute('aria-label', '거래일별 미 10년 금리 종가');
  for (const point of points) {
    const li = el(doc, 'li', null, 'br-seq__cell');
    li.append(el(doc, 'span', point.tnx == null ? W.missing : `${point.tnx.toFixed(2)}%`, 'br-seq__value'), el(doc, 'span', dayName(point.date), 'br-seq__date'));
    row.append(li);
  }
  const caption = el(doc, 'figcaption', `S&P 500 종가, 아래 줄은 미 10년 금리. 5거래일 S&P 500 ${signedText(sequence.change, 1, '%')}${sequence.tnxChange == null ? '' : `, 미 10년 ${signedText(sequence.tnxChange, 0, 'bp')}`}.`, 'br-caption');
  doc.getElementById('briefing-sequence-figure').replaceChildren(sequencePlot(doc, points), row, caption);
}

function paintWeek(doc, week) {
  const list = doc.getElementById('briefing-week-rows');
  const section = doc.getElementById('briefing-week-section');
  if (!list || !section) return;
  if (!week) { list.replaceChildren(); return; }
  doc.getElementById('briefing-week-note').textContent = `${shortDate(week.rows[0].date)}~${shortDate(week.rows.at(-1).date)}, 미국`;
  list.replaceChildren(...week.rows.map((row) => {
    const li = el(doc, 'li', null, `br-week__row is-${row.kind}`);
    li.dataset.date = row.date;
    li.append(el(doc, 'span', row.label, 'br-week__day'), el(doc, 'span', row.word, `br-week__word${row.kind === 'session' && Number.isFinite(row.move) ? ` is-${row.move > 0 ? 'up' : row.move < 0 ? 'down' : 'flat'}` : ''}`));
    if (row.kind === 'session') {
      li.append(Number.isFinite(row.move) ? signedBar(doc, row.move, week.scale, { trackClass: 'br-week__bar' }) : el(doc, 'span', null, 'br-week__bar is-empty'),
        el(doc, 'span', Number.isFinite(row.move) ? signedText(row.move, 1, '%') : W.missing, 'br-week__move'));
    }
    const note = row.kind === 'ahead'
      ? [...row.events, row.reports ? `주요 실적 ${row.reports}곳` : ''].filter(Boolean).join(', ')
      : row.note?.text || '';
    if (note) li.append(el(doc, 'p', note, 'br-week__note'));
    return li;
  }));
}

function paintFine(doc, tiles) {
  const grid = doc.getElementById('briefing-fine-grid');
  if (!grid) return;
  grid.replaceChildren(...tiles.map((tile) => {
    const item = el(doc, 'div', null, `br-fine__item${tile.value == null ? ' is-missing' : ''}`);
    item.dataset.fact = tile.id;
    const gloss = tile.value == null ? W.missingGloss : [tile.gloss, tile.behind && tile.date ? `${shortDate(tile.date)} 기준` : ''].filter(Boolean).join(', ');
    item.append(el(doc, 'dt', tile.label, 'br-fine__label'), el(doc, 'dd', tile.value ?? W.missing, 'br-fine__value'), el(doc, 'dd', gloss, 'br-fine__gloss'));
    return item;
  }));
}

/**
 * Paints the report slots. `interpretation` is the shared read (marketInterpretation), `schedule` the briefing schedule
 * rows, `rerender` repaints once a lazily loaded input (the long-run tables, the session ledger) arrives.
 * @returns {{opening: object, week: object|null}} what was painted, for the caller's next-check line and tests.
 */
export function renderBriefingReport({ documentRef: doc, root, interpretation, read, schedule = [], nowMs = Date.now(), rerender = () => {} }) {
  if (!doc?.getElementById('briefing-report')) return null;
  const note = doc.getElementById('briefing-kicker-note');
  if (note) note.textContent = kickerNote(nowMs);
  const history = interpretation?.inputs?.history || root?._aioHistory || [];
  const opening = readMarketOpening(root, interpretation, rerender);
  const hero = reportHero(opening, history);
  paintHero(doc, hero);
  paintHeadline(doc, reportHeadline(opening));
  // The day ledger (loaded by readMarketOpening): its lead story stands in for the 'gathered' line on a quiet session,
  // and its ranks decide which earnings reaction a week row may name.
  const day = root?.[MARKET_DAY.key] || null;
  const briefs = root?.[EVENT_BRIEFS.key] || null;
  const account = day ? buildDayAccount(oneSessionDay(day, history), { briefs, history, longrun: root?.[INDEX_LONGRUN.key] || null }) : null;
  paintLines(doc, reportLines({ opening, nextEvent: interpretation?.crossroads?.nextEvent || null, checks: read?.checks || [], lead: account?.available ? account.stories[0] || null : null }));
  const asOf = (opening?.available && opening.asOf) || read?.asOf || null;
  paintSequence(doc, sessionSequence(history, asOf));
  const week = weekRows({ history, briefs, day, schedule, asOf });
  paintWeek(doc, week);
  paintFine(doc, finePrint({ history, macroHistory: interpretation?.inputs?.macroHistory || root?._aioMacroHistory || null, credit: interpretation?.inputs?.credit || null, asOf, cross: opening?.available ? opening.cross : null }));
  return { opening, week };
}
