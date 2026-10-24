// v58.52 (owner 2026-10-20): 매매일지 · 복기 panel. The record and the reader's rules are stored through the shell's
// portfolio vault path (root._aioPortfolioTrades: same PIN encryption and backup as holdings and the account ledger);
// the numbers come from src/domain/portfolio/trade-journal.js. The form is built once per page mount so a live-quote
// re-render never wipes what the reader is typing; only the summary, mirrors and list are redrawn.
import { TRADE_REASONS, TRADE_MOODS, normalizeJournal, normalizeTrade, normalizeRules, realizeTrades, journalReview, rulesMirror } from '../../domain/portfolio/trade-journal.js';
import { signedText } from '../../domain/shared/number.js';

const FIELD_ERRORS = Object.freeze({ symbol: '종목 코드를 확인하세요', date: '날짜를 확인하세요', side: '매수·매도를 고르세요', qty: '수량은 0보다 커야 합니다', price: '가격은 0보다 커야 합니다', fee: '수수료는 0 이상이어야 합니다' });

function el(doc, tag, text, className) {
  const node = doc.createElement(tag);
  if (text != null) node.textContent = text;
  if (className) node.className = className;
  return node;
}
function field(doc, label, input) {
  if (!input.getAttribute('aria-label')) input.setAttribute('aria-label', label);
  const wrap = el(doc, 'label', null, 'pf-trade-field');
  wrap.append(el(doc, 'span', label), input);
  return wrap;
}
function input(doc, id, { type = 'text', placeholder = '', step = null, min = null, value = '' } = {}) {
  const node = el(doc, 'input');
  node.id = id; node.type = type; node.placeholder = placeholder; node.value = value;
  if (step != null) node.step = step;
  if (min != null) node.min = min;
  if (type === 'number') node.inputMode = 'decimal';
  return node;
}
function select(doc, id, options) {
  const node = el(doc, 'select');
  node.id = id;
  for (const [value, label] of options) { const option = el(doc, 'option', label); option.value = value; node.append(option); }
  return node;
}
const money = (amount, currency) => `${amount < 0 ? '-' : amount > 0 ? '+' : ''}${currency === 'KRW' ? '₩' : currency === 'USD' ? '$' : ''}${Math.abs(amount).toLocaleString('en-US', { maximumFractionDigits: currency === 'KRW' ? 0 : 2 })}${currency === 'KRW' || currency === 'USD' ? '' : ` ${currency}`}`;
const pct = (value, digits = 1) => (value == null ? '—' : signedText(value, digits, '%'));
const todayKst = (now = Date.now()) => new Date(now + 9 * 3600000).toISOString().slice(0, 10);

function store(root) {
  const api = root?._aioPortfolioTrades;
  return api && typeof api.read === 'function' && typeof api.write === 'function' ? api : null;
}
export function readJournal(root) { return normalizeJournal(store(root)?.read?.() || null); }

