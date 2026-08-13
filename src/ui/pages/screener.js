import { createResourceBag } from '../../app/lifecycle.js';
import { selectScreenerState } from '../../state/selectors/screener.js';
import { createSavedScreen, exportSavedScreen, importSavedScreen } from '../../domain/screener/saved-screens.js';

const PROFILE_DESCRIPTIONS = {
  balanced: '레짐 기반 자동 가중',
  momentum: '단기 추세·모멘텀 중심',
  swing: '중기 기술적 매매',
  value: '저평가·장기 보유',
  lowrisk: '방어적·저변동성 우선'
};

const FACTOR_LABELS = {
  momentum: { label: '모멘텀', color: 'var(--data-green)', description: '1~6M 가중 수익률' },
  trend: { label: '추세', color: 'var(--data-green)', description: 'SMA50/200 스택 강도' },
  lowvol: { label: '저변동', color: 'var(--data-cyan)', description: '실현 변동성의 역순' },
  size: { label: '사이즈', color: 'var(--text-muted)', description: '시가총액의 역순' },
  value: { label: '밸류', color: 'var(--data-amber)', description: '저PER/PBR/EV-EBITDA' },
  quality: { label: '퀄리티', color: 'var(--data-amber)', description: 'ROE·마진·매출성장' },
  kalman: { label: 'K-vel', color: 'var(--accent)', description: '칼만 추세 신뢰도' }
};

const REGIME_DESCRIPTIONS = {
  '중립 · 균형 가중': '시장 신호가 혼재된 구간입니다. 기본 균형 가중을 적용합니다.',
  '위험회피 · 저변동·퀄리티 가중': '시장 불안 구간입니다. 저변동성과 퀄리티 가중을 높입니다.',
  '위험선호 · 모멘텀·추세·칼만 가중': '시장 위험선호 구간입니다. 모멘텀과 추세 가중을 높입니다.'
};

// SCR-UX-00/02: the table header, cell renderer, sorting contract and visual
// presets all read this registry. Keeping the user label next to the row key
// prevents the old header/cell drift (for example, VCP under the wrong label).
export const SCREENER_COLUMN_REGISTRY = Object.freeze([
  { key: 'watchlist', label: '관심·비교', sortable: false, align: 'center', width: 96, group: 'utility' },
  { key: 'rank', label: '순위', sortable: true, align: 'center', width: 72, group: 'ranking' },
  { key: 'grade', label: '등급', sortable: false, align: 'center', width: 48, group: 'ranking' },
  { key: 'sym', label: '종목', sortable: true, align: 'left', width: 142, group: 'identity', sticky: true },
  { key: 'sector', label: '섹터', sortable: true, align: 'left', width: 116, group: 'identity' },
  { key: 'momentum', label: '모멘텀', sortable: true, align: 'right', width: 74, group: 'factor' },
  { key: 'trend', label: '추세', sortable: true, align: 'right', width: 74, group: 'factor' },
  { key: 'lowvol', label: '저변동', sortable: true, align: 'right', width: 78, group: 'factor' },
  { key: 'value', label: '밸류', sortable: true, align: 'right', width: 70, group: 'factor' },
  { key: 'quality', label: '퀄리티', sortable: true, align: 'right', width: 78, group: 'factor' },
  { key: 'price', label: '현재가', sortable: true, align: 'right', width: 86, group: 'market' },
  { key: 'ret1m', label: '1M', sortable: true, align: 'right', width: 70, group: 'market' },
  { key: 'ret3m', label: '3M', sortable: true, align: 'right', width: 70, group: 'market' },
  { key: 'ret6m', label: '6M', sortable: true, align: 'right', width: 70, group: 'market' },
  { key: 'rsi', label: 'RSI', sortable: true, align: 'right', width: 64, group: 'market' },
  { key: 'pctSma50', label: 'vs 50MA', sortable: true, align: 'right', width: 82, group: 'market' },
  { key: 'kalman', label: '추세 신뢰도', sortable: true, align: 'right', width: 102, group: 'market', researchOnly: true },
  { key: 'vcpScore', label: 'VCP 구조', sortable: true, align: 'right', width: 96, group: 'setup', researchOnly: true },
  { key: 'mcap', label: '시총', sortable: true, align: 'right', width: 82, group: 'market' },
  { key: 'entry', label: '상대 상태', sortable: false, align: 'center', width: 118, group: 'setup', researchOnly: true },
  { key: 'signal', label: '구조 분류', sortable: false, align: 'center', width: 88, group: 'setup' },
  { key: 'news', label: '최신뉴스·근거', sortable: false, align: 'left', width: 190, group: 'evidence' }
]);

const COLUMN_PRESETS = Object.freeze({
  discovery: ['watchlist', 'rank', 'grade', 'sym', 'price', 'ret1m', 'ret3m', 'rsi', 'vcpScore'],
  fundamentals: ['watchlist', 'rank', 'grade', 'sym', 'value', 'quality', 'price', 'ret3m', 'signal', 'news'],
  trend: ['watchlist', 'rank', 'grade', 'sym', 'momentum', 'trend', 'ret1m', 'ret3m', 'ret6m', 'rsi', 'pctSma50', 'kalman', 'vcpScore', 'entry'],
  risk: ['watchlist', 'rank', 'grade', 'sym', 'lowvol', 'rsi', 'pctSma50', 'mcap', 'entry', 'signal', 'news'],
  events: ['watchlist', 'rank', 'grade', 'sym', 'signal', 'entry', 'vcpScore', 'news'],
  all: SCREENER_COLUMN_REGISTRY.map((column) => column.key)
});

const FILTER_LABELS = Object.freeze({
  'scr-market': '지수',
  'scr-sector': '섹터',
  'scr-signal': '구조 분류',
  'scr-cap': '시총',
  'scr-text-search': '검색',
  'scr-setup': '구조·근거',
  'scr-min-rank': '최소 rank',
  'scr-rsi-min': 'RSI 하한',
  'scr-rsi-max': 'RSI 상한',
  'scr-min-mom': '3M 수익률 하한',
  'scr-watchlist-only': '워치리스트'
});

const BUILDER_FIELDS = Object.freeze([
  { value: 'sector', label: '섹터', target: 'scr-sector' },
  { value: 'signal', label: '구조 분류', target: 'scr-signal' },
  { value: 'setup', label: '구조·근거', target: 'scr-setup' },
  { value: 'rank', label: '최소 rank', target: 'scr-min-rank' },
  { value: 'rsi', label: 'RSI 하한', target: 'scr-rsi-min' },
  { value: 'momentum', label: '3M 수익률 하한', target: 'scr-min-mom' },
  { value: 'query', label: '티커·이름 검색', target: 'scr-text-search' }
]);

