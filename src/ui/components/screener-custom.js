/**
 * 맞춤 조건 panel for the screener (owner request 2026-10-14).
 *
 * The chosen conditions live in the hidden #scr-custom-conditions input as JSON, so the screener's own filter,
 * re-render, reset and result counts handle them like any other control (filterRows reads that value). This panel
 * only edits the value and shows, per condition, how many rows pass and how many carry its data.
 */
import { CUSTOM_CONDITIONS, CUSTOM_RECIPES, conditionLabel, conditionTemplate, normalizeConditions, parseConditionValue } from '../../domain/screener/custom-conditions.js';

// Conditions last for the session (a screen change remounts the panel); the UI layer keeps no browser storage.
let sessionConditions = [];
// 개편 v2 (5i): the panel's styles live in src/ui/styles/v2-screener.css (they were injected as a <style> string).

const el = (doc, tag, className, text) => {
  const node = doc.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const store = (conditions) => { sessionConditions = conditions; };

/** Builds the panel once; returns update(rows, read) for the counts and dispose(). */
export function installCustomConditions(documentRef) {
  const host = documentRef?.getElementById('scr-custom');
  const input = documentRef?.getElementById('scr-custom-conditions');
  if (!host || !input) return { update() {}, dispose() {} };
  host.querySelectorAll(':scope > :not(#scr-custom-conditions)').forEach((node) => node.remove());
  const head = el(documentRef, 'div', 'scr-custom-hd');
  const title = el(documentRef, 'strong', '', '맞춤 조건');
  title.id = 'scr-custom-title';
  head.append(title, el(documentRef, 'span', '', '고른 조건을 모두 만족하는 종목만 순위 표에 남깁니다.'));

  const textRow = el(documentRef, 'div', 'scr-custom-row');
  const text = el(documentRef, 'input');
  text.type = 'text';
  text.id = 'scr-custom-text';
  text.setAttribute('aria-label', '조건을 문장으로 입력');
  text.placeholder = '예: 5/10/20 정배열이면서 신고가, VCP 수렴, PER 20 이하 ROE 15% 이상';
  const apply = el(documentRef, 'button', 'aio-btn-table', '조건 적용');
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
  const add = el(documentRef, 'button', 'aio-btn-table scr-custom-add', '+ 조건 추가');
  add.type = 'button';
  const clear = el(documentRef, 'button', 'aio-btn-table', '모두 지우기');
  clear.type = 'button';
  pickRow.append(select, add, clear);

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
  host.append(head, recipes, list, pickRow, textRow, note);

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
    const remove = el(documentRef, 'button', '', '빼기');
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
    store(current);
    renderChips();
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const applySentence = (parsed, sentence) => {
    // v58.63 (SCR04): OR, an inverted direction or a won amount applies nothing and keeps the sentence, instead of a silently different screen.
    if (parsed.unsupported?.length) {
      parseNote = `'${parsed.unsupported.join("', '")}'는 적용하지 않았습니다. 조건은 모두 '그리고'로 묶이며, 반대 방향(예: PER 이상)은 목록에 없는 조건이고, 거래대금은 달러 백만 단위(예: 거래대금 20백만)로 적습니다. 문장을 고쳐 다시 적용해 주세요.`;
      note.textContent = parseNote;
      return;
    }
    parseNote = !parsed.conditions.length ? '알아들은 조건이 없습니다. 아래 목록에서 골라 주세요.'
      : parsed.unknown ? `'${parsed.unknown}'는 조건으로 읽지 못해 이름·업종 검색에 넣었습니다.` : '';
    if (parsed.unknown && parsed.conditions.length) {
      const search = documentRef.getElementById('scr-text-search');
      if (search) { search.value = parsed.unknown; searchFromPanel = parsed.unknown; search.dispatchEvent(new Event('change', { bubbles: true })); }
    }
    if (parsed.conditions.length) { if (text.value === sentence) text.value = ''; commit([...current, ...parsed.conditions]); } else note.textContent = parseNote;
  };
  const onClick = (event) => {
    const target = event.target;
    if (target === apply) {
      // v58.63: the sentence parser loads on the click (boot budget); the picker below works without it.
      const sentence = text.value;
      import('../../domain/screener/condition-text-parser.js').then(({ parseConditionText }) => applySentence(parseConditionText(sentence), sentence))
        .catch(() => { note.textContent = '문장 해석을 불러오지 못했습니다. 아래 목록에서 골라 주세요.'; });
    } else if (target === add && select.value) {
      commit([...current, { id: select.value }]);
      select.value = '';
    } else if (target === clear) {
      parseNote = '';
      releaseSearch();
      commit([]);
    } else if (target.dataset?.recipe != null) {
      parseNote = '';
      releaseSearch();
      commit(CUSTOM_RECIPES[Number(target.dataset.recipe)]?.conditions || []);
    } else if (target.dataset?.remove) {
      const index = current.findIndex((condition) => condition.id === target.dataset.remove);
      commit(current.filter((condition) => condition.id !== target.dataset.remove));
      // The removed button is gone: move focus to the next chip's 빼기 (or the previous one), else the picker.
      const removes = list.querySelectorAll('button[data-remove]');
      (removes[index] || removes[index - 1] || select).focus();
    }
  };
  const onChange = (event) => {
    const id = event.target.dataset?.condition;
    if (!id) return;
    event.stopPropagation();
    commit(current.map((condition) => (condition.id === id ? { ...condition, value: event.target.value } : condition)));
  };
  const onKey = (event) => { if (event.key === 'Enter' && event.target === text) { event.preventDefault(); apply.click(); } };
  host.addEventListener('click', onClick);
  host.addEventListener('change', onChange);
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
      if (JSON.stringify(fromInput) !== JSON.stringify(current)) { current = fromInput; store(current); }
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
          ? "'실행 통과만'이 켜져 있어 마지막 실행을 통과한 종목 안에서만 찾았습니다 — 끄면 전체 종목에서 찾습니다" : '',
        current.length >= 3 ? `조건 ${current.length}개를 겹쳤습니다 — 조건마다 남는 종목이 줄고, 이 조합은 과거 성과로 검증한 규칙이 아닙니다.` : '',
        missing ? '자료 없음 조건은 이 시장 종목에 해당 자료가 없거나(재무는 미국만) 다음 데이터 갱신부터 채워집니다.' : '', parseNote].filter(Boolean).join(', ');
      if (note.textContent !== noteText) note.textContent = noteText;
    },
    dispose() {
      host.removeEventListener('click', onClick);
      host.removeEventListener('change', onChange);
      host.removeEventListener('keydown', onKey);
    }
  };
}