function buildSkeleton(doc, host, root) {
  host.replaceChildren();
  host.dataset.aioTradeJournal = 'built';
  host.append(el(doc, 'h2', '매매일지, 복기', 'briefing-h2'),
    el(doc, 'p', '사고판 기록을 이유와 함께 남기면, 끝난 거래의 손익과 내 매매 습관을 내 기록으로 보여 줍니다. 무엇을 사고팔지 권하지 않고, 내가 정한 원칙과 지금 상태의 차이만 보여 줍니다.', 'theme-strength-basis'));
  const form = el(doc, 'details', null, 'pf-trade-form');
  form.id = 'pf-trade-form';
  form.append(el(doc, 'summary', '거래 기록하기'));
  const grid = el(doc, 'div', null, 'pf-trade-grid');
  grid.append(
    field(doc, '날짜', input(doc, 'pf-trade-date', { type: 'date', value: todayKst() })),
    field(doc, '구분', select(doc, 'pf-trade-side', [['buy', '매수'], ['sell', '매도']])),
    field(doc, '종목', input(doc, 'pf-trade-symbol', { placeholder: 'NVDA, 005930.KS' })),
    field(doc, '수량', input(doc, 'pf-trade-qty', { type: 'number', min: '0', step: 'any' })),
    field(doc, '가격', input(doc, 'pf-trade-price', { type: 'number', min: '0', step: 'any' })),
    field(doc, '수수료·세금', input(doc, 'pf-trade-fee', { type: 'number', min: '0', step: 'any', placeholder: '0' })),
    field(doc, '이유', select(doc, 'pf-trade-reason', Object.entries(TRADE_REASONS))),
    field(doc, '그때 마음', select(doc, 'pf-trade-mood', [['', '적지 않음'], ...Object.entries(TRADE_MOODS)])),
    field(doc, '손절 가격(매수 시)', input(doc, 'pf-trade-stop', { type: 'number', min: '0', step: 'any' })),
    field(doc, '목표 가격(매수 시)', input(doc, 'pf-trade-target', { type: 'number', min: '0', step: 'any' }))
  );
  const note = el(doc, 'textarea');
  note.id = 'pf-trade-note'; note.maxLength = 500; note.rows = 2; note.placeholder = '근거, 확인한 것, 놓친 것';
  note.setAttribute('aria-label', '거래 메모');
  const actions = el(doc, 'div', null, 'pf-trade-actions');
  const add = el(doc, 'button', '기록', 'aio-btn-table primary');
  add.type = 'button'; add.dataset.tradeAction = 'add';
  const status = el(doc, 'span', '기록은 보유 종목과 같은 방식(PIN 설정 시 암호화)으로 이 브라우저에만 저장됩니다.', 'sh-muted-note');
  status.id = 'pf-trade-status'; status.setAttribute('role', 'status');
  actions.append(add, status);
  form.append(grid, field(doc, '메모', note), actions);

  const rules = el(doc, 'details', null, 'pf-trade-rules');
  rules.id = 'pf-trade-rules';
  rules.append(el(doc, 'summary', '내 원칙'));
  const r = readJournal(root).rules;
  const rulesGrid = el(doc, 'div', null, 'pf-trade-grid');
  rulesGrid.append(
    field(doc, '한 종목 최대 비중(%)', input(doc, 'pf-rule-max-position', { type: 'number', min: '1', step: 'any', value: r.maxPositionPct ?? '' })),
    field(doc, '현금 최소 비중(%)', input(doc, 'pf-rule-min-cash', { type: 'number', min: '1', step: 'any', value: r.minCashPct ?? '' })),
    field(doc, '손절 기준(-%)', input(doc, 'pf-rule-stop', { type: 'number', min: '1', step: 'any', value: r.stopLossPct ?? '' })),
    field(doc, '보유 종목 최대 개수', input(doc, 'pf-rule-max-positions', { type: 'number', min: '1', step: '1', value: r.maxPositions ?? '' }))
  );
  const saveRules = el(doc, 'button', '원칙 저장', 'aio-btn-table');
  saveRules.type = 'button'; saveRules.dataset.tradeAction = 'rules';
  rules.append(el(doc, 'p', '내가 정한 기준입니다. 아래에서 지금 보유 상태가 이 기준과 어긋나는지만 보여 줍니다(권고가 아닙니다).', 'theme-strength-basis'), rulesGrid, saveRules);

  const dynamic = el(doc, 'div', null, 'pf-trade-dynamic');
  dynamic.id = 'pf-trade-dynamic';
  host.append(form, rules, dynamic);
}

function readForm(doc) {
  const value = (id) => doc.getElementById(id)?.value ?? '';
  return { date: value('pf-trade-date'), side: value('pf-trade-side'), symbol: value('pf-trade-symbol'), qty: value('pf-trade-qty'), price: value('pf-trade-price'),
    fee: value('pf-trade-fee'), reason: value('pf-trade-reason'), mood: value('pf-trade-mood') || null, stop: value('pf-trade-stop'), target: value('pf-trade-target'), note: value('pf-trade-note') };
}
function setStatus(doc, text) { const node = doc.getElementById('pf-trade-status'); if (node) node.textContent = text; }

