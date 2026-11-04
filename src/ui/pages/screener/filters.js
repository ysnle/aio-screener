// Screener filters: the table filter, control availability, condition chips and the 맞춤 조건 panel.
import { selectScreenerState } from '../../../state/selectors/screener.js';
import { SCREENER_FIELD_REGISTRY, readRowNumber } from '../../../data/contracts/screener.js';
import { FACTOR_LABELS, capFilterValue, rankGrade, profileComputability } from '../../../domain/screener/row-presentation.js';
import { withTopicParticle } from '../../../domain/content/korean-particle.js';
import { MARKET_LABELS, screenerMarket } from '../../../domain/screener/market-scope.js';
import { sectorsForEtf } from '../../../domain/entity/stock-read.js';
import { parseConditionValue, matchesConditions, conditionCoverage, conditionLabel, CUSTOM_CONDITIONS, CUSTOM_RECIPES, conditionTemplate, normalizeConditions } from '../../../domain/screener/custom-conditions.js';
import { sectorLabel } from '../../../domain/screener/screener-read.js';
import { readUniverseScope, rememberExtendedCount, writeUniverseScope } from '../../../data/screener-extended.js';
import { finiteNumber as finite } from '../../../domain/shared/number.js';
import { FILTER_LABELS, INDEX_CODE_LABELS, INDEX_LABELS, customRead, scopedRows, screenerRuntime, selectedValue } from './model.js';
export function filterRows(rows, documentRef, { readWatchlist, readAliases } = {}) {
  const listingMarket = selectedValue(documentRef, 'scr-listing-market') || 'US';
  const market = selectedValue(documentRef, 'scr-market');
  const sector = selectedValue(documentRef, 'scr-sector');
  const cap = selectedValue(documentRef, 'scr-cap');
  const query = selectedValue(documentRef, 'scr-text-search').trim().toLowerCase();
  // Screen audit 2026-10-20: 'MS' matched Morgan Stanley's symbol exactly and showed only that row — hidden by the other
  // filters, so the table said nothing was found while MSFT sat in it; 'NV' matched MSFT·MU·AMD through letters inside
  // their names. A short Latin query is a ticker prefix (or the start of a word in the name), not a substring.
  const tickerQuery = /^[a-z][a-z.\-]{0,4}$/.test(query);
  const minRank = Number.parseInt(selectedValue(documentRef, 'scr-min-rank'), 10) || 0;
  const rsiMin = Number.parseFloat(selectedValue(documentRef, 'scr-rsi-min'));
  const rsiMax = Number.parseFloat(selectedValue(documentRef, 'scr-rsi-max'));
  const minMomentum = Number.parseFloat(selectedValue(documentRef, 'scr-min-mom'));
  const setupFilter = selectedValue(documentRef, 'scr-setup');
  const custom = parseConditionValue(selectedValue(documentRef, 'scr-custom-conditions'));
  const watchlistOnly = !!documentRef.getElementById('scr-watchlist-only')?.checked;
  // Codex browser audit H44: after a run the table mixed rejected rows into "the result". 실행 통과만 keeps
  // the table on the run's passed set; it is switched on when a run completes and can be turned off.
  const passedOnly = !!documentRef.getElementById('scr-passed-only')?.checked;
  const watchlist = watchlistOnly ? new Set(readWatchlist?.() || []) : null;
  const aliases = readAliases?.() || {};
  const words = query ? query.split(/[\s,;·+&]+/).filter(Boolean) : [];
  const matchedSymbols = new Set();
  // 2026-10-13 review S03: structure-class aliases (매수 -> BUY) are retired with the column; only symbol-list
  // aliases remain, and any other word is matched as text.
  words.forEach((word) => {
    const alias = aliases[word];
    if (Array.isArray(alias)) alias.forEach((symbol) => matchedSymbols.add(symbol));
  });

  return rows.filter((row) => {
    if (screenerMarket(row) !== listingMarket) return false;
    // v57.81: in the 확장 view a stock can belong to several lists (S&P 500 and Nasdaq, Russell 2000 and Nasdaq).
    if (market && row.index !== market && !(Array.isArray(row.membership) && row.membership.includes(market))) return false;
    if (sector && row.sector !== sector) return false;
    // P1318/R664: a size bucket is a reference filter — use the decision-grade live value when it
    // exists, otherwise the plausibility-checked SEC reference value; unknown size stays excluded.
    const capValue = capFilterValue(row);
    if (cap && capValue == null) return false;
    if (cap === 'MEGA' && !(capValue >= 1000)) return false;
    if (cap === 'LARGE' && !(capValue >= 10 && capValue < 1000)) return false;
    if (cap === 'MID' && !(capValue >= 2 && capValue < 10)) return false;
    if (cap === 'SMALL' && !(capValue < 2)) return false;
    if (minRank > 0 && !(row.screenStatus === 'passed' && finite(row.rank) != null && row.rank >= minRank)) return false;
    const rsi = readRowNumber(row, 'rsi', 'calculation');
    const momentum = readRowNumber(row, 'ret3m', 'calculation');
    if (Number.isFinite(rsiMin) && !(rsi != null && rsi >= rsiMin)) return false;
    if (Number.isFinite(rsiMax) && !(rsi != null && rsi <= rsiMax)) return false;
    if (Number.isFinite(minMomentum) && !(momentum != null && momentum >= minMomentum)) return false;
    if (setupFilter === 'WINNER' && row.setupProfile?.winnerFilter !== 'candidate') return false;
    if (setupFilter === 'RSPULLBACK' && row.setupProfile?.relativeStrengthPullback !== 'candidate') return false;
    if (setupFilter === 'SUPPORT200' && row.setupProfile?.support200 !== 'near') return false;
    if (setupFilter === 'CLIMAX' && row.setupProfile?.climaxRisk !== 'watch') return false;
    if (watchlist && !watchlist.has(row.sym)) return false;
    if (passedOnly && row.screenStatus !== 'passed') return false;
    if (custom.length && !matchesConditions(row, custom, customRead)) return false;
    if (!query) return true;
    // v57.84 review: 'ai' is both C3.ai's ticker and a theme alias of 21 names — an exact ticker joins the alias group
    // instead of hiding it (low, now, all, key, it, bio … collide the same way).
    if (tickerQuery) {
      const sym = String(row.sym || '').toLowerCase();
      const wordStart = (text) => String(text || '').toLowerCase().split(/[^a-z0-9]+/).some((word) => word.startsWith(query));
      return sym.startsWith(query) || wordStart(row.name) || wordStart(row.sector) || matchedSymbols.has(row.sym); // 'tech' still finds Technology
    }
    const setupText = Array.isArray(row.setupProfile?.tags) ? row.setupProfile.tags.join(' ') : '';
    // 2026-10-13 news audit N03: the headline memo is not searchable — a word in another company's headline (or in
    // this company's) is not a property of the stock, and it made searches return unrelated rows.
    // v57.55 review (S1-F11): '엔비디아' found nothing — the registered Korean name joins the searchable text (a list
    // filter the reader scans, not an automatic pick).
    const koName = globalThis.AIO_TICKER_NAME_REGISTRY?.entries?.[row.sym]?.kr || globalThis.KR_STOCK_DB?.[String(row.sym || '').replace(/\.K[SQ]$/, '')]?.name || '';
    const haystack = `${row.sym} ${row.name} ${koName} ${row.memo || ''} ${row.sector || ''} ${setupText}`.toLowerCase();
    const direct = haystack.includes(query);
    const residualWords = words.filter((word) => !Array.isArray(aliases[word]));
    const allWords = residualWords.length > 0 && residualWords.every((word) => haystack.includes(word));
    return direct || allWords || matchedSymbols.has(row.sym);
  });
}

