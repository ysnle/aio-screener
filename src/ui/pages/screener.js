import { createResourceBag } from '../../app/lifecycle.js';
import { selectScreenerState } from '../../state/selectors/screener.js';
import { createSavedScreen, exportSavedScreen, importSavedScreen } from '../../domain/screener/saved-screens.js';
import { createSuppliedMaterialBridge } from '../knowledge/supplied-material-bridge.js';
import { SCREENER_FIELD_REGISTRY, createScreenDefinition, fieldValueForPurpose } from '../../data/contracts/screener.js';

const FIELD_BY_COLUMN = new Map(SCREENER_FIELD_REGISTRY.fields.map(field => [field.rowKey, field.fieldId]));

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
  { key: 'rank', label: '상대 점수', sortable: true, align: 'center', width: 72, group: 'ranking' },
  { key: 'grade', label: '등급', sortable: false, align: 'center', width: 48, group: 'ranking' },
  { key: 'sym', label: '종목', sortable: true, align: 'left', width: 142, group: 'identity', sticky: true },
  { key: 'sector', label: '섹터', sortable: true, align: 'left', width: 116, group: 'identity' },
  { key: 'momentum', label: '모멘텀', sortable: true, align: 'right', width: 74, group: 'factor' },
  { key: 'trend', label: '추세', sortable: true, align: 'right', width: 74, group: 'factor' },
  { key: 'lowvol', label: '저변동', sortable: true, align: 'right', width: 78, group: 'factor' },
  { key: 'value', label: '밸류', sortable: true, align: 'right', width: 70, group: 'factor' },
  { key: 'quality', label: '퀄리티', sortable: true, align: 'right', width: 78, group: 'factor' },
  { key: 'price', label: '가격', sortable: true, align: 'right', width: 86, group: 'market' },
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
  if (row.fieldReadiness) {
    const display = { ...row };
    for (const definition of SCREENER_FIELD_REGISTRY.fields) {
      if (!definition.fieldId.startsWith('identity.')) display[definition.rowKey] = fieldValueForPurpose(row, definition.fieldId, 'display');
    }
    return display;
  }
  const live = readLiveData?.()?.[row.sym] || {};
  const rowCurrency = String(row.instrumentRef?.currency || row.currency || '').trim().toUpperCase() || null;
  const liveCurrency = String(live.currency || '').trim().toUpperCase() || null;
  const marketCapCurrency = String(live.marketCapCurrency || liveCurrency || '').trim().toUpperCase() || null;
  const compatiblePrice = rowCurrency && liveCurrency && rowCurrency === liveCurrency ? finite(live.price) : null;
  return {
    ...row,
    price: compatiblePrice ?? row.price,
    mcap: marketCapCurrency === 'USD' && finite(live.marketCap) != null ? Math.round(live.marketCap / 1e9) : row.mcap
  };
}

function selectedValue(documentRef, id) { return documentRef.getElementById(id)?.value || ''; }

export function filterRows(rows, documentRef, { readWatchlist, readAliases } = {}) {
  const market = selectedValue(documentRef, 'scr-market');
  const sector = selectedValue(documentRef, 'scr-sector');
  const signal = selectedValue(documentRef, 'scr-signal');
  const cap = selectedValue(documentRef, 'scr-cap');
  const query = selectedValue(documentRef, 'scr-text-search').trim().toLowerCase();
  const exactSymbol = query && rows.some((row) => row.sym?.toLowerCase() === query) ? query : null;
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
    if (cap && (finite(row.mcap) == null || row.mcap <= 0 || (row.fieldReadiness && fieldValueForPurpose(row, 'valuation.marketCap', 'calculation') == null))) return false;
    if (cap === 'MEGA' && !(row.mcap >= 1000)) return false;
    if (cap === 'LARGE' && !(row.mcap >= 10 && row.mcap < 1000)) return false;
    if (cap === 'MID' && !(row.mcap >= 2 && row.mcap < 10)) return false;
    if (cap === 'SMALL' && !(row.mcap < 2)) return false;
    if (minRank > 0 && !(row.screenStatus === 'passed' && finite(row.rank) != null && row.rank >= minRank)) return false;
    const rsi = row.fieldReadiness ? fieldValueForPurpose(row, 'price.rsi14', 'calculation') : finite(row.rsi);
    const momentum = row.fieldReadiness ? fieldValueForPurpose(row, 'price.ret3m', 'calculation') : finite(row.ret3m);
    if (Number.isFinite(rsiMin) && !(rsi != null && rsi >= rsiMin)) return false;
    if (Number.isFinite(rsiMax) && !(rsi != null && rsi <= rsiMax)) return false;
    if (Number.isFinite(minMomentum) && !(momentum != null && momentum >= minMomentum)) return false;
    if (setupFilter === 'WINNER' && row.setupProfile?.winnerFilter !== 'candidate') return false;
    if (setupFilter === 'RSPULLBACK' && row.setupProfile?.relativeStrengthPullback !== 'candidate') return false;
    if (setupFilter === 'SUPPORT200' && row.setupProfile?.support200 !== 'near') return false;
    if (setupFilter === 'CLIMAX' && row.setupProfile?.climaxRisk !== 'watch') return false;
    if (setupFilter === 'MISSING' && !(row.setupProfile?.winnerFilter === 'unavailable' || (row.setupProfile?.missingEvidence || []).length)) return false;
    if (watchlist && !watchlist.has(row.sym)) return false;
    if (!query) return true;
    if (exactSymbol) return row.sym?.toLowerCase() === exactSymbol;
    if (signalFromText && row.signal !== signalFromText) return false;
    const setupText = Array.isArray(row.setupProfile?.tags) ? row.setupProfile.tags.join(' ') : '';
    const haystack = `${row.sym} ${row.name} ${row.memo || ''} ${row.newsMemo || ''} ${row.sector || ''} ${setupText}`.toLowerCase();
    const direct = haystack.includes(query);
    const residualWords = words.filter((word) => !aliases[word]);
    const allWords = residualWords.length > 0 && residualWords.every((word) => haystack.includes(word));
    return direct || allWords || matchedSymbols.has(row.sym) || (!!signalFromText && residualWords.length === 0 && matchedSymbols.size === 0);
  });
}