async function persist(doc, root, journal, okText, rerender) {
  const api = store(root);
  if (!api) { setStatus(doc, '저장 경로를 불러오지 못했습니다. 새로고침 후 다시 시도하세요.'); return false; }
  setStatus(doc, '저장 중…');
  let ack = null;
  try { ack = await api.write({ version: journal.version, trades: journal.trades, rules: journal.rules }); } catch (_) { ack = null; }
  setStatus(doc, ack && ack.ok ? okText : '영구 저장에 실패했습니다 — 새로고침하면 이 기록이 사라질 수 있습니다.');
  rerender();
  return !!(ack && ack.ok);
}

/** Current-book inputs for the rule mirror: weights of total assets (cash included) and open P&L by holding. */
function bookOf(surface) {
  const rows = Array.isArray(surface?.rows) ? surface.rows : [];
  const total = Number(surface?.totalAssets);
  const weights = Number.isFinite(total) && total > 0 ? rows.filter((row) => Number(row.value) > 0).map((row) => ({ symbol: row.symbol, pct: row.value / total * 100 })) : [];
  // v58.63 (architecture audit UI-D02): an undeclared price currency fell through `!row.currency`, so a KRW cost was divided
  // into a USD close ("-99.9% 손절 위반") while the surface held that P&L. The price side uses the listing currency as the
  // surface does; a cost in another currency is not compared.
  const losses = rows.filter((row) => {
    const priceCurrency = row.currency || row.listingCurrency || null;
    return Number(row.price) > 0 && Number(row.avgCost) > 0 && (!row.costCurrency || row.costCurrency === priceCurrency);
  }).map((row) => ({ symbol: row.symbol, pnlPct: (row.price / row.avgCost - 1) * 100 }));
  // v58.63 (UI-D01): Number(null) is 0, so an unentered cash balance read "지금 현금 0.0% — 벗어남"; and the holding count
  // came from valued rows only ("지금 0개" with two holdings awaiting a value). Missing stays missing; the count is the book's.
  const cashPct = surface?.cashPct == null || !Number.isFinite(Number(surface.cashPct)) ? null : Number(surface.cashPct);
  const holdingCount = Number.isFinite(Number(surface?.holdingCount)) ? Number(surface.holdingCount) : rows.length;
  return { weights, cashPct, losses, holdingCount };
}