// The rank filter used to label thresholds with a different grade scale than the
// grade column (60 → "B" while the column renders C). Derive the labels from
// rankGrade so the page cannot offer two definitions of the same grade (P1078).
export function syncRankFilterLabels(documentRef) {
  const select = documentRef?.getElementById?.('scr-min-rank');
  if (!select || !select.options) return false;
  Array.prototype.slice.call(select.options).forEach((option) => {
    const threshold = Number(option.value || 0);
    if (!Number.isFinite(threshold) || threshold <= 0) return;
    const position = rankGrade(threshold);
    if (position) option.textContent = `${threshold} 이상 (${position})`;
  });
  return true;
}
// S01/S04/S16: a control whose input is not published for the selected market is disabled (or hidden) with
// its reason instead of offering a choice that always returns 0 rows or a held ranking.
const SETUP_OPTION_EVIDENCE = Object.freeze({
  WINNER: (setup) => setup?.winnerFilter && setup.winnerFilter !== 'unavailable',
  RSPULLBACK: (setup) => setup?.relativeStrengthPullback && setup.relativeStrengthPullback !== 'unavailable',
  SUPPORT200: (setup) => setup?.support200 && setup.support200 !== 'unavailable',
  CLIMAX: (setup) => setup?.climaxRisk && setup.climaxRisk !== 'unavailable'
});
export function syncScreenerControlAvailability(documentRef, { rows = [], listingMarket = 'US', ranking = {}, profiles = null } = {}) {
  const marketList = scopedRows(rows, listingMarket);
  const cap = documentRef?.getElementById?.('scr-cap');
  if (cap) {
    const capAvailable = marketList.some((row) => capFilterValue(row) != null);
    cap.hidden = !capAvailable;
    const field = cap.closest?.('label');
    if (field) field.hidden = !capAvailable;
    if (!capAvailable) cap.value = '';
  }
  const setup = documentRef?.getElementById?.('scr-setup');
  if (setup?.options) {
    Array.prototype.slice.call(setup.options).forEach((option) => {
      const hasEvidence = SETUP_OPTION_EVIDENCE[option.value];
      if (!hasEvidence) return;
      if (!option.dataset.baseLabel) option.dataset.baseLabel = option.textContent;
      const available = marketList.some((row) => hasEvidence(row.setupProfile));
      option.disabled = !available;
      option.textContent = available ? option.dataset.baseLabel : `${option.dataset.baseLabel} — 자료 미발행`;
      if (!available && setup.value === option.value) setup.value = '';
    });
  }
  const notes = [];
  const anyActive = Object.values(ranking?.factorCoverage || {}).some((entry) => entry?.active === true);
  documentRef?.querySelectorAll?.('[data-aio-screener-action="profile"]').forEach((button) => {
    const key = button.dataset.aioScreenerArg;
    const weights = profiles?.[key]?.weights;
    if (key === 'balanced' || !weights) { button.disabled = false; button.removeAttribute('title'); return; }
    const measured = profileComputability(weights, ranking?.factorCoverage);
    const blocked = !!measured && !measured.available;
    button.disabled = blocked;
    button.setAttribute('aria-disabled', String(blocked));
    if (!blocked) { button.removeAttribute('title'); return; }
    const missing = measured.missing.map((factor) => FACTOR_LABELS[factor]?.label || factor).join('·');
    const reason = anyActive ? `요청 비중 중 계산 가능 ${measured.pct}%(기준 80%) — ${missing} 자료 부족` : '이 시장의 팩터 자료가 최신 종가 기준이 아니어서 계산 대기';
    button.title = `${button.textContent.trim()}: ${reason}`;
    notes.push({ label: button.textContent.trim(), pct: measured.pct, missing });
  });
  const fold = documentRef?.getElementById?.('scr-view-panel');
  if (fold) {
    let note = documentRef.getElementById('scr-profile-availability');
    if (!note && notes.length) {
      note = documentRef.createElement('p');
      note.id = 'scr-profile-availability';
      note.className = 'scr-profile-note';
      fold.appendChild(note);
    }
    if (note) {
      note.hidden = !notes.length;
      const missingAll = [...new Set(notes.flatMap((entry) => entry.missing))].map((factor) => FACTOR_LABELS[factor]?.label || factor).join('·');
      note.textContent = !notes.length ? '' : anyActive
        ? `${withTopicParticle(notes.map((entry) => entry.label).join('·'))} 지금 계산할 수 없습니다 — 요청 비중 중 계산 가능한 몫이 ${notes.map((entry) => `${entry.pct}%`).join('·')}로 기준 80%에 못 미칩니다(${missingAll} 자료 부족).`
        : `${MARKET_LABELS[listingMarket] || listingMarket} 팩터 자료가 최신 종가 기준이 아니어서 가중치 프로필을 계산하지 않습니다.`;
    }
  }
}
// v59.70 (S12): every applied condition is one chip under the bar — the chosen 조건 화면 first (it opens + 조건), then the
// conditions set in the + 조건 panel, then the 맞춤 조건 chips (the panel moves its own chip list into the same row).
// 섹터 and 표에서 찾기 show their value in the bar itself, so they get no second chip.
const CHIP_FILTER_IDS = Object.freeze(['scr-market', 'scr-cap', 'scr-setup', 'scr-min-rank', 'scr-rsi-min', 'scr-rsi-max', 'scr-min-mom', 'scr-watchlist-only', 'scr-passed-only']);
function chipText(control) {
  const label = FILTER_LABELS[control.id];
  if (control.type === 'checkbox') return control.checked ? label : '';
  const value = String(control.value || '').trim();
  if (!value || (control.id === 'scr-min-rank' && value === '0')) return '';
  if (control.id === 'scr-rsi-min') return `RSI ${value} 이상`;
  if (control.id === 'scr-rsi-max') return `RSI ${value} 이하`;
  if (control.id === 'scr-min-mom') return `3개월 수익률 ${value}% 이상`;
  if (control.id === 'scr-min-rank') return `백분위 ${value} 이상`;
  const option = control.selectedOptions?.[0];
  return `${label} ${option?.textContent?.trim() || value}`;
}
export function renderFilterChips(documentRef, { screen = null } = {}) {
  const container = documentRef.getElementById('scr-active-filter-chips');
  if (!container) return;
  const chips = [];
  // The table render redraws the chips without the screen; the last screen the workbench named is kept on the row.
  if (screen) container.dataset.screenLabel = screen.label || '';
  screen = { label: container.dataset.screenLabel || '' };
  if (screen.label) {
    const chip = documentRef.createElement('button');
    chip.type = 'button';
    chip.className = 'scr-filter-chip is-screen';
    chip.dataset.aioScreenerAction = 'toggle-panel';
    chip.dataset.aioScreenerArg = 'scr-condition-panel';
    chip.setAttribute('aria-label', `조건 화면 ${screen.label} — 바꾸려면 조건 패널 열기`);
    chip.textContent = `조건 화면: ${screen.label}`;
    chips.push(chip);
  }
  for (const id of CHIP_FILTER_IDS) {
    const control = documentRef.getElementById(id);
    const textValue = control ? chipText(control) : '';
    if (!textValue) continue;
    const chip = documentRef.createElement('button');
    chip.type = 'button';
    chip.className = 'scr-filter-chip';
    chip.dataset.aioScreenerAction = 'clear-filter';
    chip.dataset.aioScreenerArg = id;
    chip.setAttribute('aria-label', `${textValue} 조건 빼기`);
    const words = documentRef.createElement('span');
    words.textContent = textValue;
    const mark = documentRef.createElement('span');
    mark.className = 'scr-filter-chip-x';
    mark.setAttribute('aria-hidden', 'true');
    mark.textContent = '×';
    chip.append(words, mark);
    chips.push(chip);
  }
  // Rebuilt only when the set changes, so a focused chip keeps focus across renders.
  const signature = chips.map((chip) => chip.textContent).join('|');
  if (container.dataset.chipSignature !== signature) {
    const active = documentRef.activeElement;
    const focusArg = active && container.contains(active) ? active.dataset.aioScreenerArg : null;
    container.replaceChildren(...chips);
    container.dataset.chipSignature = signature;
    if (focusArg) [...container.children].find((chip) => chip.dataset.aioScreenerArg === focusArg)?.focus?.({ preventScroll: true });
  }
  const row = container.closest('.scr-chip-row');
  if (row) row.hidden = !chips.length && !row.querySelector('.scr-custom-chip');
}

