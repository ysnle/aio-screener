/**
 * 맞춤 조건 panel for the screener (owner request 2026-10-14).
 *
 * The chosen conditions live in the hidden #scr-custom-conditions input as JSON, so the screener's own filter,
 * re-render, reset and result counts handle them like any other control (filterRows reads that value). This panel
 * only edits the value and shows, per condition, how many rows pass and how many carry its data.
 */
import { CUSTOM_CONDITIONS, CUSTOM_RECIPES, conditionLabel, normalizeConditions, parseConditionValue, parseConditionText } from '../../domain/screener/custom-conditions.js';

// Conditions last for the session (a screen change remounts the panel); the UI layer keeps no browser storage.
let sessionConditions = [];
const STYLE_ID = 'scr-custom-style';
const STYLE = `.scr-custom{display:grid;grid-template-columns:minmax(0,1fr);gap:8px;margin:10px 0 2px;padding:12px 0 0;border-top:1px solid var(--border);min-width:0;max-width:100%}.scr-custom>*{min-width:0}.scr-custom select{max-width:100%;min-width:0}
.scr-custom-hd{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}.scr-custom-hd strong{font-size:13px;color:var(--text-primary)}.scr-custom-hd span{font-size:12px;color:var(--text-muted)}
.scr-custom-row{display:flex;align-items:center;gap:6px;flex-wrap:wrap}.scr-custom-row input[type=text]{flex:1;min-width:200px}
.scr-custom-row input,.scr-custom-row select{min-height:32px;padding:6px 9px;border:1px solid var(--border);border-radius:4px;background:var(--surface-1);color:var(--text-primary);font:inherit;font-size:13px}
.scr-custom-recipes{display:flex;gap:6px;flex-wrap:wrap;align-items:center}.scr-custom-recipes>span{font-size:12px;color:var(--text-muted)}
.scr-custom-recipe{min-height:28px;padding:3px 10px;border:1px solid var(--border);border-radius:4px;background:transparent;color:var(--text-primary);font:inherit;font-size:12px;cursor:pointer}
.scr-custom-recipe:hover{border-color:var(--text-primary)}
.scr-custom-list{display:flex;gap:6px;flex-wrap:wrap}
.scr-custom-chip{display:inline-flex;align-items:center;gap:6px;min-height:30px;padding:3px 4px 3px 10px;border:1px solid var(--accent-border,var(--border));border-radius:4px;background:var(--accent-soft,var(--surface-1));font-size:12px;color:var(--text-primary)}
.scr-custom-chip input{width:58px;min-height:24px;padding:2px 4px;border:1px solid var(--border);border-radius:3px;background:var(--surface-1);color:var(--text-primary);font:inherit;font-size:12px}
.scr-custom-chip em{font-style:normal;color:var(--text-muted)}
.scr-custom-chip button{min-width:28px;min-height:24px;border:0;background:transparent;color:var(--text-secondary);font:inherit;font-size:12px;cursor:pointer}
.scr-custom-note{font-size:12px;line-height:1.6;color:var(--text-muted)}
@media (max-width:640px){.scr-custom-row input[type=text]{min-width:0;width:100%;flex-basis:100%}.scr-custom-row select{flex:1 1 100%}}`;

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
  if (!documentRef.getElementById(STYLE_ID)) {
    const style = el(documentRef, 'style');
    style.id = STYLE_ID;
    style.textContent = STYLE;
    documentRef.head.append(style);
  }
  host.querySelectorAll(':scope > :not(#scr-custom-conditions)').forEach((node) => node.remove());
  const head = el(documentRef, 'div', 'scr-custom-hd');
  const title = el(documentRef, 'strong', '', '맞춤 조건');
  title.id = 'scr-custom-title';
  head.append(title, el(documentRef, 'span', '', '고른 조건을 모두 만족하는 종목만 표에 남깁니다. 걸러 보는 도구이며 매매 신호가 아닙니다.'));

  const textRow = el(documentRef, 'div', 'scr-custom-row');
  const text = el(documentRef, 'input');
  text.type = 'text';
  text.id = 'scr-custom-text';
  text.setAttribute('aria-label', '조건을 문장으로 입력');
  text.placeholder = '예: 5/10/20 정배열이면서 신고가 · VCP 수렴 · PER 20 이하 ROE 15% 이상';
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
  const add = el(documentRef, 'button', 'aio-btn-table', '추가');
  add.type = 'button';
  const clear = el(documentRef, 'button', 'aio-btn-table', '모두 지우기');
  clear.type = 'button';
  pickRow.append(select, add, clear);

  const recipes = el(documentRef, 'div', 'scr-custom-recipes');
  recipes.append(el(documentRef, 'span', '', '예시 조합'));
  CUSTOM_RECIPES.forEach((recipe, index) => {
    const button = el(documentRef, 'button', 'scr-custom-recipe', recipe.label);
    button.type = 'button';
    button.dataset.recipe = String(index);
    recipes.append(button);
  });
  const list = el(documentRef, 'div', 'scr-custom-list');
  list.setAttribute('aria-live', 'polite');
  const note = el(documentRef, 'div', 'scr-custom-note');
  host.append(head, textRow, recipes, pickRow, list, note);

  let current = parseConditionValue(input.value);
  if (!current.length) current = normalizeConditions(sessionConditions);
  let lastCounts = new Map();
  let parseNote = '';
  let searchFromPanel = '';
  // The words this panel put into the name·sector search leave with the conditions they came with.
  const releaseSearch = () => {
    const search = documentRef.getElementById('scr-text-search');
    if (search && searchFromPanel && search.value === searchFromPanel) { search.value = ''; search.dispatchEvent(new Event('change', { bubbles: true })); }
    searchFromPanel = '';
  };
  const renderChips = () => {
    list.replaceChildren(...current.map((condition) => {
      const chip = el(documentRef, 'span', 'scr-custom-chip');
      const template = CUSTOM_CONDITIONS.find((item) => item.id === condition.id);
      const [before, after] = template.label.split('{n}');
      chip.append(before);
      if (after != null) {
        const value = el(documentRef, 'input');
        value.type = 'number';
        value.step = 'any';
        value.value = String(condition.value);
        value.dataset.condition = condition.id;
        value.setAttribute('aria-label', `${conditionLabel({ id: condition.id, value: condition.value })} 기준값`);
        chip.append(value, after);
      }
      const count = lastCounts.get(condition.id);
      if (count) chip.append(el(documentRef, 'em', '', count.withData ? `${count.pass}종목` : '자료 없음'));
      const remove = el(documentRef, 'button', '', '빼기');
      remove.type = 'button';
      remove.dataset.remove = condition.id;
      remove.setAttribute('aria-label', `${conditionLabel(condition)} 조건 빼기`);
      chip.append(remove);
      return chip;
    }));
  };
  const commit = (next) => {
    current = normalizeConditions(next);
    input.value = JSON.stringify(current);
    store(current);
    renderChips();
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const onClick = (event) => {
    const target = event.target;
    if (target === apply) {
      const parsed = parseConditionText(text.value);
      parseNote = !parsed.conditions.length ? '알아들은 조건이 없습니다. 아래 목록에서 골라 주세요.'
        : parsed.unknown ? `'${parsed.unknown}'는 조건으로 읽지 못해 이름·업종 검색에 넣었습니다.` : '';
      if (parsed.unknown && parsed.conditions.length) {
        const search = documentRef.getElementById('scr-text-search');
        if (search) { search.value = parsed.unknown; searchFromPanel = parsed.unknown; search.dispatchEvent(new Event('change', { bubbles: true })); }
      }
      if (parsed.conditions.length) { text.value = ''; commit([...current, ...parsed.conditions]); } else note.textContent = parseNote;
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
      commit(current.filter((condition) => condition.id !== target.dataset.remove));
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
    update(counts = [], shown = null) {
      const fromInput = parseConditionValue(input.value);
      if (JSON.stringify(fromInput) !== JSON.stringify(current)) { current = fromInput; store(current); }
      lastCounts = new Map(counts.map((item) => [item.id, item]));
      renderChips();
      const missing = counts.filter((item) => !item.withData).length;
      note.textContent = [current.length && shown != null ? `조건을 모두 만족하고 다른 필터도 통과한 종목 ${shown}개` : '',
        missing ? '자료 없음 조건은 다음 데이터 갱신부터 채워집니다(새로 추가한 지표).' : '', parseNote].filter(Boolean).join(' · ');
    },
    dispose() {
      host.removeEventListener('click', onClick);
      host.removeEventListener('change', onChange);
      host.removeEventListener('keydown', onKey);
    }
  };
}