function renderDynamic(doc, root, host, surface) {
  const target = doc.getElementById('pf-trade-dynamic');
  if (!target) return;
  const journal = readJournal(root);
  const { closed, open, unmatched } = realizeTrades(journal.trades);
  const review = journalReview(closed, journal.rules);
  const mirror = rulesMirror(journal.rules, bookOf(surface));
  const parts = [];
  if (mirror.length) {
    const box = el(doc, 'section', null, 'pf-trade-block');
    box.append(el(doc, 'h3', '내 원칙과 지금 상태', 'pf-trade-h3'));
    const list = el(doc, 'ul', null, 'pf-trade-mirror');
    for (const row of mirror) {
      const li = el(doc, 'li', null, `pf-trade-mirror-row is-${row.ok == null ? 'unknown' : row.ok ? 'favorable' : 'burden'}`);
      li.append(el(doc, 'span', row.ok == null ? '확인 불가' : row.ok ? '지킴' : '벗어남', 'pf-trade-mirror-state'), el(doc, 'strong', row.label), el(doc, 'span', ` — ${row.text}`));
      list.append(li);
    }
    box.append(list);
    parts.push(box);
  }
  const s = review.stats;
  const summary = el(doc, 'section', null, 'pf-trade-block');
  summary.append(el(doc, 'h3', '끝난 거래의 결과', 'pf-trade-h3'));
  if (!s.n) {
    summary.append(el(doc, 'p', journal.trades.length ? `매수 기록 ${open.length}건이 아직 열려 있습니다. ` : '아직 기록이 없습니다.', 'briefing-empty'));
  } else {
    const cards = el(doc, 'div', null, 'pf-trade-cards');
    const card = (label, value, sub) => { const node = el(doc, 'div', null, 'pf-trade-card'); node.append(el(doc, 'span', label, 'pf-trade-card-label'), el(doc, 'strong', value, 'pf-trade-card-value'), sub ? el(doc, 'span', sub, 'pf-trade-card-sub') : ''); return node; };
    cards.append(
      card('끝난 거래', `${s.n}건`, `이익 ${s.wins}, 손실 ${s.losses}`),
      card('승률', s.winRate == null ? '—' : `${s.winRate.toFixed(0)}%`, review.small ? `${s.n}건 기록, 표본 적음` : null),
      card('평균 이익, 손실', `${pct(s.avgWinPct)}, ${pct(s.avgLossPct)}`, s.payoff == null ? null : `손익비 ${s.payoff.toFixed(2)}`),
      card('실현 손익', Object.entries(s.pnlByCurrency).map(([currency, amount]) => money(amount, currency)).join(', ') || '—', '수수료·세금 반영'),
      card('보유 기간 중앙값', `이익 ${s.holdWinDays ?? '—'}일, 손실 ${s.holdLossDays ?? '—'}일`, null),
      // v58.75 (spec F6): shown only when some closed lot carried a stop price.
      ...(s.stopKept?.n ? [card('손절 가격 지킴', `${s.stopKept.kept}/${s.stopKept.n}건`, '매수 때 적은 손절 가격 이상에서 판 비율')] : [])
    );
    summary.append(cards);
    if (review.notes.length) {
      summary.append(el(doc, 'h4', '내 기록에서 보이는 것', 'pf-trade-h4'));
      const list = el(doc, 'ul', null, 'pf-trade-notes');
      for (const note of review.notes) list.append(el(doc, 'li', note.text, `is-${note.tone}`));
      summary.append(list);
    }
    if (s.byReason.length > 1) {
      const fold = el(doc, 'details', null, 'pf-trade-fold');
      fold.append(el(doc, 'summary', '매수 이유별 결과'));
      const list = el(doc, 'ul', null, 'pf-trade-notes');
      for (const row of s.byReason) list.append(el(doc, 'li', `${row.label} — ${row.n}건, 이익 ${row.wins}건, 평균 ${pct(row.avgPct)}`));
      fold.append(list);
      summary.append(fold);
    }
    // v58.75 (spec F6): results by the mood written at the buy, from the reader's own record (hidden with no mood written).
    if (s.byMood.length) {
      const fold = el(doc, 'details', null, 'pf-trade-fold');
      fold.append(el(doc, 'summary', '매수할 때 마음별 결과'));
      const list = el(doc, 'ul', null, 'pf-trade-notes');
      for (const row of s.byMood) list.append(el(doc, 'li', `${row.label} — ${row.n}건, 이익 ${row.wins}건, 평균 ${pct(row.avgPct)}`));
      fold.append(list);
      summary.append(fold);
    }
    summary.append(el(doc, 'p', `비중을 다시 맞추는 방법은 두 갈래입니다. 정해 둔 날짜마다 맞추는 정기 방식은 단순하지만 그 사이 쏠림을 놔두고, 정해 둔 범위를 벗어날 때만 맞추는 밴드 방식은 거래가 적지만 범위를 스스로 정해야 합니다. 어느 쪽이든 내 원칙에 적어 두면 위 '내 원칙과 지금 상태'에서 비교됩니다.`, 'theme-strength-basis'));
  }
  parts.push(summary);
  if (journal.trades.length) {
    const fold = el(doc, 'details', null, 'pf-trade-fold');
    fold.append(el(doc, 'summary', `전체 기록 ${journal.trades.length}건${open.length ? `, 아직 열린 매수 ${open.length}건` : ''}`));
    if (unmatched.length) fold.append(el(doc, 'p', `매수 기록보다 많이 판 매도 ${unmatched.length}건은 손익 계산에서 뺐습니다(일지를 시작하기 전에 산 수량일 수 있습니다).`, 'theme-strength-basis'));
    const list = el(doc, 'ul', null, 'pf-trade-list');
    for (const trade of [...journal.trades].reverse().slice(0, 60)) {
      const li = el(doc, 'li', null, 'pf-trade-row');
      li.append(el(doc, 'span', `${trade.date} ${trade.side === 'buy' ? '매수' : '매도'} ${trade.symbol} ${trade.qty.toLocaleString('en-US')}주 @ ${money(trade.price, trade.currency).replace(/^\+/, '')}`, 'pf-trade-row-main'),
        el(doc, 'span', `${TRADE_REASONS[trade.reason] || ''}${trade.mood ? `, ${TRADE_MOODS[trade.mood]}` : ''}${trade.note ? `, ${trade.note}` : ''}`, 'pf-trade-row-sub'));
      const remove = el(doc, 'button', '삭제', 'aio-btn-table pf-trade-remove');
      remove.type = 'button'; remove.dataset.tradeAction = 'remove'; remove.dataset.tradeId = trade.id;
      remove.setAttribute('aria-label', `${trade.date} ${trade.symbol} 기록 삭제`);
      li.append(remove);
      list.append(li);
    }
    fold.append(list);
    parts.push(fold);
  }
  target.replaceChildren(...parts);
  const form = doc.getElementById('pf-trade-form');
  if (form && !journal.trades.length && !form.dataset.touched) form.open = true;
}

