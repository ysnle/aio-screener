// v58.75 (persona review, teach-and-check spec F4·F5): two checks of the reader's own book, facts only.
// F4 '포트폴리오 점검 기준' — five criteria an allocator checks, each with its one-line principle, the reader's current value
// and whether it is met (against the reader's own rule where one is written, else the app's published internal band). The
// header counts how many are met: a count, not a score or a grade.
// F5 '보유 종목 논지 점검' — per holding: is a thesis memo written, and which break signals are on now (below the 50-day
// line, theme stage weak, estimate revisions turned down over 4 weeks, earnings within two weeks). No instruction.
import { el } from './dom.js';
import { portfolioLens, leadScenarioExposure } from './portfolio-read.js';
import { readJournal } from '../panels/portfolio-trade-journal.js';
import { normalizeRules } from '../../domain/portfolio/trade-journal.js';
import { consensusRowFor, requestConsensusEstimates } from '../../data/consensus-estimates.js';
import { SCENARIO_STATE, refreshSharedArtifact } from '../../data/shared-artifacts.js';
import { EARNINGS_CALENDAR } from './fiscal-read.js';
import { shortDate } from '../../domain/content/date-labels.js';
import { themeStagesFor } from '../../domain/scenarios/theme-stage.js';

const SINGLE_BAND = 25; // the 점검 single-holding internal band (domain/portfolio/checks.js: 25% 초과 주의)
const SECTOR_BAND = 40; // the exposure panel's internal sector band (portfolio-read.js SECTOR_CONCENTRATION_BAND)
const EARNINGS_SOON_DAYS = 14;
const THESIS_CHECKS = 4; // 50일선 · 테마 단계 · 이익 전망 · 실적일

function hostAfter(doc, id, anchorId, label) {
  let host = doc.getElementById(id);
  if (!host) {
    const anchor = doc.getElementById(anchorId);
    if (!anchor) return null;
    host = el(doc, 'section', null, 'aio-section pf-checklist');
    host.id = id;
    host.setAttribute('aria-label', label);
    anchor.after(host);
  }
  return host;
}