export function visibleRank(row) {
  return row?.screenStatus === 'unavailable' || row?.screenStatus === 'rejected' ? null : finite(row?.rank);
}

export function sortRows(rows, sortColumn, ascending, readLiveData) {
  return rows.map(row => ({ row, view: liveRow(row, readLiveData) })).sort(({ view: a }, { view: b }) => {
    const factorColumn = ['momentum', 'trend', 'lowvol', 'value', 'quality', 'kalman'].includes(sortColumn);
    let av = factorColumn ? a.factorScores?.[sortColumn] : a[sortColumn];
    let bv = factorColumn ? b.factorScores?.[sortColumn] : b[sortColumn];
    if (sortColumn === 'price') { av = a.price; bv = b.price; }
    if (sortColumn === 'rank') { av = visibleRank(a); bv = visibleRank(b); }
    const missing = (value) => value == null || value === '' || (typeof value === 'number' && !Number.isFinite(value));
    if (missing(av) || missing(bv)) return missing(av) === missing(bv) ? 0 : missing(av) ? 1 : -1;
    if (typeof av === 'string') av = av.toUpperCase();
    if (typeof bv === 'string') bv = bv.toUpperCase();
    const comparison = av > bv ? 1 : av < bv ? -1 : 0;
    return ascending ? comparison : -comparison;
  }).map(entry => entry.row);
}

export function vcpStageLabel(stage) {
  return ({ not_stage2: '추세 조건 미충족', breakout: '피벗 돌파', near_pivot: '피벗 근접', contracting: '변동폭 수축', basing: '기반 형성', stage2_only: '추세 조건 충족' })[stage] || '관측';
}