// P1165 (12 W12-A / 19 작업 카드): 선택된 정의의 내장 조건과 사용자가 추가한 조건을 같은 계약으로
// 읽는다. 프리셋은 filtersAST에 조건을 내장하므로 DOM 컨트롤만 세면 '활성조건 없음'으로 오표시된다.
export const FILTER_FIELD_LABELS = new Map(SCREENER_FIELD_REGISTRY.fields.map(field => [field.fieldId, field.label || field.fieldId]));
export function describeFilterAst(definition) {
  const ast = definition?.filtersAST;
  if (!ast) return { builtin: [], user: [] };
  const nodes = ast.type === 'and' || ast.type === 'or' ? (ast.children || []) : [ast];
  const described = nodes.map((node) => {
    if (!node || typeof node !== 'object') return null;
    const label = FILTER_FIELD_LABELS.get(node.field) || node.field || node.type;
    let text;
    if (node.type === 'range') {
      const parts = [];
      if (node.min != null) parts.push(`≥ ${node.min}`);
      if (node.max != null) parts.push(`≤ ${node.max}`);
      text = `${label} ${parts.join(', ') || '범위 미지정'}`;
    } else if (node.type === 'enum') text = `${label} ∈ ${(node.values || []).join('·')}`;
    else if (node.type === 'exists') text = `${label} 존재`;
    // v58.64 (SCR01 class): a NOT node carries `child`, not `children`, so it read "NOT 하위 조건 0개".
    else if (node.type === 'not') text = node.child && typeof node.child === 'object' ? `제외: ${FILTER_FIELD_LABELS.get(node.child.field) || node.child.field || node.child.type} 조건` : '제외 조건(내용 없음)';
    else if (node.type === 'and' || node.type === 'or') text = `${String(node.type).toUpperCase()} 하위 조건 ${(node.children ? node.children.length : 0)}개`;
    else text = `${label} (${node.type})`;
    return { label, text, origin: node.origin || null };
  }).filter(Boolean);
  return {
    builtin: described.filter(item => item.origin !== 'visual-builder'),
    user: described.filter(item => item.origin === 'visual-builder')
  };
}