export function portfolioCriteria({ surface, root, checks = null, rules = {}, sectorLabel = (name) => name }) {
  const lens = portfolioLens({ surface, stressInput: root?._aioPortfolioStressInput || null, history: root?._aioHistory || [], sectorLabel });
  if (!lens.available) return { available: false };
  const r = normalizeRules(rules);
  const rows = (surface.rows || []).filter((row) => Number(row?.value) > 0);
  const total = rows.reduce((sum, row) => sum + Number(row.value), 0);
  const top = rows.reduce((best, row) => (!best || row.value > best.value ? row : best), null);
  const topPct = top && total > 0 ? top.value / total * 100 : null;
  const single = checks?.checks?.find?.((check) => check.id === 'single-holding');
  const exposure = leadScenarioExposure(root, surface);
  const corr = lens.bonds?.correlation;
  const cashPct = Number.isFinite(Number(surface?.cashPct)) && surface?.cashPct != null ? Number(surface.cashPct) : null;
  const items = [
    { id: 'single', label: '한 종목 쏠림', principle: '한 종목이 크면 그 종목 하나의 일이 계좌 전체의 일이 됩니다.',
      value: topPct == null ? '미확인' : `가장 큰 ${top.symbol} ${topPct.toFixed(1)}%(보유 종목 중)`,
      basis: r.maxPositionPct != null ? `내 원칙 ${r.maxPositionPct}% 이하` : `앱 내부 구간 ${SINGLE_BAND}% 이하`,
      ok: topPct == null ? null : r.maxPositionPct != null ? topPct <= r.maxPositionPct : single ? single.status !== 'attention' : topPct <= SINGLE_BAND },
    { id: 'sector', label: '업종 쏠림', principle: '같은 업종은 같은 뉴스에 함께 움직여, 종목 수가 많아도 한 번에 흔들립니다.',
      value: lens.topSector ? `가장 큰 ${lens.topSector.name} ${lens.topSector.pct.toFixed(0)}%(주식 부분 중)` : '미확인',
      basis: `앱 내부 구간 ${SECTOR_BAND}% 이하`, ok: lens.topSector ? lens.topSector.pct <= SECTOR_BAND : null },
    { id: 'cushion', label: '실질 분산', principle: '주식이 내리는 주에 함께 내리지 않는 부분이 있어야 분산이 실제로 작동합니다.',
      value: `실질 종목 수 ${lens.effectiveN.toFixed(1)}개${corr?.available ? `, 채권 부분과 주식 부분의 주간 상관 ${corr.r.toFixed(2)}` : lens.bonds?.bondPct > 0 ? ', 상관은 가격 기록이 쌓이면 계산' : ', 채권 ETF 없음'}`,
      basis: '채권 부분과 주식 부분의 상관이 0보다 작음', ok: corr?.available ? corr.r < 0 : lens.bonds?.available && !(lens.bonds.bondPct > 0) ? false : null },
    { id: 'scenario', label: '시나리오 노출', principle: '한 시나리오가 틀어졌을 때 계좌의 절반 이상이 같은 쪽으로 맞지 않게 둡니다.',
      value: exposure ? `'${exposure.name}'에서 가설 태그상 부담 쪽 ${exposure.share.head.toFixed(0)}%` : '미확인',
      basis: '부담 쪽 영역이 평가액의 절반 미만', ok: exposure ? exposure.share.head < 50 : null },
    { id: 'cash', label: '현금 비중', principle: '현금은 수익 0이 아니라 다음 기회를 고를 수 있는 선택권입니다.',
      value: cashPct == null ? '현금 미입력' : `현금 ${cashPct.toFixed(1)}%`,
      basis: r.minCashPct != null ? `내 원칙 ${r.minCashPct}% 이상` : '내 원칙 미설정',
      ok: cashPct == null || r.minCashPct == null ? null : cashPct >= r.minCashPct, held: cashPct != null && r.minCashPct == null ? '원칙 미설정' : null }
  ];
  return { available: true, items, met: items.filter((item) => item.ok === true).length, unknown: items.filter((item) => item.ok == null).length, beta: lens.beta, betaNote: lens.betaNote };
}

// Rendered inside the existing 포트폴리오 점검 section (#pf-checks), right under its heading; the share cards below it fold.
export function renderPortfolioCriteria({ documentRef: doc, root, surface, checks = null, sectorLabel }) {
  const section = doc?.getElementById('pf-checks');
  doc?.getElementById('pf-criteria')?.remove();
  if (!section || section.hidden || checks?.status !== 'current') return null;
  const model = portfolioCriteria({ surface, root, checks, rules: readJournal(root).rules, sectorLabel });
  if (!model.available) return model;
  const host = el(doc, 'div', null, 'pf-criteria');
  host.id = 'pf-criteria';
  const lead = el(doc, 'p', null, 'pf-criteria-lead');
  lead.append(el(doc, 'strong', `점검 기준 ${model.items.length}개 중 ${model.met}개 충족`), doc.createTextNode(`${model.unknown ? `, ${model.unknown}개 판정 보류` : ''} — 충족 개수이며 점수가 아닙니다.`));
  const list = el(doc, 'ul', null, 'pf-trade-mirror');
  for (const item of model.items) {
    const li = el(doc, 'li', null, `pf-trade-mirror-row is-${item.ok == null ? 'unknown' : item.ok ? 'favorable' : 'burden'}`);
    li.append(el(doc, 'span', item.ok == null ? item.held || '확인 불가' : item.ok ? '충족' : '미충족', 'pf-trade-mirror-state'), el(doc, 'strong', item.label),
      el(doc, 'span', ` — ${item.value} (기준: ${item.basis}). ${item.principle}`));
    list.append(li);
  }
  const drawdown = el(doc, 'p', model.beta == null ? `낙폭 감내(참고): 시장 민감도는 아직 계산되지 않았습니다 — ${model.betaNote || '주간 가격 기록이 더 필요합니다'}.` : `낙폭 감내(참고, 판정 없음): 과거 주간 기준으로 시장 지수가 10% 내릴 때 보유 종목 부분은 평균 약 ${(model.beta * 10).toFixed(1)}% 움직였습니다. 내가 견딜 수 있는 낙폭과 비교해 보는 값이며 앞으로의 낙폭을 뜻하지 않습니다.`, 'theme-strength-basis');
  host.append(lead, list, drawdown, el(doc, 'p', '한 종목 최대 비중과 현금 최소 비중을 아래 매매일지의 ‘내 원칙’에 적으면 기준이 그 값으로 바뀝니다.', 'theme-strength-basis'));
  section.querySelector(':scope > h2')?.after(host);
  return model;
}

