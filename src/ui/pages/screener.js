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

function appendFactorCell(documentRef, row, key) {
  const value = row.factorScores?.[key];
  const td = cell(documentRef, value == null ? '—' : value, 'scr-adv-col', 'text-align:right;padding:6px 8px;font-family:var(--font-mono);');
  if (value != null) td.style.color = value >= 66 ? 'var(--data-green)' : value >= 40 ? 'var(--data-amber)' : 'var(--data-red)';
  return td;
}

function createRankCell(documentRef, row) {
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
  return cell(documentRef, wrap, 'scr-adv-col', 'text-align:center;padding:5px 8px;');
}

function createTableRow(documentRef, row, { readLiveData, readWatchlist, onWatchlistToggle, onTicker, onExplain } = {}) {
  const live = liveRow(row, readLiveData);
  const tr = documentRef.createElement('tr');
  tr.className = 'aio-hover-row';
  tr.tabIndex = 0;
  tr.dataset.aioScreenerTicker = row.sym;
  tr.dataset.aioScreenerWhy = row.screenStatus || 'unavailable';
  tr.setAttribute('aria-label', `${row.sym} ${row.screenStatus === 'passed' ? '선정' : row.screenStatus === 'rejected' ? '탈락' : '데이터 부족'} 행`);
  tr.style.cssText = 'border-bottom:1px solid var(--surface-4);cursor:pointer;';
  const stop = (event) => { event.preventDefault(); event.stopPropagation(); };
  tr.addEventListener('click', (event) => {
    if (event.target.closest('[data-aio-screener-watchlist]')) return;
    onExplain?.(row);
    event.stopPropagation();
    onTicker?.(row.sym);
  });
  tr.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onTicker?.(row.sym); }
  });

  const star = documentRef.createElement('button');
  const inWatchlist = (readWatchlist?.() || []).includes(row.sym);
  star.type = 'button';
  star.dataset.aioScreenerWatchlist = row.sym;
  star.className = `scr-star${inWatchlist ? ' active' : ''}`;
  star.textContent = inWatchlist ? '★' : '☆';
  star.title = inWatchlist ? '워치리스트에서 제거' : '워치리스트에 추가';
  star.setAttribute('aria-label', `워치리스트 ${inWatchlist ? '제거' : '추가'} ${row.sym}`);
  star.addEventListener('click', (event) => { stop(event); onWatchlistToggle?.(row.sym); });
  tr.appendChild(cell(documentRef, star, 'scr-adv-col', 'text-align:center;padding:4px 6px;width:28px;'));
  tr.appendChild(createRankCell(documentRef, row));
  const grade = finite(row.rank) == null ? '—' : row.rank >= 80 ? 'A' : row.rank >= 65 ? 'B' : row.rank >= 50 ? 'C' : row.rank >= 35 ? 'D' : 'F';
  tr.appendChild(cell(documentRef, grade, 'scr-adv-col', 'text-align:center;padding:5px 6px;'));
  const identity = documentRef.createElement('div');
  const symbol = documentRef.createElement('div');
  symbol.textContent = row.sym;
  symbol.style.cssText = 'font-weight:800;font-family:var(--font-mono);font-size:12px;';
  const name = documentRef.createElement('div');
  name.textContent = row.name || '이름 미수신';
  name.style.cssText = 'font-size:10px;color:var(--text-muted);';
  identity.append(symbol, name);
  tr.appendChild(cell(documentRef, identity, '', 'padding:6px 8px;'));
  tr.appendChild(cell(documentRef, row.sector, 'scr-adv-col', 'padding:6px 8px;font-size:10px;color:var(--text-secondary);'));
  ['momentum', 'trend', 'lowvol', 'value', 'quality'].forEach((key) => tr.appendChild(appendFactorCell(documentRef, row, key)));
  tr.appendChild(cell(documentRef, numberText(live.price, 2), '', 'text-align:right;padding:6px 8px;font-family:var(--font-mono);font-weight:700;'));
  ['ret1m', 'ret3m', 'ret6m'].forEach((key) => tr.appendChild(cell(documentRef, returnText(row[key]), '', `text-align:right;padding:6px 8px;font-family:var(--font-mono);color:${returnColor(row[key])};`)));
  tr.appendChild(cell(documentRef, numberText(row.rsi, 1), '', 'text-align:right;padding:6px 8px;font-family:var(--font-mono);'));
  tr.appendChild(cell(documentRef, returnText(row.pctSma50), '', `text-align:right;padding:6px 8px;font-family:var(--font-mono);color:${returnColor(row.pctSma50)};`));
  tr.appendChild(appendFactorCell(documentRef, row, 'kalman'));
  const vcp = documentRef.createElement('div');
  vcp.textContent = row.vcpScore == null ? '—' : `${row.vcpScore} · ${row.vcpStage || '관측'}`;
  vcp.style.cssText = `font-size:11px;color:${row.vcpScore == null ? 'var(--text-muted)' : row.vcpScore >= 70 ? 'var(--data-green)' : row.vcpScore >= 50 ? 'var(--data-amber)' : 'var(--data-red)'};`;
  tr.appendChild(cell(documentRef, vcp, '', 'text-align:right;padding:4px 8px;'));
  const mcap = live.mcap == null ? '—' : live.mcap >= 1000 ? `$${(live.mcap / 1000).toFixed(1)}T` : `$${live.mcap}B`;
  tr.appendChild(cell(documentRef, mcap, 'scr-adv-col', 'text-align:right;padding:6px 8px;font-family:var(--font-mono);font-size:10px;'));
  const entry = entryTiming(row);
  const entryNode = documentRef.createElement('span');
  entryNode.className = `scr-entry-chip ${entry[1]}`;
  entryNode.textContent = entry[0];
  if (row.setupProfile?.explanation) {
    entryNode.title = `${row.setupProfile.explanation} 거래량/RVOL: ${row.setupProfile.volumeEvidence === 'unavailable' ? '미수신' : row.setupProfile.volumeEvidence}`;
  }
  if (row.setupProfile) {
    const winnerText = row.setupProfile.winnerFilter === 'candidate' ? '통과'
      : row.setupProfile.winnerFilter === 'unavailable' ? '근거 미수신' : '미확정';
    entryNode.title = `${entryNode.title ? `${entryNode.title} · ` : ''}TradingView 승자 필터: ${winnerText}`;
  }
  tr.appendChild(cell(documentRef, entryNode, 'scr-adv-col', 'text-align:center;padding:4px 8px;border-left:1px solid var(--border);'));
  const signalNode = documentRef.createElement('span');
  signalNode.textContent = signalLabel(row.signal);
  signalNode.style.cssText = `background:${row.signal === 'BUY' ? 'var(--data-green-soft)' : row.signal === 'SELL' ? 'var(--data-red-soft)' : row.signal === 'WATCH' ? 'var(--data-amber-soft)' : 'var(--data-muted-soft)'};color:${signalColor(row.signal)};padding:2px 7px;border-radius:4px;font-size:10px;font-weight:700;`;
  tr.appendChild(cell(documentRef, signalNode, 'scr-adv-col', 'text-align:center;padding:6px 8px;border-left:1px solid var(--border);'));
  const provenance = documentRef.createElement('div');
  provenance.style.cssText = 'display:flex;align-items:center;gap:5px;min-width:0;';
  const memo = documentRef.createElement('span');
  memo.textContent = row.newsMemo ? row.newsMemo.slice(0, 70) : '—';
  memo.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
  const why = documentRef.createElement('button');
  why.type = 'button';
  why.textContent = 'Why';
  why.title = 'WhyRanked / WhyRejected와 필드 provenance 보기';
  why.setAttribute('aria-label', `${row.sym} 순위·탈락 근거 보기`);
  why.style.cssText = 'flex:none;padding:2px 5px;border:1px solid var(--border);border-radius:3px;background:var(--surface-2);color:var(--accent);font-size:9px;cursor:pointer;';
  why.addEventListener('click', (event) => { stop(event); onExplain?.(row); });
  provenance.append(memo, why);
  tr.appendChild(cell(documentRef, provenance, 'scr-adv-col', 'padding:6px 8px;font-size:10px;color:var(--text-secondary);max-width:160px;border-left:1px solid var(--border);'));
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
      track.style.cssText = 'background:rgba(255,255,255,.06);border-radius:2px;height:7px;overflow:hidden;';
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
  if (!backtest?.ic) {
    const message = documentRef.createElement('div');
    message.textContent = metadata?.detail ? `팩터 검증 비활성 — ${metadata.detail}` : '팩터 검증 결과 미수신 — 백테스트 artifact가 없습니다.';
    message.style.cssText = 'font-size:11px;color:var(--data-amber);font-weight:700;';
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

function render({ documentRef, store, readLiveData, readWatchlist, readAliases, sortState, setSortState, visibleLimit, setVisibleLimit, onTicker, onWatchlistToggle, onExplain, rowsOverride = null, workbenchResult = null }) {
  const state = selectScreenerState(store?.getState?.() || {});
  const page = documentRef?.getElementById('page-screener');
  if (!page) return;
  const rows = rowsOverride || state?.rows || [];
  const filtered = sortRows(filterRows(rows, documentRef, { readWatchlist, readAliases }), sortState.column, sortState.ascending, readLiveData);
  const body = documentRef.getElementById('screener-results-body');
  if (body) {
    body.replaceChildren();
    const visible = filtered.slice(0, visibleLimit.value);
    if (!visible.length) {
      const empty = documentRef.createElement('tr');
      empty.appendChild(cell(documentRef, state?.status === 'unavailable' ? '스크리너 산출물 미수신' : '조건에 맞는 종목이 없습니다', '', 'text-align:center;padding:20px;color:var(--text-muted);'));
      empty.firstChild.colSpan = 22;
      body.appendChild(empty);
    } else visible.forEach((row) => body.appendChild(createTableRow(documentRef, row, { readLiveData, readWatchlist, onWatchlistToggle, onTicker, onExplain })));
  }
  const count = documentRef.getElementById('screener-result-count');
  if (count) count.textContent = String(filtered.length);
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
  if (readiness) readiness.textContent = state?.status === 'unavailable' ? '팩터 산출물 미수신 — 현재형 랭킹을 표시하지 않습니다.' : `${allRows.length}개 유니버스 · ${workbenchResult?.run?.passed ?? state.metadata?.ranking?.ranked ?? 0}개 통과 · 상대 순위는 연구용입니다.`;
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
    if (arrow) arrow.textContent = header.dataset.scrSort === sortState.column ? (sortState.ascending ? ' ▲' : ' ▼') : '';
  });
  page.dataset.aioArchitectureRoute = 'screener';
  page.dataset.aioArchitectureSlice = 'screener';
  page.dataset.aioArchitectureRenderer = 'native';
  page.dataset.aioArchitectureStatus = state?.status || 'unavailable';
  if (rankingState.activeFactorRegime && documentRef.getElementById('screener-regime-note')) documentRef.getElementById('screener-regime-note').textContent = rankingState.activeFactorRegime;
}

