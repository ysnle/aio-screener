// Screener results table: cells, rows, header, status line and the render pass.
import { compileScreenDefinition } from '../../../domain/screener/screen-engine.js';
import { syncScreenerNextLead } from '../../components/screener-read.js';
import { selectScreenerState } from '../../../state/selectors/screener.js';
import { SCREENER_FIELD_REGISTRY, fieldValueForPurpose } from '../../../data/contracts/screener.js';
import { FACTOR_LABELS, capFilterValue, numberText, visibleRank, rankGrade, vcpStageLabel, factorSessionLag, describeRankingHold, followThroughSummary } from '../../../domain/screener/row-presentation.js';
import { MARKET_LABELS, screenerMarket, marketRankingMetadata, formatScreenerPrice } from '../../../domain/screener/market-scope.js';
import { EXTENSION_BANDS } from '../../../domain/screener/setup-profile.js';
import { consensusView, PE_MEANINGFUL_MAX } from '../../../domain/fundamental/consensus-read.js';
import { parseConditionValue, conditionCoverage, availableConditionIds } from '../../../domain/screener/custom-conditions.js';
import { requestConsensusEstimates, consensusRowFor, CONSENSUS_KEY } from '../../../data/consensus-estimates.js';
import { screenerRowsState } from '../../../data/shared-artifacts.js';
import { dataStateText } from '../../../domain/content/data-state.js';
import { RANKING_CONTRACTS } from '../../../data/screener-extended.js';
import { usdKoreanText, finiteNumber as finite } from '../../../domain/shared/number.js';
import { isoDay, stampDay } from '../../../domain/shared/session-date.js';
import { shortDate } from '../../../domain/content/date-labels.js';
import { renderDataState } from '../../components/data-state.js';
import { FILTER_FIELD_LABELS, describeFilterAst, filterRows, renderFilterChips, renderFunnel, syncScreenerControlAvailability, syncUniverseScopeControl } from './filters.js';
import { CASH_CONDITION_IDS, COLUMN_PRESETS, FIELD_BY_COLUMN, FILING_KEYS, PRESET_SHORT_LABELS, SCREENER_COLUMN_REGISTRY, SECTOR_RELATIVE_PRICE_FACTORS, cell, customRead, entryTiming, extensionMultiple, factorScoreColor, liveRow, marketReturnPercentiles, pivotDistancePct, range52Position, requestCashMetrics, returnColor, returnText, rowThemeStages, scopedRows, screenerRuntime, selectedValue, sortRows, text } from './model.js';
import { renderBacktest, renderConditionalEvidence, renderFactorTab, renderStaleNote, renderValidationState } from './validation-tab.js';
function createRankNode(documentRef, row, hold = null) {
  const wrap = documentRef.createElement('div');
  // P1452: when the current epoch's re-rank is held, the previous run's relative score and
  // rank must not stay on the table as if they answered the new selection — the row cell
  // says 순위 보류 with the reason, matching the banner on the same screen.
  if (hold) {
    const rankCellHold = documentRef.createElement('span');
    rankCellHold.textContent = '순위 보류';
    rankCellHold.className = 'scr-rank-hold';
    rankCellHold.title = `지금 선택에 대한 순위 계산이 보류 중입니다(${hold.reason || '사유 미확인'}). 남아 있던 숫자는 이전 계산의 결과라 표시하지 않습니다.`;
    wrap.appendChild(rankCellHold);
    return wrap;
  }
  if (row.screenStatus === 'unavailable' || row.screenStatus === 'rejected') {
    wrap.textContent = row.screenStatus === 'rejected' ? '조건 미충족' : '근거 부족';
    wrap.title = '필수 데이터가 모두 준비되기 전에는 순위를 표시하지 않습니다.';
    wrap.className = 'scr-rank-unranked';
    return wrap;
  }
  const rank = visibleRank(row);
  if (rank == null) {
    wrap.appendChild(text(documentRef, '—'));
    // 2026-10-16: a fund, a SPAC or a thinly traded 확장 name is shown but not compared with operating companies.
    const excluded = { fund: 'ETF·펀드는 기업 주식과 같은 기준으로 비교하지 않아 순위에서 뺐습니다.', spac: '기업인수목적회사(SPAC)는 신탁 현금이라 주가가 거의 움직이지 않아 순위에서 뺐습니다.', illiquid: '하루 평균 거래대금이 100만 달러 미만이라 확장 순위에서 뺐습니다.', foreign: '도쿄·대만 상장 종목은 거래일과 통화가 달라 미국 종목과 같은 순위로 비교하지 않습니다.' }[row.populationExclusion];
    if (excluded) wrap.title = excluded;
  } else {
    const value = documentRef.createElement('div');
    value.textContent = String(rank);
    // v57.81: the percentile names its population — the core universe, or core + Russell 2000·Nasdaq (확장).
    const contract = RANKING_CONTRACTS[row.rankingUniverse === 'extended' ? 'extended' : 'core'];
    wrap.dataset.rankingContract = contract.id;
    wrap.title = `${MARKET_LABELS[screenerMarket(row)]} 시장의 계산 가능한 종목 중 백분위 ${rank}, ${contract.label} — 만점이나 상승 확률이 아닙니다. 조건을 선택해도 팩터 백분위의 모집단은 바뀌지 않습니다.`;
    // v57.54: a descriptive position, not a verdict — one neutral colour, no green/red judgement.
    value.className = 'scr-rank-value';
    const bar = documentRef.createElement('div');
    bar.className = 'scr-rank-bar';
    const fill = documentRef.createElement('div');
    fill.className = 'scr-rank-fill';
    fill.style.width = `${Math.max(0, Math.min(100, rank))}%`;
    bar.appendChild(fill);
    wrap.append(value, bar);
  }
  return wrap;
}