// Earnings date for a symbol from the shared calendar artifact: the six-week `upcoming` map when the producer has it, else
// the collected week rows. Only dates from today on.
function nextEarnings(root, symbol, todayIso) {
  const cal = root?.[EARNINGS_CALENDAR.key];
  if (!cal) return null;
  const up = cal.upcoming?.[symbol];
  const fromUp = typeof up === 'string' ? up : up?.date || null;
  if (fromUp && fromUp >= todayIso) return fromUp;
  const rows = Array.isArray(cal.earnings) ? cal.earnings : [];
  return rows.filter((row) => row?.symbol === symbol && row.date >= todayIso).map((row) => row.date).sort()[0] || null;
}

export function thesisRows({ surface, root, holdings = [], bySymbol = new Map(), nowMs = Date.now() }) {
  const memoOf = new Map((holdings || []).map((holding) => [String(holding?.symbol || holding?.ticker || '').toUpperCase(), String(holding?.memo || '').trim()]));
  const themeMap = Array.isArray(root?.THEME_MAP) ? root.THEME_MAP : [];
  const todayIso = new Date(nowMs).toISOString().slice(0, 10);
  const soonIso = new Date(nowMs + EARNINGS_SOON_DAYS * 86400000).toISOString().slice(0, 10);
  // v59.45 (PASS10 P10-PF-02): each of the four checks is either looked at or unknown. With no price row, theme states,
  // estimates or calendar, signals stayed [] and the row read '신호 없음' — the same words as four clean checks. `checked`
  // counts the checks that had data and `unknown` names the rest, so the row can say what was not looked at.
  const calendarKnown = !!root?.[EARNINGS_CALENDAR.key];
  // The theme stage comes from the shared reader (theme-stage.js themeStagesFor), which refuses a pending or out-of-date
  // scenario state; reading the raw rows kept a stale 'weak' stage on as a live signal.
  return (surface?.rows || []).filter((row) => Number(row?.value) > 0).slice(0, 15).map((row) => {
    const symbol = String(row.symbol || '').toUpperCase();
    const signals = [];
    const unknown = [];
    const sma = bySymbol.get(symbol)?.pctSma50;
    const s50 = sma == null || sma === '' ? NaN : Number(sma);
    if (!Number.isFinite(s50)) unknown.push('50일선');
    else if (s50 < 0) signals.push(`50일선 아래(${s50.toFixed(1)}%)`);
    const themes = themeMap.filter((theme) => (theme.leaders || []).includes(symbol) || (theme.subThemes || []).some((sub) => (sub.tickers || []).includes(symbol)));
    // Not in any theme is a checked fact (no theme signal can apply); a theme without a published stage is unknown.
    const stages = themes.length ? themeStagesFor(root, { market: 'US', themeIds: themes.map((theme) => theme.id) }) : [];
    if (!themeMap.length || (themes.length && !stages.length)) unknown.push('테마 단계');
    const weak = stages.filter((state) => ['weak', 'fading'].includes(state.state));
    if (weak.length) signals.push(`테마 단계 약함(${weak.map((state) => state.label).join(', ')})`);
    const fwd = consensusRowFor(root, symbol)?.fwd;
    if (!(fwd && Number.isFinite(fwd.up4w) && Number.isFinite(fwd.down4w))) unknown.push('이익 전망');
    else if (fwd.down4w > fwd.up4w) signals.push(`이익 전망 4주 하향 우위(상향 ${fwd.up4w}, 하향 ${fwd.down4w})`);
    if (!calendarKnown) unknown.push('실적일');
    const earnings = nextEarnings(root, symbol, todayIso);
    if (earnings && earnings <= soonIso) signals.push(`실적 발표 ${shortDate(earnings)}`);
    return { symbol, memo: memoOf.get(symbol) || '', signals, checked: THESIS_CHECKS - unknown.length, unknown };
  });
}