export function createScreenerPage({ documentRef, store, root = globalThis, onProfileChange, onTicker, onWatchlistToggle, readWatchlist, readAliases, readLiveData } = {}) {
  const sortState = { column: 'mcap', ascending: false };
  const visibleLimit = { value: 12 };
  let mounted = false;
  let renderNow = () => {};
  let activeRows = null;
  let activeResult = null;
  let activeDefinition = null;
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
      const defaultScreens = () => root?.AIO_ARCH?.getDefaultScreenerScreens?.() || [];
      const syncDefinitionEditor = () => {
        if (definitionEditor && activeDefinition) definitionEditor.value = exportSavedScreen({ definition: activeDefinition });
      };
      const explainRow = (row) => {
        if (!whyPreview) return;
        const explanation = row.rankExplanation || {};
        const readiness = row.fieldReadiness?.coverage;
        const missing = explanation.missingEvidence?.length ? `결측: ${explanation.missingEvidence.join(', ')}` : '필수 필드 결측 없음';
        const contrary = explanation.contraryEvidence?.length ? `반대 근거: ${explanation.contraryEvidence.join(', ')}` : '조건 반대 근거 없음';
        const fields = readiness ? `필드 커버리지 ${readiness.coveragePct}%` : '필드 provenance 미수신';
        whyPreview.textContent = `${row.sym || row.symbol} · ${row.screenStatus === 'passed' ? 'WhyRanked' : row.screenStatus === 'rejected' ? 'WhyRejected' : '계산 불가'} · ${missing} · ${contrary} · ${fields}`;
      };
      const runDefinition = (definition) => {
        try {
          const saved = createSavedScreen({ definition });
          activeDefinition = saved.definition;
          const result = root?.AIO_ARCH?.runScreenerDefinition?.(activeDefinition);
          if (result?.rows) {
            activeResult = result;
            activeRows = result.rows;
            visibleLimit.value = 12;
            if (workbenchStatus) workbenchStatus.textContent = `실행 완료 · ${result.run?.passed || 0} 통과 / ${result.run?.unavailable || 0} 데이터 부족 · hash ${result.resultHash}`;
            syncDefinitionEditor();
            renderNow();
          }
        } catch (error) {
          if (workbenchStatus) workbenchStatus.textContent = `정의 차단 · ${error?.message || 'invalid_definition'}`;
        }
      };
      const renderWorkbench = () => {
        const state = selectScreenerState(store.getState()) || {};
        if (activeResult?.run?.snapshotId && state.snapshotId && activeResult.run.snapshotId !== state.snapshotId) {
          activeResult = null;
          activeRows = null;
        }
        if (workbenchPresets) {
          workbenchPresets.replaceChildren();
          defaultScreens().forEach((screen) => {
            const button = documentRef.createElement('button');
            button.type = 'button';
            button.className = 'aio-btn-table';
            button.style.fontSize = '10px';
            button.dataset.aioScreenerAction = 'screen-preset';
            button.dataset.aioScreenerArg = screen.definition.screenId;
            button.textContent = screen.label;
            workbenchPresets.appendChild(button);
          });
        }
        if (!activeDefinition && defaultScreens()[0]?.definition) activeDefinition = defaultScreens()[0].definition;
        syncDefinitionEditor();
        const readiness = activeResult?.readiness || state.readiness;
        if (readinessPreview) readinessPreview.textContent = readiness ? `Readiness · ${readiness.eligibleCount}/${readiness.rowCount} eligible · ${readiness.coveragePct}% · required: ${(readiness.requiredFields || []).join(' · ')}` : '준비도 미리보기 대기';
        if (workbenchStatus && !activeResult) workbenchStatus.textContent = state.lastRun ? `기본 실행 · ${state.lastRun.passed} 통과 · ${state.lastRun.resultHash}` : '실행 대기';
        if (runHistory) runHistory.textContent = state.lastRun ? `Run history · ${state.runHistory?.length || 1}회 · ${state.lastRun.status} · ${state.lastRun.passed}/${state.lastRun.eligibleCount}` : 'Run history · 아직 실행되지 않음';
        if (outcomeLab) outcomeLab.textContent = state.outcomes?.length ? `Outcome lab · ${state.outcomes.length}개 관측 · 비용/벤치마크 상대수익 포함` : 'Outcome lab · T+1/T+5/T+21/T+63 대기';
        if (operationsState) operationsState.textContent = state.refreshPlan ? `Operations · refresh ${state.refreshPlan.queued?.length || 0}건 · quota/circuit 기록` : `Operations · snapshot ${state.snapshotId ? String(state.snapshotId).slice(0, 18) : '미수신'} · rights/readiness fail-closed`;
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
        return (onTicker || ((value) => root?.showTicker?.(value)))?.(symbol);
      };
      renderNow = () => render({ documentRef, store, readLiveData: liveReader, readWatchlist: watchlistReader, readAliases: aliasReader, sortState, visibleLimit, setVisibleLimit: (value) => { visibleLimit.value = value; }, onTicker: tickerHandler, onExplain: explainRow, onWatchlistToggle: (symbol) => { (onWatchlistToggle || root?._aioWLToggle)?.(symbol); rerender(); }, rowsOverride: activeRows, workbenchResult: activeResult, onProfileChange });
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
          if (screen) runDefinition(screen.definition);
        } else if (action === 'screen-run' || action === 'screen-import') {
          try {
            const parsed = JSON.parse(definitionEditor?.value || '');
            const saved = parsed.definition ? importSavedScreen(JSON.stringify(parsed)) : createSavedScreen({ definition: parsed });
            runDefinition(saved.definition);
          } catch (error) {
            if (workbenchStatus) workbenchStatus.textContent = `가져오기 차단 · ${error?.message || 'invalid_json'}`;
          }
        } else if (action === 'screen-export') {
          if (!activeDefinition) activeDefinition = defaultScreens()[0]?.definition || null;
          syncDefinitionEditor();
          if (workbenchStatus) workbenchStatus.textContent = 'credential 없는 ScreenDefinition을 편집기에 내보냈습니다.';
        } else if (action === 'profile') {
          root?._aioSetProfile?.(argument);
          Promise.resolve(onProfileChange?.(argument)).finally(rerender);
        } else if (action === 'toggle-filters') {
          documentRef.getElementById('scr-adv-filter-row')?.classList.toggle('active');
        } else if (action === 'toggle-columns') {
          const table = documentRef.getElementById('screener-results-table');
          const showing = table?.classList.toggle('scr-show-adv');
          const button = documentRef.getElementById('scr-col-toggle-btn');
          if (button) button.textContent = showing ? '핵심 컬럼만 보기' : '전체 컬럼 보기';
        } else if (action === 'tab') {
          ['ranking', 'factors', 'backtest'].forEach((tab) => {
            const panel = documentRef.getElementById(`scr-tab-${tab}`);
            if (panel) panel.style.display = tab === argument ? '' : 'none';
            page.querySelectorAll(`[data-aio-screener-action="tab"][data-aio-screener-arg="${tab}"]`).forEach((button) => {
              button.style.borderBottomColor = tab === argument ? 'var(--accent)' : 'transparent';
              button.style.color = tab === argument ? 'var(--accent)' : 'var(--text-secondary)';
            });
          });
        } else if (action === 'load-more') {
          visibleLimit.value += 12;
          renderNow();
        } else if (action === 'reset-filters') {
          ['scr-min-rank', 'scr-rsi-min', 'scr-rsi-max', 'scr-min-mom'].forEach((id) => { const field = documentRef.getElementById(id); if (field) field.value = id === 'scr-min-rank' ? '0' : ''; });
          const setup = documentRef.getElementById('scr-setup');
          if (setup) setup.value = '';
          const watchlist = documentRef.getElementById('scr-watchlist-only');
          if (watchlist) watchlist.checked = false;
          visibleLimit.value = 12;
          renderNow();
        } else if (action === 'calc-position') calculatePosition(documentRef, liveReader);
        else if (action === 'hide-position') documentRef.getElementById('scr-position-sizer')?.classList.remove('active');
      };
      const handleInput = (event) => {
        if (!event.target.closest?.('#page-screener')) return;
        if (event.target.matches?.('#scr-market, #scr-sector, #scr-signal, #scr-cap, #scr-setup, #scr-min-rank, #scr-rsi-min, #scr-rsi-max, #scr-min-mom, #scr-text-search, #scr-watchlist-only')) {
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