function createRankNode(documentRef, row) {
  const wrap = documentRef.createElement('div');
  if (row.screenStatus === 'unavailable' || row.screenStatus === 'rejected') {
    wrap.textContent = row.screenStatus === 'rejected' ? '조건 미충족' : '근거 부족';
    wrap.title = '필수 데이터가 모두 준비되기 전에는 순위를 표시하지 않습니다.';
    wrap.style.cssText = 'font-size:10px;color:var(--text-muted);white-space:nowrap;';
    return wrap;
  }
  const rank = visibleRank(row);
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
  row = live;
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
  if (key === 'grade') return row.screenStatus === 'unavailable' || row.rank == null ? '—' : row.rank >= 80 ? 'A' : row.rank >= 65 ? 'B' : row.rank >= 50 ? 'C' : row.rank >= 35 ? 'D' : 'F';
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
    if (row.screenStatus === 'unavailable') return '—';
    const value = row.factorScores?.[key];
    const node = documentRef.createElement('span');
    node.textContent = value == null ? '—' : Number(value).toFixed(0);
    node.style.color = value == null ? 'var(--text-muted)' : value >= 66 ? 'var(--data-green)' : value >= 40 ? 'var(--data-amber)' : 'var(--data-red)';
    return node;
  }
  if (key === 'price') {
    const node = text(documentRef, finite(live.price) == null ? '미수신' : numberText(live.price, 2));
    node.title = finite(live.price) == null ? '가격 미수신' : `관측 가격 ${row.instrumentRef?.currency || '통화 미확인'} · 기준 ${row.priceObservedAt || '미확인'} · ${row.priceSource || '출처 미확인'}`;
    if (finite(live.price) != null && row.instrumentRef?.currency && row.instrumentRef.currency !== 'USD') node.textContent += ` ${row.instrumentRef.currency}`;
    return node;
  }
  if (['ret1m', 'ret3m', 'ret6m'].includes(key)) return returnText(row[key]);
  if (key === 'rsi') return numberText(row.rsi, 1);
  if (key === 'pctSma50') return returnText(row.pctSma50);
  if (key === 'vcpScore') {
    const node = documentRef.createElement('span');
    node.textContent = row.vcpScore == null ? '—' : `${row.vcpScore} · ${vcpStageLabel(row.vcpStage)}`;
    node.style.color = row.vcpScore == null ? 'var(--text-muted)' : row.vcpScore >= 70 ? 'var(--data-green)' : row.vcpScore >= 50 ? 'var(--data-amber)' : 'var(--data-red)';
    return node;
  }
  if (key === 'mcap') {
    if (live.mcap != null) return live.mcap >= 1000 ? `$${(live.mcap / 1000).toFixed(1)}T` : `$${live.mcap}B`;
    const native = row.nativeMarketCap;
    if (finite(native?.value) == null || ['BLOCKED', 'DENIED'].includes(native.rightsId)) return '—';
    const billions = native.value / 1e9;
    const amount = billions >= 1000 ? `${numberText(billions / 1000, 1)}T` : `${numberText(billions, 2)}B`;
    const node = text(documentRef, `${native.currency} ${amount} · 참고`);
    node.title = `${native.source || '출처 미확인'} · 관측 ${native.observedAt || '시각 미확인'} · USD 환산값이 없어 USD 시총 필터/팩터에는 사용하지 않음`;
    return node;
  }
  if (key === 'entry') {
    if (row.screenStatus === 'unavailable') return '판정 보류';
    const entry = entryTiming(row);
    const entryNode = documentRef.createElement('span');
    entryNode.className = `scr-entry-chip ${entry[1]}`;
    entryNode.textContent = entry[0];
    entryNode.title = row.setupProfile?.explanation || 'RSI·랭크·모멘텀 기반 설명형 분류';
    return entryNode;
  }
  if (key === 'signal') {
    if (row.screenStatus === 'unavailable') return '근거 부족';
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
    const fieldId = FIELD_BY_COLUMN.get(column.key);
    const field = fieldId && row.fieldReadiness?.fields?.[fieldId];
    if (field) {
      td.dataset.fieldStatus = field.status;
      td.title = `${field.sourceId || '출처 미확인'} · 관측 ${field.observedAt || '시각 미확인'} · ${field.status}`;
      if (['STALE', 'LAST_GOOD', 'CONFLICT'].includes(field.status) && fieldValueForPurpose(row, fieldId) != null) {
        const note = documentRef.createElement('small');
        note.textContent = field.status === 'CONFLICT' ? '값 충돌 · 참고' : `${field.observedAt ? String(field.observedAt).slice(0, 10) : '시각 미확인'} · 참고`;
        note.style.cssText = 'display:block;font-size:9px;color:var(--text-muted);';
        td.appendChild(note);
      }
    }
    tr.appendChild(td);
    if (column.sticky) stickyLeft += column.width;
  });
  return tr;
}

