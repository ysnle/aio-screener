// v59.67 (owner 2026-11-03, phase 5): 홈's 오늘의 핵심 — the short version of 브리핑's 24-hour account. The three most
// material stories, one line each, and the stocks that moved the most by the ledger's own ranking (a mega-cap's pull on the
// S&P 500 counts as much as a small name's surprise). The same model as 브리핑 (src/domain/briefing/day-account.js), so
// the two screens cannot disagree on what mattered.
import { MARKET_DAY, refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { buildDayAccount } from '../../domain/briefing/day-account.js';
import { signedText } from '../../domain/shared/number.js';
import { el } from './dom.js';

const RANK_ORDER = Object.freeze({ lead: 0, major: 1, minor: 2, context: 3 });

/** The day's material stock moves, ledger order, each once. */
export function keyStocks(day, limit = 8) {
  const facts = Array.isArray(day?.facts) ? day.facts : [];
  const seen = new Set();
  return facts.filter((fact) => fact.kind === 'stock-move' && (['lead', 'major'].includes(fact.rank) || Math.abs(fact.indexBp || 0) >= 8))
    .sort((a, b) => (RANK_ORDER[a.rank] ?? 9) - (RANK_ORDER[b.rank] ?? 9) || (b.materiality || 0) - (a.materiality || 0))
    .filter((fact) => { const sym = fact.subjects?.[0]; if (!sym || seen.has(sym)) return false; seen.add(sym); return true; })
    .slice(0, limit).map((fact) => ({ sym: fact.subjects[0], label: fact.label, change: fact.change, indexBp: fact.indexBp ?? null }));
}

export function renderHomeDay({ documentRef: doc, root }) {
  const section = doc?.getElementById('home-day');
  if (!section) return;
  const day = root?.[MARKET_DAY.key] || null;
  if (root && !day) refreshSharedArtifact(root, MARKET_DAY).then(({ changed }) => { if (changed) renderHomeDay({ documentRef: doc, root }); }).catch(() => {});
  const account = buildDayAccount(day);
  section.hidden = !account.available;
  if (!account.available || section.dataset.renderKey === String(day.generatedAt)) return;
  section.dataset.renderKey = String(day.generatedAt);
  const head = el(doc, 'div', null, 'sx-card__head home-day__head');
  head.append(el(doc, 'h2', '오늘의 핵심', 'sx-card__title'), el(doc, 'span', account.coverage.session ? `미국 ${account.md(account.coverage.session)} 마감까지` : '', 'home-day__basis'));
  head.querySelector('h2').id = 'home-day-title';
  const list = el(doc, 'ol', null, 'home-day__stories');
  for (const story of account.stories.slice(0, 3)) {
    const item = el(doc, 'li', null, `home-day__story is-${story.rank}`);
    item.append(el(doc, 'b', story.title, 'home-day__title'), el(doc, 'span', story.line, 'home-day__line'));
    list.append(item);
  }
  const parts = [head, list];
  const stocks = keyStocks(day);
  if (stocks.length) {
    const row = el(doc, 'div', null, 'home-day__stocks');
    row.setAttribute('role', 'group');
    row.setAttribute('aria-label', '크게 움직인 종목');
    row.append(el(doc, 'span', '크게 움직인 종목', 'home-day__stocks-label'));
    for (const stock of stocks) {
      const chip = el(doc, 'button', null, `home-day__stock ${stock.change >= 0 ? 'is-up' : 'is-down'}`);
      chip.type = 'button';
      chip.dataset.action = 'aioOpenMarketChart';
      chip.dataset.arg = stock.sym;
      chip.title = `${stock.label}${Number.isFinite(stock.indexBp) && Math.abs(stock.indexBp) >= 5 ? `, S&P 500에 ${signedText(stock.indexBp, 0, 'bp')}` : ''}`;
      chip.append(el(doc, 'b', stock.sym), el(doc, 'span', signedText(stock.change, 1, '%')));
      row.append(chip);
    }
    parts.push(row);
  }
  const more = el(doc, 'button', `지난 24시간 전체 ${account.stories.length + account.more.length}건 → 브리핑`, 'flow-next-link');
  more.type = 'button';
  more.dataset.action = 'showPage';
  more.dataset.arg = 'briefing';
  parts.push(more);
  section.replaceChildren(...parts);
}