// LC-25: the funnel used to stack two different populations side by side with no denominator:
// the executed judgment ("조건 통과 342 / 데이터 부족 29", out of the run's rowCount) and the
// table's display scope ("현재 필터 결과 873", the current UI filter). Users read 342 and 873 as
// one set. Both denominators are now explicit and bound to the run that produced them.
export function renderFunnel(documentRef, { universe = 0, ready = 0, passed = 0, unavailable = 0, filtered = 0, runRowCount = null, runId = null, origin = null, passedOnly = false } = {}) {
  const values = { 'scr-funnel-universe': universe, 'scr-funnel-ready': ready, 'scr-funnel-passed': passed, 'scr-funnel-unavailable': unavailable, 'scr-funnel-filtered': filtered };
  Object.entries(values).forEach(([id, value]) => {
    const node = documentRef.getElementById(id);
    if (node) node.textContent = String(value ?? 0);
  });
  const runRow = finite(runRowCount);
  const denominator = runRow != null && runRow > 0 ? `/${runRow}` : '';
  const setText = (id, text) => { const node = documentRef.getElementById(id); if (node) node.textContent = text; };
  setText('scr-funnel-passed-denom', denominator);
  setText('scr-funnel-unavailable-denom', denominator);
  const readyLabel = documentRef.getElementById('scr-funnel-ready')?.previousElementSibling;
  if (readyLabel) readyLabel.textContent = '필수 자료 있는 종목';
  const executed = !!runId;
  const originLabel = origin === 'user' ? '사용자 실행'
    : origin === 'pipeline' ? '파이프라인 실행'
      : origin === 'preview' ? '미리보기(아직 고정 전)' : null;
  setText('scr-funnel-runid', executed
    ? `실행 기록${originLabel ? `, ${originLabel}` : ''}`
    : '실행 전');
  const runNode = documentRef.getElementById('scr-funnel-runid'); // v57.55 review (S1-F8): the run id stays in the hover, off the face
  if (runNode) runNode.title = executed ? `실행 ID ${String(runId)}` : '';
  const scope = documentRef.getElementById('scr-funnel-scope-note');
  if (scope) {
    scope.textContent = executed
      // Codex browser audit H43: one line says why the table count differs from the run's pass count.
      ? `실행 조건 통과 ${passed}종목(대상 ${runRow != null ? runRow : '미확인'}, 조건 판단 자료 부족 ${unavailable}) — 저장·재실행·검증은 이 ${passed}종목 기준입니다. ${passedOnly ? `표에는 그중 ${filtered}행이 보입니다${filtered < passed ? '(섹터·검색 같은 표시 필터 적용)' : ''}.` : `표에는 탈락·데이터 부족 종목까지 포함한 ${filtered}행이 보입니다 — 통과 종목만 보려면 ‘실행 통과만’을 켭니다.`}`
      : '실행 전 — 조건을 실행하면 비교 기준 종목 수가 정해집니다. 표시 범위는 현재 필터 결과입니다.';
  }
}

// v57.81: 종목 범위 control text and the one-line notes for what stays core-only. The option counts come from the rows
// that arrived (기본 = this market's core rows; 확장 = the shard's rows, remembered from the last load).
export function syncUniverseScopeControl(documentRef, root, state, listingMarket) {
  const select = documentRef.getElementById('scr-universe-scope');
  if (!select) return;
  const metadata = state?.metadata || {};
  const extended = metadata.extended || null;
  const rows = Array.isArray(state?.rows) ? state.rows : [];
  const coreCount = rows.filter((row) => screenerMarket(row) === 'US' && row.universeTier !== 'extended').length;
  const extendedCount = extended?.status === 'loaded' ? rememberExtendedCount(root, extended.rows) : rememberExtendedCount(root);
  const [coreOption, extendedOption] = select.options;
  if (coreOption) coreOption.textContent = coreCount ? `기본 (${coreCount}종목)` : '기본';
  if (extendedOption) extendedOption.textContent = `확장 — 러셀2000·나스닥 전체${extendedCount ? ` (+${extendedCount})` : ''}`;
  const wrap = select.closest('label');
  if (wrap) wrap.hidden = listingMarket !== 'US';
  // The select is the reader's request; metadata says what has arrived (it lags while the shard downloads).
  const requested = select.value;
  const status = documentRef.getElementById('scr-universe-status');
  if (status) {
    const session = extended?.factorSessionDateByMarket?.US;
    status.textContent = requested !== 'extended' || listingMarket !== 'US' ? ''
      : extended?.status === 'loaded' ? `확장 ${extended.rows}종목 포함, 가격 자료 ${session ? `${session.slice(5).replace('-', '/')} 종가` : '세션 미확인'}${extended.unfetched ? `, 가격 미수신 ${extended.unfetched}` : ''}${Number.isFinite(extended.fundamentalCoveragePct) ? `, 재무 자료 ${extended.fundamentalCoveragePct}%` : ''}`
        : extended?.status === 'deferred' || !extended ? '확장 종목을 불러오는 중입니다'
          : '확장 종목 파일을 받지 못해 기본 범위로 표시합니다';
    status.hidden = !status.textContent;
  }
  const coreOnly = metadata.universeScope === 'extended';
  for (const tabId of ['scr-tab-backtest', 'scr-tab-evidence']) {
    const tab = documentRef.getElementById(tabId);
    if (!tab) continue;
    let note = tab.querySelector(':scope > .scr-core-only-note');
    if (!note && coreOnly) {
      note = documentRef.createElement('p');
      note.className = 'scr-core-only-note';
      tab.prepend(note);
    }
    if (note) {
      note.textContent = coreOnly ? `확장 범위를 골라도 이 탭의 검증·기록은 기본 유니버스(${metadata.coreUniverseRows || '—'}종목)만 다룹니다.` : '';
      note.hidden = !coreOnly;
    }
  }
}

// ── 맞춤 조건 panel (merged from src/ui/components/screener-custom.js) ──

// Conditions last for the session (a screen change remounts the panel); the UI layer keeps no browser storage.
let sessionConditions = [];
// 개편 v2 (5i): the panel's styles live in src/ui/styles/v2-screener.css (they were injected as a <style> string).