/** Called on every portfolio render. */
export function renderTradeJournal({ documentRef: doc, root, surface }) {
  const host = doc?.getElementById('pf-trades');
  if (!host) return;
  host.hidden = false;
  if (host.dataset.aioTradeJournal !== 'built') buildSkeleton(doc, host, root);
  renderDynamic(doc, root, host, surface);
}

/** One delegated click handler per mount; returns its disposer. */
export function installTradeJournal({ documentRef: doc, root, getSurface = () => null }) {
  const host = doc?.getElementById('pf-trades');
  if (!host) return () => {};
  const rerender = () => renderDynamic(doc, root, host, getSurface());
  const onClick = async (event) => {
    const button = event.target?.closest?.('[data-trade-action]');
    if (!button || !host.contains(button)) return;
    const action = button.dataset.tradeAction;
    const journal = readJournal(root);
    if (action === 'add') {
      const trade = normalizeTrade(readForm(doc));
      if (trade.error) { setStatus(doc, FIELD_ERRORS[trade.error] || '입력을 확인하세요'); doc.getElementById(`pf-trade-${trade.error}`)?.focus?.(); return; }
      journal.trades.push(trade);
      const ok = await persist(doc, root, normalizeJournal(journal), `${trade.date} ${trade.side === 'buy' ? '매수' : '매도'} ${trade.symbol} 기록을 저장했습니다.`, rerender);
      if (ok) ['pf-trade-symbol', 'pf-trade-qty', 'pf-trade-price', 'pf-trade-fee', 'pf-trade-stop', 'pf-trade-target', 'pf-trade-note'].forEach((id) => { const node = doc.getElementById(id); if (node) node.value = ''; });
    } else if (action === 'remove') {
      const id = button.dataset.tradeId;
      if (typeof root?.confirm === 'function' && !root.confirm('이 거래 기록을 삭제할까요?')) return;
      journal.trades = journal.trades.filter((trade) => trade.id !== id);
      await persist(doc, root, journal, '기록을 삭제했습니다.', rerender);
    } else if (action === 'rules') {
      const value = (id) => doc.getElementById(id)?.value ?? '';
      journal.rules = normalizeRules({ maxPositionPct: value('pf-rule-max-position'), minCashPct: value('pf-rule-min-cash'), stopLossPct: value('pf-rule-stop'), maxPositions: value('pf-rule-max-positions') });
      await persist(doc, root, journal, '내 원칙을 저장했습니다.', rerender);
    }
  };
  const onToggle = (event) => { if (event.target?.id === 'pf-trade-form') event.target.dataset.touched = '1'; };
  host.addEventListener('click', onClick);
  host.addEventListener('toggle', onToggle, true);
  return () => { host.removeEventListener('click', onClick); host.removeEventListener('toggle', onToggle, true); delete host.dataset.aioTradeJournal; };
}