export function createColumnContent(documentRef, row, key, { readLiveData, readWatchlist, onWatchlistToggle, onExplain, onCompare, compareSymbols, rankHold, capOrder } = {}) {
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
    star.title = inWatchlist ? '관심 종목에서 빼기' : '관심 종목에 추가'; // one name with the 포트폴리오 list (run 4 breaker #19)
    star.setAttribute('aria-label', `워치리스트 ${inWatchlist ? '제거' : '추가'} ${row.sym}`);
    star.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); onWatchlistToggle?.(row.sym); });
    wrap.append(star);
    return wrap;
  }
  if (key === 'capOrder') {
    const order = capOrder?.get(row.sym || row.symbol) ?? null;
    const node = text(documentRef, order == null ? '—' : String(order));
    node.className = 'scr-ordinal scr-cap-order';
    if (order == null) node.title = '시가총액 자료가 없어 시총 순서에서 빠졌습니다(표 맨 아래).'; // only under the 시총 sort
    return node;
  }
  if (key === 'rank') return createRankNode(documentRef, row, rankHold);
  if (key === 'screenRank') {
    const ordinal = rankHold || row.screenStatus !== 'passed' ? null : finite(row.screenRank);
    const node = text(documentRef, ordinal == null ? '—' : String(ordinal));
    node.className = 'scr-ordinal';
    return node;
  }
  if (key === 'range52') {
    const position = range52Position(row);
    if (position == null) return '—';
    const wrap = documentRef.createElement('span');
    wrap.className = 'scr-range52';
    wrap.title = `52주 저점 대비 ${returnText(row.pctFrom52wLow)}, 고점 대비 ${returnText(row.pctFrom52wHigh)} — 저점과 고점 사이 ${Math.round(position * 100)}% 지점`;
    wrap.setAttribute('role', 'img');
    wrap.setAttribute('aria-label', `52주 범위의 ${Math.round(position * 100)}% 지점`);
    const dot = documentRef.createElement('span');
    dot.className = 'scr-range52-dot';
    dot.style.left = `${(position * 100).toFixed(1)}%`;
    wrap.append(dot);
    return wrap;
  }
  if (key === 'grade') return rankGrade(visibleRank(row)) || '—';
  if (key === 'sym') {
    const identity = documentRef.createElement('div');
    const symbol = documentRef.createElement('div');
    symbol.textContent = row.sym || row.symbol || '—';
    symbol.className = 'scr-sym-code';
    const name = documentRef.createElement('div');
    name.textContent = row.name || '이름 미수신';
    name.className = 'scr-sym-name';
    identity.append(symbol, name);
    return identity;
  }
  if (key === 'sector') {
    if (row.sectorSource !== 'sec-sic' || !row.sector) return row.sector;
    // 2026-10-17: a sector translated from the SEC SIC code (no curated sector) says so beside the value.
    const cell = documentRef.createElement('span');
    const tag = documentRef.createElement('small');
    tag.textContent = ' SIC';
    tag.className = 'scr-sic-tag';
    cell.append(documentRef.createTextNode(row.sector), tag);
    cell.title = `SEC 산업분류${row.sic ? `(SIC ${row.sic})` : ''}에서 옮긴 섹터`;
    return cell;
  }
  if (['momentum', 'trend', 'lowvol', 'value', 'quality', 'kalman'].includes(key)) {
    if (row.screenStatus === 'unavailable') return '—';
    const value = row.factorScores?.[key];
    const node = documentRef.createElement('span');
    node.textContent = value == null ? '—' : Number(value).toFixed(0);
    node.style.color = factorScoreColor(key, value, row);
    if (SECTOR_RELATIVE_PRICE_FACTORS.has(key)) node.title = '같은 섹터 안에서 비교한 값 — 섹터 전체가 내릴 때도 높게 나올 수 있어, 50·200일선과 최근 5거래일 확인을 통과할 때만 초록으로 표시';
    return node;
  }
  if (key === 'price') {
    const price = finite(live.price);
    if (price == null) {
      // P1499: raw prices are not republished (P715); an uncovered row shows a quiet dash, not a word on every line.
      const missing = text(documentRef, '—');
      missing.style.color = 'var(--text-muted)';
      missing.title = '실시간 시세가 연결되지 않은 종목 — 공개 데이터에는 종목별 가격을 싣지 않습니다.';
      return missing;
    }
    const currency = String(row.instrumentRef?.currency || row.currency || '').trim().toUpperCase() || null;
    if (row.priceCloseDate !== undefined && row.priceObservedAt == null) {
      const cell = documentRef.createElement('span');
      const date = String(row.priceCloseDate || '');
      const md = isoDay(date) ? shortDate(date) : '';
      cell.appendChild(text(documentRef, formatScreenerPrice(price, currency)));
      const note = documentRef.createElement('small');
      note.textContent = md ? `${md} 종가` : '종가';
      note.className = 'scr-close-note';
      note.dataset.closeDay = md;
      cell.appendChild(note);
      cell.title = `${currency || '통화 미확인'}, ${md ? `${md} ` : ''}확정 종가(수정 종가), 실시간 시세가 아닙니다`;
      return cell;
    }
    const observedAt = row.priceObservedAt || row.priceObserved || null;
    const source = row.priceSource || null;
    const stamp = observedAt ? `관측 ${String(observedAt).slice(0, 16).replace('T', ' ')}` : '관측 시각 미확인';
    // LC-42: an overlay quote with no observation time is not a confirmed 현재가. Bind currency/
    // observedAt/source/freshness to the row itself and do not inherit the global LIVE badge,
    // which counts topbar coverage rather than this instrument's quote.
    const wrap = documentRef.createElement('span');
    // P1599 (F06): won prices have no minor unit — show them as whole numbers with the ₩ sign instead of '161500.00 KRW'.
    const value = text(documentRef, formatScreenerPrice(price, currency));
    value.dataset.quoteFreshness = observedAt ? 'observed' : 'unverified';
    value.title = `${currency || '통화 미확인'}, ${stamp}, ${source || '출처 미확인'}, ${observedAt ? '행 자체 관측' : '현재성 미확인 — 전역 LIVE에 상속하지 않음'}`;
    if (!observedAt) value.style.color = 'var(--text-muted)';
    wrap.appendChild(value);
    if (!observedAt) {
      const note = documentRef.createElement('small');
      note.textContent = '관측시각 미확인, 참고';
      note.className = 'scr-cell-note';
      wrap.appendChild(note);
    }
    return wrap;
  }
  // UI review 2026-10-18: returns read at a glance in the app's rise/fall colours (returnColor was defined but unused);
  // 52주 고점 대비 is never positive, so it stays in the text colour rather than a column of red.
  if (['ret1m', 'ret3m', 'ret6m', 'pctSma50'].includes(key)) {
    const node = documentRef.createElement('span');
    node.textContent = returnText(row[key]);
    node.style.color = finite(row[key]) == null ? 'var(--text-muted)' : returnColor(row[key]);
    return node;
  }
  if (key === 'rsi') return numberText(row.rsi, 1);
  if (key === 'extension') {
    const multiple = extensionMultiple(row);
    const node = documentRef.createElement('span');
    node.textContent = multiple == null ? '—' : `${multiple.toFixed(1)}배`;
    node.title = multiple == null ? '50일선 거리 또는 일평균 변동폭 자료 없음' : `50일선 대비 ${Number(row.pctSma50).toFixed(1)}% ÷ 일평균 변동폭 ${Number(row.adrPct).toFixed(1)}% — ${EXTENSION_BANDS.nearBase}배 이하는 기준선 가까이, ${EXTENSION_BANDS.extended}배 이상은 확장, ${EXTENSION_BANDS.stretched}배 이상은 크게 확장된 구간(참고 구간)`;
    node.style.color = multiple == null ? 'var(--text-muted)' : multiple >= EXTENSION_BANDS.stretched ? 'var(--data-red)' : multiple >= EXTENSION_BANDS.extended ? 'var(--data-amber)' : 'var(--text-primary)';
    return node;
  }
  if (key === 'pctFrom52wHigh') return returnText(row.pctFrom52wHigh);
  // v58.75 (persona review): trader and fundamental fact columns. Each cell says what it was computed from on hover.
  if (key === 'ret5d') {
    const node = text(documentRef, returnText(row.ret5d));
    node.style.color = returnColor(row.ret5d);
    return node;
  }
  if (key === 'rvol20') {
    const value = finite(row.rvol20);
    const node = text(documentRef, value == null ? '—' : `${value.toFixed(2)}배`);
    node.title = value == null ? '거래량 자료 없음' : `마지막 거래일 거래량이 직전 20거래일 평균의 ${value.toFixed(2)}배${row.factorSessionDate ? ` (${row.factorSessionDate} 종가 기준)` : ''}`;
    if (value == null) node.style.color = 'var(--text-muted)';
    return node;
  }
  if (key === 'adrPct') {
    const value = finite(row.adrPct);
    const node = text(documentRef, value == null ? '—' : `${value.toFixed(1)}%`);
    if (value == null) node.style.color = 'var(--text-muted)';
    return node;
  }
  if (key === 'dollarVolume30d') {
    const usd = finite(row.dollarVolume30d);
    const native = usd == null ? finite(row.tradedValue30d) : null;
    const nativeCurrency = String(row.tradedValueCurrency || '').toUpperCase();
    const label = usd != null ? usdKoreanText(usd)
      : native != null && nativeCurrency === 'KRW' ? `${Math.round(native / 1e8).toLocaleString('ko-KR')}억원` : '—';
    const node = text(documentRef, label);
    if (label === '—') node.style.color = 'var(--text-muted)';
    return node;
  }
  if (key === 'pivotDist') {
    const pct = pivotDistancePct(row);
    const node = text(documentRef, pct == null ? '—' : returnText(pct));
    node.title = pct == null ? '피벗이 계산되지 않았거나 종가 자료가 없는 종목' : `마지막 확정 종가가 피벗(마지막 수축 구간의 고점)보다 ${Math.abs(pct).toFixed(1)}% ${pct >= 0 ? '위' : '아래'}${row.vcpStage ? `, 구조: ${vcpStageLabel(row.vcpStage)}` : ''} — 관찰 위치이며 매수 지점이 아닙니다`;
    node.style.color = pct == null ? 'var(--text-muted)' : 'var(--text-primary)';
    return node;
  }
  if (key === 'rs6m' || key === 'rs12m') {
    const entry = screenerRuntime.currentRsPercentiles.get(row.sym || row.symbol);
    const pct = finite(entry?.[key]);
    const node = text(documentRef, pct == null ? '—' : String(pct));
    const months = key === 'rs6m' ? 6 : 12;
    const ret = finite(row[key === 'rs6m' ? 'ret6m' : 'ret12m']);
    node.title = pct == null ? `${months}개월 수익률이 없거나 순위 비교 대상이 아닌 종목` : `${months}개월 수익률 ${returnText(ret)} — 같은 시장 ${entry[`${key}Count`]}종목 중 백분위 ${pct}`;
    if (pct == null) node.style.color = 'var(--text-muted)';
    return node;
  }
  if (FILING_KEYS.has(key)) {
    const value = finite(row[key]);
    const multiple = key === 'pe' || key === 'pb';
    const label = value == null ? '—' : key === 'pe' && value > PE_MEANINGFUL_MAX ? `${PE_MEANINGFUL_MAX}배 초과` : multiple ? `${numberText(value, 1)}배` : key === 'revGrowth' ? returnText(value) : numberText(value, 1, '%');
    const node = text(documentRef, label);
    const period = row._fundamentalPeriodEnd || null;
    const filed = row._fundamentalFiledAt ? String(row._fundamentalFiledAt).slice(0, 10) : null;
    const earnings = key === 'pe' && row._valuationPeEarningsThrough ? `, 이익 ${row._valuationPeEarningsBasis === 'ttm' ? '최근 4개 분기 합' : '최근 회계연도'}(${row._valuationPeEarningsThrough}까지)` : '';
    node.title = value == null ? '공시 자료가 없거나 비정상 값이라 비움' : `${period ? `회계기간 종료 ${period}` : '회계기간 미확인'}${filed ? `, 공시 ${filed}` : ''}${earnings}`;
    if (value == null) node.style.color = 'var(--text-muted)';
    return node;
  }
  if (key === 'themeStage') {
    const stages = rowThemeStages(row);
    if (!stages?.length) {
      const node = text(documentRef, '—');
      node.style.color = 'var(--text-muted)';
      node.title = stages == null ? '테마 상태 자료가 최신이 아니라 표시하지 않습니다' : '추적하는 테마에 들어 있지 않은 종목';
      return node;
    }
    const node = text(documentRef, `${stages[0].label}, ${stages[0].stateLabel}${stages.length > 1 ? ` 외 ${stages.length - 1}` : ''}`);
    node.title = stages.map((stage) => `${stage.label}: ${stage.stateLabel}`).join('\n');
    return node;
  }
  if (key === 'vcpScore') {
    const node = documentRef.createElement('span');
    // Codex browser audit H46: a green/red 0–100 number read as a validated buy score. The structure stage comes
    // first; the number is labelled as how many contraction rules are met, in a neutral colour.
    node.textContent = row.vcpScore == null ? '—' : `${vcpStageLabel(row.vcpStage)}, 충족도 ${row.vcpScore}`;
    node.title = '변동성 수축(VCP) 규칙 — 수축 횟수, 수축 깊이 감소, 거래량 감소 — 을 얼마나 충족하는지 0~100으로 합친 값입니다. 과거 성과로 검증된 매수 점수가 아닙니다.';
    node.style.color = row.vcpScore == null ? 'var(--text-muted)' : 'var(--text-secondary)';
    return node;
  }
  if (key === 'fwdPe') {
    const view = consensusView(row, consensusRowFor(screenerRuntime.consensusRoot, row.sym || row.symbol));
    // v57.55 review (E1-01): the estimates arrive in batches (214/904 on the first runs), so a missing value before full
    // coverage is "not collected yet", not "no estimate".
    const coverage = screenerRuntime.consensusRoot?._aioConsensusEstimates?.coverage;
    const partial = !view && /^[A-Z.-]+$/.test(String(row.sym || '')) && finite(coverage?.covered) != null && coverage.covered < coverage.universeUs;
    const node = text(documentRef, view?.fwdPe != null ? (view.fwdPe > PE_MEANINGFUL_MAX ? `${PE_MEANINGFUL_MAX}배 초과` : `${numberText(view.fwdPe, 1)}배`) : view ? '적자 예상' : partial ? '수집 전' : '—');
    if (partial) node.title = `컨센서스는 실행마다 일부 종목씩 수집합니다(지금 ${coverage.covered}/${coverage.universeUs}종목). 다음 수집 차례에 채워집니다.`;
    else node.title = view ? `종가 ${view.price}${view.priceDate ? ` (${view.priceDate})` : ''} ÷ 아직 실적이 발표되지 않은 4개 분기(${view.fwdFrom}~${view.fwdTo}) 컨센서스 EPS 합 ${view.fwdEps}, 애널리스트 최소 ${view.minEstimates ?? '?'}명, ${view.asOf} 수집 — 참고값` : '컨센서스 자료 없음(미국 종목만, 애널리스트 추정이 있는 경우)';
    if (!view) node.style.color = 'var(--text-muted)';
    return node;
  }
  if (key === 'mcap') {
    if (live.mcap != null) return usdKoreanText(live.mcap * 1e9);
    const native = row.nativeMarketCap;
    const reference = row.referenceMarketCap;
    if ((finite(native?.value) == null || ['BLOCKED', 'DENIED'].includes(native.rightsId)) && finite(reference?.billions) != null) {
      const node = text(documentRef, `${usdKoreanText(reference.billions * 1e9)}, 참고`);
      node.title = `참고 시총 = SEC 발행주식수(${reference.sharesObservedAt || '기준일 미상'}) × 산출물 종가 — 크기 구간 필터에만 쓰고 팩터·판단에는 쓰지 않음 (P1318)`;
      return node;
    }
    if (finite(native?.value) == null || ['BLOCKED', 'DENIED'].includes(native.rightsId)) return '—';
    const billions = native.value / 1e9;
    const amount = billions >= 1000 ? `${numberText(billions / 1000, 1)}T` : `${numberText(billions, 2)}B`;
    const node = text(documentRef, `${native.currency} ${amount}, 참고`);
    node.title = `${native.source || '출처 미확인'}, 관측 ${native.observedAt || '시각 미확인'}, USD 환산값이 없어 USD 시총 필터/팩터에는 사용하지 않음`;
    return node;
  }
  if (key === 'followThrough') {
    const summary = followThroughSummary(row);
    const node = documentRef.createElement('span');
    node.className = 'scr-follow-through';
    node.textContent = summary.text;
    if (summary.title) node.title = summary.title;
    if (summary.climax) node.style.color = 'var(--data-red)';
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
  if (key === 'news') {
    const provenance = documentRef.createElement('div');
    provenance.className = 'scr-evidence-cell';
    const memo = documentRef.createElement('span');
    // N21: an empty cell says why — waiting for its rotation turn, fetch failed, no headline that names the
    // company, or not collected for this market. Sources stay in the hover only.
    const newsEmpty = { 'rotation-pending': '순환 대기', 'fetch-failed': '수신 실패', 'no-verified-article': '확인된 기사 없음', 'not-covered': '수집 대상 아님' };
    // v57.55 review (E1-10): an empty memo is a quiet dash (its reason in the hover), not a word repeated down the column.
    memo.textContent = row.newsMemo ? row.newsMemo.slice(0, 70) : '—';
    if (!row.newsMemo) memo.style.color = 'var(--text-muted)';
    const newsSources = Array.isArray(row.newsMemoSources) ? row.newsMemoSources.filter(Boolean) : [];
    if (row.newsMemo) memo.title = `${row.newsMemo}${newsSources.length ? `\n출처: ${newsSources.join(', ')}` : ''}`;
    else if (row.newsStatus === 'rotation-pending') memo.title = '종목 뉴스는 실행마다 일부 종목씩 돌아가며 수집합니다. 다음 차례에 갱신됩니다.';
    else memo.title = newsEmpty[row.newsStatus] || '근거 미수신';
    const why = documentRef.createElement('button');
    why.type = 'button';
    why.textContent = '근거';
    why.className = 'scr-why-btn';
    why.title = '이 순위가 나온 이유와 각 값의 출처 보기';
    why.setAttribute('aria-label', `${row.sym} 순위·탈락 근거 보기`);
    why.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); onExplain?.(row); });
    provenance.append(memo, why);
    return provenance;
  }
  return row[key] ?? '—';
}