export const el = (doc, tag, className, text) => {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const rememberConditions = (conditions) => { sessionConditions = conditions; };

/** Builds the panel once; returns update(rows, read) for the counts and dispose(). */
export function installCustomConditions(documentRef) {
  const host = documentRef?.getElementById('scr-custom');
  const input = documentRef?.getElementById('scr-custom-conditions');
  if (!host || !input) return { update() {}, dispose() {} };
  host.querySelectorAll(':scope > :not(#scr-custom-conditions)').forEach((node) => node.remove());
  // v59.70 (S12): the chosen 맞춤 조건 are chips in the condition row under the bar; the picker stays in the + 조건 panel.
  const chipRow = documentRef.getElementById('scr-active-filter-chips')?.closest('.scr-chip-row') || null;
  chipRow?.querySelectorAll(':scope > .scr-custom-list').forEach((node) => node.remove());

  const textRow = el(documentRef, 'div', 'scr-custom-row');
  const text = el(documentRef, 'input');
  text.type = 'text';
  text.id = 'scr-custom-text';
  text.setAttribute('aria-label', '조건을 문장으로 입력');
  text.placeholder = '예: 5/10/20 정배열이면서 신고가, VCP 수렴, PER 20 이하 ROE 15% 이상';
  const apply = el(documentRef, 'button', 'aio-btn-table', '문장으로 적용');
  apply.type = 'button';
  textRow.append(text, apply);

  const pickRow = el(documentRef, 'div', 'scr-custom-row');
  const select = el(documentRef, 'select');
  select.setAttribute('aria-label', '추가할 맞춤 조건');
  select.append(Object.assign(el(documentRef, 'option', '', '조건 고르기'), { value: '' }));
  for (const group of [...new Set(CUSTOM_CONDITIONS.map((item) => item.group))]) {
    const optgroup = el(documentRef, 'optgroup');
    optgroup.label = group;
    CUSTOM_CONDITIONS.filter((item) => item.group === group).forEach((item) => optgroup.append(Object.assign(el(documentRef, 'option', '', conditionLabel({ id: item.id })), { value: item.id })));
    select.append(optgroup);
  }
  const add = el(documentRef, 'button', 'aio-btn-table scr-custom-add', '추가');
  add.type = 'button';
  pickRow.append(select, add);

  const recipes = el(documentRef, 'div', 'scr-custom-recipes');
  recipes.append(el(documentRef, 'span', '', '빠른 시작'));
  CUSTOM_RECIPES.forEach((recipe, index) => {
    const button = el(documentRef, 'button', 'scr-custom-recipe', recipe.label);
    button.type = 'button';
    button.dataset.recipe = String(index);
    recipes.append(button);
  });
  const list = el(documentRef, 'div', 'scr-custom-list');
  const note = el(documentRef, 'div', 'scr-custom-note');
  note.setAttribute('role', 'status');
  host.append(recipes, pickRow, textRow, note);
  (chipRow || host).append(list);

  let current = parseConditionValue(input.value);
  if (!current.length) current = normalizeConditions(sessionConditions);
  let lastCounts = new Map();
  let lastSignature = '';
  let parseNote = '';
  let searchFromPanel = '';
  // The words this panel put into the name·sector search leave with the conditions they came with.
  const releaseSearch = () => {
    const search = documentRef.getElementById('scr-text-search');
    if (search && searchFromPanel && search.value === searchFromPanel) { search.value = ''; search.dispatchEvent(new Event('change', { bubbles: true })); }
    searchFromPanel = '';
  };
  // v58.63 (SCR04): a strict bound (미만/초과) is part of the chip's identity, so "PER 20 미만" rebuilds a "PER 20 이하" chip.
  const chipKey = (condition) => `${condition.id}${condition.strict ? ':strict' : ''}`;
  const buildChip = (condition) => {
    const chip = el(documentRef, 'span', 'scr-custom-chip');
    chip.dataset.chip = chipKey(condition);
    const [before, after] = conditionTemplate(condition).split('{n}');
    chip.append(before);
    if (after != null) {
      const value = el(documentRef, 'input');
      value.type = 'number';
      value.step = 'any';
      value.dataset.condition = condition.id;
      chip.append(value, after);
    }
    const remove = el(documentRef, 'button', 'scr-filter-chip-x', '×');
    remove.type = 'button';
    remove.dataset.remove = condition.id;
    chip.append(remove);
    return chip;
  };
  const findIn = (attr, id) => [...list.querySelectorAll(`[data-${attr}]`)].find((node) => node.dataset[attr] === id) || null;
  // v57.61 WCAG 2.4.3: chips are keyed by condition id and only rebuilt when the set or order changes; otherwise the
  // values and counts are synced in place so a focused chip input or 빼기 button keeps focus across screener renders.
  const renderChips = () => {
    const ids = current.map(chipKey);
    const chips = [...list.children];
    if (chips.length !== ids.length || chips.some((chip, index) => chip.dataset.chip !== ids[index])) {
      const active = documentRef.activeElement;
      const focusKey = active && list.contains(active)
        ? (active.dataset.condition ? ['condition', active.dataset.condition] : active.dataset.remove ? ['remove', active.dataset.remove] : null)
        : null;
      list.replaceChildren(...current.map(buildChip));
      if (focusKey) findIn(focusKey[0], focusKey[1])?.focus();
    }
    current.forEach((condition) => {
      const chip = findIn('chip', chipKey(condition));
      if (!chip) return;
      const value = chip.querySelector('input[data-condition]');
      if (value) {
        if (documentRef.activeElement !== value && value.value !== String(condition.value)) value.value = String(condition.value);
        value.setAttribute('aria-label', `${conditionLabel(condition)} 기준값`);
      }
      const remove = chip.querySelector('button[data-remove]');
      remove.setAttribute('aria-label', `${conditionLabel(condition)} 조건 빼기`);
      const count = lastCounts.get(condition.id);
      let em = chip.querySelector('em');
      if (!count) { em?.remove(); return; }
      if (!em) { em = el(documentRef, 'em'); chip.insertBefore(em, remove); }
      const label = count.withData ? `${count.pass}종목` : '자료 없음';
      if (em.textContent !== label) em.textContent = label;
    });
  };
  const commit = (next) => {
    current = normalizeConditions(next);
    input.value = JSON.stringify(current);
    rememberConditions(current);
    renderChips();
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const applySentence = (parsed, sentence) => {
    // v58.63 (SCR04): OR, an inverted direction or a won amount applies nothing and keeps the sentence, instead of a silently different screen.
    if (parsed.unsupported?.length) {
      const why = { or: "조건은 모두 '그리고'로 묶입니다('또는'은 지원하지 않습니다)", inverted: '반대 방향(예: PER 이상)은 목록에 없는 조건입니다', won: '거래대금은 달러 백만 단위(예: 거래대금 20백만)로 적습니다' };
      const reasons = (parsed.reasons?.length ? parsed.reasons : Object.keys(why)).map((key) => why[key]).filter(Boolean);
      parseNote = `'${parsed.unsupported.join("', '")}'는 적용하지 않았습니다. ${reasons.join(', ')}. 문장을 고쳐 다시 적용해 주세요.`;
      note.textContent = parseNote;
      return;
    }
    // v58.80 run-5 (breaker #6): only words shaped like a name or sector ('반도체', 'NVDA') become the name search; emoji,
    // other scripts or SQL fragments are reported as not applied instead of silently narrowing the table to 0.
    const words = String(parsed.unknown || '').split(/\s+/).filter(Boolean);
    const searchWords = words.filter((word) => /^[\p{Script=Hangul}A-Za-z0-9.&-]{2,30}$/u.test(word));
    const dropped = words.filter((word) => !searchWords.includes(word));
    const searchText = searchWords.join(' ');
    parseNote = !parsed.conditions.length ? '알아들은 조건이 없습니다. 아래 목록에서 골라 주세요.'
      : [searchText ? `'${searchText}'는 조건으로 읽지 못해 이름·업종 검색에 넣었습니다(순위 표 위 검색칸에서 지울 수 있습니다).` : '',
        dropped.length ? `'${dropped.join(' ')}'는 읽지 못해 적용하지 않았습니다.` : ''].filter(Boolean).join(' ');
    if (searchText && parsed.conditions.length) {
      const search = documentRef.getElementById('scr-text-search');
      if (search) { search.value = searchText; searchFromPanel = searchText; search.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    if (parsed.conditions.length) { if (text.value === sentence) text.value = ''; commit([...current, ...parsed.conditions]); } else note.textContent = parseNote;
  };
  const onClick = (event) => {
    const target = event.target;
    if (target === apply) {
      // v58.63: the sentence parser loads on the click (boot budget); the picker below works without it.
      const sentence = text.value;
      import('../../../domain/screener/condition-text-parser.js').then(({ parseConditionText }) => applySentence(parseConditionText(sentence), sentence))
        .catch(() => { note.textContent = '문장 해석을 불러오지 못했습니다. 아래 목록에서 골라 주세요.'; });
    } else if (target === add && select.value) {
      commit([...current, { id: select.value }]);
      select.value = '';
    } else if (target.dataset?.recipe != null) {
      parseNote = '';
      releaseSearch();
      commit(CUSTOM_RECIPES[Number(target.dataset.recipe)]?.conditions || []);
    } else if (target.dataset?.remove) {
      const index = current.findIndex((condition) => condition.id === target.dataset.remove);
      commit(current.filter((condition) => condition.id !== target.dataset.remove));
      // The removed button is gone: move focus to the next chip's 빼기 (or the previous one), else the picker.
      const removes = list.querySelectorAll('button[data-remove]');
      (removes[index] || removes[index - 1] || documentRef.getElementById('scr-add-condition') || select).focus();
    }
  };
  const onChange = (event) => {
    const id = event.target.dataset?.condition;
    if (!id) return;
    event.stopPropagation();
    commit(current.map((condition) => (condition.id === id ? { ...condition, value: event.target.value } : condition)));
  };
  const onKey = (event) => { if (event.key === 'Enter' && event.target === text) { event.preventDefault(); apply.click(); } };
  for (const node of [host, list]) { node.addEventListener('click', onClick); node.addEventListener('change', onChange); }
  host.addEventListener('keydown', onKey);
  input.value = JSON.stringify(current);
  renderChips();
  return {
    /** rows: the listing market's rows; counts: conditionCoverage result; shown: rows left after every filter. */
    update(counts = [], shown = null, available = null) {
      if (available) {
        for (const option of select.querySelectorAll('option[value]')) {
          if (!option.value) continue;
          option.disabled = !available.has(option.value);
          option.textContent = `${conditionLabel({ id: option.value })}${option.disabled ? ' — 이 시장 자료 없음' : ''}`;
        }
      }
      const fromInput = parseConditionValue(input.value);
      if (JSON.stringify(fromInput) !== JSON.stringify(current)) { current = fromInput; rememberConditions(current); }
      const signature = JSON.stringify([current, counts.map((item) => [item.id, item.pass, item.withData])]);
      if (signature !== lastSignature) {
        lastSignature = signature;
        lastCounts = new Map(counts.map((item) => [item.id, item]));
        renderChips();
      }
      const missing = counts.filter((item) => !item.withData).length;
      // role=status: only touch the text when it changes so the count is not re-announced on every render.
      // 2026-10-18 bookmarks (volatility-base-rates): each added condition narrows the sample; the combination is not a tested rule.
      const noteText = [current.length && shown != null ? `조건을 모두 만족하고 다른 필터도 통과한 종목 ${shown}개` : '',
        // Screen audit 2026-10-20: 하방 과확장 matched 110 stocks yet the default table showed 0 — 실행 통과만 (on by default)
        // keeps the table on the last run's passed set, and nothing said so.
        current.length && shown === 0 && documentRef.getElementById('scr-passed-only')?.checked && counts.some((item) => item.pass > 0)
          ? "'조건 통과만'이 켜져 있어 조건 화면을 통과한 종목 안에서만 찾았습니다 — 끄면 전체 종목에서 찾습니다" : '',
        current.length >= 3 ? `조건 ${current.length}개를 겹쳤습니다 — 조건마다 남는 종목이 줄고, 이 조합은 과거 성과로 검증한 규칙이 아닙니다.` : '',
        missing ? '자료 없음 조건은 이 시장 종목에 해당 자료가 없거나(재무는 미국만) 다음 데이터 갱신부터 채워집니다.' : '', parseNote].filter(Boolean).join(', ');
      if (note.textContent !== noteText) note.textContent = noteText;
    },
    /** 조건 모두 지우기: the conditions and the search words they brought leave together. */
    clear() { parseNote = ''; releaseSearch(); commit([]); },
    dispose() {
      for (const node of [host, list]) { node.removeEventListener('click', onClick); node.removeEventListener('change', onChange); }
      host.removeEventListener('keydown', onKey);
    }
  };
}

/** The condition bar: 표에서 찾기 (/), 시장, 섹터, the + 조건 and 보기 panels, the chips and the table filters. */
export function createFiltersController(ctx) {
  const { documentRef, root, store, page, bag, sortState, visibleLimit, selectedSymbols, compareSymbols, onUniverseScopeChange } = ctx;
  // The population lines and the method fold sit under the table (#scr-population-holder): the counts behind the
  // ranking, why some rows are not ranked, and the 확장 range status.
  const populationHolder = documentRef.getElementById('scr-population-holder');
  if (populationHolder && !documentRef.getElementById('scr-population-note')) {
    const status = documentRef.createElement('p'); status.id = 'scr-universe-status'; status.setAttribute('aria-live', 'polite'); status.hidden = true;
    const note = documentRef.createElement('p'); note.id = 'scr-population-note'; note.setAttribute('aria-live', 'polite');
    // audit #3: why some of the population is not ranked — one folded line under the universe line.
    const excluded = documentRef.createElement('details'); excluded.id = 'scr-population-excluded'; excluded.className = 'scr-ranking-method'; excluded.hidden = true;
    excluded.append(documentRef.createElement('summary'), documentRef.createElement('p'));
    const method = documentRef.createElement('details'); method.className = 'scr-ranking-method';
    const summary = documentRef.createElement('summary'); summary.textContent = '순위가 계산되는 방식';
    const explanation = documentRef.createElement('p'); explanation.textContent = '모멘텀은 1개월·3개월·6개월 수익률을 40%·40%·20%로, 추세는 50일선·200일선 대비 거리를 60%·40%로 묶습니다. 각 팩터를 같은 시장의 업종 내 분포로 조정한 뒤 선택한 비중으로 합산합니다. 표본이 작은 업종은 같은 시장 전체 분포를 함께 씁니다. 높은 추세 값은 이동평균에서 멀다는 뜻도 있으므로 과열·변동폭과 함께 읽습니다. 3개월 수익률 정렬은 이 합산과 별도로 실제 수익률을 비교합니다. 필수 자료가 없거나 선택 조건을 통과하지 못하면 순위를 보류합니다.';
    method.append(summary, explanation);
    populationHolder.append(status, note, excluded, method);
  }
  // v57.81: 종목 범위 — 기본 (core universe) by default; 확장 adds every Russell 2000 member and Nasdaq-listed common
  // stock from a separate shard that is downloaded only after this choice. The choice is remembered per reader.
  documentRef.getElementById('scr-universe-scope').value = readUniverseScope(root);

  // v59.70 (S12): + 조건 and 보기 open one panel each under the bar (one open at a time). Escape or a click outside closes
  // the panel and returns focus to its button.
  const panelButton = (id) => page.querySelector(`[data-aio-screener-action="toggle-panel"][data-aio-screener-arg="${id}"]`);
  const openPanel = () => [...page.querySelectorAll('.scr-panel')].find((panel) => !panel.hidden) || null;
  ctx.setPanel = (id, open, { returnFocus = true } = {}) => {
    for (const panel of page.querySelectorAll('.scr-panel')) {
      const on = !!open && panel.id === id;
      const wasOpen = !panel.hidden;
      panel.hidden = !on;
      panelButton(panel.id)?.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (wasOpen && !on && returnFocus && panel.contains(documentRef.activeElement)) panelButton(panel.id)?.focus?.({ preventScroll: true });
    }
    if (open) documentRef.getElementById(id)?.querySelector('button, select, input')?.focus?.({ preventScroll: true });
  };
  const onPanelKeydown = (event) => {
    const panel = openPanel();
    if (event.key !== 'Escape' || !panel) return;
    if (!panel.contains(event.target) && event.target !== panelButton(panel.id)) return;
    event.preventDefault();
    ctx.setPanel(panel.id, false);
    panelButton(panel.id)?.focus?.({ preventScroll: true });
  };
  const onOutside = (event) => {
    const panel = openPanel();
    if (!panel || panel.contains(event.target) || event.target.closest?.('[data-aio-screener-action="toggle-panel"]')) return;
    ctx.setPanel(panel.id, false, { returnFocus: false });
  };
  // '/' focuses 표에서 찾기 (the command search keeps Ctrl+K); typing in a field keeps its slash.
  const onSlash = (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || !page.classList.contains('active')) return;
    const target = event.target;
    if (target?.closest?.('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return;
    const search = documentRef.getElementById('scr-text-search');
    if (!search) return;
    event.preventDefault();
    search.focus();
    search.select?.();
  };
  page.addEventListener('keydown', onPanelKeydown);
  documentRef.addEventListener('pointerdown', onOutside, true);
  documentRef.addEventListener('keydown', onSlash);
  bag.add(() => {
    page.removeEventListener('keydown', onPanelKeydown);
    documentRef.removeEventListener('pointerdown', onOutside, true);
    documentRef.removeEventListener('keydown', onSlash);
    ctx.setPanel(null, false, { returnFocus: false });
  });

  const fillSelect = (id, key, label) => {
    const select = documentRef.getElementById(id);
    if (!select) return;
    const values = [...new Set(scopedRows(selectScreenerState(store.getState())?.rows || [], selectedValue(documentRef, 'scr-listing-market') || 'US').map((row) => row[key]).filter(Boolean))].sort();
    const signature = `${selectedValue(documentRef, 'scr-listing-market')}|${values.join('|')}`;
    if (select.dataset.aioValues === signature) return;
    const current = select.value;
    const options = [documentRef.createElement('option'), ...values.map(() => documentRef.createElement('option'))];
    options[0].value = '';
    options[0].textContent = label;
    values.forEach((value, index) => {
      options[index + 1].value = value;
      // 2026-10-14 audit #18: Korean option names; the value stays the artifact's own key.
      options[index + 1].textContent = key === 'index' ? (INDEX_LABELS[value] || INDEX_CODE_LABELS[value]?.[0] || value) : key === 'sector' ? sectorLabel(value) : value;
    });
    select.replaceChildren(...options);
    select.value = values.includes(current) ? current : '';
    select.dataset.aioValues = signature;
  };
  ctx.fillControls = () => {
    fillSelect('scr-market', 'index', '전체 지수'); fillSelect('scr-sector', 'sector', '전체 섹터');
    // v57.50 I01: apply a handed-over sector once its option exists (rows may arrive after mount).
    const sectorSelect = ctx.pendingSector ? documentRef.getElementById('scr-sector') : null;
    if (sectorSelect) {
      const options = [...sectorSelect.options].map((option) => option.value).filter(Boolean);
      const match = options.includes(ctx.pendingSector) ? ctx.pendingSector : sectorsForEtf(ctx.pendingSector).find((name) => options.includes(name));
      if (match) { sectorSelect.value = match; ctx.pendingSector = null; visibleLimit.value = 12; }
    }
  };
  ctx.actions.push((action, argument) => {
    if (action === 'toggle-panel') {
      ctx.setPanel(argument, documentRef.getElementById(argument)?.hidden !== false);
    } else if (action === 'close-panel') {
      ctx.setPanel(argument, false);
      panelButton(argument)?.focus?.({ preventScroll: true });
    } else if (action === 'passed-only') {
      const passedOnly = documentRef.getElementById('scr-passed-only');
      if (passedOnly) passedOnly.checked = true;
      visibleLimit.value = 12;
      ctx.renderNow();
    } else if (action === 'clear-filter') {
      const target = documentRef.getElementById(argument);
      if (target) { if (target.type === 'checkbox') target.checked = false; else target.value = argument === 'scr-min-rank' ? '0' : ''; }
      visibleLimit.value = 12;
      ctx.renderNow();
      // The chip that was pressed is gone: focus moves to the next chip, else to + 조건.
      (documentRef.querySelector('#scr-active-filter-chips [data-aio-screener-action="clear-filter"]') || documentRef.getElementById('scr-add-condition'))?.focus?.({ preventScroll: true });
    } else if (action === 'reset-all-filters') {
      ['scr-market', 'scr-sector', 'scr-cap', 'scr-text-search', 'scr-setup', 'scr-rsi-min', 'scr-rsi-max', 'scr-min-mom'].forEach((id) => { const field = documentRef.getElementById(id); if (field) field.value = ''; });
      const rank = documentRef.getElementById('scr-min-rank'); if (rank) rank.value = '0';
      const watchlist = documentRef.getElementById('scr-watchlist-only'); if (watchlist) watchlist.checked = false;
      const passedOnly = documentRef.getElementById('scr-passed-only'); if (passedOnly) passedOnly.checked = true;
      screenerRuntime.customPanel?.clear?.();
      visibleLimit.value = 12;
      ctx.renderNow();
    } else return false;
    return true;
  });
  ctx.inputs.push((event) => {
    if (event.target.matches?.('#scr-listing-market')) {
      root._aioScreenerListingMarket = event.target.value;
      ctx.activeRow = null; ctx.autoInspected = false; // 개편 v2: the inspector restarts on the new market's first row
      if (ctx.whyDrawerNode) ctx.whyDrawerNode.hidden = true;
      ++ctx.runGeneration; ctx.activeResult = null; ctx.activeRows = null; ctx.activePreview = null; ctx.activePreviewKey = null;
      selectedSymbols.clear(); compareSymbols.clear(); visibleLimit.value = 12; ctx.readSignature = '';
      for (const id of ['scr-market', 'scr-sector']) { const field = documentRef.getElementById(id); if (field) { field.value = ''; delete field.dataset.aioValues; } }
      ctx.fillControls(); ctx.rerender(); ctx.renderRead();
    } else if (event.target.matches?.('#scr-universe-scope')) {
      if (event.type !== 'change') return true;
      writeUniverseScope(root, event.target.value);
      ++ctx.runGeneration; ctx.activeResult = null; ctx.activeRows = null; ctx.activePreview = null; ctx.activePreviewKey = null;
      selectedSymbols.clear(); compareSymbols.clear(); visibleLimit.value = 12; ctx.readSignature = '';
      for (const id of ['scr-market', 'scr-sector']) { const field = documentRef.getElementById(id); if (field) delete field.dataset.aioValues; }
      ctx.renderNow();
      Promise.resolve(onUniverseScopeChange?.(event.target.value)).catch(() => {});
    } else if (event.target.matches?.('#scr-order')) {
      sortState.column = event.target.value; sortState.ascending = event.target.value === 'screenRank';
      visibleLimit.value = 12; ctx.renderNow();
    } else if (event.target.matches?.('#scr-market, #scr-sector, #scr-cap, #scr-setup, #scr-min-rank, #scr-rsi-min, #scr-rsi-max, #scr-min-mom, #scr-text-search, #scr-watchlist-only, #scr-passed-only, #scr-custom-conditions')) {
      event.stopPropagation();
      // v57.81: the search box's blur-time change must not re-render a table the pause already rendered, or the
      // first tap on a row button (비교 +, 관심) after typing lands on a node that the re-render just replaced.
      if (event.type === 'change' && event.target.id === 'scr-text-search' && !ctx.searchTimer) return true;
      // v57.61: typing in the name·sector search re-renders at most once per pause (150ms); change renders at once.
      if (ctx.searchTimer) { clearTimeout(ctx.searchTimer); ctx.searchTimer = null; }
      if (event.type === 'input' && event.target.id === 'scr-text-search') {
        ctx.searchTimer = setTimeout(() => { ctx.searchTimer = null; visibleLimit.value = 12; ctx.renderNow(); }, 150);
        return true;
      }
      visibleLimit.value = 12;
      ctx.renderNow();
    } else return false;
    return true;
  });
}