function finite(value) { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function text(documentRef, value) {
  const node = documentRef.createElement('span');
  node.textContent = value == null || value === '' ? '—' : String(value);
  return node;
}
function cell(documentRef, value, className = '', style = '') {
  const node = documentRef.createElement('td');
  if (className) node.className = className;
  if (style) node.style.cssText = style;
  if (value && value.nodeType) node.appendChild(value);
  else node.appendChild(text(documentRef, value));
  return node;
}
function numberText(value, digits = 1, suffix = '') {
  return finite(value) == null ? '—' : `${Number(value).toFixed(digits)}${suffix}`;
}
function returnText(value) { return finite(value) == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`; }
function returnColor(value) { return finite(value) == null ? 'var(--text-muted)' : value >= 0 ? 'var(--data-green)' : 'var(--data-red)'; }
function rankColor(rank) {
  return rank == null ? 'var(--text-muted)' : rank >= 60 ? 'var(--data-green)' : rank >= 40 ? 'var(--data-amber)' : 'var(--data-red)';
}
function signalColor(signal) {
  return signal === 'BUY' ? 'var(--data-green)' : signal === 'SELL' ? 'var(--data-red)' : signal === 'WATCH' ? 'var(--data-amber)' : 'var(--text-muted)';
}
function signalLabel(signal) {
  return signal === 'BUY' ? '강세 구조' : signal === 'SELL' ? '약세 구조' : signal === 'WATCH' ? '관찰' : signal === 'HOLD' ? '중립' : '—';
}
function entryTiming(row) {
  const rank = finite(row.rank);
  const rsi = finite(row.rsi);
  const momentum = finite(row.ret1m) ?? (finite(row.ret3m) == null ? null : row.ret3m / 3);
  const setup = row.setupProfile || {};
  if (rank == null) return ['—', 'entry-wait'];
  if (setup.climaxRisk === 'watch') return [setup.label || '클라이맥스 관찰', 'entry-wait'];
  if (rank < 30) return ['하위권', 'entry-avoid'];
  if (rsi != null && rsi > 78) return ['RSI 과열', 'entry-wait'];
  if (rsi != null && rsi < 22) return ['RSI 침체', 'entry-wait'];
  if (setup.relativeStrengthPullback === 'candidate') return ['상대강도 눌림', 'entry-watch'];
  if (setup.support200 === 'near') return ['200일선 부근', 'entry-watch'];
  if (rank >= 65 && (rsi == null || (rsi >= 38 && rsi <= 68)) && (momentum == null || momentum > 0)) return ['상위권·추세 양호', 'entry-ready'];
  if (rank >= 48 && (rsi == null || (rsi >= 30 && rsi <= 74))) return ['중상위권', 'entry-watch'];
  return ['중립권', 'entry-wait'];
}

function liveRow(row, readLiveData) {
  const live = readLiveData?.()?.[row.sym] || {};
  return {
    ...row,
    price: finite(live.price) ?? row.price,
    mcap: finite(live.marketCap) != null ? Math.round(live.marketCap / 1e9) : row.mcap
  };
}

function selectedValue(documentRef, id) { return documentRef.getElementById(id)?.value || ''; }

function filterRows(rows, documentRef, { readWatchlist, readAliases } = {}) {
  const market = selectedValue(documentRef, 'scr-market');
  const sector = selectedValue(documentRef, 'scr-sector');
  const signal = selectedValue(documentRef, 'scr-signal');
  const cap = selectedValue(documentRef, 'scr-cap');
  const query = selectedValue(documentRef, 'scr-text-search').trim().toLowerCase();
  const minRank = Number.parseInt(selectedValue(documentRef, 'scr-min-rank'), 10) || 0;
  const rsiMin = Number.parseFloat(selectedValue(documentRef, 'scr-rsi-min'));
  const rsiMax = Number.parseFloat(selectedValue(documentRef, 'scr-rsi-max'));
  const minMomentum = Number.parseFloat(selectedValue(documentRef, 'scr-min-mom'));
  const setupFilter = selectedValue(documentRef, 'scr-setup');
  const watchlistOnly = !!documentRef.getElementById('scr-watchlist-only')?.checked;
  const watchlist = watchlistOnly ? new Set(readWatchlist?.() || []) : null;
  const aliases = readAliases?.() || {};
  const words = query ? query.split(/[\s,;·+&]+/).filter(Boolean) : [];
  const matchedSymbols = new Set();
  let signalFromText = null;
  words.forEach((word) => {
    const alias = aliases[word];
    if (typeof alias === 'string') signalFromText = alias;
    else if (Array.isArray(alias)) alias.forEach((symbol) => matchedSymbols.add(symbol));
  });

  return rows.filter((row) => {
    if (market && row.index !== market) return false;
    if (sector && row.sector !== sector) return false;
    if (signal && row.signal !== signal) return false;
    if (cap === 'MEGA' && !(row.mcap >= 1000)) return false;
    if (cap === 'LARGE' && !(row.mcap >= 10 && row.mcap < 1000)) return false;
    if (cap === 'MID' && !(row.mcap >= 2 && row.mcap <= 10)) return false;
    if (cap === 'SMALL' && !(row.mcap < 2)) return false;
    if (minRank > 0 && !(finite(row.rank) != null && row.rank >= minRank)) return false;
    if (Number.isFinite(rsiMin) && rsiMin > 0 && !(finite(row.rsi) != null && row.rsi >= rsiMin)) return false;
    if (Number.isFinite(rsiMax) && rsiMax < 100 && !(finite(row.rsi) != null && row.rsi <= rsiMax)) return false;
    if (Number.isFinite(minMomentum) && !(finite(row.ret3m) != null && row.ret3m >= minMomentum)) return false;
    if (setupFilter === 'WINNER' && row.setupProfile?.winnerFilter !== 'candidate') return false;
    if (setupFilter === 'RSPULLBACK' && row.setupProfile?.relativeStrengthPullback !== 'candidate') return false;
    if (setupFilter === 'SUPPORT200' && row.setupProfile?.support200 !== 'near') return false;
    if (setupFilter === 'CLIMAX' && row.setupProfile?.climaxRisk !== 'watch') return false;
    if (setupFilter === 'MISSING' && !(row.setupProfile?.winnerFilter === 'unavailable' || (row.setupProfile?.missingEvidence || []).length)) return false;
    if (watchlist && !watchlist.has(row.sym)) return false;
    if (!query) return true;
    if (signalFromText && row.signal !== signalFromText) return false;
    const setupText = Array.isArray(row.setupProfile?.tags) ? row.setupProfile.tags.join(' ') : '';
    const haystack = `${row.sym} ${row.name} ${row.memo || ''} ${row.newsMemo || ''} ${row.sector || ''} ${setupText}`.toLowerCase();
    const direct = haystack.includes(query);
    const allWords = words.filter((word) => !aliases[word]).every((word) => haystack.includes(word));
    return direct || allWords || matchedSymbols.has(row.sym);
  });
}

function sortRows(rows, sortColumn, ascending, readLiveData) {
  return rows.slice().sort((left, right) => {
    const a = liveRow(left, readLiveData);
    const b = liveRow(right, readLiveData);
    const factorColumn = ['momentum', 'trend', 'lowvol', 'value', 'quality', 'kalman'].includes(sortColumn);
    let av = factorColumn ? a.factorScores?.[sortColumn] : a[sortColumn];
    let bv = factorColumn ? b.factorScores?.[sortColumn] : b[sortColumn];
    if (sortColumn === 'price') { av = a.price; bv = b.price; }
    if (typeof av === 'string') av = av.toUpperCase();
    if (typeof bv === 'string') bv = bv.toUpperCase();
    if (av == null) av = typeof av === 'string' ? '' : -Infinity;
    if (bv == null) bv = typeof bv === 'string' ? '' : -Infinity;
    const comparison = av > bv ? 1 : av < bv ? -1 : 0;
    return ascending ? comparison : -comparison;
  });
}

function createRankNode(documentRef, row) {
  const wrap = documentRef.createElement('div');
  const rank = finite(row.rank);
  if (rank == null) wrap.appendChild(text(documentRef, '—'));
  else {
    const value = documentRef.createElement('div');
    value.textContent = String(rank);
    value.style.cssText = `font-family:var(--font-mono);font-weight:800;font-size:11px;color:${rankColor(rank)};`;
    const bar = documentRef.createElement('div');
    bar.style.cssText = 'height:3px;background:var(--border-subtle);border-radius:2px;margin-top:3px;overflow:hidden;';
    const fill = documentRef.createElement('div');
    fill.style.cssText = `height:100%;width:${Math.max(0, Math.min(100, rank))}%;background:${rankColor(rank)};border-radius:2px;`;
    bar.appendChild(fill);
    wrap.append(value, bar);
    if (row.quantSignal) {
      const signal = documentRef.createElement('div');
      signal.textContent = row.quantSignal;
      signal.style.cssText = `font-size:10px;color:${rankColor(rank)};margin-top:2px;`;
      wrap.appendChild(signal);
    }
  }
  return wrap;
}

function createColumnContent(documentRef, row, key, { readLiveData, readWatchlist, onWatchlistToggle, onExplain, onCompare, compareSymbols } = {}) {
  const live = liveRow(row, readLiveData);
  const inWatchlist = (readWatchlist?.() || []).includes(row.sym);
  if (key === 'watchlist') {
    const wrap = documentRef.createElement('div');
    wrap.className = 'scr-row-actions';
    const star = documentRef.createElement('button');
    star.type = 'button';
    star.dataset.aioScreenerWatchlist = row.sym;
    star.className = `scr-star${inWatchlist ? ' active' : ''}`;
    star.textContent = inWatchlist ? '★' : '☆';
    star.title = inWatchlist ? '워치리스트에서 제거' : '워치리스트에 추가';
    star.setAttribute('aria-label', `워치리스트 ${inWatchlist ? '제거' : '추가'} ${row.sym}`);
    star.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); onWatchlistToggle?.(row.sym); });
    const compare = documentRef.createElement('button');
    compare.type = 'button';
    compare.className = `scr-compare-btn${compareSymbols?.has(row.sym) ? ' active' : ''}`;
    compare.textContent = compareSymbols?.has(row.sym) ? '✓' : '+';
    compare.title = compareSymbols?.has(row.sym) ? '비교 tray에서 제거' : '비교 tray에 추가';
    compare.setAttribute('aria-label', `${row.sym} 비교 ${compareSymbols?.has(row.sym) ? '제거' : '추가'}`);
    compare.dataset.aioScreenerCompare = row.sym;
    compare.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); onCompare?.(row); });
    wrap.append(star, compare);
    return wrap;
  }
  if (key === 'rank') return createRankNode(documentRef, row);
  if (key === 'grade') return row.rank == null ? '—' : row.rank >= 80 ? 'A' : row.rank >= 65 ? 'B' : row.rank >= 50 ? 'C' : row.rank >= 35 ? 'D' : 'F';
  if (key === 'sym') {
    const identity = documentRef.createElement('div');
    const symbol = documentRef.createElement('div');
    symbol.textContent = row.sym || row.symbol || '—';
    symbol.style.cssText = 'font-weight:800;font-family:var(--font-mono);font-size:12px;';
    const name = documentRef.createElement('div');
    name.textContent = row.name || '이름 미수신';
    name.style.cssText = 'font-size:11px;color:var(--text-muted);';
    identity.append(symbol, name);
    return identity;
  }
  if (key === 'sector') return row.sector;
  if (['momentum', 'trend', 'lowvol', 'value', 'quality', 'kalman'].includes(key)) {
    const value = row.factorScores?.[key];
    const node = documentRef.createElement('span');
    node.textContent = value == null ? '—' : Number(value).toFixed(0);
    node.style.color = value == null ? 'var(--text-muted)' : value >= 66 ? 'var(--data-green)' : value >= 40 ? 'var(--data-amber)' : 'var(--data-red)';
    return node;
  }
  if (key === 'price') return numberText(live.price, 2);
  if (['ret1m', 'ret3m', 'ret6m'].includes(key)) return returnText(row[key]);
  if (key === 'rsi') return numberText(row.rsi, 1);
  if (key === 'pctSma50') return returnText(row.pctSma50);
  if (key === 'vcpScore') {
    const node = documentRef.createElement('span');
    node.textContent = row.vcpScore == null ? '—' : `${row.vcpScore} · ${row.vcpStage || '관측'}`;
    node.style.color = row.vcpScore == null ? 'var(--text-muted)' : row.vcpScore >= 70 ? 'var(--data-green)' : row.vcpScore >= 50 ? 'var(--data-amber)' : 'var(--data-red)';
    return node;
  }
  if (key === 'mcap') return live.mcap == null ? '—' : live.mcap >= 1000 ? `$${(live.mcap / 1000).toFixed(1)}T` : `$${live.mcap}B`;
  if (key === 'entry') {
    const entry = entryTiming(row);
    const entryNode = documentRef.createElement('span');
    entryNode.className = `scr-entry-chip ${entry[1]}`;
    entryNode.textContent = entry[0];
    entryNode.title = row.setupProfile?.explanation || 'RSI·랭크·모멘텀 기반 설명형 분류';
    return entryNode;
  }
  if (key === 'signal') {
    const signalNode = documentRef.createElement('span');
    signalNode.textContent = signalLabel(row.signal);
    signalNode.style.cssText = `background:${row.signal === 'BUY' ? 'var(--data-green-soft)' : row.signal === 'SELL' ? 'var(--data-red-soft)' : row.signal === 'WATCH' ? 'var(--data-amber-soft)' : 'var(--data-muted-soft)'};color:${signalColor(row.signal)};padding:3px 7px;border-radius:4px;font-size:11px;font-weight:700;`;
    return signalNode;
  }
  if (key === 'news') {
    const provenance = documentRef.createElement('div');
    provenance.className = 'scr-evidence-cell';
    const memo = documentRef.createElement('span');
    memo.textContent = row.newsMemo ? row.newsMemo.slice(0, 70) : '근거 미수신';
    const why = documentRef.createElement('button');
    why.type = 'button';
    why.textContent = 'Why';
    why.className = 'scr-why-btn';
    why.title = 'WhyRanked / WhyRejected와 필드 provenance 보기';
    why.setAttribute('aria-label', `${row.sym} 순위·탈락 근거 보기`);
    why.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); onExplain?.(row); });
    provenance.append(memo, why);
    return provenance;
  }
  return row[key] ?? '—';
}

function createTableRow(documentRef, row, { readLiveData, readWatchlist, onWatchlistToggle, onExplain, onCompare, selectedSymbols, compareSymbols, visibleColumns } = {}) {
  const tr = documentRef.createElement('tr');
  const symbol = row.sym || row.symbol;
  tr.className = `aio-hover-row${selectedSymbols?.has(symbol) ? ' is-selected' : ''}`;
  tr.tabIndex = 0;
  tr.dataset.aioScreenerTicker = symbol || '';
  tr.dataset.aioScreenerWhy = row.screenStatus || 'unavailable';
  tr.setAttribute('aria-selected', selectedSymbols?.has(symbol) ? 'true' : 'false');
  tr.setAttribute('aria-label', `${symbol || '종목'} ${row.screenStatus === 'passed' ? '선정' : row.screenStatus === 'rejected' ? '탈락' : '데이터 부족'} 행. Enter로 Why 보기`);
  tr.addEventListener('click', (event) => {
    if (event.target.closest('button, input, a, select')) return;
    onExplain?.(row);
  });
  tr.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onExplain?.(row); }
  });
  let stickyLeft = 0;
  visibleColumns.forEach((column) => {
    const td = documentRef.createElement('td');
    td.dataset.columnKey = column.key;
    td.className = `scr-column-cell scr-column-${column.key}${column.sticky ? ' scr-column-sticky' : ''}`;
    td.style.cssText = `text-align:${column.align};min-width:${column.width}px;padding:7px 8px;`;
    if (column.sticky) td.style.left = `${stickyLeft}px`;
    if (['price', 'rank', 'momentum', 'trend', 'lowvol', 'value', 'quality', 'ret1m', 'ret3m', 'ret6m', 'rsi', 'pctSma50', 'kalman', 'vcpScore', 'mcap'].includes(column.key)) {
      td.style.fontFamily = 'var(--font-mono)';
      td.style.fontVariantNumeric = 'tabular-nums';
    }
    const content = createColumnContent(documentRef, row, column.key, { readLiveData, readWatchlist, onWatchlistToggle, onExplain, onCompare, compareSymbols });
    td.appendChild(content && content.nodeType ? content : text(documentRef, content));
    tr.appendChild(td);
    if (!column.sticky) stickyLeft += column.width;
  });
  return tr;
}

function renderFactorTab(documentRef, metadata) {
  const ranking = metadata?.ranking || {};
  const bars = documentRef.getElementById('scr-factor-bars');
  const weights = ranking.activeFactorWeights || {};
  const factors = ranking.activeFactors || [];
  if (bars) {
    bars.replaceChildren();
    const maxWeight = Math.max(1, ...factors.map((key) => Number(weights[key]) || 0));
    factors.forEach((key) => {
      const item = FACTOR_LABELS[key] || { label: key, color: 'var(--text-secondary)', description: '' };
      const row = documentRef.createElement('div');
      row.style.cssText = 'display:grid;grid-template-columns:50px 1fr 34px;gap:4px;align-items:center;';
      row.title = item.description;
      const label = documentRef.createElement('span');
      label.textContent = item.label;
      label.style.cssText = `font-size:10px;color:${item.color};font-weight:600;`;
      const track = documentRef.createElement('div');
       track.style.cssText = 'background:var(--surface-4);border-radius:2px;height:7px;overflow:hidden;';
      const fill = documentRef.createElement('div');
      fill.style.cssText = `background:${item.color};height:100%;width:${Math.round((Number(weights[key]) || 0) / maxWeight * 100)}%;opacity:.8;`;
      track.appendChild(fill);
      const value = documentRef.createElement('span');
      value.textContent = `${Math.round((Number(weights[key]) || 0) * 100)}%`;
      value.style.cssText = 'font-size:10px;color:var(--text-muted);text-align:right;';
      row.append(label, track, value);
      bars.appendChild(row);
    });
    if (!factors.length) bars.appendChild(text(documentRef, '활성 팩터 없음 — 서버 산출물 미수신'));
  }
  const regime = ranking.activeFactorRegime || '중립';
  const regimeNode = documentRef.getElementById('screener-regime-note');
  if (regimeNode) regimeNode.textContent = regime;
  const desc = documentRef.getElementById('scr-regime-desc');
  if (desc) desc.textContent = REGIME_DESCRIPTIONS[regime] || '현재 레짐에 맞는 팩터 가중치를 적용했습니다.';
}

function renderBacktest(documentRef, metadata) {
  const panel = documentRef.getElementById('screener-backtest-panel');
  if (!panel) return;
  panel.replaceChildren();
  const backtest = metadata?.backtest;
  const hasObservedIC = backtest?.ic && Object.values(backtest.ic).some((value) => finite(value) != null);
  if (!hasObservedIC) {
    const message = documentRef.createElement('div');
    message.className = 'scr-empty-state';
    message.dataset.statusCode = 'NO_BACKTEST_DATA';
    message.textContent = '검증 데이터 없음';
    const detail = documentRef.createElement('div');
    detail.className = 'scr-empty-detail';
    detail.textContent = metadata?.detail || '백테스트 artifact가 수신되면 IC와 표본 수를 표시합니다. 현재 0을 관측값으로 해석하지 않습니다.';
    message.appendChild(detail);
    panel.appendChild(message);
    return;
  }
  const excluded = Array.isArray(backtest.excludedFactors) && backtest.excludedFactors.length
    ? backtest.excludedFactors.join(' · ')
    : 'size · value · quality';
  const disclosure = documentRef.createElement('div');
  disclosure.textContent = `검증 범위: ${excluded} 제외 · 고정 레짐 ${backtest.weightRegime || 'NEUTRAL'} · 실시간 적응형 종합 랭크 검증 아님`;
  disclosure.style.cssText = 'font-size:10px;color:var(--text-muted);line-height:1.45;margin-bottom:6px;';
  panel.appendChild(disclosure);
  const labels = { momentum: '모멘텀', trend: '추세', lowvol: '저변동', kalman: 'K-vel', composite: '종합' };
  Object.entries(labels).forEach(([key, label]) => {
    const row = documentRef.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;gap:8px;font-size:11px;padding:2px 0;';
    const left = documentRef.createElement('span');
    left.textContent = `${label} IC`;
    left.style.color = 'var(--text-secondary)';
    const right = documentRef.createElement('span');
    const value = finite(backtest.ic[key]);
    right.textContent = value == null ? '—' : value.toFixed(3);
    right.style.cssText = `color:${value == null ? 'var(--text-muted)' : value >= 0.05 ? 'var(--data-green)' : value <= -0.05 ? 'var(--data-red)' : 'var(--data-amber)'};font-weight:700;`;
    row.append(left, right);
    panel.appendChild(row);
  });
}

function calculatePosition(documentRef, readLiveData) {
  const capital = Number.parseFloat(documentRef.getElementById('ps-capital')?.value) || 0;
  const riskPct = Number.parseFloat(documentRef.getElementById('ps-risk')?.value) || 1;
  const stopPct = Number.parseFloat(documentRef.getElementById('ps-stop')?.value) || 5;
  const symbol = documentRef.getElementById('ps-sym')?.textContent.trim() || '';
  const output = documentRef.getElementById('ps-result');
  if (!output) return;
  if (capital <= 0 || riskPct <= 0 || stopPct <= 0) {
    output.textContent = '자본금·리스크%·손절%를 모두 입력하세요.';
    return;
  }
  const maxLoss = capital * riskPct / 100;
  const position = maxLoss / (stopPct / 100);
  const price = finite(readLiveData?.()?.[symbol]?.price);
  const shares = price > 0 ? Math.floor(position / price) : null;
  const actual = shares != null && shares > 0 ? shares * price : position;
  output.textContent = `최대 손실 $${maxLoss.toLocaleString('en-US', { maximumFractionDigits: 0 })} · 투자 금액 $${actual.toLocaleString('en-US', { maximumFractionDigits: 0 })} (${(actual / capital * 100).toFixed(1)}% of 자본)${shares ? ` · 추천 주수 ${shares.toLocaleString()}주 @ $${price.toFixed(2)}` : ''} · 참고용 계산 결과입니다.`;
}

function getVisibleColumns(columnPreset, customColumns = []) {
  const keys = columnPreset === 'custom' ? customColumns : (COLUMN_PRESETS[columnPreset] || COLUMN_PRESETS.discovery);
  const byKey = new Map(SCREENER_COLUMN_REGISTRY.map((column) => [column.key, column]));
  return keys.map((key) => byKey.get(key)).filter(Boolean);
}

function renderTableHeader(documentRef, table, visibleColumns, sortState) {
  const thead = table?.querySelector('thead');
  if (!thead) return;
  const row = documentRef.createElement('tr');
  row.className = 'scr-registry-header';
  let stickyLeft = 0;
  visibleColumns.forEach((column) => {
    const th = documentRef.createElement('th');
    th.scope = 'col';
    th.dataset.columnKey = column.key;
    th.className = `scr-column-header${column.sticky ? ' scr-column-sticky' : ''}`;
    th.style.cssText = `text-align:${column.align};min-width:${column.width}px;padding:8px;`;
    if (column.sticky) th.style.left = `${stickyLeft}px`;
    if (column.sortable) {
      const button = documentRef.createElement('button');
      button.type = 'button';
      button.dataset.scrSort = column.key;
      button.className = 'scr-sort-btn';
      button.textContent = column.label;
      const arrow = documentRef.createElement('span');
      arrow.className = 'scr-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      button.appendChild(arrow);
      const active = sortState.column === column.key;
      button.setAttribute('aria-label', `${column.label} 정렬 ${active ? (sortState.ascending ? '오름차순' : '내림차순') : '적용'}`);
      th.setAttribute('aria-sort', active ? (sortState.ascending ? 'ascending' : 'descending') : 'none');
      th.appendChild(button);
    } else {
      th.textContent = column.label;
      th.setAttribute('aria-sort', 'none');
    }
    if (column.researchOnly) {
      const note = documentRef.createElement('span');
      note.className = 'scr-research-mark';
      note.textContent = ' 연구';
      th.appendChild(note);
    }
    row.appendChild(th);
    if (!column.sticky) stickyLeft += column.width;
  });
  thead.replaceChildren(row);
  table.dataset.aioColumnRegistry = 'screener-column-registry.v1';
  table.dataset.aioVisibleColumnCount = String(visibleColumns.length);
}

function renderColumnChooser(documentRef, page, columnPreset, customColumns, onChange) {
  const chooser = documentRef.getElementById('scr-column-chooser');
  if (!chooser) return;
  const list = documentRef.getElementById('scr-column-chooser-list');
  if (!list) return;
  list.replaceChildren();
  SCREENER_COLUMN_REGISTRY.forEach((column) => {
    const label = documentRef.createElement('label');
    label.className = 'scr-column-choice';
    const checkbox = documentRef.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = (columnPreset === 'custom' ? customColumns : getVisibleColumns(columnPreset).map((item) => item.key)).includes(column.key);
    checkbox.dataset.aioScreenerColumn = column.key;
    checkbox.addEventListener('change', () => {
      const next = new Set(columnPreset === 'custom' ? customColumns : getVisibleColumns(columnPreset).map((item) => item.key));
      if (checkbox.checked) next.add(column.key); else next.delete(column.key);
      if (!next.has('sym')) next.add('sym');
      onChange?.([...next]);
    });
    const name = documentRef.createElement('span');
    name.textContent = column.label;
    label.append(checkbox, name);
    list.appendChild(label);
  });
  if (chooser.dataset.aioInitialized !== 'true') {
    chooser.hidden = true;
    chooser.dataset.aioInitialized = 'true';
  }
}

function renderFilterChips(documentRef) {
  const container = documentRef.getElementById('scr-active-filter-chips');
  if (!container) return;
  container.replaceChildren();
  const controls = Object.keys(FILTER_LABELS).map((id) => documentRef.getElementById(id)).filter(Boolean);
  const active = controls.flatMap((control) => {
    const rawValue = control.type === 'checkbox' ? (control.checked ? '적용' : '') : String(control.value || '').trim();
    const value = control.id === 'scr-min-rank' && rawValue === '0' ? '' : rawValue;
    if (!value) return [];
    return [{ id: control.id, label: FILTER_LABELS[control.id], value }];
  });
  if (!active.length) {
    const empty = documentRef.createElement('span');
    empty.className = 'scr-chip-empty';
    empty.textContent = '활성 조건 없음';
    container.appendChild(empty);
  } else {
    active.forEach(({ id, label, value }) => {
      const chip = documentRef.createElement('button');
      chip.type = 'button';
      chip.className = 'scr-filter-chip';
      chip.dataset.aioScreenerAction = 'clear-filter';
      chip.dataset.aioScreenerArg = id;
      chip.setAttribute('aria-label', `${label} ${value} 조건 제거`);
      chip.textContent = `${label}: ${value} ×`;
      container.appendChild(chip);
    });
  }
  const count = documentRef.getElementById('scr-active-filter-count');
  if (count) count.textContent = String(active.length);
}

function renderBuilderConditions(documentRef, conditions = []) {
  const list = documentRef.getElementById('scr-builder-condition-list');
  if (!list) return;
  list.replaceChildren();
  if (!conditions.length) {
    const empty = documentRef.createElement('span');
    empty.className = 'scr-builder-empty';
    empty.textContent = '시각 조건을 추가하면 이곳에 표시됩니다. 필터 변경은 미리보기, 실행 버튼이 결과 snapshot을 고정합니다.';
    list.appendChild(empty);
    return;
  }
  conditions.forEach((condition, index) => {
    const chip = documentRef.createElement('button');
    chip.type = 'button';
    chip.className = 'scr-filter-chip';
    chip.dataset.aioScreenerAction = 'remove-builder-condition';
    chip.dataset.aioScreenerArg = String(index);
    chip.textContent = `${condition.label}: ${condition.value} ×`;
    list.appendChild(chip);
  });
}

function renderFunnel(documentRef, { universe = 0, ready = 0, passed = 0, unavailable = 0, filtered = 0 } = {}) {
  const values = { 'scr-funnel-universe': universe, 'scr-funnel-ready': ready, 'scr-funnel-passed': passed, 'scr-funnel-unavailable': unavailable, 'scr-funnel-filtered': filtered };
  Object.entries(values).forEach(([id, value]) => {
    const node = documentRef.getElementById(id);
    if (node) node.textContent = String(value ?? 0);
  });
}

function render({ documentRef, store, readLiveData, readWatchlist, readAliases, sortState, visibleLimit, onWatchlistToggle, onExplain, onCompare, selectedSymbols, compareSymbols, columnPreset = 'discovery', customColumns = [], rowsOverride = null, workbenchResult = null }) {
  const state = selectScreenerState(store?.getState?.() || {});
  const page = documentRef?.getElementById('page-screener');
  if (!page) return;
  const rows = rowsOverride || state?.rows || [];
  const filtered = sortRows(filterRows(rows, documentRef, { readWatchlist, readAliases }), sortState.column, sortState.ascending, readLiveData);
  const visibleColumns = getVisibleColumns(columnPreset, customColumns);
  const table = documentRef.getElementById('screener-results-table');
  renderTableHeader(documentRef, table, visibleColumns, sortState);
  const body = documentRef.getElementById('screener-results-body');
  if (body) {
    body.replaceChildren();
    const visible = filtered.slice(0, visibleLimit.value);
    if (!visible.length) {
      const empty = documentRef.createElement('tr');
      empty.appendChild(cell(documentRef, state?.status === 'unavailable' ? '스크리너 산출물 미수신' : '조건에 맞는 종목이 없습니다', '', 'text-align:center;padding:20px;color:var(--text-muted);'));
      empty.firstChild.colSpan = visibleColumns.length;
      body.appendChild(empty);
    } else visible.forEach((row) => body.appendChild(createTableRow(documentRef, row, { readLiveData, readWatchlist, onWatchlistToggle, onExplain, onCompare, selectedSymbols, compareSymbols, visibleColumns })));
  }
  const count = documentRef.getElementById('screener-result-count');
  if (count) count.textContent = String(filtered.length);
  const filteredCount = documentRef.getElementById('scr-filtered-count');
  if (filteredCount) filteredCount.textContent = String(filtered.length);
  const summary = documentRef.getElementById('scr-visible-summary');
  if (summary) summary.textContent = `전체 ${filtered.length}개 중 ${Math.min(visibleLimit.value, filtered.length)}개 표시`;
  const loadMore = documentRef.getElementById('scr-load-more-wrap');
  if (loadMore) loadMore.hidden = visibleLimit.value >= filtered.length;
  const allRows = rows;
  const total = documentRef.getElementById('scr-kpi-total');
  const top = documentRef.getElementById('scr-kpi-top');
  const buy = documentRef.getElementById('scr-kpi-buy');
  const factorCount = documentRef.getElementById('scr-kpi-factors');
  if (total) total.textContent = String(allRows.length);
  if (top) top.textContent = String(allRows.filter((row) => finite(row.rank) != null && row.rank >= 80).length);
  if (buy) buy.textContent = String(allRows.filter((row) => row.signal === 'BUY').length);
  if (factorCount) factorCount.textContent = String(state?.metadata?.ranking?.activeFactors?.length || '—');
  const asOf = page.querySelector('[data-factor-asof]');
  if (asOf) asOf.textContent = workbenchResult?.run?.snapshotId ? `스크린 스냅샷 ${String(workbenchResult.run.snapshotId).slice(0, 18)}` : state?.metadata?.asOf ? `팩터 기준 ${String(state.metadata.asOf).slice(0, 10)}` : '팩터 데이터 대기';
  const readiness = documentRef.getElementById('screener-readiness-note');
  const run = workbenchResult?.run || state?.lastRun || {};
  const readinessResult = workbenchResult?.readiness || state?.readiness;
  const readyCount = readinessResult?.eligibleCount ?? 0;
  const passedCount = run?.passed ?? 0;
  const unavailableCount = run?.unavailable ?? 0;
  if (readiness) readiness.textContent = state?.status === 'unavailable'
    ? '데이터 상태: 산출물 미수신 · 결과와 검증 수치를 표시하지 않습니다.'
    : `현재 snapshot · 유니버스 ${allRows.length} · 필드 준비 ${readyCount} · 조건 통과 ${passedCount} · 데이터 부족 ${unavailableCount} · 상대 랭킹은 연구용입니다.`;
  renderFunnel(documentRef, { universe: allRows.length, ready: readyCount, passed: passedCount, unavailable: unavailableCount, filtered: filtered.length });
  renderFilterChips(documentRef);
  const coverage = documentRef.getElementById('screener-factor-coverage');
  if (coverage) {
    const ranking = state?.metadata?.ranking || {};
    const active = ranking.activeFactors || [];
    const reasons = ranking.inactiveFactorReasons || {};
    const omitted = ['size', 'value', 'quality'].filter((key) => !active.includes(key));
    coverage.textContent = active.length ? `활성 팩터 ${active.length}개: ${active.join(' · ')}${omitted.length ? ` | 제외: ${omitted.map((key) => `${key}${reasons[key] ? ` (${reasons[key]})` : ''}`).join(' · ')}` : ''}` : '활성 팩터 없음 — 서버 팩터 파일 미수신';
  }
  const rankingState = state?.metadata?.ranking || {};
  renderFactorTab(documentRef, state?.metadata);
  renderBacktest(documentRef, state?.metadata);
  page.querySelectorAll('[data-scr-sort]').forEach((header) => {
    const arrow = header.querySelector('.scr-arrow');
    const active = header.dataset.scrSort === sortState.column;
    if (arrow) arrow.textContent = active ? (sortState.ascending ? ' ▲' : ' ▼') : '';
    if (active) header.setAttribute('aria-label', `${header.textContent.replace(/[▲▼]/g, '').trim()} 정렬 ${sortState.ascending ? '오름차순' : '내림차순'}`);
  });
  page.dataset.aioArchitectureRoute = 'screener';
  page.dataset.aioArchitectureSlice = 'screener';
  page.dataset.aioArchitectureRenderer = 'native';
  page.dataset.aioArchitectureStatus = state?.status || 'unavailable';
  if (rankingState.activeFactorRegime && documentRef.getElementById('screener-regime-note')) documentRef.getElementById('screener-regime-note').textContent = rankingState.activeFactorRegime;
}

export function createScreenerPage({ documentRef, store, root = globalThis, onProfileChange, onTicker, onWatchlistToggle, readWatchlist, readAliases, readLiveData, writeReturnContext } = {}) {
  // SCR-UX-02: rank is the visible discovery order and is therefore the
  // initial sort. Market-cap remains available through the column header.
  const sortState = { column: 'rank', ascending: false };
  const visibleLimit = { value: 12 };
  const columnState = { preset: 'discovery', custom: [] };
  const selectedSymbols = new Set();
  const compareSymbols = new Set();
  const builderConditions = [];
  let mounted = false;
  let renderNow = () => {};
  let activeRows = null;
  let activeResult = null;
  let activeDefinition = null;
  let activeScreenId = null;
  let activeRow = null;
  return {
    route: 'screener',
    mount() {
      const bag = createResourceBag();
      const page = documentRef?.getElementById('page-screener');
      if (!page) return () => {};
      const liveReader = readLiveData || (() => root?._liveData || {});
      const watchlistReader = readWatchlist || (() => root?._aioWatchlistGet?.() || []);
      const aliasReader = readAliases || (() => root?.SCR_KEYWORD_ALIASES || {});
      const profileReader = () => root?._aioGetActiveProfile?.() || 'balanced';
      const workbenchStatus = documentRef.getElementById('scr-workbench-status');
      const definitionEditor = documentRef.getElementById('scr-definition-editor');
      const workbenchPresets = documentRef.getElementById('scr-workbench-presets');
      const readinessPreview = documentRef.getElementById('scr-readiness-preview');
      const whyPreview = documentRef.getElementById('scr-why-preview');
      const runHistory = documentRef.getElementById('scr-run-history');
      const outcomeLab = documentRef.getElementById('scr-outcome-lab');
      const operationsState = documentRef.getElementById('scr-ops-state');
       const defaultScreens = () => {
         const stored = selectScreenerState(store.getState())?.savedScreens;
         return Array.isArray(stored) && stored.length ? stored : (root?.AIO_ARCH?.getDefaultScreenerScreens?.() || []);
       };
       const setText = (id, value) => {
         const node = documentRef.getElementById(id);
         if (node) node.textContent = value == null || value === '' ? '—' : String(value);
         return node;
       };
       const persistReturnContext = (symbol) => {
         try {
           writeReturnContext?.({
             from: 'screener',
             screenId: activeScreenId || activeDefinition?.screenId || null,
             runId: activeResult?.run?.runId || selectScreenerState(store.getState())?.lastRun?.runId || null,
             symbol,
             sort: { ...sortState },
             filters: Object.fromEntries(Object.keys(FILTER_LABELS).map((id) => [id, documentRef.getElementById(id)?.value || (documentRef.getElementById(id)?.checked ? true : '')])),
             scrollTop: documentRef.querySelector('.content')?.scrollTop || 0,
             savedAt: new Date().toISOString()
           });
         } catch (_) { /* private browsing/session storage may be unavailable */ }
       };
       const getCurrentVisibleColumns = () => getVisibleColumns(columnState.preset, columnState.custom);
      const syncDefinitionEditor = () => {
        if (definitionEditor && activeDefinition) definitionEditor.value = exportSavedScreen({ definition: activeDefinition });
      };
       const renderWhyDrawer = (row) => {
         const drawer = documentRef.getElementById('scr-why-drawer');
         if (!drawer || !row) return;
         const explanation = row.rankExplanation || {};
         const readiness = row.fieldReadiness?.coverage || {};
         const title = row.screenStatus === 'passed' ? 'WhyRanked' : row.screenStatus === 'rejected' ? 'WhyRejected' : '계산 불가';
         const missing = explanation.missingEvidence || row.setupProfile?.missingEvidence || [];
         const contrary = explanation.contraryEvidence || [];
         setText('scr-why-title', `${row.sym || row.symbol || '종목'} · ${title}`);
         setText('scr-why-subtitle', row.name || '연구용 상대 랭킹 설명');
         setText('scr-why-status', `${row.screenStatus || 'unavailable'} · rank ${row.rank == null ? '—' : row.rank} · coverage ${readiness.coveragePct == null ? '—' : `${readiness.coveragePct}%`}`);
         setText('scr-why-contrary', contrary.length ? contrary.join(' · ') : '조건을 반대한 근거가 없습니다.');
         setText('scr-why-missing', missing.length ? missing.join(' · ') : '필수 필드 결측 없음');
         setText('scr-why-provenance', row.instrumentRef?.instrumentId ? `instrument ${row.instrumentRef.instrumentId}` : row.source || 'provenance 미수신');
         setText('scr-why-preview', `${row.sym || row.symbol} · ${title} · ${missing.length ? `결측 ${missing.length}개` : '결측 없음'} · ${contrary.length ? `반대 근거 ${contrary.length}개` : '반대 근거 없음'}`);
         const factorList = documentRef.getElementById('scr-why-factor-list');
         if (factorList) {
           factorList.replaceChildren();
           const factors = Object.entries(row.factorScores || {}).filter(([, value]) => finite(value) != null);
           if (!factors.length) factorList.appendChild(text(documentRef, '팩터 기여도 미수신'));
           factors.slice(0, 8).forEach(([key, value]) => {
             const item = documentRef.createElement('div');
             item.className = 'scr-why-factor';
             const label = documentRef.createElement('span');
             label.textContent = FACTOR_LABELS[key]?.label || key;
             const track = documentRef.createElement('span');
             track.className = 'scr-why-track';
             const fill = documentRef.createElement('span');
             fill.className = 'scr-why-fill';
             fill.style.width = `${Math.max(0, Math.min(100, Number(value)))}%`;
             fill.style.background = Number(value) >= 66 ? 'var(--data-green)' : Number(value) >= 40 ? 'var(--data-amber)' : 'var(--data-red)';
             track.appendChild(fill);
             const score = documentRef.createElement('span');
             score.textContent = Number(value).toFixed(0);
             item.append(label, track, score);
             factorList.appendChild(item);
           });
         }
         const ticker = documentRef.querySelector('[data-aio-screener-action="open-ticker"]');
         if (ticker) ticker.dataset.aioScreenerArg = row.sym || row.symbol || '';
         const compare = documentRef.querySelector('[data-aio-screener-action="why-compare"]');
         if (compare) compare.dataset.aioScreenerArg = row.sym || row.symbol || '';
         drawer.hidden = false;
       };
       const explainRow = (row) => {
         activeRow = row;
         selectedSymbols.clear();
         if (row?.sym || row?.symbol) selectedSymbols.add(row.sym || row.symbol);
         renderWhyDrawer(row);
         renderNow();
       };
       const runDefinition = (definition) => {
         try {
           const saved = createSavedScreen({ definition });
           activeDefinition = saved.definition;
           activeScreenId = activeDefinition.screenId;
           const result = root?.AIO_ARCH?.runScreenerDefinition?.(activeDefinition);
           if (result?.rows) {
             activeResult = result;
             activeRows = result.rows;
             selectedSymbols.clear();
             visibleLimit.value = 12;
             if (workbenchStatus) workbenchStatus.textContent = `실행 완료 · snapshot ${result.run?.snapshotId || '미수신'} · ${result.run?.passed || 0} 통과 / ${result.run?.unavailable || 0} 데이터 부족`;
             syncDefinitionEditor();
             renderWorkbench();
             renderNow();
           }
         } catch (error) {
           if (workbenchStatus) workbenchStatus.textContent = `실행할 수 없습니다 · 정의를 확인하세요.`;
           const detail = documentRef.getElementById('scr-definition-error-detail');
           if (detail) { detail.hidden = false; detail.textContent = error?.message || 'invalid_definition'; }
         }
       };
       const renderWorkbench = () => {
         const state = selectScreenerState(store.getState()) || {};
         if (activeResult?.run?.snapshotId && state.snapshotId && activeResult.run.snapshotId !== state.snapshotId) {
           activeResult = null;
           activeRows = null;
         }
         const screens = defaultScreens();
         if (workbenchPresets) {
           workbenchPresets.replaceChildren();
           screens.forEach((screen) => {
             const button = documentRef.createElement('button');
             button.type = 'button';
             button.className = 'aio-btn-table';
             button.className += ` scr-screen-chip${screen.definition.screenId === activeScreenId ? ' active' : ''}`;
             button.dataset.aioScreenerAction = 'screen-preset';
             button.dataset.aioScreenerArg = screen.definition.screenId;
             button.textContent = screen.label;
             workbenchPresets.appendChild(button);
           });
         }
         const screenSelect = documentRef.getElementById('scr-screen-select');
         if (screenSelect) {
           const currentValue = activeScreenId || activeDefinition?.screenId || screens[0]?.definition?.screenId || '';
           if (screenSelect.dataset.aioScreenSignature !== screens.map((screen) => screen.definition.screenId).join('|')) {
             screenSelect.replaceChildren();
             screens.forEach((screen) => {
               const option = documentRef.createElement('option');
               option.value = screen.definition.screenId;
               option.textContent = screen.label;
               screenSelect.appendChild(option);
             });
             screenSelect.dataset.aioScreenSignature = screens.map((screen) => screen.definition.screenId).join('|');
           }
           screenSelect.value = currentValue;
         }
         if (!activeDefinition && screens[0]?.definition) {
           activeDefinition = screens[0].definition;
           activeScreenId = activeDefinition.screenId;
         }
         syncDefinitionEditor();
         renderBuilderConditions(documentRef, builderConditions);
         renderFilterChips(documentRef);
         renderColumnChooser(documentRef, page, columnState.preset, columnState.custom, (columns) => {
           columnState.preset = 'custom';
           columnState.custom = columns;
           renderNow();
         });
         const readiness = activeResult?.readiness || state.readiness;
         if (readinessPreview) readinessPreview.textContent = readiness ? `필드 준비 ${readiness.eligibleCount}/${readiness.rowCount} · ${readiness.coveragePct}% · 필수: ${(readiness.requiredFields || []).map((field) => field.split('.').pop()).join(' · ') || '없음'}` : '필드 준비도 미리보기 대기';
         if (workbenchStatus && !activeResult) workbenchStatus.textContent = state.lastRun ? `마지막 실행 · ${state.lastRun.passed} 통과 · ${state.lastRun.status}` : '실행 전 미리보기';
         if (runHistory) runHistory.textContent = state.lastRun ? `사용자 실행 ${state.runHistory?.length || 1}회 · 마지막 ${state.lastRun.status} · ${state.lastRun.passed}/${state.lastRun.eligibleCount}` : '사용자 실행 이력 없음';
         if (outcomeLab) outcomeLab.textContent = state.outcomes?.length ? `Outcome · ${state.outcomes.length}개 관측 · T+1/T+5/T+21/T+63` : 'Outcome · 실행 후 관측 대기';
         if (operationsState) operationsState.textContent = state.refreshPlan ? `Operations · refresh ${state.refreshPlan.queued?.length || 0}건 · quota/circuit` : `Operations · 데이터 sync ${state.snapshotId ? String(state.snapshotId).slice(0, 18) : '미수신'} · 사용자 실행과 분리`;
       };
       const renderCompareTray = () => {
         const tray = documentRef.getElementById('scr-compare-tray');
         if (!tray) return;
         tray.hidden = compareSymbols.size === 0;
         const list = documentRef.getElementById('scr-compare-list');
         if (list) {
           list.replaceChildren();
           [...compareSymbols].forEach((symbol) => {
             const chip = documentRef.createElement('span');
             chip.className = 'scr-compare-chip';
             chip.textContent = symbol;
             list.appendChild(chip);
           });
         }
         const count = documentRef.getElementById('scr-compare-count');
         if (count) count.textContent = String(compareSymbols.size);
       };
       const saveCurrentScreen = () => {
         if (!activeDefinition || typeof root?.AIO_ARCH?.setScreenerSavedScreens !== 'function') return;
         const state = selectScreenerState(store.getState()) || {};
         const saved = createSavedScreen({ definition: activeDefinition });
         const current = Array.isArray(state.savedScreens) ? state.savedScreens : defaultScreens();
         const next = [...current.filter((screen) => screen.definition?.screenId !== saved.definition.screenId), saved];
         root.AIO_ARCH.setScreenerSavedScreens(next);
         if (workbenchStatus) workbenchStatus.textContent = `저장 완료 · ${saved.label}`;
       };
       const readVisualCondition = () => {
         const field = documentRef.getElementById('scr-builder-field');
         const value = documentRef.getElementById('scr-builder-value');
         const definition = BUILDER_FIELDS.find((item) => item.value === field?.value);
         const raw = value?.value?.trim();
         if (!definition || !raw) return null;
         return { field: definition.value, label: definition.label, value: raw, target: definition.target };
       };
       const buildVisualDefinition = () => {
         if (!activeDefinition) return null;
         const nodes = builderConditions.flatMap((condition) => {
           const numeric = Number(condition.value);
           if (condition.field === 'rank' && Number.isFinite(numeric)) return [{ type: 'range', field: 'rank', min: numeric, nullPolicy: 'unknown' }];
           if (condition.field === 'rsi' && Number.isFinite(numeric)) return [{ type: 'range', field: 'price.rsi14', min: numeric, nullPolicy: 'unknown' }];
           if (condition.field === 'momentum' && Number.isFinite(numeric)) return [{ type: 'range', field: 'price.ret3m', min: numeric, nullPolicy: 'unknown' }];
           return [];
         });
         if (!nodes.length) return activeDefinition;
         const current = activeDefinition.filtersAST?.type === 'and' ? activeDefinition.filtersAST.children || [] : [activeDefinition.filtersAST];
         return { ...activeDefinition, filtersAST: { type: 'and', children: [...current, ...nodes] } };
       };
       const setProfileButtons = () => {
        const active = profileReader();
        page.querySelectorAll('[data-aio-screener-action="profile"]').forEach((button) => {
          button.classList.toggle('active', button.dataset.aioScreenerArg === active);
        });
        const description = documentRef.getElementById('scr-profile-desc');
        if (description) description.textContent = PROFILE_DESCRIPTIONS[active] || PROFILE_DESCRIPTIONS.balanced;
      };
      const rerender = () => { setProfileButtons(); renderNow(); };
       const tickerHandler = (symbol) => {
         const positionSymbol = documentRef.getElementById('ps-sym');
         if (positionSymbol) positionSymbol.textContent = symbol;
         persistReturnContext(symbol);
         return (onTicker || ((value) => root?.showTicker?.(value)))?.(symbol);
       };
       renderNow = () => {
         renderBuilderConditions(documentRef, builderConditions);
         render({ documentRef, store, readLiveData: liveReader, readWatchlist: watchlistReader, readAliases: aliasReader, sortState, visibleLimit, onExplain: explainRow, onCompare: (row) => {
           const symbol = row?.sym || row?.symbol;
           if (!symbol) return;
           if (compareSymbols.has(symbol)) compareSymbols.delete(symbol);
           else if (compareSymbols.size < 5) compareSymbols.add(symbol);
           renderCompareTray();
           renderNow();
         }, selectedSymbols, compareSymbols, columnPreset: columnState.preset, customColumns: columnState.custom, onWatchlistToggle: (symbol) => { (onWatchlistToggle || root?._aioWLToggle)?.(symbol); rerender(); }, rowsOverride: activeRows, workbenchResult: activeResult });
         renderCompareTray();
       };
       const handleClick = (event) => {
         const actionNode = event.target.closest?.('[data-aio-screener-action]');
         const header = event.target.closest?.('[data-scr-sort]');
        if (!actionNode && !header) return;
        event.preventDefault();
        event.stopPropagation();
         if (header) {
           const column = header.dataset.scrSort;
           if (sortState.column === column) sortState.ascending = !sortState.ascending;
           else { sortState.column = column; sortState.ascending = column === 'sym' || column === 'sector'; }
          visibleLimit.value = 12;
          renderNow();
          return;
        }
         const action = actionNode.dataset.aioScreenerAction;
         const argument = actionNode.dataset.aioScreenerArg;
         if (action === 'screen-preset') {
           const screen = defaultScreens().find((item) => item.definition.screenId === argument);
           if (screen) { activeDefinition = screen.definition; activeScreenId = screen.definition.screenId; syncDefinitionEditor(); renderWorkbench(); }
         } else if (action === 'screen-select') {
           const screen = defaultScreens().find((item) => item.definition.screenId === argument);
           if (screen) { activeDefinition = screen.definition; activeScreenId = screen.definition.screenId; activeResult = null; activeRows = null; syncDefinitionEditor(); if (workbenchStatus) workbenchStatus.textContent = '화면을 불러왔습니다 · 실행 버튼으로 결과 snapshot을 고정하세요.'; renderNow(); }
         } else if (action === 'screen-new') {
           activeDefinition = defaultScreens()[0]?.definition || null;
           activeScreenId = null;
           activeResult = null;
           activeRows = null;
           syncDefinitionEditor();
           if (workbenchStatus) workbenchStatus.textContent = '새 화면 초안 · 조건을 추가한 뒤 실행하세요.';
           renderNow();
         } else if (action === 'screen-save') {
           saveCurrentScreen();
         } else if (action === 'screen-run-visual') {
           try {
             const visualDefinition = buildVisualDefinition();
             if (!visualDefinition) throw new Error('SCREEN_DRAFT_EMPTY');
             runDefinition(visualDefinition);
             if (workbenchStatus && builderConditions.some((condition) => ['query', 'setup', 'sector', 'signal'].includes(condition.field))) workbenchStatus.textContent += ' · 검색/근거 조건은 결과 표 필터에도 적용됨';
           } catch (error) {
             if (workbenchStatus) workbenchStatus.textContent = '실행할 수 없습니다 · 조건을 확인하세요.';
             const detail = documentRef.getElementById('scr-definition-error-detail');
             if (detail) { detail.hidden = false; detail.textContent = error?.message || 'invalid_visual_definition'; }
           }
         } else if (action === 'screen-run') {
           try {
             const parsed = JSON.parse(definitionEditor?.value || '');
             const saved = parsed.definition ? importSavedScreen(JSON.stringify(parsed)) : createSavedScreen({ definition: parsed });
             runDefinition(saved.definition);
           } catch (error) {
             if (workbenchStatus) workbenchStatus.textContent = '실행할 수 없습니다 · JSON 형식 또는 화면 조건을 확인하세요.';
             const detail = documentRef.getElementById('scr-definition-error-detail');
             if (detail) { detail.hidden = false; detail.textContent = error?.message || 'invalid_json'; }
           }
         } else if (action === 'screen-import') {
           try {
             const parsed = JSON.parse(definitionEditor?.value || '');
             const saved = parsed.definition ? importSavedScreen(JSON.stringify(parsed)) : createSavedScreen({ definition: parsed });
             activeDefinition = saved.definition;
             activeScreenId = activeDefinition.screenId;
             activeResult = null;
             activeRows = null;
             if (workbenchStatus) workbenchStatus.textContent = '화면 정의를 불러왔습니다 · 실행 전 미리보기 상태입니다.';
             const detail = documentRef.getElementById('scr-definition-error-detail');
             if (detail) detail.hidden = true;
             renderWorkbench();
             renderNow();
           } catch (error) {
             if (workbenchStatus) workbenchStatus.textContent = '가져올 수 없습니다 · JSON 형식을 확인하세요.';
             const detail = documentRef.getElementById('scr-definition-error-detail');
             if (detail) { detail.hidden = false; detail.textContent = error?.message || 'invalid_json'; }
           }
         } else if (action === 'screen-export') {
           if (!activeDefinition) activeDefinition = defaultScreens()[0]?.definition || null;
           syncDefinitionEditor();
           documentRef.getElementById('scr-developer-drawer')?.setAttribute('open', '');
           if (workbenchStatus) workbenchStatus.textContent = '개발자 영역에 ScreenDefinition을 내보냈습니다.';
         } else if (action === 'profile') {
          root?._aioSetProfile?.(argument);
          Promise.resolve(onProfileChange?.(argument)).finally(rerender);
         } else if (action === 'toggle-filters') {
           documentRef.getElementById('scr-adv-filter-row')?.classList.toggle('active');
         } else if (action === 'toggle-columns') {
           columnState.preset = columnState.preset === 'all' ? 'discovery' : 'all';
           const presetSelect = documentRef.getElementById('scr-column-preset');
           if (presetSelect) presetSelect.value = columnState.preset;
           renderNow();
         } else if (action === 'column-preset') {
           columnState.preset = argument || 'discovery';
           columnState.custom = [];
           renderNow();
         } else if (action === 'column-chooser') {
           const chooser = documentRef.getElementById('scr-column-chooser');
           if (chooser) chooser.hidden = !chooser.hidden;
         } else if (action === 'tab') {
           ['ranking', 'factors', 'backtest'].forEach((tab) => {
             const panel = documentRef.getElementById(`scr-tab-${tab}`);
             if (panel) { panel.style.display = tab === argument ? '' : 'none'; panel.hidden = tab !== argument; }
             page.querySelectorAll(`[data-aio-screener-action="tab"][data-aio-screener-arg="${tab}"]`).forEach((button) => {
               button.style.borderBottomColor = tab === argument ? 'var(--accent)' : 'transparent';
               button.style.color = tab === argument ? 'var(--accent)' : 'var(--text-secondary)';
               button.setAttribute('aria-selected', tab === argument ? 'true' : 'false');
             });
          });
         } else if (action === 'load-more') {
           visibleLimit.value += 12;
           renderNow();
         } else if (action === 'add-builder-condition') {
           const condition = readVisualCondition();
           if (!condition) {
             if (workbenchStatus) workbenchStatus.textContent = '조건을 선택하고 값을 입력하세요.';
             return;
           }
           const target = documentRef.getElementById(condition.target);
           if (target) target.value = condition.value;
           builderConditions.push(condition);
           renderNow();
         } else if (action === 'remove-builder-condition') {
           builderConditions.splice(Number(argument), 1);
           renderNow();
         } else if (action === 'clear-filter') {
           const target = documentRef.getElementById(argument);
           if (target) { if (target.type === 'checkbox') target.checked = false; else target.value = ''; }
           visibleLimit.value = 12;
           renderNow();
         } else if (action === 'reset-all-filters') {
           ['scr-market', 'scr-sector', 'scr-signal', 'scr-cap', 'scr-text-search', 'scr-setup', 'scr-rsi-min', 'scr-rsi-max', 'scr-min-mom'].forEach((id) => { const field = documentRef.getElementById(id); if (field) field.value = ''; });
           const rank = documentRef.getElementById('scr-min-rank'); if (rank) rank.value = '0';
           const watchlist = documentRef.getElementById('scr-watchlist-only'); if (watchlist) watchlist.checked = false;
           builderConditions.splice(0);
           visibleLimit.value = 12;
           renderNow();
         } else if (action === 'reset-filters') {
          ['scr-min-rank', 'scr-rsi-min', 'scr-rsi-max', 'scr-min-mom'].forEach((id) => { const field = documentRef.getElementById(id); if (field) field.value = id === 'scr-min-rank' ? '0' : ''; });
          const setup = documentRef.getElementById('scr-setup');
          if (setup) setup.value = '';
          const watchlist = documentRef.getElementById('scr-watchlist-only');
          if (watchlist) watchlist.checked = false;
           visibleLimit.value = 12;
           renderNow();
         } else if (action === 'open-ticker') {
           tickerHandler(argument || activeRow?.sym || activeRow?.symbol);
         } else if (action === 'why-compare') {
           const symbol = argument || activeRow?.sym || activeRow?.symbol;
           if (symbol) { if (compareSymbols.has(symbol)) compareSymbols.delete(symbol); else if (compareSymbols.size < 5) compareSymbols.add(symbol); renderCompareTray(); renderNow(); }
         } else if (action === 'close-why') {
           const drawer = documentRef.getElementById('scr-why-drawer');
           if (drawer) drawer.hidden = true;
         } else if (action === 'clear-compare') {
           compareSymbols.clear(); renderCompareTray(); renderNow();
         } else if (action === 'focus-mode') {
           documentRef.body.classList.toggle('aio-screener-focus');
           actionNode.setAttribute('aria-pressed', documentRef.body.classList.contains('aio-screener-focus') ? 'true' : 'false');
         } else if (action === 'calc-position') calculatePosition(documentRef, liveReader);
         else if (action === 'hide-position') documentRef.getElementById('scr-position-sizer')?.classList.remove('active');
       };
       const handleInput = (event) => {
         if (!event.target.closest?.('#page-screener')) return;
         if (event.target.matches?.('#scr-screen-select')) {
           activeScreenId = event.target.value;
           [...page.querySelectorAll('[data-aio-screener-action="screen-select"]')].find((node) => node.dataset.aioScreenerArg === activeScreenId)?.click();
         } else if (event.target.matches?.('#scr-column-preset')) {
           columnState.preset = event.target.value || 'discovery';
           columnState.custom = [];
           renderNow();
         } else if (event.target.matches?.('#scr-market, #scr-sector, #scr-signal, #scr-cap, #scr-setup, #scr-min-rank, #scr-rsi-min, #scr-rsi-max, #scr-min-mom, #scr-text-search, #scr-watchlist-only')) {
           event.stopPropagation();
           visibleLimit.value = 12;
           renderNow();
        } else if (event.target.matches?.('#ps-capital, #ps-risk, #ps-stop')) {
          calculatePosition(documentRef, liveReader);
        }
      };
      const fillSelect = (id, key, label) => {
        const select = documentRef.getElementById(id);
        if (!select) return;
        const values = [...new Set((selectScreenerState(store.getState())?.rows || []).map((row) => row[key]).filter(Boolean))].sort();
        if (!values.length) return;
        const signature = values.join('|');
        if (select.dataset.aioValues === signature) return;
        const current = select.value;
        const options = [documentRef.createElement('option'), ...values.map(() => documentRef.createElement('option'))];
        options[0].value = '';
        options[0].textContent = label;
        values.forEach((value, index) => {
          options[index + 1].value = value;
          options[index + 1].textContent = value;
        });
        select.replaceChildren(...options);
        select.value = values.includes(current) ? current : '';
        select.dataset.aioValues = signature;
      };
      const fillControls = () => { fillSelect('scr-market', 'index', '전체 지수'); fillSelect('scr-sector', 'sector', '전체 섹터'); };
      const renderWithControls = () => { fillControls(); renderWorkbench(); rerender(); };
      page.addEventListener('click', handleClick);
      page.addEventListener('input', handleInput);
      page.addEventListener('change', handleInput);
      bag.add(() => page.removeEventListener('click', handleClick));
      bag.add(() => page.removeEventListener('input', handleInput));
      bag.add(() => page.removeEventListener('change', handleInput));
      bag.add(store.subscribe(renderWithControls));
      const eventTarget = documentRef || root;
      ['aio:refresh:done', 'aio:liveQuotes'].forEach((eventName) => {
        eventTarget?.addEventListener?.(eventName, renderWithControls);
        bag.add(() => eventTarget?.removeEventListener?.(eventName, renderWithControls));
      });
      mounted = true;
      renderWithControls();
      return () => {
        if (!mounted) return;
        mounted = false;
        bag.dispose();
        if (page.dataset.aioArchitectureRoute === 'screener') delete page.dataset.aioArchitectureRoute;
        if (page.dataset.aioArchitectureSlice === 'screener') delete page.dataset.aioArchitectureSlice;
        if (page.dataset.aioArchitectureRenderer === 'native') delete page.dataset.aioArchitectureRenderer;
      };
    }
  };
}