const MONO_COLUMNS = new Set(['price', 'pctFrom52wHigh', 'rank', 'momentum', 'trend', 'lowvol', 'value', 'quality', 'ret1m', 'ret3m', 'ret6m', 'rsi', 'pctSma50', 'kalman', 'vcpScore', 'mcap', 'fwdPe',
  'ret5d', 'rs6m', 'rs12m', 'rvol20', 'adrPct', 'dollarVolume30d', 'pivotDist', 'pe', 'pb', 'roe', 'margin', 'revGrowth']); // v58.75: the new fact columns
function createTableRow(documentRef, row, { readLiveData, readWatchlist, onWatchlistToggle, onExplain, onCompare, selectedSymbols, compareSymbols, visibleColumns, rankHold, capOrder } = {}) {
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
    td.dataset.label = column.label; // v57.79: the phone card row (<600px) names each value without the header row
    td.className = `scr-column-cell scr-column-${column.key}${column.sticky ? ' scr-column-sticky' : ''}`;
    td.style.textAlign = column.align;
    td.style.minWidth = `${column.width}px`;
    if (column.sticky) td.style.left = `${stickyLeft}px`;
    if (MONO_COLUMNS.has(column.key)) {
      td.style.fontFamily = 'var(--font-mono)';
      td.style.fontVariantNumeric = 'tabular-nums';
    }
    const content = createColumnContent(documentRef, row, column.key, { readLiveData, readWatchlist, onWatchlistToggle, onExplain, onCompare, compareSymbols, rankHold, capOrder });
    td.appendChild(content && content.nodeType ? content : text(documentRef, content));
    const fieldId = FIELD_BY_COLUMN.get(column.key);
    const field = fieldId && row.fieldReadiness?.fields?.[fieldId];
    if (field) {
      td.dataset.fieldStatus = field.status;
      // P1599 (F06): reader words for the field state; the raw code stays in data-field-status for tools.
      const STATUS_WORDS = { CURRENT: '최신', INFERRED: '다른 값에서 계산', UNSUPPORTED: '이 종목에는 없는 항목', BLOCKED_RIGHTS: '사용 권리 확인 전', DELAYED: '지연된 종가 기준', STALE: '오래된 값', LAST_GOOD: '마지막 정상값', MISSING: '관측 시각 미확인', CONFLICT: '출처 간 값이 다름', UNAVAILABLE: '값 없음' };
      td.title = `${field.sourceId || '출처 미확인'}, 관측 ${field.observedAt ? String(field.observedAt).slice(0, 10) : '시각 미확인'}, ${STATUS_WORDS[field.status] || field.status}`;
      if (field.status === 'CONFLICT' && fieldValueForPurpose(row, fieldId) != null) {
        const note = documentRef.createElement('small');
        note.textContent = '값 충돌, 참고';
        note.className = 'scr-cell-note';
        td.appendChild(note);
      } else if (['STALE', 'LAST_GOOD'].includes(field.status) && fieldValueForPurpose(row, fieldId) != null) {
        // P1319/N12: every stale cell used to repeat "YYYY-MM-DD · 참고", burying the numbers.
        // The cell is muted and marked; one table-level note states the date(s) once (renderStaleNote).
        td.dataset.staleAsOf = field.observedAt ? String(field.observedAt).slice(0, 10) : '시각 미확인';
        td.style.color = 'var(--text-muted)';
      }
    }
    tr.appendChild(td);
    if (column.sticky) stickyLeft += column.width;
  });
  return tr;
}
export function getVisibleColumns(columnPreset, customColumns = []) {
  const keys = columnPreset === 'custom' ? customColumns : (COLUMN_PRESETS[columnPreset] || COLUMN_PRESETS.discovery);
  const byKey = new Map(SCREENER_COLUMN_REGISTRY.map((column) => [column.key, column]));
  return keys.map((key) => byKey.get(key)).filter(Boolean);
}