export function renderThesisCheck({ documentRef: doc, root, surface, holdings = [], bySymbol = new Map(), rerender = null }) {
  const host = hostAfter(doc, 'pf-thesis', 'pf-checks', '보유 종목 논지 점검');
  if (!host) return null;
  if (rerender && !root.__aioThesisRequested) {
    root.__aioThesisRequested = true;
    const again = () => rerender();
    requestConsensusEstimates(root, again);
    refreshSharedArtifact(root, SCENARIO_STATE).then(({ changed }) => { if (changed) again(); }).catch(() => {});
    refreshSharedArtifact(root, EARNINGS_CALENDAR).then(({ changed }) => { if (changed) again(); }).catch(() => {});
  }
  const rows = thesisRows({ surface, root, holdings, bySymbol });
  if (!rows.length) { host.hidden = true; host.replaceChildren(); return rows; }
  host.hidden = false;
  const noMemo = rows.filter((row) => !row.memo).length;
  const head = el(doc, 'h2', '보유 종목 논지 점검', 'briefing-h2');
  head.append(el(doc, 'span', `${rows.length}종목, 메모 없음 ${noMemo}, 신호가 켜진 종목 ${rows.filter((row) => row.signals.length).length}`, 'briefing-h2-note'));
  const list = el(doc, 'ul', null, 'pf-trade-mirror');
  for (const row of rows) {
    const li = el(doc, 'li', null, `pf-trade-mirror-row is-${row.signals.length ? 'burden' : 'unknown'}`);
    // v59.45 (P10-PF-02): 'no signal' only for checks that had data; with none, the row says it could not be checked.
    const state = row.signals.length ? `신호 ${row.signals.length}` : row.checked === 0 ? '확인 불가' : row.unknown?.length ? `신호 없음(${row.checked}/${THESIS_CHECKS} 확인)` : '신호 없음';
    li.append(el(doc, 'span', state, 'pf-trade-mirror-state'), el(doc, 'strong', row.symbol),
      el(doc, 'span', ` — ${row.memo ? `메모: ${row.memo.length > 60 ? `${row.memo.slice(0, 60)}…` : row.memo}` : '메모 없음(매수 이유를 적어 두면 깨짐 신호와 비교할 수 있습니다)'}${row.signals.length ? `. 켜진 신호: ${row.signals.join(', ')}` : ''}${row.unknown?.length ? `. 자료 없음: ${row.unknown.join(', ')}` : ''}`));
    list.append(li);
  }
  host.replaceChildren(head, list, el(doc, 'p', '신호는 논지가 틀렸을 수 있다는 사실 확인용입니다: 50일선 아래, 속한 테마의 단계 약함, 최근 4주 이익 전망 하향 건수가 상향보다 많음, 2주 안의 실적 발표. 무엇을 할지는 내 논지와 원칙으로 정합니다.', 'theme-strength-basis'));
  return rows;
}