function renderFactorTab(documentRef, metadata) {
  const ranking = metadata?.ranking || {};
  const bars = documentRef.getElementById('scr-factor-bars');
  const weights = ranking.appliedFactorWeights || ranking.activeFactorWeights || {};
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
  const confidenceNode = documentRef.getElementById('screener-factor-confidence');
  if (confidenceNode) {
    const confidence = finite(ranking.confidence);
    const composite = finite(ranking.compositeConfidence);
    const status = ranking.qualityStatus || 'unavailable';
    confidenceNode.textContent = confidence == null
      ? '입력 신뢰도 산출 불가 — 미래 수익률 확률이 아닙니다.'
      : `행 근거 평균 ${Math.round(confidence * 100)}% · 횡단면 진단 ${composite == null ? '—' : `${Math.round(composite * 100)}%`} · 품질 ${status} · 미래 수익률 확률 아님`;
  }
  const diagnosticsNode = documentRef.getElementById('screener-factor-diagnostics');
  if (diagnosticsNode) {
    const sector = ranking.sectorNeutrality || {};
    const outliers = ranking.outlierDiagnostics || {};
    const turnover = ranking.turnoverStability || {};
    const regimeStability = ranking.regimeStability || {};
    const parts = [
      `섹터 중립 ${sector.status || '미확인'}${Number.isFinite(Number(sector.groups)) ? ` (${sector.groups}개 그룹${Number(sector.unknownRows) ? `, 미분류 ${sector.unknownRows}` : ''})` : ''}`,
      `극단치 완화 ${Number.isFinite(Number(outliers.totalOutliers)) ? `${outliers.totalOutliers}건` : '미확인'}`,
      `상위군 회전 ${Number.isFinite(Number(turnover.turnoverPct)) ? `${turnover.turnoverPct}%` : turnover.status || '이전 스냅샷 없음'}`,
      `레짐 안정성 ${regimeStability.status || '이전 스냅샷 없음'}`
    ];
    diagnosticsNode.textContent = `${parts.join(' · ')} · 연구용 상대 순위이며 매매 신호/자동 가중 승격에 사용하지 않습니다.`;
    diagnosticsNode.dataset.decisionEligible = String(ranking.researchBoundary?.decisionEligible === true);
  }
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
    if (column.sticky) stickyLeft += column.width;
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

function render({ documentRef, store, readLiveData, readWatchlist, readAliases, sortState, visibleLimit, onWatchlistToggle, onExplain, onCompare, onVisibleSymbols, selectedSymbols, compareSymbols, columnPreset = 'discovery', customColumns = [], rowsOverride = null, workbenchResult = null }) {
  const currentState = selectScreenerState(store?.getState?.() || {});
  const state = workbenchResult?.run ? { ...currentState, metadata: workbenchResult.snapshotMetadata || {}, status: 'partial', lastRun: workbenchResult.run, readiness: workbenchResult.readiness } : currentState;
  const page = documentRef?.getElementById('page-screener');
  if (!page) return;
  const rows = rowsOverride || state?.rows || [];
  const filtered = sortRows(filterRows(rows, documentRef, { readWatchlist, readAliases }), sortState.column, sortState.ascending, readLiveData);
  const visibleColumns = getVisibleColumns(columnPreset, customColumns);
  const table = documentRef.getElementById('screener-results-table');
  renderTableHeader(documentRef, table, visibleColumns, sortState);
  const body = documentRef.getElementById('screener-results-body');
  if (body) {
    const focusedRow = documentRef.activeElement?.closest?.('[data-aio-screener-ticker]');
    const focusedSymbol = body.contains(focusedRow) ? focusedRow.dataset.aioScreenerTicker : null;
    const focusedAction = focusedSymbol && documentRef.activeElement?.getAttribute('aria-label');
    body.replaceChildren();
    const visible = filtered.slice(0, visibleLimit.value);
    if (!workbenchResult?.run) onVisibleSymbols?.(visible.map((row) => row.sym || row.symbol).filter(Boolean));
    if (!visible.length) {
      const empty = documentRef.createElement('tr');
      empty.appendChild(cell(documentRef, state?.status === 'unavailable' ? '스크리너 산출물 미수신' : '조건에 맞는 종목이 없습니다', '', 'text-align:center;padding:20px;color:var(--text-muted);'));
      empty.firstChild.colSpan = visibleColumns.length;
      body.appendChild(empty);
    } else visible.forEach((row) => body.appendChild(createTableRow(documentRef, row, { readLiveData, readWatchlist, onWatchlistToggle, onExplain, onCompare, selectedSymbols, compareSymbols, visibleColumns })));
    if (focusedSymbol) {
      const row = [...body.querySelectorAll('[data-aio-screener-ticker]')].find((node) => node.dataset.aioScreenerTicker === focusedSymbol);
      const action = row && [...row.querySelectorAll('button')].find((node) => node.getAttribute('aria-label') === focusedAction);
      (action || row)?.focus({ preventScroll: true });
    }
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
  if (top) top.textContent = String(allRows.filter((row) => row.screenStatus === 'passed' && finite(row.rank) != null && row.rank >= 80).length);
  if (buy) buy.textContent = String(allRows.filter((row) => row.screenStatus === 'passed' && row.signal === 'BUY').length);
  if (factorCount) factorCount.textContent = String(state?.metadata?.ranking?.activeFactors?.length || '—');
  const asOf = page.querySelector('[data-factor-asof]');
  if (asOf) asOf.textContent = workbenchResult?.run?.snapshotId ? `스크린 스냅샷 ${String(workbenchResult.run.snapshotId).slice(0, 18)}` : state?.metadata?.asOf ? `팩터 기준 ${String(state.metadata.asOf).slice(0, 10)}` : '팩터 데이터 대기';
  const provenance = page.querySelector('[data-screener-provenance]');
  if (provenance) {
    const metadata = state?.metadata || {};
    const fmtDate = (value) => value ? String(value).slice(0, 16).replace('T', ' ') : '—';
    const sec = metadata.secFundamentalsEligible > 0
      ? `SEC FY ${metadata.secFundamentalsModel || '정규화'} ${metadata.secFundamentalsStored || 0}/${metadata.secFundamentalsEligible}`
      : 'SEC FY coverage 별도 확인 대기';
    const universeNote = metadata.universeFreshnessStatus === 'stale'
      ? `종목 유니버스 갱신 필요 (${fmtDate(metadata.universeLastBulkUpdate)})`
      : metadata.universeFreshnessStatus === 'unknown' ? '종목 유니버스 최신성 미확인' : '종목 유니버스 최신';
    const research = metadata.researchContext || {};
    const researchNote = research.referenceId
      ? `연구 프레임 ${research.frameworkIds?.length || 0}개·시계열 ${research.timeSeriesIds?.length || 0}개 (REFERENCE)`
      : '연구 프레임 연결 대기';
    provenance.textContent = `연구용 스냅샷 · 팩터 관측 ${fmtDate(metadata.factorObservedAt)} · 생성 ${fmtDate(metadata.asOf)} · ${metadata.source || '출처 확인 대기'} · ${sec} · ${universeNote} · ${researchNote} · 공식 거래소 breadth 아님`;
    provenance.title = metadata.fundamentalCoverageScope || '관측시각·생성시각·SEC-only 분모를 분리해 표시합니다.';
    provenance.dataset.sourceKind = 'reference';
    provenance.dataset.operationalUse = 'reference-only';
  }
  const readiness = documentRef.getElementById('screener-readiness-note');
  const run = workbenchResult?.run || state?.lastRun || {};
  const readinessResult = workbenchResult?.readiness || state?.readiness;
  const readyCount = readinessResult?.eligibleCount ?? 0;
  const passedCount = run?.passed ?? 0;
  const unavailableCount = run?.unavailable ?? 0;
  if (readiness) readiness.textContent = state?.status === 'unavailable'
    ? '데이터 상태: 산출물 미수신 · 결과와 검증 수치를 표시하지 않습니다.'
    : `${state?.metadata?.artifactFreshnessStatus === 'stale' || state?.metadata?.factorFreshnessStatus === 'stale' ? '갱신 지연: 원자료는 기준일과 함께 표시하고 계산은 필드별로 확인합니다. · ' : ''}${state?.metadata?.universeFreshnessStatus === 'stale' ? '종목 목록 최신성 확인 필요 · ' : ''}연구 snapshot · 종목 ${allRows.length} · 계산 준비 ${readyCount} · 조건 통과 ${passedCount} · 계산 보류 ${unavailableCount} · 상대 랭킹은 연구용이며 현재 매매 지시가 아닙니다.`;
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

export function createScreenerPage({ documentRef, store, root = globalThis, workbench = {}, onProfileChange, onTicker, onWatchlistToggle, readWatchlist, readAliases, readLiveData } = {}) {
  // SCR-UX-02: rank is the visible discovery order and is therefore the
  // initial sort. Market-cap remains available through the column header.
  const sortState = { column: 'rank', ascending: false };
  const visibleLimit = { value: 12 };
  const columnState = { preset: 'discovery', custom: [] };
  const selectedSymbols = new Set();
  const compareSymbols = new Set();
  // Controls own the visual conditions. A second mutable chip array drifted
  // from the filters and could keep removed conditions active on the next run.
  const readBuilderConditions = () => BUILDER_FIELDS.flatMap(definition => {
    const value = String(documentRef?.getElementById(definition.target)?.value || '').trim();
    if (!value || (definition.value === 'rank' && value === '0')) return [];
    return [{ field: definition.value, label: definition.label, value, target: definition.target }];
  });
  let mounted = false;
  let renderNow = () => {};
  let activeRows = null;
  let activeResult = null;
  let activeDefinition = null;
  let activeScreenId = null;
  let activeRow = null;
  let returnView = null;
  return {
    route: 'screener',
    mount() {
      const bag = createResourceBag();
      let mountActive = true;
      bag.add(() => { mountActive = false; });
      const page = documentRef?.getElementById('page-screener');
      if (!page) return () => {};
      let suppliedMaterialBridge = page.querySelector('[data-aio-supplied-material-route="screener"]');
      if (!suppliedMaterialBridge) {
        suppliedMaterialBridge = createSuppliedMaterialBridge(documentRef, {
          routeId: 'screener',
          heading: '스크리너 · 시장 확인·AI 용량·qualification 정렬'
        });
        page.appendChild(suppliedMaterialBridge);
        bag.add(() => suppliedMaterialBridge.remove());
      }
      const liveReader = readLiveData || (() => root?._liveData || {});
      const watchlistReader = readWatchlist || (() => root?._aioWatchlistGet?.() || []);
      const aliasReader = readAliases || (() => root?.SCR_KEYWORD_ALIASES || {});
      const profileReader = () => root?._aioGetActiveProfile?.() || 'balanced';
      let visibleQuoteSignature = '';
      let visibleQuoteRequestedAt = 0;
      const requestVisibleQuotes = (symbols) => {
        const requested = [...new Set((Array.isArray(symbols) ? symbols : []).map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean))].slice(0, 120);
        if (!requested.length) return;
        requested.forEach((symbol) => root?.AIO?.registerLiveSymbol?.(symbol, { reason: 'screener-visible-row' }));
        const signature = requested.join('|');
        const nowMs = Date.now();
        if (signature === visibleQuoteSignature && nowMs - visibleQuoteRequestedAt < 55_000) return;
        if (root?._aioBootPhase?.quoteReady === false || typeof root?.AIO?.runScheduledRefresh !== 'function') return;
        visibleQuoteSignature = signature;
        visibleQuoteRequestedAt = nowMs;
        Promise.resolve(root.AIO.runScheduledRefresh({
          keys: ['quotes'],
          symbols: requested,
          pageId: 'screener',
          reason: 'screener-visible-quotes'
        })).catch(() => {});
      };
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
         return Array.isArray(stored) && stored.length ? stored : (workbench.getDefaultScreens?.() || []);
       };
       const setText = (id, value) => {
         const node = documentRef.getElementById(id);
         if (node) node.textContent = value == null || value === '' ? '—' : String(value);
         return node;
       };
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
          const factorConfidence = finite(row.confidence);
          const visibleRank = row.screenStatus === 'passed' && row.rank != null ? row.rank : '—';
          setText('scr-why-status', `${row.screenStatus || 'unavailable'} · rank ${visibleRank} · 필드 coverage ${readiness.coveragePct == null ? '—' : `${readiness.coveragePct}%`} · 팩터 근거 ${factorConfidence == null ? '—' : `${Math.round(factorConfidence * 100)}%`} (수익확률 아님)`);
         setText('scr-why-contrary', contrary.length ? contrary.join(' · ') : row.screenStatus === 'unavailable' ? '필수 근거 미수신으로 조건 판단을 보류했습니다.' : '조건을 반대한 근거가 없습니다.');
         setText('scr-why-missing', missing.length ? missing.join(' · ') : '필수 필드 결측 없음');
         setText('scr-why-provenance', row.instrumentRef?.instrumentId ? `instrument ${row.instrumentRef.instrumentId}` : row.source || 'provenance 미수신');
         setText('scr-why-preview', `${row.sym || row.symbol} · ${title} · ${missing.length ? `결측 ${missing.length}개` : '결측 없음'} · ${contrary.length ? `반대 근거 ${contrary.length}개` : row.screenStatus === 'unavailable' ? '판정 보류' : '반대 근거 없음'}`);
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
       let runGeneration = 0;
       let archiveGeneration = 0;
       const refreshRunArchive = async () => {
         if (!runHistory) return;
         const generation = ++archiveGeneration;
         runHistory.dataset.archiveLoaded = 'loading';
         try {
           if (typeof workbench.list !== 'function') throw new Error('SCREEN_ARCHIVE_UNAVAILABLE');
           const entries = await workbench.list();
           if (!mountActive || generation !== archiveGeneration) return;
           runHistory.replaceChildren();
           runHistory.dataset.archiveLoaded = 'true';
           if (!entries.length) runHistory.textContent = '보관한 사용자 실행 없음 · 실행하면 입력을 이 브라우저에 최대 5개 보관합니다.';
           for (const entry of entries) {
             const item = documentRef.createElement('div');
             const label = documentRef.createElement('span');
             label.textContent = `${entry.name} · ${entry.savedAt.slice(0, 16)} `;
             const replay = documentRef.createElement('button');
             replay.type = 'button'; replay.className = 'aio-btn-table'; replay.textContent = '저장 입력으로 재현';
             replay.addEventListener('click', async () => {
               const run = ++runGeneration;
               try {
                 const result = await workbench.replay(entry.id);
                 if (!mountActive || run !== runGeneration) return;
                 activeDefinition = result.definition; activeScreenId = activeDefinition.screenId;
                 activeResult = result; activeRows = result.rows;
                 selectedSymbols.clear(); visibleLimit.value = 12;
                 if (workbenchStatus) workbenchStatus.textContent = '보관한 입력으로 재현됨 · 현재 시장 상태가 아닌 당시 결과입니다.';
                 syncDefinitionEditor(); renderWorkbench(); renderNow();
               } catch (_) { if (mountActive && run === runGeneration && workbenchStatus) workbenchStatus.textContent = '재현 불가 · 모델 버전 또는 보관 데이터가 일치하지 않습니다.'; }
             });
             const remove = documentRef.createElement('button');
             remove.type = 'button'; remove.className = 'aio-btn-table'; remove.textContent = '보관 삭제';
             remove.addEventListener('click', async () => {
               try { await workbench.remove(entry.id); if (mountActive) refreshRunArchive(); }
               catch (_) { if (mountActive && workbenchStatus) workbenchStatus.textContent = '로컬 보관 삭제 실패'; }
             });
             item.append(label, replay, remove); runHistory.appendChild(item);
           }
         } catch (_) {
           if (!mountActive || generation !== archiveGeneration) return;
           runHistory.dataset.archiveLoaded = 'unavailable';
           runHistory.textContent = '이 브라우저에서는 실행 입력을 보관할 수 없습니다.';
         }
       };
       const runDefinition = async (definition) => {
         const generation = ++runGeneration;
         try {
           const saved = createSavedScreen({ definition });
           activeDefinition = saved.definition;
           activeScreenId = activeDefinition.screenId;
           if (typeof workbench.run !== 'function') throw new Error('SCREEN_ENGINE_UNAVAILABLE');
           const result = await workbench.run(activeDefinition);
           if (generation !== runGeneration || !mountActive) return;
           if (result?.rows) {
             activeResult = result;
             activeRows = result.rows;
             selectedSymbols.clear();
             visibleLimit.value = 12;
             if (workbenchStatus) workbenchStatus.textContent = `실행 완료 · ${result.persistence?.status === 'persisted' ? '입력 로컬 보관됨' : '입력 보관 실패: 이 화면에서만 유지'} · ${result.run?.passed || 0} 통과 / ${result.run?.unavailable || 0} 데이터 부족`;
             syncDefinitionEditor();
             renderWorkbench();
             renderNow();
             refreshRunArchive();
           }
         } catch (error) {
           if (generation !== runGeneration || !mountActive) return;
           if (workbenchStatus) workbenchStatus.textContent = `실행할 수 없습니다 · 정의를 확인하세요.`;
           const detail = documentRef.getElementById('scr-definition-error-detail');
           if (detail) { detail.hidden = false; detail.textContent = error?.message || 'invalid_definition'; }
         }
       };
       const renderWorkbench = () => {
         const state = selectScreenerState(store.getState()) || {};
         if (workbenchStatus) {
           workbenchStatus.dataset.runId = activeResult?.run?.runId || '';
           workbenchStatus.dataset.resultHash = activeResult?.resultHash || '';
           workbenchStatus.dataset.explanationsHash = activeResult?.explanationsHash || '';
           workbenchStatus.dataset.snapshotId = activeResult?.run?.snapshotId || '';
           workbenchStatus.dataset.rowCount = String(activeResult?.run?.rowCount || 0);
           workbenchStatus.dataset.persistence = activeResult?.persistence?.status || '';
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
         renderBuilderConditions(documentRef, readBuilderConditions());
         renderFilterChips(documentRef);
         renderColumnChooser(documentRef, page, columnState.preset, columnState.custom, (columns) => {
           columnState.preset = 'custom';
           columnState.custom = columns;
           renderNow();
         });
         const readiness = activeResult?.readiness || state.readiness;
         if (readinessPreview) readinessPreview.textContent = readiness ? `필드 준비 ${readiness.eligibleCount}/${readiness.rowCount} · ${readiness.coveragePct}% · 필수: ${(readiness.requiredFields || []).map((field) => field.split('.').pop()).join(' · ') || '없음'}` : '필드 준비도 미리보기 대기';
         if (workbenchStatus && !activeResult) workbenchStatus.textContent = state.lastRun ? `현재 데이터 미리보기 · ${state.lastRun.passed} 통과 · 실행 버튼으로 입력 고정` : '실행 전 미리보기';
         if (runHistory && !runHistory.dataset.archiveLoaded) refreshRunArchive();
         if (outcomeLab) outcomeLab.textContent = state.outcomes?.length ? `Outcome · ${state.outcomes.length}개 관측 · T+1/T+5/T+21/T+63` : 'Outcome · 자동 추적 미연결 · 보관 입력 재현만 지원';
         if (operationsState) operationsState.textContent = state.refreshPlan ? `Operations · refresh ${state.refreshPlan.queued?.length || 0}건 · quota/circuit` : `Operations · 데이터 sync ${state.snapshotId ? String(state.snapshotId).slice(0, 18) : '미수신'} · 사용자 실행과 분리`;
       };
       const renderCompareTray = () => {
         const tray = documentRef.getElementById('scr-compare-tray');
         if (!tray) return;
         tray.hidden = compareSymbols.size === 0;
         const list = documentRef.getElementById('scr-compare-list');
         if (list) {
           list.replaceChildren();
           if (compareSymbols.size) {
             const rows = activeRows || selectScreenerState(store.getState())?.rows || [];
             const compared = [...compareSymbols].map((symbol) => rows.find((row) => (row.sym || row.symbol) === symbol) || { sym: symbol, screenStatus: 'unavailable' });
             const table = documentRef.createElement('table');
             table.setAttribute('aria-label', '선택 종목 비교');
             table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;text-align:right;';
             const heading = documentRef.createElement('tr');
             const label = documentRef.createElement('th');
             label.scope = 'col'; label.textContent = '동일 기준 비교'; heading.append(label);
             for (const row of compared) {
               const th = documentRef.createElement('th');
               th.scope = 'col';
               const button = documentRef.createElement('button');
               button.type = 'button'; button.className = 'aio-btn-table'; button.textContent = row.sym;
               button.setAttribute('aria-label', `${row.sym} 종목 상세`);
               button.addEventListener('click', () => tickerHandler(row.sym));
               th.append(button); heading.append(th);
             }
             const head = documentRef.createElement('thead'); head.append(heading); table.append(head);
             const body = documentRef.createElement('tbody');
             for (const key of ['rank', 'price', 'ret1m', 'ret3m', 'rsi', 'vcpScore', 'value', 'quality']) {
               const tr = documentRef.createElement('tr');
               const th = documentRef.createElement('th');
               th.scope = 'row'; th.textContent = SCREENER_COLUMN_REGISTRY.find((column) => column.key === key).label;
               tr.append(th);
               for (const row of compared) tr.append(cell(documentRef, createColumnContent(documentRef, row, key, { readLiveData: liveReader })));
               body.append(tr);
             }
             table.append(body); list.append(table);
           }
         }
         const count = documentRef.getElementById('scr-compare-count');
         if (count) count.textContent = String(compareSymbols.size);
       };
       const saveCurrentScreen = () => {
         if (!activeDefinition || typeof workbench.setSavedScreens !== 'function') return;
         const state = selectScreenerState(store.getState()) || {};
         const saved = createSavedScreen({ definition: activeDefinition });
         const current = Array.isArray(state.savedScreens) ? state.savedScreens : defaultScreens();
         const next = [...current.filter((screen) => screen.definition?.screenId !== saved.definition.screenId), saved];
         workbench.setSavedScreens(next);
         if (workbenchStatus) workbenchStatus.textContent = `이번 세션에 조건 저장 · ${saved.label} · 영구 보관은 실행 입력 보관 또는 JSON 내보내기`;
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
         const nodes = readBuilderConditions().flatMap((condition) => {
           const numeric = Number(condition.value);
           if (condition.field === 'rank' && Number.isFinite(numeric)) return [{ type: 'range', field: 'rank', min: numeric, nullPolicy: 'unknown' }];
           if (condition.field === 'rsi' && Number.isFinite(numeric)) return [{ type: 'range', field: 'price.rsi14', min: numeric, nullPolicy: 'unknown' }];
           if (condition.field === 'momentum' && Number.isFinite(numeric)) return [{ type: 'range', field: 'price.ret3m', min: numeric, nullPolicy: 'unknown' }];
           return [];
         });
         const current = activeDefinition.filtersAST?.type === 'and' ? activeDefinition.filtersAST.children || [] : [activeDefinition.filtersAST];
         return createScreenDefinition({ ...activeDefinition, filtersAST: { type: 'and', children: [
           ...current.filter(node => node?.origin !== 'visual-builder'),
           ...nodes.map(node => ({ ...node, origin: 'visual-builder' }))
         ] } });
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
          returnView = { symbol, scrollTop: documentRef.querySelector('.content')?.scrollTop || 0 };
         return (onTicker || ((value) => root?.showTicker?.(value)))?.(symbol);
       };
       renderNow = () => {
         renderBuilderConditions(documentRef, readBuilderConditions());
         render({ documentRef, store, readLiveData: liveReader, readWatchlist: watchlistReader, readAliases: aliasReader, sortState, visibleLimit, onExplain: explainRow, onCompare: (row) => {
           const symbol = row?.sym || row?.symbol;
           if (!symbol) return;
           if (compareSymbols.has(symbol)) compareSymbols.delete(symbol);
           else if (compareSymbols.size < 5) compareSymbols.add(symbol);
           renderCompareTray();
           renderNow();
         }, onVisibleSymbols: requestVisibleQuotes, selectedSymbols, compareSymbols, columnPreset: columnState.preset, customColumns: columnState.custom, onWatchlistToggle: (symbol) => { (onWatchlistToggle || root?._aioWLToggle)?.(symbol); rerender(); }, rowsOverride: activeRows, workbenchResult: activeResult });
         renderCompareTray();
       };
       const selectDefinition = (screenId) => {
         const screen = defaultScreens().find(item => item.definition.screenId === screenId);
         if (!screen) return;
         ++runGeneration;
         activeDefinition = screen.definition;
         activeScreenId = screen.definition.screenId;
         activeResult = null;
         activeRows = null;
         Object.keys(FILTER_LABELS).forEach(id => {
           const control = documentRef.getElementById(id);
           if (control?.type === 'checkbox') control.checked = false;
           else if (control) control.value = id === 'scr-min-rank' ? '0' : '';
         });
         visibleLimit.value = 12;
         syncDefinitionEditor(); renderWorkbench(); renderNow();
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
         if (action === 'screen-preset' || action === 'screen-select') {
           selectDefinition(argument);
         } else if (action === 'screen-new') {
           ++runGeneration;
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
             if (workbenchStatus && readBuilderConditions().some((condition) => ['query', 'setup', 'sector', 'signal'].includes(condition.field))) workbenchStatus.textContent += ' · 검색/구조/섹터는 현재 표 필터이며 저장 실행 조건에는 포함되지 않음';
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
             ++runGeneration;
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
           renderNow();
         } else if (action === 'remove-builder-condition') {
           const condition = readBuilderConditions()[Number(argument)];
           const target = condition && documentRef.getElementById(condition.target);
           if (target) target.value = condition.field === 'rank' ? '0' : '';
           visibleLimit.value = 12;
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
          }
       };
       const handleInput = (event) => {
         if (!event.target.closest?.('#page-screener')) return;
         if (event.target.matches?.('#scr-screen-select')) {
           selectDefinition(event.target.value);
         } else if (event.target.matches?.('#scr-column-preset')) {
           columnState.preset = event.target.value || 'discovery';
           columnState.custom = [];
           renderNow();
         } else if (event.target.matches?.('#scr-market, #scr-sector, #scr-signal, #scr-cap, #scr-setup, #scr-min-rank, #scr-rsi-min, #scr-rsi-max, #scr-min-mom, #scr-text-search, #scr-watchlist-only')) {
           event.stopPropagation();
           visibleLimit.value = 12;
           renderNow();
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
      renderCompareTray();
      if (returnView) {
        const view = returnView;
        returnView = null;
        const restore = () => {
          if (!mounted) return;
          const row = [...page.querySelectorAll('[data-aio-screener-ticker]')].find((node) => node.dataset.aioScreenerTicker === view.symbol);
          row?.focus?.({ preventScroll: true });
          const content = documentRef.querySelector('.content');
          if (content) content.scrollTop = view.scrollTop;
        };
        if (root?.requestAnimationFrame) {
          const frame = root.requestAnimationFrame(restore);
          bag.add(() => root.cancelAnimationFrame?.(frame));
        } else restore();
      }
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