// UI review 2026-10-18: every row repeated "10/16 종가" under its price. The day most rows share moves to the 가격 header
// (and the phone card label); a row whose close is from another day keeps its own note, so a stale price still shows its date.
function shareCloseDay(documentRef, table, body) {
  const notes = [...body.querySelectorAll('.scr-close-note')];
  const counts = new Map();
  notes.forEach((note) => { if (note.dataset.closeDay) counts.set(note.dataset.closeDay, (counts.get(note.dataset.closeDay) || 0) + 1); });
  const common = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';
  notes.forEach((note) => { note.hidden = !!common && note.dataset.closeDay === common; });
  body.querySelectorAll('td[data-column-key="price"]').forEach((td) => { td.dataset.label = common ? `가격, ${common} 종가` : '가격'; });
  const header = table?.querySelector('th[data-column-key="price"]');
  if (!header) return;
  let tag = header.querySelector('.scr-head-note');
  if (!common) { tag?.remove(); return; }
  if (!tag) {
    tag = documentRef.createElement('small');
    tag.className = 'scr-head-note';
    header.querySelector('.scr-sort-btn')?.after(tag);
  }
  tag.textContent = `${common} 종가`;
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
    th.style.textAlign = column.align;
    th.style.minWidth = `${column.width}px`;
    // v57.54: jargon columns carry a one-line explanation on hover.
    if (column.hint) th.title = column.hint;
    const fwdCoverage = column.key === 'fwdPe' ? screenerRuntime.consensusRoot?._aioConsensusEstimates?.coverage : null; // v57.55 E1-01
    if (fwdCoverage?.universeUs) th.title = `${th.title}, 수집 ${fwdCoverage.covered}/${fwdCoverage.universeUs}종목`;
    // v57.61 WCAG 1.3.1: hover-only hints are also exposed to keyboard and screen-reader users via aria-describedby.
    let hintId = '';
    if (th.title) {
      hintId = `scr-col-hint-${column.key}`;
      const hint = documentRef.createElement('span');
      hint.id = hintId;
      // hidden: not part of the header's own name (cells stay short), still read as the description it is pointed at.
      hint.hidden = true;
      hint.textContent = th.title;
      th.appendChild(hint);
    }
    if (column.sticky) th.style.left = `${stickyLeft}px`;
    if (column.sortable) {
      const button = documentRef.createElement('button');
      button.type = 'button';
      // v58.56: a column can sort by another key (시총 순서 → mcap) and show a short header ('#') while its name stays whole.
      const sortKeyName = column.sortAs || column.key;
      button.dataset.scrSort = sortKeyName;
      button.className = 'scr-sort-btn';
      button.textContent = column.headerLabel || column.label;
      button.dataset.sortLabel = column.label;
      const arrow = documentRef.createElement('span');
      arrow.className = 'scr-arrow';
      arrow.setAttribute('aria-hidden', 'true');
      button.appendChild(arrow);
      const active = sortState.column === sortKeyName;
      button.setAttribute('aria-label', active ? `${column.label} 정렬 ${sortState.ascending ? '오름차순' : '내림차순'}` : `${column.label}로 정렬`);
      if (hintId) button.setAttribute('aria-describedby', hintId);
      th.setAttribute('aria-sort', active ? (sortState.ascending ? 'ascending' : 'descending') : 'none');
      th.prepend(button);
    } else {
      th.prepend(column.label);
      if (hintId) th.setAttribute('aria-describedby', hintId);
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
// Filter and sort results are reused while their inputs stay the same: the same row array, the same control values and
// sort order. A text search (it also reads the name registries) and a Forward PER condition or column (estimates load
// later) are not tracked here, so those always recompute; price and 시총 sorts read live quotes and do too.
const FILTER_CONTROL_IDS = ['scr-listing-market', 'scr-market', 'scr-sector', 'scr-cap', 'scr-text-search', 'scr-min-rank', 'scr-rsi-min', 'scr-rsi-max', 'scr-min-mom', 'scr-setup', 'scr-custom-conditions'];
const LIVE_SORT_COLUMNS = new Set(['price', 'mcap', 'fwdPe']);
let filterCache = null;
let sortCache = null;
function filterAndSortRows(rows, documentRef, { readWatchlist, readAliases, sortState, readLiveData }) {
  const values = FILTER_CONTROL_IDS.map((id) => selectedValue(documentRef, id));
  const watchlistOnly = !!documentRef.getElementById('scr-watchlist-only')?.checked;
  const passedOnly = !!documentRef.getElementById('scr-passed-only')?.checked;
  const trackedFilter = !values[4].trim() && !parseConditionValue(values[10]).some((item) => item.id === 'fwdpe-max');
  const filterKey = [...values, watchlistOnly, passedOnly, watchlistOnly ? (readWatchlist?.() || []).join(',') : ''].join('\u0001');
  let filtered;
  if (trackedFilter && filterCache?.rows === rows && filterCache.key === filterKey) filtered = filterCache.result;
  else {
    filtered = filterRows(rows, documentRef, { readWatchlist, readAliases });
    filterCache = trackedFilter ? { rows, key: filterKey, result: filtered } : null;
  }
  const { column, ascending } = sortState;
  if (!LIVE_SORT_COLUMNS.has(column) && sortCache?.filtered === filtered && sortCache.column === column && sortCache.ascending === ascending) return sortCache.result;
  const sorted = sortRows(filtered, column, ascending, readLiveData);
  sortCache = LIVE_SORT_COLUMNS.has(column) ? null : { filtered, column, ascending, result: sorted };
  return sorted;
}

// A table row keeps its node while everything it shows is unchanged: the same row object, columns, selection, compare
// and watchlist marks, rank hold, live quote fields and (with the Forward PER column) estimate. A re-render that changes
// nothing then leaves the table alone, so focus, hover and a click in flight are not lost to a rebuilt row.
const tableRowCache = new WeakMap();
function tableRowInputs(row, { readLiveData, readWatchlist, selectedSymbols, compareSymbols, visibleColumns, rankHold, capOrder }, columnsKey) {
  const symbol = row.sym || row.symbol;
  const live = readLiveData?.()?.[row.sym] || {};
  const inputs = [row, columnsKey, !!selectedSymbols?.has(symbol), !!compareSymbols?.has(row.sym), (readWatchlist?.() || []).includes(row.sym), rankHold ? `hold:${rankHold.reason}` : '',
    live.currency, live.marketCapCurrency, live.price, live.marketCap, live.observedAt, live.ts, live.source, live.revision, capOrder?.get(symbol) ?? null];
  if (visibleColumns.some((column) => column.key === 'fwdPe')) {
    const estimates = screenerRuntime.consensusRoot?.[CONSENSUS_KEY];
    inputs.push(estimates, consensusRowFor(screenerRuntime.consensusRoot, symbol), estimates?.coverage?.covered, estimates?.coverage?.universeUs);
  }
  // v58.75: the RS percentiles come from the whole dataset and the theme stages from the scenario state, not the row.
  if (visibleColumns.some((column) => column.key === 'rs6m' || column.key === 'rs12m')) inputs.push(screenerRuntime.currentRsPercentiles.get(symbol));
  if (visibleColumns.some((column) => column.key === 'themeStage')) inputs.push(screenerRuntime.themeStageRoot?._aioScenarioState, screenerRuntime.themeStageRows);
  return inputs;
}
function tableRowNodes(documentRef, body, rows, options) {
  const columnsKey = options.visibleColumns.map((column) => `${column.key}:${column.label}:${column.align}:${column.width}:${column.sticky ? 1 : 0}`).join('|');
  let cache = tableRowCache.get(body);
  // A new mount brings new handlers; rows built with the old ones are not reused.
  if (!cache || cache.owner !== options.onExplain) cache = { owner: options.onExplain, bySymbol: new Map() };
  const next = new Map();
  const nodes = rows.map((row) => {
    const inputs = tableRowInputs(row, options, columnsKey);
    const key = row.sym || row.symbol || '';
    const kept = cache.bySymbol.get(key);
    const node = kept && !next.has(key) && kept.inputs.length === inputs.length && kept.inputs.every((value, index) => Object.is(value, inputs[index]))
      ? kept.node
      : createTableRow(documentRef, row, options);
    if (!next.has(key)) next.set(key, { node, inputs });
    return node;
  });
  tableRowCache.set(body, { owner: cache.owner, bySymbol: next });
  return nodes;
}

// v58.56 (#3): the market-cap order of the rows the table holds (1 = largest). Rows without a cap get no number.
function capOrderMap(rows, readLiveData) {
  const order = new Map();
  rows.map((row) => ({ symbol: row.sym || row.symbol, cap: capFilterValue(liveRow(row, readLiveData)) }))
    .filter((entry) => entry.symbol && entry.cap != null)
    .sort((left, right) => right.cap - left.cap)
    .forEach((entry, index) => order.set(entry.symbol, index + 1));
  return order;
}

// v58.56 (#3): AMZN·GOOGL·META were silently absent because they failed the chosen screen. The line above the table
// names the screen, the count and the order, and lists the largest caps the screen left out with the condition each
// failed (the row's own value against the threshold — no new numbers).
const DROPPED_CAP_POOL = 20;
function screenLeaves(node) {
  if (!node || typeof node !== 'object') return [];
  if (node.type === 'and' || node.type === 'or') return (node.children || []).flatMap(screenLeaves);
  return node.type === 'not' ? [] : [node];
}
function screenFieldValue(row, field) {
  if (field === 'rank' || field === 'score') return row?.[field] ?? null;
  const rowKey = SCREENER_FIELD_REGISTRY.get(field)?.rowKey;
  if (rowKey && row?.[rowKey] != null) return row[rowKey];
  return row?.fieldReadiness?.fields?.[field]?.value ?? null;
}
function screenFieldLabel(field) {
  return field === 'rank' ? '백분위' : FILTER_FIELD_LABELS.get(field) || field;
}
function failedConditionText(row, definition, compiled) {
  if (row.screenStatus === 'unavailable') {
    const missing = [...new Set((row.rankExplanation?.missingEvidence || []).map(screenFieldLabel))];
    return missing.length ? `판단 자료 부족 — ${missing.slice(0, 3).join('·')}` : '판단 자료 부족';
  }
  const leaves = [...(definition?.hardGates || []), ...screenLeaves(definition?.filtersAST)];
  const failed = compiled ? leaves.filter((node) => compiled.evaluateGate(row, node).state === 'fail') : [];
  if (!failed.length) return '조건 미충족';
  return failed.map((node) => {
    const label = screenFieldLabel(node.field);
    const value = screenFieldValue(row, node.field);
    const unit = ({ percent: '%', ratio: '배', multiple: '배' })[SCREENER_FIELD_REGISTRY.get(node.field)?.unit] || '';
    const word = (item) => (node.field === 'technical.vcpStage' ? vcpStageLabel(item) : item);
    const shown = finite(value) != null ? `${numberText(value, Number.isInteger(value) ? 0 : 1)}${unit}` : value != null ? word(value) : '—';
    if (node.type === 'enum') return `${label} ${shown} — 기준 ${(node.values || []).map(word).join('·')}`;
    const bounds = [node.min != null ? `${node.min}${unit} 이상` : null, node.max != null ? `${node.max}${unit} 이하` : null].filter(Boolean).join(', ');
    return `${label} ${shown} — 기준 ${bounds || '범위'}`;
  }).join(' / ');
}
function sortOrderText(sortState) {
  const { column, ascending } = sortState || {};
  if (column === 'mcap') return ascending ? '시총 작은 순' : '시총 큰 순';
  if (column === 'screenRank') return '조건 순위 순';
  if (column === 'sym' || column === 'sector') return `${column === 'sym' ? '종목' : '섹터'} 이름 순`;
  const label = SCREENER_COLUMN_REGISTRY.find((item) => item.key === column)?.label || column;
  return `${label} ${ascending ? '낮은 순' : '높은 순'}`;
}
let tableStatusCompiled = { definition: null, compiled: null };
function renderTableStatus(documentRef, { status, scopeRows, filtered, definition, sortState, passedOnly, readLiveData, onExplain }) {
  const host = documentRef.getElementById('scr-table-status');
  if (!host) return;
  if (status === 'unavailable' || !scopeRows.length) { host.hidden = true; return; }
  host.hidden = false;
  const passed = scopeRows.filter((row) => row.screenStatus === 'passed').length;
  // v59.70 (S12): the one summary line above the table — 조건 통과 N · 자료 부족 N (rows the screen could not judge).
  const unavailable = scopeRows.filter((row) => row.screenStatus === 'unavailable').length;
  const shortNote = unavailable ? ` · 자료 부족 ${unavailable}` : '';
  // The phone line uses the screen's one-word name (균형) so the line and its 빠진 대형주 link fit one row.
  const leadFor = (name, conditionWord) => (passedOnly
    ? `${name}${conditionWord} 통과 ${passed}종목${shortNote}${filtered.length !== passed ? `, ${filtered.length}종목 표시` : ''}`
    : `${name} 기준 ${scopeRows.length}종목 전체, 통과 ${passed}${shortNote}${filtered.length !== scopeRows.length ? `, ${filtered.length}종목 표시` : ''}`);
  const fullName = definition?.name || '선택 조건';
  const shortName = PRESET_SHORT_LABELS[definition?.screenId] || fullName;
  let textNode = host.querySelector('.scr-table-status-text');
  if (!textNode) {
    textNode = documentRef.createElement('span');
    textNode.className = 'scr-table-status-text';
    const full = documentRef.createElement('span');
    full.className = 'scr-status-full';
    const short = documentRef.createElement('span');
    short.className = 'scr-status-short';
    short.setAttribute('aria-hidden', 'true');
    textNode.append(full, short);
    host.prepend(textNode);
  }
  // A market-cap order over rows without caps (the Korean listing has none in the artifact) says so instead of '시총 큰 순'.
  let order = sortOrderText(sortState);
  let shortOrder = order;
  if (sortState?.column === 'mcap') {
    const withCap = filtered.filter((row) => capFilterValue(liveRow(row, readLiveData)) != null).length;
    if (!withCap) order = shortOrder = '시총 자료 없음, 조건 순위 순';
    else if (withCap < filtered.length) order = `${order}(시총 확인 ${withCap}종목 먼저)`;
    // v58.80 (first-users F21, owner-delegated 2026-10-26): the default stays market cap — leading with an order the
    // back-test cannot yet tell from chance would read as a recommendation — and the line now says so.
    const validation = documentRef.getElementById('scr-validation-banner')?.dataset?.validationState;
    if (withCap && !sortState.ascending && validation !== 'favorable') order = `${order} — 순위가 우연과 구별되지 않아 기본은 시총 순, 전체 순위 머리글을 누르면 순위 순`;
  }
  // v58.56 review: quote refreshes re-render the table, so the text is written only when it changes.
  // v59.68: the face keeps the count and the order; why the default is market cap (and the cap coverage) is the hover.
  const fullText = `${leadFor(fullName, ' 조건')}, ${shortOrder}`;
  if (textNode.title !== order) textNode.title = order;
  const shortText = `${leadFor(shortName, '')}, ${shortOrder}`;
  if (textNode.firstChild.textContent !== fullText) textNode.firstChild.textContent = fullText;
  if (textNode.lastChild.textContent !== shortText) textNode.lastChild.textContent = shortText;
  // The largest caps of this market (funds and SPACs aside) that the screen left out — only while the table hides them.
  let dropped = [];
  if (passedOnly && definition) {
    if (tableStatusCompiled.definition !== definition) {
      let compiled = null;
      try { compiled = compileScreenDefinition(definition); } catch (_) { compiled = null; }
      tableStatusCompiled = { definition, compiled };
    }
    dropped = scopeRows
      .filter((row) => !['fund', 'spac'].includes(row?.populationExclusion) && row?.assetType !== 'ETF' && row?.index !== 'ETF')
      .map((row) => ({ row, cap: capFilterValue(liveRow(row, readLiveData)) }))
      .filter((entry) => entry.cap != null)
      .sort((left, right) => right.cap - left.cap)
      .slice(0, DROPPED_CAP_POOL)
      .filter((entry) => entry.row.screenStatus !== 'passed')
      .map((entry) => ({ row: entry.row, reason: failedConditionText(entry.row, definition, tableStatusCompiled.compiled) }));
  }
  let back = host.querySelector('.scr-passed-back');
  if (!passedOnly && definition) {
    if (!back) {
      back = documentRef.createElement('button');
      back.type = 'button';
      back.className = 'sx-link scr-passed-back';
      back.dataset.aioScreenerAction = 'passed-only';
      back.textContent = '통과 종목만 보기';
      host.append(back);
    }
  } else back?.remove();
  let fold = host.querySelector('.scr-dropped');
  if (!dropped.length) { fold?.remove(); return; }
  if (!fold) {
    fold = documentRef.createElement('details');
    fold.className = 'scr-dropped';
    fold.append(documentRef.createElement('summary'), documentRef.createElement('ul'), documentRef.createElement('p'));
    host.append(fold);
  }
  const summary = fold.querySelector('summary');
  if (summary.dataset.count !== String(dropped.length)) {
    summary.dataset.count = String(dropped.length);
    const summaryFull = documentRef.createElement('span');
    summaryFull.className = 'scr-status-full';
    summaryFull.textContent = `조건에서 빠진 대형주 ${dropped.length}개 보기`;
    const summaryShort = documentRef.createElement('span');
    summaryShort.className = 'scr-status-short';
    summaryShort.setAttribute('aria-hidden', 'true');
    summaryShort.textContent = `빠진 대형주 ${dropped.length}개`;
    summary.replaceChildren(summaryFull, summaryShort);
  }
  const signature = JSON.stringify(dropped.map((entry) => [entry.row.sym || entry.row.symbol, entry.reason]));
  if (fold.dataset.signature === signature && fold._aioOwner === onExplain) return;
  fold.dataset.signature = signature;
  fold._aioOwner = onExplain;
  const list = fold.querySelector('ul');
  list.className = 'scr-dropped-list';
  list.replaceChildren(...dropped.map(({ row, reason }) => {
    const item = documentRef.createElement('li');
    const open = documentRef.createElement('button');
    open.type = 'button';
    open.className = 'scr-dropped-sym';
    const code = documentRef.createElement('b');
    code.textContent = row.sym || row.symbol;
    const label = documentRef.createElement('span');
    label.textContent = row.name || '';
    open.append(code, label);
    open.setAttribute('aria-label', `${row.sym || row.symbol} 근거 보기`);
    open.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); onExplain?.(row); });
    const why = documentRef.createElement('span');
    why.className = 'scr-dropped-why';
    why.textContent = reason;
    item.append(open, why);
    return item;
  }));
  const note = fold.querySelector('p');
  note.className = 'scr-dropped-note';
  const showAll = documentRef.createElement('button');
  showAll.type = 'button';
  showAll.className = 'sx-link scr-dropped-all';
  showAll.dataset.aioScreenerAction = 'clear-filter';
  showAll.dataset.aioScreenerArg = 'scr-passed-only';
  showAll.textContent = '통과 못 한 종목도 표에 함께 보기';
  note.replaceChildren(documentRef.createTextNode(`이 시장 시총 상위 ${DROPPED_CAP_POOL}개 중 지금 조건 화면을 통과하지 못한 종목입니다. `), showAll);
}

