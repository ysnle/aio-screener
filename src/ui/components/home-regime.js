// The 오늘 hero: the six-axis verdict word, its one sentence, the Korea close line and the F&G day change. Its own module
// (moved unchanged out of market-regime.js) so 오늘 does not download the 시장 상태 board — the axis rows, radar,
// crossroads, guide and deep dives — which loads with the signal route (src/app/bootstrap.js).
import { buildCloseSeries, closeBasis, sessionPointBack } from '../../domain/briefing/market-read.js';
import { krSeparateCheckTone } from '../../domain/market/korea/kr-index-record.js';
import { marketInterpretation } from '../../data/selectors/interpretation.js';
import { refreshSharedArtifact, sharedArtifactIsStale } from '../../data/shared-artifacts.js';
import { buildKoreaIndexSeries } from '../../domain/market/regime/regime-scenarios.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { signedText } from '../../domain/shared/number.js';
import { historyWaitText } from './data-state.js';
import { MACRO_HISTORY } from '../../data/artifact-registry.js';

export function summaryLine(regime) {
  const { favorable, neutral, burden, unknown } = regime.counts;
  return `양호 ${favorable}, 중립 ${neutral}, 부담 ${burden}${unknown ? `, 확인 불가 ${unknown}` : ''}`;
}

// Home reads the same credit axis (20-session HY change from macro-history) as 시장 상태; without it home
// showed '집중 유지 4/4' with credit '양호' while 시장 상태 showed 3/4 with credit '중립'.
export function requestRegimeMacroHistory(root, doc, pageId, rerender) {
  if (!sharedArtifactIsStale(root, MACRO_HISTORY.key, MACRO_HISTORY)) return;
  refreshSharedArtifact(root, MACRO_HISTORY).then(({ changed }) => {
    if (changed && doc.getElementById(pageId)?.classList?.contains('active')) rerender();
  }).catch(() => {});
}

// One line states the latest completed KRX session on its own date, so a large KOSPI day after the US close is not
// left to a small ticker number. Shared by the 오늘 line and the folded 한국 시장 summary on 시장 상태.
export function koreaIndexParts(history) {
  const part = (field, title) => {
    const series = buildKoreaIndexSeries(history, field);
    // One and five KRX sessions back, counted on the calendar (a missing close does not stretch them).
    const last = series.at(-1), prev = sessionPointBack(series, 1, 'KR'), prior5 = sessionPointBack(series, 5, 'KR');
    if (!last) return null;
    const pctOf = (base) => base?.value > 0 ? (last.value / base.value - 1) * 100 : null;
    const signed = (v) => v == null ? null : `${signedText(v, 1)}%`;
    const d1 = signed(pctOf(prev)), d5 = signed(pctOf(prior5));
    return { date: last.date, title, d1, text: `${title} ${last.value.toLocaleString('en-US', { maximumFractionDigits: 2 })}${d1 ? ` (${d1}${d5 ? `, 5거래일 ${d5}` : ''})` : ''}`, d5: pctOf(prior5) };
  };
  return { kospi: part('kospi', '코스피'), kosdaq: part('kosdaq', '코스닥') };
}

// Two layers: the face is one plain line (한국 m/d 마감: 코스피 -3.5%, 코스닥 -3.8%); the levels, the five-session
// changes, the record check and the market-clock bridge (session-lean.js) open under it.
function paintKoreaLine(doc, root) {
  const line = doc.getElementById('home-kr-line');
  if (!line) return;
  const history = root._aioHistory || [];
  const { kospi, kosdaq } = koreaIndexParts(history);
  if (!kospi) { line.hidden = true; return; }
  const [, month, day] = kospi.date.split('-').map(Number);
  // The separate-check clause is the domain's reading (record tail first, then the 5-session line); the US tally is unchanged.
  const tone = krSeparateCheckTone(history, kospi, { now: Date.now() });
  const summary = line.querySelector(':scope > summary');
  const detail = doc.getElementById('home-kr-detail');
  if (summary) summary.textContent = `한국 ${month}/${day} 마감: ${[kospi, kosdaq].filter((part) => part?.d1).map((part) => `${part.title} ${part.d1}`).join(', ') || kospi.text}`;
  if (detail) detail.textContent = `한국장 ${month}/${day} 마감, ${[kospi.text, kosdaq?.text].filter(Boolean).join(', ')}${tone}`;
  line.dataset.observedAt = kospi.date;
  line.dataset.market = 'KR';
  line.title = '한국 정규장 확정 종가 기준입니다. 미국 6개 지표의 양호·중립·부담 합계에는 넣지 않습니다.';
  line.hidden = false;
}

let sessionLean = null;
let homeAhead = null;