export function render({ documentRef, root = globalThis, store, readLiveData, readWatchlist, readAliases, sortState, visibleLimit, onWatchlistToggle, onExplain, onCompare, onVisibleSymbols, selectedSymbols, compareSymbols, columnPreset = 'discovery', customColumns = [], rowsOverride = null, workbenchResult = null, previewResult = null, onDataChange = null, onRetry = null }) {
  const rawState = selectScreenerState(store?.getState?.() || {});
  const listingMarket = selectedValue(documentRef, 'scr-listing-market') || 'US';
  const currentState = { ...rawState, metadata: { ...rawState?.metadata, populationRanking: rawState?.metadata?.ranking || null, ranking: marketRankingMetadata(rawState?.metadata, listingMarket) } };
  const sourceState = workbenchResult?.run ? { ...currentState, metadata: workbenchResult.snapshotMetadata || {}, status: 'partial', lastRun: workbenchResult.run, readiness: workbenchResult.readiness } : currentState;
  const state = { ...sourceState, metadata: { ...sourceState.metadata, selectionMarket: listingMarket, ranking: marketRankingMetadata(sourceState.metadata, listingMarket) } };
  // P1165: 실행 전에는 파이프라인 기본 결과가 아니라 **선택한 정의**의 미리보기를 표시한다.
  const preview = workbenchResult?.run ? null : previewResult;
  const page = documentRef?.getElementById('page-screener');
  if (!page) return;
  const rows = rowsOverride || state?.rows || [];
  syncScreenerControlAvailability(documentRef, { rows: currentState.rows || [], listingMarket, ranking: currentState.metadata.ranking, profiles: root?.AIO_TRADER_PROFILES || null });
  // v58.75 (persona review): RS percentiles over the whole loaded set (before display filters) and the theme-stage inputs.
  screenerRuntime.currentRsPercentiles = marketReturnPercentiles(rows);
  screenerRuntime.themeStageRoot = root;
  screenerRuntime.themeStageRows = currentState.rows || rows;
  const filtered = filterAndSortRows(rows, documentRef, { readWatchlist, readAliases, sortState, readLiveData });
  const chosenDefinition = workbenchResult?.definition || preview?.definition || state?.screenDefinition;
  const presetOrder = documentRef.getElementById('scr-order')?.querySelector('option[value="screenRank"]');
  if (presetOrder && chosenDefinition?.ranking) {
    const ranking = chosenDefinition.ranking;
    const field = SCREENER_FIELD_REGISTRY.get(ranking.field);
    presetOrder.textContent = `조건 순위, ${field?.label || field?.name || (ranking.field === 'rank' ? '선택 비중의 팩터 백분위' : ranking.field)} ${ranking.direction === 'asc' ? '낮은 순' : '높은 순'}`;
  }
  // v57.55 review (E1-06): 밸류·퀄리티 stay switched off until fundamentals cover enough of the universe, so the columns were
  // '—' on every row. A factor column with no score in any row is left out instead of shown empty.
  const scored = (key) => rows.some((row) => finite(row?.factorScores?.[key]) != null);
  const visibleColumns = getVisibleColumns(columnPreset, customColumns).filter((column) => !['value', 'quality'].includes(column.key) || scored(column.key));
  screenerRuntime.consensusRoot = root;
  const custom = parseConditionValue(selectedValue(documentRef, 'scr-custom-conditions'));
  const scopeRows = scopedRows(rows, listingMarket);
  // v57.59: a condition the market has no data for (e.g. SEC financials for 한국) is greyed out instead of returning 0.
  // Forward PER loads on demand, so it stays offered for 미국 even before the estimates arrive.
  if (screenerRuntime.availableCache.rows !== scopeRows.length || screenerRuntime.availableCache.market !== listingMarket || screenerRuntime.availableCache.source !== rows || screenerRuntime.availableCache.signals !== root?.AIO_TELEGRAM_SIGNALS) {
    screenerRuntime.availableCache = { rows: scopeRows.length, market: listingMarket, source: rows, signals: root?.AIO_TELEGRAM_SIGNALS, ids: availableConditionIds(scopeRows, customRead) };
    if (listingMarket === 'US') { screenerRuntime.availableCache.ids.add('fwdpe-max'); CASH_CONDITION_IDS.forEach((id) => screenerRuntime.availableCache.ids.add(id)); }
  }
  const coverageCounts = conditionCoverage(scopeRows, custom, customRead);
  screenerRuntime.customPanel?.update(coverageCounts, filtered.length, screenerRuntime.availableCache.ids);
  {
    // The 섹터 select in the bar reads as a set chip once a sector is chosen.
    documentRef.getElementById('scr-sector')?.classList.toggle('is-set', !!selectedValue(documentRef, 'scr-sector'));
  }
  if (visibleColumns.some((column) => column.key === 'fwdPe') || sortState.column === 'fwdPe' || custom.some((item) => item.id === 'fwdpe-max')) requestConsensusEstimates(root, onDataChange);
  if (custom.some((item) => CASH_CONDITION_IDS.includes(item.id))) requestCashMetrics(root, onDataChange);
  const table = documentRef.getElementById('screener-results-table');
  renderTableHeader(documentRef, table, visibleColumns, sortState);
  // v58.56 (4b): the phone's one-line rows apply to the default columns only (screener-quality.css).
  if (table) table.dataset.columnPreset = columnPreset;
  const body = documentRef.getElementById('screener-results-body');
  if (body) {
    const focusedRow = documentRef.activeElement?.closest?.('[data-aio-screener-ticker]');
    const focusedSymbol = body.contains(focusedRow) ? focusedRow.dataset.aioScreenerTicker : null;
    const focusedAction = focusedSymbol && documentRef.activeElement?.getAttribute('aria-label');
    const visible = filtered.slice(0, visibleLimit.value);
    {
      const lead = filtered.find((row) => row.screenStatus === 'passed') || null;
      syncScreenerNextLead(documentRef, lead, { scoped: filtered.length !== rows.length || sortState.column !== 'rank' });
    }
    if (!workbenchResult?.run) onVisibleSymbols?.(visible.map((row) => row.sym || row.symbol).filter(Boolean));
    if (!visible.length) {
      body.replaceChildren();
      tableRowCache.delete(body);
      const empty = documentRef.createElement('tr');
      // LC-73: 필터 0건의 "거절"과 "데이터 미상으로 판정 보류"를 분리해 말한다 — 시총 필터가
      // 걸려 있는데 시총이 없는 행을 조용히 제외하면 0건이 '조건 미달 0건'으로만 읽힌다.
      const capFilter = selectedValue(documentRef, 'scr-cap');
      let capHeld = 0;
      if (capFilter) {
        rows.forEach((row) => {
          if (capFilterValue(row) == null) capHeld += 1;
        });
      }
      const capLabel = { MEGA: '초대형($1T+)', LARGE: '대형($10B~1T)', MID: '중형($2~10B)', SMALL: '소형(<$2B)' }[capFilter] || capFilter;
      // P1673: when every row of the chosen market is held because its price indicators are older than the
      // latest session, the table is empty for lack of current data, not because no stock met the conditions.
      const listingRows = (state?.rows || []).filter((row) => screenerMarket(row) === listingMarket);
      const heldForData = listingRows.length > 0 && listingRows.every((row) => row.screenStatus === 'unavailable');
      // v58.80 (first-users F02): on a slow phone the factor file had not arrived yet, every row read 'unavailable', and the
      // table said all 904 were "not on the latest session" — a final verdict for a load still in progress.
      const factorsPending = heldForData && !state?.metadata?.asOf;
      const rowsFailed = state?.status === 'unavailable' && screenerRowsState(root) === 'failed';
      const emptyMessage = state?.status === 'unavailable'
        ? `${dataStateText(rowsFailed ? 'failed' : 'loading', '스크리너 자료')}` // v58.80 bundle 3: was '미수신' for both
        : factorsPending
          ? '종목 지표를 불러오는 중입니다 — 도착하면 순위가 표시됩니다'
        : heldForData
          ? `${MARKET_LABELS[listingMarket] || listingMarket} ${listingRows.length}종목 모두 필수 지표가 최신 거래일 기준이 아니어서 순위 판정을 보류했습니다 — 데이터 갱신 후 표시됩니다`
          : capFilter && capHeld > 0
          ? `조건을 충족한 0건 / 시총 정보가 없어 판정 보류 ${capHeld}건 — 시총 적격 ${rows.length - capHeld}/${rows.length}, 적용 컷 ${capLabel}`
          : '조건에 맞는 종목이 없습니다';
      // P1592 (F02): say what the search ran over and offer the way back, instead of one dead sentence.
      const searchRaw = selectedValue(documentRef, 'scr-text-search').trim();
      const searchText = searchRaw.length > 40 ? `${searchRaw.slice(0, 40)}…` : searchRaw; // first-users run 4 (breaker #16): a 5,000-char query ran off-screen
      const scopedMessage = state?.status !== 'unavailable' && !(capFilter && capHeld > 0) && searchText
        ? `'${searchText}' — 지금 시장·섹터·조건 안에서는 찾지 못했습니다. 전체에서 찾으려면 조건을 지웁니다.`
        : emptyMessage;
      // v59.70 (S12): the cell holds the shared data state — a skeleton while the rows or the factor file are on the way,
      // one line plus 다시 시도 when the read failed, one line plus the ways out when the conditions leave nothing.
      const stateCell = cell(documentRef, '', 'scr-empty-cell');
      stateCell.colSpan = visibleColumns.length;
      empty.appendChild(stateCell);
      const loading = (state?.status === 'unavailable' && !rowsFailed) || factorsPending;
      renderDataState(stateCell, loading ? { state: 'loading', lines: 4, timeoutText: '스크리너 자료를 받지 못했습니다', onRetry }
        : rowsFailed ? { state: 'error', text: scopedMessage, onRetry }
          : { state: 'empty', text: scopedMessage });
      stateCell.dataset.scrState = loading ? 'loading' : rowsFailed ? 'error' : 'empty';
      // v58.80 first-users run-2: while the factor file is still arriving, "clear the filters" is not the way out.
      if (state?.status !== 'unavailable' && !factorsPending) {
        const actions = documentRef.createElement('div');
        actions.className = 'scr-empty-actions';
        const action = (label, name, arg) => {
          const button = documentRef.createElement('button');
          button.type = 'button';
          button.className = 'aio-btn-table';
          button.textContent = label;
          button.dataset.aioScreenerAction = name;
          if (arg) button.dataset.aioScreenerArg = arg;
          return button;
        };
        if (searchText) actions.appendChild(action('검색어 지우기', 'clear-filter', 'scr-text-search'));
        // v58.80 run-5 (breaker #1): 'RSI 30 이하' matched 68 stocks, the table showed 0 inside 실행 통과만, and the only way out
        // ('모두 지우기') also deleted the condition. The narrower scope is offered first and keeps the condition.
        if (documentRef.getElementById('scr-passed-only')?.checked) actions.appendChild(action("'조건 통과만' 끄고 전체에서 찾기", 'clear-filter', 'scr-passed-only'));
        actions.appendChild(action('조건 모두 지우기', 'reset-all-filters'));
        empty.firstChild.appendChild(actions);
      }
      body.appendChild(empty);
    } else {
      // v58.56 review: under another sort (a preset sorts by 조건 순위) a market-cap number in the first column read as the
      // rank, so "#" is the row's place in the order the table is sorted by; under the default 시총 sort that is the cap order.
      const capOrder = !visibleColumns.some((column) => column.key === 'capOrder') ? null
        : sortState.column === 'mcap' ? capOrderMap(filtered, readLiveData) : new Map(filtered.map((row, index) => [row.sym || row.symbol, index + 1]));
      const nodes = tableRowNodes(documentRef, body, visible, { readLiveData, readWatchlist, onWatchlistToggle, onExplain, onCompare, selectedSymbols, compareSymbols, visibleColumns, capOrder, rankHold: currentState.metadata.ranking.available === false ? { reason: currentState.metadata.ranking.rankingUnavailableReason } : root._aioRankingHold || null });
      const children = body.children;
      if (children.length !== nodes.length || nodes.some((node, index) => children[index] !== node)) body.replaceChildren(...nodes);
      shareCloseDay(documentRef, table, body);
    }
    if (focusedSymbol) {
      const row = [...body.querySelectorAll('[data-aio-screener-ticker]')].find((node) => node.dataset.aioScreenerTicker === focusedSymbol);
      const action = row && [...row.querySelectorAll('button')].find((node) => node.getAttribute('aria-label') === focusedAction);
      (action || row)?.focus({ preventScroll: true });
    }
  }
  const count = documentRef.getElementById('screener-result-count');
  if (count) count.textContent = String(filtered.length);
  renderTableStatus(documentRef, { status: state?.status, scopeRows, filtered, definition: chosenDefinition, sortState, passedOnly: !!documentRef.getElementById('scr-passed-only')?.checked, readLiveData, onExplain });
  // The rows and the count are on screen: readers that changed a filter (the AI condition card) take the count from here.
  documentRef.dispatchEvent?.(new (documentRef.defaultView?.CustomEvent || CustomEvent)('aio:screener-filtered', { detail: { count: filtered.length } }));
  const summary = documentRef.getElementById('scr-visible-summary');
  if (summary) summary.textContent = `${MARKET_LABELS[listingMarket]}, ${filtered.length}종목 중 ${Math.min(visibleLimit.value, filtered.length)}개 표시`;
  renderStaleNote(documentRef, body);
  const loadMore = documentRef.getElementById('scr-load-more-wrap');
  if (loadMore) {
    // P1592 (F03): the button names how many rows it will actually add; the summary confirms the end.
    loadMore.hidden = visibleLimit.value >= filtered.length;
    const moreButton = loadMore.querySelector('[data-aio-screener-action="load-more"]');
    if (moreButton) moreButton.textContent = `${Math.min(12, Math.max(0, filtered.length - visibleLimit.value))}개 더 보기`;
  }
  if (summary && filtered.length && visibleLimit.value >= filtered.length) summary.textContent = `${MARKET_LABELS[listingMarket]}, ${filtered.length}종목 모두 표시`;
  const diagnostics = documentRef.getElementById('scr-population-note');
  if (diagnostics) {
    const ranking = currentState.metadata.ranking;
    const weights = ranking.appliedFactorWeights || {};
    const order = documentRef.getElementById('scr-order')?.selectedOptions?.[0]?.textContent || SCREENER_COLUMN_REGISTRY.find(column => column.key === sortState.column)?.label || '조건 순위';
    // 2026-10-14 audit #3: one denominator on this screen — the rows the ranking actually ranked (the same set the
    // reading's top 20% and the stock summary's rank use). Why the rest of the population is not ranked is folded.
    const population = scopedRows(currentState.rows || [], listingMarket);
    const screened = population.filter((row) => finite(row?.screenRank) != null).length;
    const rankedCount = screened || ranking.ranked || 0;
    // v57.81: which population the percentiles come from — the core universe or the extended one.
    const contract = RANKING_CONTRACTS[rawState?.metadata?.universeScope === 'extended' ? 'extended' : 'core'];
    // v58.79: the counts stay on screen; the order (already in its select) and the weights are the line's hover.
    diagnostics.textContent = `${MARKET_LABELS[listingMarket]} 순위 계산 ${rankedCount}종목(${contract.label}), 표시 ${filtered.length}개`;
    diagnostics.title = `${order}, 비중 ${Object.entries(weights).map(([key, value]) => `${FACTOR_LABELS[key]?.label || key} ${Math.round(value * 100)}%`).join(' / ') || '계산 보류'}`;
    diagnostics.dataset.rankingContract = contract.id;
    const excluded = documentRef.getElementById('scr-population-excluded');
    if (excluded) {
      const left = population.length - rankedCount;
      const missing = population.filter((row) => row?.screenStatus === 'unavailable').length;
      const rejected = population.filter((row) => row?.screenStatus === 'rejected').length;
      // 2026-10-16: funds, SPACs and sub-$1M 확장 names are left out of the ranked population by design.
      const outside = (reason) => population.filter((row) => row?.screenStatus === 'passed' && row?.populationExclusion === reason).length;
      const funds = outside('fund');
      const spacs = outside('spac');
      const illiquid = outside('illiquid');
      const foreign = outside('foreign');
      const thin = population.filter((row) => row?.screenStatus === 'passed' && row?.rankingEligibility === 'insufficient-row-factor-coverage').length;
      const unscored = population.filter((row) => row?.screenStatus === 'passed' && finite(row?.screenRank) == null && !row?.populationExclusion && row?.rankingEligibility !== 'insufficient-row-factor-coverage').length;
      excluded.hidden = !(screened && left > 0);
      excluded.querySelector('summary').textContent = `순위 밖 ${left}종목`;
      excluded.querySelector('p').textContent = `${MARKET_LABELS[listingMarket]} 모집단 ${population.length}종목 중 ${left}종목은 순위를 매기지 않습니다 — ${[funds ? `ETF·펀드 ${funds}` : null, spacs ? `SPAC ${spacs}` : null, illiquid ? `하루 거래대금 100만 달러 미만 ${illiquid}` : null, foreign ? `해외 상장 ${foreign}` : null, thin ? `공시 재무 등 팩터 근거 부족 ${thin}` : null, missing ? `필수 자료 부족 ${missing}` : null, rejected ? `조건 미통과 ${rejected}` : null, unscored ? `점수 계산 불가 ${unscored}` : null].filter(Boolean).join(', ') || '사유 미확인'}.`;
    }
    const sessionLag = !(ranking.ranked > 0) ? factorSessionLag(listingMarket, currentState.metadata.factorSessionDateByMarket?.[listingMarket], Date.now()) : null;
    if (sessionLag) diagnostics.textContent += `, 가격 자료 ${sessionLag.session.slice(5).replace('-', '/')} 종가 기준, ${sessionLag.latest.slice(5).replace('-', '/')} ${sessionLag.label} 반영 대기`;
    diagnostics.title = '백분위는 같은 시장의 계산 가능한 종목끼리 비교합니다. 정렬과 조건, 표시 필터는 서로 다른 역할입니다. 데이터가 없거나 조건을 통과하지 못한 종목은 순위에서 제외합니다.';
  }
  const allRows = scopedRows(rows, listingMarket);
  const total = documentRef.getElementById('scr-kpi-total');
  const top = documentRef.getElementById('scr-kpi-top');
  const factorCount = documentRef.getElementById('scr-kpi-factors');
  if (total) total.textContent = String(allRows.length);
  const ranked = documentRef.getElementById('scr-kpi-ranked');
  if (ranked) ranked.textContent = String(allRows.filter((row) => row.screenStatus === 'passed').length);
  if (top) {
    top.textContent = String(allRows.filter((row) => row.screenStatus === 'passed' && finite(row.rank) != null && row.rank >= 80).length);
    // 2026-10-14 audit #3: this count is the factor percentile ≥ 80, not a rank — name it so (index.html label follows).
    // v57.88 (screen audit): the percentile is rounded (79.5 counts as 80), so this reads slightly above the reading's
    // 상위 20% by screen rank — a different order (selected screen, all markets). The label says which one it is.
    const lead = top.parentElement?.firstChild;
    if (lead?.nodeType === 3 && /^(?:그중\s*)?(?:랭크|백분위) 80 이상\s*$/.test(lead.textContent)) lead.textContent = lead.textContent.replace(/(?:랭크|백분위) 80 이상\s*$/, '팩터 백분위 80 이상(반올림) ');
  }
  if (factorCount) factorCount.textContent = String(state?.metadata?.ranking?.activeFactors?.length || '—');
  const asOf = page.querySelector('[data-factor-asof]');
  const marketFactorSession = state?.metadata?.factorSessionDateByMarket?.[listingMarket] || state?.metadata?.factorObservedAt;
  // v57.91 (wording audit): '미국 10/15 종가 기준 · 10/16 계산' instead of '미국 팩터 세션 2026-10-15 · 생성 2026-10-16'.
  const kstDay = (value) => { const at = Date.parse(value || ''); return Number.isFinite(at) && /T/.test(String(value)) ? new Date(at + 9 * 3600000).toISOString().slice(0, 10) : value; }; // v58.74: 계산일 in KST
  const monthDay = (value) => { const day = stampDay(value); return day ? shortDate(day) : String(value || '').slice(0, 10) || '—'; };
  if (asOf) asOf.textContent = marketFactorSession ? `${MARKET_LABELS[listingMarket] || ''} ${monthDay(marketFactorSession)} 종가 기준, ${state?.metadata?.asOf ? `${monthDay(kstDay(state.metadata.asOf))} 계산` : '계산일 미확인'}` : state?.metadata?.asOf ? `${monthDay(kstDay(state.metadata.asOf))} 계산` : '팩터 데이터 대기';
  const provenance = page.querySelector('[data-screener-provenance]');
  if (provenance) {
    const metadata = state?.metadata || {};
    // v58.74 (audit): the ISO stamps are UTC; '수집 2026-10-23 21:49' beside '10/23 종가 기준' read as a KST time before the US open.
    const fmtDate = (value) => { const at = Date.parse(value || ''); return Number.isFinite(at) ? `${new Date(at + 9 * 3600000).toISOString().slice(0, 16).replace('T', ' ')} 한국 시간` : value ? String(value).slice(0, 16).replace('T', ' ') : '—'; };
    const sec = metadata.secFundamentalsEligible > 0
      ? `SEC 연간 재무 ${metadata.secFundamentalsStored || 0}/${metadata.secFundamentalsEligible}종목`
      : 'SEC 연간 재무 확인 대기';
    const universeNote = metadata.universeFreshnessStatus === 'stale'
      ? `종목 목록 갱신 필요 (${fmtDate(metadata.universeLastBulkUpdate)})`
      : metadata.universeFreshnessStatus === 'unknown' ? '종목 목록 최신성 미확인' : '종목 목록 최신';
    const research = metadata.researchContext || {};
    const researchNote = research.referenceId
      ? `연구 근거 연결(프레임 ${research.frameworkIds?.length || 0}개, 시계열 ${research.timeSeriesIds?.length || 0}개, 주장 ${research.claimIds?.length || 0}개, 참고용)`
      : '연구 프레임 연결 대기';
    const validation = metadata.modelValidation || {};
    const validationNote = validation.status === 'READY'
      ? '모델 검증 통과(거래 판단에 쓰려면 별도 승인 필요)'
      : '모델 검증 미통과 — 거래 판단에 쓰지 않습니다';
    // P1167 (15 D04): `metadata.factorObservedAt`는 Yahoo 일봉 timestamp, 즉 그 세션 **바의 시작**이다.
    // 종가로 계산한 팩터를 '관측 시각'으로 표시하면 그날 개장 시점에 이미 알 수 있었다는 의미가 된다.
    // 세션 기준일과 수집·생성 시각을 분리하고, 바 시작 시각을 관측시각으로 승격하지 않는다.
    // R24-03/P1179: P1170의 시장별 세션 맵이 provider를 통과하면 그 값을 쓴다 — 혼합 시장의
    // 세션일은 하나의 스칼라로 합칠 수 없고, 없을 때만 호환 바 시작 날짜로 폴백한다.
    const sessionByMarket = metadata.factorSessionDateByMarket && typeof metadata.factorSessionDateByMarket === 'object' ? metadata.factorSessionDateByMarket : null;
    const factorSessionDate = sessionByMarket
      ? (sessionByMarket[listingMarket] ? `${MARKET_LABELS[listingMarket] || listingMarket} ${String(sessionByMarket[listingMarket]).slice(0, 10)}` : '')
      : String(metadata.factorSessionDate || metadata.factorObservedAt || '').slice(0, 10);
    const factorSessionLabel = factorSessionDate ? `팩터 ${factorSessionDate} 세션 종가 기준(일봉 바 시작 ${fmtDate(metadata.factorObservedAt)}, 관측시각 아님)` : '팩터 기준 세션 미확인';
    // v58.74 (text audit): raw tokens (BLOCKED, n blockers, basis bar-start) and the provider name left the visible line;
    // the provider and the blocker count sit in the hover title.
    provenance.textContent = `연구용 스냅샷, ${factorSessionLabel}, 수집 ${fmtDate(metadata.factorFetchedAt || metadata.asOf)}, 생성 ${fmtDate(metadata.asOf)}, ${sec}, ${universeNote}, ${researchNote}, ${validationNote}. 거래소 공식 집계가 아닙니다.`;
    provenance.title = `${metadata.source ? `출처: ${metadata.source}. ` : ''}${validation.blockers?.length ? `검증 미충족 요건 ${validation.blockers.length}개. ` : ''}${metadata.fundamentalCoverageScope ? `${metadata.fundamentalCoverageScope}, ` : ''}일봉 timestamp는 바 시작이며 종가 기반 팩터의 관측시각이 아닙니다. 세션 기준일·수집시각·생성시각을 분리해 표시합니다.`;
    provenance.dataset.sourceKind = 'reference';
    provenance.dataset.operationalUse = 'reference-only';
  }
  const readiness = documentRef.getElementById('screener-readiness-note');
  const run = workbenchResult?.run || preview?.run || state?.lastRun || {};
  const readinessResult = workbenchResult?.readiness || preview?.readiness || state?.readiness;
  const readyCount = Array.isArray(readinessResult?.records) ? readinessResult.records.filter(row => screenerMarket(row) === listingMarket && row.eligible).length : readinessResult?.eligibleCount ?? 0;
  const passedCount = allRows.filter(row => row.screenStatus === 'passed').length;
  const unavailableCount = allRows.filter(row => row.screenStatus === 'unavailable').length;
  const previewConditions = preview?.definition ? describeFilterAst(preview.definition) : null;
  // 개편 v2 (3c): the kicker states the collected and computable counts once, before the close basis.
  const kickerCounts = documentRef.getElementById('scr-kicker-counts');
  // v59.70 (screen review 16): the kicker, the status line and the drawer's '전체 N위 / M' used four totals with no link
  // between them. The kicker names the chain (collected → computed → ranked), the drawer reads against the same ranked
  // count, and the status line's 조건 통과 is the subset of that.
  const rankedRows = scopedRows(currentState?.rows || rows, listingMarket).filter((row) => finite(row?.screenRank) != null).length; // the drawer's source
  if (kickerCounts) kickerCounts.textContent = state?.status === 'unavailable' || !allRows.length ? '' : `${allRows.length}종목 중 ${readyCount}종목 계산, ${rankedRows}종목 순위`;
  // P1167 (15 D05): 정적 유니버스가 MIC·assetType을 발행하지 않으면 식별 미확인 행이 남는다. 가격 조회
  // 성공과 식별 metadata 확인을 같은 것으로 읽지 않도록 미확인 수와 누락 필드를 함께 표시한다.
  // v58.74 (owner decision INTL, resolved on the recommended option): Tokyo/Taiwan listings stay in the table for their
  // theme context but are outside the US ranking population (factor-ranks 'foreign'); the count line says so.
  const foreignRows = allRows.filter((row) => row.populationExclusion === 'foreign' || /\.(T|TWO?)$/i.test(String(row.sym || '')));
  const foreignNote = foreignRows.length ? `해외 상장 ${foreignRows.length}개(${foreignRows.slice(0, 4).map((row) => row.sym).join(', ')})는 표에 남기되 미국 순위에서는 뺍니다. ` : '';
  const identityGaps = allRows.filter((row) => row.identityValidation && row.identityValidation.ok === false);
  const identityMissingFields = [...new Set(identityGaps.flatMap((row) => row.identityValidation.missing || []))];
  const IDENTITY_FIELD_NAMES = { mic_missing: '거래소', asset_type_missing: '자산 유형', currency_missing: '통화' };
  const identityNote = identityGaps.length
    ? `식별 정보(${identityMissingFields.map((field) => IDENTITY_FIELD_NAMES[field] || field).join('·')}) 미확인 ${identityGaps.length}개 — 가격 조회 성공은 식별 확인이 아닙니다. `
    : '';
  const previewNote = previewConditions
    ? `미리보기 정의 ${preview.definition?.screenId || '—'}(${String(preview.definition?.definitionHash || '').slice(0, 8)}), 조건 내장 ${previewConditions.builtin.length}개${previewConditions.builtin.length ? `: ${previewConditions.builtin.slice(0, 2).map(item => item.text).join(', ')}` : ''}${previewConditions.user.length ? `, 사용자 추가 ${previewConditions.user.length}개` : ''}, `
    : '';
  if (readiness) readiness.title = [previewNote ? previewNote.replace(/, $/, '') : null, previewConditions ? `내장 조건: ${previewConditions.builtin.map(item => item.text).join(', ') || '없음'} | 사용자 추가: ${previewConditions.user.map(item => item.text).join(', ') || '없음'}` : null, run?.runId ? `실행 ${String(run.runId).slice(0, 12)}` : null].filter(Boolean).join(' | ');
  if (readiness) readiness.textContent = state?.status === 'unavailable'
    ? '데이터 상태: 산출물 미수신, 결과와 검증 수치를 표시하지 않습니다.'
    : `${state?.metadata?.artifactFreshnessStatus === 'stale' || state?.metadata?.factorFreshnessStatus === 'stale' ? '갱신 지연: 원자료는 기준일과 함께 표시하고 계산은 필드별로 확인합니다. ' : ''}${state?.metadata?.universeFreshnessStatus === 'stale' ? '종목 목록 최신성 확인 필요, ' : ''}종목 ${allRows.length}개 중 필수 자료 충족 ${readyCount}개, 조건 통과 ${passedCount}개, 자료 부족 ${unavailableCount}개(${MARKET_LABELS[listingMarket]} 범위), 지금 필터로 보이는 행 ${filtered.length}개. ${foreignNote}${identityNote}상대 순위는 연구용이며 매매 지시가 아닙니다.`;
  // LC-25: bind the executed judgment to the run that produced it and keep the table's display
  // scope separate. A preview is an unfixed run and is labeled as such; the pipeline entry and a
  // user run are different origins over the same artifact.
  const runOrigin = workbenchResult?.run ? 'user'
    : preview?.run ? 'preview'
      : state?.lastRun ? 'pipeline' : null;
  renderFunnel(documentRef, {
    universe: allRows.length,
    ready: readyCount,
    passed: passedCount,
    unavailable: unavailableCount,
    filtered: filtered.length,
    runRowCount: allRows.length,
    runId: run?.runId,
    origin: runOrigin,
    passedOnly: !!documentRef.getElementById('scr-passed-only')?.checked
  });
  renderFilterChips(documentRef);
  syncUniverseScopeControl(documentRef, root, rawState, listingMarket);
  const coverage = documentRef.getElementById('screener-factor-coverage');
  const holdEl = documentRef.getElementById('screener-rank-hold');
  const hold = currentState.metadata.ranking.available === false ? { reason: currentState.metadata.ranking.rankingUnavailableReason } : root?._aioRankingHold || null;
  if (coverage) {
    const ranking = state?.metadata?.ranking || {};
    const active = ranking.activeFactors || [];
    const reasons = ranking.inactiveFactorReasons || {};
    const omitted = ['size', 'value', 'quality'].filter((key) => !active.includes(key));
    // 2026-10-13 review S15: reader labels and one short reason per excluded factor; the model's full reason
    // (coverage %, gate list) stays in the hover title.
    const label = (key) => FACTOR_LABELS[key]?.label || key;
    const shortReason = (key) => key === 'size' ? '시가총액 미수신' : ['value', 'quality'].includes(key) ? `재무 자료 커버리지 ${finite(ranking.factorCoverage?.[key]?.coveragePct) ?? '—'}%(기준 80%)` : '자료 부족';
    coverage.textContent = active.length ? `활성 팩터 ${active.length}개: ${active.map(label).join(', ')}${omitted.length ? ` | 제외: ${omitted.map((key) => `${label(key)}(${shortReason(key)})`).join(', ')}` : ''}` : '활성 팩터 없음 — 서버 팩터 파일 미수신';
    coverage.title = [omitted.map((key) => reasons[key] ? `${label(key)}: ${reasons[key]}` : '').filter(Boolean).join(' / '), hold ? `순위 보류 사유: ${hold.reason} — 이전 계산은 폐기됐습니다` : ''].filter(Boolean).join(' | ');
  }
  if (holdEl) {
    // LC-73 style (P1449): when a re-rank is held, the visible summary (not just a tooltip)
    // discloses that the previous calculation was discarded and why.
    const holdCopy = describeRankingHold(hold, { market: listingMarket, factorSessionDate: state?.metadata?.factorSessionDateByMarket?.[listingMarket] || state?.metadata?.factorSessionDate || state?.metadata?.asOf || state?.revision || null });
    holdEl.hidden = !holdCopy;
    if (holdCopy) {
      holdEl.textContent = holdCopy;
      holdEl.dataset.rankHoldReason = hold.reason || '';
      holdEl.dataset.rankHoldAt = String(hold.at || '');
    }
  }
  const rankingState = state?.metadata?.ranking || {};
  renderFactorTab(documentRef, state?.metadata);
  renderBacktest(documentRef, state?.metadata, root, scopedRows(state?.rows || [], listingMarket));
  renderConditionalEvidence(documentRef, state?.metadata);
  renderValidationState(documentRef, root, state?.metadata, listingMarket);
  page.querySelectorAll('[data-scr-sort]').forEach((header) => {
    const arrow = header.querySelector('.scr-arrow');
    const active = header.dataset.scrSort === sortState.column;
    if (arrow) arrow.textContent = active ? (sortState.ascending ? ' ▲' : ' ▼') : '';
    if (active) header.setAttribute('aria-label', `${header.dataset.sortLabel || header.textContent.replace(/[▲▼]/g, '').trim()} 정렬 ${sortState.ascending ? '오름차순' : '내림차순'}`);
  });
  page.dataset.aioArchitectureRoute = 'screener';
  page.dataset.aioArchitectureSlice = 'screener';
  page.dataset.aioArchitectureRenderer = 'native';
  page.dataset.aioArchitectureStatus = state?.status || 'unavailable';
  if (rankingState.activeFactorRegime && documentRef.getElementById('screener-regime-note')) documentRef.getElementById('screener-regime-note').textContent = rankingState.activeFactorRegime;
}

/** Live quotes for the visible rows (throttled, retried while most rows lack a quote). */
export function createQuoteRequester(ctx) {
  const { documentRef, root, store, page, bag, workbench, sortState, visibleLimit, columnState, selectedSymbols, compareSymbols, liveReader, watchlistReader, profileReader, onWatchlistToggle, onProfileChange, onUniverseScopeChange } = ctx;
      let visibleQuoteSignature = '';
      let visibleQuoteRequestedAt = 0;
      // v57.86 (live review): a run that met another quotes run in flight (skipped, or fetchLiveQuotes returned at once) left
      // the rows unquoted behind the 55-second throttle; while most requested rows still lack a quote it retries.
      ctx.requestVisibleQuotes = (symbols, attempt = 0) => {
        const requested = [...new Set((Array.isArray(symbols) ? symbols : []).map((symbol) => String(symbol || '').trim().toUpperCase()).filter(Boolean))].slice(0, 120);
        if (!requested.length) return;
        requested.forEach((symbol) => root?.AIO?.registerLiveSymbol?.(symbol, { reason: 'screener-visible-row' }));
        const signature = requested.join('|');
        const nowMs = Date.now();
        if (!attempt && signature === visibleQuoteSignature && nowMs - visibleQuoteRequestedAt < 55_000) return; // only a retry passes the throttle
        if (root?._aioBootPhase?.quoteReady === false || typeof root?.AIO?.runScheduledRefresh !== 'function') return;
        visibleQuoteSignature = signature;
        visibleQuoteRequestedAt = nowMs;
        Promise.resolve(root.AIO.runScheduledRefresh({
          keys: ['quotes'],
          symbols: requested,
          pageId: 'screener',
          reason: 'screener-visible-quotes'
        })).then(() => {
          if (attempt < 3 && requested.filter((symbol) => !(Number(root?._liveData?.[symbol]?.price) > 0)).length > requested.length / 2) {
            setTimeout(() => { if (ctx.mountActive) ctx.requestVisibleQuotes(requested, attempt + 1); }, 4000); // v57.88: not after leaving the page
          }
        }).catch(() => {});
      };
}