// Home: one line plus the axis states, linking to the full board.
// The market inputs are gathered once per render; the returned regime is handed to renderDailyLoop. The macro-history
// request readMarketRegime made is the same deduplicated request requestRegimeMacroHistory makes below.
export function renderHomeRegime({ documentRef: doc, root, store = null }) {
  const hero = doc?.getElementById('home-score-hero');
  if (!hero) return null;
  const interpretation = marketInterpretation(root, { store });
  const { regime } = interpretation;
  requestRegimeMacroHistory(root, doc, 'page-home', () => renderHomeRegime({ documentRef: doc, root, store }));
  const set = (id, text) => { const node = doc.getElementById(id); if (node) node.textContent = text; return node; };
  // The page kicker above the 오늘 title — today's date (KST) · the close the verdict is based on.
  // The static shell may have painted the produced verdict (index.html, today-verdict.json); an unavailable regime
  // (closes still loading) leaves it, and the first real render takes the fields over.
  const heroTotal = doc.getElementById('home-hero-total');
  const held = !regime.available && !!heroTotal?.dataset?.firstPaint;
  if (!held && heroTotal?.dataset) delete heroTotal.dataset.firstPaint;
  const kicker = held ? null : doc.getElementById('home-date-label');
  if (kicker) {
    let today = '';
    try { today = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'long' }).format(new Date()); } catch (_) { today = ''; }
    const text = [today, regime.available && regime.asOf ? `${shortDate(regime.asOf)} 미국 종가 기준` : ''].filter(Boolean).join(', ');
    if (text) kicker.textContent = text;
  }
  if (!held) set('home-hero-total', regime.available ? regime.overall : '판정 대기');
  // The close date is in the page subtitle and the six counts are the
  // axis chips below, so this line speaks only when the verdict is held (why), or when the latest session moved against the
  // verdict (horizonLine: which horizon the verdict is on, beside index cards that show the day); empty (hidden) otherwise.
  if (!held) set('home-hero-headline', regime.available ? (regime.holdReason || (regime.overall === '판정 보류' ? `미국 6개 지표 ${summaryLine(regime)}` : '') || regime.horizonLine?.text || '') : historyWaitText(root));
  const basisLine = held ? null : doc.getElementById('home-hero-headline');
  if (basisLine) basisLine.title = regime.available && !regime.holdReason && regime.horizonLine ? regime.horizonLine.detail : '';
  // The hero sentence is the regime's one plain line (heroLine); the full conflict sentences with
  // their numbers and rules move into the 6개 축 근거 fold under the axis chips.
  if (!held) set('home-hero-desc', regime.heroLine || '');
  // 오늘 keeps the verdict word and its sentence with one link to 시장 상태; the axis chips, 판정 근거, the leaders line and
  // the month tilt live there (renderRegimePage).
  paintKoreaLine(doc, root);
  // The market clock with the Korea↔US link check, then the probabilistic lean, under the verdict.
  // Loaded after first paint (boot budget); the module also hands the AI context its two readers.
  // 다음 일정 beside the verdict: the dated items of 시장 상태's week list (a lazy chunk).
  (homeAhead ||= import('./home-ahead.js')).then((mod) => mod.renderHomeAhead({ documentRef: doc, root, interpretation })).catch(() => { homeAhead = null; });
  (sessionLean ||= import('./session-lean.js')).then((mod) => mod.paintHome(doc, root, store, regime, () => renderHomeRegime({ documentRef: doc, root, store }), () => marketInterpretation(root, { store }).regime)).catch(() => { sessionLean = null; });
  // The index strip above carries the closes; a futures chip shows only a live quote on an open CME week
  // (home-kpi-trend.js syncHomeQuoteRow).
  // The F&G day change on home uses the completed-close history, the same basis as 투자 심리 (not CNN's previous_close).
  const fgDelta = doc.getElementById('home-fg-delta');
  if (fgDelta) {
    const history = root._aioHistory || [];
    const fg = buildCloseSeries(history, 'fg', { through: closeBasis(history) });
    const change = fg.length > 1 ? Math.round(fg[fg.length - 1].value) - Math.round(fg[fg.length - 2].value) : null;
    // A zero change reads 전일과 같음: '전일 0' read as a previous value of 0.
    fgDelta.textContent = change == null ? '' : change === 0 ? '전일과 같음' : `전일 대비 ${signedText(change, 0)}`;
    fgDelta.className = 'aio-metric-delta';
    fgDelta.dataset.aioFgDeltaRenderer = 'native';
  }
  // The forward block and today's guide live on 시장 상태 (renderRegimePage); 오늘 keeps one link to it
  // (daily-loop.js renderHomeLinks).
  hero.dataset.aioRegimeRenderer = 'native';
  hero.dataset.state = regime.available ? 'regime' : 'pending';
  return regime;
}
